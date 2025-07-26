/**
 * Multi-Chain Portfolio Coordination System
 * Comprehensive system for managing assets across multiple blockchains
 */

import Logger from '../../../shared/logging/logger';
import { BridgeSatelliteConfig } from '../bridge-satellite';
import { 
  CrossChainPortfolio, 
  LiquidityPosition,
  ChainID,
  AssetID,
  TransactionResult,
  ArbitrageExecution,
  ArbitrageOpportunity,
  BridgeID
} from '../types';

const logger = Logger.getLogger('multi-chain-coordinator');

interface ChainState {
  chainId: ChainID;
  isConnected: boolean;
  blockHeight: number;
  nativeBalance: number;
  gasPrice: number;
  lastUpdate: number;
  healthScore: number; // 0-100
}

interface AssetPosition {
  chainId: ChainID;
  assetId: AssetID;
  tokenAddress: string;
  balance: number;
  value: number;
  isLocked: boolean;
  lastUpdate: number;
  pendingTransactions: string[];
}

interface CoordinatedTransaction {
  id: string;
  type: 'rebalance' | 'arbitrage' | 'emergency' | 'optimization';
  chains: ChainID[];
  assets: AssetID[];
  estimatedTime: number;
  status: 'pending' | 'coordinating' | 'executing' | 'completed' | 'failed';
  transactions: TransactionResult[];
  dependencies: string[];
  priority: 'low' | 'medium' | 'high' | 'critical';
  createdAt: number;
  startTime?: number;
  endTime?: number;
  rollbackPlan?: CoordinatedTransaction;
}

interface RiskLimit {
  type: 'chain_exposure' | 'asset_concentration' | 'bridge_usage' | 'transaction_size';
  chainId?: ChainID;
  assetId?: AssetID;
  bridgeId?: BridgeID;
  maxPercentage?: number;
  maxAbsolute?: number;
  currentValue: number;
  isViolated: boolean;
}

interface PositionSizingRule {
  id: string;
  name: string;
  type: 'max_chain_exposure' | 'min_liquidity_reserve' | 'correlation_limit' | 'volatility_limit';
  condition: (portfolio: CrossChainPortfolio, position: LiquidityPosition) => boolean;
  maxSize: (portfolio: CrossChainPortfolio, chainId: ChainID, assetId: AssetID) => number;
  priority: number;
  isActive: boolean;
}

export class MultiChainCoordinator {
  private config: BridgeSatelliteConfig;
  private isRunning = false;
  private chainStates = new Map<ChainID, ChainState>();
  private assetPositions = new Map<string, AssetPosition>(); // key: chainId:assetId
  private coordinatedTransactions = new Map<string, CoordinatedTransaction>();
  private riskLimits: RiskLimit[] = [];
  private _positionSizingRules: PositionSizingRule[] = [];
  private portfolioCache?: CrossChainPortfolio;
  private lastPortfolioUpdate = 0;
  private coordinationInterval?: NodeJS.Timeout | undefined;
  private transactionQueue: CoordinatedTransaction[] = [];
  private readonly maxConcurrentTransactions = 3;
  private readonly portfolioCacheTimeout = 30000; // 30 seconds

  constructor(config: BridgeSatelliteConfig) {
    this.config = config;
    this.initializeRiskLimits();
    this.initializePositionSizingRules();
    logger.info('Multi-Chain Coordinator created');
  }

  async initialize(): Promise<void> {
    logger.info('Initializing Multi-Chain Coordinator...');
    
    // Initialize chain connections and states
    await this.initializeChainStates();
    
    // Load initial asset positions
    await this.loadAssetPositions();
    
    // Initialize portfolio state
    await this.updatePortfolioCache();
    
    logger.info('Multi-Chain Coordinator initialized successfully');
  }

  async start(): Promise<void> {
    if (this.isRunning) return;

    this.isRunning = true;
    
    // Start coordination loop
    this.coordinationInterval = setInterval(
      () => this.performCoordinationCycle(),
      30000 // 30 seconds
    );
    
    logger.info('Multi-Chain Coordinator started');
  }

