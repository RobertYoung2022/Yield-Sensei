/**
 * Transaction Batcher
 * Intelligently batches transactions for gas optimization and timing
 */

import { EventEmitter } from 'events';
import { Logger } from 'winston';
import { createLogger, format, transports } from 'winston';
import { 
  PendingTransaction,
  TransactionBatch,
  BatchStatus,
  TransactionPriority,
  TransactionType,
  GasEstimate
} from '../types';

export interface TransactionBatcherConfig {
  maxBatchSize: number;
  minBatchSize: number;
  maxWaitTime: number; // milliseconds
  priorityWeights: Record<TransactionPriority, number>;
  gasThreshold: number; // Minimum gas savings to justify batching
  enableCrossChainBatching: boolean;
}

export interface BatchingStrategy {
  name: string;
  evaluate: (transactions: PendingTransaction[]) => number;
  group: (transactions: PendingTransaction[]) => PendingTransaction[][];
}

export interface BatchOptimizationResult {
  originalCost: bigint;
  batchedCost: bigint;
  savings: bigint;
  executionTime: Date;
  efficiency: number; // 0-1
}

export class TransactionBatcher extends EventEmitter {
  private logger: Logger;
  private config: TransactionBatcherConfig;
  private pendingTransactions: Map<string, PendingTransaction> = new Map();
  private activeBatches: Map<string, TransactionBatch> = new Map();
  private batchingStrategies: BatchingStrategy[] = [];
  private batchingTimer?: NodeJS.Timeout;

  constructor(config: TransactionBatcherConfig) {
    super();
    this.config = config;
    this.logger = createLogger({
      level: 'info',
      format: format.combine(
        format.timestamp(),
        format.printf(({ timestamp, level, message, ...meta }) => {
          return `${timestamp} [TxBatcher] ${level}: ${message} ${Object.keys(meta).length > 0 ? JSON.stringify(meta) : ''}`;
        })
      ),
      transports: [
        new transports.Console(),
        new transports.File({ filename: 'logs/transaction-batcher.log' })
      ],
    });

    this.initializeBatchingStrategies();
    this.startBatchingTimer();
  }

  private initializeBatchingStrategies(): void {
    // Strategy 1: Group by chain and priority
    this.batchingStrategies.push({
      name: 'chain_priority',
      evaluate: (txs) => this.evaluateChainPriorityStrategy(txs),
      group: (txs) => this.groupByChainAndPriority(txs)
    });

    // Strategy 2: Group by transaction type
    this.batchingStrategies.push({
      name: 'transaction_type',
      evaluate: (txs) => this.evaluateTypeStrategy(txs),
      group: (txs) => this.groupByType(txs)
    });

    // Strategy 3: Group by gas price similarity
    this.batchingStrategies.push({
      name: 'gas_similarity',
      evaluate: (txs) => this.evaluateGasSimilarityStrategy(txs),
      group: (txs) => this.groupByGasSimilarity(txs)
    });

    // Strategy 4: Mixed optimization
    this.batchingStrategies.push({
      name: 'mixed_optimization',
      evaluate: (txs) => this.evaluateMixedStrategy(txs),
      group: (txs) => this.groupByMixedStrategy(txs)
    });
  }

  addTransaction(transaction: PendingTransaction): void {
    this.logger.debug('Adding transaction to batch queue', { 
      id: transaction.id, 
      type: transaction.type,
      priority: transaction.priority 
    });

    this.pendingTransactions.set(transaction.id, transaction);
    
    // Check if we should create an immediate batch for critical transactions
    if (transaction.priority === TransactionPriority.CRITICAL) {
      this.processCriticalTransaction(transaction);
      return;
    }

    // Check if we have enough transactions to batch
    this.checkBatchingOpportunity();
  }

  async createOptimalBatches(): Promise<TransactionBatch[]> {
    const transactions = Array.from(this.pendingTransactions.values());
    
    if (transactions.length === 0) {
      return [];
    }

    this.logger.info('Creating optimal batches', { transactionCount: transactions.length });

    // Evaluate all batching strategies
    const strategyResults = await Promise.all(
      this.batchingStrategies.map(async strategy => ({
        strategy,
        score: strategy.evaluate(transactions),
        groups: strategy.group(transactions)
      }))
    );

    // Select best strategy
    const bestStrategy = strategyResults.reduce((best, current) => 
      current.score > best.score ? current : best
    );

    this.logger.info('Selected batching strategy', { 
      strategy: bestStrategy.strategy.name,
      score: bestStrategy.score 
    });

    // Create batches from best strategy
    const batches: TransactionBatch[] = [];
    
    for (const group of bestStrategy.groups) {
      if (group.length >= this.config.minBatchSize) {
        const batch = await this.createBatch(group);
        batches.push(batch);
      } else {
        // Keep small groups for next batching round
        continue;
      }
    }

    return batches;
  }

