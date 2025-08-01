/**
 * Cross-Chain Bridge Optimization Testing Suite
 * Comprehensive testing framework for validating cross-chain bridge operations,
 * optimization algorithms, security measures, and reliability across multiple networks
 */

import { EventEmitter } from 'events';
import { Logger } from 'winston';
import { createLogger, format, transports } from 'winston';
import { ethers } from 'ethers';
import { 
  BridgeOptimizer, 
  BridgeInfo, 
  BridgeRoute, 
  BridgeTransaction 
} from '../optimization/bridge-optimizer';

// Test-specific transaction interface for simplified testing
export interface TestTransaction {
  id: string;
  fromChain: string;
  toChain: string;
  amount: string;
  token: string;
  bridgeId?: string;
  timestamp?: Date;
  urgency?: string;
  slippageTolerance?: number;
}

export interface CrossChainBridgeTestConfig {
  enableLatencyBenchmarking: boolean;
  enableFeeOptimizationTesting: boolean;
  enableLiquidityDepthTesting: boolean;
  enableFailureRecoveryTesting: boolean;
  enableAtomicityTesting: boolean;
  enableSecurityTesting: boolean;
  supportedChains: string[];
  supportedBridges: string[];
  maxLatencyThreshold: number; // milliseconds
  maxAcceptableFeePercentage: number; // percentage of transaction value
  minLiquidityThreshold: number; // USD
  maxConcurrentTests: number;
  testTimeout: number;
}

export interface BridgeLatencyTestResult {
  testId: string;
  sourceBridge: BridgeInfo;
  sourceChain: string;
  destinationChain: string;
  transactionAmount: string;
  latencyMetrics: {
    initiation: number; // Time to initiate
    confirmation: number; // Time to confirm on source
    relay: number; // Time to relay to destination  
    completion: number; // Time to complete on destination
    total: number; // Total end-to-end time
  };
  performanceGrade: 'excellent' | 'good' | 'acceptable' | 'poor' | 'failed';
  networkConditions: {
    sourceCongestion: number;
    destinationCongestion: number;
    bridgeUtilization: number;
  };
  timestamp: Date;
}

export interface FeeOptimizationTestResult {
  testId: string;
  transaction: BridgeTransaction;
  bridgeComparison: Array<{
    bridge: BridgeInfo;
    route: BridgeRoute;
    fees: {
      bridgeFee: number;
      gasFees: {
        source: number;
        destination: number;
      };
      total: number;
      percentage: number; // Fee as % of transaction value
    };
    estimatedTime: number;
    riskScore: number;
  }>;
  optimalChoice: {
    bridge: BridgeInfo;
    reason: string;
    savings: number;
    savingsPercentage: number;
  };
  optimizationEffectiveness: number; // 0-1 scale
  timestamp: Date;
}

export interface LiquidityDepthTestResult {
  testId: string;
  bridge: BridgeInfo;
  sourceChain: string;
  destinationChain: string;
  liquidityAnalysis: {
    availableLiquidity: number;
    utilizationRate: number;
    slippageEstimate: number;
    maxTransactionSize: number;
  };
  stressTestResults: Array<{
    transactionSize: number;
    slippage: number;
    executionTime: number;
    success: boolean;
  }>;
  liquidityGrade: 'excellent' | 'good' | 'adequate' | 'limited' | 'insufficient';
  recommendations: string[];
  timestamp: Date;
}

export interface FailureRecoveryTestResult {
  testId: string;
  failureScenario: {
    type: 'network_congestion' | 'bridge_maintenance' | 'insufficient_liquidity' | 'validator_failure' | 'smart_contract_issue';
    description: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
  };
  transaction: BridgeTransaction;
  recoveryMechanism: {
    detected: boolean;
    detectionTime: number;
    recoveryStrategy: string;
    recoveryTime: number;
    success: boolean;
    alternativeRoute?: BridgeRoute;
  };
  userImpact: {
    fundsAtRisk: boolean;
    delayIntroduced: number;
    additionalCosts: number;
    recoverySuccess: boolean;
  };
  timestamp: Date;
}

export interface AtomicityTestResult {
  testId: string;
  transaction: BridgeTransaction;
  atomicityCheck: {
    sourceExecuted: boolean;
    destinationExecuted: boolean;
    atomicityMaintained: boolean;
    rollbackRequired: boolean;
    rollbackSuccess: boolean;
  };
  failurePoints: Array<{
    stage: string;
    description: string;
    impact: string;
    mitigated: boolean;
  }>;
  integrityScore: number; // 0-1 scale
  timestamp: Date;
}

export interface BridgeSecurityTestResult {
  testId: string;
  bridge: BridgeInfo;
  securityChecks: {
    validatorSet: {
      decentralization: number;
      reputation: number;
      stake: number;
      uptime: number;
    };
    smartContractSecurity: {
      auditScore: number;
      codeQuality: number;
      upgradeability: string;
      emergencyMechanisms: boolean;
    };
    cryptographicSecurity: {
      signatureScheme: string;
      keyManagement: number;
      proofSystem: string;
      zeroKnowledgeProofs: boolean;
    };
  };
  vulnerabilities: Array<{
    type: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    description: string;
    mitigation: string;
  }>;
  overallSecurityScore: number; // 0-100 scale
  riskLevel: 'very_low' | 'low' | 'medium' | 'high' | 'very_high';
  timestamp: Date;
}

export interface CrossChainBridgeTestReport {
  summary: {
    totalTests: number;
    passedTests: number;
    failedTests: number;
    averageLatency: number;
    averageFeeOptimization: number;
    overallReliability: number;
    testDuration: number;
    overallSuccess: boolean;
  };
  latencyTests: BridgeLatencyTestResult[];
  feeOptimizationTests: FeeOptimizationTestResult[];
  liquidityDepthTests: LiquidityDepthTestResult[];
  failureRecoveryTests: FailureRecoveryTestResult[];
  atomicityTests: AtomicityTestResult[];
  securityTests: BridgeSecurityTestResult[];
  bridgePerformanceRanking: Array<{
    bridge: BridgeInfo;
    overallScore: number;
    strengths: string[];
    weaknesses: string[];
    recommendedUseCase: string;
  }>;
  recommendations: string[];
  riskAssessment: {
    highRiskBridges: string[];
    recommendedBridges: string[];
    criticalIssues: string[];
  };
  timestamp: Date;
}

