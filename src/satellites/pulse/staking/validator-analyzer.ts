/**
 * Validator Analyzer
 * Advanced analytics and scoring for liquid staking validators
 */

import { EventEmitter } from 'events';
import { Logger } from 'winston';
import { createLogger, format, transports } from 'winston';
import { ValidatorInfo, LiquidStakingPosition, StakingOptimizationRequest } from '../types';
import { getUnifiedAIClient } from '../../../integrations/ai/unified-ai-client';

export interface ValidatorAnalyzerConfig {
  enableAIAnalysis: boolean;
  historicalDataWindow: number; // Days
  performanceThreshold: number; // Minimum acceptable performance
  maxSlashingTolerance: number; // Maximum acceptable slashing risk
  diversificationWeight: number; // Weight for diversification scoring
  enablePredictiveAnalysis: boolean;
}

export interface ValidatorAnalysis {
  validator: ValidatorInfo;
  scores: ValidatorScores;
  metrics: ValidatorMetrics;
  risks: ValidatorRisks;
  predictions: ValidatorPredictions;
  recommendations: ValidatorRecommendation[];
  rank: number;
  confidence: number;
}

export interface ValidatorScores {
  overall: number; // 0-1 composite score
  performance: number; // Historical performance score
  reliability: number; // Uptime and consistency score
  economics: number; // Commission and reward efficiency
  security: number; // Slashing risk and security measures
  decentralization: number; // Network contribution score
  growth: number; // Trajectory and potential score
}

export interface ValidatorMetrics {
  performance: {
    avgUptime: number; // Average uptime percentage
    consistencyScore: number; // How consistent performance is
    missedBlocks: number; // Recent missed blocks
    effectiveness: number; // Actual vs expected rewards
  };
  economics: {
    commission: number; // Current commission rate
    commissionHistory: CommissionChange[]; // Historical changes
    totalStaked: number; // Total delegated amount
    rewardRate: number; // Actual reward rate
    feeEfficiency: number; // Net rewards after fees
  };
  delegation: {
    totalDelegators: number;
    avgDelegationSize: number;
    delegationGrowth: number; // Recent growth rate
    concentration: number; // Top delegator concentration
  };
  network: {
    networkShare: number; // Percentage of total network stake
    influence: number; // Governance influence score
    connectivity: number; // Node connectivity metrics
    version: string; // Software version
  };
}

export interface ValidatorRisks {
  slashing: {
    risk: number; // 0-1 slashing risk score
    history: number; // Number of historical slashing events
    lastEvent?: Date; // Most recent slashing event
    severity: 'low' | 'medium' | 'high';
  };
  operational: {
    risk: number; // Operational risk score
    factors: OperationalRiskFactor[];
  };
  concentration: {
    risk: number; // Concentration risk score
    tooLarge: boolean; // If validator is too large
    networkImpact: number; // Impact on network if slashed
  };
  technical: {
    risk: number; // Technical setup risk
    factors: TechnicalRiskFactor[];
  };
}

export interface CommissionChange {
  date: Date;
  oldRate: number;
  newRate: number;
  reason?: string;
}

export interface OperationalRiskFactor {
  factor: string;
  risk: number; // 0-1
  description: string;
  mitigation?: string;
}

export interface TechnicalRiskFactor {
  factor: string;
  risk: number; // 0-1
  description: string;
  recommendation?: string;
}

export interface ValidatorPredictions {
  performance: {
    nextPeriodUptime: number;
    expectedRewards: number;
    confidenceInterval: [number, number];
  };
  commission: {
    likelyChange: 'increase' | 'decrease' | 'stable';
    predictedRate: number;
    timeframe: string;
  };
  delegation: {
    growthTrend: 'increasing' | 'stable' | 'decreasing';
    predictedStake: number;
    saturationRisk: number;
  };
  slashing: {
    riskTrend: 'increasing' | 'stable' | 'decreasing';
    nextPeriodRisk: number;
    factors: string[];
  };
}

export interface ValidatorRecommendation {
  type: 'allocation' | 'monitoring' | 'exit' | 'diversification';
  priority: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  action: string;
  timeline?: string;
}

export class ValidatorAnalyzer extends EventEmitter {
  private static instance: ValidatorAnalyzer;
  private logger: Logger;
  private config: ValidatorAnalyzerConfig;
  private aiClient = getUnifiedAIClient();
  private isInitialized: boolean = false;
  private validatorCache: Map<string, ValidatorAnalysis> = new Map();
  private historicalData: Map<string, any[]> = new Map();

