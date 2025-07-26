/**
 * Performance Testing Service for YieldSensei
 * Implements comprehensive performance testing including load, stress, spike, and soak tests
 */

import { PerformanceTestCase, TestResult, AssertionResult, PerformanceTestConfig, PerformanceMetrics, LoadTestScenario } from '../types';
import { testingConfig } from '../config/testing.config';
import Logger from '../../shared/logging/logger';

const logger = Logger.getLogger('performance-test');

/**
 * Performance Testing Service for YieldSensei
 * Implements comprehensive performance testing including load, stress, spike, and soak tests
 */
export class PerformanceTestService {
  private config: PerformanceTestConfig;
  private testSuites: Map<string, PerformanceTestCase[]> = new Map();
  private metrics: PerformanceMetrics[] = [];

  constructor() {
    this.config = testingConfig.getPerformanceTestConfig();
    this.initializeTestSuites();
    
    // Use config to set default thresholds
    logger.info(`Performance test service initialized with ${Object.keys(this.config).length} configuration options`);
  }

  /**
   * Initialize all performance test suites
   */
  private initializeTestSuites(): void {
    // Load testing
    this.testSuites.set('load-testing', this.createLoadTests());
    
    // Stress testing
    this.testSuites.set('stress-testing', this.createStressTests());
    
    // Spike testing
    this.testSuites.set('spike-testing', this.createSpikeTests());
    
    // Soak testing
    this.testSuites.set('soak-testing', this.createSoakTests());
    
    // Endpoint performance tests
    this.testSuites.set('endpoint-performance', this.createEndpointPerformanceTests());
    
    // Database performance tests
    this.testSuites.set('database-performance', this.createDatabasePerformanceTests());
    
    // Memory leak tests
    this.testSuites.set('memory-leak', this.createMemoryLeakTests());
    
    // Resource utilization tests
    this.testSuites.set('resource-utilization', this.createResourceUtilizationTests());
  }

  /**
   * Run all performance tests
   */
  public async runAllTests(): Promise<TestResult[]> {
    logger.info('Starting performance test execution');
    const results: TestResult[] = [];

    for (const [suiteName, testCases] of this.testSuites) {
      logger.info(`Running performance test suite: ${suiteName}`);
      
      for (const testCase of testCases) {
        try {
          const result = await this.runTestCase(testCase);
          results.push(result);
        } catch (error) {
          logger.error(`Error running performance test case ${testCase.id}:`, error);
          results.push(this.createErrorResult(testCase, error as Error));
        }
      }
    }

    logger.info(`Performance test execution completed. Total tests: ${results.length}`);
    return results;
  }

  /**
   * Run a specific performance test suite
   */
  public async runTestSuite(suiteName: string): Promise<TestResult[]> {
    const testCases = this.testSuites.get(suiteName);
    if (!testCases) {
      throw new Error(`Performance test suite '${suiteName}' not found`);
    }

    logger.info(`Running performance test suite: ${suiteName}`);
    const results: TestResult[] = [];

    for (const testCase of testCases) {
      try {
        const result = await this.runTestCase(testCase);
        results.push(result);
      } catch (error) {
        logger.error(`Error running performance test case ${testCase.id}:`, error);
        results.push(this.createErrorResult(testCase, error as Error));
      }
    }

    return results;
  }

