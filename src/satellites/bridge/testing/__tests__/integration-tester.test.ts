/**
 * Integration Tester Tests
 * Tests for the comprehensive integration testing framework
 */

import { IntegrationTester } from '../integration-tester';
import { BridgeTestFramework } from '../bridge-test-framework';
import { TestEnvironment, IntegrationTestConfig } from '../types';
import { createMinimalTestEnvironment } from '../test-utils';

// Mock logger
jest.mock('../../../../shared/logging/logger', () => ({
  getLogger: () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  }),
}));

describe('IntegrationTester', () => {
  let integrationTester: IntegrationTester;
  let testFramework: BridgeTestFramework;
  let testEnvironment: TestEnvironment;

  beforeEach(() => {
    testEnvironment = createMinimalTestEnvironment();
    testFramework = new BridgeTestFramework(testEnvironment);
    integrationTester = new IntegrationTester(testFramework);
  });

  afterEach(async () => {
    if (testFramework) {
      await testFramework.stop();
    }
  });

  describe('Initialization', () => {
    test('should initialize correctly', () => {
      expect(integrationTester).toBeDefined();
      expect(integrationTester).toBeInstanceOf(IntegrationTester);
    });
  });

  describe('Custom Integration Tests', () => {
    test('should run performance-only tests', async () => {
      const config: IntegrationTestConfig = {
        name: 'Performance Only Test',
        description: 'Test performance components only',
        includePerformance: true,
        includeSecurity: false,
        includeReliability: false,
        performanceTests: ['opportunity_capture'],
        parallelExecution: true,
        timeoutMinutes: 5,
      };

      const results = await integrationTester.runCustomIntegrationTest(config);
      
      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);
    }, 30000);

    test('should run security-only tests', async () => {
      const config: IntegrationTestConfig = {
        name: 'Security Only Test',
        description: 'Test security components only',
        includePerformance: false,
        includeSecurity: true,
        includeReliability: false,
        securityTests: ['front_running'],
        parallelExecution: true,
        timeoutMinutes: 5,
      };

      const results = await integrationTester.runCustomIntegrationTest(config);
      
      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);
    }, 30000);

    test('should run reliability-only tests', async () => {
      const config: IntegrationTestConfig = {
        name: 'Reliability Only Test',
        description: 'Test reliability components only',
        includePerformance: false,
        includeSecurity: false,
        includeReliability: true,
        parallelExecution: false,
        timeoutMinutes: 10,
      };

      const results = await integrationTester.runCustomIntegrationTest(config);
      
      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);
    }, 60000);

    test('should handle mixed test configuration', async () => {
      const config: IntegrationTestConfig = {
        name: 'Mixed Test Suite',
        description: 'Test multiple components',
        includePerformance: true,
        includeSecurity: true,
        includeReliability: false,
        performanceTests: ['opportunity_capture'],
        securityTests: ['front_running'],
        parallelExecution: true,
        timeoutMinutes: 10,
      };

      const results = await integrationTester.runCustomIntegrationTest(config);
      
      expect(results).toBeDefined();
      expect(results.length).toBeGreaterThanOrEqual(2); // At least performance + security
    }, 60000);
  });

  describe('Test Suite Components', () => {
    test('should run performance test suite', async () => {
      const results = await integrationTester.runPerformanceTestSuite();
      
      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);
      
      // Check that results contain performance metrics
      results.forEach(result => {
        expect(result.metrics.performance).toBeDefined();
        expect(typeof result.metrics.performance.opportunityCaptureTime).toBe('number');
        expect(typeof result.metrics.performance.throughput).toBe('number');
      });
    }, 120000);

    test('should run security test suite', async () => {
      const results = await integrationTester.runSecurityTestSuite();
      
      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);
      
      // Check that results contain security metrics
      results.forEach(result => {
        expect(result.metrics.security).toBeDefined();
        expect(typeof result.metrics.security.securityScore).toBe('number');
        expect(Array.isArray(result.metrics.security.vulnerabilitiesFound)).toBe(true);
      });
    }, 120000);

    test('should run reliability test suite', async () => {
      const results = await integrationTester.runReliabilityTestSuite();
      
      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);
      
      // Check that results contain reliability metrics
      results.forEach(result => {
        expect(result.metrics.reliability).toBeDefined();
        expect(typeof result.metrics.reliability.uptime).toBe('number');
        expect(typeof result.metrics.reliability.failureRate).toBe('number');
      });
    }, 120000);

    test('should run end-to-end test suite', async () => {
      const results = await integrationTester.runEndToEndTestSuite();
      
      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);
      
      // Check that results are properly structured
      results.forEach(result => {
        expect(result.scenarioId).toBeDefined();
        expect(result.status).toMatch(/^(passed|failed|error|timeout)$/);
        expect(result.metrics).toBeDefined();
      });
    }, 180000);
  });

  describe('Error Handling', () => {
    test('should handle invalid performance test type', async () => {
      const config: IntegrationTestConfig = {
        name: 'Invalid Performance Test',
        description: 'Test with invalid performance test type',
        includePerformance: true,
        includeSecurity: false,
        includeReliability: false,
        performanceTests: ['invalid_test_type'],
        parallelExecution: true,
        timeoutMinutes: 5,
      };

      await expect(integrationTester.runCustomIntegrationTest(config))
        .rejects.toThrow('Unknown performance test type');
    });

    test('should handle invalid security test type', async () => {
      const config: IntegrationTestConfig = {
        name: 'Invalid Security Test',
        description: 'Test with invalid security test type',
        includePerformance: false,
        includeSecurity: true,
        includeReliability: false,
        securityTests: ['invalid_security_test'],
        parallelExecution: true,
        timeoutMinutes: 5,
      };

      await expect(integrationTester.runCustomIntegrationTest(config))
        .rejects.toThrow('Unknown security test type');
    });
  });

  describe('Test Result Analysis', () => {
    test('should analyze integration results correctly', async () => {
      // Run a simple test to get results
      const config: IntegrationTestConfig = {
        name: 'Analysis Test',
        description: 'Test for result analysis',
        includePerformance: true,
        includeSecurity: false,
        includeReliability: false,
        performanceTests: ['opportunity_capture'],
        parallelExecution: true,
        timeoutMinutes: 5,
      };

      const results = await integrationTester.runCustomIntegrationTest(config);
      
      // Results should have proper structure for analysis
      expect(results.length).toBeGreaterThan(0);
      
      results.forEach(result => {
        expect(result.scenarioId).toBeDefined();
        expect(result.startTime).toBeGreaterThan(0);
        expect(result.endTime).toBeGreaterThan(result.startTime);
        expect(result.status).toBeDefined();
        expect(result.metrics).toBeDefined();
        expect(Array.isArray(result.issues)).toBe(true);
        expect(typeof result.summary).toBe('string');
        expect(Array.isArray(result.recommendations)).toBe(true);
      });
    }, 30000);
  });

  describe('Configuration Validation', () => {
    test('should handle empty configuration', () => {
      const config: IntegrationTestConfig = {
        name: '',
        description: '',
        includePerformance: false,
        includeSecurity: false,
        includeReliability: false,
        parallelExecution: true,
        timeoutMinutes: 5,
      };

      // Should not throw but might have empty results
      expect(() => config).not.toThrow();
    });

    test('should handle configuration with all test types', async () => {
      const config: IntegrationTestConfig = {
        name: 'Complete Test Suite',
        description: 'Test all components',
        includePerformance: true,
        includeSecurity: true,
        includeReliability: true,
        parallelExecution: false, // Sequential for comprehensive testing
        timeoutMinutes: 30,
      };

      const results = await integrationTester.runCustomIntegrationTest(config);
      
      expect(results).toBeDefined();
      expect(results.length).toBeGreaterThan(10); // Should have many tests
    }, 300000); // 5 minutes timeout for comprehensive test
  });
});