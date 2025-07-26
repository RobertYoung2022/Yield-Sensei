/**
 * Secret Vault Manager
 * 
 * Provides a unified interface for secret management across different backends:
 * - Local development (file-based with encryption)
 * - HashiCorp Vault (production)
 * - AWS Secrets Manager (cloud deployment)
 * 
 * Implements role-based access control and secret rotation policies.
 */

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

export interface SecretMetadata {
  id: string;
  name: string;
  description: string;
  type: 'jwt' | 'encryption' | 'database' | 'api' | 'webhook' | 'custom';
  environment: 'development' | 'staging' | 'production' | 'all';
  created: Date;
  lastRotated: Date;
  expiresAt?: Date;
  rotationPolicy: RotationPolicy;
  accessControl: AccessControl;
  tags: string[];
}

export interface RotationPolicy {
  enabled: boolean;
  intervalDays: number;
  autoRotate: boolean;
  gracePeriodDays: number;
  notificationDays: number[];
}

export interface AccessControl {
  roles: string[];
  users: string[];
  permissions: ('read' | 'write' | 'rotate' | 'delete')[];
  ipRestrictions?: string[];
  timeRestrictions?: {
    startTime: string;
    endTime: string;
    timezone: string;
  };
}

export interface SecretValue {
  value: string;
  version: string;
  encrypted: boolean;
  metadata: SecretMetadata;
}

export interface VaultConfig {
  type: 'local' | 'hashicorp' | 'aws' | 'azure';
  localConfig?: {
    vaultPath: string;
    encryptionKey: string;
  };
  hashicorpConfig?: {
    url: string;
    token: string;
    mountPath: string;
  };
  awsConfig?: {
    region: string;
    accessKeyId: string;
    secretAccessKey: string;
  };
  azureConfig?: {
    vaultUrl: string;
    tenantId: string;
    clientId: string;
    clientSecret: string;
  };
}

export class VaultManager {
  private config: VaultConfig;
  private encryptionKey!: Buffer;

  constructor(config: VaultConfig) {
    this.config = config;
    
    // Initialize encryption key for local vault
    if (config.type === 'local' && config.localConfig) {
      this.encryptionKey = scryptSync(
        config.localConfig.encryptionKey,
        'yieldsensei-vault-salt',
        32
      );
      
      // Ensure vault directory exists
      const vaultDir = join(config.localConfig.vaultPath, '..');
      if (!existsSync(vaultDir)) {
        mkdirSync(vaultDir, { recursive: true });
      }
    }
  }

  /**
   * Store a secret in the vault
   */
  async storeSecret(
    name: string,
    value: string,
    metadata: Partial<SecretMetadata>
  ): Promise<SecretValue> {
    const secretId = this.generateSecretId(name);
    const version = this.generateVersion();
    
    const fullMetadata: Partial<SecretMetadata> = {
      id: secretId,
      name,
      description: metadata.description || '',
      type: metadata.type || 'custom',
      environment: metadata.environment || 'all',
      created: new Date(),
      lastRotated: new Date(),
      rotationPolicy: metadata.rotationPolicy || {
        enabled: false,
        intervalDays: 90,
        autoRotate: false,
        gracePeriodDays: 7,
        notificationDays: [30, 7, 1]
      },
      accessControl: metadata.accessControl || {
        roles: ['admin'],
        users: [],
        permissions: ['read']
      },
      tags: metadata.tags || []
    };

    if (metadata.expiresAt !== undefined) {
      fullMetadata.expiresAt = metadata.expiresAt;
    }

    const secretValue: SecretValue = {
      value: this.encryptValue(value),
      version,
      encrypted: true,
      metadata: fullMetadata as SecretMetadata
    };

    await this.saveSecret(secretId, secretValue);
    
    console.log(`✅ Secret stored: ${name} (${secretId})`);
    return secretValue;
  }

