/**
 * Security Configuration Validator
 * 
 * Provides comprehensive validation of security configurations including:
 * - Environment security settings validation
 * - TLS/SSL configuration verification
 * - Authentication and authorization settings
 * - Database security configuration
 * - API security settings
 * - Logging and monitoring configuration
 */

import { EventEmitter } from 'events';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { createHash } from 'crypto';

export interface SecurityRule {
  id: string;
  name: string;
  description: string;
  category: 'authentication' | 'encryption' | 'network' | 'database' | 'logging' | 'api' | 'general';
  severity: 'low' | 'medium' | 'high' | 'critical';
  validate: (config: any) => ValidationResult;
  remediation?: string;
}

export interface ValidationResult {
  passed: boolean;
  message: string;
  details?: any;
  evidence?: string[];
}

export interface SecurityValidationReport {
  timestamp: Date;
  environment: string;
  overallScore: number;
  totalRules: number;
  passedRules: number;
  failedRules: number;
  results: SecurityRuleResult[];
  recommendations: string[];
  criticalIssues: SecurityRuleResult[];
}

export interface SecurityRuleResult {
  rule: SecurityRule;
  result: ValidationResult;
  timestamp: Date;
}

export interface SecurityBaseline {
  version: string;
  environment: string;
  rules: SecurityRule[];
  configuration: any;
  checksums: Map<string, string>;
  lastUpdated: Date;
}

export class SecurityConfigValidator extends EventEmitter {
  private rules: Map<string, SecurityRule> = new Map();
  private baselines: Map<string, SecurityBaseline> = new Map();
  private validationHistory: SecurityValidationReport[] = [];
  private readonly maxHistorySize = 1000;

  constructor() {
    super();
    this.initializeRules();
    console.log('🔐 Security Configuration Validator initialized');
  }

  /**
   * Validate security configuration for an environment
   */
  async validateSecurityConfiguration(
    environment: string,
    configPath?: string
  ): Promise<SecurityValidationReport> {
    const config = await this.loadConfiguration(environment, configPath);
    const applicableRules = this.getApplicableRules(environment);
    
    const results: SecurityRuleResult[] = [];
    let passedCount = 0;
    let failedCount = 0;

    for (const rule of applicableRules) {
      try {
        const result = rule.validate(config);
        const ruleResult: SecurityRuleResult = {
          rule,
          result,
          timestamp: new Date()
        };

        results.push(ruleResult);

        if (result.passed) {
          passedCount++;
        } else {
          failedCount++;
          this.emit('validation:failure', ruleResult);
        }

      } catch (error) {
        const ruleResult: SecurityRuleResult = {
          rule,
          result: {
            passed: false,
            message: `Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`,
            details: { error }
          },
          timestamp: new Date()
        };

        results.push(ruleResult);
        failedCount++;
      }
    }

    const overallScore = applicableRules.length > 0 ? 
      Math.round((passedCount / applicableRules.length) * 100) : 0;

    const report: SecurityValidationReport = {
      timestamp: new Date(),
      environment,
      overallScore,
      totalRules: applicableRules.length,
      passedRules: passedCount,
      failedRules: failedCount,
      results,
      recommendations: this.generateRecommendations(results),
      criticalIssues: results.filter(r => 
        !r.result.passed && r.rule.severity === 'critical'
      )
    };

    // Store in history
    this.addToHistory(report);

    // Emit events
    this.emit('validation:complete', report);
    
    if (report.criticalIssues.length > 0) {
      this.emit('validation:critical', report.criticalIssues);
    }

    return report;
  }

  /**
   * Create a security baseline for an environment
   */
  async createSecurityBaseline(
    environment: string,
    configPath?: string
  ): Promise<SecurityBaseline> {
    const config = await this.loadConfiguration(environment, configPath);
    const rules = this.getApplicableRules(environment);
    
    const checksums = new Map<string, string>();
    
    // Generate checksums for configuration sections
    const configSections = this.extractConfigurationSections(config);
    for (const [section, content] of configSections) {
      const checksum = createHash('sha256')
        .update(JSON.stringify(content))
        .digest('hex');
      checksums.set(section, checksum);
    }

    const baseline: SecurityBaseline = {
      version: '1.0.0',
      environment,
      rules,
      configuration: config,
      checksums,
      lastUpdated: new Date()
    };

    this.baselines.set(environment, baseline);
    this.emit('baseline:created', baseline);

    console.log(`📋 Security baseline created for ${environment}`);
    return baseline;
  }

