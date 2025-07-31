/**
 * Secure Key Storage System
 * 
 * Implements multi-layered security for cryptographic key storage including:
 * - Hierarchical access controls with role-based permissions
 * - Encrypted storage with key wrapping
 * - Audit logging for all key operations
 * - Tamper detection and integrity verification
 * - Secure key isolation and compartmentalization
 */

import { 
  createCipheriv, 
  createDecipheriv,
  createHash,
  randomBytes,
  scryptSync,
  timingSafeEqual
} from 'crypto';
import { EventEmitter } from 'events';
import { promisify } from 'util';
import { GeneratedKey } from './key-manager';

const scrypt = promisify(scryptSync);

// Storage interfaces
export interface StorageAccessPolicy {
  roleId: string;
  permissions: KeyPermission[];
  constraints?: AccessConstraints;
  validFrom: Date;
  validUntil?: Date;
}

export interface KeyPermission {
  action: 'create' | 'read' | 'update' | 'delete' | 'use' | 'rotate' | 'recover';
  resourcePattern: string; // e.g., "key_*_production", "key_symmetric_*"
  conditions?: PermissionCondition[];
}

export interface PermissionCondition {
  type: 'time_based' | 'ip_based' | 'mfa_required' | 'approval_required';
  value: any;
}

export interface AccessConstraints {
  maxAccessPerDay?: number;
  requireMFA?: boolean;
  requireApproval?: boolean;
  allowedIPs?: string[];
  allowedTimeWindow?: {
    start: string; // HH:MM
    end: string;   // HH:MM
    timezone: string;
  };
}

export interface KeyStorageContainer {
  id: string;
  name: string;
  type: 'primary' | 'backup' | 'archive';
  location: string;
  encrypted: boolean;
  isolation: 'physical' | 'logical' | 'cryptographic';
  capacity: number;
  used: number;
  keys: Map<string, StoredKey>;
}

export interface StoredKey {
  keyId: string;
  encryptedData: Buffer;
  metadata: EncryptedKeyMetadata;
  accessLog: KeyAccessLog[];
  integrityCheck: IntegrityData;
  created: Date;
  lastAccessed?: Date;
  accessCount: number;
}

export interface EncryptedKeyMetadata {
  algorithm: string;
  keyWrappingKeyId: string;
  iv: string;
  authTag: string;
  version: number;
  compressionEnabled: boolean;
}

export interface IntegrityData {
  hash: string;
  algorithm: 'sha256' | 'sha512' | 'sha3-256';
  salt: string;
  timestamp: Date;
}

export interface KeyAccessLog {
  userId: string;
  action: string;
  timestamp: Date;
  ipAddress?: string;
  userAgent?: string;
  success: boolean;
  reason?: string;
}

export interface StorageAuditEntry {
  id: string;
  timestamp: Date;
  userId: string;
  action: string;
  keyId?: string;
  containerId?: string;
  details: any;
  securityLevel: 'info' | 'warning' | 'critical';
}

export class SecureKeyStorage extends EventEmitter {
  private containers: Map<string, KeyStorageContainer> = new Map();
  private accessPolicies: Map<string, StorageAccessPolicy[]> = new Map();
  private keyWrappingKeys: Map<string, Buffer> = new Map();
  private auditLog: StorageAuditEntry[] = [];
  private readonly maxAuditLogSize = 100000;
  private readonly keyDerivationIterations = 100000;

  constructor() {
    super();
    this.initializeStorage();
  }

  private async initializeStorage(): Promise<void> {
    // Initialize primary container
    this.createContainer({
      id: 'primary',
      name: 'Primary Key Storage',
      type: 'primary',
      location: 'memory', // In production, use HSM or secure database
      encrypted: true,
      isolation: 'cryptographic',
      capacity: 10000
    });

    // Initialize backup container
    this.createContainer({
      id: 'backup',
      name: 'Backup Key Storage',
      type: 'backup',
      location: 'memory_backup',
      encrypted: true,
      isolation: 'logical',
      capacity: 10000
    });

    // Generate master key wrapping keys
    await this.generateKeyWrappingKeys();

    console.log('🔐 Secure Key Storage initialized');
  }

