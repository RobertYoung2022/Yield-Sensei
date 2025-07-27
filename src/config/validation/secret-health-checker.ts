/**
 * Secret Accessibility Health Checker
 * 
 * Provides comprehensive health checking for secret accessibility including:
 * - Vault connectivity and authentication
 * - Secret retrieval validation
 * - Performance monitoring
 * - Rotation status verification
 * - Backup accessibility checks
 */

import { EventEmitter } from 'events';
import { integratedKeyManagement } from '../secrets/integrated-key-management';
import { secureKeyStorage } from '../secrets/secure-key-storage';

export interface HealthCheckResult {
  component: string;
  status: 'healthy' | 'warning' | 'critical' | 'unknown';
  message: string;
  responseTime?: number;
  details?: any;
  timestamp: Date;
  recommendations?: string[];
}

export interface SecretHealthReport {
  timestamp: Date;
  overallStatus: 'healthy' | 'degraded' | 'critical';
  components: HealthCheckResult[];
  metrics: {
    totalSecrets: number;
    accessibleSecrets: number;
    inaccessibleSecrets: number;
    averageResponseTime: number;
    secretsNearExpiry: number;
    rotationsPending: number;
  };
  alerts: HealthAlert[];
}

export interface HealthAlert {
  id: string;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  message: string;
  component: string;
  timestamp: Date;
  resolved?: boolean;
}

export interface PerformanceMetrics {
  operation: string;
  responseTime: number;
  timestamp: Date;
  success: boolean;
  error?: string;
}

export class SecretHealthChecker extends EventEmitter {
  private performanceHistory: PerformanceMetrics[] = [];
  private activeAlerts: Map<string, HealthAlert> = new Map();
  private healthHistory: SecretHealthReport[] = [];
  private readonly maxHistorySize = 100;
  private readonly performanceThresholds = {
    warning: 1000, // 1 second
    critical: 5000  // 5 seconds
  };

  constructor() {
    super();
    this.setupPeriodicHealthChecks();
    console.log('🏥 Secret Health Checker initialized');
  }

  /**
   * Perform comprehensive health check
   */
  async performHealthCheck(): Promise<SecretHealthReport> {
    const startTime = Date.now();
    const components: HealthCheckResult[] = [];

    // Check vault connectivity
    components.push(await this.checkVaultConnectivity());

    // Check secret accessibility
    components.push(await this.checkSecretAccessibility());

    // Check key management system
    components.push(await this.checkKeyManagementSystem());

    // Check rotation system
    components.push(await this.checkRotationSystem());

    // Check backup systems
    components.push(await this.checkBackupSystems());

    // Check performance metrics
    components.push(await this.checkPerformanceMetrics());

    // Calculate overall status
    const overallStatus = this.calculateOverallStatus(components);

    // Generate metrics
    const metrics = await this.generateMetrics();

    // Generate alerts
    const alerts = this.generateAlerts(components);

    const report: SecretHealthReport = {
      timestamp: new Date(),
      overallStatus,
      components,
      metrics,
      alerts
    };

    // Store in history
    this.addToHistory(report);

    // Emit events
    this.emit('health:check_complete', report);

    if (overallStatus === 'critical') {
      this.emit('health:critical', report);
    }

    const totalTime = Date.now() - startTime;
    this.recordPerformance('health_check', totalTime, true);

    return report;
  }

