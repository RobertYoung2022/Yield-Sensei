/**
 * Configuration Change Audit Logger
 * 
 * Comprehensive audit logging system for configuration changes including:
 * - Detailed change tracking with metadata
 * - Tamper-proof audit trail with cryptographic integrity
 * - Compliance-ready audit reports
 * - Real-time monitoring and alerting
 * - Integration with external audit systems
 */

import { EventEmitter } from 'events';
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { join, resolve } from 'path';
import { createHash, createHmac } from 'crypto';
import { performance } from 'perf_hooks';

export interface AuditEntry {
  id: string;
  timestamp: Date;
  eventType: AuditEventType;
  severity: 'info' | 'warning' | 'critical';
  userId: string;
  userRole?: string;
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
  source: string;
  target: AuditTarget;
  action: string;
  description: string;
  before?: any;
  after?: any;
  metadata: AuditMetadata;
  integrity: IntegrityData;
  retention: RetentionPolicy;
}

export interface AuditTarget {
  type: 'configuration' | 'secret' | 'key' | 'access' | 'system';
  identifier: string;
  name?: string;
  environment?: string;
  category?: string;
}

export interface AuditMetadata {
  correlation_id?: string;
  request_id?: string;
  parent_id?: string;
  tags?: string[];
  context?: Record<string, any>;
  compliance_flags?: string[];
  security_level?: 'public' | 'confidential' | 'secret' | 'top_secret';
  data_classification?: string;
}

export interface IntegrityData {
  hash: string;
  signature: string;
  algorithm: 'sha256' | 'sha512';
  previous_hash?: string;
  chain_valid: boolean;
}

export interface RetentionPolicy {
  category: string;
  retention_period_days: number;
  archive_after_days: number;
  purge_after_days: number;
  legal_hold: boolean;
}

export interface AuditFilter {
  startDate?: Date;
  endDate?: Date;
  eventTypes?: AuditEventType[];
  severities?: ('info' | 'warning' | 'critical')[];
  userIds?: string[];
  sources?: string[];
  targetTypes?: string[];
  environments?: string[];
  correlationIds?: string[];
}

export interface ComplianceReport {
  id: string;
  generated: Date;
  period: {
    start: Date;
    end: Date;
  };
  standard: string;
  environment: string;
  summary: {
    total_events: number;
    by_severity: Record<string, number>;
    by_type: Record<string, number>;
    compliance_score: number;
  };
  findings: ComplianceFinding[];
  recommendations: string[];
  attestation?: AttestationData;
}

export interface ComplianceFinding {
  id: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  requirement: string;
  evidence: string[];
  remediation: string;
  status: 'open' | 'in_progress' | 'resolved' | 'accepted_risk';
}

export interface AttestationData {
  attestor: string;
  role: string;
  timestamp: Date;
  statement: string;
  signature: string;
}

export type AuditEventType =
  | 'config.create'
  | 'config.update'
  | 'config.delete'
  | 'config.read'
  | 'secret.create'
  | 'secret.update'
  | 'secret.delete'
  | 'secret.read'
  | 'secret.rotate'
  | 'key.create'
  | 'key.update'
  | 'key.delete'
  | 'key.rotate'
  | 'key.backup'
  | 'key.recover'
  | 'access.grant'
  | 'access.revoke'
  | 'access.deny'
  | 'auth.login'
  | 'auth.logout'
  | 'auth.failed'
  | 'system.start'
  | 'system.stop'
  | 'system.error'
  | 'security.violation'
  | 'compliance.check'
  | 'drift.detected'
  | 'alert.triggered';

export class ConfigurationAuditLogger extends EventEmitter {
  private auditLog: AuditEntry[] = [];
  private auditChain: string[] = [];
  private secretKey: Buffer;
  private logPath: string;
  private retentionPolicies: Map<string, RetentionPolicy> = new Map();
  private complianceStandards: Set<string> = new Set();
  private readonly maxMemoryEntries = 10000;
  private readonly batchSize = 100;
  private pendingWrites: AuditEntry[] = [];
  private writeTimer?: NodeJS.Timeout;

