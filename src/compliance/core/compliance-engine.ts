/**
 * Core Compliance Engine
 * Central orchestrator for regulatory compliance across all jurisdictions
 */

import { EventEmitter } from 'events';
import Logger from '../../shared/logging/logger';
import { RuleEngine } from './rule-engine';
import { JurisdictionManager } from './jurisdiction-manager';
import { RealTimeMonitor } from '../monitoring/real-time-monitor';
import { TransactionMonitor } from '../monitoring/transaction-monitor';
import { AlertManager } from '../monitoring/alert-manager';
import { KYCWorkflow } from '../kyc/kyc-workflow';
import { AuditTrail } from '../reporting/audit-trail';
import { PerplexityComplianceClient } from '../integrations/perplexity-compliance';
import { 
  ComplianceViolation,
  ComplianceConfig,
  Jurisdiction,
  User,
  Transaction,
  ComplianceResponse,
  ComplianceResult,
  ComplianceEvent,
  ComplianceStatus
} from '../types';
import { DEFAULT_COMPLIANCE_CONFIG } from '../config';

const logger = Logger.getLogger('compliance-engine');

export class ComplianceEngine extends EventEmitter {
  private static instance: ComplianceEngine;
  private config: ComplianceConfig;
  private ruleEngine: RuleEngine;
  private jurisdictionManager: JurisdictionManager;
  private realTimeMonitor: RealTimeMonitor;
  private transactionMonitor: TransactionMonitor;
  private alertManager: AlertManager;
  private kycWorkflow: KYCWorkflow;
  private auditTrail: AuditTrail;
  private perplexityClient: PerplexityComplianceClient;

  private isInitialized = false;
  private isRunning = false;

  private constructor(config: ComplianceConfig = DEFAULT_COMPLIANCE_CONFIG) {
    super();
    this.config = config;
    
    // Initialize core components
    this.ruleEngine = new RuleEngine(config);
    this.jurisdictionManager = new JurisdictionManager(config.jurisdictions);
    this.realTimeMonitor = new RealTimeMonitor(config.monitoring);
    this.transactionMonitor = new TransactionMonitor(config.monitoring);
    this.alertManager = new AlertManager(config.alerts);
    this.kycWorkflow = new KYCWorkflow(config.kyc);
    this.auditTrail = new AuditTrail();
    this.perplexityClient = new PerplexityComplianceClient();
  }

  static getInstance(config?: ComplianceConfig): ComplianceEngine {
    if (!ComplianceEngine.instance) {
      ComplianceEngine.instance = new ComplianceEngine(config);
    }
    return ComplianceEngine.instance;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.warn('Compliance Engine already initialized');
      return;
    }

