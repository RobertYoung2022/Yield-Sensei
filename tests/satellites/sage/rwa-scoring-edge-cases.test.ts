/**
 * RWA Opportunity Scoring System - Edge Cases and Extreme Conditions Tests
 * Tests for unusual scenarios, boundary conditions, and system resilience
 */

import { jest } from '@jest/globals';
import { 
  RWAOpportunityScoringSystem, 
  DEFAULT_RWA_SCORING_CONFIG,
  RWAScoringConfig
} from '../../../src/satellites/sage/rwa/opportunity-scoring-system';
import { RWAData, RWAType } from '../../../src/satellites/sage/types';

// Mock logger
jest.mock('@/shared/logging/logger', () => ({
  getLogger: jest.fn(() => ({
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }))
}));

describe('RWA Scoring System - Edge Cases and Extreme Conditions', () => {
  let scoringSystem: RWAOpportunityScoringSystem;

  const createExtremeRWAData = (overrides: Partial<RWAData> = {}): RWAData => ({
    id: 'extreme-test-rwa',
    type: 'real-estate',
    issuer: 'Extreme Test Issuer',
    value: 1000000,
    currency: 'USD',
    maturityDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    yield: 0.065,
    riskRating: 'A',
    collateral: {
      type: 'real-estate',
      value: 1200000,
      ltv: 0.83,
      liquidationThreshold: 0.9
    },
    regulatoryStatus: {
      jurisdiction: 'US',
      complianceLevel: 'compliant',
      licenses: ['SEC-Registered'],
      restrictions: [],
      lastReview: new Date()
    },
    complianceScore: 85,
    ...overrides
  });

  beforeEach(() => {
    // Reset singleton
    (RWAOpportunityScoringSystem as any).instance = null;
    scoringSystem = RWAOpportunityScoringSystem.getInstance();
  });

  afterEach(async () => {
    try {
      await scoringSystem.shutdown();
    } catch (error) {
      // Ignore shutdown errors
    }
  });

  describe('Extreme Market Conditions', () => {
    beforeEach(async () => {
      await scoringSystem.initialize();
    });

    test('should handle hyperinflation scenarios', async () => {
      const hyperinflationRWA = createExtremeRWAData({
        yield: 5.0, // 500% yield
        type: 'bonds'
      });

      const score = await scoringSystem.scoreOpportunity(hyperinflationRWA);
      
      // Should still produce valid scores
      expect(score.yieldScore).toBeLessThanOrEqual(1);
      expect(score.overallScore).toBeLessThanOrEqual(1);
      expect(score.riskAdjustedReturn).toBeGreaterThan(0);
    });

    test('should handle market collapse with all negative indicators', async () => {
      // Override market data to simulate total collapse
      (scoringSystem as any).marketData.set('equity', {
        assetClass: 'equity',
        currentYield: -0.5,
        historicalYields: [-0.3, -0.4, -0.5],
        volatility: 0.99,
        liquidity: 0.01,
        marketSize: 1000000,
        growthRate: -0.8,
        correlation: 0.99
      });

      const collapseRWA = createExtremeRWAData({
        type: 'equity',
        yield: -0.3,
        value: 10000,
        riskRating: 'D',
        complianceScore: 10,
        collateral: {
          type: 'equity',
          value: 5000,
          ltv: 2.0,
          liquidationThreshold: 1.5
        }
      });

      const score = await scoringSystem.scoreOpportunity(collapseRWA);
      
      expect(score.overallScore).toBeLessThan(0.2);
      expect(score.riskAdjustedReturn).toBe(0);
      expect(score.recommendations[0].action).toBe('avoid');
      expect(score.recommendations[0].maxExposure).toBe(0);
    });

    test('should handle zero liquidity markets', async () => {
      (scoringSystem as any).marketData.set('art', {
        assetClass: 'art',
        currentYield: 0.08,
        historicalYields: [0.08],
        volatility: 0.5,
        liquidity: 0, // Zero liquidity
        marketSize: 10000000,
        growthRate: 0.01,
        correlation: 0.05
      });

      const illiquidRWA = createExtremeRWAData({
        type: 'art',
        value: 5000000 // Large position in illiquid market
      });

      const score = await scoringSystem.scoreOpportunity(illiquidRWA);
      
      expect(score.liquidityScore).toBeLessThan(0.3);
      expect(score.recommendations[0].riskLevel).toBe('high');
    });
  });

  describe('Boundary Value Testing', () => {
    beforeEach(async () => {
      await scoringSystem.initialize();
    });

    test('should handle maximum and minimum numeric values', async () => {
      const boundaryTests = [
        {
          name: 'Maximum values',
          data: createExtremeRWAData({
            value: Number.MAX_SAFE_INTEGER,
            yield: 1000,
            complianceScore: 100,
            collateral: {
              type: 'real-estate',
              value: Number.MAX_SAFE_INTEGER,
              ltv: 0,
              liquidationThreshold: 1
            }
          })
        },
        {
          name: 'Minimum values',
          data: createExtremeRWAData({
            value: 0.01,
            yield: 0.0001,
            complianceScore: 0,
            collateral: {
              type: 'real-estate',
              value: 0.01,
              ltv: 0.99999,
              liquidationThreshold: 1
            }
          })
        },
        {
          name: 'Zero values',
          data: createExtremeRWAData({
            value: 0,
            yield: 0,
            complianceScore: 0,
            collateral: {
              type: 'real-estate',
              value: 0,
              ltv: 0,
              liquidationThreshold: 0
            }
          })
        }
      ];

      for (const test of boundaryTests) {
        const score = await scoringSystem.scoreOpportunity(test.data);
        
        // All scores should be within valid range
        expect(score.overallScore).toBeGreaterThanOrEqual(0);
        expect(score.overallScore).toBeLessThanOrEqual(1);
        expect(score.yieldScore).toBeGreaterThanOrEqual(0);
        expect(score.yieldScore).toBeLessThanOrEqual(1);
        expect(score.riskScore).toBeGreaterThanOrEqual(0);
        expect(score.riskScore).toBeLessThanOrEqual(1);
        expect(score.confidence).toBeGreaterThanOrEqual(0);
        expect(score.confidence).toBeLessThanOrEqual(1);
      }
    });

    test('should handle edge case LTV and liquidation thresholds', async () => {
      const ltvEdgeCases = [
        { ltv: 0, liquidationThreshold: 0 },
        { ltv: 0.0001, liquidationThreshold: 0.0002 },
        { ltv: 0.9999, liquidationThreshold: 0.9999 },
        { ltv: 1, liquidationThreshold: 1 },
        { ltv: 10, liquidationThreshold: 15 }, // Over-leveraged
        { ltv: 0.5, liquidationThreshold: 0.4 }, // Threshold below LTV
      ];

      for (const edgeCase of ltvEdgeCases) {
        const rwaData = createExtremeRWAData({
          collateral: {
            type: 'real-estate',
            value: 1000000,
            ltv: edgeCase.ltv,
            liquidationThreshold: edgeCase.liquidationThreshold
          }
        });

        const score = await scoringSystem.scoreOpportunity(rwaData);
        
        expect(score.collateralScore).toBeGreaterThanOrEqual(0);
        expect(score.collateralScore).toBeLessThanOrEqual(1);
      }
    });
  });

  describe('Invalid Data Handling', () => {
    beforeEach(async () => {
      await scoringSystem.initialize();
    });

    test('should handle NaN and Infinity values', async () => {
      const invalidDataTests = [
        {
          name: 'NaN yield',
          data: createExtremeRWAData({ yield: NaN })
        },
        {
          name: 'Infinity value',
          data: createExtremeRWAData({ value: Infinity })
        },
        {
          name: 'Negative Infinity',
          data: createExtremeRWAData({ value: -Infinity })
        }
      ];

      for (const test of invalidDataTests) {
        // Should either handle gracefully or throw meaningful error
        try {
          const score = await scoringSystem.scoreOpportunity(test.data);
          // If it doesn't throw, check scores are valid
          expect(isFinite(score.overallScore)).toBe(true);
        } catch (error) {
          // Error is acceptable for invalid data
          expect(error).toBeInstanceOf(Error);
        }
      }
    });

    test('should handle malformed date values', async () => {
      const invalidDates = [
        new Date('invalid'),
        new Date(NaN),
        new Date(-8640000000000000), // Before minimum date
        new Date(8640000000000000),  // After maximum date
      ];

      for (const invalidDate of invalidDates) {
        const rwaData = createExtremeRWAData({
          maturityDate: invalidDate,
          regulatoryStatus: {
            jurisdiction: 'US',
            complianceLevel: 'compliant',
            licenses: [],
            restrictions: [],
            lastReview: invalidDate
          }
        });

        const score = await scoringSystem.scoreOpportunity(rwaData);
        
        // Should handle gracefully
        expect(score).toBeDefined();
        expect(score.overallScore).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('Race Conditions and Concurrency', () => {
    test('should handle rapid configuration changes', async () => {
      const configs = [
        { ...DEFAULT_RWA_SCORING_CONFIG, riskAdjustmentFactor: 1.0 },
        { ...DEFAULT_RWA_SCORING_CONFIG, riskAdjustmentFactor: 2.0 },
        { ...DEFAULT_RWA_SCORING_CONFIG, riskAdjustmentFactor: 3.0 },
      ];

      const systems = configs.map(config => {
        (RWAOpportunityScoringSystem as any).instance = null;
        return RWAOpportunityScoringSystem.getInstance(config);
      });

      // Initialize all systems concurrently
      await Promise.all(systems.map(s => s.initialize()));

      // Score with all systems concurrently
      const rwaData = createExtremeRWAData();
      const scores = await Promise.all(
        systems.map(s => s.scoreOpportunity(rwaData))
      );

      // All should complete successfully
      expect(scores).toHaveLength(3);
      scores.forEach(score => {
        expect(score.overallScore).toBeGreaterThan(0);
      });

      // Cleanup
      await Promise.all(systems.map(s => s.shutdown()));
    });

    test('should handle cache invalidation during concurrent access', async () => {
      await scoringSystem.initialize();

      const rwaData = createExtremeRWAData();
      
      // Start multiple scoring operations
      const scoringPromises = Array(10).fill(null).map(() => 
        scoringSystem.scoreOpportunity(rwaData)
      );

      // Clear cache midway
      setTimeout(() => {
        (scoringSystem as any).scoreCache.clear();
      }, 10);

      const scores = await Promise.all(scoringPromises);
      
      // All should complete successfully
      expect(scores).toHaveLength(10);
      scores.forEach(score => {
        expect(score.rwaId).toBe(rwaData.id);
      });
    });
  });

  describe('Memory and Performance Stress Tests', () => {
    test('should handle large batch processing without memory leaks', async () => {
      await scoringSystem.initialize();

      const batchSize = 100;
      const batches = 5;

      for (let batch = 0; batch < batches; batch++) {
        const rwaList = Array.from({ length: batchSize }, (_, i) => 
          createExtremeRWAData({
            id: `batch-${batch}-item-${i}`,
            yield: Math.random() * 0.2,
            value: Math.random() * 10000000
          })
        );

        // Process batch
        const scores = await Promise.all(
          rwaList.map(rwa => scoringSystem.scoreOpportunity(rwa))
        );

        expect(scores).toHaveLength(batchSize);

        // Clear cache between batches to prevent memory buildup
        if (batch < batches - 1) {
          (scoringSystem as any).scoreCache.clear();
        }
      }

      // Check final cache size is reasonable
      const status = scoringSystem.getStatus();
      expect(status.cacheSize).toBeLessThanOrEqual(batchSize);
    });

    test('should maintain performance with extreme cache sizes', async () => {
      const largeCacheConfig: RWAScoringConfig = {
        ...DEFAULT_RWA_SCORING_CONFIG,
        cacheTTL: 3600000, // 1 hour
        cacheResults: true
      };

      const largeCacheSystem = RWAOpportunityScoringSystem.getInstance(largeCacheConfig);
      await largeCacheSystem.initialize();

      // Fill cache with many entries
      const cacheEntries = 1000;
      const startTime = Date.now();

      for (let i = 0; i < cacheEntries; i++) {
        const rwaData = createExtremeRWAData({
          id: `cache-test-${i}`,
          yield: 0.05 + (i * 0.00001)
        });
        await largeCacheSystem.scoreOpportunity(rwaData);
      }

      const fillTime = Date.now() - startTime;

      // Verify cache is full
      expect(largeCacheSystem.getStatus().cacheSize).toBe(cacheEntries);

      // Test retrieval performance
      const retrievalStart = Date.now();
      const cachedScore = await largeCacheSystem.scoreOpportunity(
        createExtremeRWAData({ id: 'cache-test-500' })
      );
      const retrievalTime = Date.now() - retrievalStart;

      // Cached retrieval should be very fast
      expect(retrievalTime).toBeLessThan(10);
      expect(cachedScore).toBeDefined();

      await largeCacheSystem.shutdown();
    });
  });

  describe('Configuration Edge Cases', () => {
    test('should handle invalid weight configurations', async () => {
      const invalidWeightConfigs = [
        {
          // Weights sum > 1
          multiFactorWeights: {
            yield: 0.5,
            risk: 0.5,
            liquidity: 0.5,
            regulatory: 0.5,
            collateral: 0.5,
            market: 0.5
          }
        },
        {
          // Negative weights
          multiFactorWeights: {
            yield: -0.25,
            risk: 0.5,
            liquidity: 0.25,
            regulatory: 0.25,
            collateral: 0.25,
            market: 0
          }
        },
        {
          // All zero weights
          multiFactorWeights: {
            yield: 0,
            risk: 0,
            liquidity: 0,
            regulatory: 0,
            collateral: 0,
            market: 0
          }
        }
      ];

      for (const invalidConfig of invalidWeightConfigs) {
        const config: RWAScoringConfig = {
          ...DEFAULT_RWA_SCORING_CONFIG,
          ...invalidConfig
        };

        (RWAOpportunityScoringSystem as any).instance = null;
        const system = RWAOpportunityScoringSystem.getInstance(config);
        await system.initialize();

        const rwaData = createExtremeRWAData();
        const score = await system.scoreOpportunity(rwaData);

        // Should still produce valid scores
        expect(score.overallScore).toBeGreaterThanOrEqual(0);
        expect(isFinite(score.overallScore)).toBe(true);

        await system.shutdown();
      }
    });

    test('should handle extreme update intervals', async () => {
      const extremeIntervals = [
        1,          // 1ms - extremely frequent
        0,          // 0ms - invalid
        -1000,      // Negative - invalid
        86400000    // 24 hours - very infrequent
      ];

      for (const interval of extremeIntervals) {
        const config: RWAScoringConfig = {
          ...DEFAULT_RWA_SCORING_CONFIG,
          updateInterval: interval
        };

        (RWAOpportunityScoringSystem as any).instance = null;
        const system = RWAOpportunityScoringSystem.getInstance(config);
        
        // Should initialize without crashing
        await expect(system.initialize()).resolves.not.toThrow();
        
        await system.shutdown();
      }
    });
  });

  describe('Event System Edge Cases', () => {
    beforeEach(async () => {
      await scoringSystem.initialize();
    });

    test('should handle event listener errors gracefully', async () => {
      const errorListener = jest.fn(() => {
        throw new Error('Listener error');
      });

      scoringSystem.on('scoring_completed', errorListener);

      const rwaData = createExtremeRWAData();
      
      // Should not throw despite listener error
      await expect(scoringSystem.scoreOpportunity(rwaData)).resolves.toBeDefined();
      
      expect(errorListener).toHaveBeenCalled();
    });

    test('should handle maximum event listeners', async () => {
      // Add many listeners
      const listeners = Array(100).fill(null).map(() => jest.fn());
      listeners.forEach(listener => {
        scoringSystem.on('scoring_completed', listener);
      });

      const rwaData = createExtremeRWAData();
      await scoringSystem.scoreOpportunity(rwaData);

      // All listeners should be called
      listeners.forEach(listener => {
        expect(listener).toHaveBeenCalled();
      });
    });
  });

  describe('Shutdown and Cleanup Edge Cases', () => {
    test('should handle multiple shutdown calls', async () => {
      await scoringSystem.initialize();
      
      // Call shutdown multiple times
      await expect(scoringSystem.shutdown()).resolves.not.toThrow();
      await expect(scoringSystem.shutdown()).resolves.not.toThrow();
      await expect(scoringSystem.shutdown()).resolves.not.toThrow();
      
      // System should be in clean state
      const status = scoringSystem.getStatus();
      expect(status.isRunning).toBe(false);
      expect(status.cacheSize).toBe(0);
    });

    test('should handle scoring after shutdown', async () => {
      await scoringSystem.initialize();
      await scoringSystem.shutdown();

      const rwaData = createExtremeRWAData();
      
      // Should either throw or handle gracefully
      try {
        await scoringSystem.scoreOpportunity(rwaData);
        // If it doesn't throw, it should reinitialize
        expect(scoringSystem.getStatus().isRunning).toBe(true);
      } catch (error) {
        // Error is acceptable after shutdown
        expect(error).toBeInstanceOf(Error);
      }
    });
  });
});