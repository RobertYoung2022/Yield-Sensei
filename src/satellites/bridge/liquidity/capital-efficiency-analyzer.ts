/**
 * Capital Efficiency Analyzer
 * Advanced analytics for optimizing capital deployment across chains
 */

import Logger from '../../../shared/logging/logger';
import { 
  BridgeSatelliteConfig, 
  ChainID, 
  AssetID, 
  LiquidityPosition 
} from '../types';

const logger = Logger.getLogger('capital-efficiency');

interface CapitalAllocation {
  chainId: ChainID;
  assetId: AssetID;
  allocatedAmount: number;
  utilizedAmount: number;
  idleAmount: number;
  efficiency: number; // 0-100
  opportunityCost: number; // Daily cost of idle capital
  riskAdjustedReturn: number;
}

interface EfficiencyMetrics {
  overallEfficiency: number;
  totalCapital: number;
  activeCapital: number;
  idleCapital: number;
  totalOpportunityCost: number;
  optimalReallocation: CapitalReallocation[];
  efficiencyScore: number;
}

interface CapitalReallocation {
  fromChain: ChainID;
  toChain: ChainID;
  assetId: AssetID;
  amount: number;
  expectedImprovement: number;
  executionCost: number;
  netBenefit: number;
  priority: 'low' | 'medium' | 'high';
  timeToExecute: number;
}

interface YieldOpportunity {
  chainId: ChainID;
  assetId: AssetID;
  protocol: string;
  expectedAPY: number;
  riskScore: number; // 0-100
  minimumAmount: number;
  liquidityScore: number; // How easy to exit
  historicalVolatility: number;
}

interface CapitalEfficiencyConfig {
  riskTolerance: 'conservative' | 'moderate' | 'aggressive';
  minIdleThreshold: number; // Minimum idle capital to maintain
  rebalancingCostThreshold: number; // Min benefit to justify rebalancing
  targetUtilizationRate: number; // Target capital utilization
  opportunityUpdateInterval: number; // How often to refresh yield opportunities
}

export class CapitalEfficiencyAnalyzer {
  private config: BridgeSatelliteConfig;
  private efficiencyConfig: CapitalEfficiencyConfig;
  private capitalAllocations = new Map<string, CapitalAllocation>();
  private yieldOpportunities: YieldOpportunity[] = [];
  private lastAnalysis = 0;
  private analysisInterval?: NodeJS.Timeout;
  private isRunning = false;

  constructor(config: BridgeSatelliteConfig, efficiencyConfig?: Partial<CapitalEfficiencyConfig>) {
    this.config = config;
    this.efficiencyConfig = {
      riskTolerance: 'moderate',
      minIdleThreshold: 0.05, // 5% idle capital
      rebalancingCostThreshold: 1000, // $1000 minimum benefit
      targetUtilizationRate: 0.85, // 85% target utilization
      opportunityUpdateInterval: 3600000, // 1 hour
      ...efficiencyConfig
    };

    logger.info('Capital Efficiency Analyzer initialized');
  }

  async initialize(): Promise<void> {
    logger.info('Initializing Capital Efficiency Analyzer...');
    
    await this.loadYieldOpportunities();
    await this.analyzeCurrentAllocations();
    
    logger.info('Capital Efficiency Analyzer initialized successfully');
  }

  async start(): Promise<void> {
    if (this.isRunning) return;

    this.isRunning = true;
    
    // Start periodic analysis
    this.analysisInterval = setInterval(
      () => this.performEfficiencyAnalysis(),
      this.efficiencyConfig.opportunityUpdateInterval
    );

    logger.info('Capital Efficiency Analyzer started');
  }

  async stop(): Promise<void> {
    this.isRunning = false;

    if (this.analysisInterval) {
      clearInterval(this.analysisInterval);
      this.analysisInterval = undefined;
    }

    logger.info('Capital Efficiency Analyzer stopped');
  }

