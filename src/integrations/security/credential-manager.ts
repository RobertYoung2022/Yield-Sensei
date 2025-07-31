/**
 * Credential Manager
 * Secure storage and management of API keys and sensitive credentials
 */

import { randomBytes, createCipher, createDecipher, pbkdf2Sync, timingSafeEqual } from 'crypto';
import { EventEmitter } from 'events';
import Logger from '../../shared/logging/logger';
import {
  SecureCredential,
  CredentialRotationJob,
  EncryptionConfig,
  SecurityEvent,
  SecurityEventHandler
} from './types';

const logger = Logger.getLogger('credential-manager');

export class CredentialManager extends EventEmitter {
  private credentials: Map<string, SecureCredential> = new Map();
  private rotationJobs: Map<string, CredentialRotationJob> = new Map();
  private config: EncryptionConfig;
  private masterKey: Buffer;
  private eventHandlers: Map<string, SecurityEventHandler[]> = new Map();
  private rotationTimer?: NodeJS.Timeout;

  constructor(config: EncryptionConfig, masterKey?: string) {
    super();
    this.config = {
      algorithm: 'AES-256-GCM',
      keyDerivation: 'PBKDF2',
      iterations: 100000,
      saltLength: 32,
      keyRotationInterval: 90,
      ...config
    };
    
    // Initialize master key
    this.masterKey = masterKey 
      ? Buffer.from(masterKey, 'hex')
      : this.generateMasterKey();

    this.startRotationScheduler();
  }

  /**
   * Store a credential securely
   */
  async storeCredential(
    serviceId: string,
    value: string,
    keyType: SecureCredential['keyType'],
    metadata: SecureCredential['metadata']
  ): Promise<string> {
    try {
      const credentialId = this.generateCredentialId();
      const encrypted = await this.encryptValue(value);
      
      const credential: SecureCredential = {
        id: credentialId,
        serviceId,
        keyType,
        encryptedValue: encrypted.ciphertext,
        iv: encrypted.iv,
        salt: encrypted.salt,
        metadata: {
          ...metadata,
          lastRotated: new Date()
        },
        createdAt: new Date(),
        updatedAt: new Date(),
        isActive: true
      };

      this.credentials.set(credentialId, credential);

      // Schedule rotation if interval is specified
      if (metadata.rotationInterval) {
        this.scheduleRotation(credentialId, metadata.rotationInterval);
      }

      await this.emitSecurityEvent({
        type: 'credential_accessed',
        timestamp: new Date(),
        data: {
          action: 'store',
          credentialId,
          serviceId,
          keyType
        },
        severity: 'low'
      });

      logger.info(`Credential stored for service: ${serviceId}`, {
        credentialId,
        keyType
      });

      return credentialId;
    } catch (error) {
      logger.error(`Failed to store credential for service ${serviceId}:`, error);
      throw error;
    }
  }

  /**
   * Retrieve a credential value
   */
  async getCredential(credentialId: string): Promise<string | null> {
    try {
      const credential = this.credentials.get(credentialId);
      if (!credential || !credential.isActive) {
        logger.warn(`Credential not found or inactive: ${credentialId}`);
        return null;
      }

      // Check if credential is expired
      if (credential.metadata.expiresAt && credential.metadata.expiresAt < new Date()) {
        logger.warn(`Credential expired: ${credentialId}`);
        await this.deactivateCredential(credentialId);
        return null;
      }

      const decrypted = await this.decryptValue({
        ciphertext: credential.encryptedValue,
        iv: credential.iv,
        salt: credential.salt
      });

      await this.emitSecurityEvent({
        type: 'credential_accessed',
        timestamp: new Date(),
        data: {
          action: 'retrieve',
          credentialId,
          serviceId: credential.serviceId,
          keyType: credential.keyType
        },
        severity: 'low'
      });

      return decrypted;
    } catch (error) {
      logger.error(`Failed to retrieve credential ${credentialId}:`, error);
      
      await this.emitSecurityEvent({
        type: 'credential_accessed',
        timestamp: new Date(),
        data: {
          action: 'retrieve_failed',
          credentialId,
          error: error.message
        },
        severity: 'high'
      });

      throw error;
    }
  }

  /**
   * Update a credential value
   */
  async updateCredential(credentialId: string, newValue: string): Promise<void> {
    try {
      const credential = this.credentials.get(credentialId);
      if (!credential) {
        throw new Error(`Credential not found: ${credentialId}`);
      }

      const encrypted = await this.encryptValue(newValue);
      
      credential.encryptedValue = encrypted.ciphertext;
      credential.iv = encrypted.iv;
      credential.salt = encrypted.salt;
      credential.updatedAt = new Date();
      credential.metadata.lastRotated = new Date();

      await this.emitSecurityEvent({
        type: 'credential_accessed',
        timestamp: new Date(),
        data: {
          action: 'update',
          credentialId,
          serviceId: credential.serviceId
        },
        severity: 'medium'
      });

      logger.info(`Credential updated: ${credentialId}`);
    } catch (error) {
      logger.error(`Failed to update credential ${credentialId}:`, error);
      throw error;
    }
  }

