/**
 * Security Alert System
 * 
 * Comprehensive alerting system for security issues including:
 * - Real-time threat detection and alerting
 * - Multi-channel notification delivery
 * - Alert escalation and routing
 * - Alert correlation and deduplication
 * - Integration with external security systems
 */

import { EventEmitter } from 'events';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { configurationAuditLogger } from './audit-logger';
import { secretHealthChecker } from './secret-health-checker';
import { enhancedDriftDetector } from './enhanced-drift-detector';
import { securityConfigValidator } from './security-config-validator';

export interface SecurityAlert {
  id: string;
  timestamp: Date;
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: AlertCategory;
  title: string;
  description: string;
  source: string;
  environment: string;
  affected_resources: string[];
  indicators: SecurityIndicator[];
  status: 'open' | 'acknowledged' | 'investigating' | 'resolved' | 'false_positive';
  assigned_to?: string;
  escalation_level: number;
  correlation_id?: string;
  related_alerts: string[];
  metadata: AlertMetadata;
  response_actions: ResponseAction[];
  timeline: AlertTimelineEntry[];
}

export interface SecurityIndicator {
  type: 'compromise' | 'misconfiguration' | 'violation' | 'anomaly' | 'threat';
  description: string;
  confidence: number; // 0-100
  evidence: Evidence[];
  mitre_technique?: string;
  kill_chain_stage?: string;
}

export interface Evidence {
  type: 'log' | 'metric' | 'config' | 'file' | 'network' | 'behavioral';
  description: string;
  data: any;
  timestamp: Date;
  source: string;
}

export interface AlertMetadata {
  detection_method: string;
  risk_score: number; // 0-100
  business_impact: 'low' | 'medium' | 'high' | 'critical';
  compliance_implications: string[];
  attack_vectors: string[];
  affected_services: string[];
  geographic_location?: string;
  user_context?: UserContext;
}

export interface UserContext {
  user_id: string;
  role: string;
  previous_activity: string[];
  risk_profile: 'low' | 'medium' | 'high';
  authentication_method: string;
}

export interface ResponseAction {
  id: string;
  type: 'manual' | 'automated';
  action: string;
  description: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  executed_by?: string;
  executed_at?: Date;
  result?: any;
}

export interface AlertTimelineEntry {
  timestamp: Date;
  event: string;
  description: string;
  user?: string;
  automated: boolean;
}

export interface NotificationChannel {
  id: string;
  type: 'email' | 'sms' | 'slack' | 'teams' | 'webhook' | 'pagerduty' | 'phone';
  config: NotificationConfig;
  severity_filter: ('low' | 'medium' | 'high' | 'critical')[];
  category_filter: AlertCategory[];
  escalation_delays: number[]; // minutes
  active_hours?: TimeWindow;
  enabled: boolean;
}

export interface NotificationConfig {
  recipients?: string[];
  webhook_url?: string;
  api_key?: string;
  channel?: string;
  template?: string;
  custom_fields?: Record<string, any>;
}

export interface TimeWindow {
  start: string; // HH:MM
  end: string;   // HH:MM
  timezone: string;
  days: number[]; // 0=Sunday, 1=Monday, etc.
}

export interface EscalationRule {
  id: string;
  name: string;
  conditions: EscalationCondition[];
  actions: EscalationAction[];
  escalation_delay: number; // minutes
  max_escalations: number;
  enabled: boolean;
}

export interface EscalationCondition {
  type: 'severity' | 'category' | 'unacknowledged_time' | 'business_hours' | 'impact';
  operator: 'equals' | 'greater_than' | 'less_than' | 'contains';
  value: any;
}

export interface EscalationAction {
  type: 'notify' | 'assign' | 'execute_playbook' | 'create_ticket';
  target: string;
  parameters: Record<string, any>;
}

export interface AlertCorrelationRule {
  id: string;
  name: string;
  description: string;
  time_window: number; // minutes
  conditions: CorrelationCondition[];
  correlation_key: string;
  actions: CorrelationAction[];
  enabled: boolean;
}

export interface CorrelationCondition {
  field: string;
  operator: 'equals' | 'contains' | 'matches' | 'within_range';
  value: any;
}

