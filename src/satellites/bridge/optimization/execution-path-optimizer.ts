/**
 * Execution Path Optimizer
 * Advanced algorithms for determining optimal execution paths for cross-chain arbitrage
 */

import Logger from '../../../shared/logging/logger';
import { GasOptimizer, GasOptimizationConfig } from './gas-optimizer';
import { 
  ArbitrageOpportunity, 
  ExecutionPath,
  ExecutionStep,
  ChainID,
  BridgeConfig,
  ChainConfig
} from '../types';

const logger = Logger.getLogger('execution-path-optimizer');

export interface PathOptimizationConfig {
  maxAlternativePaths: number;
  simulationRounds: number;
  costWeights: {
    gasCost: number;
    bridgeFees: number;
    executionTime: number;
    slippage: number;
    mevRisk: number;
  };
  riskTolerance: 'conservative' | 'moderate' | 'aggressive';
  parallelSimulations: number;
}

export interface OptimizedPath extends ExecutionPath {
  optimizationScore: number;
  costBreakdown: DetailedCostBreakdown;
  performanceMetrics: PathPerformanceMetrics;
  alternativeRoutes: AlternativeRoute[];
  optimizationStrategy: OptimizationStrategy;
}

export interface DetailedCostBreakdown {
  gasCosts: {
    perChain: Record<ChainID, number>;
    totalGas: number;
    totalUSD: number;
    gasOptimizationPotential: number;
  };
  bridgeFees: {
    perBridge: Record<string, number>;
    totalFees: number;
    feeOptimizationPotential: number;
  };
  slippageCosts: {
    perStep: number[];
    totalSlippage: number;
    slippageOptimizationPotential: number;
  };
  timeCosts: {
    opportunityCost: number;
    delayRisk: number;
    timeOptimizationPotential: number;
  };
  mevCosts: {
    frontrunningRisk: number;
    sandwichRisk: number;
    extractableValue: number;
    mevProtectionCost: number;
  };
}

export interface PathPerformanceMetrics {
  expectedExecutionTime: number;
  executionProbability: number;
  robustness: number; // Resistance to market changes
  efficiency: number; // Cost efficiency
  scalability: number; // Ability to handle larger trades
  adaptability: number; // Ability to handle market changes
}

export interface AlternativeRoute {
  description: string;
  path: ExecutionStep[];
  costImprovement: number;
  timeImprovement: number;
  riskChange: number;
  feasibility: number;
}

export interface OptimizationStrategy {
  primaryStrategy: 'gas_optimization' | 'time_optimization' | 'cost_optimization' | 'risk_optimization' | 'hybrid';
  appliedOptimizations: OptimizationTechnique[];
  tradeoffs: string[];
  confidence: number;
}

export interface OptimizationTechnique {
  name: string;
  type: 'gas' | 'routing' | 'timing' | 'batching' | 'splitting' | 'bridging';
  impact: number;
  implementationComplexity: 'low' | 'medium' | 'high';
  description: string;
}

export interface PathSimulationResult {
  pathId: string;
  simulationRounds: number;
  successRate: number;
  averageCost: number;
  averageTime: number;
  profitVariance: number;
  worstCaseScenario: SimulationScenario;
  bestCaseScenario: SimulationScenario;
  medianScenario: SimulationScenario;
}

export interface SimulationScenario {
  gasCost: number;
  bridgeFees: number;
  slippage: number;
  executionTime: number;
  mevImpact: number;
  finalProfit: number;
  successProbability: number;
}

export class ExecutionPathOptimizer {
  private config: PathOptimizationConfig;
  private chainConfigs: Map<ChainID, ChainConfig> = new Map();
  private bridgeConfigs: Map<string, BridgeConfig> = new Map();
  private historicalPerformance: Map<string, any> = new Map();
  private marketConditions: Map<string, any> = new Map();
  private gasOptimizer: GasOptimizer;

