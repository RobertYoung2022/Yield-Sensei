/**
 * Main Test Runner Service for YieldSensei
 * Orchestrates all testing services and manages comprehensive test execution
 */

import { TestResult, TestRun, TestReport, TestRecommendation } from '../types';
import { testingConfig } from '../config/testing.config';
import Logger from '../../shared/logging/logger';
import { unitTestService } from './unit-test.service';
import { integrationTestService } from './integration-test.service';
import { securityTestService } from './security-test.service';
import { performanceTestService } from './performance-test.service';

const logger = Logger.getLogger('TestRunnerService');

/**
 * Main Test Runner Service for YieldSensei
 * Orchestrates all testing services and manages comprehensive test execution
 */
export class TestRunnerService {
  private config = testingConfig.getConfig();
  private testRuns: Map<string, TestRun> = new Map();
  private reports: TestReport[] = [];

  constructor() {
    logger.info('Initializing Test Runner Service');
  }

  /**
   * Run all test types
   */
  public async runAllTests(): Promise<TestReport> {
    logger.info('Starting comprehensive test execution');
    const startTime = new Date();
    const testRunId = `test-run-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const testRun: TestRun = {
      id: testRunId,
      startTime,
      endTime: null,
      status: 'running',
      results: [],
      summary: {
        total: 0,
        passed: 0,
        failed: 0,
        skipped: 0,
        error: 0,
        duration: 0,
      },
    };

    this.testRuns.set(testRunId, testRun);

    try {
      // Run unit tests
      logger.info('Running unit tests...');
      const unitResults = await unitTestService.runAllTests();
      testRun.results.push(...unitResults);

      // Run integration tests
      logger.info('Running integration tests...');
      const integrationResults = await integrationTestService.runAllTests();
      testRun.results.push(...integrationResults);

      // Run security tests
      logger.info('Running security tests...');
      const securityResults = await securityTestService.runAllTests();
      testRun.results.push(...securityResults);

      // Run performance tests
      logger.info('Running performance tests...');
      const performanceResults = await performanceTestService.runAllTests();
      testRun.results.push(...performanceResults);

      // Update test run
      testRun.endTime = new Date();
      testRun.status = 'completed';
      testRun.summary = this.calculateSummary(testRun.results);

      // Generate comprehensive report
      const report = await this.generateTestReport(testRun);
      this.reports.push(report);

      logger.info(`Comprehensive test execution completed. Total tests: ${testRun.summary.total}`);
      return report;

    } catch (error) {
      logger.error('Error during comprehensive test execution:', error);
      testRun.endTime = new Date();
      testRun.status = 'error';
      testRun.error = error as Error;

      const report = await this.generateTestReport(testRun);
      this.reports.push(report);
      return report;
    }
  }

  /**
   * Run specific test types
   */
  public async runTestTypes(types: string[]): Promise<TestReport> {
    logger.info(`Running specific test types: ${types.join(', ')}`);
    const startTime = new Date();
    const testRunId = `test-run-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const testRun: TestRun = {
      id: testRunId,
      startTime,
      endTime: null,
      status: 'running',
      results: [],
      summary: {
        total: 0,
        passed: 0,
        failed: 0,
        skipped: 0,
        error: 0,
        duration: 0,
      },
    };

    this.testRuns.set(testRunId, testRun);

    try {
      for (const type of types) {
        switch (type.toLowerCase()) {
          case 'unit':
            logger.info('Running unit tests...');
            const unitResults = await unitTestService.runAllTests();
            testRun.results.push(...unitResults);
            break;

          case 'integration':
            logger.info('Running integration tests...');
            const integrationResults = await integrationTestService.runAllTests();
            testRun.results.push(...integrationResults);
            break;

          case 'security':
            logger.info('Running security tests...');
            const securityResults = await securityTestService.runAllTests();
            testRun.results.push(...securityResults);
            break;

          case 'performance':
            logger.info('Running performance tests...');
            const performanceResults = await performanceTestService.runAllTests();
            testRun.results.push(...performanceResults);
            break;

          default:
            logger.warn(`Unknown test type: ${type}`);
        }
      }

      // Update test run
      testRun.endTime = new Date();
      testRun.status = 'completed';
      testRun.summary = this.calculateSummary(testRun.results);

      // Generate report
      const report = await this.generateTestReport(testRun);
      this.reports.push(report);

      logger.info(`Test execution completed for types: ${types.join(', ')}. Total tests: ${testRun.summary.total}`);
      return report;

    } catch (error) {
      logger.error('Error during test execution:', error);
      testRun.endTime = new Date();
      testRun.status = 'error';
      testRun.error = error as Error;

      const report = await this.generateTestReport(testRun);
      this.reports.push(report);
      return report;
    }
  }

