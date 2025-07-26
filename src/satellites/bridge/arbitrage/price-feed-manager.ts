/**
 * Price Feed Manager
 * Aggregates real-time price data from multiple sources across chains
 */

import { EventEmitter } from 'events';
import axios from 'axios';
import { WebSocket } from 'ws';
import Logger from '../../../shared/logging/logger';
import { RedisManager } from '../../../shared/database/redis-manager';
import { AssetPrice, ChainID, AssetID } from '../types';
import { markUnused } from '../../../utils/type-safety.js';

const logger = Logger.getLogger('price-feed-manager');

export interface PriceFeedConfig {
  chains: ChainID[];
  updateInterval: number;
  cacheExpiry: number;
  sources: PriceSource[];
  websocketReconnectDelay: number;
  priceValidationThreshold: number; // Max % deviation between sources
}

export interface PriceSource {
  name: string;
  type: 'rest' | 'websocket' | 'oracle';
  endpoint: string;
  apiKey?: string;
  chains: ChainID[];
  priority: number;
  rateLimit?: number;
}

export interface PriceUpdate {
  assetId: AssetID;
  chainId: ChainID;
  prices: SourcePrice[];
  aggregatedPrice: number;
  timestamp: number;
  confidence: number;
}

export interface SourcePrice {
  source: string;
  price: number;
  liquidity?: number;
  timestamp: number;
}

export class PriceFeedManager extends EventEmitter {
  private config: PriceFeedConfig;
  private redis: RedisManager;
  private websockets: Map<string, WebSocket> = new Map();
  private priceCache: Map<string, AssetPrice> = new Map();
  private updateTimers: Map<string, NodeJS.Timeout> = new Map();
  private isRunning = false;

  constructor(config: PriceFeedConfig) {
    super();
    this.config = config;
    this.redis = RedisManager.getInstance({
      host: process.env['REDIS_HOST'] || 'localhost',
      port: parseInt(process.env['REDIS_PORT'] || '6379'),
      keyPrefix: 'price-feed:',
    });
  }

  async initialize(): Promise<void> {
    try {
      await this.redis.connect();
      await this.loadCachedPrices();
      logger.info('Price Feed Manager initialized');
    } catch (error) {
      logger.error('Failed to initialize Price Feed Manager:', error);
      throw error;
    }
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Price Feed Manager already running');
      return;
    }

    this.isRunning = true;

    // Connect to WebSocket sources
    for (const source of this.config.sources.filter(s => s.type === 'websocket')) {
      await this.connectWebSocket(source);
    }

    // Start REST API polling
    for (const source of this.config.sources.filter(s => s.type === 'rest')) {
      this.startPolling(source);
    }

    logger.info('Price Feed Manager started');
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;

    // Close WebSocket connections
    for (const [name, ws] of this.websockets) {
      markUnused(name);
      ws.close();
    }
    this.websockets.clear();

    // Clear polling timers
    for (const timer of this.updateTimers.values()) {
      clearInterval(timer);
    }
    this.updateTimers.clear();