  constructor(
    config?: Partial<PathOptimizationConfig>,
    chainConfigs?: ChainConfig[],
    bridgeConfigs?: BridgeConfig[]
  ) {
    this.config = {
      maxAlternativePaths: 5,
      simulationRounds: 1000,
      costWeights: {
        gasCost: 0.3,
        bridgeFees: 0.25,
        executionTime: 0.2,
        slippage: 0.15,
        mevRisk: 0.1,
      },
      riskTolerance: 'moderate',
      parallelSimulations: 4,
      ...config,
    };

    // Initialize configurations
    if (chainConfigs) {
      chainConfigs.forEach(config => this.chainConfigs.set(config.id, config));
    }
    if (bridgeConfigs) {
      bridgeConfigs.forEach(config => this.bridgeConfigs.set(config.id, config));
    }

    // Initialize gas optimizer
    const gasOptimizationConfig: Partial<GasOptimizationConfig> = {
      priorityFeeStrategy: this.config.riskTolerance === 'conservative' ? 'conservative' : 'moderate',
      useLayer2Routing: true,
    };
    this.gasOptimizer = new GasOptimizer(gasOptimizationConfig, Array.from(this.chainConfigs.values()));

    logger.info('Execution Path Optimizer initialized');
  }

  async initialize(): Promise<void> {
    try {
      // Initialize with mock data for now
      this.loadMockData();
      
      logger.info('Path optimizer initialization complete');
    } catch (error) {
      logger.error('Failed to initialize path optimizer:', error);
      throw error;
    }
  }

  private loadMockData(): void {
    // Load some mock historical performance data
    this.historicalPerformance.set('ethereum-arbitrum-USDC', {
      avgExecutionTime: 180,
      successRate: 0.92,
      avgGasCost: 150000,
    });
    
    // Load some mock market conditions
    this.marketConditions.set('current-volatility', 0.15);
    this.marketConditions.set('current-gas-price', 30);
    
    logger.info('Mock data loaded for path optimizer');
  }

  async optimizePath(
    opportunity: ArbitrageOpportunity,
    marketData?: any,
    constraints?: any
  ): Promise<OptimizedPath> {
    try {
      logger.info(`Optimizing execution path for opportunity ${opportunity.id}`);

      // Generate alternative paths
      const alternativePaths = await this.generateAlternativePaths(opportunity, marketData);
      
      // Simulate all paths in parallel
      const simulationResults = await this.simulatePathsInParallel(alternativePaths, marketData);
      
      // Analyze and score each path
      const scoredPaths = await this.scoreAndRankPaths(alternativePaths, simulationResults);
      
      // Select the optimal path
      const optimalPath = this.selectOptimalPath(scoredPaths, constraints);
      
      // Generate optimization strategy
      const optimizationStrategy = this.generateOptimizationStrategy(optimalPath);
      
      // Create detailed cost breakdown
      const costBreakdown = await this.calculateDetailedCosts(optimalPath, marketData);
      
      // Calculate performance metrics
      const performanceMetrics = this.calculatePerformanceMetrics(optimalPath, simulationResults);
      
      // Generate alternative routes
      const alternativeRoutes = this.generateAlternativeRoutes(scoredPaths, optimalPath);

      const optimizedPath: OptimizedPath = {
        ...optimalPath,
        optimizationScore: this.calculateOptimizationScore(optimalPath, costBreakdown, performanceMetrics),
        costBreakdown,
        performanceMetrics,
        alternativeRoutes,
        optimizationStrategy,
      };

      logger.info(`Path optimization complete for ${opportunity.id}`, {
        optimizationScore: optimizedPath.optimizationScore.toFixed(2),
        totalCost: costBreakdown.gasCosts.totalUSD + costBreakdown.bridgeFees.totalFees,
        executionTime: performanceMetrics.expectedExecutionTime,
        strategy: optimizationStrategy.primaryStrategy,
      });

      return optimizedPath;
    } catch (error) {
      logger.error('Error optimizing execution path:', error);
      return this.getDefaultOptimizedPath(opportunity);
    }
  }

  private async generateAlternativePaths(
    opportunity: ArbitrageOpportunity,
    marketData?: any
  ): Promise<ExecutionPath[]> {
    const paths: ExecutionPath[] = [];
    
    // Start with the original path
    if (opportunity.executionPaths.length > 0) {
      const originalPath = opportunity.executionPaths[0];
      if (originalPath) {
        paths.push(originalPath);
      }
    }

    // Generate alternative routing strategies
    const alternativeStrategies = [
      'direct_bridge_route',
      'multi_hop_route',
      'parallel_execution',
      'staged_execution',
      'hybrid_route',
    ];

    for (const strategy of alternativeStrategies) {
      if (paths.length >= this.config.maxAlternativePaths) break;
      
      const alternativePath = await this.generatePathWithStrategy(
        opportunity,
        strategy,
        marketData
      );
      
      if (alternativePath) {
        paths.push(alternativePath);
      }
    }

    logger.debug(`Generated ${paths.length} alternative paths for optimization`);
    return paths;
  }

