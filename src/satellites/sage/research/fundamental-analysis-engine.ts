/**
 * Fundamental Analysis Engine
 * Real-time analysis of protocol fundamentals with custom ML models
 */

import * as tf from '@tensorflow/tfjs-node';
import { EventEmitter } from 'events';
import { 
  ProtocolData, 
  ProtocolAnalysis, 
  RiskAssessment, 
  TVLHealthAnalysis,
  TeamAssessment,
  SecurityAssessment,
  GovernanceAssessment,
  RevenueAnalysis,
  Recommendation,
  MLModelConfig,
  ModelPerformance,
  ModelPrediction,
  FeatureImportance
} from '../types';
import Logger from '@/shared/logging/logger';

const logger = Logger.getLogger('fundamental-analysis-engine');

/**
 * Fundamental Analysis Engine Configuration
 */
export interface FundamentalAnalysisConfig {
  enableRealTimeAnalysis: boolean;
  analysisInterval: number; // milliseconds
  confidenceThreshold: number;
  enableMLModels: boolean;
  modelUpdateInterval: number; // milliseconds
  maxConcurrentAnalyses: number;
  cacheResults: boolean;
  cacheTTL: number; // milliseconds
}

export const DEFAULT_FUNDAMENTAL_ANALYSIS_CONFIG: FundamentalAnalysisConfig = {
  enableRealTimeAnalysis: true,
  analysisInterval: 300000, // 5 minutes
  confidenceThreshold: 0.7,
  enableMLModels: true,
  modelUpdateInterval: 86400000, // 24 hours
  maxConcurrentAnalyses: 10,
  cacheResults: true,
  cacheTTL: 300000, // 5 minutes
};

/**
 * ML Model Manager for Protocol Analysis
 */
class ProtocolAnalysisModel {
  private model: tf.LayersModel | null = null;
  private config: MLModelConfig;
  private performance: ModelPerformance | null = null;
  private isTraining: boolean = false;

  constructor(config: MLModelConfig) {
    this.config = config;
  }

  async initialize(): Promise<void> {
    try {
      logger.info('Initializing protocol analysis ML model...');
      
      // Create a simple neural network for protocol scoring
      this.model = tf.sequential({
        layers: [
          tf.layers.dense({
            units: 64,
            activation: 'relu',
            inputShape: [this.config.features.length]
          }),
          tf.layers.dropout({ rate: 0.2 }),
          tf.layers.dense({
            units: 32,
            activation: 'relu'
          }),
          tf.layers.dropout({ rate: 0.2 }),
          tf.layers.dense({
            units: 16,
            activation: 'relu'
          }),
          tf.layers.dense({
            units: 1,
            activation: 'sigmoid'
          })
        ]
      });

      this.model.compile({
        optimizer: tf.train.adam(this.config.trainingConfig.learningRate),
        loss: 'binaryCrossentropy',
        metrics: ['accuracy', 'precision', 'recall']
      });

      logger.info('Protocol analysis ML model initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize ML model:', error);
      throw error;
    }
  }

  async train(trainingData: any[], labels: any[]): Promise<ModelPerformance> {
    if (!this.model) {
      throw new Error('Model not initialized');
    }

    try {
      this.isTraining = true;
      logger.info('Starting model training...');

      const xs = tf.tensor2d(trainingData);
      const ys = tf.tensor2d(labels, [labels.length, 1]);

      const history = await this.model.fit(xs, ys, {
        epochs: this.config.trainingConfig.epochs,
        batchSize: this.config.trainingConfig.batchSize,
        validationSplit: this.config.trainingConfig.validationSplit,
        callbacks: [
          tf.callbacks.earlyStopping({
            monitor: 'val_loss',
            patience: 10
          })
        ]
      });

      // Calculate performance metrics
      const predictions = this.model.predict(xs) as tf.Tensor;
      const predictedValues = await predictions.array();
      const actualValues = await ys.array();

      this.performance = this.calculatePerformanceMetrics(predictedValues, actualValues);

      // Clean up tensors
      xs.dispose();
      ys.dispose();
      predictions.dispose();

      logger.info('Model training completed', { performance: this.performance });
      return this.performance;
    } catch (error) {
      logger.error('Model training failed:', error);
      throw error;
    } finally {
      this.isTraining = false;
    }
  }