  async stop(): Promise<void> {
    this.isRunning = false;
    
    if (this.coordinationInterval) {
      clearInterval(this.coordinationInterval);
      this.coordinationInterval = undefined;
    }
    
    // Wait for pending transactions to complete
    await this.waitForPendingTransactions();
    
    logger.info('Multi-Chain Coordinator stopped');
  }

  /**
   * Get current portfolio status across all chains
   */
  async getPortfolioStatus(): Promise<CrossChainPortfolio> {
    // Use cached portfolio if recent enough
    if (this.portfolioCache && 
        Date.now() - this.lastPortfolioUpdate < this.portfolioCacheTimeout) {
      return this.portfolioCache;
    }

    return this.updatePortfolioCache();
  }

  /**
   * Execute coordinated portfolio rebalancing
   */
  async rebalancePortfolio(
    targetDistribution?: Record<ChainID, number>,
    options?: {
      maxSlippage?: number;
      maxExecutionTime?: number;
      emergencyMode?: boolean;
    }
  ): Promise<boolean> {
    logger.info('Starting coordinated portfolio rebalancing...');

    try {
      const currentPortfolio = await this.getPortfolioStatus();
      const rebalanceTarget = targetDistribution || this.config.liquidity.targetDistribution;
      
      // Calculate required moves
      const rebalanceMoves = await this.calculateRebalanceMoves(currentPortfolio, rebalanceTarget);
      
      if (rebalanceMoves.length === 0) {
        logger.info('Portfolio already balanced, no rebalancing needed');
        return true;
      }

      // Validate moves against risk limits
      const validatedMoves = await this.validateTransactionAgainstRiskLimits(rebalanceMoves);
      
      if (validatedMoves.length === 0) {
        logger.warn('All rebalancing moves violate risk limits');
        return false;
      }

      // Create coordinated transaction
      const coordinatedTx = await this.createCoordinatedTransaction({
        type: 'rebalance',
        moves: validatedMoves,
        options
      });

      // Execute the coordinated transaction
      const success = await this.executeCoordinatedTransaction(coordinatedTx);
      
      if (success) {
        // Update portfolio cache
        await this.updatePortfolioCache();
        logger.info('Portfolio rebalancing completed successfully');
      } else {
        logger.error('Portfolio rebalancing failed');
      }

      return success;
    } catch (error) {
      logger.error('Error during portfolio rebalancing:', error);
      return false;
    }
  }

  /**
   * Execute coordinated arbitrage opportunity
   */
  async executeArbitrageOpportunity(
    opportunity: ArbitrageOpportunity,
    maxPositionSize?: number
  ): Promise<ArbitrageExecution> {
    logger.info(`Executing coordinated arbitrage opportunity: ${opportunity.id}`);

    // Validate opportunity against current portfolio state
    const portfolio = await this.getPortfolioStatus();
    const positionSize = this.calculateOptimalPositionSize(opportunity, portfolio, maxPositionSize);
    
    if (positionSize <= 0) {
      throw new Error('Cannot execute arbitrage: insufficient position size or risk violation');
    }

    // Create execution transaction
    const execution: ArbitrageExecution = {
      opportunityId: opportunity.id,
      executionPathId: opportunity.executionPaths[0]?.id || 'direct',
      status: 'initiated',
      transactions: [],
      startTime: Date.now()
    };

    try {
      // Lock required assets
      await this.lockAssetsForArbitrage(opportunity, positionSize);

      // Create coordinated transaction for arbitrage
      const coordinatedTx = await this.createArbitrageTransaction(opportunity, positionSize);
      
      execution.status = 'in_progress';
      
      // Execute the arbitrage
      const success = await this.executeCoordinatedTransaction(coordinatedTx);
      
      if (success) {
        execution.status = 'completed';
        execution.endTime = Date.now();
        execution.executionTime = execution.endTime - execution.startTime;
        execution.actualProfit = this.calculateActualProfit(coordinatedTx);
        execution.actualCost = this.calculateActualCost(coordinatedTx);
        execution.netReturn = execution.actualProfit - execution.actualCost;
        
        logger.info(`Arbitrage execution completed with profit: ${execution.netReturn}`);
      } else {
        execution.status = 'failed';
        execution.failureReason = 'Coordinated transaction execution failed';
        
        // Unlock assets
        await this.unlockAssetsForArbitrage(opportunity, positionSize);
      }

      execution.transactions = coordinatedTx.transactions;
      return execution;
      
    } catch (error) {
      execution.status = 'failed';
      execution.failureReason = String(error);
      logger.error('Arbitrage execution failed:', error);
      
      // Attempt to unlock assets
      try {
        await this.unlockAssetsForArbitrage(opportunity, positionSize);
      } catch (unlockError) {
        logger.error('Failed to unlock assets after arbitrage failure:', unlockError);
      }
      
      return execution;
    }
  }

