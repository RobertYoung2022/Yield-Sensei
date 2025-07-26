/**
 * Blockchain Networks Integration Module
 * Exports all network managers and types
 */

// Types
export * from './types';

// Base classes
export { BaseNetworkManager } from './base-network-manager';

// Network-specific managers
export { EVMNetworkManager } from './evm-network-manager';
export { SolanaNetworkManager } from './solana-network-manager';
export { CosmosNetworkManager } from './cosmos-network-manager';

// Main networks manager
export { NetworksManager, type NetworksManagerConfig } from './networks-manager';

// Default configurations
export { NETWORK_CONFIGS } from './types';

// Network manager factory function
export function createNetworkManager(config: any): BaseNetworkManager {
  switch (config.type) {
    case 'evm':
      return new EVMNetworkManager(config);
    case 'solana':
      return new SolanaNetworkManager(config);
    case 'cosmos':
      return new CosmosNetworkManager(config);
    default:
      throw new Error(`Unsupported network type: ${config.type}`);
  }
}

// Utility functions
export function getSupportedNetworks(): string[] {
  return Object.keys(NETWORK_CONFIGS);
}

export function getNetworkConfig(networkId: string): any {
  return NETWORK_CONFIGS[networkId];
}

export function isEVMNetwork(networkId: string): boolean {
  const config = NETWORK_CONFIGS[networkId];
  return config?.type === 'evm';
}

export function isSolanaNetwork(networkId: string): boolean {
  const config = NETWORK_CONFIGS[networkId];
  return config?.type === 'solana';
}

export function isCosmosNetwork(networkId: string): boolean {
  const config = NETWORK_CONFIGS[networkId];
  return config?.type === 'cosmos';
}