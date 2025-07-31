import { 
  SagePerformanceTestFramework, 
  TestScenario, 
  PerformanceTestConfig,
  PerformanceTestResults 
} from './sage-performance-test-framework';

/**
 * Sage Satellite Specific Performance Tests
 * Tests all major Sage components under various load conditions
 */

export class SagePerformanceTests {
  private framework: SagePerformanceTestFramework;
  private testResults: PerformanceTestResults[] = [];

  constructor() {
    // Initialize with default configuration
    const defaultConfig: PerformanceTestConfig = {
      testName: 'Sage Satellite Performance Tests',
      description: 'Comprehensive performance testing for Sage Satellite components',
      duration: 60000, // 1 minute
      warmupDuration: 10000, // 10 seconds
      concurrency: { min: 1, max: 50, step: 5 },
      throughput: { targetRPS: 25, maxRPS: 100, rampUpDuration: 30000 },
      latency: { p50Target: 200, p95Target: 500, p99Target: 1000 },
      resources: { maxCpuPercent: 80, maxMemoryMB: 1024, maxNetworkBytesPerSec: 10485760 },
      breakingPoint: { enabled: true, maxErrors: 50, maxLatencyMs: 3000 }
    };

    this.framework = new SagePerformanceTestFramework(defaultConfig);
  }

  /**
   * Run all Sage performance tests
   */
  async runAllPerformanceTests(): Promise<void> {
    console.log('🚀 Starting Sage Satellite Performance Test Suite');
    console.log('===============================================\n');

    try {
      // 1. RWA Scoring Performance Tests
      await this.runRWAScoringPerformanceTests();

      // 2. Fundamental Analysis Performance Tests
      await this.runFundamentalAnalysisPerformanceTests();

      // 3. Compliance Monitoring Performance Tests
      await this.runComplianceMonitoringPerformanceTests();

      // 4. Perplexity API Integration Performance Tests
      await this.runPerplexityAPIPerformanceTests();

      // 5. Cross-Component Integration Performance Tests
      await this.runCrossComponentPerformanceTests();

      // 6. Memory Leak and Long-Running Tests
      await this.runMemoryLeakTests();

      // 7. Generate comprehensive report
      await this.generateFinalReport();

      console.log('✅ All Sage performance tests completed successfully!\n');

    } catch (error) {
      console.error('❌ Sage performance tests failed:', error);
      throw error;
    }
  }

  /**
   * Test RWA Scoring System Performance
   */
  private async runRWAScoringPerformanceTests(): Promise<void> {
    console.log('📊 Testing RWA Scoring System Performance...\n');

    const rwaScoringConfig: PerformanceTestConfig = {
      testName: 'RWA Scoring Performance',
      description: 'Performance testing of RWA opportunity scoring algorithms',
      duration: 90000, // 1.5 minutes
      warmupDuration: 15000, // 15 seconds
      concurrency: { min: 1, max: 30, step: 3 },
      throughput: { targetRPS: 20, maxRPS: 80, rampUpDuration: 45000 },
      latency: { p50Target: 150, p95Target: 400, p99Target: 800 },
      resources: { maxCpuPercent: 75, maxMemoryMB: 512, maxNetworkBytesPerSec: 5242880 },
      breakingPoint: { enabled: true, maxErrors: 25, maxLatencyMs: 2000 }
    };

    const rwaScoringFramework = new SagePerformanceTestFramework(rwaScoringConfig);

    // Test different RWA types and complexities
    const rwaScenarios = [
      { name: 'Simple RWA Scoring', complexity: 'low', weight: 40 },
      { name: 'Complex RWA with Dependencies', complexity: 'medium', weight: 35 },
      { name: 'Multi-Asset RWA Portfolio Scoring', complexity: 'high', weight: 25 }
    ];

    const results = await rwaScoringFramework.runPerformanceTestSuite();
    this.testResults.push(...results);

    this.logTestResults('RWA Scoring', results);
  }

