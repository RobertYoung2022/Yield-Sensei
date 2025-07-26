/**
 * Bridge Satellite Agent
 * Main orchestrator for cross-chain operations and arbitrage
 */

import { EventEmitter } from 'events';
import Logger from '../../shared/logging/logger';
import { CrossChainArbitrageEngine } from './arbitrage/cross-chain-arbitrage-engine';
import { BridgeRiskAssessment } from './safety/bridge-risk-assessment';
import { BridgeMonitoringService } from './safety/bridge-monitoring';
import { LiquidityOptimizer } from './liquidity/liquidity-optimizer';
import { CapitalEfficiencyAnalyzer } from './liquidity/capital-efficiency-analyzer';
import { MultiChainCoordinator } from './coordination/multi-chain-coordinator';
import { OpportunityValidator, ValidatorConfig } from './arbitrage/opportunity-validator';
import { AssetMapperService } from './arbitrage/asset-mapper';
import { HistoricalAnalyzer } from './arbitrage/historical-analyzer';
import { OpportunityEvaluator, ComprehensiveEvaluation } from './evaluation/opportunity-evaluator';
import { 
  ChainConfig, 
  BridgeConfig, 
  ArbitrageOpportunity, 
  CrossChainAnalytics,
  BridgeMonitoringData,
  BridgeAlert,
  BridgeRiskAssessment as BridgeRiskAssessmentType,
  CrossChainPortfolio,
  OptimizationResult
} from './types';

const logger = Logger.getLogger('bridge-satellite');

export interface BridgeSatelliteConfig {
  chains: ChainConfig[];
  bridges: BridgeConfig[];
  arbitrage: {
    minProfitThreshold: number;
    maxRiskScore: number;
    maxExecutionTime: number;
    enabledChains: string[];
  };
  risk: {
    updateInterval: number;
    alertThresholds: {
      safetyScore: number;
      liquidityScore: number;
      reliabilityScore: number;
    };
  };
  liquidity: {
    rebalanceThreshold: number;
    minUtilization: number;
    maxUtilization: number;
    targetDistribution: Record<string, number>;
  };
  monitoring: {
    updateInterval: number;
    alertRetention: number;
    performanceWindow: number;
  };
  validation: ValidatorConfig;
}

export const DEFAULT_BRIDGE_CONFIG: BridgeSatelliteConfig = {
  chains: [],
  bridges: [],
  arbitrage: {
    minProfitThreshold: 0.001, // 0.1%
    maxRiskScore: 70,
    maxExecutionTime: 300, // 5 minutes
    enabledChains: ['ethereum', 'polygon', 'arbitrum', 'optimism', 'avalanche'],
  },
  risk: {
    updateInterval: 60000, // 1 minute
    alertThresholds: {
      safetyScore: 80,
      liquidityScore: 70,
      reliabilityScore: 85,
    },
  },
  liquidity: {
    rebalanceThreshold: 0.1, // 10%
    minUtilization: 0.1, // 10%
    maxUtilization: 0.8, // 80%
    targetDistribution: {
      ethereum: 0.4,
      polygon: 0.2,
      arbitrum: 0.2,
      optimism: 0.1,
      avalanche: 0.1,
    },
  },
  monitoring: {
    updateInterval: 30000, // 30 seconds
    alertRetention: 86400000, // 24 hours
    performanceWindow: 3600000, // 1 hour
  },
  validation: {
    maxSlippageTolerance: 0.02, // 2%
    minLiquidityUSD: 100000, // $100k minimum
    maxPriceAge: 30, // 30 seconds
    mevProtectionThreshold: 100, // $100 profit threshold
    simulationGasBuffer: 1.2, // 20% gas buffer
  },
};

