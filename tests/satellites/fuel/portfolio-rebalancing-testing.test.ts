/**
 * Fuel Satellite - Portfolio Rebalancing Strategy Testing
 * Task 38.3: Test portfolio rebalancing with custom allocation algorithms
 * 
 * Validates rebalancing strategies, allocation optimization, and execution efficiency
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach, jest } from '@jest/globals';
import { PortfolioRebalancer } from '../../../src/satellites/fuel/rebalancing/portfolio-rebalancer';
import { TradeExecutor } from '../../../src/satellites/fuel/rebalancing/trade-executor';
import { getLogger } from '../../../src/shared/logging/logger';
import { getUnifiedAIClient } from '../../../src/integrations/ai/unified-ai-client';
import { Pool } from 'pg';
import Redis from 'ioredis';

describe('Fuel Satellite - Portfolio Rebalancing Strategy Testing', () => {
  let portfolioRebalancer: PortfolioRebalancer;
  let tradeExecutor: TradeExecutor;
  let pgPool: Pool;
  let redisClient: Redis;
  let aiClient: any;
  let logger: any;

  // Mock portfolio data
  const mockPortfolio = {
    totalValue: 100000,
    positions: [
      { asset: 'ETH', value: 40000, quantity: 25, price: 1600, allocation: 0.40 },
      { asset: 'BTC', value: 30000, quantity: 1, price: 30000, allocation: 0.30 },
      { asset: 'MATIC', value: 10000, quantity: 12500, price: 0.80, allocation: 0.10 },
      { asset: 'SOL', value: 10000, quantity: 500, price: 20, allocation: 0.10 },
      { asset: 'USDC', value: 10000, quantity: 10000, price: 1, allocation: 0.10 }
    ],
    metadata: {
      lastRebalance: new Date('2024-01-01'),
      rebalanceCount: 12,
      totalFeesPaid: 500,
      performanceVsBenchmark: 0.05
    }
  };

  beforeAll(async () => {
    // Initialize dependencies
    pgPool = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'yieldsense_test',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres'
    });

    redisClient = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      lazyConnect: true
    });

    aiClient = getUnifiedAIClient();
    logger = getLogger({ name: 'fuel-rebalancing-test' });

    // Initialize rebalancing components
    portfolioRebalancer = new PortfolioRebalancer({
      rebalanceThreshold: 0.05, // 5% deviation triggers rebalance
      minTradeSize: 100, // $100 minimum trade
      maxSlippage: 0.01, // 1% max slippage
      preferredDEXs: ['uniswap-v3', 'curve', 'balancer'],
      strategies: ['threshold', 'calendar', 'volatility', 'correlation'],
      emergencyRebalance: true
    }, pgPool, redisClient, aiClient, logger);

    tradeExecutor = new TradeExecutor({
      maxRetries: 3,
      slippageProtection: true,
      mevProtection: true,
      executionDelay: 100 // ms between trades
    }, logger);

    await portfolioRebalancer.initialize();
  });

  afterAll(async () => {
    if (pgPool) {
      await pgPool.end();
    }
    if (redisClient) {
      await redisClient.quit();
    }
  });

  describe('Rebalancing Trigger Detection', () => {
    
    test('should detect threshold-based rebalancing needs', async () => {
      const targetAllocation = {
        'ETH': 0.35,    // Target 35%, Current 40% - needs rebalance
        'BTC': 0.35,    // Target 35%, Current 30% - needs rebalance
        'MATIC': 0.10,  // Target 10%, Current 10% - no change
        'SOL': 0.10,    // Target 10%, Current 10% - no change
        'USDC': 0.10    // Target 10%, Current 10% - no change
      };

      const rebalanceCheck = await portfolioRebalancer.checkRebalancingNeeded(
        mockPortfolio,
        targetAllocation
      );

      expect(rebalanceCheck).toBeDefined();
      expect(rebalanceCheck.needed).toBe(true);
      expect(rebalanceCheck.triggers).toBeDefined();
      expect(rebalanceCheck.triggers.length).toBeGreaterThan(0);

      // Should identify ETH and BTC as needing rebalance
      const ethTrigger = rebalanceCheck.triggers.find(t => t.asset === 'ETH');
      const btcTrigger = rebalanceCheck.triggers.find(t => t.asset === 'BTC');

      expect(ethTrigger).toBeDefined();
      expect(ethTrigger.currentAllocation).toBe(0.40);
      expect(ethTrigger.targetAllocation).toBe(0.35);
      expect(ethTrigger.deviation).toBeCloseTo(0.05, 2);
      expect(ethTrigger.deviationPercentage).toBeCloseTo(14.29, 1);

      expect(btcTrigger).toBeDefined();
      expect(btcTrigger.deviation).toBeCloseTo(-0.05, 2);

      // Verify urgency calculation
      expect(rebalanceCheck.urgency).toBeDefined();
      expect(['low', 'medium', 'high', 'critical']).toContain(rebalanceCheck.urgency);
    });

    test('should respect minimum trade size constraints', async () => {
      const smallDeviation = {
        'ETH': 0.401,   // 0.1% deviation - below threshold
        'BTC': 0.299,   // 0.1% deviation - below threshold
        'MATIC': 0.10,
        'SOL': 0.10,
        'USDC': 0.10
      };

      const rebalanceCheck = await portfolioRebalancer.checkRebalancingNeeded(
        mockPortfolio,
        smallDeviation
      );

      expect(rebalanceCheck.needed).toBe(false);
      expect(rebalanceCheck.reason).toContain('below threshold');
      expect(rebalanceCheck.smallDeviations).toBeDefined();
      expect(rebalanceCheck.smallDeviations.length).toBeGreaterThan(0);
    });

    test('should detect calendar-based rebalancing', async () => {
      const calendarConfig = {
        frequency: 'monthly',
        lastRebalance: new Date('2024-01-01'),
        currentDate: new Date('2024-02-05')
      };

      const calendarCheck = await portfolioRebalancer.checkCalendarRebalance(
        calendarConfig
      );

      expect(calendarCheck).toBeDefined();
      expect(calendarCheck.due).toBe(true);
      expect(calendarCheck.daysSinceLastRebalance).toBe(35);
      expect(calendarCheck.nextScheduledDate).toBeDefined();
      expect(calendarCheck.recommendation).toBeDefined();
    });

    test('should detect volatility-triggered rebalancing', async () => {
      const volatilityData = {
        portfolio: mockPortfolio,
        marketVolatility: {
          'ETH': 0.85,  // 85% annualized volatility - high
          'BTC': 0.75,  // 75% annualized volatility - high
          'MATIC': 1.2, // 120% annualized volatility - very high
          'SOL': 1.0,   // 100% annualized volatility - very high
          'USDC': 0.01  // 1% annualized volatility - stable
        },
        volatilityThreshold: 0.8 // 80% triggers rebalance
      };

      const volatilityCheck = await portfolioRebalancer.checkVolatilityRebalance(
        volatilityData
      );

      expect(volatilityCheck).toBeDefined();
      expect(volatilityCheck.triggered).toBe(true);
      expect(volatilityCheck.highVolatilityAssets).toBeDefined();
      expect(volatilityCheck.highVolatilityAssets).toContain('MATIC');
      expect(volatilityCheck.highVolatilityAssets).toContain('SOL');

      expect(volatilityCheck.recommendation).toBeDefined();
      expect(volatilityCheck.recommendation.action).toBeDefined();
      expect(volatilityCheck.recommendation.riskReduction).toBeGreaterThan(0);
    });
  });

  describe('Allocation Optimization Algorithms', () => {
    
    test('should optimize allocation using Modern Portfolio Theory', async () => {
      const optimizationParams = {
        assets: ['ETH', 'BTC', 'MATIC', 'SOL', 'USDC'],
        constraints: {
          minAllocation: 0.05,  // 5% minimum per asset
          maxAllocation: 0.40,  // 40% maximum per asset
          targetReturn: 0.15,   // 15% annual return target
          maxRisk: 0.25        // 25% max portfolio volatility
        },
        historicalData: {
          returns: {
            'ETH': [0.05, -0.10, 0.15, 0.08, -0.05],
            'BTC': [0.03, -0.08, 0.12, 0.10, -0.03],
            'MATIC': [0.10, -0.15, 0.20, 0.05, -0.08],
            'SOL': [0.08, -0.12, 0.18, 0.03, -0.10],
            'USDC': [0.001, 0.001, 0.001, 0.001, 0.001]
          }
        }
      };

      const optimizedAllocation = await portfolioRebalancer.optimizeAllocation(
        optimizationParams,
        'modern_portfolio_theory'
      );

      expect(optimizedAllocation).toBeDefined();
      expect(optimizedAllocation.allocations).toBeDefined();
      
      // Verify allocation constraints
      let totalAllocation = 0;
      Object.entries(optimizedAllocation.allocations).forEach(([asset, allocation]) => {
        expect(allocation).toBeGreaterThanOrEqual(0.05);
        expect(allocation).toBeLessThanOrEqual(0.40);
        totalAllocation += allocation;
      });
      expect(totalAllocation).toBeCloseTo(1.0, 4);

      // Verify optimization metrics
      expect(optimizedAllocation.metrics).toBeDefined();
      expect(optimizedAllocation.metrics.expectedReturn).toBeDefined();
      expect(optimizedAllocation.metrics.expectedRisk).toBeDefined();
      expect(optimizedAllocation.metrics.sharpeRatio).toBeDefined();
      expect(optimizedAllocation.metrics.efficientFrontier).toBeDefined();

      // Should include stable asset for risk reduction
      expect(optimizedAllocation.allocations.USDC).toBeGreaterThan(0);
    });

    test('should optimize using Risk Parity strategy', async () => {
      const riskParityParams = {
        assets: ['ETH', 'BTC', 'MATIC', 'SOL', 'USDC'],
        riskBudgets: {
          'ETH': 0.25,
          'BTC': 0.25,
          'MATIC': 0.20,
          'SOL': 0.20,
          'USDC': 0.10
        },
        covariance: [
          [0.04, 0.03, 0.025, 0.028, 0.0001],  // ETH
          [0.03, 0.035, 0.022, 0.025, 0.0001], // BTC
          [0.025, 0.022, 0.06, 0.04, 0.0002],  // MATIC
          [0.028, 0.025, 0.04, 0.055, 0.0002], // SOL
          [0.0001, 0.0001, 0.0002, 0.0002, 0.00001] // USDC
        ]
      };

      const riskParityAllocation = await portfolioRebalancer.optimizeAllocation(
        riskParityParams,
        'risk_parity'
      );

      expect(riskParityAllocation).toBeDefined();
      expect(riskParityAllocation.allocations).toBeDefined();

      // Verify risk contributions match budgets
      expect(riskParityAllocation.riskContributions).toBeDefined();
      Object.entries(riskParityAllocation.riskContributions).forEach(([asset, contribution]) => {
        const budget = riskParityParams.riskBudgets[asset];
        expect(contribution).toBeCloseTo(budget, 1);
      });

      // Lower risk assets should have higher allocations
      expect(riskParityAllocation.allocations.USDC).toBeGreaterThan(
        riskParityAllocation.allocations.MATIC
      );

      // Verify equal risk contribution
      expect(riskParityAllocation.metrics.riskParityScore).toBeGreaterThan(0.9);
    });

    test('should optimize using Black-Litterman model with views', async () => {
      const blackLittermanParams = {
        marketCapWeights: {
          'ETH': 0.20,
          'BTC': 0.50,
          'MATIC': 0.05,
          'SOL': 0.05,
          'USDC': 0.20
        },
        views: [
          {
            assets: ['ETH'],
            expectedReturn: 0.20,
            confidence: 0.8
          },
          {
            assets: ['BTC', 'ETH'],
            relativeReturn: 0.05, // BTC outperforms ETH by 5%
            confidence: 0.6
          }
        ],
        riskAversion: 2.5,
        tau: 0.05
      };

      const blackLittermanAllocation = await portfolioRebalancer.optimizeAllocation(
        blackLittermanParams,
        'black_litterman'
      );

      expect(blackLittermanAllocation).toBeDefined();
      expect(blackLittermanAllocation.allocations).toBeDefined();

      // Views should tilt allocation towards ETH
      expect(blackLittermanAllocation.allocations.ETH).toBeGreaterThan(
        blackLittermanParams.marketCapWeights.ETH
      );

      // Verify posterior returns incorporate views
      expect(blackLittermanAllocation.posteriorReturns).toBeDefined();
      expect(blackLittermanAllocation.posteriorReturns.ETH).toBeGreaterThan(
        blackLittermanAllocation.posteriorReturns.MATIC
      );

      // Confidence should affect allocation magnitude
      expect(blackLittermanAllocation.viewsImpact).toBeDefined();
      expect(blackLittermanAllocation.viewsImpact[0].impact).toBeGreaterThan(
        blackLittermanAllocation.viewsImpact[1].impact
      );
    });

    test('should handle correlation-based allocation adjustments', async () => {
      const correlationData = {
        assets: ['ETH', 'BTC', 'MATIC', 'SOL'],
        correlationMatrix: [
          [1.0, 0.85, 0.70, 0.75],  // ETH highly correlated with others
          [0.85, 1.0, 0.65, 0.70],  // BTC
          [0.70, 0.65, 1.0, 0.80],  // MATIC
          [0.75, 0.70, 0.80, 1.0]   // SOL
        ],
        maxCorrelation: 0.7 // Reduce allocation if correlation > 0.7
      };

      const correlationAdjusted = await portfolioRebalancer.adjustForCorrelation(
        { 'ETH': 0.30, 'BTC': 0.30, 'MATIC': 0.20, 'SOL': 0.20 },
        correlationData
      );

      expect(correlationAdjusted).toBeDefined();
      expect(correlationAdjusted.adjustedAllocations).toBeDefined();
      
      // Should reduce allocations for highly correlated assets
      expect(correlationAdjusted.adjustedAllocations.ETH).toBeLessThan(0.30);
      expect(correlationAdjusted.adjustedAllocations.BTC).toBeLessThan(0.30);

      // Verify diversification improvement
      expect(correlationAdjusted.metrics).toBeDefined();
      expect(correlationAdjusted.metrics.diversificationRatio).toBeGreaterThan(1);
      expect(correlationAdjusted.metrics.effectiveAssets).toBeGreaterThan(2);
      expect(correlationAdjusted.metrics.concentrationRisk).toBeLessThan(0.5);
    });
  });

  describe('Rebalancing Execution Planning', () => {
    
    test('should create optimal trade execution plan', async () => {
      const rebalancingPlan = {
        currentAllocations: {
          'ETH': 0.40,
          'BTC': 0.30,
          'MATIC': 0.10,
          'SOL': 0.10,
          'USDC': 0.10
        },
        targetAllocations: {
          'ETH': 0.35,
          'BTC': 0.35,
          'MATIC': 0.10,
          'SOL': 0.10,
          'USDC': 0.10
        },
        portfolioValue: 100000
      };

      const executionPlan = await portfolioRebalancer.createExecutionPlan(
        rebalancingPlan
      );

      expect(executionPlan).toBeDefined();
      expect(executionPlan.trades).toBeDefined();
      expect(executionPlan.trades.length).toBeGreaterThan(0);

      // Should sell ETH and buy BTC
      const ethTrade = executionPlan.trades.find(t => t.asset === 'ETH');
      const btcTrade = executionPlan.trades.find(t => t.asset === 'BTC');

      expect(ethTrade).toBeDefined();
      expect(ethTrade.action).toBe('sell');
      expect(ethTrade.amount).toBeCloseTo(5000, -1); // $5000

      expect(btcTrade).toBeDefined();
      expect(btcTrade.action).toBe('buy');
      expect(btcTrade.amount).toBeCloseTo(5000, -1);

      // Verify execution order optimization
      expect(executionPlan.executionOrder).toBeDefined();
      expect(executionPlan.executionOrder[0].action).toBe('sell'); // Sells before buys

      // Verify cost estimates
      expect(executionPlan.estimatedCosts).toBeDefined();
      expect(executionPlan.estimatedCosts.tradingFees).toBeGreaterThan(0);
      expect(executionPlan.estimatedCosts.slippage).toBeGreaterThan(0);
      expect(executionPlan.estimatedCosts.gasEstimate).toBeGreaterThan(0);
    });

    test('should optimize trade routing across DEXs', async () => {
      const largeTrade = {
        asset: 'ETH',
        action: 'sell',
        amount: 20000, // $20k - large trade
        urgency: 'normal'
      };

      const routingPlan = await portfolioRebalancer.optimizeTradeRouting(largeTrade);

      expect(routingPlan).toBeDefined();
      expect(routingPlan.routes).toBeDefined();
      expect(routingPlan.routes.length).toBeGreaterThan(1); // Should split across DEXs

      routingPlan.routes.forEach(route => {
        expect(route.dex).toBeDefined();
        expect(route.amount).toBeGreaterThan(0);
        expect(route.expectedPrice).toBeGreaterThan(0);
        expect(route.liquidity).toBeGreaterThan(0);
        expect(route.estimatedSlippage).toBeDefined();
      });

      // Verify optimal split
      const totalRouted = routingPlan.routes.reduce((sum, r) => sum + r.amount, 0);
      expect(totalRouted).toBe(largeTrade.amount);

      // Should prioritize DEXs with better liquidity
      expect(routingPlan.routes[0].liquidity).toBeGreaterThanOrEqual(
        routingPlan.routes[routingPlan.routes.length - 1].liquidity
      );

      // Verify aggregated metrics
      expect(routingPlan.aggregatedMetrics).toBeDefined();
      expect(routingPlan.aggregatedMetrics.effectivePrice).toBeDefined();
      expect(routingPlan.aggregatedMetrics.totalSlippage).toBeLessThan(0.01); // < 1%
      expect(routingPlan.aggregatedMetrics.executionTime).toBeDefined();
    });

    test('should handle partial fills and execution failures', async () => {
      const executionResult = {
        plannedTrades: [
          { id: '1', asset: 'ETH', action: 'sell', amount: 5000, status: 'completed' },
          { id: '2', asset: 'BTC', action: 'buy', amount: 3000, status: 'partial', filled: 2000 },
          { id: '3', asset: 'SOL', action: 'buy', amount: 2000, status: 'failed', error: 'Insufficient liquidity' }
        ]
      };

      const recoveryPlan = await portfolioRebalancer.handleExecutionFailures(
        executionResult
      );

      expect(recoveryPlan).toBeDefined();
      expect(recoveryPlan.strategy).toBeDefined();
      expect(['retry', 'adjust', 'rollback', 'manual']).toContain(recoveryPlan.strategy);

      // Should have specific actions for each status
      expect(recoveryPlan.actions).toBeDefined();
      
      const btcAction = recoveryPlan.actions.find(a => a.asset === 'BTC');
      expect(btcAction).toBeDefined();
      expect(btcAction.action).toBe('complete_fill');
      expect(btcAction.remainingAmount).toBe(1000);

      const solAction = recoveryPlan.actions.find(a => a.asset === 'SOL');
      expect(solAction).toBeDefined();
      expect(solAction.alternatives).toBeDefined();
      expect(solAction.alternatives.length).toBeGreaterThan(0);

      // Verify portfolio state tracking
      expect(recoveryPlan.portfolioState).toBeDefined();
      expect(recoveryPlan.portfolioState.isBalanced).toBe(false);
      expect(recoveryPlan.portfolioState.deviationFromTarget).toBeGreaterThan(0);
    });

    test('should implement smart order routing with MEV protection', async () => {
      const sensitiveRebalance = {
        trades: [
          { asset: 'ETH', action: 'sell', amount: 50000 }, // Large trade
          { asset: 'BTC', action: 'buy', amount: 50000 }
        ],
        requiresMEVProtection: true
      };

      const protectedExecution = await portfolioRebalancer.executeWithMEVProtection(
        sensitiveRebalance
      );

      expect(protectedExecution).toBeDefined();
      expect(protectedExecution.strategy).toBeDefined();
      expect(['flashbots', 'cowswap', 'private_pool', 'time_randomization'])
        .toContain(protectedExecution.strategy);

      // Verify execution details based on strategy
      if (protectedExecution.strategy === 'flashbots') {
        expect(protectedExecution.bundleConfig).toBeDefined();
        expect(protectedExecution.bundleConfig.maxBlocksInFuture).toBeDefined();
        expect(protectedExecution.bundleConfig.minTimestamp).toBeDefined();
      } else if (protectedExecution.strategy === 'cowswap') {
        expect(protectedExecution.batchAuction).toBeDefined();
        expect(protectedExecution.batchAuction.expectedSettlement).toBeDefined();
        expect(protectedExecution.batchAuction.limitPrice).toBeDefined();
      }

      // Verify MEV protection metrics
      expect(protectedExecution.protection).toBeDefined();
      expect(protectedExecution.protection.sandwichResistance).toBeGreaterThan(0.9);
      expect(protectedExecution.protection.frontrunProtection).toBe(true);
      expect(protectedExecution.protection.expectedSavings).toBeGreaterThan(0);
    });
  });

  describe('Rebalancing Performance Analysis', () => {
    
    test('should track rebalancing performance metrics', async () => {
      const rebalancingHistory = [
        {
          date: new Date('2024-01-01'),
          trades: 5,
          totalVolume: 50000,
          costs: 150,
          slippage: 0.005,
          performanceImpact: 0.002
        },
        {
          date: new Date('2024-02-01'),
          trades: 3,
          totalVolume: 30000,
          costs: 90,
          slippage: 0.003,
          performanceImpact: -0.001
        }
      ];

      const performanceAnalysis = await portfolioRebalancer.analyzeRebalancingPerformance(
        rebalancingHistory,
        { period: 'quarterly' }
      );

      expect(performanceAnalysis).toBeDefined();
      expect(performanceAnalysis.summary).toBeDefined();
      expect(performanceAnalysis.summary.totalRebalances).toBe(2);
      expect(performanceAnalysis.summary.totalCosts).toBe(240);
      expect(performanceAnalysis.summary.averageSlippage).toBeCloseTo(0.004, 3);

      // Cost analysis
      expect(performanceAnalysis.costAnalysis).toBeDefined();
      expect(performanceAnalysis.costAnalysis.costPerTrade).toBeDefined();
      expect(performanceAnalysis.costAnalysis.costAsPercentOfVolume).toBeDefined();
      expect(performanceAnalysis.costAnalysis.annualizedCostDrag).toBeDefined();

      // Performance attribution
      expect(performanceAnalysis.attribution).toBeDefined();
      expect(performanceAnalysis.attribution.rebalancingAlpha).toBeDefined();
      expect(performanceAnalysis.attribution.timingContribution).toBeDefined();
      expect(performanceAnalysis.attribution.costDrag).toBeLessThan(0);

      // Optimization suggestions
      expect(performanceAnalysis.recommendations).toBeDefined();
      expect(performanceAnalysis.recommendations.length).toBeGreaterThan(0);
      performanceAnalysis.recommendations.forEach(rec => {
        expect(rec.category).toBeDefined();
        expect(rec.suggestion).toBeDefined();
        expect(rec.expectedImprovement).toBeDefined();
      });
    });

    test('should compare rebalancing strategies effectiveness', async () => {
      const strategyComparison = await portfolioRebalancer.compareStrategies({
        strategies: ['threshold', 'calendar', 'volatility', 'correlation'],
        historicalPeriod: 365, // days
        portfolio: mockPortfolio
      });

      expect(strategyComparison).toBeDefined();
      expect(strategyComparison.results).toBeDefined();
      expect(strategyComparison.results.length).toBe(4);

      strategyComparison.results.forEach(result => {
        expect(result.strategy).toBeDefined();
        expect(result.metrics).toBeDefined();
        expect(result.metrics.totalReturn).toBeDefined();
        expect(result.metrics.volatility).toBeDefined();
        expect(result.metrics.sharpeRatio).toBeDefined();
        expect(result.metrics.maxDrawdown).toBeDefined();
        expect(result.metrics.rebalanceCount).toBeDefined();
        expect(result.metrics.totalCosts).toBeDefined();
      });

      // Verify ranking
      expect(strategyComparison.ranking).toBeDefined();
      expect(strategyComparison.ranking[0].sharpeRatio).toBeGreaterThanOrEqual(
        strategyComparison.ranking[strategyComparison.ranking.length - 1].sharpeRatio
      );

      // Best strategy recommendation
      expect(strategyComparison.recommendation).toBeDefined();
      expect(strategyComparison.recommendation.bestStrategy).toBeDefined();
      expect(strategyComparison.recommendation.reasoning).toBeDefined();
      expect(strategyComparison.recommendation.confidenceScore).toBeGreaterThan(0.5);
    });

    test('should generate rebalancing efficiency report', async () => {
      const efficiencyReport = await portfolioRebalancer.generateEfficiencyReport({
        period: 'annual',
        includeProjections: true
      });

      expect(efficiencyReport).toBeDefined();
      
      // Efficiency metrics
      expect(efficiencyReport.efficiency).toBeDefined();
      expect(efficiencyReport.efficiency.executionEfficiency).toBeGreaterThan(0.9);
      expect(efficiencyReport.efficiency.costEfficiency).toBeGreaterThan(0.95);
      expect(efficiencyReport.efficiency.timingEfficiency).toBeDefined();

      // Trade analysis
      expect(efficiencyReport.tradeAnalysis).toBeDefined();
      expect(efficiencyReport.tradeAnalysis.averageTradeSize).toBeDefined();
      expect(efficiencyReport.tradeAnalysis.optimalTradeSize).toBeDefined();
      expect(efficiencyReport.tradeAnalysis.unnecessaryTrades).toBeDefined();

      // Cost breakdown
      expect(efficiencyReport.costBreakdown).toBeDefined();
      expect(efficiencyReport.costBreakdown.tradingFees).toBeDefined();
      expect(efficiencyReport.costBreakdown.slippageCosts).toBeDefined();
      expect(efficiencyReport.costBreakdown.gasCosts).toBeDefined();
      expect(efficiencyReport.costBreakdown.opportunityCost).toBeDefined();

      // Future projections if included
      if (efficiencyReport.projections) {
        expect(efficiencyReport.projections.expectedRebalances).toBeDefined();
        expect(efficiencyReport.projections.projectedCosts).toBeDefined();
        expect(efficiencyReport.projections.potentialSavings).toBeDefined();
      }
    });
  });

  describe('AI-Enhanced Rebalancing Decisions', () => {
    
    test('should use AI for market timing optimization', async () => {
      const marketContext = {
        currentConditions: {
          trend: 'bullish',
          volatility: 'high',
          correlation: 'increasing',
          liquidityDepth: 'moderate'
        },
        recentEvents: [
          'Fed rate decision pending',
          'Major protocol upgrade for ETH',
          'Regulatory clarity improving'
        ]
      };

      const aiTimingAdvice = await portfolioRebalancer.getAITimingRecommendation(
        mockPortfolio,
        marketContext
      );

      expect(aiTimingAdvice).toBeDefined();
      expect(aiTimingAdvice.recommendation).toBeDefined();
      expect(['rebalance_now', 'wait_1_day', 'wait_1_week', 'wait_for_event'])
        .toContain(aiTimingAdvice.recommendation);

      expect(aiTimingAdvice.reasoning).toBeDefined();
      expect(aiTimingAdvice.confidence).toBeGreaterThan(0);
      expect(aiTimingAdvice.confidence).toBeLessThanOrEqual(1);

      // Market insights
      expect(aiTimingAdvice.marketInsights).toBeDefined();
      expect(aiTimingAdvice.marketInsights.length).toBeGreaterThan(0);

      // Alternative scenarios
      expect(aiTimingAdvice.scenarios).toBeDefined();
      expect(aiTimingAdvice.scenarios.optimistic).toBeDefined();
      expect(aiTimingAdvice.scenarios.pessimistic).toBeDefined();
      expect(aiTimingAdvice.scenarios.mostLikely).toBeDefined();
    });

    test('should provide AI-powered allocation suggestions', async () => {
      const allocationRequest = {
        investorProfile: {
          riskTolerance: 'moderate',
          investmentHorizon: '3-5 years',
          preferences: ['sustainability', 'innovation'],
          restrictions: ['no_meme_coins']
        },
        marketOutlook: 'cautiously_optimistic',
        currentPortfolio: mockPortfolio
      };

      const aiAllocation = await portfolioRebalancer.getAIAllocationSuggestion(
        allocationRequest
      );

      expect(aiAllocation).toBeDefined();
      expect(aiAllocation.suggestedAllocation).toBeDefined();
      
      // Verify allocation sums to 100%
      const totalAllocation = Object.values(aiAllocation.suggestedAllocation)
        .reduce((sum, alloc) => sum + alloc, 0);
      expect(totalAllocation).toBeCloseTo(1.0, 4);

      // Reasoning for each allocation
      expect(aiAllocation.allocationReasoning).toBeDefined();
      Object.keys(aiAllocation.suggestedAllocation).forEach(asset => {
        expect(aiAllocation.allocationReasoning[asset]).toBeDefined();
      });

      // Risk analysis
      expect(aiAllocation.riskAnalysis).toBeDefined();
      expect(aiAllocation.riskAnalysis.portfolioRisk).toBeDefined();
      expect(aiAllocation.riskAnalysis.diversificationScore).toBeGreaterThan(0.5);
      expect(aiAllocation.riskAnalysis.downriskProtection).toBeDefined();

      // Alignment with preferences
      expect(aiAllocation.preferenceAlignment).toBeDefined();
      expect(aiAllocation.preferenceAlignment.sustainability).toBeGreaterThan(0.5);
      expect(aiAllocation.preferenceAlignment.innovation).toBeGreaterThan(0.5);
    });
  });

  describe('Integration with Multi-Wallet Management', () => {
    
    test('should coordinate rebalancing across multiple wallets', async () => {
      const multiWalletPortfolio = {
        wallets: [
          {
            address: '0x1234...',
            chain: 'ethereum',
            positions: [
              { asset: 'ETH', value: 20000 },
              { asset: 'USDC', value: 5000 }
            ]
          },
          {
            address: '0x5678...',
            chain: 'polygon',
            positions: [
              { asset: 'MATIC', value: 10000 },
              { asset: 'USDC', value: 5000 }
            ]
          },
          {
            address: '0x9012...',
            chain: 'arbitrum',
            positions: [
              { asset: 'ETH', value: 20000 },
              { asset: 'BTC', value: 30000 }
            ]
          }
        ],
        totalValue: 90000,
        targetAllocation: {
          'ETH': 0.40,
          'BTC': 0.30,
          'MATIC': 0.10,
          'USDC': 0.20
        }
      };

      const multiWalletRebalance = await portfolioRebalancer.planMultiWalletRebalance(
        multiWalletPortfolio
      );

      expect(multiWalletRebalance).toBeDefined();
      expect(multiWalletRebalance.walletActions).toBeDefined();
      expect(multiWalletRebalance.walletActions.length).toBe(3);

      // Verify each wallet has specific actions
      multiWalletRebalance.walletActions.forEach(walletAction => {
        expect(walletAction.wallet).toBeDefined();
        expect(walletAction.chain).toBeDefined();
        expect(walletAction.trades).toBeDefined();
        expect(walletAction.estimatedGasCost).toBeGreaterThan(0);
      });

      // Cross-chain coordination
      expect(multiWalletRebalance.crossChainTransfers).toBeDefined();
      if (multiWalletRebalance.crossChainTransfers.length > 0) {
        multiWalletRebalance.crossChainTransfers.forEach(transfer => {
          expect(transfer.fromChain).toBeDefined();
          expect(transfer.toChain).toBeDefined();
          expect(transfer.asset).toBeDefined();
          expect(transfer.amount).toBeGreaterThan(0);
          expect(transfer.bridgeProtocol).toBeDefined();
        });
      }

      // Optimization metrics
      expect(multiWalletRebalance.optimization).toBeDefined();
      expect(multiWalletRebalance.optimization.minimizedTransfers).toBe(true);
      expect(multiWalletRebalance.optimization.totalGasSaved).toBeGreaterThan(0);
      expect(multiWalletRebalance.optimization.executionComplexity).toBeDefined();
    });

    test('should integrate with ElizaOS wallet plugins', async () => {
      const elizaOSIntegration = await portfolioRebalancer.integrateWithElizaOS({
        walletPlugin: '@elizaos/plugin-wallet',
        enableRebalancing: true,
        autoExecute: false
      });

      expect(elizaOSIntegration).toBeDefined();
      expect(elizaOSIntegration.status).toBe('connected');
      expect(elizaOSIntegration.capabilities).toBeDefined();
      expect(elizaOSIntegration.capabilities.multiWalletSupport).toBe(true);
      expect(elizaOSIntegration.capabilities.autoRebalancing).toBe(true);

      // Test rebalancing through ElizaOS
      const elizaRebalanceRequest = {
        plugin: '@elizaos/plugin-wallet',
        action: 'rebalance',
        params: {
          strategy: 'risk_parity',
          urgency: 'normal'
        }
      };

      const elizaRebalance = await elizaOSIntegration.hooks.rebalance(
        elizaRebalanceRequest
      );

      expect(elizaRebalance).toBeDefined();
      expect(elizaRebalance.plan).toBeDefined();
      expect(elizaRebalance.requiresApproval).toBe(true);
      expect(elizaRebalance.estimatedImpact).toBeDefined();
      expect(elizaRebalance.executionSteps).toBeDefined();
    });
  });
});

/**
 * Portfolio Rebalancing Strategy Testing Summary
 * 
 * This test suite validates:
 * ✅ Threshold-based rebalancing trigger detection
 * ✅ Minimum trade size constraint enforcement
 * ✅ Calendar-based rebalancing scheduling
 * ✅ Volatility-triggered rebalancing logic
 * ✅ Modern Portfolio Theory optimization
 * ✅ Risk Parity allocation strategies
 * ✅ Black-Litterman model with market views
 * ✅ Correlation-based allocation adjustments
 * ✅ Optimal trade execution planning
 * ✅ Multi-DEX trade routing optimization
 * ✅ Partial fill and failure recovery
 * ✅ MEV protection implementation
 * ✅ Rebalancing performance tracking and analysis
 * ✅ Strategy comparison and effectiveness measurement
 * ✅ AI-enhanced market timing and allocation
 * ✅ Multi-wallet rebalancing coordination
 * ✅ ElizaOS plugin integration
 * 
 * Test Coverage: Comprehensive coverage of all rebalancing features
 * Optimization: Multiple allocation algorithms with constraints
 * Execution: Smart routing and failure handling
 * Integration: Multi-wallet and ElizaOS support
 */