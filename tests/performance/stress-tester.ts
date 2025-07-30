import { EventEmitter } from 'events';
import { ConcurrencyTester, UserScenario, ConcurrencyTestConfig } from './concurrency-tester';
import { PerformanceMonitor } from './performance-monitor';
import { ResourceMonitor } from './resource-monitor';

export interface StressTestConfig {
  targetSystem: string;
  scenarios: UserScenario[];
  initialUsers: number;
  userIncrement: number;
  incrementInterval: number; // ms between increments
  maxUsers: number;
  maxDuration: number; // Total test duration
  performanceMonitor?: PerformanceMonitor;
  breakingPointCriteria: BreakingPointCriteria;
  cooldownPeriod: number; // Time to wait after breaking point
}

export interface BreakingPointCriteria {
  maxResponseTime: number; // ms
  maxErrorRate: number; // percentage
  minThroughput: number; // requests per second
  maxCpuUsage: number; // percentage
  maxMemoryUsage: number; // percentage
  consecutiveFailures: number; // Number of consecutive criteria failures
}

export interface StressTestResult {
  summary: StressTestSummary;
  breakingPoint: BreakingPointInfo | null;
  loadProgression: LoadProgressionPoint[];
  systemMetrics: SystemMetricsTimeline;
  recommendations: string[];
}

export interface StressTestSummary {
  startTime: number;
  endTime: number;
  duration: number;
  maxUsersReached: number;
  breakingPointFound: boolean;
  totalRequests: number;
  totalErrors: number;
  peakThroughput: number;
  peakResponseTime: number;
}

export interface BreakingPointInfo {
  timestamp: number;
  concurrentUsers: number;
  triggerCriteria: string[];
  metrics: {
    responseTime: number;
    errorRate: number;
    throughput: number;
    cpuUsage: number;
    memoryUsage: number;
  };
}

export interface LoadProgressionPoint {
  timestamp: number;
  users: number;
  throughput: number;
  avgResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  errorRate: number;
  cpuUsage: number;
  memoryUsage: number;
  healthy: boolean;
}

export interface SystemMetricsTimeline {
  timestamps: number[];
  cpu: number[];
  memory: number[];
  throughput: number[];
  responseTime: number[];
  errors: number[];
}

export class StressTester extends EventEmitter {
  private config: StressTestConfig;
  private concurrencyTester?: ConcurrencyTester;
  private currentUsers: number = 0;
  private isRunning: boolean = false;
  private breakingPointDetected: boolean = false;
  private loadProgression: LoadProgressionPoint[] = [];
  private systemMetrics: SystemMetricsTimeline;
  private consecutiveFailureCount: number = 0;
  private resourceMonitor: ResourceMonitor;
  private startTime?: number;
  private endTime?: number;

  constructor(config: StressTestConfig) {
    super();
    this.config = config;
    this.systemMetrics = {
      timestamps: [],
      cpu: [],
      memory: [],
      throughput: [],
      responseTime: [],
      errors: []
    };
    this.resourceMonitor = new ResourceMonitor({ interval: 1000 });
  }

  async run(): Promise<StressTestResult> {
    if (this.isRunning) {
      throw new Error('Stress test is already running');
    }

    this.isRunning = true;
    this.startTime = Date.now();
    this.currentUsers = this.config.initialUsers;
    this.breakingPointDetected = false;
    this.loadProgression = [];
    this.consecutiveFailureCount = 0;

    this.emit('test-started', { 
      startTime: this.startTime,
      targetSystem: this.config.targetSystem 
    });

    try {
      // Start resource monitoring
      this.resourceMonitor.start();
      
      // Run progressive load test
      await this.runProgressiveLoad();
      
      // If breaking point found, cool down
      if (this.breakingPointDetected) {
        await this.cooldown();
      }

      this.endTime = Date.now();
      this.emit('test-completed', { endTime: this.endTime });

      return this.generateResults();
    } finally {
      this.isRunning = false;
      this.resourceMonitor.stop();
      if (this.concurrencyTester) {
        await this.concurrencyTester.stop();
      }
    }
  }

