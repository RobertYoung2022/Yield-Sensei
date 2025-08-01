/**
 * Oracle Satellite Types
 * Data integrity and Real-World Asset validation types
 */

export interface OracleData {
  id: string;
  source: string;
  value: number | string | boolean;
  timestamp: Date;
  signature?: string;
  metadata: Record<string, any>;
}

export interface OracleFeed {
  id: string;
  name: string;
  provider: string;
  endpoint: string;
  type: 'price' | 'rwa' | 'event' | 'identity' | 'credit';
  status: 'active' | 'inactive' | 'deprecated';
  reliability: number; // 0-1 score
  accuracy: number; // 0-1 score
  lastUpdate: Date;
  updateFrequency: number; // seconds
  configuration: OracleFeedConfig;
}

export interface OracleFeedConfig {
  timeout: number;
  retries: number;
  validationRules: ValidationRule[];
  aggregationMethod: 'median' | 'mean' | 'weighted' | 'majority';
  minSources: number;
  maxDeviation: number;
  historicalWindow: number;
}

export interface ValidationRule {
  id: string;
  type: 'range' | 'format' | 'frequency' | 'source' | 'consensus';
  parameters: Record<string, any>;
  severity: 'error' | 'warning' | 'info';
  active: boolean;
}

export interface OracleValidationResult {
  isValid: boolean;
  score: number; // 0-1 reliability score
  errors: ValidationError[];
  warnings: ValidationWarning[];
  metadata: {
    sources: number;
    consensus: number;
    deviations: number[];
    timestamp: Date;
  };
}

export interface ValidationError {
  code: string;
  message: string;
  severity: 'critical' | 'major' | 'minor';
  source?: string;
  timestamp: Date;
}

export interface ValidationWarning {
  code: string;
  message: string;
  source?: string;
  timestamp: Date;
}

// Real-World Asset (RWA) Types
export interface RWAProtocol {
  id: string;
  name: string;
  description: string;
  assetType: RWAAssetType;
  assetIssuer: string;
  totalValueLocked: number;
  tokenSupply: number;
  assetClaims: AssetClaim[];
  team: ProtocolTeam;
  financials: ProtocolFinancials;
  regulatory: RegulatoryInfo;
  auditReports: AuditReport[];
  riskFactors: RiskFactor[];
  createdAt: Date;
  updatedAt: Date;
}

export type RWAAssetType = 
  | 'real_estate' 
  | 'treasury_bills' 
  | 'corporate_bonds' 
  | 'commodities' 
  | 'art_collectibles' 
  | 'carbon_credits' 
  | 'infrastructure' 
  | 'private_equity' 
  | 'debt_instruments';

export interface AssetClaim {
  id: string;
  description: string;
  value: number;
  currency: string;
  verificationSource: string;
  verificationDate: Date;
  confidence: number; // 0-1 score
  supportingDocuments: Document[];
}

export interface Document {
  id: string;
  type: 'audit' | 'legal' | 'financial' | 'regulatory' | 'appraisal';
  title: string;
  url?: string;
  hash: string;
  issuer: string;
  issueDate: Date;
  verified: boolean;
}

export interface ProtocolTeam {
  members: TeamMember[];
  advisors: TeamMember[];
  organization: string;
  headquarters: string;
  incorporationDate?: Date;
  registrationNumber?: string;
}

export interface TeamMember {
  name: string;
  role: string;
  background: string;
  linkedIn?: string;
  verified: boolean;
  reputation: number; // 0-1 score
}

export interface ProtocolFinancials {
  revenue: RevenueStream[];
  expenses: ExpenseCategory[];
  assets: AssetCategory[];
  liabilities: LiabilityCategory[];
  auditedStatements: AuditedStatement[];
  cashFlow: CashFlowStatement[];
}

export interface RevenueStream {
  source: string;
  amount: number;
  currency: string;
  frequency: 'monthly' | 'quarterly' | 'annually';
  verified: boolean;
}

export interface ExpenseCategory {
  category: string;
  amount: number;
  currency: string;
  frequency: 'monthly' | 'quarterly' | 'annually';
}

export interface AssetCategory {
  category: string;
  value: number;
  currency: string;
  liquidity: 'high' | 'medium' | 'low';
  valuation: ValuationInfo;
}

export interface LiabilityCategory {
  category: string;
  amount: number;
  currency: string;
  maturity?: Date;
  interestRate?: number;
}

export interface ValuationInfo {
  method: 'market' | 'appraisal' | 'model' | 'cost';
  date: Date;
  valuator: string;
  confidence: number; // 0-1 score
}

