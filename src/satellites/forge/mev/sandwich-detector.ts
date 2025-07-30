import { ethers, BigNumber } from 'ethers';
import { TransactionRequest } from '@ethersproject/abstract-provider';

export interface SandwichAttackPattern {
  frontrunTransaction: TransactionRequest;
  victimTransaction: TransactionRequest;
  backrunTransaction: TransactionRequest;
  confidence: number;
  estimatedMevValue: BigNumber;
  detectionTimestamp: number;
}

export interface MEVProtectionConfig {
  enabled: boolean;
  minMevThreshold: BigNumber;
  maxSlippageProtection: number; // percentage
  privateMempool: boolean;
  delayRandomization: boolean;
  gasAuction: boolean;
  commitReveal: boolean;
}

export interface TransactionAnalysis {
  riskScore: number;
  mevVulnerability: 'low' | 'medium' | 'high' | 'critical';
  recommendedProtection: string[];
  estimatedMevExposure: BigNumber;
  timeWindow: number;
}

export class SandwichDetector {
  private provider: ethers.providers.Provider;
  private config: MEVProtectionConfig;
  private recentTransactions: Map<string, TransactionRequest[]> = new Map();
  private knownMevBots: Set<string> = new Set();
  private detectedPatterns: SandwichAttackPattern[] = [];

  constructor(
    provider: ethers.providers.Provider,
    config: Partial<MEVProtectionConfig> = {}
  ) {
    this.provider = provider;
    this.config = {
      enabled: true,
      minMevThreshold: ethers.utils.parseEther('0.01'),
      maxSlippageProtection: 2.0, // 2%
      privateMempool: true,
      delayRandomization: true,
      gasAuction: false,
      commitReveal: false,
      ...config
    };

    this.initializeKnownMevBots();
    this.startMempoolMonitoring();
  }

  /**
   * Analyze transaction for MEV vulnerability
   */
  async analyzeTransaction(transaction: TransactionRequest): Promise<TransactionAnalysis> {
    const riskFactors = await this.calculateRiskFactors(transaction);
    const riskScore = this.calculateOverallRiskScore(riskFactors);
    
    let mevVulnerability: TransactionAnalysis['mevVulnerability'] = 'low';
    if (riskScore > 0.8) mevVulnerability = 'critical';
    else if (riskScore > 0.6) mevVulnerability = 'high';
    else if (riskScore > 0.4) mevVulnerability = 'medium';

    const recommendedProtection = this.getRecommendedProtection(riskScore, riskFactors);
    const estimatedMevExposure = this.estimateMevExposure(transaction, riskFactors);

    return {
      riskScore,
      mevVulnerability,
      recommendedProtection,
      estimatedMevExposure,
      timeWindow: this.calculateOptimalTimeWindow(riskScore)
    };
  }

  /**
   * Detect potential sandwich attacks in mempool
   */
  async detectSandwichAttacks(timeWindowMs: number = 30000): Promise<SandwichAttackPattern[]> {
    const now = Date.now();
    const recentTxs = this.getRecentTransactions(timeWindowMs);
    const patterns: SandwichAttackPattern[] = [];

    // Group transactions by target token/pool
    const txGroups = this.groupTransactionsByTarget(recentTxs);

    for (const [target, transactions] of txGroups) {
      const sandwichPatterns = this.analyzeTxGroupForSandwich(transactions);
      patterns.push(...sandwichPatterns);
    }

    // Store detected patterns
    this.detectedPatterns.push(...patterns);
    
    // Clean old patterns
    this.detectedPatterns = this.detectedPatterns.filter(
      pattern => now - pattern.detectionTimestamp < 300000 // 5 minutes
    );

    return patterns;
  }

  /**
   * Check if address is known MEV bot
   */
  isKnownMevBot(address: string): boolean {
    return this.knownMevBots.has(address.toLowerCase());
  }

  /**
   * Generate MEV-protected transaction parameters
   */
  async generateProtectedTransaction(
    transaction: TransactionRequest,
    analysis: TransactionAnalysis
  ): Promise<TransactionRequest> {
    let protectedTx = { ...transaction };

    // Apply recommended protections
    for (const protection of analysis.recommendedProtection) {
      protectedTx = await this.applyProtection(protectedTx, protection, analysis);
    }

    return protectedTx;
  }

