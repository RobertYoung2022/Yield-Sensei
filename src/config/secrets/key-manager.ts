/**
 * Cryptographic Key Generation and Management
 * 
 * Provides secure key generation, derivation, and management for all cryptographic
 * operations in the YieldSensei platform. Integrates with VaultManager for storage
 * and RotationManager for automatic key rotation.
 */

import { randomBytes, scryptSync, createHmac, generateKeyPair, createCipheriv, createDecipheriv } from 'crypto';
import { VaultManager, SecretMetadata, RotationPolicy } from './vault-manager';
import { RotationManager } from './rotation-manager';
import { AccessControlManager } from './access-control';

export interface KeySpec {
  type: 'symmetric' | 'asymmetric' | 'signing' | 'derivation';
  algorithm: 'aes-256-gcm' | 'rsa-2048' | 'rsa-4096' | 'ed25519' | 'secp256k1' | 'hmac-sha256';
  purpose: 'encryption' | 'signing' | 'kdf' | 'authentication' | 'jwt' | 'database' | 'api';
  keySize?: number;
  environment: 'development' | 'staging' | 'production' | 'all';
}

export interface GeneratedKey {
  id: string;
  spec: KeySpec;
  publicKey?: string;
  privateKey?: string;
  symmetricKey?: string;
  keyDerivationData?: {
    salt: string;
    iterations: number;
    algorithm: string;
  };
  fingerprint: string;
  created: Date;
  expiresAt?: Date;
  version: string;
}

export interface KeyPair {
  publicKey: string;
  privateKey: string;
  fingerprint: string;
}

export interface KeyDerivationOptions {
  masterKey: string;
  salt?: string;
  iterations?: number;
  keyLength?: number;
  info?: string;
}

export interface KeyRotationResult {
  oldKeyId: string;
  newKeyId: string;
  rotationTime: Date;
  success: boolean;
  error?: string;
}

export class KeyManager {
  private vaultManager: VaultManager;
  private rotationManager: RotationManager;
  private accessControl: AccessControlManager;
  private masterKeyCache: Map<string, Buffer> = new Map();

  constructor(
    vaultManager: VaultManager,
    rotationManager: RotationManager,
    accessControl: AccessControlManager
  ) {
    this.vaultManager = vaultManager;
    this.rotationManager = rotationManager;
    this.accessControl = accessControl;
  }

  /**
   * Generate a new cryptographic key based on specifications
   */
  async generateKey(spec: KeySpec, userId: string, metadata?: Partial<SecretMetadata>): Promise<GeneratedKey> {
    // Check permissions
    const permission = this.accessControl.checkPermission(userId, 'secret', 'create');
    if (!permission.granted) {
      throw new Error(`Access denied: ${permission.reason}`);
    }

    const keyId = this.generateKeyId(spec);
    const version = this.generateVersion();
    
    let generatedKey: GeneratedKey;

    switch (spec.type) {
      case 'symmetric':
        generatedKey = await this.generateSymmetricKey(keyId, spec, version);
        break;
      case 'asymmetric':
        generatedKey = await this.generateAsymmetricKey(keyId, spec, version);
        break;
      case 'signing':
        generatedKey = await this.generateSigningKey(keyId, spec, version);
        break;
      case 'derivation':
        generatedKey = await this.generateDerivationKey(keyId, spec, version);
        break;
      default:
        throw new Error(`Unsupported key type: ${spec.type}`);
    }

    // Store the key in the vault
    await this.storeKey(generatedKey, userId, metadata);

    // Schedule automatic rotation if enabled
    if (metadata?.rotationPolicy?.enabled) {
      await this.rotationManager.scheduleRotation(
        keyId,
        metadata.rotationPolicy,
        userId
      );
    }

    console.log(`🔑 Generated ${spec.type} key: ${keyId} for ${spec.purpose}`);
    return generatedKey;
  }

  /**
   * Generate symmetric encryption key
   */
  private async generateSymmetricKey(keyId: string, spec: KeySpec, version: string): Promise<GeneratedKey> {
    const keySize = spec.keySize || this.getDefaultKeySize(spec.algorithm);
    const symmetricKey = randomBytes(keySize / 8).toString('base64');
    const fingerprint = this.generateFingerprint(symmetricKey);

    return {
      id: keyId,
      spec,
      symmetricKey,
      fingerprint,
      created: new Date(),
      version,
      expiresAt: this.calculateExpiration(spec)
    };
  }

