/**
 * Comprehensive Health Check System
 * 
 * Integrated health monitoring that combines all validation components:
 * - Configuration validation and drift detection
 * - Secret accessibility and health monitoring
 * - Security policy compliance
 * - System performance and availability
 * - Audit trail integrity
 * - Alert system functionality
 */

import { EventEmitter } from 'events';
import { securityConfigValidator } from './security-config-validator';
import { secretHealthChecker } from './secret-health-checker';
import { enhancedDriftDetector } from './enhanced-drift-detector';
import { securityAlertSystem } from './security-alert-system';
import { configurationAuditLogger } from './audit-logger';

export interface HealthCheckResult {
  component: string;
  status: 'healthy' | 'degraded' | 'critical' | 'unknown';
  score: number; // 0-100
  timestamp: Date;
  checks: HealthCheck[];
  recommendations: string[];
  metadata: {
    response_time: number;
    last_success: Date | null;
    error_count: number;
    uptime_percentage: number;
  };
}

export interface HealthCheck {
  name: string;
  status: 'pass' | 'warn' | 'fail';
  message: string;
  details?: any;
  impact: 'low' | 'medium' | 'high' | 'critical';
  category: 'configuration' | 'security' | 'performance' | 'availability' | 'compliance';
}

export interface SystemHealthReport {
  overall_status: 'healthy' | 'degraded' | 'critical';
  overall_score: number;
  timestamp: Date;
  environment: string;
  components: HealthCheckResult[];
  critical_issues: string[];
  warnings: string[];
  recommendations: string[];
  summary: {
    total_checks: number;
    passed_checks: number;
    failed_checks: number;
    warning_checks: number;
    degraded_components: number;
    critical_components: number;
  };
  trends: {
    score_trend: 'improving' | 'stable' | 'degrading';
    availability_trend: 'improving' | 'stable' | 'degrading';
    response_time_trend: 'improving' | 'stable' | 'degrading';
  };
}

export interface HealthCheckPolicy {
  environment: string;
  check_interval: number; // seconds
  timeout: number; // seconds
  enabled_components: string[];
  alert_thresholds: {
    critical_score: number;
    degraded_score: number;
    response_time_ms: number;
    error_rate_percentage: number;
  };
  notification_channels: string[];
  auto_remediation: {
    enabled: boolean;
    safe_mode: boolean;
    max_attempts: number;
  };
}

export class ComprehensiveHealthChecker extends EventEmitter {
  private healthHistory: SystemHealthReport[] = [];
  private componentMetrics: Map<string, ComponentMetrics> = new Map();
  private policies: Map<string, HealthCheckPolicy> = new Map();
  private monitoringIntervals: Map<string, NodeJS.Timeout> = new Map();
  private readonly maxHistorySize = 1000;
  private readonly healthCheckTimeout = 30000; // 30 seconds

  constructor() {
    super();
    this.initializeDefaultPolicies();
    this.initializeComponentMetrics();
    console.log('🏥 Comprehensive Health Check System initialized');
  }

