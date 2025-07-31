/**
 * Enhanced Audit Trail Service
 * Provides immutable audit logging with digital signatures, chain of custody tracking,
 * and comprehensive compliance reporting capabilities
 */

import { EventEmitter } from 'events';
import crypto from 'crypto';
import Logger from '../../shared/logging/logger';
import { DatabaseManager } from '../../shared/database/manager';
import { AuditTrail } from './audit-trail';
import {
  AuditEntry,
  Jurisdiction,
  ComplianceEvent,
  User,
  Transaction,
  ComplianceCategory,
  RiskLevel
} from '../types';

const logger = Logger.getLogger('enhanced-audit-trail');

// Enhanced Audit Trail Interfaces
export interface SignedAuditEntry extends AuditEntry {
  digitalSignature: string;
  hashChain: string;
  previousHash?: string;
  blockNumber: number;
  merkleRoot?: string;
  signatureAlgorithm: string;
  publicKey: string;
  verificationStatus: 'verified' | 'pending' | 'failed' | 'tampered';
}

export interface EvidenceAttachment {
  id: string;
  auditEntryId: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  hash: string;
  hashAlgorithm: string;
  uploadedBy: string;
  uploadedAt: Date;
  version: number;
  metadata: Record<string, any>;
  storageLocation: string;
  accessPermissions: string[];
  retentionPeriod: number;
}

export interface ChainOfCustody {
  id: string;
  evidenceId: string;
  auditEntryId: string;
  custodyChain: CustodyRecord[];
  currentCustodian: string;
  status: 'active' | 'transferred' | 'archived' | 'destroyed';
  createdAt: Date;
  lastTransfer?: Date;
}

export interface CustodyRecord {
  id: string;
  custodian: string;
  action: 'created' | 'transferred' | 'accessed' | 'modified' | 'reviewed' | 'archived';
  timestamp: Date;
  reason: string;
  signature: string;
  witnessedBy?: string;
  metadata: Record<string, any>;
}

export interface ComplianceReport {
  id: string;
  type: 'sar' | 'ctr' | 'regulatory-filing' | 'audit-summary' | 'investigation' | 'custom';
  jurisdiction: Jurisdiction;
  category: ComplianceCategory;
  title: string;
  description: string;
  period: {
    startDate: Date;
    endDate: Date;
  };
  generatedAt: Date;
  generatedBy: string;
  status: 'draft' | 'pending-review' | 'approved' | 'filed' | 'rejected';
  content: {
    summary: string;
    findings: ReportFinding[];
    recommendations: string[];
    attachments: string[];
    metadata: Record<string, any>;
  };
  digitalSignature?: string;
  reviewHistory: ReviewRecord[];
  filingDetails?: {
    filedAt: Date;
    filedBy: string;
    confirmationNumber: string;
    acknowledgmentReceived: boolean;
  };
}

export interface ReportFinding {
  id: string;
  severity: RiskLevel;
  category: string;
  description: string;
  evidence: string[];
  impact: string;
  recommendation: string;
  status: 'open' | 'addressed' | 'mitigated' | 'accepted-risk';
}

export interface ReviewRecord {
  reviewedBy: string;
  reviewedAt: Date;
  decision: 'approved' | 'rejected' | 'requires-changes';
  comments: string;
  changes: Record<string, any>;
}

export interface AuditQuery {
  entityType?: string;
  entityId?: string;
  userId?: string;
  action?: string;
  jurisdiction?: Jurisdiction;
  startDate?: Date;
  endDate?: Date;
  compliance?: boolean;
  verificationStatus?: 'verified' | 'pending' | 'failed' | 'tampered';
  includeEvidence?: boolean;
  limit?: number;
  offset?: number;
}

