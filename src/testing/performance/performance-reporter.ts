/**
 * Performance Reporter
 * Comprehensive reporting and visualization system for performance test results
 */

import fs from 'fs/promises';
import path from 'path';
import { Logger } from 'winston';
import { createLogger, format, transports } from 'winston';
import { LoadTestResult, PerformanceMetrics } from './performance-testing-framework';
import { AnalysisResult, PerformanceAnalyzer } from './performance-analyzer';
import { PerformanceSnapshot } from './performance-monitor';

export interface ReportConfig {
  outputDir: string;
  format: 'html' | 'json' | 'csv' | 'markdown' | 'all';
  includeCharts: boolean;
  includeRawData: boolean;
  template?: string;
}

export interface ComparisonReport {
  baseline: LoadTestResult;
  current: LoadTestResult;
  analysis: AnalysisResult;
  summary: {
    improved: string[];
    degraded: string[];
    stable: string[];
  };
}

export interface TrendReport {
  period: {
    start: Date;
    end: Date;
  };
  results: LoadTestResult[];
  trends: {
    responseTime: number[];
    throughput: number[];
    errorRate: number[];
  };
  insights: string[];
}

export class PerformanceReporter {
  private logger: Logger;
  private analyzer: PerformanceAnalyzer;

  constructor() {
    this.logger = createLogger({
      level: 'info',
      format: format.combine(
        format.timestamp(),
        format.simple()
      ),
      transports: [
        new transports.Console(),
        new transports.File({ filename: 'logs/performance-reporter.log' })
      ],
    });
    this.analyzer = new PerformanceAnalyzer();
  }

  async generateReport(
    result: LoadTestResult,
    config: ReportConfig,
    baseline?: LoadTestResult
  ): Promise<string[]> {
    this.logger.info(`Generating performance report in format: ${config.format}`);

    // Ensure output directory exists
    await this.ensureDirectoryExists(config.outputDir);

    // Perform analysis
    const analysis = this.analyzer.analyzeTestResult(result, baseline);

    const generatedFiles: string[] = [];

    if (config.format === 'all' || config.format === 'html') {
      const htmlFile = await this.generateHtmlReport(result, analysis, config);
      generatedFiles.push(htmlFile);
    }

    if (config.format === 'all' || config.format === 'json') {
      const jsonFile = await this.generateJsonReport(result, analysis, config);
      generatedFiles.push(jsonFile);
    }

    if (config.format === 'all' || config.format === 'csv') {
      const csvFiles = await this.generateCsvReports(result, config);
      generatedFiles.push(...csvFiles);
    }

    if (config.format === 'all' || config.format === 'markdown') {
      const mdFile = await this.generateMarkdownReport(result, analysis, config);
      generatedFiles.push(mdFile);
    }

    this.logger.info(`Generated ${generatedFiles.length} report files`);
    return generatedFiles;
  }

  async generateComparisonReport(
    baseline: LoadTestResult,
    current: LoadTestResult,
    config: ReportConfig
  ): Promise<string> {
    const analysis = this.analyzer.analyzeTestResult(current, baseline);
    
    const comparison: ComparisonReport = {
      baseline,
      current,
      analysis,
      summary: this.generateComparisonSummary(baseline, current, analysis),
    };

    const filename = path.join(config.outputDir, `comparison-report-${Date.now()}.html`);
    const html = this.generateComparisonHtml(comparison);
    
    await fs.writeFile(filename, html, 'utf-8');
    this.logger.info(`Comparison report generated: ${filename}`);
    
    return filename;
  }

  async generateTrendReport(
    results: LoadTestResult[],
    config: ReportConfig
  ): Promise<string> {
    if (results.length < 2) {
      throw new Error('At least 2 test results required for trend analysis');
    }

    const trendReport: TrendReport = {
      period: {
        start: new Date(Math.min(...results.map(r => new Date(r.metrics.timestamp).getTime()))),
        end: new Date(Math.max(...results.map(r => new Date(r.metrics.timestamp).getTime()))),
      },
      results,
      trends: {
        responseTime: results.map(r => r.metrics.averageResponseTime),
        throughput: results.map(r => r.metrics.throughput),
        errorRate: results.map(r => r.metrics.errorRate),
      },
      insights: this.generateTrendInsights(results),
    };

    const filename = path.join(config.outputDir, `trend-report-${Date.now()}.html`);
    const html = this.generateTrendHtml(trendReport);
    
    await fs.writeFile(filename, html, 'utf-8');
    this.logger.info(`Trend report generated: ${filename}`);
    
    return filename;
  }

