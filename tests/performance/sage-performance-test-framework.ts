/**
 * Sage Satellite Performance Testing Framework
 * Comprehensive performance and load testing for all Sage components
 */

import * as os from 'os';
import * as process from 'process';
import { EventEmitter } from 'events';
import { performance } from 'perf_hooks';
import { Worker, isMainThread, parentPort, workerData } from 'worker_threads';

/**
 * Performance Test Configuration
 */
export interface PerformanceTestConfig {
  testName: string;
  description: string;
  duration: number; // milliseconds
  warmupDuration: number; // milliseconds
  concurrency: {
    min: number;
    max: number;
    step: number;
  };
  throughput: {
    targetRPS: number; // requests per second
    maxRPS: number;
    rampUpDuration: number; // milliseconds
  };
  latency: {
    p50Target: number; // milliseconds
    p95Target: number; // milliseconds
    p99Target: number; // milliseconds
  };
  resources: {
    maxCpuPercent: number;
    maxMemoryMB: number;
    maxNetworkBytesPerSec: number;
  };
  breakingPoint: {
    enabled: boolean;
    maxErrors: number;
    maxLatencyMs: number;
  };
}

/**
 * Performance Test Metrics
 */
export interface PerformanceMetrics {
  timestamp: Date;
  duration: number;
  requests: {
    total: number;
    successful: number;
    failed: number;
    rps: number;
  };
  latency: {
    min: number;
    max: number;
    mean: number;
    p50: number;
    p90: number;
    p95: number;
    p99: number;
    stdDev: number;
  };
  throughput: {
    bytesPerSecond: number;
    requestsPerSecond: number;
    peakRPS: number;
  };
  resources: {
    cpu: {
      percent: number;
      loadAverage: number[];
    };
    memory: {
      used: number;
      free: number;
      percent: number;
      heapUsed: number;
      heapTotal: number;
    };
    network: {
      bytesIn: number;
      bytesOut: number;
      connectionsActive: number;
    };
  };
  errors: {
    total: number;
    byType: Record<string, number>;
    errorRate: number;
  };
  concurrency: {
    active: number;
    queued: number;
    completed: number;
  };
}

/**
 * Performance Test Results
 */
export interface PerformanceTestResults {
  config: PerformanceTestConfig;
  startTime: Date;
  endTime: Date;
  duration: number;
  metrics: PerformanceMetrics[];
  summary: {
    passed: boolean;
    overallScore: number;
    slaViolations: string[];
    recommendations: string[];
    breakingPoint?: {
      concurrency: number;
      rps: number;
      errorRate: number;
    };
  };
  phases: {
    warmup: PerformanceMetrics;
    steady: PerformanceMetrics;
    peak: PerformanceMetrics;
    breakdown?: PerformanceMetrics;
  };
}

/**
 * Performance Test Scenarios
 */
export enum TestScenario {
  BASELINE = 'baseline',
  THROUGHPUT = 'throughput',
  LATENCY = 'latency',
  CONCURRENCY = 'concurrency',
  STRESS = 'stress',
  ENDURANCE = 'endurance',
  RECOVERY = 'recovery'
}

/**
 * Core Performance Testing Framework
 */
export class SagePerformanceTestFramework extends EventEmitter {
  private isRunning: boolean = false;
  private workers: Worker[] = [];
  private metrics: PerformanceMetrics[] = [];
  private resourceMonitor?: NodeJS.Timeout;
  private testStartTime: Date = new Date();

  constructor(private config: PerformanceTestConfig) {
    super();
  }

  /**
   * Run comprehensive performance test suite
   */
  async runPerformanceTestSuite(): Promise<PerformanceTestResults[]> {
    console.log('🚀 Starting Sage Satellite Performance Test Suite...\n');

    const results: PerformanceTestResults[] = [];

    try {
      // Run all test scenarios
      for (const scenario of Object.values(TestScenario)) {
        console.log(`📊 Running ${scenario} performance tests...`);
        
        const scenarioConfig = this.createScenarioConfig(scenario);
        const result = await this.runPerformanceTest(scenarioConfig);
        results.push(result);
        
        // Wait between tests to allow system recovery
        await this.sleep(5000);
      }

      // Generate comprehensive report
      await this.generateComprehensiveReport(results);

      console.log('✅ Performance test suite completed successfully!\n');
      return results;

    } catch (error) {
      console.error('❌ Performance test suite failed:', error);
      throw error;
    }
  }

