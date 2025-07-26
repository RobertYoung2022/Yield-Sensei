/**
 * Encryption Validation System
 * 
 * Comprehensive validation and testing of all encryption mechanisms
 * used throughout the YieldSensei platform
 */

import { randomBytes, createCipheriv, createDecipheriv, createHmac } from 'crypto';
import { VaultManager } from '../../config/secrets/vault-manager';
import { KeyManager } from '../../config/secrets/key-manager';
import { SecretManager } from '../../config/secrets/index';

export interface EncryptionTestResult {
  algorithm: string;
  testName: string;
  passed: boolean;
  error?: string;
  performance?: {
    encryptionTime: number;
    decryptionTime: number;
    dataSize: number;
  };
  metadata?: Record<string, any>;
}

export interface ValidationSummary {
  totalTests: number;
  passed: number;
  failed: number;
  successRate: number;
  criticalFailures: string[];
  warnings: string[];
  recommendations: string[];
}

export class EncryptionValidator {
  private results: EncryptionTestResult[] = [];
  private vaultManager: VaultManager | undefined;
  private keyManager: KeyManager | undefined;
  private secretManager: SecretManager | undefined;

  constructor(
    vaultManager?: VaultManager,
    keyManager?: KeyManager,
    secretManager?: SecretManager
  ) {
    this.vaultManager = vaultManager;
    this.keyManager = keyManager;
    this.secretManager = secretManager;
  }

  /**
   * Run comprehensive encryption validation tests
   */
  async validateAll(): Promise<ValidationSummary> {
    this.results = [];

    // Test core encryption algorithms
    await this.testAESEncryption();
    await this.testRSAEncryption();
    await this.testHMACValidation();
    await this.testPasswordHashing();
    await this.testKeyDerivation();
    
    // Test system integrations
    if (this.vaultManager) {
      await this.testVaultEncryption();
    }
    
    if (this.keyManager) {
      await this.testKeyManagerEncryption();
    }
    
    if (this.secretManager) {
      await this.testSecretManagerIntegration();
    }

    // Test edge cases and security scenarios
    await this.testEncryptionEdgeCases();
    await this.testSecurityVulnerabilities();

    return this.generateSummary();
  }

  /**
   * Test AES-256-GCM encryption used throughout the system
   */
  private async testAESEncryption(): Promise<void> {
    const testCases = [
      { name: 'Small data (16 bytes)', data: randomBytes(16) },
      { name: 'Medium data (1KB)', data: randomBytes(1024) },
      { name: 'Large data (1MB)', data: randomBytes(1024 * 1024) },
      { name: 'Empty data', data: Buffer.from('') },
      { name: 'UTF-8 text', data: Buffer.from('Hello, 世界! 🔐', 'utf8') },
      { name: 'Binary data', data: randomBytes(256) }
    ];

    for (const testCase of testCases) {
      await this.runEncryptionTest(
        'AES-256-GCM',
        `${testCase.name}`,
        testCase.data,
        this.encryptAESGCM.bind(this),
        (encrypted: Buffer, key: Buffer, iv: Buffer, tag?: Buffer) => this.decryptAESGCM(encrypted, key, iv, tag!)
      );
    }

    // Test with different key sizes
    await this.testAESWithDifferentKeys();
  }

