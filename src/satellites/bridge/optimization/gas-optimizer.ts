/**
 * Gas Cost Optimizer
 * Advanced algorithms for minimizing gas costs in cross-chain arbitrage execution
 */

import Logger from '../../../shared/logging/logger';
import { 
  ExecutionPath,
  ExecutionStep,
  ChainID,
  ChainConfig
} from '../types';

const logger = Logger.getLogger('gas-optimizer');

export interface GasOptimizationConfig {
  maxGasPrice: Record<ChainID, number>;
  gasEstimationBuffer: number;
  batchingThreshold: number;
  priorityFeeStrategy: 'conservative' | 'moderate' | 'aggressive';
  useLayer2Routing: boolean;
}

export interface GasOptimizationResult {
  originalGasCost: number;
  optimizedGasCost: number;
  savings: number;
  savingsPercentage: number;
  optimizations: GasOptimization[];
  recommendedPath: ExecutionPath;
  alternativePaths: ExecutionPath[];
}

export interface GasOptimization {
  type: 'batching' | 'routing' | 'timing' | 'layer2' | 'contract_optimization';
  description: string;
  gasSavings: number;
  implementationComplexity: 'low' | 'medium' | 'high';
  tradeoffs: string[];
}

export interface GasEstimate {
  chainId: ChainID;
  operation: string;
  baseGas: number;
  priorityFee: number;
  maxFee: number;
  estimatedCostUSD: number;
  confidence: number;
}

export class GasOptimizer {
  private config: GasOptimizationConfig;
  private chainConfigs: Map<ChainID, ChainConfig>;
  private gasHistory: Map<ChainID, number[]> = new Map();
  private layer2Chains = new Set(['polygon', 'arbitrum', 'optimism', 'base']);

  constructor(
    config?: Partial<GasOptimizationConfig>,
    chainConfigs?: ChainConfig[]
  ) {
    this.config = {
      maxGasPrice: {
        'ethereum': 100, // 100 gwei
        'polygon': 500,  // 500 gwei
        'arbitrum': 10,  // 10 gwei
        'optimism': 10,  // 10 gwei
        'avalanche': 50, // 50 gwei
      },
      gasEstimationBuffer: 1.2, // 20% buffer
      batchingThreshold: 3, // Batch if 3+ operations
      priorityFeeStrategy: 'moderate',
      useLayer2Routing: true,
      ...config,
    };

    this.chainConfigs = new Map();
    if (chainConfigs) {
      chainConfigs.forEach(config => this.chainConfigs.set(config.id, config));
    }

    // Initialize gas price history
    this.initializeGasHistory();

    logger.info('Gas Optimizer initialized');
  }

  private initializeGasHistory(): void {
    // Initialize with recent gas price data (simulated)
    const chains: ChainID[] = ['ethereum', 'polygon', 'arbitrum', 'optimism', 'avalanche'];
    
    for (const chainId of chains) {
      const basePrice = this.config.maxGasPrice[chainId] || 50;
      const history = Array.from({ length: 24 }, () => {
        // Simulate hourly gas prices with some volatility
        return basePrice * (0.8 + Math.random() * 0.4);
      });
      this.gasHistory.set(chainId, history);
    }
  }

  async optimizeGasCosts(path: ExecutionPath): Promise<GasOptimizationResult> {
    try {
      logger.info(`Optimizing gas costs for path ${path.id}`);

      const originalGasCost = await this.calculatePathGasCost(path);
      const optimizations: GasOptimization[] = [];

      // Apply various optimization strategies
      const batchingOptimization = this.analyzeBatchingOpportunities(path);
      if (batchingOptimization) {
        optimizations.push(batchingOptimization);
      }

      const routingOptimization = this.analyzeRoutingOptimization(path);
      if (routingOptimization) {
        optimizations.push(routingOptimization);
      }

      const timingOptimization = this.analyzeTimingOptimization(path);
      if (timingOptimization) {
        optimizations.push(timingOptimization);
      }

      const layer2Optimization = this.analyzeLayer2Optimization(path);
      if (layer2Optimization) {
        optimizations.push(layer2Optimization);
      }

      const contractOptimization = this.analyzeContractOptimization(path);
      if (contractOptimization) {
        optimizations.push(contractOptimization);
      }

      // Generate optimized path
      const recommendedPath = await this.generateOptimizedPath(path, optimizations);
      const optimizedGasCost = await this.calculatePathGasCost(recommendedPath);

      // Generate alternative paths
      const alternativePaths = await this.generateAlternativePaths(path, optimizations);

      const savings = originalGasCost - optimizedGasCost;
      const savingsPercentage = (savings / originalGasCost) * 100;

      logger.info(`Gas optimization complete: ${savings.toFixed(2)} USD savings (${savingsPercentage.toFixed(1)}%)`);

      return {
        originalGasCost,
        optimizedGasCost,
        savings,
        savingsPercentage,
        optimizations,
        recommendedPath,
        alternativePaths,
      };
    } catch (error) {
      logger.error('Error optimizing gas costs:', error);
      return this.getDefaultOptimizationResult(path);
    }
  }