class BridgeSatelliteAgent extends EventEmitter {
  private arbitrageEngine: CrossChainArbitrageEngine;
  private riskAssessment: BridgeRiskAssessment;
  private bridgeMonitoring: BridgeMonitoringService;
  private liquidityOptimizer: LiquidityOptimizer;
  private capitalEfficiencyAnalyzer: CapitalEfficiencyAnalyzer;
  private multiChainCoordinator: MultiChainCoordinator;
  private opportunityValidator: OpportunityValidator;
  private assetMapper: AssetMapperService;
  private historicalAnalyzer: HistoricalAnalyzer;
  private opportunityEvaluator: OpportunityEvaluator;
  private config: BridgeSatelliteConfig;
  private isRunning = false;
  private monitoringInterval?: NodeJS.Timeout | undefined;

  constructor(config: Partial<BridgeSatelliteConfig> = {}) {
    super();
    this.config = { ...DEFAULT_BRIDGE_CONFIG, ...config };
    
    // Initialize core components
    this.arbitrageEngine = new CrossChainArbitrageEngine(this.config);
    this.riskAssessment = new BridgeRiskAssessment(this.config);
    this.bridgeMonitoring = new BridgeMonitoringService(this.config);
    this.liquidityOptimizer = new LiquidityOptimizer(this.config);
    this.capitalEfficiencyAnalyzer = new CapitalEfficiencyAnalyzer(this.config, {
      riskTolerance: 'moderate',
      minIdleThreshold: 0.05,
      rebalancingCostThreshold: 1000,
      targetUtilizationRate: this.config.liquidity.maxUtilization,
      opportunityUpdateInterval: 3600000 // 1 hour
    });
    this.multiChainCoordinator = new MultiChainCoordinator(this.config);
    
    // Initialize new arbitrage components
    this.assetMapper = new AssetMapperService();
    this.historicalAnalyzer = new HistoricalAnalyzer();
    this.opportunityEvaluator = new OpportunityEvaluator({
      risk: {
        maxAcceptableRisk: this.config.arbitrage.maxRiskScore,
        riskTolerance: 'moderate',
      },
      profitability: {
        minProfitThreshold: this.config.arbitrage.minProfitThreshold * 1000, // Convert to dollars
        minMarginThreshold: this.config.arbitrage.minProfitThreshold,
      },
      feasibility: {
        minFeasibilityScore: 50,
        maxExecutionTime: this.config.arbitrage.maxExecutionTime,
      },
    });
    
    // Initialize validator after other components are created
    this.opportunityValidator = new OpportunityValidator(
      this.arbitrageEngine['chainConnector'], // Access private property for validation
      this.arbitrageEngine['priceFeedManager'], // Access private property for validation
      this.config.validation
    );

    logger.info('Bridge Satellite Agent initialized', {
      enabledChains: this.config.arbitrage.enabledChains,
      bridgeCount: this.config.bridges.length,
      minProfitThreshold: this.config.arbitrage.minProfitThreshold,
    });
  }

  async initialize(): Promise<void> {
    try {
      logger.info('Initializing Bridge Satellite components...');

      await Promise.all([
        this.arbitrageEngine.initialize(),
        this.riskAssessment.initialize(),
        this.bridgeMonitoring.initialize(),
        this.liquidityOptimizer.initialize(),
        this.capitalEfficiencyAnalyzer.initialize(),
        this.multiChainCoordinator.initialize(),
        this.assetMapper.initialize(),
        this.historicalAnalyzer.initialize(),
        this.opportunityEvaluator.initialize(),
      ]);

      // Set up event listeners for enhanced arbitrage detection
      this.setupEventListeners();

      logger.info('✅ Bridge Satellite initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Bridge Satellite:', error);
      throw error;
    }
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Bridge Satellite is already running');
      return;
    }

