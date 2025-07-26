/**
 * Integration Tester
 * Combines performance and security testing for comprehensive system validation
 */

import Logger from '../../../shared/logging/logger';
import { BridgeTestFramework } from './bridge-test-framework';
import { PerformanceTester } from './performance-tester';
import { SecurityTester } from './security-tester';
import { 
  TestScenario, 
  TestResult, 
  IntegrationTestConfig,
  TestReport,
  TestEnvironment 
} from './types';

const logger = Logger.getLogger('integration-tester');

export class IntegrationTester {
  private testFramework: BridgeTestFramework;
  private performanceTester: PerformanceTester;
  private securityTester: SecurityTester;

  constructor(testFramework: BridgeTestFramework) {
    this.testFramework = testFramework;
    this.performanceTester = new PerformanceTester(testFramework);
    this.securityTester = new SecurityTester(testFramework);
  }

  async runComprehensiveTestSuite(): Promise<TestReport> {
    logger.info('Starting comprehensive integration test suite');

    try {
      // Run all test categories in parallel where possible
      const [
        performanceResults,
        securityResults,
        reliabilityResults,
        endToEndResults,
      ] = await Promise.all([
        this.runPerformanceTestSuite(),
        this.runSecurityTestSuite(),
        this.runReliabilityTestSuite(),
        this.runEndToEndTestSuite(),
      ]);

      const allResults = [
        ...performanceResults,
        ...securityResults,
        ...reliabilityResults,
        ...endToEndResults,
      ];

      // Generate comprehensive report
      const report = await this.testFramework.generateReport(
        'Comprehensive Bridge Satellite Test Report',
        'Complete performance, security, and reliability testing of cross-chain arbitrage system',
        allResults.map(r => r.scenarioId)
      );

      // Add integration-specific analysis
      const integrationAnalysis = await this.analyzeIntegrationResults(allResults);
      
      const enhancedReport = {
        ...report,
        integrationAnalysis,
        readinessAssessment: this.assessProductionReadiness(allResults),
        riskAssessment: this.assessOverallRisk(allResults),
        deploymentRecommendations: this.generateDeploymentRecommendations(allResults),
      };

      logger.info('Comprehensive test suite completed', {
        totalScenarios: allResults.length,
        overallScore: report.summary.overallScore,
        readinessLevel: report.summary.readinessLevel,
      });

      return enhancedReport;

    } catch (error) {
      logger.error('Comprehensive test suite failed:', error);
      throw error;
    }
  }

  async runPerformanceTestSuite(): Promise<TestResult[]> {
    logger.info('Running performance test suite');

    const results = await Promise.all([
      this.performanceTester.runOpportunityCaptureTest(),
      this.performanceTester.runThroughputTest(),
      this.performanceTester.runStressTest(),
      ...await this.performanceTester.runLatencyBenchmark(),
      ...await this.performanceTester.runRealWorldScenarios(),
    ]);

    return results;
  }

  async runSecurityTestSuite(): Promise<TestResult[]> {
    logger.info('Running security test suite');

    return this.securityTester.runComprehensiveSecuritySuite();
  }

  async runReliabilityTestSuite(): Promise<TestResult[]> {
    logger.info('Running reliability test suite');

    const reliabilityScenarios = [
      this.createNetworkFailureScenario(),
      this.createHighLatencyScenario(),
      this.createPartialNodeFailureScenario(),
      this.createDataCorruptionScenario(),
      this.createCascadingFailureScenario(),
    ];

    const results: TestResult[] = [];
    for (const scenario of reliabilityScenarios) {
      const result = await this.testFramework.runScenario(scenario);
      results.push(result);
    }

    return results;
  }

  async runEndToEndTestSuite(): Promise<TestResult[]> {
    logger.info('Running end-to-end test suite');

    const e2eScenarios = [
      this.createCompleteArbitrageFlowScenario(),
      this.createMultiChainCoordinationScenario(),
      this.createHighVolumeArbitrageScenario(),
      this.createEmergencyShutdownScenario(),
      this.createConfigurationUpdateScenario(),
    ];

    const results: TestResult[] = [];
    for (const scenario of e2eScenarios) {
      const result = await this.testFramework.runScenario(scenario);
      results.push(result);
    }

    return results;
  }

