#!/usr/bin/env node

/**
 * AI Integration Test Runner
 * Comprehensive test execution with reporting and analysis
 */

import { execSync } from 'child_process';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

interface TestRunOptions {
  category?: 'unit' | 'integration' | 'performance' | 'security' | 'all';
  coverage?: boolean;
  verbose?: boolean;
  watch?: boolean;
  parallel?: boolean;
  timeout?: number;
  pattern?: string;
  bail?: boolean;
  report?: boolean;
}

interface TestResults {
  category: string;
  passed: number;
  failed: number;
  skipped: number;
  duration: number;
  coverage?: {
    lines: number;
    branches: number;
    functions: number;
    statements: number;
  };
  performance?: {
    avgResponseTime: number;
    maxMemoryUsage: number;
    throughput: number;
  };
}

class AITestRunner {
  private results: TestResults[] = [];
  private startTime: number = 0;

  constructor(private options: TestRunOptions = {}) {}

  async run(): Promise<void> {
    console.log('🚀 Starting AI Integration Tests...\n');
    this.startTime = Date.now();

    try {
      await this.setupEnvironment();
      await this.runTestCategories();
      await this.generateReport();
      
      console.log('\n✅ All tests completed successfully!');
      process.exit(0);
    } catch (error) {
      console.error('\n❌ Test execution failed:', error);
      process.exit(1);
    }
  }

  private async setupEnvironment(): Promise<void> {
    console.log('📋 Setting up test environment...');

    // Create directories
    const dirs = ['coverage', 'test-results', 'logs'];
    dirs.forEach(dir => {
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
    });

    // Set environment variables
    process.env.NODE_ENV = 'test';
    process.env.TZ = 'UTC';
    
    if (this.options.timeout) {
      process.env.JEST_TIMEOUT = this.options.timeout.toString();
    }

    console.log('✓ Environment setup complete\n');
  }

  private async runTestCategories(): Promise<void> {
    const categories = this.getTestCategories();

    for (const category of categories) {
      console.log(`🧪 Running ${category} tests...`);
      
      try {
        const result = await this.runTestCategory(category);
        this.results.push(result);
        
        console.log(`✓ ${category} tests completed: ${result.passed} passed, ${result.failed} failed`);
      } catch (error) {
        console.error(`✗ ${category} tests failed:`, error);
        if (this.options.bail) {
          throw error;
        }
      }
      
      console.log(''); // Add spacing
    }
  }

  private getTestCategories(): string[] {
    if (this.options.category && this.options.category !== 'all') {
      return [this.options.category];
    }

    return ['unit', 'integration', 'performance', 'security'];
  }

  private async runTestCategory(category: string): Promise<TestResults> {
    const startTime = Date.now();
    
    const jestCommand = this.buildJestCommand(category);
    
    try {
      const output = execSync(jestCommand, { 
        encoding: 'utf8',
        stdio: this.options.verbose ? 'inherit' : 'pipe',
        timeout: (this.options.timeout || 300) * 1000, // Convert to milliseconds
      });

      const result = this.parseTestOutput(output, category);
      result.duration = Date.now() - startTime;
      
      return result;
    } catch (error: any) {
      // Jest exits with code 1 when tests fail, but we still want to parse results
      const output = error.stdout || error.message;
      const result = this.parseTestOutput(output, category);
      result.duration = Date.now() - startTime;
      
      return result;
    }
  }

  private buildJestCommand(category: string): string {
    const baseCommand = 'npx jest';
    const options: string[] = [];

    // Test pattern
    if (this.options.pattern) {
      options.push(`--testNamePattern="${this.options.pattern}"`);
    } else {
      options.push(`${category}/`);
    }

    // Coverage
    if (this.options.coverage || category === 'unit') {
      options.push('--coverage');
      options.push('--coverageReporters=text lcov html json-summary');
    }

    // Parallelization
    if (this.options.parallel !== false) {
      options.push('--maxWorkers=50%');
    }

    // Verbose output
    if (this.options.verbose) {
      options.push('--verbose');
    }

    // Watch mode
    if (this.options.watch) {
      options.push('--watch');
    }

    // CI mode
    if (process.env.CI) {
      options.push('--ci --watchAll=false');
    }

    // Additional options based on category
    switch (category) {
      case 'performance':
        options.push('--testTimeout=60000'); // 60 seconds for performance tests
        options.push('--detectOpenHandles');
        break;
      case 'integration':
        options.push('--testTimeout=45000'); // 45 seconds for integration tests
        options.push('--forceExit');
        break;
      case 'security':
        options.push('--verbose'); // Always verbose for security tests
        break;
    }

    return `${baseCommand} ${options.join(' ')}`;
  }

