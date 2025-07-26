/**
 * Compliance Monitoring Framework
 * Regulatory compliance monitoring for RWA integration across multiple jurisdictions
 */

import { EventEmitter } from 'events';
import { 
  ComplianceRule, 
  ComplianceViolation, 
  RWAData, 
  ProtocolData 
} from '../types';
import Logger from '@/shared/logging/logger';

const logger = Logger.getLogger('compliance-monitoring');

/**
 * Compliance Monitoring Configuration
 */
export interface ComplianceMonitoringConfig {
  enableRealTimeMonitoring: boolean;
  monitoringInterval: number; // milliseconds
  alertThresholds: {
    low: number;
    medium: number;
    high: number;
    critical: number;
  };
  jurisdictions: string[];
  enableAutoRemediation: boolean;
  complianceScoring: boolean;
  auditTrail: boolean;
  updateInterval: number; // milliseconds
}

export const DEFAULT_COMPLIANCE_CONFIG: ComplianceMonitoringConfig = {
  enableRealTimeMonitoring: true,
  monitoringInterval: 60000, // 1 minute
  alertThresholds: {
    low: 0.3,
    medium: 0.5,
    high: 0.7,
    critical: 0.9
  },
  jurisdictions: ['US', 'EU', 'UK', 'Singapore', 'Switzerland'],
  enableAutoRemediation: false,
  complianceScoring: true,
  auditTrail: true,
  updateInterval: 300000 // 5 minutes
};

/**
 * Compliance Assessment Result
 */
export interface ComplianceAssessment {
  entityId: string;
  entityType: 'protocol' | 'rwa';
  jurisdiction: string;
  timestamp: Date;
  overallScore: number;
  complianceLevel: 'compliant' | 'partial' | 'non-compliant';
  violations: ComplianceViolation[];
  recommendations: ComplianceRecommendation[];
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  lastReview: Date;
  nextReview: Date;
}

export interface ComplianceRecommendation {
  priority: 'low' | 'medium' | 'high' | 'critical';
  category: string;
  description: string;
  action: string;
  deadline: Date;
  estimatedCost: number;
  impact: 'low' | 'medium' | 'high';
}

/**
 * Regulatory Change Event
 */
export interface RegulatoryChange {
  id: string;
  jurisdiction: string;
  category: string;
  title: string;
  description: string;
  effectiveDate: Date;
  impact: 'low' | 'medium' | 'high' | 'critical';
  affectedEntities: string[];
  requirements: string[];
  complianceDeadline: Date;
  source: string;
  timestamp: Date;
}

/**
 * Alert Configuration
 */
export interface AlertConfig {
  type: 'email' | 'slack' | 'webhook' | 'sms';
  recipients: string[];
  severity: 'low' | 'medium' | 'high' | 'critical';
  enabled: boolean;
  template: string;
}

/**
 * Compliance Monitoring Framework
 */
export class ComplianceMonitoringFramework extends EventEmitter {
  private static instance: ComplianceMonitoringFramework;
  private config: ComplianceMonitoringConfig;
  private rules: Map<string, ComplianceRule> = new Map();
  private violations: Map<string, ComplianceViolation[]> = new Map();
  private assessments: Map<string, ComplianceAssessment> = new Map();
  private regulatoryChanges: RegulatoryChange[] = [];
  private alertConfigs: AlertConfig[] = [];
  private isRunning: boolean = false;
  private monitoringInterval?: NodeJS.Timeout;
  private updateInterval?: NodeJS.Timeout;

  private constructor(config: ComplianceMonitoringConfig = DEFAULT_COMPLIANCE_CONFIG) {
    super();
    this.config = config;
  }

  static getInstance(config?: ComplianceMonitoringConfig): ComplianceMonitoringFramework {
    if (!ComplianceMonitoringFramework.instance) {
      ComplianceMonitoringFramework.instance = new ComplianceMonitoringFramework(config);
    }
    return ComplianceMonitoringFramework.instance;
  }