  /**
   * Store a key with enhanced security
   */
  async storeKey(
    key: GeneratedKey,
    userId: string,
    containerId: string = 'primary',
    accessPolicy?: StorageAccessPolicy
  ): Promise<void> {
    // Check permissions
    if (!this.checkPermission(userId, 'create', key.id)) {
      throw new Error('Access denied: Insufficient permissions to store key');
    }

    const container = this.containers.get(containerId);
    if (!container) {
      throw new Error(`Container not found: ${containerId}`);
    }

    // Prepare key data
    const keyData = JSON.stringify(key);
    
    // Compress if large
    const compressed = this.shouldCompress(keyData) ? 
      await this.compressData(keyData) : 
      Buffer.from(keyData);

    // Encrypt the key
    const wrappingKeyId = this.selectKeyWrappingKey(key.spec.environment);
    const encrypted = await this.encryptKey(compressed, wrappingKeyId);

    // Create integrity check
    const integrity = this.createIntegrityCheck(encrypted.encryptedData);

    // Store the key
    const storedKey: StoredKey = {
      keyId: key.id,
      encryptedData: encrypted.encryptedData,
      metadata: {
        algorithm: 'aes-256-gcm',
        keyWrappingKeyId: wrappingKeyId,
        iv: encrypted.iv.toString('base64'),
        authTag: encrypted.authTag.toString('base64'),
        version: 1,
        compressionEnabled: this.shouldCompress(keyData)
      },
      accessLog: [{
        userId,
        action: 'store',
        timestamp: new Date(),
        success: true
      }],
      integrityCheck: integrity,
      created: new Date(),
      accessCount: 0
    };

    container.keys.set(key.id, storedKey);
    container.used++;

    // Apply access policy if provided
    if (accessPolicy) {
      this.addAccessPolicy(key.id, accessPolicy);
    }

    // Audit log
    this.auditAction({
      userId,
      action: 'store_key',
      keyId: key.id,
      containerId,
      details: {
        keyType: key.spec.type,
        purpose: key.spec.purpose,
        environment: key.spec.environment
      },
      securityLevel: 'info'
    });

    // Replicate to backup if primary
    if (containerId === 'primary') {
      await this.replicateToBackup(key.id, storedKey);
    }

    this.emit('key:stored', { keyId: key.id, containerId });
  }

  /**
   * Retrieve a key with access control
   */
  async retrieveKey(
    keyId: string,
    userId: string,
    options?: {
      skipIntegrityCheck?: boolean;
      auditAccess?: boolean;
    }
  ): Promise<GeneratedKey> {
    // Check permissions
    if (!this.checkPermission(userId, 'read', keyId)) {
      throw new Error('Access denied: Insufficient permissions to retrieve key');
    }

    // Find key in containers
    let container: KeyStorageContainer | undefined;
    let storedKey: StoredKey | undefined;

    for (const [containerId, cont] of this.containers) {
      if (cont.keys.has(keyId)) {
        container = cont;
        storedKey = cont.keys.get(keyId)!;
        break;
      }
    }

    if (!container || !storedKey) {
      throw new Error(`Key not found: ${keyId}`);
    }

    // Verify integrity
    if (!options?.skipIntegrityCheck) {
      const integrityValid = this.verifyIntegrity(
        storedKey.encryptedData,
        storedKey.integrityCheck
      );

      if (!integrityValid) {
        this.auditAction({
          userId,
          action: 'integrity_failure',
          keyId,
          containerId: container.id,
          details: { reason: 'Integrity check failed' },
          securityLevel: 'critical'
        });

        throw new Error('Key integrity verification failed');
      }
    }

    // Decrypt the key
    const wrappingKey = this.keyWrappingKeys.get(storedKey.metadata.keyWrappingKeyId);
    if (!wrappingKey) {
      throw new Error('Key wrapping key not found');
    }

    const decrypted = await this.decryptKey(
      storedKey.encryptedData,
      wrappingKey,
      Buffer.from(storedKey.metadata.iv, 'base64'),
      Buffer.from(storedKey.metadata.authTag, 'base64')
    );

    // Decompress if needed
    const keyData = storedKey.metadata.compressionEnabled ?
      await this.decompressData(decrypted) :
      decrypted.toString();

    const key: GeneratedKey = JSON.parse(keyData);

    // Update access log
    storedKey.lastAccessed = new Date();
    storedKey.accessCount++;
    storedKey.accessLog.push({
      userId,
      action: 'retrieve',
      timestamp: new Date(),
      success: true
    });

    // Audit if requested
    if (options?.auditAccess !== false) {
      this.auditAction({
        userId,
        action: 'retrieve_key',
        keyId,
        containerId: container.id,
        details: { accessCount: storedKey.accessCount },
        securityLevel: 'info'
      });
    }

    this.emit('key:retrieved', { keyId, userId });

    return key;
  }