  /**
   * Test Fundamental Analysis Engine Performance
   */
  private async runFundamentalAnalysisPerformanceTests(): Promise<void> {
    console.log('🔍 Testing Fundamental Analysis Engine Performance...\n');

    const fundamentalAnalysisConfig: PerformanceTestConfig = {
      testName: 'Fundamental Analysis Performance',
      description: 'Performance testing of ML-based fundamental analysis',
      duration: 120000, // 2 minutes
      warmupDuration: 20000, // 20 seconds
      concurrency: { min: 1, max: 20, step: 2 },
      throughput: { targetRPS: 10, maxRPS: 40, rampUpDuration: 60000 },
      latency: { p50Target: 300, p95Target: 800, p99Target: 1500 },
      resources: { maxCpuPercent: 85, maxMemoryMB: 1024, maxNetworkBytesPerSec: 10485760 },
      breakingPoint: { enabled: true, maxErrors: 15, maxLatencyMs: 4000 }
    };

    const fundamentalFramework = new SagePerformanceTestFramework(fundamentalAnalysisConfig);

    // Test different analysis types
    const analysisScenarios = [
      { name: 'Protocol Health Analysis', type: 'health', weight: 30 },
      { name: 'TVL Trend Analysis', type: 'tvl', weight: 25 },
      { name: 'Revenue Model Analysis', type: 'revenue', weight: 25 },
      { name: 'Comprehensive Analysis', type: 'comprehensive', weight: 20 }
    ];

    const results = await fundamentalFramework.runPerformanceTestSuite();
    this.testResults.push(...results);

    this.logTestResults('Fundamental Analysis', results);
  }

  /**
   * Test Compliance Monitoring Performance
   */
  private async runComplianceMonitoringPerformanceTests(): Promise<void> {
    console.log('🛡️ Testing Compliance Monitoring Performance...\n');

    const complianceConfig: PerformanceTestConfig = {
      testName: 'Compliance Monitoring Performance',
      description: 'Performance testing of regulatory compliance checks',
      duration: 75000, // 1.25 minutes
      warmupDuration: 10000, // 10 seconds
      concurrency: { min: 1, max: 40, step: 4 },
      throughput: { targetRPS: 30, maxRPS: 120, rampUpDuration: 37500 },
      latency: { p50Target: 100, p95Target: 300, p99Target: 600 },
      resources: { maxCpuPercent: 70, maxMemoryMB: 256, maxNetworkBytesPerSec: 2097152 },
      breakingPoint: { enabled: true, maxErrors: 30, maxLatencyMs: 1500 }
    };

    const complianceFramework = new SagePerformanceTestFramework(complianceConfig);

    // Test different compliance scenarios
    const complianceScenarios = [
      { name: 'Basic KYC Check', type: 'kyc', weight: 35 },
      { name: 'AML Verification', type: 'aml', weight: 30 },
      { name: 'Jurisdiction Check', type: 'jurisdiction', weight: 20 },
      { name: 'Complex Multi-Regulatory Check', type: 'multi', weight: 15 }
    ];

    const results = await complianceFramework.runPerformanceTestSuite();
    this.testResults.push(...results);

    this.logTestResults('Compliance Monitoring', results);
  }

  /**
   * Test Perplexity API Integration Performance
   */
  private async runPerplexityAPIPerformanceTests(): Promise<void> {
    console.log('🔌 Testing Perplexity API Integration Performance...\n');

    const perplexityConfig: PerformanceTestConfig = {
      testName: 'Perplexity API Performance',
      description: 'Performance testing of external API integration',
      duration: 100000, // 1.67 minutes
      warmupDuration: 15000, // 15 seconds
      concurrency: { min: 1, max: 15, step: 2 },
      throughput: { targetRPS: 5, maxRPS: 20, rampUpDuration: 50000 },
      latency: { p50Target: 800, p95Target: 2000, p99Target: 4000 },
      resources: { maxCpuPercent: 60, maxMemoryMB: 256, maxNetworkBytesPerSec: 20971520 },
      breakingPoint: { enabled: true, maxErrors: 20, maxLatencyMs: 8000 }
    };

    const perplexityFramework = new SagePerformanceTestFramework(perplexityConfig);

    // Test different API usage patterns
    const apiScenarios = [
      { name: 'Market Research Query', type: 'research', weight: 40 },
      { name: 'Protocol Deep Dive', type: 'analysis', weight: 35 },
      { name: 'Regulatory Update Check', type: 'regulatory', weight: 25 }
    ];

    const results = await perplexityFramework.runPerformanceTestSuite();
    this.testResults.push(...results);

    this.logTestResults('Perplexity API Integration', results);
  }

