/**
 * Fuel Satellite Agent
 * Handles capital deployment, gas optimization, and logistics management
 */

import { EventEmitter } from 'events';
import { Logger } from 'winston';
import { createLogger, format, transports } from 'winston';
import { 
  FuelSatelliteConfig,
  FuelStatus,
  FuelEvent,
  PendingTransaction,
  TransactionBatch,
  GasEstimate,
  GasPrediction,
  ManagedWallet
} from './types';
import { GasOptimizationEngine, GasOptimizationEngineConfig } from './optimization/gas-optimization-engine';
import { TransactionBatcher, TransactionBatcherConfig } from './optimization/transaction-batcher';
import { TaxLossHarvester, TaxLossHarvesterConfig } from './tax/tax-loss-harvester';
import { TaxReportingEngine, TaxReportingEngineConfig } from './tax/tax-reporting-engine';
import { PortfolioRebalancer, PortfolioRebalancerConfig } from './rebalancing/portfolio-rebalancer';
import { TradeExecutor, TradeExecutorConfig } from './rebalancing/trade-executor';
import { WalletManager, WalletManagerConfig } from './wallet/wallet-manager';
import { SecurityMonitor, SecurityMonitorConfig } from './wallet/security-monitor';

export const DEFAULT_FUEL_CONFIG: FuelSatelliteConfig = {
  id: 'fuel',
  name: 'Fuel Satellite',
  version: '1.0.0',
  capitalDeployment: {
    enableAutoDeployment: true,
    riskAdjustedDeployment: true,
    deploymentInterval: 3600000, // 1 hour
    minDeploymentAmount: 100, // USD
    maxDeploymentPerProtocol: 0.2, // 20%
    maxDeploymentPerChain: 0.4, // 40%
    emergencyWithdrawalThreshold: 0.15, // 15% loss
    taxAwareDeployment: true
  },
  gasOptimization: {
    enableDynamicPricing: true,
    enableBatching: true,
    enableTiming: true,
    predictionModel: 'hybrid',
    batchingThreshold: 5,
    maxBatchDelay: 900000, // 15 minutes
    crossChainOptimization: true,
    priorityFeeStrategy: 'adaptive' as any
  },
  walletManagement: {
    enableMultiWallet: true,
    enableRotation: false,
    rotationInterval: 86400000, // 24 hours
    maxWalletsPerChain: 5,
    roleBasedAccess: true,
    anomalyDetection: true,
    backupStrategy: 'encrypted_cloud' as any,
    elizaosPlugins: ['wallet-manager', 'security-monitor']
  },
  taxOptimization: {
    enableHarvesting: true,
    enableReporting: true,
    jurisdiction: 'US',
    taxYear: new Date().getFullYear(),
    washSalePeriod: 30, // days
    minimumLoss: 100, // USD
    reportingFormat: 'json',
    automatedExecution: false
  },
  rebalancing: {
    enableAutoRebalancing: true,
    rebalanceThreshold: 0.05, // 5%
    rebalanceInterval: 86400000, // 24 hours
    strategy: 'threshold' as any,
    taxAware: true,
    minTradeSize: 50, // USD
    maxSlippage: 0.01, // 1%
    prioritizeGasEfficiency: true
  },
  integration: {
    sageIntegration: true,
    bridgeIntegration: true,
    aegisIntegration: true,
    forgeIntegration: true,
    elizaosIntegration: true
  }
};

export class FuelSatelliteAgent extends EventEmitter {
  private static instance: FuelSatelliteAgent;
  private logger: Logger;
  private config: FuelSatelliteConfig;
  private isInitialized: boolean = false;
  private isRunning: boolean = false;

  // Core components
  private gasOptimizationEngine: GasOptimizationEngine;
  private transactionBatcher: TransactionBatcher;
  private taxLossHarvester: TaxLossHarvester;
  private taxReportingEngine: TaxReportingEngine;
  private portfolioRebalancer: PortfolioRebalancer;
  private tradeExecutor: TradeExecutor;
  private walletManager: WalletManager;
  private securityMonitor: SecurityMonitor;
  
  // State management
  private managedWallets: Map<string, ManagedWallet> = new Map();
  private pendingTransactions: Map<string, PendingTransaction> = new Map();
  private activeBatches: Map<string, TransactionBatch> = new Map();
  private gasPredictions: Map<string, GasPrediction> = new Map();
  
  // Performance metrics
  private totalGasSavings: bigint = 0n;
  private transactionsProcessed: number = 0;
  private batchesExecuted: number = 0;
  private averageExecutionTime: number = 0;
  
