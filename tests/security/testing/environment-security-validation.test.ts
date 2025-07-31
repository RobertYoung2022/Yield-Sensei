/**
 * Environment Security Validation Tests
 * 
 * Test suite for the environment variable security validation framework
 */

import { EnvironmentSecurityValidator } from '../../../src/security/testing/environment-security-validation';

describe('EnvironmentSecurityValidator', () => {
  let validator: EnvironmentSecurityValidator;

  beforeEach(() => {
    validator = new EnvironmentSecurityValidator();
  });

  afterEach(() => {
    validator.removeAllListeners();
  });

  describe('Framework Initialization', () => {
    it('should create instance without errors', () => {
      expect(validator).toBeInstanceOf(EnvironmentSecurityValidator);
    });

    it('should have required variables initialized', () => {
      const requiredVars = validator['requiredVariables'];
      expect(requiredVars).toBeDefined();
      expect(requiredVars.size).toBeGreaterThan(0);
    });

    it('should have security patterns initialized', () => {
      const securityPatterns = validator['securityPatterns'];
      expect(securityPatterns).toBeDefined();
      expect(securityPatterns.size).toBeGreaterThan(0);
    });

    it('should have test cases initialized', () => {
      const testCases = validator['testCases'];
      expect(testCases).toBeDefined();
      expect(testCases.size).toBeGreaterThan(0);
    });
  });

  describe('Validation Execution', () => {
    it('should run validation without crashing', async () => {
      const report = await validator.runValidation('test');
      
      expect(report).toBeDefined();
      expect(report.environment).toBe('test');
      expect(typeof report.summary.securityScore).toBe('number');
      expect(report.summary.securityScore).toBeGreaterThanOrEqual(0);
      expect(report.summary.securityScore).toBeLessThanOrEqual(100);
      expect(Array.isArray(report.testResults)).toBe(true);
      expect(report.testResults.length).toBeGreaterThan(0);
    }, 30000);

    it('should generate valid report structure', async () => {
      const report = await validator.runValidation('test');
      
      expect(report.id).toContain('environment_security_');
      expect(report.generated).toBeInstanceOf(Date);
      expect(report.summary).toBeDefined();
      expect(typeof report.summary.totalTests).toBe('number');
      expect(typeof report.summary.passedTests).toBe('number');
      expect(typeof report.summary.criticalIssues).toBe('number');
      expect(Array.isArray(report.recommendations)).toBe(true);
      expect(Array.isArray(report.nextActions)).toBe(true);
      expect(report.environmentAnalysis).toBeDefined();
    }, 30000);

    it('should detect missing required variables', async () => {
      // Clear some required environment variables for testing
      const originalApiKey = process.env['API_SECRET_KEY'];
      delete process.env['API_SECRET_KEY'];

      const report = await validator.runValidation('development');
      
      const requiredVarTest = report.testResults.find(r => r.testId === 'required_vars_present');
      expect(requiredVarTest).toBeDefined();
      expect(requiredVarTest!.passed).toBe(false);
      
      const missingVarVulns = requiredVarTest!.vulnerabilities.filter(v => 
        v.description.includes('API_SECRET_KEY')
      );
      expect(missingVarVulns.length).toBeGreaterThan(0);

      // Restore original value
      if (originalApiKey) {
        process.env['API_SECRET_KEY'] = originalApiKey;
      }
    }, 30000);
  });

  describe('Report Export', () => {
    it('should export JSON report', async () => {
      const report = await validator.runValidation('test');
      const jsonReport = validator.exportReport(report, 'json');
      
      expect(() => JSON.parse(jsonReport)).not.toThrow();
      const parsed = JSON.parse(jsonReport);
      expect(parsed.id).toBe(report.id);
      expect(parsed.environment).toBe(report.environment);
    }, 30000);

    it('should export HTML report', async () => {
      const report = await validator.runValidation('test');
      const htmlReport = validator.exportReport(report, 'html');
      
      expect(htmlReport).toContain('<!DOCTYPE html>');
      expect(htmlReport).toContain('Environment Security Validation Report');
      expect(htmlReport).toContain(report.environment);
    }, 30000);

    it('should export CSV report', async () => {
      const report = await validator.runValidation('test');
      const csvReport = validator.exportReport(report, 'csv');
      
      const lines = csvReport.split('\n');
      expect(lines[0]).toContain('Test ID');
      expect(lines[0]).toContain('Status');
      expect(lines[0]).toContain('Score');
      expect(lines.length).toBeGreaterThan(1);
    }, 30000);
  });

  describe('Environment Analysis', () => {
    it('should categorize environment variables correctly', async () => {
      const report = await validator.runValidation('development');
      const analysis = report.environmentAnalysis;
      
      expect(analysis).toBeDefined();
      expect(Array.isArray(analysis.requiredVariables)).toBe(true);
      expect(Array.isArray(analysis.optionalVariables)).toBe(true);
      expect(Array.isArray(analysis.securityVariables)).toBe(true);
      expect(Array.isArray(analysis.unknownVariables)).toBe(true);
    }, 30000);

    it('should analyze security variable strength', async () => {
      const report = await validator.runValidation('development');
      const analysis = report.environmentAnalysis;
      
      for (const secVar of analysis.securityVariables) {
        expect(secVar.name).toBeDefined();
        expect(secVar.category).toBeDefined();
        expect(['weak', 'medium', 'strong']).toContain(secVar.strength);
        expect(Array.isArray(secVar.issues)).toBe(true);
      }
    }, 30000);
  });

  describe('Security Pattern Detection', () => {
    it('should detect insecure default values', async () => {
      // Set an insecure default value
      process.env['TEST_INSECURE_VAR'] = 'password123';
      
      const report = await validator.runValidation('test');
      const defaultsTest = report.testResults.find(r => r.testId === 'insecure_defaults');
      
      expect(defaultsTest).toBeDefined();
      
      // Clean up
      delete process.env['TEST_INSECURE_VAR'];
    }, 30000);

    it('should validate variable formats', async () => {
      const report = await validator.runValidation('test');
      const formatTest = report.testResults.find(r => r.testId === 'format_validation');
      
      expect(formatTest).toBeDefined();
      expect(typeof formatTest!.passed).toBe('boolean');
      expect(typeof formatTest!.score).toBe('number');
    }, 30000);
  });

  describe('Event Emission', () => {
    it('should emit validation completed event', async () => {
      let eventEmitted = false;
      
      validator.on('validation:completed', () => {
        eventEmitted = true;
      });

      await validator.runValidation('test');
      expect(eventEmitted).toBe(true);
    }, 30000);

    it('should emit test events during validation', async () => {
      const events: string[] = [];
      
      validator.on('test:started', (data) => {
        events.push(`started:${data.testId}`);
      });

      validator.on('test:completed', (data) => {
        events.push(`completed:${data.testId}`);
      });

      await validator.runValidation('test');
      
      expect(events.length).toBeGreaterThan(0);
      expect(events.filter(e => e.startsWith('started:')).length).toBeGreaterThan(0);
      expect(events.filter(e => e.startsWith('completed:')).length).toBeGreaterThan(0);
    }, 30000);
  });

  describe('Error Handling', () => {
    it('should handle malformed environment gracefully', async () => {
      // This test ensures the validator doesn't crash with unexpected input
      await expect(validator.runValidation('invalid-environment')).resolves.toBeDefined();
    }, 30000);

    it('should handle missing required variables gracefully', async () => {
      // Clear all environment variables that might be required
      const backup = { ...process.env };
      
      // Clear some known required variables
      delete process.env['API_SECRET_KEY'];
      delete process.env['JWT_SECRET'];
      delete process.env['SESSION_SECRET'];
      
      const report = await validator.runValidation('development');
      
      expect(report).toBeDefined();
      expect(report.summary.criticalIssues).toBeGreaterThan(0);
      
      // Restore environment
      Object.assign(process.env, backup);
    }, 30000);
  });
});