  /**
   * Rotate a credential
   */
  async rotateCredential(credentialId: string, newValue?: string): Promise<string> {
    try {
      const credential = this.credentials.get(credentialId);
      if (!credential) {
        throw new Error(`Credential not found: ${credentialId}`);
      }

      // Create new credential
      const newCredentialId = await this.storeCredential(
        credential.serviceId,
        newValue || await this.generateNewCredentialValue(credential),
        credential.keyType,
        {
          ...credential.metadata,
          lastRotated: new Date()
        }
      );

      // Deactivate old credential after a grace period
      setTimeout(async () => {
        await this.deactivateCredential(credentialId);
      }, 60000); // 1 minute grace period

      await this.emitSecurityEvent({
        type: 'credential_accessed',
        timestamp: new Date(),
        data: {
          action: 'rotate',
          oldCredentialId: credentialId,
          newCredentialId,
          serviceId: credential.serviceId
        },
        severity: 'medium'
      });

      logger.info(`Credential rotated: ${credentialId} -> ${newCredentialId}`);
      return newCredentialId;
    } catch (error) {
      logger.error(`Failed to rotate credential ${credentialId}:`, error);
      throw error;
    }
  }

  /**
   * Deactivate a credential
   */
  async deactivateCredential(credentialId: string): Promise<void> {
    try {
      const credential = this.credentials.get(credentialId);
      if (credential) {
        credential.isActive = false;
        credential.updatedAt = new Date();

        await this.emitSecurityEvent({
          type: 'credential_accessed',
          timestamp: new Date(),
          data: {
            action: 'deactivate',
            credentialId,
            serviceId: credential.serviceId
          },
          severity: 'medium'
        });

        logger.info(`Credential deactivated: ${credentialId}`);
      }
    } catch (error) {
      logger.error(`Failed to deactivate credential ${credentialId}:`, error);
      throw error;
    }
  }

  /**
   * Get credentials for a service
   */
  getServiceCredentials(serviceId: string): SecureCredential[] {
    return Array.from(this.credentials.values()).filter(
      credential => credential.serviceId === serviceId && credential.isActive
    );
  }

  /**
   * Get credentials expiring soon
   */
  getExpiringCredentials(withinDays: number = 30): SecureCredential[] {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() + withinDays);

