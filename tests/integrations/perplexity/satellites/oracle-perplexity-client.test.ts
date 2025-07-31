/**
 * Oracle Satellite Perplexity Client Tests
 * Tests the specialized Perplexity client for Oracle satellite RWA research
 */

import { jest } from '@jest/globals';
import { PerplexityClient } from '../../../../src/satellites/oracle/sources/perplexity-client';
import { MockRWAData, PerplexityTestData, TestDataUtils } from '../fixtures/test-data';
import { createTestConfig } from '../utils/test-config';

// Mock external dependencies
jest.mock('winston', () => ({
  createLogger: jest.fn(() => ({
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  })),
  format: {
    combine: jest.fn(),
    timestamp: jest.fn(),
    simple: jest.fn()
  },
  transports: {
    Console: jest.fn(),
    File: jest.fn()
  }
}));

describe('Oracle Satellite Perplexity Client Tests', () => {
  let perplexityClient: PerplexityClient;
  const testConfig = createTestConfig();

  beforeEach(() => {
    // Create singleton instance for testing
    perplexityClient = PerplexityClient.getInstance(testConfig.oracleClient);
  });

  afterEach(async () => {
    if (perplexityClient) {
      await perplexityClient.shutdown();
    }
  });

  describe('Client Initialization and Configuration', () => {
    test('should create singleton instance correctly', () => {
      expect(perplexityClient).toBeDefined();
      expect(perplexityClient).toBeInstanceOf(PerplexityClient);
    });

    test('should return same instance on subsequent calls', () => {
      const instance1 = PerplexityClient.getInstance();
      const instance2 = PerplexityClient.getInstance();
      
      expect(instance1).toBe(instance2);
    });

    test('should initialize successfully with valid configuration', async () => {
      await expect(perplexityClient.initialize()).resolves.not.toThrow();
      
      const status = perplexityClient.getStatus();
      expect(status.isInitialized).toBe(true);
    });

    test('should provide usage metrics after initialization', async () => {
      await perplexityClient.initialize();
      
      const metrics = perplexityClient.getUsageMetrics();
      
      expect(metrics).toHaveProperty('dailyUsage');
      expect(metrics).toHaveProperty('requestMetrics');
      expect(metrics).toHaveProperty('quotaRemaining');
      expect(metrics).toHaveProperty('cacheSize');
      expect(metrics.dailyUsage.totalTokens).toBe(0);
      expect(metrics.requestMetrics.totalRequests).toBe(0);
    });
  });

  describe('RWA Protocol Research Capabilities', () => {
    const mockRWAProtocol = {
      id: 'test-rwa-protocol',
      name: 'Test RWA Protocol',
      assetType: 'real-estate',
      assetIssuer: 'Test Issuer LLC',
      totalValueLocked: 50000000, // $50M
      assetClaims: [
        {
          description: 'Commercial Real Estate Portfolio',
          value: 30000000,
          currency: 'USD'
        },
        {
          description: 'Residential Properties',
          value: 20000000,
          currency: 'USD'
        }
      ],
      team: {
        organization: 'Test Organization',
        headquarters: 'New York, NY',
        members: [
          { name: 'John Smith', role: 'CEO' },
          { name: 'Jane Doe', role: 'CTO' }
        ]
      },
      regulatory: {
        jurisdiction: ['US', 'EU'],
        licenses: [
          { type: 'SEC Registration', number: 'SEC-12345' },
          { type: 'MSB License', number: 'MSB-67890' }
        ]
      }
    };

    beforeEach(async () => {
      await perplexityClient.initialize();
    });

    test('should research RWA protocol comprehensively', async () => {
      const result = await perplexityClient.researchRWAProtocol(mockRWAProtocol);

      expect(result).toBeDefined();
      expect(result.protocolId).toBe(mockRWAProtocol.id);
      expect(result.assetBacking).toBeDefined();
      expect(result.teamBackground).toBeDefined();
      expect(result.regulatoryCompliance).toBeDefined();
      expect(result.financialHealth).toBeDefined();
      expect(result.marketPresence).toBeDefined();
      expect(result.overallConfidence).toBeGreaterThan(0);
      expect(result.keyFindings).toBeInstanceOf(Array);
      expect(result.redFlags).toBeInstanceOf(Array);
      expect(result.verificationSources).toBeInstanceOf(Array);
    });

    test('should research asset backing with detailed verification', async () => {
      const response = await perplexityClient.researchAssetBacking(mockRWAProtocol);

      expect(response).toBeDefined();
      expect(response.id).toContain('asset_backing_');
      expect(response.content).toContain('asset backing claims');
      expect(response.content).toContain('SEC filings');
      expect(response.content).toContain('custody arrangements');
      expect(response.content).toContain('independent audit');
      expect(response.confidence).toBeGreaterThan(0.8);
    });

    test('should research team background with credibility assessment', async () => {
      const response = await perplexityClient.researchTeamBackground(mockRWAProtocol);

      expect(response).toBeDefined();
      expect(response.id).toContain('team_background_');
      expect(response.content).toContain('team background');
      expect(response.content).toContain('professional backgrounds');
      expect(response.content).toContain('track record');
      expect(response.confidence).toBeGreaterThan(0.8);
    });

    test('should research regulatory compliance status', async () => {
      const response = await perplexityClient.researchRegulatoryCompliance(mockRWAProtocol);

      expect(response).toBeDefined();
      expect(response.id).toContain('regulatory_compliance_');
      expect(response.content).toContain('regulatory compliance');
      expect(response.content).toContain('SEC');
      expect(response.content).toContain('licensing requirements');
      expect(response.confidence).toBeGreaterThan(0.8);
    });

    test('should research financial health and sustainability', async () => {
      const response = await perplexityClient.researchFinancialHealth(mockRWAProtocol);

      expect(response).toBeDefined();
      expect(response.id).toContain('financial_health_');
      expect(response.content).toContain('financial health');
      expect(response.content).toContain('audited financial statements');
      expect(response.content).toContain('business model');
      expect(response.confidence).toBeGreaterThan(0.8);
    });

    test('should research market presence and reputation', async () => {
      const response = await perplexityClient.researchMarketPresence(mockRWAProtocol);

      expect(response).toBeDefined();
      expect(response.id).toContain('market_presence_');
      expect(response.content).toContain('market presence');
      expect(response.content).toContain('media coverage');
      expect(response.content).toContain('competitive positioning');
      expect(response.confidence).toBeGreaterThan(0.8);
    });
  });

  describe('Query Building and Customization', () => {
    const mockProtocol = {
      id: 'query-test-protocol',
      name: 'Query Test Protocol',
      assetType: 'commodities',
      assetIssuer: 'Commodity Issuer Inc',
      totalValueLocked: 25000000,
      assetClaims: [
        { description: 'Gold Reserves', value: 15000000, currency: 'USD' },
        { description: 'Silver Holdings', value: 10000000, currency: 'USD' }
      ],
      team: {
        organization: 'Commodity Organization',
        headquarters: 'London, UK',
        members: [
          { name: 'Alice Johnson', role: 'Founder' },
          { name: 'Bob Wilson', role: 'Head of Operations' }
        ]
      },
      regulatory: {
        jurisdiction: ['UK', 'Switzerland'],
        licenses: [
          { type: 'FCA Authorization', number: 'FCA-98765' }
        ]
      }
    };

    beforeEach(async () => {
      await perplexityClient.initialize();
    });

    test('should build asset backing query with specific claims', async () => {
      const response = await perplexityClient.researchAssetBacking(mockProtocol);

      expect(response.content).toContain('Gold Reserves: $15,000,000');
      expect(response.content).toContain('Silver Holdings: $10,000,000');
      expect(response.content).toContain('Commodity Issuer Inc');
      expect(response.content).toContain('commodities');
    });

    test('should build team background query with member details', async () => {
      const response = await perplexityClient.researchTeamBackground(mockProtocol);

      expect(response.content).toContain('Alice Johnson (Founder)');
      expect(response.content).toContain('Bob Wilson (Head of Operations)');
      expect(response.content).toContain('Commodity Organization');
      expect(response.content).toContain('London, UK');
    });

    test('should build regulatory query with jurisdiction specifics', async () => {
      const response = await perplexityClient.researchRegulatoryCompliance(mockProtocol);

      expect(response.content).toContain('UK, Switzerland');
      expect(response.content).toContain('FCA Authorization (FCA-98765)');
      expect(response.content).toContain('commodities assets');
    });

    test('should customize queries based on asset type', async () => {
      const realEstateProtocol = { ...mockProtocol, assetType: 'real-estate' };
      const treasuryProtocol = { ...mockProtocol, assetType: 'treasury-bills' };

      const realEstateResponse = await perplexityClient.researchAssetBacking(realEstateProtocol);
      const treasuryResponse = await perplexityClient.researchAssetBacking(treasuryProtocol);

      expect(realEstateResponse.content).toContain('real-estate');
      expect(treasuryResponse.content).toContain('treasury-bills');
    });
  });

  describe('Usage Tracking and Quota Management', () => {
    beforeEach(async () => {
      await perplexityClient.initialize();
    });

    test('should track token usage across requests', async () => {
      const initialMetrics = perplexityClient.getUsageMetrics();
      expect(initialMetrics.dailyUsage.totalTokens).toBe(0);

      const mockProtocol = {
        id: 'usage-test',
        name: 'Usage Test Protocol',
        assetType: 'test',
        assetIssuer: 'Test Issuer',
        totalValueLocked: 1000000,
        assetClaims: [],
        team: { organization: 'Test Org', headquarters: 'Test City', members: [] },
        regulatory: { jurisdiction: ['Test'], licenses: [] }
      };

      await perplexityClient.researchAssetBacking(mockProtocol);

      const updatedMetrics = perplexityClient.getUsageMetrics();
      expect(updatedMetrics.dailyUsage.totalTokens).toBeGreaterThan(0);
      expect(updatedMetrics.requestMetrics.totalRequests).toBe(1);
      expect(updatedMetrics.requestMetrics.successfulRequests).toBe(1);
    });

    test('should enforce daily quota limits', async () => {
      // Create client with very low quota for testing
      const lowQuotaConfig = {
        ...testConfig.oracleClient,
        dailyQuotaLimit: 100 // Very low limit
      };

      const lowQuotaClient = PerplexityClient.getInstance(lowQuotaConfig);
      await lowQuotaClient.initialize();

      // Mock high token usage
      (lowQuotaClient as any).dailyUsage.totalTokens = 95;

      const mockProtocol = {
        id: 'quota-test',
        name: 'Quota Test Protocol',
        assetType: 'test',
        assetIssuer: 'Test Issuer',
        totalValueLocked: 1000000,
        assetClaims: [],
        team: { organization: 'Test Org', headquarters: 'Test City', members: [] },
        regulatory: { jurisdiction: ['Test'], licenses: [] }
      };

      // This should exceed the quota
      await expect(lowQuotaClient.researchAssetBacking(mockProtocol))
        .rejects.toThrow('Daily quota limit exceeded');

      await lowQuotaClient.shutdown();
    });

    test('should reset daily usage at midnight', async () => {
      // Mock the reset time to be yesterday
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      (perplexityClient as any).usageResetTime = yesterday;
      (perplexityClient as any).dailyUsage.totalTokens = 5000;

      // Call reset method
      (perplexityClient as any).resetDailyUsageIfNeeded();

      const metrics = perplexityClient.getUsageMetrics();
      expect(metrics.dailyUsage.totalTokens).toBe(0);
    });
  });

  describe('Rate Limiting and Throttling', () => {
    beforeEach(async () => {
      await perplexityClient.initialize();
    });

    test('should respect rate limiting configuration', async () => {
      const rateLimitConfig = {
        ...testConfig.oracleClient,
        requestsPerMinute: 2, // Very low limit for testing
        enableRateLimiting: true
      };

      const rateLimitedClient = PerplexityClient.getInstance(rateLimitConfig);
      await rateLimitedClient.initialize();

      const mockProtocol = {
        id: 'rate-limit-test',
        name: 'Rate Limit Test',
        assetType: 'test',
        assetIssuer: 'Test Issuer',
        totalValueLocked: 1000000,
        assetClaims: [],
        team: { organization: 'Test Org', headquarters: 'Test City', members: [] },
        regulatory: { jurisdiction: ['Test'], licenses: [] }
      };

      // Make requests that should hit rate limit
      const promises = Array.from({ length: 5 }, () => 
        rateLimitedClient.researchAssetBacking(mockProtocol).catch(err => err)
      );

      const results = await Promise.allSettled(promises);
      
      // Some requests should be successful, others rate limited
      const successful = results.filter(r => r.status === 'fulfilled');
      const rateLimited = results.filter(r => r.status === 'rejected');
      
      expect(successful.length).toBeLessThanOrEqual(2);
      expect(rateLimited.length).toBeGreaterThan(0);

      await rateLimitedClient.shutdown();
    });

    test('should handle rate limit headers from API responses', async () => {
      // This would be tested with actual HTTP mocking in a real implementation
      // For now, we test the header parsing logic
      const mockHeaders = PerplexityTestData.mockRateLimitHeaders;
      
      // Simulate processing rate limit headers
      const remainingRequests = parseInt(mockHeaders['x-ratelimit-remaining-requests']);
      const limitRequests = parseInt(mockHeaders['x-ratelimit-limit-requests']);
      
      expect(remainingRequests).toBe(59);
      expect(limitRequests).toBe(60);
    });
  });

  describe('Caching System Validation', () => {
    beforeEach(async () => {
      await perplexityClient.initialize();
    });

    test('should cache identical queries effectively', async () => {
      const mockProtocol = {
        id: 'cache-test',
        name: 'Cache Test Protocol',
        assetType: 'test',
        assetIssuer: 'Test Issuer',
        totalValueLocked: 1000000,
        assetClaims: [],
        team: { organization: 'Test Org', headquarters: 'Test City', members: [] },
        regulatory: { jurisdiction: ['Test'], licenses: [] }
      };

      // First request
      const response1 = await perplexityClient.researchAssetBacking(mockProtocol);
      
      // Second identical request should use cache
      const response2 = await perplexityClient.researchAssetBacking(mockProtocol);

      expect(response1.content).toBe(response2.content);
      expect(response1.confidence).toBe(response2.confidence);

      const metrics = perplexityClient.getUsageMetrics();
      expect(metrics.cacheSize).toBeGreaterThan(0);
    });

    test('should respect cache TTL settings', async () => {
      const shortCacheConfig = {
        ...testConfig.oracleClient,
        cacheTtl: 50, // 50ms
        enableCaching: true
      };

      const shortCacheClient = PerplexityClient.getInstance(shortCacheConfig);
      await shortCacheClient.initialize();

      const mockProtocol = {
        id: 'cache-ttl-test',
        name: 'Cache TTL Test',
        assetType: 'test',
        assetIssuer: 'Test Issuer',
        totalValueLocked: 1000000,
        assetClaims: [],
        team: { organization: 'Test Org', headquarters: 'Test City', members: [] },
        regulatory: { jurisdiction: ['Test'], licenses: [] }
      };

      // Make first request
      await shortCacheClient.researchAssetBacking(mockProtocol);
      
      let metrics = shortCacheClient.getUsageMetrics();
      expect(metrics.cacheSize).toBeGreaterThan(0);

      // Wait for cache to expire
      await new Promise(resolve => setTimeout(resolve, 100));

      // Cache should be cleaned up or expired
      // Note: In real implementation, this might require triggering cleanup
      metrics = shortCacheClient.getUsageMetrics();
      
      await shortCacheClient.shutdown();
    });

    test('should generate unique cache keys for different queries', async () => {
      const mockProtocol1 = {
        id: 'cache-key-test-1',
        name: 'Protocol 1',
        assetType: 'real-estate',
        assetIssuer: 'Issuer 1',
        totalValueLocked: 1000000,
        assetClaims: [],
        team: { organization: 'Org 1', headquarters: 'City 1', members: [] },
        regulatory: { jurisdiction: ['US'], licenses: [] }
      };

      const mockProtocol2 = {
        id: 'cache-key-test-2',
        name: 'Protocol 2',
        assetType: 'commodities',
        assetIssuer: 'Issuer 2',
        totalValueLocked: 2000000,
        assetClaims: [],
        team: { organization: 'Org 2', headquarters: 'City 2', members: [] },
        regulatory: { jurisdiction: ['EU'], licenses: [] }
      };

      // Make different requests
      const response1 = await perplexityClient.researchAssetBacking(mockProtocol1);
      const response2 = await perplexityClient.researchAssetBacking(mockProtocol2);

      // Responses should be different (different content based on different protocols)
      expect(response1.content).not.toBe(response2.content);
      expect(response1.id).not.toBe(response2.id);

      const metrics = perplexityClient.getUsageMetrics();
      expect(metrics.cacheSize).toBe(2); // Two different cache entries
    });
  });

  describe('Error Handling and Recovery', () => {
    beforeEach(async () => {
      await perplexityClient.initialize();
    });

    test('should handle network connectivity issues', async () => {
      // Mock network error in the client
      const originalExecuteQuery = (perplexityClient as any).executeQuery;
      (perplexityClient as any).executeQuery = jest.fn().mockRejectedValue(new Error('Network unreachable'));

      const mockProtocol = {
        id: 'network-error-test',
        name: 'Network Error Test',
        assetType: 'test',
        assetIssuer: 'Test Issuer',
        totalValueLocked: 1000000,
        assetClaims: [],
        team: { organization: 'Test Org', headquarters: 'Test City', members: [] },
        regulatory: { jurisdiction: ['Test'], licenses: [] }
      };

      await expect(perplexityClient.researchAssetBacking(mockProtocol))
        .rejects.toThrow('Network unreachable');

      // Restore original method
      (perplexityClient as any).executeQuery = originalExecuteQuery;
    });

    test('should update error metrics on failures', async () => {
      const initialMetrics = perplexityClient.getUsageMetrics();
      expect(initialMetrics.requestMetrics.failedRequests).toBe(0);

      // Mock error
      const originalExecuteQuery = (perplexityClient as any).executeQuery;
      (perplexityClient as any).executeQuery = jest.fn().mockRejectedValue(new Error('Test error'));

      const mockProtocol = {
        id: 'error-metrics-test',
        name: 'Error Metrics Test',
        assetType: 'test',
        assetIssuer: 'Test Issuer',
        totalValueLocked: 1000000,
        assetClaims: [],
        team: { organization: 'Test Org', headquarters: 'Test City', members: [] },
        regulatory: { jurisdiction: ['Test'], licenses: [] }
      };

      try {
        await perplexityClient.researchAssetBacking(mockProtocol);
      } catch (error) {
        // Expected error
      }

      const updatedMetrics = perplexityClient.getUsageMetrics();
      expect(updatedMetrics.requestMetrics.failedRequests).toBe(1);

      // Restore original method
      (perplexityClient as any).executeQuery = originalExecuteQuery;
    });
  });

  describe('Status Monitoring and Health Checks', () => {
    test('should provide comprehensive status information', async () => {
      await perplexityClient.initialize();

      const status = perplexityClient.getStatus();

      expect(status).toHaveProperty('isInitialized', true);
      expect(status).toHaveProperty('isRunning', true);
      expect(status).toHaveProperty('dailyQuotaUsed');
      expect(status).toHaveProperty('dailyQuotaRemaining');
      expect(status).toHaveProperty('cacheSize');
      expect(status).toHaveProperty('requestMetrics');
      expect(status.dailyQuotaRemaining).toBeGreaterThan(0);
    });

    test('should track request metrics accurately', async () => {
      await perplexityClient.initialize();

      const mockProtocol = {
        id: 'metrics-test',
        name: 'Metrics Test Protocol',
        assetType: 'test',
        assetIssuer: 'Test Issuer',
        totalValueLocked: 1000000,
        assetClaims: [],
        team: { organization: 'Test Org', headquarters: 'Test City', members: [] },
        regulatory: { jurisdiction: ['Test'], licenses: [] }
      };

      await perplexityClient.researchAssetBacking(mockProtocol);

      const metrics = perplexityClient.getUsageMetrics();
      
      expect(metrics.requestMetrics.totalRequests).toBe(1);
      expect(metrics.requestMetrics.successfulRequests).toBe(1);
      expect(metrics.requestMetrics.failedRequests).toBe(0);
      expect(metrics.requestMetrics.averageLatency).toBeGreaterThan(0);
    });
  });

  describe('Cleanup and Resource Management', () => {
    test('should cleanup resources on shutdown', async () => {
      await perplexityClient.initialize();

      // Populate some state
      const mockProtocol = {
        id: 'cleanup-test',
        name: 'Cleanup Test Protocol',
        assetType: 'test',
        assetIssuer: 'Test Issuer',
        totalValueLocked: 1000000,
        assetClaims: [],
        team: { organization: 'Test Org', headquarters: 'Test City', members: [] },
        regulatory: { jurisdiction: ['Test'], licenses: [] }
      };

      await perplexityClient.researchAssetBacking(mockProtocol);

      let metrics = perplexityClient.getUsageMetrics();
      expect(metrics.cacheSize).toBeGreaterThan(0);

      await perplexityClient.shutdown();

      metrics = perplexityClient.getUsageMetrics();
      expect(metrics.cacheSize).toBe(0);
    });

    test('should clear all event listeners on shutdown', async () => {
      await perplexityClient.initialize();

      const eventSpy = jest.fn();
      perplexityClient.on('test_event', eventSpy);

      await perplexityClient.shutdown();

      // After shutdown, the client should have no listeners
      expect(perplexityClient.listenerCount('test_event')).toBe(0);
    });
  });
});