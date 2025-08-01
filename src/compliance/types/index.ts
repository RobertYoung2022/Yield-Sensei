/**
 * Regulatory Compliance Framework Types
 * Comprehensive type definitions for multi-jurisdictional compliance
 */

// Core Jurisdiction Types
export type Jurisdiction = 
  | 'US' 
  | 'EU' 
  | 'UK' 
  | 'Singapore' 
  | 'Switzerland' 
  | 'Japan' 
  | 'Canada' 
  | 'Australia' 
  | 'Dubai'
  | 'Hong Kong'
  | 'Cayman Islands'
  | 'BVI';

export type ComplianceCategory = 
  | 'kyc-aml'
  | 'securities'
  | 'banking'
  | 'insurance'
  | 'data-privacy'
  | 'consumer-protection'
  | 'market-conduct'
  | 'operational'
  | 'tax-reporting'
  | 'sanctions';

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type ComplianceStatus = 'compliant' | 'partial' | 'non-compliant' | 'pending-review';
export type ActivityLevel = 'retail' | 'professional' | 'institutional' | 'high-net-worth';

// Enhanced User Types for Compliance
export interface User {
  id: string;
  email: string;
  jurisdiction: Jurisdiction;
  residenceCountry: string;
  citizenships: string[];
  activityLevel: ActivityLevel;
  riskProfile: UserRiskProfile;
  kycStatus: KYCStatus;
  createdAt: Date;
  lastActivity: Date;
  
  // Authentication method
  authenticationMethod: 'traditional' | 'decentralized' | 'hybrid';
  
  // Optional decentralized identity (for hybrid users)
  decentralizedIdentity?: {
    did: string;
    walletAddress: string;
    verifiableCredentials: any[];
    proofOfPersonhood?: any;
  };
}

export interface UserRiskProfile {
  overallRisk: RiskLevel;
  amlRisk: RiskLevel;
  sanctionsRisk: RiskLevel;
  politicallyExposed: boolean;
  highRiskCountries: string[];
  riskFactors: string[];
  lastAssessment: Date;
}

// Transaction Types
export interface Transaction {
  id: string;
  userId: string;
  type: TransactionType;
  amount: number;
  currency: string;
  fromAddress?: string;
  toAddress?: string;
  blockchain?: string;
  assetId?: string;
  protocolId?: string;
  timestamp: Date;
  status: TransactionStatus;
  compliance: TransactionCompliance;
}

export type TransactionType = 
  | 'deposit'
  | 'withdrawal' 
  | 'trade'
  | 'yield-deposit'
  | 'yield-withdrawal'
  | 'bridge'
  | 'staking'
  | 'unstaking'
  | 'lending'
  | 'borrowing';

export type TransactionStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'blocked';

export interface TransactionCompliance {
  screeningStatus: 'pending' | 'approved' | 'flagged' | 'blocked';
  riskScore: number;
  flags: ComplianceFlag[];
  sanctions: SanctionsCheck;
  aml: AMLCheck;
  approvedBy?: string;
  reviewedAt?: Date;
}

// KYC/AML Types
export interface KYCStatus {
  level: KYCLevel;
  status: 'pending' | 'approved' | 'rejected' | 'expired' | 'under-review';
  documents: KYCDocument[];
  verificationDate?: Date;
  expiryDate?: Date;
  provider: string;
  nextReviewDate: Date;
}

export type KYCLevel = 'basic' | 'enhanced' | 'institutional' | 'professional';

export interface KYCDocument {
  type: DocumentType;
  status: 'pending' | 'approved' | 'rejected';
  uploadDate: Date;
  verificationDate?: Date;
  expiryDate?: Date;
  provider: string;
  documentId: string;
}

export type DocumentType = 
  | 'passport'
  | 'drivers-license'
  | 'national-id'
  | 'proof-of-address'
  | 'bank-statement'
  | 'utility-bill'
  | 'tax-document'
  | 'corporate-documents'
  | 'beneficial-ownership'
  | 'financial-statements';

// Compliance Rules and Violations
export interface ComplianceRule {
  id: string;
  jurisdiction: Jurisdiction;
  category: ComplianceCategory;
  name: string;
  description: string;
  severity: RiskLevel;
  requirements: string[];
  conditions: RuleCondition[];
  actions: RuleAction[];
  effectiveDate: Date;
  lastUpdated: Date;
  source: string;
  version: string;
}

export interface RuleCondition {
  field: string;
  operator: 'equals' | 'greater_than' | 'less_than' | 'contains' | 'regex' | 'in_list';
  value: any;
  description: string;
}

export interface RuleAction {
  type: 'block' | 'flag' | 'require_review' | 'alert' | 'report' | 'escalate';
  parameters: Record<string, any>;
  description: string;
}