  // Monitoring intervals
  private healthCheckInterval?: NodeJS.Timeout;
  private metricsUpdateInterval?: NodeJS.Timeout;

  private constructor(config: FuelSatelliteConfig) {
    super();
    this.config = config;
    this.logger = createLogger({
      level: 'info',
      format: format.combine(
        format.timestamp(),
        format.printf(({ timestamp, level, message, ...meta }) => {
          return `${timestamp} [Fuel] ${level}: ${message} ${Object.keys(meta).length > 0 ? JSON.stringify(meta) : ''}`;
        })
      ),
      transports: [
        new transports.Console(),
        new transports.File({ filename: 'logs/fuel-satellite.log' })
      ],
    });
  }

  static getInstance(config?: FuelSatelliteConfig): FuelSatelliteAgent {
    if (!FuelSatelliteAgent.instance && config) {
      FuelSatelliteAgent.instance = new FuelSatelliteAgent(config);
    } else if (!FuelSatelliteAgent.instance) {
      throw new Error('FuelSatelliteAgent must be initialized with config first');
    }
    return FuelSatelliteAgent.instance;
  }

  async initialize(): Promise<void> {
    try {
      this.logger.info('Initializing Fuel Satellite Agent...');

      // Initialize gas optimization engine
      await this.initializeGasOptimization();
      
      // Initialize transaction batcher
      await this.initializeTransactionBatcher();
      
      // Initialize tax optimization
      await this.initializeTaxOptimization();
      
      // Initialize portfolio rebalancing
      await this.initializePortfolioRebalancing();
      
      // Initialize wallet management
      await this.initializeWalletManagement();
      
      // Setup event handlers
      this.setupEventHandlers();
      
      // Start monitoring
      this.startHealthMonitoring();
      
      this.isInitialized = true;
      this.logger.info('Fuel Satellite Agent initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize Fuel Satellite Agent:', error);
      throw error;
    }
  }

  private async initializeGasOptimization(): Promise<void> {
    const gasConfig: GasOptimizationEngineConfig = {
      ...this.config.gasOptimization,
      historicalDataWindow: 86400000, // 24 hours
      predictionInterval: 300000, // 5 minutes
      supportedChains: [
        {
          chainId: '1',
          name: 'Ethereum',
          rpcUrl: 'https://eth-mainnet.alchemyapi.io/v2/your-api-key',
          blockTime: 12,
          eip1559: true
        },
        {
          chainId: '137',
          name: 'Polygon',
          rpcUrl: 'https://polygon-rpc.com',
          blockTime: 2,
          eip1559: true
        },
        {
          chainId: '42161',
          name: 'Arbitrum',
          rpcUrl: 'https://arb1.arbitrum.io/rpc',
          blockTime: 1,
          eip1559: true
        }
      ]
    };

    this.gasOptimizationEngine = GasOptimizationEngine.getInstance(gasConfig);
    await this.gasOptimizationEngine.initialize();
    
    this.logger.info('Gas optimization engine initialized');
  }

  private async initializeTransactionBatcher(): Promise<void> {
    const batcherConfig: TransactionBatcherConfig = {
      maxBatchSize: 20,
      minBatchSize: this.config.gasOptimization.batchingThreshold,
      maxWaitTime: this.config.gasOptimization.maxBatchDelay,
      priorityWeights: {
        critical: 1.0,
        high: 0.8,
        medium: 0.5,
        low: 0.2
      },
      gasThreshold: 1000000, // 0.001 ETH minimum savings
      enableCrossChainBatching: this.config.gasOptimization.crossChainOptimization
    };

    this.transactionBatcher = new TransactionBatcher(batcherConfig);
    this.logger.info('Transaction batcher initialized');
  }

  private async initializeTaxOptimization(): Promise<void> {
    // Initialize tax-loss harvester
    const harvesterConfig: TaxLossHarvesterConfig = {
      ...this.config.taxOptimization,
      analysisInterval: 3600000, // 1 hour
      maxOpportunitiesPerDay: 10,
      minTaxSavings: 50, // USD
      washSaleBuffer: 5, // Extra 5 days beyond legal requirement
      riskTolerance: 'moderate'
    };

    this.taxLossHarvester = new TaxLossHarvester(harvesterConfig);
    await this.taxLossHarvester.initialize();

    // Initialize tax reporting engine
    const reportingConfig: TaxReportingEngineConfig = {
      ...this.config.taxOptimization,
      outputDirectory: './tax-reports',
      templateDirectory: './tax-templates',
      encryptReports: true,
      includeAIAnalysis: true,
      complianceCheck: true
    };

    this.taxReportingEngine = new TaxReportingEngine(reportingConfig);
    await this.taxReportingEngine.initialize();
    
    this.logger.info('Tax optimization initialized');
  }

