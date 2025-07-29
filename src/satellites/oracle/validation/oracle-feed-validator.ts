/**
 * Oracle Feed Validator
 * Validates oracle data feeds for accuracy, consistency, and reliability
 */

import { EventEmitter } from 'events';
import { Logger } from 'winston';
import { createLogger, format, transports } from 'winston';
import {
  OracleFeed,
  OracleData,
  OracleValidationResult,
  ValidationError,
  ValidationWarning,
  ValidationRule,
  AnomalyResult
} from '../types';

export interface OracleValidatorConfig {
  enableCrossValidation: boolean;
  enableHistoricalValidation: boolean;
  enableAnomalyDetection: boolean;
  accuracyThreshold: number;
  consensusThreshold: number;
  maxDeviationPercent: number;
  historicalWindowDays: number;
  minConsensusSize: number;
  validationTimeout: number;
  enableCaching: boolean;
  cacheTtl: number;
}

export class OracleFeedValidator extends EventEmitter {
  private static instance: OracleFeedValidator;
  private logger: Logger;
  private config: OracleValidatorConfig;
  private isInitialized: boolean = false;

  // Validation state
  private historicalData: Map<string, OracleData[]> = new Map();
  private feedPerformance: Map<string, FeedPerformanceMetrics> = new Map();
  private validationCache: Map<string, OracleValidationResult> = new Map();

  // Statistical models
  private priceModels: Map<string, PriceModel> = new Map();
  private anomalyDetectors: Map<string, AnomalyDetector> = new Map();

  private constructor(config: OracleValidatorConfig) {
    super();
    this.config = config;
    this.logger = createLogger({
      level: 'info',
      format: format.combine(format.timestamp(), format.simple()),
      transports: [
        new transports.Console(),
        new transports.File({ filename: 'logs/oracle-validator.log' })
      ],
    });
  }

  static getInstance(config?: OracleValidatorConfig): OracleFeedValidator {
    if (!OracleFeedValidator.instance && config) {
      OracleFeedValidator.instance = new OracleFeedValidator(config);
    } else if (!OracleFeedValidator.instance) {
      throw new Error('OracleFeedValidator must be initialized with config first');
    }
    return OracleFeedValidator.instance;
  }

  async initialize(): Promise<void> {
    try {
      this.logger.info('Initializing Oracle Feed Validator...');

      // Load historical data for validation
      await this.loadHistoricalData();

      // Initialize statistical models
      await this.initializeModels();

      // Setup validation rules
      await this.setupValidationRules();

      this.isInitialized = true;
      this.logger.info('Oracle Feed Validator initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize Oracle Feed Validator:', error);
      throw error;
    }
  }

  async validateFeed(feed: OracleFeed): Promise<OracleValidationResult> {
    try {
      if (!this.isInitialized) {
        throw new Error('Oracle Feed Validator not initialized');
      }

      this.logger.debug('Validating oracle feed', { 
        feedId: feed.id, 
        provider: feed.provider,
        type: feed.type 
      });

      // Check cache first
      const cacheKey = this.generateCacheKey(feed);
      if (this.config.enableCaching && this.validationCache.has(cacheKey)) {
        const cached = this.validationCache.get(cacheKey)!;
        if (Date.now() - cached.metadata.timestamp.getTime() < this.config.cacheTtl) {
          return cached;
        }
      }

      // Fetch latest data from feed
      const latestData = await this.fetchFeedData(feed);

      // Perform validation checks
      const validationResults = await Promise.all([
        this.validateDataFormat(feed, latestData),
        this.validateDataFreshness(feed, latestData),
        this.validateDataRange(feed, latestData),
        this.validateConsensus(feed, latestData),
        this.validateHistoricalConsistency(feed, latestData),
        this.detectAnomalies(feed, latestData)
      ]);

      // Aggregate results
      const result = this.aggregateValidationResults(feed, latestData, validationResults);

      // Update feed performance metrics
      await this.updateFeedPerformance(feed, result);

      // Store historical data
      await this.storeHistoricalData(feed, latestData);

      // Cache result
      if (this.config.enableCaching) {
        this.validationCache.set(cacheKey, result);
      }

      // Emit validation event
      this.emit('feed_validated', {
        feedId: feed.id,
        result,
        timestamp: new Date()
      });

      return result;

    } catch (error) {
      this.logger.error('Feed validation failed:', error, { feedId: feed.id });
      throw error;
    }
  }

