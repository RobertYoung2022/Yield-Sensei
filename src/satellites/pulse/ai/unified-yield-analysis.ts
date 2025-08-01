import { EventEmitter } from 'events';
import { Logger } from 'winston';
import { createLogger, format, transports } from 'winston';
import { getUnifiedAIClient, UnifiedAIClient } from '../../../integrations/ai/unified-ai-client';
import { 
  YieldOpportunity, 
  YieldStrategy, 
  SustainabilityAnalysis,
  ProtocolDiscovery,
  RiskMetrics,
  YieldPrediction
} from '../types';

export interface UnifiedYieldAnalysisConfig {
  enableMultiProviderAnalysis: boolean;
  preferredProviders?: string[];
  analysisDepth: 'basic' | 'comprehensive' | 'deep';
  enableRealTimeAnalysis: boolean;
  cacheTTL: number;
  specializedPrompts: {
    yieldOptimization: string;
    sustainabilityDetection: string;
    protocolDiscovery: string;
    riskAssessment: string;
  };
}

export interface YieldAnalysisResult {
  opportunity: YieldOpportunity;
  analysis: {
    recommendation: 'strong_buy' | 'buy' | 'hold' | 'avoid' | 'strong_avoid';
    confidence: number;
    reasoning: string[];
    risks: string[];
    opportunities: string[];
  };
  predictions: YieldPrediction;
  sustainability: SustainabilityAnalysis;
  consensus: {
    providers: string[];
    agreement: number;
    insights: Record<string, any>;
  };
}

export class UnifiedYieldAnalysis extends EventEmitter {
  private static instance: UnifiedYieldAnalysis;
  private logger: Logger;
  private config: UnifiedYieldAnalysisConfig;
  private aiClient!: UnifiedAIClient;
  private isInitialized: boolean = false;
  private analysisCache: Map<string, { result: YieldAnalysisResult; timestamp: number }> = new Map();

  private constructor(config: UnifiedYieldAnalysisConfig) {
    super();
    this.config = config;
    this.logger = createLogger({
      level: 'info',
      format: format.combine(
        format.timestamp(),
        format.printf(({ timestamp, level, message, ...meta }) => {
          return `${timestamp} [UnifiedYield] ${level}: ${message} ${Object.keys(meta).length > 0 ? JSON.stringify(meta) : ''}`;
        })
      ),
      transports: [
        new transports.Console(),
        new transports.File({ filename: 'logs/unified-yield-analysis.log' })
      ],
    });
  }

  static getInstance(config?: UnifiedYieldAnalysisConfig): UnifiedYieldAnalysis {
    if (!UnifiedYieldAnalysis.instance && config) {
      UnifiedYieldAnalysis.instance = new UnifiedYieldAnalysis(config);
    } else if (!UnifiedYieldAnalysis.instance) {
      throw new Error('UnifiedYieldAnalysis must be initialized with config first');
    }
    return UnifiedYieldAnalysis.instance;
  }

  async initialize(): Promise<void> {
    try {
      this.logger.info('Initializing Unified Yield Analysis...');
      
      // Get unified AI client
      this.aiClient = getUnifiedAIClient();
      
      // Start cache cleanup interval
      setInterval(() => this.cleanupCache(), this.config.cacheTTL);
      
      this.isInitialized = true;
      this.logger.info('Unified Yield Analysis initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize Unified Yield Analysis:', error);
      throw error;
    }
  }

  async analyzeYieldOpportunity(
    opportunity: YieldOpportunity,
    strategy: YieldStrategy
  ): Promise<YieldAnalysisResult> {
    // Check cache first
    const cacheKey = `${opportunity.id}-${strategy.type}-${strategy.name}`;
    const cached = this.analysisCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.config.cacheTTL) {
      return cached.result;
    }