  /**
   * Generate asymmetric key pair
   */
  private async generateAsymmetricKey(keyId: string, spec: KeySpec, version: string): Promise<GeneratedKey> {
    let keyPair: KeyPair;

    switch (spec.algorithm) {
      case 'rsa-2048':
      case 'rsa-4096':
        keyPair = await this.generateRSAKeyPair(spec.algorithm);
        break;
      case 'ed25519':
        keyPair = await this.generateEd25519KeyPair();
        break;
      case 'secp256k1':
        keyPair = await this.generateSecp256k1KeyPair();
        break;
      default:
        throw new Error(`Unsupported asymmetric algorithm: ${spec.algorithm}`);
    }

    return {
      id: keyId,
      spec,
      publicKey: keyPair.publicKey,
      privateKey: keyPair.privateKey,
      fingerprint: keyPair.fingerprint,
      created: new Date(),
      version,
      expiresAt: this.calculateExpiration(spec)
    };
  }

  /**
   * Generate signing key
   */
  private async generateSigningKey(keyId: string, spec: KeySpec, version: string): Promise<GeneratedKey> {
    if (spec.algorithm === 'hmac-sha256') {
      // Generate HMAC signing key
      const signingKey = randomBytes(32).toString('base64');
      const fingerprint = this.generateFingerprint(signingKey);

      return {
        id: keyId,
        spec,
        symmetricKey: signingKey,
        fingerprint,
        created: new Date(),
        version,
        expiresAt: this.calculateExpiration(spec)
      };
    } else {
      // Generate asymmetric signing key
      return this.generateAsymmetricKey(keyId, spec, version);
    }
  }

  /**
   * Generate key derivation function key
   */
  private async generateDerivationKey(keyId: string, spec: KeySpec, version: string): Promise<GeneratedKey> {
    const masterKey = randomBytes(32).toString('base64');
    const salt = randomBytes(16).toString('base64');
    const iterations = 100000;
    const fingerprint = this.generateFingerprint(masterKey + salt);

    return {
      id: keyId,
      spec,
      symmetricKey: masterKey,
      keyDerivationData: {
        salt,
        iterations,
        algorithm: 'scrypt'
      },
      fingerprint,
      created: new Date(),
      version,
      expiresAt: this.calculateExpiration(spec)
    };
  }

  /**
   * Derive key from master key using KDF
   */
  async deriveKey(
    masterKeyId: string,
    options: KeyDerivationOptions,
    userId: string
  ): Promise<Buffer> {
    // Check permissions
    const permission = this.accessControl.checkPermission(userId, 'secret', 'read');
    if (!permission.granted) {
      throw new Error(`Access denied: ${permission.reason}`);
    }

    const masterKey = await this.getKey(masterKeyId, userId);
    if (!masterKey.symmetricKey) {
      throw new Error('Master key must be a symmetric key');
    }

    const salt = options.salt ? Buffer.from(options.salt, 'base64') : randomBytes(16);
    const iterations = options.iterations || 100000;
    const keyLength = options.keyLength || 32;

    const derivedKey = scryptSync(
      Buffer.from(masterKey.symmetricKey, 'base64'),
      salt,
      keyLength,
      { N: iterations }
    );

    return derivedKey;
  }

  /**
   * Retrieve a key from the vault
   */
  async getKey(keyId: string, userId: string): Promise<GeneratedKey> {
    // Check permissions
    const permission = this.accessControl.checkPermission(userId, 'secret', 'read');
    if (!permission.granted) {
      throw new Error(`Access denied: ${permission.reason}`);
    }

    const secretValue = await this.vaultManager.getSecret(keyId, userId);
    const key: GeneratedKey = JSON.parse(secretValue);

    // Verify key integrity
    this.verifyKeyIntegrity(key);

    return key;
  }

