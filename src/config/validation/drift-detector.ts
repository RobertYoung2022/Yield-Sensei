/**
 * Configuration Drift Detector
 * 
 * Monitors configuration changes, detects drift from baseline configurations,
 * and provides alerts for unauthorized or unexpected changes.
 */

import { EventEmitter } from 'events';
import { createHash } from 'crypto';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { ConfigValidator, ConfigSnapshot, ValidationResult } from './config-validator';

export interface DriftDetectionConfig {
  baselinePath: string;
  checkInterval: number; // milliseconds
  alertThreshold: number; // number of changes to trigger alert
  ignorePatterns: string[];
  notificationChannels: NotificationChannel[];
  autoCorrect: boolean;
  environment: string;
}

export interface NotificationChannel {
  type: 'console' | 'file' | 'webhook' | 'email';
  config: Record<string, any>;
}

export interface DriftEvent {
  id: string;
  timestamp: Date;
  environment: string;
  type: 'drift' | 'unauthorized' | 'validation_failure' | 'restored';
  severity: 'low' | 'medium' | 'high' | 'critical';
  changes: DriftChange[];
  snapshot: ConfigSnapshot;
  metadata: Record<string, any>;
}

export interface DriftChange {
  path: string;
  baselineValue: any;
  currentValue: any;
  type: 'added' | 'removed' | 'modified';
  risk: 'low' | 'medium' | 'high';
  description: string;
}

export interface DriftReport {
  id: string;
  generatedAt: Date;
  environment: string;
  baselineSnapshot: ConfigSnapshot;
  currentSnapshot: ConfigSnapshot;
  driftDetected: boolean;
  changes: DriftChange[];
  riskAssessment: RiskAssessment;
  recommendations: string[];
}

export interface RiskAssessment {
  overallRisk: 'low' | 'medium' | 'high' | 'critical';
  securityRisk: number; // 0-100
  stabilityRisk: number; // 0-100
  complianceRisk: number; // 0-100
  details: string[];
}

export class DriftDetector extends EventEmitter {
  private config: DriftDetectionConfig;
  private validator: ConfigValidator;
  private baseline: ConfigSnapshot | null = null;
  private checkInterval: NodeJS.Timeout | null = null;
  private driftHistory: DriftEvent[] = [];
  private criticalPaths: Set<string>;

  constructor(config: DriftDetectionConfig, validator: ConfigValidator) {
    super();
    this.config = config;
    this.validator = validator;
    this.criticalPaths = new Set([
      'security.jwt.secret',
      'security.encryption.key',
      'database.postgres.password',
      'database.clickhouse.password',
      'database.redis.password',
      'api.server.port',
      'security.cors.origin'
    ]);
    
    this.loadBaseline();
  }

  /**
   * Start drift detection monitoring
   */
  start(): void {
    if (this.checkInterval) {
      this.stop();
    }

    console.log(`🔍 Starting drift detection (interval: ${this.config.checkInterval}ms)`);
    
    // Initial check
    this.checkForDrift();

    // Schedule periodic checks
    this.checkInterval = setInterval(() => {
      this.checkForDrift();
    }, this.config.checkInterval);
  }

