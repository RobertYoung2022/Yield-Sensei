import { ethers, BigNumber } from 'ethers';
import { TransactionRequest, TransactionResponse } from '@ethersproject/abstract-provider';
import { GasOptimizer, GasEstimate, BatchOptimization } from './gas-optimizer';

export interface BatchedTransaction {
  originalIndex: number;
  transaction: TransactionRequest;
  gasEstimate: GasEstimate;
  dependencies: number[];
  priority: number;
  deadline?: number; // Unix timestamp
}

export interface BatchExecutionResult {
  success: boolean;
  transactions: TransactionResponse[];
  failures: Array<{
    index: number;
    transaction: TransactionRequest;
    error: string;
  }>;
  totalGasUsed: BigNumber;
  totalGasCost: BigNumber;
  executionTime: number;
  optimizationSavings: number;
}

export interface BatchConfig {
  maxBatchSize: number;
  maxGasPerBatch: BigNumber;
  parallelExecution: boolean;
  dependencyResolution: boolean;
  deadlineEnforcement: boolean;
  failFast: boolean;
  retryFailedTransactions: boolean;
}

export class TransactionBatcher {
  private gasOptimizer: GasOptimizer;
  private config: BatchConfig;
  private pendingBatches: Map<string, BatchedTransaction[]> = new Map();

  constructor(
    gasOptimizer: GasOptimizer,
    config: Partial<BatchConfig> = {}
  ) {
    this.gasOptimizer = gasOptimizer;
    this.config = {
      maxBatchSize: 50,
      maxGasPerBatch: BigNumber.from('8000000'), // 8M gas
      parallelExecution: true,
      dependencyResolution: true,
      deadlineEnforcement: true,
      failFast: false,
      retryFailedTransactions: true,
      ...config
    };
  }

  /**
   * Add transaction to batch queue
   */
  async addToBatch(
    batchId: string,
    transaction: TransactionRequest,
    options: {
      priority?: number;
      dependencies?: number[];
      deadline?: number;
    } = {}
  ): Promise<void> {
    const gasEstimate = await this.gasOptimizer.estimateOptimalGas(transaction);
    
    const batchedTx: BatchedTransaction = {
      originalIndex: this.getBatchSize(batchId),
      transaction,
      gasEstimate,
      dependencies: options.dependencies || [],
      priority: options.priority || 0,
      deadline: options.deadline
    };

    if (!this.pendingBatches.has(batchId)) {
      this.pendingBatches.set(batchId, []);
    }

    const batch = this.pendingBatches.get(batchId)!;
    batch.push(batchedTx);

    // Auto-execute if batch is full
    if (batch.length >= this.config.maxBatchSize) {
      await this.executeBatch(batchId, ethers.Wallet.createRandom()); // Would need actual signer
    }
  }