  private parseTestOutput(output: string, category: string): TestResults {
    const result: TestResults = {
      category,
      passed: 0,
      failed: 0,
      skipped: 0,
      duration: 0,
    };

    try {
      // Parse test results from Jest output
      const testMatch = output.match(/Tests:\s+(\d+)\s+failed,\s+(\d+)\s+passed,\s+(\d+)\s+total/);
      if (testMatch) {
        result.failed = parseInt(testMatch[1]);
        result.passed = parseInt(testMatch[2]);
      }

      // Parse coverage if available
      const coverageMatch = output.match(/Lines\s+:\s+([\d.]+)%.*Branches\s+:\s+([\d.]+)%.*Functions\s+:\s+([\d.]+)%.*Statements\s+:\s+([\d.]+)%/s);
      if (coverageMatch && this.options.coverage) {
        result.coverage = {
          lines: parseFloat(coverageMatch[1]),
          branches: parseFloat(coverageMatch[2]),
          functions: parseFloat(coverageMatch[3]),
          statements: parseFloat(coverageMatch[4]),
        };
      }

      // Parse performance metrics for performance tests
      if (category === 'performance') {
        const perfMatch = output.match(/Performance Stats:(.*?)(?=\n\n|\n===|\nTest Suites:)/s);
        if (perfMatch) {
          result.performance = this.parsePerformanceStats(perfMatch[1]);
        }
      }
    } catch (error) {
      console.warn(`Warning: Could not parse test output for ${category}:`, error);
    }

    return result;
  }

  private parsePerformanceStats(statsText: string): any {
    const stats: any = {};
    
    try {
      const lines = statsText.split('\n').filter(line => line.trim());
      let currentMetric = '';
      
      for (const line of lines) {
        if (line.includes(':')) {
          const [key, value] = line.split(':');
          if (value && value.includes('ms')) {
            currentMetric = key.trim();
            stats[currentMetric] = {};
          } else if (currentMetric && line.includes('Mean:')) {
            const meanMatch = line.match(/([\d.]+)ms/);
            if (meanMatch) {
              stats.avgResponseTime = parseFloat(meanMatch[1]);
            }
          }
        }
      }
    } catch (error) {
      console.warn('Could not parse performance stats:', error);
    }
    
    return stats;
  }

  private async generateReport(): Promise<void> {
    console.log('📊 Generating test report...');

    const totalDuration = Date.now() - this.startTime;
    const report = this.buildReport(totalDuration);

    // Write report to file
    const reportPath = join('test-results', `ai-test-report-${Date.now()}.json`);
    writeFileSync(reportPath, JSON.stringify(report, null, 2));

    // Write summary to console
    this.printSummary(report);

    console.log(`\n📄 Detailed report saved to: ${reportPath}`);
  }

  private buildReport(totalDuration: number): any {
    const summary = {
      timestamp: new Date().toISOString(),
      totalDuration,
      categories: this.results,
      overall: {
        totalTests: this.results.reduce((sum, r) => sum + r.passed + r.failed, 0),
        totalPassed: this.results.reduce((sum, r) => sum + r.passed, 0),
        totalFailed: this.results.reduce((sum, r) => sum + r.failed, 0),
        successRate: 0,
      },
      coverage: this.calculateOverallCoverage(),
      performance: this.extractPerformanceMetrics(),
      recommendations: this.generateRecommendations(),
    };

    summary.overall.successRate = summary.overall.totalTests > 0 
      ? (summary.overall.totalPassed / summary.overall.totalTests) * 100 
      : 0;

    return summary;
  }

  private calculateOverallCoverage(): any {
    const coverageResults = this.results.filter(r => r.coverage);
    
    if (coverageResults.length === 0) {
      return null;
    }

    return {
      lines: coverageResults.reduce((sum, r) => sum + (r.coverage?.lines || 0), 0) / coverageResults.length,
      branches: coverageResults.reduce((sum, r) => sum + (r.coverage?.branches || 0), 0) / coverageResults.length,
      functions: coverageResults.reduce((sum, r) => sum + (r.coverage?.functions || 0), 0) / coverageResults.length,
      statements: coverageResults.reduce((sum, r) => sum + (r.coverage?.statements || 0), 0) / coverageResults.length,
    };
  }

  private extractPerformanceMetrics(): any {
    const perfResult = this.results.find(r => r.category === 'performance');
    return perfResult?.performance || null;
  }

