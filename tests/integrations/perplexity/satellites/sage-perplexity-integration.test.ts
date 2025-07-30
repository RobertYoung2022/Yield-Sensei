/**
 * Sage Satellite Perplexity Integration Tests
 * Tests the Perplexity integration specifically for the Sage satellite
 */

import { jest } from '@jest/globals';
import axios, { AxiosInstance } from 'axios';
import { PerplexityIntegration } from '../../../../src/satellites/sage/api/perplexity-integration';
import { MockProtocolData, MockRWAData, PerplexityTestData } from '../fixtures/test-data';
import { createTestConfig } from '../utils/test-config';

// Mock external dependencies
jest.mock('axios');
jest.mock('@/shared/logging/logger', () => ({
  getLogger: jest.fn(() => ({
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }))
}));

const mockAxios = axios as jest.Mocked<typeof axios>;

describe('Sage Satellite Perplexity Integration Tests', () => {
  let perplexityIntegration: PerplexityIntegration;
  let mockAxiosInstance: jest.Mocked<AxiosInstance>;
  const testConfig = createTestConfig();

  beforeAll(() => {
    // Setup axios mock
    mockAxiosInstance = {
      get: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
      delete: jest.fn(),
      request: jest.fn(),
      interceptors: {
        request: { use: jest.fn(), eject: jest.fn() },
        response: { use: jest.fn(), eject: jest.fn() }
      },
      defaults: { timeout: 30000 }
    } as any;

    mockAxios.create.mockReturnValue(mockAxiosInstance);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    perplexityIntegration = PerplexityIntegration.getInstance(testConfig.sageIntegration);
  });

  afterEach(async () => {
    if (perplexityIntegration) {
      await perplexityIntegration.shutdown();
    }
  });

  describe('Sage-Specific Protocol Research', () => {
    beforeEach(async () => {
      await perplexityIntegration.initialize();
    });

    test('should research DeFi protocol fundamentals', async () => {
      const mockResponse = {
        data: {
          ...PerplexityTestData.mockSuccessResponse,
          choices: [{
            index: 0,
            finish_reason: 'stop',
            message: {
              role: 'assistant',
              content: `Analysis of ${MockProtocolData.standardProtocol.name}:

1. TVL Analysis: Current TVL of $${(MockProtocolData.standardProtocol.tvl / 1e9).toFixed(2)}B represents strong market position
2. Security Status: Recent audits by ${MockProtocolData.standardProtocol.metadata.auditFirms.join(', ')} with no critical findings
3. Risk Assessment: Overall risk score of ${MockProtocolData.standardProtocol.riskScore}/10 indicates moderate risk profile
4. Governance: ${MockProtocolData.standardProtocol.metadata.governanceToken} token holders maintain protocol governance
5. Competitive Analysis: Leading position in ${MockProtocolData.standardProtocol.category} sector with strong user adoption`
            }
          }]
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {}
      };

      mockAxiosInstance.post.mockResolvedValueOnce(mockResponse);

      const result = await perplexityIntegration.researchProtocol(MockProtocolData.standardProtocol);

      expect(result).toBeDefined();
      expect(result.summary).toContain('TVL Analysis');
      expect(result.keyFindings).toHaveLength(5);
      expect(result.confidence).toBeGreaterThan(0.7);
      expect(result.sources).toBeDefined();
      expect(result.recommendations).toContain('Monitor market growth trends');
    });

    test('should research RWA protocol with regulatory focus', async () => {
      const mockResponse = {
        data: {
          ...PerplexityTestData.mockSuccessResponse,
          choices: [{
            index: 0,
            finish_reason: 'stop',
            message: {
              role: 'assistant',
              content: `RWA Protocol Analysis for ${MockProtocolData.rwaProtocol.name}:

1. Regulatory Compliance: Full SEC registration maintained with ${MockProtocolData.rwaProtocol.regulatoryStatus.compliance} requirements
2. Asset Backing: ${MockProtocolData.rwaProtocol.metadata.realWorldAssets.join(', ')} providing diversified exposure
3. Security Framework: Audited by ${MockProtocolData.rwaProtocol.metadata.auditFirms[0]} with emphasis on custody controls
4. Market Position: $${(MockProtocolData.rwaProtocol.tvl / 1e6).toFixed(0)}M TVL in specialized RWA lending sector
5. Risk Profile: Enhanced due diligence processes for real-world asset verification`
            }
          }]
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {}
      };

      mockAxiosInstance.post.mockResolvedValueOnce(mockResponse);

      const result = await perplexityIntegration.researchProtocol(MockProtocolData.rwaProtocol);

      expect(result).toBeDefined();
      expect(result.summary).toContain('RWA Protocol Analysis');
      expect(result.keyFindings).toHaveLength(5);
      expect(result.confidence).toBeGreaterThan(0.7);
      expect(result.recommendations).toContain('Review regulatory compliance status');
    });

    test('should handle multiple protocol research queries in parallel', async () => {
      const protocolResponses = [
        MockProtocolData.standardProtocol,
        MockProtocolData.rwaProtocol
      ].map((protocol, index) => ({
        data: {
          ...PerplexityTestData.mockSuccessResponse,
          id: `parallel-response-${index}`,
          choices: [{
            index: 0,
            finish_reason: 'stop',
            message: {
              role: 'assistant',
              content: `Parallel analysis ${index + 1} for ${protocol.name}: Market analysis shows ${protocol.category} sector performance with TVL of $${(protocol.tvl / 1e6).toFixed(0)}M.`
            }
          }]
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {}
      }));

      mockAxiosInstance.post
        .mockResolvedValueOnce(protocolResponses[0])
        .mockResolvedValueOnce(protocolResponses[1]);

      const promises = [
        perplexityIntegration.researchProtocol(MockProtocolData.standardProtocol),
        perplexityIntegration.researchProtocol(MockProtocolData.rwaProtocol)
      ];

      const results = await Promise.all(promises);

      expect(results).toHaveLength(2);
      results.forEach((result, index) => {
        expect(result.summary).toContain(`Parallel analysis ${index + 1}`);
        expect(result.confidence).toBeGreaterThan(0);
      });

      expect(mockAxiosInstance.post).toHaveBeenCalledTimes(2);
    });
  });

  describe('RWA Research Capabilities', () => {
    beforeEach(async () => {
      await perplexityIntegration.initialize();
    });

    test('should research real estate RWA fundamentals', async () => {
      const mockResponse = {
        data: {
          ...PerplexityTestData.mockSuccessResponse,
          choices: [{
            index: 0,
            finish_reason: 'stop',
            message: {
              role: 'assistant',
              content: `Real Estate RWA Analysis:

1. Asset Valuation: Property valued at $${MockRWAData.realEstate.value.toLocaleString()} in ${MockRWAData.realEstate.location}
2. Occupancy Metrics: Current occupancy rate of ${(MockRWAData.realEstate.metrics.occupancyRate * 100).toFixed(1)}% indicates strong demand
3. Yield Performance: Annual yield of ${(MockRWAData.realEstate.metrics.annualYield * 100).toFixed(1)}% competitive with market rates
4. Regulatory Status: Compliant with ${MockRWAData.realEstate.regulatoryStatus.compliance} in ${MockRWAData.realEstate.regulatoryStatus.jurisdiction}
5. Property Type: ${MockRWAData.realEstate.metrics.propertyType} with last appraisal on ${MockRWAData.realEstate.metrics.lastAppraisal}`
            }
          }]
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {}
      };

      mockAxiosInstance.post.mockResolvedValueOnce(mockResponse);

      const result = await perplexityIntegration.researchRWA(MockRWAData.realEstate);

      expect(result).toBeDefined();
      expect(result.summary).toContain('Real Estate RWA Analysis');
      expect(result.keyFindings).toHaveLength(5);
      expect(result.keyFindings[0]).toContain('Asset Valuation');
      expect(result.keyFindings[1]).toContain('Occupancy Metrics');
      expect(result.confidence).toBeGreaterThan(0.7);
    });

    test('should research treasury bills RWA with government focus', async () => {
      const mockResponse = {
        data: {
          ...PerplexityTestData.mockSuccessResponse,
          choices: [{
            index: 0,
            finish_reason: 'stop',
            message: {
              role: 'assistant',
              content: `Treasury Bills RWA Analysis:

1. Government Backing: Full faith and credit of ${MockRWAData.treasuryBills.issuer} with AAA credit rating
2. Yield Analysis: Current yield of ${(MockRWAData.treasuryBills.metrics.yieldRate * 100).toFixed(2)}% reflects prevailing rates
3. Maturity Profile: Short duration of ${MockRWAData.treasuryBills.metrics.duration} years provides low interest rate risk
4. Liquidity Assessment: ${MockRWAData.treasuryBills.metrics.liquidity} liquidity in secondary markets
5. Regulatory Compliance: ${MockRWAData.treasuryBills.regulatoryStatus.compliance} with government securities regulations`
            }
          }]
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {}
      };

      mockAxiosInstance.post.mockResolvedValueOnce(mockResponse);

      const result = await perplexityIntegration.researchRWA(MockRWAData.treasuryBills);

      expect(result).toBeDefined();
      expect(result.summary).toContain('Treasury Bills RWA Analysis');
      expect(result.keyFindings).toHaveLength(5);
      expect(result.confidence).toBeGreaterThan(0.8); // Higher confidence for government securities
    });

    test('should research commodities RWA with storage verification', async () => {
      const mockResponse = {
        data: {
          ...PerplexityTestData.mockSuccessResponse,
          choices: [{
            index: 0,
            finish_reason: 'stop',
            message: {
              role: 'assistant',
              content: `Precious Metals RWA Analysis:

1. Physical Backing: ${MockRWAData.commodities.metrics.weight} of ${MockRWAData.commodities.commodity} at ${MockRWAData.commodities.metrics.purity * 100}% purity
2. Custody Arrangements: ${MockRWAData.commodities.metrics.storage} with ${MockRWAData.commodities.issuer}
3. Insurance Coverage: ${MockRWAData.commodities.metrics.insurance} protecting against physical loss
4. Certification: ${MockRWAData.commodities.regulatoryStatus.licenses[0]} ensuring quality standards
5. Market Value: Current valuation of $${MockRWAData.commodities.value.toLocaleString()} based on spot prices`
            }
          }]
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {}
      };

      mockAxiosInstance.post.mockResolvedValueOnce(mockResponse);

      const result = await perplexityIntegration.researchRWA(MockRWAData.commodities);

      expect(result).toBeDefined();
      expect(result.summary).toContain('Precious Metals RWA Analysis');
      expect(result.keyFindings).toHaveLength(5);
      expect(result.keyFindings[0]).toContain('Physical Backing');
      expect(result.confidence).toBeGreaterThan(0.7);
    });
  });

  describe('Market Research Integration', () => {
    beforeEach(async () => {
      await perplexityIntegration.initialize();
    });

    test('should research DeFi market trends', async () => {
      const mockResponse = {
        data: {
          ...PerplexityTestData.mockSuccessResponse,
          choices: [{
            index: 0,
            finish_reason: 'stop',
            message: {
              role: 'assistant',
              content: `DeFi Market Analysis:

1. Market Size: Total DeFi TVL currently at $45.2B with 12% growth QoQ
2. Sector Performance: Lending protocols showing strongest growth at 18% QoQ
3. Risk Factors: Regulatory uncertainty and smart contract risks remain primary concerns
4. Innovation Trends: Real-world asset integration driving new use cases
5. Competitive Landscape: Top 10 protocols control 78% of total market share`
            }
          }]
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {}
      };

      mockAxiosInstance.post.mockResolvedValueOnce(mockResponse);

      const result = await perplexityIntegration.researchMarket('DeFi lending protocols', 'US');

      expect(result).toBeDefined();
      expect(result.summary).toContain('Market Size');
      expect(result.keyFindings).toHaveLength(5);
      expect(result.sources).toBeDefined();
      expect(result.recommendations).toContain('Monitor market growth trends');
    });

    test('should research regulatory landscape', async () => {
      const mockResponse = {
        data: {
          ...PerplexityTestData.mockSuccessResponse,
          choices: [{
            index: 0,
            finish_reason: 'stop',
            message: {
              role: 'assistant',
              content: `US Regulatory Framework Analysis:

1. Current Framework: SEC guidance on digital assets continues to evolve with recent clarity on RWA tokens
2. Recent Changes: New custody requirements for digital asset service providers effective Q2 2024
3. Compliance Requirements: Enhanced KYC/AML obligations for DeFi protocols serving US customers
4. Enforcement Actions: Increased scrutiny on unregistered securities offerings in DeFi space
5. Best Practices: Proactive regulatory engagement and compliance-by-design approaches recommended`
            }
          }]
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {}
      };

      mockAxiosInstance.post.mockResolvedValueOnce(mockResponse);

      const result = await perplexityIntegration.researchRegulatory('US', 'DeFi protocols');

      expect(result).toBeDefined();
      expect(result.summary).toContain('Framework');
      expect(result.keyFindings).toHaveLength(5);
      expect(result.recommendations).toContain('Stay updated on regulatory changes');
    });

    test('should research company background', async () => {
      const mockResponse = {
        data: {
          ...PerplexityTestData.mockSuccessResponse,
          choices: [{
            index: 0,
            finish_reason: 'stop',
            message: {
              role: 'assistant',
              content: `Company Background Analysis:

1. Company History: Founded in 2018 with focus on institutional DeFi solutions
2. Financial Performance: Revenue growth of 45% YoY with positive EBITDA since Q3 2023
3. Business Model: SaaS platform with transaction-based revenue streams
4. Regulatory Compliance: Registered MSB with FinCEN, compliant with state licensing requirements
5. Market Position: Top 3 provider in institutional DeFi infrastructure with 125+ client base
6. Recent Developments: Series B funding of $50M completed in Q1 2024`
            }
          }]
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {}
      };

      mockAxiosInstance.post.mockResolvedValueOnce(mockResponse);

      const result = await perplexityIntegration.researchCompany('Compound Labs');

      expect(result).toBeDefined();
      expect(result.summary).toContain('Company History');
      expect(result.keyFindings).toHaveLength(6);
      expect(result.recommendations).toContain('Monitor company financial health');
    });
  });

  describe('Caching and Performance', () => {
    beforeEach(async () => {
      await perplexityIntegration.initialize();
    });

    test('should cache research results effectively', async () => {
      const mockResponse = {
        data: PerplexityTestData.mockSuccessResponse,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {}
      };

      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      // First request
      const result1 = await perplexityIntegration.researchMarket('Test market research');
      
      // Second identical request should use cache
      const result2 = await perplexityIntegration.researchMarket('Test market research');

      expect(result1.summary).toBe(result2.summary);
      expect(result1.confidence).toBe(result2.confidence);
      
      // Should only make one API call due to caching
      expect(mockAxiosInstance.post).toHaveBeenCalledTimes(1);

      const status = perplexityIntegration.getStatus();
      expect(status.cacheSize).toBeGreaterThan(0);
    });

    test('should handle cache expiration correctly', async () => {
      // Create integration with very short cache TTL
      const shortCacheConfig = {
        ...testConfig.sageIntegration,
        cacheTTL: 50 // 50ms
      };

      const shortCacheIntegration = PerplexityIntegration.getInstance(shortCacheConfig);
      await shortCacheIntegration.initialize();

      const mockResponse = {
        data: PerplexityTestData.mockSuccessResponse,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {}
      };

      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      // First request
      await shortCacheIntegration.researchMarket('Cache expiration test');
      
      // Wait for cache to expire
      await new Promise(resolve => setTimeout(resolve, 100));

      // Second request should make new API call
      await shortCacheIntegration.researchMarket('Cache expiration test');

      expect(mockAxiosInstance.post).toHaveBeenCalledTimes(2);

      await shortCacheIntegration.shutdown();
    });

    test('should clear cache on demand', async () => {
      const mockResponse = {
        data: PerplexityTestData.mockSuccessResponse,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {}
      };

      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      // Make request to populate cache
      await perplexityIntegration.researchMarket('Cache clear test');
      
      let status = perplexityIntegration.getStatus();
      expect(status.cacheSize).toBeGreaterThan(0);

      // Clear cache
      perplexityIntegration.clearCache();

      status = perplexityIntegration.getStatus();
      expect(status.cacheSize).toBe(0);
    });
  });

  describe('Error Handling and Resilience', () => {
    beforeEach(async () => {
      await perplexityIntegration.initialize();
    });

    test('should handle API authentication errors', async () => {
      mockAxiosInstance.post.mockRejectedValueOnce({
        response: {
          status: 401,
          data: PerplexityTestData.mockErrorResponses[401]
        }
      });

      await expect(perplexityIntegration.researchMarket('Auth error test'))
        .rejects.toThrow();
    });

    test('should handle rate limiting gracefully', async () => {
      mockAxiosInstance.post.mockRejectedValueOnce({
        response: {
          status: 429,
          data: PerplexityTestData.mockErrorResponses[429],
          headers: PerplexityTestData.mockRateLimitHeaders
        }
      });

      await expect(perplexityIntegration.researchMarket('Rate limit test'))
        .rejects.toThrow('Rate limit exceeded');
    });

    test('should handle server errors with proper error propagation', async () => {
      mockAxiosInstance.post.mockRejectedValueOnce({
        response: {
          status: 500,
          data: PerplexityTestData.mockErrorResponses[500]
        }
      });

      await expect(perplexityIntegration.researchMarket('Server error test'))
        .rejects.toThrow();
    });

    test('should handle network timeouts', async () => {
      mockAxiosInstance.post.mockRejectedValueOnce(new Error('Network timeout'));

      await expect(perplexityIntegration.researchMarket('Timeout test'))
        .rejects.toThrow('Network timeout');
    });
  });

  describe('Integration Status and Monitoring', () => {
    test('should provide comprehensive status information', async () => {
      await perplexityIntegration.initialize();

      const status = perplexityIntegration.getStatus();

      expect(status).toHaveProperty('isInitialized', true);
      expect(status).toHaveProperty('cacheSize');
      expect(status).toHaveProperty('pendingQueriesCount');
      expect(status).toHaveProperty('rateLimitState');
      expect(status.rateLimitState).toHaveProperty('requestsThisMinute');
      expect(status.rateLimitState).toHaveProperty('requestsThisHour');
    });

    test('should provide cache statistics', async () => {
      await perplexityIntegration.initialize();

      // Populate cache
      const mockResponse = {
        data: PerplexityTestData.mockSuccessResponse,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {}
      };

      mockAxiosInstance.post.mockResolvedValue(mockResponse);
      await perplexityIntegration.researchMarket('Cache stats test');

      const cacheStats = perplexityIntegration.getCacheStats();
      
      expect(cacheStats).toHaveProperty('totalEntries');
      expect(cacheStats).toHaveProperty('expiredEntries');
      expect(cacheStats).toHaveProperty('cacheSize');
      expect(cacheStats.totalEntries).toBeGreaterThan(0);
    });
  });

  describe('Shutdown and Cleanup', () => {
    test('should shutdown gracefully', async () => {
      await perplexityIntegration.initialize();
      
      // Make some requests to populate internal state
      const mockResponse = {
        data: PerplexityTestData.mockSuccessResponse,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {}
      };

      mockAxiosInstance.post.mockResolvedValue(mockResponse);
      await perplexityIntegration.researchMarket('Shutdown test');

      await perplexityIntegration.shutdown();

      const status = perplexityIntegration.getStatus();
      expect(status.cacheSize).toBe(0);
      expect(status.pendingQueriesCount).toBe(0);
    });
  });
});