  async predict(features: number[]): Promise<ModelPrediction> {
    if (!this.model) {
      throw new Error('Model not initialized');
    }

    try {
      const input = tf.tensor2d([features]);
      const prediction = this.model.predict(input) as tf.Tensor;
      const output = await prediction.array();

      // Calculate feature importance (simplified)
      const featureImportance = this.calculateFeatureImportance(features);

      const result: ModelPrediction = {
        input: this.featuresToObject(features),
        output: output[0][0],
        confidence: this.calculateConfidence(output[0][0]),
        features: featureImportance,
        timestamp: new Date()
      };

      // Clean up tensors
      input.dispose();
      prediction.dispose();

      return result;
    } catch (error) {
      logger.error('Model prediction failed:', error);
      throw error;
    }
  }

  private calculatePerformanceMetrics(predictions: number[][], actuals: number[][]): ModelPerformance {
    let tp = 0, fp = 0, tn = 0, fn = 0;
    let mse = 0, mae = 0;

    for (let i = 0; i < predictions.length; i++) {
      const pred = predictions[i][0] > 0.5 ? 1 : 0;
      const actual = actuals[i][0];

      if (pred === 1 && actual === 1) tp++;
      else if (pred === 1 && actual === 0) fp++;
      else if (pred === 0 && actual === 0) tn++;
      else if (pred === 0 && actual === 1) fn++;

      mse += Math.pow(predictions[i][0] - actual, 2);
      mae += Math.abs(predictions[i][0] - actual);
    }

    const accuracy = (tp + tn) / (tp + tn + fp + fn);
    const precision = tp / (tp + fp) || 0;
    const recall = tp / (tp + fn) || 0;
    const f1Score = 2 * (precision * recall) / (precision + recall) || 0;

    return {
      accuracy,
      precision,
      recall,
      f1Score,
      auc: 0, // Would need more complex calculation
      mse: mse / predictions.length,
      mae: mae / predictions.length
    };
  }

  private calculateFeatureImportance(features: number[]): FeatureImportance[] {
    return features.map((value, index) => ({
      feature: this.config.features[index] || `feature_${index}`,
      importance: Math.abs(value),
      direction: value > 0 ? 'positive' : value < 0 ? 'negative' : 'neutral'
    })).sort((a, b) => b.importance - a.importance);
  }

  private calculateConfidence(output: number): number {
    // Simple confidence calculation based on distance from decision boundary
    return Math.abs(output - 0.5) * 2;
  }

  private featuresToObject(features: number[]): Record<string, any> {
    const result: Record<string, any> = {};
    features.forEach((value, index) => {
      result[this.config.features[index] || `feature_${index}`] = value;
    });
    return result;
  }

  getPerformance(): ModelPerformance | null {
    return this.performance;
  }

  isTraining(): boolean {
    return this.isTraining;
  }
}

/**
 * Main Fundamental Analysis Engine
 */
export class FundamentalAnalysisEngine extends EventEmitter {
  private static instance: FundamentalAnalysisEngine;
  private config: FundamentalAnalysisConfig;
  private mlModel: ProtocolAnalysisModel;
  private analysisCache: Map<string, { analysis: ProtocolAnalysis; timestamp: Date }> = new Map();
  private isRunning: boolean = false;
  private analysisInterval?: NodeJS.Timeout;
  private modelUpdateInterval?: NodeJS.Timeout;

