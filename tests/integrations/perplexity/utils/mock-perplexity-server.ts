/**
 * Mock Perplexity Server for Integration Testing
 * Simulates Perplexity API responses for comprehensive testing
 */

import { EventEmitter } from 'events';

export interface MockServerOptions {
  port?: number;
  delay?: number;
  errorRate?: number;
  rateLimitEnabled?: boolean;
  rateLimitThreshold?: number;
}

export interface MockResponseConfig {
  statusCode?: number;
  delay?: number;
  headers?: Record<string, string>;
  body?: any;
}

/**
 * Mock Perplexity Server for testing API integrations
 */
export class MockPerplexityServer extends EventEmitter {
  private isRunning: boolean = false;
  private baseUrl: string = 'http://localhost:3001';
  private options: MockServerOptions;
  private requestCount: number = 0;
  private responses: Map<string, MockResponseConfig> = new Map();

  constructor(options: MockServerOptions = {}) {
    super();
    this.options = {
      port: 3001,
      delay: 100,
      errorRate: 0,
      rateLimitEnabled: false,
      rateLimitThreshold: 10,
      ...options
    };
    this.setupDefaultResponses();
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      return;
    }

    // In a real implementation, this would start an HTTP server
    // For testing purposes, we'll simulate the server start
    await new Promise(resolve => setTimeout(resolve, 10));
    
