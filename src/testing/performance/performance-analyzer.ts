/**
 * Performance Analyzer
 * Advanced analysis tools for performance test results
 */

import { PerformanceMetrics, LoadTestResult } from './performance-testing-framework';
import { ResponseTimeMetric, ResourceMetric, ThroughputMetric } from './performance-monitor';

export interface PerformanceRegression {
  metric: string;
  baseline: number;
  current: number;
  changePercent: number;
  severity: 'minor' | 'moderate' | 'major' | 'critical';
  threshold: number;
}

export interface PerformanceAnomaly {
  type: 'spike' | 'drop' | 'trend' | 'outlier';
  metric: string;
  timestamp: number;
  value: number;
  expectedValue: number;
  severity: 'low' | 'medium' | 'high';
  description: string;
}

export interface PerformanceTrend {
  metric: string;
  direction: 'improving' | 'degrading' | 'stable';
  rate: number; // rate of change per hour
  confidence: number; // 0-1
  startValue: number;
  endValue: number;
  duration: number; // in milliseconds
}

export interface PerformanceInsight {
  category: 'bottleneck' | 'optimization' | 'scaling' | 'reliability';
  title: string;
  description: string;
  impact: 'low' | 'medium' | 'high' | 'critical';
  recommendation: string;
  evidence: any[];
}

export interface AnalysisResult {
  summary: {
    overallScore: number; // 0-100
    performanceGrade: 'A' | 'B' | 'C' | 'D' | 'F';
    primaryBottleneck: string;
    keyFindings: string[];
  };
  regressions: PerformanceRegression[];
  anomalies: PerformanceAnomaly[];
  trends: PerformanceTrend[];
  insights: PerformanceInsight[];
  recommendations: string[];
}

export class PerformanceAnalyzer {
  private readonly regressionThresholds = {
    responseTime: 0.1, // 10% increase is concerning
    throughput: 0.05,  // 5% decrease is concerning
    errorRate: 0.02,   // 2% increase is concerning
    cpuUsage: 0.15,    // 15% increase is concerning
    memoryUsage: 0.2,  // 20% increase is concerning
  };

  analyzeTestResult(result: LoadTestResult, baseline?: LoadTestResult): AnalysisResult {
    const analysis: AnalysisResult = {
      summary: {
        overallScore: 0,
        performanceGrade: 'F',
        primaryBottleneck: 'unknown',
        keyFindings: [],
      },
      regressions: baseline ? this.detectRegressions(result, baseline) : [],
      anomalies: this.detectAnomalies(result),
      trends: this.analyzeTrends(result),
      insights: this.generateInsights(result),
      recommendations: [],
    };

    // Calculate overall performance score
    analysis.summary.overallScore = this.calculateOverallScore(result, analysis);
    analysis.summary.performanceGrade = this.calculateGrade(analysis.summary.overallScore);
    analysis.summary.primaryBottleneck = this.identifyPrimaryBottleneck(result, analysis);
    analysis.summary.keyFindings = this.generateKeyFindings(analysis);
    analysis.recommendations = this.generateRecommendations(analysis);

    return analysis;
  }

  private detectRegressions(current: LoadTestResult, baseline: LoadTestResult): PerformanceRegression[] {
    const regressions: PerformanceRegression[] = [];

    // Response time regression
    const responseTimeChange = this.calculateChange(
      baseline.metrics.averageResponseTime,
      current.metrics.averageResponseTime
    );
    if (responseTimeChange > this.regressionThresholds.responseTime) {
      regressions.push({
        metric: 'Average Response Time',
        baseline: baseline.metrics.averageResponseTime,
        current: current.metrics.averageResponseTime,
        changePercent: responseTimeChange,
        severity: this.calculateSeverity(responseTimeChange, this.regressionThresholds.responseTime),
        threshold: this.regressionThresholds.responseTime,
      });
    }

    // Throughput regression (negative change is bad)
    const throughputChange = this.calculateChange(
      baseline.metrics.throughput,
      current.metrics.throughput
    );
    if (throughputChange < -this.regressionThresholds.throughput) {
      regressions.push({
        metric: 'Throughput',
        baseline: baseline.metrics.throughput,
        current: current.metrics.throughput,
        changePercent: throughputChange,
        severity: this.calculateSeverity(Math.abs(throughputChange), this.regressionThresholds.throughput),
        threshold: this.regressionThresholds.throughput,
      });
    }

    // Error rate regression
    const errorRateChange = this.calculateChange(
      baseline.metrics.errorRate,
      current.metrics.errorRate
    );
    if (errorRateChange > this.regressionThresholds.errorRate) {
      regressions.push({
        metric: 'Error Rate',
        baseline: baseline.metrics.errorRate,
        current: current.metrics.errorRate,
        changePercent: errorRateChange,
        severity: this.calculateSeverity(errorRateChange, this.regressionThresholds.errorRate),
        threshold: this.regressionThresholds.errorRate,
      });
    }

    return regressions;
  }