  /**
   * Analyze current capital efficiency across all chains
   */
  async analyzeCapitalEfficiency(): Promise<EfficiencyMetrics> {
    logger.info('Analyzing capital efficiency...');

    await this.analyzeCurrentAllocations();
    
    let totalCapital = 0;
    let activeCapital = 0;
    let idleCapital = 0;
    let totalOpportunityCost = 0;
    let weightedEfficiency = 0;

    for (const [allocationKey, allocation] of this.capitalAllocations) {
      totalCapital += allocation.allocatedAmount;
      activeCapital += allocation.utilizedAmount;
      idleCapital += allocation.idleAmount;
      totalOpportunityCost += allocation.opportunityCost;
      
      weightedEfficiency += allocation.efficiency * (allocation.allocatedAmount / totalCapital);
    }

    const overallEfficiency = totalCapital > 0 ? (activeCapital / totalCapital) * 100 : 0;
    const optimalReallocation = await this.calculateOptimalReallocation();
    const efficiencyScore = this.calculateEfficiencyScore(overallEfficiency, totalOpportunityCost, idleCapital);

    const metrics: EfficiencyMetrics = {
      overallEfficiency,
      totalCapital,
      activeCapital,
      idleCapital,
      totalOpportunityCost,
      optimalReallocation,
      efficiencyScore
    };

    logger.info('Capital efficiency analysis completed:', {
      overallEfficiency: overallEfficiency.toFixed(1),
      efficiencyScore: efficiencyScore.toFixed(1),
      totalOpportunityCost: totalOpportunityCost.toFixed(2),
      reallocations: optimalReallocation.length
    });

    this.lastAnalysis = Date.now();
    return metrics;
  }

  /**
   * Get capital allocation breakdown by chain and asset
   */
  async getCapitalAllocationBreakdown(): Promise<{
    byChain: Record<ChainID, { total: number; utilized: number; idle: number; efficiency: number }>;
    byAsset: Record<AssetID, { total: number; utilized: number; idle: number; efficiency: number }>;
    topOpportunities: YieldOpportunity[];
    underperformingAllocations: CapitalAllocation[];
  }> {
    await this.analyzeCurrentAllocations();

    const byChain: Record<ChainID, any> = {};
    const byAsset: Record<AssetID, any> = {};

    for (const allocation of this.capitalAllocations.values()) {
      // Aggregate by chain
      if (!byChain[allocation.chainId]) {
        byChain[allocation.chainId] = { total: 0, utilized: 0, idle: 0, efficiency: 0, count: 0 };
      }
      const chainAgg = byChain[allocation.chainId];
      chainAgg.total += allocation.allocatedAmount;
      chainAgg.utilized += allocation.utilizedAmount;
      chainAgg.idle += allocation.idleAmount;
      chainAgg.efficiency += allocation.efficiency;
      chainAgg.count++;

      // Aggregate by asset
      if (!byAsset[allocation.assetId]) {
        byAsset[allocation.assetId] = { total: 0, utilized: 0, idle: 0, efficiency: 0, count: 0 };
      }
      const assetAgg = byAsset[allocation.assetId];
      assetAgg.total += allocation.allocatedAmount;
      assetAgg.utilized += allocation.utilizedAmount;
      assetAgg.idle += allocation.idleAmount;
      assetAgg.efficiency += allocation.efficiency;
      assetAgg.count++;
    }

    // Calculate average efficiency
    for (const chainData of Object.values(byChain)) {
      chainData.efficiency /= chainData.count;
      delete chainData.count;
    }
    for (const assetData of Object.values(byAsset)) {
      assetData.efficiency /= assetData.count;
      delete assetData.count;
    }

    // Find top yield opportunities
    const topOpportunities = this.yieldOpportunities
      .filter(opp => this.isOpportunityValid(opp))
      .sort((a, b) => this.calculateRiskAdjustedReturn(b) - this.calculateRiskAdjustedReturn(a))
      .slice(0, 5);

    // Find underperforming allocations
    const underperformingAllocations = Array.from(this.capitalAllocations.values())
      .filter(allocation => allocation.efficiency < 50 || allocation.idleAmount > allocation.allocatedAmount * 0.3)
      .sort((a, b) => a.efficiency - b.efficiency);

    return {
      byChain,
      byAsset,
      topOpportunities,
      underperformingAllocations
    };
  }