  private async createBatch(transactions: PendingTransaction[]): Promise<TransactionBatch> {
    const batchId = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Calculate optimal execution time
    const executionTime = this.calculateOptimalExecutionTime(transactions);
    
    // Estimate gas costs
    const gasEstimate = await this.estimateBatchGas(transactions);
    
    const batch: TransactionBatch = {
      id: batchId,
      transactions,
      estimatedGas: gasEstimate,
      scheduledTime: executionTime,
      status: BatchStatus.PENDING,
      savings: await this.calculateBatchSavings(transactions, gasEstimate)
    };

    this.activeBatches.set(batchId, batch);
    
    // Remove transactions from pending
    for (const tx of transactions) {
      this.pendingTransactions.delete(tx.id);
    }

    this.logger.info('Created batch', {
      id: batchId,
      size: transactions.length,
      savings: batch.savings.toString(),
      scheduledTime: executionTime.toISOString()
    });

    // Schedule batch execution
    this.scheduleBatchExecution(batch);

    return batch;
  }

  private calculateOptimalExecutionTime(transactions: PendingTransaction[]): Date {
    // Find the most restrictive deadline
    const deadlines = transactions
      .map(tx => tx.deadline)
      .filter(d => d !== undefined)
      .sort((a, b) => a!.getTime() - b!.getTime());

    const earliestDeadline = deadlines[0];
    
    // Calculate optimal timing based on priorities
    const avgPriorityWeight = transactions.reduce((sum, tx) => 
      sum + this.config.priorityWeights[tx.priority], 0) / transactions.length;

    // Higher priority = sooner execution
    const delayMultiplier = 1 - avgPriorityWeight;
    const baseDelay = this.config.maxWaitTime * delayMultiplier;
    
    const optimalTime = new Date(Date.now() + baseDelay);
    
    // Ensure we don't exceed any deadlines
    if (earliestDeadline && optimalTime > earliestDeadline) {
      return new Date(earliestDeadline.getTime() - 60000); // 1 minute buffer
    }

    return optimalTime;
  }

  private async estimateBatchGas(transactions: PendingTransaction[]): Promise<GasEstimate> {
    // Simplified gas estimation - in production would call actual gas estimator
    const chainId = transactions[0].chainId;
    const totalGasUnits = BigInt(transactions.length * 21000); // Rough estimate
    const baseFee = BigInt(50) * BigInt(1e9); // 50 gwei
    const priorityFee = BigInt(2) * BigInt(1e9); // 2 gwei
    
    // Batch efficiency bonus (10% savings for batching)
    const batchBonus = BigInt(90) / BigInt(100);
    
    return {
      chainId,
      baseFee,
      priorityFee,
      maxFeePerGas: baseFee * BigInt(2) + priorityFee,
      estimatedCost: totalGasUnits * (baseFee + priorityFee) * batchBonus,
      executionTime: Date.now(),
      confidence: 0.85
    };
  }

  private async calculateBatchSavings(
    transactions: PendingTransaction[],
    batchGasEstimate: GasEstimate
  ): Promise<bigint> {
    // Calculate cost if executed individually
    let individualCost = BigInt(0);
    for (const tx of transactions) {
      // Simplified individual cost calculation
      const gasUnits = BigInt(21000);
      const gasPrice = batchGasEstimate.baseFee + batchGasEstimate.priorityFee;
      individualCost += gasUnits * gasPrice;
    }

    return individualCost - batchGasEstimate.estimatedCost;
  }

  // Batching Strategy Implementations

  private evaluateChainPriorityStrategy(transactions: PendingTransaction[]): number {
    // Score based on chain grouping efficiency and priority distribution
    const chainGroups = this.groupByChain(transactions);
    const groupSizes = chainGroups.map(group => group.length);
    
    // Prefer larger, more uniform groups
    const avgGroupSize = groupSizes.reduce((sum, size) => sum + size, 0) / groupSizes.length;
    const sizeVariance = groupSizes.reduce((sum, size) => 
      sum + Math.pow(size - avgGroupSize, 2), 0) / groupSizes.length;
    
    return avgGroupSize * 10 - sizeVariance;
  }

