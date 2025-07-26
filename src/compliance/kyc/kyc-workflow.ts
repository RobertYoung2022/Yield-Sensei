/**
 * KYC Workflow Manager
 * Orchestrates Know Your Customer verification processes across providers
 */

import { EventEmitter } from 'events';
import Logger from '../../shared/logging/logger';
import {
  User,
  KYCConfig,
  KYCStatus,
  KYCDocument,
  KYCLevel,
  DocumentType,
  ActivityLevel,
  ComplianceViolation,
  RiskLevel
} from '../types';

const logger = Logger.getLogger('kyc-workflow');

interface KYCAssessmentResult {
  compliant: boolean;
  status: 'approved' | 'rejected' | 'pending' | 'requires-review';
  requiredLevel: KYCLevel;
  currentLevel: KYCLevel;
  missingDocuments: DocumentType[];
  violations: ComplianceViolation[];
  recommendations: string[];
  nextReviewDate: Date;
  confidence: number;
}

interface KYCVerificationRequest {
  userId: string;
  documents: KYCDocument[];
  level: KYCLevel;
  provider: string;
  submittedAt: Date;
}

interface KYCProviderResult {
  provider: string;
  success: boolean;
  confidence: number;
  status: 'approved' | 'rejected' | 'pending';
  findings: string[];
  metadata: Record<string, any>;
}

export class KYCWorkflow extends EventEmitter {
  private config: KYCConfig;
  private isInitialized = false;
  private pendingVerifications: Map<string, KYCVerificationRequest> = new Map();
  private verificationHistory: Map<string, KYCProviderResult[]> = new Map();
  private kycStats = {
    totalSubmissions: 0,
    autoApprovals: 0,
    manualReviews: 0,
    rejections: 0,
    averageProcessingTime: 0
  };

  constructor(config: KYCConfig) {
    super();
    this.config = config;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.warn('KYC Workflow already initialized');
      return;
    }