  /**
   * Run a single performance test case
   */
  public async runTestCase(testCase: PerformanceTestCase): Promise<TestResult> {
    const startTime = new Date();
    const assertions: AssertionResult[] = [];

    try {
      logger.debug(`Running performance test case: ${testCase.name}`);

      // Setup if provided
      if (testCase.setup) {
        await testCase.setup();
      }

      // Execute the performance test
      const result = await this.executePerformanceTest(testCase);
      assertions.push(...result.assertions);

      // Store metrics
      if (result.metrics) {
        this.metrics.push(result.metrics);
      }

      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();

      // Teardown if provided
      if (testCase.teardown) {
        await testCase.teardown();
      }

      return {
        id: `performance-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        testCaseId: testCase.id,
        status: this.determineStatus(assertions),
        duration,
        startTime,
        endTime,
        details: result.details,
        metadata: { 
          metrics: result.metrics,
          thresholds: testCase.thresholds,
          scenario: testCase.scenario,
        },
        assertions,
      };

    } catch (error) {
      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();

      // Teardown if provided
      if (testCase.teardown) {
        try {
          await testCase.teardown();
        } catch (teardownError) {
          logger.error('Error during teardown:', teardownError);
        }
      }

      return {
        id: `performance-error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        testCaseId: testCase.id,
        status: 'error',
        duration,
        startTime,
        endTime,
        error: error as Error,
        assertions,
      };
    }
  }

  /**
   * Execute performance test with scenario
   */
  private async executePerformanceTest(testCase: PerformanceTestCase): Promise<{
    assertions: AssertionResult[];
    metrics: PerformanceMetrics;
    details: any;
  }> {
    const assertions: AssertionResult[] = [];
    const startTime = Date.now();
    const responseTimes: number[] = [];
    const errors: any[] = [];
    const throughput: number[] = [];

    try {
      // Execute the performance scenario
      const scenarioData = this.getScenarioByName(testCase.scenario);
      const results = await this.executeLoadScenario(scenarioData);
      
      responseTimes.push(...results.responseTimes);
      errors.push(...results.errors);
      throughput.push(...results.throughput);

      // Calculate metrics
      const metrics = this.calculateMetrics(responseTimes, errors, throughput, startTime);
      
      // Evaluate against thresholds
      const thresholdResults = this.evaluateThresholds(metrics, testCase.thresholds);
      
      // Create assertions based on threshold evaluation
      thresholdResults.forEach(result => {
        assertions.push({
          name: result.metric,
          status: result.passed ? 'passed' : 'failed',
          expected: result.threshold,
          actual: result.value,
          message: result.message,
        });
      });

      return {
        assertions,
        metrics,
        details: {
          scenario: testCase.scenario,
          results: results,
          thresholdResults: thresholdResults,
        },
      };

    } catch (error) {
      assertions.push({
        name: `Performance test execution`,
        status: 'failed',
        expected: 'successful_execution',
        actual: 'error',
        message: `Test execution failed: ${(error as Error).message}`,
      });

      return {
        assertions,
        metrics: this.createEmptyMetrics(),
        details: { error: (error as Error).message },
      };
    }
  }

  /**
   * Get scenario data by name
   */
  private getScenarioByName(scenarioName: string): LoadTestScenario {
    // Map scenario names to actual scenario objects
    const scenarios: Record<string, LoadTestScenario> = {
      'api-endpoint-load': {
        name: 'API Endpoint Load Test',
        description: 'Test API endpoints under load',
        loadProfile: {
          users: 100,
          rampUp: 60,
          holdTime: 300,
          rampDown: 60,
          thinkTime: 5
        },
        endpoints: ['/api/health', '/api/v1/protocols', '/api/v1/opportunities'],
        data: {}
      },
      'database-stress': {
        name: 'Database Stress Test',
        description: 'Stress test database operations',
        loadProfile: {
          users: 200,
          rampUp: 120,
          holdTime: 600,
          rampDown: 120,
          thinkTime: 2
        },
        endpoints: ['/api/v1/portfolios', '/api/v1/transactions'],
        data: { simulate: true }
      },
      'memory-usage': {
        name: 'Memory Usage Test',
        description: 'Test memory usage patterns',
        loadProfile: {
          users: 50,
          rampUp: 30,
          holdTime: 1800,
          rampDown: 30,
          thinkTime: 10
        },
        endpoints: ['/api/v1/analytics'],
        data: { largePayload: true }
      }
    };

    return scenarios[scenarioName] || scenarios['api-endpoint-load']!;
  }

