/**
 * Profitability Calculator
 * Advanced models for calculating and optimizing arbitrage profitability
 */

import Logger from '../../../shared/logging/logger';
import { 
  ArbitrageOpportunity,
  ExecutionPath,
  ExecutionStep,
  ChainID,
  AssetID
} from '../types';

const logger = Logger.getLogger('profitability-calculator');

export interface ProfitabilityAnalysis {
  opportunityId: string;
  baseCalculation: BaseProfit;
  adjustedCalculation: AdjustedProfit;
  optimizedCalculation: OptimizedProfit;
  scenarios: ProfitScenario[];
  recommendation: ProfitabilityRecommendation;
  confidence: number;
}

export interface BaseProfit {
  grossProfit: number;
  expectedReturn: number;
  profitMargin: number;
  returnOnInvestment: number;
}

export interface AdjustedProfit {
  netProfit: number;
  adjustedReturn: number;
  adjustedMargin: number;
  costs: CostBreakdown;
  risks: RiskAdjustments;
}

export interface OptimizedProfit {
  maxPotentialProfit: number;
  optimizedReturn: number;
  optimizedMargin: number;
  optimizations: ProfitOptimization[];
  implementationComplexity: 'low' | 'medium' | 'high';
}

export interface CostBreakdown {
  gasCosts: GasCostDetail[];
  bridgeFees: BridgeFeeDetail[];
  slippageCosts: SlippageDetail[];
  timeCosts: TimeCostDetail[];
  totalCosts: number;
}

export interface GasCostDetail {
  chainId: ChainID;
  operation: string;
  estimatedGas: number;
  gasPrice: number;
  costInETH: number;
  costInUSD: number;
}

export interface BridgeFeeDetail {
  bridgeId: string;
  sourceChain: ChainID;
  targetChain: ChainID;
  baseFee: number;
  percentageFee: number;
  totalFee: number;
}

export interface SlippageDetail {
  step: number;
  protocol: string;
  expectedSlippage: number;
  maxSlippage: number;
  estimatedCost: number;
}

export interface TimeCostDetail {
  component: string;
  timeDelay: number; // seconds
  opportunityCost: number; // potential profit loss
  riskIncrease: number; // risk increase per second
}

export interface RiskAdjustments {
  volatilityAdjustment: number;
  liquidityAdjustment: number;
  executionAdjustment: number;
  mevAdjustment: number;
  totalAdjustment: number;
}

export interface ProfitOptimization {
  type: 'gas' | 'route' | 'timing' | 'size' | 'splitting';
  description: string;
  potentialImprovement: number;
  implementationCost: number;
  netBenefit: number;
  feasibility: number; // 0-1
}

export interface ProfitScenario {
  name: 'optimistic' | 'realistic' | 'pessimistic';
  probability: number;
  netProfit: number;
  profitMargin: number;
  assumptions: string[];
}

export interface ProfitabilityRecommendation {
  action: 'execute' | 'optimize_first' | 'monitor' | 'reject';
  reasoning: string[];
  minProfitThreshold: number;
  optimalExecutionSize: number;
  suggestedImprovements: string[];
}

export class ProfitabilityCalculator {
  private gasPrices: Map<ChainID, number> = new Map();
  private exchangeRates: Map<string, number> = new Map();
  private marketConditions: Map<string, any> = new Map();

  constructor() {
    // Initialize with default values
    this.initializeDefaults();
  }

  private initializeDefaults(): void {
    // Default gas prices (in gwei)
    this.gasPrices.set('ethereum', 30);
    this.gasPrices.set('polygon', 100);
    this.gasPrices.set('arbitrum', 1);
    this.gasPrices.set('optimism', 1);
    this.gasPrices.set('avalanche', 25);

    // Default exchange rates (to USD)
    this.exchangeRates.set('ETH', 2000);
    this.exchangeRates.set('MATIC', 0.8);
    this.exchangeRates.set('AVAX', 25);
  }

