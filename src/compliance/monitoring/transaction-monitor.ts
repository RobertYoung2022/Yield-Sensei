/**
 * Transaction Monitor
 * Specialized monitoring for transaction compliance and AML screening
 */

import { EventEmitter } from 'events';
import Logger from '../../shared/logging/logger';
import {
  Transaction,
  User,
  MonitoringConfig,
  ComplianceFlag,
  AMLCheck,
  SanctionsCheck,
  ComplianceViolation,
  RiskLevel
} from '../types';
import {
  DecentralizedUser,
  DecentralizedTransaction
} from '../types/decentralized-types';
import { MLPatternRecognition, TransactionPattern } from '../ml/pattern-recognition';
import { BlockchainAnalyticsService, AnalyticsResult } from '../integrations/blockchain-analytics';

const logger = Logger.getLogger('transaction-monitor');

interface VelocityMetrics {
  userId: string;
  dailyCount: number;
  dailyVolume: number;
  weeklyVolume: number;
  monthlyVolume: number;
  lastTransactionTime: Date;
  suspiciousPatterns: string[];
}

interface VelocityCheckResult {
  limitExceeded: boolean;
  limit: number;
  current: number;
  timeframe: string;
  flags: ComplianceFlag[];
}

interface PatternDetectionResult {
  suspicious: boolean;
  patterns: SuspiciousPattern[];
  riskScore: number;
}

interface DecentralizedScreeningResult {
  zkProofValid: boolean;
  privacyPreserved: boolean;
  complianceAssured: boolean;
  riskScore: number;
  flags: ComplianceFlag[];
  proofVerifications: ZKProofVerification[];
}

interface ZKProofVerification {
  proofType: string;
  valid: boolean;
  confidence: number;
  verifiedAt: Date;
  circuit: string;
  publicInputs: string[];
}

interface SuspiciousPattern {
  type: string;
  description: string;
  severity: RiskLevel;
  confidence: number;
  metadata: Record<string, any>;
}

export class TransactionMonitor extends EventEmitter {
  private config: MonitoringConfig;
  private isInitialized = false;
  private isRunning = false;
  private velocityMetrics: Map<string, VelocityMetrics> = new Map();
  private addressCache: Map<string, any> = new Map();
  private mlPatternRecognition?: MLPatternRecognition;
  private blockchainAnalytics?: BlockchainAnalyticsService;
  private monitoringStats = {
    transactionsScreened: 0,
    violationsDetected: 0,
    patternsDetected: 0,
    velocityViolations: 0,
    mlPatternsDetected: 0,
    blockchainAnalyticsChecks: 0
  };

  constructor(config: MonitoringConfig) {
    super();
    this.config = config;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.warn('Transaction Monitor already initialized');
      return;
    }

