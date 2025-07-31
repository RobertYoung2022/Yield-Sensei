/**
 * Fundamental Analysis Engine Unit Tests
 * Comprehensive test suite for the ML-powered protocol analysis system
 */

import { jest } from '@jest/globals';
import { 
  FundamentalAnalysisEngine, 
  DEFAULT_FUNDAMENTAL_ANALYSIS_CONFIG 
} from '../../../src/satellites/sage/research/fundamental-analysis-engine';
import { ProtocolData } from '../../../src/satellites/sage/types';

// Legacy test data structure that doesn't match actual implementation

// Mock TensorFlow.js
const mockModel = {
  compile: jest.fn(),
  fit: jest.fn().mockResolvedValue({ history: { loss: [0.1, 0.05] } }),
  predict: jest.fn(() => ({
    dataSync: jest.fn(() => [0.85]),
    dispose: jest.fn()
  })),
  dispose: jest.fn()
};

jest.mock('@tensorflow/tfjs-node', () => ({
  sequential: jest.fn(() => mockModel),
  layers: {
    dense: jest.fn(() => ({})),
    dropout: jest.fn(() => ({}))
  },
  train: {
    adam: jest.fn(() => ({}))
  },
  tensor2d: jest.fn(() => ({
    dispose: jest.fn()
  })),
  dispose: jest.fn()
}));

// Mock logger
jest.mock('@/shared/logging/logger', () => ({
  getLogger: jest.fn(() => ({
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }))
}));

