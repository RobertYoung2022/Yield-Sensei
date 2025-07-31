/**
 * Sustainability Detector
 * Advanced analysis of yield sustainability vs unsustainable/Ponzi characteristics
 */

import { EventEmitter } from 'events';
import { Logger } from 'winston';
import { createLogger, format, transports } from 'winston';
import { YieldOpportunity } from '../types';
import { getUnifiedAIClient } from '../../../integrations/ai/unified-ai-client';

export interface SustainabilityDetectorConfig {
  threshold: number; // Sustainability threshold (0-1)
  historicalDataWindow: number; // Days of historical data to analyze
  enablePonziDetection: boolean;
  enableTokenomicsAnalysis: boolean;
  enableRevenueAnalysis: boolean;
  riskWeights: {
    tokenomics: number;
    revenueModel: number;
    governance: number;
    auditScore: number;
    marketMetrics: number;
  };
}

export interface SustainabilityAnalysis {
  score: number; // 0-1, higher is more sustainable
  classification: 'sustainable' | 'questionable' | 'unsustainable' | 'ponzi_risk';
  confidence: number;
  factors: SustainabilityFactor[];
  warnings: SustainabilityWarning[];
  recommendations: string[];
  analysis: {
    tokenomics: TokenomicsAnalysis;
    revenueModel: RevenueModelAnalysis;
    governance: GovernanceAnalysis;
    auditSecurity: AuditSecurityAnalysis;
    marketMetrics: MarketMetricsAnalysis;
  };
}

export interface SustainabilityFactor {
  name: string;
  score: number; // 0-1
  weight: number;
  description: string;
  impact: 'positive' | 'negative' | 'neutral';
}

export interface SustainabilityWarning {
  level: 'low' | 'medium' | 'high' | 'critical';
  category: 'tokenomics' | 'revenue' | 'governance' | 'security' | 'market';
  message: string;
  severity: number; // 0-1
}

export interface TokenomicsAnalysis {
  score: number;
  totalSupply: number;
  inflation: number;
  distribution: {
    teamTokens: number;
    treasuryTokens: number;
    publicTokens: number;
    lockedTokens: number;
  };
  vestingSchedule: {
    hasVesting: boolean;
    cliffPeriod: number; // months
    vestingPeriod: number; // months
  };
  utilityScore: number;
  warnings: string[];
}

export interface RevenueModelAnalysis {
  score: number;
  revenueStreams: RevenueStream[];
  sustainability: number; // How sustainable are the revenue streams
  dependencyRisk: number; // Risk from revenue concentration
  scalability: number; // Can revenues scale with growth
}

export interface RevenueStream {
  name: string;
  percentage: number;
  sustainability: number;
  description: string;
}

export interface GovernanceAnalysis {
  score: number;
  decentralization: number;
  transparency: number;
  communityParticipation: number;
  decisionMaking: {
    hasDAO: boolean;
    votingPower: 'token' | 'reputation' | 'hybrid';
    quorum: number;
    proposalThreshold: number;
  };
}

export interface AuditSecurityAnalysis {
  score: number;
  audits: Array<{
    auditor: string;
    date: Date;
    score: number;
    findings: number;
  }>;
  bugBounty: {
    hasProgram: boolean;
    maxReward: number;
  };
  securityIncidents: number;
  codeQuality: number;
}

export interface MarketMetricsAnalysis {
  score: number;
  tvlTrend: 'increasing' | 'stable' | 'decreasing';
  userGrowth: 'increasing' | 'stable' | 'decreasing';
  volumeTrend: 'increasing' | 'stable' | 'decreasing';
  competitivePosition: number;
  marketShare: number;
}

export class SustainabilityDetector extends EventEmitter {
  private logger: Logger;
  private config: SustainabilityDetectorConfig;
  private aiClient = getUnifiedAIClient();
  private isInitialized: boolean = false;
  private ponziPatterns: Map<string, number[]> = new Map();
  private historicalAnalyses: Map<string, SustainabilityAnalysis[]> = new Map();

