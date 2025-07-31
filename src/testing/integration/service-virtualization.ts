/**
 * Service Virtualization and Mocking Framework
 * Advanced service mocking and virtualization for integration testing
 */

import { EventEmitter } from 'events';
import { Logger } from 'winston';
import { createLogger, format, transports } from 'winston';
import fs from 'fs/promises';
import path from 'path';

export interface ServiceVirtualizationConfig {
  serviceName: string;
  baseUrl: string;
  version: string;
  mockBehavior: {
    responseDelay?: { min: number; max: number };
    errorRate?: number;
    failurePatterns?: FailurePattern[];
    circuitBreaker?: CircuitBreakerConfig;
  };
  recordingMode: 'record' | 'replay' | 'passthrough' | 'mock';
  recordingPath?: string;
  fallbackToReal?: boolean;
}

export interface FailurePattern {
  pattern: string | RegExp;
  failureType: 'timeout' | 'error' | 'slow' | 'intermittent';
  probability: number;
  config?: {
    timeout?: number;
    delay?: number;
    errorCode?: number;
    errorMessage?: string;
  };
}

export interface CircuitBreakerConfig {
  enabled: boolean;
  failureThreshold: number;
  timeout: number;
  resetTimeout: number;
}

export interface MockEndpoint {
  path: string;
  method: string;
  responses: MockResponse[];
  middleware?: MockMiddleware[];
  stateful?: boolean;
  state?: Record<string, any>;
}

export interface MockResponse {
  status: number;
  headers?: Record<string, string>;
  body?: any;
  delay?: number;
  probability?: number;
  condition?: (request: any, state: any) => boolean;
}

export interface MockMiddleware {
  name: string;
  execute: (request: any, response: any, next: () => void) => void;
}

export interface RecordedInteraction {
  id: string;
  timestamp: Date;
  request: {
    method: string;
    url: string;
    headers: Record<string, string>;
    body?: any;
    query?: Record<string, any>;
  };
  response: {
    status: number;
    headers: Record<string, string>;
    body: any;
    duration: number;
  };
  metadata: {
    serviceName: string;
    version: string;
    sessionId?: string;
  };
}

export interface ServiceProxy {
  serviceName: string;
  isVirtual: boolean;
  endpoints: Map<string, MockEndpoint>;
  interactions: RecordedInteraction[];
  circuitBreaker: CircuitBreaker;
}

export class CircuitBreaker extends EventEmitter {
  private state: 'closed' | 'open' | 'half-open' = 'closed';
  private failureCount = 0;
  private lastFailureTime?: Date;
  private config: CircuitBreakerConfig;

  constructor(config: CircuitBreakerConfig) {
    super();
    this.config = config;
  }

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (!this.config.enabled) {
      return await operation();
    }

    if (this.state === 'open') {
      if (this.shouldAttemptReset()) {
        this.state = 'half-open';
        this.emit('stateChange', 'half-open');
      } else {
        throw new Error('Circuit breaker is open');
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failureCount = 0;
    if (this.state === 'half-open') {
      this.state = 'closed';
      this.emit('stateChange', 'closed');
    }
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = new Date();

    if (this.failureCount >= this.config.failureThreshold) {
      this.state = 'open';
      this.emit('stateChange', 'open');
    }
  }

  private shouldAttemptReset(): boolean {
    if (!this.lastFailureTime) return false;
    const timeSinceLastFailure = Date.now() - this.lastFailureTime.getTime();
    return timeSinceLastFailure >= this.config.resetTimeout;
  }

  getState(): string {
    return this.state;
  }

  getStats(): { state: string; failureCount: number; lastFailureTime?: Date } {
    return {
      state: this.state,
      failureCount: this.failureCount,
      lastFailureTime: this.lastFailureTime,
    };
  }
}

export class ServiceVirtualizationFramework extends EventEmitter {
  private logger: Logger;
  private serviceProxies: Map<string, ServiceProxy> = new Map();
  private globalMiddleware: MockMiddleware[] = [];
  private recordingSession?: string;
  private httpClients: Map<string, any> = new Map();

  constructor() {
    super();
    this.logger = createLogger({
      level: 'info',
      format: format.combine(
        format.timestamp(),
        format.simple()
      ),
      transports: [
        new transports.Console(),
        new transports.File({ filename: 'logs/service-virtualization.log' })
      ],
    });
  }

