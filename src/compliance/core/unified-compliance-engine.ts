/**
 * Unified Compliance Engine
 * Orchestrates both traditional and decentralized compliance workflows
 */

import { EventEmitter } from 'events';
import Logger from '../../shared/logging/logger';

// Traditional compliance components
import { ComplianceEngine } from './compliance-engine';
import { RuleEngine } from './rule-engine';
import { JurisdictionManager } from './jurisdiction-manager';

// Decentralized compliance components
import { DecentralizedIdentityService } from '../kyc/decentralized-identity.service';
import { DecentralizedKYCWorkflow } from '../kyc/decentralized-kyc-workflow';
import { DecentralizedAuthService } from '../../auth/services/decentralized-auth.service';

// Monitoring and alerting
import { RealTimeMonitor } from '../monitoring/real-time-monitor';
import { TransactionMonitor } from '../monitoring/transaction-monitor';
import { AlertManager } from '../monitoring/alert-manager';
import { AuditTrail } from '../reporting/audit-trail';

import {
  User,
  Transaction,
  ComplianceConfig,
  ComplianceResult,
  ComplianceResponse,
  Jurisdiction
} from '../types';
import {
  DecentralizedUser,
  DecentralizedTransaction,
  DecentralizedKYCConfig
} from '../types/decentralized-types';

const logger = Logger.getLogger('unified-compliance-engine');

export interface UnifiedComplianceConfig {
  traditional: ComplianceConfig;
  decentralized: DecentralizedKYCConfig;
  mode: 'traditional-only' | 'decentralized-only' | 'hybrid';
  migrationSettings: {
    enableMigration: boolean;
    autoMigrateUsers: boolean;
    migrationIncentives: boolean;
  };
}

export interface UnifiedComplianceResult extends ComplianceResult {
  userType: 'traditional' | 'decentralized';
  migrationRecommended?: boolean;
  migrationBenefits?: string[];
  decentralizedFeatures?: {
    privacyScore: number;
    sovereigntyScore: number;
    trustScore: number;
  };
}

export class UnifiedComplianceEngine extends EventEmitter {
  private static instance: UnifiedComplianceEngine;
  private config: UnifiedComplianceConfig;
  
  // Traditional components
  private traditionalEngine: ComplianceEngine;
  private ruleEngine: RuleEngine;
  private jurisdictionManager: JurisdictionManager;
  
  // Decentralized components
  private decentralizedIdentityService: DecentralizedIdentityService;
  private decentralizedKYCWorkflow: DecentralizedKYCWorkflow;
  private decentralizedAuthService: DecentralizedAuthService;
  
  // Shared monitoring components
  private realTimeMonitor: RealTimeMonitor;
  private transactionMonitor: TransactionMonitor;
  private alertManager: AlertManager;
  private auditTrail: AuditTrail;
  
  private isInitialized = false;
  private isRunning = false;
  
  private stats = {
    traditionalUsers: 0,
    decentralizedUsers: 0,
    migratedUsers: 0,
    totalAssessments: 0,
    decentralizedAssessments: 0,
    traditionalAssessments: 0
  };

  private constructor(config: UnifiedComplianceConfig) {
    super();
    this.config = config;
    
    // Initialize traditional components
    this.traditionalEngine = ComplianceEngine.getInstance(config.traditional);
    this.ruleEngine = new RuleEngine(config.traditional);
    this.jurisdictionManager = new JurisdictionManager(config.traditional.jurisdictions);
    
    // Initialize decentralized components
    this.decentralizedIdentityService = new DecentralizedIdentityService();
    this.decentralizedKYCWorkflow = new DecentralizedKYCWorkflow(
      this.decentralizedIdentityService,
      config.decentralized
    );
    this.decentralizedAuthService = new DecentralizedAuthService(this.decentralizedIdentityService);
    
    // Initialize shared monitoring components
    this.realTimeMonitor = new RealTimeMonitor(config.traditional.monitoring);
    this.transactionMonitor = new TransactionMonitor(config.traditional.monitoring);
    this.alertManager = new AlertManager(config.traditional.alerts);
    this.auditTrail = new AuditTrail();
  }

  static getInstance(config?: UnifiedComplianceConfig): UnifiedComplianceEngine {
    if (!UnifiedComplianceEngine.instance) {
      if (!config) {
        throw new Error('Configuration required for first initialization');
      }
      UnifiedComplianceEngine.instance = new UnifiedComplianceEngine(config);
    }
    return UnifiedComplianceEngine.instance;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.warn('Unified Compliance Engine already initialized');
      return;
    }