  /**
   * Calculate MEV risk factors for a transaction
   */
  private async calculateRiskFactors(transaction: TransactionRequest): Promise<{
    largeSwap: number;
    popularToken: number;
    highSlippage: number;
    gasPrice: number;
    timing: number;
    addressReputation: number;
  }> {
    // Analyze transaction data to extract risk factors
    const value = transaction.value || BigNumber.from(0);
    const gasPrice = transaction.gasPrice || BigNumber.from(0);
    const data = transaction.data || '0x';

    // Large swap detection
    const largeSwap = this.calculateLargeSwapScore(value, data);
    
    // Popular token detection
    const popularToken = await this.calculatePopularTokenScore(transaction.to, data);
    
    // High slippage detection
    const highSlippage = this.calculateSlippageScore(data);
    
    // Gas price analysis
    const gasPriceScore = await this.calculateGasPriceScore(gasPrice);
    
    // Timing analysis
    const timingScore = this.calculateTimingScore();
    
    // Address reputation
    const addressReputation = this.calculateAddressReputationScore(transaction.from);

    return {
      largeSwap,
      popularToken,
      highSlippage,
      gasPrice: gasPriceScore,
      timing: timingScore,
      addressReputation
    };
  }

  private calculateOverallRiskScore(riskFactors: any): number {
    const weights = {
      largeSwap: 0.25,
      popularToken: 0.2,
      highSlippage: 0.2,
      gasPrice: 0.15,
      timing: 0.1,
      addressReputation: 0.1
    };

    return Object.entries(weights).reduce((score, [factor, weight]) => {
      return score + (riskFactors[factor] * weight);
    }, 0);
  }

  private calculateLargeSwapScore(value: BigNumber, data: string): number {
    // Analyze transaction value and decode swap parameters
    const valueInEth = parseFloat(ethers.utils.formatEther(value));
    
    // Large value transactions are more attractive to MEV
    if (valueInEth > 100) return 0.9;
    if (valueInEth > 10) return 0.7;
    if (valueInEth > 1) return 0.5;
    if (valueInEth > 0.1) return 0.3;
    return 0.1;
  }

  private async calculatePopularTokenScore(to: string | undefined, data: string): Promise<number> {
    if (!to) return 0;

    // Check if interacting with popular DEXs/tokens
    const popularDexes = [
      '0x7a250d5630b4cf539739df2c5dacb4c659f2488d', // Uniswap V2 Router
      '0xe592427a0aece92de3edee1f18e0157c05861564', // Uniswap V3 Router
      '0xdef1c0ded9bec7f1a1670819833240f027b25eff', // 0x Exchange
      '0x1111111254fb6c44bac0bed2854e76f90643097d'  // 1inch
    ];

    if (popularDexes.includes(to.toLowerCase())) {
      return 0.8;
    }

    // Check for token transfer/swap patterns in data
    if (data.length > 10) {
      const methodId = data.slice(0, 10);
      const swapMethods = [
        '0x38ed1739', // swapExactTokensForTokens
        '0x8803dbee', // swapTokensForExactTokens
        '0x7ff36ab5', // swapExactETHForTokens
        '0x18cbafe5'  // swapExactTokensForETH
      ];
      
      if (swapMethods.includes(methodId)) {
        return 0.7;
      }
    }

    return 0.2;
  }

  private calculateSlippageScore(data: string): number {
    // Try to decode slippage parameters from transaction data
    // This is a simplified implementation
    if (data.length > 200) {
      // Large data suggests complex swap with potential slippage
      return 0.6;
    }
    return 0.3;
  }

  private async calculateGasPriceScore(gasPrice: BigNumber): Promise<number> {
    try {
      const networkGasPrice = await this.provider.getGasPrice();
      const ratio = gasPrice.mul(100).div(networkGasPrice).toNumber() / 100;
      
      // High gas price indicates urgency (MEV target)
      if (ratio > 2) return 0.9;
      if (ratio > 1.5) return 0.7;
      if (ratio > 1.2) return 0.5;
      return 0.2;
    } catch {
      return 0.3;
    }
  }

  private calculateTimingScore(): number {
    // Check if transaction is submitted at suspicious times
    const hour = new Date().getHours();
    const minute = new Date().getMinutes();
    
    // High activity periods are more risky
    if ((hour >= 8 && hour <= 10) || (hour >= 14 && hour <= 16)) {
      return 0.6;
    }
    
    // Round numbers suggest bot activity
    if (minute % 15 === 0) {
      return 0.4;
    }
    
    return 0.2;
  }

