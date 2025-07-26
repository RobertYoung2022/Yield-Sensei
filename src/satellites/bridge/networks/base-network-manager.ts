/**
 * Base Network Manager
 * Abstract base class for network-specific implementations
 */

import { EventEmitter } from 'events';
import Logger from '../../../shared/logging/logger';
import {
  NetworkConfig,
  NetworkConnection,
  TransactionRequest,
  TransactionReceipt,
  NetworkStats,
  NetworkHealth,
  GasEstimate,
  BlockInfo,
  NetworkEvent,
  NetworkType,
  NetworkID,
  TransactionHash,
  Address,
} from './types';

const logger = Logger.getLogger('base-network-manager');

export abstract class BaseNetworkManager extends EventEmitter {
  protected config: NetworkConfig;
  protected connection: NetworkConnection;
  protected isInitialized = false;
  protected isRunning = false;
  protected connectionAttempts = 0;
  protected lastHealthCheck = 0;
  protected stats: NetworkStats;
  protected health: NetworkHealth;

  constructor(config: NetworkConfig) {
    super();
    this.config = config;
    
    this.connection = {
      networkId: config.id,
      config,
      isConnected: false,
      currentBlock: 0,
      lastUpdate: 0,
      latency: 0,
      failoverIndex: 0,
      connectionAttempts: 0,
      lastConnectionAttempt: 0,
      healthScore: 0,
    };

    this.stats = {
      networkId: config.id,
      totalTransactions: 0,
      successfulTransactions: 0,
      failedTransactions: 0,
      averageBlockTime: config.blockTime,
      averageGasPrice: '0',
      currentBlockHeight: 0,
      networkLatency: 0,
      uptimePercentage: 100,
      lastSyncTime: Date.now(),
    };

    this.health = {
      networkId: config.id,
      isHealthy: false,
      healthScore: 0,
      issues: [],
      lastHealthCheck: 0,
      syncStatus: {
        isSyncing: false,
        currentBlock: 0,
        highestBlock: 0,
        syncPercentage: 100,
      },
      connectionStatus: {
        activeConnections: 0,
        totalEndpoints: config.rpcUrls.length,
        failedEndpoints: [],
      },
    };
  }

  // Abstract methods that must be implemented by network-specific managers

  abstract initialize(): Promise<void>;
  abstract start(): Promise<void>;
  abstract stop(): Promise<void>;
  abstract connect(): Promise<boolean>;
  abstract disconnect(): Promise<void>;
  abstract getCurrentBlock(): Promise<number>;
  abstract getBlockInfo(blockNumber?: number): Promise<BlockInfo | null>;
  abstract sendTransaction(tx: TransactionRequest): Promise<TransactionHash>;
  abstract getTransactionReceipt(hash: TransactionHash): Promise<TransactionReceipt | null>;
  abstract estimateGas(tx: TransactionRequest): Promise<GasEstimate>;
  abstract getBalance(address: Address): Promise<string>;
  abstract isValidAddress(address: string): boolean;

  // Common implementation methods

  getNetworkId(): NetworkID {
    return this.config.id;
  }

  getNetworkType(): NetworkType {
    return this.config.type;
  }

  getConfig(): NetworkConfig {
    return { ...this.config };
  }

  getConnection(): NetworkConnection {
    return { ...this.connection };
  }

  getStats(): NetworkStats {
    return { ...this.stats };
  }

  getHealth(): NetworkHealth {
    return { ...this.health };
  }

  isConnected(): boolean {
    return this.connection.isConnected;
  }

  isHealthy(): boolean {
    return this.health.isHealthy && this.health.healthScore >= 70;
  }

  async performHealthCheck(): Promise<void> {
    const startTime = Date.now();
    
    try {
      // Test basic connectivity
      const currentBlock = await this.getCurrentBlock();
      const latency = Date.now() - startTime;
      
      // Update connection info
      this.connection.currentBlock = currentBlock;
      this.connection.latency = latency;
      this.connection.lastUpdate = Date.now();
      
      // Calculate health score
      const healthScore = this.calculateHealthScore(latency, currentBlock);
      
      // Update health status
      this.health.healthScore = healthScore;
      this.health.isHealthy = healthScore >= 70;
      this.health.lastHealthCheck = Date.now();
      this.health.syncStatus.currentBlock = currentBlock;
      this.health.connectionStatus.activeConnections = this.connection.isConnected ? 1 : 0;
      
      // Clear issues if healthy
      if (this.health.isHealthy) {
        this.health.issues = this.health.issues.filter(issue => 
          issue.type === 'connectivity' && Date.now() - issue.timestamp < 300000 // Keep recent connectivity issues
        );
      }
      
      this.stats.networkLatency = latency;
      this.stats.currentBlockHeight = currentBlock;
      this.stats.lastSyncTime = Date.now();
      
      logger.debug(`Health check completed for ${this.config.name}`, {
        healthScore,
        latency,
        currentBlock,
        isHealthy: this.health.isHealthy,
      });
      
    } catch (error) {
      logger.error(`Health check failed for ${this.config.name}:`, error);
      
      this.health.healthScore = 0;
      this.health.isHealthy = false;
      this.health.issues.push({
        type: 'connectivity',
        severity: 'high',
        message: `Health check failed: ${String(error)}`,
        timestamp: Date.now(),
        acknowledged: false,
      });
      
      this.connection.isConnected = false;
      this.health.connectionStatus.activeConnections = 0;
    }
  }

