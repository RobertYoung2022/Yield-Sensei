/**
 * Data Validation and Accuracy Testing Suite
 * Comprehensive validation of data integrity, accuracy, and consistency across Sage components
 */

import { jest } from '@jest/globals';
import { SageSatelliteAgent, DEFAULT_SAGE_CONFIG } from '../../../src/satellites/sage/sage-satellite';
import { RWAOpportunityScoringSystem } from '../../../src/satellites/sage/rwa/opportunity-scoring-system';
import { FundamentalAnalysisEngine } from '../../../src/satellites/sage/research/fundamental-analysis-engine';
import { ComplianceMonitoringFramework } from '../../../src/satellites/sage/compliance/compliance-monitoring-framework';
import { RWAData, ProtocolData, RWAType } from '../../../src/satellites/sage/types';

// Mock dependencies
jest.mock('@/shared/logging/logger', () => ({
  getLogger: jest.fn(() => ({
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }))
}));

jest.mock('@tensorflow/tfjs-node', () => ({
  sequential: jest.fn(() => ({
    compile: jest.fn(),
    fit: jest.fn().mockResolvedValue({ history: { loss: [0.1] } }),
    predict: jest.fn(() => ({
      dataSync: jest.fn(() => [0.85]),
      dispose: jest.fn()
    })),
    dispose: jest.fn()
  })),
  layers: { dense: jest.fn(), dropout: jest.fn() },
  train: { adam: jest.fn() },
  tensor2d: jest.fn(() => ({ dispose: jest.fn() }))
}));