  private async initializePortfolioRebalancing(): Promise<void> {
    // Initialize portfolio rebalancer
    const rebalancerConfig: PortfolioRebalancerConfig = {
      ...this.config.rebalancing,
      analysisInterval: 3600000, // 1 hour
      maxTradesPerRebalance: 10,
      diversificationTargets: [
        {
          category: 'protocol',
          name: 'DeFi',
          targetPercentage: 0.6,
          minPercentage: 0.4,
          maxPercentage: 0.8,
          priority: 1
        },
        {
          category: 'asset_type',
          name: 'Stablecoin',
          targetPercentage: 0.3,
          minPercentage: 0.2,
          maxPercentage: 0.5,
          priority: 2
        },
        {
          category: 'chain',
          name: 'Ethereum',
          targetPercentage: 0.7,
          minPercentage: 0.5,
          maxPercentage: 0.9,
          priority: 3
        }
      ],
      correlationThreshold: 0.8,
      volatilityWindow: 30,
      performanceTrackingWindow: 90
    };

    this.portfolioRebalancer = new PortfolioRebalancer(rebalancerConfig);
    await this.portfolioRebalancer.initialize();

    // Initialize trade executor
    const executorConfig: TradeExecutorConfig = {
      maxSlippage: this.config.rebalancing.maxSlippage,
      maxGasPrice: BigInt(200e9), // 200 gwei max
      routingTimeout: 30000, // 30 seconds
      retryAttempts: 3,
      simulateFirst: true,
      enableMEVProtection: true,
      preferredDEXs: ['uniswap_v3', '1inch', 'paraswap'],
      enableCrossChain: this.config.integration.bridgeIntegration
    };

    this.tradeExecutor = new TradeExecutor(executorConfig);
    await this.tradeExecutor.initialize();
    
    this.logger.info('Portfolio rebalancing initialized');
  }

  private async initializeWalletManagement(): Promise<void> {
    // Initialize wallet manager
    const walletManagerConfig: WalletManagerConfig = {
      ...this.config.walletManagement,
      securityCheckInterval: 300000, // 5 minutes
      balanceCheckInterval: 180000, // 3 minutes
      autoRotationEnabled: this.config.walletManagement.enableRotation,
      emergencyPauseThreshold: 0.8, // High risk threshold
      encryptionLevel: 'advanced',
      auditTrailEnabled: true,
      complianceMode: 'institutional'
    };

    this.walletManager = new WalletManager(walletManagerConfig);
    await this.walletManager.initialize();

    // Initialize security monitor
    const securityConfig: SecurityMonitorConfig = {
      monitoringInterval: 60000, // 1 minute
      threatIntelligenceEnabled: true,
      behavioralAnalysisEnabled: true,
      networkAnalysisEnabled: true,
      complianceCheckEnabled: true,
      realTimeAlertsEnabled: true,
      maxAlertsPerHour: 50,
      quarantineThreshold: 0.8
    };

    this.securityMonitor = new SecurityMonitor(securityConfig);
    await this.securityMonitor.initialize();

    // Sync managed wallets from wallet manager
    const managedWallets = this.walletManager.getAllWallets();
    for (const wallet of managedWallets) {
      this.managedWallets.set(wallet.id, wallet);
    }
    
    this.logger.info('Wallet management initialized', { 
      walletCount: managedWallets.length,
      securityMonitorEnabled: true 
    });
  }