  async calculateProfitability(
    opportunity: ArbitrageOpportunity,
    marketData?: any,
    executionParams?: any
  ): Promise<ProfitabilityAnalysis> {
    try {
      // Base calculation using opportunity data
      const baseCalculation = this.calculateBaseProfit(opportunity);

      // Adjusted calculation with real costs
      const adjustedCalculation = await this.calculateAdjustedProfit(
        opportunity,
        marketData,
        executionParams
      );

      // Optimized calculation with improvements
      const optimizedCalculation = await this.calculateOptimizedProfit(
        opportunity,
        adjustedCalculation
      );

      // Generate profit scenarios
      const scenarios = this.generateProfitScenarios(
        opportunity,
        baseCalculation,
        adjustedCalculation
      );

      // Generate recommendation
      const recommendation = this.generateRecommendation(
        baseCalculation,
        adjustedCalculation,
        optimizedCalculation,
        scenarios
      );

      // Calculate confidence
      const confidence = this.calculateConfidence(opportunity, marketData);

      return {
        opportunityId: opportunity.id,
        baseCalculation,
        adjustedCalculation,
        optimizedCalculation,
        scenarios,
        recommendation,
        confidence,
      };
    } catch (error) {
      logger.error('Error calculating profitability:', error);
      return this.getDefaultProfitabilityAnalysis(opportunity.id);
    }
  }

  private calculateBaseProfit(opportunity: ArbitrageOpportunity): BaseProfit {
    const grossProfit = opportunity.expectedProfit;
    const investmentAmount = this.estimateInvestmentAmount(opportunity);
    const expectedReturn = grossProfit;
    const profitMargin = grossProfit / (investmentAmount || 1);
    const returnOnInvestment = grossProfit / (investmentAmount || 1);

    return {
      grossProfit,
      expectedReturn,
      profitMargin,
      returnOnInvestment,
    };
  }

  private estimateInvestmentAmount(opportunity: ArbitrageOpportunity): number {
    // Estimate initial capital needed
    // This is simplified - in reality would depend on the specific arbitrage strategy
    return opportunity.sourcePrice * 100; // Assume 100 tokens as base trade size
  }

  private async calculateAdjustedProfit(
    opportunity: ArbitrageOpportunity,
    marketData?: any,
    executionParams?: any
  ): Promise<AdjustedProfit> {
    // Calculate detailed costs
    const costs = await this.calculateDetailedCosts(opportunity, marketData);

    // Calculate risk adjustments
    const risks = this.calculateRiskAdjustments(opportunity, marketData);

    // Calculate adjusted values
    const netProfit = opportunity.expectedProfit - costs.totalCosts - risks.totalAdjustment;
    const investmentAmount = this.estimateInvestmentAmount(opportunity);
    const adjustedReturn = netProfit;
    const adjustedMargin = netProfit / (investmentAmount || 1);

    return {
      netProfit,
      adjustedReturn,
      adjustedMargin,
      costs,
      risks,
    };
  }

  private async calculateDetailedCosts(
    opportunity: ArbitrageOpportunity,
    marketData?: any
  ): Promise<CostBreakdown> {
    const path = opportunity.executionPaths?.[0];
    if (!path) {
      return {
        gasCosts: [],
        bridgeFees: [],
        slippageCosts: [],
        timeCosts: [],
        totalCosts: opportunity.estimatedGasCost,
      };
    }

    // Calculate gas costs for each step
    const gasCosts = await this.calculateGasCosts(path);

    // Calculate bridge fees
    const bridgeFees = this.calculateBridgeFees(path);

    // Calculate slippage costs
    const slippageCosts = this.calculateSlippageCosts(path, marketData);

    // Calculate time costs
    const timeCosts = this.calculateTimeCosts(path, opportunity);

    const totalCosts = 
      gasCosts.reduce((sum, gc) => sum + gc.costInUSD, 0) +
      bridgeFees.reduce((sum, bf) => sum + bf.totalFee, 0) +
      slippageCosts.reduce((sum, sc) => sum + sc.estimatedCost, 0) +
      timeCosts.reduce((sum, tc) => sum + tc.opportunityCost, 0);

    return {
      gasCosts,
      bridgeFees,
      slippageCosts,
      timeCosts,
      totalCosts,
    };
  }

