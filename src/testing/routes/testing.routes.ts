/**
 * Testing Routes
 * Express routes for testing API endpoints and test management
 */

import { Router, Request, Response } from 'express';
import { testRunnerService } from '../services/test-runner.service';
import { unitTestService } from '../services/unit-test.service';
import { integrationTestService } from '../services/integration-test.service';
import { securityTestService } from '../services/security-test.service';
import { performanceTestService } from '../services/performance-test.service';
import Logger from '../../shared/logging/logger';
import { markUnused } from '../../utils/type-safety.js';

const logger = Logger.getLogger('TestingRoutes');
const router = Router();

/**
 * Testing API Routes
 * Exposes comprehensive testing functionality via REST endpoints
 */

/**
 * Health check endpoint
 */
router.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      unit: 'available',
      integration: 'available',
      security: 'available',
      performance: 'available',
    },
  });
});

/**
 * Run all tests
 */
router.post('/run/all', async (_req: Request, res: Response) => {
  try {
    logger.info('Starting comprehensive test run');
    const report = await testRunnerService.runAllTests();
    
    res.json({
      success: true,
      message: 'Comprehensive test run completed',
      data: report,
    });
  } catch (error) {
    logger.error('Error running all tests:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to run tests',
      error: (error as Error).message,
    });
  }
});

/**
 * Run specific test types
 */
router.post('/run/types', async (req: Request, res: Response) => {
  try {
    const { types } = req.body;
    
    if (!types || !Array.isArray(types)) {
      return res.status(400).json({
        success: false,
        message: 'Types array is required',
      });
    }

    logger.info(`Running test types: ${types.join(', ')}`);
    const report = await testRunnerService.runTestTypes(types);
    
    res.json({
      success: true,
      message: `Test run completed for types: ${types.join(', ')}`,
      data: report,
    });
  } catch (error) {
    logger.error('Error running test types:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to run test types',
      error: (error as Error).message,
    });
  }
});

/**
 * Run specific test suites
 */
router.post('/run/suites', async (req: Request, res: Response) => {
  try {
    const { suites } = req.body;
    
    if (!suites || !Array.isArray(suites)) {
      return res.status(400).json({
        success: false,
        message: 'Suites array is required',
      });
    }

    logger.info(`Running test suites: ${suites.map(s => `${s.type}:${s.suite}`).join(', ')}`);
    const report = await testRunnerService.runTestSuites(suites);
    
    res.json({
      success: true,
      message: 'Test suite execution completed',
      data: report,
    });
  } catch (error) {
    logger.error('Error running test suites:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to run test suites',
      error: (error as Error).message,
    });
  }
});

/**
 * Get test run by ID
 */
router.get('/runs/:runId', (req: Request, res: Response) => {
  try {
    const { runId } = req.params;
    
    if (!runId) {
      return res.status(400).json({
        success: false,
        message: 'Run ID parameter is required',
      });
    }
    
    const testRun = testRunnerService.getTestRun(runId);
    
    if (!testRun) {
      return res.status(404).json({
        success: false,
        message: 'Test run not found',
      });
    }

    res.json({
      success: true,
      data: testRun,
    });
  } catch (error) {
    logger.error('Error getting test run:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get test run',
      error: (error as Error).message,
    });
  }
});

/**
 * Get all test runs
 */
router.get('/runs', (_req: Request, res: Response) => {
  try {
    const testRuns = testRunnerService.getAllTestRuns();
    
    res.json({
      success: true,
      data: testRuns,
    });
  } catch (error) {
    logger.error('Error getting test runs:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get test runs',
      error: (error as Error).message,
    });
  }
});

/**
 * Get test report by ID
 */
router.get('/reports/:reportId', (req: Request, res: Response) => {
  try {
    const { reportId } = req.params;
    
    if (!reportId) {
      return res.status(400).json({
        success: false,
        message: 'Report ID parameter is required',
      });
    }
    
    const report = testRunnerService.getTestReport(reportId);
    
    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Test report not found',
      });
    }

    res.json({
      success: true,
      data: report,
    });
  } catch (error) {
    logger.error('Error getting test report:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get test report',
      error: (error as Error).message,
    });
  }
});

/**
 * Get all test reports
 */
router.get('/reports', (_req: Request, res: Response) => {
  try {
    const reports = testRunnerService.getAllTestReports();
    
    res.json({
      success: true,
      data: reports,
    });
  } catch (error) {
    logger.error('Error getting test reports:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get test reports',
      error: (error as Error).message,
    });
  }
});

/**
 * Get latest test report
 */
router.get('/reports/latest', (_req: Request, res: Response) => {
  try {
    const report = testRunnerService.getLatestTestReport();
    
    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'No test reports found',
      });
    }

    res.json({
      success: true,
      data: report,
    });
  } catch (error) {
    logger.error('Error getting latest test report:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get latest test report',
      error: (error as Error).message,
    });
  }
});

/**
 * Export test report
 */