export interface CorrelationAction {
  type: 'merge' | 'suppress' | 'escalate' | 'create_incident';
  parameters: Record<string, any>;
}

export type AlertCategory = 
  | 'authentication'
  | 'authorization'
  | 'configuration_drift'
  | 'secret_compromise'
  | 'key_management'
  | 'data_breach'
  | 'system_intrusion'
  | 'malware'
  | 'compliance_violation'
  | 'performance_anomaly'
  | 'availability'
  | 'data_integrity'
  | 'network_security'
  | 'application_security';

export class SecurityAlertSystem extends EventEmitter {
  private alerts: Map<string, SecurityAlert> = new Map();
  private notificationChannels: Map<string, NotificationChannel> = new Map();
  private escalationRules: EscalationRule[] = [];
  private correlationRules: AlertCorrelationRule[] = [];
  private alertHistory: SecurityAlert[] = [];
  private correlationGroups: Map<string, string[]> = new Map();
  private suppressedAlerts: Set<string> = new Set();
  private readonly maxHistorySize = 10000;
  private readonly correlationWindow = 30; // minutes

  constructor() {
    super();
    this.initializeDefaultChannels();
    this.initializeDefaultRules();
    this.setupEventListeners();
    this.startCorrelationEngine();
    console.log('🚨 Security Alert System initialized');
  }

  /**
   * Create a new security alert
   */
  async createAlert(alertData: Omit<SecurityAlert, 'id' | 'timestamp' | 'status' | 'escalation_level' | 'related_alerts' | 'timeline'>): Promise<string> {
    const alert: SecurityAlert = {
      id: this.generateAlertId(),
      timestamp: new Date(),
      status: 'open',
      escalation_level: 0,
      related_alerts: [],
      timeline: [{
        timestamp: new Date(),
        event: 'alert_created',
        description: 'Security alert created',
        automated: true
      }],
      ...alertData
    };

    // Store alert
    this.alerts.set(alert.id, alert);
    this.addToHistory(alert);

    // Log to audit system
    await configurationAuditLogger.logSecurityViolation(
      'system',
      alert.title,
      {
        severity: alert.severity,
        category: alert.category,
        indicators: alert.indicators
      },
      alert.severity === 'critical' || alert.severity === 'high' ? 'critical' : 'warning',
      {
        correlation_id: alert.correlation_id,
        tags: [`alert:${alert.category}`, `severity:${alert.severity}`]
      }
    );

    // Check for correlation
    await this.checkCorrelation(alert);

    // Send notifications
    await this.processNotifications(alert);

    // Check escalation rules
    await this.checkEscalationRules(alert);

    this.emit('alert:created', alert);
    console.log(`🚨 Security alert created: ${alert.id} (${alert.severity}) - ${alert.title}`);

    return alert.id;
  }

  /**
   * Update alert status
   */
  async updateAlertStatus(
    alertId: string,
    status: SecurityAlert['status'],
    userId?: string,
    comment?: string
  ): Promise<void> {
    const alert = this.alerts.get(alertId);
    if (!alert) {
      throw new Error(`Alert not found: ${alertId}`);
    }

    const oldStatus = alert.status;
    alert.status = status;

    // Add timeline entry
    alert.timeline.push({
      timestamp: new Date(),
      event: 'status_changed',
      description: `Status changed from ${oldStatus} to ${status}${comment ? ': ' + comment : ''}`,
      user: userId,
      automated: !userId
    });

    // Log status change
    await configurationAuditLogger.logAccessEvent(
      userId || 'system',
      'grant',
      alertId,
      'alert_status',
      status,
      {
        correlation_id: alert.correlation_id,
        context: { previous_status: oldStatus, comment }
      }
    );

    this.emit('alert:status_changed', { alert, oldStatus, newStatus: status, userId });
  }

  /**
   * Assign alert to user
   */
  async assignAlert(alertId: string, assigneeId: string, assignedBy?: string): Promise<void> {
    const alert = this.alerts.get(alertId);
    if (!alert) {
      throw new Error(`Alert not found: ${alertId}`);
    }

    alert.assigned_to = assigneeId;
    alert.timeline.push({
      timestamp: new Date(),
      event: 'assigned',
      description: `Alert assigned to ${assigneeId}`,
      user: assignedBy,
      automated: !assignedBy
    });

    this.emit('alert:assigned', { alert, assigneeId, assignedBy });
  }