export interface ReportTemplate {
  id: string;
  type: string;
  jurisdiction: Jurisdiction;
  name: string;
  description: string;
  template: {
    sections: ReportSection[];
    metadata: Record<string, any>;
    formatting: Record<string, any>;
  };
  isActive: boolean;
  version: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ReportSection {
  id: string;
  title: string;
  type: 'header' | 'summary' | 'table' | 'list' | 'text' | 'chart';
  required: boolean;
  dataSource: string;
  template: string;
  formatting: Record<string, any>;
}

export class EnhancedAuditTrailService extends EventEmitter {
  private dbManager: DatabaseManager;
  private baseAuditTrail: AuditTrail;
  private isInitialized = false;
  private signedEntries: Map<string, SignedAuditEntry> = new Map();
  private evidenceAttachments: Map<string, EvidenceAttachment> = new Map();
  private custodyChains: Map<string, ChainOfCustody> = new Map();
  private reports: Map<string, ComplianceReport> = new Map();
  private reportTemplates: Map<string, ReportTemplate> = new Map();
  private cryptoConfig = {
    algorithm: 'RSA-SHA256',
    keySize: 2048,
    hashAlgorithm: 'sha256'
  };
  private privateKey: string = '';
  private publicKey: string = '';
  private currentBlockNumber = 0;
  private lastBlockHash = '';

  constructor(
    dbManager: DatabaseManager,
    baseAuditTrail: AuditTrail
  ) {
    super();
    this.dbManager = dbManager;
    this.baseAuditTrail = baseAuditTrail;
    
    logger.info('EnhancedAuditTrailService initialized');
  }

  /**
   * Initialize the enhanced audit trail service
   */
  async initialize(): Promise<void> {
    try {
      logger.info('Initializing Enhanced Audit Trail Service');

      // Initialize base audit trail
      await this.baseAuditTrail.initialize();

      // Generate or load cryptographic keys
      await this.initializeCryptography();

      // Load existing signed entries
      await this.loadSignedEntries();

      // Load report templates
      await this.loadReportTemplates();

      // Set up scheduled report generation
      this.setupScheduledReporting();

      this.isInitialized = true;
      logger.info('✅ Enhanced Audit Trail Service initialized successfully');
      
      this.emit('initialized');
    } catch (error) {
      logger.error('Failed to initialize Enhanced Audit Trail Service', { error });
      throw error;
    }
  }

  /**
   * Record an action with digital signature and immutable logging
   */
  async recordSignedAction(entry: Omit<AuditEntry, 'id' | 'timestamp'>): Promise<string> {
    try {
      // Create base audit entry
      const baseEntryId = await this.baseAuditTrail.recordAction(entry);

      // Create enhanced signed entry
      const signedEntry = await this.createSignedEntry(entry, baseEntryId);

      // Store signed entry
      this.signedEntries.set(signedEntry.id, signedEntry);

      // Persist to database
      await this.persistSignedEntry(signedEntry);

      logger.info('Signed audit action recorded', {
        id: signedEntry.id,
        action: signedEntry.action,
        blockNumber: signedEntry.blockNumber,
        verificationStatus: signedEntry.verificationStatus
      });

      this.emit('signedEntryCreated', signedEntry);

      return signedEntry.id;
    } catch (error) {
      logger.error('Error recording signed audit action:', error);
      throw error;
    }
  }

  /**
   * Attach evidence to an audit entry with chain of custody
   */
  async attachEvidence(
    auditEntryId: string,
    file: {
      buffer: Buffer;
      originalName: string;
      mimeType: string;
    },
    uploadedBy: string,
    metadata?: Record<string, any>
  ): Promise<string> {
    try {
      logger.info('Attaching evidence to audit entry', { auditEntryId, originalName: file.originalName });

      // Generate file hash
      const fileHash = crypto.createHash(this.cryptoConfig.hashAlgorithm)
        .update(file.buffer)
        .digest('hex');

      // Generate attachment ID
      const attachmentId = this.generateId('evidence');

      // Create evidence attachment
      const attachment: EvidenceAttachment = {
        id: attachmentId,
        auditEntryId,
        filename: `${Date.now()}_${file.originalName}`,
        originalName: file.originalName,
        mimeType: file.mimeType,
        size: file.buffer.length,
        hash: fileHash,
        hashAlgorithm: this.cryptoConfig.hashAlgorithm,
        uploadedBy,
        uploadedAt: new Date(),
        version: 1,
        metadata: metadata || {},
        storageLocation: `/evidence/${attachmentId}`,
        accessPermissions: [uploadedBy],
        retentionPeriod: 7 * 365 * 24 * 60 * 60 * 1000 // 7 years
      };

      // Store attachment
      this.evidenceAttachments.set(attachment.id, attachment);

      // Create chain of custody
      const custodyChain = await this.createChainOfCustody(attachment, uploadedBy);

      // Store file (implementation would store to secure storage)
      await this.storeEvidenceFile(attachment, file.buffer);

      // Record evidence attachment in audit trail
      await this.recordSignedAction({
        entityType: 'evidence',
        entityId: attachment.id,
        action: 'EVIDENCE_ATTACHED',
        userId: uploadedBy,
        jurisdiction: 'US', // Would be derived from context
        compliance: true,
        after: { attachment }
      });

      logger.info('Evidence attached successfully', {
        evidenceId: attachment.id,
        auditEntryId,
        filename: attachment.filename,
        custodyChainId: custodyChain.id
      });

      this.emit('evidenceAttached', { attachment, custodyChain });

      return attachment.id;
    } catch (error) {
      logger.error('Error attaching evidence:', error);
      throw error;
    }
  }