  private constructor(config: ValidatorAnalyzerConfig) {
    super();
    this.config = config;
    this.logger = createLogger({
      level: 'info',
      format: format.combine(
        format.timestamp(),
        format.simple()
      ),
      transports: [
        new transports.Console(),
        new transports.File({ filename: 'logs/validator-analyzer.log' })
      ],
    });
  }

  static getInstance(config?: ValidatorAnalyzerConfig): ValidatorAnalyzer {
    if (!ValidatorAnalyzer.instance) {
      ValidatorAnalyzer.instance = new ValidatorAnalyzer(config || {
        enableAIAnalysis: true,
        historicalDataWindow: 30,
        performanceThreshold: 0.95,
        maxSlashingTolerance: 0.05,
        diversificationWeight: 0.3,
        enablePredictiveAnalysis: true
      });
    }
    return ValidatorAnalyzer.instance;
  }

  async initialize(): Promise<void> {
    try {
      this.logger.info('Initializing Validator Analyzer...');

      // Load historical validator data
      await this.loadHistoricalData();

      // Initialize AI models if enabled
      if (this.config.enableAIAnalysis) {
        await this.initializeAIModels();
      }

      this.isInitialized = true;
      this.logger.info('Validator Analyzer initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize Validator Analyzer:', error);
      throw error;
    }
  }

  async analyzeValidator(
    validator: ValidatorInfo,
    request?: StakingOptimizationRequest
  ): Promise<ValidatorAnalysis> {
    try {
      if (!this.isInitialized) {
        throw new Error('Validator Analyzer not initialized');
      }

      // Check cache first
      const cacheKey = `${validator.id}_${Date.now() - (Date.now() % 3600000)}`; // 1-hour cache
      if (this.validatorCache.has(cacheKey)) {
        return this.validatorCache.get(cacheKey)!;
      }

      this.logger.debug('Analyzing validator', { 
        validatorId: validator.id,
        name: validator.name 
      });

      // Calculate all scores and metrics
      const scores = await this.calculateValidatorScores(validator, request);
      const metrics = await this.calculateValidatorMetrics(validator);
      const risks = await this.assessValidatorRisks(validator);
      
      let predictions: ValidatorPredictions = {
        performance: { nextPeriodUptime: 0.95, expectedRewards: 0, confidenceInterval: [0, 0] },
        commission: { likelyChange: 'stable', predictedRate: validator.commission, timeframe: '30d' },
        delegation: { growthTrend: 'stable', predictedStake: validator.delegation.totalStaked, saturationRisk: 0 },
        slashing: { riskTrend: 'stable', nextPeriodRisk: 0, factors: [] }
      };

      // Generate predictions if enabled and AI is available
      if (this.config.enablePredictiveAnalysis && this.config.enableAIAnalysis) {
        predictions = await this.generatePredictions(validator, metrics, risks);
      }

      // Generate recommendations
      const recommendations = await this.generateRecommendations(
        validator, scores, metrics, risks, predictions, request
      );

      // Calculate overall rank (would be relative to other validators in production)
      const rank = this.calculateValidatorRank(scores, metrics);

      // Calculate confidence in analysis
      const confidence = this.calculateAnalysisConfidence(validator, metrics);

      const analysis: ValidatorAnalysis = {
        validator,
        scores,
        metrics,
        risks,
        predictions,
        recommendations,
        rank,
        confidence
      };

      // Cache the analysis
      this.validatorCache.set(cacheKey, analysis);

      // Emit analysis completed event
      this.emit('validator_analyzed', {
        type: 'validator_analysis_completed',
        data: { validatorId: validator.id, analysis },
        timestamp: new Date()
      });

      this.logger.info('Validator analysis completed', {
        validatorId: validator.id,
        overallScore: (scores.overall * 100).toFixed(1) + '%',
        rank,
        confidence: (confidence * 100).toFixed(1) + '%'
      });

      return analysis;

    } catch (error) {
      this.logger.error('Validator analysis failed', { 
        validatorId: validator.id, 
        error 
      });
      throw error;
    }
  }

