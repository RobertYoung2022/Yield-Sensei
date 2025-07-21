/**
 * Unified Secret Management Service
 * 
 * Integrates vault management, access control, and rotation management
 * into a single cohesive system for secure secret handling.
 */

import { VaultManager, VaultConfig, SecretMetadata, SecretValue } from './vault-manager';
import { AccessControlManager, User, Role } from './access-control';
import { RotationManager, RotationSchedule, RotationResult } from './rotation-manager';

export interface SecretManagerConfig {
  vault: VaultConfig;
  defaultRotationPolicy: {
    enabled: boolean;
    intervalDays: number;
    autoRotate: boolean;
    gracePeriodDays: number;
    notificationDays: number[];
  };
  auditLogging: {
    enabled: boolean;
    logPath: string;
    retentionDays: number;
  };
}

export interface SecretOperation {
  userId: string;
  action: 'store' | 'retrieve' | 'rotate' | 'delete' | 'list';
  secretName: string;
  timestamp: Date;
  success: boolean;
  error?: string;
  metadata: Record<string, any>;
}

export class SecretManager {
  private vaultManager: VaultManager;
  private accessControl: AccessControlManager;
  private rotationManager: RotationManager;
  private config: SecretManagerConfig;
  private operationLog: SecretOperation[] = [];

  constructor(config: SecretManagerConfig) {
    this.config = config;
    this.vaultManager = new VaultManager(config.vault);
    this.accessControl = new AccessControlManager();
    this.rotationManager = new RotationManager(this.vaultManager, this.accessControl);
  }

  /**
   * Initialize the secret management system
   */
  async initialize(): Promise<void> {
    console.log('🔐 Initializing Secret Management System...');
    
    // Initialize default users if none exist
    if (this.accessControl.listUsers().length === 0) {
      await this.initializeDefaultUsers();
    }

    // Check for secrets that need rotation
    const dueRotations = await this.rotationManager.checkRotationNeeded();
    if (dueRotations.length > 0) {
      console.log(`⚠️ Found ${dueRotations.length} secrets due for rotation`);
    }

    console.log('✅ Secret Management System initialized');
  }

  /**
   * Store a secret with access control and rotation policy
   */
  async storeSecret(
    name: string,
    value: string,
    metadata: Partial<SecretMetadata>,
    userId: string
  ): Promise<SecretValue> {
    const operation: SecretOperation = {
      userId,
      action: 'store',
      secretName: name,
      timestamp: new Date(),
      success: false,
      metadata: { ...metadata }
    };

    try {
      // Check permissions
      const permission = this.accessControl.checkPermission(userId, 'secret', 'create');
      if (!permission.granted) {
        throw new Error(`Access denied: ${permission.reason}`);
      }

      // Store the secret
      const secret = await this.vaultManager.storeSecret(name, value, metadata);
      
      // Schedule rotation if enabled
      if (metadata.rotationPolicy?.enabled || this.config.defaultRotationPolicy.enabled) {
        const policy = metadata.rotationPolicy || this.config.defaultRotationPolicy;
        await this.rotationManager.scheduleRotation(name, policy, userId);
      }

      operation.success = true;
      console.log(`✅ Secret stored: ${name}`);
      return secret;

    } catch (error) {
      operation.error = error instanceof Error ? error.message : 'Unknown error';
      console.error(`❌ Failed to store secret: ${name}`, error);
      throw error;
    } finally {
      this.logOperation(operation);
    }
  }

  /**
   * Retrieve a secret with access control
   */
  async getSecret(name: string, userId: string): Promise<string> {
    const operation: SecretOperation = {
      userId,
      action: 'retrieve',
      secretName: name,
      timestamp: new Date(),
      success: false,
      metadata: {}
    };

    try {
      // Check permissions
      const permission = this.accessControl.checkPermission(userId, 'secret', 'read');
      if (!permission.granted) {
        throw new Error(`Access denied: ${permission.reason}`);
      }

      // Get the secret
      const secret = await this.vaultManager.getSecret(name, userId);
      
      operation.success = true;
      console.log(`📖 Secret retrieved: ${name}`);
      return secret;

    } catch (error) {
      operation.error = error instanceof Error ? error.message : 'Unknown error';
      console.error(`❌ Failed to retrieve secret: ${name}`, error);
      throw error;
    } finally {
      this.logOperation(operation);
    }
  }