  /**
   * Get asset allocation across all chains
   */
  async getAssetAllocation(): Promise<{
    byChain: Record<ChainID, { totalValue: number; assets: Record<AssetID, number> }>;
    byAsset: Record<AssetID, { totalValue: number; chains: Record<ChainID, number> }>;
    concentrationRisk: { chains: number; assets: number }; // Herfindahl index
  }> {
    const byChain: Record<ChainID, { totalValue: number; assets: Record<AssetID, number> }> = {};
    const byAsset: Record<AssetID, { totalValue: number; chains: Record<ChainID, number> }> = {};
    let totalPortfolioValue = 0;

    for (const [_positionKey, position] of this.assetPositions) {
      totalPortfolioValue += position.value;

      // Aggregate by chain
      if (!byChain[position.chainId]) {
        byChain[position.chainId] = { totalValue: 0, assets: {} };
      }
      byChain[position.chainId]!.totalValue += position.value;
      byChain[position.chainId]!.assets[position.assetId] = 
        (byChain[position.chainId]!.assets[position.assetId] || 0) + position.value;

      // Aggregate by asset
      if (!byAsset[position.assetId]) {
        byAsset[position.assetId] = { totalValue: 0, chains: {} };
      }
      byAsset[position.assetId]!.totalValue += position.value;
      byAsset[position.assetId]!.chains[position.chainId] = 
        (byAsset[position.assetId]!.chains[position.chainId] || 0) + position.value;
    }

    // Calculate concentration risk (Herfindahl index)
    const chainConcentration = this.calculateHerfindahlIndex(
      Object.values(byChain).map(chain => chain.totalValue), 
      totalPortfolioValue
    );
    const assetConcentration = this.calculateHerfindahlIndex(
      Object.values(byAsset).map(asset => asset.totalValue), 
      totalPortfolioValue
    );

    return {
      byChain,
      byAsset,
      concentrationRisk: {
        chains: chainConcentration,
        assets: assetConcentration
      }
    };
  }

  /**
   * Get cross-chain transaction coordination status
   */
  getCoordinationStatus(): {
    isRunning: boolean;
    activeTransactions: number;
    queuedTransactions: number;
    chainHealthScores: Record<ChainID, number>;
    riskLimitViolations: RiskLimit[];
    lastPortfolioUpdate: number;
  } {
    const activeTransactions = Array.from(this.coordinatedTransactions.values())
      .filter(tx => tx.status === 'coordinating' || tx.status === 'executing').length;

    const chainHealthScores: Record<ChainID, number> = {};
    for (const [chainId, state] of this.chainStates) {
      chainHealthScores[chainId] = state.healthScore;
    }

    const riskLimitViolations = this.riskLimits.filter(limit => limit.isViolated);

    return {
      isRunning: this.isRunning,
      activeTransactions,
      queuedTransactions: this.transactionQueue.length,
      chainHealthScores,
      riskLimitViolations,
      lastPortfolioUpdate: this.lastPortfolioUpdate
    };
  }

  /**
   * Emergency stop all coordinated operations
   */
  async emergencyStop(reason: string): Promise<void> {
    logger.warn(`Emergency stop triggered: ${reason}`);
    
    this.isRunning = false;
    
    // Stop coordination interval
    if (this.coordinationInterval) {
      clearInterval(this.coordinationInterval);
      this.coordinationInterval = undefined;
    }

    // Cancel queued transactions
    this.transactionQueue = [];

    // Attempt to gracefully stop active transactions
    const activeTransactions = Array.from(this.coordinatedTransactions.values())
      .filter(tx => tx.status === 'coordinating' || tx.status === 'executing');

    for (const tx of activeTransactions) {
      try {
        await this.cancelCoordinatedTransaction(tx.id, 'Emergency stop');
      } catch (error) {
        logger.error(`Failed to cancel transaction ${tx.id}:`, error);
      }
    }

    logger.warn('Emergency stop completed');
  }

