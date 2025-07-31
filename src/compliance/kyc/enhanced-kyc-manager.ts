/**
 * Enhanced KYC Manager
 * Unified KYC workflow supporting both traditional and decentralized verification
 */

import { EventEmitter } from 'events';
import Logger from '../../shared/logging/logger';

// Traditional KYC components
import { JumioClient } from '../integrations/jumio-client';
import { OnfidoClient } from '../integrations/onfido-client';

// Decentralized KYC components
import { DecentralizedIdentityService } from './decentralized-identity.service';
import { DecentralizedKYCWorkflow } from './decentralized-kyc-workflow';

// Types
import {
  User,
  KYCLevel,
  DocumentType,
  ActivityLevel,
  ComplianceViolation,
  RiskLevel,
  Jurisdiction,
  KYCStatus
} from '../types';
import {
  DecentralizedUser,
  DecentralizedKYCStatus
} from '../types/decentralized-types';

const logger = Logger.getLogger('enhanced-kyc-manager');

export interface EnhancedKYCConfig {
  traditional: {
    providers: {
      jumio: any;
      onfido: any;
      primary: 'jumio' | 'onfido';
      fallback: 'jumio' | 'onfido';
    };
    requirements: KYCRequirementConfig[];
    automation: {
      autoApprove: boolean;
      confidenceThreshold: number;
      manualReviewTriggers: string[];
    };
  };
  decentralized: {
    enabled: boolean;
    preferred: boolean;
    trustedIssuers: string[];
    minimumCredentials: number;
    proofOfPersonhoodRequired: boolean;
  };
  riskBasedApproach: {
    enabled: boolean;
    riskFactors: RiskFactorConfig[];
    riskThresholds: Record<RiskLevel, number>;
    enhancedDueDiligence: {
      triggers: string[];
      additionalRequirements: string[];
    };
  };
  monitoring: {
    ongoingMonitoring: boolean;
    reviewFrequency: Record<ActivityLevel, number>; // days
    autoRenewal: boolean;
    expiryNotification: number; // days before expiry
  };
}

export interface KYCRequirementConfig {
  activityLevel: ActivityLevel;
  requiredLevel: KYCLevel;
  documents: DocumentType[];
  biometricRequired: boolean;
  enhancedDueDiligence: boolean;
  renewalPeriod: number; // days
  jurisdiction?: Jurisdiction;
}

export interface RiskFactorConfig {
  factor: string;
  weight: number;
  thresholds: Record<string, number>;
  description: string;
}

export interface UnifiedKYCAssessment {
  userId: string;
  userType: 'traditional' | 'decentralized';
  currentLevel: KYCLevel;
  requiredLevel: KYCLevel;
  compliant: boolean;
  confidence: number;
  riskScore: number;
  flags: ComplianceViolation[];
  recommendations: string[];
  nextReviewDate: Date;
  traditionalStatus?: KYCStatus;
  decentralizedStatus?: DecentralizedKYCStatus;
  verificationMethods: string[];
  documentStatus: {
    required: DocumentType[];
    provided: DocumentType[];
    missing: DocumentType[];
    expired: DocumentType[];
  };
  biometricVerification: {
    required: boolean;
    completed: boolean;
    confidence?: number;
  };
  ongoingMonitoring: {
    enabled: boolean;
    lastCheck: Date;
    nextCheck: Date;
    findings: string[];
  };
}

export interface KYCVerificationSession {
  sessionId: string;
  userId: string;
  userType: 'traditional' | 'decentralized';
  targetLevel: KYCLevel;
  provider?: string;
  status: 'pending' | 'in-progress' | 'completed' | 'failed' | 'expired';
  progress: {
    total: number;
    completed: number;
    steps: KYCVerificationStep[];
  };
  results?: any;
  expiresAt: Date;
  createdAt: Date;
  completedAt?: Date;
}

export interface KYCVerificationStep {
  id: string;
  name: string;
  type: 'document_upload' | 'biometric_verification' | 'identity_check' | 'risk_assessment' | 'manual_review';
  status: 'pending' | 'in-progress' | 'completed' | 'failed' | 'skipped';
  required: boolean;
  order: number;
  data?: any;
  completedAt?: Date;
}

export interface SuspiciousActivityReport {
  id: string;
  userId: string;
  activityType: string;
  description: string;
  riskLevel: RiskLevel;
  indicators: string[];
  detectedAt: Date;
  reportedAt?: Date;
  status: 'detected' | 'reviewing' | 'reported' | 'dismissed';
  jurisdiction: Jurisdiction;
  metadata: Record<string, any>;
}

export class EnhancedKYCManager extends EventEmitter {
  private config: EnhancedKYCConfig;
  private isInitialized = false;

  // Traditional KYC providers
  private jumioClient: JumioClient;
  private onfidoClient: OnfidoClient;

  // Decentralized KYC components
  private decentralizedIdentity: DecentralizedIdentityService;
  private decentralizedKYC: DecentralizedKYCWorkflow;

  // State management
  private activeSessions: Map<string, KYCVerificationSession> = new Map();
  private pendingReports: Map<string, SuspiciousActivityReport> = new Map();

