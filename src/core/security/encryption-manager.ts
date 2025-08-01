/**
 * YieldSensei Encryption Manager
 * Task 45.4: Security and Cloud-Native Deployment Capabilities
 * 
 * Provides end-to-end encryption, key management, and secure communication protocols
 */

import { EventEmitter } from 'events';
import { createHash, createHmac, randomBytes, createCipheriv, createDecipheriv } from 'crypto';
import Logger from '@/shared/logging/logger';
import { AgentId } from '@/types';

const logger = Logger.getLogger('encryption-manager');

/**
 * Encryption Algorithm Types
 */
export type EncryptionAlgorithm = 'aes-256-gcm' | 'aes-256-cbc' | 'chacha20-poly1305';

/**
 * Key Types
 */
export type KeyType = 'symmetric' | 'public' | 'private' | 'session' | 'transport';

/**
 * Security Level
 */
export type SecurityLevel = 'low' | 'medium' | 'high' | 'classified';

/**
 * Encryption Key
 */
export interface EncryptionKey {
  id: string;
  type: KeyType;
  algorithm: EncryptionAlgorithm;
  keyData: Buffer;
  metadata: {
    nodeId: AgentId;
    createdAt: Date;
    expiresAt?: Date;
    purpose: string;
    securityLevel: SecurityLevel;
  };
  keyVersion: number;
}

/**
 * Encrypted Message
 */
export interface EncryptedMessage {
  id: string;
  algorithm: EncryptionAlgorithm;
  encryptedData: Buffer;
  iv: Buffer;
  authTag?: Buffer;
  keyId: string;
  keyVersion: number;
  metadata: {
    originalSize: number;
    timestamp: Date;
    integrity: string;
  };
}

/**
 * Key Exchange Protocol
 */
export interface KeyExchangeRequest {
  id: string;
  requestorNodeId: AgentId;
  targetNodeId: AgentId;
  protocol: 'ecdh' | 'rsa' | 'x25519';
  publicKey: Buffer;
  nonce: Buffer;
  timestamp: Date;
  securityLevel: SecurityLevel;
}

/**
 * Encryption Manager Configuration
 */
export interface EncryptionConfig {
  nodeId: AgentId;
  defaultAlgorithm: EncryptionAlgorithm;
  defaultSecurityLevel: SecurityLevel;
  keyRotationInterval: number;
  sessionKeyLifetime: number;
  enablePerfectForwardSecrecy: boolean;
  keyDerivation: {
    iterations: number;
    saltLength: number;
    hashAlgorithm: string;
  };
  storage: {
    encryptKeysAtRest: boolean;
    keyBackupEnabled: boolean;
    secureErasure: boolean;
  };
}

export const DEFAULT_ENCRYPTION_CONFIG: EncryptionConfig = {
  nodeId: 'unknown',
  defaultAlgorithm: 'aes-256-gcm',
  defaultSecurityLevel: 'high',
  keyRotationInterval: 24 * 60 * 60 * 1000, // 24 hours
  sessionKeyLifetime: 60 * 60 * 1000, // 1 hour
  enablePerfectForwardSecrecy: true,
  keyDerivation: {
    iterations: 100000,
    saltLength: 32,
    hashAlgorithm: 'sha512',
  },
  storage: {
    encryptKeysAtRest: true,
    keyBackupEnabled: true,
    secureErasure: true,
  },
};

/**
 * Encryption Statistics
 */
export interface EncryptionStats {
  totalKeys: number;
  activeKeys: number;
  expiredKeys: number;
  encryptionOperations: number;
  decryptionOperations: number;
  keyExchanges: number;
  failedOperations: number;
  averageEncryptionTime: number;
  averageDecryptionTime: number;
  keysByType: Map<KeyType, number>;
  keysBySecurityLevel: Map<SecurityLevel, number>;
}

/**
 * Encryption Manager
 * Handles encryption, decryption, and key management for secure satellite communication
 */
export class EncryptionManager extends EventEmitter {
  private config: EncryptionConfig;
  
  // Key storage
  private keys: Map<string, EncryptionKey> = new Map();
  private sessionKeys: Map<string, EncryptionKey> = new Map();
  private keysByNode: Map<AgentId, Set<string>> = new Map();
  
