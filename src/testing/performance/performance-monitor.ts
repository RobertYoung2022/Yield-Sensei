/**
 * Performance Monitor
 * Real-time monitoring and measurement utilities for performance testing
 */

import { EventEmitter } from 'events';
import { performance } from 'perf_hooks';
import { Logger } from 'winston';
import { createLogger, format, transports } from 'winston';

export interface MetricPoint {
  timestamp: number;
  value: number;
  tags?: Record<string, string>;
}

export interface ResponseTimeMetric {
  timestamp: number;
  duration: number;
  endpoint?: string;
  method?: string;
  status?: number;
  success: boolean;
}

export interface ResourceMetric {
  timestamp: number;
  cpu: {
    user: number;
    system: number;
    total: number;
  };
  memory: {
    used: number;
    total: number;
    free: number;
    heap: {
      used: number;
      total: number;
    };
  };
  io?: {
    readBytes: number;
    writeBytes: number;
  };
}

export interface ThroughputMetric {
  timestamp: number;
  period: number; // measurement period in ms
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  requestsPerSecond: number;
  errorsPerSecond: number;
}

export interface PerformanceSnapshot {
  timestamp: number;
  responseTime: {
    current: number;
    average: number;
    median: number;
    p95: number;
    p99: number;
    min: number;
    max: number;
  };
  throughput: {
    requestsPerSecond: number;
    errorsPerSecond: number;
    totalRequests: number;
    errorRate: number;
  };
  resources: {
    cpuUsage: number;
    memoryUsage: number;
    memoryUsagePercent: number;
  };
}

export class PerformanceMonitor extends EventEmitter {
  private logger: Logger;
  private isMonitoring = false;
  private startTime: number = 0;
  private monitoringInterval?: NodeJS.Timeout;
  
  // Metric storage
  private responseTimeHistory: ResponseTimeMetric[] = [];
  private resourceHistory: ResourceMetric[] = [];
  private throughputHistory: ThroughputMetric[] = [];
  
  // Current period tracking
  private currentPeriodRequests = 0;
  private currentPeriodErrors = 0;
  private lastThroughputMeasurement = 0;
  
  // Configuration
  private readonly maxHistorySize = 10000;
  private readonly measurementInterval = 1000; // 1 second

  constructor() {
    super();
    this.logger = createLogger({
      level: 'info',
      format: format.combine(
        format.timestamp(),
        format.simple()
      ),
      transports: [
        new transports.Console(),
        new transports.File({ filename: 'logs/performance-monitor.log' })
      ],
    });
  }

  startMonitoring(): void {
    if (this.isMonitoring) {
      this.logger.warn('Performance monitoring already active');
      return;
    }

    this.logger.info('Starting performance monitoring');
    this.isMonitoring = true;
    this.startTime = performance.now();
    this.lastThroughputMeasurement = Date.now();

    // Start periodic resource monitoring
    this.monitoringInterval = setInterval(() => {
      this.collectResourceMetrics();
      this.collectThroughputMetrics();
    }, this.measurementInterval);

    this.emit('monitoringStarted');
  }

  stopMonitoring(): void {
    if (!this.isMonitoring) return;

    this.logger.info('Stopping performance monitoring');
    this.isMonitoring = false;

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }

