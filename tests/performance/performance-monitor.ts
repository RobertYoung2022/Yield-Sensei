import { EventEmitter } from 'events';
import { ResourceMonitor, ResourceMetrics } from './resource-monitor';
import { NetworkMonitor, NetworkStats } from './network-monitor';
import { performance, PerformanceObserver } from 'perf_hooks';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface PerformanceMetrics {
  timestamp: number;
  resource: ResourceMetrics;
  network: NetworkStats;
  application: ApplicationMetrics;
  custom: Map<string, number>;
}

export interface ApplicationMetrics {
  responseTime: ResponseTimeMetrics;
  throughput: ThroughputMetrics;
  errors: ErrorMetrics;
  saturation: SaturationMetrics;
}

export interface ResponseTimeMetrics {
  min: number;
  max: number;
  mean: number;
  median: number;
  p95: number;
  p99: number;
  standardDeviation: number;
}

export interface ThroughputMetrics {
  requestsPerSecond: number;
  bytesPerSecond: number;
  successfulRequests: number;
  failedRequests: number;
}

export interface ErrorMetrics {
  rate: number;
  total: number;
  byType: Map<string, number>;
  byStatusCode: Map<number, number>;
}

export interface SaturationMetrics {
  queueDepth: number;
  activeRequests: number;
  waitTime: number;
  rejectedRequests: number;
}

export interface PerformanceMonitorConfig {
  resourceMonitor?: ResourceMonitor;
  networkMonitor?: NetworkMonitor;
  metricsInterval: number;
  outputDir: string;
  enablePerfHooks: boolean;
  customMetrics: string[];
}

export class PerformanceMonitor extends EventEmitter {
  private config: PerformanceMonitorConfig;
  private resourceMonitor: ResourceMonitor;
  private networkMonitor: NetworkMonitor;
  private metrics: PerformanceMetrics[] = [];
  private perfObserver?: PerformanceObserver;
  private customMetrics: Map<string, number[]> = new Map();
  private applicationMetrics: ApplicationMetricsCollector;
  private intervalId?: NodeJS.Timeout;
  private isRunning: boolean = false;

  constructor(config: Partial<PerformanceMonitorConfig> = {}) {
    super();
    this.config = {
      metricsInterval: 1000,
      outputDir: './performance-reports',
      enablePerfHooks: true,
      customMetrics: [],
      ...config
    };

    this.resourceMonitor = config.resourceMonitor || new ResourceMonitor();
    this.networkMonitor = config.networkMonitor || new NetworkMonitor();
    this.applicationMetrics = new ApplicationMetricsCollector();

    this.setupCustomMetrics();
    if (this.config.enablePerfHooks) {
      this.setupPerformanceObserver();
    }
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;
    
    // Start sub-monitors
    this.resourceMonitor.start();
    this.networkMonitor.start();

    // Create output directory
    await this.ensureOutputDirectory();

    // Start metrics collection
    this.intervalId = setInterval(() => {
      this.collectMetrics();
    }, this.config.metricsInterval);

    this.emit('started');
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;

    // Stop metrics collection
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }

    // Stop sub-monitors
    this.resourceMonitor.stop();
    this.networkMonitor.stop();

    // Stop performance observer
    if (this.perfObserver) {
      this.perfObserver.disconnect();
    }

    // Generate final report
    await this.generateReport();

