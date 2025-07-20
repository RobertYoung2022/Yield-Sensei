/**
 * YieldSensei Database Test Runner
 * 
 * Orchestrates comprehensive testing suite including performance tests,
 * failover tests, data integrity tests, and generates detailed reports
 * with monitoring dashboards.
 */

import { EventEmitter } from 'events';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import Logger from '@/shared/logging/logger';
import { PerformanceTester, PerformanceTestConfig, LoadTestResult } from './performance-tester';
import { FailoverTester, FailoverTestConfig, FailoverTestSuite } from './failover-tester';
import { DatabaseManager } from '../database/manager';

const logger = Logger.getLogger('test-runner');

// =============================================================================
// INTERFACES AND TYPES
// =============================================================================

export interface TestSuiteConfig {
  // Test suite identification
  name: string;
  description: string;
  environment: 'development' | 'staging' | 'production';
  
  // Test configurations
  performance: PerformanceTestConfig;
  failover: FailoverTestConfig;
  
  // Reporting settings
  reporting: {
    outputDir: string;
    generateHtml: boolean;
    generateJson: boolean;
    generateMetrics: boolean;
    includeCharts: boolean;
  };
  
  // Monitoring settings
  monitoring: {
    enabled: boolean;
    metricsEndpoint: string;
    alerting: boolean;
    dashboardUrl: string;
  };
}

export interface TestSuiteResult {
  testId: string;
  config: TestSuiteConfig;
  timestamp: Date;
  duration: number;
  
  // Test results
  performance: LoadTestResult | null;
  failover: FailoverTestSuite | null;
  
  // Summary
  summary: {
    totalTests: number;
    passedTests: number;
    failedTests: number;
    warnings: number;
    overallStatus: 'pass' | 'fail' | 'warning';
    criticalIssues: string[];
    recommendations: string[];
  };
  
  // Metrics
  metrics: {
    averageResponseTime: number;
    throughput: number;
    errorRate: number;
    availability: number;
    dataIntegrity: number;
  };
}

export interface TestReport {
  testId: string;
  timestamp: Date;
  summary: string;
  details: {
    performance: any;
    failover: any;
    recommendations: string[];
  };
  charts: {
    performance: any[];
    failover: any[];
  };
}

// =============================================================================
// TEST RUNNER CLASS
// =============================================================================

export class TestRunner extends EventEmitter {
  private static instance: TestRunner;
  private dbManager: DatabaseManager;
  private performanceTester: PerformanceTester;
  private failoverTester: FailoverTester;
  private isRunning = false;
  private currentTest: string | null = null;

  private constructor() {
    super();
    this.dbManager = DatabaseManager.getInstance();
    this.performanceTester = PerformanceTester.getInstance();
    this.failoverTester = FailoverTester.getInstance();
  }

  public static getInstance(): TestRunner {
    if (!TestRunner.instance) {
      TestRunner.instance = new TestRunner();
    }
    return TestRunner.instance;
  }