    this.emit('monitoringStopped');
  }

  recordResponseTime(metric: ResponseTimeMetric): void {
    if (!this.isMonitoring) return;

    this.responseTimeHistory.push(metric);
    
    // Track request counts for throughput calculation
    this.currentPeriodRequests++;
    if (!metric.success) {
      this.currentPeriodErrors++;
    }

    // Maintain history size limit
    if (this.responseTimeHistory.length > this.maxHistorySize) {
      this.responseTimeHistory.shift();
    }

    this.emit('responseTimeRecorded', metric);
  }

  private collectResourceMetrics(): void {
    const timestamp = Date.now();
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    const metric: ResourceMetric = {
      timestamp,
      cpu: {
        user: cpuUsage.user / 1000000, // Convert microseconds to seconds
        system: cpuUsage.system / 1000000,
        total: (cpuUsage.user + cpuUsage.system) / 1000000,
      },
      memory: {
        used: memUsage.rss,
        total: memUsage.rss + memUsage.external,
        free: 0, // Not easily available in Node.js
        heap: {
          used: memUsage.heapUsed,
          total: memUsage.heapTotal,
        },
      },
    };

    this.resourceHistory.push(metric);

    // Maintain history size limit
    if (this.resourceHistory.length > this.maxHistorySize) {
      this.resourceHistory.shift();
    }

    this.emit('resourceMetricCollected', metric);
  }

  private collectThroughputMetrics(): void {
    const now = Date.now();
    const period = now - this.lastThroughputMeasurement;
    
    if (period <= 0) return;

    const metric: ThroughputMetric = {
      timestamp: now,
      period,
      totalRequests: this.currentPeriodRequests,
      successfulRequests: this.currentPeriodRequests - this.currentPeriodErrors,
      failedRequests: this.currentPeriodErrors,
      requestsPerSecond: (this.currentPeriodRequests / period) * 1000,
      errorsPerSecond: (this.currentPeriodErrors / period) * 1000,
    };

    this.throughputHistory.push(metric);

    // Reset counters for next period
    this.currentPeriodRequests = 0;
    this.currentPeriodErrors = 0;
    this.lastThroughputMeasurement = now;

    // Maintain history size limit
    if (this.throughputHistory.length > this.maxHistorySize) {
      this.throughputHistory.shift();
    }

    this.emit('throughputMetricCollected', metric);
  }

  getCurrentSnapshot(): PerformanceSnapshot {
    const now = Date.now();
    const recentResponseTimes = this.getRecentResponseTimes(30000); // Last 30 seconds
    const latestResource = this.resourceHistory[this.resourceHistory.length - 1];
    const latestThroughput = this.throughputHistory[this.throughputHistory.length - 1];

    // Calculate response time statistics
    const responseTimes = recentResponseTimes.map(r => r.duration).sort((a, b) => a - b);
    const responseTimeStats = this.calculateResponseTimeStats(responseTimes);

    // Calculate throughput statistics
    const totalRequests = this.responseTimeHistory.length;
    const totalErrors = this.responseTimeHistory.filter(r => !r.success).length;

    return {
      timestamp: now,
      responseTime: responseTimeStats,
      throughput: {
        requestsPerSecond: latestThroughput?.requestsPerSecond || 0,
        errorsPerSecond: latestThroughput?.errorsPerSecond || 0,
        totalRequests,
        errorRate: totalRequests > 0 ? (totalErrors / totalRequests) * 100 : 0,
      },
      resources: {
        cpuUsage: latestResource?.cpu.total || 0,
        memoryUsage: latestResource?.memory.heap.used || 0,
        memoryUsagePercent: latestResource 
          ? (latestResource.memory.heap.used / latestResource.memory.heap.total) * 100 
          : 0,
      },
    };
  }

  private calculateResponseTimeStats(responseTimes: number[]) {
    if (responseTimes.length === 0) {
      return {
        current: 0,
        average: 0,
        median: 0,
        p95: 0,
        p99: 0,
        min: 0,
        max: 0,
      };
    }

    const sum = responseTimes.reduce((a, b) => a + b, 0);
    const average = sum / responseTimes.length;
    const median = this.calculatePercentile(responseTimes, 50);
    const p95 = this.calculatePercentile(responseTimes, 95);
    const p99 = this.calculatePercentile(responseTimes, 99);

    return {
      current: responseTimes[responseTimes.length - 1] || 0,
      average,
      median,
      p95,
      p99,
      min: responseTimes[0] || 0,
      max: responseTimes[responseTimes.length - 1] || 0,
    };
  }

  private calculatePercentile(sortedArray: number[], percentile: number): number {
    if (sortedArray.length === 0) return 0;
    
    const index = (percentile / 100) * (sortedArray.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    
    if (lower === upper) {
      return sortedArray[lower] || 0;
    }
    
    const weight = index - lower;
    return ((sortedArray[lower] || 0) * (1 - weight)) + ((sortedArray[upper] || 0) * weight);
  }

  getRecentResponseTimes(windowMs: number): ResponseTimeMetric[] {
    const cutoff = Date.now() - windowMs;
    return this.responseTimeHistory.filter(r => r.timestamp >= cutoff);
  }

  getRecentResourceMetrics(windowMs: number): ResourceMetric[] {
    const cutoff = Date.now() - windowMs;
    return this.resourceHistory.filter(r => r.timestamp >= cutoff);
  }

  getRecentThroughputMetrics(windowMs: number): ThroughputMetric[] {
    const cutoff = Date.now() - windowMs;
    return this.throughputHistory.filter(r => r.timestamp >= cutoff);
  }

  getMetricsSummary() {
    const snapshot = this.getCurrentSnapshot();
    const totalDuration = Date.now() - this.startTime;

    return {
      testDuration: totalDuration,
      totalRequests: this.responseTimeHistory.length,
      successfulRequests: this.responseTimeHistory.filter(r => r.success).length,
      failedRequests: this.responseTimeHistory.filter(r => !r.success).length,
      averageRPS: (this.responseTimeHistory.length / totalDuration) * 1000,
      currentSnapshot: snapshot,
      dataPoints: {
        responseTime: this.responseTimeHistory.length,
        resources: this.resourceHistory.length,
        throughput: this.throughputHistory.length,
      },
    };
  }

  reset(): void {
    this.logger.info('Resetting performance monitor data');
    this.responseTimeHistory = [];
    this.resourceHistory = [];
    this.throughputHistory = [];
    this.currentPeriodRequests = 0;
    this.currentPeriodErrors = 0;
    this.startTime = performance.now();
    this.lastThroughputMeasurement = Date.now();
    this.emit('dataReset');
  }

  exportMetrics(): {
    responseTime: ResponseTimeMetric[];
    resources: ResourceMetric[];
    throughput: ThroughputMetric[];
  } {
    return {
      responseTime: [...this.responseTimeHistory],
      resources: [...this.resourceHistory],
      throughput: [...this.throughputHistory],
    };
  }

  isActive(): boolean {
    return this.isMonitoring;
  }
}

// Export singleton instance
export const performanceMonitor = new PerformanceMonitor();