  /**
   * Run individual performance test
   */
  async runPerformanceTest(config: PerformanceTestConfig): Promise<PerformanceTestResults> {
    this.config = config;
    this.isRunning = true;
    this.testStartTime = new Date();
    this.metrics = [];

    console.log(`\n🎯 Starting ${config.testName} (${config.description})`);
    console.log(`Duration: ${config.duration / 1000}s, Concurrency: ${config.concurrency.min}-${config.concurrency.max}`);

    try {
      // Start resource monitoring
      this.startResourceMonitoring();

      // Warm-up phase
      console.log('🔥 Warming up system...');
      const warmupMetrics = await this.runWarmupPhase(config);

      // Steady state phase
      console.log('📈 Running steady state test...');
      const steadyMetrics = await this.runSteadyStatePhase(config);

      // Peak load phase
      console.log('⚡ Running peak load test...');
      const peakMetrics = await this.runPeakLoadPhase(config);

      // Breaking point phase (if enabled)
      let breakdownMetrics: PerformanceMetrics | undefined;
      if (config.breakingPoint.enabled) {
        console.log('💥 Testing breaking point...');
        breakdownMetrics = await this.runBreakingPointPhase(config);
      }

      // Stop monitoring
      this.stopResourceMonitoring();

      // Analyze results
      const results = this.analyzeResults(config, {
        warmup: warmupMetrics,
        steady: steadyMetrics,
        peak: peakMetrics,
        breakdown: breakdownMetrics
      });

      this.displayResults(results);
      return results;

    } catch (error) {
      console.error(`❌ Performance test failed:`, error);
      throw error;
    } finally {
      this.isRunning = false;
      this.stopResourceMonitoring();
      await this.cleanup();
    }
  }

  /**
   * Create scenario-specific configuration
   */
  private createScenarioConfig(scenario: TestScenario): PerformanceTestConfig {
    const baseConfig: PerformanceTestConfig = {
      testName: `Sage ${scenario.toUpperCase()} Test`,
      description: this.getScenarioDescription(scenario),
      duration: 60000, // 1 minute
      warmupDuration: 10000, // 10 seconds
      concurrency: { min: 1, max: 10, step: 1 },
      throughput: { targetRPS: 10, maxRPS: 100, rampUpDuration: 30000 },
      latency: { p50Target: 100, p95Target: 500, p99Target: 1000 },
      resources: { maxCpuPercent: 80, maxMemoryMB: 512, maxNetworkBytesPerSec: 10485760 },
      breakingPoint: { enabled: false, maxErrors: 100, maxLatencyMs: 5000 }
    };

    // Customize based on scenario
    switch (scenario) {
      case TestScenario.BASELINE:
        return {
          ...baseConfig,
          duration: 30000,
          concurrency: { min: 1, max: 1, step: 1 },
          throughput: { targetRPS: 1, maxRPS: 5, rampUpDuration: 10000 }
        };

      case TestScenario.THROUGHPUT:
        return {
          ...baseConfig,
          duration: 120000, // 2 minutes
          throughput: { targetRPS: 50, maxRPS: 200, rampUpDuration: 60000 },
          concurrency: { min: 10, max: 50, step: 5 }
        };

      case TestScenario.LATENCY:
        return {
          ...baseConfig,
          latency: { p50Target: 50, p95Target: 200, p99Target: 500 },
          concurrency: { min: 1, max: 5, step: 1 },
          throughput: { targetRPS: 20, maxRPS: 50, rampUpDuration: 20000 }
        };

      case TestScenario.CONCURRENCY:
        return {
          ...baseConfig,
          duration: 90000, // 1.5 minutes
          concurrency: { min: 1, max: 100, step: 10 },
          throughput: { targetRPS: 100, maxRPS: 500, rampUpDuration: 45000 }
        };

      case TestScenario.STRESS:
        return {
          ...baseConfig,
          duration: 180000, // 3 minutes
          concurrency: { min: 50, max: 200, step: 25 },
          throughput: { targetRPS: 200, maxRPS: 1000, rampUpDuration: 90000 },
          resources: { maxCpuPercent: 95, maxMemoryMB: 1024, maxNetworkBytesPerSec: 52428800 },
          breakingPoint: { enabled: true, maxErrors: 500, maxLatencyMs: 10000 }
        };

      case TestScenario.ENDURANCE:
        return {
          ...baseConfig,
          duration: 600000, // 10 minutes
          concurrency: { min: 10, max: 20, step: 2 },
          throughput: { targetRPS: 25, maxRPS: 50, rampUpDuration: 60000 }
        };

      case TestScenario.RECOVERY:
        return {
          ...baseConfig,
          duration: 120000, // 2 minutes
          concurrency: { min: 1, max: 100, step: 20 },
          throughput: { targetRPS: 10, maxRPS: 200, rampUpDuration: 30000 },
          breakingPoint: { enabled: true, maxErrors: 50, maxLatencyMs: 5000 }
        };

      default:
        return baseConfig;
    }
  }

