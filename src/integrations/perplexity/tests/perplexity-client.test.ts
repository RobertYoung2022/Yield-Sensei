/**
 * Perplexity Client Tests
 * Comprehensive test suite for the Perplexity API client
 */

import { PerplexityClient } from '../client/perplexity-client';
import { PerplexityConfig, PerplexityRequest } from '../types';

// Mock external dependencies
jest.mock('../utils/rate-limiter');
jest.mock('../utils/cache');
jest.mock('../utils/retry-policy');
jest.mock('@/shared/logging/logger');

describe('PerplexityClient', () => {
  let client: PerplexityClient;
  let mockConfig: PerplexityConfig;

  beforeEach(() => {
    mockConfig = {
      apiKey: 'test-api-key',
      baseUrl: 'https://api.perplexity.ai',
      timeout: 30000,
      maxRetries: 3,
      rateLimit: {
        maxRequestsPerMinute: 60,
        maxRequestsPerHour: 1000,
        maxRequestsPerDay: 10000,
        queueSize: 100
      },
      cache: {
        enabled: true,
        ttl: 3600000,
        maxSize: 100,
        strategy: 'lru'
      }
    };

    client = new PerplexityClient(mockConfig);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Constructor', () => {
    it('should create client with valid config', () => {
      expect(client).toBeInstanceOf(PerplexityClient);
    });

    it('should throw error with missing API key', () => {
      const invalidConfig = { ...mockConfig, apiKey: '' };
      expect(() => new PerplexityClient(invalidConfig)).toThrow('Perplexity API key is required');
    });

    it('should use default values for optional config', () => {
      const minimalConfig: PerplexityConfig = {
        apiKey: 'test-key'
      };
      
      const minimalClient = new PerplexityClient(minimalConfig);
      expect(minimalClient).toBeInstanceOf(PerplexityClient);
    });
  });

  describe('Initialization', () => {
    it('should initialize successfully', async () => {
      // Mock successful API connection test
      jest.spyOn(client as any, 'testConnection').mockResolvedValue(undefined);
      
      await expect(client.initialize()).resolves.toBeUndefined();
    });

    it('should handle initialization failure', async () => {
      // Mock failed API connection test
      jest.spyOn(client as any, 'testConnection').mockRejectedValue(new Error('Connection failed'));
      
      await expect(client.initialize()).rejects.toThrow('Connection failed');
    });

    it('should not reinitialize if already initialized', async () => {
      const testConnectionSpy = jest.spyOn(client as any, 'testConnection').mockResolvedValue(undefined);
      
      await client.initialize();
      await client.initialize();
      
      expect(testConnectionSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('Chat API', () => {
    const mockRequest: PerplexityRequest = {
      model: 'sonar-medium-chat',
      messages: [
        { role: 'user', content: 'Test message' }
      ],
      max_tokens: 100
    };

    const mockResponse = {
      id: 'test-id',
      model: 'sonar-medium-chat',
      created: Date.now(),
      usage: {
        prompt_tokens: 10,
        completion_tokens: 20,
        total_tokens: 30
      },
      choices: [
        {
          index: 0,
          finish_reason: 'stop',
          message: {
            role: 'assistant',
            content: 'Test response'
          }
        }
      ]
    };

    beforeEach(async () => {
      jest.spyOn(client as any, 'testConnection').mockResolvedValue(undefined);
      await client.initialize();
    });

    it('should make successful chat request', async () => {
      const mockMakeRequest = jest.spyOn(client as any, 'makeRequest').mockResolvedValue(mockResponse);
      
      const result = await client.chat(mockRequest);
      
      expect(result).toEqual(mockResponse);
      expect(mockMakeRequest).toHaveBeenCalledWith(mockRequest);
    });

    it('should handle rate limiting', async () => {
      const rateLimiter = (client as any).rateLimiter;
      const executeSpy = jest.spyOn(rateLimiter, 'execute').mockImplementation(
        (fn: () => Promise<any>) => fn()
      );
      
      jest.spyOn(client as any, 'makeRequest').mockResolvedValue(mockResponse);
      
      await client.chat(mockRequest);
      
      expect(executeSpy).toHaveBeenCalled();
    });

    it('should use cache when enabled', async () => {
      const cache = (client as any).cache;
      const getSpy = jest.spyOn(cache, 'get').mockResolvedValue(mockResponse);
      
      await client.chat(mockRequest);
      
      expect(getSpy).toHaveBeenCalled();
    });

    it('should update metrics on successful request', async () => {
      jest.spyOn(client as any, 'makeRequest').mockResolvedValue(mockResponse);
      
      await client.chat(mockRequest);
      
      const metrics = client.getMetrics();
      expect(metrics.totalRequests).toBeGreaterThan(0);
      expect(metrics.successfulRequests).toBeGreaterThan(0);
      expect(metrics.tokensUsed).toBe(30);
    });

    it('should update metrics on failed request', async () => {
      jest.spyOn(client as any, 'makeRequest').mockRejectedValue(new Error('API Error'));
      
      await expect(client.chat(mockRequest)).rejects.toThrow('API Error');
      
      const metrics = client.getMetrics();
      expect(metrics.failedRequests).toBeGreaterThan(0);
    });
  });

  describe('Stream Chat', () => {
    const mockStreamRequest: PerplexityRequest = {
      model: 'sonar-medium-chat',
      messages: [
        { role: 'user', content: 'Test stream message' }
      ],
      max_tokens: 100,
      stream: true
    };

    beforeEach(async () => {
      jest.spyOn(client as any, 'testConnection').mockResolvedValue(undefined);
      await client.initialize();
    });

    it('should handle streaming requests', async () => {
      const mockStream = {
        on: jest.fn((event, callback) => {
          if (event === 'data') {
            // Simulate stream data
            setTimeout(() => callback(Buffer.from('data: {"choices":[{"delta":{"content":"test"}}]}\n')), 10);
          } else if (event === 'end') {
            setTimeout(() => callback(), 20);
          }
        })
      };

      const mockAxiosResponse = {
        data: mockStream
      };

      jest.spyOn((client as any).httpClient, 'post').mockResolvedValue(mockAxiosResponse);

      const chunks: any[] = [];
      const onChunk = jest.fn((chunk) => chunks.push(chunk));

      await client.streamChat(mockStreamRequest, onChunk);

      expect(onChunk).toHaveBeenCalled();
    });
  });

  describe('Configuration', () => {
    it('should update configuration', () => {
      const newConfig = {
        timeout: 60000,
        maxRetries: 5
      };

      client.updateConfig(newConfig);

      // Verify configuration was updated
      expect((client as any).config.timeout).toBe(60000);
      expect((client as any).config.maxRetries).toBe(5);
    });

    it('should get current metrics', () => {
      const metrics = client.getMetrics();

      expect(metrics).toHaveProperty('totalRequests');
      expect(metrics).toHaveProperty('successfulRequests');
      expect(metrics).toHaveProperty('failedRequests');
      expect(metrics).toHaveProperty('cacheHits');
      expect(metrics).toHaveProperty('cacheMisses');
      expect(metrics).toHaveProperty('rateLimitStatus');
    });

    it('should get cache stats', () => {
      const stats = client.getCacheStats();
      expect(stats).toBeDefined();
    });

    it('should get circuit breaker state', () => {
      const state = client.getCircuitBreakerState();
      expect(state).toBeDefined();
    });
  });

  describe('Cache Management', () => {
    it('should clear cache', () => {
      const cache = (client as any).cache;
      const clearSpy = jest.spyOn(cache, 'clear');

      client.clearCache();

      expect(clearSpy).toHaveBeenCalled();
    });
  });

  describe('Shutdown', () => {
    it('should shutdown gracefully', async () => {
      const rateLimiter = (client as any).rateLimiter;
      const cache = (client as any).cache;
      
      const rateLimiterShutdownSpy = jest.spyOn(rateLimiter, 'shutdown');
      const cacheShutdownSpy = jest.spyOn(cache, 'shutdown').mockResolvedValue(undefined);

      await client.shutdown();

      expect(rateLimiterShutdownSpy).toHaveBeenCalled();
      expect(cacheShutdownSpy).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should transform axios errors correctly', () => {
      const axiosError = {
        message: 'Request failed',
        code: 'ECONNRESET',
        response: {
          status: 500,
          data: { error: 'Internal server error' },
          headers: { 'retry-after': '60' }
        }
      };

      const transformedError = (client as any).transformError(axiosError);

      expect(transformedError.code).toBe('ECONNRESET');
      expect(transformedError.statusCode).toBe(500);
      expect(transformedError.details).toEqual({ error: 'Internal server error' });
      expect(transformedError.retryAfter).toBe(60);
      expect(transformedError.retryable).toBe(true);
    });

    it('should identify retryable errors', () => {
      const retryableError = {
        response: { status: 429 }
      };

      const nonRetryableError = {
        response: { status: 400 }
      };

      expect((client as any).isRetryableError(retryableError)).toBe(true);
      expect((client as any).isRetryableError(nonRetryableError)).toBe(false);
    });
  });

  describe('Event Handling', () => {
    it('should emit events correctly', async () => {
      const eventSpy = jest.fn();
      client.on('event', eventSpy);

      jest.spyOn(client as any, 'testConnection').mockResolvedValue(undefined);
      await client.initialize();

      // Events should be emitted during HTTP requests
      expect(eventSpy).toHaveBeenCalled();
    });
  });
});