import { ethers, BigNumber } from 'ethers';
import { TransactionRequest, TransactionResponse } from '@ethersproject/abstract-provider';

export interface GasEstimate {
  gasLimit: BigNumber;
  gasPrice: BigNumber;
  maxFeePerGas?: BigNumber;
  maxPriorityFeePerGas?: BigNumber;
  totalCost: BigNumber;
  confidence: number;
  strategy: GasStrategy;
}

export interface NetworkConditions {
  baseFee: BigNumber;
  nextBaseFee: BigNumber;
  gasUsed: number;
  gasLimit: number;
  pendingTransactions: number;
  congestionLevel: 'low' | 'medium' | 'high' | 'extreme';
  avgWaitTime: number;
}

export interface HistoricalGasData {
  timestamp: number;
  gasPrice: BigNumber;
  baseFee: BigNumber;
  priorityFee: BigNumber;
  blockUtilization: number;
  confirmationTime: number;
}

export interface SimulationResult {
  success: boolean;
  gasUsed: BigNumber;
  gasPrice: BigNumber;
  revertReason?: string;
  returnData?: string;
  logs?: ethers.providers.Log[];
  trace?: any;
}

export interface BatchOptimization {
  transactions: TransactionRequest[];
  totalGasSaved: BigNumber;
  executionOrder: number[];
  noncesOptimized: boolean;
  estimatedSavings: number;
}

export type GasStrategy = 
  | 'aggressive'    // Highest gas price for fastest execution
  | 'standard'      // Market rate gas price
  | 'conservative'  // Lower gas price, longer wait
  | 'dynamic'       // Adaptive based on network conditions
  | 'batch'         // Optimized for batch transactions
  | 'mev_protected'; // MEV protection priority

export interface GasOptimizationConfig {
  maxGasPrice: BigNumber;
  maxWaitTime: number; // seconds
  slippageTolerance: number; // percentage
  retryAttempts: number;
  backoffMultiplier: number;
  enableEIP1559: boolean;
  enableBatching: boolean;
  mevProtection: boolean;
}

export class GasOptimizer {
  private provider: ethers.providers.Provider;
  private historicalData: Map<string, HistoricalGasData[]> = new Map();
  private config: GasOptimizationConfig;
  private predictionModel: GasPredictionModel;

  constructor(
    provider: ethers.providers.Provider,
    config: Partial<GasOptimizationConfig> = {}
  ) {
    this.provider = provider;
    this.config = {
      maxGasPrice: ethers.utils.parseUnits('500', 'gwei'),
      maxWaitTime: 300, // 5 minutes
      slippageTolerance: 0.5,
      retryAttempts: 3,
      backoffMultiplier: 1.5,
      enableEIP1559: true,
      enableBatching: true,
      mevProtection: false,
      ...config
    };
    this.predictionModel = new GasPredictionModel();
  }

  /**
   * Estimate optimal gas parameters for a transaction
   */
  async estimateOptimalGas(
    transaction: TransactionRequest,
    strategy: GasStrategy = 'standard'
  ): Promise<GasEstimate> {
    const baseEstimate = await this.provider.estimateGas(transaction);
    const networkConditions = await this.getNetworkConditions();
    const historicalSimilar = this.getHistoricalSimilarConditions(networkConditions);

    return this.predictionModel.predictOptimalGas(
      baseEstimate,
      networkConditions,
      historicalSimilar,
      strategy,
      this.config
    );
  }

  /**
   * Simulate transaction execution without broadcasting
   */
  async simulateTransaction(
    transaction: TransactionRequest,
    gasPrice?: BigNumber
  ): Promise<SimulationResult> {
    try {
      // Create a copy of the transaction with gas parameters
      const txCopy = {
        ...transaction,
        gasPrice: gasPrice || transaction.gasPrice,
      };

      // Use eth_call for read-only simulation first
      if (transaction.to && transaction.data) {
        try {
          const result = await this.provider.call(txCopy);
          
          // For more detailed simulation, use debug_traceCall if available
          const trace = await this.traceCall(txCopy);
          
          return {
            success: true,
            gasUsed: BigNumber.from(trace?.gasUsed || 21000),
            gasPrice: gasPrice || BigNumber.from(0),
            returnData: result,
            trace: trace
          };
        } catch (error: any) {
          return {
            success: false,
            gasUsed: BigNumber.from(0),
            gasPrice: gasPrice || BigNumber.from(0),
            revertReason: error.reason || error.message
          };
        }
      }

      // For contract deployment or complex transactions
      const gasEstimate = await this.provider.estimateGas(txCopy);
      
      return {
        success: true,
        gasUsed: gasEstimate,
        gasPrice: gasPrice || BigNumber.from(0)
      };
    } catch (error: any) {
      return {
        success: false,
        gasUsed: BigNumber.from(0),
        gasPrice: gasPrice || BigNumber.from(0),
        revertReason: error.reason || error.message
      };
    }
  }