  /**
   * Add response action to alert
   */
  async addResponseAction(
    alertId: string,
    action: Omit<ResponseAction, 'id' | 'status'>
  ): Promise<string> {
    const alert = this.alerts.get(alertId);
    if (!alert) {
      throw new Error(`Alert not found: ${alertId}`);
    }

    const responseAction: ResponseAction = {
      id: this.generateActionId(),
      status: 'pending',
      ...action
    };

    alert.response_actions.push(responseAction);
    alert.timeline.push({
      timestamp: new Date(),
      event: 'response_action_added',
      description: `Response action added: ${action.action}`,
      automated: action.type === 'automated'
    });

    // Execute automated actions immediately
    if (action.type === 'automated') {
      await this.executeResponseAction(alertId, responseAction.id);
    }

    this.emit('alert:response_action_added', { alert, action: responseAction });
    return responseAction.id;
  }

  /**
   * Execute response action
   */
  async executeResponseAction(alertId: string, actionId: string): Promise<void> {
    const alert = this.alerts.get(alertId);
    if (!alert) {
      throw new Error(`Alert not found: ${alertId}`);
    }

    const action = alert.response_actions.find(a => a.id === actionId);
    if (!action) {
      throw new Error(`Response action not found: ${actionId}`);
    }

    action.status = 'running';
    action.executed_at = new Date();

    try {
      const result = await this.performResponseAction(action, alert);
      
      action.status = 'completed';
      action.result = result;

      alert.timeline.push({
        timestamp: new Date(),
        event: 'response_action_completed',
        description: `Response action completed: ${action.action}`,
        automated: action.type === 'automated'
      });

      this.emit('alert:response_action_completed', { alert, action, result });

    } catch (error) {
      action.status = 'failed';
      action.result = { error: error instanceof Error ? error.message : 'Unknown error' };

      alert.timeline.push({
        timestamp: new Date(),
        event: 'response_action_failed',
        description: `Response action failed: ${action.action} - ${error}`,
        automated: action.type === 'automated'
      });

      this.emit('alert:response_action_failed', { alert, action, error });
    }
  }

