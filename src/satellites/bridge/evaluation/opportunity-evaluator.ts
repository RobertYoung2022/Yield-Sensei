/**
 * Opportunity Evaluator
 * Central evaluation system that combines all analysis components to rank and prioritize opportunities
 */

import Logger from '../../../shared/logging/logger';
import { 
  ArbitrageOpportunity
} from '../types';
import { OpportunityScoringEngine, OpportunityScore } from './opportunity-scoring-engine';
import { RiskAssessmentEngine, RiskAssessment } from './risk-assessment-engine';
import { ProfitabilityCalculator, ProfitabilityAnalysis } from './profitability-calculator';
import { ExecutionFeasibilityAnalyzer, FeasibilityAnalysis } from './execution-feasibility-analyzer';

const logger = Logger.getLogger('opportunity-evaluator');

export interface ComprehensiveEvaluation {
  opportunityId: string;
  opportunity: ArbitrageOpportunity;
  evaluationTimestamp: number;
  
  // Component evaluations
  scoring: OpportunityScore;
  riskAssessment: RiskAssessment;
  profitabilityAnalysis: ProfitabilityAnalysis;
  feasibilityAnalysis: FeasibilityAnalysis;
  
  // Combined metrics
  finalScore: number; // 0-100
  priority: 'critical' | 'high' | 'medium' | 'low' | 'ignore';
  recommendation: EvaluationRecommendation;
  
  // Decision factors
  strengthsAndWeaknesses: StrengthsAndWeaknesses;
  keyMetrics: KeyMetrics;
  executionPlan: ExecutionPlan;
}

export interface EvaluationRecommendation {
  action: 'execute_immediately' | 'execute_optimized' | 'monitor_closely' | 'defer' | 'reject';
  confidence: number; // 0-1
  reasoning: string[];
  conditions: string[];
  timeline: string;
  alternatives: string[];
}

export interface StrengthsAndWeaknesses {
  strengths: string[];
  weaknesses: string[];
  criticalFactors: string[];
  improvementAreas: string[];
}

export interface KeyMetrics {
  expectedReturn: number;
  riskAdjustedReturn: number;
  probabilityOfSuccess: number;
  timeToExecution: number;
  capitalEfficiency: number;
  competitiveAdvantage: number;
}

export interface ExecutionPlan {
  recommendedApproach: string;
  preconditions: string[];
  executionSteps: ExecutionStep[];
  contingencyPlans: ContingencyPlan[];
  monitoringPoints: MonitoringPoint[];
}

export interface ExecutionStep {
  order: number;
  action: string;
  expectedDuration: number;
  dependencies: string[];
  successCriteria: string[];
  riskMitigation: string[];
}

export interface ContingencyPlan {
  trigger: string;
  action: string;
  cost: number;
  probability: number;
}

export interface MonitoringPoint {
  metric: string;
  threshold: number;
  action: string;
  urgency: 'low' | 'medium' | 'high' | 'critical';
}

export interface EvaluationConfig {
  scoring: {
    mlWeight: number;
    componentWeight: number;
    historicalWeight: number;
  };
  risk: {
    maxAcceptableRisk: number;
    riskTolerance: 'conservative' | 'moderate' | 'aggressive';
  };
  profitability: {
    minProfitThreshold: number;
    minMarginThreshold: number;
  };
  feasibility: {
    minFeasibilityScore: number;
    maxExecutionTime: number;
  };
  prioritization: {
    weights: {
      profitability: number;
      risk: number;
      feasibility: number;
      timing: number;
    };
  };
}

export class OpportunityEvaluator {
  private scoringEngine: OpportunityScoringEngine;
  private riskEngine: RiskAssessmentEngine;
  private profitabilityCalculator: ProfitabilityCalculator;
  private feasibilityAnalyzer: ExecutionFeasibilityAnalyzer;
  private config: EvaluationConfig;

