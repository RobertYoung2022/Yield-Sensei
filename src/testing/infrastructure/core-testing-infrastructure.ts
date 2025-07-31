/**
 * Core Testing Infrastructure
 * Unified testing architecture for all satellite modules
 */

import { performance } from 'perf_hooks';
import { Logger } from 'winston';
import { createLogger, format, transports } from 'winston';

export interface TestConfig {
  timeout: number;
  retries: number;
  parallel: boolean;
  coverage: boolean;
  environment: 'unit' | 'integration' | 'e2e' | 'performance';
}

export interface TestResult {
  name: string;
  status: 'passed' | 'failed' | 'skipped';
  duration: number;
  error?: Error;
  metadata?: Record<string, any>;
}

export interface TestSuite {
  name: string;
  setup?: () => Promise<void>;
  teardown?: () => Promise<void>;
  tests: TestCase[];
}

export interface TestCase {
  name: string;
  fn: () => Promise<void>;
  timeout?: number;
  skip?: boolean;
  only?: boolean;
}

export class CoreTestingInfrastructure {
  private logger: Logger;
  private config: TestConfig;
  private results: TestResult[] = [];

  constructor(config: Partial<TestConfig> = {}) {
    this.config = {
      timeout: 30000,
      retries: 0,
      parallel: true,
      coverage: false,
      environment: 'unit',
      ...config,
    };

    this.logger = createLogger({
      level: 'debug',
      format: format.combine(
        format.timestamp(),
        format.errors({ stack: true }),
        format.json()
      ),
      transports: [
        new transports.Console({
          format: format.combine(
            format.colorize(),
            format.simple()
          )
        }),
        new transports.File({ 
          filename: `logs/test-${this.config.environment}-${Date.now()}.log` 
        })
      ],
    });
  }

  async runTestSuite(suite: TestSuite): Promise<TestResult[]> {
    this.logger.info(`Starting test suite: ${suite.name}`);
    
    try {
      if (suite.setup) {
        await suite.setup();
      }

      const results = this.config.parallel
        ? await this.runTestsParallel(suite.tests)
        : await this.runTestsSequential(suite.tests);

      if (suite.teardown) {
        await suite.teardown();
      }

      this.results.push(...results);
      return results;
    } catch (error) {
      this.logger.error(`Test suite ${suite.name} failed:`, error);
      throw error;
    }
  }

  private async runTestsParallel(tests: TestCase[]): Promise<TestResult[]> {
    const promises = tests.map(test => this.runSingleTest(test));
    return Promise.all(promises);
  }

  private async runTestsSequential(tests: TestCase[]): Promise<TestResult[]> {
    const results: TestResult[] = [];
    for (const test of tests) {
      results.push(await this.runSingleTest(test));
    }
    return results;
  }

  private async runSingleTest(test: TestCase): Promise<TestResult> {
    if (test.skip) {
      return {
        name: test.name,
        status: 'skipped',
        duration: 0,
      };
    }

    const startTime = performance.now();
    const timeout = test.timeout || this.config.timeout;

    try {
      await this.withTimeout(test.fn(), timeout);
      const duration = performance.now() - startTime;
      
      this.logger.debug(`Test passed: ${test.name} (${duration.toFixed(2)}ms)`);
      return {
        name: test.name,
        status: 'passed',
        duration,
      };
    } catch (error) {
      const duration = performance.now() - startTime;
      this.logger.error(`Test failed: ${test.name}`, error);
      
      return {
        name: test.name,
        status: 'failed',
        duration,
        error: error as Error,
      };
    }
  }

  private async withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    const timeout = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`Test timeout after ${ms}ms`)), ms);
    });

    return Promise.race([promise, timeout]);
  }

  getResults(): TestResult[] {
    return [...this.results];
  }

  getSummary() {
    const total = this.results.length;
    const passed = this.results.filter(r => r.status === 'passed').length;
    const failed = this.results.filter(r => r.status === 'failed').length;
    const skipped = this.results.filter(r => r.status === 'skipped').length;
    const totalDuration = this.results.reduce((sum, r) => sum + r.duration, 0);

    return {
      total,
      passed,
      failed,
      skipped,
      successRate: total > 0 ? (passed / total) * 100 : 0,
      totalDuration,
      averageDuration: total > 0 ? totalDuration / total : 0,
    };
  }

  reset(): void {
    this.results = [];
  }
}

export class TestRunner {
  private infrastructure: CoreTestingInfrastructure;

  constructor(config: Partial<TestConfig> = {}) {
    this.infrastructure = new CoreTestingInfrastructure(config);
  }

  describe(name: string, tests: TestCase[]): TestSuite {
    return {
      name,
      tests,
    };
  }

  it(name: string, fn: () => Promise<void>, options: Partial<TestCase> = {}): TestCase {
    return {
      name,
      fn,
      ...options,
    };
  }

  async run(suites: TestSuite[]): Promise<void> {
    for (const suite of suites) {
      await this.infrastructure.runTestSuite(suite);
    }

    const summary = this.infrastructure.getSummary();
    console.log('\n--- Test Summary ---');
    console.log(`Total: ${summary.total}`);
    console.log(`Passed: ${summary.passed}`);
    console.log(`Failed: ${summary.failed}`);
    console.log(`Skipped: ${summary.skipped}`);
    console.log(`Success Rate: ${summary.successRate.toFixed(2)}%`);
    console.log(`Total Duration: ${summary.totalDuration.toFixed(2)}ms`);
    
    if (summary.failed > 0) {
      process.exit(1);
    }
  }
}

export const testRunner = new TestRunner();