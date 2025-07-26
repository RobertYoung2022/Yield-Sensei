/**
 * Networks Manager
 * Central coordinator for all blockchain network connections
 */

import { EventEmitter } from 'events';
import Logger from '../../../shared/logging/logger';
import { BaseNetworkManager } from './base-network-manager';
import { EVMNetworkManager } from './evm-network-manager';
import { SolanaNetworkManager } from './solana-network-manager';
import { CosmosNetworkManager } from './cosmos-network-manager';
import {
  NetworkConfig,
  NetworkConnection,
  NetworkStats,
  NetworkHealth,
  NetworkEvent,
  TransactionRequest,
  TransactionReceipt,
  GasEstimate,
  BlockInfo,
  TransactionHash,
  Address,
  NetworkID,
  NetworkType,
  NetworkMonitoringConfig,
  NETWORK_CONFIGS,
  EVMNetworkConfig,
  SolanaNetworkConfig,
  CosmosNetworkConfig,
} from './types';

const logger = Logger.getLogger('networks-manager');

export interface NetworksManagerConfig {
  enabledNetworks: NetworkID[];
  customConfigs?: Record<NetworkID, Partial<NetworkConfig>>;
  monitoring: NetworkMonitoringConfig;
  autoReconnect: boolean;
  maxConcurrentConnections: number;
}

export class NetworksManager extends EventEmitter {
  private networkManagers = new Map<NetworkID, BaseNetworkManager>();
  private config: NetworksManagerConfig;
  private isInitialized = false;
  private isRunning = false;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private healthCheckInterval: NodeJS.Timeout | null = null;

  constructor(config: NetworksManagerConfig) {
    super();
    this.config = config;
    
    logger.info('Networks Manager created', {
      enabledNetworks: config.enabledNetworks,
      monitoringEnabled: config.monitoring.enabled,
    });
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.warn('Networks Manager already initialized');
      return;
    }