  protected calculateHealthScore(latency: number, currentBlock: number): number {
    let score = 100;
    
    // Penalize high latency
    if (latency > 5000) score -= 40; // > 5s
    else if (latency > 2000) score -= 20; // > 2s
    else if (latency > 1000) score -= 10; // > 1s
    
    // Penalize stale blocks
    const expectedBlockTime = this.config.blockTime * 1000; // Convert to ms
    const timeSinceLastUpdate = Date.now() - this.connection.lastUpdate;
    const staleness = timeSinceLastUpdate / expectedBlockTime;
    
    if (staleness > 5) score -= 30; // Very stale
    else if (staleness > 3) score -= 15; // Somewhat stale
    else if (staleness > 2) score -= 5; // Slightly stale
    
    // Penalize connection failures
    if (this.connection.connectionAttempts > 5) {
      score -= Math.min(30, this.connection.connectionAttempts * 3);
    }
    
    return Math.max(0, Math.min(100, score));
  }

  protected async attemptConnection(): Promise<boolean> {
    const maxAttempts = Math.min(this.config.rpcUrls.length, 3);
    
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const rpcIndex = (this.connection.failoverIndex + attempt) % this.config.rpcUrls.length;
      
      try {
        logger.info(`Attempting connection to ${this.config.name} (attempt ${attempt + 1}/${maxAttempts})`, {
          endpoint: this.config.rpcUrls[rpcIndex],
        });
        
        const success = await this.connectToEndpoint(this.config.rpcUrls[rpcIndex]);
        
        if (success) {
          this.connection.failoverIndex = rpcIndex;
          this.connection.isConnected = true;
          this.connection.connectionAttempts = 0;
          
          logger.info(`Successfully connected to ${this.config.name}`, {
            endpoint: this.config.rpcUrls[rpcIndex],
          });
          
          return true;
        }
        
      } catch (error) {
        logger.error(`Connection attempt ${attempt + 1} failed for ${this.config.name}:`, error);
        
        this.health.connectionStatus.failedEndpoints.push(this.config.rpcUrls[rpcIndex]);
      }
    }
    
    this.connection.connectionAttempts++;
    this.connection.lastConnectionAttempt = Date.now();
    this.connection.isConnected = false;
    
    return false;
  }

  protected abstract connectToEndpoint(endpoint: string): Promise<boolean>;

  protected emitEvent(event: NetworkEvent): void {
    this.emit('networkEvent', event);
    this.emit(event.type, event);
  }

  protected updateStats(update: Partial<NetworkStats>): void {
    Object.assign(this.stats, update);
  }

  protected addHealthIssue(
    type: NetworkHealth['issues'][0]['type'],
    severity: NetworkHealth['issues'][0]['severity'],
    message: string
  ): void {
    this.health.issues.push({
      type,
      severity,
      message,
      timestamp: Date.now(),
      acknowledged: false,
    });

    // Limit issues to last 50
    if (this.health.issues.length > 50) {
      this.health.issues = this.health.issues.slice(-50);
    }
  }

  async waitForTransaction(
    hash: TransactionHash,
    confirmations: number = this.config.confirmationBlocks,
    timeout: number = 300000 // 5 minutes
  ): Promise<TransactionReceipt | null> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      try {
        const receipt = await this.getTransactionReceipt(hash);
        
        if (receipt && receipt.status !== 'pending') {
          if (receipt.confirmations >= confirmations) {
            return receipt;
          }
        }
        
        // Wait for next block
        await new Promise(resolve => setTimeout(resolve, this.config.blockTime * 1000));
        
      } catch (error) {
        logger.error(`Error waiting for transaction ${hash}:`, error);
        await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5s before retry
      }
    }
    
    throw new Error(`Transaction ${hash} timed out after ${timeout}ms`);
  }

  async reconnect(): Promise<boolean> {
    logger.info(`Attempting to reconnect to ${this.config.name}...`);
    
    await this.disconnect();
    
    const success = await this.attemptConnection();
    
    if (success) {
      this.emitEvent({
        networkId: this.config.id,
        type: 'connection',
        timestamp: Date.now(),
        data: {
          status: 'connected',
          endpoint: this.config.rpcUrls[this.connection.failoverIndex],
          latency: this.connection.latency,
        },
      });
    }
    
    return success;
  }

  // Configuration update methods
  updateConfig(newConfig: Partial<NetworkConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.connection.config = this.config;
    
    logger.info(`Configuration updated for ${this.config.name}`);
  }

  // Statistics methods
  incrementTransactionCount(success: boolean): void {
    this.stats.totalTransactions++;
    if (success) {
      this.stats.successfulTransactions++;
    } else {
      this.stats.failedTransactions++;
    }
  }

  getSuccessRate(): number {
    if (this.stats.totalTransactions === 0) return 0;
    return this.stats.successfulTransactions / this.stats.totalTransactions;
  }

  // Utility methods
  protected sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  protected isConnectionStale(): boolean {
    const staleness = Date.now() - this.connection.lastUpdate;
    const maxStaleness = this.config.blockTime * 5 * 1000; // 5 blocks worth of time
    return staleness > maxStaleness;
  }
}