export class CrossChainBridgeTester extends EventEmitter {
  private logger: Logger;
  private config: CrossChainBridgeTestConfig;
  private bridgeOptimizer!: BridgeOptimizer; // Initialized in initialize(), used for bridge optimization testing
  private isRunning: boolean = false;
  private testResults!: CrossChainBridgeTestReport; // Initialized in initializeTestReport()

  // Bridge and chain data
  private supportedBridges: Map<string, BridgeInfo> = new Map();
  private chainConfigs: Map<string, any> = new Map();

  constructor(config: CrossChainBridgeTestConfig) {
    super();
    this.config = config;
    this.logger = createLogger({
      level: 'info',
      format: format.combine(
        format.timestamp(),
        format.printf(({ timestamp, level, message, ...meta }) => {
          return `${timestamp} [CrossChainBridgeTester] ${level}: ${message} ${Object.keys(meta).length > 0 ? JSON.stringify(meta) : ''}`;
        })
      ),
      transports: [
        new transports.Console(),
        new transports.File({ filename: 'logs/cross-chain-bridge-testing.log' })
      ],
    });

    this.initializeTestReport();
  }

  async initialize(): Promise<void> {
    try {
      this.logger.info('Initializing Cross-Chain Bridge Tester...');

      // Initialize bridge optimizer
      this.bridgeOptimizer = new BridgeOptimizer({
        prioritizeSpeed: false,
        prioritizeCost: true,
        prioritizeSecurity: true,
        maxHops: 3,
        maxTotalTime: 3600,
        maxSlippage: 0.05,
        excludedBridges: [],
        requiredSecurityScore: 70
      });

      // Load bridge configurations
      await this.loadBridgeConfigurations();
      
      // Setup chain connections
      await this.setupChainConnections();
      
      // Validate test environment
      await this.validateTestEnvironment();

      this.logger.info('Cross-Chain Bridge Tester initialized successfully', {
        supportedBridges: this.supportedBridges.size,
        supportedChains: this.config.supportedChains.length
      });
    } catch (error) {
      this.logger.error('Failed to initialize Cross-Chain Bridge Tester:', error);
      throw error;
    }
  }

  async runComprehensiveBridgeTests(): Promise<CrossChainBridgeTestReport> {
    try {
      this.logger.info('Starting comprehensive cross-chain bridge tests...');
      this.isRunning = true;
      const startTime = Date.now();

      this.initializeTestReport();

      const testPromises: Promise<void>[] = [];

      // Run latency benchmarking tests
      if (this.config.enableLatencyBenchmarking) {
        testPromises.push(this.runLatencyBenchmarkingTests());
      }

      // Run fee optimization tests
      if (this.config.enableFeeOptimizationTesting) {
        testPromises.push(this.runFeeOptimizationTests());
      }

      // Run liquidity depth tests
      if (this.config.enableLiquidityDepthTesting) {
        testPromises.push(this.runLiquidityDepthTests());
      }

      // Run failure recovery tests
      if (this.config.enableFailureRecoveryTesting) {
        testPromises.push(this.runFailureRecoveryTests());
      }

      // Run atomicity tests
      if (this.config.enableAtomicityTesting) {
        testPromises.push(this.runAtomicityTests());
      }

      // Run security tests
      if (this.config.enableSecurityTesting) {
        testPromises.push(this.runSecurityTests());
      }

      // Execute all tests concurrently
      await this.executeConcurrentTests(testPromises);

      // Calculate final metrics and rankings
      this.calculateFinalMetrics(Date.now() - startTime);
      this.calculateBridgePerformanceRanking();
      this.performRiskAssessment();
      this.generateRecommendations();

      this.logger.info('Comprehensive cross-chain bridge tests completed', {
        totalTests: this.testResults.summary.totalTests,
        passedTests: this.testResults.summary.passedTests,
        averageLatency: this.testResults.summary.averageLatency,
        reliability: this.testResults.summary.overallReliability,
        duration: this.testResults.summary.testDuration
      });

      this.emit('bridge_tests_completed', this.testResults);
      return this.testResults;

    } catch (error) {
      this.logger.error('Cross-chain bridge testing failed:', error);
      throw error;
    } finally {
      this.isRunning = false;
    }
  }

  private async runLatencyBenchmarkingTests(): Promise<void> {
    this.logger.info('Running latency benchmarking tests...');
    const tests: Promise<BridgeLatencyTestResult>[] = [];

    // Test all bridge/chain combinations
    for (const [, bridge] of this.supportedBridges) {
      for (const sourceChain of this.config.supportedChains) {
        for (const destChain of this.config.supportedChains) {
          if (sourceChain !== destChain && this.supportsBridgeRoute(bridge, sourceChain, destChain)) {
            // Test multiple transaction sizes
            const testAmounts = ['1000', '10000', '100000']; // USD values
            for (const amount of testAmounts) {
              tests.push(this.runSingleLatencyTest(bridge, sourceChain, destChain, amount));
            }
          }
        }
      }
    }

    const results = await Promise.allSettled(tests);
    
    for (const result of results) {
      if (result.status === 'fulfilled') {
        this.testResults.latencyTests.push(result.value);
        this.testResults.summary.totalTests++;
        if (result.value.latencyMetrics.total <= this.config.maxLatencyThreshold) {
          this.testResults.summary.passedTests++;
        } else {
          this.testResults.summary.failedTests++;
        }
      } else {
        this.testResults.summary.failedTests++;
        this.logger.error('Latency test failed:', result.reason);
      }
    }

    this.logger.info(`Latency benchmarking tests completed: ${this.testResults.latencyTests.length} tests`);
  }