  private constructor(config: FundamentalAnalysisConfig = DEFAULT_FUNDAMENTAL_ANALYSIS_CONFIG) {
    super();
    this.config = config;
    
    // Initialize ML model
    this.mlModel = new ProtocolAnalysisModel({
      modelType: 'regression',
      features: [
        'tvl', 'tvl_change_24h', 'tvl_change_7d', 'tvl_change_30d',
        'revenue_daily', 'revenue_weekly', 'revenue_monthly',
        'active_users', 'user_growth', 'retention_rate',
        'audit_score', 'insurance_coverage', 'vulnerability_count',
        'decentralization_score', 'voter_participation',
        'team_size', 'team_experience', 'transparency'
      ],
      target: 'overall_score',
      hyperparameters: {
        learningRate: 0.001,
        dropoutRate: 0.2
      },
      trainingConfig: {
        epochs: 100,
        batchSize: 32,
        learningRate: 0.001,
        validationSplit: 0.2,
        earlyStopping: true,
        callbacks: ['earlyStopping']
      }
    });
  }

  static getInstance(config?: FundamentalAnalysisConfig): FundamentalAnalysisEngine {
    if (!FundamentalAnalysisEngine.instance) {
      FundamentalAnalysisEngine.instance = new FundamentalAnalysisEngine(config);
    }
    return FundamentalAnalysisEngine.instance;
  }

  async initialize(): Promise<void> {
    try {
      logger.info('Initializing Fundamental Analysis Engine...');
      
      // Initialize ML model
      if (this.config.enableMLModels) {
        await this.mlModel.initialize();
      }

      // Start real-time analysis if enabled
      if (this.config.enableRealTimeAnalysis) {
        this.startRealTimeAnalysis();
      }

      // Start model updates if enabled
      if (this.config.enableMLModels) {
        this.startModelUpdates();
      }

      logger.info('Fundamental Analysis Engine initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Fundamental Analysis Engine:', error);
      throw error;
    }
  }

  async analyzeProtocol(protocolData: ProtocolData): Promise<ProtocolAnalysis> {
    try {
      // Check cache first
      const cached = this.analysisCache.get(protocolData.id);
      if (cached && Date.now() - cached.timestamp.getTime() < this.config.cacheTTL) {
        logger.debug('Returning cached analysis for protocol', { protocolId: protocolData.id });
        return cached.analysis;
      }

      logger.info('Starting protocol analysis', { protocolId: protocolData.id });

      // Extract features for ML model
      const features = this.extractFeatures(protocolData);

      // Get ML prediction if enabled
      let mlScore = 0.5; // Default neutral score
      if (this.config.enableMLModels && !this.mlModel.isTraining()) {
        try {
          const prediction = await this.mlModel.predict(features);
          mlScore = prediction.output;
        } catch (error) {
          logger.warn('ML prediction failed, using default score', { error });
        }
      }

      // Perform comprehensive analysis
      const analysis: ProtocolAnalysis = {
        protocolId: protocolData.id,
        timestamp: new Date(),
        overallScore: this.calculateOverallScore(protocolData, mlScore),
        riskAssessment: this.assessRisk(protocolData),
        tvlHealth: this.analyzeTVLHealth(protocolData),
        teamAssessment: this.assessTeam(protocolData),
        securityAssessment: this.assessSecurity(protocolData),
        governanceAssessment: this.assessGovernance(protocolData),
        revenueAnalysis: this.analyzeRevenue(protocolData),
        recommendations: this.generateRecommendations(protocolData, mlScore),
        confidence: this.calculateConfidence(protocolData, mlScore)
      };

      // Cache the result
      if (this.config.cacheResults) {
        this.analysisCache.set(protocolData.id, {
          analysis,
          timestamp: new Date()
        });
      }

      // Emit analysis completed event
      this.emit('analysis_completed', {
        protocolId: protocolData.id,
        analysis,
        timestamp: new Date()
      });

      logger.info('Protocol analysis completed', { 
        protocolId: protocolData.id, 
        overallScore: analysis.overallScore 
      });

      return analysis;
    } catch (error) {
      logger.error('Protocol analysis failed', { 
        protocolId: protocolData.id, 
        error 
      });
      throw error;
    }
  }

