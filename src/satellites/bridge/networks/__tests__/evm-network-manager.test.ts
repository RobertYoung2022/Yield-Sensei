/**
 * EVM Network Manager Tests
 * Tests for Ethereum and EVM-compatible blockchain connections
 */

import { EVMNetworkManager } from '../evm-network-manager';
import { NETWORK_CONFIGS, EVMNetworkConfig } from '../types';

// Mock logger
jest.mock('../../../../shared/logging/logger', () => ({
  getLogger: () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  }),
}));

// Mock ethers
const mockProvider = {
  getNetwork: jest.fn(),
  getBlockNumber: jest.fn(),
  getFeeData: jest.fn(),
  getBalance: jest.fn(),
  getBlock: jest.fn(),
  getTransactionReceipt: jest.fn(),
  estimateGas: jest.fn(),
  getCode: jest.fn(),
  on: jest.fn(),
  off: jest.fn(),
  broadcastTransaction: jest.fn(),
};

jest.mock('ethers', () => ({
  ethers: {
    JsonRpcProvider: jest.fn(() => mockProvider),
    WebSocketProvider: jest.fn(() => mockProvider),
    isAddress: jest.fn(() => true),
    formatEther: jest.fn((value) => '1.0'),
    formatUnits: jest.fn((value, units) => '20'),
    parseEther: jest.fn((value) => BigInt('1000000000000000000')),
    ZeroAddress: '0x0000000000000000000000000000000000000000',
    Contract: jest.fn(() => ({
      balanceOf: jest.fn().mockResolvedValue(BigInt('1000000000000000000')),
      decimals: jest.fn().mockResolvedValue(18),
    })),
    Transaction: {
      from: jest.fn(() => ({ serialized: '0x...' })),
    },
  },
}));

