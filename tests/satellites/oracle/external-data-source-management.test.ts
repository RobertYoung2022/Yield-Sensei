/**
 * Oracle Satellite - External Data Source Management Validation
 * Task 26.4: Test external data source management, failover mechanisms, and source prioritization
 * 
 * Tests data source lifecycle management, health monitoring, automatic failover, and priority-based routing
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach, jest } from '@jest/globals';
import { ExternalDataSourceManager } from '../../../src/satellites/oracle/management/external-data-source-manager';
import { DataSourceRegistry } from '../../../src/satellites/oracle/management/data-source-registry';
import { FailoverController } from '../../../src/satellites/oracle/management/failover-controller';
import { SourceHealthMonitor } from '../../../src/satellites/oracle/management/source-health-monitor';
import { DataSourcePrioritizer } from '../../../src/satellites/oracle/management/data-source-prioritizer';
import { getUnifiedAIClient } from '../../../src/integrations/ai/unified-ai-client';
import { getLogger } from '../../../src/shared/logging/logger';
import Redis from 'ioredis';
import { Pool } from 'pg';

describe('Oracle Satellite - External Data Source Management Validation', () => {
  let dataSourceManager: ExternalDataSourceManager;
  let sourceRegistry: DataSourceRegistry;
  let failoverController: FailoverController;
  let healthMonitor: SourceHealthMonitor;
  let sourcePrioritizer: DataSourcePrioritizer;
  let redisClient: Redis;
  let pgPool: Pool;
  let aiClient: any;
  let logger: any;

  beforeAll(async () => {
    // Initialize dependencies
    redisClient = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      lazyConnect: true,
      connectTimeout: 5000,
      commandTimeout: 10000,
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3
    });

    pgPool = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'yieldsense_test',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 30000,
      max: 10
    });

    aiClient = getUnifiedAIClient();
    logger = getLogger({ name: 'external-data-source-test' });

    // Initialize External Data Source Manager
    dataSourceManager = new ExternalDataSourceManager({
      maxConcurrentSources: 50,
      healthCheckInterval: 30000, // 30 seconds
      failoverTimeout: 5000,
      priorityRefreshInterval: 300000, // 5 minutes
      enableAutoDiscovery: true,
      enableFailover: true
    }, redisClient, pgPool, aiClient, logger);

    sourceRegistry = new DataSourceRegistry({
      registryStorageType: 'hybrid', // Both Redis and PostgreSQL
      enableVersioning: true,
      enableAuditing: true,
      validationLevel: 'strict'
    }, redisClient, pgPool, logger);

    failoverController = new FailoverController({
      failoverStrategies: ['round_robin', 'weighted_random', 'performance_based'],
      maxRetries: 3,
      circuitBreakerEnabled: true,
      circuitBreakerThreshold: 5,
      circuitBreakerTimeout: 60000
    }, logger);

    healthMonitor = new SourceHealthMonitor({
      monitoringInterval: 15000, // 15 seconds
      healthCheckTimeout: 5000,
      metricsRetentionDays: 30,
      alertThresholds: {
        responseTime: 2000,
        errorRate: 0.05,
        availability: 0.95
      }
    }, redisClient, pgPool, logger);

    sourcePrioritizer = new DataSourcePrioritizer({
      prioritizationFactors: ['reliability', 'speed', 'cost', 'data_quality'],
      dynamicWeighting: true,
      learningEnabled: true,
      rebalanceInterval: 600000 // 10 minutes
    }, aiClient, logger);

    await dataSourceManager.initialize();
    await sourceRegistry.initialize();
    await healthMonitor.initialize();
  });

  afterAll(async () => {
    if (dataSourceManager) {
      await dataSourceManager.shutdown();
    }
    if (healthMonitor) {
      await healthMonitor.shutdown();
    }
    if (redisClient) {
      await redisClient.quit();
    }
    if (pgPool) {
      await pgPool.end();
    }
  });

  describe('Data Source Registry Management', () => {
    
    test('should register and manage multiple data source types', async () => {
      const dataSources = [
        {
          id: 'coinbase-pro-api',
          name: 'Coinbase Pro API',
          type: 'rest_api',
          category: 'price_feed',
          endpoint: 'https://api.pro.coinbase.com',
          authentication: {
            type: 'api_key',
            keyField: 'CB_ACCESS_KEY',
            secretField: 'CB_ACCESS_SECRET'
          },
          rateLimit: {
            requestsPerSecond: 10,
            burstLimit: 50
          },
          dataFormat: 'json',
          supportedAssets: ['BTC', 'ETH', 'USDC', 'USDT'],
          reliability: 0.98,
          latency: 150
        },
        {
          id: 'chainlink-price-feeds',
          name: 'Chainlink Price Feeds',
          type: 'blockchain_oracle',
          category: 'price_feed',
          blockchain: 'ethereum',
          contractAddresses: {
            'ETH/USD': '0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419',
            'BTC/USD': '0xF4030086522a5bEEa4988F8cA5B36dbC97BeE88c'
          },
          updateFrequency: 3600, // 1 hour
          reliability: 0.995,
          latency: 300
        },
        {
          id: 'bloomberg-terminal',
          name: 'Bloomberg Terminal',
          type: 'enterprise_feed',
          category: 'financial_data',
          endpoint: 'https://api.bloomberg.com/eqs',
          authentication: {
            type: 'certificate',
            certPath: '/certs/bloomberg.pem'
          },
          dataTypes: ['prices', 'news', 'analytics'],
          reliability: 0.999,
          latency: 50,
          cost: 'high'
        },
        {
          id: 'websocket-binance',
          name: 'Binance WebSocket',
          type: 'websocket',
          category: 'real_time_feed',
          endpoint: 'wss://stream.binance.com:9443/ws',
          maxConnections: 10,
          heartbeatInterval: 30000,
          reliability: 0.97,
          latency: 25
        }
      ];

      const registrationResults = [];

      for (const source of dataSources) {
        const result = await sourceRegistry.registerDataSource(source);
        registrationResults.push(result);

        expect(result).toBeDefined();
        expect(result.success).toBe(true);
        expect(result.sourceId).toBe(source.id);
        expect(result.registrationTimestamp).toBeDefined();
      }

      // Verify all sources are registered
      const allSources = await sourceRegistry.getAllRegisteredSources();
      expect(allSources.length).toBe(dataSources.length);

      // Verify sources can be retrieved by type
      const apiSources = await sourceRegistry.getSourcesByType('rest_api');
      expect(apiSources.length).toBeGreaterThhan(0);

      const oracleSources = await sourceRegistry.getSourcesByCategory('price_feed');
      expect(oracleSources.length).toBeGreaterThan(0);
    });

    test('should validate data source configurations', async () => {
      const invalidSources = [
        {
          name: 'Missing ID Source',
          type: 'rest_api',
          endpoint: 'https://api.example.com'
          // Missing required 'id' field
        },
        {
          id: 'invalid-endpoint',
          name: 'Invalid Endpoint',
          type: 'rest_api',
          endpoint: 'not-a-valid-url'
        },
        {
          id: 'missing-auth',
          name: 'Missing Auth Source', 
          type: 'rest_api',
          endpoint: 'https://api.example.com',
          authentication: {
            type: 'api_key'
            // Missing required authentication fields
          }
        },
        {
          id: 'invalid-rate-limit',
          name: 'Invalid Rate Limit',
          type: 'rest_api',
          endpoint: 'https://api.example.com',
          rateLimit: {
            requestsPerSecond: -5 // Invalid negative rate limit
          }
        }
      ];

      for (const invalidSource of invalidSources) {
        const result = await sourceRegistry.registerDataSource(invalidSource);

        expect(result).toBeDefined();
        expect(result.success).toBe(false);
        expect(result.validationErrors).toBeDefined();
        expect(result.validationErrors.length).toBeGreaterThan(0);
      }
    });

    test('should support data source versioning and updates', async () => {
      const originalSource = {
        id: 'versioned-source',
        name: 'Versioned API Source',
        type: 'rest_api',
        endpoint: 'https://api.v1.example.com',
        version: '1.0.0',
        reliability: 0.95
      };

      // Register original version
      const v1Result = await sourceRegistry.registerDataSource(originalSource);
      expect(v1Result.success).toBe(true);

      // Update to version 2.0.0
      const updatedSource = {
        ...originalSource,
        endpoint: 'https://api.v2.example.com',
        version: '2.0.0',
        reliability: 0.98,
        newFeatures: ['batch_requests', 'real_time_updates']
      };

      const v2Result = await sourceRegistry.updateDataSource('versioned-source', updatedSource);
      expect(v2Result.success).toBe(true);
      expect(v2Result.version).toBe('2.0.0');

      // Verify version history
      const versionHistory = await sourceRegistry.getSourceVersionHistory('versioned-source');
      expect(versionHistory.length).toBe(2);
      expect(versionHistory[0].version).toBe('1.0.0');
      expect(versionHistory[1].version).toBe('2.0.0');

      // Should be able to rollback to previous version
      const rollbackResult = await sourceRegistry.rollbackToVersion('versioned-source', '1.0.0');
      expect(rollbackResult.success).toBe(true);

      const currentSource = await sourceRegistry.getDataSource('versioned-source');
      expect(currentSource.version).toBe('1.0.0');
      expect(currentSource.endpoint).toBe('https://api.v1.example.com');
    });
  });

  describe('Health Monitoring and Performance Tracking', () => {
    
    test('should monitor data source health metrics', async () => {
      const testSources = [
        {
          id: 'healthy-source',
          name: 'Healthy API',
          endpoint: 'https://api.healthy.com',
          expectedHealth: 'excellent'
        },
        {
          id: 'slow-source',
          name: 'Slow API',
          endpoint: 'https://api.slow.com',
          expectedHealth: 'degraded'
        },
        {
          id: 'failing-source',
          name: 'Failing API',
          endpoint: 'https://api.failing.com',
          expectedHealth: 'critical'
        }
      ];

      // Register test sources
      for (const source of testSources) {
        await sourceRegistry.registerDataSource({
          id: source.id,
          name: source.name,
          type: 'rest_api',
          endpoint: source.endpoint
        });
      }

      // Simulate health check results
      const healthCheckResults = {
        'healthy-source': {
          responseTime: 120,
          successRate: 0.99,
          availability: 0.995,
          errorRate: 0.01,
          lastError: null
        },
        'slow-source': {
          responseTime: 3500,
          successRate: 0.92,
          availability: 0.88,
          errorRate: 0.08,
          lastError: 'timeout'
        },
        'failing-source': {
          responseTime: null,
          successRate: 0.45,
          availability: 0.60,
          errorRate: 0.55,
          lastError: 'connection_refused'
        }
      };

      // Update health metrics
      for (const [sourceId, metrics] of Object.entries(healthCheckResults)) {
        await healthMonitor.updateHealthMetrics(sourceId, metrics);
      }

      // Verify health assessments
      for (const source of testSources) {
        const healthStatus = await healthMonitor.getSourceHealth(source.id);

        expect(healthStatus).toBeDefined();
        expect(healthStatus.sourceId).toBe(source.id);
        expect(healthStatus.overallStatus).toBeDefined();

        switch (source.expectedHealth) {
          case 'excellent':
            expect(healthStatus.overallStatus).toBe('healthy');
            expect(healthStatus.healthScore).toBeGreaterThan(0.9);
            break;
          case 'degraded':
            expect(healthStatus.overallStatus).toBe('degraded');
            expect(healthStatus.healthScore).toBeLessThan(0.9);
            expect(healthStatus.healthScore).toBeGreaterThan(0.6);
            break;
          case 'critical':
            expect(healthStatus.overallStatus).toBe('critical');
            expect(healthStatus.healthScore).toBeLessThan(0.6);
            break;
        }

        expect(healthStatus.metrics).toBeDefined();
        expect(healthStatus.lastUpdated).toBeDefined();
      }
    });

    test('should generate health alerts for degraded sources', async () => {
      const alertingSource = {
        id: 'alerting-source',
        name: 'Source with Alerts',
        type: 'rest_api',
        endpoint: 'https://api.alerts.com'
      };

      await sourceRegistry.registerDataSource(alertingSource);

      // Simulate degraded performance that should trigger alerts
      const degradedMetrics = [
        {
          timestamp: new Date(),
          responseTime: 5000, // Above 2s threshold
          successRate: 0.85,
          availability: 0.90,
          errorRate: 0.15
        },
        {
          timestamp: new Date(Date.now() + 60000),
          responseTime: 6000,
          successRate: 0.80,
          availability: 0.85,
          errorRate: 0.20
        },
        {
          timestamp: new Date(Date.now() + 120000),
          responseTime: 4500,
          successRate: 0.82,
          availability: 0.88,
          errorRate: 0.18
        }
      ];

      for (const metrics of degradedMetrics) {
        await healthMonitor.updateHealthMetrics('alerting-source', metrics);
      }

      // Check for generated alerts
      const alerts = await healthMonitor.getActiveAlerts('alerting-source');

      expect(alerts).toBeDefined();
      expect(alerts.length).toBeGreaterThan(0);

      const responseTimeAlert = alerts.find(alert => alert.type === 'high_response_time');
      expect(responseTimeAlert).toBeDefined();
      expect(responseTimeAlert.severity).toBe('warning');

      const errorRateAlert = alerts.find(alert => alert.type === 'high_error_rate');
      expect(errorRateAlert).toBeDefined();
      expect(errorRateAlert.severity).toBe('critical');

      // Verify alert details
      alerts.forEach(alert => {
        expect(alert.sourceId).toBe('alerting-source');
        expect(alert.triggeredAt).toBeDefined();
        expect(alert.threshold).toBeDefined();
        expect(alert.currentValue).toBeDefined();
      });
    });

    test('should track performance trends over time', async () => {
      const trendingSource = {
        id: 'trending-source',
        name: 'Performance Trending Source',
        type: 'rest_api',
        endpoint: 'https://api.trending.com'
      };

      await sourceRegistry.registerDataSource(trendingSource);

      // Generate 30 days of simulated performance data
      const performanceData = [];
      const baseTime = Date.now() - (30 * 24 * 60 * 60 * 1000); // 30 days ago

      for (let day = 0; day < 30; day++) {
        const timestamp = new Date(baseTime + (day * 24 * 60 * 60 * 1000));
        
        // Simulate gradual performance degradation over time
        const degradationFactor = day / 30;
        const metrics = {
          timestamp,
          responseTime: 200 + (degradationFactor * 1000), // Getting slower
          successRate: 0.99 - (degradationFactor * 0.1), // Getting less reliable
          availability: 0.995 - (degradationFactor * 0.05),
          errorRate: 0.01 + (degradationFactor * 0.05)
        };

        performanceData.push(metrics);
        await healthMonitor.updateHealthMetrics('trending-source', metrics);
      }

      // Analyze performance trends
      const trendAnalysis = await healthMonitor.analyzeTrends('trending-source', {
        period: 30,
        unit: 'days'
      });

      expect(trendAnalysis).toBeDefined();
      expect(trendAnalysis.trends).toBeDefined();

      // Should detect degrading response time
      expect(trendAnalysis.trends.responseTime.direction).toBe('increasing');
      expect(trendAnalysis.trends.responseTime.significance).toBeGreaterThan(0.8);

      // Should detect decreasing success rate
      expect(trendAnalysis.trends.successRate.direction).toBe('decreasing');
      expect(trendAnalysis.trends.successRate.significance).toBeGreaterThan(0.8);

      // Should provide predictions
      expect(trendAnalysis.predictions).toBeDefined();
      expect(trendAnalysis.predictions.responseTime).toBeDefined();
      expect(trendAnalysis.predictions.successRate).toBeDefined();

      // Should recommend actions
      expect(trendAnalysis.recommendations).toBeDefined();
      expect(trendAnalysis.recommendations.length).toBeGreaterThan(0);
    });
  });

  describe('Failover and High Availability', () => {
    
    test('should implement automatic failover mechanisms', async () => {
      const primarySource = {
        id: 'primary-source',
        name: 'Primary Data Source',
        type: 'rest_api',
        endpoint: 'https://api.primary.com',
        priority: 1,
        reliability: 0.98
      };

      const backupSources = [
        {
          id: 'backup-source-1',
          name: 'Backup Source 1',
          type: 'rest_api',
          endpoint: 'https://api.backup1.com',
          priority: 2,
          reliability: 0.95
        },
        {
          id: 'backup-source-2', 
          name: 'Backup Source 2',
          type: 'rest_api',
          endpoint: 'https://api.backup2.com',
          priority: 3,
          reliability: 0.92
        }
      ];

      // Register all sources
      await sourceRegistry.registerDataSource(primarySource);
      for (const backup of backupSources) {
        await sourceRegistry.registerDataSource(backup);
      }

      // Configure failover group
      const failoverGroup = {
        id: 'price-feed-group',
        primarySource: 'primary-source',
        backupSources: ['backup-source-1', 'backup-source-2'],
        failoverStrategy: 'priority_based',
        healthCheckInterval: 10000,
        automaticFailback: true
      };

      await failoverController.createFailoverGroup(failoverGroup);

      // Simulate primary source failure
      await healthMonitor.updateHealthMetrics('primary-source', {
        responseTime: null,
        successRate: 0.0,
        availability: 0.0,
        errorRate: 1.0,
        lastError: 'connection_timeout'
      });

      // Trigger failover
      const failoverResult = await failoverController.executeFailover('price-feed-group');

      expect(failoverResult).toBeDefined();
      expect(failoverResult.success).toBe(true);
      expect(failoverResult.newActiveSource).toBe('backup-source-1'); // Highest priority backup
      expect(failoverResult.failoverReason).toContain('primary_source_failed');
      expect(failoverResult.failoverTime).toBeDefined();

      // Verify active source changed
      const activeSource = await failoverController.getActiveSource('price-feed-group');
      expect(activeSource.sourceId).toBe('backup-source-1');

      // Test cascade failover if backup also fails
      await healthMonitor.updateHealthMetrics('backup-source-1', {
        responseTime: null,
        successRate: 0.0,
        availability: 0.0,
        errorRate: 1.0,
        lastError: 'connection_refused'
      });

      const cascadeFailover = await failoverController.executeFailover('price-feed-group');
      expect(cascadeFailover.newActiveSource).toBe('backup-source-2');
    });

    test('should support different failover strategies', async () => {
      const strategyTestSources = [
        {
          id: 'strategy-source-1',
          name: 'Strategy Source 1',
          type: 'rest_api',
          endpoint: 'https://api.strategy1.com',
          reliability: 0.95,
          responseTime: 100,
          cost: 0.1
        },
        {
          id: 'strategy-source-2',
          name: 'Strategy Source 2', 
          type: 'rest_api',
          endpoint: 'https://api.strategy2.com',
          reliability: 0.90,
          responseTime: 200,
          cost: 0.05
        },
        {
          id: 'strategy-source-3',
          name: 'Strategy Source 3',
          type: 'rest_api', 
          endpoint: 'https://api.strategy3.com',
          reliability: 0.88,
          responseTime: 150,
          cost: 0.08
        }
      ];

      // Register sources
      for (const source of strategyTestSources) {
        await sourceRegistry.registerDataSource(source);
        await healthMonitor.updateHealthMetrics(source.id, {
          responseTime: source.responseTime,
          successRate: source.reliability,
          availability: source.reliability,
          errorRate: 1 - source.reliability
        });
      }

      const failoverStrategies = [
        {
          name: 'round_robin',
          expectedPattern: ['strategy-source-1', 'strategy-source-2', 'strategy-source-3']
        },
        {
          name: 'weighted_random',
          expectedBehavior: 'reliability_weighted'
        },
        {
          name: 'performance_based',
          expectedWinner: 'strategy-source-1' // Best performance
        },
        {
          name: 'cost_optimized',
          expectedWinner: 'strategy-source-2' // Lowest cost
        }
      ];

      for (const strategy of failoverStrategies) {
        const strategyGroup = {
          id: `strategy-test-${strategy.name}`,
          sources: strategyTestSources.map(s => s.id),
          failoverStrategy: strategy.name,
          automaticFailover: true
        };

        await failoverController.createFailoverGroup(strategyGroup);

        if (strategy.name === 'round_robin') {
          // Test round robin pattern
          const selections = [];
          for (let i = 0; i < 6; i++) {
            const selection = await failoverController.selectSource(strategyGroup.id);
            selections.push(selection.sourceId);
          }

          // Should cycle through sources
          expect(selections[0]).toBe(strategy.expectedPattern[0]);
          expect(selections[1]).toBe(strategy.expectedPattern[1]);
          expect(selections[2]).toBe(strategy.expectedPattern[2]);
          expect(selections[3]).toBe(strategy.expectedPattern[0]); // Cycle back
        } else if (strategy.expectedWinner) {
          // Test single winner strategies
          const selections = [];
          for (let i = 0; i < 10; i++) {
            const selection = await failoverController.selectSource(strategyGroup.id);
            selections.push(selection.sourceId);
          }

          // Most selections should be the expected winner
          const winnerCount = selections.filter(s => s === strategy.expectedWinner).length;
          expect(winnerCount).toBeGreaterThan(5);
        }
      }
    });

    test('should implement circuit breaker pattern', async () => {
      const circuitBreakerSource = {
        id: 'circuit-breaker-source',
        name: 'Circuit Breaker Test Source',
        type: 'rest_api',
        endpoint: 'https://api.circuit-test.com'
      };

      await sourceRegistry.registerDataSource(circuitBreakerSource);

      const circuitBreakerConfig = {
        sourceId: 'circuit-breaker-source',
        failureThreshold: 5,
        timeout: 30000, // 30 seconds
        halfOpenRetryAttempts: 3
      };

      await failoverController.configureCircuitBreaker(circuitBreakerConfig);

      // Simulate repeated failures to trigger circuit breaker
      for (let i = 0; i < 6; i++) {
        await healthMonitor.updateHealthMetrics('circuit-breaker-source', {
          responseTime: null,
          successRate: 0.0,
          availability: 0.0,
          errorRate: 1.0,
          lastError: `failure_${i + 1}`
        });
      }

      // Check circuit breaker state
      const circuitState = await failoverController.getCircuitBreakerState('circuit-breaker-source');
      expect(circuitState).toBeDefined();
      expect(circuitState.state).toBe('open'); // Should be open after 5+ failures
      expect(circuitState.failureCount).toBeGreaterThanOrEqual(5);

      // Attempt to use source while circuit is open
      const blockedResult = await failoverController.selectSource('circuit-breaker-source');
      expect(blockedResult.blocked).toBe(true);
      expect(blockedResult.reason).toContain('circuit_breaker_open');

      // Simulate time passing to half-open state
      jest.advanceTimersByTime(30000);

      const halfOpenState = await failoverController.getCircuitBreakerState('circuit-breaker-source');
      expect(halfOpenState.state).toBe('half_open');

      // Test successful request to close circuit
      await healthMonitor.updateHealthMetrics('circuit-breaker-source', {
        responseTime: 150,
        successRate: 1.0,
        availability: 1.0,
        errorRate: 0.0,
        lastError: null
      });

      const closedState = await failoverController.getCircuitBreakerState('circuit-breaker-source');
      expect(closedState.state).toBe('closed');
      expect(closedState.failureCount).toBe(0);
    });
  });

  describe('Source Prioritization and Load Balancing', () => {
    
    test('should prioritize sources based on multiple factors', async () => {
      const prioritizationSources = [
        {
          id: 'premium-source',
          name: 'Premium Data Source',
          type: 'enterprise_feed',
          reliability: 0.999,
          responseTime: 50,
          cost: 1.0,
          dataQuality: 0.98,
          supportLevel: 'enterprise'
        },
        {
          id: 'standard-source',
          name: 'Standard Data Source',  
          type: 'rest_api',
          reliability: 0.95,
          responseTime: 200,
          cost: 0.3,
          dataQuality: 0.92,
          supportLevel: 'standard'
        },
        {
          id: 'budget-source',
          name: 'Budget Data Source',
          type: 'rest_api', 
          reliability: 0.88,
          responseTime: 500,
          cost: 0.05,
          dataQuality: 0.85,
          supportLevel: 'community'
        }
      ];

      // Register sources with different characteristics
      for (const source of prioritizationSources) {
        await sourceRegistry.registerDataSource(source);
        await healthMonitor.updateHealthMetrics(source.id, {
          responseTime: source.responseTime,
          successRate: source.reliability,
          availability: source.reliability,
          errorRate: 1 - source.reliability
        });
      }

      // Test different prioritization scenarios
      const prioritizationScenarios = [
        {
          name: 'Quality First',
          weights: { reliability: 0.4, dataQuality: 0.3, responseTime: 0.2, cost: 0.1 },
          expectedWinner: 'premium-source'
        },
        {
          name: 'Cost Optimized',
          weights: { cost: 0.5, reliability: 0.2, responseTime: 0.2, dataQuality: 0.1 },
          expectedWinner: 'budget-source'
        },
        {
          name: 'Performance Focused',
          weights: { responseTime: 0.4, reliability: 0.3, dataQuality: 0.2, cost: 0.1 },
          expectedWinner: 'premium-source'
        },
        {
          name: 'Balanced',
          weights: { reliability: 0.25, responseTime: 0.25, cost: 0.25, dataQuality: 0.25 },
          expectedWinner: 'standard-source'
        }
      ];

      for (const scenario of prioritizationScenarios) {
        const prioritization = await sourcePrioritizer.calculatePriorities(
          prioritizationSources.map(s => s.id),
          scenario.weights
        );

        expect(prioritization).toBeDefined();
        expect(prioritization.rankings).toBeDefined();
        expect(prioritization.rankings.length).toBe(prioritizationSources.length);

        // Check if expected winner is at the top
        const topRanked = prioritization.rankings[0];
        expect(topRanked.sourceId).toBe(scenario.expectedWinner);
        expect(topRanked.score).toBeGreaterThan(0);

        // Verify scoring details
        expect(topRanked.breakdown).toBeDefined();
        expect(topRanked.breakdown.reliability).toBeDefined();
        expect(topRanked.breakdown.responseTime).toBeDefined();
        expect(topRanked.breakdown.cost).toBeDefined();
        expect(topRanked.breakdown.dataQuality).toBeDefined();
      }
    });

    test('should implement dynamic load balancing', async () => {
      const loadBalancingSources = Array(5).fill(null).map((_, i) => ({
        id: `load-source-${i + 1}`,
        name: `Load Balancing Source ${i + 1}`,
        type: 'rest_api',
        endpoint: `https://api.load${i + 1}.com`,
        capacity: 100 + i * 50, // Different capacities
        currentLoad: 0
      }));

      // Register sources
      for (const source of loadBalancingSources) {
        await sourceRegistry.registerDataSource(source);
      }

      const loadBalancer = await dataSourceManager.createLoadBalancer({
        sources: loadBalancingSources.map(s => s.id),
        strategy: 'weighted_least_connections',
        healthCheckInterval: 5000,
        loadThreshold: 0.8
      });

      // Simulate 1000 requests
      const requestResults = [];
      for (let i = 0; i < 1000; i++) {
        const selectedSource = await loadBalancer.selectSource();
        requestResults.push(selectedSource.sourceId);
        
        // Simulate request completion
        await loadBalancer.recordRequestCompletion(selectedSource.sourceId, {
          responseTime: Math.random() * 500 + 100,
          success: Math.random() > 0.05 // 95% success rate
        });
      }

      // Analyze load distribution
      const loadDistribution = {};
      requestResults.forEach(sourceId => {
        loadDistribution[sourceId] = (loadDistribution[sourceId] || 0) + 1;
      });

      // Verify load is distributed
      const sourceCounts = Object.values(loadDistribution);
      const maxLoad = Math.max(...sourceCounts);
      const minLoad = Math.min(...sourceCounts);
      
      // Load should be reasonably balanced (max should not be more than 2x min)
      expect(maxLoad / minLoad).toBeLessThan(2.5);

      // Higher capacity sources should handle more requests
      const highCapacitySource = 'load-source-5'; // Highest capacity
      const lowCapacitySource = 'load-source-1'; // Lowest capacity
      
      expect(loadDistribution[highCapacitySource]).toBeGreaterThan(loadDistribution[lowCapacitySource]);
    });

    test('should adapt to changing conditions dynamically', async () => {
      const adaptiveSources = [
        {
          id: 'adaptive-source-1',
          name: 'Adaptive Source 1',
          type: 'rest_api',
          endpoint: 'https://api.adaptive1.com'
        },
        {
          id: 'adaptive-source-2', 
          name: 'Adaptive Source 2',
          type: 'rest_api',
          endpoint: 'https://api.adaptive2.com'
        }
      ];

      // Register sources
      for (const source of adaptiveSources) {
        await sourceRegistry.registerDataSource(source);
      }

      // Initial state: both sources performing equally
      await healthMonitor.updateHealthMetrics('adaptive-source-1', {
        responseTime: 200,
        successRate: 0.95,
        availability: 0.95,
        errorRate: 0.05
      });

      await healthMonitor.updateHealthMetrics('adaptive-source-2', {
        responseTime: 200,
        successRate: 0.95,
        availability: 0.95,
        errorRate: 0.05
      });

      // Get initial prioritization
      const initialPriorities = await sourcePrioritizer.calculatePriorities(
        adaptiveSources.map(s => s.id),
        { reliability: 0.5, responseTime: 0.5 }
      );

      // Both should have similar scores initially
      const score1Initial = initialPriorities.rankings.find(r => r.sourceId === 'adaptive-source-1').score;
      const score2Initial = initialPriorities.rankings.find(r => r.sourceId === 'adaptive-source-2').score;
      expect(Math.abs(score1Initial - score2Initial)).toBeLessThan(0.1);

      // Simulate source 1 degrading over time
      for (let i = 0; i < 10; i++) {
        await healthMonitor.updateHealthMetrics('adaptive-source-1', {
          responseTime: 200 + i * 100, // Getting slower
          successRate: 0.95 - i * 0.02, // Getting less reliable
          availability: 0.95 - i * 0.01,
          errorRate: 0.05 + i * 0.02
        });

        // Source 2 remains stable
        await healthMonitor.updateHealthMetrics('adaptive-source-2', {
          responseTime: 180,
          successRate: 0.97,
          availability: 0.98,
          errorRate: 0.03
        });
      }

      // Get updated prioritization after degradation
      const updatedPriorities = await sourcePrioritizer.calculatePriorities(
        adaptiveSources.map(s => s.id),
        { reliability: 0.5, responseTime: 0.5 }
      );

      // Source 2 should now be ranked higher
      const score1Updated = updatedPriorities.rankings.find(r => r.sourceId === 'adaptive-source-1').score;
      const score2Updated = updatedPriorities.rankings.find(r => r.sourceId === 'adaptive-source-2').score;
      
      expect(score2Updated).toBeGreaterThan(score1Updated);
      expect(updatedPriorities.rankings[0].sourceId).toBe('adaptive-source-2');

      // Verify learning and adaptation occurred
      const adaptationReport = await sourcePrioritizer.getAdaptationReport(adaptiveSources.map(s => s.id));
      expect(adaptationReport.adaptationsDetected).toBeGreaterThan(0);
      expect(adaptationReport.performanceChanges).toBeDefined();
      expect(adaptationReport.performanceChanges['adaptive-source-1'].trend).toBe('degrading');
      expect(adaptationReport.performanceChanges['adaptive-source-2'].trend).toBe('stable');
    });
  });

  describe('End-to-End Integration Testing', () => {
    
    test('should handle complete data source lifecycle', async () => {
      const lifecycleSource = {
        id: 'lifecycle-test-source',
        name: 'Complete Lifecycle Test Source',
        type: 'rest_api',
        endpoint: 'https://api.lifecycle.com',
        authentication: {
          type: 'api_key',
          keyField: 'API_KEY'
        },
        rateLimit: {
          requestsPerSecond: 5,
          burstLimit: 20
        },
        expectedLifecyclePhases: [
          'registration',
          'validation',
          'activation',
          'monitoring',
          'optimization',
          'maintenance',
          'decommissioning'
        ]
      };

      const lifecycleEvents = [];

      // Phase 1: Registration
      const registrationResult = await sourceRegistry.registerDataSource(lifecycleSource);
      expect(registrationResult.success).toBe(true);
      lifecycleEvents.push('registration');

      // Phase 2: Validation
      const validationResult = await sourceRegistry.validateDataSource(lifecycleSource.id);
      expect(validationResult.valid).toBe(true);
      lifecycleEvents.push('validation');

      // Phase 3: Activation
      const activationResult = await dataSourceManager.activateSource(lifecycleSource.id);
      expect(activationResult.success).toBe(true);
      lifecycleEvents.push('activation');

      // Phase 4: Monitoring (simulate monitoring period)
      await healthMonitor.startMonitoring(lifecycleSource.id);
      
      // Simulate some performance data
      for (let i = 0; i < 5; i++) {
        await healthMonitor.updateHealthMetrics(lifecycleSource.id, {
          responseTime: 150 + Math.random() * 100,
          successRate: 0.95 + Math.random() * 0.04,
          availability: 0.97 + Math.random() * 0.02,
          errorRate: Math.random() * 0.03
        });
      }
      lifecycleEvents.push('monitoring');

      // Phase 5: Optimization
      const optimizationResult = await sourcePrioritizer.optimizeSource(lifecycleSource.id);
      expect(optimizationResult.improvements).toBeDefined();
      lifecycleEvents.push('optimization');

      // Phase 6: Maintenance
      const maintenanceResult = await dataSourceManager.performMaintenance(lifecycleSource.id, {
        tasks: ['config_update', 'cache_clear', 'health_reset']
      });
      expect(maintenanceResult.success).toBe(true);
      lifecycleEvents.push('maintenance');

      // Phase 7: Decommissioning
      const decommissionResult = await dataSourceManager.decommissionSource(lifecycleSource.id, {
        reason: 'test_completion',
        gracefulShutdown: true,
        dataRetention: false
      });
      expect(decommissionResult.success).toBe(true);
      lifecycleEvents.push('decommissioning');

      // Verify all lifecycle phases were completed
      expect(lifecycleEvents).toEqual(lifecycleSource.expectedLifecyclePhases);

      // Verify source is no longer active
      const finalStatus = await dataSourceManager.getSourceStatus(lifecycleSource.id);
      expect(finalStatus.status).toBe('decommissioned');
    });

    test('should coordinate multiple components effectively', async () => {
      const coordinationTest = {
        sources: [
          {
            id: 'coord-primary',
            name: 'Coordination Primary',
            type: 'rest_api',
            endpoint: 'https://api.coord-primary.com',
            priority: 1
          },
          {
            id: 'coord-backup',
            name: 'Coordination Backup',
            type: 'rest_api',
            endpoint: 'https://api.coord-backup.com', 
            priority: 2
          }
        ],
        simulatedEvents: [
          'primary_degradation',
          'automatic_failover', 
          'load_rebalancing',
          'primary_recovery',
          'failback'
        ]
      };

      // Register coordination test sources
      for (const source of coordinationTest.sources) {
        await sourceRegistry.registerDataSource(source);
        await dataSourceManager.activateSource(source.id);
        await healthMonitor.startMonitoring(source.id);
      }

      // Create failover group
      await failoverController.createFailoverGroup({
        id: 'coordination-group',
        primarySource: 'coord-primary',
        backupSources: ['coord-backup'],
        failoverStrategy: 'priority_based',
        automaticFailover: true
      });

      const eventResults = [];

      // Event 1: Primary degradation
      await healthMonitor.updateHealthMetrics('coord-primary', {
        responseTime: 3000, // Degraded performance
        successRate: 0.85,
        availability: 0.88,
        errorRate: 0.15
      });

      const healthStatus = await healthMonitor.getSourceHealth('coord-primary');
      expect(healthStatus.overallStatus).toBe('degraded');
      eventResults.push('primary_degradation');

      // Event 2: Automatic failover
      const failoverResult = await failoverController.executeFailover('coordination-group');
      expect(failoverResult.success).toBe(true);
      expect(failoverResult.newActiveSource).toBe('coord-backup');
      eventResults.push('automatic_failover');

      // Event 3: Load rebalancing
      const rebalancingResult = await sourcePrioritizer.rebalanceLoad(['coord-backup']);
      expect(rebalancingResult.success).toBe(true);
      eventResults.push('load_rebalancing');

      // Event 4: Primary recovery
      await healthMonitor.updateHealthMetrics('coord-primary', {
        responseTime: 150,
        successRate: 0.98,
        availability: 0.99,
        errorRate: 0.02
      });

      const recoveryStatus = await healthMonitor.getSourceHealth('coord-primary');
      expect(recoveryStatus.overallStatus).toBe('healthy');
      eventResults.push('primary_recovery');

      // Event 5: Failback
      const failbackResult = await failoverController.executeFailback('coordination-group');
      expect(failbackResult.success).toBe(true);
      expect(failbackResult.newActiveSource).toBe('coord-primary');
      eventResults.push('failback');

      // Verify all events occurred in coordination
      expect(eventResults).toEqual(coordinationTest.simulatedEvents);

      // Verify system state is optimal
      const finalSystemState = await dataSourceManager.getSystemState();
      expect(finalSystemState.healthy).toBe(true);
      expect(finalSystemState.activeSourcesCount).toBeGreaterThan(0);
      expect(finalSystemState.failoverGroupsHealthy).toBe(true);
    });
  });
});

/**
 * External Data Source Management Validation Summary
 * 
 * This test suite validates:
 * ✅ Data source registry management with multiple source types
 * ✅ Configuration validation and error handling
 * ✅ Data source versioning and update capabilities
 * ✅ Health monitoring and performance tracking
 * ✅ Alert generation for degraded sources
 * ✅ Performance trend analysis over time
 * ✅ Automatic failover mechanisms with different strategies
 * ✅ Circuit breaker pattern implementation
 * ✅ Multi-factor source prioritization
 * ✅ Dynamic load balancing capabilities
 * ✅ Adaptive behavior based on changing conditions
 * ✅ Complete data source lifecycle management
 * ✅ Multi-component coordination and integration
 * 
 * Task 26.4 completion status: ✅ READY FOR VALIDATION
 */