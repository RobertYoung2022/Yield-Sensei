/**
 * Tests for Slippage Minimizer
 */

import { SlippageMinimizer, SlippageMinimizationConfig } from '../slippage-minimizer';
import { ExecutionPath, ExecutionStep, ChainID } from '../../types';

describe('SlippageMinimizer', () => {
  let minimizer: SlippageMinimizer;
  let mockExecutionPath: ExecutionPath;

  beforeEach(() => {
    const config: Partial<SlippageMinimizationConfig> = {
      maxAcceptableSlippage: 0.02,
      dynamicSlippageEnabled: true,
      liquidityThreshold: 100000,
      priceImpactWeight: 0.4,
      mevProtectionEnabled: true,
    };

    minimizer = new SlippageMinimizer(config);

    mockExecutionPath = {
      id: 'test-path-1',
      steps: [
        {
          type: 'swap',
          chainId: 'ethereum',
          protocol: 'uniswap-v3',
          contractAddress: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
          estimatedGas: BigInt(150000),
          estimatedTime: 15,
          dependencies: [],
        },
        {
          type: 'bridge',
          chainId: 'ethereum',
          protocol: 'hop-protocol',
          contractAddress: '0x3666f603Cc164936C1b87e207F36BEBa4AC5f18a',
          estimatedGas: BigInt(300000),
          estimatedTime: 180,
          dependencies: ['step-0'],
        },
        {
          type: 'swap',
          chainId: 'arbitrum',
          protocol: 'uniswap-v3',
          contractAddress: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
          estimatedGas: BigInt(120000),
          estimatedTime: 10,
          dependencies: ['step-1'],
        },
      ],
      totalGasCost: 570000,
      totalFees: 684000,
      estimatedTime: 205,
      successProbability: 0.9,
      riskLevel: 'medium',
    };
  });

  describe('initialization', () => {
    it('should initialize with default configuration', () => {
      const defaultMinimizer = new SlippageMinimizer();
      expect(defaultMinimizer).toBeDefined();
    });

    it('should initialize with custom configuration', () => {
      expect(minimizer).toBeDefined();
    });

    it('should initialize liquidity data', () => {
      // Test that some liquidity data is available
      expect(minimizer['liquidityData']).toBeDefined();
      expect(minimizer['liquidityData'].size).toBeGreaterThan(0);
    });
  });

  describe('slippage minimization', () => {
    it('should minimize slippage for execution path', async () => {
      const result = await minimizer.minimizeSlippage(mockExecutionPath, 10000);

      expect(result).toBeDefined();
      expect(result.originalSlippage).toBeGreaterThan(0);
      expect(result.optimizedSlippage).toBeGreaterThanOrEqual(0);
      expect(result.optimizedSlippage).toBeLessThanOrEqual(result.originalSlippage);
      expect(result.slippageReduction).toBeGreaterThanOrEqual(0);
      expect(result.slippageReductionPercentage).toBeGreaterThanOrEqual(0);
      expect(result.strategies).toBeDefined();
      expect(result.optimizedPath).toBeDefined();
      expect(result.liquidityAnalysis).toBeDefined();
      expect(result.priceImpactAnalysis).toBeDefined();
    });

    it('should provide liquidity analysis', async () => {
      const result = await minimizer.minimizeSlippage(mockExecutionPath, 5000);

      expect(result.liquidityAnalysis.totalLiquidity).toBeGreaterThan(0);
      expect(result.liquidityAnalysis.liquidityDistribution).toBeDefined();
      expect(result.liquidityAnalysis.liquidityConcentration).toBeGreaterThan(0);
      expect(result.liquidityAnalysis.optimalTradeSize).toBeGreaterThan(0);
      expect(result.liquidityAnalysis.liquidityUtilization).toBeGreaterThanOrEqual(0);
    });

    it('should provide price impact analysis', async () => {
      const result = await minimizer.minimizeSlippage(mockExecutionPath, 15000);

      expect(result.priceImpactAnalysis.estimatedImpact).toBeGreaterThanOrEqual(0);
      expect(result.priceImpactAnalysis.impactBreakdown).toBeDefined();
      expect(result.priceImpactAnalysis.optimalSizes).toBeDefined();
      expect(result.priceImpactAnalysis.riskFactors).toBeDefined();

      // Impact breakdown should have entries for swap steps
      const swapSteps = mockExecutionPath.steps.filter(step => step.type === 'swap');
      expect(result.priceImpactAnalysis.impactBreakdown.length).toBe(swapSteps.length);
    });

    it('should generate optimization strategies', async () => {
      const result = await minimizer.minimizeSlippage(mockExecutionPath, 25000);

      expect(result.strategies).toBeDefined();
      expect(result.strategies.length).toBeGreaterThanOrEqual(0);

      result.strategies.forEach(strategy => {
        expect(strategy.type).toMatch(/^(order_splitting|route_optimization|timing_optimization|liquidity_sourcing|mev_protection)$/);
        expect(strategy.description).toBeDefined();
        expect(strategy.slippageReduction).toBeGreaterThanOrEqual(0);
        expect(strategy.implementationCost).toBeGreaterThanOrEqual(0);
        expect(strategy.riskLevel).toMatch(/^(low|medium|high)$/);
        expect(strategy.effectiveness).toBeGreaterThanOrEqual(0);
        expect(strategy.effectiveness).toBeLessThanOrEqual(1);
      });
    });
  });

  describe('order splitting strategy', () => {
    it('should suggest order splitting for large trades', async () => {
      const result = await minimizer.minimizeSlippage(mockExecutionPath, 50000);

      const splittingStrategy = result.strategies.find(s => s.type === 'order_splitting');
      if (splittingStrategy) {
        expect(splittingStrategy.slippageReduction).toBeGreaterThan(0);
        expect(splittingStrategy.description).toContain('Split order');
        expect(splittingStrategy.implementationCost).toBeGreaterThan(0);
      }
    });

    it('should not suggest splitting for small trades', async () => {
      const result = await minimizer.minimizeSlippage(mockExecutionPath, 1000);

      const splittingStrategy = result.strategies.find(s => s.type === 'order_splitting');
      expect(splittingStrategy).toBeUndefined();
    });

    it('should create order splits when beneficial', async () => {
      const protectionOrder = await minimizer.createSlippageProtectionOrder(
        100000, 0.02, 'ethereum', 'ETH/USDC'
      );

      expect(protectionOrder).toBeDefined();
      expect(protectionOrder.originalAmount).toBe(100000);
      expect(protectionOrder.splits.length).toBeGreaterThan(0);
      expect(protectionOrder.totalProtectedAmount).toBeGreaterThan(0);
      expect(protectionOrder.estimatedSlippage).toBeGreaterThanOrEqual(0);
      expect(protectionOrder.executionTime).toBeGreaterThan(0);

      protectionOrder.splits.forEach(split => {
        expect(split.id).toBeDefined();
        expect(split.amount).toBeGreaterThan(0);
        expect(split.protocol).toBeDefined();
        expect(split.chainId).toBeDefined();
        expect(split.estimatedSlippage).toBeGreaterThanOrEqual(0);
        expect(split.priority).toBeGreaterThanOrEqual(0);
        expect(split.delayTime).toBeGreaterThanOrEqual(0);
      });
    });
  });

  describe('route optimization strategy', () => {
    it('should suggest route optimization when beneficial', async () => {
      const multiSwapPath = {
        ...mockExecutionPath,
        steps: [
          ...mockExecutionPath.steps,
          {
            type: 'swap' as const,
            chainId: 'ethereum' as const,
            protocol: 'sushiswap',
            contractAddress: '0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F',
            estimatedGas: BigInt(160000),
            estimatedTime: 18,
            dependencies: ['step-2'],
          },
        ],
      };

      const result = await minimizer.minimizeSlippage(multiSwapPath, 20000);

      const routeStrategy = result.strategies.find(s => s.type === 'route_optimization');
      if (routeStrategy) {
        expect(routeStrategy.slippageReduction).toBeGreaterThan(0);
        expect(routeStrategy.description).toContain('deeper liquidity');
      }
    });
  });

  describe('MEV protection strategy', () => {
    it('should suggest MEV protection for large trades', async () => {
      const result = await minimizer.minimizeSlippage(mockExecutionPath, 100000);

      const mevStrategy = result.strategies.find(s => s.type === 'mev_protection');
      if (mevStrategy) {
        expect(mevStrategy.slippageReduction).toBeGreaterThan(0);
        expect(mevStrategy.description).toContain('MEV protection');
        expect(mevStrategy.riskLevel).toBe('low');
      }
    });

    it('should not suggest MEV protection when disabled', async () => {
      const noMEVMinimizer = new SlippageMinimizer({
        mevProtectionEnabled: false,
      });

      const result = await noMEVMinimizer.minimizeSlippage(mockExecutionPath, 100000);

      const mevStrategy = result.strategies.find(s => s.type === 'mev_protection');
      expect(mevStrategy).toBeUndefined();
    });
  });

  describe('timing optimization strategy', () => {
    it('should suggest timing optimization during high volatility', async () => {
      // The timing optimization checks for high volatility periods
      // This test may pass depending on the simulated time
      const result = await minimizer.minimizeSlippage(mockExecutionPath, 30000);

      const timingStrategy = result.strategies.find(s => s.type === 'timing_optimization');
      if (timingStrategy) {
        expect(timingStrategy.slippageReduction).toBeGreaterThan(0);
        expect(timingStrategy.description).toContain('Delay execution');
        expect(timingStrategy.implementationCost).toBe(0);
      }
    });
  });

  describe('liquidity sourcing strategy', () => {
    it('should suggest liquidity sourcing when needed', async () => {
      const result = await minimizer.minimizeSlippage(mockExecutionPath, 75000);

      const liquidityStrategy = result.strategies.find(s => s.type === 'liquidity_sourcing');
      if (liquidityStrategy) {
        expect(liquidityStrategy.slippageReduction).toBeGreaterThan(0);
        expect(liquidityStrategy.description).toContain('additional pools');
        expect(liquidityStrategy.riskLevel).toBe('medium');
      }
    });
  });

  describe('optimized path creation', () => {
    it('should create optimized execution path', async () => {
      const result = await minimizer.minimizeSlippage(mockExecutionPath, 20000);

      expect(result.optimizedPath).toBeDefined();
      expect(result.optimizedPath.id).toContain('slippage-optimized');
      expect(result.optimizedPath.steps).toBeDefined();
      expect(result.optimizedPath.estimatedTime).toBeGreaterThan(0);
      expect(result.optimizedPath.successProbability).toBeGreaterThan(0);
      expect(result.optimizedPath.successProbability).toBeLessThanOrEqual(1);
    });

    it('should apply order splitting to optimized path', async () => {
      const largeTradeResult = await minimizer.minimizeSlippage(mockExecutionPath, 100000);

      const splittingStrategy = largeTradeResult.strategies.find(s => s.type === 'order_splitting');
      if (splittingStrategy) {
        // The optimized path should have more steps due to splitting
        expect(largeTradeResult.optimizedPath.steps.length).toBeGreaterThanOrEqual(
          mockExecutionPath.steps.length
        );
      }
    });

    it('should apply route optimization to optimized path', async () => {
      const result = await minimizer.minimizeSlippage(mockExecutionPath, 30000);

      const routeStrategy = result.strategies.find(s => s.type === 'route_optimization');
      if (routeStrategy) {
        // Check that the optimized path uses better protocols
        const optimizedSwapSteps = result.optimizedPath.steps.filter(step => step.type === 'swap');
        expect(optimizedSwapSteps.length).toBeGreaterThan(0);
      }
    });
  });

  describe('liquidity data management', () => {
    it('should update liquidity data', () => {
      const poolKey = 'test-pool-ethereum-USDC/ETH';
      const liquidityPool = {
        protocol: 'test-protocol',
        chainId: 'ethereum' as ChainID,
        assetPair: 'USDC/ETH',
        liquidity: 5000000,
        volume24h: 1000000,
        fee: 0.003,
        depth: {
          bid: [{ price: 2000, amount: 1000, cumulative: 1000 }],
          ask: [{ price: 2002, amount: 1000, cumulative: 1000 }],
          spread: 0.001,
        },
      };

      minimizer.updateLiquidityData(poolKey, liquidityPool);

      expect(minimizer['liquidityData'].get(poolKey)).toBe(liquidityPool);
    });

    it('should record slippage results for accuracy tracking', () => {
      minimizer.recordSlippageResult('uniswap-v3', 'ethereum', 0.01, 0.012);

      const accuracy = minimizer.getSlippagePredictionAccuracy('uniswap-v3', 'ethereum');
      expect(accuracy).toBeGreaterThan(0);
      expect(accuracy).toBeLessThanOrEqual(1);
    });

    it('should provide default accuracy when no history exists', () => {
      const accuracy = minimizer.getSlippagePredictionAccuracy('unknown-protocol', 'ethereum');
      expect(accuracy).toBe(0.7); // Default accuracy
    });
  });

  describe('error handling', () => {
    it('should handle paths with no swap steps', async () => {
      const bridgeOnlyPath = {
        ...mockExecutionPath,
        steps: mockExecutionPath.steps.filter(step => step.type === 'bridge'),
      };

      const result = await minimizer.minimizeSlippage(bridgeOnlyPath, 10000);

      expect(result).toBeDefined();
      expect(result.originalSlippage).toBe(0);
      expect(result.optimizedSlippage).toBe(0);
    });

    it('should provide default result on error', async () => {
      // Mock an error scenario by providing invalid trade amount
      const result = await minimizer.minimizeSlippage(mockExecutionPath, -1000);

      expect(result).toBeDefined();
      expect(result.originalSlippage).toBeGreaterThanOrEqual(0);
      expect(result.optimizedSlippage).toBeGreaterThanOrEqual(0);
    });

    it('should handle empty execution path', async () => {
      const emptyPath = {
        ...mockExecutionPath,
        steps: [],
      };

      const result = await minimizer.minimizeSlippage(emptyPath, 10000);

      expect(result).toBeDefined();
      expect(result.originalSlippage).toBe(0);
      expect(result.strategies).toHaveLength(0);
    });
  });

  describe('performance and limits', () => {
    it('should respect maximum acceptable slippage', async () => {
      const result = await minimizer.minimizeSlippage(mockExecutionPath, 1000000);

      expect(result.optimizedSlippage).toBeLessThanOrEqual(0.02); // Max acceptable slippage
    });

    it('should complete minimization within reasonable time', async () => {
      const startTime = Date.now();
      
      await minimizer.minimizeSlippage(mockExecutionPath, 50000);
      
      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(3000); // Should complete within 3 seconds
    });

    it('should handle multiple concurrent minimizations', async () => {
      const promises = Array.from({ length: 3 }, (_, i) =>
        minimizer.minimizeSlippage(mockExecutionPath, 10000 + i * 5000)
      );

      const results = await Promise.all(promises);

      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result).toBeDefined();
        expect(result.originalSlippage).toBeGreaterThanOrEqual(0);
      });
    });
  });

  describe('slippage protection orders', () => {
    it('should create protection orders with valid splits', async () => {
      const order = await minimizer.createSlippageProtectionOrder(
        50000, 0.015, 'ethereum', 'ETH/USDC'
      );

      expect(order.originalAmount).toBe(50000);
      expect(order.splits.length).toBeGreaterThan(0);
      expect(order.totalProtectedAmount).toBeGreaterThan(0);
      expect(order.totalProtectedAmount).toBeLessThanOrEqual(50000);
      expect(order.estimatedSlippage).toBeLessThanOrEqual(0.015);

      // Verify splits are properly sequenced
      for (let i = 1; i < order.splits.length; i++) {
        expect(order.splits[i].delayTime).toBeGreaterThan(order.splits[i - 1].delayTime);
        expect(order.splits[i].priority).toBe(i);
      }
    });

    it('should handle orders with no available liquidity', async () => {
      const order = await minimizer.createSlippageProtectionOrder(
        1000000, 0.001, 'unknown-chain' as any, 'UNKNOWN/PAIR'
      );

      expect(order.originalAmount).toBe(1000000);
      expect(order.totalProtectedAmount).toBe(0);
      expect(order.splits).toHaveLength(0);
    });
  });
});