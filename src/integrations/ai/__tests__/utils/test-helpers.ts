/**
 * AI Integration Testing Utilities
 * Common test helpers, mocks, and utilities for AI service testing
 */

import { EventEmitter } from 'events';
import { 
  AIServiceClient, 
  AIServiceResponse, 
  TextGenerationRequest, 
  TextGenerationResponse,
  AnalysisRequest,
  AnalysisResponse,
  ResearchRequest,
  ResearchResponse,
  AIProvider,
  AIServiceConfig,
  AIServiceError,
  UnifiedAIClientConfig
} from '../../types';

/**
 * Mock AI Service Client
 */
export class MockAIServiceClient extends EventEmitter implements AIServiceClient {
  public readonly provider: AIProvider;
  public readonly config: AIServiceConfig;
  
  private _healthy: boolean = true;
  private _requestCount: number = 0;
  private _tokensUsed: number = 0;
  private _costToday: number = 0;
  private _shouldFail: boolean = false;
  private _failureType: 'network' | 'auth' | 'rate_limit' | 'server' = 'network';
  private _latency: number = 100; // Default 100ms latency

  constructor(provider: AIProvider, config: AIServiceConfig) {
    super();
    this.provider = provider;
    this.config = config;
  }

  async generateText(request: TextGenerationRequest): Promise<AIServiceResponse<TextGenerationResponse>> {
    await this.simulateLatency();
    this._requestCount++;

    if (this._shouldFail) {
      throw this.createMockError();
    }

    const tokensUsed = Math.floor(Math.random() * 1000) + 100;
    this._tokensUsed += tokensUsed;
    this._costToday += tokensUsed * 0.001;

    return {
      success: true,
      data: {
        text: `Mock response from ${this.provider} for: ${request.prompt.substring(0, 50)}...`,
        finishReason: 'stop',
        model: request.model || 'mock-model',
      },
      usage: {
        promptTokens: Math.floor(tokensUsed * 0.7),
        completionTokens: Math.floor(tokensUsed * 0.3),
        totalTokens: tokensUsed,
        cost: tokensUsed * 0.001,
      },
      metadata: {
        provider: this.provider,
        requestId: `mock-${Date.now()}-${Math.random()}`,
        timestamp: Date.now(),
      },
    };
  }

  async analyzeContent(request: AnalysisRequest): Promise<AIServiceResponse<AnalysisResponse>> {
    await this.simulateLatency();
    this._requestCount++;

    if (this._shouldFail) {
      throw this.createMockError();
    }

    return {
      success: true,
      data: {
        result: `Mock ${request.analysisType} analysis of content`,
        confidence: 0.85,
        explanation: `Mock analysis explanation from ${this.provider}`,
      },
      metadata: {
        provider: this.provider,
        requestId: `mock-analysis-${Date.now()}`,
        timestamp: Date.now(),
      },
    };
  }

  async research(request: ResearchRequest): Promise<AIServiceResponse<ResearchResponse>> {
    await this.simulateLatency();
    this._requestCount++;

    if (this._shouldFail) {
      throw this.createMockError();
    }

    return {
      success: true,
      data: {
        answer: `Mock research response for: ${request.query}`,
        sources: [
          {
            title: 'Mock Source 1',
            url: 'https://example.com/source1',
            snippet: 'Mock snippet 1',
            publishedDate: '2024-01-01',
            domain: 'example.com',
          },
        ],
        citations: ['Mock citation 1'],
      },
      metadata: {
        provider: this.provider,
        requestId: `mock-research-${Date.now()}`,
        timestamp: Date.now(),
      },
    };
  }

  async healthCheck(): Promise<boolean> {
    await this.simulateLatency(50);
    return this._healthy;
  }

  async getUsage(): Promise<{ requestsToday: number; tokensUsed: number; costToday: number }> {
    return {
      requestsToday: this._requestCount,
      tokensUsed: this._tokensUsed,
      costToday: this._costToday,
    };
  }

