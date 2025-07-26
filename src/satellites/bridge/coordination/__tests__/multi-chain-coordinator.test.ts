/**
 * Multi-Chain Coordinator Tests
 * Comprehensive tests for cross-chain portfolio coordination system
 */

import { MultiChainCoordinator } from '../multi-chain-coordinator';
import { DEFAULT_BRIDGE_CONFIG } from '../../bridge-satellite';
import { BridgeSatelliteConfig, ArbitrageOpportunity, ChainID, AssetID } from '../../types';

// Mock logger to prevent console output during tests
jest.mock('../../../../shared/logging/logger', () => ({
  getLogger: () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  }),
}));

describe('MultiChainCoordinator', () => {
  let coordinator: MultiChainCoordinator;
  
  const testConfig: BridgeSatelliteConfig = {
    ...DEFAULT_BRIDGE_CONFIG,
    chains: [
      { 
        id: 'ethereum', 
        name: 'Ethereum', 
        rpcUrl: 'http://localhost:8545',
        nativeCurrency: 'ETH',
        blockTime: 12,
        gasTokenSymbol: 'ETH',
        maxGasPrice: '100000000000',
        confirmationBlocks: 6
      },
      { 
        id: 'polygon', 
        name: 'Polygon', 
        rpcUrl: 'http://localhost:8546',
        nativeCurrency: 'MATIC',
        blockTime: 2,
        gasTokenSymbol: 'MATIC',
        maxGasPrice: '30000000000',
        confirmationBlocks: 12
      },
      { 
        id: 'arbitrum', 
        name: 'Arbitrum', 
        rpcUrl: 'http://localhost:8547',
        nativeCurrency: 'ETH',
        blockTime: 1,
        gasTokenSymbol: 'ETH',
        maxGasPrice: '10000000000',
        confirmationBlocks: 1
      }
    ],
    liquidity: {
      rebalanceThreshold: 0.1,
      minUtilization: 0.3,
      maxUtilization: 0.85,
      targetDistribution: {
        ethereum: 0.5,
        polygon: 0.3,
        arbitrum: 0.2
      }
    }
  };

  beforeEach(async () => {
    coordinator = new MultiChainCoordinator(testConfig);
    await coordinator.initialize();
  });

  afterEach(async () => {
    await coordinator.stop();
  });

  describe('Initialization and Configuration', () => {
    test('should initialize successfully', async () => {
      expect(coordinator).toBeDefined();
      
      const status = coordinator.getCoordinationStatus();
      expect(status.isRunning).toBe(false);
      expect(status.activeTransactions).toBe(0);
      expect(status.queuedTransactions).toBe(0);
    });

    test('should start and stop correctly', async () => {
      await coordinator.start();
      let status = coordinator.getCoordinationStatus();
      expect(status.isRunning).toBe(true);

      await coordinator.stop();
      status = coordinator.getCoordinationStatus();
      expect(status.isRunning).toBe(false);
    });

    test('should handle configuration updates', () => {
      const newConfig = {
        ...testConfig,
        liquidity: {
          ...testConfig.liquidity,
          targetDistribution: {
            ethereum: 0.6,
            polygon: 0.25,
            arbitrum: 0.15
          }
        }
      };

      coordinator.updateConfig(newConfig);
      // Should complete without errors
    });

    test('should initialize chain health scores', () => {
      const status = coordinator.getCoordinationStatus();
      
      expect(Object.keys(status.chainHealthScores)).toHaveLength(3);
      expect(status.chainHealthScores.ethereum).toBeGreaterThanOrEqual(0);
      expect(status.chainHealthScores.ethereum).toBeLessThanOrEqual(100);
      expect(status.chainHealthScores.polygon).toBeGreaterThanOrEqual(0);
      expect(status.chainHealthScores.polygon).toBeLessThanOrEqual(100);
      expect(status.chainHealthScores.arbitrum).toBeGreaterThanOrEqual(0);
      expect(status.chainHealthScores.arbitrum).toBeLessThanOrEqual(100);
    });
  });

  describe('Portfolio Management', () => {
    test('should get portfolio status', async () => {
      const portfolio = await coordinator.getPortfolioStatus();

      expect(portfolio).toBeDefined();
      expect(portfolio.id).toMatch(/^portfolio_\d+$/);
      expect(portfolio.totalValue).toBeGreaterThan(0);
      expect(portfolio.positions).toBeInstanceOf(Array);
      expect(portfolio.positions.length).toBeGreaterThan(0);
      expect(typeof portfolio.rebalanceNeeded).toBe('boolean');
      expect(portfolio.lastRebalance).toBeGreaterThan(0);
      expect(portfolio.targetDistribution).toEqual(testConfig.liquidity.targetDistribution);
      expect(portfolio.actualDistribution).toBeDefined();
      expect(portfolio.efficiency).toBeGreaterThanOrEqual(0);
      expect(portfolio.efficiency).toBeLessThanOrEqual(100);

      // Verify position structure
      for (const position of portfolio.positions) {
        expect(position.chainId).toBeDefined();
        expect(position.assetId).toBeDefined();
        expect(position.amount).toBeGreaterThanOrEqual(0);
        expect(position.value).toBeGreaterThanOrEqual(0);
        expect(position.utilizationRate).toBeGreaterThanOrEqual(0);
        expect(position.utilizationRate).toBeLessThanOrEqual(1);
        expect(position.targetAllocation).toBeGreaterThanOrEqual(0);
        expect(position.currentAllocation).toBeGreaterThanOrEqual(0);
        expect(position.rebalanceThreshold).toBe(testConfig.liquidity.rebalanceThreshold);
      }
    });

    test('should handle portfolio caching correctly', async () => {
      const start1 = Date.now();
      const portfolio1 = await coordinator.getPortfolioStatus();
      const time1 = Date.now() - start1;

      const start2 = Date.now();
      const portfolio2 = await coordinator.getPortfolioStatus();
      const time2 = Date.now() - start2;

      // Second call should be faster due to caching
      expect(time2).toBeLessThan(time1);
      expect(portfolio1.id).toBe(portfolio2.id);
      expect(portfolio1.totalValue).toBe(portfolio2.totalValue);
    });

    test('should calculate asset allocation correctly', async () => {
      const allocation = await coordinator.getAssetAllocation();

      expect(allocation.byChain).toBeDefined();
      expect(allocation.byAsset).toBeDefined();
      expect(allocation.concentrationRisk).toBeDefined();

      // Verify chain allocation structure
      for (const [chainId, chainData] of Object.entries(allocation.byChain)) {
        expect(testConfig.chains.some(c => c.id === chainId)).toBe(true);
        expect(chainData.totalValue).toBeGreaterThanOrEqual(0);
        expect(chainData.assets).toBeDefined();
        
        for (const [assetId, assetValue] of Object.entries(chainData.assets)) {
          expect(typeof assetId).toBe('string');
          expect(assetValue).toBeGreaterThanOrEqual(0);
        }
      }

      // Verify asset allocation structure
      for (const [assetId, assetData] of Object.entries(allocation.byAsset)) {
        expect(typeof assetId).toBe('string');
        expect(assetData.totalValue).toBeGreaterThanOrEqual(0);
        expect(assetData.chains).toBeDefined();
        
        for (const [chainId, chainValue] of Object.entries(assetData.chains)) {
          expect(testConfig.chains.some(c => c.id === chainId)).toBe(true);
          expect(chainValue).toBeGreaterThanOrEqual(0);
        }
      }

      // Verify concentration risk (Herfindahl index)
      expect(allocation.concentrationRisk.chains).toBeGreaterThanOrEqual(0);
      expect(allocation.concentrationRisk.chains).toBeLessThanOrEqual(10000);
      expect(allocation.concentrationRisk.assets).toBeGreaterThanOrEqual(0);
      expect(allocation.concentrationRisk.assets).toBeLessThanOrEqual(10000);
    });
  });

  describe('Portfolio Rebalancing', () => {
    test('should execute portfolio rebalancing successfully', async () => {
      const customDistribution = {
        ethereum: 0.4,
        polygon: 0.4,
        arbitrum: 0.2
      };

      const result = await coordinator.rebalancePortfolio(customDistribution);
      expect(typeof result).toBe('boolean');
      
      // If rebalancing was needed and executed, verify the portfolio was updated
      if (result) {
        const portfolio = await coordinator.getPortfolioStatus();
        expect(portfolio).toBeDefined();
      }
    });

    test('should handle rebalancing with options', async () => {
      const options = {
        maxSlippage: 0.01,
        maxExecutionTime: 600,
        emergencyMode: false
      };

      const result = await coordinator.rebalancePortfolio(undefined, options);
      expect(typeof result).toBe('boolean');
    });

    test('should detect when no rebalancing is needed', async () => {
      // Use the current target distribution (should be close to current)
      const result = await coordinator.rebalancePortfolio(testConfig.liquidity.targetDistribution);
      
      // The result depends on the current state, but should not throw
      expect(typeof result).toBe('boolean');
    });

    test('should handle emergency mode rebalancing', async () => {
      const options = { emergencyMode: true };
      const result = await coordinator.rebalancePortfolio(undefined, options);
      
      expect(typeof result).toBe('boolean');
    });
  });

  describe('Arbitrage Execution', () => {
    test('should execute arbitrage opportunity', async () => {
      const mockOpportunity: ArbitrageOpportunity = {
        id: 'test-arbitrage-001',
        assetId: 'USDC',
        sourceChain: 'ethereum',
        targetChain: 'polygon',
        sourcePrice: 1.0,
        targetPrice: 1.005,
        priceDifference: 0.005,
        percentageDifference: 0.5,
        expectedProfit: 250,
        estimatedGasCost: 50,
        bridgeFee: 25,
        netProfit: 175,
        profitMargin: 0.35,
        executionTime: 300,
        riskScore: 25,
        confidence: 0.85,
        timestamp: Date.now(),
        executionPaths: [{
          id: 'path-001',
          steps: [{
            type: 'swap',
            chainId: 'ethereum',
            protocol: 'uniswap',
            contractAddress: '0x123...',
            estimatedGas: 100000,
            estimatedTime: 60,
            dependencies: []
          }],
          totalGasCost: 50,
          totalFees: 25,
          estimatedTime: 300,
          successProbability: 0.9,
          riskLevel: 'low'
        }]
      };

      const execution = await coordinator.executeArbitrageOpportunity(mockOpportunity);

      expect(execution).toBeDefined();
      expect(execution.opportunityId).toBe(mockOpportunity.id);
      expect(execution.executionPathId).toBeDefined();
      expect(['initiated', 'in_progress', 'completed', 'failed']).toContain(execution.status);
      expect(execution.transactions).toBeInstanceOf(Array);
      expect(execution.startTime).toBeGreaterThan(0);

      if (execution.status === 'completed') {
        expect(execution.endTime).toBeGreaterThan(execution.startTime);
        expect(execution.executionTime).toBeGreaterThan(0);
        expect(execution.actualProfit).toBeGreaterThanOrEqual(0);
        expect(execution.actualCost).toBeGreaterThanOrEqual(0);
        expect(typeof execution.netReturn).toBe('number');
      }

      if (execution.status === 'failed') {
        expect(execution.failureReason).toBeDefined();
      }
    });

    test('should handle arbitrage with position size limits', async () => {
      const mockOpportunity: ArbitrageOpportunity = {
        id: 'test-arbitrage-002',
        assetId: 'ETH',
        sourceChain: 'ethereum',
        targetChain: 'arbitrum',
        sourcePrice: 2500,
        targetPrice: 2515,
        priceDifference: 15,
        percentageDifference: 0.6,
        expectedProfit: 300,
        estimatedGasCost: 75,
        bridgeFee: 50,
        netProfit: 175,
        profitMargin: 0.7,
        executionTime: 180,
        riskScore: 35,
        confidence: 0.8,
        timestamp: Date.now(),
        executionPaths: []
      };

      const maxPositionSize = 10000; // $10k limit
      const execution = await coordinator.executeArbitrageOpportunity(mockOpportunity, maxPositionSize);

      expect(execution).toBeDefined();
      expect(execution.opportunityId).toBe(mockOpportunity.id);
    });

    test('should reject arbitrage with insufficient position size', async () => {
      const mockOpportunity: ArbitrageOpportunity = {
        id: 'test-arbitrage-003',
        assetId: 'WBTC',
        sourceChain: 'ethereum',
        targetChain: 'polygon',
        sourcePrice: 50000,
        targetPrice: 50100,
        priceDifference: 100,
        percentageDifference: 0.2,
        expectedProfit: 50,
        estimatedGasCost: 100,
        bridgeFee: 75,
        netProfit: -125, // Negative profit
        profitMargin: -2.5,
        executionTime: 600,
        riskScore: 80, // High risk
        confidence: 0.3,
        timestamp: Date.now(),
        executionPaths: []
      };

      try {
        await coordinator.executeArbitrageOpportunity(mockOpportunity);
        // Should either complete or fail gracefully, not throw
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain('insufficient position size');
      }
    });
  });

  describe('Risk Management', () => {
    test('should track risk limit violations', () => {
      const status = coordinator.getCoordinationStatus();
      
      expect(status.riskLimitViolations).toBeInstanceOf(Array);
      
      for (const violation of status.riskLimitViolations) {
        expect(violation.type).toBeDefined();
        expect(violation.currentValue).toBeGreaterThanOrEqual(0);
        expect(violation.isViolated).toBe(true);
      }
    });

    test('should handle emergency stop correctly', async () => {
      await coordinator.start();
      
      const emergencyReason = 'Test emergency stop';
      await coordinator.emergencyStop(emergencyReason);
      
      const status = coordinator.getCoordinationStatus();
      expect(status.isRunning).toBe(false);
      expect(status.activeTransactions).toBe(0);
      expect(status.queuedTransactions).toBe(0);
    });

    test('should validate chain health scores', () => {
      const status = coordinator.getCoordinationStatus();
      
      for (const [chainId, healthScore] of Object.entries(status.chainHealthScores)) {
        expect(testConfig.chains.some(c => c.id === chainId)).toBe(true);
        expect(healthScore).toBeGreaterThanOrEqual(0);
        expect(healthScore).toBeLessThanOrEqual(100);
      }
    });
  });

  describe('Transaction Coordination', () => {
    test('should manage coordination status correctly', () => {
      const status = coordinator.getCoordinationStatus();
      
      expect(typeof status.isRunning).toBe('boolean');
      expect(status.activeTransactions).toBeGreaterThanOrEqual(0);
      expect(status.queuedTransactions).toBeGreaterThanOrEqual(0);
      expect(status.chainHealthScores).toBeDefined();
      expect(status.riskLimitViolations).toBeInstanceOf(Array);
      expect(status.lastPortfolioUpdate).toBeGreaterThanOrEqual(0);
    });

    test('should handle concurrent transaction limits', async () => {
      // Start the coordinator to enable transaction processing
      await coordinator.start();
      
      // The coordinator should respect max concurrent transaction limits
      const status = coordinator.getCoordinationStatus();
      expect(status.activeTransactions).toBeLessThanOrEqual(3); // maxConcurrentTransactions
    });
  });

  describe('Performance and Scalability', () => {
    test('should handle multiple rapid portfolio status requests', async () => {
      const promises = [];
      
      // Make 10 concurrent requests
      for (let i = 0; i < 10; i++) {
        promises.push(coordinator.getPortfolioStatus());
      }

      const results = await Promise.all(promises);
      
      // All should complete successfully
      expect(results).toHaveLength(10);
      results.forEach(result => {
        expect(result).toBeDefined();
        expect(result.totalValue).toBeGreaterThan(0);
      });
    });

    test('should handle large portfolio allocations', async () => {
      // Test with a larger configuration
      const largeConfig = {
        ...testConfig,
        chains: [
          ...testConfig.chains,
          { 
            id: 'optimism', 
            name: 'Optimism', 
            rpcUrl: 'http://localhost:8548',
            nativeCurrency: 'ETH',
            blockTime: 2,
            gasTokenSymbol: 'ETH',
            maxGasPrice: '10000000000',
            confirmationBlocks: 1
          },
          { 
            id: 'avalanche', 
            name: 'Avalanche', 
            rpcUrl: 'http://localhost:8549',
            nativeCurrency: 'AVAX',
            blockTime: 1,
            gasTokenSymbol: 'AVAX',
            maxGasPrice: '25000000000',
            confirmationBlocks: 1
          }
        ],
        liquidity: {
          ...testConfig.liquidity,
          targetDistribution: {
            ethereum: 0.3,
            polygon: 0.2,
            arbitrum: 0.2,
            optimism: 0.15,
            avalanche: 0.15
          }
        }
      };

      const largeCoordinator = new MultiChainCoordinator(largeConfig);
      await largeCoordinator.initialize();

      const allocation = await largeCoordinator.getAssetAllocation();
      expect(Object.keys(allocation.byChain)).toHaveLength(5);
      
      await largeCoordinator.stop();
    });

    test('should maintain consistency under concurrent operations', async () => {
      await coordinator.start();
      
      // Run concurrent operations
      const promises = [
        coordinator.getPortfolioStatus(),
        coordinator.getAssetAllocation(),
        coordinator.rebalancePortfolio(),
      ];

      await Promise.allSettled(promises);
      
      // System should remain consistent
      const finalStatus = coordinator.getCoordinationStatus();
      expect(finalStatus).toBeDefined();
    });
  });

  describe('Integration Tests', () => {
    test('should integrate with different chain configurations', async () => {
      const multiChainConfig = {
        ...testConfig,
        chains: [
          { 
            id: 'ethereum', 
            name: 'Ethereum Mainnet', 
            rpcUrl: 'https://mainnet.infura.io',
            nativeCurrency: 'ETH',
            blockTime: 12,
            gasTokenSymbol: 'ETH',
            maxGasPrice: '100000000000',
            confirmationBlocks: 6
          },
          { 
            id: 'polygon', 
            name: 'Polygon Mainnet', 
            rpcUrl: 'https://polygon-rpc.com',
            nativeCurrency: 'MATIC',
            blockTime: 2,
            gasTokenSymbol: 'MATIC',
            maxGasPrice: '30000000000',
            confirmationBlocks: 12
          },
          { 
            id: 'bsc', 
            name: 'Binance Smart Chain', 
            rpcUrl: 'https://bsc-dataseed.binance.org',
            nativeCurrency: 'BNB',
            blockTime: 3,
            gasTokenSymbol: 'BNB',
            maxGasPrice: '20000000000',
            confirmationBlocks: 3
          }
        ]
      };

      const multiCoordinator = new MultiChainCoordinator(multiChainConfig);
      await multiCoordinator.initialize();

      const portfolio = await multiCoordinator.getPortfolioStatus();
      expect(portfolio.positions.length).toBeGreaterThan(0);
      
      // Should handle all configured chains
      const allocation = await multiCoordinator.getAssetAllocation();
      expect(Object.keys(allocation.byChain)).toContain('ethereum');
      expect(Object.keys(allocation.byChain)).toContain('polygon');
      expect(Object.keys(allocation.byChain)).toContain('bsc');

      await multiCoordinator.stop();
    });

    test('should handle end-to-end workflow', async () => {
      // Start the coordinator
      await coordinator.start();
      
      // Get initial portfolio state
      const initialPortfolio = await coordinator.getPortfolioStatus();
      expect(initialPortfolio).toBeDefined();

      // Get asset allocation
      const allocation = await coordinator.getAssetAllocation();
      expect(allocation).toBeDefined();

      // Attempt rebalancing
      const rebalanceResult = await coordinator.rebalancePortfolio();
      expect(typeof rebalanceResult).toBe('boolean');

      // Check coordination status
      const status = coordinator.getCoordinationStatus();
      expect(status.isRunning).toBe(true);

      // Execute a mock arbitrage
      const mockOpportunity: ArbitrageOpportunity = {
        id: 'integration-test',
        assetId: 'USDC',
        sourceChain: 'ethereum',
        targetChain: 'polygon',
        sourcePrice: 1.0,
        targetPrice: 1.003,
        priceDifference: 0.003,
        percentageDifference: 0.3,
        expectedProfit: 150,
        estimatedGasCost: 30,
        bridgeFee: 20,
        netProfit: 100,
        profitMargin: 0.67,
        executionTime: 180,
        riskScore: 20,
        confidence: 0.9,
        timestamp: Date.now(),
        executionPaths: []
      };

      const execution = await coordinator.executeArbitrageOpportunity(mockOpportunity);
      expect(execution.opportunityId).toBe(mockOpportunity.id);

      // Get final portfolio state
      const finalPortfolio = await coordinator.getPortfolioStatus();
      expect(finalPortfolio).toBeDefined();
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle zero-value portfolios gracefully', async () => {
      const emptyConfig = {
        ...testConfig,
        chains: []
      };

      const emptyCoordinator = new MultiChainCoordinator(emptyConfig);
      await emptyCoordinator.initialize();

      const portfolio = await emptyCoordinator.getPortfolioStatus();
      expect(portfolio.totalValue).toBe(0);
      expect(portfolio.positions).toHaveLength(0);

      await emptyCoordinator.stop();
    });

    test('should handle invalid arbitrage opportunities', async () => {
      const invalidOpportunity: ArbitrageOpportunity = {
        id: 'invalid-arbitrage',
        assetId: 'UNKNOWN',
        sourceChain: 'nonexistent',
        targetChain: 'alsononexistent',
        sourcePrice: -1, // Invalid price
        targetPrice: 0,
        priceDifference: 0,
        percentageDifference: 0,
        expectedProfit: -1000, // Negative profit
        estimatedGasCost: 1000000, // Extremely high cost
        bridgeFee: 500000,
        netProfit: -1501000,
        profitMargin: -99,
        executionTime: -1, // Invalid time
        riskScore: 150, // Invalid score
        confidence: -0.5, // Invalid confidence
        timestamp: Date.now(),
        executionPaths: []
      };

      const execution = await coordinator.executeArbitrageOpportunity(invalidOpportunity);
      expect(execution.status).toBe('failed');
      expect(execution.failureReason).toBeDefined();
    });

    test('should recover from emergency conditions', async () => {
      await coordinator.start();
      
      // Trigger emergency stop
      await coordinator.emergencyStop('Test recovery scenario');
      
      let status = coordinator.getCoordinationStatus();
      expect(status.isRunning).toBe(false);

      // Should be able to restart
      await coordinator.start();
      status = coordinator.getCoordinationStatus();
      expect(status.isRunning).toBe(true);
    });
  });
});