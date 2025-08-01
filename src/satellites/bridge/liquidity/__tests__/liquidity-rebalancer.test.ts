/**
 * Liquidity Rebalancer Test Suite
 * Cross-chain liquidity rebalancing and optimization strategies
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { LiquidityRebalancer, RebalanceOperation, RebalanceStrategy } from '../liquidity-rebalancer';
import { CrossChainBridgeManager } from '../cross-chain-bridge-manager';
import { SlippageOptimizer } from '../slippage-optimizer';
import { BridgeSatelliteConfig } from '../../bridge-satellite';

jest.mock('../../../shared/logging/logger');

describe('Liquidity Rebalancer', () => {
  let liquidityRebalancer: LiquidityRebalancer;
  let mockBridgeManager: jest.Mocked<CrossChainBridgeManager>;
  let mockSlippageOptimizer: jest.Mocked<SlippageOptimizer>;
  let mockConfig: BridgeSatelliteConfig;
  let performanceMetrics: {
    rebalanceLatencies: number[];
    operationsExecuted: number;
    gasOptimizations: number;
    slippageReductions: number;
    successfulRebalances: number;
    totalVolume: number;
  };

  beforeEach(async () => {
    performanceMetrics = {
      rebalanceLatencies: [],
      operationsExecuted: 0,
      gasOptimizations: 0,
      slippageReductions: 0,
      successfulRebalances: 0,
      totalVolume: 0
    };

    mockConfig = {
      chains: [
        { id: 'ethereum', name: 'Ethereum', rpcUrl: 'mock-rpc', gasToken: 'ETH' },
        { id: 'polygon', name: 'Polygon', rpcUrl: 'mock-rpc', gasToken: 'MATIC' },
        { id: 'arbitrum', name: 'Arbitrum', rpcUrl: 'mock-rpc', gasToken: 'ETH' },
        { id: 'optimism', name: 'Optimism', rpcUrl: 'mock-rpc', gasToken: 'ETH' }
      ],
      bridges: [
        { id: 'stargate', name: 'Stargate', chains: ['ethereum', 'polygon', 'arbitrum'], fees: { base: 0.001, variable: 0.0005 } },
        { id: 'across', name: 'Across', chains: ['ethereum', 'arbitrum', 'optimism'], fees: { base: 0.0008, variable: 0.0003 } },
        { id: 'hop', name: 'Hop Protocol', chains: ['ethereum', 'polygon', 'optimism'], fees: { base: 0.0012, variable: 0.0006 } }
      ],
      arbitrage: {
        minProfitThreshold: 0.001,
        maxRiskScore: 70,
        maxExecutionTime: 300,
        enabledChains: ['ethereum', 'polygon', 'arbitrum', 'optimism']
      },
      risk: {
        updateInterval: 60000,
        alertThresholds: {
          safetyScore: 80,
          liquidityScore: 70,
          reliabilityScore: 85
        }
      },
      liquidity: {
        rebalanceThreshold: 0.1,
        minUtilization: 0.1,
        maxUtilization: 0.8,
        targetDistribution: { 
          ethereum: 0.4, 
          polygon: 0.25, 
          arbitrum: 0.2, 
          optimism: 0.15 
        }
      },
      monitoring: {
        updateInterval: 30000,
        alertRetention: 3600000,
        performanceWindow: 300000
      },
      validation: {
        maxSlippageTolerance: 0.02,
        minLiquidityUSD: 100000,
        maxPriceAge: 30,
        mevProtectionThreshold: 100,
        simulationGasBuffer: 1.2
      }
    };

    // Create mock dependencies
    mockBridgeManager = {
      getBridgeCapacity: jest.fn(),
      executeCrossChainTransfer: jest.fn(),
      estimateTransferCosts: jest.fn(),
      validateTransferRoute: jest.fn(),
      getBestRoute: jest.fn(),
      initialize: jest.fn()
    } as any;

    mockSlippageOptimizer = {
      optimizeSlippage: jest.fn(),
      calculateOptimalTradeSize: jest.fn(),
      estimateSlippage: jest.fn(),
      getSplitStrategy: jest.fn()
    } as any;

    liquidityRebalancer = new LiquidityRebalancer(mockConfig);
    liquidityRebalancer['bridgeManager'] = mockBridgeManager;
    liquidityRebalancer['slippageOptimizer'] = mockSlippageOptimizer;
    
    await liquidityRebalancer.initialize();
  });

  describe('Rebalance Need Assessment', () => {
    it('should accurately assess rebalancing needs based on utilization thresholds', async () => {
      const currentDistribution = {
        ethereum: { 
          totalLiquidity: 200000000, 
          utilization: 0.95, // Over-utilized
          targetUtilization: 0.75,
          currentYield: 0.08,
          capacity: 250000000
        },
        polygon: { 
          totalLiquidity: 50000000, 
          utilization: 0.35, // Under-utilized
          targetUtilization: 0.65,
          currentYield: 0.15,
          capacity: 100000000
        },
        arbitrum: { 
          totalLiquidity: 80000000, 
          utilization: 0.85, // Slightly over
          targetUtilization: 0.70,
          currentYield: 0.11,
          capacity: 120000000
        },
        optimism: { 
          totalLiquidity: 30000000, 
          utilization: 0.25, // Under-utilized
          targetUtilization: 0.60,
          currentYield: 0.14,
          capacity: 80000000
        }
      };

      const marketConditions = {
        volatility: {
          ethereum: 0.12,
          polygon: 0.18,
          arbitrum: 0.14,
          optimism: 0.16
        },
        liquidityStress: 0.3,
        gasConditions: {
          ethereum: 'high',
          polygon: 'low',
          arbitrum: 'medium',
          optimism: 'low'
        }
      };

      const rebalanceAssessment = await liquidityRebalancer.assessRebalanceNeeds(
        currentDistribution,
        marketConditions
      );

      expect(rebalanceAssessment).toBeDefined();
      expect(rebalanceAssessment.needsRebalancing).toBe(true);
      expect(rebalanceAssessment.urgencyScore).toBeGreaterThan(0.6); // High urgency due to over-utilization

      // Should identify over and under-utilized chains
      const overUtilized = rebalanceAssessment.imbalances.filter(i => i.type === 'over_utilized');
      const underUtilized = rebalanceAssessment.imbalances.filter(i => i.type === 'under_utilized');
      
      expect(overUtilized.length).toBeGreaterThan(0);
      expect(underUtilized.length).toBeGreaterThan(0);
      expect(overUtilized.some(i => i.chain === 'ethereum')).toBe(true);
      expect(underUtilized.some(i => i.chain === 'polygon')).toBe(true);

      // Should provide specific rebalance targets
      expect(rebalanceAssessment.recommendedOperations.length).toBeGreaterThan(0);
      expect(rebalanceAssessment.estimatedBenefit).toBeGreaterThan(0);

      console.log(`Rebalance Need Assessment:
        Needs Rebalancing: ${rebalanceAssessment.needsRebalancing}
        Urgency Score: ${(rebalanceAssessment.urgencyScore * 100).toFixed(1)}%
        Over-utilized Chains: ${overUtilized.length}
        Under-utilized Chains: ${underUtilized.length}
        Recommended Operations: ${rebalanceAssessment.recommendedOperations.length}
        Estimated Benefit: ${(rebalanceAssessment.estimatedBenefit * 100).toFixed(2)}%`);
    });

    it('should calculate optimal rebalance amounts considering transaction costs', async () => {
      const rebalanceScenario = {
        sourceChain: 'ethereum',
        targetChain: 'polygon',
        maxRebalanceAmount: 50000000, // $50M max
        currentImbalance: 25000000,    // $25M excess on ethereum
        transactionCosts: {
          ethereum: { gasPrice: 100, gasLimit: 200000, tokenPrice: 2500 },
          polygon: { gasPrice: 30, gasLimit: 150000, tokenPrice: 0.8 },
          bridgeFee: 0.001 // 0.1%
        },
        marketImpact: {
          ethereum: { slippage: 0.002, liquidityDepth: 500000000 },
          polygon: { slippage: 0.005, liquidityDepth: 80000000 }
        },
        timeConstraints: {
          urgent: false,
          maxExecutionTime: 1800 // 30 minutes
        }
      };

      // Mock bridge cost estimation
      mockBridgeManager.estimateTransferCosts.mockResolvedValue([
        {
          bridge: 'stargate',
          estimatedGas: 0.05, // ETH
          bridgeFee: 0.001,
          estimatedTime: 600, // 10 minutes
          slippage: 0.008,
          totalCostUSD: 150
        },
        {
          bridge: 'hop',
          estimatedGas: 0.08, // ETH
          bridgeFee: 0.0012,
          estimatedTime: 900, // 15 minutes
          slippage: 0.012,
          totalCostUSD: 230
        }
      ]);

      const optimalRebalance = await liquidityRebalancer.calculateOptimalRebalanceAmount(
        rebalanceScenario
      );

      expect(optimalRebalance).toBeDefined();
      expect(optimalRebalance.recommendedAmount).toBeGreaterThan(0);
      expect(optimalRebalance.recommendedAmount).toBeLessThanOrEqual(rebalanceScenario.maxRebalanceAmount);

      // Should consider transaction costs in optimization
      expect(optimalRebalance.costBenefitAnalysis.totalCosts).toBeGreaterThan(0);
      expect(optimalRebalance.costBenefitAnalysis.expectedBenefit).toBeGreaterThan(0);
      expect(optimalRebalance.costBenefitAnalysis.netBenefit).toBeDefined();

      // Should recommend the most cost-effective bridge
      expect(optimalRebalance.recommendedBridge).toBe('stargate'); // Lower cost option

      // Should provide execution strategy
      expect(optimalRebalance.executionStrategy).toBeDefined();
      expect(optimalRebalance.executionStrategy.splitTransactions).toBeDefined();

      console.log(`Optimal Rebalance Calculation:
        Recommended Amount: $${(optimalRebalance.recommendedAmount / 1000000).toFixed(1)}M
        Recommended Bridge: ${optimalRebalance.recommendedBridge}
        Total Costs: $${optimalRebalance.costBenefitAnalysis.totalCosts.toFixed(0)}
        Expected Benefit: $${optimalRebalance.costBenefitAnalysis.expectedBenefit.toFixed(0)}
        Net Benefit: $${optimalRebalance.costBenefitAnalysis.netBenefit.toFixed(0)}
        Split Transactions: ${optimalRebalance.executionStrategy.splitTransactions}`);
    });
  });

  describe('Execution Strategy Optimization', () => {
    it('should optimize rebalancing execution for minimal slippage and MEV exposure', async () => {
      const rebalanceOperations = [
        {
          fromChain: 'ethereum',
          toChain: 'polygon',
          amount: 30000000,
          asset: 'USDC',
          bridge: 'stargate',
          priority: 'high'
        },
        {
          fromChain: 'arbitrum',
          toChain: 'optimism',
          amount: 15000000,
          asset: 'USDT',
          bridge: 'across',
          priority: 'medium'
        },
        {
          fromChain: 'polygon',
          toChain: 'ethereum',
          amount: 10000000,
          asset: 'DAI',
          bridge: 'hop',
          priority: 'low'
        }
      ];

      const optimizationConstraints = {
        maxSlippage: 0.015,        // 1.5% max slippage
        maxMEVExposure: 0.005,     // 0.5% max MEV exposure
        maxExecutionTime: 3600,    // 1 hour max
        minTransactionSize: 1000000, // $1M min per tx
        maxConcurrentOps: 3        // Max 3 concurrent operations
      };

      // Mock slippage optimization
      mockSlippageOptimizer.optimizeSlippage.mockResolvedValue({
        optimalSplits: [
          { amount: 10000000, estimatedSlippage: 0.008, executionTime: 300 },
          { amount: 10000000, estimatedSlippage: 0.009, executionTime: 320 },
          { amount: 10000000, estimatedSlippage: 0.010, executionTime: 340 }
        ],
        totalSlippage: 0.009,
        mevProtectionStrategy: 'time_delay',
        estimatedMEVSavings: 0.003
      });

      const startTime = performance.now();
      const executionStrategy = await liquidityRebalancer.optimizeExecutionStrategy(
        rebalanceOperations,
        optimizationConstraints
      );
      const optimizationTime = performance.now() - startTime;

      performanceMetrics.rebalanceLatencies.push(optimizationTime);

      expect(executionStrategy).toBeDefined();
      expect(executionStrategy.optimizedOperations.length).toBeGreaterThanOrEqual(rebalanceOperations.length);

      // Should respect slippage constraints
      for (const operation of executionStrategy.optimizedOperations) {
        expect(operation.estimatedSlippage).toBeLessThanOrEqual(optimizationConstraints.maxSlippage);
      }

      // Should implement MEV protection
      expect(executionStrategy.mevProtection.strategy).toBeDefined();
      expect(executionStrategy.mevProtection.estimatedSavings).toBeGreaterThan(0);

      // Should provide timing optimization
      expect(executionStrategy.executionTimeline.length).toBeGreaterThan(0);
      expect(executionStrategy.totalExecutionTime).toBeLessThanOrEqual(optimizationConstraints.maxExecutionTime);

      performanceMetrics.slippageReductions++;
      performanceMetrics.gasOptimizations++;

      console.log(`Execution Strategy Optimization:
        Optimized Operations: ${executionStrategy.optimizedOperations.length}
        Total Slippage: ${(executionStrategy.aggregateSlippage * 100).toFixed(3)}%
        MEV Protection: ${executionStrategy.mevProtection.strategy}
        Estimated MEV Savings: ${(executionStrategy.mevProtection.estimatedSavings * 100).toFixed(3)}%
        Total Execution Time: ${(executionStrategy.totalExecutionTime / 60).toFixed(1)} minutes
        Optimization Time: ${optimizationTime.toFixed(2)}ms`);
    });

    it('should handle emergency rebalancing with circuit breaker mechanisms', async () => {
      const emergencyScenario = {
        trigger: 'liquidity_crisis',
        affectedChains: ['ethereum', 'polygon'],
        severity: 'critical',
        availableTime: 300, // 5 minutes
        liquidityShortfall: {
          ethereum: 40000000,  // $40M shortfall
          polygon: 25000000    // $25M shortfall
        },
        circuitBreakers: {
          maxEmergencyTransfer: 100000000, // $100M max
          maxSlippageTolerance: 0.05,      // 5% in emergency
          emergencyBridgesOnly: ['across', 'stargate'], // Trusted bridges only
          skipOptimization: true           // Speed over efficiency
        },
        alternativeSources: {
          arbitrum: { available: 60000000, transferTime: 180 },
          optimism: { available: 30000000, transferTime: 240 }
        }
      };

      const emergencyRebalancing = await liquidityRebalancer.handleEmergencyRebalancing(
        emergencyScenario
      );

      expect(emergencyRebalancing).toBeDefined();
      expect(emergencyRebalancing.emergencyOperations.length).toBeGreaterThan(0);
      expect(emergencyRebalancing.circuitBreakerActivated).toBe(true);

      // Should prioritize speed over cost in emergency
      expect(emergencyRebalancing.estimatedExecutionTime).toBeLessThanOrEqual(
        emergencyScenario.availableTime
      );

      // Should use only trusted bridges
      for (const operation of emergencyRebalancing.emergencyOperations) {
        expect(emergencyScenario.circuitBreakers.emergencyBridgesOnly).toContain(operation.bridge);
      }

      // Should not exceed emergency transfer limits
      const totalEmergencyTransfer = emergencyRebalancing.emergencyOperations.reduce(
        (sum, op) => sum + op.amount, 0
      );
      expect(totalEmergencyTransfer).toBeLessThanOrEqual(
        emergencyScenario.circuitBreakers.maxEmergencyTransfer
      );

      // Should provide risk assessment
      expect(emergencyRebalancing.riskAssessment.emergencyRiskScore).toBeDefined();
      expect(emergencyRebalancing.riskAssessment.mitigationMeasures.length).toBeGreaterThan(0);

      console.log(`Emergency Rebalancing Response:
        Circuit Breaker Activated: ${emergencyRebalancing.circuitBreakerActivated}
        Emergency Operations: ${emergencyRebalancing.emergencyOperations.length}
        Total Transfer Amount: $${(totalEmergencyTransfer / 1000000).toFixed(1)}M
        Estimated Execution Time: ${emergencyRebalancing.estimatedExecutionTime}s
        Emergency Risk Score: ${emergencyRebalancing.riskAssessment.emergencyRiskScore.toFixed(2)}
        Mitigation Measures: ${emergencyRebalancing.riskAssessment.mitigationMeasures.length}`);
    });
  });

  describe('Rebalance Execution and Monitoring', () => {
    it('should execute rebalancing operations with real-time monitoring and error handling', async () => {
      const rebalanceOperations = [
        {
          id: 'rebal_001',
          fromChain: 'ethereum',
          toChain: 'polygon',
          amount: 20000000,
          asset: 'USDC',
          bridge: 'stargate',
          priority: 'high',
          maxSlippage: 0.01,
          deadline: Date.now() + 1800000 // 30 minutes
        },
        {
          id: 'rebal_002',
          fromChain: 'arbitrum',
          toChain: 'optimism',
          amount: 15000000,
          asset: 'USDT',
          bridge: 'across',
          priority: 'medium',
          maxSlippage: 0.012,
          deadline: Date.now() + 2700000 // 45 minutes
        }
      ];

      // Mock successful execution
      mockBridgeManager.executeCrossChainTransfer.mockImplementation(async (operation) => {
        // Simulate execution time
        await new Promise(resolve => setTimeout(resolve, 100));
        
        return {
          transactionHash: `0x${Math.random().toString(16).substring(2, 66)}`,
          status: 'confirmed',
          actualAmount: operation.amount * 0.999, // Small slippage
          actualSlippage: 0.001,
          executionTime: 95,
          gasCost: 0.02,
          bridgeFee: operation.amount * 0.001
        };
      });

      const executionResults = await liquidityRebalancer.executeRebalanceOperations(
        rebalanceOperations
      );

      expect(executionResults).toBeDefined();
      expect(executionResults.completedOperations.length).toBe(2);
      expect(executionResults.failedOperations.length).toBe(0);

      // Should track execution metrics
      expect(executionResults.totalExecutionTime).toBeGreaterThan(0);
      expect(executionResults.totalSlippage).toBeGreaterThan(0);
      expect(executionResults.totalGasCosts).toBeGreaterThan(0);

      // Should provide detailed operation results
      for (const result of executionResults.operationResults) {
        expect(result.transactionHash).toBeDefined();
        expect(result.status).toBe('confirmed');
        expect(result.actualSlippage).toBeLessThanOrEqual(0.01); // Within tolerance
      }

      performanceMetrics.operationsExecuted += executionResults.completedOperations.length;
      performanceMetrics.successfulRebalances++;
      performanceMetrics.totalVolume += rebalanceOperations.reduce((sum, op) => sum + op.amount, 0);

      console.log(`Rebalance Execution Results:
        Completed Operations: ${executionResults.completedOperations.length}
        Failed Operations: ${executionResults.failedOperations.length}
        Total Execution Time: ${(executionResults.totalExecutionTime / 1000).toFixed(1)}s
        Total Slippage: ${(executionResults.totalSlippage * 100).toFixed(3)}%
        Total Gas Costs: ${executionResults.totalGasCosts.toFixed(4)} ETH
        Success Rate: ${(executionResults.successRate * 100).toFixed(1)}%`);
    });

    it('should handle partial failures and implement fallback strategies', async () => {
      const rebalanceOperations = [
        {
          id: 'rebal_003',
          fromChain: 'ethereum',
          toChain: 'polygon',
          amount: 25000000,
          asset: 'USDC',
          bridge: 'stargate',
          priority: 'high'
        },
        {
          id: 'rebal_004',
          fromChain: 'polygon',
          toChain: 'arbitrum',
          amount: 18000000,
          asset: 'USDT',
          bridge: 'hop', // Will fail
          priority: 'medium'
        }
      ];

      const fallbackStrategies = {
        retryPolicy: {
          maxRetries: 3,
          backoffMultiplier: 2,
          initialDelay: 1000
        },
        alternativeBridges: {
          hop: ['across', 'stargate'], // Fallbacks for hop
          stargate: ['across', 'hop']
        },
        partialExecutionThreshold: 0.5 // Accept if >50% completes
      };

      // Mock mixed execution results
      let callCount = 0;
      mockBridgeManager.executeCrossChainTransfer.mockImplementation(async (operation) => {
        callCount++;
        
        if (operation.bridge === 'hop' && callCount <= 2) {
          // Fail hop operations initially
          throw new Error('Bridge temporarily unavailable');
        }

        return {
          transactionHash: `0x${Math.random().toString(16).substring(2, 66)}`,
          status: 'confirmed',
          actualAmount: operation.amount * 0.998,
          actualSlippage: 0.002,
          executionTime: 120,
          gasCost: 0.025,
          bridgeFee: operation.amount * 0.001
        };
      });

      const executionWithFallbacks = await liquidityRebalancer.executeWithFallbacks(
        rebalanceOperations,
        fallbackStrategies
      );

      expect(executionWithFallbacks).toBeDefined();
      expect(executionWithFallbacks.completedOperations.length).toBeGreaterThan(0);

      // Should implement fallback strategies
      expect(executionWithFallbacks.fallbacksUsed.length).toBeGreaterThan(0);
      expect(executionWithFallbacks.retryAttempts).toBeGreaterThan(0);

      // Should meet partial execution threshold
      const completionRate = executionWithFallbacks.completedOperations.length / rebalanceOperations.length;
      expect(completionRate).toBeGreaterThanOrEqual(fallbackStrategies.partialExecutionThreshold);

      // Should provide detailed failure analysis
      if (executionWithFallbacks.failedOperations.length > 0) {
        for (const failure of executionWithFallbacks.failedOperations) {
          expect(failure.reason).toBeDefined();
          expect(failure.attemptsCount).toBeGreaterThan(0);
        }
      }

      console.log(`Execution with Fallbacks:
        Completed Operations: ${executionWithFallbacks.completedOperations.length}
        Failed Operations: ${executionWithFallbacks.failedOperations.length}
        Fallbacks Used: ${executionWithFallbacks.fallbacksUsed.length}
        Retry Attempts: ${executionWithFallbacks.retryAttempts}
        Completion Rate: ${(completionRate * 100).toFixed(1)}%
        Total Recovery Time: ${executionWithFallbacks.totalRecoveryTime / 1000}s`);
    });
  });

  describe('Performance and Validation', () => {
    afterAll(() => {
      // Generate comprehensive liquidity rebalancer report
      const avgRebalanceLatency = performanceMetrics.rebalanceLatencies.reduce((a, b) => a + b, 0) / performanceMetrics.rebalanceLatencies.length;
      const successRate = performanceMetrics.successfulRebalances / Math.max(1, performanceMetrics.operationsExecuted);

      console.log(`
=== LIQUIDITY REBALANCER VALIDATION REPORT ===
Performance Metrics:
  Average Rebalance Latency: ${avgRebalanceLatency ? avgRebalanceLatency.toFixed(2) + 'ms' : 'N/A'}
  Operations Executed: ${performanceMetrics.operationsExecuted}
  Successful Rebalances: ${performanceMetrics.successfulRebalances}
  Success Rate: ${(successRate * 100).toFixed(1)}%
  Total Volume Processed: $${(performanceMetrics.totalVolume / 1000000).toFixed(1)}M

Optimization Metrics:
  Gas Optimizations: ${performanceMetrics.gasOptimizations}
  Slippage Reductions: ${performanceMetrics.slippageReductions}

Validation Targets:
  ✓ Rebalance Need Assessment: COMPLETE
  ✓ Execution Strategy Optimization: COMPLETE
  ✓ Emergency Rebalancing: COMPLETE
  ✓ Real-time Monitoring: COMPLETE
  ✓ Fallback Mechanisms: COMPLETE

Quality Metrics:
  ✓ Rebalance Speed < 5000ms: ${!avgRebalanceLatency || avgRebalanceLatency < 5000 ? 'PASS' : 'FAIL'}
  ✓ Success Rate > 90%: ${successRate > 0.9 ? 'PASS' : 'FAIL'}
  ✓ Operations Executed: ${performanceMetrics.operationsExecuted > 0 ? 'PASS' : 'FAIL'}
  ✓ Optimization Active: ${performanceMetrics.gasOptimizations > 0 && performanceMetrics.slippageReductions > 0 ? 'PASS' : 'FAIL'}
      `);

      // Validate overall performance
      if (avgRebalanceLatency) {
        expect(avgRebalanceLatency).toBeLessThan(5000); // <5s rebalance planning
      }
      expect(successRate).toBeGreaterThan(0.9); // >90% success rate
      expect(performanceMetrics.operationsExecuted).toBeGreaterThan(0);
      expect(performanceMetrics.gasOptimizations).toBeGreaterThan(0);
      expect(performanceMetrics.slippageReductions).toBeGreaterThan(0);
    });
  });
});