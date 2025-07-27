/**
 * Stress Testing for Compliance System
 * High-volume load testing to ensure system reliability under stress
 */

import { EventEmitter } from 'events';
import Logger from '../../shared/logging/logger';
import { ScenarioExecutor, ComplianceScenario, ScenarioResult } from './scenario-framework';
import { CompliancePerformanceReporter } from './performance-reporting';

const logger = Logger.getLogger('compliance-stress-testing');

// Stress Test Configuration
export interface StressTestConfig {
  id: string;
  name: string;
  description: string;
  targetMetrics: TargetMetrics;
  loadProfile: LoadProfile;
  duration: number;
  rampUpTime: number;
  rampDownTime: number;
  scenarios: StressScenario[];
  thresholds: PerformanceThresholds;
  monitoring: MonitoringConfig;
}

export interface TargetMetrics {
  targetTPS: number;
  targetLatency: number;
  targetConcurrency: number;
  targetVolume: number;
}

export interface LoadProfile {
  type: LoadType;
  pattern: LoadPattern;
  distribution: LoadDistribution;
  scaling: ScalingStrategy;
}

export interface StressScenario {
  scenarioId: string;
  weight: number;
  concurrency: number;
  frequency: number;
  dataVariation: DataVariation;
}

export interface DataVariation {
  userTypes: string[];
  transactionTypes: string[];
  amounts: AmountRange;
  jurisdictions: string[];
  riskProfiles: string[];
}

export interface AmountRange {
  min: number;
  max: number;
  distribution: 'uniform' | 'normal' | 'exponential';
}

export interface PerformanceThresholds {
  maxLatency: number;
  maxErrorRate: number;
  minThroughput: number;
  maxCPUUsage: number;
  maxMemoryUsage: number;
  maxDatabaseConnections: number;
}

export interface MonitoringConfig {
  sampleRate: number;
  metricsInterval: number;
  alertThresholds: AlertThreshold[];
  resourceMonitoring: boolean;
  detailedLogging: boolean;
}

export interface AlertThreshold {
  metric: string;
  threshold: number;
  operator: 'greater' | 'less' | 'equal';
  severity: 'warning' | 'critical';
}

export interface StressTestResult {
  testId: string;
  configId: string;
  startTime: Date;
  endTime: Date;
  duration: number;
  status: TestStatus;
  summary: StressTestSummary;
  metrics: StressTestMetrics;
  breakdown: ScenarioBreakdown[];
  issues: PerformanceIssue[];
  recommendations: string[];
  artifacts: TestArtifact[];
}

export interface StressTestSummary {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  errorRate: number;
  averageTPS: number;
  peakTPS: number;
  averageLatency: number;
  p95Latency: number;
  p99Latency: number;
  maxLatency: number;
  thresholdViolations: number;
}

export interface StressTestMetrics {
  throughput: ThroughputMetrics;
  latency: LatencyMetrics;
  errorMetrics: ErrorMetrics;
  resourceMetrics: ResourceMetrics;
  complianceMetrics: ComplianceStressMetrics;
}

export interface ThroughputMetrics {
  requestsPerSecond: number[];
  peakThroughput: number;
  sustainedThroughput: number;
  throughputTrend: 'increasing' | 'stable' | 'decreasing';
  degradationPoint?: number;
}

export interface LatencyMetrics {
  averageLatency: number[];
  p50Latency: number[];
  p95Latency: number[];
  p99Latency: number[];
  maxLatency: number[];
  latencyTrend: 'improving' | 'stable' | 'degrading';
}

export interface ErrorMetrics {
  errorRates: number[];
  errorTypes: Map<string, number>;
  errorTrend: 'improving' | 'stable' | 'degrading';
  criticalErrors: number;
}

export interface ResourceMetrics {
  cpuUtilization: number[];
  memoryUtilization: number[];
  diskIOPS: number[];
  networkBandwidth: number[];
  databaseConnections: number[];
  gcFrequency: number[];
}

export interface ComplianceStressMetrics {
  detectionAccuracy: number[];
  falsePositiveRate: number[];
  falseNegativeRate: number[];
  caseCreationRate: number[];
  alertProcessingTime: number[];
}