  /**
   * Generate capital optimization recommendations
   */
  async generateOptimizationRecommendations(): Promise<{
    immediate: CapitalReallocation[];
    strategic: CapitalReallocation[];
    yieldFarming: YieldOpportunity[];
    riskMitigation: string[];
    estimatedImpact: {
      additionalYield: number;
      reducedOpportunityCost: number;
      improvedEfficiency: number;
    };
  }> {
    const allReallocations = await this.calculateOptimalReallocation();
    
    // Categorize recommendations
    const immediate = allReallocations.filter(r => r.priority === 'high' && r.netBenefit > this.efficiencyConfig.rebalancingCostThreshold);
    const strategic = allReallocations.filter(r => r.priority !== 'high' || r.netBenefit <= this.efficiencyConfig.rebalancingCostThreshold);
    
    // Top yield farming opportunities
    const yieldFarming = this.yieldOpportunities
      .filter(opp => this.isOpportunityValid(opp) && this.calculateRiskAdjustedReturn(opp) > 5) // > 5% risk-adjusted return
      .sort((a, b) => this.calculateRiskAdjustedReturn(b) - this.calculateRiskAdjustedReturn(a))
      .slice(0, 3);

    // Risk mitigation recommendations
    const riskMitigation = this.generateRiskMitigationRecommendations();

    // Calculate estimated impact
    const estimatedImpact = this.calculateOptimizationImpact(immediate, strategic, yieldFarming);

    return {
      immediate,
      strategic,
      yieldFarming,
      riskMitigation,
      estimatedImpact
    };
  }

  /**
   * Simulate capital allocation scenarios
   */
  async simulateAllocationScenarios(scenarios: Array<{
    name: string;
    allocations: Record<ChainID, Record<AssetID, number>>;
  }>): Promise<Array<{
    name: string;
    projectedEfficiency: number;
    projectedYield: number;
    riskScore: number;
    opportunityCost: number;
    feasibilityScore: number;
  }>> {
    const results = [];

    for (const scenario of scenarios) {
      const result = await this.simulateScenario(scenario);
      results.push(result);
    }

    return results.sort((a, b) => b.projectedEfficiency - a.projectedEfficiency);
  }

  /**
   * Get real-time efficiency metrics
   */
  getCurrentEfficiencyMetrics(): {
    utilizationRate: number;
    idleCapitalRatio: number;
    opportunityCostRate: number;
    efficiencyTrend: 'improving' | 'stable' | 'declining';
    lastUpdate: number;
  } {
    let totalCapital = 0;
    let utilizedCapital = 0;
    let opportunityCost = 0;

    for (const allocation of this.capitalAllocations.values()) {
      totalCapital += allocation.allocatedAmount;
      utilizedCapital += allocation.utilizedAmount;
      opportunityCost += allocation.opportunityCost;
    }

    const utilizationRate = totalCapital > 0 ? utilizedCapital / totalCapital : 0;
    const idleCapitalRatio = totalCapital > 0 ? (totalCapital - utilizedCapital) / totalCapital : 0;
    const opportunityCostRate = totalCapital > 0 ? opportunityCost / totalCapital : 0;

    // Simple trend analysis (would be more sophisticated in production)
    const efficiencyTrend: 'improving' | 'stable' | 'declining' = utilizationRate > 0.8 ? 'improving' : 
                                                                utilizationRate > 0.6 ? 'stable' : 'declining';

    return {
      utilizationRate,
      idleCapitalRatio,
      opportunityCostRate,
      efficiencyTrend,
      lastUpdate: this.lastAnalysis
    };
  }