router.get('/reports/:reportId/export', (req: Request, res: Response) => {
  try {
    const { reportId } = req.params;
    const { format = 'json' } = req.query;
    
    if (!reportId) {
      return res.status(400).json({
        success: false,
        message: 'Report ID parameter is required',
      });
    }
    
    const exportData = testRunnerService.exportReport(reportId, format as 'json' | 'html' | 'xml' | 'junit');
    
    if (format === 'html') {
      res.setHeader('Content-Type', 'text/html');
      res.send(exportData);
    } else if (format === 'xml' || format === 'junit') {
      res.setHeader('Content-Type', 'application/xml');
      res.send(exportData);
    } else {
      res.json({
        success: true,
        data: exportData,
      });
    }
  } catch (error) {
    logger.error('Error exporting test report:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to export test report',
      error: (error as Error).message,
    });
  }
});

/**
 * Unit Testing Routes
 */

/**
 * Run all unit tests
 */
router.post('/unit/run', async (_req: Request, res: Response) => {
  try {
    logger.info('Running all unit tests');
    const results = await unitTestService.runAllTests();
    
    res.json({
      success: true,
      message: 'Unit tests completed',
      data: {
        total: results.length,
        passed: results.filter(r => r.status === 'passed').length,
        failed: results.filter(r => r.status === 'failed').length,
        skipped: results.filter(r => r.status === 'skipped').length,
        error: results.filter(r => r.status === 'error').length,
        results,
      },
    });
  } catch (error) {
    logger.error('Error running unit tests:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to run unit tests',
      error: (error as Error).message,
    });
  }
});

/**
 * Run specific unit test suite
 */
router.post('/unit/suites/:suiteName', async (req: Request, res: Response) => {
  try {
    const { suiteName } = req.params;
    logger.info(`Running unit test suite: ${suiteName}`);
    
    const results = await unitTestService.runTestSuite(suiteName);
    
    res.json({
      success: true,
      message: `Unit test suite '${suiteName}' completed`,
      data: {
        suite: suiteName,
        total: results.length,
        passed: results.filter(r => r.status === 'passed').length,
        failed: results.filter(r => r.status === 'failed').length,
        skipped: results.filter(r => r.status === 'skipped').length,
        error: results.filter(r => r.status === 'error').length,
        results,
      },
    });
  } catch (error) {
    logger.error('Error running unit test suite:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to run unit test suite',
      error: (error as Error).message,
    });
  }
});

/**
 * Integration Testing Routes
 */

/**
 * Run all integration tests
 */
router.post('/integration/run', async (_req: Request, res: Response) => {
  try {
    logger.info('Running all integration tests');
    const results = await integrationTestService.runAllTests();
    
    res.json({
      success: true,
      message: 'Integration tests completed',
      data: {
        total: results.length,
        passed: results.filter(r => r.status === 'passed').length,
        failed: results.filter(r => r.status === 'failed').length,
        skipped: results.filter(r => r.status === 'skipped').length,
        error: results.filter(r => r.status === 'error').length,
        results,
      },
    });
  } catch (error) {
    logger.error('Error running integration tests:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to run integration tests',
      error: (error as Error).message,
    });
  }
});

/**
 * Run specific integration test suite
 */
router.post('/integration/suites/:suiteName', async (req: Request, res: Response) => {
  try {
    const { suiteName } = req.params;
    logger.info(`Running integration test suite: ${suiteName}`);
    
    const results = await integrationTestService.runTestSuite(suiteName);
    
    res.json({
      success: true,
      message: `Integration test suite '${suiteName}' completed`,
      data: {
        suite: suiteName,
        total: results.length,
        passed: results.filter(r => r.status === 'passed').length,
        failed: results.filter(r => r.status === 'failed').length,
        skipped: results.filter(r => r.status === 'skipped').length,
        error: results.filter(r => r.status === 'error').length,
        results,
      },
    });
  } catch (error) {
    logger.error('Error running integration test suite:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to run integration test suite',
      error: (error as Error).message,
    });
  }
});

/**
 * Security Testing Routes
 */

/**
 * Run all security tests
 */
router.post('/security/run', async (_req: Request, res: Response) => {
  try {
    logger.info('Running all security tests');
    const results = await securityTestService.runAllTests();
    const vulnerabilities = securityTestService.getSecurityVulnerabilities();
    const securityScore = securityTestService.generateSecurityScore();
    
    res.json({
      success: true,
      message: 'Security tests completed',
      data: {
        total: results.length,
        passed: results.filter(r => r.status === 'passed').length,
        failed: results.filter(r => r.status === 'failed').length,
        skipped: results.filter(r => r.status === 'skipped').length,
        error: results.filter(r => r.status === 'error').length,
        securityScore,
        vulnerabilities: vulnerabilities.length,
        results,
        vulnerabilities,
      },
    });
  } catch (error) {
    logger.error('Error running security tests:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to run security tests',
      error: (error as Error).message,
    });
  }
});

/**
 * Run specific security test suite
 */