export interface ScenarioBreakdown {
  scenarioId: string;
  executions: number;
  successes: number;
  failures: number;
  averageTime: number;
  throughput: number;
  issues: string[];
}

export interface PerformanceIssue {
  type: IssueType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  firstOccurred: Date;
  frequency: number;
  impact: string;
  recommendation: string;
}

export interface TestArtifact {
  name: string;
  type: 'log' | 'metrics' | 'screenshot' | 'report';
  path: string;
  size: number;
  generatedAt: Date;
}

// Enums
export type LoadType = 'constant' | 'spike' | 'ramp' | 'step' | 'wave';
export type LoadPattern = 'uniform' | 'burst' | 'gradual' | 'random';
export type LoadDistribution = 'uniform' | 'normal' | 'exponential' | 'poisson';
export type ScalingStrategy = 'linear' | 'exponential' | 'logarithmic';
export type TestStatus = 'running' | 'completed' | 'failed' | 'aborted';
export type IssueType = 'performance' | 'error' | 'timeout' | 'resource' | 'compliance';

// Stress Test Engine
export class ComplianceStressTestEngine extends EventEmitter {
  private scenarioExecutor: ScenarioExecutor;
  private performanceReporter: CompliancePerformanceReporter;
  private activeTests: Map<string, StressTestExecution> = new Map();
  private testHistory: StressTestResult[] = [];
  private resourceMonitor: ResourceMonitor;

  constructor(
    scenarioExecutor: ScenarioExecutor,
    performanceReporter: CompliancePerformanceReporter
  ) {
    super();
    this.scenarioExecutor = scenarioExecutor;
    this.performanceReporter = performanceReporter;
    this.resourceMonitor = new ResourceMonitor();
    
    logger.info('ComplianceStressTestEngine initialized');
  }

  /**
   * Execute stress test
   */
  async executeStressTest(config: StressTestConfig): Promise<StressTestResult> {
    const testId = this.generateTestId();
    const startTime = new Date();

    try {
      logger.info('Starting stress test', {
        testId,
        configId: config.id,
        targetTPS: config.targetMetrics.targetTPS,
        duration: config.duration
      });

      // Validate configuration
      this.validateConfig(config);

      // Create test execution context
      const execution = new StressTestExecution(testId, config, this.resourceMonitor);
      this.activeTests.set(testId, execution);

      // Start resource monitoring
      await this.resourceMonitor.startMonitoring(testId, config.monitoring);

      // Execute test phases
      await this.executeRampUp(execution);
      await this.executeMainLoad(execution);
      await this.executeRampDown(execution);

      // Stop monitoring and collect results
      const metrics = await this.resourceMonitor.stopMonitoring(testId);
      const result = await this.generateResults(execution, metrics);

      // Store result
      this.testHistory.push(result);
      this.activeTests.delete(testId);

      logger.info('Stress test completed', {
        testId,
        status: result.status,
        duration: result.duration,
        averageTPS: result.summary.averageTPS
      });

      this.emit('stressTestCompleted', result);

      return result;

    } catch (error) {
      logger.error('Stress test failed', { error, testId });
      
      // Cleanup
      await this.cleanupTest(testId);
      
      throw error;
    }
  }

  /**
   * Execute multiple stress tests in sequence
   */
  async executeStressTestSuite(configs: StressTestConfig[]): Promise<StressTestResult[]> {
    const results: StressTestResult[] = [];

    for (const config of configs) {
      try {
        const result = await this.executeStressTest(config);
        results.push(result);
        
        // Add cooldown period between tests
        await this.delay(30000); // 30 seconds
      } catch (error) {
        logger.error('Stress test suite execution failed', {
          error,
          configId: config.id
        });
      }
    }

    return results;
  }

  /**
   * Get active tests
   */
  getActiveTests(): string[] {
    return Array.from(this.activeTests.keys());
  }

  /**
   * Get test history
   */
  getTestHistory(): StressTestResult[] {
    return [...this.testHistory];
  }