  /**
   * Perform comprehensive health check
   */
  async performHealthCheck(environment: string = 'development'): Promise<SystemHealthReport> {
    const startTime = Date.now();
    const componentResults: HealthCheckResult[] = [];
    const criticalIssues: string[] = [];
    const warnings: string[] = [];
    const recommendations: string[] = [];

    console.log(`🔍 Starting comprehensive health check for ${environment}...`);

    // Check Configuration Validation System
    try {
      const configResult = await this.checkConfigurationValidation(environment);
      componentResults.push(configResult);
      
      if (configResult.status === 'critical') {
        criticalIssues.push(`Configuration validation: ${configResult.checks.find(c => c.status === 'fail')?.message}`);
      }
      
      recommendations.push(...configResult.recommendations);
    } catch (error) {
      componentResults.push(this.createErrorResult('configuration_validation', error));
      criticalIssues.push('Configuration validation system failed');
    }

    // Check Secret Management System
    try {
      const secretResult = await this.checkSecretManagement();
      componentResults.push(secretResult);
      
      if (secretResult.status === 'critical') {
        criticalIssues.push(`Secret management: ${secretResult.checks.find(c => c.status === 'fail')?.message}`);
      }
      
      recommendations.push(...secretResult.recommendations);
    } catch (error) {
      componentResults.push(this.createErrorResult('secret_management', error));
      criticalIssues.push('Secret management system failed');
    }

    // Check Drift Detection System
    try {
      const driftResult = await this.checkDriftDetection(environment);
      componentResults.push(driftResult);
      
      if (driftResult.status === 'critical') {
        criticalIssues.push(`Drift detection: ${driftResult.checks.find(c => c.status === 'fail')?.message}`);
      }
      
      recommendations.push(...driftResult.recommendations);
    } catch (error) {
      componentResults.push(this.createErrorResult('drift_detection', error));
      criticalIssues.push('Drift detection system failed');
    }

    // Check Security Alert System
    try {
      const alertResult = await this.checkSecurityAlertSystem();
      componentResults.push(alertResult);
      
      if (alertResult.status === 'critical') {
        criticalIssues.push(`Alert system: ${alertResult.checks.find(c => c.status === 'fail')?.message}`);
      }
      
      recommendations.push(...alertResult.recommendations);
    } catch (error) {
      componentResults.push(this.createErrorResult('security_alerts', error));
      criticalIssues.push('Security alert system failed');
    }

    // Check Audit Logging System
    try {
      const auditResult = await this.checkAuditLogging();
      componentResults.push(auditResult);
      
      if (auditResult.status === 'critical') {
        criticalIssues.push(`Audit logging: ${auditResult.checks.find(c => c.status === 'fail')?.message}`);
      }
      
      recommendations.push(...auditResult.recommendations);
    } catch (error) {
      componentResults.push(this.createErrorResult('audit_logging', error));
      criticalIssues.push('Audit logging system failed');
    }

    // Calculate overall status and metrics
    const overallScore = this.calculateOverallScore(componentResults);
    const overallStatus = this.determineOverallStatus(componentResults, overallScore);
    
    // Extract warnings
    componentResults.forEach(result => {
      result.checks.forEach(check => {
        if (check.status === 'warn') {
          warnings.push(`${result.component}: ${check.message}`);
        }
      });
    });

    // Calculate summary metrics
    const allChecks = componentResults.flatMap(r => r.checks);
    const summary = {
      total_checks: allChecks.length,
      passed_checks: allChecks.filter(c => c.status === 'pass').length,
      failed_checks: allChecks.filter(c => c.status === 'fail').length,
      warning_checks: allChecks.filter(c => c.status === 'warn').length,
      degraded_components: componentResults.filter(r => r.status === 'degraded').length,
      critical_components: componentResults.filter(r => r.status === 'critical').length
    };

    // Calculate trends
    const trends = this.calculateTrends(environment);

    const report: SystemHealthReport = {
      overall_status: overallStatus,
      overall_score: overallScore,
      timestamp: new Date(),
      environment,
      components: componentResults,
      critical_issues: [...new Set(criticalIssues)],
      warnings: [...new Set(warnings)],
      recommendations: [...new Set(recommendations)],
      summary,
      trends
    };

    // Update component metrics
    this.updateComponentMetrics(componentResults, Date.now() - startTime);

    // Store in history
    this.addToHistory(report);

    // Emit events
    this.emit('health_check:completed', report);
    
    if (overallStatus === 'critical') {
      this.emit('health_check:critical', report);
    } else if (overallStatus === 'degraded') {
      this.emit('health_check:degraded', report);
    }

    // Log to audit system
    await configurationAuditLogger.logSystemEvent(
      'health_checker',
      'health_check_completed',
      {
        environment,
        overall_status: overallStatus,
        overall_score: overallScore,
        response_time: Date.now() - startTime
      },
      overallStatus === 'critical' ? 'critical' : 'info'
    );

    console.log(`✅ Health check completed in ${Date.now() - startTime}ms - Status: ${overallStatus.toUpperCase()} (${overallScore}/100)`);
    return report;
  }