  /**
   * Optimize batch of transactions for gas efficiency
   */
  async optimizeBatch(transactions: TransactionRequest[]): Promise<BatchOptimization> {
    if (!this.config.enableBatching || transactions.length <= 1) {
      return {
        transactions,
        totalGasSaved: BigNumber.from(0),
        executionOrder: transactions.map((_, i) => i),
        noncesOptimized: false,
        estimatedSavings: 0
      };
    }

    // Sort by gas price and priority
    const sortedTxs = await this.sortTransactionsByPriority(transactions);
    
    // Optimize nonce usage
    const nonceOptimized = await this.optimizeNonces(sortedTxs);
    
    // Calculate potential gas savings
    const originalGasCost = await this.calculateTotalGasCost(transactions);
    const optimizedGasCost = await this.calculateTotalGasCost(nonceOptimized.transactions);
    const gasSaved = originalGasCost.sub(optimizedGasCost);
    
    return {
      transactions: nonceOptimized.transactions,
      totalGasSaved: gasSaved,
      executionOrder: sortedTxs.map((_, i) => i),
      noncesOptimized: nonceOptimized.optimized,
      estimatedSavings: parseFloat(ethers.utils.formatEther(gasSaved))
    };
  }

  /**
   * Execute transaction with intelligent retry mechanism
   */
  async executeWithRetry(
    transaction: TransactionRequest,
    signer: ethers.Signer,
    strategy: GasStrategy = 'standard'
  ): Promise<TransactionResponse> {
    let attempt = 0;
    let lastError: Error | null = null;

    while (attempt < this.config.retryAttempts) {
      try {
        // Get optimal gas estimate for current attempt
        const gasEstimate = await this.estimateOptimalGas(transaction, strategy);
        
        // Apply backoff multiplier for retries
        if (attempt > 0) {
          const backoffMultiplier = Math.pow(this.config.backoffMultiplier, attempt);
          gasEstimate.gasPrice = gasEstimate.gasPrice.mul(Math.floor(backoffMultiplier * 100)).div(100);
          
          if (gasEstimate.maxFeePerGas) {
            gasEstimate.maxFeePerGas = gasEstimate.maxFeePerGas.mul(Math.floor(backoffMultiplier * 100)).div(100);
          }
        }

        // Check if gas price exceeds maximum
        if (gasEstimate.gasPrice.gt(this.config.maxGasPrice)) {
          throw new Error(`Gas price ${ethers.utils.formatUnits(gasEstimate.gasPrice, 'gwei')} gwei exceeds maximum ${ethers.utils.formatUnits(this.config.maxGasPrice, 'gwei')} gwei`);
        }

        // Execute transaction
        const txWithGas = {
          ...transaction,
          gasLimit: gasEstimate.gasLimit,
          gasPrice: gasEstimate.gasPrice,
          ...(gasEstimate.maxFeePerGas && { maxFeePerGas: gasEstimate.maxFeePerGas }),
          ...(gasEstimate.maxPriorityFeePerGas && { maxPriorityFeePerGas: gasEstimate.maxPriorityFeePerGas })
        };

        const txResponse = await signer.sendTransaction(txWithGas);
        
        // Store successful execution data for learning
        this.storeExecutionData(transaction, gasEstimate, txResponse);
        
        return txResponse;
      } catch (error: any) {
        lastError = error;
        attempt++;
        
        // Check if error is retryable
        if (!this.isRetryableError(error) || attempt >= this.config.retryAttempts) {
          break;
        }
        
        // Wait before retry with exponential backoff
        const waitTime = Math.min(1000 * Math.pow(2, attempt), 30000);
        await this.sleep(waitTime);
      }
    }

    throw lastError || new Error('Transaction execution failed after retries');
  }