  constructor(config?: Partial<EvaluationConfig>) {
    this.scoringEngine = new OpportunityScoringEngine();
    this.riskEngine = new RiskAssessmentEngine();
    this.profitabilityCalculator = new ProfitabilityCalculator();
    this.feasibilityAnalyzer = new ExecutionFeasibilityAnalyzer();

    // Default configuration
    this.config = {
      scoring: {
        mlWeight: 0.4,
        componentWeight: 0.4,
        historicalWeight: 0.2,
      },
      risk: {
        maxAcceptableRisk: 70,
        riskTolerance: 'moderate',
      },
      profitability: {
        minProfitThreshold: 10, // $10 minimum
        minMarginThreshold: 0.005, // 0.5% minimum margin
      },
      feasibility: {
        minFeasibilityScore: 50,
        maxExecutionTime: 600, // 10 minutes
      },
      prioritization: {
        weights: {
          profitability: 0.35,
          risk: 0.25,
          feasibility: 0.25,
          timing: 0.15,
        },
      },
      ...config,
    };
  }

  async initialize(): Promise<void> {
    try {
      await Promise.all([
        this.scoringEngine.initialize(),
        this.riskEngine.initialize(),
      ]);
      
      logger.info('Opportunity Evaluator initialized');
    } catch (error) {
      logger.error('Failed to initialize Opportunity Evaluator:', error);
      throw error;
    }
  }

  async evaluateOpportunity(
    opportunity: ArbitrageOpportunity,
    marketData?: any,
    currentResources?: any
  ): Promise<ComprehensiveEvaluation> {
    try {
      logger.debug(`Evaluating opportunity ${opportunity.id}`);

      // Run all evaluations in parallel for efficiency
      const [scoring, riskAssessment, profitabilityAnalysis, feasibilityAnalysis] = await Promise.all([
        this.scoringEngine.scoreOpportunity(opportunity, marketData),
        this.riskEngine.assessRisk(opportunity, marketData),
        this.profitabilityCalculator.calculateProfitability(opportunity, marketData),
        this.feasibilityAnalyzer.analyzeFeasibility(opportunity, currentResources),
      ]);

      // Calculate final combined score
      const finalScore = this.calculateFinalScore({
        scoring,
        riskAssessment,
        profitabilityAnalysis,
        feasibilityAnalysis,
      });

      // Determine priority level
      const priority = this.determinePriority(finalScore, {
        scoring,
        riskAssessment,
        profitabilityAnalysis,
        feasibilityAnalysis,
      });

      // Generate comprehensive recommendation
      const recommendation = this.generateRecommendation({
        scoring,
        riskAssessment,
        profitabilityAnalysis,
        feasibilityAnalysis,
        finalScore,
        priority,
      });

      // Analyze strengths and weaknesses
      const strengthsAndWeaknesses = this.analyzeStrengthsAndWeaknesses({
        scoring,
        riskAssessment,
        profitabilityAnalysis,
        feasibilityAnalysis,
      });

      // Calculate key metrics
      const keyMetrics = this.calculateKeyMetrics({
        scoring,
        riskAssessment,
        profitabilityAnalysis,
        feasibilityAnalysis,
      });

      // Generate execution plan
      const executionPlan = this.generateExecutionPlan({
        opportunity,
        scoring,
        riskAssessment,
        profitabilityAnalysis,
        feasibilityAnalysis,
        recommendation,
      });

      return {
        opportunityId: opportunity.id,
        opportunity,
        evaluationTimestamp: Date.now(),
        scoring,
        riskAssessment,
        profitabilityAnalysis,
        feasibilityAnalysis,
        finalScore,
        priority,
        recommendation,
        strengthsAndWeaknesses,
        keyMetrics,
        executionPlan,
      };
    } catch (error) {
      logger.error(`Error evaluating opportunity ${opportunity.id}:`, error);
      return this.getDefaultEvaluation(opportunity);
    }
  }

  private calculateFinalScore(components: {
    scoring: OpportunityScore;
    riskAssessment: RiskAssessment;
    profitabilityAnalysis: ProfitabilityAnalysis;
    feasibilityAnalysis: FeasibilityAnalysis;
  }): number {
    const { weights } = this.config.prioritization;
    
    // Normalize scores to 0-100 scale
    const profitabilityScore = this.normalizeProfitabilityScore(components.profitabilityAnalysis);
    const riskScore = 100 - components.riskAssessment.overallRiskScore; // Invert risk (lower risk = higher score)
    const feasibilityScore = components.feasibilityAnalysis.overallFeasibilityScore;
    const timingScore = this.calculateTimingScore(components.scoring);

    // Weighted combination
    const finalScore = 
      profitabilityScore * weights.profitability +
      riskScore * weights.risk +
      feasibilityScore * weights.feasibility +
      timingScore * weights.timing;

    return Math.min(100, Math.max(0, finalScore));
  }