  async runCustomIntegrationTest(config: IntegrationTestConfig): Promise<TestResult[]> {
    logger.info(`Running custom integration test: ${config.name}`);

    const results: TestResult[] = [];

    // Run performance tests if specified
    if (config.includePerformance) {
      if (config.performanceTests?.length) {
        for (const testType of config.performanceTests) {
          const result = await this.runSpecificPerformanceTest(testType);
          results.push(result);
        }
      } else {
        const performanceResults = await this.runPerformanceTestSuite();
        results.push(...performanceResults);
      }
    }

    // Run security tests if specified
    if (config.includeSecurity) {
      if (config.securityTests?.length) {
        for (const testType of config.securityTests) {
          const result = await this.runSpecificSecurityTest(testType);
          results.push(result);
        }
      } else {
        const securityResults = await this.runSecurityTestSuite();
        results.push(...securityResults);
      }
    }

    // Run reliability tests if specified
    if (config.includeReliability) {
      const reliabilityResults = await this.runReliabilityTestSuite();
      results.push(...reliabilityResults);
    }

    return results;
  }

  // Private helper methods

  private async runSpecificPerformanceTest(testType: string): Promise<TestResult> {
    switch (testType) {
      case 'opportunity_capture':
        return this.performanceTester.runOpportunityCaptureTest();
      case 'throughput':
        return this.performanceTester.runThroughputTest();
      case 'stress':
        return this.performanceTester.runStressTest();
      default:
        throw new Error(`Unknown performance test type: ${testType}`);
    }
  }

  private async runSpecificSecurityTest(testType: string): Promise<TestResult> {
    switch (testType) {
      case 'front_running':
        return this.securityTester.testFrontRunningProtection();
      case 'mev_attack':
        return this.securityTester.testMEVAttackPrevention();
      case 'flash_loan':
        return this.securityTester.testFlashLoanAttacks();
      case 'bridge_exploit':
        return this.securityTester.testBridgeExploits();
      case 'oracle_manipulation':
        return this.securityTester.testOracleManipulation();
      case 'slippage_attack':
        return this.securityTester.testSlippageAttacks();
      case 'reentrancy':
        return this.securityTester.testReentrancyAttacks();
      case 'access_control':
        return this.securityTester.testAccessControlViolations();
      case 'denial_of_service':
        return this.securityTester.testDenialOfServiceAttacks();
      case 'data_exposure':
        return this.securityTester.testDataExposureVulnerabilities();
      default:
        throw new Error(`Unknown security test type: ${testType}`);
    }
  }

  private createNetworkFailureScenario(): TestScenario {
    return {
      id: 'network_failure_resilience',
      name: 'Network Failure Resilience Test',
      description: 'Tests system behavior during network connectivity issues',
      type: 'reliability',
      priority: 'high',
      estimatedDuration: 300000, // 5 minutes
      requirements: [
        {
          type: 'network',
          description: 'System should maintain functionality during network issues',
          minValue: 95, // 95% uptime during network issues
          unit: 'percentage',
        },
      ],
      parameters: {
        duration: 300000,
        networkConditions: [
          {
            chainId: 'ethereum',
            latency: 5000, // High latency
            bandwidth: 10, // Low bandwidth
            packetLoss: 5, // 5% packet loss
            availability: 80, // 80% availability
          },
        ],
      },
    };
  }

  private createHighLatencyScenario(): TestScenario {
    return {
      id: 'high_latency_performance',
      name: 'High Latency Performance Test',
      description: 'Tests system performance under high network latency conditions',
      type: 'reliability',
      priority: 'medium',
      estimatedDuration: 240000, // 4 minutes
      requirements: [
        {
          type: 'latency',
          description: 'Maintain reasonable response times under high latency',
          maxValue: 5000, // Max 5 seconds
          unit: 'milliseconds',
        },
      ],
      parameters: {
        duration: 240000,
        networkConditions: [
          {
            chainId: 'ethereum',
            latency: 2000,
            bandwidth: 100,
            packetLoss: 1,
            availability: 99,
          },
          {
            chainId: 'polygon',
            latency: 1500,
            bandwidth: 100,
            packetLoss: 1,
            availability: 99,
          },
        ],
      },
    };
  }

  private createPartialNodeFailureScenario(): TestScenario {
    return {
      id: 'partial_node_failure',
      name: 'Partial Node Failure Recovery Test',
      description: 'Tests system recovery when some blockchain nodes become unavailable',
      type: 'reliability',
      priority: 'high',
      estimatedDuration: 420000, // 7 minutes
      requirements: [
        {
          type: 'network',
          description: 'System should failover to backup nodes',
          minValue: 90,
          unit: 'percentage',
        },
      ],
      parameters: {
        duration: 420000,
        transactionVolume: 100,
      },
    };
  }