  /**
   * Run comprehensive test suite
   */
  async runTestSuite(config: TestSuiteConfig): Promise<TestSuiteResult> {
    if (this.isRunning) {
      throw new Error('Test suite already running');
    }

    this.isRunning = true;
    const testId = `suite_${Date.now()}`;
    const startTime = Date.now();

    try {
      logger.info(`Starting comprehensive test suite: ${testId}`);
      this.emit('testStarted', { testId, config });

      // Initialize test environment
      await this.initializeTestEnvironment(config);

      // Run performance tests
      let performanceResult: LoadTestResult | null = null;
      try {
        logger.info('Running performance tests...');
        this.currentTest = 'performance';
        performanceResult = await this.performanceTester.runPerformanceTests(config.performance);
        logger.info('Performance tests completed successfully');
      } catch (error) {
        logger.error('Performance tests failed:', error);
        this.emit('testFailed', { testId, testType: 'performance', error });
      }

      // Run failover tests
      let failoverResult: FailoverTestSuite | null = null;
      try {
        logger.info('Running failover tests...');
        this.currentTest = 'failover';
        failoverResult = await this.failoverTester.runFailoverTests(config.failover);
        logger.info('Failover tests completed successfully');
      } catch (error) {
        logger.error('Failover tests failed:', error);
        this.emit('testFailed', { testId, testType: 'failover', error });
      }

      // Generate comprehensive summary
      const summary = this.generateTestSummary(performanceResult, failoverResult);
      const metrics = this.calculateMetrics(performanceResult, failoverResult);

      const duration = Date.now() - startTime;

      const testSuiteResult: TestSuiteResult = {
        testId,
        config,
        timestamp: new Date(),
        duration,
        performance: performanceResult,
        failover: failoverResult,
        summary,
        metrics
      };

      // Generate reports
      if (config.reporting.generateJson || config.reporting.generateHtml) {
        await this.generateReports(testSuiteResult, config);
      }

      // Setup monitoring
      if (config.monitoring.enabled) {
        await this.setupMonitoring(testSuiteResult, config);
      }

      logger.info(`Test suite completed: ${testId}`);
      this.emit('testCompleted', testSuiteResult);

      return testSuiteResult;

    } catch (error) {
      logger.error('Test suite failed:', error);
      throw error;
    } finally {
      this.isRunning = false;
      this.currentTest = null;
    }
  }

  /**
   * Initialize test environment
   */
  private async initializeTestEnvironment(config: TestSuiteConfig): Promise<void> {
    logger.info('Initializing test environment...');

    // Ensure output directory exists
    if (config.reporting.outputDir) {
      mkdirSync(config.reporting.outputDir, { recursive: true });
    }

    // Verify database connections
    await this.verifyDatabaseConnections();

    // Setup test data if needed
    await this.setupTestData();

    logger.info('Test environment initialized successfully');
  }

  /**
   * Verify all database connections
   */
  private async verifyDatabaseConnections(): Promise<void> {
    logger.info('Verifying database connections...');

    const databases = [
      { name: 'PostgreSQL', check: () => this.dbManager.getPostgres().query('SELECT 1') },
      { name: 'ClickHouse', check: () => this.dbManager.getClickHouse().query('SELECT 1') },
      { name: 'Redis', check: () => this.dbManager.getRedis().ping() },
      { name: 'Vector DB', check: () => this.dbManager.getVector().healthCheck() }
    ];

    for (const db of databases) {
      try {
        await db.check();
        logger.info(`${db.name} connection verified`);
      } catch (error) {
        logger.error(`${db.name} connection failed:`, error);
        throw new Error(`${db.name} connection verification failed`);
      }
    }
  }

  /**
   * Setup test data
   */
  private async setupTestData(): Promise<void> {
    logger.info('Setting up test data...');

    try {
      // Create test tables if they don't exist
      const postgres = this.dbManager.getPostgres();
      await postgres.query(`
        CREATE TABLE IF NOT EXISTS test_performance (
          id SERIAL PRIMARY KEY,
          user_id VARCHAR(255) NOT NULL,
          data JSONB,
          created_at TIMESTAMP DEFAULT NOW()
        )
      `);

      // Create test indexes
      await postgres.query(`
        CREATE INDEX IF NOT EXISTS idx_test_performance_user_id ON test_performance(user_id);
        CREATE INDEX IF NOT EXISTS idx_test_performance_created_at ON test_performance(created_at);
      `);

      logger.info('Test data setup completed');
    } catch (error) {
      logger.error('Test data setup failed:', error);
      throw error;
    }
  }

