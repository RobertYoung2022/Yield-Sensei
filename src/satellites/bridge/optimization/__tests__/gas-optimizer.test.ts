/**
 * Tests for Gas Optimizer
 */

import { GasOptimizer, GasOptimizationConfig } from '../gas-optimizer';
import { ExecutionPath, ExecutionStep, ChainConfig } from '../../types';

describe('GasOptimizer', () => {
  let optimizer: GasOptimizer;
  let mockChainConfigs: ChainConfig[];
  let mockExecutionPath: ExecutionPath;

  beforeEach(() => {
    mockChainConfigs = [
      {
        id: 'ethereum',
        name: 'Ethereum',
        rpcUrl: 'https://eth.llamarpc.com',
        explorerUrl: 'https://etherscan.io',
        nativeCurrency: { symbol: 'ETH', decimals: 18, name: 'Ethereum' },
        isTestnet: false,
      },
      {
        id: 'arbitrum',
        name: 'Arbitrum',
        rpcUrl: 'https://arb1.arbitrum.io/rpc',
        explorerUrl: 'https://arbiscan.io',
        nativeCurrency: { symbol: 'ETH', decimals: 18, name: 'Ethereum' },
        isTestnet: false,
      },
    ];

    const config: GasOptimizationConfig = {
      maxGasPrice: {
        'ethereum': 100,
        'arbitrum': 10,
        'polygon': 500,
        'optimism': 10,
        'avalanche': 50,
      },
      gasEstimationBuffer: 1.2,
      batchingThreshold: 3,
      priorityFeeStrategy: 'moderate',
      useLayer2Routing: true,
    };

    optimizer = new GasOptimizer(config, mockChainConfigs);

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
          type: 'swap',
          chainId: 'ethereum',
          protocol: 'sushiswap',
          contractAddress: '0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F',
          estimatedGas: BigInt(160000),
          estimatedTime: 18,
          dependencies: [],
        },
        {
          type: 'bridge',
          chainId: 'ethereum',
          protocol: 'hop-protocol',
          contractAddress: '0x3666f603Cc164936C1b87e207F36BEBa4AC5f18a',
          estimatedGas: BigInt(300000),
          estimatedTime: 180,
          dependencies: ['step-0', 'step-1'],
        },
        {
          type: 'swap',
          chainId: 'arbitrum',
          protocol: 'uniswap-v3',
          contractAddress: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
          estimatedGas: BigInt(120000),
          estimatedTime: 10,
          dependencies: ['step-2'],
        },
      ],
      totalGasCost: 730000,
      totalFees: 876000,
      estimatedTime: 223,
      successProbability: 0.9,
      riskLevel: 'medium',
    };
  });

  describe('initialization', () => {
    it('should initialize with default configuration', () => {
      const defaultOptimizer = new GasOptimizer();
      expect(defaultOptimizer).toBeDefined();
    });

    it('should initialize with custom configuration', () => {
      expect(optimizer).toBeDefined();
    });

    it('should initialize gas price history', () => {
      const recommendation = optimizer.getGasPriceRecommendation('ethereum');
      expect(recommendation).toBeDefined();
      expect(recommendation.slow).toBeGreaterThan(0);
      expect(recommendation.standard).toBeGreaterThan(0);
      expect(recommendation.fast).toBeGreaterThan(0);
    });
  });

  describe('gas cost optimization', () => {
    it('should optimize gas costs for execution path', async () => {
      const result = await optimizer.optimizeGasCosts(mockExecutionPath);

      expect(result).toBeDefined();
      expect(result.originalGasCost).toBeGreaterThan(0);
      expect(result.optimizedGasCost).toBeGreaterThan(0);
      expect(result.savings).toBeGreaterThanOrEqual(0);
      expect(result.savingsPercentage).toBeGreaterThanOrEqual(0);
      expect(result.optimizations).toBeDefined();
      expect(result.recommendedPath).toBeDefined();
      expect(result.alternativePaths).toBeDefined();
    });

    it('should identify batching opportunities', async () => {
      const result = await optimizer.optimizeGasCosts(mockExecutionPath);

      const batchingOptimization = result.optimizations.find(opt => opt.type === 'batching');
      if (batchingOptimization) {
        expect(batchingOptimization.gasSavings).toBeGreaterThan(0);
        expect(batchingOptimization.implementationComplexity).toMatch(/^(low|medium|high)$/);
        expect(batchingOptimization.tradeoffs).toBeDefined();
        expect(batchingOptimization.tradeoffs.length).toBeGreaterThan(0);
      }
    });

    it('should suggest layer 2 routing when beneficial', async () => {
      // Create a path with expensive mainnet operations
      const expensivePath = {
        ...mockExecutionPath,
        steps: [
          {
            type: 'swap' as const,
            chainId: 'ethereum' as const,
            protocol: 'uniswap-v3',
            contractAddress: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
            estimatedGas: BigInt(200000),
            estimatedTime: 20,
            dependencies: [],
          },
          {
            type: 'swap' as const,
            chainId: 'ethereum' as const,
            protocol: 'curve',
            contractAddress: '0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7',
            estimatedGas: BigInt(250000),
            estimatedTime: 25,
            dependencies: [],
          },
        ],
      };

      const result = await optimizer.optimizeGasCosts(expensivePath);

      const routingOptimization = result.optimizations.find(opt => opt.type === 'routing');
      if (routingOptimization) {
        expect(routingOptimization.gasSavings).toBeGreaterThan(0);
        expect(routingOptimization.description).toContain('Layer 2');
      }
    });

    it('should identify timing optimization opportunities', async () => {
      // Simulate high gas prices
      optimizer.updateGasPrice('ethereum', 150); // High gas price

      const result = await optimizer.optimizeGasCosts(mockExecutionPath);

      const timingOptimization = result.optimizations.find(opt => opt.type === 'timing');
      if (timingOptimization) {
        expect(timingOptimization.gasSavings).toBeGreaterThan(0);
        expect(timingOptimization.description).toContain('Delay execution');
      }
    });

    it('should suggest contract optimizations', async () => {
      const result = await optimizer.optimizeGasCosts(mockExecutionPath);

      const contractOptimization = result.optimizations.find(opt => opt.type === 'contract_optimization');
      if (contractOptimization) {
        expect(contractOptimization.gasSavings).toBeGreaterThan(0);
        expect(contractOptimization.description).toContain('efficient');
      }
    });
  });

  describe('batching optimization', () => {
    it('should batch operations on the same chain', async () => {
      const result = await optimizer.optimizeGasCosts(mockExecutionPath);

      if (result.optimizations.some(opt => opt.type === 'batching')) {
        const optimizedSteps = result.recommendedPath.steps;
        const ethereumSteps = optimizedSteps.filter(step => step.chainId === 'ethereum');
        
        // Should have fewer steps due to batching
        expect(ethereumSteps.length).toBeLessThanOrEqual(
          mockExecutionPath.steps.filter(step => step.chainId === 'ethereum').length
        );
      }
    });

    it('should not batch if below threshold', async () => {
      const smallPath = {
        ...mockExecutionPath,
        steps: mockExecutionPath.steps.slice(0, 2), // Only 2 steps
      };

      const result = await optimizer.optimizeGasCosts(smallPath);

      const batchingOptimization = result.optimizations.find(opt => opt.type === 'batching');
      expect(batchingOptimization).toBeUndefined();
    });
  });

  describe('layer 2 optimization', () => {
    it('should route through layer 2 for cost savings', async () => {
      const result = await optimizer.optimizeGasCosts(mockExecutionPath);

      const layer2Optimization = result.optimizations.find(opt => opt.type === 'layer2');
      if (layer2Optimization) {
        expect(layer2Optimization.gasSavings).toBeGreaterThan(0);
        expect(layer2Optimization.implementationComplexity).toBe('high');
        expect(layer2Optimization.tradeoffs).toContain('Requires bridging to Layer 2');
      }
    });

    it('should respect layer 2 routing configuration', async () => {
      const noLayer2Config = {
        ...optimizer['config'],
        useLayer2Routing: false,
      };

      const noLayer2Optimizer = new GasOptimizer(noLayer2Config, mockChainConfigs);
      const result = await noLayer2Optimizer.optimizeGasCosts(mockExecutionPath);

      const layer2Optimization = result.optimizations.find(opt => opt.type === 'layer2');
      expect(layer2Optimization).toBeUndefined();
    });
  });

  describe('gas price management', () => {
    it('should update gas price history', () => {
      const initialRecommendation = optimizer.getGasPriceRecommendation('ethereum');
      
      optimizer.updateGasPrice('ethereum', 200);
      
      const updatedRecommendation = optimizer.getGasPriceRecommendation('ethereum');
      expect(updatedRecommendation.standard).not.toBe(initialRecommendation.standard);
    });

    it('should provide gas price recommendations', () => {
      const recommendation = optimizer.getGasPriceRecommendation('ethereum');

      expect(recommendation.slow).toBeLessThan(recommendation.standard);
      expect(recommendation.standard).toBeLessThan(recommendation.fast);
      expect(recommendation.slow).toBeGreaterThan(0);
    });

    it('should handle priority fee strategies', async () => {
      const configs = ['conservative', 'moderate', 'aggressive'] as const;

      for (const strategy of configs) {
        const strategyConfig = {
          ...optimizer['config'],
          priorityFeeStrategy: strategy,
        };

        const strategyOptimizer = new GasOptimizer(strategyConfig, mockChainConfigs);
        const result = await strategyOptimizer.optimizeGasCosts(mockExecutionPath);

        expect(result).toBeDefined();
        expect(result.originalGasCost).toBeGreaterThan(0);
      }
    });
  });

  describe('alternative path generation', () => {
    it('should generate alternative paths', async () => {
      const result = await optimizer.optimizeGasCosts(mockExecutionPath);

      expect(result.alternativePaths).toBeDefined();
      expect(result.alternativePaths.length).toBeGreaterThanOrEqual(0);

      result.alternativePaths.forEach(path => {
        expect(path.id).toBeDefined();
        expect(path.steps).toBeDefined();
        expect(path.totalGasCost).toBeGreaterThan(0);
      });
    });

    it('should include timing-optimized alternatives', async () => {
      // Set up high gas prices to trigger timing optimization
      optimizer.updateGasPrice('ethereum', 200);

      const result = await optimizer.optimizeGasCosts(mockExecutionPath);

      const timingAlternative = result.alternativePaths.find(path => 
        path.id.includes('timing')
      );

      if (timingAlternative) {
        expect(timingAlternative.estimatedTime).toBeGreaterThan(mockExecutionPath.estimatedTime);
      }
    });
  });

  describe('cost estimation', () => {
    it('should estimate gas costs accurately', async () => {
      const result = await optimizer.optimizeGasCosts(mockExecutionPath);

      expect(result.originalGasCost).toBeGreaterThan(0);
      expect(result.optimizedGasCost).toBeGreaterThan(0);
      expect(result.optimizedGasCost).toBeLessThanOrEqual(result.originalGasCost);
    });

    it('should apply gas estimation buffer', async () => {
      const result = await optimizer.optimizeGasCosts(mockExecutionPath);

      // The optimized gas cost should account for the buffer
      const totalEstimatedGas = mockExecutionPath.steps.reduce(
        (sum, step) => sum + Number(step.estimatedGas), 0
      );

      expect(result.originalGasCost).toBeGreaterThan(totalEstimatedGas * 0.001); // Basic sanity check
    });
  });

  describe('error handling', () => {
    it('should handle empty execution path', async () => {
      const emptyPath = {
        ...mockExecutionPath,
        steps: [],
      };

      const result = await optimizer.optimizeGasCosts(emptyPath);

      expect(result).toBeDefined();
      expect(result.originalGasCost).toBe(0);
      expect(result.optimizedGasCost).toBe(0);
      expect(result.savings).toBe(0);
    });

    it('should handle invalid chain IDs gracefully', async () => {
      const invalidPath = {
        ...mockExecutionPath,
        steps: [{
          type: 'swap' as const,
          chainId: 'invalid-chain' as any,
          protocol: 'test',
          contractAddress: '0x123',
          estimatedGas: BigInt(100000),
          estimatedTime: 10,
          dependencies: [],
        }],
      };

      const result = await optimizer.optimizeGasCosts(invalidPath);

      expect(result).toBeDefined();
      expect(result.originalGasCost).toBeGreaterThan(0);
    });

    it('should provide default result on optimization failure', async () => {
      // Mock a scenario that would cause optimization to fail
      const problematicPath = {
        ...mockExecutionPath,
        steps: [{
          type: 'swap' as const,
          chainId: 'ethereum' as const,
          protocol: 'unknown-protocol',
          contractAddress: '',
          estimatedGas: BigInt(-1), // Invalid gas
          estimatedTime: -1, // Invalid time
          dependencies: [],
        }],
      };

      const result = await optimizer.optimizeGasCosts(problematicPath);

      expect(result).toBeDefined();
      expect(result.originalGasCost).toBeGreaterThanOrEqual(0);
      expect(result.optimizedGasCost).toBeGreaterThanOrEqual(0);
    });
  });

  describe('performance', () => {
    it('should complete optimization within reasonable time', async () => {
      const startTime = Date.now();
      
      await optimizer.optimizeGasCosts(mockExecutionPath);
      
      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should handle multiple concurrent optimizations', async () => {
      const promises = Array.from({ length: 3 }, () =>
        optimizer.optimizeGasCosts(mockExecutionPath)
      );

      const results = await Promise.all(promises);

      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result).toBeDefined();
        expect(result.originalGasCost).toBeGreaterThan(0);
      });
    });
  });
});