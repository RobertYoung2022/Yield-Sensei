/**
 * Test Results Processor for Sage Satellite Tests
 * Processes and enhances Jest test results with additional metrics and reporting
 */

const fs = require('fs');
const path = require('path');

/**
 * Process Jest test results and generate enhanced reports
 * @param {Object} results - Jest test results object
 * @returns {Object} Processed results
 */
function processResults(results) {
  const timestamp = new Date().toISOString();
  const outputDir = path.join(process.cwd(), 'coverage', 'sage');
  
  // Ensure output directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Calculate additional metrics
  const enhancedResults = {
    ...results,
    metadata: {
      timestamp,
      nodeVersion: process.version,
      platform: process.platform,
      totalMemoryUsage: process.memoryUsage(),
      testRunDuration: results.testResults?.reduce((total, test) => 
        total + (test.perfStats?.end - test.perfStats?.start || 0), 0) || 0
    },
    summary: {
      ...results.summary || {},
      performanceMetrics: calculatePerformanceMetrics(results),
      coverageMetrics: calculateCoverageMetrics(results),
      reliabilityMetrics: calculateReliabilityMetrics(results)
    }
  };

  // Generate detailed component reports
  const componentReports = generateComponentReports(results);
  
  // Write enhanced results
  writeResults(outputDir, enhancedResults, componentReports);
  
  // Generate dashboard data
  generateDashboardData(outputDir, enhancedResults, componentReports);
  
  return enhancedResults;
}

/**
 * Calculate performance metrics from test results
 * @param {Object} results - Jest test results
 * @returns {Object} Performance metrics
 */
function calculatePerformanceMetrics(results) {
  const testResults = results.testResults || [];
  const performanceTests = testResults.filter(test => 
    test.testFilePath?.includes('performance') || 
    test.testFilePath?.includes('load-testing')
  );

  if (performanceTests.length === 0) {
    return { message: 'No performance tests found' };
  }

  const durations = performanceTests.map(test => 
    test.perfStats?.end - test.perfStats?.start || 0
  );

  return {
    totalPerformanceTests: performanceTests.length,
    averageDuration: durations.reduce((a, b) => a + b, 0) / durations.length,
    maxDuration: Math.max(...durations),
    minDuration: Math.min(...durations),
    slowTests: performanceTests
      .filter(test => (test.perfStats?.end - test.perfStats?.start || 0) > 10000)
      .map(test => ({
        name: path.basename(test.testFilePath || ''),
        duration: test.perfStats?.end - test.perfStats?.start || 0
      }))
  };
}

/**
 * Calculate coverage metrics
 * @param {Object} results - Jest test results
 * @returns {Object} Coverage metrics
 */
function calculateCoverageMetrics(results) {
  const coverage = results.coverageMap;
  if (!coverage) {
    return { message: 'No coverage data available' };
  }

  // Extract coverage summary
  const summary = coverage.getCoverageSummary ? coverage.getCoverageSummary() : null;
  
  return {
    statements: summary?.statements || { covered: 0, total: 0, pct: 0 },
    branches: summary?.branches || { covered: 0, total: 0, pct: 0 },
    functions: summary?.functions || { covered: 0, total: 0, pct: 0 },
    lines: summary?.lines || { covered: 0, total: 0, pct: 0 },
    uncoveredFiles: [] // Would need to analyze coverage map for uncovered files
  };
}

/**
 * Calculate reliability metrics
 * @param {Object} results - Jest test results
 * @returns {Object} Reliability metrics
 */
function calculateReliabilityMetrics(results) {
  const testResults = results.testResults || [];
  const totalTests = testResults.reduce((total, test) => 
    total + (test.numPassingTests || 0) + (test.numFailingTests || 0), 0);
  const failedTests = testResults.reduce((total, test) => 
    total + (test.numFailingTests || 0), 0);
  const flakyTests = testResults.filter(test => 
    test.numFailingTests > 0 && test.numPassingTests > 0);

  return {
    totalTests,
    failedTests,
    passRate: totalTests > 0 ? ((totalTests - failedTests) / totalTests) * 100 : 0,
    flakyTests: flakyTests.length,
    testStability: flakyTests.length === 0 ? 'stable' : 
                   flakyTests.length < 3 ? 'mostly-stable' : 'unstable',
    errorCategories: categorizeErrors(results)
  };
}

