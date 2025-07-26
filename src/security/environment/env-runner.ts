#!/usr/bin/env node

/**
 * Environment Variable Security Validation Runner
 * 
 * Command-line tool to run comprehensive environment variable security testing
 */

import { Command } from 'commander';
import { EnvironmentVariableValidator, EnvSecurityConfig } from './env-validator';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

interface RunnerOptions {
  output?: string;
  format: 'json' | 'markdown' | 'console';
  verbose: boolean;
  includeNodeModules: boolean;
  checkGitHistory: boolean;
  projectRoot: string;
}

class EnvironmentValidationRunner {
  private validator?: EnvironmentVariableValidator;

  async initialize(options: RunnerOptions): Promise<void> {
    const config: Partial<EnvSecurityConfig> = {
      projectRoot: options.projectRoot,
      includeNodeModules: options.includeNodeModules,
      checkGitHistory: options.checkGitHistory,
      validateRequired: true
    };

    this.validator = new EnvironmentVariableValidator(config);
    console.log('✅ Environment variable validator initialized');
  }

  async runValidation(options: RunnerOptions): Promise<void> {
    if (!this.validator) {
      throw new Error('Validator not initialized');
    }

    console.log('🔍 Starting environment variable security validation...\n');

    const startTime = Date.now();
    
    try {
      const summary = await this.validator.validateAll();
      const endTime = Date.now();
      const duration = endTime - startTime;

      // Display results
      this.displayResults(summary, duration, options);

      // Save results if output specified
      if (options.output) {
        await this.saveResults(summary, options);
      }

      // Exit with appropriate code
      const exitCode = summary.criticalIssues > 0 ? 2 : summary.highIssues > 0 ? 1 : 0;
      process.exit(exitCode);

    } catch (error) {
      console.error('❌ Validation failed:', error);
      process.exit(1);
    }
  }

  private displayResults(summary: any, duration: number, options: RunnerOptions): void {
    console.log('\n📊 Environment Variable Security Results');
    console.log('========================================\n');

    // Overall statistics
    console.log(`✅ Tests Passed:       ${summary.passed}/${summary.totalTests}`);
    console.log(`❌ Tests Failed:       ${summary.failed}/${summary.totalTests}`);
    console.log(`📈 Success Rate:       ${summary.successRate.toFixed(2)}%`);
    console.log(`⏱️  Duration:           ${duration}ms\n`);

    // Severity breakdown
    if (summary.criticalIssues > 0 || summary.highIssues > 0 || summary.mediumIssues > 0) {
      console.log('🚨 Issues by Severity:');
      if (summary.criticalIssues > 0) {
        console.log(`   🔴 Critical:        ${summary.criticalIssues}`);
      }
      if (summary.highIssues > 0) {
        console.log(`   🟠 High:            ${summary.highIssues}`);
      }
      if (summary.mediumIssues > 0) {
        console.log(`   🟡 Medium:          ${summary.mediumIssues}`);
      }
      if (summary.lowIssues > 0) {
        console.log(`   🟢 Low:             ${summary.lowIssues}`);
      }
      console.log('');
    }

    // Category breakdown
    console.log('📋 Results by Category:');
    Object.entries(summary.categories).forEach(([category, stats]: [string, any]) => {
      const successRate = ((stats.passed / (stats.passed + stats.failed)) * 100).toFixed(1);
      console.log(`   ${category.padEnd(15)} ${stats.passed}/${stats.passed + stats.failed} (${successRate}%)`);
    });
    console.log('');

    // Priority issues
    if (summary.criticalIssues > 0 || summary.highIssues > 0) {
      console.log('⚠️  Priority Issues:');
      
      const priorityIssues = this.validator!.getResults().filter(r => 
        !r.passed && (r.severity === 'critical' || r.severity === 'high')
      ).slice(0, 5);
      
      priorityIssues.forEach(issue => {
        const severity = issue.severity === 'critical' ? '🔴' : '🟠';
        console.log(`   ${severity} ${issue.testName}`);
        if (issue.error && options.verbose) {
          console.log(`      Error: ${issue.error.substring(0, 80)}...`);
        }
      });
      
      if (priorityIssues.length < summary.criticalIssues + summary.highIssues) {
        console.log(`   ... and ${summary.criticalIssues + summary.highIssues - priorityIssues.length} more`);
      }
      console.log('');
    }

    // Recommendations
    if (summary.recommendations.length > 0) {
      console.log('💡 Top Recommendations:');
      summary.recommendations.slice(0, 5).forEach((rec: string) => {
        console.log(`   - ${rec}`);
      });
      console.log('');
    }

    // Detailed results (if verbose)
    if (options.verbose) {
      console.log('📋 Detailed Results:\n');
      this.displayDetailedResults();
    }

    // Overall status
    if (summary.criticalIssues > 0) {
      console.log('🔴 Environment security validation completed with CRITICAL issues');
    } else if (summary.highIssues > 0) {
      console.log('🟠 Environment security validation completed with HIGH priority issues');
    } else if (summary.mediumIssues > 0) {
      console.log('🟡 Environment security validation completed with medium issues');
    } else {
      console.log('✅ Environment security validation completed successfully');
    }
  }

