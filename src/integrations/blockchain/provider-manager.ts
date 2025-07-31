/**
 * Blockchain Provider Manager
 * Manages multiple blockchain providers with failover, load balancing, and health monitoring
 */

import { EventEmitter } from 'events';
import Logger from '@/shared/logging/logger';
import { 
  BlockchainClient,
  BlockchainProvider,
  BlockchainNetwork,
  BlockchainConfig,
  ProviderManagerConfig,
  BlockchainResponse,
  TransactionRequest,
  TransactionResponse,
  BlockData,
  TokenBalance,
  PriceData,
  ProviderHealth
} from './types';
import { ConnectionPool } from './connection-pool';
import { InfuraClient } from './providers/infura-client';
import { AlchemyClient } from './providers/alchemy-client';
import { QuickNodeClient } from './providers/quicknode-client';

const logger = Logger.getLogger('blockchain-provider-manager');

interface ProviderStats {
  successCount: number;
  errorCount: number;
  totalRequests: number;
  averageLatency: number;
  lastUsed: Date;
  consecutiveErrors: number;
}

export class BlockchainProviderManager extends EventEmitter {
  private config: ProviderManagerConfig;
  private connectionPool: ConnectionPool;
  private providers: Map<string, BlockchainClient> = new Map();
  private providerStats: Map<string, ProviderStats> = new Map();
  private healthStatus: Map<string, ProviderHealth> = new Map();
  private healthCheckInterval?: NodeJS.Timeout;
  private lastProviderIndex = 0;

  constructor(config: ProviderManagerConfig) {
    super();
    this.config = config;
    this.connectionPool = new ConnectionPool(config.connectionPool);
    this.setupEventHandlers();
  }

  async initialize(): Promise<void> {
    try {
      logger.info('Initializing Blockchain Provider Manager...');

      // Initialize providers
      await this.initializeProviders();

      // Start health monitoring
      this.startHealthMonitoring();

      logger.info('Blockchain Provider Manager initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Blockchain Provider Manager:', error);
      throw error;
    }
  }

  private async initializeProviders(): Promise<void> {
    for (const providerConfig of this.config.providers) {
      try {
        const client = this.createClient(providerConfig);
        const key = this.getProviderKey(providerConfig.provider, providerConfig.network);
        
        this.providers.set(key, client);
        this.providerStats.set(key, {
          successCount: 0,
          errorCount: 0,
          totalRequests: 0,
          averageLatency: 0,
          lastUsed: new Date(),
          consecutiveErrors: 0
        });

        // Add client to connection pool
        await this.connectionPool.addClient(client);

        logger.info('Provider initialized', { 
          provider: providerConfig.provider, 
          network: providerConfig.network 
        });
      } catch (error) {
        logger.error('Failed to initialize provider', { 
          provider: providerConfig.provider, 
          network: providerConfig.network, 
          error 
        });
      }
    }
  }

  private createClient(config: BlockchainConfig): BlockchainClient {
    switch (config.provider) {
      case 'infura':
        return new InfuraClient(config);
      case 'alchemy':
        return new AlchemyClient(config);
      case 'quicknode':
        return new QuickNodeClient(config);
      default:
        throw new Error(`Unsupported provider: ${config.provider}`);
    }
  }

  private getProviderKey(provider: BlockchainProvider, network: BlockchainNetwork): string {
    return `${provider}:${network}`;
  }

  private async selectProvider(network: BlockchainNetwork): Promise<BlockchainClient | null> {
    const availableProviders = Array.from(this.providers.entries())
      .filter(([key, _]) => key.endsWith(`:${network}`))
      .filter(([key, _]) => this.isProviderHealthy(key));

    if (availableProviders.length === 0) {
      logger.warn('No healthy providers available', { network });
      return null;
    }

    let selectedProvider: [string, BlockchainClient];

    switch (this.config.loadBalancing.strategy) {
      case 'round-robin':
        selectedProvider = this.selectRoundRobin(availableProviders);
        break;
      case 'least-latency':
        selectedProvider = this.selectLeastLatency(availableProviders);
        break;
      case 'random':
        selectedProvider = this.selectRandom(availableProviders);
        break;
      default:
        selectedProvider = availableProviders[0];
    }

    return selectedProvider[1];
  }