  private async calculatePathGasCost(path: ExecutionPath): Promise<number> {
    let totalCostUSD = 0;

    for (const step of path.steps) {
      const gasEstimate = await this.estimateStepGas(step);
      totalCostUSD += gasEstimate.estimatedCostUSD;
    }

    return totalCostUSD;
  }

  private async estimateStepGas(step: ExecutionStep): Promise<GasEstimate> {
    const currentGasPrice = this.getCurrentGasPrice(step.chainId);
    
    // Base gas estimates by operation type
    const baseGasMap = {
      'swap': 150000,
      'bridge': 300000,
      'transfer': 21000,
    };

    const baseGas = baseGasMap[step.type] || Number(step.estimatedGas);
    const adjustedGas = Math.floor(baseGas * this.config.gasEstimationBuffer);

    // Calculate priority fee based on strategy
    const priorityFee = this.calculatePriorityFee(step.chainId, currentGasPrice);
    const maxFee = currentGasPrice + priorityFee;

    // Convert to USD (assuming ETH price for gas token)
    const ethPrice = 2000; // $2000 ETH
    const gasTokenPrice = this.isLayer2(step.chainId) ? ethPrice : ethPrice; // Simplified
    const estimatedCostUSD = (adjustedGas * maxFee / 1e9) * gasTokenPrice;

    return {
      chainId: step.chainId,
      operation: step.type,
      baseGas: adjustedGas,
      priorityFee,
      maxFee,
      estimatedCostUSD,
      confidence: 0.85,
    };
  }

  private getCurrentGasPrice(chainId: ChainID): number {
    const history = this.gasHistory.get(chainId);
    if (!history || history.length === 0) {
      return this.config.maxGasPrice[chainId] || 50;
    }
    return history[history.length - 1] || 50; // Latest price with fallback
  }

  private calculatePriorityFee(chainId: ChainID, baseGasPrice: number): number {
    const priorityMultipliers = {
      'conservative': 1.1,
      'moderate': 1.25,
      'aggressive': 1.5,
    };

    const multiplier = priorityMultipliers[this.config.priorityFeeStrategy];
    const priorityFee = Math.max(1, baseGasPrice * (multiplier - 1));

    // Cap priority fee
    const maxPriorityFee = (this.config.maxGasPrice[chainId] || 50) * 0.5;
    return Math.min(priorityFee, maxPriorityFee);
  }

  private isLayer2(chainId: ChainID): boolean {
    return this.layer2Chains.has(chainId);
  }

  private analyzeBatchingOpportunities(path: ExecutionPath): GasOptimization | null {
    const sameChainSteps = this.groupStepsByChain(path.steps);
    let totalSavings = 0;
    const batchableChains: ChainID[] = [];

    for (const [chainId, steps] of sameChainSteps.entries()) {
      if (steps.length >= this.config.batchingThreshold) {
        const individualGasCost = steps.length * 150000; // Average per transaction
        const batchedGasCost = 200000 + (steps.length - 1) * 50000; // Batch overhead
        const savings = individualGasCost - batchedGasCost;
        
        if (savings > 0) {
          totalSavings += savings;
          batchableChains.push(chainId);
        }
      }
    }

    if (totalSavings > 0) {
      return {
        type: 'batching',
        description: `Batch ${batchableChains.length} chains with multiple operations to save gas`,
        gasSavings: totalSavings * 0.001, // Convert to USD
        implementationComplexity: 'medium',
        tradeoffs: [
          'Increased transaction complexity',
          'All-or-nothing execution risk',
          'Potential for higher failure impact',
        ],
      };
    }

    return null;
  }