  private async calculateGasCosts(path: ExecutionPath): Promise<GasCostDetail[]> {
    const gasCosts: GasCostDetail[] = [];

    for (const step of path.steps) {
      const gasPrice = this.gasPrices.get(step.chainId) || 50; // Default 50 gwei
      const estimatedGas = Number(step.estimatedGas);
      const costInETH = (estimatedGas * gasPrice) / 1e9; // Convert gwei to ETH
      const ethPrice = this.exchangeRates.get('ETH') || 2000;
      const costInUSD = costInETH * ethPrice;

      gasCosts.push({
        chainId: step.chainId,
        operation: `${step.type} via ${step.protocol}`,
        estimatedGas,
        gasPrice,
        costInETH,
        costInUSD,
      });
    }

    return gasCosts;
  }

  private calculateBridgeFees(path: ExecutionPath): BridgeFeeDetail[] {
    const bridgeFees: BridgeFeeDetail[] = [];

    for (const step of path.steps) {
      if (step.type === 'bridge') {
        // Simplified bridge fee calculation
        const baseFee = 5; // $5 base fee
        const percentageFee = 0.001; // 0.1%
        const estimatedValue = 1000; // Assume $1000 trade
        const totalFee = baseFee + (estimatedValue * percentageFee);

        bridgeFees.push({
          bridgeId: step.protocol,
          sourceChain: step.chainId,
          targetChain: step.chainId, // Simplified
          baseFee,
          percentageFee,
          totalFee,
        });
      }
    }

    return bridgeFees;
  }

  private calculateSlippageCosts(path: ExecutionPath, marketData?: any): SlippageDetail[] {
    const slippageCosts: SlippageDetail[] = [];

    path.steps.forEach((step, index) => {
      if (step.type === 'swap') {
        const expectedSlippage = marketData?.expectedSlippage || 0.005; // 0.5%
        const maxSlippage = expectedSlippage * 2; // Conservative estimate
        const tradeValue = 1000; // Assume $1000 trade
        const estimatedCost = tradeValue * expectedSlippage;

        slippageCosts.push({
          step: index,
          protocol: step.protocol,
          expectedSlippage,
          maxSlippage,
          estimatedCost,
        });
      }
    });

    return slippageCosts;
  }

  private calculateTimeCosts(path: ExecutionPath, opportunity: ArbitrageOpportunity): TimeCostDetail[] {
    const timeCosts: TimeCostDetail[] = [];

    // Time cost for each step
    let cumulativeTime = 0;
    for (const step of path.steps) {
      cumulativeTime += step.estimatedTime;
      
      // Opportunity cost increases with time due to price movement risk
      const riskIncrease = cumulativeTime * 0.001; // 0.1% risk per second
      const opportunityCost = opportunity.expectedProfit * riskIncrease;

      timeCosts.push({
        component: `${step.type} on ${step.chainId}`,
        timeDelay: step.estimatedTime,
        opportunityCost,
        riskIncrease,
      });
    }

    return timeCosts;
  }

  private calculateRiskAdjustments(
    opportunity: ArbitrageOpportunity,
    marketData?: any
  ): RiskAdjustments {
    const profit = opportunity.expectedProfit;

    // Volatility adjustment (higher volatility = higher risk premium)
    const volatility = marketData?.volatility || 0.1;
    const volatilityAdjustment = profit * volatility * 0.5;

    // Liquidity adjustment (lower liquidity = higher cost)
    const liquidity = marketData?.liquidity || 1000000;
    const liquidityAdjustment = profit * Math.max(0, (1000000 - liquidity) / 1000000) * 0.2;

    // Execution adjustment (complex paths = higher risk)
    const pathComplexity = opportunity.executionPaths?.[0]?.steps?.length || 1;
    const executionAdjustment = profit * (pathComplexity - 1) * 0.05;

    // MEV adjustment (high-profit opportunities attract MEV)
    const mevRisk = Math.min(0.5, profit / 1000); // 50% max MEV risk
    const mevAdjustment = profit * mevRisk * 0.3;

    const totalAdjustment = 
      volatilityAdjustment + 
      liquidityAdjustment + 
      executionAdjustment + 
      mevAdjustment;

    return {
      volatilityAdjustment,
      liquidityAdjustment,
      executionAdjustment,
      mevAdjustment,
      totalAdjustment,
    };
  }

