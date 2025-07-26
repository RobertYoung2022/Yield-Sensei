#!/usr/bin/env tsx
/**
 * TypeScript error reporting and trend analysis script
 * Generates detailed reports on type errors and tracks improvements over time
 */

import { execSync } from 'child_process';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

interface TypeErrorPattern {
  code: string;
  count: number;
  description: string;
  category: 'critical' | 'high' | 'medium' | 'low';
  examples: string[];
}

interface TypeErrorReport {
  timestamp: string;
  totalErrors: number;
  errorPatterns: TypeErrorPattern[];
  anyTypeCount: number;
  typeCoverage: number;
  changedFiles: string[];
  recommendations: string[];
  trends: {
    errorDelta: number;
    anyTypeDelta: number;
    coverageDelta: number;
  };
}

interface TrendData {
  date: string;
  totalErrors: number;
  anyTypeCount: number;
  typecoverage: number;
  commitHash?: string;
  branch?: string;
}

class TypeErrorReporter {
  private projectRoot: string;
  private reportsDir: string;
  private trendsFile: string;

  constructor() {
    this.projectRoot = process.cwd();
    this.reportsDir = join(this.projectRoot, 'reports', 'type-safety');
    this.trendsFile = join(this.reportsDir, 'trends.json');
    
    // Ensure reports directory exists
    if (!existsSync(this.reportsDir)) {
      mkdirSync(this.reportsDir, { recursive: true });
    }
  }

  async generateReport(): Promise<TypeErrorReport> {
    console.log('📊 Generating comprehensive type error report...');

    const timestamp = new Date().toISOString();
    const errorPatterns = await this.analyzeErrorPatterns();
    const totalErrors = errorPatterns.reduce((sum, pattern) => sum + pattern.count, 0);
    const anyTypeCount = await this.countAnyTypes();
    const typeCoverage = await this.getTypeCoverage();
    const changedFiles = this.getChangedFiles();
    const recommendations = this.generateRecommendations(errorPatterns, anyTypeCount, typeCoverage);
    const trends = await this.calculateTrends(totalErrors, anyTypeCount, typecoverage);

    const report: TypeErrorReport = {
      timestamp,
      totalErrors,
      errorPatterns,
      anyTypeCount,
      typeCoverage,
      changedFiles,
      recommendations,
      trends
    };

    // Save the report
    await this.saveReport(report);
    
    // Update trends data
    await this.updateTrends(report);

    // Generate human-readable summary
    this.printSummary(report);

    return report;
  }

  private async analyzeErrorPatterns(): Promise<TypeErrorPattern[]> {
    console.log('🔍 Analyzing TypeScript error patterns...');

    try {
      const output = execSync('npm run typecheck', { 
        encoding: 'utf8', 
        cwd: this.projectRoot 
      });
      
      // No errors if compilation succeeds
      return [];
    } catch (error: any) {
      const errorOutput = error.stdout || error.stderr || '';
      return this.parseErrorPatterns(errorOutput);
    }
  }

  private parseErrorPatterns(output: string): TypeErrorPattern[] {
    const patterns: Record<string, TypeErrorPattern> = {};
    const lines = output.split('\n');

    // Define error pattern mappings
    const errorCategories: Record<string, { description: string; category: 'critical' | 'high' | 'medium' | 'low' }> = {
      'TS4111': { description: 'Index signature property access', category: 'medium' },
      'TS6133': { description: 'Unused parameters/variables', category: 'low' },
      'TS7030': { description: 'Missing return statements', category: 'high' },
      'TS2379': { description: 'Exact optional property issues', category: 'medium' },
      'TS2339': { description: 'Property access on never type', category: 'high' },
      'TS2322': { description: 'Type assignment compatibility', category: 'high' },
      'TS2345': { description: 'Argument type mismatch', category: 'high' },
      'TS2741': { description: 'Missing properties in type', category: 'medium' },
      'TS2769': { description: 'No overload matches call', category: 'medium' },
      'TS2532': { description: 'Object possibly undefined', category: 'high' },
      'TS18048': { description: 'Object possibly undefined (strict)', category: 'high' },
      'TS2561': { description: 'Unknown property in object literal', category: 'medium' },
      'TS1484': { description: 'Type-only import required', category: 'low' }
    };

    for (const line of lines) {
      const errorMatch = line.match(/error TS(\d+):/);
      if (errorMatch) {
        const code = `TS${errorMatch[1]}`;
        const category = errorCategories[code] || { description: 'Other TypeScript error', category: 'medium' };
        
        if (!patterns[code]) {
          patterns[code] = {
            code,
            count: 0,
            description: category.description,
            category: category.category,
            examples: []
          };
        }
        
        patterns[code].count++;
        
        // Add example if we don't have too many
        if (patterns[code].examples.length < 3) {
          const example = line.trim();
          if (example && !patterns[code].examples.includes(example)) {
            patterns[code].examples.push(example);
          }
        }
      }
    }

    return Object.values(patterns).sort((a, b) => b.count - a.count);
  }