  /**
   * Get scenario description
   */
  private getScenarioDescription(scenario: TestScenario): string {
    const descriptions = {
      [TestScenario.BASELINE]: 'Single-user baseline performance measurement',
      [TestScenario.THROUGHPUT]: 'Maximum throughput capacity testing',
      [TestScenario.LATENCY]: 'Low-latency performance validation',
      [TestScenario.CONCURRENCY]: 'Multi-user concurrent access testing',
      [TestScenario.STRESS]: 'High-load stress testing to identify limits',
      [TestScenario.ENDURANCE]: 'Long-duration stability and memory leak testing',
      [TestScenario.RECOVERY]: 'System recovery after overload scenarios'
    };
    
    return descriptions[scenario];
  }

  /**
   * Run warmup phase
   */
  private async runWarmupPhase(config: PerformanceTestConfig): Promise<PerformanceMetrics> {
    const startTime = performance.now();
    const endTime = startTime + config.warmupDuration;
    const metrics: number[] = [];

    while (performance.now() < endTime) {
      const requestStart = performance.now();
      
      try {
        // Simulate lightweight requests
        await this.executeWarmupRequest();
        const latency = performance.now() - requestStart;
        metrics.push(latency);
      } catch (error) {
        // Track warmup errors but don't fail
      }

      await this.sleep(100); // Small delay between warmup requests
    }

    return this.calculateMetrics(metrics, performance.now() - startTime);
  }

  /**
   * Run steady state phase
   */
  private async runSteadyStatePhase(config: PerformanceTestConfig): Promise<PerformanceMetrics> {
    const startTime = performance.now();
    const duration = config.duration * 0.6; // 60% of total duration
    const targetConcurrency = Math.floor((config.concurrency.min + config.concurrency.max) / 2);
    
    return await this.runLoadPhase(duration, targetConcurrency, config.throughput.targetRPS);
  }

  /**
   * Run peak load phase
   */
  private async runPeakLoadPhase(config: PerformanceTestConfig): Promise<PerformanceMetrics> {
    const duration = config.duration * 0.3; // 30% of total duration
    const peakConcurrency = config.concurrency.max;
    
    return await this.runLoadPhase(duration, peakConcurrency, config.throughput.maxRPS);
  }