    try {
      // Initialize ML pattern recognition
      this.mlPatternRecognition = new MLPatternRecognition();
      await this.mlPatternRecognition.initialize();
      
      // Initialize blockchain analytics if configured
      if (this.config.blockchainAnalytics) {
        this.blockchainAnalytics = new BlockchainAnalyticsService();
        await this.blockchainAnalytics.initialize({
          chainalysis: this.config.blockchainAnalytics.chainalysis,
          trmLabs: this.config.blockchainAnalytics.trmLabs
        });
        logger.info('Blockchain analytics initialized');
      }
      logger.info('Initializing Transaction Monitor...');

      // Set up periodic cleanup
      setInterval(() => this.cleanupVelocityMetrics(), 60 * 60 * 1000); // Every hour

      this.isInitialized = true;
      logger.info('✅ Transaction Monitor initialized successfully');

    } catch (error) {
      logger.error('Failed to initialize Transaction Monitor:', error);
      throw error;
    }
  }

  async start(): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('Transaction Monitor must be initialized before starting');
    }

    if (this.isRunning) {
      logger.warn('Transaction Monitor already running');
      return;
    }

    this.isRunning = true;
    logger.info('🚀 Transaction Monitor started successfully');
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      logger.warn('Transaction Monitor is not running');
      return;
    }

    this.isRunning = false;
    logger.info('🛑 Transaction Monitor stopped successfully');
  }

  async updateConfiguration(newConfig: MonitoringConfig): Promise<void> {
    this.config = newConfig;
    logger.info('Transaction Monitor configuration updated');
  }

  /**
   * Screen transaction for AML compliance (supports both traditional and decentralized)
   */
  async screenTransaction(
    transaction: Transaction | DecentralizedTransaction, 
    user: User | DecentralizedUser
  ): Promise<AMLCheck> {
    const startTime = Date.now();

    try {
      logger.debug('Screening transaction for AML', {
        transactionId: transaction.id,
        userId: user.id,
        amount: transaction.amount,
        type: transaction.type
      });

      // Determine transaction type and perform appropriate screening
      const isDecentralized = this.isDecentralizedTransaction(transaction) && this.isDecentralizedUser(user);
      
      let amlResult: AMLCheck;
      if (isDecentralized) {
        const decentralizedResult = await this.screenDecentralizedTransaction(
          transaction as DecentralizedTransaction,
          user as DecentralizedUser
        );
        amlResult = this.convertDecentralizedToAMLCheck(decentralizedResult, transaction, user);
      } else {
        amlResult = await this.performAMLScreening(transaction as Transaction, user as User);
      }

      // Update statistics
      this.monitoringStats.transactionsScreened++;

      // Emit screening completed event
      this.emit('transaction_screened', {
        transactionId: transaction.id,
        userId: user.id,
        result: amlResult,
        processingTime: Date.now() - startTime,
        timestamp: new Date()
      });

      return amlResult;

    } catch (error) {
      logger.error('Error screening transaction:', error);
      throw error;
    }
  }

  /**
   * Check velocity limits for user transactions
   */
  async checkVelocityLimits(userId: string, transaction: Transaction): Promise<VelocityCheckResult> {
    try {
      // Get or create velocity metrics for user
      let metrics = this.velocityMetrics.get(userId);
      if (!metrics) {
        metrics = {
          userId,
          dailyCount: 0,
          dailyVolume: 0,
          weeklyVolume: 0,
          monthlyVolume: 0,
          lastTransactionTime: new Date(),
          suspiciousPatterns: []
        };
        this.velocityMetrics.set(userId, metrics);
      }

      // Update metrics with current transaction
      this.updateVelocityMetrics(metrics, transaction);

      // Check against configured limits
      const velocityLimits = this.config.thresholds.velocityLimits;
      const flags: ComplianceFlag[] = [];

      // Check daily transaction count
      if (metrics.dailyCount > velocityLimits['daily_transaction_count']) {
        flags.push({
          type: 'velocity-anomaly',
          severity: 'medium',
          description: `Daily transaction count exceeded: ${metrics.dailyCount} > ${velocityLimits['daily_transaction_count']}`,
          source: 'transaction-monitor',
          confidence: 0.9,
          timestamp: new Date(),
          metadata: {
            limit: velocityLimits.daily_transaction_count,
            current: metrics.dailyCount,
            timeframe: 'daily'
          }
        });
      }

      // Check daily volume
      if (metrics.dailyVolume > velocityLimits.daily_transaction_volume) {
        flags.push({
          type: 'velocity-anomaly',
          severity: 'high',
          description: `Daily transaction volume exceeded: ${metrics.dailyVolume} > ${velocityLimits.daily_transaction_volume}`,
          source: 'transaction-monitor',
          confidence: 0.95,
          timestamp: new Date(),
          metadata: {
            limit: velocityLimits.daily_transaction_volume,
            current: metrics.dailyVolume,
            timeframe: 'daily'
          }
        });
      }

      // Check weekly volume
      if (metrics.weeklyVolume > velocityLimits.weekly_transaction_volume) {
        flags.push({
          type: 'velocity-anomaly',
          severity: 'high',
          description: `Weekly transaction volume exceeded: ${metrics.weeklyVolume} > ${velocityLimits.weekly_transaction_volume}`,
          source: 'transaction-monitor',
          confidence: 0.9,
          timestamp: new Date(),
          metadata: {
            limit: velocityLimits.weekly_transaction_volume,
            current: metrics.weeklyVolume,
            timeframe: 'weekly'
          }
        });
      }

      // Check monthly volume
      if (metrics.monthlyVolume > velocityLimits.monthly_transaction_volume) {
        flags.push({
          type: 'velocity-anomaly',
          severity: 'critical',
          description: `Monthly transaction volume exceeded: ${metrics.monthlyVolume} > ${velocityLimits.monthly_transaction_volume}`,
          source: 'transaction-monitor',
          confidence: 0.95,
          timestamp: new Date(),
          metadata: {
            limit: velocityLimits.monthly_transaction_volume,
            current: metrics.monthlyVolume,
            timeframe: 'monthly'
          }
        });
      }

      const limitExceeded = flags.length > 0;

      if (limitExceeded) {
        this.monitoringStats.velocityViolations++;
        
        this.emit('velocity_limit_exceeded', {
          userId,
          transactionId: transaction.id,
          flags,
          metrics: { ...metrics },
          timestamp: new Date()
        });
      }

      return {
        limitExceeded,
        limit: Math.max(
          velocityLimits.daily_transaction_count,
          velocityLimits.daily_transaction_volume,
          velocityLimits.weekly_transaction_volume,
          velocityLimits.monthly_transaction_volume
        ),
        current: Math.max(metrics.dailyCount, metrics.dailyVolume, metrics.weeklyVolume, metrics.monthlyVolume),
        timeframe: 'mixed',
        flags
      };

    } catch (error) {
      logger.error('Error checking velocity limits:', error);
      throw error;
    }
  }

  /**
   * Detect suspicious transaction patterns
   */
  async detectSuspiciousPatterns(transaction: Transaction, user: User): Promise<PatternDetectionResult> {
    try {
      const patterns: SuspiciousPattern[] = [];
      let riskScore = 0;

      // Pattern 1: Structuring (amounts just below reporting thresholds)
      const structuringPattern = this.detectStructuring(transaction, user);
      if (structuringPattern) {
        patterns.push(structuringPattern);
        riskScore += 30;
      }

      // Pattern 2: Round number transactions
      const roundNumberPattern = this.detectRoundNumbers(transaction);
      if (roundNumberPattern) {
        patterns.push(roundNumberPattern);
        riskScore += 10;
      }

      // Pattern 3: Rapid transactions
      const rapidPattern = await this.detectRapidTransactions(transaction, user);
      if (rapidPattern) {
        patterns.push(rapidPattern);
        riskScore += 25;
      }

      // Pattern 4: Unusual time patterns
      const timePattern = this.detectUnusualTiming(transaction);
      if (timePattern) {
        patterns.push(timePattern);
        riskScore += 15;
      }

      // Pattern 5: Cross-border indicators
      const crossBorderPattern = await this.detectCrossBorderActivity(transaction, user);
      if (crossBorderPattern) {
        patterns.push(crossBorderPattern);
        riskScore += 20;
      }

      const suspicious = patterns.length > 0 && riskScore > 25;

      if (suspicious) {
        this.monitoringStats.patternsDetected++;
        
        this.emit('suspicious_pattern', {
          transactionId: transaction.id,
          userId: user.id,
          patterns,
          riskScore,
          timestamp: new Date()
        });
      }

      return {
        suspicious,
        patterns,
        riskScore: Math.min(100, riskScore)
      };

    } catch (error) {
      logger.error('Error detecting suspicious patterns:', error);
      throw error;
    }
  }

  /**
   * Get monitoring statistics
   */
  getStatistics(): any {
    return {
      ...this.monitoringStats,
      activeUsers: this.velocityMetrics.size,
      averageTransactionsPerUser: this.velocityMetrics.size > 0 ? 
        Array.from(this.velocityMetrics.values()).reduce((sum, m) => sum + m.dailyCount, 0) / this.velocityMetrics.size : 0
    };
  }

  /**
   * Get monitor status
   */
  getStatus(): any {
    return {
      initialized: this.isInitialized,
      running: this.isRunning,
      trackedUsers: this.velocityMetrics.size,
      addressCacheSize: this.addressCache.size,
      statistics: this.getStatistics()
    };
  }

  // Private methods

  private async performAMLScreening(transaction: Transaction, user: User): Promise<AMLCheck> {
    // This would integrate with actual AML service providers
    // For now, return a mock result with basic risk assessment
    
    const riskFactors: any[] = [];
    let riskScore = 0;
    
    // ML Pattern Recognition Analysis
    let mlPatterns: TransactionPattern[] = [];
    if (this.mlPatternRecognition) {
      try {
        // Get related transactions for ML analysis
        const relatedTransactions = await this.getRelatedTransactions(user.id, transaction.timestamp);
        
        // Run ML pattern detection
        mlPatterns = await this.mlPatternRecognition.analyzeTransaction(
          transaction,
          user,
          relatedTransactions
        );
        
        // Add ML patterns to risk factors
        for (const pattern of mlPatterns) {
          riskFactors.push({
            type: `ml_pattern_${pattern.type}`,
            weight: pattern.confidence,
            value: pattern.name,
            contribution: pattern.riskScore * pattern.confidence,
            description: pattern.description,
            indicators: pattern.indicators
          });
          riskScore += Math.round(pattern.riskScore * pattern.confidence);
          this.monitoringStats.mlPatternsDetected++;
        }
      } catch (error) {
        logger.error('ML pattern detection failed', { error, transactionId: transaction.id });
      }
    }
    
    // Blockchain Analytics Check
    if (this.blockchainAnalytics && transaction.fromAccount && transaction.toAccount) {
      try {
        // Analyze sender address
        const senderAnalysis = await this.blockchainAnalytics.analyzeAddress(
          transaction.fromAccount,
          transaction
        );
        
        // Analyze recipient address
        const recipientAnalysis = await this.blockchainAnalytics.analyzeAddress(
          transaction.toAccount,
          transaction
        );
        
        // Process analytics results
        for (const analysis of [...senderAnalysis, ...recipientAnalysis]) {
          if (analysis.riskScore > 50) {
            riskFactors.push({
              type: `blockchain_analytics_${analysis.provider.toLowerCase()}`,
              weight: 0.8,
              value: `${analysis.address} - Risk: ${analysis.riskLevel}`,
              contribution: analysis.riskScore * 0.8,
              description: `Blockchain analytics detected ${analysis.riskLevel} risk`,
              metadata: {
                provider: analysis.provider,
                address: analysis.address,
                categories: analysis.categories,
                exposures: analysis.exposures
              }
            });
            riskScore += Math.round(analysis.riskScore * 0.5);
            this.monitoringStats.blockchainAnalyticsChecks++;
          }
        }
      } catch (error) {
        logger.error('Blockchain analytics check failed', { error, transactionId: transaction.id });
      }
    }

    // Risk factor: Large transaction
    const amountThreshold = this.config.thresholds.transactionAmount[transaction.currency] || 10000;
    if (transaction.amount > amountThreshold) {
      riskFactors.push({
        type: 'large_amount',
        weight: 0.3,
        value: transaction.amount,
        contribution: 30,
        description: 'Transaction amount exceeds threshold'
      });
      riskScore += 30;
    }

    // Risk factor: High-risk transaction type
    const riskTypes = ['bridge', 'yield-withdrawal', 'borrowing'];
    if (riskTypes.includes(transaction.type)) {
      riskFactors.push({
        type: 'high_risk_transaction_type',
        weight: 0.2,
        value: transaction.type,
        contribution: 20,
        description: 'High-risk transaction type'
      });
      riskScore += 20;
    }

    // Risk factor: User risk profile
    if (user.riskProfile.overallRisk === 'high') {
      riskFactors.push({
        type: 'high_risk_user',
        weight: 0.4,
        value: user.riskProfile.overallRisk,
        contribution: 40,
        description: 'User has high risk profile'
      });
      riskScore += 40;
    }

    const thresholds = [
      {
        name: 'manual_review_threshold',
        threshold: 75,
        current: riskScore,
        breached: riskScore > 75,
        action: 'manual_review'
      },
      {
        name: 'block_threshold',
        threshold: 90,
        current: riskScore,
        breached: riskScore > 90,
        action: 'block_transaction'
      }
    ];

    let recommendation: 'approve' | 'flag' | 'block' | 'manual-review' = 'approve';
    if (riskScore > 90) recommendation = 'block';
    else if (riskScore > 75) recommendation = 'manual-review';
    else if (riskScore > 50) recommendation = 'flag';

    return {
      riskScore: Math.min(100, riskScore),
      factors: riskFactors,
      thresholds,
      recommendation,
      provider: 'internal-engine',
      checkedAt: new Date(),
      mlPatterns: mlPatterns.length > 0 ? mlPatterns.map(p => ({
        type: p.type,
        name: p.name,
        confidence: p.confidence,
        riskScore: p.riskScore
      })) : undefined
    };
  }

  private updateVelocityMetrics(metrics: VelocityMetrics, transaction: Transaction): void {
    const now = new Date();
    const lastTransaction = metrics.lastTransactionTime;

    // Update daily metrics (reset if new day)
    if (this.isDifferentDay(now, lastTransaction)) {
      metrics.dailyCount = 1;
      metrics.dailyVolume = transaction.amount;
    } else {
      metrics.dailyCount++;
      metrics.dailyVolume += transaction.amount;
    }

    // Update weekly metrics (reset if new week)
    if (this.isDifferentWeek(now, lastTransaction)) {
      metrics.weeklyVolume = transaction.amount;
    } else {
      metrics.weeklyVolume += transaction.amount;
    }

    // Update monthly metrics (reset if new month)
    if (this.isDifferentMonth(now, lastTransaction)) {
      metrics.monthlyVolume = transaction.amount;
    } else {
      metrics.monthlyVolume += transaction.amount;
    }

    metrics.lastTransactionTime = now;
  }

  private detectStructuring(transaction: Transaction, user: User): SuspiciousPattern | null {
    const thresholds = this.config.thresholds.transactionAmount;
    const threshold = thresholds[transaction.currency] || 10000;
    
    // Check if amount is just below threshold (structuring indicator)
    const margin = threshold * 0.1; // 10% margin
    if (transaction.amount > (threshold - margin) && transaction.amount < threshold) {
      return {
        type: 'structuring',
        description: `Transaction amount (${transaction.amount}) just below reporting threshold (${threshold})`,
        severity: 'high',
        confidence: 0.8,
        metadata: {
          amount: transaction.amount,
          threshold,
          margin: threshold - transaction.amount
        }
      };
    }

    return null;
  }

  private detectRoundNumbers(transaction: Transaction): SuspiciousPattern | null {
    const amount = transaction.amount;
    
    // Check for suspiciously round numbers
    if (amount >= 1000 && amount % 1000 === 0) {
      return {
        type: 'round_number',
        description: `Suspiciously round transaction amount: ${amount}`,
        severity: 'low',
        confidence: 0.6,
        metadata: {
          amount,
          roundness: this.calculateRoundness(amount)
        }
      };
    }

    return null;
  }

  private async detectRapidTransactions(transaction: Transaction, user: User): Promise<SuspiciousPattern | null> {
    const userMetrics = this.velocityMetrics.get(user.id);
    if (!userMetrics) return null;

    const now = new Date();
    const timeSinceLastTransaction = now.getTime() - userMetrics.lastTransactionTime.getTime();
    
    // Flag if transactions are happening too rapidly (< 5 minutes)
    if (timeSinceLastTransaction < 5 * 60 * 1000 && userMetrics.dailyCount > 1) {
      return {
        type: 'rapid_transactions',
        description: `Rapid transactions detected: ${Math.round(timeSinceLastTransaction / 1000)} seconds between transactions`,
        severity: 'medium',
        confidence: 0.7,
        metadata: {
          timeBetween: timeSinceLastTransaction,
          dailyCount: userMetrics.dailyCount
        }
      };
    }

    return null;
  }

  private detectUnusualTiming(transaction: Transaction): SuspiciousPattern | null {
    const hour = transaction.timestamp.getHours();
    
    // Flag transactions during unusual hours (2 AM - 6 AM)
    if (hour >= 2 && hour <= 6) {
      return {
        type: 'unusual_timing',
        description: `Transaction at unusual hour: ${hour}:00`,
        severity: 'low',
        confidence: 0.5,
        metadata: {
          hour,
          timestamp: transaction.timestamp
        }
      };
    }

    return null;
  }

  private async detectCrossBorderActivity(transaction: Transaction, user: User): Promise<SuspiciousPattern | null> {
    // This would analyze blockchain addresses and known country mappings
    // For now, return null - this is a placeholder for cross-border detection
    return null;
  }

  private calculateRoundness(amount: number): number {
    // Calculate how "round" a number is (more zeros = higher roundness)
    let roundness = 0;
    let temp = amount;
    
    while (temp > 0 && temp % 10 === 0) {
      roundness++;
      temp = temp / 10;
    }
    
    return roundness;
  }

  private isDifferentDay(date1: Date, date2: Date): boolean {
    return date1.toDateString() !== date2.toDateString();
  }

  private isDifferentWeek(date1: Date, date2: Date): boolean {
    const oneWeek = 7 * 24 * 60 * 60 * 1000;
    return Math.abs(date1.getTime() - date2.getTime()) > oneWeek;
  }

  private isDifferentMonth(date1: Date, date2: Date): boolean {
    return date1.getMonth() !== date2.getMonth() || date1.getFullYear() !== date2.getFullYear();
  }

  private cleanupVelocityMetrics(): void {
    const now = new Date();
    const oneMonth = 30 * 24 * 60 * 60 * 1000;
    
    for (const [userId, metrics] of this.velocityMetrics.entries()) {
      // Remove metrics for users with no activity in the last month
      if (now.getTime() - metrics.lastTransactionTime.getTime() > oneMonth) {
        this.velocityMetrics.delete(userId);
      }
    }
    
    logger.debug(`Cleaned up velocity metrics, active users: ${this.velocityMetrics.size}`);
  }

  // Decentralized transaction monitoring methods

  private isDecentralizedTransaction(transaction: Transaction | DecentralizedTransaction): transaction is DecentralizedTransaction {
    return 'zkProofs' in transaction || 'privacyLevel' in transaction;
  }

  private isDecentralizedUser(user: User | DecentralizedUser): user is DecentralizedUser {
    return 'did' in user;
  }
  
  /**
   * Get related transactions for ML analysis
   */
  private async getRelatedTransactions(userId: string, timestamp: Date): Promise<Transaction[]> {
    // In production, this would query the database for the user's recent transactions
    // For now, return empty array - the ML system will handle this gracefully
    return [];
  }

  /**
   * Screen decentralized transaction with ZK proof verification
   */
  private async screenDecentralizedTransaction(
    transaction: DecentralizedTransaction,
    user: DecentralizedUser
  ): Promise<DecentralizedScreeningResult> {
    try {
      logger.debug('Screening decentralized transaction', {
        transactionId: transaction.id,
        userDID: user.did,
        privacyLevel: transaction.privacyLevel
      });

      const flags: ComplianceFlag[] = [];
      const proofVerifications: ZKProofVerification[] = [];
      let riskScore = 0;

      // Verify ZK proofs if present
      if (transaction.zkProofs) {
        const zkVerificationResult = await this.verifyZKProofs(transaction.zkProofs);
        proofVerifications.push(...zkVerificationResult.verifications);
        
        if (!zkVerificationResult.allValid) {
          flags.push({
            type: 'manual-review',
            severity: 'high',
            description: 'One or more ZK proofs failed verification',
            source: 'decentralized-monitor',
            confidence: 0.95,
            timestamp: new Date(),
            metadata: {
              failedProofs: zkVerificationResult.failedProofs
            }
          });
          riskScore += 50;
        }
      }

      // Check compliance status from decentralized verification
      if (!transaction.complianceStatus.approved) {
        flags.push({
          type: 'suspicious-activity',
          severity: transaction.complianceStatus.riskScore > 75 ? 'high' : 'medium',
          description: 'Decentralized compliance verification failed',
          source: 'decentralized-monitor',
          confidence: 0.9,
          timestamp: new Date(),
          metadata: {
            complianceRiskScore: transaction.complianceStatus.riskScore,
            complianceFlags: transaction.complianceStatus.flags
          }
        });
        riskScore += transaction.complianceStatus.riskScore * 0.5;
      }

      // Privacy-preserving amount verification
      if (transaction.amountCategory === 'very-large') {
        // Even in privacy-preserving mode, we can flag very large transactions
        flags.push({
          type: 'amount-threshold',
          severity: 'medium',
          description: 'Large transaction detected (privacy-preserving)',
          source: 'decentralized-monitor',
          confidence: 0.8,
          timestamp: new Date(),
          metadata: {
            amountCategory: transaction.amountCategory,
            privacyLevel: transaction.privacyLevel
          }
        });
        riskScore += 25;
      }

      // Check user reputation and trust score
      if (user.reputation.overallScore < 500) {
        flags.push({
          type: 'manual-review',
          severity: 'medium',
          description: 'Low user reputation score',
          source: 'decentralized-monitor',
          confidence: 0.7,
          timestamp: new Date(),
          metadata: {
            reputationScore: user.reputation.overallScore,
            trustScore: user.reputation.trustScore
          }
        });
        riskScore += 20;
      }

      // Privacy assessment
      const privacyPreserved = transaction.privacyLevel !== 'none' && 
        transaction.zkProofs && 
        Object.keys(transaction.zkProofs).length > 0;

      const zkProofValid = proofVerifications.length === 0 || 
        proofVerifications.every(v => v.valid);

      const complianceAssured = transaction.complianceStatus.approved && 
        zkProofValid && 
        flags.filter(f => f.severity === 'high' || f.severity === 'critical').length === 0;

      const result: DecentralizedScreeningResult = {
        zkProofValid,
        privacyPreserved,
        complianceAssured,
        riskScore: Math.min(100, riskScore),
        flags,
        proofVerifications
      };

      logger.debug('Decentralized transaction screening completed', {
        transactionId: transaction.id,
        userDID: user.did,
        riskScore: result.riskScore,
        flagsCount: result.flags.length,
        privacyPreserved: result.privacyPreserved
      });

      return result;

    } catch (error) {
      logger.error('Error screening decentralized transaction:', error);
      throw error;
    }
  }

  /**
   * Verify ZK proofs in transaction
   */
  private async verifyZKProofs(zkProofs: any): Promise<{
    allValid: boolean;
    verifications: ZKProofVerification[];
    failedProofs: string[];
  }> {
    const verifications: ZKProofVerification[] = [];
    const failedProofs: string[] = [];

    // Verify amount proof
    if (zkProofs.amountProof) {
      const verification = await this.verifyIndividualZKProof(
        zkProofs.amountProof,
        'amount-compliance'
      );
      verifications.push(verification);
      if (!verification.valid) {
        failedProofs.push('amountProof');
      }
    }

    // Verify compliance proof
    if (zkProofs.complianceProof) {
      const verification = await this.verifyIndividualZKProof(
        zkProofs.complianceProof,
        'kyc-compliance'
      );
      verifications.push(verification);
      if (!verification.valid) {
        failedProofs.push('complianceProof');
      }
    }

    // Verify sanctions proof
    if (zkProofs.sanctionsProof) {
      const verification = await this.verifyIndividualZKProof(
        zkProofs.sanctionsProof,
        'sanctions-screening'
      );
      verifications.push(verification);
      if (!verification.valid) {
        failedProofs.push('sanctionsProof');
      }
    }

    return {
      allValid: failedProofs.length === 0,
      verifications,
      failedProofs
    };
  }

  /**
   * Verify individual ZK proof
   */
  private async verifyIndividualZKProof(
    proof: ZKProof,
    expectedType: string
  ): Promise<ZKProofVerification> {
    try {
      // Mock ZK proof verification - in reality this would:
      // 1. Load the verification key for the circuit
      // 2. Verify the proof cryptographically
      // 3. Check public inputs are valid
      // 4. Ensure proof is recent and not replayed

      const isRecent = proof.verifiedAt > new Date(Date.now() - 24 * 60 * 60 * 1000);
      const hasValidStructure = proof.proof && proof.circuit && proof.publicInputs;
      const typeMatches = proof.type === expectedType;

      const valid = isRecent && hasValidStructure && typeMatches;
      const confidence = valid ? 0.95 : 0.1;

      return {
        proofType: proof.type,
        valid,
        confidence,
        verifiedAt: new Date(),
        circuit: proof.circuit,
        publicInputs: proof.publicInputs || []
      };

    } catch (error) {
      logger.error('Error verifying ZK proof:', error);
      return {
        proofType: expectedType,
        valid: false,
        confidence: 0,
        verifiedAt: new Date(),
        circuit: proof.circuit || 'unknown',
        publicInputs: []
      };
    }
  }

  /**
   * Convert decentralized screening result to AML check format
   */
  private convertDecentralizedToAMLCheck(
    decentralizedResult: DecentralizedScreeningResult,
    transaction: Transaction | DecentralizedTransaction,
    user: User | DecentralizedUser
  ): AMLCheck {
    const riskFactors = decentralizedResult.flags.map(flag => ({
      type: flag.type,
      weight: flag.confidence,
      value: flag.description,
      contribution: flag.severity === 'critical' ? 40 : 
                   flag.severity === 'high' ? 30 : 
                   flag.severity === 'medium' ? 20 : 10,
      description: flag.description
    }));

    const thresholds = [
      {
        name: 'decentralized_privacy_threshold',
        threshold: 50,
        current: decentralizedResult.privacyPreserved ? 25 : 75,
        breached: !decentralizedResult.privacyPreserved,
        action: 'enhanced_monitoring'
      },
      {
        name: 'zk_proof_threshold',
        threshold: 75,
        current: decentralizedResult.zkProofValid ? 25 : 90,
        breached: !decentralizedResult.zkProofValid,
        action: 'manual_review'
      },
      {
        name: 'compliance_assurance_threshold',
        threshold: 80,
        current: decentralizedResult.complianceAssured ? 20 : 100,
        breached: !decentralizedResult.complianceAssured,
        action: 'block_transaction'
      }
    ];

    let recommendation: 'approve' | 'flag' | 'block' | 'manual-review' = 'approve';
    if (!decentralizedResult.complianceAssured) recommendation = 'block';
    else if (!decentralizedResult.zkProofValid) recommendation = 'manual-review';
    else if (decentralizedResult.riskScore > 50) recommendation = 'flag';

    return {
      riskScore: decentralizedResult.riskScore,
      factors: riskFactors,
      thresholds,
      recommendation,
      provider: 'decentralized-engine',
      checkedAt: new Date()
    };
  }
}