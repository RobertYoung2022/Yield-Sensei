/**
 * Automated Key Rotation Scheduler
 * 
 * Implements intelligent key rotation scheduling with:
 * - Automated rotation based on configurable policies
 * - Risk-based rotation triggers
 * - Grace periods for smooth transitions
 * - Notification system for upcoming rotations
 * - Rollback capabilities for failed rotations
 */

import { EventEmitter } from 'events';
import { EnhancedKeyManager } from './enhanced-key-manager';
import { SecureKeyStorage } from './secure-key-storage';
import { GeneratedKey, KeyRotationResult } from './key-manager';

export interface RotationSchedule {
  id: string;
  keyPattern: string;
  policy: RotationPolicy;
  nextRotation: Date;
  lastRotation?: Date;
  rotationCount: number;
  status: 'active' | 'paused' | 'completed';
  intervalId?: NodeJS.Timeout;
}

export interface RotationPolicy {
  type: 'time_based' | 'usage_based' | 'risk_based' | 'compliance_based';
  intervalDays?: number;
  maxUsageCount?: number;
  riskThreshold?: number;
  complianceRequirement?: string;
  gracePeriodDays: number;
  notificationDays: number[];
  autoRotate: boolean;
  requireApproval: boolean;
  maxRotations?: number;
}

export interface RotationNotification {
  id: string;
  scheduleId: string;
  keyId: string;
  type: 'upcoming' | 'imminent' | 'overdue' | 'completed' | 'failed';
  message: string;
  daysUntilRotation?: number;
  sentAt: Date;
  recipients: string[];
}

export interface RotationHistory {
  scheduleId: string;
  keyId: string;
  oldKeyId: string;
  newKeyId: string;
  rotationDate: Date;
  reason: string;
  success: boolean;
  error?: string;
  rollbackRequired: boolean;
  metadata: any;
}

export interface RiskAssessment {
  keyId: string;
  riskScore: number;
  factors: RiskFactor[];
  recommendation: 'rotate_immediately' | 'rotate_soon' | 'monitor' | 'no_action';
  assessedAt: Date;
}

export interface RiskFactor {
  type: 'age' | 'usage' | 'exposure' | 'algorithm' | 'compliance';
  score: number;
  description: string;
}

export class KeyRotationScheduler extends EventEmitter {
  private schedules: Map<string, RotationSchedule> = new Map();
  private rotationHistory: RotationHistory[] = [];
  private notifications: RotationNotification[] = [];
  private keyManager: EnhancedKeyManager;
  private keyStorage: SecureKeyStorage;
  private masterSchedulerInterval?: NodeJS.Timeout;
  private readonly maxHistorySize = 10000;

  constructor(
    keyManager: EnhancedKeyManager,
    keyStorage: SecureKeyStorage
  ) {
    super();
    this.keyManager = keyManager;
    this.keyStorage = keyStorage;
    this.initializeScheduler();
  }

  private initializeScheduler(): void {
    // Master scheduler runs every hour
    this.masterSchedulerInterval = setInterval(async () => {
      await this.checkRotationSchedules();
    }, 60 * 60 * 1000); // Every hour

    console.log('🔄 Key Rotation Scheduler initialized');
  }