  /**
   * Rotate a secret with access control
   */
  async rotateSecret(
    name: string,
    newValue: string,
    userId: string
  ): Promise<RotationResult> {
    const operation: SecretOperation = {
      userId,
      action: 'rotate',
      secretName: name,
      timestamp: new Date(),
      success: false,
      metadata: {}
    };

    try {
      // Check permissions
      const permission = this.accessControl.checkPermission(userId, 'secret', 'rotate');
      if (!permission.granted) {
        throw new Error(`Access denied: ${permission.reason}`);
      }

      // Rotate the secret
      const result = await this.rotationManager.rotateSecret(name, newValue, userId);
      
      operation.success = result.success;
      if (!result.success) {
        operation.error = result.error;
      }

      return result;

    } catch (error) {
      operation.error = error instanceof Error ? error.message : 'Unknown error';
      console.error(`❌ Failed to rotate secret: ${name}`, error);
      throw error;
    } finally {
      this.logOperation(operation);
    }
  }

  /**
   * Delete a secret with access control
   */
  async deleteSecret(name: string, userId: string): Promise<void> {
    const operation: SecretOperation = {
      userId,
      action: 'delete',
      secretName: name,
      timestamp: new Date(),
      success: false,
      metadata: {}
    };

    try {
      // Check permissions
      const permission = this.accessControl.checkPermission(userId, 'secret', 'delete');
      if (!permission.granted) {
        throw new Error(`Access denied: ${permission.reason}`);
      }

      // Delete the secret
      await this.vaultManager.deleteSecret(name, userId);
      
      operation.success = true;
      console.log(`🗑️ Secret deleted: ${name}`);

    } catch (error) {
      operation.error = error instanceof Error ? error.message : 'Unknown error';
      console.error(`❌ Failed to delete secret: ${name}`, error);
      throw error;
    } finally {
      this.logOperation(operation);
    }
  }

  /**
   * List secrets with access control
   */
  async listSecrets(userId: string): Promise<SecretMetadata[]> {
    const operation: SecretOperation = {
      userId,
      action: 'list',
      secretName: 'all',
      timestamp: new Date(),
      success: false,
      metadata: {}
    };

    try {
      // Check permissions
      const permission = this.accessControl.checkPermission(userId, 'secret', 'list');
      if (!permission.granted) {
        throw new Error(`Access denied: ${permission.reason}`);
      }

      // List secrets
      const secrets = await this.vaultManager.listSecrets(userId);
      
      operation.success = true;
      operation.metadata = { count: secrets.length };
      console.log(`📋 Listed ${secrets.length} secrets`);
      return secrets;

    } catch (error) {
      operation.error = error instanceof Error ? error.message : 'Unknown error';
      console.error(`❌ Failed to list secrets`, error);
      throw error;
    } finally {
      this.logOperation(operation);
    }
  }

  /**
   * Process automatic rotations
   */
  async processAutomaticRotations(): Promise<RotationResult[]> {
    console.log('🔄 Processing automatic rotations...');
    const results = await this.rotationManager.processAutomaticRotations();
    
    console.log(`✅ Processed ${results.length} automatic rotations`);
    return results;
  }

  /**
   * Send rotation notifications
   */
  async sendRotationNotifications(): Promise<void> {
    console.log('📧 Sending rotation notifications...');
    await this.rotationManager.sendNotifications();
  }

