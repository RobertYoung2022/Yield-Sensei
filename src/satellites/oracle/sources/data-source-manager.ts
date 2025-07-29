/**
 * Data Source Manager
 * Manages external data sources, APIs, and data integrity
 */

import { EventEmitter } from 'events';
import { Logger } from 'winston';
import { createLogger, format, transports } from 'winston';
import {
  DataSource,
  DataSourceHealth,
  DataSourceConfig,
  AuthenticationMethod,
  CachingConfig,
  MonitoringConfig
} from '../types';

export interface DataSourceManagerConfig {
  maxConcurrentConnections: number;
  defaultTimeout: number;
  retryAttempts: number;
  healthCheckInterval: number;
  cachingEnabled: boolean;
  loadBalancing: boolean;
  failoverEnabled: boolean;
  circuitBreakerThreshold: number;
  rateLimitingEnabled: boolean;
  enableMetrics: boolean;
}

export class DataSourceManager extends EventEmitter {
  private static instance: DataSourceManager;
  private logger: Logger;
  private config: DataSourceManagerConfig;
  private isInitialized: boolean = false;
  private isRunning: boolean = false;

  // Data source management
  private dataSources: Map<string, DataSource> = new Map();
  private connectionPools: Map<string, ConnectionPool> = new Map();
  private circuitBreakers: Map<string, CircuitBreaker> = new Map();
  private rateLimiters: Map<string, RateLimiter> = new Map();

  // Caching and monitoring
  private cache: Map<string, CacheEntry> = new Map();
  private healthMetrics: Map<string, DataSourceHealth> = new Map();
  private requestMetrics: Map<string, RequestMetrics> = new Map();

  // Background processes
  private healthCheckInterval?: NodeJS.Timeout;
  private cacheCleanupInterval?: NodeJS.Timeout;
  private metricsReportInterval?: NodeJS.Timeout;

  private constructor(config: DataSourceManagerConfig) {
    super();
    this.config = config;
    this.logger = createLogger({
      level: 'info',
      format: format.combine(format.timestamp(), format.simple()),
      transports: [
        new transports.Console(),
        new transports.File({ filename: 'logs/data-source-manager.log' })
      ],
    });
  }

  static getInstance(config?: DataSourceManagerConfig): DataSourceManager {
    if (!DataSourceManager.instance && config) {
      DataSourceManager.instance = new DataSourceManager(config);
    } else if (!DataSourceManager.instance) {
      throw new Error('DataSourceManager must be initialized with config first');
    }
    return DataSourceManager.instance;
  }

  async initialize(): Promise<void> {
    try {
      this.logger.info('Initializing Data Source Manager...');

      // Load data source configurations
      await this.loadDataSources();

      // Initialize connection pools
      await this.initializeConnectionPools();

      // Setup circuit breakers
      await this.initializeCircuitBreakers();

      // Setup rate limiters
      await this.initializeRateLimiters();

      // Initialize cache
      await this.initializeCache();

      this.isInitialized = true;
      this.logger.info('Data Source Manager initialized successfully', {
        dataSources: this.dataSources.size
      });

    } catch (error) {
      this.logger.error('Failed to initialize Data Source Manager:', error);
      throw error;
    }
  }

