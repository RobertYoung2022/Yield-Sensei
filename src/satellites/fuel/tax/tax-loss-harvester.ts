/**
 * Tax-Loss Harvester
 * Identifies and executes tax-loss harvesting opportunities with wash sale compliance
 */

import { EventEmitter } from 'events';
import { Logger } from 'winston';
import { createLogger, format, transports } from 'winston';
import { getUnifiedAIClient, UnifiedAIClient } from '../../../integrations/ai/unified-ai-client';
import {
  TaxOptimizationConfig,
  TaxLossOpportunity,
  TaxImpact,
  HarvestAction,
  TaxableTransaction,
  PendingTransaction,
  TransactionType,
  TransactionPriority,
  GasEstimate
} from '../types';

export interface TaxLossHarvesterConfig extends TaxOptimizationConfig {
  analysisInterval: number; // milliseconds
  maxOpportunitiesPerDay: number;
  minTaxSavings: number; // USD
  washSaleBuffer: number; // days beyond legal requirement
  riskTolerance: 'conservative' | 'moderate' | 'aggressive';
}

export interface PortfolioPosition {
  id: string;
  asset: string;
  chain: string;
  protocol: string;
  amount: number;
  averageCostBasis: number;
  currentPrice: number;
  acquisitionDate: Date;
  unrealizedGainLoss: number;
  taxLot: TaxLot[];
}

export interface TaxLot {
  id: string;
  amount: number;
  costBasis: number;
  acquisitionDate: Date;
  isWashSaleRestricted: boolean;
  restrictionEnds?: Date;
}

export interface HarvestingStrategy {
  name: string;
  description: string;
  evaluate: (opportunities: TaxLossOpportunity[]) => number;
  select: (opportunities: TaxLossOpportunity[]) => TaxLossOpportunity[];
  execute: (opportunity: TaxLossOpportunity) => Promise<PendingTransaction[]>;
}

export class TaxLossHarvester extends EventEmitter {
  private logger: Logger;
  private config: TaxLossHarvesterConfig;
  private aiClient: UnifiedAIClient;
  private isInitialized: boolean = false;
  
  // State management
  private portfolioPositions: Map<string, PortfolioPosition> = new Map();
  private opportunities: Map<string, TaxLossOpportunity> = new Map();
  private harvestedTransactions: Map<string, TaxableTransaction> = new Map();
  private washSaleRegistry: Map<string, Date> = new Map(); // asset -> last sale date
  private harvestingStrategies: HarvestingStrategy[] = [];
  
  // Performance tracking
  private totalTaxSavings: number = 0;
  private harvestCount: number = 0;
  private washSalePreventions: number = 0;
  
  // Monitoring intervals
  private analysisInterval?: NodeJS.Timeout;
  private portfolioUpdateInterval?: NodeJS.Timeout;

  constructor(config: TaxLossHarvesterConfig) {
    super();
    this.config = config;
    this.logger = createLogger({
      level: 'info',
      format: format.combine(
        format.timestamp(),
        format.printf(({ timestamp, level, message, ...meta }) => {
          return `${timestamp} [TaxHarvester] ${level}: ${message} ${Object.keys(meta).length > 0 ? JSON.stringify(meta) : ''}`;
        })
      ),
      transports: [
        new transports.Console(),
        new transports.File({ filename: 'logs/tax-harvester.log' })
      ],
    });
  }

  async initialize(): Promise<void> {
    try {
      this.logger.info('Initializing Tax-Loss Harvester...');
      
      // Initialize AI client for tax analysis
      this.aiClient = getUnifiedAIClient();
      
      // Initialize harvesting strategies
      this.initializeHarvestingStrategies();
      
      // Load portfolio positions
      await this.loadPortfolioPositions();
      
      // Load wash sale registry
      await this.loadWashSaleRegistry();
      
      // Start analysis service
      if (this.config.enableHarvesting) {
        this.startAnalysisService();
      }
      
      this.isInitialized = true;
      this.logger.info('Tax-Loss Harvester initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize Tax-Loss Harvester:', error);
      throw error;
    }
  }

