/**
 * Throughput Load Generator for Sage Satellite
 * Advanced load generation with realistic request patterns and gradual scaling
 */

import { EventEmitter } from 'events';
import { Worker, isMainThread, parentPort, workerData } from 'worker_threads';
import { performance } from 'perf_hooks';

/**
 * Load Generation Configuration
 */
export interface LoadGeneratorConfig {
  name: string;
  duration: number; // milliseconds
  rampUp: {
    enabled: boolean;
    duration: number; // milliseconds
    startRPS: number;
    endRPS: number;
    pattern: 'linear' | 'exponential' | 'step' | 'sine';
  };
  steadyState: {
    duration: number; // milliseconds
    targetRPS: number;
    variance: number; // 0-1, RPS variance percentage
  };
  concurrency: {
    workers: number;
    maxConcurrentRequests: number;
    queueLimit: number;
  };
  requestMix: {
    protocolAnalysis: number; // percentage 0-100
    rwaScoring: number;
    complianceCheck: number;
    marketResearch: number;
  };
  errorInjection: {
    enabled: boolean;
    errorRate: number; // 0-1
    errorTypes: string[];
  };
}

/**
 * Load Generator Metrics
 */
export interface LoadGeneratorMetrics {
  timestamp: Date;
  elapsed: number;
  requests: {
    total: number;
    successful: number;
    failed: number;
    inProgress: number;
    queued: number;
  };
  throughput: {
    currentRPS: number;
    averageRPS: number;
    peakRPS: number;
    targetRPS: number;
  };
  latency: {
    min: number;
    max: number;
    p50: number;
    p95: number;
    p99: number;
    mean: number;
  };
  errors: {
    total: number;
    rate: number;
    byType: Record<string, number>;
  };
  workers: {
    active: number;
    total: number;
    utilization: number;
  };
}

/**
 * Request Result
 */
interface RequestResult {
  success: boolean;
  latency: number;
  error?: string;
  requestType: string;
  workerId: number;
}

/**
 * Advanced Throughput Load Generator
 */
export class ThroughputLoadGenerator extends EventEmitter {
  private config: LoadGeneratorConfig;
  private workers: Worker[] = [];
  private isRunning: boolean = false;
  private startTime: number = 0;
  private metrics: LoadGeneratorMetrics[] = [];
  private currentMetrics: LoadGeneratorMetrics;
  private metricsInterval?: NodeJS.Timeout;
  private loadControlInterval?: NodeJS.Timeout;
  
  // Request tracking
  private totalRequests: number = 0;
  private successfulRequests: number = 0;
  private failedRequests: number = 0;
  private requestLatencies: number[] = [];
  private errorCounts: Record<string, number> = {};
  private requestsInProgress: Set<string> = new Set();

  constructor(config: LoadGeneratorConfig) {
    super();
    this.config = config;
    this.currentMetrics = this.createEmptyMetrics();
  }

  /**
   * Start load generation
   */
  async startLoadGeneration(): Promise<void> {
    if (this.isRunning) {
      throw new Error('Load generator is already running');
    }

    console.log(`🚀 Starting throughput load generation: ${this.config.name}`);
    console.log(`Target: ${this.config.steadyState.targetRPS} RPS for ${this.config.duration / 1000}s`);
    
    this.isRunning = true;
    this.startTime = performance.now();
    this.resetMetrics();

    try {
      // Initialize worker pool
      await this.initializeWorkers();

      // Start metrics collection
      this.startMetricsCollection();

      // Start load control
      await this.startLoadControl();

      console.log('✅ Load generation completed successfully');
    } catch (error) {
      console.error('❌ Load generation failed:', error);
      throw error;
    } finally {
      await this.stopLoadGeneration();
    }
  }

  /**
   * Stop load generation
   */
  async stopLoadGeneration(): Promise<void> {
    if (!this.isRunning) return;

    console.log('🛑 Stopping load generation...');
    this.isRunning = false;

    // Stop intervals
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
    }
    if (this.loadControlInterval) {
      clearInterval(this.loadControlInterval);
    }

