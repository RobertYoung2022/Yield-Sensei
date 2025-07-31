/**
 * Blockchain Integration Module
 * Unified exports for blockchain provider integrations
 */

// Core types
export * from './types';

// Connection pooling
export { ConnectionPool } from './connection-pool';

// Provider implementations
export { InfuraClient } from './providers/infura-client';
export { AlchemyClient } from './providers/alchemy-client';
export { QuickNodeClient } from './providers/quicknode-client';

// Provider management
export { BlockchainProviderManager } from './provider-manager';

// Utility functions
export const createBlockchainClient = (config: import('./types').BlockchainConfig): import('./types').BlockchainClient => {
  switch (config.provider) {
    case 'infura':
      const { InfuraClient } = require('./providers/infura-client');
      return new InfuraClient(config);
    case 'alchemy':
      const { AlchemyClient } = require('./providers/alchemy-client');
      return new AlchemyClient(config);
    case 'quicknode':
      const { QuickNodeClient } = require('./providers/quicknode-client');
      return new QuickNodeClient(config);
    default:
      throw new Error(`Unsupported blockchain provider: ${config.provider}`);
  }
};

export const createProviderManager = (config: import('./types').ProviderManagerConfig): BlockchainProviderManager => {
  return new BlockchainProviderManager(config);
};

// Default configurations
export const DEFAULT_CONNECTION_POOL_CONFIG: import('./types').ConnectionPoolConfig = {
  maxConnections: 10,
  minConnections: 2,
  acquireTimeoutMs: 5000,
  idleTimeoutMs: 300000, // 5 minutes
  reapIntervalMs: 60000, // 1 minute
};

export const DEFAULT_PROVIDER_MANAGER_CONFIG: Partial<import('./types').ProviderManagerConfig> = {
  connectionPool: DEFAULT_CONNECTION_POOL_CONFIG,
  healthCheckInterval: 30000, // 30 seconds
  failoverThreshold: 3,
  loadBalancing: {
    enabled: true,
    strategy: 'least-latency'
  }
};