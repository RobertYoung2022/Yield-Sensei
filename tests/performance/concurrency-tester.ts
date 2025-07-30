import { EventEmitter } from 'events';
import { Worker } from 'worker_threads';
import * as path from 'path';
import { performance } from 'perf_hooks';
import { PerformanceMonitor } from './performance-monitor';

export interface ConcurrencyTestConfig {
  scenarios: UserScenario[];
  maxConcurrentUsers: number;
  rampUpTime: number; // Time to reach max users (ms)
  sustainTime: number; // Time to sustain max load (ms)
  rampDownTime: number; // Time to ramp down (ms)
  thinkTime: number; // Delay between user actions (ms)
  performanceMonitor?: PerformanceMonitor;
}

export interface UserScenario {
  name: string;
  weight: number; // Percentage of users executing this scenario
  steps: ScenarioStep[];
  validations?: ValidationRule[];
}

export interface ScenarioStep {
  name: string;
  action: string; // Action type: 'request', 'wait', 'compute', 'database'
  params: any;
  timeout?: number;
  retries?: number;
}

export interface ValidationRule {
  metric: string;
  condition: 'lessThan' | 'greaterThan' | 'equals' | 'between';
  value: number | [number, number];
  failureMessage: string;
}

export interface ConcurrencyTestResult {
  summary: TestSummary;
  userMetrics: UserMetrics[];
  scenarioMetrics: Map<string, ScenarioMetrics>;
  concurrencyMetrics: ConcurrencyMetrics;
  errors: TestError[];
  validationResults: ValidationResult[];
}

export interface TestSummary {
  startTime: number;
  endTime: number;
  duration: number;
  totalUsers: number;
  successfulUsers: number;
  failedUsers: number;
  averageResponseTime: number;
  throughput: number;
}

export interface UserMetrics {
  userId: string;
  scenario: string;
  startTime: number;
  endTime: number;
  duration: number;
  steps: StepMetrics[];
  success: boolean;
  error?: string;
}

export interface StepMetrics {
  name: string;
  startTime: number;
  endTime: number;
  duration: number;
  success: boolean;
  error?: string;
  retries: number;
}

export interface ScenarioMetrics {
  name: string;
  executions: number;
  successes: number;
  failures: number;
  averageDuration: number;
  minDuration: number;
  maxDuration: number;
  p50Duration: number;
  p95Duration: number;
  p99Duration: number;
}

export interface ConcurrencyMetrics {
  peakConcurrentUsers: number;
  averageConcurrentUsers: number;
  userDistribution: Map<number, number>; // timestamp -> concurrent users
  contentionPoints: ContentionPoint[];
  resourceUtilization: ResourceUtilization[];
}

export interface ContentionPoint {
  timestamp: number;
  resource: string;
  waitingUsers: number;
  averageWaitTime: number;
}

export interface ResourceUtilization {
  timestamp: number;
  cpu: number;
  memory: number;
  connections: number;
  queueDepth: number;
}

export interface TestError {
  timestamp: number;
  userId: string;
  scenario: string;
  step: string;
  error: string;
  stack?: string;
}

export interface ValidationResult {
  rule: ValidationRule;
  passed: boolean;
  actualValue: number;
  timestamp: number;
}

export class ConcurrencyTester extends EventEmitter {
  private config: ConcurrencyTestConfig;
  private workers: Map<string, Worker> = new Map();
  private userMetrics: UserMetrics[] = [];
  private errors: TestError[] = [];
  private activeUsers: Set<string> = new Set();
  private startTime?: number;
  private endTime?: number;
  private concurrencyTimeline: Map<number, number> = new Map();
  private contentionMonitor: ContentionMonitor;
  private isRunning: boolean = false;

  constructor(config: ConcurrencyTestConfig) {
    super();
    this.config = config;
    this.contentionMonitor = new ContentionMonitor();
  }