  /**
   * Stop drift detection monitoring
   */
  stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
      console.log('🛑 Drift detection stopped');
    }
  }

  /**
   * Load baseline configuration
   */
  private loadBaseline(): void {
    try {
      if (existsSync(this.config.baselinePath)) {
        const data = readFileSync(this.config.baselinePath, 'utf8');
        this.baseline = JSON.parse(data);
        console.log(`✅ Baseline configuration loaded from ${this.config.baselinePath}`);
      } else {
        console.warn(`⚠️ No baseline found at ${this.config.baselinePath}`);
      }
    } catch (error) {
      console.error('❌ Failed to load baseline:', error);
    }
  }

  /**
   * Save baseline configuration
   */
  saveBaseline(config: Record<string, any>): void {
    const snapshot = this.validator.createSnapshot(config, {
      savedBy: 'drift-detector',
      environment: this.config.environment
    });

    // Ensure directory exists
    const dir = join(this.config.baselinePath, '..');
    mkdirSync(dir, { recursive: true });

    writeFileSync(
      this.config.baselinePath,
      JSON.stringify(snapshot, null, 2)
    );

    this.baseline = snapshot;
    console.log(`✅ Baseline configuration saved to ${this.config.baselinePath}`);
  }

  /**
   * Check for configuration drift
   */
  async checkForDrift(currentConfig?: Record<string, any>): Promise<DriftReport | null> {
    if (!this.baseline) {
      console.warn('⚠️ No baseline configuration to compare against');
      return null;
    }

    // Get current configuration if not provided
    if (!currentConfig) {
      try {
        currentConfig = await this.loadCurrentConfig();
      } catch (error) {
        console.error('❌ Failed to load current configuration:', error);
        return null;
      }
    }

    // Create snapshot of current config
    const currentSnapshot = this.validator.createSnapshot(currentConfig);

    // Compare snapshots
    const comparison = this.validator.compareSnapshots(this.baseline, currentSnapshot);

    if (!comparison.identical) {
      // Filter out ignored patterns
      const significantChanges = this.filterChanges(comparison.differences);

      if (significantChanges.length > 0) {
        // Assess risk of changes
        const driftChanges = this.assessChanges(significantChanges);
        const riskAssessment = this.assessOverallRisk(driftChanges);

        // Create drift event
        const driftEvent: DriftEvent = {
          id: this.generateEventId(),
          timestamp: new Date(),
          environment: this.config.environment,
          type: 'drift',
          severity: riskAssessment.overallRisk,
          changes: driftChanges,
          snapshot: currentSnapshot,
          metadata: {
            baselineHash: this.baseline.hash,
            currentHash: currentSnapshot.hash
          }
        };

        // Record event
        this.recordEvent(driftEvent);

        // Generate report
        const report: DriftReport = {
          id: driftEvent.id,
          generatedAt: new Date(),
          environment: this.config.environment,
          baselineSnapshot: this.baseline,
          currentSnapshot,
          driftDetected: true,
          changes: driftChanges,
          riskAssessment,
          recommendations: this.generateRecommendations(driftChanges, riskAssessment)
        };

        // Emit drift event
        this.emit('drift', driftEvent);

        // Send notifications
        await this.sendNotifications(driftEvent, report);

        // Auto-correct if enabled
        if (this.config.autoCorrect && riskAssessment.overallRisk !== 'critical') {
          await this.attemptAutoCorrect(driftChanges);
        }

        return report;
      }
    }

    return null;
  }

  /**
   * Filter changes based on ignore patterns
   */
  private filterChanges(changes: Array<any>): Array<any> {
    return changes.filter(change => {
      for (const pattern of this.config.ignorePatterns) {
        const regex = new RegExp(pattern);
        if (regex.test(change.path)) {
          return false;
        }
      }
      return true;
    });
  }

  /**
   * Assess changes and assign risk levels
   */
  private assessChanges(changes: Array<any>): DriftChange[] {
    return changes.map(change => {
      const risk = this.assessChangeRisk(change);
      const description = this.generateChangeDescription(change);

      return {
        path: change.path,
        baselineValue: change.oldValue,
        currentValue: change.newValue,
        type: change.type,
        risk,
        description
      };
    });
  }

  /**
   * Assess risk level of a specific change
   */
  private assessChangeRisk(change: any): 'low' | 'medium' | 'high' {
    // Critical paths are always high risk
    if (this.criticalPaths.has(change.path)) {
      return 'high';
    }

    // Security-related paths
    if (change.path.includes('security') || 
        change.path.includes('auth') || 
        change.path.includes('password') ||
        change.path.includes('secret') ||
        change.path.includes('key')) {
      return 'high';
    }

    // Database configuration changes
    if (change.path.includes('database')) {
      return 'medium';
    }

    // Production environment changes
    if (this.config.environment === 'production') {
      return change.type === 'removed' ? 'high' : 'medium';
    }

    return 'low';
  }

  /**
   * Generate human-readable change description
   */
  private generateChangeDescription(change: any): string {
    const pathParts = change.path.split('.');
    const component = pathParts[0];
    const property = pathParts[pathParts.length - 1];

    switch (change.type) {
      case 'added':
        return `New ${property} added to ${component} configuration`;
      case 'removed':
        return `${property} removed from ${component} configuration`;
      case 'modified':
        return `${property} in ${component} changed from ${JSON.stringify(change.oldValue)} to ${JSON.stringify(change.newValue)}`;
      default:
        return `Unknown change to ${change.path}`;
    }
  }

  /**
   * Assess overall risk of all changes
   */
  private assessOverallRisk(changes: DriftChange[]): RiskAssessment {
    const highRiskCount = changes.filter(c => c.risk === 'high').length;
    const mediumRiskCount = changes.filter(c => c.risk === 'medium').length;
    
    let overallRisk: 'low' | 'medium' | 'high' | 'critical' = 'low';
    
    if (highRiskCount >= 3 || changes.length >= this.config.alertThreshold * 2) {
      overallRisk = 'critical';
    } else if (highRiskCount >= 1) {
      overallRisk = 'high';
    } else if (mediumRiskCount >= 3) {
      overallRisk = 'medium';
    }

    // Calculate specific risk scores
    const securityRisk = this.calculateSecurityRisk(changes);
    const stabilityRisk = this.calculateStabilityRisk(changes);
    const complianceRisk = this.calculateComplianceRisk(changes);

    const details: string[] = [];
    
    if (securityRisk > 70) {
      details.push('High security risk: Critical security configurations have been modified');
    }
    if (stabilityRisk > 70) {
      details.push('High stability risk: Core system configurations have changed');
    }
    if (complianceRisk > 70) {
      details.push('High compliance risk: Audit-related configurations have been modified');
    }

    return {
      overallRisk,
      securityRisk,
      stabilityRisk,
      complianceRisk,
      details
    };
  }

  /**
   * Calculate security risk score
   */
  private calculateSecurityRisk(changes: DriftChange[]): number {
    let score = 0;
    
    for (const change of changes) {
      if (change.path.includes('security') || 
          change.path.includes('auth') || 
          change.path.includes('jwt') ||
          change.path.includes('encryption')) {
        score += change.risk === 'high' ? 30 : change.risk === 'medium' ? 15 : 5;
      }
    }

    return Math.min(score, 100);
  }

  /**
   * Calculate stability risk score
   */
  private calculateStabilityRisk(changes: DriftChange[]): number {
    let score = 0;
    
    for (const change of changes) {
      if (change.path.includes('database') || 
          change.path.includes('api.server') || 
          change.path.includes('redis')) {
        score += change.risk === 'high' ? 25 : change.risk === 'medium' ? 12 : 3;
      }
      
      if (change.type === 'removed') {
        score += 10;
      }
    }

    return Math.min(score, 100);
  }

  /**
   * Calculate compliance risk score
   */
  private calculateComplianceRisk(changes: DriftChange[]): number {
    let score = 0;
    
    for (const change of changes) {
      if (change.path.includes('monitoring') || 
          change.path.includes('logging') || 
          change.path.includes('audit')) {
        score += 20;
      }
      
      if (this.config.environment === 'production' && change.risk === 'high') {
        score += 15;
      }
    }

    return Math.min(score, 100);
  }

  /**
   * Generate recommendations based on changes
   */
  private generateRecommendations(changes: DriftChange[], risk: RiskAssessment): string[] {
    const recommendations: string[] = [];

    if (risk.overallRisk === 'critical') {
      recommendations.push('🚨 IMMEDIATE ACTION REQUIRED: Review and validate all configuration changes');
      recommendations.push('🔒 Verify that security configurations have not been compromised');
    }

    if (risk.securityRisk > 50) {
      recommendations.push('🔐 Review all security-related configuration changes');
      recommendations.push('🔑 Rotate all affected secrets and keys immediately');
      recommendations.push('📊 Audit access logs for unauthorized configuration access');
    }

    if (risk.stabilityRisk > 50) {
      recommendations.push('⚡ Test system stability with new configurations');
      recommendations.push('🔄 Prepare rollback plan for database configuration changes');
      recommendations.push('📈 Monitor system performance closely for the next 24 hours');
    }

    if (risk.complianceRisk > 50) {
      recommendations.push('📋 Update compliance documentation with configuration changes');
      recommendations.push('✅ Verify that logging and monitoring are still functional');
    }

    // Specific recommendations based on changes
    for (const change of changes) {
      if (change.path.includes('cors') && change.risk === 'high') {
        recommendations.push('🌐 Review CORS policy changes for security implications');
      }
      if (change.path.includes('rateLimit')) {
        recommendations.push('🚦 Verify rate limiting is still protecting against abuse');
      }
      if (change.type === 'removed' && change.risk === 'high') {
        recommendations.push(`⚠️ Critical configuration removed: ${change.path} - verify this is intentional`);
      }
    }

    return [...new Set(recommendations)]; // Remove duplicates
  }

  /**
   * Send notifications about drift
   */
  private async sendNotifications(event: DriftEvent, report: DriftReport): Promise<void> {
    for (const channel of this.config.notificationChannels) {
      try {
        switch (channel.type) {
          case 'console':
            this.notifyConsole(event, report);
            break;
          case 'file':
            await this.notifyFile(event, report, channel.config);
            break;
          case 'webhook':
            await this.notifyWebhook(event, report, channel.config);
            break;
          case 'email':
            await this.notifyEmail(event, report, channel.config);
            break;
        }
      } catch (error) {
        console.error(`Failed to send notification via ${channel.type}:`, error);
      }
    }
  }

  /**
   * Console notification
   */
  private notifyConsole(event: DriftEvent, report: DriftReport): void {
    console.warn('\n🚨 CONFIGURATION DRIFT DETECTED 🚨');
    console.warn(`Environment: ${event.environment}`);
    console.warn(`Severity: ${event.severity.toUpperCase()}`);
    console.warn(`Changes: ${event.changes.length}`);
    console.warn(`Risk Assessment: ${report.riskAssessment.overallRisk.toUpperCase()}`);
    
    console.warn('\nChanges:');
    for (const change of event.changes) {
      const emoji = change.risk === 'high' ? '❌' : change.risk === 'medium' ? '⚠️' : 'ℹ️';
      console.warn(`${emoji} [${change.risk.toUpperCase()}] ${change.description}`);
    }
    
    if (report.recommendations.length > 0) {
      console.warn('\nRecommendations:');
      for (const recommendation of report.recommendations) {
        console.warn(recommendation);
      }
    }
  }

  /**
   * File notification
   */
  private async notifyFile(event: DriftEvent, report: DriftReport, config: any): Promise<void> {
    const filepath = config.path || './drift-reports';
    const filename = `drift-${event.id}-${event.timestamp.getTime()}.json`;
    const fullPath = join(filepath, filename);

    mkdirSync(filepath, { recursive: true });
    
    writeFileSync(fullPath, JSON.stringify({
      event,
      report
    }, null, 2));

    console.log(`📄 Drift report saved to: ${fullPath}`);
  }

  /**
   * Webhook notification
   */
  private async notifyWebhook(event: DriftEvent, report: DriftReport, config: any): Promise<void> {
    // Implementation would send HTTP POST to configured webhook
    console.log(`🔔 Webhook notification would be sent to: ${config.url}`);
  }

  /**
   * Email notification
   */
  private async notifyEmail(event: DriftEvent, report: DriftReport, config: any): Promise<void> {
    // Implementation would send email via configured service
    console.log(`📧 Email notification would be sent to: ${config.to}`);
  }

  /**
   * Attempt automatic correction
   */
  private async attemptAutoCorrect(changes: DriftChange[]): Promise<void> {
    console.log('🔧 Attempting automatic correction...');
    
    // Only correct low-risk changes
    const correctableChanges = changes.filter(c => c.risk === 'low');
    
    if (correctableChanges.length === 0) {
      console.log('⚠️ No low-risk changes available for auto-correction');
      return;
    }

    // Implementation would restore baseline values for correctable changes
    console.log(`✅ Would correct ${correctableChanges.length} low-risk changes`);
    
    this.emit('corrected', {
      changes: correctableChanges,
      timestamp: new Date()
    });
  }

  /**
   * Load current configuration
   */
  private async loadCurrentConfig(): Promise<Record<string, any>> {
    // This would be implemented to load the actual current configuration
    // For now, we'll throw an error to indicate it needs implementation
    throw new Error('loadCurrentConfig must be implemented for your specific configuration source');
  }

  /**
   * Record drift event
   */
  private recordEvent(event: DriftEvent): void {
    this.driftHistory.push(event);
    
    // Keep only last 1000 events
    if (this.driftHistory.length > 1000) {
      this.driftHistory = this.driftHistory.slice(-1000);
    }
  }

  /**
   * Get drift history
   */
  getDriftHistory(filter?: {
    startDate?: Date;
    endDate?: Date;
    severity?: string;
    environment?: string;
  }): DriftEvent[] {
    let history = [...this.driftHistory];

    if (filter) {
      if (filter.startDate) {
        history = history.filter(e => e.timestamp >= filter.startDate!);
      }
      if (filter.endDate) {
        history = history.filter(e => e.timestamp <= filter.endDate!);
      }
      if (filter.severity) {
        history = history.filter(e => e.severity === filter.severity);
      }
      if (filter.environment) {
        history = history.filter(e => e.environment === filter.environment);
      }
    }

    return history;
  }

  /**
   * Generate drift history report
   */
  generateHistoryReport(): string {
    let report = `# Configuration Drift History Report\n\n`;
    report += `**Generated:** ${new Date().toISOString()}\n`;
    report += `**Total Events:** ${this.driftHistory.length}\n\n`;

    const severityCounts = this.driftHistory.reduce((acc, event) => {
      acc[event.severity] = (acc[event.severity] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    report += `## Summary by Severity\n\n`;
    for (const [severity, count] of Object.entries(severityCounts)) {
      report += `- ${severity.toUpperCase()}: ${count}\n`;
    }

    report += `\n## Recent Events (Last 10)\n\n`;
    const recentEvents = this.driftHistory.slice(-10).reverse();
    
    for (const event of recentEvents) {
      report += `### ${event.id}\n`;
      report += `- **Time:** ${event.timestamp.toISOString()}\n`;
      report += `- **Severity:** ${event.severity}\n`;
      report += `- **Changes:** ${event.changes.length}\n`;
      report += `- **Type:** ${event.type}\n\n`;
    }

    return report;
  }

  /**
   * Generate unique event ID
   */
  private generateEventId(): string {
    return `drift_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}