/**
 * Performance and Security Testing Types
 * Comprehensive testing framework for cross-chain arbitrage systems
 */

export interface TestScenario {
  id: string;
  name: string;
  description: string;
  type: 'performance' | 'security' | 'reliability' | 'integration';
  priority: 'low' | 'medium' | 'high' | 'critical';
  estimatedDuration: number; // milliseconds
  requirements: TestRequirement[];
  parameters: TestParameters;
}

export interface TestRequirement {
  type: 'network' | 'liquidity' | 'latency' | 'memory' | 'cpu';
  description: string;
  minValue?: number;
  maxValue?: number;
  unit?: string;
}

export interface TestParameters {
  transactionVolume?: number;
  duration?: number; // milliseconds
  concurrentUsers?: number;
  targetLatency?: number; // milliseconds
  errorThreshold?: number; // percentage
  memoryLimit?: number; // MB
  cpuLimit?: number; // percentage
  networkConditions?: NetworkCondition[];
}

export interface NetworkCondition {
  chainId: string;
  latency: number; // milliseconds
  bandwidth: number; // Mbps
  packetLoss: number; // percentage
  availability: number; // percentage uptime
}

export interface TestResult {
  scenarioId: string;
  startTime: number;
  endTime: number;
  status: 'passed' | 'failed' | 'error' | 'timeout';
  metrics: TestMetrics;
  issues: TestIssue[];
  summary: string;
  recommendations: string[];
}

export interface TestMetrics {
  performance: PerformanceMetrics;
  security: SecurityMetrics;
  reliability: ReliabilityMetrics;
  resource: ResourceMetrics;
}

export interface PerformanceMetrics {
  averageLatency: number;
  p50Latency: number;
  p95Latency: number;
  p99Latency: number;
  maxLatency: number;
  minLatency: number;
  throughput: number; // transactions per second
  opportunityCaptureTime: number; // milliseconds
  executionTime: number; // milliseconds
  totalProcessingTime: number;
  errorRate: number; // percentage
  successRate: number; // percentage
}

export interface SecurityMetrics {
  vulnerabilitiesFound: VulnerabilityReport[];
  attacksSimulated: number;
  attacksBlocked: number;
  securityScore: number; // 0-100
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  complianceChecks: ComplianceCheck[];
}

export interface ReliabilityMetrics {
  uptime: number; // percentage
  failureRate: number; // percentage
  recoveryTime: number; // milliseconds
  dataIntegrity: number; // percentage
  networkResiliency: number; // percentage
  errorHandlingEffectiveness: number; // percentage
}

export interface ResourceMetrics {
  cpuUsage: ResourceUsage;
  memoryUsage: ResourceUsage;
  networkUsage: ResourceUsage;
  diskUsage: ResourceUsage;
  costMetrics: CostMetrics;
}

export interface ResourceUsage {
  average: number;
  peak: number;
  minimum: number;
  unit: string;
  timeline: TimestampedValue[];
}

export interface TimestampedValue {
  timestamp: number;
  value: number;
}

export interface CostMetrics {
  gasCosts: Record<string, number>; // chainId -> cost in USD
  transactionFees: number; // total USD
  infrastructureCost: number; // USD per hour
  totalCost: number; // USD
  costPerTransaction: number; // USD
  profitMargin: number; // percentage
}

export interface VulnerabilityReport {
  id: string;
  type: SecurityVulnerabilityType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  affectedComponents: string[];
  exploitability: number; // 0-10
  impact: number; // 0-10
  recommendations: string[];
  cveId?: string;
}

export type SecurityVulnerabilityType = 
  | 'reentrancy'
  | 'front_running'
  | 'mev_attack'
  | 'sandwich_attack'
  | 'flash_loan_attack'
  | 'price_manipulation'
  | 'slippage_attack'
  | 'bridge_exploit'
  | 'oracle_manipulation'
  | 'access_control'
  | 'integer_overflow'
  | 'denial_of_service'
  | 'data_exposure'
  | 'injection_attack';

export interface ComplianceCheck {
  standard: string; // e.g., 'OWASP', 'NIST', 'ISO27001'
  requirement: string;
  status: 'compliant' | 'non_compliant' | 'partial' | 'not_applicable';
  details: string;
  evidence?: string[];
}

export interface TestIssue {
  id: string;
  type: 'performance' | 'security' | 'functional' | 'resource';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  context: string;
  timestamp: number;
  stackTrace?: string;
  reproductionSteps?: string[];
  workaround?: string;
}

export interface ArbitrageTestCase {
  id: string;
  description: string;
  sourceChain: string;
  targetChain: string;
  asset: string;
  priceDiscrepancy: number; // percentage
  liquidityConditions: LiquidityCondition[];
  expectedOutcome: ArbitrageOutcome;
  riskFactors: RiskFactor[];
}

