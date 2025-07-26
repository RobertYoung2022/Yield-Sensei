/**
 * Execution Time Optimizer
 * Advanced algorithms for minimizing execution time in cross-chain arbitrage
 */

import Logger from '../../../shared/logging/logger';
import { 
  ExecutionPath,
  ExecutionStep,
  ChainID,
  ChainConfig
} from '../types';

const logger = Logger.getLogger('execution-time-optimizer');

export interface TimeOptimizationConfig {
  maxAcceptableDelay: number; // Maximum acceptable delay in seconds
  parallelExecutionThreshold: number; // Minimum steps to consider parallel execution
  preemptiveExecutionEnabled: boolean;
  networkCongestionWeight: number;
  gasPriceSpeedTradeoff: number; // How much extra gas to pay for speed
}

export interface TimeOptimizationResult {
  originalExecutionTime: number;
  optimizedExecutionTime: number;
  timeSavings: number;
  timeSavingsPercentage: number;
  optimizations: TimeOptimization[];
  optimizedPath: ExecutionPath;
  contingencyPlans: ContingencyPlan[];
  executionSchedule: ExecutionSchedule;
}

export interface TimeOptimization {
  type: 'parallel_execution' | 'preemptive_bridging' | 'gas_acceleration' | 'route_shortening' | 'batch_processing';
  description: string;
  timeSavings: number;
  additionalCost: number;
  riskLevel: 'low' | 'medium' | 'high';
  implementationComplexity: 'low' | 'medium' | 'high';
}

export interface ContingencyPlan {
  trigger: string;
  action: string;
  timeImpact: number;
  costImpact: number;
  probability: number;
}

export interface ExecutionSchedule {
  phases: ExecutionPhase[];
  criticalPath: string[];
  parallelGroups: ParallelGroup[];
  totalTime: number;
  bufferTime: number;
}

export interface ExecutionPhase {
  id: string;
  steps: string[];
  startTime: number;
  duration: number;
  dependencies: string[];
  canRunInParallel: boolean;
}

export interface ParallelGroup {
  id: string;
  steps: ExecutionStep[];
  maxDuration: number;
  coordinationOverhead: number;
}

export interface NetworkCondition {
  chainId: ChainID;
  congestionLevel: number; // 0-1
  avgBlockTime: number;
  gasPrice: number;
  transactionPoolSize: number;
  lastUpdated: number;
}

export class ExecutionTimeOptimizer {
  private config: TimeOptimizationConfig;
  private networkConditions: Map<ChainID, NetworkCondition> = new Map();
  private historicalTimes: Map<string, number[]> = new Map();
  private chainConfigs: Map<ChainID, ChainConfig> = new Map();

  constructor(
    config?: Partial<TimeOptimizationConfig>,
    chainConfigs?: ChainConfig[]
  ) {
    this.config = {
      maxAcceptableDelay: 300, // 5 minutes
      parallelExecutionThreshold: 3,
      preemptiveExecutionEnabled: true,
      networkCongestionWeight: 0.3,
      gasPriceSpeedTradeoff: 1.5, // Pay 50% more gas for speed
      ...config,
    };

    if (chainConfigs) {
      chainConfigs.forEach(config => this.chainConfigs.set(config.id, config));
    }

    this.initializeNetworkConditions();
    logger.info('Execution Time Optimizer initialized');
  }

  private initializeNetworkConditions(): void {
    const chains: ChainID[] = ['ethereum', 'polygon', 'arbitrum', 'optimism', 'avalanche'];
    
    for (const chainId of chains) {
      this.networkConditions.set(chainId, {
        chainId,
        congestionLevel: Math.random() * 0.8, // 0-80% congestion
        avgBlockTime: this.getBaseBlockTime(chainId),
        gasPrice: this.getBaseGasPrice(chainId),
        transactionPoolSize: Math.floor(Math.random() * 50000),
        lastUpdated: Date.now(),
      });
    }
  }