export interface AuditedStatement {
  period: string;
  auditor: string;
  opinion: 'unqualified' | 'qualified' | 'adverse' | 'disclaimer';
  reportDate: Date;
  reportUrl?: string;
}

export interface CashFlowStatement {
  period: string;
  operating: number;
  investing: number;
  financing: number;
  netChange: number;
  currency: string;
}

export interface RegulatoryInfo {
  jurisdiction: string[];
  licenses: License[];
  compliance: ComplianceRecord[];
  filings: RegulatoryFiling[];
  restrictions: string[];
}

export interface License {
  type: string;
  number: string;
  issuer: string;
  issueDate: Date;
  expiryDate?: Date;
  status: 'active' | 'pending' | 'expired' | 'revoked';
}

export interface ComplianceRecord {
  framework: string; // e.g., 'SEC', 'CFTC', 'EU_MiFID'
  status: 'compliant' | 'non_compliant' | 'pending' | 'unknown';
  lastCheck: Date;
  findings: string[];
}

export interface RegulatoryFiling {
  type: string;
  number: string;
  date: Date;
  status: 'filed' | 'pending' | 'rejected';
  url?: string;
}

export interface AuditReport {
  id: string;
  auditor: string;
  type: 'financial' | 'technical' | 'security' | 'compliance';
  date: Date;
  findings: AuditFinding[];
  overall: 'pass' | 'conditional' | 'fail';
  reportUrl?: string;
}

export interface AuditFinding {
  severity: 'critical' | 'high' | 'medium' | 'low' | 'informational';
  category: string;
  description: string;
  recommendation: string;
  status: 'open' | 'resolved' | 'deferred';
}

export interface RiskFactor {
  category: string;
  description: string;
  probability: number; // 0-1 score
  impact: number; // 0-1 score
  mitigation: string;
  lastAssessed: Date;
}

// Validation Results
export interface RWAValidationResult {
  protocol: string;
  legitimacyScore: number; // 0-1 score
  assetVerification: AssetVerificationResult;
  teamVerification: TeamVerificationResult;
  regulatoryCheck: RegulatoryCheckResult;
  financialValidation: FinancialValidationResult;
  timestamp: Date;
  recommendations: string[];
  riskAssessment: RiskAssessment;
}

export interface AssetVerificationResult {
  verified: boolean;
  confidence: number; // 0-1 score
  backing: AssetBackingVerification;
  valuation: ValuationVerification;
  custody: CustodyVerification;
  discrepancies: string[];
}

export interface AssetBackingVerification {
  claimed: number;
  verified: number;
  percentage: number;
  sources: VerificationSource[];
}

export interface ValuationVerification {
  marketValue: number;
  bookValue: number;
  discrepancy: number;
  methodology: string;
  confidence: number;
}

export interface CustodyVerification {
  custodian: string;
  verified: boolean;
  attestation: boolean;
  insurance: boolean;
  auditTrail: boolean;
}

export interface VerificationSource {
  name: string;
  type: 'official' | 'third_party' | 'market' | 'internal';
  reliability: number;
  lastUpdate: Date;
}

export interface TeamVerificationResult {
  verified: boolean;
  score: number; // 0-1 score
  members: MemberVerification[];
  organization: OrganizationVerification;
  reputation: ReputationAnalysis;
}

export interface MemberVerification {
  name: string;
  role: string;
  verified: boolean;
  background: BackgroundCheck;
  socialPresence: SocialPresenceCheck;
  credibility: number; // 0-1 score
}

export interface BackgroundCheck {
  education: boolean;
  experience: boolean;
  previousRoles: string[];
  redFlags: string[];
  verified: boolean;
}

export interface SocialPresenceCheck {
  linkedin: boolean;
  twitter: boolean;
  github: boolean;
  publications: number;
  activity: 'high' | 'medium' | 'low';
}

export interface OrganizationVerification {
  incorporated: boolean;
  registrationVerified: boolean;
  address: boolean;
  businessLicenses: boolean;
  taxRecords: boolean;
  score: number; // 0-1 score
}

export interface ReputationAnalysis {
  industryReputation: number;
  trackRecord: string[];
  previousProjects: ProjectHistory[];
  publicSentiment: SentimentAnalysis;
  overallScore: number; // 0-1 score
}

export interface ProjectHistory {
  name: string;
  role: string;
  outcome: 'successful' | 'failed' | 'mixed' | 'ongoing';
  description: string;
  impact: number; // 0-1 score
}

export interface SentimentAnalysis {
  positive: number;
  negative: number;
  neutral: number;
  sources: string[];
  confidence: number;
}