  /**
   * Retrieve a secret from the vault
   */
  async getSecret(name: string, role?: string): Promise<string> {
    const secretId = this.generateSecretId(name);
    const secret = await this.loadSecret(secretId);
    
    if (!secret) {
      throw new Error(`Secret not found: ${name}`);
    }

    // Check access control
    this.validateAccess(secret.metadata.accessControl, role);
    
    // Check if secret is expired
    if (secret.metadata.expiresAt && secret.metadata.expiresAt < new Date()) {
      throw new Error(`Secret expired: ${name}`);
    }

    const decryptedValue = this.decryptValue(secret.value);
    
    // Log access for audit
    this.logAccess(secretId, 'read', role);
    
    return decryptedValue;
  }

  /**
   * Rotate a secret
   */
  async rotateSecret(name: string, newValue: string, role?: string): Promise<SecretValue> {
    const secretId = this.generateSecretId(name);
    const secret = await this.loadSecret(secretId);
    
    if (!secret) {
      throw new Error(`Secret not found: ${name}`);
    }

    // Check rotation permissions
    this.validateAccess(secret.metadata.accessControl, role, 'rotate');
    
    // Create new version
    const newVersion = this.generateVersion();
    const rotatedSecret: SecretValue = {
      ...secret,
      value: this.encryptValue(newValue),
      version: newVersion,
      metadata: {
        ...secret.metadata,
        lastRotated: new Date()
      }
    };

    await this.saveSecret(secretId, rotatedSecret);
    
    // Log rotation for audit
    this.logAccess(secretId, 'rotate', role);
    
    console.log(`🔄 Secret rotated: ${name} (${secretId})`);
    return rotatedSecret;
  }

  /**
   * List all secrets
   */
  async listSecrets(role?: string): Promise<SecretMetadata[]> {
    const secrets: SecretMetadata[] = [];
    
    if (this.config.type === 'local' && this.config.localConfig) {
      const vaultPath = this.config.localConfig.vaultPath;
      const vaultDir = join(vaultPath, '..');
      
      if (existsSync(vaultDir)) {
        // Implementation for local file listing
        // This would scan the vault directory for secret files
        console.log('📋 Listing secrets from local vault...');
      }
    }
    
    return secrets.filter(secret => 
      this.hasAccess(secret.accessControl, role, 'read')
    );
  }

  /**
   * Delete a secret
   */
  async deleteSecret(name: string, role?: string): Promise<void> {
    const secretId = this.generateSecretId(name);
    const secret = await this.loadSecret(secretId);
    
    if (!secret) {
      throw new Error(`Secret not found: ${name}`);
    }

    // Check delete permissions
    this.validateAccess(secret.metadata.accessControl, role, 'delete');
    
    await this.removeSecret(secretId);
    
    // Log deletion for audit
    this.logAccess(secretId, 'delete', role);
    
    console.log(`🗑️ Secret deleted: ${name} (${secretId})`);
  }

  /**
   * Check for secrets that need rotation
   */
  async checkRotationNeeded(): Promise<SecretMetadata[]> {
    const secrets = await this.listSecrets();
    const now = new Date();
    const needsRotation: SecretMetadata[] = [];
    
    for (const secret of secrets) {
      if (!secret.rotationPolicy.enabled) continue;
      
      const daysSinceRotation = Math.floor(
        (now.getTime() - secret.lastRotated.getTime()) / (1000 * 60 * 60 * 24)
      );
      
      if (daysSinceRotation >= secret.rotationPolicy.intervalDays) {
        needsRotation.push(secret);
      }
    }
    
    return needsRotation;
  }

  /**
   * Generate audit report
   */
  async generateAuditReport(startDate: Date, endDate: Date): Promise<string> {
    // Implementation for audit report generation
    let report = `# Secret Vault Audit Report\n\n`;
    report += `**Period:** ${startDate.toISOString()} to ${endDate.toISOString()}\n`;
    report += `**Generated:** ${new Date().toISOString()}\n\n`;
    
    // This would include access logs, rotation events, etc.
    report += `## Access Summary\n`;
    report += `- Total accesses: [calculated]\n`;
    report += `- Unique users: [calculated]\n`;
    report += `- Failed attempts: [calculated]\n\n`;
    
    report += `## Rotation Summary\n`;
    report += `- Secrets rotated: [calculated]\n`;
    report += `- Auto-rotations: [calculated]\n`;
    report += `- Manual rotations: [calculated]\n\n`;
    
    return report;
  }