  /**
   * Run specific test suites
   */
  public async runTestSuites(suites: { type: string; suite: string }[]): Promise<TestReport> {
    logger.info(`Running specific test suites: ${suites.map(s => `${s.type}:${s.suite}`).join(', ')}`);
    const startTime = new Date();
    const testRunId = `test-run-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const testRun: TestRun = {
      id: testRunId,
      startTime,
      endTime: null,
      status: 'running',
      results: [],
      summary: {
        total: 0,
        passed: 0,
        failed: 0,
        skipped: 0,
        error: 0,
        duration: 0,
      },
    };

    this.testRuns.set(testRunId, testRun);

    try {
      for (const { type, suite } of suites) {
        switch (type.toLowerCase()) {
          case 'unit':
            logger.info(`Running unit test suite: ${suite}`);
            const unitResults = await unitTestService.runTestSuite(suite);
            testRun.results.push(...unitResults);
            break;

          case 'integration':
            logger.info(`Running integration test suite: ${suite}`);
            const integrationResults = await integrationTestService.runTestSuite(suite);
            testRun.results.push(...integrationResults);
            break;

          case 'security':
            logger.info(`Running security test suite: ${suite}`);
            const securityResults = await securityTestService.runTestSuite(suite);
            testRun.results.push(...securityResults);
            break;

          case 'performance':
            logger.info(`Running performance test suite: ${suite}`);
            const performanceResults = await performanceTestService.runTestSuite(suite);
            testRun.results.push(...performanceResults);
            break;

          default:
            logger.warn(`Unknown test type: ${type}`);
        }
      }

      // Update test run
      testRun.endTime = new Date();
      testRun.status = 'completed';
      testRun.summary = this.calculateSummary(testRun.results);

      // Generate report
      const report = await this.generateTestReport(testRun);
      this.reports.push(report);

      logger.info(`Test suite execution completed. Total tests: ${testRun.summary.total}`);
      return report;

    } catch (error) {
      logger.error('Error during test suite execution:', error);
      testRun.endTime = new Date();
      testRun.status = 'error';
      testRun.error = error as Error;

      const report = await this.generateTestReport(testRun);
      this.reports.push(report);
      return report;
    }
  }

  /**
   * Get test run by ID
   */
  public getTestRun(testRunId: string): TestRun | undefined {
    return this.testRuns.get(testRunId);
  }

  /**
   * Get all test runs
   */
  public getAllTestRuns(): TestRun[] {
    return Array.from(this.testRuns.values());
  }

  /**
   * Get test report by ID
   */
  public getTestReport(testRunId: string): TestReport | undefined {
    return this.reports.find(report => report.testRunId === testRunId);
  }

  /**
   * Get all test reports
   */
  public getAllTestReports(): TestReport[] {
    return this.reports;
  }

  /**
   * Get latest test report
   */
  public getLatestTestReport(): TestReport | undefined {
    if (this.reports.length === 0) {
      return undefined;
    }
    return this.reports[this.reports.length - 1];
  }

  /**
   * Calculate test summary
   */
  private calculateSummary(results: TestResult[]): {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
    error: number;
    duration: number;
  } {
    const summary = {
      total: results.length,
      passed: 0,
      failed: 0,
      skipped: 0,
      error: 0,
      duration: 0,
    };

    results.forEach(result => {
      switch (result.status) {
        case 'passed':
          summary.passed++;
          break;
        case 'failed':
          summary.failed++;
          break;
        case 'skipped':
          summary.skipped++;
          break;
        case 'error':
          summary.error++;
          break;
      }
      summary.duration += result.duration;
    });

    return summary;
  }

  /**
   * Generate comprehensive test report
   */
  private async generateTestReport(testRun: TestRun): Promise<TestReport> {
    const report: TestReport = {
      id: `report-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      testRunId: testRun.id,
      generatedAt: new Date(),
      summary: testRun.summary,
      testRun: testRun,
      results: testRun.results,
      analysis: await this.analyzeTestResults(testRun.results),
      recommendations: await this.generateRecommendations(testRun.results),
      metadata: {
        environment: this.config.environment,
        baseUrl: this.config.baseUrl,
        totalDuration: testRun.endTime ? testRun.endTime.getTime() - testRun.startTime.getTime() : 0,
        testTypes: this.getTestTypes(testRun.results),
      },
    };

