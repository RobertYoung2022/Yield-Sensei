import os from 'os';
import { EventEmitter } from 'events';
import { performance } from 'perf_hooks';

export interface ResourceMetrics {
  timestamp: number;
  cpu: CPUMetrics;
  memory: MemoryMetrics;
  network: NetworkMetrics;
  process: ProcessMetrics;
}

export interface CPUMetrics {
  usage: number;
  loadAverage: number[];
  cores: number;
  temperature?: number;
}

export interface MemoryMetrics {
  total: number;
  used: number;
  free: number;
  percentUsed: number;
  heapUsed: number;
  heapTotal: number;
  external: number;
  arrayBuffers: number;
}

export interface NetworkMetrics {
  bytesReceived: number;
  bytesSent: number;
  packetsReceived: number;
  packetsSent: number;
  activeConnections: number;
  latency?: number;
}

export interface ProcessMetrics {
  pid: number;
  uptime: number;
  cpuUsage: NodeJS.CpuUsage;
  memoryUsage: NodeJS.MemoryUsage;
  handles: number;
  requests: number;
}

export interface MonitoringConfig {
  interval: number;
  retentionPeriod: number;
  thresholds: {
    cpu: number;
    memory: number;
    responseTime: number;
  };
}

export class ResourceMonitor extends EventEmitter {
  private config: MonitoringConfig;
  private metrics: ResourceMetrics[] = [];
  private intervalId?: NodeJS.Timeout;
  private startTime: number;
  private previousCPUUsage: NodeJS.CpuUsage;
  private networkBaseline: NetworkMetrics;

  constructor(config: Partial<MonitoringConfig> = {}) {
    super();
    this.config = {
      interval: 1000,
      retentionPeriod: 3600000, // 1 hour
      thresholds: {
        cpu: 80,
        memory: 90,
        responseTime: 1000
      },
      ...config
    };
    this.startTime = Date.now();
    this.previousCPUUsage = process.cpuUsage();
    this.networkBaseline = this.getNetworkMetrics();
  }