    this.isRunning = true;
    this.emit('server:started', { port: this.options.port });
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    this.requestCount = 0;
    this.emit('server:stopped');
  }

  getBaseUrl(): string {
    return this.baseUrl;
  }

  isServerRunning(): boolean {
    return this.isRunning;
  }

  getRequestCount(): number {
    return this.requestCount;
  }

  resetRequestCount(): void {
    this.requestCount = 0;
  }

  /**
   * Configure mock response for specific endpoint
   */
  setMockResponse(endpoint: string, config: MockResponseConfig): void {
    this.responses.set(endpoint, config);
  }

  /**
   * Get mock response for endpoint
   */
  getMockResponse(endpoint: string): MockResponseConfig | undefined {
    return this.responses.get(endpoint);
  }

  /**
   * Simulate API request processing
   */
  async simulateRequest(endpoint: string, data?: any): Promise<any> {
    if (!this.isRunning) {
      throw new Error('Mock server is not running');
    }

    this.requestCount++;
    this.emit('request:received', { endpoint, data, count: this.requestCount });

    // Simulate rate limiting
    if (this.options.rateLimitEnabled && this.requestCount > this.options.rateLimitThreshold!) {
      throw {
        response: {
          status: 429,
          data: { error: 'Rate limit exceeded' },
          headers: {
            'x-ratelimit-limit-requests': this.options.rateLimitThreshold?.toString(),
            'x-ratelimit-remaining-requests': '0',
            'x-ratelimit-reset-requests': new Date(Date.now() + 60000).toISOString()
          }
        }
      };
    }

    // Simulate random errors
    if (Math.random() < this.options.errorRate!) {
      throw new Error('Simulated API error');
    }

    // Get configured response or default
    const mockConfig = this.responses.get(endpoint) || this.responses.get('default')!;

    // Simulate network delay
    const delay = mockConfig.delay || this.options.delay!;
    await new Promise(resolve => setTimeout(resolve, delay));

    // Simulate error response
    if (mockConfig.statusCode && mockConfig.statusCode >= 400) {
      throw {
        response: {
          status: mockConfig.statusCode,
          data: mockConfig.body || { error: 'Simulated error' },
          headers: mockConfig.headers || {}
        }
      };
    }

    this.emit('request:processed', { endpoint, statusCode: mockConfig.statusCode || 200 });

    return {
      data: mockConfig.body || this.getDefaultResponse(endpoint),
      status: mockConfig.statusCode || 200,
      statusText: 'OK',
      headers: mockConfig.headers || {},
      config: {}
    };
  }

  private setupDefaultResponses(): void {
    // Default success response
    this.responses.set('default', {
      statusCode: 200,
      body: {
        id: 'mock-response-id',
        object: 'chat.completion',
        created: Date.now(),
        model: 'llama-3.1-sonar-small-128k-online',
        choices: [{
          index: 0,
          finish_reason: 'stop',
          message: {
            role: 'assistant',
            content: 'This is a mock response from the Perplexity API integration test server.'
          }
        }],
        usage: {
          prompt_tokens: 25,
          completion_tokens: 50,
          total_tokens: 75
        },
        citations: [
          'https://example.com/source1',
          'https://example.com/source2'
        ]
      }
    });

    // Authentication test endpoints
    this.responses.set('/chat/completions', {
      statusCode: 200,
      body: {
        id: 'auth-test-response',
        object: 'chat.completion',
        created: Date.now(),
        model: 'llama-3.1-sonar-small-128k-online',
        choices: [{
          index: 0,
          finish_reason: 'stop',
          message: {
            role: 'assistant',
            content: 'Authentication successful. API connection verified.'
          }
        }],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 20,
          total_tokens: 30
        }
      }
    });

    // Rate limiting test endpoint
    this.responses.set('/rate-limit-test', {
      statusCode: 200,
      body: {
        id: 'rate-limit-test',
        message: 'Rate limiting test response',
        remaining_requests: Math.max(0, (this.options.rateLimitThreshold || 10) - this.requestCount)
      }
    });

    // Error simulation endpoints
    this.responses.set('/error/400', {
      statusCode: 400,
      body: { error: 'Bad Request', message: 'Invalid request parameters' }
    });

    this.responses.set('/error/401', {
      statusCode: 401,
      body: { error: 'Unauthorized', message: 'Invalid API key' }
    });

    this.responses.set('/error/403', {
      statusCode: 403,
      body: { error: 'Forbidden', message: 'API key expired or insufficient permissions' }
    });

    this.responses.set('/error/429', {
      statusCode: 429,
      body: { error: 'Too Many Requests', message: 'Rate limit exceeded' },
      headers: {
        'x-ratelimit-limit-requests': '60',
        'x-ratelimit-remaining-requests': '0',
        'x-ratelimit-reset-requests': new Date(Date.now() + 60000).toISOString()
      }
    });

    this.responses.set('/error/500', {
      statusCode: 500,
      body: { error: 'Internal Server Error', message: 'Server temporarily unavailable' }
    });

    this.responses.set('/error/503', {
      statusCode: 503,
      body: { error: 'Service Unavailable', message: 'Service temporarily unavailable' }
    });
  }

  private getDefaultResponse(endpoint: string): any {
    // Generate contextual responses based on endpoint
    if (endpoint.includes('research')) {
      return {
        id: 'research-response',
        object: 'chat.completion',
        created: Date.now(),
        model: 'llama-3.1-sonar-large-128k-online',
        choices: [{
          index: 0,
          finish_reason: 'stop',
          message: {
            role: 'assistant',
            content: `Research findings for query: ${endpoint}. Market analysis shows positive trends with regulatory compliance maintained. Key metrics indicate strong performance across all evaluated parameters.`
          }
        }],
        usage: {
          prompt_tokens: 150,
          completion_tokens: 300,
          total_tokens: 450
        },
        citations: [
          'https://financial-times.com/research-report',
          'https://sec.gov/regulatory-filing',
          'https://coindesk.com/market-analysis'
        ]
      };
    }

    if (endpoint.includes('protocol')) {
      return {
        id: 'protocol-analysis',
        object: 'chat.completion',
        created: Date.now(),
        model: 'llama-3.1-sonar-large-128k-online',
        choices: [{
          index: 0,
          finish_reason: 'stop',
          message: {
            role: 'assistant',
            content: 'Protocol analysis complete. Security audits passed, TVL growth steady at 15% QoQ, regulatory compliance maintained across all jurisdictions.'
          }
        }],
        usage: {
          prompt_tokens: 200,
          completion_tokens: 250,
          total_tokens: 450
        },
        citations: [
          'https://defipulse.com/protocol-metrics',
          'https://audit-firm.com/security-report'
        ]
      };
    }

    return this.responses.get('default')!.body;
  }

  /**
   * Utility methods for testing
   */
  enableRateLimit(threshold: number = 10): void {
    this.options.rateLimitEnabled = true;
    this.options.rateLimitThreshold = threshold;
  }

  disableRateLimit(): void {
    this.options.rateLimitEnabled = false;
  }

  setErrorRate(rate: number): void {
    this.options.errorRate = Math.max(0, Math.min(1, rate));
  }

  setDelay(delay: number): void {
    this.options.delay = Math.max(0, delay);
  }

  getMetrics(): any {
    return {
      isRunning: this.isRunning,
      requestCount: this.requestCount,
      rateLimitEnabled: this.options.rateLimitEnabled,
      rateLimitThreshold: this.options.rateLimitThreshold,
      errorRate: this.options.errorRate,
      delay: this.options.delay,
      configuredEndpoints: Array.from(this.responses.keys())
    };
  }
}