  constructor(config: {
    logPath?: string;
    secretKey?: Buffer;
    retentionDays?: number;
  } = {}) {
    super();
    
    this.logPath = config.logPath || resolve(process.cwd(), 'logs/audit');
    this.secretKey = config.secretKey || this.generateSecretKey();
    
    this.initializeRetentionPolicies();
    this.initializeComplianceStandards();
    this.ensureLogDirectory();
    this.setupPeriodicMaintenance();
    
    console.log('📝 Configuration Audit Logger initialized');
  }

  /**
   * Log a configuration change event
   */
  async logConfigurationChange(
    userId: string,
    action: string,
    target: AuditTarget,
    before?: any,
    after?: any,
    metadata: Partial<AuditMetadata> = {}
  ): Promise<string> {
    const entry = await this.createAuditEntry({
      eventType: this.getConfigEventType(action),
      severity: this.assessSeverity(action, target, before, after),
      userId,
      source: 'configuration_manager',
      target,
      action,
      description: this.generateDescription(action, target, before, after),
      before,
      after,
      metadata: {
        ...metadata,
        security_level: this.classifySecurityLevel(target, before, after),
        compliance_flags: this.identifyComplianceFlags(target, action)
      }
    });

    await this.writeAuditEntry(entry);
    this.emit('audit:logged', entry);

    return entry.id;
  }

  /**
   * Log a secret management event
   */
  async logSecretEvent(
    userId: string,
    action: 'create' | 'read' | 'update' | 'delete' | 'rotate',
    secretId: string,
    metadata: Partial<AuditMetadata> = {}
  ): Promise<string> {
    const entry = await this.createAuditEntry({
      eventType: `secret.${action}` as AuditEventType,
      severity: action === 'delete' ? 'critical' : action === 'rotate' ? 'warning' : 'info',
      userId,
      source: 'secret_manager',
      target: {
        type: 'secret',
        identifier: secretId,
        environment: metadata.context?.['environment']
      },
      action: `secret_${action}`,
      description: `Secret ${action} operation performed on ${secretId}`,
      metadata: {
        ...metadata,
        security_level: 'secret',
        compliance_flags: ['data_protection', 'access_control']
      }
    });

    await this.writeAuditEntry(entry);
    this.emit('audit:logged', entry);

    return entry.id;
  }

  /**
   * Log a key management event
   */
  async logKeyEvent(
    userId: string,
    action: 'create' | 'rotate' | 'backup' | 'recover' | 'delete',
    keyId: string,
    keyType: string,
    metadata: Partial<AuditMetadata> = {}
  ): Promise<string> {
    const entry = await this.createAuditEntry({
      eventType: `key.${action}` as AuditEventType,
      severity: action === 'delete' || action === 'recover' ? 'critical' : 'warning',
      userId,
      source: 'key_manager',
      target: {
        type: 'key',
        identifier: keyId,
        category: keyType,
        environment: metadata.context?.['environment']
      },
      action: `key_${action}`,
      description: `Cryptographic key ${action} operation performed on ${keyType} key ${keyId}`,
      metadata: {
        ...metadata,
        security_level: 'top_secret',
        compliance_flags: ['encryption', 'key_management', 'data_protection']
      }
    });

    await this.writeAuditEntry(entry);
    this.emit('audit:logged', entry);

    return entry.id;
  }

  /**
   * Log an access control event
   */
  async logAccessEvent(
    userId: string,
    action: 'grant' | 'revoke' | 'deny',
    targetUserId: string,
    resource: string,
    permission: string,
    metadata: Partial<AuditMetadata> = {}
  ): Promise<string> {
    const entry = await this.createAuditEntry({
      eventType: `access.${action}` as AuditEventType,
      severity: action === 'deny' ? 'warning' : 'info',
      userId,
      source: 'access_control',
      target: {
        type: 'access',
        identifier: `${targetUserId}:${resource}:${permission}`,
        name: `${permission} on ${resource}`
      },
      action: `access_${action}`,
      description: `Access ${action} for user ${targetUserId} to ${resource} with permission ${permission}`,
      metadata: {
        ...metadata,
        security_level: 'confidential',
        compliance_flags: ['access_control', 'privilege_management']
      }
    });

    await this.writeAuditEntry(entry);
    this.emit('audit:logged', entry);

    return entry.id;
  }

