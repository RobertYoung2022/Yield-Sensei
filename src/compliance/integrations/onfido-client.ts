/**
 * Onfido KYC Provider Integration
 * Identity verification and document checking through Onfido
 */

import { EventEmitter } from 'events';
import Logger from '../../shared/logging/logger';
import {
  KYCDocument,
  DocumentType,
  KYCLevel,
  User
} from '../types';

const logger = Logger.getLogger('onfido-client');

export interface OnfidoConfig {
  apiKey: string;
  baseUrl: string;
  webhookUrl?: string;
  region: 'EU' | 'US' | 'CA';
  environment: 'sandbox' | 'live';
}

export interface OnfidoApplicant {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  dob?: string;
  address?: {
    flatNumber?: string;
    buildingNumber?: string;
    buildingName?: string;
    street: string;
    subStreet?: string;
    town: string;
    postcode: string;
    country: string;
  };
  idNumbers?: Array<{
    type: 'ssn' | 'social_insurance' | 'tax_id' | 'identity_card' | 'driving_licence';
    value: string;
    stateCode?: string;
  }>;
}

export interface OnfidoCheck {
  id: string;
  status: 'in_progress' | 'awaiting_applicant' | 'complete' | 'withdrawn' | 'paused' | 'reopened';
  result: 'clear' | 'consider' | 'unidentified';
  downloadUri?: string;
  formUri?: string;
  redirectUri?: string;
  resultsUri: string;
  reports: OnfidoReport[];
  tags?: string[];
  applicantId: string;
  createdAt: Date;
  href: string;
}

export interface OnfidoReport {
  id: string;
  name: 'document' | 'facial_similarity_photo' | 'facial_similarity_video' | 'identity_enhanced' | 'watchlist_enhanced' | 'proof_of_address';
  status: 'awaiting_data' | 'awaiting_approval' | 'complete' | 'withdrawn' | 'paused' | 'cancelled';
  result: 'clear' | 'consider' | 'unidentified';
  subResult?: 'clear' | 'rejected' | 'suspected' | 'caution';
  breakdown?: Record<string, any>;
  properties?: Record<string, any>;
  createdAt: Date;
  href: string;
}

export interface OnfidoDocument {
  id: string;
  type: 'passport' | 'driving_licence' | 'national_identity_card' | 'residence_permit' | 'tax_id' | 'voter_id' | 'work_permit' | 'utility_bill' | 'bank_building_society_statement' | 'council_tax' | 'benefit_letters';
  side?: 'front' | 'back';
  issuingCountry?: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  href: string;
  downloadHref: string;
  createdAt: Date;
}

export interface OnfidoSDKToken {
  token: string;
  applicantId: string;
}

export interface OnfidoWatchlistMonitoring {
  id: string;
  applicantId: string;
  reportName: 'watchlist_standard' | 'watchlist_aml' | 'watchlist_enhanced';
  status: 'in_progress' | 'awaiting_input' | 'complete';
  tags?: string[];
  createdAt: Date;
  updatedAt: Date;
}

export class OnfidoClient extends EventEmitter {
  private config: OnfidoConfig;
  private isInitialized = false;

  constructor(config: OnfidoConfig) {
    super();
    this.config = config;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.warn('Onfido client already initialized');
      return;
    }

