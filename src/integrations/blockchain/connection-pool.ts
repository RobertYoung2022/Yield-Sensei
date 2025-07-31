/**
 * Blockchain Connection Pool
 * Manages connection pooling and resource optimization for blockchain providers
 */

import { EventEmitter } from 'events';
import Logger from '@/shared/logging/logger';
import { 
  BlockchainClient,
  ConnectionPoolConfig,
  BlockchainProvider,
  BlockchainNetwork,
  ProviderHealth
} from './types';

const logger = Logger.getLogger('blockchain-connection-pool');

interface PooledConnection {
  client: BlockchainClient;
  isActive: boolean;
  lastUsed: Date;
  usageCount: number;
  health: ProviderHealth;
}

export class ConnectionPool extends EventEmitter {
  private connections: Map<string, PooledConnection[]> = new Map();
  private config: ConnectionPoolConfig;
  private healthCheckInterval?: NodeJS.Timeout;
  private reapInterval?: NodeJS.Timeout;

  constructor(config: ConnectionPoolConfig) {
    super();
    this.config = {
      maxConnections: 10,
      minConnections: 2,
      acquireTimeoutMs: 5000,
      idleTimeoutMs: 300000, // 5 minutes
      reapIntervalMs: 60000, // 1 minute
      ...config
    };

    this.startBackgroundTasks();
  }

  /**
   * Get connection key for provider/network combination
   */
  private getConnectionKey(provider: BlockchainProvider, network: BlockchainNetwork): string {
    return `${provider}:${network}`;
  }

  /**
   * Add a client to the pool
   */
  async addClient(client: BlockchainClient): Promise<void> {
    const key = this.getConnectionKey(client.provider, client.network);
    
    if (!this.connections.has(key)) {
      this.connections.set(key, []);
    }

    const pool = this.connections.get(key)!;
    
    if (pool.length >= this.config.maxConnections) {
      logger.warn('Connection pool full', { provider: client.provider, network: client.network });
      return;
    }

    const connection: PooledConnection = {
      client,
      isActive: false,
      lastUsed: new Date(),
      usageCount: 0,
      health: {
        isHealthy: true,
        latency: 0,
        blockNumber: 0,
        lastChecked: new Date(),
        errorCount: 0
      }
    };

    pool.push(connection);
    
    logger.debug('Added connection to pool', { 
      provider: client.provider, 
      network: client.network,
      poolSize: pool.length 
    });

    this.emit('connection_added', { provider: client.provider, network: client.network });
  }

  /**
   * Acquire a connection from the pool
   */
  async acquire(provider: BlockchainProvider, network: BlockchainNetwork): Promise<BlockchainClient | null> {
    const key = this.getConnectionKey(provider, network);
    const pool = this.connections.get(key);

    if (!pool || pool.length === 0) {
      logger.warn('No connections available in pool', { provider, network });
      return null;
    }

    // Find an available healthy connection
    const availableConnection = pool.find(conn => 
      !conn.isActive && 
      conn.health.isHealthy
    );

    if (!availableConnection) {
      logger.warn('No available healthy connections', { provider, network });
      return null;
    }

    // Mark as active and update usage
    availableConnection.isActive = true;
    availableConnection.lastUsed = new Date();
    availableConnection.usageCount++;

    logger.debug('Connection acquired', { 
      provider, 
      network, 
      usageCount: availableConnection.usageCount 
    });

    this.emit('connection_acquired', { provider, network });

    return availableConnection.client;
  }

  /**
   * Release a connection back to the pool
   */
  async release(client: BlockchainClient): Promise<void> {
    const key = this.getConnectionKey(client.provider, client.network);
    const pool = this.connections.get(key);

    if (!pool) {
      logger.warn('Pool not found for connection release', { 
        provider: client.provider, 
        network: client.network 
      });
      return;
    }

    const connection = pool.find(conn => conn.client === client);
    
    if (connection) {
      connection.isActive = false;
      connection.lastUsed = new Date();
      
      logger.debug('Connection released', { 
        provider: client.provider, 
        network: client.network 
      });

      this.emit('connection_released', { 
        provider: client.provider, 
        network: client.network 
      });
    }
  }