  private getBaseBlockTime(chainId: ChainID): number {
    const blockTimes: Record<string, number> = {
      'ethereum': 12,
      'polygon': 2,
      'arbitrum': 1,
      'optimism': 2,
      'avalanche': 2,
    };
    return blockTimes[chainId] || 12;
  }

  private getBaseGasPrice(chainId: ChainID): number {
    const gasPrices: Record<string, number> = {
      'ethereum': 30,
      'polygon': 100,
      'arbitrum': 1,
      'optimism': 1,
      'avalanche': 25,
    };
    return gasPrices[chainId] || 30;
  }

  async optimizeExecutionTime(path: ExecutionPath): Promise<TimeOptimizationResult> {
    try {
      logger.info(`Optimizing execution time for path ${path.id}`);

      const originalExecutionTime = this.calculatePathExecutionTime(path);
      const optimizations: TimeOptimization[] = [];

      // Analyze parallel execution opportunities
      const parallelOptimization = this.analyzeParallelExecution(path);
      if (parallelOptimization) {
        optimizations.push(parallelOptimization);
      }

      // Analyze preemptive bridging opportunities
      const preemptiveOptimization = this.analyzePreemptiveBridging(path);
      if (preemptiveOptimization) {
        optimizations.push(preemptiveOptimization);
      }

      // Analyze gas acceleration opportunities
      const gasOptimization = this.analyzeGasAcceleration(path);
      if (gasOptimization) {
        optimizations.push(gasOptimization);
      }

      // Analyze route shortening opportunities
      const routeOptimization = this.analyzeRouteShortening(path);
      if (routeOptimization) {
        optimizations.push(routeOptimization);
      }

      // Analyze batch processing opportunities
      const batchOptimization = this.analyzeBatchProcessing(path);
      if (batchOptimization) {
        optimizations.push(batchOptimization);
      }

      // Generate optimized path
      const optimizedPath = await this.generateOptimizedPath(path, optimizations);
      const optimizedExecutionTime = this.calculatePathExecutionTime(optimizedPath);

      // Generate contingency plans
      const contingencyPlans = this.generateContingencyPlans(optimizedPath);

      // Create execution schedule
      const executionSchedule = this.createExecutionSchedule(optimizedPath, optimizations);

      const timeSavings = originalExecutionTime - optimizedExecutionTime;
      const timeSavingsPercentage = (timeSavings / originalExecutionTime) * 100;

      logger.info(`Time optimization complete: ${timeSavings.toFixed(0)}s savings (${timeSavingsPercentage.toFixed(1)}%)`);

      return {
        originalExecutionTime,
        optimizedExecutionTime,
        timeSavings,
        timeSavingsPercentage,
        optimizations,
        optimizedPath,
        contingencyPlans,
        executionSchedule,
      };
    } catch (error) {
      logger.error('Error optimizing execution time:', error);
      return this.getDefaultOptimizationResult(path);
    }
  }

  private calculatePathExecutionTime(path: ExecutionPath): number {
    let totalTime = 0;
    
    for (const step of path.steps) {
      const networkCondition = this.networkConditions.get(step.chainId);
      const baseTime = step.estimatedTime;
      
      if (networkCondition) {
        // Adjust for network congestion
        const congestionMultiplier = 1 + (networkCondition.congestionLevel * this.config.networkCongestionWeight);
        const adjustedTime = baseTime * congestionMultiplier;
        totalTime += adjustedTime;
      } else {
        totalTime += baseTime;
      }
    }

    return totalTime;
  }

  private analyzeParallelExecution(path: ExecutionPath): TimeOptimization | null {
    if (path.steps.length < this.config.parallelExecutionThreshold) {
      return null;
    }

    // Find steps that can be executed in parallel
    const parallelGroups = this.identifyParallelGroups(path.steps);
    
    if (parallelGroups.length === 0) {
      return null;
    }

    // Calculate time savings from parallel execution
    let timeSavings = 0;
    let coordinationCost = 0;

    for (const group of parallelGroups) {
      const sequentialTime = group.steps.reduce((sum, step) => sum + step.estimatedTime, 0);
      const parallelTime = Math.max(...group.steps.map(step => step.estimatedTime));
      const groupSavings = sequentialTime - parallelTime;
      
      timeSavings += groupSavings;
      coordinationCost += group.coordinationOverhead;
    }

    if (timeSavings > coordinationCost) {
      return {
        type: 'parallel_execution',
        description: `Execute ${parallelGroups.length} groups of operations in parallel`,
        timeSavings: timeSavings - coordinationCost,
        additionalCost: coordinationCost * 0.1, // $0.1 per second of coordination
        riskLevel: 'medium',
        implementationComplexity: 'high',
      };
    }

    return null;
  }

