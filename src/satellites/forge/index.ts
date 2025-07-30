/**
 * Forge Satellite - Tool & Strategy Engineering
 * 
 * The Forge satellite is responsible for advanced trading execution,
 * smart contract optimization, MEV protection, and cross-chain operations
 * with microsecond precision.
 */

// Smart Contract Interaction Optimization
export { GasOptimizer, GasEstimate, NetworkConditions, GasStrategy } from './contracts/gas-optimizer';
export { TransactionBatcher, BatchedTransaction, BatchExecutionResult } from './contracts/transaction-batcher';

// MEV Protection Algorithms
export { 
  SandwichDetector, 
  SandwichAttackPattern, 
  MEVProtectionConfig, 
  TransactionAnalysis 
} from './mev/sandwich-detector';
export { 
  FlashloanArbitrageDetector, 
  FlashloanArbitrageOpportunity, 
  ArbitrageConfig,
  ArbitrageExecution 
} from './mev/flashloan-arbitrage-detector';

// Cross-Chain Bridge Optimization
export { 
  BridgeOptimizer, 
  BridgeInfo, 
  BridgeRoute, 
  RiskAssessment,
  BridgeTransaction 
} from './optimization/bridge-optimizer';

// Trading Algorithm Development
export { 
  TradingAlgorithmEngine, 
  TradingSignal, 
  TradingStrategy, 
  PerformanceMetrics,
  Position,
  ExecutionResult 
} from './trading/algorithm-engine';

// Microsecond Precision Benchmarking
export { 
  MicrosecondPrecisionBenchmarker, 
  BenchmarkResult, 
  BenchmarkMetrics,
  BenchmarkConfig 
} from './benchmarking/precision-benchmarker';

// Blockchain Network Integration
export { 
  NetworkIntegrationManager, 
  NetworkConfig, 
  NetworkStatus,
  TransactionRequest as ForgeTransactionRequest,
  ContractInteraction 
} from './blockchain/network-integration';

// Security and Performance Testing
export { 
  SecurityValidator, 
  PerformanceTester,
  SecurityTestResult,
  PerformanceTestResult,
  SecurityScanReport,
  AttackVector 
} from './security/security-validator';

/**
 * Main Forge Satellite Manager
 * Orchestrates all forge operations with microsecond precision
 */
export class ForgeSatellite {
  private gasOptimizer: GasOptimizer;
  private transactionBatcher: TransactionBatcher;
  private sandwichDetector: SandwichDetector;
  private arbitrageDetector: FlashloanArbitrageDetector;
  private bridgeOptimizer: BridgeOptimizer;
  private algorithmEngine: TradingAlgorithmEngine;
  private benchmarker: MicrosecondPrecisionBenchmarker;
  private networkManager: NetworkIntegrationManager;
  private securityValidator: SecurityValidator;
  private performanceTester: PerformanceTester;

  constructor(
    provider: any,
    config: Partial<any> = {}
  ) {
    // Initialize all forge components
    this.gasOptimizer = new GasOptimizer(provider, config.gasOptimizer);
    this.transactionBatcher = new TransactionBatcher(this.gasOptimizer, config.batcher);
    this.sandwichDetector = new SandwichDetector(provider, config.mevProtection);
    this.arbitrageDetector = new FlashloanArbitrageDetector(provider, config.arbitrage);
    this.bridgeOptimizer = new BridgeOptimizer(config.bridge);
    this.algorithmEngine = new TradingAlgorithmEngine();
    this.benchmarker = new MicrosecondPrecisionBenchmarker(config.benchmarking);
    this.networkManager = new NetworkIntegrationManager();
    this.securityValidator = new SecurityValidator();
    this.performanceTester = new PerformanceTester();
  }

  /**
   * Execute optimized transaction with full protection suite
   */
  async executeOptimizedTransaction(params: {
    transaction: any;
    signer: any;
    chainId: number;
    protection?: {
      mev: boolean;
      sandwich: boolean;
      gasOptimization: boolean;
    };
  }) {
    const { transaction, signer, chainId, protection = {} } = params;
    
    // Apply MEV protection if enabled
    if (protection.mev || protection.sandwich) {
      const analysis = await this.sandwichDetector.analyzeTransaction(transaction);
      if (analysis.mevVulnerability === 'high' || analysis.mevVulnerability === 'critical') {
        const protectedTx = await this.sandwichDetector.generateProtectedTransaction(transaction, analysis);
        transaction = protectedTx;
      }
    }

    // Apply gas optimization if enabled
    if (protection.gasOptimization !== false) {
      const gasEstimate = await this.gasOptimizer.estimateOptimalGas(transaction);
      transaction.gasLimit = gasEstimate.gasLimit;
      transaction.gasPrice = gasEstimate.gasPrice;
    }

    // Execute through network manager with retry logic
    return await this.networkManager.executeTransaction(chainId, transaction, signer);
  }

  /**
   * Run comprehensive performance and security validation
   */
  async runValidationSuite() {
    console.log('🔧 Running Forge Satellite validation suite...');
    
    const [securityReport, performanceReport] = await Promise.all([
      this.securityValidator.runSecurityScan(),
      this.performanceTester.runPerformanceTests()
    ]);

    return {
      security: securityReport,
      performance: performanceReport,
      timestamp: Date.now()
    };
  }

  /**
   * Get forge status and metrics
   */
  getStatus() {
    return {
      components: {
        gasOptimizer: 'active',
        transactionBatcher: 'active',
        sandwichDetector: 'active',
        arbitrageDetector: 'active',
        bridgeOptimizer: 'active',
        algorithmEngine: 'active',
        benchmarker: 'active',
        networkManager: 'active',
        securityValidator: 'active',
        performanceTester: 'active'
      },
      networks: this.networkManager.getAllNetworkStatus(),
      timestamp: Date.now()
    };
  }
}

export default ForgeSatellite;