    try {
      logger.info('Initializing Networks Manager...');

      // Create network managers for enabled networks
      for (const networkId of this.config.enabledNetworks) {
        await this.createNetworkManager(networkId);
      }

      // Initialize all network managers
      const initPromises = Array.from(this.networkManagers.values()).map(manager => 
        manager.initialize().catch(error => {
          logger.error(`Failed to initialize ${manager.getNetworkId()}:`, error);
          return null; // Continue with other initializations
        })
      );

      await Promise.allSettled(initPromises);

      // Set up event forwarding
      this.setupEventForwarding();

      this.isInitialized = true;
      logger.info(`✅ Networks Manager initialized with ${this.networkManagers.size} networks`);

    } catch (error) {
      logger.error('Failed to initialize Networks Manager:', error);
      throw error;
    }
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Networks Manager already running');
      return;
    }

    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      logger.info('Starting Networks Manager...');

      // Start all network managers
      const startPromises = Array.from(this.networkManagers.values()).map(manager => 
        manager.start().catch(error => {
          logger.error(`Failed to start ${manager.getNetworkId()}:`, error);
          return null; // Continue with other starts
        })
      );

      await Promise.allSettled(startPromises);

      // Start monitoring
      this.startMonitoring();

      this.isRunning = true;
      logger.info('🚀 Networks Manager started successfully');

    } catch (error) {
      logger.error('Failed to start Networks Manager:', error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    try {
      logger.info('Stopping Networks Manager...');

      this.isRunning = false;

      // Stop monitoring
      this.stopMonitoring();

      // Stop all network managers
      const stopPromises = Array.from(this.networkManagers.values()).map(manager => 
        manager.stop().catch(error => {
          logger.error(`Failed to stop ${manager.getNetworkId()}:`, error);
          return null; // Continue with other stops
        })
      );

      await Promise.allSettled(stopPromises);

      logger.info('🛑 Networks Manager stopped');

    } catch (error) {
      logger.error('Failed to stop Networks Manager:', error);
      throw error;
    }
  }

  // Network management methods

  private async createNetworkManager(networkId: NetworkID): Promise<void> {
    try {
      // Get base config
      const baseConfig = NETWORK_CONFIGS[networkId];
      if (!baseConfig) {
        throw new Error(`No configuration found for network: ${networkId}`);
      }

      // Apply custom config if provided
      const customConfig = this.config.customConfigs?.[networkId];
      const finalConfig = customConfig ? { ...baseConfig, ...customConfig } : baseConfig;

      // Create appropriate manager based on network type
      let manager: BaseNetworkManager;

      switch (finalConfig.type) {
        case 'evm':
          manager = new EVMNetworkManager(finalConfig as EVMNetworkConfig);
          break;
        case 'solana':
          manager = new SolanaNetworkManager(finalConfig as SolanaNetworkConfig);
          break;
        case 'cosmos':
          manager = new CosmosNetworkManager(finalConfig as CosmosNetworkConfig);
          break;
        default:
          throw new Error(`Unsupported network type: ${finalConfig.type}`);
      }

      this.networkManagers.set(networkId, manager);
      logger.info(`Created ${finalConfig.type} manager for ${finalConfig.name}`);

    } catch (error) {
      logger.error(`Failed to create network manager for ${networkId}:`, error);
      throw error;
    }
  }

  getNetworkManager(networkId: NetworkID): BaseNetworkManager | null {
    return this.networkManagers.get(networkId) || null;
  }

  getEnabledNetworks(): NetworkID[] {
    return Array.from(this.networkManagers.keys());
  }

  getConnectedNetworks(): NetworkID[] {
    return Array.from(this.networkManagers.entries())
      .filter(([_, manager]) => manager.isConnected())
      .map(([networkId]) => networkId);
  }

  getHealthyNetworks(): NetworkID[] {
    return Array.from(this.networkManagers.entries())
      .filter(([_, manager]) => manager.isHealthy())
      .map(([networkId]) => networkId);
  }

  // Network operations

  async getCurrentBlock(networkId: NetworkID): Promise<number> {
    const manager = this.getNetworkManager(networkId);
    if (!manager) {
      throw new Error(`Network ${networkId} not found`);
    }
    return manager.getCurrentBlock();
  }

  async getBlockInfo(networkId: NetworkID, blockNumber?: number): Promise<BlockInfo | null> {
    const manager = this.getNetworkManager(networkId);
    if (!manager) {
      throw new Error(`Network ${networkId} not found`);
    }
    return manager.getBlockInfo(blockNumber);
  }

  async sendTransaction(networkId: NetworkID, tx: TransactionRequest): Promise<TransactionHash> {
    const manager = this.getNetworkManager(networkId);
    if (!manager) {
      throw new Error(`Network ${networkId} not found`);
    }
    return manager.sendTransaction(tx);
  }

  async getTransactionReceipt(networkId: NetworkID, hash: TransactionHash): Promise<TransactionReceipt | null> {
    const manager = this.getNetworkManager(networkId);
    if (!manager) {
      throw new Error(`Network ${networkId} not found`);
    }
    return manager.getTransactionReceipt(hash);
  }

  async estimateGas(networkId: NetworkID, tx: TransactionRequest): Promise<GasEstimate> {
    const manager = this.getNetworkManager(networkId);
    if (!manager) {
      throw new Error(`Network ${networkId} not found`);
    }
    return manager.estimateGas(tx);
  }

  async getBalance(networkId: NetworkID, address: Address): Promise<string> {
    const manager = this.getNetworkManager(networkId);
    if (!manager) {
      throw new Error(`Network ${networkId} not found`);
    }
    return manager.getBalance(address);
  }

  isValidAddress(networkId: NetworkID, address: string): boolean {
    const manager = this.getNetworkManager(networkId);
    if (!manager) {
      return false;
    }
    return manager.isValidAddress(address);
  }

  async waitForTransaction(
    networkId: NetworkID,
    hash: TransactionHash,
    confirmations?: number,
    timeout?: number
  ): Promise<TransactionReceipt | null> {
    const manager = this.getNetworkManager(networkId);
    if (!manager) {
      throw new Error(`Network ${networkId} not found`);
    }
    return manager.waitForTransaction(hash, confirmations, timeout);
  }

  // Multi-network operations

  async getMultiNetworkBalances(address: Address, networkIds?: NetworkID[]): Promise<Record<NetworkID, string>> {
    const networks = networkIds || this.getConnectedNetworks();
    const balances: Record<NetworkID, string> = {};

    await Promise.allSettled(
      networks.map(async (networkId) => {
        try {
          const manager = this.getNetworkManager(networkId);
          if (manager && manager.isConnected()) {
            // Only check if address is valid for this network
            if (manager.isValidAddress(address)) {
              balances[networkId] = await manager.getBalance(address);
            } else {
              balances[networkId] = '0';
            }
          }
        } catch (error) {
          logger.error(`Failed to get balance for ${address} on ${networkId}:`, error);
          balances[networkId] = '0';
        }
      })
    );

    return balances;
  }

  async getMultiNetworkGasEstimates(tx: TransactionRequest, networkIds?: NetworkID[]): Promise<Record<NetworkID, GasEstimate>> {
    const networks = networkIds || this.getConnectedNetworks();
    const estimates: Record<NetworkID, GasEstimate> = {};

    await Promise.allSettled(
      networks.map(async (networkId) => {
        try {
          const manager = this.getNetworkManager(networkId);
          if (manager && manager.isConnected()) {
            const networkTx = { ...tx, networkId };
            estimates[networkId] = await manager.estimateGas(networkTx);
          }
        } catch (error) {
          logger.error(`Failed to estimate gas for ${networkId}:`, error);
        }
      })
    );

    return estimates;
  }

  // Status and monitoring

  getConnectionStatuses(): Record<NetworkID, NetworkConnection> {
    const statuses: Record<NetworkID, NetworkConnection> = {};
    
    for (const [networkId, manager] of this.networkManagers) {
      statuses[networkId] = manager.getConnection();
    }
    
    return statuses;
  }

  getNetworkStats(): Record<NetworkID, NetworkStats> {
    const stats: Record<NetworkID, NetworkStats> = {};
    
    for (const [networkId, manager] of this.networkManagers) {
      stats[networkId] = manager.getStats();
    }
    
    return stats;
  }

  getNetworkHealth(): Record<NetworkID, NetworkHealth> {
    const health: Record<NetworkID, NetworkHealth> = {};
    
    for (const [networkId, manager] of this.networkManagers) {
      health[networkId] = manager.getHealth();
    }
    
    return health;
  }

  getOverallHealth(): {
    isHealthy: boolean;
    healthScore: number;
    connectedNetworks: number;
    totalNetworks: number;
    issues: string[];
  } {
    const healthData = this.getNetworkHealth();
    const connectedCount = this.getConnectedNetworks().length;
    const totalCount = this.networkManagers.size;
    
    let totalScore = 0;
    let healthyCount = 0;
    const issues: string[] = [];
    
    for (const [networkId, health] of Object.entries(healthData)) {
      totalScore += health.healthScore;
      if (health.isHealthy) {
        healthyCount++;
      } else {
        issues.push(`${networkId}: ${health.issues.map(i => i.message).join(', ')}`);
      }
    }
    
    const averageScore = totalCount > 0 ? totalScore / totalCount : 0;
    const isHealthy = healthyCount >= Math.ceil(totalCount * 0.7); // 70% healthy threshold
    
    return {
      isHealthy,
      healthScore: averageScore,
      connectedNetworks: connectedCount,
      totalNetworks: totalCount,
      issues,
    };
  }

  // Network management operations

  async reconnectNetwork(networkId: NetworkID): Promise<boolean> {
    const manager = this.getNetworkManager(networkId);
    if (!manager) {
      throw new Error(`Network ${networkId} not found`);
    }
    
    logger.info(`Manually reconnecting ${networkId}...`);
    return manager.reconnect();
  }

  async reconnectAllNetworks(): Promise<Record<NetworkID, boolean>> {
    const results: Record<NetworkID, boolean> = {};
    
    await Promise.allSettled(
      Array.from(this.networkManagers.entries()).map(async ([networkId, manager]) => {
        try {
          results[networkId] = await manager.reconnect();
        } catch (error) {
          logger.error(`Failed to reconnect ${networkId}:`, error);
          results[networkId] = false;
        }
      })
    );
    
    return results;
  }

  async performHealthCheck(networkId?: NetworkID): Promise<void> {
    if (networkId) {
      const manager = this.getNetworkManager(networkId);
      if (manager) {
        await manager.performHealthCheck();
      }
    } else {
      // Perform health check on all networks
      await Promise.allSettled(
        Array.from(this.networkManagers.values()).map(manager => 
          manager.performHealthCheck()
        )
      );
    }
  }

  // Configuration management

  updateNetworkConfig(networkId: NetworkID, config: Partial<NetworkConfig>): void {
    const manager = this.getNetworkManager(networkId);
    if (manager) {
      manager.updateConfig(config);
      logger.info(`Updated configuration for ${networkId}`);
    }
  }

  updateMonitoringConfig(config: Partial<NetworkMonitoringConfig>): void {
    this.config.monitoring = { ...this.config.monitoring, ...config };
    logger.info('Updated monitoring configuration');
  }

  // Private methods

  private setupEventForwarding(): void {
    for (const [networkId, manager] of this.networkManagers) {
      manager.on('networkEvent', (event: NetworkEvent) => {
        this.emit('networkEvent', event);
        this.emit(`${event.type}:${networkId}`, event);
      });

      manager.on('block', (event: NetworkEvent) => {
        this.emit('block', event);
      });

      manager.on('transaction', (event: NetworkEvent) => {
        this.emit('transaction', event);
      });

      manager.on('connection', (event: NetworkEvent) => {
        this.emit('connection', event);
      });

      manager.on('error', (error: Error) => {
        this.emit('error', { networkId, error });
      });
    }
  }

  private startMonitoring(): void {
    if (!this.config.monitoring.enabled) {
      return;
    }

    // General monitoring
    this.monitoringInterval = setInterval(() => {
      this.performMonitoringCycle();
    }, this.config.monitoring.updateInterval);

    // Health monitoring
    this.healthCheckInterval = setInterval(() => {
      this.performHealthCheck();
    }, this.config.monitoring.healthCheckInterval);

    logger.info('Network monitoring started');
  }

  private stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    logger.info('Network monitoring stopped');
  }

  private async performMonitoringCycle(): Promise<void> {
    try {
      const overallHealth = this.getOverallHealth();
      
      // Emit health summary
      this.emit('healthSummary', overallHealth);
      
      // Log warnings for unhealthy networks
      if (!overallHealth.isHealthy) {
        logger.warn('Network health issues detected:', {
          healthScore: overallHealth.healthScore,
          connectedNetworks: overallHealth.connectedNetworks,
          totalNetworks: overallHealth.totalNetworks,
          issues: overallHealth.issues,
        });
      }

      // Auto-reconnect if enabled
      if (this.config.autoReconnect) {
        const connectionStatuses = this.getConnectionStatuses();
        
        for (const [networkId, status] of Object.entries(connectionStatuses)) {
          if (!status.isConnected && 
              status.connectionAttempts < this.config.monitoring.maxConnectionAttempts) {
            
            logger.info(`Auto-reconnecting to ${networkId}...`);
            await this.reconnectNetwork(networkId);
          }
        }
      }

    } catch (error) {
      logger.error('Error during monitoring cycle:', error);
    }
  }

  // Utility methods

  async addNetwork(networkId: NetworkID, config?: Partial<NetworkConfig>): Promise<void> {
    if (this.networkManagers.has(networkId)) {
      throw new Error(`Network ${networkId} already exists`);
    }

    if (config) {
      this.config.customConfigs = this.config.customConfigs || {};
      this.config.customConfigs[networkId] = config;
    }

    this.config.enabledNetworks.push(networkId);
    await this.createNetworkManager(networkId);

    const manager = this.networkManagers.get(networkId);
    if (manager && this.isInitialized) {
      await manager.initialize();
      if (this.isRunning) {
        await manager.start();
      }
    }

    logger.info(`Added network: ${networkId}`);
  }

  async removeNetwork(networkId: NetworkID): Promise<void> {
    const manager = this.getNetworkManager(networkId);
    if (manager) {
      await manager.stop();
      this.networkManagers.delete(networkId);
    }

    this.config.enabledNetworks = this.config.enabledNetworks.filter(id => id !== networkId);
    
    if (this.config.customConfigs?.[networkId]) {
      delete this.config.customConfigs[networkId];
    }

    logger.info(`Removed network: ${networkId}`);
  }

  getConfig(): NetworksManagerConfig {
    return { ...this.config };
  }
}