  private evaluateTypeStrategy(transactions: PendingTransaction[]): number {
    // Score based on transaction type similarity
    const typeGroups = this.groupByType(transactions);
    const groupSizes = typeGroups.map(group => group.length);
    
    // Prefer more concentrated type groups
    const maxGroupSize = Math.max(...groupSizes);
    const concentration = maxGroupSize / transactions.length;
    
    return concentration * 100;
  }

  private evaluateGasSimilarityStrategy(transactions: PendingTransaction[]): number {
    // Score based on gas price similarity (mock implementation)
    // In production, would analyze actual gas requirements
    const priorities = transactions.map(tx => this.config.priorityWeights[tx.priority]);
    const avgPriority = priorities.reduce((sum, p) => sum + p, 0) / priorities.length;
    const variance = priorities.reduce((sum, p) => sum + Math.pow(p - avgPriority, 2), 0) / priorities.length;
    
    return 50 - variance * 100; // Lower variance = higher score
  }

  private evaluateMixedStrategy(transactions: PendingTransaction[]): number {
    // Combined score considering multiple factors
    const chainScore = this.evaluateChainPriorityStrategy(transactions) * 0.4;
    const typeScore = this.evaluateTypeStrategy(transactions) * 0.3;
    const gasScore = this.evaluateGasSimilarityStrategy(transactions) * 0.3;
    
    return chainScore + typeScore + gasScore;
  }

  private groupByChainAndPriority(transactions: PendingTransaction[]): PendingTransaction[][] {
    const groups = new Map<string, PendingTransaction[]>();
    
    for (const tx of transactions) {
      const key = `${tx.chainId}:${tx.priority}`;
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(tx);
    }
    
    return Array.from(groups.values());
  }

  private groupByType(transactions: PendingTransaction[]): PendingTransaction[][] {
    const groups = new Map<TransactionType, PendingTransaction[]>();
    
    for (const tx of transactions) {
      if (!groups.has(tx.type)) {
        groups.set(tx.type, []);
      }
      groups.get(tx.type)!.push(tx);
    }
    
    return Array.from(groups.values());
  }

  private groupByChain(transactions: PendingTransaction[]): PendingTransaction[][] {
    const groups = new Map<string, PendingTransaction[]>();
    
    for (const tx of transactions) {
      if (!groups.has(tx.chainId)) {
        groups.set(tx.chainId, []);
      }
      groups.get(tx.chainId)!.push(tx);
    }
    
    return Array.from(groups.values());
  }

  private groupByGasSimilarity(transactions: PendingTransaction[]): PendingTransaction[][] {
    // Group by priority as a proxy for gas requirements
    return this.groupByPriority(transactions);
  }

  private groupByPriority(transactions: PendingTransaction[]): PendingTransaction[][] {
    const groups = new Map<TransactionPriority, PendingTransaction[]>();
    
    for (const tx of transactions) {
      if (!groups.has(tx.priority)) {
        groups.set(tx.priority, []);
      }
      groups.get(tx.priority)!.push(tx);
    }
    
    return Array.from(groups.values());
  }

  private groupByMixedStrategy(transactions: PendingTransaction[]): PendingTransaction[][] {
    // Advanced grouping considering multiple factors
    const groups: PendingTransaction[][] = [];
    const processed = new Set<string>();
    
    for (const tx of transactions) {
      if (processed.has(tx.id)) continue;
      
      const group = [tx];
      processed.add(tx.id);
      
      // Find similar transactions
      for (const other of transactions) {
        if (processed.has(other.id)) continue;
        
        if (this.areTransactionsSimilar(tx, other)) {
          group.push(other);
          processed.add(other.id);
          
          if (group.length >= this.config.maxBatchSize) break;
        }
      }
      
      groups.push(group);
    }
    
    return groups;
  }

  private areTransactionsSimilar(tx1: PendingTransaction, tx2: PendingTransaction): boolean {
    // Check similarity across multiple dimensions
    const chainMatch = tx1.chainId === tx2.chainId;
    const priorityMatch = tx1.priority === tx2.priority;
    const typeMatch = tx1.type === tx2.type;
    
    // Weight different factors
    let similarityScore = 0;
    if (chainMatch) similarityScore += 0.4;
    if (priorityMatch) similarityScore += 0.3;
    if (typeMatch) similarityScore += 0.3;
    
    return similarityScore >= 0.6; // 60% similarity threshold
  }