  /**
   * Compare current configuration against baseline
   */
  async compareWithBaseline(
    environment: string,
    configPath?: string
  ): Promise<{
    hasChanges: boolean;
    changes: Array<{
      section: string;
      type: 'added' | 'modified' | 'removed';
      details: any;
    }>;
    securityImpact: 'none' | 'low' | 'medium' | 'high';
  }> {
    const baseline = this.baselines.get(environment);
    if (!baseline) {
      throw new Error(`No baseline found for environment: ${environment}`);
    }

    const currentConfig = await this.loadConfiguration(environment, configPath);
    const currentSections = this.extractConfigurationSections(currentConfig);
    
    const changes: Array<{
      section: string;
      type: 'added' | 'modified' | 'removed';
      details: any;
    }> = [];

    // Check for modified sections
    for (const [section, content] of currentSections) {
      const currentChecksum = createHash('sha256')
        .update(JSON.stringify(content))
        .digest('hex');
      
      const baselineChecksum = baseline.checksums.get(section);
      
      if (!baselineChecksum) {
        changes.push({
          section,
          type: 'added',
          details: { content }
        });
      } else if (currentChecksum !== baselineChecksum) {
        changes.push({
          section,
          type: 'modified',
          details: {
            baseline: baseline.configuration[section],
            current: content
          }
        });
      }
    }

    // Check for removed sections
    for (const [section] of baseline.checksums) {
      if (!currentSections.has(section)) {
        changes.push({
          section,
          type: 'removed',
          details: { content: baseline.configuration[section] }
        });
      }
    }

    const securityImpact = this.assessSecurityImpact(changes);

    return {
      hasChanges: changes.length > 0,
      changes,
      securityImpact
    };
  }

  /**
   * Add a custom security rule
   */
  addRule(rule: SecurityRule): void {
    this.rules.set(rule.id, rule);
    this.emit('rule:added', rule);
  }

  /**
   * Remove a security rule
   */
  removeRule(ruleId: string): void {
    const rule = this.rules.get(ruleId);
    if (rule) {
      this.rules.delete(ruleId);
      this.emit('rule:removed', rule);
    }
  }

  /**
   * Get validation history
   */
  getValidationHistory(environment?: string): SecurityValidationReport[] {
    if (environment) {
      return this.validationHistory.filter(report => report.environment === environment);
    }
    return [...this.validationHistory];
  }

  /**
   * Generate security report
   */
  generateSecurityReport(environments: string[] = []): string {
    let report = `# Security Configuration Report\n\n`;
    report += `**Generated:** ${new Date().toISOString()}\n\n`;

    // Overall summary
    const recentReports = this.validationHistory
      .filter(r => environments.length === 0 || environments.includes(r.environment))
      .slice(-environments.length || -10);

    if (recentReports.length > 0) {
      const avgScore = recentReports.reduce((sum, r) => sum + r.overallScore, 0) / recentReports.length;
      const totalCritical = recentReports.reduce((sum, r) => sum + r.criticalIssues.length, 0);

      report += `## Summary\n`;
      report += `- Average Security Score: ${avgScore.toFixed(1)}%\n`;
      report += `- Total Critical Issues: ${totalCritical}\n`;
      report += `- Environments Validated: ${new Set(recentReports.map(r => r.environment)).size}\n\n`;
    }

    // Environment-specific details
    for (const env of environments.length > 0 ? environments : ['development', 'production']) {
      const envReports = this.validationHistory.filter(r => r.environment === env);
      const latestReport = envReports[envReports.length - 1];

      if (latestReport) {
        report += `## ${env.toUpperCase()} Environment\n`;
        report += `- Security Score: ${latestReport.overallScore}%\n`;
        report += `- Rules Passed: ${latestReport.passedRules}/${latestReport.totalRules}\n`;
        report += `- Critical Issues: ${latestReport.criticalIssues.length}\n\n`;

        if (latestReport.criticalIssues.length > 0) {
          report += `### Critical Issues\n`;
          for (const issue of latestReport.criticalIssues) {
            report += `- **${issue.rule.name}**: ${issue.result.message}\n`;
          }
          report += `\n`;
        }

        if (latestReport.recommendations.length > 0) {
          report += `### Recommendations\n`;
          for (const recommendation of latestReport.recommendations) {
            report += `- ${recommendation}\n`;
          }
          report += `\n`;
        }
      }
    }

    return report;
  }

