import { EventEmitter } from 'events';
import { PerformanceMetrics } from './performance-monitor';
import { PerformanceSLAManager, MetricValue } from './performance-sla-manager';

export interface AlertRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  conditions: AlertCondition[];
  actions: AlertAction[];
  cooldownPeriod: number; // milliseconds
  severity: 'info' | 'warning' | 'critical';
  tags: string[];
  createdAt: number;
  lastTriggered?: number;
}

export interface AlertCondition {
  metric: string;
  operator: 'gt' | 'gte' | 'lt' | 'lte' | 'eq' | 'ne';
  threshold: number;
  duration: number; // how long condition must be true (ms)
  aggregation?: 'avg' | 'max' | 'min' | 'sum' | 'count';
}

export interface AlertAction {
  type: 'email' | 'webhook' | 'slack' | 'pagerduty' | 'log';
  config: AlertActionConfig;
  enabled: boolean;
}

export interface AlertActionConfig {
  recipients?: string[];
  url?: string;
  channel?: string;
  message?: string;
  template?: string;
  headers?: Record<string, string>;
}

export interface ActiveAlert {
  id: string;
  ruleId: string;
  ruleName: string;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  triggeredAt: number;
  resolvedAt?: number;
  status: 'active' | 'resolved' | 'acknowledged';
  conditions: TriggeredCondition[];
  tags: string[];
  escalated: boolean;
}

export interface TriggeredCondition {
  metric: string;
  actualValue: number;
  threshold: number;
  operator: string;
  duration: number;
}

export interface AlertHistory {
  alertId: string;
  ruleId: string;
  event: 'triggered' | 'resolved' | 'acknowledged' | 'escalated';
  timestamp: number;
  message: string;
  metadata?: any;
}

export interface RegressionAlert {
  id: string;
  metric: string;
  baselineValue: number;
  currentValue: number;
  regressionPercent: number;
  significance: 'low' | 'medium' | 'high';
  detectedAt: number;
  trend: 'improving' | 'degrading';
  confidence: number; // 0-100
}

export class PerformanceAlertManager extends EventEmitter {
  private rules: Map<string, AlertRule> = new Map();
  private activeAlerts: Map<string, ActiveAlert> = new Map();
  private alertHistory: AlertHistory[] = [];
  private conditionStates: Map<string, ConditionState> = new Map();
  private slaManager: PerformanceSLAManager;

  constructor(slaManager: PerformanceSLAManager) {
    super();
    this.slaManager = slaManager;
    this.initializeDefaultRules();
  }