  private async loadYieldOpportunities(): Promise<void> {
    // In production, this would fetch from DeFi protocols, yield aggregators, etc.
    this.yieldOpportunities = [
      {
        chainId: 'ethereum',
        assetId: 'USDC',
        protocol: 'Compound',
        expectedAPY: 4.2,
        riskScore: 25,
        minimumAmount: 1000,
        liquidityScore: 95,
        historicalVolatility: 0.02
      },
      {
        chainId: 'ethereum',
        assetId: 'ETH',
        protocol: 'Lido',
        expectedAPY: 3.8,
        riskScore: 20,
        minimumAmount: 0.1,
        liquidityScore: 90,
        historicalVolatility: 0.15
      },
      {
        chainId: 'polygon',
        assetId: 'USDC',
        protocol: 'Aave',
        expectedAPY: 6.1,
        riskScore: 30,
        minimumAmount: 500,
        liquidityScore: 88,
        historicalVolatility: 0.03
      },
      {
        chainId: 'arbitrum',
        assetId: 'ETH',
        protocol: 'GMX',
        expectedAPY: 12.5,
        riskScore: 60,
        minimumAmount: 0.5,
        liquidityScore: 70,
        historicalVolatility: 0.25
      },
      {
        chainId: 'optimism',
        assetId: 'USDT',
        protocol: 'Velodrome',
        expectedAPY: 8.7,
        riskScore: 45,
        minimumAmount: 1000,
        liquidityScore: 75,
        historicalVolatility: 0.08
      }
    ];

    logger.info(`Loaded ${this.yieldOpportunities.length} yield opportunities`);
  }

  private async analyzeCurrentAllocations(): Promise<void> {
    // This would typically integrate with the LiquidityOptimizer to get current state
    // For now, simulating based on configuration
    
    const majorAssets = ['ETH', 'USDC', 'USDT', 'WBTC', 'DAI'];
    
    for (const chain of this.config.chains) {
      for (const asset of majorAssets) {
        const allocationKey = `${chain.id}_${asset}`;
        const baseAmount = (this.config.liquidity.targetDistribution[chain.id] || 0.2) * 1000000;
        const utilization = 0.4 + Math.random() * 0.4; // 40-80% utilization
        
        const allocation: CapitalAllocation = {
          chainId: chain.id,
          assetId: asset,
          allocatedAmount: baseAmount,
          utilizedAmount: baseAmount * utilization,
          idleAmount: baseAmount * (1 - utilization),
          efficiency: this.calculateAllocationEfficiency(utilization, chain.id, asset),
          opportunityCost: this.calculateOpportunityCost(baseAmount * (1 - utilization), asset),
          riskAdjustedReturn: this.calculateAllocationReturn(chain.id, asset, utilization)
        };

        this.capitalAllocations.set(allocationKey, allocation);
      }
    }
  }

  private calculateAllocationEfficiency(utilization: number, chainId: ChainID, assetId: AssetID): number {
    // Base efficiency from utilization
    let efficiency = utilization * 100;
    
    // Chain-specific adjustments
    const chainMultiplier = this.getChainEfficiencyMultiplier(chainId);
    efficiency *= chainMultiplier;
    
    // Asset-specific adjustments
    const assetMultiplier = this.getAssetEfficiencyMultiplier(assetId);
    efficiency *= assetMultiplier;
    
    return Math.min(100, Math.max(0, efficiency));
  }

  private getChainEfficiencyMultiplier(chainId: ChainID): number {
    const multipliers: Record<string, number> = {
      'ethereum': 1.0,      // Base efficiency
      'polygon': 1.2,       // Lower costs, higher efficiency
      'arbitrum': 1.15,     // Good efficiency
      'optimism': 1.1,      // Moderate efficiency
      'avalanche': 1.05     // Slightly above average
    };
    
    return multipliers[chainId] || 1.0;
  }

  private getAssetEfficiencyMultiplier(assetId: AssetID): number {
    const multipliers: Record<string, number> = {
      'USDC': 1.1,    // Stable, efficient
      'USDT': 1.05,   // Stable, slightly less efficient
      'ETH': 1.0,     // Base case
      'WBTC': 0.95,   // Slightly less efficient
      'DAI': 1.08     // Decentralized stable, good efficiency
    };
    
    return multipliers[assetId] || 1.0;
  }

