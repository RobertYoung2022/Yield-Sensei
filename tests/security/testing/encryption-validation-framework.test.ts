/**
 * Encryption Validation Framework Tests
 * 
 * Comprehensive test suite for the encryption validation framework
 */

import { EncryptionValidationFramework } from '../../../src/security/testing/encryption-validation-framework';

describe('EncryptionValidationFramework', () => {
  let framework: EncryptionValidationFramework;

  beforeEach(() => {
    framework = new EncryptionValidationFramework();
  });

  afterEach(() => {
    // Clean up any listeners
    framework.removeAllListeners();
  });

  describe('Initialization', () => {
    it('should initialize with test cases', () => {
      expect(framework['testCases'].size).toBeGreaterThan(0);
    });

    it('should have test cases for all categories', () => {
      const categories = Array.from(framework['testCases'].values())
        .map((tc: any) => tc.category);
      
      expect(categories).toContain('data_at_rest');
      expect(categories).toContain('data_in_transit');
      expect(categories).toContain('key_management');
      expect(categories).toContain('algorithm_compliance');
    });

    it('should have critical severity tests', () => {
      const criticalTests = Array.from(framework['testCases'].values())
        .filter((tc: any) => tc.severity === 'critical');
      
      expect(criticalTests.length).toBeGreaterThan(0);
    });
  });

  describe('Data at Rest Encryption', () => {
    it('should validate AES-256-GCM encryption', async () => {
      const testCase = framework['testCases'].get('data_at_rest_aes_256');
      expect(testCase).toBeDefined();

      if (testCase) {
        const result = await testCase.testFunction();
        expect(result.testId).toBe('data_at_rest_aes_256');
        expect(typeof result.passed).toBe('boolean');
        expect(result.score).toBeGreaterThanOrEqual(0);
        expect(result.score).toBeLessThanOrEqual(100);
      }
    }, 10000);

    it('should detect database TDE configuration', async () => {
      const testCase = framework['testCases'].get('database_encryption_tde');
      expect(testCase).toBeDefined();

      if (testCase) {
        const result = await testCase.testFunction();
        expect(result.testId).toBe('database_encryption_tde');
        expect(Array.isArray(result.vulnerabilities)).toBe(true);
        expect(Array.isArray(result.recommendations)).toBe(true);
        expect(Array.isArray(result.evidence)).toBe(true);
      }
    }, 5000);
  });

  describe('Data in Transit Encryption', () => {
    it('should validate TLS configuration', async () => {
      const testCase = framework['testCases'].get('tls_configuration');
      expect(testCase).toBeDefined();

      if (testCase) {
        const result = await testCase.testFunction();
        expect(result.testId).toBe('tls_configuration');
        expect(result.details.algorithm).toContain('TLS');
      }
    }, 5000);

    it('should validate API encryption settings', async () => {
      const testCase = framework['testCases'].get('api_encryption_validation');
      expect(testCase).toBeDefined();

      if (testCase) {
        const result = await testCase.testFunction();
        expect(result.testId).toBe('api_encryption_validation');
        expect(result.details.algorithm).toContain('HTTPS');
      }
    }, 5000);
  });

  describe('Key Management', () => {
    it('should test key rotation mechanism', async () => {
      const testCase = framework['testCases'].get('key_rotation_mechanism');
      expect(testCase).toBeDefined();

      if (testCase) {
        const result = await testCase.testFunction();
        expect(result.testId).toBe('key_rotation_mechanism');
        expect(result.details.algorithm).toBe('aes-256-gcm');
        expect(result.details.keyLength).toBe(256);
      }
    }, 10000);

    it('should validate key derivation functions', async () => {
      const testCase = framework['testCases'].get('key_derivation_validation');
      expect(testCase).toBeDefined();

      if (testCase) {
        const result = await testCase.testFunction();
        expect(result.testId).toBe('key_derivation_validation');
        expect(result.details.algorithm).toBe('PBKDF2-SHA256');
        expect(result.details.performance).toBeDefined();
      }
    }, 5000);
  });

  describe('Algorithm Compliance', () => {
    it('should check FIPS compliance', async () => {
      const testCase = framework['testCases'].get('approved_algorithms');
      expect(testCase).toBeDefined();

      if (testCase) {
        const result = await testCase.testFunction();
        expect(result.testId).toBe('approved_algorithms');
        expect(result.evidence.length).toBeGreaterThan(0);
      }
    }, 5000);

    it('should validate entropy quality', async () => {
      const testCase = framework['testCases'].get('entropy_quality');
      expect(testCase).toBeDefined();

      if (testCase) {
        const result = await testCase.testFunction();
        expect(result.testId).toBe('entropy_quality');
        expect(result.details.performance).toBeDefined();
        expect(typeof result.score).toBe('number');
      }
    }, 10000);
  });

  describe('Full Validation Run', () => {
    it('should run all validation tests', async () => {
      const report = await framework.runValidation('test');
      
      expect(report.id).toContain('encryption_validation_');
      expect(report.environment).toBe('test');
      expect(report.testResults.length).toBeGreaterThan(0);
      expect(typeof report.overallScore).toBe('number');
      expect(report.overallScore).toBeGreaterThanOrEqual(0);
      expect(report.overallScore).toBeLessThanOrEqual(100);
      
      expect(report.summary.totalTests).toBeGreaterThan(0);
      expect(report.summary.totalTests).toBe(report.testResults.length);
      expect(report.summary.passedTests + report.summary.failedTests).toBe(report.summary.totalTests);
      
      expect(Array.isArray(report.recommendations)).toBe(true);
      expect(Array.isArray(report.nextActions)).toBe(true);
      expect(typeof report.summary.complianceStatus).toBe('object');
    }, 30000);

    it('should emit events during validation', async () => {
      const testCompletedEvents: any[] = [];
      const validationCompletedEvents: any[] = [];

      framework.on('test:completed', (event) => {
        testCompletedEvents.push(event);
      });

      framework.on('validation:completed', (event) => {
        validationCompletedEvents.push(event);
      });

      await framework.runValidation('test');

      expect(testCompletedEvents.length).toBeGreaterThan(0);
      expect(validationCompletedEvents.length).toBe(1);
    }, 30000);
  });

  describe('Report Export', () => {
    let sampleReport: any;

    beforeEach(async () => {
      sampleReport = await framework.runValidation('test');
    });

    it('should export JSON report', () => {
      const jsonReport = framework.exportReport(sampleReport, 'json');
      expect(() => JSON.parse(jsonReport)).not.toThrow();
      
      const parsed = JSON.parse(jsonReport);
      expect(parsed.id).toBe(sampleReport.id);
      expect(parsed.environment).toBe(sampleReport.environment);
    });

    it('should export HTML report', () => {
      const htmlReport = framework.exportReport(sampleReport, 'html');
      expect(htmlReport).toContain('<!DOCTYPE html>');
      expect(htmlReport).toContain('Encryption Validation Report');
      expect(htmlReport).toContain(sampleReport.environment);
    });

    it('should export CSV report', () => {
      const csvReport = framework.exportReport(sampleReport, 'csv');
      const lines = csvReport.split('\n');
      
      expect(lines[0]).toContain('Test ID');
      expect(lines[0]).toContain('Status');
      expect(lines[0]).toContain('Score');
      expect(lines.length).toBeGreaterThan(1);
    });
  });

  describe('Vulnerability Detection', () => {
    it('should detect weak algorithms', async () => {
      // Set weak algorithm in environment
      const originalAlgorithm = process.env['ENCRYPTION_ALGORITHM'];
      process.env['ENCRYPTION_ALGORITHM'] = 'des';

      try {
        const report = await framework.runValidation('test');
        const fipsTest = report.testResults.find((r: any) => r.testId === 'approved_algorithms');
        
        expect(fipsTest).toBeDefined();
        if (fipsTest) {
          expect(fipsTest.vulnerabilities.length).toBeGreaterThan(0);
          expect(fipsTest.vulnerabilities.some((v: any) => v.type === 'weak_algorithm')).toBe(true);
        }
      } finally {
        // Restore original value
        if (originalAlgorithm) {
          process.env['ENCRYPTION_ALGORITHM'] = originalAlgorithm;
        } else {
          delete process.env['ENCRYPTION_ALGORITHM'];
        }
      }
    }, 10000);

    it('should detect weak TLS configuration', async () => {
      // Set weak TLS version
      const originalTLS = process.env['TLS_MIN_VERSION'];
      process.env['TLS_MIN_VERSION'] = '1.0';

      try {
        const report = await framework.runValidation('test');
        const tlsTest = report.testResults.find(r => r.testId === 'tls_configuration');
        
        expect(tlsTest).toBeDefined();
        if (tlsTest) {
          expect(tlsTest.vulnerabilities.length).toBeGreaterThan(0);
          expect(tlsTest.vulnerabilities.some(v => v.severity === 'critical')).toBe(true);
        }
      } finally {
        // Restore original value
        if (originalTLS) {
          process.env.TLS_MIN_VERSION = originalTLS;
        } else {
          delete process.env.TLS_MIN_VERSION;
        }
      }
    }, 10000);
  });

  describe('Performance Metrics', () => {
    it('should measure encryption performance', async () => {
      const testCase = framework['testCases'].get('data_at_rest_aes_256');
      expect(testCase).toBeDefined();

      if (testCase) {
        const result = await testCase.testFunction();
        expect(result.details.performance).toBeDefined();
        expect(typeof result.details.performance?.encryptionTime).toBe('number');
        expect(typeof result.details.performance?.decryptionTime).toBe('number');
        expect(typeof result.details.performance?.throughput).toBe('number');
      }
    }, 10000);

    it('should measure key derivation performance', async () => {
      const testCase = framework['testCases'].get('key_derivation_validation');
      expect(testCase).toBeDefined();

      if (testCase) {
        const result = await testCase.testFunction();
        expect(result.details.performance).toBeDefined();
        expect(result.details.performance?.encryptionTime).toBeGreaterThan(0);
      }
    }, 10000);
  });

  describe('Compliance Checking', () => {
    it('should check multiple compliance standards', async () => {
      const report = await framework.runValidation('test');
      
      expect(report.summary.complianceStatus).toBeDefined();
      expect(typeof report.summary.complianceStatus['FIPS 140-2']).toBe('boolean');
      expect(typeof report.summary.complianceStatus['PCI-DSS']).toBe('boolean');
      expect(typeof report.summary.complianceStatus['SOC2']).toBe('boolean');
    }, 30000);

    it('should provide compliance-specific recommendations', async () => {
      const report = await framework.runValidation('test');
      
      // Should have recommendations if not fully compliant
      const nonCompliantStandards = Object.entries(report.summary.complianceStatus)
        .filter(([_, compliant]) => !compliant);
      
      if (nonCompliantStandards.length > 0) {
        expect(report.recommendations.length).toBeGreaterThan(0);
      }
    }, 30000);
  });

  describe('Error Handling', () => {
    it('should handle test case failures gracefully', async () => {
      // Mock a failing test case
      const originalTestCase = framework['testCases'].get('data_at_rest_aes_256');
      const failingTestCase = {
        ...originalTestCase!,
        testFunction: async () => {
          throw new Error('Simulated test failure');
        }
      };
      
      framework['testCases'].set('data_at_rest_aes_256', failingTestCase);

      const report = await framework.runValidation('test');
      const failedResult = report.testResults.find(r => r.testId === 'data_at_rest_aes_256');
      
      expect(failedResult).toBeDefined();
      expect(failedResult?.passed).toBe(false);
      expect(failedResult?.score).toBe(0);
      expect(failedResult?.vulnerabilities.length).toBeGreaterThan(0);
    }, 30000);

    it('should continue validation even if some tests fail', async () => {
      // Mock multiple failing test cases
      const testIds = Array.from(framework['testCases'].keys()).slice(0, 2);
      const originalTestCases = new Map();
      
      for (const testId of testIds) {
        originalTestCases.set(testId, framework['testCases'].get(testId));
        const failingTestCase = {
          ...framework['testCases'].get(testId)!,
          testFunction: async () => {
            throw new Error('Simulated failure');
          }
        };
        framework['testCases'].set(testId, failingTestCase);
      }

      const report = await framework.runValidation('test');
      
      // Should still have results for all tests
      expect(report.testResults.length).toBe(framework['testCases'].size);
      
      // Some should be failures
      const failedResults = report.testResults.filter(r => !r.passed);
      expect(failedResults.length).toBeGreaterThanOrEqual(2);
      
      // Restore original test cases
      for (const [testId, testCase] of originalTestCases) {
        framework['testCases'].set(testId, testCase);
      }
    }, 30000);
  });
});

