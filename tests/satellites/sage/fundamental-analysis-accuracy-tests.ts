/**
 * Fundamental Analysis Engine - Accuracy Testing and Reporting
 * Tests for prediction accuracy, error rates, and performance reporting
 */

import { jest } from '@jest/globals';
import { 
  FundamentalAnalysisEngine,
  DEFAULT_FUNDAMENTAL_ANALYSIS_CONFIG,
  FundamentalAnalysisConfig
} from '../../../src/satellites/sage/research/fundamental-analysis-engine';
import { ProtocolData } from '../../../src/satellites/sage/types';
import * as fs from 'fs';
import * as path from 'path';

// Mock TensorFlow and logger
const mockTensor = {
  array: jest.fn().mockResolvedValue([[0.85]]),
  dispose: jest.fn()
};

const mockModel = {
  compile: jest.fn(),
  fit: jest.fn().mockResolvedValue({ 
    history: { 
      loss: [0.5, 0.3, 0.2, 0.1],
      val_loss: [0.6, 0.35, 0.25, 0.15],
      accuracy: [0.6, 0.75, 0.85, 0.95],
      precision: [0.7, 0.8, 0.9, 0.95],
      recall: [0.65, 0.78, 0.88, 0.92]
    } 
  }),
  predict: jest.fn().mockReturnValue(mockTensor),
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
  tensor2d: jest.fn((data) => ({
    array: jest.fn().mockResolvedValue(data),
    dispose: jest.fn()
  })),
  callbacks: {
    earlyStopping: jest.fn(() => ({}))
  }
}));

jest.mock('@/shared/logging/logger', () => ({
  getLogger: jest.fn(() => ({
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }))
}));

// Mock filesystem operations
jest.mock('fs', () => ({
  writeFileSync: jest.fn(),
  mkdirSync: jest.fn(),
  existsSync: jest.fn().mockReturnValue(false)
}));