  async analyzeOpportunities(): Promise<TaxLossOpportunity[]> {
    try {
      this.logger.info('Analyzing tax-loss harvesting opportunities...');
      
      const opportunities: TaxLossOpportunity[] = [];
      const positions = Array.from(this.portfolioPositions.values());
      
      for (const position of positions) {
        // Only consider positions with unrealized losses
        if (position.unrealizedGainLoss >= 0) continue;
        
        // Check if loss meets minimum threshold
        const potentialLoss = Math.abs(position.unrealizedGainLoss);
        if (potentialLoss < this.config.minimumLoss) continue;
        
        // Check wash sale restrictions
        if (this.isWashSaleRestricted(position)) continue;
        
        // Calculate tax impact
        const taxImpact = await this.calculateTaxImpact(position);
        
        // Generate harvest action
        const harvestAction = await this.generateHarvestAction(position, taxImpact);
        
        const opportunity: TaxLossOpportunity = {
          id: `opp_${position.id}_${Date.now()}`,
          asset: position.asset,
          currentPrice: position.currentPrice,
          costBasis: position.averageCostBasis,
          unrealizedLoss: potentialLoss,
          holdingPeriod: this.calculateHoldingPeriod(position.acquisitionDate),
          taxImpact,
          recommendedAction: harvestAction,
          deadline: this.calculateOpportunityDeadline(position)
        };
        
        opportunities.push(opportunity);
      }
      
      // Use AI to enhance opportunity analysis
      if (opportunities.length > 0) {
        const enhancedOpportunities = await this.enhanceOpportunitiesWithAI(opportunities);
        
        // Update opportunities map
        for (const opp of enhancedOpportunities) {
          this.opportunities.set(opp.id, opp);
        }
        
        this.logger.info('Found tax-loss opportunities', { count: enhancedOpportunities.length });
        return enhancedOpportunities;
      }
      
      return [];
    } catch (error) {
      this.logger.error('Failed to analyze opportunities:', error);
      throw error;
    }
  }

  async executeHarvest(opportunityId: string): Promise<PendingTransaction[]> {
    const opportunity = this.opportunities.get(opportunityId);
    if (!opportunity) {
      throw new Error(`Opportunity not found: ${opportunityId}`);
    }

    try {
      this.logger.info('Executing tax-loss harvest', { 
        opportunityId, 
        asset: opportunity.asset,
        expectedSavings: opportunity.taxImpact.taxSavings 
      });

      // Get appropriate strategy
      const strategy = this.selectHarvestingStrategy(opportunity);
      
      // Execute harvest through strategy
      const transactions = await strategy.execute(opportunity);
      
      // Record the harvest
      await this.recordHarvest(opportunity, transactions);
      
      // Update wash sale registry
      this.updateWashSaleRegistry(opportunity.asset);
      
      // Update metrics
      this.totalTaxSavings += opportunity.taxImpact.taxSavings;
      this.harvestCount++;
      
      // Emit harvest event
      this.emit('harvest_executed', {
        opportunityId,
        asset: opportunity.asset,
        taxSavings: opportunity.taxImpact.taxSavings,
        transactions: transactions.length,
        timestamp: new Date()
      });
      
      return transactions;
    } catch (error) {
      this.logger.error('Failed to execute harvest:', error);
      throw error;
    }
  }

  async generateTaxReport(taxYear?: number): Promise<any> {
    const year = taxYear || this.config.taxYear;
    
    try {
      this.logger.info('Generating tax report', { taxYear: year });
      
      // Get all harvested transactions for the year
      const yearTransactions = Array.from(this.harvestedTransactions.values())
        .filter(tx => tx.date.getFullYear() === year);
      
      // Calculate summary
      const summary = this.calculateTaxSummary(yearTransactions);
      
      // Generate AI-enhanced report
      const aiReport = await this.generateAITaxReport(yearTransactions, summary);
      
      const report = {
        id: `tax_report_${year}_${Date.now()}`,
        taxYear: year,
        generatedAt: new Date(),
        transactions: yearTransactions,
        summary,
        aiInsights: aiReport,
        recommendations: await this.generateTaxRecommendations(summary)
      };
      
      this.emit('tax_report_generated', { reportId: report.id, year });
      
      return report;
    } catch (error) {
      this.logger.error('Failed to generate tax report:', error);
      throw error;
    }
  }

