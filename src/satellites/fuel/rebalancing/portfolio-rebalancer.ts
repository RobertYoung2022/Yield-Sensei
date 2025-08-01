/**
 * Portfolio Rebalancer
 * Intelligent portfolio rebalancing with tax optimization and gas efficiency
 */

import { EventEmitter } from 'events';
import { Logger } from 'winston';
import { createLogger, format, transports } from 'winston';
import { getUnifiedAIClient, UnifiedAIClient } from '../../../integrations/ai/unified-ai-client';
import {
  RebalancingConfig,
  RebalanceProposal,
  PortfolioAllocation,
  RebalanceTrade,
  RebalanceCosts,
  RebalanceImpact,
  TradeRoute,
  RebalanceStrategy,
  PendingTransaction,
  TransactionType,
  TransactionPriority,
  GasEstimate
} from '../types';

export interface PortfolioRebalancerConfig extends RebalancingConfig {
  analysisInterval: number; // milliseconds
  maxTradesPerRebalance: number;
  diversificationTargets: DiversificationTarget[];
  correlationThreshold: number;
  volatilityWindow: number; // days
  performanceTrackingWindow: number; // days
}

export interface DiversificationTarget {
  category: 'protocol' | 'chain' | 'asset_type' | 'risk_level';
  name: string;
  targetPercentage: number;
  minPercentage: number;
  maxPercentage: number;
  priority: number;
}

export interface PortfolioSnapshot {
  timestamp: Date;
  totalValue: number;
  allocations: PortfolioAllocation[];
  diversificationScore: number;
  riskMetrics: RiskMetrics;
  performance: PerformanceMetrics;
}

export interface RiskMetrics {
  volatility: number;
  maxDrawdown: number;
  sharpeRatio: number;
  correlationMatrix: Record<string, Record<string, number>>;
  concentrationRisk: number;
}

export interface PerformanceMetrics {
  totalReturn: number;
  annualizedReturn: number;
  winRate: number;
  averageHoldingPeriod: number;
  rebalanceCount: number;
  lastRebalanceDate: Date;
}

export interface RebalancingStrategy {
  name: string;
  description: string;
  evaluate: (snapshot: PortfolioSnapshot, targets: DiversificationTarget[]) => number;
  generateProposal: (snapshot: PortfolioSnapshot, targets: DiversificationTarget[]) => Promise<RebalanceProposal>;
}

export class PortfolioRebalancer extends EventEmitter {
  private logger: Logger;
  private config: PortfolioRebalancerConfig;
  private aiClient: UnifiedAIClient;
  private isInitialized: boolean = false;

  // State management
  private currentSnapshot?: PortfolioSnapshot;
  private rebalancingStrategies: RebalancingStrategy[] = [];
  private activeProposals: Map<string, RebalanceProposal> = new Map();
  private rebalanceHistory: RebalanceProposal[] = [];
  private priceHistory: Map<string, number[]> = new Map(); // asset -> price history

  // Performance tracking
  private totalRebalances: number = 0;
  private totalGasSaved: number = 0;
  private totalTaxSaved: number = 0;
  private averageRebalanceCost: number = 0;

  // Monitoring intervals
  private analysisInterval?: NodeJS.Timeout;
  private priceUpdateInterval?: NodeJS.Timeout;

  constructor(config: PortfolioRebalancerConfig) {
    super();
    this.config = config;
    this.logger = createLogger({
      level: 'info',
      format: format.combine(
        format.timestamp(),
        format.printf(({ timestamp, level, message, ...meta }) => {
          return `${timestamp} [PortfolioRebalancer] ${level}: ${message} ${Object.keys(meta).length > 0 ? JSON.stringify(meta) : ''}`;
        })
      ),
      transports: [
        new transports.Console(),
        new transports.File({ filename: 'logs/portfolio-rebalancer.log' })
      ],
    });
  }

  async initialize(): Promise<void> {
    try {
      this.logger.info('Initializing Portfolio Rebalancer...');

      // Initialize AI client
      this.aiClient = getUnifiedAIClient();

      // Initialize rebalancing strategies
      this.initializeRebalancingStrategies();

      // Load initial portfolio snapshot
      await this.createPortfolioSnapshot();

      // Start monitoring services
      if (this.config.enableAutoRebalancing) {
        this.startAnalysisService();
      }

      this.isInitialized = true;
      this.logger.info('Portfolio Rebalancer initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize Portfolio Rebalancer:', error);
      throw error;
    }
  }