  // Private helper methods

  private initializeRules(): void {
    // Environment Security Rules
    this.addRule({
      id: 'env_production_debug',
      name: 'Production Debug Mode Disabled',
      description: 'Ensure debug mode is disabled in production',
      category: 'general',
      severity: 'critical',
      validate: (config) => ({
        passed: config.environment !== 'production' || !config.DEBUG,
        message: config.environment === 'production' && config.DEBUG ? 
          'Debug mode is enabled in production' : 
          'Debug mode appropriately configured'
      }),
      remediation: 'Set DEBUG=false in production environment'
    });

    // TLS/SSL Rules
    this.addRule({
      id: 'tls_version',
      name: 'TLS Version Validation',
      description: 'Ensure TLS 1.2 or higher is used',
      category: 'encryption',
      severity: 'high',
      validate: (config) => {
        const tlsVersion = config.TLS_VERSION || config.SSL_VERSION;
        const validVersions = ['1.2', '1.3'];
        const isValid = !tlsVersion || validVersions.some(v => tlsVersion.includes(v));
        
        return {
          passed: isValid,
          message: isValid ? 
            'TLS version is secure' : 
            `Insecure TLS version: ${tlsVersion}`,
          details: { configuredVersion: tlsVersion }
        };
      },
      remediation: 'Configure TLS_VERSION=1.2 or higher'
    });

    // Database Security Rules
    this.addRule({
      id: 'db_ssl_required',
      name: 'Database SSL Required',
      description: 'Ensure database connections use SSL',
      category: 'database',
      severity: 'high',
      validate: (config) => {
        const dbUrl = config.DATABASE_URL;
        const sslRequired = config.DB_SSL_REQUIRED !== 'false';
        
        if (!dbUrl) {
          return { passed: true, message: 'No database configured' };
        }
        
        const hasSSL = dbUrl.includes('sslmode=require') || 
                      dbUrl.includes('ssl=true') || 
                      sslRequired;
        
        return {
          passed: hasSSL,
          message: hasSSL ? 
            'Database SSL is properly configured' : 
            'Database SSL is not required',
          evidence: [dbUrl ? 'DATABASE_URL configured' : 'No DATABASE_URL']
        };
      },
      remediation: 'Add sslmode=require to DATABASE_URL or set DB_SSL_REQUIRED=true'
    });

    // Authentication Rules
    this.addRule({
      id: 'jwt_secret_strength',
      name: 'JWT Secret Strength',
      description: 'Ensure JWT secret is sufficiently strong',
      category: 'authentication',
      severity: 'critical',
      validate: (config) => {
        const secret = config.JWT_SECRET;
        
        if (!secret) {
          return { passed: false, message: 'JWT_SECRET is not configured' };
        }
        
        const isStrong = secret.length >= 32 && 
                        /[A-Z]/.test(secret) && 
                        /[a-z]/.test(secret) && 
                        /[0-9]/.test(secret) && 
                        /[^A-Za-z0-9]/.test(secret);
        
        return {
          passed: isStrong,
          message: isStrong ? 
            'JWT secret meets strength requirements' : 
            'JWT secret is weak or does not meet complexity requirements',
          details: { 
            length: secret.length,
            hasUppercase: /[A-Z]/.test(secret),
            hasLowercase: /[a-z]/.test(secret),
            hasNumbers: /[0-9]/.test(secret),
            hasSpecialChars: /[^A-Za-z0-9]/.test(secret)
          }
        };
      },
      remediation: 'Generate a strong JWT secret with at least 32 characters including uppercase, lowercase, numbers, and special characters'
    });

    // API Security Rules
    this.addRule({
      id: 'cors_origin_validation',
      name: 'CORS Origin Validation',
      description: 'Ensure CORS origins are properly configured',
      category: 'api',
      severity: 'medium',
      validate: (config) => {
        const corsOrigin = config.CORS_ORIGIN;
        
        if (!corsOrigin) {
          return { passed: false, message: 'CORS_ORIGIN is not configured' };
        }
        
        const isWildcard = corsOrigin === '*';
        const isProd = config.NODE_ENV === 'production';
        
        if (isProd && isWildcard) {
          return {
            passed: false,
            message: 'CORS origin is set to wildcard (*) in production',
            details: { environment: config.NODE_ENV, origin: corsOrigin }
          };
        }
        
        return {
          passed: true,
          message: 'CORS origin is properly configured',
          details: { origin: corsOrigin }
        };
      },
      remediation: 'Set specific allowed origins instead of using wildcard (*) in production'
    });

    // Logging Rules
    this.addRule({
      id: 'log_level_production',
      name: 'Production Log Level',
      description: 'Ensure appropriate log level in production',
      category: 'logging',
      severity: 'medium',
      validate: (config) => {
        const logLevel = config.LOG_LEVEL || 'info';
        const isProd = config.NODE_ENV === 'production';
        
        if (isProd) {
          const appropriateLevels = ['warn', 'error', 'info'];
          const isAppropriate = appropriateLevels.includes(logLevel.toLowerCase());
          
          return {
            passed: isAppropriate,
            message: isAppropriate ? 
              'Log level is appropriate for production' : 
              `Log level '${logLevel}' may be too verbose for production`,
            details: { level: logLevel, environment: config.NODE_ENV }
          };
        }
        
        return { passed: true, message: 'Log level validation skipped for non-production' };
      },
      remediation: 'Set LOG_LEVEL to info, warn, or error in production'
    });

    // Rate Limiting Rules
    this.addRule({
      id: 'rate_limiting_enabled',
      name: 'Rate Limiting Enabled',
      description: 'Ensure rate limiting is configured',
      category: 'api',
      severity: 'medium',
      validate: (config) => {
        const rateLimitEnabled = config.RATE_LIMIT_ENABLED !== 'false';
        const maxRequests = parseInt(config.RATE_LIMIT_MAX_REQUESTS || '0');
        
        if (!rateLimitEnabled) {
          return {
            passed: false,
            message: 'Rate limiting is disabled',
            details: { enabled: false }
          };
        }
        
        if (maxRequests <= 0) {
          return {
            passed: false,
            message: 'Rate limit max requests not configured',
            details: { maxRequests }
          };
        }
        
        return {
          passed: true,
          message: 'Rate limiting is properly configured',
          details: { enabled: true, maxRequests }
        };
      },
      remediation: 'Enable rate limiting with RATE_LIMIT_ENABLED=true and set RATE_LIMIT_MAX_REQUESTS'
    });

    console.log(`📋 Initialized ${this.rules.size} security rules`);
  }

