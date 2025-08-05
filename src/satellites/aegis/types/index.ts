/**
 * Aegis Satellite Types
 * Security, Risk Assessment, and Compliance Monitoring Types
 */

// Core Security Types
export interface SecurityIncident {
  id: string;
  type: SecurityIncidentType;
  severity: SecuritySeverity;
  timestamp: Date;
  protocol?: string;
  chain?: string;
  asset?: string;
  details: SecurityIncidentDetails;
  status: IncidentStatus;
  resolution?: SecurityResolution;
  impact: SecurityImpact;
  metadata: {
    detectionMethod: 'automated' | 'manual' | 'external';
    confidence: number; // 0-1
    falsePositiveRisk: number; // 0-1
    tags: string[];
  };
}

export enum SecurityIncidentType {
  SMART_CONTRACT_VULNERABILITY = 'smart_contract_vulnerability',
  UNUSUAL_TRANSACTION_PATTERN = 'unusual_transaction_pattern',
  LIQUIDATION_RISK = 'liquidation_risk',
  PRICE_MANIPULATION = 'price_manipulation',
  FLASH_LOAN_ATTACK = 'flash_loan_attack',
  MEV_EXPLOITATION = 'mev_exploitation',
  GOVERNANCE_ATTACK = 'governance_attack',
  ORACLE_MANIPULATION = 'oracle_manipulation',
  RUG_PULL_RISK = 'rug_pull_risk',
  BRIDGE_EXPLOIT = 'bridge_exploit',
  UNAUTHORIZED_ACCESS = 'unauthorized_access',
  FUND_DRAINAGE = 'fund_drainage',
  SANDWICH_ATTACK = 'sandwich_attack',
  FRONT_RUNNING = 'front_running'
}

export enum SecuritySeverity {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
  INFO = 'info'
}

export enum IncidentStatus {
  DETECTED = 'detected',
  INVESTIGATING = 'investigating',
  CONFIRMED = 'confirmed',
  MITIGATED = 'mitigated',
  RESOLVED = 'resolved',
  FALSE_POSITIVE = 'false_positive'
}

export interface SecurityIncidentDetails {
  description: string;
  affectedContracts: string[];
  transactionHashes: string[];
  blockNumbers: number[];
  estimatedLoss: number;
  vulnerabilityType?: string;
  exploitMethod?: string;
  rootCause?: string;
  timeline: SecurityEvent[];
}

export interface SecurityEvent {
  timestamp: Date;
  type: string;
  description: string;
  transactionHash?: string;
  blockNumber?: number;
  evidence: string[];
}

export interface SecurityResolution {
  action: ResolutionAction;
  implementedAt: Date;
  description: string;
  effectiveness: number; // 0-1
  followUpRequired: boolean;
  preventiveMeasures: string[];
}

export enum ResolutionAction {
  EMERGENCY_PAUSE = 'emergency_pause',
  FUND_RECOVERY = 'fund_recovery',
  CONTRACT_UPGRADE = 'contract_upgrade',
  PARAMETER_ADJUSTMENT = 'parameter_adjustment',
  ACCESS_REVOCATION = 'access_revocation',
  NOTIFICATION_ONLY = 'notification_only',
  NO_ACTION = 'no_action'
}

export interface SecurityImpact {
  financialLoss: number;
  affectedUsers: number;
  reputationalDamage: number; // 0-1
  systemDowntime: number; // minutes
  marketImpact: number; // 0-1
  regulatoryRisk: number; // 0-1
}

// Risk Assessment Types
export interface RiskAssessment {
  id: string;
  target: RiskTarget;
  timestamp: Date;
  overallRisk: RiskLevel;
  riskScore: number; // 0-100
  categories: RiskCategory[];
  factors: RiskFactor[];
  recommendations: RiskRecommendation[];
  confidence: number; // 0-1
  validUntil: Date;
  assessmentMethod: 'automated' | 'manual' | 'hybrid';
}

export interface RiskTarget {
  type: 'protocol' | 'asset' | 'transaction' | 'user' | 'contract';
  identifier: string;
  name?: string;
  chain?: string;
  metadata?: Record<string, any>;
}

export enum RiskLevel {
  VERY_LOW = 'very_low',
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  VERY_HIGH = 'very_high',
  CRITICAL = 'critical'
}

export interface RiskCategory {
  name: string;
  score: number; // 0-100
  weight: number; // 0-1
  factors: string[];
  trend: 'improving' | 'stable' | 'worsening';
  lastAssessed: Date;
}