  async analyzeRebalanceNeed(): Promise<{
    needsRebalance: boolean;
    driftPercentage: number;
    recommendation: string;
    urgency: 'low' | 'medium' | 'high';
  }> {
    try {
      if (!this.currentSnapshot) {
        await this.createPortfolioSnapshot();
      }

      const snapshot = this.currentSnapshot!;
      const maxDrift = this.calculateMaxDrift(snapshot);
      const needsRebalance = maxDrift > this.config.rebalanceThreshold;

      // Determine urgency based on drift and time since last rebalance
      let urgency: 'low' | 'medium' | 'high' = 'low';
      const daysSinceLastRebalance = this.getDaysSinceLastRebalance();

      if (maxDrift > this.config.rebalanceThreshold * 2) {
        urgency = 'high';
      } else if (maxDrift > this.config.rebalanceThreshold * 1.5 || daysSinceLastRebalance > 30) {
        urgency = 'medium';
      }

      // Generate AI-powered recommendation
      const recommendation = await this.generateRebalanceRecommendation(snapshot, maxDrift, urgency);

      return {
        needsRebalance,
        driftPercentage: maxDrift,
        recommendation,
        urgency
      };
    } catch (error) {
      this.logger.error('Failed to analyze rebalance need:', error);
      throw error;
    }
  }

  async generateRebalanceProposal(): Promise<RebalanceProposal> {
    try {
      this.logger.info('Generating rebalance proposal...');

      if (!this.currentSnapshot) {
        await this.createPortfolioSnapshot();
      }

      const snapshot = this.currentSnapshot!;

      // Evaluate all strategies
      const strategyEvaluations = await Promise.all(
        this.rebalancingStrategies.map(async strategy => ({
          strategy,
          score: strategy.evaluate(snapshot, this.config.diversificationTargets),
          proposal: await strategy.generateProposal(snapshot, this.config.diversificationTargets)
        }))
      );

      // Select best strategy
      const bestStrategy = strategyEvaluations.reduce((best, current) =>
        current.score > best.score ? current : best
      );

      this.logger.info('Selected rebalancing strategy', {
        strategy: bestStrategy.strategy.name,
        score: bestStrategy.score
      });

      // Enhance proposal with AI insights
      const enhancedProposal = await this.enhanceProposalWithAI(bestStrategy.proposal);

      // Store proposal
      this.activeProposals.set(enhancedProposal.id, enhancedProposal);

      this.emit('rebalance_proposal_generated', {
        proposalId: enhancedProposal.id,
        tradesCount: enhancedProposal.trades.length,
        estimatedCost: enhancedProposal.estimatedCosts.totalCost
      });

      return enhancedProposal;
    } catch (error) {
      this.logger.error('Failed to generate rebalance proposal:', error);
      throw error;
    }
  }

  async executeRebalance(proposalId: string): Promise<PendingTransaction[]> {
    const proposal = this.activeProposals.get(proposalId);
    if (!proposal) {
      throw new Error(`Rebalance proposal not found: ${proposalId}`);
    }

    try {
      this.logger.info('Executing rebalance', {
        proposalId,
        tradesCount: proposal.trades.length,
        estimatedCost: proposal.estimatedCosts.totalCost
      });

      // Convert trades to pending transactions
      const transactions = await this.createRebalanceTransactions(proposal);

      // Update proposal status
      proposal.approved = true;

      // Record rebalance execution
      this.rebalanceHistory.push(proposal);
      this.totalRebalances++;

      // Update metrics
      this.averageRebalanceCost = (this.averageRebalanceCost * (this.totalRebalances - 1) + 
                                  proposal.estimatedCosts.totalCost) / this.totalRebalances;

      this.emit('rebalance_executed', {
        proposalId,
        transactionCount: transactions.length,
        totalCost: proposal.estimatedCosts.totalCost,
        expectedReturn: proposal.impact.expectedReturn
      });

      return transactions;
    } catch (error) {
      this.logger.error('Failed to execute rebalance:', error);
      this.emit('rebalance_failed', {
        proposalId,
        error: error.message
      });
      throw error;
    }
  }