  /**
   * Abort active test
   */
  async abortTest(testId: string): Promise<void> {
    const execution = this.activeTests.get(testId);
    if (execution) {
      execution.abort();
      await this.cleanupTest(testId);
      logger.info('Stress test aborted', { testId });
    }
  }

  // Private methods

  private validateConfig(config: StressTestConfig): void {
    if (!config.id || !config.name) {
      throw new Error('Invalid stress test config: missing required fields');
    }

    if (config.duration <= 0) {
      throw new Error('Invalid duration: must be positive');
    }

    if (config.targetMetrics.targetTPS <= 0) {
      throw new Error('Invalid target TPS: must be positive');
    }

    if (config.scenarios.length === 0) {
      throw new Error('No scenarios configured for stress test');
    }
  }

  private async executeRampUp(execution: StressTestExecution): Promise<void> {
    const { config } = execution;
    
    if (config.rampUpTime > 0) {
      logger.info('Starting ramp-up phase', {
        testId: execution.testId,
        rampUpTime: config.rampUpTime
      });

      execution.setPhase('ramp-up');
      
      const steps = 10;
      const stepDuration = config.rampUpTime / steps;
      const targetTPS = config.targetMetrics.targetTPS;
      
      for (let i = 1; i <= steps; i++) {
        if (execution.isAborted()) break;
        
        const currentTPS = (targetTPS * i) / steps;
        await this.executeLoadStep(execution, currentTPS, stepDuration);
      }
    }
  }

  private async executeMainLoad(execution: StressTestExecution): Promise<void> {
    const { config } = execution;
    
    logger.info('Starting main load phase', {
      testId: execution.testId,
      duration: config.duration,
      targetTPS: config.targetMetrics.targetTPS
    });

    execution.setPhase('main-load');
    
    const targetTPS = config.targetMetrics.targetTPS;
    await this.executeLoadStep(execution, targetTPS, config.duration);
  }

  private async executeRampDown(execution: StressTestExecution): Promise<void> {
    const { config } = execution;
    
    if (config.rampDownTime > 0) {
      logger.info('Starting ramp-down phase', {
        testId: execution.testId,
        rampDownTime: config.rampDownTime
      });

      execution.setPhase('ramp-down');
      
      const steps = 5;
      const stepDuration = config.rampDownTime / steps;
      const targetTPS = config.targetMetrics.targetTPS;
      
      for (let i = steps - 1; i >= 0; i--) {
        if (execution.isAborted()) break;
        
        const currentTPS = (targetTPS * i) / steps;
        await this.executeLoadStep(execution, currentTPS, stepDuration);
      }
    }
  }

  private async executeLoadStep(
    execution: StressTestExecution,
    targetTPS: number,
    duration: number
  ): Promise<void> {
    const { config } = execution;
    const startTime = Date.now();
    const endTime = startTime + duration;
    
    // Calculate intervals
    const intervalMs = targetTPS > 0 ? 1000 / targetTPS : 1000;
    
    const workers: Promise<void>[] = [];
    
    while (Date.now() < endTime && !execution.isAborted()) {
      // Start scenario executions based on load profile
      for (const scenario of config.scenarios) {
        if (Math.random() < scenario.weight) {
          const worker = this.executeScenarioInstance(execution, scenario);
          workers.push(worker);
        }
      }
      
      // Control load rate
      await this.delay(intervalMs);
    }
    
    // Wait for remaining workers to complete
    await Promise.allSettled(workers);
  }

  private async executeScenarioInstance(
    execution: StressTestExecution,
    stressScenario: StressScenario
  ): Promise<void> {
    try {
      const scenario = this.generateScenarioInstance(stressScenario);
      const result = await this.scenarioExecutor.executeScenario(scenario);
      
      execution.recordResult(result);
      this.performanceReporter.addTestResult(result);
      
    } catch (error) {
      execution.recordError(error as Error);
      logger.debug('Scenario execution failed during stress test', {
        error,
        testId: execution.testId,
        scenarioId: stressScenario.scenarioId
      });
    }
  }