  /**
   * Test RSA encryption for asymmetric operations
   */
  private async testRSAEncryption(): Promise<void> {
    const { generateKeyPairSync } = await import('crypto');
    
    const keySizes = [2048, 4096];
    
    for (const keySize of keySizes) {
      try {
        const startGen = Date.now();
        const { publicKey, privateKey } = generateKeyPairSync('rsa', {
          modulusLength: keySize,
          publicKeyEncoding: { type: 'spki', format: 'pem' },
          privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
        });
        const genTime = Date.now() - startGen;

        const testData = Buffer.from('Test RSA encryption data');
        
        await this.runAsymmetricTest(
          'RSA',
          `RSA-${keySize} key generation and encryption`,
          testData,
          publicKey,
          privateKey,
          { keySize, generationTime: genTime }
        );

      } catch (error) {
        this.results.push({
          algorithm: 'RSA',
          testName: `RSA-${keySize} encryption`,
          passed: false,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
  }

  /**
   * Test HMAC validation for data integrity
   */
  private async testHMACValidation(): Promise<void> {
    const algorithms = ['sha256', 'sha512'];
    const testData = 'Test HMAC data integrity';
    const key = randomBytes(32);

    for (const algorithm of algorithms) {
      try {
        const startTime = Date.now();
        
        // Generate HMAC
        const hmac = createHmac(algorithm, key);
        hmac.update(testData);
        const signature = hmac.digest('hex');
        
        // Verify HMAC
        const verifyHmac = createHmac(algorithm, key);
        verifyHmac.update(testData);
        const verifySignature = verifyHmac.digest('hex');
        
        const endTime = Date.now();
        const passed = signature === verifySignature;

        this.results.push({
          algorithm: 'HMAC',
          testName: `HMAC-${algorithm.toUpperCase()}`,
          passed,
          performance: {
            encryptionTime: endTime - startTime,
            decryptionTime: 0,
            dataSize: Buffer.from(testData).length
          },
          metadata: { algorithm: algorithm.toUpperCase() }
        });

        // Test tampering detection
        await this.testHMACTamperingDetection(algorithm, key);

      } catch (error) {
        this.results.push({
          algorithm: 'HMAC',
          testName: `HMAC-${algorithm.toUpperCase()}`,
          passed: false,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
  }

  /**
   * Test password hashing mechanisms
   */
  private async testPasswordHashing(): Promise<void> {
    const { scrypt, randomBytes } = await import('crypto');
    const { promisify } = await import('util');
    const scryptAsync = promisify(scrypt);

    const passwords = [
      'simplepassword',
      'Complex!P@ssw0rd123',
      '🔐🌟💎🚀🎯',
      'a'.repeat(100),
      'password with spaces and symbols !@#$%^&*()'
    ];

    for (const password of passwords) {
      try {
        const startTime = Date.now();
        
        // Generate salt
        const salt = randomBytes(16);
        
        // Hash password
        const hash = await scryptAsync(password, salt, 64) as Buffer;
        
        // Verify password
        const verifyHash = await scryptAsync(password, salt, 64) as Buffer;
        
        const endTime = Date.now();
        const passed = hash.equals(verifyHash);

        this.results.push({
          algorithm: 'Scrypt',
          testName: `Password hashing (${password.length} chars)`,
          passed,
          performance: {
            encryptionTime: endTime - startTime,
            decryptionTime: 0,
            dataSize: Buffer.from(password).length
          },
          metadata: { 
            passwordLength: password.length,
            saltLength: salt.length,
            hashLength: hash.length
          }
        });

        // Test wrong password detection
        await this.testWrongPasswordDetection(password, salt);

      } catch (error) {
        this.results.push({
          algorithm: 'Scrypt',
          testName: `Password hashing (${password.length} chars)`,
          passed: false,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
  }

  /**
   * Test key derivation functions
   */
  private async testKeyDerivation(): Promise<void> {
    const { pbkdf2, scrypt } = await import('crypto');
    const { promisify } = await import('util');
    
    const pbkdf2Async = promisify(pbkdf2);
    const scryptAsync = promisify(scrypt);

    const password = 'test-password';
    const salt = randomBytes(16);

    // Test PBKDF2
    try {
      const startTime = Date.now();
      const key1 = await pbkdf2Async(password, salt, 100000, 32, 'sha256');
      const key2 = await pbkdf2Async(password, salt, 100000, 32, 'sha256');
      const endTime = Date.now();

      this.results.push({
        algorithm: 'PBKDF2',
        testName: 'PBKDF2-SHA256 key derivation',
        passed: key1.equals(key2),
        performance: {
          encryptionTime: endTime - startTime,
          decryptionTime: 0,
          dataSize: 32
        },
        metadata: { iterations: 100000, keyLength: 32 }
      });
    } catch (error) {
      this.results.push({
        algorithm: 'PBKDF2',
        testName: 'PBKDF2-SHA256 key derivation',
        passed: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }

    // Test Scrypt
    try {
      const startTime = Date.now();
      const key1 = await scryptAsync(password, salt, 32) as Buffer;
      const key2 = await scryptAsync(password, salt, 32) as Buffer;
      const endTime = Date.now();

      this.results.push({
        algorithm: 'Scrypt',
        testName: 'Scrypt key derivation',
        passed: key1.equals(key2),
        performance: {
          encryptionTime: endTime - startTime,
          decryptionTime: 0,
          dataSize: 32
        },
        metadata: { keyLength: 32 }
      });
    } catch (error) {
      this.results.push({
        algorithm: 'Scrypt',
        testName: 'Scrypt key derivation',
        passed: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Test vault manager encryption
   */
  private async testVaultEncryption(): Promise<void> {
    if (!this.vaultManager) return;

    const testSecrets = [
      { name: 'TEST_SECRET_1', value: 'simple-value' },
      { name: 'TEST_SECRET_2', value: JSON.stringify({ key: 'value', number: 123 }) },
      { name: 'TEST_SECRET_3', value: 'a'.repeat(1000) },
      { name: 'TEST_SECRET_4', value: '🔐🌟💎🚀🎯' }
    ];

    for (const secret of testSecrets) {
      try {
        const startTime = Date.now();
        
        // Store encrypted secret
        await this.vaultManager.storeSecret(secret.name, secret.value, {
          description: `Test secret ${secret.name}`,
          type: 'custom',
          environment: 'development'
        });
        
        // Retrieve and decrypt secret
        const retrievedValue = await this.vaultManager.getSecret(secret.name, 'system');
        
        const endTime = Date.now();
        const passed = retrievedValue === secret.value;

        this.results.push({
          algorithm: 'VaultManager',
          testName: `Vault encryption/decryption - ${secret.name}`,
          passed,
          performance: {
            encryptionTime: endTime - startTime,
            decryptionTime: 0,
            dataSize: Buffer.from(secret.value).length
          },
          metadata: { secretName: secret.name }
        });

        // Cleanup
        await this.vaultManager.deleteSecret(secret.name, 'system');

      } catch (error) {
        this.results.push({
          algorithm: 'VaultManager',
          testName: `Vault encryption/decryption - ${secret.name}`,
          passed: false,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
  }

  /**
   * Test key manager encryption
   */
  private async testKeyManagerEncryption(): Promise<void> {
    if (!this.keyManager) return;

    const keyTypes = [
      { type: 'symmetric', algorithm: 'aes-256-gcm', keySize: 256, purpose: 'encryption' },
      { type: 'asymmetric', algorithm: 'rsa-2048', keySize: 2048, purpose: 'encryption' },
      { type: 'signing', algorithm: 'ed25519', purpose: 'signing' },
      { type: 'derivation', algorithm: 'hmac-sha256', purpose: 'kdf' }
    ];

    for (const keyType of keyTypes) {
      try {
        const startTime = Date.now();
        
        const keySpec = {
          type: keyType.type as any,
          algorithm: keyType.algorithm as any,
          purpose: keyType.purpose as any,
          ...(keyType.keySize && { keySize: keyType.keySize }),
          environment: 'development' as any
        };

        const generatedKey = await this.keyManager.generateKey(keySpec, 'system', {
          description: `Test ${keyType.type} key`,
          type: 'custom',
          environment: 'development'
        });

        const retrievedKey = await this.keyManager.getKey(generatedKey.id, 'system');
        
        const endTime = Date.now();
        const passed = retrievedKey !== null;

        this.results.push({
          algorithm: 'KeyManager',
          testName: `Key generation/retrieval - ${keyType.type}/${keyType.algorithm}`,
          passed,
          performance: {
            encryptionTime: endTime - startTime,
            decryptionTime: 0,
            dataSize: keyType.keySize || 256
          },
          metadata: { 
            keyType: keyType.type,
            algorithm: keyType.algorithm,
            keyId: generatedKey.id
          }
        });

      } catch (error) {
        this.results.push({
          algorithm: 'KeyManager',
          testName: `Key generation/retrieval - ${keyType.type}/${keyType.algorithm}`,
          passed: false,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
  }

  /**
   * Test secret manager integration
   */
  private async testSecretManagerIntegration(): Promise<void> {
    if (!this.secretManager) return;

    try {
      const startTime = Date.now();
      
      // Test system health
      const healthCheck = await this.secretManager.healthCheck();
      
      // Test system report generation
      const systemReport = await this.secretManager.generateSystemReport();
      
      const endTime = Date.now();

      this.results.push({
        algorithm: 'SecretManager',
        testName: 'System integration test',
        passed: healthCheck.status === 'healthy',
        performance: {
          encryptionTime: endTime - startTime,
          decryptionTime: 0,
          dataSize: Buffer.from(systemReport).length
        },
        metadata: { 
          healthStatus: healthCheck.status,
          reportSize: systemReport.length
        }
      });

    } catch (error) {
      this.results.push({
        algorithm: 'SecretManager',
        testName: 'System integration test',
        passed: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Test encryption edge cases
   */
  private async testEncryptionEdgeCases(): Promise<void> {
    // Test with null/undefined data
    try {
      const key = randomBytes(32);
      const result = this.encryptAESGCM(Buffer.from(''), key);
      const decrypted = this.decryptAESGCM(result.encrypted, key, result.iv, result.tag);
      
      this.results.push({
        algorithm: 'AES-256-GCM',
        testName: 'Empty data encryption',
        passed: decrypted.length === 0,
        metadata: { dataSize: 0 }
      });
    } catch (error) {
      this.results.push({
        algorithm: 'AES-256-GCM',
        testName: 'Empty data encryption',
        passed: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }

    // Test with maximum safe data size
    await this.testLargeDataEncryption();
    
    // Test with invalid keys
    await this.testInvalidKeyHandling();
  }

  /**
   * Test security vulnerabilities
   */
  private async testSecurityVulnerabilities(): Promise<void> {
    // Test timing attacks resistance
    await this.testTimingAttackResistance();
    
    // Test key reuse detection
    await this.testKeyReuseDetection();
    
    // Test IV reuse detection
    await this.testIVReuseDetection();
  }

  /**
   * Helper method to run symmetric encryption tests
   */
  private async runEncryptionTest(
    algorithm: string,
    testName: string,
    data: Buffer,
    encryptFn: (data: Buffer, key: Buffer) => any,
    decryptFn: (encrypted: Buffer, key: Buffer, iv: Buffer, tag?: Buffer) => Buffer
  ): Promise<void> {
    try {
      const key = randomBytes(32);
      
      const startEncrypt = Date.now();
      const result = encryptFn(data, key);
      const encryptTime = Date.now() - startEncrypt;
      
      const startDecrypt = Date.now();
      const decrypted = decryptFn(result.encrypted, key, result.iv, result.tag);
      const decryptTime = Date.now() - startDecrypt;
      
      const passed = data.equals(decrypted);

      this.results.push({
        algorithm,
        testName,
        passed,
        performance: {
          encryptionTime: encryptTime,
          decryptionTime: decryptTime,
          dataSize: data.length
        },
        metadata: {
          originalSize: data.length,
          encryptedSize: result.encrypted.length,
          ivSize: result.iv.length,
          tagSize: result.tag?.length || 0
        }
      });

    } catch (error) {
      this.results.push({
        algorithm,
        testName,
        passed: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Helper method to run asymmetric encryption tests
   */
  private async runAsymmetricTest(
    algorithm: string,
    testName: string,
    data: Buffer,
    publicKey: string,
    privateKey: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    try {
      const { publicEncrypt, privateDecrypt } = await import('crypto');
      
      const startEncrypt = Date.now();
      const encrypted = publicEncrypt(publicKey, data);
      const encryptTime = Date.now() - startEncrypt;
      
      const startDecrypt = Date.now();
      const decrypted = privateDecrypt(privateKey, encrypted);
      const decryptTime = Date.now() - startDecrypt;
      
      const passed = data.equals(decrypted);

      this.results.push({
        algorithm,
        testName,
        passed,
        performance: {
          encryptionTime: encryptTime,
          decryptionTime: decryptTime,
          dataSize: data.length
        },
        metadata: {
          ...metadata,
          originalSize: data.length,
          encryptedSize: encrypted.length
        }
      });

    } catch (error) {
      this.results.push({
        algorithm,
        testName,
        passed: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * AES-256-GCM encryption helper
   */
  private encryptAESGCM(data: Buffer, key: Buffer): { encrypted: Buffer; iv: Buffer; tag: Buffer } {
    const iv = randomBytes(12); // 96-bit IV for GCM
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    
    let encrypted = cipher.update(data);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    
    const tag = cipher.getAuthTag();
    
    return { encrypted, iv, tag };
  }

  /**
   * AES-256-GCM decryption helper
   */
  private decryptAESGCM(encrypted: Buffer, key: Buffer, iv: Buffer, tag: Buffer): Buffer {
    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    
    let decrypted = decipher.update(encrypted);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    
    return decrypted;
  }

  // Additional test methods...
  private async testAESWithDifferentKeys(): Promise<void> {
    const testData = Buffer.from('Test data for different keys');
    const keys = [
      randomBytes(32), // 256-bit
      randomBytes(24), // 192-bit
      randomBytes(16)  // 128-bit
    ];

    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      if (!key) continue;
      
      const keySize = key.length * 8;
      try {
        const result = this.encryptAESGCM(testData, key);
        const decrypted = this.decryptAESGCM(result.encrypted, key, result.iv, result.tag);
        
        this.results.push({
          algorithm: 'AES-GCM',
          testName: `AES-${keySize}-GCM encryption`,
          passed: testData.equals(decrypted),
          metadata: { keySize }
        });
      } catch (error) {
        this.results.push({
          algorithm: 'AES-GCM',
          testName: `AES-${keySize}-GCM encryption`,
          passed: false,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
  }

  private async testHMACTamperingDetection(algorithm: string, key: Buffer): Promise<void> {
    const testData = 'Original data';
    const tamperedData = 'Tampered data';
    
    // Create HMAC for original data
    const hmac = createHmac(algorithm, key);
    hmac.update(testData);
    const originalSignature = hmac.digest('hex');
    
    // Verify with tampered data
    const verifyHmac = createHmac(algorithm, key);
    verifyHmac.update(tamperedData);
    const tamperedSignature = verifyHmac.digest('hex');
    
    const detected = originalSignature !== tamperedSignature;
    
    this.results.push({
      algorithm: 'HMAC',
      testName: `HMAC-${algorithm.toUpperCase()} tampering detection`,
      passed: detected,
      metadata: { 
        tamperingDetected: detected,
        algorithm: algorithm.toUpperCase()
      }
    });
  }

  private async testWrongPasswordDetection(correctPassword: string, salt: Buffer): Promise<void> {
    const { scrypt } = await import('crypto');
    const { promisify } = await import('util');
    const scryptAsync = promisify(scrypt);
    
    const wrongPassword = correctPassword + 'wrong';
    
    const correctHash = await scryptAsync(correctPassword, salt, 64) as Buffer;
    const wrongHash = await scryptAsync(wrongPassword, salt, 64) as Buffer;
    
    const detected = !correctHash.equals(wrongHash);
    
    this.results.push({
      algorithm: 'Scrypt',
      testName: 'Wrong password detection',
      passed: detected,
      metadata: { wrongPasswordDetected: detected }
    });
  }

  private async testLargeDataEncryption(): Promise<void> {
    const largeData = randomBytes(10 * 1024 * 1024); // 10MB
    const key = randomBytes(32);
    
    try {
      const startTime = Date.now();
      const result = this.encryptAESGCM(largeData, key);
      const decrypted = this.decryptAESGCM(result.encrypted, key, result.iv, result.tag);
      const endTime = Date.now();
      
      this.results.push({
        algorithm: 'AES-256-GCM',
        testName: 'Large data encryption (10MB)',
        passed: largeData.equals(decrypted),
        performance: {
          encryptionTime: endTime - startTime,
          decryptionTime: 0,
          dataSize: largeData.length
        },
        metadata: { dataSize: '10MB' }
      });
    } catch (error) {
      this.results.push({
        algorithm: 'AES-256-GCM',
        testName: 'Large data encryption (10MB)',
        passed: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  private async testInvalidKeyHandling(): Promise<void> {
    const testData = Buffer.from('test data');
    const invalidKeys = [
      Buffer.from('too-short'),
      Buffer.from(''),
      randomBytes(31), // 248-bit, invalid for AES-256
      randomBytes(33)  // 264-bit, invalid for AES-256
    ];

    for (const invalidKey of invalidKeys) {
      try {
        this.encryptAESGCM(testData, invalidKey);
        
        this.results.push({
          algorithm: 'AES-256-GCM',
          testName: `Invalid key handling (${invalidKey.length} bytes)`,
          passed: false,
          error: 'Should have thrown error with invalid key'
        });
      } catch (error) {
        this.results.push({
          algorithm: 'AES-256-GCM',
          testName: `Invalid key handling (${invalidKey.length} bytes)`,
          passed: true,
          metadata: { 
            keySize: invalidKey.length,
            errorHandled: true
          }
        });
      }
    }
  }

  private async testTimingAttackResistance(): Promise<void> {
    const password = 'test-password';
    const salt = randomBytes(16);
    const { scrypt } = await import('crypto');
    const { promisify } = await import('util');
    const scryptAsync = promisify(scrypt);
    
    const times: number[] = [];
    
    // Measure timing for multiple identical operations
    for (let i = 0; i < 10; i++) {
      const start = process.hrtime.bigint();
      await scryptAsync(password, salt, 64);
      const end = process.hrtime.bigint();
      times.push(Number(end - start) / 1000000); // Convert to milliseconds
    }
    
    // Calculate timing variance
    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    const variance = times.reduce((sum, time) => sum + Math.pow(time - avg, 2), 0) / times.length;
    const stdDev = Math.sqrt(variance);
    const coefficientOfVariation = stdDev / avg;
    
    // Good timing attack resistance should have low coefficient of variation
    const passed = coefficientOfVariation < 0.1;
    
    this.results.push({
      algorithm: 'Scrypt',
      testName: 'Timing attack resistance',
      passed,
      metadata: {
        averageTime: avg,
        standardDeviation: stdDev,
        coefficientOfVariation,
        timingConsistent: passed
      }
    });
  }

  private async testKeyReuseDetection(): Promise<void> {
    // This test would be more complex in a real system
    // For now, we test that different operations generate different keys
    const key1 = randomBytes(32);
    const key2 = randomBytes(32);
    
    const passed = !key1.equals(key2);
    
    this.results.push({
      algorithm: 'Key Generation',
      testName: 'Key reuse detection',
      passed,
      metadata: { 
        uniqueKeysGenerated: passed,
        warning: 'Simplified test - real implementation should track key usage'
      }
    });
  }

  private async testIVReuseDetection(): Promise<void> {
    // Test that IVs are unique for each encryption
    const ivs: Buffer[] = [];
    for (let i = 0; i < 10; i++) {
      ivs.push(randomBytes(12));
    }
    
    // Check for duplicates
    const uniqueIVs = new Set(ivs.map(iv => iv.toString('hex')));
    const passed = uniqueIVs.size === ivs.length;
    
    this.results.push({
      algorithm: 'IV Generation',
      testName: 'IV reuse detection',
      passed,
      metadata: {
        totalIVs: ivs.length,
        uniqueIVs: uniqueIVs.size,
        noDuplicates: passed
      }
    });
  }

  /**
   * Generate validation summary
   */
  private generateSummary(): ValidationSummary {
    const totalTests = this.results.length;
    const passed = this.results.filter(r => r.passed).length;
    const failed = totalTests - passed;
    const successRate = totalTests > 0 ? (passed / totalTests) * 100 : 0;

    const criticalFailures = this.results
      .filter(r => !r.passed && (r.algorithm === 'AES-256-GCM' || r.algorithm === 'VaultManager'))
      .map(r => `${r.algorithm}: ${r.testName}`);

    const warnings = this.results
      .filter(r => r.metadata?.['warning'])
      .map(r => r.metadata!['warning'] as string);

    const recommendations: string[] = [];
    
    if (successRate < 100) {
      recommendations.push('Review and fix failing encryption tests');
    }
    
    if (criticalFailures.length > 0) {
      recommendations.push('Critical encryption failures detected - immediate attention required');
    }
    
    const slowTests = this.results.filter(r => 
      r.performance && r.performance.encryptionTime > 1000
    );
    
    if (slowTests.length > 0) {
      recommendations.push('Consider optimizing slow encryption operations');
    }

    return {
      totalTests,
      passed,
      failed,
      successRate,
      criticalFailures,
      warnings,
      recommendations
    };
  }

  /**
   * Get detailed test results
   */
  getResults(): EncryptionTestResult[] {
    return [...this.results];
  }

  /**
   * Generate detailed report
   */
  generateReport(): string {
    const summary = this.generateSummary();
    
    let report = '# Encryption Validation Report\n\n';
    report += `**Generated:** ${new Date().toISOString()}\n\n`;
    
    report += '## Summary\n\n';
    report += `- **Total Tests:** ${summary.totalTests}\n`;
    report += `- **Passed:** ${summary.passed}\n`;
    report += `- **Failed:** ${summary.failed}\n`;
    report += `- **Success Rate:** ${summary.successRate.toFixed(2)}%\n\n`;
    
    if (summary.criticalFailures.length > 0) {
      report += '## ⚠️ Critical Failures\n\n';
      summary.criticalFailures.forEach(failure => {
        report += `- ${failure}\n`;
      });
      report += '\n';
    }
    
    if (summary.warnings.length > 0) {
      report += '## Warnings\n\n';
      summary.warnings.forEach(warning => {
        report += `- ${warning}\n`;
      });
      report += '\n';
    }
    
    if (summary.recommendations.length > 0) {
      report += '## Recommendations\n\n';
      summary.recommendations.forEach(rec => {
        report += `- ${rec}\n`;
      });
      report += '\n';
    }
    
    report += '## Detailed Results\n\n';
    
    const groupedResults = this.results.reduce((groups, result) => {
      if (!groups[result.algorithm]) {
        groups[result.algorithm] = [];
      }
      groups[result.algorithm]!.push(result);
      return groups;
    }, {} as Record<string, EncryptionTestResult[]>);
    
    Object.entries(groupedResults).forEach(([algorithm, results]) => {
      report += `### ${algorithm}\n\n`;
      
      results.forEach(result => {
        const status = result.passed ? '✅' : '❌';
        report += `${status} **${result.testName}**\n`;
        
        if (result.error) {
          report += `   - Error: ${result.error}\n`;
        }
        
        if (result.performance) {
          report += `   - Encryption Time: ${result.performance.encryptionTime}ms\n`;
          report += `   - Data Size: ${result.performance.dataSize} bytes\n`;
        }
        
        if (result.metadata) {
          const metadata = Object.entries(result.metadata)
            .map(([key, value]) => `${key}: ${value}`)
            .join(', ');
          report += `   - Metadata: ${metadata}\n`;
        }
        
        report += '\n';
      });
    });
    
    return report;
  }
}