  private async calculateOptimizedProfit(
    opportunity: ArbitrageOpportunity,
    adjustedCalculation: AdjustedProfit
  ): Promise<OptimizedProfit> {
    // Identify possible optimizations
    const optimizations = this.identifyOptimizations(opportunity, adjustedCalculation);

    // Calculate maximum potential profit with all optimizations
    const totalImprovement = optimizations.reduce((sum, opt) => sum + opt.netBenefit, 0);
    const maxPotentialProfit = adjustedCalculation.netProfit + totalImprovement;

    const investmentAmount = this.estimateInvestmentAmount(opportunity);
    const optimizedReturn = maxPotentialProfit;
    const optimizedMargin = maxPotentialProfit / (investmentAmount || 1);

    // Assess implementation complexity
    const implementationComplexity = this.assessImplementationComplexity(optimizations);

    return {
      maxPotentialProfit,
      optimizedReturn,
      optimizedMargin,
      optimizations,
      implementationComplexity,
    };
  }

  private identifyOptimizations(
    opportunity: ArbitrageOpportunity,
    adjustedCalculation: AdjustedProfit
  ): ProfitOptimization[] {
    const optimizations: ProfitOptimization[] = [];

    // Gas optimization
    const gasOptimization = this.analyzeGasOptimization(adjustedCalculation.costs.gasCosts);
    if (gasOptimization) optimizations.push(gasOptimization);

    // Route optimization
    const routeOptimization = this.analyzeRouteOptimization(opportunity);
    if (routeOptimization) optimizations.push(routeOptimization);

    // Timing optimization
    const timingOptimization = this.analyzeTimingOptimization(opportunity);
    if (timingOptimization) optimizations.push(timingOptimization);

    // Size optimization
    const sizeOptimization = this.analyzeSizeOptimization(opportunity, adjustedCalculation);
    if (sizeOptimization) optimizations.push(sizeOptimization);

    // Order splitting optimization
    const splittingOptimization = this.analyzeSplittingOptimization(opportunity);
    if (splittingOptimization) optimizations.push(splittingOptimization);

    return optimizations.sort((a, b) => b.netBenefit - a.netBenefit);
  }

  private analyzeGasOptimization(gasCosts: GasCostDetail[]): ProfitOptimization | null {
    const totalGasCost = gasCosts.reduce((sum, gc) => sum + gc.costInUSD, 0);
    
    if (totalGasCost > 50) { // Worth optimizing if gas costs > $50
      const potentialSaving = totalGasCost * 0.3; // 30% potential saving
      
      return {
        type: 'gas',
        description: 'Optimize gas usage through batching and efficient routing',
        potentialImprovement: potentialSaving,
        implementationCost: 10, // $10 implementation cost
        netBenefit: potentialSaving - 10,
        feasibility: 0.8,
      };
    }
    
    return null;
  }

  private analyzeRouteOptimization(opportunity: ArbitrageOpportunity): ProfitOptimization | null {
    const pathLength = opportunity.executionPaths?.[0]?.steps?.length || 0;
    
    if (pathLength > 3) { // Complex paths worth optimizing
      const potentialImprovement = opportunity.expectedProfit * 0.15; // 15% improvement
      
      return {
        type: 'route',
        description: 'Find more efficient execution path with fewer steps',
        potentialImprovement,
        implementationCost: 5,
        netBenefit: potentialImprovement - 5,
        feasibility: 0.6,
      };
    }
    
    return null;
  }

  private analyzeTimingOptimization(opportunity: ArbitrageOpportunity): ProfitOptimization | null {
    if (opportunity.executionTime > 300) { // > 5 minutes
      const potentialImprovement = opportunity.expectedProfit * 0.1; // 10% improvement
      
      return {
        type: 'timing',
        description: 'Optimize execution timing to reduce price risk',
        potentialImprovement,
        implementationCost: 15,
        netBenefit: potentialImprovement - 15,
        feasibility: 0.7,
      };
    }
    
    return null;
  }

  private analyzeSizeOptimization(
    opportunity: ArbitrageOpportunity,
    adjustedCalculation: AdjustedProfit
  ): ProfitOptimization | null {
    // Check if increasing trade size would improve profit margin
    const currentMargin = adjustedCalculation.adjustedMargin;
    
    if (currentMargin > 0.02) { // > 2% margin, might scale well
      const potentialImprovement = opportunity.expectedProfit * 0.25; // 25% improvement
      
      return {
        type: 'size',
        description: 'Increase trade size to improve profit margins',
        potentialImprovement,
        implementationCost: 20, // Higher capital requirement
        netBenefit: potentialImprovement - 20,
        feasibility: 0.5, // Lower feasibility due to capital requirement
      };
    }
    
    return null;
  }

