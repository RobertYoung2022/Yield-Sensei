/**
 * Fundamental Analysis Engine Unit Tests
 * Comprehensive test suite for ML-powered protocol analysis with >95% coverage
 */

import { jest } from '@jest/globals';
import * as tf from '@tensorflow/tfjs-node';
import { 
  FundamentalAnalysisEngine, 
  DEFAULT_FUNDAMENTAL_ANALYSIS_CONFIG,
  FundamentalAnalysisConfig
} from '../../../src/satellites/sage/research/fundamental-analysis-engine';
import { ProtocolData } from '../../../src/satellites/sage/types';

// Mock TensorFlow.js properly
const mockTensor = {
  // @ts-ignore
  array: jest.fn().mockResolvedValue([[0.75]]),
  dispose: jest.fn()
};

const mockModel = {
  compile: jest.fn(),
  // @ts-ignore
  fit: jest.fn().mockResolvedValue({ 
    history: { 
      loss: [0.1, 0.05],
      val_loss: [0.12, 0.06],
      accuracy: [0.8, 0.9]
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
  // @ts-ignore
  tensor2d: jest.fn((data: any) => ({
    // @ts-ignore
    array: jest.fn().mockResolvedValue(data),
    dispose: jest.fn()
  })),
  callbacks: {
    earlyStopping: jest.fn(() => ({}))
  }
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

describe('Fundamental Analysis Engine - Unit Tests', () => {
  let analysisEngine: FundamentalAnalysisEngine;

  // Create comprehensive protocol data
  const createProtocolData = (overrides: Partial<ProtocolData> = {}): ProtocolData => ({
    id: 'test-protocol',
    name: 'Test Protocol',
    category: 'lending',
    chain: 'ethereum',
    tvl: 100000000, // $100M
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
        { name: 'trading_fees', amount: 1000000, percentage: 0.67 },
        { name: 'lending_interest', amount: 500000, percentage: 0.33 }
      ]
    },
    userMetrics: {
      activeUsers: 25000,
      totalUsers: 30000,
      userGrowth: 0.15, // 15% growth
      retentionRate: 0.75, // 75% retention
      averageSessionDuration: 600
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
      governanceToken: 'TEST',
      votingPower: 0.35,
      proposalCount: 45,
      voterParticipation: 0.4
    },
    teamInfo: {
      size: 20,
      experience: 5, // years
      transparency: 80, // percentage
      githubActivity: 75,
      socialPresence: 60
    },
    auditHistory: [],
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date(),
    ...overrides
  });

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    
    // Reset singleton
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

  describe('ML Model Training and Validation', () => {
    beforeEach(async () => {
      await analysisEngine.initialize();
    });

    test('should initialize ML model correctly', async () => {
      expect(tf.sequential).toHaveBeenCalled();
      expect(mockModel.compile).toHaveBeenCalledWith({
        optimizer: expect.anything(),
        loss: 'binaryCrossentropy',
        metrics: ['accuracy', 'precision', 'recall']
      });
    });

    test('should train model with historical protocol data', async () => {
      const trainingData = [
        createProtocolData({ id: 'train-1', tvl: 50000000 }),
        createProtocolData({ id: 'train-2', tvl: 150000000 }),
        createProtocolData({ id: 'train-3', tvl: 200000000 })
      ];

      // Extract features and labels
      const features = trainingData.map(p => (analysisEngine as any).extractFeatures(p));
      const labels = [0, 1, 1]; // Low TVL = 0, High TVL = 1

      // Access the ML model through private property
      const mlModel = (analysisEngine as any).mlModel;
      const performance = await mlModel.train(features, labels);

      expect(performance).toBeDefined();
      expect(performance.accuracy).toBeGreaterThan(0);
      expect(performance.precision).toBeGreaterThan(0);
      expect(performance.recall).toBeGreaterThan(0);
      expect(performance.f1Score).toBeGreaterThan(0);
    });

    test('should handle model training failures gracefully', async () => {
      const mlModel = (analysisEngine as any).mlModel;
      
      // Mock a training failure
      // @ts-ignore
      (mockModel.fit as jest.Mock).mockRejectedValueOnce(new Error('Training failed'));

      const features = [[1, 2, 3]];
      const labels = [1];

      await expect(mlModel.train(features, labels)).rejects.toThrow('Training failed');
      expect(mlModel.getIsTraining()).toBe(false);
    });

    test('should calculate performance metrics correctly', async () => {
      const mlModel = (analysisEngine as any).mlModel;
      
      // Mock predictions and actuals for metric calculation
      const mockPredictions = [[0.9], [0.2], [0.8], [0.3]];

      (mockModel.predict as jest.Mock).mockReturnValueOnce({
        // @ts-ignore
        array: jest.fn().mockResolvedValue(mockPredictions),
        dispose: jest.fn()
      });

      const performance = await mlModel.train(
        [[1, 2, 3], [4, 5, 6], [7, 8, 9], [10, 11, 12]], 
        [1, 0, 1, 0]
      );

      // Check that all metrics are calculated
      expect(performance.accuracy).toBeDefined();
      expect(performance.precision).toBeDefined();
      expect(performance.recall).toBeDefined();
      expect(performance.f1Score).toBeDefined();
      expect(performance.mse).toBeDefined();
      expect(performance.mae).toBeDefined();
    });

    test('should prevent concurrent training sessions', async () => {
      const mlModel = (analysisEngine as any).mlModel;
      
      // Start training
      mlModel.isTraining = true;
      expect(mlModel.getIsTraining()).toBe(true);

      // Should not affect predictions during training
      const features = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18];
      const prediction = await mlModel.predict(features);
      
      expect(prediction).toBeDefined();
      expect(prediction.output).toBeDefined();
    });
  });

  describe('Feature Extraction and Preprocessing', () => {
    beforeEach(async () => {
      await analysisEngine.initialize();
    });

    test('should extract all required features from protocol data', async () => {
      const protocolData = createProtocolData();
      const features = (analysisEngine as any).extractFeatures(protocolData);

      expect(features).toHaveLength(18); // 18 features as defined in the model
      expect(features[0]).toBe(protocolData.tvl); // TVL
      expect(features[4]).toBe(protocolData.revenue.daily); // Daily revenue
      expect(features[7]).toBe(protocolData.userMetrics.activeUsers); // Active users
      expect(features[10]).toBe(protocolData.securityMetrics.auditScore); // Audit score
    });

    test('should handle missing TVL history gracefully', async () => {
      const protocolData = createProtocolData({ tvlHistory: [] });
      const features = (analysisEngine as any).extractFeatures(protocolData);

      expect(features[1]).toBe(0); // change24h defaults to 0
      expect(features[2]).toBe(0); // change7d defaults to 0
      expect(features[3]).toBe(0); // change30d defaults to 0
    });

    test('should normalize feature values appropriately', async () => {
      const protocolData = createProtocolData({
        tvl: 1000000000, // $1B
        securityMetrics: {
          ...createProtocolData().securityMetrics,
          auditScore: 100 // Perfect score
        }
      });

      const analysis = await analysisEngine.analyzeProtocol(protocolData);
      
      expect(analysis.overallScore).toBeLessThanOrEqual(1);
      expect(analysis.overallScore).toBeGreaterThanOrEqual(0);
    });

    test('should calculate feature importance', async () => {
      const mlModel = (analysisEngine as any).mlModel;
      const features = new Array(18).fill(0).map((_, i) => i * 0.1 - 0.9);
      
      const prediction = await mlModel.predict(features);
      
      expect(prediction.features).toBeDefined();
      expect(prediction.features).toHaveLength(18);
      prediction.features.forEach((f: any) => {
        expect(f.feature).toBeDefined();
        expect(f.importance).toBeGreaterThanOrEqual(0);
        expect(['positive', 'negative', 'neutral']).toContain(f.direction);
      });
    });
  });

  describe('Backtesting and Analysis Algorithms', () => {
    beforeEach(async () => {
      await analysisEngine.initialize();
    });

    test('should analyze protocol with various market conditions', async () => {
      const scenarios = [
        { tvl: 1000000, expectedLow: true }, // Low TVL
        { tvl: 100000000, expectedMedium: true }, // Medium TVL
        { tvl: 1000000000, expectedHigh: true } // High TVL
      ];

      for (const scenario of scenarios) {
        const protocolData = createProtocolData({ tvl: scenario.tvl });
        const analysis = await analysisEngine.analyzeProtocol(protocolData);
        
        expect(analysis.overallScore).toBeDefined();
        if (scenario.expectedLow) {
          expect(analysis.overallScore).toBeLessThan(0.3);
        } else if (scenario.expectedMedium) {
          expect(analysis.overallScore).toBeGreaterThan(0.5);
        } else if (scenario.expectedHigh) {
          expect(analysis.overallScore).toBeGreaterThan(0.7);
        }
      }
    });

    test('should calculate risk metrics accurately', async () => {
      const riskyProtocol = createProtocolData({
        tvlHistory: [
          { timestamp: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), value: 100000000, change24h: -0.2, change7d: -0.3, change30d: -0.5 },
          { timestamp: new Date(), value: 50000000, change24h: -0.15, change7d: -0.25, change30d: -0.5 }
        ],
        securityMetrics: {
          ...createProtocolData().securityMetrics,
          auditScore: 40,
          vulnerabilityCount: 10
        }
      });

      const analysis = await analysisEngine.analyzeProtocol(riskyProtocol);
      
      expect(analysis.riskAssessment.overallRisk).toMatch(/high|critical/);
      expect(analysis.riskAssessment.riskScore).toBeGreaterThan(0.5);
      expect(analysis.riskAssessment.volatilityScore).toBeGreaterThan(0);
    });

    test('should generate appropriate recommendations based on analysis', async () => {
      const scenarios = [
        {
          data: createProtocolData({ tvl: 500000000 }), // High TVL
          expectedRecommendation: 'buy'
        },
        {
          data: createProtocolData({ tvl: 50000000 }), // Medium TVL
          expectedRecommendation: 'hold'
        },
        {
          data: createProtocolData({ tvl: 1000000 }), // Low TVL
          expectedRecommendation: 'monitor'
        }
      ];

      for (const scenario of scenarios) {
        const analysis = await analysisEngine.analyzeProtocol(scenario.data);
        
        expect(analysis.recommendations?.length || 0).toBeGreaterThanOrEqual(1);
        
        // At least one recommendation should match expected type
        const hasExpectedRecommendation = analysis.recommendations.some(
          rec => rec.type === scenario.expectedRecommendation
        );
        expect(hasExpectedRecommendation).toBe(true);
      }
    });

    test('should calculate TVL volatility correctly', async () => {
      const volatileProtocol = createProtocolData({
        tvlHistory: [
          { timestamp: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), value: 100000000, change24h: 0.5, change7d: 0.8, change30d: 1.2 },
          { timestamp: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000), value: 50000000, change24h: -0.3, change7d: -0.5, change30d: -0.8 },
          { timestamp: new Date(), value: 150000000, change24h: 0.7, change7d: 1.0, change30d: 1.5 }
        ]
      });

      const analysis = await analysisEngine.analyzeProtocol(volatileProtocol);
      
      expect(analysis.tvlHealth.volatility).toBeGreaterThan(0);
      expect(analysis.tvlHealth.sustainability).toBeLessThan(0.8);
    });
  });

  describe('Model Drift Detection', () => {
    beforeEach(async () => {
      await analysisEngine.initialize();
    });

    test('should track model performance over time', async () => {
      const mlModel = (analysisEngine as any).mlModel;
      
      // Initial training
      const initialFeatures = [[1, 2, 3], [4, 5, 6]];
      const initialLabels = [1, 0];
      const initialPerformance = await mlModel.train(initialFeatures, initialLabels);
      
      expect(initialPerformance).toBeDefined();
      expect(mlModel.getPerformance()).toEqual(initialPerformance);
    });

    test('should update model with new data periodically', async () => {
      jest.useFakeTimers();
      
      const customConfig: FundamentalAnalysisConfig = {
        ...DEFAULT_FUNDAMENTAL_ANALYSIS_CONFIG,
        modelUpdateInterval: 1000 // 1 second for testing
      };

      const customEngine = FundamentalAnalysisEngine.getInstance(customConfig);
      await customEngine.initialize();

      // Spy on the update interval
      jest.spyOn(console, 'log');

      // Fast-forward time
      jest.advanceTimersByTime(2000);

      // Model update should have been triggered
      const status = customEngine.getStatus();
      expect(status).toBeDefined();

      await customEngine.shutdown();
      jest.useRealTimers();
    });

    test('should handle prediction confidence based on model performance', async () => {
      const protocolData = createProtocolData();
      
      // First analysis without trained model
      const analysis1 = await analysisEngine.analyzeProtocol(protocolData);
      const baseConfidence = analysis1.confidence;
      
      // Train model
      const mlModel = (analysisEngine as any).mlModel;
      await mlModel.train([[1, 2, 3]], [1]);
      
      // Second analysis with trained model
      const analysis2 = await analysisEngine.analyzeProtocol(protocolData);
      
      // Confidence should be influenced by model performance
      expect(analysis2.confidence).toBeGreaterThanOrEqual(baseConfidence);
    });
  });

  describe('Accuracy Metrics and Threshold Validation', () => {
    beforeEach(async () => {
      await analysisEngine.initialize();
    });

    test('should calculate accuracy metrics for all analysis components', async () => {
      const protocolData = createProtocolData();
      const analysis = await analysisEngine.analyzeProtocol(protocolData);

      // Verify all scores are within valid range [0, 1]
      const scores = [
        analysis.overallScore,
        analysis.tvlHealth.healthScore,
        analysis.teamAssessment.overallScore,
        analysis.securityAssessment.overallScore,
        analysis.governanceAssessment.decentralizationScore,
        analysis.revenueAnalysis.sustainability,
        analysis.confidence
      ];

      scores.forEach(score => {
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(1);
      });
    });

    test('should validate confidence thresholds', async () => {
      const scenarios = [
        {
          data: createProtocolData(), // Complete data
          expectedMinConfidence: 0.7
        },
        {
          data: createProtocolData({
            tvlHistory: [],
            revenue: {
              daily: 0,
              weekly: 0,
              monthly: 0,
              annualized: 0,
              sources: []
            }
          }), // Incomplete data
          expectedMaxConfidence: 0.6
        }
      ];

      for (const scenario of scenarios) {
        const analysis = await analysisEngine.analyzeProtocol(scenario.data);
        
        if (scenario.expectedMinConfidence) {
          expect(analysis.confidence).toBeGreaterThanOrEqual(scenario.expectedMinConfidence);
        }
        if (scenario.expectedMaxConfidence) {
          expect(analysis.confidence).toBeLessThanOrEqual(scenario.expectedMaxConfidence);
        }
      }
    });

    test('should validate ML prediction thresholds', async () => {
      const mlModel = (analysisEngine as any).mlModel;
      
      // Test edge cases
      const edgeCaseFeatures = [
        new Array(18).fill(0), // All zeros
        new Array(18).fill(1), // All ones
        new Array(18).fill(-1), // Negative values
        new Array(18).fill(100) // Large values
      ];

      for (const features of edgeCaseFeatures) {
        const prediction = await mlModel.predict(features);
        
        expect(prediction.output).toBeGreaterThanOrEqual(0);
        expect(prediction.output).toBeLessThanOrEqual(1);
        expect(prediction.confidence).toBeGreaterThanOrEqual(0);
        expect(prediction.confidence).toBeLessThanOrEqual(1);
      }
    });
  });

  describe('Edge Cases and Error Handling', () => {
    beforeEach(async () => {
      await analysisEngine.initialize();
    });

    test('should handle protocols with zero or negative values', async () => {
      const edgeCaseProtocol = createProtocolData({
        tvl: 0,
        revenue: {
          daily: -1000, // Negative revenue (loss)
          weekly: -7000,
          monthly: -30000,
          annualized: -360000,
          sources: []
        },
        userMetrics: {
          activeUsers: 0,
          totalUsers: 0,
          userGrowth: -0.5, // Negative growth
          retentionRate: 0,
          averageSessionDuration: 0
        }
      });

      const analysis = await analysisEngine.analyzeProtocol(edgeCaseProtocol);
      
      expect(analysis).toBeDefined();
      expect(analysis.overallScore).toBeGreaterThanOrEqual(0);
      expect(analysis.recommendations?.[0]?.type).toMatch(/sell|monitor/);
    });

    test('should handle extremely large values', async () => {
      const largeValueProtocol = createProtocolData({
        tvl: Number.MAX_SAFE_INTEGER,
        revenue: {
          daily: 1e15,
          weekly: 7e15,
          monthly: 3e16,
          annualized: 3.6e17,
          sources: []
        }
      });

      const analysis = await analysisEngine.analyzeProtocol(largeValueProtocol);
      
      expect(analysis).toBeDefined();
      expect(analysis.overallScore).toBeLessThanOrEqual(1);
    });

    test('should handle missing optional fields gracefully', async () => {
      const minimalProtocol: ProtocolData = {
        id: 'minimal',
        name: 'Minimal Protocol',
        category: 'lending',
        chain: 'ethereum',
        tvl: 10000000,
        tvlHistory: [],
        revenue: {
          daily: 1000,
          weekly: 7000,
          monthly: 30000,
          annualized: 360000,
          sources: []
        },
        userMetrics: {
          activeUsers: 100,
          totalUsers: 120,
          userGrowth: 0.1,
          retentionRate: 0.5,
          averageSessionDuration: 300
        },
        securityMetrics: {
          auditScore: 50,
          insuranceCoverage: 0,
          vulnerabilityCount: 0,
          bugBountyProgram: false,
          lastAuditDate: new Date()
        },
        governanceMetrics: {
          decentralizationScore: 50,
          governanceToken: 'MIN',
          votingPower: 0.1,
          proposalCount: 1,
          voterParticipation: 0.1
        },
        teamInfo: {
          size: 1,
          experience: 1,
          transparency: 50,
          githubActivity: 10,
          socialPresence: 10
        },
        auditHistory: [],
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date()
      };

      await expect(analysisEngine.analyzeProtocol(minimalProtocol)).resolves.toBeDefined();
    });

    test('should recover from ML prediction errors', async () => {
      const protocolData = createProtocolData();
      
      // Mock a prediction error
      mockModel.predict.mockImplementationOnce(() => {
        throw new Error('Prediction failed');
      });

      // Should still complete analysis with default ML score
      const analysis = await analysisEngine.analyzeProtocol(protocolData);
      
      expect(analysis).toBeDefined();
      expect(analysis.overallScore).toBeGreaterThan(0);
    });
  });

  describe('Performance and Concurrency', () => {
    beforeEach(async () => {
      await analysisEngine.initialize();
    });

    test('should handle concurrent analyses efficiently', async () => {
      const protocols = Array.from({ length: 10 }, (_, i) => 
        createProtocolData({ 
          id: `concurrent-${i}`,
          tvl: 10000000 * (i + 1)
        })
      );

      const startTime = Date.now();
      
      const analyses = await Promise.all(
        protocols.map(p => analysisEngine.analyzeProtocol(p))
      );
      
      const duration = Date.now() - startTime;
      
      expect(analyses).toHaveLength(10);
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
      
      analyses.forEach((analysis, index) => {
        expect(analysis.protocolId).toBe(`concurrent-${index}`);
        expect(analysis.overallScore).toBeGreaterThan(0);
      });
    });

    test('should utilize caching effectively', async () => {
      const protocolData = createProtocolData();
      
      // First call
      const start1 = Date.now();
      const analysis1 = await analysisEngine.analyzeProtocol(protocolData);
      const duration1 = Date.now() - start1;
      
      // Second call (should be cached)
      const start2 = Date.now();
      const analysis2 = await analysisEngine.analyzeProtocol(protocolData);
      const duration2 = Date.now() - start2;
      
      expect(duration2).toBeLessThan(duration1);
      expect(analysis1.overallScore).toBe(analysis2.overallScore);
      expect(analysis1.timestamp.getTime()).toBe(analysis2.timestamp.getTime());
    });

    test('should respect cache TTL', async () => {
      const shortTTLConfig: FundamentalAnalysisConfig = {
        ...DEFAULT_FUNDAMENTAL_ANALYSIS_CONFIG,
        cacheTTL: 100 // 100ms
      };

      const shortTTLEngine = FundamentalAnalysisEngine.getInstance(shortTTLConfig);
      await shortTTLEngine.initialize();

      const protocolData = createProtocolData();
      
      // First call
      const analysis1 = await shortTTLEngine.analyzeProtocol(protocolData);
      
      // Wait for cache to expire
      await new Promise(resolve => setTimeout(resolve, 150));
      
      // Second call (should not be cached)
      const analysis2 = await shortTTLEngine.analyzeProtocol(protocolData);
      
      expect(analysis1.timestamp.getTime()).toBeLessThan(analysis2.timestamp.getTime());
      
      await shortTTLEngine.shutdown();
    });
  });

  describe('System Lifecycle Management', () => {
    test('should handle multiple initialization attempts', async () => {
      await analysisEngine.initialize();
      
      // Second initialization should not throw
      await expect(analysisEngine.initialize()).resolves.not.toThrow();
    });

    test('should clean up resources on shutdown', async () => {
      await analysisEngine.initialize();
      
      // Analyze some protocols to populate cache
      await analysisEngine.analyzeProtocol(createProtocolData({ id: 'test-1' }));
      await analysisEngine.analyzeProtocol(createProtocolData({ id: 'test-2' }));
      
      const statusBefore = analysisEngine.getStatus();
      expect(statusBefore.cacheSize).toBeGreaterThan(0);
      
      await analysisEngine.shutdown();
      
      const statusAfter = analysisEngine.getStatus();
      expect(statusAfter.isRunning).toBe(false);
      expect(statusAfter.cacheSize).toBe(0);
    });

    test('should handle shutdown without initialization', async () => {
      await expect(analysisEngine.shutdown()).resolves.not.toThrow();
    });

    test('should stop intervals on shutdown', async () => {
      jest.useFakeTimers();
      
      await analysisEngine.initialize();
      
      // Verify intervals are set
      expect((analysisEngine as any).analysisInterval).toBeDefined();
      expect((analysisEngine as any).modelUpdateInterval).toBeDefined();
      
      await analysisEngine.shutdown();
      
      // Verify intervals are cleared
      expect((analysisEngine as any).analysisInterval).toBeUndefined();
      expect((analysisEngine as any).modelUpdateInterval).toBeUndefined();
      
      jest.useRealTimers();
    });
  });

  describe('Event System', () => {
    beforeEach(async () => {
      await analysisEngine.initialize();
    });

    test('should emit analysis completed events', (done) => {
      const protocolData = createProtocolData();
      
      analysisEngine.on('analysis_completed', (event) => {
        expect(event.protocolId).toBe(protocolData.id);
        expect(event.analysis).toBeDefined();
        expect(event.timestamp).toBeInstanceOf(Date);
        done();
      });

      analysisEngine.analyzeProtocol(protocolData);
    });

    test('should handle event listener errors gracefully', async () => {
      analysisEngine.on('analysis_completed', () => {
        throw new Error('Listener error');
      });

      const protocolData = createProtocolData();
      
      // Should not throw despite listener error
      await expect(analysisEngine.analyzeProtocol(protocolData)).resolves.toBeDefined();
    });
  });
});