    this.emit('stopped');
  }

  private setupCustomMetrics(): void {
    this.config.customMetrics.forEach(metric => {
      this.customMetrics.set(metric, []);
    });
  }

  private setupPerformanceObserver(): void {
    this.perfObserver = new PerformanceObserver((items) => {
      items.getEntries().forEach((entry) => {
        if (entry.entryType === 'measure') {
          this.applicationMetrics.recordMeasure(entry.name, entry.duration);
        }
      });
    });

    this.perfObserver.observe({ 
      entryTypes: ['measure', 'mark', 'resource', 'navigation'] 
    });
  }

  private collectMetrics(): void {
    const resourceMetrics = this.resourceMonitor.getMetrics(1)[0] || this.createEmptyResourceMetrics();
    const networkStats = this.networkMonitor.getStats(1)[0] || this.createEmptyNetworkStats();
    
    const metrics: PerformanceMetrics = {
      timestamp: Date.now(),
      resource: resourceMetrics,
      network: networkStats,
      application: this.applicationMetrics.getMetrics(),
      custom: new Map(this.customMetrics)
    };

    this.metrics.push(metrics);
    this.emit('metrics', metrics);
    
    // Check for anomalies
    this.detectAnomalies(metrics);
  }

  private createEmptyResourceMetrics(): ResourceMetrics {
    return {
      timestamp: Date.now(),
      cpu: { usage: 0, loadAverage: [0, 0, 0], cores: 1 },
      memory: {
        total: 0, used: 0, free: 0, percentUsed: 0,
        heapUsed: 0, heapTotal: 0, external: 0, arrayBuffers: 0
      },
      network: {
        bytesReceived: 0, bytesSent: 0,
        packetsReceived: 0, packetsSent: 0,
        activeConnections: 0
      },
      process: {
        pid: process.pid,
        uptime: process.uptime(),
        cpuUsage: process.cpuUsage(),
        memoryUsage: process.memoryUsage(),
        handles: 0,
        requests: 0
      }
    };
  }

  private createEmptyNetworkStats(): NetworkStats {
    return {
      timestamp: Date.now(),
      connections: {
        active: 0, established: 0, pending: 0,
        closed: 0, timedOut: 0, refused: 0
      },
      requests: {
        total: 0, successful: 0, failed: 0, pending: 0,
        averageLatency: 0, p50Latency: 0, p95Latency: 0, p99Latency: 0
      },
      bandwidth: {
        bytesReceived: 0, bytesSent: 0,
        packetsReceived: 0, packetsSent: 0,
        throughputIn: 0, throughputOut: 0
      },
      errors: {
        connectionErrors: 0, timeoutErrors: 0,
        protocolErrors: 0, dnsErrors: 0
      }
    };
  }

  private detectAnomalies(metrics: PerformanceMetrics): void {
    // CPU anomaly detection
    if (metrics.resource.cpu.usage > 90) {
      this.emit('anomaly', {
        type: 'cpu',
        severity: 'high',
        value: metrics.resource.cpu.usage,
        threshold: 90,
        message: `CPU usage critically high: ${metrics.resource.cpu.usage.toFixed(2)}%`
      });
    }

    // Memory anomaly detection
    if (metrics.resource.memory.percentUsed > 85) {
      this.emit('anomaly', {
        type: 'memory',
        severity: 'high',
        value: metrics.resource.memory.percentUsed,
        threshold: 85,
        message: `Memory usage high: ${metrics.resource.memory.percentUsed.toFixed(2)}%`
      });
    }

    // Network latency anomaly
    if (metrics.network.requests.p99Latency > 5000) {
      this.emit('anomaly', {
        type: 'latency',
        severity: 'medium',
        value: metrics.network.requests.p99Latency,
        threshold: 5000,
        message: `P99 latency exceeds 5s: ${metrics.network.requests.p99Latency}ms`
      });
    }

    // Error rate anomaly
    if (metrics.application.errors.rate > 5) {
      this.emit('anomaly', {
        type: 'errors',
        severity: 'high',
        value: metrics.application.errors.rate,
        threshold: 5,
        message: `Error rate high: ${metrics.application.errors.rate.toFixed(2)}%`
      });
    }
  }

  recordCustomMetric(name: string, value: number): void {
    const values = this.customMetrics.get(name);
    if (values) {
      values.push(value);
      if (values.length > 1000) {
        values.shift(); // Keep only last 1000 values
      }
    }
  }

  mark(name: string): void {
    performance.mark(name);
  }

  measure(name: string, startMark: string, endMark?: string): void {
    if (endMark) {
      performance.measure(name, startMark, endMark);
    } else {
      performance.measure(name, startMark);
    }
  }

  private async ensureOutputDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.config.outputDir, { recursive: true });
    } catch (error) {
      console.error('Failed to create output directory:', error);
    }
  }

  async generateReport(): Promise<string> {
    const report = {
      timestamp: new Date().toISOString(),
      duration: this.metrics.length > 0 
        ? this.metrics[this.metrics.length - 1].timestamp - this.metrics[0].timestamp 
        : 0,
      summary: this.generateSummary(),
      resourceMetrics: this.summarizeResourceMetrics(),
      networkMetrics: this.summarizeNetworkMetrics(),
      applicationMetrics: this.summarizeApplicationMetrics(),
      customMetrics: this.summarizeCustomMetrics(),
      anomalies: this.getAnomalies()
    };

    const filename = `performance-report-${Date.now()}.json`;
    const filepath = path.join(this.config.outputDir, filename);
    
    await fs.writeFile(filepath, JSON.stringify(report, null, 2));
    
    this.emit('report-generated', filepath);
    return filepath;
  }

  private generateSummary(): any {
    if (this.metrics.length === 0) {
      return { message: 'No metrics collected' };
    }

    const avgCPU = this.metrics.reduce((sum, m) => sum + m.resource.cpu.usage, 0) / this.metrics.length;
    const avgMemory = this.metrics.reduce((sum, m) => sum + m.resource.memory.percentUsed, 0) / this.metrics.length;
    const totalRequests = this.metrics.reduce((sum, m) => sum + m.network.requests.total, 0);
    const avgLatency = this.metrics.reduce((sum, m) => sum + m.network.requests.averageLatency, 0) / this.metrics.length;

    return {
      averageCPU: avgCPU.toFixed(2) + '%',
      averageMemory: avgMemory.toFixed(2) + '%',
      totalRequests,
      averageLatency: avgLatency.toFixed(2) + 'ms',
      duration: this.formatDuration(this.metrics[this.metrics.length - 1].timestamp - this.metrics[0].timestamp)
    };
  }

  private summarizeResourceMetrics(): any {
    const cpuValues = this.metrics.map(m => m.resource.cpu.usage);
    const memoryValues = this.metrics.map(m => m.resource.memory.percentUsed);

    return {
      cpu: {
        min: Math.min(...cpuValues).toFixed(2) + '%',
        max: Math.max(...cpuValues).toFixed(2) + '%',
        average: (cpuValues.reduce((a, b) => a + b, 0) / cpuValues.length).toFixed(2) + '%'
      },
      memory: {
        min: Math.min(...memoryValues).toFixed(2) + '%',
        max: Math.max(...memoryValues).toFixed(2) + '%',
        average: (memoryValues.reduce((a, b) => a + b, 0) / memoryValues.length).toFixed(2) + '%'
      }
    };
  }

  private summarizeNetworkMetrics(): any {
    const latencies = this.metrics.map(m => m.network.requests.averageLatency);
    const throughput = this.metrics.map(m => m.network.requests.total);

    return {
      latency: {
        min: Math.min(...latencies).toFixed(2) + 'ms',
        max: Math.max(...latencies).toFixed(2) + 'ms',
        average: (latencies.reduce((a, b) => a + b, 0) / latencies.length).toFixed(2) + 'ms'
      },
      throughput: {
        total: throughput.reduce((a, b) => a + b, 0),
        average: (throughput.reduce((a, b) => a + b, 0) / throughput.length).toFixed(2) + ' req/interval'
      }
    };
  }

  private summarizeApplicationMetrics(): any {
    return this.applicationMetrics.getSummary();
  }

  private summarizeCustomMetrics(): any {
    const summary: any = {};
    
    this.customMetrics.forEach((values, name) => {
      if (values.length > 0) {
        summary[name] = {
          count: values.length,
          min: Math.min(...values),
          max: Math.max(...values),
          average: values.reduce((a, b) => a + b, 0) / values.length
        };
      }
    });

    return summary;
  }

  private getAnomalies(): any[] {
    // In a real implementation, this would track anomalies over time
    return [];
  }

  private formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }

  getMetrics(duration?: number): PerformanceMetrics[] {
    if (!duration) {
      return [...this.metrics];
    }

    const cutoffTime = Date.now() - duration;
    return this.metrics.filter(m => m.timestamp > cutoffTime);
  }

  reset(): void {
    this.metrics = [];
    this.customMetrics.forEach(values => values.length = 0);
    this.applicationMetrics.reset();
    this.resourceMonitor.reset();
  }
}