  /**
   * Rotate a cryptographic key
   */
  async rotateKey(keyId: string, userId: string): Promise<KeyRotationResult> {
    try {
      // Get the current key
      const currentKey = await this.getKey(keyId, userId);
      
      // Generate new key with same specifications
      const newKey = await this.generateKey(currentKey.spec, userId, {
        type: currentKey.spec.purpose as any,
        environment: currentKey.spec.environment,
        rotationPolicy: {
          enabled: true,
          intervalDays: 90,
          autoRotate: true,
          gracePeriodDays: 7,
          notificationDays: [30, 7, 1]
        }
      });

      // Update the key in the vault
      const keyData = JSON.stringify(newKey);
      await this.rotationManager.rotateSecret(keyId, keyData, userId);

      console.log(`🔄 Key rotated: ${keyId}`);
      
      return {
        oldKeyId: keyId,
        newKeyId: newKey.id,
        rotationTime: new Date(),
        success: true
      };

    } catch (error) {
      console.error(`❌ Key rotation failed: ${keyId}`, error);
      
      return {
        oldKeyId: keyId,
        newKeyId: '',
        rotationTime: new Date(),
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * List keys with optional filtering
   */
  async listKeys(
    userId: string,
    filters?: {
      type?: KeySpec['type'];
      purpose?: KeySpec['purpose'];
      environment?: KeySpec['environment'];
    }
  ): Promise<GeneratedKey[]> {
    // Check permissions
    const permission = this.accessControl.checkPermission(userId, 'secret', 'list');
    if (!permission.granted) {
      throw new Error(`Access denied: ${permission.reason}`);
    }

    const secrets = await this.vaultManager.listSecrets(userId);
    const keys: GeneratedKey[] = [];

    for (const secret of secrets) {
      if (secret.name.startsWith('key_')) {
        try {
          const secretValue = await this.vaultManager.getSecret(secret.name, userId);
          const key: GeneratedKey = JSON.parse(secretValue);
          
          // Apply filters
          if (filters) {
            if (filters.type && key.spec.type !== filters.type) continue;
            if (filters.purpose && key.spec.purpose !== filters.purpose) continue;
            if (filters.environment && key.spec.environment !== filters.environment) continue;
          }
          
          keys.push(key);
        } catch (error) {
          console.warn(`Failed to parse key: ${secret.name}`, error);
        }
      }
    }

    return keys;
  }

  /**
   * Delete a key
   */
  async deleteKey(keyId: string, userId: string): Promise<void> {
    // Check permissions
    const permission = this.accessControl.checkPermission(userId, 'secret', 'delete');
    if (!permission.granted) {
      throw new Error(`Access denied: ${permission.reason}`);
    }

    await this.vaultManager.deleteSecret(keyId, userId);
    console.log(`🗑️ Key deleted: ${keyId}`);
  }

  /**
   * Generate key usage report
   */
  async generateKeyReport(startDate: Date, endDate: Date): Promise<string> {
    let report = `# Cryptographic Key Management Report\n\n`;
    report += `**Period:** ${startDate.toISOString()} to ${endDate.toISOString()}\n`;
    report += `**Generated:** ${new Date().toISOString()}\n\n`;
    
    // Get all keys (admin access required)
    const keys = await this.listKeys('system');
    
    report += `## Key Summary\n`;
    report += `- Total keys: ${keys.length}\n`;
    
    const typeCounts = keys.reduce((acc, key) => {
      acc[key.spec.type] = (acc[key.spec.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    report += `- Key types:\n`;
    for (const [type, count] of Object.entries(typeCounts)) {
      report += `  - ${type}: ${count}\n`;
    }
    
    const purposeCounts = keys.reduce((acc, key) => {
      acc[key.spec.purpose] = (acc[key.spec.purpose] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    report += `- Key purposes:\n`;
    for (const [purpose, count] of Object.entries(purposeCounts)) {
      report += `  - ${purpose}: ${count}\n`;
    }
    
    // Keys expiring soon
    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const expiringKeys = keys.filter(key => 
      key.expiresAt && key.expiresAt <= thirtyDaysFromNow
    );
    
    report += `\n## Keys Expiring Soon (30 days)\n`;
    report += `- Total: ${expiringKeys.length}\n`;
    for (const key of expiringKeys) {
      const daysUntilExpiry = key.expiresAt ? 
        Math.floor((key.expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : 0;
      report += `- ${key.id}: ${daysUntilExpiry} days (${key.spec.purpose})\n`;
    }
    
    return report;
  }

  // Private helper methods

  private async generateRSAKeyPair(algorithm: 'rsa-2048' | 'rsa-4096'): Promise<KeyPair> {
    const keySize = algorithm === 'rsa-2048' ? 2048 : 4096;
    
    return new Promise((resolve, reject) => {
      generateKeyPair('rsa', {
        modulusLength: keySize,
        publicKeyEncoding: {
          type: 'spki',
          format: 'pem'
        },
        privateKeyEncoding: {
          type: 'pkcs8',
          format: 'pem'
        }
      }, (err, publicKey, privateKey) => {
        if (err) {
          reject(err);
        } else {
          const fingerprint = this.generateFingerprint(publicKey + privateKey);
          resolve({ publicKey, privateKey, fingerprint });
        }
      });
    });
  }

  private async generateEd25519KeyPair(): Promise<KeyPair> {
    return new Promise((resolve, reject) => {
      generateKeyPair('ed25519', {
        publicKeyEncoding: {
          type: 'spki',
          format: 'pem'
        },
        privateKeyEncoding: {
          type: 'pkcs8',
          format: 'pem'
        }
      }, (err, publicKey, privateKey) => {
        if (err) {
          reject(err);
        } else {
          const fingerprint = this.generateFingerprint(publicKey + privateKey);
          resolve({ publicKey, privateKey, fingerprint });
        }
      });
    });
  }

  private async generateSecp256k1KeyPair(): Promise<KeyPair> {
    // For secp256k1, we'll generate using the crypto module
    // In production, you might want to use a specialized library like elliptic
    const privateKeyBytes = randomBytes(32);
    const privateKey = privateKeyBytes.toString('hex');
    
    // For simplicity, we'll create a placeholder public key
    // In production, derive the actual public key from the private key
    const publicKey = `secp256k1_public_${this.generateFingerprint(privateKey)}`;
    const fingerprint = this.generateFingerprint(privateKey + publicKey);
    
    return { publicKey, privateKey, fingerprint };
  }

  private generateFingerprint(data: string): string {
    return createHmac('sha256', 'yieldsensei-key-fingerprint')
      .update(data)
      .digest('hex')
      .substring(0, 16);
  }

  private generateKeyId(spec: KeySpec): string {
    const timestamp = Date.now();
    const random = randomBytes(4).toString('hex');
    return `key_${spec.type}_${spec.purpose}_${spec.environment}_${timestamp}_${random}`;
  }

  private generateVersion(): string {
    return `v${Date.now()}_${randomBytes(4).toString('hex')}`;
  }

  private getDefaultKeySize(algorithm: string): number {
    switch (algorithm) {
      case 'aes-256-gcm':
        return 256;
      case 'hmac-sha256':
        return 256;
      case 'rsa-2048':
        return 2048;
      case 'rsa-4096':
        return 4096;
      default:
        return 256;
    }
  }

  private calculateExpiration(spec: KeySpec): Date | undefined {
    // Set expiration based on key type and purpose
    const now = new Date();
    let expirationDays: number;

    switch (spec.purpose) {
      case 'jwt':
        expirationDays = 30; // JWT keys expire monthly
        break;
      case 'api':
        expirationDays = 90; // API keys expire quarterly
        break;
      case 'database':
        expirationDays = 180; // Database keys expire semi-annually
        break;
      case 'encryption':
        expirationDays = 365; // Encryption keys expire annually
        break;
      default:
        expirationDays = 90; // Default quarterly expiration
    }

    const expirationDate = new Date(now);
    expirationDate.setDate(expirationDate.getDate() + expirationDays);
    return expirationDate;
  }

  private async storeKey(
    key: GeneratedKey,
    userId: string,
    metadata?: Partial<SecretMetadata>
  ): Promise<void> {
    const keyData = JSON.stringify(key);
    
    const secretMetadata: Partial<SecretMetadata> = {
      description: `${key.spec.type} ${key.spec.purpose} key`,
      type: key.spec.purpose as any,
      environment: key.spec.environment,
      expiresAt: key.expiresAt,
      tags: [`key-type:${key.spec.type}`, `purpose:${key.spec.purpose}`],
      ...metadata
    };

    await this.vaultManager.storeSecret(key.id, keyData, secretMetadata);
  }

  private verifyKeyIntegrity(key: GeneratedKey): void {
    // Basic integrity checks
    if (!key.id || !key.spec || !key.fingerprint || !key.created) {
      throw new Error('Invalid key structure');
    }

    // Verify fingerprint matches key data
    let keyData = '';
    if (key.symmetricKey) keyData += key.symmetricKey;
    if (key.publicKey) keyData += key.publicKey;
    if (key.privateKey) keyData += key.privateKey;

    const expectedFingerprint = this.generateFingerprint(keyData);
    if (key.fingerprint !== expectedFingerprint) {
      throw new Error('Key integrity check failed: fingerprint mismatch');
    }

    // Check expiration
    if (key.expiresAt && key.expiresAt < new Date()) {
      throw new Error('Key has expired');
    }
  }
}