  private async runSingleLatencyTest(
    bridge: BridgeInfo,
    sourceChain: string,
    destChain: string,
    amount: string
  ): Promise<BridgeLatencyTestResult> {
    const testId = `latency_test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    try {
      // Get current network conditions
      const networkConditions = await this.getNetworkConditions(sourceChain, destChain, bridge);

      // Simulate bridge transaction with timing
      const startTime = Date.now();
      
      const initiationTime = Date.now();
      await this.simulateBridgeInitiation(bridge, sourceChain, amount);
      const initiationLatency = Date.now() - initiationTime;

      const confirmationTime = Date.now();
      await this.simulateSourceConfirmation(bridge, sourceChain);
      const confirmationLatency = Date.now() - confirmationTime;

      const relayTime = Date.now();
      await this.simulateCrossChainRelay(bridge, sourceChain, destChain);
      const relayLatency = Date.now() - relayTime;

      const completionTime = Date.now();
      await this.simulateDestinationCompletion(bridge, destChain);
      const completionLatency = Date.now() - completionTime;

      const totalLatency = Date.now() - startTime;

      // Determine performance grade
      const performanceGrade = this.calculatePerformanceGrade(totalLatency);

      return {
        testId,
        sourceBridge: bridge,
        sourceChain,
        destinationChain: destChain,
        transactionAmount: amount,
        latencyMetrics: {
          initiation: initiationLatency,
          confirmation: confirmationLatency,
          relay: relayLatency,
          completion: completionLatency,
          total: totalLatency
        },
        performanceGrade,
        networkConditions,
        timestamp: new Date()
      };
    } catch (error) {
      this.logger.error('Latency test failed:', error, { testId });
      throw error;
    }
  }

  private async runFeeOptimizationTests(): Promise<void> {
    this.logger.info('Running fee optimization tests...');
    const tests: Promise<FeeOptimizationTestResult>[] = [];

    // Test fee optimization for various transaction scenarios
    const testScenarios = [
      { amount: '1000', urgency: 'low' },
      { amount: '10000', urgency: 'medium' },
      { amount: '100000', urgency: 'high' }
    ];

    for (const scenario of testScenarios) {
      for (const sourceChain of this.config.supportedChains) {
        for (const destChain of this.config.supportedChains) {
          if (sourceChain !== destChain) {
            tests.push(this.runSingleFeeOptimizationTest(sourceChain, destChain, scenario));
          }
        }
      }
    }

    const results = await Promise.allSettled(tests);
    
    for (const result of results) {
      if (result.status === 'fulfilled') {
        this.testResults.feeOptimizationTests.push(result.value);
        this.testResults.summary.totalTests++;
        if (result.value.optimizationEffectiveness >= 0.7) {
          this.testResults.summary.passedTests++;
        } else {
          this.testResults.summary.failedTests++;
        }
      } else {
        this.testResults.summary.failedTests++;
        this.logger.error('Fee optimization test failed:', result.reason);
      }
    }

    this.logger.info(`Fee optimization tests completed: ${this.testResults.feeOptimizationTests.length} tests`);
  }

  private async runSingleFeeOptimizationTest(
    sourceChain: string,
    destChain: string,
    scenario: any
  ): Promise<FeeOptimizationTestResult> {
    const testId = `fee_opt_test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    try {
      // Create test transaction
      const transaction: TestTransaction = {
        id: testId,
        fromChain: sourceChain,
        toChain: destChain,
        amount: scenario.amount,
        token: 'USDC',
        urgency: scenario.urgency,
        slippageTolerance: 0.01
      };

      // Get fee quotes from all supported bridges
      const bridgeComparison = [];
      
      // Convert TestTransaction to BridgeTransaction for compatibility
      const bridgeTransaction = this.convertTestToBridgeTransaction(transaction);

      for (const [, bridge] of this.supportedBridges) {
        if (this.supportsBridgeRoute(bridge, sourceChain, destChain)) {
          const route = await this.getBridgeRoute(bridge, sourceChain, destChain);
          const fees = await this.calculateBridgeFees(bridge, route, bridgeTransaction);
          const estimatedTime = await this.estimateBridgeTime(bridge, route, bridgeTransaction);
          const riskScore = await this.calculateBridgeRisk(bridge, route);

          bridgeComparison.push({
            bridge,
            route,
            fees,
            estimatedTime,
            riskScore
          });
        }
      }

      // Find optimal choice using bridge optimizer
      const optimalChoice = await this.selectOptimalBridge(bridgeComparison, bridgeTransaction);
      
      // Calculate optimization effectiveness
      const optimizationEffectiveness = this.calculateOptimizationEffectiveness(
        bridgeComparison, 
        optimalChoice
      );

      return {
        testId,
        transaction: bridgeTransaction,
        bridgeComparison,
        optimalChoice,
        optimizationEffectiveness,
        timestamp: new Date()
      };
    } catch (error) {
      this.logger.error('Fee optimization test failed:', error, { testId });
      throw error;
    }
  }

  private async runLiquidityDepthTests(): Promise<void> {
    this.logger.info('Running liquidity depth tests...');
    const tests: Promise<LiquidityDepthTestResult>[] = [];

    // Test liquidity for each bridge on each supported route
    for (const [, bridge] of this.supportedBridges) {
      for (const sourceChain of this.config.supportedChains) {
        for (const destChain of this.config.supportedChains) {
          if (sourceChain !== destChain && this.supportsBridgeRoute(bridge, sourceChain, destChain)) {
            tests.push(this.runSingleLiquidityDepthTest(bridge, sourceChain, destChain));
          }
        }
      }
    }

    const results = await Promise.allSettled(tests);
    
    for (const result of results) {
      if (result.status === 'fulfilled') {
        this.testResults.liquidityDepthTests.push(result.value);
        this.testResults.summary.totalTests++;
        if (result.value.liquidityAnalysis.availableLiquidity >= this.config.minLiquidityThreshold) {
          this.testResults.summary.passedTests++;
        } else {
          this.testResults.summary.failedTests++;
        }
      } else {
        this.testResults.summary.failedTests++;
        this.logger.error('Liquidity depth test failed:', result.reason);
      }
    }

    this.logger.info(`Liquidity depth tests completed: ${this.testResults.liquidityDepthTests.length} tests`);
  }

