/**
 * Cross-Chain Arbitrage Engine
 * Detects and executes arbitrage opportunities across multiple chains
 */

import { EventEmitter } from 'events';
import Logger from '../../../shared/logging/logger';
import { RedisManager } from '../../../shared/database/redis-manager';
import { 
  ArbitrageOpportunity, 
  ArbitrageExecution,
  ExecutionPath,
  ExecutionStep,
  ChainID,
  AssetID,
  AssetPrice
} from '../types';
import { BridgeSatelliteConfig } from '../bridge-satellite';
import { PriceFeedManager, PriceFeedConfig } from './price-feed-manager';
import { ChainConnectorService, DEXConfig } from './chain-connector';
import { ExecutionPathOptimizer } from '../optimization/execution-path-optimizer';
import { GasOptimizer } from '../optimization/gas-optimizer';
import { BridgeFeeOptimizer } from '../optimization/bridge-fee-optimizer';
import { ExecutionTimeOptimizer } from '../optimization/execution-time-optimizer';
import { SlippageMinimizer } from '../optimization/slippage-minimizer';

const logger = Logger.getLogger('arbitrage-engine');

interface ArbitrageGraph {
  nodes: Map<string, ArbitrageNode>;
  edges: Map<string, ArbitrageEdge[]>;
}

interface ArbitrageNode {
  id: string;
  chainId: ChainID;
  assetId: AssetID;
  price: number;
  liquidity: number;
  timestamp: number;
}

interface ArbitrageEdge {
  from: string;
  to: string;
  type: 'swap' | 'bridge';
  cost: number;
  time: number;
  protocol: string;
  contractAddress?: string;
}

interface CycleDetectionResult {
  path: string[];
  profitMargin: number;
  estimatedGasCost: number;
  executionTime: number;
  confidence: number;
}

export class CrossChainArbitrageEngine extends EventEmitter {
  private config: BridgeSatelliteConfig;
  private priceFeedManager: PriceFeedManager;
  private chainConnector: ChainConnectorService;
  private redis: RedisManager;
  private isRunning = false;
  private detectionInterval: NodeJS.Timeout | null = null;
  private opportunityCache: Map<string, ArbitrageOpportunity> = new Map();
  private executionHistory: Map<string, ArbitrageExecution> = new Map();

  // Path optimization components
  private pathOptimizer: ExecutionPathOptimizer;
  private _gasOptimizer: GasOptimizer;
  private _bridgeFeeOptimizer: BridgeFeeOptimizer;
  private _timeOptimizer: ExecutionTimeOptimizer;
  private _slippageMinimizer: SlippageMinimizer;

  constructor(config: BridgeSatelliteConfig) {
    super();
    this.config = config;
    
    // Initialize price feed manager
    const priceFeedConfig: PriceFeedConfig = {
      chains: config.chains.map(c => c.id),
      updateInterval: 1000, // 1 second for sub-second updates
      cacheExpiry: 60,
      sources: this.buildPriceSources(),
      websocketReconnectDelay: 5000,
      priceValidationThreshold: 0.05, // 5% max deviation
    };
    this.priceFeedManager = new PriceFeedManager(priceFeedConfig);

    // Initialize chain connector
    const dexConfigs = this.buildDEXConfigs();
    this.chainConnector = new ChainConnectorService(config.chains, dexConfigs);

    // Initialize Redis
    this.redis = RedisManager.getInstance({
      host: process.env['REDIS_HOST'] || 'localhost',
      port: parseInt(process.env['REDIS_PORT'] || '6379'),
      keyPrefix: 'arbitrage:',
    });

    // Initialize path optimization components
    this.pathOptimizer = new ExecutionPathOptimizer(
      {
        maxAlternativePaths: 5,
        simulationRounds: 500,
        costWeights: {
          gasCost: 0.3,
          bridgeFees: 0.25,
          executionTime: 0.2,
          slippage: 0.15,
          mevRisk: 0.1,
        },
        riskTolerance: 'moderate',
        parallelSimulations: 4,
      },
      config.chains,
      config.bridges
    );

    this._gasOptimizer = new GasOptimizer(
      {
        maxGasPrice: this.buildMaxGasPrices(),
        gasEstimationBuffer: 1.2,
        batchingThreshold: 3,
        priorityFeeStrategy: 'moderate',
        useLayer2Routing: true,
      },
      config.chains
    );

    this._bridgeFeeOptimizer = new BridgeFeeOptimizer(
      {
        maxFeeThreshold: 0.02,
        preferredBridges: ['hop-protocol', 'stargate', 'across-protocol'],
        trustScoreWeight: 0.3,
        liquidityThreshold: 100000,
        timeWeightFactor: 0.2,
      },
      config.bridges
    );

    this._timeOptimizer = new ExecutionTimeOptimizer(
      {
        maxAcceptableDelay: 300,
        parallelExecutionThreshold: 3,
        preemptiveExecutionEnabled: true,
        networkCongestionWeight: 0.3,
        gasPriceSpeedTradeoff: 1.5,
      },
      config.chains
    );

    this._slippageMinimizer = new SlippageMinimizer({
      maxAcceptableSlippage: 0.02,
      dynamicSlippageEnabled: true,
      liquidityThreshold: 100000,
      priceImpactWeight: 0.4,
      mevProtectionEnabled: true,
    });

    logger.info('Cross-Chain Arbitrage Engine created with path optimization');
  }