  private detectAnomalies(result: LoadTestResult): PerformanceAnomaly[] {
    const anomalies: PerformanceAnomaly[] = [];
    
    // Analyze time series data for anomalies
    if (result.timeSeriesMetrics && result.timeSeriesMetrics.length > 10) {
      // Response time spikes
      const responseTimeAnomalies = this.detectResponseTimeAnomalies(result.timeSeriesMetrics);
      anomalies.push(...responseTimeAnomalies);

      // Resource usage anomalies
      const resourceAnomalies = this.detectResourceAnomalies(result.timeSeriesMetrics);
      anomalies.push(...resourceAnomalies);

      // Throughput anomalies
      const throughputAnomalies = this.detectThroughputAnomalies(result.timeSeriesMetrics);
      anomalies.push(...throughputAnomalies);
    }

    return anomalies;
  }

  private detectResponseTimeAnomalies(metrics: PerformanceMetrics[]): PerformanceAnomaly[] {
    const anomalies: PerformanceAnomaly[] = [];
    const responseTimes = metrics.map(m => m.averageResponseTime);
    const mean = this.calculateMean(responseTimes);
    const stdDev = this.calculateStandardDeviation(responseTimes, mean);
    const threshold = mean + (2 * stdDev); // 2 standard deviations

    metrics.forEach((metric, index) => {
      if (metric.averageResponseTime > threshold) {
        anomalies.push({
          type: 'spike',
          metric: 'Response Time',
          timestamp: metric.timestamp.getTime(),
          value: metric.averageResponseTime,
          expectedValue: mean,
          severity: metric.averageResponseTime > mean + (3 * stdDev) ? 'high' : 'medium',
          description: `Response time spike detected: ${metric.averageResponseTime.toFixed(2)}ms vs expected ${mean.toFixed(2)}ms`,
        });
      }
    });

    return anomalies;
  }

  private detectResourceAnomalies(metrics: PerformanceMetrics[]): PerformanceAnomaly[] {
    const anomalies: PerformanceAnomaly[] = [];
    
    // CPU usage anomalies
    const cpuUsages = metrics.map(m => m.resourceUsage.cpu);
    const cpuMean = this.calculateMean(cpuUsages);
    const cpuStdDev = this.calculateStandardDeviation(cpuUsages, cpuMean);
    
    metrics.forEach(metric => {
      if (metric.resourceUsage.cpu > cpuMean + (2 * cpuStdDev)) {
        anomalies.push({
          type: 'spike',
          metric: 'CPU Usage',
          timestamp: metric.timestamp.getTime(),
          value: metric.resourceUsage.cpu,
          expectedValue: cpuMean,
          severity: metric.resourceUsage.cpu > 90 ? 'high' : 'medium',
          description: `High CPU usage detected: ${metric.resourceUsage.cpu.toFixed(1)}%`,
        });
      }
    });

    return anomalies;
  }

  private detectThroughputAnomalies(metrics: PerformanceMetrics[]): PerformanceAnomaly[] {
    const anomalies: PerformanceAnomaly[] = [];
    const throughputs = metrics.map(m => m.throughput);
    const mean = this.calculateMean(throughputs);
    const stdDev = this.calculateStandardDeviation(throughputs, mean);
    const lowerThreshold = mean - (2 * stdDev);

    metrics.forEach(metric => {
      if (metric.throughput < lowerThreshold && lowerThreshold > 0) {
        anomalies.push({
          type: 'drop',
          metric: 'Throughput',
          timestamp: metric.timestamp.getTime(),
          value: metric.throughput,
          expectedValue: mean,
          severity: metric.throughput < mean - (3 * stdDev) ? 'high' : 'medium',
          description: `Throughput drop detected: ${metric.throughput.toFixed(2)} req/s vs expected ${mean.toFixed(2)} req/s`,
        });
      }
    });

    return anomalies;
  }

