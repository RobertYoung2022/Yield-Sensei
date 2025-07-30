import * as fs from 'fs/promises';
import * as path from 'path';
import { PerformanceMonitor, PerformanceMetrics } from './performance-monitor';
import { ConcurrencyTestResult } from './concurrency-tester';
import { StressTestResult } from './stress-tester';
import { RecoveryTestResult } from './recovery-tester';
import { PerformanceSLAManager, ComplianceReport } from './performance-sla-manager';

export interface PerformanceReport {
  id: string;
  title: string;
  generatedAt: number;
  period: ReportPeriod;
  summary: ReportSummary;
  sections: ReportSection[];
  metadata: ReportMetadata;
}

export interface ReportPeriod {
  startTime: number;
  endTime: number;
  duration: number;
}

export interface ReportSummary {
  overallHealth: 'excellent' | 'good' | 'fair' | 'poor' | 'critical';
  keyMetrics: KeyMetric[];
  alerts: AlertSummary[];
  recommendations: string[];
}

export interface KeyMetric {
  name: string;
  value: number;
  unit: string;
  trend: 'improving' | 'stable' | 'degrading';
  comparison: string;
}

export interface AlertSummary {
  severity: 'info' | 'warning' | 'critical';
  count: number;
  description: string;
}

export interface ReportSection {
  id: string;
  title: string;
  type: 'chart' | 'table' | 'text' | 'metrics' | 'timeline';
  content: any;
  priority: 'high' | 'medium' | 'low';
}

export interface ReportMetadata {
  generatedBy: string;
  version: string;
  dataSource: string[];
  exportFormats: string[];
}

export interface ChartData {
  type: 'line' | 'bar' | 'pie' | 'scatter' | 'heatmap';
  title: string;
  xAxis: ChartAxis;
  yAxis: ChartAxis;
  series: ChartSeries[];
  annotations?: ChartAnnotation[];
}

export interface ChartAxis {
  label: string;
  unit?: string;
  scale?: 'linear' | 'logarithmic' | 'time';
}

export interface ChartSeries {
  name: string;
  data: ChartPoint[];
  color?: string;
  style?: 'solid' | 'dashed' | 'dotted';
}

export interface ChartPoint {
  x: number | string;
  y: number;
  label?: string;
}

export interface ChartAnnotation {
  type: 'line' | 'region' | 'point';
  value: number | [number, number];
  label: string;
  color?: string;
}

