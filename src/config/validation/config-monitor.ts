/**
 * Configuration Monitor
 * 
 * Integrates configuration validation, drift detection, and real-time monitoring
 * to ensure configuration integrity and compliance.
 */

import { EventEmitter } from 'events';
import { ConfigValidator, ValidationResult, ConfigSnapshot } from './config-validator';
import { DriftDetector, DriftDetectionConfig, DriftReport, DriftEvent } from './drift-detector';
import { loadConfiguration, LoadedConfig } from '../config-loader';
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import * as cron from 'node-cron';

export interface MonitorConfig {
  validationInterval: number; // milliseconds
  driftCheckInterval: number; // milliseconds
  baselinePath: string;
  reportPath: string;
  alerting: AlertingConfig;
  persistence: PersistenceConfig;
  schedules: ScheduleConfig[];
}

export interface AlertingConfig {
  enabled: boolean;
  channels: AlertChannel[];
  thresholds: {
    errorCount: number;
    warningCount: number;
    driftSeverity: 'low' | 'medium' | 'high' | 'critical';
  };
}

export interface AlertChannel {
  type: 'console' | 'file' | 'webhook' | 'slack' | 'pagerduty';
  config: Record<string, any>;
  severity: ('low' | 'medium' | 'high' | 'critical')[];
}

export interface PersistenceConfig {
  enabled: boolean;
  retentionDays: number;
  compressOldReports: boolean;
}

export interface ScheduleConfig {
  name: string;
  cron: string;
  action: 'validate' | 'drift-check' | 'report' | 'backup';
  config?: Record<string, any>;
}

export interface MonitorStatus {
  running: boolean;
  lastValidation: Date | null;
  lastDriftCheck: Date | null;
  currentConfig: LoadedConfig | null;
  validationResult: ValidationResult | null;
  driftReport: DriftReport | null;
  uptime: number;
  statistics: MonitorStatistics;
}

export interface MonitorStatistics {
  totalValidations: number;
  failedValidations: number;
  totalDriftChecks: number;
  driftDetections: number;
  alerts: number;
  lastAlert: Date | null;
}

export class ConfigMonitor extends EventEmitter {
  private config: MonitorConfig;
  private validator: ConfigValidator;
  private driftDetector: DriftDetector;
  private status: MonitorStatus;
  private validationInterval: NodeJS.Timeout | null = null;
  private scheduledTasks: Map<string, cron.ScheduledTask> = new Map();
  private startTime: Date;

  constructor(config: MonitorConfig) {
    super();
    this.config = config;
    this.validator = new ConfigValidator();
    
    // Initialize drift detector
    const driftConfig: DriftDetectionConfig = {
      baselinePath: config.baselinePath,
      checkInterval: config.driftCheckInterval,
      alertThreshold: config.alerting.thresholds.errorCount,
      ignorePatterns: [
        'monitoring.performance.metricsInterval',
        'api.server.timeout',
        '.*\\.cache.*'
      ],
      notificationChannels: config.alerting.channels.map(channel => ({
        type: channel.type as any,
        config: channel.config
      })),
      autoCorrect: false,
      environment: process.env.NODE_ENV || 'development'
    };
    
    this.driftDetector = new DriftDetector(driftConfig, this.validator);
    this.startTime = new Date();
    
    this.status = {
      running: false,
      lastValidation: null,
      lastDriftCheck: null,
      currentConfig: null,
      validationResult: null,
      driftReport: null,
      uptime: 0,
      statistics: {
        totalValidations: 0,
        failedValidations: 0,
        totalDriftChecks: 0,
        driftDetections: 0,
        alerts: 0,
        lastAlert: null
      }
    };

    this.setupEventHandlers();
  }

  /**
   * Setup event handlers
   */
  private setupEventHandlers(): void {
    // Handle drift detection events
    this.driftDetector.on('drift', (event: DriftEvent) => {
      this.handleDriftEvent(event);
    });

    this.driftDetector.on('corrected', (data: any) => {
      console.log('✅ Configuration auto-corrected:', data);
      this.emit('corrected', data);
    });

    // Handle process signals
    process.on('SIGINT', () => this.stop());
    process.on('SIGTERM', () => this.stop());
  }