  private createDataCorruptionScenario(): TestScenario {
    return {
      id: 'data_corruption_recovery',
      name: 'Data Corruption Recovery Test',
      description: 'Tests system behavior when encountering corrupted price data',
      type: 'reliability',
      priority: 'high',
      estimatedDuration: 180000, // 3 minutes
      requirements: [
        {
          type: 'network',
          description: 'System should detect and recover from data corruption',
          minValue: 95,
          unit: 'percentage',
        },
      ],
      parameters: {
        duration: 180000,
        errorThreshold: 1, // 1% error rate acceptable
      },
    };
  }

  private createCascadingFailureScenario(): TestScenario {
    return {
      id: 'cascading_failure_prevention',
      name: 'Cascading Failure Prevention Test',
      description: 'Tests system resilience against cascading failures',
      type: 'reliability',
      priority: 'critical',
      estimatedDuration: 600000, // 10 minutes
      requirements: [
        {
          type: 'network',
          description: 'System should prevent cascading failures',
          minValue: 85,
          unit: 'percentage',
        },
      ],
      parameters: {
        duration: 600000,
        transactionVolume: 200,
        concurrentUsers: 50,
      },
    };
  }

  private createCompleteArbitrageFlowScenario(): TestScenario {
    return {
      id: 'complete_arbitrage_flow',
      name: 'Complete Arbitrage Flow Test',
      description: 'End-to-end test of complete arbitrage opportunity execution',
      type: 'integration',
      priority: 'critical',
      estimatedDuration: 120000, // 2 minutes
      requirements: [
        {
          type: 'latency',
          description: 'Complete flow execution time',
          maxValue: 2000, // Under 2 seconds
          unit: 'milliseconds',
        },
      ],
      parameters: {
        duration: 120000,
        transactionVolume: 10,
        targetLatency: 2000,
      },
    };
  }

  private createMultiChainCoordinationScenario(): TestScenario {
    return {
      id: 'multi_chain_coordination',
      name: 'Multi-Chain Coordination Test',
      description: 'Tests coordination across multiple blockchain networks',
      type: 'integration',
      priority: 'high',
      estimatedDuration: 300000, // 5 minutes
      requirements: [
        {
          type: 'network',
          description: 'Successful multi-chain coordination',
          minValue: 95,
          unit: 'percentage',
        },
      ],
      parameters: {
        duration: 300000,
        transactionVolume: 50,
        concurrentUsers: 20,
      },
    };
  }

  private createHighVolumeArbitrageScenario(): TestScenario {
    return {
      id: 'high_volume_arbitrage',
      name: 'High Volume Arbitrage Test',
      description: 'Tests system performance under high arbitrage volumes',
      type: 'integration',
      priority: 'high',
      estimatedDuration: 480000, // 8 minutes
      requirements: [
        {
          type: 'network',
          description: 'Minimum throughput under high volume',
          minValue: 25, // 25 TPS
          unit: 'transactions per second',
        },
      ],
      parameters: {
        duration: 480000,
        transactionVolume: 12000, // 25 TPS for 8 minutes
        concurrentUsers: 100,
      },
    };
  }

  private createEmergencyShutdownScenario(): TestScenario {
    return {
      id: 'emergency_shutdown',
      name: 'Emergency Shutdown Test',
      description: 'Tests emergency shutdown procedures and recovery',
      type: 'integration',
      priority: 'critical',
      estimatedDuration: 240000, // 4 minutes
      requirements: [
        {
          type: 'network',
          description: 'Safe shutdown and recovery',
          minValue: 100,
          unit: 'percentage',
        },
      ],
      parameters: {
        duration: 240000,
        transactionVolume: 20,
      },
    };
  }

  private createConfigurationUpdateScenario(): TestScenario {
    return {
      id: 'configuration_update',
      name: 'Configuration Update Test',
      description: 'Tests hot configuration updates without service interruption',
      type: 'integration',
      priority: 'medium',
      estimatedDuration: 180000, // 3 minutes
      requirements: [
        {
          type: 'network',
          description: 'Configuration updates without downtime',
          minValue: 99,
          unit: 'percentage',
        },
      ],
      parameters: {
        duration: 180000,
        transactionVolume: 30,
      },
    };
  }