  start(): void {
    if (this.intervalId) {
      return;
    }

    this.intervalId = setInterval(() => {
      const metrics = this.collectMetrics();
      this.metrics.push(metrics);
      this.checkThresholds(metrics);
      this.cleanOldMetrics();
      this.emit('metrics', metrics);
    }, this.config.interval);

    this.emit('started');
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
      this.emit('stopped');
    }
  }

  private collectMetrics(): ResourceMetrics {
    return {
      timestamp: Date.now(),
      cpu: this.getCPUMetrics(),
      memory: this.getMemoryMetrics(),
      network: this.getNetworkMetrics(),
      process: this.getProcessMetrics()
    };
  }

  private getCPUMetrics(): CPUMetrics {
    const cpus = os.cpus();
    const loadAverage = os.loadavg();

    // Calculate CPU usage
    const currentCPUUsage = process.cpuUsage();
    const userDiff = currentCPUUsage.user - this.previousCPUUsage.user;
    const systemDiff = currentCPUUsage.system - this.previousCPUUsage.system;
    const totalDiff = userDiff + systemDiff;
    const timeDiff = this.config.interval * 1000; // Convert to microseconds
    const usage = (totalDiff / timeDiff) * 100;

    this.previousCPUUsage = currentCPUUsage;

    return {
      usage: Math.min(usage, 100),
      loadAverage,
      cores: cpus.length,
      temperature: this.getCPUTemperature()
    };
  }

  private getMemoryMetrics(): MemoryMetrics {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const memUsage = process.memoryUsage();

    return {
      total: totalMem,
      used: usedMem,
      free: freeMem,
      percentUsed: (usedMem / totalMem) * 100,
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      external: memUsage.external,
      arrayBuffers: memUsage.arrayBuffers
    };
  }

  private getNetworkMetrics(): NetworkMetrics {
    // This is a simplified version - in production, you'd use system-specific tools
    // or libraries like systeminformation for accurate network metrics
    return {
      bytesReceived: 0,
      bytesSent: 0,
      packetsReceived: 0,
      packetsSent: 0,
      activeConnections: 0,
      latency: undefined
    };
  }

  private getProcessMetrics(): ProcessMetrics {
    return {
      pid: process.pid,
      uptime: process.uptime(),
      cpuUsage: process.cpuUsage(),
      memoryUsage: process.memoryUsage(),
      handles: (process as any)._getActiveHandles?.().length || 0,
      requests: (process as any)._getActiveRequests?.().length || 0
    };
  }

  private getCPUTemperature(): number | undefined {
    // CPU temperature reading is platform-specific
    // This would require platform-specific implementations
    return undefined;
  }

  private checkThresholds(metrics: ResourceMetrics): void {
    if (metrics.cpu.usage > this.config.thresholds.cpu) {
      this.emit('threshold-exceeded', {
        type: 'cpu',
        value: metrics.cpu.usage,
        threshold: this.config.thresholds.cpu
      });
    }

    if (metrics.memory.percentUsed > this.config.thresholds.memory) {
      this.emit('threshold-exceeded', {
        type: 'memory',
        value: metrics.memory.percentUsed,
        threshold: this.config.thresholds.memory
      });
    }
  }

  private cleanOldMetrics(): void {
    const cutoffTime = Date.now() - this.config.retentionPeriod;
    this.metrics = this.metrics.filter(m => m.timestamp > cutoffTime);
  }

  getMetrics(duration?: number): ResourceMetrics[] {
    if (!duration) {
      return [...this.metrics];
    }

    const cutoffTime = Date.now() - duration;
    return this.metrics.filter(m => m.timestamp > cutoffTime);
  }

  getAverageMetrics(duration: number): Partial<ResourceMetrics> | null {
    const metrics = this.getMetrics(duration);
    if (metrics.length === 0) {
      return null;
    }

    const avgCPU = metrics.reduce((sum, m) => sum + m.cpu.usage, 0) / metrics.length;
    const avgMemory = metrics.reduce((sum, m) => sum + m.memory.percentUsed, 0) / metrics.length;

    return {
      cpu: { usage: avgCPU } as CPUMetrics,
      memory: { percentUsed: avgMemory } as MemoryMetrics
    };
  }

  getPeakMetrics(duration: number): Partial<ResourceMetrics> | null {
    const metrics = this.getMetrics(duration);
    if (metrics.length === 0) {
      return null;
    }

    const peakCPU = Math.max(...metrics.map(m => m.cpu.usage));
    const peakMemory = Math.max(...metrics.map(m => m.memory.percentUsed));

    return {
      cpu: { usage: peakCPU } as CPUMetrics,
      memory: { percentUsed: peakMemory } as MemoryMetrics
    };
  }

  reset(): void {
    this.metrics = [];
    this.previousCPUUsage = process.cpuUsage();
    this.networkBaseline = this.getNetworkMetrics();
  }

  toJSON(): any {
    return {
      config: this.config,
      metrics: this.metrics,
      summary: {
        duration: Date.now() - this.startTime,
        totalMetrics: this.metrics.length,
        average: this.getAverageMetrics(this.config.retentionPeriod),
        peak: this.getPeakMetrics(this.config.retentionPeriod)
      }
    };
  }
}

export class ResourceAggregator {
  private monitors: Map<string, ResourceMonitor> = new Map();

  addMonitor(name: string, monitor: ResourceMonitor): void {
    this.monitors.set(name, monitor);
  }

  removeMonitor(name: string): void {
    const monitor = this.monitors.get(name);
    if (monitor) {
      monitor.stop();
      this.monitors.delete(name);
    }
  }

  startAll(): void {
    this.monitors.forEach(monitor => monitor.start());
  }

  stopAll(): void {
    this.monitors.forEach(monitor => monitor.stop());
  }

  getAggregatedMetrics(duration: number): Map<string, Partial<ResourceMetrics> | null> {
    const results = new Map<string, Partial<ResourceMetrics> | null>();
    
    this.monitors.forEach((monitor, name) => {
      results.set(name, monitor.getAverageMetrics(duration));
    });

    return results;
  }

  generateReport(): any {
    const report: any = {
      timestamp: new Date().toISOString(),
      monitors: {}
    };

    this.monitors.forEach((monitor, name) => {
      report.monitors[name] = monitor.toJSON();
    });

    return report;
  }
}