  private calculateOpportunityCost(idleAmount: number, assetId: AssetID): number {
    // Calculate daily opportunity cost based on missed yield
    const baseYield = this.getBaseYieldForAsset(assetId);
    return (idleAmount * baseYield) / 365; // Daily cost
  }

  private getBaseYieldForAsset(assetId: AssetID): number {
    const baseYields: Record<string, number> = {
      'USDC': 0.03,   // 3% base yield
      'USDT': 0.025,  // 2.5% base yield
      'ETH': 0.04,    // 4% base yield (staking)
      'WBTC': 0.015,  // 1.5% base yield
      'DAI': 0.035    // 3.5% base yield
    };
    
    return baseYields[assetId] || 0.02;
  }

  private calculateAllocationReturn(chainId: ChainID, assetId: AssetID, utilization: number): number {
    const baseReturn = this.getBaseYieldForAsset(assetId);
    const chainBonus = this.getChainYieldBonus(chainId);
    const utilizationBonus = utilization * 0.02; // Up to 2% bonus for high utilization
    
    return (baseReturn + chainBonus + utilizationBonus) * 100; // Convert to percentage
  }

  private getChainYieldBonus(chainId: ChainID): number {
    const bonuses: Record<string, number> = {
      'ethereum': 0.005,    // 0.5% bonus for security premium
      'polygon': 0.015,     // 1.5% bonus for DeFi ecosystem
      'arbitrum': 0.012,    // 1.2% bonus
      'optimism': 0.008,    // 0.8% bonus
      'avalanche': 0.010    // 1.0% bonus
    };
    
    return bonuses[chainId] || 0;
  }

  private async calculateOptimalReallocation(): Promise<CapitalReallocation[]> {
    const reallocations: CapitalReallocation[] = [];
    
    // Find inefficient allocations that could be moved to better opportunities
    const inefficientAllocations = Array.from(this.capitalAllocations.values())
      .filter(allocation => allocation.efficiency < 60 || allocation.idleAmount > allocation.allocatedAmount * 0.2);
    
    for (const allocation of inefficientAllocations) {
      // Find better opportunities on other chains
      const betterOpportunities = this.yieldOpportunities.filter(opp => 
        opp.chainId !== allocation.chainId && 
        opp.assetId === allocation.assetId &&
        this.calculateRiskAdjustedReturn(opp) > allocation.riskAdjustedReturn
      );
      
      for (const opportunity of betterOpportunities) {
        const moveAmount = Math.min(allocation.idleAmount, allocation.allocatedAmount * 0.3); // Max 30% move
        if (moveAmount < opportunity.minimumAmount) continue;
        
        const executionCost = this.calculateExecutionCost(allocation.chainId, opportunity.chainId, moveAmount);
        const expectedImprovement = moveAmount * (this.calculateRiskAdjustedReturn(opportunity) - allocation.riskAdjustedReturn) / 100;
        const netBenefit = expectedImprovement - executionCost;
        
        if (netBenefit > 0) {
          reallocations.push({
            fromChain: allocation.chainId,
            toChain: opportunity.chainId,
            assetId: allocation.assetId,
            amount: moveAmount,
            expectedImprovement,
            executionCost,
            netBenefit,
            priority: netBenefit > 5000 ? 'high' : netBenefit > 1000 ? 'medium' : 'low',
            timeToExecute: this.estimateExecutionTime(allocation.chainId, opportunity.chainId)
          });
        }
      }
    }
    
    return reallocations.sort((a, b) => b.netBenefit - a.netBenefit);
  }

  private calculateExecutionCost(fromChain: ChainID, toChain: ChainID, amount: number): number {
    // Estimate bridge fees, gas costs, slippage
    const bridgeFee = amount * 0.0005; // 0.05% bridge fee
    const gasCost = fromChain === 'ethereum' ? amount * 0.002 : amount * 0.0005;
    const slippage = amount * 0.0001; // 0.01% slippage
    
    return bridgeFee + gasCost + slippage;
  }