/**
 * Categorize test errors
 * @param {Object} results - Jest test results
 * @returns {Object} Error categories
 */
function categorizeErrors(results) {
  const errors = [];
  const testResults = results.testResults || [];
  
  testResults.forEach(test => {
    if (test.testResults) {
      test.testResults.forEach(testCase => {
        if (testCase.status === 'failed' && testCase.failureMessages) {
          errors.push(...testCase.failureMessages);
        }
      });
    }
  });

  const categories = {
    timeout: errors.filter(err => err.includes('timeout')).length,
    assertion: errors.filter(err => err.includes('Expected')).length,
    network: errors.filter(err => err.includes('network') || err.includes('ECONNREFUSED')).length,
    memory: errors.filter(err => err.includes('memory') || err.includes('heap')).length,
    other: 0
  };

  categories.other = errors.length - Object.values(categories).reduce((a, b) => a + b, 0);
  
  return categories;
}

/**
 * Generate component-specific reports
 * @param {Object} results - Jest test results
 * @returns {Object} Component reports
 */
function generateComponentReports(results) {
  const testResults = results.testResults || [];
  const components = {
    'rwa-scoring': testResults.filter(test => test.testFilePath?.includes('rwa')),
    'fundamental-analysis': testResults.filter(test => test.testFilePath?.includes('fundamental')),
    'compliance': testResults.filter(test => test.testFilePath?.includes('compliance')),
    'perplexity': testResults.filter(test => test.testFilePath?.includes('perplexity')),
    'integration': testResults.filter(test => test.testFilePath?.includes('comprehensive')),
    'performance': testResults.filter(test => test.testFilePath?.includes('performance'))
  };

  const reports = {};
  
  Object.entries(components).forEach(([name, tests]) => {
    if (tests.length > 0) {
      reports[name] = {
        totalTests: tests.reduce((total, test) => 
          total + (test.numPassingTests || 0) + (test.numFailingTests || 0), 0),
        passingTests: tests.reduce((total, test) => total + (test.numPassingTests || 0), 0),
        failingTests: tests.reduce((total, test) => total + (test.numFailingTests || 0), 0),
        avgDuration: tests.reduce((total, test) => 
          total + (test.perfStats?.end - test.perfStats?.start || 0), 0) / tests.length,
        files: tests.map(test => path.basename(test.testFilePath || ''))
      };
    }
  });

  return reports;
}

/**
 * Write results to files
 * @param {string} outputDir - Output directory
 * @param {Object} results - Enhanced results
 * @param {Object} componentReports - Component reports
 */
function writeResults(outputDir, results, componentReports) {
  // Write main results
  fs.writeFileSync(
    path.join(outputDir, 'sage-test-results.json'),
    JSON.stringify(results, null, 2)
  );

  // Write component reports
  fs.writeFileSync(
    path.join(outputDir, 'sage-component-reports.json'),
    JSON.stringify(componentReports, null, 2)
  );

  // Write summary report
  const summary = {
    timestamp: results.metadata.timestamp,
    overall: {
      totalTests: results.summary.numTotalTests || 0,
      passedTests: results.summary.numPassedTests || 0,
      failedTests: results.summary.numFailedTests || 0,
      passRate: results.summary.reliabilityMetrics?.passRate || 0
    },
    performance: results.summary.performanceMetrics || {},
    coverage: results.summary.coverageMetrics || {},
    reliability: results.summary.reliabilityMetrics || {},
    components: componentReports
  };

  fs.writeFileSync(
    path.join(outputDir, 'sage-test-summary.json'),
    JSON.stringify(summary, null, 2)
  );
}

