import { ethers, BigNumber } from 'ethers';

export interface BridgeInfo {
  id: string;
  name: string;
  sourceChain: ChainInfo;
  targetChain: ChainInfo;
  supportedTokens: string[];
  minAmount: BigNumber;
  maxAmount: BigNumber;
  baseFee: BigNumber;
  feePercentage: number;
  averageTime: number; // in seconds
  securityScore: number; // 0-100
  liquidityScore: number; // 0-100
  reliabilityScore: number; // 0-100
  contractAddress: string;
  apiEndpoint?: string;
}

export interface ChainInfo {
  chainId: number;
  name: string;
  rpcUrl: string;
  nativeCurrency: string;
  blockTime: number;
}

export interface BridgeRoute {
  bridges: BridgeInfo[];
  totalFee: BigNumber;
  totalTime: number;
  securityScore: number;
  hops: number;
  path: string[];
  riskAssessment: RiskAssessment;
}

export interface RiskAssessment {
  overallRisk: 'low' | 'medium' | 'high' | 'critical';
  riskFactors: {
    liquidityRisk: number;
    securityRisk: number;
    timeRisk: number;
    slippageRisk: number;
    counterpartyRisk: number;
  };
  mitigationStrategies: string[];
}

export interface BridgeTransaction {
  route: BridgeRoute;
  tokenAddress: string;
  amount: BigNumber;
  recipient: string;
  deadline: number;
  slippageTolerance: number;
  transactions: TransactionStep[];
}

export interface TransactionStep {
  chainId: number;
  to: string;
  data: string;
  value: BigNumber;
  gasLimit: BigNumber;
  gasPrice: BigNumber;
  description: string;
}

export interface BridgeOptimizationConfig {
  prioritizeSpeed: boolean;
  prioritizeCost: boolean;
  prioritizeSecurity: boolean;
  maxHops: number;
  maxTotalTime: number; // seconds
  maxSlippage: number; // percentage
  excludedBridges: string[];
  requiredSecurityScore: number;
}

export class BridgeOptimizer {
  private bridges: Map<string, BridgeInfo> = new Map();
  private chains: Map<number, ChainInfo> = new Map();
  private liquidityCache: Map<string, BigNumber> = new Map();
  private config: BridgeOptimizationConfig;

  constructor(config: Partial<BridgeOptimizationConfig> = {}) {
    this.config = {
      prioritizeSpeed: false,
      prioritizeCost: true,
      prioritizeSecurity: true,
      maxHops: 3,
      maxTotalTime: 3600, // 1 hour
      maxSlippage: 2.0, // 2%
      excludedBridges: [],
      requiredSecurityScore: 70,
      ...config
    };

    this.initializeKnownBridges();
    this.initializeChains();
    this.startLiquidityMonitoring();
  }

  /**
   * Find optimal bridge route between chains
   */
  async findOptimalRoute(
    sourceChainId: number,
    targetChainId: number,
    tokenAddress: string,
    amount: BigNumber
  ): Promise<BridgeRoute[]> {
    const routes = await this.findAllRoutes(sourceChainId, targetChainId, tokenAddress, amount);
    
    if (routes.length === 0) {
      throw new Error(`No bridge routes found from chain ${sourceChainId} to ${targetChainId}`);
    }

    // Score and sort routes
    const scoredRoutes = routes.map(route => ({
      route,
      score: this.calculateRouteScore(route)
    }));

    scoredRoutes.sort((a, b) => b.score - a.score);

    return scoredRoutes.map(sr => sr.route);
  }