export interface LiquidityCondition {
  chainId: string;
  asset: string;
  availableLiquidity: number; // USD
  slippage: number; // percentage
  gasPrice: number; // gwei
}

export interface ArbitrageOutcome {
  expectedProfit: number; // USD
  expectedExecutionTime: number; // milliseconds
  successProbability: number; // 0-1
  riskScore: number; // 0-100
}

export interface RiskFactor {
  type: 'market' | 'technical' | 'liquidity' | 'regulatory';
  description: string;
  impact: number; // 0-10
  probability: number; // 0-1
  mitigation?: string;
}

export interface StressTestConfig {
  name: string;
  description: string;
  duration: number; // milliseconds
  rampUpTime: number; // milliseconds
  steadyStateTime: number; // milliseconds
  rampDownTime: number; // milliseconds
  concurrentUsers: number;
  transactionsPerSecond: number;
  networkConditions: NetworkCondition[];
  resourceLimits: ResourceLimits;
}

export interface ResourceLimits {
  maxCpuUsage: number; // percentage
  maxMemoryUsage: number; // MB
  maxNetworkBandwidth: number; // Mbps
  maxDiskUsage: number; // MB
}

export interface SecurityTestConfig {
  name: string;
  description: string;
  attackVectors: AttackVector[];
  targetComponents: string[];
  duration: number; // milliseconds
  intensity: 'low' | 'medium' | 'high' | 'maximum';
}

export interface AttackVector {
  type: SecurityVulnerabilityType;
  description: string;
  payload?: any;
  targetEndpoints: string[];
  expectedBehavior: 'block' | 'detect' | 'log' | 'fail';
}

export interface BenchmarkConfig {
  name: string;
  description: string;
  scenarios: BenchmarkScenario[];
  baselines: PerformanceBaseline[];
  thresholds: PerformanceThreshold[];
}

export interface BenchmarkScenario {
  name: string;
  description: string;
  warmupIterations: number;
  measurementIterations: number;
  operation: () => Promise<any>;
  validation?: (result: any) => boolean;
}

export interface PerformanceBaseline {
  metric: string;
  baseline: number;
  unit: string;
  tolerance: number; // percentage deviation allowed
}

export interface PerformanceThreshold {
  metric: string;
  operator: '<' | '>' | '<=' | '>=' | '=' | '!=';
  value: number;
  unit: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
}

export interface TestEnvironment {
  name: string;
  description: string;
  networks: NetworkEnvironment[];
  services: ServiceEnvironment[];
  monitoring: MonitoringConfig;
}

export interface NetworkEnvironment {
  chainId: string;
  rpcUrl: string;
  wsUrl?: string;
  blockTime: number;
  gasPrice: number;
  liquidityPools: MockLiquidityPool[];
}

export interface MockLiquidityPool {
  dexName: string;
  pairAddress: string;
  token0: string;
  token1: string;
  reserve0: string;
  reserve1: string;
  fee: number; // percentage
}

export interface ServiceEnvironment {
  name: string;
  type: 'arbitrage_engine' | 'price_feed' | 'bridge_monitor' | 'liquidity_optimizer';
  config: any;
  healthEndpoint?: string;
  metricsEndpoint?: string;
}

export interface MonitoringConfig {
  enabled: boolean;
  interval: number; // milliseconds
  metrics: string[];
  alertThresholds: AlertThreshold[];
}

export interface AlertThreshold {
  metric: string;
  condition: string;
  value: number;
  action: 'log' | 'alert' | 'stop_test';
}

export interface TestReport {
  id: string;
  title: string;
  description: string;
  executionTime: {
    start: number;
    end: number;
    duration: number;
  };
  environment: TestEnvironment;
  scenarios: TestResult[];
  overallMetrics: TestMetrics;
  summary: TestSummary;
  recommendations: TestRecommendation[];
  attachments: TestAttachment[];
}

export interface TestSummary {
  totalScenarios: number;
  passedScenarios: number;
  failedScenarios: number;
  errorScenarios: number;
  overallScore: number; // 0-100
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  readinessLevel: 'production' | 'staging' | 'development' | 'not_ready';
}

export interface TestRecommendation {
  category: 'performance' | 'security' | 'reliability' | 'cost';
  priority: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  expectedImpact: string;
  estimatedEffort: 'low' | 'medium' | 'high';
  timeline: string;
}

export interface TestAttachment {
  name: string;
  type: 'log' | 'chart' | 'screenshot' | 'data' | 'report';
  path: string;
  size: number;
  description?: string;
}

export interface IntegrationTestConfig {
  name: string;
  description: string;
  includePerformance: boolean;
  includeSecurity: boolean;
  includeReliability: boolean;
  performanceTests?: string[];
  securityTests?: string[];
  customScenarios?: TestScenario[];
  environment?: TestEnvironment;
  parallelExecution?: boolean;
  timeoutMinutes?: number;
}