export interface ComplianceViolation {
  id: string;
  ruleId: string;
  entityType: 'user' | 'transaction' | 'protocol';
  entityId: string;
  jurisdiction: Jurisdiction;
  category: ComplianceCategory;
  severity: RiskLevel;
  description: string;
  details: Record<string, any>;
  detectedAt: Date;
  status: ViolationStatus;
  assignedTo?: string;
  resolvedAt?: Date;
  resolution?: string;
  escalated: boolean;
}

export type ViolationStatus = 'open' | 'under-review' | 'resolved' | 'false-positive' | 'escalated';

// Monitoring and Alerting
export interface ComplianceAlert {
  id: string;
  type: AlertType;
  severity: RiskLevel;
  title: string;
  description: string;
  entityType: 'user' | 'transaction' | 'protocol' | 'system';
  entityId: string;
  jurisdiction?: Jurisdiction;
  triggeredAt: Date;
  status: AlertStatus;
  assignedTo?: string;
  resolvedAt?: Date;
  escalationLevel: number;
  metadata: Record<string, any>;
}

export type AlertType = 
  | 'suspicious-activity'
  | 'large-transaction'
  | 'rapid-transactions'
  | 'sanctions-hit'
  | 'kyc-expiry'
  | 'regulatory-change'
  | 'system-failure'
  | 'audit-requirement';

export type AlertStatus = 'open' | 'acknowledged' | 'investigating' | 'resolved' | 'false-positive';

// Screening and Risk Assessment
export interface ComplianceFlag {
  type: FlagType;
  severity: RiskLevel;
  description: string;
  source: string;
  confidence: number;
  timestamp: Date;
  metadata: Record<string, any>;
}

export type FlagType = 
  | 'sanctions'
  | 'pep'
  | 'high-risk-country'
  | 'suspicious-pattern'
  | 'velocity-anomaly'
  | 'amount-threshold'
  | 'blacklist'
  | 'manual-review';

export interface SanctionsCheck {
  status: 'clear' | 'hit' | 'potential-match' | 'error';
  provider: string;
  checkedAt: Date;
  lists: SanctionsList[];
  matches: SanctionsMatch[];
}

export interface SanctionsList {
  name: string;
  jurisdiction: string;
  type: 'individuals' | 'entities' | 'addresses';
  lastUpdated: Date;
}

export interface SanctionsMatch {
  listName: string;
  matchType: 'exact' | 'fuzzy' | 'alias';
  confidence: number;
  details: Record<string, any>;
}

export interface AMLCheck {
  riskScore: number;
  factors: AMLRiskFactor[];
  thresholds: AMLThreshold[];
  recommendation: 'approve' | 'flag' | 'block' | 'manual-review';
  provider: string;
  checkedAt: Date;
}

export interface AMLRiskFactor {
  type: string;
  weight: number;
  value: any;
  contribution: number;
  description: string;
}

export interface AMLThreshold {
  name: string;
  threshold: number;
  current: number;
  breached: boolean;
  action: string;
}

// Regulatory Reporting
export interface RegulatoryReport {
  id: string;
  type: ReportType;
  jurisdiction: Jurisdiction;
  period: ReportingPeriod;
  status: ReportStatus;
  data: Record<string, any>;
  generatedAt: Date;
  submittedAt?: Date;
  dueDate: Date;
  submittedBy?: string;
  confirmationNumber?: string;
}

export type ReportType = 
  | 'suspicious-activity-report'
  | 'large-cash-transaction'
  | 'cross-border-transaction'
  | 'periodic-compliance'
  | 'audit-report'
  | 'breach-notification'
  | 'regulatory-capital'
  | 'liquidity-reporting';

export interface ReportingPeriod {
  start: Date;
  end: Date;
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annually';
}

export type ReportStatus = 'draft' | 'pending-review' | 'approved' | 'submitted' | 'acknowledged' | 'rejected';

// Audit Trail
export interface AuditEntry {
  id: string;
  timestamp: Date;
  userId?: string;
  action: string;
  entityType: string;
  entityId: string;
  before?: Record<string, any>;
  after?: Record<string, any>;
  reason?: string;
  ipAddress?: string;
  userAgent?: string;
  jurisdiction: Jurisdiction;
  compliance: boolean;
}

// Configuration Types
export interface ComplianceConfig {
  jurisdictions: JurisdictionConfig[];
  monitoring: MonitoringConfig;
  kyc: KYCConfig;
  screening: ScreeningConfig;
  reporting: ReportingConfig;
  alerts: AlertConfig;
}

export interface JurisdictionConfig {
  jurisdiction: Jurisdiction;
  enabled: boolean;
  requirements: JurisdictionRequirement[];
  thresholds: JurisdictionThreshold[];
  reporting: JurisdictionReporting[];
}

export interface JurisdictionRequirement {
  category: ComplianceCategory;
  required: boolean;
  level: 'basic' | 'enhanced' | 'institutional';
  description: string;
}

export interface JurisdictionThreshold {
  name: string;
  value: number;
  currency: string;
  timeframe: string;
  action: string;
}

