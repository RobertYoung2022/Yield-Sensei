/**
 * Evaluation System Integration Test Suite
 * End-to-end testing of the complete opportunity evaluation pipeline
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { OpportunityEvaluator } from '../opportunity-evaluator';
import { ExecutionFeasibilityAnalyzer } from '../execution-feasibility-analyzer';
import { ProfitabilityCalculator } from '../profitability-calculator';
import { RiskAssessmentEngine } from '../risk-assessment-engine';
import { OpportunityScoringEngine } from '../opportunity-scoring-engine';
import { ArbitrageOpportunity, ChainID, AssetID } from '../../types';

// Real implementations for integration testing
describe('Evaluation System Integration', () => {
  let evaluator: OpportunityEvaluator;
  let realFeasibilityAnalyzer: ExecutionFeasibilityAnalyzer;
  let realProfitabilityCalculator: ProfitabilityCalculator;
  let realRiskEngine: RiskAssessmentEngine;
  let realScoringEngine: OpportunityScoringEngine;

  beforeEach(async () => {
    // Use real implementations for integration testing
    realFeasibilityAnalyzer = new ExecutionFeasibilityAnalyzer();
    realProfitabilityCalculator = new ProfitabilityCalculator();
    realRiskEngine = new RiskAssessmentEngine();
    realScoringEngine = new OpportunityScoringEngine();

    const config = {
      risk: {
        maxAcceptableRisk: 70,
        riskTolerance: 'moderate' as const
      },
      profitability: {
        minProfitThreshold: 100,
        minMarginThreshold: 0.05
      },
      feasibility: {
        minFeasibilityScore: 50,
        maxExecutionTime: 300
      }
    };

    evaluator = new OpportunityEvaluator(config);
    
    // Initialize all components
    await Promise.all([
      evaluator.initialize(),
      realFeasibilityAnalyzer.initialize?.(),
      realProfitabilityCalculator.initialize?.(),
      realRiskEngine.initialize?.(),
      realScoringEngine.initialize?.()
    ]);
  });

  describe('End-to-End Opportunity Evaluation', () => {
    it('should evaluate a complete real-world arbitrage scenario', async () => {
      // Simulate a realistic USDC arbitrage opportunity between Ethereum and Polygon
      const realWorldOpportunity: ArbitrageOpportunity = {
        id: 'real-world-usdc-eth-poly',
        assetId: 'USDC' as AssetID,
        sourceChain: 'ethereum' as ChainID,
        targetChain: 'polygon' as ChainID,
        sourcePrice: 1.0000,
        targetPrice: 0.9965, // 0.35% price difference
        priceDifference: 0.0035,
        percentageDifference: 0.35,
        expectedProfit: 875, // $875 on $250k trade
        estimatedGasCost: 120, // ~$120 in ETH gas
        bridgeFee: 75, // ~$75 bridge fee
        netProfit: 680, // $680 net
        profitMargin: 0.777,
        executionTime: 180, // 3 minutes
        riskScore: 35, // Low-medium risk
        confidence: 0.85,
        timestamp: Date.now(),
        executionPaths: [
          {
            id: 'stargate-bridge-path',
            steps: [
              { action: 'approve_usdc', chain: 'ethereum' as ChainID, dex: 'uniswap', gasEstimate: 45 },
              { action: 'swap_usdc_to_bridge_token', chain: 'ethereum' as ChainID, dex: 'uniswap', gasEstimate: 75 },
              { action: 'bridge_transfer', chain: 'ethereum' as ChainID, bridge: 'stargate', gasEstimate: 85 },
              { action: 'receive_on_polygon', chain: 'polygon' as ChainID, bridge: 'stargate', gasEstimate: 15 },
              { action: 'swap_to_usdc', chain: 'polygon' as ChainID, dex: 'quickswap', gasEstimate: 25 }
            ],
            totalGasEstimate: 245,
            estimatedTime: 180,
            successProbability: 0.85
          }
        ]
      };

      // Provide realistic market context
      const marketContext = {
        gasPrice: {
          ethereum: 45e9, // 45 gwei - moderate gas prices
          polygon: 30e9   // 30 gwei on Polygon
        },
        volatility: {
          USDC: 0.008 // 0.8% volatility - normal for stablecoins
        },
        liquidity: {
          ethereum: {
            uniswap: 50000000, // $50M USDC liquidity
            sushiswap: 25000000
          },
          polygon: {
            quickswap: 15000000, // $15M USDC liquidity
            sushiswap: 8000000
          }
        },
        bridgeHealth: {
          stargate: 0.92, // 92% health score
          hop: 0.88,
          across: 0.85
        },
        networkCongestion: {
          ethereum: 0.65, // Moderate congestion
          polygon: 0.25   // Low congestion
        }
      };

      const evaluation = await evaluator.evaluateOpportunity(realWorldOpportunity, marketContext);

      // Comprehensive validation of evaluation results
      expect(evaluation).toBeDefined();
      expect(evaluation.opportunityId).toBe('real-world-usdc-eth-poly');
      
      // Score validation
      expect(evaluation.finalScore).toBeGreaterThan(0);
      expect(evaluation.finalScore).toBeLessThanOrEqual(100);
      
      // Priority should be reasonable for this profitable opportunity
      expect(['high', 'medium', 'low'].includes(evaluation.priority)).toBe(true);
      
      // Comprehensive analysis components
      expect(evaluation.profitabilityAnalysis).toBeDefined();
      expect(evaluation.riskAssessment).toBeDefined();
      expect(evaluation.feasibilityAnalysis).toBeDefined();
      expect(evaluation.executionPlan).toBeDefined();
      expect(evaluation.keyMetrics).toBeDefined();

      // Profitability analysis validation
      expect(evaluation.profitabilityAnalysis.baseProfit.netProfit).toBeCloseTo(680, 0);
      expect(evaluation.profitabilityAnalysis.baseProfit.margin).toBeGreaterThan(0.7);
      
      // Risk assessment validation
      expect(evaluation.riskAssessment.overallRiskScore).toBeLessThan(50); // Should be low-medium risk
      expect(evaluation.riskAssessment.riskLevel).toMatch(/low|medium/);
      
      // Feasibility analysis validation
      expect(evaluation.feasibilityAnalysis.overallScore).toBeGreaterThan(60); // Should be quite feasible
      expect(evaluation.feasibilityAnalysis.technicalFeasibility.score).toBeGreaterThan(70);
      
      // Execution plan validation
      expect(evaluation.executionPlan.steps.length).toBeGreaterThan(3);
      expect(evaluation.executionPlan.estimatedDuration).toBeLessThan(300); // Under 5 minutes
      expect(evaluation.executionPlan.monitoringPoints.length).toBeGreaterThan(0);
      
      // Key metrics validation
      expect(evaluation.keyMetrics.riskAdjustedReturn).toBeGreaterThan(0);
      expect(evaluation.keyMetrics.efficiencyRatio).toBeGreaterThan(0);
      expect(evaluation.keyMetrics.probabilityOfSuccess).toBeGreaterThan(0.7);

      // Recommendation validation
      expect(evaluation.recommendation).toBeDefined();
      expect(['execute_immediately', 'execute_optimized', 'defer', 'reject'].includes(evaluation.recommendation.action)).toBe(true);
      expect(evaluation.recommendation.confidence).toBeGreaterThan(0.6);
      
      console.log(`Real-World USDC Arbitrage Evaluation:
        Final Score: ${evaluation.finalScore.toFixed(2)}
        Priority: ${evaluation.priority}
        Action: ${evaluation.recommendation.action}
        Confidence: ${evaluation.recommendation.confidence.toFixed(2)}
        Expected Profit: $${evaluation.keyMetrics.expectedReturn.toFixed(2)}
        Risk-Adjusted Return: $${evaluation.keyMetrics.riskAdjustedReturn.toFixed(2)}
        Execution Time: ${evaluation.executionPlan.estimatedDuration}s`);
    });

    it('should handle complex multi-asset, multi-chain scenarios', async () => {
      // Complex WETH arbitrage involving multiple chains and execution paths
      const complexOpportunity: ArbitrageOpportunity = {
        id: 'complex-weth-multi-chain',
        assetId: 'WETH' as AssetID,
        sourceChain: 'ethereum' as ChainID,
        targetChain: 'arbitrum' as ChainID,
        sourcePrice: 2150.00,
        targetPrice: 2135.50, // $14.50 difference
        priceDifference: 14.50,
        percentageDifference: 0.675,
        expectedProfit: 2900, // $2900 on $200k trade
        estimatedGasCost: 250, // Higher gas for ETH
        bridgeFee: 180, // Higher bridge fees for ETH
        netProfit: 2470,
        profitMargin: 0.852,
        executionTime: 240, // 4 minutes
        riskScore: 55, // Medium risk due to ETH volatility
        confidence: 0.78,
        timestamp: Date.now(),
        executionPaths: [
          {
            id: 'across-bridge-weth-path',
            steps: [
              { action: 'wrap_eth', chain: 'ethereum' as ChainID, dex: 'weth9', gasEstimate: 25 },
              { action: 'approve_weth', chain: 'ethereum' as ChainID, dex: 'uniswap', gasEstimate: 45 },
              { action: 'swap_weth_optimal', chain: 'ethereum' as ChainID, dex: 'uniswap', gasEstimate: 120 },
              { action: 'bridge_via_across', chain: 'ethereum' as ChainID, bridge: 'across', gasEstimate: 95 },
              { action: 'receive_on_arbitrum', chain: 'arbitrum' as ChainID, bridge: 'across', gasEstimate: 20 },
              { action: 'swap_back_to_weth', chain: 'arbitrum' as ChainID, dex: 'camelot', gasEstimate: 35 },
              { action: 'unwrap_if_needed', chain: 'arbitrum' as ChainID, dex: 'weth9', gasEstimate: 15 }
            ],
            totalGasEstimate: 355,
            estimatedTime: 240,
            successProbability: 0.78
          }
        ]
      };

      const complexMarketContext = {
        gasPrice: {
          ethereum: 75e9, // Higher gas prices
          arbitrum: 0.8e9
        },
        volatility: {
          WETH: 0.12, // 12% volatility - typical for ETH
          ETH: 0.12
        },
        liquidity: {
          ethereum: {
            uniswap: 100000000, // $100M WETH liquidity
            sushiswap: 40000000,
            balancer: 25000000
          },
          arbitrum: {
            camelot: 30000000, // $30M WETH liquidity
            sushiswap: 15000000,
            uniswap: 45000000
          }
        },
        bridgeHealth: {
          across: 0.89,
          stargate: 0.91,
          hop: 0.85
        },
        mevActivity: {
          ethereum: 0.85, // High MEV activity
          arbitrum: 0.35  // Lower MEV activity
        },
        priceImpact: {
          ethereum: 0.045, // 4.5% price impact
          arbitrum: 0.062  // 6.2% price impact
        }
      };

      const evaluation = await evaluator.evaluateOpportunity(complexOpportunity, complexMarketContext);

      // Complex scenario validation
      expect(evaluation.finalScore).toBeGreaterThan(30); // Should be viable despite complexity
      
      // Should identify complexity in execution plan
      expect(evaluation.executionPlan.steps.length).toBeGreaterThan(5);
      expect(evaluation.executionPlan.contingencyPlans.length).toBeGreaterThan(0);
      
      // Should account for ETH volatility in risk assessment
      expect(evaluation.riskAssessment.overallRiskScore).toBeGreaterThan(45);
      expect(evaluation.riskAssessment.marketRisk.score).toBeGreaterThan(40);
      
      // Should identify MEV risks
      expect(evaluation.riskAssessment.mevRisk.score).toBeGreaterThan(50);
      expect(evaluation.riskAssessment.mevRisk.protectionRecommended).toBe(true);
      
      // Should suggest optimizations for complex execution
      expect(evaluation.profitabilityAnalysis.optimizedCalculation.optimizations.length).toBeGreaterThan(0);
      
      // Should consider price impact in feasibility
      expect(evaluation.feasibilityAnalysis.bottlenecks.some(b => 
        b.type === 'price_impact' || b.type === 'liquidity_constraints'
      )).toBe(true);

      console.log(`Complex WETH Multi-Chain Evaluation:
        Final Score: ${evaluation.finalScore.toFixed(2)}
        Risk Score: ${evaluation.riskAssessment.overallRiskScore}
        MEV Risk: ${evaluation.riskAssessment.mevRisk.score}
        Execution Steps: ${evaluation.executionPlan.steps.length}
        Optimizations: ${evaluation.profitabilityAnalysis.optimizedCalculation.optimizations.length}`);
    });

    it('should properly reject unprofitable or high-risk opportunities', async () => {
      // High-risk, low-profit opportunity that should be rejected
      const badOpportunity: ArbitrageOpportunity = {
        id: 'high-risk-low-profit',
        assetId: 'USDC' as AssetID,
        sourceChain: 'ethereum' as ChainID,
        targetChain: 'fantom' as ChainID, // Less reliable bridge
        sourcePrice: 1.0000,
        targetPrice: 0.9988, // Only 0.12% difference  
        priceDifference: 0.0012,
        percentageDifference: 0.12,
        expectedProfit: 60, // Only $60 profit
        estimatedGasCost: 150, // High gas costs
        bridgeFee: 85, // High bridge fees
        netProfit: -175, // NEGATIVE profit
        profitMargin: -2.917,
        executionTime: 450, // Very slow execution
        riskScore: 88, // Very high risk
        confidence: 0.25, // Low confidence
        timestamp: Date.now() - 45000, // 45 seconds old - stale
        executionPaths: []
      };

      const badMarketContext = {
        gasPrice: {
          ethereum: 180e9, // Very high gas prices
          fantom: 50e9
        },
        volatility: {
          USDC: 0.025 // Higher than normal stablecoin volatility
        },
        bridgeHealth: {
          multichain: 0.62, // Poor bridge health
          anyswap: 0.58
        },
        networkCongestion: {
          ethereum: 0.95, // Severe congestion
          fantom: 0.8     // High congestion
        },
        liquidityFragmentation: {
          fantom: 0.45 // Poor liquidity distribution
        }
      };

      const evaluation = await evaluator.evaluateOpportunity(badOpportunity, badMarketContext);

      // Should properly reject bad opportunities
      expect(evaluation.finalScore).toBeLessThan(30); // Very low score
      expect(evaluation.priority).toBe('ignore');
      expect(evaluation.recommendation.action).toBe('reject');
      expect(evaluation.recommendation.confidence).toBeGreaterThan(0.8); // High confidence in rejection
      
      // Should identify multiple problems
      expect(evaluation.riskAssessment.overallRiskScore).toBeGreaterThan(80);
      expect(evaluation.feasibilityAnalysis.overallScore).toBeLessThan(40);
      expect(evaluation.profitabilityAnalysis.baseProfit.netProfit).toBeLessThan(0);
      
      // Should identify specific rejection reasons
      expect(evaluation.recommendation.reasoning).toContain('negative' || 'loss' || 'unprofitable');
      
      // Should highlight key problems in strengths/weaknesses
      expect(evaluation.strengthsAndWeaknesses.weaknesses.length).toBeGreaterThan(3);
      expect(evaluation.strengthsAndWeaknesses.weaknesses.some(w => 
        w.includes('profit') || w.includes('negative')
      )).toBe(true);

      console.log(`Bad Opportunity Rejection:
        Final Score: ${evaluation.finalScore.toFixed(2)}
        Action: ${evaluation.recommendation.action}
        Rejection Confidence: ${evaluation.recommendation.confidence.toFixed(2)}
        Key Problems: ${evaluation.strengthsAndWeaknesses.weaknesses.slice(0, 3).join(', ')}`);
    });
  });

  describe('Batch Processing and Performance', () => {
    it('should efficiently process mixed-quality opportunity batches', async () => {
      // Create a realistic batch of mixed opportunities
      const mixedBatch: ArbitrageOpportunity[] = [
        // Excellent opportunity
        {
          id: 'excellent-usdc-eth-poly',
          assetId: 'USDC' as AssetID,
          sourceChain: 'ethereum' as ChainID,
          targetChain: 'polygon' as ChainID,
          sourcePrice: 1.0000,
          targetPrice: 0.9955,
          priceDifference: 0.0045,
          percentageDifference: 0.45,
          expectedProfit: 1125,
          estimatedGasCost: 80,
          bridgeFee: 45,
          netProfit: 1000,
          profitMargin: 0.889,
          executionTime: 120,
          riskScore: 25,
          confidence: 0.92,
          timestamp: Date.now(),
          executionPaths: []
        },
        // Good opportunity
        {
          id: 'good-dai-eth-arb',
          assetId: 'DAI' as AssetID,
          sourceChain: 'ethereum' as ChainID,
          targetChain: 'arbitrum' as ChainID,
          sourcePrice: 1.0000,
          targetPrice: 0.9965,
          priceDifference: 0.0035,
          percentageDifference: 0.35,
          expectedProfit: 700,
          estimatedGasCost: 90,
          bridgeFee: 40,
          netProfit: 570,
          profitMargin: 0.814,
          executionTime: 160,
          riskScore: 40,
          confidence: 0.82,
          timestamp: Date.now(),
          executionPaths: []
        },
        // Marginal opportunity
        {
          id: 'marginal-usdt-eth-opt',
          assetId: 'USDT' as AssetID,
          sourceChain: 'ethereum' as ChainID,
          targetChain: 'optimism' as ChainID,
          sourcePrice: 1.0000,
          targetPrice: 0.9975,
          priceDifference: 0.0025,
          percentageDifference: 0.25,
          expectedProfit: 250,
          estimatedGasCost: 110,
          bridgeFee: 35,
          netProfit: 105,
          profitMargin: 0.42,
          executionTime: 200,
          riskScore: 65,
          confidence: 0.65,
          timestamp: Date.now(),
          executionPaths: []
        },
        // Poor opportunity
        {
          id: 'poor-usdc-eth-bsc',
          assetId: 'USDC' as AssetID,
          sourceChain: 'ethereum' as ChainID,
          targetChain: 'bsc' as ChainID,
          sourcePrice: 1.0000,
          targetPrice: 0.9985,
          priceDifference: 0.0015,
          percentageDifference: 0.15,
          expectedProfit: 150,
          estimatedGasCost: 140,
          bridgeFee: 60,
          netProfit: -50,
          profitMargin: -0.333,
          executionTime: 350,
          riskScore: 80,
          confidence: 0.4,
          timestamp: Date.now(),
          executionPaths: []
        }
      ];

      const startTime = performance.now();
      const evaluations = await evaluator.evaluateBatch(mixedBatch);
      const processingTime = performance.now() - startTime;

      // Performance validation
      expect(evaluations.length).toBe(4);
      expect(processingTime).toBeLessThan(3000); // Under 3 seconds

      // Quality distribution validation
      const excellent = evaluations.filter(e => e.finalScore >= 80);
      const good = evaluations.filter(e => e.finalScore >= 60 && e.finalScore < 80);
      const marginal = evaluations.filter(e => e.finalScore >= 40 && e.finalScore < 60);
      const poor = evaluations.filter(e => e.finalScore < 40);

      expect(excellent.length).toBe(1); // Should identify the excellent opportunity
      expect(good.length).toBe(1);      // Should identify the good opportunity  
      expect(poor.length).toBe(1);      // Should identify the poor opportunity

      // Priority distribution validation
      const highPriority = evaluations.filter(e => e.priority === 'high');
      const mediumPriority = evaluations.filter(e => e.priority === 'medium');
      const lowPriority = evaluations.filter(e => e.priority === 'low');
      const ignored = evaluations.filter(e => e.priority === 'ignore');

      expect(highPriority.length).toBeGreaterThan(0);
      expect(ignored.length).toBeGreaterThan(0);

      // Action distribution validation
      const execute = evaluations.filter(e => e.recommendation.action === 'execute_immediately');
      const optimize = evaluations.filter(e => e.recommendation.action === 'execute_optimized');
      const reject = evaluations.filter(e => e.recommendation.action === 'reject');

      expect(execute.length + optimize.length).toBeGreaterThan(0); // At least some should be executable
      expect(reject.length).toBeGreaterThan(0); // At least some should be rejected

      console.log(`Batch Processing Results:
        Processing Time: ${processingTime.toFixed(2)}ms
        Score Distribution: Excellent(${excellent.length}), Good(${good.length}), Marginal(${marginal.length}), Poor(${poor.length})
        Priority Distribution: High(${highPriority.length}), Medium(${mediumPriority.length}), Low(${lowPriority.length}), Ignore(${ignored.length})
        Action Distribution: Execute(${execute.length}), Optimize(${optimize.length}), Reject(${reject.length})`);
    });

    it('should maintain evaluation consistency under varying market conditions', async () => {
      const baseOpportunity: ArbitrageOpportunity = {
        id: 'consistency-test-base',
        assetId: 'USDC' as AssetID,
        sourceChain: 'ethereum' as ChainID,
        targetChain: 'polygon' as ChainID,
        sourcePrice: 1.0000,
        targetPrice: 0.9945,
        priceDifference: 0.0055,
        percentageDifference: 0.55,
        expectedProfit: 825,
        estimatedGasCost: 75,
        bridgeFee: 35,
        netProfit: 715,
        profitMargin: 0.867,
        executionTime: 150,
        riskScore: 35,
        confidence: 0.85,
        timestamp: Date.now(),
        executionPaths: []
      };

      const marketScenarios = [
        {
          name: 'Normal Conditions',
          gasPrice: { ethereum: 40e9, polygon: 25e9 },
          volatility: { USDC: 0.005 },
          bridgeHealth: { stargate: 0.92 }
        },
        {
          name: 'High Gas Prices',
          gasPrice: { ethereum: 100e9, polygon: 25e9 },
          volatility: { USDC: 0.005 },
          bridgeHealth: { stargate: 0.92 }
        },
        {
          name: 'High Volatility',
          gasPrice: { ethereum: 40e9, polygon: 25e9 },
          volatility: { USDC: 0.02 },
          bridgeHealth: { stargate: 0.92 }
        },
        {
          name: 'Bridge Issues',
          gasPrice: { ethereum: 40e9, polygon: 25e9 },
          volatility: { USDC: 0.005 },
          bridgeHealth: { stargate: 0.75 }
        }
      ];

      const evaluations = [];
      
      for (const scenario of marketScenarios) {
        const evaluation = await evaluator.evaluateOpportunity(baseOpportunity, scenario);
        evaluations.push({ scenario: scenario.name, evaluation });
      }

      // Consistency validation
      const scores = evaluations.map(e => e.evaluation.finalScore);
      const priorities = evaluations.map(e => e.evaluation.priority);
      const actions = evaluations.map(e => e.evaluation.recommendation.action);

      // Scores should vary but remain within reasonable bounds
      const scoreRange = Math.max(...scores) - Math.min(...scores);
      expect(scoreRange).toBeLessThan(40); // No more than 40 point swing

      // Should maintain general quality assessment consistency
      const majorityHighQuality = scores.filter(s => s > 60).length >= scores.length / 2;
      if (majorityHighQuality) {
        expect(scores.every(s => s > 40)).toBe(true); // No score should drop too low
      }

      // Log detailed results
      for (const { scenario, evaluation } of evaluations) {
        console.log(`${scenario}:
          Score: ${evaluation.finalScore.toFixed(2)}
          Priority: ${evaluation.priority}
          Action: ${evaluation.recommendation.action}
          Risk: ${evaluation.riskAssessment.overallRiskScore}`);
      }
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle opportunities with missing or invalid data gracefully', async () => {
      const invalidOpportunity: ArbitrageOpportunity = {
        id: 'invalid-data-test',
        assetId: 'UNKNOWN_TOKEN' as AssetID,
        sourceChain: 'ethereum' as ChainID,
        targetChain: 'polygon' as ChainID,
        sourcePrice: 0, // Invalid price
        targetPrice: -1, // Invalid price
        priceDifference: NaN, // Invalid
        percentageDifference: Infinity, // Invalid
        expectedProfit: -1000, // Negative
        estimatedGasCost: -50, // Invalid
        bridgeFee: 0,
        netProfit: -1050,
        profitMargin: -Infinity,
        executionTime: -100, // Invalid
        riskScore: 150, // Out of range
        confidence: 2.5, // Out of range
        timestamp: Date.now() - 3600000, // 1 hour old
        executionPaths: []
      };

      // Should not throw an error
      let evaluation;
      expect(async () => {
        evaluation = await evaluator.evaluateOpportunity(invalidOpportunity);
      }).not.toThrow();

      evaluation = await evaluator.evaluateOpportunity(invalidOpportunity);

      // Should provide a valid evaluation with appropriate handling
      expect(evaluation).toBeDefined();
      expect(evaluation.finalScore).toBeGreaterThanOrEqual(0);
      expect(evaluation.finalScore).toBeLessThanOrEqual(100);
      expect(evaluation.priority).toBe('ignore'); // Should ignore invalid opportunities
      expect(evaluation.recommendation.action).toBe('reject');
    });

    it('should handle market data inconsistencies', async () => {
      const opportunity: ArbitrageOpportunity = {
        id: 'market-data-inconsistency',
        assetId: 'USDC' as AssetID,
        sourceChain: 'ethereum' as ChainID,
        targetChain: 'polygon' as ChainID,
        sourcePrice: 1.0000,
        targetPrice: 0.995,
        priceDifference: 0.005,
        percentageDifference: 0.5,
        expectedProfit: 500,
        estimatedGasCost: 75,
        bridgeFee: 35,
        netProfit: 390,
        profitMargin: 0.78,
        executionTime: 150,
        riskScore: 40,
        confidence: 0.8,
        timestamp: Date.now(),
        executionPaths: []
      };

      // Inconsistent market data
      const inconsistentMarketData = {
        gasPrice: {
          ethereum: null, // Missing data
          polygon: undefined // Missing data
        },
        volatility: {
          USDC: 'high' as any // Wrong type
        },
        liquidity: {
          ethereum: -1000000 // Invalid negative liquidity
        },
        bridgeHealth: {
          stargate: 150 // Out of range (should be 0-1)
        }
      };

      // Should handle gracefully
      let evaluation;
      expect(async () => {
        evaluation = await evaluator.evaluateOpportunity(opportunity, inconsistentMarketData);
      }).not.toThrow();

      evaluation = await evaluator.evaluateOpportunity(opportunity, inconsistentMarketData);

      // Should provide reasonable defaults and continue evaluation
      expect(evaluation).toBeDefined();
      expect(evaluation.finalScore).toBeGreaterThan(0);
      expect(evaluation.riskAssessment.overallRiskScore).toBeLessThan(100);
      
      // Should flag data quality issues in recommendations
      expect(evaluation.recommendation.reasoning).toBeDefined();
    });
  });
});