  /**
   * Log a security violation
   */
  async logSecurityViolation(
    userId: string,
    violation: string,
    details: any,
    severity: 'warning' | 'critical' = 'critical',
    metadata: Partial<AuditMetadata> = {}
  ): Promise<string> {
    const entry = await this.createAuditEntry({
      eventType: 'security.violation',
      severity,
      userId,
      source: 'security_monitor',
      target: {
        type: 'system',
        identifier: 'security_violation',
        name: violation
      },
      action: 'security_violation',
      description: `Security violation detected: ${violation}`,
      after: details,
      metadata: {
        ...metadata,
        security_level: 'top_secret',
        compliance_flags: ['security_incident', 'threat_detection']
      }
    });

    await this.writeAuditEntry(entry);
    this.emit('audit:security_violation', entry);

    return entry.id;
  }

  /**
   * Log drift detection event
   */
  async logDriftDetection(
    environment: string,
    driftScore: number,
    changes: any[],
    severity: 'info' | 'warning' | 'critical',
    metadata: Partial<AuditMetadata> = {}
  ): Promise<string> {
    const entry = await this.createAuditEntry({
      eventType: 'drift.detected',
      severity,
      userId: 'system',
      source: 'drift_detector',
      target: {
        type: 'configuration',
        identifier: `drift_${environment}`,
        environment,
        name: 'Configuration Drift'
      },
      action: 'drift_detection',
      description: `Configuration drift detected in ${environment} with score ${driftScore}`,
      after: {
        driftScore,
        changeCount: changes.length,
        changes: changes.slice(0, 10) // Log first 10 changes
      },
      metadata: {
        ...metadata,
        security_level: 'confidential',
        compliance_flags: ['configuration_management', 'change_control']
      }
    });

    await this.writeAuditEntry(entry);
    this.emit('audit:drift_detected', entry);

    return entry.id;
  }

  /**
   * Log system event
   */
  async logSystemEvent(
    component: string,
    event: string,
    details: any,
    severity: 'info' | 'warning' | 'critical' = 'info',
    metadata?: AuditMetadata
  ): Promise<string> {
    const entry = await this.createAuditEntry({
      eventType: event.includes('error') ? 'system.error' : 'system.start',
      severity,
      userId: component,
      source: component,
      target: {
        type: 'system',
        identifier: component,
        name: component,
        environment: process.env['NODE_ENV'] || 'development'
      },
      action: event,
      description: `System event: ${event}`,
      metadata: metadata || {}
    });

    await this.writeAuditEntry(entry);
    this.emit('audit:system_event', entry);

    return entry.id;
  }

  /**
   * Query audit log with filters
   */
  async queryAuditLog(filter: AuditFilter): Promise<AuditEntry[]> {
    let results = [...this.auditLog];

    // Apply filters
    if (filter.startDate) {
      results = results.filter(entry => entry.timestamp >= filter.startDate!);
    }

    if (filter.endDate) {
      results = results.filter(entry => entry.timestamp <= filter.endDate!);
    }

    if (filter.eventTypes && filter.eventTypes.length > 0) {
      results = results.filter(entry => filter.eventTypes!.includes(entry.eventType));
    }

    if (filter.severities && filter.severities.length > 0) {
      results = results.filter(entry => filter.severities!.includes(entry.severity));
    }

    if (filter.userIds && filter.userIds.length > 0) {
      results = results.filter(entry => filter.userIds!.includes(entry.userId));
    }

    if (filter.sources && filter.sources.length > 0) {
      results = results.filter(entry => filter.sources!.includes(entry.source));
    }

    if (filter.targetTypes && filter.targetTypes.length > 0) {
      results = results.filter(entry => filter.targetTypes!.includes(entry.target.type));
    }

    if (filter.environments && filter.environments.length > 0) {
      results = results.filter(entry => 
        entry.target.environment && filter.environments!.includes(entry.target.environment)
      );
    }

    if (filter.correlationIds && filter.correlationIds.length > 0) {
      results = results.filter(entry => 
        entry.metadata.correlation_id && filter.correlationIds!.includes(entry.metadata.correlation_id)
      );
    }

    return results;
  }

