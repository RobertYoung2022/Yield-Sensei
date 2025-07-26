/**
 * Audit Trail Manager
 * Comprehensive audit logging for compliance activities
 */

import { EventEmitter } from 'events';
import Logger from '../../shared/logging/logger';
import {
  AuditEntry,
  Jurisdiction,
  ComplianceEvent,
  User,
  Transaction
} from '../types';

const logger = Logger.getLogger('audit-trail');

interface AuditQuery {
  entityType?: string;
  entityId?: string;
  userId?: string;
  action?: string;
  jurisdiction?: Jurisdiction;
  startDate?: Date;
  endDate?: Date;
  compliance?: boolean;
  limit?: number;
  offset?: number;
}

interface AuditStatistics {
  totalEntries: number;
  entriesByAction: Record<string, number>;
  entriesByEntityType: Record<string, number>;
  entriesByJurisdiction: Record<Jurisdiction, number>;
  complianceActions: number;
  nonComplianceActions: number;
  averageEntriesPerDay: number;
}

export class AuditTrail extends EventEmitter {
  private auditEntries: AuditEntry[] = [];
  private isInitialized = false;
  private retentionPeriod = 7 * 365 * 24 * 60 * 60 * 1000; // 7 years in milliseconds
  private maxMemoryEntries = 10000; // Keep last 10k entries in memory
  private batchSize = 100;
  private batchBuffer: AuditEntry[] = [];

  constructor() {
    super();
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.warn('Audit Trail already initialized');
      return;
    }

