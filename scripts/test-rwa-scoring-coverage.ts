#!/usr/bin/env node

/**
 * RWA Scoring System Test Coverage Runner
 * Runs all RWA scoring tests with detailed coverage reporting
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

interface CoverageReport {
  total: {
    lines: { pct: number };
    statements: { pct: number };
    functions: { pct: number };
    branches: { pct: number };
  };
  [key: string]: any;
}

class RWATestCoverageRunner {
  private readonly targetCoverage = 95; // Target: >95% coverage
  private readonly scoringSystemPath = 'src/satellites/sage/rwa/opportunity-scoring-system.ts';
  private readonly testFiles = [
    'tests/satellites/sage/rwa-opportunity-scoring.test.ts',
    'tests/satellites/sage/rwa-scoring-unit-tests.ts',
    'tests/satellites/sage/rwa-scoring-edge-cases.test.ts'
  ];

  async run(): Promise<void> {
    console.log('🧪 RWA Scoring System Test Coverage Analysis\n');
    console.log(`Target Coverage: >${this.targetCoverage}%\n`);

    try {
      // Run tests with coverage
      console.log('Running tests with coverage...\n');
      
      const testCommand = `npm test -- ${this.testFiles.join(' ')} --coverage --collectCoverageFrom=${this.scoringSystemPath} --coverageReporters=json --coverageReporters=text --coverageReporters=lcov`;
      
      execSync(testCommand, { 
        stdio: 'inherit',
        env: { ...process.env, CI: 'true' }
      });

      // Analyze coverage report
      const coverageReport = this.analyzeCoverage();
      
      // Generate detailed report
      this.generateDetailedReport(coverageReport);
      
      // Check if target is met
      this.checkCoverageTargets(coverageReport);

    } catch (error) {
      console.error('❌ Test execution failed:', error);
      process.exit(1);
    }
  }

  private analyzeCoverage(): CoverageReport {
    const coveragePath = path.join(process.cwd(), 'coverage', 'coverage-final.json');
    
    if (!fs.existsSync(coveragePath)) {
      throw new Error('Coverage report not found. Make sure tests ran successfully.');
    }

    const coverageData = JSON.parse(fs.readFileSync(coveragePath, 'utf-8'));
    const fileCoverage = coverageData[path.join(process.cwd(), this.scoringSystemPath)];

    if (!fileCoverage) {
      throw new Error('Coverage data for scoring system not found.');
    }

    // Calculate coverage percentages
    const statements = this.calculatePercentage(fileCoverage.s);
    const branches = this.calculatePercentage(fileCoverage.b, true);
    const functions = this.calculatePercentage(fileCoverage.f);
    const lines = this.calculatePercentage(fileCoverage.l);

    return {
      total: {
        statements: { pct: statements },
        branches: { pct: branches },
        functions: { pct: functions },
        lines: { pct: lines }
      },
      uncoveredLines: this.getUncoveredLines(fileCoverage)
    };
  }

  private calculatePercentage(coverage: any, isBranch: boolean = false): number {
    if (isBranch) {
      let covered = 0;
      let total = 0;
      Object.values(coverage).forEach((branch: any) => {
        total += branch.length;
        covered += branch.filter((count: number) => count > 0).length;
      });
      return total > 0 ? (covered / total) * 100 : 100;
    }

    const counts = Object.values(coverage) as number[];
    const total = counts.length;
    const covered = counts.filter(count => count > 0).length;
    
    return total > 0 ? (covered / total) * 100 : 100;
  }

  private getUncoveredLines(fileCoverage: any): number[] {
    const uncovered: number[] = [];
    const lineData = fileCoverage.statementMap;
    const lineCoverage = fileCoverage.s;

    Object.keys(lineCoverage).forEach(key => {
      if (lineCoverage[key] === 0) {
        const statement = lineData[key];
        if (statement && statement.start) {
          uncovered.push(statement.start.line);
        }
      }
    });

    return [...new Set(uncovered)].sort((a, b) => a - b);
  }

  private generateDetailedReport(report: CoverageReport): void {
    console.log('\n📊 Coverage Report Summary\n');
    console.log('═══════════════════════════════════════════════════');
    console.log(`Statements : ${this.formatPercentage(report.total.statements.pct)}`);
    console.log(`Branches   : ${this.formatPercentage(report.total.branches.pct)}`);
    console.log(`Functions  : ${this.formatPercentage(report.total.functions.pct)}`);
    console.log(`Lines      : ${this.formatPercentage(report.total.lines.pct)}`);
    console.log('═══════════════════════════════════════════════════\n');

    if (report.uncoveredLines && report.uncoveredLines.length > 0) {
      console.log('📍 Uncovered Lines:');
      console.log(`   ${report.uncoveredLines.join(', ')}\n`);
    }

    // Calculate overall coverage
    const overallCoverage = (
      report.total.statements.pct +
      report.total.branches.pct +
      report.total.functions.pct +
      report.total.lines.pct
    ) / 4;

    console.log(`📈 Overall Coverage: ${this.formatPercentage(overallCoverage)}\n`);
  }

  private formatPercentage(pct: number): string {
    const formatted = pct.toFixed(2);
    const emoji = pct >= this.targetCoverage ? '✅' : '❌';
    const color = pct >= this.targetCoverage ? '\x1b[32m' : '\x1b[31m';
    const reset = '\x1b[0m';
    
    return `${color}${formatted}%${reset} ${emoji}`;
  }

  private checkCoverageTargets(report: CoverageReport): void {
    const metrics = ['statements', 'branches', 'functions', 'lines'];
    let allTargetsMet = true;

    console.log('🎯 Coverage Target Analysis:\n');

    metrics.forEach(metric => {
      const coverage = report.total[metric as keyof typeof report.total].pct;
      const met = coverage >= this.targetCoverage;
      allTargetsMet = allTargetsMet && met;

      const status = met ? '✅ PASS' : '❌ FAIL';
      const difference = coverage - this.targetCoverage;
      const diffStr = difference >= 0 ? `+${difference.toFixed(2)}%` : `${difference.toFixed(2)}%`;

      console.log(`${metric.padEnd(12)}: ${status} (${diffStr})`);
    });

    console.log('\n═══════════════════════════════════════════════════\n');

    if (allTargetsMet) {
      console.log('🎉 SUCCESS: All coverage targets met!');
      console.log(`✨ Core scoring components have >${this.targetCoverage}% coverage`);
      
      // Generate coverage badge
      this.generateCoverageBadge(report);
    } else {
      console.log('⚠️  WARNING: Coverage targets not met');
      console.log(`📝 Need to improve coverage to reach >${this.targetCoverage}%`);
      
      // Suggest areas for improvement
      this.suggestImprovements(report);
    }
  }

  private generateCoverageBadge(report: CoverageReport): void {
    const overallCoverage = (
      report.total.statements.pct +
      report.total.branches.pct +
      report.total.functions.pct +
      report.total.lines.pct
    ) / 4;

    const badgeColor = overallCoverage >= 95 ? 'brightgreen' : 
                      overallCoverage >= 80 ? 'yellow' : 'red';

    console.log('\n🏆 Coverage Badge:');
    console.log(`   Coverage: ${overallCoverage.toFixed(1)}% | Color: ${badgeColor}`);
  }

  private suggestImprovements(report: CoverageReport): void {
    console.log('\n💡 Suggestions for Improvement:\n');

    const suggestions: string[] = [];

    if (report.total.branches.pct < this.targetCoverage) {
      suggestions.push('- Add tests for all conditional branches and edge cases');
    }

    if (report.total.functions.pct < this.targetCoverage) {
      suggestions.push('- Ensure all functions are called at least once in tests');
    }

    if (report.total.statements.pct < this.targetCoverage) {
      suggestions.push('- Cover error handling paths and exception cases');
    }

    if (report.uncoveredLines && report.uncoveredLines.length > 0) {
      suggestions.push(`- Focus on uncovered lines: ${report.uncoveredLines.slice(0, 5).join(', ')}...`);
    }

    suggestions.forEach(suggestion => console.log(suggestion));
  }
}

// Run the coverage analysis
if (require.main === module) {
  const runner = new RWATestCoverageRunner();
  runner.run().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { RWATestCoverageRunner };