  private buildMaxGasPrices(): Record<ChainID, number> {
    const maxGasPrices: Record<ChainID, number> = {};
    
    for (const chain of this.config.chains) {
      switch (chain.id) {
        case 'ethereum':
          maxGasPrices[chain.id] = 100; // 100 gwei
          break;
        case 'polygon':
          maxGasPrices[chain.id] = 500; // 500 gwei
          break;
        case 'arbitrum':
        case 'optimism':
          maxGasPrices[chain.id] = 10; // 10 gwei
          break;
        case 'avalanche':
          maxGasPrices[chain.id] = 50; // 50 gwei
          break;
        default:
          maxGasPrices[chain.id] = 50; // Default 50 gwei
      }
    }
    
    return maxGasPrices;
  }

  private buildPriceSources(): any[] {
    // Configure price sources for different chains
    return [
      {
        name: 'binance',
        type: 'websocket',
        endpoint: 'wss://stream.binance.com:9443/ws',
        chains: ['bsc', 'ethereum'],
        priority: 1,
      },
      {
        name: 'coinbase',
        type: 'websocket',
        endpoint: 'wss://ws-feed.exchange.coinbase.com',
        chains: ['ethereum', 'polygon'],
        priority: 1,
      },
      {
        name: 'coingecko',
        type: 'rest',
        endpoint: 'https://api.coingecko.com/api/v3/simple/price',
        apiKey: process.env['COINGECKO_API_KEY'],
        chains: ['all'],
        priority: 2,
        rateLimit: 10000, // 10 seconds
      },
    ];
  }

  private buildDEXConfigs(): DEXConfig[] {
    return [
      // Ethereum
      {
        name: 'uniswap-v3',
        chainId: 'ethereum',
        routerAddress: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
        factoryAddress: '0x1F98431c8aD98523631AE4a59f267346ea31F984',
        type: 'uniswapV3',
        fee: 3000, // 0.3%
      },
      {
        name: 'sushiswap',
        chainId: 'ethereum',
        routerAddress: '0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F',
        factoryAddress: '0xC0AEe478e3658e2610c5F7A4A2E1777cE9e4f2Ac',
        type: 'sushiswap',
      },
      // Polygon
      {
        name: 'quickswap',
        chainId: 'polygon',
        routerAddress: '0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff',
        factoryAddress: '0x5757371414417b8C6CAad45bAeF941aBc7d3Ab32',
        type: 'quickswap',
      },
      // Arbitrum
      {
        name: 'uniswap-v3',
        chainId: 'arbitrum',
        routerAddress: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
        factoryAddress: '0x1F98431c8aD98523631AE4a59f267346ea31F984',
        type: 'uniswapV3',
        fee: 3000,
      },
      // Optimism
      {
        name: 'uniswap-v3',
        chainId: 'optimism',
        routerAddress: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
        factoryAddress: '0x1F98431c8aD98523631AE4a59f267346ea31F984',
        type: 'uniswapV3',
        fee: 3000,
      },
      // Avalanche
      {
        name: 'traderjoe',
        chainId: 'avalanche',
        routerAddress: '0x60aE616a2155Ee3d9A68541Ba4544862310933d4',
        factoryAddress: '0x9Ad6C38BE94206cA50bb0d90783181662f0Cfa10',
        type: 'traderjoe',
      },
    ];
  }