class ApplicationMetricsCollector {
  private responseTimes: number[] = [];
  private requests = { successful: 0, failed: 0 };
  private errors: Map<string, number> = new Map();
  private statusCodes: Map<number, number> = new Map();
  private queueDepth: number = 0;
  private activeRequests: number = 0;
  private measures: Map<string, number[]> = new Map();

  recordResponseTime(time: number): void {
    this.responseTimes.push(time);
    if (this.responseTimes.length > 10000) {
      this.responseTimes.shift();
    }
  }

  recordRequest(successful: boolean, statusCode?: number): void {
    if (successful) {
      this.requests.successful++;
    } else {
      this.requests.failed++;
    }

    if (statusCode) {
      this.statusCodes.set(statusCode, (this.statusCodes.get(statusCode) || 0) + 1);
    }
  }

  recordError(type: string): void {
    this.errors.set(type, (this.errors.get(type) || 0) + 1);
  }

  recordMeasure(name: string, duration: number): void {
    if (!this.measures.has(name)) {
      this.measures.set(name, []);
    }
    const values = this.measures.get(name)!;
    values.push(duration);
    if (values.length > 1000) {
      values.shift();
    }
  }

  setQueueDepth(depth: number): void {
    this.queueDepth = depth;
  }

  setActiveRequests(count: number): void {
    this.activeRequests = count;
  }

