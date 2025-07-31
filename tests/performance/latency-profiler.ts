/**
 * Advanced Latency Profiler for Sage Satellite
 * Detailed latency measurement and analysis across all system components
 */

import { EventEmitter } from 'events';
import { performance, PerformanceObserver } from 'perf_hooks';
import * as os from 'os';

/**
 * Latency Measurement Configuration
 */
export interface LatencyProfilerConfig {
  measurementInterval: number; // milliseconds
  retentionPeriod: number; // milliseconds
  percentiles: number[]; // e.g., [0.5, 0.9, 0.95, 0.99]
  enableDetailedTracing: boolean;
  enableComponentBreakdown: boolean;
  enableResourceCorrelation: boolean;
  warmupRequests: number;
}

/**
 * Latency Measurement Point
 */
export interface LatencyMeasurement {
  id: string;
  timestamp: Date;
  component: string;
  operation: string;
  latency: number; // milliseconds
  success: boolean;
  error?: string;
  metadata?: Record<string, any>;
  breakdown?: {
    preparation: number;
    execution: number;
    postProcessing: number;
  };
  resourceSnapshot?: {
    cpu: number;
    memory: number;
    networkLatency?: number;
  };
}

/**
 * Latency Statistics
 */
export interface LatencyStats {
  component: string;
  operation: string;
  timeWindow: {
    start: Date;
    end: Date;
    duration: number;
  };
  sampleCount: number;
  latency: {
    min: number;
    max: number;
    mean: number;
    median: number;
    stdDev: number;
    percentiles: Record<string, number>; // P50, P90, P95, P99, etc.
  };
  throughput: {
    requestsPerSecond: number;
    successRate: number;
    errorRate: number;
  };
  distribution: {
    buckets: LatencyBucket[];
    histogram: number[];
  };
  trends: {
    trend: 'improving' | 'degrading' | 'stable';
    changeRate: number; // percentage change
    confidence: number;
  };
}

/**
 * Latency Bucket for Distribution Analysis
 */
interface LatencyBucket {
  range: { min: number; max: number };
  count: number;
  percentage: number;
}

/**
 * Performance Regression Detection
 */
export interface RegressionAlert {
  timestamp: Date;
  component: string;
  operation: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  metric: string;
  baseline: number;
  current: number;
  changePercent: number;
  description: string;
  recommendation: string;
}

/**
 * Advanced Latency Profiler
 */
export class LatencyProfiler extends EventEmitter {
  private config: LatencyProfilerConfig;
  private measurements: Map<string, LatencyMeasurement[]> = new Map();
  private activeTraces: Map<string, { start: number; component: string; operation: string; metadata?: any }> = new Map();
  private performanceObserver?: PerformanceObserver;
  private isRunning: boolean = false;
  private analysisInterval?: NodeJS.Timeout;
  private baselineStats: Map<string, LatencyStats> = new Map();

  constructor(config: LatencyProfilerConfig) {
    super();
    this.config = config;
    this.setupPerformanceObserver();
  }

  /**
   * Start latency profiling
   */
  async startProfiling(): Promise<void> {
    if (this.isRunning) {
      throw new Error('Latency profiler is already running');
    }

    console.log('📊 Starting latency profiling...');
    this.isRunning = true;

    // Clear previous measurements
    this.measurements.clear();
    this.activeTraces.clear();

    // Start performance observer
    if (this.performanceObserver) {
      this.performanceObserver.observe({ entryTypes: ['measure', 'mark'] });
    }

    // Start analysis interval
    this.analysisInterval = setInterval(() => {
      this.performPeriodicAnalysis();
    }, this.config.measurementInterval);

    console.log('✅ Latency profiling started');
  }

  /**
   * Stop latency profiling
   */
  async stopProfiling(): Promise<LatencyStats[]> {
    if (!this.isRunning) {
      return [];
    }

    console.log('🛑 Stopping latency profiling...');
    this.isRunning = false;

    // Stop performance observer
    if (this.performanceObserver) {
      this.performanceObserver.disconnect();
    }

    // Stop analysis interval
    if (this.analysisInterval) {
      clearInterval(this.analysisInterval);
    }

    // Generate final analysis
    const finalStats = this.generateComprehensiveStats();

    console.log('✅ Latency profiling stopped');
    return finalStats;
  }