  private extractFeatures(protocolData: ProtocolData): number[] {
    const latestTVL = protocolData.tvlHistory[protocolData.tvlHistory.length - 1];
    const previousTVL = protocolData.tvlHistory[protocolData.tvlHistory.length - 2];

    return [
      protocolData.tvl,
      latestTVL?.change24h || 0,
      latestTVL?.change7d || 0,
      latestTVL?.change30d || 0,
      protocolData.revenue.daily,
      protocolData.revenue.weekly,
      protocolData.revenue.monthly,
      protocolData.userMetrics.activeUsers,
      protocolData.userMetrics.userGrowth,
      protocolData.userMetrics.retentionRate,
      protocolData.securityMetrics.auditScore,
      protocolData.securityMetrics.insuranceCoverage,
      protocolData.securityMetrics.vulnerabilityCount,
      protocolData.governanceMetrics.decentralizationScore,
      protocolData.governanceMetrics.voterParticipation,
      protocolData.teamInfo.size,
      protocolData.teamInfo.experience,
      protocolData.teamInfo.transparency
    ];
  }

  private calculateOverallScore(protocolData: ProtocolData, mlScore: number): number {
    // Weighted combination of different factors
    const weights = {
      tvl: 0.2,
      revenue: 0.15,
      security: 0.2,
      team: 0.15,
      governance: 0.1,
      userMetrics: 0.1,
      mlScore: 0.1
    };

    const tvlScore = this.normalizeTVL(protocolData.tvl);
    const revenueScore = this.normalizeRevenue(protocolData.revenue);
    const securityScore = protocolData.securityMetrics.auditScore / 100;
    const teamScore = this.calculateTeamScore(protocolData.teamInfo);
    const governanceScore = protocolData.governanceMetrics.decentralizationScore / 100;
    const userScore = this.calculateUserScore(protocolData.userMetrics);

    return (
      tvlScore * weights.tvl +
      revenueScore * weights.revenue +
      securityScore * weights.security +
      teamScore * weights.team +
      governanceScore * weights.governance +
      userScore * weights.userMetrics +
      mlScore * weights.mlScore
    );
  }

  private normalizeTVL(tvl: number): number {
    // Simple normalization - could be more sophisticated
    if (tvl < 1000000) return 0.1;
    if (tvl < 10000000) return 0.3;
    if (tvl < 100000000) return 0.6;
    if (tvl < 1000000000) return 0.8;
    return 1.0;
  }

  private normalizeRevenue(revenue: any): number {
    const annualized = revenue.annualized;
    if (annualized < 100000) return 0.1;
    if (annualized < 1000000) return 0.3;
    if (annualized < 10000000) return 0.6;
    if (annualized < 100000000) return 0.8;
    return 1.0;
  }

  private calculateTeamScore(teamInfo: any): number {
    const experienceScore = Math.min(teamInfo.experience / 10, 1);
    const transparencyScore = teamInfo.transparency / 100;
    const githubScore = Math.min(teamInfo.githubActivity / 100, 1);
    
    return (experienceScore + transparencyScore + githubScore) / 3;
  }

  private calculateUserScore(userMetrics: any): number {
    const growthScore = Math.min(userMetrics.userGrowth / 100, 1);
    const retentionScore = userMetrics.retentionRate / 100;
    
    return (growthScore + retentionScore) / 2;
  }

