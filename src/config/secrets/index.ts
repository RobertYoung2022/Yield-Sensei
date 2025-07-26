/**
 * Secret Management System - Main Configuration
 * 
 * Provides a unified interface for all secret management operations including
 * vault management, key generation, rotation, and access control.
 */

import { VaultManager, VaultConfig } from './vault-manager';
import { RotationManager } from './rotation-manager';
import { AccessControlManager } from './access-control';
import { KeyManager, KeySpec } from './key-manager';

export interface SecretManagerConfig {
  vault: VaultConfig;
  defaultRotationPolicy: {
    enabled: boolean;
    intervalDays: number;
    autoRotate: boolean;
    gracePeriodDays: number;
    notificationDays: number[];
  };
  keyGeneration: {
    defaultKeySpecs: Record<string, KeySpec>;
    enableAutoRotation: boolean;
    rotationCheckInterval: number; // in milliseconds
  };
}

export class SecretManager {
  private vaultManager: VaultManager;
  private rotationManager: RotationManager;
  private accessControl: AccessControlManager;
  private keyManager: KeyManager;
  private rotationInterval: NodeJS.Timeout | undefined;

  constructor(config: SecretManagerConfig) {
    // Initialize components
    this.vaultManager = new VaultManager(config.vault);
    this.accessControl = new AccessControlManager();
    this.rotationManager = new RotationManager(this.vaultManager, this.accessControl);
    this.keyManager = new KeyManager(this.vaultManager, this.rotationManager, this.accessControl);

    // Start automatic rotation checking if enabled
    if (config.keyGeneration.enableAutoRotation) {
      this.startAutoRotation(config.keyGeneration.rotationCheckInterval);
    }
  }

  /**
   * Get vault manager instance
   */
  getVaultManager(): VaultManager {
    return this.vaultManager;
  }

  /**
   * Get rotation manager instance
   */
  getRotationManager(): RotationManager {
    return this.rotationManager;
  }

  /**
   * Get access control manager instance
   */
  getAccessControlManager(): AccessControlManager {
    return this.accessControl;
  }

  /**
   * Get key manager instance
   */
  getKeyManager(): KeyManager {
    return this.keyManager;
  }

  /**
   * Initialize default users and keys for the system
   */
  async initialize(): Promise<void> {
    console.log('🔧 Initializing Secret Management System...');

    // Create default system user
    try {
      this.accessControl.createUser({
        username: 'system',
        email: 'system@yieldsensei.com',
        roles: ['admin'],
        environment: 'all',
        isActive: true,
        metadata: { type: 'system', created_by: 'initialization' }
      });
      console.log('✅ System user created');
    } catch (error) {
      console.log('ℹ️ System user already exists');
    }

    // Generate default cryptographic keys
    await this.generateDefaultKeys();

    console.log('✅ Secret Management System initialized');
  }

  /**
   * Generate default cryptographic keys for the system
   */
  private async generateDefaultKeys(): Promise<void> {
    const defaultKeys = [
      {
        spec: {
          type: 'symmetric' as const,
          algorithm: 'aes-256-gcm' as const,
          purpose: 'encryption' as const,
          environment: 'all' as const
        },
        name: 'master-encryption-key'
      },
      {
        spec: {
          type: 'signing' as const,
          algorithm: 'hmac-sha256' as const,
          purpose: 'jwt' as const,
          environment: 'all' as const
        },
        name: 'jwt-signing-key'
      },
      {
        spec: {
          type: 'symmetric' as const,
          algorithm: 'aes-256-gcm' as const,
          purpose: 'database' as const,
          environment: 'all' as const
        },
        name: 'database-encryption-key'
      },
      {
        spec: {
          type: 'signing' as const,
          algorithm: 'hmac-sha256' as const,
          purpose: 'api' as const,
          environment: 'all' as const
        },
        name: 'api-signing-key'
      }
    ];

    for (const keyConfig of defaultKeys) {
      try {
        // Check if key already exists
        const existingKeys = await this.keyManager.listKeys('system', {
          purpose: keyConfig.spec.purpose
        });

        if (existingKeys.length === 0) {
          await this.keyManager.generateKey(
            keyConfig.spec,
            'system',
            {
              description: `Default ${keyConfig.spec.purpose} key for YieldSensei`,
              type: keyConfig.spec.purpose,
              environment: keyConfig.spec.environment,
              rotationPolicy: {
                enabled: true,
                intervalDays: 90,
                autoRotate: true,
                gracePeriodDays: 7,
                notificationDays: [30, 7, 1]
              },
              tags: ['default', 'system', keyConfig.spec.purpose]
            }
          );
          console.log(`✅ Generated default ${keyConfig.spec.purpose} key`);
        } else {
          console.log(`ℹ️ Default ${keyConfig.spec.purpose} key already exists`);
        }
      } catch (error) {
        console.error(`❌ Failed to generate ${keyConfig.spec.purpose} key:`, error);
      }
    }
  }

  /**
   * Start automatic rotation checking
   */
  private startAutoRotation(intervalMs: number): void {
    this.rotationInterval = setInterval(async () => {
      try {
        console.log('🔍 Checking for keys that need rotation...');
        const rotationResults = await this.rotationManager.processAutomaticRotations();
        
        if (rotationResults.length > 0) {
          console.log(`🔄 Processed ${rotationResults.length} automatic rotations`);
          
          // Send notifications
          await this.rotationManager.sendNotifications();
        }
      } catch (error) {
        console.error('❌ Error during automatic rotation check:', error);
      }
    }, intervalMs);

    console.log(`🕒 Automatic rotation checking started (interval: ${intervalMs}ms)`);
  }