  private async generateHtmlReport(
    result: LoadTestResult,
    analysis: AnalysisResult,
    config: ReportConfig
  ): Promise<string> {
    const filename = path.join(config.outputDir, `performance-report-${Date.now()}.html`);
    const html = this.generateHtmlContent(result, analysis, config);
    
    await fs.writeFile(filename, html, 'utf-8');
    return filename;
  }

  private async generateJsonReport(
    result: LoadTestResult,
    analysis: AnalysisResult,
    config: ReportConfig
  ): Promise<string> {
    const filename = path.join(config.outputDir, `performance-report-${Date.now()}.json`);
    
    const reportData = {
      timestamp: new Date().toISOString(),
      testResult: config.includeRawData ? result : {
        config: result.config,
        metrics: result.metrics,
        duration: result.duration,
        success: result.success,
        slaViolations: result.slaViolations,
        bottlenecks: result.bottlenecks,
        recommendations: result.recommendations,
      },
      analysis,
    };
    
    await fs.writeFile(filename, JSON.stringify(reportData, null, 2), 'utf-8');
    return filename;
  }

  private async generateCsvReports(
    result: LoadTestResult,
    config: ReportConfig
  ): Promise<string[]> {
    const files: string[] = [];

    // Summary metrics CSV
    const summaryFile = path.join(config.outputDir, `performance-summary-${Date.now()}.csv`);
    const summaryData = this.generateSummaryCsv(result);
    await fs.writeFile(summaryFile, summaryData, 'utf-8');
    files.push(summaryFile);

    // Time series data CSV (if available and requested)
    if (config.includeRawData && result.timeSeriesMetrics && result.timeSeriesMetrics.length > 0) {
      const timeSeriesFile = path.join(config.outputDir, `performance-timeseries-${Date.now()}.csv`);
      const timeSeriesData = this.generateTimeSeriesCsv(result.timeSeriesMetrics);
      await fs.writeFile(timeSeriesFile, timeSeriesData, 'utf-8');
      files.push(timeSeriesFile);
    }

    return files;
  }

  private async generateMarkdownReport(
    result: LoadTestResult,
    analysis: AnalysisResult,
    config: ReportConfig
  ): Promise<string> {
    const filename = path.join(config.outputDir, `performance-report-${Date.now()}.md`);
    const markdown = this.generateMarkdownContent(result, analysis);
    
    await fs.writeFile(filename, markdown, 'utf-8');
    return filename;
  }

