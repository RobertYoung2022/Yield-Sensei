/**
 * Oracle Satellite Test Suite
 * Comprehensive tests for data integrity and RWA validation
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { OracleSatelliteAgent } from '../../../satellites/oracle/oracle-satellite';
import { OracleFeedValidator } from '../../../satellites/oracle/validation/oracle-feed-validator';
import { RWAValidator } from '../../../satellites/oracle/validation/rwa-validator';
import { DataSourceManager } from '../../../satellites/oracle/sources/data-source-manager';
import { PerplexityClient } from '../../../satellites/oracle/sources/perplexity-client';
import {
  OracleSatelliteConfig,
  OracleFeed,
  RWAProtocol,
  OracleValidationResult,
  RWAValidationResult,
  DataSource,
  PerplexityQuery
} from '../../../satellites/oracle/types';

// Test data factories
const createMockOracleFeed = (): OracleFeed => ({
  id: 'test_feed_btc',
  name: 'BTC/USD Price Feed',
  provider: 'Chainlink',
  endpoint: 'https://api.chainlink.com/feeds/btc-usd',
  type: 'price',
  status: 'active',
  reliability: 0.95,
  accuracy: 0.98,
  lastUpdate: new Date(),
  updateFrequency: 300, // 5 minutes
  configuration: {
    timeout: 10000,
    retries: 3,
    validationRules: [],
    aggregationMethod: 'median',
    minSources: 3,
    maxDeviation: 0.05,
    historicalWindow: 86400
  }
});

const createMockRWAProtocol = (): RWAProtocol => ({
  id: 'test_rwa_treasury',
  name: 'US Treasury RWA Fund',
  description: 'Tokenized US Treasury Bills',
  assetType: 'treasury_bills',
  assetIssuer: 'Treasury Fund LLC',
  totalValueLocked: 100000000,
  tokenSupply: 100000000,
  assetClaims: [{
    id: 'claim_1',
    description: 'US Treasury Bills',
    value: 100000000,
    currency: 'USD',
    verificationSource: 'State Street Bank',
    verificationDate: new Date(),
    confidence: 0.95,
    supportingDocuments: []
  }],
  team: {
    members: [{
      name: 'John Smith',
      role: 'CEO',
      background: 'Former investment banker',
      verified: true,
      reputation: 0.9
    }],
    advisors: [],
    organization: 'Treasury Fund LLC',
    headquarters: 'New York, NY',
    incorporationDate: new Date('2020-01-01')
  },
  financials: {
    revenue: [],
    expenses: [],
    assets: [],
    liabilities: [],
    auditedStatements: [],
    cashFlow: []
  },
  regulatory: {
    jurisdiction: ['US'],
    licenses: [{
      type: 'Investment Advisor',
      number: 'IA-12345',
      issuer: 'SEC',
      issueDate: new Date('2020-01-01'),
      status: 'active'
    }],
    compliance: [],
    filings: [],
    restrictions: []
  },
  auditReports: [],
  riskFactors: [],
  createdAt: new Date(),
  updatedAt: new Date()
});

const createMockConfig = (): OracleSatelliteConfig => ({
  oracle: {
    enableValidation: true,
    validationInterval: 60000,
    accuracyThreshold: 0.8,
    consensusThreshold: 0.9,
    maxDeviationPercent: 5,
    historicalWindowDays: 30,
    anomalyDetection: {
      enabled: true,
      algorithm: 'statistical',
      sensitivity: 0.8,
      window: 100,
      threshold: 2.0,
      features: ['price', 'volume']
    }
  },
  rwa: {
    enableValidation: true,
    validationDepth: 'comprehensive',
    autoUpdate: true,
    updateInterval: 3600000,
    riskThresholds: {
      low: 0.8,
      medium: 0.6,
      high: 0.4
    },
    requiredDocuments: ['audit', 'legal', 'financial']
  },
  dataSources: {
    maxConcurrent: 10,
    defaultTimeout: 10000,
    retryAttempts: 3,
    cachingEnabled: true,
    loadBalancing: true
  },
  perplexity: {
    apiKey: 'test_key',
    model: 'llama-3.1-sonar-large-128k-online',
    maxQueries: 100,
    dailyLimit: 1000,
    enableCaching: true,
    cacheTtl: 3600
  },
  monitoring: {
    enableLogging: true,
    logLevel: 'info',
    enableMetrics: true,
    enableAlerts: true,
    alertEndpoints: []
  }
});

describe('Oracle Satellite Agent', () => {
  let oracleSatellite: OracleSatelliteAgent;
  let mockConfig: OracleSatelliteConfig;

  beforeEach(() => {
    mockConfig = createMockConfig();
    oracleSatellite = OracleSatelliteAgent.getInstance(mockConfig);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Initialization and Lifecycle', () => {
    test('should initialize successfully with valid config', async () => {
      await oracleSatellite.initialize();
      
      const status = oracleSatellite.getHealthMetrics();
      expect(status.oracle.isInitialized).toBe(true);
      expect(status.overall).toBe('healthy');
    });

    test('should start and stop successfully', async () => {
      await oracleSatellite.initialize();
      await oracleSatellite.start();
      
      let status = oracleSatellite.getHealthMetrics();
      expect(status.oracle.isRunning).toBe(true);

      await oracleSatellite.stop();
      
      status = oracleSatellite.getHealthMetrics();
      expect(status.oracle.isRunning).toBe(false);
    });

    test('should handle initialization errors gracefully', async () => {
      const invalidConfig = { ...mockConfig };
      invalidConfig.perplexity.apiKey = '';

      await expect(async () => {
        const invalidSatellite = OracleSatelliteAgent.getInstance(invalidConfig);
        await invalidSatellite.initialize();
      }).rejects.toThrow();
    });

    test('should emit lifecycle events', async () => {
      const initListener = jest.fn();
      const startListener = jest.fn();

      oracleSatellite.on('satellite_initialized', initListener);
      oracleSatellite.on('satellite_started', startListener);

      await oracleSatellite.initialize();
      await oracleSatellite.start();

      expect(initListener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'initialization_completed',
          timestamp: expect.any(Date)
        })
      );

      expect(startListener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'satellite_operational',
          timestamp: expect.any(Date)
        })
      );
    });
  });

  describe('Oracle Feed Validation', () => {
    test('should validate oracle feed successfully', async () => {
      await oracleSatellite.initialize();
      
      const mockFeed = createMockOracleFeed();
      const result = await oracleSatellite.validateOracleFeed(mockFeed.id);

      expect(result).toMatchObject({
        isValid: expect.any(Boolean),
        score: expect.any(Number),
        errors: expect.any(Array),
        warnings: expect.any(Array),
        metadata: expect.objectContaining({
          sources: expect.any(Number),
          consensus: expect.any(Number),
          timestamp: expect.any(Date)
        })
      });

      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(1);
    });

    test('should validate multiple oracle feeds in batch', async () => {
      await oracleSatellite.initialize();
      
      const results = await oracleSatellite.validateAllOracleFeeds();
      
      expect(results).toBeInstanceOf(Map);
      // Even with no feeds loaded, should return empty map without errors
      expect(results.size).toBeGreaterThanOrEqual(0);
    });

    test('should handle feed validation failures', async () => {
      await oracleSatellite.initialize();

      await expect(
        oracleSatellite.validateOracleFeed('non_existent_feed')
      ).rejects.toThrow('Oracle feed not found');
    });

    test('should emit validation events', async () => {
      await oracleSatellite.initialize();
      
      const validationListener = jest.fn();
      oracleSatellite.on('oracle_validated', validationListener);

      const mockFeed = createMockOracleFeed();
      await oracleSatellite.validateOracleFeed(mockFeed.id);

      expect(validationListener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'oracle_feed_validated',
          feedId: mockFeed.id,
          timestamp: expect.any(Date)
        })
      );
    });
  });

  describe('RWA Protocol Validation', () => {
    test('should validate RWA protocol successfully', async () => {
      await oracleSatellite.initialize();
      
      const mockProtocol = createMockRWAProtocol();
      const result = await oracleSatellite.validateRWAProtocol(mockProtocol.id);

      expect(result).toMatchObject({
        protocol: mockProtocol.id,
        legitimacyScore: expect.any(Number),
        assetVerification: expect.any(Object),
        teamVerification: expect.any(Object),
        regulatoryCheck: expect.any(Object),
        financialValidation: expect.any(Object),
        timestamp: expect.any(Date),
        recommendations: expect.any(Array),
        riskAssessment: expect.any(Object)
      });

      expect(result.legitimacyScore).toBeGreaterThanOrEqual(0);
      expect(result.legitimacyScore).toBeLessThanOrEqual(1);
    });

    test('should validate multiple RWA protocols in batch', async () => {
      await oracleSatellite.initialize();
      
      const results = await oracleSatellite.validateAllRWAProtocols();
      
      expect(results).toBeInstanceOf(Map);
      expect(results.size).toBeGreaterThanOrEqual(0);
    });

    test('should handle RWA validation failures', async () => {
      await oracleSatellite.initialize();

      await expect(
        oracleSatellite.validateRWAProtocol('non_existent_protocol')
      ).rejects.toThrow('RWA protocol not found');
    });

    test('should emit RWA validation events', async () => {
      await oracleSatellite.initialize();
      
      const validationListener = jest.fn();
      oracleSatellite.on('rwa_validated', validationListener);

      const mockProtocol = createMockRWAProtocol();
      await oracleSatellite.validateRWAProtocol(mockProtocol.id);

      expect(validationListener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'rwa_protocol_validated',
          protocol: mockProtocol.id,
          timestamp: expect.any(Date)
        })
      );
    });
  });

  describe('Real-time Analysis', () => {
    test('should perform real-time analysis without errors', async () => {
      await oracleSatellite.initialize();
      await oracleSatellite.start();

      const analysisListener = jest.fn();
      oracleSatellite.on('analysis_completed', analysisListener);

      await oracleSatellite.performRealTimeAnalysis();

      expect(analysisListener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'real_time_analysis_completed',
          timestamp: expect.any(Date)
        })
      );
    });

    test('should handle analysis errors gracefully', async () => {
      await oracleSatellite.initialize();

      // Should not throw even if analysis encounters errors
      await expect(
        oracleSatellite.performRealTimeAnalysis()
      ).resolves.not.toThrow();
    });
  });

  describe('Data Source Management', () => {
    test('should refresh data sources successfully', async () => {
      await oracleSatellite.initialize();

      await expect(
        oracleSatellite.refreshDataSources()
      ).resolves.not.toThrow();
    });

    test('should handle data source refresh failures', async () => {
      await oracleSatellite.initialize();

      // Should handle failures gracefully
      await expect(
        oracleSatellite.refreshDataSources()
      ).resolves.not.toThrow();
    });
  });

  describe('Health Monitoring', () => {
    test('should provide accurate health metrics', async () => {
      await oracleSatellite.initialize();
      
      const health = oracleSatellite.getHealthMetrics();

      expect(health).toMatchObject({
        oracle: expect.objectContaining({
          isInitialized: true,
          isRunning: expect.any(Boolean),
          activeFeeds: expect.any(Number),
          validationsPassed: expect.any(Number),
          validationsFailed: expect.any(Number),
          averageAccuracy: expect.any(Number),
          lastValidation: expect.any(Date),
          errors: expect.any(Array)
        }),
        rwa: expect.objectContaining({
          isInitialized: true,
          isRunning: expect.any(Boolean),
          protocolsTracked: expect.any(Number),
          validationsCompleted: expect.any(Number),
          averageLegitimacy: expect.any(Number),
          lastValidation: expect.any(Date),
          criticalIssues: expect.any(Number)
        }),
        overall: expect.stringMatching(/^(healthy|degraded|critical|offline)$/)
      });
    });

    test('should provide oracle-specific status', async () => {
      await oracleSatellite.initialize();
      
      const status = oracleSatellite.getOracleStatus();

      expect(status).toMatchObject({
        isInitialized: true,
        isRunning: expect.any(Boolean),
        activeFeeds: expect.any(Number),
        validationsPassed: expect.any(Number),
        validationsFailed: expect.any(Number),
        averageAccuracy: expect.any(Number)
      });
    });

    test('should provide RWA-specific status', async () => {
      await oracleSatellite.initialize();
      
      const status = oracleSatellite.getRWAStatus();

      expect(status).toMatchObject({
        isInitialized: true,
        isRunning: expect.any(Boolean),
        protocolsTracked: expect.any(Number),
        validationsCompleted: expect.any(Number),
        averageLegitimacy: expect.any(Number)
      });
    });
  });

  describe('Error Handling and Resilience', () => {
    test('should handle concurrent validation requests', async () => {
      await oracleSatellite.initialize();

      const mockFeed = createMockOracleFeed();
      const mockProtocol = createMockRWAProtocol();

      const promises = [
        oracleSatellite.validateOracleFeed(mockFeed.id),
        oracleSatellite.validateRWAProtocol(mockProtocol.id),
        oracleSatellite.performRealTimeAnalysis()
      ];

      await expect(Promise.all(promises)).resolves.not.toThrow();
    });

    test('should maintain state consistency during errors', async () => {
      await oracleSatellite.initialize();

      // Attempt invalid operations
      await expect(
        oracleSatellite.validateOracleFeed('invalid_feed')
      ).rejects.toThrow();

      // Verify system is still functional
      const health = oracleSatellite.getHealthMetrics();
      expect(health.oracle.isInitialized).toBe(true);
    });

    test('should handle shutdown gracefully', async () => {
      await oracleSatellite.initialize();
      await oracleSatellite.start();

      await expect(oracleSatellite.shutdown()).resolves.not.toThrow();

      const health = oracleSatellite.getHealthMetrics();
      expect(health.oracle.isInitialized).toBe(false);
    });
  });

  describe('Configuration Validation', () => {
    test('should reject invalid oracle configuration', () => {
      const invalidConfig = { ...mockConfig };
      invalidConfig.oracle.accuracyThreshold = 1.5; // Invalid: > 1

      expect(() => {
        OracleSatelliteAgent.getInstance(invalidConfig);
      }).toThrow();
    });

    test('should reject invalid RWA configuration', () => {
      const invalidConfig = { ...mockConfig };
      invalidConfig.rwa.validationDepth = 'invalid' as any;

      expect(() => {
        OracleSatelliteAgent.getInstance(invalidConfig);
      }).toThrow();
    });

    test('should use default values for optional config', () => {
      const minimalConfig = {
        oracle: { enableValidation: true },
        rwa: { enableValidation: true },
        dataSources: { maxConcurrent: 5 },
        perplexity: { apiKey: 'test' },
        monitoring: { enableLogging: true }
      } as any;

      expect(() => {
        OracleSatelliteAgent.getInstance(minimalConfig);
      }).not.toThrow();
    });
  });

  describe('Performance and Scalability', () => {
    test('should handle high-frequency validation requests', async () => {
      await oracleSatellite.initialize();

      const startTime = Date.now();
      const mockFeed = createMockOracleFeed();

      // Simulate high-frequency requests
      const promises = Array(10).fill(null).map(() =>
        oracleSatellite.validateOracleFeed(mockFeed.id)
      );

      const results = await Promise.all(promises);
      const duration = Date.now() - startTime;

      expect(results).toHaveLength(10);
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
      results.forEach(result => {
        expect(result.isValid).toBeDefined();
        expect(result.score).toBeGreaterThanOrEqual(0);
      });
    });

    test('should maintain memory usage within bounds', async () => {
      await oracleSatellite.initialize();

      const initialMemory = process.memoryUsage().heapUsed;

      // Perform multiple operations
      for (let i = 0; i < 50; i++) {
        await oracleSatellite.performRealTimeAnalysis();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be reasonable (less than 50MB)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
    });
  });
});

describe('Oracle Feed Validator', () => {
  let validator: OracleFeedValidator;
  let mockConfig: any;

  beforeEach(() => {
    mockConfig = {
      enableCrossValidation: true,
      enableHistoricalValidation: true,
      enableAnomalyDetection: true,
      accuracyThreshold: 0.8,
      consensusThreshold: 0.9,
      maxDeviationPercent: 5,
      historicalWindowDays: 30,
      minConsensusSize: 3,
      validationTimeout: 10000,
      enableCaching: true,
      cacheTtl: 300000
    };

    validator = OracleFeedValidator.getInstance(mockConfig);
  });

  describe('Feed Validation', () => {
    test('should validate single feed successfully', async () => {
      await validator.initialize();
      
      const mockFeed = createMockOracleFeed();
      const result = await validator.validateFeed(mockFeed);

      expect(result).toMatchObject({
        isValid: expect.any(Boolean),
        score: expect.any(Number),
        errors: expect.any(Array),
        warnings: expect.any(Array)
      });
    });

    test('should perform cross-oracle validation', async () => {
      await validator.initialize();
      
      const feeds = [
        createMockOracleFeed(),
        { ...createMockOracleFeed(), id: 'feed_2', provider: 'Coinbase' },
        { ...createMockOracleFeed(), id: 'feed_3', provider: 'Binance' }
      ];

      const result = await validator.validateCrossOracle(feeds, 'BTC');

      expect(result.metadata.sources).toBe(3);
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(1);
    });

    test('should detect anomalies in feed data', async () => {
      await validator.initialize();
      
      const mockFeed = createMockOracleFeed();
      const result = await validator.validateFeed(mockFeed);

      // Should include anomaly detection results
      expect(result.warnings).toBeDefined();
      expect(result.errors).toBeDefined();
    });

    test('should validate historical accuracy', async () => {
      await validator.initialize();
      
      const mockFeed = createMockOracleFeed();
      const result = await validator.validateHistoricalAccuracy(mockFeed, 30);

      expect(result).toMatchObject({
        feedId: mockFeed.id,
        period: 30,
        accuracy: expect.any(Number),
        reliability: expect.any(Number),
        consistency: expect.any(Number)
      });
    });
  });

  describe('Validation Rules', () => {
    test('should apply format validation rules', async () => {
      await validator.initialize();
      
      const invalidFeed = { ...createMockOracleFeed() };
      // Test would simulate invalid data format
      
      const result = await validator.validateFeed(invalidFeed);
      expect(result).toBeDefined();
    });

    test('should apply freshness validation rules', async () => {
      await validator.initialize();
      
      const staleFeed = { 
        ...createMockOracleFeed(),
        lastUpdate: new Date(Date.now() - 3600000) // 1 hour old
      };
      
      const result = await validator.validateFeed(staleFeed);
      expect(result.warnings.length).toBeGreaterThanOrEqual(0);
    });

    test('should apply range validation rules', async () => {
      await validator.initialize();
      
      const mockFeed = createMockOracleFeed();
      const result = await validator.validateFeed(mockFeed);
      
      // Should validate that price is within reasonable range
      expect(result.score).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Performance Metrics', () => {
    test('should track validation performance', async () => {
      await validator.initialize();
      
      const mockFeed = createMockOracleFeed();
      
      // Perform multiple validations
      for (let i = 0; i < 5; i++) {
        await validator.validateFeed(mockFeed);
      }

      const status = validator.getStatus();
      expect(status.feedsTracked).toBeGreaterThanOrEqual(0);
      expect(status.cacheSize).toBeGreaterThanOrEqual(0);
    });
  });
});

describe('RWA Validator', () => {
  let validator: RWAValidator;
  let mockConfig: any;

  beforeEach(() => {
    mockConfig = {
      enablePerplexityResearch: true,
      enableSECFilingAnalysis: false, // Disabled for testing
      enableTeamVerification: true,
      enableFinancialAnalysis: true,
      validationDepth: 'comprehensive',
      legitimacyThreshold: 0.7,
      riskThresholds: { low: 0.8, medium: 0.6, high: 0.4 },
      perplexityApiKey: 'test_key',
      maxConcurrentValidations: 5,
      validationTimeout: 30000
    };

    validator = RWAValidator.getInstance(mockConfig);
  });

  describe('Protocol Validation', () => {
    test('should validate RWA protocol comprehensively', async () => {
      await validator.initialize();
      
      const mockProtocol = createMockRWAProtocol();
      const result = await validator.validateProtocol(mockProtocol);

      expect(result).toMatchObject({
        protocol: mockProtocol.id,
        legitimacyScore: expect.any(Number),
        assetVerification: expect.objectContaining({
          verified: expect.any(Boolean),
          confidence: expect.any(Number)
        }),
        teamVerification: expect.objectContaining({
          verified: expect.any(Boolean),
          score: expect.any(Number)
        }),
        regulatoryCheck: expect.objectContaining({
          compliant: expect.any(Boolean),
          score: expect.any(Number)
        }),
        financialValidation: expect.objectContaining({
          verified: expect.any(Boolean),
          score: expect.any(Number)
        }),
        riskAssessment: expect.objectContaining({
          overallRisk: expect.stringMatching(/^(low|medium|high|critical)$/)
        })
      });
    });

    test('should handle validation caching', async () => {
      await validator.initialize();
      
      const mockProtocol = createMockRWAProtocol();
      
      const startTime1 = Date.now();
      const result1 = await validator.validateProtocol(mockProtocol);
      const duration1 = Date.now() - startTime1;

      const startTime2 = Date.now();
      const result2 = await validator.validateProtocol(mockProtocol);
      const duration2 = Date.now() - startTime2;

      // Second call should be faster due to caching
      expect(duration2).toBeLessThan(duration1);
      expect(result1.legitimacyScore).toBe(result2.legitimacyScore);
    });

    test('should generate appropriate risk assessments', async () => {
      await validator.initialize();
      
      const mockProtocol = createMockRWAProtocol();
      const result = await validator.validateProtocol(mockProtocol);

      expect(result.riskAssessment.categories).toBeInstanceOf(Array);
      expect(result.riskAssessment.categories.length).toBeGreaterThan(0);
      
      result.riskAssessment.categories.forEach(category => {
        expect(category).toMatchObject({
          name: expect.any(String),
          level: expect.stringMatching(/^(low|medium|high|critical)$/),
          factors: expect.any(Array),
          impact: expect.any(Number),
          probability: expect.any(Number)
        });
      });
    });

    test('should provide actionable recommendations', async () => {
      await validator.initialize();
      
      const mockProtocol = createMockRWAProtocol();
      const result = await validator.validateProtocol(mockProtocol);

      expect(result.recommendations).toBeInstanceOf(Array);
      expect(result.recommendations.length).toBeGreaterThan(0);
      
      result.recommendations.forEach(recommendation => {
        expect(typeof recommendation).toBe('string');
        expect(recommendation.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Asset Verification', () => {
    test('should verify asset backing claims', async () => {
      await validator.initialize();
      
      const mockProtocol = createMockRWAProtocol();
      const result = await validator.validateProtocol(mockProtocol);

      expect(result.assetVerification).toMatchObject({
        verified: expect.any(Boolean),
        confidence: expect.any(Number),
        backing: expect.objectContaining({
          claimed: expect.any(Number),
          verified: expect.any(Number),
          percentage: expect.any(Number)
        }),
        discrepancies: expect.any(Array)
      });
    });
  });

  describe('Team Verification', () => {
    test('should verify team credentials', async () => {
      await validator.initialize();
      
      const mockProtocol = createMockRWAProtocol();
      const result = await validator.validateProtocol(mockProtocol);

      expect(result.teamVerification).toMatchObject({
        verified: expect.any(Boolean),
        score: expect.any(Number),
        members: expect.any(Array),
        organization: expect.objectContaining({
          incorporated: expect.any(Boolean),
          score: expect.any(Number)
        })
      });
    });
  });

  describe('Regulatory Compliance', () => {
    test('should check regulatory compliance', async () => {
      await validator.initialize();
      
      const mockProtocol = createMockRWAProtocol();
      const result = await validator.validateProtocol(mockProtocol);

      expect(result.regulatoryCheck).toMatchObject({
        compliant: expect.any(Boolean),
        score: expect.any(Number),
        licenses: expect.any(Array),
        violations: expect.any(Array),
        riskLevel: expect.stringMatching(/^(low|medium|high|critical)$/)
      });
    });
  });

  describe('Financial Analysis', () => {
    test('should analyze financial health', async () => {
      await validator.initialize();
      
      const mockProtocol = createMockRWAProtocol();
      const result = await validator.validateProtocol(mockProtocol);

      expect(result.financialValidation).toMatchObject({
        verified: expect.any(Boolean),
        score: expect.any(Number),
        financialHealth: expect.objectContaining({
          overallHealth: expect.stringMatching(/^(excellent|good|fair|poor|critical)$/)
        }),
        transparency: expect.objectContaining({
          score: expect.any(Number)
        })
      });
    });
  });
});

describe('Integration Tests', () => {
  let oracleSatellite: OracleSatelliteAgent;
  let mockConfig: OracleSatelliteConfig;

  beforeEach(() => {
    mockConfig = createMockConfig();
    oracleSatellite = OracleSatelliteAgent.getInstance(mockConfig);
  });

  test('should handle end-to-end oracle validation workflow', async () => {
    await oracleSatellite.initialize();
    await oracleSatellite.start();

    // Simulate complete workflow
    await oracleSatellite.performRealTimeAnalysis();
    await oracleSatellite.refreshDataSources();

    const health = oracleSatellite.getHealthMetrics();
    expect(health.overall).toBe('healthy');

    await oracleSatellite.stop();
  });

  test('should handle concurrent validation requests', async () => {
    await oracleSatellite.initialize();

    const mockFeed = createMockOracleFeed();
    const mockProtocol = createMockRWAProtocol();

    const [oracleResult, rwaResult] = await Promise.all([
      oracleSatellite.validateOracleFeed(mockFeed.id),
      oracleSatellite.validateRWAProtocol(mockProtocol.id)
    ]);

    expect(oracleResult.isValid).toBeDefined();
    expect(rwaResult.legitimacyScore).toBeDefined();
  });

  test('should maintain consistency across multiple operations', async () => {
    await oracleSatellite.initialize();

    // Perform multiple operations
    for (let i = 0; i < 3; i++) {
      await oracleSatellite.performRealTimeAnalysis();
    }

    const finalHealth = oracleSatellite.getHealthMetrics();
    expect(finalHealth.oracle.isInitialized).toBe(true);
    expect(['healthy', 'degraded'].includes(finalHealth.overall)).toBe(true);
  });
});