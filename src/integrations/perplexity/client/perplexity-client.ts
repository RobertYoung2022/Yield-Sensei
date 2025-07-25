/**
 * Perplexity API Client
 * Core client implementation with all features integrated
 */

import axios, { AxiosInstance, AxiosError } from 'axios';
import { EventEmitter } from 'events';
import { 
  PerplexityConfig, 
  PerplexityRequest, 
  PerplexityResponse,
  PerplexityError,
  PerplexityMetrics,
  PerplexityEvent
} from '../types';
import { RateLimiter } from '../utils/rate-limiter';
import { Cache } from '../utils/cache';
import { RetryPolicy, CircuitBreaker } from '../utils/retry-policy';
import Logger from '@/shared/logging/logger';

const logger = Logger.getLogger('perplexity-client');

export class PerplexityClient extends EventEmitter {
  private config: PerplexityConfig;
  private httpClient: AxiosInstance;
  private rateLimiter: RateLimiter;
  private cache: Cache<PerplexityResponse>;
  private retryPolicy: RetryPolicy;
  private circuitBreaker: CircuitBreaker;
  private metrics: PerplexityMetrics;
  private isInitialized: boolean = false;

  constructor(config: PerplexityConfig) {
    super();
    this.config = this.validateConfig(config);
    
    // Initialize HTTP client
    this.httpClient = this.createHttpClient();
    
    // Initialize rate limiter
    this.rateLimiter = new RateLimiter({
      maxRequestsPerMinute: config.rateLimit?.maxRequestsPerMinute || 60,
      maxRequestsPerHour: config.rateLimit?.maxRequestsPerHour || 1000,
      maxRequestsPerDay: config.rateLimit?.maxRequestsPerDay || 10000,
      queueSize: config.rateLimit?.queueSize || 100,
      enableBurstMode: config.rateLimit?.enableBurstMode || false,
      burstLimit: config.rateLimit?.burstLimit || 10
    });

    // Initialize cache
    this.cache = new Cache<PerplexityResponse>({
      enabled: config.cache?.enabled ?? true,
      ttl: config.cache?.ttl || 3600000, // 1 hour
      maxSize: config.cache?.maxSize || 100, // 100 MB
      strategy: config.cache?.strategy || 'lru',
      persistToDisk: config.cache?.persistToDisk || false,
      diskPath: config.cache?.diskPath
    });

    // Initialize retry policy
    this.retryPolicy = new RetryPolicy({
      maxRetries: config.maxRetries || 3,
      initialDelay: 1000,
      maxDelay: 30000,
      backoffFactor: 2,
      jitterFactor: 0.1
    });

    // Initialize circuit breaker
    this.circuitBreaker = new CircuitBreaker({
      failureThreshold: 5,
      successThreshold: 2,
      timeout: 60000, // 1 minute
      resetTimeout: 300000 // 5 minutes
    });

    // Initialize metrics
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      cacheHits: 0,
      cacheMisses: 0,
      averageLatency: 0,
      tokensUsed: 0,
      costEstimate: 0,
      rateLimitStatus: this.rateLimiter.getStatus()
    };

