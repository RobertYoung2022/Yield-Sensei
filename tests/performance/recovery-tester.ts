import { EventEmitter } from 'events';
import { StressTester, StressTestConfig } from './stress-tester';
import { PerformanceMonitor } from './performance-monitor';
import { ConcurrencyTester, UserScenario } from './concurrency-tester';

export interface RecoveryTestConfig {
  targetSystem: string;
  scenarios: UserScenario[];
  overloadConfig: OverloadConfig;
  recoveryConfig: RecoveryConfig;
  performanceMonitor?: PerformanceMonitor;
  maxTestDuration: number;
}

export interface OverloadConfig {
  type: 'spike' | 'gradual' | 'sustained';
  peakUsers: number;
  overloadDuration: number;
  rampUpTime?: number; // For gradual overload
}

export interface RecoveryConfig {
  targetRecoveryTime: number; // Expected time to recover
  acceptablePerformance: {
    responseTime: number;
    errorRate: number;
    throughput: number;
  };
  stabilityDuration: number; // Time to maintain stable performance
  checkInterval: number; // How often to check recovery metrics
}

export interface RecoveryTestResult {
  summary: RecoveryTestSummary;
  overloadPhase: OverloadPhaseMetrics;
  recoveryPhase: RecoveryPhaseMetrics;
  timeline: RecoveryTimeline[];
  analysis: RecoveryAnalysis;
}

export interface RecoveryTestSummary {
  startTime: number;
  endTime: number;
  totalDuration: number;
  recoveryAchieved: boolean;
  actualRecoveryTime: number;
  meetsTargetRecoveryTime: boolean;
  finalSystemState: 'recovered' | 'degraded' | 'failed';
}

export interface OverloadPhaseMetrics {
  startTime: number;
  endTime: number;
  peakLoad: number;
  peakResponseTime: number;
  peakErrorRate: number;
  minThroughput: number;
  systemFailures: SystemFailure[];
}

export interface RecoveryPhaseMetrics {
  startTime: number;
  endTime: number;
  recoveryStartDetected: number;
  timeToFirstResponse: number;
  timeToAcceptablePerformance: number;
  timeToStablePerformance: number;
  oscillations: number; // Number of performance oscillations
}

export interface RecoveryTimeline {
  timestamp: number;
  phase: 'baseline' | 'overload' | 'recovery' | 'stable';
  metrics: {
    activeUsers: number;
    responseTime: number;
    throughput: number;
    errorRate: number;
    cpuUsage: number;
    memoryUsage: number;
    queueDepth: number;
  };
  healthStatus: 'healthy' | 'degraded' | 'critical' | 'recovering';
}

export interface SystemFailure {
  timestamp: number;
  type: 'timeout' | 'error' | 'resource_exhaustion' | 'service_unavailable';
  severity: 'low' | 'medium' | 'high' | 'critical';
  details: string;
  recovered: boolean;
  recoveryTime?: number;
}

export interface RecoveryAnalysis {
  recoveryPattern: 'immediate' | 'gradual' | 'oscillating' | 'failed';
  bottlenecks: string[];
  resilience: {
    score: number; // 0-100
    factors: {
      recoverySpeed: number;
      stabilityAfterRecovery: number;
      errorHandling: number;
      resourceManagement: number;
    };
  };
  recommendations: string[];
}

export class RecoveryTester extends EventEmitter {
  private config: RecoveryTestConfig;
  private performanceMonitor: PerformanceMonitor;
  private timeline: RecoveryTimeline[] = [];
  private systemFailures: SystemFailure[] = [];
  private currentPhase: 'baseline' | 'overload' | 'recovery' | 'stable' = 'baseline';
  private isRunning: boolean = false;
  private startTime?: number;
  private endTime?: number;
  private overloadStartTime?: number;
  private overloadEndTime?: number;
  private recoveryStartTime?: number;
  private recoveryAchievedTime?: number;
  private baselineMetrics?: BaselineMetrics;
  private oscillationCount: number = 0;
  private lastHealthStatus: string = 'healthy';