    // Terminate workers
    await Promise.all(this.workers.map(worker => {
      worker.terminate();
    }));
    this.workers = [];

    console.log('✅ Load generation stopped');
  }

  /**
   * Get current metrics
   */
  getCurrentMetrics(): LoadGeneratorMetrics {
    return { ...this.currentMetrics };
  }

  /**
   * Get all collected metrics
   */
  getAllMetrics(): LoadGeneratorMetrics[] {
    return [...this.metrics];
  }

  /**
   * Initialize worker pool
   */
  private async initializeWorkers(): Promise<void> {
    console.log(`🔧 Initializing ${this.config.concurrency.workers} workers...`);

    for (let i = 0; i < this.config.concurrency.workers; i++) {
      const worker = new Worker(__filename, {
        workerData: {
          workerId: i,
          config: this.config
        }
      });

      worker.on('message', (result: RequestResult) => {
        this.handleWorkerResult(result);
      });

      worker.on('error', (error) => {
        console.error(`Worker ${i} error:`, error);
      });

      this.workers.push(worker);
    }

    // Give workers time to initialize
    await this.sleep(1000);
    console.log('✅ Workers initialized');
  }

  /**
   * Start metrics collection
   */
  private startMetricsCollection(): void {
    this.metricsInterval = setInterval(() => {
      this.updateCurrentMetrics();
      this.metrics.push({ ...this.currentMetrics });
      this.emit('metrics', this.currentMetrics);
    }, 1000); // Collect metrics every second
  }

  /**
   * Start load control
   */
  private async startLoadControl(): Promise<void> {
    const phases = this.calculateLoadPhases();
    
    for (const phase of phases) {
      console.log(`📈 ${phase.name}: ${phase.targetRPS} RPS for ${phase.duration / 1000}s`);
      
      await this.executeLoadPhase(phase);
      
      if (!this.isRunning) break;
    }
  }

  /**
   * Calculate load phases based on configuration
   */
  private calculateLoadPhases(): LoadPhase[] {
    const phases: LoadPhase[] = [];

    // Ramp-up phase
    if (this.config.rampUp.enabled) {
      phases.push({
        name: 'Ramp-up',
        duration: this.config.rampUp.duration,
        startRPS: this.config.rampUp.startRPS,
        targetRPS: this.config.rampUp.endRPS,
        pattern: this.config.rampUp.pattern
      });
    }

    // Steady state phase
    phases.push({
      name: 'Steady State',
      duration: this.config.steadyState.duration,
      startRPS: this.config.rampUp.enabled ? this.config.rampUp.endRPS : this.config.steadyState.targetRPS,
      targetRPS: this.config.steadyState.targetRPS,
      pattern: 'linear'
    });

    return phases;
  }

  /**
   * Execute load phase
   */
  private async executeLoadPhase(phase: LoadPhase): Promise<void> {
    const startTime = performance.now();
    const endTime = startTime + phase.duration;
    
    let lastRequestTime = startTime;
    let requestCount = 0;

    while (performance.now() < endTime && this.isRunning) {
      const elapsed = performance.now() - startTime;
      const progress = elapsed / phase.duration;
      
      // Calculate current target RPS based on phase pattern
      const currentTargetRPS = this.calculateCurrentRPS(phase, progress);
      
      // Apply variance to target RPS
      const variance = (Math.random() - 0.5) * 2 * this.config.steadyState.variance;
      const actualTargetRPS = currentTargetRPS * (1 + variance);
      
      // Calculate request interval
      const requestInterval = 1000 / actualTargetRPS; // milliseconds between requests
      
      const now = performance.now();
      if (now - lastRequestTime >= requestInterval) {
        // Send request to available worker
        await this.sendRequestToWorker();
        lastRequestTime = now;
        requestCount++;
      }
      
      // Small yield to prevent busy waiting
      await this.sleep(1);
    }
  }

  /**
   * Calculate current RPS based on phase pattern
   */
  private calculateCurrentRPS(phase: LoadPhase, progress: number): number {
    const { startRPS, targetRPS, pattern } = phase;
    
    switch (pattern) {
      case 'linear':
        return startRPS + (targetRPS - startRPS) * progress;
      
      case 'exponential':
        return startRPS * Math.pow(targetRPS / startRPS, progress);
      
      case 'step':
        const steps = 5;
        const stepProgress = Math.floor(progress * steps) / steps;
        return startRPS + (targetRPS - startRPS) * stepProgress;
      
      case 'sine':
        const sineProgress = (Math.sin(progress * Math.PI - Math.PI / 2) + 1) / 2;
        return startRPS + (targetRPS - startRPS) * sineProgress;
      
      default:
        return targetRPS;
    }
  }

  /**
   * Send request to available worker
   */
  private async sendRequestToWorker(): Promise<void> {
    // Check queue limits
    if (this.requestsInProgress.size >= this.config.concurrency.maxConcurrentRequests) {
      return; // Skip request if at capacity
    }

    // Select request type based on mix
    const requestType = this.selectRequestType();
    
    // Select worker (round-robin)
    const workerId = this.totalRequests % this.workers.length;
    const worker = this.workers[workerId];
    
    if (worker) {
      const requestId = `req-${this.totalRequests++}`;
      this.requestsInProgress.add(requestId);
      
      worker.postMessage({
        requestId,
        requestType,
        timestamp: performance.now()
      });
    }
  }

  /**
   * Select request type based on configured mix
   */
  private selectRequestType(): string {
    const rand = Math.random() * 100;
    let cumulative = 0;
    
    const mix = this.config.requestMix;
    
    if ((cumulative += mix.protocolAnalysis) >= rand) return 'protocolAnalysis';
    if ((cumulative += mix.rwaScoring) >= rand) return 'rwaScoring';
    if ((cumulative += mix.complianceCheck) >= rand) return 'complianceCheck';
    if ((cumulative += mix.marketResearch) >= rand) return 'marketResearch';
    
    return 'protocolAnalysis'; // Default
  }

  /**
   * Handle worker result
   */
  private handleWorkerResult(result: RequestResult): void {
    // Remove from in-progress set
    this.requestsInProgress.delete(`req-${result.workerId}`);
    
    // Update counters
    if (result.success) {
      this.successfulRequests++;
      this.requestLatencies.push(result.latency);
      
      // Keep latency array manageable
      if (this.requestLatencies.length > 10000) {
        this.requestLatencies = this.requestLatencies.slice(-5000);
      }
    } else {
      this.failedRequests++;
      if (result.error) {
        this.errorCounts[result.error] = (this.errorCounts[result.error] || 0) + 1;
      }
    }
  }

  /**
   * Update current metrics
   */
  private updateCurrentMetrics(): void {
    const now = performance.now();
    const elapsed = now - this.startTime;
    const elapsedSeconds = elapsed / 1000;
    
    // Sort latencies for percentile calculations
    const sortedLatencies = [...this.requestLatencies].sort((a, b) => a - b);
    
    this.currentMetrics = {
      timestamp: new Date(),
      elapsed,
      requests: {
        total: this.totalRequests,
        successful: this.successfulRequests,
        failed: this.failedRequests,
        inProgress: this.requestsInProgress.size,
        queued: 0 // Simplified for now
      },
      throughput: {
        currentRPS: this.calculateCurrentRPS(elapsedSeconds),
        averageRPS: (this.successfulRequests + this.failedRequests) / elapsedSeconds,
        peakRPS: this.calculatePeakRPS(),
        targetRPS: this.config.steadyState.targetRPS
      },
      latency: {
        min: sortedLatencies[0] || 0,
        max: sortedLatencies[sortedLatencies.length - 1] || 0,
        p50: this.percentile(sortedLatencies, 0.5),
        p95: this.percentile(sortedLatencies, 0.95),
        p99: this.percentile(sortedLatencies, 0.99),
        mean: sortedLatencies.reduce((a, b) => a + b, 0) / sortedLatencies.length || 0
      },
      errors: {
        total: this.failedRequests,
        rate: this.failedRequests / (this.successfulRequests + this.failedRequests) || 0,
        byType: { ...this.errorCounts }
      },
      workers: {
        active: this.workers.length,
        total: this.config.concurrency.workers,
        utilization: this.requestsInProgress.size / this.config.concurrency.maxConcurrentRequests
      }
    };
  }

  /**
   * Calculate current RPS (requests per second in last interval)
   */
  private calculateCurrentRPS(elapsedSeconds: number): number {
    if (this.metrics.length < 2) return 0;
    
    const current = this.metrics[this.metrics.length - 1];
    const previous = this.metrics[this.metrics.length - 2];
    
    const requestsDelta = current.requests.total - previous.requests.total;
    const timeDelta = (current.timestamp.getTime() - previous.timestamp.getTime()) / 1000;
    
    return requestsDelta / timeDelta;
  }

  /**
   * Calculate peak RPS from metrics history
   */
  private calculatePeakRPS(): number {
    return Math.max(...this.metrics.map(m => m.throughput.currentRPS), 0);
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
   * Create empty metrics object
   */
  private createEmptyMetrics(): LoadGeneratorMetrics {
    return {
      timestamp: new Date(),
      elapsed: 0,
      requests: { total: 0, successful: 0, failed: 0, inProgress: 0, queued: 0 },
      throughput: { currentRPS: 0, averageRPS: 0, peakRPS: 0, targetRPS: 0 },
      latency: { min: 0, max: 0, p50: 0, p95: 0, p99: 0, mean: 0 },
      errors: { total: 0, rate: 0, byType: {} },
      workers: { active: 0, total: 0, utilization: 0 }
    };
  }

  /**
   * Reset metrics
   */
  private resetMetrics(): void {
    this.totalRequests = 0;
    this.successfulRequests = 0;
    this.failedRequests = 0;
    this.requestLatencies = [];
    this.errorCounts = {};
    this.requestsInProgress.clear();
    this.metrics = [];
    this.currentMetrics = this.createEmptyMetrics();
  }

  /**
   * Utility sleep function
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Load Phase Interface
 */
interface LoadPhase {
  name: string;
  duration: number;
  startRPS: number;
  targetRPS: number;
  pattern: 'linear' | 'exponential' | 'step' | 'sine';
}

/**
 * Worker thread execution (runs when not main thread)
 */
if (!isMainThread && parentPort) {
  const { workerId, config } = workerData;
  
  // Listen for requests from main thread
  parentPort.on('message', async (message) => {
    const { requestId, requestType, timestamp } = message;
    const startTime = performance.now();
    
    try {
      // Simulate different request types
      await simulateRequest(requestType, config.errorInjection);
      
      const latency = performance.now() - startTime;
      
      parentPort!.postMessage({
        success: true,
        latency,
        requestType,
        workerId
      });
      
    } catch (error) {
      const latency = performance.now() - startTime;
      
      parentPort!.postMessage({
        success: false,
        latency,
        error: error instanceof Error ? error.message : 'Unknown error',
        requestType,
        workerId
      });
    }
  });
}

/**
 * Simulate different request types in worker
 */
async function simulateRequest(
  requestType: string, 
  errorInjection: { enabled: boolean; errorRate: number; errorTypes: string[] }
): Promise<void> {
  // Inject errors if configured
  if (errorInjection.enabled && Math.random() < errorInjection.errorRate) {
    const errorType = errorInjection.errorTypes[
      Math.floor(Math.random() * errorInjection.errorTypes.length)
    ];
    throw new Error(errorType);
  }
  
  // Simulate different processing times based on request type
  let processingTime: number;
  
  switch (requestType) {
    case 'protocolAnalysis':
      // Simulate ML model inference - higher latency, more CPU intensive
      processingTime = 50 + Math.random() * 200; // 50-250ms
      break;
      
    case 'rwaScoring':
      // Simulate scoring calculations - moderate latency
      processingTime = 30 + Math.random() * 150; // 30-180ms
      break;
      
    case 'complianceCheck':
      // Simulate database lookups - low latency
      processingTime = 20 + Math.random() * 100; // 20-120ms
      break;
      
    case 'marketResearch':
      // Simulate external API calls - high latency, high variance
      processingTime = 200 + Math.random() * 800; // 200-1000ms
      break;
      
    default:
      processingTime = 50 + Math.random() * 100;
  }
  
  // Simulate processing with CPU work
  const endTime = performance.now() + processingTime;
  while (performance.now() < endTime) {
    // Simulate some CPU work
    Math.random();
  }
}

/**
 * Default configurations for different test scenarios
 */
export const ThroughputTestConfigs = {
  BASELINE: {
    name: 'Baseline Throughput Test',
    duration: 60000, // 1 minute
    rampUp: { enabled: false, duration: 0, startRPS: 1, endRPS: 5, pattern: 'linear' as const },
    steadyState: { duration: 60000, targetRPS: 5, variance: 0.1 },
    concurrency: { workers: 2, maxConcurrentRequests: 10, queueLimit: 50 },
    requestMix: { protocolAnalysis: 40, rwaScoring: 30, complianceCheck: 20, marketResearch: 10 },
    errorInjection: { enabled: false, errorRate: 0, errorTypes: [] }
  },

  MODERATE_LOAD: {
    name: 'Moderate Load Test',
    duration: 180000, // 3 minutes
    rampUp: { enabled: true, duration: 60000, startRPS: 1, endRPS: 50, pattern: 'linear' as const },
    steadyState: { duration: 120000, targetRPS: 50, variance: 0.2 },
    concurrency: { workers: 4, maxConcurrentRequests: 100, queueLimit: 200 },
    requestMix: { protocolAnalysis: 35, rwaScoring: 35, complianceCheck: 20, marketResearch: 10 },
    errorInjection: { enabled: true, errorRate: 0.01, errorTypes: ['timeout', 'connection_error'] }
  },

  HIGH_THROUGHPUT: {
    name: 'High Throughput Test',
    duration: 300000, // 5 minutes
    rampUp: { enabled: true, duration: 120000, startRPS: 10, endRPS: 200, pattern: 'exponential' as const },
    steadyState: { duration: 180000, targetRPS: 200, variance: 0.3 },
    concurrency: { workers: 8, maxConcurrentRequests: 500, queueLimit: 1000 },
    requestMix: { protocolAnalysis: 30, rwaScoring: 30, complianceCheck: 25, marketResearch: 15 },
    errorInjection: { enabled: true, errorRate: 0.02, errorTypes: ['timeout', 'rate_limit', 'server_error'] }
  },

  STRESS_TEST: {
    name: 'Stress Test',
    duration: 600000, // 10 minutes
    rampUp: { enabled: true, duration: 180000, startRPS: 50, endRPS: 500, pattern: 'step' as const },
    steadyState: { duration: 420000, targetRPS: 500, variance: 0.4 },
    concurrency: { workers: 16, maxConcurrentRequests: 1000, queueLimit: 2000 },
    requestMix: { protocolAnalysis: 25, rwaScoring: 25, complianceCheck: 25, marketResearch: 25 },
    errorInjection: { enabled: true, errorRate: 0.05, errorTypes: ['timeout', 'rate_limit', 'server_error', 'memory_error'] }
  }
};

export { ThroughputLoadGenerator, LoadGeneratorConfig, LoadGeneratorMetrics };