  private displayDetailedResults(): void {
    if (!this.validator) return;

    const results = this.validator.getResults();
    const groupedResults = results.reduce((groups, result) => {
      if (!groups[result.category]) {
        groups[result.category] = [];
      }
      groups[result.category].push(result);
      return groups;
    }, {} as Record<string, any[]>);

    Object.entries(groupedResults).forEach(([category, categoryResults]) => {
      console.log(`\n${category.toUpperCase()}:`);
      
      categoryResults.forEach(result => {
        const status = result.passed ? '✅' : '❌';
        const severity = result.severity === 'critical' ? '🔴' : 
                        result.severity === 'high' ? '🟠' : 
                        result.severity === 'medium' ? '🟡' : '🟢';
        
        console.log(`  ${status} ${severity} ${result.testName}`);
        
        if (result.error) {
          console.log(`     Error: ${result.error}`);
        }
        
        if (result.details) {
          const details = Object.entries(result.details)
            .slice(0, 2)
            .map(([key, value]) => `${key}: ${Array.isArray(value) ? `${value.length} items` : value}`)
            .join(', ');
          if (details) {
            console.log(`     Details: ${details}`);
          }
        }
        
        if (result.recommendations && result.recommendations.length > 0) {
          console.log(`     Recommendations: ${result.recommendations[0]}`);
        }
      });
    });
  }

  private async saveResults(summary: any, options: RunnerOptions): Promise<void> {
    if (!options.output || !this.validator) return;

    const outputDir = join(process.cwd(), 'reports');
    if (!existsSync(outputDir)) {
      mkdirSync(outputDir, { recursive: true });
    }

    const outputPath = join(outputDir, options.output);
    
    try {
      let content: string;
      
      switch (options.format) {
        case 'json':
          const jsonReport = {
            summary,
            results: this.validator.getResults(),
            timestamp: new Date().toISOString(),
            version: '1.0.0'
          };
          content = JSON.stringify(jsonReport, null, 2);
          break;
          
        case 'markdown':
          content = this.validator.generateReport();
          break;
          
        default:
          content = this.formatConsoleReport(summary);
      }
      
      writeFileSync(outputPath, content);
      console.log(`\n📄 Results saved to: ${outputPath}`);
      
    } catch (error) {
      console.error(`❌ Failed to save results: ${error}`);
    }
  }

  private formatConsoleReport(summary: any): string {
    let report = 'Environment Variable Security Validation Results\n';
    report += '==============================================\n\n';
    
    report += `Tests Passed: ${summary.passed}/${summary.totalTests}\n`;
    report += `Tests Failed: ${summary.failed}/${summary.totalTests}\n`;
    report += `Success Rate: ${summary.successRate.toFixed(2)}%\n\n`;
    
    report += 'Issues by Severity:\n';
    report += `- Critical: ${summary.criticalIssues}\n`;
    report += `- High: ${summary.highIssues}\n`;
    report += `- Medium: ${summary.mediumIssues}\n`;
    report += `- Low: ${summary.lowIssues}\n\n`;
    
    if (summary.recommendations.length > 0) {
      report += 'Top Recommendations:\n';
      summary.recommendations.slice(0, 10).forEach((rec: string) => {
        report += `- ${rec}\n`;
      });
      report += '\n';
    }
    
    return report;
  }
}