  private generateHtmlContent(
    result: LoadTestResult,
    analysis: AnalysisResult,
    config: ReportConfig
  ): string {
    const chartScripts = config.includeCharts ? this.generateChartScripts(result) : '';
    
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Performance Test Report - ${result.config.name}</title>
    <style>
        ${this.getReportStyles()}
    </style>
    ${config.includeCharts ? '<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>' : ''}
</head>
<body>
    <div class="container">
        <header>
            <h1>Performance Test Report</h1>
            <div class="test-info">
                <h2>${result.config.name}</h2>
                <p><strong>Generated:</strong> ${new Date().toISOString()}</p>
                <p><strong>Duration:</strong> ${(result.duration / 1000).toFixed(2)}s</p>
                <p><strong>Status:</strong> <span class="status ${result.success ? 'success' : 'failure'}">${result.success ? 'PASSED' : 'FAILED'}</span></p>
            </div>
        </header>

        <section class="summary">
            <h2>Executive Summary</h2>
            <div class="summary-grid">
                <div class="metric-card">
                    <h3>Performance Score</h3>
                    <div class="score grade-${analysis.summary.performanceGrade.toLowerCase()}">${analysis.summary.overallScore}/100</div>
                    <div class="grade">Grade: ${analysis.summary.performanceGrade}</div>
                </div>
                <div class="metric-card">
                    <h3>Response Time</h3>
                    <div class="value">${result.metrics.averageResponseTime.toFixed(2)}ms</div>
                    <div class="sub-value">P95: ${result.metrics.p95ResponseTime.toFixed(2)}ms</div>
                </div>
                <div class="metric-card">
                    <h3>Throughput</h3>
                    <div class="value">${result.metrics.throughput.toFixed(2)}</div>
                    <div class="sub-value">req/sec</div>
                </div>
                <div class="metric-card">
                    <h3>Error Rate</h3>
                    <div class="value ${result.metrics.errorRate > 1 ? 'error' : ''}">${result.metrics.errorRate.toFixed(2)}%</div>
                    <div class="sub-value">${result.metrics.failedRequests}/${result.metrics.totalRequests}</div>
                </div>
            </div>
        </section>

        ${this.generateAnalysisSection(analysis)}
        ${this.generateMetricsSection(result)}
        ${this.generateResourceSection(result)}
        ${config.includeCharts ? '<section class="charts"><h2>Performance Charts</h2><div id="charts-container"></div></section>' : ''}
        ${this.generateRecommendationsSection(result, analysis)}
    </div>

    ${chartScripts}
</body>
</html>`;
  }

  private generateComparisonHtml(comparison: ComparisonReport): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Performance Comparison Report</title>
    <style>${this.getReportStyles()}</style>
</head>
<body>
    <div class="container">
        <header>
            <h1>Performance Comparison Report</h1>
            <p><strong>Generated:</strong> ${new Date().toISOString()}</p>
        </header>

        <section class="comparison-summary">
            <h2>Comparison Summary</h2>
            <div class="comparison-grid">
                <div class="comparison-item">
                    <h3>Improved Metrics</h3>
                    <ul>${comparison.summary.improved.map(item => `<li class="improved">${item}</li>`).join('')}</ul>
                </div>
                <div class="comparison-item">
                    <h3>Degraded Metrics</h3>
                    <ul>${comparison.summary.degraded.map(item => `<li class="degraded">${item}</li>`).join('')}</ul>
                </div>
                <div class="comparison-item">
                    <h3>Stable Metrics</h3>
                    <ul>${comparison.summary.stable.map(item => `<li class="stable">${item}</li>`).join('')}</ul>
                </div>
            </div>
        </section>

        ${this.generateRegressionSection(comparison.analysis)}
        ${this.generateComparisonMetricsTable(comparison.baseline, comparison.current)}
    </div>
</body>
</html>`;
  }

  private generateTrendHtml(trendReport: TrendReport): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Performance Trend Report</title>
    <style>${this.getReportStyles()}</style>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
</head>
<body>
    <div class="container">
        <header>
            <h1>Performance Trend Report</h1>
            <p><strong>Period:</strong> ${trendReport.period.start.toISOString()} - ${trendReport.period.end.toISOString()}</p>
            <p><strong>Test Runs:</strong> ${trendReport.results.length}</p>
        </header>

        <section class="trends">
            <h2>Performance Trends</h2>
            <div class="chart-container">
                <canvas id="trendChart"></canvas>
            </div>
        </section>

        <section class="insights">
            <h2>Trend Insights</h2>
            <ul>
                ${trendReport.insights.map(insight => `<li>${insight}</li>`).join('')}
            </ul>
        </section>
    </div>