  private analyzeTrends(result: LoadTestResult): PerformanceTrend[] {
    const trends: PerformanceTrend[] = [];
    
    if (!result.timeSeriesMetrics || result.timeSeriesMetrics.length < 5) {
      return trends;
    }

    const metrics = result.timeSeriesMetrics;
    const duration = result.duration;

    // Response time trend
    const responseTimeTrend = this.calculateTrend(
      metrics.map(m => m.averageResponseTime),
      duration
    );
    trends.push({
      metric: 'Response Time',
      direction: responseTimeTrend.direction,
      rate: responseTimeTrend.rate,
      confidence: responseTimeTrend.confidence,
      startValue: metrics[0]?.averageResponseTime || 0,
      endValue: metrics[metrics.length - 1]?.averageResponseTime || 0,
      duration,
    });

    // Throughput trend
    const throughputTrend = this.calculateTrend(
      metrics.map(m => m.throughput),
      duration
    );
    trends.push({
      metric: 'Throughput',
      direction: throughputTrend.direction,
      rate: throughputTrend.rate,
      confidence: throughputTrend.confidence,
      startValue: metrics[0]?.throughput || 0,
      endValue: metrics[metrics.length - 1]?.throughput || 0,
      duration,
    });

    return trends;
  }

  private generateInsights(result: LoadTestResult): PerformanceInsight[] {
    const insights: PerformanceInsight[] = [];

    // High error rate insight
    if (result.metrics.errorRate > 5) {
      insights.push({
        category: 'reliability',
        title: 'High Error Rate Detected',
        description: `Error rate of ${result.metrics.errorRate.toFixed(2)}% exceeds acceptable threshold`,
        impact: result.metrics.errorRate > 10 ? 'critical' : 'high',
        recommendation: 'Investigate error patterns and implement proper error handling',
        evidence: [{ errorRate: result.metrics.errorRate, threshold: 5 }],
      });
    }

    // High response time variance insight
    if (result.metrics.p99ResponseTime > result.metrics.averageResponseTime * 3) {
      insights.push({
        category: 'bottleneck',
        title: 'High Response Time Variance',
        description: 'Large difference between average and P99 response times indicates inconsistent performance',
        impact: 'medium',
        recommendation: 'Investigate system capacity and potential resource contention',
        evidence: [
          { average: result.metrics.averageResponseTime, p99: result.metrics.p99ResponseTime }
        ],
      });
    }

    // Resource utilization insights
    if (result.metrics.resourceUsage.cpu > 80) {
      insights.push({
        category: 'scaling',
        title: 'High CPU Utilization',
        description: `CPU usage at ${result.metrics.resourceUsage.cpu.toFixed(1)}% may limit system capacity`,
        impact: 'high',
        recommendation: 'Consider CPU optimization or horizontal scaling',
        evidence: [{ cpuUsage: result.metrics.resourceUsage.cpu }],
      });
    }

    return insights;
  }

  private calculateOverallScore(result: LoadTestResult, analysis: AnalysisResult): number {
    let score = 100;

    // Deduct for SLA violations
    score -= result.slaViolations.length * 15;

    // Deduct for high error rate
    if (result.metrics.errorRate > 1) {
      score -= Math.min(result.metrics.errorRate * 5, 30);
    }

    // Deduct for regressions
    analysis.regressions.forEach(regression => {
      switch (regression.severity) {
        case 'critical': score -= 25; break;
        case 'major': score -= 15; break;
        case 'moderate': score -= 10; break;
        case 'minor': score -= 5; break;
      }
    });

    // Deduct for high-severity anomalies
    analysis.anomalies.forEach(anomaly => {
      if (anomaly.severity === 'high') score -= 10;
      else if (anomaly.severity === 'medium') score -= 5;
    });

    return Math.max(0, Math.min(100, score));
  }

  private calculateGrade(score: number): 'A' | 'B' | 'C' | 'D' | 'F' {
    if (score >= 90) return 'A';
    if (score >= 80) return 'B';
    if (score >= 70) return 'C';
    if (score >= 60) return 'D';
    return 'F';
  }