  private identifyParallelGroups(steps: ExecutionStep[]): ParallelGroup[] {
    const groups: ParallelGroup[] = [];
    const processed = new Set<number>();

    for (let i = 0; i < steps.length; i++) {
      if (processed.has(i)) continue;

      const step = steps[i];
      const parallelSteps: ExecutionStep[] = [step];
      processed.add(i);

      // Find other steps that can run in parallel with this one
      for (let j = i + 1; j < steps.length; j++) {
        if (processed.has(j)) continue;

        const otherStep = steps[j];
        
        // Check if steps can run in parallel (different chains, no dependencies)
        if (this.canRunInParallel(step, otherStep, steps)) {
          parallelSteps.push(otherStep);
          processed.add(j);
        }
      }

      if (parallelSteps.length > 1) {
        groups.push({
          id: `group-${groups.length}`,
          steps: parallelSteps,
          maxDuration: Math.max(...parallelSteps.map(s => s.estimatedTime)),
          coordinationOverhead: parallelSteps.length * 2, // 2 seconds per step coordination
        });
      }
    }

    return groups;
  }

  private canRunInParallel(step1: ExecutionStep, step2: ExecutionStep, allSteps: ExecutionStep[]): boolean {
    // Different chains can often run in parallel
    if (step1.chainId !== step2.chainId) {
      // Check dependencies
      const step1Index = allSteps.indexOf(step1);
      const step2Index = allSteps.indexOf(step2);
      
      // Check if either step depends on the other
      const step1Deps = step1.dependencies || [];
      const step2Deps = step2.dependencies || [];
      
      const step1DependsOnStep2 = step1Deps.some(dep => dep.includes(step2Index.toString()));
      const step2DependsOnStep1 = step2Deps.some(dep => dep.includes(step1Index.toString()));
      
      return !step1DependsOnStep2 && !step2DependsOnStep1;
    }

    return false;
  }

  private analyzePreemptiveBridging(path: ExecutionPath): TimeOptimization | null {
    if (!this.config.preemptiveExecutionEnabled) {
      return null;
    }

    // Look for bridge operations that could be started early
    const bridgeSteps = path.steps.filter(step => step.type === 'bridge');
    
    if (bridgeSteps.length === 0) {
      return null;
    }

    let totalSavings = 0;
    let totalCost = 0;

    for (const bridgeStep of bridgeSteps) {
      const stepIndex = path.steps.indexOf(bridgeStep);
      
      // Check if we can start this bridge operation earlier
      const earliestStart = this.calculateEarliestBridgeStart(bridgeStep, path.steps, stepIndex);
      
      if (earliestStart > 0) {
        totalSavings += earliestStart;
        totalCost += 5; // $5 coordination cost per preemptive bridge
      }
    }

    if (totalSavings > 30) { // At least 30 seconds savings
      return {
        type: 'preemptive_bridging',
        description: 'Start bridge operations early to reduce overall execution time',
        timeSavings: totalSavings,
        additionalCost: totalCost,
        riskLevel: 'medium',
        implementationComplexity: 'high',
      };
    }

    return null;
  }

