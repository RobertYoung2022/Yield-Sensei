/**
 * DefiLlama API Client
 * Provides integration with DefiLlama's DeFi protocol and yield farming data
 */

import axios, { AxiosInstance } from 'axios';
import { EventEmitter } from 'events';
import Logger from '@/shared/logging/logger';
import {
  DataProviderClient,
  DataProviderConfig,
  DataResponse,
  ProtocolData,
  YieldData,
  RateLimitStatus,
  DataProviderError,
  CacheEntry
} from './types';

const logger = Logger.getLogger('defillama-client');

interface DefiLlamaProtocol {
  id: string;
  name: string;
  address?: string;
  symbol: string;
  url: string;
  description: string;
  chain: string;
  logo: string;
  audits: string;
  audit_note?: string;
  gecko_id?: string;
  cmcId?: string;
  category: string;
  chains: string[];
  module: string;
  twitter?: string;
  forkedFrom?: string[];
  oracles?: string[];
  listedAt?: number;
  methodology?: string;
  slug: string;
  tvl: number;
  chainTvls: Record<string, number>;
  change_1h?: number;
  change_1d?: number;
  change_7d?: number;
  tokenBreakdowns?: Record<string, number>;
  mcap?: number;
  parentProtocol?: string;
}

interface DefiLlamaTVLData {
  date: string;
  totalLiquidityUSD: number;
}

interface DefiLlamaYieldPool {
  chain: string;
  project: string;
  symbol: string;
  tvlUsd: number;
  apy: number;
  apyBase?: number;
  apyReward?: number;
  rewardTokens?: string[];
  underlyingTokens?: string[];
  poolMeta?: string;
  url?: string;
  apyPct1D?: number;
  apyPct7D?: number;
  apyPct30D?: number;
  stablecoin?: boolean;
  ilRisk?: string;
  exposure?: string;
  predictions?: {
    predictedClass: string;
    predictedProbability: number;
    binnedConfidence: number;
  };
  poolId: string;
  apyBase7d?: number;
  apyMean30d?: number;
  volumeUsd1d?: number;
  volumeUsd7d?: number;
  apyBaseInception?: number;
  category?: string;
}

interface DefiLlamaChain {
  gecko_id?: string;
  tvl: number;
  tokenSymbol?: string;
  cmcId?: string;
  name: string;
  chainId?: number;
}

export class DefiLlamaClient extends EventEmitter implements DataProviderClient {
  public readonly provider = 'defillama' as const;
  public readonly config: DataProviderConfig;
  
  private client: AxiosInstance;
  private rateLimitStatus: RateLimitStatus;
  private cache: Map<string, CacheEntry<any>> = new Map();
  private isInitialized = false;

  constructor(config: DataProviderConfig) {
    super();
    this.config = {
      baseUrl: 'https://api.llama.fi',
      rateLimitRpm: 300, // Conservative estimate for public API
      timeout: 15000,
      retries: 3,
      enableCaching: true,
      cacheTTL: 300000, // 5 minutes default for DeFi data
      ...config
    };

    this.client = axios.create({
      baseURL: this.config.baseUrl,
      timeout: this.config.timeout,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'YieldSensei/1.0.0'
      }
    });

    this.rateLimitStatus = {
      remaining: this.config.rateLimitRpm || 300,
      reset: new Date(Date.now() + 60000),
      limit: this.config.rateLimitRpm || 300,
      resetInSeconds: 60
    };

