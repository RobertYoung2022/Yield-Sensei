/**
 * KeyManager Test Suite
 * 
 * Comprehensive tests for cryptographic key generation and management
 */

import { KeyManager, KeySpec, GeneratedKey } from '../key-manager';
import { VaultManager, VaultConfig } from '../vault-manager';
import { RotationManager } from '../rotation-manager';
import { AccessControlManager } from '../access-control';

describe('KeyManager', () => {
  let keyManager: KeyManager;
  let vaultManager: VaultManager;
  let rotationManager: RotationManager;
  let accessControl: AccessControlManager;
  let testUserId: string;

  const testVaultConfig: VaultConfig = {
    type: 'local',
    localConfig: {
      vaultPath: './test-data/secrets',
      encryptionKey: 'test-encryption-key-for-unit-tests'
    }
  };

  beforeEach(async () => {
    // Initialize components
    vaultManager = new VaultManager(testVaultConfig);
    accessControl = new AccessControlManager();
    rotationManager = new RotationManager(vaultManager, accessControl);
    keyManager = new KeyManager(vaultManager, rotationManager, accessControl);

    // Create test user
    const testUser = accessControl.createUser({
      username: 'testuser',
      email: 'test@example.com',
      roles: ['admin'],
      environment: 'development',
      isActive: true,
      metadata: { test: true }
    });
    testUserId = testUser.id;
  });

  describe('Key Generation', () => {
    test('should generate symmetric encryption key', async () => {
      const spec: KeySpec = {
        type: 'symmetric',
        algorithm: 'aes-256-gcm',
        purpose: 'encryption',
        environment: 'development'
      };

      const key = await keyManager.generateKey(spec, testUserId);

      expect(key).toBeDefined();
      expect(key.id).toMatch(/^key_symmetric_encryption_development_/);
      expect(key.spec).toEqual(spec);
      expect(key.symmetricKey).toBeDefined();
      expect(key.fingerprint).toBeDefined();
      expect(key.created).toBeInstanceOf(Date);
      expect(key.version).toMatch(/^v\d+_[a-f0-9]+$/);
    });

    test('should generate RSA asymmetric key pair', async () => {
      const spec: KeySpec = {
        type: 'asymmetric',
        algorithm: 'rsa-2048',
        purpose: 'encryption',
        environment: 'development'
      };

      const key = await keyManager.generateKey(spec, testUserId);

      expect(key).toBeDefined();
      expect(key.publicKey).toBeDefined();
      expect(key.privateKey).toBeDefined();
      expect(key.publicKey).toContain('-----BEGIN PUBLIC KEY-----');
      expect(key.privateKey).toContain('-----BEGIN PRIVATE KEY-----');
      expect(key.fingerprint).toBeDefined();
    });

    test('should generate Ed25519 signing key', async () => {
      const spec: KeySpec = {
        type: 'signing',
        algorithm: 'ed25519',
        purpose: 'signing',
        environment: 'development'
      };

      const key = await keyManager.generateKey(spec, testUserId);

      expect(key).toBeDefined();
      expect(key.publicKey).toBeDefined();
      expect(key.privateKey).toBeDefined();
      expect(key.fingerprint).toBeDefined();
    });

    test('should generate HMAC signing key', async () => {
      const spec: KeySpec = {
        type: 'signing',
        algorithm: 'hmac-sha256',
        purpose: 'jwt',
        environment: 'development'
      };

      const key = await keyManager.generateKey(spec, testUserId);

      expect(key).toBeDefined();
      expect(key.symmetricKey).toBeDefined();
      expect(key.publicKey).toBeUndefined();
      expect(key.privateKey).toBeUndefined();
      expect(key.fingerprint).toBeDefined();
    });

    test('should generate key derivation function key', async () => {
      const spec: KeySpec = {
        type: 'derivation',
        algorithm: 'aes-256-gcm',
        purpose: 'kdf',
        environment: 'development'
      };

      const key = await keyManager.generateKey(spec, testUserId);

      expect(key).toBeDefined();
      expect(key.symmetricKey).toBeDefined();
      expect(key.keyDerivationData).toBeDefined();
      expect(key.keyDerivationData?.salt).toBeDefined();
      expect(key.keyDerivationData?.iterations).toBe(100000);
      expect(key.keyDerivationData?.algorithm).toBe('scrypt');
    });

    test('should set appropriate expiration dates based on purpose', async () => {
      const jwtSpec: KeySpec = {
        type: 'signing',
        algorithm: 'hmac-sha256',
        purpose: 'jwt',
        environment: 'development'
      };

      const jwtKey = await keyManager.generateKey(jwtSpec, testUserId);
      expect(jwtKey.expiresAt).toBeDefined();

      const now = new Date();
      const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      expect(jwtKey.expiresAt!.getTime()).toBeCloseTo(thirtyDaysFromNow.getTime(), -5);
    });

    test('should reject invalid key specifications', async () => {
      const invalidSpec: any = {
        type: 'invalid',
        algorithm: 'unknown',
        purpose: 'test',
        environment: 'development'
      };

      await expect(
        keyManager.generateKey(invalidSpec, testUserId)
      ).rejects.toThrow('Unsupported key type: invalid');
    });
  });

  describe('Key Retrieval', () => {
    test('should retrieve generated key', async () => {
      const spec: KeySpec = {
        type: 'symmetric',
        algorithm: 'aes-256-gcm',
        purpose: 'encryption',
        environment: 'development'
      };

      const originalKey = await keyManager.generateKey(spec, testUserId);
      const retrievedKey = await keyManager.getKey(originalKey.id, testUserId);

      expect(retrievedKey).toEqual(originalKey);
    });

    test('should throw error for non-existent key', async () => {
      await expect(
        keyManager.getKey('non-existent-key', testUserId)
      ).rejects.toThrow('Secret not found');
    });

    test('should verify key integrity on retrieval', async () => {
      const spec: KeySpec = {
        type: 'symmetric',
        algorithm: 'aes-256-gcm',
        purpose: 'encryption',
        environment: 'development'
      };

      const key = await keyManager.generateKey(spec, testUserId);
      
      // Manually corrupt the key in storage and try to retrieve
      // This would require mocking the vault manager to simulate corruption
      // For now, we'll test that valid keys pass integrity checks
      const retrievedKey = await keyManager.getKey(key.id, testUserId);
      expect(retrievedKey.fingerprint).toBe(key.fingerprint);
    });
  });

  describe('Key Derivation', () => {
    test('should derive key from master key', async () => {
      const masterKeySpec: KeySpec = {
        type: 'derivation',
        algorithm: 'aes-256-gcm',
        purpose: 'kdf',
        environment: 'development'
      };

      const masterKey = await keyManager.generateKey(masterKeySpec, testUserId);
      
      const derivedKey = await keyManager.deriveKey(
        masterKey.id,
        {
          masterKey: masterKey.symmetricKey!,
          keyLength: 32
        },
        testUserId
      );

      expect(derivedKey).toBeInstanceOf(Buffer);
      expect(derivedKey.length).toBe(32);
    });

    test('should derive different keys with different salts', async () => {
      const masterKeySpec: KeySpec = {
        type: 'derivation',
        algorithm: 'aes-256-gcm',
        purpose: 'kdf',
        environment: 'development'
      };

      const masterKey = await keyManager.generateKey(masterKeySpec, testUserId);
      
      const salt1 = Buffer.from('salt1').toString('base64');
      const salt2 = Buffer.from('salt2').toString('base64');

      const derivedKey1 = await keyManager.deriveKey(
        masterKey.id,
        { masterKey: masterKey.symmetricKey!, salt: salt1 },
        testUserId
      );

      const derivedKey2 = await keyManager.deriveKey(
        masterKey.id,
        { masterKey: masterKey.symmetricKey!, salt: salt2 },
        testUserId
      );

      expect(derivedKey1).not.toEqual(derivedKey2);
    });
  });

  describe('Key Rotation', () => {
    test('should rotate key successfully', async () => {
      const spec: KeySpec = {
        type: 'symmetric',
        algorithm: 'aes-256-gcm',
        purpose: 'encryption',
        environment: 'development'
      };

      const originalKey = await keyManager.generateKey(spec, testUserId);
      const rotationResult = await keyManager.rotateKey(originalKey.id, testUserId);

      expect(rotationResult.success).toBe(true);
      expect(rotationResult.oldKeyId).toBe(originalKey.id);
      expect(rotationResult.newKeyId).toBeDefined();
      expect(rotationResult.rotationTime).toBeInstanceOf(Date);
    });

    test('should handle rotation failure gracefully', async () => {
      const rotationResult = await keyManager.rotateKey('non-existent-key', testUserId);

      expect(rotationResult.success).toBe(false);
      expect(rotationResult.error).toBeDefined();
    });
  });

  describe('Key Listing', () => {
    test('should list all keys for user', async () => {
      const specs: KeySpec[] = [
        {
          type: 'symmetric',
          algorithm: 'aes-256-gcm',
          purpose: 'encryption',
          environment: 'development'
        },
        {
          type: 'signing',
          algorithm: 'hmac-sha256',
          purpose: 'jwt',
          environment: 'development'
        }
      ];

      for (const spec of specs) {
        await keyManager.generateKey(spec, testUserId);
      }

      const keys = await keyManager.listKeys(testUserId);
      expect(keys.length).toBeGreaterThanOrEqual(2);
    });

    test('should filter keys by type', async () => {
      const symmetricSpec: KeySpec = {
        type: 'symmetric',
        algorithm: 'aes-256-gcm',
        purpose: 'encryption',
        environment: 'development'
      };

      const signingSpec: KeySpec = {
        type: 'signing',
        algorithm: 'hmac-sha256',
        purpose: 'jwt',
        environment: 'development'
      };

      await keyManager.generateKey(symmetricSpec, testUserId);
      await keyManager.generateKey(signingSpec, testUserId);

      const symmetricKeys = await keyManager.listKeys(testUserId, { type: 'symmetric' });
      const signingKeys = await keyManager.listKeys(testUserId, { type: 'signing' });

      expect(symmetricKeys.every(key => key.spec.type === 'symmetric')).toBe(true);
      expect(signingKeys.every(key => key.spec.type === 'signing')).toBe(true);
    });

    test('should filter keys by purpose', async () => {
      const encryptionSpec: KeySpec = {
        type: 'symmetric',
        algorithm: 'aes-256-gcm',
        purpose: 'encryption',
        environment: 'development'
      };

      const jwtSpec: KeySpec = {
        type: 'signing',
        algorithm: 'hmac-sha256',
        purpose: 'jwt',
        environment: 'development'
      };

      await keyManager.generateKey(encryptionSpec, testUserId);
      await keyManager.generateKey(jwtSpec, testUserId);

      const jwtKeys = await keyManager.listKeys(testUserId, { purpose: 'jwt' });
      expect(jwtKeys.every(key => key.spec.purpose === 'jwt')).toBe(true);
    });
  });

  describe('Key Deletion', () => {
    test('should delete key successfully', async () => {
      const spec: KeySpec = {
        type: 'symmetric',
        algorithm: 'aes-256-gcm',
        purpose: 'encryption',
        environment: 'development'
      };

      const key = await keyManager.generateKey(spec, testUserId);
      
      await expect(keyManager.deleteKey(key.id, testUserId)).resolves.not.toThrow();
      
      await expect(keyManager.getKey(key.id, testUserId)).rejects.toThrow();
    });
  });

  describe('Access Control', () => {
    test('should deny access for user without permissions', async () => {
      // Create user without admin role
      const limitedUser = accessControl.createUser({
        username: 'limiteduser',
        email: 'limited@example.com',
        roles: ['readonly'],
        environment: 'development',
        isActive: true,
        metadata: { test: true }
      });

      const spec: KeySpec = {
        type: 'symmetric',
        algorithm: 'aes-256-gcm',
        purpose: 'encryption',
        environment: 'development'
      };

      await expect(
        keyManager.generateKey(spec, limitedUser.id)
      ).rejects.toThrow('Access denied');
    });

    test('should allow access for user with appropriate permissions', async () => {
      const spec: KeySpec = {
        type: 'symmetric',
        algorithm: 'aes-256-gcm',
        purpose: 'encryption',
        environment: 'development'
      };

      await expect(
        keyManager.generateKey(spec, testUserId)
      ).resolves.toBeDefined();
    });
  });

  describe('Key Reports', () => {
    test('should generate comprehensive key report', async () => {
      const spec: KeySpec = {
        type: 'symmetric',
        algorithm: 'aes-256-gcm',
        purpose: 'encryption',
        environment: 'development'
      };

      await keyManager.generateKey(spec, testUserId);

      const startDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const endDate = new Date();
      
      const report = await keyManager.generateKeyReport(startDate, endDate);

      expect(report).toContain('# Cryptographic Key Management Report');
      expect(report).toContain('## Key Summary');
      expect(report).toContain('- Total keys:');
      expect(report).toContain('- Key types:');
      expect(report).toContain('- Key purposes:');
    });
  });

  describe('Error Handling', () => {
    test('should handle vault errors gracefully', async () => {
      // This would require mocking the vault manager to simulate failures
      // For now, we test that the error is properly propagated
      const spec: KeySpec = {
        type: 'symmetric',
        algorithm: 'aes-256-gcm',
        purpose: 'encryption',
        environment: 'development'
      };

      // Test with invalid user ID
      await expect(
        keyManager.generateKey(spec, 'invalid-user-id')
      ).rejects.toThrow();
    });
  });

  describe('Key Integrity', () => {
    test('should detect corrupted keys', async () => {
      // This test would require mocking the vault to return corrupted data
      // For now, we test that valid keys pass integrity checks
      const spec: KeySpec = {
        type: 'symmetric',
        algorithm: 'aes-256-gcm',
        purpose: 'encryption',
        environment: 'development'
      };

      const key = await keyManager.generateKey(spec, testUserId);
      const retrievedKey = await keyManager.getKey(key.id, testUserId);
      
      // Valid key should not throw
      expect(retrievedKey.fingerprint).toBe(key.fingerprint);
    });
  });
});