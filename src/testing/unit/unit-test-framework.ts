/**
 * Unit Testing Framework
 * Comprehensive unit testing framework with mocking capabilities
 */

import { TestCase, TestSuite } from '../infrastructure/core-testing-infrastructure';

export interface MockConfig {
  mockType: 'function' | 'class' | 'module' | 'api';
  returnValue?: any;
  implementation?: (...args: any[]) => any;
  callCount?: number;
  callHistory?: any[][];
}

export interface UnitTestConfig {
  isolationLevel: 'complete' | 'partial' | 'minimal';
  autoMock: boolean;
  mockExternal: boolean;
  coverageThreshold: number;
}

export interface Assertion {
  toBe(expected: any): void;
  toEqual(expected: any): void;
  toBeNull(): void;
  toBeUndefined(): void;
  toBeTruthy(): void;
  toBeFalsy(): void;
  toContain(expected: any): void;
  toThrow(expected?: string | RegExp): void;
  toHaveBeenCalled(): void;
  toHaveBeenCalledWith(...args: any[]): void;
  toHaveBeenCalledTimes(times: number): void;
}

export class MockObject {
  private callHistory: any[][] = [];
  private returnValues: any[] = [];
  private implementations: Function[] = [];
  private callCount = 0;

  constructor(_config: MockConfig) {
    // Config stored for future use
  }

  mockReturnValue(value: any): this {
    this.returnValues.push(value);
    return this;
  }

  mockImplementation(impl: Function): this {
    this.implementations.push(impl);
    return this;
  }

  mockReturnValueOnce(value: any): this {
    this.returnValues[this.callCount] = value;
    return this;
  }

  resetMock(): void {
    this.callHistory = [];
    this.returnValues = [];
    this.implementations = [];
    this.callCount = 0;
  }

  getMockImplementation(): Function {
    return (...args: any[]) => {
      this.callHistory.push(args);
      
      const implementation = this.implementations[this.callCount] || this.implementations[this.implementations.length - 1];
      const returnValue = this.returnValues[this.callCount] || this.returnValues[this.returnValues.length - 1];
      
      this.callCount++;

      if (implementation) {
        return implementation(...args);
      }
      
      return returnValue;
    };
  }

  getCallHistory(): any[][] {
    return [...this.callHistory];
  }

  getCallCount(): number {
    return this.callCount;
  }

  wasCalledWith(...args: any[]): boolean {
    return this.callHistory.some(call => 
      call.length === args.length && 
      call.every((arg, index) => this.deepEqual(arg, args[index]))
    );
  }

  private deepEqual(a: any, b: any): boolean {
    if (a === b) return true;
    if (a == null || b == null) return false;
    if (typeof a !== typeof b) return false;
    
    if (typeof a === 'object') {
      const keysA = Object.keys(a);
      const keysB = Object.keys(b);
      
      if (keysA.length !== keysB.length) return false;
      
      return keysA.every(key => this.deepEqual(a[key], b[key]));
    }
    
    return false;
  }
}

export class UnitTestFramework {
  private mocks: Map<string, MockObject> = new Map();
  private _config: UnitTestConfig;

  constructor(config: Partial<UnitTestConfig> = {}) {
    this._config = {
      isolationLevel: 'complete',
      autoMock: true,
      mockExternal: true,
      coverageThreshold: 80,
      ...config,
    };
  }

  describe(description: string, tests: () => void): TestSuite {
    const testCases: TestCase[] = [];
    
    // Capture test cases during execution  
    const originalIt = (global as any).it;
    (global as any).it = (name: string, fn: () => Promise<void>) => {
      testCases.push({ name, fn });
    };

    tests();
    
    // Restore original it function
    (global as any).it = originalIt;

    return {
      name: description,
      tests: testCases,
      setup: async () => {
        await this.setupTestEnvironment();
      },
      teardown: async () => {
        await this.teardownTestEnvironment();
      },
    };
  }

  it(description: string, testFn: () => Promise<void>): TestCase {
    return {
      name: description,
      fn: testFn,
    };
  }

  createMock(name: string, config: MockConfig): MockObject {
    const mock = new MockObject(config);
    this.mocks.set(name, mock);
    return mock;
  }

  getMock(name: string): MockObject | undefined {
    return this.mocks.get(name);
  }

