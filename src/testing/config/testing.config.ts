import { TestConfig, UnitTestConfig, IntegrationTestConfig, SecurityTestConfig, PerformanceTestConfig, ContractTestConfig, ComplianceTestConfig } from '../types';

/**
 * Centralized testing configuration for YieldSensei
 * Manages all testing environments, settings, and parameters
 */
export class TestingConfig {
  private static instance: TestingConfig;
  private config: TestConfig;

  private constructor() {
    this.config = this.loadConfiguration();
  }

  public static getInstance(): TestingConfig {
    if (!TestingConfig.instance) {
      TestingConfig.instance = new TestingConfig();
    }
    return TestingConfig.instance;
  }

  /**
   * Get the main testing configuration
   */
  public getConfig(): TestConfig {
    return this.config;
  }

  /**
   * Get unit testing specific configuration
   */
  public getUnitTestConfig(): UnitTestConfig {
    return {
      ...this.config,
      mocking: {
        enabled: true,
        database: true,
        externalServices: true,
        fileSystem: true,
      },
      isolation: {
        enabled: true,
        resetState: true,
        clearCache: true,
      },
    };
  }

  /**
   * Get integration testing specific configuration
   */
  public getIntegrationTestConfig(): IntegrationTestConfig {
    return {
      ...this.config,
      database: {
        setup: 'clean',
        teardown: 'clean',
        connectionString: process.env['TEST_DATABASE_URL'] || 'mongodb://localhost:27017/yieldsensei_test',
      },
      externalServices: {
        mock: true,
        endpoints: {
          marketData: 'http://localhost:3001/mock/market-data',
          riskAssessment: 'http://localhost:3001/mock/risk-assessment',
          portfolio: 'http://localhost:3001/mock/portfolio',
        },
      },
      session: {
        enabled: true,
        persistence: true,
      },
    };
  }

  /**
   * Get security testing specific configuration
   */
  public getSecurityTestConfig(): SecurityTestConfig {
    return {
      ...this.config,
      penetrationTesting: {
        enabled: true,
        payloads: this.getSecurityPayloads(),
        scanDepth: 'comprehensive',
      },
      vulnerabilityScanning: {
        enabled: true,
        tools: ['owasp-zap', 'nuclei', 'custom-scanner'],
        severity: 'medium',
      },
      compliance: {
        enabled: true,
        standards: ['owasp-top-10', 'cwe', 'cve'],
      },
    };
  }

  /**
   * Get performance testing specific configuration
   */
  public getPerformanceTestConfig(): PerformanceTestConfig {
    return {
      ...this.config,
      loadTesting: {
        enabled: true,
        scenarios: this.getLoadTestScenarios(),
        metrics: this.getBaselineMetrics(),
      },
      stressTesting: {
        enabled: true,
        maxLoad: 1000,
        rampUp: 60,
        holdTime: 300,
      },
      spikeTesting: {
        enabled: true,
        spikeLoad: 2000,
        spikeDuration: 30,
      },
    };
  }

  /**
   * Get contract testing specific configuration
   */
  public getContractTestConfig(): ContractTestConfig {
    return {
      ...this.config,
      openApi: {
        specPath: './docs/openapi.yaml',
        validateResponses: true,
        validateSchemas: true,
      },
      consumer: {
        name: 'yieldsensei-frontend',
        version: '1.0.0',
      },
      provider: {
        name: 'yieldsensei-api',
        version: '1.0.0',
      },
    };
  }

  /**
   * Get compliance testing specific configuration
   */
  public getComplianceTestConfig(): ComplianceTestConfig {
    return {
      ...this.config,
      standards: {
        gdpr: true,
        sox: true,
        pci: true,
        hipaa: false,
        iso27001: true,
      },
      audit: {
        enabled: true,
        logRetention: 90,
        dataRetention: 365,
      },
    };
  }

  /**
   * Load configuration based on environment
   */
  private loadConfiguration(): TestConfig {
    const environment = process.env['NODE_ENV'] || 'development';
    
    const baseConfig: TestConfig = {
      environment: environment as 'development' | 'staging' | 'production' | 'test',
      baseUrl: this.getBaseUrl(environment),
      timeout: this.getTimeout(environment),
      retries: this.getRetries(environment),
      parallel: this.getParallel(environment),
      maxConcurrency: this.getMaxConcurrency(environment),
      reportFormat: 'json',
      coverage: {
        enabled: true,
        threshold: 80,
        exclude: [
          '**/node_modules/**',
          '**/dist/**',
          '**/build/**',
          '**/coverage/**',
          '**/*.test.ts',
          '**/*.spec.ts',
        ],
      },
      security: {
        enabled: true,
        scanVulnerabilities: true,
        penetrationTesting: true,
      },
      performance: {
        enabled: true,
        baselineMetrics: this.getBaselineMetrics(),
        thresholds: this.getPerformanceThresholds(),
      },
    };

    return baseConfig;
  }

