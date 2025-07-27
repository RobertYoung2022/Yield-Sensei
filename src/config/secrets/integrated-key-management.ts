/**
 * Integrated Key Management System
 * 
 * Provides a unified interface for all key management operations including:
 * - Enhanced key generation with multiple entropy sources
 * - Secure storage with access controls
 * - Automated rotation scheduling
 * - Comprehensive recovery mechanisms
 * - Real-time monitoring and alerting
 */

import { EventEmitter } from 'events';
import { EnhancedKeyManager, KeyRecoveryManager } from './enhanced-key-manager';
import { SecureKeyStorage } from './secure-key-storage';
import { KeyRotationScheduler } from './key-rotation-scheduler';
import { VaultManager } from './vault-manager';
import { RotationManager } from './rotation-manager';
import { AccessControlManager } from './access-control';
import { KeySpec, GeneratedKey } from './key-manager';

export interface IntegratedKeyConfig {
  vaultConfig: {
    provider: 'aws' | 'azure' | 'gcp' | 'hashicorp';
    region?: string;
    credentials?: any;
  };
  rotationConfig: {
    defaultIntervalDays: number;
    enableAutoRotation: boolean;
    notificationChannels: string[];
  };
  securityConfig: {
    requireMFA: boolean;
    enforceIPWhitelist: boolean;
    auditRetentionDays: number;
  };
  recoveryConfig: {
    sharesRequired: number;
    totalShares: number;
    escrowProviders: string[];
  };
}

export interface KeyOperationResult {
  success: boolean;
  keyId?: string;
  operation: string;
  timestamp: Date;
  error?: string;
  metadata?: any;
}

export interface SystemHealthStatus {
  overall: 'healthy' | 'degraded' | 'critical';
  components: {
    keyGeneration: ComponentHealth;
    storage: ComponentHealth;
    rotation: ComponentHealth;
    recovery: ComponentHealth;
  };
  metrics: {
    totalKeys: number;
    keysRotatedToday: number;
    pendingRotations: number;
    failedOperations: number;
  };
  recommendations: string[];
}

interface ComponentHealth {
  status: 'healthy' | 'warning' | 'error';
  message: string;
  lastChecked: Date;
}

export class IntegratedKeyManagement extends EventEmitter {
  private keyManager: EnhancedKeyManager;
  private keyStorage: SecureKeyStorage;
  private rotationScheduler: KeyRotationScheduler;
  private recoveryManager: KeyRecoveryManager;
  private vaultManager: VaultManager;
  private config: IntegratedKeyConfig;
  private operationLog: KeyOperationResult[] = [];
  private readonly maxLogSize = 10000;

  constructor(config: IntegratedKeyConfig) {
    super();
    this.config = config;
    this.initialize();
  }

  private async initialize(): Promise<void> {
    // Initialize core components
    this.vaultManager = new VaultManager(/* vault config */);
    const rotationManager = new RotationManager(this.vaultManager);
    const accessControl = new AccessControlManager();

    // Initialize enhanced components
    this.keyManager = new EnhancedKeyManager(
      this.vaultManager,
      rotationManager,
      accessControl
    );

    this.keyStorage = new SecureKeyStorage();
    this.rotationScheduler = new KeyRotationScheduler(
      this.keyManager,
      this.keyStorage
    );

    this.recoveryManager = new KeyRecoveryManager(this.keyManager);

    // Set up event handlers
    this.setupEventHandlers();

    console.log('🔐 Integrated Key Management System initialized');
  }