    try {
      logger.info('Initializing Unified Compliance Engine...', {
        mode: this.config.mode,
        migrationEnabled: this.config.migrationSettings.enableMigration
      });

      // Initialize components based on mode
      if (this.config.mode === 'traditional-only' || this.config.mode === 'hybrid') {
        await this.initializeTraditionalComponents();
      }

      if (this.config.mode === 'decentralized-only' || this.config.mode === 'hybrid') {
        await this.initializeDecentralizedComponents();
      }

      // Always initialize shared monitoring components
      await this.initializeSharedComponents();

      // Set up cross-component event handling
      this.setupEventHandlers();

      this.isInitialized = true;
      logger.info('✅ Unified Compliance Engine initialized successfully');

      this.emit('engine_initialized', {
        mode: this.config.mode,
        timestamp: new Date()
      });

    } catch (error) {
      logger.error('Failed to initialize Unified Compliance Engine:', error);
      throw error;
    }
  }

  async start(): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('Unified Compliance Engine must be initialized before starting');
    }

    if (this.isRunning) {
      logger.warn('Unified Compliance Engine already running');
      return;
    }

    try {
      logger.info('Starting Unified Compliance Engine...');

      // Start all active components
      const startPromises = [];

      if (this.config.mode === 'traditional-only' || this.config.mode === 'hybrid') {
        startPromises.push(this.traditionalEngine.start());
      }

      // Shared monitoring components
      startPromises.push(
        this.realTimeMonitor.start(),
        this.transactionMonitor.start(),
        this.alertManager.start()
      );

      await Promise.all(startPromises);

      this.isRunning = true;
      logger.info('🚀 Unified Compliance Engine started successfully');

      this.emit('engine_started', {
        mode: this.config.mode,
        timestamp: new Date()
      });

    } catch (error) {
      logger.error('Failed to start Unified Compliance Engine:', error);
      throw error;
    }
  }

  /**
   * Unified compliance assessment that works with both user types
   */
  async assessCompliance(
    user: User | DecentralizedUser,
    context?: Record<string, any>
  ): Promise<UnifiedComplianceResult> {
    const startTime = Date.now();

    try {
      this.stats.totalAssessments++;

      // Determine user type and route to appropriate engine
      const userType = this.getUserType(user);
      
      logger.info('Assessing compliance', {
        userType,
        userId: this.getUserId(user),
        mode: this.config.mode
      });

      let result: ComplianceResult;
      let migrationRecommended = false;
      let migrationBenefits: string[] = [];
      let decentralizedFeatures: any = undefined;

      if (userType === 'decentralized') {
        const decentralizedUser = user as DecentralizedUser;
        result = await this.assessDecentralizedCompliance(decentralizedUser);
        this.stats.decentralizedAssessments++;
        this.stats.decentralizedUsers++;

        // Calculate decentralized features scores
        decentralizedFeatures = {
          privacyScore: this.calculatePrivacyScore(decentralizedUser),
          sovereigntyScore: this.calculateSovereigntyScore(decentralizedUser),
          trustScore: this.calculateTrustScore(decentralizedUser)
        };
      } else {
        const traditionalUser = user as User;
        result = await this.assessTraditionalCompliance(traditionalUser);
        this.stats.traditionalAssessments++;
        this.stats.traditionalUsers++;

        // Check if migration is recommended
        if (this.config.migrationSettings.enableMigration) {
          const migrationAnalysis = this.analyzeMigrationBenefits(traditionalUser);
          migrationRecommended = migrationAnalysis.recommended;
          migrationBenefits = migrationAnalysis.benefits;
        }
      }

      // Record audit trail
      await this.auditTrail.recordAction({
        action: 'compliance_assessment',
        entityType: 'user',
        entityId: this.getUserId(user),
        userId: this.getUserId(user),
        jurisdiction: this.getUserJurisdiction(user),
        compliance: true,
        reason: `${userType} compliance assessment`
      });

      const unifiedResult: UnifiedComplianceResult = {
        ...result,
        userType,
        migrationRecommended,
        migrationBenefits,
        decentralizedFeatures
      };

      // Emit assessment completed event
      this.emit('compliance_assessed', {
        userType,
        userId: this.getUserId(user),
        result: unifiedResult,
        processingTime: Date.now() - startTime,
        timestamp: new Date()
      });

      return unifiedResult;

    } catch (error) {
      logger.error('Error in unified compliance assessment:', error);
      throw error;
    }
  }

  /**
   * Unified transaction screening
   */
  async screenTransaction(
    transaction: Transaction | DecentralizedTransaction,
    user: User | DecentralizedUser
  ): Promise<ComplianceResponse<ComplianceResult>> {
    const startTime = Date.now();

    try {
      const userType = this.getUserType(user);
      const transactionType = this.getTransactionType(transaction);

      logger.info('Screening transaction', {
        userType,
        transactionType,
        transactionId: transaction.id,
        userId: this.getUserId(user)
      });

      let result: ComplianceResponse<ComplianceResult>;

      if (userType === 'decentralized' && transactionType === 'decentralized') {
        result = await this.screenDecentralizedTransaction(
          transaction as DecentralizedTransaction,
          user as DecentralizedUser
        );
      } else {
        result = await this.traditionalEngine.screenTransaction(
          transaction as Transaction,
          user as User
        );
      }

      // Record in audit trail
      await this.auditTrail.recordTransactionAction(
        transaction as Transaction,
        user as User,
        'transaction_screened',
        undefined,
        { screeningResult: result },
        `${userType} transaction screening`
      );

      logger.info('Transaction screening completed', {
        transactionId: transaction.id,
        approved: result.success && result.data?.compliant,
        processingTime: Date.now() - startTime
      });

      return result;

    } catch (error) {
      logger.error('Error screening transaction:', error);
      throw error;
    }
  }

  /**
   * Migrate user from traditional to decentralized
   */
  async migrateUserToDecentralized(
    traditionalUser: User,
    walletAddress: string,
    preferences: {
      privacyLevel: 'minimal' | 'balanced' | 'maximum';
      dataSharing: boolean;
      anonymousMode: boolean;
    }
  ): Promise<DecentralizedUser> {
    try {
      logger.info('Migrating user to decentralized', {
        userId: traditionalUser.id,
        walletAddress
      });

      // Set up decentralized user
      const { user: decentralizedUser } = await this.decentralizedAuthService.setupDecentralizedUser(
        walletAddress,
        preferences
      );

      // Migrate compliance data
      await this.migrateComplianceData(traditionalUser, decentralizedUser);

      // Update user type
      traditionalUser.authenticationMethod = 'decentralized';
      traditionalUser.decentralizedIdentity = {
        did: decentralizedUser.did,
        walletAddress,
        verifiableCredentials: decentralizedUser.decentralizedIdentity.verifiableCredentials,
        proofOfPersonhood: decentralizedUser.decentralizedIdentity.proofOfPersonhood
      };

      this.stats.migratedUsers++;

      // Record migration in audit trail
      await this.auditTrail.recordAction({
        action: 'user_migration',
        entityType: 'user',
        entityId: traditionalUser.id,
        userId: traditionalUser.id,
        jurisdiction: traditionalUser.jurisdiction,
        compliance: true,
        reason: 'Migration from traditional to decentralized identity',
        before: { authMethod: 'traditional' },
        after: { authMethod: 'decentralized', did: decentralizedUser.did }
      });

      logger.info('User migration completed', {
        userId: traditionalUser.id,
        did: decentralizedUser.did
      });

      this.emit('user_migrated', {
        userId: traditionalUser.id,
        did: decentralizedUser.did,
        timestamp: new Date()
      });

      return decentralizedUser;

    } catch (error) {
      logger.error('Error migrating user to decentralized:', error);
      throw error;
    }
  }

  /**
   * Get unified engine status
   */
  getEngineStatus(): any {
    const traditionalStatus = this.config.mode !== 'decentralized-only' ? 
      this.traditionalEngine.getEngineStatus() : null;

    const decentralizedStatus = this.config.mode !== 'traditional-only' ? {
      identityService: this.decentralizedIdentityService.getStatus(),
      kycWorkflow: this.decentralizedKYCWorkflow.getStatus(),
      authService: this.decentralizedAuthService.getStatus()
    } : null;

    return {
      initialized: this.isInitialized,
      running: this.isRunning,
      mode: this.config.mode,
      statistics: this.stats,
      traditional: traditionalStatus,
      decentralized: decentralizedStatus,
      shared: {
        realTimeMonitor: this.realTimeMonitor.getStatus(),
        transactionMonitor: this.transactionMonitor.getStatus(),
        alertManager: this.alertManager.getStatus(),
        auditTrail: this.auditTrail.getStatus()
      }
    };
  }

  // Private methods

  private async initializeTraditionalComponents(): Promise<void> {
    await Promise.all([
      this.traditionalEngine.initialize(),
      this.ruleEngine.initialize(),
      this.jurisdictionManager.initialize()
    ]);
    logger.debug('Traditional components initialized');
  }

  private async initializeDecentralizedComponents(): Promise<void> {
    await Promise.all([
      this.decentralizedIdentityService.initialize(),
      this.decentralizedKYCWorkflow.initialize(),
      this.decentralizedAuthService.initialize()
    ]);
    logger.debug('Decentralized components initialized');
  }

  private async initializeSharedComponents(): Promise<void> {
    await Promise.all([
      this.realTimeMonitor.initialize(),
      this.transactionMonitor.initialize(),
      this.alertManager.initialize(),
      this.auditTrail.initialize()
    ]);
    logger.debug('Shared monitoring components initialized');
  }

  private setupEventHandlers(): void {
    // Traditional engine events
    if (this.traditionalEngine) {
      this.traditionalEngine.on('user_compliance_assessed', (data) => {
        this.emit('traditional_compliance_assessed', data);
      });
    }

    // Decentralized events
    if (this.decentralizedKYCWorkflow) {
      this.decentralizedKYCWorkflow.on('kyc_assessed', (data) => {
        this.emit('decentralized_kyc_assessed', data);
      });
    }

    // Monitoring events
    this.realTimeMonitor.on('violation_detected', (data) => {
      this.emit('violation_detected', data);
    });

    this.alertManager.on('alert_triggered', (data) => {
      this.emit('alert_triggered', data);
    });
  }

  private getUserType(user: User | DecentralizedUser): 'traditional' | 'decentralized' {
    if ('did' in user) {
      return 'decentralized';
    }
    if ('authenticationMethod' in user && user.authenticationMethod === 'decentralized') {
      return 'decentralized';
    }
    return 'traditional';
  }

  private getTransactionType(transaction: Transaction | DecentralizedTransaction): 'traditional' | 'decentralized' {
    if ('zkProofs' in transaction) {
      return 'decentralized';
    }
    return 'traditional';
  }

  private getUserId(user: User | DecentralizedUser): string {
    return 'did' in user ? user.did : user.id;
  }

  private getUserJurisdiction(user: User | DecentralizedUser): Jurisdiction {
    if ('did' in user) {
      // For decentralized users, jurisdiction might be determined from ZK proofs
      return 'US'; // Default fallback
    }
    return (user as User).jurisdiction;
  }

  private async assessTraditionalCompliance(user: User): Promise<ComplianceResult> {
    return this.traditionalEngine.assessUserCompliance(user);
  }

  private async assessDecentralizedCompliance(user: DecentralizedUser): Promise<ComplianceResult> {
    const assessment = await this.decentralizedKYCWorkflow.assessDecentralizedKYC(
      user.did,
      user.activityLevel
    );

    // Convert to ComplianceResult format
    return {
      compliant: assessment.compliant,
      riskScore: assessment.confidence,
      flags: [],
      violations: [],
      recommendations: assessment.recommendations,
      nextReview: assessment.expiresAt,
      jurisdiction: 'US', // Would be determined from ZK proofs
      timestamp: new Date()
    };
  }

  private async screenDecentralizedTransaction(
    transaction: DecentralizedTransaction,
    user: DecentralizedUser
  ): Promise<ComplianceResponse<ComplianceResult>> {
    try {
      // Verify ZK proofs
      const zkProofValid = await this.verifyTransactionZKProofs(transaction);
      
      // Check compliance status
      const compliant = zkProofValid && transaction.complianceStatus.approved;

      const result: ComplianceResult = {
        compliant,
        riskScore: transaction.complianceStatus.riskScore,
        flags: transaction.complianceStatus.flags.map(flag => ({
          type: flag.type as any,
          severity: flag.severity,
          description: flag.description,
          source: 'decentralized-screening',
          confidence: flag.confidence / 100,
          timestamp: flag.timestamp,
          metadata: {}
        })),
        violations: [],
        recommendations: compliant ? [] : ['Manual review required'],
        jurisdiction: 'US', // From ZK jurisdiction proof
        timestamp: new Date()
      };

      return {
        success: true,
        data: result,
        timestamp: new Date(),
        requestId: this.generateRequestId(),
        compliance: {
          processed: true,
          flags: result.flags,
          riskScore: result.riskScore
        }
      };

    } catch (error) {
      return {
        success: false,
        error: `Decentralized transaction screening failed: ${error}`,
        timestamp: new Date(),
        requestId: this.generateRequestId(),
        compliance: {
          processed: false,
          flags: [],
          riskScore: 100
        }
      };
    }
  }

  private async verifyTransactionZKProofs(transaction: DecentralizedTransaction): Promise<boolean> {
    if (!transaction.zkProofs) return true; // No proofs required

    const proofVerifications = [];

    if (transaction.zkProofs.amountProof) {
      proofVerifications.push(this.verifyZKProof(transaction.zkProofs.amountProof));
    }

    if (transaction.zkProofs.complianceProof) {
      proofVerifications.push(this.verifyZKProof(transaction.zkProofs.complianceProof));
    }

    if (transaction.zkProofs.sanctionsProof) {
      proofVerifications.push(this.verifyZKProof(transaction.zkProofs.sanctionsProof));
    }

    const results = await Promise.all(proofVerifications);
    return results.every(result => result);
  }

  private async verifyZKProof(proof: any): Promise<boolean> {
    // Mock ZK proof verification
    return proof && proof.proof && proof.verifiedAt > new Date(Date.now() - 24 * 60 * 60 * 1000);
  }

  private calculatePrivacyScore(user: DecentralizedUser): number {
    let score = 0;
    
    if (user.decentralizedIdentity.privacySettings.anonymousMode) score += 30;
    if (user.decentralizedIdentity.privacySettings.dataMinimization) score += 25;
    if (user.profile.zkProofs.age) score += 15;
    if (user.profile.zkProofs.jurisdiction) score += 15;
    if (user.profile.zkProofs.sanctions) score += 15;

    return Math.min(100, score);
  }

  private calculateSovereigntyScore(user: DecentralizedUser): number {
    let score = 50; // Base score for having DID
    
    score += user.decentralizedIdentity.verifiableCredentials.length * 10;
    if (user.decentralizedIdentity.proofOfPersonhood) score += 20;
    if (user.decentralizedIdentity.socialRecovery?.enabled) score += 10;
    score += user.decentralizedIdentity.crossChainIdentities.length * 5;

    return Math.min(100, score);
  }

  private calculateTrustScore(user: DecentralizedUser): number {
    let score = user.reputation.overallScore / 10; // Scale from 1000 to 100
    
    score += user.socialGraph.verifiedConnections * 2;
    score += user.socialGraph.daoMemberships.length * 5;
    if (user.kycStatus.biometricVerified) score += 15;
    
    return Math.min(100, score);
  }

  private analyzeMigrationBenefits(user: User): { recommended: boolean; benefits: string[] } {
    const benefits: string[] = [];
    let score = 0;

    // User would benefit from privacy features
    if (user.riskProfile.overallRisk === 'low') {
      benefits.push('Enhanced privacy with zero-knowledge proofs');
      score += 20;
    }

    // User is tech-savvy (high activity)
    if (user.activityLevel === 'professional' || user.activityLevel === 'institutional') {
      benefits.push('Self-sovereign identity control');
      score += 25;
    }

    // User has compliance burden
    if (user.kycStatus.level === 'enhanced' || user.kycStatus.level === 'institutional') {
      benefits.push('Streamlined compliance with verifiable credentials');
      score += 20;
    }

    // Global user
    if (user.citizenships.length > 1) {
      benefits.push('Cross-border identity portability');
      score += 15;
    }

    // Security conscious
    if (user.lastActivity > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)) {
      benefits.push('Reduced single point of failure risk');
      score += 10;
    }

    return {
      recommended: score >= 50,
      benefits
    };
  }

  private async migrateComplianceData(traditional: User, decentralized: DecentralizedUser): Promise<void> {
    // Map traditional KYC level to decentralized
    decentralized.kycStatus.level = traditional.kycStatus.level;
    decentralized.kycStatus.verified = traditional.kycStatus.status === 'approved';
    
    // Map activity level
    decentralized.activityLevel = traditional.activityLevel;
    
    // Create privacy-preserving profile from traditional data
    if (traditional.kycStatus.verificationDate) {
      decentralized.profile.ageGroup = this.mapAgeToGroup(traditional); // Would extract from traditional data
    }

    logger.debug('Compliance data migrated', {
      traditionalId: traditional.id,
      decentralizedDID: decentralized.did
    });
  }

  private mapAgeToGroup(user: User): 'minor' | '18-25' | '26-40' | '41-65' | '65+' {
    // Mock implementation - would calculate from actual birth date
    return '26-40';
  }

  private generateRequestId(): string {
    return `unified_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}