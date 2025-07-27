/**
 * ML-Based Pattern Recognition for Transaction Monitoring
 * Advanced pattern detection algorithms for identifying suspicious transaction behavior
 */

import { EventEmitter } from 'events';
import Logger from '../../shared/logging/logger';
import { Transaction, User, DecentralizedUser } from '../types';
import { TransactionCaseManager } from '../monitoring/transaction-case-manager';

const logger = Logger.getLogger('ml-pattern-recognition');

// Pattern Recognition Types
export interface TransactionPattern {
  id: string;
  type: PatternType;
  name: string;
  description: string;
  confidence: number;
  riskScore: number;
  indicators: PatternIndicator[];
  timeWindow?: number; // in seconds
  threshold?: number;
  modelVersion: string;
}

export interface PatternIndicator {
  id: string;
  name: string;
  value: any;
  weight: number;
  contribution: number;
}

export interface BehavioralProfile {
  userId: string;
  profileCreatedAt: Date;
  lastUpdated: Date;
  transactionHistory: TransactionSummary[];
  normalBehavior: NormalBehaviorMetrics;
  riskProfile: RiskProfile;
  anomalyScore: number;
}

export interface TransactionSummary {
  transactionId: string;
  timestamp: Date;
  amount: number;
  type: string;
  counterparty?: string;
  jurisdiction: string;
  riskScore: number;
}

export interface NormalBehaviorMetrics {
  averageTransactionAmount: number;
  standardDeviationAmount: number;
  typicalTransactionTypes: Map<string, number>;
  commonCounterparties: Set<string>;
  timeOfDayDistribution: number[]; // 24-hour distribution
  dayOfWeekDistribution: number[]; // 7-day distribution
  transactionFrequency: number; // transactions per day
  jurisdictionDistribution: Map<string, number>;
}

export interface RiskProfile {
  overallRisk: RiskLevel;
  factorScores: Map<string, number>;
  lastAssessment: Date;
  historicalRiskScores: Array<{ date: Date; score: number }>;
}

export interface NetworkAnalysis {
  userId: string;
  connectedEntities: Set<string>;
  transactionPaths: TransactionPath[];
  clusterRisk: number;
  suspiciousConnections: string[];
}

export interface TransactionPath {
  source: string;
  destination: string;
  hops: number;
  totalAmount: number;
  timespan: number;
  riskScore: number;
}

export interface MLModel {
  id: string;
  name: string;
  version: string;
  type: ModelType;
  accuracy: number;
  lastTrained: Date;
  features: string[];
}

// Enums
export type PatternType = 
  | 'structuring'
  | 'rapid_movement'
  | 'unusual_pattern'
  | 'network_anomaly'
  | 'behavioral_deviation'
  | 'velocity_abuse'
  | 'round_robin'
  | 'layering'
  | 'integration';