  /**
   * Execute cross-chain bridge transaction
   */
  async executeBridgeTransaction(
    bridgeTransaction: BridgeTransaction,
    signers: Map<number, ethers.Signer>
  ): Promise<{
    success: boolean;
    transactions: string[];
    error?: string;
  }> {
    const executedTxs: string[] = [];

    try {
      for (const step of bridgeTransaction.transactions) {
        const signer = signers.get(step.chainId);
        if (!signer) {
          throw new Error(`No signer available for chain ${step.chainId}`);
        }

        const tx = await signer.sendTransaction({
          to: step.to,
          data: step.data,
          value: step.value,
          gasLimit: step.gasLimit,
          gasPrice: step.gasPrice
        });

        executedTxs.push(tx.hash);
        await tx.wait();

        // Wait for confirmation if not the last step
        if (step !== bridgeTransaction.transactions[bridgeTransaction.transactions.length - 1]) {
          await this.waitForBridgeConfirmation(step, tx.hash);
        }
      }

      return {
        success: true,
        transactions: executedTxs
      };
    } catch (error) {
      return {
        success: false,
        transactions: executedTxs,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Monitor bridge health and update scores
   */
  async updateBridgeHealth(): Promise<void> {
    for (const bridge of this.bridges.values()) {
      try {
        const healthMetrics = await this.checkBridgeHealth(bridge);
        
        // Update scores based on health metrics
        bridge.securityScore = healthMetrics.securityScore;
        bridge.liquidityScore = healthMetrics.liquidityScore;
        bridge.reliabilityScore = healthMetrics.reliabilityScore;
        
        this.bridges.set(bridge.id, bridge);
      } catch (error) {
        console.error(`Failed to update health for bridge ${bridge.id}:`, error);
      }
    }
  }

  /**
   * Get current bridge liquidity
   */
  async getBridgeLiquidity(bridgeId: string, tokenAddress: string): Promise<BigNumber> {
    const cacheKey = `${bridgeId}-${tokenAddress}`;
    const cached = this.liquidityCache.get(cacheKey);
    
    if (cached && Date.now() - parseInt(cacheKey.split('-')[2] || '0') < 60000) {
      return cached;
    }

    const bridge = this.bridges.get(bridgeId);
    if (!bridge) {
      throw new Error(`Bridge ${bridgeId} not found`);
    }

    const liquidity = await this.fetchBridgeLiquidity(bridge, tokenAddress);
    this.liquidityCache.set(`${cacheKey}-${Date.now()}`, liquidity);

    return liquidity;
  }

  /**
   * Assess bridge security
   */
  async assessBridgeSecurity(bridgeId: string): Promise<RiskAssessment> {
    const bridge = this.bridges.get(bridgeId);
    if (!bridge) {
      throw new Error(`Bridge ${bridgeId} not found`);
    }

    const liquidityRisk = this.calculateLiquidityRisk(bridge);
    const securityRisk = this.calculateSecurityRisk(bridge);
    const timeRisk = this.calculateTimeRisk(bridge);
    const slippageRisk = this.calculateSlippageRisk(bridge);
    const counterpartyRisk = this.calculateCounterpartyRisk(bridge);

    const averageRisk = (liquidityRisk + securityRisk + timeRisk + slippageRisk + counterpartyRisk) / 5;

    let overallRisk: RiskAssessment['overallRisk'] = 'low';
    if (averageRisk > 0.8) overallRisk = 'critical';
    else if (averageRisk > 0.6) overallRisk = 'high';
    else if (averageRisk > 0.4) overallRisk = 'medium';

    const mitigationStrategies = this.generateMitigationStrategies(averageRisk, {
      liquidityRisk,
      securityRisk,
      timeRisk,
      slippageRisk,
      counterpartyRisk
    });

    return {
      overallRisk,
      riskFactors: {
        liquidityRisk,
        securityRisk,
        timeRisk,
        slippageRisk,
        counterpartyRisk
      },
      mitigationStrategies
    };
  }

  /**
   * Find all possible routes between chains
   */
  private async findAllRoutes(
    sourceChainId: number,
    targetChainId: number,
    tokenAddress: string,
    amount: BigNumber
  ): Promise<BridgeRoute[]> {
    const routes: BridgeRoute[] = [];

    // Direct routes (single bridge)
    const directBridges = this.findDirectBridges(sourceChainId, targetChainId, tokenAddress);
    for (const bridge of directBridges) {
      if (await this.canBridgeAmount(bridge, amount)) {
        const route = await this.createSingleBridgeRoute(bridge, amount);
        routes.push(route);
      }
    }

    // Multi-hop routes (if direct routes are insufficient)
    if (routes.length === 0 || this.config.maxHops > 1) {
      const multiHopRoutes = await this.findMultiHopRoutes(
        sourceChainId,
        targetChainId,
        tokenAddress,
        amount
      );
      routes.push(...multiHopRoutes);
    }

    return routes.filter(route => this.isRouteViable(route));
  }

  private findDirectBridges(
    sourceChainId: number,
    targetChainId: number,
    tokenAddress: string
  ): BridgeInfo[] {
    return Array.from(this.bridges.values()).filter(bridge =>
      bridge.sourceChain.chainId === sourceChainId &&
      bridge.targetChain.chainId === targetChainId &&
      bridge.supportedTokens.includes(tokenAddress) &&
      !this.config.excludedBridges.includes(bridge.id) &&
      bridge.securityScore >= this.config.requiredSecurityScore
    );
  }

  private async findMultiHopRoutes(
    sourceChainId: number,
    targetChainId: number,
    tokenAddress: string,
    amount: BigNumber
  ): Promise<BridgeRoute[]> {
    const routes: BridgeRoute[] = [];
    const visited = new Set<number>();
    const currentPath: BridgeInfo[] = [];

    await this.dfsRouteSearch(
      sourceChainId,
      targetChainId,
      tokenAddress,
      amount,
      visited,
      currentPath,
      routes,
      0
    );

    return routes;
  }

  private async dfsRouteSearch(
    currentChainId: number,
    targetChainId: number,
    tokenAddress: string,
    amount: BigNumber,
    visited: Set<number>,
    currentPath: BridgeInfo[],
    routes: BridgeRoute[],
    depth: number
  ): Promise<void> {
    if (depth >= this.config.maxHops) return;
    if (visited.has(currentChainId)) return;

    visited.add(currentChainId);

    // Find bridges from current chain
    const availableBridges = Array.from(this.bridges.values()).filter(bridge =>
      bridge.sourceChain.chainId === currentChainId &&
      bridge.supportedTokens.includes(tokenAddress) &&
      !this.config.excludedBridges.includes(bridge.id) &&
      bridge.securityScore >= this.config.requiredSecurityScore
    );

    for (const bridge of availableBridges) {
      const newPath = [...currentPath, bridge];
      
      if (bridge.targetChain.chainId === targetChainId) {
        // Found complete route
        const route = await this.createMultiBridgeRoute(newPath, amount);
        if (this.isRouteViable(route)) {
          routes.push(route);
        }
      } else {
        // Continue searching
        await this.dfsRouteSearch(
          bridge.targetChain.chainId,
          targetChainId,
          tokenAddress,
          amount,
          visited,
          newPath,
          routes,
          depth + 1
        );
      }
    }

    visited.delete(currentChainId);
  }

  private async createSingleBridgeRoute(bridge: BridgeInfo, amount: BigNumber): Promise<BridgeRoute> {
    const totalFee = bridge.baseFee.add(amount.mul(bridge.feePercentage).div(10000));
    const riskAssessment = await this.assessBridgeSecurity(bridge.id);

    return {
      bridges: [bridge],
      totalFee,
      totalTime: bridge.averageTime,
      securityScore: bridge.securityScore,
      hops: 1,
      path: [bridge.sourceChain.name, bridge.targetChain.name],
      riskAssessment
    };
  }

  private async createMultiBridgeRoute(bridges: BridgeInfo[], amount: BigNumber): Promise<BridgeRoute> {
    let totalFee = BigNumber.from(0);
    let totalTime = 0;
    let minSecurityScore = 100;
    const path = [bridges[0].sourceChain.name];

    for (const bridge of bridges) {
      totalFee = totalFee.add(bridge.baseFee).add(amount.mul(bridge.feePercentage).div(10000));
      totalTime += bridge.averageTime;
      minSecurityScore = Math.min(minSecurityScore, bridge.securityScore);
      path.push(bridge.targetChain.name);
    }

    // Multi-hop routes have additional risk
    const baseRisk = await this.assessBridgeSecurity(bridges[0].id);
    const adjustedRisk: RiskAssessment = {
      ...baseRisk,
      riskFactors: {
        ...baseRisk.riskFactors,
        counterpartyRisk: Math.min(baseRisk.riskFactors.counterpartyRisk * bridges.length, 1),
        timeRisk: Math.min(baseRisk.riskFactors.timeRisk * 1.5, 1)
      }
    };

    return {
      bridges,
      totalFee,
      totalTime,
      securityScore: minSecurityScore,
      hops: bridges.length,
      path,
      riskAssessment: adjustedRisk
    };
  }

  private calculateRouteScore(route: BridgeRoute): number {
    let score = 0;
    const weights = {
      cost: this.config.prioritizeCost ? 0.4 : 0.2,
      speed: this.config.prioritizeSpeed ? 0.4 : 0.2,
      security: this.config.prioritizeSecurity ? 0.4 : 0.3,
      hops: 0.1
    };

    // Cost score (lower is better)
    const avgFee = parseFloat(ethers.utils.formatEther(route.totalFee));
    const costScore = Math.max(0, 1 - (avgFee / 100)); // Normalize to 0-1
    score += costScore * weights.cost;

    // Speed score (lower time is better)
    const speedScore = Math.max(0, 1 - (route.totalTime / this.config.maxTotalTime));
    score += speedScore * weights.speed;

    // Security score
    const securityScore = route.securityScore / 100;
    score += securityScore * weights.security;

    // Hop penalty (fewer hops is better)
    const hopScore = Math.max(0, 1 - ((route.hops - 1) / this.config.maxHops));
    score += hopScore * weights.hops;

    return score;
  }

  private isRouteViable(route: BridgeRoute): boolean {
    return (
      route.totalTime <= this.config.maxTotalTime &&
      route.hops <= this.config.maxHops &&
      route.securityScore >= this.config.requiredSecurityScore &&
      route.riskAssessment.overallRisk !== 'critical'
    );
  }

  private async canBridgeAmount(bridge: BridgeInfo, amount: BigNumber): Promise<boolean> {
    return amount.gte(bridge.minAmount) && amount.lte(bridge.maxAmount);
  }

  private async checkBridgeHealth(bridge: BridgeInfo): Promise<{
    securityScore: number;
    liquidityScore: number;
    reliabilityScore: number;
  }> {
    // This would perform actual health checks
    // For demo, return randomized scores
    return {
      securityScore: Math.floor(Math.random() * 30) + 70, // 70-100
      liquidityScore: Math.floor(Math.random() * 40) + 60, // 60-100
      reliabilityScore: Math.floor(Math.random() * 20) + 80, // 80-100
    };
  }

  private async fetchBridgeLiquidity(bridge: BridgeInfo, tokenAddress: string): Promise<BigNumber> {
    // This would fetch actual liquidity from bridge contracts/APIs
    // For demo, return mock liquidity
    return ethers.utils.parseEther((Math.random() * 10000 + 1000).toString());
  }

  private calculateLiquidityRisk(bridge: BridgeInfo): number {
    return Math.max(0, 1 - (bridge.liquidityScore / 100));
  }

  private calculateSecurityRisk(bridge: BridgeInfo): number {
    return Math.max(0, 1 - (bridge.securityScore / 100));
  }

  private calculateTimeRisk(bridge: BridgeInfo): number {
    // Longer bridge times increase risk
    const maxAcceptableTime = 3600; // 1 hour
    return Math.min(bridge.averageTime / maxAcceptableTime, 1);
  }

  private calculateSlippageRisk(bridge: BridgeInfo): number {
    // Higher fees indicate higher slippage risk
    return Math.min(bridge.feePercentage / 500, 1); // Normalize to max 5%
  }

  private calculateCounterpartyRisk(bridge: BridgeInfo): number {
    return Math.max(0, 1 - (bridge.reliabilityScore / 100));
  }

  private generateMitigationStrategies(
    overallRisk: number,
    riskFactors: RiskAssessment['riskFactors']
  ): string[] {
    const strategies: string[] = [];

    if (riskFactors.liquidityRisk > 0.6) {
      strategies.push('Consider splitting transaction into smaller amounts');
      strategies.push('Monitor bridge liquidity before execution');
    }

    if (riskFactors.securityRisk > 0.5) {
      strategies.push('Use only well-audited bridges');
      strategies.push('Consider additional transaction verification');
    }

    if (riskFactors.timeRisk > 0.7) {
      strategies.push('Set longer deadline for transaction');
      strategies.push('Monitor bridge congestion levels');
    }

    if (riskFactors.slippageRisk > 0.4) {
      strategies.push('Increase slippage tolerance');
      strategies.push('Consider alternative routing with lower fees');
    }

    if (riskFactors.counterpartyRisk > 0.6) {
      strategies.push('Use bridges with better reliability track record');
      strategies.push('Consider insurance or hedging options');
    }

    return strategies;
  }

  private async waitForBridgeConfirmation(step: TransactionStep, txHash: string): Promise<void> {
    // Wait for bridge confirmation
    // This would implement actual bridge confirmation logic
    await new Promise(resolve => setTimeout(resolve, 30000)); // 30 second delay for demo
  }

  private initializeKnownBridges(): void {
    const knownBridges: BridgeInfo[] = [
      {
        id: 'stargate-eth-polygon',
        name: 'Stargate',
        sourceChain: {
          chainId: 1,
          name: 'Ethereum',
          rpcUrl: 'https://eth-mainnet.alchemyapi.io/v2/api-key',
          nativeCurrency: 'ETH',
          blockTime: 12
        },
        targetChain: {
          chainId: 137,
          name: 'Polygon',
          rpcUrl: 'https://polygon-rpc.com',
          nativeCurrency: 'MATIC',
          blockTime: 2
        },
        supportedTokens: [
          '0xA0b86a33E6411085e6A2f9c1b7c4E6B7E3b9D3e6', // WETH
          '0xdAC17F958D2ee523a2206206994597C13D831ec7'  // USDT
        ],
        minAmount: ethers.utils.parseEther('0.01'),
        maxAmount: ethers.utils.parseEther('10000'),
        baseFee: ethers.utils.parseEther('0.001'),
        feePercentage: 6, // 0.06%
        averageTime: 600, // 10 minutes
        securityScore: 85,
        liquidityScore: 90,
        reliabilityScore: 88,
        contractAddress: '0x8731d54E9D02c286767d56ac03e8037C07e01e98',
        apiEndpoint: 'https://api.stargate.finance'
      },
      {
        id: 'hop-eth-arbitrum',
        name: 'Hop Protocol',
        sourceChain: {
          chainId: 1,
          name: 'Ethereum',
          rpcUrl: 'https://eth-mainnet.alchemyapi.io/v2/api-key',
          nativeCurrency: 'ETH',
          blockTime: 12
        },
        targetChain: {
          chainId: 42161,
          name: 'Arbitrum',
          rpcUrl: 'https://arb1.arbitrum.io/rpc',
          nativeCurrency: 'ETH',
          blockTime: 1
        },
        supportedTokens: [
          '0xA0b86a33E6411085e6A2f9c1b7c4E6B7E3b9D3e6', // WETH
          '0xdAC17F958D2ee523a2206206994597C13D831ec7'  // USDT
        ],
        minAmount: ethers.utils.parseEther('0.005'),
        maxAmount: ethers.utils.parseEther('5000'),
        baseFee: ethers.utils.parseEther('0.0005'),
        feePercentage: 4, // 0.04%
        averageTime: 1200, // 20 minutes
        securityScore: 80,
        liquidityScore: 85,
        reliabilityScore: 90,
        contractAddress: '0xb8901acB165ed027E32754E0FFe830802919727f',
        apiEndpoint: 'https://hop.exchange/api'
      }
    ];

    knownBridges.forEach(bridge => {
      this.bridges.set(bridge.id, bridge);
    });
  }

  private initializeChains(): void {
    const knownChains: ChainInfo[] = [
      {
        chainId: 1,
        name: 'Ethereum',
        rpcUrl: 'https://eth-mainnet.alchemyapi.io/v2/api-key',
        nativeCurrency: 'ETH',
        blockTime: 12
      },
      {
        chainId: 137,
        name: 'Polygon',
        rpcUrl: 'https://polygon-rpc.com',
        nativeCurrency: 'MATIC',
        blockTime: 2
      },
      {
        chainId: 42161,
        name: 'Arbitrum',
        rpcUrl: 'https://arb1.arbitrum.io/rpc',
        nativeCurrency: 'ETH',
        blockTime: 1
      }
    ];

    knownChains.forEach(chain => {
      this.chains.set(chain.chainId, chain);
    });
  }

  private startLiquidityMonitoring(): void {
    // Monitor bridge liquidity every 5 minutes
    setInterval(async () => {
      try {
        await this.updateBridgeHealth();
      } catch (error) {
        console.error('Liquidity monitoring error:', error);
      }
    }, 300000);
  }
}