  private calculateEarliestBridgeStart(bridgeStep: ExecutionStep, allSteps: ExecutionStep[], currentIndex: number): number {
    // Calculate how much earlier we could start the bridge
    const dependencies = bridgeStep.dependencies || [];
    
    if (dependencies.length === 0) {
      return 0; // Can't start earlier without dependencies
    }

    // Find the latest dependency completion time
    let latestDependencyTime = 0;
    for (let i = 0; i < currentIndex; i++) {
      const step = allSteps[i];
      const stepId = `step-${i}`;
      
      if (dependencies.includes(stepId)) {
        latestDependencyTime = Math.max(latestDependencyTime, step.estimatedTime);
      }
    }

    // Calculate current start time
    const currentStartTime = allSteps.slice(0, currentIndex).reduce((sum, step) => sum + step.estimatedTime, 0);
    
    // Early start time would be right after dependencies
    const earlyStartTime = latestDependencyTime;
    
    return Math.max(0, currentStartTime - earlyStartTime);
  }

  private analyzeGasAcceleration(path: ExecutionPath): TimeOptimization | null {
    const congestionSteps = path.steps.filter(step => {
      const condition = this.networkConditions.get(step.chainId);
      return condition && condition.congestionLevel > 0.5;
    });

    if (congestionSteps.length === 0) {
      return null;
    }

    let timeSavings = 0;
    let additionalCost = 0;

    for (const step of congestionSteps) {
      const condition = this.networkConditions.get(step.chainId)!;
      const congestionDelay = step.estimatedTime * condition.congestionLevel * 0.5;
      const gasCostIncrease = Number(step.estimatedGas) * condition.gasPrice * (this.config.gasPriceSpeedTradeoff - 1) / 1e9 * 2000;
      
      timeSavings += congestionDelay;
      additionalCost += gasCostIncrease;
    }

    if (timeSavings > 30 && additionalCost < 100) { // 30s savings, max $100 cost
      return {
        type: 'gas_acceleration',
        description: `Pay higher gas fees to bypass congestion on ${congestionSteps.length} operations`,
        timeSavings,
        additionalCost,
        riskLevel: 'low',
        implementationComplexity: 'low',
      };
    }

    return null;
  }

  private analyzeRouteShortening(path: ExecutionPath): TimeOptimization | null {
    // Look for opportunities to reduce the number of steps
    if (path.steps.length <= 3) {
      return null; // Already quite short
    }

    const bridgeSteps = path.steps.filter(step => step.type === 'bridge');
    const swapSteps = path.steps.filter(step => step.type === 'swap');

    // Check if we can combine some operations
    let potentialSavings = 0;
    let implementationCost = 0;

    // If there are multiple swaps on the same chain, they might be combinable
    const swapsByChain = new Map<ChainID, ExecutionStep[]>();
    swapSteps.forEach(step => {
      if (!swapsByChain.has(step.chainId)) {
        swapsByChain.set(step.chainId, []);
      }
      swapsByChain.get(step.chainId)!.push(step);
    });

    for (const [chainId, steps] of swapsByChain.entries()) {
      if (steps.length > 1) {
        const combinedTime = Math.max(...steps.map(s => s.estimatedTime)) + 10; // 10s combination overhead
        const separateTime = steps.reduce((sum, s) => sum + s.estimatedTime, 0);
        
        if (separateTime > combinedTime) {
          potentialSavings += separateTime - combinedTime;
          implementationCost += 20; // $20 to implement route combination
        }
      }
    }

    if (potentialSavings > 60) { // At least 1 minute savings
      return {
        type: 'route_shortening',
        description: 'Combine multiple operations to reduce total execution steps',
        timeSavings: potentialSavings,
        additionalCost: implementationCost,
        riskLevel: 'medium',
        implementationComplexity: 'high',
      };
    }

    return null;
  }

  private analyzeBatchProcessing(path: ExecutionPath): TimeOptimization | null {
    // Look for opportunities to batch multiple operations
    const sameChainSteps = new Map<ChainID, ExecutionStep[]>();
    
    path.steps.forEach(step => {
      if (!sameChainSteps.has(step.chainId)) {
        sameChainSteps.set(step.chainId, []);
      }
      sameChainSteps.get(step.chainId)!.push(step);
    });

    let totalSavings = 0;
    let totalCost = 0;

    for (const [chainId, steps] of sameChainSteps.entries()) {
      if (steps.length >= 3) { // Need at least 3 operations to batch
        const individualTime = steps.reduce((sum, step) => sum + step.estimatedTime, 0);
        const batchTime = Math.max(...steps.map(s => s.estimatedTime)) + 20; // 20s batch overhead
        
        if (individualTime > batchTime) {
          totalSavings += individualTime - batchTime;
          totalCost += 15; // $15 batching cost
        }
      }
    }

    if (totalSavings > 45) { // At least 45 seconds savings
      return {
        type: 'batch_processing',
        description: 'Batch multiple operations on the same chain for efficiency',
        timeSavings: totalSavings,
        additionalCost: totalCost,
        riskLevel: 'low',
        implementationComplexity: 'medium',
      };
    }

    return null;
  }