  updateConfig(config: BridgeSatelliteConfig): void {
    this.config = config;
    this.initializeRiskLimits();
    this.portfolioCache = undefined; // Force refresh
    logger.info('Multi-chain coordinator config updated');
  }

  // Private methods

  private async initializeChainStates(): Promise<void> {
    for (const chain of this.config.chains) {
      const state: ChainState = {
        chainId: chain.id,
        isConnected: true, // Simulated
        blockHeight: Math.floor(Math.random() * 1000000) + 1000000,
        nativeBalance: Math.random() * 10 + 1, // 1-11 native tokens
        gasPrice: Math.random() * 50 + 10, // 10-60 gwei
        lastUpdate: Date.now(),
        healthScore: Math.floor(Math.random() * 20) + 80 // 80-100 health score
      };

      this.chainStates.set(chain.id, state);
    }

    logger.info(`Initialized ${this.chainStates.size} chain states`);
  }

  private async loadAssetPositions(): Promise<void> {
    const majorAssets = ['ETH', 'USDC', 'USDT', 'WBTC', 'DAI'];
    
    for (const chain of this.config.chains) {
      for (const asset of majorAssets) {
        const balance = Math.random() * 1000 + 100; // 100-1100 units
        const value = balance * this.getAssetPrice(asset); // Simulated price
        
        const position: AssetPosition = {
          chainId: chain.id,
          assetId: asset,
          tokenAddress: `0x${Math.random().toString(16).substr(2, 40)}`,
          balance,
          value,
          isLocked: false,
          lastUpdate: Date.now(),
          pendingTransactions: []
        };

        const key = `${chain.id}:${asset}`;
        this.assetPositions.set(key, position);
      }
    }

    logger.info(`Loaded ${this.assetPositions.size} asset positions`);
  }

  private getAssetPrice(assetId: AssetID): number {
    // Simulated asset prices
    const prices: Record<string, number> = {
      'ETH': 2500 + Math.random() * 500,
      'USDC': 1.0 + Math.random() * 0.01 - 0.005,
      'USDT': 1.0 + Math.random() * 0.01 - 0.005,
      'WBTC': 50000 + Math.random() * 10000,
      'DAI': 1.0 + Math.random() * 0.01 - 0.005
    };
    
    return prices[assetId] || 1.0;
  }

  private async updatePortfolioCache(): Promise<CrossChainPortfolio> {
    const positions: LiquidityPosition[] = [];
    let totalValue = 0;
    const actualDistribution: Record<ChainID, number> = {};

    // Calculate positions and values
    for (const [positionKey, assetPosition] of this.assetPositions) {
      const position: LiquidityPosition = {
        chainId: assetPosition.chainId,
        assetId: assetPosition.assetId,
        amount: assetPosition.balance,
        value: assetPosition.value,
        utilizationRate: assetPosition.isLocked ? 1.0 : Math.random() * 0.8 + 0.1,
        targetAllocation: this.config.liquidity.targetDistribution[assetPosition.chainId] || 0,
        currentAllocation: 0, // Will be calculated below
        rebalanceThreshold: this.config.liquidity.rebalanceThreshold
      };

      positions.push(position);
      totalValue += position.value;
      actualDistribution[assetPosition.chainId] = 
        (actualDistribution[assetPosition.chainId] || 0) + position.value;
    }

    // Calculate current allocations
    positions.forEach(position => {
      position.currentAllocation = position.value / totalValue;
    });

    // Normalize actual distribution
    for (const chainId of Object.keys(actualDistribution)) {
      actualDistribution[chainId] /= totalValue;
    }

    // Check if rebalancing is needed
    const rebalanceNeeded = this.assessRebalanceNeed(actualDistribution);
    
    // Calculate efficiency
    const efficiency = this.calculatePortfolioEfficiency(positions, actualDistribution);

    this.portfolioCache = {
      id: `portfolio_${Date.now()}`,
      totalValue,
      positions,
      rebalanceNeeded,
      lastRebalance: this.getLastRebalanceTime(),
      targetDistribution: this.config.liquidity.targetDistribution,
      actualDistribution,
      efficiency
    };

    this.lastPortfolioUpdate = Date.now();
    return this.portfolioCache;
  }