  private analyzeSplittingOptimization(opportunity: ArbitrageOpportunity): ProfitOptimization | null {
    const profit = opportunity.expectedProfit;
    
    if (profit > 500) { // Large opportunities worth splitting
      const potentialImprovement = profit * 0.08; // 8% improvement through MEV reduction
      
      return {
        type: 'splitting',
        description: 'Split large orders to reduce MEV risk and slippage',
        potentialImprovement,
        implementationCost: 25, // Higher complexity
        netBenefit: potentialImprovement - 25,
        feasibility: 0.6,
      };
    }
    
    return null;
  }

  private assessImplementationComplexity(optimizations: ProfitOptimization[]): 'low' | 'medium' | 'high' {
    const avgFeasibility = optimizations.reduce((sum, opt) => sum + opt.feasibility, 0) / optimizations.length;
    const totalCost = optimizations.reduce((sum, opt) => sum + opt.implementationCost, 0);
    
    if (avgFeasibility > 0.8 && totalCost < 50) return 'low';
    if (avgFeasibility > 0.6 && totalCost < 100) return 'medium';
    return 'high';
  }

  private generateProfitScenarios(
    opportunity: ArbitrageOpportunity,
    baseCalculation: BaseProfit,
    adjustedCalculation: AdjustedProfit
  ): ProfitScenario[] {
    const scenarios: ProfitScenario[] = [];

    // Optimistic scenario (best case)
    scenarios.push({
      name: 'optimistic',
      probability: 0.15,
      netProfit: adjustedCalculation.netProfit * 1.3,
      profitMargin: adjustedCalculation.adjustedMargin * 1.3,
      assumptions: [
        'Lower than expected gas costs',
        'Minimal slippage',
        'No MEV interference',
        'Optimal market conditions',
      ],
    });

    // Realistic scenario (expected case)
    scenarios.push({
      name: 'realistic',
      probability: 0.70,
      netProfit: adjustedCalculation.netProfit,
      profitMargin: adjustedCalculation.adjustedMargin,
      assumptions: [
        'Expected gas costs',
        'Normal slippage levels',
        'Some MEV competition',
        'Typical market conditions',
      ],
    });

    // Pessimistic scenario (worst case)
    scenarios.push({
      name: 'pessimistic',
      probability: 0.15,
      netProfit: adjustedCalculation.netProfit * 0.3,
      profitMargin: adjustedCalculation.adjustedMargin * 0.3,
      assumptions: [
        'Higher than expected gas costs',
        'High slippage due to low liquidity',
        'Strong MEV competition',
        'Adverse market conditions',
      ],
    });

    return scenarios;
  }