  private assessRisk(protocolData: ProtocolData): RiskAssessment {
    const riskFactors: any[] = [];
    let riskScore = 0;

    // TVL volatility risk
    const tvlVolatility = this.calculateTVLVolatility(protocolData.tvlHistory);
    if (tvlVolatility > 0.3) {
      riskFactors.push({
        category: 'TVL Volatility',
        description: 'High TVL volatility indicates instability',
        impact: 'high',
        probability: tvlVolatility,
        mitigation: 'Monitor closely and consider reducing exposure'
      });
      riskScore += tvlVolatility * 0.3;
    }

    // Security risk
    if (protocolData.securityMetrics.auditScore < 70) {
      riskFactors.push({
        category: 'Security',
        description: 'Low audit score indicates potential security risks',
        impact: 'critical',
        probability: 0.8,
        mitigation: 'Wait for improved audit scores before investing'
      });
      riskScore += 0.4;
    }

    // Team risk
    if (protocolData.teamInfo.transparency < 50) {
      riskFactors.push({
        category: 'Team Transparency',
        description: 'Low team transparency increases risk',
        impact: 'medium',
        probability: 0.6,
        mitigation: 'Request more transparency from team'
      });
      riskScore += 0.2;
    }

    return {
      overallRisk: riskScore > 0.7 ? 'critical' : riskScore > 0.5 ? 'high' : riskScore > 0.3 ? 'medium' : 'low',
      riskScore,
      riskFactors,
      volatilityScore: tvlVolatility,
      liquidityRisk: this.calculateLiquidityRisk(protocolData),
      smartContractRisk: 1 - (protocolData.securityMetrics.auditScore / 100),
      regulatoryRisk: 0.3 // Placeholder - would need regulatory analysis
    };
  }

  private calculateTVLVolatility(tvlHistory: any[]): number {
    if (tvlHistory.length < 2) return 0;
    
    const returns = [];
    for (let i = 1; i < tvlHistory.length; i++) {
      const return_ = (tvlHistory[i].value - tvlHistory[i-1].value) / tvlHistory[i-1].value;
      returns.push(return_);
    }
    
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / returns.length;
    return Math.sqrt(variance);
  }

  private calculateLiquidityRisk(protocolData: ProtocolData): number {
    // Simplified liquidity risk calculation
    const tvl = protocolData.tvl;
    if (tvl < 1000000) return 0.9;
    if (tvl < 10000000) return 0.7;
    if (tvl < 100000000) return 0.5;
    if (tvl < 1000000000) return 0.3;
    return 0.1;
  }

  private analyzeTVLHealth(protocolData: ProtocolData): TVLHealthAnalysis {
    const history = protocolData.tvlHistory;
    const latest = history[history.length - 1];
    const previous = history[history.length - 2];

    let trend: 'increasing' | 'decreasing' | 'stable' = 'stable';
    if (latest && previous) {
      if (latest.value > previous.value * 1.05) trend = 'increasing';
      else if (latest.value < previous.value * 0.95) trend = 'decreasing';
    }

    const volatility = this.calculateTVLVolatility(history);
    const growthRate = latest?.change30d || 0;
    const sustainability = this.calculateTVLSustainability(history);

    return {
      trend,
      healthScore: this.calculateTVLHealthScore(protocolData),
      volatility,
      sustainability,
      growthRate,
      marketShare: 0.1 // Placeholder - would need market data
    };
  }

  private calculateTVLHealthScore(protocolData: ProtocolData): number {
    const tvl = protocolData.tvl;
    const growth = protocolData.tvlHistory[protocolData.tvlHistory.length - 1]?.change30d || 0;
    const volatility = this.calculateTVLVolatility(protocolData.tvlHistory);

    let score = 0.5; // Base score

    // TVL size bonus
    if (tvl > 1000000000) score += 0.2;
    else if (tvl > 100000000) score += 0.1;

    // Growth bonus
    if (growth > 0.1) score += 0.2;
    else if (growth > 0) score += 0.1;

    // Volatility penalty
    score -= volatility * 0.3;

    return Math.max(0, Math.min(1, score));
  }

  private calculateTVLSustainability(history: any[]): number {
    if (history.length < 30) return 0.5; // Not enough data

    const recent = history.slice(-30);
    const older = history.slice(-60, -30);

    const recentAvg = recent.reduce((sum, h) => sum + h.value, 0) / recent.length;
    const olderAvg = older.reduce((sum, h) => sum + h.value, 0) / older.length;

    if (recentAvg > olderAvg * 1.1) return 0.8; // Growing
    if (recentAvg > olderAvg * 0.9) return 0.6; // Stable
    return 0.3; // Declining
  }

