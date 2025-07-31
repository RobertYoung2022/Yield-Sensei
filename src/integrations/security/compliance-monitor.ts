/**
 * Compliance Monitor
 * Monitors and ensures compliance with API terms, regulatory requirements, and data privacy laws
 */

import { EventEmitter } from 'events';
import Logger from '../../shared/logging/logger';
import {
  ComplianceRule,
  ComplianceRequirement,
  ComplianceConfig,
  DataRetentionPolicy,
  DataPrivacyConfig,
  PseudonymizationRule,
  SecurityAuditLog,
  SecurityEvent
} from './types';

const logger = Logger.getLogger('compliance-monitor');

export interface ComplianceViolation {
  id: string;
  ruleId: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  serviceId: string;
  detectedAt: Date;
  status: 'open' | 'acknowledged' | 'resolved' | 'false_positive';
  evidence: string[];
  remediation?: string;
  dueDate?: Date;
}

export interface ComplianceReport {
  id: string;
  generatedAt: Date;
  periodStart: Date;
  periodEnd: Date;
  overallScore: number;
  ruleCompliance: {
    ruleId: string;
    ruleName: string;
    status: 'compliant' | 'non_compliant' | 'unknown';
    score: number;
    violations: number;
    lastChecked: Date;
  }[];
  violations: ComplianceViolation[];
  recommendations: string[];
  nextAuditDate: Date;
}