  /**
   * Start configuration monitoring
   */
  async start(): Promise<void> {
    if (this.status.running) {
      console.warn('⚠️ Configuration monitor is already running');
      return;
    }

    console.log('🚀 Starting configuration monitor...');
    
    try {
      // Load and validate initial configuration
      await this.performValidation();
      
      // Start drift detection
      this.driftDetector.start();
      
      // Start validation interval
      this.validationInterval = setInterval(() => {
        this.performValidation();
      }, this.config.validationInterval);
      
      // Setup scheduled tasks
      this.setupScheduledTasks();
      
      this.status.running = true;
      console.log('✅ Configuration monitor started successfully');
      
      this.emit('started');
    } catch (error) {
      console.error('❌ Failed to start configuration monitor:', error);
      throw error;
    }
  }

  /**
   * Stop configuration monitoring
   */
  stop(): void {
    if (!this.status.running) {
      return;
    }

    console.log('🛑 Stopping configuration monitor...');
    
    // Stop validation interval
    if (this.validationInterval) {
      clearInterval(this.validationInterval);
      this.validationInterval = null;
    }
    
    // Stop drift detector
    this.driftDetector.stop();
    
    // Stop scheduled tasks
    for (const [name, task] of this.scheduledTasks.entries()) {
      task.stop();
      console.log(`⏹️ Stopped scheduled task: ${name}`);
    }
    this.scheduledTasks.clear();
    
    this.status.running = false;
    console.log('✅ Configuration monitor stopped');
    
    this.emit('stopped');
  }

  /**
   * Perform configuration validation
   */
  private async performValidation(): Promise<void> {
    try {
      console.log('🔍 Performing configuration validation...');
      
      // Load current configuration
      const loaded = loadConfiguration();
      this.status.currentConfig = loaded;
      
      // Validate configuration
      const result = this.validator.validate(
        loaded.config,
        loaded.validation.environment
      );
      
      this.status.validationResult = result;
      this.status.lastValidation = new Date();
      this.status.statistics.totalValidations++;
      
      if (!result.valid) {
        this.status.statistics.failedValidations++;
        await this.handleValidationFailure(result);
      }
      
      // Check for drift
      const driftReport = await this.driftDetector.checkForDrift(loaded.config);
      if (driftReport) {
        this.status.driftReport = driftReport;
        this.status.lastDriftCheck = new Date();
        this.status.statistics.totalDriftChecks++;
        this.status.statistics.driftDetections++;
      }
      
      // Update status
      this.updateStatus();
      
      // Save validation results if persistence is enabled
      if (this.config.persistence.enabled) {
        await this.persistValidationResults(result, driftReport);
      }
      
      this.emit('validated', { result, driftReport });
      
    } catch (error) {
      console.error('❌ Validation error:', error);
      this.emit('error', error);
    }
  }

  /**
   * Handle validation failure
   */
  private async handleValidationFailure(result: ValidationResult): Promise<void> {
    console.error('❌ Configuration validation failed');
    console.error(`Errors: ${result.errors.length}, Warnings: ${result.warnings.length}`);
    
    // Check if we should send alerts
    if (this.shouldSendAlert(result)) {
      await this.sendAlert({
        type: 'validation_failure',
        severity: this.determineSeverity(result),
        title: 'Configuration Validation Failed',
        message: `${result.errors.length} errors, ${result.warnings.length} warnings detected`,
        details: result,
        timestamp: new Date()
      });
    }
    
    this.emit('validation-failed', result);
  }

  /**
   * Handle drift event
   */
  private async handleDriftEvent(event: DriftEvent): Promise<void> {
    console.warn('🚨 Configuration drift detected:', event.id);
    
    // Check if we should send alerts
    if (this.config.alerting.enabled && 
        this.meetsAlertThreshold(event.severity)) {
      await this.sendAlert({
        type: 'drift_detected',
        severity: event.severity,
        title: 'Configuration Drift Detected',
        message: `${event.changes.length} configuration changes detected`,
        details: event,
        timestamp: new Date()
      });
    }
    
    this.emit('drift-detected', event);
  }