    <script>
        ${this.generateTrendChartScript(trendReport)}
    </script>
</body>
</html>`;
  }

  private generateMarkdownContent(result: LoadTestResult, analysis: AnalysisResult): string {
    return `# Performance Test Report

## ${result.config.name}

**Generated:** ${new Date().toISOString()}  
**Duration:** ${(result.duration / 1000).toFixed(2)}s  
**Status:** ${result.success ? '✅ PASSED' : '❌ FAILED'}  

## Executive Summary

- **Performance Score:** ${analysis.summary.overallScore}/100 (Grade: ${analysis.summary.performanceGrade})
- **Primary Bottleneck:** ${analysis.summary.primaryBottleneck}
- **Key Findings:**
${analysis.summary.keyFindings.map(finding => `  - ${finding}`).join('\n')}

## Metrics Summary

| Metric | Value |
|--------|-------|
| Average Response Time | ${result.metrics.averageResponseTime.toFixed(2)}ms |
| P95 Response Time | ${result.metrics.p95ResponseTime.toFixed(2)}ms |
| P99 Response Time | ${result.metrics.p99ResponseTime.toFixed(2)}ms |
| Throughput | ${result.metrics.throughput.toFixed(2)} req/sec |
| Error Rate | ${result.metrics.errorRate.toFixed(2)}% |
| Total Requests | ${result.metrics.totalRequests} |
| Failed Requests | ${result.metrics.failedRequests} |

## Resource Usage

| Resource | Usage |
|----------|-------|
| CPU | ${result.metrics.resourceUsage.cpu.toFixed(1)}% |
| Memory | ${(result.metrics.resourceUsage.memory / 1024 / 1024).toFixed(1)}MB |
| Heap Used | ${(result.metrics.resourceUsage.heapUsed / 1024 / 1024).toFixed(1)}MB |

## Analysis Results

### Regressions
${analysis.regressions.length === 0 ? 'No regressions detected.' : ''}
${analysis.regressions.map(r => `- **${r.metric}:** ${(r.changePercent * 100).toFixed(1)}% change (${r.severity})`).join('\n')}

### Anomalies
${analysis.anomalies.length === 0 ? 'No anomalies detected.' : ''}
${analysis.anomalies.map(a => `- **${a.metric}:** ${a.description} (${a.severity})`).join('\n')}

## Recommendations

${analysis.recommendations.map(rec => `- ${rec}`).join('\n')}

## SLA Violations

${result.slaViolations.length === 0 ? 'No SLA violations.' : ''}
${result.slaViolations.map(violation => `- ${violation}`).join('\n')}
`;
  }

  private generateSummaryCsv(result: LoadTestResult): string {
    const headers = [
      'Timestamp', 'Test Name', 'Duration (s)', 'Success', 'Total Requests', 'Failed Requests',
      'Avg Response Time (ms)', 'P95 Response Time (ms)', 'P99 Response Time (ms)',
      'Throughput (req/s)', 'Error Rate (%)', 'CPU Usage (%)', 'Memory Usage (MB)'
    ];

    const row = [
      new Date().toISOString(),
      result.config.name,
      (result.duration / 1000).toFixed(2),
      result.success,
      result.metrics.totalRequests,
      result.metrics.failedRequests,
      result.metrics.averageResponseTime.toFixed(2),
      result.metrics.p95ResponseTime.toFixed(2),
      result.metrics.p99ResponseTime.toFixed(2),
      result.metrics.throughput.toFixed(2),
      result.metrics.errorRate.toFixed(2),
      result.metrics.resourceUsage.cpu.toFixed(1),
      (result.metrics.resourceUsage.memory / 1024 / 1024).toFixed(1)
    ];

    return headers.join(',') + '\n' + row.join(',');
  }

  private generateTimeSeriesCsv(timeSeriesMetrics: PerformanceMetrics[]): string {
    const headers = [
      'Timestamp', 'Total Requests', 'Successful Requests', 'Failed Requests',
      'Avg Response Time (ms)', 'Median Response Time (ms)', 'P95 Response Time (ms)', 'P99 Response Time (ms)',
      'Throughput (req/s)', 'Error Rate (%)', 'CPU Usage (%)', 'Memory Usage (MB)'
    ];

    const rows = timeSeriesMetrics.map(metric => [
      metric.timestamp.toISOString(),
      metric.totalRequests,
      metric.successfulRequests,
      metric.failedRequests,
      metric.averageResponseTime.toFixed(2),
      metric.medianResponseTime.toFixed(2),
      metric.p95ResponseTime.toFixed(2),
      metric.p99ResponseTime.toFixed(2),
      metric.throughput.toFixed(2),
      metric.errorRate.toFixed(2),
      metric.resourceUsage.cpu.toFixed(1),
      (metric.resourceUsage.memory / 1024 / 1024).toFixed(1)
    ]);

    return headers.join(',') + '\n' + rows.map(row => row.join(',')).join('\n');
  }

  private generateComparisonSummary(
    baseline: LoadTestResult,
    current: LoadTestResult,
    analysis: AnalysisResult
  ) {
    const improved: string[] = [];
    const degraded: string[] = [];
    const stable: string[] = [];

    // Check response time
    const responseTimeChange = (current.metrics.averageResponseTime - baseline.metrics.averageResponseTime) / baseline.metrics.averageResponseTime;
    if (responseTimeChange < -0.05) improved.push('Response Time');
    else if (responseTimeChange > 0.05) degraded.push('Response Time');
    else stable.push('Response Time');

    // Check throughput
    const throughputChange = (current.metrics.throughput - baseline.metrics.throughput) / baseline.metrics.throughput;
    if (throughputChange > 0.05) improved.push('Throughput');
    else if (throughputChange < -0.05) degraded.push('Throughput');
    else stable.push('Throughput');

    // Check error rate
    const errorRateChange = current.metrics.errorRate - baseline.metrics.errorRate;
    if (errorRateChange < -0.01) improved.push('Error Rate');
    else if (errorRateChange > 0.01) degraded.push('Error Rate');
    else stable.push('Error Rate');

    return { improved, degraded, stable };
  }

  private generateTrendInsights(results: LoadTestResult[]): string[] {
    const insights: string[] = [];
    
    if (results.length < 3) return insights;

    // Analyze response time trend
    const responseTimes = results.map(r => r.metrics.averageResponseTime);
    const firstHalf = responseTimes.slice(0, Math.floor(responseTimes.length / 2));
    const secondHalf = responseTimes.slice(Math.floor(responseTimes.length / 2));
    
    const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
    
    if (secondAvg > firstAvg * 1.1) {
      insights.push('Response time is trending upward - performance degradation detected');
    } else if (secondAvg < firstAvg * 0.9) {
      insights.push('Response time is trending downward - performance improvement detected');
    }

    // Analyze error rate trend
    const errorRates = results.map(r => r.metrics.errorRate);
    const avgErrorRate = errorRates.reduce((a, b) => a + b, 0) / errorRates.length;
    if (avgErrorRate > 1) {
      insights.push('Consistent error rate above 1% across test runs');
    }

    return insights;
  }

  // Helper methods for HTML generation
  private generateAnalysisSection(analysis: AnalysisResult): string {
    return `
        <section class="analysis">
            <h2>Analysis Results</h2>
            
