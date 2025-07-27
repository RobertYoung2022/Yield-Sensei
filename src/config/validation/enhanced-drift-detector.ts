/**
 * Enhanced Configuration Drift Detection System
 * 
 * Advanced monitoring and detection of configuration changes including:
 * - Real-time configuration monitoring with file system watchers
 * - Baseline comparison and comprehensive drift detection
 * - Change tracking with detailed security impact analysis
 * - Compliance validation against multiple standards
 * - Automated alerting and notification system
 * - Integration with existing secret management and validation systems
 */

import { EventEmitter } from 'events';
import { readFileSync, writeFileSync, existsSync, statSync, watch } from 'fs';
import { resolve, join } from 'path';
import { createHash } from 'crypto';
import { securityConfigValidator } from './security-config-validator';
import { secretHealthChecker } from './secret-health-checker';

export interface ConfigurationBaseline {
  id: string;
  environment: string;
  version: string;
  timestamp: Date;
  configuration: ConfigurationSnapshot;
  checksums: Map<string, string>;
  metadata: {
    source: string;
    author: string;
    description?: string;
    tags?: string[];
  };
}

export interface ConfigurationSnapshot {
  environment: Record<string, any>;
  files: Map<string, FileSnapshot>;
  services: Map<string, ServiceConfig>;
  secrets: Map<string, SecretReference>;
  systemInfo: SystemInfo;
}

export interface FileSnapshot {
  path: string;
  content: string;
  checksum: string;
  size: number;
  modified: Date;
  permissions?: string;
}

export interface ServiceConfig {
  name: string;
  version: string;
  configuration: any;
  dependencies: string[];
  healthEndpoint?: string;
  status: 'running' | 'stopped' | 'error' | 'unknown';
}

export interface SecretReference {
  name: string;
  type: string;
  lastRotated?: Date;
  expiresAt?: Date;
  source: string;
  accessible: boolean;
}

export interface SystemInfo {
  nodeVersion: string;
  platform: string;
  architecture: string;
  hostname: string;
  uptime: number;
}

export interface DriftDetectionResult {
  id: string;
  timestamp: Date;
  environment: string;
  baselineId: string;
  currentSnapshot: ConfigurationSnapshot;
  driftScore: number;
  changes: ConfigurationChange[];
  severity: 'none' | 'low' | 'medium' | 'high' | 'critical';
  complianceStatus: 'compliant' | 'non_compliant' | 'unknown';
  securityImpact: SecurityImpactAssessment;
  recommendations: string[];
}

export interface ConfigurationChange {
  id: string;
  type: 'added' | 'modified' | 'removed' | 'permissions';
  category: 'environment' | 'file' | 'service' | 'secret' | 'system';
  path: string;
  description: string;
  oldValue?: any;
  newValue?: any;
  impact: 'low' | 'medium' | 'high' | 'critical';
  securityImplications: string[];
  complianceImplications: string[];
  timestamp: Date;
  confidence: number; // 0-100, confidence in change detection
}

export interface SecurityImpactAssessment {
  overallScore: number; // 0-100
  categories: {
    authentication: number;
    authorization: number;
    encryption: number;
    dataProtection: number;
    networkSecurity: number;
  };
  criticalFindings: string[];
  recommendations: string[];
}

export interface DriftMonitoringPolicy {
  environment: string;
  monitoringInterval: number; // milliseconds
  alertThresholds: {
    driftScore: number;
    criticalChanges: number;
    unauthorizedChanges: number;
  };
  watchedPaths: string[];
  excludedPaths: string[];
  complianceStandards: string[];
  notificationChannels: NotificationChannel[];
  autoRemediation: {
    enabled: boolean;
    maxRiskLevel: 'low' | 'medium' | 'high';
    requireApproval: boolean;
  };
}

export interface NotificationChannel {
  type: 'console' | 'file' | 'webhook' | 'email' | 'slack' | 'teams';
  config: Record<string, any>;
  severity: ('low' | 'medium' | 'high' | 'critical')[];
}

export interface ComplianceRule {
  id: string;
  name: string;
  description: string;
  standard: string; // e.g., 'SOC2', 'PCI-DSS', 'GDPR', 'HIPAA'
  category: string;
  validate: (config: ConfigurationSnapshot) => ComplianceResult;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface ComplianceResult {
  compliant: boolean;
  message: string;
  evidence?: string[];
  remediation?: string;
  score?: number; // 0-100
}

export class EnhancedDriftDetector extends EventEmitter {
  private baselines: Map<string, ConfigurationBaseline> = new Map();
  private policies: Map<string, DriftMonitoringPolicy> = new Map();
  private complianceRules: Map<string, ComplianceRule> = new Map();
  private driftHistory: DriftDetectionResult[] = [];
  private fileWatchers: Map<string, any> = new Map();
  private monitoringIntervals: Map<string, NodeJS.Timeout> = new Map();
  private changeBuffer: Map<string, ConfigurationChange[]> = new Map();
  private readonly maxHistorySize = 1000;
  private readonly changeBufferTimeout = 5000; // 5 seconds

  constructor() {
    super();
    this.initializeComplianceRules();
    this.setupChangeBufferProcessing();
    console.log('🔍 Enhanced Configuration Drift Detector initialized');
  }

