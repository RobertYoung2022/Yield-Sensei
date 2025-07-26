/**
 * Risk Assessment Engine
 * Advanced algorithms for evaluating various types of risks in arbitrage opportunities
 */

import Logger from '../../../shared/logging/logger';
import { RedisManager } from '../../../shared/database/redis-manager';
import { 
  ArbitrageOpportunity,
  ChainID,
  AssetID,
  ExecutionPath
} from '../types';

const logger = Logger.getLogger('risk-assessment-engine');

export interface RiskAssessment {
  opportunityId: string;
  overallRiskScore: number; // 0-100 (0 = lowest risk)
  riskLevel: 'very_low' | 'low' | 'medium' | 'high' | 'very_high';
  riskComponents: {
    marketRisk: MarketRisk;
    executionRisk: ExecutionRisk;
    liquidityRisk: LiquidityRisk;
    mevRisk: MEVRisk;
    technicalRisk: TechnicalRisk;
    counterpartyRisk: CounterpartyRisk;
  };
  riskMitigationSuggestions: string[];
  confidence: number; // 0-1
}

export interface MarketRisk {
  score: number; // 0-100
  volatility: number;
  priceImpact: number;
  correlationRisk: number;
  factors: MarketRiskFactor[];
}

export interface MarketRiskFactor {
  name: string;
  impact: 'low' | 'medium' | 'high';
  description: string;
  mitigation?: string;
}

export interface ExecutionRisk {
  score: number;
  pathComplexity: number;
  timingRisk: number;
  gasRisk: number;
  failurePoints: ExecutionFailurePoint[];
}

export interface ExecutionFailurePoint {
  step: number;
  type: 'swap' | 'bridge' | 'transfer';
  probability: number;
  impact: 'low' | 'medium' | 'high';
  description: string;
}

export interface LiquidityRisk {
  score: number;
  depth: number;
  concentration: number;
  slippageRisk: number;
  liquidityProviders: LiquidityProvider[];
}

export interface LiquidityProvider {
  protocol: string;
  chainId: ChainID;
  liquidity: number;
  reliability: number;
}

export interface MEVRisk {
  score: number;
  frontrunningRisk: number;
  sandwichRisk: number;
  backrunningRisk: number;
  profitExtraction: number;
  protectionStrategies: string[];
}

export interface TechnicalRisk {
  score: number;
  smartContractRisk: number;
  networkRisk: number;
  oracleRisk: number;
  upgradeRisk: number;
  vulnerabilities: TechnicalVulnerability[];
}

export interface TechnicalVulnerability {
  type: 'contract' | 'network' | 'oracle' | 'bridge';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  affectedComponents: string[];
}

export interface CounterpartyRisk {
  score: number;
  bridgeRisk: number;
  protocolRisk: number;
  governanceRisk: number;
  auditStatus: AuditInfo[];
}

export interface AuditInfo {
  protocol: string;
  auditor: string;
  date: number;
  findings: number;
  severity: 'low' | 'medium' | 'high';
}

export class RiskAssessmentEngine {
  private redis: RedisManager;
  private riskModels: Map<string, any> = new Map();
  private historicalData: Map<string, any> = new Map();

  constructor() {
    this.redis = new RedisManager({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      keyPrefix: 'risk-assessment:',
    });
  }

  async initialize(): Promise<void> {
    try {
      await this.redis.connect();
      await this.loadHistoricalRiskData();
      await this.initializeRiskModels();
      
      logger.info('Risk Assessment Engine initialized');
    } catch (error) {
      logger.error('Failed to initialize risk assessment engine:', error);
      throw error;
    }
  }

  private async loadHistoricalRiskData(): Promise<void> {
    try {
      const riskData = await this.redis.get('historical-risk-data');
      if (riskData) {
        const data = JSON.parse(riskData);
        for (const [key, value] of Object.entries(data)) {
          this.historicalData.set(key, value);
        }
        logger.info(`Loaded ${this.historicalData.size} historical risk records`);
      }
    } catch (error) {
      logger.error('Error loading historical risk data:', error);
    }
  }

  private async initializeRiskModels(): Promise<void> {
    // Initialize various risk models
    this.riskModels.set('volatility', this.createVolatilityModel());
    this.riskModels.set('liquidity', this.createLiquidityModel());
    this.riskModels.set('mev', this.createMEVModel());
    this.riskModels.set('technical', this.createTechnicalModel());
  }