  async start(): Promise<void> {
    try {
      if (!this.isInitialized) {
        throw new Error('Data Source Manager not initialized');
      }

      this.logger.info('Starting Data Source Manager...');

      // Connect to all data sources
      await this.connectToDataSources();

      // Start background processes
      await this.startBackgroundProcesses();

      this.isRunning = true;
      this.logger.info('Data Source Manager started successfully');

    } catch (error) {
      this.logger.error('Failed to start Data Source Manager:', error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    try {
      this.logger.info('Stopping Data Source Manager...');

      // Stop background processes
      this.stopBackgroundProcesses();

      // Disconnect from data sources
      await this.disconnectFromDataSources();

      this.isRunning = false;
      this.logger.info('Data Source Manager stopped successfully');

    } catch (error) {
      this.logger.error('Failed to stop Data Source Manager:', error);
      throw error;
    }
  }

  // Data Source Operations
  async addDataSource(dataSource: DataSource): Promise<void> {
    try {
      this.logger.info('Adding data source', { 
        id: dataSource.id, 
        provider: dataSource.provider,
        type: dataSource.type 
      });

      // Validate data source configuration
      this.validateDataSourceConfig(dataSource);

      // Initialize connection pool
      const pool = new ConnectionPool(dataSource, this.config);
      await pool.initialize();

      // Initialize circuit breaker
      const circuitBreaker = new CircuitBreaker(dataSource.id, this.config);

      // Initialize rate limiter
      const rateLimiter = new RateLimiter(dataSource.configuration.rateLimit);

      // Store components
      this.dataSources.set(dataSource.id, dataSource);
      this.connectionPools.set(dataSource.id, pool);
      this.circuitBreakers.set(dataSource.id, circuitBreaker);
      this.rateLimiters.set(dataSource.id, rateLimiter);

      // Initialize health metrics
      this.healthMetrics.set(dataSource.id, this.createInitialHealthMetrics(dataSource));

      // Test connection
      await this.testConnection(dataSource.id);

      this.emit('data_source_added', {
        dataSourceId: dataSource.id,
        timestamp: new Date()
      });

      this.logger.info('Data source added successfully', { id: dataSource.id });

    } catch (error) {
      this.logger.error('Failed to add data source:', error, { id: dataSource.id });
      throw error;
    }
  }

  async removeDataSource(dataSourceId: string): Promise<void> {
    try {
      this.logger.info('Removing data source', { dataSourceId });

      // Disconnect and cleanup
      const pool = this.connectionPools.get(dataSourceId);
      if (pool) {
        await pool.shutdown();
        this.connectionPools.delete(dataSourceId);
      }

      // Remove from all maps
      this.dataSources.delete(dataSourceId);
      this.circuitBreakers.delete(dataSourceId);
      this.rateLimiters.delete(dataSourceId);
      this.healthMetrics.delete(dataSourceId);
      this.requestMetrics.delete(dataSourceId);

      this.emit('data_source_removed', {
        dataSourceId,
        timestamp: new Date()
      });

      this.logger.info('Data source removed successfully', { dataSourceId });

    } catch (error) {
      this.logger.error('Failed to remove data source:', error, { dataSourceId });
      throw error;
    }
  }

  async fetchData(dataSourceId: string, query: DataQuery): Promise<DataResponse> {
    try {
      const startTime = Date.now();

      // Check if data source exists
      const dataSource = this.dataSources.get(dataSourceId);
      if (!dataSource) {
        throw new Error(`Data source not found: ${dataSourceId}`);
      }

      // Check circuit breaker
      const circuitBreaker = this.circuitBreakers.get(dataSourceId);
      if (circuitBreaker && circuitBreaker.isOpen()) {
        throw new Error(`Circuit breaker open for data source: ${dataSourceId}`);
      }

      // Check rate limiter
      const rateLimiter = this.rateLimiters.get(dataSourceId);
      if (rateLimiter && !rateLimiter.allowRequest()) {
        throw new Error(`Rate limit exceeded for data source: ${dataSourceId}`);
      }

      // Check cache first
      if (this.config.cachingEnabled && dataSource.configuration.caching.enabled) {
        const cachedData = this.getCachedData(dataSourceId, query);
        if (cachedData) {
          this.updateRequestMetrics(dataSourceId, Date.now() - startTime, true, false);
          return cachedData;
        }
      }

      // Get connection from pool
      const pool = this.connectionPools.get(dataSourceId);
      if (!pool) {
        throw new Error(`Connection pool not found for data source: ${dataSourceId}`);
      }

      const connection = await pool.getConnection();

      try {
        // Execute query
        const response = await this.executeQuery(connection, dataSource, query);

        // Cache response if enabled
        if (this.config.cachingEnabled && dataSource.configuration.caching.enabled) {
          this.cacheData(dataSourceId, query, response, dataSource.configuration.caching.ttl);
        }

        // Update metrics
        this.updateRequestMetrics(dataSourceId, Date.now() - startTime, false, false);
        this.updateHealthMetrics(dataSourceId, true);

        // Record success in circuit breaker
        if (circuitBreaker) {
          circuitBreaker.recordSuccess();
        }

        return response;

      } finally {
        // Return connection to pool
        pool.releaseConnection(connection);
      }

    } catch (error) {
      const duration = Date.now() - Date.now();
      
      // Update metrics
      this.updateRequestMetrics(dataSourceId, duration, false, true);
      this.updateHealthMetrics(dataSourceId, false);

      // Record failure in circuit breaker
      const circuitBreaker = this.circuitBreakers.get(dataSourceId);
      if (circuitBreaker) {
        circuitBreaker.recordFailure();
      }

      this.logger.error('Data fetch failed:', error, { dataSourceId, query: query.id });
      throw error;
    }
  }

  async fetchDataWithFailover(query: DataQuery, dataSourceIds: string[]): Promise<DataResponse> {
    let lastError: Error | null = null;

    for (const dataSourceId of dataSourceIds) {
      try {
        this.logger.debug('Attempting data fetch with failover', { 
          dataSourceId, 
          queryId: query.id 
        });

        const response = await this.fetchData(dataSourceId, query);
        
        this.logger.info('Failover fetch successful', { 
          dataSourceId, 
          queryId: query.id 
        });

        return response;

      } catch (error) {
        lastError = error as Error;
        this.logger.warn('Failover attempt failed', { 
          dataSourceId, 
          queryId: query.id, 
          error: error instanceof Error ? error.message : String(error)
        });
        
        // Continue to next data source
        continue;
      }
    }

    // All data sources failed
    throw new Error(`All data sources failed for query ${query.id}. Last error: ${lastError?.message}`);
  }

  async refreshAll(): Promise<void> {
    try {
      this.logger.info('Refreshing all data sources...');

      const refreshPromises = Array.from(this.dataSources.keys()).map(async (dataSourceId) => {
        try {
          await this.refreshDataSource(dataSourceId);
        } catch (error) {
          this.logger.error('Failed to refresh data source:', error, { dataSourceId });
        }
      });

      await Promise.allSettled(refreshPromises);

      this.logger.info('Data source refresh completed');

    } catch (error) {
      this.logger.error('Failed to refresh data sources:', error);
      throw error;
    }
  }

  async testConnection(dataSourceId: string): Promise<boolean> {
    try {
      const dataSource = this.dataSources.get(dataSourceId);
      if (!dataSource) {
        throw new Error(`Data source not found: ${dataSourceId}`);
      }

      const testQuery: DataQuery = {
        id: `test_${dataSourceId}_${Date.now()}`,
        type: 'health_check',
        parameters: {},
        timeout: 5000
      };

      await this.fetchData(dataSourceId, testQuery);
      return true;

    } catch (error) {
      this.logger.error('Connection test failed:', error, { dataSourceId });
      return false;
    }
  }

  // Private Methods
  private async loadDataSources(): Promise<void> {
    // TODO: Load data source configurations from database or config files
    
    // Add some default data sources for testing
    const defaultSources: DataSource[] = [
      {
        id: 'coinbase_oracle',
        name: 'Coinbase Price Oracle',
        provider: 'Coinbase',
        type: 'oracle',
        endpoint: 'https://api.coinbase.com/v2/exchange-rates',
        authentication: {
          type: 'api_key',
          credentials: { api_key: 'test_key' }
        },
        reliability: 0.95,
        latency: 200,
        uptime: 0.99,
        costPerRequest: 0.001,
        status: 'active',
        configuration: this.createDefaultConfig()
      },
      {
        id: 'chainlink_oracle',
        name: 'Chainlink Price Feeds',
        provider: 'Chainlink',
        type: 'oracle',
        endpoint: 'https://api.chain.link/v1/feeds',
        authentication: { type: 'none', credentials: {} },
        reliability: 0.98,
        latency: 150,
        uptime: 0.995,
        costPerRequest: 0.0005,
        status: 'active',
        configuration: this.createDefaultConfig()
      }
    ];

    for (const source of defaultSources) {
      await this.addDataSource(source);
    }

    this.logger.info('Default data sources loaded', { count: defaultSources.length });
  }

  private createDefaultConfig(): DataSourceConfig {
    return {
      rateLimit: 100, // 100 requests per minute
      timeout: 10000, // 10 seconds
      retries: 3,
      caching: {
        enabled: true,
        ttl: 300, // 5 minutes
        strategy: 'ttl',
        maxSize: 10485760 // 10MB
      },
      validation: {
        enabled: true,
        rules: [],
        onFailure: 'warn'
      },
      monitoring: {
        enabled: true,
        metrics: ['latency', 'error_rate', 'uptime'],
        alertThresholds: {
          latency: 5000,
          error_rate: 0.1,
          uptime: 0.95
        },
        notificationEndpoints: []
      }
    };
  }

  private async initializeConnectionPools(): Promise<void> {
    this.logger.debug('Initializing connection pools...');
    // Connection pools are initialized when data sources are added
  }

  private async initializeCircuitBreakers(): Promise<void> {
    this.logger.debug('Initializing circuit breakers...');
    // Circuit breakers are initialized when data sources are added
  }

  private async initializeRateLimiters(): Promise<void> {
    this.logger.debug('Initializing rate limiters...');
    // Rate limiters are initialized when data sources are added
  }

  private async initializeCache(): Promise<void> {
    this.logger.debug('Initializing cache...');
    // Cache is ready to use
  }

  private async connectToDataSources(): Promise<void> {
    const connectionPromises = Array.from(this.dataSources.values()).map(async (dataSource) => {
      try {
        await this.testConnection(dataSource.id);
        this.logger.debug('Connected to data source', { id: dataSource.id });
      } catch (error) {
        this.logger.error('Failed to connect to data source:', error, { id: dataSource.id });
      }
    });

    await Promise.allSettled(connectionPromises);
  }

  private async disconnectFromDataSources(): Promise<void> {
    const disconnectionPromises = Array.from(this.connectionPools.values()).map(async (pool) => {
      try {
        await pool.shutdown();
      } catch (error) {
        this.logger.error('Failed to shutdown connection pool:', error);
      }
    });

    await Promise.allSettled(disconnectionPromises);
  }

  private startBackgroundProcesses(): void {
    // Health check every 30 seconds
    this.healthCheckInterval = setInterval(
      () => this.performHealthChecks(),
      this.config.healthCheckInterval
    );

    // Cache cleanup every 5 minutes
    this.cacheCleanupInterval = setInterval(
      () => this.cleanupCache(),
      300000
    );

    // Metrics reporting every minute
    if (this.config.enableMetrics) {
      this.metricsReportInterval = setInterval(
        () => this.reportMetrics(),
        60000
      );
    }

    this.logger.info('Background processes started');
  }

  private stopBackgroundProcesses(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    if (this.cacheCleanupInterval) {
      clearInterval(this.cacheCleanupInterval);
    }
    if (this.metricsReportInterval) {
      clearInterval(this.metricsReportInterval);
    }

    this.logger.info('Background processes stopped');
  }

  private validateDataSourceConfig(dataSource: DataSource): void {
    if (!dataSource.id || !dataSource.provider || !dataSource.endpoint) {
      throw new Error('Invalid data source configuration: missing required fields');
    }

    if (!['oracle', 'api', 'database', 'blockchain', 'perplexity', 'regulatory', 'financial', 'social', 'news'].includes(dataSource.type)) {
      throw new Error(`Invalid data source type: ${dataSource.type}`);
    }
  }

  private createInitialHealthMetrics(dataSource: DataSource): DataSourceHealth {
    return {
      id: dataSource.id,
      name: dataSource.name,
      status: 'online',
      latency: dataSource.latency,
      uptime: dataSource.uptime,
      errorRate: 0,
      lastCheck: new Date()
    };
  }

  private async executeQuery(connection: any, dataSource: DataSource, query: DataQuery): Promise<DataResponse> {
    // Mock implementation - would execute actual query based on data source type
    this.logger.debug('Executing query', { 
      dataSourceId: dataSource.id, 
      queryType: query.type 
    });

    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, Math.random() * 100 + 50));

    // Return mock response
    return {
      id: query.id,
      dataSourceId: dataSource.id,
      data: this.generateMockData(dataSource.type, query),
      timestamp: new Date(),
      metadata: {
        queryType: query.type,
        processingTime: Math.random() * 100 + 50,
        cached: false
      }
    };
  }