  constructor(config: RecoveryTestConfig) {
    super();
    this.config = config;
    this.performanceMonitor = config.performanceMonitor || new PerformanceMonitor();
  }

  async run(): Promise<RecoveryTestResult> {
    if (this.isRunning) {
      throw new Error('Recovery test is already running');
    }

    this.isRunning = true;
    this.startTime = Date.now();
    this.timeline = [];
    this.systemFailures = [];
    this.oscillationCount = 0;

    this.emit('test-started', { startTime: this.startTime });

    try {
      // Start performance monitoring
      await this.performanceMonitor.start();

      // Phase 1: Establish baseline
      await this.establishBaseline();

      // Phase 2: Apply overload
      await this.applyOverload();

      // Phase 3: Monitor recovery
      await this.monitorRecovery();

      this.endTime = Date.now();
      this.emit('test-completed', { endTime: this.endTime });

      return this.generateResults();
    } finally {
      this.isRunning = false;
      await this.performanceMonitor.stop();
    }
  }

  private async establishBaseline(): Promise<void> {
    this.currentPhase = 'baseline';
    this.emit('phase-started', { phase: 'baseline' });

    const baselineConfig = {
      scenarios: this.config.scenarios,
      maxConcurrentUsers: 10, // Light load for baseline
      rampUpTime: 5000,
      sustainTime: 30000, // 30 seconds baseline
      rampDownTime: 0,
      thinkTime: 100,
      performanceMonitor: this.performanceMonitor
    };

    const tester = new ConcurrencyTester(baselineConfig);
    const result = await tester.run();

    this.baselineMetrics = {
      responseTime: result.summary.averageResponseTime,
      throughput: result.summary.throughput,
      errorRate: (result.summary.failedUsers / result.summary.totalUsers) * 100,
      cpuUsage: 0, // Will be filled from performance monitor
      memoryUsage: 0
    };

    // Get resource metrics
    const perfMetrics = this.performanceMonitor.getMetrics(30000);
    if (perfMetrics.length > 0) {
      const avgCpu = perfMetrics.reduce((sum, m) => sum + m.resource.cpu.usage, 0) / perfMetrics.length;
      const avgMemory = perfMetrics.reduce((sum, m) => sum + m.resource.memory.percentUsed, 0) / perfMetrics.length;
      this.baselineMetrics.cpuUsage = avgCpu;
      this.baselineMetrics.memoryUsage = avgMemory;
    }

    this.recordTimelinePoint(10, 'healthy');
    this.emit('baseline-established', this.baselineMetrics);
    this.emit('phase-completed', { phase: 'baseline' });
  }

  private async applyOverload(): Promise<void> {
    this.currentPhase = 'overload';
    this.overloadStartTime = Date.now();
    this.emit('phase-started', { phase: 'overload' });

    switch (this.config.overloadConfig.type) {
      case 'spike':
        await this.applySpikeOverload();
        break;
      case 'gradual':
        await this.applyGradualOverload();
        break;
      case 'sustained':
        await this.applySustainedOverload();
        break;
    }

    this.overloadEndTime = Date.now();
    this.emit('phase-completed', { phase: 'overload' });
  }

  private async applySpikeOverload(): Promise<void> {
    const spikeConfig = {
      scenarios: this.config.scenarios,
      maxConcurrentUsers: this.config.overloadConfig.peakUsers,
      rampUpTime: 1000, // Very fast ramp for spike
      sustainTime: this.config.overloadConfig.overloadDuration,
      rampDownTime: 1000,
      thinkTime: 50, // Aggressive user behavior
      performanceMonitor: this.performanceMonitor
    };

    const tester = new ConcurrencyTester(spikeConfig);
    
    // Monitor during spike
    const monitorInterval = setInterval(() => {
      this.checkSystemHealth(this.config.overloadConfig.peakUsers);
    }, 1000);

    try {
      await tester.run();
    } catch (error) {
      this.recordSystemFailure('error', 'critical', `Spike overload failed: ${error}`);
    } finally {
      clearInterval(monitorInterval);
    }
  }