  /**
   * Get audit report
   */
  async generateAuditReport(startDate: Date, endDate: Date): Promise<string> {
    let report = `# Secret Management Audit Report\n\n`;
    report += `**Period:** ${startDate.toISOString()} to ${endDate.toISOString()}\n`;
    report += `**Generated:** ${new Date().toISOString()}\n\n`;

    // Operation summary
    const operationsInRange = this.operationLog.filter(op => 
      op.timestamp >= startDate && op.timestamp <= endDate
    );

    report += `## Operation Summary\n`;
    report += `- Total operations: ${operationsInRange.length}\n`;
    
    const actionCounts = operationsInRange.reduce((acc, op) => {
      acc[op.action] = (acc[op.action] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    report += `- Operations by type:\n`;
    for (const [action, count] of Object.entries(actionCounts)) {
      report += `  - ${action}: ${count}\n`;
    }

    const successCount = operationsInRange.filter(op => op.success).length;
    report += `- Success rate: ${((successCount / operationsInRange.length) * 100).toFixed(1)}%\n`;

    // User activity
    const userActivity = operationsInRange.reduce((acc, op) => {
      acc[op.userId] = (acc[op.userId] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    report += `\n## User Activity\n`;
    for (const [userId, count] of Object.entries(userActivity)) {
      const user = this.accessControl.getUser(userId);
      report += `- ${user?.username || userId}: ${count} operations\n`;
    }

    // Add vault audit report
    const vaultReport = await this.vaultManager.generateAuditReport(startDate, endDate);
    report += `\n${vaultReport}`;

    // Add access control audit report
    const accessReport = this.accessControl.generateAuditReport(startDate, endDate);
    report += `\n${accessReport}`;

    // Add rotation report
    const rotationReport = this.rotationManager.generateRotationReport(startDate, endDate);
    report += `\n${rotationReport}`;

    return report;
  }

  /**
   * Get system health status
   */
  async getHealthStatus(): Promise<{
    vault: 'healthy' | 'unhealthy';
    accessControl: 'healthy' | 'unhealthy';
    rotation: 'healthy' | 'unhealthy';
    dueRotations: number;
    pendingNotifications: number;
  }> {
    const dueRotations = await this.rotationManager.checkRotationNeeded();
    const pendingNotifications = this.rotationManager.getPendingNotifications().length;

    return {
      vault: 'healthy', // In production, check vault connectivity
      accessControl: 'healthy', // In production, check access control system
      rotation: 'healthy', // In production, check rotation system
      dueRotations: dueRotations.length,
      pendingNotifications
    };
  }

  // Access control delegation methods

  createUser(user: Omit<User, 'id' | 'created' | 'lastLogin'>): User {
    return this.accessControl.createUser(user);
  }

  updateUserRoles(userId: string, roles: string[]): User {
    return this.accessControl.updateUserRoles(userId, roles);
  }

  createRole(role: Omit<Role, 'id' | 'created' | 'lastModified'>): Role {
    return this.accessControl.createRole(role);
  }

  listUsers(): User[] {
    return this.accessControl.listUsers();
  }

  listRoles(): Role[] {
    return this.accessControl.listRoles();
  }

  // Private helper methods

  private async initializeDefaultUsers(): Promise<void> {
    console.log('👥 Initializing default users...');

    // Create admin user
    const adminUser = this.accessControl.createUser({
      username: 'admin',
      email: 'admin@yieldsensei.com',
      roles: ['admin'],
      environment: 'all',
      isActive: true,
      metadata: { type: 'system' }
    });

    // Create developer user
    const developerUser = this.accessControl.createUser({
      username: 'developer',
      email: 'developer@yieldsensei.com',
      roles: ['developer'],
      environment: 'development',
      isActive: true,
      metadata: { type: 'system' }
    });

    console.log(`✅ Created default users: ${adminUser.username}, ${developerUser.username}`);
  }

  private logOperation(operation: SecretOperation): void {
    this.operationLog.push(operation);
    
    // Keep only last 1000 operations to prevent memory issues
    if (this.operationLog.length > 1000) {
      this.operationLog = this.operationLog.slice(-1000);
    }

    // In production, this would write to a secure audit log
    if (this.config.auditLogging.enabled) {
      console.log(`📝 Operation logged: ${operation.action} ${operation.secretName} by ${operation.userId}`);
    }
  }
} 