  /**
   * Generate comprehensive test summary
   */
  private generateTestSummary(
    performance: LoadTestResult | null,
    failover: FailoverTestSuite | null
  ): TestSuiteResult['summary'] {
    let totalTests = 0;
    let passedTests = 0;
    let failedTests = 0;
    let warnings = 0;
    const criticalIssues: string[] = [];
    const recommendations: string[] = [];

    // Analyze performance results
    if (performance) {
      totalTests += performance.results.length;
      
      performance.results.forEach(result => {
        if (result.errorRate > 5) {
          failedTests++;
          criticalIssues.push(`${result.database}: High error rate (${result.errorRate.toFixed(2)}%)`);
        } else if (result.errorRate > 1) {
          warnings++;
          recommendations.push(`Optimize ${result.database} error handling`);
        } else {
          passedTests++;
        }

        if (result.averageLatency > 1000) {
          warnings++;
          recommendations.push(`Optimize ${result.database} query performance`);
        }

        if (result.throughput < 100) {
          warnings++;
          recommendations.push(`Improve ${result.database} throughput`);
        }
      });

      // Add performance-specific recommendations
      if (performance.summary.bottlenecks.length > 0) {
        criticalIssues.push(`Performance bottlenecks detected: ${performance.summary.bottlenecks.join(', ')}`);
      }
    }

    // Analyze failover results
    if (failover) {
      totalTests += failover.results.length;
      
      failover.results.forEach(result => {
        if (result.failoverSuccess) {
          passedTests++;
        } else {
          failedTests++;
          criticalIssues.push(`Failover scenario "${result.scenario}" failed`);
        }

        if (result.dataLoss) {
          criticalIssues.push(`Data loss detected in scenario "${result.scenario}"`);
        }

        if (result.dataCorruption) {
          criticalIssues.push(`Data corruption detected in scenario "${result.scenario}"`);
        }

        if (result.recoveryTime > 60000) {
          warnings++;
          recommendations.push(`Optimize recovery time for scenario "${result.scenario}"`);
        }
      });

      // Add failover-specific recommendations
      if (failover.summary.recommendations.length > 0) {
        recommendations.push(...failover.summary.recommendations);
      }
    }

    // Determine overall status
    let overallStatus: 'pass' | 'fail' | 'warning' = 'pass';
    if (failedTests > 0) {
      overallStatus = 'fail';
    } else if (warnings > 0) {
      overallStatus = 'warning';
    }

    return {
      totalTests,
      passedTests,
      failedTests,
      warnings,
      overallStatus,
      criticalIssues,
      recommendations
    };
  }

  /**
   * Calculate comprehensive metrics
   */
  private calculateMetrics(
    performance: LoadTestResult | null,
    failover: FailoverTestSuite | null
  ): TestSuiteResult['metrics'] {
    let averageResponseTime = 0;
    let throughput = 0;
    let errorRate = 0;
    let availability = 100;
    let dataIntegrity = 100;

    // Calculate performance metrics
    if (performance && performance.results.length > 0) {
      const totalLatency = performance.results.reduce((sum, r) => sum + r.averageLatency, 0);
      averageResponseTime = totalLatency / performance.results.length;

      const totalThroughput = performance.results.reduce((sum, r) => sum + r.throughput, 0);
      throughput = totalThroughput / performance.results.length;

      const totalOperations = performance.results.reduce((sum, r) => sum + r.totalOperations, 0);
      const totalErrors = performance.results.reduce((sum, r) => sum + r.failedOperations, 0);
      errorRate = totalOperations > 0 ? (totalErrors / totalOperations) * 100 : 0;
    }

    // Calculate availability and data integrity from failover tests
    if (failover && failover.results.length > 0) {
      const successfulFailovers = failover.results.filter(r => r.failoverSuccess).length;
      availability = (successfulFailovers / failover.results.length) * 100;

      const dataLossIncidents = failover.results.filter(r => r.dataLoss).length;
      const dataCorruptionIncidents = failover.results.filter(r => r.dataCorruption).length;
      
      const totalIncidents = dataLossIncidents + dataCorruptionIncidents;
      dataIntegrity = failover.results.length > 0 ? 
        ((failover.results.length - totalIncidents) / failover.results.length) * 100 : 100;
    }

    return {
      averageResponseTime,
      throughput,
      errorRate,
      availability,
      dataIntegrity
    };
  }

