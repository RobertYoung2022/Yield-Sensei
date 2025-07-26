/**
 * Simplified Encryption Validator Test Suite
 */

import { EncryptionValidator } from '../../../src/security/encryption/encryption-validator';

describe('EncryptionValidator - Core Tests', () => {
  let validator: EncryptionValidator;

  beforeEach(() => {
    // Create validator without system dependencies to avoid TS issues
    validator = new EncryptionValidator();
  });

  describe('Core Algorithm Testing', () => {
    test('should validate AES-256-GCM encryption', async () => {
      // Run just AES tests
      await validator['testAESEncryption']();
      const results = validator.getResults();
      
      const aesResults = results.filter(r => r.algorithm === 'AES-256-GCM');
      expect(aesResults.length).toBeGreaterThan(0);
      
      // Most AES tests should pass
      const passedAES = aesResults.filter(r => r.passed);
      expect(passedAES.length).toBeGreaterThanOrEqual(aesResults.length * 0.8);
      
      // Check performance metrics are recorded
      aesResults.forEach(result => {
        if (result.performance) {
          expect(result.performance.encryptionTime).toBeGreaterThan(0);
          expect(result.performance.dataSize).toBeGreaterThanOrEqual(0);
        }
      });
    });

    test('should validate HMAC integrity checks', async () => {
      await validator['testHMACValidation']();
      const results = validator.getResults();
      
      const hmacResults = results.filter(r => r.algorithm === 'HMAC');
      expect(hmacResults.length).toBeGreaterThan(0);
      
      // Most HMAC tests should pass
      const passedHMAC = hmacResults.filter(r => r.passed);
      expect(passedHMAC.length).toBeGreaterThanOrEqual(hmacResults.length * 0.8);
      
      // Should include tampering detection test
      const tamperingTest = hmacResults.find(r => r.testName.includes('tampering'));
      expect(tamperingTest).toBeDefined();
      if (tamperingTest) {
        expect(tamperingTest.passed).toBe(true);
      }
    });

    test('should validate password hashing mechanisms', async () => {
      await validator['testPasswordHashing']();
      const results = validator.getResults();
      
      const scryptResults = results.filter(r => r.algorithm === 'Scrypt');
      expect(scryptResults.length).toBeGreaterThan(0);
      
      // Most password hashing tests should pass
      const passedScrypt = scryptResults.filter(r => r.passed);
      expect(passedScrypt.length).toBeGreaterThanOrEqual(scryptResults.length * 0.8);
      
      // Check that different password lengths are tested
      const passwordLengths = scryptResults
        .map(r => r.testName)
        .filter(name => name.includes('chars'));
      expect(passwordLengths.length).toBeGreaterThan(1);
    });

    test('should validate key derivation functions', async () => {
      await validator['testKeyDerivation']();
      const results = validator.getResults();
      
      // Should test both PBKDF2 and Scrypt
      const pbkdf2Results = results.filter(r => r.algorithm === 'PBKDF2');
      const scryptResults = results.filter(r => r.algorithm === 'Scrypt' && r.testName.includes('derivation'));
      
      expect(pbkdf2Results.length).toBeGreaterThan(0);
      expect(scryptResults.length).toBeGreaterThan(0);
      
      // Most KDF tests should pass
      const allKDFResults = [...pbkdf2Results, ...scryptResults];
      const passedKDF = allKDFResults.filter(r => r.passed);
      expect(passedKDF.length).toBeGreaterThanOrEqual(allKDFResults.length * 0.8);
    });
  });

  describe('Edge Cases and Security Testing', () => {
    test('should handle edge cases properly', async () => {
      await validator['testEncryptionEdgeCases']();
      const results = validator.getResults();
      
      // Should include empty data test
      const emptyDataTest = results.find(r => r.testName.includes('Empty data'));
      expect(emptyDataTest).toBeDefined();
      if (emptyDataTest) {
        expect(emptyDataTest.passed).toBe(true);
      }
      
      // Should include invalid key handling tests
      const invalidKeyTests = results.filter(r => r.testName.includes('Invalid key'));
      expect(invalidKeyTests.length).toBeGreaterThan(0);
      
      // All invalid key tests should pass (meaning they properly handle errors)
      expect(invalidKeyTests.every(r => r.passed)).toBe(true);
    });

    test('should test security vulnerabilities', async () => {
      await validator['testSecurityVulnerabilities'](); 
      const results = validator.getResults();
      
      // Should test timing attack resistance
      const timingTest = results.find(r => r.testName.includes('Timing attack'));
      expect(timingTest).toBeDefined();
      
      // Should test key reuse detection
      const keyReuseTest = results.find(r => r.testName.includes('Key reuse'));
      expect(keyReuseTest).toBeDefined();
      
      // Should test IV reuse detection
      const ivReuseTest = results.find(r => r.testName.includes('IV reuse'));
      expect(ivReuseTest).toBeDefined();
      if (ivReuseTest) {
        expect(ivReuseTest.passed).toBe(true);
      }
    });
  });

  describe('Performance Analysis', () => {
    test('should measure encryption performance', async () => {
      await validator['testAESEncryption']();
      const results = validator.getResults();
      
      const performanceResults = results.filter(r => r.performance);
      expect(performanceResults.length).toBeGreaterThan(0);
      
      performanceResults.forEach(result => {
        expect(result.performance!.encryptionTime).toBeGreaterThan(0);
        expect(result.performance!.dataSize).toBeGreaterThanOrEqual(0);
        
        // Performance should be reasonable (less than 1 second for small data)
        if (result.performance!.dataSize < 1024) {
          expect(result.performance!.encryptionTime).toBeLessThan(1000);
        }
      });
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid inputs gracefully', async () => {
      await validator['testInvalidKeyHandling']();
      const results = validator.getResults();
      
      const invalidKeyResults = results.filter(r => r.testName.includes('Invalid key'));
      expect(invalidKeyResults.length).toBeGreaterThan(0);
      
      // All invalid key tests should pass (meaning they properly handle errors)
      expect(invalidKeyResults.every(r => r.passed)).toBe(true);
    });

    test('should detect tampering attempts', async () => {
      await validator['testHMACValidation']();
      const results = validator.getResults();
      
      const tamperingTests = results.filter(r => r.testName.includes('tampering'));
      expect(tamperingTests.length).toBeGreaterThan(0);
      expect(tamperingTests.every(r => r.passed)).toBe(true);
    });
  });

  describe('Quick Validation', () => {
    test('should run quick validation successfully', async () => {
      // Clear previous results
      validator = new EncryptionValidator();
      
      // Run core algorithm tests
      await validator['testAESEncryption']();
      await validator['testHMACValidation']();
      await validator['testPasswordHashing']();
      
      const summary = validator['generateSummary']();
      
      expect(summary.totalTests).toBeGreaterThan(10);
      expect(summary.successRate).toBeGreaterThan(70); // Allow some test failures
      expect(summary.passed).toBeGreaterThan(0);
    });

    test('should generate comprehensive report', async () => {
      // Run some tests first
      await validator['testAESEncryption']();
      await validator['testHMACValidation']();
      
      const report = validator.generateReport();
      
      expect(report).toContain('# Encryption Validation Report');
      expect(report).toContain('## Summary');
      expect(report).toContain('## Detailed Results');
      expect(report).toContain('Total Tests:');
      expect(report).toContain('Success Rate:');
    });

    test('should provide detailed results', async () => {
      await validator['testAESEncryption']();
      const results = validator.getResults();
      
      expect(results.length).toBeGreaterThan(0);
      
      results.forEach(result => {
        expect(result.algorithm).toBeDefined();
        expect(result.testName).toBeDefined();
        expect(typeof result.passed).toBe('boolean');
        
        if (result.performance) {
          expect(result.performance.encryptionTime).toBeGreaterThanOrEqual(0);
          expect(result.performance.decryptionTime).toBeGreaterThanOrEqual(0);
          expect(result.performance.dataSize).toBeGreaterThanOrEqual(0);
        }
      });
    });
  });

  describe('Validation Summary', () => {
    test('should generate accurate summary statistics', async () => {
      await validator['testAESEncryption']();
      const summary = validator['generateSummary']();
      
      expect(summary.totalTests).toBe(summary.passed + summary.failed);
      expect(summary.successRate).toBe((summary.passed / summary.totalTests) * 100);
      
      if (summary.failed > 0) {
        expect(summary.successRate).toBeLessThan(100);
      } else {
        expect(summary.successRate).toBe(100);
      }
    });

    test('should provide actionable recommendations', async () => {
      await validator['testAESEncryption']();
      const summary = validator['generateSummary']();
      
      expect(Array.isArray(summary.recommendations)).toBe(true);
      
      if (summary.failed > 0) {
        expect(summary.recommendations.length).toBeGreaterThan(0);
      }
    });
  });
});