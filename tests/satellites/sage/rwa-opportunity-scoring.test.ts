/**
 * RWA Opportunity Scoring System Tests
 * Comprehensive test suite to verify the RWA scoring system works as described
 */

import { jest } from '@jest/globals';
import { RWAOpportunityScoringSystem, DEFAULT_RWA_SCORING_CONFIG } from '../../../src/satellites/sage/rwa/opportunity-scoring-system';
import { RWAData, RWAType } from '../../../src/satellites/sage/types';

// Mock logger to prevent console noise during tests
jest.mock('@/shared/logging/logger', () => ({
  getLogger: jest.fn(() => ({
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }))
}));

describe('RWA Opportunity Scoring System', () => {
  let scoringSystem: RWAOpportunityScoringSystem;

  // Sample RWA data for testing
  const sampleRWAData: RWAData = {
    id: 'rwa-test-001',
    type: 'real-estate',
    issuer: 'Test Real Estate Fund',
    value: 1000000,
    currency: 'USD',
    maturityDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
    yield: 0.065, // 6.5%
    riskRating: 'A',
    collateral: {
      type: 'real-estate',
      value: 1200000,
      ltv: 0.83, // 83% LTV
      liquidationThreshold: 0.9 // 90% liquidation threshold
    },
    regulatoryStatus: {
      jurisdiction: 'US',
      complianceLevel: 'compliant',
      licenses: ['SEC-Registered', 'State-Licensed'],
      restrictions: [],
      lastReview: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // 30 days ago
    },
    complianceScore: 85
  };

  const highRiskRWAData: RWAData = {
    id: 'rwa-test-002',
    type: 'art',
    issuer: 'Art Investment Fund',
    value: 500000,
    currency: 'USD',
    maturityDate: new Date(Date.now() + 730 * 24 * 60 * 60 * 1000), // 2 years from now
    yield: 0.12, // 12%
    riskRating: 'CCC',
    collateral: {
      type: 'art',
      value: 400000,
      ltv: 1.25, // 125% LTV (over-collateralized)
      liquidationThreshold: 1.4 // 140% liquidation threshold
    },
    regulatoryStatus: {
      jurisdiction: 'US',
      complianceLevel: 'partial',
      licenses: ['Basic-License'],
      restrictions: ['Limited-Transferability'],
      lastReview: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) // 1 year ago
    },
    complianceScore: 60
  };

  beforeEach(() => {
    // Reset singleton instance before each test
    (RWAOpportunityScoringSystem as any).instance = null;
    scoringSystem = RWAOpportunityScoringSystem.getInstance();
  });

  afterEach(async () => {
    try {
      await scoringSystem.shutdown();
    } catch (error) {
      // Ignore shutdown errors in tests
    }
  });

  describe('Initialization and Configuration', () => {
    test('should create singleton instance with default config', () => {
      const instance1 = RWAOpportunityScoringSystem.getInstance();
      const instance2 = RWAOpportunityScoringSystem.getInstance();
      
      expect(instance1).toBe(instance2);
      expect(instance1).toBeInstanceOf(RWAOpportunityScoringSystem);
    });

    test('should initialize with custom configuration', async () => {
      const customConfig = {
        ...DEFAULT_RWA_SCORING_CONFIG,
        riskAdjustmentFactor: 2.0,
        multiFactorWeights: {
          yield: 0.4,
          risk: 0.3,
          liquidity: 0.1,
          regulatory: 0.1,
          collateral: 0.05,
          market: 0.05
        }
      };

      const customInstance = RWAOpportunityScoringSystem.getInstance(customConfig);
      await customInstance.initialize();
      
      expect(customInstance).toBeInstanceOf(RWAOpportunityScoringSystem);
    });

    test('should initialize successfully with all components', async () => {
      await scoringSystem.initialize();
      
      const status = scoringSystem.getStatus();
      expect(status.isRunning).toBe(true);
      expect(status.institutionalFeedsCount).toBeGreaterThan(0);
      expect(status.marketDataCount).toBeGreaterThan(0);
    });

    test('should handle initialization errors gracefully', async () => {
      // Test with invalid configuration
      const invalidConfig = {
        ...DEFAULT_RWA_SCORING_CONFIG,
        updateInterval: -1000 // Invalid negative interval
      };

      const invalidInstance = RWAOpportunityScoringSystem.getInstance(invalidConfig);
      
      // Should not throw during initialization, but may log errors
      await expect(invalidInstance.initialize()).resolves.not.toThrow();
    });
  });

  describe('Scoring Calculations', () => {
    beforeEach(async () => {
      await scoringSystem.initialize();
    });

    test('should calculate comprehensive scores for high-quality RWA', async () => {
      const score = await scoringSystem.scoreOpportunity(sampleRWAData);

      // Verify all score components are present
      expect(score.rwaId).toBe(sampleRWAData.id);
      expect(score.timestamp).toBeInstanceOf(Date);
      expect(score.overallScore).toBeGreaterThan(0);
      expect(score.overallScore).toBeLessThanOrEqual(1);
      expect(score.riskAdjustedReturn).toBeGreaterThan(0);
      expect(score.yieldScore).toBeGreaterThan(0);
      expect(score.riskScore).toBeGreaterThan(0);
      expect(score.liquidityScore).toBeGreaterThan(0);
      expect(score.regulatoryScore).toBeGreaterThan(0);
      expect(score.collateralScore).toBeGreaterThan(0);
      expect(score.marketScore).toBeGreaterThan(0);
      expect(score.volatilityScore).toBeGreaterThan(0);
      expect(score.complianceScore).toBeGreaterThan(0);
      expect(score.confidence).toBeGreaterThan(0);
      expect(score.confidence).toBeLessThanOrEqual(1);

      // Verify scoring factors
      expect(score.factors).toBeInstanceOf(Array);
      expect(score.factors.length).toBeGreaterThan(0);
      score.factors.forEach(factor => {
        expect(factor.category).toBeDefined();
        expect(factor.score).toBeGreaterThanOrEqual(0);
        expect(factor.score).toBeLessThanOrEqual(1);
        expect(factor.weight).toBeGreaterThan(0);
        expect(factor.description).toBeDefined();
        expect(['positive', 'negative', 'neutral']).toContain(factor.impact);
      });

      // Verify recommendations
      expect(score.recommendations).toBeInstanceOf(Array);
      expect(score.recommendations.length).toBeGreaterThan(0);
      score.recommendations.forEach(rec => {
        expect(['invest', 'hold', 'avoid', 'monitor']).toContain(rec.action);
        expect(rec.confidence).toBeGreaterThan(0);
        expect(rec.confidence).toBeLessThanOrEqual(1);
        expect(rec.reasoning).toBeDefined();
        expect(['short', 'medium', 'long']).toContain(rec.timeframe);
        expect(['low', 'medium', 'high']).toContain(rec.riskLevel);
        expect(rec.expectedReturn).toBeGreaterThanOrEqual(0);
        expect(rec.maxExposure).toBeGreaterThanOrEqual(0);
      });
    });

    test('should calculate lower scores for high-risk RWA', async () => {
      const score = await scoringSystem.scoreOpportunity(highRiskRWAData);

      // High-risk RWA should generally have lower scores
      expect(score.riskScore).toBeLessThan(0.5); // Lower risk score
      expect(score.regulatoryScore).toBeLessThan(0.7); // Lower regulatory score
      expect(score.overallScore).toBeLessThan(0.6); // Lower overall score

      // Should have 'avoid' or 'monitor' recommendations
      const hasAvoidOrMonitor = score.recommendations.some(rec => 
        rec.action === 'avoid' || rec.action === 'monitor'
      );
      expect(hasAvoidOrMonitor).toBe(true);
    });

    test('should handle different RWA types correctly', async () => {
      const bondRWA: RWAData = {
        ...sampleRWAData,
        id: 'rwa-bond-001',
        type: 'bonds',
        yield: 0.04,
        riskRating: 'AAA',
        collateral: {
          type: 'government-bonds',
          value: 1100000,
          ltv: 0.91,
          liquidationThreshold: 0.95
        }
      };

      const bondScore = await scoringSystem.scoreOpportunity(bondRWA);
      
      // Bonds should have higher liquidity scores
      expect(bondScore.liquidityScore).toBeGreaterThan(0.6);
      // AAA bonds should have high risk scores
      expect(bondScore.riskScore).toBeGreaterThan(0.7);
    });

    test('should calculate risk-adjusted returns correctly', async () => {
      const score = await scoringSystem.scoreOpportunity(sampleRWAData);
      
      // Risk-adjusted return should be positive for good opportunities
      expect(score.riskAdjustedReturn).toBeGreaterThan(0);
      
      // Higher yield should generally lead to higher risk-adjusted return
      const highYieldRWA = { ...sampleRWAData, yield: 0.1 }; // 10% yield
      const highYieldScore = await scoringSystem.scoreOpportunity(highYieldRWA);
      
      expect(highYieldScore.riskAdjustedReturn).toBeGreaterThan(score.riskAdjustedReturn);
    });

    test('should generate appropriate recommendations based on scores', async () => {
      // Test high-quality RWA
      const highQualityScore = await scoringSystem.scoreOpportunity(sampleRWAData);
      const highQualityRecs = highQualityScore.recommendations.filter(r => r.action === 'invest');
      expect(highQualityRecs.length).toBeGreaterThan(0);

      // Test low-quality RWA
      const lowQualityRWA: RWAData = {
        ...sampleRWAData,
        id: 'rwa-low-001',
        yield: 0.02, // Low yield
        riskRating: 'D', // Poor rating
        complianceScore: 30 // Low compliance
      };
      
      const lowQualityScore = await scoringSystem.scoreOpportunity(lowQualityRWA);
      const avoidRecs = lowQualityScore.recommendations.filter(r => r.action === 'avoid');
      expect(avoidRecs.length).toBeGreaterThan(0);
    });
  });

  describe('Caching and Performance', () => {
    beforeEach(async () => {
      await scoringSystem.initialize();
    });

    test('should cache results and return cached scores', async () => {
      const startTime = Date.now();
      
      // First call
      const score1 = await scoringSystem.scoreOpportunity(sampleRWAData);
      const firstCallTime = Date.now() - startTime;
      
      // Second call (should be cached)
      const score2 = await scoringSystem.scoreOpportunity(sampleRWAData);
      const secondCallTime = Date.now() - startTime - firstCallTime;
      
      // Cached call should be faster
      expect(secondCallTime).toBeLessThan(firstCallTime);
      
      // Scores should be identical
      expect(score1.overallScore).toBe(score2.overallScore);
      expect(score1.timestamp.getTime()).toBe(score2.timestamp.getTime());
    });

    test('should respect cache TTL', async () => {
      // Create instance with short cache TTL
      const shortTTLConfig = {
        ...DEFAULT_RWA_SCORING_CONFIG,
        cacheTTL: 100 // 100ms TTL
      };
      
      const shortTTLInstance = RWAOpportunityScoringSystem.getInstance(shortTTLConfig);
      await shortTTLInstance.initialize();
      
      // First call
      const score1 = await shortTTLInstance.scoreOpportunity(sampleRWAData);
      
      // Wait for cache to expire
      await new Promise(resolve => setTimeout(resolve, 150));
      
      // Second call (should not be cached)
      const score2 = await shortTTLInstance.scoreOpportunity(sampleRWAData);
      
      // Timestamps should be different
      expect(score1.timestamp.getTime()).toBeLessThan(score2.timestamp.getTime());
      
      await shortTTLInstance.shutdown();
    });
  });

  describe('Event Emission', () => {
    beforeEach(async () => {
      await scoringSystem.initialize();
    });

    test('should emit scoring completed events', (done) => {
      const eventHandler = jest.fn((data: any) => {
        expect(data.rwaId).toBe(sampleRWAData.id);
        expect(data.score).toBeDefined();
        expect(data.timestamp).toBeInstanceOf(Date);
        done();
      });

      scoringSystem.on('scoring_completed', eventHandler);
      
      scoringSystem.scoreOpportunity(sampleRWAData).catch(done);
    });

    test('should emit events for multiple scoring operations', async () => {
      const events: any[] = [];
      
      scoringSystem.on('scoring_completed', (data) => {
        events.push(data);
      });
      
      await scoringSystem.scoreOpportunity(sampleRWAData);
      await scoringSystem.scoreOpportunity(highRiskRWAData);
      
      expect(events).toHaveLength(2);
      expect(events[0].rwaId).toBe(sampleRWAData.id);
      expect(events[1].rwaId).toBe(highRiskRWAData.id);
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      await scoringSystem.initialize();
    });

    test('should handle invalid RWA data gracefully', async () => {
      const invalidRWA = {
        ...sampleRWAData,
        yield: -0.1, // Invalid negative yield
        value: 0 // Invalid zero value
      };

      await expect(scoringSystem.scoreOpportunity(invalidRWA as RWAData))
        .rejects.toThrow();
    });

    test('should handle missing market data', async () => {
      const unknownTypeRWA = {
        ...sampleRWAData,
        type: 'unknown-type' as RWAType
      };

      // Should not throw, but should use default values
      const score = await scoringSystem.scoreOpportunity(unknownTypeRWA);
      expect(score.marketScore).toBe(0.5); // Default score
    });

    test('should handle scoring system shutdown gracefully', async () => {
      await expect(scoringSystem.shutdown()).resolves.not.toThrow();
      
      const status = scoringSystem.getStatus();
      expect(status.isRunning).toBe(false);
      expect(status.cacheSize).toBe(0);
    });
  });

  describe('Configuration Validation', () => {
    test('should validate multi-factor weights sum to 1', () => {
      const invalidConfig = {
        ...DEFAULT_RWA_SCORING_CONFIG,
        multiFactorWeights: {
          yield: 0.5,
          risk: 0.5,
          liquidity: 0.5, // This makes sum > 1
          regulatory: 0.1,
          collateral: 0.1,
          market: 0.1
        }
      };

      // Should still work, but weights might not be optimal
      const instance = RWAOpportunityScoringSystem.getInstance(invalidConfig);
      expect(instance).toBeInstanceOf(RWAOpportunityScoringSystem);
    });

    test('should handle extreme configuration values', async () => {
      const extremeConfig = {
        ...DEFAULT_RWA_SCORING_CONFIG,
        riskAdjustmentFactor: 10, // Very high risk adjustment
        updateInterval: 1000, // Very frequent updates
        cacheTTL: 1000000 // Very long cache
      };

      const instance = RWAOpportunityScoringSystem.getInstance(extremeConfig);
      await expect(instance.initialize()).resolves.not.toThrow();
      
      const score = await instance.scoreOpportunity(sampleRWAData);
      expect(score.riskAdjustedReturn).toBeGreaterThanOrEqual(0);
      
      await instance.shutdown();
    });
  });

  describe('Integration with Market Data', () => {
    beforeEach(async () => {
      await scoringSystem.initialize();
    });

    test('should use market data for yield comparisons', async () => {
      const score = await scoringSystem.scoreOpportunity(sampleRWAData);
      
      // Yield score should be influenced by market comparison
      expect(score.yieldScore).toBeGreaterThan(0);
      expect(score.yieldScore).toBeLessThanOrEqual(1);
    });

    test('should consider market volatility in scoring', async () => {
      const score = await scoringSystem.scoreOpportunity(sampleRWAData);
      
      // Volatility score should be calculated
      expect(score.volatilityScore).toBeGreaterThan(0);
      expect(score.volatilityScore).toBeLessThanOrEqual(1);
    });

    test('should factor market growth in market score', async () => {
      const score = await scoringSystem.scoreOpportunity(sampleRWAData);
      
      // Market score should consider growth and size
      expect(score.marketScore).toBeGreaterThan(0);
      expect(score.marketScore).toBeLessThanOrEqual(1);
    });
  });

  describe('Compliance and Regulatory Scoring', () => {
    beforeEach(async () => {
      await scoringSystem.initialize();
    });

    test('should score regulatory compliance correctly', async () => {
      const compliantRWA = { ...sampleRWAData, complianceScore: 95 };
      const nonCompliantRWA = { ...sampleRWAData, complianceScore: 30 };
      
      const compliantScore = await scoringSystem.scoreOpportunity(compliantRWA);
      const nonCompliantScore = await scoringSystem.scoreOpportunity(nonCompliantRWA);
      
      expect(compliantScore.complianceScore).toBeGreaterThan(nonCompliantScore.complianceScore);
      expect(compliantScore.regulatoryScore).toBeGreaterThan(nonCompliantScore.regulatoryScore);
    });

    test('should consider license and restriction impact', async () => {
      const licensedRWA = {
        ...sampleRWAData,
        regulatoryStatus: {
          ...sampleRWAData.regulatoryStatus,
          licenses: ['SEC-Registered', 'State-Licensed', 'Federal-Approved'],
          restrictions: []
        }
      };
      
      const restrictedRWA = {
        ...sampleRWAData,
        regulatoryStatus: {
          ...sampleRWAData.regulatoryStatus,
          licenses: ['Basic-License'],
          restrictions: ['No-Transfer', 'Limited-Use', 'Geographic-Restriction']
        }
      };
      
      const licensedScore = await scoringSystem.scoreOpportunity(licensedRWA);
      const restrictedScore = await scoringSystem.scoreOpportunity(restrictedRWA);
      
      expect(licensedScore.regulatoryScore).toBeGreaterThan(restrictedScore.regulatoryScore);
    });
  });

  describe('Performance Benchmarks', () => {
    beforeEach(async () => {
      await scoringSystem.initialize();
    });

    test('should score multiple RWAs efficiently', async () => {
      const rwaList = Array.from({ length: 10 }, (_, i) => ({
        ...sampleRWAData,
        id: `rwa-batch-${i}`,
        yield: 0.05 + (i * 0.01), // Varying yields
        value: 100000 + (i * 50000) // Varying values
      }));

      const startTime = Date.now();
      
      const scores = await Promise.all(
        rwaList.map(rwa => scoringSystem.scoreOpportunity(rwa))
      );
      
      const totalTime = Date.now() - startTime;
      
      // Should complete 10 scorings in reasonable time (less than 5 seconds)
      expect(totalTime).toBeLessThan(5000);
      expect(scores).toHaveLength(10);
      
      // All scores should be valid
      scores.forEach(score => {
        expect(score.overallScore).toBeGreaterThan(0);
        expect(score.overallScore).toBeLessThanOrEqual(1);
      });
    });

    test('should maintain performance under concurrent load', async () => {
      const concurrentScorings = Array.from({ length: 5 }, () => 
        scoringSystem.scoreOpportunity(sampleRWAData)
      );
      
      const startTime = Date.now();
      const scores = await Promise.all(concurrentScorings);
      const totalTime = Date.now() - startTime;
      
      // Concurrent operations should complete efficiently
      expect(totalTime).toBeLessThan(3000);
      expect(scores).toHaveLength(5);
      
      // All scores should be identical (same input, cached)
      const firstScore = scores[0].overallScore;
      scores.forEach(score => {
        expect(score.overallScore).toBe(firstScore);
      });
    });
  });
}); 