  private initializeHarvestingStrategies(): void {
    // Strategy 1: Direct Sale Strategy
    this.harvestingStrategies.push({
      name: 'direct_sale',
      description: 'Sell losing positions directly',
      evaluate: (opportunities) => this.evaluateDirectSaleStrategy(opportunities),
      select: (opportunities) => this.selectDirectSaleOpportunities(opportunities),
      execute: (opportunity) => this.executeDirectSale(opportunity)
    });

    // Strategy 2: Tax-Loss Swap Strategy
    this.harvestingStrategies.push({
      name: 'tax_loss_swap',
      description: 'Swap to similar assets to maintain exposure',
      evaluate: (opportunities) => this.evaluateTaxSwapStrategy(opportunities),
      select: (opportunities) => this.selectSwapOpportunities(opportunities),
      execute: (opportunity) => this.executeTaxSwap(opportunity)
    });

    // Strategy 3: Pairs Trading Strategy
    this.harvestingStrategies.push({
      name: 'pairs_trading',
      description: 'Use pairs trading to harvest losses while hedging',
      evaluate: (opportunities) => this.evaluatePairsStrategy(opportunities),
      select: (opportunities) => this.selectPairsOpportunities(opportunities),
      execute: (opportunity) => this.executePairsHarvest(opportunity)
    });
  }

  private async loadPortfolioPositions(): Promise<void> {
    // In production, this would load from portfolio management system
    // For now, simulate with mock positions
    const mockPositions: PortfolioPosition[] = [
      {
        id: 'pos_eth_1',
        asset: 'ETH',
        chain: '1',
        protocol: 'direct',
        amount: 10,
        averageCostBasis: 3500,
        currentPrice: 2500,
        acquisitionDate: new Date('2024-01-15'),
        unrealizedGainLoss: -10000, // $10k loss
        taxLot: [
          {
            id: 'lot_1',
            amount: 10,
            costBasis: 3500,
            acquisitionDate: new Date('2024-01-15'),
            isWashSaleRestricted: false
          }
        ]
      },
      {
        id: 'pos_btc_1',
        asset: 'BTC',
        chain: '1',
        protocol: 'direct',
        amount: 0.5,
        averageCostBasis: 60000,
        currentPrice: 45000,
        acquisitionDate: new Date('2024-02-01'),
        unrealizedGainLoss: -7500, // $7.5k loss
        taxLot: [
          {
            id: 'lot_2',
            amount: 0.5,
            costBasis: 60000,
            acquisitionDate: new Date('2024-02-01'),
            isWashSaleRestricted: false
          }
        ]
      }
    ];

    for (const position of mockPositions) {
      this.portfolioPositions.set(position.id, position);
    }

    this.logger.info('Portfolio positions loaded', { count: mockPositions.length });
  }

  private async loadWashSaleRegistry(): Promise<void> {
    // In production, load from persistent storage
    // For now, empty registry
    this.logger.info('Wash sale registry loaded');
  }

  private startAnalysisService(): void {
    // Initial analysis
    this.analyzeOpportunities();
    
    // Periodic analysis
    this.analysisInterval = setInterval(async () => {
      try {
        await this.analyzeOpportunities();
      } catch (error) {
        this.logger.error('Analysis service error:', error);
      }
    }, this.config.analysisInterval);

    // Portfolio update service
    this.portfolioUpdateInterval = setInterval(async () => {
      try {
        await this.updatePortfolioPrices();
      } catch (error) {
        this.logger.error('Portfolio update error:', error);
      }
    }, 300000); // Every 5 minutes
  }

  private isWashSaleRestricted(position: PortfolioPosition): boolean {
    const lastSaleDate = this.washSaleRegistry.get(position.asset);
    if (!lastSaleDate) return false;

    const daysSinceLastSale = (Date.now() - lastSaleDate.getTime()) / (1000 * 60 * 60 * 24);
    const restrictionPeriod = this.config.washSalePeriod + this.config.washSaleBuffer;
    
    return daysSinceLastSale < restrictionPeriod;
  }