  expect(actual: any): Assertion {
    return {
      toBe: (expected: any) => {
        if (actual !== expected) {
          throw new Error(`Expected ${actual} to be ${expected}`);
        }
      },
      
      toEqual: (expected: any) => {
        if (!this.deepEqual(actual, expected)) {
          throw new Error(`Expected ${JSON.stringify(actual)} to equal ${JSON.stringify(expected)}`);
        }
      },
      
      toBeNull: () => {
        if (actual !== null) {
          throw new Error(`Expected ${actual} to be null`);
        }
      },
      
      toBeUndefined: () => {
        if (actual !== undefined) {
          throw new Error(`Expected ${actual} to be undefined`);
        }
      },
      
      toBeTruthy: () => {
        if (!actual) {
          throw new Error(`Expected ${actual} to be truthy`);
        }
      },
      
      toBeFalsy: () => {
        if (actual) {
          throw new Error(`Expected ${actual} to be falsy`);
        }
      },
      
      toContain: (expected: any) => {
        if (Array.isArray(actual)) {
          if (!actual.includes(expected)) {
            throw new Error(`Expected ${JSON.stringify(actual)} to contain ${expected}`);
          }
        } else if (typeof actual === 'string') {
          if (!actual.includes(expected)) {
            throw new Error(`Expected "${actual}" to contain "${expected}"`);
          }
        } else {
          throw new Error(`Cannot check containment on ${typeof actual}`);
        }
      },
      
      toThrow: (expected?: string | RegExp) => {
        if (typeof actual !== 'function') {
          throw new Error('Expected a function to test for throwing');
        }
        
        try {
          actual();
          throw new Error('Expected function to throw but it did not');
        } catch (error) {
          if (expected) {
            const message = (error as Error).message;
            if (typeof expected === 'string' && !message.includes(expected)) {
              throw new Error(`Expected error message to contain "${expected}" but got "${message}"`);
            } else if (expected instanceof RegExp && !expected.test(message)) {
              throw new Error(`Expected error message to match ${expected} but got "${message}"`);
            }
          }
        }
      },
      
      toHaveBeenCalled: () => {
        if (!(actual instanceof MockObject)) {
          throw new Error('Expected a mock object');
        }
        if (actual.getCallCount() === 0) {
          throw new Error('Expected mock to have been called');
        }
      },
      
      toHaveBeenCalledWith: (...args: any[]) => {
        if (!(actual instanceof MockObject)) {
          throw new Error('Expected a mock object');
        }
        if (!actual.wasCalledWith(...args)) {
          throw new Error(`Expected mock to have been called with ${JSON.stringify(args)}`);
        }
      },
      
      toHaveBeenCalledTimes: (times: number) => {
        if (!(actual instanceof MockObject)) {
          throw new Error('Expected a mock object');
        }
        if (actual.getCallCount() !== times) {
          throw new Error(`Expected mock to have been called ${times} times but was called ${actual.getCallCount()} times`);
        }
      },
    };
  }

  async setupTestEnvironment(): Promise<void> {
    // Clear all mocks
    for (const mock of Array.from(this.mocks.values())) {
      mock.resetMock();
    }

    // Setup isolation based on configuration
    if (this._config.isolationLevel === 'complete') {
      await this.setupCompleteIsolation();
    } else if (this._config.isolationLevel === 'partial') {
      await this.setupPartialIsolation();
    }
  }

  async teardownTestEnvironment(): Promise<void> {
    // Clean up mocks and restore original implementations
    this.mocks.clear();
  }

  private async setupCompleteIsolation(): Promise<void> {
    // Mock all external dependencies if auto-mocking is enabled
    if (this._config.autoMock) {
      await this.mockExternalModules();
    }
  }

  private async setupPartialIsolation(): Promise<void> {
    // Mock only critical external dependencies
    if (this._config.mockExternal) {
      await this.mockCriticalDependencies();
    }
  }

  private async mockExternalModules(): Promise<void> {
    // Mock common external modules
    const externalModules = [
      'axios',
      'ioredis',
      'pg',
      'kafkajs',
      'winston',
    ];

    for (const moduleName of externalModules) {
      this.createMock(moduleName, {
        mockType: 'module',
        implementation: () => ({}),
      });
    }
  }

  private async mockCriticalDependencies(): Promise<void> {
    // Mock only database and external API calls
    this.createMock('database', {
      mockType: 'class',
      implementation: () => ({
        query: () => Promise.resolve([]),
        connect: () => Promise.resolve(),
        disconnect: () => Promise.resolve(),
      }),
    });

    this.createMock('external-api', {
      mockType: 'api',
      implementation: () => Promise.resolve({ data: {} }),
    });
  }

  private deepEqual(a: any, b: any): boolean {
    if (a === b) return true;
    if (a == null || b == null) return false;
    if (typeof a !== typeof b) return false;
    
    if (typeof a === 'object') {
      const keysA = Object.keys(a);
      const keysB = Object.keys(b);
      
      if (keysA.length !== keysB.length) return false;
      
      return keysA.every(key => this.deepEqual(a[key], b[key]));
    }
    
    return false;
  }
}

// Snapshot testing functionality
export class SnapshotTester {
  private snapshots: Map<string, any> = new Map();

  toMatchSnapshot(testName: string, actual: any): void {
    const serialized = this.serialize(actual);
    const existing = this.snapshots.get(testName);

    if (existing === undefined) {
      this.snapshots.set(testName, serialized);
      console.log(`Snapshot created for ${testName}`);
    } else if (existing !== serialized) {
      throw new Error(`Snapshot mismatch for ${testName}:\nExpected: ${existing}\nActual: ${serialized}`);
    }
  }

  updateSnapshot(testName: string, actual: any): void {
    const serialized = this.serialize(actual);
    this.snapshots.set(testName, serialized);
  }

  private serialize(value: any): string {
    return JSON.stringify(value, null, 2);
  }
}

// Property-based testing utilities
export class PropertyTester {
  static forAll<T>(
    generator: () => T,
    property: (value: T) => boolean,
    iterations: number = 100
  ): void {
    for (let i = 0; i < iterations; i++) {
      const value = generator();
      if (!property(value)) {
        throw new Error(`Property failed for value: ${JSON.stringify(value)}`);
      }
    }
  }

  static generators = {
    integer: (min: number = -1000, max: number = 1000) => 
      () => Math.floor(Math.random() * (max - min + 1)) + min,
    
    string: (length: number = 10) => 
      () => Math.random().toString(36).substring(2, 2 + length),
    
    array: <T>(elementGenerator: () => T, maxLength: number = 10) => 
      () => Array.from({ length: Math.floor(Math.random() * maxLength) }, elementGenerator),
    
    object: (keyGen: () => string, valueGen: () => any, maxKeys: number = 5) => 
      () => {
        const obj: any = {};
        const keyCount = Math.floor(Math.random() * maxKeys) + 1;
        for (let i = 0; i < keyCount; i++) {
          obj[keyGen()] = valueGen();
        }
        return obj;
      },
  };
}

// Export singleton instance
export const unitTestFramework = new UnitTestFramework();
export const snapshotTester = new SnapshotTester();