  /**
   * Update key access policy
   */
  async updateAccessPolicy(
    keyId: string,
    userId: string,
    policy: StorageAccessPolicy
  ): Promise<void> {
    if (!this.checkPermission(userId, 'update', keyId)) {
      throw new Error('Access denied: Cannot update access policy');
    }

    this.addAccessPolicy(keyId, policy);

    this.auditAction({
      userId,
      action: 'update_access_policy',
      keyId,
      details: { policy },
      securityLevel: 'warning'
    });
  }

  /**
   * Delete a key securely
   */
  async deleteKey(
    keyId: string,
    userId: string,
    options?: {
      secureWipe?: boolean;
      preserveAuditLog?: boolean;
    }
  ): Promise<void> {
    if (!this.checkPermission(userId, 'delete', keyId)) {
      throw new Error('Access denied: Cannot delete key');
    }

    let deleted = false;

    for (const [containerId, container] of this.containers) {
      if (container.keys.has(keyId)) {
        const storedKey = container.keys.get(keyId)!;

        // Secure wipe if requested
        if (options?.secureWipe) {
          await this.secureWipe(storedKey.encryptedData);
        }

        container.keys.delete(keyId);
        container.used--;
        deleted = true;

        this.auditAction({
          userId,
          action: 'delete_key',
          keyId,
          containerId,
          details: { 
            secureWipe: options?.secureWipe || false,
            finalAccessCount: storedKey.accessCount
          },
          securityLevel: 'warning'
        });
      }
    }

    if (!deleted) {
      throw new Error(`Key not found: ${keyId}`);
    }

    // Remove access policies
    if (!options?.preserveAuditLog) {
      this.accessPolicies.delete(keyId);
    }

    this.emit('key:deleted', { keyId, userId });
  }

  /**
   * List keys with filtering
   */
  async listKeys(
    userId: string,
    filter?: {
      containerId?: string;
      pattern?: string;
      environment?: string;
    }
  ): Promise<{ keyId: string; container: string; lastAccessed?: Date }[]> {
    const results: { keyId: string; container: string; lastAccessed?: Date }[] = [];

    for (const [containerId, container] of this.containers) {
      if (filter?.containerId && containerId !== filter.containerId) {
        continue;
      }

      for (const [keyId, storedKey] of container.keys) {
        if (!this.checkPermission(userId, 'read', keyId)) {
          continue;
        }

        if (filter?.pattern && !keyId.includes(filter.pattern)) {
          continue;
        }

        results.push({
          keyId,
          container: containerId,
          lastAccessed: storedKey.lastAccessed
        });
      }
    }

    return results;
  }

  /**
   * Export audit log
   */
  async exportAuditLog(
    startDate?: Date,
    endDate?: Date,
    securityLevel?: StorageAuditEntry['securityLevel']
  ): Promise<StorageAuditEntry[]> {
    return this.auditLog.filter(entry => {
      if (startDate && entry.timestamp < startDate) return false;
      if (endDate && entry.timestamp > endDate) return false;
      if (securityLevel && entry.securityLevel !== securityLevel) return false;
      return true;
    });
  }