  // Test control methods
  setHealthy(healthy: boolean): void {
    this._healthy = healthy;
  }

  setShouldFail(shouldFail: boolean, failureType?: typeof this._failureType): void {
    this._shouldFail = shouldFail;
    if (failureType) {
      this._failureType = failureType;
    }
  }

  setLatency(latency: number): void {
    this._latency = latency;
  }

  resetStats(): void {
    this._requestCount = 0;
    this._tokensUsed = 0;
    this._costToday = 0;
  }

  getStats() {
    return {
      requestCount: this._requestCount,
      tokensUsed: this._tokensUsed,
      costToday: this._costToday,
    };
  }

  private async simulateLatency(customLatency?: number): Promise<void> {
    const latency = customLatency || this._latency;
    await new Promise(resolve => setTimeout(resolve, latency));
  }

  private createMockError(): AIServiceError {
    const error = new Error(`Mock ${this._failureType} error`) as AIServiceError;
    error.provider = this.provider;
    error.type = this._failureType;
    error.retryable = this._failureType !== 'auth';
    
    switch (this._failureType) {
      case 'auth':
        error.statusCode = 401;
        break;
      case 'rate_limit':
        error.statusCode = 429;
        break;
      case 'server':
        error.statusCode = 500;
        break;
      default:
        error.statusCode = undefined;
    }

    return error;
  }
}

/**
 * Test Configuration Factory
 */
export class TestConfigFactory {
  static createMockUnifiedAIConfig(overrides?: Partial<UnifiedAIClientConfig>): UnifiedAIClientConfig {
    return {
      defaultProvider: 'openai',
      fallbackProviders: ['anthropic', 'perplexity'],
      providers: {
        openai: {
          apiKey: 'mock-openai-key',
          timeout: 30000,
          maxRetries: 3,
          rateLimitRpm: 60,
        },
        anthropic: {
          apiKey: 'mock-anthropic-key',
          timeout: 30000,
          maxRetries: 3,
          rateLimitRpm: 60,
        },
        perplexity: {
          apiKey: 'mock-perplexity-key',
          timeout: 30000,
          maxRetries: 3,
          rateLimitRpm: 60,
        },
      },
      loadBalancing: {
        enabled: true,
        strategy: 'round-robin',
      },
      ...overrides,
    };
  }

  static createMockServiceConfig(provider: AIProvider): AIServiceConfig {
    return {
      apiKey: `mock-${provider}-key`,
      timeout: 30000,
      maxRetries: 3,
      retryDelay: 1000,
      rateLimitRpm: 60,
    };
  }
}

/**
 * Test Data Factory
 */
export class TestDataFactory {
  static createTextGenerationRequest(overrides?: Partial<TextGenerationRequest>): TextGenerationRequest {
    return {
      prompt: 'Test prompt for text generation',
      model: 'test-model',
      maxTokens: 100,
      temperature: 0.7,
      topP: 1.0,
      systemPrompt: 'You are a helpful assistant',
      stream: false,
      ...overrides,
    };
  }

  static createAnalysisRequest(overrides?: Partial<AnalysisRequest>): AnalysisRequest {
    return {
      content: 'Test content for analysis',
      analysisType: 'sentiment',
      context: 'Test context',
      options: {},
      ...overrides,
    };
  }

  static createResearchRequest(overrides?: Partial<ResearchRequest>): ResearchRequest {
    return {
      query: 'Test research query',
      domain: 'technology',
      sources: ['web'],
      maxResults: 5,
      recency: 'week',
      ...overrides,
    };
  }
}

/**
 * Test Utilities
 */