  /**
   * Test Cross-Component Integration Performance
   */
  private async runCrossComponentPerformanceTests(): Promise<void> {
    console.log('🔗 Testing Cross-Component Integration Performance...\n');

    const integrationConfig: PerformanceTestConfig = {
      testName: 'Cross-Component Integration Performance',
      description: 'Performance testing of integrated workflows',
      duration: 150000, // 2.5 minutes
      warmupDuration: 20000, // 20 seconds
      concurrency: { min: 1, max: 25, step: 3 },
      throughput: { targetRPS: 8, maxRPS: 30, rampUpDuration: 75000 },
      latency: { p50Target: 500, p95Target: 1200, p99Target: 2500 },
      resources: { maxCpuPercent: 90, maxMemoryMB: 1536, maxNetworkBytesPerSec: 15728640 },
      breakingPoint: { enabled: true, maxErrors: 10, maxLatencyMs: 5000 }
    };

    const integrationFramework = new SagePerformanceTestFramework(integrationConfig);

    // Test integrated workflows
    const integrationScenarios = [
      { name: 'End-to-End RWA Analysis', type: 'e2e_rwa', weight: 30 },
      { name: 'Protocol + Compliance Workflow', type: 'protocol_compliance', weight: 35 },
      { name: 'Full Research Pipeline', type: 'full_pipeline', weight: 35 }
    ];

    const results = await integrationFramework.runPerformanceTestSuite();
    this.testResults.push(...results);

    this.logTestResults('Cross-Component Integration', results);
  }

  /**
   * Test Memory Leaks and Long-Running Performance
   */
  private async runMemoryLeakTests(): Promise<void> {
    console.log('🧠 Testing Memory Leak and Long-Running Performance...\n');

    const memoryConfig: PerformanceTestConfig = {
      testName: 'Memory Leak and Endurance Test',
      description: 'Long-running test to detect memory leaks and performance degradation',
      duration: 600000, // 10 minutes
      warmupDuration: 30000, // 30 seconds
      concurrency: { min: 5, max: 15, step: 2 },
      throughput: { targetRPS: 15, maxRPS: 25, rampUpDuration: 120000 },
      latency: { p50Target: 200, p95Target: 500, p99Target: 1000 },
      resources: { maxCpuPercent: 75, maxMemoryMB: 1024, maxNetworkBytesPerSec: 10485760 },
      breakingPoint: { enabled: false, maxErrors: 0, maxLatencyMs: 0 }
    };

    const memoryFramework = new SagePerformanceTestFramework(memoryConfig);

    // Monitor memory usage patterns
    const memoryScenarios = [
      { name: 'Continuous RWA Scoring', type: 'continuous', weight: 50 },
      { name: 'Memory-Intensive Analysis', type: 'memory_intensive', weight: 50 }
    ];

    const results = await memoryFramework.runPerformanceTestSuite();
    this.testResults.push(...results);

    this.logTestResults('Memory Leak and Endurance', results);
  }

  /**
   * Generate final comprehensive report
   */
  private async generateFinalReport(): Promise<void> {
    console.log('📋 Generating Final Performance Report...\n');

    const overallMetrics = this.calculateOverallMetrics();
    const performanceGrade = this.calculatePerformanceGrade(overallMetrics);

    console.log('='.repeat(80));
    console.log('🎯 SAGE SATELLITE PERFORMANCE SUMMARY');
    console.log('='.repeat(80));
    console.log(`Overall Grade: ${performanceGrade.grade} (${performanceGrade.score}/100)`);
    console.log(`Total Tests: ${this.testResults.length}`);
    console.log(`Passed Tests: ${overallMetrics.passedTests}`);
    console.log(`Failed Tests: ${overallMetrics.failedTests}`);
    console.log(`Average RPS: ${overallMetrics.avgRPS.toFixed(1)}`);
    console.log(`Average P95 Latency: ${overallMetrics.avgP95Latency.toFixed(1)}ms`);
    console.log(`Average Error Rate: ${overallMetrics.avgErrorRate.toFixed(2)}%`);

    console.log('\n🏆 Performance Achievements:');
    performanceGrade.achievements.forEach(achievement => {
      console.log(`  ✅ ${achievement}`);
    });

    if (performanceGrade.concerns.length > 0) {
      console.log('\n⚠️ Performance Concerns:');
      performanceGrade.concerns.forEach(concern => {
        console.log(`  ❌ ${concern}`);
      });
    }

    console.log('\n💡 Performance Recommendations:');
    performanceGrade.recommendations.forEach(rec => {
      console.log(`  • ${rec}`);
    });

    console.log('='.repeat(80));

    // Save detailed JSON report
    await this.savePerformanceReport(overallMetrics, performanceGrade);
  }