  private setupEventHandlers(): void {
    // Gas optimization events
    this.gasOptimizationEngine.on('gas_prediction_updated', (event) => {
      this.handleGasPredictionUpdate(event);
    });

    this.gasOptimizationEngine.on('batch_executed', (event) => {
      this.handleBatchExecuted(event);
    });

    // Transaction batcher events
    this.transactionBatcher.on('batch_executed', (event) => {
      this.handleBatcherExecuted(event);
    });

    // Tax harvester events
    this.taxLossHarvester.on('harvest_executed', (event) => {
      this.handleHarvestExecuted(event);
    });

    this.taxLossHarvester.on('harvest_opportunity', (event) => {
      this.handleHarvestOpportunity(event);
    });

    // Tax reporting events
    this.taxReportingEngine.on('tax_report_generated', (event) => {
      this.handleTaxReportGenerated(event);
    });

    // Portfolio rebalancer events
    this.portfolioRebalancer.on('rebalance_triggered', (event) => {
      this.handleRebalanceTriggered(event);
    });

    this.portfolioRebalancer.on('rebalance_executed', (event) => {
      this.handleRebalanceExecuted(event);
    });

    // Trade executor events
    this.tradeExecutor.on('trade_executed', (event) => {
      this.handleTradeExecuted(event);
    });

    this.tradeExecutor.on('trade_failed', (event) => {
      this.handleTradeFailed(event);
    });

    // Wallet manager events
    this.walletManager.on('wallet_created', (event) => {
      this.handleWalletCreated(event);
    });

    this.walletManager.on('wallet_rotated', (event) => {
      this.handleWalletRotated(event);
    });

    this.walletManager.on('security_alert', (event) => {
      this.handleSecurityAlert(event);
    });

    // Security monitor events
    this.securityMonitor.on('threat_detected', (event) => {
      this.handleThreatDetected(event);
    });

    this.securityMonitor.on('wallet_quarantined', (event) => {
      this.handleWalletQuarantined(event);
    });

    this.securityMonitor.on('critical_threat', (event) => {
      this.handleCriticalThreat(event);
    });
  }

  private handleGasPredictionUpdate(event: any): void {
    this.logger.debug('Gas prediction updated', { chainId: event.chainId });
    this.gasPredictions.set(event.chainId, event.prediction);
    
    // Emit fuel event
    this.emitFuelEvent({
      type: 'gas_prediction_updated' as any,
      data: event,
      timestamp: new Date(),
      severity: 'info'
    });
  }

  private handleBatchExecuted(event: any): void {
    this.logger.info('Gas optimization batch executed', { 
      batchId: event.batchId,
      savings: event.savings 
    });
    
    this.batchesExecuted++;
    this.totalGasSavings += BigInt(event.savings || 0);
    
    this.emitFuelEvent({
      type: 'batch_executed' as any,
      data: event,
      timestamp: new Date(),
      severity: 'info'
    });
  }

  private handleBatcherExecuted(event: any): void {
    this.logger.info('Transaction batch executed', { 
      batchId: event.batchId,
      transactionCount: event.transactionIds.length 
    });
    
    this.transactionsProcessed += event.transactionIds.length;
    
    this.emitFuelEvent({
      type: 'batch_executed' as any,
      data: event,
      timestamp: new Date(),
      severity: 'info'
    });
  }

  private handleHarvestExecuted(event: any): void {
    this.logger.info('Tax-loss harvest executed', {
      opportunityId: event.opportunityId,
      asset: event.asset,
      taxSavings: event.taxSavings
    });

    this.emitFuelEvent({
      type: 'harvest_executed' as any,
      data: event,
      timestamp: new Date(),
      severity: 'info'
    });
  }

  private handleHarvestOpportunity(event: any): void {
    this.logger.info('Tax-loss harvest opportunity identified', {
      asset: event.asset,
      potentialSavings: event.potentialSavings
    });

    this.emitFuelEvent({
      type: 'harvest_opportunity' as any,
      data: event,
      timestamp: new Date(),
      severity: 'info'
    });
  }

  private handleTaxReportGenerated(event: any): void {
    this.logger.info('Tax report generated', {
      reportId: event.reportId,
      taxYear: event.year
    });

    this.emitFuelEvent({
      type: 'tax_report_generated' as any,
      data: event,
      timestamp: new Date(),
      severity: 'info'
    });
  }

  private handleRebalanceTriggered(event: any): void {
    this.logger.info('Portfolio rebalance triggered', {
      drift: event.drift,
      urgency: event.urgency
    });

    this.emitFuelEvent({
      type: 'rebalance_triggered' as any,
      data: event,
      timestamp: new Date(),
      severity: 'info'
    });
  }

  private handleRebalanceExecuted(event: any): void {
    this.logger.info('Portfolio rebalance executed', {
      proposalId: event.proposalId,
      transactionCount: event.transactionCount,
      totalCost: event.totalCost
    });

    this.emitFuelEvent({
      type: 'rebalance_executed' as any,
      data: event,
      timestamp: new Date(),
      severity: 'info'
    });
  }