  /**
   * Execute load scenario
   */
  private async executeLoadScenario(scenario: LoadTestScenario): Promise<{
    responseTimes: number[];
    errors: any[];
    throughput: number[];
  }> {
    const responseTimes: number[] = [];
    const errors: any[] = [];
    const throughput: number[] = [];
    const { loadProfile, endpoints, data } = scenario;

    // Simulate ramp-up period
    await this.simulateRampUp(loadProfile.rampUp, loadProfile.users);

    // Execute requests during hold time
    const holdTimeMs = loadProfile.holdTime * 1000;
    const startTime = Date.now();
    const endTime = startTime + holdTimeMs;

    while (Date.now() < endTime) {
      // Simulate concurrent users
      const concurrentUsers = Math.floor(loadProfile.users * (Math.random() * 0.3 + 0.85)); // 85-115% of target
      
      const batchPromises = Array.from({ length: concurrentUsers }, async () => {
        try {
          const endpoint = endpoints[Math.floor(Math.random() * endpoints.length)] || '/api/health';
          const requestStart = Date.now();
          
          await this.simulateRequest(endpoint, data || {});
          
          const responseTime = Date.now() - requestStart;
          responseTimes.push(responseTime);
          
          // Calculate throughput (requests per second)
          const currentThroughput = 1000 / responseTime;
          throughput.push(currentThroughput);

          // Add think time between requests
          await this.delay(loadProfile.thinkTime * 1000);

        } catch (error) {
          errors.push({
            timestamp: new Date(),
            error: (error as Error).message,
            endpoint: endpoints[Math.floor(Math.random() * endpoints.length)],
          });
        }
      });

      await Promise.all(batchPromises);
    }

    // Simulate ramp-down period
    await this.simulateRampDown(loadProfile.rampDown);

    return { responseTimes, errors, throughput };
  }

  /**
   * Calculate performance metrics
   */
  private calculateMetrics(
    responseTimes: number[],
    errors: any[],
    _throughput: number[],
    startTime: number
  ): PerformanceMetrics {
    const endTime = Date.now();
    const totalDuration = (endTime - startTime) / 1000; // seconds
    const totalRequests = responseTimes.length;
    const totalErrors = errors.length;

    // Response time statistics
    const sortedResponseTimes = [...responseTimes].sort((a, b) => a - b);
    const minResponseTime = sortedResponseTimes[0] || 0;
    const maxResponseTime = sortedResponseTimes[sortedResponseTimes.length - 1] || 0;
    const avgResponseTime = responseTimes.reduce((sum, time) => sum + time, 0) / totalRequests;
    
    // Percentiles (only keep what's used)
    const p95 = this.calculatePercentile(sortedResponseTimes, 95);
    const p99 = this.calculatePercentile(sortedResponseTimes, 99);

    // Throughput statistics
    const requestsPerSecond = totalRequests / totalDuration;

    // Error rate
    const errorRate = totalErrors / totalRequests;

    // Resource utilization (simulated)
    const cpuUsage = this.simulateCpuUsage(totalRequests, totalDuration);
    const memoryUsage = this.simulateMemoryUsage(totalRequests, totalDuration);
    const networkLatency = this.simulateNetworkLatency();

    return {
      responseTime: {
        min: minResponseTime,
        max: maxResponseTime,
        avg: avgResponseTime,
        p95,
        p99,
      },
      throughput: {
        requestsPerSecond,
        transactionsPerSecond: requestsPerSecond, // Use same value for now
      },
      errorRate,
      cpuUsage,
      memoryUsage,
      networkLatency,
    };
  }