    try {
      await this.initialize();

      // Start all engines
      await Promise.all([
        this.arbitrageEngine.start(),
        this.riskAssessment.start(),
        this.bridgeMonitoring.start(),
        this.liquidityOptimizer.start(),
        this.capitalEfficiencyAnalyzer.start(),
        this.multiChainCoordinator.start(),
      ]);

      // Start monitoring loop
      this.startMonitoring();

      this.isRunning = true;
      logger.info('🚀 Bridge Satellite started successfully');
    } catch (error) {
      logger.error('Failed to start Bridge Satellite:', error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      logger.warn('Bridge Satellite is not running');
      return;
    }

    try {
      // Stop monitoring
      if (this.monitoringInterval) {
        clearInterval(this.monitoringInterval);
        this.monitoringInterval = undefined;
      }

      // Stop all engines
      await Promise.all([
        this.arbitrageEngine.stop(),
        this.riskAssessment.stop(),
        this.bridgeMonitoring.stop(),
        this.liquidityOptimizer.stop(),
        this.capitalEfficiencyAnalyzer.stop(),
        this.multiChainCoordinator.stop(),
      ]);

      this.isRunning = false;
      logger.info('🛑 Bridge Satellite stopped successfully');
    } catch (error) {
      logger.error('Failed to stop Bridge Satellite:', error);
      throw error;
    }
  }

  private startMonitoring(): void {
    this.monitoringInterval = setInterval(async () => {
      try {
        await this.performHealthCheck();
        await this.updateAnalytics();
      } catch (error) {
        logger.error('Monitoring cycle failed:', error);
      }
    }, this.config.monitoring.updateInterval);
  }

  private async performHealthCheck(): Promise<void> {
    const bridgeStatuses = await Promise.all(
      this.config.bridges.map(bridge => 
        this.riskAssessment.getBridgeStatus(bridge.id)
      )
    );

    const unhealthyBridges = bridgeStatuses.filter(
      status => !status.isOperational || status.currentTVL < 1000000
    );

    if (unhealthyBridges.length > 0) {
      logger.warn('Unhealthy bridges detected:', {
        count: unhealthyBridges.length,
        bridges: unhealthyBridges.map(b => b.bridgeId),
      });
    }
  }

  private async updateAnalytics(): Promise<void> {
    const analytics = await this.getAnalytics();
    
    logger.debug('Bridge analytics updated:', {
      opportunities: analytics.totalArbitrageOpportunities,
      totalProfit: analytics.totalProfit,
      successRate: analytics.successRate,
      avgExecutionTime: analytics.avgExecutionTime,
    });
  }

  // Public API methods

  async getArbitrageOpportunities(): Promise<ArbitrageOpportunity[]> {
    return this.arbitrageEngine.detectOpportunities();
  }

  async executeArbitrage(opportunityId: string): Promise<boolean> {
    return this.arbitrageEngine.executeOpportunity(opportunityId);
  }

  async getBridgeRiskAssessments(): Promise<Record<string, any>> {
    return this.riskAssessment.getAllAssessments();
  }

  async optimizeLiquidity(): Promise<OptimizationResult> {
    return this.liquidityOptimizer.optimize();
  }

  async analyzeCapitalEfficiency(): Promise<any> {
    return this.capitalEfficiencyAnalyzer.analyzeCapitalEfficiency();
  }

  async getCapitalAllocationBreakdown(): Promise<any> {
    return this.capitalEfficiencyAnalyzer.getCapitalAllocationBreakdown();
  }

  async getCapitalOptimizationRecommendations(): Promise<any> {
    return this.capitalEfficiencyAnalyzer.generateOptimizationRecommendations();
  }

  async simulateCapitalAllocationScenarios(scenarios: any[]): Promise<any[]> {
    return this.capitalEfficiencyAnalyzer.simulateAllocationScenarios(scenarios);
  }

  getCapitalEfficiencyMetrics(): any {
    return this.capitalEfficiencyAnalyzer.getCurrentEfficiencyMetrics();
  }

  async getPortfolioStatus(): Promise<CrossChainPortfolio> {
    return this.multiChainCoordinator.getPortfolioStatus();
  }

  async rebalancePortfolio(): Promise<boolean> {
    return this.multiChainCoordinator.rebalancePortfolio();
  }