  private generateMockData(type: string, query: DataQuery): any {
    switch (type) {
      case 'oracle':
        return {
          asset: 'BTC',
          price: 50000 + (Math.random() - 0.5) * 2000,
          timestamp: new Date(),
          volume: Math.random() * 1000000
        };
      
      case 'perplexity':
        return {
          query: query.parameters.query || 'test query',
          response: 'Mock research response about RWA protocol legitimacy...',
          sources: ['source1.com', 'source2.com'],
          confidence: 0.85
        };
      
      default:
        return { message: 'Mock data response', type };
    }
  }

  private getCachedData(dataSourceId: string, query: DataQuery): DataResponse | null {
    const cacheKey = this.generateCacheKey(dataSourceId, query);
    const entry = this.cache.get(cacheKey);

    if (entry && Date.now() - entry.timestamp < entry.ttl) {
      this.logger.debug('Cache hit', { dataSourceId, queryId: query.id });
      return {
        ...entry.data,
        metadata: {
          ...entry.data.metadata,
          cached: true
        }
      };
    }

    if (entry) {
      // Remove expired entry
      this.cache.delete(cacheKey);
    }

    return null;
  }

  private cacheData(dataSourceId: string, query: DataQuery, response: DataResponse, ttl: number): void {
    const cacheKey = this.generateCacheKey(dataSourceId, query);
    
    this.cache.set(cacheKey, {
      data: response,
      timestamp: Date.now(),
      ttl: ttl * 1000 // Convert to milliseconds
    });

    this.logger.debug('Data cached', { dataSourceId, queryId: query.id, ttl });
  }

