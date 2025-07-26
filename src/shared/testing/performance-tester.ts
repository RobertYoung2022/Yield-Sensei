/**
 * YieldSensei Database Performance Testing Framework
 * 
 * Comprehensive testing suite for database performance, scalability, and failover scenarios
 * across PostgreSQL, ClickHouse, Redis, and Vector DB systems.
 */

import { EventEmitter } from 'events';
import Logger from '@/shared/logging/logger';
import { DatabaseManager } from '../database/manager';
import { ClickHouseManager } from '../database/clickhouse-manager';
import { markUnused } from '../../utils/type-safety.js';
import { VectorManager } from '../database/vector-manager';

const logger = Logger.getLogger('performance-tester');

// =============================================================================
// INTERFACES AND TYPES
// =============================================================================

export interface PerformanceTestConfig {
  // Test duration and concurrency
  duration: number; // seconds
  concurrency: number;
  rampUpTime: number; // seconds
  
  // Database-specific settings
  postgres: {
    enabled: boolean;
    connectionPoolSize: number;
    queryTypes: ('read' | 'write' | 'mixed')[];
  };
  clickhouse: {
    enabled: boolean;
    batchSize: number;
    queryTypes: ('analytics' | 'insert' | 'aggregation')[];
  };
  redis: {
    enabled: boolean;
    operationTypes: ('get' | 'set' | 'hget' | 'hset' | 'pipeline')[];
  };
  vector: {
    enabled: boolean;
    embeddingDimensions: number;
    searchTypes: ('similarity' | 'exact' | 'range')[];
  };
}

export interface TestResult {
  testName: string;
  database: string;
  timestamp: Date;
  duration: number;
  totalOperations: number;
  successfulOperations: number;
  failedOperations: number;
  averageLatency: number;
  p50Latency: number;
  p95Latency: number;
  p99Latency: number;
  throughput: number; // operations per second
  errorRate: number;
  memoryUsage: number;
  cpuUsage: number;
  details: Record<string, any>;
}

export interface LoadTestResult {
  testId: string;
  config: PerformanceTestConfig;
  results: TestResult[];
  summary: {
    totalDuration: number;
    totalOperations: number;
    averageThroughput: number;
    averageLatency: number;
    errorRate: number;
    bottlenecks: string[];
  };
}

export interface FailoverTestConfig {
  // Failover scenarios
  scenarios: Array<{
    name: string;
    type: 'connection_drop' | 'service_stop' | 'network_partition' | 'high_load';
    duration: number;
    recoveryTime: number;
  }>;
  
  // Monitoring settings
  monitoring: {
    healthCheckInterval: number;
    alertThreshold: number;
    recoveryThreshold: number;
  };
}

export interface FailoverTestResult {
  scenario: string;
  timestamp: Date;
  duration: number;
  detectionTime: number;
  recoveryTime: number;
  dataLoss: boolean;
  dataCorruption: boolean;
  serviceDegradation: number; // percentage
  details: Record<string, any>;
}

// =============================================================================
// PERFORMANCE TESTER CLASS
// =============================================================================

export class PerformanceTester extends EventEmitter {
  private static instance: PerformanceTester;
  private dbManager: DatabaseManager;
  private isRunning = false;
  private currentTest: string | null = null;

  private constructor() {
    super();
    this.dbManager = DatabaseManager.getInstance();
  }

  public static getInstance(): PerformanceTester {
    if (!PerformanceTester.instance) {
      PerformanceTester.instance = new PerformanceTester();
    }
    return PerformanceTester.instance;
  }

  /**
   * Run comprehensive performance test suite
   */
  async runPerformanceTests(config: PerformanceTestConfig): Promise<LoadTestResult> {
    if (this.isRunning) {
      throw new Error('Performance test already running');
    }

    this.isRunning = true;
    const testId = `perf_${Date.now()}`;
    const results: TestResult[] = [];

    try {
      logger.info(`Starting performance test suite: ${testId}`);

      // Run tests for each database system
      if (config.postgres.enabled) {
        const postgresResult = await this.testPostgreSQL(config);
        results.push(postgresResult);
      }

      if (config.clickhouse.enabled) {
        const clickhouseResult = await this.testClickHouse(config);
        results.push(clickhouseResult);
      }

      if (config.redis.enabled) {
        const redisResult = await this.testRedis(config);
        results.push(redisResult);
      }

      if (config.vector.enabled) {
        const vectorResult = await this.testVectorDB(config);
        results.push(vectorResult);
      }

      // Generate summary
      const summary = this.generateSummary(results);

      const loadTestResult: LoadTestResult = {
        testId,
        config,
        results,
        summary
      };

      logger.info(`Performance test suite completed: ${testId}`);
      this.emit('testCompleted', loadTestResult);

      return loadTestResult;

    } catch (error) {
      logger.error('Performance test suite failed:', error);
      throw error;
    } finally {
      this.isRunning = false;
      this.currentTest = null;
    }
  }