  /**
   * Execute all transactions in a batch
   */
  async executeBatch(
    batchId: string,
    signer: ethers.Signer
  ): Promise<BatchExecutionResult> {
    const startTime = Date.now();
    const batch = this.pendingBatches.get(batchId);
    
    if (!batch || batch.length === 0) {
      throw new Error(`Batch ${batchId} not found or empty`);
    }

    try {
      // Optimize batch order and gas usage
      const optimization = await this.optimizeBatchExecution(batch);
      
      // Check total gas limit
      const totalGas = optimization.transactions.reduce(
        (sum, tx) => sum.add(tx.gasLimit || BigNumber.from('21000')),
        BigNumber.from(0)
      );

      if (totalGas.gt(this.config.maxGasPerBatch)) {
        throw new Error(`Batch exceeds gas limit: ${totalGas.toString()} > ${this.config.maxGasPerBatch.toString()}`);
      }

      // Execute transactions
      const results = await this.executeOptimizedBatch(optimization.transactions, signer);
      
      // Calculate metrics
      const totalGasUsed = results.transactions.reduce(
        (sum, tx) => sum.add(tx.gasLimit || BigNumber.from('21000')),
        BigNumber.from(0)
      );

      const totalGasCost = results.transactions.reduce(
        (sum, tx) => {
          const gasPrice = tx.gasPrice || BigNumber.from(0);
          const gasUsed = tx.gasLimit || BigNumber.from('21000');
          return sum.add(gasPrice.mul(gasUsed));
        },
        BigNumber.from(0)
      );

      const executionResult: BatchExecutionResult = {
        success: results.failures.length === 0,
        transactions: results.transactions,
        failures: results.failures,
        totalGasUsed,
        totalGasCost,
        executionTime: Date.now() - startTime,
        optimizationSavings: optimization.estimatedSavings
      };

      // Clean up completed batch
      this.pendingBatches.delete(batchId);

      return executionResult;
    } catch (error) {
      throw new Error(`Batch execution failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get current batch size
   */
  getBatchSize(batchId: string): number {
    return this.pendingBatches.get(batchId)?.length || 0;
  }

  /**
   * Get pending batches
   */
  getPendingBatches(): string[] {
    return Array.from(this.pendingBatches.keys());
  }

  /**
   * Clear batch
   */
  clearBatch(batchId: string): void {
    this.pendingBatches.delete(batchId);
  }

  /**
   * Get batch transactions
   */
  getBatchTransactions(batchId: string): BatchedTransaction[] {
    return this.pendingBatches.get(batchId) || [];
  }

  /**
   * Optimize batch execution order and parameters
   */
  private async optimizeBatchExecution(batch: BatchedTransaction[]): Promise<BatchOptimization> {
    // Extract raw transactions
    const transactions = batch.map(bt => bt.transaction);
    
    // Get base optimization from GasOptimizer
    const baseOptimization = await this.gasOptimizer.optimizeBatch(transactions);
    
    // Apply additional batch-specific optimizations
    const optimizedBatch = await this.applyBatchOptimizations(batch, baseOptimization);
    
    return optimizedBatch;
  }

  /**
   * Apply batch-specific optimizations
   */
  private async applyBatchOptimizations(
    batch: BatchedTransaction[],
    baseOptimization: BatchOptimization
  ): Promise<BatchOptimization> {
    let optimizedTransactions = [...baseOptimization.transactions];
    let additionalSavings = baseOptimization.estimatedSavings;

    // 1. Dependency resolution
    if (this.config.dependencyResolution) {
      optimizedTransactions = this.resolveDependencies(batch, optimizedTransactions);
    }

    // 2. Priority-based reordering
    optimizedTransactions = this.reorderByPriority(batch, optimizedTransactions);

    // 3. Deadline enforcement
    if (this.config.deadlineEnforcement) {
      optimizedTransactions = this.enforceDeadlines(batch, optimizedTransactions);
    }

    // 4. Gas optimization for batch execution
    const gasOptimized = await this.optimizeBatchGas(optimizedTransactions);
    additionalSavings += gasOptimized.savings;

    return {
      transactions: gasOptimized.transactions,
      totalGasSaved: baseOptimization.totalGasSaved.add(
        BigNumber.from(Math.floor(gasOptimized.savings * 1e18))
      ),
      executionOrder: baseOptimization.executionOrder,
      noncesOptimized: baseOptimization.noncesOptimized,
      estimatedSavings: additionalSavings
    };
  }

  /**
   * Resolve transaction dependencies
   */
  private resolveDependencies(
    batch: BatchedTransaction[],
    transactions: TransactionRequest[]
  ): TransactionRequest[] {
    const dependencyGraph = new Map<number, number[]>();
    const resolved: TransactionRequest[] = [];
    const visited = new Set<number>();

    // Build dependency graph
    batch.forEach((bt, index) => {
      dependencyGraph.set(index, bt.dependencies);
    });

    // Topological sort to resolve dependencies
    const visit = (index: number): void => {
      if (visited.has(index)) return;
      
      const dependencies = dependencyGraph.get(index) || [];
      dependencies.forEach(dep => {
        if (dep < batch.length) {
          visit(dep);
        }
      });
      
      visited.add(index);
      if (index < transactions.length) {
        resolved.push(transactions[index]);
      }
    };

    // Visit all transactions
    for (let i = 0; i < batch.length; i++) {
      visit(i);
    }

    return resolved;
  }

  /**
   * Reorder transactions by priority
   */
  private reorderByPriority(
    batch: BatchedTransaction[],
    transactions: TransactionRequest[]
  ): TransactionRequest[] {
    // Create priority mapping
    const priorityMap = new Map<TransactionRequest, number>();
    batch.forEach((bt, index) => {
      if (index < transactions.length) {
        priorityMap.set(transactions[index], bt.priority);
      }
    });

    // Sort by priority (higher first)
    return transactions.sort((a, b) => {
      const priorityA = priorityMap.get(a) || 0;
      const priorityB = priorityMap.get(b) || 0;
      return priorityB - priorityA;
    });
  }

  /**
   * Enforce transaction deadlines
   */
  private enforceDeadlines(
    batch: BatchedTransaction[],
    transactions: TransactionRequest[]
  ): TransactionRequest[] {
    const now = Math.floor(Date.now() / 1000);
    const validTransactions: TransactionRequest[] = [];
    
    batch.forEach((bt, index) => {
      if (index < transactions.length) {
        // Skip expired transactions
        if (bt.deadline && bt.deadline < now) {
          console.warn(`Transaction ${index} expired, deadline: ${bt.deadline}, now: ${now}`);
          return;
        }
        validTransactions.push(transactions[index]);
      }
    });

    return validTransactions;
  }

  /**
   * Optimize gas usage for batch execution
   */
  private async optimizeBatchGas(
    transactions: TransactionRequest[]
  ): Promise<{ transactions: TransactionRequest[], savings: number }> {
    let totalSavings = 0;
    const optimizedTransactions: TransactionRequest[] = [];

    for (let i = 0; i < transactions.length; i++) {
      const tx = transactions[i];
      
      // Apply batch-specific gas optimizations
      const optimizedTx = { ...tx };
      
      // 1. Sequential nonce optimization
      if (i > 0 && tx.from === transactions[i - 1].from) {
        const prevNonce = transactions[i - 1].nonce;
        if (prevNonce !== undefined) {
          optimizedTx.nonce = prevNonce + 1;
        }
      }

      // 2. Gas price smoothing for batch consistency
      if (i > 0) {
        const prevGasPrice = transactions[i - 1].gasPrice;
        const currentGasPrice = tx.gasPrice;
        
        if (prevGasPrice && currentGasPrice) {
          // Use average gas price for better batch execution
          const avgGasPrice = prevGasPrice.add(currentGasPrice).div(2);
          optimizedTx.gasPrice = avgGasPrice;
          
          // Calculate savings
          const savings = currentGasPrice.sub(avgGasPrice);
          if (savings.gt(0)) {
            totalSavings += parseFloat(ethers.utils.formatEther(savings));
          }
        }
      }

      optimizedTransactions.push(optimizedTx);
    }

    return {
      transactions: optimizedTransactions,
      savings: totalSavings
    };
  }

  /**
   * Execute optimized batch with proper error handling
   */
  private async executeOptimizedBatch(
    transactions: TransactionRequest[],
    signer: ethers.Signer
  ): Promise<{
    transactions: TransactionResponse[];
    failures: Array<{ index: number; transaction: TransactionRequest; error: string }>;
  }> {
    const results: TransactionResponse[] = [];
    const failures: Array<{ index: number; transaction: TransactionRequest; error: string }> = [];

    if (this.config.parallelExecution && transactions.length > 1) {
      // Parallel execution
      const promises = transactions.map(async (tx, index) => {
        try {
          return await this.gasOptimizer.executeWithRetry(tx, signer);
        } catch (error) {
          failures.push({
            index,
            transaction: tx,
            error: error instanceof Error ? error.message : String(error)
          });
          return null;
        }
      });

      const responses = await Promise.allSettled(promises);
      responses.forEach((response) => {
        if (response.status === 'fulfilled' && response.value) {
          results.push(response.value);
        }
      });
    } else {
      // Sequential execution
      for (let i = 0; i < transactions.length; i++) {
        try {
          const response = await this.gasOptimizer.executeWithRetry(transactions[i], signer);
          results.push(response);
        } catch (error) {
          const failure = {
            index: i,
            transaction: transactions[i],
            error: error instanceof Error ? error.message : String(error)
          };
          failures.push(failure);

          // Fail fast if configured
          if (this.config.failFast) {
            break;
          }
        }
      }
    }

    // Retry failed transactions if configured
    if (this.config.retryFailedTransactions && failures.length > 0) {
      const retriedResults = await this.retryFailedTransactions(failures, signer);
      results.push(...retriedResults.successes);
      // Update failures list with only the permanently failed ones
      failures.splice(0, failures.length, ...retriedResults.permanentFailures);
    }

    return { transactions: results, failures };
  }

  /**
   * Retry failed transactions with adjusted parameters
   */
  private async retryFailedTransactions(
    failures: Array<{ index: number; transaction: TransactionRequest; error: string }>,
    signer: ethers.Signer
  ): Promise<{
    successes: TransactionResponse[];
    permanentFailures: Array<{ index: number; transaction: TransactionRequest; error: string }>;
  }> {
    const successes: TransactionResponse[] = [];
    const permanentFailures: Array<{ index: number; transaction: TransactionRequest; error: string }> = [];

    for (const failure of failures) {
      try {
        // Adjust transaction parameters for retry
        const adjustedTx = await this.adjustTransactionForRetry(failure.transaction, failure.error);
        const response = await this.gasOptimizer.executeWithRetry(adjustedTx, signer, 'aggressive');
        successes.push(response);
      } catch (retryError) {
        permanentFailures.push({
          ...failure,
          error: `Original: ${failure.error}, Retry: ${retryError instanceof Error ? retryError.message : String(retryError)}`
        });
      }
    }

    return { successes, permanentFailures };
  }

  /**
   * Adjust transaction parameters for retry
   */
  private async adjustTransactionForRetry(
    transaction: TransactionRequest,
    error: string
  ): Promise<TransactionRequest> {
    const adjustedTx = { ...transaction };

    if (error.includes('underpriced')) {
      // Increase gas price
      if (adjustedTx.gasPrice) {
        adjustedTx.gasPrice = adjustedTx.gasPrice.mul(150).div(100); // 50% increase
      }
      if (adjustedTx.maxFeePerGas) {
        adjustedTx.maxFeePerGas = adjustedTx.maxFeePerGas.mul(150).div(100);
      }
    }

    if (error.includes('nonce')) {
      // Refresh nonce
      const currentNonce = await signer.getTransactionCount('pending');
      adjustedTx.nonce = currentNonce;
    }

    if (error.includes('insufficient funds') || error.includes('gas')) {
      // Reduce gas limit or adjust gas price
      if (adjustedTx.gasLimit) {
        adjustedTx.gasLimit = adjustedTx.gasLimit.mul(90).div(100); // 10% reduction
      }
    }

    return adjustedTx;
  }
}