  /**
   * Create a comprehensive configuration baseline
   */
  async createBaseline(
    environment: string,
    options: {
      description?: string;
      author: string;
      tags?: string[];
      configPaths?: string[];
      includeSecrets?: boolean;
    }
  ): Promise<ConfigurationBaseline> {
    const snapshot = await this.captureConfigurationSnapshot(environment, options);
    
    const baseline: ConfigurationBaseline = {
      id: `baseline_${environment}_${Date.now()}`,
      environment,
      version: '2.0.0',
      timestamp: new Date(),
      configuration: snapshot,
      checksums: this.generateChecksums(snapshot),
      metadata: {
        source: 'enhanced_drift_detector',
        author: options.author,
        description: options.description,
        tags: options.tags
      }
    };

    this.baselines.set(baseline.id, baseline);
    this.emit('baseline:created', baseline);

    console.log(`📋 Enhanced baseline created: ${baseline.id}`);
    return baseline;
  }

  /**
   * Detect configuration drift with enhanced analysis
   */
  async detectDrift(
    environment: string,
    baselineId?: string
  ): Promise<DriftDetectionResult> {
    // Find the appropriate baseline
    const baseline = baselineId ? 
      this.baselines.get(baselineId) :
      this.getLatestBaseline(environment);

    if (!baseline) {
      throw new Error(`No baseline found for environment: ${environment}`);
    }

    // Capture current configuration
    const currentSnapshot = await this.captureConfigurationSnapshot(environment);

    // Compare configurations
    const changes = await this.compareConfigurations(baseline.configuration, currentSnapshot);

    // Calculate drift score
    const driftScore = this.calculateDriftScore(changes);

    // Determine severity
    const severity = this.determineSeverity(changes, driftScore);

    // Assess security impact
    const securityImpact = await this.assessSecurityImpact(changes);

    // Check compliance
    const complianceStatus = await this.checkCompliance(currentSnapshot, environment);

    // Generate recommendations
    const recommendations = this.generateDriftRecommendations(changes, securityImpact, complianceStatus);

    const result: DriftDetectionResult = {
      id: `drift_${environment}_${Date.now()}`,
      timestamp: new Date(),
      environment,
      baselineId: baseline.id,
      currentSnapshot,
      driftScore,
      changes,
      severity,
      complianceStatus,
      securityImpact,
      recommendations
    };

    // Store in history
    this.addToHistory(result);

    // Emit events
    this.emit('drift:detected', result);

    if (severity === 'critical') {
      this.emit('drift:critical', result);
    }

    if (securityImpact.overallScore > 70) {
      this.emit('security:high_impact', result);
    }

    return result;
  }

  /**
   * Start continuous monitoring with advanced features
   */
  async startMonitoring(environment: string, policy: DriftMonitoringPolicy): Promise<void> {
    this.policies.set(environment, policy);

    // Set up file system watchers with debouncing
    for (const path of policy.watchedPaths) {
      if (existsSync(path)) {
        try {
          const watcher = watch(path, { recursive: true }, (eventType, filename) => {
            if (filename && !this.isExcluded(filename, policy.excludedPaths)) {
              this.handleFileSystemChange(environment, eventType, join(path, filename));
            }
          });

          this.fileWatchers.set(path, watcher);
          console.log(`👁️ Watching path: ${path}`);
        } catch (error) {
          console.warn(`Failed to watch path ${path}:`, error);
        }
      }
    }

    // Set up periodic comprehensive monitoring
    const interval = setInterval(async () => {
      try {
        const result = await this.detectDrift(environment);
        await this.evaluateAlertThresholds(result, policy);
        await this.performAutoRemediation(result, policy);
      } catch (error) {
        console.error(`Periodic drift detection failed for ${environment}:`, error);
      }
    }, policy.monitoringInterval);

    this.monitoringIntervals.set(environment, interval);

    this.emit('monitoring:started', { environment, policy });
    console.log(`🔍 Enhanced monitoring started for ${environment}`);
  }

  /**
   * Stop monitoring
   */
  stopMonitoring(environment: string): void {
    // Stop file watchers
    for (const [path, watcher] of this.fileWatchers) {
      watcher.close();
    }
    this.fileWatchers.clear();

    // Stop periodic monitoring
    const interval = this.monitoringIntervals.get(environment);
    if (interval) {
      clearInterval(interval);
      this.monitoringIntervals.delete(environment);
    }

    this.emit('monitoring:stopped', { environment });
    console.log(`🛑 Enhanced monitoring stopped for ${environment}`);
  }