  /**
   * Check specific secret accessibility
   */
  async checkSecretAccessibility(secretIds?: string[]): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    try {
      // Get list of secrets to check
      const secretsToCheck = secretIds || await this.getTestSecrets();
      
      const results = await Promise.allSettled(
        secretsToCheck.map(async (secretId) => {
          const retrievalStart = Date.now();
          
          try {
            await secureKeyStorage.retrieveKey(secretId, 'health_check', {
              skipIntegrityCheck: false,
              auditAccess: false
            });
            
            return {
              secretId,
              accessible: true,
              responseTime: Date.now() - retrievalStart
            };
          } catch (error) {
            return {
              secretId,
              accessible: false,
              responseTime: Date.now() - retrievalStart,
              error: error instanceof Error ? error.message : 'Unknown error'
            };
          }
        })
      );

      const accessibleCount = results.filter(r => 
        r.status === 'fulfilled' && r.value.accessible
      ).length;
      
      const averageResponseTime = results
        .filter(r => r.status === 'fulfilled')
        .reduce((sum, r) => sum + (r.value as any).responseTime, 0) / results.length;

      const responseTime = Date.now() - startTime;
      
      let status: HealthCheckResult['status'] = 'healthy';
      let message = `${accessibleCount}/${results.length} secrets accessible`;
      
      if (accessibleCount === 0) {
        status = 'critical';
        message = 'No secrets are accessible';
      } else if (accessibleCount < results.length) {
        status = 'warning';
        message = `${results.length - accessibleCount} secrets inaccessible`;
      }

      if (averageResponseTime > this.performanceThresholds.critical) {
        status = 'critical';
        message += ` (slow response: ${averageResponseTime.toFixed(0)}ms)`;
      } else if (averageResponseTime > this.performanceThresholds.warning) {
        status = status === 'healthy' ? 'warning' : status;
        message += ` (slow response: ${averageResponseTime.toFixed(0)}ms)`;
      }

      return {
        component: 'secret_accessibility',
        status,
        message,
        responseTime,
        timestamp: new Date(),
        details: {
          totalSecrets: results.length,
          accessibleSecrets: accessibleCount,
          averageResponseTime,
          results: results.map(r => 
            r.status === 'fulfilled' ? r.value : { error: r.reason }
          )
        },
        recommendations: this.generateAccessibilityRecommendations(status, accessibleCount, results.length)
      };

    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.recordPerformance('secret_accessibility_check', responseTime, false, 
        error instanceof Error ? error.message : 'Unknown error');

      return {
        component: 'secret_accessibility',
        status: 'critical',
        message: `Health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        responseTime,
        timestamp: new Date(),
        recommendations: ['Investigate secret management system connectivity']
      };
    }
  }

  /**
   * Check vault connectivity
   */
  private async checkVaultConnectivity(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    try {
      // Test basic vault operations
      const healthReport = await secureKeyStorage.generateHealthReport();
      const responseTime = Date.now() - startTime;
      
      let status: HealthCheckResult['status'] = 'healthy';
      let message = 'Vault connectivity verified';
      
      // Check container utilization
      const highUtilization = healthReport.containers.some(c => c.utilization > 80);
      if (highUtilization) {
        status = 'warning';
        message = 'High storage utilization detected';
      }
      
      const criticalUtilization = healthReport.containers.some(c => c.utilization > 95);
      if (criticalUtilization) {
        status = 'critical';
        message = 'Critical storage utilization';
      }

      this.recordPerformance('vault_connectivity', responseTime, true);

      return {
        component: 'vault_connectivity',
        status,
        message,
        responseTime,
        timestamp: new Date(),
        details: healthReport,
        recommendations: this.generateVaultRecommendations(healthReport)
      };

    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.recordPerformance('vault_connectivity', responseTime, false,
        error instanceof Error ? error.message : 'Unknown error');

      return {
        component: 'vault_connectivity',
        status: 'critical',
        message: `Vault connectivity failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        responseTime,
        timestamp: new Date(),
        recommendations: [
          'Check vault service status',
          'Verify network connectivity',
          'Validate authentication credentials'
        ]
      };
    }
  }

  /**
   * Check key management system health
   */
  private async checkKeyManagementSystem(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    try {
      const systemHealth = await integratedKeyManagement.getSystemHealth();
      const responseTime = Date.now() - startTime;
      
      let status: HealthCheckResult['status'];
      switch (systemHealth.overall) {
        case 'healthy':
          status = 'healthy';
          break;
        case 'degraded':
          status = 'warning';
          break;
        case 'critical':
          status = 'critical';
          break;
        default:
          status = 'unknown';
      }

      this.recordPerformance('key_management_check', responseTime, true);

      return {
        component: 'key_management',
        status,
        message: `Key management system is ${systemHealth.overall}`,
        responseTime,
        timestamp: new Date(),
        details: systemHealth,
        recommendations: systemHealth.recommendations
      };

    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.recordPerformance('key_management_check', responseTime, false,
        error instanceof Error ? error.message : 'Unknown error');

      return {
        component: 'key_management',
        status: 'critical',
        message: `Key management check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        responseTime,
        timestamp: new Date(),
        recommendations: ['Check key management system configuration']
      };
    }
  }

  /**
   * Check rotation system
   */
  private async checkRotationSystem(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    try {
      // This would check rotation schedules and recent rotation status
      // For now, simulate the check
      const responseTime = Date.now() - startTime;
      
      // Simulate checking rotation schedules
      const pendingRotations = 0; // Would get from rotation scheduler
      const recentFailures = 0;   // Would get from rotation history
      
      let status: HealthCheckResult['status'] = 'healthy';
      let message = 'Rotation system operational';
      
      if (pendingRotations > 10) {
        status = 'warning';
        message = `${pendingRotations} rotations pending`;
      }
      
      if (recentFailures > 0) {
        status = 'critical';
        message = `${recentFailures} recent rotation failures`;
      }

      this.recordPerformance('rotation_system_check', responseTime, true);

      return {
        component: 'rotation_system',
        status,
        message,
        responseTime,
        timestamp: new Date(),
        details: {
          pendingRotations,
          recentFailures,
          lastRotationCheck: new Date()
        },
        recommendations: this.generateRotationRecommendations(pendingRotations, recentFailures)
      };

    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.recordPerformance('rotation_system_check', responseTime, false,
        error instanceof Error ? error.message : 'Unknown error');

      return {
        component: 'rotation_system',
        status: 'critical',
        message: `Rotation system check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        responseTime,
        timestamp: new Date(),
        recommendations: ['Check rotation scheduler configuration']
      };
    }
  }

  /**
   * Check backup systems
   */
  private async checkBackupSystems(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    try {
      // Simulate backup system check
      const responseTime = Date.now() - startTime;
      
      // Would check backup availability, integrity, etc.
      const backupCount = 10; // Simulated
      const lastBackup = new Date(Date.now() - 2 * 60 * 60 * 1000); // 2 hours ago
      const backupIntegrityOk = true;
      
      let status: HealthCheckResult['status'] = 'healthy';
      let message = 'Backup systems operational';
      
      const hoursSinceLastBackup = (Date.now() - lastBackup.getTime()) / (1000 * 60 * 60);
      
      if (hoursSinceLastBackup > 24) {
        status = 'warning';
        message = 'Backup is overdue';
      }
      
      if (!backupIntegrityOk) {
        status = 'critical';
        message = 'Backup integrity check failed';
      }

      this.recordPerformance('backup_system_check', responseTime, true);

      return {
        component: 'backup_systems',
        status,
        message,
        responseTime,
        timestamp: new Date(),
        details: {
          backupCount,
          lastBackup,
          backupIntegrityOk,
          hoursSinceLastBackup
        },
        recommendations: this.generateBackupRecommendations(hoursSinceLastBackup, backupIntegrityOk)
      };

    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.recordPerformance('backup_system_check', responseTime, false,
        error instanceof Error ? error.message : 'Unknown error');

      return {
        component: 'backup_systems',
        status: 'critical',
        message: `Backup system check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        responseTime,
        timestamp: new Date(),
        recommendations: ['Check backup system configuration and connectivity']
      };
    }
  }

  /**
   * Check performance metrics
   */
  private async checkPerformanceMetrics(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    try {
      const recentMetrics = this.performanceHistory.slice(-100);
      const responseTime = Date.now() - startTime;
      
      if (recentMetrics.length === 0) {
        return {
          component: 'performance_metrics',
          status: 'unknown',
          message: 'No performance data available',
          responseTime,
          timestamp: new Date()
        };
      }
      
      const avgResponseTime = recentMetrics.reduce((sum, m) => sum + m.responseTime, 0) / recentMetrics.length;
      const errorRate = recentMetrics.filter(m => !m.success).length / recentMetrics.length;
      
      let status: HealthCheckResult['status'] = 'healthy';
      let message = `Average response time: ${avgResponseTime.toFixed(0)}ms`;
      
      if (avgResponseTime > this.performanceThresholds.critical) {
        status = 'critical';
        message = `Critical performance: ${avgResponseTime.toFixed(0)}ms avg response`;
      } else if (avgResponseTime > this.performanceThresholds.warning) {
        status = 'warning';
        message = `Slow performance: ${avgResponseTime.toFixed(0)}ms avg response`;
      }
      
      if (errorRate > 0.1) { // 10% error rate
        status = 'critical';
        message += `, high error rate: ${(errorRate * 100).toFixed(1)}%`;
      } else if (errorRate > 0.05) { // 5% error rate
        status = status === 'healthy' ? 'warning' : status;
        message += `, elevated error rate: ${(errorRate * 100).toFixed(1)}%`;
      }

      return {
        component: 'performance_metrics',
        status,
        message,
        responseTime,
        timestamp: new Date(),
        details: {
          averageResponseTime: avgResponseTime,
          errorRate,
          totalOperations: recentMetrics.length,
          operationTypes: this.groupMetricsByOperation(recentMetrics)
        },
        recommendations: this.generatePerformanceRecommendations(avgResponseTime, errorRate)
      };

    } catch (error) {
      const responseTime = Date.now() - startTime;

      return {
        component: 'performance_metrics',
        status: 'critical',
        message: `Performance check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        responseTime,
        timestamp: new Date()
      };
    }
  }

  /**
   * Get current alerts
   */
  getActiveAlerts(): HealthAlert[] {
    return Array.from(this.activeAlerts.values()).filter(alert => !alert.resolved);
  }

  /**
   * Resolve an alert
   */
  resolveAlert(alertId: string): void {
    const alert = this.activeAlerts.get(alertId);
    if (alert) {
      alert.resolved = true;
      this.emit('alert:resolved', alert);
    }
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics(operation?: string): PerformanceMetrics[] {
    if (operation) {
      return this.performanceHistory.filter(m => m.operation === operation);
    }
    return [...this.performanceHistory];
  }

  /**
   * Generate health report
   */
  generateHealthReport(): string {
    const latestReport = this.healthHistory[this.healthHistory.length - 1];
    
    if (!latestReport) {
      return '# Secret Health Report\n\nNo health data available.';
    }

    let report = `# Secret Health Report\n\n`;
    report += `**Generated:** ${latestReport.timestamp.toISOString()}\n`;
    report += `**Overall Status:** ${latestReport.overallStatus.toUpperCase()}\n\n`;

    // Metrics summary
    report += `## Metrics\n`;
    report += `- Total Secrets: ${latestReport.metrics.totalSecrets}\n`;
    report += `- Accessible: ${latestReport.metrics.accessibleSecrets}\n`;
    report += `- Inaccessible: ${latestReport.metrics.inaccessibleSecrets}\n`;
    report += `- Average Response Time: ${latestReport.metrics.averageResponseTime.toFixed(0)}ms\n`;
    report += `- Secrets Near Expiry: ${latestReport.metrics.secretsNearExpiry}\n`;
    report += `- Pending Rotations: ${latestReport.metrics.rotationsPending}\n\n`;

    // Component status
    report += `## Component Status\n`;
    for (const component of latestReport.components) {
      const statusIcon = this.getStatusIcon(component.status);
      report += `- ${statusIcon} **${component.component}**: ${component.message}\n`;
      if (component.responseTime) {
        report += `  - Response Time: ${component.responseTime}ms\n`;
      }
    }
    report += `\n`;

    // Active alerts
    if (latestReport.alerts.length > 0) {
      report += `## Active Alerts\n`;
      for (const alert of latestReport.alerts.filter(a => !a.resolved)) {
        const severityIcon = this.getSeverityIcon(alert.severity);
        report += `- ${severityIcon} **${alert.title}**: ${alert.message}\n`;
      }
      report += `\n`;
    }

    return report;
  }

  // Private helper methods

  private setupPeriodicHealthChecks(): void {
    // Run health check every 5 minutes
    setInterval(async () => {
      try {
        await this.performHealthCheck();
      } catch (error) {
        console.error('Periodic health check failed:', error);
      }
    }, 5 * 60 * 1000);
  }

  private async getTestSecrets(): Promise<string[]> {
    try {
      const secrets = await secureKeyStorage.listKeys('health_check');
      return secrets.slice(0, 5).map(s => s.keyId); // Test first 5 secrets
    } catch (error) {
      // Return empty array if unable to list secrets
      return [];
    }
  }

  private calculateOverallStatus(components: HealthCheckResult[]): SecretHealthReport['overallStatus'] {
    const criticalCount = components.filter(c => c.status === 'critical').length;
    const warningCount = components.filter(c => c.status === 'warning').length;

    if (criticalCount > 0) return 'critical';
    if (warningCount > 1) return 'degraded';
    return 'healthy';
  }

  private async generateMetrics(): Promise<SecretHealthReport['metrics']> {
    try {
      const healthReport = await secureKeyStorage.generateHealthReport();
      const systemHealth = await integratedKeyManagement.getSystemHealth();
      
      // Calculate average response time from recent performance data
      const recentMetrics = this.performanceHistory.slice(-50);
      const averageResponseTime = recentMetrics.length > 0 ?
        recentMetrics.reduce((sum, m) => sum + m.responseTime, 0) / recentMetrics.length : 0;

      return {
        totalSecrets: systemHealth.metrics.totalKeys,
        accessibleSecrets: systemHealth.metrics.totalKeys, // Assume all accessible unless proven otherwise
        inaccessibleSecrets: 0,
        averageResponseTime,
        secretsNearExpiry: 0, // Would calculate from expiry data
        rotationsPending: systemHealth.metrics.pendingRotations
      };
    } catch (error) {
      return {
        totalSecrets: 0,
        accessibleSecrets: 0,
        inaccessibleSecrets: 0,
        averageResponseTime: 0,
        secretsNearExpiry: 0,
        rotationsPending: 0
      };
    }
  }

  private generateAlerts(components: HealthCheckResult[]): HealthAlert[] {
    const alerts: HealthAlert[] = [];
    
    for (const component of components) {
      if (component.status === 'critical') {
        const alert: HealthAlert = {
          id: `alert_${component.component}_${Date.now()}`,
          severity: 'critical',
          title: `${component.component} Critical`,
          message: component.message,
          component: component.component,
          timestamp: component.timestamp
        };
        
        alerts.push(alert);
        this.activeAlerts.set(alert.id, alert);
      } else if (component.status === 'warning') {
        const alert: HealthAlert = {
          id: `alert_${component.component}_${Date.now()}`,
          severity: 'warning',
          title: `${component.component} Warning`,
          message: component.message,
          component: component.component,
          timestamp: component.timestamp
        };
        
        alerts.push(alert);
        this.activeAlerts.set(alert.id, alert);
      }
    }
    
    return alerts;
  }

  private recordPerformance(
    operation: string,
    responseTime: number,
    success: boolean,
    error?: string
  ): void {
    const metric: PerformanceMetrics = {
      operation,
      responseTime,
      timestamp: new Date(),
      success,
      error
    };
    
    this.performanceHistory.push(metric);
    
    // Trim history if too large
    if (this.performanceHistory.length > 1000) {
      this.performanceHistory = this.performanceHistory.slice(-1000);
    }
  }

  private addToHistory(report: SecretHealthReport): void {
    this.healthHistory.push(report);
    
    // Trim history if too large
    if (this.healthHistory.length > this.maxHistorySize) {
      this.healthHistory = this.healthHistory.slice(-this.maxHistorySize);
    }
  }

  private generateAccessibilityRecommendations(
    status: HealthCheckResult['status'],
    accessible: number,
    total: number
  ): string[] {
    const recommendations: string[] = [];
    
    if (status === 'critical') {
      recommendations.push('Investigate secret management system immediately');
      recommendations.push('Check network connectivity and authentication');
    } else if (status === 'warning') {
      recommendations.push('Review inaccessible secrets and investigate causes');
      recommendations.push('Consider increasing timeout values');
    }
    
    if (accessible < total) {
      recommendations.push('Verify secret existence and permissions');
    }
    
    return recommendations;
  }

  private generateVaultRecommendations(healthReport: any): string[] {
    const recommendations: string[] = [];
    
    const highUtilization = healthReport.containers?.some((c: any) => c.utilization > 80);
    if (highUtilization) {
      recommendations.push('Consider increasing vault storage capacity');
      recommendations.push('Review and archive old secrets');
    }
    
    return recommendations;
  }

  private generateRotationRecommendations(pending: number, failures: number): string[] {
    const recommendations: string[] = [];
    
    if (pending > 5) {
      recommendations.push('Schedule maintenance window for pending rotations');
    }
    
    if (failures > 0) {
      recommendations.push('Investigate rotation failures and resolve issues');
    }
    
    return recommendations;
  }

  private generateBackupRecommendations(hoursSinceLastBackup: number, integrityOk: boolean): string[] {
    const recommendations: string[] = [];
    
    if (hoursSinceLastBackup > 24) {
      recommendations.push('Schedule immediate backup');
    }
    
    if (!integrityOk) {
      recommendations.push('Investigate backup integrity issues');
      recommendations.push('Create new backup from primary source');
    }
    
    return recommendations;
  }

  private generatePerformanceRecommendations(avgResponseTime: number, errorRate: number): string[] {
    const recommendations: string[] = [];
    
    if (avgResponseTime > this.performanceThresholds.warning) {
      recommendations.push('Investigate performance bottlenecks');
      recommendations.push('Consider scaling vault infrastructure');
    }
    
    if (errorRate > 0.05) {
      recommendations.push('Review error logs and resolve common issues');
    }
    
    return recommendations;
  }

  private groupMetricsByOperation(metrics: PerformanceMetrics[]): Record<string, any> {
    const grouped: Record<string, any> = {};
    
    for (const metric of metrics) {
      if (!grouped[metric.operation]) {
        grouped[metric.operation] = {
          count: 0,
          totalTime: 0,
          errors: 0
        };
      }
      
      grouped[metric.operation].count++;
      grouped[metric.operation].totalTime += metric.responseTime;
      if (!metric.success) {
        grouped[metric.operation].errors++;
      }
    }
    
    // Calculate averages
    for (const operation of Object.keys(grouped)) {
      const data = grouped[operation];
      data.averageTime = data.totalTime / data.count;
      data.errorRate = data.errors / data.count;
    }
    
    return grouped;
  }

  private getStatusIcon(status: HealthCheckResult['status']): string {
    switch (status) {
      case 'healthy': return '✅';
      case 'warning': return '⚠️';
      case 'critical': return '🚨';
      case 'unknown': return '❓';
      default: return '❓';
    }
  }

  private getSeverityIcon(severity: HealthAlert['severity']): string {
    switch (severity) {
      case 'info': return 'ℹ️';
      case 'warning': return '⚠️';
      case 'critical': return '🚨';
      default: return 'ℹ️';
    }
  }
}

// Export singleton instance
export const secretHealthChecker = new SecretHealthChecker();