  /**
   * Calculate overall performance metrics
   */
  private calculateOverallMetrics() {
    const passedTests = this.testResults.filter(r => r.summary.passed).length;
    const failedTests = this.testResults.length - passedTests;
    
    const avgRPS = this.testResults.reduce((sum, r) => 
      sum + r.phases.steady.requests.rps, 0) / this.testResults.length;
    
    const avgP95Latency = this.testResults.reduce((sum, r) => 
      sum + r.phases.steady.latency.p95, 0) / this.testResults.length;
    
    const avgErrorRate = this.testResults.reduce((sum, r) => 
      sum + r.phases.steady.errors.errorRate, 0) / this.testResults.length;

    const avgScore = this.testResults.reduce((sum, r) => 
      sum + r.summary.overallScore, 0) / this.testResults.length;

    return {
      passedTests,
      failedTests,
      avgRPS,
      avgP95Latency,
      avgErrorRate,
      avgScore,
      totalTests: this.testResults.length
    };
  }

  /**
   * Calculate performance grade
   */
  private calculatePerformanceGrade(metrics: any) {
    let score = metrics.avgScore;
    const achievements: string[] = [];
    const concerns: string[] = [];
    const recommendations: string[] = [];

    // Grade achievements
    if (metrics.passedTests === metrics.totalTests) {
      achievements.push('All performance tests passed');
    }
    if (metrics.avgP95Latency < 500) {
      achievements.push('Excellent P95 latency performance');
    }
    if (metrics.avgErrorRate < 0.01) {
      achievements.push('Very low error rate maintained');
    }
    if (metrics.avgRPS > 50) {
      achievements.push('High throughput achieved');
    }

    // Grade concerns
    if (metrics.failedTests > 0) {
      concerns.push(`${metrics.failedTests} performance tests failed`);
      recommendations.push('Review failed test scenarios and optimize bottlenecks');
    }
    if (metrics.avgP95Latency > 1000) {
      concerns.push('High P95 latency detected');
      recommendations.push('Optimize database queries and implement caching');
    }
    if (metrics.avgErrorRate > 0.05) {
      concerns.push('High error rate detected');
      recommendations.push('Implement better error handling and retry mechanisms');
    }

    // General recommendations
    if (metrics.avgRPS < 20) {
      recommendations.push('Consider horizontal scaling to improve throughput');
    }
    if (score < 80) {
      recommendations.push('Overall performance needs improvement - review all components');
    }

    let grade = 'A';
    if (score < 90) grade = 'B';
    if (score < 80) grade = 'C';
    if (score < 70) grade = 'D';
    if (score < 60) grade = 'F';

    return {
      grade,
      score: Math.round(score),
      achievements,
      concerns,
      recommendations
    };
  }

  /**
   * Save performance report to file
   */
  private async savePerformanceReport(metrics: any, grade: any): Promise<void> {
    const fs = await import('fs/promises');
    await fs.mkdir('performance-reports', { recursive: true });

    const report = {
      timestamp: new Date().toISOString(),
      testSuite: 'Sage Satellite Performance Tests',
      summary: {
        ...metrics,
        grade: grade.grade,
        score: grade.score
      },
      achievements: grade.achievements,
      concerns: grade.concerns,
      recommendations: grade.recommendations,
      detailedResults: this.testResults
    };

    await fs.writeFile(
      'performance-reports/sage-performance-detailed-report.json',
      JSON.stringify(report, null, 2)
    );

    console.log('💾 Detailed performance report saved to performance-reports/sage-performance-detailed-report.json');
  }

  /**
   * Log test results helper
   */
  private logTestResults(testName: string, results: PerformanceTestResults[]): void {
    console.log(`\n📊 ${testName} Results:`);
    results.forEach(result => {
      const status = result.summary.passed ? '✅ PASS' : '❌ FAIL';
      const score = result.summary.overallScore;
      const rps = result.phases.steady.requests.rps.toFixed(1);
      const p95 = result.phases.steady.latency.p95.toFixed(1);
      const errorRate = (result.phases.steady.errors.errorRate * 100).toFixed(2);

      console.log(`  ${result.config.testName}: ${status} (${score}/100)`);
      console.log(`    RPS: ${rps}, P95: ${p95}ms, Errors: ${errorRate}%`);
    });
    console.log('');
  }
}

// Export for use in other test files
export default SagePerformanceTests;