export interface JurisdictionReporting {
  type: ReportType;
  frequency: string;
  threshold?: number;
  required: boolean;
  dueDate: string;
}

export interface MonitoringConfig {
  realTime: boolean;
  intervals: {
    transactionScreening: number;
    userReview: number;
    riskAssessment: number;
    reportGeneration: number;
  };
  thresholds: {
    transactionAmount: Record<string, number>;
    velocityLimits: Record<string, number>;
    riskScores: Record<RiskLevel, number>;
  };
  blockchainAnalytics?: {
    chainalysis?: any;
    trmLabs?: any;
  };
}

export interface KYCConfig {
  providers: KYCProviderConfig[];
  requirements: KYCRequirementConfig[];
  automation: KYCAutomationConfig;
}

export interface KYCProviderConfig {
  name: string;
  enabled: boolean;
  primary: boolean;
  apiKey: string;
  endpoint: string;
  supportedDocuments: DocumentType[];
  supportedCountries: string[];
}

export interface KYCRequirementConfig {
  activityLevel: ActivityLevel;
  requiredLevel: KYCLevel;
  documents: DocumentType[];
  renewalPeriod: number;
  enhancedDueDiligence: boolean;
}

export interface KYCAutomationConfig {
  autoApprove: boolean;
  confidenceThreshold: number;
  manualReviewTriggers: string[];
  escalationRules: string[];
}

export interface ScreeningConfig {
  providers: ScreeningProviderConfig[];
  lists: ScreeningListConfig[];
  matching: MatchingConfig;
}

export interface ScreeningProviderConfig {
  name: string;
  type: 'sanctions' | 'aml' | 'pep';
  enabled: boolean;
  apiKey: string;
  endpoint: string;
  updateFrequency: number;
}

export interface ScreeningListConfig {
  name: string;
  source: string;
  enabled: boolean;
  jurisdiction: Jurisdiction;
  type: 'sanctions' | 'pep' | 'adverse-media';
  lastUpdated: Date;
}

export interface MatchingConfig {
  exactMatch: boolean;
  fuzzyMatch: boolean;
  fuzzyThreshold: number;
  aliasMatch: boolean;
  phoneticMatch: boolean;
}

export interface ReportingConfig {
  automated: boolean;
  schedules: ReportSchedule[];
  storage: ReportStorageConfig;
  distribution: ReportDistributionConfig;
}

export interface ReportSchedule {
  type: ReportType;
  frequency: string;
  timezone: string;
  enabled: boolean;
  recipients: string[];
}

export interface ReportStorageConfig {
  retention: number;
  encryption: boolean;
  backup: boolean;
  archival: boolean;
}

export interface ReportDistributionConfig {
  email: boolean;
  secure: boolean;
  api: boolean;
  regulatoryPortal: boolean;
}

export interface AlertConfig {
  channels: AlertChannelConfig[];
  escalation: EscalationConfig;
  suppression: SuppressionConfig;
}

export interface AlertChannelConfig {
  type: 'email' | 'slack' | 'webhook' | 'sms' | 'dashboard';
  enabled: boolean;
  endpoint?: string;
  credentials?: Record<string, string>;
  filters: AlertFilter[];
}

export interface AlertFilter {
  severity: RiskLevel[];
  categories: ComplianceCategory[];
  jurisdictions: Jurisdiction[];
  entityTypes: string[];
}

export interface EscalationConfig {
  enabled: boolean;
  levels: EscalationLevel[];
  timeout: number;
}

export interface EscalationLevel {
  level: number;
  delay: number;
  recipients: string[];
  channels: string[];
}

export interface SuppressionConfig {
  enabled: boolean;
  rules: SuppressionRule[];
}

export interface SuppressionRule {
  condition: string;
  duration: number;
  reason: string;
}

// API Response Types
export interface ComplianceResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: Date;
  requestId: string;
  compliance: {
    processed: boolean;
    flags: ComplianceFlag[];
    riskScore: number;
  };
}

export interface ComplianceResult {
  compliant: boolean;
  riskScore: number;
  flags: ComplianceFlag[];
  violations: ComplianceViolation[];
  recommendations: string[];
  nextReview?: Date;
  jurisdiction: Jurisdiction;
  timestamp: Date;
}

// Event Types
export interface ComplianceEvent {
  id: string;
  type: ComplianceEventType;
  entityType: string;
  entityId: string;
  jurisdiction: Jurisdiction;
  timestamp: Date;
  data: Record<string, any>;
  processed: boolean;
}

export type ComplianceEventType = 
  | 'user-registered'
  | 'kyc-submitted'
  | 'kyc-approved'
  | 'kyc-rejected'
  | 'transaction-submitted'
  | 'transaction-screened'
  | 'transaction-flagged'
  | 'violation-detected'
  | 'alert-triggered'
  | 'report-generated'
  | 'regulatory-change';