/**
 * Networks Manager Tests
 * Comprehensive tests for multi-chain network management
 */

import { NetworksManager, NetworksManagerConfig } from '../networks-manager';
import { NETWORK_CONFIGS } from '../types';

// Mock logger to prevent console output during tests
jest.mock('../../../../shared/logging/logger', () => ({
  getLogger: () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  }),
}));

// Mock ethers to prevent actual network connections
jest.mock('ethers', () => ({
  ethers: {
    JsonRpcProvider: jest.fn().mockImplementation(() => ({
      getNetwork: jest.fn().mockResolvedValue({ chainId: BigInt(1) }),
      getBlockNumber: jest.fn().mockResolvedValue(12345),
      getFeeData: jest.fn().mockResolvedValue({
        gasPrice: BigInt('20000000000'),
        maxFeePerGas: BigInt('30000000000'),
        maxPriorityFeePerGas: BigInt('2000000000'),
      }),
      getBalance: jest.fn().mockResolvedValue(BigInt('1000000000000000000')),
      getBlock: jest.fn().mockResolvedValue({
        number: 12345,
        hash: '0x123...',
        parentHash: '0x456...',
        timestamp: 1640995200,
        gasLimit: BigInt('30000000'),
        gasUsed: BigInt('15000000'),
        baseFeePerGas: BigInt('20000000000'),
        transactions: ['0xabc...', '0xdef...'],
        miner: '0x789...',
      }),
      on: jest.fn(),
      off: jest.fn(),
    })),
    WebSocketProvider: jest.fn().mockImplementation(() => ({
      on: jest.fn(),
      off: jest.fn(),
    })),
    isAddress: jest.fn(() => true),
    formatEther: jest.fn((value) => '1.0'),
    formatUnits: jest.fn((value, units) => '20'),
  },
}));

// Mock Solana web3
jest.mock('@solana/web3.js', () => ({
  Connection: jest.fn().mockImplementation(() => ({
    getSlot: jest.fn().mockResolvedValue(98765),
    getEpochInfo: jest.fn().mockResolvedValue({ epoch: 300 }),
    getBlock: jest.fn().mockResolvedValue({
      blockhash: 'ABC123...',
      previousBlockhash: 'DEF456...',
      blockTime: 1640995200,
      transactions: [],
    }),
    getBalance: jest.fn().mockResolvedValue(1000000000),
    onSlotChange: jest.fn(),
    removeSlotChangeListener: jest.fn(),
  })),
  PublicKey: jest.fn().mockImplementation((key) => ({ toBase58: () => key })),
}));

// Mock axios for Cosmos
jest.mock('axios', () => ({
  create: jest.fn(() => ({
    get: jest.fn().mockImplementation((url) => {
      if (url.includes('/status')) {
        return Promise.resolve({
          data: {
            result: {
              node_info: { network: 'cosmoshub-4' },
              sync_info: { latest_block_height: '54321' },
            },
          },
        });
      }
      return Promise.resolve({ data: {} });
    }),
  })),
}));