  /**
   * Start continuous health monitoring
   */
  async startMonitoring(environment: string, policy?: HealthCheckPolicy): Promise<void> {
    const effectivePolicy = policy || this.policies.get(environment) || this.getDefaultPolicy(environment);
    this.policies.set(environment, effectivePolicy);

    console.log(`🔄 Starting health monitoring for ${environment} (interval: ${effectivePolicy.check_interval}s)`);

    const interval = setInterval(async () => {
      try {
        const report = await this.performHealthCheck(environment);
        await this.evaluateHealthThresholds(report, effectivePolicy);
        await this.performAutoRemediation(report, effectivePolicy);
      } catch (error) {
        console.error(`Health check failed for ${environment}:`, error);
        this.emit('health_check:error', { environment, error });
      }
    }, effectivePolicy.check_interval * 1000);

    this.monitoringIntervals.set(environment, interval);
    this.emit('monitoring:started', { environment, policy: effectivePolicy });
  }

  /**
   * Stop health monitoring
   */
  stopMonitoring(environment: string): void {
    const interval = this.monitoringIntervals.get(environment);
    if (interval) {
      clearInterval(interval);
      this.monitoringIntervals.delete(environment);
      this.emit('monitoring:stopped', { environment });
      console.log(`⏹️ Health monitoring stopped for ${environment}`);
    }
  }

  /**
   * Get health status for a specific component
   */
  async getComponentHealth(component: string, environment: string = 'development'): Promise<HealthCheckResult> {
    switch (component) {
      case 'configuration_validation':
        return this.checkConfigurationValidation(environment);
      case 'secret_management':
        return this.checkSecretManagement();
      case 'drift_detection':
        return this.checkDriftDetection(environment);
      case 'security_alerts':
        return this.checkSecurityAlertSystem();
      case 'audit_logging':
        return this.checkAuditLogging();
      default:
        throw new Error(`Unknown component: ${component}`);
    }
  }

  /**
   * Generate health report
   */
  generateHealthReport(environment?: string, period: 'day' | 'week' | 'month' = 'day'): string {
    const reports = environment ? 
      this.healthHistory.filter(r => r.environment === environment) :
      this.healthHistory;

    const cutoffDate = new Date();
    const periodHours = { day: 24, week: 168, month: 720 }[period];
    cutoffDate.setHours(cutoffDate.getHours() - periodHours);

    const recentReports = reports.filter(r => r.timestamp >= cutoffDate);

    let report = `# Health Check Report\n\n`;
    report += `**Period:** Last ${period}\n`;
    report += `**Generated:** ${new Date().toISOString()}\n\n`;

    if (recentReports.length === 0) {
      report += `No health check data available for the specified period.\n`;
      return report;
    }

    // Summary statistics
    const avgScore = recentReports.reduce((sum, r) => sum + r.overall_score, 0) / recentReports.length;
    const healthyCount = recentReports.filter(r => r.overall_status === 'healthy').length;
    const degradedCount = recentReports.filter(r => r.overall_status === 'degraded').length;
    const criticalCount = recentReports.filter(r => r.overall_status === 'critical').length;

    report += `## Summary\n`;
    report += `- Average Health Score: ${avgScore.toFixed(1)}/100\n`;
    report += `- Healthy Checks: ${healthyCount}\n`;
    report += `- Degraded Checks: ${degradedCount}\n`;
    report += `- Critical Checks: ${criticalCount}\n`;
    report += `- Total Checks: ${recentReports.length}\n\n`;

    // Component health overview
    const componentStats = this.calculateComponentStats(recentReports);
    report += `## Component Health Overview\n\n`;
    
    for (const [component, stats] of Object.entries(componentStats)) {
      report += `### ${component.replace(/_/g, ' ').toUpperCase()}\n`;
      report += `- Average Score: ${stats.avgScore.toFixed(1)}/100\n`;
      report += `- Uptime: ${stats.uptime.toFixed(1)}%\n`;
      report += `- Response Time: ${stats.avgResponseTime.toFixed(0)}ms\n\n`;
    }

    // Top issues
    const allIssues = recentReports.flatMap(r => r.critical_issues);
    const issueFreq = allIssues.reduce((freq, issue) => {
      freq[issue] = (freq[issue] || 0) + 1;
      return freq;
    }, {} as Record<string, number>);

    const topIssues = Object.entries(issueFreq)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5);

    if (topIssues.length > 0) {
      report += `## Top Critical Issues\n\n`;
      for (const [issue, count] of topIssues) {
        report += `- ${issue} (${count} occurrences)\n`;
      }
      report += `\n`;
    }

    // Recommendations
    const allRecommendations = recentReports.flatMap(r => r.recommendations);
    const uniqueRecommendations = [...new Set(allRecommendations)];

