/**
 * Fundamental Analysis Engine - Edge Cases and Coverage Tests
 * Tests for edge cases, error conditions, and uncovered code paths
 */

import { jest } from '@jest/globals';
import { 
  FundamentalAnalysisEngine,
  DEFAULT_FUNDAMENTAL_ANALYSIS_CONFIG,
  FundamentalAnalysisConfig
} from '../../../src/satellites/sage/research/fundamental-analysis-engine';
import { ProtocolData } from '../../../src/satellites/sage/types';

// Mock TensorFlow with more comprehensive mocking
const mockTensor = {
  array: jest.fn().mockResolvedValue([[0.75]]),
  dispose: jest.fn()
};

const mockModel = {
  compile: jest.fn(),
  fit: jest.fn().mockResolvedValue({ 
    history: { 
      loss: [0.3, 0.2, 0.1],
      val_loss: [0.35, 0.25, 0.15],
      accuracy: [0.7, 0.8, 0.9]
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

describe('Fundamental Analysis Engine - Edge Cases and Coverage', () => {
  let analysisEngine: FundamentalAnalysisEngine;

  const createMinimalProtocol = (overrides: Partial<ProtocolData> = {}): ProtocolData => ({
    id: 'minimal-protocol',
    name: 'Minimal Protocol',
    category: 'lending',
    chain: 'ethereum',
    tvl: 1000000,
    tvlHistory: [],
    revenue: {
      daily: 100,
      weekly: 700,
      monthly: 3000,
      annualized: 36000,
      sources: []
    },
    userMetrics: {
      activeUsers: 100,
      userGrowth: 0,
      retentionRate: 0.5,
      averagePositionSize: 1000
    },
    securityMetrics: {
      auditScore: 50,
      insuranceCoverage: 0,
      vulnerabilityCount: 5,
      bugBountyProgram: false,
      lastAuditDate: new Date()
    },
    governanceMetrics: {
      decentralizationScore: 50,
      voterParticipation: 0.1,
      proposalCount: 0,
      averageQuorum: 0.05
    },
    teamInfo: {
      size: 1,
      experience: 1,
      transparency: 30,
      githubActivity: 5,
      socialPresence: 10
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

  describe('Extreme Value Handling', () => {
    beforeEach(async () => {
      await analysisEngine.initialize();
    });

    test('should handle zero and negative values', async () => {
      const extremeProtocol = createMinimalProtocol({
        tvl: 0,
        revenue: {
          daily: -1000,
          weekly: -7000,
          monthly: -30000,
          annualized: -360000,
          sources: []
        },
        userMetrics: {
          activeUsers: 0,
          userGrowth: -1, // -100% growth
          retentionRate: 0,
          averagePositionSize: 0
        }
      });

      const analysis = await analysisEngine.analyzeProtocol(extremeProtocol);
      
      expect(analysis).toBeDefined();
      expect(analysis.overallScore).toBeGreaterThanOrEqual(0);
      expect(analysis.overallScore).toBeLessThanOrEqual(1);
    });

    test('should handle extremely large values', async () => {
      const extremeProtocol = createMinimalProtocol({
        tvl: Number.MAX_SAFE_INTEGER,
        revenue: {
          daily: 1e15,
          weekly: 7e15,
          monthly: 30e15,
          annualized: 365e15,
          sources: []
        },
        userMetrics: {
          activeUsers: Number.MAX_SAFE_INTEGER,
          userGrowth: 1000, // 100,000% growth
          retentionRate: 10, // > 1 (invalid but should be handled)
          averagePositionSize: 1e20
        }
      });

      const analysis = await analysisEngine.analyzeProtocol(extremeProtocol);
      
      expect(analysis).toBeDefined();
      expect(analysis.overallScore).toBeLessThanOrEqual(1);
      expect(isFinite(analysis.overallScore)).toBe(true);
    });

    test('should handle NaN and Infinity values', async () => {
      const nanProtocol = createMinimalProtocol({
        tvl: NaN,
        userMetrics: {
          activeUsers: 1000,
          userGrowth: Infinity,
          retentionRate: -Infinity,
          averagePositionSize: NaN
        }
      });

      // Should either handle gracefully or throw meaningful error
      try {
        const analysis = await analysisEngine.analyzeProtocol(nanProtocol);
        expect(isFinite(analysis.overallScore)).toBe(true);
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
      }
    });
  });

  describe('Configuration Edge Cases', () => {
    test('should handle invalid configuration values', async () => {
      const invalidConfigs = [
        {
          ...DEFAULT_FUNDAMENTAL_ANALYSIS_CONFIG,
          confidenceThreshold: -1 // Negative threshold
        },
        {
          ...DEFAULT_FUNDAMENTAL_ANALYSIS_CONFIG,
          analysisInterval: 0 // Zero interval
        },
        {
          ...DEFAULT_FUNDAMENTAL_ANALYSIS_CONFIG,
          maxConcurrentAnalyses: -5 // Negative limit
        },
        {
          ...DEFAULT_FUNDAMENTAL_ANALYSIS_CONFIG,
          cacheTTL: -1000 // Negative TTL
        }
      ];

      for (const config of invalidConfigs) {
        const engine = FundamentalAnalysisEngine.getInstance(config);
        await expect(engine.initialize()).resolves.not.toThrow();
        await engine.shutdown();
        
        // Reset singleton for next iteration
        (FundamentalAnalysisEngine as any).instance = null;
      }
    });

    test('should handle disabled features configuration', async () => {
      const disabledConfig: FundamentalAnalysisConfig = {
        ...DEFAULT_FUNDAMENTAL_ANALYSIS_CONFIG,
        enableRealTimeAnalysis: false,
        enableMLModels: false,
        cacheResults: false
      };

      const disabledEngine = FundamentalAnalysisEngine.getInstance(disabledConfig);
      await disabledEngine.initialize();

      const protocol = createMinimalProtocol();
      const analysis = await disabledEngine.analyzeProtocol(protocol);

      expect(analysis).toBeDefined();
      expect(analysis.overallScore).toBeGreaterThan(0);

      await disabledEngine.shutdown();
    });
  });

  describe('ML Model Edge Cases', () => {
    beforeEach(async () => {
      await analysisEngine.initialize();
    });

    test('should handle model initialization failures', async () => {
      // Force model initialization to fail
      const originalSequential = jest.requireMock('@tensorflow/tfjs-node').sequential;
      jest.requireMock('@tensorflow/tfjs-node').sequential.mockImplementationOnce(() => {
        throw new Error('Model creation failed');
      });

      (FundamentalAnalysisEngine as any).instance = null;
      const failingEngine = FundamentalAnalysisEngine.getInstance();

      await expect(failingEngine.initialize()).rejects.toThrow('Model creation failed');

      // Restore original implementation
      jest.requireMock('@tensorflow/tfjs-node').sequential.mockImplementation(originalSequential);
    });

    test('should handle prediction failures gracefully', async () => {
      // Mock prediction to fail
      mockModel.predict.mockImplementationOnce(() => {
        throw new Error('Prediction failed');
      });

      const protocol = createMinimalProtocol();
      
      // Should complete analysis with default ML score
      const analysis = await analysisEngine.analyzeProtocol(protocol);
      
      expect(analysis).toBeDefined();
      expect(analysis.overallScore).toBeGreaterThan(0);
    });

    test('should handle model training with empty data', async () => {
      const mlModel = (analysisEngine as any).mlModel;
      
      await expect(mlModel.train([], [])).rejects.toThrow();
    });

    test('should handle model training with mismatched data', async () => {
      const mlModel = (analysisEngine as any).mlModel;
      
      // More features than labels
      await expect(mlModel.train([[1, 2, 3], [4, 5, 6]], [1])).rejects.toThrow();
    });

    test('should handle model prediction before initialization', async () => {
      const mlModel = (analysisEngine as any).mlModel;
      mlModel.model = null; // Simulate uninitialized model
      
      await expect(mlModel.predict([1, 2, 3])).rejects.toThrow('Model not initialized');
    });

    test('should handle training before initialization', async () => {
      const mlModel = (analysisEngine as any).mlModel;
      mlModel.model = null; // Simulate uninitialized model
      
      await expect(mlModel.train([[1, 2, 3]], [1])).rejects.toThrow('Model not initialized');
    });
  });

  describe('Data Processing Edge Cases', () => {
    beforeEach(async () => {
      await analysisEngine.initialize();
    });

    test('should handle empty TVL history arrays', async () => {
      const emptyHistoryProtocol = createMinimalProtocol({
        tvlHistory: []
      });

      const analysis = await analysisEngine.analyzeProtocol(emptyHistoryProtocol);
      
      expect(analysis.tvlHealth.volatility).toBe(0);
      expect(analysis.tvlHealth.sustainability).toBe(0.5);
    });

    test('should handle single-point TVL history', async () => {
      const singlePointProtocol = createMinimalProtocol({
        tvlHistory: [
          { timestamp: new Date(), value: 1000000, change24h: 0, change7d: 0, change30d: 0 }
        ]
      });

      const analysis = await analysisEngine.analyzeProtocol(singlePointProtocol);
      
      expect(analysis.tvlHealth.volatility).toBe(0);
      expect(analysis.tvlHealth.trend).toBe('stable');
    });

    test('should handle revenue sources with zero amounts', async () => {
      const zeroRevenueProtocol = createMinimalProtocol({
        revenue: {
          daily: 0,
          weekly: 0,
          monthly: 0,
          annualized: 0,
          sources: [
            { name: 'trading_fees', amount: 0, percentage: 0 },
            { name: 'lending_interest', amount: 0, percentage: 0 }
          ]
        }
      });

      const analysis = await analysisEngine.analyzeProtocol(zeroRevenueProtocol);
      
      expect(analysis.revenueAnalysis.sustainability).toBe(0.2); // Minimum score
      expect(analysis.revenueAnalysis.diversification).toBe(0.5); // 2 sources
    });

    test('should handle protocols with no revenue sources', async () => {
      const noSourcesProtocol = createMinimalProtocol({
        revenue: {
          daily: 1000,
          weekly: 7000,
          monthly: 30000,
          annualized: 360000,
          sources: []
        }
      });

      const analysis = await analysisEngine.analyzeProtocol(noSourcesProtocol);
      
      expect(analysis.revenueAnalysis.diversification).toBe(0); // No sources
    });
  });

  describe('Boundary Conditions', () => {
    beforeEach(async () => {
      await analysisEngine.initialize();
    });

    test('should handle exact threshold boundaries', async () => {
      const boundaryTests = [
        { tvl: 1000000, expectedNormalization: 0.1 },      // Exact boundary
        { tvl: 10000000, expectedNormalization: 0.3 },     // Exact boundary
        { tvl: 100000000, expectedNormalization: 0.6 },    // Exact boundary
        { tvl: 1000000000, expectedNormalization: 0.8 },   // Exact boundary
        { tvl: 999999, expectedNormalization: 0.1 },       // Just below boundary
        { tvl: 1000001, expectedNormalization: 0.3 }       // Just above boundary
      ];

      for (const test of boundaryTests) {
        const normalizedValue = (analysisEngine as any).normalizeTVL(test.tvl);
        expect(normalizedValue).toBe(test.expectedNormalization);
      }
    });

    test('should handle exact security score boundaries', async () => {
      const securityBoundaryProtocol = createMinimalProtocol({
        securityMetrics: {
          auditScore: 70, // Exact boundary for risk assessment
          insuranceCoverage: 0.5,
          vulnerabilityCount: 0,
          bugBountyProgram: true,
          lastAuditDate: new Date()
        }
      });

      const analysis = await analysisEngine.analyzeProtocol(securityBoundaryProtocol);
      
      // Should not trigger high-risk security factor
      const securityRiskFactor = analysis.riskAssessment.riskFactors.find(
        f => f.category === 'Security'
      );
      expect(securityRiskFactor).toBeUndefined();
    });

    test('should handle exact team transparency boundaries', async () => {
      const transparencyBoundaryProtocol = createMinimalProtocol({
        teamInfo: {
          size: 5,
          experience: 3,
          transparency: 50, // Exact boundary
          githubActivity: 50,
          socialPresence: 50
        }
      });

      const analysis = await analysisEngine.analyzeProtocol(transparencyBoundaryProtocol);
      
      // Should not trigger team transparency risk factor
      const teamRiskFactor = analysis.riskAssessment.riskFactors.find(
        f => f.category === 'Team Transparency'
      );
      expect(teamRiskFactor).toBeUndefined();
    });
  });

  describe('Error Recovery and Resilience', () => {
    beforeEach(async () => {
      await analysisEngine.initialize();
    });

    test('should recover from analysis errors', async () => {
      // Force an error in one of the analysis methods
      const originalMethod = (analysisEngine as any).calculateOverallScore;
      (analysisEngine as any).calculateOverallScore = jest.fn(() => {
        throw new Error('Calculation error');
      });

      const protocol = createMinimalProtocol();
      
      // Should throw error
      await expect(analysisEngine.analyzeProtocol(protocol)).rejects.toThrow('Calculation error');

      // Restore original method
      (analysisEngine as any).calculateOverallScore = originalMethod;

      // Should work normally now
      const analysis = await analysisEngine.analyzeProtocol(protocol);
      expect(analysis).toBeDefined();
    });

    test('should handle concurrent errors gracefully', async () => {
      const protocols = Array.from({ length: 5 }, (_, i) => 
        createMinimalProtocol({ id: `error-test-${i}` })
      );

      // Mock one analysis to fail
      let callCount = 0;
      const originalAnalyze = analysisEngine.analyzeProtocol.bind(analysisEngine);
      
      jest.spyOn(analysisEngine, 'analyzeProtocol').mockImplementation(async (protocol) => {
        callCount++;
        if (callCount === 3) {
          throw new Error('Simulated error');
        }
        return originalAnalyze(protocol);
      });

      const results = await Promise.allSettled(
        protocols.map(p => analysisEngine.analyzeProtocol(p))
      );

      // Should have 4 successful results and 1 rejection
      const fulfilled = results.filter(r => r.status === 'fulfilled');
      const rejected = results.filter(r => r.status === 'rejected');

      expect(fulfilled).toHaveLength(4);
      expect(rejected).toHaveLength(1);
    });
  });

  describe('Memory and Resource Management', () => {
    beforeEach(async () => {
      await analysisEngine.initialize();
    });

    test('should handle large protocol datasets without memory leaks', async () => {
      const largeProtocol = createMinimalProtocol({
        tvlHistory: Array.from({ length: 1000 }, (_, i) => ({
          timestamp: new Date(Date.now() - i * 24 * 60 * 60 * 1000),
          value: 1000000 + Math.random() * 1000000,
          change24h: (Math.random() - 0.5) * 0.2,
          change7d: (Math.random() - 0.5) * 0.4,
          change30d: (Math.random() - 0.5) * 0.8
        })),
        revenue: {
          daily: 50000,
          weekly: 350000,
          monthly: 1500000,
          annualized: 18000000,
          sources: Array.from({ length: 100 }, (_, i) => ({
            name: `source_${i}`,
            amount: Math.random() * 100000,
            percentage: Math.random()
          }))
        }
      });

      // Should complete analysis without issues
      const analysis = await analysisEngine.analyzeProtocol(largeProtocol);
      
      expect(analysis).toBeDefined();
      expect(analysis.tvlHealth.volatility).toBeGreaterThan(0);
      expect(analysis.revenueAnalysis.diversification).toBeGreaterThan(0.7); // Many sources
    });

    test('should clean up cache when memory pressure is high', async () => {
      // Fill cache with many entries
      const protocols = Array.from({ length: 100 }, (_, i) => 
        createMinimalProtocol({ id: `cache-test-${i}`, tvl: 1000000 + i * 100000 })
      );

      await Promise.all(protocols.map(p => analysisEngine.analyzeProtocol(p)));

      const statusBefore = analysisEngine.getStatus();
      expect(statusBefore.cacheSize).toBe(100);

      // Shutdown should clear cache
      await analysisEngine.shutdown();

      const statusAfter = analysisEngine.getStatus();
      expect(statusAfter.cacheSize).toBe(0);
    });
  });

  describe('Real-time Analysis Edge Cases', () => {
    test('should handle real-time analysis with very short intervals', async () => {
      jest.useFakeTimers();

      const shortIntervalConfig: FundamentalAnalysisConfig = {
        ...DEFAULT_FUNDAMENTAL_ANALYSIS_CONFIG,
        analysisInterval: 1, // 1ms interval
        modelUpdateInterval: 1
      };

      const shortIntervalEngine = FundamentalAnalysisEngine.getInstance(shortIntervalConfig);
      await shortIntervalEngine.initialize();

      // Fast-forward time
      jest.advanceTimersByTime(10);

      // Should not crash despite very short intervals
      const status = shortIntervalEngine.getStatus();
      expect(status.isRunning).toBe(true);

      await shortIntervalEngine.shutdown();
      jest.useRealTimers();
    });

    test('should handle model update errors during real-time analysis', async () => {
      jest.useFakeTimers();

      const realTimeEngine = FundamentalAnalysisEngine.getInstance();
      await realTimeEngine.initialize();

      // Mock model update to fail
      const originalTrain = (realTimeEngine as any).mlModel.train;
      (realTimeEngine as any).mlModel.train = jest.fn().mockRejectedValue(new Error('Update failed'));

      // Fast-forward to trigger model update
      jest.advanceTimersByTime(86400001); // 24 hours + 1ms

      // Should handle the error gracefully
      const status = realTimeEngine.getStatus();
      expect(status.isRunning).toBe(true);

      // Restore original method
      (realTimeEngine as any).mlModel.train = originalTrain;

      await realTimeEngine.shutdown();
      jest.useRealTimers();
    });
  });

  describe('Feature Importance Edge Cases', () => {
    beforeEach(async () => {
      await analysisEngine.initialize();
    });

    test('should handle all-zero feature values', async () => {
      const mlModel = (analysisEngine as any).mlModel;
      const zeroFeatures = new Array(18).fill(0);
      
      const prediction = await mlModel.predict(zeroFeatures);
      
      expect(prediction.features).toBeDefined();
      expect(prediction.features).toHaveLength(18);
      
      // All features should have zero importance
      prediction.features.forEach(f => {
        expect(f.importance).toBe(0);
        expect(f.direction).toBe('neutral');
      });
    });

    test('should handle undefined feature names', async () => {
      const mlModel = (analysisEngine as any).mlModel;
      
      // Override config to have fewer feature names than features
      const originalConfig = mlModel.config;
      mlModel.config = {
        ...originalConfig,
        features: ['feature1', 'feature2'] // Only 2 names for 18 features
      };

      const features = new Array(18).fill(0).map((_, i) => i * 0.1);
      const prediction = await mlModel.predict(features);

      // Should handle undefined feature names gracefully
      expect(prediction.features).toHaveLength(18);
      prediction.features.forEach((f, index) => {
        if (index < 2) {
          expect(f.feature).toBe(`feature${index + 1}`);
        } else {
          expect(f.feature).toBe(`feature_${index}`);
        }
      });

      // Restore original config
      mlModel.config = originalConfig;
    });
  });

  describe('Division by Zero Protection', () => {
    beforeEach(async () => {
      await analysisEngine.initialize();
    });

    test('should handle division by zero in performance metrics', async () => {
      const mlModel = (analysisEngine as any).mlModel;
      
      // Create scenario where tp + fp = 0 (precision division by zero)
      const mockPredictions = [[0.1], [0.2], [0.3]]; // All below 0.5 threshold
      const mockActuals = [[0], [0], [0]]; // All actual negatives
      
      const performance = mlModel.calculatePerformanceMetrics(mockPredictions, mockActuals);
      
      expect(performance.precision).toBe(0); // Should be 0, not NaN
      expect(performance.recall).toBe(0); // Should be 0, not NaN
      expect(performance.f1Score).toBe(0); // Should be 0, not NaN
    });

    test('should handle zero variance in volatility calculation', async () => {
      const constantTVLProtocol = createMinimalProtocol({
        tvlHistory: [
          { timestamp: new Date(Date.now() - 60 * 60 * 1000), value: 1000000, change24h: 0, change7d: 0, change30d: 0 },
          { timestamp: new Date(Date.now() - 30 * 60 * 1000), value: 1000000, change24h: 0, change7d: 0, change30d: 0 },
          { timestamp: new Date(), value: 1000000, change24h: 0, change7d: 0, change30d: 0 }
        ]
      });

      const analysis = await analysisEngine.analyzeProtocol(constantTVLProtocol);
      
      expect(analysis.tvlHealth.volatility).toBe(0);
      expect(isFinite(analysis.tvlHealth.volatility)).toBe(true);
    });
  });
});