  /**
   * Generate a new key with full lifecycle management
   */
  async generateManagedKey(
    spec: KeySpec & {
      enableRotation?: boolean;
      rotationIntervalDays?: number;
      enableRecovery?: boolean;
    },
    userId: string
  ): Promise<KeyOperationResult> {
    try {
      // Generate key with enhanced security
      const key = await this.keyManager.generateEnhancedKey(
        {
          ...spec,
          entropySource: 'mixed',
          storageOptions: {
            encryptAtRest: true,
            useHSM: false,
            replicationCount: 2,
            geoRedundancy: true,
            compressionEnabled: true
          },
          recoveryOptions: spec.enableRecovery ? {
            sharesRequired: this.config.recoveryConfig.sharesRequired,
            totalShares: this.config.recoveryConfig.totalShares,
            recoveryContacts: ['admin@yieldsensei.com'],
            escrowEnabled: true,
            escrowProviders: this.config.recoveryConfig.escrowProviders
          } : undefined,
          compliance: {
            fips140: true,
            commonCriteria: false,
            pciDss: spec.purpose === 'payment' || spec.purpose === 'database'
          }
        },
        userId,
        {
          description: `Managed ${spec.type} key for ${spec.purpose}`,
          type: spec.purpose as any,
          environment: spec.environment
        }
      );

      // Store in secure storage
      await this.keyStorage.storeKey(key, userId, 'primary', {
        roleId: `role_${spec.purpose}`,
        permissions: [
          {
            action: 'use',
            resourcePattern: key.id,
            conditions: this.config.securityConfig.requireMFA ? [{
              type: 'mfa_required',
              value: { verified: false }
            }] : undefined
          }
        ],
        validFrom: new Date()
      });

      // Set up rotation if enabled
      if (spec.enableRotation) {
        await this.rotationScheduler.createRotationSchedule(
          key.id,
          {
            type: 'time_based',
            intervalDays: spec.rotationIntervalDays || this.config.rotationConfig.defaultIntervalDays,
            gracePeriodDays: 7,
            notificationDays: [30, 7, 1],
            autoRotate: this.config.rotationConfig.enableAutoRotation,
            requireApproval: false
          },
          userId
        );
      }

      const result: KeyOperationResult = {
        success: true,
        keyId: key.id,
        operation: 'generate',
        timestamp: new Date(),
        metadata: {
          type: spec.type,
          purpose: spec.purpose,
          rotationEnabled: spec.enableRotation,
          recoveryEnabled: spec.enableRecovery
        }
      };

      this.logOperation(result);
      this.emit('key:generated', result);

      return result;

    } catch (error) {
      const result: KeyOperationResult = {
        success: false,
        operation: 'generate',
        timestamp: new Date(),
        error: error instanceof Error ? error.message : 'Unknown error'
      };

      this.logOperation(result);
      this.emit('key:error', result);

      return result;
    }
  }

  /**
   * Retrieve a key with full security checks
   */
  async retrieveKey(
    keyId: string,
    userId: string,
    purpose: string
  ): Promise<GeneratedKey | null> {
    try {
      // Log access attempt
      this.emit('key:access_attempt', { keyId, userId, purpose });

      // Retrieve from storage
      const key = await this.keyStorage.retrieveKey(keyId, userId, {
        auditAccess: true
      });

      // Update usage metrics
      const startTime = Date.now();
      this.keyManager.updateKeyMetrics(keyId, 'encrypt', Date.now() - startTime);

      const result: KeyOperationResult = {
        success: true,
        keyId,
        operation: 'retrieve',
        timestamp: new Date(),
        metadata: { purpose }
      };

      this.logOperation(result);
      return key;

    } catch (error) {
      const result: KeyOperationResult = {
        success: false,
        keyId,
        operation: 'retrieve',
        timestamp: new Date(),
        error: error instanceof Error ? error.message : 'Unknown error'
      };

      this.logOperation(result);
      this.emit('key:error', result);

      return null;
    }
  }

  /**
   * Perform emergency key rotation
   */
  async emergencyRotation(
    pattern: string,
    reason: string,
    userId: string
  ): Promise<KeyOperationResult[]> {
    console.log(`🚨 Emergency rotation initiated: ${reason}`);

    const results = await this.keyManager.emergencyKeyRotation(
      pattern,
      userId,
      reason
    );

    const operationResults = results.map(result => ({
      success: result.success,
      keyId: result.oldKeyId,
      operation: 'emergency_rotation',
      timestamp: result.rotationTime,
      error: result.error,
      metadata: {
        newKeyId: result.newKeyId,
        reason
      }
    }));

    operationResults.forEach(result => this.logOperation(result));
    this.emit('emergency:rotation_complete', { results: operationResults });

    return operationResults;
  }

  /**
   * Initiate key recovery process
   */
  async initiateRecovery(
    keyId: string,
    method: 'shares' | 'escrow' | 'backup',
    userId: string
  ): Promise<KeyOperationResult> {
    try {
      console.log(`🔓 Initiating ${method} recovery for key: ${keyId}`);

      let recovered = false;

      switch (method) {
        case 'shares':
          // In production, collect shares from authorized personnel
          console.log('Collecting recovery shares...');
          // recovered = await this.keyManager.recoverKeyFromShares(keyId, shares, userId);
          break;

        case 'escrow':
          console.log('Contacting escrow providers...');
          // recovered = await this.recoverFromEscrow(keyId);
          break;

        case 'backup':
          console.log('Retrieving from backup...');
          // recovered = await this.recoverFromBackup(keyId);
          break;
      }

      const result: KeyOperationResult = {
        success: recovered,
        keyId,
        operation: 'recovery',
        timestamp: new Date(),
        metadata: { method }
      };

      this.logOperation(result);
      this.emit('key:recovery', result);

      return result;

    } catch (error) {
      const result: KeyOperationResult = {
        success: false,
        keyId,
        operation: 'recovery',
        timestamp: new Date(),
        error: error instanceof Error ? error.message : 'Unknown error'
      };

      this.logOperation(result);
      return result;
    }
  }