  private handleTradeExecuted(event: any): void {
    this.logger.info('Trade executed successfully', {
      executionId: event.executionId,
      tradeId: event.tradeId,
      actualSlippage: event.actualSlippage
    });

    this.emitFuelEvent({
      type: 'rebalance_executed' as any, // Using closest available type
      data: event,
      timestamp: new Date(),
      severity: 'info'
    });
  }

  private handleTradeFailed(event: any): void {
    this.logger.error('Trade execution failed', {
      executionId: event.executionId,
      tradeId: event.tradeId,
      error: event.error
    });

    this.emitFuelEvent({
      type: 'rebalance_failed' as any,
      data: event,
      timestamp: new Date(),
      severity: 'error'
    });
  }

  private handleWalletCreated(event: any): void {
    this.logger.info('New wallet created', {
      walletId: event.walletId,
      address: event.address,
      role: event.role,
      chain: event.chain
    });

    // Update local wallet storage
    const wallet = this.walletManager.getWallet(event.walletId);
    if (wallet) {
      this.managedWallets.set(event.walletId, wallet);
    }

    this.emitFuelEvent({
      type: 'wallet_added' as any,
      data: event,
      timestamp: new Date(),
      severity: 'info'
    });
  }

  private handleWalletRotated(event: any): void {
    this.logger.info('Wallet rotation completed', {
      rotationId: event.rotationId,
      oldWalletId: event.oldWalletId,
      newWalletId: event.newWalletId
    });

    // Update local wallet storage
    const newWallet = this.walletManager.getWallet(event.newWalletId);
    if (newWallet) {
      this.managedWallets.set(event.newWalletId, newWallet);
    }

    this.emitFuelEvent({
      type: 'wallet_rotated' as any,
      data: event,
      timestamp: new Date(),
      severity: 'info'
    });
  }

  private handleSecurityAlert(event: any): void {
    this.logger.warn('Security alert generated', {
      alertId: event.id,
      walletId: event.walletId,
      type: event.type,
      severity: event.severity
    });

    this.emitFuelEvent({
      type: 'wallet_anomaly' as any,
      data: event,
      timestamp: new Date(),
      severity: event.severity === 'critical' ? 'error' : 'warning'
    });
  }

  private handleThreatDetected(event: any): void {
    this.logger.warn('Security threat detected', {
      alertId: event.id,
      walletId: event.walletId,
      type: event.type,
      severity: event.severity
    });

    this.emitFuelEvent({
      type: 'wallet_anomaly' as any,
      data: event,
      timestamp: new Date(),
      severity: event.severity === 'critical' ? 'error' : 'warning'
    });
  }

  private handleWalletQuarantined(event: any): void {
    this.logger.error('Wallet quarantined due to security threat', {
      walletId: event.walletId,
      reason: event.reason
    });

    this.emitFuelEvent({
      type: 'wallet_anomaly' as any,
      data: event,
      timestamp: new Date(),
      severity: 'error'
    });
  }

  private handleCriticalThreat(event: any): void {
    this.logger.error('Critical security threat detected', {
      walletId: event.walletId,
      alert: event.alert,
      actionTaken: event.actionTaken
    });

    // Immediate response - pause operations for affected wallet
    // In production, would implement emergency procedures

    this.emitFuelEvent({
      type: 'wallet_anomaly' as any,
      data: event,
      timestamp: new Date(),
      severity: 'critical'
    });
  }

  private startHealthMonitoring(): void {
    this.healthCheckInterval = setInterval(() => {
      this.performHealthCheck();
    }, 60000); // Every minute

    this.metricsUpdateInterval = setInterval(() => {
      this.updateMetrics();
    }, 30000); // Every 30 seconds
  }

  private performHealthCheck(): void {
    // Check component health
    const gasEngineStatus = this.gasOptimizationEngine.getStatus();
    const batcherStatus = this.transactionBatcher.getStatus();
    
    // Log health status
    this.logger.debug('Health check completed', {
      gasEngine: gasEngineStatus.isInitialized,
      batcher: batcherStatus.pendingTransactions,
      wallets: this.managedWallets.size
    });
  }

  private updateMetrics(): void {
    // Update performance metrics
    if (this.batchesExecuted > 0) {
      // Calculate average execution time (mock)
      this.averageExecutionTime = 5000; // 5 seconds
    }
  }

  private emitFuelEvent(event: FuelEvent): void {
    this.emit('fuel_event', event);
  }

  // Public API methods