  private async generatePathWithStrategy(
    opportunity: ArbitrageOpportunity,
    strategy: string,
    _marketData?: any
  ): Promise<ExecutionPath | null> {
    try {
      switch (strategy) {
        case 'direct_bridge_route':
          return this.generateDirectBridgeRoute(opportunity);
        case 'multi_hop_route':
          return this.generateMultiHopRoute(opportunity);
        case 'parallel_execution':
          return this.generateParallelExecutionRoute(opportunity);
        case 'staged_execution':
          return this.generateStagedExecutionRoute(opportunity);
        case 'hybrid_route':
          return this.generateHybridRoute(opportunity);
        default:
          return null;
      }
    } catch (error) {
      logger.error(`Error generating path with strategy ${strategy}:`, error);
      return null;
    }
  }

  private generateDirectBridgeRoute(opportunity: ArbitrageOpportunity): ExecutionPath {
    // Minimize steps by using direct bridges where possible
    const steps: ExecutionStep[] = [
      {
        type: 'swap',
        chainId: opportunity.sourceChain,
        protocol: 'uniswap-v3',
        contractAddress: '0x1234',
        estimatedGas: 150000,
        estimatedTime: 15,
        dependencies: [],
      },
      {
        type: 'bridge',
        chainId: opportunity.sourceChain,
        protocol: 'hop-protocol',
        contractAddress: '0x5678',
        estimatedGas: 300000,
        estimatedTime: 120,
        dependencies: ['step-0'],
      },
      {
        type: 'swap',
        chainId: opportunity.targetChain,
        protocol: 'sushiswap',
        contractAddress: '0x9abc',
        estimatedGas: 180000,
        estimatedTime: 20,
        dependencies: ['step-1'],
      },
    ];

    return {
      id: `direct-${Date.now()}`,
      steps,
      totalGasCost: 630000,
      totalFees: 50,
      estimatedTime: 155,
      successProbability: 0.95,
      riskLevel: 'low',
    };
  }

  private generateMultiHopRoute(opportunity: ArbitrageOpportunity): ExecutionPath {
    // Use intermediate chains for better liquidity or lower fees
    const steps: ExecutionStep[] = [
      {
        type: 'swap',
        chainId: opportunity.sourceChain,
        protocol: 'uniswap-v3',
        contractAddress: '0x1234',
        estimatedGas: 150000,
        estimatedTime: 15,
        dependencies: [],
      },
      {
        type: 'bridge',
        chainId: opportunity.sourceChain,
        protocol: 'polygon-bridge',
        contractAddress: '0x5678',
        estimatedGas: 250000,
        estimatedTime: 300,
        dependencies: ['step-0'],
      },
      {
        type: 'swap',
        chainId: 'polygon',
        protocol: 'quickswap',
        contractAddress: '0x9abc',
        estimatedGas: 120000,
        estimatedTime: 10,
        dependencies: ['step-1'],
      },
      {
        type: 'bridge',
        chainId: 'polygon',
        protocol: 'multichain',
        contractAddress: '0xdef0',
        estimatedGas: 200000,
        estimatedTime: 180,
        dependencies: ['step-2'],
      },
      {
        type: 'swap',
        chainId: opportunity.targetChain,
        protocol: 'curve',
        contractAddress: '0x1357',
        estimatedGas: 160000,
        estimatedTime: 18,
        dependencies: ['step-3'],
      },
    ];

    return {
      id: `multihop-${Date.now()}`,
      steps,
      totalGasCost: 880000,
      totalFees: 75,
      estimatedTime: 523,
      successProbability: 0.88,
      riskLevel: 'medium',
    };
  }

