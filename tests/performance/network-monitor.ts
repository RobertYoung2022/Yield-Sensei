import { EventEmitter } from 'events';
import * as http from 'http';
import * as https from 'https';
import * as net from 'net';

export interface NetworkStats {
  timestamp: number;
  connections: ConnectionStats;
  requests: RequestStats;
  bandwidth: BandwidthStats;
  errors: ErrorStats;
}

export interface ConnectionStats {
  active: number;
  established: number;
  pending: number;
  closed: number;
  timedOut: number;
  refused: number;
}

export interface RequestStats {
  total: number;
  successful: number;
  failed: number;
  pending: number;
  averageLatency: number;
  p50Latency: number;
  p95Latency: number;
  p99Latency: number;
}

export interface BandwidthStats {
  bytesReceived: number;
  bytesSent: number;
  packetsReceived: number;
  packetsSent: number;
  throughputIn: number;
  throughputOut: number;
}

export interface ErrorStats {
  connectionErrors: number;
  timeoutErrors: number;
  protocolErrors: number;
  dnsErrors: number;
}

export interface NetworkMonitorConfig {
  sampleInterval: number;
  latencyBuckets: number[];
  connectionPoolSize: number;
  timeout: number;
}

export class NetworkMonitor extends EventEmitter {
  private config: NetworkMonitorConfig;
  private stats: NetworkStats[] = [];
  private activeConnections: Map<string, ConnectionInfo> = new Map();
  private requestLatencies: number[] = [];
  private bandwidthBaseline: BandwidthStats;
  private intervalId?: NodeJS.Timeout;

  constructor(config: Partial<NetworkMonitorConfig> = {}) {
    super();
    this.config = {
      sampleInterval: 1000,
      latencyBuckets: [10, 25, 50, 100, 250, 500, 1000, 2500, 5000],
      connectionPoolSize: 100,
      timeout: 30000,
      ...config
    };
    this.bandwidthBaseline = this.createBandwidthStats();
  }

  start(): void {
    if (this.intervalId) {
      return;
    }

    this.intervalId = setInterval(() => {
      const stats = this.collectStats();
      this.stats.push(stats);
      this.emit('stats', stats);
      this.cleanOldStats();
    }, this.config.sampleInterval);

    this.interceptNetworkCalls();
    this.emit('started');
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
    this.restoreNetworkCalls();
    this.emit('stopped');
  }

  private collectStats(): NetworkStats {
    return {
      timestamp: Date.now(),
      connections: this.getConnectionStats(),
      requests: this.getRequestStats(),
      bandwidth: this.getBandwidthStats(),
      errors: this.getErrorStats()
    };
  }

  private getConnectionStats(): ConnectionStats {
    let active = 0;
    let established = 0;
    let pending = 0;
    let closed = 0;
    let timedOut = 0;
    let refused = 0;

    this.activeConnections.forEach(conn => {
      switch (conn.state) {
        case 'active':
          active++;
          break;
        case 'established':
          established++;
          break;
        case 'pending':
          pending++;
          break;
        case 'closed':
          closed++;
          break;
        case 'timeout':
          timedOut++;
          break;
        case 'refused':
          refused++;
          break;
      }
    });

    return { active, established, pending, closed, timedOut, refused };
  }

  private getRequestStats(): RequestStats {
    const latencies = [...this.requestLatencies];
    this.requestLatencies = []; // Reset for next interval

    if (latencies.length === 0) {
      return {
        total: 0,
        successful: 0,
        failed: 0,
        pending: 0,
        averageLatency: 0,
        p50Latency: 0,
        p95Latency: 0,
        p99Latency: 0
      };
    }

    latencies.sort((a, b) => a - b);
    const total = latencies.length;
    const successful = latencies.filter(l => l > 0).length;
    const failed = total - successful;
    const pending = Array.from(this.activeConnections.values())
      .filter(c => c.state === 'pending').length;

    const average = latencies.reduce((sum, l) => sum + l, 0) / total;
    const p50 = this.percentile(latencies, 0.5);
    const p95 = this.percentile(latencies, 0.95);
    const p99 = this.percentile(latencies, 0.99);

    return {
      total,
      successful,
      failed,
      pending,
      averageLatency: average,
      p50Latency: p50,
      p95Latency: p95,
      p99Latency: p99
    };
  }