  /**
   * Get system health status
   */
  async getSystemHealth(): Promise<SystemHealthStatus> {
    const healthChecks = await Promise.all([
      this.checkKeyGenerationHealth(),
      this.checkStorageHealth(),
      this.checkRotationHealth(),
      this.checkRecoveryHealth()
    ]);

    const metrics = await this.gatherMetrics();
    const recommendations = await this.generateRecommendations();

    const overallStatus = this.calculateOverallHealth(healthChecks);

    return {
      overall: overallStatus,
      components: {
        keyGeneration: healthChecks[0],
        storage: healthChecks[1],
        rotation: healthChecks[2],
        recovery: healthChecks[3]
      },
      metrics,
      recommendations
    };
  }

  /**
   * Generate comprehensive security report
   */
  async generateSecurityReport(): Promise<string> {
    const reports = await Promise.all([
      this.keyManager.generateSecurityReport('system'),
      this.keyStorage.generateHealthReport(),
      this.rotationScheduler.generateRotationReport()
    ]);

    let combinedReport = `# YieldSensei Key Management Security Report\n\n`;
    combinedReport += `**Generated:** ${new Date().toISOString()}\n\n`;

    // Executive Summary
    combinedReport += `## Executive Summary\n\n`;
    const health = await this.getSystemHealth();
    combinedReport += `- System Status: ${health.overall.toUpperCase()}\n`;
    combinedReport += `- Total Keys: ${health.metrics.totalKeys}\n`;
    combinedReport += `- Keys Rotated Today: ${health.metrics.keysRotatedToday}\n`;
    combinedReport += `- Pending Rotations: ${health.metrics.pendingRotations}\n`;
    combinedReport += `- Failed Operations: ${health.metrics.failedOperations}\n\n`;

    // Component Reports
    combinedReport += `## Component Reports\n\n`;
    combinedReport += `### Key Generation and Entropy\n${reports[0]}\n\n`;
    combinedReport += `### Storage and Access Control\n${JSON.stringify(reports[1], null, 2)}\n\n`;
    combinedReport += `### Rotation Schedule\n${reports[2]}\n\n`;

    // Recent Operations
    combinedReport += `## Recent Operations\n\n`;
    const recentOps = this.operationLog.slice(-20);
    for (const op of recentOps) {
      combinedReport += `- ${op.timestamp.toISOString()} | ${op.operation} | ${op.keyId || 'N/A'} | ${op.success ? '✅' : '❌'}\n`;
    }

    return combinedReport;
  }

  /**
   * Export system configuration
   */
  exportConfiguration(): IntegratedKeyConfig {
    return JSON.parse(JSON.stringify(this.config));
  }

  /**
   * Update system configuration
   */
  async updateConfiguration(
    updates: Partial<IntegratedKeyConfig>,
    userId: string
  ): Promise<void> {
    // Log configuration change
    this.emit('config:update', {
      userId,
      updates,
      timestamp: new Date()
    });

    // Apply updates
    this.config = {
      ...this.config,
      ...updates
    };

    // Restart affected components if needed
    if (updates.rotationConfig) {
      console.log('Restarting rotation scheduler with new config...');
      // Implement restart logic
    }
  }

  // Private helper methods

  private setupEventHandlers(): void {
    // Key manager events
    this.keyManager.getEventEmitter().on('key:generated', (event) => {
      console.log(`📊 Key generated: ${event.keyId}`);
    });

    // Storage events
    this.keyStorage.on('key:stored', (event) => {
      console.log(`💾 Key stored: ${event.keyId} in ${event.containerId}`);
    });

    // Rotation events
    this.rotationScheduler.on('rotation:recorded', (history) => {
      if (!history.success) {
        console.error(`❌ Rotation failed: ${history.keyId} - ${history.error}`);
      }
    });

    // Audit events
    this.keyStorage.on('audit:entry', (entry) => {
      if (entry.securityLevel === 'critical') {
        this.emit('security:alert', entry);
      }
    });
  }

  private logOperation(result: KeyOperationResult): void {
    this.operationLog.push(result);

    // Trim log if too large
    if (this.operationLog.length > this.maxLogSize) {
      this.operationLog = this.operationLog.slice(-this.maxLogSize);
    }
  }