  private generateParallelExecutionRoute(opportunity: ArbitrageOpportunity): ExecutionPath {
    // Split execution into parallel streams
    const steps: ExecutionStep[] = [
      {
        type: 'swap',
        chainId: opportunity.sourceChain,
        protocol: 'uniswap-v3',
        contractAddress: '0x1234',
        estimatedGas: 100000,
        estimatedTime: 15,
        dependencies: [],
      },
      {
        type: 'swap',
        chainId: opportunity.sourceChain,
        protocol: 'sushiswap',
        contractAddress: '0x2345',
        estimatedGas: 110000,
        estimatedTime: 18,
        dependencies: [],
      },
      {
        type: 'bridge',
        chainId: opportunity.sourceChain,
        protocol: 'hop-protocol',
        contractAddress: '0x5678',
        estimatedGas: 280000,
        estimatedTime: 120,
        dependencies: ['step-0', 'step-1'],
      },
      {
        type: 'swap',
        chainId: opportunity.targetChain,
        protocol: 'curve',
        contractAddress: '0x9abc',
        estimatedGas: 140000,
        estimatedTime: 16,
        dependencies: ['step-2'],
      },
    ];

    return {
      id: `parallel-${Date.now()}`,
      steps,
      totalGasCost: 630000,
      totalFees: 60,
      estimatedTime: 138, // Parallel execution reduces total time
      successProbability: 0.92,
      riskLevel: 'medium',
    };
  }

  private generateStagedExecutionRoute(opportunity: ArbitrageOpportunity): ExecutionPath {
    // Execute in stages with validation between steps
    const steps: ExecutionStep[] = [
      {
        type: 'swap',
        chainId: opportunity.sourceChain,
        protocol: 'uniswap-v3',
        contractAddress: '0x1234',
        estimatedGas: 160000,
        estimatedTime: 20,
        dependencies: [],
      },
      {
        type: 'transfer',
        chainId: opportunity.sourceChain,
        protocol: 'native',
        contractAddress: '0x0000',
        estimatedGas: 21000,
        estimatedTime: 5,
        dependencies: ['step-0'],
      },
      {
        type: 'bridge',
        chainId: opportunity.sourceChain,
        protocol: 'stargate',
        contractAddress: '0x5678',
        estimatedGas: 320000,
        estimatedTime: 180,
        dependencies: ['step-1'],
      },
      {
        type: 'transfer',
        chainId: opportunity.targetChain,
        protocol: 'native',
        contractAddress: '0x0000',
        estimatedGas: 21000,
        estimatedTime: 5,
        dependencies: ['step-2'],
      },
      {
        type: 'swap',
        chainId: opportunity.targetChain,
        protocol: 'traderjoe',
        contractAddress: '0x9abc',
        estimatedGas: 170000,
        estimatedTime: 22,
        dependencies: ['step-3'],
      },
    ];

    return {
      id: `staged-${Date.now()}`,
      steps,
      totalGasCost: 692000,
      totalFees: 65,
      estimatedTime: 232,
      successProbability: 0.96,
      riskLevel: 'low',
    };
  }

  private generateHybridRoute(opportunity: ArbitrageOpportunity): ExecutionPath {
    // Combine multiple strategies for optimal balance
    const steps: ExecutionStep[] = [
      {
        type: 'swap',
        chainId: opportunity.sourceChain,
        protocol: 'uniswap-v3',
        contractAddress: '0x1234',
        estimatedGas: 130000,
        estimatedTime: 15,
        dependencies: [],
      },
      {
        type: 'bridge',
        chainId: opportunity.sourceChain,
        protocol: 'across-protocol',
        contractAddress: '0x5678',
        estimatedGas: 290000,
        estimatedTime: 90,
        dependencies: ['step-0'],
      },
      {
        type: 'swap',
        chainId: opportunity.targetChain,
        protocol: 'balancer',
        contractAddress: '0x9abc',
        estimatedGas: 200000,
        estimatedTime: 25,
        dependencies: ['step-1'],
      },
    ];

    return {
      id: `hybrid-${Date.now()}`,
      steps,
      totalGasCost: 620000,
      totalFees: 45,
      estimatedTime: 130,
      successProbability: 0.93,
      riskLevel: 'low',
    };
  }

  private async simulatePathsInParallel(
    paths: ExecutionPath[],
    marketData?: any
  ): Promise<Map<string, PathSimulationResult>> {
    const simulationPromises = paths.map(path => 
      this.simulatePath(path, marketData)
    );

    const results = await Promise.all(simulationPromises);
    const resultMap = new Map<string, PathSimulationResult>();
    
    paths.forEach((path, index) => {
      const result = results[index];
      if (result) {
        resultMap.set(path.id, result);
      }
    });

    return resultMap;
  }