export interface TableData {
  title: string;
  headers: string[];
  rows: (string | number)[][];
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export class PerformanceReporter {
  private slaManager: PerformanceSLAManager;
  private outputDir: string;

  constructor(slaManager: PerformanceSLAManager, outputDir: string = './performance-reports') {
    this.slaManager = slaManager;
    this.outputDir = outputDir;
  }

  async generateDashboardReport(
    performanceMonitor: PerformanceMonitor,
    period: { startTime: number; endTime: number }
  ): Promise<PerformanceReport> {
    const metrics = performanceMonitor.getMetrics(period.endTime - period.startTime);
    const complianceReport = this.slaManager.generateComplianceReport('day');

    const report: PerformanceReport = {
      id: `dashboard-${Date.now()}`,
      title: 'Performance Dashboard Report',
      generatedAt: Date.now(),
      period: {
        startTime: period.startTime,
        endTime: period.endTime,
        duration: period.endTime - period.startTime
      },
      summary: this.generateDashboardSummary(metrics, complianceReport),
      sections: [
        this.createSystemMetricsSection(metrics),
        this.createPerformanceTrendsSection(metrics),
        this.createSLAComplianceSection(complianceReport),
        this.createResourceUtilizationSection(metrics),
        this.createAlertsSection(metrics)
      ],
      metadata: {
        generatedBy: 'PerformanceReporter',
        version: '1.0.0',
        dataSource: ['performance-monitor', 'sla-manager'],
        exportFormats: ['json', 'html', 'pdf']
      }
    };

    await this.saveReport(report);
    return report;
  }

  async generateConcurrencyReport(result: ConcurrencyTestResult): Promise<PerformanceReport> {
    const report: PerformanceReport = {
      id: `concurrency-${Date.now()}`,
      title: 'Concurrency Test Report',
      generatedAt: Date.now(),
      period: {
        startTime: result.summary.startTime,
        endTime: result.summary.endTime,
        duration: result.summary.duration
      },
      summary: this.generateConcurrencySummary(result),
      sections: [
        this.createConcurrencyOverviewSection(result),
        this.createUserLoadSection(result),
        this.createScenarioPerformanceSection(result),
        this.createConcurrencyMetricsSection(result),
        this.createErrorAnalysisSection(result)
      ],
      metadata: {
        generatedBy: 'PerformanceReporter',
        version: '1.0.0',
        dataSource: ['concurrency-tester'],
        exportFormats: ['json', 'html', 'pdf']
      }
    };

    await this.saveReport(report);
    return report;
  }

  async generateStressTestReport(result: StressTestResult): Promise<PerformanceReport> {
    const report: PerformanceReport = {
      id: `stress-test-${Date.now()}`,
      title: 'Stress Test Report',
      generatedAt: Date.now(),
      period: {
        startTime: result.summary.startTime,
        endTime: result.summary.endTime,
        duration: result.summary.duration
      },
      summary: this.generateStressTestSummary(result),
      sections: [
        this.createStressTestOverviewSection(result),
        this.createLoadProgressionSection(result),
        this.createBreakingPointSection(result),
        this.createSystemMetricsTimelineSection(result),
        this.createRecommendationsSection(result.recommendations)
      ],
      metadata: {
        generatedBy: 'PerformanceReporter',
        version: '1.0.0',
        dataSource: ['stress-tester'],
        exportFormats: ['json', 'html', 'pdf']
      }
    };

    await this.saveReport(report);
    return report;
  }

  async generateRecoveryReport(result: RecoveryTestResult): Promise<PerformanceReport> {
    const report: PerformanceReport = {
      id: `recovery-${Date.now()}`,
      title: 'System Recovery Test Report',
      generatedAt: Date.now(),
      period: {
        startTime: result.summary.startTime,
        endTime: result.summary.endTime,
        duration: result.summary.totalDuration
      },
      summary: this.generateRecoverySummary(result),
      sections: [
        this.createRecoveryOverviewSection(result),
        this.createRecoveryTimelineSection(result),
        this.createResilienceAnalysisSection(result),
        this.createFailureAnalysisSection(result),
        this.createRecommendationsSection(result.analysis.recommendations)
      ],
      metadata: {
        generatedBy: 'PerformanceReporter',
        version: '1.0.0',
        dataSource: ['recovery-tester'],
        exportFormats: ['json', 'html', 'pdf']
      }
    };

    await this.saveReport(report);
    return report;
  }

  private generateDashboardSummary(metrics: PerformanceMetrics[], complianceReport: ComplianceReport): ReportSummary {
    const health = this.calculateOverallHealth(metrics, complianceReport);
    
    const keyMetrics: KeyMetric[] = [
      this.calculateKeyMetric('Average Response Time', metrics, m => m.network.requests.averageLatency, 'ms'),
      this.calculateKeyMetric('Throughput', metrics, m => m.network.requests.total, 'rps'),
      this.calculateKeyMetric('Error Rate', metrics, m => (m.network.requests.failed / m.network.requests.total) * 100, '%'),
      this.calculateKeyMetric('CPU Usage', metrics, m => m.resource.cpu.usage, '%'),
      this.calculateKeyMetric('Memory Usage', metrics, m => m.resource.memory.percentUsed, '%')
    ];

    const alerts: AlertSummary[] = [
      { severity: 'critical', count: complianceReport.summary.violatedSLAs, description: 'SLA violations' },
      { severity: 'warning', count: 0, description: 'Performance warnings' },
      { severity: 'info', count: complianceReport.summary.compliantSLAs, description: 'SLAs in compliance' }
    ];

    const recommendations = this.generateDashboardRecommendations(metrics, complianceReport);

    return { overallHealth: health, keyMetrics, alerts, recommendations };
  }

  private generateConcurrencySummary(result: ConcurrencyTestResult): ReportSummary {
    const successRate = (result.summary.successfulUsers / result.summary.totalUsers) * 100;
    const health = successRate > 95 ? 'excellent' : successRate > 85 ? 'good' : successRate > 70 ? 'fair' : 'poor';

    const keyMetrics: KeyMetric[] = [
      {
        name: 'Total Users',
        value: result.summary.totalUsers,
        unit: 'users',
        trend: 'stable',
        comparison: 'As expected'
      },
      {
        name: 'Success Rate',
        value: successRate,
        unit: '%',
        trend: successRate > 90 ? 'stable' : 'degrading',
        comparison: successRate > 95 ? 'Excellent' : successRate > 85 ? 'Good' : 'Needs improvement'
      },
      {
        name: 'Average Response Time',
        value: result.summary.averageResponseTime,
        unit: 'ms',
        trend: result.summary.averageResponseTime < 1000 ? 'stable' : 'degrading',
        comparison: result.summary.averageResponseTime < 500 ? 'Fast' : 'Acceptable'
      },
      {
        name: 'Peak Concurrent Users',
        value: result.concurrencyMetrics.peakConcurrentUsers,
        unit: 'users',
        trend: 'stable',
        comparison: 'Target achieved'
      }
    ];

    return {
      overallHealth: health,
      keyMetrics,
      alerts: [],
      recommendations: this.generateConcurrencyRecommendations(result)
    };
  }

  private generateStressTestSummary(result: StressTestResult): ReportSummary {
    const health = result.breakingPoint ? 'fair' : 'good';

    const keyMetrics: KeyMetric[] = [
      {
        name: 'Max Users Reached',
        value: result.summary.maxUsersReached,
        unit: 'users',
        trend: 'stable',
        comparison: result.breakingPoint ? 'Breaking point found' : 'No breaking point'
      },
      {
        name: 'Peak Throughput',
        value: result.summary.peakThroughput,
        unit: 'rps',
        trend: 'stable',
        comparison: 'Maximum capacity identified'
      },
      {
        name: 'Peak Response Time',
        value: result.summary.peakResponseTime,
        unit: 'ms',
        trend: result.summary.peakResponseTime > 5000 ? 'degrading' : 'stable',
        comparison: result.summary.peakResponseTime > 5000 ? 'High' : 'Acceptable'
      }
    ];

    return {
      overallHealth: health,
      keyMetrics,
      alerts: [],
      recommendations: result.recommendations
    };
  }

  private generateRecoverySummary(result: RecoveryTestResult): ReportSummary {
    const health = result.summary.finalSystemState === 'recovered' ? 'good' : 
                  result.summary.finalSystemState === 'degraded' ? 'fair' : 'poor';

    const keyMetrics: KeyMetric[] = [
      {
        name: 'Recovery Achieved',
        value: result.summary.recoveryAchieved ? 1 : 0,
        unit: 'boolean',
        trend: 'stable',
        comparison: result.summary.recoveryAchieved ? 'Yes' : 'No'
      },
      {
        name: 'Recovery Time',
        value: result.summary.actualRecoveryTime,
        unit: 'ms',
        trend: result.summary.meetsTargetRecoveryTime ? 'stable' : 'degrading',
        comparison: result.summary.meetsTargetRecoveryTime ? 'Within target' : 'Exceeded target'
      },
      {
        name: 'Resilience Score',
        value: result.analysis.resilience.score,
        unit: 'score',
        trend: result.analysis.resilience.score > 70 ? 'stable' : 'degrading',
        comparison: result.analysis.resilience.score > 80 ? 'High' : result.analysis.resilience.score > 60 ? 'Medium' : 'Low'
      }
    ];

    return {
      overallHealth: health,
      keyMetrics,
      alerts: [],
      recommendations: result.analysis.recommendations
    };
  }

  private createSystemMetricsSection(metrics: PerformanceMetrics[]): ReportSection {
    const cpuData = metrics.map((m, i) => ({ x: i, y: m.resource.cpu.usage }));
    const memoryData = metrics.map((m, i) => ({ x: i, y: m.resource.memory.percentUsed }));

    const chartData: ChartData = {
      type: 'line',
      title: 'System Resource Usage',
      xAxis: { label: 'Time', scale: 'time' },
      yAxis: { label: 'Usage', unit: '%' },
      series: [
        { name: 'CPU Usage', data: cpuData, color: '#ff6b6b' },
        { name: 'Memory Usage', data: memoryData, color: '#4ecdc4' }
      ],
      annotations: [
        { type: 'line', value: 80, label: 'Warning Threshold', color: '#ffa500' },
        { type: 'line', value: 90, label: 'Critical Threshold', color: '#ff0000' }
      ]
    };

    return {
      id: 'system-metrics',
      title: 'System Metrics',
      type: 'chart',
      content: chartData,
      priority: 'high'
    };
  }

  private createPerformanceTrendsSection(metrics: PerformanceMetrics[]): ReportSection {
    const responseTimeData = metrics.map((m, i) => ({ 
      x: i, 
      y: m.network.requests.averageLatency 
    }));
    const throughputData = metrics.map((m, i) => ({ 
      x: i, 
      y: m.network.requests.total 
    }));

    const chartData: ChartData = {
      type: 'line',
      title: 'Performance Trends',
      xAxis: { label: 'Time', scale: 'time' },
      yAxis: { label: 'Response Time (ms) / Throughput (rps)' },
      series: [
        { name: 'Response Time', data: responseTimeData, color: '#ff9f43' },
        { name: 'Throughput', data: throughputData, color: '#10ac84' }
      ]
    };

    return {
      id: 'performance-trends',
      title: 'Performance Trends',
      type: 'chart',
      content: chartData,
      priority: 'high'
    };
  }

  private createSLAComplianceSection(complianceReport: ComplianceReport): ReportSection {
    const tableData: TableData = {
      title: 'SLA Compliance Status',
      headers: ['SLA', 'Compliance Rate', 'Target', 'Status', 'Violations'],
      rows: complianceReport.slaReports.map(sla => [
        sla.slaName,
        `${sla.complianceRate.toFixed(1)}%`,
        `${sla.targetRate}%`,
        sla.status,
        sla.violations
      ])
    };

    return {
      id: 'sla-compliance',
      title: 'SLA Compliance',
      type: 'table',
      content: tableData,
      priority: 'high'
    };
  }

  private createResourceUtilizationSection(metrics: PerformanceMetrics[]): ReportSection {
    if (metrics.length === 0) {
      return {
        id: 'resource-utilization',
        title: 'Resource Utilization',
        type: 'text',
        content: 'No resource utilization data available',
        priority: 'medium'
      };
    }

    const latest = metrics[metrics.length - 1];
    const utilizationData = {
      cpu: latest.resource.cpu.usage,
      memory: latest.resource.memory.percentUsed,
      connections: latest.network.connections.active,
      queueDepth: latest.application.saturation.queueDepth
    };

    return {
      id: 'resource-utilization',
      title: 'Current Resource Utilization',
      type: 'metrics',
      content: utilizationData,
      priority: 'medium'
    };
  }

  private createAlertsSection(metrics: PerformanceMetrics[]): ReportSection {
    const alerts: any[] = [];

    if (metrics.length > 0) {
      const latest = metrics[metrics.length - 1];
      
      if (latest.resource.cpu.usage > 80) {
        alerts.push({
          severity: 'warning',
          message: `High CPU usage: ${latest.resource.cpu.usage.toFixed(1)}%`,
          timestamp: latest.timestamp
        });
      }

      if (latest.resource.memory.percentUsed > 85) {
        alerts.push({
          severity: 'critical',
          message: `High memory usage: ${latest.resource.memory.percentUsed.toFixed(1)}%`,
          timestamp: latest.timestamp
        });
      }
    }

    return {
      id: 'alerts',
      title: 'Active Alerts',
      type: 'table',
      content: {
        title: 'Current Alerts',
        headers: ['Severity', 'Message', 'Time'],
        rows: alerts.map(alert => [
          alert.severity,
          alert.message,
          new Date(alert.timestamp).toLocaleString()
        ])
      },
      priority: 'high'
    };
  }

  private createConcurrencyOverviewSection(result: ConcurrencyTestResult): ReportSection {
    const overview = {
      testDuration: `${(result.summary.duration / 1000).toFixed(0)} seconds`,
      totalUsers: result.summary.totalUsers,
      successfulUsers: result.summary.successfulUsers,
      failedUsers: result.summary.failedUsers,
      successRate: `${((result.summary.successfulUsers / result.summary.totalUsers) * 100).toFixed(1)}%`,
      averageResponseTime: `${result.summary.averageResponseTime.toFixed(0)} ms`,
      throughput: `${result.summary.throughput.toFixed(1)} requests/second`
    };

    return {
      id: 'concurrency-overview',
      title: 'Test Overview',
      type: 'metrics',
      content: overview,
      priority: 'high'
    };
  }

  private createUserLoadSection(result: ConcurrencyTestResult): ReportSection {
    const timeline = Array.from(result.concurrencyMetrics.userDistribution.entries())
      .sort((a, b) => a[0] - b[0]);
    
    const chartData: ChartData = {
      type: 'line',
      title: 'Concurrent Users Over Time',
      xAxis: { label: 'Time', scale: 'time' },
      yAxis: { label: 'Concurrent Users' },
      series: [{
        name: 'Active Users',
        data: timeline.map(([time, users]) => ({ x: time, y: users })),
        color: '#3742fa'
      }]
    };

    return {
      id: 'user-load',
      title: 'User Load Pattern',
      type: 'chart',
      content: chartData,
      priority: 'high'
    };
  }

  private createScenarioPerformanceSection(result: ConcurrencyTestResult): ReportSection {
    const scenarioData: TableData = {
      title: 'Scenario Performance',
      headers: ['Scenario', 'Executions', 'Success Rate', 'Avg Duration', 'P95 Duration'],
      rows: Array.from(result.scenarioMetrics.entries()).map(([name, metrics]) => [
        name,
        metrics.executions,
        `${((metrics.successes / metrics.executions) * 100).toFixed(1)}%`,
        `${metrics.averageDuration.toFixed(0)} ms`,
        `${metrics.p95Duration.toFixed(0)} ms`
      ])
    };

    return {
      id: 'scenario-performance',
      title: 'Scenario Performance',
      type: 'table',
      content: scenarioData,
      priority: 'medium'
    };
  }

  private createConcurrencyMetricsSection(result: ConcurrencyTestResult): ReportSection {
    const metrics = {
      peakConcurrentUsers: result.concurrencyMetrics.peakConcurrentUsers,
      averageConcurrentUsers: result.concurrencyMetrics.averageConcurrentUsers.toFixed(1),
      contentionPoints: result.concurrencyMetrics.contentionPoints.length,
      resourceUtilization: result.concurrencyMetrics.resourceUtilization.length > 0 ? 'Available' : 'Not available'
    };

    return {
      id: 'concurrency-metrics',
      title: 'Concurrency Metrics',
      type: 'metrics',
      content: metrics,
      priority: 'medium'
    };
  }

  private createErrorAnalysisSection(result: ConcurrencyTestResult): ReportSection {
    const errorsByType = new Map<string, number>();
    
    result.errors.forEach(error => {
      const type = error.error.split(':')[0] || 'Unknown';
      errorsByType.set(type, (errorsByType.get(type) || 0) + 1);
    });

    const tableData: TableData = {
      title: 'Error Analysis',
      headers: ['Error Type', 'Count', 'Percentage'],
      rows: Array.from(errorsByType.entries()).map(([type, count]) => [
        type,
        count,
        `${((count / result.errors.length) * 100).toFixed(1)}%`
      ])
    };

    return {
      id: 'error-analysis',
      title: 'Error Analysis',
      type: 'table',
      content: tableData,
      priority: 'medium'
    };
  }

  private createStressTestOverviewSection(result: StressTestResult): ReportSection {
    const overview = {
      testDuration: `${(result.summary.duration / 1000).toFixed(0)} seconds`,
      maxUsersReached: result.summary.maxUsersReached,
      breakingPointFound: result.summary.breakingPointFound ? 'Yes' : 'No',
      peakThroughput: `${result.summary.peakThroughput.toFixed(1)} rps`,
      peakResponseTime: `${result.summary.peakResponseTime.toFixed(0)} ms`,
      totalRequests: result.summary.totalRequests,
      totalErrors: result.summary.totalErrors
    };

    return {
      id: 'stress-test-overview',
      title: 'Stress Test Overview',
      type: 'metrics',
      content: overview,
      priority: 'high'
    };
  }

  private createLoadProgressionSection(result: StressTestResult): ReportSection {
    const chartData: ChartData = {
      type: 'line',
      title: 'Load Progression',
      xAxis: { label: 'Time' },
      yAxis: { label: 'Users / Throughput / Response Time' },
      series: [
        {
          name: 'Concurrent Users',
          data: result.loadProgression.map(p => ({ x: p.timestamp, y: p.users })),
          color: '#3742fa'
        },
        {
          name: 'Throughput (rps)',
          data: result.loadProgression.map(p => ({ x: p.timestamp, y: p.throughput })),
          color: '#10ac84'
        },
        {
          name: 'Avg Response Time (ms)',
          data: result.loadProgression.map(p => ({ x: p.timestamp, y: p.avgResponseTime })),
          color: '#ff9f43'
        }
      ]
    };

    return {
      id: 'load-progression',
      title: 'Load Progression',
      type: 'chart',
      content: chartData,
      priority: 'high'
    };
  }

  private createBreakingPointSection(result: StressTestResult): ReportSection {
    if (!result.breakingPoint) {
      return {
        id: 'breaking-point',
        title: 'Breaking Point Analysis',
        type: 'text',
        content: 'No breaking point was detected during the test. System handled the maximum configured load successfully.',
        priority: 'medium'
      };
    }

    const breakingPointData = {
      usersAtBreakingPoint: result.breakingPoint.concurrentUsers,
      responseTime: `${result.breakingPoint.metrics.responseTime.toFixed(0)} ms`,
      errorRate: `${result.breakingPoint.metrics.errorRate.toFixed(1)}%`,
      throughput: `${result.breakingPoint.metrics.throughput.toFixed(1)} rps`,
      cpuUsage: `${result.breakingPoint.metrics.cpuUsage.toFixed(1)}%`,
      memoryUsage: `${result.breakingPoint.metrics.memoryUsage.toFixed(1)}%`,
      triggerCriteria: result.breakingPoint.triggerCriteria.join(', ')
    };

    return {
      id: 'breaking-point',
      title: 'Breaking Point Analysis',
      type: 'metrics',
      content: breakingPointData,
      priority: 'high'
    };
  }

  private createSystemMetricsTimelineSection(result: StressTestResult): ReportSection {
    const cpuData = result.systemMetrics.cpu.map((cpu, i) => ({ 
      x: result.systemMetrics.timestamps[i], 
      y: cpu 
    }));
    const memoryData = result.systemMetrics.memory.map((memory, i) => ({ 
      x: result.systemMetrics.timestamps[i], 
      y: memory 
    }));

    const chartData: ChartData = {
      type: 'line',
      title: 'System Metrics Timeline',
      xAxis: { label: 'Time', scale: 'time' },
      yAxis: { label: 'Usage (%)', unit: '%' },
      series: [
        { name: 'CPU Usage', data: cpuData, color: '#ff6b6b' },
        { name: 'Memory Usage', data: memoryData, color: '#4ecdc4' }
      ]
    };

    return {
      id: 'system-metrics-timeline',
      title: 'System Metrics Timeline',
      type: 'chart',
      content: chartData,
      priority: 'medium'
    };
  }

  private createRecoveryOverviewSection(result: RecoveryTestResult): ReportSection {
    const overview = {
      testDuration: `${(result.summary.totalDuration / 1000).toFixed(0)} seconds`,
      recoveryAchieved: result.summary.recoveryAchieved ? 'Yes' : 'No',
      actualRecoveryTime: result.summary.actualRecoveryTime > 0 
        ? `${(result.summary.actualRecoveryTime / 1000).toFixed(1)} seconds`
        : 'N/A',
      meetsTargetRecoveryTime: result.summary.meetsTargetRecoveryTime ? 'Yes' : 'No',
      finalSystemState: result.summary.finalSystemState,
      resilienceScore: `${result.analysis.resilience.score}/100`
    };

    return {
      id: 'recovery-overview',
      title: 'Recovery Test Overview',
      type: 'metrics',
      content: overview,
      priority: 'high'
    };
  }

  private createRecoveryTimelineSection(result: RecoveryTestResult): ReportSection {
    const responseTimeData = result.timeline.map(point => ({
      x: point.timestamp,
      y: point.metrics.responseTime
    }));

    const chartData: ChartData = {
      type: 'line',
      title: 'Recovery Timeline',
      xAxis: { label: 'Time', scale: 'time' },
      yAxis: { label: 'Response Time (ms)', unit: 'ms' },
      series: [{
        name: 'Response Time',
        data: responseTimeData,
        color: '#ff9f43'
      }],
      annotations: result.timeline
        .filter(p => p.phase !== 'baseline')
        .reduce((acc: ChartAnnotation[], point, index, arr) => {
          if (index === 0 || point.phase !== arr[index - 1].phase) {
            acc.push({
              type: 'line',
              value: point.timestamp,
              label: `${point.phase} phase`,
              color: point.phase === 'overload' ? '#ff0000' : '#00ff00'
            });
          }
          return acc;
        }, [])
    };

    return {
      id: 'recovery-timeline',
      title: 'Recovery Timeline',
      type: 'chart',
      content: chartData,
      priority: 'high'
    };
  }

  private createResilienceAnalysisSection(result: RecoveryTestResult): ReportSection {
    const resilienceData = {
      overallScore: `${result.analysis.resilience.score}/100`,
      recoverySpeed: `${result.analysis.resilience.factors.recoverySpeed}/100`,
      stabilityAfterRecovery: `${result.analysis.resilience.factors.stabilityAfterRecovery}/100`,
      errorHandling: `${result.analysis.resilience.factors.errorHandling}/100`,
      resourceManagement: `${result.analysis.resilience.factors.resourceManagement}/100`,
      recoveryPattern: result.analysis.recoveryPattern,
      bottlenecks: result.analysis.bottlenecks.join(', ') || 'None identified'
    };

    return {
      id: 'resilience-analysis',
      title: 'Resilience Analysis',
      type: 'metrics',
      content: resilienceData,
      priority: 'high'
    };
  }

  private createFailureAnalysisSection(result: RecoveryTestResult): ReportSection {
    const failures = result.overloadPhase.systemFailures;
    
    if (failures.length === 0) {
      return {
        id: 'failure-analysis',
        title: 'Failure Analysis',
        type: 'text',
        content: 'No system failures detected during the test.',
        priority: 'medium'
      };
    }

    const tableData: TableData = {
      title: 'System Failures',
      headers: ['Type', 'Severity', 'Time', 'Details'],
      rows: failures.map(failure => [
        failure.type,
        failure.severity,
        new Date(failure.timestamp).toLocaleString(),
        failure.details
      ])
    };

    return {
      id: 'failure-analysis',
      title: 'Failure Analysis',
      type: 'table',
      content: tableData,
      priority: 'medium'
    };
  }

  private createRecommendationsSection(recommendations: string[]): ReportSection {
    return {
      id: 'recommendations',
      title: 'Recommendations',
      type: 'text',
      content: recommendations.map(rec => `• ${rec}`).join('\n'),
      priority: 'high'
    };
  }

  private calculateOverallHealth(metrics: PerformanceMetrics[], complianceReport: ComplianceReport): 'excellent' | 'good' | 'fair' | 'poor' | 'critical' {
    const complianceRate = complianceReport.overallCompliance;
    const violatedSLAs = complianceReport.summary.violatedSLAs;

    if (complianceRate >= 99 && violatedSLAs === 0) return 'excellent';
    if (complianceRate >= 95 && violatedSLAs <= 1) return 'good';
    if (complianceRate >= 90 && violatedSLAs <= 2) return 'fair';
    if (complianceRate >= 80) return 'poor';
    return 'critical';
  }

  private calculateKeyMetric(name: string, metrics: PerformanceMetrics[], extractor: (m: PerformanceMetrics) => number, unit: string): KeyMetric {
    if (metrics.length === 0) {
      return { name, value: 0, unit, trend: 'stable', comparison: 'No data' };
    }

    const values = metrics.map(extractor);
    const current = values[values.length - 1];
    const previous = values.length > 1 ? values[values.length - 2] : current;
    
    const trend = current > previous * 1.1 ? 'degrading' : current < previous * 0.9 ? 'improving' : 'stable';
    const comparison = this.getComparisonText(name, current);

    return { name, value: current, unit, trend, comparison };
  }

  private getComparisonText(metricName: string, value: number): string {
    // Simple comparison logic - in real implementation, this would be more sophisticated
    switch (metricName) {
      case 'Average Response Time':
        return value < 500 ? 'Excellent' : value < 1000 ? 'Good' : 'Needs improvement';
      case 'Throughput':
        return value > 1000 ? 'High' : value > 500 ? 'Moderate' : 'Low';
      case 'Error Rate':
        return value < 1 ? 'Low' : value < 5 ? 'Moderate' : 'High';
      case 'CPU Usage':
        return value < 50 ? 'Low' : value < 80 ? 'Moderate' : 'High';
      case 'Memory Usage':
        return value < 60 ? 'Low' : value < 85 ? 'Moderate' : 'High';
      default:
        return 'Normal';
    }
  }

  private generateDashboardRecommendations(metrics: PerformanceMetrics[], complianceReport: ComplianceReport): string[] {
    const recommendations: string[] = [];

    if (complianceReport.summary.violatedSLAs > 0) {
      recommendations.push('Address SLA violations to improve service reliability');
    }

    if (metrics.length > 0) {
      const latest = metrics[metrics.length - 1];
      
      if (latest.resource.cpu.usage > 80) {
        recommendations.push('CPU usage is high - consider scaling or optimization');
      }
      
      if (latest.resource.memory.percentUsed > 85) {
        recommendations.push('Memory usage is high - investigate memory leaks or scale resources');
      }
      
      if (latest.network.requests.averageLatency > 1000) {
        recommendations.push('Response times are high - optimize application performance');
      }
    }

    if (recommendations.length === 0) {
      recommendations.push('System is performing well - continue monitoring');
    }

    return recommendations;
  }

  private generateConcurrencyRecommendations(result: ConcurrencyTestResult): string[] {
    const recommendations: string[] = [];
    const successRate = (result.summary.successfulUsers / result.summary.totalUsers) * 100;

    if (successRate < 95) {
      recommendations.push('Improve error handling to increase success rate');
    }

    if (result.summary.averageResponseTime > 1000) {
      recommendations.push('Optimize response times for better user experience');
    }

    if (result.errors.length > 0) {
      recommendations.push('Investigate and fix the most common error types');
    }

    if (result.concurrencyMetrics.contentionPoints.length > 0) {
      recommendations.push('Address resource contention points to improve scalability');
    }

    return recommendations;
  }

  private async saveReport(report: PerformanceReport): Promise<void> {
    await fs.mkdir(this.outputDir, { recursive: true });
    
    const filename = `${report.id}.json`;
    const filepath = path.join(this.outputDir, filename);
    
    await fs.writeFile(filepath, JSON.stringify(report, null, 2));
  }

  async exportToHTML(report: PerformanceReport): Promise<string> {
    const html = this.generateHTMLReport(report);
    const filename = `${report.id}.html`;
    const filepath = path.join(this.outputDir, filename);
    
    await fs.writeFile(filepath, html);
    return filepath;
  }

  private generateHTMLReport(report: PerformanceReport): string {
    return `
<!DOCTYPE html>
<html>
<head>
    <title>${report.title}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
        .section { margin: 20px 0; padding: 15px; border: 1px solid #ddd; border-radius: 8px; }
        .metric { display: inline-block; margin: 10px; padding: 10px; background: #e9ecef; border-radius: 4px; }
        .chart-placeholder { height: 300px; background: #f8f9fa; display: flex; align-items: center; justify-content: center; }
        table { width: 100%; border-collapse: collapse; }
        th, td { padding: 8px; border: 1px solid #ddd; text-align: left; }
        th { background: #f8f9fa; }
        .excellent { color: #28a745; }
        .good { color: #20c997; }
        .fair { color: #ffc107; }
        .poor { color: #fd7e14; }
        .critical { color: #dc3545; }
    </style>
</head>
<body>
    <div class="header">
        <h1>${report.title}</h1>
        <p>Generated: ${new Date(report.generatedAt).toLocaleString()}</p>
        <p>Period: ${new Date(report.period.startTime).toLocaleString()} - ${new Date(report.period.endTime).toLocaleString()}</p>
        <p>Overall Health: <span class="${report.summary.overallHealth}">${report.summary.overallHealth.toUpperCase()}</span></p>
    </div>

    <div class="section">
        <h2>Key Metrics</h2>
        ${report.summary.keyMetrics.map(metric => `
            <div class="metric">
                <strong>${metric.name}</strong><br>
                ${metric.value} ${metric.unit}<br>
                <small>Trend: ${metric.trend} | ${metric.comparison}</small>
            </div>
        `).join('')}
    </div>

    ${report.sections.map(section => `
        <div class="section">
            <h2>${section.title}</h2>
            ${this.renderSectionContent(section)}
        </div>
    `).join('')}

    ${report.summary.recommendations.length > 0 ? `
        <div class="section">
            <h2>Recommendations</h2>
            <ul>
                ${report.summary.recommendations.map(rec => `<li>${rec}</li>`).join('')}
            </ul>
        </div>
    ` : ''}
</body>
</html>`;
  }

  private renderSectionContent(section: ReportSection): string {
    switch (section.type) {
      case 'chart':
        return `<div class="chart-placeholder">Chart: ${section.content.title}</div>`;
      
      case 'table':
        const table = section.content as TableData;
        return `
            <table>
                <thead>
                    <tr>${table.headers.map(h => `<th>${h}</th>`).join('')}</tr>
                </thead>
                <tbody>
                    ${table.rows.map(row => `<tr>${row.map(cell => `<td>${cell}</td>`).join('')}</tr>`).join('')}
                </tbody>
            </table>
        `;
      
      case 'metrics':
        const metrics = section.content;
        return Object.entries(metrics).map(([key, value]) => 
          `<div class="metric"><strong>${key}:</strong> ${value}</div>`
        ).join('');
      
      case 'text':
        return `<p>${String(section.content).replace(/\n/g, '<br>')}</p>`;
      
      default:
        return `<pre>${JSON.stringify(section.content, null, 2)}</pre>`;
    }
  }
}