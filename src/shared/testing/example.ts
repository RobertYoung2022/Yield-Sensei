/**
 * YieldSensei Database Testing Framework - Example Usage
 * 
 * This example demonstrates how to use the comprehensive testing framework
 * for performance testing, failover testing, and monitoring.
 */

import { TestRunner, TestSuiteConfig } from './test-runner';
import { PerformanceTestConfig } from './performance-tester';
import { FailoverTestConfig } from './failover-tester';
import Logger from '@/shared/logging/logger';

const logger = Logger.getLogger('testing-example');

/**
 * Example: Run comprehensive database testing suite
 */
export async function runComprehensiveTestSuite(): Promise<void> {
  logger.info('Starting comprehensive database testing suite...');

  const testRunner = TestRunner.getInstance();

  // Configure performance tests
  const performanceConfig: PerformanceTestConfig = {
    duration: 120, // 2 minutes
    concurrency: 25,
    rampUpTime: 15,
    
    postgres: {
      enabled: true,
      connectionPoolSize: 15,
      queryTypes: ['read', 'write', 'mixed']
    },
    
    clickhouse: {
      enabled: true,
      batchSize: 500,
      queryTypes: ['analytics', 'insert', 'aggregation']
    },
    
    redis: {
      enabled: true,
      operationTypes: ['get', 'set', 'hget', 'hset', 'pipeline']
    },
    
    vector: {
      enabled: true,
      embeddingDimensions: 384,
      searchTypes: ['similarity', 'exact', 'range']
    }
  };

  // Configure failover tests
  const failoverConfig: FailoverTestConfig = {
    scenarios: [
      {
        name: 'PostgreSQL Primary Failure',
        type: 'service_stop',
        duration: 30,
        recoveryTime: 60,
        severity: 'high'
      },
      {
        name: 'Network Connectivity Issues',
        type: 'connection_drop',
        duration: 15,
        recoveryTime: 30,
        severity: 'medium'
      },
      {
        name: 'High Load Stress Test',
        type: 'high_load',
        duration: 60,
        recoveryTime: 90,
        severity: 'medium'
      }
    ],
    
    monitoring: {
      healthCheckInterval: 2000,
      alertThreshold: 10000,
      recoveryThreshold: 60000,
      dataIntegrityChecks: true
    },
    
    databases: {
      postgres: {
        enabled: true,
        testReplication: true,
        testFailover: true
      },
      clickhouse: {
        enabled: true,
        testClusterFailover: true,
        testDataReplication: true
      },
      redis: {
        enabled: true,
        testSentinelFailover: true,
        testClusterFailover: true
      },
      vector: {
        enabled: true,
        testReplication: true
      }
    }
  };

  // Configure test suite
  const testSuiteConfig: TestSuiteConfig = {
    name: 'YieldSensei Production Readiness Test',
    description: 'Comprehensive testing for production deployment readiness',
    environment: 'staging',
    
    performance: performanceConfig,
    failover: failoverConfig,
    
    reporting: {
      outputDir: './test-reports',
      generateHtml: true,
      generateJson: true,
      generateMetrics: true,
      includeCharts: true
    },
    
    monitoring: {
      enabled: true,
      metricsEndpoint: 'http://localhost:9090',
      alerting: true,
      dashboardUrl: 'http://localhost:3000/dashboard'
    }
  };

  try {
    // Run the test suite
    const result = await testRunner.runTestSuite(testSuiteConfig);
    
    // Log results
    logger.info('Test suite completed successfully!');
    logger.info(`Test ID: ${result.testId}`);
    logger.info(`Duration: ${(result.duration / 1000).toFixed(2)} seconds`);
    logger.info(`Overall Status: ${result.summary.overallStatus.toUpperCase()}`);
    logger.info(`Tests Passed: ${result.summary.passedTests}/${result.summary.totalTests}`);
    
    // Log metrics
    logger.info('Performance Metrics:');
    logger.info(`  Average Response Time: ${result.metrics.averageResponseTime.toFixed(2)}ms`);
    logger.info(`  Throughput: ${result.metrics.throughput.toFixed(2)} ops/sec`);
    logger.info(`  Error Rate: ${result.metrics.errorRate.toFixed(2)}%`);
    logger.info(`  Availability: ${result.metrics.availability.toFixed(2)}%`);
    logger.info(`  Data Integrity: ${result.metrics.dataIntegrity.toFixed(2)}%`);
    
    // Log critical issues
    if (result.summary.criticalIssues.length > 0) {
      logger.warn('Critical Issues Detected:');
      result.summary.criticalIssues.forEach(issue => {
        logger.warn(`  - ${issue}`);
      });
    }
    
    // Log recommendations
    if (result.summary.recommendations.length > 0) {
      logger.info('Recommendations:');
      result.summary.recommendations.forEach(rec => {
        logger.info(`  - ${rec}`);
      });
    }
    
    // Determine if tests passed
    if (result.summary.overallStatus === 'pass') {
      logger.info('✅ All tests passed! System is ready for production.');
    } else if (result.summary.overallStatus === 'warning') {
      logger.warn('⚠️  Tests completed with warnings. Review recommendations before production.');
    } else {
      logger.error('❌ Tests failed! Address critical issues before production deployment.');
      process.exit(1);
    }
    
  } catch (error) {
    logger.error('Test suite failed:', error);
    process.exit(1);
  }
}

/**
 * Example: Run quick health check
 */
export async function runQuickHealthCheck(): Promise<boolean> {
  logger.info('Running quick health check...');
  
  const testRunner = TestRunner.getInstance();
  
  try {
    const isHealthy = await testRunner.runHealthCheck();
    
    if (isHealthy) {
      logger.info('✅ Health check passed - all databases are healthy');
    } else {
      logger.error('❌ Health check failed - some databases are unhealthy');
    }
    
    return isHealthy;
  } catch (error) {
    logger.error('Health check failed:', error);
    return false;
  }
}