  private initializeDefaultRules(): void {
    // High Response Time Alert
    this.addRule({
      id: 'high-response-time',
      name: 'High Response Time',
      description: 'Alert when response time exceeds threshold',
      enabled: true,
      conditions: [
        {
          metric: 'response_time_p95',
          operator: 'gt',
          threshold: 1000,
          duration: 300000, // 5 minutes
          aggregation: 'avg'
        }
      ],
      actions: [
        {
          type: 'email',
          config: { recipients: ['dev-team@company.com'] },
          enabled: true
        },
        {
          type: 'slack',
          config: { 
            channel: '#alerts',
            message: 'Response time is high: {{metric}} = {{value}}ms (threshold: {{threshold}}ms)'
          },
          enabled: true
        }
      ],
      cooldownPeriod: 900000, // 15 minutes
      severity: 'warning',
      tags: ['performance', 'response-time'],
      createdAt: Date.now()
    });

    // High Error Rate Alert
    this.addRule({
      id: 'high-error-rate',
      name: 'High Error Rate',
      description: 'Alert when error rate exceeds threshold',
      enabled: true,
      conditions: [
        {
          metric: 'error_rate',
          operator: 'gt',
          threshold: 5, // 5%
          duration: 180000, // 3 minutes
          aggregation: 'avg'
        }
      ],
      actions: [
        {
          type: 'pagerduty',
          config: { message: 'High error rate detected: {{value}}%' },
          enabled: true
        },
        {
          type: 'webhook',
          config: { 
            url: 'https://hooks.company.com/alerts',
            headers: { 'Content-Type': 'application/json' }
          },
          enabled: true
        }
      ],
      cooldownPeriod: 600000, // 10 minutes
      severity: 'critical',
      tags: ['reliability', 'errors'],
      createdAt: Date.now()
    });

    // Resource Exhaustion Alert
    this.addRule({
      id: 'resource-exhaustion',
      name: 'Resource Exhaustion',
      description: 'Alert when system resources are critically high',
      enabled: true,
      conditions: [
        {
          metric: 'cpu_usage',
          operator: 'gt',
          threshold: 90,
          duration: 600000, // 10 minutes
          aggregation: 'avg'
        },
        {
          metric: 'memory_usage',
          operator: 'gt',
          threshold: 95,
          duration: 300000, // 5 minutes
          aggregation: 'avg'
        }
      ],
      actions: [
        {
          type: 'email',
          config: { recipients: ['ops-team@company.com', 'oncall@company.com'] },
          enabled: true
        }
      ],
      cooldownPeriod: 1800000, // 30 minutes
      severity: 'critical',
      tags: ['infrastructure', 'resources'],
      createdAt: Date.now()
    });

    // Low Throughput Alert
    this.addRule({
      id: 'low-throughput',
      name: 'Low Throughput',
      description: 'Alert when system throughput drops significantly',
      enabled: true,
      conditions: [
        {
          metric: 'throughput',
          operator: 'lt',
          threshold: 100, // requests per second
          duration: 600000, // 10 minutes
          aggregation: 'avg'
        }
      ],
      actions: [
        {
          type: 'slack',
          config: { 
            channel: '#performance',
            message: 'System throughput is low: {{value}} rps (threshold: {{threshold}} rps)'
          },
          enabled: true
        }
      ],
      cooldownPeriod: 1200000, // 20 minutes
      severity: 'warning',
      tags: ['performance', 'throughput'],
      createdAt: Date.now()
    });

    // SLA Violation Alert
    this.addRule({
      id: 'sla-violation',
      name: 'SLA Violation',
      description: 'Alert when SLA compliance drops below target',
      enabled: true,
      conditions: [
        {
          metric: 'sla_compliance',
          operator: 'lt',
          threshold: 99.0,
          duration: 300000, // 5 minutes
        }
      ],
      actions: [
        {
          type: 'email',
          config: { recipients: ['management@company.com', 'sre-team@company.com'] },
          enabled: true
        },
        {
          type: 'pagerduty',
          config: { message: 'SLA violation detected: {{value}}% compliance' },
          enabled: true
        }
      ],
      cooldownPeriod: 3600000, // 1 hour
      severity: 'critical',
      tags: ['sla', 'compliance'],
      createdAt: Date.now()
    });
  }

  addRule(rule: AlertRule): void {
    this.rules.set(rule.id, rule);
    this.emit('rule-added', rule);
  }

  updateRule(ruleId: string, updates: Partial<AlertRule>): void {
    const rule = this.rules.get(ruleId);
    if (!rule) {
      throw new Error(`Alert rule not found: ${ruleId}`);
    }

    const updatedRule = { ...rule, ...updates };
    this.rules.set(ruleId, updatedRule);
    this.emit('rule-updated', updatedRule);
  }

  removeRule(ruleId: string): void {
    const rule = this.rules.get(ruleId);
    if (!rule) {
      throw new Error(`Alert rule not found: ${ruleId}`);
    }

    this.rules.delete(ruleId);
    
    // Resolve any active alerts for this rule
    for (const [alertId, alert] of this.activeAlerts) {
      if (alert.ruleId === ruleId) {
        this.resolveAlert(alertId, 'Rule deleted');
      }
    }

    this.emit('rule-removed', rule);
  }

  enableRule(ruleId: string): void {
    this.updateRule(ruleId, { enabled: true });
  }

  disableRule(ruleId: string): void {
    this.updateRule(ruleId, { enabled: false });
  }

