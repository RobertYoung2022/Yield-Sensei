/**
 * Perplexity API Integration Tests
 * Comprehensive test suite for the Perplexity AI research integration
 */

import { jest } from '@jest/globals';
import nock from 'nock';
import { 
  PerplexityIntegration,
  DEFAULT_PERPLEXITY_CONFIG
} from '../../../src/satellites/sage/api/perplexity-integration';
import { RWAData, ProtocolData } from '../../../src/satellites/sage/types';

// Mock logger
jest.mock('@/shared/logging/logger', () => ({
  getLogger: jest.fn(() => ({
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }))
}));

describe('Perplexity API Integration', () => {
  let perplexityIntegration: PerplexityIntegration;
  const mockApiKey = 'test-api-key-12345';
  const baseUrl = 'https://api.perplexity.ai';

  const sampleRWAData: RWAData = {
    id: 'rwa-test-001',
    type: 'real-estate',
    issuer: 'Test Real Estate Fund',
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
    complianceScore: 85
  };

  const sampleProtocolData: ProtocolData = {
    id: 'protocol-test-001',
    name: 'Test DeFi Protocol',
    category: 'lending',
    tvl: 500000000,
    volume24h: 25000000,
    users: 15000,
    tokenPrice: 12.50,
    marketCap: 125000000,
    circulatingSupply: 10000000,
    totalSupply: 15000000,
    apy: 0.085,
    fees24h: 125000,
    revenue: 1500000,
    codeAudits: [],
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
    tokenDistribution: [],
    partnerships: ['Chainlink', 'Compound']
  };

  beforeEach(() => {
    // Reset singleton instance
    (PerplexityIntegration as any).instance = null;
    
    const config = {
      ...DEFAULT_PERPLEXITY_CONFIG,
      apiKey: mockApiKey,
      baseUrl: baseUrl
    };
    
    perplexityIntegration = PerplexityIntegration.getInstance(config);
    
    // Setup nock to intercept HTTP requests
    nock.cleanAll();
  });

  afterEach(async () => {
    try {
      await perplexityIntegration.shutdown();
    } catch (error) {
      // Ignore shutdown errors
    }
    nock.cleanAll();
  });

  describe('Initialization and Configuration', () => {
    test('should create singleton instance', () => {
      const instance1 = PerplexityIntegration.getInstance();
      const instance2 = PerplexityIntegration.getInstance();
      
      expect(instance1).toBe(instance2);
      expect(instance1).toBeInstanceOf(PerplexityIntegration);
    });

    test('should initialize with custom configuration', async () => {
      const customConfig = {
        ...DEFAULT_PERPLEXITY_CONFIG,
        apiKey: 'custom-key',
        timeout: 60000,
        maxRetries: 5,
        rateLimit: {
          requestsPerMinute: 30,
          requestsPerHour: 500
        }
      };

      const customInstance = PerplexityIntegration.getInstance(customConfig);
      await expect(customInstance.initialize()).resolves.not.toThrow();
      
      const status = customInstance.getStatus();
      expect(status.isRunning).toBe(true);
    });

    test('should validate API key during initialization', async () => {
      const invalidConfig = {
        ...DEFAULT_PERPLEXITY_CONFIG,
        apiKey: ''
      };

      const invalidInstance = PerplexityIntegration.getInstance(invalidConfig);
      
      // Should handle missing API key gracefully
      await expect(invalidInstance.initialize()).resolves.not.toThrow();
    });
  });

  describe('Protocol Research', () => {
    beforeEach(async () => {
      await perplexityIntegration.initialize();
    });

    test('should research protocol successfully', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              analysis: {
                overview: 'Test DeFi Protocol is a leading lending platform',
                marketPosition: 'Strong position in the DeFi lending space',
                competitiveAdvantages: ['High TVL', 'Strong security record', 'Active governance'],
                risks: ['Smart contract risk', 'Market volatility'],
                outlook: 'Positive outlook with continued growth expected'
              },
              confidence: 0.85,
              sources: [
                'https://defipulse.com/test-protocol',
                'https://coindesk.com/test-protocol-analysis'
              ],
              lastUpdated: new Date().toISOString()
            })
          }
        }]
      };

      nock(baseUrl)
        .post('/chat/completions')
        .reply(200, mockResponse);

      const result = await perplexityIntegration.researchProtocol(sampleProtocolData);

      expect(result).toBeDefined();
      expect(result.analysis).toBeDefined();
      expect(result.analysis.overview).toBeDefined();
      expect(result.analysis.marketPosition).toBeDefined();
      expect(result.analysis.competitiveAdvantages).toBeInstanceOf(Array);
      expect(result.analysis.risks).toBeInstanceOf(Array);
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
      expect(result.sources).toBeInstanceOf(Array);
    });

    test('should handle API errors gracefully', async () => {
      nock(baseUrl)
        .post('/chat/completions')
        .reply(500, { error: 'Internal Server Error' });

      await expect(perplexityIntegration.researchProtocol(sampleProtocolData))
        .rejects.toThrow('API request failed');
    });

    test('should respect rate limits', async () => {
      const rateLimitedConfig = {
        ...DEFAULT_PERPLEXITY_CONFIG,
        apiKey: mockApiKey,
        rateLimit: {
          requestsPerMinute: 2,
          requestsPerHour: 10
        }
      };

      const rateLimitedInstance = PerplexityIntegration.getInstance(rateLimitedConfig);
      await rateLimitedInstance.initialize();

      // Mock successful responses
      nock(baseUrl)
        .post('/chat/completions')
        .times(3)
        .reply(200, {
          choices: [{
            message: {
              content: JSON.stringify({
                analysis: { overview: 'Test analysis' },
                confidence: 0.8,
                sources: []
              })
            }
          }]
        });

      // First two requests should succeed
      await expect(rateLimitedInstance.researchProtocol(sampleProtocolData))
        .resolves.not.toThrow();
      await expect(rateLimitedInstance.researchProtocol(sampleProtocolData))
        .resolves.not.toThrow();

      // Third request should be rate limited
      await expect(rateLimitedInstance.researchProtocol(sampleProtocolData))
        .rejects.toThrow('Rate limit exceeded');

      await rateLimitedInstance.shutdown();
    });

    test('should retry failed requests', async () => {
      let callCount = 0;
      
      nock(baseUrl)
        .post('/chat/completions')
        .times(3)
        .reply(() => {
          callCount++;
          if (callCount < 3) {
            return [500, { error: 'Temporary error' }];
          }
          return [200, {
            choices: [{
              message: {
                content: JSON.stringify({
                  analysis: { overview: 'Success after retries' },
                  confidence: 0.8,
                  sources: []
                })
              }
            }]
          }];
        });

      const result = await perplexityIntegration.researchProtocol(sampleProtocolData);
      
      expect(result).toBeDefined();
      expect(result.analysis.overview).toBe('Success after retries');
      expect(callCount).toBe(3);
    });
  });

  describe('RWA Research', () => {
    beforeEach(async () => {
      await perplexityIntegration.initialize();
    });

    test('should research RWA opportunities', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              analysis: {
                marketOverview: 'Real estate tokenization market growing rapidly',
                assetQuality: 'High-quality commercial real estate assets',
                regulatoryEnvironment: 'Favorable regulatory environment in the US',
                liquidityAssessment: 'Limited liquidity but improving',
                riskFactors: ['Market volatility', 'Regulatory changes']
              },
              confidence: 0.78,
              sources: [
                'https://realestate.com/tokenization-report',
                'https://sec.gov/rwa-guidance'
              ]
            })
          }
        }]
      };

      nock(baseUrl)
        .post('/chat/completions')
        .reply(200, mockResponse);

      const result = await perplexityIntegration.researchRWA(sampleRWAData);

      expect(result).toBeDefined();
      expect(result.analysis).toBeDefined();
      expect(result.analysis.marketOverview).toBeDefined();
      expect(result.analysis.assetQuality).toBeDefined();
      expect(result.analysis.regulatoryEnvironment).toBeDefined();
      expect(result.analysis.riskFactors).toBeInstanceOf(Array);
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.sources).toBeInstanceOf(Array);
    });

    test('should handle different RWA types', async () => {
      const artRWA: RWAData = {
        ...sampleRWAData,
        id: 'art-rwa-001',
        type: 'art',
        issuer: 'Fine Art Investment Fund'
      };

      nock(baseUrl)
        .post('/chat/completions')
        .reply(200, {
          choices: [{
            message: {
              content: JSON.stringify({
                analysis: {
                  marketOverview: 'Art market showing strong performance',
                  assetQuality: 'Blue-chip artworks with proven provenance',
                  liquidityAssessment: 'Low liquidity, specialized market'
                },
                confidence: 0.72,
                sources: []
              })
            }
          }]
        });

      const result = await perplexityIntegration.researchRWA(artRWA);
      
      expect(result.analysis.liquidityAssessment).toContain('Low liquidity');
    });
  });

  describe('Market Research', () => {
    beforeEach(async () => {
      await perplexityIntegration.initialize();
    });

    test('should research general market topics', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              findings: {
                overview: 'DeFi lending protocols experiencing growth',
                trends: ['Increased institutional adoption', 'Focus on security'],
                keyPlayers: ['Compound', 'Aave', 'MakerDAO'],
                marketSize: '$50B+ TVL across major protocols',
                growth: 'YoY growth of 150%'
              },
              confidence: 0.82,
              sources: [
                'https://defipulse.com/market-analysis',
                'https://messari.io/defi-report'
              ]
            })
          }
        }]
      };

      nock(baseUrl)
        .post('/chat/completions')
        .reply(200, mockResponse);

      const result = await perplexityIntegration.researchMarket('DeFi lending protocols', 'US');

      expect(result).toBeDefined();
      expect(result.findings).toBeDefined();
      expect(result.findings.overview).toBeDefined();
      expect(result.findings.trends).toBeInstanceOf(Array);
      expect(result.findings.keyPlayers).toBeInstanceOf(Array);
      expect(result.confidence).toBeGreaterThan(0);
    });

    test('should handle jurisdiction-specific research', async () => {
      nock(baseUrl)
        .post('/chat/completions')
        .reply(200, {
          choices: [{
            message: {
              content: JSON.stringify({
                findings: {
                  overview: 'EU crypto regulations under MiCA',
                  regulatoryFramework: 'Markets in Crypto-Assets (MiCA) regulation',
                  compliance: 'Strict compliance requirements'
                },
                confidence: 0.88,
                sources: []
              })
            }
          }]
        });

      const result = await perplexityIntegration.researchMarket('crypto regulations', 'EU');
      
      expect(result.findings.regulatoryFramework).toContain('MiCA');
    });
  });

  describe('Regulatory Research', () => {
    beforeEach(async () => {
      await perplexityIntegration.initialize();
    });

    test('should research regulatory topics', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              regulatory: {
                framework: 'SEC oversight of digital assets',
                recentChanges: ['New guidance on token classification'],
                compliance: 'Enhanced reporting requirements',
                enforcement: 'Increased enforcement actions in 2024',
                outlook: 'Clearer guidelines expected'
              },
              confidence: 0.91,
              sources: [
                'https://sec.gov/digital-assets',
                'https://cftc.gov/crypto-guidance'
              ]
            })
          }
        }]
      };

      nock(baseUrl)
        .post('/chat/completions')
        .reply(200, mockResponse);

      const result = await perplexityIntegration.researchRegulatory('US', 'SEC digital asset regulation');

      expect(result).toBeDefined();
      expect(result.regulatory).toBeDefined();
      expect(result.regulatory.framework).toBeDefined();
      expect(result.regulatory.recentChanges).toBeInstanceOf(Array);
      expect(result.confidence).toBeGreaterThan(0);
    });

    test('should handle different jurisdictions', async () => {
      const jurisdictions = ['US', 'EU', 'UK', 'Singapore'];
      
      for (const jurisdiction of jurisdictions) {
        nock(baseUrl)
          .post('/chat/completions')
          .reply(200, {
            choices: [{
              message: {
                content: JSON.stringify({
                  regulatory: {
                    framework: `${jurisdiction} regulatory framework`,
                    compliance: `${jurisdiction} compliance requirements`
                  },
                  confidence: 0.85,
                  sources: []
                })
              }
            }]
          });

        const result = await perplexityIntegration.researchRegulatory(jurisdiction, 'crypto regulation');
        expect(result.regulatory.framework).toContain(jurisdiction);
      }
    });
  });

  describe('Caching and Performance', () => {
    beforeEach(async () => {
      const cachingConfig = {
        ...DEFAULT_PERPLEXITY_CONFIG,
        apiKey: mockApiKey,
        enableCaching: true,
        cacheTTL: 3600000 // 1 hour
      };
      
      perplexityIntegration = PerplexityIntegration.getInstance(cachingConfig);
      await perplexityIntegration.initialize();
    });

    test('should cache research results', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              analysis: { overview: 'Cached result' },
              confidence: 0.8,
              sources: []
            })
          }
        }]
      };

      // Only expect one API call due to caching
      nock(baseUrl)
        .post('/chat/completions')
        .once()
        .reply(200, mockResponse);

      // First call
      const result1 = await perplexityIntegration.researchProtocol(sampleProtocolData);
      
      // Second call (should be cached)
      const result2 = await perplexityIntegration.researchProtocol(sampleProtocolData);

      expect(result1.analysis.overview).toBe(result2.analysis.overview);
      expect(nock.isDone()).toBe(true); // Confirms only one API call was made
    });

    test('should respect cache TTL', async () => {
      const shortTTLConfig = {
        ...DEFAULT_PERPLEXITY_CONFIG,
        apiKey: mockApiKey,
        enableCaching: true,
        cacheTTL: 100 // 100ms TTL
      };

      const shortTTLInstance = PerplexityIntegration.getInstance(shortTTLConfig);
      await shortTTLInstance.initialize();

      nock(baseUrl)
        .post('/chat/completions')
        .twice()
        .reply(200, {
          choices: [{
            message: {
              content: JSON.stringify({
                analysis: { overview: 'Fresh result' },
                confidence: 0.8,
                sources: []
              })
            }
          }]
        });

      // First call
      await shortTTLInstance.researchProtocol(sampleProtocolData);
      
      // Wait for cache to expire
      await new Promise(resolve => setTimeout(resolve, 150));
      
      // Second call (should not be cached)
      await shortTTLInstance.researchProtocol(sampleProtocolData);

      expect(nock.isDone()).toBe(true); // Confirms two API calls were made
      
      await shortTTLInstance.shutdown();
    });

    test('should handle concurrent requests efficiently', async () => {
      nock(baseUrl)
        .post('/chat/completions')
        .once() // Should only make one request due to request deduplication
        .reply(200, {
          choices: [{
            message: {
              content: JSON.stringify({
                analysis: { overview: 'Concurrent result' },
                confidence: 0.8,
                sources: []
              })
            }
          }]
        });

      // Make multiple concurrent requests for the same data
      const requests = Array.from({ length: 5 }, () => 
        perplexityIntegration.researchProtocol(sampleProtocolData)
      );

      const results = await Promise.all(requests);
      
      expect(results).toHaveLength(5);
      results.forEach(result => {
        expect(result.analysis.overview).toBe('Concurrent result');
      });

      expect(nock.isDone()).toBe(true);
    });
  });

  describe('Error Handling and Resilience', () => {
    beforeEach(async () => {
      await perplexityIntegration.initialize();
    });

    test('should handle network errors', async () => {
      nock(baseUrl)
        .post('/chat/completions')
        .replyWithError('Network error');

      await expect(perplexityIntegration.researchProtocol(sampleProtocolData))
        .rejects.toThrow('Network error');
    });

    test('should handle malformed API responses', async () => {
      nock(baseUrl)
        .post('/chat/completions')
        .reply(200, { invalid: 'response' });

      await expect(perplexityIntegration.researchProtocol(sampleProtocolData))
        .rejects.toThrow();
    });

    test('should handle timeout errors', async () => {
      const timeoutConfig = {
        ...DEFAULT_PERPLEXITY_CONFIG,
        apiKey: mockApiKey,
        timeout: 100 // Very short timeout
      };

      const timeoutInstance = PerplexityIntegration.getInstance(timeoutConfig);
      await timeoutInstance.initialize();

      nock(baseUrl)
        .post('/chat/completions')
        .delay(200) // Delay longer than timeout
        .reply(200, {});

      await expect(timeoutInstance.researchProtocol(sampleProtocolData))
        .rejects.toThrow('timeout');

      await timeoutInstance.shutdown();
    });

    test('should handle API quota exceeded errors', async () => {
      nock(baseUrl)
        .post('/chat/completions')
        .reply(429, { error: 'Quota exceeded' });

      await expect(perplexityIntegration.researchProtocol(sampleProtocolData))
        .rejects.toThrow('API request failed');
    });
  });

  describe('Event Emission', () => {
    beforeEach(async () => {
      await perplexityIntegration.initialize();
    });

    test('should emit research completed events', (done) => {
      nock(baseUrl)
        .post('/chat/completions')
        .reply(200, {
          choices: [{
            message: {
              content: JSON.stringify({
                analysis: { overview: 'Event test' },
                confidence: 0.8,
                sources: []
              })
            }
          }]
        });

      const eventHandler = jest.fn((data: any) => {
        expect(data.type).toBe('protocol');
        expect(data.result).toBeDefined();
        expect(data.timestamp).toBeInstanceOf(Date);
        done();
      });

      perplexityIntegration.on('research_completed', eventHandler);
      
      perplexityIntegration.researchProtocol(sampleProtocolData).catch(done);
    });

    test('should emit error events on failures', (done) => {
      nock(baseUrl)
        .post('/chat/completions')
        .reply(500, { error: 'Server error' });

      const errorHandler = jest.fn((data: any) => {
        expect(data.error).toBeDefined();
        expect(data.timestamp).toBeInstanceOf(Date);
        done();
      });

      perplexityIntegration.on('research_error', errorHandler);
      
      perplexityIntegration.researchProtocol(sampleProtocolData).catch(() => {
        // Expected error
      });
    });
  });

  describe('Configuration and Status', () => {
    test('should provide accurate status information', async () => {
      await perplexityIntegration.initialize();
      
      const status = perplexityIntegration.getStatus();
      
      expect(status.isRunning).toBe(true);
      expect(status.requestCount).toBeDefined();
      expect(status.cacheSize).toBeDefined();
      expect(status.lastRequestTime).toBeInstanceOf(Date);
      expect(status.rateLimitStatus).toBeDefined();
    });

    test('should handle configuration updates', async () => {
      await perplexityIntegration.initialize();
      
      const newConfig = {
        ...DEFAULT_PERPLEXITY_CONFIG,
        timeout: 45000,
        maxRetries: 4
      };

      await expect(perplexityIntegration.updateConfig(newConfig))
        .resolves.not.toThrow();
    });

    test('should shutdown gracefully', async () => {
      await perplexityIntegration.initialize();
      
      await expect(perplexityIntegration.shutdown()).resolves.not.toThrow();
      
      const status = perplexityIntegration.getStatus();
      expect(status.isRunning).toBe(false);
    });
  });
});