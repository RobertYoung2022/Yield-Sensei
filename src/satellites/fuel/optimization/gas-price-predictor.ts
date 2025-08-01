/**
 * Gas Price Predictor
 * ML-based gas price prediction using historical patterns and network conditions
 */

import { EventEmitter } from 'events';
import { Logger } from 'winston';
import { createLogger, format, transports } from 'winston';

export interface GasPricePredictorConfig {
  windowSize: number; // Number of historical points to consider
  features: string[]; // Features to extract
  updateInterval: number; // How often to update predictions
  confidenceThreshold: number; // Minimum confidence for predictions
}

export interface NetworkFeatures {
  timestamp: number;
  dayOfWeek: number;
  hourOfDay: number;
  minuteOfHour: number;
  baseFee: number;
  priorityFee: number;
  blockUtilization: number;
  pendingTxCount: number;
  mempoolSize: number;
  lastBlockTime: number;
  networkCongestion: number;
}

export interface PredictionResult {
  timestamp: Date;
  predictions: {
    baseFee: number;
    priorityFee: number;
    confidence: number;
  }[];
  features: NetworkFeatures;
  model: string;
}

export class GasPricePredictor extends EventEmitter {
  private logger: Logger;
  private config: GasPricePredictorConfig;
  private historicalData: NetworkFeatures[] = [];
  private model: any; // In production, would be actual ML model
  private isInitialized: boolean = false;

  constructor(config: GasPricePredictorConfig) {
    super();
    this.config = config;
    this.logger = createLogger({
      level: 'info',
      format: format.combine(
        format.timestamp(),
        format.printf(({ timestamp, level, message, ...meta }) => {
          return `${timestamp} [GasPredictor] ${level}: ${message} ${Object.keys(meta).length > 0 ? JSON.stringify(meta) : ''}`;
        })
      ),
      transports: [
        new transports.Console(),
        new transports.File({ filename: 'logs/gas-predictor.log' })
      ],
    });
  }

  async initialize(): Promise<void> {
    try {
      this.logger.info('Initializing Gas Price Predictor...');
      
      // In production, load pre-trained model
      await this.loadModel();
      
      // Initialize feature extractors
      this.setupFeatureExtractors();
      
      this.isInitialized = true;
      this.logger.info('Gas Price Predictor initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize Gas Price Predictor:', error);
      throw error;
    }
  }

  async predict(currentData: Partial<NetworkFeatures>): Promise<PredictionResult> {
    if (!this.isInitialized) {
      throw new Error('Gas Price Predictor not initialized');
    }

    try {
      // Extract features
      const features = this.extractFeatures(currentData);
      
      // Make predictions for different time horizons
      const predictions = await this.makePredictions(features);
      
      const result: PredictionResult = {
        timestamp: new Date(),
        predictions,
        features,
        model: 'ensemble_v1'
      };
      
      // Update historical data
      this.updateHistory(features);
      
      return result;
    } catch (error) {
      this.logger.error('Prediction failed:', error);
      throw error;
    }
  }

  private async loadModel(): Promise<void> {
    // In production, load actual ML model (TensorFlow, PyTorch, etc.)
    // For now, simulate with statistical model
    this.model = {
      type: 'statistical',
      weights: this.generateMockWeights()
    };
  }

  private setupFeatureExtractors(): void {
    // Setup feature extraction pipeline
    this.logger.debug('Feature extractors configured:', this.config.features);
  }

  private extractFeatures(data: Partial<NetworkFeatures>): NetworkFeatures {
    const now = new Date();
    
    return {
      timestamp: now.getTime(),
      dayOfWeek: now.getDay(),
      hourOfDay: now.getHours(),
      minuteOfHour: now.getMinutes(),
      baseFee: data.baseFee || 0,
      priorityFee: data.priorityFee || 0,
      blockUtilization: data.blockUtilization || 0.5,
      pendingTxCount: data.pendingTxCount || 0,
      mempoolSize: data.mempoolSize || 0,
      lastBlockTime: data.lastBlockTime || 12,
      networkCongestion: this.calculateCongestion(data)
    };
  }

  private calculateCongestion(data: Partial<NetworkFeatures>): number {
    // Simple congestion metric based on utilization and pending txs
    const utilization = data.blockUtilization || 0.5;
    const pendingRatio = Math.min((data.pendingTxCount || 0) / 1000, 1);
    
    return (utilization * 0.7 + pendingRatio * 0.3);
  }

  private async makePredictions(features: NetworkFeatures): Promise<{
    baseFee: number;
    priorityFee: number;
    confidence: number;
  }[]> {
    // Time horizons: 5min, 15min, 30min, 1hr
    const horizons = [5, 15, 30, 60];
    const predictions = [];
    
    for (const minutes of horizons) {
      const prediction = await this.predictForHorizon(features, minutes);
      predictions.push(prediction);
    }
    
    return predictions;
  }