  async submitTransaction(transaction: PendingTransaction): Promise<void> {
    this.logger.info('Submitting transaction', { 
      id: transaction.id,
      type: transaction.type,
      priority: transaction.priority 
    });

    // Add to pending transactions
    this.pendingTransactions.set(transaction.id, transaction);
    
    // Add to gas optimization engine
    this.gasOptimizationEngine.addPendingTransaction(transaction);
    
    // Add to transaction batcher
    this.transactionBatcher.addTransaction(transaction);
    
    this.emitFuelEvent({
      type: 'capital_deployed' as any, // Using closest available type
      data: { transactionId: transaction.id, transaction },
      timestamp: new Date(),
      severity: 'info'
    });
  }

  async estimateGas(
    transaction: PendingTransaction,
    immediate: boolean = false
  ): Promise<GasEstimate> {
    return this.gasOptimizationEngine.estimateGas(transaction, immediate);
  }

  async predictGasPrices(chainId: string): Promise<GasPrediction> {
    return this.gasOptimizationEngine.predictGasPrices(chainId);
  }

  async optimizeTransactionTiming(
    transaction: PendingTransaction
  ): Promise<{ optimalTime: Date; estimatedSavings: bigint }> {
    return this.gasOptimizationEngine.optimizeTiming(transaction);
  }

  async createBatches(transactions: PendingTransaction[]): Promise<TransactionBatch[]> {
    // Add transactions to batcher
    for (const tx of transactions) {
      this.transactionBatcher.addTransaction(tx);
    }
    
    // Create optimal batches
    return this.transactionBatcher.createOptimalBatches();
  }

  getManagedWallets(): ManagedWallet[] {
    return Array.from(this.managedWallets.values());
  }

  async addManagedWallet(wallet: ManagedWallet): Promise<void> {
    this.managedWallets.set(wallet.id, wallet);
    
    this.logger.info('Added managed wallet', { 
      id: wallet.id,
      address: wallet.address,
      chain: wallet.chain 
    });
    
    this.emitFuelEvent({
      type: 'wallet_added' as any,
      data: { wallet },
      timestamp: new Date(),
      severity: 'info'
    });
  }

  getGasPredictions(chainId?: string): Record<string, GasPrediction> {
    if (chainId) {
      const prediction = this.gasPredictions.get(chainId);
      return prediction ? { [chainId]: prediction } : {};
    }
    
    return Object.fromEntries(this.gasPredictions.entries());
  }

  getPendingTransactions(): PendingTransaction[] {
    return Array.from(this.pendingTransactions.values());
  }

  getActiveBatches(): TransactionBatch[] {
    return Array.from(this.activeBatches.values());
  }

  // Tax optimization methods

  async analyzeTaxOpportunities(): Promise<any[]> {
    if (!this.taxLossHarvester) {
      throw new Error('Tax loss harvester not initialized');
    }
    return this.taxLossHarvester.analyzeOpportunities();
  }

  async executeTaxHarvest(opportunityId: string): Promise<any[]> {
    if (!this.taxLossHarvester) {
      throw new Error('Tax loss harvester not initialized');
    }
    return this.taxLossHarvester.executeHarvest(opportunityId);
  }

  async generateTaxReport(taxYear?: number, reportType: string = 'comprehensive'): Promise<any> {
    if (!this.taxReportingEngine) {
      throw new Error('Tax reporting engine not initialized');
    }
    return this.taxReportingEngine.generateReport(reportType, taxYear || new Date().getFullYear());
  }

  getTaxOpportunities(): any[] {
    if (!this.taxLossHarvester) {
      return [];
    }
    return this.taxLossHarvester.getOpportunities();
  }

  getTaxHarvestHistory(): any[] {
    if (!this.taxLossHarvester) {
      return [];
    }
    return this.taxLossHarvester.getHarvestHistory();
  }

  // Portfolio rebalancing methods

  async analyzeRebalanceNeed(): Promise<any> {
    if (!this.portfolioRebalancer) {
      throw new Error('Portfolio rebalancer not initialized');
    }
    return this.portfolioRebalancer.analyzeRebalanceNeed();
  }

  async generateRebalanceProposal(): Promise<any> {
    if (!this.portfolioRebalancer) {
      throw new Error('Portfolio rebalancer not initialized');
    }
    return this.portfolioRebalancer.generateRebalanceProposal();
  }

  async executeRebalance(proposalId: string): Promise<any[]> {
    if (!this.portfolioRebalancer) {
      throw new Error('Portfolio rebalancer not initialized');
    }
    
    // Get the proposal and execute trades
    const transactions = await this.portfolioRebalancer.executeRebalance(proposalId);
    
    // Process transactions through gas optimization and batching
    for (const tx of transactions) {
      await this.submitTransaction(tx);
    }
    
    return transactions;
  }

