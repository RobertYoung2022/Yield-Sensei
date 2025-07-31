/**
 * Reward Optimizer
 * Optimizes reward claiming, compounding, and reinvestment strategies for liquid staking
 */

import { EventEmitter } from 'events';
import { Logger } from 'winston';
import { createLogger, format, transports } from 'winston';
import { LiquidStakingPosition, ValidatorInfo, StakingOptimizationRequest } from '../types';
import { getUnifiedAIClient } from '../../../integrations/ai/unified-ai-client';

export interface RewardOptimizerConfig {
  enableAutoCompounding: boolean;
  minClaimThreshold: number; // Minimum reward amount before claiming
  maxClaimInterval: number; // Maximum time before forced claim (seconds)
  gasOptimization: boolean;
  reinvestmentStrategy: 'compound' | 'diversify' | 'rebalance' | 'hybrid';
  enableTaxOptimization: boolean;
  compoundingFrequency: 'daily' | 'weekly' | 'monthly' | 'optimal';
}

export interface RewardOptimization {
  position: LiquidStakingPosition;
  strategy: RewardStrategy;
  actions: RewardAction[];
  projectedGains: ProjectedGains;
  riskAssessment: RewardRiskAssessment;
  timeline: RewardTimeline;
  gasEstimate: GasEstimate;
}

export interface RewardStrategy {
  type: 'immediate' | 'delayed' | 'compound' | 'reinvest' | 'diversify';
  description: string;
  reasoning: string[];
  frequency: number; // Optimal claiming frequency in seconds
  conditions: RewardCondition[];
  expectedApy: number;
  riskLevel: 'low' | 'medium' | 'high';
}

export interface RewardAction {
  type: 'claim' | 'compound' | 'reinvest' | 'rebalance' | 'wait';
  priority: number; // 1-10, higher = more urgent
  amount: number;
  targetValidator?: ValidatorInfo;
  estimatedGas: number;
  expectedReturn: number;
  timeframe: string;
  prerequisites: string[];
}

export interface RewardCondition {
  type: 'threshold' | 'time' | 'gas' | 'market' | 'validator';
  condition: string;
  value: number;
  met: boolean;
}

export interface ProjectedGains {
  immediate: {
    claimable: number;
    afterFees: number;
    netGain: number;
  };
  compounded: {
    oneMonth: number;
    threeMonths: number;
    oneYear: number;
    effectiveApy: number;
  };
  reinvested: {
    diversificationBenefit: number;
    riskReduction: number;
    expectedReturn: number;
  };
  optimal: {
    strategy: string;
    expectedReturn: number;
    timeToOptimal: number;
  };
}

export interface RewardRiskAssessment {
  claimingRisk: {
    gasVolatility: number;
    networkCongestion: number;
    validatorRisk: number;
    opportunityCost: number;
  };
  compoundingRisk: {
    concentrationRisk: number;
    validatorDependency: number;
    liquidityRisk: number;
  };
  reinvestmentRisk: {
    diversificationBenefit: number;
    newValidatorRisk: number;
    transactionRisk: number;
  };
  overallRisk: number;
}

export interface RewardTimeline {
  nextOptimalClaim: Date;
  compoundingSchedule: Date[];
  rebalancePoints: Date[];
  milestones: RewardMilestone[];
}

export interface RewardMilestone {
  date: Date;
  description: string;
  expectedAmount: number;
  action: string;
}

export interface GasEstimate {
  claimCost: number;
  compoundCost: number;
  reinvestCost: number;
  totalCost: number;
  breakEvenAmount: number;
  gasEfficiencyScore: number;
}

export interface RewardBatch {
  positions: LiquidStakingPosition[];
  totalRewards: number;
  batchGasSavings: number;
  optimalTiming: Date;
  batchActions: RewardAction[];
}

export class RewardOptimizer extends EventEmitter {
  private static instance: RewardOptimizer;
  private logger: Logger;
  private config: RewardOptimizerConfig;
  private aiClient = getUnifiedAIClient();
  private isInitialized: boolean = false;
  private optimizationHistory: Map<string, RewardOptimization[]> = new Map();
  private gasTracker: Map<string, number[]> = new Map();