  async getAnalytics(): Promise<CrossChainAnalytics> {
    const [
      opportunities,
      bridgePerformance,
      executionStats,
    ] = await Promise.all([
      this.arbitrageEngine.getOpportunityStats(),
      this.riskAssessment.getBridgePerformanceMetrics(),
      this.arbitrageEngine.getExecutionStats(),
    ]);

    return {
      totalArbitrageOpportunities: opportunities.total,
      totalArbitrageVolume: executionStats.totalVolume,
      totalProfit: executionStats.totalProfit,
      avgProfitMargin: executionStats.avgProfitMargin,
      successRate: executionStats.successRate,
      avgExecutionTime: executionStats.avgExecutionTime,
      topPerformingChains: opportunities.topChains,
      topAssets: opportunities.topAssets,
      bridgePerformance,
    };
  }

  async getBridgeMonitoringData(): Promise<BridgeMonitoringData[]> {
    return Promise.all(
      this.config.bridges.map(bridge => 
        this.riskAssessment.getBridgeStatus(bridge.id)
      )
    );
  }

  getStatus(): { isRunning: boolean; uptime: number; lastActivity: number } {
    return {
      isRunning: this.isRunning,
      uptime: this.isRunning ? Date.now() - (this.monitoringInterval ? 0 : Date.now()) : 0,
      lastActivity: Date.now(),
    };
  }

  updateConfig(config: Partial<BridgeSatelliteConfig>): void {
    this.config = { ...this.config, ...config };
    
    // Propagate config updates to components
    this.arbitrageEngine.updateConfig(this.config);
    this.riskAssessment.updateConfig(this.config);
    this.bridgeMonitoring.updateConfig(this.config);
    this.liquidityOptimizer.updateConfig(this.config);
    this.capitalEfficiencyAnalyzer.updateConfig(this.config);
    this.multiChainCoordinator.updateConfig(this.config);

    logger.info('Bridge Satellite configuration updated');
  }

  private setupEventListeners(): void {
    // Listen for arbitrage opportunities
    this.arbitrageEngine.on('opportunityDetected', async (opportunity: ArbitrageOpportunity) => {
      try {
        // Record opportunity for historical analysis
        await this.historicalAnalyzer.recordOpportunity(opportunity);

        // Perform comprehensive evaluation
        const evaluation = await this.opportunityEvaluator.evaluateOpportunity(opportunity);
        
        logger.info(`Opportunity evaluated: ${opportunity.id}`, {
          asset: opportunity.assetId,
          finalScore: evaluation.finalScore.toFixed(1),
          priority: evaluation.priority,
          recommendation: evaluation.recommendation.action,
          expectedProfit: evaluation.keyMetrics.expectedReturn.toFixed(2),
          riskAdjustedReturn: evaluation.keyMetrics.riskAdjustedReturn.toFixed(2),
          confidence: evaluation.recommendation.confidence.toFixed(2),
        });

        // Auto-execute based on comprehensive evaluation
        if (evaluation.recommendation.action === 'execute_immediately' && 
            evaluation.recommendation.confidence > 0.8) {
          const executed = await this.arbitrageEngine.executeOpportunity(opportunity.id);
          if (executed) {
            logger.info(`Auto-executed high-priority opportunity: ${opportunity.id}`, {
              finalScore: evaluation.finalScore,
              expectedProfit: evaluation.keyMetrics.expectedReturn,
            });
          }
        } else if (evaluation.recommendation.action === 'execute_optimized') {
          // Could implement optimization logic here
          logger.info(`Optimization recommended for opportunity: ${opportunity.id}`, {
            optimizations: evaluation.profitabilityAnalysis.optimizedCalculation.optimizations.map(opt => opt.description),
          });
        } else if (evaluation.priority === 'ignore') {
          logger.debug(`Opportunity rejected: ${opportunity.id}`, {
            reasoning: evaluation.recommendation.reasoning,
          });
        }

        // Emit enhanced evaluation event
        this.emit('opportunityEvaluated', evaluation);
      } catch (error) {
        logger.error('Error processing opportunity:', error);
      }
    });

    // Listen for execution completions
    this.arbitrageEngine.on('executionCompleted', async (execution: any) => {
      await this.historicalAnalyzer.recordExecution(execution);
      logger.info(`Execution completed: ${execution.opportunityId}`, {
        profit: execution.actualProfit,
        duration: execution.endTime - execution.startTime,
      });
    });

    // Listen for execution failures
    this.arbitrageEngine.on('executionFailed', async (execution: any) => {
      await this.historicalAnalyzer.recordExecution(execution);
      logger.error(`Execution failed: ${execution.opportunityId}`, {
        reason: execution.failureReason,
      });
    });
  }