  /**
   * Get pool statistics
   */
  getStats(): Record<string, any> {
    const stats: Record<string, any> = {};

    for (const [key, pool] of this.connections) {
      const active = pool.filter(conn => conn.isActive).length;
      const healthy = pool.filter(conn => conn.health.isHealthy).length;
      const totalUsage = pool.reduce((sum, conn) => sum + conn.usageCount, 0);

      stats[key] = {
        total: pool.length,
        active,
        available: pool.length - active,
        healthy,
        unhealthy: pool.length - healthy,
        totalUsage,
        averageUsage: pool.length > 0 ? totalUsage / pool.length : 0
      };
    }

    return stats;
  }

  /**
   * Get health status of all connections
   */
  getHealthStatus(): Record<string, ProviderHealth[]> {
    const status: Record<string, ProviderHealth[]> = {};

    for (const [key, pool] of this.connections) {
      status[key] = pool.map(conn => ({ ...conn.health }));
    }

    return status;
  }

  /**
   * Remove unhealthy connections from the pool
   */
  private async reapConnections(): Promise<void> {
    let removedCount = 0;

    for (const [key, pool] of this.connections) {
      const now = new Date();
      const [provider, network] = key.split(':') as [BlockchainProvider, BlockchainNetwork];

      // Remove connections that are idle too long or unhealthy
      const toRemove = pool.filter(conn => {
        const idleTime = now.getTime() - conn.lastUsed.getTime();
        const isIdle = idleTime > this.config.idleTimeoutMs;
        const isUnhealthy = !conn.health.isHealthy && conn.health.errorCount > 5;
        
        return !conn.isActive && (isIdle || isUnhealthy);
      });

      // Keep minimum connections
      const toKeep = pool.length - toRemove.length;
      if (toKeep < this.config.minConnections) {
        const keepCount = this.config.minConnections - toKeep;
        toRemove.splice(0, Math.min(keepCount, toRemove.length));
      }

      // Remove connections
      for (const conn of toRemove) {
        const index = pool.indexOf(conn);
        if (index > -1) {
          pool.splice(index, 1);
          removedCount++;
          
          logger.debug('Reaped connection', { provider, network });
        }
      }
    }

    if (removedCount > 0) {
      logger.info('Connection reaping completed', { removedCount });
      this.emit('connections_reaped', { count: removedCount });
    }
  }

  /**
   * Perform health checks on all connections
   */
  private async performHealthChecks(): Promise<void> {
    const promises: Promise<void>[] = [];

    for (const [key, pool] of this.connections) {
      for (const connection of pool) {
        if (!connection.isActive) {
          promises.push(this.checkConnectionHealth(connection));
        }
      }
    }

    await Promise.allSettled(promises);
  }

  /**
   * Check health of individual connection
   */
  private async checkConnectionHealth(connection: PooledConnection): Promise<void> {
    const startTime = Date.now();
    
    try {
      const isHealthy = await connection.client.healthCheck();
      const latency = Date.now() - startTime;

      connection.health = {
        ...connection.health,
        isHealthy,
        latency,
        lastChecked: new Date(),
        errorCount: isHealthy ? 0 : connection.health.errorCount + 1
      };

      if (isHealthy) {
        // Try to get latest block number
        try {
          const blockResponse = await connection.client.getBlockNumber();
          if (blockResponse.success && blockResponse.data) {
            connection.health.blockNumber = blockResponse.data;
          }
        } catch (error) {
          // Non-critical error, don't mark as unhealthy
          logger.debug('Failed to get block number during health check', { 
            provider: connection.client.provider,
            network: connection.client.network,
            error
          });
        }
      }

    } catch (error) {
      connection.health = {
        ...connection.health,
        isHealthy: false,
        latency: Date.now() - startTime,
        lastChecked: new Date(),
        errorCount: connection.health.errorCount + 1
      };

      logger.warn('Connection health check failed', {
        provider: connection.client.provider,
        network: connection.client.network,
        error: error instanceof Error ? error.message : error
      });
    }
  }

  /**
   * Start background maintenance tasks
   */
  private startBackgroundTasks(): void {
    // Health check interval
    this.healthCheckInterval = setInterval(() => {
      this.performHealthChecks().catch(error => {
        logger.error('Health check failed', { error });
      });
    }, 30000); // Every 30 seconds

    // Connection reaping interval
    this.reapInterval = setInterval(() => {
      this.reapConnections().catch(error => {
        logger.error('Connection reaping failed', { error });
      });
    }, this.config.reapIntervalMs);
  }

  /**
   * Shutdown the connection pool
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down connection pool...');

    // Clear intervals
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    if (this.reapInterval) {
      clearInterval(this.reapInterval);
    }

    // Clear all connections
    this.connections.clear();

    logger.info('Connection pool shutdown complete');
  }
}