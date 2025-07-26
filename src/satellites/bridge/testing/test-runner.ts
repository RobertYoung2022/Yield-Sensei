/**
 * Test Runner
 * Main entry point for running comprehensive testing suites
 */

import Logger from '../../../shared/logging/logger';
import { BridgeTestFramework } from './bridge-test-framework';
import { IntegrationTester } from './integration-tester';
import { 
  TestEnvironment, 
  TestReport, 
  IntegrationTestConfig,
  NetworkEnvironment,
  ServiceEnvironment,
  MonitoringConfig 
} from './types';

const logger = Logger.getLogger('test-runner');

export class TestRunner {
  private testFramework: BridgeTestFramework;
  private integrationTester: IntegrationTester;
  private environment: TestEnvironment;

  constructor() {
    this.environment = this.createDefaultTestEnvironment();
    this.testFramework = new BridgeTestFramework(this.environment);
    this.integrationTester = new IntegrationTester(this.testFramework);
  }

  async initialize(): Promise<void> {
    logger.info('Initializing Bridge Satellite Test Runner');
    await this.testFramework.initialize();
    logger.info('✅ Test Runner initialized successfully');
  }

  async runFullTestSuite(): Promise<TestReport> {
    logger.info('🚀 Starting full Bridge Satellite test suite');
    
    try {
      const report = await this.integrationTester.runComprehensiveTestSuite();
      
      logger.info('✅ Full test suite completed successfully', {
        overallScore: report.summary.overallScore,
        readinessLevel: report.summary.readinessLevel,
        totalScenarios: report.scenarios.length,
      });

      // Save report to file
      await this.saveTestReport(report);
      
      return report;
    } catch (error) {
      logger.error('❌ Full test suite failed:', error);
      throw error;
    }
  }

  async runPerformanceTestsOnly(): Promise<TestReport> {
    logger.info('🏃‍♂️ Starting performance-only test suite');

    const config: IntegrationTestConfig = {
      name: 'Performance Test Suite',
      description: 'Comprehensive performance testing for Bridge Satellite',
      includePerformance: true,
      includeSecurity: false,
      includeReliability: false,
      parallelExecution: true,
      timeoutMinutes: 30,
    };

    const results = await this.integrationTester.runCustomIntegrationTest(config);
    
    const report = await this.testFramework.generateReport(
      'Bridge Satellite Performance Test Report',
      'Performance evaluation of cross-chain arbitrage system',
      results.map(r => r.scenarioId)
    );

    await this.saveTestReport(report);
    return report;
  }

  async runSecurityTestsOnly(): Promise<TestReport> {
    logger.info('🔒 Starting security-only test suite');

    const config: IntegrationTestConfig = {
      name: 'Security Test Suite',
      description: 'Comprehensive security testing for Bridge Satellite',
      includePerformance: false,
      includeSecurity: true,
      includeReliability: false,
      parallelExecution: true,
      timeoutMinutes: 45,
    };

    const results = await this.integrationTester.runCustomIntegrationTest(config);
    
    const report = await this.testFramework.generateReport(
      'Bridge Satellite Security Test Report',
      'Security evaluation of cross-chain arbitrage system',
      results.map(r => r.scenarioId)
    );

    await this.saveTestReport(report);
    return report;
  }

  async runReliabilityTestsOnly(): Promise<TestReport> {
    logger.info('🛡️ Starting reliability-only test suite');

    const config: IntegrationTestConfig = {
      name: 'Reliability Test Suite',
      description: 'Comprehensive reliability testing for Bridge Satellite',
      includePerformance: false,
      includeSecurity: false,
      includeReliability: true,
      parallelExecution: false, // Sequential for reliability tests
      timeoutMinutes: 60,
    };

    const results = await this.integrationTester.runCustomIntegrationTest(config);
    
    const report = await this.testFramework.generateReport(
      'Bridge Satellite Reliability Test Report',
      'Reliability evaluation of cross-chain arbitrage system',
      results.map(r => r.scenarioId)
    );

    await this.saveTestReport(report);
    return report;
  }

  async runCustomTestSuite(config: IntegrationTestConfig): Promise<TestReport> {
    logger.info(`🔧 Starting custom test suite: ${config.name}`);

    const results = await this.integrationTester.runCustomIntegrationTest(config);
    
    const report = await this.testFramework.generateReport(
      config.name,
      config.description,
      results.map(r => r.scenarioId)
    );

    await this.saveTestReport(report);
    return report;
  }