  private assessRebalanceNeed(actualDistribution: Record<ChainID, number>): boolean {
    const threshold = this.config.liquidity.rebalanceThreshold;
    
    for (const [chainId, targetRatio] of Object.entries(this.config.liquidity.targetDistribution)) {
      const actualRatio = actualDistribution[chainId] || 0;
      const deviation = Math.abs(actualRatio - targetRatio);
      
      if (deviation > threshold) {
        return true;
      }
    }
    
    return false;
  }

  private calculatePortfolioEfficiency(
    positions: LiquidityPosition[], 
    actualDistribution: Record<ChainID, number>
  ): number {
    let efficiencyScore = 100;
    
    // Penalize for deviation from target allocation
    for (const [chainId, targetRatio] of Object.entries(this.config.liquidity.targetDistribution)) {
      const actualRatio = actualDistribution[chainId] || 0;
      const deviation = Math.abs(actualRatio - targetRatio);
      efficiencyScore -= deviation * 100; // 1% deviation = 1 point penalty
    }
    
    // Penalize for low utilization
    const avgUtilization = positions.reduce((sum, pos) => sum + pos.utilizationRate, 0) / positions.length;
    if (avgUtilization < this.config.liquidity.minUtilization) {
      efficiencyScore -= (this.config.liquidity.minUtilization - avgUtilization) * 50;
    }
    
    return Math.max(0, Math.min(100, efficiencyScore));
  }

  private getLastRebalanceTime(): number {
    // Get the most recent rebalance transaction
    const rebalanceTransactions = Array.from(this.coordinatedTransactions.values())
      .filter(tx => tx.type === 'rebalance' && tx.status === 'completed')
      .sort((a, b) => (b.endTime || 0) - (a.endTime || 0));
    
    return rebalanceTransactions[0]?.endTime || Date.now() - 3600000; // Default to 1 hour ago
  }

  private async calculateRebalanceMoves(
    portfolio: CrossChainPortfolio, 
    targetDistribution: Record<ChainID, number>
  ): Promise<any[]> {
    const moves: any[] = [];
    
    for (const [chainId, targetRatio] of Object.entries(targetDistribution)) {
      const actualRatio = portfolio.actualDistribution[chainId] || 0;
      const difference = targetRatio - actualRatio;
      const amountDifference = difference * portfolio.totalValue;
      
      if (Math.abs(amountDifference) > 1000) { // Minimum move threshold
        moves.push({
          chainId,
          amountDifference,
          isIncrease: amountDifference > 0,
          priority: Math.abs(difference) > portfolio.positions[0].rebalanceThreshold ? 'high' : 'medium'
        });
      }
    }
    
    return moves;
  }

  private async validateTransactionAgainstRiskLimits(moves: any[]): Promise<any[]> {
    // Simple validation - in production would check against actual risk limits
    return moves.filter(move => Math.abs(move.amountDifference) < 100000); // Max $100k per move
  }

  private async createCoordinatedTransaction(params: any): Promise<CoordinatedTransaction> {
    const tx: CoordinatedTransaction = {
      id: `coord_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: params.type,
      chains: params.moves.map((move: any) => move.chainId),
      assets: ['USDC', 'ETH'], // Simplified
      estimatedTime: 300, // 5 minutes
      status: 'pending',
      transactions: [],
      dependencies: [],
      priority: params.options?.emergencyMode ? 'critical' : 'medium',
      createdAt: Date.now()
    };

    this.coordinatedTransactions.set(tx.id, tx);
    return tx;
  }

  private async createArbitrageTransaction(
    opportunity: ArbitrageOpportunity, 
    positionSize: number
  ): Promise<CoordinatedTransaction> {
    const tx: CoordinatedTransaction = {
      id: `arb_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'arbitrage',
      chains: [opportunity.sourceChain, opportunity.targetChain],
      assets: [opportunity.assetId],
      estimatedTime: opportunity.executionTime,
      status: 'pending',
      transactions: [],
      dependencies: [],
      priority: 'high',
      createdAt: Date.now()
    };

    this.coordinatedTransactions.set(tx.id, tx);
    return tx;
  }