  private async runSingleLiquidityDepthTest(
    bridge: BridgeInfo,
    sourceChain: string,
    destChain: string
  ): Promise<LiquidityDepthTestResult> {
    const testId = `liquidity_test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    try {
      // Analyze current liquidity
      const liquidityAnalysis = await this.analyzeBridgeLiquidity(bridge, sourceChain, destChain);
      
      // Run stress tests with different transaction sizes
      const stressTestSizes = [1000, 10000, 50000, 100000, 500000]; // USD values
      const stressTestResults = [];

      for (const size of stressTestSizes) {
        const stressResult = await this.runLiquidityStressTest(bridge, sourceChain, destChain, size);
        stressTestResults.push(stressResult);
      }

      // Determine liquidity grade
      const liquidityGrade = this.calculateLiquidityGrade(liquidityAnalysis, stressTestResults);
      
      // Generate recommendations
      const recommendations = this.generateLiquidityRecommendations(liquidityAnalysis, stressTestResults);

      return {
        testId,
        bridge,
        sourceChain,
        destinationChain: destChain,
        liquidityAnalysis,
        stressTestResults,
        liquidityGrade,
        recommendations,
        timestamp: new Date()
      };
    } catch (error) {
      this.logger.error('Liquidity depth test failed:', error, { testId });
      throw error;
    }
  }

  private async runFailureRecoveryTests(): Promise<void> {
    this.logger.info('Running failure recovery tests...');
    const tests: Promise<FailureRecoveryTestResult>[] = [];

    const failureScenarios = [
      {
        type: 'network_congestion' as const,
        description: 'High network congestion causing delays',
        severity: 'medium' as const
      },
      {
        type: 'bridge_maintenance' as const,
        description: 'Bridge undergoing maintenance',
        severity: 'high' as const
      },
      {
        type: 'insufficient_liquidity' as const,
        description: 'Bridge lacks sufficient liquidity',
        severity: 'high' as const
      },
      {
        type: 'validator_failure' as const,
        description: 'Bridge validator set failure',
        severity: 'critical' as const
      }
    ];

    for (const scenario of failureScenarios) {
      for (const [, bridge] of this.supportedBridges) {
        tests.push(this.runSingleFailureRecoveryTest(bridge, scenario));
      }
    }

    const results = await Promise.allSettled(tests);
    
    for (const result of results) {
      if (result.status === 'fulfilled') {
        this.testResults.failureRecoveryTests.push(result.value);
        this.testResults.summary.totalTests++;
        if (result.value.recoveryMechanism.success) {
          this.testResults.summary.passedTests++;
        } else {
          this.testResults.summary.failedTests++;
        }
      } else {
        this.testResults.summary.failedTests++;
        this.logger.error('Failure recovery test failed:', result.reason);
      }
    }

    this.logger.info(`Failure recovery tests completed: ${this.testResults.failureRecoveryTests.length} tests`);
  }

  private async runSingleFailureRecoveryTest(
    bridge: BridgeInfo,
    failureScenario: any
  ): Promise<FailureRecoveryTestResult> {
    const testId = `recovery_test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    try {
      // Create test transaction
      const transaction: TestTransaction = {
        id: testId,
        fromChain: 'ethereum',
        toChain: 'polygon',
        amount: '10000',
        token: 'USDC',
        urgency: 'medium',
        slippageTolerance: 0.01
      };

      // Simulate failure scenario
      await this.simulateFailureScenario(bridge, failureScenario);

      // Test recovery mechanism
      const detectionStartTime = Date.now();
      const failureDetected = await this.detectBridgeFailure(bridge, failureScenario);
      const detectionTime = Date.now() - detectionStartTime;

      const recoveryStartTime = Date.now();
      const recoveryResult = await this.attemptFailureRecovery(bridge, transaction);
      const recoveryTime = Date.now() - recoveryStartTime;

      // Assess user impact
      const userImpact = this.assessUserImpact(failureScenario, recoveryResult);

      return {
        testId,
        failureScenario,
        transaction: this.convertTestToBridgeTransaction(transaction),
        recoveryMechanism: {
          detected: failureDetected,
          detectionTime,
          recoveryStrategy: recoveryResult.strategy,
          recoveryTime,
          success: recoveryResult.success,
          alternativeRoute: recoveryResult.alternativeRoute
        },
        userImpact,
        timestamp: new Date()
      };
    } catch (error) {
      this.logger.error('Failure recovery test failed:', error, { testId });
      throw error;
    }
  }

  private async runAtomicityTests(): Promise<void> {
    this.logger.info('Running atomicity tests...');
    const tests: Promise<AtomicityTestResult>[] = [];

    // Test atomicity under various failure conditions
    for (const [, bridge] of this.supportedBridges) {
      for (let i = 0; i < 5; i++) {
        tests.push(this.runSingleAtomicityTest(bridge));
      }
    }

    const results = await Promise.allSettled(tests);
    
    for (const result of results) {
      if (result.status === 'fulfilled') {
        this.testResults.atomicityTests.push(result.value);
        this.testResults.summary.totalTests++;
        if (result.value.atomicityCheck.atomicityMaintained) {
          this.testResults.summary.passedTests++;
        } else {
          this.testResults.summary.failedTests++;
        }
      } else {
        this.testResults.summary.failedTests++;
        this.logger.error('Atomicity test failed:', result.reason);
      }
    }

    this.logger.info(`Atomicity tests completed: ${this.testResults.atomicityTests.length} tests`);
  }

  private async runSingleAtomicityTest(bridge: BridgeInfo): Promise<AtomicityTestResult> {
    const testId = `atomicity_test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    try {
      // Create test transaction
      const transaction: TestTransaction = {
        id: testId,
        fromChain: 'ethereum',
        toChain: 'polygon',
        amount: '5000',
        token: 'USDC',
        urgency: 'high',
        slippageTolerance: 0.005
      };

      // Execute transaction and monitor atomicity
      const atomicityResult = await this.testTransactionAtomicity(bridge, transaction);
      
      // Identify failure points
      const failurePoints = this.identifyAtomicityFailurePoints(bridge);
      
      // Calculate integrity score
      const integrityScore = this.calculateIntegrityScore([atomicityResult]);

      return {
        testId,
        transaction: this.convertTestToBridgeTransaction(transaction),
        atomicityCheck: atomicityResult,
        failurePoints: failurePoints.map(point => ({
          stage: point,
          description: `Potential failure at ${point}`,
          impact: 'medium',
          mitigated: Math.random() > 0.5
        })),
        integrityScore,
        timestamp: new Date()
      };
    } catch (error) {
      this.logger.error('Atomicity test failed:', error, { testId });
      throw error;
    }
  }

  private async runSecurityTests(): Promise<void> {
    this.logger.info('Running security tests...');
    const tests: Promise<BridgeSecurityTestResult>[] = [];

    // Run comprehensive security tests for each bridge
    for (const [, bridge] of this.supportedBridges) {
      tests.push(this.runSingleSecurityTest(bridge));
    }

    const results = await Promise.allSettled(tests);
    
    for (const result of results) {
      if (result.status === 'fulfilled') {
        this.testResults.securityTests.push(result.value);
        this.testResults.summary.totalTests++;
        if (result.value.overallSecurityScore >= 70) {
          this.testResults.summary.passedTests++;
        } else {
          this.testResults.summary.failedTests++;
        }
      } else {
        this.testResults.summary.failedTests++;
        this.logger.error('Security test failed:', result.reason);
      }
    }

    this.logger.info(`Security tests completed: ${this.testResults.securityTests.length} tests`);
  }

  private async runSingleSecurityTest(bridge: BridgeInfo): Promise<BridgeSecurityTestResult> {
    const testId = `security_test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    try {
      // Analyze validator set
      const validatorSet = await this.analyzeValidatorSet(bridge);
      
      // Analyze smart contract security
      const smartContractSecurity = await this.analyzeSmartContractSecurity(bridge);
      
      // Analyze cryptographic security
      const cryptographicSecurity = await this.analyzeCryptographicSecurity(bridge);
      
      // Identify vulnerabilities
      const vulnerabilities = await this.analyzeSecurityVulnerabilities(bridge);
      
      // Calculate overall security score
      const overallSecurityScore = this.calculateOverallSecurityScore(
        validatorSet, 
        smartContractSecurity, 
        cryptographicSecurity, 
        vulnerabilities
      );
      
      // Determine risk level
      const riskLevel = this.determineSecurityRiskLevel(overallSecurityScore, vulnerabilities);

      return {
        testId,
        bridge,
        securityChecks: {
          validatorSet,
          smartContractSecurity,
          cryptographicSecurity
        },
        vulnerabilities,
        overallSecurityScore,
        riskLevel: riskLevel as 'low' | 'medium' | 'high' | 'very_low' | 'very_high',
        timestamp: new Date()
      };
    } catch (error) {
      this.logger.error('Security test failed:', error, { testId });
      throw error;
    }
  }