  /**
   * Generate comprehensive drift report
   */
  generateComprehensiveReport(environments: string[] = []): string {
    let report = `# Enhanced Configuration Drift Report\n\n`;
    report += `**Generated:** ${new Date().toISOString()}\n\n`;

    // Executive Summary
    const recentResults = this.driftHistory
      .filter(r => environments.length === 0 || environments.includes(r.environment))
      .slice(-20);

    if (recentResults.length > 0) {
      const avgDriftScore = recentResults.reduce((sum, r) => sum + r.driftScore, 0) / recentResults.length;
      const avgSecurityScore = recentResults.reduce((sum, r) => sum + r.securityImpact.overallScore, 0) / recentResults.length;
      const criticalChanges = recentResults.reduce((sum, r) => 
        sum + r.changes.filter(c => c.impact === 'critical').length, 0);

      report += `## Executive Summary\n`;
      report += `- Average Drift Score: ${avgDriftScore.toFixed(1)}\n`;
      report += `- Average Security Impact: ${avgSecurityScore.toFixed(1)}\n`;
      report += `- Critical Changes: ${criticalChanges}\n`;
      report += `- Environments Monitored: ${new Set(recentResults.map(r => r.environment)).size}\n\n`;
    }

    // Security Impact Analysis
    report += `## Security Impact Analysis\n\n`;
    for (const result of recentResults.slice(-5)) {
      if (result.securityImpact.overallScore > 30) {
        report += `### ${result.environment} - ${result.timestamp.toISOString()}\n`;
        report += `- Overall Security Score: ${result.securityImpact.overallScore}\n`;
        report += `- Authentication Impact: ${result.securityImpact.categories.authentication}\n`;
        report += `- Encryption Impact: ${result.securityImpact.categories.encryption}\n`;
        
        if (result.securityImpact.criticalFindings.length > 0) {
          report += `- Critical Findings:\n`;
          for (const finding of result.securityImpact.criticalFindings) {
            report += `  - ${finding}\n`;
          }
        }
        report += `\n`;
      }
    }

    // Compliance Status
    report += `## Compliance Status\n\n`;
    const complianceStats = recentResults.reduce((stats, r) => {
      stats[r.complianceStatus] = (stats[r.complianceStatus] || 0) + 1;
      return stats;
    }, {} as Record<string, number>);

    for (const [status, count] of Object.entries(complianceStats)) {
      report += `- ${status.toUpperCase()}: ${count}\n`;
    }
    report += `\n`;

    // Environment Details
    const envs = environments.length > 0 ? environments : 
      Array.from(new Set(this.driftHistory.map(r => r.environment)));

    for (const env of envs) {
      const envResults = this.driftHistory.filter(r => r.environment === env);
      const latestResult = envResults[envResults.length - 1];

      if (latestResult) {
        report += `## ${env.toUpperCase()} Environment\n`;
        report += `- Drift Score: ${latestResult.driftScore}\n`;
        report += `- Severity: ${latestResult.severity.toUpperCase()}\n`;
        report += `- Security Impact: ${latestResult.securityImpact.overallScore}\n`;
        report += `- Compliance: ${latestResult.complianceStatus.toUpperCase()}\n`;
        report += `- Total Changes: ${latestResult.changes.length}\n\n`;

        // Critical changes
        const criticalChanges = latestResult.changes.filter(c => c.impact === 'critical');
        if (criticalChanges.length > 0) {
          report += `### Critical Changes\n`;
          for (const change of criticalChanges) {
            report += `- **${change.path}**: ${change.description}\n`;
            if (change.securityImplications.length > 0) {
              report += `  - Security: ${change.securityImplications.join(', ')}\n`;
            }
          }
          report += `\n`;
        }

        // Recommendations
        if (latestResult.recommendations.length > 0) {
          report += `### Recommendations\n`;
          for (const recommendation of latestResult.recommendations) {
            report += `- ${recommendation}\n`;
          }
          report += `\n`;
        }
      }
    }

    return report;
  }

  // Private helper methods

  private async captureConfigurationSnapshot(
    environment: string,
    options?: { configPaths?: string[]; includeSecrets?: boolean }
  ): Promise<ConfigurationSnapshot> {
    const snapshot: ConfigurationSnapshot = {
      environment: { ...process.env },
      files: new Map(),
      services: new Map(),
      secrets: new Map(),
      systemInfo: this.captureSystemInfo()
    };

    // Capture configuration files
    const paths = options?.configPaths || this.getDefaultConfigPaths();
    
    for (const path of paths) {
      if (existsSync(path)) {
        try {
          const stats = statSync(path);
          
          if (stats.isFile()) {
            const content = readFileSync(path, 'utf8');
            const checksum = createHash('sha256').update(content).digest('hex');
            
            snapshot.files.set(path, {
              path,
              content,
              checksum,
              size: stats.size,
              modified: stats.mtime
            });
          }
        } catch (error) {
          console.warn(`Failed to capture file ${path}:`, error);
        }
      }
    }

    // Capture service configurations
    await this.captureServiceConfigurations(snapshot);

    // Capture secret references if enabled
    if (options?.includeSecrets !== false) {
      await this.captureSecretReferences(snapshot);
    }

    return snapshot;
  }

  private captureSystemInfo(): SystemInfo {
    return {
      nodeVersion: process.version,
      platform: process.platform,
      architecture: process.arch,
      hostname: require('os').hostname(),
      uptime: process.uptime()
    };
  }

  private async captureServiceConfigurations(snapshot: ConfigurationSnapshot): Promise<void> {
    // Capture main application service
    snapshot.services.set('yieldsensei-api', {
      name: 'yieldsensei-api',
      version: process.env.npm_package_version || '1.0.0',
      configuration: {
        port: process.env.PORT || 3000,
        environment: process.env.NODE_ENV || 'development',
        debug: process.env.DEBUG === 'true',
        cors: process.env.CORS_ORIGIN,
        rateLimit: process.env.RATE_LIMIT_MAX_REQUESTS
      },
      dependencies: ['database', 'redis', 'external-api'],
      healthEndpoint: '/health',
      status: 'running' // Would check actual status in production
    });

    // Add more services as needed
  }

  private async captureSecretReferences(snapshot: ConfigurationSnapshot): Promise<void> {
    try {
      // Check secret health to determine accessibility
      const healthReport = await secretHealthChecker.performHealthCheck();
      
      const secretKeys = Object.keys(process.env).filter(key => 
        key.includes('SECRET') || 
        key.includes('PASSWORD') || 
        key.includes('KEY') ||
        key.includes('TOKEN')
      );

      for (const key of secretKeys) {
        snapshot.secrets.set(key, {
          name: key,
          type: 'environment_variable',
          source: 'process.env',
          accessible: healthReport.overallStatus !== 'critical'
        });
      }
    } catch (error) {
      console.warn('Failed to capture secret references:', error);
    }
  }