  // Enhanced public API methods

  async getValidatedOpportunities(): Promise<ArbitrageOpportunity[]> {
    const rawOpportunities = await this.arbitrageEngine.detectOpportunities();
    const validationResults = await this.opportunityValidator.validateBatch(rawOpportunities);
    
    return validationResults
      .filter(result => result.isValid)
      .map(result => {
        const opportunity = rawOpportunities.find(opp => opp.id === result.opportunityId);
        if (opportunity) {
          // Update opportunity with adjusted profit
          opportunity.netProfit = result.adjustedProfit;
          opportunity.riskScore = result.riskScore;
          opportunity.confidence = result.confidence / 100;
        }
        return opportunity;
      })
      .filter(Boolean) as ArbitrageOpportunity[];
  }

  async getPredictedOpportunities(): Promise<any[]> {
    return this.historicalAnalyzer.predictOpportunities();
  }

  async getPerformanceMetrics(days: number = 30): Promise<any> {
    return this.historicalAnalyzer.getPerformanceMetrics(days);
  }

  async getAssetMapping(assetId: string): Promise<any> {
    return this.assetMapper.getAssetMapping(assetId);
  }

  async searchAssets(query: string): Promise<any[]> {
    return this.assetMapper.searchAssets(query);
  }

  async getValidationStats(): Promise<any> {
    const opportunities = await this.arbitrageEngine.detectOpportunities();
    const validationResults = await this.opportunityValidator.validateBatch(opportunities);
    return this.opportunityValidator.getValidationStats(validationResults);
  }

  async updateHistoricalPatterns(): Promise<void> {
    await this.historicalAnalyzer.updatePatterns();
    logger.info('Historical patterns updated');
  }

  async getAssetStats(): Promise<any> {
    return this.assetMapper.getAssetStats();
  }

  async getHistoricalPatterns(): Promise<any[]> {
    return this.historicalAnalyzer.getAllPatterns();
  }

  // Enhanced Bridge Risk Assessment API

  /**
   * Get comprehensive monitoring status for all bridges
   */
  async getBridgeMonitoringStatus(): Promise<{
    isRunning: boolean;
    bridgeCount: number;
    totalAlerts: number;
    bridgeStatuses: Record<string, BridgeMonitoringData>;
    riskAssessments: Record<string, BridgeRiskAssessmentType>;
  }> {
    return this.bridgeMonitoring.getMonitoringStatus();
  }

  /**
   * Get detailed monitoring information for a specific bridge
   */
  async getBridgeDetails(bridgeId: string): Promise<{
    monitoring: BridgeMonitoringData;
    riskAssessment: BridgeRiskAssessmentType;
    metrics: any;
    endpoints: any[];
  }> {
    return this.bridgeMonitoring.getBridgeDetails(bridgeId);
  }

  /**
   * Get risk assessment for a specific bridge
   */
  async getBridgeRiskAssessment(bridgeId: string): Promise<BridgeRiskAssessmentType> {
    return this.riskAssessment.getBridgeRiskAssessment(bridgeId);
  }

  /**
   * Get all bridge risk assessments
   */
  async getAllBridgeRiskAssessments(): Promise<Record<string, BridgeRiskAssessmentType>> {
    return this.riskAssessment.getAllAssessments();
  }

  /**
   * Subscribe to real-time bridge alerts
   */
  subscribeToAlerts(callback: (alert: BridgeAlert) => void): void {
    this.bridgeMonitoring.subscribeToAlerts(callback);
  }

