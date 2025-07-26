/**
 * Configuration Validator
 * 
 * Provides comprehensive validation for all application configurations
 * with support for deep validation, type checking, and constraint validation.
 */

import { createHash } from 'crypto';
import * as Joi from 'joi';

export interface ValidationRule {
  path: string;
  schema: Joi.Schema;
  description: string;
  severity: 'error' | 'warning';
  environments?: ('development' | 'staging' | 'production' | 'test')[];
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  statistics: ValidationStatistics;
}

export interface ValidationError {
  path: string;
  message: string;
  value?: any;
  type: string;
  timestamp: Date;
}

export interface ValidationWarning {
  path: string;
  message: string;
  suggestion?: string;
  timestamp: Date;
}

export interface ValidationStatistics {
  totalChecks: number;
  passedChecks: number;
  failedChecks: number;
  warnings: number;
  duration: number;
}

export interface ConfigSnapshot {
  timestamp: Date;
  environment: string;
  hash: string;
  config: Record<string, any>;
  metadata: Record<string, any>;
}

export class ConfigValidator {
  private rules: Map<string, ValidationRule> = new Map();
  private customValidators: Map<string, (value: any, config: any) => ValidationResult> = new Map();

  constructor() {
    this.initializeDefaultRules();
  }

  /**
   * Initialize default validation rules
   */
  private initializeDefaultRules(): void {
    // Database Configuration Rules
    this.addRule({
      path: 'database.postgres',
      schema: Joi.object({
        host: Joi.string().hostname().required(),
        port: Joi.number().port().default(5432),
        database: Joi.string().required(),
        user: Joi.string().required(),
        password: Joi.string().min(12).required(),
        ssl: Joi.boolean().default(false),
        poolSize: Joi.number().min(1).max(100).default(10),
        connectionTimeout: Joi.number().min(1000).default(30000)
      }),
      description: 'PostgreSQL database configuration',
      severity: 'error'
    });

    this.addRule({
      path: 'database.clickhouse',
      schema: Joi.object({
        host: Joi.string().hostname().required(),
        port: Joi.number().port().default(8123),
        database: Joi.string().required(),
        user: Joi.string().required(),
        password: Joi.string().min(12).required(),
        requestTimeout: Joi.number().min(1000).default(300000)
      }),
      description: 'ClickHouse database configuration',
      severity: 'error'
    });

    this.addRule({
      path: 'database.redis',
      schema: Joi.object({
        host: Joi.string().hostname().required(),
        port: Joi.number().port().default(6379),
        password: Joi.string().allow('').optional(),
        db: Joi.number().min(0).max(15).default(0),
        keyPrefix: Joi.string().default('ys:'),
        ttl: Joi.number().min(0).default(3600)
      }),
      description: 'Redis cache configuration',
      severity: 'error'
    });

    // Security Configuration Rules
    this.addRule({
      path: 'security.jwt',
      schema: Joi.object({
        secret: Joi.string().min(32).required(),
        expiresIn: Joi.string().pattern(/^\d+[smhd]$/).default('24h'),
        refreshExpiresIn: Joi.string().pattern(/^\d+[smhd]$/).default('7d'),
        algorithm: Joi.string().valid('HS256', 'HS384', 'HS512', 'RS256', 'RS384', 'RS512').default('HS256')
      }),
      description: 'JWT authentication configuration',
      severity: 'error'
    });

    this.addRule({
      path: 'security.encryption',
      schema: Joi.object({
        key: Joi.string().length(32).required(),
        algorithm: Joi.string().valid('aes-256-gcm', 'aes-256-cbc').default('aes-256-gcm'),
        saltRounds: Joi.number().min(10).max(20).default(12)
      }),
      description: 'Encryption configuration',
      severity: 'error'
    });

    this.addRule({
      path: 'security.cors',
      schema: Joi.object({
        origin: Joi.alternatives().try(
          Joi.string(),
          Joi.array().items(Joi.string()),
          Joi.boolean()
        ).required(),
        credentials: Joi.boolean().default(true),
        methods: Joi.array().items(Joi.string().valid('GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS')).required(),
        allowedHeaders: Joi.array().items(Joi.string()).required(),
        exposedHeaders: Joi.array().items(Joi.string()).optional(),
        maxAge: Joi.number().min(0).default(86400)
      }),
      description: 'CORS configuration',
      severity: 'error'
    });

    this.addRule({
      path: 'security.rateLimit',
      schema: Joi.object({
        windowMs: Joi.number().min(1000).default(60000),
        maxRequests: Joi.number().min(1).default(100),
        skipSuccessfulRequests: Joi.boolean().default(false),
        keyGenerator: Joi.string().valid('ip', 'user', 'custom').default('ip')
      }),
      description: 'Rate limiting configuration',
      severity: 'warning'
    });

    // API Configuration Rules
    this.addRule({
      path: 'api.server',
      schema: Joi.object({
        port: Joi.number().port().default(3000),
        host: Joi.string().hostname().default('0.0.0.0'),
        trustProxy: Joi.boolean().default(false),
        bodyLimit: Joi.string().pattern(/^\d+[kmg]b?$/i).default('10mb'),
        timeout: Joi.number().min(0).default(30000)
      }),
      description: 'API server configuration',
      severity: 'error'
    });

    // Satellite Configuration Rules
    this.addRule({
      path: 'satellites.bridge',
      schema: Joi.object({
        enabled: Joi.boolean().default(true),
        chains: Joi.array().items(Joi.string()).min(1).required(),
        bridges: Joi.array().items(Joi.string()).min(1).required(),
        optimizationEnabled: Joi.boolean().default(true),
        maxConcurrentOperations: Joi.number().min(1).max(100).default(10)
      }),
      description: 'Bridge satellite configuration',
      severity: 'warning',
      environments: ['production', 'staging']
    });

    // Monitoring Configuration Rules
    this.addRule({
      path: 'monitoring.performance',
      schema: Joi.object({
        enabled: Joi.boolean().default(true),
        samplingRate: Joi.number().min(0).max(1).default(0.1),
        metricsInterval: Joi.number().min(1000).default(60000),
        retentionDays: Joi.number().min(1).max(365).default(30)
      }),
      description: 'Performance monitoring configuration',
      severity: 'warning'
    });

    // Environment-specific Rules
    this.addRule({
      path: 'production',
      schema: Joi.object({
        debugMode: Joi.boolean().valid(false),
        mockExternalApis: Joi.boolean().valid(false),
        logLevel: Joi.string().valid('error', 'warn', 'info'),
        performanceMonitoringEnabled: Joi.boolean().valid(true)
      }),
      description: 'Production environment constraints',
      severity: 'error',
      environments: ['production']
    });
  }