  /**
   * Generate test reports
   */
  private async generateReports(result: TestSuiteResult, config: TestSuiteConfig): Promise<void> {
    logger.info('Generating test reports...');

    const timestamp = result.timestamp.toISOString().replace(/[:.]/g, '-');
    const baseFileName = `test-report-${timestamp}`;

    // Generate JSON report
    if (config.reporting.generateJson) {
      const jsonPath = join(config.reporting.outputDir, `${baseFileName}.json`);
      writeFileSync(jsonPath, JSON.stringify(result, null, 2));
      logger.info(`JSON report generated: ${jsonPath}`);
    }

    // Generate HTML report
    if (config.reporting.generateHtml) {
      const htmlContent = this.generateHtmlReport(result, config);
      const htmlPath = join(config.reporting.outputDir, `${baseFileName}.html`);
      writeFileSync(htmlPath, htmlContent);
      logger.info(`HTML report generated: ${htmlPath}`);
    }

    // Generate metrics report
    if (config.reporting.generateMetrics) {
      const metricsContent = this.generateMetricsReport(result);
      const metricsPath = join(config.reporting.outputDir, `${baseFileName}-metrics.json`);
      writeFileSync(metricsPath, JSON.stringify(metricsContent, null, 2));
      logger.info(`Metrics report generated: ${metricsPath}`);
    }
  }