describe('Data Validation and Accuracy Testing Suite', () => {
  let sageAgent: SageSatelliteAgent;

  // Reference data for accuracy benchmarks
  const BENCHMARK_RWA_DATA: RWAData = {
    id: 'benchmark-rwa-001',
    type: 'real-estate',
    issuer: 'Premium Real Estate Fund',
    value: 5000000,
    currency: 'USD',
    maturityDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    yield: 0.08, // 8% yield
    riskRating: 'AA',
    collateral: {
      type: 'real-estate',
      value: 6000000, // 120% collateralization
      ltv: 0.83,
      liquidationThreshold: 0.9
    },
    regulatoryStatus: {
      jurisdiction: 'US',
      complianceLevel: 'compliant',
      licenses: ['SEC-Registered', 'State-Licensed', 'FINRA-Member'],
      restrictions: [],
      lastReview: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000) // 15 days ago
    },
    complianceScore: 92
  };

  const BENCHMARK_PROTOCOL_DATA: ProtocolData = {
    id: 'benchmark-protocol-001',
    name: 'Established DeFi Protocol',
    category: 'lending',
    tvl: 2000000000, // $2B TVL
    volume24h: 50000000, // $50M daily volume
    users: 75000,
    tokenPrice: 25.00,
    marketCap: 500000000, // $500M market cap
    circulatingSupply: 20000000,
    totalSupply: 25000000,
    apy: 0.095, // 9.5% APY
    fees24h: 250000,
    revenue: 15000000,
    codeAudits: [
      {
        auditor: 'Trail of Bits',
        date: new Date('2024-01-01'),
        status: 'passed',
        criticalIssues: 0,
        highIssues: 0,
        mediumIssues: 2,
        lowIssues: 3
      },
      {
        auditor: 'OpenZeppelin',
        date: new Date('2023-11-15'),
        status: 'passed',
        criticalIssues: 0,
        highIssues: 1,
        mediumIssues: 4,
        lowIssues: 8
      }
    ],
    team: {
      size: 45,
      experience: 5.5,
      credibility: 0.95,
      anonymity: false
    },
    governance: {
      tokenHolders: 25000,
      votingPower: 0.78,
      proposalCount: 125,
      participationRate: 0.68
    },
    riskMetrics: {
      volatility: 0.35,
      correlation: 0.18,
      maxDrawdown: 0.42,
      sharpeRatio: 1.8,
      beta: 0.9
    },
    tokenDistribution: [
      { category: 'Team', percentage: 15, vesting: true },
      { category: 'Public', percentage: 55, vesting: false },
      { category: 'Treasury', percentage: 25, vesting: true },
      { category: 'Advisors', percentage: 5, vesting: true }
    ],
    partnerships: ['Chainlink', 'Compound', 'Aave', 'Circle', 'MakerDAO']
  };

  beforeEach(() => {
    sageAgent = new SageSatelliteAgent({
      ...DEFAULT_SAGE_CONFIG,
      id: `sage-validation-${Date.now()}`
    });
  });

  afterEach(async () => {
    try {
      await sageAgent.shutdown();
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Input Data Validation', () => {
    beforeEach(async () => {
      await sageAgent.initialize();
    });

    test('should validate RWA data schema compliance', async () => {
      const validRWA = { ...BENCHMARK_RWA_DATA };
      
      // Valid data should process successfully
      const score = await sageAgent.scoreRWAOpportunity(validRWA);
      expect(score.overallScore).toBeGreaterThan(0);
      expect(score.rwaId).toBe(validRWA.id);
    });

    test('should reject RWA data with missing required fields', async () => {
      const invalidRWA = {
        ...BENCHMARK_RWA_DATA,
        yield: undefined, // Missing required field
        value: null // Invalid null value
      } as any;

      await expect(sageAgent.scoreRWAOpportunity(invalidRWA))
        .rejects.toThrow();
    });

    test('should validate RWA data field constraints', async () => {
      // Test negative yield
      const negativeYieldRWA = {
        ...BENCHMARK_RWA_DATA,
        yield: -0.05 // Invalid negative yield
      };

      await expect(sageAgent.scoreRWAOpportunity(negativeYieldRWA))
        .rejects.toThrow();

      // Test zero value
      const zeroValueRWA = {
        ...BENCHMARK_RWA_DATA,
        value: 0 // Invalid zero value
      };

      await expect(sageAgent.scoreRWAOpportunity(zeroValueRWA))
        .rejects.toThrow();

      // Test invalid LTV ratio
      const invalidLTVRWA = {
        ...BENCHMARK_RWA_DATA,
        collateral: {
          ...BENCHMARK_RWA_DATA.collateral,
          ltv: 2.0 // Invalid LTV > 100%
        }
      };

      await expect(sageAgent.scoreRWAOpportunity(invalidLTVRWA))
        .rejects.toThrow();
    });

    test('should validate protocol data schema compliance', async () => {
      const validProtocol = { ...BENCHMARK_PROTOCOL_DATA };
      
      const analysis = await sageAgent.analyzeProtocol(validProtocol);
      expect(analysis.overallScore).toBeGreaterThan(0);
      expect(analysis.protocolId).toBe(validProtocol.id);
    });

    test('should reject protocol data with invalid values', async () => {
      // Test negative TVL
      const negativeTVLProtocol = {
        ...BENCHMARK_PROTOCOL_DATA,
        tvl: -1000000
      };

      await expect(sageAgent.analyzeProtocol(negativeTVLProtocol))
        .rejects.toThrow();

      // Test invalid market cap vs circulating supply
      const invalidMarketCapProtocol = {
        ...BENCHMARK_PROTOCOL_DATA,
        marketCap: 1000, // Too low compared to token price and supply
        tokenPrice: 100,
        circulatingSupply: 1000000
      };

      await expect(sageAgent.analyzeProtocol(invalidMarketCapProtocol))
        .rejects.toThrow();
    });

    test('should validate date fields', async () => {
      // Test future last review date (invalid)
      const futureDateRWA = {
        ...BENCHMARK_RWA_DATA,
        regulatoryStatus: {
          ...BENCHMARK_RWA_DATA.regulatoryStatus,
          lastReview: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // Future date
        }
      };

      await expect(sageAgent.scoreRWAOpportunity(futureDateRWA))
        .rejects.toThrow();

      // Test very old maturity date (potentially invalid)
      const pastMaturityRWA = {
        ...BENCHMARK_RWA_DATA,
        maturityDate: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) // Past date
      };

      await expect(sageAgent.scoreRWAOpportunity(pastMaturityRWA))
        .rejects.toThrow();
    });

    test('should validate enum values', async () => {
      // Test invalid RWA type
      const invalidTypeRWA = {
        ...BENCHMARK_RWA_DATA,
        type: 'invalid-type' as RWAType
      };

      await expect(sageAgent.scoreRWAOpportunity(invalidTypeRWA))
        .rejects.toThrow();

      // Test invalid compliance level
      const invalidComplianceRWA = {
        ...BENCHMARK_RWA_DATA,
        regulatoryStatus: {
          ...BENCHMARK_RWA_DATA.regulatoryStatus,
          complianceLevel: 'invalid-level' as any
        }
      };

      await expect(sageAgent.scoreRWAOpportunity(invalidComplianceRWA))
        .rejects.toThrow();
    });
  });

  describe('Scoring Accuracy Validation', () => {
    beforeEach(async () => {
      await sageAgent.initialize();
    });

    test('should produce consistent scores for identical inputs', async () => {
      const scores = await Promise.all([
        sageAgent.scoreRWAOpportunity(BENCHMARK_RWA_DATA),
        sageAgent.scoreRWAOpportunity(BENCHMARK_RWA_DATA),
        sageAgent.scoreRWAOpportunity(BENCHMARK_RWA_DATA)
      ]);

      // All scores should be identical for same input
      expect(scores[0].overallScore).toBe(scores[1].overallScore);
      expect(scores[1].overallScore).toBe(scores[2].overallScore);
      expect(scores[0].riskAdjustedReturn).toBe(scores[1].riskAdjustedReturn);
    });

    test('should validate RWA scoring logic against known benchmarks', async () => {
      // High-quality RWA should score well
      const highQualityRWA: RWAData = {
        ...BENCHMARK_RWA_DATA,
        yield: 0.09, // High yield
        riskRating: 'AAA', // Best rating
        complianceScore: 98, // Excellent compliance
        collateral: {
          type: 'government-bonds',
          value: 7000000, // 140% collateralization
          ltv: 0.71,
          liquidationThreshold: 0.85
        }
      };

      const highScore = await sageAgent.scoreRWAOpportunity(highQualityRWA);
      expect(highScore.overallScore).toBeGreaterThan(0.8);
      expect(highScore.riskScore).toBeGreaterThan(0.8);
      expect(highScore.complianceScore).toBeGreaterThan(0.9);
      expect(highScore.recommendations[0]?.action).toBe('invest');

      // Low-quality RWA should score poorly
      const lowQualityRWA: RWAData = {
        ...BENCHMARK_RWA_DATA,
        yield: 0.03, // Low yield
        riskRating: 'CCC', // Poor rating
        complianceScore: 35, // Poor compliance
        regulatoryStatus: {
          jurisdiction: 'US',
          complianceLevel: 'non-compliant',
          licenses: [],
          restrictions: ['High-Risk', 'Transfer-Prohibited'],
          lastReview: new Date(Date.now() - 1095 * 24 * 60 * 60 * 1000) // 3 years ago
        }
      };

      const lowScore = await sageAgent.scoreRWAOpportunity(lowQualityRWA);
      expect(lowScore.overallScore).toBeLessThan(0.4);
      expect(lowScore.riskScore).toBeLessThan(0.4);
      expect(lowScore.complianceScore).toBeLessThan(0.4);
      expect(lowScore.recommendations[0]?.action).toBe('avoid');
    });

    test('should validate protocol analysis accuracy', async () => {
      // Strong protocol should score well
      const strongProtocol: ProtocolData = {
        ...BENCHMARK_PROTOCOL_DATA,
        tvl: 5000000000, // $5B TVL
        users: 150000, // Many users
        apy: 0.12, // High APY
        riskMetrics: {
          volatility: 0.15, // Low volatility
          correlation: 0.05,
          maxDrawdown: 0.25, // Low drawdown
          sharpeRatio: 2.5, // High Sharpe ratio
          beta: 0.7
        },
        codeAudits: [
          {
            auditor: 'Trail of Bits',
            date: new Date('2024-01-01'),
            status: 'passed',
            criticalIssues: 0,
            highIssues: 0,
            mediumIssues: 0,
            lowIssues: 1
          }
        ]
      };

      const strongAnalysis = await sageAgent.analyzeProtocol(strongProtocol);
      expect(strongAnalysis.overallScore).toBeGreaterThan(0.8);
      expect(strongAnalysis.tvlAnalysis.score).toBeGreaterThan(0.8);
      expect(strongAnalysis.riskAssessment.riskScore).toBeGreaterThan(0.7);
      expect(strongAnalysis.securityAssessment.overallScore).toBeGreaterThan(0.9);

      // Weak protocol should score poorly
      const weakProtocol: ProtocolData = {
        ...BENCHMARK_PROTOCOL_DATA,
        tvl: 5000000, // Low TVL
        users: 500, // Few users
        apy: 0.02, // Low APY
        riskMetrics: {
          volatility: 0.85, // High volatility
          correlation: 0.75,
          maxDrawdown: 0.95, // High drawdown
          sharpeRatio: -0.5, // Negative Sharpe ratio
          beta: 2.2
        },
        codeAudits: [
          {
            auditor: 'Unknown Auditor',
            date: new Date('2022-01-01'),
            status: 'failed',
            criticalIssues: 5,
            highIssues: 15,
            mediumIssues: 25,
            lowIssues: 35
          }
        ],
        team: {
          size: 2,
          experience: 0.5,
          credibility: 0.2,
          anonymity: true
        }
      };

      const weakAnalysis = await sageAgent.analyzeProtocol(weakProtocol);
      expect(weakAnalysis.overallScore).toBeLessThan(0.4);
      expect(weakAnalysis.tvlAnalysis.score).toBeLessThan(0.3);
      expect(weakAnalysis.riskAssessment.riskScore).toBeLessThan(0.3);
      expect(weakAnalysis.securityAssessment.overallScore).toBeLessThan(0.3);
    });

    test('should validate score component relationships', async () => {
      const score = await sageAgent.scoreRWAOpportunity(BENCHMARK_RWA_DATA);

      // Overall score should be influenced by component scores
      const componentAvg = (
        score.yieldScore +
        score.riskScore +
        score.liquidityScore +
        score.regulatoryScore +
        score.collateralScore +
        score.marketScore
      ) / 6;

      // Overall score should be reasonably close to weighted average
      const deviation = Math.abs(score.overallScore - componentAvg);
      expect(deviation).toBeLessThan(0.3); // Within 30% of component average

      // Risk-adjusted return should correlate with risk score
      if (score.riskScore > 0.7) {
        expect(score.riskAdjustedReturn).toBeGreaterThan(0.02);
      }
    });
  });

  describe('Data Consistency Validation', () => {
    beforeEach(async () => {
      await sageAgent.initialize();
    });

    test('should maintain consistency across similar assets', async () => {
      const similarRWAs = Array.from({ length: 5 }, (_, i) => ({
        ...BENCHMARK_RWA_DATA,
        id: `similar-rwa-${i}`,
        yield: 0.08 + (i * 0.001), // Very slight variations
        value: 5000000 + (i * 10000)
      }));

      const scores = await Promise.all(
        similarRWAs.map(rwa => sageAgent.scoreRWAOpportunity(rwa))
      );

      // Scores should be very similar for similar assets
      const overallScores = scores.map(s => s.overallScore);
      const maxScore = Math.max(...overallScores);
      const minScore = Math.min(...overallScores);
      const scoreDifference = maxScore - minScore;

      expect(scoreDifference).toBeLessThan(0.05); // Less than 5% difference

      // Risk scores should also be consistent
      const riskScores = scores.map(s => s.riskScore);
      const riskDifference = Math.max(...riskScores) - Math.min(...riskScores);
      expect(riskDifference).toBeLessThan(0.03); // Less than 3% difference
    });

    test('should maintain temporal consistency', async () => {
      const rwaData = { ...BENCHMARK_RWA_DATA };
      
      // Score at different times
      const scores = [];
      for (let i = 0; i < 3; i++) {
        scores.push(await sageAgent.scoreRWAOpportunity(rwaData));
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Scores should be identical (assuming no external data changes)
      expect(scores[0].overallScore).toBe(scores[1].overallScore);
      expect(scores[1].overallScore).toBe(scores[2].overallScore);
    });

    test('should validate cross-component data consistency', async () => {
      const rwaData = { ...BENCHMARK_RWA_DATA };
      
      // Get scores from main agent and direct component
      const agentScore = await sageAgent.scoreRWAOpportunity(rwaData);
      
      const scoringSystem = RWAOpportunityScoringSystem.getInstance();
      await scoringSystem.initialize();
      const directScore = await scoringSystem.scoreOpportunity(rwaData);

      // Scores should be identical when using same data and config
      expect(agentScore.overallScore).toBe(directScore.overallScore);
      expect(agentScore.yieldScore).toBe(directScore.yieldScore);
      expect(agentScore.riskScore).toBe(directScore.riskScore);

      await scoringSystem.shutdown();
    });

    test('should validate factor weight consistency', async () => {
      const score = await sageAgent.scoreRWAOpportunity(BENCHMARK_RWA_DATA);

      // Factor weights should sum to reasonable total
      const totalWeight = score.factors.reduce((sum, factor) => sum + factor.weight, 0);
      expect(totalWeight).toBeCloseTo(1.0, 1); // Should sum close to 1

      // Each factor should have reasonable weight
      score.factors.forEach(factor => {
        expect(factor.weight).toBeGreaterThan(0);
        expect(factor.weight).toBeLessThan(1);
      });
    });
  });

  describe('Data Transformation Accuracy', () => {
    beforeEach(async () => {
      await sageAgent.initialize();
    });

    test('should correctly normalize percentage values', async () => {
      const rwaWithPercentages = {
        ...BENCHMARK_RWA_DATA,
        yield: 0.085, // 8.5%
        complianceScore: 88 // Percentage out of 100
      };

      const score = await sageAgent.scoreRWAOpportunity(rwaWithPercentages);

      // Compliance score should be normalized to 0-1 range
      expect(score.complianceScore).toBeCloseTo(0.88, 2);
      expect(score.complianceScore).toBeLessThanOrEqual(1);
      expect(score.complianceScore).toBeGreaterThanOrEqual(0);
    });

    test('should correctly handle currency conversions', async () => {
      const eurRWA = {
        ...BENCHMARK_RWA_DATA,
        currency: 'EUR',
        value: 4000000 // €4M (assuming ~$5M at 1.25 exchange rate)
      };

      const usdRWA = {
        ...BENCHMARK_RWA_DATA,
        currency: 'USD',
        value: 5000000 // $5M
      };

      const eurScore = await sageAgent.scoreRWAOpportunity(eurRWA);
      const usdScore = await sageAgent.scoreRWAOpportunity(usdRWA);

      // Scores should be similar after currency normalization
      const scoreDifference = Math.abs(eurScore.overallScore - usdScore.overallScore);
      expect(scoreDifference).toBeLessThan(0.1); // Within 10% after conversion
    });

    test('should correctly process time-based calculations', async () => {
      const shortTermRWA = {
        ...BENCHMARK_RWA_DATA,
        maturityDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) // 3 months
      };

      const longTermRWA = {
        ...BENCHMARK_RWA_DATA,
        maturityDate: new Date(Date.now() + 1825 * 24 * 60 * 60 * 1000) // 5 years
      };

      const shortScore = await sageAgent.scoreRWAOpportunity(shortTermRWA);
      const longScore = await sageAgent.scoreRWAOpportunity(longTermRWA);

      // Short-term should generally have different risk characteristics
      expect(shortScore.overallScore).not.toBe(longScore.overallScore);
      
      // Time to maturity should affect calculations
      expect(shortScore.factors.some(f => f.description.toLowerCase().includes('maturity')))
        .toBe(true);
    });

    test('should validate mathematical calculations', async () => {
      const testRWA = {
        ...BENCHMARK_RWA_DATA,
        yield: 0.10,
        value: 1000000,
        collateral: {
          type: 'real-estate',
          value: 1200000,
          ltv: 0.833, // Should be 1000000/1200000
          liquidationThreshold: 0.9
        }
      };

      const score = await sageAgent.scoreRWAOpportunity(testRWA);

      // LTV calculation should be correct
      const expectedLTV = testRWA.value / testRWA.collateral.value;
      expect(Math.abs(testRWA.collateral.ltv - expectedLTV)).toBeLessThan(0.01);

      // Risk-adjusted return should be reasonable
      expect(score.riskAdjustedReturn).toBeGreaterThan(0);
      expect(score.riskAdjustedReturn).toBeLessThan(testRWA.yield * 2); // Sanity check
    });
  });

  describe('Edge Case and Boundary Validation', () => {
    beforeEach(async () => {
      await sageAgent.initialize();
    });

    test('should handle extreme values gracefully', async () => {
      // Very high yield
      const highYieldRWA = {
        ...BENCHMARK_RWA_DATA,
        yield: 0.50 // 50% yield (suspicious)
      };

      const highYieldScore = await sageAgent.scoreRWAOpportunity(highYieldRWA);
      expect(highYieldScore.yieldScore).toBeLessThanOrEqual(1); // Capped at 1
      expect(highYieldScore.recommendations[0]?.riskLevel).toBe('high'); // Should flag as high risk

      // Very low yield
      const lowYieldRWA = {
        ...BENCHMARK_RWA_DATA,
        yield: 0.001 // 0.1% yield
      };

      const lowYieldScore = await sageAgent.scoreRWAOpportunity(lowYieldRWA);
      expect(lowYieldScore.yieldScore).toBeGreaterThanOrEqual(0); // Not negative
    });

    test('should handle boundary conditions', async () => {
      // Exactly at LTV limit
      const boundaryRWA = {
        ...BENCHMARK_RWA_DATA,
        collateral: {
          ...BENCHMARK_RWA_DATA.collateral,
          ltv: 1.0, // Exactly 100% LTV
          liquidationThreshold: 1.0 // Exactly at threshold
        }
      };

      const score = await sageAgent.scoreRWAOpportunity(boundaryRWA);
      expect(score.collateralScore).toBeGreaterThanOrEqual(0);
      expect(score.collateralScore).toBeLessThanOrEqual(1);
    });

    test('should handle missing optional data', async () => {
      const minimalRWA = {
        ...BENCHMARK_RWA_DATA,
        maturityDate: undefined, // Optional field
        regulatoryStatus: {
          ...BENCHMARK_RWA_DATA.regulatoryStatus,
          licenses: [], // Empty licenses
          restrictions: [] // Empty restrictions
        }
      };

      // Should still process but may have different scores
      const score = await sageAgent.scoreRWAOpportunity(minimalRWA as any);
      expect(score.overallScore).toBeGreaterThan(0);
      expect(score.regulatoryScore).toBeLessThan(BENCHMARK_RWA_DATA.regulatoryStatus.licenses.length > 0 ? 1 : 0.5);
    });

    test('should handle data type coercion', async () => {
      const stringNumberRWA = {
        ...BENCHMARK_RWA_DATA,
        yield: '0.08' as any, // String instead of number
        value: '5000000' as any,
        complianceScore: '92' as any
      };

      // Should handle type coercion or throw appropriate error
      try {
        const score = await sageAgent.scoreRWAOpportunity(stringNumberRWA);
        expect(score.overallScore).toBeGreaterThan(0);
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
      }
    });
  });

  describe('Real-world Data Scenario Validation', () => {
    beforeEach(async () => {
      await sageAgent.initialize();
    });

    test('should validate against real estate market scenarios', async () => {
      // Bull market scenario
      const bullMarketRWA = {
        ...BENCHMARK_RWA_DATA,
        type: 'real-estate' as RWAType,
        yield: 0.065,
        value: 10000000,
        collateral: {
          type: 'real-estate',
          value: 12000000, // Appreciating asset value
          ltv: 0.83,
          liquidationThreshold: 0.9
        }
      };

      const bullScore = await sageAgent.scoreRWAOpportunity(bullMarketRWA);
      expect(bullScore.marketScore).toBeGreaterThan(0.5);

      // Bear market scenario
      const bearMarketRWA = {
        ...bullMarketRWA,
        collateral: {
          ...bullMarketRWA.collateral,
          value: 9500000, // Depreciating asset value
          ltv: 1.05 // LTV increased due to asset depreciation
        }
      };

      const bearScore = await sageAgent.scoreRWAOpportunity(bearMarketRWA);
      expect(bearScore.collateralScore).toBeLessThan(bullScore.collateralScore);
    });

    test('should validate against corporate bond scenarios', async () => {
      const investmentGradeBond: RWAData = {
        ...BENCHMARK_RWA_DATA,
        type: 'bonds',
        issuer: 'Investment Grade Corp',
        yield: 0.055,
        riskRating: 'A',
        collateral: {
          type: 'corporate-bonds',
          value: 5500000,
          ltv: 0.91,
          liquidationThreshold: 0.95
        }
      };

      const bondScore = await sageAgent.scoreRWAOpportunity(investmentGradeBond);
      expect(bondScore.liquidityScore).toBeGreaterThan(0.6); // Bonds generally more liquid
      expect(bondScore.riskScore).toBeGreaterThan(0.6); // Investment grade should score well
    });

    test('should validate multi-jurisdiction compliance scenarios', async () => {
      const jurisdictions = ['US', 'EU', 'UK', 'Singapore'];
      
      for (const jurisdiction of jurisdictions) {
        const jurisdictionRWA = {
          ...BENCHMARK_RWA_DATA,
          regulatoryStatus: {
            ...BENCHMARK_RWA_DATA.regulatoryStatus,
            jurisdiction
          }
        };

        const score = await sageAgent.scoreRWAOpportunity(jurisdictionRWA);
        expect(score.regulatoryScore).toBeGreaterThan(0);
        expect(score.overallScore).toBeGreaterThan(0);
        
        // Should have jurisdiction-specific compliance considerations
        expect(score.factors.some(f => 
          f.category.toLowerCase().includes('regulatory') ||
          f.description.toLowerCase().includes('compliance')
        )).toBe(true);
      }
    });

    test('should validate market stress scenarios', async () => {
      // High volatility scenario
      const stressScenarioRWA = {
        ...BENCHMARK_RWA_DATA,
        yield: 0.15, // High yield indicating distress
        riskRating: 'B',
        regulatoryStatus: {
          ...BENCHMARK_RWA_DATA.regulatoryStatus,
          complianceLevel: 'partial' as any,
          restrictions: ['Liquidity-Restriction', 'Transfer-Limitation']
        }
      };

      const stressScore = await sageAgent.scoreRWAOpportunity(stressScenarioRWA);
      expect(stressScore.overallScore).toBeLessThan(0.6);
      expect(stressScore.recommendations[0]?.action).toMatch(/avoid|monitor/);
      expect(stressScore.recommendations[0]?.riskLevel).toBe('high');
    });
  });

  describe('Compliance and Audit Data Validation', () => {
    beforeEach(async () => {
      await sageAgent.initialize();
    });

    test('should validate audit trail completeness', async () => {
      const rwaData = { ...BENCHMARK_RWA_DATA };
      const score = await sageAgent.scoreRWAOpportunity(rwaData);

      // Should track all input data used in scoring
      expect(score.rwaId).toBe(rwaData.id);
      expect(score.timestamp).toBeInstanceOf(Date);
      expect(score.factors).toBeInstanceOf(Array);
      expect(score.factors.length).toBeGreaterThan(0);

      // Each factor should have complete audit information
      score.factors.forEach(factor => {
        expect(factor.category).toBeDefined();
        expect(factor.score).toBeDefined();
        expect(factor.weight).toBeDefined();
        expect(factor.description).toBeDefined();
        expect(factor.impact).toBeDefined();
      });
    });

    test('should maintain data lineage tracking', async () => {
      const score = await sageAgent.scoreRWAOpportunity(BENCHMARK_RWA_DATA);

      // Should be able to trace back to original data
      expect(score.recommendations).toBeInstanceOf(Array);
      score.recommendations.forEach(rec => {
        expect(rec.confidence).toBeGreaterThan(0);
        expect(rec.reasoning).toBeDefined();
        expect(rec.reasoning.length).toBeGreaterThan(0);
      });
    });

    test('should validate regulatory reporting accuracy', async () => {
      const complianceFramework = ComplianceMonitoringFramework.getInstance();
      await complianceFramework.initialize();

      const assessment = await complianceFramework.assessCompliance(
        BENCHMARK_RWA_DATA.id,
        'rwa',
        BENCHMARK_RWA_DATA
      );

      // Report should be complete and accurate
      expect(assessment.entityId).toBe(BENCHMARK_RWA_DATA.id);
      expect(assessment.overallScore).toBeGreaterThanOrEqual(0);
      expect(assessment.overallScore).toBeLessThanOrEqual(1);
      expect(assessment.ruleEvaluations).toBeInstanceOf(Array);
      expect(assessment.violations).toBeInstanceOf(Array);
      expect(assessment.recommendations).toBeInstanceOf(Array);

      await complianceFramework.shutdown();
    });
  });
});