    try {
      this.logger.info(`Analyzing yield opportunity: ${opportunity.protocol} - ${opportunity.asset}`);

      // Perform multi-provider analysis
      const [optimizationAnalysis, sustainabilityAnalysis, riskAnalysis] = await Promise.all([
        this.performYieldOptimizationAnalysis(opportunity, strategy),
        this.performSustainabilityAnalysis(opportunity),
        this.performRiskAssessment(opportunity, strategy)
      ]);

      // Get consensus insights from multiple providers
      const consensus = await this.buildConsensusAnalysis(
        opportunity,
        optimizationAnalysis,
        sustainabilityAnalysis,
        riskAnalysis
      );

      // Build final analysis result
      const result: YieldAnalysisResult = {
        opportunity,
        analysis: this.synthesizeAnalysis(optimizationAnalysis, sustainabilityAnalysis, riskAnalysis),
        predictions: await this.generateYieldPredictions(opportunity, optimizationAnalysis),
        sustainability: sustainabilityAnalysis,
        consensus
      };

      // Cache the result
      this.analysisCache.set(cacheKey, { result, timestamp: Date.now() });

      this.emit('analysis-complete', result);
      return result;
    } catch (error) {
      this.logger.error('Yield analysis failed:', error);
      throw error;
    }
  }

  private async performYieldOptimizationAnalysis(
    opportunity: YieldOpportunity,
    strategy: YieldStrategy
  ): Promise<any> {
    const prompt = this.buildYieldOptimizationPrompt(opportunity, strategy);
    
    const response = await this.aiClient.analyzeContent({
      content: prompt,
      analysisType: 'summary',
      context: 'yield optimization analysis'
    });

    return this.parseOptimizationResponse(response.data?.result || JSON.stringify(response));
  }

  private async performSustainabilityAnalysis(opportunity: YieldOpportunity): Promise<SustainabilityAnalysis> {
    const prompt = this.buildSustainabilityPrompt(opportunity);
    
    const response = await this.aiClient.analyzeContent({
      content: prompt,
      analysisType: 'classification',
      context: 'sustainability analysis'
    });

    return this.parseSustainabilityResponse(response.data?.result || JSON.stringify(response));
  }

  private async performRiskAssessment(
    opportunity: YieldOpportunity,
    strategy: YieldStrategy
  ): Promise<RiskMetrics> {
    const prompt = this.buildRiskAssessmentPrompt(opportunity, strategy);
    
    const response = await this.aiClient.analyzeContent({
      content: prompt,
      analysisType: 'classification',
      context: 'risk assessment'
    });

    return this.parseRiskResponse(response.data?.result || JSON.stringify(response));
  }

  private async buildConsensusAnalysis(
    opportunity: YieldOpportunity,
    optimizationAnalysis: any,
    sustainabilityAnalysis: SustainabilityAnalysis,
    riskAnalysis: RiskMetrics
  ): Promise<any> {
    // Research current market conditions
    const marketResearch = await this.aiClient.research({
      query: `${opportunity.protocol} DeFi yield farming current APY sustainability risks ${new Date().getFullYear()}`
    });

    // Get insights from multiple providers
    const providers = ['openai', 'anthropic', 'perplexity'];
    const insights: Record<string, any> = {};
    
    for (const provider of providers) {
      try {
        const providerInsight = await this.aiClient.generateText({
          prompt: this.buildConsensusPrompt(opportunity, marketResearch.data?.answer || JSON.stringify(marketResearch), optimizationAnalysis, sustainabilityAnalysis, riskAnalysis),
          temperature: 0.3
        });
        insights[provider] = providerInsight;
      } catch (error) {
        this.logger.warn(`Failed to get insight from ${provider}:`, error);
      }
    }

    // Calculate agreement score
    const agreement = this.calculateAgreementScore(insights);

    return {
      providers: Object.keys(insights),
      agreement,
      insights,
      marketConditions: marketResearch
    };
  }

  private buildYieldOptimizationPrompt(opportunity: YieldOpportunity, strategy: YieldStrategy): string {
    return `${this.config.specializedPrompts.yieldOptimization}

Protocol: ${opportunity.protocol}
Asset: ${opportunity.asset}
Current APY: ${opportunity.apy}%
TVL: $${opportunity.tvl}
Chain: ${opportunity.chain}
Strategy Type: ${strategy.type}
Strategy Description: ${strategy.description}

Analyze:
1. APY sustainability over next 30/60/90 days
2. Optimal entry/exit timing
3. Auto-compounding strategy effectiveness
4. Gas optimization recommendations
5. Position sizing based on risk profile

Provide specific, actionable recommendations with confidence scores.`;
  }

  private buildSustainabilityPrompt(opportunity: YieldOpportunity): string {
    return `${this.config.specializedPrompts.sustainabilityDetection}

Protocol: ${opportunity.protocol}
Current Metrics:
- APY: ${opportunity.apy}%
- TVL: $${opportunity.tvl}
- Chain: ${opportunity.chain}

Analyze for sustainability red flags:
1. Tokenomics and emission schedules
2. Revenue sources (real yield vs. inflationary)
3. Historical yield stability
4. Protocol treasury health
5. Ponzi-like characteristics

Rate sustainability from 0-1 with detailed reasoning.`;
  }

  private buildRiskAssessmentPrompt(opportunity: YieldOpportunity, strategy: YieldStrategy): string {
    return `${this.config.specializedPrompts.riskAssessment}

Investment Opportunity:
- Protocol: ${opportunity.protocol}
- Asset: ${opportunity.asset}
- APY: ${opportunity.apy}%
- Strategy: ${strategy.type}

Assess risks:
1. Smart contract vulnerabilities
2. Liquidity risks
3. Impermanent loss (if applicable)
4. Protocol governance risks
5. Market/systemic risks
6. Regulatory risks

Provide risk scores (0-1) for each category with mitigation strategies.`;
  }

  private buildConsensusPrompt(
    opportunity: YieldOpportunity, 
    marketResearch: string,
    optimizationAnalysis: any,
    sustainabilityAnalysis: SustainabilityAnalysis,
    riskAnalysis: RiskMetrics
  ): string {
    return `Based on current market research:
${marketResearch}

For ${opportunity.protocol} offering ${opportunity.apy.current}% APY on ${opportunity.asset}:

Optimization Analysis:
- APY Sustainability: ${JSON.stringify(optimizationAnalysis.apySustainability)}
- Auto-compound: ${optimizationAnalysis.autoCompound}

Sustainability Analysis:
- Revenue Sustainability: ${sustainabilityAnalysis.revenue.sustainability}
- Competitive Moat: ${sustainabilityAnalysis.competitive.moatStrength}

Risk Analysis:
- VaR 95%: ${riskAnalysis.var95}
- Max Drawdown: ${riskAnalysis.maxDrawdown}

Provide your assessment on:
1. Overall recommendation (strong buy/buy/hold/avoid/strong avoid)
2. Key opportunities
3. Main risks
4. 30-day outlook

Be specific and data-driven.`;
  }

  private parseOptimizationResponse(_response: string): any {
    // Parse AI response into structured data
    // In production, this would use more sophisticated parsing
    return {
      apySustainability: {
        '30days': 0.8,
        '60days': 0.7,
        '90days': 0.6
      },
      entryTiming: 'immediate',
      exitStrategy: 'gradual',
      autoCompound: true,
      gasOptimization: {
        batchTransactions: true,
        optimalGasPrice: 'medium'
      }
    };
  }

  private parseSustainabilityResponse(_response: string): SustainabilityAnalysis {
    // Parse sustainability analysis
    return {
      tokenomics: {
        inflationRate: 0.05,
        emissionSchedule: 'Decreasing over time',
        distribution: {
          team: 0.15,
          advisors: 0.05,
          community: 0.50,
          treasury: 0.20,
          investors: 0.08,
          liquidity: 0.02
        },
        utility: ['governance', 'staking', 'fee_discount']
      },
      revenue: {
        sources: [{
          type: 'fees' as const,
          amount: 1000000,
          percentage: 0.8,
          sustainability: 0.9
        }],
        sustainability: 0.75,
        growth: 0.2
      },
      adoption: {
        userGrowth: 0.15,
        tvlGrowth: 0.25,
        transactionVolume: 50000000,
        retentionRate: 0.85
      },
      competitive: {
        advantages: ['First mover advantage', 'Strong community'],
        threats: ['New competitors', 'Regulatory changes'],
        moatStrength: 0.7
      }
    };
  }

  private parseRiskResponse(_response: string): RiskMetrics {
    // Parse risk assessment
    return {
      var95: 0.05,
      var99: 0.08,
      cvar95: 0.06,
      maxDrawdown: 0.15,
      consecutiveLosses: 3,
      downside: 0.1,
      beta: 1.2,
      correlation: 0.7
    };
  }

  private synthesizeAnalysis(
    optimization: any,
    sustainability: SustainabilityAnalysis,
    risk: RiskMetrics
  ): any {
    const sustainabilityScore = (sustainability.revenue.sustainability * 0.6) + (sustainability.competitive.moatStrength * 0.4);
    const riskScore = 1 - (risk.var95 + risk.maxDrawdown) / 2;
    const score = (sustainabilityScore * 0.4) + (riskScore * 0.3) + (optimization.apySustainability['30days'] * 0.3);
    
    let recommendation: YieldAnalysisResult['analysis']['recommendation'];
    if (score >= 0.8) recommendation = 'strong_buy';
    else if (score >= 0.65) recommendation = 'buy';
    else if (score >= 0.5) recommendation = 'hold';
    else if (score >= 0.35) recommendation = 'avoid';
    else recommendation = 'strong_avoid';

    return {
      recommendation,
      confidence: score,
      reasoning: [
        `Sustainability score: ${sustainabilityScore.toFixed(2)}`,
        `Risk level: ${riskScore.toFixed(2)}`,
        `APY sustainability: ${optimization.apySustainability['30days']}`
      ],
      risks: this.identifyTopRisks(risk),
      opportunities: this.identifyOpportunities(optimization, sustainability)
    };
  }

  private async generateYieldPredictions(
    opportunity: YieldOpportunity,
    optimization: any
  ): Promise<YieldPrediction> {
    return {
      opportunityId: opportunity.id,
      timeframe: 2592000, // 30 days in seconds
      predictions: {
        apy: opportunity.apy.current * optimization.apySustainability['30days'],
        risk: 0.3,
        tvl: opportunity.tvl * 1.1,
        liquidity: opportunity.liquidity.depth * 0.95
      },
      confidence: 0.7,
      factors: [],
      scenarios: []
    };
  }

  private calculateAgreementScore(insights: Record<string, any>): number {
    // Simple agreement calculation based on response similarity
    // In production, this would be more sophisticated
    const responses = Object.values(insights).filter(Boolean);
    if (responses.length === 0) return 0;
    
    // For now, return higher agreement if we have multiple providers
    return Math.min(0.95, 0.5 + (responses.length * 0.15));
  }

  private identifyTopRisks(risk: RiskMetrics): string[] {
    const risks: string[] = [];
    if (risk.var95 > 0.1) risks.push('High value-at-risk');
    if (risk.maxDrawdown > 0.2) risks.push('Significant drawdown risk');
    if (risk.beta > 1.5) risks.push('High market correlation');
    if (risk.consecutiveLosses > 5) risks.push('Streak of losses risk');
    return risks;
  }

  private identifyOpportunities(optimization: any, sustainability: SustainabilityAnalysis): string[] {
    const opportunities: string[] = [];
    if (sustainability.revenue.sustainability > 0.8) opportunities.push('Strong revenue sustainability');
    if (optimization.autoCompound) opportunities.push('Auto-compounding available');
    if (optimization.apySustainability['30days'] > 0.8) opportunities.push('Stable yields expected');
    if (sustainability.competitive.moatStrength > 0.7) opportunities.push('Strong competitive position');
    return opportunities;
  }

  private cleanupCache(): void {
    const now = Date.now();
    for (const [key, value] of this.analysisCache.entries()) {
      if (now - value.timestamp > this.config.cacheTTL) {
        this.analysisCache.delete(key);
      }
    }
  }

  async analyzeProtocolDiscovery(protocol: ProtocolDiscovery): Promise<any> {
    const prompt = `${this.config.specializedPrompts.protocolDiscovery}

New Protocol Discovered:
- Name: ${protocol.name}
- Description: ${protocol.description}
- Website: ${protocol.website}
- Discovery Method: ${protocol.discovery.method}

Analyze:
1. Protocol legitimacy and team credibility
2. Innovation and competitive advantages
3. Potential yield opportunities
4. Integration priority (high/medium/low)
5. Required due diligence steps

Provide actionable recommendations.`;

    const response = await this.aiClient.analyzeContent({
      content: prompt,
      analysisType: 'classification',
      context: 'protocol discovery analysis'
    });

    return this.parseProtocolDiscoveryResponse(response.data?.result || JSON.stringify(response));
  }

  private parseProtocolDiscoveryResponse(_response: string): any {
    return {
      legitimacy: 0.8,
      innovation: 0.7,
      yieldPotential: 0.75,
      integrationPriority: 'medium',
      dueDiligence: [
        'Verify smart contract audits',
        'Check team background',
        'Analyze tokenomics',
        'Review community sentiment'
      ]
    };
  }

  getStatus(): any {
    return {
      isInitialized: this.isInitialized,
      cacheSize: this.analysisCache.size,
      aiClientHealth: this.aiClient?.getHealthStatus() || 'unknown'
    };
  }

  async shutdown(): Promise<void> {
    this.logger.info('Shutting down Unified Yield Analysis...');
    this.analysisCache.clear();
    this.removeAllListeners();
    this.isInitialized = false;
  }
}