  private generateCacheKey(dataSourceId: string, query: DataQuery): string {
    const queryHash = JSON.stringify(query.parameters);
    return `${dataSourceId}_${query.type}_${Buffer.from(queryHash).toString('base64')}`;
  }

  private updateRequestMetrics(dataSourceId: string, duration: number, cached: boolean, error: boolean): void {
    const metrics = this.requestMetrics.get(dataSourceId) || {
      totalRequests: 0,
      successfulRequests: 0,
      cachedRequests: 0,
      errorRequests: 0,
      averageLatency: 0,
      lastRequest: new Date()
    };

    metrics.totalRequests++;
    if (!error) metrics.successfulRequests++;
    if (cached) metrics.cachedRequests++;
    if (error) metrics.errorRequests++;
    
    // Update average latency with exponential moving average
    const alpha = 0.1;
    metrics.averageLatency = metrics.averageLatency * (1 - alpha) + duration * alpha;
    metrics.lastRequest = new Date();

    this.requestMetrics.set(dataSourceId, metrics);
  }

  private updateHealthMetrics(dataSourceId: string, success: boolean): void {
    const health = this.healthMetrics.get(dataSourceId);
    if (!health) return;

    // Update error rate with exponential moving average
    const alpha = 0.1;
    const errorRate = success ? 0 : 1;
    health.errorRate = health.errorRate * (1 - alpha) + errorRate * alpha;

    // Update status based on error rate
    if (health.errorRate > 0.5) {
      health.status = 'offline';
    } else if (health.errorRate > 0.2) {
      health.status = 'degraded';
    } else {
      health.status = 'online';
    }

    health.lastCheck = new Date();
    this.healthMetrics.set(dataSourceId, health);
  }