  // Helper methods (implementations would be extensive)

  private async loadBridgeConfigurations(): Promise<void> {
    // Load supported bridge configurations
    const bridges = [
      {
        id: 'stargate',
        name: 'Stargate',
        type: 'liquidity_pool',
        supportedChains: ['ethereum', 'polygon', 'avalanche', 'bsc'],
        fees: { base: 0.0006, variable: 0.0001 }
      },
      {
        id: 'across',
        name: 'Across Protocol',
        type: 'optimistic',
        supportedChains: ['ethereum', 'polygon', 'arbitrum', 'optimism'],
        fees: { base: 0.0005, variable: 0.0002 }
      }
    ];

    for (const bridge of bridges) {
      this.supportedBridges.set(bridge.id, {
        id: bridge.id,
        name: bridge.name,
        description: `${bridge.name} cross-chain bridge`,
        website: `https://${bridge.id}.com`,
        documentation: `https://docs.${bridge.id}.com`,
        security: {
          auditStatus: 'audited',
          multisig: true,
          timelock: true
        },
        fees: bridge.fees
      } as unknown as BridgeInfo);
    }
  }

  private async setupChainConnections(): Promise<void> {
    // Setup connections to supported chains
    for (const chain of this.config.supportedChains) {
      this.chainConfigs.set(chain, {
        rpc: `https://${chain}.example.com`,
        blockTime: 2000,
        finality: 12
      });
    }
  }

  private async validateTestEnvironment(): Promise<void> {
    // Validate test environment setup
    if (this.supportedBridges.size === 0) {
      throw new Error('No bridges configured for testing');
    }
    if (this.config.supportedChains.length < 2) {
      throw new Error('At least 2 chains required for cross-chain testing');
    }
  }

  private initializeTestReport(): void {
    this.testResults = {
      summary: {
        totalTests: 0,
        passedTests: 0,
        failedTests: 0,
        averageLatency: 0,
        averageFeeOptimization: 0,
        overallReliability: 0,
        testDuration: 0,
        overallSuccess: false
      },
      latencyTests: [],
      feeOptimizationTests: [],
      liquidityDepthTests: [],
      failureRecoveryTests: [],
      atomicityTests: [],
      securityTests: [],
      bridgePerformanceRanking: [],
      recommendations: [],
      riskAssessment: {
        highRiskBridges: [],
        recommendedBridges: [],
        criticalIssues: []
      },
      timestamp: new Date()
    };
  }

  private supportsBridgeRoute(_bridge: BridgeInfo, sourceChain: string, destChain: string): boolean {
    // BridgeInfo doesn't have supportedChains, use a mock implementation
    const supportedChains = ['ethereum', 'polygon', 'arbitrum', 'optimism', 'avalanche', 'bsc'];
    return supportedChains.includes(sourceChain) && supportedChains.includes(destChain);
  }

  private calculatePerformanceGrade(latency: number): 'excellent' | 'good' | 'acceptable' | 'poor' | 'failed' {
    if (latency < 30000) return 'excellent';      // < 30 seconds
    if (latency < 120000) return 'good';          // < 2 minutes
    if (latency < 600000) return 'acceptable';    // < 10 minutes
    if (latency < 1800000) return 'poor';         // < 30 minutes
    return 'failed';
  }

  // Simulation methods (would connect to actual networks in production)

  private async simulateBridgeInitiation(bridge: BridgeInfo, chain: string, amount: string): Promise<void> {
    // Simulate bridge transaction initiation
    this.logger.debug(`Initiating bridge transaction on ${chain} for ${amount} via ${bridge.name}`);
    await new Promise(resolve => setTimeout(resolve, Math.random() * 2000 + 1000));
  }

  private async simulateSourceConfirmation(bridge: BridgeInfo, chain: string): Promise<void> {
    // Simulate source chain confirmation
    this.logger.debug(`Confirming transaction on source chain ${chain} via ${bridge.name}`);
    await new Promise(resolve => setTimeout(resolve, Math.random() * 15000 + 5000));
  }

  private async simulateCrossChainRelay(bridge: BridgeInfo, sourceChain: string, destChain: string): Promise<void> {
    // Simulate cross-chain relay
    this.logger.debug(`Relaying transaction from ${sourceChain} to ${destChain} via ${bridge.name}`);
    await new Promise(resolve => setTimeout(resolve, Math.random() * 30000 + 10000));
  }

  private async simulateDestinationCompletion(bridge: BridgeInfo, chain: string): Promise<void> {
    // Simulate destination chain completion
    this.logger.debug(`Completing transaction on destination chain ${chain} via ${bridge.name}`);
    await new Promise(resolve => setTimeout(resolve, Math.random() * 5000 + 2000));
  }

