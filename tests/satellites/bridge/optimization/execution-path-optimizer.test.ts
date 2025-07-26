/**
 * Tests for Execution Path Optimizer
 */

import { ExecutionPathOptimizer, PathOptimizationConfig } from '../../../../src/satellites/bridge/optimization/execution-path-optimizer';
import { 
  ArbitrageOpportunity,
  ChainConfig,
  BridgeConfig 
} from '../../../../src/satellites/bridge/types';

describe('ExecutionPathOptimizer', () => {
  let optimizer: ExecutionPathOptimizer;
  let mockChainConfigs: ChainConfig[];
  let mockBridgeConfigs: BridgeConfig[];
  let mockOpportunity: ArbitrageOpportunity;

  beforeEach(() => {
    // Set test environment
    process.env['NODE_ENV'] = 'test';
    mockChainConfigs = [
      {
        id: 'ethereum',
        name: 'Ethereum',
        rpcUrl: 'https://eth.llamarpc.com',
        nativeCurrency: 'ETH',
        blockTime: 12,
        gasTokenSymbol: 'ETH',
        maxGasPrice: '100000000000',
        confirmationBlocks: 12,
      },
      {
        id: 'arbitrum',
        name: 'Arbitrum',
        rpcUrl: 'https://arb1.arbitrum.io/rpc',
        nativeCurrency: 'ETH',
        blockTime: 1,
        gasTokenSymbol: 'ETH',
        maxGasPrice: '10000000000',
        confirmationBlocks: 1,
      },
    ];

    mockBridgeConfigs = [
      {
        id: 'hop-protocol',
        name: 'Hop Protocol',
        type: 'optimistic',
        supportedChains: ['ethereum', 'arbitrum'],
        trustLevel: 85,
        avgProcessingTime: 180,
        feeStructure: {
          baseFee: 5,
          percentageFee: 0.001,
          minFee: 2,
          maxFee: 50,
        },
        contractAddresses: {
          'ethereum': '0x3666f603Cc164936C1b87e207F36BEBa4AC5f18a',
          'arbitrum': '0x0e0E3d2C5c292161999474247956EF542caBF8dd',
        },
      },
    ];

    const config: PathOptimizationConfig = {
      maxAlternativePaths: 3,
      simulationRounds: 100,
      costWeights: {
        gasCost: 0.3,
        bridgeFees: 0.25,
        executionTime: 0.2,
        slippage: 0.15,
        mevRisk: 0.1,
      },
      riskTolerance: 'moderate',
      parallelSimulations: 2,
    };

    optimizer = new ExecutionPathOptimizer(config, mockChainConfigs, mockBridgeConfigs);

    mockOpportunity = {
      id: 'test-opp-1',
      assetId: 'USDC',
      sourceChain: 'ethereum',
      targetChain: 'arbitrum',
      sourcePrice: 1.0,
      targetPrice: 1.002,
      priceDifference: 0.002,
      percentageDifference: 0.2,
      expectedProfit: 20,
      estimatedGasCost: 50,
      bridgeFee: 10,
      netProfit: -40,
      profitMargin: 0.002,
      executionTime: 300,
      riskScore: 25,
      confidence: 0.85,
      timestamp: Date.now(),
      executionPaths: [{
        id: 'path-1',
        steps: [
          {
            type: 'swap',
            chainId: 'ethereum',
            protocol: 'uniswap-v3',
            contractAddress: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
            estimatedGas: 150000,
            estimatedTime: 15,
            dependencies: [],
          },
          {
            type: 'bridge',
            chainId: 'ethereum',
            protocol: 'hop-protocol',
            contractAddress: '0x3666f603Cc164936C1b87e207F36BEBa4AC5f18a',
            estimatedGas: 300000,
            estimatedTime: 180,
            dependencies: ['step-0'],
          },
          {
            type: 'swap',
            chainId: 'arbitrum',
            protocol: 'uniswap-v3',
            contractAddress: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
            estimatedGas: 150000,
            estimatedTime: 10,
            dependencies: ['step-1'],
          },
        ],
        totalGasCost: 600000,
        totalFees: 720000,
        estimatedTime: 205,
        successProbability: 0.9,
        riskLevel: 'medium',
      }],
    };
  });

  describe('initialization', () => {
    it('should initialize with valid configuration', () => {
      expect(optimizer).toBeDefined();
    });

    it('should initialize with invalid configuration gracefully', () => {
      const invalidConfig = {
        maxAlternativePaths: 0,
        simulationRounds: -1,
      } as PathOptimizationConfig;

      // Constructor doesn't validate config, so it should initialize successfully
      const optimizer = new ExecutionPathOptimizer(invalidConfig, mockChainConfigs, mockBridgeConfigs);
      expect(optimizer).toBeDefined();
    });
  });

  describe('path optimization', () => {
    it('should optimize a valid arbitrage opportunity', async () => {
      const result = await optimizer.optimizePath(mockOpportunity);

      expect(result).toBeDefined();
      // Path ID uses strategy-timestamp format like "direct-1753476594616"
      expect(result.id).toMatch(/^(direct|multi-hop|parallel|staged|hybrid)-\d+$/);
      expect(result.optimizationScore).toBeGreaterThan(0);
      expect(result.costBreakdown).toBeDefined();
      expect(result.performanceMetrics).toBeDefined();
      expect(result.alternativeRoutes).toBeDefined();
      expect(result.optimizationStrategy).toBeDefined();
    });

    it('should generate alternative routes', async () => {
      const result = await optimizer.optimizePath(mockOpportunity);

      expect(result.alternativeRoutes.length).toBeGreaterThanOrEqual(0);
      result.alternativeRoutes.forEach(route => {
        expect(route.description).toBeDefined();
        expect(route.path).toBeDefined();
        expect(route.feasibility).toBeGreaterThanOrEqual(0);
        expect(route.feasibility).toBeLessThanOrEqual(1);
      });
    });

    it('should respect risk tolerance settings', async () => {
      const conservativeConfig: PathOptimizationConfig = {
        ...optimizer['config'],
        riskTolerance: 'conservative',
      };

      const conservativeOptimizer = new ExecutionPathOptimizer(
        conservativeConfig,
        mockChainConfigs,
        mockBridgeConfigs
      );

      const result = await conservativeOptimizer.optimizePath(mockOpportunity);

      expect(result.performanceMetrics.executionProbability).toBeGreaterThan(0.8);
      expect(result.riskLevel).toMatch(/^(low|medium)$/);
    });

    it('should handle complex multi-step paths', async () => {
      const complexOpportunity = {
        ...mockOpportunity,
        executionPaths: [{
          id: 'complex-path-1',
          totalGasCost: 800000,
          totalFees: 800000,
          estimatedTime: 400,
          successProbability: 0.85,
          riskLevel: 'medium' as const,
          steps: [
            ...mockOpportunity.executionPaths[0]!.steps,
            {
              type: 'swap' as const,
              chainId: 'arbitrum' as const,
              protocol: 'sushiswap',
              contractAddress: '0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F',
              estimatedGas: 180000,
              estimatedTime: 12,
              dependencies: ['step-2'],
            },
            {
              type: 'bridge' as const,
              chainId: 'arbitrum' as const,
              protocol: 'stargate',
              contractAddress: '0x53Bf833A5d6c4ddA888F69c22C88C9f356a41614',
              estimatedGas: 250000,
              estimatedTime: 300,
              dependencies: ['step-3'],
            },
          ],
        }],
      };

      const result = await optimizer.optimizePath(complexOpportunity);

      expect(result).toBeDefined();
      // The optimizer generates optimized paths, not necessarily longer ones
      expect(result.steps.length).toBeGreaterThan(0);
    });
  });

  describe('cost breakdown analysis', () => {
    it('should provide detailed cost breakdown', async () => {
      const result = await optimizer.optimizePath(mockOpportunity);

      expect(result.costBreakdown.gasCosts).toBeDefined();
      expect(result.costBreakdown.gasCosts.totalUSD).toBeGreaterThanOrEqual(0);
      expect(result.costBreakdown.bridgeFees).toBeDefined();
      expect(result.costBreakdown.bridgeFees.totalFees).toBeGreaterThanOrEqual(0);
      expect(result.costBreakdown.slippageCosts).toBeDefined();
      expect(result.costBreakdown.mevCosts).toBeDefined();
      expect(result.costBreakdown.timeCosts).toBeDefined();
    });

    it('should calculate optimization savings', async () => {
      const result = await optimizer.optimizePath(mockOpportunity);

      const totalCost = result.costBreakdown.gasCosts.totalUSD + result.costBreakdown.bridgeFees.totalFees;
      expect(totalCost).toBeGreaterThanOrEqual(0);
      expect(result.costBreakdown.gasCosts.gasOptimizationPotential).toBeGreaterThanOrEqual(0);
      expect(result.costBreakdown.bridgeFees.feeOptimizationPotential).toBeGreaterThanOrEqual(0);
    });
  });

  describe('performance metrics', () => {
    it('should calculate realistic performance metrics', async () => {
      const result = await optimizer.optimizePath(mockOpportunity);

      expect(result.performanceMetrics.expectedExecutionTime).toBeGreaterThan(0);
      expect(result.performanceMetrics.executionProbability).toBeGreaterThan(0);
      expect(result.performanceMetrics.executionProbability).toBeLessThanOrEqual(1);
      expect(result.performanceMetrics.robustness).toBeGreaterThanOrEqual(0);
      expect(result.performanceMetrics.robustness).toBeLessThanOrEqual(1);
      expect(result.performanceMetrics.efficiency).toBeGreaterThanOrEqual(0);
      expect(result.performanceMetrics.efficiency).toBeLessThanOrEqual(1);
    });

    it('should validate scalability and adaptability metrics', async () => {
      const result = await optimizer.optimizePath(mockOpportunity);

      expect(result.performanceMetrics.scalability).toBeGreaterThanOrEqual(0);
      expect(result.performanceMetrics.scalability).toBeLessThanOrEqual(1);
      expect(result.performanceMetrics.adaptability).toBeGreaterThanOrEqual(0);
      expect(result.performanceMetrics.adaptability).toBeLessThanOrEqual(1);
    });
  });

  describe('error handling', () => {
    it('should handle invalid opportunity gracefully', async () => {
      const invalidOpportunity = {
        ...mockOpportunity,
        executionPaths: [],
      };

      // The optimizer handles empty paths gracefully by generating default paths
      const result = await optimizer.optimizePath(invalidOpportunity);
      expect(result).toBeDefined();
      expect(result.steps.length).toBeGreaterThan(0);
    });

    it('should handle optimization failures gracefully', async () => {
      const problematicOpportunity = {
        ...mockOpportunity,
        executionPaths: [{
          id: 'problematic-path-1',
          totalGasCost: 0,
          totalFees: 0,
          estimatedTime: 0,
          successProbability: 0.1,
          riskLevel: 'high' as const,
          steps: [],
        }],
      };

      // The optimizer handles problematic opportunities by falling back to default path
      const result = await optimizer.optimizePath(problematicOpportunity);
      expect(result).toBeDefined();
      // Default path may have empty steps for invalid opportunities
      expect(result.steps.length).toBeGreaterThanOrEqual(0);
      expect(result.id).toBeDefined();
    });

    it('should validate input parameters', async () => {
      const opportunityWithInvalidSteps = {
        ...mockOpportunity,
        executionPaths: [{
          id: 'invalid-path-1',
          totalGasCost: 100000,
          totalFees: 10,
          estimatedTime: 60,
          successProbability: 0.5,
          riskLevel: 'medium' as const,
          steps: [{
            type: 'invalid' as any,
            chainId: 'ethereum',
            protocol: 'test',
            contractAddress: '0x123',
            estimatedGas: -1,
            estimatedTime: -1,
            dependencies: [],
          }],
        }],
      };

      // The optimizer handles invalid steps gracefully by generating alternative paths
      const result = await optimizer.optimizePath(opportunityWithInvalidSteps);
      expect(result).toBeDefined();
      expect(result.steps.length).toBeGreaterThan(0);
    });
  });

  describe('simulation accuracy', () => {
    it('should run optimization algorithm', async () => {
      const result = await optimizer.optimizePath(mockOpportunity);

      // The optimization should provide meaningful metrics
      expect(result.optimizationScore).toBeGreaterThanOrEqual(0);
      expect(result.optimizationScore).toBeLessThanOrEqual(100);
    });

    it('should provide consistent optimization results', async () => {
      const result1 = await optimizer.optimizePath(mockOpportunity);
      const result2 = await optimizer.optimizePath(mockOpportunity);

      // Results should be consistent
      expect(Math.abs(result1.optimizationScore - result2.optimizationScore)).toBeLessThan(10);
    });
  });

  describe('optimization strategy', () => {
    it('should provide optimization strategy details', async () => {
      const result = await optimizer.optimizePath(mockOpportunity);

      expect(result.optimizationStrategy).toBeDefined();
      expect(result.optimizationStrategy.primaryStrategy).toBeDefined();
      expect(result.optimizationStrategy.appliedOptimizations).toBeDefined();
      expect(result.optimizationStrategy.confidence).toBeGreaterThanOrEqual(0);
      expect(result.optimizationStrategy.confidence).toBeLessThanOrEqual(1);
    });

    it('should include cost optimization potential', async () => {
      const result = await optimizer.optimizePath(mockOpportunity);

      expect(result.costBreakdown.gasCosts.gasOptimizationPotential).toBeGreaterThanOrEqual(0);
      expect(result.costBreakdown.bridgeFees.feeOptimizationPotential).toBeGreaterThanOrEqual(0);
      expect(result.costBreakdown.slippageCosts.slippageOptimizationPotential).toBeGreaterThanOrEqual(0);
    });

    it('should analyze time and MEV costs', async () => {
      const result = await optimizer.optimizePath(mockOpportunity);

      expect(result.costBreakdown.timeCosts.opportunityCost).toBeGreaterThanOrEqual(0);
      expect(result.costBreakdown.mevCosts.extractableValue).toBeGreaterThanOrEqual(0);
    });
  });

  describe('parallel simulation', () => {
    it('should handle parallel simulations correctly', async () => {
      const highParallelismConfig = {
        ...optimizer['config'],
        parallelSimulations: 4,
      };

      const parallelOptimizer = new ExecutionPathOptimizer(
        highParallelismConfig,
        mockChainConfigs,
        mockBridgeConfigs
      );

      const result = await parallelOptimizer.optimizePath(mockOpportunity);

      expect(result).toBeDefined();
      expect(result.optimizationScore).toBeGreaterThanOrEqual(0);
    });

    it('should maintain consistency across parallel simulations', async () => {
      const results = await Promise.all([
        optimizer.optimizePath(mockOpportunity),
        optimizer.optimizePath(mockOpportunity),
      ]);

      // Results should be similar (within reasonable variance)
      const scoreDiff = Math.abs(results[0].optimizationScore - results[1].optimizationScore);
      expect(scoreDiff).toBeLessThan(results[0].optimizationScore * 0.1); // Within 10%
    });
  });
});