    try {
      logger.info('Initializing Audit Trail...');

      // Set up periodic cleanup and archival
      setInterval(() => this.performMaintenance(), 60 * 60 * 1000); // Every hour

      // Set up batch processing
      setInterval(() => this.processBatch(), 5000); // Every 5 seconds

      this.isInitialized = true;
      logger.info('✅ Audit Trail initialized successfully');

    } catch (error) {
      logger.error('Failed to initialize Audit Trail:', error);
      throw error;
    }
  }

  /**
   * Record a compliance action in the audit trail
   */
  async recordAction(entry: Omit<AuditEntry, 'id' | 'timestamp'>): Promise<string> {
    try {
      const auditEntry: AuditEntry = {
        id: this.generateEntryId(),
        timestamp: new Date(),
        ...entry
      };

      // Add to batch buffer for processing
      this.batchBuffer.push(auditEntry);

      // If batch is full, process immediately
      if (this.batchBuffer.length >= this.batchSize) {
        await this.processBatch();
      }

      logger.debug('Audit action recorded', {
        id: auditEntry.id,
        action: auditEntry.action,
        entityType: auditEntry.entityType,
        entityId: auditEntry.entityId,
        compliance: auditEntry.compliance
      });

      return auditEntry.id;

    } catch (error) {
      logger.error('Error recording audit action:', error);
      throw error;
    }
  }

  /**
   * Record user action
   */
  async recordUserAction(
    user: User,
    action: string,
    entityType: string,
    entityId: string,
    before?: Record<string, any>,
    after?: Record<string, any>,
    reason?: string
  ): Promise<string> {
    return this.recordAction({
      userId: user.id,
      action,
      entityType,
      entityId,
      before,
      after,
      reason,
      jurisdiction: user.jurisdiction,
      compliance: true,
      ipAddress: undefined, // Would be populated from request context
      userAgent: undefined  // Would be populated from request context
    });
  }

  /**
   * Record transaction action
   */
  async recordTransactionAction(
    transaction: Transaction,
    user: User,
    action: string,
    before?: Record<string, any>,
    after?: Record<string, any>,
    reason?: string
  ): Promise<string> {
    return this.recordAction({
      userId: user.id,
      action,
      entityType: 'transaction',
      entityId: transaction.id,
      before,
      after,
      reason,
      jurisdiction: user.jurisdiction,
      compliance: true
    });
  }

  /**
   * Record compliance event
   */
  async recordComplianceEvent(
    event: ComplianceEvent,
    action: string,
    userId?: string,
    reason?: string
  ): Promise<string> {
    return this.recordAction({
      userId,
      action,
      entityType: event.entityType,
      entityId: event.entityId,
      before: undefined,
      after: { event: event.data },
      reason,
      jurisdiction: event.jurisdiction,
      compliance: true
    });
  }

  /**
   * Query audit trail entries
   */
  async queryEntries(query: AuditQuery): Promise<AuditEntry[]> {
    try {
      let filteredEntries = [...this.auditEntries];

      // Apply filters
      if (query.entityType) {
        filteredEntries = filteredEntries.filter(e => e.entityType === query.entityType);
      }

      if (query.entityId) {
        filteredEntries = filteredEntries.filter(e => e.entityId === query.entityId);
      }

      if (query.userId) {
        filteredEntries = filteredEntries.filter(e => e.userId === query.userId);
      }

      if (query.action) {
        filteredEntries = filteredEntries.filter(e => e.action === query.action);
      }

      if (query.jurisdiction) {
        filteredEntries = filteredEntries.filter(e => e.jurisdiction === query.jurisdiction);
      }

      if (query.startDate) {
        filteredEntries = filteredEntries.filter(e => e.timestamp >= query.startDate!);
      }

      if (query.endDate) {
        filteredEntries = filteredEntries.filter(e => e.timestamp <= query.endDate!);
      }

      if (query.compliance !== undefined) {
        filteredEntries = filteredEntries.filter(e => e.compliance === query.compliance);
      }

      // Sort by timestamp (newest first)
      filteredEntries.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

      // Apply pagination
      const offset = query.offset || 0;
      const limit = query.limit || 100;
      
      return filteredEntries.slice(offset, offset + limit);

    } catch (error) {
      logger.error('Error querying audit entries:', error);
      throw error;
    }
  }

  /**
   * Get audit trail for specific entity
   */
  async getEntityAuditTrail(entityType: string, entityId: string): Promise<AuditEntry[]> {
    return this.queryEntries({
      entityType,
      entityId,
      limit: 1000 // Get comprehensive history for entity
    });
  }

  /**
   * Get user activity audit trail
   */
  async getUserAuditTrail(userId: string, limit = 100): Promise<AuditEntry[]> {
    return this.queryEntries({
      userId,
      limit
    });
  }

  /**
   * Get compliance actions audit trail
   */
  async getComplianceAuditTrail(jurisdiction?: Jurisdiction, limit = 500): Promise<AuditEntry[]> {
    return this.queryEntries({
      jurisdiction,
      compliance: true,
      limit
    });
  }

  /**
   * Get audit statistics
   */
  getStatistics(): AuditStatistics {
    const now = Date.now();
    const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000);
    const recentEntries = this.auditEntries.filter(e => e.timestamp.getTime() > thirtyDaysAgo);

    const entriesByAction: Record<string, number> = {};
    const entriesByEntityType: Record<string, number> = {};
    const entriesByJurisdiction: Record<Jurisdiction, number> = {};
    let complianceActions = 0;
    let nonComplianceActions = 0;

    for (const entry of this.auditEntries) {
      // By action
      entriesByAction[entry.action] = (entriesByAction[entry.action] || 0) + 1;

      // By entity type
      entriesByEntityType[entry.entityType] = (entriesByEntityType[entry.entityType] || 0) + 1;

      // By jurisdiction
      if (entry.jurisdiction) {
        entriesByJurisdiction[entry.jurisdiction] = (entriesByJurisdiction[entry.jurisdiction] || 0) + 1;
      }

      // Compliance vs non-compliance
      if (entry.compliance) {
        complianceActions++;
      } else {
        nonComplianceActions++;
      }
    }

    return {
      totalEntries: this.auditEntries.length,
      entriesByAction,
      entriesByEntityType,
      entriesByJurisdiction,
      complianceActions,
      nonComplianceActions,
      averageEntriesPerDay: recentEntries.length / 30
    };
  }

  /**
   * Export audit trail for compliance reporting
   */
  async exportAuditTrail(
    startDate: Date,
    endDate: Date,
    jurisdiction?: Jurisdiction,
    format: 'json' | 'csv' = 'json'
  ): Promise<string> {
    try {
      const entries = await this.queryEntries({
        startDate,
        endDate,
        jurisdiction,
        limit: 100000 // Large limit for export
      });

      if (format === 'csv') {
        return this.convertToCSV(entries);
      } else {
        return JSON.stringify({
          exportDate: new Date(),
          period: { startDate, endDate },
          jurisdiction,
          totalEntries: entries.length,
          entries
        }, null, 2);
      }

    } catch (error) {
      logger.error('Error exporting audit trail:', error);
      throw error;
    }
  }

  /**
   * Verify audit trail integrity
   */
  async verifyIntegrity(): Promise<{ valid: boolean; issues: string[] }> {
    const issues: string[] = [];

    try {
      // Check for missing or invalid entries
      for (let i = 0; i < this.auditEntries.length; i++) {
        const entry = this.auditEntries[i];

        if (!entry.id || !entry.timestamp || !entry.action || !entry.entityType || !entry.entityId) {
          issues.push(`Entry ${i} has missing required fields`);
        }

        if (entry.timestamp > new Date()) {
          issues.push(`Entry ${entry.id} has future timestamp`);
        }

        if (i > 0 && entry.timestamp > this.auditEntries[i - 1].timestamp) {
          issues.push(`Entry ${entry.id} is out of chronological order`);
        }
      }

      // Check for suspicious patterns
      const recentEntries = this.auditEntries.filter(e => 
        e.timestamp.getTime() > Date.now() - (24 * 60 * 60 * 1000)
      );

      if (recentEntries.length > 10000) {
        issues.push('Unusually high number of entries in last 24 hours');
      }

      logger.info('Audit trail integrity check completed', {
        totalEntries: this.auditEntries.length,
        issuesFound: issues.length
      });

      return {
        valid: issues.length === 0,
        issues
      };

    } catch (error) {
      logger.error('Error verifying audit trail integrity:', error);
      return {
        valid: false,
        issues: [`Integrity check failed: ${error}`]
      };
    }
  }

  /**
   * Get audit trail status
   */
  getStatus(): any {
    const statistics = this.getStatistics();
    
    return {
      initialized: this.isInitialized,
      totalEntries: this.auditEntries.length,
      batchBufferSize: this.batchBuffer.length,
      retentionPeriod: this.retentionPeriod / (24 * 60 * 60 * 1000), // in days
      maxMemoryEntries: this.maxMemoryEntries,
      statistics
    };
  }

  // Private methods

  private async processBatch(): Promise<void> {
    if (this.batchBuffer.length === 0) return;

    try {
      const batch = [...this.batchBuffer];
      this.batchBuffer = [];

      // Add to memory storage
      this.auditEntries.push(...batch);

      // Trim memory if necessary
      if (this.auditEntries.length > this.maxMemoryEntries) {
        const excess = this.auditEntries.length - this.maxMemoryEntries;
        const removed = this.auditEntries.splice(0, excess);
        
        // In a real implementation, these would be archived to persistent storage
        logger.debug(`Archived ${removed.length} audit entries to persistent storage`);
      }

      // Sort entries by timestamp
      this.auditEntries.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

      logger.debug(`Processed audit batch: ${batch.length} entries`);

      // Emit batch processed event
      this.emit('batch_processed', {
        entriesProcessed: batch.length,
        totalEntries: this.auditEntries.length,
        timestamp: new Date()
      });

    } catch (error) {
      logger.error('Error processing audit batch:', error);
      // Put entries back in buffer to retry
      this.batchBuffer.unshift(...this.batchBuffer);
    }
  }

  private performMaintenance(): void {
    try {
      const before = this.auditEntries.length;
      const cutoff = new Date(Date.now() - this.retentionPeriod);

      // Remove entries older than retention period
      this.auditEntries = this.auditEntries.filter(entry => entry.timestamp > cutoff);

      const removed = before - this.auditEntries.length;
      if (removed > 0) {
        logger.info(`Audit trail maintenance: removed ${removed} expired entries`);
      }

      // Emit maintenance completed event
      this.emit('maintenance_completed', {
        entriesRemoved: removed,
        totalEntries: this.auditEntries.length,
        timestamp: new Date()
      });

    } catch (error) {
      logger.error('Error during audit trail maintenance:', error);
    }
  }

  private convertToCSV(entries: AuditEntry[]): string {
    if (entries.length === 0) return '';

    const headers = [
      'ID', 'Timestamp', 'User ID', 'Action', 'Entity Type', 'Entity ID',
      'Jurisdiction', 'Compliance', 'IP Address', 'User Agent', 'Reason'
    ];

    const rows = entries.map(entry => [
      entry.id,
      entry.timestamp.toISOString(),
      entry.userId || '',
      entry.action,
      entry.entityType,
      entry.entityId,
      entry.jurisdiction || '',
      entry.compliance.toString(),
      entry.ipAddress || '',
      entry.userAgent || '',
      entry.reason || ''
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(field => `"${field}"`).join(','))
    ].join('\n');

    return csvContent;
  }

  private generateEntryId(): string {
    return `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}