  /**
   * Get base URL for testing environment
   */
  private getBaseUrl(environment: string): string {
    switch (environment) {
      case 'production':
        return process.env['PRODUCTION_API_URL'] || 'https://api.yieldsensei.com';
      case 'staging':
        return process.env['STAGING_API_URL'] || 'https://staging-api.yieldsensei.com';
      case 'test':
        return process.env['TEST_API_URL'] || 'http://localhost:3000';
      default:
        return process.env['DEV_API_URL'] || 'http://localhost:3000';
    }
  }

  /**
   * Get timeout configuration for environment
   */
  private getTimeout(environment: string): number {
    switch (environment) {
      case 'production':
        return 30000; // 30 seconds
      case 'staging':
        return 20000; // 20 seconds
      case 'test':
        return 10000; // 10 seconds
      default:
        return 15000; // 15 seconds
    }
  }

  /**
   * Get retry configuration for environment
   */
  private getRetries(environment: string): number {
    switch (environment) {
      case 'production':
        return 3;
      case 'staging':
        return 2;
      case 'test':
        return 1;
      default:
        return 2;
    }
  }

  /**
   * Get parallel execution configuration for environment
   */
  private getParallel(environment: string): boolean {
    switch (environment) {
      case 'production':
        return false; // Sequential for production stability
      case 'staging':
        return true;
      case 'test':
        return true;
      default:
        return true;
    }
  }

  /**
   * Get max concurrency for environment
   */
  private getMaxConcurrency(environment: string): number {
    switch (environment) {
      case 'production':
        return 1; // Sequential for production
      case 'staging':
        return 5;
      case 'test':
        return 10;
      default:
        return 5;
    }
  }

  /**
   * Get baseline performance metrics
   */
  private getBaselineMetrics() {
    return {
      responseTime: {
        min: 50,
        max: 2000,
        avg: 500,
        p95: 1000,
        p99: 2000,
      },
      throughput: {
        requestsPerSecond: 100,
        transactionsPerSecond: 50,
      },
      errorRate: 0.01, // 1%
      cpuUsage: 70,
      memoryUsage: 80,
      networkLatency: 100,
    };
  }

  /**
   * Get performance thresholds
   */
  private getPerformanceThresholds() {
    return {
      responseTime: {
        max: 3000,
        p95: 1500,
        p99: 3000,
      },
      throughput: {
        min: 50,
      },
      errorRate: {
        max: 0.05, // 5%
      },
      resourceUsage: {
        cpu: 80,
        memory: 85,
      },
    };
  }

  /**
   * Get security testing payloads
   */
  private getSecurityPayloads() {
    return [
      // SQL Injection payloads
      {
        type: 'sql-injection' as const,
        payload: "' OR '1'='1",
        description: 'Basic SQL injection test',
        expectedResponse: { blocked: true },
      },
      {
        type: 'sql-injection' as const,
        payload: "'; DROP TABLE users; --",
        description: 'SQL injection with destructive payload',
        expectedResponse: { blocked: true },
      },
      {
        type: 'sql-injection' as const,
        payload: "' UNION SELECT * FROM users --",
        description: 'SQL injection with UNION attack',
        expectedResponse: { blocked: true },
      },

      // XSS payloads
      {
        type: 'xss' as const,
        payload: '<script>alert("XSS")</script>',
        description: 'Basic XSS test',
        expectedResponse: { blocked: true },
      },
      {
        type: 'xss' as const,
        payload: 'javascript:alert("XSS")',
        description: 'XSS with javascript protocol',
        expectedResponse: { blocked: true },
      },
      {
        type: 'xss' as const,
        payload: '<img src="x" onerror="alert(\'XSS\')">',
        description: 'XSS with img onerror',
        expectedResponse: { blocked: true },
      },

      // CSRF payloads
      {
        type: 'csrf' as const,
        payload: 'POST /api/transfer HTTP/1.1\r\nHost: evil.com\r\nContent-Type: application/x-www-form-urlencoded\r\n\r\namount=1000&to=attacker',
        description: 'CSRF attack simulation',
        expectedResponse: { blocked: true },
      },

      // Authentication bypass payloads
      {
        type: 'authentication-bypass' as const,
        payload: 'admin',
        description: 'Authentication bypass attempt',
        expectedResponse: { blocked: true },
      },
      {
        type: 'authentication-bypass' as const,
        payload: 'true',
        description: 'Boolean authentication bypass',
        expectedResponse: { blocked: true },
      },

      // Input validation payloads
      {
        type: 'input-validation' as const,
        payload: '../../../../etc/passwd',
        description: 'Path traversal attack',
        expectedResponse: { blocked: true },
      },
      {
        type: 'input-validation' as const,
        payload: 'A'.repeat(10000),
        description: 'Buffer overflow attempt',
        expectedResponse: { blocked: true },
      },
    ];
  }