  /**
   * Setup scheduled tasks
   */
  private setupScheduledTasks(): void {
    for (const schedule of this.config.schedules) {
      try {
        const task = cron.schedule(schedule.cron, async () => {
          console.log(`⏰ Running scheduled task: ${schedule.name}`);
          
          switch (schedule.action) {
            case 'validate':
              await this.performValidation();
              break;
            case 'drift-check':
              await this.driftDetector.checkForDrift();
              break;
            case 'report':
              await this.generateScheduledReport(schedule.config);
              break;
            case 'backup':
              await this.backupConfiguration(schedule.config);
              break;
          }
        });
        
        this.scheduledTasks.set(schedule.name, task);
        console.log(`📅 Scheduled task registered: ${schedule.name} (${schedule.cron})`);
        
      } catch (error) {
        console.error(`Failed to setup scheduled task ${schedule.name}:`, error);
      }
    }
  }

  /**
   * Generate scheduled report
   */
  private async generateScheduledReport(config?: any): Promise<void> {
    const report = await this.generateReport();
    
    const filename = `config-report-${new Date().toISOString().split('T')[0]}.md`;
    const filepath = join(this.config.reportPath, filename);
    
    mkdirSync(this.config.reportPath, { recursive: true });
    writeFileSync(filepath, report);
    
    console.log(`📄 Scheduled report saved: ${filepath}`);
  }

  /**
   * Backup configuration
   */
  private async backupConfiguration(config?: any): Promise<void> {
    if (!this.status.currentConfig) {
      console.warn('⚠️ No configuration to backup');
      return;
    }
    
    const backupPath = config?.path || join(this.config.reportPath, 'backups');
    const filename = `config-backup-${new Date().toISOString().replace(/:/g, '-')}.json`;
    const filepath = join(backupPath, filename);
    
    mkdirSync(backupPath, { recursive: true });
    
    const snapshot = this.validator.createSnapshot(this.status.currentConfig.config, {
      backupType: 'scheduled',
      monitor: 'config-monitor'
    });
    
    writeFileSync(filepath, JSON.stringify(snapshot, null, 2));
    console.log(`💾 Configuration backup saved: ${filepath}`);
    
    // Clean old backups if retention is configured
    if (this.config.persistence.retentionDays > 0) {
      await this.cleanOldBackups(backupPath);
    }
  }

  /**
   * Clean old backups
   */
  private async cleanOldBackups(backupPath: string): Promise<void> {
    // Implementation would scan directory and remove old files
    console.log(`🧹 Cleaning backups older than ${this.config.persistence.retentionDays} days`);
  }

  /**
   * Update monitor status
   */
  private updateStatus(): void {
    this.status.uptime = Date.now() - this.startTime.getTime();
  }

  /**
   * Determine if alert should be sent
   */
  private shouldSendAlert(result: ValidationResult): boolean {
    if (!this.config.alerting.enabled) {
      return false;
    }
    
    return result.errors.length >= this.config.alerting.thresholds.errorCount ||
           result.warnings.length >= this.config.alerting.thresholds.warningCount;
  }

  /**
   * Determine severity from validation result
   */
  private determineSeverity(result: ValidationResult): 'low' | 'medium' | 'high' | 'critical' {
    if (result.errors.length >= 5) return 'critical';
    if (result.errors.length >= 3) return 'high';
    if (result.errors.length >= 1) return 'medium';
    return 'low';
  }

  /**
   * Check if severity meets alert threshold
   */
  private meetsAlertThreshold(severity: 'low' | 'medium' | 'high' | 'critical'): boolean {
    const severityLevels = { low: 0, medium: 1, high: 2, critical: 3 };
    const threshold = severityLevels[this.config.alerting.thresholds.driftSeverity];
    const current = severityLevels[severity];
    return current >= threshold;
  }

  /**
   * Send alert
   */
  private async sendAlert(alert: any): Promise<void> {
    this.status.statistics.alerts++;
    this.status.statistics.lastAlert = new Date();
    
    for (const channel of this.config.alerting.channels) {
      if (channel.severity.includes(alert.severity)) {
        try {
          await this.sendAlertToChannel(alert, channel);
        } catch (error) {
          console.error(`Failed to send alert via ${channel.type}:`, error);
        }
      }
    }
    
    this.emit('alert', alert);
  }

