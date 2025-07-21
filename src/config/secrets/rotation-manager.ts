/**
 * Secret Rotation Manager
 * 
 * Manages automatic and manual secret rotation with policies,
 * scheduling, notifications, and audit logging.
 */

import { VaultManager, SecretMetadata, RotationPolicy } from './vault-manager';
import { AccessControlManager } from './access-control';

export interface RotationSchedule {
  id: string;
  secretName: string;
  policy: RotationPolicy;
  nextRotation: Date;
  lastRotation: Date;
  status: 'scheduled' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
  created: Date;
  updated: Date;
}

export interface RotationNotification {
  id: string;
  secretName: string;
  type: 'scheduled' | 'due' | 'overdue' | 'completed' | 'failed';
  message: string;
  recipients: string[];
  sent: Date;
  read: boolean;
}

export interface RotationResult {
  success: boolean;
  secretName: string;
  oldVersion: string;
  newVersion: string;
  rotatedAt: Date;
  rotatedBy: string;
  error?: string;
  auditTrail: string[];
}

export class RotationManager {
  private vaultManager: VaultManager;
  private accessControl: AccessControlManager;
  private schedules: Map<string, RotationSchedule> = new Map();
  private notifications: RotationNotification[] = [];

  constructor(vaultManager: VaultManager, accessControl: AccessControlManager) {
    this.vaultManager = vaultManager;
    this.accessControl = accessControl;
  }

  /**
   * Schedule automatic rotation for a secret
   */
  async scheduleRotation(
    secretName: string,
    policy: RotationPolicy,
    userId: string
  ): Promise<RotationSchedule> {
    // Check if user has rotation permissions
    const permission = this.accessControl.checkPermission(userId, 'rotation', 'write');
    if (!permission.granted) {
      throw new Error(`Access denied: ${permission.reason}`);
    }

    const scheduleId = this.generateScheduleId(secretName);
    const now = new Date();
    const nextRotation = this.calculateNextRotation(now, policy.intervalDays);

    const schedule: RotationSchedule = {
      id: scheduleId,
      secretName,
      policy,
      nextRotation,
      lastRotation: now,
      status: 'scheduled',
      created: now,
      updated: now
    };

    this.schedules.set(scheduleId, schedule);
    
    console.log(`📅 Rotation scheduled: ${secretName} (${scheduleId})`);
    return schedule;
  }

  /**
   * Manually rotate a secret
   */
  async rotateSecret(
    secretName: string,
    newValue: string,
    userId: string
  ): Promise<RotationResult> {
    const auditTrail: string[] = [];
    auditTrail.push(`Manual rotation initiated by user: ${userId}`);

    try {
      // Check if user has rotation permissions
      const permission = this.accessControl.checkPermission(userId, 'secret', 'rotate');
      if (!permission.granted) {
        throw new Error(`Access denied: ${permission.reason}`);
      }

      auditTrail.push('Permission check passed');

      // Get current secret to get old version
      const currentSecret = await this.vaultManager.getSecret(secretName, userId);
      const oldVersion = 'current'; // In a real implementation, we'd track versions

      // Rotate the secret
      const rotatedSecret = await this.vaultManager.rotateSecret(secretName, newValue, userId);
      
      auditTrail.push(`Secret rotated successfully to version: ${rotatedSecret.version}`);

      // Update rotation schedule if it exists
      const schedule = this.findScheduleBySecretName(secretName);
      if (schedule) {
        schedule.lastRotation = new Date();
        schedule.nextRotation = this.calculateNextRotation(new Date(), schedule.policy.intervalDays);
        schedule.status = 'completed';
        schedule.updated = new Date();
        auditTrail.push('Rotation schedule updated');
      }

      // Create notification
      await this.createNotification(secretName, 'completed', userId, auditTrail);

      const result: RotationResult = {
        success: true,
        secretName,
        oldVersion,
        newVersion: rotatedSecret.version,
        rotatedAt: new Date(),
        rotatedBy: userId,
        auditTrail
      };

      console.log(`🔄 Secret rotated manually: ${secretName}`);
      return result;

    } catch (error) {
      auditTrail.push(`Rotation failed: ${error}`);
      
      // Create failure notification
      await this.createNotification(secretName, 'failed', userId, auditTrail);

      const result: RotationResult = {
        success: false,
        secretName,
        oldVersion: 'unknown',
        newVersion: 'none',
        rotatedAt: new Date(),
        rotatedBy: userId,
        error: error instanceof Error ? error.message : 'Unknown error',
        auditTrail
      };

      console.error(`❌ Secret rotation failed: ${secretName}`, error);
      return result;
    }
  }