  /**
   * Get current network conditions
   */
  private async getNetworkConditions(): Promise<NetworkConditions> {
    const latestBlock = await this.provider.getBlock('latest');
    const pendingBlock = await this.provider.getBlock('pending');
    const feeData = await this.provider.getFeeData();

    const gasUsed = latestBlock.gasUsed.toNumber();
    const gasLimit = latestBlock.gasLimit.toNumber();
    const utilization = gasUsed / gasLimit;

    let congestionLevel: NetworkConditions['congestionLevel'] = 'low';
    if (utilization > 0.95) congestionLevel = 'extreme';
    else if (utilization > 0.8) congestionLevel = 'high';
    else if (utilization > 0.6) congestionLevel = 'medium';

    // Estimate next base fee (EIP-1559)
    const baseFee = latestBlock.baseFeePerGas || BigNumber.from(0);
    const nextBaseFee = this.calculateNextBaseFee(baseFee, utilization);

    return {
      baseFee,
      nextBaseFee,
      gasUsed,
      gasLimit,
      pendingTransactions: pendingBlock ? pendingBlock.transactions.length : 0,
      congestionLevel,
      avgWaitTime: this.estimateWaitTime(congestionLevel)
    };
  }

  private getHistoricalSimilarConditions(current: NetworkConditions): HistoricalGasData[] {
    const networkKey = `${current.congestionLevel}_${Math.floor(current.gasUsed / 1000000)}M`;
    return this.historicalData.get(networkKey) || [];
  }

  private calculateNextBaseFee(currentBaseFee: BigNumber, utilization: number): BigNumber {
    const targetUtilization = 0.5;
    const maxChangeRate = 0.125; // 12.5% max change per block

    if (utilization > targetUtilization) {
      const increase = Math.min((utilization - targetUtilization) * 2, maxChangeRate);
      return currentBaseFee.mul(Math.floor((1 + increase) * 1000)).div(1000);
    } else {
      const decrease = Math.min((targetUtilization - utilization) * 2, maxChangeRate);
      return currentBaseFee.mul(Math.floor((1 - decrease) * 1000)).div(1000);
    }
  }

  private estimateWaitTime(congestionLevel: NetworkConditions['congestionLevel']): number {
    switch (congestionLevel) {
      case 'low': return 15; // 1 block
      case 'medium': return 45; // 3 blocks  
      case 'high': return 90; // 6 blocks
      case 'extreme': return 300; // 20+ blocks
    }
  }

  private async sortTransactionsByPriority(transactions: TransactionRequest[]): Promise<TransactionRequest[]> {
    // Sort by gas price (descending) and nonce (ascending)
    return transactions.sort((a, b) => {
      const gasPriceA = a.gasPrice || BigNumber.from(0);
      const gasPriceB = b.gasPrice || BigNumber.from(0);
      
      if (!gasPriceA.eq(gasPriceB)) {
        return gasPriceB.sub(gasPriceA).toNumber();
      }
      
      const nonceA = a.nonce || 0;
      const nonceB = b.nonce || 0;
      return nonceA - nonceB;
    });
  }

  private async optimizeNonces(transactions: TransactionRequest[]): Promise<{ transactions: TransactionRequest[], optimized: boolean }> {
    let optimized = false;
    const optimizedTxs = [...transactions];

    // Check for nonce gaps and reorder if possible
    for (let i = 0; i < optimizedTxs.length - 1; i++) {
      const current = optimizedTxs[i];
      const next = optimizedTxs[i + 1];
      
      if (current.nonce && next.nonce && current.nonce > next.nonce + 1) {
        // Swap transactions to fill nonce gap
        [optimizedTxs[i], optimizedTxs[i + 1]] = [optimizedTxs[i + 1], optimizedTxs[i]];
        optimized = true;
      }
    }

    return { transactions: optimizedTxs, optimized };
  }

  private async calculateTotalGasCost(transactions: TransactionRequest[]): Promise<BigNumber> {
    let totalCost = BigNumber.from(0);
    
    for (const tx of transactions) {
      const gasLimit = tx.gasLimit || await this.provider.estimateGas(tx);
      const gasPrice = tx.gasPrice || (await this.provider.getFeeData()).gasPrice || BigNumber.from(0);
      totalCost = totalCost.add(gasLimit.mul(gasPrice));
    }
    
    return totalCost;
  }

  private async traceCall(transaction: TransactionRequest): Promise<any> {
    try {
      // This would require a provider that supports debug_traceCall
      // Fallback to basic simulation
      return { gasUsed: 21000 };
    } catch {
      return { gasUsed: 21000 };
    }
  }

  private storeExecutionData(
    transaction: TransactionRequest,
    gasEstimate: GasEstimate,
    response: TransactionResponse
  ): void {
    // Store data for machine learning improvements
    const timestamp = Date.now();
    const data: HistoricalGasData = {
      timestamp,
      gasPrice: gasEstimate.gasPrice,
      baseFee: BigNumber.from(0), // Would be filled from block data
      priorityFee: gasEstimate.maxPriorityFeePerGas || BigNumber.from(0),
      blockUtilization: 0, // Would be calculated
      confirmationTime: 0 // Would be measured
    };

    // Store in appropriate bucket
    const key = `execution_${timestamp}`;
    const existing = this.historicalData.get(key) || [];
    existing.push(data);
    this.historicalData.set(key, existing);
  }