  private async simulatePath(
    path: ExecutionPath,
    marketData?: any
  ): Promise<PathSimulationResult> {
    const scenarios: SimulationScenario[] = [];
    let successCount = 0;

    // Run multiple simulation rounds
    for (let i = 0; i < this.config.simulationRounds; i++) {
      const scenario = this.generateSimulationScenario(path, marketData);
      scenarios.push(scenario);
      
      if (scenario.successProbability > 0.5) {
        successCount++;
      }
    }

    // Calculate statistics
    const successRate = successCount / this.config.simulationRounds;
    const averageCost = scenarios.reduce((sum, s) => sum + s.gasCost + s.bridgeFees, 0) / scenarios.length;
    const averageTime = scenarios.reduce((sum, s) => sum + s.executionTime, 0) / scenarios.length;
    const profitVariance = this.calculateVariance(scenarios.map(s => s.finalProfit));

    // Find best/worst/median scenarios
    const sortedByProfit = scenarios.sort((a, b) => b.finalProfit - a.finalProfit);
    
    const defaultScenario: SimulationScenario = {
      gasCost: path.totalGasCost,
      bridgeFees: path.totalFees,
      slippage: 0.005,
      executionTime: path.estimatedTime,
      mevImpact: 0.01,
      finalProfit: 10,
      successProbability: path.successProbability,
    };
    
    const bestCaseScenario = sortedByProfit[0] || defaultScenario;
    const worstCaseScenario = sortedByProfit[sortedByProfit.length - 1] || defaultScenario;
    const medianScenario = sortedByProfit[Math.floor(sortedByProfit.length / 2)] || defaultScenario;

    return {
      pathId: path.id,
      simulationRounds: this.config.simulationRounds,
      successRate,
      averageCost,
      averageTime,
      profitVariance,
      worstCaseScenario,
      bestCaseScenario,
      medianScenario,
    };
  }

  private generateSimulationScenario(
    path: ExecutionPath,
    marketData?: any
  ): SimulationScenario {
    // Add randomness to simulate market conditions
    const gasVolatility = 0.2; // 20% volatility
    const bridgeFeeVolatility = 0.1; // 10% volatility
    const slippageVolatility = 0.3; // 30% volatility
    const timeVolatility = 0.15; // 15% volatility

    const baseGasCost = path.totalGasCost;
    const baseBridgeFees = path.totalFees;
    const baseTime = path.estimatedTime;

    const gasCost = baseGasCost * (1 + (Math.random() - 0.5) * gasVolatility);
    const bridgeFees = baseBridgeFees * (1 + (Math.random() - 0.5) * bridgeFeeVolatility);
    const slippage = 0.005 * (1 + (Math.random() - 0.5) * slippageVolatility); // 0.5% base slippage
    const executionTime = baseTime * (1 + (Math.random() - 0.5) * timeVolatility);
    
    // MEV impact based on profit size and market conditions
    const baseMevImpact = Math.min(0.1, (marketData?.expectedProfit || 100) / 10000);
    const mevImpact = baseMevImpact * (1 + Math.random());

    // Calculate final profit
    const tradingCapital = 1000; // Assume $1000 trade
    const grossProfit = tradingCapital * 0.02; // 2% gross profit
    const totalCosts = gasCost * 0.001 + bridgeFees + (tradingCapital * slippage) + (grossProfit * mevImpact);
    const finalProfit = grossProfit - totalCosts;

    const successProbability = Math.max(0, Math.min(1, 
      path.successProbability * (1 - Math.max(0, (executionTime - path.estimatedTime) / path.estimatedTime))
    ));

    return {
      gasCost,
      bridgeFees,
      slippage,
      executionTime,
      mevImpact,
      finalProfit,
      successProbability,
    };
  }

  private calculateVariance(values: number[]): number {
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
    return squaredDiffs.reduce((sum, diff) => sum + diff, 0) / values.length;
  }

  private async scoreAndRankPaths(
    paths: ExecutionPath[],
    simulationResults: Map<string, PathSimulationResult>
  ): Promise<ExecutionPath[]> {
    const scoredPaths = paths.map(path => {
      const simulation = simulationResults.get(path.id);
      if (!simulation) return { path, score: 0 };

      // Calculate composite score based on weights
      const costScore = Math.max(0, 100 - simulation.averageCost / 10); // Lower cost = higher score
      const timeScore = Math.max(0, 100 - simulation.averageTime / 10); // Lower time = higher score
      const reliabilityScore = simulation.successRate * 100;
      const consistencyScore = Math.max(0, 100 - Math.sqrt(simulation.profitVariance) * 10);

      const compositeScore = 
        costScore * this.config.costWeights.gasCost +
        timeScore * this.config.costWeights.executionTime +
        reliabilityScore * 0.3 +
        consistencyScore * 0.15;

      return { path, score: compositeScore };
    });

    return scoredPaths
      .sort((a, b) => b.score - a.score)
      .map(item => item.path);
  }