    this.setupEventListeners();
  }

  private validateConfig(config: PerplexityConfig): PerplexityConfig {
    if (!config.apiKey) {
      throw new Error('Perplexity API key is required');
    }

    return {
      ...config,
      baseUrl: config.baseUrl || 'https://api.perplexity.ai',
      timeout: config.timeout || 30000
    };
  }

  private createHttpClient(): AxiosInstance {
    const client = axios.create({
      baseURL: this.config.baseUrl,
      timeout: this.config.timeout,
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
        'User-Agent': 'YieldSensei-Perplexity-Client/1.0'
      }
    });

    // Add request interceptor
    client.interceptors.request.use(
      (config) => {
        const event: PerplexityEvent = {
          type: 'request',
          timestamp: new Date(),
          data: {
            method: config.method,
            url: config.url,
            headers: config.headers
          }
        };
        this.emit('event', event);
        return config;
      },
      (error) => {
        logger.error('Request interceptor error:', error);
        return Promise.reject(error);
      }
    );

    // Add response interceptor
    client.interceptors.response.use(
      (response) => {
        const event: PerplexityEvent = {
          type: 'response',
          timestamp: new Date(),
          data: {
            status: response.status,
            statusText: response.statusText,
            headers: response.headers
          }
        };
        this.emit('event', event);
        return response;
      },
      (error: AxiosError) => {
        const event: PerplexityEvent = {
          type: 'error',
          timestamp: new Date(),
          data: {
            message: error.message,
            code: error.code,
            status: error.response?.status
          }
        };
        this.emit('event', event);
        return Promise.reject(this.transformError(error));
      }
    );

    return client;
  }

  private transformError(error: AxiosError): PerplexityError {
    const perplexityError = new Error(error.message) as PerplexityError;
    perplexityError.code = error.code || 'UNKNOWN_ERROR';
    perplexityError.statusCode = error.response?.status;
    perplexityError.details = error.response?.data;
    
    // Determine if error is retryable
    perplexityError.retryable = this.isRetryableError(error);
    
    // Extract retry-after header if present
    if (error.response?.headers['retry-after']) {
      perplexityError.retryAfter = parseInt(error.response.headers['retry-after']);
    }

    return perplexityError;
  }

  private isRetryableError(error: AxiosError): boolean {
    // Network errors are retryable
    if (!error.response) return true;
    
    // Specific status codes are retryable
    const retryableStatusCodes = [408, 429, 500, 502, 503, 504];
    return retryableStatusCodes.includes(error.response.status);
  }

  private setupEventListeners(): void {
    // Rate limiter events
    this.rateLimiter.on('request-queued', (data) => {
      logger.debug('Request queued', data);
    });

    this.rateLimiter.on('request-completed', (data) => {
      logger.debug('Request completed', data);
    });

    // Cache events
    this.cache.on('cache-hit', (data) => {
      this.metrics.cacheHits++;
      logger.debug('Cache hit', data);
    });

    this.cache.on('cache-miss', (data) => {
      this.metrics.cacheMisses++;
      logger.debug('Cache miss', data);
    });

    // Retry policy events
    this.retryPolicy.on('retry-attempt', (data) => {
      logger.debug('Retry attempt', data);
    });

    this.retryPolicy.on('retry-error', (data) => {
      logger.warn('Retry error', data);
    });

    // Circuit breaker events
    this.circuitBreaker.on('state-change', (data) => {
      logger.info('Circuit breaker state change', data);
    });
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      logger.info('Initializing Perplexity client...');

      // Test API connection
      await this.testConnection();

      this.isInitialized = true;
      logger.info('Perplexity client initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Perplexity client:', error);
      throw error;
    }
  }

  private async testConnection(): Promise<void> {
    const testRequest: PerplexityRequest = {
      model: 'sonar-small-chat',
      messages: [
        { role: 'user', content: 'Test connection' }
      ],
      max_tokens: 10
    };

    try {
      await this.chat(testRequest);
      logger.info('API connection test successful');
    } catch (error) {
      logger.error('API connection test failed:', error);
      throw new Error('Failed to connect to Perplexity API');
    }
  }

  async chat(request: PerplexityRequest): Promise<PerplexityResponse> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const startTime = Date.now();
    this.metrics.totalRequests++;

    try {
      // Generate cache key
      const cacheKey = this.cache.generateKey(request);
      
      // Check cache if enabled
      if (this.config.cache?.enabled) {
        const cached = await this.cache.get(cacheKey);
        if (cached) {
          return cached;
        }
      }

      // Execute request with rate limiting, circuit breaking, and retry
      const response = await this.rateLimiter.execute(() =>
        this.circuitBreaker.execute(() =>
          this.retryPolicy.execute(() =>
            this.makeRequest(request)
          )
        )
      );

      // Update metrics
      this.metrics.successfulRequests++;
      this.metrics.tokensUsed += response.usage.total_tokens;
      this.updateCostEstimate(response.usage.total_tokens);
      this.updateAverageLatency(Date.now() - startTime);

      // Cache response if enabled
      if (this.config.cache?.enabled) {
        await this.cache.set(cacheKey, response);
      }

      return response;
    } catch (error) {
      this.metrics.failedRequests++;
      throw error;
    }
  }

  private async makeRequest(request: PerplexityRequest): Promise<PerplexityResponse> {
    const response = await this.httpClient.post<PerplexityResponse>(
      '/chat/completions',
      request
    );

    return response.data;
  }

  private updateCostEstimate(tokens: number): void {
    // Estimate cost based on model and tokens
    // Prices are approximate and should be updated based on actual pricing
    const costPerToken = 0.00002; // $0.02 per 1K tokens
    this.metrics.costEstimate += tokens * costPerToken;
  }

  private updateAverageLatency(latency: number): void {
    const totalLatency = this.metrics.averageLatency * (this.metrics.successfulRequests - 1) + latency;
    this.metrics.averageLatency = totalLatency / this.metrics.successfulRequests;
  }

  async streamChat(
    request: PerplexityRequest,
    onChunk: (chunk: any) => void
  ): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const streamRequest = { ...request, stream: true };

    try {
      const response = await this.httpClient.post(
        '/chat/completions',
        streamRequest,
        {
          responseType: 'stream'
        }
      );

      response.data.on('data', (chunk: Buffer) => {
        const lines = chunk.toString().split('\n').filter(line => line.trim());
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') {
              this.emit('stream-end');
              return;
            }
            
            try {
              const parsed = JSON.parse(data);
              onChunk(parsed);
            } catch (error) {
              logger.error('Failed to parse stream chunk:', error);
            }
          }
        }
      });

      response.data.on('error', (error: Error) => {
        logger.error('Stream error:', error);
        this.emit('stream-error', error);
      });

      response.data.on('end', () => {
        this.emit('stream-end');
      });
    } catch (error) {
      logger.error('Stream request failed:', error);
      throw error;
    }
  }

  getMetrics(): PerplexityMetrics {
    return {
      ...this.metrics,
      rateLimitStatus: this.rateLimiter.getStatus()
    };
  }

  getCacheStats(): any {
    return this.cache.getStats();
  }

  getCircuitBreakerState(): any {
    return this.circuitBreaker.getState();
  }

  clearCache(): void {
    this.cache.clear();
    logger.info('Cache cleared');
  }

  updateConfig(config: Partial<PerplexityConfig>): void {
    this.config = { ...this.config, ...config };
    
    // Update sub-components if needed
    if (config.rateLimit) {
      this.rateLimiter.updateConfig(config.rateLimit);
    }
    
    logger.info('Configuration updated');
  }

  async shutdown(): Promise<void> {
    logger.info('Shutting down Perplexity client...');
    
    // Shutdown sub-components
    this.rateLimiter.shutdown();
    await this.cache.shutdown();
    
    // Clear event listeners
    this.removeAllListeners();
    
    logger.info('Perplexity client shutdown complete');
  }
}