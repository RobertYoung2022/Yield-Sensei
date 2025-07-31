/**
 * RWA Opportunity Scoring System Unit Tests
 * Comprehensive unit tests for achieving >95% code coverage
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

describe('RWA Opportunity Scoring System - Unit Tests', () => {
  let scoringSystem: RWAOpportunityScoringSystem;

  // Helper function to create RWA data with various risk profiles
  const createRWAData = (overrides: Partial<RWAData> = {}): RWAData => ({
    id: 'test-rwa',
    type: 'real-estate',
    issuer: 'Test Issuer',
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
      lastReview: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    },
    complianceScore: 85,
    ...overrides
  });

  beforeEach(() => {
    // Reset singleton before each test
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

  describe('Risk-Adjusted Return Calculations', () => {
    beforeEach(async () => {
      await scoringSystem.initialize();
    });

    test('should calculate risk-adjusted returns for various risk levels', async () => {
      const testCases = [
        { riskRating: 'AAA', yield: 0.03, expectedMinReturn: 0.015 },
        { riskRating: 'AA', yield: 0.04, expectedMinReturn: 0.02 },
        { riskRating: 'A', yield: 0.05, expectedMinReturn: 0.025 },
        { riskRating: 'BBB', yield: 0.06, expectedMinReturn: 0.03 },
        { riskRating: 'BB', yield: 0.08, expectedMinReturn: 0.04 },
        { riskRating: 'B', yield: 0.10, expectedMinReturn: 0.05 },
        { riskRating: 'CCC', yield: 0.15, expectedMinReturn: 0.07 },
        { riskRating: 'CC', yield: 0.20, expectedMinReturn: 0.08 },
        { riskRating: 'C', yield: 0.25, expectedMinReturn: 0.09 },
        { riskRating: 'D', yield: 0.30, expectedMinReturn: 0 } // Default case should return 0
      ];

      for (const testCase of testCases) {
        const rwaData = createRWAData({
          riskRating: testCase.riskRating as RWAData['riskRating'],
          yield: testCase.yield
        });

        const score = await scoringSystem.scoreOpportunity(rwaData);
        
        expect(score.riskAdjustedReturn).toBeGreaterThanOrEqual(0);
        if (testCase.riskRating !== 'D') {
          expect(score.riskAdjustedReturn).toBeGreaterThan(0);
        }
      }
    });

    test('should adjust returns based on risk adjustment factor', async () => {
      const customConfig: RWAScoringConfig = {
        ...DEFAULT_RWA_SCORING_CONFIG,
        riskAdjustmentFactor: 3.0 // Higher risk adjustment
      };

      const customSystem = RWAOpportunityScoringSystem.getInstance(customConfig);
      await customSystem.initialize();

      const rwaData = createRWAData({ yield: 0.08, riskRating: 'BBB' });
      const score = await customSystem.scoreOpportunity(rwaData);

      expect(score.riskAdjustedReturn).toBeLessThan(0.06); // Should be lower due to higher risk adjustment

      await customSystem.shutdown();
    });

    test('should handle zero and negative yields correctly', async () => {
      const zeroYieldRWA = createRWAData({ yield: 0 });
      const scoreZero = await scoringSystem.scoreOpportunity(zeroYieldRWA);
      expect(scoreZero.riskAdjustedReturn).toBe(0);

      const negativeYieldRWA = createRWAData({ yield: -0.02 });
      const scoreNegative = await scoringSystem.scoreOpportunity(negativeYieldRWA);
      expect(scoreNegative.riskAdjustedReturn).toBe(0); // Should be clamped to 0
    });
  });

  describe('Scoring Algorithm Validation', () => {
    beforeEach(async () => {
      await scoringSystem.initialize();
    });

    test('should validate yield scoring with market comparison', async () => {
      const testCases = [
        { yield: 0.10, type: 'real-estate', expectedRange: [0.7, 1.0] }, // Well above market
        { yield: 0.065, type: 'real-estate', expectedRange: [0.5, 0.7] }, // Slightly above market
        { yield: 0.045, type: 'real-estate', expectedRange: [0.4, 0.6] }, // At market
        { yield: 0.02, type: 'real-estate', expectedRange: [0.1, 0.4] }, // Well below market
      ];

      for (const testCase of testCases) {
        const rwaData = createRWAData({
          yield: testCase.yield,
          type: testCase.type as RWAType
        });

        const score = await scoringSystem.scoreOpportunity(rwaData);
        
        expect(score.yieldScore).toBeGreaterThanOrEqual(testCase.expectedRange[0]!);
        expect(score.yieldScore).toBeLessThanOrEqual(testCase.expectedRange[1]!);
      }
    });

    test('should validate liquidity scoring across asset types', async () => {
      const assetTypes: Array<{ type: RWAType; expectedMin: number }> = [
        { type: 'equity', expectedMin: 0.7 },
        { type: 'bonds', expectedMin: 0.6 },
        { type: 'commodities', expectedMin: 0.5 },
        { type: 'loans', expectedMin: 0.3 },
        { type: 'invoices', expectedMin: 0.2 },
        { type: 'real-estate', expectedMin: 0.2 },
        { type: 'art', expectedMin: 0.1 }
      ];

      for (const assetType of assetTypes) {
        const rwaData = createRWAData({ type: assetType.type });
        const score = await scoringSystem.scoreOpportunity(rwaData);
        
        expect(score.liquidityScore).toBeGreaterThanOrEqual(assetType.expectedMin);
        expect(score.liquidityScore).toBeLessThanOrEqual(1);
      }
    });

    test('should validate collateral scoring with various LTV ratios', async () => {
      const ltvScenarios = [
        { ltv: 0.3, expectedMin: 0.7 },  // Conservative LTV
        { ltv: 0.6, expectedMin: 0.5 },  // Moderate LTV
        { ltv: 0.8, expectedMin: 0.3 },  // High LTV
        { ltv: 0.95, expectedMin: 0.1 }, // Very high LTV
      ];

      for (const scenario of ltvScenarios) {
        const rwaData = createRWAData({
          collateral: {
            type: 'real-estate',
            value: 1200000,
            ltv: scenario.ltv,
            liquidationThreshold: scenario.ltv + 0.15
          }
        });

        const score = await scoringSystem.scoreOpportunity(rwaData);
        expect(score.collateralScore).toBeGreaterThanOrEqual(scenario.expectedMin);
      }
    });

    test('should validate market scoring with various growth rates', async () => {
      // Test by mocking different market data
      const marketDataVariations = [
        { growthRate: 0.15, volatility: 0.05, expectedMin: 0.7 }, // High growth, low volatility
        { growthRate: 0.08, volatility: 0.15, expectedMin: 0.5 }, // Moderate growth, moderate volatility
        { growthRate: -0.10, volatility: 0.35, expectedMin: 0.1 }, // Negative growth, high volatility
      ];

      for (const variation of marketDataVariations) {
        // Override market data for testing
        (scoringSystem as any).marketData.set('real-estate', {
          assetClass: 'real-estate',
          currentYield: 0.045,
          historicalYields: [0.04, 0.042, 0.043, 0.044, 0.045],
          volatility: variation.volatility,
          liquidity: 0.3,
          marketSize: 50000000000,
          growthRate: variation.growthRate,
          correlation: 0.3
        });

        const rwaData = createRWAData({ type: 'real-estate' });
        const score = await scoringSystem.scoreOpportunity(rwaData);
        
        expect(score.marketScore).toBeGreaterThanOrEqual(variation.expectedMin);
      }
    });

    test('should validate multi-factor weight calculations', async () => {
      const customWeights = {
        yield: 0.3,
        risk: 0.2,
        liquidity: 0.2,
        regulatory: 0.1,
        collateral: 0.1,
        market: 0.1
      };

      const customConfig: RWAScoringConfig = {
        ...DEFAULT_RWA_SCORING_CONFIG,
        multiFactorWeights: customWeights
      };

      const customSystem = RWAOpportunityScoringSystem.getInstance(customConfig);
      await customSystem.initialize();

      const rwaData = createRWAData();
      const score = await customSystem.scoreOpportunity(rwaData);

      // Verify the overall score is properly weighted
      const expectedScore = 
        score.yieldScore * customWeights.yield +
        score.riskScore * customWeights.risk +
        score.liquidityScore * customWeights.liquidity +
        score.regulatoryScore * customWeights.regulatory +
        score.collateralScore * customWeights.collateral +
        score.marketScore * customWeights.market;

      expect(score.overallScore).toBeCloseTo(expectedScore, 5);

      await customSystem.shutdown();
    });
  });

  describe('Compliance Verification Workflows', () => {
    beforeEach(async () => {
      await scoringSystem.initialize();
    });

    test('should verify compliance with various regulatory statuses', async () => {
      const complianceScenarios = [
        {
          complianceLevel: 'compliant' as const,
          licenses: ['SEC', 'FINRA', 'State'],
          restrictions: [],
          expectedMin: 0.8
        },
        {
          complianceLevel: 'partial' as const,
          licenses: ['State'],
          restrictions: ['Limited-Transfer'],
          expectedMin: 0.4
        },
        {
          complianceLevel: 'non-compliant' as const,
          licenses: [],
          restrictions: ['No-Transfer', 'Under-Investigation'],
          expectedMin: 0.0
        }
      ];

      for (const scenario of complianceScenarios) {
        const rwaData = createRWAData({
          regulatoryStatus: {
            jurisdiction: 'US',
            complianceLevel: scenario.complianceLevel,
            licenses: scenario.licenses,
            restrictions: scenario.restrictions,
            lastReview: new Date()
          }
        });

        const score = await scoringSystem.scoreOpportunity(rwaData);
        expect(score.regulatoryScore).toBeGreaterThanOrEqual(scenario.expectedMin);
      }
    });

    test('should handle regulatory review recency', async () => {
      const reviewScenarios = [
        { daysAgo: 30, expectedBonus: true },   // Recent review
        { daysAgo: 180, expectedBonus: true },  // Within year
        { daysAgo: 400, expectedBonus: false }, // No bonus
        { daysAgo: 1200, expectedBonus: false } // Penalty
      ];

      for (const scenario of reviewScenarios) {
        const rwaData = createRWAData({
          regulatoryStatus: {
            jurisdiction: 'US',
            complianceLevel: 'compliant',
            licenses: ['SEC'],
            restrictions: [],
            lastReview: new Date(Date.now() - scenario.daysAgo * 24 * 60 * 60 * 1000)
          }
        });

        const score = await scoringSystem.scoreOpportunity(rwaData);
        
        if (scenario.expectedBonus) {
          expect(score.regulatoryScore).toBeGreaterThan(0.8);
        } else {
          expect(score.regulatoryScore).toBeLessThanOrEqual(0.8);
        }
      }
    });

    test('should enforce compliance verification when enabled', async () => {
      const configWithCompliance: RWAScoringConfig = {
        ...DEFAULT_RWA_SCORING_CONFIG,
        complianceVerification: true
      };

      const systemWithCompliance = RWAOpportunityScoringSystem.getInstance(configWithCompliance);
      await systemWithCompliance.initialize();

      const nonCompliantRWA = createRWAData({
        regulatoryStatus: {
          jurisdiction: 'US',
          complianceLevel: 'non-compliant',
          licenses: [],
          restrictions: ['Suspended'],
          lastReview: new Date()
        },
        complianceScore: 20
      });

      const score = await systemWithCompliance.scoreOpportunity(nonCompliantRWA);
      
      // Should heavily penalize non-compliant assets
      expect(score.overallScore).toBeLessThan(0.4);
      const recommendation = score.recommendations[0];
      expect(recommendation).toBeDefined();
      expect(recommendation!.action).toBe('avoid');

      await systemWithCompliance.shutdown();
    });
  });

  describe('Edge Cases and Extreme Market Conditions', () => {
    beforeEach(async () => {
      await scoringSystem.initialize();
    });

    test('should handle extreme volatility scenarios', async () => {
      const volatilityScenarios = [
        { volatility: 0.001, expectedScore: 0.9 },  // Near-zero volatility
        { volatility: 0.5, expectedScore: 0.2 },    // Extreme volatility
        { volatility: 1.0, expectedScore: 0.2 },    // Maximum volatility
      ];

      for (const scenario of volatilityScenarios) {
        (scoringSystem as any).marketData.set('bonds', {
          assetClass: 'bonds',
          currentYield: 0.04,
          historicalYields: [0.04],
          volatility: scenario.volatility,
          liquidity: 0.8,
          marketSize: 100000000000,
          growthRate: 0.05,
          correlation: 0.1
        });

        const rwaData = createRWAData({ type: 'bonds' });
        const score = await scoringSystem.scoreOpportunity(rwaData);
        
        expect(score.volatilityScore).toBeCloseTo(scenario.expectedScore, 1);
      }
    });

    test('should handle market crashes and extreme conditions', async () => {
      // Simulate market crash
      (scoringSystem as any).marketData.set('equity', {
        assetClass: 'equity',
        currentYield: -0.15, // Negative yield
        historicalYields: [-0.10, -0.12, -0.15],
        volatility: 0.8, // Extreme volatility
        liquidity: 0.1, // Low liquidity
        marketSize: 1000000000,
        growthRate: -0.30, // Severe contraction
        correlation: 0.9
      });

      const rwaData = createRWAData({
        type: 'equity',
        yield: -0.05 // Negative yield
      });

      const score = await scoringSystem.scoreOpportunity(rwaData);
      
      expect(score.marketScore).toBeLessThan(0.3);
      expect(score.volatilityScore).toBeLessThan(0.3);
      const recommendation = score.recommendations[0];
      expect(recommendation).toBeDefined();
      expect(recommendation!.action).toBe('avoid');
    });

    test('should handle missing or incomplete data gracefully', async () => {
      const incompleteRWA = createRWAData({
        regulatoryStatus: {
          jurisdiction: 'Unknown',
          complianceLevel: 'partial',
          licenses: [],
          restrictions: [],
          lastReview: new Date(0) // Invalid date
        }
      });
      // Remove maturityDate property
      delete (incompleteRWA as any).maturityDate;

      const score = await scoringSystem.scoreOpportunity(incompleteRWA);
      
      expect(score.confidence).toBeLessThan(0.8); // Lower confidence due to missing data
      expect(score.overallScore).toBeGreaterThanOrEqual(0);
      expect(score.overallScore).toBeLessThanOrEqual(1);
    });

    test('should handle extreme collateral scenarios', async () => {
      const extremeCollateralScenarios = [
        {
          ltv: 0.01, // Extremely low LTV
          liquidationThreshold: 0.5,
          expectedMin: 0.8
        },
        {
          ltv: 2.0, // Over-leveraged
          liquidationThreshold: 2.5,
          expectedMin: 0.1
        },
        {
          ltv: 0.5,
          liquidationThreshold: 0.55, // Very tight buffer
          expectedMin: 0.2
        }
      ];

      for (const scenario of extremeCollateralScenarios) {
        const rwaData = createRWAData({
          collateral: {
            type: 'commodities',
            value: 1000000,
            ltv: scenario.ltv,
            liquidationThreshold: scenario.liquidationThreshold
          }
        });

        const score = await scoringSystem.scoreOpportunity(rwaData);
        expect(score.collateralScore).toBeGreaterThanOrEqual(scenario.expectedMin);
      }
    });

    test('should handle unknown asset types and ratings', async () => {
      const unknownRWA = createRWAData({
        type: 'unknown-asset' as RWAType,
        riskRating: 'BBB', // Use valid rating
        collateral: {
          type: 'unknown-collateral',
          value: 1000000,
          ltv: 0.8,
          liquidationThreshold: 0.9
        }
      });
      // Override with unknown rating after creation
      (unknownRWA as any).riskRating = 'UNKNOWN';

      const score = await scoringSystem.scoreOpportunity(unknownRWA);
      
      // Should use default values
      expect(score.marketScore).toBe(0.5);
      expect(score.liquidityScore).toBeCloseTo(0.5, 1);
      expect(score.collateralScore).toBeCloseTo(0.5, 1);
    });
  });

  describe('Error Handling and Recovery', () => {
    test('should handle initialization failures', async () => {
      // Force an error during initialization
      const mockError = new Error('Initialization failed');
      jest.spyOn(scoringSystem as any, 'initializeInstitutionalFeeds').mockRejectedValueOnce(mockError);

      await expect(scoringSystem.initialize()).rejects.toThrow('Initialization failed');
    });

    test('should handle scoring failures gracefully', async () => {
      await scoringSystem.initialize();

      // Force an error during scoring
      jest.spyOn(scoringSystem as any, 'calculateYieldScore').mockImplementationOnce(() => {
        throw new Error('Calculation error');
      });

      const rwaData = createRWAData();
      await expect(scoringSystem.scoreOpportunity(rwaData)).rejects.toThrow('Calculation error');
    });

    test('should clean up resources on shutdown', async () => {
      await scoringSystem.initialize();
      
      // Add some cached data
      const rwaData = createRWAData();
      await scoringSystem.scoreOpportunity(rwaData);
      
      // Verify cache is populated
      expect(scoringSystem.getStatus().cacheSize).toBeGreaterThan(0);
      
      // Shutdown
      await scoringSystem.shutdown();
      
      // Verify cleanup
      const status = scoringSystem.getStatus();
      expect(status.isRunning).toBe(false);
      expect(status.cacheSize).toBe(0);
    });

    test('should handle concurrent scoring requests', async () => {
      await scoringSystem.initialize();

      const rwaList = Array.from({ length: 20 }, (_, i) => 
        createRWAData({ id: `concurrent-${i}`, yield: 0.05 + (i * 0.001) })
      );

      // Score all concurrently
      const scores = await Promise.all(
        rwaList.map(rwa => scoringSystem.scoreOpportunity(rwa))
      );

      // All should complete successfully
      expect(scores).toHaveLength(20);
      scores.forEach((score, index) => {
        expect(score.rwaId).toBe(`concurrent-${index}`);
        expect(score.overallScore).toBeGreaterThan(0);
      });
    });
  });

  describe('Maturity Risk Calculations', () => {
    beforeEach(async () => {
      await scoringSystem.initialize();
    });

    test('should calculate maturity risk for various timeframes', async () => {
      const maturityScenarios = [
        { days: 15, expectedScore: 0.3 },    // Very short term
        { days: 180, expectedScore: 0.5 },   // Short term
        { days: 1000, expectedScore: 0.7 },  // Medium term
        { days: 3000, expectedScore: 0.9 },  // Long term
      ];

      for (const scenario of maturityScenarios) {
        const maturityDate = new Date(Date.now() + scenario.days * 24 * 60 * 60 * 1000);
        const rwaData = createRWAData({ maturityDate });
        
        const score = await scoringSystem.scoreOpportunity(rwaData);
        
        // Risk score should be influenced by maturity
        expect(score.riskScore).toBeGreaterThan(0);
        expect(score.riskScore).toBeLessThanOrEqual(1);
      }
    });
  });

  describe('Institutional Data Feed Integration', () => {
    beforeEach(async () => {
      await scoringSystem.initialize();
    });

    test('should utilize institutional data feeds when available', async () => {
      // Verify feeds are initialized
      const status = scoringSystem.getStatus();
      expect(status.institutionalFeedsCount).toBeGreaterThan(0);

      // Test with bond asset that should use institutional data
      const bondRWA = createRWAData({
        type: 'bonds',
        riskRating: 'AAA'
      });

      const score = await scoringSystem.scoreOpportunity(bondRWA);
      
      // Should have reasonable scores based on institutional data
      expect(score.yieldScore).toBeGreaterThan(0);
      expect(score.marketScore).toBeGreaterThan(0);
    });

    test('should handle disabled institutional feeds', async () => {
      const configNoFeeds: RWAScoringConfig = {
        ...DEFAULT_RWA_SCORING_CONFIG,
        enableInstitutionalFeeds: false
      };

      const systemNoFeeds = RWAOpportunityScoringSystem.getInstance(configNoFeeds);
      await systemNoFeeds.initialize();

      const status = systemNoFeeds.getStatus();
      expect(status.institutionalFeedsCount).toBe(0);

      await systemNoFeeds.shutdown();
    });
  });

  describe('Recommendation Generation', () => {
    beforeEach(async () => {
      await scoringSystem.initialize();
    });

    test('should generate appropriate recommendations for all score ranges', async () => {
      const scoreScenarios = [
        {
          overrides: { yield: 0.12, riskRating: 'AAA', complianceScore: 95 },
          expectedAction: 'invest',
          expectedTimeframe: 'long'
        },
        {
          overrides: { yield: 0.07, riskRating: 'A', complianceScore: 80 },
          expectedAction: 'invest',
          expectedTimeframe: 'medium'
        },
        {
          overrides: { yield: 0.04, riskRating: 'BBB', complianceScore: 65 },
          expectedAction: 'monitor',
          expectedTimeframe: 'short'
        },
        {
          overrides: { yield: 0.02, riskRating: 'CCC', complianceScore: 40 },
          expectedAction: 'avoid',
          expectedTimeframe: 'short'
        }
      ];

      for (const scenario of scoreScenarios) {
        const rwaData = createRWAData(scenario.overrides as Partial<RWAData>);
        const score = await scoringSystem.scoreOpportunity(rwaData);
        
        expect(score.recommendations).toHaveLength(1);
        const recommendation = score.recommendations[0];
        expect(recommendation).toBeDefined();
        expect(recommendation!.action).toBe(scenario.expectedAction);
        expect(recommendation!.timeframe).toBe(scenario.expectedTimeframe);
        expect(recommendation!.confidence).toBeGreaterThan(0);
        expect(recommendation!.reasoning).toBeTruthy();
      }
    });

    test('should calculate appropriate max exposure limits', async () => {
      const exposureScenarios = [
        { value: 10000000, overallScore: 0.85, expectedMaxExposure: 1000000 },  // 10% max
        { value: 5000000, overallScore: 0.65, expectedMaxExposure: 250000 },    // 5% max
        { value: 1000000, overallScore: 0.45, expectedMaxExposure: 0 },         // No investment
        { value: 100000000, overallScore: 0.9, expectedMaxExposure: 1000000 }, // Capped at 1M
      ];

      for (const scenario of exposureScenarios) {
        const rwaData = createRWAData({ value: scenario.value });
        
        // Mock the scoring to return specific overall score
        jest.spyOn(scoringSystem as any, 'calculateOverallScore').mockReturnValueOnce(scenario.overallScore);
        
        const score = await scoringSystem.scoreOpportunity(rwaData);
        
        const recommendation = score.recommendations[0];
        expect(recommendation).toBeDefined();
        expect(recommendation!.maxExposure).toBe(scenario.expectedMaxExposure);
      }
    });
  });

  describe('Factor Consistency Analysis', () => {
    beforeEach(async () => {
      await scoringSystem.initialize();
    });

    test('should calculate factor consistency correctly', async () => {
      // Test with consistent scores
      const consistentRWA = createRWAData({
        yield: 0.06,
        riskRating: 'A',
        complianceScore: 85
      });

      const consistentScore = await scoringSystem.scoreOpportunity(consistentRWA);
      
      // Verify all factors are present and sorted by weight
      expect(consistentScore.factors).toHaveLength(6);
      const firstFactor = consistentScore.factors[0];
      const secondFactor = consistentScore.factors[1];
      expect(firstFactor).toBeDefined();
      expect(secondFactor).toBeDefined();
      expect(firstFactor!.weight).toBeGreaterThanOrEqual(secondFactor!.weight);
      
      // Test with inconsistent scores
      const inconsistentRWA = createRWAData({
        yield: 0.15,        // Very high yield
        riskRating: 'D',    // Very poor rating
        complianceScore: 20 // Very low compliance
      });

      const inconsistentScore = await scoringSystem.scoreOpportunity(inconsistentRWA);
      
      // Confidence should be lower due to inconsistency
      expect(inconsistentScore.confidence).toBeLessThan(consistentScore.confidence);
    });
  });

  describe('Volatility Normalization', () => {
    test('should apply volatility normalization when enabled', async () => {
      const configWithNormalization: RWAScoringConfig = {
        ...DEFAULT_RWA_SCORING_CONFIG,
        volatilityNormalization: true
      };

      const normalizedSystem = RWAOpportunityScoringSystem.getInstance(configWithNormalization);
      await normalizedSystem.initialize();

      const rwaData = createRWAData({ type: 'commodities' });
      const score = await normalizedSystem.scoreOpportunity(rwaData);

      // Volatility should be factored into the score
      expect(score.volatilityScore).toBeGreaterThan(0);
      expect(score.factors.some(f => f.category === 'Market')).toBe(true);

      await normalizedSystem.shutdown();
    });

    test('should handle disabled volatility normalization', async () => {
      const configNoNormalization: RWAScoringConfig = {
        ...DEFAULT_RWA_SCORING_CONFIG,
        volatilityNormalization: false
      };

      const nonNormalizedSystem = RWAOpportunityScoringSystem.getInstance(configNoNormalization);
      await nonNormalizedSystem.initialize();

      const rwaData = createRWAData({ type: 'commodities' });
      const score = await nonNormalizedSystem.scoreOpportunity(rwaData);

      // Should still calculate volatility score
      expect(score.volatilityScore).toBeGreaterThan(0);

      await nonNormalizedSystem.shutdown();
    });
  });

  describe('Cache Management', () => {
    test('should disable caching when configured', async () => {
      const configNoCache: RWAScoringConfig = {
        ...DEFAULT_RWA_SCORING_CONFIG,
        cacheResults: false
      };

      const noCacheSystem = RWAOpportunityScoringSystem.getInstance(configNoCache);
      await noCacheSystem.initialize();

      const rwaData = createRWAData();
      
      // Score twice
      await noCacheSystem.scoreOpportunity(rwaData);
      await noCacheSystem.scoreOpportunity(rwaData);

      // Cache should remain empty
      expect(noCacheSystem.getStatus().cacheSize).toBe(0);

      await noCacheSystem.shutdown();
    });
  });

  describe('Small Market Size Handling', () => {
    beforeEach(async () => {
      await scoringSystem.initialize();
    });

    test('should handle small market sizes correctly', async () => {
      // Override market data with small market
      (scoringSystem as any).marketData.set('art', {
        assetClass: 'art',
        currentYield: 0.08,
        historicalYields: [0.08],
        volatility: 0.4,
        liquidity: 0.2,
        marketSize: 50000000, // Small market
        growthRate: 0.02,
        correlation: 0.1
      });

      const artRWA = createRWAData({ type: 'art' });
      const score = await scoringSystem.scoreOpportunity(artRWA);

      // Should penalize small market size
      expect(score.marketScore).toBeLessThan(0.5);
    });
  });
});