  private async calculateTaxImpact(position: PortfolioPosition): Promise<TaxImpact> {
    const holdingPeriod = this.calculateHoldingPeriod(position.acquisitionDate);
    const isLongTerm = holdingPeriod > 365;
    const loss = Math.abs(position.unrealizedGainLoss);
    
    // Tax rates based on jurisdiction and term
    const shortTermRate = 0.35; // Approximate US marginal rate
    const longTermRate = 0.20;  // Long-term capital gains rate
    
    const effectiveRate = isLongTerm ? longTermRate : shortTermRate;
    const taxSavings = loss * effectiveRate;
    
    return {
      shortTermLoss: isLongTerm ? 0 : loss,
      longTermLoss: isLongTerm ? loss : 0,
      taxSavings,
      effectiveRate
    };
  }

  private async generateHarvestAction(
    position: PortfolioPosition, 
    taxImpact: TaxImpact
  ): Promise<HarvestAction> {
    // Estimate gas costs for selling
    const gasEstimate: GasEstimate = {
      chainId: position.chain,
      baseFee: BigInt(50e9), // 50 gwei
      priorityFee: BigInt(2e9), // 2 gwei
      maxFeePerGas: BigInt(102e9),
      estimatedCost: BigInt(150000) * BigInt(52e9), // ~$25 at current ETH prices
      executionTime: Date.now(),
      confidence: 0.9
    };

    return {
      type: 'sell',
      estimatedProceeds: position.amount * position.currentPrice,
      gasEstimate,
      washSaleRisk: this.isWashSaleRestricted(position)
    };
  }

  private calculateHoldingPeriod(acquisitionDate: Date): number {
    return Math.floor((Date.now() - acquisitionDate.getTime()) / (1000 * 60 * 60 * 24));
  }

  private calculateOpportunityDeadline(position: PortfolioPosition): Date {
    // For end-of-year tax planning, deadline is Dec 31
    const currentYear = new Date().getFullYear();
    return new Date(currentYear, 11, 31); // December 31
  }

  private async enhanceOpportunitiesWithAI(
    opportunities: TaxLossOpportunity[]
  ): Promise<TaxLossOpportunity[]> {
    const prompt = `Analyze these tax-loss harvesting opportunities and provide insights:

${opportunities.map(opp => `
Asset: ${opp.asset}
Current Loss: $${opp.unrealizedLoss.toLocaleString()}
Tax Savings: $${opp.taxImpact.taxSavings.toLocaleString()}
Holding Period: ${opp.holdingPeriod} days
`).join('\n')}

Consider:
1. Market outlook for each asset
2. Optimal timing for harvests
3. Risk of wash sale violations
4. Alternative investment opportunities
5. Overall portfolio impact

Provide prioritized recommendations with reasoning.`;

    try {
      const response = await this.aiClient.generateText({
        prompt,
        temperature: 0.3,
        maxTokens: 1000
      });

      // In production, would parse AI response to enhance opportunities
      // For now, return opportunities as-is
      return opportunities;
    } catch (error) {
      this.logger.warn('AI enhancement failed, using basic analysis:', error);
      return opportunities;
    }
  }

  private selectHarvestingStrategy(opportunity: TaxLossOpportunity): HarvestingStrategy {
    // Evaluate all strategies and select the best one
    const evaluations = this.harvestingStrategies.map(strategy => ({
      strategy,
      score: strategy.evaluate([opportunity])
    }));

    const bestStrategy = evaluations.reduce((best, current) => 
      current.score > best.score ? current : best
    );

    return bestStrategy.strategy;
  }

  private async recordHarvest(
    opportunity: TaxLossOpportunity, 
    transactions: PendingTransaction[]
  ): Promise<void> {
    const harvestTransaction: TaxableTransaction = {
      id: `harvest_${opportunity.id}`,
      date: new Date(),
      type: 'sell',
      asset: opportunity.asset,
      amount: 0, // Would be filled from actual transaction
      proceeds: opportunity.recommendedAction.estimatedProceeds,
      costBasis: opportunity.costBasis,
      gainLoss: -opportunity.unrealizedLoss, // Negative for loss
      termType: opportunity.holdingPeriod > 365 ? 'long' : 'short'
    };

    this.harvestedTransactions.set(harvestTransaction.id, harvestTransaction);
  }

