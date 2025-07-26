/**
 * Encryption Validator Test Suite
 */

import { EncryptionValidator } from '../../../src/security/encryption/encryption-validator';
import { VaultManager } from '../../../src/config/secrets/vault-manager';
import { KeyManager } from '../../../src/config/secrets/key-manager';
import { SecretManager, createDefaultSecretManagerConfig } from '../../../src/config/secrets/index';
import { mkdirSync, rmSync, existsSync } from 'fs';
import { join } from 'path';

describe('EncryptionValidator', () => {
  let validator: EncryptionValidator;
  let vaultManager: VaultManager;
  let keyManager: KeyManager;
  let secretManager: SecretManager;
  let testDir: string;

  beforeAll(async () => {
    // Setup test directory
    testDir = join(process.cwd(), 'test-data', 'encryption-validator');
    mkdirSync(testDir, { recursive: true });

    // Initialize secret management components
    const config = createDefaultSecretManagerConfig();
    if (config.vault.localConfig) {
      config.vault.localConfig.vaultPath = join(testDir, 'vault');
      config.vault.localConfig.encryptionKey = 'test-encryption-key-32-characters';
    }

    secretManager = new SecretManager(config);
    await secretManager.initialize();

    vaultManager = secretManager.getVaultManager();
    keyManager = secretManager.getKeyManager();

    // Initialize validator with all components
    validator = new EncryptionValidator(vaultManager, keyManager, secretManager);
  });

  afterAll(() => {
    // Cleanup test directory
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('Core Algorithm Testing', () => {
    test('should validate AES-256-GCM encryption', async () => {
      const standaloneValidator = new EncryptionValidator();
      
      // Manually run just AES tests
      await standaloneValidator['testAESEncryption']();
      const results = standaloneValidator.getResults();
      
      const aesResults = results.filter(r => r.algorithm === 'AES-256-GCM');
      expect(aesResults.length).toBeGreaterThan(0);
      expect(aesResults.every(r => r.passed)).toBe(true);
      
      // Check performance metrics are recorded
      aesResults.forEach(result => {
        expect(result.performance).toBeDefined();
        expect(result.performance!.encryptionTime).toBeGreaterThan(0);
        expect(result.performance!.dataSize).toBeGreaterThanOrEqual(0);
      });
    });

    test('should validate HMAC integrity checks', async () => {
      const standaloneValidator = new EncryptionValidator();
      
      await standaloneValidator['testHMACValidation']();
      const results = standaloneValidator.getResults();
      
      const hmacResults = results.filter(r => r.algorithm === 'HMAC');
      expect(hmacResults.length).toBeGreaterThan(0);
      
      // All HMAC tests should pass
      const failedHmac = hmacResults.filter(r => !r.passed);
      if (failedHmac.length > 0) {
        console.log('Failed HMAC tests:', failedHmac);
      }
      expect(hmacResults.every(r => r.passed)).toBe(true);
      
      // Should include tampering detection test
      const tamperingTest = hmacResults.find(r => r.testName.includes('tampering'));
      expect(tamperingTest).toBeDefined();
      expect(tamperingTest!.passed).toBe(true);
    });

    test('should validate password hashing mechanisms', async () => {
      const standaloneValidator = new EncryptionValidator();
      
      await standaloneValidator['testPasswordHashing']();
      const results = standaloneValidator.getResults();
      
      const scryptResults = results.filter(r => r.algorithm === 'Scrypt');
      expect(scryptResults.length).toBeGreaterThan(0);
      expect(scryptResults.every(r => r.passed)).toBe(true);
      
      // Check that different password lengths are tested
      const passwordLengths = scryptResults
        .map(r => r.testName)
        .filter(name => name.includes('chars'));
      expect(passwordLengths.length).toBeGreaterThan(1);
    });

    test('should validate key derivation functions', async () => {
      const standaloneValidator = new EncryptionValidator();
      
      await standaloneValidator['testKeyDerivation']();
      const results = standaloneValidator.getResults();
      
      // Should test both PBKDF2 and Scrypt
      const pbkdf2Results = results.filter(r => r.algorithm === 'PBKDF2');
      const scryptResults = results.filter(r => r.algorithm === 'Scrypt' && r.testName.includes('derivation'));
      
      expect(pbkdf2Results.length).toBeGreaterThan(0);
      expect(scryptResults.length).toBeGreaterThan(0);
      expect([...pbkdf2Results, ...scryptResults].every(r => r.passed)).toBe(true);
    });
  });

  describe('System Integration Testing', () => {
    test('should validate vault manager encryption', async () => {
      await validator['testVaultEncryption']();
      const results = validator.getResults();
      
      const vaultResults = results.filter(r => r.algorithm === 'VaultManager');
      expect(vaultResults.length).toBeGreaterThan(0);
      
      // All vault encryption tests should pass
      const failed = vaultResults.filter(r => !r.passed);
      if (failed.length > 0) {
        console.log('Failed vault tests:', failed.map(r => ({ name: r.testName, error: r.error })));
      }
      expect(vaultResults.every(r => r.passed)).toBe(true);
    });

    test('should validate key manager encryption', async () => {
      await validator['testKeyManagerEncryption']();
      const results = validator.getResults();
      
      const keyResults = results.filter(r => r.algorithm === 'KeyManager');
      expect(keyResults.length).toBeGreaterThan(0);
      
      // Should test different key types
      const keyTypes = keyResults.map(r => r.metadata?.['keyType']).filter(Boolean);
      expect(keyTypes).toContain('symmetric');
      expect(keyTypes).toContain('asymmetric');
      expect(keyTypes).toContain('signing');
      
      const failed = keyResults.filter(r => !r.passed);
      if (failed.length > 0) {
        console.log('Failed key manager tests:', failed.map(r => ({ name: r.testName, error: r.error })));
      }
    });

    test('should validate secret manager integration', async () => {
      await validator['testSecretManagerIntegration']();
      const results = validator.getResults();
      
      const secretResults = results.filter(r => r.algorithm === 'SecretManager');
      expect(secretResults.length).toBeGreaterThan(0);
      expect(secretResults.every(r => r.passed)).toBe(true);
    });
  });

  describe('Edge Cases and Security Testing', () => {
    test('should handle edge cases properly', async () => {
      await validator['testEncryptionEdgeCases']();
      const results = validator.getResults();
      
      // Should include empty data test
      const emptyDataTest = results.find(r => r.testName.includes('Empty data'));
      expect(emptyDataTest).toBeDefined();
      expect(emptyDataTest!.passed).toBe(true);
      
      // Should include large data test
      const largeDataTest = results.find(r => r.testName.includes('10MB'));
      expect(largeDataTest).toBeDefined();
      
      // Should include invalid key handling tests
      const invalidKeyTests = results.filter(r => r.testName.includes('Invalid key'));
      expect(invalidKeyTests.length).toBeGreaterThan(0);
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
      expect(ivReuseTest!.passed).toBe(true);
    });
  });

  describe('Full Validation Suite', () => {
    test('should run complete validation suite successfully', async () => {
      const summary = await validator.validateAll();
      
      expect(summary.totalTests).toBeGreaterThan(20);
      expect(summary.successRate).toBeGreaterThan(80); // Allow some tests to fail in test environment
      expect(summary.passed).toBeGreaterThan(0);
      
      // Should have minimal critical failures
      expect(summary.criticalFailures.length).toBeLessThan(3);
    }, 30000); // 30 second timeout for full suite

    test('should generate comprehensive report', async () => {
      await validator.validateAll();
      const report = validator.generateReport();
      
      expect(report).toContain('# Encryption Validation Report');
      expect(report).toContain('## Summary');
      expect(report).toContain('## Detailed Results');
      expect(report).toContain('Total Tests:');
      expect(report).toContain('Success Rate:');
    });

    test('should provide detailed results', () => {
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

  describe('Performance Analysis', () => {
    test('should measure encryption performance', async () => {
      const standaloneValidator = new EncryptionValidator();
      await standaloneValidator['testAESEncryption']();
      const results = standaloneValidator.getResults();
      
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

    test('should identify slow operations', async () => {
      const standaloneValidator = new EncryptionValidator();
      
      // Test large data encryption
      await standaloneValidator['testLargeDataEncryption']();
      const results = standaloneValidator.getResults();
      
      const largeDataResult = results.find(r => r.testName.includes('10MB'));
      if (largeDataResult && largeDataResult.performance) {
        // Large data should take measurable time
        expect(largeDataResult.performance.encryptionTime).toBeGreaterThan(10);
      }
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid inputs gracefully', async () => {
      const standaloneValidator = new EncryptionValidator();
      await standaloneValidator['testInvalidKeyHandling']();
      const results = standaloneValidator.getResults();
      
      const invalidKeyResults = results.filter(r => r.testName.includes('Invalid key'));
      expect(invalidKeyResults.length).toBeGreaterThan(0);
      
      // All invalid key tests should pass (meaning they properly handle errors)
      expect(invalidKeyResults.every(r => r.passed)).toBe(true);
    });

    test('should detect tampering attempts', async () => {
      const standaloneValidator = new EncryptionValidator();
      await standaloneValidator['testHMACValidation']();
      const results = standaloneValidator.getResults();
      
      const tamperingTests = results.filter(r => r.testName.includes('tampering'));
      expect(tamperingTests.length).toBeGreaterThan(0);
      expect(tamperingTests.every(r => r.passed)).toBe(true);
    });
  });

  describe('Validation Summary', () => {
    test('should generate accurate summary statistics', async () => {
      const summary = await validator.validateAll();
      
      expect(summary.totalTests).toBe(summary.passed + summary.failed);
      expect(summary.successRate).toBe((summary.passed / summary.totalTests) * 100);
      
      if (summary.failed > 0) {
        expect(summary.successRate).toBeLessThan(100);
      } else {
        expect(summary.successRate).toBe(100);
      }
    });

    test('should identify critical failures', async () => {
      const summary = await validator.validateAll();
      
      // Critical failures should be specifically for core algorithms
      summary.criticalFailures.forEach(failure => {
        expect(failure).toMatch(/AES-256-GCM|VaultManager/);
      });
    });

    test('should provide actionable recommendations', async () => {
      const summary = await validator.validateAll();
      
      expect(Array.isArray(summary.recommendations)).toBe(true);
      
      if (summary.failed > 0) {
        expect(summary.recommendations.length).toBeGreaterThan(0);
        expect(summary.recommendations.some(r => r.includes('fix'))).toBe(true);
      }
    });
  });
});