  private generateChecksums(snapshot: ConfigurationSnapshot): Map<string, string> {
    const checksums = new Map<string, string>();

    // Environment checksum (excluding sensitive values)
    const sanitizedEnv = this.sanitizeEnvironmentForChecksum(snapshot.environment);
    const envChecksum = createHash('sha256')
      .update(JSON.stringify(sanitizedEnv))
      .digest('hex');
    checksums.set('environment', envChecksum);

    // File checksums
    for (const [path, file] of snapshot.files) {
      checksums.set(`file:${path}`, file.checksum);
    }

    // Service checksums
    for (const [name, service] of snapshot.services) {
      const serviceChecksum = createHash('sha256')
        .update(JSON.stringify(service.configuration))
        .digest('hex');
      checksums.set(`service:${name}`, serviceChecksum);
    }

    // System info checksum (excluding uptime)
    const systemChecksum = createHash('sha256')
      .update(JSON.stringify({
        nodeVersion: snapshot.systemInfo.nodeVersion,
        platform: snapshot.systemInfo.platform,
        architecture: snapshot.systemInfo.architecture,
        hostname: snapshot.systemInfo.hostname
      }))
      .digest('hex');
    checksums.set('system', systemChecksum);

    return checksums;
  }

  private sanitizeEnvironmentForChecksum(env: Record<string, any>): Record<string, any> {
    const sanitized: Record<string, any> = {};
    
    for (const [key, value] of Object.entries(env)) {
      // Don't include actual secret values in checksums
      if (key.includes('SECRET') || key.includes('PASSWORD') || key.includes('KEY')) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = value;
      }
    }
    
    return sanitized;
  }

  private async compareConfigurations(
    baseline: ConfigurationSnapshot,
    current: ConfigurationSnapshot
  ): Promise<ConfigurationChange[]> {
    const changes: ConfigurationChange[] = [];

    // Compare environment variables
    changes.push(...await this.compareEnvironmentVariables(baseline.environment, current.environment));

    // Compare files
    changes.push(...await this.compareFiles(baseline.files, current.files));

    // Compare services
    changes.push(...await this.compareServices(baseline.services, current.services));

    // Compare secrets
    changes.push(...await this.compareSecrets(baseline.secrets, current.secrets));

    // Compare system info
    changes.push(...await this.compareSystemInfo(baseline.systemInfo, current.systemInfo));

    return changes;
  }

  private async compareEnvironmentVariables(
    baseline: Record<string, any>,
    current: Record<string, any>
  ): Promise<ConfigurationChange[]> {
    const changes: ConfigurationChange[] = [];

    // Check for added/modified variables
    for (const [key, value] of Object.entries(current)) {
      if (!baseline.hasOwnProperty(key)) {
        changes.push({
          id: `env_added_${key}_${Date.now()}`,
          type: 'added',
          category: 'environment',
          path: key,
          description: `Environment variable '${key}' was added`,
          newValue: this.sanitizeValue(key, value),
          impact: this.assessEnvironmentVariableImpact(key),
          securityImplications: await this.getSecurityImplications('environment', 'added', key),
          complianceImplications: await this.getComplianceImplications('environment', 'added', key),
          timestamp: new Date(),
          confidence: 95
        });
      } else if (baseline[key] !== value) {
        changes.push({
          id: `env_modified_${key}_${Date.now()}`,
          type: 'modified',
          category: 'environment',
          path: key,
          description: `Environment variable '${key}' was modified`,
          oldValue: this.sanitizeValue(key, baseline[key]),
          newValue: this.sanitizeValue(key, value),
          impact: this.assessEnvironmentVariableImpact(key),
          securityImplications: await this.getSecurityImplications('environment', 'modified', key),
          complianceImplications: await this.getComplianceImplications('environment', 'modified', key),
          timestamp: new Date(),
          confidence: 90
        });
      }
    }

    // Check for removed variables
    for (const key of Object.keys(baseline)) {
      if (!current.hasOwnProperty(key)) {
        changes.push({
          id: `env_removed_${key}_${Date.now()}`,
          type: 'removed',
          category: 'environment',
          path: key,
          description: `Environment variable '${key}' was removed`,
          oldValue: this.sanitizeValue(key, baseline[key]),
          impact: this.assessEnvironmentVariableImpact(key),
          securityImplications: await this.getSecurityImplications('environment', 'removed', key),
          complianceImplications: await this.getComplianceImplications('environment', 'removed', key),
          timestamp: new Date(),
          confidence: 100
        });
      }
    }

    return changes;
  }

  private async compareFiles(
    baseline: Map<string, FileSnapshot>,
    current: Map<string, FileSnapshot>
  ): Promise<ConfigurationChange[]> {
    const changes: ConfigurationChange[] = [];

    // Check for added/modified files
    for (const [path, file] of current) {
      const baselineFile = baseline.get(path);
      
      if (!baselineFile) {
        changes.push({
          id: `file_added_${path}_${Date.now()}`,
          type: 'added',
          category: 'file',
          path,
          description: `Configuration file '${path}' was added`,
          newValue: { size: file.size, modified: file.modified },
          impact: this.assessFileImpact(path),
          securityImplications: await this.getSecurityImplications('file', 'added', path),
          complianceImplications: await this.getComplianceImplications('file', 'added', path),
          timestamp: new Date(),
          confidence: 100
        });
      } else if (baselineFile.checksum !== file.checksum) {
        changes.push({
          id: `file_modified_${path}_${Date.now()}`,
          type: 'modified',
          category: 'file',
          path,
          description: `Configuration file '${path}' was modified`,
          oldValue: { size: baselineFile.size, modified: baselineFile.modified, checksum: baselineFile.checksum },
          newValue: { size: file.size, modified: file.modified, checksum: file.checksum },
          impact: this.assessFileImpact(path),
          securityImplications: await this.getSecurityImplications('file', 'modified', path),
          complianceImplications: await this.getComplianceImplications('file', 'modified', path),
          timestamp: new Date(),
          confidence: 100
        });
      }
    }

    // Check for removed files
    for (const [path] of baseline) {
      if (!current.has(path)) {
        changes.push({
          id: `file_removed_${path}_${Date.now()}`,
          type: 'removed',
          category: 'file',
          path,
          description: `Configuration file '${path}' was removed`,
          oldValue: { path },
          impact: this.assessFileImpact(path),
          securityImplications: await this.getSecurityImplications('file', 'removed', path),
          complianceImplications: await this.getComplianceImplications('file', 'removed', path),
          timestamp: new Date(),
          confidence: 100
        });
      }
    }

    return changes;
  }