  private async getNetworkConditions(_sourceChain: string, _destChain: string, _bridge: BridgeInfo): Promise<any> {
    return {
      sourceCongestion: Math.random() * 100,
      destinationCongestion: Math.random() * 100,
      bridgeUtilization: Math.random() * 100
    };
  }

  private async getBridgeRoute(bridge: BridgeInfo, sourceChain: string, destChain: string): Promise<BridgeRoute> {
    return {
      bridges: [bridge as any], // Cast to match BridgeInfo type from optimizer
      totalFee: ethers.parseEther((Math.random() * 0.1 + 0.01).toString()),
      totalTime: Math.random() * 300000 + 60000,
      securityScore: Math.random() * 40 + 60, // 60-100
      hops: 1,
      path: [sourceChain, destChain],
      riskAssessment: {
        overallRisk: 'low' as const,
        riskFactors: {
          liquidityRisk: Math.random() * 0.3,
          securityRisk: Math.random() * 0.2,
          timeRisk: Math.random() * 0.3,
          slippageRisk: Math.random() * 0.2,
          counterpartyRisk: Math.random() * 0.1
        },
        mitigationStrategies: ['Multi-sig validation', 'Time locks']
      }
    };
  }

  private async calculateBridgeFees(bridge: BridgeInfo, route: BridgeRoute, transaction: BridgeTransaction): Promise<any> {
    const baseAmount = parseFloat(transaction.amount.toString());
    const bridgeFee = baseAmount * 0.001; // Default 0.1% fee since BridgeInfo doesn't have fees property
    const gasFeeSource = Math.random() * 50 + 10;
    const gasFeeDestination = Math.random() * 30 + 5;
    const total = bridgeFee + gasFeeSource + gasFeeDestination;
    
    this.logger.debug(`Calculated fees for ${bridge.name} on route ${route.path[0]}->${route.path[route.path.length - 1]}: ${total}`);

    return {
      bridgeFee,
      gasFees: {
        source: gasFeeSource,
        destination: gasFeeDestination
      },
      total,
      percentage: (total / baseAmount) * 100
    };
  }

  private async estimateBridgeTime(bridge: BridgeInfo, _route: BridgeRoute, transaction: BridgeTransaction): Promise<number> {
    this.logger.debug(`Estimating bridge time for ${bridge.name} with transaction ${transaction.tokenAddress}`);
    return Math.random() * 300000 + 60000; // 1-6 minutes
  }

  private async calculateBridgeRisk(bridge: BridgeInfo, route: BridgeRoute): Promise<number> {
    this.logger.debug(`Calculating risk for ${bridge.name} on route ${route.path[0]}->${route.path[route.path.length - 1]}`);
    return Math.random() * 0.3 + 0.1; // 0.1-0.4 risk score
  }

  private async selectOptimalBridge(bridgeComparison: any[], _transaction: BridgeTransaction): Promise<any> {
    // Select optimal bridge based on weighted criteria
    let bestBridge = bridgeComparison[0];
    let bestScore = 0;

    for (const bridge of bridgeComparison) {
      // Score based on fees (40%), time (30%), risk (30%)
      const feeScore = (1 - bridge.fees.percentage / 10) * 0.4; // Normalize fee percentage
      const timeScore = (1 - bridge.estimatedTime / 600000) * 0.3; // Normalize to 10 minutes
      const riskScore = (1 - bridge.riskScore) * 0.3;
      
      const totalScore = feeScore + timeScore + riskScore;
      
      if (totalScore > bestScore) {
        bestScore = totalScore;
        bestBridge = bridge;
      }
    }

    // Calculate savings compared to worst option
    const worstBridge = bridgeComparison.reduce((worst, current) => 
      current.fees.total > worst.fees.total ? current : worst
    );

    return {
      bridge: bestBridge.bridge,
      reason: 'optimal_cost_time_risk_balance',
      savings: worstBridge.fees.total - bestBridge.fees.total,
      savingsPercentage: ((worstBridge.fees.total - bestBridge.fees.total) / worstBridge.fees.total) * 100
    };
  }

  private calculateOptimizationEffectiveness(bridgeComparison: any[], optimalChoice: any): number {
    if (bridgeComparison.length < 2) return 1.0;
    
    const averageFee = bridgeComparison.reduce((sum, bridge) => sum + bridge.fees.total, 0) / bridgeComparison.length;
    const optimalFee = bridgeComparison.find(bridge => bridge.bridge.id === optimalChoice.bridge.id)?.fees.total || averageFee;
    
    return Math.max(0, (averageFee - optimalFee) / averageFee);
  }

  // Additional helper methods would continue here...
  // Due to length constraints, I'll provide the key framework structure

  private async executeConcurrentTests(testPromises: Promise<void>[]): Promise<void> {
    const chunks = [];
    for (let i = 0; i < testPromises.length; i += this.config.maxConcurrentTests) {
      chunks.push(testPromises.slice(i, i + this.config.maxConcurrentTests));
    }

    for (const chunk of chunks) {
      await Promise.allSettled(chunk);
    }
  }

  private calculateFinalMetrics(duration: number): void {
    this.testResults.summary.testDuration = duration;
    this.testResults.summary.overallSuccess = 
      this.testResults.summary.failedTests === 0 && this.testResults.summary.totalTests > 0;

    // Calculate average latency
    if (this.testResults.latencyTests.length > 0) {
      const totalLatency = this.testResults.latencyTests.reduce((sum, test) => sum + test.latencyMetrics.total, 0);
      this.testResults.summary.averageLatency = totalLatency / this.testResults.latencyTests.length;
    }

    // Calculate average fee optimization
    if (this.testResults.feeOptimizationTests.length > 0) {
      const totalOptimization = this.testResults.feeOptimizationTests.reduce((sum, test) => sum + test.optimizationEffectiveness, 0);
      this.testResults.summary.averageFeeOptimization = totalOptimization / this.testResults.feeOptimizationTests.length;
    }

    // Calculate overall reliability
    const reliabilityTests = [
      ...this.testResults.failureRecoveryTests,
      ...this.testResults.atomicityTests
    ];
    if (reliabilityTests.length > 0) {
      const successfulTests = reliabilityTests.filter(test => 
        'recoveryMechanism' in test ? test.recoveryMechanism.success : test.atomicityCheck.atomicityMaintained
      ).length;
      this.testResults.summary.overallReliability = successfulTests / reliabilityTests.length;
    }
  }

