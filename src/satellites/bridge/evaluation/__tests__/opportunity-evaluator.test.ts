/**
 * Opportunity Evaluator Test Suite
 * Comprehensive testing for opportunity evaluation and execution path optimization
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { OpportunityEvaluator, ComprehensiveEvaluation, EvaluationConfig } from '../opportunity-evaluator';
import { ExecutionFeasibilityAnalyzer } from '../execution-feasibility-analyzer';
import { ProfitabilityCalculator } from '../profitability-calculator';
import { RiskAssessmentEngine } from '../risk-assessment-engine';
import { OpportunityScoringEngine } from '../opportunity-scoring-engine';
import { ArbitrageOpportunity, ChainID, AssetID } from '../../types';

jest.mock('../execution-feasibility-analyzer');
jest.mock('../profitability-calculator');
jest.mock('../risk-assessment-engine');
jest.mock('../opportunity-scoring-engine');

describe('OpportunityEvaluator', () => {
  let evaluator: OpportunityEvaluator;
  let mockConfig: EvaluationConfig;
  let mockFeasibilityAnalyzer: jest.Mocked<ExecutionFeasibilityAnalyzer>;
  let mockProfitabilityCalculator: jest.Mocked<ProfitabilityCalculator>;
  let mockRiskEngine: jest.Mocked<RiskAssessmentEngine>;
  let mockScoringEngine: jest.Mocked<OpportunityScoringEngine>;

  beforeEach(() => {
    mockConfig = {
      risk: {
        maxAcceptableRisk: 70,
        riskTolerance: 'moderate'
      },
      profitability: {
        minProfitThreshold: 100, // $100 minimum
        minMarginThreshold: 0.05 // 5% minimum margin
      },
      feasibility: {
        minFeasibilityScore: 50,
        maxExecutionTime: 300 // 5 minutes
      }
    };

    // Create mocked instances
    mockFeasibilityAnalyzer = new ExecutionFeasibilityAnalyzer() as jest.Mocked<ExecutionFeasibilityAnalyzer>;
    mockProfitabilityCalculator = new ProfitabilityCalculator() as jest.Mocked<ProfitabilityCalculator>;
    mockRiskEngine = new RiskAssessmentEngine() as jest.Mocked<RiskAssessmentEngine>;
    mockScoringEngine = new OpportunityScoringEngine() as jest.Mocked<OpportunityScoringEngine>;

    evaluator = new OpportunityEvaluator(mockConfig);
    
    // Inject mocked dependencies
    evaluator['feasibilityAnalyzer'] = mockFeasibilityAnalyzer;
    evaluator['profitabilityCalculator'] = mockProfitabilityCalculator;
    evaluator['riskEngine'] = mockRiskEngine;
    evaluator['scoringEngine'] = mockScoringEngine;
  });

  describe('Comprehensive Opportunity Evaluation', () => {
    it('should evaluate high-quality opportunities correctly', async () => {
      const opportunity: ArbitrageOpportunity = {
        id: 'high-quality-opp',
        assetId: 'USDC' as AssetID,
        sourceChain: 'ethereum' as ChainID,
        targetChain: 'polygon' as ChainID,
        sourcePrice: 1.0000,
        targetPrice: 0.992,
        priceDifference: 0.008,
        percentageDifference: 0.8,
        expectedProfit: 800,
        estimatedGasCost: 50,
        bridgeFee: 25,
        netProfit: 725,
        profitMargin: 0.906,
        executionTime: 120,
        riskScore: 25,
        confidence: 0.92,
        timestamp: Date.now(),
        executionPaths: []
      };

      // Mock analyzer responses
      mockProfitabilityCalculator.calculateComprehensiveProfitability.mockResolvedValue({
        baseProfit: { grossProfit: 800, netProfit: 725, margin: 0.906 },
        adjustedProfit: { grossProfit: 850, netProfit: 775, margin: 0.912 },
        optimizedCalculation: { 
          maxPotentialProfit: 900, 
          optimizations: [
            { type: 'gas_optimization', description: 'Use faster gas settings', impact: 25 },
            { type: 'bridge_optimization', description: 'Route via cheaper bridge', impact: 50 }
          ] 
        },
        scenarios: [
          { name: 'conservative', profit: 725, probability: 0.8 },
          { name: 'optimistic', profit: 850, probability: 0.6 }
        ],
        riskAdjustments: { riskPenalty: -25, confidenceBonus: 50 },
        recommendation: { 
          action: 'execute_immediately',
          reasoning: 'High profit with low risk',
          confidence: 0.9
        }
      });

      mockRiskEngine.assessOpportunityRisk.mockResolvedValue({
        overallRiskScore: 28,
        riskLevel: 'low',
        marketRisk: { score: 20, factors: [] },
        executionRisk: { score: 25, failurePoints: [] },
        liquidityRisk: { score: 15, providers: [] },
        technicalRisk: { score: 30, vulnerabilities: [] },
        counterpartyRisk: { score: 20, auditInfo: [] },
        mevRisk: { score: 35, protectionRecommended: false },
        recommendations: ['Proceed with standard execution']
      });

      mockFeasibilityAnalyzer.analyzeFeasibility.mockResolvedValue({
        overallScore: 85,
        technicalFeasibility: { score: 90, requirements: [] },
        resourceFeasibility: { score: 88, constraints: [] },
        timingFeasibility: { score: 82, constraints: [] },
        infrastructureFeasibility: { score: 85, networkReliability: [] },
        bottlenecks: [],
        alternatives: [],
        recommendation: {
          action: 'proceed',
          priority: 'high',
          optimizations: ['Use dedicated RPC endpoints'],
          estimatedTime: 105,
          confidence: 0.88
        }
      });

      mockScoringEngine.calculateScore.mockResolvedValue({
        overallScore: 87.5,
        profitabilityScore: 92,
        riskScore: 85,
        feasibilityScore: 85,
        timingScore: 88,
        features: {},
        weights: { profitability: 0.4, risk: 0.3, feasibility: 0.2, timing: 0.1 }
      });

      const evaluation = await evaluator.evaluateOpportunity(opportunity);

      expect(evaluation).toBeDefined();
      expect(evaluation.finalScore).toBeGreaterThan(80);
      expect(evaluation.priority).toBe('high');
      expect(evaluation.recommendation.action).toBe('execute_immediately');
      expect(evaluation.recommendation.confidence).toBeGreaterThan(0.8);
      
      // Verify comprehensive analysis
      expect(evaluation.profitabilityAnalysis).toBeDefined();
      expect(evaluation.riskAssessment).toBeDefined();
      expect(evaluation.feasibilityAnalysis).toBeDefined();
      expect(evaluation.strengthsAndWeaknesses).toBeDefined();
      expect(evaluation.executionPlan).toBeDefined();
      expect(evaluation.keyMetrics).toBeDefined();
    });

    it('should correctly identify and reject low-quality opportunities', async () => {
      const lowQualityOpportunity: ArbitrageOpportunity = {
        id: 'low-quality-opp',
        assetId: 'USDC' as AssetID,
        sourceChain: 'ethereum' as ChainID,
        targetChain: 'polygon' as ChainID,
        sourcePrice: 1.0000,
        targetPrice: 0.9985,
        priceDifference: 0.0015,
        percentageDifference: 0.15,
        expectedProfit: 75, // Below threshold
        estimatedGasCost: 80,
        bridgeFee: 30,
        netProfit: -35, // Negative
        profitMargin: -0.47,
        executionTime: 350, // Too slow
        riskScore: 85, // High risk
        confidence: 0.4, // Low confidence
        timestamp: Date.now(),
        executionPaths: []
      };

      mockProfitabilityCalculator.calculateComprehensiveProfitability.mockResolvedValue({
        baseProfit: { grossProfit: 75, netProfit: -35, margin: -0.47 },
        adjustedProfit: { grossProfit: 60, netProfit: -50, margin: -0.83 },
        optimizedCalculation: { 
          maxPotentialProfit: 80, 
          optimizations: [] 
        },
        scenarios: [
          { name: 'conservative', profit: -35, probability: 0.9 },
          { name: 'optimistic', profit: 45, probability: 0.2 }
        ],
        riskAdjustments: { riskPenalty: -100, confidenceBonus: -20 },
        recommendation: { 
          action: 'reject',
          reasoning: 'Negative expected profit',
          confidence: 0.95
        }
      });

      mockRiskEngine.assessOpportunityRisk.mockResolvedValue({
        overallRiskScore: 85,
        riskLevel: 'high',
        marketRisk: { score: 80, factors: ['High volatility'] },
        executionRisk: { score: 90, failurePoints: ['Gas price spike', 'Network congestion'] },
        liquidityRisk: { score: 85, providers: [] },
        technicalRisk: { score: 88, vulnerabilities: ['Contract bug risk'] },
        counterpartyRisk: { score: 75, auditInfo: [] },
        mevRisk: { score: 92, protectionRecommended: true },
        recommendations: ['Avoid execution', 'Wait for better conditions']
      });

      mockFeasibilityAnalyzer.analyzeFeasibility.mockResolvedValue({
        overallScore: 35,
        technicalFeasibility: { score: 40, requirements: [] },
        resourceFeasibility: { score: 30, constraints: ['Insufficient gas budget'] },
        timingFeasibility: { score: 25, constraints: ['Execution window too narrow'] },
        infrastructureFeasibility: { score: 45, networkReliability: [] },
        bottlenecks: ['Network congestion', 'High gas prices'],
        alternatives: [],
        recommendation: {
          action: 'defer',
          priority: 'ignore',
          optimizations: [],
          estimatedTime: 350,
          confidence: 0.3
        }
      });

      mockScoringEngine.calculateScore.mockResolvedValue({
        overallScore: 25.5,
        profitabilityScore: 15,
        riskScore: 25,
        feasibilityScore: 35,
        timingScore: 30,
        features: {},
        weights: { profitability: 0.4, risk: 0.3, feasibility: 0.2, timing: 0.1 }
      });

      const evaluation = await evaluator.evaluateOpportunity(lowQualityOpportunity);

      expect(evaluation.finalScore).toBeLessThan(50);
      expect(evaluation.priority).toBe('ignore');
      expect(evaluation.recommendation.action).toBe('reject');
      expect(evaluation.recommendation.confidence).toBeGreaterThan(0.8);
    });

    it('should handle medium-quality opportunities with optimization recommendations', async () => {
      const mediumQualityOpportunity: ArbitrageOpportunity = {
        id: 'medium-quality-opp',
        assetId: 'USDC' as AssetID,
        sourceChain: 'ethereum' as ChainID,
        targetChain: 'arbitrum' as ChainID,
        sourcePrice: 1.0000,
        targetPrice: 0.994,
        priceDifference: 0.006,
        percentageDifference: 0.6,
        expectedProfit: 300,
        estimatedGasCost: 70,
        bridgeFee: 40,
        netProfit: 190,
        profitMargin: 0.633,
        executionTime: 180,
        riskScore: 55,
        confidence: 0.7,
        timestamp: Date.now(),
        executionPaths: []
      };

      mockProfitabilityCalculator.calculateComprehensiveProfitability.mockResolvedValue({
        baseProfit: { grossProfit: 300, netProfit: 190, margin: 0.633 },
        adjustedProfit: { grossProfit: 350, netProfit: 240, margin: 0.686 },
        optimizedCalculation: { 
          maxPotentialProfit: 400, 
          optimizations: [
            { type: 'timing_optimization', description: 'Wait for gas price reduction', impact: 30 },
            { type: 'path_optimization', description: 'Use alternative bridge', impact: 20 }
          ] 
        },
        scenarios: [
          { name: 'conservative', profit: 190, probability: 0.7 },
          { name: 'optimistic', profit: 280, probability: 0.4 }
        ],
        riskAdjustments: { riskPenalty: -50, confidenceBonus: 0 },
        recommendation: { 
          action: 'execute_optimized',
          reasoning: 'Moderate profit, room for optimization',
          confidence: 0.65
        }
      });

      mockRiskEngine.assessOpportunityRisk.mockResolvedValue({
        overallRiskScore: 55,
        riskLevel: 'medium',
        marketRisk: { score: 50, factors: ['Moderate volatility'] },
        executionRisk: { score: 60, failurePoints: ['Potential gas price fluctuation'] },
        liquidityRisk: { score: 45, providers: [] },
        technicalRisk: { score: 65, vulnerabilities: [] },
        counterpartyRisk: { score: 50, auditInfo: [] },
        mevRisk: { score: 60, protectionRecommended: true },
        recommendations: ['Use MEV protection', 'Monitor gas prices']
      });

      mockFeasibilityAnalyzer.analyzeFeasibility.mockResolvedValue({
        overallScore: 65,
        technicalFeasibility: { score: 70, requirements: [] },
        resourceFeasibility: { score: 68, constraints: [] },
        timingFeasibility: { score: 60, constraints: ['Gas price sensitivity'] },
        infrastructureFeasibility: { score: 65, networkReliability: [] },
        bottlenecks: ['Gas price volatility'],
        alternatives: ['Alternative bridge route'],
        recommendation: {
          action: 'proceed_with_caution',
          priority: 'medium',
          optimizations: ['Monitor gas prices', 'Consider alternative bridges'],
          estimatedTime: 160,
          confidence: 0.65
        }
      });

      mockScoringEngine.calculateScore.mockResolvedValue({
        overallScore: 62.5,
        profitabilityScore: 65,
        riskScore: 55,
        feasibilityScore: 65,
        timingScore: 60,
        features: {},
        weights: { profitability: 0.4, risk: 0.3, feasibility: 0.2, timing: 0.1 }
      });

      const evaluation = await evaluator.evaluateOpportunity(mediumQualityOpportunity);

      expect(evaluation.finalScore).toBeGreaterThan(50);
      expect(evaluation.finalScore).toBeLessThan(80);
      expect(evaluation.priority).toBe('medium');
      expect(evaluation.recommendation.action).toBe('execute_optimized');
      expect(evaluation.profitabilityAnalysis.optimizedCalculation.optimizations.length).toBeGreaterThan(0);
    });
  });

  describe('Execution Path Analysis', () => {
    it('should generate comprehensive execution plans with multiple steps', async () => {
      const opportunity: ArbitrageOpportunity = {
        id: 'execution-plan-test',
        assetId: 'WETH' as AssetID,
        sourceChain: 'ethereum' as ChainID,
        targetChain: 'arbitrum' as ChainID,
        sourcePrice: 2000.00,
        targetPrice: 1988.00,
        priceDifference: 12.00,
        percentageDifference: 0.6,
        expectedProfit: 1200,
        estimatedGasCost: 100,
        bridgeFee: 60,
        netProfit: 1040,
        profitMargin: 0.867,
        executionTime: 150,
        riskScore: 40,
        confidence: 0.85,
        timestamp: Date.now(),
        executionPaths: [
          {
            id: 'primary-path',
            steps: [
              { action: 'swap', chain: 'ethereum' as ChainID, dex: 'uniswap', gasEstimate: 50 },
              { action: 'bridge', chain: 'ethereum' as ChainID, bridge: 'stargate', gasEstimate: 30 },
              { action: 'swap', chain: 'arbitrum' as ChainID, dex: 'camelot', gasEstimate: 20 }
            ],
            totalGasEstimate: 100,
            estimatedTime: 150,
            successProbability: 0.85
          }
        ]
      };

      // Mock comprehensive analysis responses
      mockProfitabilityCalculator.calculateComprehensiveProfitability.mockResolvedValue({
        baseProfit: { grossProfit: 1200, netProfit: 1040, margin: 0.867 },
        adjustedProfit: { grossProfit: 1250, netProfit: 1090, margin: 0.872 },
        optimizedCalculation: { 
          maxPotentialProfit: 1300, 
          optimizations: [
            { type: 'execution_timing', description: 'Execute during low gas period', impact: 50 }
          ] 
        },
        scenarios: [
          { name: 'conservative', profit: 1040, probability: 0.8 },
          { name: 'optimistic', profit: 1200, probability: 0.6 }
        ],
        riskAdjustments: { riskPenalty: -60, confidenceBonus: 100 },
        recommendation: { 
          action: 'execute_immediately',
          reasoning: 'Strong profit with manageable risk',
          confidence: 0.85
        }
      });

      mockRiskEngine.assessOpportunityRisk.mockResolvedValue({
        overallRiskScore: 40,
        riskLevel: 'medium',
        marketRisk: { score: 35, factors: [] },
        executionRisk: { score: 45, failurePoints: [] },
        liquidityRisk: { score: 30, providers: [] },
        technicalRisk: { score: 50, vulnerabilities: [] },
        counterpartyRisk: { score: 35, auditInfo: [] },
        mevRisk: { score: 55, protectionRecommended: true },
        recommendations: ['Use MEV protection', 'Monitor market conditions']
      });

      mockFeasibilityAnalyzer.analyzeFeasibility.mockResolvedValue({
        overallScore: 75,
        technicalFeasibility: { score: 80, requirements: [] },
        resourceFeasibility: { score: 78, constraints: [] },
        timingFeasibility: { score: 70, constraints: [] },
        infrastructureFeasibility: { score: 75, networkReliability: [] },
        bottlenecks: [],
        alternatives: [
          {
            description: 'Use Hop Protocol instead of Stargate',
            impact: 'Lower fees but higher execution time',
            feasibilityChange: 5
          }
        ],
        recommendation: {
          action: 'proceed',
          priority: 'high',
          optimizations: ['Consider alternative bridges for better fees'],
          estimatedTime: 140,
          confidence: 0.75
        }
      });

      mockScoringEngine.calculateScore.mockResolvedValue({
        overallScore: 78.5,
        profitabilityScore: 85,
        riskScore: 70,
        feasibilityScore: 75,
        timingScore: 80,
        features: {},
        weights: { profitability: 0.4, risk: 0.3, feasibility: 0.2, timing: 0.1 }
      });

      const evaluation = await evaluator.evaluateOpportunity(opportunity);

      // Verify execution plan generation
      expect(evaluation.executionPlan).toBeDefined();
      expect(evaluation.executionPlan.steps.length).toBeGreaterThan(0);
      expect(evaluation.executionPlan.contingencyPlans).toBeDefined();
      expect(evaluation.executionPlan.monitoringPoints).toBeDefined();
      
      // Check execution steps include required components
      const executionSteps = evaluation.executionPlan.steps;
      expect(executionSteps.some(step => step.action.includes('swap'))).toBe(true);
      expect(executionSteps.some(step => step.action.includes('bridge'))).toBe(true);
      
      // Verify monitoring points are set up
      expect(evaluation.executionPlan.monitoringPoints.length).toBeGreaterThan(0);
      expect(evaluation.executionPlan.monitoringPoints.some(point => 
        point.metric === 'gas_price'
      )).toBe(true);
    });

    it('should optimize execution paths based on current market conditions', async () => {
      const opportunity: ArbitrageOpportunity = {
        id: 'path-optimization-test',
        assetId: 'USDC' as AssetID,
        sourceChain: 'ethereum' as ChainID,
        targetChain: 'polygon' as ChainID,
        sourcePrice: 1.0000,
        targetPrice: 0.9925,
        priceDifference: 0.0075,
        percentageDifference: 0.75,
        expectedProfit: 375,
        estimatedGasCost: 60,
        bridgeFee: 35,
        netProfit: 280,
        profitMargin: 0.747,
        executionTime: 120,
        riskScore: 35,
        confidence: 0.8,
        timestamp: Date.now(),
        executionPaths: []
      };

      // Mock market conditions that should trigger optimization
      const marketData = {
        gasPrice: { ethereum: 80e9, polygon: 30e9 }, // High Ethereum gas
        bridgeLiquidity: {
          stargate: 5000000, // $5M
          hop: 2000000,      // $2M
          across: 1000000    // $1M
        },
        dexLiquidity: {
          ethereum: { uniswap: 10000000, sushiswap: 5000000 },
          polygon: { quickswap: 8000000, sushiswap: 3000000 }
        }
      };

      mockProfitabilityCalculator.calculateComprehensiveProfitability.mockResolvedValue({
        baseProfit: { grossProfit: 375, netProfit: 280, margin: 0.747 },
        adjustedProfit: { grossProfit: 420, netProfit: 325, margin: 0.774 },
        optimizedCalculation: { 
          maxPotentialProfit: 450, 
          optimizations: [
            { type: 'bridge_selection', description: 'Use Stargate for better liquidity', impact: 25 },
            { type: 'gas_optimization', description: 'Wait for lower gas prices', impact: 20 }
          ] 
        },
        scenarios: [
          { name: 'conservative', profit: 280, probability: 0.8 },
          { name: 'optimistic', profit: 350, probability: 0.5 }
        ],
        riskAdjustments: { riskPenalty: -35, confidenceBonus: 60 },
        recommendation: { 
          action: 'execute_optimized',
          reasoning: 'Good profit potential with optimization opportunities',
          confidence: 0.78
        }
      });

      mockFeasibilityAnalyzer.analyzeFeasibility.mockResolvedValue({
        overallScore: 70,
        technicalFeasibility: { score: 75, requirements: [] },
        resourceFeasibility: { score: 68, constraints: ['High gas prices'] },
        timingFeasibility: { score: 72, constraints: [] },
        infrastructureFeasibility: { score: 70, networkReliability: [] },
        bottlenecks: ['Ethereum gas prices'],
        alternatives: [
          {
            description: 'Delay execution for better gas prices',
            impact: 'Reduce costs by $20',
            feasibilityChange: 5
          },
          {
            description: 'Use Stargate bridge for better liquidity',
            impact: 'Better execution reliability',
            feasibilityChange: 8
          }
        ],
        recommendation: {
          action: 'proceed_with_optimization',
          priority: 'medium',
          optimizations: ['Monitor gas prices', 'Use high-liquidity bridges'],
          estimatedTime: 110,
          confidence: 0.72
        }
      });

      const evaluation = await evaluator.evaluateOpportunity(opportunity, marketData);

      // Verify optimization recommendations
      expect(evaluation.recommendation.action).toBe('execute_optimized');
      expect(evaluation.profitabilityAnalysis.optimizedCalculation.optimizations.length).toBeGreaterThan(0);
      expect(evaluation.feasibilityAnalysis.alternatives.length).toBeGreaterThan(0);
      
      // Check that execution plan includes optimizations
      expect(evaluation.executionPlan.steps.some(step => 
        step.optimizations && step.optimizations.length > 0
      )).toBe(true);
      
      // Verify contingency plans for risk mitigation
      expect(evaluation.executionPlan.contingencyPlans.length).toBeGreaterThan(0);
      expect(evaluation.executionPlan.contingencyPlans.some(plan => 
        plan.trigger.includes('gas') || plan.trigger.includes('price')
      )).toBe(true);
    });
  });

  describe('Batch Evaluation Performance', () => {
    it('should efficiently evaluate multiple opportunities simultaneously', async () => {
      const opportunities: ArbitrageOpportunity[] = Array.from({ length: 25 }, (_, i) => ({
        id: `batch-eval-${i}`,
        assetId: (['USDC', 'USDT', 'DAI', 'WETH', 'WBTC'][i % 5]) as AssetID,
        sourceChain: 'ethereum' as ChainID,
        targetChain: (['polygon', 'arbitrum', 'optimism', 'avalanche', 'bsc'][i % 5]) as ChainID,
        sourcePrice: 1.0000,
        targetPrice: 0.995 - (i * 0.0002),
        priceDifference: 0.005 + (i * 0.0002),
        percentageDifference: 0.5 + (i * 0.02),
        expectedProfit: 500 + (i * 50),
        estimatedGasCost: 50 + (i % 30),
        bridgeFee: 25 + (i % 15),
        netProfit: 425 + (i * 40),
        profitMargin: 0.85,
        executionTime: 120 + (i % 60),
        riskScore: 30 + (i % 40),
        confidence: 0.9 - (i * 0.01),
        timestamp: Date.now(),
        executionPaths: []
      }));

      // Mock responses for batch processing
      mockProfitabilityCalculator.calculateComprehensiveProfitability.mockImplementation(async (opp) => ({
        baseProfit: { grossProfit: opp.expectedProfit, netProfit: opp.netProfit, margin: opp.profitMargin },
        adjustedProfit: { grossProfit: opp.expectedProfit * 1.1, netProfit: opp.netProfit * 1.1, margin: opp.profitMargin * 1.05 },
        optimizedCalculation: { 
          maxPotentialProfit: opp.expectedProfit * 1.2, 
          optimizations: [] 
        },
        scenarios: [
          { name: 'conservative', profit: opp.netProfit, probability: 0.8 },
          { name: 'optimistic', profit: opp.netProfit * 1.3, probability: 0.5 }
        ],
        riskAdjustments: { riskPenalty: -25, confidenceBonus: 25 },
        recommendation: { 
          action: opp.netProfit > 200 ? 'execute_immediately' : 'execute_optimized',
          reasoning: 'Batch evaluation',
          confidence: opp.confidence
        }
      }));

      mockRiskEngine.assessOpportunityRisk.mockImplementation(async (opp) => ({
        overallRiskScore: opp.riskScore,
        riskLevel: opp.riskScore > 60 ? 'high' : opp.riskScore > 40 ? 'medium' : 'low',
        marketRisk: { score: opp.riskScore - 10, factors: [] },
        executionRisk: { score: opp.riskScore, failurePoints: [] },
        liquidityRisk: { score: opp.riskScore - 15, providers: [] },
        technicalRisk: { score: opp.riskScore + 5, vulnerabilities: [] },
        counterpartyRisk: { score: opp.riskScore - 5, auditInfo: [] },
        mevRisk: { score: opp.riskScore + 10, protectionRecommended: opp.riskScore > 50 },
        recommendations: []
      }));

      mockFeasibilityAnalyzer.analyzeFeasibility.mockImplementation(async (opp) => ({
        overallScore: 100 - opp.riskScore,
        technicalFeasibility: { score: 95 - opp.riskScore, requirements: [] },
        resourceFeasibility: { score: 90 - opp.riskScore, constraints: [] },
        timingFeasibility: { score: 85 - opp.riskScore, constraints: [] },
        infrastructureFeasibility: { score: 90 - opp.riskScore, networkReliability: [] },
        bottlenecks: [],
        alternatives: [],
        recommendation: {
          action: 'proceed',
          priority: opp.netProfit > 500 ? 'high' : 'medium',
          optimizations: [],
          estimatedTime: opp.executionTime,
          confidence: opp.confidence
        }
      }));

      mockScoringEngine.calculateScore.mockImplementation(async (opp) => ({
        overallScore: (opp.netProfit / 10) + (100 - opp.riskScore) * 0.5,
        profitabilityScore: opp.netProfit / 10,
        riskScore: 100 - opp.riskScore,
        feasibilityScore: 100 - opp.riskScore,
        timingScore: 100 - (opp.executionTime / 3),
        features: {},
        weights: { profitability: 0.4, risk: 0.3, feasibility: 0.2, timing: 0.1 }
      }));

      const startTime = performance.now();
      const evaluations = await evaluator.evaluateBatch(opportunities);
      const processingTime = performance.now() - startTime;

      expect(evaluations.length).toBe(25);
      expect(processingTime).toBeLessThan(5000); // Under 5 seconds for 25 evaluations

      // Verify evaluation quality distribution
      const highPriority = evaluations.filter(e => e.priority === 'high');
      const mediumPriority = evaluations.filter(e => e.priority === 'medium');
      const lowPriority = evaluations.filter(e => e.priority === 'low' || e.priority === 'ignore');

      expect(highPriority.length + mediumPriority.length + lowPriority.length).toBe(25);
      
      // Verify scores are properly distributed
      const avgScore = evaluations.reduce((sum, e) => sum + e.finalScore, 0) / evaluations.length;
      expect(avgScore).toBeGreaterThan(30);
      expect(avgScore).toBeLessThan(90);

      console.log(`Batch Evaluation Performance:
        Total opportunities: 25
        Processing time: ${processingTime.toFixed(2)}ms
        Average score: ${avgScore.toFixed(2)}
        High priority: ${highPriority.length}
        Medium priority: ${mediumPriority.length}
        Low priority: ${lowPriority.length}`);
    });

    it('should provide consistent evaluation results for identical opportunities', async () => {
      const baseOpportunity: ArbitrageOpportunity = {
        id: 'consistency-test-base',
        assetId: 'USDC' as AssetID,
        sourceChain: 'ethereum' as ChainID,
        targetChain: 'polygon' as ChainID,
        sourcePrice: 1.0000,
        targetPrice: 0.993,
        priceDifference: 0.007,
        percentageDifference: 0.7,
        expectedProfit: 700,
        estimatedGasCost: 60,
        bridgeFee: 30,
        netProfit: 610,
        profitMargin: 0.871,
        executionTime: 140,
        riskScore: 35,
        confidence: 0.85,
        timestamp: Date.now(),
        executionPaths: []
      };

      // Create 5 identical opportunities
      const identicalOpportunities: ArbitrageOpportunity[] = Array.from({ length: 5 }, (_, i) => ({
        ...baseOpportunity,
        id: `consistency-test-${i}`
      }));

      // Mock consistent responses
      const mockProfitAnalysis = {
        baseProfit: { grossProfit: 700, netProfit: 610, margin: 0.871 },
        adjustedProfit: { grossProfit: 750, netProfit: 660, margin: 0.88 },
        optimizedCalculation: { 
          maxPotentialProfit: 800, 
          optimizations: [
            { type: 'timing', description: 'Optimize execution timing', impact: 40 }
          ] 
        },
        scenarios: [
          { name: 'conservative', profit: 610, probability: 0.8 },
          { name: 'optimistic', profit: 720, probability: 0.6 }
        ],
        riskAdjustments: { riskPenalty: -40, confidenceBonus: 90 },
        recommendation: { 
          action: 'execute_immediately',
          reasoning: 'Consistent high-quality opportunity',
          confidence: 0.85
        }
      };

      mockProfitabilityCalculator.calculateComprehensiveProfitability.mockResolvedValue(mockProfitAnalysis);

      const mockRiskAnalysis = {
        overallRiskScore: 35,
        riskLevel: 'low' as const,
        marketRisk: { score: 30, factors: [] },
        executionRisk: { score: 40, failurePoints: [] },
        liquidityRisk: { score: 25, providers: [] },
        technicalRisk: { score: 45, vulnerabilities: [] },
        counterpartyRisk: { score: 30, auditInfo: [] },
        mevRisk: { score: 40, protectionRecommended: false },
        recommendations: ['Standard execution recommended']
      };

      mockRiskEngine.assessOpportunityRisk.mockResolvedValue(mockRiskAnalysis);

      const evaluations = await evaluator.evaluateBatch(identicalOpportunities);

      // Verify consistency
      expect(evaluations.length).toBe(5);
      
      const scores = evaluations.map(e => e.finalScore);
      const priorities = evaluations.map(e => e.priority);
      const actions = evaluations.map(e => e.recommendation.action);

      // All scores should be identical (within small floating point tolerance)
      for (let i = 1; i < scores.length; i++) {
        expect(Math.abs(scores[i] - scores[0])).toBeLessThan(0.01);
      }

      // All priorities should be identical
      expect(new Set(priorities).size).toBe(1);

      // All recommendations should be identical
      expect(new Set(actions).size).toBe(1);

      console.log(`Consistency Test Results:
        Score range: ${Math.min(...scores).toFixed(2)} - ${Math.max(...scores).toFixed(2)}
        Priority: ${priorities[0]}
        Action: ${actions[0]}`);
    });
  });

  describe('Integration with Market Data', () => {
    it('should adapt evaluations based on real-time market conditions', async () => {
      const opportunity: ArbitrageOpportunity = {
        id: 'market-integration-test',
        assetId: 'USDC' as AssetID,
        sourceChain: 'ethereum' as ChainID,
        targetChain: 'arbitrum' as ChainID,
        sourcePrice: 1.0000,
        targetPrice: 0.9935,
        priceDifference: 0.0065,
        percentageDifference: 0.65,
        expectedProfit: 650,
        estimatedGasCost: 70,
        bridgeFee: 35,
        netProfit: 545,
        profitMargin: 0.838,
        executionTime: 160,
        riskScore: 45,
        confidence: 0.8,
        timestamp: Date.now(),
        executionPaths: []
      };

      // Test different market conditions
      const marketScenarios = [
        {
          name: 'High Gas Prices',
          data: {
            gasPrice: { ethereum: 100e9, arbitrum: 0.5e9 },
            volatility: { USDC: 0.02 }, // 2% volatility
            bridgeHealth: { stargate: 0.95, across: 0.88 }
          },
          expectedImpact: 'Higher execution costs, may recommend delay'
        },
        {
          name: 'High Volatility',
          data: {
            gasPrice: { ethereum: 40e9, arbitrum: 0.3e9 },
            volatility: { USDC: 0.15 }, // 15% volatility
            bridgeHealth: { stargate: 0.92, across: 0.85 }
          },
          expectedImpact: 'Increased risk score, may recommend caution'
        },
        {
          name: 'Optimal Conditions',
          data: {
            gasPrice: { ethereum: 20e9, arbitrum: 0.1e9 },
            volatility: { USDC: 0.005 }, // 0.5% volatility
            bridgeHealth: { stargate: 0.98, across: 0.95 }
          },
          expectedImpact: 'Lower costs, higher confidence'
        }
      ];

      for (const scenario of marketScenarios) {
        // Mock analysis based on market conditions
        const adjustedGasCost = scenario.data.gasPrice.ethereum > 50e9 ? 100 : 
                               scenario.data.gasPrice.ethereum > 30e9 ? 70 : 50;
        
        const volatilityRiskAdjustment = scenario.data.volatility.USDC > 0.1 ? 20 : 
                                        scenario.data.volatility.USDC > 0.05 ? 10 : 0;

        mockProfitabilityCalculator.calculateComprehensiveProfitability.mockResolvedValue({
          baseProfit: { grossProfit: 650, netProfit: 650 - adjustedGasCost - 35, margin: 0.8 },
          adjustedProfit: { grossProfit: 650, netProfit: 650 - adjustedGasCost - 35, margin: 0.8 },
          optimizedCalculation: { 
            maxPotentialProfit: 700, 
            optimizations: adjustedGasCost > 70 ? [
              { type: 'gas_optimization', description: 'Wait for lower gas prices', impact: 30 }
            ] : []
          },
          scenarios: [
            { name: 'conservative', profit: 650 - adjustedGasCost - 35, probability: 0.8 },
            { name: 'optimistic', profit: 700 - adjustedGasCost - 35, probability: 0.6 }
          ],
          riskAdjustments: { riskPenalty: -volatilityRiskAdjustment, confidenceBonus: 50 },
          recommendation: { 
            action: adjustedGasCost > 80 ? 'defer' : 'execute_immediately',
            reasoning: `Market conditions: ${scenario.name}`,
            confidence: 0.85 - (volatilityRiskAdjustment / 100)
          }
        });

        mockRiskEngine.assessOpportunityRisk.mockResolvedValue({
          overallRiskScore: 45 + volatilityRiskAdjustment,
          riskLevel: (45 + volatilityRiskAdjustment) > 60 ? 'high' : 'medium',
          marketRisk: { score: 30 + volatilityRiskAdjustment, factors: [`Volatility: ${scenario.data.volatility.USDC * 100}%`] },
          executionRisk: { score: 40, failurePoints: [] },
          liquidityRisk: { score: 35, providers: [] },
          technicalRisk: { score: 50, vulnerabilities: [] },
          counterpartyRisk: { score: 35, auditInfo: [] },
          mevRisk: { score: 45, protectionRecommended: true },
          recommendations: adjustedGasCost > 80 ? ['Wait for better gas conditions'] : ['Proceed with execution']
        });

        const evaluation = await evaluator.evaluateOpportunity(opportunity, scenario.data);

        // Verify market condition adaptation
        if (scenario.name === 'High Gas Prices') {
          expect(evaluation.profitabilityAnalysis.optimizedCalculation.optimizations.length).toBeGreaterThan(0);
          expect(evaluation.profitabilityAnalysis.optimizedCalculation.optimizations.some(opt => 
            opt.description.includes('gas')
          )).toBe(true);
        }

        if (scenario.name === 'High Volatility') {
          expect(evaluation.riskAssessment.overallRiskScore).toBeGreaterThan(50);
          expect(evaluation.riskAssessment.marketRisk.factors.some(factor => 
            factor.includes('Volatility')
          )).toBe(true);
        }

        if (scenario.name === 'Optimal Conditions') {
          expect(evaluation.recommendation.confidence).toBeGreaterThan(0.8);
          expect(evaluation.recommendation.action).toBe('execute_immediately');
        }

        console.log(`${scenario.name} Results:
          Final Score: ${evaluation.finalScore.toFixed(2)}
          Priority: ${evaluation.priority}
          Action: ${evaluation.recommendation.action}
          Confidence: ${evaluation.recommendation.confidence.toFixed(2)}`);
      }
    });
  });
});