  async optimizeRebalanceForTaxes(proposal: RebalanceProposal): Promise<RebalanceProposal> {
    try {
      this.logger.info('Optimizing rebalance for tax efficiency...');

      // Create tax-optimized version of the proposal
      const optimizedTrades: RebalanceTrade[] = [];

      for (const trade of proposal.trades) {
        // Check for tax-loss harvesting opportunities
        if (trade.type === 'sell') {
          const optimizedTrade = await this.optimizeTradeForTaxes(trade);
          optimizedTrades.push(optimizedTrade);
        } else {
          optimizedTrades.push(trade);
        }
      }

      // Recalculate costs with tax optimization
      const optimizedCosts = await this.calculateRebalanceCosts(optimizedTrades);

      const optimizedProposal: RebalanceProposal = {
        ...proposal,
        id: `${proposal.id}_tax_optimized`,
        trades: optimizedTrades,
        estimatedCosts: optimizedCosts,
        impact: {
          ...proposal.impact,
          taxEfficiency: optimizedCosts.taxImpact
        }
      };

      return optimizedProposal;
    } catch (error) {
      this.logger.error('Failed to optimize rebalance for taxes:', error);
      return proposal;
    }
  }

  private initializeRebalancingStrategies(): void {
    // Strategy 1: Threshold-based rebalancing
    this.rebalancingStrategies.push({
      name: 'threshold',
      description: 'Rebalance when allocations drift beyond threshold',
      evaluate: (snapshot, targets) => this.evaluateThresholdStrategy(snapshot, targets),
      generateProposal: (snapshot, targets) => this.generateThresholdProposal(snapshot, targets)
    });

    // Strategy 2: Calendar-based rebalancing
    this.rebalancingStrategies.push({
      name: 'calendar',
      description: 'Periodic rebalancing on fixed schedule',
      evaluate: (snapshot, targets) => this.evaluateCalendarStrategy(snapshot, targets),
      generateProposal: (snapshot, targets) => this.generateCalendarProposal(snapshot, targets)
    });

    // Strategy 3: Volatility-based rebalancing
    this.rebalancingStrategies.push({
      name: 'volatility',
      description: 'Rebalance based on market volatility',
      evaluate: (snapshot, targets) => this.evaluateVolatilityStrategy(snapshot, targets),
      generateProposal: (snapshot, targets) => this.generateVolatilityProposal(snapshot, targets)
    });

    // Strategy 4: Correlation-based rebalancing
    this.rebalancingStrategies.push({
      name: 'correlation',
      description: 'Rebalance when asset correlations change',
      evaluate: (snapshot, targets) => this.evaluateCorrelationStrategy(snapshot, targets),
      generateProposal: (snapshot, targets) => this.generateCorrelationProposal(snapshot, targets)
    });

    // Strategy 5: Hybrid AI-enhanced strategy
    this.rebalancingStrategies.push({
      name: 'hybrid',
      description: 'AI-enhanced multi-factor rebalancing',
      evaluate: (snapshot, targets) => this.evaluateHybridStrategy(snapshot, targets),
      generateProposal: (snapshot, targets) => this.generateHybridProposal(snapshot, targets)
    });
  }

  private async createPortfolioSnapshot(): Promise<PortfolioSnapshot> {
    // In production, this would fetch real portfolio data
    // For now, create mock snapshot
    const mockAllocations: PortfolioAllocation[] = [
      {
        asset: 'ETH',
        chain: '1',
        protocol: 'Lido',
        currentValue: 50000,
        currentPercentage: 0.5,
        targetPercentage: 0.4,
        drift: 0.1
      },
      {
        asset: 'USDC',
        chain: '1',
        protocol: 'Compound',
        currentValue: 30000,
        currentPercentage: 0.3,
        targetPercentage: 0.35,
        drift: -0.05
      },
      {
        asset: 'BTC',
        chain: '1',
        protocol: 'direct',
        currentValue: 20000,
        currentPercentage: 0.2,
        targetPercentage: 0.25,
        drift: -0.05
      }
    ];

    const mockRiskMetrics: RiskMetrics = {
      volatility: 0.25,
      maxDrawdown: 0.15,
      sharpeRatio: 1.2,
      correlationMatrix: {
        'ETH': { 'ETH': 1.0, 'BTC': 0.7, 'USDC': 0.1 },
        'BTC': { 'ETH': 0.7, 'BTC': 1.0, 'USDC': 0.05 },
        'USDC': { 'ETH': 0.1, 'BTC': 0.05, 'USDC': 1.0 }
      },
      concentrationRisk: 0.5
    };

    const mockPerformance: PerformanceMetrics = {
      totalReturn: 0.15,
      annualizedReturn: 0.12,
      winRate: 0.65,
      averageHoldingPeriod: 45,
      rebalanceCount: this.totalRebalances,
      lastRebalanceDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // 30 days ago
    };

    this.currentSnapshot = {
      timestamp: new Date(),
      totalValue: 100000,
      allocations: mockAllocations,
      diversificationScore: this.calculateDiversificationScore(mockAllocations),
      riskMetrics: mockRiskMetrics,
      performance: mockPerformance
    };

    return this.currentSnapshot;
  }