describe('Integration with Environment Variables', () => {
  let framework: EncryptionValidationFramework;

  beforeEach(() => {
    framework = new EncryptionValidationFramework();
  });

  afterEach(() => {
    framework.removeAllListeners();
  });

  it('should respect TLS configuration from environment', async () => {
    const originalTLS = process.env.TLS_MIN_VERSION;
    const originalCiphers = process.env.TLS_CIPHER_SUITES;
    
    process.env.TLS_MIN_VERSION = '1.3';
    process.env.TLS_CIPHER_SUITES = 'TLS_AES_256_GCM_SHA384,TLS_CHACHA20_POLY1305_SHA256';

    try {
      const report = await framework.runValidation('test');
      const tlsTest = report.testResults.find(r => r.testId === 'tls_configuration');
      
      expect(tlsTest).toBeDefined();
      expect(tlsTest?.passed).toBe(true);
      expect(tlsTest?.score).toBeGreaterThan(80);
    } finally {
      if (originalTLS) process.env.TLS_MIN_VERSION = originalTLS;
      else delete process.env.TLS_MIN_VERSION;
      
      if (originalCiphers) process.env.TLS_CIPHER_SUITES = originalCiphers;
      else delete process.env.TLS_CIPHER_SUITES;
    }
  }, 10000);

  it('should respect database encryption settings', async () => {
    const originalEncryption = process.env.DATABASE_ENCRYPTION;
    const originalAlgorithm = process.env.DATABASE_ENCRYPTION_ALGORITHM;
    
    process.env.DATABASE_ENCRYPTION = 'true';
    process.env.DATABASE_ENCRYPTION_ALGORITHM = 'aes-256';

    try {
      const report = await framework.runValidation('test');
      const dbTest = report.testResults.find(r => r.testId === 'database_encryption_tde');
      
      expect(dbTest).toBeDefined();
      expect(dbTest?.passed).toBe(true);
      expect(dbTest?.score).toBe(100);
    } finally {
      if (originalEncryption) process.env.DATABASE_ENCRYPTION = originalEncryption;
      else delete process.env.DATABASE_ENCRYPTION;
      
      if (originalAlgorithm) process.env.DATABASE_ENCRYPTION_ALGORITHM = originalAlgorithm;
      else delete process.env.DATABASE_ENCRYPTION_ALGORITHM;
    }
  }, 10000);
});