  async runQuickValidation(): Promise<TestReport> {
    logger.info('⚡ Starting quick validation test suite');

    const config: IntegrationTestConfig = {
      name: 'Quick Validation Suite',
      description: 'Quick validation tests for development workflow',
      includePerformance: true,
      includeSecurity: true,
      includeReliability: false,
      performanceTests: ['opportunity_capture', 'throughput'],
      securityTests: ['front_running', 'access_control'],
      parallelExecution: true,
      timeoutMinutes: 10,
    };

    const results = await this.integrationTester.runCustomIntegrationTest(config);
    
    const report = await this.testFramework.generateReport(
      'Bridge Satellite Quick Validation Report',
      'Quick validation for development workflow',
      results.map(r => r.scenarioId)
    );

    await this.saveTestReport(report);
    return report;
  }

  async runPreDeploymentChecks(): Promise<TestReport> {
    logger.info('🚀 Starting pre-deployment validation checks');

    const config: IntegrationTestConfig = {
      name: 'Pre-Deployment Validation',
      description: 'Critical validation tests before production deployment',
      includePerformance: true,
      includeSecurity: true,
      includeReliability: true,
      performanceTests: ['opportunity_capture', 'throughput', 'stress'],
      securityTests: [
        'front_running',
        'mev_attack', 
        'flash_loan',
        'bridge_exploit',
        'access_control',
      ],
      parallelExecution: false, // Sequential for thorough validation
      timeoutMinutes: 120,
    };

    const results = await this.integrationTester.runCustomIntegrationTest(config);
    
    const report = await this.testFramework.generateReport(
      'Bridge Satellite Pre-Deployment Report',
      'Critical validation for production deployment readiness',
      results.map(r => r.scenarioId)
    );

    await this.saveTestReport(report);
    
    // Log deployment readiness
    this.logDeploymentReadiness(report);
    
    return report;
  }

  async getTestStatus(): Promise<any> {
    const activeTests = this.testFramework.getActiveTests();
    const testHistory = this.testFramework.getTestHistory();
    
    return {
      activeTests: activeTests.length,
      totalTestsRun: testHistory.length,
      recentTests: testHistory.slice(-10).map(t => ({
        scenarioId: t.scenarioId,
        status: t.status,
        duration: t.endTime - t.startTime,
        timestamp: t.endTime,
      })),
      environment: this.environment.name,
    };
  }

  async stop(): Promise<void> {
    logger.info('Stopping Test Runner');
    await this.testFramework.stop();
    logger.info('✅ Test Runner stopped successfully');
  }

  // Private helper methods

  private createDefaultTestEnvironment(): TestEnvironment {
    const networks: NetworkEnvironment[] = [
      {
        chainId: 'ethereum',
        rpcUrl: 'http://localhost:8545',
        wsUrl: 'ws://localhost:8546',
        blockTime: 12000,
        gasPrice: 20,
        liquidityPools: [
          {
            dexName: 'uniswap_v3',
            pairAddress: '0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640',
            token0: 'USDC',
            token1: 'WETH',
            reserve0: '50000000',
            reserve1: '25000',
            fee: 0.3,
          },
          {
            dexName: 'sushiswap',
            pairAddress: '0x397FF1542f962076d0BFE58eA045FfA2d347ACa0',
            token0: 'USDC',
            token1: 'WETH',
            reserve0: '30000000',
            reserve1: '15000',
            fee: 0.3,
          },
        ],
      },
      {
        chainId: 'polygon',
        rpcUrl: 'http://localhost:8547',
        wsUrl: 'ws://localhost:8548',
        blockTime: 2000,
        gasPrice: 30,
        liquidityPools: [
          {
            dexName: 'quickswap',
            pairAddress: '0x853Ee4b2A13f8a742d64C8F088bE7bA2131f670d',
            token0: 'USDC',
            token1: 'WMATIC',
            reserve0: '25000000',
            reserve1: '30000000',
            fee: 0.3,
          },
        ],
      },
      {
        chainId: 'arbitrum',
        rpcUrl: 'http://localhost:8549',
        blockTime: 1000,
        gasPrice: 1,
        liquidityPools: [
          {
            dexName: 'uniswap_v3',
            pairAddress: '0xC31E54c7a869B9FcBEcc14363CF510d1c41fa443',
            token0: 'USDC',
            token1: 'WETH',
            reserve0: '20000000',
            reserve1: '10000',
            fee: 0.05,
          },
        ],
      },
    ];

    const services: ServiceEnvironment[] = [
      {
        name: 'arbitrage-engine',
        type: 'arbitrage_engine',
        config: {
          maxSlippage: 0.01,
          minProfitThreshold: 50,
          gasLimitMultiplier: 1.2,
        },
        healthEndpoint: '/health',
        metricsEndpoint: '/metrics',
      },
      {
        name: 'price-feed-manager',
        type: 'price_feed',
        config: {
          updateInterval: 1000,
          priceSources: ['chainlink', 'uniswap', 'coingecko'],
          deviationThreshold: 0.05,
        },
        healthEndpoint: '/health',
        metricsEndpoint: '/metrics',
      },
      {
        name: 'bridge-monitor',
        type: 'bridge_monitor',
        config: {
          monitoringInterval: 5000,
          alertThresholds: {
            confirmationDelay: 300000, // 5 minutes
            validatorFailure: 0.33, // 33% failure rate
          },
        },
        healthEndpoint: '/health',
        metricsEndpoint: '/metrics',
      },
      {
        name: 'liquidity-optimizer',
        type: 'liquidity_optimizer',
        config: {
          rebalanceThreshold: 0.1,
          minLiquidityRatio: 0.05,
          maxConcentration: 0.4,
        },
        healthEndpoint: '/health',
        metricsEndpoint: '/metrics',
      },
    ];

    const monitoring: MonitoringConfig = {
      enabled: true,
      interval: 5000,
      metrics: [
        'cpu_usage',
        'memory_usage',
        'network_latency',
        'transaction_throughput',
        'error_rate',
        'arbitrage_opportunities',
        'profit_margins',
      ],
      alertThresholds: [
        {
          metric: 'cpu_usage',
          condition: '>',
          value: 80,
          action: 'alert',
        },
        {
          metric: 'memory_usage',
          condition: '>',
          value: 85,
          action: 'alert',
        },
        {
          metric: 'error_rate',
          condition: '>',
          value: 5,
          action: 'stop_test',
        },
        {
          metric: 'network_latency',
          condition: '>',
          value: 5000,
          action: 'log',
        },
      ],
    };

    return {
      name: 'Bridge Satellite Test Environment',
      description: 'Comprehensive testing environment for cross-chain arbitrage system',
      networks,
      services,
      monitoring,
    };
  }