  private async applyGradualOverload(): Promise<void> {
    const rampUpTime = this.config.overloadConfig.rampUpTime || 30000;
    const steps = 10;
    const usersPerStep = Math.floor(this.config.overloadConfig.peakUsers / steps);
    const stepDuration = Math.floor(this.config.overloadConfig.overloadDuration / steps);

    for (let i = 1; i <= steps && this.isRunning; i++) {
      const currentUsers = usersPerStep * i;
      
      const stepConfig = {
        scenarios: this.config.scenarios,
        maxConcurrentUsers: currentUsers,
        rampUpTime: rampUpTime / steps,
        sustainTime: stepDuration,
        rampDownTime: 0,
        thinkTime: 75,
        performanceMonitor: this.performanceMonitor
      };

      const tester = new ConcurrencyTester(stepConfig);
      
      try {
        await tester.run();
        this.checkSystemHealth(currentUsers);
      } catch (error) {
        this.recordSystemFailure('error', 'high', `Gradual overload step ${i} failed: ${error}`);
      }
    }
  }

  private async applySustainedOverload(): Promise<void> {
    const sustainedConfig = {
      scenarios: this.config.scenarios,
      maxConcurrentUsers: this.config.overloadConfig.peakUsers,
      rampUpTime: 10000,
      sustainTime: this.config.overloadConfig.overloadDuration,
      rampDownTime: 5000,
      thinkTime: 100,
      performanceMonitor: this.performanceMonitor
    };

    const tester = new ConcurrencyTester(sustainedConfig);
    
    // Monitor continuously during sustained load
    const monitorInterval = setInterval(() => {
      this.checkSystemHealth(this.config.overloadConfig.peakUsers);
    }, 2000);

    try {
      await tester.run();
    } catch (error) {
      this.recordSystemFailure('error', 'critical', `Sustained overload failed: ${error}`);
    } finally {
      clearInterval(monitorInterval);
    }
  }

  private async monitorRecovery(): Promise<void> {
    this.currentPhase = 'recovery';
    this.recoveryStartTime = Date.now();
    this.emit('phase-started', { phase: 'recovery' });

    const maxRecoveryTime = this.config.recoveryConfig.targetRecoveryTime * 3; // 3x target as max
    const checkInterval = this.config.recoveryConfig.checkInterval;
    let recoveryChecks = 0;
    let stableChecks = 0;
    const requiredStableChecks = Math.floor(this.config.recoveryConfig.stabilityDuration / checkInterval);

    while (
      this.isRunning &&
      (Date.now() - this.recoveryStartTime) < maxRecoveryTime
    ) {
      // Run light load to test recovery
      const recoveryLoad = Math.max(5, Math.floor(this.baselineMetrics!.throughput));
      
      const testConfig = {
        scenarios: this.config.scenarios,
        maxConcurrentUsers: recoveryLoad,
        rampUpTime: 1000,
        sustainTime: checkInterval,
        rampDownTime: 0,
        thinkTime: 200,
        performanceMonitor: this.performanceMonitor
      };

      try {
        const tester = new ConcurrencyTester(testConfig);
        const result = await tester.run();
        
        const currentMetrics = {
          responseTime: result.summary.averageResponseTime,
          throughput: result.summary.throughput,
          errorRate: (result.summary.failedUsers / result.summary.totalUsers) * 100
        };

        const isAcceptable = this.checkAcceptablePerformance(currentMetrics);
        this.checkSystemHealth(recoveryLoad);

        if (isAcceptable) {
          if (!this.recoveryAchievedTime) {
            this.recoveryAchievedTime = Date.now();
            this.emit('recovery-detected', {
              recoveryTime: this.recoveryAchievedTime - this.overloadEndTime!
            });
          }
          
          stableChecks++;
          
          if (stableChecks >= requiredStableChecks) {
            this.currentPhase = 'stable';
            this.emit('stability-achieved');
            break;
          }
        } else {
          stableChecks = 0; // Reset stability counter
          
          // Check for oscillation
          const currentHealth = this.timeline[this.timeline.length - 1]?.healthStatus;
          if (currentHealth !== this.lastHealthStatus) {
            this.oscillationCount++;
          }
          this.lastHealthStatus = currentHealth;
        }

        recoveryChecks++;
      } catch (error) {
        this.recordSystemFailure('error', 'medium', `Recovery check failed: ${error}`);
        stableChecks = 0;
      }

      await this.wait(checkInterval);
    }

    this.emit('phase-completed', { phase: 'recovery' });
  }