  private async loadConfiguration(
    environment: string,
    configPath?: string
  ): Promise<any> {
    const config: any = { ...process.env, environment };
    
    // Load from file if specified
    if (configPath && existsSync(configPath)) {
      try {
        const fileContent = readFileSync(configPath, 'utf8');
        const fileConfig = JSON.parse(fileContent);
        Object.assign(config, fileConfig);
      } catch (error) {
        console.warn(`Failed to load config from ${configPath}:`, error);
      }
    }
    
    // Load environment-specific config
    const envConfigPath = resolve(process.cwd(), `config/${environment}.json`);
    if (existsSync(envConfigPath)) {
      try {
        const envContent = readFileSync(envConfigPath, 'utf8');
        const envConfig = JSON.parse(envContent);
        Object.assign(config, envConfig);
      } catch (error) {
        console.warn(`Failed to load environment config:`, error);
      }
    }
    
    return config;
  }

  private getApplicableRules(_environment: string): SecurityRule[] {
    const rules = Array.from(this.rules.values());
    
    // Filter rules based on environment if needed
    return rules.filter(() => {
      // All rules apply by default
      // Could add environment-specific filtering here
      return true;
    });
  }

  private generateRecommendations(results: SecurityRuleResult[]): string[] {
    const recommendations: string[] = [];
    
    const failedRules = results.filter(r => !r.result.passed);
    
    // Priority recommendations
    const criticalFailed = failedRules.filter(r => r.rule.severity === 'critical');
    if (criticalFailed.length > 0) {
      recommendations.push(`Address ${criticalFailed.length} critical security issues immediately`);
    }
    
    const highFailed = failedRules.filter(r => r.rule.severity === 'high');
    if (highFailed.length > 0) {
      recommendations.push(`Review and fix ${highFailed.length} high-severity security issues`);
    }
    
    // Specific recommendations
    for (const failed of failedRules.slice(0, 5)) {
      if (failed.rule.remediation) {
        recommendations.push(failed.rule.remediation);
      }
    }
    
    // General recommendations
    const overallScore = results.length > 0 ? 
      (results.filter(r => r.result.passed).length / results.length) * 100 : 0;
    
    if (overallScore < 80) {
      recommendations.push('Consider implementing a security configuration management process');
    }
    
    if (overallScore < 60) {
      recommendations.push('Schedule a comprehensive security review');
    }
    
    return recommendations;
  }