  async run(): Promise<ConcurrencyTestResult> {
    if (this.isRunning) {
      throw new Error('Test is already running');
    }

    this.isRunning = true;
    this.startTime = Date.now();
    this.emit('test-started', { startTime: this.startTime });

    try {
      // Start performance monitoring if configured
      if (this.config.performanceMonitor) {
        await this.config.performanceMonitor.start();
      }

      // Execute test phases
      await this.rampUp();
      await this.sustain();
      await this.rampDown();

      this.endTime = Date.now();
      this.emit('test-completed', { endTime: this.endTime });

      // Generate and return results
      return this.generateResults();
    } finally {
      this.isRunning = false;
      if (this.config.performanceMonitor) {
        await this.config.performanceMonitor.stop();
      }
    }
  }

  private async rampUp(): Promise<void> {
    this.emit('phase-started', { phase: 'ramp-up' });

    const usersPerInterval = Math.ceil(this.config.maxConcurrentUsers / 10);
    const intervalTime = this.config.rampUpTime / 10;

    for (let i = 0; i < 10 && this.activeUsers.size < this.config.maxConcurrentUsers; i++) {
      const usersToAdd = Math.min(
        usersPerInterval,
        this.config.maxConcurrentUsers - this.activeUsers.size
      );

      await this.spawnUsers(usersToAdd);
      await this.wait(intervalTime);
      this.recordConcurrency();
    }

    this.emit('phase-completed', { phase: 'ramp-up', activeUsers: this.activeUsers.size });
  }

  private async sustain(): Promise<void> {
    this.emit('phase-started', { phase: 'sustain' });

    const checkInterval = 1000; // Check every second
    const checks = Math.floor(this.config.sustainTime / checkInterval);

    for (let i = 0; i < checks; i++) {
      // Replace any failed users
      const failedUsers = this.userMetrics.filter(m => !m.success && !this.activeUsers.has(m.userId));
      const usersToReplace = Math.min(failedUsers.length, this.config.maxConcurrentUsers - this.activeUsers.size);
      
      if (usersToReplace > 0) {
        await this.spawnUsers(usersToReplace);
      }

      this.recordConcurrency();
      await this.wait(checkInterval);
    }

    this.emit('phase-completed', { phase: 'sustain', activeUsers: this.activeUsers.size });
  }

  private async rampDown(): Promise<void> {
    this.emit('phase-started', { phase: 'ramp-down' });

    const usersPerInterval = Math.ceil(this.activeUsers.size / 10);
    const intervalTime = this.config.rampDownTime / 10;

    for (let i = 0; i < 10 && this.activeUsers.size > 0; i++) {
      const usersToRemove = Math.min(usersPerInterval, this.activeUsers.size);
      await this.removeUsers(usersToRemove);
      await this.wait(intervalTime);
      this.recordConcurrency();
    }

    // Ensure all users are terminated
    await this.removeUsers(this.activeUsers.size);

    this.emit('phase-completed', { phase: 'ramp-down', activeUsers: this.activeUsers.size });
  }