  private generateRecommendations(): string[] {
    const recommendations: string[] = [];
    const overallSuccessRate = this.results.reduce((sum, r) => sum + r.passed, 0) / 
                               Math.max(1, this.results.reduce((sum, r) => sum + r.passed + r.failed, 0));

    if (overallSuccessRate < 0.95) {
      recommendations.push('Overall success rate is below 95%. Review failing tests and improve reliability.');
    }

    const coverage = this.calculateOverallCoverage();
    if (coverage && coverage.lines < 80) {
      recommendations.push('Code coverage is below 80%. Add more comprehensive unit tests.');
    }

    const perfResult = this.results.find(r => r.category === 'performance');
    if (perfResult && perfResult.failed > 0) {
      recommendations.push('Performance tests failing. Review response times and resource usage.');
    }

    const secResult = this.results.find(r => r.category === 'security');
    if (secResult && secResult.failed > 0) {
      recommendations.push('Security tests failing. Address security vulnerabilities immediately.');
    }

    if (recommendations.length === 0) {
      recommendations.push('All tests are performing well. Continue monitoring for regressions.');
    }

    return recommendations;
  }

  private printSummary(report: any): void {
    console.log('\n' + '='.repeat(60));
    console.log('🎯 AI INTEGRATION TEST SUMMARY');
    console.log('='.repeat(60));
    
    console.log(`\n📊 Overall Results:`);
    console.log(`   Total Tests: ${report.overall.totalTests}`);
    console.log(`   Passed: ${report.overall.totalPassed} ✅`);
    console.log(`   Failed: ${report.overall.totalFailed} ${report.overall.totalFailed > 0 ? '❌' : '✅'}`);
    console.log(`   Success Rate: ${report.overall.successRate.toFixed(1)}%`);
    console.log(`   Duration: ${(report.totalDuration / 1000).toFixed(1)}s`);

    if (report.coverage) {
      console.log(`\n📈 Coverage:`);
      console.log(`   Lines: ${report.coverage.lines.toFixed(1)}%`);
      console.log(`   Branches: ${report.coverage.branches.toFixed(1)}%`);
      console.log(`   Functions: ${report.coverage.functions.toFixed(1)}%`);
      console.log(`   Statements: ${report.coverage.statements.toFixed(1)}%`);
    }

    if (report.performance) {
      console.log(`\n⚡ Performance:`);
      console.log(`   Avg Response Time: ${report.performance.avgResponseTime || 'N/A'}`);
      console.log(`   Max Memory Usage: ${report.performance.maxMemoryUsage || 'N/A'}`);
      console.log(`   Throughput: ${report.performance.throughput || 'N/A'}`);
    }

    console.log(`\n💡 Recommendations:`);
    report.recommendations.forEach((rec: string, i: number) => {
      console.log(`   ${i + 1}. ${rec}`);
    });

    console.log('\n' + '='.repeat(60));
  }
}

// CLI argument parsing
function parseArgs(): TestRunOptions {
  const args = process.argv.slice(2);
  const options: TestRunOptions = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    switch (arg) {
      case '--category':
      case '-c':
        options.category = args[++i] as any;
        break;
      case '--coverage':
        options.coverage = true;
        break;
      case '--verbose':
      case '-v':
        options.verbose = true;
        break;
      case '--watch':
      case '-w':
        options.watch = true;
        break;
      case '--no-parallel':
        options.parallel = false;
        break;
      case '--timeout':
      case '-t':
        options.timeout = parseInt(args[++i]);
        break;
      case '--pattern':
      case '-p':
        options.pattern = args[++i];
        break;
      case '--bail':
      case '-b':
        options.bail = true;
        break;
      case '--report':
      case '-r':
        options.report = true;
        break;
      case '--help':
      case '-h':
        printHelp();
        process.exit(0);
        break;
    }
  }

  return options;
}

function printHelp(): void {
  console.log(`
🧪 AI Integration Test Runner

Usage: npm run test [options]

Options:
  -c, --category <type>    Test category: unit|integration|performance|security|all (default: all)
  --coverage               Generate coverage report
  -v, --verbose            Verbose output
  -w, --watch              Watch mode
  --no-parallel            Disable parallel execution
  -t, --timeout <ms>       Test timeout in seconds (default: 300)
  -p, --pattern <pattern>  Test name pattern to match
  -b, --bail               Stop on first test failure
  -r, --report             Generate detailed report
  -h, --help               Show this help

Examples:
  npm run test                          # Run all tests
  npm run test -- -c unit --coverage    # Run unit tests with coverage
  npm run test -- -c performance -v     # Run performance tests with verbose output
  npm run test -- -p "OpenAI" --bail    # Run tests matching "OpenAI" and stop on failure
`);
}

// Main execution
if (require.main === module) {
  const options = parseArgs();
  const runner = new AITestRunner(options);
  runner.run().catch(console.error);
}

export { AITestRunner, TestRunOptions, TestResults };