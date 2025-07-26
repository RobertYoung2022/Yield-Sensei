/**
 * Alert Manager
 * Manages compliance alerts, escalation, and notification delivery
 */

import { EventEmitter } from 'events';
import Logger from '../../shared/logging/logger';
import {
  ComplianceAlert,
  AlertConfig,
  AlertChannelConfig,
  EscalationConfig,
  ComplianceFlag,
  RiskLevel,
  Jurisdiction
} from '../types';

const logger = Logger.getLogger('alert-manager');

interface AlertDeliveryResult {
  channel: string;
  success: boolean;
  deliveredAt?: Date;
  error?: string;
}

interface EscalationTimer {
  alertId: string;
  level: number;
  scheduledAt: Date;
  timeout: NodeJS.Timeout;
}

interface AlertMetrics {
  totalAlerts: number;
  alertsByType: Record<string, number>;
  alertsBySeverity: Record<RiskLevel, number>;
  deliverySuccessRate: number;
  averageResponseTime: number;
  escalatedAlerts: number;
}

export class AlertManager extends EventEmitter {
  private config: AlertConfig;
  private isInitialized = false;
  private isRunning = false;
  private activeAlerts: Map<string, ComplianceAlert> = new Map();
  private escalationTimers: Map<string, EscalationTimer> = new Map();
  private suppressedAlerts: Set<string> = new Set();
  private metrics: AlertMetrics;

  constructor(config: AlertConfig) {
    super();
    this.config = config;
    this.metrics = {
      totalAlerts: 0,
      alertsByType: {},
      alertsBySeverity: { low: 0, medium: 0, high: 0, critical: 0 },
      deliverySuccessRate: 0,
      averageResponseTime: 0,
      escalatedAlerts: 0
    };
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.warn('Alert Manager already initialized');
      return;
    }