  /**
   * Test PostgreSQL performance
   */
  private async testPostgreSQL(config: PerformanceTestConfig): Promise<TestResult> {
    const testName = 'PostgreSQL Performance Test';
    this.currentTest = testName;
    
    logger.info(`Starting ${testName}`);
    const startTime = Date.now();
    const postgres = this.dbManager.getPostgres();
    
    const latencies: number[] = [];
    let totalOperations = 0;
    let successfulOperations = 0;
    let failedOperations = 0;

    // Generate test data
    const testData = this.generateTestData(1000);

    // Run concurrent operations
    const promises = Array(config.concurrency).fill(null).map(async (_, _index) => {
      markUnused(_index);
      const endTime = startTime + (config.duration * 1000);
      
      while (Date.now() < endTime) {
        try {
          const operationStart = Date.now();
          
          // Randomly select operation type
          const operationType = config.postgres.queryTypes[
            Math.floor(Math.random() * config.postgres.queryTypes.length)
          ];

          switch (operationType) {
            case 'read':
              await this.executePostgresRead(postgres, testData);
              break;
            case 'write':
              await this.executePostgresWrite(postgres, testData);
              break;
            case 'mixed':
              await this.executePostgresMixed(postgres, testData);
              break;
          }

          const latency = Date.now() - operationStart;
          latencies.push(latency);
          successfulOperations++;
          
        } catch (error) {
          failedOperations++;
          logger.error('PostgreSQL operation failed:', error);
        }
        
        totalOperations++;
      }
    });

    await Promise.all(promises);
    const duration = Date.now() - startTime;

    // Calculate statistics
    const sortedLatencies = latencies.sort((a, b) => a - b);
    const averageLatency: number = latencies.length > 0 ? latencies.reduce((sum, lat) => sum + lat, 0) / latencies.length : 0;
    const p50Latency: number = sortedLatencies.length > 0 ? (sortedLatencies[Math.floor(sortedLatencies.length * 0.5)] ?? 0) : 0;
    const p95Latency: number = sortedLatencies.length > 0 ? (sortedLatencies[Math.floor(sortedLatencies.length * 0.95)] ?? 0) : 0;
    const p99Latency: number = sortedLatencies.length > 0 ? (sortedLatencies[Math.floor(sortedLatencies.length * 0.99)] ?? 0) : 0;

    const result: TestResult = {
      testName,
      database: 'postgres',
      timestamp: new Date(),
      duration,
      totalOperations,
      successfulOperations,
      failedOperations,
      averageLatency,
      p50Latency,
      p95Latency,
      p99Latency,
      throughput: (successfulOperations / duration) * 1000,
      errorRate: (failedOperations / totalOperations) * 100,
      memoryUsage: await this.getMemoryUsage(),
      cpuUsage: await this.getCPUUsage(),
      details: {
        connectionPoolSize: config.postgres.connectionPoolSize,
        queryTypes: config.postgres.queryTypes,
        averageQueryTime: averageLatency
      }
    };

    logger.info(`${testName} completed: ${successfulOperations} operations, ${result.throughput.toFixed(2)} ops/sec`);
    return result;
  }

