/**
 * Capital Efficiency Analyzer Tests
 * Comprehensive tests for the capital efficiency optimization system
 */

import { CapitalEfficiencyAnalyzer } from '../capital-efficiency-analyzer';
import { DEFAULT_BRIDGE_CONFIG } from '../../bridge-satellite';
import { BridgeSatelliteConfig } from '../../types';

// Mock logger to prevent console output during tests
jest.mock('../../../../shared/logging/logger', () => ({
  getLogger: () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  }),
}));

describe('Capital Efficiency Analyzer', () => {
  let analyzer: CapitalEfficiencyAnalyzer;
  
  const testConfig: BridgeSatelliteConfig = {
    ...DEFAULT_BRIDGE_CONFIG,
    chains: [
      { id: 'ethereum', name: 'Ethereum', rpcUrl: 'http://localhost:8545' },
      { id: 'polygon', name: 'Polygon', rpcUrl: 'http://localhost:8546' },
      { id: 'arbitrum', name: 'Arbitrum', rpcUrl: 'http://localhost:8547' }
    ],
    liquidity: {
      rebalanceThreshold: 0.1,
      minUtilization: 0.3,
      maxUtilization: 0.85,
      targetDistribution: {
        ethereum: 0.4,
        polygon: 0.3,
        arbitrum: 0.3
      }
    }
  };

  beforeEach(async () => {
    analyzer = new CapitalEfficiencyAnalyzer(testConfig, {
      riskTolerance: 'moderate',
      minIdleThreshold: 0.05,
      rebalancingCostThreshold: 1000,
      targetUtilizationRate: 0.85
    });
    
    await analyzer.initialize();
  });

  afterEach(async () => {
    await analyzer.stop();
  });

  describe('Initialization and Configuration', () => {
    test('should initialize successfully', async () => {
      expect(analyzer).toBeDefined();
    });

    test('should start and stop correctly', async () => {
      await analyzer.start();
      await analyzer.stop();
      // No errors should be thrown
    });

    test('should handle configuration updates', () => {
      const newConfig = {
        ...testConfig,
        liquidity: {
          ...testConfig.liquidity,
          targetDistribution: {
            ethereum: 0.5,
            polygon: 0.25,
            arbitrum: 0.25
          }
        }
      };

      analyzer.updateConfig(newConfig);
      // Should complete without errors
    });
  });

  describe('Capital Efficiency Analysis', () => {
    test('should analyze capital efficiency', async () => {
      const metrics = await analyzer.analyzeCapitalEfficiency();

      expect(metrics).toBeDefined();
      expect(metrics.overallEfficiency).toBeGreaterThanOrEqual(0);
      expect(metrics.overallEfficiency).toBeLessThanOrEqual(100);
      expect(metrics.totalCapital).toBeGreaterThan(0);
      expect(metrics.activeCapital).toBeGreaterThanOrEqual(0);
      expect(metrics.idleCapital).toBeGreaterThanOrEqual(0);
      expect(metrics.totalOpportunityCost).toBeGreaterThanOrEqual(0);
      expect(metrics.optimalReallocation).toBeInstanceOf(Array);
      expect(metrics.efficiencyScore).toBeGreaterThanOrEqual(0);
      expect(metrics.efficiencyScore).toBeLessThanOrEqual(100);

      // Total capital should equal active + idle
      expect(Math.abs(metrics.totalCapital - (metrics.activeCapital + metrics.idleCapital))).toBeLessThan(1);
    });

    test('should provide allocation breakdown by chain and asset', async () => {
      const breakdown = await analyzer.getCapitalAllocationBreakdown();

      expect(breakdown.byChain).toBeDefined();
      expect(breakdown.byAsset).toBeDefined();
      expect(breakdown.topOpportunities).toBeInstanceOf(Array);
      expect(breakdown.underperformingAllocations).toBeInstanceOf(Array);

      // Verify chain breakdown structure
      for (const [chainId, data] of Object.entries(breakdown.byChain)) {
        expect(typeof chainId).toBe('string');
        expect(data.total).toBeGreaterThanOrEqual(0);
        expect(data.utilized).toBeGreaterThanOrEqual(0);
        expect(data.idle).toBeGreaterThanOrEqual(0);
        expect(data.efficiency).toBeGreaterThanOrEqual(0);
        expect(data.efficiency).toBeLessThanOrEqual(100);
      }

      // Verify asset breakdown structure
      for (const [assetId, data] of Object.entries(breakdown.byAsset)) {
        expect(typeof assetId).toBe('string');
        expect(data.total).toBeGreaterThanOrEqual(0);
        expect(data.utilized).toBeGreaterThanOrEqual(0);
        expect(data.idle).toBeGreaterThanOrEqual(0);
        expect(data.efficiency).toBeGreaterThanOrEqual(0);
        expect(data.efficiency).toBeLessThanOrEqual(100);
      }

      // Verify top opportunities
      expect(breakdown.topOpportunities.length).toBeLessThanOrEqual(5);
      for (const opportunity of breakdown.topOpportunities) {
        expect(opportunity.chainId).toBeDefined();
        expect(opportunity.assetId).toBeDefined();
        expect(opportunity.expectedAPY).toBeGreaterThan(0);
        expect(opportunity.riskScore).toBeGreaterThanOrEqual(0);
        expect(opportunity.riskScore).toBeLessThanOrEqual(100);
      }
    });

    test('should calculate current efficiency metrics', () => {
      const metrics = analyzer.getCurrentEfficiencyMetrics();

      expect(metrics.utilizationRate).toBeGreaterThanOrEqual(0);
      expect(metrics.utilizationRate).toBeLessThanOrEqual(1);
      expect(metrics.idleCapitalRatio).toBeGreaterThanOrEqual(0);
      expect(metrics.idleCapitalRatio).toBeLessThanOrEqual(1);
      expect(metrics.opportunityCostRate).toBeGreaterThanOrEqual(0);
      expect(['improving', 'stable', 'declining']).toContain(metrics.efficiencyTrend);
      expect(metrics.lastUpdate).toBeGreaterThanOrEqual(0);

      // Utilization rate + idle capital ratio should approximately equal 1
      expect(Math.abs((metrics.utilizationRate + metrics.idleCapitalRatio) - 1)).toBeLessThan(0.01);
    });
  });

  describe('Optimization Recommendations', () => {
    test('should generate optimization recommendations', async () => {
      const recommendations = await analyzer.generateOptimizationRecommendations();

      expect(recommendations.immediate).toBeInstanceOf(Array);
      expect(recommendations.strategic).toBeInstanceOf(Array);
      expect(recommendations.yieldFarming).toBeInstanceOf(Array);
      expect(recommendations.riskMitigation).toBeInstanceOf(Array);
      expect(recommendations.estimatedImpact).toBeDefined();

      // Verify immediate recommendations structure
      for (const rec of recommendations.immediate) {
        expect(rec.fromChain).toBeDefined();
        expect(rec.toChain).toBeDefined();
        expect(rec.assetId).toBeDefined();
        expect(rec.amount).toBeGreaterThan(0);
        expect(rec.expectedImprovement).toBeGreaterThanOrEqual(0);
        expect(rec.executionCost).toBeGreaterThanOrEqual(0);
        expect(rec.netBenefit).toBeGreaterThan(0); // Should only include profitable moves
        expect(['low', 'medium', 'high']).toContain(rec.priority);
        expect(rec.timeToExecute).toBeGreaterThan(0);
      }

      // Verify yield farming opportunities
      expect(recommendations.yieldFarming.length).toBeLessThanOrEqual(3);
      for (const opportunity of recommendations.yieldFarming) {
        expect(opportunity.expectedAPY).toBeGreaterThan(5); // Should be > 5% risk-adjusted
        expect(opportunity.riskScore).toBeLessThanOrEqual(60); // Should respect moderate risk tolerance
      }

      // Verify estimated impact
      const impact = recommendations.estimatedImpact;
      expect(impact.additionalYield).toBeGreaterThanOrEqual(0);
      expect(impact.reducedOpportunityCost).toBeGreaterThanOrEqual(0);
      expect(impact.improvedEfficiency).toBeGreaterThanOrEqual(0);
    });

    test('should handle different risk tolerance levels', async () => {
      // Test conservative risk tolerance
      const conservativeAnalyzer = new CapitalEfficiencyAnalyzer(testConfig, {
        riskTolerance: 'conservative'
      });
      await conservativeAnalyzer.initialize();
      
      const conservativeRecs = await conservativeAnalyzer.generateOptimizationRecommendations();
      
      // Conservative should have lower risk opportunities
      for (const opportunity of conservativeRecs.yieldFarming) {
        expect(opportunity.riskScore).toBeLessThanOrEqual(40);
      }

      await conservativeAnalyzer.stop();

      // Test aggressive risk tolerance
      const aggressiveAnalyzer = new CapitalEfficiencyAnalyzer(testConfig, {
        riskTolerance: 'aggressive'
      });
      await aggressiveAnalyzer.initialize();
      
      const aggressiveRecs = await aggressiveAnalyzer.generateOptimizationRecommendations();
      
      // Aggressive should accept higher risk opportunities
      const hasHighRiskOpportunity = aggressiveRecs.yieldFarming.some(opp => opp.riskScore > 60);
      expect(hasHighRiskOpportunity).toBe(true);

      await aggressiveAnalyzer.stop();
    });
  });

  describe('Scenario Simulation', () => {
    test('should simulate allocation scenarios', async () => {
      const scenarios = [
        {
          name: 'Conservative Distribution',
          allocations: {
            ethereum: { USDC: 400000, ETH: 100000 },
            polygon: { USDC: 200000, USDT: 100000 },
            arbitrum: { ETH: 150000, USDC: 50000 }
          }
        },
        {
          name: 'Aggressive Distribution',
          allocations: {
            ethereum: { ETH: 300000, WBTC: 200000 },
            polygon: { USDC: 150000 },
            arbitrum: { ETH: 250000, USDC: 100000 }
          }
        }
      ];

      const results = await analyzer.simulateAllocationScenarios(scenarios);

      expect(results).toHaveLength(2);
      
      for (const result of results) {
        expect(result.name).toBeDefined();
        expect(result.projectedEfficiency).toBeGreaterThanOrEqual(0);
        expect(result.projectedEfficiency).toBeLessThanOrEqual(100);
        expect(result.projectedYield).toBeGreaterThanOrEqual(0);
        expect(result.riskScore).toBeGreaterThanOrEqual(0);
        expect(result.riskScore).toBeLessThanOrEqual(100);
        expect(result.opportunityCost).toBeGreaterThanOrEqual(0);
        expect(result.feasibilityScore).toBeGreaterThanOrEqual(0);
        expect(result.feasibilityScore).toBeLessThanOrEqual(100);
      }

      // Results should be sorted by projected efficiency (highest first)
      for (let i = 1; i < results.length; i++) {
        expect(results[i - 1].projectedEfficiency).toBeGreaterThanOrEqual(results[i].projectedEfficiency);
      }
    });

    test('should handle invalid scenarios gracefully', async () => {
      const invalidScenarios = [
        {
          name: 'Unsupported Chain',
          allocations: {
            'unsupported-chain': { USDC: 100000 }
          }
        }
      ];

      const results = await analyzer.simulateAllocationScenarios(invalidScenarios);
      
      expect(results).toHaveLength(1);
      expect(results[0].feasibilityScore).toBeLessThan(100); // Should be penalized
    });
  });

  describe('Performance and Edge Cases', () => {
    test('should handle zero capital allocations', async () => {
      const zeroCapitalAnalyzer = new CapitalEfficiencyAnalyzer({
        ...testConfig,
        chains: []
      });
      await zeroCapitalAnalyzer.initialize();

      const metrics = await zeroCapitalAnalyzer.analyzeCapitalEfficiency();
      
      expect(metrics.totalCapital).toBe(0);
      expect(metrics.activeCapital).toBe(0);
      expect(metrics.idleCapital).toBe(0);
      expect(metrics.overallEfficiency).toBe(0);

      await zeroCapitalAnalyzer.stop();
    });

    test('should handle rapid consecutive calls', async () => {
      const promises = [];
      
      // Make multiple simultaneous calls
      for (let i = 0; i < 5; i++) {
        promises.push(analyzer.analyzeCapitalEfficiency());
      }

      const results = await Promise.all(promises);
      
      // All should complete successfully
      expect(results).toHaveLength(5);
      results.forEach(result => {
        expect(result).toBeDefined();
        expect(result.efficiencyScore).toBeGreaterThanOrEqual(0);
      });
    });

    test('should maintain consistency across multiple analyses', async () => {
      const analysis1 = await analyzer.analyzeCapitalEfficiency();
      const analysis2 = await analyzer.analyzeCapitalEfficiency();

      // Results should be consistent (within small margin for random variations)
      expect(Math.abs(analysis1.totalCapital - analysis2.totalCapital)).toBeLessThan(analysis1.totalCapital * 0.01);
      expect(Math.abs(analysis1.overallEfficiency - analysis2.overallEfficiency)).toBeLessThan(5);
    });

    test('should handle large capital amounts', async () => {
      const largeCapitalConfig = {
        ...testConfig,
        liquidity: {
          ...testConfig.liquidity,
          targetDistribution: {
            ethereum: 0.4,
            polygon: 0.3,
            arbitrum: 0.3
          }
        }
      };

      const largeAnalyzer = new CapitalEfficiencyAnalyzer(largeCapitalConfig);
      await largeAnalyzer.initialize();

      const metrics = await largeAnalyzer.analyzeCapitalEfficiency();
      
      expect(metrics.totalCapital).toBeGreaterThan(1000000); // Should handle millions
      expect(isFinite(metrics.overallEfficiency)).toBe(true);
      expect(isFinite(metrics.efficiencyScore)).toBe(true);

      await largeAnalyzer.stop();
    });
  });

  describe('Integration Tests', () => {
    test('should integrate with different chain configurations', async () => {
      const multiChainConfig = {
        ...testConfig,
        chains: [
          { id: 'ethereum', name: 'Ethereum', rpcUrl: 'http://localhost:8545' },
          { id: 'polygon', name: 'Polygon', rpcUrl: 'http://localhost:8546' },
          { id: 'arbitrum', name: 'Arbitrum', rpcUrl: 'http://localhost:8547' },
          { id: 'optimism', name: 'Optimism', rpcUrl: 'http://localhost:8548' },
          { id: 'avalanche', name: 'Avalanche', rpcUrl: 'http://localhost:8549' }
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

      const multiChainAnalyzer = new CapitalEfficiencyAnalyzer(multiChainConfig);
      await multiChainAnalyzer.initialize();

      const breakdown = await multiChainAnalyzer.getCapitalAllocationBreakdown();
      
      // Should handle all configured chains
      expect(Object.keys(breakdown.byChain)).toContain('ethereum');
      expect(Object.keys(breakdown.byChain)).toContain('polygon');
      expect(Object.keys(breakdown.byChain)).toContain('arbitrum');
      expect(Object.keys(breakdown.byChain)).toContain('optimism');
      expect(Object.keys(breakdown.byChain)).toContain('avalanche');

      await multiChainAnalyzer.stop();
    });

    test('should provide comprehensive optimization workflow', async () => {
      // Full workflow: analyze -> get recommendations -> simulate scenarios
      
      // Step 1: Initial analysis
      const initialMetrics = await analyzer.analyzeCapitalEfficiency();
      expect(initialMetrics.efficiencyScore).toBeGreaterThanOrEqual(0);

      // Step 2: Get optimization recommendations
      const recommendations = await analyzer.generateOptimizationRecommendations();
      expect(recommendations.immediate.length + recommendations.strategic.length).toBeGreaterThanOrEqual(0);

      // Step 3: Simulate implementation of recommendations
      if (recommendations.immediate.length > 0) {
        const optimizedScenario = {
          name: 'Optimized Allocation',
          allocations: {
            ethereum: { USDC: 350000, ETH: 150000 },
            polygon: { USDC: 200000, USDT: 100000 },
            arbitrum: { ETH: 180000, USDC: 70000 }
          }
        };

        const simulationResults = await analyzer.simulateAllocationScenarios([optimizedScenario]);
        expect(simulationResults).toHaveLength(1);
        expect(simulationResults[0].projectedEfficiency).toBeGreaterThan(0);
      }

      // Step 4: Verify real-time metrics
      const currentMetrics = analyzer.getCurrentEfficiencyMetrics();
      expect(currentMetrics.utilizationRate).toBeGreaterThanOrEqual(0);
      expect(['improving', 'stable', 'declining']).toContain(currentMetrics.efficiencyTrend);
    });
  });
});