  async initialize(): Promise<void> {
    try {
      logger.info('Initializing Compliance Monitoring Framework...');
      
      // Load compliance rules
      await this.loadComplianceRules();

      // Initialize alert configurations
      this.initializeAlertConfigs();

      // Start monitoring if enabled
      if (this.config.enableRealTimeMonitoring) {
        this.startMonitoring();
      }

      // Start periodic updates
      this.startPeriodicUpdates();

      logger.info('Compliance Monitoring Framework initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Compliance Monitoring Framework:', error);
      throw error;
    }
  }

  async assessCompliance(
    entityId: string, 
    entityType: 'protocol' | 'rwa', 
    entityData: ProtocolData | RWAData
  ): Promise<ComplianceAssessment> {
    try {
      logger.info('Assessing compliance', { entityId, entityType });

      const jurisdiction = this.determineJurisdiction(entityData);
      const applicableRules = this.getApplicableRules(jurisdiction, entityType);
      
      const violations: ComplianceViolation[] = [];
      let totalScore = 0;
      let ruleCount = 0;

      // Check each applicable rule
      for (const rule of applicableRules) {
        const ruleViolation = await this.checkRuleCompliance(rule, entityData);
        if (ruleViolation) {
          violations.push(ruleViolation);
        }
        
        // Calculate compliance score for this rule
        const ruleScore = ruleViolation ? 0 : 1;
        totalScore += ruleScore;
        ruleCount++;
      }

      const overallScore = ruleCount > 0 ? totalScore / ruleCount : 1;
      const complianceLevel = this.determineComplianceLevel(overallScore);
      const riskLevel = this.calculateRiskLevel(violations, overallScore);

      // Generate recommendations
      const recommendations = this.generateRecommendations(violations, applicableRules);

      const assessment: ComplianceAssessment = {
        entityId,
        entityType,
        jurisdiction,
        timestamp: new Date(),
        overallScore,
        complianceLevel,
        violations,
        recommendations,
        riskLevel,
        lastReview: new Date(),
        nextReview: this.calculateNextReview(riskLevel)
      };

      // Store assessment
      this.assessments.set(entityId, assessment);

      // Store violations
      if (violations.length > 0) {
        this.violations.set(entityId, violations);
      }

      // Emit assessment completed event
      this.emit('assessment_completed', {
        entityId,
        assessment,
        timestamp: new Date()
      });

      // Send alerts if needed
      await this.sendAlerts(assessment);

      logger.info('Compliance assessment completed', { 
        entityId, 
        overallScore, 
        complianceLevel,
        violationsCount: violations.length 
      });

      return assessment;
    } catch (error) {
      logger.error('Compliance assessment failed', { 
        entityId, 
        entityType, 
        error 
      });
      throw error;
    }
  }

  async monitorRegulatoryChanges(): Promise<RegulatoryChange[]> {
    try {
      logger.info('Monitoring regulatory changes...');

      const newChanges: RegulatoryChange[] = [];

      // Simulate regulatory change detection
      // In a real implementation, this would query regulatory APIs
      for (const jurisdiction of this.config.jurisdictions) {
        const changes = await this.detectRegulatoryChanges(jurisdiction);
        newChanges.push(...changes);
      }

      // Add new changes to the list
      this.regulatoryChanges.push(...newChanges);

      // Emit regulatory change events
      for (const change of newChanges) {
        this.emit('regulatory_change_detected', {
          change,
          timestamp: new Date()
        });
      }

      logger.info('Regulatory change monitoring completed', { 
        newChangesCount: newChanges.length 
      });

      return newChanges;
    } catch (error) {
      logger.error('Regulatory change monitoring failed:', error);
      throw error;
    }
  }

  async addComplianceRule(rule: ComplianceRule): Promise<void> {
    try {
      this.rules.set(rule.id, rule);
      logger.info('Compliance rule added', { ruleId: rule.id });
    } catch (error) {
      logger.error('Failed to add compliance rule:', error);
      throw error;
    }
  }