  private updateWashSaleRegistry(asset: string): void {
    this.washSaleRegistry.set(asset, new Date());
  }

  // Strategy implementations
  private evaluateDirectSaleStrategy(opportunities: TaxLossOpportunity[]): number {
    // Score based on tax savings and simplicity
    const totalSavings = opportunities.reduce((sum, opp) => sum + opp.taxImpact.taxSavings, 0);
    return totalSavings * 0.8; // 80% weight for simplicity
  }

  private selectDirectSaleOpportunities(opportunities: TaxLossOpportunity[]): TaxLossOpportunity[] {
    // Select highest tax savings first
    return opportunities
      .sort((a, b) => b.taxImpact.taxSavings - a.taxImpact.taxSavings)
      .slice(0, Math.min(5, opportunities.length));
  }

  private async executeDirectSale(opportunity: TaxLossOpportunity): Promise<PendingTransaction[]> {
    const transaction: PendingTransaction = {
      id: `tx_harvest_${opportunity.id}`,
      type: TransactionType.HARVEST,
      from: '0x1234567890123456789012345678901234567890', // Mock wallet
      to: '0x0987654321098765432109876543210987654321',   // Mock exchange
      value: BigInt(0),
      data: '0x', // Encoded sell transaction
      chainId: '1',
      priority: TransactionPriority.MEDIUM,
      deadline: opportunity.deadline
    };

    return [transaction];
  }

  private evaluateTaxSwapStrategy(opportunities: TaxLossOpportunity[]): number {
    // Lower score due to complexity but maintains exposure
    const totalSavings = opportunities.reduce((sum, opp) => sum + opp.taxImpact.taxSavings, 0);
    return totalSavings * 0.6; // 60% weight due to complexity
  }

  private selectSwapOpportunities(opportunities: TaxLossOpportunity[]): TaxLossOpportunity[] {
    // Select opportunities with good swap alternatives
    return opportunities.filter(opp => opp.asset === 'ETH' || opp.asset === 'BTC');
  }

  private async executeTaxSwap(opportunity: TaxLossOpportunity): Promise<PendingTransaction[]> {
    // Implement tax-loss swap (sell and buy similar asset)
    const sellTx: PendingTransaction = {
      id: `tx_sell_${opportunity.id}`,
      type: TransactionType.HARVEST,
      from: '0x1234567890123456789012345678901234567890',
      to: '0x0987654321098765432109876543210987654321',
      value: BigInt(0),
      data: '0x', // Encoded sell
      chainId: '1',
      priority: TransactionPriority.MEDIUM
    };

    const buyTx: PendingTransaction = {
      id: `tx_buy_${opportunity.id}`,
      type: TransactionType.DEPLOYMENT,
      from: '0x1234567890123456789012345678901234567890',
      to: '0x0987654321098765432109876543210987654321',
      value: BigInt(0),
      data: '0x', // Encoded buy similar asset
      chainId: '1',
      priority: TransactionPriority.MEDIUM
    };

    return [sellTx, buyTx];
  }

  private evaluatePairsStrategy(opportunities: TaxLossOpportunity[]): number {
    // Most complex but can maintain market exposure
    const totalSavings = opportunities.reduce((sum, opp) => sum + opp.taxImpact.taxSavings, 0);
    return totalSavings * 0.4; // 40% weight due to high complexity
  }

  private selectPairsOpportunities(opportunities: TaxLossOpportunity[]): TaxLossOpportunity[] {
    // Only select highly liquid assets for pairs trading
    return opportunities.filter(opp => ['ETH', 'BTC'].includes(opp.asset));
  }

  private async executePairsHarvest(opportunity: TaxLossOpportunity): Promise<PendingTransaction[]> {
    // Implement pairs trading harvest
    return []; // Placeholder for complex pairs trading logic
  }