  private estimateExecutionTime(fromChain: ChainID, toChain: ChainID): number {
    // Estimate time in seconds based on chain characteristics
    const baseTimes: Record<string, number> = {
      'ethereum': 900,    // 15 minutes
      'polygon': 300,     // 5 minutes
      'arbitrum': 600,    // 10 minutes
      'optimism': 600,    // 10 minutes
      'avalanche': 180    // 3 minutes
    };
    
    return (baseTimes[fromChain] || 600) + (baseTimes[toChain] || 600);
  }

  private calculateRiskAdjustedReturn(opportunity: YieldOpportunity): number {
    // Adjust return based on risk score and volatility
    const riskPenalty = opportunity.riskScore / 100 * 0.5; // Up to 50% penalty for high risk
    const volatilityPenalty = opportunity.historicalVolatility * 0.3; // Volatility penalty
    const liquidityBonus = opportunity.liquidityScore / 100 * 0.1; // Up to 10% bonus for high liquidity
    
    return opportunity.expectedAPY * (1 - riskPenalty - volatilityPenalty + liquidityBonus);
  }

  private isOpportunityValid(opportunity: YieldOpportunity): boolean {
    const riskThreshold = this.getRiskThreshold();
    return opportunity.riskScore <= riskThreshold && 
           opportunity.liquidityScore >= 60 && 
           opportunity.expectedAPY > 2;
  }

  private getRiskThreshold(): number {
    const thresholds = {
      'conservative': 40,
      'moderate': 60,
      'aggressive': 80
    };
    
    return thresholds[this.efficiencyConfig.riskTolerance];
  }

  private calculateEfficiencyScore(efficiency: number, opportunityCost: number, idleCapital: number): number {
    // Combine multiple factors into a single efficiency score
    let score = efficiency; // Base from utilization
    
    // Penalty for opportunity cost
    const opportunityCostPenalty = Math.min(20, opportunityCost / 1000); // Up to 20 point penalty
    score -= opportunityCostPenalty;
    
    // Penalty for excessive idle capital
    const idleCapitalPenalty = Math.min(15, (idleCapital / 100000) * 5); // Penalty based on idle amount
    score -= idleCapitalPenalty;
    
    return Math.max(0, Math.min(100, score));
  }

  private generateRiskMitigationRecommendations(): string[] {
    const recommendations: string[] = [];
    
    // Check for concentration risk
    const chainConcentration = this.calculateChainConcentration();
    if (chainConcentration > 0.6) {
      recommendations.push(`High concentration risk detected: ${(chainConcentration * 100).toFixed(1)}% of capital on single chain. Consider diversification.`);
    }
    
    // Check for asset concentration
    const assetConcentration = this.calculateAssetConcentration();
    if (assetConcentration > 0.7) {
      recommendations.push(`Asset concentration risk: ${(assetConcentration * 100).toFixed(1)}% in single asset. Diversify across assets.`);
    }
    
    // Check for idle capital
    const idleRatio = this.calculateIdleCapitalRatio();
    if (idleRatio > 0.3) {
      recommendations.push(`High idle capital ratio: ${(idleRatio * 100).toFixed(1)}%. Deploy idle capital to yield opportunities.`);
    }
    
    return recommendations;
  }

  private calculateChainConcentration(): number {
    const chainTotals = new Map<ChainID, number>();
    let totalCapital = 0;
    
    for (const allocation of this.capitalAllocations.values()) {
      const current = chainTotals.get(allocation.chainId) || 0;
      chainTotals.set(allocation.chainId, current + allocation.allocatedAmount);
      totalCapital += allocation.allocatedAmount;
    }
    
    return Math.max(...chainTotals.values()) / totalCapital;
  }

  private calculateAssetConcentration(): number {
    const assetTotals = new Map<AssetID, number>();
    let totalCapital = 0;
    
    for (const allocation of this.capitalAllocations.values()) {
      const current = assetTotals.get(allocation.assetId) || 0;
      assetTotals.set(allocation.assetId, current + allocation.allocatedAmount);
      totalCapital += allocation.allocatedAmount;
    }
    
    return Math.max(...assetTotals.values()) / totalCapital;
  }