  private async generateOptimizedPath(path: ExecutionPath, optimizations: TimeOptimization[]): Promise<ExecutionPath> {
    let optimizedSteps = [...path.steps];

    // Apply optimizations
    for (const optimization of optimizations) {
      switch (optimization.type) {
        case 'parallel_execution':
          optimizedSteps = this.applyParallelExecution(optimizedSteps);
          break;
        case 'gas_acceleration':
          optimizedSteps = this.applyGasAcceleration(optimizedSteps);
          break;
        case 'route_shortening':
          optimizedSteps = this.applyRouteShortening(optimizedSteps);
          break;
        case 'batch_processing':
          optimizedSteps = this.applyBatchProcessing(optimizedSteps);
          break;
        // preemptive_bridging is handled at execution time
      }
    }

    return {
      ...path,
      id: `time-optimized-${path.id}`,
      steps: optimizedSteps,
      estimatedTime: this.calculatePathExecutionTime({ ...path, steps: optimizedSteps }),
      successProbability: Math.max(0.85, path.successProbability - 0.05), // Slight reduction for complexity
    };
  }

  private applyParallelExecution(steps: ExecutionStep[]): ExecutionStep[] {
    // Mark steps that can run in parallel
    const parallelGroups = this.identifyParallelGroups(steps);
    const optimizedSteps = [...steps];

    for (const group of parallelGroups) {
      group.steps.forEach(step => {
        const stepIndex = optimizedSteps.indexOf(step);
        optimizedSteps[stepIndex] = {
          ...step,
          estimatedTime: Math.max(...group.steps.map(s => s.estimatedTime)), // Use max time for parallel group
        };
      });
    }

    return optimizedSteps;
  }

  private applyGasAcceleration(steps: ExecutionStep[]): ExecutionStep[] {
    return steps.map(step => {
      const condition = this.networkConditions.get(step.chainId);
      
      if (condition && condition.congestionLevel > 0.5) {
        const speedupFactor = 1 - (condition.congestionLevel * 0.3); // Up to 30% faster
        
        return {
          ...step,
          estimatedTime: Math.floor(step.estimatedTime * speedupFactor),
          estimatedGas: BigInt(Math.floor(Number(step.estimatedGas) * this.config.gasPriceSpeedTradeoff)),
        };
      }
      
      return step;
    });
  }

  private applyRouteShortening(steps: ExecutionStep[]): ExecutionStep[] {
    // Combine consecutive swaps on the same chain
    const optimizedSteps: ExecutionStep[] = [];
    let i = 0;

    while (i < steps.length) {
      const currentStep = steps[i];
      
      if (currentStep.type === 'swap') {
        // Look for consecutive swaps on the same chain
        const consecutiveSwaps = [currentStep];
        let j = i + 1;
        
        while (j < steps.length && 
               steps[j].type === 'swap' && 
               steps[j].chainId === currentStep.chainId) {
          consecutiveSwaps.push(steps[j]);
          j++;
        }

        if (consecutiveSwaps.length > 1) {
          // Combine into a single step
          const combinedStep: ExecutionStep = {
            type: 'swap',
            chainId: currentStep.chainId,
            protocol: 'combined-swap',
            contractAddress: currentStep.contractAddress,
            estimatedGas: consecutiveSwaps.reduce((sum, step) => sum + Number(step.estimatedGas), BigInt(0)),
            estimatedTime: Math.max(...consecutiveSwaps.map(s => s.estimatedTime)) + 10,
            dependencies: currentStep.dependencies,
          };
          
          optimizedSteps.push(combinedStep);
          i = j;
        } else {
          optimizedSteps.push(currentStep);
          i++;
        }
      } else {
        optimizedSteps.push(currentStep);
        i++;
      }
    }

    return optimizedSteps;
  }