  /**
   * Start measuring latency for an operation
   */
  startMeasurement(component: string, operation: string, metadata?: any): string {
    const traceId = `${component}-${operation}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    this.activeTraces.set(traceId, {
      start: performance.now(),
      component,
      operation,
      metadata
    });

    // Create performance mark if detailed tracing is enabled
    if (this.config.enableDetailedTracing) {
      performance.mark(`${traceId}-start`);
    }

    return traceId;
  }

  /**
   * End measurement and record latency
   */
  endMeasurement(traceId: string, success: boolean = true, error?: string): LatencyMeasurement | null {
    const trace = this.activeTraces.get(traceId);
    if (!trace) {
      console.warn(`No active trace found for ID: ${traceId}`);
      return null;
    }

    const endTime = performance.now();
    const latency = endTime - trace.start;

    // Create performance mark if detailed tracing is enabled
    if (this.config.enableDetailedTracing) {
      performance.mark(`${traceId}-end`);
      performance.measure(`${traceId}-total`, `${traceId}-start`, `${traceId}-end`);
    }

    const measurement: LatencyMeasurement = {
      id: traceId,
      timestamp: new Date(),
      component: trace.component,
      operation: trace.operation,
      latency,
      success,
      error,
      metadata: trace.metadata
    };

    // Add resource snapshot if enabled
    if (this.config.enableResourceCorrelation) {
      measurement.resourceSnapshot = this.captureResourceSnapshot();
    }

    // Add component breakdown if enabled
    if (this.config.enableComponentBreakdown) {
      measurement.breakdown = this.analyzeComponentBreakdown(traceId);
    }

    // Store measurement
    this.storeMeasurement(measurement);

    // Clean up trace
    this.activeTraces.delete(traceId);

    return measurement;
  }

  /**
   * Add a completed measurement directly
   */
  addMeasurement(measurement: LatencyMeasurement): void {
    this.storeMeasurement(measurement);
  }

  /**
   * Get latency statistics for a component/operation
   */
  getLatencyStats(component: string, operation?: string, timeWindow?: number): LatencyStats[] {
    const key = operation ? `${component}:${operation}` : component;
    const measurements = this.measurements.get(key) || [];
    
    // Filter by time window if specified
    const cutoffTime = timeWindow ? Date.now() - timeWindow : 0;
    const filteredMeasurements = measurements.filter(m => m.timestamp.getTime() > cutoffTime);
    
    if (filteredMeasurements.length === 0) {
      return [];
    }

    return [this.calculateStats(component, operation || 'all', filteredMeasurements)];
  }

  /**
   * Get all latency statistics
   */
  getAllLatencyStats(): LatencyStats[] {
    const allStats: LatencyStats[] = [];
    
    for (const [key, measurements] of this.measurements) {
      const [component, operation] = key.split(':');
      if (measurements.length > 0) {
        allStats.push(this.calculateStats(component, operation, measurements));
      }
    }
    
    return allStats;
  }

  /**
   * Detect performance regressions
   */
  detectRegressions(): RegressionAlert[] {
    const alerts: RegressionAlert[] = [];
    const currentStats = this.getAllLatencyStats();
    
    for (const current of currentStats) {
      const baselineKey = `${current.component}:${current.operation}`;
      const baseline = this.baselineStats.get(baselineKey);
      
      if (!baseline) continue;
      
      // Check for latency regressions
      const latencyRegression = this.checkLatencyRegression(baseline, current);
      if (latencyRegression) {
        alerts.push(latencyRegression);
      }
      
      // Check for throughput regressions
      const throughputRegression = this.checkThroughputRegression(baseline, current);
      if (throughputRegression) {
        alerts.push(throughputRegression);
      }
    }
    
    return alerts;
  }

  /**
   * Set baseline statistics for regression detection
   */
  setBaseline(): void {
    console.log('📏 Setting performance baseline...');
    const stats = this.getAllLatencyStats();
    
    this.baselineStats.clear();
    for (const stat of stats) {
      const key = `${stat.component}:${stat.operation}`;
      this.baselineStats.set(key, { ...stat });
    }
    
    console.log(`✅ Baseline set with ${stats.length} component operations`);
  }

  /**
   * Setup performance observer for detailed tracing
   */
  private setupPerformanceObserver(): void {
    if (!this.config.enableDetailedTracing) return;

    this.performanceObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      for (const entry of entries) {
        this.emit('performance_entry', {
          name: entry.name,
          duration: entry.duration,
          startTime: entry.startTime,
          entryType: entry.entryType
        });
      }
    });
  }

  /**
   * Store measurement in appropriate bucket
   */
  private storeMeasurement(measurement: LatencyMeasurement): void {
    const key = `${measurement.component}:${measurement.operation}`;
    
    if (!this.measurements.has(key)) {
      this.measurements.set(key, []);
    }
    
    const measurements = this.measurements.get(key)!;
    measurements.push(measurement);
    
    // Cleanup old measurements based on retention period
    const cutoffTime = Date.now() - this.config.retentionPeriod;
    const filtered = measurements.filter(m => m.timestamp.getTime() > cutoffTime);
    this.measurements.set(key, filtered);
    
    // Emit measurement event
    this.emit('measurement', measurement);
  }

  /**
   * Capture current resource snapshot
   */
  private captureResourceSnapshot(): LatencyMeasurement['resourceSnapshot'] {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    return {
      cpu: this.calculateCpuPercent(cpuUsage),
      memory: (memUsage.rss / memUsage.heapTotal) * 100
    };
  }

  /**
   * Calculate CPU percentage (simplified)
   */
  private calculateCpuPercent(cpuUsage: NodeJS.CpuUsage): number {
    // Simplified CPU calculation
    return Math.min(100, (cpuUsage.user + cpuUsage.system) / 1000000 / os.cpus().length * 100);
  }

  /**
   * Analyze component breakdown from performance marks
   */
  private analyzeComponentBreakdown(traceId: string): LatencyMeasurement['breakdown'] {
    if (!this.config.enableDetailedTracing) return undefined;

    // This would analyze performance marks to break down latency
    // Simplified implementation
    return {
      preparation: Math.random() * 10,  // Mock data
      execution: Math.random() * 50,
      postProcessing: Math.random() * 5
    };
  }

  /**
   * Perform periodic analysis
   */
  private performPeriodicAnalysis(): void {
    // Check for regression alerts
    const alerts = this.detectRegressions();
    if (alerts.length > 0) {
      this.emit('regression_alerts', alerts);
    }

    // Emit current statistics
    const stats = this.getAllLatencyStats();
    this.emit('latency_stats', stats);

    // Cleanup old performance entries
    if (this.config.enableDetailedTracing) {
      performance.clearMarks();
      performance.clearMeasures();
    }
  }

  /**
   * Calculate latency statistics from measurements
   */
  private calculateStats(component: string, operation: string, measurements: LatencyMeasurement[]): LatencyStats {
    if (measurements.length === 0) {
      throw new Error('Cannot calculate stats from empty measurements');
    }

    // Sort by latency for percentile calculations
    const latencies = measurements.map(m => m.latency).sort((a, b) => a - b);
    const successful = measurements.filter(m => m.success);
    
    // Calculate basic statistics
    const min = latencies[0];
    const max = latencies[latencies.length - 1];
    const mean = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    const median = this.percentile(latencies, 0.5);
    
    // Calculate standard deviation
    const variance = latencies.reduce((sum, latency) => sum + Math.pow(latency - mean, 2), 0) / latencies.length;
    const stdDev = Math.sqrt(variance);
    
    // Calculate percentiles
    const percentiles: Record<string, number> = {};
    for (const p of this.config.percentiles) {
      const key = `P${Math.round(p * 100)}`;
      percentiles[key] = this.percentile(latencies, p);
    }
    
    // Calculate time window
    const timestamps = measurements.map(m => m.timestamp.getTime());
    const minTime = Math.min(...timestamps);
    const maxTime = Math.max(...timestamps);
    
    // Calculate distribution
    const distribution = this.calculateDistribution(latencies);
    
    // Calculate trends
    const trends = this.calculateTrends(measurements);
    
    return {
      component,
      operation,
      timeWindow: {
        start: new Date(minTime),
        end: new Date(maxTime),
        duration: maxTime - minTime
      },
      sampleCount: measurements.length,
      latency: {
        min,
        max,
        mean,
        median,
        stdDev,
        percentiles
      },
      throughput: {
        requestsPerSecond: measurements.length / ((maxTime - minTime) / 1000),
        successRate: successful.length / measurements.length,
        errorRate: (measurements.length - successful.length) / measurements.length
      },
      distribution,
      trends
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
   * Calculate latency distribution
   */
  private calculateDistribution(latencies: number[]): LatencyStats['distribution'] {
    const min = Math.min(...latencies);
    const max = Math.max(...latencies);
    const range = max - min;
    const bucketCount = 10;
    const bucketSize = range / bucketCount;
    
    const buckets: LatencyBucket[] = [];
    const histogram: number[] = new Array(bucketCount).fill(0);
    
    // Create buckets
    for (let i = 0; i < bucketCount; i++) {
      const bucketMin = min + (i * bucketSize);
      const bucketMax = i === bucketCount - 1 ? max : bucketMin + bucketSize;
      
      const count = latencies.filter(l => l >= bucketMin && l < bucketMax).length;
      const percentage = (count / latencies.length) * 100;
      
      buckets.push({
        range: { min: bucketMin, max: bucketMax },
        count,
        percentage
      });
      
      histogram[i] = count;
    }
    
    return { buckets, histogram };
  }

  /**
   * Calculate performance trends
   */
  private calculateTrends(measurements: LatencyMeasurement[]): LatencyStats['trends'] {
    if (measurements.length < 10) {
      return { trend: 'stable', changeRate: 0, confidence: 0 };
    }
    
    // Sort by timestamp
    const sorted = [...measurements].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    
    // Split into two halves for comparison
    const midpoint = Math.floor(sorted.length / 2);
    const firstHalf = sorted.slice(0, midpoint);
    const secondHalf = sorted.slice(midpoint);
    
    // Calculate average latency for each half
    const firstAvg = firstHalf.reduce((sum, m) => sum + m.latency, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, m) => sum + m.latency, 0) / secondHalf.length;
    
    // Calculate change rate
    const changeRate = ((secondAvg - firstAvg) / firstAvg) * 100;
    
    // Determine trend
    let trend: 'improving' | 'degrading' | 'stable';
    if (Math.abs(changeRate) < 5) {
      trend = 'stable';
    } else if (changeRate < 0) {
      trend = 'improving'; // Lower latency is better
    } else {
      trend = 'degrading';
    }
    
    // Calculate confidence based on sample size and consistency
    const confidence = Math.min(100, (measurements.length / 100) * 100);
    
    return { trend, changeRate, confidence };
  }

  /**
   * Check for latency regressions
   */
  private checkLatencyRegression(baseline: LatencyStats, current: LatencyStats): RegressionAlert | null {
    const p95Threshold = 20; // 20% increase in P95 latency
    const baselineP95 = baseline.latency.percentiles['P95'];
    const currentP95 = current.latency.percentiles['P95'];
    
    if (!baselineP95 || !currentP95) return null;
    
    const changePercent = ((currentP95 - baselineP95) / baselineP95) * 100;
    
    if (changePercent > p95Threshold) {
      return {
        timestamp: new Date(),
        component: current.component,
        operation: current.operation,
        severity: changePercent > 50 ? 'critical' : changePercent > 30 ? 'high' : 'medium',
        metric: 'P95 Latency',
        baseline: baselineP95,
        current: currentP95,
        changePercent,
        description: `P95 latency increased by ${changePercent.toFixed(1)}% from ${baselineP95.toFixed(1)}ms to ${currentP95.toFixed(1)}ms`,
        recommendation: 'Investigate recent changes, check resource utilization, and consider performance optimizations'
      };
    }
    
    return null;
  }

  /**
   * Check for throughput regressions
   */
  private checkThroughputRegression(baseline: LatencyStats, current: LatencyStats): RegressionAlert | null {
    const throughputThreshold = 15; // 15% decrease in throughput
    const changePercent = ((current.throughput.requestsPerSecond - baseline.throughput.requestsPerSecond) / baseline.throughput.requestsPerSecond) * 100;
    
    if (changePercent < -throughputThreshold) {
      return {
        timestamp: new Date(),
        component: current.component,
        operation: current.operation,
        severity: changePercent < -30 ? 'critical' : changePercent < -25 ? 'high' : 'medium',
        metric: 'Throughput',
        baseline: baseline.throughput.requestsPerSecond,
        current: current.throughput.requestsPerSecond,
        changePercent,
        description: `Throughput decreased by ${Math.abs(changePercent).toFixed(1)}% from ${baseline.throughput.requestsPerSecond.toFixed(1)} to ${current.throughput.requestsPerSecond.toFixed(1)} RPS`,
        recommendation: 'Check for resource bottlenecks, review recent deployments, and analyze concurrent user load'
      };
    }
    
    return null;
  }

  /**
   * Generate comprehensive statistics report
   */
  private generateComprehensiveStats(): LatencyStats[] {
    return this.getAllLatencyStats();
  }
}

/**
 * Default configuration for latency profiler
 */
export const DefaultLatencyProfilerConfig: LatencyProfilerConfig = {
  measurementInterval: 5000, // 5 seconds
  retentionPeriod: 3600000, // 1 hour
  percentiles: [0.5, 0.9, 0.95, 0.99, 0.999],
  enableDetailedTracing: true,
  enableComponentBreakdown: true,
  enableResourceCorrelation: true,
  warmupRequests: 100
};

export { LatencyProfiler, LatencyProfilerConfig, LatencyMeasurement, LatencyStats, RegressionAlert };