  /**
   * Stop automatic rotation checking
   */
  stopAutoRotation(): void {
    if (this.rotationInterval) {
      clearInterval(this.rotationInterval);
      this.rotationInterval = undefined;
      console.log('🛑 Automatic rotation checking stopped');
    }
  }

  /**
   * Generate comprehensive system report
   */
  async generateSystemReport(): Promise<string> {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    let report = `# YieldSensei Secret Management System Report\n\n`;
    report += `**Generated:** ${now.toISOString()}\n`;
    report += `**Period:** Last 30 days\n\n`;

    // Vault report
    const vaultReport = await this.vaultManager.generateAuditReport(thirtyDaysAgo, now);
    report += vaultReport + '\n\n';

    // Rotation report
    const rotationReport = this.rotationManager.generateRotationReport(thirtyDaysAgo, now);
    report += rotationReport + '\n\n';

    // Access control report
    const accessReport = this.accessControl.generateAuditReport(thirtyDaysAgo, now);
    report += accessReport + '\n\n';

    // Key management report
    const keyReport = await this.keyManager.generateKeyReport(thirtyDaysAgo, now);
    report += keyReport + '\n\n';

    return report;
  }

  /**
   * Perform system health check
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'warning' | 'critical';
    checks: Record<string, { status: 'pass' | 'fail' | 'warning'; message: string }>;
  }> {
    const checks: Record<string, { status: 'pass' | 'fail' | 'warning'; message: string }> = {};

    // Check vault connectivity
    try {
      const secrets = await this.vaultManager.listSecrets('system');
      checks['vault'] = {
        status: 'pass',
        message: `Vault accessible, ${secrets.length} secrets found`
      };
    } catch (error) {
      checks['vault'] = {
        status: 'fail',
        message: `Vault inaccessible: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }

    // Check for keys needing rotation
    try {
      const needsRotation = await this.vaultManager.checkRotationNeeded();
      if (needsRotation.length === 0) {
        checks['rotation'] = {
          status: 'pass',
          message: 'No keys need immediate rotation'
        };
      } else if (needsRotation.length <= 5) {
        checks['rotation'] = {
          status: 'warning',
          message: `${needsRotation.length} keys need rotation`
        };
      } else {
        checks['rotation'] = {
          status: 'fail',
          message: `${needsRotation.length} keys urgently need rotation`
        };
      }
    } catch (error) {
      checks['rotation'] = {
        status: 'fail',
        message: `Cannot check rotation status: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }

    // Check access control system
    try {
      const roles = this.accessControl.listRoles();
      const users = this.accessControl.listUsers();
      checks['access_control'] = {
        status: 'pass',
        message: `Access control operational: ${roles.length} roles, ${users.length} users`
      };
    } catch (error) {
      checks['access_control'] = {
        status: 'fail',
        message: `Access control error: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }

    // Check key integrity
    try {
      const keys = await this.keyManager.listKeys('system');
      const expiredKeys = keys.filter(key => key.expiresAt && key.expiresAt < new Date());
      
      if (expiredKeys.length === 0) {
        checks['key_integrity'] = {
          status: 'pass',
          message: `${keys.length} keys managed, none expired`
        };
      } else {
        checks['key_integrity'] = {
          status: 'warning',
          message: `${keys.length} keys managed, ${expiredKeys.length} expired`
        };
      }
    } catch (error) {
      checks['key_integrity'] = {
        status: 'fail',
        message: `Key integrity check failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }

    // Determine overall status
    const failureCount = Object.values(checks).filter(check => check.status === 'fail').length;
    const warningCount = Object.values(checks).filter(check => check.status === 'warning').length;

    let status: 'healthy' | 'warning' | 'critical';
    if (failureCount > 0) {
      status = 'critical';
    } else if (warningCount > 0) {
      status = 'warning';
    } else {
      status = 'healthy';
    }

    return { status, checks };
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    this.stopAutoRotation();
    console.log('🧹 Secret Management System cleanup completed');
  }
}

// Default configuration factory
export function createDefaultSecretManagerConfig(): SecretManagerConfig {
  const environment = process.env['NODE_ENV'] || 'development';
  
  return {
    vault: {
      type: 'local',
      localConfig: {
        vaultPath: process.env['VAULT_PATH'] || './data/secrets',
        encryptionKey: process.env['VAULT_ENCRYPTION_KEY'] || 'default-dev-key-change-in-production'
      }
    },
    defaultRotationPolicy: {
      enabled: environment === 'production',
      intervalDays: 90,
      autoRotate: true,
      gracePeriodDays: 7,
      notificationDays: [30, 7, 1]
    },
    keyGeneration: {
      defaultKeySpecs: {
        encryption: {
          type: 'symmetric',
          algorithm: 'aes-256-gcm',
          purpose: 'encryption',
          environment: 'all'
        },
        signing: {
          type: 'signing',
          algorithm: 'hmac-sha256',
          purpose: 'authentication',
          environment: 'all'
        },
        jwt: {
          type: 'signing',
          algorithm: 'hmac-sha256',
          purpose: 'jwt',
          environment: 'all'
        }
      },
      enableAutoRotation: environment === 'production',
      rotationCheckInterval: 24 * 60 * 60 * 1000 // 24 hours
    }
  };
}

// Export all types and classes
export * from './vault-manager';
export * from './rotation-manager';
export * from './access-control';
export * from './key-manager';
export { SecretManager as default };