  private stats = {
    totalAssessments: 0,
    traditionalVerifications: 0,
    decentralizedVerifications: 0,
    automatedApprovals: 0,
    manualReviews: 0,
    suspiciousActivityReports: 0,
    averageVerificationTime: 0
  };

  constructor(config: EnhancedKYCConfig) {
    super();
    this.config = config;

    // Initialize traditional providers
    this.jumioClient = new JumioClient(config.traditional.providers.jumio);
    this.onfidoClient = new OnfidoClient(config.traditional.providers.onfido);

    // Initialize decentralized components
    this.decentralizedIdentity = new DecentralizedIdentityService();
    this.decentralizedKYC = new DecentralizedKYCWorkflow(
      this.decentralizedIdentity,
      config.decentralized as any
    );
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.warn('Enhanced KYC Manager already initialized');
      return;
    }

    try {
      logger.info('Initializing Enhanced KYC Manager...');

      // Initialize all components in parallel
      const initPromises = [
        this.jumioClient.initialize(),
        this.onfidoClient.initialize()
      ];

      if (this.config.decentralized.enabled) {
        initPromises.push(
          this.decentralizedIdentity.initialize(),
          this.decentralizedKYC.initialize()
        );
      }

      await Promise.all(initPromises);

      // Set up event handlers
      this.setupEventHandlers();

      // Start monitoring processes
      if (this.config.monitoring.ongoingMonitoring) {
        this.startOngoingMonitoring();
      }

      this.isInitialized = true;
      logger.info('✅ Enhanced KYC Manager initialized successfully');

      this.emit('manager_initialized', {
        traditionalProviders: Object.keys(this.config.traditional.providers).length,
        decentralizedEnabled: this.config.decentralized.enabled,
        timestamp: new Date()
      });

    } catch (error) {
      logger.error('Failed to initialize Enhanced KYC Manager:', error);
      throw error;
    }
  }

  /**
   * Assess KYC compliance for any user type
   */
  async assessKYCCompliance(
    user: User | DecentralizedUser,
    targetLevel?: KYCLevel
  ): Promise<UnifiedKYCAssessment> {
    const startTime = Date.now();

    try {
      this.stats.totalAssessments++;

      const userType = this.getUserType(user);
      const userId = this.getUserId(user);
      const activityLevel = this.getUserActivityLevel(user);

      logger.info('Assessing KYC compliance', {
        userId,
        userType,
        activityLevel,
        targetLevel
      });

      // Determine required KYC level
      const requiredLevel = targetLevel || this.determineRequiredKYCLevel(user);

      // Get current KYC status
      const currentLevel = this.getCurrentKYCLevel(user);

      // Perform risk assessment
      const riskAssessment = await this.performRiskAssessment(user);

      // Check document requirements
      const documentStatus = this.assessDocumentStatus(user, requiredLevel);

      // Check biometric requirements
      const biometricStatus = this.assessBiometricRequirements(user, requiredLevel);

      // Determine compliance status
      const compliant = this.isCompliant(user, requiredLevel, documentStatus, biometricStatus);

      // Calculate confidence score
      const confidence = this.calculateConfidenceScore(user, documentStatus, biometricStatus);

      // Generate recommendations
      const recommendations = this.generateRecommendations(user, requiredLevel, documentStatus);

      // Set up ongoing monitoring
      const ongoingMonitoring = this.setupOngoingMonitoring(user);

      const assessment: UnifiedKYCAssessment = {
        userId,
        userType,
        currentLevel,
        requiredLevel,
        compliant,
        confidence,
        riskScore: riskAssessment.riskScore,
        flags: riskAssessment.violations,
        recommendations,
        nextReviewDate: this.calculateNextReviewDate(user, requiredLevel),
        traditionalStatus: userType === 'traditional' ? (user as User).kycStatus : undefined as KYCStatus | undefined,
        decentralizedStatus: userType === 'decentralized' ? (user as DecentralizedUser).kycStatus : undefined as DecentralizedKYCStatus | undefined,
        verificationMethods: this.getVerificationMethods(user),
        documentStatus,
        biometricVerification: biometricStatus,
        ongoingMonitoring
      };

      // Update processing time
      this.updateProcessingMetrics(Date.now() - startTime);

      logger.info('KYC assessment completed', {
        userId,
        compliant: assessment.compliant,
        confidence: assessment.confidence,
        riskScore: assessment.riskScore
      });

      this.emit('assessment_completed', {
        assessment,
        processingTime: Date.now() - startTime,
        timestamp: new Date()
      });

      return assessment;

    } catch (error) {
      logger.error('Error assessing KYC compliance:', error);
      throw error;
    }
  }

  /**
   * Start KYC verification process
   */
  async startVerification(
    user: User | DecentralizedUser,
    targetLevel: KYCLevel,
    preferredMethod?: 'traditional' | 'decentralized'
  ): Promise<string> {
    try {
      const userId = this.getUserId(user);
      const userType = preferredMethod || this.getUserType(user);

      logger.info('Starting KYC verification', {
        userId,
        userType,
        targetLevel
      });

      // Create verification session
      const session = this.createVerificationSession(user, targetLevel, userType);

      // Route to appropriate verification flow
      if (userType === 'decentralized' && this.config.decentralized.enabled) {
        await this.startDecentralizedVerification(session, user as DecentralizedUser);
        this.stats.decentralizedVerifications++;
      } else {
        await this.startTraditionalVerification(session, user as User);
        this.stats.traditionalVerifications++;
      }

      this.activeSessions.set(session.sessionId, session);

      logger.info('KYC verification started', {
        sessionId: session.sessionId,
        userId,
        targetLevel,
        totalSteps: session.progress.total
      });

      this.emit('verification_started', {
        session,
        timestamp: new Date()
      });

      return session.sessionId;

    } catch (error) {
      logger.error('Error starting KYC verification:', error);
      throw error;
    }
  }

  /**
   * Get verification session status
   */
  getVerificationStatus(sessionId: string): KYCVerificationSession | null {
    return this.activeSessions.get(sessionId) || null;
  }

  /**
   * Complete verification step
   */
  async completeVerificationStep(
    sessionId: string,
    stepId: string,
    data: any
  ): Promise<void> {
    try {
      const session = this.activeSessions.get(sessionId);
      if (!session) {
        throw new Error(`Verification session not found: ${sessionId}`);
      }

      const step = session.progress.steps.find(s => s.id === stepId);
      if (!step) {
        throw new Error(`Verification step not found: ${stepId}`);
      }

      logger.info('Completing verification step', {
        sessionId,
        stepId,
        stepType: step.type
      });

      // Process step based on type
      await this.processVerificationStep(session, step, data);

      // Update session progress
      step.status = 'completed';
      step.completedAt = new Date();
      step.data = data;
      session.progress.completed++;

      // Check if verification is complete
      if (this.isVerificationComplete(session)) {
        await this.completeVerification(session);
      }

      this.emit('step_completed', {
        sessionId,
        stepId,
        stepType: step.type,
        progress: session.progress,
        timestamp: new Date()
      });

    } catch (error) {
      logger.error('Error completing verification step:', error);
      throw error;
    }
  }

  /**
   * Detect and report suspicious activity
   */
  async detectSuspiciousActivity(
    user: User | DecentralizedUser,
    activity: any
  ): Promise<SuspiciousActivityReport | null> {
    try {
      const userId = this.getUserId(user);
      const jurisdiction = this.getUserJurisdiction(user);

      logger.debug('Checking for suspicious activity', {
        userId,
        activityType: activity.type
      });

      // Risk-based analysis
      const indicators = this.analyzeSuspiciousIndicators(user, activity);
      
      if (indicators.length === 0) {
        return null; // No suspicious activity detected
      }

      // Calculate risk level
      const riskLevel = this.calculateActivityRiskLevel(indicators);

      // Create suspicious activity report
      const report: SuspiciousActivityReport = {
        id: this.generateReportId(),
        userId,
        activityType: activity.type,
        description: `Suspicious activity detected: ${indicators.join(', ')}`,
        riskLevel,
        indicators,
        detectedAt: new Date(),
        status: 'detected',
        jurisdiction,
        metadata: {
          activity,
          userType: this.getUserType(user),
          confidence: this.calculateIndicatorConfidence(indicators)
        }
      };

      this.pendingReports.set(report.id, report);
      this.stats.suspiciousActivityReports++;

      logger.warn('Suspicious activity detected', {
        reportId: report.id,
        userId,
        riskLevel,
        indicators: indicators.length
      });

      // Auto-report for high-risk activities
      if (riskLevel === 'high' || riskLevel === 'critical') {
        await this.submitSuspiciousActivityReport(report);
      }

      this.emit('suspicious_activity_detected', {
        report,
        timestamp: new Date()
      });

      return report;

    } catch (error) {
      logger.error('Error detecting suspicious activity:', error);
      throw error;
    }
  }

  /**
   * Submit suspicious activity report to authorities
   */
  async submitSuspiciousActivityReport(report: SuspiciousActivityReport): Promise<void> {
    try {
      logger.info('Submitting suspicious activity report', {
        reportId: report.id,
        userId: report.userId,
        riskLevel: report.riskLevel
      });

      // Mock submission - in production, this would integrate with regulatory APIs
      report.status = 'reported';
      report.reportedAt = new Date();

      this.emit('sar_submitted', {
        report,
        timestamp: new Date()
      });

    } catch (error) {
      logger.error('Error submitting suspicious activity report:', error);
      throw error;
    }
  }

  /**
   * Get KYC manager statistics
   */
  getStatistics(): any {
    return {
      ...this.stats,
      activeSessions: this.activeSessions.size,
      pendingReports: this.pendingReports.size,
      sessionsByStatus: this.getSessionsByStatus(),
      reportsByRisk: this.getReportsByRisk()
    };
  }

  /**
   * Get manager status
   */
  getStatus(): any {
    return {
      initialized: this.isInitialized,
      traditional: {
        jumio: this.jumioClient.getStatus(),
        onfido: this.onfidoClient.getStatus()
      },
      decentralized: this.config.decentralized.enabled ? {
        identity: this.decentralizedIdentity.getStatus(),
        kyc: this.decentralizedKYC.getStatus()
      } : null,
      configuration: {
        decentralizedEnabled: this.config.decentralized.enabled,
        ongoingMonitoring: this.config.monitoring.ongoingMonitoring,
        primaryProvider: this.config.traditional.providers.primary
      },
      statistics: this.getStatistics()
    };
  }

  // Private methods

  private getUserType(user: User | DecentralizedUser): 'traditional' | 'decentralized' {
    if ('did' in user) return 'decentralized';
    if ('authenticationMethod' in user && user.authenticationMethod === 'decentralized') {
      return 'decentralized';
    }
    return 'traditional';
  }

  private getUserId(user: User | DecentralizedUser): string {
    return 'did' in user ? user.did : user.id;
  }

  private getUserActivityLevel(user: User | DecentralizedUser): ActivityLevel {
    return user.activityLevel;
  }

  private getUserJurisdiction(user: User | DecentralizedUser): Jurisdiction {
    if ('jurisdiction' in user) return user.jurisdiction;
    return 'US'; // Default for decentralized users
  }

  private determineRequiredKYCLevel(user: User | DecentralizedUser): KYCLevel {
    const activityLevel = this.getUserActivityLevel(user);
    const jurisdiction = this.getUserJurisdiction(user);

    // Find requirement configuration
    const requirement = this.config.traditional.requirements.find(req => 
      req.activityLevel === activityLevel && 
      (!req.jurisdiction || req.jurisdiction === jurisdiction)
    );

    return requirement?.requiredLevel || 'basic';
  }

  private getCurrentKYCLevel(user: User | DecentralizedUser): KYCLevel {
    if (this.getUserType(user) === 'decentralized') {
      return (user as DecentralizedUser).kycStatus.level;
    }
    return (user as User).kycStatus.level;
  }

  private async performRiskAssessment(user: User | DecentralizedUser): Promise<{
    riskScore: number;
    violations: ComplianceViolation[];
  }> {
    // Simplified risk assessment
    let riskScore = 0;
    const violations: ComplianceViolation[] = [];

    // Risk factors
    if (this.getUserType(user) === 'traditional') {
      const traditionalUser = user as User;
      if (traditionalUser.riskProfile.overallRisk === 'high') {
        riskScore += 40;
      }
      if ('politically' in traditionalUser.riskProfile && traditionalUser.riskProfile.politically) {
        riskScore += 30;
      }
    }

    return { riskScore, violations };
  }

  private assessDocumentStatus(user: User | DecentralizedUser, requiredLevel: KYCLevel): {
    required: DocumentType[];
    provided: DocumentType[];
    missing: DocumentType[];
    expired: DocumentType[];
  } {
    const requirement = this.config.traditional.requirements.find(req => 
      req.requiredLevel === requiredLevel
    );

    const required = requirement?.documents || ['passport'];
    const provided: DocumentType[] = [];
    const missing: DocumentType[] = [];
    const expired: DocumentType[] = [];

    if (this.getUserType(user) === 'traditional') {
      const documents = (user as User).kycStatus.documents;
      documents.forEach(doc => {
        provided.push(doc.type);
        if (doc.expiryDate && doc.expiryDate < new Date()) {
          expired.push(doc.type);
        }
      });
    }

    // Find missing documents
    required.forEach(reqDoc => {
      if (!provided.includes(reqDoc)) {
        missing.push(reqDoc);
      }
    });

    return { required, provided, missing, expired };
  }

  private assessBiometricRequirements(user: User | DecentralizedUser, requiredLevel: KYCLevel): {
    required: boolean;
    completed: boolean;
    confidence?: number;
  } {
    const requirement = this.config.traditional.requirements.find(req => 
      req.requiredLevel === requiredLevel
    );

    const required = requirement?.biometricRequired || false;
    const completed = this.getUserType(user) === 'decentralized' ? 
      (user as DecentralizedUser).kycStatus.biometricVerified : 
      false; // Traditional users would have biometric data

    return {
      required,
      completed,
      confidence: completed ? 0.95 : undefined as number | undefined
    };
  }

  private isCompliant(
    user: User | DecentralizedUser,
    requiredLevel: KYCLevel,
    documentStatus: any,
    biometricStatus: any
  ): boolean {
    const currentLevel = this.getCurrentKYCLevel(user);
    const levelOrder = { 'basic': 1, 'enhanced': 2, 'professional': 3, 'institutional': 4 };
    
    const hasRequiredLevel = levelOrder[currentLevel] >= levelOrder[requiredLevel];
    const hasRequiredDocuments = documentStatus.missing.length === 0 && documentStatus.expired.length === 0;
    const hasRequiredBiometrics = !biometricStatus.required || biometricStatus.completed;

    return hasRequiredLevel && hasRequiredDocuments && hasRequiredBiometrics;
  }

  private calculateConfidenceScore(
    user: User | DecentralizedUser,
    documentStatus: any,
    biometricStatus: any
  ): number {
    let confidence = 50; // Base confidence

    // Document confidence
    if (documentStatus.provided.length > 0) {
      confidence += 20;
    }
    if (documentStatus.missing.length === 0) {
      confidence += 15;
    }
    if (documentStatus.expired.length === 0) {
      confidence += 10;
    }

    // Biometric confidence
    if (biometricStatus.completed) {
      confidence += (biometricStatus.confidence || 0.9) * 10;
    }

    // User type confidence
    if (this.getUserType(user) === 'decentralized') {
      const decUser = user as DecentralizedUser;
      confidence += Math.min(20, decUser.reputation.overallScore / 50);
    }

    return Math.min(100, confidence);
  }

  private generateRecommendations(
    user: User | DecentralizedUser,
    requiredLevel: KYCLevel,
    documentStatus: any
  ): string[] {
    const recommendations: string[] = [];

    if (documentStatus.missing.length > 0) {
      recommendations.push(`Upload missing documents: ${documentStatus.missing.join(', ')}`);
    }

    if (documentStatus.expired.length > 0) {
      recommendations.push(`Update expired documents: ${documentStatus.expired.join(', ')}`);
    }

    const currentLevel = this.getCurrentKYCLevel(user);
    const levelOrder = { 'basic': 1, 'enhanced': 2, 'professional': 3, 'institutional': 4 };
    
    if (levelOrder[currentLevel] < levelOrder[requiredLevel]) {
      recommendations.push(`Upgrade KYC level from ${currentLevel} to ${requiredLevel}`);
    }

    if (this.getUserType(user) === 'decentralized') {
      const decUser = user as DecentralizedUser;
      if (decUser.reputation.overallScore < 500) {
        recommendations.push('Improve reputation score through community participation');
      }
    }

    return recommendations;
  }

  private calculateNextReviewDate(user: User | DecentralizedUser, _requiredLevel: KYCLevel): Date {
    const activityLevel = this.getUserActivityLevel(user);
    const reviewFrequency = this.config.monitoring.reviewFrequency[activityLevel] || 365;
    
    return new Date(Date.now() + reviewFrequency * 24 * 60 * 60 * 1000);
  }

  private getVerificationMethods(user: User | DecentralizedUser): string[] {
    const methods: string[] = [];

    if (this.getUserType(user) === 'traditional') {
      const traditionalUser = user as User;
      traditionalUser.kycStatus.documents.forEach(doc => {
        if (!methods.includes(doc.provider)) {
          methods.push(doc.provider);
        }
      });
    } else {
      const decUser = user as DecentralizedUser;
      methods.push('decentralized-identity');
      if (decUser.decentralizedIdentity.proofOfPersonhood) {
        methods.push('proof-of-personhood');
      }
      if (decUser.kycStatus.biometricVerified) {
        methods.push('biometric-verification');
      }
    }

    return methods;
  }

  private setupOngoingMonitoring(user: User | DecentralizedUser): {
    enabled: boolean;
    lastCheck: Date;
    nextCheck: Date;
    findings: string[];
  } {
    const enabled = this.config.monitoring.ongoingMonitoring;
    const lastCheck = new Date();
    const nextCheck = this.calculateNextReviewDate(user, this.getCurrentKYCLevel(user));

    return {
      enabled,
      lastCheck,
      nextCheck,
      findings: []
    };
  }

  private createVerificationSession(
    user: User | DecentralizedUser,
    targetLevel: KYCLevel,
    userType: 'traditional' | 'decentralized'
  ): KYCVerificationSession {
    const sessionId = this.generateSessionId();
    const steps = this.generateVerificationSteps(targetLevel, userType);

    return {
      sessionId,
      userId: this.getUserId(user),
      userType,
      targetLevel,
      status: 'pending',
      progress: {
        total: steps.length,
        completed: 0,
        steps
      },
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      createdAt: new Date()
    };
  }

  private generateVerificationSteps(
    targetLevel: KYCLevel,
    userType: 'traditional' | 'decentralized'
  ): KYCVerificationStep[] {
    const steps: KYCVerificationStep[] = [];
    let order = 1;

    if (userType === 'traditional') {
      steps.push({
        id: 'document_upload',
        name: 'Document Upload',
        type: 'document_upload',
        status: 'pending',
        required: true,
        order: order++
      });

      if (targetLevel === 'enhanced' || targetLevel === 'institutional') {
        steps.push({
          id: 'biometric_verification',
          name: 'Biometric Verification',
          type: 'biometric_verification',
          status: 'pending',
          required: true,
          order: order++
        });
      }

      steps.push({
        id: 'identity_check',
        name: 'Identity Verification',
        type: 'identity_check',
        status: 'pending',
        required: true,
        order: order++
      });
    } else {
      steps.push({
        id: 'did_verification',
        name: 'DID Verification',
        type: 'identity_check',
        status: 'pending',
        required: true,
        order: order++
      });

      steps.push({
        id: 'proof_of_personhood',
        name: 'Proof of Personhood',
        type: 'biometric_verification',
        status: 'pending',
        required: true,
        order: order++
      });
    }

    steps.push({
      id: 'risk_assessment',
      name: 'Risk Assessment',
      type: 'risk_assessment',
      status: 'pending',
      required: true,
      order: order++
    });

    return steps;
  }

  private async startTraditionalVerification(
    session: KYCVerificationSession,
    user: User
  ): Promise<void> {
    const provider = this.config.traditional.providers.primary;
    session.provider = provider;

    if (provider === 'jumio') {
      const jumioSession = await this.jumioClient.createVerificationSession({
        userId: user.id,
        userReference: user.id,
        enabledFields: ['idNumber', 'firstName', 'lastName', 'dob'],
        presets: [{
          index: 1,
          country: 'US',
          type: 'ID',
          enableExtraction: true
        }],
        customization: {
          locale: 'en'
        }
      });

      session.results = {
        transactionReference: jumioSession.transactionReference,
        redirectUrl: jumioSession.redirectUrl
      };
    }
  }

  private async startDecentralizedVerification(
    session: KYCVerificationSession,
    user: DecentralizedUser
  ): Promise<void> {
    const decSession = await this.decentralizedKYC.startVerificationProcess(
      user.did,
      user.activityLevel
    );

    session.results = {
      decentralizedSessionId: decSession
    };
  }

  private async processVerificationStep(
    session: KYCVerificationSession,
    step: KYCVerificationStep,
    data: any
  ): Promise<void> {
    switch (step.type) {
      case 'document_upload':
        await this.processDocumentUpload(session, step, data);
        break;
      case 'biometric_verification':
        await this.processBiometricVerification(session, step, data);
        break;
      case 'identity_check':
        await this.processIdentityCheck(session, step, data);
        break;
      case 'risk_assessment':
        await this.processRiskAssessment(session, step, data);
        break;
    }
  }

  private async processDocumentUpload(
    session: KYCVerificationSession,
    step: KYCVerificationStep,
    data: any
  ): Promise<void> {
    logger.debug('Processing document upload', {
      sessionId: session.sessionId,
      documentType: data.type
    });

    if (session.userType === 'traditional') {
      const _provider = session.provider === 'jumio' ? this.jumioClient : this.onfidoClient;
      
      if (session.provider === 'onfido') {
        // Upload document to Onfido
        const document = await this.onfidoClient.uploadDocument(
          session.userId,
          data.file,
          data.type,
          data.side
        );
        
        step.data = {
          documentId: document.id,
          type: data.type,
          status: 'uploaded'
        };
      } else {
        // Jumio handles documents through their verification session
        step.data = {
          type: data.type,
          status: 'uploaded'
        };
      }
    } else {
      // Decentralized document handling
      const credentialResult = await this.decentralizedKYC.submitDocumentCredential(
        session.userId,
        data.credential
      );
      
      step.data = {
        credentialId: credentialResult.id,
        type: data.type,
        status: 'verified'
      };
    }

    logger.info('Document upload processed', {
      sessionId: session.sessionId,
      documentType: data.type,
      status: step.data.status
    });
  }

  private async processBiometricVerification(
    session: KYCVerificationSession,
    step: KYCVerificationStep,
    data: any
  ): Promise<void> {
    logger.debug('Processing biometric verification', {
      sessionId: session.sessionId
    });

    if (session.userType === 'traditional') {
      if (session.provider === 'jumio') {
        // Jumio biometric verification
        const biometricResult = await this.jumioClient.verifyBiometrics(
          session.results?.transactionReference,
          data.faceImage
        );
        
        step.data = {
          similarity: biometricResult.similarity,
          validity: biometricResult.validity,
          liveness: biometricResult.liveness,
          confidence: biometricResult.confidence,
          status: biometricResult.validity === 'PASSED' ? 'verified' : 'failed'
        };
      } else {
        // Onfido biometric verification through check creation
        const check = await this.onfidoClient.createCheck(
          session.userId,
          ['facial_similarity_photo'],
          ['biometric_verification']
        );
        
        step.data = {
          checkId: check.id,
          status: 'pending'
        };
      }
    } else {
      // Decentralized biometric verification
      const biometricResult = await this.decentralizedKYC.verifyBiometrics(
        session.userId,
        data.biometricProof
      );
      
      step.data = {
        proofId: biometricResult.proofId,
        verified: biometricResult.verified,
        confidence: biometricResult.confidence,
        status: biometricResult.verified ? 'verified' : 'failed'
      };
    }

    logger.info('Biometric verification processed', {
      sessionId: session.sessionId,
      status: step.data.status,
      confidence: step.data.confidence
    });
  }

  private async processIdentityCheck(
    session: KYCVerificationSession,
    step: KYCVerificationStep,
    data: any
  ): Promise<void> {
    logger.debug('Processing identity check', {
      sessionId: session.sessionId
    });

    if (session.userType === 'traditional') {
      if (session.provider === 'jumio') {
        // Get Jumio verification result
        const verificationResult = await this.jumioClient.getVerificationResult(
          session.results?.transactionReference
        );
        
        step.data = {
          verificationStatus: verificationResult.verificationStatus,
          similarityDecision: verificationResult.similarityDecision,
          validityDecision: verificationResult.validityDecision,
          extractedData: verificationResult.extractedData,
          status: verificationResult.status === 'APPROVED_VERIFIED' ? 'verified' : 'failed'
        };
      } else {
        // Onfido identity verification
        const check = await this.onfidoClient.createCheck(
          session.userId,
          ['document', 'identity_enhanced'],
          ['identity_verification']
        );
        
        step.data = {
          checkId: check.id,
          status: 'pending'
        };
        
        // For demo purposes, simulate completion
        setTimeout(async () => {
          const completedCheck = await this.onfidoClient.getCheck(check.id);
          step.data = {
            ...step.data,
            result: completedCheck.result,
            status: completedCheck.result === 'clear' ? 'verified' : 'failed'
          };
        }, 2000);
      }
    } else {
      // Decentralized identity verification
      const identityResult = await this.decentralizedIdentity.verifyIdentity(
        session.userId,
        data.identityProof
      );
      
      step.data = {
        did: identityResult.did,
        verified: identityResult.verified,
        credentialTypes: identityResult.credentialTypes,
        trustScore: identityResult.trustScore,
        status: identityResult.verified ? 'verified' : 'failed'
      };
    }

    logger.info('Identity check processed', {
      sessionId: session.sessionId,
      status: step.data.status
    });
  }

  private async processRiskAssessment(
    session: KYCVerificationSession,
    step: KYCVerificationStep,
    data: any
  ): Promise<void> {
    logger.debug('Processing risk assessment', {
      sessionId: session.sessionId
    });

    // Collect assessment data from previous steps
    const documentStep = session.progress.steps.find(s => s.type === 'document_upload');
    const biometricStep = session.progress.steps.find(s => s.type === 'biometric_verification');
    const identityStep = session.progress.steps.find(s => s.type === 'identity_check');

    let riskScore = 0;
    const riskFactors: string[] = [];
    
    // Document risk assessment
    if (documentStep?.data?.status === 'verified') {
      riskScore += 10; // Lower risk for verified documents
    } else {
      riskScore += 30;
      riskFactors.push('Document verification issues');
    }

    // Biometric risk assessment
    if (biometricStep?.data?.status === 'verified') {
      const confidence = biometricStep.data.confidence || 0;
      riskScore += confidence > 0.9 ? 5 : confidence > 0.7 ? 15 : 25;
      if (confidence < 0.7) {
        riskFactors.push('Low biometric confidence');
      }
    } else {
      riskScore += 40;
      riskFactors.push('Biometric verification failed');
    }

    // Identity risk assessment
    if (identityStep?.data?.status === 'verified') {
      riskScore += 5;
    } else {
      riskScore += 35;
      riskFactors.push('Identity verification failed');
    }

    // Additional risk factors based on user data
    if (data.geolocation && this.isHighRiskJurisdiction(data.geolocation)) {
      riskScore += 20;
      riskFactors.push('High-risk jurisdiction');
    }

    if (data.pepCheck && data.pepCheck.isMatch) {
      riskScore += 50;
      riskFactors.push('PEP (Politically Exposed Person) match');
    }

    if (data.sanctionsCheck && data.sanctionsCheck.isMatch) {
      riskScore += 100; // Critical risk
      riskFactors.push('Sanctions list match');
    }

    // Determine risk level
    let riskLevel: RiskLevel;
    if (riskScore >= 80) {
      riskLevel = 'critical';
    } else if (riskScore >= 60) {
      riskLevel = 'high';
    } else if (riskScore >= 30) {
      riskLevel = 'medium';
    } else {
      riskLevel = 'low';
    }

    step.data = {
      riskScore,
      riskLevel,
      riskFactors,
      pepCheck: data.pepCheck || null,
      sanctionsCheck: data.sanctionsCheck || null,
      geolocationRisk: data.geolocation ? this.isHighRiskJurisdiction(data.geolocation) : false,
      status: riskLevel === 'critical' ? 'blocked' : 'assessed'
    };

    logger.info('Risk assessment completed', {
      sessionId: session.sessionId,
      riskScore,
      riskLevel,
      factorsCount: riskFactors.length
    });

    // Trigger suspicious activity detection for high-risk assessments
    if (riskLevel === 'high' || riskLevel === 'critical') {
      this.emit('high_risk_detected', {
        sessionId: session.sessionId,
        userId: session.userId,
        riskScore,
        riskLevel,
        riskFactors,
        timestamp: new Date()
      });
    }
  }

  private isVerificationComplete(session: KYCVerificationSession): boolean {
    return session.progress.completed >= session.progress.total;
  }

  private async completeVerification(session: KYCVerificationSession): Promise<void> {
    session.status = 'completed';
    session.completedAt = new Date();

    logger.info('KYC verification completed', {
      sessionId: session.sessionId,
      userId: session.userId,
      targetLevel: session.targetLevel
    });

    this.emit('verification_completed', {
      session,
      timestamp: new Date()
    });
  }

  private analyzeSuspiciousIndicators(user: User | DecentralizedUser, activity: any): string[] {
    const indicators: string[] = [];

    // Example indicators
    if (activity.amount > 10000) {
      indicators.push('Large transaction amount');
    }

    if (activity.type === 'rapid_succession') {
      indicators.push('Rapid succession of transactions');
    }

    return indicators;
  }

  private calculateActivityRiskLevel(indicators: string[]): RiskLevel {
    if (indicators.length >= 3) return 'critical';
    if (indicators.length >= 2) return 'high';
    if (indicators.length >= 1) return 'medium';
    return 'low';
  }

  private calculateIndicatorConfidence(indicators: string[]): number {
    return Math.min(100, indicators.length * 25);
  }

  private setupEventHandlers(): void {
    // Traditional provider events
    this.jumioClient.on('verification_completed', this.handleJumioVerification.bind(this));
    this.onfidoClient.on('check_updated', this.handleOnfidoCheck.bind(this));

    // Decentralized KYC events
    if (this.config.decentralized.enabled) {
      this.decentralizedKYC.on('verification_completed', this.handleDecentralizedVerification.bind(this));
    }
  }

  private startOngoingMonitoring(): void {
    setInterval(() => {
      this.performOngoingMonitoring();
    }, 24 * 60 * 60 * 1000); // Daily monitoring
  }

  private async performOngoingMonitoring(): Promise<void> {
    logger.debug('Performing ongoing KYC monitoring');
    // Ongoing monitoring logic
  }

  private updateProcessingMetrics(processingTime: number): void {
    const totalProcessed = this.stats.totalAssessments;
    this.stats.averageVerificationTime = 
      (this.stats.averageVerificationTime * (totalProcessed - 1) + processingTime) / totalProcessed;
  }

  private getSessionsByStatus(): Record<string, number> {
    const statusCounts: Record<string, number> = {};
    for (const session of this.activeSessions.values()) {
      statusCounts[session.status] = (statusCounts[session.status] || 0) + 1;
    }
    return statusCounts;
  }

  private getReportsByRisk(): Record<RiskLevel, number> {
    const riskCounts: Record<RiskLevel, number> = { low: 0, medium: 0, high: 0, critical: 0 };
    for (const report of this.pendingReports.values()) {
      riskCounts[report.riskLevel]++;
    }
    return riskCounts;
  }

  private generateSessionId(): string {
    return `kyc_session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateReportId(): string {
    return `sar_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Event handlers
  private async handleJumioVerification(event: any): Promise<void> {
    logger.info('Jumio verification completed', event);
  }

  private async handleOnfidoCheck(event: any): Promise<void> {
    logger.info('Onfido check updated', event);
  }

  private async handleDecentralizedVerification(event: any): Promise<void> {
    logger.info('Decentralized verification completed', event);
  }

  private isHighRiskJurisdiction(jurisdiction: string): boolean {
    // High-risk jurisdictions based on FATF guidelines and sanctions lists
    const highRiskJurisdictions = [
      'AF', 'IR', 'KP', 'MM', 'PK', 'UG', 'YE', // FATF high-risk
      'BY', 'RU', 'SY', 'VE', 'ZW', // Sanctions
      'CU', 'SD', 'LB', 'IQ' // Additional high-risk
    ];
    
    return highRiskJurisdictions.includes(jurisdiction.toUpperCase());
  }

  /**
   * Perform PEP (Politically Exposed Person) screening
   */
  async performPEPScreening(user: User | DecentralizedUser, data: any): Promise<{
    isMatch: boolean;
    matches: any[];
    confidence: number;
  }> {
    try {
      const name = data.firstName && data.lastName ? 
        `${data.firstName} ${data.lastName}` : 
        this.getUserId(user);

      logger.debug('Performing PEP screening', { userId: this.getUserId(user), name });

      // Mock PEP screening - in production, integrate with providers like Dow Jones, LexisNexis
      const mockMatches = [];
      const isMatch = Math.random() < 0.05; // 5% chance of PEP match for demo

      if (isMatch) {
        mockMatches.push({
          name: name,
          type: 'PEP',
          position: 'Government Official',
          country: 'US',
          confidence: 0.85,
          source: 'Government Database'
        });
      }

      return {
        isMatch,
        matches: mockMatches,
        confidence: isMatch ? 0.85 : 0.0
      };

    } catch (error) {
      logger.error('Error performing PEP screening:', error);
      throw error;
    }
  }

  /**
   * Perform sanctions screening
   */
  async performSanctionsScreening(user: User | DecentralizedUser, data: any): Promise<{
    isMatch: boolean;
    matches: any[];
    confidence: number;
  }> {
    try {
      const name = data.firstName && data.lastName ? 
        `${data.firstName} ${data.lastName}` : 
        this.getUserId(user);

      logger.debug('Performing sanctions screening', { userId: this.getUserId(user), name });

      // Mock sanctions screening - in production, integrate with OFAC, UN, EU sanctions lists
      const mockMatches = [];
      const isMatch = Math.random() < 0.01; // 1% chance of sanctions match for demo

      if (isMatch) {
        mockMatches.push({
          name: name,
          listName: 'OFAC SDN List',
          type: 'Individual',
          confidence: 0.95,
          source: 'US Treasury OFAC'
        });
      }

      return {
        isMatch,
        matches: mockMatches,
        confidence: isMatch ? 0.95 : 0.0
      };

    } catch (error) {
      logger.error('Error performing sanctions screening:', error);
      throw error;
    }
  }
}