  /**
   * Send alert to specific channel
   */
  private async sendAlertToChannel(alert: any, channel: AlertChannel): Promise<void> {
    switch (channel.type) {
      case 'console':
        console.error(`\n🚨 ALERT: ${alert.title}`);
        console.error(`Severity: ${alert.severity.toUpperCase()}`);
        console.error(`Message: ${alert.message}`);
        break;
        
      case 'file':
        const alertPath = channel.config.path || './alerts';
        const filename = `alert-${alert.timestamp.getTime()}.json`;
        mkdirSync(alertPath, { recursive: true });
        writeFileSync(join(alertPath, filename), JSON.stringify(alert, null, 2));
        break;
        
      case 'webhook':
        // Implementation would send HTTP POST
        console.log(`🔔 Webhook alert would be sent to: ${channel.config.url}`);
        break;
        
      case 'slack':
        // Implementation would use Slack API
        console.log(`💬 Slack alert would be sent to: ${channel.config.channel}`);
        break;
        
      case 'pagerduty':
        // Implementation would use PagerDuty API
        console.log(`📟 PagerDuty alert would be created`);
        break;
    }
  }

  /**
   * Persist validation results
   */
  private async persistValidationResults(
    result: ValidationResult,
    driftReport: DriftReport | null
  ): Promise<void> {
    const timestamp = new Date().toISOString();
    const resultPath = join(this.config.reportPath, 'validation-results');
    const filename = `validation-${timestamp.replace(/:/g, '-')}.json`;
    
    mkdirSync(resultPath, { recursive: true });
    
    writeFileSync(
      join(resultPath, filename),
      JSON.stringify({
        timestamp,
        validationResult: result,
        driftReport
      }, null, 2)
    );
  }

  /**
   * Get monitor status
   */
  getStatus(): MonitorStatus {
    this.updateStatus();
    return { ...this.status };
  }

  /**
   * Generate comprehensive report
   */
  async generateReport(): Promise<string> {
    let report = `# Configuration Monitor Report\n\n`;
    report += `**Generated:** ${new Date().toISOString()}\n`;
    report += `**Environment:** ${process.env.NODE_ENV || 'development'}\n`;
    report += `**Status:** ${this.status.running ? '🟢 Running' : '🔴 Stopped'}\n`;
    report += `**Uptime:** ${Math.floor(this.status.uptime / 1000 / 60)} minutes\n\n`;
    
    report += `## Statistics\n\n`;
    report += `- Total Validations: ${this.status.statistics.totalValidations}\n`;
    report += `- Failed Validations: ${this.status.statistics.failedValidations}\n`;
    report += `- Total Drift Checks: ${this.status.statistics.totalDriftChecks}\n`;
    report += `- Drift Detections: ${this.status.statistics.driftDetections}\n`;
    report += `- Alerts Sent: ${this.status.statistics.alerts}\n`;
    
    if (this.status.statistics.lastAlert) {
      report += `- Last Alert: ${this.status.statistics.lastAlert.toISOString()}\n`;
    }
    
    if (this.status.validationResult) {
      report += `\n## Latest Validation Result\n\n`;
      report += this.validator.generateReport(this.status.validationResult);
    }
    
    if (this.status.driftReport) {
      report += `\n## Latest Drift Report\n\n`;
      report += `- Drift Detected: ${this.status.driftReport.driftDetected ? 'Yes' : 'No'}\n`;
      report += `- Changes: ${this.status.driftReport.changes.length}\n`;
      report += `- Overall Risk: ${this.status.driftReport.riskAssessment.overallRisk.toUpperCase()}\n`;
      
      if (this.status.driftReport.recommendations.length > 0) {
        report += `\n### Recommendations\n\n`;
        for (const rec of this.status.driftReport.recommendations) {
          report += `- ${rec}\n`;
        }
      }
    }
    
    // Add drift history
    report += `\n${this.driftDetector.generateHistoryReport()}`;
    
    return report;
  }

  /**
   * Create configuration baseline
   */
  createBaseline(config?: Record<string, any>): void {
    const configToUse = config || this.status.currentConfig?.config;
    
    if (!configToUse) {
      throw new Error('No configuration available to create baseline');
    }
    
    this.driftDetector.saveBaseline(configToUse);
    console.log('✅ Configuration baseline created');
  }

  /**
   * Validate specific configuration
   */
  async validateConfig(config: Record<string, any>): Promise<ValidationResult> {
    return this.validator.validate(config, process.env.NODE_ENV);
  }

  /**
   * Check for drift in specific configuration
   */
  async checkDrift(config: Record<string, any>): Promise<DriftReport | null> {
    return this.driftDetector.checkForDrift(config);
  }
}