    try {
      logger.info('Initializing Compliance Engine...');

      // Initialize all components in parallel
      await Promise.all([
        this.ruleEngine.initialize(),
        this.jurisdictionManager.initialize(),
        this.realTimeMonitor.initialize(),
        this.transactionMonitor.initialize(),
        this.alertManager.initialize(),
        this.kycWorkflow.initialize(),
        this.auditTrail.initialize(),
        this.perplexityClient.initialize()
      ]);

      // Set up event listeners
      this.setupEventListeners();

      this.isInitialized = true;
      logger.info('✅ Compliance Engine initialized successfully');

      this.emit('engine_initialized', {
        timestamp: new Date(),
        config: this.getEngineStatus()
      });

    } catch (error) {
      logger.error('Failed to initialize Compliance Engine:', error);
      throw new Error(`Compliance Engine initialization failed: ${error}`);
    }
  }

  async start(): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('Compliance Engine must be initialized before starting');
    }

    if (this.isRunning) {
      logger.warn('Compliance Engine already running');
      return;
    }

    try {
      logger.info('Starting Compliance Engine...');

      // Start all monitoring components
      await Promise.all([
        this.realTimeMonitor.start(),
        this.transactionMonitor.start(),
        this.alertManager.start()
      ]);

      this.isRunning = true;
      logger.info('🚀 Compliance Engine started successfully');

      this.emit('engine_started', {
        timestamp: new Date(),
        status: this.getEngineStatus()
      });

    } catch (error) {
      logger.error('Failed to start Compliance Engine:', error);
      throw new Error(`Compliance Engine start failed: ${error}`);
    }
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      logger.warn('Compliance Engine is not running');
      return;
    }

    try {
      logger.info('Stopping Compliance Engine...');

      // Stop all monitoring components
      await Promise.all([
        this.realTimeMonitor.stop(),
        this.transactionMonitor.stop(),
        this.alertManager.stop()
      ]);

      this.isRunning = false;
      logger.info('🛑 Compliance Engine stopped successfully');

      this.emit('engine_stopped', {
        timestamp: new Date(),
        status: this.getEngineStatus()
      });

    } catch (error) {
      logger.error('Failed to stop Compliance Engine:', error);
      throw error;
    }
  }

  /**
   * Comprehensive user compliance assessment
   */
  async assessUserCompliance(user: User): Promise<ComplianceResponse<ComplianceResult>> {
    const requestId = this.generateRequestId();
    
    try {
      logger.info('Assessing user compliance', { 
        userId: user.id, 
        jurisdiction: user.jurisdiction,
        requestId 
      });

      // Record audit trail
      await this.auditTrail.recordAction({
        action: 'user_compliance_assessment',
        entityType: 'user',
        entityId: user.id,
        userId: user.id,
        jurisdiction: user.jurisdiction,
        compliance: true
      });

      // Get applicable rules for user's jurisdiction and activity level
      const applicableRules = await this.ruleEngine.getApplicableRules(
        user.jurisdiction,
        'kyc-aml',
        { activityLevel: user.activityLevel }
      );

      // Check KYC status and requirements
      const kycAssessment = await this.kycWorkflow.assessUserKYC(user);

      // Perform sanctions and PEP screening
      const screeningResult = await this.performUserScreening(user);

      // Calculate overall risk score
      const riskScore = await this.calculateUserRiskScore(user, screeningResult);

      // Check for violations
      const violations = await this.checkUserViolations(user, applicableRules, kycAssessment);

      // Determine compliance status
      const complianceStatus = this.determineComplianceStatus(
        kycAssessment.compliant,
        screeningResult.clear,
        violations.length === 0
      );

      // Generate recommendations
      const recommendations = await this.generateUserRecommendations(
        user,
        kycAssessment,
        screeningResult,
        violations
      );

      const result: ComplianceResult = {
        compliant: complianceStatus === 'compliant',
        riskScore,
        flags: screeningResult.flags,
        violations,
        recommendations,
        nextReview: this.calculateNextReview(user.activityLevel, riskScore),
        jurisdiction: user.jurisdiction,
        timestamp: new Date()
      };

      // Emit compliance assessment event
      this.emit('user_compliance_assessed', {
        userId: user.id,
        result,
        timestamp: new Date()
      });

      logger.info('User compliance assessment completed', {
        userId: user.id,
        compliant: result.compliant,
        riskScore,
        violationsCount: violations.length,
        requestId
      });

      return {
        success: true,
        data: result,
        timestamp: new Date(),
        requestId,
        compliance: {
          processed: true,
          flags: screeningResult.flags,
          riskScore
        }
      };

    } catch (error) {
      logger.error('User compliance assessment failed', { 
        userId: user.id, 
        error,
        requestId 
      });

      return {
        success: false,
        error: `Compliance assessment failed: ${error}`,
        timestamp: new Date(),
        requestId,
        compliance: {
          processed: false,
          flags: [],
          riskScore: 100 // Maximum risk on error
        }
      };
    }
  }

  /**
   * Real-time transaction compliance screening
   */
  async screenTransaction(transaction: Transaction, user: User): Promise<ComplianceResponse<ComplianceResult>> {
    const requestId = this.generateRequestId();

    try {
      logger.info('Screening transaction', { 
        transactionId: transaction.id,
        userId: user.id,
        amount: transaction.amount,
        type: transaction.type,
        requestId 
      });

      // Record audit trail
      await this.auditTrail.recordAction({
        action: 'transaction_screening',
        entityType: 'transaction',
        entityId: transaction.id,
        userId: user.id,
        jurisdiction: user.jurisdiction,
        compliance: true
      });

      // Get applicable rules for transaction screening
      const applicableRules = await this.ruleEngine.getApplicableRules(
        user.jurisdiction,
        'kyc-aml',
        { 
          transactionType: transaction.type,
          amount: transaction.amount,
          currency: transaction.currency
        }
      );

      // Perform AML screening
      const amlResult = await this.transactionMonitor.screenTransaction(transaction, user);

      // Check velocity limits and patterns
      const velocityCheck = await this.transactionMonitor.checkVelocityLimits(user.id, transaction);

      // Perform address screening (if blockchain transaction)
      const addressScreening = transaction.toAddress || transaction.fromAddress ? 
        await this.performAddressScreening(transaction) : 
        { clear: true, flags: [] };

      // Calculate transaction risk score
      const riskScore = await this.calculateTransactionRiskScore(
        transaction,
        user,
        amlResult,
        velocityCheck,
        addressScreening
      );

      // Check for violations
      const violations = await this.checkTransactionViolations(
        transaction,
        user,
        applicableRules,
        amlResult,
        velocityCheck
      );

      // Combine all flags - amlResult is AMLCheck, not a screening result with flags
      const allFlags = [
        ...velocityCheck.flags,
        ...addressScreening.flags
      ];

      // Determine if transaction should be approved
      const approved = violations.length === 0 && 
                     riskScore < this.config.monitoring.thresholds.riskScores.high &&
                     !allFlags.some(flag => flag.severity === 'critical');

      const result: ComplianceResult = {
        compliant: approved,
        riskScore,
        flags: allFlags,
        violations,
        recommendations: approved ? [] : ['Manual review required'],
        jurisdiction: user.jurisdiction,
        timestamp: new Date()
      };

      // Update transaction compliance status
      transaction.compliance = {
        screeningStatus: approved ? 'approved' : 'flagged',
        riskScore,
        flags: allFlags,
        sanctions: { status: 'clear', provider: 'transaction-monitor', checkedAt: new Date(), lists: [], matches: [] },
        aml: amlResult, // Use the actual AMLCheck result
        reviewedAt: new Date()
      };

      // Emit transaction screening event
      this.emit('transaction_screened', {
        transactionId: transaction.id,
        userId: user.id,
        result,
        approved,
        timestamp: new Date()
      });

      // Trigger alerts if necessary
      if (!approved || riskScore >= this.config.monitoring.thresholds.riskScores.high) {
        await this.alertManager.triggerAlert({
          id: `alert-${transaction.id}-${Date.now()}`,
          type: 'suspicious-activity',
          severity: riskScore >= this.config.monitoring.thresholds.riskScores.critical ? 'critical' : 'high',
          title: 'High-risk transaction detected',
          description: `Transaction ${transaction.id} flagged for review`,
          entityType: 'transaction',
          entityId: transaction.id,
          jurisdiction: user.jurisdiction,
          triggeredAt: new Date(),
          status: 'open',
          escalationLevel: 0,
          metadata: {
            userId: user.id,
            amount: transaction.amount,
            currency: transaction.currency,
            riskScore,
            flagsCount: allFlags.length
          }
        });
      }

      logger.info('Transaction screening completed', {
        transactionId: transaction.id,
        approved,
        riskScore,
        flagsCount: allFlags.length,
        violationsCount: violations.length,
        requestId
      });

      return {
        success: true,
        data: result,
        timestamp: new Date(),
        requestId,
        compliance: {
          processed: true,
          flags: allFlags,
          riskScore
        }
      };

    } catch (error) {
      logger.error('Transaction screening failed', { 
        transactionId: transaction.id,
        userId: user.id,
        error,
        requestId 
      });

      return {
        success: false,
        error: `Transaction screening failed: ${error}`,
        timestamp: new Date(),
        requestId,
        compliance: {
          processed: false,
          flags: [],
          riskScore: 100
        }
      };
    }
  }

  /**
   * Process compliance events from various sources
   */
  async processComplianceEvent(event: ComplianceEvent): Promise<void> {
    try {
      logger.debug('Processing compliance event', { 
        eventId: event.id,
        type: event.type,
        entityType: event.entityType,
        entityId: event.entityId
      });

      // Route event to appropriate handler
      switch (event.type) {
        case 'user-registered':
          await this.handleUserRegistered(event);
          break;
        case 'kyc-submitted':
          await this.handleKYCSubmitted(event);
          break;
        case 'transaction-submitted':
          await this.handleTransactionSubmitted(event);
          break;
        case 'regulatory-change':
          await this.handleRegulatoryChange(event);
          break;
        default:
          logger.warn('Unknown compliance event type', { type: event.type });
      }

      // Mark event as processed
      event.processed = true;

      // Record in audit trail
      await this.auditTrail.recordAction({
        action: 'compliance_event_processed',
        entityType: event.entityType,
        entityId: event.entityId,
        jurisdiction: event.jurisdiction,
        compliance: true,
        reason: `Processed ${event.type} event`
      });

    } catch (error) {
      logger.error('Failed to process compliance event', { 
        eventId: event.id,
        error 
      });
      throw error;
    }
  }

  /**
   * Update configuration and restart affected components
   */
  async updateConfiguration(newConfig: Partial<ComplianceConfig>): Promise<void> {
    try {
      logger.info('Updating compliance configuration...');

      // Merge with existing configuration
      this.config = { ...this.config, ...newConfig };

      // Update components with new configuration
      await Promise.all([
        this.ruleEngine.updateConfiguration(this.config),
        this.jurisdictionManager.updateConfiguration(this.config.jurisdictions),
        this.realTimeMonitor.updateConfiguration(this.config.monitoring),
        this.transactionMonitor.updateConfiguration(this.config.monitoring),
        this.alertManager.updateConfiguration(this.config.alerts),
        this.kycWorkflow.updateConfiguration(this.config.kyc)
      ]);

      logger.info('Compliance configuration updated successfully');

      this.emit('configuration_updated', {
        timestamp: new Date(),
        changes: Object.keys(newConfig)
      });

    } catch (error) {
      logger.error('Failed to update compliance configuration:', error);
      throw error;
    }
  }

  /**
   * Get comprehensive engine status
   */
  getEngineStatus(): any {
    return {
      initialized: this.isInitialized,
      running: this.isRunning,
      timestamp: new Date(),
      components: {
        ruleEngine: this.ruleEngine.getStatus(),
        jurisdictionManager: this.jurisdictionManager.getStatus(),
        realTimeMonitor: this.realTimeMonitor.getStatus(),
        transactionMonitor: this.transactionMonitor.getStatus(),
        alertManager: this.alertManager.getStatus(),
        kycWorkflow: this.kycWorkflow.getStatus(),
        auditTrail: this.auditTrail.getStatus()
      },
      configuration: {
        jurisdictionsEnabled: this.config.jurisdictions.filter(j => j.enabled).length,
        realTimeMonitoring: this.config.monitoring.realTime,
        kycProvidersActive: this.config.kyc.providers.filter(p => p.enabled).length,
        screeningProvidersActive: this.config.screening.providers.filter(p => p.enabled).length,
        alertChannelsActive: this.config.alerts.channels.filter(c => c.enabled).length
      }
    };
  }

  // Private helper methods

  private setupEventListeners(): void {
    // Real-time monitor events
    this.realTimeMonitor.on('violation_detected', this.handleViolationDetected.bind(this));
    this.realTimeMonitor.on('threshold_exceeded', this.handleThresholdExceeded.bind(this));

    // Transaction monitor events
    this.transactionMonitor.on('suspicious_pattern', this.handleSuspiciousPattern.bind(this));
    this.transactionMonitor.on('velocity_limit_exceeded', this.handleVelocityLimitExceeded.bind(this));

    // Alert manager events
    this.alertManager.on('alert_triggered', this.handleAlertTriggered.bind(this));
    this.alertManager.on('alert_escalated', this.handleAlertEscalated.bind(this));

    // KYC workflow events
    this.kycWorkflow.on('kyc_status_changed', this.handleKYCStatusChanged.bind(this));
    this.kycWorkflow.on('manual_review_required', this.handleManualReviewRequired.bind(this));
  }

  private async performUserScreening(_user: User): Promise<any> {
    // Placeholder for user screening logic
    // This would integrate with Chainalysis, TRM Labs, etc.
    return {
      clear: true,
      flags: [],
      sanctions: { status: 'clear', checkedAt: new Date(), lists: [], matches: [] },
      pep: { status: 'clear', checkedAt: new Date(), matches: [] }
    };
  }

  private async performAddressScreening(_transaction: Transaction): Promise<any> {
    // Placeholder for address screening logic
    return {
      clear: true,
      flags: []
    };
  }

  private async calculateUserRiskScore(_user: User, screeningResult: any): Promise<number> {
    let riskScore = 0;

    // Base risk by jurisdiction
    const jurisdictionRisk = this.getJurisdictionRisk(_user.jurisdiction);
    riskScore += jurisdictionRisk;

    // Activity level risk
    const activityRisk = this.getActivityLevelRisk(_user.activityLevel);
    riskScore += activityRisk;

    // Screening results
    if (!screeningResult.clear) {
      riskScore += 50;
    }

    // PEP status
    if (_user.riskProfile.politicallyExposed) {
      riskScore += 30;
    }

    // High-risk countries
    if (_user.riskProfile.highRiskCountries.length > 0) {
      riskScore += _user.riskProfile.highRiskCountries.length * 10;
    }

    return Math.min(100, Math.max(0, riskScore));
  }

  private async calculateTransactionRiskScore(
    transaction: Transaction,
    user: User,
    amlResult: any,
    velocityCheck: any,
    addressScreening: any
  ): Promise<number> {
    let riskScore = 0;

    // Base user risk
    riskScore += user.riskProfile.overallRisk === 'high' ? 30 : 
                 user.riskProfile.overallRisk === 'medium' ? 15 : 5;

    // Transaction amount risk
    const amountThreshold = this.config.monitoring.thresholds.transactionAmount[transaction.currency] || 10000;
    if (transaction.amount > amountThreshold) {
      riskScore += Math.min(30, (transaction.amount / amountThreshold) * 10);
    }

    // AML screening results
    if (amlResult.riskScore) {
      riskScore += amlResult.riskScore * 0.3;
    }

    // Velocity check results
    if (velocityCheck.limitExceeded) {
      riskScore += 25;
    }

    // Address screening results
    if (!addressScreening.clear) {
      riskScore += 40;
    }

    return Math.min(100, Math.max(0, riskScore));
  }

  private async checkUserViolations(
    user: User,
    _applicableRules: any[],
    kycAssessment: any
  ): Promise<ComplianceViolation[]> {
    const violations: ComplianceViolation[] = [];

    // Check KYC compliance
    if (!kycAssessment.compliant) {
      violations.push({
        id: this.generateRequestId(),
        ruleId: 'kyc-requirement',
        entityType: 'user',
        entityId: user.id,
        jurisdiction: user.jurisdiction,
        category: 'kyc-aml',
        severity: 'high',
        description: 'User does not meet KYC requirements',
        details: { kycStatus: kycAssessment.status, requiredLevel: kycAssessment.requiredLevel },
        detectedAt: new Date(),
        status: 'open',
        escalated: false
      });
    }

    return violations;
  }

  private async checkTransactionViolations(
    transaction: Transaction,
    user: User,
    _applicableRules: any[],
    _amlResult: any,
    velocityCheck: any
  ): Promise<ComplianceViolation[]> {
    const violations: ComplianceViolation[] = [];

    // Check velocity limits
    if (velocityCheck.limitExceeded) {
      violations.push({
        id: this.generateRequestId(),
        ruleId: 'velocity-limit',
        entityType: 'transaction',
        entityId: transaction.id,
        jurisdiction: user.jurisdiction,
        category: 'kyc-aml',
        severity: 'medium',
        description: 'Transaction velocity limit exceeded',
        details: { 
          limit: velocityCheck.limit,
          current: velocityCheck.current,
          timeframe: velocityCheck.timeframe
        },
        detectedAt: new Date(),
        status: 'open',
        escalated: false
      });
    }

    return violations;
  }

  private async generateUserRecommendations(
    user: User,
    kycAssessment: any,
    screeningResult: any,
    violations: ComplianceViolation[]
  ): Promise<string[]> {
    const recommendations: string[] = [];

    if (!kycAssessment.compliant) {
      recommendations.push('Complete enhanced KYC verification');
    }

    if (!screeningResult.clear) {
      recommendations.push('Manual review required for screening alerts');
    }

    if (violations.length > 0) {
      recommendations.push('Address compliance violations before proceeding');
    }

    return recommendations;
  }

  private determineComplianceStatus(
    kycCompliant: boolean,
    screeningClear: boolean,
    noViolations: boolean
  ): ComplianceStatus {
    if (kycCompliant && screeningClear && noViolations) {
      return 'compliant';
    } else if (kycCompliant && screeningClear) {
      return 'partial';
    } else {
      return 'non-compliant';
    }
  }

  private calculateNextReview(activityLevel: string, riskScore: number): Date {
    let days = 365; // Default annual review

    if (riskScore >= 75) days = 30; // Monthly for high risk
    else if (riskScore >= 50) days = 90; // Quarterly for medium risk
    else if (riskScore >= 25) days = 180; // Semi-annual for low-medium risk

    // Adjust by activity level
    if (activityLevel === 'institutional') days = Math.max(days, 90);
    else if (activityLevel === 'high-net-worth') days = Math.max(days, 180);

    return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  }

  private getJurisdictionRisk(jurisdiction: Jurisdiction): number {
    const riskMap: Record<Jurisdiction, number> = {
      'US': 5, 'EU': 5, 'UK': 5, 'Singapore': 10, 'Switzerland': 10,
      'Japan': 10, 'Canada': 10, 'Australia': 10, 'Dubai': 20,
      'Hong Kong': 15, 'Cayman Islands': 25, 'BVI': 30
    };
    return riskMap[jurisdiction] || 50;
  }

  private getActivityLevelRisk(activityLevel: string): number {
    const riskMap: Record<string, number> = {
      'retail': 5,
      'professional': 15,
      'high-net-worth': 25,
      'institutional': 35
    };
    return riskMap[activityLevel] || 20;
  }

  private generateRequestId(): string {
    return `comp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Event handlers
  private async handleViolationDetected(data: any): Promise<void> {
    logger.warn('Compliance violation detected', data);
  }

  private async handleThresholdExceeded(data: any): Promise<void> {
    logger.warn('Compliance threshold exceeded', data);
  }

  private async handleSuspiciousPattern(data: any): Promise<void> {
    logger.warn('Suspicious pattern detected', data);
  }

  private async handleVelocityLimitExceeded(data: any): Promise<void> {
    logger.warn('Velocity limit exceeded', data);
  }

  private async handleAlertTriggered(data: any): Promise<void> {
    logger.info('Compliance alert triggered', data);
  }

  private async handleAlertEscalated(data: any): Promise<void> {
    logger.warn('Compliance alert escalated', data);
  }

  private async handleKYCStatusChanged(data: any): Promise<void> {
    logger.info('KYC status changed', data);
  }

  private async handleManualReviewRequired(data: any): Promise<void> {
    logger.warn('Manual review required', data);
  }

  private async handleUserRegistered(event: ComplianceEvent): Promise<void> {
    // Trigger initial KYC assessment
    logger.info('Processing user registration event', { userId: event.entityId });
  }

  private async handleKYCSubmitted(event: ComplianceEvent): Promise<void> {
    // Process KYC submission
    logger.info('Processing KYC submission event', { userId: event.entityId });
  }

  private async handleTransactionSubmitted(event: ComplianceEvent): Promise<void> {
    // Process transaction submission
    logger.info('Processing transaction submission event', { transactionId: event.entityId });
  }

  private async handleRegulatoryChange(event: ComplianceEvent): Promise<void> {
    // Process regulatory change
    logger.info('Processing regulatory change event', { jurisdiction: event.jurisdiction });
  }
}