    return report;
  }

  /**
   * Analyze test results
   */
  private async analyzeTestResults(results: TestResult[]): Promise<any> {
    const analysis: any = {
      overall: {
        successRate: 0,
        averageDuration: 0,
        slowestTests: [],
        fastestTests: [],
        mostFailedTests: [],
      },
      byCategory: {},
      byPriority: {},
      trends: {},
    };

    if (results.length === 0) {
      return analysis;
    }

    // Calculate overall metrics
    const passedTests = results.filter(r => r.status === 'passed');
    analysis.overall.successRate = (passedTests.length / results.length) * 100;

    const completedTests = results.filter(r => r.status !== 'skipped');
    const totalDuration = completedTests.reduce((sum, r) => sum + r.duration, 0);
    analysis.overall.averageDuration = totalDuration / completedTests.length;

    // Find slowest and fastest tests
    const sortedByDuration = [...results].sort((a, b) => b.duration - a.duration);
    analysis.overall.slowestTests = sortedByDuration.slice(0, 5).map(r => ({
      id: r.testCaseId,
      duration: r.duration,
      status: r.status,
    }));

    analysis.overall.fastestTests = sortedByDuration.slice(-5).reverse().map(r => ({
      id: r.testCaseId,
      duration: r.duration,
      status: r.status,
    }));

    // Find most failed tests
    const failedTests = results.filter(r => r.status === 'failed');
    analysis.overall.mostFailedTests = failedTests.slice(0, 5).map(r => ({
      id: r.testCaseId,
      status: r.status,
      error: r.error?.message,
    }));

    // Analyze by category
    const categories = ['unit', 'integration', 'security', 'performance'];
    categories.forEach(category => {
      const categoryResults = results.filter(r => 
        r.metadata?.['category'] === category || 
        r.testCaseId?.includes(category)
      );
      
      if (categoryResults.length > 0) {
        analysis.byCategory[category] = {
          total: categoryResults.length,
          passed: categoryResults.filter(r => r.status === 'passed').length,
          failed: categoryResults.filter(r => r.status === 'failed').length,
          successRate: (categoryResults.filter(r => r.status === 'passed').length / categoryResults.length) * 100,
          averageDuration: categoryResults.reduce((sum, r) => sum + r.duration, 0) / categoryResults.length,
        };
      }
    });

    // Analyze by priority
    const priorities = ['low', 'medium', 'high', 'critical'];
    priorities.forEach(priority => {
      const priorityResults = results.filter(r => 
        r.metadata?.['priority'] === priority
      );
      
      if (priorityResults.length > 0) {
        analysis.byPriority[priority] = {
          total: priorityResults.length,
          passed: priorityResults.filter(r => r.status === 'passed').length,
          failed: priorityResults.filter(r => r.status === 'failed').length,
          successRate: (priorityResults.filter(r => r.status === 'passed').length / priorityResults.length) * 100,
        };
      }
    });

    return analysis;
  }

  /**
   * Generate recommendations based on test results
   */
  private async generateRecommendations(results: TestResult[]): Promise<TestRecommendation[]> {
    const recommendations: TestRecommendation[] = [];

    // Analyze failed tests
    const failedTests = results.filter(r => r.status === 'failed');
    if (failedTests.length > 0) {
      recommendations.push({
        type: 'critical',
        title: 'Failed Tests Require Attention',
        description: `${failedTests.length} tests failed and need immediate investigation`,
        action: 'Review failed test cases and fix underlying issues',
        priority: 'high',
      });
    }

    // Analyze slow tests
    const slowTests = results.filter(r => r.duration > 5000); // Tests taking more than 5 seconds
    if (slowTests.length > 0) {
      recommendations.push({
        type: 'performance',
        title: 'Slow Tests Identified',
        description: `${slowTests.length} tests are taking longer than 5 seconds to complete`,
        action: 'Optimize slow tests and investigate performance bottlenecks',
        priority: 'medium',
      });
    }

    // Analyze error tests
    const errorTests = results.filter(r => r.status === 'error');
    if (errorTests.length > 0) {
      recommendations.push({
        type: 'critical',
        title: 'Test Execution Errors',
        description: `${errorTests.length} tests encountered execution errors`,
        action: 'Investigate test environment issues and fix test setup problems',
        priority: 'high',
      });
    }

    // Analyze success rate
    const successRate = (results.filter(r => r.status === 'passed').length / results.length) * 100;
    if (successRate < 80) {
      recommendations.push({
        type: 'quality',
        title: 'Low Test Success Rate',
        description: `Test success rate is ${successRate.toFixed(1)}%, below the 80% threshold`,
        action: 'Improve test quality and fix failing tests',
        priority: 'high',
      });
    }

    // Security-specific recommendations
    const securityResults = results.filter(r => 
      r.metadata?.['category'] === 'security' || 
      r.testCaseId?.includes('security')
    );
    
    if (securityResults.length > 0) {
      const securityFailures = securityResults.filter(r => r.status === 'failed');
      if (securityFailures.length > 0) {
        recommendations.push({
          type: 'security',
          title: 'Security Vulnerabilities Detected',
          description: `${securityFailures.length} security tests failed, indicating potential vulnerabilities`,
          action: 'Immediately address security issues and conduct security review',
          priority: 'critical',
        });
      }
    }

    // Performance-specific recommendations
    const performanceResults = results.filter(r => 
      r.metadata?.['category'] === 'performance' || 
      r.testCaseId?.includes('performance')
    );
    
    if (performanceResults.length > 0) {
      const performanceFailures = performanceResults.filter(r => r.status === 'failed');
      if (performanceFailures.length > 0) {
        recommendations.push({
          type: 'performance',
          title: 'Performance Issues Detected',
          description: `${performanceFailures.length} performance tests failed, indicating performance problems`,
          action: 'Investigate performance bottlenecks and optimize system performance',
          priority: 'high',
        });
      }
    }

    return recommendations;
  }

  /**
   * Get test types from results
   */
  private getTestTypes(results: TestResult[]): string[] {
    const types = new Set<string>();
    
    results.forEach(result => {
      if (result.testCaseId) {
        if (result.testCaseId.includes('unit')) types.add('unit');
        if (result.testCaseId.includes('integration')) types.add('integration');
        if (result.testCaseId.includes('security')) types.add('security');
        if (result.testCaseId.includes('performance')) types.add('performance');
      }
    });

    return Array.from(types);
  }

  /**
   * Get service instances for direct access
   */
  public getUnitTestService() {
    return unitTestService;
  }

  public getIntegrationTestService() {
    return integrationTestService;
  }

  public getSecurityTestService() {
    return securityTestService;
  }

  public getPerformanceTestService() {
    return performanceTestService;
  }

  /**
   * Get security vulnerabilities
   */
  public getSecurityVulnerabilities() {
    return securityTestService.getVulnerabilities();
  }

  /**
   * Get security score
   */
  public getSecurityScore() {
    return securityTestService.generateSecurityScore();
  }

  /**
   * Get performance metrics
   */
  public getPerformanceMetrics() {
    return performanceTestService.getMetrics();
  }

  /**
   * Get performance report
   */
  public getPerformanceReport() {
    return performanceTestService.generatePerformanceReport();
  }

  /**
   * Clear test history
   */
  public clearHistory(): void {
    this.testRuns.clear();
    this.reports = [];
    logger.info('Test history cleared');
  }

  /**
   * Export test report to different formats
   */
  public exportReport(testRunId: string, format: 'json' | 'html' | 'xml' | 'junit' = 'json'): any {
    const testRun = this.getTestRun(testRunId);
    if (!testRun) {
      throw new Error(`Test run with ID ${testRunId} not found`);
    }

    switch (format) {
      case 'json':
        return this.exportToJson(testRun);
      case 'html':
        return this.exportToHtml(testRun);
      case 'xml':
        return this.exportToXml(testRun);
      case 'junit':
        return this.exportToJunit(testRun);
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  /**
   * Export to JSON format
   */
  private exportToJson(testRun: TestRun): any {
    return {
      testRun,
      report: this.getTestReport(testRun.id),
      exportedAt: new Date().toISOString(),
      format: 'json',
    };
  }

  /**
   * Export to HTML format
   */
  private exportToHtml(testRun: TestRun): string {
    const report = this.getTestReport(testRun.id);
    const summary = testRun.summary;
    
    return `
<!DOCTYPE html>
<html>
<head>
    <title>Test Report - ${testRun.id}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #f5f5f5; padding: 20px; border-radius: 5px; }
        .summary { display: flex; gap: 20px; margin: 20px 0; }
        .metric { text-align: center; padding: 10px; border: 1px solid #ddd; border-radius: 5px; }
        .passed { color: green; }
        .failed { color: red; }
        .skipped { color: orange; }
        .error { color: red; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Test Report</h1>
        <p><strong>Test Run ID:</strong> ${testRun.id}</p>
        <p><strong>Start Time:</strong> ${testRun.startTime.toISOString()}</p>
        <p><strong>End Time:</strong> ${testRun.endTime?.toISOString() || 'Running'}</p>
        <p><strong>Status:</strong> ${testRun.status}</p>
    </div>
    
    <div class="summary">
        <div class="metric">
            <h3>Total</h3>
            <p>${summary.total}</p>
        </div>
        <div class="metric passed">
            <h3>Passed</h3>
            <p>${summary.passed}</p>
        </div>
        <div class="metric failed">
            <h3>Failed</h3>
            <p>${summary.failed}</p>
        </div>
        <div class="metric skipped">
            <h3>Skipped</h3>
            <p>${summary.skipped}</p>
        </div>
        <div class="metric error">
            <h3>Error</h3>
            <p>${summary.error}</p>
        </div>
    </div>
    
    <h2>Test Results</h2>
    <table border="1" style="width: 100%; border-collapse: collapse;">
        <tr>
            <th>Test Case ID</th>
            <th>Status</th>
            <th>Duration (ms)</th>
            <th>Details</th>
        </tr>
        ${testRun.results.map(result => `
            <tr>
                <td>${result.testCaseId}</td>
                <td class="${result.status}">${result.status}</td>
                <td>${result.duration}</td>
                <td>${result.error?.message || 'N/A'}</td>
            </tr>
        `).join('')}
    </table>
</body>
</html>
    `;
  }

  /**
   * Export to XML format
   */
  private exportToXml(testRun: TestRun): string {
    const summary = testRun.summary;
    
    return `<?xml version="1.0" encoding="UTF-8"?>
<testrun id="${testRun.id}" startTime="${testRun.startTime.toISOString()}" endTime="${testRun.endTime?.toISOString() || ''}" status="${testRun.status}">
    <summary>
        <total>${summary.total}</total>
        <passed>${summary.passed}</passed>
        <failed>${summary.failed}</failed>
        <skipped>${summary.skipped}</skipped>
        <error>${summary.error}</error>
    </summary>
    <results>
        ${testRun.results.map(result => `
        <testcase id="${result.testCaseId}" status="${result.status}" duration="${result.duration}">
            ${result.error ? `<error>${result.error.message}</error>` : ''}
        </testcase>
        `).join('')}
    </results>
</testrun>`;
  }

  /**
   * Export to JUnit format
   */
  private exportToJunit(testRun: TestRun): string {
    const summary = testRun.summary;
    
    return `<?xml version="1.0" encoding="UTF-8"?>
<testsuites name="YieldSensei Tests" tests="${summary.total}" failures="${summary.failed}" errors="${summary.error}" skipped="${summary.skipped}">
    <testsuite name="Test Run ${testRun.id}" tests="${summary.total}" failures="${summary.failed}" errors="${summary.error}" skipped="${summary.skipped}">
        ${testRun.results.map(result => `
        <testcase name="${result.testCaseId}" time="${result.duration / 1000}">
            ${result.status === 'failed' ? `<failure message="${result.error?.message || 'Test failed'}">${result.error?.message || 'Test failed'}</failure>` : ''}
            ${result.status === 'error' ? `<error message="${result.error?.message || 'Test error'}">${result.error?.message || 'Test error'}</error>` : ''}
            ${result.status === 'skipped' ? '<skipped/>' : ''}
        </testcase>
        `).join('')}
    </testsuite>
</testsuites>`;
  }
}

// Export singleton instance
export const testRunnerService = new TestRunnerService(); 