  private generateRecommendation(
    baseCalculation: BaseProfit,
    adjustedCalculation: AdjustedProfit,
    optimizedCalculation: OptimizedProfit,
    scenarios: ProfitScenario[]
  ): ProfitabilityRecommendation {
    const reasoning: string[] = [];
    const suggestedImprovements: string[] = [];

    // Calculate expected value across scenarios
    const expectedValue = scenarios.reduce(
      (sum, scenario) => sum + scenario.netProfit * scenario.probability,
      0
    );

    // Determine minimum profit threshold (5% of investment)
    const minProfitThreshold = baseCalculation.grossProfit * 0.05;

    // Determine optimal execution size
    let optimalExecutionSize = 1000; // Default $1000
    if (adjustedCalculation.adjustedMargin > 0.03) {
      optimalExecutionSize = 2000; // Scale up if good margin
    }

    // Generate reasoning
    if (adjustedCalculation.netProfit <= 0) {
      reasoning.push('Negative expected profit after costs and adjustments');
      return {
        action: 'reject',
        reasoning,
        minProfitThreshold,
        optimalExecutionSize,
        suggestedImprovements: ['Find opportunities with lower costs'],
      };
    }

    if (expectedValue < minProfitThreshold) {
      reasoning.push('Expected value below minimum threshold');
      reasoning.push(`Expected: $${expectedValue.toFixed(2)}, Minimum: $${minProfitThreshold.toFixed(2)}`);
    }

    // Check if optimization would help
    if (optimizedCalculation.maxPotentialProfit > adjustedCalculation.netProfit * 1.5) {
      reasoning.push('Significant optimization potential identified');
      suggestedImprovements.push('Implement identified optimizations');
      
      if (optimizedCalculation.implementationComplexity === 'low') {
        return {
          action: 'optimize_first',
          reasoning,
          minProfitThreshold,
          optimalExecutionSize,
          suggestedImprovements: optimizedCalculation.optimizations.map(opt => opt.description),
        };
      }
    }

    // Final decision logic
    if (adjustedCalculation.netProfit > minProfitThreshold && expectedValue > 0) {
      reasoning.push('Positive expected value with acceptable risk');
      return {
        action: 'execute',
        reasoning,
        minProfitThreshold,
        optimalExecutionSize,
        suggestedImprovements,
      };
    } else if (adjustedCalculation.netProfit > 0) {
      reasoning.push('Marginal profitability - monitor for better conditions');
      return {
        action: 'monitor',
        reasoning,
        minProfitThreshold,
        optimalExecutionSize,
        suggestedImprovements,
      };
    } else {
      reasoning.push('Insufficient profitability');
      return {
        action: 'reject',
        reasoning,
        minProfitThreshold,
        optimalExecutionSize,
        suggestedImprovements,
      };
    }
  }

  private calculateConfidence(opportunity: ArbitrageOpportunity, marketData?: any): number {
    let confidence = 0.5; // Base confidence

    // Increase confidence with more market data
    if (marketData?.liquidity && marketData.liquidity > 500000) confidence += 0.2;
    if (marketData?.orderBook) confidence += 0.1;
    if (marketData?.priceHistory?.length > 50) confidence += 0.1;

    // Decrease confidence for complex paths
    const pathComplexity = opportunity.executionPaths?.[0]?.steps?.length || 1;
    confidence -= (pathComplexity - 1) * 0.05;

    // Decrease confidence for high-risk opportunities
    if (opportunity.riskScore > 70) confidence -= 0.2;

    return Math.max(0.1, Math.min(1, confidence));
  }

  private getDefaultProfitabilityAnalysis(opportunityId: string): ProfitabilityAnalysis {
    return {
      opportunityId,
      baseCalculation: {
        grossProfit: 0,
        expectedReturn: 0,
        profitMargin: 0,
        returnOnInvestment: 0,
      },
      adjustedCalculation: {
        netProfit: 0,
        adjustedReturn: 0,
        adjustedMargin: 0,
        costs: {
          gasCosts: [],
          bridgeFees: [],
          slippageCosts: [],
          timeCosts: [],
          totalCosts: 0,
        },
        risks: {
          volatilityAdjustment: 0,
          liquidityAdjustment: 0,
          executionAdjustment: 0,
          mevAdjustment: 0,
          totalAdjustment: 0,
        },
      },
      optimizedCalculation: {
        maxPotentialProfit: 0,
        optimizedReturn: 0,
        optimizedMargin: 0,
        optimizations: [],
        implementationComplexity: 'high',
      },
      scenarios: [],
      recommendation: {
        action: 'reject',
        reasoning: ['Error in profitability calculation'],
        minProfitThreshold: 0,
        optimalExecutionSize: 0,
        suggestedImprovements: [],
      },
      confidence: 0.1,
    };
  }

  async analyzeBatch(opportunities: ArbitrageOpportunity[]): Promise<ProfitabilityAnalysis[]> {
    const analyses = await Promise.all(
      opportunities.map(opp => this.calculateProfitability(opp))
    );

    return analyses.sort((a, b) => b.adjustedCalculation.netProfit - a.adjustedCalculation.netProfit);
  }

  updateGasPrice(chainId: ChainID, gasPrice: number): void {
    this.gasPrices.set(chainId, gasPrice);
  }

  updateExchangeRate(asset: string, rate: number): void {
    this.exchangeRates.set(asset, rate);
  }

  updateMarketConditions(asset: string, conditions: any): void {
    this.marketConditions.set(asset, conditions);
  }
}