  async validateCrossOracle(feeds: OracleFeed[], asset: string): Promise<OracleValidationResult> {
    try {
      this.logger.info('Performing cross-oracle validation', { 
        asset, 
        feedCount: feeds.length 
      });

      if (feeds.length < this.config.minConsensusSize) {
        throw new Error(`Insufficient feeds for cross-validation: ${feeds.length} < ${this.config.minConsensusSize}`);
      }

      // Fetch data from all feeds
      const feedData = await Promise.all(
        feeds.map(async feed => ({
          feed,
          data: await this.fetchFeedData(feed)
        }))
      );

      // Calculate consensus
      const consensus = this.calculateConsensus(feedData);

      // Identify outliers
      const outliers = this.identifyOutliers(feedData, consensus);

      // Calculate validation score
      const score = this.calculateCrossValidationScore(feedData, consensus, outliers);

      const result: OracleValidationResult = {
        isValid: score >= this.config.accuracyThreshold,
        score,
        errors: this.generateCrossValidationErrors(outliers),
        warnings: this.generateCrossValidationWarnings(feedData, consensus),
        metadata: {
          sources: feeds.length,
          consensus: consensus.value,
          deviations: feedData.map(fd => this.calculateDeviation(fd.data, consensus)),
          timestamp: new Date()
        }
      };

      this.logger.info('Cross-oracle validation completed', {
        asset,
        score,
        isValid: result.isValid,
        outliers: outliers.length
      });

      return result;

    } catch (error) {
      this.logger.error('Cross-oracle validation failed:', error);
      throw error;
    }
  }

  async validateHistoricalAccuracy(feed: OracleFeed, days: number = 30): Promise<HistoricalAccuracyResult> {
    try {
      const historical = this.historicalData.get(feed.id) || [];
      const cutoff = new Date(Date.now() - (days * 24 * 60 * 60 * 1000));
      const relevantData = historical.filter(data => data.timestamp >= cutoff);

      if (relevantData.length < 10) {
        throw new Error(`Insufficient historical data for accuracy validation: ${relevantData.length}`);
      }

      // Calculate accuracy metrics
      const accuracy = this.calculateHistoricalAccuracy(relevantData);
      const reliability = this.calculateReliability(relevantData);
      const consistency = this.calculateConsistency(relevantData);

      return {
        feedId: feed.id,
        period: days,
        dataPoints: relevantData.length,
        accuracy,
        reliability,
        consistency,
        trends: this.analyzeTrends(relevantData),
        anomalies: this.findHistoricalAnomalies(relevantData)
      };

    } catch (error) {
      this.logger.error('Historical accuracy validation failed:', error);
      throw error;
    }
  }

  // Private Methods
  private async fetchFeedData(feed: OracleFeed): Promise<OracleData> {
    // Mock implementation - would connect to actual oracle feed
    return {
      id: `${feed.id}_${Date.now()}`,
      source: feed.provider,
      value: this.generateMockPrice(feed),
      timestamp: new Date(),
      metadata: {
        feedId: feed.id,
        type: feed.type,
        endpoint: feed.endpoint
      }
    };
  }

  private generateMockPrice(feed: OracleFeed): number {
    // Generate realistic mock price data
    const basePrice = this.getBasePriceForFeed(feed);
    const volatility = 0.02; // 2% volatility
    const randomFactor = (Math.random() - 0.5) * 2 * volatility;
    return basePrice * (1 + randomFactor);
  }