  getMetrics(): ApplicationMetrics {
    return {
      responseTime: this.calculateResponseTimeMetrics(),
      throughput: this.calculateThroughputMetrics(),
      errors: this.calculateErrorMetrics(),
      saturation: this.calculateSaturationMetrics()
    };
  }

  private calculateResponseTimeMetrics(): ResponseTimeMetrics {
    if (this.responseTimes.length === 0) {
      return {
        min: 0, max: 0, mean: 0, median: 0,
        p95: 0, p99: 0, standardDeviation: 0
      };
    }

    const sorted = [...this.responseTimes].sort((a, b) => a - b);
    const sum = sorted.reduce((a, b) => a + b, 0);
    const mean = sum / sorted.length;

    const variance = sorted.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / sorted.length;
    const standardDeviation = Math.sqrt(variance);

    return {
      min: sorted[0],
      max: sorted[sorted.length - 1],
      mean,
      median: sorted[Math.floor(sorted.length / 2)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)],
      standardDeviation
    };
  }

  private calculateThroughputMetrics(): ThroughputMetrics {
    const total = this.requests.successful + this.requests.failed;
    return {
      requestsPerSecond: total, // This would be calculated based on time window
      bytesPerSecond: 0, // Would need to track request/response sizes
      successfulRequests: this.requests.successful,
      failedRequests: this.requests.failed
    };
  }

  private calculateErrorMetrics(): ErrorMetrics {
    const total = Array.from(this.errors.values()).reduce((a, b) => a + b, 0);
    const requestTotal = this.requests.successful + this.requests.failed;
    
    return {
      rate: requestTotal > 0 ? (this.requests.failed / requestTotal) * 100 : 0,
      total,
      byType: new Map(this.errors),
      byStatusCode: new Map(this.statusCodes)
    };
  }

  private calculateSaturationMetrics(): SaturationMetrics {
    return {
      queueDepth: this.queueDepth,
      activeRequests: this.activeRequests,
      waitTime: 0, // Would need to track queue wait times
      rejectedRequests: 0 // Would need to track rejected requests
    };
  }

  getSummary(): any {
    const metrics = this.getMetrics();
    return {
      responseTime: {
        p50: metrics.responseTime.median.toFixed(2) + 'ms',
        p95: metrics.responseTime.p95.toFixed(2) + 'ms',
        p99: metrics.responseTime.p99.toFixed(2) + 'ms'
      },
      throughput: {
        total: metrics.throughput.successfulRequests + metrics.throughput.failedRequests,
        successRate: metrics.throughput.successfulRequests > 0
          ? ((metrics.throughput.successfulRequests / (metrics.throughput.successfulRequests + metrics.throughput.failedRequests)) * 100).toFixed(2) + '%'
          : '0%'
      },
      errors: {
        rate: metrics.errors.rate.toFixed(2) + '%',
        total: metrics.errors.total
      }
    };
  }

  reset(): void {
    this.responseTimes = [];
    this.requests = { successful: 0, failed: 0 };
    this.errors.clear();
    this.statusCodes.clear();
    this.measures.clear();
    this.queueDepth = 0;
    this.activeRequests = 0;
  }
}