/**
 * Test Runner Tests
 * Tests for the main test runner and orchestration
 */

import { TestRunner } from '../test-runner';
import { TestConfigs } from '../test-utils';

// Mock logger
jest.mock('../../../../shared/logging/logger', () => ({
  getLogger: () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  }),
}));

describe('TestRunner', () => {
  let testRunner: TestRunner;

  beforeEach(async () => {
    testRunner = new TestRunner();
    await testRunner.initialize();
  });

  afterEach(async () => {
    if (testRunner) {
      await testRunner.stop();
    }
  });

  describe('Initialization', () => {
    test('should initialize successfully', async () => {
      const newRunner = new TestRunner();
      await expect(newRunner.initialize()).resolves.not.toThrow();
      await newRunner.stop();
    });
  });

  describe('Quick Validation Tests', () => {
    test('should run quick validation suite', async () => {
      const report = await testRunner.runQuickValidation();
      
      expect(report).toBeDefined();
      expect(report.title).toContain('Quick Validation');
      expect(report.scenarios.length).toBeGreaterThan(0);
      expect(report.summary).toBeDefined();
      expect(typeof report.summary.overallScore).toBe('number');
    }, 60000);

    test('should complete quick validation within time limit', async () => {
      const startTime = Date.now();
      await testRunner.runQuickValidation();
      const duration = Date.now() - startTime;
      
      // Should complete within 15 minutes (with buffer)
      expect(duration).toBeLessThan(15 * 60 * 1000);
    }, 60000);
  });

  describe('Specialized Test Suites', () => {
    test('should run performance tests only', async () => {
      const report = await testRunner.runPerformanceTestsOnly();
      
      expect(report).toBeDefined();
      expect(report.title).toContain('Performance');
      expect(report.scenarios.length).toBeGreaterThan(0);
      
      // All scenarios should have performance metrics
      report.scenarios.forEach(scenario => {
        expect(scenario.metrics.performance).toBeDefined();
        expect(typeof scenario.metrics.performance.opportunityCaptureTime).toBe('number');
      });
    }, 120000);

    test('should run security tests only', async () => {
      const report = await testRunner.runSecurityTestsOnly();
      
      expect(report).toBeDefined();
      expect(report.title).toContain('Security');
      expect(report.scenarios.length).toBeGreaterThan(0);
      
      // All scenarios should have security metrics
      report.scenarios.forEach(scenario => {
        expect(scenario.metrics.security).toBeDefined();
        expect(typeof scenario.metrics.security.securityScore).toBe('number');
      });
    }, 180000);

    test('should run reliability tests only', async () => {
      const report = await testRunner.runReliabilityTestsOnly();
      
      expect(report).toBeDefined();
      expect(report.title).toContain('Reliability');
      expect(report.scenarios.length).toBeGreaterThan(0);
      
      // All scenarios should have reliability metrics
      report.scenarios.forEach(scenario => {
        expect(scenario.metrics.reliability).toBeDefined();
        expect(typeof scenario.metrics.reliability.uptime).toBe('number');
      });
    }, 240000);
  });

  describe('Custom Test Configurations', () => {
    test('should run CI/CD configuration', async () => {
      const config = TestConfigs.ci();
      const report = await testRunner.runCustomTestSuite(config);
      
      expect(report).toBeDefined();
      expect(report.title).toBe(config.name);
      expect(report.description).toBe(config.description);
    }, 60000);

    test('should run development configuration', async () => {
      const config = TestConfigs.development();
      const report = await testRunner.runCustomTestSuite(config);
      
      expect(report).toBeDefined();
      expect(report.scenarios.length).toBeGreaterThan(0);
      
      // Development tests should be fast
      const maxDuration = Math.max(...report.scenarios.map(s => s.endTime - s.startTime));
      expect(maxDuration).toBeLessThan(30000); // 30 seconds max per test
    }, 30000);

    test('should run security-focused configuration', async () => {
      const config = TestConfigs.security();
      const report = await testRunner.runCustomTestSuite(config);
      
      expect(report).toBeDefined();
      expect(report.scenarios.length).toBeGreaterThan(5); // Should have multiple security tests
      
      // All scenarios should be security-related
      report.scenarios.forEach(scenario => {
        expect(scenario.scenarioId).toMatch(/security|attack|vulnerability/i);
      });
    }, 240000);

    test('should run performance-focused configuration', async () => {
      const config = TestConfigs.performance();
      const report = await testRunner.runCustomTestSuite(config);
      
      expect(report).toBeDefined();
      expect(report.scenarios.length).toBeGreaterThan(3); // Should have multiple performance tests
      
      // All scenarios should be performance-related
      report.scenarios.forEach(scenario => {
        expect(scenario.scenarioId).toMatch(/performance|latency|throughput|stress/i);
      });
    }, 180000);
  });

  describe('Pre-deployment Validation', () => {
    test('should run pre-deployment checks', async () => {
      const report = await testRunner.runPreDeploymentChecks();
      
      expect(report).toBeDefined();
      expect(report.title).toContain('Pre-Deployment');
      expect(report.scenarios.length).toBeGreaterThan(10); // Should be comprehensive
      expect(report.summary.readinessLevel).toBeDefined();
      
      // Should have all types of metrics
      report.scenarios.forEach(scenario => {
        expect(scenario.metrics.performance).toBeDefined();
        expect(scenario.metrics.security).toBeDefined();
        expect(scenario.metrics.reliability).toBeDefined();
        expect(scenario.metrics.resource).toBeDefined();
      });
    }, 600000); // 10 minutes for comprehensive validation
  });

  describe('Test Status and Monitoring', () => {
    test('should get test status', async () => {
      const status = await testRunner.getTestStatus();
      
      expect(status).toBeDefined();
      expect(typeof status.activeTests).toBe('number');
      expect(typeof status.totalTestsRun).toBe('number');
      expect(Array.isArray(status.recentTests)).toBe(true);
      expect(typeof status.environment).toBe('string');
    });

    test('should track test history', async () => {
      // Run a quick test to generate history
      await testRunner.runQuickValidation();
      
      const status = await testRunner.getTestStatus();
      
      expect(status.totalTestsRun).toBeGreaterThan(0);
      expect(status.recentTests.length).toBeGreaterThan(0);
      
      status.recentTests.forEach(test => {
        expect(test.scenarioId).toBeDefined();
        expect(test.status).toMatch(/^(passed|failed|error|timeout)$/);
        expect(typeof test.duration).toBe('number');
        expect(typeof test.timestamp).toBe('number');
      });
    }, 60000);
  });

  describe('Error Handling', () => {
    test('should handle invalid custom configuration gracefully', async () => {
      const invalidConfig = {
        name: '',
        description: '',
        includePerformance: false,
        includeSecurity: false,
        includeReliability: false,
        parallelExecution: true,
        timeoutMinutes: 0,
      };

      // Should not throw but might produce empty or error results
      await expect(testRunner.runCustomTestSuite(invalidConfig)).resolves.toBeDefined();
    });

    test('should handle framework initialization failures', async () => {
      // This would test error conditions, but requires more complex mocking
      // For now, just ensure the test runner can be created multiple times
      const runner1 = new TestRunner();
      const runner2 = new TestRunner();
      
      await runner1.initialize();
      await runner2.initialize();
      
      await runner1.stop();
      await runner2.stop();
    });
  });

  describe('Factory Methods', () => {
    test('should create CI/CD configuration', () => {
      const config = TestRunner.createCICDConfig();
      
      expect(config.name).toBe('CI/CD Pipeline Tests');
      expect(config.includePerformance).toBe(true);
      expect(config.includeSecurity).toBe(true);
      expect(config.includeReliability).toBe(false);
      expect(config.parallelExecution).toBe(true);
      expect(config.timeoutMinutes).toBe(5);
    });

    test('should create nightly configuration', () => {
      const config = TestRunner.createNightlyConfig();
      
      expect(config.name).toBe('Nightly Test Suite');
      expect(config.includePerformance).toBe(true);
      expect(config.includeSecurity).toBe(true);
      expect(config.includeReliability).toBe(true);
      expect(config.timeoutMinutes).toBe(180);
    });

    test('should create production validation configuration', () => {
      const config = TestRunner.createProductionValidationConfig();
      
      expect(config.name).toBe('Production Validation');
      expect(config.includePerformance).toBe(true);
      expect(config.includeSecurity).toBe(true);
      expect(config.includeReliability).toBe(true);
      expect(config.parallelExecution).toBe(false); // Sequential for thorough validation
      expect(config.timeoutMinutes).toBe(240);
    });
  });
});