  private async predictForHorizon(
    features: NetworkFeatures,
    minutesAhead: number
  ): Promise<{
    baseFee: number;
    priorityFee: number;
    confidence: number;
  }> {
    // Simulate ML prediction with pattern-based logic
    
    // Time-based patterns
    const hourPattern = this.getHourlyPattern(features.hourOfDay);
    const dayPattern = this.getDailyPattern(features.dayOfWeek);
    
    // Congestion-based adjustments
    const congestionMultiplier = 1 + (features.networkCongestion * 0.5);
    
    // Historical trend
    const trend = this.calculateTrend();
    
    // Base prediction
    let predictedBaseFee = features.baseFee;
    let predictedPriorityFee = features.priorityFee;
    
    // Apply patterns and trends
    predictedBaseFee *= hourPattern * dayPattern * congestionMultiplier;
    predictedBaseFee *= (1 + trend * minutesAhead / 60); // Trend impact increases with time
    
    predictedPriorityFee *= congestionMultiplier;
    
    // Add volatility for longer predictions
    const volatility = this.calculateVolatility();
    const noise = (Math.random() - 0.5) * volatility * (minutesAhead / 60);
    predictedBaseFee *= (1 + noise);
    
    // Calculate confidence based on data quality and prediction horizon
    const confidence = this.calculateConfidence(features, minutesAhead);
    
    return {
      baseFee: Math.max(1, Math.round(predictedBaseFee)),
      priorityFee: Math.max(0.1, Math.round(predictedPriorityFee * 10) / 10),
      confidence
    };
  }

  private getHourlyPattern(hour: number): number {
    // Typical gas price patterns throughout the day
    const patterns = [
      0.8,  // 00:00 - Low
      0.7,  // 01:00 - Very Low
      0.7,  // 02:00 - Very Low
      0.7,  // 03:00 - Very Low
      0.8,  // 04:00 - Low
      0.9,  // 05:00 - Rising
      1.0,  // 06:00 - Normal
      1.1,  // 07:00 - High
      1.2,  // 08:00 - Peak
      1.3,  // 09:00 - Peak
      1.2,  // 10:00 - High
      1.1,  // 11:00 - High
      1.0,  // 12:00 - Normal
      1.1,  // 13:00 - High
      1.2,  // 14:00 - High
      1.3,  // 15:00 - Peak
      1.2,  // 16:00 - High
      1.1,  // 17:00 - High
      1.0,  // 18:00 - Normal
      1.0,  // 19:00 - Normal
      1.0,  // 20:00 - Normal
      0.9,  // 21:00 - Declining
      0.9,  // 22:00 - Low
      0.8   // 23:00 - Low
    ];
    
    return patterns[hour] || 1.0;
  }

  private getDailyPattern(dayOfWeek: number): number {
    // Weekly patterns (0 = Sunday)
    const patterns = [
      0.9,  // Sunday - Low
      1.1,  // Monday - High
      1.2,  // Tuesday - Peak
      1.2,  // Wednesday - Peak
      1.1,  // Thursday - High
      1.0,  // Friday - Normal
      0.8   // Saturday - Low
    ];
    
    return patterns[dayOfWeek] || 1.0;
  }

  private calculateTrend(): number {
    if (this.historicalData.length < 10) {
      return 0;
    }
    
    // Simple linear regression on recent data
    const recent = this.historicalData.slice(-20);
    const avgOld = recent.slice(0, 10).reduce((sum, d) => sum + d.baseFee, 0) / 10;
    const avgNew = recent.slice(10).reduce((sum, d) => sum + d.baseFee, 0) / 10;
    
    return (avgNew - avgOld) / avgOld;
  }

  private calculateVolatility(): number {
    if (this.historicalData.length < 10) {
      return 0.1; // Default volatility
    }
    
    const recent = this.historicalData.slice(-20);
    const prices = recent.map(d => d.baseFee);
    const mean = prices.reduce((sum, p) => sum + p, 0) / prices.length;
    const variance = prices.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / prices.length;
    
    return Math.sqrt(variance) / mean;
  }

  private calculateConfidence(features: NetworkFeatures, minutesAhead: number): number {
    // Base confidence
    let confidence = 0.9;
    
    // Reduce confidence for longer predictions
    confidence *= Math.exp(-minutesAhead / 120); // Exponential decay
    
    // Reduce confidence for high volatility
    const volatility = this.calculateVolatility();
    confidence *= (1 - volatility * 0.5);
    
    // Reduce confidence for extreme congestion
    if (features.networkCongestion > 0.8) {
      confidence *= 0.8;
    }
    
    // Ensure minimum confidence
    return Math.max(0.3, Math.min(1, confidence));
  }

  private updateHistory(features: NetworkFeatures): void {
    this.historicalData.push(features);
    
    // Keep only recent history
    if (this.historicalData.length > this.config.windowSize) {
      this.historicalData = this.historicalData.slice(-this.config.windowSize);
    }
  }

  private generateMockWeights(): Record<string, number> {
    // Mock weights for feature importance
    return {
      hourOfDay: 0.25,
      dayOfWeek: 0.15,
      networkCongestion: 0.3,
      blockUtilization: 0.2,
      trend: 0.1
    };
  }

  async trainOnNewData(data: NetworkFeatures[]): Promise<void> {
    // In production, would retrain or fine-tune the model
    this.logger.info('Training on new data', { samples: data.length });
    
    // Update historical data
    for (const features of data) {
      this.updateHistory(features);
    }
    
    // Simulate training
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    this.logger.info('Training completed');
  }

  getModelMetrics(): any {
    return {
      type: this.model?.type || 'unknown',
      historicalDataSize: this.historicalData.length,
      features: this.config.features,
      lastUpdate: this.historicalData[this.historicalData.length - 1]?.timestamp || null
    };
  }
}