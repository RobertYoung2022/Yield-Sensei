/**
 * Comprehensive Security Validation Tests
 * 
 * Test suite for the comprehensive security validation framework
 */

import { ComprehensiveSecurityValidator } from '../../../src/security/testing/comprehensive-security-validation';

describe('ComprehensiveSecurityValidator', () => {
  let validator: ComprehensiveSecurityValidator;

  beforeEach(() => {
    validator = new ComprehensiveSecurityValidator();
  });

  afterEach(() => {
    validator.removeAllListeners();
  });

  describe('Framework Initialization', () => {
    it('should create instance without errors', () => {
      expect(validator).toBeInstanceOf(ComprehensiveSecurityValidator);
    });

    it('should have test cases initialized', () => {
      const testCases = validator['testCases'];
      expect(testCases).toBeDefined();
      expect(testCases.size).toBeGreaterThan(0);
    });

    it('should initialize test cases with all security categories', () => {
      const testCases = Array.from(validator['testCases'].values());
      const categories = ['authentication', 'authorization', 'input_validation', 'session_management', 
                         'injection', 'xss', 'csrf', 'api_security', 'headers', 'rate_limiting', 'integration'];
      
      for (const category of categories) {
        expect(testCases.some(tc => tc.category === category)).toBe(true);
      }
    });

    it('should have OWASP categorized tests', () => {
      const testCases = Array.from(validator['testCases'].values());
      const owaspTests = testCases.filter(tc => tc.owaspCategory);
      expect(owaspTests.length).toBeGreaterThan(0);
    });
  });

  describe('Validation Execution', () => {
    it('should run comprehensive validation without crashing', async () => {
      const report = await validator.runValidation('test');
      
      expect(report).toBeDefined();
      expect(report.environment).toBe('test');
      expect(typeof report.summary.overallScore).toBe('number');
      expect(report.summary.overallScore).toBeGreaterThanOrEqual(0);
      expect(report.summary.overallScore).toBeLessThanOrEqual(100);
      expect(Array.isArray(report.testResults)).toBe(true);
      expect(report.testResults.length).toBeGreaterThan(0);
    }, 60000);

    it('should generate valid comprehensive report structure', async () => {
      const report = await validator.runValidation('test');
      
      expect(report.id).toContain('comprehensive_security_');
      expect(report.generated).toBeInstanceOf(Date);
      expect(report.summary).toBeDefined();
      expect(typeof report.summary.totalTests).toBe('number');
      expect(typeof report.summary.passedTests).toBe('number');
      expect(typeof report.summary.criticalVulnerabilities).toBe('number');
      expect(Array.isArray(report.recommendations)).toBe(true);
      expect(Array.isArray(report.nextActions)).toBe(true);
      expect(report.componentResults).toBeDefined();
      expect(report.securityMetrics).toBeDefined();
      expect(report.complianceStatus).toBeDefined();
    }, 60000);

    it('should include component validation results', async () => {
      const report = await validator.runValidation('development');
      
      expect(report.componentResults).toBeDefined();
      expect(report.componentResults.encryption).toBeDefined();
      expect(report.componentResults.environment).toBeDefined();
      expect(report.componentResults.database).toBeDefined();
    }, 60000);

    it('should calculate security metrics', async () => {
      const report = await validator.runValidation('development');
      
      expect(report.securityMetrics).toBeDefined();
      expect(typeof report.securityMetrics.authenticationStrength).toBe('number');
      expect(typeof report.securityMetrics.authorizationCoverage).toBe('number');
      expect(typeof report.securityMetrics.inputValidationScore).toBe('number');
      expect(typeof report.securityMetrics.apiSecurityScore).toBe('number');
    }, 60000);

    it('should assess OWASP compliance', async () => {
      const report = await validator.runValidation('development');
      
      expect(report.summary.owaspCompliance).toBeDefined();
      expect(typeof report.summary.owaspCompliance.compliant).toBe('boolean');
      expect(typeof report.summary.owaspCompliance.score).toBe('number');
      expect(Array.isArray(report.summary.owaspCompliance.failedCategories)).toBe(true);
    }, 60000);
  });

  describe('Security Test Categories', () => {
    it('should test authentication mechanisms', async () => {
      const report = await validator.runValidation('development');
      
      const authTests = report.testResults.filter(r => r.category === 'authentication');
      expect(authTests.length).toBeGreaterThan(0);
      
      for (const test of authTests) {
        expect(test.name).toBeDefined();
        expect(typeof test.passed).toBe('boolean');
        expect(typeof test.score).toBe('number');
      }
    }, 60000);

    it('should test authorization controls', async () => {
      const report = await validator.runValidation('development');
      
      const authzTests = report.testResults.filter(r => r.category === 'authorization');
      expect(authzTests.length).toBeGreaterThan(0);
    }, 60000);

    it('should test input validation', async () => {
      const report = await validator.runValidation('development');
      
      const inputTests = report.testResults.filter(r => r.category === 'input_validation');
      expect(inputTests.length).toBeGreaterThan(0);
    }, 60000);

    it('should test injection prevention', async () => {
      const report = await validator.runValidation('development');
      
      const injectionTests = report.testResults.filter(r => r.category === 'injection');
      expect(injectionTests.length).toBeGreaterThan(0);
    }, 60000);

    it('should test session management', async () => {
      const report = await validator.runValidation('development');
      
      const sessionTests = report.testResults.filter(r => r.category === 'session_management');
      expect(sessionTests.length).toBeGreaterThan(0);
    }, 60000);
  });

  describe('Report Export', () => {
    it('should export JSON report', async () => {
      const report = await validator.runValidation('test');
      const jsonReport = validator.exportReport(report, 'json');
      
      expect(() => JSON.parse(jsonReport)).not.toThrow();
      const parsed = JSON.parse(jsonReport);
      expect(parsed.id).toBe(report.id);
      expect(parsed.environment).toBe(report.environment);
    }, 60000);

    it('should export HTML report', async () => {
      const report = await validator.runValidation('test');
      const htmlReport = validator.exportReport(report, 'html');
      
      expect(htmlReport).toContain('<!DOCTYPE html>');
      expect(htmlReport).toContain('Comprehensive Security Validation Report');
      expect(htmlReport).toContain(report.environment);
      expect(htmlReport).toContain('Security Posture');
    }, 60000);

    it('should export CSV report', async () => {
      const report = await validator.runValidation('test');
      const csvReport = validator.exportReport(report, 'csv');
      
      const lines = csvReport.split('\n');
      expect(lines[0]).toContain('Test ID');
      expect(lines[0]).toContain('OWASP Category');
      expect(lines.length).toBeGreaterThan(1);
    }, 60000);
  });

  describe('Security Posture Assessment', () => {
    it('should determine security posture correctly', async () => {
      const report = await validator.runValidation('development');
      
      const validPostures = ['excellent', 'good', 'fair', 'poor', 'critical'];
      expect(validPostures).toContain(report.summary.securityPosture);
      
      // Security posture should correlate with overall score
      if (report.summary.overallScore >= 90) {
        expect(report.summary.securityPosture).toBe('excellent');
      } else if (report.summary.overallScore < 50) {
        expect(['poor', 'critical']).toContain(report.summary.securityPosture);
      }
    }, 60000);

    it('should assess compliance status', async () => {
      const report = await validator.runValidation('development');
      
      expect(report.complianceStatus).toBeDefined();
      expect(typeof report.complianceStatus.owasp).toBe('boolean');
      expect(typeof report.complianceStatus.pci).toBe('boolean');
      expect(typeof report.complianceStatus.hipaa).toBe('boolean');
      expect(typeof report.complianceStatus.gdpr).toBe('boolean');
    }, 60000);
  });

  describe('Security Vulnerabilities', () => {
    it('should detect and categorize vulnerabilities', async () => {
      const report = await validator.runValidation('development');
      
      const allVulns = report.testResults.flatMap(r => r.vulnerabilities);
      if (allVulns.length > 0) {
        for (const vuln of allVulns) {
          expect(vuln.id).toBeDefined();
          expect(vuln.description).toBeDefined();
          expect(['low', 'medium', 'high', 'critical']).toContain(vuln.severity);
          expect(vuln.remediation).toBeDefined();
        }
      }
    }, 60000);

    it('should provide OWASP mapping for vulnerabilities', async () => {
      const report = await validator.runValidation('development');
      
      const owaspVulns = report.testResults
        .flatMap(r => r.vulnerabilities)
        .filter(v => v.owaspCategory);
      
      if (owaspVulns.length > 0) {
        for (const vuln of owaspVulns) {
          expect(vuln.owaspCategory).toMatch(/A\d{2}:2021/);
        }
      }
    }, 60000);
  });

  describe('Recommendations Generation', () => {
    it('should generate security recommendations', async () => {
      const report = await validator.runValidation('development');
      
      expect(Array.isArray(report.recommendations)).toBe(true);
      expect(Array.isArray(report.nextActions)).toBe(true);
      
      if (report.recommendations.length > 0) {
        for (const rec of report.recommendations) {
          expect(typeof rec).toBe('string');
          expect(rec.length).toBeGreaterThan(0);
        }
      }
    }, 60000);

    it('should prioritize critical issues in next actions', async () => {
      const report = await validator.runValidation('development');
      
      if (report.summary.criticalVulnerabilities > 0) {
        expect(report.nextActions.some(action => 
          action.toLowerCase().includes('critical')
        )).toBe(true);
      }
    }, 60000);
  });

  describe('Event Emission', () => {
    it('should emit validation events', async () => {
      let startedEmitted = false;
      let completedEmitted = false;
      
      validator.on('validation:started', () => {
        startedEmitted = true;
      });

      validator.on('validation:completed', () => {
        completedEmitted = true;
      });

      await validator.runValidation('test');
      
      expect(startedEmitted).toBe(true);
      expect(completedEmitted).toBe(true);
    }, 60000);
  });

  describe('Error Handling', () => {
    it('should handle component validation failures gracefully', async () => {
      // This test ensures the validator doesn't crash when component validations fail
      const report = await validator.runValidation('invalid-environment');
      
      expect(report).toBeDefined();
      expect(report.componentResults).toBeDefined();
      
      // Check that component failures are recorded
      if (report.componentResults.encryption?.error) {
        expect(typeof report.componentResults.encryption.error).toBe('string');
      }
    }, 60000);
  });
});