  /**
   * Unsubscribe from bridge alerts
   */
  unsubscribeFromAlerts(callback: (alert: BridgeAlert) => void): void {
    this.bridgeMonitoring.unsubscribeFromAlerts(callback);
  }

  /**
   * Manually trigger health check for a bridge
   */
  async performBridgeHealthCheck(bridgeId: string): Promise<{
    success: boolean;
    responseTime: number;
    errors: string[];
  }> {
    return this.bridgeMonitoring.performHealthCheck(bridgeId);
  }

  /**
   * Record a bridge incident manually
   */
  async recordBridgeIncident(incident: {
    bridgeId: string;
    type: 'exploit' | 'bug' | 'downtime' | 'governance';
    severity: 'low' | 'medium' | 'high' | 'critical';
    amount: number;
    description: string;
  }): Promise<void> {
    return this.bridgeMonitoring.recordIncident(incident);
  }

  /**
   * Update security audit information for a bridge
   */
  async updateBridgeSecurityAudit(bridgeId: string, audit: {
    auditorName: string;
    auditDate: number;
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    findings: string[];
    score: number;
  }): Promise<void> {
    return this.bridgeMonitoring.updateSecurityAudit(bridgeId, audit);
  }

  /**
   * Get anomaly detection statistics
   */
  getBridgeAnomalyStats(): {
    totalPatterns: number;
    activeMonitoring: number;
    totalAlerts: number;
    avgHistorySize: number;
  } {
    return this.bridgeMonitoring.getAnomalyStats();
  }

  /**
   * Get bridges ranked by safety score
   */
  async getBridgesSafetyRanking(): Promise<Array<{
    bridgeId: string;
    bridgeName: string;
    overallScore: number;
    safetyScore: number;
    liquidityScore: number;
    reliabilityScore: number;
    securityScore: number;
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
  }>> {
    const assessments = await this.getAllBridgeRiskAssessments();
    const rankings = [];

    for (const [bridgeId, assessment] of Object.entries(assessments)) {
      const bridge = this.config.bridges.find(b => b.id === bridgeId);
      const riskLevel = assessment.overallScore >= 80 ? 'low' :
                       assessment.overallScore >= 60 ? 'medium' :
                       assessment.overallScore >= 40 ? 'high' : 'critical';

      rankings.push({
        bridgeId,
        bridgeName: bridge?.name || bridgeId,
        overallScore: assessment.overallScore,
        safetyScore: assessment.safetyScore,
        liquidityScore: assessment.liquidityScore,
        reliabilityScore: assessment.reliabilityScore,
        securityScore: assessment.securityScore,
        riskLevel: riskLevel as 'low' | 'medium' | 'high' | 'critical'
      });
    }

    return rankings.sort((a, b) => b.overallScore - a.overallScore);
  }

  /**
   * Get bridges with critical alerts
   */
  async getCriticalBridgeAlerts(): Promise<Array<{
    bridgeId: string;
    bridgeName: string;
    alerts: BridgeAlert[];
    riskScore: number;
  }>> {
    const status = await this.getBridgeMonitoringStatus();
    const criticalBridges = [];

    for (const [bridgeId, bridgeStatus] of Object.entries(status.bridgeStatuses)) {
      const criticalAlerts = bridgeStatus.alerts.filter(alert => 
        alert.severity === 'critical' || alert.severity === 'error'
      );

      if (criticalAlerts.length > 0) {
        const bridge = this.config.bridges.find(b => b.id === bridgeId);
        const riskAssessment = status.riskAssessments[bridgeId];

        criticalBridges.push({
          bridgeId,
          bridgeName: bridge?.name || bridgeId,
          alerts: criticalAlerts,
          riskScore: riskAssessment?.overallScore || 0
        });
      }
    }

    return criticalBridges.sort((a, b) => a.riskScore - b.riskScore);
  }

  // Enhanced evaluation methods