/**
 * Example: Run performance tests only
 */
export async function runPerformanceTestsOnly(): Promise<void> {
  logger.info('Running performance tests only...');
  
  const { PerformanceTester } = await import('./performance-tester');
  const performanceTester = PerformanceTester.getInstance();
  
  const config: PerformanceTestConfig = {
    duration: 60, // 1 minute
    concurrency: 10,
    rampUpTime: 10,
    
    postgres: {
      enabled: true,
      connectionPoolSize: 10,
      queryTypes: ['read', 'write']
    },
    
    clickhouse: {
      enabled: true,
      batchSize: 100,
      queryTypes: ['analytics', 'insert']
    },
    
    redis: {
      enabled: true,
      operationTypes: ['get', 'set', 'pipeline']
    },
    
    vector: {
      enabled: true,
      embeddingDimensions: 256,
      searchTypes: ['similarity', 'exact']
    }
  };
  
  try {
    const result = await performanceTester.runPerformanceTests(config);
    
    logger.info('Performance tests completed!');
    logger.info(`Test ID: ${result.testId}`);
    logger.info(`Total Operations: ${result.summary.totalOperations}`);
    logger.info(`Average Throughput: ${result.summary.averageThroughput.toFixed(2)} ops/sec`);
    logger.info(`Average Latency: ${result.summary.averageLatency.toFixed(2)}ms`);
    logger.info(`Error Rate: ${result.summary.errorRate.toFixed(2)}%`);
    
    if (result.summary.bottlenecks.length > 0) {
      logger.warn('Performance bottlenecks detected:');
      result.summary.bottlenecks.forEach(bottleneck => {
        logger.warn(`  - ${bottleneck}`);
      });
    }
    
  } catch (error) {
    logger.error('Performance tests failed:', error);
    throw error;
  }
}

/**
 * Example: Run failover tests only
 */
export async function runFailoverTestsOnly(): Promise<void> {
  logger.info('Running failover tests only...');
  
  const { FailoverTester } = await import('./failover-tester');
  const failoverTester = FailoverTester.getInstance();
  
  const config: FailoverTestConfig = {
    scenarios: [
      {
        name: 'Quick Connection Test',
        type: 'connection_drop',
        duration: 10,
        recoveryTime: 20,
        severity: 'low'
      },
      {
        name: 'Service Recovery Test',
        type: 'service_stop',
        duration: 20,
        recoveryTime: 40,
        severity: 'medium'
      }
    ],
    
    monitoring: {
      healthCheckInterval: 1000,
      alertThreshold: 5000,
      recoveryThreshold: 30000,
      dataIntegrityChecks: true
    },
    
    databases: {
      postgres: {
        enabled: true,
        testReplication: true,
        testFailover: true
      },
      clickhouse: {
        enabled: false,
        testClusterFailover: false,
        testDataReplication: false
      },
      redis: {
        enabled: true,
        testSentinelFailover: true,
        testClusterFailover: false
      },
      vector: {
        enabled: false,
        testReplication: false
      }
    }
  };
  
  try {
    const result = await failoverTester.runFailoverTests(config);
    
    logger.info('Failover tests completed!');
    logger.info(`Test ID: ${result.testId}`);
    logger.info(`Total Scenarios: ${result.summary.totalScenarios}`);
    logger.info(`Successful Failovers: ${result.summary.successfulFailovers}`);
    logger.info(`Failed Failovers: ${result.summary.failedFailovers}`);
    logger.info(`Average Recovery Time: ${result.summary.averageRecoveryTime.toFixed(2)}ms`);
    logger.info(`Data Loss Incidents: ${result.summary.dataLossIncidents}`);
    logger.info(`Data Corruption Incidents: ${result.summary.dataCorruptionIncidents}`);
    
    if (result.summary.recommendations.length > 0) {
      logger.info('Recommendations:');
      result.summary.recommendations.forEach(rec => {
        logger.info(`  - ${rec}`);
      });
    }
    
  } catch (error) {
    logger.error('Failover tests failed:', error);
    throw error;
  }
}

/**
 * Example: Monitor test status
 */
export function monitorTestStatus(): void {
  const testRunner = TestRunner.getInstance();
  const { PerformanceTester } = require('./performance-tester');
  const { FailoverTester } = require('./failover-tester');
  
  const performanceTester = PerformanceTester.getInstance();
  const failoverTester = FailoverTester.getInstance();
  
  // Check test runner status
  const runnerStatus = testRunner.getStatus();
  logger.info('Test Runner Status:', runnerStatus);
  
  // Check performance tester status
  const perfStatus = performanceTester.getStatus();
  logger.info('Performance Tester Status:', perfStatus);
  
  // Check failover tester status
  const failoverStatus = failoverTester.getStatus();
  logger.info('Failover Tester Status:', failoverStatus);
  
  // Get health check results
  const healthChecks = failoverTester.getHealthChecks();
  logger.info('Health Check Results:');
  healthChecks.forEach((health, database: string) => {
    logger.info(`  ${database}: ${health.status} (${health.responseTime}ms)`);
  });
}

// Example usage
if (require.main === module) {
  (async () => {
    try {
      // Run quick health check first
      const isHealthy = await runQuickHealthCheck();
      
      if (!isHealthy) {
        logger.error('System is not healthy. Aborting tests.');
        process.exit(1);
      }
      
      // Run comprehensive test suite
      await runComprehensiveTestSuite();
      
    } catch (error) {
      logger.error('Example execution failed:', error);
      process.exit(1);
    }
  })();
} 