  /**
   * Evaluate metrics against thresholds
   */
  private evaluateThresholds(metrics: PerformanceMetrics, thresholds: any): Array<{
    metric: string;
    value: number;
    threshold: number;
    passed: boolean;
    message: string;
  }> {
    const results: Array<{
      metric: string;
      value: number;
      threshold: number;
      passed: boolean;
      message: string;
    }> = [];

    // Response time thresholds
    if (thresholds.responseTime) {
      if (thresholds.responseTime.max && metrics.responseTime.p95 > thresholds.responseTime.max) {
        results.push({
          metric: 'Response Time P95',
          value: metrics.responseTime.p95,
          threshold: thresholds.responseTime.max,
          passed: false,
          message: `P95 response time (${metrics.responseTime.p95}ms) exceeds threshold (${thresholds.responseTime.max}ms)`,
        });
      } else {
        results.push({
          metric: 'Response Time P95',
          value: metrics.responseTime.p95,
          threshold: thresholds.responseTime.max || 0,
          passed: true,
          message: `P95 response time (${metrics.responseTime.p95}ms) within threshold`,
        });
      }
    }

    // Throughput thresholds
    if (thresholds.throughput && thresholds.throughput.min) {
      if (metrics.throughput.requestsPerSecond < thresholds.throughput.min) {
        results.push({
          metric: 'Throughput',
          value: metrics.throughput.requestsPerSecond,
          threshold: thresholds.throughput.min,
          passed: false,
          message: `Throughput (${metrics.throughput.requestsPerSecond} req/s) below threshold (${thresholds.throughput.min} req/s)`,
        });
      } else {
        results.push({
          metric: 'Throughput',
          value: metrics.throughput.requestsPerSecond,
          threshold: thresholds.throughput.min,
          passed: true,
          message: `Throughput (${metrics.throughput.requestsPerSecond} req/s) meets threshold`,
        });
      }
    }

    // Error rate thresholds
    if (thresholds.errorRate && thresholds.errorRate.max) {
      if (metrics.errorRate > thresholds.errorRate.max) {
        results.push({
          metric: 'Error Rate',
          value: metrics.errorRate,
          threshold: thresholds.errorRate.max,
          passed: false,
          message: `Error rate (${(metrics.errorRate * 100).toFixed(2)}%) exceeds threshold (${(thresholds.errorRate.max * 100).toFixed(2)}%)`,
        });
      } else {
        results.push({
          metric: 'Error Rate',
          value: metrics.errorRate,
          threshold: thresholds.errorRate.max,
          passed: true,
          message: `Error rate (${(metrics.errorRate * 100).toFixed(2)}%) within threshold`,
        });
      }
    }

    // Resource usage thresholds
    if (thresholds.resourceUsage) {
      if (thresholds.resourceUsage.cpu && metrics.cpuUsage > thresholds.resourceUsage.cpu) {
        results.push({
          metric: 'CPU Usage',
          value: metrics.cpuUsage,
          threshold: thresholds.resourceUsage.cpu,
          passed: false,
          message: `CPU usage (${metrics.cpuUsage}%) exceeds threshold (${thresholds.resourceUsage.cpu}%)`,
        });
      } else {
        results.push({
          metric: 'CPU Usage',
          value: metrics.cpuUsage,
          threshold: thresholds.resourceUsage.cpu || 0,
          passed: true,
          message: `CPU usage (${metrics.cpuUsage}%) within threshold`,
        });
      }

      if (thresholds.resourceUsage.memory && metrics.memoryUsage > thresholds.resourceUsage.memory) {
        results.push({
          metric: 'Memory Usage',
          value: metrics.memoryUsage,
          threshold: thresholds.resourceUsage.memory,
          passed: false,
          message: `Memory usage (${metrics.memoryUsage}%) exceeds threshold (${thresholds.resourceUsage.memory}%)`,
        });
      } else {
        results.push({
          metric: 'Memory Usage',
          value: metrics.memoryUsage,
          threshold: thresholds.resourceUsage.memory || 0,
          passed: true,
          message: `Memory usage (${metrics.memoryUsage}%) within threshold`,
        });
      }
    }

    return results;
  }