  private normalizeProfitabilityScore(analysis: ProfitabilityAnalysis): number {
    // Convert profitability metrics to 0-100 score
    const netProfit = analysis.adjustedCalculation.netProfit;
    const margin = analysis.adjustedCalculation.adjustedMargin;
    
    // Base score from profit amount
    let score = Math.min(100, (netProfit / this.config.profitability.minProfitThreshold) * 30);
    
    // Add score from margin
    score += Math.min(70, (margin / this.config.profitability.minMarginThreshold) * 70);
    
    return Math.min(100, score);
  }

  private calculateTimingScore(scoring: OpportunityScore): number {
    // Higher time sensitivity scores are better
    return scoring.componentScores.timeSensitivity;
  }

  private determinePriority(
    finalScore: number,
    components: any
  ): ComprehensiveEvaluation['priority'] {
    // Check for critical factors that override score
    if (components.riskAssessment.overallRiskScore > this.config.risk.maxAcceptableRisk) {
      return 'ignore';
    }

    if (components.feasibilityAnalysis.overallFeasibilityScore < this.config.feasibility.minFeasibilityScore) {
      return 'ignore';
    }

    if (components.profitabilityAnalysis.adjustedCalculation.netProfit < this.config.profitability.minProfitThreshold) {
      return 'ignore';
    }

    // Score-based priority
    if (finalScore >= 90) return 'critical';
    if (finalScore >= 75) return 'high';
    if (finalScore >= 50) return 'medium';
    if (finalScore >= 25) return 'low';
    return 'ignore';
  }

  private generateRecommendation(context: {
    scoring: OpportunityScore;
    riskAssessment: RiskAssessment;
    profitabilityAnalysis: ProfitabilityAnalysis;
    feasibilityAnalysis: FeasibilityAnalysis;
    finalScore: number;
    priority: ComprehensiveEvaluation['priority'];
  }): EvaluationRecommendation {
    const reasoning: string[] = [];
    const conditions: string[] = [];
    const alternatives: string[] = [];

    // Base recommendation logic
    let action: EvaluationRecommendation['action'];
    let confidence: number;
    let timeline: string;

    if (context.priority === 'ignore') {
      action = 'reject';
      confidence = 0.9;
      timeline = 'N/A';
      reasoning.push('Opportunity fails minimum acceptance criteria');
    } else if (context.priority === 'critical' && context.feasibilityAnalysis.recommendation.action === 'proceed') {
      action = 'execute_immediately';
      confidence = Math.min(0.95, context.finalScore / 100);
      timeline = 'Execute within 30 seconds';
      reasoning.push('High-value opportunity with immediate execution recommended');
    } else if (context.priority === 'high' && context.profitabilityAnalysis.recommendation.action === 'execute') {
      if (context.feasibilityAnalysis.recommendation.action === 'optimize') {
        action = 'execute_optimized';
        confidence = 0.8;
        timeline = 'Optimize then execute within 2 minutes';
        reasoning.push('High-value opportunity requiring optimization');
      } else {
        action = 'execute_immediately';
        confidence = 0.85;
        timeline = 'Execute within 1 minute';
        reasoning.push('High-value opportunity ready for execution');
      }
    } else if (context.finalScore >= 40) {
      action = 'monitor_closely';
      confidence = 0.7;
      timeline = 'Monitor for 5-10 minutes';
      reasoning.push('Decent opportunity - monitor for improvement');
    } else {
      action = 'defer';
      confidence = 0.6;
      timeline = 'Wait for better conditions';
      reasoning.push('Marginal opportunity - defer execution');
    }

    // Add specific conditions
    if (context.riskAssessment.overallRiskScore > 50) {
      conditions.push('Monitor risk levels closely');
    }

    if (context.feasibilityAnalysis.bottlenecks.length > 0) {
      conditions.push('Address identified bottlenecks');
    }

    // Add alternatives from profitability analysis
    if (context.profitabilityAnalysis.optimizedCalculation.optimizations.length > 0) {
      alternatives.push('Execute with optimizations');
    }

    if (context.feasibilityAnalysis.alternatives.length > 0) {
      alternatives.push(...context.feasibilityAnalysis.alternatives.map(alt => alt.description));
    }

    return {
      action,
      confidence,
      reasoning,
      conditions,
      timeline,
      alternatives,
    };
  }