  async getComprehensiveEvaluations(): Promise<ComprehensiveEvaluation[]> {
    const opportunities = await this.arbitrageEngine.detectOpportunities();
    return this.opportunityEvaluator.evaluateBatch(opportunities);
  }

  async getTopEvaluatedOpportunities(count: number = 10): Promise<ComprehensiveEvaluation[]> {
    const evaluations = await this.getComprehensiveEvaluations();
    return this.opportunityEvaluator.getTopOpportunities(evaluations, count);
  }

  async getExecutableOpportunities(): Promise<ComprehensiveEvaluation[]> {
    const evaluations = await this.getComprehensiveEvaluations();
    return this.opportunityEvaluator.getExecutableOpportunities(evaluations);
  }

  async getEvaluationSummary(): Promise<any> {
    const evaluations = await this.getComprehensiveEvaluations();
    return this.opportunityEvaluator.getEvaluationSummary(evaluations);
  }

  async evaluateSingleOpportunity(
    opportunityId: string,
    marketData?: any,
    currentResources?: any
  ): Promise<ComprehensiveEvaluation | null> {
    const opportunities = await this.arbitrageEngine.detectOpportunities();
    const opportunity = opportunities.find(opp => opp.id === opportunityId);
    
    if (!opportunity) {
      return null;
    }

    return this.opportunityEvaluator.evaluateOpportunity(opportunity, marketData, currentResources);
  }

  async getAdvancedAnalytics(): Promise<{
    evaluationSummary: any;
    performanceMetrics: any;
    assetStats: any;
    validationStats: any;
    riskDistribution: any;
    capitalEfficiency: any;
  }> {
    const [
      evaluationSummary,
      performanceMetrics,
      assetStats,
      validationStats,
      capitalEfficiency,
    ] = await Promise.all([
      this.getEvaluationSummary(),
      this.getPerformanceMetrics(),
      this.getAssetStats(),
      this.getValidationStats(),
      this.analyzeCapitalEfficiency(),
    ]);

    // Calculate risk distribution
    const evaluations = await this.getComprehensiveEvaluations();
    const riskDistribution = this.calculateRiskDistribution(evaluations);

    return {
      evaluationSummary,
      performanceMetrics,
      assetStats,
      validationStats,
      riskDistribution,
      capitalEfficiency,
    };
  }

  private calculateRiskDistribution(evaluations: ComprehensiveEvaluation[]): any {
    const distribution = {
      very_low: 0,
      low: 0,
      medium: 0,
      high: 0,
      very_high: 0,
    };

    for (const evaluation of evaluations) {
      distribution[evaluation.riskAssessment.riskLevel]++;
    }

    return {
      distribution,
      total: evaluations.length,
      avgRiskScore: evaluations.reduce((sum, e) => sum + e.riskAssessment.overallRiskScore, 0) / evaluations.length,
    };
  }

  async optimizeOpportunity(
    opportunityId: string
  ): Promise<{ optimized: ComprehensiveEvaluation; improvements: string[] } | null> {
    const evaluation = await this.evaluateSingleOpportunity(opportunityId);
    if (!evaluation) {
      return null;
    }

    const improvements: string[] = [];

    // Apply available optimizations
    if (evaluation.profitabilityAnalysis.optimizedCalculation.optimizations.length > 0) {
      improvements.push(...evaluation.profitabilityAnalysis.optimizedCalculation.optimizations.map(opt => opt.description));
    }

    if (evaluation.feasibilityAnalysis.recommendation.optimizations.length > 0) {
      improvements.push(...evaluation.feasibilityAnalysis.recommendation.optimizations);
    }

    // Re-evaluate with optimizations (simplified)
    const optimizedEvaluation = { ...evaluation };
    optimizedEvaluation.finalScore = Math.min(100, evaluation.finalScore * 1.2); // 20% improvement estimate

    return {
      optimized: optimizedEvaluation,
      improvements,
    };
  }
}

export { BridgeSatelliteAgent };
// BridgeSatelliteConfig already exported above