  private async countAnyTypes(): Promise<number> {
    console.log('🔍 Counting any type usage...');
    
    try {
      const output = execSync(
        'find src -name "*.ts" -exec grep -c ": any\\|= any\\| any\\[\\]\\|<any>" {} + | awk \'{sum += $1} END {print sum}\'',
        { encoding: 'utf8', cwd: this.projectRoot }
      );
      return parseInt(output.trim()) || 0;
    } catch {
      return 0;
    }
  }

  private async getTypeCoverage(): Promise<number> {
    console.log('📊 Calculating type coverage...');
    
    try {
      const output = execSync('npm run type-coverage', { 
        encoding: 'utf8', 
        cwd: this.projectRoot 
      });
      
      const match = output.match(/(\d+\.?\d*)% type coverage/);
      return match ? parseFloat(match[1]) : 0;
    } catch {
      return 0;
    }
  }

  private getChangedFiles(): string[] {
    try {
      const output = execSync('git diff --name-only HEAD~1 HEAD', { 
        encoding: 'utf8', 
        cwd: this.projectRoot 
      });
      
      return output
        .split('\n')
        .filter(file => file.endsWith('.ts') || file.endsWith('.tsx'))
        .filter(file => file.length > 0);
    } catch {
      return [];
    }
  }

  private generateRecommendations(
    errorPatterns: TypeErrorPattern[], 
    anyTypeCount: number, 
    typeCoverage: number
  ): string[] {
    const recommendations: string[] = [];

    // Critical error recommendations
    const criticalErrors = errorPatterns.filter(p => p.category === 'critical');
    if (criticalErrors.length > 0) {
      recommendations.push('🚨 Address critical type errors immediately - these may cause runtime failures');
    }

    // High priority recommendations
    const highErrors = errorPatterns.filter(p => p.category === 'high');
    if (highErrors.length > 0) {
      recommendations.push('⚡ Fix high-priority type errors to improve code safety');
    }

    // Top error pattern recommendations
    const topError = errorPatterns[0];
    if (topError) {
      switch (topError.code) {
        case 'TS4111':
          recommendations.push('🔧 Use bracket notation or type guards from src/utils/type-guards.ts for index signature access');
          break;
        case 'TS6133':
          recommendations.push('🧹 Prefix unused parameters with underscore or use markUnused() from src/utils/');
          break;
        case 'TS7030':
          recommendations.push('🔄 Ensure all code paths return values or use exhaustive switch patterns');
          break;
        case 'TS2379':
          recommendations.push('🎯 Use exactOptionalPropertyTypes helpers from src/utils/safe-access.ts');
          break;
      }
    }

    // Any type recommendations
    if (anyTypeCount > 50) {
      recommendations.push('🎯 Reduce any type usage - use type replacements from src/utils/type-replacements.ts');
    }

    // Type coverage recommendations
    if (typeCoverage < 85) {
      recommendations.push('📈 Improve type coverage by adding explicit type annotations');
    }

    // General recommendations
    if (errorPatterns.length > 0) {
      recommendations.push('📚 Review TypeScript best practices in docs/TYPESCRIPT_BEST_PRACTICES.md');
      recommendations.push('🛠️ Use type-safe utilities from src/utils/ to prevent common errors');
    }

    return recommendations;
  }

  private async calculateTrends(
    totalErrors: number, 
    anyTypeCount: number, 
    typeCodeage: number
  ): Promise<{ errorDelta: number; anyTypeDelta: number; coverageDelta: number }> {
    const trends = await this.loadTrends();
    
    if (trends.length === 0) {
      return { errorDelta: 0, anyTypeDelta: 0, coverageDelta: 0 };
    }

    const lastEntry = trends[trends.length - 1];
    
    return {
      errorDelta: totalErrors - lastEntry.totalErrors,
      anyTypeDelta: anyTypeCount - lastEntry.anyTypeCount,
      coverageDelta: typeCodeage - lastEntry.typeCodeage
    };
  }

