/**
 * Testing Infrastructure - Main Export
 * Unified testing architecture for all satellite modules
 */

export * from './core-testing-infrastructure';
export * from './rust-test-integration';
export * from './test-environment-manager';
export * from './coverage-reporter';

import {
  CoreTestingInfrastructure,
  TestRunner,
  TestConfig,
  TestResult,
  TestSuite,
  TestCase,
} from './core-testing-infrastructure';

import {
  RustTestRunner,
  UnifiedTestRunner,
  RustTestConfig,
} from './rust-test-integration';

import {
  TestEnvironmentManager,
  TestEnvironmentConfig,
} from './test-environment-manager';

import {
  CoverageReporter,
  CoverageReport,
} from './coverage-reporter';

export interface YieldSenseiTestingConfig extends Omit<TestConfig, 'coverage'> {
  environmentConfig: TestEnvironmentConfig;
  rust: {
    projects: Array<{
      name: string;
      path: string;
      config: RustTestConfig;
    }>;
  };
  coverage: {
    outputDir: string;
    typescript: boolean;
    rust: boolean;
    unified: boolean;
  };
}

export class YieldSenseiTestingFramework {
  private coreInfra: CoreTestingInfrastructure;
  private rustRunner: UnifiedTestRunner;
  private envManager: TestEnvironmentManager;
  private coverageReporter: CoverageReporter;
  private config: YieldSenseiTestingConfig;

  constructor(config: YieldSenseiTestingConfig) {
    this.config = config;
    this.coreInfra = new CoreTestingInfrastructure({
      ...config,
      coverage: false, // Convert to boolean for base config
    });
    this.rustRunner = new UnifiedTestRunner();
    this.envManager = new TestEnvironmentManager(config.environmentConfig);
    this.coverageReporter = new CoverageReporter(config.coverage.outputDir);

    // Configure Rust projects
    for (const project of config.rust.projects) {
      this.rustRunner.addRustProject(project.name, {
        ...project.config,
        cargoPath: project.path,
      });
    }
  }

  async setupTestEnvironment(): Promise<void> {
    await this.envManager.setup();
  }

  async teardownTestEnvironment(): Promise<void> {
    await this.envManager.cleanup();
  }

  async runTypeScriptTests(suites: TestSuite[]): Promise<TestResult[]> {
    const allResults: TestResult[] = [];
    
    for (const suite of suites) {
      const results = await this.coreInfra.runTestSuite(suite);
      allResults.push(...results);
    }

    return allResults;
  }

  async runRustTests(): Promise<Map<string, TestResult[]>> {
    return this.rustRunner.runAllRustTests();
  }

  async runAllTests(suites: TestSuite[]): Promise<{
    typescript: TestResult[];
    rust: Map<string, TestResult[]>;
  }> {
    const [typescript, rust] = await Promise.all([
      this.runTypeScriptTests(suites),
      this.runRustTests(),
    ]);

    return { typescript, rust };
  }

  async generateCoverageReports(projectRoot: string): Promise<CoverageReport[]> {
    const reports: CoverageReport[] = [];

    if (this.config.coverage.typescript) {
      try {
        const tsReport = await this.coverageReporter.generateTypeScriptCoverage(projectRoot);
        reports.push(tsReport);
      } catch (error) {
        console.warn('Failed to generate TypeScript coverage:', error);
      }
    }

    if (this.config.coverage.rust) {
      for (const project of this.config.rust.projects) {
        try {
          const rustReport = await this.coverageReporter.generateRustCoverage(project.path);
          reports.push(rustReport);
        } catch (error) {
          console.warn(`Failed to generate Rust coverage for ${project.name}:`, error);
        }
      }
    }

    if (this.config.coverage.unified && reports.length > 0) {
      await this.coverageReporter.generateUnifiedReport(reports);
    }

    return reports;
  }

  getTestSummary(): any {
    return this.coreInfra.getSummary();
  }

  getServiceEndpoint(service: string): string | null {
    return this.envManager.getServiceEndpoint(service);
  }
}

// Factory function for common configurations
export function createYieldSenseiTestingFramework(
  overrides: Partial<YieldSenseiTestingConfig> = {}
): YieldSenseiTestingFramework {
  const defaultConfig: YieldSenseiTestingConfig = {
    timeout: 30000,
    retries: 0,
    parallel: true,
    environment: 'unit',
    environmentConfig: {
      databases: {
        postgres: {
          host: 'localhost',
          port: 5432,
          username: 'test',
          password: 'test',
          database: 'yield_sensei_test',
        },
        redis: {
          host: 'localhost',
          port: 6379,
        },
      },
      services: {},
      cleanup: true,
      timeouts: {
        setup: 60000,
        teardown: 30000,
      },
    },
    rust: {
      projects: [
        {
          name: 'aegis',
          path: 'src/satellites/aegis',
          config: {
            cargoPath: 'src/satellites/aegis',
            features: ['test-utils'],
            release: false,
            nocapture: false,
            testThreads: 1,
          },
        },
        {
          name: 'state-engine',
          path: 'src/core/orchestration/state',
          config: {
            cargoPath: 'src/core/orchestration/state',
            features: [],
            release: false,
            nocapture: false,
            testThreads: 1,
          },
        },
      ],
    },
    coverage: {
      outputDir: 'coverage',
      typescript: true,
      rust: true,
      unified: true,
    },
    ...overrides,
  };

  return new YieldSenseiTestingFramework(defaultConfig);
}