  private calculateAddressReputationScore(from: string | undefined): number {
    if (!from) return 0.5;
    
    if (this.isKnownMevBot(from)) {
      return 0.1; // Low risk if we're the MEV bot
    }
    
    // Check for suspicious patterns
    const address = from.toLowerCase();
    
    // New addresses with no history
    if (address.match(/^0x[0-9a-f]{40}$/)) {
      // This would normally check on-chain history
      return 0.5;
    }
    
    return 0.3;
  }

  private getRecommendedProtection(riskScore: number, riskFactors: any): string[] {
    const protections: string[] = [];
    
    if (riskScore > 0.6) {
      protections.push('private_mempool');
      protections.push('gas_auction');
    }
    
    if (riskScore > 0.4) {
      protections.push('delay_randomization');
      protections.push('slippage_protection');
    }
    
    if (riskFactors.largeSwap > 0.7) {
      protections.push('transaction_splitting');
    }
    
    if (riskFactors.timing > 0.5) {
      protections.push('commit_reveal');
    }
    
    return protections;
  }

  private estimateMevExposure(transaction: TransactionRequest, riskFactors: any): BigNumber {
    const value = transaction.value || BigNumber.from(0);
    const baseExposure = value.mul(riskFactors.largeSwap * 100).div(100);
    
    // Apply multipliers based on other risk factors
    let multiplier = 1;
    if (riskFactors.popularToken > 0.7) multiplier *= 1.5;
    if (riskFactors.highSlippage > 0.6) multiplier *= 1.3;
    if (riskFactors.timing > 0.5) multiplier *= 1.2;
    
    return baseExposure.mul(Math.floor(multiplier * 100)).div(100);
  }

  private calculateOptimalTimeWindow(riskScore: number): number {
    // Higher risk requires longer observation window
    if (riskScore > 0.8) return 60000; // 1 minute
    if (riskScore > 0.6) return 45000; // 45 seconds
    if (riskScore > 0.4) return 30000; // 30 seconds
    return 15000; // 15 seconds
  }

  private initializeKnownMevBots(): void {
    // Add known MEV bot addresses
    const knownBots = [
      '0x5050e08626c499411b5d0e0b5af0e83d3fd82edf',
      '0x000000000000084e91743124a982076c59f10084',
      '0x0000000000007f150bd6f54c40a34d7c3d5e9f56'
    ];
    
    knownBots.forEach(bot => this.knownMevBots.add(bot.toLowerCase()));
  }

  private startMempoolMonitoring(): void {
    if (!this.config.enabled) return;
    
    // This would normally connect to mempool stream
    // For demo, we'll simulate with periodic checks
    setInterval(() => {
      this.detectSandwichAttacks();
    }, 5000);
  }

  private getRecentTransactions(timeWindowMs: number): TransactionRequest[] {
    const now = Date.now();
    const cutoff = now - timeWindowMs;
    const recent: TransactionRequest[] = [];
    
    for (const [timestamp, txs] of this.recentTransactions) {
      if (parseInt(timestamp) > cutoff) {
        recent.push(...txs);
      }
    }
    
    return recent;
  }

  private groupTransactionsByTarget(transactions: TransactionRequest[]): Map<string, TransactionRequest[]> {
    const groups = new Map<string, TransactionRequest[]>();
    
    transactions.forEach(tx => {
      const target = tx.to || 'unknown';
      if (!groups.has(target)) {
        groups.set(target, []);
      }
      groups.get(target)!.push(tx);
    });
    
    return groups;
  }

  private analyzeTxGroupForSandwich(transactions: TransactionRequest[]): SandwichAttackPattern[] {
    const patterns: SandwichAttackPattern[] = [];
    
    if (transactions.length < 3) return patterns;
    
    // Sort by gas price (descending) to find potential front/back runs
    const sorted = transactions.sort((a, b) => {
      const gasPriceA = a.gasPrice || BigNumber.from(0);
      const gasPriceB = b.gasPrice || BigNumber.from(0);
      return gasPriceB.sub(gasPriceA).toNumber();
    });
    
    // Look for sandwich patterns: high gas -> normal gas -> high gas
    for (let i = 0; i < sorted.length - 2; i++) {
      const front = sorted[i];
      const victim = sorted[i + 1];
      const back = sorted[i + 2];
      
      if (this.isSandwichPattern(front, victim, back)) {
        const confidence = this.calculateSandwichConfidence(front, victim, back);
        const estimatedMevValue = this.estimateSandwichValue(front, victim, back);
        
        patterns.push({
          frontrunTransaction: front,
          victimTransaction: victim,
          backrunTransaction: back,
          confidence,
          estimatedMevValue,
          detectionTimestamp: Date.now()
        });
      }
    }
    
    return patterns;
  }