export class TestUtils {
  /**
   * Wait for a specified amount of time
   */
  static async wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Wait for an event to be emitted
   */
  static async waitForEvent(emitter: EventEmitter, event: string, timeout: number = 5000): Promise<any> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Event '${event}' not emitted within ${timeout}ms`));
      }, timeout);

      emitter.once(event, (data) => {
        clearTimeout(timer);
        resolve(data);
      });
    });
  }

  /**
   * Create a mock environment with environment variables
   */
  static mockEnvironment(env: Record<string, string>): () => void {
    const originalEnv = { ...process.env };
    
    Object.assign(process.env, env);
    
    return () => {
      process.env = originalEnv;
    };
  }

  /**
   * Measure execution time of an async function
   */
  static async measureTime<T>(fn: () => Promise<T>): Promise<{ result: T; duration: number }> {
    const start = Date.now();
    const result = await fn();
    const duration = Date.now() - start;
    return { result, duration };
  }

  /**
   * Retry a function with exponential backoff
   */
  static async retry<T>(
    fn: () => Promise<T>,
    maxRetries: number = 3,
    baseDelay: number = 100
  ): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;
        
        if (attempt === maxRetries) {
          throw lastError;
        }
        
        const delay = baseDelay * Math.pow(2, attempt);
        await this.wait(delay);
      }
    }
    
    throw lastError!;
  }

  /**
   * Generate random test data
   */
  static generateRandomString(length: number = 10): string {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  static generateRandomNumber(min: number = 0, max: number = 100): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
}

/**
 * Performance Monitor
 */
export class PerformanceMonitor {
  private metrics: Map<string, number[]> = new Map();

  recordMetric(name: string, value: number): void {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    this.metrics.get(name)!.push(value);
  }

  getStats(name: string) {
    const values = this.metrics.get(name) || [];
    if (values.length === 0) {
      return null;
    }

    const sorted = [...values].sort((a, b) => a - b);
    const sum = values.reduce((a, b) => a + b, 0);

    return {
      count: values.length,
      min: Math.min(...values),
      max: Math.max(...values),
      mean: sum / values.length,
      median: sorted[Math.floor(sorted.length / 2)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)],
    };
  }

  getAllStats() {
    const stats: Record<string, any> = {};
    for (const [name] of this.metrics) {
      stats[name] = this.getStats(name);
    }
    return stats;
  }

  reset(): void {
    this.metrics.clear();
  }
}

/**
 * Mock Server for Integration Testing
 */
export class MockAIServer {
  private responses: Map<string, any> = new Map();
  private delays: Map<string, number> = new Map();
  private failures: Map<string, boolean> = new Map();

  addResponse(endpoint: string, response: any, delay: number = 0): void {
    this.responses.set(endpoint, response);
    if (delay > 0) {
      this.delays.set(endpoint, delay);
    }
  }

  setFailure(endpoint: string, shouldFail: boolean = true): void {
    this.failures.set(endpoint, shouldFail);
  }

  async handleRequest(endpoint: string): Promise<any> {
    const delay = this.delays.get(endpoint) || 0;
    if (delay > 0) {
      await TestUtils.wait(delay);
    }

    if (this.failures.get(endpoint)) {
      throw new Error(`Mock server failure for ${endpoint}`);
    }

    const response = this.responses.get(endpoint);
    if (!response) {
      throw new Error(`No mock response configured for ${endpoint}`);
    }

    return response;
  }

  reset(): void {
    this.responses.clear();
    this.delays.clear();
    this.failures.clear();
  }
}

/**
 * Test Suite Base Class
 */
export abstract class AITestSuite {
  protected performanceMonitor: PerformanceMonitor;
  protected mockServer: MockAIServer;

  constructor() {
    this.performanceMonitor = new PerformanceMonitor();
    this.mockServer = new MockAIServer();
  }

  protected async setUp(): Promise<void> {
    // Override in subclasses
  }

  protected async tearDown(): Promise<void> {
    this.performanceMonitor.reset();
    this.mockServer.reset();
  }

  protected async runWithPerformanceTracking<T>(
    name: string,
    fn: () => Promise<T>
  ): Promise<T> {
    const { result, duration } = await TestUtils.measureTime(fn);
    this.performanceMonitor.recordMetric(name, duration);
    return result;
  }
}