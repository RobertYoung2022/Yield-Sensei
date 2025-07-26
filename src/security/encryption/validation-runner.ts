#!/usr/bin/env node

/**
 * Encryption Validation Runner
 * 
 * Command-line tool to run comprehensive encryption validation
 */

import { Command } from 'commander';
import { EncryptionValidator } from './encryption-validator';
import { SecretManager, createDefaultSecretManagerConfig } from '../../config/secrets/index';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

interface ValidationOptions {
  output?: string;
  format: 'json' | 'markdown' | 'console';
  includePerformance: boolean;
  verbose: boolean;
  components: string[];
  quick: boolean;
}

class ValidationRunner {
  private secretManager?: SecretManager;
  private validator?: EncryptionValidator;

  async initialize(): Promise<void> {
    try {
      // Initialize secret manager if available
      const config = createDefaultSecretManagerConfig();
      this.secretManager = new SecretManager(config);
      await this.secretManager.initialize();

      // Initialize validator with all components
      this.validator = new EncryptionValidator(
        this.secretManager.getVaultManager(),
        this.secretManager.getKeyManager(),
        this.secretManager
      );

      console.log('✅ Encryption validation system initialized');
    } catch (error) {
      console.warn('⚠️ Could not initialize full secret management system');
      console.warn('   Running with standalone encryption validator');
      this.validator = new EncryptionValidator();
    }
  }