  /**
   * Query alerts with filters
   */
  queryAlerts(filter: {
    severity?: ('low' | 'medium' | 'high' | 'critical')[];
    category?: AlertCategory[];
    status?: ('open' | 'acknowledged' | 'investigating' | 'resolved' | 'false_positive')[];
    environment?: string[];
    startDate?: Date;
    endDate?: Date;
    assignedTo?: string;
    correlationId?: string;
  }): SecurityAlert[] {
    let results = Array.from(this.alerts.values());

    if (filter.severity) {
      results = results.filter(alert => filter.severity!.includes(alert.severity));
    }

    if (filter.category) {
      results = results.filter(alert => filter.category!.includes(alert.category));
    }

    if (filter.status) {
      results = results.filter(alert => filter.status!.includes(alert.status));
    }

    if (filter.environment) {
      results = results.filter(alert => filter.environment!.includes(alert.environment));
    }

    if (filter.startDate) {
      results = results.filter(alert => alert.timestamp >= filter.startDate!);
    }

    if (filter.endDate) {
      results = results.filter(alert => alert.timestamp <= filter.endDate!);
    }

    if (filter.assignedTo) {
      results = results.filter(alert => alert.assigned_to === filter.assignedTo);
    }

    if (filter.correlationId) {
      results = results.filter(alert => alert.correlation_id === filter.correlationId);
    }

    return results.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Generate security alert dashboard
   */
  generateSecurityDashboard(): {
    summary: {
      total_alerts: number;
      open_alerts: number;
      critical_alerts: number;
      alerts_today: number;
    };
    by_severity: Record<string, number>;
    by_category: Record<string, number>;
    by_status: Record<string, number>;
    recent_alerts: SecurityAlert[];
    top_affected_resources: Array<{ resource: string; count: number }>;
  } {
    const allAlerts = Array.from(this.alerts.values());
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const summary = {
      total_alerts: allAlerts.length,
      open_alerts: allAlerts.filter(a => a.status === 'open').length,
      critical_alerts: allAlerts.filter(a => a.severity === 'critical').length,
      alerts_today: allAlerts.filter(a => a.timestamp >= today).length
    };

    const by_severity = allAlerts.reduce((acc, alert) => {
      acc[alert.severity] = (acc[alert.severity] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const by_category = allAlerts.reduce((acc, alert) => {
      acc[alert.category] = (acc[alert.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const by_status = allAlerts.reduce((acc, alert) => {
      acc[alert.status] = (acc[alert.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const recent_alerts = allAlerts
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, 10);

    // Count affected resources
    const resourceCounts = new Map<string, number>();
    allAlerts.forEach(alert => {
      alert.affected_resources.forEach(resource => {
        resourceCounts.set(resource, (resourceCounts.get(resource) || 0) + 1);
      });
    });

    const top_affected_resources = Array.from(resourceCounts.entries())
      .map(([resource, count]) => ({ resource, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      summary,
      by_severity,
      by_category,
      by_status,
      recent_alerts,
      top_affected_resources
    };
  }

  /**
   * Export alerts for external systems
   */
  exportAlerts(
    filter: Parameters<typeof this.queryAlerts>[0],
    format: 'json' | 'csv' | 'siem' = 'json'
  ): string {
    const alerts = this.queryAlerts(filter);

    switch (format) {
      case 'json':
        return JSON.stringify(alerts, null, 2);
      
      case 'csv':
        return this.formatAlertsAsCSV(alerts);
      
      case 'siem':
        return this.formatAlertsAsSIEM(alerts);
      
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  // Private helper methods

  private async performResponseAction(
    action: ResponseAction,
    alert: SecurityAlert
  ): Promise<any> {
    switch (action.action) {
      case 'disable_user':
        return this.disableUser(action.description);
      
      case 'block_ip':
        return this.blockIP(action.description);
      
      case 'rotate_keys':
        return this.rotateAffectedKeys(alert.affected_resources);
      
      case 'isolate_system':
        return this.isolateSystem(action.description);
      
      case 'send_notification':
        return this.sendEmergencyNotification(alert);
      
      default:
        console.log(`📋 Would execute action: ${action.action} - ${action.description}`);
        return { simulated: true, action: action.action };
    }
  }

  private async disableUser(userId: string): Promise<any> {
    console.log(`🔒 Would disable user: ${userId}`);
    return { action: 'disable_user', user: userId, timestamp: new Date() };
  }

  private async blockIP(ipAddress: string): Promise<any> {
    console.log(`🚫 Would block IP address: ${ipAddress}`);
    return { action: 'block_ip', ip: ipAddress, timestamp: new Date() };
  }

  private async rotateAffectedKeys(resources: string[]): Promise<any> {
    console.log(`🔄 Would rotate keys for resources: ${resources.join(', ')}`);
    return { action: 'rotate_keys', resources, timestamp: new Date() };
  }

  private async isolateSystem(systemId: string): Promise<any> {
    console.log(`🏝️ Would isolate system: ${systemId}`);
    return { action: 'isolate_system', system: systemId, timestamp: new Date() };
  }

  private async sendEmergencyNotification(alert: SecurityAlert): Promise<any> {
    console.log(`📢 Sending emergency notification for alert: ${alert.id}`);
    
    // Send to all critical channels
    const criticalChannels = Array.from(this.notificationChannels.values())
      .filter(channel => channel.severity_filter.includes('critical'));

    for (const channel of criticalChannels) {
      await this.sendNotification(alert, channel, true);
    }

    return { action: 'emergency_notification', channels: criticalChannels.length };
  }

  private async checkCorrelation(alert: SecurityAlert): Promise<void> {
    for (const rule of this.correlationRules) {
      if (!rule.enabled) continue;

      // Find alerts within time window that match conditions
      const windowStart = new Date(alert.timestamp.getTime() - rule.time_window * 60000);
      const candidateAlerts = Array.from(this.alerts.values())
        .filter(a => a.timestamp >= windowStart && a.id !== alert.id);

      const correlatedAlerts = candidateAlerts.filter(candidateAlert => 
        this.matchesCorrelationConditions(candidateAlert, rule.conditions)
      );

      if (correlatedAlerts.length > 0) {
        await this.executeCorrelationActions(alert, correlatedAlerts, rule);
      }
    }
  }

  private matchesCorrelationConditions(
    alert: SecurityAlert,
    conditions: CorrelationCondition[]
  ): boolean {
    return conditions.every(condition => {
      const value = this.getAlertFieldValue(alert, condition.field);
      
      switch (condition.operator) {
        case 'equals':
          return value === condition.value;
        case 'contains':
          return String(value).includes(String(condition.value));
        case 'matches':
          return new RegExp(condition.value).test(String(value));
        case 'within_range':
          return value >= condition.value.min && value <= condition.value.max;
        default:
          return false;
      }
    });
  }

  private getAlertFieldValue(alert: SecurityAlert, field: string): any {
    const fields = field.split('.');
    let value: any = alert;
    
    for (const fieldPart of fields) {
      value = value?.[fieldPart];
    }
    
    return value;
  }

  private async executeCorrelationActions(
    primaryAlert: SecurityAlert,
    correlatedAlerts: SecurityAlert[],
    rule: AlertCorrelationRule
  ): Promise<void> {
    for (const action of rule.actions) {
      switch (action.type) {
        case 'merge':
          await this.mergeAlerts(primaryAlert, correlatedAlerts);
          break;
        
        case 'suppress':
          await this.suppressAlerts(correlatedAlerts);
          break;
        
        case 'escalate':
          await this.escalateAlert(primaryAlert.id);
          break;
        
        case 'create_incident':
          await this.createIncident(primaryAlert, correlatedAlerts);
          break;
      }
    }
  }

  private async mergeAlerts(
    primaryAlert: SecurityAlert,
    correlatedAlerts: SecurityAlert[]
  ): Promise<void> {
    const correlationId = primaryAlert.correlation_id || this.generateCorrelationId();
    
    primaryAlert.correlation_id = correlationId;
    primaryAlert.related_alerts = correlatedAlerts.map(a => a.id);

    for (const alert of correlatedAlerts) {
      alert.correlation_id = correlationId;
    }

    console.log(`🔗 Merged ${correlatedAlerts.length} alerts with primary alert ${primaryAlert.id}`);
  }

  private async suppressAlerts(alerts: SecurityAlert[]): Promise<void> {
    for (const alert of alerts) {
      this.suppressedAlerts.add(alert.id);
      alert.status = 'resolved';
    }
    
    console.log(`🔇 Suppressed ${alerts.length} correlated alerts`);
  }

  private async escalateAlert(alertId: string): Promise<void> {
    const alert = this.alerts.get(alertId);
    if (!alert) return;

    alert.escalation_level++;
    alert.timeline.push({
      timestamp: new Date(),
      event: 'escalated',
      description: `Alert escalated to level ${alert.escalation_level}`,
      automated: true
    });

    this.emit('alert:escalated', { alert });
  }

  private async createIncident(
    primaryAlert: SecurityAlert,
    correlatedAlerts: SecurityAlert[]
  ): Promise<void> {
    const incidentId = this.generateIncidentId();
    
    console.log(`🎫 Created incident ${incidentId} from alert correlation`);
    
    this.emit('incident:created', {
      incidentId,
      primaryAlert,
      correlatedAlerts
    });
  }

  private async processNotifications(alert: SecurityAlert): Promise<void> {
    for (const channel of this.notificationChannels.values()) {
      if (!channel.enabled) continue;
      
      // Check severity filter
      if (!channel.severity_filter.includes(alert.severity)) continue;
      
      // Check category filter
      if (channel.category_filter.length > 0 && 
          !channel.category_filter.includes(alert.category)) continue;
      
      // Check active hours
      if (channel.active_hours && !this.isWithinActiveHours(channel.active_hours)) continue;
      
      await this.sendNotification(alert, channel);
    }
  }

  private async sendNotification(
    alert: SecurityAlert,
    channel: NotificationChannel,
    emergency: boolean = false
  ): Promise<void> {
    try {
      switch (channel.type) {
        case 'email':
          await this.sendEmailNotification(alert, channel);
          break;
        
        case 'slack':
          await this.sendSlackNotification(alert, channel);
          break;
        
        case 'webhook':
          await this.sendWebhookNotification(alert, channel);
          break;
        
        case 'pagerduty':
          await this.sendPagerDutyNotification(alert, channel);
          break;
        
        default:
          console.log(`📧 Would send ${channel.type} notification for alert ${alert.id}`);
      }

      this.emit('notification:sent', { alert, channel, emergency });

    } catch (error) {
      console.error(`Failed to send notification via ${channel.type}:`, error);
      this.emit('notification:failed', { alert, channel, error });
    }
  }

  private async sendEmailNotification(
    alert: SecurityAlert,
    channel: NotificationChannel
  ): Promise<void> {
    console.log(`📧 Sending email notification for alert ${alert.id} to ${channel.config.recipients?.join(', ')}`);
  }

  private async sendSlackNotification(
    alert: SecurityAlert,
    channel: NotificationChannel
  ): Promise<void> {
    console.log(`💬 Sending Slack notification for alert ${alert.id} to ${channel.config.channel}`);
  }

  private async sendWebhookNotification(
    alert: SecurityAlert,
    channel: NotificationChannel
  ): Promise<void> {
    console.log(`🔗 Sending webhook notification for alert ${alert.id} to ${channel.config.webhook_url}`);
  }

  private async sendPagerDutyNotification(
    alert: SecurityAlert,
    channel: NotificationChannel
  ): Promise<void> {
    console.log(`📟 Sending PagerDuty notification for alert ${alert.id}`);
  }

  private async checkEscalationRules(alert: SecurityAlert): Promise<void> {
    for (const rule of this.escalationRules) {
      if (!rule.enabled) continue;
      
      if (this.matchesEscalationConditions(alert, rule.conditions)) {
        // Schedule escalation
        setTimeout(async () => {
          if (alert.status === 'open' && alert.escalation_level < rule.max_escalations) {
            await this.executeEscalationActions(alert, rule);
          }
        }, rule.escalation_delay * 60000);
      }
    }
  }

  private matchesEscalationConditions(
    alert: SecurityAlert,
    conditions: EscalationCondition[]
  ): boolean {
    return conditions.every(condition => {
      switch (condition.type) {
        case 'severity':
          return alert.severity === condition.value;
        case 'category':
          return alert.category === condition.value;
        case 'business_hours':
          return this.isBusinessHours() === condition.value;
        case 'impact':
          return alert.metadata.business_impact === condition.value;
        default:
          return false;
      }
    });
  }

  private async executeEscalationActions(
    alert: SecurityAlert,
    rule: EscalationRule
  ): Promise<void> {
    for (const action of rule.actions) {
      switch (action.type) {
        case 'notify':
          // Send escalation notification
          break;
        case 'assign':
          await this.assignAlert(alert.id, action.target, 'escalation_system');
          break;
        case 'execute_playbook':
          // Execute incident response playbook
          break;
        case 'create_ticket':
          // Create support ticket
          break;
      }
    }
  }

  private setupEventListeners(): void {
    // Listen to security-related events from other systems
    secretHealthChecker.on('health:critical', (report) => {
      this.createAlert({
        severity: 'critical',
        category: 'secret_compromise',
        title: 'Critical Secret Health Issue',
        description: `Secret health check failed with critical status`,
        source: 'secret_health_checker',
        environment: 'production',
        affected_resources: ['secret_management'],
        indicators: [{
          type: 'compromise',
          description: 'Secret accessibility compromised',
          confidence: 90,
          evidence: [{
            type: 'metric',
            description: 'Health check failure',
            data: report,
            timestamp: new Date(),
            source: 'secret_health_checker'
          }]
        }],
        metadata: {
          detection_method: 'health_monitoring',
          risk_score: 95,
          business_impact: 'critical',
          compliance_implications: ['data_protection'],
          attack_vectors: ['credential_compromise'],
          affected_services: ['authentication', 'encryption']
        },
        response_actions: [{
          id: this.generateActionId(),
          type: 'automated',
          action: 'rotate_keys',
          description: 'Rotate all affected cryptographic keys',
          status: 'pending'
        }]
      });
    });

    enhancedDriftDetector.on('drift:critical', (result) => {
      this.createAlert({
        severity: 'high',
        category: 'configuration_drift',
        title: 'Critical Configuration Drift Detected',
        description: `Critical configuration drift detected with score ${result.driftScore}`,
        source: 'drift_detector',
        environment: result.environment,
        affected_resources: result.changes.map(c => c.path),
        indicators: [{
          type: 'misconfiguration',
          description: 'Unauthorized configuration changes',
          confidence: 85,
          evidence: result.changes.map(change => ({
            type: 'config',
            description: change.description,
            data: { before: change.oldValue, after: change.newValue },
            timestamp: change.timestamp,
            source: 'drift_detector'
          }))
        }],
        metadata: {
          detection_method: 'drift_monitoring',
          risk_score: result.driftScore,
          business_impact: result.severity === 'critical' ? 'critical' : 'high',
          compliance_implications: ['configuration_management'],
          attack_vectors: ['configuration_tampering'],
          affected_services: ['all']
        },
        response_actions: []
      });
    });

    securityConfigValidator.on('validation:critical', (issues) => {
      this.createAlert({
        severity: 'critical',
        category: 'compliance_violation',
        title: 'Critical Security Configuration Issues',
        description: `${issues.length} critical security configuration issues detected`,
        source: 'security_validator',
        environment: 'production',
        affected_resources: issues.map(issue => issue.rule.id),
        indicators: [{
          type: 'violation',
          description: 'Security policy violations',
          confidence: 95,
          evidence: issues.map(issue => ({
            type: 'config',
            description: issue.rule.description,
            data: issue.result,
            timestamp: new Date(),
            source: 'security_validator'
          }))
        }],
        metadata: {
          detection_method: 'policy_validation',
          risk_score: 90,
          business_impact: 'critical',
          compliance_implications: ['security_policy'],
          attack_vectors: ['policy_bypass'],
          affected_services: ['all']
        },
        response_actions: []
      });
    });
  }

  private startCorrelationEngine(): void {
    // Run correlation engine every minute
    setInterval(() => {
      this.performCorrelationAnalysis();
    }, 60000);
  }

  private async performCorrelationAnalysis(): Promise<void> {
    // Perform advanced correlation analysis
    const recentAlerts = Array.from(this.alerts.values())
      .filter(alert => {
        const age = Date.now() - alert.timestamp.getTime();
        return age < this.correlationWindow * 60000;
      });

    // Look for patterns, anomalies, and attack campaigns
    await this.detectAttackPatterns(recentAlerts);
  }

  private async detectAttackPatterns(alerts: SecurityAlert[]): Promise<void> {
    // Group alerts by various dimensions for pattern detection
    const bySource = this.groupAlertsByField(alerts, 'source');
    const byCategory = this.groupAlertsByField(alerts, 'category');
    
    // Detect potential attack campaigns
    for (const [category, categoryAlerts] of Object.entries(byCategory)) {
      if (categoryAlerts.length >= 5) {
        await this.createAlert({
          severity: 'high',
          category: 'system_intrusion',
          title: 'Potential Attack Campaign Detected',
          description: `Multiple ${category} alerts suggest coordinated attack`,
          source: 'correlation_engine',
          environment: 'all',
          affected_resources: categoryAlerts.flatMap(a => a.affected_resources),
          indicators: [{
            type: 'anomaly',
            description: 'High frequency of related security events',
            confidence: 80,
            evidence: [{
              type: 'behavioral',
              description: `${categoryAlerts.length} related alerts in short timeframe`,
              data: { category, count: categoryAlerts.length },
              timestamp: new Date(),
              source: 'correlation_engine'
            }]
          }],
          metadata: {
            detection_method: 'correlation_analysis',
            risk_score: 85,
            business_impact: 'high',
            compliance_implications: ['incident_response'],
            attack_vectors: ['coordinated_attack'],
            affected_services: ['multiple']
          },
          response_actions: []
        });
      }
    }
  }

  private groupAlertsByField(alerts: SecurityAlert[], field: keyof SecurityAlert): Record<string, SecurityAlert[]> {
    return alerts.reduce((groups, alert) => {
      const key = String(alert[field]);
      if (!groups[key]) groups[key] = [];
      groups[key].push(alert);
      return groups;
    }, {} as Record<string, SecurityAlert[]>);
  }

  private formatAlertsAsCSV(alerts: SecurityAlert[]): string {
    const headers = [
      'ID', 'Timestamp', 'Severity', 'Category', 'Title', 'Description',
      'Environment', 'Status', 'Assigned To', 'Risk Score'
    ];

    const csvLines = [headers.join(',')];

    for (const alert of alerts) {
      const row = [
        alert.id,
        alert.timestamp.toISOString(),
        alert.severity,
        alert.category,
        `"${alert.title.replace(/"/g, '""')}"`,
        `"${alert.description.replace(/"/g, '""')}"`,
        alert.environment,
        alert.status,
        alert.assigned_to || '',
        alert.metadata.risk_score
      ];
      csvLines.push(row.join(','));
    }

    return csvLines.join('\n');
  }

  private formatAlertsAsSIEM(alerts: SecurityAlert[]): string {
    return alerts.map(alert => {
      const siemEvent = {
        timestamp: alert.timestamp.toISOString(),
        event_type: 'security_alert',
        severity: alert.severity,
        category: alert.category,
        title: alert.title,
        description: alert.description,
        source: alert.source,
        environment: alert.environment,
        indicators: alert.indicators,
        risk_score: alert.metadata.risk_score,
        affected_resources: alert.affected_resources
      };
      
      return JSON.stringify(siemEvent);
    }).join('\n');
  }

  private isWithinActiveHours(timeWindow: TimeWindow): boolean {
    const now = new Date();
    const currentDay = now.getDay();
    const currentTime = now.toTimeString().substring(0, 5); // HH:MM
    
    return timeWindow.days.includes(currentDay) &&
           currentTime >= timeWindow.start &&
           currentTime <= timeWindow.end;
  }

  private isBusinessHours(): boolean {
    const now = new Date();
    const hour = now.getHours();
    const day = now.getDay();
    
    return day >= 1 && day <= 5 && hour >= 9 && hour <= 17; // Mon-Fri 9AM-5PM
  }

  private generateAlertId(): string {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateActionId(): string {
    return `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateCorrelationId(): string {
    return `corr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateIncidentId(): string {
    return `inc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private addToHistory(alert: SecurityAlert): void {
    this.alertHistory.push(alert);
    
    if (this.alertHistory.length > this.maxHistorySize) {
      this.alertHistory = this.alertHistory.slice(-this.maxHistorySize);
    }
  }

  private initializeDefaultChannels(): void {
    // Console channel for development
    this.notificationChannels.set('console', {
      id: 'console',
      type: 'email',
      config: { recipients: ['admin@yieldsensei.com'] },
      severity_filter: ['medium', 'high', 'critical'],
      category_filter: [],
      escalation_delays: [5, 15, 30],
      enabled: true
    });

    // Critical alerts channel
    this.notificationChannels.set('critical', {
      id: 'critical',
      type: 'pagerduty',
      config: { api_key: 'pagerduty_key' },
      severity_filter: ['critical'],
      category_filter: [],
      escalation_delays: [0, 5, 10],
      enabled: true
    });
  }

  private initializeDefaultRules(): void {
    // Critical alert escalation
    this.escalationRules.push({
      id: 'critical_escalation',
      name: 'Critical Alert Escalation',
      conditions: [
        { type: 'severity', operator: 'equals', value: 'critical' },
        { type: 'unacknowledged_time', operator: 'greater_than', value: 5 }
      ],
      actions: [
        { type: 'notify', target: 'security_team', parameters: {} }
      ],
      escalation_delay: 5,
      max_escalations: 3,
      enabled: true
    });

    // Similar alert correlation
    this.correlationRules.push({
      id: 'similar_alerts',
      name: 'Similar Alert Correlation',
      description: 'Correlate alerts with same category and environment',
      time_window: 10,
      conditions: [
        { field: 'category', operator: 'equals', value: '' },
        { field: 'environment', operator: 'equals', value: '' }
      ],
      correlation_key: 'category_environment',
      actions: [
        { type: 'merge', parameters: {} }
      ],
      enabled: true
    });
  }
}

// Export singleton instance
export const securityAlertSystem = new SecurityAlertSystem();