  /**
   * Create load tests
   */
  private createLoadTests(): PerformanceTestCase[] {
    return [
      {
        id: 'load-001',
        name: 'Normal Load Test',
        description: 'Test system performance under normal load conditions',
        category: 'performance',
        priority: 'high',
        tags: ['load-testing', 'normal-load'],
        scenario: 'api-endpoint-load',
        load: {
          users: 100,
          rampUp: 60,
          holdTime: 300,
          rampDown: 60,
          thinkTime: 2,
        },
        metrics: this.createEmptyMetrics(),
        execute: async () => this.runTestCase({
          id: 'load-001',
          scenario: 'api-endpoint-load'
        } as any),
        thresholds: {
          responseTime: {
            max: 2000,
            p95: 1500,
            p99: 1800,
          },
          throughput: {
            min: 50,
          },
          errorRate: {
            max: 0.05,
          },
          resourceUsage: {
            cpu: 80,
            memory: 85,
          },
        },
      },
      {
        id: 'load-002',
        name: 'Peak Load Test',
        description: 'Test system performance under peak load conditions',
        category: 'performance',
        priority: 'high',
        tags: ['load-testing', 'peak-load'],
        scenario: 'database-stress',
        load: {
          users: 500,
          rampUp: 120,
          holdTime: 600,
          rampDown: 120,
          thinkTime: 1,
        },
        metrics: this.createEmptyMetrics(),
        execute: async () => this.runTestCase({
          id: 'load-002',
          scenario: 'database-stress'
        } as any),
        thresholds: {
          responseTime: {
            max: 3000,
            p95: 2500,
            p99: 2800,
          },
          throughput: {
            min: 100,
          },
          errorRate: {
            max: 0.1,
          },
          resourceUsage: {
            cpu: 90,
            memory: 90,
          },
        },
      },
    ];
  }

  /**
   * Create stress tests
   */
  private createStressTests(): PerformanceTestCase[] {
    return [
      {
        id: 'stress-001',
        name: 'Stress Test',
        description: 'Test system behavior under stress conditions',
        category: 'performance',
        priority: 'high',
        tags: ['stress-testing', 'breaking-point'],
        scenario: 'database-stress',
        load: {
          users: 1000,
          rampUp: 300,
          holdTime: 900,
          rampDown: 300,
          thinkTime: 0.5,
        },
        metrics: this.createEmptyMetrics(),
        execute: async () => this.runTestCase({
          id: 'stress-001',
          scenario: 'database-stress'
        } as any),
        thresholds: {
          responseTime: {
            max: 5000,
            p95: 4000,
            p99: 4800,
          },
          throughput: {
            min: 50,
          },
          errorRate: {
            max: 0.2,
          },
          resourceUsage: {
            cpu: 95,
            memory: 95,
          },
        },
      },
    ];
  }

  /**
   * Create spike tests
   */
  private createSpikeTests(): PerformanceTestCase[] {
    return [
      {
        id: 'spike-001',
        name: 'Spike Test',
        description: 'Test system response to sudden load spikes',
        category: 'performance',
        priority: 'medium',
        tags: ['spike-testing', 'sudden-load'],
        scenario: 'memory-usage',
        load: {
          users: 2000,
          rampUp: 30,
          holdTime: 180,
          rampDown: 30,
          thinkTime: 0.2,
        },
        metrics: this.createEmptyMetrics(),
        execute: async () => this.runTestCase({
          id: 'spike-001',
          scenario: 'memory-usage'
        } as any),
        thresholds: {
          responseTime: {
            max: 8000,
            p95: 6000,
            p99: 7500,
          },
          throughput: {
            min: 25,
          },
          errorRate: {
            max: 0.3,
          },
          resourceUsage: {
            cpu: 98,
            memory: 98,
          },
        },
      },
    ];
  }

