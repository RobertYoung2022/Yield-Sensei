import { describe, test, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { ResourceMonitor, PerformanceMonitor } from './performance-monitor';
import { NetworkMonitor } from './network-monitor';
import * as fs from 'fs/promises';
import * as path from 'path';

describe('Performance Testing Resource Monitoring', () => {
  let performanceMonitor: PerformanceMonitor;
  let resourceMonitor: ResourceMonitor;
  let networkMonitor: NetworkMonitor;

  beforeEach(() => {
    resourceMonitor = new ResourceMonitor({
      interval: 100, // Fast interval for testing
      thresholds: {
        cpu: 80,
        memory: 90,
        responseTime: 1000
      }
    });

    networkMonitor = new NetworkMonitor({
      sampleInterval: 100
    });

    performanceMonitor = new PerformanceMonitor({
      resourceMonitor,
      networkMonitor,
      metricsInterval: 100,
      outputDir: './test-performance-reports'
    });
  });

  afterEach(async () => {
    await performanceMonitor.stop();
    // Clean up test reports
    try {
      await fs.rm('./test-performance-reports', { recursive: true });
    } catch (error) {
      // Directory might not exist
    }
  });

  describe('Resource Monitor', () => {
    test('should collect CPU metrics', (done) => {
      resourceMonitor.once('metrics', (metrics) => {
        expect(metrics.cpu).toBeDefined();
        expect(metrics.cpu.usage).toBeGreaterThanOrEqual(0);
        expect(metrics.cpu.usage).toBeLessThanOrEqual(100);
        expect(metrics.cpu.loadAverage).toHaveLength(3);
        expect(metrics.cpu.cores).toBeGreaterThan(0);
        done();
      });

      resourceMonitor.start();
    });

    test('should collect memory metrics', (done) => {
      resourceMonitor.once('metrics', (metrics) => {
        expect(metrics.memory).toBeDefined();
        expect(metrics.memory.total).toBeGreaterThan(0);
        expect(metrics.memory.used).toBeGreaterThan(0);
        expect(metrics.memory.free).toBeGreaterThan(0);
        expect(metrics.memory.percentUsed).toBeGreaterThan(0);
        expect(metrics.memory.percentUsed).toBeLessThanOrEqual(100);
        done();
      });

      resourceMonitor.start();
    });

    test('should emit threshold exceeded events', (done) => {
      const monitor = new ResourceMonitor({
        interval: 100,
        thresholds: {
          cpu: 0, // Set to 0 to guarantee threshold exceeded
          memory: 0,
          responseTime: 1000
        }
      });

      monitor.once('threshold-exceeded', (event) => {
        expect(event.type).toBeDefined();
        expect(event.value).toBeGreaterThan(0);
        expect(event.threshold).toBeDefined();
        monitor.stop();
        done();
      });

      monitor.start();
    });

    test('should calculate average metrics', async () => {
      resourceMonitor.start();

      // Wait for some metrics to be collected
      await new Promise(resolve => setTimeout(resolve, 500));

      const avgMetrics = resourceMonitor.getAverageMetrics(1000);
      expect(avgMetrics).not.toBeNull();
      expect(avgMetrics?.cpu?.usage).toBeGreaterThanOrEqual(0);
      expect(avgMetrics?.memory?.percentUsed).toBeGreaterThanOrEqual(0);
    });

    test('should calculate peak metrics', async () => {
      resourceMonitor.start();

      // Wait for some metrics to be collected
      await new Promise(resolve => setTimeout(resolve, 500));

      const peakMetrics = resourceMonitor.getPeakMetrics(1000);
      expect(peakMetrics).not.toBeNull();
      expect(peakMetrics?.cpu?.usage).toBeGreaterThanOrEqual(0);
      expect(peakMetrics?.memory?.percentUsed).toBeGreaterThanOrEqual(0);
    });

    test('should clean old metrics', async () => {
      const monitor = new ResourceMonitor({
        interval: 50,
        retentionPeriod: 200 // Keep only 200ms of data
      });

      monitor.start();

      // Wait for metrics to accumulate
      await new Promise(resolve => setTimeout(resolve, 300));

      const metrics = monitor.getMetrics();
      const oldestTimestamp = metrics[0]?.timestamp || Date.now();
      const newestTimestamp = metrics[metrics.length - 1]?.timestamp || Date.now();

      expect(newestTimestamp - oldestTimestamp).toBeLessThanOrEqual(300);
      monitor.stop();
    });
  });

  describe('Network Monitor', () => {
    test('should collect network stats', (done) => {
      networkMonitor.once('stats', (stats) => {
        expect(stats.connections).toBeDefined();
        expect(stats.requests).toBeDefined();
        expect(stats.bandwidth).toBeDefined();
        expect(stats.errors).toBeDefined();
        done();
      });

      networkMonitor.start();
    });

    test('should track request latencies', async () => {
      networkMonitor.start();

      // Simulate some requests
      const http = require('http');
      const server = http.createServer((req: any, res: any) => {
        setTimeout(() => {
          res.writeHead(200);
          res.end('OK');
        }, 50);
      });

      await new Promise<void>(resolve => server.listen(0, resolve));
      const port = (server.address() as any).port;

      // Make a test request
      await new Promise<void>((resolve, reject) => {
        http.get(`http://localhost:${port}`, (res: any) => {
          res.on('data', () => {});
          res.on('end', resolve);
        }).on('error', reject);
      });

      await new Promise(resolve => setTimeout(resolve, 200));

      const stats = networkMonitor.getStats(1000);
      expect(stats.length).toBeGreaterThan(0);

      server.close();
    });

    test('should generate latency histogram', () => {
      networkMonitor.start();

      const histogram = networkMonitor.getLatencyHistogram();
      expect(histogram).toBeInstanceOf(Map);
      expect(histogram.size).toBeGreaterThan(0);
    });

    test('should generate network report', async () => {
      networkMonitor.start();

      await new Promise(resolve => setTimeout(resolve, 300));

      const report = networkMonitor.generateReport();
      expect(report.timestamp).toBeDefined();
      expect(report.summary).toBeDefined();
      expect(report.summary.totalRequests).toBeGreaterThanOrEqual(0);
      expect(report.summary.successRate).toBeGreaterThanOrEqual(0);
      expect(report.recent).toBeDefined();
      expect(report.latencyHistogram).toBeDefined();
    });
  });

  describe('Performance Monitor Integration', () => {
    test('should start and collect metrics', async () => {
      await performanceMonitor.start();

      await new Promise(resolve => setTimeout(resolve, 300));

      const metrics = performanceMonitor.getMetrics();
      expect(metrics.length).toBeGreaterThan(0);
      expect(metrics[0].resource).toBeDefined();
      expect(metrics[0].network).toBeDefined();
      expect(metrics[0].application).toBeDefined();
    });

    test('should detect anomalies', (done) => {
      performanceMonitor.once('anomaly', (anomaly) => {
        expect(anomaly.type).toBeDefined();
        expect(anomaly.severity).toBeDefined();
        expect(anomaly.value).toBeDefined();
        expect(anomaly.threshold).toBeDefined();
        expect(anomaly.message).toBeDefined();
        done();
      });

      // Create a monitor with very low thresholds to trigger anomalies
      const monitor = new PerformanceMonitor({
        resourceMonitor: new ResourceMonitor({
          interval: 100,
          thresholds: { cpu: 0, memory: 0, responseTime: 1 }
        }),
        networkMonitor: new NetworkMonitor({ sampleInterval: 100 })
      });

      monitor.start();
    });

    test('should record custom metrics', async () => {
      const monitor = new PerformanceMonitor({
        customMetrics: ['customMetric1', 'customMetric2']
      });

      await monitor.start();

      monitor.recordCustomMetric('customMetric1', 100);
      monitor.recordCustomMetric('customMetric1', 200);
      monitor.recordCustomMetric('customMetric2', 50);

      await new Promise(resolve => setTimeout(resolve, 200));

      await monitor.stop();
    });

    test('should use performance marks and measures', async () => {
      await performanceMonitor.start();

      performanceMonitor.mark('operation-start');
      await new Promise(resolve => setTimeout(resolve, 100));
      performanceMonitor.mark('operation-end');
      performanceMonitor.measure('operation-duration', 'operation-start', 'operation-end');

      await new Promise(resolve => setTimeout(resolve, 200));

      await performanceMonitor.stop();
    });

    test('should generate performance report', async () => {
      await performanceMonitor.start();

      // Collect some metrics
      await new Promise(resolve => setTimeout(resolve, 500));

      const reportPath = await performanceMonitor.generateReport();
      expect(reportPath).toBeDefined();

      // Verify report file exists
      const reportContent = await fs.readFile(reportPath, 'utf-8');
      const report = JSON.parse(reportContent);

      expect(report.timestamp).toBeDefined();
      expect(report.duration).toBeGreaterThan(0);
      expect(report.summary).toBeDefined();
      expect(report.resourceMetrics).toBeDefined();
      expect(report.networkMetrics).toBeDefined();
      expect(report.applicationMetrics).toBeDefined();
    });

    test('should emit events for monitoring lifecycle', async () => {
      const events: string[] = [];

      performanceMonitor.on('started', () => events.push('started'));
      performanceMonitor.on('stopped', () => events.push('stopped'));
      performanceMonitor.on('report-generated', () => events.push('report-generated'));

      await performanceMonitor.start();
      await new Promise(resolve => setTimeout(resolve, 200));
      await performanceMonitor.stop();

      expect(events).toContain('started');
      expect(events).toContain('stopped');
      expect(events).toContain('report-generated');
    });

    test('should reset metrics', async () => {
      await performanceMonitor.start();

      // Collect some metrics
      await new Promise(resolve => setTimeout(resolve, 300));

      let metrics = performanceMonitor.getMetrics();
      expect(metrics.length).toBeGreaterThan(0);

      performanceMonitor.reset();

      metrics = performanceMonitor.getMetrics();
      expect(metrics.length).toBe(0);
    });

    test('should handle resource aggregation', () => {
      const { ResourceAggregator } = require('./resource-monitor');
      const aggregator = new ResourceAggregator();

      const monitor1 = new ResourceMonitor({ interval: 100 });
      const monitor2 = new ResourceMonitor({ interval: 100 });

      aggregator.addMonitor('monitor1', monitor1);
      aggregator.addMonitor('monitor2', monitor2);

      aggregator.startAll();

      setTimeout(() => {
        const aggregatedMetrics = aggregator.getAggregatedMetrics(1000);
        expect(aggregatedMetrics.size).toBe(2);
        expect(aggregatedMetrics.has('monitor1')).toBe(true);
        expect(aggregatedMetrics.has('monitor2')).toBe(true);

        const report = aggregator.generateReport();
        expect(report.monitors).toBeDefined();
        expect(report.monitors.monitor1).toBeDefined();
        expect(report.monitors.monitor2).toBeDefined();

        aggregator.stopAll();
      }, 300);
    });
  });

  describe('Performance Under Load', () => {
    test('should handle high-frequency metric collection', async () => {
      const monitor = new PerformanceMonitor({
        metricsInterval: 10, // Very fast collection
        resourceMonitor: new ResourceMonitor({ interval: 10 }),
        networkMonitor: new NetworkMonitor({ sampleInterval: 10 })
      });

      await monitor.start();

      // Run for 1 second
      await new Promise(resolve => setTimeout(resolve, 1000));

      const metrics = monitor.getMetrics();
      expect(metrics.length).toBeGreaterThan(50); // Should have many metrics

      await monitor.stop();
    });

    test('should maintain performance with many custom metrics', async () => {
      const customMetrics = Array.from({ length: 100 }, (_, i) => `metric${i}`);
      const monitor = new PerformanceMonitor({ customMetrics });

      await monitor.start();

      // Record many custom metrics
      for (let i = 0; i < 100; i++) {
        for (let j = 0; j < 100; j++) {
          monitor.recordCustomMetric(`metric${j}`, Math.random() * 1000);
        }
      }

      await new Promise(resolve => setTimeout(resolve, 200));

      const reportPath = await monitor.generateReport();
      const reportContent = await fs.readFile(reportPath, 'utf-8');
      const report = JSON.parse(reportContent);

      expect(Object.keys(report.customMetrics).length).toBe(100);
    });
  });
});