  private assessTeam(protocolData: ProtocolData): TeamAssessment {
    const teamInfo = protocolData.teamInfo;
    const redFlags: string[] = [];

    if (teamInfo.transparency < 30) {
      redFlags.push('Very low team transparency');
    }
    if (teamInfo.experience < 3) {
      redFlags.push('Team has limited experience');
    }
    if (teamInfo.githubActivity < 10) {
      redFlags.push('Low GitHub activity');
    }

    return {
      overallScore: this.calculateTeamScore(teamInfo),
      experience: teamInfo.experience,
      transparency: teamInfo.transparency,
      credibility: this.calculateTeamCredibility(teamInfo),
      githubActivity: teamInfo.githubActivity,
      socialPresence: teamInfo.socialPresence,
      redFlags
    };
  }

  private calculateTeamCredibility(teamInfo: any): number {
    let credibility = 0.5; // Base credibility

    // Experience bonus
    credibility += Math.min(teamInfo.experience / 10, 0.2);

    // Transparency bonus
    credibility += (teamInfo.transparency / 100) * 0.2;

    // GitHub activity bonus
    credibility += Math.min(teamInfo.githubActivity / 100, 0.1);

    return Math.min(1, credibility);
  }

  private assessSecurity(protocolData: ProtocolData): SecurityAssessment {
    const securityMetrics = protocolData.securityMetrics;
    const recentIncidents: any[] = [];

    return {
      overallScore: securityMetrics.auditScore / 100,
      auditQuality: securityMetrics.auditScore / 100,
      bugBountyProgram: securityMetrics.bugBountyProgram ? 1 : 0,
      insuranceCoverage: securityMetrics.insuranceCoverage / 100,
      vulnerabilityRisk: 1 - (securityMetrics.auditScore / 100),
      recentIncidents
    };
  }

  private assessGovernance(protocolData: ProtocolData): GovernanceAssessment {
    const governanceMetrics = protocolData.governanceMetrics;

    return {
      decentralizationScore: governanceMetrics.decentralizationScore / 100,
      voterParticipation: governanceMetrics.voterParticipation / 100,
      proposalQuality: 0.7, // Placeholder - would need proposal analysis
      transparency: 0.6, // Placeholder - would need transparency analysis
      communityEngagement: 0.5 // Placeholder - would need community analysis
    };
  }

  private analyzeRevenue(protocolData: ProtocolData): RevenueAnalysis {
    const revenue = protocolData.revenue;
    const sources = revenue.sources;

    const sustainability = this.calculateRevenueSustainability(revenue);
    const growthRate = this.calculateRevenueGrowth(revenue);
    const diversification = this.calculateRevenueDiversification(sources);

    return {
      sustainability,
      growthRate,
      diversification,
      profitability: 0.7, // Placeholder - would need cost analysis
      revenueQuality: this.calculateRevenueQuality(revenue)
    };
  }

  private calculateRevenueSustainability(revenue: any): number {
    const monthly = revenue.monthly;
    const annualized = revenue.annualized;

    if (annualized < 100000) return 0.2;
    if (annualized < 1000000) return 0.4;
    if (annualized < 10000000) return 0.6;
    if (annualized < 100000000) return 0.8;
    return 1.0;
  }

  private calculateRevenueGrowth(revenue: any): number {
    // Placeholder - would need historical revenue data
    return 0.1;
  }

  private calculateRevenueDiversification(sources: any[]): number {
    if (sources.length === 0) return 0;
    if (sources.length === 1) return 0.2;
    if (sources.length === 2) return 0.5;
    if (sources.length === 3) return 0.7;
    return 1.0;
  }

  private calculateRevenueQuality(revenue: any): number {
    // Placeholder - would need more sophisticated analysis
    return 0.7;
  }