router.post('/security/suites/:suiteName', async (req: Request, res: Response) => {
  try {
    const { suiteName } = req.params;
    logger.info(`Running security test suite: ${suiteName}`);
    
    const results = await securityTestService.runTestSuite(suiteName);
    const vulnerabilities = securityTestService.getSecurityVulnerabilities();
    const securityScore = securityTestService.generateSecurityScore();
    
    res.json({
      success: true,
      message: `Security test suite '${suiteName}' completed`,
      data: {
        suite: suiteName,
        total: results.length,
        passed: results.filter(r => r.status === 'passed').length,
        failed: results.filter(r => r.status === 'failed').length,
        skipped: results.filter(r => r.status === 'skipped').length,
        error: results.filter(r => r.status === 'error').length,
        securityScore,
        vulnerabilities: vulnerabilities.length,
        results,
        vulnerabilities,
      },
    });
  } catch (error) {
    logger.error('Error running security test suite:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to run security test suite',
      error: (error as Error).message,
    });
  }
});

/**
 * Get security vulnerabilities
 */
router.get('/security/vulnerabilities', (_req: Request, res: Response) => {
  try {
    const vulnerabilities = securityTestService.getSecurityVulnerabilities();
    const securityScore = securityTestService.generateSecurityScore();
    const recommendations = securityTestService.generateRecommendations();
    
    res.json({
      success: true,
      data: {
        securityScore,
        vulnerabilities,
        recommendations,
      },
    });
  } catch (error) {
    logger.error('Error getting security vulnerabilities:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get security vulnerabilities',
      error: (error as Error).message,
    });
  }
});

/**
 * Performance Testing Routes
 */

/**
 * Run all performance tests
 */
router.post('/performance/run', async (_req: Request, res: Response) => {
  try {
    logger.info('Running all performance tests');
    const results = await performanceTestService.runAllTests();
    const metrics = performanceTestService.getMetrics();
    const report = performanceTestService.generatePerformanceReport();
    
    res.json({
      success: true,
      message: 'Performance tests completed',
      data: {
        total: results.length,
        passed: results.filter(r => r.status === 'passed').length,
        failed: results.filter(r => r.status === 'failed').length,
        skipped: results.filter(r => r.status === 'skipped').length,
        error: results.filter(r => r.status === 'error').length,
        results,
        metrics,
        report,
      },
    });
  } catch (error) {
    logger.error('Error running performance tests:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to run performance tests',
      error: (error as Error).message,
    });
  }
});

/**
 * Run specific performance test suite
 */
router.post('/performance/suites/:suiteName', async (req: Request, res: Response) => {
  try {
    const { suiteName } = req.params;
    logger.info(`Running performance test suite: ${suiteName}`);
    
    const results = await performanceTestService.runTestSuite(suiteName);
    const metrics = performanceTestService.getMetrics();
    const report = performanceTestService.generatePerformanceReport();
    
    res.json({
      success: true,
      message: `Performance test suite '${suiteName}' completed`,
      data: {
        suite: suiteName,
        total: results.length,
        passed: results.filter(r => r.status === 'passed').length,
        failed: results.filter(r => r.status === 'failed').length,
        skipped: results.filter(r => r.status === 'skipped').length,
        error: results.filter(r => r.status === 'error').length,
        results,
        metrics,
        report,
      },
    });
  } catch (error) {
    logger.error('Error running performance test suite:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to run performance test suite',
      error: (error as Error).message,
    });
  }
});

/**
 * Get performance metrics
 */
router.get('/performance/metrics', (_req: Request, res: Response) => {
  try {
    const metrics = performanceTestService.getMetrics();
    const report = performanceTestService.generatePerformanceReport();
    
    res.json({
      success: true,
      data: {
        metrics,
        report,
      },
    });
  } catch (error) {
    logger.error('Error getting performance metrics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get performance metrics',
      error: (error as Error).message,
    });
  }
});

/**
 * Utility Routes
 */

/**
 * Clear test history
 */
router.delete('/history', (_req: Request, res: Response) => {
  try {
    testRunnerService.clearHistory();
    
    res.json({
      success: true,
      message: 'Test history cleared',
    });
  } catch (error) {
    logger.error('Error clearing test history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to clear test history',
      error: (error as Error).message,
    });
  }
});

/**
 * Get testing statistics
 */
router.get('/stats', (_req: Request, res: Response) => {
  try {
    const testRuns = testRunnerService.getAllTestRuns();
    const reports = testRunnerService.getAllTestReports();
    
    const stats = {
      totalRuns: testRuns.length,
      totalReports: reports.length,
      latestRun: testRuns.length > 0 ? testRuns[testRuns.length - 1] : null,
      latestReport: reports.length > 0 ? reports[reports.length - 1] : null,
      averageSuccessRate: reports.length > 0 
        ? reports.reduce((sum, r) => sum + (r.summary.passed / r.summary.total * 100), 0) / reports.length 
        : 0,
    };
    
    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    logger.error('Error getting testing statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get testing statistics',
      error: (error as Error).message,
    });
  }
});

export default router; 