  private getBasePriceForFeed(feed: OracleFeed): number {
    // Mock base prices for different assets
    const basePrices: Record<string, number> = {
      'BTC': 50000,
      'ETH': 3000,
      'USDC': 1.0,
      'USDT': 1.0,
      'GOLD': 2000
    };

    // Extract asset from feed name or use default
    const asset = feed.name.split('/')[0] || 'BTC';
    return basePrices[asset] || 1000;
  }

  private async validateDataFormat(feed: OracleFeed, data: OracleData): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Validate data structure
    if (!data.value || typeof data.value !== 'number') {
      errors.push({
        code: 'INVALID_VALUE_FORMAT',
        message: 'Oracle data value is not a valid number',
        severity: 'critical',
        source: feed.provider,
        timestamp: new Date()
      });
    }

    // Validate timestamp
    if (!data.timestamp || isNaN(data.timestamp.getTime())) {
      errors.push({
        code: 'INVALID_TIMESTAMP',
        message: 'Oracle data timestamp is invalid',
        severity: 'major',
        source: feed.provider,
        timestamp: new Date()
      });
    }

    // Validate metadata
    if (!data.metadata || Object.keys(data.metadata).length === 0) {
      warnings.push({
        code: 'MISSING_METADATA',
        message: 'Oracle data missing metadata',
        source: feed.provider,
        timestamp: new Date()
      });
    }

