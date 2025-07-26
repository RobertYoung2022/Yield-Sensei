/**
 * API Versioning Service
 * Manages API versions, deprecation policies, and migration strategies
 */

import { Request, Response, NextFunction } from 'express';
import { 
  ApiVersion, 
  BreakingChange, 
  VersioningConfig, 
  DeprecationPolicy,
  DeprecationNotification,
  MigrationMilestone,
  VersioningError 
} from '../types';
import { getDocumentationConfig } from '../config/documentation.config';
import Logger from '../../shared/logging/logger';

const logger = Logger.getLogger('VersioningService');

export class VersioningService {
  private config: VersioningConfig;
  private versions: Map<string, ApiVersion> = new Map();
  private deprecationPolicies: Map<string, DeprecationPolicy> = new Map();
  private notifications: DeprecationNotification[] = [];

  constructor() {
    this.config = getDocumentationConfig().versioning;
    this.initializeVersions();
  }

  /**
   * Initialize default API versions
   */
  private initializeVersions(): void {
    // Version 1.0 - Initial stable release
    this.addVersion({
      version: 'v1',
      status: 'stable',
      releaseDate: new Date('2024-01-01'),
      breakingChanges: [],
      newFeatures: [
        'User authentication and authorization',
        'Portfolio management',
        'Yield optimization algorithms',
        'Risk assessment tools',
        'Real-time market data',
        'Basic analytics and reporting',
      ],
      bugFixes: [],
    });

    // Version 2.0 - Major update with new features
    this.addVersion({
      version: 'v2',
      status: 'beta',
      releaseDate: new Date('2024-06-01'),
      breakingChanges: [
        {
          type: 'endpoint',
          description: 'Portfolio endpoints now require portfolio ID in path instead of query',
          oldValue: 'GET /api/v1/portfolio?portfolioId=123',
          newValue: 'GET /api/v2/portfolios/123',
          migrationSteps: [
            'Update endpoint URLs to include portfolio ID in path',
            'Remove portfolioId from query parameters',
            'Update response handling for new data structure',
          ],
          severity: 'high',
        },
        {
          type: 'response',
          description: 'User profile response structure changed',
          oldValue: '{ "user": { "id": "123", "name": "John" } }',
          newValue: '{ "id": "123", "profile": { "name": "John" } }',
          migrationSteps: [
            'Update response parsing to handle new structure',
            'Update field access patterns',
            'Update type definitions if using TypeScript',
          ],
          severity: 'medium',
        },
      ],
      newFeatures: [
        'Advanced portfolio analytics',
        'Multi-protocol yield optimization',
        'Real-time security monitoring',
        'Enhanced risk management',
        'WebSocket support for real-time data',
        'GraphQL API',
        'Advanced filtering and search',
        'Bulk operations support',
      ],
      bugFixes: [
        'Fixed pagination issues with large datasets',
        'Improved error handling for rate limits',
        'Enhanced validation for portfolio operations',
        'Fixed timezone handling in date fields',
      ],
      migrationGuide: 'https://docs.yieldsensei.com/migration/v1-to-v2',
    });
  }

  /**
   * Add a new API version
   */
  public addVersion(version: ApiVersion): void {
    this.versions.set(version.version, version);
    logger.info('Added new API version', { version: version.version, status: version.status });
  }

  /**
   * Get version information
   */
  public getVersion(version: string): ApiVersion | undefined {
    return this.versions.get(version);
  }

  /**
   * Get all versions
   */
  public getAllVersions(): ApiVersion[] {
    return Array.from(this.versions.values());
  }

  /**
   * Get supported versions
   */
  public getSupportedVersions(): string[] {
    return this.config.supportedVersions;
  }

  /**
   * Get default version
   */
  public getDefaultVersion(): string {
    return this.config.defaultVersion;
  }

  /**
   * Check if version is supported
   */
  public isVersionSupported(version: string): boolean {
    return this.config.supportedVersions.includes(version);
  }

  /**
   * Check if version is deprecated
   */
  public isVersionDeprecated(version: string): boolean {
    const versionInfo = this.versions.get(version);
    return versionInfo?.status === 'deprecated' || versionInfo?.status === 'sunset';
  }

  /**
   * Check if version is sunset
   */
  public isVersionSunset(version: string): boolean {
    const versionInfo = this.versions.get(version);
    return versionInfo?.status === 'sunset';
  }

  /**
   * Get version status
   */
  public getVersionStatus(version: string): string | undefined {
    return this.versions.get(version)?.status;
  }

  /**
   * Get breaking changes for a version
   */
  public getBreakingChanges(version: string): BreakingChange[] {
    return this.versions.get(version)?.breakingChanges || [];
  }

  /**
   * Get migration guide for a version
   */
  public getMigrationGuide(version: string): string | undefined {
    return this.versions.get(version)?.migrationGuide;
  }