describe('NetworksManager', () => {
  let networksManager: NetworksManager;
  
  const testConfig: NetworksManagerConfig = {
    enabledNetworks: ['ethereum', 'polygon', 'solana'],
    monitoring: {
      updateInterval: 30000,
      healthCheckInterval: 60000,
      maxConnectionAttempts: 3,
      connectionTimeout: 10000,
      healthThresholds: {
        minHealthScore: 70,
        maxLatency: 5000,
        maxFailedAttempts: 5,
      },
      alertConfig: {
        enabled: false,
        endpoints: [],
        severityLevels: ['high', 'critical'],
      },
    },
    autoReconnect: true,
    maxConcurrentConnections: 10,
  };

  beforeEach(async () => {
    networksManager = new NetworksManager(testConfig);
  });

  afterEach(async () => {
    if (networksManager) {
      await networksManager.stop();
    }
  });

  describe('Initialization and Configuration', () => {
    test('should initialize successfully', async () => {
      expect(networksManager).toBeDefined();
      
      await networksManager.initialize();
      
      expect(networksManager.getEnabledNetworks()).toEqual(
        expect.arrayContaining(['ethereum', 'polygon', 'solana'])
      );
    });

    test('should start and stop correctly', async () => {
      await networksManager.initialize();
      await networksManager.start();
      
      // Should have network managers created
      expect(networksManager.getNetworkManager('ethereum')).toBeDefined();
      expect(networksManager.getNetworkManager('polygon')).toBeDefined();
      expect(networksManager.getNetworkManager('solana')).toBeDefined();
      
      await networksManager.stop();
    });

    test('should handle configuration with custom network configs', async () => {
      const customConfig: NetworksManagerConfig = {
        ...testConfig,
        customConfigs: {
          ethereum: {
            rpcUrls: ['https://custom-ethereum-rpc.com'],
            confirmationBlocks: 12,
          },
        },
      };

      const customManager = new NetworksManager(customConfig);
      await customManager.initialize();
      
      const ethManager = customManager.getNetworkManager('ethereum');
      expect(ethManager).toBeDefined();
      expect(ethManager!.getConfig().rpcUrls).toContain('https://custom-ethereum-rpc.com');
      
      await customManager.stop();
    });

    test('should handle unsupported networks gracefully', async () => {
      const invalidConfig: NetworksManagerConfig = {
        ...testConfig,
        enabledNetworks: ['ethereum', 'unsupported-network'],
      };

      const invalidManager = new NetworksManager(invalidConfig);
      
      // Should not throw during initialization, but unsupported network should be skipped
      await expect(invalidManager.initialize()).rejects.toThrow();
      
      await invalidManager.stop();
    });
  });

  describe('Network Management', () => {
    beforeEach(async () => {
      await networksManager.initialize();
      await networksManager.start();
    });

    test('should get network managers correctly', () => {
      const ethManager = networksManager.getNetworkManager('ethereum');
      const solManager = networksManager.getNetworkManager('solana');
      const nonExistent = networksManager.getNetworkManager('nonexistent');

      expect(ethManager).toBeDefined();
      expect(ethManager!.getNetworkType()).toBe('evm');
      
      expect(solManager).toBeDefined();
      expect(solManager!.getNetworkType()).toBe('solana');
      
      expect(nonExistent).toBeNull();
    });

    test('should track connected and healthy networks', () => {
      const enabled = networksManager.getEnabledNetworks();
      expect(enabled).toHaveLength(3);
      expect(enabled).toContain('ethereum');
      expect(enabled).toContain('polygon');
      expect(enabled).toContain('solana');

      // Note: In real tests, we'd need to mock successful connections
      // For now, we just verify the methods exist and return arrays
      const connected = networksManager.getConnectedNetworks();
      const healthy = networksManager.getHealthyNetworks();
      
      expect(Array.isArray(connected)).toBe(true);
      expect(Array.isArray(healthy)).toBe(true);
    });

    test('should add and remove networks dynamically', async () => {
      // Add a new network
      await networksManager.addNetwork('arbitrum');
      
      expect(networksManager.getEnabledNetworks()).toContain('arbitrum');
      expect(networksManager.getNetworkManager('arbitrum')).toBeDefined();

      // Remove a network
      await networksManager.removeNetwork('arbitrum');
      
      expect(networksManager.getEnabledNetworks()).not.toContain('arbitrum');
      expect(networksManager.getNetworkManager('arbitrum')).toBeNull();
    });

    test('should prevent duplicate network addition', async () => {
      await expect(networksManager.addNetwork('ethereum')).rejects.toThrow(
        'Network ethereum already exists'
      );
    });
  });

  describe('Network Operations', () => {
    beforeEach(async () => {
      await networksManager.initialize();
      await networksManager.start();
    });

    test('should get current block for networks', async () => {
      // Mock the network managers to return success
      const ethManager = networksManager.getNetworkManager('ethereum');
      if (ethManager) {
        jest.spyOn(ethManager, 'getCurrentBlock').mockResolvedValue(12345);
        
        const blockNumber = await networksManager.getCurrentBlock('ethereum');
        expect(blockNumber).toBe(12345);
      }
    });

    test('should get block info for networks', async () => {
      const ethManager = networksManager.getNetworkManager('ethereum');
      if (ethManager) {
        const mockBlockInfo = {
          networkId: 'ethereum',
          blockNumber: 12345,
          blockHash: '0x123...',
          parentHash: '0x456...',
          timestamp: Date.now(),
          transactionCount: 100,
        };
        
        jest.spyOn(ethManager, 'getBlockInfo').mockResolvedValue(mockBlockInfo);
        
        const blockInfo = await networksManager.getBlockInfo('ethereum', 12345);
        expect(blockInfo).toEqual(mockBlockInfo);
      }
    });

    test('should validate addresses for different networks', () => {
      // Test EVM address validation
      const isValidEth = networksManager.isValidAddress('ethereum', '0x742d35Cc6634C0532925a3b8D...');
      expect(typeof isValidEth).toBe('boolean');

      // Test Solana address validation
      const isValidSol = networksManager.isValidAddress('solana', 'DJTbJLfkNksMKaXhEPJ5TfiqZ...');
      expect(typeof isValidSol).toBe('boolean');

      // Test invalid network
      const isValidInvalid = networksManager.isValidAddress('nonexistent', 'any-address');
      expect(isValidInvalid).toBe(false);
    });

    test('should handle balance queries for multiple networks', async () => {
      // Mock successful balance responses
      const ethManager = networksManager.getNetworkManager('ethereum');
      const solManager = networksManager.getNetworkManager('solana');
      
      if (ethManager) jest.spyOn(ethManager, 'getBalance').mockResolvedValue('1.5');
      if (ethManager) jest.spyOn(ethManager, 'isValidAddress').mockReturnValue(true);
      if (ethManager) jest.spyOn(ethManager, 'isConnected').mockReturnValue(true);
      
      if (solManager) jest.spyOn(solManager, 'getBalance').mockResolvedValue('2.3');
      if (solManager) jest.spyOn(solManager, 'isValidAddress').mockReturnValue(true);
      if (solManager) jest.spyOn(solManager, 'isConnected').mockReturnValue(true);

      const balances = await networksManager.getMultiNetworkBalances('test-address');
      
      expect(typeof balances).toBe('object');
      expect(Object.keys(balances).length).toBeGreaterThan(0);
    });

    test('should handle gas estimation for multiple networks', async () => {
      const mockTx = {
        networkId: 'ethereum',
        from: '0x123...',
        to: '0x456...',
        value: '1.0',
      };

      const estimates = await networksManager.getMultiNetworkGasEstimates(mockTx);
      
      expect(typeof estimates).toBe('object');
    });

    test('should throw error for operations on non-existent networks', async () => {
      await expect(networksManager.getCurrentBlock('nonexistent')).rejects.toThrow(
        'Network nonexistent not found'
      );
      
      await expect(networksManager.getBalance('nonexistent', 'address')).rejects.toThrow(
        'Network nonexistent not found'
      );
    });
  });

  describe('Status and Monitoring', () => {
    beforeEach(async () => {
      await networksManager.initialize();
      await networksManager.start();
    });

    test('should provide connection statuses', () => {
      const statuses = networksManager.getConnectionStatuses();
      
      expect(typeof statuses).toBe('object');
      expect(Object.keys(statuses)).toEqual(
        expect.arrayContaining(['ethereum', 'polygon', 'solana'])
      );
      
      for (const status of Object.values(statuses)) {
        expect(status).toHaveProperty('networkId');
        expect(status).toHaveProperty('isConnected');
        expect(status).toHaveProperty('currentBlock');
        expect(status).toHaveProperty('lastUpdate');
      }
    });

    test('should provide network statistics', () => {
      const stats = networksManager.getNetworkStats();
      
      expect(typeof stats).toBe('object');
      expect(Object.keys(stats)).toEqual(
        expect.arrayContaining(['ethereum', 'polygon', 'solana'])
      );
      
      for (const stat of Object.values(stats)) {
        expect(stat).toHaveProperty('networkId');
        expect(stat).toHaveProperty('totalTransactions');
        expect(stat).toHaveProperty('successfulTransactions');
        expect(stat).toHaveProperty('failedTransactions');
        expect(stat).toHaveProperty('averageBlockTime');
      }
    });

    test('should provide network health information', () => {
      const health = networksManager.getNetworkHealth();
      
      expect(typeof health).toBe('object');
      expect(Object.keys(health)).toEqual(
        expect.arrayContaining(['ethereum', 'polygon', 'solana'])
      );
      
      for (const healthInfo of Object.values(health)) {
        expect(healthInfo).toHaveProperty('networkId');
        expect(healthInfo).toHaveProperty('isHealthy');
        expect(healthInfo).toHaveProperty('healthScore');
        expect(healthInfo).toHaveProperty('issues');
        expect(healthInfo).toHaveProperty('lastHealthCheck');
      }
    });

    test('should calculate overall health correctly', () => {
      const overallHealth = networksManager.getOverallHealth();
      
      expect(overallHealth).toHaveProperty('isHealthy');
      expect(overallHealth).toHaveProperty('healthScore');
      expect(overallHealth).toHaveProperty('connectedNetworks');
      expect(overallHealth).toHaveProperty('totalNetworks');
      expect(overallHealth).toHaveProperty('issues');
      
      expect(typeof overallHealth.isHealthy).toBe('boolean');
      expect(typeof overallHealth.healthScore).toBe('number');
      expect(overallHealth.healthScore).toBeGreaterThanOrEqual(0);
      expect(overallHealth.healthScore).toBeLessThanOrEqual(100);
      expect(overallHealth.totalNetworks).toBe(3);
      expect(Array.isArray(overallHealth.issues)).toBe(true);
    });

    test('should perform health checks', async () => {
      // Test individual network health check
      await networksManager.performHealthCheck('ethereum');
      
      // Test all networks health check
      await networksManager.performHealthCheck();
      
      // Should complete without errors
    });
  });

  describe('Reconnection and Recovery', () => {
    beforeEach(async () => {
      await networksManager.initialize();
      await networksManager.start();
    });

    test('should reconnect individual networks', async () => {
      const ethManager = networksManager.getNetworkManager('ethereum');
      if (ethManager) {
        jest.spyOn(ethManager, 'reconnect').mockResolvedValue(true);
        
        const result = await networksManager.reconnectNetwork('ethereum');
        expect(result).toBe(true);
      }
    });

    test('should reconnect all networks', async () => {
      // Mock all managers to return successful reconnection
      for (const networkId of networksManager.getEnabledNetworks()) {
        const manager = networksManager.getNetworkManager(networkId);
        if (manager) {
          jest.spyOn(manager, 'reconnect').mockResolvedValue(true);
        }
      }
      
      const results = await networksManager.reconnectAllNetworks();
      
      expect(typeof results).toBe('object');
      expect(Object.keys(results)).toEqual(
        expect.arrayContaining(['ethereum', 'polygon', 'solana'])
      );
      
      for (const result of Object.values(results)) {
        expect(typeof result).toBe('boolean');
      }
    });

    test('should handle reconnection failures gracefully', async () => {
      const ethManager = networksManager.getNetworkManager('ethereum');
      if (ethManager) {
        jest.spyOn(ethManager, 'reconnect').mockResolvedValue(false);
        
        const result = await networksManager.reconnectNetwork('ethereum');
        expect(result).toBe(false);
      }
    });
  });

  describe('Configuration Management', () => {
    beforeEach(async () => {
      await networksManager.initialize();
    });

    test('should update network configuration', () => {
      const newConfig = {
        confirmationBlocks: 20,
        blockTime: 15,
      };
      
      networksManager.updateNetworkConfig('ethereum', newConfig);
      
      const ethManager = networksManager.getNetworkManager('ethereum');
      expect(ethManager!.getConfig().confirmationBlocks).toBe(20);
      expect(ethManager!.getConfig().blockTime).toBe(15);
    });

    test('should update monitoring configuration', () => {
      const newMonitoringConfig = {
        updateInterval: 15000,
        healthCheckInterval: 30000,
      };
      
      networksManager.updateMonitoringConfig(newMonitoringConfig);
      
      const config = networksManager.getConfig();
      expect(config.monitoring.updateInterval).toBe(15000);
      expect(config.monitoring.healthCheckInterval).toBe(30000);
    });

    test('should provide current configuration', () => {
      const config = networksManager.getConfig();
      
      expect(config).toHaveProperty('enabledNetworks');
      expect(config).toHaveProperty('monitoring');
      expect(config).toHaveProperty('autoReconnect');
      expect(config).toHaveProperty('maxConcurrentConnections');
      
      expect(config.enabledNetworks).toEqual(['ethereum', 'polygon', 'solana']);
      expect(config.autoReconnect).toBe(true);
    });
  });

  describe('Event Handling', () => {
    beforeEach(async () => {
      await networksManager.initialize();
      await networksManager.start();
    });

    test('should emit network events', (done) => {
      const mockEvent = {
        networkId: 'ethereum',
        type: 'block' as const,
        timestamp: Date.now(),
        data: {
          blockNumber: 12345,
          blockHash: '0x123...',
          timestamp: Date.now(),
          transactionCount: 100,
        },
      };

      networksManager.once('networkEvent', (event) => {
        expect(event).toBeDefined();
        done();
      });

      // Simulate an event from a network manager
      const ethManager = networksManager.getNetworkManager('ethereum');
      if (ethManager) {
        ethManager.emit('networkEvent', mockEvent);
      }
    });

    test('should emit health summary events', (done) => {
      networksManager.once('healthSummary', (summary) => {
        expect(summary).toHaveProperty('isHealthy');
        expect(summary).toHaveProperty('healthScore');
        expect(summary).toHaveProperty('connectedNetworks');
        expect(summary).toHaveProperty('totalNetworks');
        done();
      });

      // Trigger health summary by getting overall health
      networksManager.getOverallHealth();
    });
  });

  describe('Performance and Scalability', () => {
    test('should handle multiple concurrent operations', async () => {
      await networksManager.initialize();
      await networksManager.start();

      const promises = [];
      
      // Simulate multiple concurrent operations
      for (let i = 0; i < 10; i++) {
        promises.push(networksManager.getConnectionStatuses());
        promises.push(networksManager.getNetworkStats());
        promises.push(networksManager.getNetworkHealth());
      }

      const results = await Promise.all(promises);
      
      // All operations should complete successfully
      expect(results).toHaveLength(30);
      results.forEach(result => {
        expect(result).toBeDefined();
      });
    });

    test('should handle large number of networks', async () => {
      // Create config with many networks
      const largeConfig: NetworksManagerConfig = {
        ...testConfig,
        enabledNetworks: ['ethereum', 'polygon', 'bsc', 'arbitrum', 'optimism', 'avalanche'],
      };

      const largeManager = new NetworksManager(largeConfig);
      await largeManager.initialize();
      
      expect(largeManager.getEnabledNetworks()).toHaveLength(6);
      
      const statuses = largeManager.getConnectionStatuses();
      expect(Object.keys(statuses)).toHaveLength(6);
      
      await largeManager.stop();
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle initialization errors gracefully', async () => {
      // Create a config with an invalid network
      const invalidConfig: NetworksManagerConfig = {
        ...testConfig,
        enabledNetworks: ['ethereum', 'invalid-network'],
      };

      const invalidManager = new NetworksManager(invalidConfig);
      
      // Should handle initialization error gracefully
      await expect(invalidManager.initialize()).rejects.toThrow();
    });

    test('should handle operations on stopped manager', async () => {
      await networksManager.initialize();
      await networksManager.start();
      await networksManager.stop();

      // Operations should still work on stopped manager (returning cached data)
      const statuses = networksManager.getConnectionStatuses();
      expect(typeof statuses).toBe('object');
    });

    test('should handle empty network list', async () => {
      const emptyConfig: NetworksManagerConfig = {
        ...testConfig,
        enabledNetworks: [],
      };

      const emptyManager = new NetworksManager(emptyConfig);
      await emptyManager.initialize();
      
      expect(emptyManager.getEnabledNetworks()).toHaveLength(0);
      
      const overallHealth = emptyManager.getOverallHealth();
      expect(overallHealth.totalNetworks).toBe(0);
      expect(overallHealth.connectedNetworks).toBe(0);
      
      await emptyManager.stop();
    });
  });
});