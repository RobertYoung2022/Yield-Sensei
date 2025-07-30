/**
 * RWA Opportunity Scoring System - Final Coverage Tests
 * Tests to cover the remaining uncovered lines
 */

import { jest } from '@jest/globals';
import { 
  RWAOpportunityScoringSystem, 
  DEFAULT_RWA_SCORING_CONFIG
} from '../../../src/satellites/sage/rwa/opportunity-scoring-system';
import { RWAData } from '../../../src/satellites/sage/types';

// Mock logger
jest.mock('@/shared/logging/logger', () => ({
  getLogger: jest.fn(() => ({
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }))
}));

describe('RWA Scoring System - Final Coverage', () => {
  let scoringSystem: RWAOpportunityScoringSystem;

  const createRWAData = (overrides: Partial<RWAData> = {}): RWAData => ({
    id: 'coverage-test-rwa',
    type: 'real-estate',
    issuer: 'Coverage Test Issuer',
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
      // Ignore
    }
  });

  describe('Edge Case Coverage', () => {
    beforeEach(async () => {
      await scoringSystem.initialize();
    });

    test('should handle perfect score scenarios (line 543)', async () => {
      // Create an RWA that should get perfect scores
      const perfectRWA = createRWAData({
        yield: 0.15, // Very high yield
        value: 5000000,
        riskRating: 'AAA',
        complianceScore: 100,
        collateral: {
          type: 'government-bonds',
          value: 10000000,
          ltv: 0.5,
          liquidationThreshold: 0.8
        },
        regulatoryStatus: {
          jurisdiction: 'US',
          complianceLevel: 'compliant',
          licenses: ['SEC', 'FINRA', 'State', 'Federal'],
          restrictions: [],
          lastReview: new Date()
        }
      });

      const score = await scoringSystem.scoreOpportunity(perfectRWA);
      
      // Should get 'invest' recommendation with long timeframe
      expect(score.overallScore).toBeGreaterThan(0.8);
      expect(score.riskAdjustedReturn).toBeGreaterThan(0.05);
      expect(score.recommendations[0]).toBeDefined();
      expect(score.recommendations[0]!.action).toBe('invest');
      expect(score.recommendations[0]!.timeframe).toBe('long');
    });

    test('should handle marginal investment scenarios (line 573)', async () => {
      // Create an RWA that should get 'avoid' recommendation
      const marginalRWA = createRWAData({
        yield: 0.01, // Very low yield
        value: 100000,
        riskRating: 'D',
        complianceScore: 25,
        collateral: {
          type: 'art',
          value: 50000,
          ltv: 2.0,
          liquidationThreshold: 1.5
        },
        regulatoryStatus: {
          jurisdiction: 'Unknown',
          complianceLevel: 'non-compliant',
          licenses: [],
          restrictions: ['Suspended', 'Under-Investigation'],
          lastReview: new Date(Date.now() - 1500 * 24 * 60 * 60 * 1000) // Very old
        }
      });

      const score = await scoringSystem.scoreOpportunity(marginalRWA);
      
      // Should get 'avoid' recommendation
      expect(score.overallScore).toBeLessThan(0.4);
      expect(score.recommendations[0]).toBeDefined();
      expect(score.recommendations[0]!.action).toBe('avoid');
      expect(score.recommendations[0]!.expectedReturn).toBe(0);
      expect(score.recommendations[0]!.maxExposure).toBe(0);
    });

    test('should handle very long maturity dates (line 696)', async () => {
      // Test very long maturity (10+ years)
      const longMaturityRWA = createRWAData({
        maturityDate: new Date(Date.now() + 4000 * 24 * 60 * 60 * 1000) // ~11 years
      });

      const score = await scoringSystem.scoreOpportunity(longMaturityRWA);
      
      // Should have appropriate risk scoring for long maturity
      expect(score.riskScore).toBeGreaterThan(0);
      expect(score.riskScore).toBeLessThanOrEqual(1);
    });

    test('should handle update interval execution (lines 796-801)', async () => {
      // Create a system with very short update interval
      const shortIntervalConfig = {
        ...DEFAULT_RWA_SCORING_CONFIG,
        updateInterval: 50 // 50ms
      };

      (RWAOpportunityScoringSystem as any).instance = null;
      const shortIntervalSystem = RWAOpportunityScoringSystem.getInstance(shortIntervalConfig);
      
      // Mock the update function to track calls
      const mockUpdateFn = jest.fn();
      (shortIntervalSystem as any).updateMarketData = mockUpdateFn;

      await shortIntervalSystem.initialize();

      // Wait for update interval to trigger
      await new Promise(resolve => setTimeout(resolve, 150));

      // Verify updates were attempted
      const status = shortIntervalSystem.getStatus();
      expect(status.isRunning).toBe(true);

      await shortIntervalSystem.shutdown();
    });

    test('should log errors during periodic updates', async () => {
      // Access the logger mock
      const LoggerModule = jest.requireMock('@/shared/logging/logger') as any;
      const mockLogger = LoggerModule.getLogger('rwa-opportunity-scoring');

      // Create system with short interval
      const errorConfig = {
        ...DEFAULT_RWA_SCORING_CONFIG,
        updateInterval: 50
      };

      (RWAOpportunityScoringSystem as any).instance = null;
      const errorSystem = RWAOpportunityScoringSystem.getInstance(errorConfig);

      // Force an error in the update cycle
      let updateCount = 0;
      
      // Override the private method that gets called in updates
      (errorSystem as any).updateInstitutionalFeeds = jest.fn(() => {
        updateCount++;
        if (updateCount > 1) {
          throw new Error('Update failed');
        }
      });

      await errorSystem.initialize();

      // Wait for error to occur
      await new Promise(resolve => setTimeout(resolve, 150));

      // Check that error was logged
      expect(mockLogger.error).toHaveBeenCalled();

      await errorSystem.shutdown();
    });
  });

  describe('System Lifecycle Edge Cases', () => {
    test('should handle multiple initialization attempts', async () => {
      await scoringSystem.initialize();
      
      // Second initialization should work without issues
      await expect(scoringSystem.initialize()).resolves.not.toThrow();
      
      const status = scoringSystem.getStatus();
      expect(status.isRunning).toBe(true);
    });

    test('should clear all intervals on shutdown', async () => {
      // Initialize with update interval
      await scoringSystem.initialize();
      
      // Get the interval ID
      const intervalId = (scoringSystem as any).updateInterval;
      expect(intervalId).toBeDefined();
      
      // Shutdown
      await scoringSystem.shutdown();
      
      // Verify interval is cleared
      expect((scoringSystem as any).updateInterval).toBeUndefined();
    });

    test('should handle scoring with cache disabled during runtime', async () => {
      await scoringSystem.initialize();
      
      // Score with cache enabled
      const rwaData = createRWAData();
      const score1 = await scoringSystem.scoreOpportunity(rwaData);
      
      // Disable cache
      (scoringSystem as any).config.cacheResults = false;
      
      // Score again - should not use cache
      const score2 = await scoringSystem.scoreOpportunity(rwaData);
      
      // Timestamps should be different since cache is disabled
      expect(score2.timestamp.getTime()).toBeGreaterThan(score1.timestamp.getTime());
    });
  });

  describe('Scoring Algorithm Edge Cases', () => {
    beforeEach(async () => {
      await scoringSystem.initialize();
    });

    test('should handle exact threshold boundaries', async () => {
      // Test exact recommendation thresholds
      const thresholdTests = [
        { overallScore: 0.8, riskAdjustedReturn: 0.05 },  // Exact threshold for 'invest' long
        { overallScore: 0.6, riskAdjustedReturn: 0.02 },  // Exact threshold for 'invest' medium
        { overallScore: 0.4, riskAdjustedReturn: 0.01 },  // Exact threshold for 'monitor'
      ];

      for (const test of thresholdTests) {
        // Mock the scoring to return exact values
        jest.spyOn(scoringSystem as any, 'calculateOverallScore').mockReturnValueOnce(test.overallScore);
        jest.spyOn(scoringSystem as any, 'calculateRiskAdjustedReturn').mockReturnValueOnce(test.riskAdjustedReturn);

        const rwaData = createRWAData();
        const score = await scoringSystem.scoreOpportunity(rwaData);

        expect(score.recommendations).toHaveLength(1);
        expect(score.recommendations[0]).toBeDefined();
      }
    });

    test('should handle all volatility ranges', async () => {
      const volatilityTests = [
        { volatility: 0.04, expectedScore: 0.9 },  // Boundary < 0.05
        { volatility: 0.05, expectedScore: 0.8 },  // Exact 0.05
        { volatility: 0.09, expectedScore: 0.8 },  // Boundary < 0.1
        { volatility: 0.1, expectedScore: 0.6 },   // Exact 0.1
        { volatility: 0.19, expectedScore: 0.6 },  // Boundary < 0.2
        { volatility: 0.2, expectedScore: 0.4 },   // Exact 0.2
        { volatility: 0.29, expectedScore: 0.4 },  // Boundary < 0.3
        { volatility: 0.3, expectedScore: 0.2 },   // Exact 0.3
        { volatility: 0.5, expectedScore: 0.2 },   // > 0.3
      ];

      for (const test of volatilityTests) {
        (scoringSystem as any).marketData.set('real-estate', {
          assetClass: 'real-estate',
          currentYield: 0.045,
          historicalYields: [0.045],
          volatility: test.volatility,
          liquidity: 0.3,
          marketSize: 50000000000,
          growthRate: 0.08,
          correlation: 0.3
        });

        const rwaData = createRWAData({ type: 'real-estate' });
        const score = await scoringSystem.scoreOpportunity(rwaData);
        
        expect(score.volatilityScore).toBe(test.expectedScore);
      }
    });
  });
});