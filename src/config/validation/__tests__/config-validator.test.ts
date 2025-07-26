/**
 * Configuration Validator Test Suite
 */

import { ConfigValidator, ValidationRule, ValidationResult } from '../config-validator';
import * as Joi from 'joi';

describe('ConfigValidator', () => {
  let validator: ConfigValidator;

  beforeEach(() => {
    validator = new ConfigValidator();
  });

  describe('Basic Validation', () => {
    test('should validate valid configuration', () => {
      const config = {
        database: {
          postgres: {
            host: 'localhost',
            port: 5432,
            database: 'testdb',
            user: 'testuser',
            password: 'verysecurepassword123',
            ssl: false
          }
        },
        security: {
          jwt: {
            secret: 'a'.repeat(32),
            expiresIn: '24h'
          }
        }
      };

      const result = validator.validate(config);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should detect missing required fields', () => {
      const config = {
        database: {
          postgres: {
            host: 'localhost',
            // Missing required fields: database, user, password
          }
        }
      };

      const result = validator.validate(config);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.type === 'any.required')).toBe(true);
    });

    test('should validate field types', () => {
      const config = {
        database: {
          postgres: {
            host: 'localhost',
            port: 'not-a-number', // Should be number
            database: 'testdb',
            user: 'testuser',
            password: 'secure123'
          }
        }
      };

      const result = validator.validate(config);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.path.includes('port'))).toBe(true);
    });

    test('should enforce minimum password length', () => {
      const config = {
        database: {
          postgres: {
            host: 'localhost',
            port: 5432,
            database: 'testdb',
            user: 'testuser',
            password: 'short' // Too short
          }
        }
      };

      const result = validator.validate(config);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.path.includes('password'))).toBe(true);
    });
  });

  describe('Security Validation', () => {
    test('should validate JWT configuration', () => {
      const config = {
        security: {
          jwt: {
            secret: 'a'.repeat(32),
            expiresIn: '24h',
            algorithm: 'HS256'
          }
        }
      };

      const result = validator.validate(config);
      const jwtErrors = result.errors.filter(e => e.path.includes('jwt'));
      expect(jwtErrors).toHaveLength(0);
    });

    test('should reject short JWT secrets', () => {
      const config = {
        security: {
          jwt: {
            secret: 'tooshort',
            expiresIn: '24h'
          }
        }
      };

      const result = validator.validate(config);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => 
        e.path.includes('jwt.secret') && e.message.includes('32')
      )).toBe(true);
    });

    test('should validate CORS configuration', () => {
      const config = {
        security: {
          cors: {
            origin: ['http://localhost:3000', 'https://example.com'],
            credentials: true,
            methods: ['GET', 'POST'],
            allowedHeaders: ['Content-Type', 'Authorization']
          }
        }
      };

      const result = validator.validate(config);
      const corsErrors = result.errors.filter(e => e.path.includes('cors'));
      expect(corsErrors).toHaveLength(0);
    });

    test('should warn about wildcard CORS origin', () => {
      const config = {
        security: {
          cors: {
            origin: '*',
            credentials: true,
            methods: ['GET', 'POST'],
            allowedHeaders: ['*']
          }
        }
      };

      const result = validator.validate(config);
      expect(result.warnings.some(w => 
        w.path.includes('cors.origin') && w.message.includes('insecure')
      )).toBe(true);
    });
  });

  describe('Environment-Specific Validation', () => {
    test('should enforce production constraints', () => {
      const config = {
        nodeEnv: 'production',
        production: {
          debugMode: true, // Should be false in production
          mockExternalApis: true, // Should be false in production
          logLevel: 'debug' // Should be error, warn, or info
        }
      };

      const result = validator.validate(config, 'production');
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.path.includes('debugMode'))).toBe(true);
      expect(result.errors.some(e => e.path.includes('mockExternalApis'))).toBe(true);
    });

    test('should skip environment-specific rules when not applicable', () => {
      const config = {
        nodeEnv: 'development',
        production: {
          debugMode: true,
          mockExternalApis: true
        }
      };

      const result = validator.validate(config, 'development');
      // Production rules should not apply in development
      const productionErrors = result.errors.filter(e => e.path.includes('production'));
      expect(productionErrors).toHaveLength(0);
    });
  });

  describe('Custom Validators', () => {
    test('should execute custom validators', () => {
      validator.addCustomValidator('test-validator', (value, config) => ({
        valid: false,
        errors: [{
          path: 'custom.test',
          message: 'Custom validation failed',
          type: 'custom',
          timestamp: new Date()
        }],
        warnings: [],
        statistics: {
          totalChecks: 1,
          passedChecks: 0,
          failedChecks: 1,
          warnings: 0,
          duration: 0
        }
      }));

      const result = validator.validate({});
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.path === 'custom.test')).toBe(true);
    });

    test('should handle custom validator errors gracefully', () => {
      validator.addCustomValidator('error-validator', () => {
        throw new Error('Validator error');
      });

      const result = validator.validate({});
      expect(result.errors.some(e => 
        e.path === 'custom.error-validator' && e.message.includes('failed')
      )).toBe(true);
    });
  });

  describe('Configuration Snapshots', () => {
    test('should create configuration snapshot', () => {
      const config = {
        test: 'value',
        nested: { key: 'value' }
      };

      const snapshot = validator.createSnapshot(config);
      expect(snapshot.timestamp).toBeInstanceOf(Date);
      expect(snapshot.hash).toBeDefined();
      expect(snapshot.config).toEqual(config);
      expect(snapshot.environment).toBeDefined();
    });

    test('should generate same hash for identical configurations', () => {
      const config = { test: 'value' };
      
      const snapshot1 = validator.createSnapshot(config);
      const snapshot2 = validator.createSnapshot(config);
      
      expect(snapshot1.hash).toBe(snapshot2.hash);
    });

    test('should generate different hash for different configurations', () => {
      const config1 = { test: 'value1' };
      const config2 = { test: 'value2' };
      
      const snapshot1 = validator.createSnapshot(config1);
      const snapshot2 = validator.createSnapshot(config2);
      
      expect(snapshot1.hash).not.toBe(snapshot2.hash);
    });
  });

  describe('Snapshot Comparison', () => {
    test('should detect no differences in identical snapshots', () => {
      const config = { test: 'value' };
      const snapshot1 = validator.createSnapshot(config);
      const snapshot2 = validator.createSnapshot(config);

      const comparison = validator.compareSnapshots(snapshot1, snapshot2);
      expect(comparison.identical).toBe(true);
      expect(comparison.differences).toHaveLength(0);
    });

    test('should detect added fields', () => {
      const config1 = { existing: 'value' };
      const config2 = { existing: 'value', new: 'field' };
      
      const snapshot1 = validator.createSnapshot(config1);
      const snapshot2 = validator.createSnapshot(config2);

      const comparison = validator.compareSnapshots(snapshot1, snapshot2);
      expect(comparison.identical).toBe(false);
      expect(comparison.differences.some(d => 
        d.path === 'new' && d.type === 'added'
      )).toBe(true);
    });

    test('should detect removed fields', () => {
      const config1 = { existing: 'value', toRemove: 'field' };
      const config2 = { existing: 'value' };
      
      const snapshot1 = validator.createSnapshot(config1);
      const snapshot2 = validator.createSnapshot(config2);

      const comparison = validator.compareSnapshots(snapshot1, snapshot2);
      expect(comparison.identical).toBe(false);
      expect(comparison.differences.some(d => 
        d.path === 'toRemove' && d.type === 'removed'
      )).toBe(true);
    });

    test('should detect modified fields', () => {
      const config1 = { field: 'oldValue' };
      const config2 = { field: 'newValue' };
      
      const snapshot1 = validator.createSnapshot(config1);
      const snapshot2 = validator.createSnapshot(config2);

      const comparison = validator.compareSnapshots(snapshot1, snapshot2);
      expect(comparison.identical).toBe(false);
      expect(comparison.differences.some(d => 
        d.path === 'field' && 
        d.type === 'modified' &&
        d.oldValue === 'oldValue' &&
        d.newValue === 'newValue'
      )).toBe(true);
    });

    test('should detect nested differences', () => {
      const config1 = { nested: { deep: { value: 'old' } } };
      const config2 = { nested: { deep: { value: 'new' } } };
      
      const snapshot1 = validator.createSnapshot(config1);
      const snapshot2 = validator.createSnapshot(config2);

      const comparison = validator.compareSnapshots(snapshot1, snapshot2);
      expect(comparison.differences.some(d => 
        d.path === 'nested.deep.value' && d.type === 'modified'
      )).toBe(true);
    });
  });

  describe('Report Generation', () => {
    test('should generate validation report', () => {
      const result: ValidationResult = {
        valid: false,
        errors: [{
          path: 'test.error',
          message: 'Test error',
          type: 'test',
          timestamp: new Date()
        }],
        warnings: [{
          path: 'test.warning',
          message: 'Test warning',
          timestamp: new Date()
        }],
        statistics: {
          totalChecks: 10,
          passedChecks: 8,
          failedChecks: 2,
          warnings: 1,
          duration: 100
        }
      };

      const report = validator.generateReport(result);
      
      expect(report).toContain('Configuration Validation Report');
      expect(report).toContain('Status:** ❌ INVALID');
      expect(report).toContain('## ❌ Errors (1)');
      expect(report).toContain('## ⚠️ Warnings (1)');
      expect(report).toContain('Total Checks: 10');
      expect(report).toContain('Duration: 100ms');
    });
  });

  describe('Adding Custom Rules', () => {
    test('should add and validate custom rules', () => {
      const customRule: ValidationRule = {
        path: 'custom.field',
        schema: Joi.object({
          required: Joi.string().required(),
          optional: Joi.number().optional()
        }),
        description: 'Custom field validation',
        severity: 'error'
      };

      validator.addRule(customRule);

      const config = {
        custom: {
          field: {
            required: 'value',
            optional: 123
          }
        }
      };

      const result = validator.validate(config);
      const customErrors = result.errors.filter(e => e.path.includes('custom.field'));
      expect(customErrors).toHaveLength(0);
    });
  });

  describe('Security Checks', () => {
    test('should detect hardcoded secrets', () => {
      const config = {
        database: {
          password: "hardcoded_password_123"
        }
      };

      const result = validator.validate(config);
      expect(result.warnings.some(w => 
        w.message.includes('hardcoded secret')
      )).toBe(true);
    });

    test('should enforce SSL in production', () => {
      const config = {
        nodeEnv: 'production',
        database: {
          postgres: {
            host: 'localhost',
            port: 5432,
            database: 'prod',
            user: 'produser',
            password: 'secure_production_password',
            ssl: false
          }
        }
      };

      const result = validator.validate(config, 'production');
      expect(result.errors.some(e => 
        e.path.includes('ssl') && e.message.includes('production')
      )).toBe(true);
    });
  });
});