  private extractConfigurationSections(config: any): Map<string, any> {
    const sections = new Map<string, any>();
    
    // Group configuration by category
    const categories = {
      database: ['DATABASE_URL', 'DB_', 'POSTGRES_', 'MYSQL_', 'MONGODB_'],
      authentication: ['JWT_', 'AUTH_', 'OAUTH_', 'SESSION_'],
      encryption: ['SSL_', 'TLS_', 'ENCRYPT_', 'CRYPTO_'],
      api: ['API_', 'CORS_', 'RATE_LIMIT_'],
      logging: ['LOG_', 'SENTRY_', 'WINSTON_'],
      general: ['NODE_ENV', 'PORT', 'DEBUG', 'ENVIRONMENT']
    };
    
    for (const [category, prefixes] of Object.entries(categories)) {
      const categoryConfig: any = {};
      
      for (const [key, value] of Object.entries(config)) {
        if (prefixes.some(prefix => key.startsWith(prefix)) || 
            prefixes.includes(key)) {
          categoryConfig[key] = value;
        }
      }
      
      if (Object.keys(categoryConfig).length > 0) {
        sections.set(category, categoryConfig);
      }
    }
    
    return sections;
  }

  private assessSecurityImpact(changes: Array<{
    section: string;
    type: 'added' | 'modified' | 'removed';
    details: any;
  }>): 'none' | 'low' | 'medium' | 'high' {
    if (changes.length === 0) return 'none';
    
    const criticalSections = ['authentication', 'encryption', 'database'];
    const hasCriticalChanges = changes.some(change => 
      criticalSections.includes(change.section)
    );
    
    if (hasCriticalChanges) return 'high';
    
    const moderateSections = ['api', 'logging'];
    const hasModerateChanges = changes.some(change => 
      moderateSections.includes(change.section)
    );
    
    if (hasModerateChanges) return 'medium';
    
    return 'low';
  }

  private addToHistory(report: SecurityValidationReport): void {
    this.validationHistory.push(report);
    
    // Trim history if too large
    if (this.validationHistory.length > this.maxHistorySize) {
      this.validationHistory = this.validationHistory.slice(-this.maxHistorySize);
    }
  }
}

// Export singleton instance
export const securityConfigValidator = new SecurityConfigValidator();