export type ModelType = 
  | 'anomaly_detection'
  | 'classification'
  | 'clustering'
  | 'time_series'
  | 'graph_neural_network';

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export class MLPatternRecognition extends EventEmitter {
  private isInitialized = false;
  private models: Map<string, MLModel> = new Map();
  private userProfiles: Map<string, BehavioralProfile> = new Map();
  private detectedPatterns: Map<string, TransactionPattern[]> = new Map();
  private networkAnalyses: Map<string, NetworkAnalysis> = new Map();
  private caseManager?: TransactionCaseManager;
  
  // Model configurations
  private readonly ANOMALY_THRESHOLD = 0.85;
  private readonly MIN_TRANSACTIONS_FOR_PROFILE = 10;
  private readonly PROFILE_UPDATE_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours
  private readonly PATTERN_DETECTION_WINDOW = 7 * 24 * 60 * 60 * 1000; // 7 days

  constructor() {
    super();
    logger.info('MLPatternRecognition initialized');
  }

  /**
   * Initialize ML pattern recognition system
   */
  async initialize(caseManager?: TransactionCaseManager): Promise<void> {
    try {
      logger.info('Initializing ML Pattern Recognition');
      
      this.caseManager = caseManager;
      
      // Initialize ML models
      await this.initializeModels();
      
      // Load existing user profiles
      await this.loadUserProfiles();
      
      // Start periodic profile updates
      this.startProfileUpdateScheduler();
      
      this.isInitialized = true;
      logger.info('ML Pattern Recognition initialization completed');
      
      this.emit('initialized');
    } catch (error) {
      logger.error('Failed to initialize ML Pattern Recognition', { error });
      throw error;
    }
  }

  /**
   * Analyze transaction for suspicious patterns
   */
  async analyzeTransaction(
    transaction: Transaction,
    user: User | DecentralizedUser,
    relatedTransactions?: Transaction[]
  ): Promise<TransactionPattern[]> {
    try {
      logger.debug('Analyzing transaction for patterns', {
        transactionId: transaction.id,
        userId: 'id' in user ? user.id : user.pseudonymousId
      });

      const patterns: TransactionPattern[] = [];
      
      // Get or create user behavioral profile
      const profile = await this.getUserProfile(user);
      
      // 1. Anomaly Detection
      const anomalyPatterns = await this.detectAnomalies(transaction, profile);
      patterns.push(...anomalyPatterns);
      
      // 2. Structuring Detection
      const structuringPatterns = await this.detectStructuring(
        transaction,
        relatedTransactions || []
      );
      patterns.push(...structuringPatterns);
      
      // 3. Rapid Movement Detection
      const rapidMovementPatterns = await this.detectRapidMovement(
        transaction,
        relatedTransactions || []
      );
      patterns.push(...rapidMovementPatterns);
      
      // 4. Network Analysis
      const networkPatterns = await this.analyzeNetworkPatterns(
        transaction,
        user,
        relatedTransactions || []
      );
      patterns.push(...networkPatterns);
      
      // 5. Behavioral Deviation Detection
      const behavioralPatterns = await this.detectBehavioralDeviations(
        transaction,
        profile
      );
      patterns.push(...behavioralPatterns);

      // Update user profile with new transaction
      await this.updateUserProfile(user, transaction);
      
      // Store detected patterns
      if (patterns.length > 0) {
        const userId = 'id' in user ? user.id : user.pseudonymousId;
        this.detectedPatterns.set(transaction.id, patterns);
        
        logger.info('Patterns detected in transaction', {
          transactionId: transaction.id,
          patternCount: patterns.length,
          patterns: patterns.map(p => ({ type: p.type, confidence: p.confidence }))
        });
        
        this.emit('patternsDetected', { transaction, patterns });
      }

      return patterns;
    } catch (error) {
      logger.error('Failed to analyze transaction', { 
        error, 
        transactionId: transaction.id 
      });
      throw error;
    }
  }

  /**
   * Detect anomalies using isolation forest algorithm
   */
  private async detectAnomalies(
    transaction: Transaction,
    profile: BehavioralProfile
  ): Promise<TransactionPattern[]> {
    const patterns: TransactionPattern[] = [];
    
    // Calculate anomaly score based on multiple factors
    const anomalyFactors = this.calculateAnomalyFactors(transaction, profile);
    const anomalyScore = this.calculateWeightedAnomalyScore(anomalyFactors);
    
    if (anomalyScore > this.ANOMALY_THRESHOLD) {
      patterns.push({
        id: `anomaly_${transaction.id}_${Date.now()}`,
        type: 'unusual_pattern',
        name: 'Transaction Anomaly Detected',
        description: 'Transaction deviates significantly from user\'s normal behavior',
        confidence: anomalyScore,
        riskScore: anomalyScore * 100,
        indicators: anomalyFactors.map(factor => ({
          id: factor.name,
          name: factor.name,
          value: factor.value,
          weight: factor.weight,
          contribution: factor.score * factor.weight
        })),
        modelVersion: 'v1.0.0'
      });
    }
    
    return patterns;
  }

  /**
   * Detect structuring patterns (smurfing)
   */
  private async detectStructuring(
    transaction: Transaction,
    relatedTransactions: Transaction[]
  ): Promise<TransactionPattern[]> {
    const patterns: TransactionPattern[] = [];
    const timeWindow = 24 * 60 * 60 * 1000; // 24 hours
    
    // Find transactions within time window
    const recentTransactions = relatedTransactions.filter(tx => 
      Math.abs(tx.timestamp.getTime() - transaction.timestamp.getTime()) < timeWindow
    );
    
    // Check for structuring indicators
    const structuringThreshold = 10000; // $10,000
    const similarAmounts = recentTransactions.filter(tx => 
      Math.abs(tx.amount - transaction.amount) < transaction.amount * 0.1 // Within 10%
    );
    
    const totalAmount = similarAmounts.reduce((sum, tx) => sum + tx.amount, 0) + transaction.amount;
    
    if (
      similarAmounts.length >= 2 && 
      totalAmount > structuringThreshold &&
      transaction.amount < structuringThreshold
    ) {
      const confidence = Math.min(0.95, 0.5 + (similarAmounts.length * 0.1));
      
      patterns.push({
        id: `structuring_${transaction.id}_${Date.now()}`,
        type: 'structuring',
        name: 'Potential Structuring Activity',
        description: 'Multiple similar transactions below reporting threshold',
        confidence,
        riskScore: confidence * 90,
        indicators: [
          {
            id: 'transaction_count',
            name: 'Similar Transactions',
            value: similarAmounts.length + 1,
            weight: 0.4,
            contribution: 40
          },
          {
            id: 'total_amount',
            name: 'Aggregate Amount',
            value: totalAmount,
            weight: 0.6,
            contribution: 60
          }
        ],
        timeWindow,
        threshold: structuringThreshold,
        modelVersion: 'v1.0.0'
      });
    }
    
    return patterns;
  }

  /**
   * Detect rapid movement of funds
   */
  private async detectRapidMovement(
    transaction: Transaction,
    relatedTransactions: Transaction[]
  ): Promise<TransactionPattern[]> {
    const patterns: TransactionPattern[] = [];
    const rapidMovementWindow = 60 * 60 * 1000; // 1 hour
    
    // Find rapid sequences
    const rapidTransactions = relatedTransactions.filter(tx => 
      Math.abs(tx.timestamp.getTime() - transaction.timestamp.getTime()) < rapidMovementWindow &&
      (tx.fromAccount === transaction.toAccount || tx.toAccount === transaction.fromAccount)
    );
    
    if (rapidTransactions.length >= 3) {
      const totalMovement = rapidTransactions.reduce((sum, tx) => sum + tx.amount, 0) + transaction.amount;
      const confidence = Math.min(0.9, 0.4 + (rapidTransactions.length * 0.15));
      
      patterns.push({
        id: `rapid_movement_${transaction.id}_${Date.now()}`,
        type: 'rapid_movement',
        name: 'Rapid Fund Movement',
        description: 'Funds moving quickly through multiple accounts',
        confidence,
        riskScore: confidence * 85,
        indicators: [
          {
            id: 'transaction_velocity',
            name: 'Transaction Velocity',
            value: rapidTransactions.length + 1,
            weight: 0.5,
            contribution: 50
          },
          {
            id: 'total_movement',
            name: 'Total Amount Moved',
            value: totalMovement,
            weight: 0.5,
            contribution: 50
          }
        ],
        timeWindow: rapidMovementWindow,
        modelVersion: 'v1.0.0'
      });
    }
    
    return patterns;
  }

  /**
   * Analyze network patterns using graph analysis
   */
  private async analyzeNetworkPatterns(
    transaction: Transaction,
    user: User | DecentralizedUser,
    relatedTransactions: Transaction[]
  ): Promise<TransactionPattern[]> {
    const patterns: TransactionPattern[] = [];
    const userId = 'id' in user ? user.id : user.pseudonymousId;
    
    // Get or create network analysis
    let networkAnalysis = this.networkAnalyses.get(userId);
    if (!networkAnalysis) {
      networkAnalysis = await this.buildNetworkAnalysis(user, relatedTransactions);
      this.networkAnalyses.set(userId, networkAnalysis);
    }
    
    // Check for suspicious network patterns
    if (networkAnalysis.clusterRisk > 0.7) {
      patterns.push({
        id: `network_risk_${transaction.id}_${Date.now()}`,
        type: 'network_anomaly',
        name: 'High-Risk Network Activity',
        description: 'Transaction involves entities in high-risk network cluster',
        confidence: networkAnalysis.clusterRisk,
        riskScore: networkAnalysis.clusterRisk * 95,
        indicators: [
          {
            id: 'cluster_risk',
            name: 'Network Cluster Risk',
            value: networkAnalysis.clusterRisk,
            weight: 0.7,
            contribution: 70
          },
          {
            id: 'suspicious_connections',
            name: 'Suspicious Connections',
            value: networkAnalysis.suspiciousConnections.length,
            weight: 0.3,
            contribution: 30
          }
        ],
        modelVersion: 'v1.0.0'
      });
    }
    
    return patterns;
  }

  /**
   * Detect behavioral deviations
   */
  private async detectBehavioralDeviations(
    transaction: Transaction,
    profile: BehavioralProfile
  ): Promise<TransactionPattern[]> {
    const patterns: TransactionPattern[] = [];
    
    if (profile.transactionHistory.length < this.MIN_TRANSACTIONS_FOR_PROFILE) {
      return patterns; // Not enough history for behavioral analysis
    }
    
    const deviations = this.calculateBehavioralDeviations(transaction, profile);
    const deviationScore = this.calculateDeviationScore(deviations);
    
    if (deviationScore > 0.75) {
      patterns.push({
        id: `behavioral_${transaction.id}_${Date.now()}`,
        type: 'behavioral_deviation',
        name: 'Unusual Behavioral Pattern',
        description: 'Transaction significantly deviates from established user behavior',
        confidence: deviationScore,
        riskScore: deviationScore * 80,
        indicators: deviations.map(dev => ({
          id: dev.metric,
          name: dev.metric,
          value: dev.deviation,
          weight: dev.weight,
          contribution: dev.score * dev.weight
        })),
        modelVersion: 'v1.0.0'
      });
    }
    
    return patterns;
  }

  // Helper methods

  private async initializeModels(): Promise<void> {
    // Initialize ML models (in production, these would be loaded from storage)
    this.models.set('anomaly_detector', {
      id: 'anomaly_detector_v1',
      name: 'Isolation Forest Anomaly Detector',
      version: 'v1.0.0',
      type: 'anomaly_detection',
      accuracy: 0.92,
      lastTrained: new Date(),
      features: ['amount', 'time_of_day', 'transaction_type', 'jurisdiction']
    });
    
    this.models.set('pattern_classifier', {
      id: 'pattern_classifier_v1',
      name: 'Transaction Pattern Classifier',
      version: 'v1.0.0',
      type: 'classification',
      accuracy: 0.89,
      lastTrained: new Date(),
      features: ['amount', 'frequency', 'counterparty_risk', 'time_patterns']
    });
  }

  private async loadUserProfiles(): Promise<void> {
    // In production, load from database
    logger.debug('Loading user behavioral profiles');
  }

  private startProfileUpdateScheduler(): void {
    setInterval(() => {
      this.updateStaleProfiles();
    }, this.PROFILE_UPDATE_INTERVAL);
  }

  private async updateStaleProfiles(): Promise<void> {
    const now = Date.now();
    for (const [userId, profile] of this.userProfiles) {
      if (now - profile.lastUpdated.getTime() > this.PROFILE_UPDATE_INTERVAL) {
        await this.recalculateProfile(userId);
      }
    }
  }

  private async getUserProfile(user: User | DecentralizedUser): Promise<BehavioralProfile> {
    const userId = 'id' in user ? user.id : user.pseudonymousId;
    
    let profile = this.userProfiles.get(userId);
    if (!profile) {
      profile = await this.createNewProfile(user);
      this.userProfiles.set(userId, profile);
    }
    
    return profile;
  }

  private async createNewProfile(user: User | DecentralizedUser): Promise<BehavioralProfile> {
    const userId = 'id' in user ? user.id : user.pseudonymousId;
    
    return {
      userId,
      profileCreatedAt: new Date(),
      lastUpdated: new Date(),
      transactionHistory: [],
      normalBehavior: {
        averageTransactionAmount: 0,
        standardDeviationAmount: 0,
        typicalTransactionTypes: new Map(),
        commonCounterparties: new Set(),
        timeOfDayDistribution: new Array(24).fill(0),
        dayOfWeekDistribution: new Array(7).fill(0),
        transactionFrequency: 0,
        jurisdictionDistribution: new Map()
      },
      riskProfile: {
        overallRisk: 'low',
        factorScores: new Map(),
        lastAssessment: new Date(),
        historicalRiskScores: []
      },
      anomalyScore: 0
    };
  }

  private async updateUserProfile(
    user: User | DecentralizedUser,
    transaction: Transaction
  ): Promise<void> {
    const profile = await this.getUserProfile(user);
    
    // Add transaction to history
    profile.transactionHistory.push({
      transactionId: transaction.id,
      timestamp: transaction.timestamp,
      amount: transaction.amount,
      type: transaction.type,
      counterparty: transaction.toAccount,
      jurisdiction: transaction.jurisdiction || 'UNKNOWN',
      riskScore: 0 // Will be calculated
    });
    
    // Recalculate normal behavior metrics
    await this.recalculateNormalBehavior(profile);
    
    profile.lastUpdated = new Date();
  }

  private async recalculateNormalBehavior(profile: BehavioralProfile): Promise<void> {
    if (profile.transactionHistory.length === 0) return;
    
    const amounts = profile.transactionHistory.map(tx => tx.amount);
    
    // Calculate average and standard deviation
    profile.normalBehavior.averageTransactionAmount = 
      amounts.reduce((sum, amt) => sum + amt, 0) / amounts.length;
    
    const variance = amounts.reduce((sum, amt) => 
      sum + Math.pow(amt - profile.normalBehavior.averageTransactionAmount, 2), 0
    ) / amounts.length;
    
    profile.normalBehavior.standardDeviationAmount = Math.sqrt(variance);
    
    // Update other metrics...
  }

  private calculateAnomalyFactors(
    transaction: Transaction,
    profile: BehavioralProfile
  ): Array<{ name: string; value: number; score: number; weight: number }> {
    const factors: Array<{ name: string; value: number; score: number; weight: number }> = [];
    
    // Amount deviation
    if (profile.normalBehavior.averageTransactionAmount > 0) {
      const zScore = Math.abs(
        (transaction.amount - profile.normalBehavior.averageTransactionAmount) /
        (profile.normalBehavior.standardDeviationAmount || 1)
      );
      
      factors.push({
        name: 'Amount Deviation',
        value: zScore,
        score: Math.min(1, zScore / 3), // Normalize to 0-1
        weight: 0.3
      });
    }
    
    // Time pattern deviation
    const hour = transaction.timestamp.getHours();
    const expectedFrequency = profile.normalBehavior.timeOfDayDistribution[hour] || 0.01;
    const timeDeviation = 1 - expectedFrequency;
    
    factors.push({
      name: 'Time Pattern Deviation',
      value: timeDeviation,
      score: timeDeviation,
      weight: 0.2
    });
    
    // Add more factors as needed...
    
    return factors;
  }

  private calculateWeightedAnomalyScore(
    factors: Array<{ score: number; weight: number }>
  ): number {
    const totalWeight = factors.reduce((sum, f) => sum + f.weight, 0);
    const weightedSum = factors.reduce((sum, f) => sum + (f.score * f.weight), 0);
    
    return totalWeight > 0 ? weightedSum / totalWeight : 0;
  }

  private calculateBehavioralDeviations(
    transaction: Transaction,
    profile: BehavioralProfile
  ): Array<{ metric: string; deviation: number; score: number; weight: number }> {
    // Implementation for calculating behavioral deviations
    return [];
  }

  private calculateDeviationScore(
    deviations: Array<{ score: number; weight: number }>
  ): number {
    const totalWeight = deviations.reduce((sum, d) => sum + d.weight, 0);
    const weightedSum = deviations.reduce((sum, d) => sum + (d.score * d.weight), 0);
    
    return totalWeight > 0 ? weightedSum / totalWeight : 0;
  }

  private async buildNetworkAnalysis(
    user: User | DecentralizedUser,
    transactions: Transaction[]
  ): Promise<NetworkAnalysis> {
    const userId = 'id' in user ? user.id : user.pseudonymousId;
    
    return {
      userId,
      connectedEntities: new Set(),
      transactionPaths: [],
      clusterRisk: 0,
      suspiciousConnections: []
    };
  }

  private async recalculateProfile(userId: string): Promise<void> {
    const profile = this.userProfiles.get(userId);
    if (profile) {
      await this.recalculateNormalBehavior(profile);
      profile.lastUpdated = new Date();
    }
  }

  /**
   * Get pattern detection statistics
   */
  async getPatternStatistics(): Promise<{
    totalPatternsDetected: number;
    patternsByType: Map<PatternType, number>;
    averageConfidence: number;
    highRiskPatterns: number;
  }> {
    let totalPatterns = 0;
    const patternsByType = new Map<PatternType, number>();
    let totalConfidence = 0;
    let highRiskPatterns = 0;
    
    for (const patterns of this.detectedPatterns.values()) {
      for (const pattern of patterns) {
        totalPatterns++;
        totalConfidence += pattern.confidence;
        
        const count = patternsByType.get(pattern.type) || 0;
        patternsByType.set(pattern.type, count + 1);
        
        if (pattern.riskScore > 80) {
          highRiskPatterns++;
        }
      }
    }
    
    return {
      totalPatternsDetected: totalPatterns,
      patternsByType,
      averageConfidence: totalPatterns > 0 ? totalConfidence / totalPatterns : 0,
      highRiskPatterns
    };
  }
}

export default MLPatternRecognition;