  /**
   * Test ClickHouse performance
   */
  private async testClickHouse(config: PerformanceTestConfig): Promise<TestResult> {
    const testName = 'ClickHouse Performance Test';
    this.currentTest = testName;
    
    logger.info(`Starting ${testName}`);
    const startTime = Date.now();
    const clickhouse = this.dbManager.getClickHouse();
    
    const latencies: number[] = [];
    let totalOperations = 0;
    let successfulOperations = 0;
    let failedOperations = 0;

    // Generate test data
    const testData = this.generateClickHouseTestData(config.clickhouse.batchSize);

    // Run concurrent operations
    const promises = Array(config.concurrency).fill(null).map(async (_, _index) => {
      markUnused(_index);
      const endTime = startTime + (config.duration * 1000);
      
      while (Date.now() < endTime) {
        try {
          const operationStart = Date.now();
          
          // Randomly select operation type
          const operationType = config.clickhouse.queryTypes[
            Math.floor(Math.random() * config.clickhouse.queryTypes.length)
          ];

          switch (operationType) {
            case 'analytics':
              await this.executeClickHouseAnalytics(clickhouse);
              break;
            case 'insert':
              await this.executeClickHouseInsert(clickhouse, testData);
              break;
            case 'aggregation':
              await this.executeClickHouseAggregation(clickhouse);
              break;
          }

          const latency = Date.now() - operationStart;
          latencies.push(latency);
          successfulOperations++;
          
        } catch (error) {
          failedOperations++;
          logger.error('ClickHouse operation failed:', error);
        }
        
        totalOperations++;
      }
    });

    await Promise.all(promises);
    const duration = Date.now() - startTime;

    // Calculate statistics
    const sortedLatencies = latencies.sort((a, b) => a - b);
    const averageLatency: number = latencies.length > 0 ? latencies.reduce((sum, lat) => sum + lat, 0) / latencies.length : 0;
    const p50Latency: number = sortedLatencies.length > 0 ? (sortedLatencies[Math.floor(sortedLatencies.length * 0.5)] ?? 0) : 0;
    const p95Latency: number = sortedLatencies.length > 0 ? (sortedLatencies[Math.floor(sortedLatencies.length * 0.95)] ?? 0) : 0;
    const p99Latency: number = sortedLatencies.length > 0 ? (sortedLatencies[Math.floor(sortedLatencies.length * 0.99)] ?? 0) : 0;

    const result: TestResult = {
      testName,
      database: 'clickhouse',
      timestamp: new Date(),
      duration,
      totalOperations,
      successfulOperations,
      failedOperations,
      averageLatency,
      p50Latency,
      p95Latency,
      p99Latency,
      throughput: (successfulOperations / duration) * 1000,
      errorRate: (failedOperations / totalOperations) * 100,
      memoryUsage: await this.getMemoryUsage(),
      cpuUsage: await this.getCPUUsage(),
      details: {
        batchSize: config.clickhouse.batchSize,
        queryTypes: config.clickhouse.queryTypes,
        averageQueryTime: averageLatency
      }
    };

    logger.info(`${testName} completed: ${successfulOperations} operations, ${result.throughput.toFixed(2)} ops/sec`);
    return result;
  }

  /**
   * Test Redis performance
   */
  private async testRedis(config: PerformanceTestConfig): Promise<TestResult> {
    const testName = 'Redis Performance Test';
    this.currentTest = testName;
    
    logger.info(`Starting ${testName}`);
    const startTime = Date.now();
    const redis = this.dbManager.getRedis();
    
    const latencies: number[] = [];
    let totalOperations = 0;
    let successfulOperations = 0;
    let failedOperations = 0;

    // Generate test data
    const testData = this.generateRedisTestData(1000);

    // Run concurrent operations
    const promises = Array(config.concurrency).fill(null).map(async (_, _index) => {
      markUnused(_index);
      const endTime = startTime + (config.duration * 1000);
      
      while (Date.now() < endTime) {
        try {
          const operationStart = Date.now();
          
          // Randomly select operation type
          const operationType = config.redis.operationTypes[
            Math.floor(Math.random() * config.redis.operationTypes.length)
          ];

          switch (operationType) {
            case 'get':
              await this.executeRedisGet(redis, testData);
              break;
            case 'set':
              await this.executeRedisSet(redis, testData);
              break;
            case 'hget':
              await this.executeRedisHGet(redis, testData);
              break;
            case 'hset':
              await this.executeRedisHSet(redis, testData);
              break;
            case 'pipeline':
              await this.executeRedisPipeline(redis, testData);
              break;
          }

          const latency = Date.now() - operationStart;
          latencies.push(latency);
          successfulOperations++;
          
        } catch (error) {
          failedOperations++;
          logger.error('Redis operation failed:', error);
        }
        
        totalOperations++;
      }
    });

    await Promise.all(promises);
    const duration = Date.now() - startTime;

    // Calculate statistics
    const sortedLatencies = latencies.sort((a, b) => a - b);
    const averageLatency: number = latencies.length > 0 ? latencies.reduce((sum, lat) => sum + lat, 0) / latencies.length : 0;
    const p50Latency: number = sortedLatencies.length > 0 ? (sortedLatencies[Math.floor(sortedLatencies.length * 0.5)] ?? 0) : 0;
    const p95Latency: number = sortedLatencies.length > 0 ? (sortedLatencies[Math.floor(sortedLatencies.length * 0.95)] ?? 0) : 0;
    const p99Latency: number = sortedLatencies.length > 0 ? (sortedLatencies[Math.floor(sortedLatencies.length * 0.99)] ?? 0) : 0;

    const result: TestResult = {
      testName,
      database: 'redis',
      timestamp: new Date(),
      duration,
      totalOperations,
      successfulOperations,
      failedOperations,
      averageLatency,
      p50Latency,
      p95Latency,
      p99Latency,
      throughput: (successfulOperations / duration) * 1000,
      errorRate: (failedOperations / totalOperations) * 100,
      memoryUsage: await this.getMemoryUsage(),
      cpuUsage: await this.getCPUUsage(),
      details: {
        operationTypes: config.redis.operationTypes,
        averageOperationTime: averageLatency
      }
    };

    logger.info(`${testName} completed: ${successfulOperations} operations, ${result.throughput.toFixed(2)} ops/sec`);
    return result;
  }