    await this.redis.disconnect();
    logger.info('Price Feed Manager stopped');
  }

  private async connectWebSocket(source: PriceSource): Promise<void> {
    try {
      const ws = new WebSocket(source.endpoint);

      ws.on('open', () => {
        logger.info(`WebSocket connected to ${source.name}`);
        
        // Subscribe to price updates
        const subscribeMessage = this.buildSubscribeMessage(source);
        ws.send(JSON.stringify(subscribeMessage));
      });

      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleWebSocketMessage(source, message).catch(error => {
            logger.error(`Error handling WebSocket message from ${source.name}:`, error);
          });
        } catch (error) {
          logger.error(`Error parsing WebSocket message from ${source.name}:`, error);
        }
      });

      ws.on('error', (error) => {
        logger.error(`WebSocket error from ${source.name}:`, error);
      });

      ws.on('close', () => {
        logger.warn(`WebSocket disconnected from ${source.name}`);
        
        // Reconnect if still running
        if (this.isRunning) {
          setTimeout(() => {
            this.connectWebSocket(source);
          }, this.config.websocketReconnectDelay);
        }
      });

      this.websockets.set(source.name, ws);
    } catch (error) {
      logger.error(`Failed to connect WebSocket to ${source.name}:`, error);
      
      // Retry connection
      if (this.isRunning) {
        setTimeout(() => {
          this.connectWebSocket(source);
        }, this.config.websocketReconnectDelay);
      }
    }
  }

  private buildSubscribeMessage(source: PriceSource): any {
    // Build source-specific subscription message
    // This would be customized based on the API requirements
    switch (source.name) {
      case 'binance':
        return {
          method: 'SUBSCRIBE',
          params: ['!ticker@arr'],
          id: 1,
        };
      case 'coinbase':
        return {
          type: 'subscribe',
          channels: ['ticker'],
          product_ids: ['ETH-USD', 'BTC-USD'], // Add more pairs
        };
      default:
        return { type: 'subscribe', channel: 'prices' };
    }
  }

  private async handleWebSocketMessage(source: PriceSource, message: any): Promise<void> {
    // Parse source-specific message format
    const priceUpdates = this.parseSourceMessage(source, message);
    
    for (const update of priceUpdates) {
      await this.updatePrice(update);
    }
  }

  private parseSourceMessage(source: PriceSource, message: any): PriceUpdate[] {
    // Parse different source formats
    // This would be customized based on each source's message format
    const updates: PriceUpdate[] = [];
    
    // Example parsing logic
    switch (source.name) {
      case 'binance':
        if (Array.isArray(message)) {
          for (const ticker of message) {
            updates.push({
              assetId: this.normalizeAssetId(ticker.s),
              chainId: 'bsc',
              prices: [{
                source: source.name,
                price: parseFloat(ticker.c),
                liquidity: parseFloat(ticker.v) * parseFloat(ticker.c),
                timestamp: Date.now(),
              }],
              aggregatedPrice: parseFloat(ticker.c),
              timestamp: Date.now(),
              confidence: 0.95,
            });
          }
        }
        break;
      // Add more source parsers
    }
    
    return updates;
  }

  private startPolling(source: PriceSource): void {
    // Initial fetch
    this.fetchPrices(source);

    // Set up polling interval
    const interval = setInterval(() => {
      if (this.isRunning) {
        this.fetchPrices(source);
      }
    }, source.rateLimit || this.config.updateInterval);

    this.updateTimers.set(source.name, interval);
  }

  private async fetchPrices(source: PriceSource): Promise<void> {
    try {
      const headers: any = {
        'Accept': 'application/json',
      };
      
      if (source.apiKey) {
        headers['Authorization'] = `Bearer ${source.apiKey}`;
      }

      const response = await axios.get(source.endpoint, { headers });
      const priceUpdates = this.parseRestResponse(source, response.data);
      
      for (const update of priceUpdates) {
        await this.updatePrice(update);
      }
    } catch (error) {
      logger.error(`Failed to fetch prices from ${source.name}:`, error);
    }
  }

  private parseRestResponse(source: PriceSource, data: any): PriceUpdate[] {
    // Parse REST API responses
    const updates: PriceUpdate[] = [];
    
    // Implementation would depend on source API format
    return updates;
  }

  private async updatePrice(update: PriceUpdate): Promise<void> {
    const key = `${update.chainId}:${update.assetId}`;
    const existingPrice = this.priceCache.get(key);

    // Validate price update
    if (existingPrice && this.isPriceDeviation(existingPrice.price, update.aggregatedPrice)) {
      logger.warn('Price deviation detected:', {
        asset: update.assetId,
        chain: update.chainId,
        oldPrice: existingPrice.price,
        newPrice: update.aggregatedPrice,
        deviation: Math.abs(existingPrice.price - update.aggregatedPrice) / existingPrice.price,
      });
    }

    // Update cache
    const assetPrice: AssetPrice = {
      assetId: update.assetId,
      chainId: update.chainId,
      price: update.aggregatedPrice,
      timestamp: update.timestamp,
      source: update.prices.map(p => p.source).join(','),
      liquidity: update.prices.reduce((sum, p) => sum + (p.liquidity || 0), 0),
      slippage: this.calculateSlippage(update),
    };

    this.priceCache.set(key, assetPrice);
    
    // Store in Redis
    await this.redis.set(key, JSON.stringify(assetPrice));
    await this.redis.expire(key, this.config.cacheExpiry);

    // Emit price update event
    this.emit('priceUpdate', assetPrice);
  }

  private isPriceDeviation(oldPrice: number, newPrice: number): boolean {
    const deviation = Math.abs(oldPrice - newPrice) / oldPrice;
    return deviation > this.config.priceValidationThreshold;
  }

  private calculateSlippage(update: PriceUpdate): number {
    // Calculate estimated slippage based on liquidity
    const totalLiquidity = update.prices.reduce((sum, p) => sum + (p.liquidity || 0), 0);
    
    if (totalLiquidity === 0) {
      return 0.1; // 10% default slippage for unknown liquidity
    }

    // Simple slippage model: inversely proportional to liquidity
    const baseSlippage = 1000000; // $1M base liquidity
    return Math.min(0.1, baseSlippage / totalLiquidity);
  }

  private normalizeAssetId(symbol: string): AssetID {
    // Normalize different symbol formats to consistent AssetID
    return symbol.toUpperCase().replace(/USDT|USD|BUSD/, '');
  }

  private async loadCachedPrices(): Promise<void> {
    try {
      // Since RedisManager doesn't have a keys() method, we'll skip loading cached prices
      // and rely on fresh price fetching. In production, you might want to implement
      // a keys() method on RedisManager or use a different approach.
      console.log('Skipping cached price loading - keys() method not available on RedisManager');
    } catch (error) {
      logger.error('Failed to load cached prices:', error);
    }
  }

  async getPrice(chainId: ChainID, assetId: AssetID): Promise<AssetPrice | null> {
    const key = `${chainId}:${assetId}`;
    return this.priceCache.get(key) || null;
  }

  async getPrices(chainId?: ChainID): Promise<AssetPrice[]> {
    const prices: AssetPrice[] = [];
    
    for (const [key, price] of this.priceCache) {
      if (!chainId || price.chainId === chainId) {
        prices.push(price);
      }
    }
    
    return prices;
  }

  async getMultiChainPrices(assetId: AssetID): Promise<AssetPrice[]> {
    const prices: AssetPrice[] = [];
    
    for (const [key, price] of this.priceCache) {
      if (price.assetId === assetId) {
        prices.push(price);
      }
    }
    
    return prices;
  }

  getPriceFeedStatus(): {
    activeSources: number;
    totalPrices: number;
    lastUpdate: number;
    websocketStatus: Record<string, boolean>;
  } {
    const websocketStatus: Record<string, boolean> = {};
    
    for (const [name, ws] of this.websockets) {
      websocketStatus[name] = ws.readyState === WebSocket.OPEN;
    }

    let lastUpdate = 0;
    for (const price of this.priceCache.values()) {
      if (price.timestamp > lastUpdate) {
        lastUpdate = price.timestamp;
      }
    }

    return {
      activeSources: this.websockets.size + this.updateTimers.size,
      totalPrices: this.priceCache.size,
      lastUpdate,
      websocketStatus,
    };
  }
}