  async createServiceProxy(config: ServiceVirtualizationConfig): Promise<ServiceProxy> {
    this.logger.info(`Creating service proxy for: ${config.serviceName}`);

    const circuitBreaker = new CircuitBreaker(
      config.mockBehavior.circuitBreaker || {
        enabled: false,
        failureThreshold: 5,
        timeout: 10000,
        resetTimeout: 60000,
      }
    );

    const proxy: ServiceProxy = {
      serviceName: config.serviceName,
      isVirtual: config.recordingMode === 'mock',
      endpoints: new Map(),
      interactions: [],
      circuitBreaker,
    };

    // Load recorded interactions if in replay mode
    if (config.recordingMode === 'replay' && config.recordingPath) {
      await this.loadRecordedInteractions(proxy, config.recordingPath);
    }

    // Setup default endpoints based on service type
    this.setupDefaultEndpoints(proxy, config);

    this.serviceProxies.set(config.serviceName, proxy);
    this.emit('serviceProxyCreated', { serviceName: config.serviceName, proxy });

    return proxy;
  }

  addMockEndpoint(
    serviceName: string,
    endpoint: MockEndpoint
  ): void {
    const proxy = this.serviceProxies.get(serviceName);
    if (!proxy) {
      throw new Error(`Service proxy not found: ${serviceName}`);
    }

    const key = `${endpoint.method}:${endpoint.path}`;
    proxy.endpoints.set(key, endpoint);
    
    this.logger.info(`Added mock endpoint: ${serviceName} ${key}`);
  }

  addGlobalMiddleware(middleware: MockMiddleware): void {
    this.globalMiddleware.push(middleware);
    this.logger.info(`Added global middleware: ${middleware.name}`);
  }

  async handleRequest(
    serviceName: string,
    request: {
      method: string;
      path: string;
      headers?: Record<string, string>;
      body?: any;
      query?: Record<string, any>;
    }
  ): Promise<any> {
    const proxy = this.serviceProxies.get(serviceName);
    if (!proxy) {
      throw new Error(`Service proxy not found: ${serviceName}`);
    }

    const key = `${request.method.toUpperCase()}:${request.path}`;
    const endpoint = proxy.endpoints.get(key);

    if (!endpoint) {
      // Try pattern matching
      const matchedEndpoint = this.findMatchingEndpoint(proxy, request.method, request.path);
      if (!matchedEndpoint) {
        throw new Error(`No mock endpoint found for: ${key}`);
      }
      return await this.executeEndpoint(proxy, matchedEndpoint, request);
    }

    return await this.executeEndpoint(proxy, endpoint, request);
  }

  private async executeEndpoint(
    proxy: ServiceProxy,
    endpoint: MockEndpoint,
    request: any
  ): Promise<any> {
    const startTime = Date.now();

    try {
      return await proxy.circuitBreaker.execute(async () => {
        // Execute global middleware
        for (const middleware of this.globalMiddleware) {
          await this.executeMiddleware(middleware, request, null);
        }

        // Execute endpoint-specific middleware
        if (endpoint.middleware) {
          for (const middleware of endpoint.middleware) {
            await this.executeMiddleware(middleware, request, endpoint.state);
          }
        }

        // Select response based on conditions and probability
        const response = this.selectResponse(endpoint, request);
        
        // Apply delay if configured
        if (response.delay) {
          await new Promise(resolve => setTimeout(resolve, response.delay));
        }

        // Record interaction
        const interaction: RecordedInteraction = {
          id: this.generateInteractionId(),
          timestamp: new Date(),
          request: {
            method: request.method,
            url: request.path,
            headers: request.headers || {},
            body: request.body,
            query: request.query,
          },
          response: {
            status: response.status,
            headers: response.headers || {},
            body: response.body,
            duration: Date.now() - startTime,
          },
          metadata: {
            serviceName: proxy.serviceName,
            version: '1.0.0',
            sessionId: this.recordingSession,
          },
        };

        proxy.interactions.push(interaction);
        this.emit('interactionRecorded', interaction);

        return {
          status: response.status,
          headers: response.headers || {},
          body: response.body,
          duration: Date.now() - startTime,
        };
      });
    } catch (error) {
      this.logger.error(`Error executing endpoint: ${endpoint.path}`, error);
      throw error;
    }
  }