  private async analyzeIntegrationResults(results: TestResult[]): Promise<any> {
    const performanceResults = results.filter(r => r.scenarioId.includes('performance') || r.scenarioId.includes('latency') || r.scenarioId.includes('throughput'));
    const securityResults = results.filter(r => r.scenarioId.includes('security') || r.scenarioId.includes('attack'));
    const reliabilityResults = results.filter(r => r.scenarioId.includes('reliability') || r.scenarioId.includes('failure'));
    const integrationResults = results.filter(r => r.scenarioId.includes('integration') || r.scenarioId.includes('e2e'));

    return {
      performance: {
        totalTests: performanceResults.length,
        passedTests: performanceResults.filter(r => r.status === 'passed').length,
        averageScore: this.calculateAverageScore(performanceResults),
        keyMetrics: this.extractKeyPerformanceMetrics(performanceResults),
      },
      security: {
        totalTests: securityResults.length,
        passedTests: securityResults.filter(r => r.status === 'passed').length,
        averageScore: this.calculateAverageScore(securityResults),
        vulnerabilities: this.extractSecurityVulnerabilities(securityResults),
      },
      reliability: {
        totalTests: reliabilityResults.length,
        passedTests: reliabilityResults.filter(r => r.status === 'passed').length,
        averageScore: this.calculateAverageScore(reliabilityResults),
        recoveryMetrics: this.extractReliabilityMetrics(reliabilityResults),
      },
      integration: {
        totalTests: integrationResults.length,
        passedTests: integrationResults.filter(r => r.status === 'passed').length,
        averageScore: this.calculateAverageScore(integrationResults),
        endToEndMetrics: this.extractIntegrationMetrics(integrationResults),
      },
    };
  }

  private assessProductionReadiness(results: TestResult[]): any {
    const totalTests = results.length;
    const passedTests = results.filter(r => r.status === 'passed').length;
    const failedTests = results.filter(r => r.status === 'failed').length;
    const errorTests = results.filter(r => r.status === 'error').length;

    const successRate = totalTests > 0 ? (passedTests / totalTests) * 100 : 0;
    const criticalIssues = results.reduce((count, r) => 
      count + r.issues.filter(i => i.severity === 'critical').length, 0
    );

    let readinessLevel: string;
    let recommendation: string;

    if (successRate >= 98 && criticalIssues === 0) {
      readinessLevel = 'production_ready';
      recommendation = 'System is ready for production deployment';
    } else if (successRate >= 95 && criticalIssues <= 1) {
      readinessLevel = 'staging_ready';
      recommendation = 'System requires minor fixes before production';
    } else if (successRate >= 85 && criticalIssues <= 3) {
      readinessLevel = 'development_ready';
      recommendation = 'System requires significant improvements before production';
    } else {
      readinessLevel = 'not_ready';
      recommendation = 'System requires major fixes and retesting';
    }

    return {
      readinessLevel,
      successRate,
      criticalIssues,
      failedTests,
      errorTests,
      recommendation,
      blockers: this.identifyProductionBlockers(results),
    };
  }

  private assessOverallRisk(results: TestResult[]): any {
    const securityScore = this.calculateAverageSecurityScore(results);
    const performanceScore = this.calculateAveragePerformanceScore(results);
    const reliabilityScore = this.calculateAverageReliabilityScore(results);

    const overallRiskScore = (securityScore + performanceScore + reliabilityScore) / 3;

    let riskLevel: string;
    if (overallRiskScore >= 90) riskLevel = 'low';
    else if (overallRiskScore >= 75) riskLevel = 'medium';
    else if (overallRiskScore >= 60) riskLevel = 'high';
    else riskLevel = 'critical';

    return {
      overallRiskScore,
      riskLevel,
      securityRisk: 100 - securityScore,
      performanceRisk: 100 - performanceScore,
      reliabilityRisk: 100 - reliabilityScore,
      recommendations: this.generateRiskMitigationRecommendations(riskLevel, overallRiskScore),
    };
  }

  private generateDeploymentRecommendations(results: TestResult[]): string[] {
    const recommendations: string[] = [];
    
    // Check performance readiness
    const performanceIssues = results.filter(r => 
      r.metrics.performance.opportunityCaptureTime > 1000
    ).length;
    
    if (performanceIssues > 0) {
      recommendations.push('Optimize opportunity capture algorithms before deployment');
    }

    // Check security readiness
    const securityIssues = results.filter(r => 
      r.metrics.security.securityScore < 85
    ).length;
    
    if (securityIssues > 0) {
      recommendations.push('Address security vulnerabilities before production deployment');
    }

    // Check reliability
    const reliabilityIssues = results.filter(r => 
      r.metrics.reliability.uptime < 99.5
    ).length;
    
    if (reliabilityIssues > 0) {
      recommendations.push('Improve system reliability and failover mechanisms');
    }

    // General recommendations
    recommendations.push('Implement comprehensive monitoring and alerting');
    recommendations.push('Set up automated rollback procedures');
    recommendations.push('Plan gradual rollout with canary deployments');
    recommendations.push('Prepare incident response procedures');

    return recommendations;
  }