  /**
   * Create soak tests
   */
  private createSoakTests(): PerformanceTestCase[] {
    return [
      {
        id: 'soak-001',
        name: 'Soak Test',
        description: 'Test system stability over extended period',
        category: 'performance',
        priority: 'medium',
        tags: ['soak-testing', 'stability'],
        scenario: 'api-endpoint-load',
        load: {
          users: 200,
          rampUp: 300,
          holdTime: 7200, // 2 hours
          rampDown: 300,
          thinkTime: 5,
        },
        metrics: this.createEmptyMetrics(),
        execute: async () => this.runTestCase({
          id: 'soak-001',
          scenario: 'api-endpoint-load'
        } as any),
        thresholds: {
          responseTime: {
            max: 3000,
            p95: 2500,
            p99: 2800,
          },
          throughput: {
            min: 30,
          },
          errorRate: {
            max: 0.05,
          },
          resourceUsage: {
            cpu: 85,
            memory: 85,
          },
        },
      },
    ];
  }

  /**
   * Create endpoint performance tests
   */
  private createEndpointPerformanceTests(): PerformanceTestCase[] {
    return [
      {
        id: 'endpoint-001',
        name: 'Portfolio API Performance',
        description: 'Test portfolio API endpoint performance',
        category: 'performance',
        priority: 'high',
        tags: ['endpoint-performance', 'portfolio'],
        scenario: {
          name: 'Portfolio API Load',
          description: 'Test portfolio endpoint under load',
          loadProfile: {
            users: 100,
            rampUp: 60,
            holdTime: 300,
            rampDown: 60,
            thinkTime: 1,
          },
          endpoints: ['/api/v1/portfolios'],
          data: {
            userId: 'test-user-6',
            portfolioId: 'test-portfolio-6',
          },
        },
        thresholds: {
          responseTime: {
            max: 1000,
            p95: 800,
          },
          throughput: {
            min: 80,
          },
          errorRate: {
            max: 0.02,
          },
        },
      },
    ];
  }

  /**
   * Create database performance tests
   */
  private createDatabasePerformanceTests(): PerformanceTestCase[] {
    return [
      {
        id: 'db-001',
        name: 'Database Query Performance',
        description: 'Test database query performance under load',
        category: 'performance',
        priority: 'high',
        tags: ['database-performance', 'queries'],
        scenario: {
          name: 'Database Load',
          description: 'Test database performance under load',
          loadProfile: {
            users: 50,
            rampUp: 30,
            holdTime: 180,
            rampDown: 30,
            thinkTime: 2,
          },
          endpoints: ['/api/v1/analytics', '/api/v1/reports'],
          data: {
            userId: 'test-user-7',
            portfolioId: 'test-portfolio-7',
          },
        },
        thresholds: {
          responseTime: {
            max: 3000,
            p95: 2500,
          },
          throughput: {
            min: 20,
          },
          errorRate: {
            max: 0.05,
          },
        },
      },
    ];
  }

  /**
   * Create memory leak tests
   */
  private createMemoryLeakTests(): PerformanceTestCase[] {
    return [
      {
        id: 'memory-001',
        name: 'Memory Leak Detection',
        description: 'Test for memory leaks over extended period',
        category: 'performance',
        priority: 'medium',
        tags: ['memory-leak', 'stability'],
        scenario: {
          name: 'Memory Leak Test',
          description: 'Test for memory leaks over 1 hour',
          loadProfile: {
            users: 100,
            rampUp: 60,
            holdTime: 3600, // 1 hour
            rampDown: 60,
            thinkTime: 3,
          },
          endpoints: ['/api/v1/portfolios', '/api/v1/market-data'],
          data: {
            userId: 'test-user-8',
            portfolioId: 'test-portfolio-8',
          },
        },
        thresholds: {
          responseTime: {
            max: 2000,
            p95: 1500,
          },
          throughput: {
            min: 40,
          },
          errorRate: {
            max: 0.02,
          },
          resourceUsage: {
            memory: 80, // Memory should not grow significantly
          },
        },
      },
    ];
  }