  private async compareServices(
    baseline: Map<string, ServiceConfig>,
    current: Map<string, ServiceConfig>
  ): Promise<ConfigurationChange[]> {
    const changes: ConfigurationChange[] = [];

    for (const [name, service] of current) {
      const baselineService = baseline.get(name);
      
      if (!baselineService) {
        changes.push({
          id: `service_added_${name}_${Date.now()}`,
          type: 'added',
          category: 'service',
          path: name,
          description: `Service '${name}' was added`,
          newValue: { version: service.version, status: service.status },
          impact: 'medium',
          securityImplications: ['New service may introduce security risks'],
          complianceImplications: ['New service may affect compliance posture'],
          timestamp: new Date(),
          confidence: 95
        });
      } else {
        // Check for configuration changes within service
        const configChecksum = createHash('sha256').update(JSON.stringify(service.configuration)).digest('hex');
        const baselineConfigChecksum = createHash('sha256').update(JSON.stringify(baselineService.configuration)).digest('hex');
        
        if (configChecksum !== baselineConfigChecksum) {
          changes.push({
            id: `service_config_${name}_${Date.now()}`,
            type: 'modified',
            category: 'service',
            path: `${name}.configuration`,
            description: `Service '${name}' configuration was modified`,
            oldValue: baselineService.configuration,
            newValue: service.configuration,
            impact: this.assessServiceConfigImpact(name, service.configuration),
            securityImplications: await this.getServiceSecurityImplications(name, service.configuration),
            complianceImplications: ['Service configuration change may affect compliance'],
            timestamp: new Date(),
            confidence: 90
          });
        }
      }
    }

    return changes;
  }

  private async compareSecrets(
    baseline: Map<string, SecretReference>,
    current: Map<string, SecretReference>
  ): Promise<ConfigurationChange[]> {
    const changes: ConfigurationChange[] = [];

    // Check for added/removed secret references
    for (const [name, secret] of current) {
      const baselineSecret = baseline.get(name);
      
      if (!baselineSecret) {
        changes.push({
          id: `secret_added_${name}_${Date.now()}`,
          type: 'added',
          category: 'secret',
          path: name,
          description: `Secret reference '${name}' was added`,
          newValue: { type: secret.type, source: secret.source, accessible: secret.accessible },
          impact: 'high',
          securityImplications: ['New secret reference may indicate configuration change'],
          complianceImplications: ['New secret may affect audit requirements'],
          timestamp: new Date(),
          confidence: 100
        });
      } else if (baselineSecret.accessible !== secret.accessible) {
        changes.push({
          id: `secret_accessibility_${name}_${Date.now()}`,
          type: 'modified',
          category: 'secret',
          path: `${name}.accessibility`,
          description: `Secret '${name}' accessibility changed from ${baselineSecret.accessible} to ${secret.accessible}`,
          oldValue: { accessible: baselineSecret.accessible },
          newValue: { accessible: secret.accessible },
          impact: secret.accessible ? 'medium' : 'critical',
          securityImplications: secret.accessible ? 
            ['Secret became accessible'] : 
            ['Secret became inaccessible - may indicate compromise or misconfiguration'],
          complianceImplications: ['Secret accessibility change affects audit trail'],
          timestamp: new Date(),
          confidence: 95
        });
      }
    }

    for (const [name] of baseline) {
      if (!current.has(name)) {
        changes.push({
          id: `secret_removed_${name}_${Date.now()}`,
          type: 'removed',
          category: 'secret',
          path: name,
          description: `Secret reference '${name}' was removed`,
          impact: 'high',
          securityImplications: ['Removed secret reference may indicate misconfiguration'],
          complianceImplications: ['Secret removal affects audit requirements'],
          timestamp: new Date(),
          confidence: 100
        });
      }
    }

    return changes;
  }

  private async compareSystemInfo(
    baseline: SystemInfo,
    current: SystemInfo
  ): Promise<ConfigurationChange[]> {
    const changes: ConfigurationChange[] = [];

    if (baseline.nodeVersion !== current.nodeVersion) {
      changes.push({
        id: `system_node_version_${Date.now()}`,
        type: 'modified',
        category: 'system',
        path: 'system.nodeVersion',
        description: `Node.js version changed from ${baseline.nodeVersion} to ${current.nodeVersion}`,
        oldValue: baseline.nodeVersion,
        newValue: current.nodeVersion,
        impact: 'medium',
        securityImplications: ['Node.js version change may introduce security vulnerabilities'],
        complianceImplications: ['Runtime version change may affect compliance requirements'],
        timestamp: new Date(),
        confidence: 100
      });
    }

    if (baseline.hostname !== current.hostname) {
      changes.push({
        id: `system_hostname_${Date.now()}`,
        type: 'modified',
        category: 'system',
        path: 'system.hostname',
        description: `Hostname changed from ${baseline.hostname} to ${current.hostname}`,
        oldValue: baseline.hostname,
        newValue: current.hostname,
        impact: 'high',
        securityImplications: ['Hostname change may indicate system compromise or migration'],
        complianceImplications: ['Hostname change affects audit trail and system identification'],
        timestamp: new Date(),
        confidence: 100
      });
    }

    return changes;
  }