    try {
      logger.info('Initializing KYC Workflow...');

      // Validate provider configurations
      await this.validateProviderConfigurations();

      this.isInitialized = true;
      logger.info('✅ KYC Workflow initialized successfully');

    } catch (error) {
      logger.error('Failed to initialize KYC Workflow:', error);
      throw error;
    }
  }

  async updateConfiguration(newConfig: KYCConfig): Promise<void> {
    this.config = newConfig;
    await this.validateProviderConfigurations();
    logger.info('KYC Workflow configuration updated');
  }

  /**
   * Assess user's current KYC compliance status
   */
  async assessUserKYC(user: User): Promise<KYCAssessmentResult> {
    try {
      logger.debug('Assessing user KYC status', {
        userId: user.id,
        currentLevel: user.kycStatus.level,
        activityLevel: user.activityLevel
      });

      // Get required KYC level for user's activity level
      const requirement = this.getKYCRequirement(user.activityLevel);
      const requiredLevel = requirement.requiredLevel;
      const currentLevel = user.kycStatus.level;

      // Check if current level meets requirement
      const levelHierarchy = { 'basic': 1, 'enhanced': 2, 'professional': 3, 'institutional': 4 };
      const requiredLevelValue = levelHierarchy[requiredLevel];
      const currentLevelValue = levelHierarchy[currentLevel];

      const levelCompliant = currentLevelValue >= requiredLevelValue;
      const statusCompliant = user.kycStatus.status === 'approved';
      const notExpired = !user.kycStatus.expiryDate || user.kycStatus.expiryDate > new Date();

      const compliant = levelCompliant && statusCompliant && notExpired;

      // Check for missing documents
      const missingDocuments = this.getMissingDocuments(user, requirement);

      // Generate violations if not compliant
      const violations: ComplianceViolation[] = [];
      if (!compliant) {
        violations.push(...await this.generateKYCViolations(user, requirement));
      }

      // Generate recommendations
      const recommendations = this.generateKYCRecommendations(user, requirement, missingDocuments);

      // Calculate next review date
      const nextReviewDate = this.calculateNextKYCReview(user, requirement);

      // Calculate confidence score
      const confidence = this.calculateKYCConfidence(user, requirement);

      const result: KYCAssessmentResult = {
        compliant,
        status: this.determineKYCStatus(user, requirement),
        requiredLevel,
        currentLevel,
        missingDocuments,
        violations,
        recommendations,
        nextReviewDate,
        confidence
      };

      logger.debug('KYC assessment completed', {
        userId: user.id,
        compliant,
        requiredLevel,
        currentLevel,
        missingDocumentsCount: missingDocuments.length,
        violationsCount: violations.length
      });

      return result;

    } catch (error) {
      logger.error('Error assessing user KYC:', error);
      throw error;
    }
  }

  /**
   * Submit KYC documents for verification
   */
  async submitKYCDocuments(
    user: User,
    documents: KYCDocument[],
    targetLevel: KYCLevel
  ): Promise<string> {
    const startTime = Date.now();

    try {
      const requestId = this.generateRequestId();
      
      logger.info('Submitting KYC documents', {
        userId: user.id,
        requestId,
        targetLevel,
        documentsCount: documents.length
      });

      // Create verification request
      const request: KYCVerificationRequest = {
        userId: user.id,
        documents,
        level: targetLevel,
        provider: this.getPrimaryProvider().name,
        submittedAt: new Date()
      };

      this.pendingVerifications.set(requestId, request);
      this.kycStats.totalSubmissions++;

      // Emit submission event
      this.emit('kyc_submitted', {
        userId: user.id,
        requestId,
        targetLevel,
        documents: documents.map(d => ({ type: d.type, status: d.status })),
        timestamp: new Date()
      });

      // Process verification asynchronously
      this.processKYCVerification(requestId, request).catch(error => {
        logger.error('Error processing KYC verification:', error);
      });

      return requestId;

    } catch (error) {
      logger.error('Error submitting KYC documents:', error);
      throw error;
    }
  }

  /**
   * Get KYC verification status
   */
  async getVerificationStatus(requestId: string): Promise<any> {
    const request = this.pendingVerifications.get(requestId);
    if (!request) {
      throw new Error(`Verification request not found: ${requestId}`);
    }

    const history = this.verificationHistory.get(requestId) || [];

    return {
      requestId,
      userId: request.userId,
      status: history.length > 0 ? history[history.length - 1].status : 'pending',
      submittedAt: request.submittedAt,
      provider: request.provider,
      level: request.level,
      history
    };
  }

  /**
   * Get KYC requirements for activity level
   */
  getKYCRequirement(activityLevel: ActivityLevel): any {
    return this.config.requirements.find(req => req.activityLevel === activityLevel) ||
           this.config.requirements.find(req => req.activityLevel === 'retail'); // Default fallback
  }

  /**
   * Check if documents are sufficient for level
   */
  checkDocumentSufficiency(documents: KYCDocument[], targetLevel: KYCLevel): boolean {
    const requirement = this.config.requirements.find(req => req.requiredLevel === targetLevel);
    if (!requirement) return false;

    const providedTypes = new Set(documents.filter(d => d.status === 'approved').map(d => d.type));
    return requirement.documents.every(required => providedTypes.has(required));
  }

  /**
   * Get workflow statistics
   */
  getStatistics(): any {
    return {
      ...this.kycStats,
      pendingVerifications: this.pendingVerifications.size,
      totalProcessed: this.verificationHistory.size,
      autoApprovalRate: this.kycStats.totalSubmissions > 0 ? 
        this.kycStats.autoApprovals / this.kycStats.totalSubmissions : 0,
      rejectionRate: this.kycStats.totalSubmissions > 0 ? 
        this.kycStats.rejections / this.kycStats.totalSubmissions : 0
    };
  }

  /**
   * Get workflow status
   */
  getStatus(): any {
    const enabledProviders = this.config.providers.filter(p => p.enabled);
    const primaryProvider = enabledProviders.find(p => p.primary);

    return {
      initialized: this.isInitialized,
      enabledProviders: enabledProviders.length,
      primaryProvider: primaryProvider?.name || 'none',
      autoApprovalEnabled: this.config.automation.autoApprove,
      confidenceThreshold: this.config.automation.confidenceThreshold,
      pendingVerifications: this.pendingVerifications.size,
      statistics: this.getStatistics()
    };
  }

  // Private methods

  private async validateProviderConfigurations(): Promise<void> {
    const enabledProviders = this.config.providers.filter(p => p.enabled);
    
    if (enabledProviders.length === 0) {
      throw new Error('At least one KYC provider must be enabled');
    }

    const primaryProviders = enabledProviders.filter(p => p.primary);
    if (primaryProviders.length !== 1) {
      throw new Error('Exactly one primary KYC provider must be configured');
    }

    // Validate each provider configuration
    for (const provider of enabledProviders) {
      if (!provider.apiKey || !provider.endpoint) {
        throw new Error(`Invalid configuration for provider: ${provider.name}`);
      }
    }

    logger.debug('KYC provider configurations validated');
  }

  private getPrimaryProvider(): any {
    return this.config.providers.find(p => p.enabled && p.primary);
  }

  private getMissingDocuments(user: User, requirement: any): DocumentType[] {
    const providedTypes = new Set(
      user.kycStatus.documents
        .filter(d => d.status === 'approved')
        .map(d => d.type)
    );

    return requirement.documents.filter((required: DocumentType) => !providedTypes.has(required));
  }

  private async generateKYCViolations(user: User, requirement: any): Promise<ComplianceViolation[]> {
    const violations: ComplianceViolation[] = [];

    // Level violation
    const levelHierarchy = { 'basic': 1, 'enhanced': 2, 'professional': 3, 'institutional': 4 };
    const requiredLevelValue = levelHierarchy[requirement.requiredLevel];
    const currentLevelValue = levelHierarchy[user.kycStatus.level];

    if (currentLevelValue < requiredLevelValue) {
      violations.push({
        id: this.generateViolationId(),
        ruleId: `kyc-level-${requirement.activityLevel}`,
        entityType: 'user',
        entityId: user.id,
        jurisdiction: user.jurisdiction,
        category: 'kyc-aml',
        severity: 'high',
        description: `Insufficient KYC level: requires ${requirement.requiredLevel}, has ${user.kycStatus.level}`,
        details: {
          requiredLevel: requirement.requiredLevel,
          currentLevel: user.kycStatus.level,
          activityLevel: user.activityLevel
        },
        detectedAt: new Date(),
        status: 'open',
        escalated: false
      });
    }

    // Status violation
    if (user.kycStatus.status !== 'approved') {
      violations.push({
        id: this.generateViolationId(),
        ruleId: `kyc-status-${requirement.activityLevel}`,
        entityType: 'user',
        entityId: user.id,
        jurisdiction: user.jurisdiction,
        category: 'kyc-aml',
        severity: 'medium',
        description: `KYC status not approved: ${user.kycStatus.status}`,
        details: {
          currentStatus: user.kycStatus.status,
          requiredStatus: 'approved'
        },
        detectedAt: new Date(),
        status: 'open',
        escalated: false
      });
    }

    // Expiry violation
    if (user.kycStatus.expiryDate && user.kycStatus.expiryDate <= new Date()) {
      violations.push({
        id: this.generateViolationId(),
        ruleId: `kyc-expiry-${requirement.activityLevel}`,
        entityType: 'user',
        entityId: user.id,
        jurisdiction: user.jurisdiction,
        category: 'kyc-aml',
        severity: 'high',
        description: `KYC verification expired: ${user.kycStatus.expiryDate}`,
        details: {
          expiryDate: user.kycStatus.expiryDate,
          currentDate: new Date()
        },
        detectedAt: new Date(),
        status: 'open',
        escalated: false
      });
    }

    return violations;
  }

  private generateKYCRecommendations(user: User, requirement: any, missingDocuments: DocumentType[]): string[] {
    const recommendations: string[] = [];

    if (missingDocuments.length > 0) {
      recommendations.push(`Upload missing documents: ${missingDocuments.join(', ')}`);
    }

    const levelHierarchy = { 'basic': 1, 'enhanced': 2, 'professional': 3, 'institutional': 4 };
    const requiredLevelValue = levelHierarchy[requirement.requiredLevel];
    const currentLevelValue = levelHierarchy[user.kycStatus.level];

    if (currentLevelValue < requiredLevelValue) {
      recommendations.push(`Upgrade KYC level from ${user.kycStatus.level} to ${requirement.requiredLevel}`);
    }

    if (user.kycStatus.status !== 'approved') {
      recommendations.push('Complete KYC verification process');
    }

    if (user.kycStatus.expiryDate && user.kycStatus.expiryDate <= new Date()) {
      recommendations.push('Renew expired KYC verification');
    }

    if (requirement.enhancedDueDiligence && user.riskProfile.overallRisk === 'high') {
      recommendations.push('Enhanced due diligence review required for high-risk profile');
    }

    return recommendations;
  }

  private calculateNextKYCReview(user: User, requirement: any): Date {
    const renewalPeriod = requirement.renewalPeriod || 365; // Default 1 year
    let baseDate = user.kycStatus.verificationDate || new Date();

    // Adjust based on risk profile
    let adjustedPeriod = renewalPeriod;
    if (user.riskProfile.overallRisk === 'high') {
      adjustedPeriod = Math.min(adjustedPeriod, 180); // 6 months max for high risk
    } else if (user.riskProfile.overallRisk === 'medium') {
      adjustedPeriod = Math.min(adjustedPeriod, 270); // 9 months max for medium risk
    }

    return new Date(baseDate.getTime() + adjustedPeriod * 24 * 60 * 60 * 1000);
  }

  private calculateKYCConfidence(user: User, requirement: any): number {
    let confidence = 0;

    // Level compliance
    const levelHierarchy = { 'basic': 1, 'enhanced': 2, 'professional': 3, 'institutional': 4 };
    const requiredLevelValue = levelHierarchy[requirement.requiredLevel];
    const currentLevelValue = levelHierarchy[user.kycStatus.level];

    if (currentLevelValue >= requiredLevelValue) {
      confidence += 40;
    }

    // Status compliance
    if (user.kycStatus.status === 'approved') {
      confidence += 30;
    }

    // Document completeness
    const missingDocuments = this.getMissingDocuments(user, requirement);
    const completeness = 1 - (missingDocuments.length / requirement.documents.length);
    confidence += completeness * 20;

    // Recency of verification
    if (user.kycStatus.verificationDate) {
      const daysSinceVerification = (Date.now() - user.kycStatus.verificationDate.getTime()) / (1000 * 60 * 60 * 24);
      const recencyScore = Math.max(0, 1 - (daysSinceVerification / requirement.renewalPeriod));
      confidence += recencyScore * 10;
    }

    return Math.min(100, Math.max(0, confidence));
  }

  private determineKYCStatus(user: User, requirement: any): 'approved' | 'rejected' | 'pending' | 'requires-review' {
    const levelHierarchy = { 'basic': 1, 'enhanced': 2, 'professional': 3, 'institutional': 4 };
    const requiredLevelValue = levelHierarchy[requirement.requiredLevel];
    const currentLevelValue = levelHierarchy[user.kycStatus.level];

    const levelCompliant = currentLevelValue >= requiredLevelValue;
    const statusCompliant = user.kycStatus.status === 'approved';
    const notExpired = !user.kycStatus.expiryDate || user.kycStatus.expiryDate > new Date();

    if (levelCompliant && statusCompliant && notExpired) {
      return 'approved';
    }

    if (user.kycStatus.status === 'rejected') {
      return 'rejected';
    }

    if (user.kycStatus.status === 'under-review' || 
        (requirement.enhancedDueDiligence && user.riskProfile.overallRisk === 'high')) {
      return 'requires-review';
    }

    return 'pending';
  }

  private async processKYCVerification(requestId: string, request: KYCVerificationRequest): Promise<void> {
    const startTime = Date.now();

    try {
      logger.info('Processing KYC verification', {
        requestId,
        userId: request.userId,
        provider: request.provider
      });

      // Simulate provider verification
      const result = await this.callKYCProvider(request);

      // Store result
      if (!this.verificationHistory.has(requestId)) {
        this.verificationHistory.set(requestId, []);
      }
      this.verificationHistory.get(requestId)!.push(result);

      // Update statistics
      const processingTime = Date.now() - startTime;
      this.updateProcessingStats(result, processingTime);

      // Determine if auto-approval is possible
      const autoApprove = this.config.automation.autoApprove &&
                         result.success &&
                         result.confidence >= this.config.automation.confidenceThreshold &&
                         !this.requiresManualReview(request, result);

      if (autoApprove) {
        this.kycStats.autoApprovals++;
        
        this.emit('kyc_auto_approved', {
          requestId,
          userId: request.userId,
          result,
          timestamp: new Date()
        });
      } else {
        this.kycStats.manualReviews++;
        
        this.emit('manual_review_required', {
          requestId,
          userId: request.userId,
          result,
          reasons: this.getManualReviewReasons(request, result),
          timestamp: new Date()
        });
      }

      // Emit status change
      this.emit('kyc_status_changed', {
        requestId,
        userId: request.userId,
        status: autoApprove ? 'approved' : 'requires-review',
        result,
        timestamp: new Date()
      });

      // Remove from pending
      this.pendingVerifications.delete(requestId);

    } catch (error) {
      logger.error('Error processing KYC verification:', error);
      
      this.emit('kyc_verification_failed', {
        requestId,
        userId: request.userId,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date()
      });
    }
  }

  private async callKYCProvider(request: KYCVerificationRequest): Promise<KYCProviderResult> {
    // Mock provider call - would integrate with actual KYC providers
    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));

    const success = Math.random() > 0.1; // 90% success rate
    const confidence = success ? 0.7 + Math.random() * 0.3 : Math.random() * 0.5;

    return {
      provider: request.provider,
      success,
      confidence,
      status: success ? (confidence > 0.8 ? 'approved' : 'pending') : 'rejected',
      findings: success ? ['Document verification passed', 'Identity confirmed'] : ['Document quality issues'],
      metadata: {
        processingTime: Math.random() * 5000,
        documentsProcessed: request.documents.length,
        riskScore: Math.random() * 100
      }
    };
  }

  private requiresManualReview(request: KYCVerificationRequest, result: KYCProviderResult): boolean {
    // Check automation triggers
    for (const trigger of this.config.automation.manualReviewTriggers) {
      switch (trigger) {
        case 'low_confidence_score':
          if (result.confidence < this.config.automation.confidenceThreshold) return true;
          break;
        case 'high_risk_country':
          // Would check user's country against high-risk list
          break;
        case 'document_quality_issues':
          if (result.findings.some(f => f.includes('quality'))) return true;
          break;
      }
    }

    return false;
  }

  private getManualReviewReasons(request: KYCVerificationRequest, result: KYCProviderResult): string[] {
    const reasons: string[] = [];

    if (result.confidence < this.config.automation.confidenceThreshold) {
      reasons.push(`Low confidence score: ${result.confidence}`);
    }

    if (result.findings.some(f => f.includes('quality'))) {
      reasons.push('Document quality issues detected');
    }

    if (!result.success) {
      reasons.push('Provider verification failed');
    }

    return reasons;
  }

  private updateProcessingStats(result: KYCProviderResult, processingTime: number): void {
    // Update average processing time
    const totalProcessed = this.verificationHistory.size;
    this.kycStats.averageProcessingTime = 
      (this.kycStats.averageProcessingTime * (totalProcessed - 1) + processingTime) / totalProcessed;

    // Update rejection count
    if (result.status === 'rejected') {
      this.kycStats.rejections++;
    }
  }

  private generateRequestId(): string {
    return `kyc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateViolationId(): string {
    return `viol_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}