  private identifyPrimaryBottleneck(result: LoadTestResult, analysis: AnalysisResult): string {
    // Check for critical insights
    const criticalInsights = analysis.insights.filter(i => i.impact === 'critical');
    if (criticalInsights.length > 0) {
      return criticalInsights[0]?.title || 'unknown';
    }

    // Check for high resource usage
    if (result.metrics.resourceUsage.cpu > 80) {
      return 'CPU Usage';
    }
    if (result.metrics.resourceUsage.memory > 1000) {
      return 'Memory Usage';
    }

    // Check for high error rate
    if (result.metrics.errorRate > 5) {
      return 'Error Rate';
    }

    // Check for high response time
    if (result.metrics.p95ResponseTime > 1000) {
      return 'Response Time';
    }

    return 'No significant bottleneck detected';
  }

  private generateKeyFindings(analysis: AnalysisResult): string[] {
    const findings: string[] = [];

    // Add regression findings
    analysis.regressions.forEach(regression => {
      findings.push(`${regression.metric} ${regression.changePercent > 0 ? 'increased' : 'decreased'} by ${Math.abs(regression.changePercent * 100).toFixed(1)}%`);
    });

    // Add critical insights
    analysis.insights
      .filter(i => i.impact === 'critical' || i.impact === 'high')
      .forEach(insight => {
        findings.push(insight.title);
      });

    return findings.slice(0, 5); // Limit to top 5 findings
  }

  private generateRecommendations(analysis: AnalysisResult): string[] {
    const recommendations = new Set<string>();

    // Add insight recommendations
    analysis.insights.forEach(insight => {
      recommendations.add(insight.recommendation);
    });

    // Add general recommendations based on patterns
    if (analysis.anomalies.some(a => a.metric === 'CPU Usage')) {
      recommendations.add('Implement CPU monitoring and alerting');
    }

    if (analysis.anomalies.some(a => a.metric === 'Response Time')) {
      recommendations.add('Review application performance and database queries');
    }

    return Array.from(recommendations);
  }

  // Utility methods
  private calculateChange(baseline: number, current: number): number {
    if (baseline === 0) return current > 0 ? 1 : 0;
    return (current - baseline) / baseline;
  }

  private calculateSeverity(change: number, threshold: number): 'minor' | 'moderate' | 'major' | 'critical' {
    const ratio = change / threshold;
    if (ratio > 4) return 'critical';
    if (ratio > 2) return 'major';
    if (ratio > 1.5) return 'moderate';
    return 'minor';
  }

  private calculateMean(values: number[]): number {
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }

  private calculateStandardDeviation(values: number[], mean: number): number {
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    return Math.sqrt(variance);
  }

  private calculateTrend(values: number[], duration: number) {
    if (values.length < 2) {
      return { direction: 'stable' as const, rate: 0, confidence: 0 };
    }

    // Simple linear regression
    const n = values.length;
    const xValues = Array.from({ length: n }, (_, i) => i);
    const xMean = (n - 1) / 2;
    const yMean = this.calculateMean(values);

    const numerator = xValues.reduce((sum, x, i) => sum + (x - xMean) * (values[i]! - yMean), 0);
    const denominator = xValues.reduce((sum, x) => sum + Math.pow(x - xMean, 2), 0);

    const slope = denominator === 0 ? 0 : numerator / denominator;
    const ratePerHour = (slope * (3600000 / duration)) * n; // Convert to per hour

    // Calculate correlation coefficient for confidence
    const correlation = this.calculateCorrelation(xValues, values);
    const confidence = Math.abs(correlation);

    let direction: 'improving' | 'degrading' | 'stable';
    if (Math.abs(slope) < 0.001) {
      direction = 'stable';
    } else {
      direction = slope > 0 ? 'degrading' : 'improving';
    }

    return { direction, rate: ratePerHour, confidence };
  }

  private calculateCorrelation(x: number[], y: number[]): number {
    const n = x.length;
    const xMean = this.calculateMean(x);
    const yMean = this.calculateMean(y);

    const numerator = x.reduce((sum, xi, i) => sum + (xi - xMean) * (y[i]! - yMean), 0);
    const xVariance = x.reduce((sum, xi) => sum + Math.pow(xi - xMean, 2), 0);
    const yVariance = y.reduce((sum, yi) => sum + Math.pow(yi - yMean, 2), 0);

    const denominator = Math.sqrt(xVariance * yVariance);
    return denominator === 0 ? 0 : numerator / denominator;
  }
}