export interface RegulatoryCheckResult {
  compliant: boolean;
  score: number; // 0-1 score
  licenses: LicenseValidation[];
  filings: FilingValidation[];
  violations: RegulatoryViolation[];
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

export interface LicenseValidation {
  license: string;
  required: boolean;
  held: boolean;
  valid: boolean;
  jurisdiction: string;
}

export interface FilingValidation {
  type: string;
  required: boolean;
  filed: boolean;
  current: boolean;
  compliant: boolean;
}

export interface RegulatoryViolation {
  type: string;
  description: string;
  severity: 'minor' | 'major' | 'critical';
  date: Date;
  resolved: boolean;
  fine?: number;
}

export interface FinancialValidationResult {
  verified: boolean;
  score: number; // 0-1 score
  auditOpinion: string;
  financialHealth: FinancialHealthMetrics;
  transparency: TransparencyScore;
  sustainability: SustainabilityMetrics;
}

export interface FinancialHealthMetrics {
  liquidityRatio: number;
  debtToEquity: number;
  profitability: number;
  cashFlow: number;
  revenueGrowth: number;
  overallHealth: 'excellent' | 'good' | 'fair' | 'poor' | 'critical';
}

export interface TransparencyScore {
  auditedStatements: boolean;
  publicDisclosures: boolean;
  regularReporting: boolean;
  thirdPartyVerification: boolean;
  score: number; // 0-1 score
}

export interface SustainabilityMetrics {
  revenueStability: number;
  businessModel: 'sustainable' | 'questionable' | 'unsustainable';
  marketPosition: number;
  competitiveAdvantage: string[];
  threats: string[];
  overallSustainability: number; // 0-1 score
}

export interface RiskAssessment {
  overallRisk: 'low' | 'medium' | 'high' | 'critical';
  categories: RiskCategory[];
  mitigationStrategies: string[];
  monitoringRecommendations: string[];
}

export interface RiskCategory {
  name: string;
  level: 'low' | 'medium' | 'high' | 'critical';
  factors: string[];
  impact: number; // 0-1 score
  probability: number; // 0-1 score
}

// Data Source Management
export interface DataSource {
  id: string;
  name: string;
  provider: string;
  type: DataSourceType;
  endpoint: string;
  authentication: AuthenticationMethod;
  reliability: number; // 0-1 score
  latency: number; // milliseconds
  uptime: number; // 0-1 score
  costPerRequest: number;
  status: 'active' | 'inactive' | 'maintenance' | 'deprecated';
  configuration: DataSourceConfig;
}

export type DataSourceType = 
  | 'oracle' 
  | 'api' 
  | 'database' 
  | 'blockchain' 
  | 'perplexity' 
  | 'regulatory' 
  | 'financial' 
  | 'social' 
  | 'news';

export interface AuthenticationMethod {
  type: 'api_key' | 'oauth' | 'jwt' | 'certificate' | 'none';
  credentials: Record<string, string>;
  refreshToken?: string;
  expiresAt?: Date;
}

export interface DataSourceConfig {
  rateLimit: number; // requests per minute
  timeout: number; // milliseconds
  retries: number;
  caching: CachingConfig;
  validation: ValidationConfig;
  monitoring: MonitoringConfig;
}

export interface CachingConfig {
  enabled: boolean;
  ttl: number; // seconds
  strategy: 'lru' | 'fifo' | 'ttl' | 'none';
  maxSize: number; // bytes
}

export interface ValidationConfig {
  enabled: boolean;
  rules: ValidationRule[];
  onFailure: 'reject' | 'warn' | 'accept';
}

export interface MonitoringConfig {
  enabled: boolean;
  metrics: string[];
  alertThresholds: Record<string, number>;
  notificationEndpoints: string[];
}

// Perplexity Integration Types
export interface PerplexityQuery {
  id: string;
  query: string;
  context: string;
  model: string;
  temperature: number;
  maxTokens: number;
  timestamp: Date;
}

export interface PerplexityResponse {
  id: string;
  content: string;
  sources: PerplexitySource[];
  confidence: number;
  processingTime: number;
  usage: TokenUsage;
  timestamp: Date;
}

export interface PerplexitySource {
  title: string;
  url: string;
  domain: string;
  relevance: number; // 0-1 score
  reliability: number; // 0-1 score
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cost: number;
}

// Anomaly Detection Types
export interface AnomalyDetectionConfig {
  enabled: boolean;
  algorithm: 'isolation_forest' | 'one_class_svm' | 'local_outlier' | 'statistical';
  sensitivity: number; // 0-1 score
  window: number; // data points
  threshold: number; // standard deviations
  features: string[];
}

export interface AnomalyResult {
  isAnomaly: boolean;
  score: number; // anomaly score
  features: AnomalyFeature[];
  timestamp: Date;
  explanation: string;
}

export interface AnomalyFeature {
  name: string;
  value: number;
  expected: number;
  deviation: number;
  contribution: number; // to anomaly score
}

// Event Types
export interface OracleEvent {
  type: 'validation_failed' | 'anomaly_detected' | 'source_offline' | 'data_updated' | 'threshold_breach';
  source: string;
  data: any;
  severity: 'info' | 'warning' | 'error' | 'critical';
  timestamp: Date;
  metadata: Record<string, any>;
}

export interface RWAEvent {
  type: 'validation_completed' | 'risk_level_changed' | 'compliance_issue' | 'audit_updated' | 'team_changed';
  protocol: string;
  data: any;
  severity: 'info' | 'warning' | 'error' | 'critical';
  timestamp: Date;
  impact: string[];
}

// Configuration Types
export interface OracleSatelliteConfig {
  oracle: {
    enableValidation: boolean;
    validationInterval: number;
    accuracyThreshold: number;
    consensusThreshold: number;
    maxDeviationPercent: number;
    historicalWindowDays: number;
    anomalyDetection: AnomalyDetectionConfig;
    enableCrossValidation?: boolean;
    enableHistoricalValidation?: boolean;  
    minConsensusSize?: number;
    validationTimeout?: number;
    enableCaching?: boolean;
    cacheTtl?: number;
  };
  rwa: {
    enableValidation: boolean;
    validationDepth: 'basic' | 'standard' | 'comprehensive';
    autoUpdate: boolean;
    updateInterval: number;
    riskThresholds: {
      low: number;
      medium: number;
      high: number;
    };
    requiredDocuments: string[];
    enablePerplexityResearch?: boolean;
    enableSECFilingAnalysis?: boolean;
    enableTeamVerification?: boolean;
    enableFinancialAnalysis?: boolean;
    legitimacyThreshold?: number;
    perplexityApiKey?: string;
    secApiKey?: string;
    maxConcurrentValidations?: number;
    validationTimeout?: number;
  };
  dataSources: {
    maxConcurrent: number;
    defaultTimeout: number;
    retryAttempts: number;
    cachingEnabled: boolean;
    loadBalancing: boolean;
    timeout?: number;
  };
  perplexity: {
    apiKey: string;
    model: string;
    maxQueries: number;
    dailyLimit: number;
    enableCaching: boolean;
    cacheTtl: number;
  };
  monitoring: {
    enableLogging: boolean;
    logLevel: 'debug' | 'info' | 'warn' | 'error';
    enableMetrics: boolean;
    enableAlerts: boolean;
    alertEndpoints: string[];
  };
  offChainVerification?: {
    enabled: boolean;
    timeout: number;
    retries: number;
    providers: string[];
    enableCryptographicProofs?: boolean;
    enableTemporalValidation?: boolean;
    enableSchemaValidation?: boolean;
    enableConsistencyChecks?: boolean;
    maxDataAge?: number;
    minConsistencyThreshold?: number;
    cryptographicAlgorithm?: 'sha256' | 'sha512' | 'blake2b';
    proofValidationTimeout?: number;
    enableAuditTrail?: boolean;
    auditRetentionDays?: number;
  };
}

// Status and Health Types
export interface OracleStatus {
  isInitialized: boolean;
  isRunning: boolean;
  activeFeeds: number;
  validationsPassed: number;
  validationsFailed: number;
  averageAccuracy: number;
  lastValidation: Date;
  errors: string[];
}

export interface RWAStatus {
  isInitialized: boolean;
  isRunning: boolean;
  protocolsTracked: number;
  validationsCompleted: number;
  averageLegitimacy: number;
  lastValidation: Date;
  criticalIssues: number;
}

export interface SystemHealth {
  oracle: OracleStatus;
  rwa: RWAStatus;
  dataSources: DataSourceHealth[];
  perplexity: PerplexityHealth;
  overall: 'healthy' | 'degraded' | 'critical' | 'offline';
}

export interface DataSourceHealth {
  id: string;
  name: string;
  status: 'online' | 'offline' | 'degraded';
  latency: number;
  uptime: number;
  errorRate: number;
  lastCheck: Date;
}

export interface PerplexityHealth {
  connected: boolean;
  quotaUsed: number;
  quotaRemaining: number;
  averageLatency: number;
  errorRate: number;
  lastQuery: Date;
}