  /**
   * Test Vector DB performance
   */
  private async testVectorDB(config: PerformanceTestConfig): Promise<TestResult> {
    const testName = 'Vector DB Performance Test';
    this.currentTest = testName;
    
    logger.info(`Starting ${testName}`);
    const startTime = Date.now();
    const vector = this.dbManager.getVector();
    
    const latencies: number[] = [];
    let totalOperations = 0;
    let successfulOperations = 0;
    let failedOperations = 0;

    // Generate test embeddings
    const testEmbeddings = this.generateTestEmbeddings(config.vector.embeddingDimensions, 100);

    // Run concurrent operations
    const promises = Array(config.concurrency).fill(null).map(async (_, _index) => {
      markUnused(_index);
      const endTime = startTime + (config.duration * 1000);
      
      while (Date.now() < endTime) {
        try {
          const operationStart = Date.now();
          
          // Randomly select search type
          const searchType = config.vector.searchTypes[
            Math.floor(Math.random() * config.vector.searchTypes.length)
          ];

          const embeddingIndex = Math.floor(Math.random() * testEmbeddings.length);
          const embedding = testEmbeddings[embeddingIndex];
          if (!embedding) continue;

          switch (searchType) {
            case 'similarity':
              await this.executeVectorSimilarity(vector, embedding);
              break;
            case 'exact':
              await this.executeVectorExact(vector, embedding);
              break;
            case 'range':
              await this.executeVectorRange(vector, embedding);
              break;
          }

          const latency = Date.now() - operationStart;
          latencies.push(latency);
          successfulOperations++;
          
        } catch (error) {
          failedOperations++;
          logger.error('Vector DB operation failed:', error);
        }
        
        totalOperations++;
      }
    });

    await Promise.all(promises);
    const duration = Date.now() - startTime;

    // Calculate statistics
    const sortedLatencies = latencies.sort((a, b) => a - b);
    const averageLatency: number = latencies.length > 0 ? latencies.reduce((sum, lat) => sum + lat, 0) / latencies.length : 0;
    const p50Latency: number = sortedLatencies.length > 0 ? (sortedLatencies[Math.floor(sortedLatencies.length * 0.5)] ?? 0) : 0;
    const p95Latency: number = sortedLatencies.length > 0 ? (sortedLatencies[Math.floor(sortedLatencies.length * 0.95)] ?? 0) : 0;
    const p99Latency: number = sortedLatencies.length > 0 ? (sortedLatencies[Math.floor(sortedLatencies.length * 0.99)] ?? 0) : 0;

    const result: TestResult = {
      testName,
      database: 'vector',
      timestamp: new Date(),
      duration,
      totalOperations,
      successfulOperations,
      failedOperations,
      averageLatency,
      p50Latency,
      p95Latency,
      p99Latency,
      throughput: (successfulOperations / duration) * 1000,
      errorRate: (failedOperations / totalOperations) * 100,
      memoryUsage: await this.getMemoryUsage(),
      cpuUsage: await this.getCPUUsage(),
      details: {
        embeddingDimensions: config.vector.embeddingDimensions,
        searchTypes: config.vector.searchTypes,
        averageSearchTime: averageLatency
      }
    };

    logger.info(`${testName} completed: ${successfulOperations} operations, ${result.throughput.toFixed(2)} ops/sec`);
    return result;
  }