  /**
   * Run breaking point phase
   */
  private async runBreakingPointPhase(config: PerformanceTestConfig): Promise<PerformanceMetrics> {
    const duration = config.duration * 0.4; // 40% of total duration
    let concurrency = config.concurrency.max;
    let rps = config.throughput.maxRPS;
    
    // Gradually increase load until breaking point
    while (concurrency <= 500) { // Safety limit
      const metrics = await this.runLoadPhase(10000, concurrency, rps); // 10 second tests
      
      if (metrics.errors.errorRate > 0.1 || metrics.latency.p95 > config.breakingPoint.maxLatencyMs) {
        console.log(`💥 Breaking point found at concurrency: ${concurrency}, RPS: ${rps}`);
        break;
      }
      
      concurrency += 20;
      rps += 50;
    }
    
    return await this.runLoadPhase(duration, concurrency, rps);
  }

  /**
   * Run generic load phase
   */
  private async runLoadPhase(duration: number, concurrency: number, targetRPS: number): Promise<PerformanceMetrics> {
    const startTime = performance.now();
    const endTime = startTime + duration;
    const metrics: number[] = [];
    const errors: string[] = [];
    const activeRequests = new Set<Promise<void>>();

    console.log(`  ⚡ Running load phase: ${concurrency} concurrent, ${targetRPS} RPS target`);

    // Request interval calculation
    const requestInterval = Math.max(1, 1000 / targetRPS);
    let lastRequestTime = startTime;

    while (performance.now() < endTime && activeRequests.size < concurrency * 2) {
      // Maintain target RPS
      const now = performance.now();
      if (now - lastRequestTime >= requestInterval) {
        const requestPromise = this.executeTestRequest()
          .then(latency => {
            metrics.push(latency);
          })
          .catch(error => {
            errors.push(error.message || 'Unknown error');
          })
          .finally(() => {
            activeRequests.delete(requestPromise);
          });

        activeRequests.add(requestPromise);
        lastRequestTime = now;
      }

      // Control concurrency
      if (activeRequests.size >= concurrency) {
        await Promise.race(activeRequests);
      }

      await this.sleep(1); // Small yield
    }

    // Wait for remaining requests
    await Promise.allSettled(activeRequests);

    const totalDuration = performance.now() - startTime;
    const calculatedMetrics = this.calculateMetrics(metrics, totalDuration);
    
    // Add error information
    calculatedMetrics.errors = {
      total: errors.length,
      byType: this.categorizeErrors(errors),
      errorRate: errors.length / (metrics.length + errors.length)
    };

    return calculatedMetrics;
  }

  /**
   * Execute warmup request (lightweight)
   */
  private async executeWarmupRequest(): Promise<void> {
    // Simulate a simple health check or status request
    await this.sleep(Math.random() * 10 + 5); // 5-15ms simulated response
  }