  private checkSystemHealth(activeUsers: number): void {
    const metrics = this.collectCurrentMetrics(activeUsers);
    const healthStatus = this.determineHealthStatus(metrics);
    
    this.recordTimelinePoint(activeUsers, healthStatus);
    
    // Detect and record failures
    if (metrics.errorRate > 50) {
      this.recordSystemFailure('error', 'high', `Error rate exceeded 50%: ${metrics.errorRate.toFixed(1)}%`);
    }
    
    if (metrics.responseTime > 10000) {
      this.recordSystemFailure('timeout', 'critical', `Response time exceeded 10s: ${metrics.responseTime}ms`);
    }
    
    if (metrics.cpuUsage > 95) {
      this.recordSystemFailure('resource_exhaustion', 'critical', `CPU usage critical: ${metrics.cpuUsage.toFixed(1)}%`);
    }
    
    if (metrics.memoryUsage > 95) {
      this.recordSystemFailure('resource_exhaustion', 'critical', `Memory usage critical: ${metrics.memoryUsage.toFixed(1)}%`);
    }
  }

  private collectCurrentMetrics(activeUsers: number): any {
    const perfMetrics = this.performanceMonitor.getMetrics(5000); // Last 5 seconds
    
    if (perfMetrics.length === 0) {
      return {
        activeUsers,
        responseTime: 0,
        throughput: 0,
        errorRate: 0,
        cpuUsage: 0,
        memoryUsage: 0,
        queueDepth: 0
      };
    }

    const latest = perfMetrics[perfMetrics.length - 1];
    const avgResponseTime = perfMetrics.reduce((sum, m) => 
      sum + m.network.requests.averageLatency, 0) / perfMetrics.length;
    
    return {
      activeUsers,
      responseTime: avgResponseTime,
      throughput: latest.network.requests.total,
      errorRate: (latest.network.requests.failed / latest.network.requests.total) * 100 || 0,
      cpuUsage: latest.resource.cpu.usage,
      memoryUsage: latest.resource.memory.percentUsed,
      queueDepth: latest.application.saturation.queueDepth
    };
  }

  private determineHealthStatus(metrics: any): 'healthy' | 'degraded' | 'critical' | 'recovering' {
    if (!this.baselineMetrics) {
      return 'healthy';
    }

    const responseTimeRatio = metrics.responseTime / this.baselineMetrics.responseTime;
    const throughputRatio = metrics.throughput / this.baselineMetrics.throughput;
    const errorIncrease = metrics.errorRate - this.baselineMetrics.errorRate;

    if (this.currentPhase === 'recovery' || this.currentPhase === 'stable') {
      if (this.checkAcceptablePerformance(metrics)) {
        return 'healthy';
      }
      return 'recovering';
    }

    if (responseTimeRatio > 10 || errorIncrease > 50 || throughputRatio < 0.1) {
      return 'critical';
    }
    
    if (responseTimeRatio > 3 || errorIncrease > 10 || throughputRatio < 0.5) {
      return 'degraded';
    }
    
    return 'healthy';
  }

  private checkAcceptablePerformance(metrics: any): boolean {
    const acceptable = this.config.recoveryConfig.acceptablePerformance;
    
    return (
      metrics.responseTime <= acceptable.responseTime &&
      metrics.errorRate <= acceptable.errorRate &&
      metrics.throughput >= acceptable.throughput
    );
  }

  private recordTimelinePoint(activeUsers: number, healthStatus: any): void {
    const metrics = this.collectCurrentMetrics(activeUsers);
    
    this.timeline.push({
      timestamp: Date.now(),
      phase: this.currentPhase,
      metrics,
      healthStatus
    });
  }