    return Array.from(this.credentials.values()).filter(credential => {
      if (!credential.isActive || !credential.metadata.expiresAt) {
        return false;
      }
      return credential.metadata.expiresAt <= cutoffDate;
    });
  }

  /**
   * Get credentials due for rotation
   */
  getRotationDueCredentials(): SecureCredential[] {
    const now = new Date();
    
    return Array.from(this.credentials.values()).filter(credential => {
      if (!credential.isActive || !credential.metadata.rotationInterval || !credential.metadata.lastRotated) {
        return false;
      }
      
      const nextRotation = new Date(credential.metadata.lastRotated);
      nextRotation.setDate(nextRotation.getDate() + credential.metadata.rotationInterval);
      
      return nextRotation <= now;
    });
  }

  /**
   * Validate credential integrity
   */
  async validateCredential(credentialId: string): Promise<boolean> {
    try {
      const credential = this.credentials.get(credentialId);
      if (!credential) {
        return false;
      }

      // Try to decrypt - if it fails, credential is corrupted
      await this.decryptValue({
        ciphertext: credential.encryptedValue,
        iv: credential.iv,
        salt: credential.salt
      });

      return true;
    } catch (error) {
      logger.error(`Credential validation failed for ${credentialId}:`, error);
      return false;
    }
  }

  /**
   * Encrypt a value using the configured encryption settings
   */
  private async encryptValue(value: string): Promise<{
    ciphertext: string;
    iv: string;
    salt: string;
  }> {
    const salt = randomBytes(this.config.saltLength);
    const iv = randomBytes(16);
    
    // Derive key from master key using salt
    const key = pbkdf2Sync(this.masterKey, salt, this.config.iterations, 32, 'sha256');
    
    // For simplicity, using a basic encryption approach
    // In production, use proper authenticated encryption
    const cipher = createCipher(this.config.algorithm.replace('-GCM', ''), key);
    let encrypted = cipher.update(value, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    return {
      ciphertext: encrypted,
      iv: iv.toString('hex'),
      salt: salt.toString('hex')
    };
  }

  /**
   * Decrypt a value
   */
  private async decryptValue(encrypted: {
    ciphertext: string;
    iv: string;
    salt: string;
  }): Promise<string> {
    const salt = Buffer.from(encrypted.salt, 'hex');
    const iv = Buffer.from(encrypted.iv, 'hex');
    
    // Derive key from master key using salt
    const key = pbkdf2Sync(this.masterKey, salt, this.config.iterations, 32, 'sha256');
    
    const decipher = createDecipher(this.config.algorithm.replace('-GCM', ''), key);
    let decrypted = decipher.update(encrypted.ciphertext, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  /**
   * Generate a new master key
   */
  private generateMasterKey(): Buffer {
    const key = randomBytes(32);
    logger.info('Generated new master key for credential encryption');
    return key;
  }

  /**
   * Generate a unique credential ID
   */
  private generateCredentialId(): string {
    return 'cred_' + randomBytes(16).toString('hex');
  }

  /**
   * Generate a new credential value (placeholder)
   */
  private async generateNewCredentialValue(credential: SecureCredential): Promise<string> {
    // This is a placeholder - in reality, you'd call the service's API
    // to generate a new API key or refresh an OAuth token
    return 'new_' + randomBytes(16).toString('hex');
  }

  /**
   * Schedule credential rotation
   */
  private scheduleRotation(credentialId: string, intervalDays: number): void {
    const job: CredentialRotationJob = {
      id: 'rotation_' + randomBytes(8).toString('hex'),
      credentialId,
      scheduledAt: new Date(Date.now() + intervalDays * 24 * 60 * 60 * 1000),
      status: 'pending',
      attempts: 0
    };

    this.rotationJobs.set(job.id, job);
    
    setTimeout(async () => {
      await this.executeRotationJob(job.id);
    }, intervalDays * 24 * 60 * 60 * 1000);
  }

  /**
   * Execute a rotation job
   */
  private async executeRotationJob(jobId: string): Promise<void> {
    const job = this.rotationJobs.get(jobId);
    if (!job) {
      return;
    }

    try {
      job.status = 'running';
      job.lastAttempt = new Date();
      job.attempts++;

      const newCredentialId = await this.rotateCredential(job.credentialId);
      
      job.status = 'completed';
      job.newCredentialId = newCredentialId;

      logger.info(`Rotation job completed: ${jobId}`);
    } catch (error) {
      job.status = 'failed';
      job.error = error.message;

      logger.error(`Rotation job failed: ${jobId}`, error);

      // Retry logic
      if (job.attempts < 3) {
        setTimeout(() => {
          this.executeRotationJob(jobId);
        }, 60000 * Math.pow(2, job.attempts)); // Exponential backoff
      }
    }
  }

  /**
   * Start the rotation scheduler
   */
  private startRotationScheduler(): void {
    this.rotationTimer = setInterval(async () => {
      const dueCredentials = this.getRotationDueCredentials();
      
      for (const credential of dueCredentials) {
        try {
          await this.rotateCredential(credential.id);
        } catch (error) {
          logger.error(`Scheduled rotation failed for credential ${credential.id}:`, error);
        }
      }
    }, 24 * 60 * 60 * 1000); // Check daily
  }

  /**
   * Add security event handler
   */
  addEventHandler(eventType: string, handler: SecurityEventHandler): void {
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, []);
    }
    this.eventHandlers.get(eventType)!.push(handler);
  }

  /**
   * Emit security event
   */
  private async emitSecurityEvent(event: SecurityEvent): Promise<void> {
    this.emit('security_event', event);
    
    const handlers = this.eventHandlers.get(event.type) || [];
    for (const handler of handlers) {
      try {
        await handler(event);
      } catch (error) {
        logger.error(`Security event handler failed:`, error);
      }
    }
  }

  /**
   * Get credential statistics
   */
  getStatistics(): {
    total: number;
    active: number;
    expired: number;
    expiringSoon: number;
    rotationDue: number;
    byKeyType: Record<string, number>;
    byService: Record<string, number>;
  } {
    const credentials = Array.from(this.credentials.values());
    const byKeyType: Record<string, number> = {};
    const byService: Record<string, number> = {};

    for (const credential of credentials) {
      byKeyType[credential.keyType] = (byKeyType[credential.keyType] || 0) + 1;
      byService[credential.serviceId] = (byService[credential.serviceId] || 0) + 1;
    }

    return {
      total: credentials.length,
      active: credentials.filter(c => c.isActive).length,
      expired: credentials.filter(c => 
        c.metadata.expiresAt && c.metadata.expiresAt < new Date()
      ).length,
      expiringSoon: this.getExpiringCredentials(30).length,
      rotationDue: this.getRotationDueCredentials().length,
      byKeyType,
      byService
    };
  }

  /**
   * Export encrypted credentials (for backup)
   */
  exportCredentials(): string {
    const exportData = {
      timestamp: new Date().toISOString(),
      credentials: Array.from(this.credentials.values()).map(cred => ({
        ...cred,
        // Keep encrypted values for backup
        encryptedValue: cred.encryptedValue,
        iv: cred.iv,
        salt: cred.salt
      }))
    };

    return JSON.stringify(exportData);
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    if (this.rotationTimer) {
      clearInterval(this.rotationTimer);
    }

    // Clear sensitive data from memory
    this.credentials.clear();
    this.rotationJobs.clear();
    this.masterKey.fill(0);

    this.removeAllListeners();
    logger.info('Credential manager cleanup complete');
  }
}