  /**
   * Extract version from request
   */
  public extractVersion(req: Request): string {
    // Check header first
    const headerVersion = req.get(this.config.versionHeader);
    if (headerVersion && this.isVersionSupported(headerVersion)) {
      return headerVersion;
    }

    // Check query parameter
    const queryVersion = req.query[this.config.versionParam] as string;
    if (queryVersion && this.isVersionSupported(queryVersion)) {
      return queryVersion;
    }

    // Check URL path
    const pathMatch = req.path.match(/\/api\/(v\d+)/);
    if (pathMatch && pathMatch[1] && this.isVersionSupported(pathMatch[1])) {
      return pathMatch[1];
    }

    // Return default version
    return this.config.defaultVersion;
  }

  /**
   * Version middleware for Express
   */
  public versionMiddleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      try {
        const version = this.extractVersion(req);
        
        // Add version to request object
        (req as any).apiVersion = version;
        
        // Check if version is supported
        if (!this.isVersionSupported(version)) {
          return res.status(400).json({
            error: {
              code: 'UNSUPPORTED_VERSION',
              message: `API version '${version}' is not supported. Supported versions: ${this.config.supportedVersions.join(', ')}`,
              supportedVersions: this.config.supportedVersions,
              defaultVersion: this.config.defaultVersion,
            },
          });
        }

        // Check if version is deprecated
        if (this.isVersionDeprecated(version)) {
          const versionInfo = this.versions.get(version);
          const warning = this.generateDeprecationWarning(version, versionInfo);
          
          res.set('X-API-Deprecation-Warning', warning);
          res.set('X-API-Deprecation-Date', versionInfo?.sunsetDate?.toISOString() || '');
        }

        // Check if version is sunset
        if (this.isVersionSunset(version)) {
          return res.status(410).json({
            error: {
              code: 'VERSION_SUNSET',
              message: `API version '${version}' has been sunset and is no longer available`,
              sunsetDate: this.versions.get(version)?.sunsetDate?.toISOString(),
              migrationGuide: this.getMigrationGuide(version),
            },
          });
        }

        next();
      } catch (error) {
        logger.error('Version middleware error', { error });
        next(error);
      }
    };
  }

  /**
   * Generate deprecation warning header
   */
  private generateDeprecationWarning(version: string, versionInfo?: ApiVersion): string {
    if (!versionInfo) return '';

    const daysUntilSunset = versionInfo.sunsetDate 
      ? Math.ceil((versionInfo.sunsetDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      : 0;

    return `API version '${version}' is deprecated and will be sunset in ${daysUntilSunset} days. Please migrate to a newer version.`;
  }

  /**
   * Add deprecation policy
   */
  public addDeprecationPolicy(version: string, policy: DeprecationPolicy): void {
    this.deprecationPolicies.set(version, policy);
    logger.info('Added deprecation policy', { version, policy: policy.policy });
  }

  /**
   * Get deprecation policy
   */
  public getDeprecationPolicy(version: string): DeprecationPolicy | undefined {
    return this.deprecationPolicies.get(version);
  }

  /**
   * Schedule deprecation notification
   */
  public scheduleNotification(notification: DeprecationNotification): void {
    this.notifications.push(notification);
    logger.info('Scheduled deprecation notification', { 
      id: notification.id, 
      type: notification.type,
      scheduledFor: notification.schedule.startDate 
    });
  }

  /**
   * Get pending notifications
   */
  public getPendingNotifications(): DeprecationNotification[] {
    const now = new Date();
    return this.notifications.filter(n => 
      !n.sent && n.schedule.startDate <= now
    );
  }

  /**
   * Mark notification as sent
   */
  public markNotificationSent(id: string): void {
    const notification = this.notifications.find(n => n.id === id);
    if (notification) {
      notification.sent = true;
      notification.sentAt = new Date();
      logger.info('Marked notification as sent', { id });
    }
  }

  /**
   * Send deprecation notifications
   */
  public async sendNotifications(): Promise<void> {
    const pending = this.getPendingNotifications();
    
    for (const notification of pending) {
      try {
        await this.sendNotification(notification);
        this.markNotificationSent(notification.id);
      } catch (error) {
        logger.error('Failed to send notification', { 
          id: notification.id, 
          error 
        });
      }
    }
  }

  /**
   * Send a single notification
   */
  private async sendNotification(notification: DeprecationNotification): Promise<void> {
    // In a real implementation, you'd integrate with email, Slack, Discord, etc.
    logger.info('Sending deprecation notification', {
      id: notification.id,
      type: notification.type,
      channels: notification.channels,
      recipients: notification.recipients,
    });

    // Placeholder for actual notification sending logic
    for (const channel of notification.channels) {
      switch (channel) {
        case 'email':
          await this.sendEmailNotification(notification);
          break;
        case 'webhook':
          await this.sendWebhookNotification(notification);
          break;
        case 'slack':
          await this.sendSlackNotification(notification);
          break;
        case 'discord':
          await this.sendDiscordNotification(notification);
          break;
        default:
          logger.warn('Unknown notification channel', { channel });
      }
    }
  }

  /**
   * Send email notification
   */
  private async sendEmailNotification(notification: DeprecationNotification): Promise<void> {
    // Placeholder for email sending logic
    logger.info('Email notification sent', { 
      id: notification.id,
      recipients: notification.recipients 
    });
  }

  /**
   * Send webhook notification
   */
  private async sendWebhookNotification(notification: DeprecationNotification): Promise<void> {
    // Placeholder for webhook sending logic
    logger.info('Webhook notification sent', { id: notification.id });
  }

  /**
   * Send Slack notification
   */
  private async sendSlackNotification(notification: DeprecationNotification): Promise<void> {
    // Placeholder for Slack sending logic
    logger.info('Slack notification sent', { id: notification.id });
  }

  /**
   * Send Discord notification
   */
  private async sendDiscordNotification(notification: DeprecationNotification): Promise<void> {
    // Placeholder for Discord sending logic
    logger.info('Discord notification sent', { id: notification.id });
  }

  /**
   * Create migration milestone
   */
  public createMigrationMilestone(
    version: string,
    description: string,
    type: 'announcement' | 'deprecation' | 'breaking-change' | 'sunset',
    date: Date
  ): MigrationMilestone {
    const milestone: MigrationMilestone = {
      date,
      description,
      type,
      status: 'pending',
    };

    const policy = this.deprecationPolicies.get(version);
    if (policy) {
      policy.timeline.migrationMilestones.push(milestone);
    }

    logger.info('Created migration milestone', { 
      version, 
      type, 
      date: date.toISOString() 
    });

    return milestone;
  }

  /**
   * Update migration milestone status
   */
  public updateMilestoneStatus(
    version: string,
    date: Date,
    status: 'pending' | 'in-progress' | 'completed',
    notes?: string
  ): void {
    const policy = this.deprecationPolicies.get(version);
    if (policy) {
      const milestone = policy.timeline.migrationMilestones.find(
        m => m.date.getTime() === date.getTime()
      );
      
      if (milestone) {
        milestone.status = status;
        if (notes) milestone.notes = notes;
        
        logger.info('Updated migration milestone status', { 
          version, 
          date: date.toISOString(), 
          status 
        });
      }
    }
  }

  /**
   * Get version statistics
   */
  public getVersionStats(): any {
    const stats = {
      totalVersions: this.versions.size,
      supportedVersions: this.config.supportedVersions,
      defaultVersion: this.config.defaultVersion,
      versionsByStatus: {} as Record<string, number>,
      totalBreakingChanges: 0,
      totalNotifications: this.notifications.length,
      pendingNotifications: this.getPendingNotifications().length,
    };

    // Count versions by status
    for (const version of this.versions.values()) {
      stats.versionsByStatus[version.status] = (stats.versionsByStatus[version.status] || 0) + 1;
      stats.totalBreakingChanges += version.breakingChanges.length;
    }

    return stats;
  }

  /**
   * Validate version configuration
   */
  public validateConfiguration(): boolean {
    try {
      // Check if default version is supported
      if (!this.isVersionSupported(this.config.defaultVersion)) {
        throw new VersioningError(
          `Default version '${this.config.defaultVersion}' is not in supported versions`,
          'INVALID_DEFAULT_VERSION'
        );
      }

      // Check if all supported versions exist
      for (const version of this.config.supportedVersions) {
        if (!this.versions.has(version)) {
          throw new VersioningError(
            `Supported version '${version}' does not exist`,
            'MISSING_SUPPORTED_VERSION'
          );
        }
      }

      // Check for version conflicts
      const versionNumbers = this.config.supportedVersions.map(v => v.replace('v', ''));
      const uniqueVersions = new Set(versionNumbers);
      if (uniqueVersions.size !== versionNumbers.length) {
        throw new VersioningError(
          'Duplicate version numbers found',
          'DUPLICATE_VERSIONS'
        );
      }

      return true;
    } catch (error) {
      logger.error('Version configuration validation failed', { error });
      return false;
    }
  }

  /**
   * Get version comparison
   */
  public compareVersions(version1: string, version2: string): {
    newer: string;
    older: string;
    breakingChanges: BreakingChange[];
    newFeatures: string[];
    bugFixes: string[];
  } {
    const v1 = this.versions.get(version1);
    const v2 = this.versions.get(version2);

    if (!v1 || !v2) {
      throw new VersioningError(
        `One or both versions not found: ${version1}, ${version2}`,
        'VERSION_NOT_FOUND'
      );
    }

    const v1Num = parseInt(version1.replace('v', ''));
    const v2Num = parseInt(version2.replace('v', ''));

    const newer = v1Num > v2Num ? version1 : version2;
    const older = v1Num > v2Num ? version2 : version1;
    const newerInfo = v1Num > v2Num ? v1 : v2;
    const _olderInfo = v1Num > v2Num ? v2 : v1;

    return {
      newer,
      older,
      breakingChanges: newerInfo.breakingChanges,
      newFeatures: newerInfo.newFeatures,
      bugFixes: newerInfo.bugFixes,
    };
  }
}

export default VersioningService; 