  private async saveReport(report: TypeErrorReport): Promise<void> {
    const reportFile = join(this.reportsDir, `type-errors-${new Date().toISOString().split('T')[0]}.json`);
    writeFileSync(reportFile, JSON.stringify(report, null, 2));
    
    // Also save as latest report
    const latestFile = join(this.reportsDir, 'latest.json');
    writeFileSync(latestFile, JSON.stringify(report, null, 2));
    
    console.log(`📄 Report saved to: ${reportFile}`);
  }

  private async updateTrends(report: TypeErrorReport): Promise<void> {
    const trends = await this.loadTrends();
    
    const newEntry: TrendData = {
      date: report.timestamp.split('T')[0],
      totalErrors: report.totalErrors,
      anyTypeCount: report.anyTypeCount,
      typeCodeage: report.typeCodeage,
      commitHash: this.getCurrentCommitHash(),
      branch: this.getCurrentBranch()
    };

    trends.push(newEntry);
    
    // Keep only last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const filteredTrends = trends.filter(entry => 
      new Date(entry.date) >= thirtyDaysAgo
    );

    writeFileSync(this.trendsFile, JSON.stringify(filteredTrends, null, 2));
  }

  private async loadTrends(): Promise<TrendData[]> {
    if (!existsSync(this.trendsFile)) {
      return [];
    }
    
    try {
      const content = readFileSync(this.trendsFile, 'utf8');
      return JSON.parse(content);
    } catch {
      return [];
    }
  }

  private getCurrentCommitHash(): string {
    try {
      return execSync('git rev-parse HEAD', { encoding: 'utf8', cwd: this.projectRoot }).trim();
    } catch {
      return 'unknown';
    }
  }

  private getCurrentBranch(): string {
    try {
      return execSync('git branch --show-current', { encoding: 'utf8', cwd: this.projectRoot }).trim();
    } catch {
      return 'unknown';
    }
  }

  private printSummary(report: TypeErrorReport): void {
    console.log('\n📊 Type Safety Report Summary');
    console.log('================================');
    console.log(`📅 Generated: ${report.timestamp}`);
    console.log(`🚨 Total Errors: ${report.totalErrors}`);
    console.log(`🎯 Any Types: ${report.anyTypeCount}`);
    console.log(`📈 Type Coverage: ${report.typeCodeage.toFixed(1)}%`);
    
    if (report.trends.errorDelta !== 0) {
      const delta = report.trends.errorDelta > 0 ? '+' : '';
      console.log(`📊 Error Trend: ${delta}${report.trends.errorDelta} from last run`);
    }

    console.log('\n🔍 Top Error Patterns:');
    report.errorPatterns.slice(0, 5).forEach((pattern, index) => {
      const icon = pattern.category === 'critical' ? '🚨' : 
                   pattern.category === 'high' ? '⚡' : 
                   pattern.category === 'medium' ? '⚠️' : 'ℹ️';
      console.log(`  ${index + 1}. ${icon} ${pattern.code}: ${pattern.count} (${pattern.description})`);
    });

    if (report.recommendations.length > 0) {
      console.log('\n💡 Recommendations:');
      report.recommendations.slice(0, 3).forEach(rec => {
        console.log(`  ${rec}`);
      });
    }

    console.log(`\n📄 Full report: ${join(this.reportsDir, 'latest.json')}`);
  }

  async generateTrendChart(): Promise<void> {
    const trends = await this.loadTrends();
    
    if (trends.length < 2) {
      console.log('⚠️ Not enough data for trend analysis');
      return;
    }

    console.log('\n📈 Type Safety Trends (Last 30 Days)');
    console.log('=====================================');
    
    const latest = trends[trends.length - 1];
    const previous = trends[trends.length - 2];
    
    const errorChange = latest.totalErrors - previous.totalErrors;
    const anyChange = latest.anyTypeCount - previous.anyTypeCount;
    const coverageChange = latest.typeCodeage - previous.typeCodeage;
    
    console.log(`Errors: ${latest.totalErrors} (${errorChange >= 0 ? '+' : ''}${errorChange})`);
    console.log(`Any Types: ${latest.anyTypeCount} (${anyChange >= 0 ? '+' : ''}${anyChange})`);
    console.log(`Coverage: ${latest.typeCodeage.toFixed(1)}% (${coverageChange >= 0 ? '+' : ''}${coverageChange.toFixed(1)}%)`);
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const reporter = new TypeErrorReporter();

  if (args.includes('--trends-only')) {
    await reporter.generateTrendChart();
  } else {
    await reporter.generateReport();
    
    if (args.includes('--trends')) {
      await reporter.generateTrendChart();
    }
  }
}

if (require.main === module) {
  main().catch(console.error);
}

export { TypeErrorReporter };