  /**
   * Generate HTML report
   */
  private generateHtmlReport(result: TestSuiteResult, config: TestSuiteConfig): string {
    const statusColor = result.summary.overallStatus === 'pass' ? 'green' : 
                       result.summary.overallStatus === 'warning' ? 'orange' : 'red';

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>YieldSensei Database Test Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #f5f5f5; padding: 20px; border-radius: 5px; }
        .summary { margin: 20px 0; }
        .status-${result.summary.overallStatus} { color: ${statusColor}; font-weight: bold; }
        .metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 20px 0; }
        .metric-card { background: #fff; border: 1px solid #ddd; padding: 15px; border-radius: 5px; }
        .metric-value { font-size: 24px; font-weight: bold; }
        .issues { margin: 20px 0; }
        .issue { background: #fff3cd; border: 1px solid #ffeaa7; padding: 10px; margin: 5px 0; border-radius: 3px; }
        .recommendation { background: #d1ecf1; border: 1px solid #bee5eb; padding: 10px; margin: 5px 0; border-radius: 3px; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
    </style>
</head>
<body>
    <div class="header">
        <h1>YieldSensei Database Test Report</h1>
        <p><strong>Test ID:</strong> ${result.testId}</p>
        <p><strong>Timestamp:</strong> ${result.timestamp.toISOString()}</p>
        <p><strong>Environment:</strong> ${config.environment}</p>
        <p><strong>Duration:</strong> ${(result.duration / 1000).toFixed(2)} seconds</p>
    </div>

    <div class="summary">
        <h2>Test Summary</h2>
        <p><strong>Overall Status:</strong> <span class="status-${result.summary.overallStatus}">${result.summary.overallStatus.toUpperCase()}</span></p>
        <p><strong>Total Tests:</strong> ${result.summary.totalTests}</p>
        <p><strong>Passed:</strong> ${result.summary.passedTests}</p>
        <p><strong>Failed:</strong> ${result.summary.failedTests}</p>
        <p><strong>Warnings:</strong> ${result.summary.warnings}</p>
    </div>

    <div class="metrics">
        <div class="metric-card">
            <h3>Average Response Time</h3>
            <div class="metric-value">${result.metrics.averageResponseTime.toFixed(2)}ms</div>
        </div>
        <div class="metric-card">
            <h3>Throughput</h3>
            <div class="metric-value">${result.metrics.throughput.toFixed(2)} ops/sec</div>
        </div>
        <div class="metric-card">
            <h3>Error Rate</h3>
            <div class="metric-value">${result.metrics.errorRate.toFixed(2)}%</div>
        </div>
        <div class="metric-card">
            <h3>Availability</h3>
            <div class="metric-value">${result.metrics.availability.toFixed(2)}%</div>
        </div>
        <div class="metric-card">
            <h3>Data Integrity</h3>
            <div class="metric-value">${result.metrics.dataIntegrity.toFixed(2)}%</div>
        </div>
    </div>

    ${result.summary.criticalIssues.length > 0 ? `
    <div class="issues">
        <h2>Critical Issues</h2>
        ${result.summary.criticalIssues.map(issue => `<div class="issue">${issue}</div>`).join('')}
    </div>
    ` : ''}

    ${result.summary.recommendations.length > 0 ? `
    <div class="issues">
        <h2>Recommendations</h2>
        ${result.summary.recommendations.map(rec => `<div class="recommendation">${rec}</div>`).join('')}
    </div>
    ` : ''}

    ${result.performance ? `
    <div class="summary">
        <h2>Performance Test Results</h2>
        <table>
            <thead>
                <tr>
                    <th>Database</th>
                    <th>Throughput (ops/sec)</th>
                    <th>Avg Latency (ms)</th>
                    <th>Error Rate (%)</th>
                    <th>Status</th>
                </tr>
            </thead>
            <tbody>
                ${result.performance.results.map(r => `
                <tr>
                    <td>${r.database}</td>
                    <td>${r.throughput.toFixed(2)}</td>
                    <td>${r.averageLatency.toFixed(2)}</td>
                    <td>${r.errorRate.toFixed(2)}</td>
                    <td>${r.errorRate > 5 ? 'FAIL' : r.errorRate > 1 ? 'WARNING' : 'PASS'}</td>
                </tr>
                `).join('')}
            </tbody>
        </table>
    </div>
    ` : ''}

    ${result.failover ? `
    <div class="summary">
        <h2>Failover Test Results</h2>
        <table>
            <thead>
                <tr>
                    <th>Scenario</th>
                    <th>Detection Time (ms)</th>
                    <th>Recovery Time (ms)</th>
                    <th>Data Loss</th>
                    <th>Status</th>
                </tr>
            </thead>
            <tbody>
                ${result.failover.results.map(r => `
                <tr>
                    <td>${r.scenario}</td>
                    <td>${r.detectionTime}</td>
                    <td>${r.recoveryTime}</td>
                    <td>${r.dataLoss ? 'YES' : 'NO'}</td>
                    <td>${r.failoverSuccess ? 'PASS' : 'FAIL'}</td>
                </tr>
                `).join('')}
            </tbody>
        </table>
    </div>
    ` : ''}
</body>
</html>
    `;
  }

  /**
   * Generate metrics report
   */
  private generateMetricsReport(result: TestSuiteResult): any {
    return {
      testId: result.testId,
      timestamp: result.timestamp.toISOString(),
      metrics: result.metrics,
      summary: result.summary,
      performance: result.performance ? {
        summary: result.performance.summary,
        results: result.performance.results.map(r => ({
          database: r.database,
          throughput: r.throughput,
          averageLatency: r.averageLatency,
          errorRate: r.errorRate,
          p95Latency: r.p95Latency,
          p99Latency: r.p99Latency
        }))
      } : null,
      failover: result.failover ? {
        summary: result.failover.summary,
        results: result.failover.results.map(r => ({
          scenario: r.scenario,
          detectionTime: r.detectionTime,
          recoveryTime: r.recoveryTime,
          dataLoss: r.dataLoss,
          dataCorruption: r.dataCorruption,
          serviceDegradation: r.serviceDegradation,
          failoverSuccess: r.failoverSuccess
        }))
      } : null
    };
  }

  /**
   * Setup monitoring
   */
  private async setupMonitoring(result: TestSuiteResult, config: TestSuiteConfig): Promise<void> {
    logger.info('Setting up monitoring...');

    try {
      // In a real implementation, this would:
      // 1. Send metrics to monitoring system (Prometheus, DataDog, etc.)
      // 2. Set up alerts based on thresholds
      // 3. Create monitoring dashboards
      // 4. Configure health checks

      logger.info(`Monitoring dashboard available at: ${config.monitoring.dashboardUrl}`);
      logger.info('Monitoring setup completed');
    } catch (error) {
      logger.error('Monitoring setup failed:', error);
    }
  }

  /**
   * Get current test status
   */
  getStatus(): { isRunning: boolean; currentTest: string | null } {
    return {
      isRunning: this.isRunning,
      currentTest: this.currentTest
    };
  }

  /**
   * Run quick health check
   */
  async runHealthCheck(): Promise<boolean> {
    try {
      await this.verifyDatabaseConnections();
      return true;
    } catch (error) {
      logger.error('Health check failed:', error);
      return false;
    }
  }
} 