  private selectRoundRobin(providers: [string, BlockchainClient][]): [string, BlockchainClient] {
    const index = this.lastProviderIndex % providers.length;
    this.lastProviderIndex++;
    return providers[index];
  }

  private selectLeastLatency(providers: [string, BlockchainClient][]): [string, BlockchainClient] {
    let bestProvider = providers[0];
    let lowestLatency = this.healthStatus.get(bestProvider[0])?.latency || Infinity;

    for (const provider of providers) {
      const latency = this.healthStatus.get(provider[0])?.latency || Infinity;
      if (latency < lowestLatency) {
        lowestLatency = latency;
        bestProvider = provider;
      }
    }

    return bestProvider;
  }

  private selectRandom(providers: [string, BlockchainClient][]): [string, BlockchainClient] {
    const randomIndex = Math.floor(Math.random() * providers.length);
    return providers[randomIndex];
  }

  private isProviderHealthy(providerKey: string): boolean {
    const health = this.healthStatus.get(providerKey);
    const stats = this.providerStats.get(providerKey);
    
    if (!health || !stats) return false;
    
    return health.isHealthy && stats.consecutiveErrors < this.config.failoverThreshold;
  }

  private async executeWithFallback<T>(
    network: BlockchainNetwork,
    operation: (client: BlockchainClient) => Promise<BlockchainResponse<T>>
  ): Promise<BlockchainResponse<T>> {
    const availableProviders = Array.from(this.providers.entries())
      .filter(([key, _]) => key.endsWith(`:${network}`))
      .sort(([keyA, _], [keyB, __]) => {
        const healthA = this.healthStatus.get(keyA);
        const healthB = this.healthStatus.get(keyB);
        const statsA = this.providerStats.get(keyA);
        const statsB = this.providerStats.get(keyB);
        
        // Prioritize healthy providers with low error counts
        const scoreA = (healthA?.isHealthy ? 1 : 0) - (statsA?.consecutiveErrors || 0) * 0.1;
        const scoreB = (healthB?.isHealthy ? 1 : 0) - (statsB?.consecutiveErrors || 0) * 0.1;
        
        return scoreB - scoreA;
      });

    let lastError: Error | null = null;

    for (const [providerKey, client] of availableProviders) {
      try {
        const startTime = Date.now();
        const result = await operation(client);
        const latency = Date.now() - startTime;

        // Update stats
        this.updateProviderStats(providerKey, true, latency);

        return result;
      } catch (error) {
        lastError = error as Error;
        logger.warn('Provider operation failed, trying next', { 
          provider: providerKey, 
          error: error instanceof Error ? error.message : error 
        });
        
        // Update stats
        this.updateProviderStats(providerKey, false, Date.now() - Date.now());
      }
    }

    // All providers failed
    const errorMessage = lastError?.message || 'All providers failed';
    return {
      success: false,
      error: errorMessage,
      metadata: {
        network,
        timestamp: Date.now()
      }
    };
  }

  private updateProviderStats(providerKey: string, success: boolean, latency: number): void {
    const stats = this.providerStats.get(providerKey);
    if (!stats) return;

    stats.totalRequests++;
    stats.lastUsed = new Date();
    stats.averageLatency = (stats.averageLatency + latency) / 2;

    if (success) {
      stats.successCount++;
      stats.consecutiveErrors = 0;
    } else {
      stats.errorCount++;
      stats.consecutiveErrors++;
    }

    this.providerStats.set(providerKey, stats);

    // Emit event if provider is failing
    if (stats.consecutiveErrors >= this.config.failoverThreshold) {
      this.emit('provider_failing', { 
        providerKey, 
        consecutiveErrors: stats.consecutiveErrors 
      });
    }
  }

  // Public API methods
  async getBlockNumber(network: BlockchainNetwork): Promise<BlockchainResponse<number>> {
    return this.executeWithFallback(network, (client) => client.getBlockNumber());
  }

  async getBlock(network: BlockchainNetwork, blockNumber: number | 'latest'): Promise<BlockchainResponse<BlockData>> {
    return this.executeWithFallback(network, (client) => client.getBlock(blockNumber));
  }

  async getTransaction(network: BlockchainNetwork, hash: string): Promise<BlockchainResponse<TransactionResponse>> {
    return this.executeWithFallback(network, (client) => client.getTransaction(hash));
  }

