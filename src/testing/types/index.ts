/**
 * Testing Infrastructure Types
 * Comprehensive type definitions for testing suite including unit, integration, security, and performance tests
 */

// Testing Infrastructure Types
export interface TestConfig {
  environment: 'development' | 'staging' | 'production' | 'test';
  baseUrl: string;
  timeout: number;
  retries: number;
  parallel: boolean;
  maxConcurrency: number;
  reportFormat: 'json' | 'html' | 'xml' | 'junit';
  coverage: {
    enabled: boolean;
    threshold: number;
    exclude: string[];
  };
  security: {
    enabled: boolean;
    scanVulnerabilities: boolean;
    penetrationTesting: boolean;
  };
  performance: {
    enabled: boolean;
    baselineMetrics: PerformanceMetrics;
    thresholds: PerformanceThresholds;
  };
}

export interface TestCase {
  id: string;
  name: string;
  description: string;
  category: 'unit' | 'integration' | 'security' | 'performance' | 'compliance' | 'contract';
  priority: 'low' | 'medium' | 'high' | 'critical';
  tags: string[];
  setup?: () => Promise<void>;
  teardown?: () => Promise<void>;
  execute: () => Promise<TestResult>;
  dependencies?: string[];
  timeout?: number;
  retries?: number;
}

export interface TestResult {
  id: string;
  testCaseId: string;
  status: 'passed' | 'failed' | 'skipped' | 'error';
  duration: number;
  startTime: Date;
  endTime: Date;
  error?: Error;
  details?: any;
  metadata?: Record<string, any>;
  assertions: AssertionResult[];
}

export interface AssertionResult {
  name: string;
  status: 'passed' | 'failed';
  expected: any;
  actual: any;
  message?: string;
}

// Unit Testing Types
export interface UnitTestConfig extends TestConfig {
  mocking: {
    enabled: boolean;
    database: boolean;
    externalServices: boolean;
    fileSystem: boolean;
  };
  isolation: {
    enabled: boolean;
    resetState: boolean;
    clearCache: boolean;
  };
}

export interface UnitTestCase extends TestCase {
  category: 'unit';
  module: string;
  function: string;
  mockData?: Record<string, any>;
}

// Integration Testing Types
export interface IntegrationTestConfig extends TestConfig {
  database: {
    setup: 'clean' | 'seed' | 'migrate';
    teardown: 'clean' | 'preserve';
    connectionString: string;
  };
  externalServices: {
    mock: boolean;
    endpoints: Record<string, string>;
  };
  session: {
    enabled: boolean;
    persistence: boolean;
  };
}

export interface IntegrationTestCase extends TestCase {
  category: 'integration';
  flow: string;
  endpoints: string[];
  dataFlow: DataFlowStep[];
  sessionData?: Record<string, any>;
}

export interface DataFlowStep {
  step: number;
  endpoint: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  request: any;
  expectedResponse: any;
  validation?: (response: any) => boolean;
}

// Security Testing Types
export interface SecurityTestConfig extends TestConfig {
  penetrationTesting: {
    enabled: boolean;
    payloads: SecurityPayload[];
    scanDepth: 'basic' | 'comprehensive' | 'exhaustive';
  };
  vulnerabilityScanning: {
    enabled: boolean;
    tools: string[];
    severity: 'low' | 'medium' | 'high' | 'critical';
  };
  compliance: {
    enabled: boolean;
    standards: string[];
  };
}