  private calculateIdleCapitalRatio(): number {
    let totalCapital = 0;
    let idleCapital = 0;
    
    for (const allocation of this.capitalAllocations.values()) {
      totalCapital += allocation.allocatedAmount;
      idleCapital += allocation.idleAmount;
    }
    
    return totalCapital > 0 ? idleCapital / totalCapital : 0;
  }

  private calculateOptimizationImpact(immediate: CapitalReallocation[], strategic: CapitalReallocation[], yieldFarming: YieldOpportunity[]): {
    additionalYield: number;
    reducedOpportunityCost: number;
    improvedEfficiency: number;
  } {
    const additionalYield = immediate.reduce((sum, r) => sum + r.expectedImprovement, 0) +
                           strategic.reduce((sum, r) => sum + r.expectedImprovement, 0);
    
    const reducedOpportunityCost = Array.from(this.capitalAllocations.values())
      .reduce((sum, a) => sum + a.opportunityCost, 0) * 0.5; // Estimate 50% reduction
    
    const improvedEfficiency = 15; // Estimate 15% efficiency improvement
    
    return {
      additionalYield,
      reducedOpportunityCost,
      improvedEfficiency
    };
  }

  private async simulateScenario(scenario: {
    name: string;
    allocations: Record<ChainID, Record<AssetID, number>>;
  }): Promise<{
    name: string;
    projectedEfficiency: number;
    projectedYield: number;
    riskScore: number;
    opportunityCost: number;
    feasibilityScore: number;
  }> {
    let totalCapital = 0;
    let projectedYield = 0;
    let riskScore = 0;
    let opportunityCost = 0;
    
    for (const [chainId, assets] of Object.entries(scenario.allocations)) {
      for (const [assetId, amount] of Object.entries(assets)) {
        totalCapital += amount;
        
        const chainReturn = this.calculateAllocationReturn(chainId, assetId, 0.8); // Assume 80% utilization
        projectedYield += amount * (chainReturn / 100);
        
        const assetRisk = this.getAssetRiskScore(assetId);
        riskScore += (amount / totalCapital) * assetRisk;
        
        const idleAmount = amount * 0.2; // Assume 20% idle
        opportunityCost += this.calculateOpportunityCost(idleAmount, assetId);
      }
    }
    
    const projectedEfficiency = totalCapital > 0 ? 80 : 0; // Estimate 80% efficiency
    const feasibilityScore = this.calculateFeasibilityScore(scenario.allocations);
    
    return {
      name: scenario.name,
      projectedEfficiency,
      projectedYield,
      riskScore,
      opportunityCost,
      feasibilityScore
    };
  }

  private getAssetRiskScore(assetId: AssetID): number {
    const riskScores: Record<string, number> = {
      'USDC': 10,   // Very low risk
      'USDT': 15,   // Low risk
      'DAI': 20,    // Low-medium risk
      'ETH': 40,    // Medium risk
      'WBTC': 45    // Medium-high risk
    };
    
    return riskScores[assetId] || 50;
  }

  private calculateFeasibilityScore(allocations: Record<ChainID, Record<AssetID, number>>): number {
    // Simple feasibility based on whether chains and assets are supported
    let score = 100;
    
    for (const chainId of Object.keys(allocations)) {
      if (!this.config.chains.find(c => c.id === chainId)) {
        score -= 20; // Penalty for unsupported chain
      }
    }
    
    return Math.max(0, score);
  }

  private async performEfficiencyAnalysis(): Promise<void> {
    if (!this.isRunning) return;
    
    try {
      const metrics = await this.analyzeCapitalEfficiency();
      const recommendations = await this.generateOptimizationRecommendations();
      
      logger.info('Efficiency analysis completed:', {
        efficiency: metrics.efficiencyScore.toFixed(1),
        immediateRecommendations: recommendations.immediate.length,
        strategicRecommendations: recommendations.strategic.length,
        yieldOpportunities: recommendations.yieldFarming.length
      });
    } catch (error) {
      logger.error('Error during efficiency analysis:', error);
    }
  }

  updateConfig(config: BridgeSatelliteConfig): void {
    this.config = config;
    logger.info('Capital efficiency analyzer configuration updated');
  }
}