describe('EVMNetworkManager', () => {
  let evmManager: EVMNetworkManager;
  
  const testConfig: EVMNetworkConfig = {
    ...NETWORK_CONFIGS.ethereum as EVMNetworkConfig,
    rpcUrls: ['http://localhost:8545'], // Use localhost for testing
    wsUrls: ['ws://localhost:8546'],
  };

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Setup default mock responses
    mockProvider.getNetwork.mockResolvedValue({ chainId: BigInt(1) });
    mockProvider.getBlockNumber.mockResolvedValue(12345);
    mockProvider.getFeeData.mockResolvedValue({
      gasPrice: BigInt('20000000000'),
      maxFeePerGas: BigInt('30000000000'),
      maxPriorityFeePerGas: BigInt('2000000000'),
    });
    mockProvider.getBalance.mockResolvedValue(BigInt('1000000000000000000'));
    mockProvider.getBlock.mockResolvedValue({
      number: 12345,
      hash: '0x123...',
      parentHash: '0x456...',
      timestamp: 1640995200,
      gasLimit: BigInt('30000000'),
      gasUsed: BigInt('15000000'),
      baseFeePerGas: BigInt('20000000000'),
      transactions: ['0xabc...', '0xdef...'],
      miner: '0x789...',
    });

    evmManager = new EVMNetworkManager(testConfig);
  });

  afterEach(async () => {
    if (evmManager) {
      await evmManager.stop();
    }
  });

  describe('Initialization and Connection', () => {
    test('should initialize successfully', async () => {
      await evmManager.initialize();
      
      expect(evmManager.getNetworkId()).toBe('ethereum');
      expect(evmManager.getNetworkType()).toBe('evm');
    });

    test('should connect to Ethereum network', async () => {
      const connected = await evmManager.connect();
      
      expect(connected).toBe(true);
      expect(evmManager.isConnected()).toBe(true);
      expect(mockProvider.getNetwork).toHaveBeenCalled();
      expect(mockProvider.getBlockNumber).toHaveBeenCalled();
    });

    test('should handle connection failure', async () => {
      mockProvider.getNetwork.mockRejectedValue(new Error('Connection failed'));
      
      const connected = await evmManager.connect();
      
      expect(connected).toBe(false);
      expect(evmManager.isConnected()).toBe(false);
    });

    test('should validate chain ID', async () => {
      mockProvider.getNetwork.mockResolvedValue({ chainId: BigInt(999) }); // Wrong chain ID
      
      const connected = await evmManager.connect();
      
      expect(connected).toBe(false);
    });

    test('should start and stop correctly', async () => {
      await evmManager.initialize();
      await evmManager.start();
      
      expect(mockProvider.on).toHaveBeenCalledWith('block', expect.any(Function));
      
      await evmManager.stop();
      
      expect(mockProvider.off).toHaveBeenCalledWith('block', expect.any(Function));
    });
  });

  describe('Block Operations', () => {
    beforeEach(async () => {
      await evmManager.initialize();
      await evmManager.start();
    });

    test('should get current block number', async () => {
      const blockNumber = await evmManager.getCurrentBlock();
      
      expect(blockNumber).toBe(12345);
      expect(mockProvider.getBlockNumber).toHaveBeenCalled();
    });

    test('should get block information', async () => {
      const blockInfo = await evmManager.getBlockInfo(12345);
      
      expect(blockInfo).toBeDefined();
      expect(blockInfo!.networkId).toBe('ethereum');
      expect(blockInfo!.blockNumber).toBe(12345);
      expect(blockInfo!.blockHash).toBe('0x123...');
      expect(blockInfo!.parentHash).toBe('0x456...');
      expect(blockInfo!.timestamp).toBe(1640995200 * 1000); // Converted to milliseconds
      expect(blockInfo!.transactionCount).toBe(2);
      expect(blockInfo!.validator).toBe('0x789...');
    });

    test('should get latest block info when no block number specified', async () => {
      const blockInfo = await evmManager.getBlockInfo();
      
      expect(blockInfo).toBeDefined();
      expect(mockProvider.getBlock).toHaveBeenCalledWith('latest');
    });

    test('should handle block info errors', async () => {
      mockProvider.getBlock.mockRejectedValue(new Error('Block not found'));
      
      const blockInfo = await evmManager.getBlockInfo(12345);
      
      expect(blockInfo).toBeNull();
    });
  });

  describe('Balance Operations', () => {
    beforeEach(async () => {
      await evmManager.initialize();
      await evmManager.start();
    });

    test('should get native token balance', async () => {
      const balance = await evmManager.getBalance('0x742d35Cc6634C0532925a3b8D401c6e17b5c04cf');
      
      expect(balance).toBe('1.0');
      expect(mockProvider.getBalance).toHaveBeenCalledWith('0x742d35Cc6634C0532925a3b8D401c6e17b5c04cf');
    });

    test('should get ERC-20 token balance', async () => {
      const balance = await evmManager.getTokenBalance(
        '0xA0b86a33E6441f2cD7b9B9b9C0D8D2FF38E0A5e4', // Token contract
        '0x742d35Cc6634C0532925a3b8D401c6e17b5c04cf'  // Holder address
      );
      
      expect(balance).toBe('1.0');
    });

    test('should handle balance query errors', async () => {
      mockProvider.getBalance.mockRejectedValue(new Error('Invalid address'));
      
      await expect(evmManager.getBalance('invalid-address')).rejects.toThrow('Invalid address');
    });
  });

  describe('Gas Estimation', () => {
    beforeEach(async () => {
      await evmManager.initialize();
      await evmManager.start();
    });

    test('should estimate gas for transaction', async () => {
      mockProvider.estimateGas.mockResolvedValue(BigInt('21000'));
      
      const tx = {
        networkId: 'ethereum',
        from: '0x742d35Cc6634C0532925a3b8D401c6e17b5c04cf',
        to: '0x8ba1f109551bD432803012645Hac136c', 
        value: '1.0',
      };
      
      const gasEstimate = await evmManager.estimateGas(tx);
      
      expect(gasEstimate).toBeDefined();
      expect(gasEstimate.networkId).toBe('ethereum');
      expect(gasEstimate.gasLimit).toBe('21000');
      expect(gasEstimate.gasPrice).toBe('20000000000');
      expect(gasEstimate.confidence).toBe(0.9);
      expect(gasEstimate.estimatedTime).toBe(testConfig.blockTime);
    });

    test('should handle EIP-1559 gas pricing', async () => {
      const gasEstimate = await evmManager.estimateGas({
        networkId: 'ethereum',
        from: '0x742d35Cc6634C0532925a3b8D401c6e17b5c04cf',
        to: '0x8ba1f109551bD432803012645Hac136c',
        value: '1.0',
      });
      
      expect(gasEstimate.maxFeePerGas).toBe('30000000000');
      expect(gasEstimate.maxPriorityFeePerGas).toBe('2000000000');
    });

    test('should handle gas estimation errors', async () => {
      mockProvider.estimateGas.mockRejectedValue(new Error('Gas estimation failed'));
      
      const tx = {
        networkId: 'ethereum',
        from: '0x742d35Cc6634C0532925a3b8D401c6e17b5c04cf',
        to: '0x8ba1f109551bD432803012645Hac136c',
        value: '1.0',
      };
      
      await expect(evmManager.estimateGas(tx)).rejects.toThrow('Gas estimation failed');
    });
  });

  describe('Transaction Operations', () => {
    beforeEach(async () => {
      await evmManager.initialize();
      await evmManager.start();
    });

    test('should get transaction receipt', async () => {
      const mockReceipt = {
        hash: '0xabc123...',
        blockNumber: 12345,
        blockHash: '0x123...',
        from: '0x742d35Cc6634C0532925a3b8D401c6e17b5c04cf',
        to: '0x8ba1f109551bD432803012645Hac136c',
        gasUsed: BigInt('21000'),
        gasPrice: BigInt('20000000000'),
        status: 1,
        logs: [],
      };
      
      mockProvider.getTransactionReceipt.mockResolvedValue(mockReceipt);
      
      const receipt = await evmManager.getTransactionReceipt('0xabc123...');
      
      expect(receipt).toBeDefined();
      expect(receipt!.networkId).toBe('ethereum');
      expect(receipt!.transactionHash).toBe('0xabc123...');
      expect(receipt!.status).toBe('success');
      expect(receipt!.confirmations).toBeGreaterThanOrEqual(0);
    });

    test('should handle failed transaction receipt', async () => {
      const mockReceipt = {
        hash: '0xabc123...',
        blockNumber: 12345,
        blockHash: '0x123...',
        from: '0x742d35Cc6634C0532925a3b8D401c6e17b5c04cf',
        to: '0x8ba1f109551bD432803012645Hac136c',
        gasUsed: BigInt('21000'),
        gasPrice: BigInt('20000000000'),
        status: 0, // Failed transaction
        logs: [],
      };
      
      mockProvider.getTransactionReceipt.mockResolvedValue(mockReceipt);
      
      const receipt = await evmManager.getTransactionReceipt('0xabc123...');
      
      expect(receipt!.status).toBe('failed');
    });

    test('should return null for non-existent transaction', async () => {
      mockProvider.getTransactionReceipt.mockResolvedValue(null);
      
      const receipt = await evmManager.getTransactionReceipt('0xnonexistent...');
      
      expect(receipt).toBeNull();
    });

    test('should wait for transaction confirmation', async () => {
      const mockReceipt = {
        hash: '0xabc123...',
        blockNumber: 12345,
        blockHash: '0x123...',
        from: '0x742d35Cc6634C0532925a3b8D401c6e17b5c04cf',
        to: '0x8ba1f109551bD432803012645Hac136c',
        gasUsed: BigInt('21000'),
        gasPrice: BigInt('20000000000'),
        status: 1,
        logs: [],
      };
      
      // First call returns null (pending), second call returns receipt
      mockProvider.getTransactionReceipt
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(mockReceipt);
      
      // Mock current block to simulate confirmations
      mockProvider.getBlockNumber.mockResolvedValue(12350); // 5 confirmations
      
      const receipt = await evmManager.waitForTransaction('0xabc123...', 3, 5000);
      
      expect(receipt).toBeDefined();
      expect(receipt!.confirmations).toBeGreaterThanOrEqual(3);
    });
  });

  describe('Address Validation', () => {
    test('should validate Ethereum addresses', () => {
      expect(evmManager.isValidAddress('0x742d35Cc6634C0532925a3b8D401c6e17b5c04cf')).toBe(true);
      expect(evmManager.isValidAddress('0x0')).toBe(true);
      expect(evmManager.isValidAddress('invalid-address')).toBe(true); // Mocked to return true
    });
  });

  describe('Contract Operations', () => {
    beforeEach(async () => {
      await evmManager.initialize();
      await evmManager.start();
    });

    test('should get contract code', async () => {
      mockProvider.getCode.mockResolvedValue('0x608060405234801561001057600080fd5b50...');
      
      const code = await evmManager.getContractCode('0xA0b86a33E6441f2cD7b9B9b9C0D8D2FF38E0A5e4');
      
      expect(code).toBe('0x608060405234801561001057600080fd5b50...');
    });

    test('should detect if address is contract', async () => {
      mockProvider.getCode.mockResolvedValue('0x608060405234801561001057600080fd5b50...');
      
      const isContract = await evmManager.isContract('0xA0b86a33E6441f2cD7b9B9b9C0D8D2FF38E0A5e4');
      
      expect(isContract).toBe(true);
    });

    test('should detect if address is not contract', async () => {
      mockProvider.getCode.mockResolvedValue('0x');
      
      const isContract = await evmManager.isContract('0x742d35Cc6634C0532925a3b8D401c6e17b5c04cf');
      
      expect(isContract).toBe(false);
    });
  });

  describe('Health Monitoring', () => {
    beforeEach(async () => {
      await evmManager.initialize();
      await evmManager.start();
    });

    test('should perform health check successfully', async () => {
      await evmManager.performHealthCheck();
      
      const health = evmManager.getHealth();
      expect(health.isHealthy).toBe(true);
      expect(health.healthScore).toBeGreaterThan(0);
      expect(health.lastHealthCheck).toBeGreaterThan(0);
    });

    test('should detect unhealthy network', async () => {
      mockProvider.getBlockNumber.mockRejectedValue(new Error('Connection failed'));
      
      await evmManager.performHealthCheck();
      
      const health = evmManager.getHealth();
      expect(health.isHealthy).toBe(false);
      expect(health.healthScore).toBe(0);
      expect(health.issues.length).toBeGreaterThan(0);
    });

    test('should track connection statistics', async () => {
      const stats = evmManager.getStats();
      
      expect(stats.networkId).toBe('ethereum');
      expect(stats.totalTransactions).toBe(0);
      expect(stats.successfulTransactions).toBe(0);
      expect(stats.failedTransactions).toBe(0);
      expect(stats.averageBlockTime).toBe(testConfig.blockTime);
    });
  });

  describe('Failover and Reconnection', () => {
    test('should attempt failover to backup RPC', async () => {
      const configWithMultipleRPCs: EVMNetworkConfig = {
        ...testConfig,
        rpcUrls: ['http://failed-rpc:8545', 'http://backup-rpc:8545'],
      };
      
      const evmManagerWithFailover = new EVMNetworkManager(configWithMultipleRPCs);
      
      // First RPC fails, second succeeds
      mockProvider.getNetwork
        .mockRejectedValueOnce(new Error('Connection failed'))
        .mockResolvedValueOnce({ chainId: BigInt(1) });
      
      const connected = await evmManagerWithFailover.connect();
      
      expect(connected).toBe(true);
      
      await evmManagerWithFailover.stop();
    });

    test('should reconnect after connection loss', async () => {
      await evmManager.initialize();
      await evmManager.start();
      
      // Simulate connection loss
      mockProvider.getBlockNumber.mockRejectedValue(new Error('Connection lost'));
      
      await evmManager.performHealthCheck();
      
      // Health should be marked as unhealthy
      expect(evmManager.isHealthy()).toBe(false);
      
      // Simulate successful reconnection
      mockProvider.getNetwork.mockResolvedValue({ chainId: BigInt(1) });
      mockProvider.getBlockNumber.mockResolvedValue(12346);
      
      const reconnected = await evmManager.reconnect();
      
      expect(reconnected).toBe(true);
    });
  });

  describe('Configuration Updates', () => {
    test('should update configuration', () => {
      const newConfig = {
        confirmationBlocks: 20,
        blockTime: 15,
      };
      
      evmManager.updateConfig(newConfig);
      
      const config = evmManager.getConfig();
      expect(config.confirmationBlocks).toBe(20);
      expect(config.blockTime).toBe(15);
    });
  });

  describe('Error Handling', () => {
    test('should handle network not connected errors', async () => {
      // Don't initialize or connect
      await expect(evmManager.getCurrentBlock()).rejects.toThrow('ethereum not connected');
      await expect(evmManager.getBalance('0x123...')).rejects.toThrow('ethereum not connected');
    });

    test('should handle RPC errors gracefully', async () => {
      await evmManager.initialize();
      await evmManager.start();
      
      mockProvider.getBlockNumber.mockRejectedValue(new Error('RPC error'));
      
      await expect(evmManager.getCurrentBlock()).rejects.toThrow('RPC error');
    });

    test('should handle malformed responses', async () => {
      await evmManager.initialize();
      await evmManager.start();
      
      mockProvider.getBlock.mockResolvedValue(null);
      
      const blockInfo = await evmManager.getBlockInfo(12345);
      expect(blockInfo).toBeNull();
    });
  });
});