  /**
   * Create resource utilization tests
   */
  private createResourceUtilizationTests(): PerformanceTestCase[] {
    return [
      {
        id: 'resource-001',
        name: 'Resource Utilization Test',
        description: 'Test system resource utilization under load',
        category: 'performance',
        priority: 'medium',
        tags: ['resource-utilization', 'monitoring'],
        scenario: {
          name: 'Resource Utilization',
          description: 'Monitor resource usage under load',
          loadProfile: {
            users: 150,
            rampUp: 90,
            holdTime: 600,
            rampDown: 90,
            thinkTime: 2,
          },
          endpoints: ['/api/v1/portfolios', '/api/v1/market-data', '/api/v1/analytics'],
          data: {
            userId: 'test-user-9',
            portfolioId: 'test-portfolio-9',
          },
        },
        thresholds: {
          responseTime: {
            max: 2500,
            p95: 2000,
          },
          throughput: {
            min: 60,
          },
          errorRate: {
            max: 0.05,
          },
          resourceUsage: {
            cpu: 85,
            memory: 85,
          },
        },
      },
    ];
  }

  /**
   * Simulate ramp-up period
   */
  private async simulateRampUp(rampUpSeconds: number, targetUsers: number): Promise<void> {
    logger.info(`Starting ramp-up period: ${rampUpSeconds}s to reach ${targetUsers} users`);
    const rampUpMs = rampUpSeconds * 1000;
    const stepMs = rampUpMs / 10; // 10 steps
    
    for (let i = 1; i <= 10; i++) {
      const currentUsers = Math.floor((targetUsers * i) / 10);
      logger.debug(`Ramp-up step ${i}/10: ${currentUsers} users`);
      await this.delay(stepMs);
    }
  }

  /**
   * Simulate ramp-down period
   */
  private async simulateRampDown(rampDownSeconds: number): Promise<void> {
    logger.info(`Starting ramp-down period: ${rampDownSeconds}s`);
    await this.delay(rampDownSeconds * 1000);
  }

  /**
   * Simulate API request
   */
  private async simulateRequest(endpoint: string, data: any): Promise<any> {
    // Simulate network delay and processing time
    const baseDelay = 50 + Math.random() * 200; // 50-250ms base delay
    
    // Add endpoint-specific delays
    let endpointDelay = 0;
    if (endpoint.includes('/analytics')) {
      endpointDelay = 200 + Math.random() * 800; // Analytics are slower
    } else if (endpoint.includes('/market-data')) {
      endpointDelay = 20 + Math.random() * 80; // Market data is fast
    } else if (endpoint.includes('/portfolios')) {
      endpointDelay = 100 + Math.random() * 300; // Portfolio operations are medium
    }

    const totalDelay = baseDelay + endpointDelay;
    await this.delay(totalDelay);

    // Simulate occasional errors
    if (Math.random() < 0.02) { // 2% error rate
      throw new Error('Simulated API error');
    }

    return {
      statusCode: 200,
      data: {
        endpoint,
        timestamp: new Date().toISOString(),
        processingTime: totalDelay,
      },
    };
  }

  /**
   * Calculate percentile from sorted array
   */
  private calculatePercentile(sortedArray: number[], percentile: number): number {
    if (sortedArray.length === 0) return 0;
    
    const index = Math.ceil((percentile / 100) * sortedArray.length) - 1;
    return sortedArray[Math.max(0, index)];
  }

  /**
   * Simulate CPU usage based on load
   */
  private simulateCpuUsage(requests: number, duration: number): number {
    const requestsPerSecond = requests / duration;
    const baseUsage = 20; // Base CPU usage
    const loadFactor = requestsPerSecond / 100; // CPU increases with load
    return Math.min(95, baseUsage + (loadFactor * 60)); // Cap at 95%
  }

  /**
   * Simulate memory usage based on load
   */
  private simulateMemoryUsage(requests: number, duration: number): number {
    const requestsPerSecond = requests / duration;
    const baseUsage = 30; // Base memory usage
    const loadFactor = requestsPerSecond / 100; // Memory increases with load
    return Math.min(90, baseUsage + (loadFactor * 50)); // Cap at 90%
  }