  async removeComplianceRule(ruleId: string): Promise<void> {
    try {
      this.rules.delete(ruleId);
      logger.info('Compliance rule removed', { ruleId });
    } catch (error) {
      logger.error('Failed to remove compliance rule:', error);
      throw error;
    }
  }

  async updateComplianceRule(ruleId: string, updates: Partial<ComplianceRule>): Promise<void> {
    try {
      const rule = this.rules.get(ruleId);
      if (!rule) {
        throw new Error(`Compliance rule not found: ${ruleId}`);
      }

      const updatedRule = { ...rule, ...updates, lastUpdated: new Date() };
      this.rules.set(ruleId, updatedRule);

      logger.info('Compliance rule updated', { ruleId });
    } catch (error) {
      logger.error('Failed to update compliance rule:', error);
      throw error;
    }
  }

  async getComplianceReport(
    entityIds?: string[], 
    jurisdiction?: string, 
    timeRange?: { start: Date; end: Date }
  ): Promise<ComplianceReport> {
    try {
      const assessments = Array.from(this.assessments.values());
      let filteredAssessments = assessments;

      // Filter by entity IDs
      if (entityIds && entityIds.length > 0) {
        filteredAssessments = filteredAssessments.filter(a => entityIds.includes(a.entityId));
      }

      // Filter by jurisdiction
      if (jurisdiction) {
        filteredAssessments = filteredAssessments.filter(a => a.jurisdiction === jurisdiction);
      }

      // Filter by time range
      if (timeRange) {
        filteredAssessments = filteredAssessments.filter(a => 
          a.timestamp >= timeRange.start && a.timestamp <= timeRange.end
        );
      }

      const report: ComplianceReport = {
        timestamp: new Date(),
        summary: this.generateComplianceSummary(filteredAssessments),
        assessments: filteredAssessments,
        violations: this.getViolationsSummary(filteredAssessments),
        trends: this.calculateComplianceTrends(filteredAssessments),
        recommendations: this.generateReportRecommendations(filteredAssessments)
      };

      return report;
    } catch (error) {
      logger.error('Failed to generate compliance report:', error);
      throw error;
    }
  }

  private async loadComplianceRules(): Promise<void> {
    // Load default compliance rules for different jurisdictions
    const defaultRules: ComplianceRule[] = [
      // US Regulations
      {
        id: 'us-sec-rule-1',
        jurisdiction: 'US',
        category: 'securities',
        rule: 'SEC registration requirements for digital assets',
        severity: 'high',
        description: 'Digital assets must be registered with SEC if they qualify as securities',
        requirements: ['SEC registration', 'Disclosure requirements', 'Periodic reporting'],
        lastUpdated: new Date()
      },
      {
        id: 'us-kyc-rule-1',
        jurisdiction: 'US',
        category: 'aml',
        rule: 'KYC/AML requirements for financial institutions',
        severity: 'critical',
        description: 'Customer identification and anti-money laundering procedures required',
        requirements: ['Customer identification', 'Transaction monitoring', 'Suspicious activity reporting'],
        lastUpdated: new Date()
      },

      // EU Regulations
      {
        id: 'eu-mifid-rule-1',
        jurisdiction: 'EU',
        category: 'trading',
        rule: 'MiFID II trading requirements',
        severity: 'high',
        description: 'Markets in Financial Instruments Directive II compliance',
        requirements: ['Trading venue authorization', 'Transaction reporting', 'Best execution'],
        lastUpdated: new Date()
      },
      {
        id: 'eu-gdpr-rule-1',
        jurisdiction: 'EU',
        category: 'privacy',
        rule: 'GDPR data protection requirements',
        severity: 'critical',
        description: 'General Data Protection Regulation compliance',
        requirements: ['Data minimization', 'Consent management', 'Data subject rights'],
        lastUpdated: new Date()
      },

      // UK Regulations
      {
        id: 'uk-fca-rule-1',
        jurisdiction: 'UK',
        category: 'financial',
        rule: 'FCA authorization requirements',
        severity: 'high',
        description: 'Financial Conduct Authority authorization for financial services',
        requirements: ['FCA authorization', 'Capital requirements', 'Conduct rules'],
        lastUpdated: new Date()
      },

      // Singapore Regulations
      {
        id: 'sg-mas-rule-1',
        jurisdiction: 'Singapore',
        category: 'financial',
        rule: 'MAS licensing requirements',
        severity: 'high',
        description: 'Monetary Authority of Singapore licensing for financial services',
        requirements: ['MAS license', 'Capital adequacy', 'Risk management'],
        lastUpdated: new Date()
      },

      // Switzerland Regulations
      {
        id: 'ch-finma-rule-1',
        jurisdiction: 'Switzerland',
        category: 'financial',
        rule: 'FINMA authorization requirements',
        severity: 'high',
        description: 'Swiss Financial Market Supervisory Authority authorization',
        requirements: ['FINMA authorization', 'Swiss banking license', 'Compliance monitoring'],
        lastUpdated: new Date()
      }
    ];

    for (const rule of defaultRules) {
      this.rules.set(rule.id, rule);
    }

    logger.info('Compliance rules loaded', { rulesCount: this.rules.size });
  }