  private groupStepsByChain(steps: ExecutionStep[]): Map<ChainID, ExecutionStep[]> {
    const grouped = new Map<ChainID, ExecutionStep[]>();
    
    for (const step of steps) {
      if (!grouped.has(step.chainId)) {
        grouped.set(step.chainId, []);
      }
      grouped.get(step.chainId)!.push(step);
    }

    return grouped;
  }

  private analyzeRoutingOptimization(path: ExecutionPath): GasOptimization | null {
    // Check if routing through layer 2 chains could save gas
    if (!this.config.useLayer2Routing) return null;

    const mainnetSteps = path.steps.filter(step => step.chainId === 'ethereum');
    if (mainnetSteps.length <= 1) return null;

    // Estimate savings by routing through layer 2
    const mainnetGasCost = mainnetSteps.reduce((sum, step) => sum + Number(step.estimatedGas), 0);
    const layer2Equivalent = mainnetGasCost * 0.1; // Layer 2 is ~10% of mainnet cost
    const bridgeCost = 200000; // Cost to bridge to/from layer 2

    const totalMainnetCost = mainnetGasCost * 100; // 100 gwei
    const totalLayer2Cost = (layer2Equivalent + bridgeCost * 2) * 10; // 10 gwei

    if (totalLayer2Cost < totalMainnetCost) {
      const gasSavings = (totalMainnetCost - totalLayer2Cost) / 1e9 * 2000; // Convert to USD

      return {
        type: 'routing',
        description: 'Route operations through Layer 2 to reduce gas costs',
        gasSavings,
        implementationComplexity: 'high',
        tradeoffs: [
          'Additional bridging time required',
          'Increased execution complexity',
          'Bridge security considerations',
        ],
      };
    }

    return null;
  }

  private analyzeTimingOptimization(path: ExecutionPath): GasOptimization | null {
    const currentGasPrices = path.steps.map(step => this.getCurrentGasPrice(step.chainId));
    const averageGasPrices = path.steps.map(step => this.getAverageGasPrice(step.chainId));

    let potentialSavings = 0;
    let highGasSteps = 0;

    for (let i = 0; i < currentGasPrices.length; i++) {
      const current = currentGasPrices[i];
      const average = averageGasPrices[i];
      const step = path.steps[i];
      
      if (current && average && step && current > average * 1.2) { // Current price is 20% above average
        const currentCost = Number(step.estimatedGas) * current / 1e9 * 2000;
        const averageCost = Number(step.estimatedGas) * average / 1e9 * 2000;
        potentialSavings += currentCost - averageCost;
        highGasSteps++;
      }
    }

    if (potentialSavings > 5 && highGasSteps > 0) { // $5+ potential savings
      return {
        type: 'timing',
        description: `Delay execution to avoid high gas prices on ${highGasSteps} operations`,
        gasSavings: potentialSavings,
        implementationComplexity: 'low',
        tradeoffs: [
          'Execution delay risk',
          'Market condition changes',
          'Opportunity cost of waiting',
        ],
      };
    }

    return null;
  }

  private getAverageGasPrice(chainId: ChainID): number {
    const history = this.gasHistory.get(chainId);
    if (!history || history.length === 0) {
      return this.config.maxGasPrice[chainId] || 50;
    }
    return history.reduce((sum, price) => sum + price, 0) / history.length;
  }