  private generateRecommendations(protocolData: ProtocolData, mlScore: number): Recommendation[] {
    const recommendations: Recommendation[] = [];
    const overallScore = this.calculateOverallScore(protocolData, mlScore);

    // Overall recommendation
    if (overallScore > 0.8) {
      recommendations.push({
        type: 'buy',
        confidence: overallScore,
        reasoning: 'Strong fundamentals across all metrics',
        timeframe: 'long',
        riskLevel: 'low'
      });
    } else if (overallScore > 0.6) {
      recommendations.push({
        type: 'hold',
        confidence: overallScore,
        reasoning: 'Good fundamentals with some areas for improvement',
        timeframe: 'medium',
        riskLevel: 'medium'
      });
    } else if (overallScore > 0.4) {
      recommendations.push({
        type: 'monitor',
        confidence: overallScore,
        reasoning: 'Mixed fundamentals, monitor for improvements',
        timeframe: 'short',
        riskLevel: 'high'
      });
    } else {
      recommendations.push({
        type: 'sell',
        confidence: overallScore,
        reasoning: 'Weak fundamentals across multiple metrics',
        timeframe: 'short',
        riskLevel: 'high'
      });
    }

    // Specific recommendations based on risk factors
    const riskAssessment = this.assessRisk(protocolData);
    if (riskAssessment.overallRisk === 'critical') {
      recommendations.push({
        type: 'sell',
        confidence: 0.9,
        reasoning: 'Critical risk factors detected',
        timeframe: 'short',
        riskLevel: 'high'
      });
    }

    return recommendations;
  }

  private calculateConfidence(protocolData: ProtocolData, mlScore: number): number {
    // Calculate confidence based on data quality and model performance
    let confidence = 0.5; // Base confidence

    // Data completeness bonus
    const dataCompleteness = this.calculateDataCompleteness(protocolData);
    confidence += dataCompleteness * 0.3;

    // Model confidence bonus
    if (this.mlModel.getPerformance()) {
      const performance = this.mlModel.getPerformance()!;
      confidence += performance.accuracy * 0.2;
    }

    return Math.min(1, confidence);
  }

  private calculateDataCompleteness(protocolData: ProtocolData): number {
    let completeness = 0;
    let totalFields = 0;

    // Check required fields
    const fields = [
      protocolData.tvl,
      protocolData.revenue.daily,
      protocolData.userMetrics.activeUsers,
      protocolData.securityMetrics.auditScore,
      protocolData.teamInfo.size
    ];

    fields.forEach(field => {
      totalFields++;
      if (field !== undefined && field !== null) completeness++;
    });

    return completeness / totalFields;
  }

  private startRealTimeAnalysis(): void {
    this.analysisInterval = setInterval(() => {
      // This would trigger analysis for protocols that need updates
      logger.debug('Real-time analysis cycle completed');
    }, this.config.analysisInterval);
  }

  private startModelUpdates(): void {
    this.modelUpdateInterval = setInterval(async () => {
      try {
        logger.info('Starting scheduled model update...');
        // This would retrain the model with new data
        // For now, just log the event
        logger.info('Model update cycle completed');
      } catch (error) {
        logger.error('Model update failed:', error);
      }
    }, this.config.modelUpdateInterval);
  }

  async shutdown(): Promise<void> {
    logger.info('Shutting down Fundamental Analysis Engine...');
    
    this.isRunning = false;
    
    if (this.analysisInterval) {
      clearInterval(this.analysisInterval);
    }
    
    if (this.modelUpdateInterval) {
      clearInterval(this.modelUpdateInterval);
    }
    
    // Clear cache
    this.analysisCache.clear();
    
    logger.info('Fundamental Analysis Engine shutdown complete');
  }

  getStatus(): any {
    return {
      isRunning: this.isRunning,
      cacheSize: this.analysisCache.size,
      mlModelPerformance: this.mlModel.getPerformance(),
      isTraining: this.mlModel.isTraining()
    };
  }
} 