  private analyzeStrengthsAndWeaknesses(components: {
    scoring: OpportunityScore;
    riskAssessment: RiskAssessment;
    profitabilityAnalysis: ProfitabilityAnalysis;
    feasibilityAnalysis: FeasibilityAnalysis;
  }): StrengthsAndWeaknesses {
    const strengths: string[] = [];
    const weaknesses: string[] = [];
    const criticalFactors: string[] = [];
    const improvementAreas: string[] = [];

    // Analyze scoring components
    Object.entries(components.scoring.componentScores).forEach(([component, score]) => {
      if (score > 80) {
        strengths.push(`Excellent ${component} (${score.toFixed(1)})`);
      } else if (score < 40) {
        weaknesses.push(`Poor ${component} (${score.toFixed(1)})`);
        improvementAreas.push(`Improve ${component}`);
      }
    });

    // Analyze risk factors
    if (components.riskAssessment.overallRiskScore < 30) {
      strengths.push('Very low risk profile');
    } else if (components.riskAssessment.overallRiskScore > 70) {
      weaknesses.push('High risk profile');
      criticalFactors.push('Risk management essential');
    }

    // Analyze profitability
    const netProfit = components.profitabilityAnalysis.adjustedCalculation.netProfit;
    const margin = components.profitabilityAnalysis.adjustedCalculation.adjustedMargin;
    
    if (netProfit > 100) {
      strengths.push(`High absolute profit ($${netProfit.toFixed(2)})`);
    }
    
    if (margin > 0.05) {
      strengths.push(`Excellent profit margin (${(margin * 100).toFixed(2)}%)`);
    } else if (margin < 0.01) {
      weaknesses.push(`Low profit margin (${(margin * 100).toFixed(2)}%)`);
    }

    // Analyze feasibility
    if (components.feasibilityAnalysis.overallFeasibilityScore > 80) {
      strengths.push('High execution feasibility');
    } else if (components.feasibilityAnalysis.overallFeasibilityScore < 40) {
      weaknesses.push('Low execution feasibility');
      criticalFactors.push('Address feasibility constraints');
    }

    return {
      strengths,
      weaknesses,
      criticalFactors,
      improvementAreas,
    };
  }

  private calculateKeyMetrics(components: {
    scoring: OpportunityScore;
    riskAssessment: RiskAssessment;
    profitabilityAnalysis: ProfitabilityAnalysis;
    feasibilityAnalysis: FeasibilityAnalysis;
  }): KeyMetrics {
    const expectedReturn = components.profitabilityAnalysis.adjustedCalculation.netProfit;
    
    // Risk-adjusted return (Sharpe ratio style)
    const riskPenalty = components.riskAssessment.overallRiskScore / 100;
    const riskAdjustedReturn = expectedReturn * (1 - riskPenalty);
    
    const probabilityOfSuccess = components.feasibilityAnalysis.executionProbability;
    
    // Estimate time to execution
    const timeToExecution = components.feasibilityAnalysis.components.timingFeasibility.executionWindow;
    
    // Capital efficiency (return per dollar invested)
    const capitalRequirement = components.profitabilityAnalysis.adjustedCalculation.costs.totalCosts;
    const capitalEfficiency = capitalRequirement > 0 ? expectedReturn / capitalRequirement : 0;
    
    // Competitive advantage (combination of timing and uniqueness)
    const competitiveAdvantage = 
      components.scoring.componentScores.timeSensitivity * 0.4 +
      components.scoring.componentScores.historicalSuccess * 0.3 +
      components.feasibilityAnalysis.overallFeasibilityScore * 0.3;

    return {
      expectedReturn,
      riskAdjustedReturn,
      probabilityOfSuccess,
      timeToExecution,
      capitalEfficiency,
      competitiveAdvantage,
    };
  }