  // Timers
  private keyRotationTimer?: NodeJS.Timeout;
  private cleanupTimer?: NodeJS.Timeout;
  
  // State
  private isRunning: boolean = false;
  private keySequence: number = 0;
  
  // Statistics
  private stats: EncryptionStats = {
    totalKeys: 0,
    activeKeys: 0,
    expiredKeys: 0,
    encryptionOperations: 0,
    decryptionOperations: 0,
    keyExchanges: 0,
    failedOperations: 0,
    averageEncryptionTime: 0,
    averageDecryptionTime: 0,
    keysByType: new Map(),
    keysBySecurityLevel: new Map(),
  };

  constructor(config: EncryptionConfig = DEFAULT_ENCRYPTION_CONFIG) {
    super();
    this.config = config;
  }

  /**
   * Start the encryption manager
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Encryption manager already running');
      return;
    }

    try {
      logger.info('Starting encryption manager...');

      // Generate initial node key
      await this.generateNodeKey();

      // Start key rotation timer
      this.startKeyRotation();

      // Start cleanup timer
      this.startKeyCleanup();

      this.isRunning = true;
      logger.info('Encryption manager started successfully');
      this.emit('started');

    } catch (error) {
      logger.error('Failed to start encryption manager:', error);
      throw error;
    }
  }

  /**
   * Stop the encryption manager
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    logger.info('Stopping encryption manager...');

    // Clear timers
    if (this.keyRotationTimer) {
      clearInterval(this.keyRotationTimer);
      delete this.keyRotationTimer;
    }

    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      delete this.cleanupTimer;
    }

    // Secure erase keys if enabled
    if (this.config.storage.secureErasure) {
      await this.secureEraseKeys();
    }

    this.isRunning = false;
    logger.info('Encryption manager stopped');
    this.emit('stopped');
  }

  /**
   * Encrypt data using specified key or default
   */
  async encrypt(
    data: Buffer,
    keyId?: string,
    options?: {
      algorithm?: EncryptionAlgorithm;
      associatedData?: Buffer;
      securityLevel?: SecurityLevel;
    }
  ): Promise<EncryptedMessage> {
    const startTime = Date.now();

    try {
      // Get or create encryption key
      const key = keyId ? this.getKey(keyId) : await this.getDefaultKey(options?.securityLevel);
      if (!key) {
        throw new Error('No encryption key available');
      }

      const algorithm = options?.algorithm || key.algorithm;
      const iv = randomBytes(this.getIvLength(algorithm));

      let encryptedData: Buffer;
      let authTag: Buffer | undefined;

      switch (algorithm) {
        case 'aes-256-gcm':
          const gcmCipher = createCipheriv('aes-256-gcm', key.keyData, iv);
          if (options?.associatedData) {
            gcmCipher.setAAD(options.associatedData);
          }
          encryptedData = Buffer.concat([gcmCipher.update(data), gcmCipher.final()]);
          authTag = gcmCipher.getAuthTag();
          break;

        case 'aes-256-cbc':
          const cbcCipher = createCipheriv('aes-256-cbc', key.keyData, iv);
          encryptedData = Buffer.concat([cbcCipher.update(data), cbcCipher.final()]);
          break;

        case 'chacha20-poly1305':
          const chachaCipher = createCipheriv('chacha20-poly1305', key.keyData, iv);
          if (options?.associatedData) {
            chachaCipher.setAAD(options.associatedData);
          }
          encryptedData = Buffer.concat([chachaCipher.update(data), chachaCipher.final()]);
          authTag = chachaCipher.getAuthTag();
          break;

        default:
          throw new Error(`Unsupported encryption algorithm: ${algorithm}`);
      }

      // Calculate integrity hash
      const integrity = createHash('sha256')
        .update(encryptedData)
        .update(iv)
        .update(authTag || Buffer.alloc(0))
        .digest('hex');

      const encryptedMessage: EncryptedMessage = {
        id: `enc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        algorithm,
        encryptedData,
        iv,
        authTag,
        keyId: key.id,
        keyVersion: key.keyVersion,
        metadata: {
          originalSize: data.length,
          timestamp: new Date(),
          integrity,
        },
      };

      // Update statistics
      this.stats.encryptionOperations++;
      const encryptionTime = Date.now() - startTime;
      this.updateAverageTime('encryption', encryptionTime);

      logger.debug(`Encrypted ${data.length} bytes using ${algorithm} in ${encryptionTime}ms`);
      this.emit('data_encrypted', { message: encryptedMessage, algorithm, keyId: key.id });

      return encryptedMessage;

    } catch (error) {
      this.stats.failedOperations++;
      logger.error('Encryption failed:', error);
      throw error;
    }
  }

  /**
   * Decrypt encrypted message
   */
  async decrypt(encryptedMessage: EncryptedMessage, associatedData?: Buffer): Promise<Buffer> {
    const startTime = Date.now();

    try {
      // Get decryption key
      const key = this.getKey(encryptedMessage.keyId);
      if (!key) {
        throw new Error(`Decryption key ${encryptedMessage.keyId} not found`);
      }

      // Verify key version
      if (key.keyVersion !== encryptedMessage.keyVersion) {
        throw new Error('Key version mismatch');
      }

      // Verify integrity
      const integrity = createHash('sha256')
        .update(encryptedMessage.encryptedData)
        .update(encryptedMessage.iv)
        .update(encryptedMessage.authTag || Buffer.alloc(0))
        .digest('hex');

      if (integrity !== encryptedMessage.metadata.integrity) {
        throw new Error('Message integrity verification failed');
      }

      let decryptedData: Buffer;

      switch (encryptedMessage.algorithm) {
        case 'aes-256-gcm':
          const gcmDecipher = createDecipheriv('aes-256-gcm', key.keyData, encryptedMessage.iv);
          if (encryptedMessage.authTag) {
            gcmDecipher.setAuthTag(encryptedMessage.authTag);
          }
          if (associatedData) {
            gcmDecipher.setAAD(associatedData);
          }
          decryptedData = Buffer.concat([
            gcmDecipher.update(encryptedMessage.encryptedData),
            gcmDecipher.final()
          ]);
          break;

        case 'aes-256-cbc':
          const cbcDecipher = createDecipheriv('aes-256-cbc', key.keyData, encryptedMessage.iv);
          decryptedData = Buffer.concat([
            cbcDecipher.update(encryptedMessage.encryptedData),
            cbcDecipher.final()
          ]);
          break;

        case 'chacha20-poly1305':
          const chachaDecipher = createDecipheriv('chacha20-poly1305', key.keyData, encryptedMessage.iv);
          if (encryptedMessage.authTag) {
            chachaDecipher.setAuthTag(encryptedMessage.authTag);
          }
          if (associatedData) {
            chachaDecipher.setAAD(associatedData);
          }
          decryptedData = Buffer.concat([
            chachaDecipher.update(encryptedMessage.encryptedData),
            chachaDecipher.final()
          ]);
          break;

        default:
          throw new Error(`Unsupported encryption algorithm: ${encryptedMessage.algorithm}`);
      }

      // Update statistics
      this.stats.decryptionOperations++;
      const decryptionTime = Date.now() - startTime;
      this.updateAverageTime('decryption', decryptionTime);

      logger.debug(`Decrypted ${decryptedData.length} bytes using ${encryptedMessage.algorithm} in ${decryptionTime}ms`);
      this.emit('data_decrypted', { messageId: encryptedMessage.id, algorithm: encryptedMessage.algorithm });

      return decryptedData;

    } catch (error) {
      this.stats.failedOperations++;
      logger.error('Decryption failed:', error);
      throw error;
    }
  }

  /**
   * Generate new encryption key
   */
  async generateKey(
    type: KeyType,
    options?: {
      algorithm?: EncryptionAlgorithm;
      securityLevel?: SecurityLevel;
      purpose?: string;
      expiresIn?: number;
    }
  ): Promise<EncryptionKey> {
    const algorithm = options?.algorithm || this.config.defaultAlgorithm;
    const keyLength = this.getKeyLength(algorithm);
    const keyData = randomBytes(keyLength);

    const key: EncryptionKey = {
      id: `key-${this.config.nodeId}-${++this.keySequence}-${Date.now()}`,
      type,
      algorithm,
      keyData,
      metadata: {
        nodeId: this.config.nodeId,
        createdAt: new Date(),
        expiresAt: options?.expiresIn ? new Date(Date.now() + options.expiresIn) : undefined,
        purpose: options?.purpose || 'general',
        securityLevel: options?.securityLevel || this.config.defaultSecurityLevel,
      },
      keyVersion: 1,
    };

    // Store key
    this.keys.set(key.id, key);
    
    // Update indices
    if (!this.keysByNode.has(this.config.nodeId)) {
      this.keysByNode.set(this.config.nodeId, new Set());
    }
    this.keysByNode.get(this.config.nodeId)!.add(key.id);

    // Update statistics
    this.stats.totalKeys++;
    this.stats.activeKeys++;
    this.updateKeyStatsByType(key.type, 1);
    this.updateKeyStatsBySecurityLevel(key.metadata.securityLevel, 1);

    logger.info(`Generated ${type} key ${key.id} with ${algorithm} (${key.metadata.securityLevel} security)`);
    this.emit('key_generated', key);

    return key;
  }

  /**
   * Generate session key for temporary communication
   */
  async generateSessionKey(nodeId: AgentId, lifetime?: number): Promise<EncryptionKey> {
    const sessionLifetime = lifetime || this.config.sessionKeyLifetime;
    
    const sessionKey = await this.generateKey('session', {
      purpose: `session_${nodeId}`,
      expiresIn: sessionLifetime,
    });

    this.sessionKeys.set(sessionKey.id, sessionKey);

    // Auto-cleanup session key
    setTimeout(() => {
      this.removeKey(sessionKey.id);
      this.sessionKeys.delete(sessionKey.id);
    }, sessionLifetime);

    logger.info(`Generated session key ${sessionKey.id} for node ${nodeId} (expires in ${sessionLifetime}ms)`);
    return sessionKey;
  }

  /**
   * Rotate encryption keys
   */
  async rotateKeys(keyIds?: string[]): Promise<void> {
    const keysToRotate = keyIds || Array.from(this.keys.keys());
    
    for (const keyId of keysToRotate) {
      const oldKey = this.keys.get(keyId);
      if (!oldKey || oldKey.type === 'session') {
        continue; // Skip missing keys and session keys
      }

      try {
        // Generate new key with same properties
        const newKey = await this.generateKey(oldKey.type, {
          algorithm: oldKey.algorithm,
          securityLevel: oldKey.metadata.securityLevel,
          purpose: oldKey.metadata.purpose,
        });

        // Mark old key as deprecated
        oldKey.metadata.expiresAt = new Date(Date.now() + 60000); // Expire in 1 minute

        logger.info(`Rotated key ${keyId} to ${newKey.id}`);
        this.emit('key_rotated', { oldKey, newKey });

      } catch (error) {
        logger.error(`Failed to rotate key ${keyId}:`, error);
      }
    }
  }

  /**
   * Get encryption key by ID
   */
  getKey(keyId: string): EncryptionKey | null {
    return this.keys.get(keyId) || this.sessionKeys.get(keyId) || null;
  }

  /**
   * Remove encryption key
   */
  removeKey(keyId: string): boolean {
    const key = this.keys.get(keyId) || this.sessionKeys.get(keyId);
    if (!key) {
      return false;
    }

    // Secure erase key data
    if (this.config.storage.secureErasure) {
      key.keyData.fill(0);
    }

    // Remove from storage
    const removed = this.keys.delete(keyId) || this.sessionKeys.delete(keyId);
    
    if (removed) {
      // Update indices
      const nodeKeys = this.keysByNode.get(key.metadata.nodeId);
      if (nodeKeys) {
        nodeKeys.delete(keyId);
        if (nodeKeys.size === 0) {
          this.keysByNode.delete(key.metadata.nodeId);
        }
      }

      // Update statistics
      this.stats.activeKeys--;
      this.updateKeyStatsByType(key.type, -1);
      this.updateKeyStatsBySecurityLevel(key.metadata.securityLevel, -1);

      logger.debug(`Removed key ${keyId}`);
      this.emit('key_removed', { keyId, type: key.type });
    }

    return removed;
  }

  /**
   * Get encryption statistics
   */
  getStats(): EncryptionStats {
    return {
      ...this.stats,
      keysByType: new Map(this.stats.keysByType),
      keysBySecurityLevel: new Map(this.stats.keysBySecurityLevel),
    };
  }

  /**
   * Generate initial node key
   */
  private async generateNodeKey(): Promise<void> {
    await this.generateKey('transport', {
      purpose: 'node_transport',
      securityLevel: this.config.defaultSecurityLevel,
    });
  }

  /**
   * Get default encryption key
   */
  private async getDefaultKey(securityLevel?: SecurityLevel): Promise<EncryptionKey | null> {
    // Find suitable transport key
    for (const key of this.keys.values()) {
      if (key.type === 'transport' && 
          key.metadata.nodeId === this.config.nodeId &&
          (!securityLevel || key.metadata.securityLevel === securityLevel)) {
        return key;
      }
    }

    // Generate new key if none found
    return await this.generateKey('transport', {
      securityLevel: securityLevel || this.config.defaultSecurityLevel,
    });
  }

  /**
   * Start key rotation timer
   */
  private startKeyRotation(): void {
    this.keyRotationTimer = setInterval(async () => {
      try {
        await this.rotateKeys();
      } catch (error) {
        logger.error('Key rotation failed:', error);
      }
    }, this.config.keyRotationInterval);
  }

  /**
   * Start key cleanup timer
   */
  private startKeyCleanup(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanupExpiredKeys();
    }, 60000); // Run every minute
  }

  /**
   * Clean up expired keys
   */
  private cleanupExpiredKeys(): void {
    const now = new Date();
    const expiredKeys: string[] = [];

    for (const [keyId, key] of this.keys.entries()) {
      if (key.metadata.expiresAt && key.metadata.expiresAt <= now) {
        expiredKeys.push(keyId);
      }
    }

    for (const keyId of expiredKeys) {
      this.removeKey(keyId);
      this.stats.expiredKeys++;
    }

    if (expiredKeys.length > 0) {
      logger.debug(`Cleaned up ${expiredKeys.length} expired keys`);
    }
  }

  /**
   * Secure erase all keys
   */
  private async secureEraseKeys(): Promise<void> {
    for (const key of this.keys.values()) {
      key.keyData.fill(0);
    }
    for (const key of this.sessionKeys.values()) {
      key.keyData.fill(0);
    }
    logger.info('Performed secure key erasure');
  }

  /**
   * Get key length for algorithm
   */
  private getKeyLength(algorithm: EncryptionAlgorithm): number {
    switch (algorithm) {
      case 'aes-256-gcm':
      case 'aes-256-cbc':
        return 32; // 256 bits
      case 'chacha20-poly1305':
        return 32; // 256 bits
      default:
        return 32;
    }
  }

  /**
   * Get IV length for algorithm
   */
  private getIvLength(algorithm: EncryptionAlgorithm): number {
    switch (algorithm) {
      case 'aes-256-gcm':
        return 12; // 96 bits for GCM
      case 'aes-256-cbc':
        return 16; // 128 bits for CBC
      case 'chacha20-poly1305':
        return 12; // 96 bits
      default:
        return 16;
    }
  }

  /**
   * Update key statistics by type
   */
  private updateKeyStatsByType(type: KeyType, delta: number): void {
    const current = this.stats.keysByType.get(type) || 0;
    this.stats.keysByType.set(type, Math.max(0, current + delta));
  }

  /**
   * Update key statistics by security level
   */
  private updateKeyStatsBySecurityLevel(level: SecurityLevel, delta: number): void {
    const current = this.stats.keysBySecurityLevel.get(level) || 0;
    this.stats.keysBySecurityLevel.set(level, Math.max(0, current + delta));
  }

  /**
   * Update average operation time
   */
  private updateAverageTime(operation: 'encryption' | 'decryption', time: number): void {
    if (operation === 'encryption') {
      const current = this.stats.averageEncryptionTime;
      const count = this.stats.encryptionOperations;
      this.stats.averageEncryptionTime = ((current * (count - 1)) + time) / count;
    } else {
      const current = this.stats.averageDecryptionTime;
      const count = this.stats.decryptionOperations;
      this.stats.averageDecryptionTime = ((current * (count - 1)) + time) / count;
    }
  }
}