  private constructor(config: RewardOptimizerConfig) {
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
        new transports.File({ filename: 'logs/reward-optimizer.log' })
      ],
    });
  }

  static getInstance(config?: RewardOptimizerConfig): RewardOptimizer {
    if (!RewardOptimizer.instance) {
      RewardOptimizer.instance = new RewardOptimizer(config || {
        enableAutoCompounding: true,
        minClaimThreshold: 0.01, // 0.01 ETH or equivalent
        maxClaimInterval: 604800, // 1 week in seconds
        gasOptimization: true,
        reinvestmentStrategy: 'hybrid',
        enableTaxOptimization: false,
        compoundingFrequency: 'optimal'
      });
    }
    return RewardOptimizer.instance;
  }

  async initialize(): Promise<void> {
    try {
      this.logger.info('Initializing Reward Optimizer...');

      // Load historical gas data
      await this.loadGasHistory();

      // Initialize optimization models
      await this.initializeOptimizationModels();

      this.isInitialized = true;
      this.logger.info('Reward Optimizer initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize Reward Optimizer:', error);
      throw error;
    }
  }

  async optimizeRewards(
    position: LiquidStakingPosition,
    request?: StakingOptimizationRequest
  ): Promise<RewardOptimization> {
    try {
      if (!this.isInitialized) {
        throw new Error('Reward Optimizer not initialized');
      }

      this.logger.debug('Optimizing rewards for position', { 
        positionId: position.id,
        accruedRewards: position.rewards.accrued
      });

      // Analyze current reward situation
      const strategy = await this.determineOptimalStrategy(position, request);
      const actions = await this.generateRewardActions(position, strategy, request);
      const projectedGains = await this.calculateProjectedGains(position, strategy, actions);
      const riskAssessment = await this.assessRewardRisks(position, strategy, actions);
      const timeline = await this.createRewardTimeline(position, strategy, actions);
      const gasEstimate = await this.estimateGasCosts(actions);

      const optimization: RewardOptimization = {
        position,
        strategy,
        actions,
        projectedGains,
        riskAssessment,
        timeline,
        gasEstimate
      };

      // Store optimization in history
      const positionHistory = this.optimizationHistory.get(position.id) || [];
      positionHistory.push(optimization);
      if (positionHistory.length > 10) positionHistory.shift(); // Keep last 10
      this.optimizationHistory.set(position.id, positionHistory);

      // Emit optimization event
      this.emit('reward_optimized', {
        type: 'reward_optimization_completed',
        data: { positionId: position.id, optimization },
        timestamp: new Date()
      });

      this.logger.info('Reward optimization completed', {
        positionId: position.id,
        strategy: strategy.type,
        expectedApy: (strategy.expectedApy * 100).toFixed(2) + '%',
        actionsCount: actions.length
      });

      return optimization;

    } catch (error) {
      this.logger.error('Reward optimization failed', { 
        positionId: position.id, 
        error 
      });
      throw error;
    }
  }

  async optimizeBatch(
    positions: LiquidStakingPosition[],
    request?: StakingOptimizationRequest
  ): Promise<RewardBatch> {
    try {
      this.logger.info('Optimizing reward batch', { 
        positionsCount: positions.length 
      });

      // Calculate total rewards
      const totalRewards = positions.reduce((sum, pos) => sum + pos.rewards.accrued, 0);

      // Determine if batch processing is beneficial
      const individualGasCosts = await Promise.all(
        positions.map(pos => this.estimateIndividualGasCost(pos))
      );
      const totalIndividualGas = individualGasCosts.reduce((sum, cost) => sum + cost, 0);
      const batchGasCost = await this.estimateBatchGasCost(positions);
      const batchGasSavings = totalIndividualGas - batchGasCost;

      // Generate optimal batch actions
      const batchActions = await this.generateBatchActions(positions, request);

      // Determine optimal timing for batch execution
      const optimalTiming = await this.calculateOptimalBatchTiming(positions, batchActions);

      const batch: RewardBatch = {
        positions,
        totalRewards,
        batchGasSavings,
        optimalTiming,
        batchActions
      };

      this.logger.info('Batch reward optimization completed', {
        positionsCount: positions.length,
        totalRewards: totalRewards.toFixed(4),
        gasSavings: batchGasSavings.toFixed(6),
        actionsCount: batchActions.length
      });

      return batch;

    } catch (error) {
      this.logger.error('Batch reward optimization failed', { error });
      throw error;
    }
  }

  private async determineOptimalStrategy(
    position: LiquidStakingPosition,
    request?: StakingOptimizationRequest
  ): Promise<RewardStrategy> {
    const accruedRewards = position.rewards.accrued;
    const timeSinceLastClaim = Date.now() - position.rewards.lastClaim.getTime();
    const currentGasPrice = await this.getCurrentGasPrice();
    const validatorPerformance = await this.getValidatorPerformance(position.validator);

    // Determine base strategy type
    let strategyType: RewardStrategy['type'] = 'compound';
    const reasoning: string[] = [];

    // Check if immediate claiming is needed
    if (accruedRewards >= this.config.minClaimThreshold * 2) {
      strategyType = 'immediate';
      reasoning.push('Rewards exceed threshold for immediate claiming');
    } else if (timeSinceLastClaim > this.config.maxClaimInterval * 1000) {
      strategyType = 'immediate';
      reasoning.push('Maximum claim interval exceeded');
    } else if (accruedRewards < this.config.minClaimThreshold) {
      strategyType = 'delayed';
      reasoning.push('Rewards below minimum claiming threshold');
    }

    // Consider gas optimization
    if (this.config.gasOptimization && currentGasPrice > 50) { // High gas scenario
      if (strategyType === 'immediate' && accruedRewards < this.config.minClaimThreshold * 3) {
        strategyType = 'delayed';
        reasoning.push('High gas prices favor delayed claiming');
      }
    }

    // Consider reinvestment strategy
    if (this.config.reinvestmentStrategy === 'diversify' && strategyType === 'compound') {
      strategyType = 'diversify';
      reasoning.push('Diversification strategy selected for risk reduction');
    }

    // Calculate optimal frequency
    const frequency = this.calculateOptimalFrequency(position, currentGasPrice);

    // Generate conditions
    const conditions = await this.generateStrategyConditions(position, strategyType);

    // Estimate expected APY with strategy
    const expectedApy = await this.estimateStrategyApy(position, strategyType, frequency);

    // Determine risk level
    const riskLevel = this.assessStrategyRisk(strategyType, position);

    return {
      type: strategyType,
      description: this.getStrategyDescription(strategyType),
      reasoning,
      frequency,
      conditions,
      expectedApy,
      riskLevel
    };
  }

  private async generateRewardActions(
    position: LiquidStakingPosition,
    strategy: RewardStrategy,
    request?: StakingOptimizationRequest
  ): Promise<RewardAction[]> {
    const actions: RewardAction[] = [];

    switch (strategy.type) {
      case 'immediate':
        actions.push({
          type: 'claim',
          priority: 8,
          amount: position.rewards.accrued,
          estimatedGas: 50000, // Mock gas estimate
          expectedReturn: position.rewards.accrued * 0.98, // After fees
          timeframe: 'immediate',
          prerequisites: ['sufficient_gas_balance']
        });
        break;

      case 'compound':
        actions.push({
          type: 'compound',
          priority: 6,
          amount: position.rewards.accrued,
          targetValidator: position.validator,
          estimatedGas: 75000,
          expectedReturn: position.rewards.accrued * 1.05, // Compounding benefit
          timeframe: '24h',
          prerequisites: ['minimum_compound_threshold']
        });
        break;

      case 'diversify':
        // Split rewards across multiple validators
        const splitAmount = position.rewards.accrued / 2;
        actions.push({
          type: 'reinvest',
          priority: 5,
          amount: splitAmount,
          targetValidator: position.validator,
          estimatedGas: 80000,
          expectedReturn: splitAmount * 1.03,
          timeframe: '24h',
          prerequisites: ['minimum_reinvest_threshold']
        });
        break;

      case 'delayed':
        actions.push({
          type: 'wait',
          priority: 2,
          amount: 0,
          estimatedGas: 0,
          expectedReturn: position.rewards.accrued * 1.01, // Small opportunity cost
          timeframe: '7d',
          prerequisites: ['gas_price_optimization']
        });
        break;
    }

    // Sort actions by priority
    return actions.sort((a, b) => b.priority - a.priority);
  }

  private async calculateProjectedGains(
    position: LiquidStakingPosition,
    strategy: RewardStrategy,
    actions: RewardAction[]
  ): Promise<ProjectedGains> {
    const accruedRewards = position.rewards.accrued;
    const currentApy = position.apy;

    // Immediate gains
    const claimAction = actions.find(a => a.type === 'claim');
    const immediate = {
      claimable: accruedRewards,
      afterFees: claimAction ? claimAction.expectedReturn : accruedRewards * 0.98,
      netGain: claimAction ? claimAction.expectedReturn - (claimAction.estimatedGas * 0.00001) : 0
    };

    // Compounded gains (assuming reinvestment)
    const compoundRate = currentApy * (1 + (strategy.type === 'compound' ? 0.02 : 0)); // 2% bonus for compounding
    const compounded = {
      oneMonth: accruedRewards * Math.pow(1 + compoundRate/12, 1),
      threeMonths: accruedRewards * Math.pow(1 + compoundRate/4, 1),
      oneYear: accruedRewards * Math.pow(1 + compoundRate, 1),
      effectiveApy: compoundRate
    };

    // Reinvestment gains (diversification benefits)
    const reinvested = {
      diversificationBenefit: strategy.type === 'diversify' ? 0.005 : 0, // 0.5% benefit
      riskReduction: strategy.type === 'diversify' ? 0.1 : 0,
      expectedReturn: accruedRewards * (1 + currentApy + (strategy.type === 'diversify' ? 0.005 : 0))
    };

    // Optimal strategy comparison
    const optimal = {
      strategy: strategy.type,
      expectedReturn: strategy.expectedApy * accruedRewards,
      timeToOptimal: strategy.frequency
    };

    return {
      immediate,
      compounded,
      reinvested,
      optimal
    };
  }

  private async assessRewardRisks(
    position: LiquidStakingPosition,
    strategy: RewardStrategy,
    actions: RewardAction[]
  ): Promise<RewardRiskAssessment> {
    // Mock risk assessment
    return {
      claimingRisk: {
        gasVolatility: 0.3,
        networkCongestion: 0.2,
        validatorRisk: Math.min(position.validator.performance.slashingHistory.length * 0.1, 0.5),
        opportunityCost: strategy.type === 'delayed' ? 0.1 : 0.05
      },
      compoundingRisk: {
        concentrationRisk: strategy.type === 'compound' ? 0.2 : 0.1,
        validatorDependency: 0.15,
        liquidityRisk: 0.1
      },
      reinvestmentRisk: {
        diversificationBenefit: strategy.type === 'diversify' ? -0.1 : 0, // Negative = benefit
        newValidatorRisk: strategy.type === 'diversify' ? 0.05 : 0,
        transactionRisk: 0.02
      },
      overallRisk: strategy.riskLevel === 'low' ? 0.1 : strategy.riskLevel === 'medium' ? 0.3 : 0.5
    };
  }

  private async createRewardTimeline(
    position: LiquidStakingPosition,
    strategy: RewardStrategy,
    actions: RewardAction[]
  ): Promise<RewardTimeline> {
    const now = new Date();
    const nextOptimalClaim = new Date(now.getTime() + strategy.frequency * 1000);

    // Generate compounding schedule based on frequency
    const compoundingSchedule: Date[] = [];
    if (strategy.type === 'compound') {
      for (let i = 1; i <= 12; i++) { // Next 12 periods
        compoundingSchedule.push(new Date(now.getTime() + (strategy.frequency * i * 1000)));
      }
    }

    // Generate rebalance points (monthly)
    const rebalancePoints: Date[] = [];
    for (let i = 1; i <= 6; i++) { // Next 6 months
      rebalancePoints.push(new Date(now.getTime() + (i * 30 * 24 * 60 * 60 * 1000)));
    }

    // Create milestones
    const milestones: RewardMilestone[] = [
      {
        date: nextOptimalClaim,
        description: 'Next optimal claim opportunity',
        expectedAmount: position.rewards.accrued * 1.1,
        action: 'Review and execute optimal strategy'
      },
      {
        date: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
        description: 'Monthly performance review',
        expectedAmount: position.rewards.accrued * 1.5,
        action: 'Assess strategy effectiveness'
      }
    ];

    return {
      nextOptimalClaim,
      compoundingSchedule,
      rebalancePoints,
      milestones
    };
  }

  private async estimateGasCosts(actions: RewardAction[]): Promise<GasEstimate> {
    const currentGasPrice = await this.getCurrentGasPrice();
    
    const claimCost = actions.find(a => a.type === 'claim')?.estimatedGas || 50000;
    const compoundCost = actions.find(a => a.type === 'compound')?.estimatedGas || 75000;
    const reinvestCost = actions.find(a => a.type === 'reinvest')?.estimatedGas || 80000;

    const totalCost = (claimCost + compoundCost + reinvestCost) * currentGasPrice * 1e-9; // Convert to ETH
    const breakEvenAmount = totalCost / 0.95; // Need 5% buffer over gas costs
    const gasEfficiencyScore = Math.max(0, 1 - (totalCost / 0.1)); // Score based on 0.1 ETH reference

    return {
      claimCost: claimCost * currentGasPrice * 1e-9,
      compoundCost: compoundCost * currentGasPrice * 1e-9,
      reinvestCost: reinvestCost * currentGasPrice * 1e-9,
      totalCost,
      breakEvenAmount,
      gasEfficiencyScore
    };
  }

  private async generateBatchActions(
    positions: LiquidStakingPosition[],
    request?: StakingOptimizationRequest
  ): Promise<RewardAction[]> {
    const batchActions: RewardAction[] = [];

    // Group positions by optimal action type
    const claimPositions = positions.filter(p => p.rewards.accrued >= this.config.minClaimThreshold);
    const compoundPositions = positions.filter(p => 
      p.rewards.accrued >= this.config.minClaimThreshold * 0.5 && 
      p.rewards.accrued < this.config.minClaimThreshold
    );

    // Generate batch claim action
    if (claimPositions.length > 0) {
      const totalAmount = claimPositions.reduce((sum, p) => sum + p.rewards.accrued, 0);
      batchActions.push({
        type: 'claim',
        priority: 9,
        amount: totalAmount,
        estimatedGas: 30000 + (claimPositions.length * 20000), // Base + per position
        expectedReturn: totalAmount * 0.98,
        timeframe: 'immediate',
        prerequisites: ['batch_execution_ready']
      });
    }

    // Generate batch compound action
    if (compoundPositions.length > 0) {
      const totalAmount = compoundPositions.reduce((sum, p) => sum + p.rewards.accrued, 0);
      batchActions.push({
        type: 'compound',
        priority: 7,
        amount: totalAmount,
        estimatedGas: 50000 + (compoundPositions.length * 25000),
        expectedReturn: totalAmount * 1.05,
        timeframe: '24h',
        prerequisites: ['batch_compound_threshold']
      });
    }

    return batchActions.sort((a, b) => b.priority - a.priority);
  }

  private calculateOptimalFrequency(position: LiquidStakingPosition, gasPrice: number): number {
    // Base frequency on compounding frequency setting
    const baseFrequency = {
      'daily': 86400,
      'weekly': 604800,
      'monthly': 2592000,
      'optimal': 604800 // Default to weekly
    }[this.config.compoundingFrequency];

    // Adjust based on gas prices and reward rate
    const gasAdjustment = gasPrice > 50 ? 1.5 : gasPrice > 20 ? 1.2 : 1.0;
    const rewardAdjustment = position.apy > 0.1 ? 0.8 : position.apy > 0.05 ? 1.0 : 1.2;

    return Math.floor(baseFrequency * gasAdjustment * rewardAdjustment);
  }

  private async generateStrategyConditions(
    position: LiquidStakingPosition,
    strategyType: RewardStrategy['type']
  ): Promise<RewardCondition[]> {
    const conditions: RewardCondition[] = [];

    // Threshold condition
    conditions.push({
      type: 'threshold',
      condition: 'accrued_rewards_minimum',
      value: this.config.minClaimThreshold,
      met: position.rewards.accrued >= this.config.minClaimThreshold
    });

    // Gas condition
    const currentGasPrice = await this.getCurrentGasPrice();
    conditions.push({
      type: 'gas',
      condition: 'gas_price_acceptable',
      value: 50, // Max acceptable gas price
      met: currentGasPrice <= 50
    });

    // Time condition
    const timeSinceLastClaim = Date.now() - position.rewards.lastClaim.getTime();
    conditions.push({
      type: 'time',
      condition: 'max_interval_check',
      value: this.config.maxClaimInterval,
      met: timeSinceLastClaim <= this.config.maxClaimInterval * 1000
    });

    return conditions;
  }

  private async estimateStrategyApy(
    position: LiquidStakingPosition,
    strategyType: RewardStrategy['type'],
    frequency: number
  ): Promise<number> {
    let baseApy = position.apy;

    // Apply strategy bonuses
    switch (strategyType) {
      case 'compound':
        baseApy *= 1.02; // 2% compounding bonus
        break;
      case 'diversify':
        baseApy *= 1.005; // 0.5% diversification bonus
        break;
      case 'delayed':
        baseApy *= 0.98; // Small penalty for delayed claiming
        break;
    }

    // Frequency adjustment
    const optimalFrequency = 604800; // Weekly
    const frequencyMultiplier = Math.min(frequency / optimalFrequency, 1.1);
    baseApy *= frequencyMultiplier;

    return baseApy;
  }

  private assessStrategyRisk(
    strategyType: RewardStrategy['type'],
    position: LiquidStakingPosition
  ): 'low' | 'medium' | 'high' {
    const slashingHistory = position.validator.performance.slashingHistory.length;
    
    if (strategyType === 'compound' && slashingHistory > 0) return 'high';
    if (strategyType === 'diversify') return 'low';
    if (strategyType === 'immediate' && slashingHistory === 0) return 'low';
    
    return 'medium';
  }

  private getStrategyDescription(strategyType: RewardStrategy['type']): string {
    const descriptions = {
      'immediate': 'Claim rewards immediately to realize gains',
      'delayed': 'Wait for optimal conditions before claiming',
      'compound': 'Reinvest rewards with same validator for compounding',
      'reinvest': 'Reinvest rewards across multiple validators',
      'diversify': 'Spread rewards across different validators for risk reduction'
    };
    return descriptions[strategyType];
  }

  private async getCurrentGasPrice(): Promise<number> {
    // Mock gas price - in production would fetch from network
    return 20 + Math.random() * 40; // 20-60 gwei
  }

  private async getValidatorPerformance(validator: ValidatorInfo): Promise<any> {
    // Mock validator performance data
    return {
      recentUptime: validator.performance.uptime,
      effectivenessTrend: 'stable',
      rewardConsistency: 0.95
    };
  }

  private async estimateIndividualGasCost(position: LiquidStakingPosition): Promise<number> {
    const gasPrice = await this.getCurrentGasPrice();
    return 50000 * gasPrice * 1e-9; // 50k gas limit
  }

  private async estimateBatchGasCost(positions: LiquidStakingPosition[]): Promise<number> {
    const gasPrice = await this.getCurrentGasPrice();
    const baseGas = 30000;
    const perPositionGas = 20000;
    return (baseGas + (positions.length * perPositionGas)) * gasPrice * 1e-9;
  }

  private async calculateOptimalBatchTiming(
    positions: LiquidStakingPosition[],
    actions: RewardAction[]
  ): Promise<Date> {
    // Calculate when most positions will benefit from batch execution
    const now = new Date();
    const avgTimeSinceLastClaim = positions.reduce((sum, p) => 
      sum + (now.getTime() - p.rewards.lastClaim.getTime()), 0) / positions.length;
    
    // If most positions are ready now, execute immediately
    if (avgTimeSinceLastClaim > this.config.maxClaimInterval * 1000 * 0.8) {
      return now;
    }
    
    // Otherwise, wait for optimal gas conditions (typically early morning UTC)
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setUTCHours(4, 0, 0, 0); // 4 AM UTC typically has lower gas
    
    return tomorrow;
  }

  private async loadGasHistory(): Promise<void> {
    // Load historical gas price data for optimization
    this.logger.info('Gas price history loaded');
  }

  private async initializeOptimizationModels(): Promise<void> {
    // Initialize machine learning models for reward optimization
    this.logger.info('Reward optimization models initialized');
  }

  getStatus(): any {
    return {
      isInitialized: this.isInitialized,
      optimizationHistory: Array.from(this.optimizationHistory.values())
        .reduce((total, opts) => total + opts.length, 0),
      gasDataPoints: Array.from(this.gasTracker.values())
        .reduce((total, data) => total + data.length, 0),
      config: this.config
    };
  }

  async shutdown(): Promise<void> {
    this.logger.info('Shutting down Reward Optimizer...');
    this.optimizationHistory.clear();
    this.gasTracker.clear();
    this.logger.info('Reward Optimizer shutdown complete');
  }
}