  private generateExecutionPlan(context: {
    opportunity: ArbitrageOpportunity;
    scoring: OpportunityScore;
    riskAssessment: RiskAssessment;
    profitabilityAnalysis: ProfitabilityAnalysis;
    feasibilityAnalysis: FeasibilityAnalysis;
    recommendation: EvaluationRecommendation;
  }): ExecutionPlan {
    let recommendedApproach: string;
    const preconditions: string[] = [];
    const executionSteps: ExecutionStep[] = [];
    const contingencyPlans: ContingencyPlan[] = [];
    const monitoringPoints: MonitoringPoint[] = [];

    // Determine recommended approach
    switch (context.recommendation.action) {
      case 'execute_immediately':
        recommendedApproach = 'Direct execution with minimal delay';
        break;
      case 'execute_optimized':
        recommendedApproach = 'Execute with pre-optimization';
        break;
      case 'monitor_closely':
        recommendedApproach = 'Active monitoring with ready-to-execute setup';
        break;
      default:
        recommendedApproach = 'No execution recommended';
    }

    // Add preconditions
    if (context.feasibilityAnalysis.requirements.some(r => r.currentStatus !== 'met')) {
      preconditions.push('Ensure all execution requirements are met');
    }

    if (context.riskAssessment.overallRiskScore > 50) {
      preconditions.push('Implement risk mitigation measures');
    }

    // Generate execution steps
    if (context.recommendation.action.includes('execute')) {
      const path = context.opportunity.executionPaths?.[0];
      if (path) {
        path.steps.forEach((step, index) => {
          executionSteps.push({
            order: index + 1,
            action: `Execute ${step.type} on ${step.chainId} via ${step.protocol}`,
            expectedDuration: step.estimatedTime,
            dependencies: step.dependencies,
            successCriteria: [`Transaction confirmed on ${step.chainId}`],
            riskMitigation: ['Monitor gas prices', 'Set appropriate slippage tolerance'],
          });
        });
      }
    }

    // Generate contingency plans
    contingencyPlans.push({
      trigger: 'Gas price spike > 50%',
      action: 'Pause execution and reassess',
      cost: 0,
      probability: 0.1,
    });

    contingencyPlans.push({
      trigger: 'Price movement > 2%',
      action: 'Recalculate profitability',
      cost: 5, // $5 delay cost
      probability: 0.15,
    });

    // Generate monitoring points
    monitoringPoints.push({
      metric: 'Price deviation',
      threshold: 0.01, // 1%
      action: 'Recalculate opportunity',
      urgency: 'high',
    });

    monitoringPoints.push({
      metric: 'Gas price change',
      threshold: 0.2, // 20%
      action: 'Adjust execution parameters',
      urgency: 'medium',
    });

    return {
      recommendedApproach,
      preconditions,
      executionSteps,
      contingencyPlans,
      monitoringPoints,
    };
  }