  /**
   * Check for secrets that need rotation
   */
  async checkRotationNeeded(): Promise<RotationSchedule[]> {
    const now = new Date();
    const dueForRotation: RotationSchedule[] = [];

    for (const schedule of this.schedules.values()) {
      if (schedule.status === 'scheduled' && schedule.nextRotation <= now) {
        dueForRotation.push(schedule);
      }
    }

    return dueForRotation;
  }

  /**
   * Process automatic rotations
   */
  async processAutomaticRotations(): Promise<RotationResult[]> {
    const dueSchedules = await this.checkRotationNeeded();
    const results: RotationResult[] = [];

    for (const schedule of dueSchedules) {
      try {
        // Mark as in progress
        schedule.status = 'in_progress';
        schedule.updated = new Date();

        // Generate new secret value
        const newValue = await this.generateSecretValue(schedule.secretName);
        
        // Perform rotation
        const result = await this.rotateSecret(schedule.secretName, newValue, 'system');
        results.push(result);

        if (result.success) {
          schedule.status = 'completed';
        } else {
          schedule.status = 'failed';
        }

        schedule.updated = new Date();

      } catch (error) {
        schedule.status = 'failed';
        schedule.updated = new Date();

        const result: RotationResult = {
          success: false,
          secretName: schedule.secretName,
          oldVersion: 'unknown',
          newVersion: 'none',
          rotatedAt: new Date(),
          rotatedBy: 'system',
          error: error instanceof Error ? error.message : 'Unknown error',
          auditTrail: [`Automatic rotation failed: ${error}`]
        };

        results.push(result);
      }
    }

    return results;
  }