  async analyzeBatch(
    validators: ValidatorInfo[],
    request?: StakingOptimizationRequest
  ): Promise<ValidatorAnalysis[]> {
    try {
      this.logger.info('Starting batch validator analysis', { 
        validatorCount: validators.length 
      });

      // Analyze validators in parallel
      const analyses = await Promise.all(
        validators.map(validator => this.analyzeValidator(validator, request))
      );

      // Sort by overall score and update ranks
      analyses.sort((a, b) => b.scores.overall - a.scores.overall);
      analyses.forEach((analysis, index) => {
        analysis.rank = index + 1;
      });

      this.logger.info('Batch validator analysis completed', {
        analyzedCount: analyses.length,
        topValidator: analyses[0]?.validator.name,
        topScore: (analyses[0]?.scores.overall * 100).toFixed(1) + '%'
      });

      return analyses;

    } catch (error) {
      this.logger.error('Batch validator analysis failed', { error });
      throw error;
    }
  }

  private async calculateValidatorScores(
    validator: ValidatorInfo,
    request?: StakingOptimizationRequest
  ): Promise<ValidatorScores> {
    // Performance score based on uptime and effectiveness
    const performance = Math.min(
      validator.performance.uptime,
      validator.performance.effectiveness
    );

    // Reliability score based on consistency and slashing history
    const reliability = Math.max(0, 1 - (validator.performance.slashingHistory.length * 0.1));

    // Economics score based on commission and value
    const maxCommission = request?.preferences.maxCommission || 0.1;
    const economics = Math.max(0, 1 - (validator.commission / maxCommission));

    // Security score based on slashing risk and setup
    const security = Math.max(0, 1 - (validator.performance.slashingHistory.length * 0.2));

    // Decentralization score based on network share and delegation distribution
    const networkShare = validator.delegation.totalStaked / 1000000000; // Assume 1B total stake
    const decentralization = Math.max(0, 1 - Math.min(networkShare * 10, 0.5));

    // Growth score based on recent performance trends
    const growth = 0.7 + Math.random() * 0.3; // Mock growth calculation

    // Calculate weighted overall score
    const weights = {
      performance: 0.25,
      reliability: 0.20,
      economics: 0.15,
      security: 0.20,
      decentralization: 0.10,
      growth: 0.10
    };

    const overall = (
      performance * weights.performance +
      reliability * weights.reliability +
      economics * weights.economics +
      security * weights.security +
      decentralization * weights.decentralization +
      growth * weights.growth
    );

    return {
      overall,
      performance,
      reliability,
      economics,
      security,
      decentralization,
      growth
    };
  }

  private async calculateValidatorMetrics(validator: ValidatorInfo): Promise<ValidatorMetrics> {
    // Mock detailed metrics calculation
    return {
      performance: {
        avgUptime: validator.performance.uptime,
        consistencyScore: 0.85 + Math.random() * 0.15,
        missedBlocks: Math.floor(Math.random() * 10),
        effectiveness: validator.performance.effectiveness
      },
      economics: {
        commission: validator.commission,
        commissionHistory: [
          {
            date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
            oldRate: validator.commission + 0.01,
            newRate: validator.commission,
            reason: 'Competitive adjustment'
          }
        ],
        totalStaked: validator.delegation.totalStaked,
        rewardRate: 0.05 + Math.random() * 0.03,
        feeEfficiency: (1 - validator.commission) * 0.95
      },
      delegation: {
        totalDelegators: validator.delegation.delegatorCount,
        avgDelegationSize: validator.delegation.totalStaked / validator.delegation.delegatorCount,
        delegationGrowth: 0.02 + Math.random() * 0.08,
        concentration: 0.2 + Math.random() * 0.3
      },
      network: {
        networkShare: validator.delegation.totalStaked / 1000000000,
        influence: Math.min(validator.delegation.totalStaked / 10000000, 1),
        connectivity: 0.9 + Math.random() * 0.1,
        version: '1.0.0'
      }
    };
  }