  private analyzeLayer2Optimization(path: ExecutionPath): GasOptimization | null {
    if (!this.config.useLayer2Routing) return null;

    // Count operations that could benefit from layer 2
    const expensiveSteps = path.steps.filter(step => 
      step.chainId === 'ethereum' && Number(step.estimatedGas) > 100000
    );

    if (expensiveSteps.length > 0) {
      const mainnetCost = expensiveSteps.reduce((sum, step) => {
        const gasPrice = this.getCurrentGasPrice(step.chainId);
        return sum + (Number(step.estimatedGas) * gasPrice / 1e9 * 2000);
      }, 0);

      const layer2Cost = mainnetCost * 0.1; // 90% savings on layer 2
      const bridgeCost = 50; // $50 to bridge

      if (mainnetCost - layer2Cost > bridgeCost) {
        return {
          type: 'layer2',
          description: 'Use Layer 2 scaling solutions for expensive operations',
          gasSavings: mainnetCost - layer2Cost - bridgeCost,
          implementationComplexity: 'high',
          tradeoffs: [
            'Requires bridging to Layer 2',
            'Additional execution complexity',
            'Bridge security risks',
          ],
        };
      }
    }

    return null;
  }

  private analyzeContractOptimization(path: ExecutionPath): GasOptimization | null {
    // Analyze if using more efficient contracts could save gas
    let potentialSavings = 0;

    for (const step of path.steps) {
      if (step.type === 'swap') {
        // Check if using a more efficient DEX could save gas
        const currentGasEstimate = Number(step.estimatedGas);
        const efficientGasEstimate = this.getEfficientContractGas(step.protocol);
        
        if (currentGasEstimate > efficientGasEstimate) {
          const gasPrice = this.getCurrentGasPrice(step.chainId);
          const savings = (currentGasEstimate - efficientGasEstimate) * gasPrice / 1e9 * 2000;
          potentialSavings += savings;
        }
      }
    }

    if (potentialSavings > 10) { // $10+ potential savings
      return {
        type: 'contract_optimization',
        description: 'Use more gas-efficient contracts and protocols',
        gasSavings: potentialSavings,
        implementationComplexity: 'medium',
        tradeoffs: [
          'May require protocol changes',
          'Potential liquidity differences',
          'Smart contract risk variations',
        ],
      };
    }

    return null;
  }

  private getEfficientContractGas(protocol: string): number {
    // Gas estimates for efficient versions of protocols
    const efficientGasMap: Record<string, number> = {
      'uniswap-v3': 120000,
      'uniswap-v2': 150000,
      'sushiswap': 140000,
      'curve': 180000,
      'balancer': 200000,
      'default': 150000,
    };

    return efficientGasMap[protocol] || efficientGasMap['default'] || 150000;
  }

  private async generateOptimizedPath(
    originalPath: ExecutionPath,
    optimizations: GasOptimization[]
  ): Promise<ExecutionPath> {
    let optimizedSteps = [...originalPath.steps];

    // Apply optimizations
    for (const optimization of optimizations) {
      switch (optimization.type) {
        case 'batching':
          optimizedSteps = this.applyBatchingOptimization(optimizedSteps);
          break;
        case 'routing':
          optimizedSteps = await this.applyRoutingOptimization(optimizedSteps);
          break;
        case 'contract_optimization':
          optimizedSteps = this.applyContractOptimization(optimizedSteps);
          break;
        // timing and layer2 optimizations are applied at execution time
      }
    }

    // Recalculate path metrics
    const newTotalGasCost = optimizedSteps.reduce((sum, step) => sum + Number(step.estimatedGas), 0);
    const newEstimatedTime = optimizedSteps.reduce((sum, step) => sum + step.estimatedTime, 0);

    return {
      ...originalPath,
      id: `optimized-${originalPath.id}`,
      steps: optimizedSteps,
      totalGasCost: newTotalGasCost,
      estimatedTime: newEstimatedTime,
      successProbability: Math.max(0.8, originalPath.successProbability - 0.05), // Slight reduction due to complexity
    };
  }

  private applyBatchingOptimization(steps: ExecutionStep[]): ExecutionStep[] {
    const grouped = this.groupStepsByChain(steps);
    const batchedSteps: ExecutionStep[] = [];

    for (const [chainId, chainSteps] of grouped.entries()) {
      if (chainSteps.length >= this.config.batchingThreshold) {
        // Create a batched step
        const batchedStep: ExecutionStep = {
          type: 'swap', // Simplified - could be more complex
          chainId,
          protocol: 'batched-execution',
          contractAddress: '0xbatch',
          estimatedGas: 200000 + (chainSteps.length - 1) * 50000,
          estimatedTime: Math.max(...chainSteps.map(s => s.estimatedTime)),
          dependencies: chainSteps.flatMap(s => s.dependencies),
        };
        batchedSteps.push(batchedStep);
      } else {
        batchedSteps.push(...chainSteps);
      }
    }

    return batchedSteps;
  }