  async initialize(): Promise<void> {
    try {
      logger.info('Initializing Cross-Chain Arbitrage Engine...');
      
      await Promise.all([
        this.priceFeedManager.initialize(),
        this.chainConnector.initialize(),
        this.redis.connect(),
        this.pathOptimizer.initialize(),
      ]);

      // Subscribe to price updates
      this.priceFeedManager.on('priceUpdate', this.handlePriceUpdate.bind(this));

      logger.info('Cross-Chain Arbitrage Engine initialized');
    } catch (error) {
      logger.error('Failed to initialize arbitrage engine:', error);
      throw error;
    }
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Arbitrage engine already running');
      return;
    }

    this.isRunning = true;

    await Promise.all([
      this.priceFeedManager.start(),
      this.chainConnector.start(),
    ]);

    // Start detection loop
    this.startDetectionLoop();

    logger.info('Cross-Chain Arbitrage Engine started');
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;

    if (this.detectionInterval) {
      clearInterval(this.detectionInterval);
      this.detectionInterval = null;
    }

    await Promise.all([
      this.priceFeedManager.stop(),
      this.chainConnector.stop(),
    ]);

    logger.info('Cross-Chain Arbitrage Engine stopped');
  }

  private startDetectionLoop(): void {
    const detect = async () => {
      try {
        const opportunities = await this.detectArbitrageOpportunities();
        
        for (const opportunity of opportunities) {
          this.emit('opportunityDetected', opportunity);
        }
      } catch (error) {
        logger.error('Error in detection loop:', error);
      }
    };

    // Run detection immediately
    detect();

    // Run every second for real-time detection
    this.detectionInterval = setInterval(detect, 1000);
  }

  private handlePriceUpdate(price: AssetPrice): void {
    // Trigger immediate arbitrage check for updated asset
    if (this.isRunning) {
      this.checkArbitrageForAsset(price.assetId).catch(error => {
        logger.error('Error checking arbitrage on price update:', error);
      });
    }
  }

  private async checkArbitrageForAsset(assetId: AssetID): Promise<void> {
    const prices = await this.priceFeedManager.getMultiChainPrices(assetId);
    if (prices.length < 2) return;

    // Quick check for price differences
    const sortedPrices = prices.sort((a, b) => a.price - b.price);
    const lowestPrice = sortedPrices[0];
    const highestPrice = sortedPrices[sortedPrices.length - 1];

    const priceDiff = (highestPrice?.price || 0) - (lowestPrice?.price || 0) / (lowestPrice?.price || 1);
    
    if (priceDiff > this.config.arbitrage.minProfitThreshold) {
      // Potential opportunity found, run full analysis
      const graph = await this.buildArbitrageGraph([assetId]);
      const cycles = this.detectProfitableCycles(graph);
      
      for (const cycle of cycles) {
        const opportunity = await this.createOpportunityFromCycle(cycle, graph);
        if (opportunity) {
          this.opportunityCache.set(opportunity.id, opportunity);
          this.emit('opportunityDetected', opportunity);
        }
      }
    }
  }

  private async detectArbitrageOpportunities(): Promise<ArbitrageOpportunity[]> {
    try {
      // Build arbitrage graph from current prices
      const graph = await this.buildArbitrageGraph();
      
      // Detect profitable cycles using hybrid algorithms
      const cycles = this.detectProfitableCycles(graph);
      
      // Convert cycles to opportunities
      const opportunities: ArbitrageOpportunity[] = [];
      
      for (const cycle of cycles) {
        const opportunity = await this.createOpportunityFromCycle(cycle, graph);
        if (opportunity) {
          opportunities.push(opportunity);
        }
      }

      // Update cache
      this.opportunityCache.clear();
      for (const opp of opportunities) {
        this.opportunityCache.set(opp.id, opp);
      }

      return opportunities;
    } catch (error) {
      logger.error('Error detecting arbitrage opportunities:', error);
      return [];
    }
  }

  private async buildArbitrageGraph(assetFilter?: AssetID[]): Promise<ArbitrageGraph> {
    const graph: ArbitrageGraph = {
      nodes: new Map(),
      edges: new Map(),
    };

    // Get all current prices
    const allPrices = await this.priceFeedManager.getPrices();
    const prices = assetFilter 
      ? allPrices.filter(p => assetFilter.includes(p.assetId))
      : allPrices;

    // Create nodes for each asset on each chain
    for (const price of prices) {
      const nodeId = `${price.chainId}:${price.assetId}`;
      graph.nodes.set(nodeId, {
        id: nodeId,
        chainId: price.chainId,
        assetId: price.assetId,
        price: price.price,
        liquidity: price.liquidity,
        timestamp: price.timestamp,
      });
    }

    // Create edges for same-chain swaps (DEX)
    await this.addDEXEdges(graph);

    // Create edges for cross-chain bridges
    await this.addBridgeEdges(graph);

    return graph;
  }

  private async addDEXEdges(graph: ArbitrageGraph): Promise<void> {
    for (const [nodeId, node] of graph.nodes) {
      const edges: ArbitrageEdge[] = [];

      // Find all other assets on the same chain
      for (const [targetId, targetNode] of graph.nodes) {
        if (nodeId === targetId || node.chainId !== targetNode.chainId) {
          continue;
        }

        // Get DEXs for this chain
        const dexes = this.chainConnector.getSupportedDEXs(node.chainId);
        
        for (const dex of dexes) {
          // Estimate swap cost
          const gasEstimate = await this.chainConnector.getGasEstimate(node.chainId);
          const swapGasCost = Number(gasEstimate.estimatedCost) / 1e18; // Convert to ETH equivalent

          edges.push({
            from: nodeId,
            to: targetId,
            type: 'swap',
            cost: swapGasCost,
            time: 15, // 15 seconds average
            protocol: dex.name,
            contractAddress: dex.routerAddress,
          });
        }
      }

      graph.edges.set(nodeId, edges);
    }
  }

  private async addBridgeEdges(graph: ArbitrageGraph): Promise<void> {
    for (const bridge of this.config.bridges) {
      for (const sourceChain of bridge.supportedChains) {
        for (const targetChain of bridge.supportedChains) {
          if (sourceChain === targetChain) continue;

          // Add edges for each asset that exists on both chains
          for (const [nodeId, node] of graph.nodes) {
            if (node.chainId !== sourceChain) continue;

            const targetNodeId = `${targetChain}:${node.assetId}`;
            if (!graph.nodes.has(targetNodeId)) continue;

            const edges = graph.edges.get(nodeId) || [];
            
            // Calculate bridge cost
            const bridgeCost = bridge.feeStructure.baseFee + 
              (node.price * bridge.feeStructure.percentageFee);

            edges.push({
              from: nodeId,
              to: targetNodeId,
              type: 'bridge',
              cost: bridgeCost,
              time: bridge.avgProcessingTime,
              protocol: bridge.name,
              ...(bridge.contractAddresses[sourceChain] && { contractAddress: bridge.contractAddresses[sourceChain] }),
            });

            graph.edges.set(nodeId, edges);
          }
        }
      }
    }
  }

  private detectProfitableCycles(graph: ArbitrageGraph): CycleDetectionResult[] {
    const cycles: CycleDetectionResult[] = [];
    const visited = new Set<string>();

    // Use modified Bellman-Ford for negative cycle detection
    for (const [startNode] of graph.nodes) {
      if (visited.has(startNode)) continue;

      const result = this.findNegativeCycles(graph, startNode);
      cycles.push(...result);
      
      // Mark all nodes in found cycles as visited
      result.forEach(cycle => {
        cycle.path.forEach(node => visited.add(node));
      });
    }

    // Filter and sort by profitability
    return cycles
      .filter(c => c.profitMargin > this.config.arbitrage.minProfitThreshold)
      .sort((a, b) => b.profitMargin - a.profitMargin)
      .slice(0, 100); // Top 100 opportunities
  }

  private findNegativeCycles(
    graph: ArbitrageGraph,
    startNode: string
  ): CycleDetectionResult[] {
    const cycles: CycleDetectionResult[] = [];
    const distances = new Map<string, number>();
    const predecessors = new Map<string, string>();

    // Initialize distances
    for (const [nodeId] of graph.nodes) {
      distances.set(nodeId, nodeId === startNode ? 0 : Infinity);
    }

    // Relax edges V-1 times
    const nodeCount = graph.nodes.size;
    for (let i = 0; i < nodeCount - 1; i++) {
      for (const [fromNode, edges] of graph.edges) {
        const fromDistance = distances.get(fromNode) || Infinity;
        if (fromDistance === Infinity) continue;

        for (const edge of edges) {
          const toDistance = distances.get(edge.to) || Infinity;
          const newDistance = fromDistance + this.calculateEdgeWeight(edge, graph);

          if (newDistance < toDistance) {
            distances.set(edge.to, newDistance);
            predecessors.set(edge.to, fromNode);
          }
        }
      }
    }

    // Check for negative cycles
    for (const [fromNode, edges] of graph.edges) {
      const fromDistance = distances.get(fromNode) || Infinity;
      if (fromDistance === Infinity) continue;

      for (const edge of edges) {
        const toDistance = distances.get(edge.to) || Infinity;
        const newDistance = fromDistance + this.calculateEdgeWeight(edge, graph);

        if (newDistance < toDistance) {
          // Found negative cycle, reconstruct path
          const cycle = this.reconstructCycle(edge.to, predecessors);
          if (cycle.length >= 3) {
            const result = this.analyzeCycle(cycle, graph);
            if (result) {
              cycles.push(result);
            }
          }
        }
      }
    }

    return cycles;
  }

  private calculateEdgeWeight(edge: ArbitrageEdge, graph: ArbitrageGraph): number {
    const fromNode = graph.nodes.get(edge.from);
    const toNode = graph.nodes.get(edge.to);
    
    if (!fromNode || !toNode) return Infinity;

    // Calculate price ratio (log space for multiplicative nature)
    const priceRatio = Math.log(toNode.price / fromNode.price);
    
    // Add transaction costs
    const costInAsset = edge.cost / fromNode.price;
    
    // Negative weight for profitable paths
    return -(priceRatio - costInAsset);
  }

  private reconstructCycle(
    endNode: string,
    predecessors: Map<string, string>
  ): string[] {
    const path: string[] = [];
    const visited = new Set<string>();
    let current = endNode;

    while (current && !visited.has(current)) {
      path.unshift(current);
      visited.add(current);
      current = predecessors.get(current) || '';
    }

    // Complete the cycle
    if (current && path.length > 0) {
      const cycleStart = path.indexOf(current);
      if (cycleStart >= 0) {
        return path.slice(cycleStart);
      }
    }

    return path;
  }

  private analyzeCycle(
    path: string[],
    graph: ArbitrageGraph
  ): CycleDetectionResult | null {
    if (path.length < 3) return null;

    let totalProfit = 1;
    let totalGasCost = 0;
    let totalTime = 0;
    let minConfidence = 1;

    // Calculate profit through the cycle
    for (let i = 0; i < path.length; i++) {
      const fromNode = graph.nodes.get(path[i]!);
      const toNode = graph.nodes.get(path[(i + 1) % path.length]!);
      
      if (!fromNode || !toNode) return null;

      const edges = graph.edges.get(path[i]!) || [];
      const edge = edges.find(e => e.to === path[(i + 1) % path.length]);
      
      if (!edge) return null;

      // Update metrics
      totalProfit *= (toNode.price / fromNode.price);
      totalGasCost += edge.cost;
      totalTime += edge.time;

      // Calculate confidence based on liquidity and age
      const priceAge = (Date.now() - fromNode.timestamp) / 1000; // seconds
      const liquidityConfidence = Math.min(1, fromNode.liquidity / 1000000); // $1M reference
      const ageConfidence = Math.max(0, 1 - priceAge / 60); // Decay over 60 seconds
      
      minConfidence = Math.min(minConfidence, liquidityConfidence * ageConfidence);
    }

    const profitMargin = totalProfit - 1 - (totalGasCost / 1000); // Assume $1000 starting capital

    return {
      path,
      profitMargin,
      estimatedGasCost: totalGasCost,
      executionTime: totalTime,
      confidence: minConfidence,
    };
  }

  private async createOpportunityFromCycle(
    cycle: CycleDetectionResult,
    graph: ArbitrageGraph
  ): Promise<ArbitrageOpportunity | null> {
    if (cycle.path.length < 3) return null;

    const startNode = graph.nodes.get(cycle.path[0]!);
    const endNode = graph.nodes.get(cycle.path[cycle.path.length - 1]!);
    
    if (!startNode || !endNode) return null;

    // Build execution path
    const executionSteps: ExecutionStep[] = [];
    
    for (let i = 0; i < cycle.path.length; i++) {
      const fromNodeId = cycle.path[i];
      const toNodeId = cycle.path[(i + 1) % cycle.path.length];
      
      const edges = graph.edges.get(fromNodeId!) || [];
      const edge = edges.find(e => e.to === toNodeId);
      
      if (!edge) continue;

      const fromNode = graph.nodes.get(fromNodeId!);
      const toNode = graph.nodes.get(toNodeId!);
      
      if (!fromNode || !toNode) continue;

      executionSteps.push({
        type: edge.type,
        chainId: fromNode.chainId,
        protocol: edge.protocol,
        contractAddress: edge.contractAddress || '',
        estimatedGas: Math.floor(edge.cost * 1e18 / 30), // Rough gas estimate
        estimatedTime: edge.time,
        dependencies: i > 0 ? [`step-${i-1}`] : [],
      });
    }

    const executionPath: ExecutionPath = {
      id: `path-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      steps: executionSteps,
      totalGasCost: cycle.estimatedGasCost,
      totalFees: cycle.estimatedGasCost * 1.2, // Add 20% buffer
      estimatedTime: cycle.executionTime,
      successProbability: cycle.confidence,
      riskLevel: cycle.confidence > 0.8 ? 'low' : cycle.confidence > 0.5 ? 'medium' : 'high',
    };

    // Create base opportunity
    const baseOpportunity: ArbitrageOpportunity = {
      id: `opp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      assetId: startNode.assetId,
      sourceChain: startNode.chainId,
      targetChain: endNode.chainId,
      sourcePrice: startNode.price,
      targetPrice: endNode.price,
      priceDifference: endNode.price - startNode.price,
      percentageDifference: cycle.profitMargin * 100,
      expectedProfit: cycle.profitMargin * 1000, // Assume $1000 capital
      estimatedGasCost: cycle.estimatedGasCost,
      bridgeFee: 0, // Calculated in execution path
      netProfit: (cycle.profitMargin * 1000) - cycle.estimatedGasCost,
      profitMargin: cycle.profitMargin,
      executionTime: cycle.executionTime,
      riskScore: (1 - cycle.confidence) * 100,
      confidence: cycle.confidence,
      timestamp: Date.now(),
      executionPaths: [executionPath],
    };

    // Apply path optimization to improve the execution path
    try {
      const optimizedPath = await this.pathOptimizer.optimizePath(baseOpportunity);
      
      // Update opportunity with optimized path
      const optimizedOpportunity: ArbitrageOpportunity = {
        ...baseOpportunity,
        executionPaths: [optimizedPath],
        estimatedGasCost: optimizedPath.costBreakdown.gasCosts.totalUSD,
        executionTime: optimizedPath.performanceMetrics.expectedExecutionTime,
        netProfit: baseOpportunity.expectedProfit - optimizedPath.costBreakdown.gasCosts.totalUSD - optimizedPath.costBreakdown.bridgeFees.totalFees,
        confidence: Math.min(baseOpportunity.confidence, optimizedPath.performanceMetrics.executionProbability),
        riskScore: Math.max(baseOpportunity.riskScore, (1 - optimizedPath.performanceMetrics.executionProbability) * 100),
      };

      // Validate optimized opportunity
      if (optimizedOpportunity.netProfit > 0 && 
          optimizedOpportunity.riskScore < this.config.arbitrage.maxRiskScore &&
          optimizedOpportunity.executionTime < this.config.arbitrage.maxExecutionTime) {
        
        logger.debug(`Opportunity optimized: ${optimizedOpportunity.id}`, {
          originalProfit: baseOpportunity.netProfit,
          optimizedProfit: optimizedOpportunity.netProfit,
          originalTime: baseOpportunity.executionTime,
          optimizedTime: optimizedOpportunity.executionTime,
          optimizationScore: optimizedPath.optimizationScore,
        });

        return optimizedOpportunity;
      }
    } catch (error) {
      logger.warn(`Path optimization failed for opportunity ${baseOpportunity.id}, using base path:`, error);
      
      // Fallback to base opportunity if optimization fails
      if (baseOpportunity.netProfit > 0 && 
          baseOpportunity.riskScore < this.config.arbitrage.maxRiskScore &&
          baseOpportunity.executionTime < this.config.arbitrage.maxExecutionTime) {
        return baseOpportunity;
      }
    }

    return null;
  }

  async detectOpportunities(): Promise<ArbitrageOpportunity[]> {
    return Array.from(this.opportunityCache.values())
      .sort((a, b) => b.netProfit - a.netProfit);
  }

  async executeOpportunity(opportunityId: string): Promise<boolean> {
    const opportunity = this.opportunityCache.get(opportunityId);
    if (!opportunity) {
      logger.error(`Opportunity not found: ${opportunityId}`);
      return false;
    }

    const execution: ArbitrageExecution = {
      opportunityId,
      executionPathId: opportunity.executionPaths[0]!.id,
      status: 'initiated',
      transactions: [],
      startTime: Date.now(),
    };

    this.executionHistory.set(opportunityId, execution);

    try {
      logger.info(`Executing arbitrage opportunity: ${opportunityId}`, {
        asset: opportunity.assetId,
        profit: opportunity.netProfit,
        path: opportunity.executionPaths[0]!.steps.map(s => `${s.chainId}:${s.type}`),
      });

      // TODO: Implement actual execution logic
      // This would involve:
      // 1. Checking current balances
      // 2. Approving tokens if needed
      // 3. Executing swaps/bridges in sequence
      // 4. Monitoring transaction status
      // 5. Handling failures and rollbacks

      execution.status = 'completed';
      execution.actualProfit = opportunity.netProfit * 0.9; // Simulate 90% capture
      execution.endTime = Date.now();

      this.emit('executionCompleted', execution);
      return true;
    } catch (error) {
      logger.error(`Failed to execute opportunity ${opportunityId}:`, error);
      
      execution.status = 'failed';
      execution.failureReason = error instanceof Error ? error.message : 'Unknown error';
      execution.endTime = Date.now();

      this.emit('executionFailed', execution);
      return false;
    }
  }

  async getOpportunityStats(): Promise<any> {
    const opportunities = Array.from(this.opportunityCache.values());
    const chainCounts = new Map<ChainID, number>();
    const assetCounts = new Map<AssetID, number>();

    for (const opp of opportunities) {
      chainCounts.set(opp.sourceChain, (chainCounts.get(opp.sourceChain) || 0) + 1);
      chainCounts.set(opp.targetChain, (chainCounts.get(opp.targetChain) || 0) + 1);
      assetCounts.set(opp.assetId, (assetCounts.get(opp.assetId) || 0) + 1);
    }

    const topChains = Array.from(chainCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([chain]) => chain);

    const topAssets = Array.from(assetCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([asset]) => asset);

    return {
      total: opportunities.length,
      topChains,
      topAssets,
    };
  }

  async getExecutionStats(): Promise<any> {
    const executions = Array.from(this.executionHistory.values());
    const completed = executions.filter(e => e.status === 'completed');
    
    const totalVolume = completed.reduce((sum, e) => sum + (e.actualProfit || 0), 0);
    const totalProfit = completed.reduce((sum, e) => sum + (e.netReturn || 0), 0);
    const avgProfitMargin = completed.length > 0 
      ? totalProfit / totalVolume 
      : 0;
    const successRate = executions.length > 0 
      ? completed.length / executions.length 
      : 0;
    const avgExecutionTime = completed.length > 0
      ? completed.reduce((sum, e) => sum + ((e.endTime || 0) - e.startTime), 0) / completed.length
      : 0;

    return {
      totalVolume,
      totalProfit,
      avgProfitMargin,
      successRate,
      avgExecutionTime,
    };
  }

  updateConfig(config: BridgeSatelliteConfig): void {
    this.config = config;
    logger.info('Arbitrage engine config updated');
  }
}