    try {
      logger.info('Initializing Alert Manager...');

      // Validate channel configurations
      await this.validateChannelConfigurations();

      // Set up periodic cleanup
      setInterval(() => this.cleanupResolvedAlerts(), 60 * 60 * 1000); // Every hour

      this.isInitialized = true;
      logger.info('✅ Alert Manager initialized successfully');

    } catch (error) {
      logger.error('Failed to initialize Alert Manager:', error);
      throw error;
    }
  }

  async start(): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('Alert Manager must be initialized before starting');
    }

    if (this.isRunning) {
      logger.warn('Alert Manager already running');
      return;
    }

    this.isRunning = true;
    logger.info('🚀 Alert Manager started successfully');
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      logger.warn('Alert Manager is not running');
      return;
    }

    // Clear all escalation timers
    for (const timer of this.escalationTimers.values()) {
      clearTimeout(timer.timeout);
    }
    this.escalationTimers.clear();

    this.isRunning = false;
    logger.info('🛑 Alert Manager stopped successfully');
  }

  async updateConfiguration(newConfig: AlertConfig): Promise<void> {
    this.config = newConfig;
    await this.validateChannelConfigurations();
    logger.info('Alert Manager configuration updated');
  }

  /**
   * Trigger a new compliance alert
   */
  async triggerAlert(alert: ComplianceAlert): Promise<void> {
    try {
      logger.info('Triggering compliance alert', {
        alertId: alert.id,
        type: alert.type,
        severity: alert.severity,
        entityType: alert.entityType,
        entityId: alert.entityId
      });

      // Check if alert should be suppressed
      if (await this.shouldSuppressAlert(alert)) {
        logger.info('Alert suppressed', { alertId: alert.id });
        this.suppressedAlerts.add(alert.id);
        return;
      }

      // Store alert
      this.activeAlerts.set(alert.id, alert);

      // Update metrics
      this.updateAlertMetrics(alert);

      // Deliver alert to appropriate channels
      const deliveryResults = await this.deliverAlert(alert);

      // Set up escalation if enabled
      if (this.config.escalation.enabled) {
        this.setupEscalation(alert);
      }

      // Emit alert triggered event
      this.emit('alert_triggered', {
        alert,
        deliveryResults,
        timestamp: new Date()
      });

      logger.info('Alert triggered successfully', {
        alertId: alert.id,
        deliveredChannels: deliveryResults.filter(r => r.success).length,
        failedChannels: deliveryResults.filter(r => !r.success).length
      });

    } catch (error) {
      logger.error('Error triggering alert:', error);
      throw error;
    }
  }

  /**
   * Update alert status
   */
  async updateAlertStatus(alertId: string, status: 'acknowledged' | 'investigating' | 'resolved' | 'false-positive'): Promise<void> {
    const alert = this.activeAlerts.get(alertId);
    if (!alert) {
      throw new Error(`Alert not found: ${alertId}`);
    }

    const previousStatus = alert.status;
    alert.status = status;

    if (status === 'resolved' || status === 'false-positive') {
      alert.resolvedAt = new Date();
      
      // Cancel escalation if active
      this.cancelEscalation(alertId);
    }

    logger.info('Alert status updated', {
      alertId,
      previousStatus,
      newStatus: status,
      resolvedAt: alert.resolvedAt
    });

    this.emit('alert_status_changed', {
      alertId,
      alert,
      previousStatus,
      newStatus: status,
      timestamp: new Date()
    });
  }

  /**
   * Assign alert to user
   */
  async assignAlert(alertId: string, assignedTo: string): Promise<void> {
    const alert = this.activeAlerts.get(alertId);
    if (!alert) {
      throw new Error(`Alert not found: ${alertId}`);
    }

    alert.assignedTo = assignedTo;

    logger.info('Alert assigned', { alertId, assignedTo });

    this.emit('alert_assigned', {
      alertId,
      alert,
      assignedTo,
      timestamp: new Date()
    });
  }

  /**
   * Get alert by ID
   */
  getAlert(alertId: string): ComplianceAlert | undefined {
    return this.activeAlerts.get(alertId);
  }

  /**
   * Get alerts by criteria
   */
  getAlerts(criteria: {
    status?: string;
    type?: string;
    severity?: RiskLevel;
    entityType?: string;
    jurisdiction?: Jurisdiction;
    assignedTo?: string;
    limit?: number;
  } = {}): ComplianceAlert[] {
    let alerts = Array.from(this.activeAlerts.values());

    // Apply filters
    if (criteria.status) {
      alerts = alerts.filter(alert => alert.status === criteria.status);
    }
    if (criteria.type) {
      alerts = alerts.filter(alert => alert.type === criteria.type);
    }
    if (criteria.severity) {
      alerts = alerts.filter(alert => alert.severity === criteria.severity);
    }
    if (criteria.entityType) {
      alerts = alerts.filter(alert => alert.entityType === criteria.entityType);
    }
    if (criteria.jurisdiction) {
      alerts = alerts.filter(alert => alert.jurisdiction === criteria.jurisdiction);
    }
    if (criteria.assignedTo) {
      alerts = alerts.filter(alert => alert.assignedTo === criteria.assignedTo);
    }

    // Sort by triggered date (newest first)
    alerts.sort((a, b) => b.triggeredAt.getTime() - a.triggeredAt.getTime());

    // Apply limit
    if (criteria.limit) {
      alerts = alerts.slice(0, criteria.limit);
    }

    return alerts;
  }

  /**
   * Get alert metrics
   */
  getMetrics(): AlertMetrics {
    return { ...this.metrics };
  }

  /**
   * Get alert manager status
   */
  getStatus(): any {
    return {
      initialized: this.isInitialized,
      running: this.isRunning,
      activeAlerts: this.activeAlerts.size,
      escalationTimers: this.escalationTimers.size,
      suppressedAlerts: this.suppressedAlerts.size,
      enabledChannels: this.config.channels.filter(c => c.enabled).length,
      escalationEnabled: this.config.escalation.enabled,
      metrics: this.metrics
    };
  }

  // Private methods

  private async validateChannelConfigurations(): Promise<void> {
    for (const channel of this.config.channels) {
      if (channel.enabled) {
        await this.validateChannel(channel);
      }
    }
  }

  private async validateChannel(channel: AlertChannelConfig): Promise<void> {
    switch (channel.type) {
      case 'email':
        if (!channel.endpoint) {
          throw new Error('Email channel requires endpoint');
        }
        break;
      case 'slack':
        if (!channel.endpoint) {
          throw new Error('Slack channel requires webhook URL');
        }
        break;
      case 'webhook':
        if (!channel.endpoint) {
          throw new Error('Webhook channel requires endpoint URL');
        }
        break;
      case 'sms':
        if (!channel.credentials?.apiKey) {
          throw new Error('SMS channel requires API key');
        }
        break;
    }

    logger.debug(`Validated ${channel.type} channel configuration`);
  }

  private async shouldSuppressAlert(alert: ComplianceAlert): Promise<boolean> {
    if (!this.config.suppression.enabled) {
      return false;
    }

    for (const rule of this.config.suppression.rules) {
      if (await this.evaluateSuppressionRule(alert, rule)) {
        logger.debug('Alert suppressed by rule', {
          alertId: alert.id,
          rule: rule.condition,
          reason: rule.reason
        });
        return true;
      }
    }

    return false;
  }

  private async evaluateSuppressionRule(alert: ComplianceAlert, rule: any): Promise<boolean> {
    switch (rule.condition) {
      case 'duplicate_alert_same_entity_1h':
        return this.isDuplicateAlert(alert, rule.duration);
      case 'maintenance_mode':
        return this.isMaintenanceMode();
      default:
        return false;
    }
  }

  private isDuplicateAlert(alert: ComplianceAlert, duration: number): boolean {
    const cutoff = new Date(Date.now() - duration);
    
    for (const existingAlert of this.activeAlerts.values()) {
      if (existingAlert.id !== alert.id &&
          existingAlert.type === alert.type &&
          existingAlert.entityType === alert.entityType &&
          existingAlert.entityId === alert.entityId &&
          existingAlert.triggeredAt > cutoff) {
        return true;
      }
    }

    return false;
  }

  private isMaintenanceMode(): boolean {
    // This would check system maintenance status
    // For now, return false
    return false;
  }

  private async deliverAlert(alert: ComplianceAlert): Promise<AlertDeliveryResult[]> {
    const results: AlertDeliveryResult[] = [];

    for (const channel of this.config.channels) {
      if (!channel.enabled) continue;

      // Check if alert matches channel filters
      if (!this.alertMatchesChannelFilters(alert, channel)) {
        continue;
      }

      try {
        const result = await this.deliverToChannel(alert, channel);
        results.push(result);
      } catch (error) {
        logger.error(`Failed to deliver alert to ${channel.type}:`, error);
        results.push({
          channel: channel.type,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return results;
  }

  private alertMatchesChannelFilters(alert: ComplianceAlert, channel: AlertChannelConfig): boolean {
    for (const filter of channel.filters) {
      // Check severity
      if (!filter.severity.includes(alert.severity)) {
        return false;
      }

      // Check entity type
      if (!filter.entityTypes.includes(alert.entityType)) {
        return false;
      }

      // Check jurisdiction if specified
      if (alert.jurisdiction && !filter.jurisdictions.includes(alert.jurisdiction)) {
        return false;
      }
    }

    return true;
  }

  private async deliverToChannel(alert: ComplianceAlert, channel: AlertChannelConfig): Promise<AlertDeliveryResult> {
    const startTime = Date.now();

    switch (channel.type) {
      case 'email':
        return await this.deliverEmailAlert(alert, channel);
      case 'slack':
        return await this.deliverSlackAlert(alert, channel);
      case 'webhook':
        return await this.deliverWebhookAlert(alert, channel);
      case 'sms':
        return await this.deliverSMSAlert(alert, channel);
      default:
        throw new Error(`Unsupported channel type: ${channel.type}`);
    }
  }

  private async deliverEmailAlert(alert: ComplianceAlert, channel: AlertChannelConfig): Promise<AlertDeliveryResult> {
    // Mock email delivery - would integrate with actual email service
    logger.info('Delivering email alert', { alertId: alert.id });

    // Simulate delivery time
    await new Promise(resolve => setTimeout(resolve, 100));

    return {
      channel: 'email',
      success: true,
      deliveredAt: new Date()
    };
  }

  private async deliverSlackAlert(alert: ComplianceAlert, channel: AlertChannelConfig): Promise<AlertDeliveryResult> {
    // Mock Slack delivery - would integrate with Slack API
    logger.info('Delivering Slack alert', { alertId: alert.id });

    const slackMessage = {
      text: `🚨 Compliance Alert: ${alert.title}`,
      attachments: [
        {
          color: this.getSeverityColor(alert.severity),
          fields: [
            { title: 'Type', value: alert.type, short: true },
            { title: 'Severity', value: alert.severity.toUpperCase(), short: true },
            { title: 'Entity', value: `${alert.entityType}: ${alert.entityId}`, short: true },
            { title: 'Jurisdiction', value: alert.jurisdiction || 'N/A', short: true },
            { title: 'Description', value: alert.description, short: false }
          ],
          timestamp: Math.floor(alert.triggeredAt.getTime() / 1000)
        }
      ]
    };

    // Simulate delivery time
    await new Promise(resolve => setTimeout(resolve, 200));

    return {
      channel: 'slack',
      success: true,
      deliveredAt: new Date()
    };
  }

  private async deliverWebhookAlert(alert: ComplianceAlert, channel: AlertChannelConfig): Promise<AlertDeliveryResult> {
    // Mock webhook delivery - would make HTTP POST to webhook URL
    logger.info('Delivering webhook alert', { alertId: alert.id });

    const payload = {
      alert,
      timestamp: new Date().toISOString(),
      source: 'yieldsensei-compliance'
    };

    // Simulate delivery time
    await new Promise(resolve => setTimeout(resolve, 150));

    return {
      channel: 'webhook',
      success: true,
      deliveredAt: new Date()
    };
  }

  private async deliverSMSAlert(alert: ComplianceAlert, channel: AlertChannelConfig): Promise<AlertDeliveryResult> {
    // Mock SMS delivery - would integrate with SMS service
    logger.info('Delivering SMS alert', { alertId: alert.id });

    const message = `🚨 YieldSensei Alert: ${alert.severity.toUpperCase()} ${alert.type} for ${alert.entityType} ${alert.entityId}`;

    // Simulate delivery time
    await new Promise(resolve => setTimeout(resolve, 300));

    return {
      channel: 'sms',
      success: true,
      deliveredAt: new Date()
    };
  }

  private setupEscalation(alert: ComplianceAlert): void {
    if (!this.config.escalation.enabled || alert.severity === 'low') {
      return;
    }

    const firstLevel = this.config.escalation.levels[0];
    if (!firstLevel) return;

    const timeout = setTimeout(() => {
      this.escalateAlert(alert.id, 1);
    }, firstLevel.delay);

    this.escalationTimers.set(alert.id, {
      alertId: alert.id,
      level: 1,
      scheduledAt: new Date(Date.now() + firstLevel.delay),
      timeout
    });

    logger.debug('Escalation scheduled', {
      alertId: alert.id,
      level: 1,
      delay: firstLevel.delay
    });
  }

  private async escalateAlert(alertId: string, level: number): Promise<void> {
    const alert = this.activeAlerts.get(alertId);
    if (!alert || alert.status === 'resolved' || alert.status === 'false-positive') {
      return;
    }

    const escalationLevel = this.config.escalation.levels.find(l => l.level === level);
    if (!escalationLevel) return;

    alert.escalationLevel = level;
    this.metrics.escalatedAlerts++;

    logger.warn('Alert escalated', {
      alertId,
      level,
      recipients: escalationLevel.recipients
    });

    this.emit('alert_escalated', {
      alertId,
      alert,
      level,
      escalationLevel,
      timestamp: new Date()
    });

    // Schedule next escalation if available
    const nextLevel = this.config.escalation.levels.find(l => l.level === level + 1);
    if (nextLevel) {
      const timeout = setTimeout(() => {
        this.escalateAlert(alertId, level + 1);
      }, nextLevel.delay);

      this.escalationTimers.set(alertId, {
        alertId,
        level: level + 1,
        scheduledAt: new Date(Date.now() + nextLevel.delay),
        timeout
      });
    }
  }

  private cancelEscalation(alertId: string): void {
    const timer = this.escalationTimers.get(alertId);
    if (timer) {
      clearTimeout(timer.timeout);
      this.escalationTimers.delete(alertId);
      logger.debug('Escalation cancelled', { alertId });
    }
  }

  private updateAlertMetrics(alert: ComplianceAlert): void {
    this.metrics.totalAlerts++;
    
    // Update by type
    this.metrics.alertsByType[alert.type] = (this.metrics.alertsByType[alert.type] || 0) + 1;
    
    // Update by severity
    this.metrics.alertsBySeverity[alert.severity]++;
  }

  private getSeverityColor(severity: RiskLevel): string {
    const colors = {
      low: '#36a64f',      // Green
      medium: '#ff9500',   // Orange
      high: '#ff0000',     // Red
      critical: '#8b0000'  // Dark red
    };
    return colors[severity] || '#cccccc';
  }

  private cleanupResolvedAlerts(): void {
    const oneWeek = 7 * 24 * 60 * 60 * 1000;
    const cutoff = new Date(Date.now() - oneWeek);

    for (const [alertId, alert] of this.activeAlerts.entries()) {
      if ((alert.status === 'resolved' || alert.status === 'false-positive') &&
          alert.resolvedAt && alert.resolvedAt < cutoff) {
        this.activeAlerts.delete(alertId);
        this.suppressedAlerts.delete(alertId);
        this.cancelEscalation(alertId);
      }
    }

    logger.debug(`Cleaned up resolved alerts, active: ${this.activeAlerts.size}`);
  }
}