  private async runProgressiveLoad(): Promise<void> {
    const testStartTime = Date.now();

    while (
      this.isRunning && 
      !this.breakingPointDetected && 
      this.currentUsers <= this.config.maxUsers &&
      (Date.now() - testStartTime) < this.config.maxDuration
    ) {
      this.emit('load-level', { users: this.currentUsers });

      // Run test at current load level
      const levelResult = await this.runLoadLevel(this.currentUsers);
      
      // Check breaking point criteria
      const criteriaResult = this.checkBreakingPointCriteria(levelResult);
      
      if (criteriaResult.failed) {
        this.consecutiveFailureCount++;
        
        if (this.consecutiveFailureCount >= this.config.breakingPointCriteria.consecutiveFailures) {
          this.breakingPointDetected = true;
          this.emit('breaking-point-detected', {
            users: this.currentUsers,
            criteria: criteriaResult.failedCriteria,
            metrics: levelResult
          });
        }
      } else {
        this.consecutiveFailureCount = 0;
      }

      // Record progression point
      this.recordProgressionPoint(levelResult);

      if (!this.breakingPointDetected) {
        // Increase load
        this.currentUsers = Math.min(
          this.currentUsers + this.config.userIncrement,
          this.config.maxUsers
        );
        
        // Wait before next increment
        await this.wait(this.config.incrementInterval);
      }
    }
  }

  private async runLoadLevel(users: number): Promise<LoadLevelMetrics> {
    const testConfig: ConcurrencyTestConfig = {
      scenarios: this.config.scenarios,
      maxConcurrentUsers: users,
      rampUpTime: Math.min(5000, users * 100), // Scale ramp-up with users
      sustainTime: 30000, // 30 seconds at each level
      rampDownTime: 0, // No ramp down between levels
      thinkTime: 100,
      performanceMonitor: this.config.performanceMonitor
    };

    this.concurrencyTester = new ConcurrencyTester(testConfig);
    
    // Collect metrics during test
    const metricsCollector = new MetricsCollector();
    
    this.concurrencyTester.on('user-completed', (data) => {
      metricsCollector.recordUserCompletion(data);
    });

    this.concurrencyTester.on('step-completed', (data) => {
      metricsCollector.recordStepCompletion(data);
    });

    const result = await this.concurrencyTester.run();
    
    // Get resource metrics
    const resourceMetrics = this.resourceMonitor.getAverageMetrics(30000) || {
      cpu: { usage: 0 },
      memory: { percentUsed: 0 }
    };

    return {
      users,
      throughput: result.summary.throughput,
      avgResponseTime: result.summary.averageResponseTime,
      p95ResponseTime: this.calculatePercentile(metricsCollector.responseTimes, 0.95),
      p99ResponseTime: this.calculatePercentile(metricsCollector.responseTimes, 0.99),
      errorRate: (result.summary.failedUsers / result.summary.totalUsers) * 100,
      cpuUsage: resourceMetrics.cpu?.usage || 0,
      memoryUsage: resourceMetrics.memory?.percentUsed || 0,
      totalRequests: result.summary.totalUsers,
      totalErrors: result.summary.failedUsers
    };
  }

  private checkBreakingPointCriteria(metrics: LoadLevelMetrics): CriteriaCheckResult {
    const failedCriteria: string[] = [];
    const criteria = this.config.breakingPointCriteria;

    if (metrics.avgResponseTime > criteria.maxResponseTime) {
      failedCriteria.push(`Response time (${metrics.avgResponseTime.toFixed(0)}ms) > ${criteria.maxResponseTime}ms`);
    }

    if (metrics.errorRate > criteria.maxErrorRate) {
      failedCriteria.push(`Error rate (${metrics.errorRate.toFixed(1)}%) > ${criteria.maxErrorRate}%`);
    }

    if (metrics.throughput < criteria.minThroughput) {
      failedCriteria.push(`Throughput (${metrics.throughput.toFixed(1)} rps) < ${criteria.minThroughput} rps`);
    }

    if (metrics.cpuUsage > criteria.maxCpuUsage) {
      failedCriteria.push(`CPU usage (${metrics.cpuUsage.toFixed(1)}%) > ${criteria.maxCpuUsage}%`);
    }

    if (metrics.memoryUsage > criteria.maxMemoryUsage) {
      failedCriteria.push(`Memory usage (${metrics.memoryUsage.toFixed(1)}%) > ${criteria.maxMemoryUsage}%`);
    }

    return {
      failed: failedCriteria.length > 0,
      failedCriteria
    };
  }