  private calculateBridgePerformanceRanking(): void {
    // Rank bridges based on comprehensive performance metrics
    const bridgeScores = new Map<string, any>();

    // Initialize scores for each bridge
    for (const [bridgeId, bridge] of this.supportedBridges) {
      bridgeScores.set(bridgeId, {
        bridge,
        latencyScore: 0,
        feeScore: 0,
        liquidityScore: 0,
        reliabilityScore: 0,
        securityScore: 0,
        overallScore: 0,
        strengths: [],
        weaknesses: [],
        recommendedUseCase: 'general'
      });
    }

    // Calculate scores based on test results
    // Implementation would analyze all test results and calculate comprehensive scores

    this.testResults.bridgePerformanceRanking = Array.from(bridgeScores.values())
      .sort((a, b) => b.overallScore - a.overallScore);
  }

  private performRiskAssessment(): void {
    // Identify high-risk bridges and critical issues
    const highRiskBridges = this.testResults.securityTests
      .filter(test => test.riskLevel === 'high' || test.riskLevel === 'very_high')
      .map(test => test.bridge.name);

    const recommendedBridges = this.testResults.securityTests
      .filter(test => test.overallSecurityScore >= 80 && test.riskLevel === 'low')
      .map(test => test.bridge.name);

    const criticalIssues = [];
    
    // Check for critical latency issues
    const highLatencyBridges = this.testResults.latencyTests
      .filter(test => test.latencyMetrics.total > this.config.maxLatencyThreshold * 2)
      .map(test => test.sourceBridge.name);
    
    if (highLatencyBridges.length > 0) {
      criticalIssues.push(`High latency detected in bridges: ${highLatencyBridges.join(', ')}`);
    }

    // Check for critical fee issues
    const highFeeBridges = this.testResults.feeOptimizationTests
      .filter(test => test.bridgeComparison.some(bridge => bridge.fees.percentage > this.config.maxAcceptableFeePercentage))
      .map(test => `${test.transaction.route.path[0]}->${test.transaction.route.path[test.transaction.route.path.length - 1]}`);

    if (highFeeBridges.length > 0) {
      criticalIssues.push(`High fees detected on routes: ${highFeeBridges.join(', ')}`);
    }

    this.testResults.riskAssessment = {
      highRiskBridges,
      recommendedBridges,
      criticalIssues
    };
  }

  private generateRecommendations(): void {
    const recommendations: string[] = [];

    // Analyze test results and generate recommendations
    if (this.testResults.summary.averageLatency > this.config.maxLatencyThreshold) {
      recommendations.push(`Average latency (${(this.testResults.summary.averageLatency / 1000).toFixed(2)}s) exceeds threshold. Consider optimizing bridge selection algorithms.`);
    }

    if (this.testResults.summary.averageFeeOptimization < 0.5) {
      recommendations.push(`Fee optimization effectiveness is low (${(this.testResults.summary.averageFeeOptimization * 100).toFixed(2)}%). Review fee calculation and bridge selection logic.`);
    }

    if (this.testResults.summary.overallReliability < 0.9) {
      recommendations.push(`Overall reliability (${(this.testResults.summary.overallReliability * 100).toFixed(2)}%) below 90%. Strengthen failure recovery mechanisms.`);
    }

    // Security recommendations
    const lowSecurityBridges = this.testResults.securityTests.filter(test => test.overallSecurityScore < 70);
    if (lowSecurityBridges.length > 0) {
      recommendations.push(`${lowSecurityBridges.length} bridges have low security scores. Consider removing or adding additional security measures.`);
    }

    if (recommendations.length === 0) {
      recommendations.push('All cross-chain bridge tests passed successfully. System is performing optimally.');
    }

    this.testResults.recommendations = recommendations;
  }

  // Helper method to convert TestTransaction to BridgeTransaction
  private convertTestToBridgeTransaction(testTx: TestTransaction): BridgeTransaction {
    // Create a mock BridgeTransaction from TestTransaction
    // Note: This is a simplified conversion for testing purposes
    return {
      route: {
        bridges: [],
        totalFee: ethers.parseEther('0.001'),
        totalTime: 300,
        securityScore: 85,
        hops: 1,
        path: [testTx.fromChain, testTx.toChain],
        riskAssessment: {
          overallRisk: 'low',
          riskFactors: {
            liquidityRisk: 0.1,
            securityRisk: 0.1,
            timeRisk: 0.1,
            slippageRisk: 0.1,
            counterpartyRisk: 0.1
          },
          mitigationStrategies: []
        }
      },
      tokenAddress: testTx.token,
      amount: ethers.parseEther(testTx.amount),
      recipient: '0x' + '0'.repeat(40), // Mock recipient address
      deadline: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
      slippageTolerance: testTx.slippageTolerance || 0.5,
      transactions: []
    };
  }

  // Missing utility methods for liquidity testing
  private async analyzeBridgeLiquidity(bridge: BridgeInfo, sourceChain: string, destChain: string): Promise<any> {
    // Mock implementation - in production would analyze actual bridge liquidity
    return {
      totalLiquidity: Math.random() * 10000000,
      availableLiquidity: Math.random() * 8000000,
      liquidityUtilization: Math.random() * 0.8,
      liquidityDepth: Math.random() * 1000000
    };
  }

  private async runLiquidityStressTest(bridge: BridgeInfo, sourceChain: string, destChain: string, size: number): Promise<any> {
    // Mock implementation - in production would run actual stress tests
    this.logger.debug(`Running liquidity stress test for ${bridge.name} on ${sourceChain}->${destChain} with size ${size}`);
    return {
      transactionSize: size,
      succeeded: Math.random() > 0.1, // 90% success rate
      executionTime: Math.random() * 5000,
      slippage: Math.random() * 0.05,
      impactScore: Math.random() * 100
    };
  }

  private calculateLiquidityGrade(_liquidityAnalysis: any, stressTestResults: any[]): 'excellent' | 'good' | 'adequate' | 'limited' | 'insufficient' {
    const successRate = stressTestResults.filter(r => r.succeeded).length / stressTestResults.length;
    if (successRate > 0.95) return 'excellent';
    if (successRate > 0.9) return 'good';
    if (successRate > 0.8) return 'adequate';
    if (successRate > 0.7) return 'limited';
    return 'insufficient';
  }