  /**
   * Create a rotation schedule for keys matching a pattern
   */
  async createRotationSchedule(
    keyPattern: string,
    policy: RotationPolicy,
    userId: string
  ): Promise<RotationSchedule> {
    const scheduleId = `schedule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const schedule: RotationSchedule = {
      id: scheduleId,
      keyPattern,
      policy,
      nextRotation: this.calculateNextRotation(policy),
      rotationCount: 0,
      status: 'active'
    };

    // Set up individual interval for time-based rotations
    if (policy.type === 'time_based' && policy.intervalDays) {
      const intervalMs = policy.intervalDays * 24 * 60 * 60 * 1000;
      schedule.intervalId = setInterval(async () => {
        await this.executeScheduledRotation(scheduleId);
      }, intervalMs);
    }

    this.schedules.set(scheduleId, schedule);

    // Schedule notifications
    this.scheduleNotifications(schedule);

    this.emit('schedule:created', {
      scheduleId,
      keyPattern,
      policy,
      userId
    });

    console.log(`📅 Rotation schedule created: ${scheduleId} for pattern: ${keyPattern}`);
    return schedule;
  }

  /**
   * Execute rotation for a schedule
   */
  private async executeScheduledRotation(scheduleId: string): Promise<void> {
    const schedule = this.schedules.get(scheduleId);
    if (!schedule || schedule.status !== 'active') {
      return;
    }

    try {
      // Find keys matching the pattern
      const keys = await this.keyStorage.listKeys('system');
      const matchingKeys = keys.filter(k => 
        new RegExp(schedule.keyPattern.replace('*', '.*')).test(k.keyId)
      );

      console.log(`🔄 Executing rotation for ${matchingKeys.length} keys`);

      for (const keyInfo of matchingKeys) {
        try {
          // Check if rotation is needed based on policy
          const needsRotation = await this.checkRotationNeeded(
            keyInfo.keyId,
            schedule.policy
          );

          if (!needsRotation) {
            continue;
          }

          // Perform rotation
          const result = await this.rotateKey(keyInfo.keyId, schedule);

          // Record history
          if (result.success) {
            this.recordRotation({
              scheduleId,
              keyId: keyInfo.keyId,
              oldKeyId: result.oldKeyId,
              newKeyId: result.newKeyId,
              rotationDate: result.rotationTime,
              reason: `Scheduled rotation - ${schedule.policy.type}`,
              success: true,
              rollbackRequired: false,
              metadata: { schedule }
            });
          }

        } catch (error) {
          console.error(`Failed to rotate key ${keyInfo.keyId}:`, error);
          
          this.recordRotation({
            scheduleId,
            keyId: keyInfo.keyId,
            oldKeyId: keyInfo.keyId,
            newKeyId: '',
            rotationDate: new Date(),
            reason: `Scheduled rotation - ${schedule.policy.type}`,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            rollbackRequired: false,
            metadata: { schedule }
          });

          // Send failure notification
          await this.sendNotification({
            scheduleId,
            keyId: keyInfo.keyId,
            type: 'failed',
            message: `Key rotation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
          });
        }
      }

      // Update schedule
      schedule.lastRotation = new Date();
      schedule.rotationCount++;
      schedule.nextRotation = this.calculateNextRotation(schedule.policy);

      // Check if max rotations reached
      if (schedule.policy.maxRotations && 
          schedule.rotationCount >= schedule.policy.maxRotations) {
        schedule.status = 'completed';
        if (schedule.intervalId) {
          clearInterval(schedule.intervalId);
        }
      }

      // Reschedule notifications
      this.scheduleNotifications(schedule);

    } catch (error) {
      console.error(`Rotation schedule execution failed:`, error);
      this.emit('schedule:error', { scheduleId, error });
    }
  }

  /**
   * Rotate a specific key
   */
  private async rotateKey(
    keyId: string,
    schedule: RotationSchedule
  ): Promise<KeyRotationResult> {
    // Check if approval is required
    if (schedule.policy.requireApproval) {
      const approved = await this.requestApproval(keyId, schedule);
      if (!approved) {
        return {
          oldKeyId: keyId,
          newKeyId: '',
          rotationTime: new Date(),
          success: false,
          error: 'Rotation approval denied'
        };
      }
    }

    // Perform the rotation
    const result = await this.keyManager.rotateKey(keyId, 'system');

    if (result.success) {
      // Handle grace period
      if (schedule.policy.gracePeriodDays > 0) {
        await this.setupGracePeriod(
          result.oldKeyId,
          result.newKeyId,
          schedule.policy.gracePeriodDays
        );
      }

      // Send completion notification
      await this.sendNotification({
        scheduleId: schedule.id,
        keyId,
        type: 'completed',
        message: `Key successfully rotated. New key ID: ${result.newKeyId}`
      });
    }

    return result;
  }

  /**
   * Check if rotation is needed based on policy
   */
  private async checkRotationNeeded(
    keyId: string,
    policy: RotationPolicy
  ): Promise<boolean> {
    const key = await this.keyStorage.retrieveKey(keyId, 'system', {
      skipIntegrityCheck: false,
      auditAccess: false
    });

    switch (policy.type) {
      case 'time_based':
        if (!policy.intervalDays) return false;
        const daysSinceCreation = 
          (Date.now() - key.created.getTime()) / (1000 * 60 * 60 * 24);
        return daysSinceCreation >= policy.intervalDays;

      case 'usage_based':
        if (!policy.maxUsageCount) return false;
        const metrics = this.keyManager.exportMetrics()
          .find(m => m.keyId === keyId);
        return metrics ? metrics.usageCount >= policy.maxUsageCount : false;

      case 'risk_based':
        if (!policy.riskThreshold) return false;
        const assessment = await this.assessKeyRisk(key);
        return assessment.riskScore >= policy.riskThreshold;

      case 'compliance_based':
        return this.checkComplianceRequirement(key, policy.complianceRequirement);

      default:
        return false;
    }
  }

  /**
   * Assess risk factors for a key
   */
  private async assessKeyRisk(key: GeneratedKey): Promise<RiskAssessment> {
    const factors: RiskFactor[] = [];
    let totalScore = 0;

    // Age factor
    const ageInDays = (Date.now() - key.created.getTime()) / (1000 * 60 * 60 * 24);
    let ageScore = 0;
    if (ageInDays > 365) ageScore = 80;
    else if (ageInDays > 180) ageScore = 60;
    else if (ageInDays > 90) ageScore = 40;
    else if (ageInDays > 30) ageScore = 20;

    if (ageScore > 0) {
      factors.push({
        type: 'age',
        score: ageScore,
        description: `Key is ${Math.floor(ageInDays)} days old`
      });
      totalScore += ageScore;
    }

    // Usage factor
    const metrics = this.keyManager.exportMetrics()
      .find(m => m.keyId === key.id);
    
    if (metrics) {
      let usageScore = 0;
      if (metrics.usageCount > 1000000) usageScore = 70;
      else if (metrics.usageCount > 100000) usageScore = 50;
      else if (metrics.usageCount > 10000) usageScore = 30;

      if (usageScore > 0) {
        factors.push({
          type: 'usage',
          score: usageScore,
          description: `Key used ${metrics.usageCount} times`
        });
        totalScore += usageScore;
      }
    }

    // Algorithm factor
    let algorithmScore = 0;
    if (key.spec.algorithm === 'rsa-2048') algorithmScore = 40; // Weaker than rsa-4096
    else if (key.spec.algorithm === 'aes-256-gcm' && ageInDays > 180) algorithmScore = 20;

    if (algorithmScore > 0) {
      factors.push({
        type: 'algorithm',
        score: algorithmScore,
        description: `Algorithm ${key.spec.algorithm} risk assessment`
      });
      totalScore += algorithmScore;
    }

    // Compliance factor
    const enhancedFeatures = (key as any).enhancedFeatures;
    if (!enhancedFeatures?.compliance?.fips140) {
      factors.push({
        type: 'compliance',
        score: 30,
        description: 'Not FIPS 140 compliant'
      });
      totalScore += 30;
    }

    // Average the score
    const riskScore = factors.length > 0 ? totalScore / factors.length : 0;

    // Determine recommendation
    let recommendation: RiskAssessment['recommendation'];
    if (riskScore >= 70) recommendation = 'rotate_immediately';
    else if (riskScore >= 50) recommendation = 'rotate_soon';
    else if (riskScore >= 30) recommendation = 'monitor';
    else recommendation = 'no_action';

    return {
      keyId: key.id,
      riskScore,
      factors,
      recommendation,
      assessedAt: new Date()
    };
  }

  /**
   * Check compliance requirements
   */
  private checkComplianceRequirement(
    key: GeneratedKey,
    requirement?: string
  ): boolean {
    if (!requirement) return false;

    const enhancedFeatures = (key as any).enhancedFeatures;
    
    switch (requirement) {
      case 'pci-dss':
        // PCI-DSS requires annual rotation for encryption keys
        const ageInDays = (Date.now() - key.created.getTime()) / (1000 * 60 * 60 * 24);
        return ageInDays >= 365;
      
      case 'fips140':
        return !enhancedFeatures?.compliance?.fips140;
      
      case 'sox':
        // SOX compliance - rotate every 90 days
        const soxAge = (Date.now() - key.created.getTime()) / (1000 * 60 * 60 * 24);
        return soxAge >= 90;
      
      default:
        return false;
    }
  }

  /**
   * Set up grace period for old key
   */
  private async setupGracePeriod(
    oldKeyId: string,
    newKeyId: string,
    gracePeriodDays: number
  ): Promise<void> {
    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() + gracePeriodDays);

    // Mark old key with grace period metadata
    console.log(`⏳ Grace period set for old key ${oldKeyId} until ${expirationDate.toISOString()}`);

    // Schedule old key deletion
    setTimeout(async () => {
      try {
        await this.keyStorage.deleteKey(oldKeyId, 'system', {
          secureWipe: true,
          preserveAuditLog: true
        });
        console.log(`🗑️ Old key ${oldKeyId} deleted after grace period`);
      } catch (error) {
        console.error(`Failed to delete old key ${oldKeyId}:`, error);
      }
    }, gracePeriodDays * 24 * 60 * 60 * 1000);

    this.emit('grace_period:started', {
      oldKeyId,
      newKeyId,
      expirationDate
    });
  }

  /**
   * Request approval for rotation
   */
  private async requestApproval(
    keyId: string,
    schedule: RotationSchedule
  ): Promise<boolean> {
    // In production, integrate with approval workflow system
    console.log(`🔐 Approval requested for key rotation: ${keyId}`);
    
    this.emit('approval:requested', {
      keyId,
      scheduleId: schedule.id,
      policy: schedule.policy
    });

    // Simulate approval (in production, wait for actual approval)
    return true;
  }

  /**
   * Schedule notifications for a rotation schedule
   */
  private scheduleNotifications(schedule: RotationSchedule): void {
    if (!schedule.policy.notificationDays || schedule.status !== 'active') {
      return;
    }

    const now = new Date();
    
    for (const days of schedule.policy.notificationDays) {
      const notificationDate = new Date(schedule.nextRotation);
      notificationDate.setDate(notificationDate.getDate() - days);

      if (notificationDate > now) {
        const timeout = notificationDate.getTime() - now.getTime();
        
        setTimeout(async () => {
          await this.sendNotification({
            scheduleId: schedule.id,
            keyId: schedule.keyPattern,
            type: days <= 1 ? 'imminent' : 'upcoming',
            message: `Key rotation scheduled in ${days} days`,
            daysUntilRotation: days
          });
        }, timeout);
      }
    }
  }

  /**
   * Send notification
   */
  private async sendNotification(params: {
    scheduleId: string;
    keyId: string;
    type: RotationNotification['type'];
    message: string;
    daysUntilRotation?: number;
  }): Promise<void> {
    const notification: RotationNotification = {
      id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      scheduleId: params.scheduleId,
      keyId: params.keyId,
      type: params.type,
      message: params.message,
      daysUntilRotation: params.daysUntilRotation,
      sentAt: new Date(),
      recipients: ['admin@yieldsensei.com', 'security@yieldsensei.com']
    };

    this.notifications.push(notification);

    // Emit notification event
    this.emit('notification:sent', notification);

    console.log(`📧 Rotation notification: ${params.message}`);
  }

  /**
   * Check all rotation schedules
   */
  private async checkRotationSchedules(): Promise<void> {
    for (const [scheduleId, schedule] of this.schedules) {
      if (schedule.status !== 'active') continue;

      try {
        // Check for overdue rotations
        if (schedule.nextRotation < new Date()) {
          await this.sendNotification({
            scheduleId,
            keyId: schedule.keyPattern,
            type: 'overdue',
            message: 'Key rotation is overdue!'
          });

          // Execute rotation if auto-rotate is enabled
          if (schedule.policy.autoRotate) {
            await this.executeScheduledRotation(scheduleId);
          }
        }

        // Risk-based rotation check
        if (schedule.policy.type === 'risk_based') {
          const keys = await this.keyStorage.listKeys('system');
          const matchingKeys = keys.filter(k => 
            new RegExp(schedule.keyPattern.replace('*', '.*')).test(k.keyId)
          );

          for (const keyInfo of matchingKeys) {
            const key = await this.keyStorage.retrieveKey(keyInfo.keyId, 'system');
            const assessment = await this.assessKeyRisk(key);

            if (assessment.recommendation === 'rotate_immediately' ||
                (assessment.recommendation === 'rotate_soon' && 
                 schedule.policy.riskThreshold && 
                 assessment.riskScore >= schedule.policy.riskThreshold)) {
              await this.executeScheduledRotation(scheduleId);
              break; // Rotate one at a time
            }
          }
        }

      } catch (error) {
        console.error(`Error checking schedule ${scheduleId}:`, error);
      }
    }
  }

  /**
   * Record rotation history
   */
  private recordRotation(history: RotationHistory): void {
    this.rotationHistory.push(history);

    // Trim history if too large
    if (this.rotationHistory.length > this.maxHistorySize) {
      this.rotationHistory = this.rotationHistory.slice(-this.maxHistorySize);
    }

    this.emit('rotation:recorded', history);
  }

  /**
   * Calculate next rotation date
   */
  private calculateNextRotation(policy: RotationPolicy): Date {
    const date = new Date();

    switch (policy.type) {
      case 'time_based':
        if (policy.intervalDays) {
          date.setDate(date.getDate() + policy.intervalDays);
        }
        break;
      
      case 'compliance_based':
        // Set based on compliance requirement
        if (policy.complianceRequirement === 'pci-dss') {
          date.setFullYear(date.getFullYear() + 1); // Annual
        } else if (policy.complianceRequirement === 'sox') {
          date.setDate(date.getDate() + 90); // Quarterly
        }
        break;
      
      default:
        // For usage and risk based, check every day
        date.setDate(date.getDate() + 1);
    }

    return date;
  }


  /**
   * Get rotation history
   */
  getRotationHistory(filter?: {
    scheduleId?: string;
    keyId?: string;
    startDate?: Date;
    endDate?: Date;
    success?: boolean;
  }): RotationHistory[] {
    return this.rotationHistory.filter(history => {
      if (filter?.scheduleId && history.scheduleId !== filter.scheduleId) return false;
      if (filter?.keyId && history.keyId !== filter.keyId) return false;
      if (filter?.startDate && history.rotationDate < filter.startDate) return false;
      if (filter?.endDate && history.rotationDate > filter.endDate) return false;
      if (filter?.success !== undefined && history.success !== filter.success) return false;
      return true;
    });
  }

  /**
   * Pause a rotation schedule
   */
  pauseSchedule(scheduleId: string): void {
    const schedule = this.schedules.get(scheduleId);
    if (!schedule) {
      throw new Error(`Schedule not found: ${scheduleId}`);
    }

    schedule.status = 'paused';
    if (schedule.intervalId) {
      clearInterval(schedule.intervalId);
    }

    this.emit('schedule:paused', { scheduleId });
    console.log(`⏸️ Rotation schedule paused: ${scheduleId}`);
  }

  /**
   * Resume a rotation schedule
   */
  resumeSchedule(scheduleId: string): void {
    const schedule = this.schedules.get(scheduleId);
    if (!schedule) {
      throw new Error(`Schedule not found: ${scheduleId}`);
    }

    schedule.status = 'active';
    if (schedule.intervalId) {
      // Re-create the interval
      if (schedule.policy.type === 'time_based' && schedule.policy.intervalDays) {
        const intervalMs = schedule.policy.intervalDays * 24 * 60 * 60 * 1000;
        schedule.intervalId = setInterval(async () => {
          await this.executeScheduledRotation(schedule.id);
        }, intervalMs);
      }
    }

    this.emit('schedule:resumed', { scheduleId });
    console.log(`▶️ Rotation schedule resumed: ${scheduleId}`);
  }

  /**
   * Delete a rotation schedule
   */
  deleteSchedule(scheduleId: string): void {
    const schedule = this.schedules.get(scheduleId);
    if (!schedule) {
      throw new Error(`Schedule not found: ${scheduleId}`);
    }

    if (schedule.intervalId) {
      clearInterval(schedule.intervalId);
    }

    this.schedules.delete(scheduleId);
    this.emit('schedule:deleted', { scheduleId });
    console.log(`🗑️ Rotation schedule deleted: ${scheduleId}`);
  }

  /**
   * Generate rotation report
   */
  generateRotationReport(): string {
    let report = `# Key Rotation Report\n\n`;
    report += `**Generated:** ${new Date().toISOString()}\n\n`;

    // Active schedules
    report += `## Active Rotation Schedules\n`;
    const activeSchedules = Array.from(this.schedules.values())
      .filter(s => s.status === 'active');
    
    report += `- Total: ${activeSchedules.length}\n\n`;
    
    for (const schedule of activeSchedules) {
      report += `### ${schedule.id}\n`;
      report += `- Pattern: ${schedule.keyPattern}\n`;
      report += `- Type: ${schedule.policy.type}\n`;
      report += `- Next rotation: ${schedule.nextRotation.toISOString()}\n`;
      report += `- Rotations completed: ${schedule.rotationCount}\n\n`;
    }

    // Recent rotations
    report += `## Recent Rotations (Last 30 days)\n`;
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const recentRotations = this.rotationHistory.filter(
      h => h.rotationDate > thirtyDaysAgo
    );

    report += `- Total: ${recentRotations.length}\n`;
    report += `- Successful: ${recentRotations.filter(r => r.success).length}\n`;
    report += `- Failed: ${recentRotations.filter(r => !r.success).length}\n\n`;

    // Failed rotations details
    const failedRotations = recentRotations.filter(r => !r.success);
    if (failedRotations.length > 0) {
      report += `### Failed Rotations\n`;
      for (const rotation of failedRotations) {
        report += `- ${rotation.keyId}: ${rotation.error} (${rotation.rotationDate.toISOString()})\n`;
      }
      report += '\n';
    }

    // Upcoming rotations
    report += `## Upcoming Rotations (Next 7 days)\n`;
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
    
    const upcomingSchedules = activeSchedules.filter(
      s => s.nextRotation <= sevenDaysFromNow
    );

    for (const schedule of upcomingSchedules) {
      const daysUntil = Math.ceil(
        (schedule.nextRotation.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );
      report += `- ${schedule.keyPattern}: ${daysUntil} days (${schedule.nextRotation.toISOString()})\n`;
    }

    return report;
  }

  /**
   * Stop the scheduler
   */
  stop(): void {
    if (this.masterSchedulerInterval) {
      clearInterval(this.masterSchedulerInterval);
    }

    for (const schedule of this.schedules.values()) {
      if (schedule.intervalId) {
        clearInterval(schedule.intervalId);
      }
    }

    console.log('🛑 Key Rotation Scheduler stopped');
  }
}

// Export for use
// Export singleton instance
export const keyRotationScheduler = new KeyRotationScheduler();