  /**
   * Get load test scenarios
   */
  private getLoadTestScenarios() {
    return [
      {
        name: 'Normal Load',
        description: 'Simulate normal user load',
        loadProfile: {
          users: 100,
          rampUp: 60,
          holdTime: 300,
          rampDown: 60,
          thinkTime: 2,
        },
        endpoints: ['/api/v1/portfolios', '/api/v1/market-data', '/api/v1/risk-assessments'],
        data: {
          userId: 'test-user-1',
          portfolioId: 'test-portfolio-1',
        },
      },
      {
        name: 'Peak Load',
        description: 'Simulate peak trading hours',
        loadProfile: {
          users: 500,
          rampUp: 120,
          holdTime: 600,
          rampDown: 120,
          thinkTime: 1,
        },
        endpoints: ['/api/v1/portfolios', '/api/v1/market-data', '/api/v1/transactions'],
        data: {
          userId: 'test-user-2',
          portfolioId: 'test-portfolio-2',
        },
      },
      {
        name: 'API Heavy Load',
        description: 'Simulate heavy API usage',
        loadProfile: {
          users: 200,
          rampUp: 30,
          holdTime: 180,
          rampDown: 30,
          thinkTime: 0.5,
        },
        endpoints: ['/api/v1/analytics', '/api/v1/reports', '/api/v1/export'],
        data: {
          userId: 'test-user-3',
          portfolioId: 'test-portfolio-3',
        },
      },
    ];
  }

  /**
   * Validate configuration
   */
  public validate(): boolean {
    const config = this.config;
    
    // Validate required fields
    if (!config.baseUrl) {
      throw new Error('Base URL is required in testing configuration');
    }
    
    if (config.timeout <= 0) {
      throw new Error('Timeout must be greater than 0');
    }
    
    if (config.retries < 0) {
      throw new Error('Retries must be non-negative');
    }
    
    if (config.maxConcurrency <= 0) {
      throw new Error('Max concurrency must be greater than 0');
    }
    
    // Validate coverage configuration
    if (config.coverage.enabled && (config.coverage.threshold < 0 || config.coverage.threshold > 100)) {
      throw new Error('Coverage threshold must be between 0 and 100');
    }
    
    // Validate performance thresholds
    const perf = config.performance.thresholds;
    if (perf.responseTime.max <= 0 || perf.responseTime.p95 <= 0 || perf.responseTime.p99 <= 0) {
      throw new Error('Performance response time thresholds must be greater than 0');
    }
    
    if (perf.throughput.min <= 0) {
      throw new Error('Performance throughput threshold must be greater than 0');
    }
    
    if (perf.errorRate.max < 0 || perf.errorRate.max > 1) {
      throw new Error('Performance error rate threshold must be between 0 and 1');
    }
    
    return true;
  }

  /**
   * Get environment-specific configuration
   */
  public getEnvironmentConfig(environment: string): TestConfig {
    const originalEnv = process.env['NODE_ENV'];
    process.env['NODE_ENV'] = environment;
    
    const config = new TestingConfig();
    process.env['NODE_ENV'] = originalEnv;
    
    return config.getConfig();
  }

  /**
   * Update configuration dynamically
   */
  public updateConfig(updates: Partial<TestConfig>): void {
    this.config = { ...this.config, ...updates };
    this.validate();
  }
}

// Export singleton instance
export const testingConfig = TestingConfig.getInstance(); 