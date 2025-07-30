/**
 * Comprehensive Perplexity API Integration Tests
 * Tests all layers of the Perplexity integration architecture
 */

import { jest } from '@jest/globals';
import axios, { AxiosInstance } from 'axios';
import { EventEmitter } from 'events';
import { PerplexityClient } from '../../../src/integrations/perplexity/client/perplexity-client';
import { PerplexityIntegration } from '../../../src/satellites/sage/api/perplexity-integration';
import { PerplexityClient as OraclePerplexityClient } from '../../../src/satellites/oracle/sources/perplexity-client';

// Test utilities and mocks
import { MockPerplexityServer } from './utils/mock-perplexity-server';
import { PerplexityTestConfig, createTestConfig } from './utils/test-config';
import { PerplexityTestData } from './fixtures/test-data';

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

describe('Perplexity API Integration Test Suite', () => {
  let mockServer: MockPerplexityServer;
  let testConfig: PerplexityTestConfig;
  let mockAxiosInstance: jest.Mocked<AxiosInstance>;

  beforeAll(async () => {
    // Initialize mock server for API simulation
    mockServer = new MockPerplexityServer();
    await mockServer.start();
    
    // Create test configuration
    testConfig = createTestConfig({
      baseUrl: mockServer.getBaseUrl(),
      apiKey: 'test-api-key-12345'
    });
  });

  afterAll(async () => {
    // Clean up mock server
    if (mockServer) {
      await mockServer.stop();
    }
  });

  beforeEach(() => {
    jest.clearAllMocks();
    
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

  describe('Core Client Integration Tests', () => {
    let client: PerplexityClient;

    beforeEach(() => {
      client = new PerplexityClient(testConfig.coreClient);
    });

    afterEach(async () => {
      try {
        await client.shutdown();
      } catch (error) {
        // Ignore shutdown errors in tests
      }
    });

    describe('API Authentication & Authorization', () => {
      test('should authenticate with valid API key', async () => {
        mockAxiosInstance.post.mockResolvedValueOnce({
          data: PerplexityTestData.mockSuccessResponse,
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {}
        });

        await client.initialize();
        
        const response = await client.query({
          messages: [{ role: 'user', content: 'Test query' }],
          model: 'llama-3.1-sonar-small-128k-online'
        });

        expect(response).toBeDefined();
        expect(mockAxiosInstance.post).toHaveBeenCalledWith(
          '/chat/completions',
          expect.objectContaining({
            messages: [{ role: 'user', content: 'Test query' }]
          }),
          expect.objectContaining({
            headers: expect.objectContaining({
              'Authorization': 'Bearer test-api-key-12345'
            })
          })
        );
      });

      test('should reject invalid API key', async () => {
        const invalidConfig = {
          ...testConfig.coreClient,
          apiKey: 'invalid-key'
        };
        
        mockAxiosInstance.post.mockRejectedValueOnce({
          response: {
            status: 401,
            data: { error: 'Invalid API key' }
          }
        });

        const invalidClient = new PerplexityClient(invalidConfig);
        await invalidClient.initialize();

        await expect(invalidClient.query({
          messages: [{ role: 'user', content: 'Test' }],
          model: 'llama-3.1-sonar-small-128k-online'
        })).rejects.toThrow();
      });

      test('should handle expired API key', async () => {
        mockAxiosInstance.post.mockRejectedValueOnce({
          response: {
            status: 403,
            data: { error: 'API key expired' }
          }
        });

        await client.initialize();

        await expect(client.query({
          messages: [{ role: 'user', content: 'Test' }],
          model: 'llama-3.1-sonar-small-128k-online'
        })).rejects.toThrow();
      });
    });

    describe('Request/Response Validation', () => {
      beforeEach(async () => {
        await client.initialize();
      });

      test('should validate request schema', async () => {
        mockAxiosInstance.post.mockResolvedValueOnce({
          data: PerplexityTestData.mockSuccessResponse,
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {}
        });

        const validRequest = {
          messages: [{ role: 'user', content: 'Valid query' }],
          model: 'llama-3.1-sonar-small-128k-online',
          max_tokens: 1000,
          temperature: 0.7,
          return_citations: true,
          return_related_questions: false
        };

        const response = await client.query(validRequest);
        expect(response).toBeDefined();
        expect(mockAxiosInstance.post).toHaveBeenCalledWith(
          '/chat/completions',
          expect.objectContaining(validRequest),
          expect.any(Object)
        );
      });

      test('should reject invalid request parameters', async () => {
        const invalidRequests = [
          { messages: [] }, // Empty messages
          { messages: [{ role: 'invalid', content: 'test' }] }, // Invalid role
          { messages: [{ role: 'user', content: '' }] }, // Empty content
          { messages: [{ role: 'user', content: 'test' }], max_tokens: -1 }, // Negative tokens
          { messages: [{ role: 'user', content: 'test' }], temperature: 2.5 } // Invalid temperature
        ];

        for (const invalidRequest of invalidRequests) {
          await expect(client.query(invalidRequest as any))
            .rejects.toThrow();
        }
      });

      test('should validate response schema', async () => {
        const mockResponse = {
          id: 'test-response-id',
          object: 'chat.completion',
          created: Date.now(),
          model: 'llama-3.1-sonar-small-128k-online',
          choices: [{
            index: 0,
            finish_reason: 'stop',
            message: {
              role: 'assistant',
              content: 'Test response content'
            }
          }],
          usage: {
            prompt_tokens: 10,
            completion_tokens: 20,
            total_tokens: 30
          },
          citations: ['https://example.com/source1']
        };

        mockAxiosInstance.post.mockResolvedValueOnce({
          data: mockResponse,
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {}
        });

        const response = await client.query({
          messages: [{ role: 'user', content: 'Test' }],
          model: 'llama-3.1-sonar-small-128k-online'
        });

        expect(response.id).toBe('test-response-id');
        expect(response.choices).toHaveLength(1);
        expect(response.choices[0].message.content).toBe('Test response content');
        expect(response.usage.total_tokens).toBe(30);
        expect(response.citations).toContain('https://example.com/source1');
      });

      test('should handle malformed response gracefully', async () => {
        mockAxiosInstance.post.mockResolvedValueOnce({
          data: { invalid: 'response' },
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {}
        });

        await expect(client.query({
          messages: [{ role: 'user', content: 'Test' }],
          model: 'llama-3.1-sonar-small-128k-online'
        })).rejects.toThrow('Invalid response format');
      });
    });

    describe('Rate Limiting & Throttling', () => {
      beforeEach(async () => {
        await client.initialize();
      });

      test('should respect rate limits', async () => {
        const rateLimitConfig = {
          ...testConfig.coreClient,
          rateLimit: {
            maxRequestsPerMinute: 2,
            maxRequestsPerHour: 10,
            maxRequestsPerDay: 50,
            queueSize: 5
          }
        };

        const rateLimitedClient = new PerplexityClient(rateLimitConfig);
        await rateLimitedClient.initialize();

        mockAxiosInstance.post.mockResolvedValue({
          data: PerplexityTestData.mockSuccessResponse,
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {}
        });

        // Make requests that exceed rate limit
        const requests = Array.from({ length: 5 }, (_, i) => 
          rateLimitedClient.query({
            messages: [{ role: 'user', content: `Query ${i}` }],
            model: 'llama-3.1-sonar-small-128k-online'
          })
        );

        const results = await Promise.allSettled(requests);
        
        // Some requests should be rate limited
        const successful = results.filter(r => r.status === 'fulfilled');
        const rateLimited = results.filter(r => r.status === 'rejected');
        
        expect(successful.length).toBeLessThanOrEqual(2); // Within minute limit
        expect(rateLimited.length).toBeGreaterThan(0);
      });

      test('should implement token bucket algorithm correctly', async () => {
        const client = new PerplexityClient({
          ...testConfig.coreClient,
          rateLimit: {
            maxRequestsPerMinute: 3,
            maxRequestsPerHour: 100,
            maxRequestsPerDay: 1000,
            enableBurstMode: true,
            burstLimit: 5
          }
        });

        await client.initialize();

        mockAxiosInstance.post.mockResolvedValue({
          data: PerplexityTestData.mockSuccessResponse,
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {}
        });

        // Test burst capability
        const burstRequests = Array.from({ length: 5 }, (_, i) => 
          client.query({
            messages: [{ role: 'user', content: `Burst query ${i}` }],
            model: 'llama-3.1-sonar-small-128k-online'
          })
        );

        const burstResults = await Promise.allSettled(burstRequests);
        const successfulBurst = burstResults.filter(r => r.status === 'fulfilled');
        
        // Should allow burst up to limit
        expect(successfulBurst.length).toBeGreaterThan(3);
        expect(successfulBurst.length).toBeLessThanOrEqual(5);
      });

      test('should handle rate limit headers from API', async () => {
        mockAxiosInstance.post.mockResolvedValueOnce({
          data: PerplexityTestData.mockSuccessResponse,
          status: 200,
          statusText: 'OK',
          headers: {
            'x-ratelimit-limit-requests': '60',
            'x-ratelimit-remaining-requests': '59',
            'x-ratelimit-reset-requests': '2024-01-01T00:01:00Z'
          },
          config: {}
        });

        const response = await client.query({
          messages: [{ role: 'user', content: 'Test' }],
          model: 'llama-3.1-sonar-small-128k-online'
        });

        expect(response).toBeDefined();
        
        const rateLimitStatus = client.getRateLimitStatus();
        expect(rateLimitStatus.remaining).toBe(59);
        expect(rateLimitStatus.limit).toBe(60);
      });
    });

    describe('Error Handling & Recovery', () => {
      beforeEach(async () => {
        await client.initialize();
      });

      test('should handle network errors with retry', async () => {
        // First two calls fail, third succeeds
        mockAxiosInstance.post
          .mockRejectedValueOnce(new Error('Network error'))
          .mockRejectedValueOnce(new Error('Network error'))
          .mockResolvedValueOnce({
            data: PerplexityTestData.mockSuccessResponse,
            status: 200,
            statusText: 'OK',
            headers: {},
            config: {}
          });

        const response = await client.query({
          messages: [{ role: 'user', content: 'Test retry' }],
          model: 'llama-3.1-sonar-small-128k-online'
        });

        expect(response).toBeDefined();
        expect(mockAxiosInstance.post).toHaveBeenCalledTimes(3);
      });

      test('should implement circuit breaker pattern', async () => {
        // Configure client with low failure threshold
        const circuitBreakerClient = new PerplexityClient({
          ...testConfig.coreClient,
          circuitBreaker: {
            failureThreshold: 2,
            successThreshold: 1,
            timeout: 1000,
            resetTimeout: 5000
          }
        });

        await circuitBreakerClient.initialize();

        // Cause failures to trip circuit breaker
        mockAxiosInstance.post.mockRejectedValue(new Error('Service unavailable'));

        // First two requests should fail and trip circuit breaker
        await expect(circuitBreakerClient.query({
          messages: [{ role: 'user', content: 'Test 1' }],
          model: 'llama-3.1-sonar-small-128k-online'
        })).rejects.toThrow();

        await expect(circuitBreakerClient.query({
          messages: [{ role: 'user', content: 'Test 2' }],
          model: 'llama-3.1-sonar-small-128k-online'
        })).rejects.toThrow();

        // Third request should be rejected by circuit breaker without API call
        await expect(circuitBreakerClient.query({
          messages: [{ role: 'user', content: 'Test 3' }],
          model: 'llama-3.1-sonar-small-128k-online'
        })).rejects.toThrow('Circuit breaker is open');

        expect(mockAxiosInstance.post).toHaveBeenCalledTimes(2);
      });

      test('should handle API error responses appropriately', async () => {
        const errorScenarios = [
          { status: 400, error: 'Bad Request', expectedError: 'Invalid request' },
          { status: 401, error: 'Unauthorized', expectedError: 'Authentication failed' },
          { status: 403, error: 'Forbidden', expectedError: 'Access denied' },
          { status: 429, error: 'Too Many Requests', expectedError: 'Rate limit exceeded' },
          { status: 500, error: 'Internal Server Error', expectedError: 'Server error' },
          { status: 503, error: 'Service Unavailable', expectedError: 'Service temporarily unavailable' }
        ];

        for (const scenario of errorScenarios) {
          mockAxiosInstance.post.mockRejectedValueOnce({
            response: {
              status: scenario.status,
              data: { error: scenario.error }
            }
          });

          await expect(client.query({
            messages: [{ role: 'user', content: 'Test error' }],
            model: 'llama-3.1-sonar-small-128k-online'
          })).rejects.toThrow();
        }
      });

      test('should implement exponential backoff with jitter', async () => {
        const startTime = Date.now();
        
        // Mock failures then success
        mockAxiosInstance.post
          .mockRejectedValueOnce({ response: { status: 503 } })
          .mockRejectedValueOnce({ response: { status: 503 } })
          .mockResolvedValueOnce({
            data: PerplexityTestData.mockSuccessResponse,
            status: 200,
            statusText: 'OK',
            headers: {},
            config: {}
          });

        await client.query({
          messages: [{ role: 'user', content: 'Test backoff' }],
          model: 'llama-3.1-sonar-small-128k-online'
        });

        const elapsed = Date.now() - startTime;
        
        // Should have waited for retries (at least 1s + 2s + jitter)
        expect(elapsed).toBeGreaterThan(3000);
        expect(mockAxiosInstance.post).toHaveBeenCalledTimes(3);
      });
    });
  });

  describe('Caching System Integration Tests', () => {
    let cachingClient: PerplexityClient;

    beforeEach(async () => {
      cachingClient = new PerplexityClient({
        ...testConfig.coreClient,
        cache: {
          enabled: true,
          ttl: 60000, // 1 minute
          maxSize: 10,
          strategy: 'lru',
          persistToDisk: false
        }
      });
      await cachingClient.initialize();
    });

    afterEach(async () => {
      await cachingClient.shutdown();
    });

    test('should cache successful responses', async () => {
      mockAxiosInstance.post.mockResolvedValue({
        data: PerplexityTestData.mockSuccessResponse,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {}
      });

      const query = {
        messages: [{ role: 'user', content: 'Cacheable query' }],
        model: 'llama-3.1-sonar-small-128k-online'
      };

      // First request
      const response1 = await cachingClient.query(query);
      expect(response1).toBeDefined();
      expect(mockAxiosInstance.post).toHaveBeenCalledTimes(1);

      // Second identical request should use cache
      const response2 = await cachingClient.query(query);
      expect(response2).toBeDefined();
      expect(mockAxiosInstance.post).toHaveBeenCalledTimes(1); // No additional API call

      // Responses should be identical
      expect(response1.id).toBe(response2.id);
    });

    test('should support different caching strategies', async () => {
      const strategies = ['lru', 'lfu', 'fifo'] as const;

      for (const strategy of strategies) {
        const client = new PerplexityClient({
          ...testConfig.coreClient,
          cache: {
            enabled: true,
            ttl: 60000,
            maxSize: 3,
            strategy,
            persistToDisk: false
          }
        });

        await client.initialize();

        mockAxiosInstance.post.mockResolvedValue({
          data: PerplexityTestData.mockSuccessResponse,
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {}
        });

        // Fill cache beyond capacity
        for (let i = 0; i < 5; i++) {
          await client.query({
            messages: [{ role: 'user', content: `Query ${i}` }],
            model: 'llama-3.1-sonar-small-128k-online'
          });
        }

        const cacheStats = client.getCacheStats();
        expect(cacheStats.size).toBeLessThanOrEqual(3);
        expect(cacheStats.strategy).toBe(strategy);

        await client.shutdown();
      }
    });

    test('should respect cache TTL', async () => {
      const shortTTLClient = new PerplexityClient({
        ...testConfig.coreClient,
        cache: {
          enabled: true,
          ttl: 100, // 100ms
          maxSize: 10,
          strategy: 'lru'
        }
      });

      await shortTTLClient.initialize();

      mockAxiosInstance.post.mockResolvedValue({
        data: PerplexityTestData.mockSuccessResponse,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {}
      });

      const query = {
        messages: [{ role: 'user', content: 'TTL test query' }],
        model: 'llama-3.1-sonar-small-128k-online'
      };

      // First request
      await shortTTLClient.query(query);
      expect(mockAxiosInstance.post).toHaveBeenCalledTimes(1);

      // Wait for cache to expire
      await new Promise(resolve => setTimeout(resolve, 150));

      // Second request should make new API call
      await shortTTLClient.query(query);
      expect(mockAxiosInstance.post).toHaveBeenCalledTimes(2);

      await shortTTLClient.shutdown();
    });
  });

  describe('Metrics and Monitoring Integration', () => {
    let metricsClient: PerplexityClient;

    beforeEach(async () => {
      metricsClient = new PerplexityClient(testConfig.coreClient);
      await metricsClient.initialize();
    });

    afterEach(async () => {
      await metricsClient.shutdown();
    });

    test('should track request metrics', async () => {
      mockAxiosInstance.post.mockResolvedValue({
        data: {
          ...PerplexityTestData.mockSuccessResponse,
          usage: {
            prompt_tokens: 50,
            completion_tokens: 100,
            total_tokens: 150
          }
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {}
      });

      await metricsClient.query({
        messages: [{ role: 'user', content: 'Metrics test' }],
        model: 'llama-3.1-sonar-small-128k-online'
      });

      const metrics = metricsClient.getMetrics();
      
      expect(metrics.totalRequests).toBe(1);
      expect(metrics.successfulRequests).toBe(1);
      expect(metrics.failedRequests).toBe(0);
      expect(metrics.tokensUsed).toBe(150);
      expect(metrics.averageLatency).toBeGreaterThan(0);
    });

    test('should track error metrics', async () => {
      mockAxiosInstance.post.mockRejectedValue(new Error('Test error'));

      try {
        await metricsClient.query({
          messages: [{ role: 'user', content: 'Error test' }],
          model: 'llama-3.1-sonar-small-128k-online'
        });
      } catch (error) {
        // Expected error
      }

      const metrics = metricsClient.getMetrics();
      
      expect(metrics.totalRequests).toBe(1);
      expect(metrics.successfulRequests).toBe(0);
      expect(metrics.failedRequests).toBe(1);
    });

    test('should estimate costs based on token usage', async () => {
      mockAxiosInstance.post.mockResolvedValue({
        data: {
          ...PerplexityTestData.mockSuccessResponse,
          usage: {
            prompt_tokens: 1000,
            completion_tokens: 2000,
            total_tokens: 3000
          }
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {}
      });

      await metricsClient.query({
        messages: [{ role: 'user', content: 'Cost estimation test' }],
        model: 'llama-3.1-sonar-small-128k-online'
      });

      const metrics = metricsClient.getMetrics();
      
      expect(metrics.tokensUsed).toBe(3000);
      expect(metrics.costEstimate).toBeGreaterThan(0);
    });
  });

  describe('Event System Integration', () => {
    let eventClient: PerplexityClient;
    let eventsSpy: jest.Mock;

    beforeEach(async () => {
      eventClient = new PerplexityClient(testConfig.coreClient);
      await eventClient.initialize();
      
      eventsSpy = jest.fn();
    });

    afterEach(async () => {
      eventClient.removeAllListeners();
      await eventClient.shutdown();
    });

    test('should emit query events', async () => {
      mockAxiosInstance.post.mockResolvedValue({
        data: PerplexityTestData.mockSuccessResponse,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {}
      });

      eventClient.on('query:start', eventsSpy);
      eventClient.on('query:success', eventsSpy);
      eventClient.on('query:complete', eventsSpy);

      await eventClient.query({
        messages: [{ role: 'user', content: 'Event test' }],
        model: 'llama-3.1-sonar-small-128k-online'
      });

      expect(eventsSpy).toHaveBeenCalledTimes(3);
      expect(eventsSpy).toHaveBeenNthCalledWith(1, expect.objectContaining({
        type: 'query:start'
      }));
      expect(eventsSpy).toHaveBeenNthCalledWith(2, expect.objectContaining({
        type: 'query:success'
      }));
      expect(eventsSpy).toHaveBeenNthCalledWith(3, expect.objectContaining({
        type: 'query:complete'
      }));
    });

    test('should emit error events', async () => {
      mockAxiosInstance.post.mockRejectedValue(new Error('Test error'));

      eventClient.on('query:error', eventsSpy);
      eventClient.on('query:complete', eventsSpy);

      try {
        await eventClient.query({
          messages: [{ role: 'user', content: 'Error event test' }],
          model: 'llama-3.1-sonar-small-128k-online'
        });
      } catch (error) {
        // Expected error
      }

      expect(eventsSpy).toHaveBeenCalledTimes(2);
      expect(eventsSpy).toHaveBeenNthCalledWith(1, expect.objectContaining({
        type: 'query:error'
      }));
      expect(eventsSpy).toHaveBeenNthCalledWith(2, expect.objectContaining({
        type: 'query:complete'
      }));
    });

    test('should emit rate limit events', async () => {
      const rateLimitClient = new PerplexityClient({
        ...testConfig.coreClient,
        rateLimit: {
          maxRequestsPerMinute: 1,
          maxRequestsPerHour: 10,
          maxRequestsPerDay: 100
        }
      });

      await rateLimitClient.initialize();

      rateLimitClient.on('rateLimit:exceeded', eventsSpy);

      mockAxiosInstance.post.mockResolvedValue({
        data: PerplexityTestData.mockSuccessResponse,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {}
      });

      // Make requests that exceed rate limit
      const requests = Array.from({ length: 3 }, () => 
        rateLimitClient.query({
          messages: [{ role: 'user', content: 'Rate limit test' }],
          model: 'llama-3.1-sonar-small-128k-online'
        }).catch(() => {}) // Ignore errors for this test
      );

      await Promise.all(requests);

      expect(eventsSpy).toHaveBeenCalled();
      await rateLimitClient.shutdown();
    });
  });
});