  private initializeAlertConfigs(): void {
    this.alertConfigs = [
      {
        type: 'email',
        recipients: ['compliance@yieldsensei.com'],
        severity: 'critical',
        enabled: true,
        template: 'critical_compliance_alert'
      },
      {
        type: 'slack',
        recipients: ['#compliance-alerts'],
        severity: 'high',
        enabled: true,
        template: 'high_compliance_alert'
      },
      {
        type: 'webhook',
        recipients: ['https://api.yieldsensei.com/compliance/webhook'],
        severity: 'medium',
        enabled: true,
        template: 'medium_compliance_alert'
      }
    ];
  }

  private determineJurisdiction(entityData: ProtocolData | RWAData): string {
    // Simplified jurisdiction determination
    // In a real implementation, this would use more sophisticated logic
    
    if ('regulatoryStatus' in entityData) {
      return entityData.regulatoryStatus.jurisdiction;
    }
    
    // Default to US for protocols
    return 'US';
  }

  private getApplicableRules(jurisdiction: string, entityType: 'protocol' | 'rwa'): ComplianceRule[] {
    return Array.from(this.rules.values()).filter(rule => 
      rule.jurisdiction === jurisdiction
    );
  }

  private async checkRuleCompliance(
    rule: ComplianceRule, 
    entityData: ProtocolData | RWAData
  ): Promise<ComplianceViolation | null> {
    try {
      // Simplified compliance checking
      // In a real implementation, this would perform detailed compliance analysis
      
      const complianceScore = this.calculateRuleComplianceScore(rule, entityData);
      
      if (complianceScore < 0.7) { // Threshold for violation
        return {
          ruleId: rule.id,
          protocolId: 'entityId' in entityData ? entityData.id : '',
          severity: rule.severity,
          description: `Non-compliance with ${rule.rule}`,
          detectedAt: new Date(),
          status: 'open',
          remediation: `Implement ${rule.requirements.join(', ')}`
        };
      }
      
      return null;
    } catch (error) {
      logger.error('Rule compliance check failed:', error);
      return null;
    }
  }

  private calculateRuleComplianceScore(rule: ComplianceRule, entityData: ProtocolData | RWAData): number {
    // Simplified compliance scoring
    // In a real implementation, this would use more sophisticated analysis
    
    let score = 0.5; // Base score
    
    // Adjust based on rule category
    switch (rule.category) {
      case 'securities':
        score += 0.2;
        break;
      case 'aml':
        score += 0.3;
        break;
      case 'trading':
        score += 0.1;
        break;
      case 'privacy':
        score += 0.2;
        break;
      case 'financial':
        score += 0.2;
        break;
    }
    
    // Add some randomness for demonstration
    score += (Math.random() - 0.5) * 0.2;
    
    return Math.max(0, Math.min(1, score));
  }

  private determineComplianceLevel(score: number): 'compliant' | 'partial' | 'non-compliant' {
    if (score >= 0.8) return 'compliant';
    if (score >= 0.6) return 'partial';
    return 'non-compliant';
  }

