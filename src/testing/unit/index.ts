/**
 * Unit Testing Framework - Main Export
 * Comprehensive unit testing capabilities for all satellite modules
 */

export * from './unit-test-framework';
export * from './mock-utilities';
export * from './test-fixtures';

import {
  UnitTestFramework,
  MockObject,
  SnapshotTester,
  PropertyTester,
  unitTestFramework,
  snapshotTester,
} from './unit-test-framework';

import {
  DatabaseMock,
  RedisMock,
  KafkaMock,
  ExternalApiMock,
  createDatabaseMock,
  createRedisMock,
  createKafkaMock,
  createExternalApiMock,
  createCommonMocks,
} from './mock-utilities';

import {
  TestFixtures,
  CommonFixtureSets,
} from './test-fixtures';

// Enhanced test utilities that combine framework capabilities
export class UnitTestUtils {
  static async runWithMocks<T>(
    testFn: (mocks: ReturnType<typeof createCommonMocks>) => Promise<T>,
    mockOverrides: Partial<ReturnType<typeof createCommonMocks>> = {}
  ): Promise<T> {
    const mocks = { ...createCommonMocks(), ...mockOverrides };
    
    try {
      return await testFn(mocks);
    } finally {
      // Cleanup mocks
      Object.values(mocks).forEach(mock => {
        if (mock instanceof MockObject) {
          mock.resetMock();
        }
      });
    }
  }

  static createTestSuite(
    name: string,
    setupFn: () => Promise<void> | void,
    teardownFn: () => Promise<void> | void,
    tests: Array<{ name: string; fn: () => Promise<void> }>
  ) {
    return unitTestFramework.describe(name, () => {
      tests.forEach(test => {
        unitTestFramework.it(test.name, test.fn);
      });
    });
  }