  async optimizeRebalanceForTaxes(proposalId: string): Promise<any> {
    if (!this.portfolioRebalancer) {
      throw new Error('Portfolio rebalancer not initialized');
    }
    
    const proposal = this.portfolioRebalancer.getActiveProposals().find(p => p.id === proposalId);
    if (!proposal) {
      throw new Error(`Proposal not found: ${proposalId}`);
    }
    
    return this.portfolioRebalancer.optimizeRebalanceForTaxes(proposal);
  }

  async findOptimalTradeRoute(trade: any): Promise<any[]> {
    if (!this.tradeExecutor) {
      throw new Error('Trade executor not initialized');
    }
    return this.tradeExecutor.findOptimalRoute(trade);
  }

  async simulateTrade(routes: any[]): Promise<any> {
    if (!this.tradeExecutor) {
      throw new Error('Trade executor not initialized');
    }
    return this.tradeExecutor.simulateTrade(routes);
  }

  getPortfolioSnapshot(): any {
    if (!this.portfolioRebalancer) {
      return null;
    }
    return this.portfolioRebalancer.getCurrentSnapshot();
  }

  getActiveRebalanceProposals(): any[] {
    if (!this.portfolioRebalancer) {
      return [];
    }
    return this.portfolioRebalancer.getActiveProposals();
  }

  getRebalanceHistory(): any[] {
    if (!this.portfolioRebalancer) {
      return [];
    }
    return this.portfolioRebalancer.getRebalanceHistory();
  }

  getTradeExecutions(): any[] {
    if (!this.tradeExecutor) {
      return [];
    }
    return this.tradeExecutor.getExecutionHistory();
  }

  // Wallet management methods

  async createWallet(request: any): Promise<any> {
    if (!this.walletManager) {
      throw new Error('Wallet manager not initialized');
    }
    
    const wallet = await this.walletManager.createWallet(request);
    
    // Update local storage
    this.managedWallets.set(wallet.id, wallet);
    
    return wallet;
  }

  async rotateWallet(walletId: string, reason?: string): Promise<any> {
    if (!this.walletManager) {
      throw new Error('Wallet manager not initialized');
    }
    return this.walletManager.rotateWallet(walletId, reason);
  }

  async checkWalletSecurity(walletId: string): Promise<any> {
    if (!this.walletManager) {
      throw new Error('Wallet manager not initialized');
    }
    return this.walletManager.checkWalletSecurity(walletId);
  }

  async getWalletsByRole(role: any): Promise<any[]> {
    if (!this.walletManager) {
      return [];
    }
    return this.walletManager.getWalletsByRole(role);
  }

  async getWalletsByChain(chain: string): Promise<any[]> {
    if (!this.walletManager) {
      return [];
    }
    return this.walletManager.getWalletsByChain(chain);
  }

  async getOptimalWalletForTransaction(transaction: any): Promise<any> {
    if (!this.walletManager) {
      throw new Error('Wallet manager not initialized');
    }
    return this.walletManager.getOptimalWalletForTransaction(transaction);
  }

  async assessWalletSecurity(walletId: string): Promise<any> {
    if (!this.securityMonitor) {
      throw new Error('Security monitor not initialized');
    }
    
    const wallet = this.managedWallets.get(walletId);
    if (!wallet) {
      throw new Error(`Wallet not found: ${walletId}`);
    }
    
    return this.securityMonitor.assessWalletSecurity(wallet);
  }

  async quarantineWallet(walletId: string, reason: string): Promise<void> {
    if (!this.securityMonitor) {
      throw new Error('Security monitor not initialized');
    }
    return this.securityMonitor.quarantineWallet(walletId, reason);
  }

  async releaseWalletQuarantine(walletId: string, justification: string): Promise<void> {
    if (!this.securityMonitor) {
      throw new Error('Security monitor not initialized');
    }
    return this.securityMonitor.releaseQuarantine(walletId, justification);
  }

  isWalletQuarantined(walletId: string): boolean {
    if (!this.securityMonitor) {
      return false;
    }
    return this.securityMonitor.isWalletQuarantined(walletId);
  }

  getSecurityAlerts(resolved: boolean = false): any[] {
    if (!this.walletManager) {
      return [];
    }
    return this.walletManager.getSecurityAlerts(resolved);
  }