  // Known Ponzi/unsustainable patterns
  private ponziIndicators = {
    excessiveAPY: 0.5, // APY > 50% is suspicious
    newUserDependency: 0.8, // Heavy reliance on new users
    lackOfRealRevenue: 0.9, // No real revenue generation
    tokenInflation: 0.3, // High token inflation
    teamTokenConcentration: 0.7, // Team holds >70% of tokens
    noUtility: 0.8, // Token has no real utility
    recentLaunch: 0.6, // Protocol less than 3 months old
    noAudits: 0.5 // No security audits
  };

  constructor(config: SustainabilityDetectorConfig) {
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
        new transports.File({ filename: 'logs/sustainability-detector.log' })
      ],
    });
  }

  async initialize(): Promise<void> {
    try {
      this.logger.info('Initializing Sustainability Detector...');

      // Load known Ponzi patterns
      await this.loadPonziPatterns();

      // Initialize historical data
      await this.loadHistoricalAnalyses();

      this.isInitialized = true;
      this.logger.info('Sustainability Detector initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize Sustainability Detector:', error);
      throw error;
    }
  }

  async analyze(opportunity: YieldOpportunity): Promise<SustainabilityAnalysis> {
    try {
      if (!this.isInitialized) {
        throw new Error('Sustainability Detector not initialized');
      }

      this.logger.debug('Analyzing sustainability for opportunity', { 
        protocol: opportunity.protocol,
        apy: opportunity.apy.current
      });

      // Perform comprehensive analysis
      const tokenomics = await this.analyzeTokenomics(opportunity);
      const revenueModel = await this.analyzeRevenueModel(opportunity);
      const governance = await this.analyzeGovernance(opportunity);
      const auditSecurity = await this.analyzeAuditSecurity(opportunity);
      const marketMetrics = await this.analyzeMarketMetrics(opportunity);

      // Calculate overall sustainability score
      const score = this.calculateOverallScore({
        tokenomics,
        revenueModel,
        governance,
        auditSecurity,
        marketMetrics
      });

      // Generate sustainability factors
      const factors = this.generateSustainabilityFactors({
        tokenomics,
        revenueModel,
        governance,
        auditSecurity,
        marketMetrics
      });

      // Detect warnings and risks
      const warnings = await this.detectWarnings(opportunity, {
        tokenomics,
        revenueModel,
        governance,
        auditSecurity,
        marketMetrics
      });

      // Generate recommendations
      const recommendations = this.generateRecommendations(score, warnings);

      // Classify sustainability
      const classification = this.classifySustainability(score, warnings);

      // Calculate confidence
      const confidence = this.calculateConfidence(opportunity, {
        tokenomics,
        revenueModel,
        governance,
        auditSecurity,
        marketMetrics
      });

      const analysis: SustainabilityAnalysis = {
        score,
        classification,
        confidence,
        factors,
        warnings,
        recommendations,
        analysis: {
          tokenomics,
          revenueModel,
          governance,
          auditSecurity,
          marketMetrics
        }
      };

      // Store historical analysis
      const protocolHistory = this.historicalAnalyses.get(opportunity.protocol) || [];
      protocolHistory.push(analysis);
      if (protocolHistory.length > 10) protocolHistory.shift(); // Keep last 10 analyses
      this.historicalAnalyses.set(opportunity.protocol, protocolHistory);

      // Emit analysis event
      this.emit('sustainability_analyzed', {
        type: 'sustainability_analysis_completed',
        data: {
          protocol: opportunity.protocol,
          analysis
        },
        timestamp: new Date()
      });

      this.logger.info('Sustainability analysis completed', {
        protocol: opportunity.protocol,
        score: (score * 100).toFixed(1) + '%',
        classification,
        confidence: (confidence * 100).toFixed(1) + '%',
        warningsCount: warnings.length
      });

      return analysis;

    } catch (error) {
      this.logger.error('Sustainability analysis failed', { error });
      throw error;
    }
  }

  private async analyzeTokenomics(opportunity: YieldOpportunity): Promise<TokenomicsAnalysis> {
    // Mock tokenomics analysis - in production would fetch from blockchain/APIs
    const mockDistribution = {
      teamTokens: 0.15 + Math.random() * 0.25, // 15-40%
      treasuryTokens: 0.1 + Math.random() * 0.2, // 10-30%
      publicTokens: 0.3 + Math.random() * 0.4, // 30-70%
      lockedTokens: Math.random() * 0.3 // 0-30%
    };

    const totalSupply = 1000000 + Math.random() * 999000000; // 1M - 1B tokens
    const inflation = Math.random() * 0.2; // 0-20% annual inflation
    const utilityScore = Math.random() * 0.8 + 0.2; // 20-100% utility

    const warnings: string[] = [];
    
    // Check for concerning patterns
    if (mockDistribution.teamTokens > 0.3) {
      warnings.push('Team holds excessive token allocation (>30%)');
    }
    
    if (inflation > 0.1) {
      warnings.push('High token inflation rate (>10%)');
    }
    
    if (utilityScore < 0.4) {
      warnings.push('Limited token utility in protocol');
    }

    // Calculate tokenomics score
    let score = 1.0;
    score -= mockDistribution.teamTokens > 0.3 ? 0.3 : 0;
    score -= inflation > 0.1 ? 0.2 : 0;
    score -= utilityScore < 0.4 ? 0.2 : 0;
    score = Math.max(0, score);

    return {
      score,
      totalSupply,
      inflation,
      distribution: mockDistribution,
      vestingSchedule: {
        hasVesting: Math.random() > 0.3,
        cliffPeriod: Math.floor(Math.random() * 12) + 6, // 6-18 months
        vestingPeriod: Math.floor(Math.random() * 24) + 12 // 12-36 months
      },
      utilityScore,
      warnings
    };
  }

  private async analyzeRevenueModel(opportunity: YieldOpportunity): Promise<RevenueModelAnalysis> {
    // Analyze revenue sustainability using AI
    const aiAnalysis = await this.performAIRevenueAnalysis(opportunity);
    
    // Mock revenue streams - in production would analyze actual protocol revenues
    const revenueStreams: RevenueStream[] = [
      {
        name: 'Trading Fees',
        percentage: 0.4 + Math.random() * 0.3,
        sustainability: 0.8,
        description: 'Fees from trading activity'
      },
      {
        name: 'Lending Interest',
        percentage: 0.2 + Math.random() * 0.2,
        sustainability: 0.7,
        description: 'Interest from lending activities'
      },
      {
        name: 'Token Emissions',
        percentage: 0.1 + Math.random() * 0.4,
        sustainability: 0.3, // Token emissions are less sustainable
        description: 'Revenue from token inflation'
      }
    ];

    // Normalize percentages
    const total = revenueStreams.reduce((sum, stream) => sum + stream.percentage, 0);
    revenueStreams.forEach(stream => stream.percentage /= total);

    const sustainability = revenueStreams.reduce((sum, stream) => 
      sum + stream.percentage * stream.sustainability, 0);
    
    const dependencyRisk = Math.max(...revenueStreams.map(s => s.percentage)); // Risk from concentration
    const scalability = aiAnalysis?.scalability || (0.5 + Math.random() * 0.4);

    const score = (sustainability * 0.5) + ((1 - dependencyRisk) * 0.3) + (scalability * 0.2);

    return {
      score,
      revenueStreams,
      sustainability,
      dependencyRisk,
      scalability
    };
  }

  private async performAIRevenueAnalysis(opportunity: YieldOpportunity): Promise<any> {
    try {
      const prompt = `Analyze the revenue model sustainability for this DeFi protocol:

Protocol: ${opportunity.protocol}
Current APY: ${(opportunity.apy.current * 100).toFixed(2)}%
TVL: $${opportunity.tvl?.toFixed(0) || 'Unknown'}
Strategy Type: ${opportunity.strategy?.type || 'Unknown'}

Assess:
1. Revenue source sustainability (real fees vs token emissions)
2. Scalability of the revenue model
3. Dependency risks and concentration
4. Long-term viability

Respond in JSON:
{
  "sustainability_score": 0.XX,
  "scalability": 0.XX,
  "primary_revenue_source": "description",
  "sustainability_analysis": "detailed analysis",
  "risks": ["risk1", "risk2"]
}`;

      const result = await this.aiClient.generateText({
        prompt,
        maxTokens: 800,
        temperature: 0.2,
        systemPrompt: 'You are a DeFi protocol analyst specializing in revenue model sustainability.'
      });

      if (result.success && result.data?.text) {
        try {
          return JSON.parse(result.data.text);
        } catch (parseError) {
          this.logger.debug('Failed to parse AI revenue analysis:', parseError);
        }
      }
    } catch (error) {
      this.logger.debug('AI revenue analysis failed:', error);
    }

    return null;
  }

  private async analyzeGovernance(opportunity: YieldOpportunity): Promise<GovernanceAnalysis> {
    // Mock governance analysis
    const hasDAO = Math.random() > 0.4;
    const decentralization = hasDAO ? 0.3 + Math.random() * 0.6 : 0.1 + Math.random() * 0.3;
    const transparency = 0.2 + Math.random() * 0.7;
    const communityParticipation = hasDAO ? 0.1 + Math.random() * 0.5 : 0.05 + Math.random() * 0.2;

    const score = (decentralization * 0.4) + (transparency * 0.3) + (communityParticipation * 0.3);

    return {
      score,
      decentralization,
      transparency,
      communityParticipation,
      decisionMaking: {
        hasDAO,
        votingPower: hasDAO ? 'token' : 'reputation',
        quorum: hasDAO ? 0.05 + Math.random() * 0.15 : 0, // 5-20% quorum
        proposalThreshold: hasDAO ? 0.001 + Math.random() * 0.01 : 0 // 0.1-1.1% threshold
      }
    };
  }

  private async analyzeAuditSecurity(opportunity: YieldOpportunity): Promise<AuditSecurityAnalysis> {
    // Mock audit and security analysis
    const auditCount = Math.floor(Math.random() * 4); // 0-3 audits
    const audits = [];
    
    for (let i = 0; i < auditCount; i++) {
      audits.push({
        auditor: ['Certik', 'ConsenSys', 'Trail of Bits', 'OpenZeppelin'][i],
        date: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000),
        score: 0.6 + Math.random() * 0.4, // 60-100% audit score
        findings: Math.floor(Math.random() * 10) // 0-9 findings
      });
    }

    const hasBugBounty = Math.random() > 0.6;
    const securityIncidents = Math.floor(Math.random() * 3); // 0-2 incidents
    const codeQuality = 0.5 + Math.random() * 0.5;

    // Calculate score based on audits, bug bounty, and incidents
    let score = 0.3; // Base score
    score += auditCount * 0.2; // +20% per audit
    score += hasBugBounty ? 0.1 : 0; // +10% for bug bounty
    score -= securityIncidents * 0.15; // -15% per incident
    score = Math.max(0, Math.min(1, score));

    return {
      score,
      audits,
      bugBounty: {
        hasProgram: hasBugBounty,
        maxReward: hasBugBounty ? 10000 + Math.random() * 90000 : 0 // $10k-$100k
      },
      securityIncidents,
      codeQuality
    };
  }

  private async analyzeMarketMetrics(opportunity: YieldOpportunity): Promise<MarketMetricsAnalysis> {
    // Mock market metrics analysis
    const trends = ['increasing', 'stable', 'decreasing'] as const;
    const tvlTrend = trends[Math.floor(Math.random() * trends.length)];
    const userGrowth = trends[Math.floor(Math.random() * trends.length)];
    const volumeTrend = trends[Math.floor(Math.random() * trends.length)];
    
    const competitivePosition = Math.random() * 0.8 + 0.2; // 20-100%
    const marketShare = Math.random() * 0.1; // 0-10% market share

    // Calculate score based on trends and position
    let score = 0.5; // Base score
    score += tvlTrend === 'increasing' ? 0.2 : tvlTrend === 'stable' ? 0.1 : 0;
    score += userGrowth === 'increasing' ? 0.2 : userGrowth === 'stable' ? 0.1 : 0;
    score += volumeTrend === 'increasing' ? 0.1 : volumeTrend === 'stable' ? 0.05 : 0;
    score = Math.min(1, score);

    return {
      score,
      tvlTrend,
      userGrowth,
      volumeTrend,
      competitivePosition,
      marketShare
    };
  }

  private calculateOverallScore(analyses: {
    tokenomics: TokenomicsAnalysis;
    revenueModel: RevenueModelAnalysis;
    governance: GovernanceAnalysis;
    auditSecurity: AuditSecurityAnalysis;
    marketMetrics: MarketMetricsAnalysis;
  }): number {
    const weights = this.config.riskWeights;
    
    return (
      analyses.tokenomics.score * weights.tokenomics +
      analyses.revenueModel.score * weights.revenueModel +
      analyses.governance.score * weights.governance +
      analyses.auditSecurity.score * weights.auditScore +
      analyses.marketMetrics.score * weights.marketMetrics
    );
  }

  private generateSustainabilityFactors(analyses: any): SustainabilityFactor[] {
    return [
      {
        name: 'Tokenomics Health',
        score: analyses.tokenomics.score,
        weight: this.config.riskWeights.tokenomics,
        description: 'Token distribution, inflation, and utility analysis',
        impact: analyses.tokenomics.score > 0.7 ? 'positive' : analyses.tokenomics.score > 0.4 ? 'neutral' : 'negative'
      },
      {
        name: 'Revenue Sustainability',
        score: analyses.revenueModel.score,
        weight: this.config.riskWeights.revenueModel,
        description: 'Analysis of revenue sources and long-term viability',
        impact: analyses.revenueModel.score > 0.7 ? 'positive' : analyses.revenueModel.score > 0.4 ? 'neutral' : 'negative'
      },
      {
        name: 'Governance Quality',
        score: analyses.governance.score,
        weight: this.config.riskWeights.governance,
        description: 'Decentralization and community participation',
        impact: analyses.governance.score > 0.6 ? 'positive' : analyses.governance.score > 0.3 ? 'neutral' : 'negative'
      },
      {
        name: 'Security & Audits',
        score: analyses.auditSecurity.score,
        weight: this.config.riskWeights.auditScore,
        description: 'Security audits and incident history',
        impact: analyses.auditSecurity.score > 0.7 ? 'positive' : analyses.auditSecurity.score > 0.4 ? 'neutral' : 'negative'
      },
      {
        name: 'Market Position',
        score: analyses.marketMetrics.score,
        weight: this.config.riskWeights.marketMetrics,
        description: 'Market trends and competitive position',
        impact: analyses.marketMetrics.score > 0.6 ? 'positive' : analyses.marketMetrics.score > 0.3 ? 'neutral' : 'negative'
      }
    ];
  }

  private async detectWarnings(opportunity: YieldOpportunity, analyses: any): Promise<SustainabilityWarning[]> {
    const warnings: SustainabilityWarning[] = [];

    // Check for Ponzi-like characteristics
    if (opportunity.apy.current > this.ponziIndicators.excessiveAPY) {
      warnings.push({
        level: 'high',
        category: 'market',
        message: `Extremely high APY (${(opportunity.apy.current * 100).toFixed(1)}%) raises Ponzi scheme concerns`,
        severity: 0.8
      });
    }

    // Tokenomics warnings
    if (analyses.tokenomics.distribution.teamTokens > 0.5) {
      warnings.push({
        level: 'critical',
        category: 'tokenomics',
        message: 'Team controls majority of token supply',
        severity: 0.9
      });
    }

    // Revenue model warnings
    if (analyses.revenueModel.dependencyRisk > 0.8) {
      warnings.push({
        level: 'high',
        category: 'revenue',
        message: 'Revenue heavily dependent on single source',
        severity: 0.7
      });
    }

    // Security warnings
    if (analyses.auditSecurity.audits.length === 0) {
      warnings.push({
        level: 'medium',
        category: 'security',
        message: 'No security audits found',
        severity: 0.6
      });
    }

    if (analyses.auditSecurity.securityIncidents > 1) {
      warnings.push({
        level: 'high',
        category: 'security',
        message: 'Multiple security incidents recorded',
        severity: 0.8
      });
    }

    // Market warnings
    if (analyses.marketMetrics.tvlTrend === 'decreasing' && 
        analyses.marketMetrics.userGrowth === 'decreasing') {
      warnings.push({
        level: 'medium',
        category: 'market',
        message: 'Declining TVL and user growth indicates potential issues',
        severity: 0.6
      });
    }

    return warnings.sort((a, b) => b.severity - a.severity);
  }

  private generateRecommendations(score: number, warnings: SustainabilityWarning[]): string[] {
    const recommendations: string[] = [];

    if (score < 0.3) {
      recommendations.push('Avoid this protocol due to high sustainability risks');
      recommendations.push('Consider waiting for protocol improvements before investing');
    } else if (score < 0.6) {
      recommendations.push('Proceed with caution and limit position size');
      recommendations.push('Monitor protocol developments closely');
    } else {
      recommendations.push('Protocol appears sustainable with acceptable risk levels');
    }

    // Add specific recommendations based on warnings
    const criticalWarnings = warnings.filter(w => w.level === 'critical');
    if (criticalWarnings.length > 0) {
      recommendations.push('Address critical security and governance issues immediately');
    }

    const highWarnings = warnings.filter(w => w.level === 'high');
    if (highWarnings.length > 2) {
      recommendations.push('Multiple high-risk factors require careful evaluation');
    }

    return recommendations;
  }

  private classifySustainability(
    score: number, 
    warnings: SustainabilityWarning[]
  ): 'sustainable' | 'questionable' | 'unsustainable' | 'ponzi_risk' {
    const criticalWarnings = warnings.filter(w => w.level === 'critical').length;
    const highWarnings = warnings.filter(w => w.level === 'high').length;

    if (criticalWarnings > 0 || score < 0.2) {
      return 'ponzi_risk';
    } else if (score < 0.4 || highWarnings > 2) {
      return 'unsustainable';
    } else if (score < 0.6 || highWarnings > 0) {
      return 'questionable';
    } else {
      return 'sustainable';
    }
  }

  private calculateConfidence(opportunity: YieldOpportunity, analyses: any): number {
    let confidence = 0.5; // Base confidence

    // Increase confidence with more data availability
    if (opportunity.tvl && opportunity.tvl > 1000000) confidence += 0.1;
    if (analyses.auditSecurity.audits.length > 0) confidence += 0.2;
    if (analyses.governance.decisionMaking.hasDAO) confidence += 0.1;
    if (analyses.marketMetrics.marketShare > 0.01) confidence += 0.1;

    return Math.min(confidence, 0.95);
  }

  private async loadPonziPatterns(): Promise<void> {
    // Load known Ponzi scheme patterns for detection
    const patterns = [
      'excessive_apy', 'new_user_dependency', 'lack_real_revenue',
      'token_inflation', 'team_concentration', 'no_utility'
    ];

    patterns.forEach(pattern => {
      this.ponziPatterns.set(pattern, [Math.random(), Math.random(), Math.random()]);
    });

    this.logger.info(`Loaded ${patterns.length} Ponzi detection patterns`);
  }

  private async loadHistoricalAnalyses(): Promise<void> {
    // Initialize empty historical analyses
    this.logger.info('Historical analyses initialized');
  }

  getStatus(): any {
    return {
      isInitialized: this.isInitialized,
      ponziPatternsLoaded: this.ponziPatterns.size,
      historicalAnalysesCount: Array.from(this.historicalAnalyses.values())
        .reduce((total, analyses) => total + analyses.length, 0),
      config: this.config
    };
  }
}