/**
 * Liquid Staking Manager
 * Manages liquid staking positions and validator selection optimization
 */

import { EventEmitter } from 'events';
import { Logger } from 'winston';
import { createLogger, format, transports } from 'winston';
import { 
  LiquidStakingPosition,
  ValidatorInfo,
  StakingOptimizationRequest,
  SlashingEvent,
  LiquidStakingConfig
} from '../types';

export interface LiquidStakingManagerConfig {
  enableAutoStaking: boolean;
  defaultValidatorSelection: 'performance' | 'diversification' | 'commission' | 'random';
  maxValidatorsPerAsset: number;
  rebalanceFrequency: number;
  slashingProtection: boolean;
  enableLiquidityTokens: boolean;
  autoClaimRewards: boolean;
  reinvestRewards: boolean;
  minStakeAmount: number;
  validatorDiversification: boolean;
  performanceThreshold: number;
}

export class LiquidStakingManager extends EventEmitter {
  private static instance: LiquidStakingManager;
  private logger: Logger;
  private config: LiquidStakingManagerConfig;
  private isInitialized: boolean = false;
  private isAutoStaking: boolean = false;

  // Staking state
  private validatorRegistry: Map<string, ValidatorInfo> = new Map();
  private stakingPositions: Map<string, LiquidStakingPosition> = new Map();
  private performanceHistory: Map<string, any[]> = new Map();
  private rebalanceInterval?: NodeJS.Timeout;