            ${analysis.regressions.length > 0 ? `
            <div class="analysis-section">
                <h3>Performance Regressions</h3>
                <ul class="regression-list">
                    ${analysis.regressions.map(r => `
                        <li class="regression ${r.severity}">
                            <strong>${r.metric}:</strong> ${(r.changePercent * 100).toFixed(1)}% change
                            <span class="severity">(${r.severity})</span>
                        </li>
                    `).join('')}
                </ul>
            </div>` : ''}

            ${analysis.insights.length > 0 ? `
            <div class="analysis-section">
                <h3>Performance Insights</h3>
                <ul class="insights-list">
                    ${analysis.insights.map(insight => `
                        <li class="insight ${insight.impact}">
                            <strong>${insight.title}:</strong> ${insight.description}
                            <div class="recommendation">💡 ${insight.recommendation}</div>
                        </li>
                    `).join('')}
                </ul>
            </div>` : ''}
        </section>`;
  }

  private generateMetricsSection(result: LoadTestResult): string {
    return `
        <section class="metrics">
            <h2>Detailed Metrics</h2>
            <table class="metrics-table">
                <thead>
                    <tr>
                        <th>Metric</th>
                        <th>Value</th>
                        <th>Target</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>Average Response Time</td>
                        <td>${result.metrics.averageResponseTime.toFixed(2)}ms</td>
                        <td>${result.config.slaRequirements.maxResponseTime}ms</td>
                        <td class="${result.metrics.averageResponseTime <= result.config.slaRequirements.maxResponseTime ? 'pass' : 'fail'}">
                            ${result.metrics.averageResponseTime <= result.config.slaRequirements.maxResponseTime ? '✅' : '❌'}
                        </td>
                    </tr>
                    <tr>
                        <td>Throughput</td>
                        <td>${result.metrics.throughput.toFixed(2)} req/s</td>
                        <td>${result.config.slaRequirements.minThroughput} req/s</td>
                        <td class="${result.metrics.throughput >= result.config.slaRequirements.minThroughput ? 'pass' : 'fail'}">
                            ${result.metrics.throughput >= result.config.slaRequirements.minThroughput ? '✅' : '❌'}
                        </td>
                    </tr>
                    <tr>
                        <td>Error Rate</td>
                        <td>${result.metrics.errorRate.toFixed(2)}%</td>
                        <td>${result.config.slaRequirements.maxErrorRate}%</td>
                        <td class="${result.metrics.errorRate <= result.config.slaRequirements.maxErrorRate ? 'pass' : 'fail'}">
                            ${result.metrics.errorRate <= result.config.slaRequirements.maxErrorRate ? '✅' : '❌'}
                        </td>
                    </tr>
                </tbody>
            </table>
        </section>`;
  }

  private generateResourceSection(result: LoadTestResult): string {
    return `
        <section class="resources">
            <h2>Resource Utilization</h2>
            <div class="resource-grid">
                <div class="resource-item">
                    <h3>CPU Usage</h3>
                    <div class="resource-value">${result.metrics.resourceUsage.cpu.toFixed(1)}%</div>
                    <div class="resource-bar">
                        <div class="resource-fill" style="width: ${Math.min(result.metrics.resourceUsage.cpu, 100)}%"></div>
                    </div>
                </div>
                <div class="resource-item">
                    <h3>Memory Usage</h3>
                    <div class="resource-value">${(result.metrics.resourceUsage.memory / 1024 / 1024).toFixed(1)}MB</div>
                    <div class="resource-bar">
                        <div class="resource-fill" style="width: ${Math.min((result.metrics.resourceUsage.memory / result.metrics.resourceUsage.heapTotal) * 100, 100)}%"></div>
                    </div>
                </div>
            </div>
        </section>`;
  }

  private generateRecommendationsSection(result: LoadTestResult, analysis: AnalysisResult): string {
    const allRecommendations = [...result.recommendations, ...analysis.recommendations];
    
    if (allRecommendations.length === 0) {
      return '<section class="recommendations"><h2>Recommendations</h2><p>No specific recommendations at this time.</p></section>';
    }

    return `
        <section class="recommendations">
            <h2>Recommendations</h2>
            <ul class="recommendations-list">
                ${allRecommendations.map(rec => `<li>${rec}</li>`).join('')}
            </ul>
        </section>`;
  }

  private generateRegressionSection(analysis: AnalysisResult): string {
    if (analysis.regressions.length === 0) {
      return '<section class="regressions"><h2>Regressions</h2><p>No performance regressions detected.</p></section>';
    }

    return `
        <section class="regressions">
            <h2>Performance Regressions</h2>
            <table class="regressions-table">
                <thead>
                    <tr>
                        <th>Metric</th>
                        <th>Baseline</th>
                        <th>Current</th>
                        <th>Change</th>
                        <th>Severity</th>
                    </tr>
                </thead>
                <tbody>
                    ${analysis.regressions.map(r => `
                        <tr class="regression ${r.severity}">
                            <td>${r.metric}</td>
                            <td>${r.baseline.toFixed(2)}</td>
                            <td>${r.current.toFixed(2)}</td>
                            <td>${(r.changePercent * 100).toFixed(1)}%</td>
                            <td class="severity-${r.severity}">${r.severity}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </section>`;
  }

  private generateComparisonMetricsTable(baseline: LoadTestResult, current: LoadTestResult): string {
    return `
        <section class="comparison-metrics">
            <h2>Detailed Comparison</h2>
            <table class="comparison-table">
                <thead>
                    <tr>
                        <th>Metric</th>
                        <th>Baseline</th>
                        <th>Current</th>
                        <th>Change</th>
                        <th>Trend</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>Average Response Time</td>
                        <td>${baseline.metrics.averageResponseTime.toFixed(2)}ms</td>
                        <td>${current.metrics.averageResponseTime.toFixed(2)}ms</td>
                        <td>${(((current.metrics.averageResponseTime - baseline.metrics.averageResponseTime) / baseline.metrics.averageResponseTime) * 100).toFixed(1)}%</td>
                        <td>${current.metrics.averageResponseTime < baseline.metrics.averageResponseTime ? '📈' : '📉'}</td>
                    </tr>
                    <tr>
                        <td>Throughput</td>
                        <td>${baseline.metrics.throughput.toFixed(2)}</td>
                        <td>${current.metrics.throughput.toFixed(2)}</td>
                        <td>${(((current.metrics.throughput - baseline.metrics.throughput) / baseline.metrics.throughput) * 100).toFixed(1)}%</td>
                        <td>${current.metrics.throughput > baseline.metrics.throughput ? '📈' : '📉'}</td>
                    </tr>
                    <tr>
                        <td>Error Rate</td>
                        <td>${baseline.metrics.errorRate.toFixed(2)}%</td>
                        <td>${current.metrics.errorRate.toFixed(2)}%</td>
                        <td>${(current.metrics.errorRate - baseline.metrics.errorRate).toFixed(2)}%</td>
                        <td>${current.metrics.errorRate < baseline.metrics.errorRate ? '📈' : '📉'}</td>
                    </tr>
                </tbody>
            </table>
        </section>`;
  }

  private generateChartScripts(result: LoadTestResult): string {
    if (!result.timeSeriesMetrics || result.timeSeriesMetrics.length === 0) {
      return '';
    }

    return `
    <script>
        // Generate performance charts
        const timeSeriesData = ${JSON.stringify(result.timeSeriesMetrics)};
        
        // Response Time Chart
        const ctx1 = document.createElement('canvas');
        ctx1.id = 'responseTimeChart';
        document.getElementById('charts-container').appendChild(ctx1);
        
        new Chart(ctx1, {
            type: 'line',
            data: {
                labels: timeSeriesData.map(d => new Date(d.timestamp).toLocaleTimeString()),
                datasets: [{
                    label: 'Average Response Time (ms)',
                    data: timeSeriesData.map(d => d.averageResponseTime),
                    borderColor: 'rgb(75, 192, 192)',
                    tension: 0.1
                }]
            },
            options: {
                responsive: true,
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });

        // Throughput Chart
        const ctx2 = document.createElement('canvas');
        ctx2.id = 'throughputChart';
        document.getElementById('charts-container').appendChild(ctx2);
        
        new Chart(ctx2, {
            type: 'line',
            data: {
                labels: timeSeriesData.map(d => new Date(d.timestamp).toLocaleTimeString()),
                datasets: [{
                    label: 'Throughput (req/s)',
                    data: timeSeriesData.map(d => d.throughput),
                    borderColor: 'rgb(255, 99, 132)',
                    tension: 0.1
                }]
            },
            options: {
                responsive: true,
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });
    </script>`;
  }

  private generateTrendChartScript(trendReport: TrendReport): string {
    return `
        const ctx = document.getElementById('trendChart').getContext('2d');
        new Chart(ctx, {
            type: 'line',
            data: {
                labels: ${JSON.stringify(trendReport.results.map((_, i) => `Run ${i + 1}`))},
                datasets: [
                    {
                        label: 'Response Time (ms)',
                        data: ${JSON.stringify(trendReport.trends.responseTime)},
                        borderColor: 'rgb(75, 192, 192)',
                        yAxisID: 'y'
                    },
                    {
                        label: 'Throughput (req/s)',
                        data: ${JSON.stringify(trendReport.trends.throughput)},
                        borderColor: 'rgb(255, 99, 132)',
                        yAxisID: 'y1'
                    },
                    {
                        label: 'Error Rate (%)',
                        data: ${JSON.stringify(trendReport.trends.errorRate)},
                        borderColor: 'rgb(255, 205, 86)',
                        yAxisID: 'y2'
                    }
                ]
            },
            options: {
                responsive: true,
                scales: {
                    y: {
                        type: 'linear',
                        display: true,
                        position: 'left',
                    },
                    y1: {
                        type: 'linear',
                        display: true,
                        position: 'right',
                        grid: {
                            drawOnChartArea: false,
                        },
                    },
                    y2: {
                        type: 'linear',
                        display: false,
                    }
                }
            }
        });
    `;
  }

  private getReportStyles(): string {
    return `
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif; 
            margin: 0; 
            padding: 0; 
            background-color: #f5f5f5; 
        }
        .container { 
            max-width: 1200px; 
            margin: 0 auto; 
            padding: 20px; 
            background: white; 
            box-shadow: 0 0 10px rgba(0,0,0,0.1); 
        }
        header { 
            border-bottom: 2px solid #eee; 
            padding-bottom: 20px; 
            margin-bottom: 30px; 
        }
        h1 { 
            color: #2c3e50; 
            margin: 0; 
        }
        h2 { 
            color: #34495e; 
            border-bottom: 1px solid #eee; 
            padding-bottom: 10px; 
        }
        .test-info p { 
            margin: 5px 0; 
        }
        .status { 
            padding: 4px 8px; 
            border-radius: 4px; 
            font-weight: bold; 
        }
        .status.success { 
            background: #d4edda; 
            color: #155724; 
        }
        .status.failure { 
            background: #f8d7da; 
            color: #721c24; 
        }
        .summary-grid { 
            display: grid; 
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); 
            gap: 20px; 
            margin: 20px 0; 
        }
        .metric-card { 
            background: #f8f9fa; 
            padding: 20px; 
            border-radius: 8px; 
            text-align: center; 
        }
        .metric-card h3 { 
            margin: 0 0 10px 0; 
            color: #6c757d; 
        }
        .score { 
            font-size: 2em; 
            font-weight: bold; 
            margin: 10px 0; 
        }
        .grade-a { color: #28a745; }
        .grade-b { color: #17a2b8; }
        .grade-c { color: #ffc107; }
        .grade-d { color: #fd7e14; }
        .grade-f { color: #dc3545; }
        .value { 
            font-size: 1.5em; 
            font-weight: bold; 
            color: #2c3e50; 
        }
        .value.error { 
            color: #dc3545; 
        }
        .sub-value { 
            color: #6c757d; 
            font-size: 0.9em; 
        }
        .grade { 
            font-size: 1.2em; 
            font-weight: bold; 
        }
        table { 
            width: 100%; 
            border-collapse: collapse; 
            margin: 20px 0; 
        }
        th, td { 
            padding: 12px; 
            text-align: left; 
            border-bottom: 1px solid #ddd; 
        }
        th { 
            background-color: #f8f9fa; 
            font-weight: 600; 
        }
        .pass { 
            color: #28a745; 
        }
        .fail { 
            color: #dc3545; 
        }
        .resource-grid { 
            display: grid; 
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); 
            gap: 20px; 
        }
        .resource-item { 
            background: #f8f9fa; 
            padding: 20px; 
            border-radius: 8px; 
        }
        .resource-value { 
            font-size: 1.5em; 
            font-weight: bold; 
            margin: 10px 0; 
        }
        .resource-bar { 
            width: 100%; 
            height: 20px; 
            background: #e9ecef; 
            border-radius: 10px; 
            overflow: hidden; 
        }
        .resource-fill { 
            height: 100%; 
            background: linear-gradient(90deg, #28a745, #ffc107, #dc3545); 
            transition: width 0.3s ease; 
        }
        .recommendations-list, .insights-list, .regression-list { 
            list-style: none; 
            padding: 0; 
        }
        .recommendations-list li, .insights-list li, .regression-list li { 
            background: #f8f9fa; 
            margin: 10px 0; 
            padding: 15px; 
            border-radius: 5px; 
            border-left: 4px solid #007bff; 
        }
        .insight.high, .regression.major, .regression.critical { 
            border-left-color: #dc3545; 
        }
        .insight.medium, .regression.moderate { 
            border-left-color: #ffc107; 
        }
        .insight.low, .regression.minor { 
            border-left-color: #28a745; 
        }
        .recommendation { 
            margin-top: 10px; 
            font-style: italic; 
            color: #6c757d; 
        }
        .severity { 
            font-size: 0.8em; 
            text-transform: uppercase; 
            font-weight: bold; 
        }
        .comparison-grid { 
            display: grid; 
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); 
            gap: 20px; 
        }
        .comparison-item { 
            background: #f8f9fa; 
            padding: 20px; 
            border-radius: 8px; 
        }
        .improved { 
            color: #28a745; 
        }
        .degraded { 
            color: #dc3545; 
        }
        .stable { 
            color: #6c757d; 
        }
        .chart-container { 
            margin: 20px 0; 
            height: 400px; 
        }
        #charts-container canvas { 
            margin: 20px 0; 
        }
    `;
  }

  private async ensureDirectoryExists(dir: string): Promise<void> {
    try {
      await fs.access(dir);
    } catch {
      await fs.mkdir(dir, { recursive: true });
    }
  }
}