  evaluateMetrics(metrics: PerformanceMetrics[]): void {
    if (metrics.length === 0) return;

    const latestMetric = metrics[metrics.length - 1];
    const metricValues: MetricValue[] = [
      { name: 'response_time_p95', value: latestMetric.network.requests.p95Latency, timestamp: latestMetric.timestamp },
      { name: 'error_rate', value: (latestMetric.network.requests.failed / latestMetric.network.requests.total) * 100 || 0, timestamp: latestMetric.timestamp },
      { name: 'cpu_usage', value: latestMetric.resource.cpu.usage, timestamp: latestMetric.timestamp },
      { name: 'memory_usage', value: latestMetric.resource.memory.percentUsed, timestamp: latestMetric.timestamp },
      { name: 'throughput', value: latestMetric.network.requests.total, timestamp: latestMetric.timestamp }
    ];

    // Check SLA compliance
    const complianceReport = this.slaManager.generateComplianceReport('day');
    metricValues.push({
      name: 'sla_compliance',
      value: complianceReport.overallCompliance,
      timestamp: Date.now()
    });

    this.evaluateRules(metricValues);

    // Detect performance regressions
    this.detectRegressions(metricValues, metrics);
  }

  private evaluateRules(metricValues: MetricValue[]): void {
    for (const rule of this.rules.values()) {
      if (!rule.enabled) continue;

      this.evaluateRule(rule, metricValues);
    }
  }

  private evaluateRule(rule: AlertRule, metricValues: MetricValue[]): void {
    const now = Date.now();
    
    // Check cooldown period
    if (rule.lastTriggered && (now - rule.lastTriggered) < rule.cooldownPeriod) {
      return;
    }

    let allConditionsMet = true;
    const triggeredConditions: TriggeredCondition[] = [];

    for (const condition of rule.conditions) {
      const metricValue = metricValues.find(m => m.name === condition.metric);
      if (!metricValue) {
        allConditionsMet = false;
        continue;
      }

      const conditionMet = this.evaluateCondition(condition, metricValue, now);
      
      if (conditionMet) {
        triggeredConditions.push({
          metric: condition.metric,
          actualValue: metricValue.value,
          threshold: condition.threshold,
          operator: condition.operator,
          duration: condition.duration
        });
      } else {
        allConditionsMet = false;
      }
    }

    if (allConditionsMet && triggeredConditions.length > 0) {
      this.triggerAlert(rule, triggeredConditions);
    }
  }

  private evaluateCondition(condition: AlertCondition, metricValue: MetricValue, now: number): boolean {
    const stateKey = `${condition.metric}-${condition.operator}-${condition.threshold}`;
    const state = this.conditionStates.get(stateKey);

    const conditionMet = this.checkConditionOperator(condition.operator, metricValue.value, condition.threshold);

    if (conditionMet) {
      if (!state) {
        // First time condition is met
        this.conditionStates.set(stateKey, {
          firstTriggered: now,
          lastChecked: now,
          conditionMet: true
        });
        return false; // Need to wait for duration
      } else {
        // Update existing state
        state.lastChecked = now;
        state.conditionMet = true;
        
        // Check if duration threshold is met
        return (now - state.firstTriggered) >= condition.duration;
      }
    } else {
      // Condition not met, reset state
      if (state) {
        this.conditionStates.delete(stateKey);
      }
      return false;
    }
  }

  private checkConditionOperator(operator: string, actual: number, threshold: number): boolean {
    switch (operator) {
      case 'gt': return actual > threshold;
      case 'gte': return actual >= threshold;
      case 'lt': return actual < threshold;
      case 'lte': return actual <= threshold;
      case 'eq': return actual === threshold;
      case 'ne': return actual !== threshold;
      default: return false;
    }
  }