  private getBandwidthStats(): BandwidthStats {
    // In a real implementation, this would hook into system network interfaces
    // For now, we'll simulate with request/response sizes
    const current = this.createBandwidthStats();
    
    return {
      ...current,
      throughputIn: current.bytesReceived - this.bandwidthBaseline.bytesReceived,
      throughputOut: current.bytesSent - this.bandwidthBaseline.bytesSent
    };
  }

  private getErrorStats(): ErrorStats {
    let connectionErrors = 0;
    let timeoutErrors = 0;
    let protocolErrors = 0;
    let dnsErrors = 0;

    this.activeConnections.forEach(conn => {
      if (conn.error) {
        switch (conn.error.type) {
          case 'connection':
            connectionErrors++;
            break;
          case 'timeout':
            timeoutErrors++;
            break;
          case 'protocol':
            protocolErrors++;
            break;
          case 'dns':
            dnsErrors++;
            break;
        }
      }
    });

    return { connectionErrors, timeoutErrors, protocolErrors, dnsErrors };
  }

  private createBandwidthStats(): BandwidthStats {
    return {
      bytesReceived: 0,
      bytesSent: 0,
      packetsReceived: 0,
      packetsSent: 0,
      throughputIn: 0,
      throughputOut: 0
    };
  }

  private percentile(sorted: number[], p: number): number {
    const index = Math.ceil(sorted.length * p) - 1;
    return sorted[Math.max(0, Math.min(index, sorted.length - 1))];
  }

  private interceptNetworkCalls(): void {
    // Intercept HTTP/HTTPS requests
    this.interceptModule(http);
    this.interceptModule(https);
    
    // Monitor socket connections
    this.monitorSockets();
  }

  private interceptModule(module: typeof http | typeof https): void {
    const original = module.request;
    const self = this;

    (module as any).request = function(...args: any[]): http.ClientRequest {
      const req = original.apply(this, args);
      const startTime = Date.now();
      const connId = `${Date.now()}-${Math.random()}`;

      self.activeConnections.set(connId, {
        id: connId,
        startTime,
        state: 'pending',
        protocol: module === https ? 'https' : 'http'
      });

      req.on('response', (res: http.IncomingMessage) => {
        const latency = Date.now() - startTime;
        self.requestLatencies.push(latency);
        
        const conn = self.activeConnections.get(connId);
        if (conn) {
          conn.state = 'established';
          conn.responseCode = res.statusCode;
        }

        res.on('end', () => {
          self.activeConnections.delete(connId);
        });
      });

      req.on('error', (error: Error) => {
        const conn = self.activeConnections.get(connId);
        if (conn) {
          conn.state = 'failed';
          conn.error = self.categorizeError(error);
        }
      });

      req.on('timeout', () => {
        const conn = self.activeConnections.get(connId);
        if (conn) {
          conn.state = 'timeout';
          conn.error = { type: 'timeout', message: 'Request timeout' };
        }
      });

      return req;
    };
  }

  private monitorSockets(): void {
    const originalConnect = net.Socket.prototype.connect;
    const self = this;

    net.Socket.prototype.connect = function(...args: any[]): net.Socket {
      const socket = originalConnect.apply(this, args);
      const connId = `socket-${Date.now()}-${Math.random()}`;

      self.activeConnections.set(connId, {
        id: connId,
        startTime: Date.now(),
        state: 'pending',
        protocol: 'tcp'
      });

      socket.on('connect', () => {
        const conn = self.activeConnections.get(connId);
        if (conn) {
          conn.state = 'established';
        }
      });

      socket.on('error', (error: Error) => {
        const conn = self.activeConnections.get(connId);
        if (conn) {
          conn.error = self.categorizeError(error);
        }
      });

      socket.on('close', () => {
        self.activeConnections.delete(connId);
      });

      return socket;
    };
  }

  private restoreNetworkCalls(): void {
    // In a real implementation, we would restore the original methods
    // This is simplified for demonstration
  }

  private categorizeError(error: Error): ErrorInfo {
    const message = error.message.toLowerCase();
    
    if (message.includes('econnrefused')) {
      return { type: 'connection', message: 'Connection refused' };
    } else if (message.includes('etimedout')) {
      return { type: 'timeout', message: 'Connection timeout' };
    } else if (message.includes('enotfound')) {
      return { type: 'dns', message: 'DNS resolution failed' };
    } else {
      return { type: 'protocol', message: error.message };
    }
  }

  private cleanOldStats(): void {
    const cutoffTime = Date.now() - 3600000; // Keep 1 hour of stats
    this.stats = this.stats.filter(s => s.timestamp > cutoffTime);
  }