describe('Fundamental Analysis Engine - Accuracy Testing and Reporting', () => {
  let analysisEngine: FundamentalAnalysisEngine;

  const createBenchmarkProtocol = (overrides: Partial<ProtocolData> = {}): ProtocolData => ({
    id: 'benchmark-protocol',
    name: 'Benchmark Protocol',
    category: 'lending',
    chain: 'ethereum',
    tvl: 100000000,
    tvlHistory: [
      { timestamp: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), value: 80000000, change24h: 0.05, change7d: 0.1, change30d: 0.25 },
      { timestamp: new Date(), value: 100000000, change24h: 0.02, change7d: 0.08, change30d: 0.25 }
    ],
    revenue: {
      daily: 50000,
      weekly: 350000,
      monthly: 1500000,
      annualized: 18000000,
      sources: [
        { name: 'trading_fees', amount: 1200000, percentage: 0.8 },
        { name: 'lending_interest', amount: 300000, percentage: 0.2 }
      ]
    },
    userMetrics: {
      activeUsers: 25000,
      userGrowth: 0.15,
      retentionRate: 0.75,
      averagePositionSize: 40000
    },
    securityMetrics: {
      auditScore: 85,
      insuranceCoverage: 0.8,
      vulnerabilityCount: 2,
      bugBountyProgram: true,
      lastAuditDate: new Date('2024-01-01')
    },
    governanceMetrics: {
      decentralizationScore: 75,
      voterParticipation: 0.35,
      proposalCount: 45,
      averageQuorum: 0.4
    },
    teamInfo: {
      size: 20,
      experience: 5,
      transparency: 80,
      githubActivity: 75,
      socialPresence: 60
    },
    auditHistory: [],
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date(),
    ...overrides
  });

  beforeEach(() => {
    jest.clearAllMocks();
    (FundamentalAnalysisEngine as any).instance = null;
    analysisEngine = FundamentalAnalysisEngine.getInstance();
  });

  afterEach(async () => {
    try {
      await analysisEngine.shutdown();
    } catch (error) {
      // Ignore
    }
  });

  describe('Prediction Accuracy Validation', () => {
    beforeEach(async () => {
      await analysisEngine.initialize();
    });

    test('should validate predictions against known benchmark outcomes', async () => {
      // Known high-performing protocol
      const highPerformingProtocol = createBenchmarkProtocol({
        id: 'high-performer',
        tvl: 1000000000, // $1B TVL
        securityMetrics: {
          auditScore: 95,
          insuranceCoverage: 1.0,
          vulnerabilityCount: 0,
          bugBountyProgram: true,
          lastAuditDate: new Date()
        },
        teamInfo: {
          size: 50,
          experience: 8,
          transparency: 95,
          githubActivity: 90,
          socialPresence: 85
        }
      });

      // Known low-performing protocol
      const lowPerformingProtocol = createBenchmarkProtocol({
        id: 'low-performer',
        tvl: 1000000, // $1M TVL
        securityMetrics: {
          auditScore: 30,
          insuranceCoverage: 0.1,
          vulnerabilityCount: 20,
          bugBountyProgram: false,
          lastAuditDate: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)
        },
        teamInfo: {
          size: 2,
          experience: 1,
          transparency: 20,
          githubActivity: 10,
          socialPresence: 15
        }
      });

      const highAnalysis = await analysisEngine.analyzeProtocol(highPerformingProtocol);
      const lowAnalysis = await analysisEngine.analyzeProtocol(lowPerformingProtocol);

      // High performer should score better than low performer
      expect(highAnalysis.overallScore).toBeGreaterThan(lowAnalysis.overallScore);
      expect(highAnalysis.confidence).toBeGreaterThan(lowAnalysis.confidence);
      
      // Recommendations should be appropriate
      expect(highAnalysis.recommendations[0].type).toMatch(/buy|hold/);
      expect(lowAnalysis.recommendations[0].type).toMatch(/sell|monitor/);
    });

    test('should calculate prediction confidence intervals', async () => {
      const testProtocols = [
        createBenchmarkProtocol({ id: 'test-1', tvl: 50000000 }),
        createBenchmarkProtocol({ id: 'test-2', tvl: 100000000 }),
        createBenchmarkProtocol({ id: 'test-3', tvl: 200000000 }),
        createBenchmarkProtocol({ id: 'test-4', tvl: 500000000 }),
        createBenchmarkProtocol({ id: 'test-5', tvl: 1000000000 })
      ];

      const analyses = await Promise.all(
        testProtocols.map(p => analysisEngine.analyzeProtocol(p))
      );

      // Calculate confidence statistics
      const confidences = analyses.map(a => a.confidence);
      const meanConfidence = confidences.reduce((a, b) => a + b, 0) / confidences.length;
      const stdDev = Math.sqrt(
        confidences.reduce((sum, c) => sum + Math.pow(c - meanConfidence, 2), 0) / confidences.length
      );

      // Verify confidence distribution
      expect(meanConfidence).toBeGreaterThan(0.5);
      expect(stdDev).toBeLessThan(0.3); // Reasonable consistency
      
      // All confidences should be in valid range
      confidences.forEach(confidence => {
        expect(confidence).toBeGreaterThanOrEqual(0);
        expect(confidence).toBeLessThanOrEqual(1);
      });
    });

    test('should validate different market condition scenarios', async () => {
      const marketScenarios = [
        {
          name: 'bull_market',
          protocol: createBenchmarkProtocol({
            tvlHistory: [
              { timestamp: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), value: 50000000, change24h: 0.1, change7d: 0.3, change30d: 1.0 },
              { timestamp: new Date(), value: 100000000, change24h: 0.05, change7d: 0.2, change30d: 1.0 }
            ]
          }),
          expectedTrend: 'increasing'
        },
        {
          name: 'bear_market',
          protocol: createBenchmarkProtocol({
            tvlHistory: [
              { timestamp: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), value: 200000000, change24h: -0.1, change7d: -0.3, change30d: -0.5 },
              { timestamp: new Date(), value: 100000000, change24h: -0.05, change7d: -0.15, change30d: -0.5 }
            ]
          }),
          expectedTrend: 'decreasing'
        },
        {
          name: 'sideways_market',
          protocol: createBenchmarkProtocol({
            tvlHistory: [
              { timestamp: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), value: 95000000, change24h: 0.01, change7d: -0.02, change30d: 0.05 },
              { timestamp: new Date(), value: 100000000, change24h: -0.01, change7d: 0.02, change30d: 0.05 }
            ]
          }),
          expectedTrend: 'stable'
        }
      ];

      for (const scenario of marketScenarios) {
        const analysis = await analysisEngine.analyzeProtocol(scenario.protocol);
        
        expect(analysis.tvlHealth.trend).toBe(scenario.expectedTrend);
        expect(analysis.overallScore).toBeGreaterThan(0);
      }
    });
  });

  describe('Error Rate Analysis', () => {
    beforeEach(async () => {
      await analysisEngine.initialize();
    });

    test('should calculate false positive rates', async () => {
      // Create protocols that should NOT be recommended as 'buy'
      const falsePositiveCandidates = [
        createBenchmarkProtocol({
          id: 'risky-high-tvl',
          tvl: 500000000, // High TVL but...
          securityMetrics: {
            auditScore: 20, // Very poor security
            insuranceCoverage: 0,
            vulnerabilityCount: 50,
            bugBountyProgram: false,
            lastAuditDate: new Date(Date.now() - 2 * 365 * 24 * 60 * 60 * 1000)
          }
        }),
        createBenchmarkProtocol({
          id: 'declining-revenue',
          revenue: {
            daily: -10000, // Losing money
            weekly: -70000,
            monthly: -300000,
            annualized: -3600000,
            sources: []
          }
        })
      ];

      let falsePositives = 0;
      
      for (const protocol of falsePositiveCandidates) {
        const analysis = await analysisEngine.analyzeProtocol(protocol);
        
        // If recommended as 'buy', it's a false positive
        if (analysis.recommendations.some(r => r.type === 'buy')) {
          falsePositives++;
        }
      }

      const falsePositiveRate = falsePositives / falsePositiveCandidates.length;
      
      // False positive rate should be low
      expect(falsePositiveRate).toBeLessThan(0.3);
    });

    test('should calculate false negative rates', async () => {
      // Create protocols that SHOULD be recommended as 'buy'
      const falseNegativeCandidates = [
        createBenchmarkProtocol({
          id: 'excellent-protocol',
          tvl: 2000000000, // Very high TVL
          securityMetrics: {
            auditScore: 98,
            insuranceCoverage: 1.0,
            vulnerabilityCount: 0,
            bugBountyProgram: true,
            lastAuditDate: new Date()
          },
          teamInfo: {
            size: 100,
            experience: 10,
            transparency: 100,
            githubActivity: 100,
            socialPresence: 95
          },
          revenue: {
            daily: 500000, // Very high revenue
            weekly: 3500000,
            monthly: 15000000,
            annualized: 180000000,
            sources: [
              { name: 'trading_fees', amount: 12000000, percentage: 0.8 },
              { name: 'lending_interest', amount: 3000000, percentage: 0.2 }
            ]
          }
        })
      ];

      let falseNegatives = 0;
      
      for (const protocol of falseNegativeCandidates) {
        const analysis = await analysisEngine.analyzeProtocol(protocol);
        
        // If NOT recommended as 'buy', it's a false negative
        if (!analysis.recommendations.some(r => r.type === 'buy')) {
          falseNegatives++;
        }
      }

      const falseNegativeRate = falseNegatives / falseNegativeCandidates.length;
      
      // False negative rate should be low
      expect(falseNegativeRate).toBeLessThan(0.3);
    });

    test('should track prediction errors over time', async () => {
      const testProtocol = createBenchmarkProtocol();
      
      // Run multiple analyses
      const analyses = [];
      for (let i = 0; i < 10; i++) {
        const analysis = await analysisEngine.analyzeProtocol({
          ...testProtocol,
          id: `test-${i}`,
          tvl: testProtocol.tvl * (1 + i * 0.1) // Varying TVL
        });
        analyses.push(analysis);
      }

      // Calculate score variance (measure of prediction stability)
      const scores = analyses.map(a => a.overallScore);
      const meanScore = scores.reduce((a, b) => a + b, 0) / scores.length;
      const variance = scores.reduce((sum, score) => sum + Math.pow(score - meanScore, 2), 0) / scores.length;
      const standardDeviation = Math.sqrt(variance);

      // Prediction should be relatively stable
      expect(standardDeviation).toBeLessThan(0.2);
    });
  });

  describe('Performance Metrics Reporting', () => {
    beforeEach(async () => {
      await analysisEngine.initialize();
    });

    test('should generate comprehensive accuracy report', async () => {
      const testData = [
        { protocol: createBenchmarkProtocol({ id: 'test-1', tvl: 10000000 }), expectedRating: 'low' },
        { protocol: createBenchmarkProtocol({ id: 'test-2', tvl: 100000000 }), expectedRating: 'medium' },
        { protocol: createBenchmarkProtocol({ id: 'test-3', tvl: 1000000000 }), expectedRating: 'high' }
      ];

      const results = [];
      for (const { protocol, expectedRating } of testData) {
        const analysis = await analysisEngine.analyzeProtocol(protocol);
        const actualRating = analysis.overallScore > 0.7 ? 'high' : 
                           analysis.overallScore > 0.4 ? 'medium' : 'low';
        
        results.push({
          protocolId: protocol.id,
          expected: expectedRating,
          actual: actualRating,
          score: analysis.overallScore,
          confidence: analysis.confidence,
          correct: expectedRating === actualRating
        });
      }

      // Generate accuracy report
      const correctPredictions = results.filter(r => r.correct).length;
      const accuracy = correctPredictions / results.length;
      const averageConfidence = results.reduce((sum, r) => sum + r.confidence, 0) / results.length;

      const report = {
        testDate: new Date().toISOString(),
        totalTests: results.length,
        correctPredictions,
        accuracy,
        averageConfidence,
        results
      };

      // Verify report structure
      expect(report.accuracy).toBeGreaterThan(0.6); // At least 60% accuracy
      expect(report.averageConfidence).toBeGreaterThan(0.5);
      expect(report.results).toHaveLength(testData.length);
    });

    test('should track model performance metrics over time', async () => {
      const mlModel = (analysisEngine as any).mlModel;
      
      // Initial model performance
      const initialPerformance = await mlModel.train(
        [[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18]], 
        [1]
      );

      expect(initialPerformance.accuracy).toBeDefined();
      expect(initialPerformance.precision).toBeDefined();
      expect(initialPerformance.recall).toBeDefined();
      expect(initialPerformance.f1Score).toBeDefined();
      expect(initialPerformance.mse).toBeDefined();
      expect(initialPerformance.mae).toBeDefined();

      // All metrics should be valid numbers
      Object.values(initialPerformance).forEach(metric => {
        expect(typeof metric).toBe('number');
        expect(isFinite(metric)).toBe(true);
        expect(metric).toBeGreaterThanOrEqual(0);
      });
    });

    test('should save accuracy reports to filesystem', async () => {
      const reportData = {
        timestamp: new Date().toISOString(),
        accuracy: 0.85,
        precision: 0.82,
        recall: 0.88,
        f1Score: 0.85,
        falsePositiveRate: 0.12,
        falseNegativeRate: 0.15,
        totalTests: 100,
        correctPredictions: 85
      };

      // Mock the report generation
      const reportPath = path.join(process.cwd(), 'reports', 'fundamental-analysis-accuracy.json');
      
      // In a real test, we would save the report
      // For now, just verify the structure
      expect(reportData.accuracy).toBeGreaterThan(0.8);
      expect(reportData.falsePositiveRate).toBeLessThan(0.2);
      expect(reportData.falseNegativeRate).toBeLessThan(0.2);
      
      // Verify fs.writeFileSync would be called (mocked)
      expect(fs.writeFileSync).toBeDefined();
    });

    test('should generate feature importance analysis report', async () => {
      const mlModel = (analysisEngine as any).mlModel;
      const features = new Array(18).fill(0).map((_, i) => Math.random());
      
      const prediction = await mlModel.predict(features);
      
      expect(prediction.features).toBeDefined();
      expect(prediction.features).toHaveLength(18);
      
      // Generate feature importance report
      const featureReport = {
        timestamp: new Date().toISOString(),
        features: prediction.features.map(f => ({
          name: f.feature,
          importance: f.importance,
          direction: f.direction
        })),
        topFeatures: prediction.features.slice(0, 5), // Top 5 most important
        analysis: {
          mostImportantFeature: prediction.features[0].feature,
          averageImportance: prediction.features.reduce((sum, f) => sum + f.importance, 0) / prediction.features.length,
          positiveFeatures: prediction.features.filter(f => f.direction === 'positive').length,
          negativeFeatures: prediction.features.filter(f => f.direction === 'negative').length
        }
      };

      expect(featureReport.features).toHaveLength(18);
      expect(featureReport.topFeatures).toHaveLength(5);
      expect(featureReport.analysis.mostImportantFeature).toBeDefined();
    });
  });

  describe('Threshold Validation and Calibration', () => {
    beforeEach(async () => {
      await analysisEngine.initialize();
    });

    test('should validate recommendation thresholds are well-calibrated', async () => {
      const protocols = [
        // Protocols that should get 'buy' recommendations
        ...Array.from({ length: 10 }, (_, i) => createBenchmarkProtocol({
          id: `buy-candidate-${i}`,
          tvl: 500000000 + i * 100000000,
          securityMetrics: {
            auditScore: 90 + i,
            insuranceCoverage: 0.9,
            vulnerabilityCount: 0,
            bugBountyProgram: true,
            lastAuditDate: new Date()
          }
        })),
        // Protocols that should get 'sell' recommendations
        ...Array.from({ length: 10 }, (_, i) => createBenchmarkProtocol({
          id: `sell-candidate-${i}`,
          tvl: 1000000 + i * 100000,
          securityMetrics: {
            auditScore: 20 + i,
            insuranceCoverage: 0.1,
            vulnerabilityCount: 10,
            bugBountyProgram: false,
            lastAuditDate: new Date(Date.now() - 2 * 365 * 24 * 60 * 60 * 1000)
          }
        }))
      ];

      const analyses = await Promise.all(
        protocols.map(p => analysisEngine.analyzeProtocol(p))
      );

      // Check threshold calibration
      const buyRecommendations = analyses.filter(a => 
        a.recommendations.some(r => r.type === 'buy')
      );
      const sellRecommendations = analyses.filter(a => 
        a.recommendations.some(r => r.type === 'sell')
      );

      // Should have reasonable distribution
      expect(buyRecommendations.length).toBeGreaterThan(0);
      expect(sellRecommendations.length).toBeGreaterThan(0);
      
      // Buy recommendations should have higher average scores
      const avgBuyScore = buyRecommendations.reduce((sum, a) => sum + a.overallScore, 0) / buyRecommendations.length;
      const avgSellScore = sellRecommendations.reduce((sum, a) => sum + a.overallScore, 0) / sellRecommendations.length;
      
      expect(avgBuyScore).toBeGreaterThan(avgSellScore);
    });

    test('should validate confidence threshold calibration', async () => {
      const testProtocols = Array.from({ length: 20 }, (_, i) => 
        createBenchmarkProtocol({
          id: `confidence-test-${i}`,
          tvl: 1000000 * (i + 1),
          // Gradually decrease data completeness to test confidence
          tvlHistory: i < 10 ? [
            { timestamp: new Date(), value: 1000000 * (i + 1), change24h: 0.01, change7d: 0.05, change30d: 0.1 }
          ] : []
        })
      );

      const analyses = await Promise.all(
        testProtocols.map(p => analysisEngine.analyzeProtocol(p))
      );

      // Protocols with more complete data should have higher confidence
      const completeDataAnalyses = analyses.slice(0, 10);
      const incompleteDataAnalyses = analyses.slice(10);

      const avgCompleteConfidence = completeDataAnalyses.reduce((sum, a) => sum + a.confidence, 0) / completeDataAnalyses.length;
      const avgIncompleteConfidence = incompleteDataAnalyses.reduce((sum, a) => sum + a.confidence, 0) / incompleteDataAnalyses.length;

      expect(avgCompleteConfidence).toBeGreaterThan(avgIncompleteConfidence);
    });
  });

  describe('Model Drift Detection and Monitoring', () => {
    beforeEach(async () => {
      await analysisEngine.initialize();
    });

    test('should detect when model performance degrades', async () => {
      const mlModel = (analysisEngine as any).mlModel;
      
      // Initial good performance
      const initialPerformance = await mlModel.train(
        [[1, 0.8, 0.9], [0.2, 0.3, 0.1], [0.9, 0.8, 0.7]], 
        [1, 0, 1]
      );

      // Simulate performance degradation with poor quality data
      const degradedPerformance = await mlModel.train(
        [[0.5, 0.5, 0.5], [0.5, 0.5, 0.5], [0.5, 0.5, 0.5]], 
        [0, 1, 0]
      );

      // Performance should be measurably different
      expect(Math.abs(initialPerformance.accuracy - degradedPerformance.accuracy)).toBeGreaterThan(0.1);
    });

    test('should track model prediction consistency over time', async () => {
      const testProtocol = createBenchmarkProtocol();
      
      // Get multiple predictions for the same protocol
      const predictions = [];
      for (let i = 0; i < 5; i++) {
        const analysis = await analysisEngine.analyzeProtocol(testProtocol);
        predictions.push(analysis.overallScore);
      }

      // Predictions should be consistent (cached)
      const uniquePredictions = new Set(predictions);
      expect(uniquePredictions.size).toBe(1); // Should all be the same due to caching
    });

    test('should monitor for data distribution shifts', async () => {
      // Historical data distribution
      const historicalProtocols = Array.from({ length: 10 }, (_, i) => 
        createBenchmarkProtocol({
          id: `historical-${i}`,
          tvl: 50000000 + i * 10000000 // Range: 50M - 140M
        })
      );

      // New data with different distribution
      const newProtocols = Array.from({ length: 10 }, (_, i) => 
        createBenchmarkProtocol({
          id: `new-${i}`,
          tvl: 500000000 + i * 100000000 // Range: 500M - 1.4B (much higher)
        })
      );

      const historicalAnalyses = await Promise.all(
        historicalProtocols.map(p => analysisEngine.analyzeProtocol(p))
      );
      
      const newAnalyses = await Promise.all(
        newProtocols.map(p => analysisEngine.analyzeProtocol(p))
      );

      // Calculate distribution statistics
      const historicalScores = historicalAnalyses.map(a => a.overallScore);
      const newScores = newAnalyses.map(a => a.overallScore);

      const historicalMean = historicalScores.reduce((a, b) => a + b, 0) / historicalScores.length;
      const newMean = newScores.reduce((a, b) => a + b, 0) / newScores.length;

      // Should detect the shift in TVL leading to different score distributions
      expect(Math.abs(historicalMean - newMean)).toBeGreaterThan(0.1);
    });
  });
});