  private async spawnUsers(count: number): Promise<void> {
    const promises: Promise<void>[] = [];

    for (let i = 0; i < count; i++) {
      const userId = `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const scenario = this.selectScenario();
      
      promises.push(this.spawnUser(userId, scenario));
    }

    await Promise.all(promises);
  }

  private async spawnUser(userId: string, scenario: UserScenario): Promise<void> {
    const worker = new Worker(path.join(__dirname, 'concurrency-worker.js'), {
      workerData: {
        userId,
        scenario,
        thinkTime: this.config.thinkTime
      }
    });

    this.workers.set(userId, worker);
    this.activeUsers.add(userId);

    const userMetric: UserMetrics = {
      userId,
      scenario: scenario.name,
      startTime: Date.now(),
      endTime: 0,
      duration: 0,
      steps: [],
      success: false
    };

    worker.on('message', (message) => {
      switch (message.type) {
        case 'step-completed':
          userMetric.steps.push(message.data);
          this.emit('step-completed', { userId, step: message.data });
          break;
        
        case 'scenario-completed':
          userMetric.endTime = Date.now();
          userMetric.duration = userMetric.endTime - userMetric.startTime;
          userMetric.success = message.data.success;
          if (message.data.error) {
            userMetric.error = message.data.error;
          }
          this.userMetrics.push(userMetric);
          this.activeUsers.delete(userId);
          this.emit('user-completed', userMetric);
          break;

        case 'error':
          this.errors.push({
            timestamp: Date.now(),
            userId,
            scenario: scenario.name,
            step: message.data.step,
            error: message.data.error,
            stack: message.data.stack
          });
          this.emit('user-error', message.data);
          break;

        case 'contention':
          this.contentionMonitor.recordContention(message.data);
          break;
      }
    });

    worker.on('error', (error) => {
      this.errors.push({
        timestamp: Date.now(),
        userId,
        scenario: scenario.name,
        step: 'worker-error',
        error: error.message,
        stack: error.stack
      });
      this.activeUsers.delete(userId);
    });

    worker.on('exit', (code) => {
      this.workers.delete(userId);
      this.activeUsers.delete(userId);
      if (code !== 0) {
        this.emit('worker-exit', { userId, code });
      }
    });

    this.emit('user-spawned', { userId, scenario: scenario.name });
  }

  private async removeUsers(count: number): Promise<void> {
    const usersToRemove = Array.from(this.activeUsers).slice(0, count);
    
    for (const userId of usersToRemove) {
      const worker = this.workers.get(userId);
      if (worker) {
        await worker.terminate();
        this.workers.delete(userId);
        this.activeUsers.delete(userId);
      }
    }
  }

  private selectScenario(): UserScenario {
    const random = Math.random() * 100;
    let cumulative = 0;

    for (const scenario of this.config.scenarios) {
      cumulative += scenario.weight;
      if (random <= cumulative) {
        return scenario;
      }
    }

    return this.config.scenarios[0]; // Fallback
  }

  private recordConcurrency(): void {
    const timestamp = Date.now();
    this.concurrencyTimeline.set(timestamp, this.activeUsers.size);
  }

  private async wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private generateResults(): ConcurrencyTestResult {
    const summary = this.calculateSummary();
    const scenarioMetrics = this.calculateScenarioMetrics();
    const concurrencyMetrics = this.calculateConcurrencyMetrics();
    const validationResults = this.runValidations();

    return {
      summary,
      userMetrics: this.userMetrics,
      scenarioMetrics,
      concurrencyMetrics,
      errors: this.errors,
      validationResults
    };
  }

  private calculateSummary(): TestSummary {
    const successfulUsers = this.userMetrics.filter(m => m.success).length;
    const totalDuration = this.userMetrics.reduce((sum, m) => sum + m.duration, 0);
    const averageResponseTime = this.userMetrics.length > 0 
      ? totalDuration / this.userMetrics.length 
      : 0;

    const duration = (this.endTime || Date.now()) - (this.startTime || Date.now());
    const throughput = this.userMetrics.length / (duration / 1000);

    return {
      startTime: this.startTime || 0,
      endTime: this.endTime || 0,
      duration,
      totalUsers: this.userMetrics.length,
      successfulUsers,
      failedUsers: this.userMetrics.length - successfulUsers,
      averageResponseTime,
      throughput
    };
  }

  private calculateScenarioMetrics(): Map<string, ScenarioMetrics> {
    const metricsMap = new Map<string, ScenarioMetrics>();

    for (const scenario of this.config.scenarios) {
      const scenarioUsers = this.userMetrics.filter(m => m.scenario === scenario.name);
      
      if (scenarioUsers.length === 0) {
        continue;
      }

      const durations = scenarioUsers.map(m => m.duration).sort((a, b) => a - b);
      const successes = scenarioUsers.filter(m => m.success).length;

      metricsMap.set(scenario.name, {
        name: scenario.name,
        executions: scenarioUsers.length,
        successes,
        failures: scenarioUsers.length - successes,
        averageDuration: durations.reduce((a, b) => a + b, 0) / durations.length,
        minDuration: durations[0],
        maxDuration: durations[durations.length - 1],
        p50Duration: durations[Math.floor(durations.length * 0.5)],
        p95Duration: durations[Math.floor(durations.length * 0.95)],
        p99Duration: durations[Math.floor(durations.length * 0.99)]
      });
    }

    return metricsMap;
  }

  private calculateConcurrencyMetrics(): ConcurrencyMetrics {
    const concurrencyValues = Array.from(this.concurrencyTimeline.values());
    const peakConcurrentUsers = Math.max(...concurrencyValues, 0);
    const averageConcurrentUsers = concurrencyValues.length > 0
      ? concurrencyValues.reduce((a, b) => a + b, 0) / concurrencyValues.length
      : 0;

    const resourceUtilization = this.config.performanceMonitor
      ? this.extractResourceUtilization()
      : [];

    return {
      peakConcurrentUsers,
      averageConcurrentUsers,
      userDistribution: new Map(this.concurrencyTimeline),
      contentionPoints: this.contentionMonitor.getContentionPoints(),
      resourceUtilization
    };
  }

  private extractResourceUtilization(): ResourceUtilization[] {
    if (!this.config.performanceMonitor) {
      return [];
    }

    const metrics = this.config.performanceMonitor.getMetrics();
    
    return metrics.map(m => ({
      timestamp: m.timestamp,
      cpu: m.resource.cpu.usage,
      memory: m.resource.memory.percentUsed,
      connections: m.network.connections.active,
      queueDepth: m.application.saturation.queueDepth
    }));
  }

  private runValidations(): ValidationResult[] {
    const results: ValidationResult[] = [];

    for (const scenario of this.config.scenarios) {
      if (!scenario.validations) {
        continue;
      }

      const scenarioMetrics = this.calculateScenarioMetrics().get(scenario.name);
      if (!scenarioMetrics) {
        continue;
      }

      for (const rule of scenario.validations) {
        const value = this.getMetricValue(scenarioMetrics, rule.metric);
        const passed = this.evaluateCondition(value, rule.condition, rule.value);

        results.push({
          rule,
          passed,
          actualValue: value,
          timestamp: Date.now()
        });
      }
    }

    return results;
  }

  private getMetricValue(metrics: ScenarioMetrics, metric: string): number {
    switch (metric) {
      case 'averageDuration':
        return metrics.averageDuration;
      case 'p95Duration':
        return metrics.p95Duration;
      case 'p99Duration':
        return metrics.p99Duration;
      case 'successRate':
        return (metrics.successes / metrics.executions) * 100;
      default:
        return 0;
    }
  }

  private evaluateCondition(value: number, condition: string, target: number | [number, number]): boolean {
    switch (condition) {
      case 'lessThan':
        return value < (target as number);
      case 'greaterThan':
        return value > (target as number);
      case 'equals':
        return value === (target as number);
      case 'between':
        const [min, max] = target as [number, number];
        return value >= min && value <= max;
      default:
        return false;
    }
  }

  async stop(): Promise<void> {
    this.isRunning = false;
    await this.removeUsers(this.activeUsers.size);
  }
}

class ContentionMonitor {
  private contentionData: Map<string, ContentionData> = new Map();

  recordContention(data: any): void {
    const key = `${data.resource}-${Math.floor(data.timestamp / 1000)}`;
    
    if (!this.contentionData.has(key)) {
      this.contentionData.set(key, {
        resource: data.resource,
        timestamp: Math.floor(data.timestamp / 1000) * 1000,
        waitingUsers: 0,
        totalWaitTime: 0
      });
    }

    const contention = this.contentionData.get(key)!;
    contention.waitingUsers++;
    contention.totalWaitTime += data.waitTime;
  }

  getContentionPoints(): ContentionPoint[] {
    return Array.from(this.contentionData.values())
      .map(data => ({
        timestamp: data.timestamp,
        resource: data.resource,
        waitingUsers: data.waitingUsers,
        averageWaitTime: data.totalWaitTime / data.waitingUsers
      }))
      .filter(point => point.waitingUsers > 1) // Only show actual contention
      .sort((a, b) => b.waitingUsers - a.waitingUsers);
  }
}

interface ContentionData {
  resource: string;
  timestamp: number;
  waitingUsers: number;
  totalWaitTime: number;
}