  /**
   * Generate storage health report
   */
  async generateHealthReport(): Promise<{
    containers: any[];
    totalKeys: number;
    accessMetrics: any;
    securityAlerts: any[];
  }> {
    const containers = Array.from(this.containers.values()).map(container => ({
      id: container.id,
      name: container.name,
      type: container.type,
      utilization: (container.used / container.capacity) * 100,
      keyCount: container.keys.size
    }));

    let totalKeys = 0;
    let totalAccesses = 0;
    const recentSecurityAlerts: any[] = [];

    for (const container of this.containers.values()) {
      totalKeys += container.keys.size;
      
      for (const storedKey of container.keys.values()) {
        totalAccesses += storedKey.accessCount;
      }
    }

    // Find recent security alerts
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const securityAlerts = this.auditLog.filter(
      entry => entry.securityLevel !== 'info' && entry.timestamp > oneDayAgo
    );

    return {
      containers,
      totalKeys,
      accessMetrics: {
        totalAccesses,
        averageAccessPerKey: totalKeys > 0 ? totalAccesses / totalKeys : 0
      },
      securityAlerts: securityAlerts.slice(-10) // Last 10 alerts
    };
  }

  // Private helper methods

  private createContainer(config: {
    id: string;
    name: string;
    type: 'primary' | 'backup' | 'archive';
    location: string;
    encrypted: boolean;
    isolation: 'physical' | 'logical' | 'cryptographic';
    capacity: number;
  }): void {
    const container: KeyStorageContainer = {
      ...config,
      used: 0,
      keys: new Map()
    };

    this.containers.set(config.id, container);
  }

  private async generateKeyWrappingKeys(): Promise<void> {
    // Generate key wrapping keys for each environment
    const environments = ['development', 'staging', 'production', 'all'];
    
    for (const env of environments) {
      const salt = randomBytes(32);
      const wrappingKey = scryptSync(
        randomBytes(32),
        salt,
        32,
        { N: this.keyDerivationIterations }
      );
      
      this.keyWrappingKeys.set(`kek_${env}`, wrappingKey);
    }
  }

  private selectKeyWrappingKey(environment: string): string {
    return `kek_${environment}` || 'kek_all';
  }

  private async encryptKey(
    data: Buffer,
    wrappingKeyId: string
  ): Promise<{
    encryptedData: Buffer;
    iv: Buffer;
    authTag: Buffer;
  }> {
    const wrappingKey = this.keyWrappingKeys.get(wrappingKeyId);
    if (!wrappingKey) {
      throw new Error('Key wrapping key not found');
    }

    const iv = randomBytes(16);
    const cipher = createCipheriv('aes-256-gcm', wrappingKey, iv);
    
    const encrypted = Buffer.concat([
      cipher.update(data),
      cipher.final()
    ]);
    
    const authTag = cipher.getAuthTag();

    return { encryptedData: encrypted, iv, authTag };
  }

  private async decryptKey(
    encryptedData: Buffer,
    wrappingKey: Buffer,
    iv: Buffer,
    authTag: Buffer
  ): Promise<Buffer> {
    const decipher = createDecipheriv('aes-256-gcm', wrappingKey, iv);
    decipher.setAuthTag(authTag);
    
    const decrypted = Buffer.concat([
      decipher.update(encryptedData),
      decipher.final()
    ]);
    
    return decrypted;
  }

  private createIntegrityCheck(data: Buffer): IntegrityData {
    const salt = randomBytes(16).toString('hex');
    const hash = createHash('sha256')
      .update(salt)
      .update(data)
      .digest('hex');
    
    return {
      hash,
      algorithm: 'sha256',
      salt,
      timestamp: new Date()
    };
  }

  private verifyIntegrity(data: Buffer, integrity: IntegrityData): boolean {
    const computedHash = createHash(integrity.algorithm)
      .update(integrity.salt)
      .update(data)
      .digest('hex');
    
    return computedHash === integrity.hash;
  }

  private checkPermission(
    userId: string,
    action: KeyPermission['action'],
    keyId: string
  ): boolean {
    // Check user-specific policies
    const userPolicies = this.accessPolicies.get(userId) || [];
    
    for (const policy of userPolicies) {
      if (this.policyAllowsAction(policy, action, keyId)) {
        return true;
      }
    }

    // Check role-based policies
    const rolePolicies = this.accessPolicies.get(`role:${userId}`) || [];
    
    for (const policy of rolePolicies) {
      if (this.policyAllowsAction(policy, action, keyId)) {
        return true;
      }
    }

    // Default admin check
    return userId === 'system' || userId === 'admin';
  }

