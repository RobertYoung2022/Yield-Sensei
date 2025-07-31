/**
 * Security and Compliance Types
 * Type definitions for security and compliance framework
 */

export interface SecureCredential {
  id: string;
  serviceId: string;
  keyType: 'api_key' | 'oauth_token' | 'certificate' | 'secret';
  encryptedValue: string;
  iv: string;
  salt: string;
  metadata: {
    provider: string;
    scope?: string[];
    expiresAt?: Date;
    lastRotated?: Date;
    rotationInterval?: number; // in days
  };
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
}

export interface AccessControlPolicy {
  id: string;
  name: string;
  description?: string;
  rules: AccessRule[];
  subjects: string[]; // user IDs, service IDs, or role names
  resources: string[]; // service endpoints or resource patterns
  effect: 'allow' | 'deny';
  conditions?: AccessCondition[];
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
}

export interface AccessRule {
  action: string; // 'read', 'write', 'execute', 'admin'
  resource: string; // resource path or pattern
  conditions?: AccessCondition[];
}

export interface AccessCondition {
  type: 'time_range' | 'ip_whitelist' | 'rate_limit' | 'geo_location' | 'custom';
  value: any;
  operator?: 'equals' | 'not_equals' | 'in' | 'not_in' | 'greater_than' | 'less_than';
}

export interface SecurityAuditLog {
  id: string;
  timestamp: Date;
  eventType: 'credential_access' | 'policy_violation' | 'rate_limit_exceeded' | 'anomaly_detected' | 'security_incident';
  severity: 'low' | 'medium' | 'high' | 'critical';
  serviceId?: string;
  userId?: string;
  sessionId?: string;
  details: {
    action: string;
    resource: string;
    result: 'success' | 'failure' | 'blocked';
    metadata?: Record<string, any>;
  };
  ipAddress?: string;
  userAgent?: string;
  correlationId?: string;
}

export interface ComplianceRule {
  id: string;
  name: string;
  type: 'data_retention' | 'api_terms' | 'privacy_regulation' | 'security_standard';
  description: string;
  regulation: 'GDPR' | 'CCPA' | 'SOX' | 'PCI_DSS' | 'HIPAA' | 'SOC2' | 'CUSTOM';
  requirements: ComplianceRequirement[];
  applicableServices: string[];
  severity: 'mandatory' | 'recommended' | 'optional';
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
}

export interface ComplianceRequirement {
  id: string;
  description: string;
  validationScript?: string;
  remediation?: string;
  lastChecked?: Date;
  status: 'compliant' | 'non_compliant' | 'unknown' | 'not_applicable';
  evidence?: string[];
}

export interface SecurityIncident {
  id: string;
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  type: 'credential_breach' | 'unauthorized_access' | 'data_leak' | 'policy_violation' | 'anomaly' | 'other';
  status: 'open' | 'investigating' | 'resolved' | 'closed';
  affectedServices: string[];
  detectedAt: Date;
  resolvedAt?: Date;
  assignedTo?: string;
  evidence: SecurityEvidence[];
  remediationSteps: RemediationStep[];
  rootCause?: string;
  preventionMeasures?: string[];
}

export interface SecurityEvidence {
  type: 'log' | 'screenshot' | 'network_trace' | 'file' | 'other';
  description: string;
  data: string | Buffer;
  timestamp: Date;
  hash: string;
}

export interface RemediationStep {
  id: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed';
  assignedTo?: string;
  completedAt?: Date;
  notes?: string;
}

export interface SecurityMetrics {
  totalCredentials: number;
  expiredCredentials: number;
  rotationsDue: number;
  policyViolations: number;
  securityIncidents: number;
  complianceScore: number;
  lastAuditDate?: Date;
  criticalVulnerabilities: number;
  riskScore: number;
}

export interface AnomalyDetectionConfig {
  enabled: boolean;
  thresholds: {
    requestVolume: number;
    errorRate: number;
    responseTime: number;
    unusualPatterns: number;
  };
  alerting: {
    enabled: boolean;
    channels: string[];
    severity: 'low' | 'medium' | 'high' | 'critical';
  };
  baselineWindow: number; // in hours
  sensitivityLevel: 'low' | 'medium' | 'high';
}