  getWalletRotationPlans(): any[] {
    if (!this.walletManager) {
      return [];
    }
    return this.walletManager.getRotationPlans();
  }

  getWalletAuditTrail(walletId?: string): any[] {
    if (!this.walletManager) {
      return [];
    }
    return this.walletManager.getAuditTrail(walletId);
  }

  getSecurityMetrics(): any {
    if (!this.securityMonitor) {
      return {};
    }
    return this.securityMonitor.getSecurityMetrics();
  }

  getThreatIntelligence(): any {
    if (!this.securityMonitor) {
      return {};
    }
    return this.securityMonitor.getThreatIntelligence();
  }

  getQuarantinedWallets(): string[] {
    if (!this.securityMonitor) {
      return [];
    }
    return this.securityMonitor.getQuarantinedWallets();
  }

  getStatus(): FuelStatus {
    const walletBalances = Array.from(this.managedWallets.values())
      .reduce((total, wallet) => {
        const ethBalance = wallet.balance.ETH || BigInt(0);
        return total + Number(ethBalance) / 1e18; // Convert to ETH
      }, 0);

    return {
      operational: this.isRunning,
      capitalDeployed: walletBalances,
      activeWallets: this.managedWallets.size,
      pendingTransactions: this.pendingTransactions.size,
      lastRebalance: new Date(), // Mock
      taxHarvestingActive: this.config.taxOptimization.enableHarvesting,
      gasOptimizationSavings: Number(this.totalGasSavings) / 1e18, // Convert to ETH
      health: {
        overall: 'healthy',
        components: {
          capitalDeployment: {
            status: 'healthy',
            lastCheck: new Date(),
            metrics: { deployed: walletBalances }
          },
          gasOptimization: {
            status: 'healthy',
            lastCheck: new Date(),
            metrics: { 
              savings: Number(this.totalGasSavings) / 1e18,
              batchesExecuted: this.batchesExecuted 
            }
          },
          walletManagement: {
            status: 'healthy',
            lastCheck: new Date(),
            metrics: { walletCount: this.managedWallets.size }
          },
          taxOptimization: {
            status: 'healthy',
            lastCheck: new Date(),
            metrics: { enabled: this.config.taxOptimization.enableHarvesting }
          },
          rebalancing: {
            status: 'healthy',
            lastCheck: new Date(),
            metrics: { enabled: this.config.rebalancing.enableAutoRebalancing }
          }
        }
      }
    };
  }

  async start(): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('Fuel Satellite Agent not initialized');
    }

    this.logger.info('Starting Fuel Satellite Agent...');
    this.isRunning = true;
    
    this.emitFuelEvent({
      type: 'capital_deployed' as any, // Using closest available type for start event
      data: { status: 'started' },
      timestamp: new Date(),
      severity: 'info'
    });
  }

  async stop(): Promise<void> {
    this.logger.info('Stopping Fuel Satellite Agent...');
    this.isRunning = false;
    
    // Clear intervals
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    
    if (this.metricsUpdateInterval) {
      clearInterval(this.metricsUpdateInterval);
    }
    
    this.emitFuelEvent({
      type: 'capital_withdrawn' as any, // Using closest available type for stop event
      data: { status: 'stopped' },
      timestamp: new Date(),
      severity: 'info'
    });
  }

  async shutdown(): Promise<void> {
    this.logger.info('Shutting down Fuel Satellite Agent...');
    
    await this.stop();
    
    // Shutdown components
    if (this.gasOptimizationEngine) {
      await this.gasOptimizationEngine.shutdown();
    }
    
    if (this.transactionBatcher) {
      await this.transactionBatcher.shutdown();
    }

    if (this.taxLossHarvester) {
      await this.taxLossHarvester.shutdown();
    }

    if (this.taxReportingEngine) {
      await this.taxReportingEngine.shutdown();
    }

    if (this.portfolioRebalancer) {
      await this.portfolioRebalancer.shutdown();
    }

    if (this.tradeExecutor) {
      await this.tradeExecutor.shutdown();
    }

    if (this.walletManager) {
      await this.walletManager.shutdown();
    }

    if (this.securityMonitor) {
      await this.securityMonitor.shutdown();
    }
    
    // Clear state
    this.managedWallets.clear();
    this.pendingTransactions.clear();
    this.activeBatches.clear();
    this.gasPredictions.clear();
    
    this.removeAllListeners();
    this.isInitialized = false;
    
    this.logger.info('Fuel Satellite Agent shutdown complete');
  }
}