  private selectOptimalPath(
    rankedPaths: ExecutionPath[],
    constraints?: any
  ): ExecutionPath {
    // Apply constraints and risk tolerance
    for (const path of rankedPaths) {
      if (this.meetsConstraints(path, constraints)) {
        return path;
      }
    }

    // Fallback to first path if no path meets constraints
    return rankedPaths[0] || this.getDefaultExecutionPath();
  }

  private meetsConstraints(path: ExecutionPath, constraints?: any): boolean {
    if (!constraints) return true;

    if (constraints.maxExecutionTime && path.estimatedTime > constraints.maxExecutionTime) {
      return false;
    }

    if (constraints.minSuccessProbability && path.successProbability < constraints.minSuccessProbability) {
      return false;
    }

    if (constraints.maxGasCost && path.totalGasCost > constraints.maxGasCost) {
      return false;
    }

    return true;
  }

  private generateOptimizationStrategy(path: ExecutionPath): OptimizationStrategy {
    const techniques: OptimizationTechnique[] = [];

    // Analyze path characteristics to determine applied optimizations
    if (path.steps.length <= 3) {
      techniques.push({
        name: 'Direct Routing',
        type: 'routing',
        impact: 25,
        implementationComplexity: 'low',
        description: 'Minimized execution steps for faster completion',
      });
    }

    if (path.steps.some(step => step.type === 'bridge' && step.estimatedTime < 120)) {
      techniques.push({
        name: 'Fast Bridge Selection',
        type: 'bridging',
        impact: 20,
        implementationComplexity: 'medium',
        description: 'Selected bridges with shorter processing times',
      });
    }

    if (path.totalGasCost < 500000) {
      techniques.push({
        name: 'Gas Optimization',
        type: 'gas',
        impact: 15,
        implementationComplexity: 'medium',
        description: 'Optimized gas usage through efficient contract calls',
      });
    }

    // Determine primary strategy
    let primaryStrategy: OptimizationStrategy['primaryStrategy'] = 'hybrid';
    if (techniques.some(t => t.type === 'gas' && t.impact > 20)) {
      primaryStrategy = 'gas_optimization';
    } else if (path.estimatedTime < 180) {
      primaryStrategy = 'time_optimization';
    } else if (path.successProbability > 0.9) {
      primaryStrategy = 'risk_optimization';
    }

    const totalImpact = techniques.reduce((sum, t) => sum + t.impact, 0);
    const confidence = Math.min(0.95, 0.5 + totalImpact / 200);

    return {
      primaryStrategy,
      appliedOptimizations: techniques,
      tradeoffs: this.generateTradeoffAnalysis(techniques),
      confidence,
    };
  }

  private generateTradeoffAnalysis(techniques: OptimizationTechnique[]): string[] {
    const tradeoffs: string[] = [];

    if (techniques.some(t => t.type === 'routing' && t.name.includes('Direct'))) {
      tradeoffs.push('Reduced redundancy may increase single-point-of-failure risk');
    }

    if (techniques.some(t => t.type === 'gas')) {
      tradeoffs.push('Gas optimization may reduce execution flexibility');
    }

    if (techniques.some(t => t.type === 'timing')) {
      tradeoffs.push('Time optimization may increase gas costs');
    }

    return tradeoffs;
  }