  private calculateRiskLevel(violations: ComplianceViolation[], score: number): 'low' | 'medium' | 'high' | 'critical' {
    const criticalViolations = violations.filter(v => v.severity === 'critical').length;
    const highViolations = violations.filter(v => v.severity === 'high').length;
    
    if (criticalViolations > 0) return 'critical';
    if (highViolations > 2 || score < 0.3) return 'high';
    if (highViolations > 0 || score < 0.6) return 'medium';
    return 'low';
  }

  private generateRecommendations(
    violations: ComplianceViolation[], 
    rules: ComplianceRule[]
  ): ComplianceRecommendation[] {
    const recommendations: ComplianceRecommendation[] = [];

    for (const violation of violations) {
      const rule = rules.find(r => r.id === violation.ruleId);
      if (rule) {
        recommendations.push({
          priority: violation.severity,
          category: rule.category,
          description: `Address ${rule.rule} violation`,
          action: violation.remediation,
          deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
          estimatedCost: this.estimateRemediationCost(rule.category),
          impact: violation.severity === 'critical' ? 'high' : 
                 violation.severity === 'high' ? 'medium' : 'low'
        });
      }
    }

    return recommendations.sort((a, b) => {
      const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }

  private estimateRemediationCost(category: string): number {
    const costEstimates: Record<string, number> = {
      'securities': 50000,
      'aml': 30000,
      'trading': 40000,
      'privacy': 25000,
      'financial': 35000
    };
    return costEstimates[category] || 20000;
  }

  private calculateNextReview(riskLevel: string): Date {
    const now = new Date();
    const daysToAdd = {
      'low': 90,
      'medium': 60,
      'high': 30,
      'critical': 7
    };
    
    const days = daysToAdd[riskLevel as keyof typeof daysToAdd] || 30;
    return new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  }

  private async sendAlerts(assessment: ComplianceAssessment): Promise<void> {
    try {
      const relevantConfigs = this.alertConfigs.filter(config => 
        config.enabled && this.shouldSendAlert(config, assessment)
      );

      for (const config of relevantConfigs) {
        await this.sendAlert(config, assessment);
      }
    } catch (error) {
      logger.error('Failed to send alerts:', error);
    }
  }

  private shouldSendAlert(config: AlertConfig, assessment: ComplianceAssessment): boolean {
    const severityOrder = { low: 1, medium: 2, high: 3, critical: 4 };
    return severityOrder[assessment.riskLevel] >= severityOrder[config.severity];
  }

  private async sendAlert(config: AlertConfig, assessment: ComplianceAssessment): Promise<void> {
    // Simplified alert sending
    // In a real implementation, this would use actual notification services
    
    const alertMessage = this.formatAlertMessage(config, assessment);
    
    logger.info('Sending compliance alert', {
      type: config.type,
      recipients: config.recipients,
      severity: config.severity,
      message: alertMessage
    });

    // Emit alert event
    this.emit('alert_sent', {
      config,
      assessment,
      message: alertMessage,
      timestamp: new Date()
    });
  }

  private formatAlertMessage(config: AlertConfig, assessment: ComplianceAssessment): string {
    return `Compliance Alert - ${assessment.riskLevel.toUpperCase()}
Entity: ${assessment.entityId}
Jurisdiction: ${assessment.jurisdiction}
Compliance Score: ${(assessment.overallScore * 100).toFixed(1)}%
Violations: ${assessment.violations.length}
Risk Level: ${assessment.riskLevel}
Timestamp: ${assessment.timestamp.toISOString()}`;
  }

  private async detectRegulatoryChanges(jurisdiction: string): Promise<RegulatoryChange[]> {
    // Simplified regulatory change detection
    // In a real implementation, this would query regulatory APIs
    
    const changes: RegulatoryChange[] = [];
    
    // Simulate occasional regulatory changes
    if (Math.random() < 0.1) { // 10% chance of change
      changes.push({
        id: `change-${Date.now()}`,
        jurisdiction,
        category: 'financial',
        title: `New ${jurisdiction} regulatory requirement`,
        description: 'Updated regulatory framework for digital assets',
        effectiveDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days from now
        impact: 'medium',
        affectedEntities: [],
        requirements: ['Updated compliance procedures', 'Additional reporting'],
        complianceDeadline: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // 60 days from now
        source: `${jurisdiction} Regulatory Authority`,
        timestamp: new Date()
      });
    }
    
    return changes;
  }

  private startMonitoring(): void {
    this.monitoringInterval = setInterval(async () => {
      try {
        logger.debug('Running compliance monitoring cycle...');
        // This would trigger compliance checks for monitored entities
        logger.debug('Compliance monitoring cycle completed');
      } catch (error) {
        logger.error('Compliance monitoring cycle failed:', error);
      }
    }, this.config.monitoringInterval);
  }

  private startPeriodicUpdates(): void {
    this.updateInterval = setInterval(async () => {
      try {
        logger.debug('Updating compliance framework...');
        await this.monitorRegulatoryChanges();
        logger.debug('Compliance framework update completed');
      } catch (error) {
        logger.error('Compliance framework update failed:', error);
      }
    }, this.config.updateInterval);
  }

  async shutdown(): Promise<void> {
    logger.info('Shutting down Compliance Monitoring Framework...');
    
    this.isRunning = false;
    
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }
    
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }
    
    logger.info('Compliance Monitoring Framework shutdown complete');
  }

