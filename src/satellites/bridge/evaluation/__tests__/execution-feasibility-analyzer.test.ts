/**
 * Execution Feasibility Analyzer Test Suite
 * Testing execution path optimization and feasibility analysis
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { 
  ExecutionFeasibilityAnalyzer, 
  FeasibilityAnalysis,
  TechnicalFeasibility,
  ResourceFeasibility,
  TimingFeasibility
} from '../execution-feasibility-analyzer';
import { ArbitrageOpportunity, ChainID, AssetID } from '../../types';

jest.mock('../../shared/logging/logger');

describe('ExecutionFeasibilityAnalyzer', () => {
  let analyzer: ExecutionFeasibilityAnalyzer;

  beforeEach(() => {
    analyzer = new ExecutionFeasibilityAnalyzer();
  });

  describe('Technical Feasibility Analysis', () => {
    it('should analyze technical requirements for simple arbitrage', async () => {
      const opportunity: ArbitrageOpportunity = {
        id: 'tech-feasibility-simple',
        assetId: 'USDC' as AssetID,
        sourceChain: 'ethereum' as ChainID,
        targetChain: 'polygon' as ChainID,
        sourcePrice: 1.0000,
        targetPrice: 0.995,
        priceDifference: 0.005,
        percentageDifference: 0.5,
        expectedProfit: 500,
        estimatedGasCost: 50,
        bridgeFee: 25,
        netProfit: 425,
        profitMargin: 0.85,
        executionTime: 120,
        riskScore: 30,
        confidence: 0.9,
        timestamp: Date.now(),
        executionPaths: []
      };

      const analysis = await analyzer.analyzeFeasibility(opportunity);

      expect(analysis).toBeDefined();
      expect(analysis.technicalFeasibility).toBeDefined();
      expect(analysis.technicalFeasibility.score).toBeGreaterThan(0);
      expect(analysis.technicalFeasibility.score).toBeLessThanOrEqual(100);
      
      // Should identify basic technical requirements
      expect(analysis.technicalFeasibility.requirements).toBeDefined();
      expect(Array.isArray(analysis.technicalFeasibility.requirements)).toBe(true);
    });

    it('should identify complex execution requirements for multi-hop arbitrage', async () => {
      const complexOpportunity: ArbitrageOpportunity = {
        id: 'tech-feasibility-complex',
        assetId: 'WETH' as AssetID,
        sourceChain: 'ethereum' as ChainID,
        targetChain: 'arbitrum' as ChainID,
        sourcePrice: 2000.00,
        targetPrice: 1985.00,
        priceDifference: 15.00,
        percentageDifference: 0.75,
        expectedProfit: 1500,
        estimatedGasCost: 120,
        bridgeFee: 80,
        netProfit: 1300,
        profitMargin: 0.867,
        executionTime: 240,
        riskScore: 45,
        confidence: 0.75,
        timestamp: Date.now(),
        executionPaths: [
          {
            id: 'complex-path',
            steps: [
              { action: 'approve', chain: 'ethereum' as ChainID, dex: 'uniswap', gasEstimate: 30 },
              { action: 'swap', chain: 'ethereum' as ChainID, dex: 'uniswap', gasEstimate: 60 },
              { action: 'bridge', chain: 'ethereum' as ChainID, bridge: 'stargate', gasEstimate: 80 },
              { action: 'swap', chain: 'arbitrum' as ChainID, dex: 'camelot', gasEstimate: 25 },
              { action: 'unwrap', chain: 'arbitrum' as ChainID, dex: 'camelot', gasEstimate: 15 }
            ],
            totalGasEstimate: 210,
            estimatedTime: 240,
            successProbability: 0.75
          }
        ]
      };

      const analysis = await analyzer.analyzeFeasibility(complexOpportunity);

      expect(analysis.technicalFeasibility.score).toBeLessThan(90); // More complex = lower score
      expect(analysis.technicalFeasibility.requirements.length).toBeGreaterThan(3);
      
      // Should identify specific requirements for multi-hop execution
      const requirementTypes = analysis.technicalFeasibility.requirements.map(req => req.type);
      expect(requirementTypes).toContain('bridge_approval');
      expect(requirementTypes).toContain('multi_step_coordination');
      
      // Should identify execution bottlenecks
      expect(analysis.bottlenecks.length).toBeGreaterThan(0);
      expect(analysis.bottlenecks.some(bottleneck => 
        bottleneck.type === 'execution_complexity'
      )).toBe(true);
    });

    it('should assess network reliability and infrastructure requirements', async () => {
      const opportunity: ArbitrageOpportunity = {
        id: 'network-reliability-test',
        assetId: 'USDC' as AssetID,
        sourceChain: 'ethereum' as ChainID,
        targetChain: 'avalanche' as ChainID, // Cross-ecosystem
        sourcePrice: 1.0000,
        targetPrice: 0.992,
        priceDifference: 0.008,
        percentageDifference: 0.8,
        expectedProfit: 800,
        estimatedGasCost: 70,
        bridgeFee: 45,
        netProfit: 685,
        profitMargin: 0.856,
        executionTime: 180,
        riskScore: 50,
        confidence: 0.7,
        timestamp: Date.now(),
        executionPaths: []
      };

      const analysis = await analyzer.analyzeFeasibility(opportunity);

      expect(analysis.infrastructureFeasibility).toBeDefined();
      expect(analysis.infrastructureFeasibility.score).toBeGreaterThan(0);
      
      // Should assess network reliability
      expect(analysis.infrastructureFeasibility.networkReliability).toBeDefined();
      expect(Array.isArray(analysis.infrastructureFeasibility.networkReliability)).toBe(true);
      
      // Cross-ecosystem bridges should have additional requirements
      const networkReliabilities = analysis.infrastructureFeasibility.networkReliability;
      expect(networkReliabilities.some(nr => nr.chain === 'ethereum')).toBe(true);
      expect(networkReliabilities.some(nr => nr.chain === 'avalanche')).toBe(true);
    });
  });

  describe('Resource Feasibility Analysis', () => {
    it('should analyze capital and liquidity requirements', async () => {
      const highValueOpportunity: ArbitrageOpportunity = {
        id: 'resource-analysis-high-value',
        assetId: 'WBTC' as AssetID,
        sourceChain: 'ethereum' as ChainID,
        targetChain: 'arbitrum' as ChainID,
        sourcePrice: 40000.00,
        targetPrice: 39600.00,
        priceDifference: 400.00,
        percentageDifference: 1.0,
        expectedProfit: 10000, // $10k profit
        estimatedGasCost: 200,
        bridgeFee: 150,
        netProfit: 9650,
        profitMargin: 0.965,
        executionTime: 300,
        riskScore: 35,
        confidence: 0.85,
        timestamp: Date.now(),
        executionPaths: []
      };

      const analysis = await analyzer.analyzeFeasibility(highValueOpportunity);

      expect(analysis.resourceFeasibility).toBeDefined();
      expect(analysis.resourceFeasibility.score).toBeGreaterThan(0);
      
      // Should identify capital requirements
      expect(analysis.resourceFeasibility.constraints).toBeDefined();
      const capitalConstraints = analysis.resourceFeasibility.constraints.filter(
        constraint => constraint.type === 'capital_requirement'
      );
      expect(capitalConstraints.length).toBeGreaterThan(0);
      
      // High-value opportunities should have higher capital requirements
      const capitalRequirement = capitalConstraints.find(c => c.type === 'capital_requirement');
      expect(capitalRequirement?.amount).toBeGreaterThan(100000); // >$100k
    });

    it('should evaluate gas and fee budgets', async () => {
      const gasIntensiveOpportunity: ArbitrageOpportunity = {
        id: 'gas-budget-analysis',
        assetId: 'USDC' as AssetID,
        sourceChain: 'ethereum' as ChainID,
        targetChain: 'polygon' as ChainID,
        sourcePrice: 1.0000,
        targetPrice: 0.996,
        priceDifference: 0.004,
        percentageDifference: 0.4,
        expectedProfit: 200,
        estimatedGasCost: 150, // High gas cost
        bridgeFee: 30,
        netProfit: 20, // Very tight margins
        profitMargin: 0.1,
        executionTime: 120,
        riskScore: 60,
        confidence: 0.6,
        timestamp: Date.now(),
        executionPaths: []
      };

      const analysis = await analyzer.analyzeFeasibility(gasIntensiveOpportunity);

      // Should identify gas budget constraints
      const gasConstraints = analysis.resourceFeasibility.constraints.filter(
        constraint => constraint.type === 'gas_budget'
      );
      expect(gasConstraints.length).toBeGreaterThan(0);
      
      // Should flag tight margin issues
      expect(analysis.resourceFeasibility.score).toBeLessThan(50); // Low feasibility due to tight margins
      
      // Should recommend optimizations
      expect(analysis.recommendation.optimizations.some(opt => 
        opt.includes('gas') || opt.includes('margin')
      )).toBe(true);
    });

    it('should assess liquidity availability across chains', async () => {
      const liquidityTestOpportunity: ArbitrageOpportunity = {
        id: 'liquidity-assessment',
        assetId: 'USDC' as AssetID,
        sourceChain: 'ethereum' as ChainID,
        targetChain: 'optimism' as ChainID,
        sourcePrice: 1.0000,
        targetPrice: 0.994,
        priceDifference: 0.006,
        percentageDifference: 0.6,
        expectedProfit: 3000, // Large trade size
        estimatedGasCost: 80,
        bridgeFee: 40,
        netProfit: 2880,
        profitMargin: 0.96,
        executionTime: 160,
        riskScore: 40,
        confidence: 0.8,
        timestamp: Date.now(),
        executionPaths: []
      };

      const analysis = await analyzer.analyzeFeasibility(liquidityTestOpportunity);

      // Should assess liquidity constraints
      const liquidityConstraints = analysis.resourceFeasibility.constraints.filter(
        constraint => constraint.type === 'liquidity_availability'
      );
      expect(liquidityConstraints.length).toBeGreaterThan(0);
      
      // Should analyze both source and target chain liquidity
      expect(liquidityConstraints.some(lc => 
        lc.description.includes('ethereum') || lc.description.includes('source')
      )).toBe(true);
      expect(liquidityConstraints.some(lc => 
        lc.description.includes('optimism') || lc.description.includes('target')
      )).toBe(true);
    });
  });

  describe('Timing Feasibility Analysis', () => {
    it('should analyze execution timing constraints', async () => {
      const timeConstrainedOpportunity: ArbitrageOpportunity = {
        id: 'timing-constraints',
        assetId: 'USDC' as AssetID,
        sourceChain: 'ethereum' as ChainID,
        targetChain: 'bsc' as ChainID,
        sourcePrice: 1.0000,
        targetPrice: 0.993,
        priceDifference: 0.007,
        percentageDifference: 0.7,
        expectedProfit: 700,
        estimatedGasCost: 90,
        bridgeFee: 50,
        netProfit: 560,
        profitMargin: 0.8,
        executionTime: 420, // 7 minutes - longer execution
        riskScore: 55,
        confidence: 0.65,
        timestamp: Date.now() - 25000, // 25 seconds old
        executionPaths: []
      };

      const analysis = await analyzer.analyzeFeasibility(timeConstrainedOpportunity);

      expect(analysis.timingFeasibility).toBeDefined();
      expect(analysis.timingFeasibility.score).toBeGreaterThan(0);
      
      // Should identify timing constraints
      expect(analysis.timingFeasibility.constraints).toBeDefined();
      const timingConstraints = analysis.timingFeasibility.constraints;
      
      // Should flag long execution time
      expect(timingConstraints.some(tc => 
        tc.type === 'execution_window' && tc.description.includes('long')
      )).toBe(true);
      
      // Should consider opportunity age
      expect(timingConstraints.some(tc => 
        tc.type === 'opportunity_age'
      )).toBe(true);
    });

    it('should evaluate market timing and volatility windows', async () => {
      const volatilityTestOpportunity: ArbitrageOpportunity = {
        id: 'volatility-timing',
        assetId: 'WETH' as AssetID,
        sourceChain: 'ethereum' as ChainID,
        targetChain: 'arbitrum' as ChainID,
        sourcePrice: 2000.00,
        targetPrice: 1992.00,
        priceDifference: 8.00,
        percentageDifference: 0.4,
        expectedProfit: 800,
        estimatedGasCost: 100,
        bridgeFee: 60,
        netProfit: 640,
        profitMargin: 0.8,
        executionTime: 180,
        riskScore: 65, // Higher risk due to ETH volatility
        confidence: 0.7,
        timestamp: Date.now(),
        executionPaths: []
      };

      // Mock market data with high volatility
      const marketData = {
        volatility: { WETH: 0.15 }, // 15% volatility
        gasPrice: { ethereum: 60e9 },
        bridgeHealth: { stargate: 0.92 }
      };

      const analysis = await analyzer.analyzeFeasibility(volatilityTestOpportunity, marketData);

      // Should account for volatility in timing analysis
      expect(analysis.timingFeasibility.constraints.some(tc => 
        tc.type === 'market_volatility'
      )).toBe(true);
      
      // High volatility should reduce timing feasibility score
      expect(analysis.timingFeasibility.score).toBeLessThan(70);
      
      // Should recommend faster execution or volatility protection
      expect(analysis.recommendation.optimizations.some(opt => 
        opt.includes('volatility') || opt.includes('timing')
      )).toBe(true);
    });

    it('should consider network congestion and gas price timing', async () => {
      const congestionTestOpportunity: ArbitrageOpportunity = {
        id: 'congestion-timing',
        assetId: 'USDC' as AssetID,
        sourceChain: 'ethereum' as ChainID,
        targetChain: 'polygon' as ChainID,
        sourcePrice: 1.0000,
        targetPrice: 0.995,
        priceDifference: 0.005,
        percentageDifference: 0.5,
        expectedProfit: 500,
        estimatedGasCost: 120, // High due to congestion
        bridgeFee: 25,
        netProfit: 355,
        profitMargin: 0.71,
        executionTime: 200, // Slower due to congestion
        riskScore: 45,
        confidence: 0.75,
        timestamp: Date.now(),
        executionPaths: []
      };

      // Mock congested network conditions
      const congestionData = {
        gasPrice: { ethereum: 150e9 }, // Very high gas
        networkCongestion: { ethereum: 0.95, polygon: 0.3 },
        bridgeHealth: { stargate: 0.85 } // Reduced due to congestion
      };

      const analysis = await analyzer.analyzeFeasibility(congestionTestOpportunity, congestionData);

      // Should identify network congestion constraints
      expect(analysis.timingFeasibility.constraints.some(tc => 
        tc.type === 'network_congestion'
      )).toBe(true);
      
      // Should flag gas price timing issues
      expect(analysis.timingFeasibility.constraints.some(tc => 
        tc.type === 'gas_price_timing'
      )).toBe(true);
      
      // Should recommend timing optimizations
      expect(analysis.recommendation.optimizations.some(opt => 
        opt.includes('gas') || opt.includes('congestion') || opt.includes('timing')
      )).toBe(true);
      
      // Should suggest alternatives
      expect(analysis.alternatives.length).toBeGreaterThan(0);
      expect(analysis.alternatives.some(alt => 
        alt.description.includes('delay') || alt.description.includes('gas')
      )).toBe(true);
    });
  });

  describe('Alternative Execution Paths', () => {
    it('should identify alternative bridges and routes', async () => {
      const multiRouteOpportunity: ArbitrageOpportunity = {
        id: 'multi-route-test',
        assetId: 'USDC' as AssetID,
        sourceChain: 'ethereum' as ChainID,
        targetChain: 'arbitrum' as ChainID,
        sourcePrice: 1.0000,
        targetPrice: 0.9945,
        priceDifference: 0.0055,
        percentageDifference: 0.55,
        expectedProfit: 550,
        estimatedGasCost: 80,
        bridgeFee: 35,
        netProfit: 435,
        profitMargin: 0.791,
        executionTime: 150,
        riskScore: 40,
        confidence: 0.8,
        timestamp: Date.now(),
        executionPaths: []
      };

      const analysis = await analyzer.analyzeFeasibility(multiRouteOpportunity);

      // Should identify multiple bridge alternatives
      expect(analysis.alternatives.length).toBeGreaterThan(0);
      
      const bridgeAlternatives = analysis.alternatives.filter(alt => 
        alt.description.includes('bridge') || alt.description.includes('route')
      );
      expect(bridgeAlternatives.length).toBeGreaterThan(0);
      
      // Should provide impact analysis for alternatives
      for (const alternative of bridgeAlternatives) {
        expect(alternative.feasibilityChange).toBeDefined();
        expect(typeof alternative.feasibilityChange).toBe('number');
        expect(alternative.impact).toBeDefined();
        expect(alternative.impact.length).toBeGreaterThan(0);
      }
    });

    it('should suggest DEX routing optimizations', async () => {
      const dexOptimizationOpportunity: ArbitrageOpportunity = {
        id: 'dex-optimization-test',
        assetId: 'WETH' as AssetID,
        sourceChain: 'ethereum' as ChainID,
        targetChain: 'polygon' as ChainID,
        sourcePrice: 2000.00,
        targetPrice: 1988.00,
        priceDifference: 12.00,
        percentageDifference: 0.6,
        expectedProfit: 1200,
        estimatedGasCost: 140,
        bridgeFee: 70,
        netProfit: 990,
        profitMargin: 0.825,
        executionTime: 200,
        riskScore: 45,
        confidence: 0.75,
        timestamp: Date.now(),
        executionPaths: []
      };

      const analysis = await analyzer.analyzeFeasibility(dexOptimizationOpportunity);

      // Should identify DEX routing alternatives
      const dexAlternatives = analysis.alternatives.filter(alt => 
        alt.description.includes('DEX') || alt.description.includes('swap') || alt.description.includes('routing')
      );
      expect(dexAlternatives.length).toBeGreaterThan(0);
      
      // Should consider liquidity and slippage implications
      for (const alternative of dexAlternatives) {
        expect(alternative.description).toContain('liquidity' || 'slippage' || 'routing');
      }
    });

    it('should recommend execution timing alternatives', async () => {
      const timingOptimizationOpportunity: ArbitrageOpportunity = {
        id: 'timing-optimization-test',
        assetId: 'USDC' as AssetID,
        sourceChain: 'ethereum' as ChainID,
        targetChain: 'optimism' as ChainID,
        sourcePrice: 1.0000,
        targetPrice: 0.994,
        priceDifference: 0.006,
        percentageDifference: 0.6,
        expectedProfit: 300,
        estimatedGasCost: 100, // High gas cost
        bridgeFee: 40,
        netProfit: 160, // Tight margins
        profitMargin: 0.533,
        executionTime: 180,
        riskScore: 50,
        confidence: 0.7,
        timestamp: Date.now(),
        executionPaths: []
      };

      // Mock high gas price conditions
      const highGasData = {
        gasPrice: { ethereum: 120e9 }, // Very high gas
        gasPriceHistory: {
          ethereum: [80e9, 100e9, 120e9, 110e9, 90e9] // Recent history showing fluctuation
        }
      };

      const analysis = await analyzer.analyzeFeasibility(timingOptimizationOpportunity, highGasData);

      // Should suggest timing-based alternatives
      const timingAlternatives = analysis.alternatives.filter(alt => 
        alt.description.includes('timing') || alt.description.includes('delay') || alt.description.includes('gas')
      );
      expect(timingAlternatives.length).toBeGreaterThan(0);
      
      // Should suggest waiting for better gas prices
      expect(timingAlternatives.some(alt => 
        alt.description.includes('gas price') && alt.description.includes('lower')
      )).toBe(true);
      
      // Should quantify the timing impact
      const gasTimingAlt = timingAlternatives.find(alt => alt.description.includes('gas price'));
      expect(gasTimingAlt?.feasibilityChange).toBeGreaterThan(0); // Should improve feasibility
    });
  });

  describe('Execution Bottleneck Identification', () => {
    it('should identify and categorize execution bottlenecks', async () => {
      const bottleneckTestOpportunity: ArbitrageOpportunity = {
        id: 'bottleneck-identification',
        assetId: 'USDC' as AssetID,
        sourceChain: 'ethereum' as ChainID,
        targetChain: 'avalanche' as ChainID,
        sourcePrice: 1.0000,
        targetPrice: 0.991,
        priceDifference: 0.009,
        percentageDifference: 0.9,
        expectedProfit: 900,
        estimatedGasCost: 150,
        bridgeFee: 80,
        netProfit: 670,
        profitMargin: 0.744,
        executionTime: 300, // Long execution
        riskScore: 60,
        confidence: 0.65,
        timestamp: Date.now(),
        executionPaths: []
      };

      const analysis = await analyzer.analyzeFeasibility(bottleneckTestOpportunity);

      expect(analysis.bottlenecks).toBeDefined();
      expect(analysis.bottlenecks.length).toBeGreaterThan(0);
      
      // Should categorize bottlenecks by type
      const bottleneckTypes = analysis.bottlenecks.map(b => b.type);
      const uniqueTypes = new Set(bottleneckTypes);
      expect(uniqueTypes.size).toBeGreaterThan(0);
      
      // Should provide severity and impact assessment
      for (const bottleneck of analysis.bottlenecks) {
        expect(bottleneck.severity).toBeDefined();
        expect(['low', 'medium', 'high', 'critical']).toContain(bottleneck.severity);
        expect(bottleneck.impact).toBeDefined();
        expect(bottleneck.impact.length).toBeGreaterThan(0);
      }
    });

    it('should suggest bottleneck mitigation strategies', async () => {
      const mitigationTestOpportunity: ArbitrageOpportunity = {
        id: 'bottleneck-mitigation',
        assetId: 'WETH' as AssetID,
        sourceChain: 'ethereum' as ChainID,
        targetChain: 'bsc' as ChainID,
        sourcePrice: 2000.00,
        targetPrice: 1985.00,
        priceDifference: 15.00,
        percentageDifference: 0.75,
        expectedProfit: 1500,
        estimatedGasCost: 200,
        bridgeFee: 100,
        netProfit: 1200,
        profitMargin: 0.8,
        executionTime: 350,
        riskScore: 70, // High risk
        confidence: 0.6,
        timestamp: Date.now(),
        executionPaths: []
      };

      const analysis = await analyzer.analyzeFeasibility(mitigationTestOpportunity);

      if (analysis.bottlenecks.length > 0) {
        // Should provide mitigation strategies for each bottleneck
        for (const bottleneck of analysis.bottlenecks) {
          expect(bottleneck.mitigation).toBeDefined();
          expect(Array.isArray(bottleneck.mitigation)).toBe(true);
          expect(bottleneck.mitigation.length).toBeGreaterThan(0);
        }
        
        // High-severity bottlenecks should have multiple mitigation strategies
        const criticalBottlenecks = analysis.bottlenecks.filter(b => 
          b.severity === 'critical' || b.severity === 'high'
        );
        
        if (criticalBottlenecks.length > 0) {
          expect(criticalBottlenecks[0].mitigation.length).toBeGreaterThan(1);
        }
      }
    });
  });

  describe('Recommendation Engine', () => {
    it('should provide comprehensive feasibility recommendations', async () => {
      const recommendationTestOpportunity: ArbitrageOpportunity = {
        id: 'recommendation-test',
        assetId: 'USDC' as AssetID,
        sourceChain: 'ethereum' as ChainID,
        targetChain: 'polygon' as ChainID,
        sourcePrice: 1.0000,
        targetPrice: 0.9935,
        priceDifference: 0.0065,
        percentageDifference: 0.65,
        expectedProfit: 650,
        estimatedGasCost: 80,
        bridgeFee: 35,
        netProfit: 535,
        profitMargin: 0.823,
        executionTime: 140,
        riskScore: 45,
        confidence: 0.8,
        timestamp: Date.now(),
        executionPaths: []
      };

      const analysis = await analyzer.analyzeFeasibility(recommendationTestOpportunity);

      expect(analysis.recommendation).toBeDefined();
      expect(analysis.recommendation.action).toBeDefined();
      expect(['proceed', 'proceed_with_caution', 'defer', 'reject']).toContain(analysis.recommendation.action);
      
      expect(analysis.recommendation.priority).toBeDefined();
      expect(['high', 'medium', 'low', 'ignore']).toContain(analysis.recommendation.priority);
      
      expect(analysis.recommendation.confidence).toBeDefined();
      expect(analysis.recommendation.confidence).toBeGreaterThan(0);
      expect(analysis.recommendation.confidence).toBeLessThanOrEqual(1);
      
      expect(analysis.recommendation.estimatedTime).toBeDefined();
      expect(analysis.recommendation.estimatedTime).toBeGreaterThan(0);
      
      // Should provide specific optimizations
      expect(analysis.recommendation.optimizations).toBeDefined();
      expect(Array.isArray(analysis.recommendation.optimizations)).toBe(true);
    });

    it('should adjust recommendations based on overall feasibility score', async () => {
      const testScenarios = [
        {
          name: 'High Feasibility',
          opportunity: {
            expectedProfit: 1000,
            netProfit: 850,
            executionTime: 90,
            riskScore: 25,
            confidence: 0.95
          },
          expectedAction: 'proceed',
          expectedPriority: 'high'
        },
        {
          name: 'Medium Feasibility',
          opportunity: {
            expectedProfit: 400,
            netProfit: 280,
            executionTime: 180,
            riskScore: 55,
            confidence: 0.7
          },
          expectedAction: 'proceed_with_caution',
          expectedPriority: 'medium'
        },
        {
          name: 'Low Feasibility',
          opportunity: {
            expectedProfit: 150,
            netProfit: 50,
            executionTime: 400,
            riskScore: 85,
            confidence: 0.4
          },
          expectedAction: 'defer',
          expectedPriority: 'low'
        }
      ];

      for (const scenario of testScenarios) {
        const testOpportunity: ArbitrageOpportunity = {
          id: `recommendation-${scenario.name}`,
          assetId: 'USDC' as AssetID,
          sourceChain: 'ethereum' as ChainID,
          targetChain: 'polygon' as ChainID,
          sourcePrice: 1.0000,
          targetPrice: 0.995,
          priceDifference: 0.005,
          percentageDifference: 0.5,
          expectedProfit: scenario.opportunity.expectedProfit,
          estimatedGasCost: 50,
          bridgeFee: 25,
          netProfit: scenario.opportunity.netProfit,
          profitMargin: scenario.opportunity.netProfit / scenario.opportunity.expectedProfit,
          executionTime: scenario.opportunity.executionTime,
          riskScore: scenario.opportunity.riskScore,
          confidence: scenario.opportunity.confidence,
          timestamp: Date.now(),
          executionPaths: []
        };

        const analysis = await analyzer.analyzeFeasibility(testOpportunity);

        expect(analysis.recommendation.action).toBe(scenario.expectedAction);
        expect(analysis.recommendation.priority).toBe(scenario.expectedPriority);

        console.log(`${scenario.name} Scenario:
          Overall Score: ${analysis.overallScore}
          Action: ${analysis.recommendation.action}
          Priority: ${analysis.recommendation.priority}
          Confidence: ${analysis.recommendation.confidence.toFixed(2)}`);
      }
    });
  });
});