    try {
      logger.info('Initializing Onfido client...');

      // Validate configuration
      if (!this.config.apiKey) {
        throw new Error('Onfido API key is required');
      }

      // Test connection
      await this.testConnection();

      this.isInitialized = true;
      logger.info('✅ Onfido client initialized successfully');

    } catch (error) {
      logger.error('Failed to initialize Onfido client:', error);
      throw error;
    }
  }

  /**
   * Create applicant for verification
   */
  async createApplicant(applicantData: Omit<OnfidoApplicant, 'id'>): Promise<OnfidoApplicant> {
    try {
      logger.info('Creating Onfido applicant', {
        firstName: applicantData.firstName,
        lastName: applicantData.lastName
      });

      // Mock implementation
      const applicant: OnfidoApplicant = {
        id: this.generateApplicantId(),
        ...applicantData
      };

      logger.info('Onfido applicant created', {
        applicantId: applicant.id,
        firstName: applicant.firstName,
        lastName: applicant.lastName
      });

      this.emit('applicant_created', {
        applicant,
        timestamp: new Date()
      });

      return applicant;

    } catch (error) {
      logger.error('Error creating Onfido applicant:', error);
      throw error;
    }
  }

  /**
   * Generate SDK token for frontend integration
   */
  async generateSDKToken(applicantId: string, referrer?: string): Promise<OnfidoSDKToken> {
    try {
      logger.info('Generating Onfido SDK token', { applicantId });

      // Mock implementation
      const token: OnfidoSDKToken = {
        token: this.generateToken(),
        applicantId
      };

      logger.info('Onfido SDK token generated', { applicantId });

      return token;

    } catch (error) {
      logger.error('Error generating Onfido SDK token:', error);
      throw error;
    }
  }

  /**
   * Create verification check
   */
  async createCheck(applicantId: string, reports: string[], tags?: string[]): Promise<OnfidoCheck> {
    try {
      logger.info('Creating Onfido check', {
        applicantId,
        reports,
        tags
      });

      // Mock implementation
      const check: OnfidoCheck = {
        id: this.generateCheckId(),
        status: 'in_progress',
        result: 'unidentified',
        resultsUri: `${this.config.baseUrl}/checks/${this.generateCheckId()}`,
        reports: reports.map(reportName => ({
          id: this.generateReportId(),
          name: reportName as any,
          status: 'awaiting_data',
          result: 'unidentified',
          createdAt: new Date(),
          href: `${this.config.baseUrl}/reports/${this.generateReportId()}`
        })),
        tags,
        applicantId,
        createdAt: new Date(),
        href: `${this.config.baseUrl}/checks/${this.generateCheckId()}`
      };

      logger.info('Onfido check created', {
        checkId: check.id,
        applicantId,
        reports: reports.length
      });

      this.emit('check_created', {
        check,
        timestamp: new Date()
      });

      return check;

    } catch (error) {
      logger.error('Error creating Onfido check:', error);
      throw error;
    }
  }

  /**
   * Get check result
   */
  async getCheck(checkId: string): Promise<OnfidoCheck> {
    try {
      logger.info('Retrieving Onfido check', { checkId });

      // Mock implementation - simulate completed check
      const check: OnfidoCheck = {
        id: checkId,
        status: 'complete',
        result: 'clear',
        downloadUri: `${this.config.baseUrl}/checks/${checkId}/download`,
        resultsUri: `${this.config.baseUrl}/checks/${checkId}`,
        reports: [
          {
            id: this.generateReportId(),
            name: 'document',
            status: 'complete',
            result: 'clear',
            breakdown: {
              visual_authenticity: { result: 'clear' },
              fonts: { result: 'clear' },
              picture_face_integrity: { result: 'clear' },
              template: { result: 'clear' },
              security_features: { result: 'clear' },
              document_numbers: { result: 'clear' }
            },
            createdAt: new Date(),
            href: `${this.config.baseUrl}/reports/${this.generateReportId()}`
          },
          {
            id: this.generateReportId(),
            name: 'facial_similarity_photo',
            status: 'complete',
            result: 'clear',
            breakdown: {
              face_comparison: { result: 'clear' },
              image_integrity: { result: 'clear' }
            },
            createdAt: new Date(),
            href: `${this.config.baseUrl}/reports/${this.generateReportId()}`
          }
        ],
        applicantId: 'applicant_123',
        createdAt: new Date(),
        href: `${this.config.baseUrl}/checks/${checkId}`
      };

      logger.info('Onfido check retrieved', {
        checkId,
        status: check.status,
        result: check.result
      });

      return check;

    } catch (error) {
      logger.error('Error retrieving Onfido check:', error);
      throw error;
    }
  }

  /**
   * Upload document
   */
  async uploadDocument(
    applicantId: string,
    file: Buffer,
    type: string,
    side?: 'front' | 'back'
  ): Promise<OnfidoDocument> {
    try {
      logger.info('Uploading document to Onfido', {
        applicantId,
        type,
        side,
        fileSize: file.length
      });

      // Mock implementation
      const document: OnfidoDocument = {
        id: this.generateDocumentId(),
        type: type as any,
        side,
        fileName: `document_${Date.now()}.jpg`,
        fileSize: file.length,
        fileType: 'image/jpeg',
        href: `${this.config.baseUrl}/documents/${this.generateDocumentId()}`,
        downloadHref: `${this.config.baseUrl}/documents/${this.generateDocumentId()}/download`,
        createdAt: new Date()
      };

      logger.info('Document uploaded to Onfido', {
        documentId: document.id,
        applicantId,
        type
      });

      this.emit('document_uploaded', {
        document,
        applicantId,
        timestamp: new Date()
      });

      return document;

    } catch (error) {
      logger.error('Error uploading document to Onfido:', error);
      throw error;
    }
  }

  /**
   * Set up watchlist monitoring
   */
  async createWatchlistMonitoring(
    applicantId: string,
    reportName: 'watchlist_standard' | 'watchlist_aml' | 'watchlist_enhanced' = 'watchlist_enhanced'
  ): Promise<OnfidoWatchlistMonitoring> {
    try {
      logger.info('Creating watchlist monitoring', {
        applicantId,
        reportName
      });

      // Mock implementation
      const monitoring: OnfidoWatchlistMonitoring = {
        id: this.generateMonitoringId(),
        applicantId,
        reportName,
        status: 'in_progress',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      logger.info('Watchlist monitoring created', {
        monitoringId: monitoring.id,
        applicantId,
        reportName
      });

      this.emit('monitoring_created', {
        monitoring,
        timestamp: new Date()
      });

      return monitoring;

    } catch (error) {
      logger.error('Error creating watchlist monitoring:', error);
      throw error;
    }
  }

  /**
   * Handle webhook callback
   */
  async handleWebhook(payload: any, signature: string): Promise<void> {
    try {
      // Verify webhook signature
      if (!this.verifyWebhookSignature(payload, signature)) {
        throw new Error('Invalid webhook signature');
      }

      logger.info('Processing Onfido webhook', {
        resourceType: payload.resource_type,
        action: payload.action,
        objectId: payload.object?.id
      });

      this.emit('webhook_received', {
        payload,
        timestamp: new Date()
      });

      // Handle different webhook types
      switch (payload.resource_type) {
        case 'check':
          this.emit('check_updated', payload.object);
          break;
        case 'report':
          this.emit('report_updated', payload.object);
          break;
        case 'watchlist_monitor':
          this.emit('monitoring_updated', payload.object);
          break;
        default:
          logger.debug('Unhandled webhook type', { type: payload.resource_type });
      }

    } catch (error) {
      logger.error('Error handling Onfido webhook:', error);
      throw error;
    }
  }

  /**
   * Get supported document types for country
   */
  getSupportedDocumentTypes(country: string): DocumentType[] {
    const supportedByCountry: Record<string, DocumentType[]> = {
      'US': ['passport', 'drivers-license'],
      'UK': ['passport', 'drivers-license'],
      'CA': ['passport', 'drivers-license'],
      'DE': ['passport', 'national-id'],
      'FR': ['passport', 'national-id'],
      'DEFAULT': ['passport', 'national-id']
    };

    return supportedByCountry[country] || supportedByCountry['DEFAULT'];
  }

  /**
   * Convert Onfido check to KYC document
   */
  convertToKYCDocument(check: OnfidoCheck): KYCDocument {
    const documentReport = check.reports.find(r => r.name === 'document');
    
    return {
      type: 'passport', // Would be determined from document report
      status: this.mapCheckStatus(check.result),
      uploadDate: check.createdAt,
      verificationDate: documentReport?.status === 'complete' ? new Date() : undefined,
      provider: 'onfido',
      documentId: check.id
    };
  }

  /**
   * Get client status
   */
  getStatus(): any {
    return {
      initialized: this.isInitialized,
      provider: 'onfido',
      environment: this.config.environment,
      region: this.config.region,
      webhookConfigured: !!this.config.webhookUrl
    };
  }

  // Private methods

  private async testConnection(): Promise<void> {
    // Mock connection test
    logger.debug('Testing Onfido API connection');
    // In production, this would make a test API call
  }

  private generateApplicantId(): string {
    return `onfido_applicant_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateCheckId(): string {
    return `onfido_check_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateReportId(): string {
    return `onfido_report_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateDocumentId(): string {
    return `onfido_doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateMonitoringId(): string {
    return `onfido_monitor_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateToken(): string {
    return `onfido_token_${Date.now()}_${Math.random().toString(36).substr(2, 16)}`;
  }

  private verifyWebhookSignature(payload: any, signature: string): boolean {
    // Mock signature verification
    // In production, this would verify HMAC signature with webhook secret
    return signature && signature.length > 0;
  }

  private mapCheckStatus(result: string): 'pending' | 'approved' | 'rejected' {
    switch (result) {
      case 'clear':
        return 'approved';
      case 'consider':
      case 'unidentified':
        return 'rejected';
      default:
        return 'pending';
    }
  }
}