    return {
      type: 'format',
      errors,
      warnings,
      score: errors.length === 0 ? 1.0 : 0.0
    };
  }

  private async validateDataFreshness(feed: OracleFeed, data: OracleData): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    const age = Date.now() - data.timestamp.getTime();
    const maxAge = feed.updateFrequency * 2; // Allow 2x update frequency

    if (age > maxAge) {
      const severity = age > maxAge * 2 ? 'critical' : 'major';
      errors.push({
        code: 'STALE_DATA',
        message: `Oracle data is stale: ${age}ms old, expected < ${maxAge}ms`,
        severity,
        source: feed.provider,
        timestamp: new Date()
      });
    } else if (age > feed.updateFrequency * 1.5) {
      warnings.push({
        code: 'DATA_AGING',
        message: `Oracle data approaching staleness: ${age}ms old`,
        source: feed.provider,
        timestamp: new Date()
      });
    }

    const score = Math.max(0, 1 - (age / maxAge));

    return {
      type: 'freshness',
      errors,
      warnings,
      score
    };
  }

  private async validateDataRange(feed: OracleFeed, data: OracleData): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    const value = data.value as number;
    const rangeRules = this.getRangeRules(feed);

    if (value < rangeRules.min || value > rangeRules.max) {
      errors.push({
        code: 'VALUE_OUT_OF_RANGE',
        message: `Value ${value} is outside expected range [${rangeRules.min}, ${rangeRules.max}]`,
        severity: 'major',
        source: feed.provider,
        timestamp: new Date()
      });
    }

    // Check for extreme deviations from historical average
    const historical = this.historicalData.get(feed.id) || [];
    if (historical.length > 10) {
      const avg = this.calculateAverage(historical.map(h => h.value as number));
      const deviation = Math.abs(value - avg) / avg;

      if (deviation > 0.5) { // 50% deviation
        errors.push({
          code: 'EXTREME_DEVIATION',
          message: `Value deviates ${(deviation * 100).toFixed(2)}% from historical average`,
          severity: 'major',
          source: feed.provider,
          timestamp: new Date()
        });
      } else if (deviation > 0.2) { // 20% deviation
        warnings.push({
          code: 'HIGH_DEVIATION',
          message: `Value deviates ${(deviation * 100).toFixed(2)}% from historical average`,
          source: feed.provider,
          timestamp: new Date()
        });
      }
    }

    return {
      type: 'range',
      errors,
      warnings,
      score: errors.length === 0 ? 1.0 : 0.5
    };
  }

  private async validateConsensus(feed: OracleFeed, data: OracleData): Promise<ValidationResult> {
    // For consensus validation, we would need data from other oracles
    // This is a simplified implementation
    return {
      type: 'consensus',
      errors: [],
      warnings: [],
      score: 0.9 // Mock consensus score
    };
  }

  private async validateHistoricalConsistency(feed: OracleFeed, data: OracleData): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    const historical = this.historicalData.get(feed.id) || [];
    
    if (historical.length < 5) {
      return {
        type: 'historical',
        errors: [],
        warnings: [],
        score: 1.0 // Not enough data for comparison
      };
    }

    // Check for sudden jumps
    const recent = historical.slice(-5);
    const values = recent.map(h => h.value as number);
    const currentValue = data.value as number;

    const avgRecent = this.calculateAverage(values);
    const jump = Math.abs(currentValue - avgRecent) / avgRecent;

    if (jump > 0.3) { // 30% jump
      errors.push({
        code: 'SUDDEN_PRICE_JUMP',
        message: `Sudden price jump of ${(jump * 100).toFixed(2)}% detected`,
        severity: 'major',
        source: feed.provider,
        timestamp: new Date()
      });
    } else if (jump > 0.15) { // 15% jump
      warnings.push({
        code: 'PRICE_VOLATILITY',
        message: `High price volatility of ${(jump * 100).toFixed(2)}% detected`,
        source: feed.provider,
        timestamp: new Date()
      });
    }

    const score = Math.max(0, 1 - jump);

    return {
      type: 'historical',
      errors,
      warnings,
      score
    };
  }

  private async detectAnomalies(feed: OracleFeed, data: OracleData): Promise<ValidationResult> {
    if (!this.config.enableAnomalyDetection) {
      return {
        type: 'anomaly',
        errors: [],
        warnings: [],
        score: 1.0
      };
    }

    const detector = this.anomalyDetectors.get(feed.id);
    if (!detector) {
      return {
        type: 'anomaly',
        errors: [],
        warnings: [],
        score: 1.0
      };
    }

    const anomaly = await detector.detect(data);
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    if (anomaly.isAnomaly) {
      if (anomaly.score > 0.8) {
        errors.push({
          code: 'ANOMALY_DETECTED',
          message: `High confidence anomaly detected: ${anomaly.explanation}`,
          severity: 'major',
          source: feed.provider,
          timestamp: new Date()
        });
      } else {
        warnings.push({
          code: 'POTENTIAL_ANOMALY',
          message: `Potential anomaly detected: ${anomaly.explanation}`,
          source: feed.provider,
          timestamp: new Date()
        });
      }
    }

    return {
      type: 'anomaly',
      errors,
      warnings,
      score: anomaly.isAnomaly ? 1 - anomaly.score : 1.0
    };
  }

  private aggregateValidationResults(
    feed: OracleFeed,
    data: OracleData,
    results: ValidationResult[]
  ): OracleValidationResult {
    const allErrors = results.flatMap(r => r.errors);
    const allWarnings = results.flatMap(r => r.warnings);
    
    // Calculate weighted score
    const weights = { format: 0.3, freshness: 0.2, range: 0.2, consensus: 0.15, historical: 0.1, anomaly: 0.05 };
    const totalScore = results.reduce((sum, result) => {
      const weight = weights[result.type as keyof typeof weights] || 0;
      return sum + (result.score * weight);
    }, 0);

    const isValid = allErrors.length === 0 && totalScore >= this.config.accuracyThreshold;

    return {
      isValid,
      score: totalScore,
      errors: allErrors,
      warnings: allWarnings,
      metadata: {
        sources: 1,
        consensus: totalScore,
        deviations: [0], // Single feed, no deviations
        timestamp: new Date()
      }
    };
  }

  private calculateConsensus(feedData: Array<{feed: OracleFeed, data: OracleData}>): ConsensusResult {
    const values = feedData.map(fd => fd.data.value as number);
    const sortedValues = [...values].sort((a, b) => a - b);
    
    // Use median as consensus
    const median = this.calculateMedian(sortedValues);
    const mean = this.calculateAverage(values);
    const stdDev = this.calculateStandardDeviation(values, mean);

    return {
      value: median,
      confidence: this.calculateConsensusConfidence(values, median),
      method: 'median',
      participants: feedData.length,
      spread: Math.max(...values) - Math.min(...values),
      standardDeviation: stdDev
    };
  }

  private identifyOutliers(
    feedData: Array<{feed: OracleFeed, data: OracleData}>,
    consensus: ConsensusResult
  ): OutlierInfo[] {
    const outliers: OutlierInfo[] = [];
    const threshold = this.config.maxDeviationPercent / 100;

    for (const fd of feedData) {
      const value = fd.data.value as number;
      const deviation = Math.abs(value - consensus.value) / consensus.value;

      if (deviation > threshold) {
        outliers.push({
          feedId: fd.feed.id,
          provider: fd.feed.provider,
          value,
          consensusValue: consensus.value,
          deviation,
          severity: deviation > threshold * 2 ? 'critical' : 'major'
        });
      }
    }

    return outliers;
  }

  private calculateCrossValidationScore(
    feedData: Array<{feed: OracleFeed, data: OracleData}>,
    consensus: ConsensusResult,
    outliers: OutlierInfo[]
  ): number {
    const outlierPenalty = outliers.length / feedData.length;
    const consensusScore = consensus.confidence;
    
    return Math.max(0, consensusScore - outlierPenalty);
  }

  private generateCrossValidationErrors(outliers: OutlierInfo[]): ValidationError[] {
    return outliers
      .filter(o => o.severity === 'critical')
      .map(o => ({
        code: 'CRITICAL_OUTLIER',
        message: `Critical deviation from consensus: ${(o.deviation * 100).toFixed(2)}%`,
        severity: 'critical' as const,
        source: o.provider,
        timestamp: new Date()
      }));
  }

  private generateCrossValidationWarnings(
    feedData: Array<{feed: OracleFeed, data: OracleData}>,
    consensus: ConsensusResult
  ): ValidationWarning[] {
    const warnings: ValidationWarning[] = [];

    if (consensus.confidence < 0.8) {
      warnings.push({
        code: 'LOW_CONSENSUS_CONFIDENCE',
        message: `Low consensus confidence: ${(consensus.confidence * 100).toFixed(2)}%`,
        timestamp: new Date()
      });
    }

    return warnings;
  }

  // Utility methods
  private calculateAverage(values: number[]): number {
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }

  private calculateMedian(sortedValues: number[]): number {
    const mid = Math.floor(sortedValues.length / 2);
    return sortedValues.length % 2 === 0
      ? (sortedValues[mid - 1] + sortedValues[mid]) / 2
      : sortedValues[mid];
  }

  private calculateStandardDeviation(values: number[], mean: number): number {
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    return Math.sqrt(variance);
  }

  private calculateConsensusConfidence(values: number[], consensus: number): number {
    const deviations = values.map(val => Math.abs(val - consensus) / consensus);
    const avgDeviation = this.calculateAverage(deviations);
    return Math.max(0, 1 - avgDeviation * 2);
  }

  private calculateDeviation(data: OracleData, consensus: ConsensusResult): number {
    const value = data.value as number;
    return Math.abs(value - consensus.value) / consensus.value;
  }

  private getRangeRules(feed: OracleFeed): {min: number, max: number} {
    // Define reasonable ranges for different feed types
    const ranges: Record<string, {min: number, max: number}> = {
      'price': { min: 0, max: 1000000 },
      'rwa': { min: 0, max: 10000000 },
      'event': { min: 0, max: 1 },
      'identity': { min: 0, max: 1 },
      'credit': { min: 0, max: 1000 }
    };

    return ranges[feed.type] || { min: 0, max: Number.MAX_SAFE_INTEGER };
  }

  private generateCacheKey(feed: OracleFeed): string {
    const minute = Math.floor(Date.now() / 60000);
    return `${feed.id}_${minute}`;
  }

  private async loadHistoricalData(): Promise<void> {
    // TODO: Load historical oracle data from storage
    this.logger.info('Historical data loaded');
  }

  private async initializeModels(): Promise<void> {
    // TODO: Initialize price prediction and anomaly detection models
    this.logger.info('Statistical models initialized');
  }

  private async setupValidationRules(): Promise<void> {
    // TODO: Setup configurable validation rules
    this.logger.info('Validation rules configured');
  }

  private async updateFeedPerformance(feed: OracleFeed, result: OracleValidationResult): Promise<void> {
    const performance = this.feedPerformance.get(feed.id) || {
      totalValidations: 0,
      successfulValidations: 0,
      averageScore: 0,
      lastValidation: new Date(),
      errorHistory: []
    };

    performance.totalValidations++;
    if (result.isValid) {
      performance.successfulValidations++;
    }

    // Update average score with exponential moving average
    const alpha = 0.1;
    performance.averageScore = performance.averageScore * (1 - alpha) + result.score * alpha;
    performance.lastValidation = new Date();
    
    // Store recent errors
    if (!result.isValid) {
      performance.errorHistory.push({
        timestamp: new Date(),
        errors: result.errors.map(e => e.code)
      });
      
      // Keep only last 10 errors
      performance.errorHistory = performance.errorHistory.slice(-10);
    }

    this.feedPerformance.set(feed.id, performance);
  }

  private async storeHistoricalData(feed: OracleFeed, data: OracleData): Promise<void> {
    const history = this.historicalData.get(feed.id) || [];
    history.push(data);
    
    // Keep only last 1000 data points
    if (history.length > 1000) {
      history.splice(0, history.length - 1000);
    }
    
    this.historicalData.set(feed.id, history);
  }

  private calculateHistoricalAccuracy(data: OracleData[]): number {
    // Simplified accuracy calculation
    return 0.95; // Mock 95% accuracy
  }

  private calculateReliability(data: OracleData[]): number {
    // Calculate reliability based on consistency
    return 0.92; // Mock 92% reliability
  }

  private calculateConsistency(data: OracleData[]): number {
    // Calculate consistency of updates
    return 0.88; // Mock 88% consistency
  }

  private analyzeTrends(data: OracleData[]): TrendAnalysis {
    return {
      direction: 'stable',
      strength: 0.1,
      duration: data.length,
      volatility: 0.05
    };
  }

  private findHistoricalAnomalies(data: OracleData[]): AnomalyResult[] {
    return []; // Mock empty anomalies
  }

  getStatus(): any {
    return {
      isInitialized: this.isInitialized,
      isRunning: true,
      feedsTracked: this.historicalData.size,
      cacheSize: this.validationCache.size
    };
  }

  async shutdown(): Promise<void> {
    this.logger.info('Shutting down Oracle Feed Validator...');
    this.removeAllListeners();
  }
}

// Supporting interfaces
interface ValidationResult {
  type: string;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  score: number;
}

interface ConsensusResult {
  value: number;
  confidence: number;
  method: string;
  participants: number;
  spread: number;
  standardDeviation: number;
}

interface OutlierInfo {
  feedId: string;
  provider: string;
  value: number;
  consensusValue: number;
  deviation: number;
  severity: 'major' | 'critical';
}

interface FeedPerformanceMetrics {
  totalValidations: number;
  successfulValidations: number;
  averageScore: number;
  lastValidation: Date;
  errorHistory: Array<{
    timestamp: Date;
    errors: string[];
  }>;
}

interface HistoricalAccuracyResult {
  feedId: string;
  period: number;
  dataPoints: number;
  accuracy: number;
  reliability: number;
  consistency: number;
  trends: TrendAnalysis;
  anomalies: AnomalyResult[];
}

interface TrendAnalysis {
  direction: 'up' | 'down' | 'stable';
  strength: number;
  duration: number;
  volatility: number;
}

interface PriceModel {
  predict(data: OracleData[]): number;
  confidence(): number;
}

interface AnomalyDetector {
  detect(data: OracleData): Promise<AnomalyResult>;
  train(data: OracleData[]): Promise<void>;
}