  private async updatePortfolioPrices(): Promise<void> {
    // In production, fetch real prices from price feeds
    for (const [id, position] of this.portfolioPositions) {
      // Mock price updates with small random changes
      const change = 0.95 + Math.random() * 0.1; // ±5% change
      position.currentPrice *= change;
      position.unrealizedGainLoss = position.amount * (position.currentPrice - position.averageCostBasis);
    }
  }

  private calculateTaxSummary(transactions: TaxableTransaction[]): any {
    const summary = {
      totalProceeds: 0,
      totalCostBasis: 0,
      shortTermGains: 0,
      shortTermLosses: 0,
      longTermGains: 0,
      longTermLosses: 0,
      netGainLoss: 0,
      estimatedTax: 0
    };

    for (const tx of transactions) {
      summary.totalProceeds += tx.proceeds;
      summary.totalCostBasis += tx.costBasis;
      
      if (tx.gainLoss > 0) {
        if (tx.termType === 'short') {
          summary.shortTermGains += tx.gainLoss;
        } else {
          summary.longTermGains += tx.gainLoss;
        }
      } else {
        if (tx.termType === 'short') {
          summary.shortTermLosses += Math.abs(tx.gainLoss);
        } else {
          summary.longTermLosses += Math.abs(tx.gainLoss);
        }
      }
    }

    summary.netGainLoss = summary.shortTermGains + summary.longTermGains - 
                         summary.shortTermLosses - summary.longTermLosses;
    
    // Simplified tax calculation
    summary.estimatedTax = Math.max(0, summary.netGainLoss * 0.25);

    return summary;
  }

  private async generateAITaxReport(transactions: TaxableTransaction[], summary: any): Promise<string> {
    const prompt = `Generate a comprehensive tax report analysis:

Summary:
- Total Transactions: ${transactions.length}
- Net Gain/Loss: $${summary.netGainLoss.toLocaleString()}
- Short-term Losses: $${summary.shortTermLosses.toLocaleString()}
- Long-term Losses: $${summary.longTermLosses.toLocaleString()}
- Estimated Tax Impact: $${summary.estimatedTax.toLocaleString()}

Provide insights on:
1. Tax efficiency of harvesting strategy
2. Opportunities for improvement
3. Regulatory compliance status
4. Recommendations for next tax year`;

    try {
      const response = await this.aiClient.generateText({
        prompt,
        temperature: 0.3,
        maxTokens: 800
      });

      return response.data?.text || 'AI analysis unavailable';
    } catch (error) {
      this.logger.warn('AI tax report generation failed:', error);
      return 'Standard tax report generated without AI insights';
    }
  }

  private async generateTaxRecommendations(summary: any): Promise<string[]> {
    const recommendations = [
      'Continue monitoring for additional harvesting opportunities',
      'Consider wash sale restrictions when rebalancing portfolio',
      'Review cost basis tracking for accuracy'
    ];

    if (summary.shortTermLosses > summary.longTermLosses) {
      recommendations.push('Focus on long-term holdings to reduce tax impact');
    }

    if (summary.netGainLoss > 0) {
      recommendations.push('Consider additional harvesting to offset gains');
    }

    return recommendations;
  }

  getOpportunities(): TaxLossOpportunity[] {
    return Array.from(this.opportunities.values());
  }

  getHarvestHistory(): TaxableTransaction[] {
    return Array.from(this.harvestedTransactions.values());
  }

  getStatus(): any {
    return {
      isInitialized: this.isInitialized,
      portfolioPositions: this.portfolioPositions.size,
      activeOpportunities: this.opportunities.size,
      totalTaxSavings: this.totalTaxSavings,
      harvestCount: this.harvestCount,
      washSalePreventions: this.washSalePreventions,
      config: this.config
    };
  }

  async shutdown(): Promise<void> {
    this.logger.info('Shutting down Tax-Loss Harvester...');
    
    if (this.analysisInterval) {
      clearInterval(this.analysisInterval);
    }
    
    if (this.portfolioUpdateInterval) {
      clearInterval(this.portfolioUpdateInterval);
    }
    
    this.removeAllListeners();
    this.isInitialized = false;
  }
}