export interface DataProcessingActivity {
  id: string;
  serviceId: string;
  dataType: string;
  purpose: string;
  legalBasis: string;
  dataSubjects: string[];
  recipients: string[];
  retentionPeriod: number;
  securityMeasures: string[];
  crossBorderTransfers: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class ComplianceMonitor extends EventEmitter {
  private rules: Map<string, ComplianceRule> = new Map();
  private violations: Map<string, ComplianceViolation> = new Map();
  private config: ComplianceConfig;
  private dataProcessingActivities: Map<string, DataProcessingActivity> = new Map();
  private auditLogs: SecurityAuditLog[] = [];
  private scanTimer?: NodeJS.Timeout;

  constructor(config: ComplianceConfig) {
    super();
    this.config = {
      enabledRegulations: ['GDPR', 'CCPA'],
      automaticScanning: true,
      scanInterval: 24,
      reportingEnabled: true,
      reportingInterval: 7,
      exemptServices: [],
      ...config
    };

    this.initializeDefaultRules();
    
    if (this.config.automaticScanning) {
      this.startAutomaticScanning();
    }

    if (this.config.reportingEnabled) {
      this.startReportingSchedule();
    }
  }

  /**
   * Add or update a compliance rule
   */
  async addRule(rule: Omit<ComplianceRule, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    try {
      const ruleId = 'rule_' + Math.random().toString(36).substr(2, 9);
      const now = new Date();

      const fullRule: ComplianceRule = {
        id: ruleId,
        createdAt: now,
        updatedAt: now,
        ...rule
      };

      this.validateRule(fullRule);
      this.rules.set(ruleId, fullRule);

      await this.auditLog('compliance_rule_added', 'success', {
        ruleId,
        name: rule.name,
        type: rule.type,
        regulation: rule.regulation
      });

      logger.info(`Compliance rule added: ${rule.name}`, { ruleId });
      this.emit('rule_added', fullRule);

      return ruleId;
    } catch (error) {
      logger.error(`Failed to add compliance rule:`, error);
      throw error;
    }
  }

  /**
   * Update a compliance rule
   */
  async updateRule(ruleId: string, updates: Partial<ComplianceRule>): Promise<void> {
    try {
      const rule = this.rules.get(ruleId);
      if (!rule) {
        throw new Error(`Compliance rule not found: ${ruleId}`);
      }

      const updatedRule = {
        ...rule,
        ...updates,
        updatedAt: new Date()
      };

      this.validateRule(updatedRule);
      this.rules.set(ruleId, updatedRule);

      await this.auditLog('compliance_rule_updated', 'success', {
        ruleId,
        updates: Object.keys(updates)
      });

      logger.info(`Compliance rule updated: ${ruleId}`);
      this.emit('rule_updated', updatedRule);
    } catch (error) {
      logger.error(`Failed to update compliance rule ${ruleId}:`, error);
      throw error;
    }
  }

  /**
   * Check compliance for a specific service
   */
  async checkServiceCompliance(serviceId: string): Promise<{
    overallScore: number;
    violations: ComplianceViolation[];
    recommendations: string[];
  }> {
    try {
      if (this.config.exemptServices.includes(serviceId)) {
        return {
          overallScore: 100,
          violations: [],
          recommendations: ['Service is exempt from compliance monitoring']
        };
      }

      const violations: ComplianceViolation[] = [];
      const recommendations: string[] = [];
      let totalScore = 0;
      let checkedRules = 0;

      // Check all applicable rules
      for (const rule of this.rules.values()) {
        if (!rule.isActive || !rule.applicableServices.includes(serviceId)) {
          continue;
        }

        const ruleResult = await this.checkRule(rule, serviceId);
        checkedRules++;

        if (ruleResult.violations.length > 0) {
          violations.push(...ruleResult.violations);
          totalScore += ruleResult.score;
        } else {
          totalScore += 100; // Perfect score for compliant rules
        }

        if (ruleResult.recommendations.length > 0) {
          recommendations.push(...ruleResult.recommendations);
        }
      }

      const overallScore = checkedRules > 0 ? totalScore / checkedRules : 100;

      await this.auditLog('service_compliance_checked', 'success', {
        serviceId,
        overallScore,
        violationCount: violations.length,
        checkedRules
      });

      return {
        overallScore,
        violations,
        recommendations
      };
    } catch (error) {
      logger.error(`Failed to check compliance for service ${serviceId}:`, error);
      throw error;
    }
  }

  /**
   * Scan all services for compliance
   */
  async scanAllServices(): Promise<ComplianceReport> {
    try {
      const reportId = 'report_' + Math.random().toString(36).substr(2, 12);
      const now = new Date();
      const periodStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); // Last 7 days

      logger.info('Starting comprehensive compliance scan');

      const allViolations: ComplianceViolation[] = [];
      const ruleCompliance: ComplianceReport['ruleCompliance'] = [];
      const recommendations: string[] = [];

      // Get all unique service IDs from rules
      const serviceIds = new Set<string>();
      for (const rule of this.rules.values()) {
        rule.applicableServices.forEach(serviceId => serviceIds.add(serviceId));
      }

      // Check each service
      for (const serviceId of serviceIds) {
        if (this.config.exemptServices.includes(serviceId)) {
          continue;
        }

        try {
          const serviceResult = await this.checkServiceCompliance(serviceId);
          allViolations.push(...serviceResult.violations);
          recommendations.push(...serviceResult.recommendations);
        } catch (error) {
          logger.error(`Failed to scan service ${serviceId}:`, error);
        }
      }

      // Generate rule compliance summary
      for (const rule of this.rules.values()) {
        if (!rule.isActive) continue;

        const ruleViolations = allViolations.filter(v => v.ruleId === rule.id);
        const status = ruleViolations.length === 0 ? 'compliant' : 'non_compliant';
        const score = ruleViolations.length === 0 ? 100 : Math.max(0, 100 - (ruleViolations.length * 10));

        ruleCompliance.push({
          ruleId: rule.id,
          ruleName: rule.name,
          status,
          score,
          violations: ruleViolations.length,
          lastChecked: now
        });
      }

      const overallScore = ruleCompliance.length > 0 
        ? ruleCompliance.reduce((sum, rule) => sum + rule.score, 0) / ruleCompliance.length 
        : 100;

      const report: ComplianceReport = {
        id: reportId,
        generatedAt: now,
        periodStart,
        periodEnd: now,
        overallScore,
        ruleCompliance,
        violations: allViolations,
        recommendations: [...new Set(recommendations)], // Remove duplicates
        nextAuditDate: new Date(now.getTime() + this.config.scanInterval * 60 * 60 * 1000)
      };

      await this.auditLog('compliance_scan_completed', 'success', {
        reportId,
        overallScore,
        totalViolations: allViolations.length,
        servicesScanned: serviceIds.size
      });

      this.emit('scan_completed', report);
      logger.info(`Compliance scan completed - Score: ${overallScore.toFixed(2)}%`, {
        reportId,
        violations: allViolations.length
      });

      return report;
    } catch (error) {
      logger.error('Failed to complete compliance scan:', error);
      throw error;
    }
  }