  private selectResponse(endpoint: MockEndpoint, request: any): MockResponse {
    const availableResponses = endpoint.responses.filter(response => {
      if (response.condition) {
        return response.condition(request, endpoint.state);
      }
      return true;
    });

    if (availableResponses.length === 0) {
      throw new Error('No valid responses available for endpoint');
    }

    // If only one response, return it
    if (availableResponses.length === 1) {
      return availableResponses[0];
    }

    // Select based on probability
    const totalProbability = availableResponses.reduce(
      (sum, response) => sum + (response.probability || 1), 
      0
    );
    
    let random = Math.random() * totalProbability;
    
    for (const response of availableResponses) {
      random -= response.probability || 1;
      if (random <= 0) {
        return response;
      }
    }

    // Fallback to first response
    return availableResponses[0];
  }

  private async executeMiddleware(
    middleware: MockMiddleware,
    request: any,
    state: any
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        middleware.execute(request, null, () => resolve());
      } catch (error) {
        reject(error);
      }
    });
  }

  private findMatchingEndpoint(
    proxy: ServiceProxy,
    method: string,
    path: string
  ): MockEndpoint | null {
    for (const [key, endpoint] of proxy.endpoints) {
      const [endpointMethod, endpointPath] = key.split(':', 2);
      
      if (endpointMethod === method.toUpperCase()) {
        // Check for path parameters or wildcards
        if (this.pathMatches(endpointPath, path)) {
          return endpoint;
        }
      }
    }
    
    return null;
  }

  private pathMatches(pattern: string, path: string): boolean {
    // Convert pattern with {param} to regex
    const regexPattern = pattern
      .replace(/\{[^}]+\}/g, '([^/]+)')
      .replace(/\*/g, '.*');
    
    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(path);
  }

  async startRecordingSession(sessionId?: string): Promise<string> {
    this.recordingSession = sessionId || `session_${Date.now()}`;
    this.logger.info(`Started recording session: ${this.recordingSession}`);
    this.emit('recordingStarted', this.recordingSession);
    return this.recordingSession;
  }

  async stopRecordingSession(): Promise<RecordedInteraction[]> {
    if (!this.recordingSession) {
      throw new Error('No active recording session');
    }

    const allInteractions: RecordedInteraction[] = [];
    for (const proxy of this.serviceProxies.values()) {
      allInteractions.push(...proxy.interactions.filter(
        i => i.metadata.sessionId === this.recordingSession
      ));
    }

    this.logger.info(`Stopped recording session: ${this.recordingSession} (${allInteractions.length} interactions)`);
    this.emit('recordingStopped', { sessionId: this.recordingSession, interactions: allInteractions });

    this.recordingSession = undefined;
    return allInteractions;
  }

  async saveRecording(
    interactions: RecordedInteraction[],
    filePath: string
  ): Promise<void> {
    const dir = path.dirname(filePath);
    await fs.mkdir(dir, { recursive: true });

    const recordingData = {
      version: '1.0.0',
      createdAt: new Date().toISOString(),
      interactions,
    };

    await fs.writeFile(filePath, JSON.stringify(recordingData, null, 2), 'utf-8');
    this.logger.info(`Saved recording to: ${filePath}`);
  }

  private async loadRecordedInteractions(
    proxy: ServiceProxy,
    recordingPath: string
  ): Promise<void> {
    try {
      const content = await fs.readFile(recordingPath, 'utf-8');
      const recordingData = JSON.parse(content);
      
      const serviceInteractions = recordingData.interactions.filter(
        (i: RecordedInteraction) => i.metadata.serviceName === proxy.serviceName
      );

      // Convert recorded interactions to mock endpoints
      for (const interaction of serviceInteractions) {
        const key = `${interaction.request.method}:${interaction.request.url}`;
        
        if (!proxy.endpoints.has(key)) {
          const endpoint: MockEndpoint = {
            path: interaction.request.url,
            method: interaction.request.method,
            responses: [],
          };
          proxy.endpoints.set(key, endpoint);
        }

        const endpoint = proxy.endpoints.get(key)!;
        endpoint.responses.push({
          status: interaction.response.status,
          headers: interaction.response.headers,
          body: interaction.response.body,
          delay: interaction.response.duration,
        });
      }

      this.logger.info(`Loaded ${serviceInteractions.length} recorded interactions for ${proxy.serviceName}`);
    } catch (error) {
      this.logger.warn(`Failed to load recorded interactions from ${recordingPath}:`, error);
    }
  }

  private setupDefaultEndpoints(proxy: ServiceProxy, config: ServiceVirtualizationConfig): void {
    // Setup common endpoints based on service name patterns
    if (config.serviceName.includes('user')) {
      this.setupUserServiceEndpoints(proxy);
    } else if (config.serviceName.includes('portfolio')) {
      this.setupPortfolioServiceEndpoints(proxy);
    } else if (config.serviceName.includes('sage')) {
      this.setupSageServiceEndpoints(proxy);
    } else if (config.serviceName.includes('aegis')) {
      this.setupAegisServiceEndpoints(proxy);
    } else if (config.serviceName.includes('bridge')) {
      this.setupBridgeServiceEndpoints(proxy);
    } else {
      this.setupGenericServiceEndpoints(proxy);
    }
  }

  private setupUserServiceEndpoints(proxy: ServiceProxy): void {
    // Health check
    proxy.endpoints.set('GET:/health', {
      path: '/health',
      method: 'GET',
      responses: [{ status: 200, body: { status: 'healthy', service: proxy.serviceName } }],
    });

    // User CRUD operations
    proxy.endpoints.set('POST:/users', {
      path: '/users',
      method: 'POST',
      responses: [
        {
          status: 201,
          body: {
            id: 'user_{{random}}',
            email: '{{request.body.email}}',
            createdAt: new Date().toISOString(),
          },
        },
      ],
    });

    proxy.endpoints.set('GET:/users/{id}', {
      path: '/users/{id}',
      method: 'GET',
      responses: [
        {
          status: 200,
          body: {
            id: '{{path.id}}',
            email: 'test@example.com',
            username: 'testuser',
            profile: { firstName: 'Test', lastName: 'User' },
          },
        },
        { status: 404, body: { error: 'User not found' }, probability: 0.1 },
      ],
    });
  }

  private setupPortfolioServiceEndpoints(proxy: ServiceProxy): void {
    proxy.endpoints.set('GET:/health', {
      path: '/health',
      method: 'GET',
      responses: [{ status: 200, body: { status: 'healthy', service: proxy.serviceName } }],
    });

    proxy.endpoints.set('POST:/portfolios', {
      path: '/portfolios',
      method: 'POST',
      responses: [
        {
          status: 201,
          body: {
            id: 'portfolio_{{random}}',
            userId: '{{request.body.userId}}',
            name: '{{request.body.name}}',
            totalValue: 0,
            positions: [],
            createdAt: new Date().toISOString(),
          },
        },
      ],
    });

    proxy.endpoints.set('GET:/portfolios/{id}/risk', {
      path: '/portfolios/{id}/risk',
      method: 'GET',
      responses: [
        {
          status: 200,
          body: {
            portfolioId: '{{path.id}}',
            riskScore: Math.random() * 10,
            volatility: Math.random(),
            recommendations: ['Diversify holdings', 'Consider rebalancing'],
          },
        },
      ],
    });
  }

  private setupSageServiceEndpoints(proxy: ServiceProxy): void {
    proxy.endpoints.set('POST:/analyze', {
      path: '/analyze',
      method: 'POST',
      responses: [
        {
          status: 200,
          body: {
            score: 80 + Math.random() * 20,
            riskRating: 'BBB+',
            yield: 6 + Math.random() * 8,
            recommendations: ['Strong fundamentals', 'Regulatory compliance verified'],
          },
        },
      ],
    });
  }

  private setupAegisServiceEndpoints(proxy: ServiceProxy): void {
    proxy.endpoints.set('POST:/assess-risk', {
      path: '/assess-risk',
      method: 'POST',
      responses: [
        {
          status: 200,
          body: {
            riskScore: Math.random() * 10,
            vulnerabilities: [],
            recommendations: ['Security audit recommended', 'Monitor for unusual activity'],
          },
        },
      ],
    });
  }

  private setupBridgeServiceEndpoints(proxy: ServiceProxy): void {
    proxy.endpoints.set('GET:/arbitrage', {
      path: '/arbitrage',
      method: 'GET',
      responses: [
        {
          status: 200,
          body: {
            opportunities: [
              {
                id: 'arb_{{random}}',
                fromChain: 'ethereum',
                toChain: 'polygon',
                profit: Math.random() * 1000,
                confidence: 0.8 + Math.random() * 0.2,
              },
            ],
          },
        },
      ],
    });
  }

  private setupGenericServiceEndpoints(proxy: ServiceProxy): void {
    proxy.endpoints.set('GET:/health', {
      path: '/health',
      method: 'GET',
      responses: [{ status: 200, body: { status: 'healthy', service: proxy.serviceName } }],
    });

    proxy.endpoints.set('GET:/*', {
      path: '/*',
      method: 'GET',
      responses: [
        { status: 200, body: { message: 'Generic response', service: proxy.serviceName } },
        { status: 500, body: { error: 'Service unavailable' }, probability: 0.05 },
      ],
    });
  }

  private generateInteractionId(): string {
    return `interaction_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Management and utility methods

  getServiceProxy(serviceName: string): ServiceProxy | undefined {
    return this.serviceProxies.get(serviceName);
  }

  listServices(): string[] {
    return Array.from(this.serviceProxies.keys());
  }

  async resetService(serviceName: string): Promise<void> {
    const proxy = this.serviceProxies.get(serviceName);
    if (proxy) {
      proxy.interactions = [];
      proxy.circuitBreaker = new CircuitBreaker(proxy.circuitBreaker.config);
      // Reset stateful endpoints
      for (const endpoint of proxy.endpoints.values()) {
        if (endpoint.stateful) {
          endpoint.state = {};
        }
      }
      this.logger.info(`Reset service: ${serviceName}`);
    }
  }

  async removeService(serviceName: string): Promise<void> {
    this.serviceProxies.delete(serviceName);
    this.httpClients.delete(serviceName);
    this.logger.info(`Removed service: ${serviceName}`);
  }

  getInteractionHistory(serviceName?: string): RecordedInteraction[] {
    if (serviceName) {
      const proxy = this.serviceProxies.get(serviceName);
      return proxy ? proxy.interactions : [];
    }

    const allInteractions: RecordedInteraction[] = [];
    for (const proxy of this.serviceProxies.values()) {
      allInteractions.push(...proxy.interactions);
    }
    return allInteractions.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  getServiceStats(serviceName: string): any {
    const proxy = this.serviceProxies.get(serviceName);
    if (!proxy) {
      return null;
    }

    const interactions = proxy.interactions;
    const totalRequests = interactions.length;
    const errorCount = interactions.filter(i => i.response.status >= 400).length;
    const avgResponseTime = totalRequests > 0 
      ? interactions.reduce((sum, i) => sum + i.response.duration, 0) / totalRequests 
      : 0;

    return {
      serviceName,
      isVirtual: proxy.isVirtual,
      totalRequests,
      errorRate: totalRequests > 0 ? (errorCount / totalRequests) * 100 : 0,
      avgResponseTime,
      circuitBreakerStats: proxy.circuitBreaker.getStats(),
      endpointCount: proxy.endpoints.size,
    };
  }
}

// Predefined middleware
export const CommonMiddleware = {
  requestLogger: {
    name: 'requestLogger',
    execute: (request: any, response: any, next: () => void) => {
      console.log(`[${new Date().toISOString()}] ${request.method} ${request.path}`);
      next();
    },
  },

  authValidator: {
    name: 'authValidator',
    execute: (request: any, response: any, next: () => void) => {
      const authHeader = request.headers?.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw new Error('Unauthorized: Missing or invalid authorization header');
      }
      next();
    },
  },

  rateLimiter: (requestsPerSecond: number = 10) => ({
    name: 'rateLimiter',
    execute: (request: any, response: any, next: () => void) => {
      // Simple rate limiting simulation
      const now = Date.now();
      const windowStart = Math.floor(now / 1000) * 1000;
      
      // In a real implementation, this would use a proper rate limiting store
      const requestCount = Math.floor(Math.random() * requestsPerSecond * 1.5);
      
      if (requestCount > requestsPerSecond) {
        throw new Error('Rate limit exceeded');
      }
      
      next();
    },
  }),

  responseTransformer: (transformer: (body: any) => any) => ({
    name: 'responseTransformer',
    execute: (request: any, response: any, next: () => void) => {
      if (response && response.body) {
        response.body = transformer(response.body);
      }
      next();
    },
  }),
};

// Template variable resolver
export class TemplateResolver {
  static resolve(template: string, context: any): string {
    return template.replace(/\{\{([^}]+)\}\}/g, (match, expression) => {
      const value = this.evaluateExpression(expression, context);
      return value !== undefined ? String(value) : match;
    });
  }

  private static evaluateExpression(expression: string, context: any): any {
    if (expression === 'random') {
      return Math.random().toString(36).substr(2, 9);
    }

    // Handle nested property access (e.g., request.body.email)
    const path = expression.split('.');
    let current = context;
    
    for (const key of path) {
      current = current?.[key];
    }
    
    return current;
  }
}