  getStats(duration?: number): NetworkStats[] {
    if (!duration) {
      return [...this.stats];
    }

    const cutoffTime = Date.now() - duration;
    return this.stats.filter(s => s.timestamp > cutoffTime);
  }

  getLatencyHistogram(): Map<number, number> {
    const histogram = new Map<number, number>();
    
    this.config.latencyBuckets.forEach(bucket => {
      histogram.set(bucket, 0);
    });

    this.requestLatencies.forEach(latency => {
      for (const bucket of this.config.latencyBuckets) {
        if (latency <= bucket) {
          histogram.set(bucket, (histogram.get(bucket) || 0) + 1);
          break;
        }
      }
    });

    return histogram;
  }

  generateReport(): NetworkReport {
    const stats = this.getStats();
    const recentStats = this.getStats(60000); // Last minute

    return {
      timestamp: new Date().toISOString(),
      duration: stats.length > 0 ? Date.now() - stats[0].timestamp : 0,
      summary: {
        totalRequests: stats.reduce((sum, s) => sum + s.requests.total, 0),
        successRate: this.calculateSuccessRate(stats),
        averageLatency: this.calculateAverageLatency(stats),
        peakConnections: Math.max(...stats.map(s => s.connections.active)),
        totalErrors: stats.reduce((sum, s) => 
          sum + s.errors.connectionErrors + 
          s.errors.timeoutErrors + 
          s.errors.protocolErrors + 
          s.errors.dnsErrors, 0
        )
      },
      recent: {
        requestsPerSecond: this.calculateRequestRate(recentStats),
        latencyTrend: this.calculateLatencyTrend(recentStats),
        errorRate: this.calculateErrorRate(recentStats)
      },
      latencyHistogram: Object.fromEntries(this.getLatencyHistogram())
    };
  }

  private calculateSuccessRate(stats: NetworkStats[]): number {
    const total = stats.reduce((sum, s) => sum + s.requests.total, 0);
    const successful = stats.reduce((sum, s) => sum + s.requests.successful, 0);
    return total > 0 ? (successful / total) * 100 : 0;
  }

  private calculateAverageLatency(stats: NetworkStats[]): number {
    const latencies = stats.map(s => s.requests.averageLatency).filter(l => l > 0);
    return latencies.length > 0 
      ? latencies.reduce((sum, l) => sum + l, 0) / latencies.length 
      : 0;
  }

  private calculateRequestRate(stats: NetworkStats[]): number {
    if (stats.length < 2) return 0;
    
    const duration = (stats[stats.length - 1].timestamp - stats[0].timestamp) / 1000;
    const totalRequests = stats.reduce((sum, s) => sum + s.requests.total, 0);
    
    return duration > 0 ? totalRequests / duration : 0;
  }

  private calculateLatencyTrend(stats: NetworkStats[]): 'improving' | 'stable' | 'degrading' {
    if (stats.length < 10) return 'stable';
    
    const firstHalf = stats.slice(0, Math.floor(stats.length / 2));
    const secondHalf = stats.slice(Math.floor(stats.length / 2));
    
    const firstAvg = this.calculateAverageLatency(firstHalf);
    const secondAvg = this.calculateAverageLatency(secondHalf);
    
    const change = ((secondAvg - firstAvg) / firstAvg) * 100;
    
    if (change < -10) return 'improving';
    if (change > 10) return 'degrading';
    return 'stable';
  }

  private calculateErrorRate(stats: NetworkStats[]): number {
    const totalRequests = stats.reduce((sum, s) => sum + s.requests.total, 0);
    const totalErrors = stats.reduce((sum, s) => sum + s.requests.failed, 0);
    
    return totalRequests > 0 ? (totalErrors / totalRequests) * 100 : 0;
  }
}

interface ConnectionInfo {
  id: string;
  startTime: number;
  state: 'pending' | 'established' | 'failed' | 'closed' | 'timeout' | 'refused';
  protocol: string;
  responseCode?: number;
  error?: ErrorInfo;
}

interface ErrorInfo {
  type: 'connection' | 'timeout' | 'protocol' | 'dns';
  message: string;
}

interface NetworkReport {
  timestamp: string;
  duration: number;
  summary: {
    totalRequests: number;
    successRate: number;
    averageLatency: number;
    peakConnections: number;
    totalErrors: number;
  };
  recent: {
    requestsPerSecond: number;
    latencyTrend: 'improving' | 'stable' | 'degrading';
    errorRate: number;
  };
  latencyHistogram: Record<number, number>;
}