  /**
   * Register data processing activity
   */
  async registerDataProcessingActivity(activity: Omit<DataProcessingActivity, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    try {
      const activityId = 'dpa_' + Math.random().toString(36).substr(2, 12);
      const now = new Date();

      const fullActivity: DataProcessingActivity = {
        id: activityId,
        createdAt: now,
        updatedAt: now,
        ...activity
      };

      this.dataProcessingActivities.set(activityId, fullActivity);

      await this.auditLog('data_processing_activity_registered', 'success', {
        activityId,
        serviceId: activity.serviceId,
        dataType: activity.dataType,
        purpose: activity.purpose
      });

      logger.info(`Data processing activity registered for service: ${activity.serviceId}`, {
        activityId,
        dataType: activity.dataType
      });

      this.emit('data_processing_registered', fullActivity);
      return activityId;
    } catch (error) {
      logger.error('Failed to register data processing activity:', error);
      throw error;
    }
  }

  /**
   * Apply data retention policy
   */
  async applyDataRetentionPolicy(policy: DataRetentionPolicy, serviceId: string): Promise<{
    affectedRecords: number;
    deletedRecords: number;
    errors: string[];
  }> {
    try {
      logger.info(`Applying data retention policy: ${policy.name}`, {
        serviceId,
        retentionPeriod: policy.retentionPeriod
      });

      // This is a placeholder implementation
      // In practice, you'd query the actual data store and apply the retention policy
      const result = {
        affectedRecords: 0,
        deletedRecords: 0,
        errors: [] as string[]
      };

      // Simulate retention policy application
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - policy.retentionPeriod);

      await this.auditLog('data_retention_applied', 'success', {
        policyId: policy.id,
        serviceId,
        cutoffDate: cutoffDate.toISOString(),
        deletionMethod: policy.deletionMethod,
        affectedRecords: result.affectedRecords
      });

      // Update policy last applied date
      policy.lastApplied = new Date();

      this.emit('retention_policy_applied', {
        policy,
        serviceId,
        result
      });

      return result;
    } catch (error) {
      logger.error(`Failed to apply data retention policy:`, error);
      throw error;
    }
  }

  /**
   * Apply pseudonymization rules
   */
  async applyPseudonymization(rules: PseudonymizationRule[], data: Record<string, any>): Promise<Record<string, any>> {
    try {
      const pseudonymizedData = { ...data };

      for (const rule of rules) {
        if (pseudonymizedData[rule.field] !== undefined) {
          const originalValue = pseudonymizedData[rule.field];
          
          switch (rule.method) {
            case 'hash':
              pseudonymizedData[rule.field] = this.hashValue(originalValue);
              break;
            case 'encrypt':
              pseudonymizedData[rule.field] = await this.encryptValue(originalValue, rule.key);
              break;
            case 'tokenize':
              pseudonymizedData[rule.field] = this.tokenizeValue(originalValue, rule.preserveFormat);
              break;
            case 'mask':
              pseudonymizedData[rule.field] = this.maskValue(originalValue, rule.preserveFormat);
              break;
          }
        }
      }

      return pseudonymizedData;
    } catch (error) {
      logger.error('Failed to apply pseudonymization:', error);
      throw error;
    }
  }

  /**
   * Report compliance violation
   */
  async reportViolation(violation: Omit<ComplianceViolation, 'id' | 'detectedAt' | 'status'>): Promise<string> {
    try {
      const violationId = 'violation_' + Math.random().toString(36).substr(2, 12);
      
      const fullViolation: ComplianceViolation = {
        id: violationId,
        detectedAt: new Date(),
        status: 'open',
        ...violation
      };

      this.violations.set(violationId, fullViolation);

      await this.auditLog('compliance_violation_reported', 'blocked', {
        violationId,
        ruleId: violation.ruleId,
        severity: violation.severity,
        serviceId: violation.serviceId,
        description: violation.description
      });

      logger.warn(`Compliance violation reported: ${violation.description}`, {
        violationId,
        severity: violation.severity,
        serviceId: violation.serviceId
      });

      this.emit('violation_reported', fullViolation);
      return violationId;
    } catch (error) {
      logger.error('Failed to report compliance violation:', error);
      throw error;
    }
  }

  /**
   * Acknowledge a violation
   */
  async acknowledgeViolation(violationId: string, acknowledgedBy: string, notes?: string): Promise<void> {
    try {
      const violation = this.violations.get(violationId);
      if (!violation) {
        throw new Error(`Violation not found: ${violationId}`);
      }

      violation.status = 'acknowledged';

      await this.auditLog('compliance_violation_acknowledged', 'success', {
        violationId,
        acknowledgedBy,
        notes
      });

      logger.info(`Compliance violation acknowledged: ${violationId}`, { acknowledgedBy });
      this.emit('violation_acknowledged', violation);
    } catch (error) {
      logger.error(`Failed to acknowledge violation ${violationId}:`, error);
      throw error;
    }
  }

  /**
   * Resolve a violation
   */
  async resolveViolation(violationId: string, resolvedBy: string, resolution: string): Promise<void> {
    try {
      const violation = this.violations.get(violationId);
      if (!violation) {
        throw new Error(`Violation not found: ${violationId}`);
      }

      violation.status = 'resolved';
      violation.remediation = resolution;

      await this.auditLog('compliance_violation_resolved', 'success', {
        violationId,
        resolvedBy,
        resolution
      });

      logger.info(`Compliance violation resolved: ${violationId}`, { resolvedBy });
      this.emit('violation_resolved', violation);
    } catch (error) {
      logger.error(`Failed to resolve violation ${violationId}:`, error);
      throw error;
    }
  }

  /**
   * Get compliance statistics
   */
  getComplianceStatistics(): {
    totalRules: number;
    activeRules: number;
    totalViolations: number;
    openViolations: number;
    criticalViolations: number;
    complianceScore: number;
    dataProcessingActivities: number;
    lastScanDate?: Date;
  } {
    const rules = Array.from(this.rules.values());
    const violations = Array.from(this.violations.values());

    const activeRules = rules.filter(rule => rule.isActive);
    const openViolations = violations.filter(v => v.status === 'open');
    const criticalViolations = violations.filter(v => v.severity === 'critical');

    // Calculate compliance score based on violations
    const totalChecks = activeRules.length;
    const failedChecks = openViolations.length;
    const complianceScore = totalChecks > 0 ? ((totalChecks - failedChecks) / totalChecks) * 100 : 100;

    return {
      totalRules: rules.length,
      activeRules: activeRules.length,
      totalViolations: violations.length,
      openViolations: openViolations.length,
      criticalViolations: criticalViolations.length,
      complianceScore,
      dataProcessingActivities: this.dataProcessingActivities.size,
      lastScanDate: this.getLastScanDate()
    };
  }

  /**
   * Get all rules
   */
  getAllRules(): ComplianceRule[] {
    return Array.from(this.rules.values());
  }

  /**
   * Get all violations
   */
  getAllViolations(filters?: {
    status?: ComplianceViolation['status'];
    severity?: ComplianceViolation['severity'];
    serviceId?: string;
    ruleId?: string;
  }): ComplianceViolation[] {
    let violations = Array.from(this.violations.values());

    if (filters) {
      if (filters.status) {
        violations = violations.filter(v => v.status === filters.status);
      }
      if (filters.severity) {
        violations = violations.filter(v => v.severity === filters.severity);
      }
      if (filters.serviceId) {
        violations = violations.filter(v => v.serviceId === filters.serviceId);
      }
      if (filters.ruleId) {
        violations = violations.filter(v => v.ruleId === filters.ruleId);
      }
    }

    return violations.sort((a, b) => b.detectedAt.getTime() - a.detectedAt.getTime());
  }

  /**
   * Initialize default compliance rules
   */
  private initializeDefaultRules(): void {
    const defaultRules = [
      {
        name: 'GDPR Data Retention Limit',
        type: 'data_retention' as const,
        description: 'Ensure personal data is not retained longer than necessary',
        regulation: 'GDPR' as const,
        requirements: [
          {
            id: 'gdpr_retention_1',
            description: 'Data retention period should not exceed business necessity',
            status: 'unknown' as const
          }
        ],
        applicableServices: ['*'],
        severity: 'mandatory' as const,
        isActive: true
      },
      {
        name: 'API Rate Limiting Compliance',
        type: 'api_terms' as const,
        description: 'Ensure API usage complies with third-party terms of service',
        regulation: 'CUSTOM' as const,
        requirements: [
          {
            id: 'api_rate_1',
            description: 'API calls should not exceed provider rate limits',
            status: 'unknown' as const
          }
        ],
        applicableServices: ['*'],
        severity: 'mandatory' as const,
        isActive: true
      },
      {
        name: 'Data Encryption Standards',
        type: 'security_standard' as const,
        description: 'Ensure sensitive data is encrypted at rest and in transit',
        regulation: 'SOC2' as const,
        requirements: [
          {
            id: 'encryption_1',
            description: 'All sensitive data must be encrypted using AES-256 or equivalent',
            status: 'unknown' as const
          }
        ],
        applicableServices: ['*'],
        severity: 'mandatory' as const,
        isActive: true
      }
    ];

    for (const rule of defaultRules) {
      this.addRule(rule).catch(error => {
        logger.error('Failed to add default rule:', error);
      });
    }
  }

  /**
   * Check a specific rule against a service
   */
  private async checkRule(rule: ComplianceRule, serviceId: string): Promise<{
    score: number;
    violations: ComplianceViolation[];
    recommendations: string[];
  }> {
    const violations: ComplianceViolation[] = [];
    const recommendations: string[] = [];
    let score = 100;

    try {
      // Check each requirement in the rule
      for (const requirement of rule.requirements) {
        const requirementResult = await this.checkRequirement(requirement, rule, serviceId);
        
        if (requirementResult.violation) {
          violations.push(requirementResult.violation);
          score -= 50; // Deduct points for violations
        }

        if (requirementResult.recommendations.length > 0) {
          recommendations.push(...requirementResult.recommendations);
        }
      }

      // Ensure score doesn't go below 0
      score = Math.max(0, score);

      return { score, violations, recommendations };
    } catch (error) {
      logger.error(`Failed to check rule ${rule.id}:`, error);
      return { score: 0, violations, recommendations };
    }
  }

  /**
   * Check a specific requirement
   */
  private async checkRequirement(
    requirement: ComplianceRequirement,
    rule: ComplianceRule,
    serviceId: string
  ): Promise<{
    violation?: ComplianceViolation;
    recommendations: string[];
  }> {
    const recommendations: string[] = [];

    try {
      // This is a simplified implementation
      // In practice, you'd run actual validation scripts or check against real data
      
      let isCompliant = true;
      let violationDescription = '';

      // Simulate requirement checking based on type
      switch (rule.type) {
        case 'data_retention':
          // Check if data retention policies are properly configured
          const hasRetentionPolicy = this.hasDataRetentionPolicy(serviceId);
          if (!hasRetentionPolicy) {
            isCompliant = false;
            violationDescription = `Service ${serviceId} lacks proper data retention policy`;
            recommendations.push('Implement automated data retention policies');
          }
          break;

        case 'api_terms':
          // Check API usage compliance
          const apiUsageCompliant = await this.checkAPIUsageCompliance(serviceId);
          if (!apiUsageCompliant) {
            isCompliant = false;
            violationDescription = `Service ${serviceId} may be violating API terms of service`;
            recommendations.push('Review and adjust API usage patterns');
          }
          break;

        case 'privacy_regulation':
          // Check privacy regulation compliance
          const privacyCompliant = this.checkPrivacyCompliance(serviceId);
          if (!privacyCompliant) {
            isCompliant = false;
            violationDescription = `Service ${serviceId} may not be privacy regulation compliant`;
            recommendations.push('Implement privacy-by-design principles');
          }
          break;

        case 'security_standard':
          // Check security standard compliance
          const securityCompliant = this.checkSecurityCompliance(serviceId);
          if (!securityCompliant) {
            isCompliant = false;
            violationDescription = `Service ${serviceId} may not meet security standards`;
            recommendations.push('Upgrade security measures to meet standards');
          }
          break;
      }

      // Update requirement status
      requirement.status = isCompliant ? 'compliant' : 'non_compliant';
      requirement.lastChecked = new Date();

      let violation: ComplianceViolation | undefined;
      if (!isCompliant) {
        violation = {
          id: 'violation_' + Math.random().toString(36).substr(2, 12),
          ruleId: rule.id,
          severity: rule.severity === 'mandatory' ? 'high' : 'medium',
          description: violationDescription,
          serviceId,
          detectedAt: new Date(),
          status: 'open',
          evidence: [`Requirement check failed: ${requirement.description}`],
          remediation: requirement.remediation
        };
      }

      return { violation, recommendations };
    } catch (error) {
      logger.error(`Failed to check requirement ${requirement.id}:`, error);
      return { recommendations: ['Manual review required due to check failure'] };
    }
  }

  /**
   * Validate rule structure
   */
  private validateRule(rule: ComplianceRule): void {
    if (!rule.name || rule.name.trim().length === 0) {
      throw new Error('Rule name is required');
    }

    if (!rule.requirements || rule.requirements.length === 0) {
      throw new Error('Rule must have at least one requirement');
    }

    if (!rule.applicableServices || rule.applicableServices.length === 0) {
      throw new Error('Rule must specify applicable services');
    }

    if (!['mandatory', 'recommended', 'optional'].includes(rule.severity)) {
      throw new Error('Rule severity must be mandatory, recommended, or optional');
    }
  }

  /**
   * Helper methods for compliance checks
   */
  private hasDataRetentionPolicy(serviceId: string): boolean {
    // Placeholder - check if service has retention policies configured
    return Math.random() > 0.3; // Simulate 70% compliance
  }

  private async checkAPIUsageCompliance(serviceId: string): Promise<boolean> {
    // Placeholder - check API usage patterns against terms
    return Math.random() > 0.2; // Simulate 80% compliance
  }

  private checkPrivacyCompliance(serviceId: string): boolean {
    // Placeholder - check privacy regulation compliance
    return Math.random() > 0.25; // Simulate 75% compliance
  }

  private checkSecurityCompliance(serviceId: string): boolean {
    // Placeholder - check security standard compliance
    return Math.random() > 0.15; // Simulate 85% compliance
  }

  /**
   * Pseudonymization helper methods
   */
  private hashValue(value: string): string {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(value).digest('hex');
  }

  private async encryptValue(value: string, key?: string): Promise<string> {
    // Simplified encryption - use proper encryption in production
    const crypto = require('crypto');
    const cipher = crypto.createCipher('aes-256-cbc', key || 'default-key');
    let encrypted = cipher.update(value, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
  }

  private tokenizeValue(value: string, preserveFormat: boolean): string {
    if (preserveFormat) {
      // Preserve format (e.g., email becomes token@domain.com)
      if (value.includes('@')) {
        const [local, domain] = value.split('@');
        return `token_${Math.random().toString(36).substr(2, 8)}@${domain}`;
      }
    }
    return `token_${Math.random().toString(36).substr(2, 12)}`;
  }

  private maskValue(value: string, preserveFormat: boolean): string {
    if (preserveFormat && value.length > 4) {
      // Show first and last 2 characters
      return value.substring(0, 2) + '*'.repeat(value.length - 4) + value.substring(value.length - 2);
    }
    return '*'.repeat(value.length);
  }

  /**
   * Get last scan date from audit logs
   */
  private getLastScanDate(): Date | undefined {
    const scanLogs = this.auditLogs
      .filter(log => log.details.action === 'compliance_scan_completed')
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    
    return scanLogs.length > 0 ? scanLogs[0].timestamp : undefined;
  }

  /**
   * Start automatic scanning
   */
  private startAutomaticScanning(): void {
    const intervalMs = this.config.scanInterval * 60 * 60 * 1000; // Convert hours to ms
    
    this.scanTimer = setInterval(async () => {
      try {
        logger.info('Starting scheduled compliance scan');
        await this.scanAllServices();
      } catch (error) {
        logger.error('Scheduled compliance scan failed:', error);
      }
    }, intervalMs);

    logger.info(`Automatic compliance scanning started (interval: ${this.config.scanInterval} hours)`);
  }

  /**
   * Start reporting schedule
   */
  private startReportingSchedule(): void {
    const intervalMs = this.config.reportingInterval * 24 * 60 * 60 * 1000; // Convert days to ms
    
    setInterval(async () => {
      try {
        const report = await this.scanAllServices();
        this.emit('compliance_report', report);
        logger.info('Scheduled compliance report generated', { reportId: report.id });
      } catch (error) {
        logger.error('Scheduled compliance reporting failed:', error);
      }
    }, intervalMs);

    logger.info(`Compliance reporting scheduled (interval: ${this.config.reportingInterval} days)`);
  }

  /**
   * Create audit log entry
   */
  private async auditLog(
    eventType: string,
    result: 'success' | 'failure' | 'blocked',
    details: Record<string, any>
  ): Promise<void> {
    const log: SecurityAuditLog = {
      id: 'audit_' + Math.random().toString(36).substr(2, 16),
      timestamp: new Date(),
      eventType: eventType as any,
      severity: result === 'failure' ? 'high' : result === 'blocked' ? 'medium' : 'low',
      details: {
        action: eventType,
        resource: 'compliance_monitor',
        result,
        metadata: details
      }
    };

    this.auditLogs.push(log);
    
    // Keep only recent logs
    if (this.auditLogs.length > 5000) {
      this.auditLogs = this.auditLogs.slice(-2500);
    }

    this.emit('audit_log', log);
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    if (this.scanTimer) {
      clearInterval(this.scanTimer);
    }

    this.rules.clear();
    this.violations.clear();
    this.dataProcessingActivities.clear();
    this.auditLogs.length = 0;
    this.removeAllListeners();
    
    logger.info('Compliance monitor cleanup complete');
  }
}