  private async calculateDetailedCosts(
    path: ExecutionPath,
    _marketData?: any
  ): Promise<DetailedCostBreakdown> {
    // Use GasOptimizer for realistic gas cost calculations
    const gasOptimizationResult = await this.gasOptimizer.optimizeGasCosts(path);
    
    // Calculate gas costs per chain
    const gasCostsPerChain: Record<ChainID, number> = {};
    let totalGas = 0;
    let totalGasCostUSD = gasOptimizationResult.originalGasCost;

    for (const step of path.steps) {
      const gasAmount = Number(step.estimatedGas);
      
      // Use optimized gas cost calculations
      const stepCostUSD = totalGasCostUSD / path.steps.length; // Distribute cost evenly
      
      const gasCostUSD = stepCostUSD;
      
      gasCostsPerChain[step.chainId] = (gasCostsPerChain[step.chainId] || 0) + gasCostUSD;
      totalGas += gasAmount;
    }

    const totalGasUSD = Object.values(gasCostsPerChain).reduce((sum, cost) => sum + cost, 0);

    // Calculate bridge fees
    const bridgeFeesPerBridge: Record<string, number> = {};
    const bridgeSteps = path.steps.filter(step => step.type === 'bridge');
    
    for (const step of bridgeSteps) {
      const baseFee = 5; // $5 base fee
      const percentageFee = 0.001; // 0.1%
      const tradingAmount = 1000; // $1000 trade
      const totalBridgeFee = baseFee + (tradingAmount * percentageFee);
      
      bridgeFeesPerBridge[step.protocol] = totalBridgeFee;
    }

    const totalBridgeFees = Object.values(bridgeFeesPerBridge).reduce((sum, fee) => sum + fee, 0);

    // Calculate slippage costs
    const slippagePerStep = path.steps
      .filter(step => step.type === 'swap')
      .map(() => 0.005); // 0.5% slippage per swap

    const totalSlippage = slippagePerStep.reduce((sum, slip) => sum + slip, 0);

    // Calculate time costs
    const opportunityCost = path.estimatedTime * 0.0001; // $0.0001 per second
    const delayRisk = Math.max(0, (path.estimatedTime - 120) * 0.001); // Risk after 2 minutes

    // Calculate MEV costs
    const frontrunningRisk = Math.min(0.05, totalGasUSD / 1000);
    const sandwichRisk = totalSlippage * 0.5;
    const extractableValue = frontrunningRisk + sandwichRisk;
    const mevProtectionCost = extractableValue * 0.1;

    return {
      gasCosts: {
        perChain: gasCostsPerChain,
        totalGas,
        totalUSD: totalGasCostUSD,
        gasOptimizationPotential: Math.max(0, gasOptimizationResult.savings), // Ensure non-negative
      },
      bridgeFees: {
        perBridge: bridgeFeesPerBridge,
        totalFees: totalBridgeFees,
        feeOptimizationPotential: totalBridgeFees * 0.15, // 15% potential savings
      },
      slippageCosts: {
        perStep: slippagePerStep,
        totalSlippage,
        slippageOptimizationPotential: totalSlippage * 0.3, // 30% potential reduction
      },
      timeCosts: {
        opportunityCost,
        delayRisk,
        timeOptimizationPotential: (opportunityCost + delayRisk) * 0.4, // 40% potential improvement
      },
      mevCosts: {
        frontrunningRisk,
        sandwichRisk,
        extractableValue,
        mevProtectionCost,
      },
    };
  }

  private calculatePerformanceMetrics(
    path: ExecutionPath,
    simulationResults: Map<string, PathSimulationResult>
  ): PathPerformanceMetrics {
    const simulation = simulationResults.get(path.id);
    if (!simulation) {
      return {
        expectedExecutionTime: path.estimatedTime,
        executionProbability: path.successProbability,
        robustness: 0.5,
        efficiency: 0.5,
        scalability: 0.5,
        adaptability: 0.5,
      };
    }

    // Calculate robustness (resistance to market changes)
    const robustness = Math.max(0, 1 - Math.sqrt(simulation.profitVariance) / 100);

    // Calculate efficiency (cost per dollar of profit)
    const efficiency = Math.max(0, 1 - simulation.averageCost / (simulation.medianScenario.finalProfit + simulation.averageCost));

    // Calculate scalability (ability to handle larger trades)
    const scalability = path.steps.length <= 3 ? 0.9 : Math.max(0.1, 1 - (path.steps.length - 3) * 0.2);

    // Calculate adaptability (ability to handle market changes)
    const adaptability = (simulation.successRate + robustness) / 2;

    return {
      expectedExecutionTime: simulation.averageTime,
      executionProbability: simulation.successRate,
      robustness,
      efficiency,
      scalability,
      adaptability,
    };
  }