  private async performHealthChecks(): Promise<void> {
    const healthCheckPromises = Array.from(this.dataSources.keys()).map(async (dataSourceId) => {
      try {
        const isHealthy = await this.testConnection(dataSourceId);
        this.updateHealthMetrics(dataSourceId, isHealthy);
      } catch (error) {
        this.logger.error('Health check failed:', error, { dataSourceId });
        this.updateHealthMetrics(dataSourceId, false);
      }
    });

    await Promise.allSettled(healthCheckPromises);
  }

  private cleanupCache(): void {
    const now = Date.now();
    let removedCount = 0;

    for (const [key, entry] of this.cache) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
        removedCount++;
      }
    }

    this.logger.debug('Cache cleanup completed', { 
      removedEntries: removedCount, 
      remainingEntries: this.cache.size 
    });
  }

  private reportMetrics(): void {
    const totalSources = this.dataSources.size;
    const healthySources = Array.from(this.healthMetrics.values())
      .filter(h => h.status === 'online').length;

    this.logger.info('Data Source Manager metrics', {
      totalSources,
      healthySources,
      cacheSize: this.cache.size,
      averageLatency: this.calculateAverageLatency()
    });

    this.emit('metrics_reported', {
      totalSources,
      healthySources,
      cacheSize: this.cache.size,
      timestamp: new Date()
    });
  }

  private calculateAverageLatency(): number {
    const metrics = Array.from(this.requestMetrics.values());
    if (metrics.length === 0) return 0;

    const totalLatency = metrics.reduce((sum, m) => sum + m.averageLatency, 0);
    return totalLatency / metrics.length;
  }

  private async refreshDataSource(dataSourceId: string): Promise<void> {
    // Refresh authentication tokens, update configurations, etc.
    this.logger.debug('Refreshing data source', { dataSourceId });
  }

  // Public Interface
  getDataSources(): DataSource[] {
    return Array.from(this.dataSources.values());
  }

  getHealthMetrics(): DataSourceHealth[] {
    return Array.from(this.healthMetrics.values());
  }

  getDataSourceHealth(dataSourceId: string): DataSourceHealth | undefined {
    return this.healthMetrics.get(dataSourceId);
  }

  getStatus(): any {
    return {
      isInitialized: this.isInitialized,
      isRunning: this.isRunning,
      dataSources: this.dataSources.size,
      healthySources: Array.from(this.healthMetrics.values())
        .filter(h => h.status === 'online').length,
      cacheSize: this.cache.size
    };
  }

  async shutdown(): Promise<void> {
    try {
      this.logger.info('Shutting down Data Source Manager...');

      await this.stop();
      
      // Clear all data
      this.dataSources.clear();
      this.connectionPools.clear();
      this.circuitBreakers.clear();
      this.rateLimiters.clear();
      this.cache.clear();
      this.healthMetrics.clear();
      this.requestMetrics.clear();

      this.removeAllListeners();
      this.isInitialized = false;

      this.logger.info('Data Source Manager shutdown complete');

    } catch (error) {
      this.logger.error('Failed to shutdown Data Source Manager:', error);
      throw error;
    }
  }
}