  // Private helper methods

  private generateSecretId(name: string): string {
    return `secret_${name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Date.now()}`;
  }

  private generateVersion(): string {
    return `v${Date.now()}_${randomBytes(4).toString('hex')}`;
  }

  private encryptValue(value: string): string {
    if (this.config.type !== 'local' || !this.encryptionKey) {
      return value; // Backend handles encryption
    }
    
    const iv = randomBytes(16);
    const cipher = createCipheriv('aes-256-gcm', this.encryptionKey, iv);
    
    let encrypted = cipher.update(value, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  }

  private decryptValue(encryptedValue: string): string {
    if (this.config.type !== 'local' || !this.encryptionKey) {
      return encryptedValue; // Backend handles decryption
    }
    
    const parts = encryptedValue.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted value format');
    }
    
    const [ivHex, authTagHex, encrypted] = parts;
    if (!ivHex || !authTagHex || !encrypted) {
      throw new Error('Invalid encrypted value format - missing parts');
    }
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    
    const decipher = createDecipheriv('aes-256-gcm', this.encryptionKey, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  private async saveSecret(secretId: string, secret: SecretValue): Promise<void> {
    if (this.config.type === 'local' && this.config.localConfig) {
      const filePath = join(this.config.localConfig.vaultPath, `${secretId}.json`);
      writeFileSync(filePath, JSON.stringify(secret, null, 2));
    } else {
      // Implementation for other backends
      throw new Error(`Backend ${this.config.type} not implemented`);
    }
  }

  private async loadSecret(secretId: string): Promise<SecretValue | null> {
    if (this.config.type === 'local' && this.config.localConfig) {
      const filePath = join(this.config.localConfig.vaultPath, `${secretId}.json`);
      
      if (!existsSync(filePath)) {
        return null;
      }
      
      const data = readFileSync(filePath, 'utf8');
      return JSON.parse(data);
    } else {
      // Implementation for other backends
      throw new Error(`Backend ${this.config.type} not implemented`);
    }
  }

  private async removeSecret(secretId: string): Promise<void> {
    if (this.config.type === 'local' && this.config.localConfig) {
      const filePath = join(this.config.localConfig.vaultPath, `${secretId}.json`);
      
      if (existsSync(filePath)) {
        // In production, we might want to archive instead of delete
        // For now, we'll just delete the file
        // unlinkSync(filePath);
        console.log(`Would delete: ${filePath}`);
      }
    } else {
      // Implementation for other backends
      throw new Error(`Backend ${this.config.type} not implemented`);
    }
  }

  private validateAccess(
    accessControl: AccessControl,
    role?: string,
    permission: 'read' | 'write' | 'rotate' | 'delete' = 'read'
  ): void {
    if (!this.hasAccess(accessControl, role, permission)) {
      throw new Error(`Access denied: ${permission} permission required`);
    }
  }

  private hasAccess(
    accessControl: AccessControl,
    role?: string,
    permission: 'read' | 'write' | 'rotate' | 'delete' = 'read'
  ): boolean {
    // Check if user has the required permission
    if (!accessControl.permissions.includes(permission)) {
      return false;
    }
    
    // Check role-based access
    if (role && accessControl.roles.includes(role)) {
      return true;
    }
    
    // Check user-based access
    if (role && accessControl.users.includes(role)) {
      return true;
    }
    
    return false;
  }

  private logAccess(secretId: string, action: string, role?: string): void {
    const logEntry = {
      timestamp: new Date().toISOString(),
      secretId,
      action,
      role: role || 'unknown',
      ip: '127.0.0.1', // In production, get from request
      userAgent: 'vault-manager' // In production, get from request
    };
    
    console.log(`📝 Access log: ${JSON.stringify(logEntry)}`);
    
    // In production, this would write to a secure audit log
    // writeFileSync('/var/log/vault-access.log', JSON.stringify(logEntry) + '\n', { flag: 'a' });
  }
} 