  private calculateDriftScore(changes: ConfigurationChange[]): number {
    if (changes.length === 0) return 0;

    const weights = {
      low: 1,
      medium: 3,
      high: 7,
      critical: 15
    };

    const confidenceWeights = {
      low: 0.5,
      medium: 0.7,
      high: 0.9,
      critical: 1.0
    };

    const totalScore = changes.reduce((sum, change) => {
      const baseScore = weights[change.impact];
      const confidenceMultiplier = change.confidence / 100;
      return sum + (baseScore * confidenceMultiplier);
    }, 0);
    
    // Normalize to 0-100 scale
    return Math.min(100, totalScore);
  }

  private determineSeverity(
    changes: ConfigurationChange[],
    driftScore: number
  ): DriftDetectionResult['severity'] {
    const criticalChanges = changes.filter(c => c.impact === 'critical').length;
    const highChanges = changes.filter(c => c.impact === 'high').length;
    
    if (criticalChanges > 0 || driftScore >= 80) return 'critical';
    if (highChanges >= 2 || driftScore >= 60) return 'high';
    if (driftScore >= 30) return 'medium';
    if (driftScore > 0) return 'low';
    return 'none';
  }

  private async assessSecurityImpact(changes: ConfigurationChange[]): Promise<SecurityImpactAssessment> {
    const categories = {
      authentication: 0,
      authorization: 0,
      encryption: 0,
      dataProtection: 0,
      networkSecurity: 0
    };

    const criticalFindings: string[] = [];
    const recommendations: string[] = [];

    for (const change of changes) {
      // Assess impact on different security categories
      if (change.path.includes('auth') || change.path.includes('jwt') || change.path.includes('session')) {
        categories.authentication += this.getImpactScore(change.impact);
        
        if (change.impact === 'critical') {
          criticalFindings.push(`Authentication configuration changed: ${change.description}`);
        }
      }

      if (change.path.includes('cors') || change.path.includes('permission') || change.path.includes('role')) {
        categories.authorization += this.getImpactScore(change.impact);
      }

      if (change.path.includes('encrypt') || change.path.includes('tls') || change.path.includes('ssl')) {
        categories.encryption += this.getImpactScore(change.impact);
        
        if (change.impact === 'critical') {
          criticalFindings.push(`Encryption configuration changed: ${change.description}`);
        }
      }

      if (change.path.includes('database') || change.path.includes('backup')) {
        categories.dataProtection += this.getImpactScore(change.impact);
      }

      if (change.path.includes('port') || change.path.includes('host') || change.path.includes('network')) {
        categories.networkSecurity += this.getImpactScore(change.impact);
      }
    }

    // Calculate overall score
    const overallScore = Math.min(100, Object.values(categories).reduce((sum, score) => sum + score, 0));

    // Generate recommendations
    if (categories.authentication > 20) {
      recommendations.push('Review authentication system for potential security issues');
    }
    if (categories.encryption > 20) {
      recommendations.push('Verify encryption configurations are still secure');
    }
    if (overallScore > 50) {
      recommendations.push('Conduct security review of all configuration changes');
    }

    return {
      overallScore,
      categories,
      criticalFindings,
      recommendations
    };
  }

  private async checkCompliance(
    snapshot: ConfigurationSnapshot,
    environment: string
  ): Promise<DriftDetectionResult['complianceStatus']> {
    try {
      // Use security configuration validator for compliance
      const report = await securityConfigValidator.validateSecurityConfiguration(environment);
      
      // Also check custom compliance rules
      let compliantRules = 0;
      let totalRules = 0;

      for (const rule of this.complianceRules.values()) {
        totalRules++;
        const result = rule.validate(snapshot);
        if (result.compliant) {
          compliantRules++;
        }
      }

      const complianceScore = (report.overallScore + (compliantRules / totalRules * 100)) / 2;
      
      return complianceScore >= 80 ? 'compliant' : 'non_compliant';
    } catch (error) {
      return 'unknown';
    }
  }

  private generateDriftRecommendations(
    changes: ConfigurationChange[],
    securityImpact: SecurityImpactAssessment,
    complianceStatus: DriftDetectionResult['complianceStatus']
  ): string[] {
    const recommendations: string[] = [];

    // Add security recommendations
    recommendations.push(...securityImpact.recommendations);

    const criticalChanges = changes.filter(c => c.impact === 'critical');
    if (criticalChanges.length > 0) {
      recommendations.push(`Review ${criticalChanges.length} critical configuration changes immediately`);
    }

    const securityChanges = changes.filter(c => 
      c.securityImplications && c.securityImplications.length > 0
    );
    if (securityChanges.length > 0) {
      recommendations.push('Review security implications of configuration changes');
    }

    if (complianceStatus === 'non_compliant') {
      recommendations.push('Address compliance violations in configuration');
    }

    if (changes.length > 10) {
      recommendations.push('Consider creating a new baseline due to extensive changes');
    }

    // Add specific recommendations based on change types
    const secretChanges = changes.filter(c => c.category === 'secret');
    if (secretChanges.length > 0) {
      recommendations.push('Audit all secret-related changes and rotate affected credentials');
    }

    return [...new Set(recommendations)]; // Remove duplicates
  }