  private getDefaultEvaluation(opportunity: ArbitrageOpportunity): ComprehensiveEvaluation {
    return {
      opportunityId: opportunity.id,
      opportunity,
      evaluationTimestamp: Date.now(),
      scoring: {
        opportunityId: opportunity.id,
        totalScore: 0,
        componentScores: {
          profitability: 0,
          risk: 0,
          executionFeasibility: 0,
          timeSensitivity: 0,
          marketDepth: 0,
          historicalSuccess: 0,
        },
        confidence: 0,
        recommendation: 'reject',
        reasoning: ['Evaluation failed'],
      },
      riskAssessment: {
        opportunityId: opportunity.id,
        overallRiskScore: 100,
        riskLevel: 'very_high',
        riskComponents: {} as any,
        riskMitigationSuggestions: [],
        confidence: 0,
      },
      profitabilityAnalysis: {
        opportunityId: opportunity.id,
        baseCalculation: { grossProfit: 0, expectedReturn: 0, profitMargin: 0, returnOnInvestment: 0 },
        adjustedCalculation: {
          netProfit: 0,
          adjustedReturn: 0,
          adjustedMargin: 0,
          costs: { gasCosts: [], bridgeFees: [], slippageCosts: [], timeCosts: [], totalCosts: 0 },
          risks: { volatilityAdjustment: 0, liquidityAdjustment: 0, executionAdjustment: 0, mevAdjustment: 0, totalAdjustment: 0 },
        },
        optimizedCalculation: {
          maxPotentialProfit: 0,
          optimizedReturn: 0,
          optimizedMargin: 0,
          optimizations: [],
          implementationComplexity: 'high',
        },
        scenarios: [],
        recommendation: { action: 'reject', reasoning: [], minProfitThreshold: 0, optimalExecutionSize: 0, suggestedImprovements: [] },
        confidence: 0,
      },
      feasibilityAnalysis: {
        opportunityId: opportunity.id,
        overallFeasibilityScore: 0,
        feasibilityLevel: 'very_low',
        executionProbability: 0,
        components: {} as any,
        bottlenecks: [],
        requirements: [],
        alternatives: [],
        recommendation: { action: 'cancel', confidence: 0, reasoning: [], prerequisites: [], optimizations: [], timeline: '' },
      },
      finalScore: 0,
      priority: 'ignore',
      recommendation: {
        action: 'reject',
        confidence: 0.9,
        reasoning: ['Evaluation failed - high risk'],
        conditions: [],
        timeline: 'N/A',
        alternatives: [],
      },
      strengthsAndWeaknesses: {
        strengths: [],
        weaknesses: ['Evaluation failed'],
        criticalFactors: ['System error'],
        improvementAreas: [],
      },
      keyMetrics: {
        expectedReturn: 0,
        riskAdjustedReturn: 0,
        probabilityOfSuccess: 0,
        timeToExecution: 0,
        capitalEfficiency: 0,
        competitiveAdvantage: 0,
      },
      executionPlan: {
        recommendedApproach: 'No execution',
        preconditions: [],
        executionSteps: [],
        contingencyPlans: [],
        monitoringPoints: [],
      },
    };
  }

  async evaluateBatch(
    opportunities: ArbitrageOpportunity[],
    marketData?: any,
    currentResources?: any
  ): Promise<ComprehensiveEvaluation[]> {
    logger.info(`Evaluating batch of ${opportunities.length} opportunities`);

    const evaluations = await Promise.all(
      opportunities.map(opp => this.evaluateOpportunity(opp, marketData, currentResources))
    );

    // Sort by final score (highest first)
    return evaluations.sort((a, b) => b.finalScore - a.finalScore);
  }

  updateConfiguration(config: Partial<EvaluationConfig>): void {
    this.config = { ...this.config, ...config };
    logger.info('Evaluation configuration updated');
  }

  getTopOpportunities(
    evaluations: ComprehensiveEvaluation[],
    count: number = 10
  ): ComprehensiveEvaluation[] {
    return evaluations
      .filter(eval => eval.priority !== 'ignore')
      .sort((a, b) => b.finalScore - a.finalScore)
      .slice(0, count);
  }

  getExecutableOpportunities(evaluations: ComprehensiveEvaluation[]): ComprehensiveEvaluation[] {
    return evaluations.filter(eval => 
      eval.recommendation.action === 'execute_immediately' || 
      eval.recommendation.action === 'execute_optimized'
    );
  }

  getEvaluationSummary(evaluations: ComprehensiveEvaluation[]): {
    total: number;
    byPriority: Record<string, number>;
    byAction: Record<string, number>;
    avgScore: number;
    topScore: number;
  } {
    const total = evaluations.length;
    const byPriority: Record<string, number> = {};
    const byAction: Record<string, number> = {};
    
    let totalScore = 0;
    let topScore = 0;

    for (const eval of evaluations) {
      byPriority[eval.priority] = (byPriority[eval.priority] || 0) + 1;
      byAction[eval.recommendation.action] = (byAction[eval.recommendation.action] || 0) + 1;
      
      totalScore += eval.finalScore;
      topScore = Math.max(topScore, eval.finalScore);
    }

    return {
      total,
      byPriority,
      byAction,
      avgScore: total > 0 ? totalScore / total : 0,
      topScore,
    };
  }
}