  private generateAlternativeRoutes(
    allPaths: ExecutionPath[],
    selectedPath: ExecutionPath
  ): AlternativeRoute[] {
    return allPaths
      .filter(path => path.id !== selectedPath.id)
      .slice(0, 3) // Top 3 alternatives
      .map((path, index) => {
        const costImprovement = (selectedPath.totalGasCost - path.totalGasCost) / selectedPath.totalGasCost;
        const timeImprovement = (selectedPath.estimatedTime - path.estimatedTime) / selectedPath.estimatedTime;
        const riskChange = path.successProbability - selectedPath.successProbability;

        return {
          description: this.generateRouteDescription(path, index),
          path: path.steps,
          costImprovement,
          timeImprovement,
          riskChange,
          feasibility: path.successProbability,
        };
      });
  }

  private generateRouteDescription(path: ExecutionPath, _index: number): string {
    const bridgeCount = path.steps.filter(step => step.type === 'bridge').length;
    const swapCount = path.steps.filter(step => step.type === 'swap').length;

    if (bridgeCount === 0) {
      return 'Single-chain execution with no bridging';
    } else if (bridgeCount === 1) {
      return `Direct bridge route with ${swapCount} swap${swapCount > 1 ? 's' : ''}`;
    } else {
      return `Multi-hop route using ${bridgeCount} bridges and ${swapCount} swaps`;
    }
  }

  private calculateOptimizationScore(
    _path: ExecutionPath,
    costBreakdown: DetailedCostBreakdown, 
    performanceMetrics: PathPerformanceMetrics
  ): number {
    const weights = this.config.costWeights;
    
    // Normalize scores to 0-100 scale
    const gasEfficiencyScore = Math.max(0, 100 - (costBreakdown.gasCosts.totalUSD / 100) * 100);
    const feeEfficiencyScore = Math.max(0, 100 - (costBreakdown.bridgeFees.totalFees / 50) * 100);
    const timeEfficiencyScore = Math.max(0, 100 - (performanceMetrics.expectedExecutionTime / 300) * 100);
    const slippageScore = Math.max(0, 100 - (costBreakdown.slippageCosts.totalSlippage * 1000));
    const mevScore = Math.max(0, 100 - (costBreakdown.mevCosts.extractableValue * 1000));

    const optimizationScore = 
      gasEfficiencyScore * weights.gasCost +
      feeEfficiencyScore * weights.bridgeFees +
      timeEfficiencyScore * weights.executionTime +
      slippageScore * weights.slippage +
      mevScore * weights.mevRisk;

    return Math.min(100, optimizationScore);
  }

  private getDefaultOptimizedPath(opportunity: ArbitrageOpportunity): OptimizedPath {
    const defaultPath = opportunity.executionPaths[0] || this.getDefaultExecutionPath();

    return {
      ...defaultPath,
      optimizationScore: 50,
      costBreakdown: {
        gasCosts: { perChain: {}, totalGas: 0, totalUSD: 0, gasOptimizationPotential: 0 },
        bridgeFees: { perBridge: {}, totalFees: 0, feeOptimizationPotential: 0 },
        slippageCosts: { perStep: [], totalSlippage: 0, slippageOptimizationPotential: 0 },
        timeCosts: { opportunityCost: 0, delayRisk: 0, timeOptimizationPotential: 0 },
        mevCosts: { frontrunningRisk: 0, sandwichRisk: 0, extractableValue: 0, mevProtectionCost: 0 },
      },
      performanceMetrics: {
        expectedExecutionTime: defaultPath.estimatedTime,
        executionProbability: defaultPath.successProbability,
        robustness: 0.5,
        efficiency: 0.5,
        scalability: 0.5,
        adaptability: 0.5,
      },
      alternativeRoutes: [],
      optimizationStrategy: {
        primaryStrategy: 'hybrid',
        appliedOptimizations: [],
        tradeoffs: [],
        confidence: 0.3,
      },
    };
  }

  private getDefaultExecutionPath(): ExecutionPath {
    return {
      id: 'default-path',
      steps: [],
      totalGasCost: 0,
      totalFees: 0,
      estimatedTime: 0,
      successProbability: 0.5,
      riskLevel: 'high',
    };
  }

  async optimizeBatch(opportunities: ArbitrageOpportunity[]): Promise<OptimizedPath[]> {
    const optimizationPromises = opportunities.map(opp => this.optimizePath(opp));
    return Promise.all(optimizationPromises);
  }

  updateConfiguration(config: Partial<PathOptimizationConfig>): void {
    this.config = { ...this.config, ...config };
    logger.info('Path optimization configuration updated');
  }
}