  private async executeCoordinatedTransaction(tx: CoordinatedTransaction): Promise<boolean> {
    logger.info(`Executing coordinated transaction: ${tx.id}`);
    
    tx.status = 'coordinating';
    tx.startTime = Date.now();
    
    try {
      // Simulate transaction execution
      await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay
      
      tx.status = 'executing';
      
      // Simulate successful execution
      const success = Math.random() > 0.1; // 90% success rate
      
      if (success) {
        tx.status = 'completed';
        tx.endTime = Date.now();
        return true;
      } else {
        tx.status = 'failed';
        return false;
      }
    } catch (error) {
      tx.status = 'failed';
      logger.error(`Coordinated transaction ${tx.id} failed:`, error);
      return false;
    }
  }

  private calculateOptimalPositionSize(
    opportunity: ArbitrageOpportunity,
    portfolio: CrossChainPortfolio,
    maxPositionSize?: number
  ): number {
    // Simple position sizing based on portfolio value and risk
    const maxByPortfolio = portfolio.totalValue * 0.05; // Max 5% of portfolio
    const maxByOpportunity = opportunity.expectedProfit * 10; // 10x expected profit
    const maxByRisk = opportunity.riskScore < 50 ? 50000 : 25000; // Risk-based limit
    
    const calculatedSize = Math.min(
      maxByPortfolio,
      maxByOpportunity,
      maxByRisk,
      maxPositionSize || Infinity
    );
    
    return Math.max(0, calculatedSize);
  }

  private async lockAssetsForArbitrage(opportunity: ArbitrageOpportunity, amount: number): Promise<void> {
    const sourceKey = `${opportunity.sourceChain}:${opportunity.assetId}`;
    const sourcePosition = this.assetPositions.get(sourceKey);
    
    if (sourcePosition) {
      sourcePosition.isLocked = true;
    }
  }

  private async unlockAssetsForArbitrage(opportunity: ArbitrageOpportunity, amount: number): Promise<void> {
    const sourceKey = `${opportunity.sourceChain}:${opportunity.assetId}`;
    const sourcePosition = this.assetPositions.get(sourceKey);
    
    if (sourcePosition) {
      sourcePosition.isLocked = false;
    }
  }

  private calculateActualProfit(tx: CoordinatedTransaction): number {
    // Simplified profit calculation
    return Math.random() * 1000 + 500; // $500-$1500
  }

  private calculateActualCost(tx: CoordinatedTransaction): number {
    // Simplified cost calculation
    return Math.random() * 100 + 50; // $50-$150
  }

  private calculateHerfindahlIndex(values: number[], total: number): number {
    if (total === 0) return 0;
    
    let hhi = 0;
    for (const value of values) {
      const share = value / total;
      hhi += share * share;
    }
    
    return hhi * 10000; // Convert to 0-10000 scale
  }

  private async performCoordinationCycle(): Promise<void> {
    if (!this.isRunning) return;
    
    try {
      // Update chain states
      await this.updateChainStates();
      
      // Process transaction queue
      await this.processTransactionQueue();
      
      // Update risk limits
      await this.updateRiskLimits();
      
      // Check for emergency conditions
      await this.checkEmergencyConditions();
      
      logger.debug('Coordination cycle completed');
    } catch (error) {
      logger.error('Error during coordination cycle:', error);
    }
  }

  private async updateChainStates(): Promise<void> {
    for (const [chainId, state] of this.chainStates) {
      // Simulate state updates
      state.blockHeight += Math.floor(Math.random() * 3) + 1;
      state.gasPrice *= (0.95 + Math.random() * 0.1); // ±5% gas price change
      state.healthScore = Math.max(0, Math.min(100, state.healthScore + (Math.random() - 0.5) * 5));
      state.lastUpdate = Date.now();
    }
  }