  /**
   * Generate compliance report using template
   */
  async generateComplianceReport(
    type: string,
    jurisdiction: Jurisdiction,
    period: { startDate: Date; endDate: Date },
    generatedBy: string,
    templateId?: string
  ): Promise<string> {
    try {
      logger.info('Generating compliance report', { type, jurisdiction, period });

      // Get or create template
      const template = templateId ? 
        this.reportTemplates.get(templateId) : 
        await this.getDefaultTemplate(type, jurisdiction);

      if (!template) {
        throw new Error(`No template found for report type: ${type}`);
      }

      // Collect audit data for the period
      const auditData = await this.collectAuditData(jurisdiction, period);

      // Generate report content
      const reportContent = await this.generateReportContent(template, auditData);

      // Create report
      const report: ComplianceReport = {
        id: this.generateId('report'),
        type: type as any,
        jurisdiction,
        category: 'kyc-aml', // Would be derived from template
        title: `${type.toUpperCase()} Report - ${jurisdiction} - ${period.startDate.toISOString().split('T')[0]} to ${period.endDate.toISOString().split('T')[0]}`,
        description: `Automated compliance report generated for ${jurisdiction}`,
        period,
        generatedAt: new Date(),
        generatedBy,
        status: 'draft',
        content: reportContent,
        reviewHistory: []
      };

      // Store report
      this.reports.set(report.id, report);

      // Record report generation in audit trail
      await this.recordSignedAction({
        entityType: 'compliance_report',
        entityId: report.id,
        action: 'REPORT_GENERATED',
        userId: generatedBy,
        jurisdiction,
        compliance: true,
        after: { report: { id: report.id, type: report.type, status: report.status } }
      });

      logger.info('Compliance report generated', {
        reportId: report.id,
        type: report.type,
        jurisdiction: report.jurisdiction
      });

      this.emit('reportGenerated', report);

      return report.id;
    } catch (error) {
      logger.error('Error generating compliance report:', error);
      throw error;
    }
  }

  /**
   * Verify the integrity of audit trail
   */
  async verifyAuditTrailIntegrity(): Promise<{
    isValid: boolean;
    verifiedEntries: number;
    failedEntries: number;
    issues: string[];
  }> {
    try {
      logger.info('Verifying audit trail integrity');

      let verifiedEntries = 0;
      let failedEntries = 0;
      const issues: string[] = [];

      // Verify each signed entry
      for (const entry of this.signedEntries.values()) {
        const isValid = await this.verifySignedEntry(entry);
        
        if (isValid) {
          verifiedEntries++;
        } else {
          failedEntries++;
          issues.push(`Entry ${entry.id} failed verification`);
        }
      }

      // Verify hash chain continuity
      const chainValid = await this.verifyHashChain();
      if (!chainValid) {
        issues.push('Hash chain continuity broken');
      }

      const isValid = failedEntries === 0 && chainValid;

      logger.info('Audit trail integrity verification completed', {
        isValid,
        verifiedEntries,
        failedEntries,
        issuesCount: issues.length
      });

      return {
        isValid,
        verifiedEntries,
        failedEntries,
        issues
      };
    } catch (error) {
      logger.error('Error verifying audit trail integrity:', error);
      throw error;
    }
  }

