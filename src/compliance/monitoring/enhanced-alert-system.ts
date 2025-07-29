/**
 * Enhanced Alert System
 * Specialized alerting for regulatory changes and decentralized compliance
 */

import { EventEmitter } from 'events';
import Logger from '../../shared/logging/logger';
import {
  ComplianceAlert,
  RiskLevel,
  Jurisdiction,
  ComplianceCategory
} from '../types';
import {
  RegulatoryChange,
  RegulatoryAction
} from './regulatory-change-detector';

const logger = Logger.getLogger('enhanced-alert-system');

export interface RegulatoryAlert extends ComplianceAlert {
  regulatoryChange?: RegulatoryChange;
  actions?: RegulatoryAction[];
  implementation?: {
    deadline: Date;
    complexity: 'low' | 'medium' | 'high' | 'critical';
    estimatedCost: number;
    technicalChanges: boolean;
    policyChanges: boolean;
  };
}

export interface DecentralizedAlert extends ComplianceAlert {
  privacyLevel: 'minimal' | 'balanced' | 'maximum';
  zkProofRelated: boolean;
  reputationScore?: number;
  communityStanding?: number;
  attestationRequired?: boolean;
}

export interface AlertDashboard {
  id: string;
  name: string;
  description: string;
  widgets: AlertWidget[];
  filters: AlertFilter[];
  refreshInterval: number;
  lastUpdated: Date;
}

export interface AlertWidget {
  id: string;
  type: 'metric' | 'chart' | 'table' | 'map' | 'gauge';
  title: string;
  dataSource: string;
  configuration: Record<string, any>;
  position: { x: number; y: number; width: number; height: number };
}

export interface AlertFilter {
  field: string;
  operator: 'equals' | 'contains' | 'greater_than' | 'less_than' | 'in_range';
  value: any;
  enabled: boolean;
}

export interface AlertSummary {
  total: number;
  bySeverity: Record<RiskLevel, number>;
  byType: Record<string, number>;
  byJurisdiction: Record<Jurisdiction, number>;
  byCategory: Record<ComplianceCategory, number>;
  trends: {
    daily: number[];
    weekly: number[];
    monthly: number[];
  };
  topIssues: {
    type: string;
    count: number;
    avgSeverity: RiskLevel;
  }[];
}

export interface AlertConfiguration {
  regulatory: {
    enabled: boolean;
    autoProcessing: boolean;
    severityThresholds: Record<RiskLevel, number>;
    notificationChannels: string[];
    escalationRules: EscalationRule[];
  };
  decentralized: {
    enabled: boolean;
    privacyAware: boolean;
    zkProofMonitoring: boolean;
    reputationThresholds: {
      warning: number;
      critical: number;
    };
    communityAlerts: boolean;
  };
  dashboard: {
    enabled: boolean;
    realTimeUpdates: boolean;
    historicalData: boolean;
    customWidgets: boolean;
  };
}

export interface EscalationRule {
  id: string;
  name: string;
  conditions: {
    severity: RiskLevel[];
    type: string[];
    timeframe: number; // minutes
    threshold: number;
  };
  actions: {
    notify: string[];
    escalateTo: string;
    createTicket: boolean;
    autoRemediate: boolean;
  };
}

export class EnhancedAlertSystem extends EventEmitter {
  private config: AlertConfiguration;
  private isInitialized = false;
  private isRunning = false;
  
  private alerts: Map<string, RegulatoryAlert | DecentralizedAlert> = new Map();
  private dashboards: Map<string, AlertDashboard> = new Map();
  private escalationRules: Map<string, EscalationRule> = new Map();
  
  private stats = {
    totalAlerts: 0,
    regulatoryAlerts: 0,
    decentralizedAlerts: 0,
    escalatedAlerts: 0,
    autoResolvedAlerts: 0,
    averageResolutionTime: 0
  };

  constructor(config: AlertConfiguration) {
    super();
    this.config = config;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.warn('Enhanced Alert System already initialized');
      return;
    }