  getStatus(): any {
    return {
      isRunning: this.isRunning,
      rulesCount: this.rules.size,
      assessmentsCount: this.assessments.size,
      violationsCount: Array.from(this.violations.values()).flat().length,
      regulatoryChangesCount: this.regulatoryChanges.length,
      alertConfigsCount: this.alertConfigs.length
    };
  }

  // Report generation methods
  private generateComplianceSummary(assessments: ComplianceAssessment[]): any {
    const total = assessments.length;
    const compliant = assessments.filter(a => a.complianceLevel === 'compliant').length;
    const partial = assessments.filter(a => a.complianceLevel === 'partial').length;
    const nonCompliant = assessments.filter(a => a.complianceLevel === 'non-compliant').length;

    return {
      total,
      compliant,
      partial,
      nonCompliant,
      complianceRate: total > 0 ? (compliant / total) * 100 : 0,
      averageScore: total > 0 ? assessments.reduce((sum, a) => sum + a.overallScore, 0) / total : 0
    };
  }

  private getViolationsSummary(assessments: ComplianceAssessment[]): any {
    const allViolations = assessments.flatMap(a => a.violations);
    const bySeverity = {
      critical: allViolations.filter(v => v.severity === 'critical').length,
      high: allViolations.filter(v => v.severity === 'high').length,
      medium: allViolations.filter(v => v.severity === 'medium').length,
      low: allViolations.filter(v => v.severity === 'low').length
    };

    return {
      total: allViolations.length,
      bySeverity,
      open: allViolations.filter(v => v.status === 'open').length,
      resolved: allViolations.filter(v => v.status === 'resolved').length
    };
  }

  private calculateComplianceTrends(assessments: ComplianceAssessment[]): any {
    // Simplified trend calculation
    // In a real implementation, this would analyze historical data
    return {
      trend: 'stable',
      changeRate: 0.02,
      prediction: 'stable'
    };
  }

  private generateReportRecommendations(assessments: ComplianceAssessment[]): ComplianceRecommendation[] {
    const allRecommendations = assessments.flatMap(a => a.recommendations);
    return allRecommendations
      .sort((a, b) => {
        const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
        return priorityOrder[b.priority] - priorityOrder[a.priority];
      })
      .slice(0, 10); // Top 10 recommendations
  }
}

// Additional types for reporting
export interface ComplianceReport {
  timestamp: Date;
  summary: any;
  assessments: ComplianceAssessment[];
  violations: any;
  trends: any;
  recommendations: ComplianceRecommendation[];
} 