  /**
   * Send rotation notifications
   */
  async sendNotifications(): Promise<void> {
    const now = new Date();
    const notifications: RotationNotification[] = [];

    for (const schedule of this.schedules.values()) {
      if (!schedule.policy.enabled) continue;

      const daysUntilRotation = Math.floor(
        (schedule.nextRotation.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );

      // Check if we need to send notifications
      for (const notificationDay of schedule.policy.notificationDays) {
        if (daysUntilRotation === notificationDay) {
          const notification: RotationNotification = {
            id: this.generateNotificationId(),
            secretName: schedule.secretName,
            type: daysUntilRotation === 0 ? 'due' : 'scheduled',
            message: `Secret ${schedule.secretName} will be rotated in ${daysUntilRotation} days`,
            recipients: ['admin'], // In production, get from user management
            sent: now,
            read: false
          };

          notifications.push(notification);
        }
      }

      // Check for overdue rotations
      if (daysUntilRotation < 0) {
        const notification: RotationNotification = {
          id: this.generateNotificationId(),
          secretName: schedule.secretName,
          type: 'overdue',
          message: `Secret ${schedule.secretName} is overdue for rotation by ${Math.abs(daysUntilRotation)} days`,
          recipients: ['admin'],
          sent: now,
          read: false
        };

        notifications.push(notification);
      }
    }

    // Add notifications to the list
    this.notifications.push(...notifications);

    // In production, this would send actual notifications (email, Slack, etc.)
    for (const notification of notifications) {
      console.log(`📧 Notification sent: ${notification.message}`);
    }
  }

  /**
   * Get rotation history
   */
  getRotationHistory(
    secretName?: string,
    startDate?: Date,
    endDate?: Date
  ): RotationResult[] {
    // In a real implementation, this would query a database
    // For now, we'll return an empty array
    return [];
  }

  /**
   * Get pending notifications
   */
  getPendingNotifications(userId?: string): RotationNotification[] {
    let notifications = this.notifications.filter(n => !n.read);

    if (userId) {
      notifications = notifications.filter(n => n.recipients.includes(userId));
    }

    return notifications;
  }

  /**
   * Mark notification as read
   */
  markNotificationAsRead(notificationId: string, userId: string): void {
    const notification = this.notifications.find(n => n.id === notificationId);
    if (notification && notification.recipients.includes(userId)) {
      notification.read = true;
    }
  }

  /**
   * Generate rotation report
   */
  generateRotationReport(startDate: Date, endDate: Date): string {
    let report = `# Secret Rotation Report\n\n`;
    report += `**Period:** ${startDate.toISOString()} to ${endDate.toISOString()}\n`;
    report += `**Generated:** ${new Date().toISOString()}\n\n`;

    // Get schedules in the date range
    const schedulesInRange = Array.from(this.schedules.values()).filter(schedule => 
      schedule.created >= startDate && schedule.created <= endDate
    );

    report += `## Rotation Summary\n`;
    report += `- Total schedules: ${schedulesInRange.length}\n`;
    
    const statusCounts = schedulesInRange.reduce((acc, schedule) => {
      acc[schedule.status] = (acc[schedule.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    report += `- Status breakdown:\n`;
    for (const [status, count] of Object.entries(statusCounts)) {
      report += `  - ${status}: ${count}\n`;
    }

    // Get notifications in the date range
    const notificationsInRange = this.notifications.filter(notification => 
      notification.sent >= startDate && notification.sent <= endDate
    );

    report += `\n## Notifications\n`;
    report += `- Total notifications sent: ${notificationsInRange.length}\n`;
    
    const typeCounts = notificationsInRange.reduce((acc, notification) => {
      acc[notification.type] = (acc[notification.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    report += `- Notification types:\n`;
    for (const [type, count] of Object.entries(typeCounts)) {
      report += `  - ${type}: ${count}\n`;
    }

    report += `\n## Upcoming Rotations\n`;
    const upcoming = Array.from(this.schedules.values())
      .filter(s => s.status === 'scheduled' && s.nextRotation > new Date())
      .sort((a, b) => a.nextRotation.getTime() - b.nextRotation.getTime())
      .slice(0, 10);

    for (const schedule of upcoming) {
      const daysUntil = Math.floor(
        (schedule.nextRotation.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
      );
      report += `- ${schedule.secretName}: ${daysUntil} days (${schedule.nextRotation.toISOString()})\n`;
    }

    return report;
  }

  // Private helper methods

  private generateScheduleId(secretName: string): string {
    return `schedule_${secretName.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Date.now()}`;
  }

  private generateNotificationId(): string {
    return `notification_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private calculateNextRotation(currentDate: Date, intervalDays: number): Date {
    const nextDate = new Date(currentDate);
    nextDate.setDate(nextDate.getDate() + intervalDays);
    return nextDate;
  }

  private findScheduleBySecretName(secretName: string): RotationSchedule | undefined {
    return Array.from(this.schedules.values()).find(s => s.secretName === secretName);
  }

  private async generateSecretValue(secretName: string): Promise<string> {
    // In production, this would use a secure random generator
    // For now, we'll generate a simple random string
    const crypto = await import('crypto');
    return crypto.randomBytes(32).toString('base64');
  }

  private async createNotification(
    secretName: string,
    type: 'completed' | 'failed',
    userId: string,
    auditTrail: string[]
  ): Promise<void> {
    const notification: RotationNotification = {
      id: this.generateNotificationId(),
      secretName,
      type,
      message: `Secret rotation ${type}: ${secretName}`,
      recipients: ['admin'],
      sent: new Date(),
      read: false
    };

    this.notifications.push(notification);
  }
} 