  private createVolatilityModel(): any {
    return {
      calculateVolatility: (priceHistory: number[], timeframe: number) => {
        if (priceHistory.length < 2) return 0.1; // Default 10% volatility
        
        const returns = [];
        for (let i = 1; i < priceHistory.length; i++) {
          returns.push(Math.log(priceHistory[i] / priceHistory[i - 1]));
        }
        
        const mean = returns.reduce((sum, ret) => sum + ret, 0) / returns.length;
        const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - mean, 2), 0) / returns.length;
        
        return Math.sqrt(variance * 365); // Annualized volatility
      },
    };
  }

  private createLiquidityModel(): any {
    return {
      assessDepth: (orderBook: any) => {
        // Simplified depth calculation
        if (!orderBook) return 0.5;
        
        const bidDepth = orderBook.bids?.reduce((sum: number, bid: any) => sum + bid.amount, 0) || 0;
        const askDepth = orderBook.asks?.reduce((sum: number, ask: any) => sum + ask.amount, 0) || 0;
        
        return Math.min(bidDepth, askDepth);
      },
    };
  }

  private createMEVModel(): any {
    return {
      calculateFrontrunningRisk: (profit: number, gasPrice: number) => {
        // Higher profit and lower gas prices increase frontrunning risk
        const profitFactor = Math.min(1, profit / 1000); // Normalize to $1000
        const gasFactor = Math.max(0, 1 - gasPrice / 100); // Normalize to 100 gwei
        
        return (profitFactor * 0.7 + gasFactor * 0.3) * 100;
      },
      
      calculateSandwichRisk: (slippage: number, liquidityDepth: number) => {
        // Higher slippage and lower liquidity increase sandwich risk
        const slippageFactor = Math.min(1, slippage / 0.05); // 5% slippage = max risk
        const liquidityFactor = Math.max(0, 1 - liquidityDepth / 1000000); // $1M = low risk
        
        return (slippageFactor * 0.6 + liquidityFactor * 0.4) * 100;
      },
    };
  }

  private createTechnicalModel(): any {
    return {
      assessContractRisk: (contractAddress: string, chainId: ChainID) => {
        // Simplified contract risk assessment
        const knownRiskyContracts = new Set([
          // Add known risky contracts
        ]);
        
        const isKnownRisky = knownRiskyContracts.has(contractAddress.toLowerCase());
        const baseRisk = isKnownRisky ? 80 : 20;
        
        // Adjust based on chain
        const chainRiskMultiplier = this.getChainRiskMultiplier(chainId);
        
        return Math.min(100, baseRisk * chainRiskMultiplier);
      },
    };
  }

  private getChainRiskMultiplier(chainId: ChainID): number {
    const chainRisks: Record<string, number> = {
      'ethereum': 1.0,    // Lowest risk
      'polygon': 1.2,     // Slightly higher
      'arbitrum': 1.1,    // Low risk L2
      'optimism': 1.1,    // Low risk L2
      'avalanche': 1.3,   // Medium risk
      'bsc': 1.4,         // Higher risk
    };
    
    return chainRisks[chainId] || 1.5; // Default higher risk for unknown chains
  }

  async assessRisk(
    opportunity: ArbitrageOpportunity,
    marketData?: any,
    historicalData?: any
  ): Promise<RiskAssessment> {
    try {
      // Assess individual risk components
      const marketRisk = await this.assessMarketRisk(opportunity, marketData);
      const executionRisk = await this.assessExecutionRisk(opportunity);
      const liquidityRisk = await this.assessLiquidityRisk(opportunity, marketData);
      const mevRisk = await this.assessMEVRisk(opportunity, marketData);
      const technicalRisk = await this.assessTechnicalRisk(opportunity);
      const counterpartyRisk = await this.assessCounterpartyRisk(opportunity);

      // Calculate overall risk score (weighted average)
      const weights = {
        market: 0.20,
        execution: 0.18,
        liquidity: 0.16,
        mev: 0.16,
        technical: 0.15,
        counterparty: 0.15,
      };

      const overallRiskScore = 
        marketRisk.score * weights.market +
        executionRisk.score * weights.execution +
        liquidityRisk.score * weights.liquidity +
        mevRisk.score * weights.mev +
        technicalRisk.score * weights.technical +
        counterpartyRisk.score * weights.counterparty;

      // Determine risk level
      const riskLevel = this.determineRiskLevel(overallRiskScore);

      // Generate mitigation suggestions
      const riskMitigationSuggestions = this.generateMitigationSuggestions({
        marketRisk,
        executionRisk,
        liquidityRisk,
        mevRisk,
        technicalRisk,
        counterpartyRisk,
      });

      // Calculate confidence based on data availability
      const confidence = this.calculateConfidence(opportunity, marketData, historicalData);

      return {
        opportunityId: opportunity.id,
        overallRiskScore,
        riskLevel,
        riskComponents: {
          marketRisk,
          executionRisk,
          liquidityRisk,
          mevRisk,
          technicalRisk,
          counterpartyRisk,
        },
        riskMitigationSuggestions,
        confidence,
      };
    } catch (error) {
      logger.error('Error assessing risk:', error);
      
      // Return high-risk assessment on error
      return this.getDefaultHighRiskAssessment(opportunity.id);
    }
  }

  private async assessMarketRisk(
    opportunity: ArbitrageOpportunity,
    marketData?: any
  ): Promise<MarketRisk> {
    const volatilityModel = this.riskModels.get('volatility');
    
    // Calculate volatility
    const priceHistory = marketData?.priceHistory || [];
    const volatility = volatilityModel.calculateVolatility(priceHistory, 24);
    
    // Calculate price impact
    const priceImpact = this.calculatePriceImpact(opportunity, marketData);
    
    // Calculate correlation risk (simplified)
    const correlationRisk = this.calculateCorrelationRisk(opportunity);
    
    // Identify risk factors
    const factors: MarketRiskFactor[] = [];
    
    if (volatility > 0.5) {
      factors.push({
        name: 'High Volatility',
        impact: 'high',
        description: `Asset volatility of ${(volatility * 100).toFixed(1)}% exceeds safe threshold`,
        mitigation: 'Consider reducing position size or using stop losses',
      });
    }
    
    if (priceImpact > 0.02) {
      factors.push({
        name: 'High Price Impact',
        impact: 'medium',
        description: `Price impact of ${(priceImpact * 100).toFixed(2)}% may affect profitability`,
        mitigation: 'Split orders or use different execution strategy',
      });
    }

    // Calculate overall market risk score
    const score = Math.min(100, 
      volatility * 100 * 0.4 + 
      priceImpact * 100 * 0.3 + 
      correlationRisk * 0.3
    );

    return {
      score,
      volatility,
      priceImpact,
      correlationRisk,
      factors,
    };
  }

  private calculatePriceImpact(opportunity: ArbitrageOpportunity, marketData?: any): number {
    // Simplified price impact calculation
    const tradeSize = opportunity.expectedProfit * 10; // Estimate trade size
    const liquidity = marketData?.liquidity || 1000000;
    
    return Math.min(0.1, tradeSize / liquidity); // Max 10% impact
  }

  private calculateCorrelationRisk(opportunity: ArbitrageOpportunity): number {
    // Risk that source and target prices are correlated
    // Higher correlation = higher risk of opportunity disappearing
    
    // Simplified: same asset on different chains has high correlation
    if (opportunity.sourceChain !== opportunity.targetChain) {
      return 30; // Medium correlation risk for cross-chain
    }
    
    return 10; // Low correlation risk for same chain
  }

  private async assessExecutionRisk(opportunity: ArbitrageOpportunity): Promise<ExecutionRisk> {
    const path = opportunity.executionPaths?.[0];
    if (!path) {
      return {
        score: 100,
        pathComplexity: 100,
        timingRisk: 100,
        gasRisk: 100,
        failurePoints: [],
      };
    }

    // Assess path complexity
    const pathComplexity = Math.min(100, path.steps.length * 15); // Each step adds 15% complexity

    // Assess timing risk
    const timingRisk = Math.min(100, opportunity.executionTime / 600 * 100); // 10 minutes = 100% risk

    // Assess gas risk
    const gasRisk = this.assessGasRisk(opportunity, path);

    // Identify failure points
    const failurePoints = this.identifyFailurePoints(path);

    const score = (pathComplexity + timingRisk + gasRisk) / 3;

    return {
      score,
      pathComplexity,
      timingRisk,
      gasRisk,
      failurePoints,
    };
  }

  private assessGasRisk(opportunity: ArbitrageOpportunity, path: ExecutionPath): number {
    // Risk of gas price spikes affecting profitability
    const gasToProfit = opportunity.estimatedGasCost / opportunity.expectedProfit;
    
    if (gasToProfit > 0.5) return 90; // Very high risk
    if (gasToProfit > 0.3) return 70; // High risk
    if (gasToProfit > 0.1) return 40; // Medium risk
    
    return 20; // Low risk
  }

  private identifyFailurePoints(path: ExecutionPath): ExecutionFailurePoint[] {
    const failurePoints: ExecutionFailurePoint[] = [];

    path.steps.forEach((step, index) => {
      let probability = 0.05; // Base 5% failure rate
      let impact: 'low' | 'medium' | 'high' = 'medium';
      let description = '';

      switch (step.type) {
        case 'swap':
          probability = 0.03;
          impact = 'medium';
          description = 'DEX swap may fail due to slippage or insufficient liquidity';
          break;
        case 'bridge':
          probability = 0.08;
          impact = 'high';
          description = 'Bridge transaction may fail or be delayed';
          break;
        case 'transfer':
          probability = 0.01;
          impact = 'low';
          description = 'Token transfer may fail due to network congestion';
          break;
      }

      failurePoints.push({
        step: index,
        type: step.type,
        probability,
        impact,
        description,
      });
    });

    return failurePoints;
  }

  private async assessLiquidityRisk(
    opportunity: ArbitrageOpportunity,
    marketData?: any
  ): Promise<LiquidityRisk> {
    const liquidityModel = this.riskModels.get('liquidity');
    
    // Assess liquidity depth
    const depth = liquidityModel.assessDepth(marketData?.orderBook);
    
    // Calculate concentration risk
    const concentration = this.calculateLiquidityConcentration(marketData);
    
    // Calculate slippage risk
    const slippageRisk = Math.min(100, (marketData?.expectedSlippage || 0.01) * 1000);

    // Identify liquidity providers
    const liquidityProviders = this.identifyLiquidityProviders(opportunity);

    const score = Math.min(100, 
      (1 - Math.min(1, depth / 1000000)) * 40 + // Depth factor
      concentration * 30 + // Concentration factor
      slippageRisk * 30 // Slippage factor
    );

    return {
      score,
      depth,
      concentration,
      slippageRisk,
      liquidityProviders,
    };
  }

  private calculateLiquidityConcentration(marketData?: any): number {
    // Simplified concentration calculation
    // Higher concentration = higher risk
    if (!marketData?.liquidityProviders) return 50; // Default medium concentration
    
    const providers = marketData.liquidityProviders;
    const totalLiquidity = providers.reduce((sum: number, p: any) => sum + p.liquidity, 0);
    
    // Calculate Herfindahl index
    const herfindahl = providers.reduce((sum: number, p: any) => {
      const share = p.liquidity / totalLiquidity;
      return sum + share * share;
    }, 0);
    
    return herfindahl * 100; // Convert to percentage
  }

  private identifyLiquidityProviders(opportunity: ArbitrageOpportunity): LiquidityProvider[] {
    // Simplified provider identification
    const providers: LiquidityProvider[] = [];
    
    if (opportunity.executionPaths?.[0]?.steps) {
      for (const step of opportunity.executionPaths[0].steps) {
        if (step.type === 'swap') {
          providers.push({
            protocol: step.protocol,
            chainId: step.chainId,
            liquidity: 1000000, // Placeholder
            reliability: 0.95, // Placeholder
          });
        }
      }
    }
    
    return providers;
  }

  private async assessMEVRisk(
    opportunity: ArbitrageOpportunity,
    marketData?: any
  ): Promise<MEVRisk> {
    const mevModel = this.riskModels.get('mev');
    
    // Calculate frontrunning risk
    const frontrunningRisk = mevModel.calculateFrontrunningRisk(
      opportunity.expectedProfit,
      marketData?.gasPrice || 50
    );
    
    // Calculate sandwich attack risk
    const sandwichRisk = mevModel.calculateSandwichRisk(
      marketData?.expectedSlippage || 0.01,
      marketData?.liquidity || 1000000
    );
    
    // Calculate backrunning risk (simplified)
    const backrunningRisk = Math.min(50, opportunity.profitMargin * 1000);
    
    // Estimate profit extraction by MEV bots
    const profitExtraction = Math.min(90, (frontrunningRisk + sandwichRisk) / 2);
    
    // Suggest protection strategies
    const protectionStrategies: string[] = [];
    
    if (frontrunningRisk > 60) {
      protectionStrategies.push('Use private mempool or flashloan');
    }
    
    if (sandwichRisk > 60) {
      protectionStrategies.push('Split transaction into smaller parts');
    }
    
    if (profitExtraction > 50) {
      protectionStrategies.push('Use MEV protection service');
    }

    const score = Math.max(frontrunningRisk, sandwichRisk, backrunningRisk);

    return {
      score,
      frontrunningRisk,
      sandwichRisk,
      backrunningRisk,
      profitExtraction,
      protectionStrategies,
    };
  }

  private async assessTechnicalRisk(opportunity: ArbitrageOpportunity): Promise<TechnicalRisk> {
    const technicalModel = this.riskModels.get('technical');
    
    let smartContractRisk = 0;
    let networkRisk = 0;
    const vulnerabilities: TechnicalVulnerability[] = [];

    // Assess smart contract risks
    if (opportunity.executionPaths?.[0]?.steps) {
      for (const step of opportunity.executionPaths[0].steps) {
        const contractRisk = technicalModel.assessContractRisk(step.contractAddress, step.chainId);
        smartContractRisk = Math.max(smartContractRisk, contractRisk);
        
        if (contractRisk > 60) {
          vulnerabilities.push({
            type: 'contract',
            severity: 'high',
            description: `High risk contract: ${step.contractAddress}`,
            affectedComponents: [step.protocol],
          });
        }
      }
    }

    // Assess network risks
    const chains = new Set([opportunity.sourceChain, opportunity.targetChain]);
    for (const chainId of chains) {
      const chainRisk = this.getChainRiskMultiplier(chainId) * 20;
      networkRisk = Math.max(networkRisk, chainRisk);
    }

    // Oracle risk (simplified)
    const oracleRisk = 20; // Default medium risk
    
    // Upgrade risk (simplified)
    const upgradeRisk = 15; // Default low-medium risk

    const score = Math.max(smartContractRisk, networkRisk, oracleRisk, upgradeRisk);

    return {
      score,
      smartContractRisk,
      networkRisk,
      oracleRisk,
      upgradeRisk,
      vulnerabilities,
    };
  }

  private async assessCounterpartyRisk(opportunity: ArbitrageOpportunity): Promise<CounterpartyRisk> {
    // Bridge risk assessment
    const bridgeRisk = this.assessBridgeRisk(opportunity);
    
    // Protocol risk assessment
    const protocolRisk = this.assessProtocolRisk(opportunity);
    
    // Governance risk (simplified)
    const governanceRisk = 25; // Default medium risk
    
    // Audit status (placeholder data)
    const auditStatus: AuditInfo[] = [
      {
        protocol: 'example-protocol',
        auditor: 'Example Auditor',
        date: Date.now() - 86400000 * 90, // 90 days ago
        findings: 3,
        severity: 'medium',
      },
    ];

    const score = Math.max(bridgeRisk, protocolRisk, governanceRisk);

    return {
      score,
      bridgeRisk,
      protocolRisk,
      governanceRisk,
      auditStatus,
    };
  }

  private assessBridgeRisk(opportunity: ArbitrageOpportunity): number {
    if (!opportunity.executionPaths?.[0]?.steps) return 0;
    
    const bridgeSteps = opportunity.executionPaths[0].steps.filter(step => step.type === 'bridge');
    if (bridgeSteps.length === 0) return 0;
    
    // Higher risk for more bridge operations
    return Math.min(80, bridgeSteps.length * 25);
  }

  private assessProtocolRisk(opportunity: ArbitrageOpportunity): number {
    // Simplified protocol risk based on known protocols
    const knownSafeProtocols = new Set(['uniswap-v3', 'sushiswap', 'curve']);
    
    if (!opportunity.executionPaths?.[0]?.steps) return 50;
    
    let maxRisk = 0;
    for (const step of opportunity.executionPaths[0].steps) {
      const risk = knownSafeProtocols.has(step.protocol) ? 10 : 40;
      maxRisk = Math.max(maxRisk, risk);
    }
    
    return maxRisk;
  }

  private determineRiskLevel(score: number): 'very_low' | 'low' | 'medium' | 'high' | 'very_high' {
    if (score < 20) return 'very_low';
    if (score < 40) return 'low';
    if (score < 60) return 'medium';
    if (score < 80) return 'high';
    return 'very_high';
  }

  private generateMitigationSuggestions(riskComponents: any): string[] {
    const suggestions: string[] = [];

    if (riskComponents.marketRisk.score > 60) {
      suggestions.push('Consider reducing position size due to high market volatility');
    }

    if (riskComponents.executionRisk.score > 60) {
      suggestions.push('Simplify execution path or increase gas limit');
    }

    if (riskComponents.liquidityRisk.score > 60) {
      suggestions.push('Split order across multiple venues or wait for better liquidity');
    }

    if (riskComponents.mevRisk.score > 60) {
      suggestions.push('Use MEV protection strategies like private mempool submission');
    }

    if (riskComponents.technicalRisk.score > 60) {
      suggestions.push('Review smart contract security and consider alternative protocols');
    }

    if (riskComponents.counterpartyRisk.score > 60) {
      suggestions.push('Verify bridge security and protocol audit status');
    }

    return suggestions;
  }

  private calculateConfidence(
    opportunity: ArbitrageOpportunity,
    marketData?: any,
    historicalData?: any
  ): number {
    let confidence = 0.5; // Base confidence

    // Increase confidence with more data
    if (marketData?.priceHistory?.length > 100) confidence += 0.2;
    if (marketData?.orderBook) confidence += 0.1;
    if (historicalData?.successRate) confidence += 0.1;
    if (marketData?.liquidity > 1000000) confidence += 0.1;

    return Math.min(1, confidence);
  }

  private getDefaultHighRiskAssessment(opportunityId: string): RiskAssessment {
    return {
      opportunityId,
      overallRiskScore: 95,
      riskLevel: 'very_high',
      riskComponents: {
        marketRisk: { score: 90, volatility: 1, priceImpact: 0.1, correlationRisk: 80, factors: [] },
        executionRisk: { score: 90, pathComplexity: 80, timingRisk: 90, gasRisk: 90, failurePoints: [] },
        liquidityRisk: { score: 90, depth: 0, concentration: 90, slippageRisk: 90, liquidityProviders: [] },
        mevRisk: { score: 90, frontrunningRisk: 90, sandwichRisk: 90, backrunningRisk: 90, profitExtraction: 90, protectionStrategies: [] },
        technicalRisk: { score: 90, smartContractRisk: 90, networkRisk: 90, oracleRisk: 90, upgradeRisk: 90, vulnerabilities: [] },
        counterpartyRisk: { score: 90, bridgeRisk: 90, protocolRisk: 90, governanceRisk: 90, auditStatus: [] },
      },
      riskMitigationSuggestions: ['High risk detected - manual review required'],
      confidence: 0.3,
    };
  }

  async assessBatch(opportunities: ArbitrageOpportunity[]): Promise<RiskAssessment[]> {
    const assessments = await Promise.all(
      opportunities.map(opp => this.assessRisk(opp))
    );

    return assessments.sort((a, b) => a.overallRiskScore - b.overallRiskScore);
  }

  async updateHistoricalData(opportunityId: string, actualOutcome: any): Promise<void> {
    try {
      const key = `outcome:${opportunityId}`;
      this.historicalData.set(key, {
        ...actualOutcome,
        timestamp: Date.now(),
      });

      // Periodically save to Redis
      if (this.historicalData.size % 100 === 0) {
        await this.saveHistoricalData();
      }
    } catch (error) {
      logger.error('Error updating historical data:', error);
    }
  }

  private async saveHistoricalData(): Promise<void> {
    try {
      const data = Object.fromEntries(this.historicalData);
      await this.redis.setex(
        'historical-risk-data',
        86400 * 30, // 30 days
        JSON.stringify(data)
      );
    } catch (error) {
      logger.error('Error saving historical data:', error);
    }
  }
}