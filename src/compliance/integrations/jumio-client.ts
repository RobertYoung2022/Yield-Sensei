/**
 * Jumio KYC Provider Integration
 * Identity verification and document checking through Jumio
 */

import { EventEmitter } from 'events';
import Logger from '../../shared/logging/logger';
import {
  KYCDocument,
  DocumentType,
  KYCLevel,
  User
} from '../types';

const logger = Logger.getLogger('jumio-client');

export interface JumioConfig {
  apiKey: string;
  apiSecret: string;
  baseUrl: string;
  webhookUrl?: string;
  enableCallbacks: boolean;
  environment: 'sandbox' | 'production';
}

export interface JumioVerificationRequest {
  userId: string;
  userReference: string;
  successUrl?: string;
  errorUrl?: string;
  callbackUrl?: string;
  enabledFields: string[];
  presets: JumioPreset[];
  customization: {
    primaryColor?: string;
    secondaryColor?: string;
    locale?: string;
  };
}

export interface JumioPreset {
  index: number;
  country: string;
  type: 'ID' | 'PASSPORT' | 'DRIVING_LICENSE';
  enableExtraction: boolean;
}

export interface JumioVerificationResult {
  transactionReference: string;
  status: 'APPROVED_VERIFIED' | 'DENIED_FRAUD' | 'DENIED_UNSUPPORTED_ID_TYPE' | 'ERROR_NOT_READABLE_ID' | 'NO_ID_UPLOADED';
  verificationStatus: 'APPROVED_VERIFIED' | 'DENIED_FRAUD' | 'DENIED_UNSUPPORTED_ID_TYPE' | 'ERROR_NOT_READABLE_ID' | 'NO_ID_UPLOADED';
  idScanStatus: 'SUCCESS' | 'ERROR';
  idCheckStatus: 'OK' | 'N/A';
  idCheckDataPositions: 'OK' | 'N/A';
  idCheckHologram: 'OK' | 'N/A';
  idCheckMicroprint: 'OK' | 'N/A';
  idCheckDocumentValidation: 'OK' | 'N/A';
  idCheckSecurityFeatures: 'OK' | 'N/A';
  idCheckSignature: 'OK' | 'N/A';
  extractedData: {
    firstName?: string;
    lastName?: string;
    dateOfBirth?: string;
    issuingDate?: string;
    expiryDate?: string;
    idNumber?: string;
    issuingCountry?: string;
    addressLine?: string;
    city?: string;
    subdivision?: string;
    postalCode?: string;
  };
  livenessImages?: {
    face: string;
    faceManipulated: boolean;
  };
  similarityDecision: 'MATCH' | 'NO_MATCH' | 'NOT_POSSIBLE';
  validityDecision: 'PASSED' | 'WARNING' | 'REJECTED';
  timestamp: Date;
}

export interface BiometricVerificationResult {
  similarity: number;
  validity: 'PASSED' | 'WARNING' | 'REJECTED';
  reason?: string;
  liveness: boolean;
  confidence: number;
}

export class JumioClient extends EventEmitter {
  private config: JumioConfig;
  private isInitialized = false;

  constructor(config: JumioConfig) {
    super();
    this.config = config;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.warn('Jumio client already initialized');
      return;
    }