  private recordSystemFailure(
    type: 'timeout' | 'error' | 'resource_exhaustion' | 'service_unavailable',
    severity: 'low' | 'medium' | 'high' | 'critical',
    details: string
  ): void {
    const failure: SystemFailure = {
      timestamp: Date.now(),
      type,
      severity,
      details,
      recovered: false
    };

    this.systemFailures.push(failure);
    this.emit('system-failure', failure);
  }

  private generateResults(): RecoveryTestResult {
    const summary = this.generateSummary();
    const overloadPhase = this.generateOverloadPhaseMetrics();
    const recoveryPhase = this.generateRecoveryPhaseMetrics();
    const analysis = this.analyzeRecovery();

    return {
      summary,
      overloadPhase,
      recoveryPhase,
      timeline: this.timeline,
      analysis
    };
  }

  private generateSummary(): RecoveryTestSummary {
    const totalDuration = (this.endTime || Date.now()) - (this.startTime || Date.now());
    const actualRecoveryTime = this.recoveryAchievedTime 
      ? this.recoveryAchievedTime - (this.overloadEndTime || 0)
      : -1;
    
    const recoveryAchieved = actualRecoveryTime > 0;
    const meetsTargetRecoveryTime = recoveryAchieved && 
      actualRecoveryTime <= this.config.recoveryConfig.targetRecoveryTime;

    let finalSystemState: 'recovered' | 'degraded' | 'failed';
    if (this.currentPhase === 'stable') {
      finalSystemState = 'recovered';
    } else if (this.timeline[this.timeline.length - 1]?.healthStatus === 'recovering') {
      finalSystemState = 'degraded';
    } else {
      finalSystemState = 'failed';
    }

    return {
      startTime: this.startTime || 0,
      endTime: this.endTime || 0,
      totalDuration,
      recoveryAchieved,
      actualRecoveryTime,
      meetsTargetRecoveryTime,
      finalSystemState
    };
  }

  private generateOverloadPhaseMetrics(): OverloadPhaseMetrics {
    const overloadPoints = this.timeline.filter(p => p.phase === 'overload');
    
    const peakLoad = Math.max(...overloadPoints.map(p => p.metrics.activeUsers), 0);
    const peakResponseTime = Math.max(...overloadPoints.map(p => p.metrics.responseTime), 0);
    const peakErrorRate = Math.max(...overloadPoints.map(p => p.metrics.errorRate), 0);
    const minThroughput = Math.min(...overloadPoints.map(p => p.metrics.throughput), Infinity);

    const overloadFailures = this.systemFailures.filter(f => 
      f.timestamp >= (this.overloadStartTime || 0) && 
      f.timestamp <= (this.overloadEndTime || Date.now())
    );

    return {
      startTime: this.overloadStartTime || 0,
      endTime: this.overloadEndTime || 0,
      peakLoad,
      peakResponseTime,
      peakErrorRate,
      minThroughput: minThroughput === Infinity ? 0 : minThroughput,
      systemFailures: overloadFailures
    };
  }

  private generateRecoveryPhaseMetrics(): RecoveryPhaseMetrics {
    const recoveryPoints = this.timeline.filter(p => 
      p.phase === 'recovery' || p.phase === 'stable'
    );

    if (recoveryPoints.length === 0) {
      return {
        startTime: this.recoveryStartTime || 0,
        endTime: this.endTime || 0,
        recoveryStartDetected: -1,
        timeToFirstResponse: -1,
        timeToAcceptablePerformance: -1,
        timeToStablePerformance: -1,
        oscillations: 0
      };
    }

    const firstHealthyPoint = recoveryPoints.find(p => p.healthStatus === 'healthy');
    const timeToFirstResponse = firstHealthyPoint 
      ? firstHealthyPoint.timestamp - (this.overloadEndTime || 0)
      : -1;

    const timeToAcceptablePerformance = this.recoveryAchievedTime
      ? this.recoveryAchievedTime - (this.overloadEndTime || 0)
      : -1;

    const stablePoint = this.timeline.find(p => p.phase === 'stable');
    const timeToStablePerformance = stablePoint
      ? stablePoint.timestamp - (this.overloadEndTime || 0)
      : -1;

    return {
      startTime: this.recoveryStartTime || 0,
      endTime: this.endTime || 0,
      recoveryStartDetected: this.recoveryStartTime || -1,
      timeToFirstResponse,
      timeToAcceptablePerformance,
      timeToStablePerformance,
      oscillations: this.oscillationCount
    };
  }