  private async saveTestReport(report: TestReport): Promise<void> {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `test-report-${timestamp}.json`;
      const filepath = `/tmp/${filename}`;

      // In a real implementation, this would save to a proper location
      logger.info(`Test report saved to ${filepath}`, {
        reportId: report.id,
        scenarios: report.scenarios.length,
        overallScore: report.summary.overallScore,
      });

      // Could also send report to monitoring systems, databases, etc.
      
    } catch (error) {
      logger.error('Failed to save test report:', error);
    }
  }

  private logDeploymentReadiness(report: TestReport): void {
    const readinessLevel = report.summary.readinessLevel;
    const overallScore = report.summary.overallScore;
    const criticalIssues = report.scenarios.reduce(
      (count, scenario) => count + scenario.issues.filter(i => i.severity === 'critical').length,
      0
    );

    logger.info('📊 Deployment Readiness Assessment', {
      readinessLevel,
      overallScore,
      criticalIssues,
      recommendation: this.getDeploymentRecommendation(readinessLevel, criticalIssues),
    });

    // Log specific recommendations
    if (readinessLevel === 'production') {
      logger.info('✅ READY FOR PRODUCTION DEPLOYMENT');
    } else if (readinessLevel === 'staging') {
      logger.warn('⚠️  STAGING READY - Minor fixes needed before production');
    } else if (readinessLevel === 'development') {
      logger.warn('🔧 DEVELOPMENT READY - Significant improvements needed');
    } else {
      logger.error('❌ NOT READY - Major issues must be resolved');
    }
  }

  private getDeploymentRecommendation(readinessLevel: string, criticalIssues: number): string {
    if (criticalIssues > 0) {
      return `BLOCK DEPLOYMENT - ${criticalIssues} critical issues must be resolved`;
    }

    switch (readinessLevel) {
      case 'production':
        return 'APPROVE DEPLOYMENT - All tests passed successfully';
      case 'staging':
        return 'CONDITIONAL APPROVAL - Minor fixes recommended before production';
      case 'development':
        return 'DEFER DEPLOYMENT - Significant improvements required';
      default:
        return 'BLOCK DEPLOYMENT - System not ready for any deployment';
    }
  }

  // Factory methods for common test configurations

  static createCICDConfig(): IntegrationTestConfig {
    return {
      name: 'CI/CD Pipeline Tests',
      description: 'Fast validation tests for continuous integration',
      includePerformance: true,
      includeSecurity: true,
      includeReliability: false,
      performanceTests: ['opportunity_capture'],
      securityTests: ['front_running', 'access_control'],
      parallelExecution: true,
      timeoutMinutes: 5,
    };
  }

  static createNightlyConfig(): IntegrationTestConfig {
    return {
      name: 'Nightly Test Suite',
      description: 'Comprehensive nightly testing for continuous validation',
      includePerformance: true,
      includeSecurity: true,
      includeReliability: true,
      parallelExecution: true,
      timeoutMinutes: 180,
    };
  }

  static createProductionValidationConfig(): IntegrationTestConfig {
    return {
      name: 'Production Validation',
      description: 'Full validation suite for production readiness',
      includePerformance: true,
      includeSecurity: true,
      includeReliability: true,
      parallelExecution: false,
      timeoutMinutes: 240,
    };
  }
}