  /**
   * Execute test request (realistic workload)
   */
  private async executeTestRequest(): Promise<number> {
    const startTime = performance.now();
    
    try {
      // Simulate different types of Sage operations
      const operationType = Math.random();
      
      if (operationType < 0.3) {
        // Protocol analysis (30% of requests)
        await this.simulateProtocolAnalysis();
      } else if (operationType < 0.6) {
        // RWA scoring (30% of requests)
        await this.simulateRWAScoring();
      } else if (operationType < 0.8) {
        // Compliance check (20% of requests)
        await this.simulateComplianceCheck();
      } else {
        // Market research (20% of requests)
        await this.simulateMarketResearch();
      }
      
      return performance.now() - startTime;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Simulate protocol analysis workload
   */
  private async simulateProtocolAnalysis(): Promise<void> {
    // Simulate ML model inference and data processing
    const processingTime = Math.random() * 200 + 50; // 50-250ms
    await this.sleep(processingTime);
    
    // Simulate potential failures
    if (Math.random() < 0.02) { // 2% failure rate
      throw new Error('Protocol analysis failed');
    }
  }

  /**
   * Simulate RWA scoring workload
   */
  private async simulateRWAScoring(): Promise<void> {
    // Simulate complex scoring calculations
    const processingTime = Math.random() * 150 + 30; // 30-180ms
    await this.sleep(processingTime);
    
    if (Math.random() < 0.01) { // 1% failure rate
      throw new Error('RWA scoring failed');
    }
  }

  /**
   * Simulate compliance check workload
   */
  private async simulateComplianceCheck(): Promise<void> {
    // Simulate regulatory database queries
    const processingTime = Math.random() * 100 + 20; // 20-120ms
    await this.sleep(processingTime);
    
    if (Math.random() < 0.015) { // 1.5% failure rate
      throw new Error('Compliance check failed');
    }
  }

  /**
   * Simulate market research workload (external API)
   */
  private async simulateMarketResearch(): Promise<void> {
    // Simulate external API call with higher latency and failure rate
    const processingTime = Math.random() * 800 + 200; // 200-1000ms
    await this.sleep(processingTime);
    
    if (Math.random() < 0.05) { // 5% failure rate (external API)
      throw new Error('Market research API failed');
    }
  }

  /**
   * Start resource monitoring
   */
  private startResourceMonitoring(): void {
    this.resourceMonitor = setInterval(() => {
      const memUsage = process.memoryUsage();
      const cpuUsage = process.cpuUsage();
      const loadAvg = os.loadavg();
      
      this.emit('resource_update', {
        timestamp: new Date(),
        cpu: {
          percent: this.calculateCpuPercent(cpuUsage),
          loadAverage: loadAvg
        },
        memory: {
          used: memUsage.rss,
          free: os.freemem(),
          percent: (memUsage.rss / os.totalmem()) * 100,
          heapUsed: memUsage.heapUsed,
          heapTotal: memUsage.heapTotal
        }
      });
    }, 1000); // Monitor every second
  }

  /**
   * Stop resource monitoring
   */
  private stopResourceMonitoring(): void {
    if (this.resourceMonitor) {
      clearInterval(this.resourceMonitor);
      this.resourceMonitor = undefined;
    }
  }

  /**
   * Calculate CPU percentage (simplified)
   */
  private calculateCpuPercent(cpuUsage: NodeJS.CpuUsage): number {
    // Simplified CPU calculation - in real implementation would track deltas
    return Math.min(100, (cpuUsage.user + cpuUsage.system) / 1000000 / os.cpus().length * 100);
  }

  /**
   * Calculate performance metrics from raw data
   */
  private calculateMetrics(latencies: number[], duration: number): PerformanceMetrics {
    latencies.sort((a, b) => a - b);
    
    const successful = latencies.length;
    const mean = latencies.reduce((a, b) => a + b, 0) / successful || 0;
    const variance = latencies.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / successful || 0;
    const stdDev = Math.sqrt(variance);

    return {
      timestamp: new Date(),
      duration,
      requests: {
        total: successful,
        successful,
        failed: 0, // Will be set by caller
        rps: successful / (duration / 1000)
      },
      latency: {
        min: latencies[0] || 0,
        max: latencies[latencies.length - 1] || 0,
        mean,
        p50: this.percentile(latencies, 0.5),
        p90: this.percentile(latencies, 0.9),
        p95: this.percentile(latencies, 0.95),
        p99: this.percentile(latencies, 0.99),
        stdDev
      },
      throughput: {
        bytesPerSecond: 0, // Placeholder
        requestsPerSecond: successful / (duration / 1000),
        peakRPS: successful / (duration / 1000)
      },
      resources: {
        cpu: { percent: 0, loadAverage: [0, 0, 0] },
        memory: { used: 0, free: 0, percent: 0, heapUsed: 0, heapTotal: 0 },
        network: { bytesIn: 0, bytesOut: 0, connectionsActive: 0 }
      },
      errors: {
        total: 0,
        byType: {},
        errorRate: 0
      },
      concurrency: {
        active: 0,
        queued: 0,
        completed: successful
      }
    };
  }

  /**
   * Calculate percentile from sorted array
   */
  private percentile(sortedArray: number[], p: number): number {
    if (sortedArray.length === 0) return 0;
    
    const index = Math.ceil(sortedArray.length * p) - 1;
    return sortedArray[Math.max(0, Math.min(index, sortedArray.length - 1))];
  }

  /**
   * Categorize errors by type
   */
  private categorizeErrors(errors: string[]): Record<string, number> {
    const categories: Record<string, number> = {};
    
    errors.forEach(error => {
      const category = this.categorizeError(error);
      categories[category] = (categories[category] || 0) + 1;
    });
    
    return categories;
  }

  /**
   * Categorize individual error
   */
  private categorizeError(error: string): string {
    if (error.includes('timeout')) return 'timeout';
    if (error.includes('network')) return 'network';
    if (error.includes('analysis')) return 'analysis';
    if (error.includes('scoring')) return 'scoring';
    if (error.includes('compliance')) return 'compliance';
    if (error.includes('research')) return 'research';
    return 'unknown';
  }

  /**
   * Analyze test results
   */
  private analyzeResults(
    config: PerformanceTestConfig,
    phases: {
      warmup: PerformanceMetrics;
      steady: PerformanceMetrics;
      peak: PerformanceMetrics;
      breakdown?: PerformanceMetrics;
    }
  ): PerformanceTestResults {
    const allMetrics = [phases.warmup, phases.steady, phases.peak];
    if (phases.breakdown) allMetrics.push(phases.breakdown);

    // Calculate overall score (0-100)
    let score = 100;
    const violations: string[] = [];
    
    // Check latency SLAs
    if (phases.steady.latency.p50 > config.latency.p50Target) {
      score -= 20;
      violations.push(`P50 latency ${phases.steady.latency.p50.toFixed(1)}ms exceeds target ${config.latency.p50Target}ms`);
    }
    
    if (phases.steady.latency.p95 > config.latency.p95Target) {
      score -= 25;
      violations.push(`P95 latency ${phases.steady.latency.p95.toFixed(1)}ms exceeds target ${config.latency.p95Target}ms`);
    }
    
    if (phases.steady.latency.p99 > config.latency.p99Target) {
      score -= 15;
      violations.push(`P99 latency ${phases.steady.latency.p99.toFixed(1)}ms exceeds target ${config.latency.p99Target}ms`);
    }

    // Check throughput SLAs
    if (phases.steady.requests.rps < config.throughput.targetRPS * 0.9) {
      score -= 20;
      violations.push(`Throughput ${phases.steady.requests.rps.toFixed(1)} RPS below target ${config.throughput.targetRPS} RPS`);
    }

    // Check error rates
    if (phases.steady.errors.errorRate > 0.01) { // 1% error rate threshold
      score -= 15;
      violations.push(`Error rate ${(phases.steady.errors.errorRate * 100).toFixed(2)}% exceeds 1% threshold`);
    }

    // Generate recommendations
    const recommendations = this.generateRecommendations(phases, config);

    return {
      config,
      startTime: this.testStartTime,
      endTime: new Date(),
      duration: Date.now() - this.testStartTime.getTime(),
      metrics: allMetrics,
      summary: {
        passed: violations.length === 0,
        overallScore: Math.max(0, score),
        slaViolations: violations,
        recommendations,
        ...(phases.breakdown && {
          breakingPoint: {
            concurrency: config.concurrency.max,
            rps: phases.breakdown.requests.rps,
            errorRate: phases.breakdown.errors.errorRate
          }
        })
      },
      phases
    };
  }

  /**
   * Generate performance recommendations
   */
  private generateRecommendations(
    phases: { warmup: PerformanceMetrics; steady: PerformanceMetrics; peak: PerformanceMetrics; breakdown?: PerformanceMetrics },
    config: PerformanceTestConfig
  ): string[] {
    const recommendations: string[] = [];

    // Latency recommendations
    if (phases.steady.latency.p95 > config.latency.p95Target) {
      recommendations.push('Consider implementing caching for frequently accessed data');
      recommendations.push('Optimize database queries and add appropriate indexes');
      recommendations.push('Review ML model inference performance');
    }

    // Throughput recommendations
    if (phases.steady.requests.rps < config.throughput.targetRPS) {
      recommendations.push('Increase connection pool sizes');
      recommendations.push('Consider horizontal scaling of components');
      recommendations.push('Implement request batching where possible');
    }

    // Memory recommendations
    if (phases.peak.resources.memory.percent > 80) {
      recommendations.push('Monitor for memory leaks in long-running processes');
      recommendations.push('Optimize object lifecycle management');
      recommendations.push('Consider increasing memory allocation');
    }

    // Error rate recommendations
    if (phases.steady.errors.errorRate > 0.005) { // 0.5%
      recommendations.push('Implement circuit breakers for external dependencies');
      recommendations.push('Add retry logic with exponential backoff');
      recommendations.push('Improve error handling and recovery mechanisms');
    }

    // Concurrency recommendations
    if (phases.peak.concurrency.active > config.concurrency.max * 0.8) {
      recommendations.push('Implement request queuing and throttling');
      recommendations.push('Consider async processing for heavy operations');
      recommendations.push('Optimize thread pool configurations');
    }

    return recommendations;
  }

  /**
   * Display test results
   */
  private displayResults(results: PerformanceTestResults): void {
    console.log('\n' + '='.repeat(80));
    console.log(`📊 ${results.config.testName.toUpperCase()} RESULTS`);
    console.log('='.repeat(80));

    console.log(`\n🎯 Overall Score: ${results.summary.overallScore}/100 ${results.summary.passed ? '✅' : '❌'}`);
    console.log(`Duration: ${(results.duration / 1000).toFixed(1)}s`);

    console.log('\n📈 Performance Metrics:');
    console.log(`  Steady State:`);
    console.log(`    RPS: ${results.phases.steady.requests.rps.toFixed(1)}`);
    console.log(`    P50 Latency: ${results.phases.steady.latency.p50.toFixed(1)}ms`);
    console.log(`    P95 Latency: ${results.phases.steady.latency.p95.toFixed(1)}ms`);
    console.log(`    P99 Latency: ${results.phases.steady.latency.p99.toFixed(1)}ms`);
    console.log(`    Error Rate: ${(results.phases.steady.errors.errorRate * 100).toFixed(2)}%`);

    console.log(`  Peak Load:`);
    console.log(`    RPS: ${results.phases.peak.requests.rps.toFixed(1)}`);
    console.log(`    P95 Latency: ${results.phases.peak.latency.p95.toFixed(1)}ms`);
    console.log(`    Error Rate: ${(results.phases.peak.errors.errorRate * 100).toFixed(2)}%`);

    if (results.summary.slaViolations.length > 0) {
      console.log('\n❌ SLA Violations:');
      results.summary.slaViolations.forEach(violation => {
        console.log(`  • ${violation}`);
      });
    }

    if (results.summary.recommendations.length > 0) {
      console.log('\n💡 Recommendations:');
      results.summary.recommendations.slice(0, 5).forEach(rec => {
        console.log(`  • ${rec}`);
      });
    }

    if (results.summary.breakingPoint) {
      console.log('\n💥 Breaking Point:');
      console.log(`  Concurrency: ${results.summary.breakingPoint.concurrency}`);
      console.log(`  RPS: ${results.summary.breakingPoint.rps.toFixed(1)}`);
      console.log(`  Error Rate: ${(results.summary.breakingPoint.errorRate * 100).toFixed(2)}%`);
    }

    console.log('='.repeat(80));
  }

  /**
   * Generate comprehensive report for all tests
   */
  private async generateComprehensiveReport(results: PerformanceTestResults[]): Promise<void> {
    console.log('\n📋 Generating comprehensive performance report...');
    
    // Create performance report directory
    const fs = await import('fs/promises');
    await fs.mkdir('performance-reports', { recursive: true });
    
    // Generate JSON report
    const report = {
      timestamp: new Date().toISOString(),
      testSuite: 'Sage Satellite Performance Test Suite',
      environment: {
        platform: os.platform(),
        arch: os.arch(),
        nodeVersion: process.version,
        cpus: os.cpus().length,
        totalMemory: os.totalmem(),
        freeMemory: os.freemem()
      },
      results,
      summary: this.generateSuiteSummary(results)
    };
    
    await fs.writeFile(
      'performance-reports/sage-performance-report.json',
      JSON.stringify(report, null, 2)
    );
    
    // Generate HTML report
    const htmlReport = this.generateHtmlReport(report);
    await fs.writeFile('performance-reports/sage-performance-report.html', htmlReport);
    
    console.log('📊 Performance reports saved to performance-reports/');
  }

  /**
   * Generate suite summary
   */
  private generateSuiteSummary(results: PerformanceTestResults[]) {
    const totalTests = results.length;
    const passedTests = results.filter(r => r.summary.passed).length;
    const overallScore = results.reduce((sum, r) => sum + r.summary.overallScore, 0) / totalTests;
    
    return {
      totalTests,
      passedTests,
      failedTests: totalTests - passedTests,
      overallScore: Math.round(overallScore),
      passRate: Math.round((passedTests / totalTests) * 100)
    };
  }

  /**
   * Generate HTML report
   */
  private generateHtmlReport(report: any): string {
    return `
<!DOCTYPE html>
<html>
<head>
    <title>Sage Satellite Performance Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .header { text-align: center; border-bottom: 2px solid #007acc; padding-bottom: 20px; margin-bottom: 30px; }
        .metric-card { background: #f8f9fa; border: 1px solid #dee2e6; border-radius: 4px; padding: 15px; margin: 10px 0; }
        .pass { color: #28a745; } .fail { color: #dc3545; } .warning { color: #ffc107; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
        .chart { height: 300px; background: #f8f9fa; border: 1px solid #dee2e6; margin: 20px 0; display: flex; align-items: center; justify-content: center; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚀 Sage Satellite Performance Report</h1>
            <p>Generated: ${report.timestamp}</p>
            <p>Overall Score: <strong class="${report.summary.overallScore >= 80 ? 'pass' : 'fail'}">${report.summary.overallScore}/100</strong></p>
        </div>

        <div class="metric-card">
            <h2>📊 Test Suite Summary</h2>
            <p>Total Tests: <strong>${report.summary.totalTests}</strong></p>
            <p>Passed: <strong class="pass">${report.summary.passedTests}</strong></p>
            <p>Failed: <strong class="fail">${report.summary.failedTests}</strong></p>
            <p>Pass Rate: <strong>${report.summary.passRate}%</strong></p>
        </div>

        <h2>🎯 Test Results</h2>
        <table>
            <tr>
                <th>Test Name</th>
                <th>Score</th>
                <th>Status</th>
                <th>Steady RPS</th>
                <th>P95 Latency</th>
                <th>Error Rate</th>
            </tr>
            ${report.results.map((result: any) => `
            <tr>
                <td>${result.config.testName}</td>
                <td class="${result.summary.overallScore >= 80 ? 'pass' : 'fail'}">${result.summary.overallScore}/100</td>
                <td class="${result.summary.passed ? 'pass' : 'fail'}">${result.summary.passed ? '✅ PASS' : '❌ FAIL'}</td>
                <td>${result.phases.steady.requests.rps.toFixed(1)}</td>
                <td>${result.phases.steady.latency.p95.toFixed(1)}ms</td>
                <td>${(result.phases.steady.errors.errorRate * 100).toFixed(2)}%</td>
            </tr>
            `).join('')}
        </table>

        <div class="metric-card">
            <h2>🖥️ Environment</h2>
            <p>Platform: ${report.environment.platform} (${report.environment.arch})</p>
            <p>Node.js: ${report.environment.nodeVersion}</p>
            <p>CPUs: ${report.environment.cpus}</p>
            <p>Memory: ${Math.round(report.environment.totalMemory / 1024 / 1024 / 1024)}GB</p>
        </div>
    </div>
</body>
</html>`;
  }

  /**
   * Cleanup resources
   */
  private async cleanup(): Promise<void> {
    // Stop all workers
    await Promise.all(this.workers.map(worker => {
      worker.terminate();
    }));
    this.workers = [];
  }

  /**
   * Utility sleep function
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Export for use
export { SagePerformanceTestFramework, TestScenario, PerformanceTestConfig, PerformanceTestResults };