  private applyBatchProcessing(steps: ExecutionStep[]): ExecutionStep[] {
    // Group steps by chain and batch them
    const stepsByChain = new Map<ChainID, ExecutionStep[]>();
    const otherSteps: ExecutionStep[] = [];

    steps.forEach(step => {
      if (step.type === 'swap' || step.type === 'transfer') {
        if (!stepsByChain.has(step.chainId)) {
          stepsByChain.set(step.chainId, []);
        }
        stepsByChain.get(step.chainId)!.push(step);
      } else {
        otherSteps.push(step);
      }
    });

    const batchedSteps: ExecutionStep[] = [];

    for (const [chainId, chainSteps] of stepsByChain.entries()) {
      if (chainSteps.length >= 3) {
        // Create a batched step
        const batchedStep: ExecutionStep = {
          type: 'swap',
          chainId,
          protocol: 'batched-operations',
          contractAddress: chainSteps[0].contractAddress,
          estimatedGas: chainSteps.reduce((sum, step) => sum + Number(step.estimatedGas), BigInt(0)),
          estimatedTime: Math.max(...chainSteps.map(s => s.estimatedTime)) + 20,
          dependencies: chainSteps[0].dependencies,
        };
        
        batchedSteps.push(batchedStep);
      } else {
        batchedSteps.push(...chainSteps);
      }
    }

    return [...batchedSteps, ...otherSteps].sort((a, b) => {
      // Maintain original order as much as possible
      const originalIndexA = steps.indexOf(a) !== -1 ? steps.indexOf(a) : steps.length;
      const originalIndexB = steps.indexOf(b) !== -1 ? steps.indexOf(b) : steps.length;
      return originalIndexA - originalIndexB;
    });
  }

  private generateContingencyPlans(path: ExecutionPath): ContingencyPlan[] {
    const plans: ContingencyPlan[] = [];

    // Network congestion contingency
    plans.push({
      trigger: 'Network congestion >80%',
      action: 'Increase gas price by 50% or pause execution',
      timeImpact: 60,
      costImpact: 25,
      probability: 0.15,
    });

    // Bridge delay contingency
    const bridgeSteps = path.steps.filter(step => step.type === 'bridge');
    if (bridgeSteps.length > 0) {
      plans.push({
        trigger: 'Bridge processing >2x expected time',
        action: 'Switch to alternative bridge or cancel',
        timeImpact: 300,
        costImpact: 15,
        probability: 0.1,
      });
    }

    // Failed transaction contingency
    plans.push({
      trigger: 'Transaction failure',
      action: 'Retry with higher gas or alternative route',
      timeImpact: 120,
      costImpact: 20,
      probability: 0.05,
    });

    return plans;
  }

  private createExecutionSchedule(path: ExecutionPath, optimizations: TimeOptimization[]): ExecutionSchedule {
    const phases: ExecutionPhase[] = [];
    const parallelGroups: ParallelGroup[] = [];
    let currentTime = 0;

    // Identify parallel groups first
    const stepParallelGroups = this.identifyParallelGroups(path.steps);
    const parallelStepIds = new Set<string>();

    stepParallelGroups.forEach((group, groupIndex) => {
      const groupId = `parallel-${groupIndex}`;
      parallelGroups.push(group);
      
      phases.push({
        id: `phase-parallel-${groupIndex}`,
        steps: group.steps.map((_, stepIndex) => `${groupId}-${stepIndex}`),
        startTime: currentTime,
        duration: group.maxDuration,
        dependencies: [],
        canRunInParallel: true,
      });

      group.steps.forEach((step, stepIndex) => {
        parallelStepIds.add(`${groupId}-${stepIndex}`);
      });

      currentTime += group.maxDuration;
    });

    // Add sequential phases for non-parallel steps
    path.steps.forEach((step, index) => {
      const stepId = `step-${index}`;
      
      if (!parallelStepIds.has(stepId)) {
        phases.push({
          id: `phase-${index}`,
          steps: [stepId],
          startTime: currentTime,
          duration: step.estimatedTime,
          dependencies: step.dependencies || [],
          canRunInParallel: false,
        });

        currentTime += step.estimatedTime;
      }
    });

    // Identify critical path
    const criticalPath = this.identifyCriticalPath(phases);

    return {
      phases,
      criticalPath,
      parallelGroups,
      totalTime: currentTime,
      bufferTime: Math.max(30, currentTime * 0.1), // 10% buffer, minimum 30s
    };
  }