  // Helper methods for impact assessment

  private sanitizeValue(key: string, value: any): any {
    if (key.includes('SECRET') || key.includes('PASSWORD') || key.includes('KEY')) {
      return '[REDACTED]';
    }
    return value;
  }

  private assessEnvironmentVariableImpact(key: string): ConfigurationChange['impact'] {
    if (key.includes('SECRET') || key.includes('PASSWORD') || key.includes('PRIVATE_KEY')) {
      return 'critical';
    }
    if (key.includes('DB') || key.includes('DATABASE') || key === 'NODE_ENV' || key.includes('JWT')) {
      return 'high';
    }
    if (key.includes('API') || key.includes('URL') || key.includes('PORT')) {
      return 'medium';
    }
    return 'low';
  }

  private assessFileImpact(path: string): ConfigurationChange['impact'] {
    if (path.includes('security') || path.includes('auth') || path.includes('.env') || path.includes('ssl')) {
      return 'critical';
    }
    if (path.includes('config') || path.includes('settings') || path.includes('docker')) {
      return 'high';
    }
    if (path.includes('.json') || path.includes('.yaml') || path.includes('.yml')) {
      return 'medium';
    }
    return 'low';
  }

  private assessServiceConfigImpact(serviceName: string, config: any): ConfigurationChange['impact'] {
    if (serviceName.includes('auth') || serviceName.includes('security')) {
      return 'critical';
    }
    if (config.port || config.database || config.security) {
      return 'high';
    }
    return 'medium';
  }

  private async getSecurityImplications(
    category: string,
    type: string,
    path: string
  ): Promise<string[]> {
    const implications: string[] = [];

    if (category === 'environment' && path.includes('SECRET')) {
      implications.push('Secret configuration change detected');
    }

    if (category === 'file' && path.includes('security')) {
      implications.push('Security configuration file modified');
    }

    if (category === 'secret' && type === 'removed') {
      implications.push('Secret removal may indicate compromise or misconfiguration');
    }

    if (type === 'removed') {
      implications.push('Configuration removal may cause service disruption');
    }

    return implications;
  }

  private async getComplianceImplications(
    category: string,
    type: string,
    path: string
  ): Promise<string[]> {
    const implications: string[] = [];

    if (category === 'environment' && path.includes('LOG')) {
      implications.push('Logging configuration change affects audit requirements');
    }

    if (category === 'secret') {
      implications.push('Secret changes require compliance documentation');
    }

    if (type === 'removed') {
      implications.push('Configuration removal may affect compliance posture');
    }

    return implications;
  }

  private async getServiceSecurityImplications(serviceName: string, config: any): Promise<string[]> {
    const implications: string[] = [];

    if (config.debug === true) {
      implications.push('Debug mode enabled - may expose sensitive information');
    }

    if (config.cors === '*') {
      implications.push('CORS wildcard may allow unauthorized access');
    }

    return implications;
  }

  private getImpactScore(impact: ConfigurationChange['impact']): number {
    const scores = {
      low: 5,
      medium: 15,
      high: 30,
      critical: 50
    };
    return scores[impact];
  }

  private getDefaultConfigPaths(): string[] {
    return [
      '.env',
      '.env.local',
      '.env.production',
      'config/default.json',
      'config/production.json',
      'config/development.json',
      'package.json',
      'tsconfig.json',
      'docker-compose.yml',
      'Dockerfile',
      'nginx.conf',
      'ssl.conf'
    ].map(path => resolve(process.cwd(), path));
  }

  private getLatestBaseline(environment: string): ConfigurationBaseline | undefined {
    const envBaselines = Array.from(this.baselines.values())
      .filter(b => b.environment === environment)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    return envBaselines[0];
  }

  private handleFileSystemChange(environment: string, eventType: string, filePath: string): void {
    // Buffer changes to avoid excessive processing
    const bufferId = `${environment}_${filePath}`;
    
    if (!this.changeBuffer.has(bufferId)) {
      this.changeBuffer.set(bufferId, []);
    }

    // Process buffered changes after timeout
    setTimeout(async () => {
      try {
        const result = await this.detectDrift(environment);
        
        if (result.severity !== 'none') {
          this.emit('drift:file_change', {
            environment,
            filePath,
            eventType,
            result
          });
        }
      } catch (error) {
        console.error(`File change drift detection failed:`, error);
      }
    }, this.changeBufferTimeout);
  }

  private isExcluded(filePath: string, excludedPaths: string[]): boolean {
    return excludedPaths.some(excluded => filePath.includes(excluded));
  }

  private async evaluateAlertThresholds(
    result: DriftDetectionResult,
    policy: DriftMonitoringPolicy
  ): Promise<void> {
    const { alertThresholds } = policy;
    
    if (result.driftScore >= alertThresholds.driftScore) {
      await this.sendNotifications(result, policy.notificationChannels, 'drift_threshold');
    }

    const criticalChanges = result.changes.filter(c => c.impact === 'critical').length;
    if (criticalChanges >= alertThresholds.criticalChanges) {
      await this.sendNotifications(result, policy.notificationChannels, 'critical_changes');
    }

    if (result.securityImpact.overallScore >= 70) {
      await this.sendNotifications(result, policy.notificationChannels, 'security_impact');
    }
  }