// Supporting classes and interfaces
interface DataQuery {
  id: string;
  type: string;
  parameters: Record<string, any>;
  timeout?: number;
}

interface DataResponse {
  id: string;
  dataSourceId: string;
  data: any;
  timestamp: Date;
  metadata: {
    queryType: string;
    processingTime: number;
    cached: boolean;
    [key: string]: any;
  };
}

interface CacheEntry {
  data: DataResponse;
  timestamp: number;
  ttl: number;
}

interface RequestMetrics {
  totalRequests: number;
  successfulRequests: number;
  cachedRequests: number;
  errorRequests: number;
  averageLatency: number;
  lastRequest: Date;
}

class ConnectionPool {
  private connections: any[] = [];
  private availableConnections: any[] = [];
  private maxConnections: number;

  constructor(private dataSource: DataSource, private config: DataSourceManagerConfig) {
    this.maxConnections = config.maxConcurrentConnections;
  }

  async initialize(): Promise<void> {
    // Initialize connection pool
    for (let i = 0; i < Math.min(5, this.maxConnections); i++) {
      const connection = await this.createConnection();
      this.connections.push(connection);
      this.availableConnections.push(connection);
    }
  }

  async getConnection(): Promise<any> {
    if (this.availableConnections.length > 0) {
      return this.availableConnections.pop();
    }

    if (this.connections.length < this.maxConnections) {
      const connection = await this.createConnection();
      this.connections.push(connection);
      return connection;
    }

    // Wait for connection to become available
    return new Promise((resolve) => {
      const checkForConnection = () => {
        if (this.availableConnections.length > 0) {
          resolve(this.availableConnections.pop());
        } else {
          setTimeout(checkForConnection, 10);
        }
      };
      checkForConnection();
    });
  }

  releaseConnection(connection: any): void {
    this.availableConnections.push(connection);
  }

  async shutdown(): Promise<void> {
    // Close all connections
    for (const connection of this.connections) {
      await this.closeConnection(connection);
    }
    this.connections = [];
    this.availableConnections = [];
  }

  private async createConnection(): Promise<any> {
    // Mock connection creation
    return { id: Math.random().toString(36), dataSourceId: this.dataSource.id };
  }

  private async closeConnection(connection: any): Promise<void> {
    // Mock connection closure
  }
}

class CircuitBreaker {
  private failures: number = 0;
  private lastFailure: Date | null = null;
  private state: 'closed' | 'open' | 'half_open' = 'closed';

  constructor(
    private dataSourceId: string,
    private config: DataSourceManagerConfig
  ) {}

  isOpen(): boolean {
    if (this.state === 'open') {
      // Check if we should transition to half-open
      if (this.lastFailure && Date.now() - this.lastFailure.getTime() > 60000) { // 1 minute
        this.state = 'half_open';
        return false;
      }
      return true;
    }
    return false;
  }

  recordSuccess(): void {
    this.failures = 0;
    this.state = 'closed';
  }

  recordFailure(): void {
    this.failures++;
    this.lastFailure = new Date();

    if (this.failures >= this.config.circuitBreakerThreshold) {
      this.state = 'open';
    }
  }
}

class RateLimiter {
  private requests: number[] = [];

  constructor(private requestsPerMinute: number) {}

  allowRequest(): boolean {
    const now = Date.now();
    const minute = 60000;

    // Remove requests older than 1 minute
    this.requests = this.requests.filter(time => now - time < minute);

    if (this.requests.length < this.requestsPerMinute) {
      this.requests.push(now);
      return true;
    }

    return false;
  }
}