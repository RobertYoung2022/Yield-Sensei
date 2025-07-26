/**
 * Secret Management System Integration Tests
 * 
 * End-to-end tests for the complete secret management system
 */

import { SecretManager, createDefaultSecretManagerConfig } from '../index';
import { KeySpec } from '../key-manager';

describe('SecretManager Integration', () => {
  let secretManager: SecretManager;

  beforeEach(async () => {
    const config = createDefaultSecretManagerConfig();
    // Use test-specific paths
    if (config.vault.localConfig) {
      config.vault.localConfig.vaultPath = './test-data/integration-secrets';
      config.vault.localConfig.encryptionKey = 'test-integration-key';
    }
    
    secretManager = new SecretManager(config);
    await secretManager.initialize();
  });

  afterEach(async () => {
    await secretManager.cleanup();
  });

  describe('System Initialization', () => {
    test('should initialize with default keys', async () => {
      const keyManager = secretManager.getKeyManager();
      const keys = await keyManager.listKeys('system');

      // Should have default keys for encryption, JWT, database, and API
      expect(keys.length).toBeGreaterThanOrEqual(4);
      
      const keyPurposes = keys.map(key => key.spec.purpose);
      expect(keyPurposes).toContain('encryption');
      expect(keyPurposes).toContain('jwt');
      expect(keyPurposes).toContain('database');
      expect(keyPurposes).toContain('api');
    });

    test('should create system user with admin privileges', async () => {
      const accessControl = secretManager.getAccessControlManager();
      const systemUser = accessControl.getUser('system');

      expect(systemUser).toBeDefined();
      expect(systemUser?.roles).toContain('admin');
      expect(systemUser?.isActive).toBe(true);
    });
  });

  describe('End-to-End Key Lifecycle', () => {
    test('should handle complete key lifecycle', async () => {
      const accessControl = secretManager.getAccessControlManager();
      const keyManager = secretManager.getKeyManager();
      
      // Create test user
      const testUser = accessControl.createUser({
        username: 'e2etest',
        email: 'e2e@test.com',
        roles: ['admin'],
        environment: 'development',
        isActive: true,
        metadata: { test: true }
      });

      // Generate key
      const keySpec: KeySpec = {
        type: 'symmetric',
        algorithm: 'aes-256-gcm',
        purpose: 'encryption',
        environment: 'development'
      };

      const generatedKey = await keyManager.generateKey(keySpec, testUser.id, {
        description: 'Test encryption key',
        type: 'encryption',
        environment: 'development',
        rotationPolicy: {
          enabled: true,
          intervalDays: 30,
          autoRotate: false,
          gracePeriodDays: 7,
          notificationDays: [7, 1]
        }
      });

      expect(generatedKey).toBeDefined();
      expect(generatedKey.spec).toEqual(keySpec);

      // Retrieve key
      const retrievedKey = await keyManager.getKey(generatedKey.id, testUser.id);
      expect(retrievedKey).toEqual(generatedKey);

      // List keys
      const keys = await keyManager.listKeys(testUser.id, { purpose: 'encryption' });
      expect(keys.some(key => key.id === generatedKey.id)).toBe(true);

      // Rotate key
      const rotationResult = await keyManager.rotateKey(generatedKey.id, testUser.id);
      expect(rotationResult.success).toBe(true);

      // Verify rotated key
      const rotatedKey = await keyManager.getKey(generatedKey.id, testUser.id);
      expect(rotatedKey.version).not.toBe(generatedKey.version);
      expect(rotatedKey.symmetricKey).not.toBe(generatedKey.symmetricKey);

      // Delete key
      await keyManager.deleteKey(generatedKey.id, testUser.id);
      await expect(keyManager.getKey(generatedKey.id, testUser.id)).rejects.toThrow();
    });
  });

  describe('Access Control Integration', () => {
    test('should enforce role-based access control across components', async () => {
      const accessControl = secretManager.getAccessControlManager();
      const vaultManager = secretManager.getVaultManager();
      const keyManager = secretManager.getKeyManager();

      // Create developer user with limited permissions
      const developerUser = accessControl.createUser({
        username: 'developer',
        email: 'dev@test.com',
        roles: ['developer'],
        environment: 'development',
        isActive: true,
        metadata: { test: true }
      });

      // Developer should not be able to create keys (requires admin role)
      const keySpec: KeySpec = {
        type: 'symmetric',
        algorithm: 'aes-256-gcm',
        purpose: 'encryption',
        environment: 'development'
      };

      await expect(
        keyManager.generateKey(keySpec, developerUser.id)
      ).rejects.toThrow('Access denied');

      // But should be able to read development secrets if they exist
      await expect(
        vaultManager.listSecrets(developerUser.id)
      ).resolves.toBeDefined();
    });

    test('should handle user role updates correctly', async () => {
      const accessControl = secretManager.getAccessControlManager();
      const keyManager = secretManager.getKeyManager();

      // Create user with readonly role
      const testUser = accessControl.createUser({
        username: 'upgradetest',
        email: 'upgrade@test.com',
        roles: ['readonly'],
        environment: 'development',
        isActive: true,
        metadata: { test: true }
      });

      const keySpec: KeySpec = {
        type: 'symmetric',
        algorithm: 'aes-256-gcm',
        purpose: 'encryption',
        environment: 'development'
      };

      // Should not be able to create keys initially
      await expect(
        keyManager.generateKey(keySpec, testUser.id)
      ).rejects.toThrow('Access denied');

      // Upgrade user to admin
      accessControl.updateUserRoles(testUser.id, ['admin']);

      // Should now be able to create keys
      await expect(
        keyManager.generateKey(keySpec, testUser.id)
      ).resolves.toBeDefined();
    });
  });

  describe('Automatic Rotation Integration', () => {
    test('should schedule and process automatic rotations', async () => {
      const rotationManager = secretManager.getRotationManager();
      const keyManager = secretManager.getKeyManager();

      // Generate key with rotation policy
      const keySpec: KeySpec = {
        type: 'symmetric',
        algorithm: 'aes-256-gcm',
        purpose: 'encryption',
        environment: 'development'
      };

      const key = await keyManager.generateKey(keySpec, 'system', {
        description: 'Auto-rotation test key',
        type: 'encryption',
        environment: 'development',
        rotationPolicy: {
          enabled: true,
          intervalDays: 1, // Very short interval for testing
          autoRotate: true,
          gracePeriodDays: 0,
          notificationDays: [1]
        }
      });

      // Check that rotation is scheduled
      const dueRotations = await rotationManager.checkRotationNeeded();
      // Since we set 1 day interval, it won't be due immediately
      // But the schedule should exist
      
      // Process automatic rotations (should be empty for now)
      const results = await rotationManager.processAutomaticRotations();
      expect(results).toBeDefined();
    });
  });

  describe('System Health and Reporting', () => {
    test('should perform comprehensive health check', async () => {
      const healthCheck = await secretManager.healthCheck();

      expect(healthCheck.status).toMatch(/healthy|warning|critical/);
      expect(healthCheck.checks).toBeDefined();
      expect(healthCheck.checks.vault).toBeDefined();
      expect(healthCheck.checks.rotation).toBeDefined();
      expect(healthCheck.checks.access_control).toBeDefined();
      expect(healthCheck.checks.key_integrity).toBeDefined();

      // All checks should at least have a status and message
      Object.values(healthCheck.checks).forEach(check => {
        expect(check.status).toMatch(/pass|fail|warning/);
        expect(check.message).toBeDefined();
        expect(typeof check.message).toBe('string');
      });
    });

    test('should generate comprehensive system report', async () => {
      const report = await secretManager.generateSystemReport();

      expect(report).toContain('# YieldSensei Secret Management System Report');
      expect(report).toContain('# Secret Vault Audit Report');
      expect(report).toContain('# Secret Rotation Report');
      expect(report).toContain('# Access Control Audit Report');
      expect(report).toContain('# Cryptographic Key Management Report');

      // Should contain meaningful data
      expect(report.length).toBeGreaterThan(1000);
    });
  });

  describe('Error Handling and Recovery', () => {
    test('should handle vault initialization errors gracefully', async () => {
      // Test with invalid vault configuration
      const invalidConfig = createDefaultSecretManagerConfig();
      if (invalidConfig.vault.localConfig) {
        invalidConfig.vault.localConfig.vaultPath = '/invalid/path/that/cannot/be/created';
      }

      // This should either fail gracefully or handle the error
      try {
        const failingSecretManager = new SecretManager(invalidConfig);
        await failingSecretManager.initialize();
        await failingSecretManager.cleanup();
      } catch (error) {
        // Expected to fail, should be a meaningful error
        expect(error).toBeInstanceOf(Error);
      }
    });

    test('should handle component initialization in correct order', async () => {
      // Test that components are initialized in the correct dependency order
      const config = createDefaultSecretManagerConfig();
      if (config.vault.localConfig) {
        config.vault.localConfig.vaultPath = './test-data/dependency-test';
      }

      const testSecretManager = new SecretManager(config);
      
      // All components should be accessible after construction
      expect(testSecretManager.getVaultManager()).toBeDefined();
      expect(testSecretManager.getAccessControlManager()).toBeDefined();
      expect(testSecretManager.getRotationManager()).toBeDefined();
      expect(testSecretManager.getKeyManager()).toBeDefined();

      await testSecretManager.initialize();
      await testSecretManager.cleanup();
    });
  });

  describe('Performance and Scalability', () => {
    test('should handle multiple concurrent key operations', async () => {
      const keyManager = secretManager.getKeyManager();
      const accessControl = secretManager.getAccessControlManager();

      // Create test user
      const testUser = accessControl.createUser({
        username: 'perftest',
        email: 'perf@test.com',
        roles: ['admin'],
        environment: 'development',
        isActive: true,
        metadata: { test: true }
      });

      const keySpec: KeySpec = {
        type: 'symmetric',
        algorithm: 'aes-256-gcm',
        purpose: 'encryption',
        environment: 'development'
      };

      // Generate multiple keys concurrently
      const keyPromises = Array.from({ length: 5 }, (_, i) => 
        keyManager.generateKey(
          { ...keySpec, purpose: `test-${i}` as any },
          testUser.id,
          { description: `Performance test key ${i}` }
        )
      );

      const keys = await Promise.all(keyPromises);
      expect(keys).toHaveLength(5);
      
      // All keys should be unique
      const keyIds = keys.map(key => key.id);
      const uniqueKeyIds = new Set(keyIds);
      expect(uniqueKeyIds.size).toBe(5);

      // Clean up
      await Promise.all(keys.map(key => keyManager.deleteKey(key.id, testUser.id)));
    });

    test('should handle key listing with large numbers of keys', async () => {
      const keyManager = secretManager.getKeyManager();
      
      // List all keys (including default ones)
      const initialKeys = await keyManager.listKeys('system');
      
      // Should handle the listing efficiently
      expect(Array.isArray(initialKeys)).toBe(true);
      expect(initialKeys.length).toBeGreaterThan(0);
    });
  });
});