  private async performAutoRemediation(
    result: DriftDetectionResult,
    policy: DriftMonitoringPolicy
  ): Promise<void> {
    if (!policy.autoRemediation.enabled) return;

    const remediableChanges = result.changes.filter(change => {
      const maxRiskLevels = ['low', 'medium', 'high'];
      const maxIndex = maxRiskLevels.indexOf(policy.autoRemediation.maxRiskLevel);
      const changeIndex = maxRiskLevels.indexOf(change.impact);
      
      return changeIndex <= maxIndex;
    });

    if (remediableChanges.length > 0) {
      if (policy.autoRemediation.requireApproval) {
        this.emit('remediation:approval_required', {
          result,
          remediableChanges
        });
      } else {
        // Attempt automatic remediation
        await this.attemptRemediation(remediableChanges);
      }
    }
  }

  private async attemptRemediation(changes: ConfigurationChange[]): Promise<void> {
    console.log(`🔧 Attempting remediation for ${changes.length} changes`);
    
    // Implementation would restore baseline values or apply fixes
    for (const change of changes) {
      console.log(`🔧 Would remediate: ${change.description}`);
    }

    this.emit('remediation:completed', {
      changes,
      timestamp: new Date()
    });
  }

  private async sendNotifications(
    result: DriftDetectionResult,
    channels: NotificationChannel[],
    reason: string
  ): Promise<void> {
    for (const channel of channels) {
      if (!channel.severity.includes(result.severity)) {
        continue; // Skip if severity doesn't match
      }

      try {
        switch (channel.type) {
          case 'console':
            this.notifyConsole(result, reason);
            break;
          case 'file':
            await this.notifyFile(result, channel.config);
            break;
          case 'webhook':
            await this.notifyWebhook(result, channel.config);
            break;
          case 'slack':
            await this.notifySlack(result, channel.config);
            break;
          // Add more notification types as needed
        }
      } catch (error) {
        console.error(`Failed to send notification via ${channel.type}:`, error);
      }
    }
  }

  private notifyConsole(result: DriftDetectionResult, reason: string): void {
    console.warn('\n🚨 ENHANCED CONFIGURATION DRIFT DETECTED 🚨');
    console.warn(`Reason: ${reason}`);
    console.warn(`Environment: ${result.environment}`);
    console.warn(`Severity: ${result.severity.toUpperCase()}`);
    console.warn(`Drift Score: ${result.driftScore}`);
    console.warn(`Security Impact: ${result.securityImpact.overallScore}`);
    console.warn(`Changes: ${result.changes.length}`);
    
    if (result.securityImpact.criticalFindings.length > 0) {
      console.warn('\nCritical Security Findings:');
      for (const finding of result.securityImpact.criticalFindings) {
        console.warn(`❌ ${finding}`);
      }
    }
  }

  private async notifyFile(result: DriftDetectionResult, config: any): Promise<void> {
    const filepath = config.path || './drift-reports';
    const filename = `enhanced-drift-${result.id}-${result.timestamp.getTime()}.json`;
    const fullPath = join(filepath, filename);

    require('fs').mkdirSync(filepath, { recursive: true });
    
    writeFileSync(fullPath, JSON.stringify(result, null, 2));
    console.log(`📄 Enhanced drift report saved to: ${fullPath}`);
  }

  private async notifyWebhook(result: DriftDetectionResult, config: any): Promise<void> {
    // Implementation would send HTTP POST to configured webhook
    console.log(`🔔 Enhanced webhook notification would be sent to: ${config.url}`);
  }

  private async notifySlack(result: DriftDetectionResult, config: any): Promise<void> {
    // Implementation would send to Slack
    console.log(`💬 Slack notification would be sent to: ${config.channel}`);
  }

  private setupChangeBufferProcessing(): void {
    // Clean up old buffered changes periodically
    setInterval(() => {
      // Implementation would clean up old buffered changes
    }, 60000); // Every minute
  }

  private initializeComplianceRules(): void {
    // SOC2 Compliance Rules
    this.complianceRules.set('soc2_debug_disabled', {
      id: 'soc2_debug_disabled',
      name: 'Debug Mode Disabled in Production',
      description: 'Debug mode should be disabled in production environments',
      standard: 'SOC2',
      category: 'environment',
      severity: 'critical',
      validate: (config) => ({
        compliant: !config.environment.DEBUG || config.environment.NODE_ENV !== 'production',
        message: 'Debug mode configuration validated for SOC2 compliance',
        score: (!config.environment.DEBUG || config.environment.NODE_ENV !== 'production') ? 100 : 0
      })
    });

    // PCI-DSS Compliance Rules
    this.complianceRules.set('pci_tls_required', {
      id: 'pci_tls_required',
      name: 'TLS Required for Data Transmission',
      description: 'TLS 1.2 or higher must be used for data transmission',
      standard: 'PCI-DSS',
      category: 'encryption',
      severity: 'critical',
      validate: (config) => {
        const tlsVersion = config.environment.TLS_VERSION;
        const validVersions = ['1.2', '1.3'];
        const compliant = !tlsVersion || validVersions.some(v => tlsVersion.includes(v));
        
        return {
          compliant,
          message: compliant ? 'TLS configuration meets PCI-DSS requirements' : 'TLS version does not meet PCI-DSS requirements',
          score: compliant ? 100 : 0
        };
      }
    });

    // Add more compliance rules as needed
    console.log(`📋 Initialized ${this.complianceRules.size} compliance rules`);
  }

  private addToHistory(result: DriftDetectionResult): void {
    this.driftHistory.push(result);
    
    if (this.driftHistory.length > this.maxHistorySize) {
      this.driftHistory = this.driftHistory.slice(-this.maxHistorySize);
    }
  }
}

// Export singleton instance
export const enhancedDriftDetector = new EnhancedDriftDetector();