  private recordProgressionPoint(metrics: LoadLevelMetrics): void {
    const point: LoadProgressionPoint = {
      timestamp: Date.now(),
      users: metrics.users,
      throughput: metrics.throughput,
      avgResponseTime: metrics.avgResponseTime,
      p95ResponseTime: metrics.p95ResponseTime,
      p99ResponseTime: metrics.p99ResponseTime,
      errorRate: metrics.errorRate,
      cpuUsage: metrics.cpuUsage,
      memoryUsage: metrics.memoryUsage,
      healthy: this.consecutiveFailureCount === 0
    };

    this.loadProgression.push(point);

    // Update timeline metrics
    this.systemMetrics.timestamps.push(point.timestamp);
    this.systemMetrics.cpu.push(point.cpuUsage);
    this.systemMetrics.memory.push(point.memoryUsage);
    this.systemMetrics.throughput.push(point.throughput);
    this.systemMetrics.responseTime.push(point.avgResponseTime);
    this.systemMetrics.errors.push(point.errorRate);

    this.emit('progression-point', point);
  }

  private async cooldown(): Promise<void> {
    this.emit('cooldown-started');
    
    // Reduce load to 50% of breaking point
    const cooldownUsers = Math.floor(this.currentUsers * 0.5);
    
    const cooldownConfig: ConcurrencyTestConfig = {
      scenarios: this.config.scenarios,
      maxConcurrentUsers: cooldownUsers,
      rampUpTime: 5000,
      sustainTime: this.config.cooldownPeriod,
      rampDownTime: 5000,
      thinkTime: 200,
      performanceMonitor: this.config.performanceMonitor
    };

    const cooldownTester = new ConcurrencyTester(cooldownConfig);
    await cooldownTester.run();
    
    this.emit('cooldown-completed');
  }

  private generateResults(): StressTestResult {
    const summary = this.generateSummary();
    const breakingPoint = this.findBreakingPoint();
    const recommendations = this.generateRecommendations();

    return {
      summary,
      breakingPoint,
      loadProgression: this.loadProgression,
      systemMetrics: this.systemMetrics,
      recommendations
    };
  }

  private generateSummary(): StressTestSummary {
    const duration = (this.endTime || Date.now()) - (this.startTime || Date.now());
    const totalRequests = this.loadProgression.reduce((sum, p) => sum + (p.throughput * 30), 0);
    const totalErrors = this.loadProgression.reduce((sum, p) => sum + (p.errorRate * p.throughput * 30 / 100), 0);
    const peakThroughput = Math.max(...this.loadProgression.map(p => p.throughput), 0);
    const peakResponseTime = Math.max(...this.loadProgression.map(p => p.avgResponseTime), 0);

    return {
      startTime: this.startTime || 0,
      endTime: this.endTime || 0,
      duration,
      maxUsersReached: this.currentUsers,
      breakingPointFound: this.breakingPointDetected,
      totalRequests: Math.floor(totalRequests),
      totalErrors: Math.floor(totalErrors),
      peakThroughput,
      peakResponseTime
    };
  }

  private findBreakingPoint(): BreakingPointInfo | null {
    if (!this.breakingPointDetected || this.loadProgression.length === 0) {
      return null;
    }

    const breakingPointIndex = this.loadProgression.findIndex(p => !p.healthy);
    if (breakingPointIndex === -1) {
      return null;
    }

    const point = this.loadProgression[breakingPointIndex];
    const criteriaResult = this.checkBreakingPointCriteria({
      users: point.users,
      throughput: point.throughput,
      avgResponseTime: point.avgResponseTime,
      p95ResponseTime: point.p95ResponseTime,
      p99ResponseTime: point.p99ResponseTime,
      errorRate: point.errorRate,
      cpuUsage: point.cpuUsage,
      memoryUsage: point.memoryUsage,
      totalRequests: 0,
      totalErrors: 0
    });

    return {
      timestamp: point.timestamp,
      concurrentUsers: point.users,
      triggerCriteria: criteriaResult.failedCriteria,
      metrics: {
        responseTime: point.avgResponseTime,
        errorRate: point.errorRate,
        throughput: point.throughput,
        cpuUsage: point.cpuUsage,
        memoryUsage: point.memoryUsage
      }
    };
  }