  private identifyCriticalPath(phases: ExecutionPhase[]): string[] {
    // Find the longest path through the phases
    const phaseGraph = new Map<string, string[]>();
    const phaseEndTimes = new Map<string, number>();

    // Build dependency graph
    phases.forEach(phase => {
      phaseGraph.set(phase.id, phase.dependencies);
      phaseEndTimes.set(phase.id, phase.startTime + phase.duration);
    });

    // Find the phase that ends latest
    let latestPhase = phases[0];
    let latestTime = 0;

    for (const phase of phases) {
      const endTime = phaseEndTimes.get(phase.id) || 0;
      if (endTime > latestTime) {
        latestTime = endTime;
        latestPhase = phase;
      }
    }

    // Trace back through dependencies to find critical path
    const criticalPath: string[] = [];
    let currentPhase = latestPhase;

    while (currentPhase) {
      criticalPath.unshift(currentPhase.id);
      
      // Find the dependency with the latest end time
      const dependencies = phaseGraph.get(currentPhase.id) || [];
      let nextPhase = null;
      let latestDepTime = 0;

      for (const depId of dependencies) {
        const depPhase = phases.find(p => p.id === depId);
        if (depPhase) {
          const depEndTime = phaseEndTimes.get(depId) || 0;
          if (depEndTime > latestDepTime) {
            latestDepTime = depEndTime;
            nextPhase = depPhase;
          }
        }
      }

      currentPhase = nextPhase;
    }

    return criticalPath;
  }

  private getDefaultOptimizationResult(path: ExecutionPath): TimeOptimizationResult {
    const originalTime = this.calculatePathExecutionTime(path);

    return {
      originalExecutionTime: originalTime,
      optimizedExecutionTime: originalTime,
      timeSavings: 0,
      timeSavingsPercentage: 0,
      optimizations: [],
      optimizedPath: path,
      contingencyPlans: [],
      executionSchedule: {
        phases: [],
        criticalPath: [],
        parallelGroups: [],
        totalTime: originalTime,
        bufferTime: Math.max(30, originalTime * 0.1),
      },
    };
  }

  updateNetworkConditions(chainId: ChainID, conditions: Partial<NetworkCondition>): void {
    const existing = this.networkConditions.get(chainId);
    if (existing) {
      this.networkConditions.set(chainId, {
        ...existing,
        ...conditions,
        lastUpdated: Date.now(),
      });
    }
  }

  getNetworkConditions(chainId: ChainID): NetworkCondition | null {
    return this.networkConditions.get(chainId) || null;
  }

  recordExecutionTime(operationType: string, chainId: ChainID, actualTime: number): void {
    const key = `${operationType}-${chainId}`;
    const history = this.historicalTimes.get(key) || [];
    
    history.push(actualTime);
    
    // Keep only recent 100 records
    if (history.length > 100) {
      history.shift();
    }
    
    this.historicalTimes.set(key, history);
  }

  getAverageExecutionTime(operationType: string, chainId: ChainID): number {
    const key = `${operationType}-${chainId}`;
    const history = this.historicalTimes.get(key);
    
    if (!history || history.length === 0) {
      return this.getBaseBlockTime(chainId) * 5; // Default estimate
    }
    
    return history.reduce((sum, time) => sum + time, 0) / history.length;
  }
}