  async runValidation(options: ValidationOptions): Promise<void> {
    if (!this.validator) {
      throw new Error('Validator not initialized');
    }

    console.log('🔍 Starting encryption validation...\n');

    const startTime = Date.now();
    
    try {
      let summary;
      
      if (options.quick) {
        // Run quick validation (core algorithms only)
        summary = await this.runQuickValidation();
      } else {
        // Run full validation
        summary = await this.validator.validateAll();
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Display results
      this.displayResults(summary, duration, options);

      // Save results if output specified
      if (options.output) {
        await this.saveResults(summary, options);
      }

      // Exit with appropriate code
      const exitCode = summary.criticalFailures.length > 0 ? 1 : 0;
      process.exit(exitCode);

    } catch (error) {
      console.error('❌ Validation failed:', error);
      process.exit(1);
    }
  }

  private async runQuickValidation() {
    if (!this.validator) {
      throw new Error('Validator not initialized');
    }

    console.log('⚡ Running quick validation (core algorithms only)...');
    
    // Run only core algorithm tests
    await this.validator['testAESEncryption']();
    await this.validator['testHMACValidation']();
    await this.validator['testPasswordHashing']();
    
    return this.validator['generateSummary']();
  }

  private displayResults(summary: any, duration: number, options: ValidationOptions): void {
    console.log('\n📊 Encryption Validation Results');
    console.log('================================\n');

    // Summary statistics
    console.log(`✅ Tests Passed:     ${summary.passed}/${summary.totalTests}`);
    console.log(`❌ Tests Failed:     ${summary.failed}/${summary.totalTests}`);
    console.log(`📈 Success Rate:     ${summary.successRate.toFixed(2)}%`);
    console.log(`⏱️  Duration:         ${duration}ms\n`);

    // Critical failures
    if (summary.criticalFailures.length > 0) {
      console.log('🚨 Critical Failures:');
      summary.criticalFailures.forEach((failure: string) => {
        console.log(`   - ${failure}`);
      });
      console.log('');
    }

    // Warnings
    if (summary.warnings.length > 0) {
      console.log('⚠️  Warnings:');
      summary.warnings.forEach((warning: string) => {
        console.log(`   - ${warning}`);
      });
      console.log('');
    }

    // Recommendations
    if (summary.recommendations.length > 0) {
      console.log('💡 Recommendations:');
      summary.recommendations.forEach((rec: string) => {
        console.log(`   - ${rec}`);
      });
      console.log('');
    }

    // Detailed results (if verbose)
    if (options.verbose && this.validator) {
      console.log('📋 Detailed Results:\n');
      this.displayDetailedResults(options);
    }

    // Overall status
    if (summary.criticalFailures.length === 0) {
      console.log('✅ Encryption validation completed successfully');
    } else {
      console.log('❌ Encryption validation completed with critical issues');
    }
  }

  private displayDetailedResults(options: ValidationOptions): void {
    if (!this.validator) return;

    const results = this.validator.getResults();
    const groupedResults = results.reduce((groups, result) => {
      if (!groups[result.algorithm]) {
        groups[result.algorithm] = [];
      }
      groups[result.algorithm].push(result);
      return groups;
    }, {} as Record<string, any[]>);

    Object.entries(groupedResults).forEach(([algorithm, algorithmResults]) => {
      console.log(`\n${algorithm}:`);
      
      algorithmResults.forEach(result => {
        const status = result.passed ? '✅' : '❌';
        console.log(`  ${status} ${result.testName}`);
        
        if (result.error) {
          console.log(`     Error: ${result.error}`);
        }
        
        if (options.includePerformance && result.performance) {
          console.log(`     Time: ${result.performance.encryptionTime}ms, Size: ${result.performance.dataSize} bytes`);
        }
      });
    });
  }

  private async saveResults(summary: any, options: ValidationOptions): Promise<void> {
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
    let report = 'Encryption Validation Results\n';
    report += '============================\n\n';
    
    report += `Tests Passed: ${summary.passed}/${summary.totalTests}\n`;
    report += `Tests Failed: ${summary.failed}/${summary.totalTests}\n`;
    report += `Success Rate: ${summary.successRate.toFixed(2)}%\n\n`;
    
    if (summary.criticalFailures.length > 0) {
      report += 'Critical Failures:\n';
      summary.criticalFailures.forEach((failure: string) => {
        report += `- ${failure}\n`;
      });
      report += '\n';
    }
    
    if (summary.recommendations.length > 0) {
      report += 'Recommendations:\n';
      summary.recommendations.forEach((rec: string) => {
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
  .name('encryption-validator')
  .description('YieldSensei Encryption Validation Tool')
  .version('1.0.0');

program
  .command('validate')
  .description('Run encryption validation tests')
  .option('-o, --output <file>', 'Output file for results')
  .option('-f, --format <format>', 'Output format (json, markdown, console)', 'console')
  .option('--include-performance', 'Include performance metrics in output', false)
  .option('-v, --verbose', 'Verbose output', false)
  .option('--components <components>', 'Comma-separated list of components to test', '')
  .option('--quick', 'Run quick validation (core algorithms only)', false)
  .action(async (options) => {
    const runner = new ValidationRunner();
    
    try {
      await runner.initialize();
      
      const validationOptions: ValidationOptions = {
        output: options.output,
        format: options.format,
        includePerformance: options.includePerformance,
        verbose: options.verbose,
        components: options.components ? options.components.split(',') : [],
        quick: options.quick
      };
      
      await runner.runValidation(validationOptions);
      
    } catch (error) {
      console.error('❌ Validation failed:', error);
      process.exit(1);
    }
  });

program
  .command('quick')
  .description('Run quick encryption validation (core algorithms only)')
  .option('-v, --verbose', 'Verbose output', false)
  .action(async (options) => {
    const runner = new ValidationRunner();
    
    try {
      await runner.initialize();
      
      const validationOptions: ValidationOptions = {
        format: 'console',
        includePerformance: false,
        verbose: options.verbose,
        components: [],
        quick: true
      };
      
      await runner.runValidation(validationOptions);
      
    } catch (error) {
      console.error('❌ Quick validation failed:', error);
      process.exit(1);
    }
  });

program
  .command('report')
  .description('Generate detailed encryption validation report')
  .option('-o, --output <file>', 'Output file', 'encryption-validation-report.md')
  .option('-f, --format <format>', 'Output format (json, markdown)', 'markdown')
  .action(async (options) => {
    const runner = new ValidationRunner();
    
    try {
      await runner.initialize();
      
      const validationOptions: ValidationOptions = {
        output: options.output,
        format: options.format,
        includePerformance: true,
        verbose: true,
        components: [],
        quick: false
      };
      
      await runner.runValidation(validationOptions);
      
    } catch (error) {
      console.error('❌ Report generation failed:', error);
      process.exit(1);
    }
  });

// Export for testing
export { ValidationRunner };

// CLI execution
if (require.main === module) {
  program.parse();
}