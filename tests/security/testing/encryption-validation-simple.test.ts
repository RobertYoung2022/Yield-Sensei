/**
 * Simple Encryption Validation Framework Tests
 * 
 * Basic test suite for the encryption validation framework
 */

import { EncryptionValidationFramework } from '../../../src/security/testing/encryption-validation-framework';

describe('EncryptionValidationFramework - Basic Tests', () => {
  let framework: EncryptionValidationFramework;

  beforeEach(() => {
    framework = new EncryptionValidationFramework();
  });

  afterEach(() => {
    framework.removeAllListeners();
  });

  describe('Framework Initialization', () => {
    it('should create instance without errors', () => {
      expect(framework).toBeInstanceOf(EncryptionValidationFramework);
    });

    it('should have test cases initialized', () => {
      const testCases = framework['testCases'];
      expect(testCases).toBeDefined();
      expect(testCases.size).toBeGreaterThan(0);
    });
  });

  describe('Basic Validation Run', () => {
    it('should run validation without crashing', async () => {
      const report = await framework.runValidation('test');
      
      expect(report).toBeDefined();
      expect(report.environment).toBe('test');
      expect(typeof report.overallScore).toBe('number');
      expect(report.overallScore).toBeGreaterThanOrEqual(0);
      expect(report.overallScore).toBeLessThanOrEqual(100);
      expect(Array.isArray(report.testResults)).toBe(true);
      expect(report.testResults.length).toBeGreaterThan(0);
    }, 30000);

    it('should generate valid report structure', async () => {
      const report = await framework.runValidation('test');
      
      expect(report.id).toContain('encryption_validation_');
      expect(report.generated).toBeInstanceOf(Date);
      expect(report.summary).toBeDefined();
      expect(typeof report.summary.totalTests).toBe('number');
      expect(typeof report.summary.passedTests).toBe('number');
      expect(typeof report.summary.failedTests).toBe('number');
      expect(Array.isArray(report.recommendations)).toBe(true);
      expect(Array.isArray(report.nextActions)).toBe(true);
    }, 30000);
  });

  describe('Report Export', () => {
    it('should export JSON report', async () => {
      const report = await framework.runValidation('test');
      const jsonReport = framework.exportReport(report, 'json');
      
      expect(() => JSON.parse(jsonReport)).not.toThrow();
      const parsed = JSON.parse(jsonReport);
      expect(parsed.id).toBe(report.id);
    }, 30000);

    it('should export HTML report', async () => {
      const report = await framework.runValidation('test');
      const htmlReport = framework.exportReport(report, 'html');
      
      expect(htmlReport).toContain('<!DOCTYPE html>');
      expect(htmlReport).toContain('Encryption Validation Report');
    }, 30000);

    it('should export CSV report', async () => {
      const report = await framework.runValidation('test');
      const csvReport = framework.exportReport(report, 'csv');
      
      const lines = csvReport.split('\n');
      expect(lines[0]).toContain('Test ID');
      expect(lines.length).toBeGreaterThan(1);
    }, 30000);
  });

  describe('Event Emission', () => {
    it('should emit validation completed event', async () => {
      let eventEmitted = false;
      
      framework.on('validation:completed', () => {
        eventEmitted = true;
      });

      await framework.runValidation('test');
      expect(eventEmitted).toBe(true);
    }, 30000);
  });
});