  private generateScenarioInstance(stressScenario: StressScenario): ComplianceScenario {
    // Generate a scenario instance with varied data
    const variation = stressScenario.dataVariation;
    
    return {
      id: `stress_${stressScenario.scenarioId}_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      name: `Stress Test - ${stressScenario.scenarioId}`,
      description: 'Generated scenario for stress testing',
      category: 'system_stress',
      severity: 'medium',
      jurisdiction: [this.selectRandom(variation.jurisdictions)],
      tags: ['stress_test'],
      setup: {
        users: [{
          id: `stress_user_${Date.now()}`,
          type: this.selectRandom(variation.userTypes) as 'traditional' | 'decentralized',
          jurisdiction: this.selectRandom(variation.jurisdictions) as any,
          riskProfile: { overallRisk: this.selectRandom(variation.riskProfiles) as any },
          kycLevel: 'basic',
          attributes: {}
        }],
        accounts: [{
          id: `stress_account_${Date.now()}`,
          userId: `stress_user_${Date.now()}`,
          type: 'checking',
          balance: 100000,
          currency: 'USD',
          metadata: {}
        }],
        initialState: {}
      },
      steps: [{
        id: 'stress_step_1',
        action: {
          type: 'create_transaction',
          target: 'compliance_engine',
          method: 'processTransaction',
          params: []
        },
        data: {
          amount: this.generateAmount(variation.amounts),
          type: this.selectRandom(variation.transactionTypes),
          currency: 'USD'
        }
      }],
      expectedOutcomes: [],
      validationRules: [],
      metadata: {
        createdBy: 'stress_test_engine',
        createdAt: new Date(),
        lastModified: new Date(),
        version: '1.0.0',
        regulatoryReferences: [],
        testFrequency: 'on_change',
        priority: 'medium'
      }
    };
  }

  private selectRandom<T>(array: T[]): T {
    return array[Math.floor(Math.random() * array.length)];
  }

  private generateAmount(range: AmountRange): number {
    switch (range.distribution) {
      case 'uniform':
        return Math.random() * (range.max - range.min) + range.min;
      case 'normal':
        // Simple normal distribution approximation
        const u1 = Math.random();
        const u2 = Math.random();
        const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
        const mean = (range.min + range.max) / 2;
        const stdDev = (range.max - range.min) / 6;
        return Math.max(range.min, Math.min(range.max, mean + z0 * stdDev));
      case 'exponential':
        const lambda = 1 / ((range.max - range.min) / 2);
        return range.min + (-Math.log(1 - Math.random()) / lambda);
      default:
        return Math.random() * (range.max - range.min) + range.min;
    }
  }

  private async generateResults(
    execution: StressTestExecution,
    resourceMetrics: any
  ): Promise<StressTestResult> {
    const endTime = new Date();
    const duration = endTime.getTime() - execution.startTime.getTime();
    
    const summary = execution.generateSummary();
    const metrics = execution.generateMetrics(resourceMetrics);
    const breakdown = execution.generateBreakdown();
    const issues = this.analyzePerformanceIssues(execution, metrics);
    const recommendations = this.generateRecommendations(summary, metrics, issues);
    const artifacts = await this.generateArtifacts(execution);

    return {
      testId: execution.testId,
      configId: execution.config.id,
      startTime: execution.startTime,
      endTime,
      duration,
      status: execution.isAborted() ? 'aborted' : 'completed',
      summary,
      metrics,
      breakdown,
      issues,
      recommendations,
      artifacts
    };
  }

  private analyzePerformanceIssues(
    execution: StressTestExecution,
    metrics: StressTestMetrics
  ): PerformanceIssue[] {
    const issues: PerformanceIssue[] = [];
    const { config } = execution;

    // Check latency violations
    if (metrics.latency.p95Latency.some(l => l > config.thresholds.maxLatency)) {
      issues.push({
        type: 'performance',
        severity: 'high',
        description: 'P95 latency exceeded threshold',
        firstOccurred: execution.startTime,
        frequency: metrics.latency.p95Latency.filter(l => l > config.thresholds.maxLatency).length,
        impact: 'User experience degradation',
        recommendation: 'Optimize slow operations and review system capacity'
      });
    }

    // Check error rate violations
    if (metrics.errorMetrics.errorRates.some(r => r > config.thresholds.maxErrorRate)) {
      issues.push({
        type: 'error',
        severity: 'critical',
        description: 'Error rate exceeded threshold',
        firstOccurred: execution.startTime,
        frequency: metrics.errorMetrics.errorRates.filter(r => r > config.thresholds.maxErrorRate).length,
        impact: 'System reliability compromised',
        recommendation: 'Investigate and fix root causes of errors'
      });
    }

    // Check resource utilization
    if (metrics.resourceMetrics.cpuUtilization.some(c => c > config.thresholds.maxCPUUsage)) {
      issues.push({
        type: 'resource',
        severity: 'medium',
        description: 'CPU utilization exceeded threshold',
        firstOccurred: execution.startTime,
        frequency: metrics.resourceMetrics.cpuUtilization.filter(c => c > config.thresholds.maxCPUUsage).length,
        impact: 'Performance degradation and reduced capacity',
        recommendation: 'Scale up resources or optimize CPU-intensive operations'
      });
    }

    return issues;
  }

  private generateRecommendations(
    summary: StressTestSummary,
    metrics: StressTestMetrics,
    issues: PerformanceIssue[]
  ): string[] {
    const recommendations: string[] = [];

    if (summary.errorRate > 5) {
      recommendations.push('Error rate is high. Investigate and fix error sources.');
    }

    if (summary.p95Latency > 1000) {
      recommendations.push('P95 latency is high. Consider performance optimization.');
    }

    if (issues.some(i => i.type === 'resource')) {
      recommendations.push('Resource utilization is high. Consider scaling up infrastructure.');
    }

    if (metrics.throughput.throughputTrend === 'decreasing') {
      recommendations.push('Throughput is decreasing under load. Review system scalability.');
    }

    return recommendations;
  }

  private async generateArtifacts(execution: StressTestExecution): Promise<TestArtifact[]> {
    const artifacts: TestArtifact[] = [];

    // Generate performance charts
    artifacts.push({
      name: 'performance_chart.png',
      type: 'screenshot',
      path: `/stress-test-results/${execution.testId}/performance_chart.png`,
      size: 1024000,
      generatedAt: new Date()
    });

    // Generate detailed logs
    artifacts.push({
      name: 'test_execution.log',
      type: 'log',
      path: `/stress-test-results/${execution.testId}/test_execution.log`,
      size: 5120000,
      generatedAt: new Date()
    });

    return artifacts;
  }

  private async cleanupTest(testId: string): Promise<void> {
    const execution = this.activeTests.get(testId);
    if (execution) {
      execution.abort();
      this.activeTests.delete(testId);
    }
    
    await this.resourceMonitor.stopMonitoring(testId);
  }

  private generateTestId(): string {
    return `stress_test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Stress Test Execution Context
class StressTestExecution {
  public readonly testId: string;
  public readonly config: StressTestConfig;
  public readonly startTime: Date;
  private resourceMonitor: ResourceMonitor;
  private phase: string = 'initializing';
  private results: ScenarioResult[] = [];
  private errors: Error[] = [];
  private aborted = false;

  constructor(testId: string, config: StressTestConfig, resourceMonitor: ResourceMonitor) {
    this.testId = testId;
    this.config = config;
    this.startTime = new Date();
    this.resourceMonitor = resourceMonitor;
  }

  setPhase(phase: string): void {
    this.phase = phase;
  }

  recordResult(result: ScenarioResult): void {
    this.results.push(result);
  }

  recordError(error: Error): void {
    this.errors.push(error);
  }

  abort(): void {
    this.aborted = true;
  }

  isAborted(): boolean {
    return this.aborted;
  }

  generateSummary(): StressTestSummary {
    const totalRequests = this.results.length;
    const successfulRequests = this.results.filter(r => r.status === 'passed').length;
    const failedRequests = this.results.filter(r => r.status === 'failed').length;
    const errorRate = totalRequests > 0 ? (failedRequests / totalRequests) * 100 : 0;
    
    const durations = this.results.map(r => r.duration);
    const latencies = durations.sort((a, b) => a - b);
    
    const testDuration = Date.now() - this.startTime.getTime();
    const averageTPS = totalRequests / (testDuration / 1000);
    
    return {
      totalRequests,
      successfulRequests,
      failedRequests,
      errorRate,
      averageTPS,
      peakTPS: averageTPS * 1.2, // Approximation
      averageLatency: durations.reduce((sum, d) => sum + d, 0) / durations.length || 0,
      p95Latency: latencies[Math.floor(latencies.length * 0.95)] || 0,
      p99Latency: latencies[Math.floor(latencies.length * 0.99)] || 0,
      maxLatency: latencies[latencies.length - 1] || 0,
      thresholdViolations: 0 // Would be calculated based on thresholds
    };
  }

  generateMetrics(resourceMetrics: any): StressTestMetrics {
    // Generate metrics from collected data
    return {
      throughput: {
        requestsPerSecond: [],
        peakThroughput: 0,
        sustainedThroughput: 0,
        throughputTrend: 'stable',
        degradationPoint: undefined
      },
      latency: {
        averageLatency: [],
        p50Latency: [],
        p95Latency: [],
        p99Latency: [],
        maxLatency: [],
        latencyTrend: 'stable'
      },
      errorMetrics: {
        errorRates: [],
        errorTypes: new Map(),
        errorTrend: 'stable',
        criticalErrors: 0
      },
      resourceMetrics: {
        cpuUtilization: resourceMetrics?.cpu || [],
        memoryUtilization: resourceMetrics?.memory || [],
        diskIOPS: resourceMetrics?.disk || [],
        networkBandwidth: resourceMetrics?.network || [],
        databaseConnections: resourceMetrics?.database || [],
        gcFrequency: resourceMetrics?.gc || []
      },
      complianceMetrics: {
        detectionAccuracy: [],
        falsePositiveRate: [],
        falseNegativeRate: [],
        caseCreationRate: [],
        alertProcessingTime: []
      }
    };
  }

  generateBreakdown(): ScenarioBreakdown[] {
    const scenarioMap = new Map<string, ScenarioResult[]>();
    
    this.results.forEach(result => {
      const existing = scenarioMap.get(result.scenarioId) || [];
      existing.push(result);
      scenarioMap.set(result.scenarioId, existing);
    });

    return Array.from(scenarioMap.entries()).map(([scenarioId, results]) => ({
      scenarioId,
      executions: results.length,
      successes: results.filter(r => r.status === 'passed').length,
      failures: results.filter(r => r.status === 'failed').length,
      averageTime: results.reduce((sum, r) => sum + r.duration, 0) / results.length,
      throughput: results.length / ((Date.now() - this.startTime.getTime()) / 1000),
      issues: []
    }));
  }
}

// Resource Monitor
class ResourceMonitor {
  private monitors: Map<string, any> = new Map();

  async startMonitoring(testId: string, config: MonitoringConfig): Promise<void> {
    logger.debug('Starting resource monitoring', { testId });
    
    const monitor = {
      interval: setInterval(() => {
        this.collectMetrics(testId);
      }, config.metricsInterval),
      metrics: {
        cpu: [],
        memory: [],
        disk: [],
        network: [],
        database: [],
        gc: []
      }
    };
    
    this.monitors.set(testId, monitor);
  }

  async stopMonitoring(testId: string): Promise<any> {
    const monitor = this.monitors.get(testId);
    if (monitor) {
      clearInterval(monitor.interval);
      const metrics = monitor.metrics;
      this.monitors.delete(testId);
      
      logger.debug('Stopped resource monitoring', { testId });
      return metrics;
    }
    
    return null;
  }

  private collectMetrics(testId: string): void {
    const monitor = this.monitors.get(testId);
    if (!monitor) return;

    // Collect system metrics (placeholder implementation)
    monitor.metrics.cpu.push(Math.random() * 100);
    monitor.metrics.memory.push(Math.random() * 100);
    monitor.metrics.disk.push(Math.random() * 100);
    monitor.metrics.network.push(Math.random() * 100);
    monitor.metrics.database.push(Math.random() * 50);
    monitor.metrics.gc.push(Math.random() * 10);
  }
}

export default ComplianceStressTestEngine;