  private async applyRoutingOptimization(steps: ExecutionStep[]): Promise<ExecutionStep[]> {
    // Route expensive mainnet operations through layer 2
    const optimizedSteps: ExecutionStep[] = [];

    for (const step of steps) {
      if (step.chainId === 'ethereum' && Number(step.estimatedGas) > 100000) {
        // Add bridge to layer 2
        optimizedSteps.push({
          type: 'bridge',
          chainId: 'ethereum',
          protocol: 'arbitrum-bridge',
          contractAddress: '0xbridge1',
          estimatedGas: 150000,
          estimatedTime: 60,
          dependencies: step.dependencies,
        });

        // Execute on layer 2
        optimizedSteps.push({
          ...step,
          chainId: 'arbitrum',
          estimatedGas: Number(step.estimatedGas) * 0.1,
          dependencies: [`bridge-${optimizedSteps.length - 1}`],
        });

        // Bridge back if needed
        optimizedSteps.push({
          type: 'bridge',
          chainId: 'arbitrum',
          protocol: 'arbitrum-bridge',
          contractAddress: '0xbridge2',
          estimatedGas: 100000,
          estimatedTime: 60,
          dependencies: [`l2-${optimizedSteps.length - 1}`],
        });
      } else {
        optimizedSteps.push(step);
      }
    }

    return optimizedSteps;
  }

  private applyContractOptimization(steps: ExecutionStep[]): ExecutionStep[] {
    return steps.map(step => {
      if (step.type === 'swap') {
        const efficientGas = this.getEfficientContractGas(step.protocol);
        return {
          ...step,
          estimatedGas: efficientGas,
          protocol: `${step.protocol}-optimized`,
        };
      }
      return step;
    });
  }

  private async generateAlternativePaths(
    originalPath: ExecutionPath,
    optimizations: GasOptimization[]
  ): Promise<ExecutionPath[]> {
    const alternatives: ExecutionPath[] = [];

    // Generate path with only timing optimization
    const timingOptimization = optimizations.find(opt => opt.type === 'timing');
    if (timingOptimization) {
      alternatives.push({
        ...originalPath,
        id: `timing-optimized-${originalPath.id}`,
        estimatedTime: originalPath.estimatedTime + 300, // 5 minute delay
      });
    }

    // Generate path with only batching
    const batchingOptimization = optimizations.find(opt => opt.type === 'batching');
    if (batchingOptimization) {
      const batchedSteps = this.applyBatchingOptimization(originalPath.steps);
      alternatives.push({
        ...originalPath,
        id: `batched-${originalPath.id}`,
        steps: batchedSteps,
        totalGasCost: batchedSteps.reduce((sum, step) => sum + Number(step.estimatedGas), 0),
      });
    }

    return alternatives;
  }

  private getDefaultOptimizationResult(path: ExecutionPath): GasOptimizationResult {
    return {
      originalGasCost: path.totalGasCost,
      optimizedGasCost: path.totalGasCost,
      savings: 0,
      savingsPercentage: 0,
      optimizations: [],
      recommendedPath: path,
      alternativePaths: [],
    };
  }

  updateGasPrice(chainId: ChainID, gasPrice: number): void {
    const history = this.gasHistory.get(chainId) || [];
    history.push(gasPrice);
    
    // Keep only last 24 hours of data
    if (history.length > 24) {
      history.shift();
    }
    
    this.gasHistory.set(chainId, history);
  }

  getGasPriceRecommendation(chainId: ChainID): {
    slow: number;
    standard: number;
    fast: number;
  } {
    const currentPrice = this.getCurrentGasPrice(chainId);
    const averagePrice = this.getAverageGasPrice(chainId);

    return {
      slow: Math.max(1, averagePrice * 0.8),
      standard: currentPrice,
      fast: currentPrice * 1.2,
    };
  }
}