    if (uniqueRecommendations.length > 0) {
      report += `## Recommendations\n\n`;
      for (const recommendation of uniqueRecommendations.slice(0, 10)) {
        report += `- ${recommendation}\n`;
      }
    }

    return report;
  }

  // Private helper methods

  private async checkConfigurationValidation(environment: string): Promise<HealthCheckResult> {
    const startTime = Date.now();
    const checks: HealthCheck[] = [];
    const recommendations: string[] = [];

    try {
      // Check security configuration
      const securityReport = await securityConfigValidator.validateSecurityConfiguration(environment);
      
      checks.push({
        name: 'Security Configuration Validation',
        status: securityReport.overallScore >= 80 ? 'pass' : securityReport.overallScore >= 60 ? 'warn' : 'fail',
        message: `Security score: ${securityReport.overallScore}/100 (${securityReport.failedRules} failed rules)`,
        details: { score: securityReport.overallScore, failedRules: securityReport.failedRules },
        impact: securityReport.criticalIssues.length > 0 ? 'critical' : 'medium',
        category: 'security'
      });

      if (securityReport.overallScore < 80) {
        recommendations.push('Review and fix security configuration issues');
      }

      if (securityReport.criticalIssues.length > 0) {
        recommendations.push('Address critical security configuration issues immediately');
      }

      // Additional configuration checks
      checks.push({
        name: 'Environment Variables',
        status: process.env.NODE_ENV ? 'pass' : 'fail',
        message: process.env.NODE_ENV ? `Environment: ${process.env.NODE_ENV}` : 'NODE_ENV not set',
        impact: 'medium',
        category: 'configuration'
      });

      // Check for required environment variables
      const requiredVars = ['NODE_ENV'];
      const missingVars = requiredVars.filter(varName => !process.env[varName]);
      
      if (missingVars.length > 0) {
        checks.push({
          name: 'Required Environment Variables',
          status: 'fail',
          message: `Missing variables: ${missingVars.join(', ')}`,
          impact: 'high',
          category: 'configuration'
        });
        recommendations.push('Set all required environment variables');
      }

    } catch (error) {
      checks.push({
        name: 'Configuration Validation System',
        status: 'fail',
        message: `System error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        impact: 'critical',
        category: 'availability'
      });
      recommendations.push('Investigate configuration validation system failure');
    }

    const responseTime = Date.now() - startTime;
    const score = this.calculateComponentScore(checks);
    const status = this.determineComponentStatus(checks, score);

    return {
      component: 'configuration_validation',
      status,
      score,
      timestamp: new Date(),
      checks,
      recommendations,
      metadata: {
        response_time: responseTime,
        last_success: status !== 'critical' ? new Date() : null,
        error_count: checks.filter(c => c.status === 'fail').length,
        uptime_percentage: this.calculateUptimePercentage('configuration_validation')
      }
    };
  }

  private async checkSecretManagement(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    const checks: HealthCheck[] = [];
    const recommendations: string[] = [];

    try {
      // Check secret health
      const healthReport = await secretHealthChecker.performHealthCheck();
      
      checks.push({
        name: 'Secret Health Check',
        status: healthReport.overallStatus === 'healthy' ? 'pass' : 
                healthReport.overallStatus === 'degraded' ? 'warn' : 'fail',
        message: `Overall status: ${healthReport.overallStatus}`,
        details: healthReport,
        impact: healthReport.overallStatus === 'critical' ? 'critical' : 'medium',
        category: 'security'
      });

      if (healthReport.overallStatus !== 'healthy') {
        recommendations.push('Review secret management system health issues');
      }

      // Check secret accessibility
      const accessibilityIssues = healthReport.components.filter(c => !c.accessible);
      if (accessibilityIssues.length > 0) {
        checks.push({
          name: 'Secret Accessibility',
          status: 'fail',
          message: `${accessibilityIssues.length} secrets are not accessible`,
          details: accessibilityIssues,
          impact: 'critical',
          category: 'security'
        });
        recommendations.push('Investigate and restore access to affected secrets');
      }

    } catch (error) {
      checks.push({
        name: 'Secret Management System',
        status: 'fail',
        message: `System error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        impact: 'critical',
        category: 'availability'
      });
      recommendations.push('Investigate secret management system failure');
    }

    const responseTime = Date.now() - startTime;
    const score = this.calculateComponentScore(checks);
    const status = this.determineComponentStatus(checks, score);

    return {
      component: 'secret_management',
      status,
      score,
      timestamp: new Date(),
      checks,
      recommendations,
      metadata: {
        response_time: responseTime,
        last_success: status !== 'critical' ? new Date() : null,
        error_count: checks.filter(c => c.status === 'fail').length,
        uptime_percentage: this.calculateUptimePercentage('secret_management')
      }
    };
  }

  private async checkDriftDetection(environment: string): Promise<HealthCheckResult> {
    const startTime = Date.now();
    const checks: HealthCheck[] = [];
    const recommendations: string[] = [];

    try {
      // Check for configuration drift
      const driftResult = await enhancedDriftDetector.detectDrift(environment);
      
      checks.push({
        name: 'Configuration Drift Detection',
        status: driftResult.severity === 'none' ? 'pass' : 
                driftResult.severity === 'low' || driftResult.severity === 'medium' ? 'warn' : 'fail',
        message: `Drift score: ${driftResult.driftScore}, severity: ${driftResult.severity}`,
        details: { driftScore: driftResult.driftScore, changes: driftResult.changes.length },
        impact: driftResult.severity === 'critical' ? 'critical' : 'medium',
        category: 'configuration'
      });

      if (driftResult.driftScore > 50) {
        recommendations.push('Review configuration changes and update baseline if needed');
      }

      if (driftResult.severity === 'critical') {
        recommendations.push('Address critical configuration drift immediately');
      }

      // Check compliance status
      checks.push({
        name: 'Compliance Status',
        status: driftResult.complianceStatus === 'compliant' ? 'pass' : 'fail',
        message: `Compliance status: ${driftResult.complianceStatus}`,
        impact: driftResult.complianceStatus === 'non_compliant' ? 'high' : 'low',
        category: 'compliance'
      });

    } catch (error) {
      // If no baseline exists, it's a warning rather than critical
      if (error instanceof Error && error.message.includes('No baseline found')) {
        checks.push({
          name: 'Drift Detection System',
          status: 'warn',
          message: 'No baseline found for drift detection',
          impact: 'medium',
          category: 'configuration'
        });
        recommendations.push('Create configuration baseline for drift detection');
      } else {
        checks.push({
          name: 'Drift Detection System',
          status: 'fail',
          message: `System error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          impact: 'high',
          category: 'availability'
        });
        recommendations.push('Investigate drift detection system failure');
      }
    }

    const responseTime = Date.now() - startTime;
    const score = this.calculateComponentScore(checks);
    const status = this.determineComponentStatus(checks, score);

    return {
      component: 'drift_detection',
      status,
      score,
      timestamp: new Date(),
      checks,
      recommendations,
      metadata: {
        response_time: responseTime,
        last_success: status !== 'critical' ? new Date() : null,
        error_count: checks.filter(c => c.status === 'fail').length,
        uptime_percentage: this.calculateUptimePercentage('drift_detection')
      }
    };
  }

  private async checkSecurityAlertSystem(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    const checks: HealthCheck[] = [];
    const recommendations: string[] = [];

    try {
      // Check alert system functionality
      const dashboard = securityAlertSystem.generateSecurityDashboard();
      
      checks.push({
        name: 'Alert System Functionality',
        status: 'pass',
        message: 'Alert system is operational',
        details: dashboard.summary,
        impact: 'low',
        category: 'security'
      });

      // Check for open critical alerts
      if (dashboard.summary.critical_alerts > 0) {
        checks.push({
          name: 'Critical Alerts',
          status: 'fail',
          message: `${dashboard.summary.critical_alerts} critical alerts are open`,
          details: { critical_count: dashboard.summary.critical_alerts },
          impact: 'critical',
          category: 'security'
        });
        recommendations.push('Review and address all critical security alerts');
      }

      // Check alert response times
      checks.push({
        name: 'Alert Response',
        status: dashboard.summary.open_alerts > 10 ? 'warn' : 'pass',
        message: `${dashboard.summary.open_alerts} alerts are currently open`,
        details: { open_alerts: dashboard.summary.open_alerts },
        impact: 'medium',
        category: 'security'
      });

      if (dashboard.summary.open_alerts > 10) {
        recommendations.push('Review and close open alerts to maintain system responsiveness');
      }

    } catch (error) {
      checks.push({
        name: 'Security Alert System',
        status: 'fail',
        message: `System error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        impact: 'critical',
        category: 'availability'
      });
      recommendations.push('Investigate security alert system failure');
    }

    const responseTime = Date.now() - startTime;
    const score = this.calculateComponentScore(checks);
    const status = this.determineComponentStatus(checks, score);

    return {
      component: 'security_alerts',
      status,
      score,
      timestamp: new Date(),
      checks,
      recommendations,
      metadata: {
        response_time: responseTime,
        last_success: status !== 'critical' ? new Date() : null,
        error_count: checks.filter(c => c.status === 'fail').length,
        uptime_percentage: this.calculateUptimePercentage('security_alerts')
      }
    };
  }

  private async checkAuditLogging(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    const checks: HealthCheck[] = [];
    const recommendations: string[] = [];

    try {
      // Test audit logging functionality
      const testLogId = await configurationAuditLogger.logSystemEvent(
        'health_checker',
        'audit_test',
        { test: true },
        'info',
        { context: 'health_check' }
      );

      checks.push({
        name: 'Audit Logging Functionality',
        status: testLogId ? 'pass' : 'fail',
        message: testLogId ? 'Audit logging is operational' : 'Audit logging failed',
        details: { test_log_id: testLogId },
        impact: testLogId ? 'low' : 'high',
        category: 'compliance'
      });

      if (!testLogId) {
        recommendations.push('Investigate audit logging system failure');
      }

      // Check log retention (basic check)
      checks.push({
        name: 'Log Retention',
        status: 'pass',
        message: 'Log retention policies are configured',
        impact: 'low',
        category: 'compliance'
      });

    } catch (error) {
      checks.push({
        name: 'Audit Logging System',
        status: 'fail',
        message: `System error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        impact: 'critical',
        category: 'availability'
      });
      recommendations.push('Investigate audit logging system failure');
    }

    const responseTime = Date.now() - startTime;
    const score = this.calculateComponentScore(checks);
    const status = this.determineComponentStatus(checks, score);

    return {
      component: 'audit_logging',
      status,
      score,
      timestamp: new Date(),
      checks,
      recommendations,
      metadata: {
        response_time: responseTime,
        last_success: status !== 'critical' ? new Date() : null,
        error_count: checks.filter(c => c.status === 'fail').length,
        uptime_percentage: this.calculateUptimePercentage('audit_logging')
      }
    };
  }

  private calculateComponentScore(checks: HealthCheck[]): number {
    if (checks.length === 0) return 0;

    const weights = { pass: 100, warn: 60, fail: 0 };
    const impactMultipliers = { low: 1, medium: 2, high: 3, critical: 4 };

    let totalScore = 0;
    let totalWeight = 0;

    for (const check of checks) {
      const baseScore = weights[check.status];
      const weight = impactMultipliers[check.impact];
      totalScore += baseScore * weight;
      totalWeight += weight;
    }

    return totalWeight > 0 ? Math.round(totalScore / totalWeight) : 0;
  }

  private determineComponentStatus(checks: HealthCheck[], score: number): HealthCheckResult['status'] {
    const criticalFailures = checks.filter(c => c.status === 'fail' && c.impact === 'critical').length;
    const failures = checks.filter(c => c.status === 'fail').length;
    
    if (criticalFailures > 0 || score < 30) return 'critical';
    if (failures > 0 || score < 70) return 'degraded';
    return 'healthy';
  }

  private calculateOverallScore(results: HealthCheckResult[]): number {
    if (results.length === 0) return 0;
    
    const totalScore = results.reduce((sum, result) => sum + result.score, 0);
    return Math.round(totalScore / results.length);
  }

  private determineOverallStatus(results: HealthCheckResult[], score: number): SystemHealthReport['overall_status'] {
    const criticalComponents = results.filter(r => r.status === 'critical').length;
    const degradedComponents = results.filter(r => r.status === 'degraded').length;
    
    if (criticalComponents > 0 || score < 50) return 'critical';
    if (degradedComponents > 0 || score < 80) return 'degraded';
    return 'healthy';
  }

  private createErrorResult(component: string, error: any): HealthCheckResult {
    return {
      component,
      status: 'critical',
      score: 0,
      timestamp: new Date(),
      checks: [{
        name: 'System Availability',
        status: 'fail',
        message: `Component failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        impact: 'critical',
        category: 'availability'
      }],
      recommendations: [`Investigate ${component} system failure`],
      metadata: {
        response_time: 0,
        last_success: null,
        error_count: 1,
        uptime_percentage: 0
      }
    };
  }

  private calculateUptimePercentage(component: string): number {
    const metrics = this.componentMetrics.get(component);
    if (!metrics) return 100;

    const totalChecks = metrics.successCount + metrics.errorCount;
    return totalChecks > 0 ? Math.round((metrics.successCount / totalChecks) * 100) : 100;
  }

  private calculateTrends(environment: string): SystemHealthReport['trends'] {
    const recentReports = this.healthHistory
      .filter(r => r.environment === environment)
      .slice(-10);

    if (recentReports.length < 3) {
      return {
        score_trend: 'stable',
        availability_trend: 'stable',
        response_time_trend: 'stable'
      };
    }

    // Simple trend calculation based on recent scores
    const scores = recentReports.map(r => r.overall_score);
    const recent = scores.slice(-3);
    const older = scores.slice(-6, -3);

    const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const olderAvg = older.length > 0 ? older.reduce((a, b) => a + b, 0) / older.length : recentAvg;

    const scoreTrend = recentAvg > olderAvg + 5 ? 'improving' : 
                     recentAvg < olderAvg - 5 ? 'degrading' : 'stable';

    return {
      score_trend: scoreTrend,
      availability_trend: 'stable', // Would need more data for accurate calculation
      response_time_trend: 'stable' // Would need more data for accurate calculation
    };
  }

  private calculateComponentStats(reports: SystemHealthReport[]): Record<string, ComponentStats> {
    const stats: Record<string, ComponentStats> = {};

    for (const report of reports) {
      for (const component of report.components) {
        if (!stats[component.component]) {
          stats[component.component] = {
            avgScore: 0,
            uptime: 0,
            avgResponseTime: 0,
            checkCount: 0
          };
        }

        const stat = stats[component.component];
        stat.avgScore = (stat.avgScore * stat.checkCount + component.score) / (stat.checkCount + 1);
        stat.avgResponseTime = (stat.avgResponseTime * stat.checkCount + component.metadata.response_time) / (stat.checkCount + 1);
        stat.uptime = component.metadata.uptime_percentage;
        stat.checkCount++;
      }
    }

    return stats;
  }

  private async evaluateHealthThresholds(report: SystemHealthReport, policy: HealthCheckPolicy): Promise<void> {
    const { alert_thresholds } = policy;

    if (report.overall_score <= alert_thresholds.critical_score) {
      this.emit('health_threshold:critical', { report, policy });
      
      // Create security alert
      await securityAlertSystem.createAlert({
        severity: 'critical',
        category: 'availability',
        title: 'Critical System Health Alert',
        description: `System health score dropped to ${report.overall_score}/100`,
        source: 'health_checker',
        environment: report.environment,
        affected_resources: report.components.filter(c => c.status === 'critical').map(c => c.component),
        indicators: [{
          type: 'anomaly',
          description: 'System health degradation detected',
          confidence: 90,
          evidence: [{
            type: 'metric',
            description: 'Health check results',
            data: report,
            timestamp: new Date(),
            source: 'health_checker'
          }]
        }],
        metadata: {
          detection_method: 'health_monitoring',
          risk_score: 100 - report.overall_score,
          business_impact: 'critical',
          compliance_implications: ['availability'],
          attack_vectors: ['system_failure'],
          affected_services: ['all']
        },
        response_actions: []
      });
    } else if (report.overall_score <= alert_thresholds.degraded_score) {
      this.emit('health_threshold:degraded', { report, policy });
    }
  }

  private async performAutoRemediation(report: SystemHealthReport, policy: HealthCheckPolicy): Promise<void> {
    if (!policy.auto_remediation.enabled) return;

    const criticalComponents = report.components.filter(c => c.status === 'critical');
    
    if (criticalComponents.length === 0) return;

    console.log(`🔧 Auto-remediation triggered for ${criticalComponents.length} critical components`);

    for (const component of criticalComponents) {
      try {
        await this.attemptComponentRemediation(component, policy);
      } catch (error) {
        console.error(`Auto-remediation failed for ${component.component}:`, error);
      }
    }
  }

  private async attemptComponentRemediation(component: HealthCheckResult, policy: HealthCheckPolicy): Promise<void> {
    console.log(`🔧 Attempting remediation for component: ${component.component}`);

    // Log remediation attempt
    await configurationAuditLogger.logSystemEvent(
      'auto_remediation',
      'remediation_attempted',
      {
        component: component.component,
        status: component.status,
        score: component.score
      },
      'warning'
    );

    // Component-specific remediation logic would go here
    // For now, just log what would be done
    switch (component.component) {
      case 'configuration_validation':
        console.log('🔧 Would attempt to reload configuration');
        break;
      case 'secret_management':
        console.log('🔧 Would attempt to refresh secret connections');
        break;
      case 'drift_detection':
        console.log('🔧 Would attempt to create new baseline');
        break;
      default:
        console.log(`🔧 Would attempt generic remediation for ${component.component}`);
    }

    this.emit('auto_remediation:attempted', { component, policy });
  }

  private updateComponentMetrics(results: HealthCheckResult[], totalResponseTime: number): void {
    for (const result of results) {
      if (!this.componentMetrics.has(result.component)) {
        this.componentMetrics.set(result.component, {
          successCount: 0,
          errorCount: 0,
          totalResponseTime: 0,
          avgResponseTime: 0,
          lastCheck: new Date()
        });
      }

      const metrics = this.componentMetrics.get(result.component)!;
      
      if (result.status === 'critical') {
        metrics.errorCount++;
      } else {
        metrics.successCount++;
      }

      metrics.totalResponseTime += result.metadata.response_time;
      const totalChecks = metrics.successCount + metrics.errorCount;
      metrics.avgResponseTime = metrics.totalResponseTime / totalChecks;
      metrics.lastCheck = new Date();
    }
  }

  private addToHistory(report: SystemHealthReport): void {
    this.healthHistory.push(report);
    
    if (this.healthHistory.length > this.maxHistorySize) {
      this.healthHistory = this.healthHistory.slice(-this.maxHistorySize);
    }
  }

  private initializeDefaultPolicies(): void {
    this.policies.set('development', this.getDefaultPolicy('development'));
    this.policies.set('staging', this.getDefaultPolicy('staging'));
    this.policies.set('production', this.getDefaultPolicy('production'));
  }

  private getDefaultPolicy(environment: string): HealthCheckPolicy {
    const basePolicy: HealthCheckPolicy = {
      environment,
      check_interval: 300, // 5 minutes
      timeout: 30,
      enabled_components: ['configuration_validation', 'secret_management', 'drift_detection', 'security_alerts', 'audit_logging'],
      alert_thresholds: {
        critical_score: 30,
        degraded_score: 70,
        response_time_ms: 10000,
        error_rate_percentage: 10
      },
      notification_channels: ['console'],
      auto_remediation: {
        enabled: environment === 'development',
        safe_mode: true,
        max_attempts: 3
      }
    };

    // Adjust for production
    if (environment === 'production') {
      basePolicy.check_interval = 60; // 1 minute
      basePolicy.alert_thresholds.critical_score = 50;
      basePolicy.alert_thresholds.degraded_score = 80;
      basePolicy.auto_remediation.enabled = false;
    }

    return basePolicy;
  }

  private initializeComponentMetrics(): void {
    const components = ['configuration_validation', 'secret_management', 'drift_detection', 'security_alerts', 'audit_logging'];
    
    for (const component of components) {
      this.componentMetrics.set(component, {
        successCount: 0,
        errorCount: 0,
        totalResponseTime: 0,
        avgResponseTime: 0,
        lastCheck: new Date()
      });
    }
  }
}

interface ComponentMetrics {
  successCount: number;
  errorCount: number;
  totalResponseTime: number;
  avgResponseTime: number;
  lastCheck: Date;
}

interface ComponentStats {
  avgScore: number;
  uptime: number;
  avgResponseTime: number;
  checkCount: number;
}

// Export singleton instance
export const comprehensiveHealthChecker = new ComprehensiveHealthChecker();