  static async withTimeout<T>(
    operation: () => Promise<T>,
    timeoutMs: number,
    errorMessage?: string
  ): Promise<T> {
    const timeout = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(errorMessage || `Operation timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    });

    return Promise.race([operation(), timeout]);
  }

  static async retry<T>(
    operation: () => Promise<T>,
    maxAttempts: number = 3,
    delayMs: number = 100
  ): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        if (attempt < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, delayMs * attempt));
        }
      }
    }
    
    throw lastError!;
  }

  static measureExecutionTime<T>(operation: () => T): { result: T; duration: number } {
    const start = performance.now();
    const result = operation();
    const duration = performance.now() - start;
    return { result, duration };
  }

  static async measureAsyncExecutionTime<T>(
    operation: () => Promise<T>
  ): Promise<{ result: T; duration: number }> {
    const start = performance.now();
    const result = await operation();
    const duration = performance.now() - start;
    return { result, duration };
  }

  static createMemoryLeakDetector() {
    const initialMemory = process.memoryUsage();
    
    return {
      check: (maxIncreasePercent: number = 50) => {
        const currentMemory = process.memoryUsage();
        const heapIncrease = ((currentMemory.heapUsed - initialMemory.heapUsed) / initialMemory.heapUsed) * 100;
        
        if (heapIncrease > maxIncreasePercent) {
          throw new Error(`Potential memory leak detected: heap usage increased by ${heapIncrease.toFixed(2)}%`);
        }
        
        return {
          initial: initialMemory,
          current: currentMemory,
          increase: heapIncrease,
        };
      },
    };
  }

  static createResourceMonitor() {
    const resources = {
      openHandles: new Set<any>(),
      timers: new Set<NodeJS.Timeout>(),
      intervals: new Set<NodeJS.Timeout>(),
    };

    return {
      addHandle: (handle: any) => resources.openHandles.add(handle),
      addTimer: (timer: NodeJS.Timeout) => resources.timers.add(timer),
      addInterval: (interval: NodeJS.Timeout) => resources.intervals.add(interval),
      
      cleanup: () => {
        resources.timers.forEach(timer => clearTimeout(timer));
        resources.intervals.forEach(interval => clearInterval(interval));
        resources.openHandles.forEach(handle => {
          if (handle.close) handle.close();
          if (handle.end) handle.end();
          if (handle.destroy) handle.destroy();
        });
        
        resources.openHandles.clear();
        resources.timers.clear();
        resources.intervals.clear();
      },
      
      getStats: () => ({
        openHandles: resources.openHandles.size,
        timers: resources.timers.size,
        intervals: resources.intervals.size,
      }),
    };
  }
}

// Satellite-specific test utilities
export class SatelliteTestUtils {
  static createEchoTestSuite(tests: Array<{ name: string; fn: () => Promise<void> }>) {
    return UnitTestUtils.createTestSuite(
      'Echo Satellite Tests',
      async () => {
        // Setup Echo-specific test environment
      },
      async () => {
        // Cleanup Echo-specific resources
      },
      tests
    );
  }

  static createSageTestSuite(tests: Array<{ name: string; fn: () => Promise<void> }>) {
    return UnitTestUtils.createTestSuite(
      'Sage Satellite Tests',
      async () => {
        // Setup Sage-specific test environment
      },
      async () => {
        // Cleanup Sage-specific resources
      },
      tests
    );
  }

  static createBridgeTestSuite(tests: Array<{ name: string; fn: () => Promise<void> }>) {
    return UnitTestUtils.createTestSuite(
      'Bridge Satellite Tests',
      async () => {
        // Setup Bridge-specific test environment
      },
      async () => {
        // Cleanup Bridge-specific resources
      },
      tests
    );
  }

  static createAegisTestSuite(tests: Array<{ name: string; fn: () => Promise<void> }>) {
    return UnitTestUtils.createTestSuite(
      'Aegis Satellite Tests',
      async () => {
        // Setup Aegis-specific test environment
      },
      async () => {
        // Cleanup Aegis-specific resources
      },
      tests
    );
  }

  static createPulseTestSuite(tests: Array<{ name: string; fn: () => Promise<void> }>) {
    return UnitTestUtils.createTestSuite(
      'Pulse Satellite Tests',
      async () => {
        // Setup Pulse-specific test environment
      },
      async () => {
        // Cleanup Pulse-specific resources
      },
      tests
    );
  }

  static createForgeTestSuite(tests: Array<{ name: string; fn: () => Promise<void> }>) {
    return UnitTestUtils.createTestSuite(
      'Forge Satellite Tests',
      async () => {
        // Setup Forge-specific test environment
      },
      async () => {
        // Cleanup Forge-specific resources
      },
      tests
    );
  }

  static createOracleTestSuite(tests: Array<{ name: string; fn: () => Promise<void> }>) {
    return UnitTestUtils.createTestSuite(
      'Oracle Satellite Tests',
      async () => {
        // Setup Oracle-specific test environment
      },
      async () => {
        // Cleanup Oracle-specific resources
      },
      tests
    );
  }
}

// Jest integration helpers
export class JestIntegration {
  static setupJestMocks() {
    // Global mocks for Jest environment
    const mocks = createCommonMocks();
    
    // Mock external modules
    jest.mock('axios', () => mocks.api);
    jest.mock('ioredis', () => ({ Redis: jest.fn(() => mocks.redis) }));
    jest.mock('pg', () => ({ Client: jest.fn(() => mocks.database) }));
    jest.mock('kafkajs', () => ({ Kafka: jest.fn(() => mocks.kafka) }));
    
    return mocks;
  }

  static createJestTestSuite(
    description: string,
    tests: Array<{ name: string; fn: () => Promise<void> | void }>
  ) {
    describe(description, () => {
      let mocks: ReturnType<typeof createCommonMocks>;
      let resourceMonitor: ReturnType<typeof UnitTestUtils.createResourceMonitor>;

      beforeAll(() => {
        mocks = createCommonMocks();
        resourceMonitor = UnitTestUtils.createResourceMonitor();
      });

      afterAll(() => {
        resourceMonitor.cleanup();
      });

      tests.forEach(test => {
        it(test.name, test.fn);
      });
    });
  }
}

// Export configured instances
export const unitTest = unitTestFramework;
export const snapshot = snapshotTester;
export const fixtures = TestFixtures;
export const fixtureSets = CommonFixtureSets;
export const utils = UnitTestUtils;
export const satelliteUtils = SatelliteTestUtils;
export const jestIntegration = JestIntegration;