export interface SecurityTestCase extends TestCase {
  category: 'security';
  vulnerability: string;
  payload: SecurityPayload;
  expectedBehavior: 'blocked' | 'detected' | 'logged';
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface SecurityPayload {
  type: 'sql-injection' | 'xss' | 'csrf' | 'authentication-bypass' | 'input-validation';
  payload: string;
  description: string;
  expectedResponse?: any;
}

export interface SecurityVulnerability {
  id: string;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  location: string;
  evidence: string;
  recommendation: string;
  cveId?: string;
}

// Performance Testing Types
export interface PerformanceTestConfig extends TestConfig {
  loadTesting: {
    enabled: boolean;
    scenarios: LoadTestScenario[];
    metrics: PerformanceMetrics;
  };
  stressTesting: {
    enabled: boolean;
    maxLoad: number;
    rampUp: number;
    holdTime: number;
  };
  spikeTesting: {
    enabled: boolean;
    spikeLoad: number;
    spikeDuration: number;
  };
}

export interface PerformanceTestCase extends TestCase {
  category: 'performance';
  scenario: string;
  load: LoadProfile;
  metrics: PerformanceMetrics;
  thresholds: PerformanceThresholds;
}

export interface LoadProfile {
  users: number;
  rampUp: number;
  holdTime: number;
  rampDown: number;
  thinkTime: number;
}

export interface PerformanceMetrics {
  responseTime: {
    min: number;
    max: number;
    avg: number;
    p95: number;
    p99: number;
  };
  throughput: {
    requestsPerSecond: number;
    transactionsPerSecond: number;
  };
  errorRate: number;
  cpuUsage: number;
  memoryUsage: number;
  networkLatency: number;
}

export interface PerformanceThresholds {
  responseTime: {
    max: number;
    p95: number;
    p99: number;
  };
  throughput: {
    min: number;
  };
  errorRate: {
    max: number;
  };
  resourceUsage: {
    cpu: number;
    memory: number;
  };
}

export interface LoadTestScenario {
  name: string;
  description: string;
  loadProfile: LoadProfile;
  endpoints: string[];
  data: Record<string, any>;
}

// Contract Testing Types
export interface ContractTestConfig extends TestConfig {
  openApi: {
    specPath: string;
    validateResponses: boolean;
    validateSchemas: boolean;
  };
  consumer: {
    name: string;
    version: string;
  };
  provider: {
    name: string;
    version: string;
  };
}

export interface ContractTestCase extends TestCase {
  category: 'contract';
  contract: string;
  endpoint: string;
  method: string;
  requestSchema: any;
  responseSchema: any;
  examples: ContractExample[];
}

export interface ContractExample {
  name: string;
  request: any;
  expectedResponse: any;
  statusCode: number;
}

// Compliance Testing Types
export interface ComplianceTestConfig extends TestConfig {
  standards: {
    gdpr: boolean;
    sox: boolean;
    pci: boolean;
    hipaa: boolean;
    iso27001: boolean;
  };
  audit: {
    enabled: boolean;
    logRetention: number;
    dataRetention: number;
  };
}

export interface ComplianceTestCase extends TestCase {
  category: 'compliance';
  standard: string;
  requirement: string;
  control: string;
  evidence: string;
  status: 'compliant' | 'non-compliant' | 'partial';
}

// Test Suite Types
export interface TestSuite {
  id: string;
  name: string;
  description: string;
  category: 'unit' | 'integration' | 'security' | 'performance' | 'compliance';
  testCases: TestCase[];
  config: TestConfig;
  setup?: () => Promise<void>;
  teardown?: () => Promise<void>;
}

export interface TestRun {
  id: string;
  startTime: Date;
  endTime: Date | null;
  status: 'running' | 'completed' | 'failed' | 'cancelled' | 'error';
  results: TestResult[];
  summary: TestRunSummary;
  metadata?: Record<string, any>;
  error?: Error;
}

export interface TestRunSummary {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  error: number;
  duration: number;
  coverage?: number;
  securityVulnerabilities?: SecurityVulnerability[];
  performanceMetrics?: PerformanceMetrics;
}

export interface TestRecommendation {
  type: 'critical' | 'security' | 'performance' | 'quality';
  title: string;
  description: string;
  action: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
}

// Error Types
export class TestError extends Error {
  constructor(
    message: string,
    public testCaseId: string,
    public category: string,
    public severity: 'low' | 'medium' | 'high' | 'critical' = 'medium'
  ) {
    super(message);
    this.name = 'TestError';
  }
}

export class SecurityTestError extends TestError {
  constructor(
    message: string,
    testCaseId: string,
    public vulnerability: SecurityVulnerability
  ) {
    super(message, testCaseId, 'security', vulnerability.severity);
    this.name = 'SecurityTestError';
  }
}

export class PerformanceTestError extends TestError {
  constructor(
    message: string,
    testCaseId: string,
    public metrics: PerformanceMetrics,
    public thresholds: PerformanceThresholds
  ) {
    super(message, testCaseId, 'performance', 'high');
    this.name = 'PerformanceTestError';
  }
}

// Report Types
export interface TestReport {
  id: string;
  testRunId: string;
  generatedAt: Date;
  summary: TestRunSummary;
  testRun: TestRun;
  results: TestResult[];
  analysis: any;
  recommendations: TestRecommendation[];
  metadata?: Record<string, any>;
}

export interface TestSuiteReport {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  error: number;
  duration: number;
  testCases: TestCaseReport[];
}

export interface TestCaseReport {
  id: string;
  name: string;
  status: 'passed' | 'failed' | 'skipped' | 'error';
  duration: number;
  error?: string;
  details?: any;
}

export interface SecurityTestReport extends TestSuiteReport {
  vulnerabilities: SecurityVulnerability[];
  riskScore: number;
  recommendations: string[];
}

export interface PerformanceTestReport extends TestSuiteReport {
  metrics: PerformanceMetrics;
  thresholds: PerformanceThresholds;
  bottlenecks: string[];
  recommendations: string[];
}

export interface ComplianceTestReport extends TestSuiteReport {
  standards: Record<string, ComplianceStandardReport>;
  overallCompliance: number;
  gaps: string[];
  recommendations: string[];
}

export interface ComplianceStandardReport {
  standard: string;
  compliance: number;
  requirements: ComplianceRequirementReport[];
}

export interface ComplianceRequirementReport {
  requirement: string;
  status: 'compliant' | 'non-compliant' | 'partial';
  evidence: string;
  recommendation?: string;
} 