  private processCriticalTransaction(transaction: PendingTransaction): void {
    this.logger.info('Processing critical transaction immediately', { id: transaction.id });
    
    // Create immediate single-transaction batch
    const batch: TransactionBatch = {
      id: `critical_${transaction.id}`,
      transactions: [transaction],
      estimatedGas: {
        chainId: transaction.chainId,
        baseFee: BigInt(100) * BigInt(1e9), // High priority gas
        priorityFee: BigInt(10) * BigInt(1e9),
        maxFeePerGas: BigInt(210) * BigInt(1e9),
        estimatedCost: BigInt(21000) * BigInt(110) * BigInt(1e9),
        executionTime: Date.now(),
        confidence: 0.95
      },
      scheduledTime: new Date(Date.now() + 1000), // 1 second delay
      status: BatchStatus.SCHEDULED,
      savings: BigInt(0)
    };

    this.activeBatches.set(batch.id, batch);
    this.pendingTransactions.delete(transaction.id);
    
    this.scheduleBatchExecution(batch);
  }

  private checkBatchingOpportunity(): void {
    const pendingCount = this.pendingTransactions.size;
    
    // Check if we should batch now
    if (pendingCount >= this.config.maxBatchSize) {
      this.logger.info('Maximum batch size reached, creating batches');
      this.createOptimalBatches();
    }
  }

  private startBatchingTimer(): void {
    this.batchingTimer = setInterval(() => {
      if (this.pendingTransactions.size >= this.config.minBatchSize) {
        this.createOptimalBatches();
      }
    }, this.config.maxWaitTime);
  }

  private scheduleBatchExecution(batch: TransactionBatch): void {
    const delay = batch.scheduledTime.getTime() - Date.now();
    
    setTimeout(async () => {
      await this.executeBatch(batch);
    }, Math.max(0, delay));
  }

  private async executeBatch(batch: TransactionBatch): Promise<void> {
    try {
      this.logger.info('Executing batch', { 
        id: batch.id, 
        size: batch.transactions.length 
      });

      batch.status = BatchStatus.EXECUTING;
      
      // Simulate batch execution
      await this.simulateBatchExecution(batch);
      
      batch.status = BatchStatus.COMPLETED;
      
      this.emit('batch_executed', {
        batchId: batch.id,
        transactionIds: batch.transactions.map(tx => tx.id),
        savings: batch.savings,
        executionTime: new Date()
      });
      
      this.logger.info('Batch execution completed', { 
        id: batch.id,
        savings: batch.savings.toString()
      });
      
    } catch (error) {
      this.logger.error('Batch execution failed', { id: batch.id, error });
      batch.status = BatchStatus.FAILED;
      
      // Re-queue transactions for individual execution
      for (const tx of batch.transactions) {
        this.pendingTransactions.set(tx.id, tx);
      }
    } finally {
      // Clean up completed/failed batch
      setTimeout(() => {
        this.activeBatches.delete(batch.id);
      }, 60000); // Keep for 1 minute for monitoring
    }
  }

  private async simulateBatchExecution(batch: TransactionBatch): Promise<void> {
    // Simulate execution time based on batch size
    const executionTime = Math.min(5000, batch.transactions.length * 100);
    await new Promise(resolve => setTimeout(resolve, executionTime));
  }

  getStatus(): any {
    return {
      pendingTransactions: this.pendingTransactions.size,
      activeBatches: this.activeBatches.size,
      batchingStrategies: this.batchingStrategies.map(s => s.name),
      config: this.config
    };
  }

  async shutdown(): Promise<void> {
    this.logger.info('Shutting down Transaction Batcher...');
    
    if (this.batchingTimer) {
      clearInterval(this.batchingTimer);
    }
    
    // Wait for active batches to complete
    const activeBatches = Array.from(this.activeBatches.values());
    for (const batch of activeBatches) {
      if (batch.status === BatchStatus.EXECUTING) {
        await new Promise(resolve => {
          const checkStatus = () => {
            if (batch.status === BatchStatus.COMPLETED || batch.status === BatchStatus.FAILED) {
              resolve(void 0);
            } else {
              setTimeout(checkStatus, 1000);
            }
          };
          checkStatus();
        });
      }
    }
    
    this.removeAllListeners();
  }
}