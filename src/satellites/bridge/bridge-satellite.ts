/**
 * Bridge Satellite Agent
 * Main orchestrator for cross-chain operations and arbitrage
 */

import Logger from '../../shared/logging/logger';
import { CrossChainArbitrageEngine } from './arbitrage/cross-chain-arbitrage-engine';
import { BridgeRiskAssessment } from './safety/bridge-risk-assessment';
import { LiquidityOptimizer } from './liquidity/liquidity-optimizer';
import { MultiChainCoordinator } from './coordination/multi-chain-coordinator';
import { 
  ChainConfig, 
  BridgeConfig, 
  ArbitrageOpportunity, 
  CrossChainAnalytics,
  BridgeMonitoringData,
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
};

class BridgeSatelliteAgent {
  private arbitrageEngine: CrossChainArbitrageEngine;
  private riskAssessment: BridgeRiskAssessment;
  private liquidityOptimizer: LiquidityOptimizer;
  private multiChainCoordinator: MultiChainCoordinator;
  private config: BridgeSatelliteConfig;
  private isRunning = false;
  private monitoringInterval?: NodeJS.Timeout;

  constructor(config: Partial<BridgeSatelliteConfig> = {}) {
    this.config = { ...DEFAULT_BRIDGE_CONFIG, ...config };
    
    this.arbitrageEngine = new CrossChainArbitrageEngine(this.config);
    this.riskAssessment = new BridgeRiskAssessment(this.config);
    this.liquidityOptimizer = new LiquidityOptimizer(this.config);
    this.multiChainCoordinator = new MultiChainCoordinator(this.config);

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
        this.liquidityOptimizer.initialize(),
        this.multiChainCoordinator.initialize(),
      ]);

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
        this.liquidityOptimizer.start(),
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
        this.liquidityOptimizer.stop(),
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
    this.liquidityOptimizer.updateConfig(this.config);
    this.multiChainCoordinator.updateConfig(this.config);

    logger.info('Bridge Satellite configuration updated');
  }
}

export { BridgeSatelliteAgent };
export type { BridgeSatelliteConfig };