  private calculateMaxDrift(snapshot: PortfolioSnapshot): number {
    return Math.max(...snapshot.allocations.map(allocation => Math.abs(allocation.drift)));
  }

  private getDaysSinceLastRebalance(): number {
    if (!this.currentSnapshot?.performance.lastRebalanceDate) {
      return 0;
    }
    return Math.floor((Date.now() - this.currentSnapshot.performance.lastRebalanceDate.getTime()) / (1000 * 60 * 60 * 24));
  }

  private async generateRebalanceRecommendation(
    snapshot: PortfolioSnapshot,
    drift: number,
    urgency: string
  ): Promise<string> {
    const prompt = `Analyze this portfolio rebalancing situation:

Portfolio Summary:
- Total Value: $${snapshot.totalValue.toLocaleString()}
- Max Drift: ${(drift * 100).toFixed(2)}%
- Rebalance Threshold: ${(this.config.rebalanceThreshold * 100).toFixed(2)}%
- Urgency: ${urgency}
- Volatility: ${(snapshot.riskMetrics.volatility * 100).toFixed(2)}%
- Sharpe Ratio: ${snapshot.riskMetrics.sharpeRatio.toFixed(2)}

Current Allocations:
${snapshot.allocations.map(a => 
  `- ${a.asset}: ${(a.currentPercentage * 100).toFixed(1)}% (target: ${(a.targetPercentage * 100).toFixed(1)}%)`
).join('\n')}

Provide a concise recommendation considering:
1. Market conditions
2. Gas costs
3. Tax implications
4. Risk management
5. Timing considerations`;

    try {
      const response = await this.aiClient.generateText({
        prompt,
        temperature: 0.3,
        maxTokens: 300
      });

      return response.data?.text || 'Consider rebalancing based on current drift levels';
    } catch (error) {
      this.logger.warn('AI recommendation failed:', error);
      return 'Standard rebalancing recommended based on threshold breach';
    }
  }

  private async enhanceProposalWithAI(proposal: RebalanceProposal): Promise<RebalanceProposal> {
    // Use AI to optimize trade timing and execution
    // For now, return proposal as-is
    return proposal;
  }

  private async createRebalanceTransactions(proposal: RebalanceProposal): Promise<PendingTransaction[]> {
    const transactions: PendingTransaction[] = [];

    for (const trade of proposal.trades) {
      const transaction: PendingTransaction = {
        id: `rebalance_${proposal.id}_${trade.id}`,
        type: trade.type === 'buy' ? TransactionType.DEPLOYMENT : TransactionType.WITHDRAWAL,
        from: '0x1234567890123456789012345678901234567890', // Mock wallet
        to: '0x0987654321098765432109876543210987654321', // Mock exchange
        value: BigInt(Math.floor(trade.amount * 1e18)), // Convert to wei
        data: '0x', // Encoded transaction data
        chainId: trade.route[0]?.chain || '1',
        priority: TransactionPriority.MEDIUM
      };

      transactions.push(transaction);
    }

    return transactions;
  }

  private async optimizeTradeForTaxes(trade: RebalanceTrade): Promise<RebalanceTrade> {
    // Check if this is a loss-making trade that could be tax-optimized
    // For now, return trade as-is
    return trade;
  }

  private async calculateRebalanceCosts(trades: RebalanceTrade[]): Promise<RebalanceCosts> {
    const gasCosts: Record<string, bigint> = {};
    let totalSlippage = 0;
    let totalProtocolFees = 0;

    for (const trade of trades) {
      // Calculate gas costs per chain
      const chainId = trade.route[0]?.chain || '1';
      if (!gasCosts[chainId]) {
        gasCosts[chainId] = BigInt(0);
      }
      gasCosts[chainId] += BigInt(150000) * BigInt(50e9); // ~$25 per trade

      // Calculate slippage
      totalSlippage += trade.route.reduce((sum, route) => sum + route.estimatedSlippage, 0);

      // Calculate protocol fees (0.3% average)
      totalProtocolFees += trade.amount * 0.003;
    }

    const totalGasCostUSD = Object.values(gasCosts).reduce((sum, cost) => 
      sum + Number(cost) / 1e18 * 2500, 0); // Assume ETH = $2500

    return {
      gasCosts,
      slippage: totalSlippage / trades.length,
      protocolFees: totalProtocolFees,
      taxImpact: 0, // Calculated separately
      totalCost: totalGasCostUSD + totalProtocolFees
    };
  }