    try {
      logger.info('Initializing Enhanced Alert System...');

      // Load escalation rules
      await this.loadEscalationRules();

      // Create default dashboards
      await this.createDefaultDashboards();

      // Set up event handlers
      this.setupEventHandlers();

      this.isInitialized = true;
      logger.info('✅ Enhanced Alert System initialized successfully');

      this.emit('system_initialized', {
        dashboards: this.dashboards.size,
        escalationRules: this.escalationRules.size,
        timestamp: new Date()
      });

    } catch (error) {
      logger.error('Failed to initialize Enhanced Alert System:', error);
      throw error;
    }
  }

  async start(): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('Enhanced Alert System must be initialized before starting');
    }

    if (this.isRunning) {
      logger.warn('Enhanced Alert System already running');
      return;
    }

    this.isRunning = true;
    logger.info('🚀 Enhanced Alert System started successfully');
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      logger.warn('Enhanced Alert System is not running');
      return;
    }

    this.isRunning = false;
    logger.info('🛑 Enhanced Alert System stopped successfully');
  }

  /**
   * Create regulatory change alert
   */
  async createRegulatoryAlert(change: RegulatoryChange): Promise<string> {
    try {
      const alert: RegulatoryAlert = {
        id: this.generateAlertId('reg'),
        type: 'regulatory-change',
        severity: change.impact.severity,
        title: `Regulatory Change: ${change.title}`,
        description: change.description,
        entityType: 'system',
        entityId: 'platform',
        jurisdiction: change.jurisdiction,
        triggeredAt: new Date(),
        status: 'open',
        escalationLevel: 0,
        metadata: {
          changeId: change.id,
          effectiveDate: change.effectiveDate,
          source: change.source
        },
        regulatoryChange: change,
        actions: change.impact.requiredActions,
        implementation: {
          deadline: change.effectiveDate || new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
          complexity: change.impact.implementationComplexity,
          estimatedCost: change.impact.estimatedComplianceCost,
          technicalChanges: change.impact.technicalChangesRequired,
          policyChanges: change.impact.policyChangesRequired
        }
      };

      await this.processAlert(alert);
      this.stats.regulatoryAlerts++;

      logger.info('Regulatory alert created', {
        alertId: alert.id,
        changeId: change.id,
        severity: alert.severity,
        deadline: alert.implementation?.deadline
      });

      return alert.id;

    } catch (error) {
      logger.error('Error creating regulatory alert:', error);
      throw error;
    }
  }

  /**
   * Create decentralized compliance alert
   */
  async createDecentralizedAlert(params: {
    type: string;
    severity: RiskLevel;
    title: string;
    description: string;
    userDID: string;
    privacyLevel: 'minimal' | 'balanced' | 'maximum';
    zkProofRelated: boolean;
    reputationScore?: number;
    metadata?: Record<string, any>;
  }): Promise<string> {
    try {
      const alert: DecentralizedAlert = {
        id: this.generateAlertId('dec'),
        type: params.type as any,
        severity: params.severity,
        title: params.title,
        description: params.description,
        entityType: 'user',
        entityId: params.userDID,
        triggeredAt: new Date(),
        status: 'open',
        escalationLevel: 0,
        metadata: params.metadata || {},
        privacyLevel: params.privacyLevel,
        zkProofRelated: params.zkProofRelated,
        reputationScore: params.reputationScore
      };

      await this.processAlert(alert);
      this.stats.decentralizedAlerts++;

      logger.info('Decentralized alert created', {
        alertId: alert.id,
        userDID: params.userDID,
        severity: alert.severity,
        privacyLevel: alert.privacyLevel,
        zkProofRelated: alert.zkProofRelated
      });

      return alert.id;

    } catch (error) {
      logger.error('Error creating decentralized alert:', error);
      throw error;
    }
  }

  /**
   * Get alert summary with analytics
   */
  getAlertSummary(timeframe?: { start: Date; end: Date }): AlertSummary {
    const filteredAlerts = Array.from(this.alerts.values()).filter(alert => {
      if (!timeframe) return true;
      return alert.triggeredAt >= timeframe.start && alert.triggeredAt <= timeframe.end;
    });

    const summary: AlertSummary = {
      total: filteredAlerts.length,
      bySeverity: { low: 0, medium: 0, high: 0, critical: 0 },
      byType: {},
      byJurisdiction: {} as Record<Jurisdiction, number>,
      byCategory: {} as Record<ComplianceCategory, number>,
      trends: {
        daily: [],
        weekly: [],
        monthly: []
      },
      topIssues: []
    };

    // Calculate breakdowns
    for (const alert of filteredAlerts) {
      summary.bySeverity[alert.severity]++;
      summary.byType[alert.type] = (summary.byType[alert.type] || 0) + 1;
      
      if (alert.jurisdiction) {
        summary.byJurisdiction[alert.jurisdiction] = (summary.byJurisdiction[alert.jurisdiction] || 0) + 1;
      }
    }

    // Calculate trends (simplified)
    summary.trends = this.calculateTrends(filteredAlerts);

    // Find top issues
    summary.topIssues = Object.entries(summary.byType)
      .map(([type, count]) => ({
        type,
        count,
        avgSeverity: this.calculateAverageSeverity(filteredAlerts.filter(a => a.type === type))
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return summary;
  }

  /**
   * Create custom dashboard
   */
  async createDashboard(dashboard: Omit<AlertDashboard, 'id' | 'lastUpdated'>): Promise<string> {
    const dashboardId = this.generateDashboardId();
    const fullDashboard: AlertDashboard = {
      id: dashboardId,
      ...dashboard,
      lastUpdated: new Date()
    };

    this.dashboards.set(dashboardId, fullDashboard);

    logger.info('Custom dashboard created', {
      dashboardId,
      name: dashboard.name,
      widgets: dashboard.widgets.length
    });

    this.emit('dashboard_created', {
      dashboard: fullDashboard,
      timestamp: new Date()
    });

    return dashboardId;
  }

  /**
   * Get real-time dashboard data
   */
  getDashboardData(dashboardId: string): any {
    const dashboard = this.dashboards.get(dashboardId);
    if (!dashboard) {
      throw new Error(`Dashboard not found: ${dashboardId}`);
    }

    const data: any = {
      dashboard,
      timestamp: new Date(),
      widgets: []
    };

    // Generate data for each widget
    for (const widget of dashboard.widgets) {
      const widgetData = this.generateWidgetData(widget);
      data.widgets.push({
        id: widget.id,
        type: widget.type,
        title: widget.title,
        data: widgetData
      });
    }

    return data;
  }

  /**
   * Update alert configuration
   */
  async updateConfiguration(newConfig: AlertConfiguration): Promise<void> {
    this.config = newConfig;
    await this.loadEscalationRules();
    
    logger.info('Enhanced Alert System configuration updated');
    
    this.emit('configuration_updated', {
      config: this.config,
      timestamp: new Date()
    });
  }

  /**
   * Get system statistics
   */
  getStatistics(): any {
    return {
      ...this.stats,
      activeAlerts: this.alerts.size,
      alertsByStatus: this.getAlertsByStatus(),
      recentAlerts: Array.from(this.alerts.values())
        .sort((a, b) => b.triggeredAt.getTime() - a.triggeredAt.getTime())
        .slice(0, 10)
        .map(alert => ({
          id: alert.id,
          type: alert.type,
          severity: alert.severity,
          status: alert.status,
          triggeredAt: alert.triggeredAt
        }))
    };
  }

  // Private methods

  private async processAlert(alert: RegulatoryAlert | DecentralizedAlert): Promise<void> {
    // Store alert
    this.alerts.set(alert.id, alert);
    this.stats.totalAlerts++;

    // Apply filters and privacy rules for decentralized alerts
    if (this.isDecentralizedAlert(alert) && this.config.decentralized.privacyAware) {
      await this.applyPrivacyFilters(alert);
    }

    // Check escalation rules
    await this.checkEscalationRules(alert);

    // Auto-process if configured
    if (this.shouldAutoProcess(alert)) {
      await this.autoProcessAlert(alert);
    }

    // Emit alert event
    this.emit('alert_created', {
      alert,
      timestamp: new Date()
    });
  }

  private async loadEscalationRules(): Promise<void> {
    // Load escalation rules from configuration
    for (const rule of this.config.regulatory.escalationRules) {
      this.escalationRules.set(rule.id, rule);
    }

    logger.debug(`Loaded ${this.escalationRules.size} escalation rules`);
  }

  private async createDefaultDashboards(): Promise<void> {
    // Regulatory Compliance Dashboard
    const regulatoryDashboard: AlertDashboard = {
      id: 'regulatory-compliance',
      name: 'Regulatory Compliance',
      description: 'Monitor regulatory changes and compliance status',
      widgets: [
        {
          id: 'reg-alerts-gauge',
          type: 'gauge',
          title: 'Active Regulatory Alerts',
          dataSource: 'regulatory-alerts',
          configuration: { maxValue: 50, thresholds: [10, 25, 40] },
          position: { x: 0, y: 0, width: 6, height: 4 }
        },
        {
          id: 'reg-changes-chart',
          type: 'chart',
          title: 'Regulatory Changes Over Time',
          dataSource: 'regulatory-changes',
          configuration: { chartType: 'line', timeframe: '30d' },
          position: { x: 6, y: 0, width: 6, height: 4 }
        },
        {
          id: 'jurisdiction-map',
          type: 'map',
          title: 'Alerts by Jurisdiction',
          dataSource: 'jurisdiction-alerts',
          configuration: { mapType: 'world', aggregation: 'count' },
          position: { x: 0, y: 4, width: 12, height: 6 }
        }
      ],
      filters: [
        { field: 'severity', operator: 'in_range', value: ['medium', 'high', 'critical'], enabled: true },
        { field: 'status', operator: 'equals', value: 'open', enabled: true }
      ],
      refreshInterval: 30000, // 30 seconds
      lastUpdated: new Date()
    };

    // Decentralized Compliance Dashboard
    const decentralizedDashboard: AlertDashboard = {
      id: 'decentralized-compliance',
      name: 'Decentralized Compliance',
      description: 'Monitor decentralized user compliance and ZK proof status',
      widgets: [
        {
          id: 'zkproof-status',
          type: 'metric',
          title: 'ZK Proof Verification Rate',
          dataSource: 'zkproof-metrics',
          configuration: { format: 'percentage', precision: 2 },
          position: { x: 0, y: 0, width: 3, height: 3 }
        },
        {
          id: 'reputation-distribution',
          type: 'chart',
          title: 'User Reputation Distribution',
          dataSource: 'reputation-scores',
          configuration: { chartType: 'histogram', bins: 20 },
          position: { x: 3, y: 0, width: 9, height: 6 }
        },
        {
          id: 'privacy-levels',
          type: 'chart',
          title: 'Privacy Level Adoption',
          dataSource: 'privacy-levels',
          configuration: { chartType: 'pie' },
          position: { x: 0, y: 3, width: 3, height: 3 }
        }
      ],
      filters: [
        { field: 'privacyLevel', operator: 'in_range', value: ['balanced', 'maximum'], enabled: false },
        { field: 'zkProofRelated', operator: 'equals', value: true, enabled: false }
      ],
      refreshInterval: 60000, // 1 minute
      lastUpdated: new Date()
    };

    this.dashboards.set(regulatoryDashboard.id, regulatoryDashboard);
    this.dashboards.set(decentralizedDashboard.id, decentralizedDashboard);

    logger.info('Default dashboards created', {
      dashboards: Array.from(this.dashboards.keys())
    });
  }

  private setupEventHandlers(): void {
    this.on('alert_created', this.handleAlertCreated.bind(this));
    this.on('alert_escalated', this.handleAlertEscalated.bind(this));
    this.on('alert_resolved', this.handleAlertResolved.bind(this));
  }

  private async applyPrivacyFilters(alert: DecentralizedAlert): Promise<void> {
    // Apply privacy-preserving filters to sensitive data
    if (alert.privacyLevel === 'maximum') {
      // Remove or obfuscate sensitive information
      if (alert.metadata?.['walletAddress']) {
        alert.metadata['walletAddress'] = alert.metadata['walletAddress'].substring(0, 6) + '...';
      }
      if (alert.metadata?.['transactionAmount']) {
        alert.metadata['transactionAmount'] = 'redacted';
      }
    }
  }

  private async checkEscalationRules(alert: RegulatoryAlert | DecentralizedAlert): Promise<void> {
    for (const rule of this.escalationRules.values()) {
      if (this.ruleMatches(rule, alert)) {
        await this.escalateAlert(alert, rule);
      }
    }
  }

  private ruleMatches(rule: EscalationRule, alert: RegulatoryAlert | DecentralizedAlert): boolean {
    return rule.conditions.severity.includes(alert.severity) &&
           rule.conditions.type.includes(alert.type);
  }

  private async escalateAlert(alert: RegulatoryAlert | DecentralizedAlert, rule: EscalationRule): Promise<void> {
    alert.escalationLevel++;
    this.stats.escalatedAlerts++;

    logger.warn('Alert escalated', {
      alertId: alert.id,
      rule: rule.name,
      level: alert.escalationLevel
    });

    this.emit('alert_escalated', {
      alert,
      rule,
      timestamp: new Date()
    });
  }

  private shouldAutoProcess(alert: RegulatoryAlert | DecentralizedAlert): boolean {
    if (this.isRegulatoryAlert(alert)) {
      return this.config.regulatory.autoProcessing && alert.severity === 'low';
    }
    return false;
  }

  private async autoProcessAlert(alert: RegulatoryAlert | DecentralizedAlert): Promise<void> {
    alert.status = 'resolved';
    alert.resolvedAt = new Date();
    this.stats.autoResolvedAlerts++;

    logger.info('Alert auto-processed', {
      alertId: alert.id,
      type: alert.type,
      severity: alert.severity
    });
  }

  private isRegulatoryAlert(alert: RegulatoryAlert | DecentralizedAlert): alert is RegulatoryAlert {
    return 'regulatoryChange' in alert;
  }

  private isDecentralizedAlert(alert: RegulatoryAlert | DecentralizedAlert): alert is DecentralizedAlert {
    return 'privacyLevel' in alert;
  }

  private calculateTrends(alerts: (RegulatoryAlert | DecentralizedAlert)[]): {
    daily: number[];
    weekly: number[];
    monthly: number[];
  } {
    // Simplified trend calculation
    return {
      daily: [0, 1, 2, 1, 3, 2, 1], // Last 7 days
      weekly: [5, 8, 12, 7], // Last 4 weeks
      monthly: [25, 30, 28] // Last 3 months
    };
  }

  private calculateAverageSeverity(alerts: (RegulatoryAlert | DecentralizedAlert)[]): RiskLevel {
    if (alerts.length === 0) return 'low';
    
    const severityValues = { low: 1, medium: 2, high: 3, critical: 4 };
    const average = alerts.reduce((sum, alert) => sum + severityValues[alert.severity], 0) / alerts.length;
    
    if (average >= 3.5) return 'critical';
    if (average >= 2.5) return 'high';
    if (average >= 1.5) return 'medium';
    return 'low';
  }

  private generateWidgetData(widget: AlertWidget): any {
    // Mock widget data generation
    switch (widget.type) {
      case 'gauge':
        return { value: Math.floor(Math.random() * 50), maxValue: 50 };
      case 'chart':
        return {
          labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May'],
          data: [12, 19, 3, 5, 2]
        };
      case 'metric':
        return { value: 98.5, unit: '%' };
      default:
        return {};
    }
  }

  private getAlertsByStatus(): Record<string, number> {
    const statusCounts: Record<string, number> = {};
    for (const alert of this.alerts.values()) {
      statusCounts[alert.status] = (statusCounts[alert.status] || 0) + 1;
    }
    return statusCounts;
  }

  private generateAlertId(prefix: string): string {
    return `${prefix}_alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateDashboardId(): string {
    return `dashboard_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Event handlers

  private async handleAlertCreated(event: any): Promise<void> {
    logger.debug('Alert created event handled', { alertId: event.alert.id });
  }

  private async handleAlertEscalated(event: any): Promise<void> {
    logger.warn('Alert escalated event handled', { 
      alertId: event.alert.id, 
      rule: event.rule.name 
    });
  }

  private async handleAlertResolved(event: any): Promise<void> {
    logger.info('Alert resolved event handled', { alertId: event.alert.id });
  }
}