    try {
      logger.info('Initializing Jumio client...');

      // Validate configuration
      if (!this.config.apiKey || !this.config.apiSecret) {
        throw new Error('Jumio API key and secret are required');
      }

      // Test connection
      await this.testConnection();

      this.isInitialized = true;
      logger.info('✅ Jumio client initialized successfully');

    } catch (error) {
      logger.error('Failed to initialize Jumio client:', error);
      throw error;
    }
  }

  /**
   * Create verification session for user
   */
  async createVerificationSession(request: JumioVerificationRequest): Promise<{
    transactionReference: string;
    redirectUrl: string;
  }> {
    try {
      logger.info('Creating Jumio verification session', {
        userId: request.userId,
        userReference: request.userReference
      });

      // Mock implementation - in production, this would make actual API calls
      const transactionReference = this.generateTransactionReference();
      const redirectUrl = `${this.config.baseUrl}/web/v4/app?authorizationToken=${this.generateAuthToken()}`;

      const response = {
        transactionReference,
        redirectUrl
      };

      logger.info('Jumio verification session created', {
        transactionReference,
        userId: request.userId
      });

      this.emit('session_created', {
        transactionReference,
        userId: request.userId,
        timestamp: new Date()
      });

      return response;

    } catch (error) {
      logger.error('Error creating Jumio verification session:', error);
      throw error;
    }
  }

  /**
   * Get verification result
   */
  async getVerificationResult(transactionReference: string): Promise<JumioVerificationResult> {
    try {
      logger.info('Retrieving Jumio verification result', { transactionReference });

      // Mock implementation - in production, this would fetch from Jumio API
      const result: JumioVerificationResult = {
        transactionReference,
        status: 'APPROVED_VERIFIED',
        verificationStatus: 'APPROVED_VERIFIED',
        idScanStatus: 'SUCCESS',
        idCheckStatus: 'OK',
        idCheckDataPositions: 'OK',
        idCheckHologram: 'OK',
        idCheckMicroprint: 'OK',
        idCheckDocumentValidation: 'OK',
        idCheckSecurityFeatures: 'OK',
        idCheckSignature: 'OK',
        extractedData: {
          firstName: 'John',
          lastName: 'Doe',
          dateOfBirth: '1990-01-01',
          issuingDate: '2020-01-01',
          expiryDate: '2030-01-01',
          idNumber: 'ID123456789',
          issuingCountry: 'US',
          addressLine: '123 Main St',
          city: 'New York',
          subdivision: 'NY',
          postalCode: '10001'
        },
        livenessImages: {
          face: 'base64_encoded_image',
          faceManipulated: false
        },
        similarityDecision: 'MATCH',
        validityDecision: 'PASSED',
        timestamp: new Date()
      };

      logger.info('Jumio verification result retrieved', {
        transactionReference,
        status: result.status,
        similarity: result.similarityDecision
      });

      this.emit('verification_completed', {
        transactionReference,
        result,
        timestamp: new Date()
      });

      return result;

    } catch (error) {
      logger.error('Error retrieving Jumio verification result:', error);
      throw error;
    }
  }

  /**
   * Perform biometric verification
   */
  async verifyBiometrics(
    transactionReference: string,
    faceImage: string
  ): Promise<BiometricVerificationResult> {
    try {
      logger.info('Performing biometric verification', { transactionReference });

      // Mock implementation
      const result: BiometricVerificationResult = {
        similarity: 0.95,
        validity: 'PASSED',
        liveness: true,
        confidence: 0.98
      };

      logger.info('Biometric verification completed', {
        transactionReference,
        similarity: result.similarity,
        validity: result.validity
      });

      return result;

    } catch (error) {
      logger.error('Error performing biometric verification:', error);
      throw error;
    }
  }

  /**
   * Handle webhook callback from Jumio
   */
  async handleWebhook(payload: any, signature: string): Promise<void> {
    try {
      // Verify webhook signature
      if (!this.verifyWebhookSignature(payload, signature)) {
        throw new Error('Invalid webhook signature');
      }

      logger.info('Processing Jumio webhook', {
        transactionReference: payload.transactionReference,
        status: payload.verificationStatus
      });

      this.emit('webhook_received', {
        payload,
        timestamp: new Date()
      });

    } catch (error) {
      logger.error('Error handling Jumio webhook:', error);
      throw error;
    }
  }

  /**
   * Check if document type is supported
   */
  isDocumentTypeSupported(documentType: DocumentType, country: string): boolean {
    const supportedTypes: Record<string, DocumentType[]> = {
      'US': ['passport', 'drivers-license', 'national-id'],
      'EU': ['passport', 'national-id'],
      'UK': ['passport', 'drivers-license'],
      'DEFAULT': ['passport', 'national-id']
    };

    const types = supportedTypes[country] || supportedTypes['DEFAULT'];
    return types.includes(documentType);
  }

  /**
   * Get supported countries
   */
  getSupportedCountries(): string[] {
    return [
      'US', 'CA', 'UK', 'DE', 'FR', 'IT', 'ES', 'NL', 'AU', 'JP',
      'SG', 'HK', 'CH', 'SE', 'NO', 'DK', 'FI', 'BE', 'AT', 'IE'
    ];
  }

  /**
   * Convert Jumio result to KYC document format
   */
  convertToKYCDocument(result: JumioVerificationResult): KYCDocument {
    return {
      type: this.mapDocumentType(result.extractedData),
      status: this.mapVerificationStatus(result.status),
      uploadDate: new Date(),
      verificationDate: result.timestamp,
      expiryDate: result.extractedData.expiryDate ? new Date(result.extractedData.expiryDate) : undefined,
      provider: 'jumio',
      documentId: result.transactionReference
    };
  }

  /**
   * Get client status
   */
  getStatus(): any {
    return {
      initialized: this.isInitialized,
      provider: 'jumio',
      environment: this.config.environment,
      callbacksEnabled: this.config.enableCallbacks,
      supportedCountries: this.getSupportedCountries().length
    };
  }

  // Private methods

  private async testConnection(): Promise<void> {
    // Mock connection test
    logger.debug('Testing Jumio API connection');
    // In production, this would make a test API call
  }

  private generateTransactionReference(): string {
    return `jumio_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateAuthToken(): string {
    return `auth_${Date.now()}_${Math.random().toString(36).substr(2, 16)}`;
  }

  private verifyWebhookSignature(payload: any, signature: string): boolean {
    // Mock signature verification
    // In production, this would verify HMAC signature
    return signature && signature.length > 0;
  }

  private mapDocumentType(extractedData: any): DocumentType {
    // Map based on document characteristics
    if (extractedData.idNumber?.startsWith('P')) return 'passport';
    if (extractedData.addressLine) return 'drivers-license';
    return 'national-id';
  }

  private mapVerificationStatus(status: string): 'pending' | 'approved' | 'rejected' {
    switch (status) {
      case 'APPROVED_VERIFIED':
        return 'approved';
      case 'DENIED_FRAUD':
      case 'DENIED_UNSUPPORTED_ID_TYPE':
      case 'ERROR_NOT_READABLE_ID':
        return 'rejected';
      default:
        return 'pending';
    }
  }
}