  private analyzeRecovery(): RecoveryAnalysis {
    const recoveryPattern = this.determineRecoveryPattern();
    const bottlenecks = this.identifyBottlenecks();
    const resilience = this.calculateResilience();
    const recommendations = this.generateRecommendations(recoveryPattern, bottlenecks, resilience);

    return {
      recoveryPattern,
      bottlenecks,
      resilience,
      recommendations
    };
  }

  private determineRecoveryPattern(): 'immediate' | 'gradual' | 'oscillating' | 'failed' {
    if (this.currentPhase !== 'stable' && !this.recoveryAchievedTime) {
      return 'failed';
    }

    const recoveryTime = this.recoveryAchievedTime 
      ? this.recoveryAchievedTime - (this.overloadEndTime || 0)
      : Infinity;

    if (this.oscillationCount > 5) {
      return 'oscillating';
    }

    if (recoveryTime < 30000) { // Less than 30 seconds
      return 'immediate';
    }

    return 'gradual';
  }

  private identifyBottlenecks(): string[] {
    const bottlenecks: string[] = [];
    
    const criticalPoints = this.timeline.filter(p => p.healthStatus === 'critical');
    if (criticalPoints.length > 0) {
      const avgCpu = criticalPoints.reduce((sum, p) => sum + p.metrics.cpuUsage, 0) / criticalPoints.length;
      const avgMemory = criticalPoints.reduce((sum, p) => sum + p.metrics.memoryUsage, 0) / criticalPoints.length;
      const avgQueue = criticalPoints.reduce((sum, p) => sum + p.metrics.queueDepth, 0) / criticalPoints.length;

      if (avgCpu > 80) bottlenecks.push('CPU saturation');
      if (avgMemory > 80) bottlenecks.push('Memory pressure');
      if (avgQueue > 100) bottlenecks.push('Request queue overflow');
    }

    const highErrorFailures = this.systemFailures.filter(f => f.type === 'error' && f.severity === 'critical');
    if (highErrorFailures.length > 5) {
      bottlenecks.push('Error handling capacity');
    }

    const timeoutFailures = this.systemFailures.filter(f => f.type === 'timeout');
    if (timeoutFailures.length > 3) {
      bottlenecks.push('Response time degradation');
    }

    return bottlenecks;
  }

  private calculateResilience(): any {
    const recoverySpeed = this.calculateRecoverySpeed();
    const stability = this.calculateStability();
    const errorHandling = this.calculateErrorHandling();
    const resourceManagement = this.calculateResourceManagement();

    const score = (recoverySpeed + stability + errorHandling + resourceManagement) / 4;

    return {
      score: Math.round(score),
      factors: {
        recoverySpeed: Math.round(recoverySpeed),
        stabilityAfterRecovery: Math.round(stability),
        errorHandling: Math.round(errorHandling),
        resourceManagement: Math.round(resourceManagement)
      }
    };
  }

  private calculateRecoverySpeed(): number {
    if (!this.recoveryAchievedTime) return 0;
    
    const actualTime = this.recoveryAchievedTime - (this.overloadEndTime || 0);
    const targetTime = this.config.recoveryConfig.targetRecoveryTime;
    
    if (actualTime <= targetTime) return 100;
    if (actualTime <= targetTime * 1.5) return 80;
    if (actualTime <= targetTime * 2) return 60;
    if (actualTime <= targetTime * 3) return 40;
    return 20;
  }