export interface RiskFactor {
  id: string;
  category: string;
  description: string;
  impact: number; // 0-1
  probability: number; // 0-1
  mitigation: string[];
  controllable: boolean;
  timeframe: 'immediate' | 'short_term' | 'medium_term' | 'long_term';
}

export interface RiskRecommendation {
  priority: 'critical' | 'high' | 'medium' | 'low';
  action: string;
  description: string;
  timeframe: string;
  estimatedCost: number;
  expectedReduction: number; // 0-1
  prerequisites: string[];
}

// Liquidation Monitoring Types
export interface LiquidationRisk {
  positionId: string;
  user: string;
  protocol: string;
  collateral: CollateralInfo[];
  debt: DebtInfo[];
  healthFactor: number;
  liquidationThreshold: number;
  timeToLiquidation: number; // seconds, -1 if safe
  riskLevel: LiquidationRiskLevel;
  estimatedLoss: number;
  recommendations: LiquidationRecommendation[];
  lastUpdated: Date;
}

export interface CollateralInfo {
  asset: string;
  amount: number;
  value: number;
  ltv: number; // loan-to-value ratio
  liquidationPenalty: number;
  isVolatile: boolean;
}

export interface DebtInfo {
  asset: string;
  amount: number;
  value: number;
  interestRate: number;
  isStable: boolean;
}

export enum LiquidationRiskLevel {
  SAFE = 'safe',
  LOW_RISK = 'low_risk',
  MODERATE_RISK = 'moderate_risk',
  HIGH_RISK = 'high_risk',
  CRITICAL = 'critical',
  LIQUIDATABLE = 'liquidatable'
}

export interface LiquidationRecommendation {
  action: 'add_collateral' | 'repay_debt' | 'close_position' | 'monitor';
  urgency: 'immediate' | 'within_hour' | 'within_day' | 'when_convenient';
  description: string;
  estimatedCost: number;
  riskReduction: number;
}

// Monitoring and Alert Types
export interface SecurityAlert {
  id: string;
  type: AlertType;
  severity: SecuritySeverity;
  title: string;
  description: string;
  timestamp: Date;
  source: string;
  targets: string[];
  actionRequired: boolean;
  autoResolvable: boolean;
  escalated: boolean;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
  metadata: AlertMetadata;
}

export enum AlertType {
  SECURITY_INCIDENT = 'security_incident',
  LIQUIDATION_WARNING = 'liquidation_warning',
  UNUSUAL_ACTIVITY = 'unusual_activity',
  SYSTEM_HEALTH = 'system_health',
  COMPLIANCE_VIOLATION = 'compliance_violation',
  PERFORMANCE_DEGRADATION = 'performance_degradation',
  THRESHOLD_BREACH = 'threshold_breach'
}

export interface AlertMetadata {
  correlationId?: string;
  relatedAlerts: string[];
  affectedSystems: string[];
  estimatedImpact: string;
  autoActions: string[];
  escalationRules: EscalationRule[];
}

export interface EscalationRule {
  condition: string;
  action: string;
  delayMinutes: number;
  recipients: string[];
}

// Transaction Monitoring Types
export interface TransactionRisk {
  transactionHash: string;
  sender: string;
  receiver: string;
  value: number;
  gasPrice: number;
  gasLimit: number;
  riskScore: number; // 0-100
  riskFactors: TransactionRiskFactor[];
  status: TransactionStatus;
  timestamp: Date;
  blockNumber: number;
  chain: string;
}

export interface TransactionRiskFactor {
  type: string;
  description: string;
  impact: number; // 0-1
  confidence: number; // 0-1
  evidence: string[];
}

export enum TransactionStatus {
  PENDING_ANALYSIS = 'pending_analysis',
  LOW_RISK = 'low_risk',
  MODERATE_RISK = 'moderate_risk',
  HIGH_RISK = 'high_risk',
  BLOCKED = 'blocked',
  FLAGGED = 'flagged'
}

// Audit and Compliance Types
export interface SecurityAudit {
  id: string;
  target: AuditTarget;
  auditor: string;
  auditType: AuditType;
  scope: string[];
  startDate: Date;
  completionDate?: Date;
  status: AuditStatus;
  findings: AuditFinding[];
  overallScore: number; // 0-100
  recommendations: AuditRecommendation[];
  followUpRequired: boolean;
  nextAuditDue?: Date;
}

export interface AuditTarget {
  type: 'smart_contract' | 'protocol' | 'system' | 'process';
  identifier: string;
  version?: string;
  components: string[];
}