  /**
   * Add a validation rule
   */
  addRule(rule: ValidationRule): void {
    this.rules.set(rule.path, rule);
  }

  /**
   * Add a custom validator
   */
  addCustomValidator(
    name: string,
    validator: (value: any, config: any) => ValidationResult
  ): void {
    this.customValidators.set(name, validator);
  }

  /**
   * Validate configuration
   */
  validate(config: Record<string, any>, environment?: string): ValidationResult {
    const startTime = Date.now();
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    let totalChecks = 0;
    let passedChecks = 0;

    // Validate using rules
    for (const [path, rule] of this.rules.entries()) {
      // Skip if rule is environment-specific and doesn't match
      if (rule.environments && environment && !rule.environments.includes(environment as any)) {
        continue;
      }

      totalChecks++;
      const value = this.getValueAtPath(config, path);
      
      if (value === undefined && rule.severity === 'error') {
        errors.push({
          path,
          message: `Missing required configuration: ${rule.description}`,
          type: 'missing',
          timestamp: new Date()
        });
        continue;
      }

      const result = rule.schema.validate(value, { abortEarly: false });
      
      if (result.error) {
        const issues = result.error.details.map(detail => ({
          path: `${path}.${detail.path.join('.')}`,
          message: detail.message,
          value: detail.context?.value,
          type: detail.type,
          timestamp: new Date()
        }));

        if (rule.severity === 'error') {
          errors.push(...issues);
        } else {
          warnings.push(...issues.map(issue => {
            const suggestion = this.getSuggestion(issue.type, issue.value);
            const warning: any = {
              path: issue.path,
              message: issue.message,
              timestamp: issue.timestamp
            };
            if (suggestion) {
              warning.suggestion = suggestion;
            }
            return warning;
          }));
        }
      } else {
        passedChecks++;
      }
    }

    // Run custom validators
    for (const [name, validator] of this.customValidators.entries()) {
      totalChecks++;
      try {
        const result = validator(config, config);
        if (!result.valid) {
          errors.push(...result.errors);
          warnings.push(...result.warnings);
        } else {
          passedChecks++;
        }
      } catch (error) {
        errors.push({
          path: `custom.${name}`,
          message: `Custom validator failed: ${error}`,
          type: 'custom',
          timestamp: new Date()
        });
      }
    }

    // Additional security checks
    this.performSecurityChecks(config, errors, warnings);
    totalChecks++;
    if (errors.length === 0) passedChecks++;

    const duration = Date.now() - startTime;

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      statistics: {
        totalChecks,
        passedChecks,
        failedChecks: totalChecks - passedChecks,
        warnings: warnings.length,
        duration
      }
    };
  }

  /**
   * Perform security-specific checks
   */
  private performSecurityChecks(
    config: Record<string, any>,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    // Check for hardcoded secrets
    const secretPatterns = [
      /password.*=.*['"](.+)['"]/i,
      /secret.*=.*['"](.+)['"]/i,
      /api[_-]?key.*=.*['"](.+)['"]/i
    ];

    const configString = JSON.stringify(config);
    for (const pattern of secretPatterns) {
      if (pattern.test(configString)) {
        warnings.push({
          path: 'security',
          message: 'Potential hardcoded secret detected',
          suggestion: 'Use environment variables for sensitive values',
          timestamp: new Date()
        });
        break;
      }
    }

    // Check for weak encryption
    if (config['security']?.encryption?.key) {
      const keyLength = config['security'].encryption.key.length;
      if (keyLength < 32) {
        errors.push({
          path: 'security.encryption.key',
          message: 'Encryption key is too short (minimum 32 characters)',
          value: `${keyLength} characters`,
          type: 'security',
          timestamp: new Date()
        });
      }
    }

    // Check for insecure CORS
    if (config['security']?.cors?.origin === '*') {
      warnings.push({
        path: 'security.cors.origin',
        message: 'CORS origin set to wildcard (*) is insecure',
        suggestion: 'Specify allowed origins explicitly',
        timestamp: new Date()
      });
    }

    // Check SSL/TLS requirements
    if (config['database']?.postgres?.ssl === false && config['nodeEnv'] === 'production') {
      errors.push({
        path: 'database.postgres.ssl',
        message: 'SSL must be enabled for PostgreSQL in production',
        type: 'security',
        timestamp: new Date()
      });
    }
  }

  /**
   * Get value at path in object
   */
  private getValueAtPath(obj: any, path: string): any {
    const parts = path.split('.');
    let current = obj;
    
    for (const part of parts) {
      if (current === null || current === undefined) {
        return undefined;
      }
      current = current[part];
    }
    
    return current;
  }

  /**
   * Get suggestion for validation issue
   */
  private getSuggestion(type: string, _value?: any): string | undefined {
    const suggestions: Record<string, string> = {
      'number.port': 'Use a valid port number between 1 and 65535',
      'string.hostname': 'Use a valid hostname or IP address',
      'string.email': 'Use a valid email format (user@example.com)',
      'string.uri': 'Use a valid URI format (https://example.com)',
      'number.min': 'Increase the value to meet minimum requirements',
      'number.max': 'Decrease the value to meet maximum requirements',
      'string.pattern': 'Check the format requirements for this field',
      'any.required': 'This field is required and must be provided'
    };

    return suggestions[type];
  }

  /**
   * Create configuration snapshot
   */
  createSnapshot(config: Record<string, any>, metadata?: Record<string, any>): ConfigSnapshot {
    const configString = JSON.stringify(config, null, 2);
    const hash = createHash('sha256').update(configString).digest('hex');

    return {
      timestamp: new Date(),
      environment: config['nodeEnv'] || process.env['NODE_ENV'] || 'unknown',
      hash,
      config: JSON.parse(configString), // Deep clone
      metadata: metadata || {}
    };
  }

  /**
   * Compare two configuration snapshots
   */
  compareSnapshots(snapshot1: ConfigSnapshot, snapshot2: ConfigSnapshot): {
    identical: boolean;
    differences: Array<{
      path: string;
      oldValue: any;
      newValue: any;
      type: 'added' | 'removed' | 'modified';
    }>;
  } {
    if (snapshot1.hash === snapshot2.hash) {
      return { identical: true, differences: [] };
    }

    const differences: Array<{
      path: string;
      oldValue: any;
      newValue: any;
      type: 'added' | 'removed' | 'modified';
    }> = [];

    this.findDifferences(
      snapshot1.config,
      snapshot2.config,
      '',
      differences
    );

    return { identical: false, differences };
  }

  /**
   * Find differences between two objects
   */
  private findDifferences(
    obj1: any,
    obj2: any,
    path: string,
    differences: Array<any>
  ): void {
    const keys1 = new Set(Object.keys(obj1 || {}));
    const keys2 = new Set(Object.keys(obj2 || {}));
    const allKeys = new Set([...keys1, ...keys2]);

    for (const key of allKeys) {
      const currentPath = path ? `${path}.${key}` : key;
      const value1 = obj1?.[key];
      const value2 = obj2?.[key];

      if (!keys1.has(key)) {
        differences.push({
          path: currentPath,
          oldValue: undefined,
          newValue: value2,
          type: 'added'
        });
      } else if (!keys2.has(key)) {
        differences.push({
          path: currentPath,
          oldValue: value1,
          newValue: undefined,
          type: 'removed'
        });
      } else if (typeof value1 === 'object' && typeof value2 === 'object' && !Array.isArray(value1)) {
        this.findDifferences(value1, value2, currentPath, differences);
      } else if (JSON.stringify(value1) !== JSON.stringify(value2)) {
        differences.push({
          path: currentPath,
          oldValue: value1,
          newValue: value2,
          type: 'modified'
        });
      }
    }
  }

  /**
   * Generate validation report
   */
  generateReport(result: ValidationResult): string {
    let report = `# Configuration Validation Report\n\n`;
    report += `**Timestamp:** ${new Date().toISOString()}\n`;
    report += `**Status:** ${result.valid ? '✅ VALID' : '❌ INVALID'}\n\n`;

    report += `## Summary\n\n`;
    report += `- Total Checks: ${result.statistics.totalChecks}\n`;
    report += `- Passed: ${result.statistics.passedChecks}\n`;
    report += `- Failed: ${result.statistics.failedChecks}\n`;
    report += `- Warnings: ${result.statistics.warnings}\n`;
    report += `- Duration: ${result.statistics.duration}ms\n\n`;

    if (result.errors.length > 0) {
      report += `## ❌ Errors (${result.errors.length})\n\n`;
      for (const error of result.errors) {
        report += `### ${error.path}\n`;
        report += `- **Message:** ${error.message}\n`;
        if (error.value !== undefined) {
          report += `- **Value:** ${JSON.stringify(error.value)}\n`;
        }
        report += `- **Type:** ${error.type}\n`;
        report += `- **Time:** ${error.timestamp.toISOString()}\n\n`;
      }
    }

    if (result.warnings.length > 0) {
      report += `## ⚠️ Warnings (${result.warnings.length})\n\n`;
      for (const warning of result.warnings) {
        report += `### ${warning.path}\n`;
        report += `- **Message:** ${warning.message}\n`;
        if (warning.suggestion) {
          report += `- **Suggestion:** ${warning.suggestion}\n`;
        }
        report += `- **Time:** ${warning.timestamp.toISOString()}\n\n`;
      }
    }

    return report;
  }
}