  private calculateStability(): number {
    if (this.currentPhase !== 'stable') return 0;
    if (this.oscillationCount === 0) return 100;
    if (this.oscillationCount <= 2) return 80;
    if (this.oscillationCount <= 5) return 60;
    if (this.oscillationCount <= 10) return 40;
    return 20;
  }

  private calculateErrorHandling(): number {
    const totalFailures = this.systemFailures.length;
    const criticalFailures = this.systemFailures.filter(f => f.severity === 'critical').length;
    
    if (totalFailures === 0) return 100;
    if (criticalFailures === 0) return 90;
    
    const criticalRatio = criticalFailures / totalFailures;
    return Math.max(20, 100 - (criticalRatio * 100));
  }

  private calculateResourceManagement(): number {
    const overloadPoints = this.timeline.filter(p => p.phase === 'overload');
    if (overloadPoints.length === 0) return 50;
    
    const maxCpu = Math.max(...overloadPoints.map(p => p.metrics.cpuUsage));
    const maxMemory = Math.max(...overloadPoints.map(p => p.metrics.memoryUsage));
    
    let score = 100;
    if (maxCpu > 95) score -= 30;
    else if (maxCpu > 90) score -= 20;
    else if (maxCpu > 80) score -= 10;
    
    if (maxMemory > 95) score -= 30;
    else if (maxMemory > 90) score -= 20;
    else if (maxMemory > 80) score -= 10;
    
    return Math.max(20, score);
  }

  private generateRecommendations(pattern: string, bottlenecks: string[], resilience: any): string[] {
    const recommendations: string[] = [];

    // Pattern-based recommendations
    switch (pattern) {
      case 'failed':
        recommendations.push('CRITICAL: System failed to recover from overload');
        recommendations.push('Implement circuit breakers and bulkheads to isolate failures');
        recommendations.push('Add auto-scaling capabilities to handle load spikes');
        break;
      
      case 'oscillating':
        recommendations.push('System shows unstable recovery pattern');
        recommendations.push('Implement exponential backoff for retries');
        recommendations.push('Add request rate limiting to prevent thundering herd');
        break;
      
      case 'gradual':
        recommendations.push('Consider optimizing recovery procedures for faster restoration');
        recommendations.push('Implement progressive load shedding during recovery');
        break;
    }

    // Bottleneck-based recommendations
    if (bottlenecks.includes('CPU saturation')) {
      recommendations.push('Optimize CPU-intensive operations or add more compute resources');
      recommendations.push('Implement request prioritization to handle critical operations first');
    }

    if (bottlenecks.includes('Memory pressure')) {
      recommendations.push('Investigate memory leaks and optimize memory usage');
      recommendations.push('Implement memory-based admission control');
    }

    if (bottlenecks.includes('Request queue overflow')) {
      recommendations.push('Implement adaptive queue sizing with backpressure');
      recommendations.push('Add queue overflow handling with graceful degradation');
    }

    // Resilience score-based recommendations
    if (resilience.score < 50) {
      recommendations.push('Overall system resilience is poor - consider architectural review');
      recommendations.push('Implement comprehensive monitoring and alerting for early detection');
    } else if (resilience.score < 70) {
      recommendations.push('System resilience needs improvement in key areas');
    }

    if (resilience.factors.recoverySpeed < 60) {
      recommendations.push('Improve recovery speed with faster detection and response mechanisms');
    }

    if (resilience.factors.errorHandling < 60) {
      recommendations.push('Enhance error handling with proper retry logic and fallback mechanisms');
    }

    // General recommendations
    recommendations.push(`Set overload threshold at ${Math.floor(this.config.overloadConfig.peakUsers * 0.7)} concurrent users`);
    recommendations.push('Implement health checks with automatic recovery triggers');
    recommendations.push('Create runbooks for different failure scenarios');

    return recommendations;
  }

  private async wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async stop(): Promise<void> {
    this.isRunning = false;
  }
}

interface BaselineMetrics {
  responseTime: number;
  throughput: number;
  errorRate: number;
  cpuUsage: number;
  memoryUsage: number;
}