export enum AuditType {
  SECURITY_AUDIT = 'security_audit',
  CODE_REVIEW = 'code_review',
  PENETRATION_TEST = 'penetration_test',
  COMPLIANCE_AUDIT = 'compliance_audit',
  OPERATIONAL_AUDIT = 'operational_audit'
}

export enum AuditStatus {
  SCHEDULED = 'scheduled',
  IN_PROGRESS = 'in_progress',
  REVIEW = 'review',
  COMPLETED = 'completed',
  REMEDIATION = 'remediation',
  CLOSED = 'closed'
}

export interface AuditFinding {
  id: string;
  severity: SecuritySeverity;
  category: string;
  title: string;
  description: string;
  location?: string;
  evidence: string[];
  impact: string;
  likelihood: number; // 0-1
  recommendation: string;
  status: FindingStatus;
  remediation?: Remediation;
}

export enum FindingStatus {
  OPEN = 'open',
  IN_PROGRESS = 'in_progress',
  RESOLVED = 'resolved',
  ACCEPTED_RISK = 'accepted_risk',
  FALSE_POSITIVE = 'false_positive'
}

export interface Remediation {
  action: string;
  implementedBy: string;
  implementedAt: Date;
  verification: string;
  effectiveness: number; // 0-1
}

export interface AuditRecommendation {
  priority: 'critical' | 'high' | 'medium' | 'low';
  category: string;
  recommendation: string;
  rationale: string;
  effort: 'low' | 'medium' | 'high';
  timeline: string;
  dependencies: string[];
}

// System Health and Performance Types
export interface SystemHealth {
  component: string;
  status: HealthStatus;
  score: number; // 0-100
  metrics: HealthMetric[];
  issues: HealthIssue[];
  lastCheck: Date;
  uptime: number; // percentage
  responseTime: number; // milliseconds
  errorRate: number; // percentage
}

export enum HealthStatus {
  HEALTHY = 'healthy',
  WARNING = 'warning',
  DEGRADED = 'degraded',
  CRITICAL = 'critical',
  OFFLINE = 'offline'
}

export interface HealthMetric {
  name: string;
  value: number;
  unit: string;
  threshold: number;
  status: 'normal' | 'warning' | 'critical';
  trend: 'improving' | 'stable' | 'declining';
}

export interface HealthIssue {
  severity: SecuritySeverity;
  description: string;
  impact: string;
  since: Date;
  actionRequired: boolean;
}

// Configuration Types
export interface AegisSatelliteConfig {
  monitoring: MonitoringConfig;
  riskAssessment: RiskAssessmentConfig;
  alerting: AlertingConfig;
  security: SecurityConfig;
  performance: PerformanceConfig;
}

export interface MonitoringConfig {
  enableRealTimeMonitoring: boolean;
  scanInterval: number; // seconds
  maxConcurrentScans: number;
  enableLiquidationMonitoring: boolean;
  enableTransactionMonitoring: boolean;
  thresholds: MonitoringThresholds;
}

export interface MonitoringThresholds {
  liquidationWarning: number; // health factor threshold
  liquidationCritical: number;
  unusualVolumeMultiplier: number;
  priceDeviationThreshold: number;
  gasSpikeTrigger: number;
}

export interface RiskAssessmentConfig {
  assessmentInterval: number; // seconds
  enableAutomatedAssessment: boolean;
  riskModels: string[];
  confidenceThreshold: number;
  updateStrategy: 'immediate' | 'batched' | 'scheduled';
}

export interface AlertingConfig {
  enableAlerts: boolean;
  channels: AlertChannel[];
  escalationRules: EscalationRule[];
  rateLimiting: RateLimitConfig;
  autoAcknowledgment: boolean;
}

export interface AlertChannel {
  type: 'email' | 'sms' | 'webhook' | 'slack' | 'discord';
  endpoint: string;
  enabled: boolean;
  severityFilter: SecuritySeverity[];
  rateLimited: boolean;
}

export interface RateLimitConfig {
  maxAlertsPerMinute: number;
  maxAlertsPerHour: number;
  burstAllowance: number;
  cooldownPeriod: number; // seconds
}

export interface SecurityConfig {
  enableRealTimeScanning: boolean;
  enableAnomalyDetection: boolean;
  enableThreatIntelligence: boolean;
  auditTrail: AuditTrailConfig;
  incidentResponse: IncidentResponseConfig;
}