  /**
   * Query signed audit entries with enhanced filtering
   */
  async querySignedEntries(query: AuditQuery): Promise<SignedAuditEntry[]> {
    try {
      let results = Array.from(this.signedEntries.values());

      // Apply filters
      if (query.entityType) {
        results = results.filter(e => e.entityType === query.entityType);
      }

      if (query.entityId) {
        results = results.filter(e => e.entityId === query.entityId);
      }

      if (query.userId) {
        results = results.filter(e => e.userId === query.userId);
      }

      if (query.action) {
        results = results.filter(e => e.action === query.action);
      }

      if (query.jurisdiction) {
        results = results.filter(e => e.jurisdiction === query.jurisdiction);
      }

      if (query.compliance !== undefined) {
        results = results.filter(e => e.compliance === query.compliance);
      }

      if (query.verificationStatus) {
        results = results.filter(e => e.verificationStatus === query.verificationStatus);
      }

      if (query.startDate && query.endDate) {
        results = results.filter(e => 
          e.timestamp >= query.startDate! && e.timestamp <= query.endDate!
        );
      }

      // Include evidence if requested
      if (query.includeEvidence) {
        // Implementation would include evidence attachments
      }

      // Sort by timestamp (newest first)
      results.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

      // Apply pagination
      if (query.offset) {
        results = results.slice(query.offset);
      }

      if (query.limit) {
        results = results.slice(0, query.limit);
      }

      return results;
    } catch (error) {
      logger.error('Error querying signed entries:', error);
      throw error;
    }
  }

  // Private helper methods

  private async initializeCryptography(): Promise<void> {
    try {
      // Generate or load RSA key pair
      const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
        modulusLength: this.cryptoConfig.keySize,
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
      });

      this.publicKey = publicKey;
      this.privateKey = privateKey;

      // Initialize genesis block
      this.lastBlockHash = crypto.createHash(this.cryptoConfig.hashAlgorithm)
        .update('YieldSensei-Genesis-Block')
        .digest('hex');