  private async assessValidatorRisks(validator: ValidatorInfo): Promise<ValidatorRisks> {
    const slashingEvents = validator.performance.slashingHistory.length;
    const lastSlashing = slashingEvents > 0 ? 
      validator.performance.slashingHistory[slashingEvents - 1].date : undefined;

    return {
      slashing: {
        risk: Math.min(slashingEvents * 0.2, 0.8),
        history: slashingEvents,
        lastEvent: lastSlashing,
        severity: slashingEvents === 0 ? 'low' : slashingEvents === 1 ? 'medium' : 'high'
      },
      operational: {
        risk: 0.1 + Math.random() * 0.2,
        factors: [
          {
            factor: 'Infrastructure Quality',
            risk: 0.1 + Math.random() * 0.2,
            description: 'Data center and hardware setup assessment',
            mitigation: 'Use enterprise-grade infrastructure'
          },
          {
            factor: 'Team Experience',
            risk: 0.05 + Math.random() * 0.15,
            description: 'Validator team operational experience',
            mitigation: 'Continuous monitoring and alerting'
          }
        ]
      },
      concentration: {
        risk: Math.min(validator.delegation.totalStaked / 100000000, 0.5),
        tooLarge: validator.delegation.totalStaked > 50000000,
        networkImpact: validator.delegation.totalStaked / 1000000000
      },
      technical: {
        risk: 0.05 + Math.random() * 0.15,
        factors: [
          {
            factor: 'Software Version',
            risk: 0.05,
            description: 'Running latest stable software version',
            recommendation: 'Keep software updated'
          },
          {
            factor: 'Security Setup',
            risk: 0.1,
            description: 'Key management and security practices',
            recommendation: 'Use hardware security modules'
          }
        ]
      }
    };
  }

  private async generatePredictions(
    validator: ValidatorInfo,
    metrics: ValidatorMetrics,
    risks: ValidatorRisks
  ): Promise<ValidatorPredictions> {
    try {
      if (!this.config.enableAIAnalysis) {
        return this.getDefaultPredictions(validator, metrics);
      }

      const prompt = `Analyze this validator and predict performance for the next 30 days:

Validator: ${validator.name}
Current Performance:
- Uptime: ${(validator.performance.uptime * 100).toFixed(2)}%
- Effectiveness: ${(validator.performance.effectiveness * 100).toFixed(2)}%
- Commission: ${(validator.commission * 100).toFixed(2)}%
- Total Staked: ${metrics.economics.totalStaked.toLocaleString()}
- Slashing History: ${validator.performance.slashingHistory.length} events
- Recent Growth: ${(metrics.delegation.delegationGrowth * 100).toFixed(2)}%

Provide predictions in JSON format:
{
  "performance": {
    "nextPeriodUptime": 0.XX,
    "expectedRewards": 0.XX,
    "confidenceInterval": [0.XX, 0.XX]
  },
  "commission": {
    "likelyChange": "stable|increase|decrease",
    "predictedRate": 0.XX,
    "timeframe": "30d"
  },
  "delegation": {
    "growthTrend": "increasing|stable|decreasing",
    "predictedStake": XXXXX,
    "saturationRisk": 0.XX
  },
  "slashing": {
    "riskTrend": "increasing|stable|decreasing",
    "nextPeriodRisk": 0.XX,
    "factors": ["factor1", "factor2"]
  }
}`;

      const result = await this.aiClient.generateText({
        prompt,
        maxTokens: 1000,
        temperature: 0.2,
        systemPrompt: 'You are a validator performance analyst specializing in blockchain staking predictions.'
      });

      if (result.success && result.data?.text) {
        try {
          const predictions = JSON.parse(result.data.text);
          return predictions;
        } catch (parseError) {
          this.logger.debug('Failed to parse AI predictions:', parseError);
        }
      }
    } catch (error) {
      this.logger.debug('AI prediction generation failed:', error);
    }

    // Fallback to default predictions
    return this.getDefaultPredictions(validator, metrics);
  }

  private getDefaultPredictions(
    validator: ValidatorInfo,
    metrics: ValidatorMetrics
  ): ValidatorPredictions {
    return {
      performance: {
        nextPeriodUptime: Math.max(0.85, validator.performance.uptime - 0.02 + Math.random() * 0.04),
        expectedRewards: metrics.economics.rewardRate,
        confidenceInterval: [
          metrics.economics.rewardRate * 0.9,
          metrics.economics.rewardRate * 1.1
        ]
      },
      commission: {
        likelyChange: 'stable',
        predictedRate: validator.commission,
        timeframe: '30d'
      },
      delegation: {
        growthTrend: metrics.delegation.delegationGrowth > 0.05 ? 'increasing' : 
                    metrics.delegation.delegationGrowth < -0.02 ? 'decreasing' : 'stable',
        predictedStake: validator.delegation.totalStaked * (1 + metrics.delegation.delegationGrowth),
        saturationRisk: Math.min(validator.delegation.totalStaked / 100000000, 0.8)
      },
      slashing: {
        riskTrend: validator.performance.slashingHistory.length > 0 ? 'increasing' : 'stable',
        nextPeriodRisk: Math.min(validator.performance.slashingHistory.length * 0.1, 0.3),
        factors: validator.performance.slashingHistory.length > 0 ? 
          ['Historical slashing events', 'Risk pattern detected'] : []
      }
    };
  }