export interface AuditTrailConfig {
  enabled: boolean;
  retentionDays: number;
  includeMetadata: boolean;
  compressionEnabled: boolean;
  encryptionEnabled: boolean;
}

export interface IncidentResponseConfig {
  autoResponse: boolean;
  escalationDelayMinutes: number;
  notificationChannels: string[];
  playbooks: ResponsePlaybook[];
}

export interface ResponsePlaybook {
  incidentType: SecurityIncidentType;
  severity: SecuritySeverity;
  actions: PlaybookAction[];
  approvalRequired: boolean;
  timeoutMinutes: number;
}

export interface PlaybookAction {
  step: number;
  action: string;
  automated: boolean;
  prerequisites: string[];
  rollbackable: boolean;
}

export interface PerformanceConfig {
  enableMetrics: boolean;
  metricsInterval: number; // seconds
  enableProfiling: boolean;
  performanceThresholds: PerformanceThresholds;
}

export interface PerformanceThresholds {
  maxResponseTime: number; // milliseconds
  maxMemoryUsage: number; // bytes
  maxCpuUsage: number; // percentage
  maxDiskUsage: number; // percentage
}

// Event Types
export interface AegisEvent {
  type: AegisEventType;
  data: any;
  timestamp: Date;
  severity: SecuritySeverity;
  source: string;
  correlationId?: string;
  metadata?: Record<string, any>;
}

export enum AegisEventType {
  // Security Events
  SECURITY_INCIDENT_DETECTED = 'security_incident_detected',
  SECURITY_INCIDENT_RESOLVED = 'security_incident_resolved',
  VULNERABILITY_DISCOVERED = 'vulnerability_discovered',
  THREAT_DETECTED = 'threat_detected',
  
  // Risk Events
  RISK_ASSESSMENT_COMPLETED = 'risk_assessment_completed',
  RISK_LEVEL_CHANGED = 'risk_level_changed',
  LIQUIDATION_WARNING = 'liquidation_warning',
  LIQUIDATION_CRITICAL = 'liquidation_critical',
  
  // System Events
  SYSTEM_HEALTH_DEGRADED = 'system_health_degraded',
  SYSTEM_HEALTH_RECOVERED = 'system_health_recovered',
  PERFORMANCE_THRESHOLD_BREACH = 'performance_threshold_breach',
  
  // Audit Events
  AUDIT_STARTED = 'audit_started',
  AUDIT_COMPLETED = 'audit_completed',
  COMPLIANCE_VIOLATION = 'compliance_violation',
  
  // Alert Events
  ALERT_TRIGGERED = 'alert_triggered',
  ALERT_ESCALATED = 'alert_escalated',
  ALERT_RESOLVED = 'alert_resolved'
}

// Status and Response Types
export interface AegisStatus {
  operational: boolean;
  lastUpdate: Date;
  componentsMonitored: number;
  activeIncidents: number;
  pendingAlerts: number;
  systemHealth: SystemHealth[];
  performance: {
    avgResponseTime: number;
    errorRate: number;
    uptime: number;
  };
  riskAssessments: {
    completed24h: number;
    averageRiskScore: number;
    highRiskTargets: number;
  };
}

export interface SecurityScanResult {
  scanId: string;
  target: RiskTarget;
  scanType: string;
  startTime: Date;
  endTime: Date;
  status: 'completed' | 'failed' | 'timeout';
  findings: SecurityFinding[];
  riskScore: number;
  recommendations: string[];
}

export interface SecurityFinding {
  type: string;
  severity: SecuritySeverity;
  description: string;
  evidence: string[];
  confidence: number;
  falsePositiveRisk: number;
}

// Request/Response Types
export interface SecurityAnalysisRequest {
  target: RiskTarget;
  analysisType: 'full' | 'quick' | 'targeted';
  includeRiskAssessment: boolean;
  includeLiquidationCheck: boolean;
  priority: 'low' | 'normal' | 'high' | 'critical';
}

export interface SecurityAnalysisResponse {
  requestId: string;
  target: RiskTarget;
  analysis: {
    riskAssessment?: RiskAssessment;
    liquidationRisk?: LiquidationRisk;
    securityScore: number;
    findings: SecurityFinding[];
    recommendations: string[];
  };
  metadata: {
    analysisTime: number;
    confidence: number;
    timestamp: Date;
    version: string;
  };
}

export type AegisAnalysisRequest = SecurityAnalysisRequest;
export type AegisAnalysisResponse = SecurityAnalysisResponse;