  private async processTransactionQueue(): Promise<void> {
    const activeCount = Array.from(this.coordinatedTransactions.values())
      .filter(tx => tx.status === 'coordinating' || tx.status === 'executing').length;
    
    const availableSlots = this.maxConcurrentTransactions - activeCount;
    
    if (availableSlots > 0 && this.transactionQueue.length > 0) {
      const toProcess = this.transactionQueue.splice(0, availableSlots);
      
      for (const tx of toProcess) {
        this.coordinatedTransactions.set(tx.id, tx);
        this.executeCoordinatedTransaction(tx).catch(error => {
          logger.error(`Failed to execute queued transaction ${tx.id}:`, error);
        });
      }
    }
  }

  private async updateRiskLimits(): Promise<void> {
    const portfolio = await this.getPortfolioStatus();
    
    for (const limit of this.riskLimits) {
      switch (limit.type) {
        case 'chain_exposure':
          const chainValue = portfolio.actualDistribution[limit.chainId!] * portfolio.totalValue;
          limit.currentValue = chainValue / portfolio.totalValue;
          limit.isViolated = limit.maxPercentage ? limit.currentValue > limit.maxPercentage : false;
          break;
        // Add other risk limit types as needed
      }
    }
  }

  private async checkEmergencyConditions(): Promise<void> {
    // Check for critical risk limit violations
    const criticalViolations = this.riskLimits.filter(limit => 
      limit.isViolated && limit.currentValue > (limit.maxPercentage || 0) * 1.5
    );
    
    if (criticalViolations.length > 0) {
      logger.warn(`Critical risk violations detected: ${criticalViolations.length}`);
      // Could trigger emergency procedures here
    }
    
    // Check chain health
    const unhealthyChains = Array.from(this.chainStates.values())
      .filter(state => state.healthScore < 50);
    
    if (unhealthyChains.length > 0) {
      logger.warn(`Unhealthy chains detected: ${unhealthyChains.map(s => s.chainId).join(', ')}`);
    }
  }

  private async waitForPendingTransactions(): Promise<void> {
    const pendingTxs = Array.from(this.coordinatedTransactions.values())
      .filter(tx => tx.status === 'coordinating' || tx.status === 'executing');
    
    if (pendingTxs.length > 0) {
      logger.info(`Waiting for ${pendingTxs.length} pending transactions to complete...`);
      
      // Wait up to 60 seconds for transactions to complete
      const timeout = 60000;
      const startTime = Date.now();
      
      while (Date.now() - startTime < timeout) {
        const stillPending = Array.from(this.coordinatedTransactions.values())
          .filter(tx => tx.status === 'coordinating' || tx.status === 'executing');
        
        if (stillPending.length === 0) break;
        
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }

  private async cancelCoordinatedTransaction(txId: string, reason: string): Promise<void> {
    const tx = this.coordinatedTransactions.get(txId);
    if (tx && (tx.status === 'coordinating' || tx.status === 'executing')) {
      tx.status = 'failed';
      logger.info(`Cancelled transaction ${txId}: ${reason}`);
    }
  }

  private initializeRiskLimits(): void {
    this.riskLimits = [
      {
        type: 'chain_exposure',
        chainId: 'ethereum',
        maxPercentage: 0.6, // Max 60% on Ethereum
        currentValue: 0,
        isViolated: false
      },
      {
        type: 'asset_concentration',
        assetId: 'ETH',
        maxPercentage: 0.5, // Max 50% in ETH
        currentValue: 0,
        isViolated: false
      }
      // Add more risk limits as needed
    ];
  }

  private initializePositionSizingRules(): void {
    this._positionSizingRules = [
      {
        id: 'max_chain_exposure',
        name: 'Maximum Chain Exposure',
        type: 'max_chain_exposure',
        condition: (portfolio, position) => {
          const chainValue = portfolio.actualDistribution[position.chainId] * portfolio.totalValue;
          return chainValue / portfolio.totalValue > 0.6; // 60% max
        },
        maxSize: (portfolio, chainId) => {
          return portfolio.totalValue * 0.6; // 60% of portfolio
        },
        priority: 1,
        isActive: true
      }
      // Add more position sizing rules as needed
    ];
  }
}