  private isSandwichPattern(front: TransactionRequest, victim: TransactionRequest, back: TransactionRequest): boolean {
    // Check if front and back transactions are from same address (MEV bot)
    if (front.from !== back.from) return false;
    
    // Check gas price pattern
    const frontGas = front.gasPrice || BigNumber.from(0);
    const victimGas = victim.gasPrice || BigNumber.from(0);
    const backGas = back.gasPrice || BigNumber.from(0);
    
    // Front-run should have higher gas than victim
    if (!frontGas.gt(victimGas)) return false;
    
    // Back-run should have lower gas than front-run but higher than victim
    if (!backGas.lt(frontGas) || !backGas.gte(victimGas)) return false;
    
    return true;
  }

  private calculateSandwichConfidence(front: TransactionRequest, victim: TransactionRequest, back: TransactionRequest): number {
    let confidence = 0.5;
    
    // Same address for front and back
    if (front.from === back.from) confidence += 0.2;
    
    // Gas price analysis
    const frontGas = front.gasPrice || BigNumber.from(0);
    const victimGas = victim.gasPrice || BigNumber.from(0);
    const backGas = back.gasPrice || BigNumber.from(0);
    
    const frontRatio = frontGas.mul(100).div(victimGas.add(1)).toNumber() / 100;
    if (frontRatio > 1.5) confidence += 0.15;
    if (frontRatio > 2) confidence += 0.1;
    
    // Known MEV bot
    if (front.from && this.isKnownMevBot(front.from)) {
      confidence += 0.15;
    }
    
    return Math.min(confidence, 1.0);
  }

  private estimateSandwichValue(front: TransactionRequest, victim: TransactionRequest, back: TransactionRequest): BigNumber {
    // Simplified MEV value estimation
    const victimValue = victim.value || BigNumber.from(0);
    
    // Assume MEV is proportional to victim transaction value
    // Typical sandwich attack extracts 0.1-1% of transaction value
    return victimValue.mul(5).div(1000); // 0.5%
  }

  private async applyProtection(
    transaction: TransactionRequest,
    protection: string,
    analysis: TransactionAnalysis
  ): Promise<TransactionRequest> {
    let protectedTx = { ...transaction };
    
    switch (protection) {
      case 'private_mempool':
        // This would route through private mempool
        protectedTx.gasPrice = protectedTx.gasPrice?.mul(105).div(100); // 5% gas premium
        break;
        
      case 'delay_randomization':
        // Add random delay (simulated by gas price adjustment)
        const randomDelay = Math.random() * 10; // 0-10 seconds
        protectedTx.gasPrice = protectedTx.gasPrice?.mul(100 + Math.floor(randomDelay)).div(100);
        break;
        
      case 'slippage_protection':
        // This would adjust slippage parameters in transaction data
        // For demo, we increase gas limit for better execution
        protectedTx.gasLimit = protectedTx.gasLimit?.mul(110).div(100);
        break;
        
      case 'gas_auction':
        // Implement gas auction mechanism
        const auctionPremium = Math.min(analysis.riskScore * 50, 25); // Max 25% premium
        protectedTx.gasPrice = protectedTx.gasPrice?.mul(100 + Math.floor(auctionPremium)).div(100);
        break;
        
      case 'transaction_splitting':
        // This would split large transaction into smaller ones
        // For demo, we just reduce transaction size
        if (protectedTx.value) {
          protectedTx.value = protectedTx.value.div(2);
        }
        break;
        
      case 'commit_reveal':
        // This would implement commit-reveal scheme
        // For demo, we add nonce randomization
        protectedTx.nonce = (protectedTx.nonce || 0) + Math.floor(Math.random() * 3);
        break;
    }
    
    return protectedTx;
  }
}