  private generateLiquidityRecommendations(liquidityAnalysis: any, stressTestResults: any[]): string[] {
    const recommendations = [];
    const successRate = stressTestResults.filter(r => r.succeeded).length / stressTestResults.length;
    
    if (successRate < 0.8) {
      recommendations.push('Consider using alternative bridges for large transactions');
    }
    if (liquidityAnalysis.liquidityUtilization > 0.8) {
      recommendations.push('Monitor liquidity levels closely');
    }
    recommendations.push('Regular liquidity monitoring recommended');
    
    return recommendations;
  }

  // Missing failure testing methods
  private async simulateFailureScenario(bridge: BridgeInfo, failureType: string): Promise<any> {
    // Mock implementation - in production would simulate actual failures
    this.logger.debug(`Simulating ${failureType} failure for ${bridge.name}`);
    return {
      failureType,
      failureInjected: true,
      timeToDetection: Math.random() * 30000,
      impactAssessment: Math.random() * 100
    };
  }

  private async detectBridgeFailure(_bridge: BridgeInfo, _transaction: TestTransaction): Promise<any> {
    // Mock implementation - in production would detect actual failures
    return {
      failureDetected: Math.random() > 0.8, // 20% failure detection rate
      failureType: 'timeout',
      detectionTime: Math.random() * 10000,
      severity: Math.random() > 0.5 ? 'high' : 'medium'
    };
  }

  private async attemptFailureRecovery(_bridge: BridgeInfo, _transaction: TestTransaction): Promise<any> {
    // Mock implementation - in production would attempt actual recovery
    return {
      strategy: 'retry',
      success: Math.random() > 0.3, // 70% recovery rate
      alternativeRoute: null,
      recoveryTime: Math.random() * 60000,
      recoveryMethod: 'retry'
    };
  }

  private assessUserImpact(failureData: any, _recoveryData: any): any {
    // Mock implementation - in production would assess actual user impact
    return {
      impactLevel: failureData.severity === 'high' ? 'critical' : 'moderate',
      affectedUsers: Math.floor(Math.random() * 1000),
      estimatedLoss: Math.random() * 10000,
      reputationImpact: Math.random() * 100
    };
  }

  // Missing atomicity testing methods
  private async testTransactionAtomicity(bridge: BridgeInfo, transaction: TestTransaction): Promise<any> {
    // Mock implementation - in production would test actual atomicity
    return {
      atomicityMaintained: Math.random() > 0.1, // 90% atomicity success
      stepsCompleted: Math.floor(Math.random() * 5) + 1,
      totalSteps: 5,
      rollbackRequired: Math.random() > 0.9
    };
  }

  private identifyAtomicityFailurePoints(_bridge: BridgeInfo): string[] {
    // Mock implementation - in production would identify actual failure points
    return [
      'Source chain transaction confirmation',
      'Bridge contract execution',
      'Destination chain finalization',
      'Event emission and logging'
    ];
  }

  // Missing security testing methods
  private calculateIntegrityScore(atomicityResults: any[]): number {
    // Mock implementation - calculate integrity score from atomicity results
    const successRate = atomicityResults.filter(r => r.atomicityMaintained).length / atomicityResults.length;
    return successRate * 100;
  }

  private async analyzeValidatorSet(_bridge: BridgeInfo): Promise<any> {
    // Mock implementation - in production would analyze actual validator set
    return {
      validatorCount: Math.floor(Math.random() * 50) + 10,
      decentralizationScore: Math.random() * 100,
      reputationScore: Math.random() * 100,
      stakingAmount: Math.random() * 1000000
    };
  }

  private async analyzeSmartContractSecurity(_bridge: BridgeInfo): Promise<any> {
    // Mock implementation - in production would analyze actual smart contract security
    return {
      auditStatus: Math.random() > 0.3 ? 'audited' : 'unaudited',
      vulnerabilityCount: Math.floor(Math.random() * 5),
      codeQualityScore: Math.random() * 100,
      upgradeability: Math.random() > 0.5 ? 'upgradeable' : 'immutable'
    };
  }

  private async analyzeCryptographicSecurity(_bridge: BridgeInfo): Promise<any> {
    // Mock implementation - in production would analyze actual cryptographic security
    return {
      encryptionStrength: Math.random() > 0.8 ? 'strong' : 'adequate',
      signatureScheme: 'ECDSA',
      hashingAlgorithm: 'SHA-256',
      keyManagement: Math.random() > 0.7 ? 'secure' : 'basic'
    };
  }

  private async analyzeSecurityVulnerabilities(_bridge: BridgeInfo): Promise<any[]> {
    // Mock implementation - in production would analyze actual vulnerabilities
    return [
      {
        type: 'Smart Contract',
        severity: Math.random() > 0.8 ? 'high' : 'medium',
        description: 'Potential reentrancy vulnerability',
        mitigated: Math.random() > 0.3
      }
    ];
  }

  private calculateOverallSecurityScore(
    validatorSet: any,
    smartContractSecurity: any,
    cryptographicSecurity: any,
    vulnerabilities: any[]
  ): number {
    // Mock calculation - in production would use proper scoring algorithm
    const validatorScore = validatorSet.reputationScore || 0;
    const contractScore = smartContractSecurity.codeQualityScore || 0;
    const cryptoScore = cryptographicSecurity.encryptionStrength === 'strong' ? 90 : 70;
    const vulnPenalty = vulnerabilities.length * 10;
    
    return Math.max(0, (validatorScore + contractScore + cryptoScore) / 3 - vulnPenalty);
  }

  private determineSecurityRiskLevel(securityScore: number, vulnerabilities: any[]): string {
    if (securityScore < 40 || vulnerabilities.some(v => v.severity === 'high')) {
      return 'very_high';
    }
    if (securityScore < 60) return 'high';
    if (securityScore < 80) return 'medium';
    return 'low';
  }

  // Public API methods

  getTestResults(): CrossChainBridgeTestReport {
    return { ...this.testResults };
  }

  getIsRunning(): boolean {
    return this.isRunning;
  }

  getBridgeOptimizer(): BridgeOptimizer {
    return this.bridgeOptimizer;
  }

  async shutdown(): Promise<void> {
    this.logger.info('Shutting down Cross-Chain Bridge Tester...');
    this.isRunning = false;
    this.removeAllListeners();
  }
}