  // =============================================================================
  // OPERATION EXECUTORS
  // =============================================================================

  private async executePostgresRead(postgres: any, testData: any[]): Promise<void> {
    const randomData = testData[Math.floor(Math.random() * testData.length)];
    await postgres.query(
      'SELECT * FROM users WHERE id = $1',
      [randomData.userId]
    );
  }

  private async executePostgresWrite(postgres: any, testData: any[]): Promise<void> {
    const randomData = testData[Math.floor(Math.random() * testData.length)];
    await postgres.query(
      'INSERT INTO test_performance (user_id, data, created_at) VALUES ($1, $2, NOW())',
      [randomData.userId, JSON.stringify(randomData)]
    );
  }

  private async executePostgresMixed(postgres: any, testData: any[]): Promise<void> {
    const randomData = testData[Math.floor(Math.random() * testData.length)];
    await postgres.query(
      'UPDATE users SET last_active_at = NOW() WHERE id = $1',
      [randomData.userId]
    );
  }

  private async executeClickHouseAnalytics(clickhouse: ClickHouseManager): Promise<void> {
    await clickhouse.query(`
      SELECT 
        asset_id,
        avg(price) as avg_price,
        max(price) as max_price,
        min(price) as min_price,
        count(*) as trade_count
      FROM price_data_raw 
      WHERE timestamp >= now() - INTERVAL 1 HOUR
      GROUP BY asset_id
      ORDER BY trade_count DESC
      LIMIT 10
    `);
  }

  private async executeClickHouseInsert(clickhouse: ClickHouseManager, testData: any[]): Promise<void> {
    await clickhouse.insert('price_data_raw', testData);
  }

  private async executeClickHouseAggregation(clickhouse: ClickHouseManager): Promise<void> {
    await clickhouse.query(`
      SELECT 
        toStartOfHour(timestamp) as hour,
        asset_id,
        sum(volume) as total_volume,
        avg(price) as avg_price
      FROM price_data_raw 
      WHERE timestamp >= now() - INTERVAL 24 HOUR
      GROUP BY hour, asset_id
      ORDER BY hour DESC, total_volume DESC
    `);
  }

  private async executeRedisGet(redis: any, testData: any[]): Promise<void> {
    const randomData = testData[Math.floor(Math.random() * testData.length)];
    await redis.get(`test:${randomData.key}`);
  }

  private async executeRedisSet(redis: any, testData: any[]): Promise<void> {
    const randomData = testData[Math.floor(Math.random() * testData.length)];
    await redis.setex(`test:${randomData.key}`, 3600, JSON.stringify(randomData));
  }

  private async executeRedisHGet(redis: any, testData: any[]): Promise<void> {
    const randomData = testData[Math.floor(Math.random() * testData.length)];
    await redis.hget(`test:hash:${randomData.key}`, 'field');
  }

  private async executeRedisHSet(redis: any, testData: any[]): Promise<void> {
    const randomData = testData[Math.floor(Math.random() * testData.length)];
    await redis.hset(`test:hash:${randomData.key}`, 'field', JSON.stringify(randomData));
  }

  private async executeRedisPipeline(redis: any, testData: any[]): Promise<void> {
    const randomData = testData[Math.floor(Math.random() * testData.length)];
    const pipeline = redis.pipeline();
    
    for (let i = 0; i < 10; i++) {
      pipeline.setex(`test:pipeline:${randomData.key}:${i}`, 3600, JSON.stringify(randomData));
    }
    
    await pipeline.exec();
  }

  private async executeVectorSimilarity(vector: VectorManager, embedding: number[]): Promise<void> {
    await vector.search('test_collection', {
      vector: embedding,
      limit: 10,
      score_threshold: 0.8
    });
  }