  private triggerAlert(rule: AlertRule, conditions: TriggeredCondition[]): void {
    const alertId = `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const alert: ActiveAlert = {
      id: alertId,
      ruleId: rule.id,
      ruleName: rule.name,
      severity: rule.severity,
      message: this.generateAlertMessage(rule, conditions),
      triggeredAt: Date.now(),
      status: 'active',
      conditions,
      tags: rule.tags,
      escalated: false
    };

    this.activeAlerts.set(alertId, alert);
    
    // Update rule's last triggered time
    rule.lastTriggered = Date.now();

    // Execute alert actions
    this.executeAlertActions(rule, alert);

    // Add to history
    this.addToHistory(alertId, rule.id, 'triggered', alert.message);

    this.emit('alert-triggered', alert);
  }

  private generateAlertMessage(rule: AlertRule, conditions: TriggeredCondition[]): string {
    if (conditions.length === 1) {
      const condition = conditions[0];
      return `${rule.name}: ${condition.metric} is ${condition.actualValue} (threshold: ${condition.threshold})`;
    }

    const conditionMessages = conditions.map(c => 
      `${c.metric}: ${c.actualValue} (${c.operator} ${c.threshold})`
    ).join(', ');

    return `${rule.name}: Multiple conditions triggered - ${conditionMessages}`;
  }

  private executeAlertActions(rule: AlertRule, alert: ActiveAlert): void {
    for (const action of rule.actions) {
      if (!action.enabled) continue;

      try {
        this.executeAction(action, alert, rule);
      } catch (error) {
        console.error(`Failed to execute alert action ${action.type}:`, error);
        this.emit('action-failed', { action, alert, error });
      }
    }
  }

  private executeAction(action: AlertAction, alert: ActiveAlert, rule: AlertRule): void {
    const message = this.interpolateMessage(action.config.message || alert.message, alert);

    switch (action.type) {
      case 'email':
        this.sendEmail(action.config, message, alert);
        break;
      
      case 'slack':
        this.sendSlackMessage(action.config, message, alert);
        break;
      
      case 'webhook':
        this.sendWebhook(action.config, alert);
        break;
      
      case 'pagerduty':
        this.sendPagerDuty(action.config, message, alert);
        break;
      
      case 'log':
        this.logAlert(message, alert);
        break;
    }
  }

  private interpolateMessage(template: string, alert: ActiveAlert): string {
    let message = template;
    
    if (alert.conditions.length > 0) {
      const condition = alert.conditions[0];
      message = message
        .replace(/\{\{metric\}\}/g, condition.metric)
        .replace(/\{\{value\}\}/g, condition.actualValue.toString())
        .replace(/\{\{threshold\}\}/g, condition.threshold.toString())
        .replace(/\{\{operator\}\}/g, condition.operator);
    }
    
    message = message
      .replace(/\{\{severity\}\}/g, alert.severity)
      .replace(/\{\{ruleName\}\}/g, alert.ruleName)
      .replace(/\{\{triggeredAt\}\}/g, new Date(alert.triggeredAt).toISOString());

    return message;
  }

  private sendEmail(config: AlertActionConfig, message: string, alert: ActiveAlert): void {
    // In a real implementation, this would integrate with an email service
    console.log(`Email Alert: ${message}`, {
      recipients: config.recipients,
      alert
    });
    this.emit('email-sent', { config, message, alert });
  }

  private sendSlackMessage(config: AlertActionConfig, message: string, alert: ActiveAlert): void {
    // In a real implementation, this would integrate with Slack API
    console.log(`Slack Alert [${config.channel}]: ${message}`, { alert });
    this.emit('slack-sent', { config, message, alert });
  }

  private sendWebhook(config: AlertActionConfig, alert: ActiveAlert): void {
    // In a real implementation, this would make an HTTP request
    const payload = {
      alert,
      timestamp: Date.now(),
      severity: alert.severity
    };
    
    console.log(`Webhook Alert [${config.url}]:`, payload);
    this.emit('webhook-sent', { config, payload });
  }

  private sendPagerDuty(config: AlertActionConfig, message: string, alert: ActiveAlert): void {
    // In a real implementation, this would integrate with PagerDuty API
    console.log(`PagerDuty Alert: ${message}`, { alert });
    this.emit('pagerduty-sent', { config, message, alert });
  }

  private logAlert(message: string, alert: ActiveAlert): void {
    console.log(`ALERT [${alert.severity.toUpperCase()}]: ${message}`, {
      alertId: alert.id,
      ruleId: alert.ruleId,
      triggeredAt: new Date(alert.triggeredAt).toISOString()
    });
  }

  resolveAlert(alertId: string, reason?: string): void {
    const alert = this.activeAlerts.get(alertId);
    if (!alert) {
      throw new Error(`Active alert not found: ${alertId}`);
    }

    alert.status = 'resolved';
    alert.resolvedAt = Date.now();

    this.activeAlerts.delete(alertId);
    this.addToHistory(alertId, alert.ruleId, 'resolved', reason || 'Manual resolution');

    this.emit('alert-resolved', alert);
  }

  acknowledgeAlert(alertId: string, user?: string): void {
    const alert = this.activeAlerts.get(alertId);
    if (!alert) {
      throw new Error(`Active alert not found: ${alertId}`);
    }

    alert.status = 'acknowledged';
    this.addToHistory(alertId, alert.ruleId, 'acknowledged', `Acknowledged by ${user || 'system'}`);

    this.emit('alert-acknowledged', alert);
  }

  private detectRegressions(metricValues: MetricValue[], historicalMetrics: PerformanceMetrics[]): void {
    if (historicalMetrics.length < 10) return; // Need enough data for regression analysis

    for (const metric of metricValues) {
      const regression = this.analyzeRegression(metric, historicalMetrics);
      if (regression) {
        const regressionAlert: RegressionAlert = {
          id: `regression-${Date.now()}-${metric.name}`,
          metric: metric.name,
          baselineValue: regression.baseline,
          currentValue: metric.value,
          regressionPercent: regression.percentChange,
          significance: regression.significance,
          detectedAt: Date.now(),
          trend: regression.trend,
          confidence: regression.confidence
        };

        this.emit('regression-detected', regressionAlert);
      }
    }
  }

  private analyzeRegression(currentMetric: MetricValue, historicalMetrics: PerformanceMetrics[]): any {
    // Simple regression detection - in production, this would be more sophisticated
    const recentWindow = historicalMetrics.slice(-10);
    const baselineWindow = historicalMetrics.slice(-30, -10);

    if (baselineWindow.length === 0) return null;

    const getMetricValue = (metrics: PerformanceMetrics[], metricName: string): number => {
      switch (metricName) {
        case 'response_time_p95':
          return metrics.network.requests.p95Latency;
        case 'error_rate':
          return (metrics.network.requests.failed / metrics.network.requests.total) * 100 || 0;
        case 'cpu_usage':
          return metrics.resource.cpu.usage;
        case 'memory_usage':
          return metrics.resource.memory.percentUsed;
        case 'throughput':
          return metrics.network.requests.total;
        default:
          return 0;
      }
    };

    const baselineValues = baselineWindow.map(m => getMetricValue(m, currentMetric.name));
    const recentValues = recentWindow.map(m => getMetricValue(m, currentMetric.name));

    const baselineAvg = baselineValues.reduce((a, b) => a + b, 0) / baselineValues.length;
    const recentAvg = recentValues.reduce((a, b) => a + b, 0) / recentValues.length;

    const percentChange = ((recentAvg - baselineAvg) / baselineAvg) * 100;
    
    // Determine if this is a significant regression
    const isSignificant = Math.abs(percentChange) > 20; // 20% change threshold
    const isRegression = (
      (['response_time_p95', 'error_rate', 'cpu_usage', 'memory_usage'].includes(currentMetric.name) && percentChange > 0) ||
      (['throughput'].includes(currentMetric.name) && percentChange < 0)
    );

    if (!isSignificant || !isRegression) return null;

    return {
      baseline: baselineAvg,
      percentChange: Math.abs(percentChange),
      significance: Math.abs(percentChange) > 50 ? 'high' : Math.abs(percentChange) > 30 ? 'medium' : 'low',
      trend: percentChange > 0 ? 'degrading' : 'improving',
      confidence: Math.min(95, Math.abs(percentChange) * 2) // Simple confidence calculation
    };
  }

  private addToHistory(alertId: string, ruleId: string, event: 'triggered' | 'resolved' | 'acknowledged' | 'escalated', message: string): void {
    this.alertHistory.push({
      alertId,
      ruleId,
      event,
      timestamp: Date.now(),
      message
    });

    // Keep only last 1000 history entries
    if (this.alertHistory.length > 1000) {
      this.alertHistory = this.alertHistory.slice(-1000);
    }
  }

  getActiveAlerts(): ActiveAlert[] {
    return Array.from(this.activeAlerts.values());
  }

  getAlertHistory(limit: number = 100): AlertHistory[] {
    return this.alertHistory
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  getRules(): AlertRule[] {
    return Array.from(this.rules.values());
  }

  getRule(ruleId: string): AlertRule | undefined {
    return this.rules.get(ruleId);
  }

  generateAlertReport(period: { startTime: number; endTime: number }): AlertReport {
    const relevantHistory = this.alertHistory.filter(h => 
      h.timestamp >= period.startTime && h.timestamp <= period.endTime
    );

    const triggeredAlerts = relevantHistory.filter(h => h.event === 'triggered');
    const resolvedAlerts = relevantHistory.filter(h => h.event === 'resolved');

    const alertsByRule = new Map<string, number>();
    const alertsBySeverity = new Map<string, number>();

    triggeredAlerts.forEach(alert => {
      alertsByRule.set(alert.ruleId, (alertsByRule.get(alert.ruleId) || 0) + 1);
      
      const rule = this.rules.get(alert.ruleId);
      if (rule) {
        alertsBySeverity.set(rule.severity, (alertsBySeverity.get(rule.severity) || 0) + 1);
      }
    });

    const mttr = this.calculateMTTR(relevantHistory);

    return {
      period,
      summary: {
        totalAlerts: triggeredAlerts.length,
        resolvedAlerts: resolvedAlerts.length,
        activeAlerts: this.activeAlerts.size,
        meanTimeToResolve: mttr
      },
      alertsByRule: Object.fromEntries(alertsByRule),
      alertsBySeverity: Object.fromEntries(alertsBySeverity),
      topRules: this.getTopAlertingRules(alertsByRule),
      recommendations: this.generateAlertRecommendations(alertsByRule, alertsBySeverity)
    };
  }

  private calculateMTTR(history: AlertHistory[]): number {
    const resolvedAlerts = history.filter(h => h.event === 'resolved');
    if (resolvedAlerts.length === 0) return 0;

    let totalResolutionTime = 0;
    let count = 0;

    for (const resolved of resolvedAlerts) {
      const triggered = history.find(h => 
        h.alertId === resolved.alertId && h.event === 'triggered'
      );
      
      if (triggered) {
        totalResolutionTime += resolved.timestamp - triggered.timestamp;
        count++;
      }
    }

    return count > 0 ? totalResolutionTime / count : 0;
  }

  private getTopAlertingRules(alertsByRule: Map<string, number>): string[] {
    return Array.from(alertsByRule.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([ruleId]) => this.rules.get(ruleId)?.name || ruleId);
  }

  private generateAlertRecommendations(alertsByRule: Map<string, number>, alertsBySeverity: Map<string, number>): string[] {
    const recommendations: string[] = [];

    const totalAlerts = Array.from(alertsByRule.values()).reduce((a, b) => a + b, 0);
    const criticalAlerts = alertsBySeverity.get('critical') || 0;

    if (totalAlerts > 100) {
      recommendations.push('High alert volume detected - consider adjusting thresholds or consolidating rules');
    }

    if (criticalAlerts > totalAlerts * 0.5) {
      recommendations.push('Too many critical alerts - review severity levels and escalation policies');
    }

    const topRule = Array.from(alertsByRule.entries()).sort((a, b) => b[1] - a[1])[0];
    if (topRule && topRule[1] > totalAlerts * 0.3) {
      const ruleName = this.rules.get(topRule[0])?.name || topRule[0];
      recommendations.push(`Rule "${ruleName}" is generating excessive alerts - investigate root cause`);
    }

    if (this.activeAlerts.size > 20) {
      recommendations.push('Many unresolved alerts - review alert management processes');
    }

    if (recommendations.length === 0) {
      recommendations.push('Alert system is operating within normal parameters');
    }

    return recommendations;
  }
}

interface ConditionState {
  firstTriggered: number;
  lastChecked: number;
  conditionMet: boolean;
}

interface AlertReport {
  period: { startTime: number; endTime: number };
  summary: {
    totalAlerts: number;
    resolvedAlerts: number;
    activeAlerts: number;
    meanTimeToResolve: number;
  };
  alertsByRule: Record<string, number>;
  alertsBySeverity: Record<string, number>;
  topRules: string[];
  recommendations: string[];
}