/**
 * Generate dashboard data for visualization
 * @param {string} outputDir - Output directory
 * @param {Object} results - Enhanced results
 * @param {Object} componentReports - Component reports
 */
function generateDashboardData(outputDir, results, componentReports) {
  const dashboardData = {
    metadata: {
      lastUpdate: results.metadata.timestamp,
      testRunId: `sage-${Date.now()}`,
      environment: process.env.NODE_ENV || 'test'
    },
    metrics: {
      testSummary: {
        total: results.summary.numTotalTests || 0,
        passed: results.summary.numPassedTests || 0,
        failed: results.summary.numFailedTests || 0,
        skipped: results.summary.numPendingTests || 0
      },
      performance: {
        averageTestDuration: results.summary.performanceMetrics?.averageDuration || 0,
        slowestTest: results.summary.performanceMetrics?.maxDuration || 0,
        performanceScore: calculatePerformanceScore(results.summary.performanceMetrics)
      },
      coverage: {
        statements: results.summary.coverageMetrics?.statements?.pct || 0,
        branches: results.summary.coverageMetrics?.branches?.pct || 0,
        functions: results.summary.coverageMetrics?.functions?.pct || 0,
        lines: results.summary.coverageMetrics?.lines?.pct || 0
      },
      reliability: {
        passRate: results.summary.reliabilityMetrics?.passRate || 0,
        stability: results.summary.reliabilityMetrics?.testStability || 'unknown',
        flakyTests: results.summary.reliabilityMetrics?.flakyTests || 0
      }
    },
    components: Object.entries(componentReports).map(([name, report]) => ({
      name,
      tests: report.totalTests,
      passed: report.passingTests,
      failed: report.failingTests,
      passRate: report.totalTests > 0 ? (report.passingTests / report.totalTests) * 100 : 0,
      avgDuration: report.avgDuration
    })),
    trends: generateTrendData(outputDir, results)
  };

  fs.writeFileSync(
    path.join(outputDir, 'sage-dashboard-data.json'),
    JSON.stringify(dashboardData, null, 2)
  );
}

/**
 * Calculate performance score
 * @param {Object} performanceMetrics - Performance metrics
 * @returns {number} Performance score (0-100)
 */
function calculatePerformanceScore(performanceMetrics) {
  if (!performanceMetrics || !performanceMetrics.averageDuration) {
    return 0;
  }

  // Score based on average test duration (lower is better)
  // 100 points for < 1s average, linear decrease to 0 points at 10s
  const avgDuration = performanceMetrics.averageDuration / 1000; // Convert to seconds
  const score = Math.max(0, Math.min(100, 100 - (avgDuration - 1) * 11.11));
  
  return Math.round(score);
}

/**
 * Generate trend data
 * @param {string} outputDir - Output directory
 * @param {Object} currentResults - Current test results
 * @returns {Array} Trend data
 */
function generateTrendData(outputDir, currentResults) {
  const trendsFile = path.join(outputDir, 'sage-trends.json');
  let trends = [];

  // Load existing trends if available
  try {
    if (fs.existsSync(trendsFile)) {
      trends = JSON.parse(fs.readFileSync(trendsFile, 'utf8'));
    }
  } catch (error) {
    console.warn('Could not load existing trend data:', error.message);
  }

  // Add current data point
  const currentPoint = {
    timestamp: currentResults.metadata.timestamp,
    passRate: currentResults.summary.reliabilityMetrics?.passRate || 0,
    avgDuration: currentResults.summary.performanceMetrics?.averageDuration || 0,
    coverage: currentResults.summary.coverageMetrics?.statements?.pct || 0
  };

  trends.push(currentPoint);

  // Keep only last 30 data points
  trends = trends.slice(-30);

  // Save updated trends
  fs.writeFileSync(trendsFile, JSON.stringify(trends, null, 2));

  return trends;
}

module.exports = processResults;