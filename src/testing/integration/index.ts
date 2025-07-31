/**
 * Integration Testing Framework Exports
 * Central export point for all integration testing utilities
 */

export * from './integration-testing-framework';
export * from './contract-testing';
export * from './service-virtualization';
export * from './database-testing-helpers';
export * from './message-queue-testing';
export * from './distributed-testing';
export * from './async-communication-testing';

// Re-export key classes for convenience
export { IntegrationTestingFramework } from './integration-testing-framework';
export { ContractTester } from './contract-testing';
export { ServiceVirtualizationFramework, CircuitBreaker } from './service-virtualization';
export { DatabaseTestingHelpers } from './database-testing-helpers';
export { MessageQueueTestHelper } from './message-queue-testing';
export { DistributedSystemTester } from './distributed-testing';
export { AsyncCommunicationTester, AsyncPatternHelpers } from './async-communication-testing';

// Export common test scenarios
import { DistributedSystemTester } from './distributed-testing';
import { ContractTester } from './contract-testing';

export const TestScenarios = {
  satelliteIntegration: DistributedSystemTester.createSatelliteIntegrationScenario(),
  crossChainArbitrage: DistributedSystemTester.createCrossChainArbitrageScenario(),
  userServiceContract: ContractTester.createUserServiceContract(),
  portfolioServiceContract: ContractTester.createPortfolioServiceContract(),
  getSatelliteContract: (name: string) => ContractTester.createSatelliteServiceContract(name),
};

// Export test configuration types
export interface IntegrationTestSuite {
  name: string;
  description: string;
  setup?: () => Promise<void>;
  teardown?: () => Promise<void>;
  tests: IntegrationTest[];
}

export interface IntegrationTest {
  name: string;
  description?: string;
  timeout?: number;
  retries?: number;
  run: () => Promise<void>;
}

// Factory function for creating integration test suites
export function createIntegrationTestSuite(
  name: string,
  tests: IntegrationTest[]
): IntegrationTestSuite {
  return {
    name,
    description: `Integration test suite for ${name}`,
    tests,
  };
}

// Utility function for running integration test suites
export async function runIntegrationTestSuite(
  suite: IntegrationTestSuite,
  options?: {
    bail?: boolean;
    parallel?: boolean;
    reporter?: (result: any) => void;
  }
): Promise<{
  suite: string;
  passed: number;
  failed: number;
  skipped: number;
  duration: number;
  results: Array<{
    test: string;
    passed: boolean;
    duration: number;
    error?: string;
  }>;
}> {
  const startTime = Date.now();
  const results: Array<{
    test: string;
    passed: boolean;
    duration: number;
    error?: string;
  }> = [];

  // Run setup if provided
  if (suite.setup) {
    await suite.setup();
  }

  try {
    if (options?.parallel) {
      // Run tests in parallel
      const promises = suite.tests.map(async (test) => {
        const testStart = Date.now();
        try {
          await test.run();
          const result = {
            test: test.name,
            passed: true,
            duration: Date.now() - testStart,
          };
          results.push(result);
          options.reporter?.(result);
        } catch (error) {
          const result = {
            test: test.name,
            passed: false,
            duration: Date.now() - testStart,
            error: (error as Error).message,
          };
          results.push(result);
          options.reporter?.(result);
          
          if (options.bail) {
            throw error;
          }
        }
      });

      await Promise.all(promises);
    } else {
      // Run tests sequentially
      for (const test of suite.tests) {
        const testStart = Date.now();
        try {
          await test.run();
          const result = {
            test: test.name,
            passed: true,
            duration: Date.now() - testStart,
          };
          results.push(result);
          options?.reporter?.(result);
        } catch (error) {
          const result = {
            test: test.name,
            passed: false,
            duration: Date.now() - testStart,
            error: (error as Error).message,
          };
          results.push(result);
          options?.reporter?.(result);
          
          if (options?.bail) {
            break;
          }
        }
      }
    }
  } finally {
    // Run teardown if provided
    if (suite.teardown) {
      await suite.teardown();
    }
  }

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const skipped = suite.tests.length - results.length;

  return {
    suite: suite.name,
    passed,
    failed,
    skipped,
    duration: Date.now() - startTime,
    results,
  };
}