describe('Fundamental Analysis Engine', () => {
  let analysisEngine: FundamentalAnalysisEngine;

  const sampleProtocolData: ProtocolData = {
    id: 'protocol-test-001',
    name: 'Test DeFi Protocol',
    category: 'lending',
    tvl: 500000000, // $500M
    volume24h: 25000000, // $25M
    users: 15000,
    tokenPrice: 12.50,
    marketCap: 125000000, // $125M
    circulatingSupply: 10000000,
    totalSupply: 15000000,
    apy: 0.085, // 8.5%
    fees24h: 125000,
    revenue: 1500000,
    codeAudits: [
      {
        auditor: 'OpenZeppelin',
        date: new Date('2024-01-15'),
        status: 'passed',
        criticalIssues: 0,
        highIssues: 1,
        mediumIssues: 3,
        lowIssues: 5
      }
    ],
    team: {
      size: 25,
      experience: 4.2,
      credibility: 0.85,
      anonymity: false
    },
    governance: {
      tokenHolders: 8500,
      votingPower: 0.65,
      proposalCount: 45,
      participationRate: 0.35
    },
    riskMetrics: {
      volatility: 0.45,
      correlation: 0.23,
      maxDrawdown: 0.67,
      sharpeRatio: 1.25,
      beta: 1.1
    },
    tokenDistribution: [
      { category: 'Team', percentage: 20, vesting: true },
      { category: 'Public', percentage: 45, vesting: false },
      { category: 'Treasury', percentage: 25, vesting: true },
      { category: 'Advisors', percentage: 10, vesting: true }
    ],
    partnerships: ['Chainlink', 'Compound', 'MakerDAO']
  };

  const highRiskProtocolData: ProtocolData = {
    ...sampleProtocolData,
    id: 'protocol-high-risk-001',
    name: 'High Risk Protocol',
    tvl: 5000000, // Low TVL $5M
    volume24h: 100000, // Low volume $100K
    users: 500, // Few users
    riskMetrics: {
      volatility: 0.85, // High volatility
      correlation: 0.65,
      maxDrawdown: 0.95, // High drawdown
      sharpeRatio: -0.5, // Negative Sharpe ratio
      beta: 2.5 // High beta
    },
    codeAudits: [
      {
        auditor: 'Unknown Auditor',
        date: new Date('2023-06-01'),
        status: 'failed',
        criticalIssues: 3,
        highIssues: 8,
        mediumIssues: 15,
        lowIssues: 25
      }
    ],
    team: {
      size: 3,
      experience: 1.2,
      credibility: 0.25,
      anonymity: true
    }
  };

  beforeEach(() => {
    // Reset singleton instance
    (FundamentalAnalysisEngine as any).instance = null;
    analysisEngine = FundamentalAnalysisEngine.getInstance();
  });

  afterEach(async () => {
    try {
      await analysisEngine.shutdown();
    } catch (error) {
      // Ignore shutdown errors
    }
  });

  describe('Initialization and Configuration', () => {
    test('should create singleton instance', () => {
      const instance1 = FundamentalAnalysisEngine.getInstance();
      const instance2 = FundamentalAnalysisEngine.getInstance();
      
      expect(instance1).toBe(instance2);
      expect(instance1).toBeInstanceOf(FundamentalAnalysisEngine);
    });

    test('should initialize with custom configuration', async () => {
      const customConfig = {
        ...DEFAULT_FUNDAMENTAL_ANALYSIS_CONFIG,
        confidenceThreshold: 0.8,
        maxConcurrentAnalyses: 5,
        enableMLModels: false
      };

      const customEngine = FundamentalAnalysisEngine.getInstance(customConfig);
      await expect(customEngine.initialize()).resolves.not.toThrow();
    });

    test('should initialize ML models when enabled', async () => {
      const mlEnabledConfig = {
        ...DEFAULT_FUNDAMENTAL_ANALYSIS_CONFIG,
        enableMLModels: true
      };

      const mlEngine = FundamentalAnalysisEngine.getInstance(mlEnabledConfig);
      await expect(mlEngine.initialize()).resolves.not.toThrow();
      
      const status = mlEngine.getStatus();
      expect(status.isRunning).toBe(true);
    });

    test('should handle initialization without ML models', async () => {
      const noMLConfig = {
        ...DEFAULT_FUNDAMENTAL_ANALYSIS_CONFIG,
        enableMLModels: false
      };

      const noMLEngine = FundamentalAnalysisEngine.getInstance(noMLConfig);
      await expect(noMLEngine.initialize()).resolves.not.toThrow();
    });
  });

  describe('Protocol Analysis Core Functions', () => {
    beforeEach(async () => {
      await analysisEngine.initialize();
    });

    test('should analyze protocol fundamentals comprehensively', async () => {
      const analysis = await analysisEngine.analyzeProtocol(sampleProtocolData);

      expect(analysis.protocolId).toBe(sampleProtocolData.id);
      expect(analysis.timestamp).toBeInstanceOf(Date);
      expect(analysis.overallScore).toBeGreaterThan(0);
      expect(analysis.overallScore).toBeLessThanOrEqual(1);
      
      // Check all analysis components
      expect(analysis.tvlAnalysis).toBeDefined();
      expect(analysis.tvlAnalysis.health).toBeDefined();
      expect(analysis.tvlAnalysis.trend).toBeDefined();
      expect(analysis.tvlAnalysis.score).toBeGreaterThanOrEqual(0);
      expect(analysis.tvlAnalysis.score).toBeLessThanOrEqual(1);

      expect(analysis.riskAssessment).toBeDefined();
      expect(analysis.riskAssessment.overallRisk).toBeDefined();
      expect(analysis.riskAssessment.riskScore).toBeGreaterThanOrEqual(0);
      expect(analysis.riskAssessment.riskScore).toBeLessThanOrEqual(1);

      expect(analysis.teamAssessment).toBeDefined();
      expect(analysis.teamAssessment.score).toBeGreaterThanOrEqual(0);
      expect(analysis.teamAssessment.score).toBeLessThanOrEqual(1);

      expect(analysis.securityAssessment).toBeDefined();
      expect(analysis.securityAssessment.overallScore).toBeGreaterThanOrEqual(0);
      expect(analysis.securityAssessment.overallScore).toBeLessThanOrEqual(1);

      expect(analysis.governanceAssessment).toBeDefined();
      expect(analysis.governanceAssessment.score).toBeGreaterThanOrEqual(0);
      expect(analysis.governanceAssessment.score).toBeLessThanOrEqual(1);

      expect(analysis.revenueAnalysis).toBeDefined();
      expect(analysis.revenueAnalysis.score).toBeGreaterThanOrEqual(0);
      expect(analysis.revenueAnalysis.score).toBeLessThanOrEqual(1);
    });

    test('should generate appropriate recommendations', async () => {
      const analysis = await analysisEngine.analyzeProtocol(sampleProtocolData);

      expect(analysis.recommendations).toBeInstanceOf(Array);
      expect(analysis.recommendations.length).toBeGreaterThan(0);

      analysis.recommendations.forEach(rec => {
        expect(['buy', 'sell', 'hold', 'monitor']).toContain(rec.type);
        expect(rec.confidence).toBeGreaterThan(0);
        expect(rec.confidence).toBeLessThanOrEqual(1);
        expect(rec.reasoning).toBeDefined();
        expect(['short', 'medium', 'long']).toContain(rec.timeframe);
        expect(['low', 'medium', 'high']).toContain(rec.riskLevel);
      });
    });

    test('should score high-quality protocols higher than low-quality ones', async () => {
      const goodAnalysis = await analysisEngine.analyzeProtocol(sampleProtocolData);
      const badAnalysis = await analysisEngine.analyzeProtocol(highRiskProtocolData);

      expect(goodAnalysis.overallScore).toBeGreaterThan(badAnalysis.overallScore);
      expect(goodAnalysis.riskAssessment.riskScore).toBeGreaterThan(badAnalysis.riskAssessment.riskScore);
      expect(goodAnalysis.securityAssessment.overallScore).toBeGreaterThan(badAnalysis.securityAssessment.overallScore);
    });

    test('should calculate confidence scores appropriately', async () => {
      const analysis = await analysisEngine.analyzeProtocol(sampleProtocolData);

      expect(analysis.confidence).toBeGreaterThan(0);
      expect(analysis.confidence).toBeLessThanOrEqual(1);

      // High-quality data should have higher confidence
      expect(analysis.confidence).toBeGreaterThan(0.5);
    });
  });

  describe('TVL and Market Analysis', () => {
    beforeEach(async () => {
      await analysisEngine.initialize();
    });

    test('should analyze TVL health correctly', async () => {
      const analysis = await analysisEngine.analyzeProtocol(sampleProtocolData);
      const tvlAnalysis = analysis.tvlAnalysis;

      expect(tvlAnalysis.currentTVL).toBe(sampleProtocolData.tvl);
      expect(['healthy', 'warning', 'critical']).toContain(tvlAnalysis.health);
      expect(['growing', 'stable', 'declining']).toContain(tvlAnalysis.trend);
      expect(tvlAnalysis.score).toBeGreaterThan(0);
      expect(tvlAnalysis.marketShare).toBeDefined();
    });

    test('should penalize low TVL protocols', async () => {
      const lowTVLProtocol = {
        ...sampleProtocolData,
        tvl: 1000000 // $1M TVL (very low)
      };

      const analysis = await analysisEngine.analyzeProtocol(lowTVLProtocol);
      expect(analysis.tvlAnalysis.score).toBeLessThan(0.5);
      expect(analysis.tvlAnalysis.health).toBe('warning');
    });

    test('should reward high TVL protocols', async () => {
      const highTVLProtocol = {
        ...sampleProtocolData,
        tvl: 5000000000 // $5B TVL
      };

      const analysis = await analysisEngine.analyzeProtocol(highTVLProtocol);
      expect(analysis.tvlAnalysis.score).toBeGreaterThan(0.7);
      expect(analysis.tvlAnalysis.health).toBe('healthy');
    });
  });

  describe('Risk Assessment', () => {
    beforeEach(async () => {
      await analysisEngine.initialize();
    });

    test('should assess various risk factors', async () => {
      const analysis = await analysisEngine.analyzeProtocol(sampleProtocolData);
      const riskAssessment = analysis.riskAssessment;

      expect(['low', 'medium', 'high', 'critical']).toContain(riskAssessment.overallRisk);
      expect(riskAssessment.factors).toBeInstanceOf(Array);
      expect(riskAssessment.factors.length).toBeGreaterThan(0);

      riskAssessment.factors.forEach(factor => {
        expect(factor.category).toBeDefined();
        expect(factor.score).toBeGreaterThanOrEqual(0);
        expect(factor.score).toBeLessThanOrEqual(1);
        expect(factor.weight).toBeGreaterThan(0);
        expect(['positive', 'negative', 'neutral']).toContain(factor.impact);
      });
    });

    test('should calculate risk metrics correctly', async () => {
      const analysis = await analysisEngine.analyzeProtocol(sampleProtocolData);
      const riskAssessment = analysis.riskAssessment;

      expect(riskAssessment.volatilityRisk).toBeGreaterThanOrEqual(0);
      expect(riskAssessment.volatilityRisk).toBeLessThanOrEqual(1);
      expect(riskAssessment.liquidityRisk).toBeGreaterThanOrEqual(0);
      expect(riskAssessment.liquidityRisk).toBeLessThanOrEqual(1);
      expect(riskAssessment.counterpartyRisk).toBeGreaterThanOrEqual(0);
      expect(riskAssessment.counterpartyRisk).toBeLessThanOrEqual(1);
    });

    test('should identify high-risk protocols', async () => {
      const analysis = await analysisEngine.analyzeProtocol(highRiskProtocolData);
      const riskAssessment = analysis.riskAssessment;

      expect(riskAssessment.overallRisk).toMatch(/high|critical/);
      expect(riskAssessment.riskScore).toBeLessThan(0.5);
      expect(riskAssessment.volatilityRisk).toBeGreaterThan(0.7);
    });
  });

  describe('Team and Governance Assessment', () => {
    beforeEach(async () => {
      await analysisEngine.initialize();
    });

    test('should evaluate team quality', async () => {
      const analysis = await analysisEngine.analyzeProtocol(sampleProtocolData);
      const teamAssessment = analysis.teamAssessment;

      expect(teamAssessment.teamSize).toBe(sampleProtocolData.team.size);
      expect(teamAssessment.experience).toBe(sampleProtocolData.team.experience);
      expect(teamAssessment.credibility).toBe(sampleProtocolData.team.credibility);
      expect(teamAssessment.anonymity).toBe(sampleProtocolData.team.anonymity);
      expect(teamAssessment.score).toBeGreaterThan(0);
    });

    test('should penalize anonymous teams', async () => {
      const anonymousTeamProtocol = {
        ...sampleProtocolData,
        team: {
          ...sampleProtocolData.team,
          anonymity: true,
          credibility: 0.3
        }
      };

      const analysis = await analysisEngine.analyzeProtocol(anonymousTeamProtocol);
      expect(analysis.teamAssessment.score).toBeLessThan(0.5);
    });

    test('should evaluate governance quality', async () => {
      const analysis = await analysisEngine.analyzeProtocol(sampleProtocolData);
      const governanceAssessment = analysis.governanceAssessment;

      expect(governanceAssessment.decentralizationScore).toBeGreaterThanOrEqual(0);
      expect(governanceAssessment.decentralizationScore).toBeLessThanOrEqual(1);
      expect(governanceAssessment.participationScore).toBeGreaterThanOrEqual(0);
      expect(governanceAssessment.participationScore).toBeLessThanOrEqual(1);
      expect(governanceAssessment.transparencyScore).toBeGreaterThanOrEqual(0);
      expect(governanceAssessment.transparencyScore).toBeLessThanOrEqual(1);
    });
  });

  describe('Security Assessment', () => {
    beforeEach(async () => {
      await analysisEngine.initialize();
    });

    test('should evaluate code audit results', async () => {
      const analysis = await analysisEngine.analyzeProtocol(sampleProtocolData);
      const securityAssessment = analysis.securityAssessment;

      expect(securityAssessment.auditScore).toBeGreaterThanOrEqual(0);
      expect(securityAssessment.auditScore).toBeLessThanOrEqual(1);
      expect(securityAssessment.codeQuality).toBeGreaterThanOrEqual(0);
      expect(securityAssessment.codeQuality).toBeLessThanOrEqual(1);
      expect(securityAssessment.vulnerabilityCount).toBeGreaterThanOrEqual(0);
    });

    test('should penalize protocols with critical security issues', async () => {
      const insecureProtocol = {
        ...sampleProtocolData,
        codeAudits: [
          {
            auditor: 'Security Firm',
            date: new Date('2024-01-01'),
            status: 'failed' as const,
            criticalIssues: 5,
            highIssues: 10,
            mediumIssues: 20,
            lowIssues: 30
          }
        ]
      };

      const analysis = await analysisEngine.analyzeProtocol(insecureProtocol);
      expect(analysis.securityAssessment.overallScore).toBeLessThan(0.3);
      expect(analysis.securityAssessment.vulnerabilityCount).toBeGreaterThan(60);
    });

    test('should reward protocols with clean audit results', async () => {
      const secureProtocol = {
        ...sampleProtocolData,
        codeAudits: [
          {
            auditor: 'Top Security Firm',
            date: new Date('2024-01-01'),
            status: 'passed' as const,
            criticalIssues: 0,
            highIssues: 0,
            mediumIssues: 1,
            lowIssues: 2
          }
        ]
      };

      const analysis = await analysisEngine.analyzeProtocol(secureProtocol);
      expect(analysis.securityAssessment.overallScore).toBeGreaterThan(0.8);
      expect(analysis.securityAssessment.auditScore).toBeGreaterThan(0.9);
    });
  });

  describe('Revenue and Economic Analysis', () => {
    beforeEach(async () => {
      await analysisEngine.initialize();
    });

    test('should analyze revenue metrics', async () => {
      const analysis = await analysisEngine.analyzeProtocol(sampleProtocolData);
      const revenueAnalysis = analysis.revenueAnalysis;

      expect(revenueAnalysis.revenueGrowth).toBeDefined();
      expect(revenueAnalysis.profitability).toBeGreaterThanOrEqual(0);
      expect(revenueAnalysis.sustainability).toBeGreaterThanOrEqual(0);
      expect(revenueAnalysis.sustainability).toBeLessThanOrEqual(1);
      expect(['growing', 'stable', 'declining']).toContain(revenueAnalysis.trend);
    });

    test('should calculate business model sustainability', async () => {
      const analysis = await analysisEngine.analyzeProtocol(sampleProtocolData);
      const revenueAnalysis = analysis.revenueAnalysis;

      expect(revenueAnalysis.businessModel).toBeDefined();
      expect(['sustainable', 'questionable', 'unsustainable']).toContain(revenueAnalysis.businessModel);
    });
  });

  describe('ML Model Integration', () => {
    beforeEach(async () => {
      const mlConfig = {
        ...DEFAULT_FUNDAMENTAL_ANALYSIS_CONFIG,
        enableMLModels: true
      };
      analysisEngine = FundamentalAnalysisEngine.getInstance(mlConfig);
      await analysisEngine.initialize();
    });

    test('should integrate ML predictions into analysis', async () => {
      const analysis = await analysisEngine.analyzeProtocol(sampleProtocolData);

      // ML model should influence the overall score
      expect(analysis.overallScore).toBeDefined();
      expect(analysis.confidence).toBeGreaterThan(0);
    });

    test('should handle ML model training', async () => {
      // Mock training data
      const trainingData = [
        { features: [1, 0.8, 0.6, 0.9], label: 1 }, // Good protocol
        { features: [0.2, 0.3, 0.1, 0.2], label: 0 } // Bad protocol
      ];

      await expect(analysisEngine.trainModel(trainingData)).resolves.not.toThrow();
    });

    test('should provide feature importance analysis', async () => {
      const importance = await analysisEngine.getFeatureImportance();

      expect(importance).toBeInstanceOf(Array);
      importance.forEach(feature => {
        expect(feature.name).toBeDefined();
        expect(feature.importance).toBeGreaterThanOrEqual(0);
        expect(feature.importance).toBeLessThanOrEqual(1);
      });
    });
  });

  describe('Performance and Caching', () => {
    beforeEach(async () => {
      await analysisEngine.initialize();
    });

    test('should cache analysis results', async () => {
      const startTime = Date.now();
      
      // First analysis
      const analysis1 = await analysisEngine.analyzeProtocol(sampleProtocolData);
      const firstCallTime = Date.now() - startTime;
      
      // Second analysis (should be cached)
      const analysis2 = await analysisEngine.analyzeProtocol(sampleProtocolData);
      const secondCallTime = Date.now() - startTime - firstCallTime;
      
      // Cached call should be faster
      expect(secondCallTime).toBeLessThan(firstCallTime);
      expect(analysis1.overallScore).toBe(analysis2.overallScore);
    });

    test('should handle concurrent analysis requests', async () => {
      const protocols = Array.from({ length: 5 }, (_, i) => ({
        ...sampleProtocolData,
        id: `concurrent-protocol-${i}`,
        tvl: 100000000 + (i * 50000000)
      }));

      const startTime = Date.now();
      
      const analyses = await Promise.all(
        protocols.map(protocol => analysisEngine.analyzeProtocol(protocol))
      );
      
      const totalTime = Date.now() - startTime;
      
      expect(totalTime).toBeLessThan(10000); // Should complete within 10 seconds
      expect(analyses).toHaveLength(5);
      
      analyses.forEach(analysis => {
        expect(analysis.overallScore).toBeGreaterThan(0);
      });
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      await analysisEngine.initialize();
    });

    test('should handle invalid protocol data', async () => {
      const invalidProtocol = {
        ...sampleProtocolData,
        tvl: -1000000, // Invalid negative TVL
        users: null, // Invalid null users
        riskMetrics: null // Invalid null risk metrics
      } as any;

      await expect(analysisEngine.analyzeProtocol(invalidProtocol))
        .rejects.toThrow();
    });

    test('should handle missing protocol data gracefully', async () => {
      const incompleteProtocol = {
        id: 'incomplete-001',
        name: 'Incomplete Protocol',
        category: 'lending',
        tvl: 1000000
        // Missing many required fields
      } as any;

      await expect(analysisEngine.analyzeProtocol(incompleteProtocol))
        .rejects.toThrow();
    });

    test('should recover from analysis errors', async () => {
      // Cause an error
      try {
        await analysisEngine.analyzeProtocol(null as any);
      } catch (error) {
        // Expected error
      }

      // Should still work for valid data
      const analysis = await analysisEngine.analyzeProtocol(sampleProtocolData);
      expect(analysis.overallScore).toBeGreaterThan(0);
    });
  });

  describe('Event Emission', () => {
    beforeEach(async () => {
      await analysisEngine.initialize();
    });

    test('should emit analysis completed events', (done) => {
      const eventHandler = jest.fn((data: any) => {
        expect(data.protocolId).toBe(sampleProtocolData.id);
        expect(data.analysis).toBeDefined();
        expect(data.timestamp).toBeInstanceOf(Date);
        done();
      });

      analysisEngine.on('analysis_completed', eventHandler);
      
      analysisEngine.analyzeProtocol(sampleProtocolData).catch(done);
    });

    test('should emit model training events when ML is enabled', (done) => {
      analysisEngine.on('model_training_completed', (data: any) => {
        expect(data.performance).toBeDefined();
        expect(data.timestamp).toBeInstanceOf(Date);
        done();
      });

      const trainingData = [
        { features: [1, 0.8, 0.6, 0.9], label: 1 }
      ];

      analysisEngine.trainModel(trainingData).catch(done);
    });
  });
});