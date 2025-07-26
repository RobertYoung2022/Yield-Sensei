/**
 * Opportunity Scoring Engine
 * ML-based system to evaluate and score arbitrage opportunities
 */

import * as tf from '@tensorflow/tfjs-node';
import Logger from '../../../shared/logging/logger';
import { RedisManager } from '../../../shared/database/redis-manager';
import { 
  ArbitrageOpportunity,
  ChainID,
  AssetID
} from '../types';

const logger = Logger.getLogger('opportunity-scoring-engine');

export interface OpportunityScore {
  opportunityId: string;
  totalScore: number; // 0-100
  componentScores: {
    profitability: number;
    risk: number;
    executionFeasibility: number;
    timeSensitivity: number;
    marketDepth: number;
    historicalSuccess: number;
  };
  confidence: number; // 0-1
  recommendation: 'execute' | 'monitor' | 'reject';
  reasoning: string[];
}

export interface FeatureVector {
  // Profitability features
  expectedProfit: number;
  profitMargin: number;
  profitToGasRatio: number;
  
  // Risk features
  priceVolatility: number;
  liquidityRisk: number;
  mevRisk: number;
  bridgeRisk: number;
  
  // Execution features
  gasEstimate: number;
  executionTime: number;
  pathComplexity: number;
  
  // Market features
  liquidityDepth: number;
  orderBookSpread: number;
  volumeProfile: number;
  
  // Temporal features
  priceAge: number;
  timeOfDay: number;
  dayOfWeek: number;
  
  // Historical features
  assetSuccessRate: number;
  chainSuccessRate: number;
  pathSuccessRate: number;
  
  // Network features
  networkCongestion: number;
  gasPricePercentile: number;
}

export interface ModelWeights {
  profitability: number;
  risk: number;
  executionFeasibility: number;
  timeSensitivity: number;
  marketDepth: number;
  historicalSuccess: number;
}

export class OpportunityScoringEngine {
  private model: tf.LayersModel | null = null;
  private redis: RedisManager;
  private weights: ModelWeights;
  private isModelTrained = false;
  private featureStats: { mean: number[]; std: number[] } | null = null;

  constructor() {
    this.redis = new RedisManager({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      keyPrefix: 'scoring-engine:',
    });

    // Default weights for score components
    this.weights = {
      profitability: 0.25,
      risk: 0.20,
      executionFeasibility: 0.20,
      timeSensitivity: 0.15,
      marketDepth: 0.10,
      historicalSuccess: 0.10,
    };
  }

  async initialize(): Promise<void> {
    try {
      await this.redis.connect();
      await this.loadOrCreateModel();
      await this.loadFeatureStats();
      
      logger.info('Opportunity Scoring Engine initialized');
    } catch (error) {
      logger.error('Failed to initialize scoring engine:', error);
      throw error;
    }
  }

  private async loadOrCreateModel(): Promise<void> {
    try {
      // Try to load existing model from Redis
      const modelData = await this.redis.get('ml-model');
      
      if (modelData) {
        const modelJson = JSON.parse(modelData);
        this.model = await tf.loadLayersModel(tf.io.fromMemory(modelJson));
        this.isModelTrained = true;
        logger.info('Loaded existing ML model');
      } else {
        // Create new model
        await this.createModel();
        logger.info('Created new ML model');
      }
    } catch (error) {
      logger.error('Error loading model, creating new one:', error);
      await this.createModel();
    }
  }