    this.setupInterceptors();
  }

  async initialize(): Promise<void> {
    try {
      logger.info('Initializing DefiLlama client...');
      
      // Test API with a simple request
      const response = await this.client.get('/protocols');
      if (!Array.isArray(response.data)) {
        throw new Error('Invalid API response from DefiLlama');
      }

      this.isInitialized = true;
      logger.info('DefiLlama client initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize DefiLlama client:', error);
      throw error;
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.client.get('/protocols');
      return Array.isArray(response.data) && response.data.length > 0;
    } catch (error) {
      logger.warn('DefiLlama health check failed:', error);
      return false;
    }
  }

  async getRateLimitStatus(): Promise<RateLimitStatus> {
    return this.rateLimitStatus;
  }

  async getProtocols(): Promise<DataResponse<ProtocolData[]>> {
    try {
      const cacheKey = 'protocols';
      const cached = this.getFromCache<ProtocolData[]>(cacheKey);
      if (cached) {
        return {
          success: true,
          data: cached,
          metadata: {
            provider: this.provider,
            timestamp: Date.now(),
            cached: true
          }
        };
      }

      const response = await this.client.get('/protocols');
      const protocols: DefiLlamaProtocol[] = response.data;

      // Transform to our ProtocolData format
      const transformedProtocols: ProtocolData[] = protocols.map(protocol => ({
        id: protocol.id,
        name: protocol.name,
        symbol: protocol.symbol,
        slug: protocol.slug,
        tvl: protocol.tvl,
        tvlPrevDay: protocol.change_1d ? protocol.tvl / (1 + protocol.change_1d / 100) : undefined,
        tvlPrevWeek: protocol.change_7d ? protocol.tvl / (1 + protocol.change_7d / 100) : undefined,
        chains: protocol.chains,
        category: protocol.category,
        logo: protocol.logo,
        url: protocol.url,
        description: protocol.description,
        twitter: protocol.twitter,
        forkedFrom: protocol.forkedFrom,
        gecko_id: protocol.gecko_id,
        cmcId: protocol.cmcId,
        audit: protocol.audits ? [{ 
          date: new Date().toISOString(), 
          name: 'Various', 
          link: protocol.audits 
        }] : undefined,
        methodology: protocol.methodology,
        parentProtocol: protocol.parentProtocol,
        module: protocol.module
      }));

      this.setCache(cacheKey, transformedProtocols, this.config.cacheTTL || 300000);

      return {
        success: true,
        data: transformedProtocols,
        metadata: {
          provider: this.provider,
          timestamp: Date.now(),
          rateLimitRemaining: this.rateLimitStatus.remaining
        }
      };
    } catch (error) {
      return this.handleError('getProtocols', error);
    }
  }

  async getProtocol(slug: string): Promise<DataResponse<ProtocolData>> {
    try {
      const cacheKey = `protocol:${slug}`;
      const cached = this.getFromCache<ProtocolData>(cacheKey);
      if (cached) {
        return {
          success: true,
          data: cached,
          metadata: {
            provider: this.provider,
            timestamp: Date.now(),
            cached: true
          }
        };
      }

      const response = await this.client.get(`/protocol/${slug}`);
      const protocol: DefiLlamaProtocol = response.data;

      const transformedProtocol: ProtocolData = {
        id: protocol.id,
        name: protocol.name,
        symbol: protocol.symbol,
        slug: protocol.slug,
        tvl: protocol.tvl,
        tvlPrevDay: protocol.change_1d ? protocol.tvl / (1 + protocol.change_1d / 100) : undefined,
        tvlPrevWeek: protocol.change_7d ? protocol.tvl / (1 + protocol.change_7d / 100) : undefined,
        chains: protocol.chains,
        category: protocol.category,
        logo: protocol.logo,
        url: protocol.url,
        description: protocol.description,
        twitter: protocol.twitter,
        forkedFrom: protocol.forkedFrom,
        gecko_id: protocol.gecko_id,
        cmcId: protocol.cmcId,
        audit: protocol.audits ? [{ 
          date: new Date().toISOString(), 
          name: 'Various', 
          link: protocol.audits 
        }] : undefined,
        methodology: protocol.methodology,
        parentProtocol: protocol.parentProtocol,
        module: protocol.module
      };

      this.setCache(cacheKey, transformedProtocol, this.config.cacheTTL || 300000);

      return {
        success: true,
        data: transformedProtocol,
        metadata: {
          provider: this.provider,
          timestamp: Date.now(),
          rateLimitRemaining: this.rateLimitStatus.remaining
        }
      };
    } catch (error) {
      return this.handleError('getProtocol', error);
    }
  }

  async getProtocolTVL(slug: string): Promise<DataResponse<DefiLlamaTVLData[]>> {
    try {
      const cacheKey = `tvl:${slug}`;
      const cached = this.getFromCache<DefiLlamaTVLData[]>(cacheKey);
      if (cached) {
        return {
          success: true,
          data: cached,
          metadata: {
            provider: this.provider,
            timestamp: Date.now(),
            cached: true
          }
        };
      }

      const response = await this.client.get(`/tvl/${slug}`);
      const tvlData: DefiLlamaTVLData[] = response.data;

      this.setCache(cacheKey, tvlData, this.config.cacheTTL || 600000); // Cache for 10 minutes

      return {
        success: true,
        data: tvlData,
        metadata: {
          provider: this.provider,
          timestamp: Date.now(),
          rateLimitRemaining: this.rateLimitStatus.remaining
        }
      };
    } catch (error) {
      return this.handleError('getProtocolTVL', error);
    }
  }

  async getYieldPools(): Promise<DataResponse<YieldData[]>> {
    try {
      const cacheKey = 'yield_pools';
      const cached = this.getFromCache<YieldData[]>(cacheKey);
      if (cached) {
        return {
          success: true,
          data: cached,
          metadata: {
            provider: this.provider,
            timestamp: Date.now(),
            cached: true
          }
        };
      }

      const response = await this.client.get('/yields');
      const pools: DefiLlamaYieldPool[] = response.data.data || [];

      // Transform to our YieldData format
      const transformedPools: YieldData[] = pools.map(pool => ({
        pool: pool.poolId,
        chain: pool.chain,
        project: pool.project,
        symbol: pool.symbol,
        tvlUsd: pool.tvlUsd,
        apy: pool.apy,
        apyBase: pool.apyBase,
        apyReward: pool.apyReward,
        rewardTokens: pool.rewardTokens,
        il7d: pool.apyPct7D,
        apyBase7d: pool.apyBase7d,
        apyMean30d: pool.apyMean30d,
        volumeUsd1d: pool.volumeUsd1d,
        volumeUsd7d: pool.volumeUsd7d,
        apyBaseInception: pool.apyBaseInception,
        underlyingTokens: pool.underlyingTokens,
        poolMeta: pool.poolMeta,
        url: pool.url,
        category: pool.category,
        exposure: pool.exposure,
        predictions: pool.predictions
      }));

      this.setCache(cacheKey, transformedPools, this.config.cacheTTL || 300000);

      return {
        success: true,
        data: transformedPools,
        metadata: {
          provider: this.provider,
          timestamp: Date.now(),
          rateLimitRemaining: this.rateLimitStatus.remaining
        }
      };
    } catch (error) {
      return this.handleError('getYieldPools', error);
    }
  }

  async getTopProtocolsByTVL(limit: number = 50): Promise<DataResponse<ProtocolData[]>> {
    try {
      const protocols = await this.getProtocols();
      if (!protocols.success || !protocols.data) {
        return protocols;
      }

      const topProtocols = protocols.data
        .sort((a, b) => b.tvl - a.tvl)
        .slice(0, limit);

      return {
        success: true,
        data: topProtocols,
        metadata: {
          provider: this.provider,
          timestamp: Date.now(),
          rateLimitRemaining: this.rateLimitStatus.remaining
        }
      };
    } catch (error) {
      return this.handleError('getTopProtocolsByTVL', error);
    }
  }

  async getChains(): Promise<DataResponse<DefiLlamaChain[]>> {
    try {
      const cacheKey = 'chains';
      const cached = this.getFromCache<DefiLlamaChain[]>(cacheKey);
      if (cached) {
        return {
          success: true,
          data: cached,
          metadata: {
            provider: this.provider,
            timestamp: Date.now(),
            cached: true
          }
        };
      }

      const response = await this.client.get('/chains');
      const chains: DefiLlamaChain[] = response.data;

      this.setCache(cacheKey, chains, this.config.cacheTTL || 3600000); // Cache for 1 hour

      return {
        success: true,
        data: chains,
        metadata: {
          provider: this.provider,
          timestamp: Date.now(),
          rateLimitRemaining: this.rateLimitStatus.remaining
        }
      };
    } catch (error) {
      return this.handleError('getChains', error);
    }
  }

  async getProtocolsByChain(chain: string): Promise<DataResponse<ProtocolData[]>> {
    try {
      const cacheKey = `protocols_chain:${chain}`;
      const cached = this.getFromCache<ProtocolData[]>(cacheKey);
      if (cached) {
        return {
          success: true,
          data: cached,
          metadata: {
            provider: this.provider,
            timestamp: Date.now(),
            cached: true
          }
        };
      }

      const allProtocols = await this.getProtocols();
      if (!allProtocols.success || !allProtocols.data) {
        return allProtocols;
      }

      const chainProtocols = allProtocols.data.filter(protocol => 
        protocol.chains.includes(chain)
      );

      this.setCache(cacheKey, chainProtocols, this.config.cacheTTL || 300000);

      return {
        success: true,
        data: chainProtocols,
        metadata: {
          provider: this.provider,
          timestamp: Date.now(),
          rateLimitRemaining: this.rateLimitStatus.remaining
        }
      };
    } catch (error) {
      return this.handleError('getProtocolsByChain', error);
    }
  }

  async getYieldPoolsByProject(project: string): Promise<DataResponse<YieldData[]>> {
    try {
      const allPools = await this.getYieldPools();
      if (!allPools.success || !allPools.data) {
        return allPools;
      }

      const projectPools = allPools.data.filter(pool => 
        pool.project.toLowerCase() === project.toLowerCase()
      );

      return {
        success: true,
        data: projectPools,
        metadata: {
          provider: this.provider,
          timestamp: Date.now(),
          rateLimitRemaining: this.rateLimitStatus.remaining
        }
      };
    } catch (error) {
      return this.handleError('getYieldPoolsByProject', error);
    }
  }

  async getTotalValueLocked(): Promise<DataResponse<{ date: string; totalLiquidityUSD: number }[]>> {
    try {
      const cacheKey = 'total_tvl';
      const cached = this.getFromCache<{ date: string; totalLiquidityUSD: number }[]>(cacheKey);
      if (cached) {
        return {
          success: true,
          data: cached,
          metadata: {
            provider: this.provider,
            timestamp: Date.now(),
            cached: true
          }
        };
      }

      const response = await this.client.get('/v2/historicalChainTvl');
      const tvlData = response.data;

      this.setCache(cacheKey, tvlData, this.config.cacheTTL || 600000); // Cache for 10 minutes

      return {
        success: true,
        data: tvlData,
        metadata: {
          provider: this.provider,
          timestamp: Date.now(),
          rateLimitRemaining: this.rateLimitStatus.remaining
        }
      };
    } catch (error) {
      return this.handleError('getTotalValueLocked', error);
    }
  }

  private getFromCache<T>(key: string): T | null {
    if (!this.config.enableCaching) {
      return null;
    }

    const entry = this.cache.get(key);
    if (!entry) {
      return null;
    }

    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  private setCache<T>(key: string, data: T, ttl: number): void {
    if (!this.config.enableCaching) {
      return;
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });

    // Clean up old entries periodically
    if (this.cache.size > 500) {
      const now = Date.now();
      for (const [k, entry] of this.cache.entries()) {
        if (now - entry.timestamp > entry.ttl) {
          this.cache.delete(k);
        }
      }
    }
  }

  private handleError(operation: string, error: any): DataResponse<any> {
    logger.error(`DefiLlama ${operation} failed:`, error);

    const dataError: DataProviderError = new Error(
      error?.response?.data?.message || error?.message || 'Unknown DefiLlama API error'
    ) as DataProviderError;

    dataError.provider = this.provider;
    dataError.code = error?.response?.status?.toString() || error?.code;
    dataError.rateLimited = error?.response?.status === 429;
    dataError.retryable = error?.response?.status >= 500 || error?.response?.status === 429;

    if (dataError.rateLimited) {
      dataError.retryAfter = 60; // Conservative estimate
    }

    return {
      success: false,
      error: dataError.message,
      metadata: {
        provider: this.provider,
        timestamp: Date.now()
      }
    };
  }

  private setupInterceptors(): void {
    // Request interceptor
    this.client.interceptors.request.use(
      (config) => {
        logger.debug('DefiLlama API request', {
          method: config.method,
          url: config.url,
          params: config.params
        });
        return config;
      },
      (error) => {
        logger.error('DefiLlama API request error:', error);
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response) => {
        // Update rate limit status (conservative estimation)
        this.rateLimitStatus.remaining = Math.max(0, this.rateLimitStatus.remaining - 1);
        
        if (this.rateLimitStatus.remaining === 0) {
          this.rateLimitStatus = {
            remaining: this.config.rateLimitRpm || 300,
            reset: new Date(Date.now() + 60000),
            limit: this.config.rateLimitRpm || 300,
            resetInSeconds: 60
          };
        }

        logger.debug('DefiLlama API response', {
          status: response.status,
          dataLength: Array.isArray(response.data) ? response.data.length : 'N/A'
        });
        return response;
      },
      (error) => {
        logger.error('DefiLlama API response error:', {
          status: error.response?.status,
          message: error.response?.data?.message || error.message
        });
        return Promise.reject(error);
      }
    );
  }
}