  // Strategy implementations
  private evaluateThresholdStrategy(snapshot: PortfolioSnapshot, targets: DiversificationTarget[]): number {
    const maxDrift = this.calculateMaxDrift(snapshot);
    return maxDrift > this.config.rebalanceThreshold ? maxDrift * 100 : 0;
  }

  private async generateThresholdProposal(
    snapshot: PortfolioSnapshot, 
    targets: DiversificationTarget[]
  ): Promise<RebalanceProposal> {
    const trades: RebalanceTrade[] = [];
    
    // Generate trades to bring allocations back to target
    for (const allocation of snapshot.allocations) {
      if (Math.abs(allocation.drift) > this.config.rebalanceThreshold) {
        const tradeAmount = allocation.currentValue * Math.abs(allocation.drift);
        
        if (tradeAmount >= this.config.minTradeSize) {
          const trade: RebalanceTrade = {
            id: `trade_${allocation.asset}_${Date.now()}`,
            type: allocation.drift > 0 ? 'sell' : 'buy',
            fromAsset: allocation.drift > 0 ? allocation.asset : 'USDC',
            toAsset: allocation.drift > 0 ? 'USDC' : allocation.asset,
            amount: tradeAmount,
            estimatedPrice: 1, // Mock price
            route: [{
              protocol: allocation.protocol,
              chain: allocation.chain,
              pool: `${allocation.asset}/USDC`,
              estimatedSlippage: 0.005
            }]
          };
          
          trades.push(trade);
        }
      }
    }

    const costs = await this.calculateRebalanceCosts(trades);
    
    return {
      id: `threshold_proposal_${Date.now()}`,
      timestamp: new Date(),
      currentAllocations: snapshot.allocations,
      targetAllocations: snapshot.allocations.map(a => ({
        ...a,
        currentPercentage: a.targetPercentage,
        drift: 0
      })),
      trades,
      estimatedCosts: costs,
      impact: {
        expectedReturn: 0.02, // 2% expected improvement
        riskReduction: 0.05,
        diversificationScore: 0.8,
        taxEfficiency: 0.9
      },
      approved: false
    };
  }

  private evaluateCalendarStrategy(snapshot: PortfolioSnapshot, targets: DiversificationTarget[]): number {
    const daysSinceLastRebalance = this.getDaysSinceLastRebalance();
    const rebalanceIntervalDays = this.config.rebalanceInterval / (1000 * 60 * 60 * 24);
    
    return daysSinceLastRebalance >= rebalanceIntervalDays ? 50 : 0;
  }

  private async generateCalendarProposal(
    snapshot: PortfolioSnapshot, 
    targets: DiversificationTarget[]
  ): Promise<RebalanceProposal> {
    // Similar to threshold but less aggressive
    return this.generateThresholdProposal(snapshot, targets);
  }

  private evaluateVolatilityStrategy(snapshot: PortfolioSnapshot, targets: DiversificationTarget[]): number {
    const volatility = snapshot.riskMetrics.volatility;
    const baseScore = this.evaluateThresholdStrategy(snapshot, targets);
    
    // Higher volatility = higher urgency to rebalance
    return baseScore * (1 + volatility);
  }

  private async generateVolatilityProposal(
    snapshot: PortfolioSnapshot, 
    targets: DiversificationTarget[]
  ): Promise<RebalanceProposal> {
    // Generate more conservative proposal during high volatility
    const baseProposal = await this.generateThresholdProposal(snapshot, targets);
    
    // Reduce trade sizes during high volatility
    if (snapshot.riskMetrics.volatility > 0.3) {
      baseProposal.trades = baseProposal.trades.map(trade => ({
        ...trade,
        amount: trade.amount * 0.7 // Reduce by 30%
      }));
    }
    
    return baseProposal;
  }

  private evaluateCorrelationStrategy(snapshot: PortfolioSnapshot, targets: DiversificationTarget[]): number {
    const correlationMatrix = snapshot.riskMetrics.correlationMatrix;
    let avgCorrelation = 0;
    let count = 0;
    
    // Calculate average correlation
    Object.keys(correlationMatrix).forEach(asset1 => {
      Object.keys(correlationMatrix[asset1]).forEach(asset2 => {
        if (asset1 !== asset2) {
          avgCorrelation += Math.abs(correlationMatrix[asset1][asset2]);
          count++;
        }
      });
    });
    
    avgCorrelation /= count;
    
    // Higher correlation = higher need to rebalance
    return avgCorrelation > this.config.correlationThreshold ? avgCorrelation * 100 : 0;
  }