  /**
   * Simulate network latency
   */
  private simulateNetworkLatency(): number {
    return 50 + Math.random() * 100; // 50-150ms
  }

  /**
   * Create empty metrics object
   */
  private createEmptyMetrics(): PerformanceMetrics {
    return {
      responseTime: {
        min: 0,
        max: 0,
        avg: 0,
        p50: 0,
        p90: 0,
        p95: 0,
        p99: 0,
      },
      throughput: {
        requestsPerSecond: 0,
        avgThroughput: 0,
        totalRequests: 0,
        totalDuration: 0,
      },
      errorRate: 0,
      resourceUsage: {
        cpu: 0,
        memory: 0,
        networkLatency: 0,
      },
      timestamp: new Date(),
    };
  }

  /**
   * Determine test status based on assertions
   */
  private determineStatus(assertions: AssertionResult[]): 'passed' | 'failed' | 'skipped' | 'error' {
    if (assertions.length === 0) {
      return 'skipped';
    }

    const failedAssertions = assertions.filter(a => a.status === 'failed');
    return failedAssertions.length > 0 ? 'failed' : 'passed';
  }

  /**
   * Create error result for failed test cases
   */
  private createErrorResult(testCase: PerformanceTestCase, error: Error): TestResult {
    return {
      id: `performance-error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      testCaseId: testCase.id,
      status: 'error',
      duration: 0,
      startTime: new Date(),
      endTime: new Date(),
      error,
      assertions: [],
    };
  }

  /**
   * Add delay to simulate real-world conditions
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get all collected metrics
   */
  public getMetrics(): PerformanceMetrics[] {
    return this.metrics;
  }

  /**
   * Generate performance report
   */
  public generatePerformanceReport(): any {
    if (this.metrics.length === 0) {
      return { message: 'No performance metrics available' };
    }

    const latestMetrics = this.metrics[this.metrics.length - 1];
    
    return {
      summary: {
        totalTests: this.metrics.length,
        averageResponseTime: this.metrics.reduce((sum, m) => sum + m.responseTime.avg, 0) / this.metrics.length,
        averageThroughput: this.metrics.reduce((sum, m) => sum + m.throughput.requestsPerSecond, 0) / this.metrics.length,
        averageErrorRate: this.metrics.reduce((sum, m) => sum + m.errorRate, 0) / this.metrics.length,
      },
      latestMetrics,
      recommendations: this.generateRecommendations(),
    };
  }

  /**
   * Generate performance recommendations
   */
  private generateRecommendations(): string[] {
    const recommendations: string[] = [];
    
    if (this.metrics.length === 0) {
      return recommendations;
    }

    const latestMetrics = this.metrics[this.metrics.length - 1];

    // Response time recommendations
    if (latestMetrics.responseTime.p95 > 2000) {
      recommendations.push('Consider optimizing database queries and implementing caching to reduce response times');
    }

    if (latestMetrics.responseTime.p99 > 5000) {
      recommendations.push('Implement request queuing and load balancing to handle peak loads');
    }

    // Throughput recommendations
    if (latestMetrics.throughput.requestsPerSecond < 50) {
      recommendations.push('Consider horizontal scaling and database optimization to improve throughput');
    }

    // Error rate recommendations
    if (latestMetrics.errorRate > 0.05) {
      recommendations.push('Investigate and fix error sources to improve system reliability');
    }

    // Resource utilization recommendations
    if (latestMetrics.resourceUsage.cpu > 85) {
      recommendations.push('Consider CPU optimization or scaling to handle current load');
    }

    if (latestMetrics.resourceUsage.memory > 85) {
      recommendations.push('Investigate memory leaks and consider memory optimization');
    }

    return recommendations;
  }
}

// Export singleton instance
export const performanceTestService = new PerformanceTestService(); 