  private policyAllowsAction(
    policy: StorageAccessPolicy,
    action: KeyPermission['action'],
    keyId: string
  ): boolean {
    // Check time validity
    const now = new Date();
    if (policy.validFrom > now) return false;
    if (policy.validUntil && policy.validUntil < now) return false;

    // Check permissions
    for (const permission of policy.permissions) {
      if (permission.action === action || permission.action === 'use') {
        // Check resource pattern
        const pattern = new RegExp(permission.resourcePattern.replace('*', '.*'));
        if (pattern.test(keyId)) {
          // Check conditions
          if (permission.conditions) {
            if (!this.checkPermissionConditions(permission.conditions)) {
              return false;
            }
          }
          return true;
        }
      }
    }

    return false;
  }

  private checkPermissionConditions(conditions: PermissionCondition[]): boolean {
    for (const condition of conditions) {
      switch (condition.type) {
        case 'time_based':
          // Check time window
          const now = new Date();
          const currentHour = now.getHours();
          const { startHour, endHour } = condition.value;
          if (currentHour < startHour || currentHour > endHour) {
            return false;
          }
          break;
        
        case 'mfa_required':
          // In production, verify MFA token
          if (!condition.value.verified) {
            return false;
          }
          break;
        
        case 'approval_required':
          // Check for approval
          if (!condition.value.approved) {
            return false;
          }
          break;
        
        case 'ip_based':
          // In production, check actual IP
          const allowedIPs = condition.value.allowedIPs || [];
          if (allowedIPs.length > 0 && !allowedIPs.includes('current_ip')) {
            return false;
          }
          break;
      }
    }
    
    return true;
  }

  private addAccessPolicy(resourceId: string, policy: StorageAccessPolicy): void {
    const policies = this.accessPolicies.get(resourceId) || [];
    policies.push(policy);
    this.accessPolicies.set(resourceId, policies);
  }

  private shouldCompress(data: string): boolean {
    return data.length > 1024; // Compress if larger than 1KB
  }

  private async compressData(data: string): Promise<Buffer> {
    // Simple compression - in production use zlib or similar
    return Buffer.from(data);
  }

  private async decompressData(data: Buffer): Promise<string> {
    // Simple decompression - in production use zlib or similar
    return data.toString();
  }

  private async secureWipe(data: Buffer): Promise<void> {
    // Overwrite buffer with random data multiple times
    for (let i = 0; i < 3; i++) {
      const random = randomBytes(data.length);
      data.copy(random);
    }
    
    // Clear the buffer
    data.fill(0);
  }

  private async replicateToBackup(keyId: string, storedKey: StoredKey): Promise<void> {
    const backupContainer = this.containers.get('backup');
    if (!backupContainer) return;

    // Clone the stored key
    const backupKey: StoredKey = {
      ...storedKey,
      encryptedData: Buffer.from(storedKey.encryptedData),
      accessLog: [...storedKey.accessLog]
    };

    backupContainer.keys.set(keyId, backupKey);
    backupContainer.used++;

    console.log(`📋 Key replicated to backup: ${keyId}`);
  }

  private auditAction(entry: Omit<StorageAuditEntry, 'id' | 'timestamp'>): void {
    const auditEntry: StorageAuditEntry = {
      id: `audit_${Date.now()}_${randomBytes(4).toString('hex')}`,
      timestamp: new Date(),
      ...entry
    };

    this.auditLog.push(auditEntry);

    // Trim audit log if too large
    if (this.auditLog.length > this.maxAuditLogSize) {
      this.auditLog = this.auditLog.slice(-this.maxAuditLogSize);
    }

    // Emit audit event
    this.emit('audit:entry', auditEntry);

    // Log critical events
    if (entry.securityLevel === 'critical') {
      console.error(`🚨 Critical security event: ${entry.action}`, entry.details);
    }
  }
}

// Export default instance
export const secureKeyStorage = new SecureKeyStorage();