export interface DataPrivacyConfig {
  enableDataMinimization: boolean;
  retentionPolicies: DataRetentionPolicy[];
  encryptionRequired: boolean;
  pseudonymizationRules: PseudonymizationRule[];
  consentManagement: {
    enabled: boolean;
    defaultConsent: boolean;
    consentExpiry: number; // in days
  };
}

export interface DataRetentionPolicy {
  id: string;
  name: string;
  dataType: string;
  retentionPeriod: number; // in days
  deletionMethod: 'soft_delete' | 'hard_delete' | 'anonymize';
  exceptions?: string[];
  lastApplied?: Date;
}

export interface PseudonymizationRule {
  field: string;
  method: 'hash' | 'encrypt' | 'tokenize' | 'mask';
  preserveFormat: boolean;
  key?: string;
}

export interface CredentialRotationJob {
  id: string;
  credentialId: string;
  scheduledAt: Date;
  status: 'pending' | 'running' | 'completed' | 'failed';
  attempts: number;
  lastAttempt?: Date;
  error?: string;
  newCredentialId?: string;
}

export interface SecurityConfiguration {
  encryption: EncryptionConfig;
  accessControl: AccessControlConfig;
  auditing: AuditingConfig;
  compliance: ComplianceConfig;
  incidentResponse: IncidentResponseConfig;
  anomalyDetection: AnomalyDetectionConfig;
  dataPrivacy: DataPrivacyConfig;
}

export interface EncryptionConfig {
  algorithm: 'AES-256-GCM' | 'AES-256-CBC' | 'ChaCha20-Poly1305';
  keyDerivation: 'PBKDF2' | 'Argon2' | 'scrypt';
  iterations: number;
  saltLength: number;
  keyRotationInterval: number; // in days
}

export interface AccessControlConfig {
  defaultDeny: boolean;
  sessionTimeout: number; // in minutes
  maxConcurrentSessions: number;
  mfaRequired: boolean;
  ipWhitelistEnabled: boolean;
  geoFencingEnabled: boolean;
}

export interface AuditingConfig {
  enabled: boolean;
  logLevel: 'minimal' | 'standard' | 'detailed' | 'verbose';
  retentionPeriod: number; // in days
  realTimeAlerting: boolean;
  exportFormats: string[];
  compressionEnabled: boolean;
}

export interface ComplianceConfig {
  enabledRegulations: string[];
  automaticScanning: boolean;
  scanInterval: number; // in hours
  reportingEnabled: boolean;
  reportingInterval: number; // in days
  exemptServices: string[];
}

export interface IncidentResponseConfig {
  autoDetection: boolean;
  notificationChannels: string[];
  escalationRules: EscalationRule[];
  responsePlaybooks: ResponsePlaybook[];
  containmentActions: ContainmentAction[];
}

export interface EscalationRule {
  severity: 'low' | 'medium' | 'high' | 'critical';
  timeThreshold: number; // in minutes
  escalateTo: string[];
  actions: string[];
}

export interface ResponsePlaybook {
  id: string;
  name: string;
  incidentType: string;
  steps: PlaybookStep[];
  automationLevel: 'manual' | 'semi_automatic' | 'automatic';
}

export interface PlaybookStep {
  id: string;
  name: string;
  description: string;
  type: 'manual' | 'automated';
  script?: string;
  timeout?: number;
  dependencies?: string[];
}

export interface ContainmentAction {
  name: string;
  type: 'service_isolation' | 'credential_revocation' | 'rate_limiting' | 'ip_blocking';
  automated: boolean;
  parameters: Record<string, any>;
}

export interface SecurityEvent {
  type: 'credential_accessed' | 'policy_evaluated' | 'anomaly_detected' | 'incident_created' | 'compliance_violation';
  timestamp: Date;
  data: any;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export type SecurityEventHandler = (event: SecurityEvent) => void | Promise<void>;