  // Helper methods for metrics calculation and analysis

  private calculateAverageScore(results: TestResult[]): number {
    if (results.length === 0) return 0;
    const scores = results.map(r => r.status === 'passed' ? 100 : 0);
    return scores.reduce((sum, score) => sum + score, 0) / scores.length;
  }

  private extractKeyPerformanceMetrics(results: TestResult[]): any {
    const avgLatency = results.reduce((sum, r) => sum + r.metrics.performance.averageLatency, 0) / results.length;
    const avgThroughput = results.reduce((sum, r) => sum + r.metrics.performance.throughput, 0) / results.length;
    const avgCaptureTime = results.reduce((sum, r) => sum + r.metrics.performance.opportunityCaptureTime, 0) / results.length;

    return { avgLatency, avgThroughput, avgCaptureTime };
  }

  private extractSecurityVulnerabilities(results: TestResult[]): any {
    const allVulnerabilities = results.flatMap(r => r.metrics.security.vulnerabilitiesFound);
    return {
      total: allVulnerabilities.length,
      critical: allVulnerabilities.filter(v => v.severity === 'critical').length,
      high: allVulnerabilities.filter(v => v.severity === 'high').length,
      medium: allVulnerabilities.filter(v => v.severity === 'medium').length,
      low: allVulnerabilities.filter(v => v.severity === 'low').length,
    };
  }

  private extractReliabilityMetrics(results: TestResult[]): any {
    const avgUptime = results.reduce((sum, r) => sum + r.metrics.reliability.uptime, 0) / results.length;
    const avgFailureRate = results.reduce((sum, r) => sum + r.metrics.reliability.failureRate, 0) / results.length;
    const avgRecoveryTime = results.reduce((sum, r) => sum + r.metrics.reliability.recoveryTime, 0) / results.length;

    return { avgUptime, avgFailureRate, avgRecoveryTime };
  }

  private extractIntegrationMetrics(results: TestResult[]): any {
    const successfulFlows = results.filter(r => r.status === 'passed').length;
    const totalFlows = results.length;
    const successRate = totalFlows > 0 ? (successfulFlows / totalFlows) * 100 : 0;

    return { successfulFlows, totalFlows, successRate };
  }

  private calculateAverageSecurityScore(results: TestResult[]): number {
    if (results.length === 0) return 0;
    return results.reduce((sum, r) => sum + r.metrics.security.securityScore, 0) / results.length;
  }

  private calculateAveragePerformanceScore(results: TestResult[]): number {
    if (results.length === 0) return 0;
    return results.reduce((sum, r) => sum + r.metrics.performance.successRate, 0) / results.length;
  }

  private calculateAverageReliabilityScore(results: TestResult[]): number {
    if (results.length === 0) return 0;
    return results.reduce((sum, r) => sum + r.metrics.reliability.uptime, 0) / results.length;
  }

  private identifyProductionBlockers(results: TestResult[]): string[] {
    const blockers: string[] = [];
    
    const criticalIssues = results.flatMap(r => 
      r.issues.filter(i => i.severity === 'critical')
    );

    criticalIssues.forEach(issue => {
      blockers.push(`Critical: ${issue.description}`);
    });

    return blockers;
  }

  private generateRiskMitigationRecommendations(riskLevel: string, score: number): string[] {
    const recommendations: string[] = [];

    switch (riskLevel) {
      case 'critical':
        recommendations.push('Immediate security audit required');
        recommendations.push('Halt deployment until issues resolved');
        recommendations.push('Implement emergency response procedures');
        break;
      case 'high':
        recommendations.push('Comprehensive security review required');
        recommendations.push('Additional testing and validation needed');
        recommendations.push('Consider phased deployment approach');
        break;
      case 'medium':
        recommendations.push('Address identified issues before deployment');
        recommendations.push('Implement additional monitoring');
        recommendations.push('Prepare rollback procedures');
        break;
      case 'low':
        recommendations.push('Continue with standard deployment procedures');
        recommendations.push('Maintain ongoing monitoring');
        break;
    }

    return recommendations;
  }
}