      logger.info('Cryptography initialized', {
        algorithm: this.cryptoConfig.algorithm,
        keySize: this.cryptoConfig.keySize
      });
    } catch (error) {
      logger.error('Error initializing cryptography:', error);
      throw error;
    }
  }

  private async createSignedEntry(
    entry: Omit<AuditEntry, 'id' | 'timestamp'>,
    baseId: string
  ): Promise<SignedAuditEntry> {
    const timestamp = new Date();
    const blockNumber = ++this.currentBlockNumber;

    // Create entry data for signing
    const entryData = {
      id: baseId,
      timestamp,
      blockNumber,
      previousHash: this.lastBlockHash,
      ...entry
    };

    // Generate hash chain
    const entryHash = crypto.createHash(this.cryptoConfig.hashAlgorithm)
      .update(JSON.stringify(entryData))
      .digest('hex');

    // Create digital signature
    const signature = crypto.sign('sha256', Buffer.from(entryHash), {
      key: this.privateKey,
      padding: crypto.constants.RSA_PKCS1_PSS_PADDING
    });

    const signedEntry: SignedAuditEntry = {
      ...entryData,
      digitalSignature: signature.toString('hex'),
      hashChain: entryHash,
      previousHash: this.lastBlockHash,
      signatureAlgorithm: this.cryptoConfig.algorithm,
      publicKey: this.publicKey,
      verificationStatus: 'verified'
    };

    // Update last block hash
    this.lastBlockHash = entryHash;

    return signedEntry;
  }

  private async verifySignedEntry(entry: SignedAuditEntry): Promise<boolean> {
    try {
      // Recreate entry data
      const entryData = {
        id: entry.id,
        timestamp: entry.timestamp,
        blockNumber: entry.blockNumber,
        previousHash: entry.previousHash,
        entityType: entry.entityType,
        entityId: entry.entityId,
        action: entry.action,
        userId: entry.userId,
        before: entry.before,
        after: entry.after,
        reason: entry.reason,
        jurisdiction: entry.jurisdiction,
        compliance: entry.compliance,
        ipAddress: entry.ipAddress,
        userAgent: entry.userAgent
      };

      // Verify hash
      const expectedHash = crypto.createHash(this.cryptoConfig.hashAlgorithm)
        .update(JSON.stringify(entryData))
        .digest('hex');

      if (expectedHash !== entry.hashChain) {
        return false;
      }

      // Verify signature
      const isValid = crypto.verify(
        'sha256',
        Buffer.from(entry.hashChain),
        {
          key: entry.publicKey,
          padding: crypto.constants.RSA_PKCS1_PSS_PADDING
        },
        Buffer.from(entry.digitalSignature, 'hex')
      );

      return isValid;
    } catch (error) {
      logger.error('Error verifying signed entry:', error);
      return false;
    }
  }

  private async verifyHashChain(): Promise<boolean> {
    const entries = Array.from(this.signedEntries.values())
      .sort((a, b) => a.blockNumber - b.blockNumber);

    for (let i = 1; i < entries.length; i++) {
      const current = entries[i];
      const previous = entries[i - 1];

      if (!current || !previous) {
        return false;
      }

      if (current.previousHash !== previous.hashChain) {
        return false;
      }
    }

    return true;
  }

  private async createChainOfCustody(
    attachment: EvidenceAttachment,
    custodian: string
  ): Promise<ChainOfCustody> {
    const custodyRecord: CustodyRecord = {
      id: this.generateId('custody'),
      custodian,
      action: 'created',
      timestamp: new Date(),
      reason: 'Evidence uploaded',
      signature: crypto.createHash('sha256').update(`${attachment.id}-${custodian}-created`).digest('hex'),
      metadata: { attachmentId: attachment.id }
    };

    const custodyChain: ChainOfCustody = {
      id: this.generateId('chain'),
      evidenceId: attachment.id,
      auditEntryId: attachment.auditEntryId,
      custodyChain: [custodyRecord],
      currentCustodian: custodian,
      status: 'active',
      createdAt: new Date()
    };

    this.custodyChains.set(custodyChain.id, custodyChain);

    return custodyChain;
  }

  private async storeEvidenceFile(attachment: EvidenceAttachment, buffer: Buffer): Promise<void> {
    // Implementation would store file to secure storage (S3, etc.)
    logger.debug('Storing evidence file', { attachmentId: attachment.id });
  }

  private async collectAuditData(
    jurisdiction: Jurisdiction,
    period: { startDate: Date; endDate: Date }
  ): Promise<any> {
    // Implementation would collect relevant audit data for the period
    return {
      entries: await this.querySignedEntries({
        jurisdiction,
        startDate: period.startDate,
        endDate: period.endDate,
        compliance: true
      }),
      statistics: {
        totalEntries: 0,
        complianceActions: 0,
        violations: 0
      }
    };
  }

  private async generateReportContent(template: ReportTemplate, auditData: any): Promise<any> {
    // Implementation would generate report content based on template and data
    return {
      summary: 'Generated compliance report summary',
      findings: [],
      recommendations: [],
      attachments: [],
      metadata: {}
    };
  }

  private async getDefaultTemplate(type: string, jurisdiction: Jurisdiction): Promise<ReportTemplate | null> {
    // Implementation would return default template for the type and jurisdiction
    return null;
  }

  private setupScheduledReporting(): void {
    // Set up daily, weekly, monthly report generation
    logger.info('Setting up scheduled reporting');
  }

  private async loadSignedEntries(): Promise<void> {
    // Implementation would load existing signed entries from database
    logger.debug('Loading signed audit entries');
  }

  private async loadReportTemplates(): Promise<void> {
    // Implementation would load report templates from database
    logger.debug('Loading report templates');
  }

  private async persistSignedEntry(entry: SignedAuditEntry): Promise<void> {
    // Implementation would persist signed entry to database
    logger.debug('Persisting signed audit entry', { entryId: entry.id });
  }

  private generateId(prefix: string): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

export default EnhancedAuditTrailService; 