// CLI Setup
const program = new Command();

program
  .name('env-validator')
  .description('YieldSensei Environment Variable Security Validator')
  .version('1.0.0');

program
  .command('validate')
  .description('Run environment variable security validation')
  .option('-o, --output <file>', 'Output file for results')
  .option('-f, --format <format>', 'Output format (json, markdown, console)', 'console')
  .option('-v, --verbose', 'Verbose output', false)
  .option('--include-node-modules', 'Include node_modules in scan', false)
  .option('--check-git-history', 'Check git history for secrets', false)
  .option('--project-root <path>', 'Project root directory', process.cwd())
  .action(async (options) => {
    const runner = new EnvironmentValidationRunner();
    
    try {
      await runner.initialize(options);
      
      const runnerOptions: RunnerOptions = {
        output: options.output,
        format: options.format,
        verbose: options.verbose,
        includeNodeModules: options.includeNodeModules,
        checkGitHistory: options.checkGitHistory,
        projectRoot: options.projectRoot
      };
      
      await runner.runValidation(runnerOptions);
      
    } catch (error) {
      console.error('❌ Validation failed:', error);
      process.exit(1);
    }
  });

program
  .command('quick')
  .description('Run quick environment variable security check')
  .option('-v, --verbose', 'Verbose output', false)
  .option('--project-root <path>', 'Project root directory', process.cwd())
  .action(async (options) => {
    const runner = new EnvironmentValidationRunner();
    
    try {
      const quickOptions = {
        format: 'console' as const,
        verbose: options.verbose,
        includeNodeModules: false,
        checkGitHistory: false,
        projectRoot: options.projectRoot
      };
      
      await runner.initialize(quickOptions);
      await runner.runValidation(quickOptions);
      
    } catch (error) {
      console.error('❌ Quick validation failed:', error);
      process.exit(1);
    }
  });

program
  .command('report')
  .description('Generate detailed environment security report')
  .option('-o, --output <file>', 'Output file', 'env-security-report.md')
  .option('-f, --format <format>', 'Output format (json, markdown)', 'markdown')
  .option('--include-git-history', 'Include git history analysis', false)
  .option('--project-root <path>', 'Project root directory', process.cwd())
  .action(async (options) => {
    const runner = new EnvironmentValidationRunner();
    
    try {
      const reportOptions = {
        output: options.output,
        format: options.format,
        verbose: true,
        includeNodeModules: false,
        checkGitHistory: options.includeGitHistory,
        projectRoot: options.projectRoot
      };
      
      await runner.initialize(reportOptions);
      await runner.runValidation(reportOptions);
      
    } catch (error) {
      console.error('❌ Report generation failed:', error);
      process.exit(1);
    }
  });

program
  .command('scan')
  .description('Scan for specific environment security issues')
  .option('--secrets-only', 'Only scan for exposed secrets', false)
  .option('--config-only', 'Only validate configuration', false)
  .option('--permissions-only', 'Only check file permissions', false)
  .option('--project-root <path>', 'Project root directory', process.cwd())
  .action(async (options) => {
    console.log('🔍 Running targeted environment security scan...');
    
    // This would implement targeted scanning based on options
    // For now, we'll run a quick validation
    const runner = new EnvironmentValidationRunner();
    
    const scanOptions = {
      format: 'console' as const,
      verbose: true,
      includeNodeModules: false,
      checkGitHistory: false,
      projectRoot: options.projectRoot
    };
    
    await runner.initialize(scanOptions);
    await runner.runValidation(scanOptions);
  });

// Export for testing
export { EnvironmentValidationRunner };

// CLI execution
if (require.main === module) {
  program.parse();
}