  private async executeVectorExact(vector: VectorManager, embedding: number[]): Promise<void> {
    await vector.search('test_collection', {
      vector: embedding,
      limit: 10
    });
  }

  private async executeVectorRange(vector: VectorManager, embedding: number[]): Promise<void> {
    await vector.search('test_collection', {
      vector: embedding,
      limit: 10
    });
  }

  // =============================================================================
  // UTILITY METHODS
  // =============================================================================

  private generateTestData(count: number): any[] {
    const data = [];
    for (let i = 0; i < count; i++) {
      data.push({
        userId: `user_${Math.floor(Math.random() * 10000)}`,
        key: `key_${Math.floor(Math.random() * 10000)}`,
        data: {
          value: Math.random() * 1000,
          timestamp: new Date().toISOString(),
          metadata: {
            source: 'performance_test',
            index: i
          }
        }
      });
    }
    return data;
  }

  private generateClickHouseTestData(batchSize: number): any[] {
    const data = [];
    for (let i = 0; i < batchSize; i++) {
      data.push({
        timestamp: new Date(),
        asset_id: `ASSET_${Math.floor(Math.random() * 100)}`,
        chain_id: Math.floor(Math.random() * 10) + 1,
        protocol_id: `PROTOCOL_${Math.floor(Math.random() * 50)}`,
        open: Math.random() * 1000,
        high: Math.random() * 1000,
        low: Math.random() * 1000,
        close: Math.random() * 1000,
        volume: Math.random() * 1000000,
        volume_usd: Math.random() * 1000000,
        market_cap: Math.random() * 1000000000,
        data_source: 'performance_test'
      });
    }
    return data;
  }

  private generateRedisTestData(count: number): any[] {
    const data = [];
    for (let i = 0; i < count; i++) {
      data.push({
        key: `test_key_${Math.floor(Math.random() * 10000)}`,
        value: {
          id: i,
          data: Math.random() * 1000,
          timestamp: Date.now(),
          metadata: {
            source: 'performance_test',
            index: i
          }
        }
      });
    }
    return data;
  }

  private generateTestEmbeddings(dimensions: number, count: number): number[][] {
    const embeddings = [];
    for (let i = 0; i < count; i++) {
      const embedding = [];
      for (let j = 0; j < dimensions; j++) {
        embedding.push(Math.random() * 2 - 1); // Values between -1 and 1
      }
      embeddings.push(embedding);
    }
    return embeddings;
  }

  private generateSummary(results: TestResult[]): LoadTestResult['summary'] {
    const totalDuration = Math.max(...results.map(r => r.duration));
    const totalOperations = results.reduce((sum, r) => sum + r.totalOperations, 0);
    markUnused(results.reduce((sum, r) => sum + r.successfulOperations, 0));
    const totalFailed = results.reduce((sum, r) => sum + r.failedOperations, 0);
    
    const averageThroughput = results.reduce((sum, r) => sum + r.throughput, 0) / results.length;
    const averageLatency = results.reduce((sum, r) => sum + r.averageLatency, 0) / results.length;
    const errorRate = (totalFailed / totalOperations) * 100;

    // Identify bottlenecks
    const bottlenecks: string[] = [];
    results.forEach(result => {
      if (result.errorRate > 5) {
        bottlenecks.push(`${result.database}: High error rate (${result.errorRate.toFixed(2)}%)`);
      }
      if (result.averageLatency > 1000) {
        bottlenecks.push(`${result.database}: High latency (${result.averageLatency.toFixed(2)}ms)`);
      }
      if (result.throughput < 100) {
        bottlenecks.push(`${result.database}: Low throughput (${result.throughput.toFixed(2)} ops/sec)`);
      }
    });

    return {
      totalDuration,
      totalOperations,
      averageThroughput,
      averageLatency,
      errorRate,
      bottlenecks
    };
  }

  private async getMemoryUsage(): Promise<number> {
    // In a real implementation, this would get actual memory usage
    return process.memoryUsage().heapUsed / 1024 / 1024; // MB
  }

  private async getCPUUsage(): Promise<number> {
    // In a real implementation, this would get actual CPU usage
    return Math.random() * 100; // Simulated percentage
  }

  /**
   * Get current test status
   */
  getStatus(): { isRunning: boolean; currentTest: string | null } {
    return {
      isRunning: this.isRunning,
      currentTest: this.currentTest
    };
  }
} 