  private async generateCorrelationProposal(
    snapshot: PortfolioSnapshot, 
    targets: DiversificationTarget[]
  ): Promise<RebalanceProposal> {
    // Focus on reducing correlation risk
    return this.generateThresholdProposal(snapshot, targets);
  }

  private evaluateHybridStrategy(snapshot: PortfolioSnapshot, targets: DiversificationTarget[]): number {
    const thresholdScore = this.evaluateThresholdStrategy(snapshot, targets) * 0.4;
    const calendarScore = this.evaluateCalendarStrategy(snapshot, targets) * 0.2;
    const volatilityScore = this.evaluateVolatilityStrategy(snapshot, targets) * 0.2;
    const correlationScore = this.evaluateCorrelationStrategy(snapshot, targets) * 0.2;
    
    return thresholdScore + calendarScore + volatilityScore + correlationScore;
  }

  private async generateHybridProposal(
    snapshot: PortfolioSnapshot, 
    targets: DiversificationTarget[]
  ): Promise<RebalanceProposal> {
    // Use AI to generate optimal hybrid proposal
    const baseProposal = await this.generateThresholdProposal(snapshot, targets);
    
    // Apply hybrid optimizations
    return this.enhanceProposalWithAI(baseProposal);
  }

  private calculateDiversificationScore(allocations: PortfolioAllocation[]): number {
    // Calculate Herfindahl-Hirschman Index for diversification
    const hhi = allocations.reduce((sum, allocation) => 
      sum + Math.pow(allocation.currentPercentage, 2), 0);
    
    // Convert to diversification score (0-1, higher is better)
    return Math.max(0, 1 - hhi);
  }

  private startAnalysisService(): void {
    // Initial analysis
    this.analyzeRebalanceNeed();
    
    // Periodic analysis
    this.analysisInterval = setInterval(async () => {
      try {
        await this.createPortfolioSnapshot();
        const analysis = await this.analyzeRebalanceNeed();
        
        if (analysis.needsRebalance && analysis.urgency === 'high') {
          this.emit('rebalance_triggered', {
            drift: analysis.driftPercentage,
            urgency: analysis.urgency,
            recommendation: analysis.recommendation
          });
        }
      } catch (error) {
        this.logger.error('Analysis service error:', error);
      }
    }, this.config.analysisInterval);

    // Price update service
    this.priceUpdateInterval = setInterval(() => {
      this.updatePriceHistory();
    }, 300000); // Every 5 minutes
  }

  private updatePriceHistory(): void {
    // In production, fetch real price data
    // For now, simulate price updates
    const assets = ['ETH', 'BTC', 'USDC'];
    
    for (const asset of assets) {
      if (!this.priceHistory.has(asset)) {
        this.priceHistory.set(asset, []);
      }
      
      const history = this.priceHistory.get(asset)!;
      const lastPrice = history[history.length - 1] || 1000;
      const newPrice = lastPrice * (0.95 + Math.random() * 0.1); // ±5% change
      
      history.push(newPrice);
      
      // Keep only recent history
      if (history.length > this.config.performanceTrackingWindow) {
        history.shift();
      }
    }
  }

  getCurrentSnapshot(): PortfolioSnapshot | undefined {
    return this.currentSnapshot;
  }

  getActiveProposals(): RebalanceProposal[] {
    return Array.from(this.activeProposals.values());
  }

  getRebalanceHistory(): RebalanceProposal[] {
    return this.rebalanceHistory;
  }

  getStatus(): any {
    return {
      isInitialized: this.isInitialized,
      activeProposals: this.activeProposals.size,
      totalRebalances: this.totalRebalances,
      averageRebalanceCost: this.averageRebalanceCost,
      totalGasSaved: this.totalGasSaved,
      totalTaxSaved: this.totalTaxSaved,
      lastSnapshot: this.currentSnapshot?.timestamp,
      config: this.config
    };
  }

  async shutdown(): Promise<void> {
    this.logger.info('Shutting down Portfolio Rebalancer...');
    
    if (this.analysisInterval) {
      clearInterval(this.analysisInterval);
    }
    
    if (this.priceUpdateInterval) {
      clearInterval(this.priceUpdateInterval);
    }
    
    this.removeAllListeners();
    this.isInitialized = false;
  }
}