  private isRetryableError(error: any): boolean {
    const retryableErrors = [
      'replacement transaction underpriced',
      'transaction underpriced',
      'insufficient funds for gas',
      'nonce too low',
      'network error',
      'timeout'
    ];

    const errorMessage = error.message?.toLowerCase() || '';
    return retryableErrors.some(retryable => errorMessage.includes(retryable));
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Gas prediction model using historical data and network conditions
 */
class GasPredictionModel {
  predictOptimalGas(
    baseEstimate: BigNumber,
    networkConditions: NetworkConditions,
    historicalData: HistoricalGasData[],
    strategy: GasStrategy,
    config: GasOptimizationConfig
  ): GasEstimate {
    const { baseFee, congestionLevel } = networkConditions;
    
    // Calculate gas limit with safety buffer
    const gasLimit = baseEstimate.mul(110).div(100); // 10% buffer
    
    // Determine gas price based on strategy
    let gasPrice: BigNumber;
    let maxFeePerGas: BigNumber | undefined;
    let maxPriorityFeePerGas: BigNumber | undefined;
    let confidence = 0.8;

    if (config.enableEIP1559 && baseFee.gt(0)) {
      // EIP-1559 pricing
      const priorityFee = this.calculatePriorityFee(strategy, congestionLevel, historicalData);
      maxPriorityFeePerGas = priorityFee;
      maxFeePerGas = baseFee.mul(2).add(priorityFee); // 2x base fee + priority
      gasPrice = maxFeePerGas;
    } else {
      // Legacy pricing
      gasPrice = this.calculateLegacyGasPrice(strategy, congestionLevel, historicalData);
    }

    // Apply strategy-specific adjustments
    switch (strategy) {
      case 'aggressive':
        gasPrice = gasPrice.mul(150).div(100); // 50% higher
        confidence = 0.95;
        break;
      case 'conservative':
        gasPrice = gasPrice.mul(80).div(100); // 20% lower
        confidence = 0.6;
        break;
      case 'mev_protected':
        gasPrice = gasPrice.mul(120).div(100); // 20% higher for MEV protection
        confidence = 0.85;
        break;
    }

    const totalCost = gasLimit.mul(gasPrice);

    return {
      gasLimit,
      gasPrice,
      maxFeePerGas,
      maxPriorityFeePerGas,
      totalCost,
      confidence,
      strategy
    };
  }

  private calculatePriorityFee(
    strategy: GasStrategy,
    congestionLevel: NetworkConditions['congestionLevel'],
    historicalData: HistoricalGasData[]
  ): BigNumber {
    // Base priority fee based on congestion
    const basePriority = {
      'low': ethers.utils.parseUnits('1', 'gwei'),
      'medium': ethers.utils.parseUnits('2', 'gwei'),
      'high': ethers.utils.parseUnits('5', 'gwei'),
      'extreme': ethers.utils.parseUnits('10', 'gwei')
    }[congestionLevel];

    // Adjust based on historical data
    if (historicalData.length > 0) {
      const avgHistorical = historicalData
        .reduce((sum, data) => sum.add(data.priorityFee), BigNumber.from(0))
        .div(historicalData.length);
      
      return basePriority.add(avgHistorical).div(2); // Average of base and historical
    }

    return basePriority;
  }

  private calculateLegacyGasPrice(
    strategy: GasStrategy,
    congestionLevel: NetworkConditions['congestionLevel'],
    historicalData: HistoricalGasData[]
  ): BigNumber {
    // Base gas price based on congestion
    const baseGasPrice = {
      'low': ethers.utils.parseUnits('20', 'gwei'),
      'medium': ethers.utils.parseUnits('40', 'gwei'),
      'high': ethers.utils.parseUnits('80', 'gwei'),
      'extreme': ethers.utils.parseUnits('150', 'gwei')
    }[congestionLevel];

    // Adjust based on historical data
    if (historicalData.length > 0) {
      const avgHistorical = historicalData
        .reduce((sum, data) => sum.add(data.gasPrice), BigNumber.from(0))
        .div(historicalData.length);
      
      return baseGasPrice.add(avgHistorical).div(2); // Average of base and historical
    }

    return baseGasPrice;
  }
}