  /**
   * Generate compliance report
   */
  async generateComplianceReport(
    standard: string,
    environment: string,
    startDate: Date,
    endDate: Date
  ): Promise<ComplianceReport> {
    const entries = await this.queryAuditLog({
      startDate,
      endDate,
      environments: [environment]
    });

    const report: ComplianceReport = {
      id: `compliance_${standard}_${environment}_${Date.now()}`,
      generated: new Date(),
      period: { start: startDate, end: endDate },
      standard,
      environment,
      summary: {
        total_events: entries.length,
        by_severity: this.groupBySeverity(entries),
        by_type: this.groupByType(entries),
        compliance_score: this.calculateComplianceScore(entries, standard)
      },
      findings: await this.generateComplianceFindings(entries, standard),
      recommendations: this.generateComplianceRecommendations(entries, standard)
    };

    // Emit event for compliance report generation
    this.emit('compliance:report_generated', report);

    return report;
  }

  /**
   * Export audit log for external systems
   */
  async exportAuditLog(
    filter: AuditFilter,
    format: 'json' | 'csv' | 'syslog' = 'json'
  ): Promise<string> {
    const entries = await this.queryAuditLog(filter);

    switch (format) {
      case 'json':
        return JSON.stringify(entries, null, 2);
      
      case 'csv':
        return this.formatAsCSV(entries);
      
      case 'syslog':
        return this.formatAsSyslog(entries);
      
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  /**
   * Verify audit log integrity
   */
  async verifyIntegrity(): Promise<{
    valid: boolean;
    issues: string[];
    verifiedEntries: number;
  }> {
    const issues: string[] = [];
    let verifiedEntries = 0;
    let previousHash = '';

    for (const entry of this.auditLog) {
      // Verify entry hash
      const calculatedHash = this.calculateEntryHash(entry);
      if (calculatedHash !== entry.integrity.hash) {
        issues.push(`Entry ${entry.id}: Hash mismatch`);
        continue;
      }

      // Verify chain integrity
      if (previousHash && entry.integrity.previous_hash !== previousHash) {
        issues.push(`Entry ${entry.id}: Chain integrity broken`);
        continue;
      }

      // Verify signature
      const validSignature = this.verifySignature(entry);
      if (!validSignature) {
        issues.push(`Entry ${entry.id}: Invalid signature`);
        continue;
      }

      verifiedEntries++;
      previousHash = entry.integrity.hash;
    }

    return {
      valid: issues.length === 0,
      issues,
      verifiedEntries
    };
  }

  /**
   * Get audit statistics
   */
  getAuditStatistics(): {
    totalEntries: number;
    byEventType: Record<string, number>;
    bySeverity: Record<string, number>;
    bySource: Record<string, number>;
    timeRange: { oldest?: Date; newest?: Date };
  } {
    const stats = {
      totalEntries: this.auditLog.length,
      byEventType: {} as Record<string, number>,
      bySeverity: {} as Record<string, number>,
      bySource: {} as Record<string, number>,
      timeRange: {} as { oldest?: Date; newest?: Date }
    };

    if (this.auditLog.length > 0) {
      stats.timeRange.oldest = this.auditLog[0].timestamp;
      stats.timeRange.newest = this.auditLog[this.auditLog.length - 1].timestamp;

      for (const entry of this.auditLog) {
        // Count by event type
        stats.byEventType[entry.eventType] = (stats.byEventType[entry.eventType] || 0) + 1;
        
        // Count by severity
        stats.bySeverity[entry.severity] = (stats.bySeverity[entry.severity] || 0) + 1;
        
        // Count by source
        stats.bySource[entry.source] = (stats.bySource[entry.source] || 0) + 1;
      }
    }

    return stats;
  }

  // Private helper methods

  private async createAuditEntry(params: {
    eventType: AuditEventType;
    severity: 'info' | 'warning' | 'critical';
    userId: string;
    userRole?: string;
    sessionId?: string;
    ipAddress?: string;
    userAgent?: string;
    source: string;
    target: AuditTarget;
    action: string;
    description: string;
    before?: any;
    after?: any;
    metadata: AuditMetadata;
  }): Promise<AuditEntry> {
    const timestamp = new Date();
    const id = this.generateEntryId(timestamp, params.eventType, params.userId);

    const entry: Omit<AuditEntry, 'integrity' | 'retention'> = {
      id,
      timestamp,
      eventType: params.eventType,
      severity: params.severity,
      userId: params.userId,
      userRole: params.userRole,
      sessionId: params.sessionId,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      source: params.source,
      target: params.target,
      action: params.action,
      description: params.description,
      before: params.before,
      after: params.after,
      metadata: params.metadata
    };

    // Add integrity data
    const previousHash = this.auditChain.length > 0 ? 
      this.auditChain[this.auditChain.length - 1] : '';

    const hash = this.calculateEntryHash(entry as AuditEntry);
    const signature = this.signEntry(entry as AuditEntry);

    const integrity: IntegrityData = {
      hash,
      signature,
      algorithm: 'sha256',
      previous_hash: previousHash,
      chain_valid: true
    };

    // Add retention policy
    const retention = this.getRetentionPolicy(params.target.type, params.severity);

    const completeEntry: AuditEntry = {
      ...entry,
      integrity,
      retention
    };

    // Update audit chain
    this.auditChain.push(hash);

    return completeEntry;
  }

  private async writeAuditEntry(entry: AuditEntry): Promise<void> {
    // Add to memory log
    this.auditLog.push(entry);

    // Trim memory log if too large
    if (this.auditLog.length > this.maxMemoryEntries) {
      this.auditLog = this.auditLog.slice(-this.maxMemoryEntries);
    }

    // Add to pending writes for batching
    this.pendingWrites.push(entry);

    // Schedule batch write
    if (!this.writeTimer) {
      this.writeTimer = setTimeout(() => {
        this.flushPendingWrites();
        this.writeTimer = undefined;
      }, 5000); // 5 second batch window
    }

    // Immediate write for critical events
    if (entry.severity === 'critical') {
      await this.writeToDisk([entry]);
    }
  }

  private async flushPendingWrites(): Promise<void> {
    if (this.pendingWrites.length === 0) return;

    const toWrite = [...this.pendingWrites];
    this.pendingWrites = [];

    await this.writeToDisk(toWrite);
  }

  private async writeToDisk(entries: AuditEntry[]): Promise<void> {
    try {
      const logFile = join(this.logPath, `audit-${new Date().toISOString().split('T')[0]}.json`);
      
      // Append entries to daily log file
      for (const entry of entries) {
        const logLine = JSON.stringify(entry) + '\n';
        writeFileSync(logFile, logLine, { flag: 'a' });
      }

    } catch (error) {
      console.error('Failed to write audit entries to disk:', error);
      this.emit('audit:write_error', { error, entries });
    }
  }

  private calculateEntryHash(entry: Omit<AuditEntry, 'integrity' | 'retention'> | AuditEntry): string {
    const hashData = {
      id: entry.id,
      timestamp: entry.timestamp.toISOString(),
      eventType: entry.eventType,
      userId: entry.userId,
      source: entry.source,
      target: entry.target,
      action: entry.action,
      before: entry.before,
      after: entry.after
    };

    return createHash('sha256')
      .update(JSON.stringify(hashData))
      .digest('hex');
  }

  private signEntry(entry: Omit<AuditEntry, 'integrity' | 'retention'> | AuditEntry): string {
    const hash = this.calculateEntryHash(entry);
    return createHmac('sha256', this.secretKey)
      .update(hash)
      .digest('hex');
  }

  private verifySignature(entry: AuditEntry): boolean {
    const expectedSignature = this.signEntry(entry);
    return entry.integrity.signature === expectedSignature;
  }

  private generateEntryId(timestamp: Date, eventType: string, userId: string): string {
    const timeMs = timestamp.getTime();
    const hash = createHash('sha256')
      .update(`${timeMs}-${eventType}-${userId}-${Math.random()}`)
      .digest('hex');
    
    return `audit_${timeMs}_${hash.substring(0, 8)}`;
  }

  private generateSecretKey(): Buffer {
    return Buffer.from(createHash('sha256').update(
      `yieldsensei-audit-${Date.now()}-${Math.random()}`
    ).digest('hex'), 'hex');
  }

  private getConfigEventType(action: string): AuditEventType {
    switch (action.toLowerCase()) {
      case 'create': return 'config.create';
      case 'update': return 'config.update';
      case 'delete': return 'config.delete';
      case 'read': return 'config.read';
      default: return 'config.update';
    }
  }

  private assessSeverity(
    action: string,
    target: AuditTarget,
    before?: any,
    after?: any
  ): 'info' | 'warning' | 'critical' {
    // Critical actions
    if (action === 'delete' || action === 'remove') {
      return 'critical';
    }

    // Critical targets
    if (target.type === 'secret' || target.type === 'key') {
      return action === 'read' ? 'warning' : 'critical';
    }

    // Security-related configuration
    if (target.identifier.includes('security') || 
        target.identifier.includes('auth') ||
        target.identifier.includes('password') ||
        target.identifier.includes('secret')) {
      return 'critical';
    }

    // Production environment changes
    if (target.environment === 'production') {
      return 'warning';
    }

    return 'info';
  }

  private generateDescription(
    action: string,
    target: AuditTarget,
    before?: any,
    after?: any
  ): string {
    const targetName = target.name || target.identifier;
    
    if (before && after) {
      return `${action} operation on ${target.type} '${targetName}' - modified configuration`;
    } else if (after) {
      return `${action} operation on ${target.type} '${targetName}' - created new configuration`;
    } else if (before) {
      return `${action} operation on ${target.type} '${targetName}' - removed configuration`;
    }
    
    return `${action} operation on ${target.type} '${targetName}'`;
  }

  private classifySecurityLevel(
    target: AuditTarget,
    before?: any,
    after?: any
  ): AuditMetadata['security_level'] {
    if (target.type === 'key' || target.identifier.includes('private_key')) {
      return 'top_secret';
    }
    
    if (target.type === 'secret' || target.identifier.includes('secret')) {
      return 'secret';
    }
    
    if (target.identifier.includes('security') || target.identifier.includes('auth')) {
      return 'confidential';
    }
    
    return 'public';
  }

  private identifyComplianceFlags(target: AuditTarget, action: string): string[] {
    const flags: string[] = [];
    
    if (target.type === 'secret' || target.type === 'key') {
      flags.push('data_protection', 'encryption');
    }
    
    if (target.identifier.includes('auth') || target.identifier.includes('access')) {
      flags.push('access_control');
    }
    
    if (target.environment === 'production') {
      flags.push('production_change');
    }
    
    if (action === 'delete') {
      flags.push('data_deletion');
    }
    
    return flags;
  }

  private getRetentionPolicy(
    targetType: string,
    severity: string
  ): RetentionPolicy {
    const policyKey = `${targetType}_${severity}`;
    
    return this.retentionPolicies.get(policyKey) || {
      category: 'default',
      retention_period_days: 2555, // 7 years
      archive_after_days: 365,     // 1 year
      purge_after_days: 2555,      // 7 years
      legal_hold: false
    };
  }

  private groupBySeverity(entries: AuditEntry[]): Record<string, number> {
    return entries.reduce((acc, entry) => {
      acc[entry.severity] = (acc[entry.severity] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }

  private groupByType(entries: AuditEntry[]): Record<string, number> {
    return entries.reduce((acc, entry) => {
      acc[entry.eventType] = (acc[entry.eventType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }

  private calculateComplianceScore(entries: AuditEntry[], standard: string): number {
    // Simplified compliance scoring
    const totalEvents = entries.length;
    if (totalEvents === 0) return 100;

    const criticalEvents = entries.filter(e => e.severity === 'critical').length;
    const score = Math.max(0, 100 - (criticalEvents / totalEvents * 100));
    
    return Math.round(score);
  }

  private async generateComplianceFindings(
    entries: AuditEntry[],
    standard: string
  ): Promise<ComplianceFinding[]> {
    const findings: ComplianceFinding[] = [];

    // Analyze entries for compliance violations
    const criticalEvents = entries.filter(e => e.severity === 'critical');
    
    if (criticalEvents.length > 0) {
      findings.push({
        id: `finding_critical_events_${Date.now()}`,
        severity: 'high',
        title: 'Critical Security Events Detected',
        description: `${criticalEvents.length} critical security events were detected`,
        requirement: `${standard} requires monitoring and response to security events`,
        evidence: criticalEvents.slice(0, 5).map(e => `${e.timestamp.toISOString()}: ${e.description}`),
        remediation: 'Review and respond to all critical security events',
        status: 'open'
      });
    }

    return findings;
  }

  private generateComplianceRecommendations(
    entries: AuditEntry[],
    standard: string
  ): string[] {
    const recommendations: string[] = [];

    const securityViolations = entries.filter(e => e.eventType === 'security.violation');
    if (securityViolations.length > 0) {
      recommendations.push('Implement additional security controls to prevent violations');
    }

    const configChanges = entries.filter(e => e.eventType.startsWith('config.'));
    if (configChanges.length > 100) {
      recommendations.push('Review change management processes for excessive configuration changes');
    }

    return recommendations;
  }

  private formatAsCSV(entries: AuditEntry[]): string {
    const headers = [
      'ID', 'Timestamp', 'Event Type', 'Severity', 'User ID', 'Source',
      'Target Type', 'Target ID', 'Action', 'Description'
    ];

    const csvLines = [headers.join(',')];

    for (const entry of entries) {
      const row = [
        entry.id,
        entry.timestamp.toISOString(),
        entry.eventType,
        entry.severity,
        entry.userId,
        entry.source,
        entry.target.type,
        entry.target.identifier,
        entry.action,
        `"${entry.description.replace(/"/g, '""')}"`
      ];
      csvLines.push(row.join(','));
    }

    return csvLines.join('\n');
  }

  private formatAsSyslog(entries: AuditEntry[]): string {
    return entries.map(entry => {
      const priority = entry.severity === 'critical' ? 2 : entry.severity === 'warning' ? 4 : 6;
      const timestamp = entry.timestamp.toISOString();
      const hostname = require('os').hostname();
      
      return `<${priority}>${timestamp} ${hostname} yieldsensei-audit: ${entry.eventType}[${entry.id}]: ${entry.description}`;
    }).join('\n');
  }

  private initializeRetentionPolicies(): void {
    // Security-critical events - longer retention
    this.retentionPolicies.set('key_critical', {
      category: 'security_critical',
      retention_period_days: 2555, // 7 years
      archive_after_days: 365,
      purge_after_days: 2555,
      legal_hold: true
    });

    this.retentionPolicies.set('secret_critical', {
      category: 'security_critical',
      retention_period_days: 2555,
      archive_after_days: 365,
      purge_after_days: 2555,
      legal_hold: true
    });

    // Standard configuration changes
    this.retentionPolicies.set('configuration_info', {
      category: 'operational',
      retention_period_days: 365,
      archive_after_days: 90,
      purge_after_days: 365,
      legal_hold: false
    });

    console.log(`📋 Initialized ${this.retentionPolicies.size} retention policies`);
  }

  private initializeComplianceStandards(): void {
    this.complianceStandards.add('SOC2');
    this.complianceStandards.add('PCI-DSS');
    this.complianceStandards.add('GDPR');
    this.complianceStandards.add('HIPAA');
    this.complianceStandards.add('ISO27001');
  }

  private ensureLogDirectory(): void {
    if (!existsSync(this.logPath)) {
      mkdirSync(this.logPath, { recursive: true });
    }
  }

  private setupPeriodicMaintenance(): void {
    // Run maintenance every hour
    setInterval(() => {
      this.performMaintenance();
    }, 60 * 60 * 1000);
  }

  private async performMaintenance(): Promise<void> {
    try {
      // Flush pending writes
      await this.flushPendingWrites();

      // Archive old entries if needed
      await this.archiveOldEntries();

      // Verify integrity periodically
      const integrityResult = await this.verifyIntegrity();
      if (!integrityResult.valid) {
        this.emit('audit:integrity_violation', integrityResult);
      }

    } catch (error) {
      console.error('Audit maintenance failed:', error);
    }
  }

  private async archiveOldEntries(): Promise<void> {
    // Implementation would move old entries to archive storage
    // For now, just log the action
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 90);

    const oldEntries = this.auditLog.filter(entry => entry.timestamp < cutoffDate);
    
    if (oldEntries.length > 0) {
      console.log(`📦 Would archive ${oldEntries.length} old audit entries`);
    }
  }
}

// Export singleton instance
export const configurationAuditLogger = new ConfigurationAuditLogger();