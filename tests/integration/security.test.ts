/**
 * Integration tests for security components
 */

import { securityConfigValidator } from '../../src/config/validation/security-config-validator';
import { secretHealthChecker } from '../../src/config/validation/secret-health-checker';
import { configurationAuditLogger } from '../../src/config/validation/audit-logger';

describe('Security Integration Tests', () => {
  beforeAll(async () => {
    // Setup test environment
    process.env['NODE_ENV'] = 'test';
  });

  describe('Security Configuration Validator', () => {
    it('should validate basic security configuration', async () => {
      // Set test environment variables for validation
      process.env['JWT_SECRET'] = 'Very-Strong-Test-Secret-Key-123!@#$%^&*()_+';
      process.env['NODE_ENV'] = 'test';
      process.env['DATABASE_URL'] = 'postgresql://user:pass@localhost:5432/test?sslmode=require';

      const result = await securityConfigValidator.validateSecurityConfiguration('test');
      expect(result.overallScore).toBeGreaterThanOrEqual(80);
      expect(result.criticalIssues.length).toBe(0);
    });

    it('should detect security violations', async () => {
      // Set insecure environment variables for validation
      process.env['JWT_SECRET'] = '123'; // Too short and weak
      process.env['NODE_ENV'] = 'production';
      process.env['DEBUG'] = 'true'; // Debug enabled in production
      process.env['DATABASE_URL'] = 'postgresql://user:pass@localhost:5432/test'; // No SSL

      const result = await securityConfigValidator.validateSecurityConfiguration('production');
      expect(result.overallScore).toBeLessThan(80);
      expect(result.criticalIssues.length).toBeGreaterThan(0);
    });
  });

  describe('Secret Health Checker', () => {
    it('should perform health check', async () => {
      const healthReport = await secretHealthChecker.performHealthCheck();
      
      expect(healthReport).toBeDefined();
      expect(healthReport.timestamp).toBeInstanceOf(Date);
      expect(healthReport.overallStatus).toMatch(/healthy|degraded|critical/);
      expect(Array.isArray(healthReport.components)).toBe(true);
    });
  });

  describe('Audit Logger', () => {
    it('should log configuration changes', async () => {
      const auditId = await configurationAuditLogger.logConfigurationChange(
        'test-user',
        'update',
        {
          type: 'configuration',
          identifier: 'test-config',
          environment: 'test'
        },
        { oldValue: 'old' },
        { newValue: 'new' }
      );

      expect(auditId).toBeDefined();
      expect(typeof auditId).toBe('string');
    });
  });

  afterAll(async () => {
    // Cleanup
  });
});