  private async createModel(): Promise<void> {
    // Create a neural network for opportunity scoring
    this.model = tf.sequential({
      layers: [
        // Input layer (22 features)
        tf.layers.dense({
          inputShape: [22],
          units: 64,
          activation: 'relu',
          kernelRegularizer: tf.regularizers.l2({ l2: 0.001 }),
        }),
        
        // Hidden layers with dropout for regularization
        tf.layers.dropout({ rate: 0.3 }),
        tf.layers.dense({
          units: 32,
          activation: 'relu',
          kernelRegularizer: tf.regularizers.l2({ l2: 0.001 }),
        }),
        
        tf.layers.dropout({ rate: 0.2 }),
        tf.layers.dense({
          units: 16,
          activation: 'relu',
        }),
        
        // Output layer (single score 0-1)
        tf.layers.dense({
          units: 1,
          activation: 'sigmoid',
        }),
      ],
    });

    // Compile model
    this.model.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'meanSquaredError',
      metrics: ['mae'],
    });
  }

  private async loadFeatureStats(): Promise<void> {
    try {
      const statsData = await this.redis.get('feature-stats');
      if (statsData) {
        this.featureStats = JSON.parse(statsData);
      } else {
        // Initialize with default stats
        this.featureStats = {
          mean: new Array(22).fill(0),
          std: new Array(22).fill(1),
        };
      }
    } catch (error) {
      logger.error('Error loading feature stats:', error);
      this.featureStats = {
        mean: new Array(22).fill(0),
        std: new Array(22).fill(1),
      };
    }
  }

  async scoreOpportunity(
    opportunity: ArbitrageOpportunity,
    marketData?: any,
    historicalData?: any
  ): Promise<OpportunityScore> {
    try {
      // Extract features from opportunity
      const features = await this.extractFeatures(opportunity, marketData, historicalData);
      
      // Calculate component scores
      const componentScores = {
        profitability: this.calculateProfitabilityScore(features),
        risk: this.calculateRiskScore(features),
        executionFeasibility: this.calculateExecutionFeasibilityScore(features),
        timeSensitivity: this.calculateTimeSensitivityScore(features),
        marketDepth: this.calculateMarketDepthScore(features),
        historicalSuccess: this.calculateHistoricalSuccessScore(features),
      };

      // Get ML prediction if model is trained
      let mlScore = 0.5; // Default neutral score
      let confidence = 0.5;
      
      if (this.model && this.isModelTrained) {
        const normalizedFeatures = this.normalizeFeatures(features);
        const prediction = this.model.predict(
          tf.tensor2d([normalizedFeatures])
        ) as tf.Tensor;
        
        const scoreArray = await prediction.data();
        mlScore = scoreArray[0];
        confidence = Math.min(1, Math.abs(mlScore - 0.5) * 2); // Higher confidence for extreme scores
        
        prediction.dispose();
      }

      // Combine scores using weighted average
      const weightedScore = 
        componentScores.profitability * this.weights.profitability +
        componentScores.risk * this.weights.risk +
        componentScores.executionFeasibility * this.weights.executionFeasibility +
        componentScores.timeSensitivity * this.weights.timeSensitivity +
        componentScores.marketDepth * this.weights.marketDepth +
        componentScores.historicalSuccess * this.weights.historicalSuccess;

      // Blend weighted score with ML prediction
      const totalScore = (weightedScore * 0.6 + mlScore * 100 * 0.4);

      // Generate recommendation
      const { recommendation, reasoning } = this.generateRecommendation(
        totalScore,
        componentScores,
        confidence
      );

      return {
        opportunityId: opportunity.id,
        totalScore,
        componentScores,
        confidence,
        recommendation,
        reasoning,
      };
    } catch (error) {
      logger.error('Error scoring opportunity:', error);
      
      // Return default score on error
      return {
        opportunityId: opportunity.id,
        totalScore: 0,
        componentScores: {
          profitability: 0,
          risk: 0,
          executionFeasibility: 0,
          timeSensitivity: 0,
          marketDepth: 0,
          historicalSuccess: 0,
        },
        confidence: 0,
        recommendation: 'reject',
        reasoning: ['Error occurred during scoring'],
      };
    }
  }

  private async extractFeatures(
    opportunity: ArbitrageOpportunity,
    marketData?: any,
    historicalData?: any
  ): Promise<FeatureVector> {
    const now = Date.now();
    const priceAge = (now - opportunity.timestamp) / 1000; // seconds
    const date = new Date(now);

    return {
      // Profitability features
      expectedProfit: opportunity.expectedProfit,
      profitMargin: opportunity.profitMargin,
      profitToGasRatio: opportunity.expectedProfit / (opportunity.estimatedGasCost || 1),
      
      // Risk features
      priceVolatility: marketData?.volatility || 0.1,
      liquidityRisk: Math.max(0, 1 - (marketData?.liquidity || 0) / 1000000), // Normalized to $1M
      mevRisk: opportunity.riskScore / 100,
      bridgeRisk: this.calculateBridgeRisk(opportunity),
      
      // Execution features
      gasEstimate: opportunity.estimatedGasCost,
      executionTime: opportunity.executionTime,
      pathComplexity: opportunity.executionPaths?.[0]?.steps?.length || 1,
      
      // Market features
      liquidityDepth: marketData?.depth || 100000,
      orderBookSpread: marketData?.spread || 0.001,
      volumeProfile: marketData?.volume || 1000000,
      
      // Temporal features
      priceAge,
      timeOfDay: date.getHours(),
      dayOfWeek: date.getDay(),
      
      // Historical features
      assetSuccessRate: historicalData?.assetSuccessRate || 0.5,
      chainSuccessRate: historicalData?.chainSuccessRate || 0.5,
      pathSuccessRate: historicalData?.pathSuccessRate || 0.5,
      
      // Network features
      networkCongestion: marketData?.congestion || 0.5,
      gasPricePercentile: marketData?.gasPricePercentile || 0.5,
    };
  }

  private calculateBridgeRisk(opportunity: ArbitrageOpportunity): number {
    // Calculate risk based on bridge usage in execution path
    if (!opportunity.executionPaths?.[0]?.steps) return 0;
    
    const bridgeSteps = opportunity.executionPaths[0].steps.filter(step => step.type === 'bridge');
    const totalSteps = opportunity.executionPaths[0].steps.length;
    
    return bridgeSteps.length / totalSteps; // Higher ratio = higher risk
  }

  private normalizeFeatures(features: FeatureVector): number[] {
    const featureArray = [
      features.expectedProfit,
      features.profitMargin,
      features.profitToGasRatio,
      features.priceVolatility,
      features.liquidityRisk,
      features.mevRisk,
      features.bridgeRisk,
      features.gasEstimate,
      features.executionTime,
      features.pathComplexity,
      features.liquidityDepth,
      features.orderBookSpread,
      features.volumeProfile,
      features.priceAge,
      features.timeOfDay,
      features.dayOfWeek,
      features.assetSuccessRate,
      features.chainSuccessRate,
      features.pathSuccessRate,
      features.networkCongestion,
      features.gasPricePercentile,
    ];

    // Z-score normalization
    if (this.featureStats) {
      return featureArray.map((value, i) => 
        (value - this.featureStats!.mean[i]) / (this.featureStats!.std[i] || 1)
      );
    }

    return featureArray;
  }

  private calculateProfitabilityScore(features: FeatureVector): number {
    // Score based on profit margin, absolute profit, and profit-to-gas ratio
    const marginScore = Math.min(100, features.profitMargin * 10000); // 1% = 100 points
    const absoluteScore = Math.min(100, features.expectedProfit / 10); // $10 = 100 points
    const efficiencyScore = Math.min(100, features.profitToGasRatio * 10); // 10:1 ratio = 100 points
    
    return (marginScore * 0.5 + absoluteScore * 0.3 + efficiencyScore * 0.2);
  }

  private calculateRiskScore(features: FeatureVector): number {
    // Lower risk = higher score
    const volatilityRisk = Math.max(0, 100 - features.priceVolatility * 1000);
    const liquidityRisk = Math.max(0, 100 - features.liquidityRisk * 100);
    const mevRisk = Math.max(0, 100 - features.mevRisk * 100);
    const bridgeRisk = Math.max(0, 100 - features.bridgeRisk * 100);
    
    return (volatilityRisk + liquidityRisk + mevRisk + bridgeRisk) / 4;
  }

  private calculateExecutionFeasibilityScore(features: FeatureVector): number {
    // Score based on gas cost reasonableness and execution complexity
    const gasScore = Math.max(0, 100 - features.gasEstimate / 10); // Lower gas = higher score
    const timeScore = Math.max(0, 100 - features.executionTime / 60); // Under 1 min = 100 points
    const complexityScore = Math.max(0, 100 - features.pathComplexity * 10); // Simpler = better
    
    return (gasScore * 0.4 + timeScore * 0.4 + complexityScore * 0.2);
  }

  private calculateTimeSensitivityScore(features: FeatureVector): number {
    // Fresher prices and optimal timing = higher score
    const freshnessScore = Math.max(0, 100 - features.priceAge * 2); // Recent = better
    
    // Optimal hours (typically 8-16 UTC when markets are most active)
    const hourScore = features.timeOfDay >= 8 && features.timeOfDay <= 16 ? 100 : 70;
    
    // Weekdays typically better than weekends
    const dayScore = features.dayOfWeek >= 1 && features.dayOfWeek <= 5 ? 100 : 80;
    
    return (freshnessScore * 0.6 + hourScore * 0.2 + dayScore * 0.2);
  }

  private calculateMarketDepthScore(features: FeatureVector): number {
    // Higher liquidity and volume = higher score
    const depthScore = Math.min(100, features.liquidityDepth / 10000); // $1M depth = 100 points
    const volumeScore = Math.min(100, features.volumeProfile / 100000); // $10M volume = 100 points
    const spreadScore = Math.max(0, 100 - features.orderBookSpread * 10000); // Tight spread = better
    
    return (depthScore * 0.4 + volumeScore * 0.3 + spreadScore * 0.3);
  }

  private calculateHistoricalSuccessScore(features: FeatureVector): number {
    // Historical success rates indicate future probability
    const assetScore = features.assetSuccessRate * 100;
    const chainScore = features.chainSuccessRate * 100;
    const pathScore = features.pathSuccessRate * 100;
    
    return (assetScore * 0.4 + chainScore * 0.3 + pathScore * 0.3);
  }

  private generateRecommendation(
    totalScore: number,
    componentScores: any,
    confidence: number
  ): { recommendation: 'execute' | 'monitor' | 'reject'; reasoning: string[] } {
    const reasoning: string[] = [];

    // High-confidence, high-score opportunities
    if (totalScore >= 80 && confidence >= 0.8) {
      reasoning.push('High total score with high confidence');
      return { recommendation: 'execute', reasoning };
    }

    // Check individual component scores
    if (componentScores.profitability < 30) {
      reasoning.push('Low profitability score');
    }
    
    if (componentScores.risk < 50) {
      reasoning.push('High risk detected');
    }
    
    if (componentScores.executionFeasibility < 40) {
      reasoning.push('Low execution feasibility');
    }

    // Decision logic
    if (totalScore >= 70 && confidence >= 0.6) {
      reasoning.push('Good score and moderate confidence');
      return { recommendation: 'execute', reasoning };
    } else if (totalScore >= 40 && totalScore < 70) {
      reasoning.push('Moderate score - monitor for improvements');
      return { recommendation: 'monitor', reasoning };
    } else {
      reasoning.push('Low total score or confidence');
      return { recommendation: 'reject', reasoning };
    }
  }

  async trainModel(trainingData: Array<{ features: FeatureVector; score: number }>): Promise<void> {
    if (!this.model || trainingData.length < 10) {
      logger.warn('Insufficient training data or no model available');
      return;
    }

    try {
      // Prepare training data
      const features = trainingData.map(d => this.normalizeFeatures(d.features));
      const labels = trainingData.map(d => d.score / 100); // Normalize to 0-1

      const xs = tf.tensor2d(features);
      const ys = tf.tensor2d(labels, [labels.length, 1]);

      // Train the model
      await this.model.fit(xs, ys, {
        epochs: 50,
        batchSize: 32,
        validationSplit: 0.2,
        callbacks: {
          onEpochEnd: (epoch, logs) => {
            if (epoch % 10 === 0) {
              logger.info(`Training epoch ${epoch}: loss=${logs?.loss?.toFixed(4)}`);
            }
          },
        },
      });

      // Update feature statistics
      await this.updateFeatureStats(features);

      // Save model
      await this.saveModel();

      this.isModelTrained = true;
      logger.info('Model training completed');

      // Cleanup
      xs.dispose();
      ys.dispose();
    } catch (error) {
      logger.error('Error training model:', error);
    }
  }

  private async updateFeatureStats(features: number[][]): Promise<void> {
    // Calculate mean and std for each feature
    const featureCount = features[0].length;
    const mean = new Array(featureCount).fill(0);
    const std = new Array(featureCount).fill(1);

    // Calculate means
    for (let i = 0; i < featureCount; i++) {
      const values = features.map(f => f[i]);
      mean[i] = values.reduce((sum, val) => sum + val, 0) / values.length;
    }

    // Calculate standard deviations
    for (let i = 0; i < featureCount; i++) {
      const values = features.map(f => f[i]);
      const variance = values.reduce((sum, val) => sum + Math.pow(val - mean[i], 2), 0) / values.length;
      std[i] = Math.sqrt(variance) || 1;
    }

    this.featureStats = { mean, std };

    // Save to Redis
    await this.redis.setex(
      'feature-stats',
      86400 * 7, // 7 days
      JSON.stringify(this.featureStats)
    );
  }

  private async saveModel(): Promise<void> {
    if (!this.model) return;

    try {
      const modelArtifacts = await this.model.save(tf.io.withSaveHandler(async (artifacts) => artifacts));
      await this.redis.setex(
        'ml-model',
        86400 * 30, // 30 days
        JSON.stringify(modelArtifacts)
      );
    } catch (error) {
      logger.error('Error saving model:', error);
    }
  }

  async scoreBatch(opportunities: ArbitrageOpportunity[]): Promise<OpportunityScore[]> {
    const scores = await Promise.all(
      opportunities.map(opp => this.scoreOpportunity(opp))
    );

    // Sort by total score descending
    return scores.sort((a, b) => b.totalScore - a.totalScore);
  }

  updateWeights(newWeights: Partial<ModelWeights>): void {
    this.weights = { ...this.weights, ...newWeights };
    logger.info('Updated scoring weights:', this.weights);
  }

  getModelStatus(): {
    isTrained: boolean;
    hasFeatureStats: boolean;
    weights: ModelWeights;
  } {
    return {
      isTrained: this.isModelTrained,
      hasFeatureStats: this.featureStats !== null,
      weights: this.weights,
    };
  }
}