  private constructor(config: LiquidStakingManagerConfig) {
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
        new transports.File({ filename: 'logs/liquid-staking.log' })
      ],
    });
  }

  static getInstance(config?: LiquidStakingManagerConfig): LiquidStakingManager {
    if (!LiquidStakingManager.instance && config) {
      LiquidStakingManager.instance = new LiquidStakingManager(config);
    } else if (!LiquidStakingManager.instance) {
      throw new Error('LiquidStakingManager must be initialized with config first');
    }
    return LiquidStakingManager.instance;
  }

  async initialize(): Promise<void> {
    try {
      this.logger.info('Initializing Liquid Staking Manager...');

      // Load validator registry
      await this.loadValidatorRegistry();

      // Load existing staking positions
      await this.loadStakingPositions();

      // Initialize performance tracking
      await this.initializePerformanceTracking();

      this.isInitialized = true;
      this.logger.info('Liquid Staking Manager initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize Liquid Staking Manager:', error);
      throw error;
    }
  }

  async startAutoStaking(): Promise<void> {
    try {
      if (!this.isInitialized) {
        throw new Error('Liquid Staking Manager not initialized');
      }

      this.logger.info('Starting auto staking...');
      this.isAutoStaking = true;

      // Start periodic rebalancing
      if (this.config.rebalanceFrequency > 0) {
        this.rebalanceInterval = setInterval(
          () => this.performRebalance(),
          this.config.rebalanceFrequency
        );
      }

      // Start reward claiming if enabled
      if (this.config.autoClaimRewards) {
        setInterval(() => this.claimAllRewards(), 86400000); // Daily
      }

      this.logger.info('Auto staking started successfully');
    } catch (error) {
      this.logger.error('Failed to start auto staking:', error);
      throw error;
    }
  }

  async stopAutoStaking(): Promise<void> {
    try {
      this.logger.info('Stopping auto staking...');
      this.isAutoStaking = false;

      if (this.rebalanceInterval) {
        clearInterval(this.rebalanceInterval);
      }

      this.logger.info('Auto staking stopped successfully');
    } catch (error) {
      this.logger.error('Failed to stop auto staking:', error);
      throw error;
    }
  }

  async getAvailableValidators(asset: string): Promise<ValidatorInfo[]> {
    try {
      // Filter validators by asset/chain
      const validators = Array.from(this.validatorRegistry.values())
        .filter(validator => this.supportsAsset(validator, asset));

      // Sort by performance score
      return validators.sort((a, b) => {
        const scoreA = this.calculateValidatorScore(a);
        const scoreB = this.calculateValidatorScore(b);
        return scoreB - scoreA;
      });
    } catch (error) {
      this.logger.error('Failed to get available validators:', error);
      throw error;
    }
  }

  filterValidators(
    validators: ValidatorInfo[],
    request: StakingOptimizationRequest
  ): ValidatorInfo[] {
    return validators.filter(validator => {
      // Commission filter
      if (validator.commission > request.preferences.maxCommission) {
        return false;
      }

      // Performance filter
      if (validator.performance.effectiveness < this.config.performanceThreshold) {
        return false;
      }

      // Slashing tolerance
      const recentSlashing = this.getRecentSlashingEvents(validator, 365); // Last year
      const slashingScore = this.calculateSlashingScore(recentSlashing);
      if (slashingScore > request.constraints.slashingTolerance) {
        return false;
      }

      // Preferred validators
      if (request.preferences.preferredValidators.length > 0 &&
          !request.preferences.preferredValidators.includes(validator.id)) {
        return false;
      }

      return true;
    });
  }

  async optimizeAllocation(
    request: StakingOptimizationRequest,
    validators: ValidatorInfo[]
  ): Promise<LiquidStakingPosition[]> {
    try {
      this.logger.info('Optimizing staking allocation', {
        asset: request.asset,
        amount: request.amount,
        validatorCount: validators.length
      });

      // Select optimal validators
      const selectedValidators = this.selectOptimalValidators(validators, request);

      // Calculate allocation weights
      const allocations = this.calculateAllocationWeights(selectedValidators, request);

      // Create staking positions
      const positions: LiquidStakingPosition[] = [];

      for (let i = 0; i < selectedValidators.length; i++) {
        const validator = selectedValidators[i];
        const allocationAmount = request.amount * allocations[i];

        if (allocationAmount >= request.constraints.minStakePerValidator) {
          const position = await this.createStakingPosition(
            validator,
            request.asset,
            allocationAmount
          );
          positions.push(position);
          this.stakingPositions.set(position.id, position);
        }
      }

      // Emit staking optimization event
      this.emit('staking_optimized', {
        type: 'staking_optimization_completed',
        data: {
          request,
          positions,
          validators: selectedValidators
        },
        timestamp: new Date()
      });

      this.logger.info('Staking allocation optimized', {
        positionsCreated: positions.length,
        totalStaked: positions.reduce((sum, p) => sum + p.amount, 0)
      });

      return positions;
    } catch (error) {
      this.logger.error('Failed to optimize staking allocation:', error);
      throw error;
    }
  }

  async checkPerformance(position: LiquidStakingPosition): Promise<void> {
    try {
      const validator = this.validatorRegistry.get(position.validator.id);
      if (!validator) return;

      // Check validator performance
      const currentScore = this.calculateValidatorScore(validator);
      const positionAge = Date.now() - position.createdAt.getTime();

      // Check for performance degradation
      if (currentScore < this.config.performanceThreshold && positionAge > 604800000) { // 1 week
        this.logger.warn('Validator performance degraded', {
          positionId: position.id,
          validatorId: validator.id,
          currentScore,
          threshold: this.config.performanceThreshold
        });

        // Emit alert
        this.emit('performance_alert', {
          type: 'validator_performance_degraded',
          positionId: position.id,
          validatorId: validator.id,
          currentScore,
          recommendation: 'consider_unstaking'
        });
      }

      // Check for slashing events
      const recentSlashing = this.getRecentSlashingEvents(validator, 30); // Last 30 days
      if (recentSlashing.length > 0) {
        this.logger.warn('Recent slashing detected', {
          positionId: position.id,
          validatorId: validator.id,
          slashingEvents: recentSlashing.length
        });

        // Update position status if severely slashed
        const totalSlashed = recentSlashing.reduce((sum, event) => sum + event.amount, 0);
        if (totalSlashed > position.amount * 0.01) { // More than 1% slashed
          position.status = 'slashed';
          this.stakingPositions.set(position.id, position);
        }
      }

      // Update performance history
      this.updatePerformanceHistory(position, validator);
    } catch (error) {
      this.logger.error('Failed to check staking performance:', error);
    }
  }

  private selectOptimalValidators(
    validators: ValidatorInfo[],
    request: StakingOptimizationRequest
  ): ValidatorInfo[] {
    const maxValidators = Math.min(
      request.constraints.maxValidators,
      this.config.maxValidatorsPerAsset
    );

    if (!request.preferences.diversification || validators.length <= maxValidators) {
      return validators.slice(0, maxValidators);
    }

    // Diversified selection algorithm
    const selected: ValidatorInfo[] = [];
    const remaining = [...validators];

    // Always select the top performer
    if (remaining.length > 0) {
      selected.push(remaining.shift()!);
    }

    // Diversify by performance tiers and other factors
    while (selected.length < maxValidators && remaining.length > 0) {
      let bestCandidate = remaining[0];
      let bestDiversityScore = this.calculateDiversityScore(bestCandidate, selected);

      for (const candidate of remaining) {
        const diversityScore = this.calculateDiversityScore(candidate, selected);
        if (diversityScore > bestDiversityScore) {
          bestCandidate = candidate;
          bestDiversityScore = diversityScore;
        }
      }

      selected.push(bestCandidate);
      remaining.splice(remaining.indexOf(bestCandidate), 1);
    }

    return selected;
  }

  private calculateAllocationWeights(
    validators: ValidatorInfo[],
    request: StakingOptimizationRequest
  ): number[] {
    if (validators.length === 0) return [];

    const scores = validators.map(v => this.calculateValidatorScore(v));
    const totalScore = scores.reduce((sum, score) => sum + score, 0);

    // Base allocation on performance scores
    const baseWeights = scores.map(score => score / totalScore);

    // Apply diversification if requested
    if (request.preferences.diversification) {
      const maxWeight = 1 / validators.length * 2; // Max 2x equal weight
      const adjustedWeights = baseWeights.map(weight => Math.min(weight, maxWeight));
      
      // Redistribute excess weight
      const totalAdjusted = adjustedWeights.reduce((sum, w) => sum + w, 0);
      return adjustedWeights.map(w => w / totalAdjusted);
    }

    return baseWeights;
  }

  private async createStakingPosition(
    validator: ValidatorInfo,
    asset: string,
    amount: number
  ): Promise<LiquidStakingPosition> {
    const position: LiquidStakingPosition = {
      id: `stake_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      validator,
      asset,
      amount,
      stakingToken: this.getLiquidStakingToken(asset, validator),
      apy: this.calculateStakingApy(validator, asset),
      commission: validator.commission,
      slashingRisk: this.calculateSlashingRisk(validator),
      withdrawalDelay: this.getWithdrawalDelay(asset),
      rewards: {
        accrued: 0,
        claimed: 0,
        lastClaim: new Date()
      },
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.logger.info('Created staking position', {
      positionId: position.id,
      validatorId: validator.id,
      amount,
      apy: position.apy
    });

    return position;
  }

  private calculateValidatorScore(validator: ValidatorInfo): number {
    const factors = {
      uptime: validator.performance.uptime,
      effectiveness: validator.performance.effectiveness,
      commission: 1 - validator.commission, // Lower commission = higher score
      reputation: validator.reputation.score,
      slashing: 1 - this.calculateSlashingPenalty(validator),
      delegation: this.calculateDelegationScore(validator)
    };

    const weights = {
      uptime: 0.25,
      effectiveness: 0.25,
      commission: 0.2,
      reputation: 0.15,
      slashing: 0.1,
      delegation: 0.05
    };

    return Object.entries(factors).reduce((score, [key, value]) => {
      const weight = weights[key as keyof typeof weights] || 0;
      return score + (value * weight);
    }, 0);
  }

  private calculateDiversityScore(
    candidate: ValidatorInfo,
    selected: ValidatorInfo[]
  ): number {
    if (selected.length === 0) return 1;

    // Calculate diversity based on various factors
    let diversityScore = 1;

    // Commission diversity
    const commissions = selected.map(v => v.commission);
    const commissionDiff = Math.min(...commissions.map(c => Math.abs(c - candidate.commission)));
    diversityScore *= (1 + commissionDiff * 2); // Reward different commission rates

    // Performance tier diversity
    const performanceScore = this.calculateValidatorScore(candidate);
    const selectedScores = selected.map(v => this.calculateValidatorScore(v));
    const scoreDiff = Math.min(...selectedScores.map(s => Math.abs(s - performanceScore)));
    diversityScore *= (1 + scoreDiff);

    // Geographic/infrastructure diversity (if available)
    // This would require additional validator metadata

    return diversityScore;
  }

  private calculateSlashingPenalty(validator: ValidatorInfo): number {
    const recentSlashing = this.getRecentSlashingEvents(validator, 365); // Last year
    if (recentSlashing.length === 0) return 0;

    // Calculate penalty based on frequency and severity
    const totalSlashed = recentSlashing.reduce((sum, event) => {
      const severityMultiplier = event.severity === 'critical' ? 3 : 
                                event.severity === 'major' ? 2 : 1;
      return sum + (event.amount * severityMultiplier);
    }, 0);

    return Math.min(totalSlashed / validator.delegation.totalStaked, 0.5); // Cap at 50% penalty
  }

  private calculateDelegationScore(validator: ValidatorInfo): number {
    // Optimal delegation is neither too low nor too high
    const utilizationRate = validator.delegation.totalStaked / validator.delegation.maxDelegation;
    
    if (utilizationRate < 0.1) return 0.3; // Too low
    if (utilizationRate > 0.9) return 0.5; // Too high, may be overcrowded
    
    // Optimal range 30-70% utilization
    if (utilizationRate >= 0.3 && utilizationRate <= 0.7) return 1;
    
    // Linear scaling for other ranges
    return 0.7 + (0.3 * (1 - Math.abs(utilizationRate - 0.5) / 0.5));
  }

  private getRecentSlashingEvents(validator: ValidatorInfo, days: number): SlashingEvent[] {
    const cutoff = new Date(Date.now() - (days * 24 * 60 * 60 * 1000));
    return validator.performance.slashingHistory.filter(event => event.date >= cutoff);
  }

  private calculateSlashingScore(events: SlashingEvent[]): number {
    if (events.length === 0) return 0;

    return events.reduce((score, event) => {
      const severityScore = event.severity === 'critical' ? 1 : 
                           event.severity === 'major' ? 0.6 : 0.2;
      return score + severityScore;
    }, 0);
  }

  private supportsAsset(validator: ValidatorInfo, asset: string): boolean {
    // Check if validator supports the specific asset/chain
    // This would depend on the validator's chain and asset support
    const chainAssetMap: Record<string, string[]> = {
      'ethereum': ['ETH'],
      'cosmos': ['ATOM'],
      'solana': ['SOL'],
      'polkadot': ['DOT'],
      'cardano': ['ADA']
    };

    const supportedAssets = chainAssetMap[validator.chain] || [];
    return supportedAssets.includes(asset);
  }

  private getLiquidStakingToken(asset: string, validator: ValidatorInfo): string {
    // Return liquid staking token symbol
    const tokenMap: Record<string, string> = {
      'ETH': 'stETH', // Lido
      'ATOM': 'stATOM',
      'SOL': 'stSOL',
      'DOT': 'stDOT',
      'ADA': 'stADA'
    };

    return tokenMap[asset] || `st${asset}`;
  }

  private calculateStakingApy(validator: ValidatorInfo, asset: string): number {
    // Calculate APY based on network rewards and validator performance
    const baseApy = this.getNetworkBaseApy(asset);
    const performanceMultiplier = validator.performance.effectiveness;
    const commissionAdjustment = 1 - validator.commission;

    return baseApy * performanceMultiplier * commissionAdjustment;
  }

  private getNetworkBaseApy(asset: string): number {
    // Network base APY rates (would be fetched from real data)
    const baseApys: Record<string, number> = {
      'ETH': 0.04, // 4%
      'ATOM': 0.18, // 18%
      'SOL': 0.07, // 7%
      'DOT': 0.12, // 12%
      'ADA': 0.05 // 5%
    };

    return baseApys[asset] || 0.05;
  }

  private calculateSlashingRisk(validator: ValidatorInfo): number {
    const recentSlashing = this.getRecentSlashingEvents(validator, 365);
    const slashingFrequency = recentSlashing.length / 365; // Events per day
    const maxSlashingRisk = Math.max(...recentSlashing.map(e => e.amount), 0);
    
    return Math.min((slashingFrequency * 100) + (maxSlashingRisk * 10), 1);
  }

  private getWithdrawalDelay(asset: string): number {
    // Withdrawal delay in seconds for different assets
    const delays: Record<string, number> = {
      'ETH': 1209600, // 14 days
      'ATOM': 1814400, // 21 days
      'SOL': 259200,   // 3 days
      'DOT': 2419200,  // 28 days
      'ADA': 1728000   // 20 days
    };

    return delays[asset] || 1209600; // Default 14 days
  }

  private async performRebalance(): Promise<void> {
    try {
      this.logger.info('Performing staking rebalance...');

      for (const position of this.stakingPositions.values()) {
        await this.checkPerformance(position);
        
        // Check if position needs rebalancing
        const validator = this.validatorRegistry.get(position.validator.id);
        if (!validator) continue;

        const currentScore = this.calculateValidatorScore(validator);
        if (currentScore < this.config.performanceThreshold * 0.8) {
          // Consider moving stake to better validator
          this.logger.info('Considering stake migration', {
            positionId: position.id,
            currentScore,
            threshold: this.config.performanceThreshold
          });
        }
      }
    } catch (error) {
      this.logger.error('Rebalance failed:', error);
    }
  }

  private async claimAllRewards(): Promise<void> {
    try {
      this.logger.info('Claiming all staking rewards...');

      for (const position of this.stakingPositions.values()) {
        if (position.status === 'active') {
          // Mock reward claiming
          position.rewards.claimed += position.rewards.accrued;
          position.rewards.accrued = 0;
          position.rewards.lastClaim = new Date();
          position.updatedAt = new Date();

          // Reinvest if enabled
          if (this.config.reinvestRewards && position.rewards.claimed > this.config.minStakeAmount) {
            this.logger.info('Reinvesting rewards', {
              positionId: position.id,
              amount: position.rewards.claimed
            });
            
            position.amount += position.rewards.claimed;
            position.rewards.claimed = 0;
          }

          this.stakingPositions.set(position.id, position);
        }
      }
    } catch (error) {
      this.logger.error('Failed to claim rewards:', error);
    }
  }

  private updatePerformanceHistory(position: LiquidStakingPosition, validator: ValidatorInfo): void {
    const history = this.performanceHistory.get(position.id) || [];
    
    history.push({
      timestamp: new Date(),
      validatorScore: this.calculateValidatorScore(validator),
      apy: position.apy,
      rewards: position.rewards.accrued,
      uptime: validator.performance.uptime,
      effectiveness: validator.performance.effectiveness
    });

    // Keep only last 90 days of history
    const cutoff = Date.now() - (90 * 24 * 60 * 60 * 1000);
    const filteredHistory = history.filter(entry => entry.timestamp.getTime() > cutoff);
    
    this.performanceHistory.set(position.id, filteredHistory);
  }

  private async loadValidatorRegistry(): Promise<void> {
    // TODO: Load validators from external sources
    // For now, create mock validators
    const mockValidators = this.createMockValidators();
    mockValidators.forEach(validator => {
      this.validatorRegistry.set(validator.id, validator);
    });

    this.logger.info(`Loaded ${mockValidators.length} validators`);
  }

  private async loadStakingPositions(): Promise<void> {
    // TODO: Load existing positions from storage
    this.logger.info('Loaded existing staking positions');
  }

  private async initializePerformanceTracking(): Promise<void> {
    // TODO: Initialize performance tracking systems
    this.logger.info('Performance tracking initialized');
  }

  private createMockValidators(): ValidatorInfo[] {
    // Create mock validators for testing
    const validators: ValidatorInfo[] = [];
    const chains = ['ethereum', 'cosmos', 'solana', 'polkadot'];
    
    for (let i = 0; i < 20; i++) {
      const chain = chains[i % chains.length];
      validators.push({
        id: `validator_${i}`,
        name: `Validator ${i}`,
        address: `0x${Math.random().toString(16).substring(2, 42)}`,
        chain,
        commission: 0.05 + (Math.random() * 0.1), // 5-15%
        performance: {
          uptime: 0.95 + (Math.random() * 0.05), // 95-100%
          effectiveness: 0.9 + (Math.random() * 0.1), // 90-100%
          slashingHistory: []
        },
        delegation: {
          totalStaked: 1000000 + (Math.random() * 10000000),
          delegatorCount: 100 + Math.floor(Math.random() * 1000),
          maxDelegation: 50000000
        },
        reputation: {
          score: 0.7 + (Math.random() * 0.3), // 70-100%
          reviews: Math.floor(Math.random() * 100),
          verified: Math.random() > 0.2 // 80% verified
        }
      });
    }

    return validators;
  }

  getStatus(): any {
    return {
      isInitialized: this.isInitialized,
      isRunning: this.isAutoStaking,
      validatorCount: this.validatorRegistry.size,
      activePositions: this.stakingPositions.size,
      totalStaked: Array.from(this.stakingPositions.values())
        .reduce((sum, pos) => sum + pos.amount, 0)
    };
  }

  async shutdown(): Promise<void> {
    try {
      this.logger.info('Shutting down Liquid Staking Manager...');

      await this.stopAutoStaking();
      this.validatorRegistry.clear();
      this.stakingPositions.clear();
      this.performanceHistory.clear();
      this.removeAllListeners();

      this.logger.info('Liquid Staking Manager shutdown complete');
    } catch (error) {
      this.logger.error('Failed to shutdown Liquid Staking Manager:', error);
      throw error;
    }
  }
}