  private generateRecommendations(): string[] {
    const recommendations: string[] = [];
    const breakingPoint = this.findBreakingPoint();

    if (!breakingPoint) {
      recommendations.push('System handled maximum configured load without reaching breaking point');
      recommendations.push('Consider increasing max users to find actual breaking point');
      return recommendations;
    }

    // Analyze breaking point causes
    if (breakingPoint.metrics.cpuUsage > 80) {
      recommendations.push('CPU bottleneck detected - consider:');
      recommendations.push('  - Optimizing CPU-intensive operations');
      recommendations.push('  - Implementing caching for compute-heavy tasks');
      recommendations.push('  - Scaling horizontally with load balancing');
    }

    if (breakingPoint.metrics.memoryUsage > 85) {
      recommendations.push('Memory bottleneck detected - consider:');
      recommendations.push('  - Analyzing memory leaks or inefficient memory usage');
      recommendations.push('  - Implementing pagination for large data sets');
      recommendations.push('  - Increasing available memory or optimizing data structures');
    }

    if (breakingPoint.metrics.responseTime > 5000) {
      recommendations.push('High response times detected - consider:');
      recommendations.push('  - Optimizing database queries');
      recommendations.push('  - Implementing request queuing and throttling');
      recommendations.push('  - Adding caching layers');
    }

    if (breakingPoint.metrics.errorRate > 10) {
      recommendations.push('High error rate detected - consider:');
      recommendations.push('  - Implementing circuit breakers');
      recommendations.push('  - Adding retry mechanisms with backoff');
      recommendations.push('  - Improving error handling and recovery');
    }

    // Calculate safe operating capacity
    const safeCapacity = Math.floor(breakingPoint.concurrentUsers * 0.7);
    recommendations.push(`Recommended safe operating capacity: ${safeCapacity} concurrent users`);

    // Suggest monitoring thresholds
    recommendations.push('Set monitoring alerts at:');
    recommendations.push(`  - ${Math.floor(breakingPoint.concurrentUsers * 0.8)} concurrent users (80% of breaking point)`);
    recommendations.push(`  - ${Math.floor(breakingPoint.metrics.responseTime * 0.8)}ms response time`);
    recommendations.push(`  - ${Math.floor(breakingPoint.metrics.cpuUsage * 0.9)}% CPU usage`);

    return recommendations;
  }

  private calculatePercentile(values: number[], percentile: number): number {
    if (values.length === 0) return 0;
    
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.floor(sorted.length * percentile);
    
    return sorted[Math.min(index, sorted.length - 1)];
  }

  private async wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async stop(): Promise<void> {
    this.isRunning = false;
    if (this.concurrencyTester) {
      await this.concurrencyTester.stop();
    }
  }
}

class MetricsCollector {
  responseTimes: number[] = [];
  private requestCount: number = 0;
  private errorCount: number = 0;

  recordUserCompletion(data: any): void {
    if (data.duration) {
      this.responseTimes.push(data.duration);
    }
    this.requestCount++;
    if (!data.success) {
      this.errorCount++;
    }
  }

  recordStepCompletion(data: any): void {
    if (data.step && data.step.duration) {
      this.responseTimes.push(data.step.duration);
    }
  }

  getErrorRate(): number {
    return this.requestCount > 0 ? (this.errorCount / this.requestCount) * 100 : 0;
  }
}

interface LoadLevelMetrics {
  users: number;
  throughput: number;
  avgResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  errorRate: number;
  cpuUsage: number;
  memoryUsage: number;
  totalRequests: number;
  totalErrors: number;
}

interface CriteriaCheckResult {
  failed: boolean;
  failedCriteria: string[];
}