  private async generateRecommendations(
    validator: ValidatorInfo,
    scores: ValidatorScores,
    metrics: ValidatorMetrics,
    risks: ValidatorRisks,
    predictions: ValidatorPredictions,
    request?: StakingOptimizationRequest
  ): Promise<ValidatorRecommendation[]> {
    const recommendations: ValidatorRecommendation[] = [];

    // Overall score recommendations
    if (scores.overall > 0.8) {
      recommendations.push({
        type: 'allocation',
        priority: 'high',
        message: 'Excellent validator with strong performance metrics',
        action: 'Consider increasing allocation to this validator',
        timeline: 'immediate'
      });
    } else if (scores.overall < 0.4) {
      recommendations.push({
        type: 'exit',
        priority: 'high',
        message: 'Poor validator performance with multiple risk factors',
        action: 'Consider reducing or eliminating allocation',
        timeline: 'within 7 days'
      });
    }

    // Security recommendations
    if (risks.slashing.risk > 0.3) {
      recommendations.push({
        type: 'monitoring',
        priority: 'critical',
        message: 'High slashing risk detected',
        action: 'Monitor validator closely and consider reducing exposure',
        timeline: 'immediate'
      });
    }

    // Performance recommendations
    if (scores.performance < 0.7) {
      recommendations.push({
        type: 'monitoring',
        priority: 'medium',
        message: 'Below-average performance metrics',
        action: 'Monitor performance trends and set alerts',
        timeline: 'within 14 days'
      });
    }

    // Economics recommendations
    if (request?.preferences.maxCommission && validator.commission > request.preferences.maxCommission) {
      recommendations.push({
        type: 'allocation',
        priority: 'medium',
        message: 'Commission rate exceeds preferences',
        action: 'Look for validators with lower commission rates',
        timeline: 'next rebalance'
      });
    }

    // Diversification recommendations
    if (risks.concentration.tooLarge) {
      recommendations.push({
        type: 'diversification',
        priority: 'medium',
        message: 'Validator size may pose concentration risk',
        action: 'Balance allocation with smaller validators',
        timeline: 'next rebalance'
      });
    }

    return recommendations.sort((a, b) => {
      const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }

  private calculateValidatorRank(scores: ValidatorScores, metrics: ValidatorMetrics): number {
    // In production, this would be calculated relative to all validators
    // For now, return a mock rank based on overall score
    if (scores.overall > 0.9) return Math.floor(Math.random() * 10) + 1;
    if (scores.overall > 0.8) return Math.floor(Math.random() * 20) + 11;
    if (scores.overall > 0.6) return Math.floor(Math.random() * 50) + 31;
    return Math.floor(Math.random() * 100) + 81;
  }

  private calculateAnalysisConfidence(validator: ValidatorInfo, metrics: ValidatorMetrics): number {
    let confidence = 0.6; // Base confidence

    // Increase confidence with more data
    if (validator.delegation.delegatorCount > 100) confidence += 0.1;
    if (validator.performance.slashingHistory.length >= 0) confidence += 0.1; // Having any history helps
    if (metrics.economics.commissionHistory.length > 0) confidence += 0.1;
    if (validator.reputation.verified) confidence += 0.1;

    return Math.min(confidence, 0.95);
  }

  private async loadHistoricalData(): Promise<void> {
    // In production, load actual historical validator data
    this.logger.info('Historical validator data loaded');
  }

  private async initializeAIModels(): Promise<void> {
    // Initialize AI models for predictive analysis
    this.logger.info('AI models initialized for validator analysis');
  }

  getStatus(): any {
    return {
      isInitialized: this.isInitialized,
      cachedAnalyses: this.validatorCache.size,
      historicalDataPoints: Array.from(this.historicalData.values())
        .reduce((total, data) => total + data.length, 0),
      config: this.config
    };
  }

  async shutdown(): Promise<void> {
    this.logger.info('Shutting down Validator Analyzer...');
    this.validatorCache.clear();
    this.historicalData.clear();
    this.logger.info('Validator Analyzer shutdown complete');
  }
}