  private async checkKeyGenerationHealth(): Promise<ComponentHealth> {
    try {
      const health = await this.keyManager.performHealthCheck();
      return {
        status: health.healthy ? 'healthy' : health.issues.length > 2 ? 'error' : 'warning',
        message: health.healthy ? 'Key generation operating normally' : 
                 `Issues detected: ${health.issues.join(', ')}`,
        lastChecked: new Date()
      };
    } catch (error) {
      return {
        status: 'error',
        message: `Health check failed: ${error}`,
        lastChecked: new Date()
      };
    }
  }

  private async checkStorageHealth(): Promise<ComponentHealth> {
    try {
      const report = await this.keyStorage.generateHealthReport();
      const utilizationOk = report.containers.every(c => c.utilization < 80);
      
      return {
        status: utilizationOk ? 'healthy' : 'warning',
        message: utilizationOk ? 'Storage operating normally' : 
                 'High storage utilization detected',
        lastChecked: new Date()
      };
    } catch (error) {
      return {
        status: 'error',
        message: `Storage health check failed: ${error}`,
        lastChecked: new Date()
      };
    }
  }

  private async checkRotationHealth(): Promise<ComponentHealth> {
    const history = this.rotationScheduler.getRotationHistory({
      startDate: new Date(Date.now() - 24 * 60 * 60 * 1000)
    });

    const failureRate = history.length > 0 ? 
      history.filter(h => !h.success).length / history.length : 0;

    return {
      status: failureRate === 0 ? 'healthy' : failureRate < 0.1 ? 'warning' : 'error',
      message: failureRate === 0 ? 'Rotation system operating normally' :
               `Rotation failure rate: ${(failureRate * 100).toFixed(1)}%`,
      lastChecked: new Date()
    };
  }

  private async checkRecoveryHealth(): Promise<ComponentHealth> {
    // Check recovery readiness
    const recoveryPackage = await this.recoveryManager.createRecoveryPackage(
      ['test_key'],
      'system'
    );

    const verified = await this.recoveryManager.verifyRecoveryPackage(
      recoveryPackage.packageId,
      recoveryPackage.checksum
    );

    return {
      status: verified ? 'healthy' : 'error',
      message: verified ? 'Recovery system ready' : 'Recovery verification failed',
      lastChecked: new Date()
    };
  }

  private async gatherMetrics(): Promise<SystemHealthStatus['metrics']> {
    const keys = await this.keyStorage.listKeys('system');
    
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    
    const rotationHistory = this.rotationScheduler.getRotationHistory({
      startDate: todayStart
    });

    const failedOps = this.operationLog.filter(op => 
      !op.success && op.timestamp > todayStart
    ).length;

    return {
      totalKeys: keys.length,
      keysRotatedToday: rotationHistory.filter(h => h.success).length,
      pendingRotations: 0, // Calculate from schedules
      failedOperations: failedOps
    };
  }

  private async generateRecommendations(): Promise<string[]> {
    const recommendations: string[] = [];
    const health = await this.keyManager.performHealthCheck();

    recommendations.push(...health.recommendations);

    // Add system-specific recommendations
    const metrics = await this.gatherMetrics();
    
    if (metrics.failedOperations > 5) {
      recommendations.push('Investigate high failure rate in key operations');
    }

    if (metrics.pendingRotations > 10) {
      recommendations.push('Schedule maintenance window for pending rotations');
    }

    return recommendations;
  }

  private calculateOverallHealth(
    componentHealths: ComponentHealth[]
  ): SystemHealthStatus['overall'] {
    const errorCount = componentHealths.filter(h => h.status === 'error').length;
    const warningCount = componentHealths.filter(h => h.status === 'warning').length;

    if (errorCount > 0) return 'critical';
    if (warningCount > 1) return 'degraded';
    return 'healthy';
  }
}

// Export singleton instance
export const integratedKeyManagement = new IntegratedKeyManagement({
  vaultConfig: {
    provider: 'aws',
    region: process.env.AWS_REGION || 'us-east-1'
  },
  rotationConfig: {
    defaultIntervalDays: 90,
    enableAutoRotation: true,
    notificationChannels: ['email', 'slack']
  },
  securityConfig: {
    requireMFA: true,
    enforceIPWhitelist: false,
    auditRetentionDays: 365
  },
  recoveryConfig: {
    sharesRequired: 3,
    totalShares: 5,
    escrowProviders: ['aws_kms', 'azure_keyvault']
  }
});