  async sendTransaction(network: BlockchainNetwork, tx: TransactionRequest): Promise<BlockchainResponse<string>> {
    return this.executeWithFallback(network, (client) => client.sendTransaction(tx));
  }

  async getBalance(network: BlockchainNetwork, address: string): Promise<BlockchainResponse<string>> {
    return this.executeWithFallback(network, (client) => client.getBalance(address));
  }

  async getTokenBalance(network: BlockchainNetwork, address: string, tokenAddress: string): Promise<BlockchainResponse<TokenBalance>> {
    return this.executeWithFallback(network, (client) => client.getTokenBalance(address, tokenAddress));
  }

  async getTokenPrice(network: BlockchainNetwork, tokenAddress: string): Promise<BlockchainResponse<PriceData>> {
    return this.executeWithFallback(network, (client) => client.getTokenPrice(tokenAddress));
  }

  async getGasPrice(network: BlockchainNetwork): Promise<BlockchainResponse<string>> {
    return this.executeWithFallback(network, (client) => client.getGasPrice());
  }

  async estimateGas(network: BlockchainNetwork, tx: TransactionRequest): Promise<BlockchainResponse<string>> {
    return this.executeWithFallback(network, (client) => client.estimateGas(tx));
  }

  // Management methods
  getProviderStats(): Record<string, ProviderStats> {
    const stats: Record<string, ProviderStats> = {};
    for (const [key, value] of this.providerStats) {
      stats[key] = { ...value };
    }
    return stats;
  }

  getHealthStatus(): Record<string, ProviderHealth> {
    const status: Record<string, ProviderHealth> = {};
    for (const [key, value] of this.healthStatus) {
      status[key] = { ...value };
    }
    return status;
  }

  getConnectionPoolStats(): Record<string, any> {
    return this.connectionPool.getStats();
  }

  private startHealthMonitoring(): void {
    this.healthCheckInterval = setInterval(async () => {
      await this.performHealthChecks();
    }, this.config.healthCheckInterval);
  }

  private async performHealthChecks(): Promise<void> {
    const promises: Promise<void>[] = [];

    for (const [providerKey, client] of this.providers) {
      promises.push(this.checkProviderHealth(providerKey, client));
    }

    await Promise.allSettled(promises);
  }

  private async checkProviderHealth(providerKey: string, client: BlockchainClient): Promise<void> {
    const startTime = Date.now();
    
    try {
      const isHealthy = await client.healthCheck();
      const latency = Date.now() - startTime;

      const currentHealth = this.healthStatus.get(providerKey) || {
        isHealthy: false,
        latency: 0,
        blockNumber: 0,
        lastChecked: new Date(),
        errorCount: 0
      };

      this.healthStatus.set(providerKey, {
        isHealthy,
        latency,
        blockNumber: currentHealth.blockNumber, // Would update with actual block number
        lastChecked: new Date(),
        errorCount: isHealthy ? 0 : currentHealth.errorCount + 1
      });

      if (!isHealthy) {
        logger.warn('Provider health check failed', { providerKey });
      }
    } catch (error) {
      const currentHealth = this.healthStatus.get(providerKey) || {
        isHealthy: false,
        latency: 0,
        blockNumber: 0,
        lastChecked: new Date(),
        errorCount: 0
      };

      this.healthStatus.set(providerKey, {
        ...currentHealth,
        isHealthy: false,
        latency: Date.now() - startTime,
        lastChecked: new Date(),
        errorCount: currentHealth.errorCount + 1
      });

      logger.error('Provider health check error', { providerKey, error });
    }
  }

  private setupEventHandlers(): void {
    this.connectionPool.on('connection_acquired', (event) => {
      this.emit('connection_acquired', event);
    });

    this.connectionPool.on('connection_released', (event) => {
      this.emit('connection_released', event);
    });

    this.connectionPool.on('connections_reaped', (event) => {
      this.emit('connections_reaped', event);
    });
  }

  async shutdown(): Promise<void> {
    logger.info('Shutting down Blockchain Provider Manager...');

    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    await this.connectionPool.shutdown();

    this.providers.clear();
    this.providerStats.clear();
    this.healthStatus.clear();

    logger.info('Blockchain Provider Manager shutdown complete');
  }
}