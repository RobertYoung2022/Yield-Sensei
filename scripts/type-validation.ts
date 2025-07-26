#!/usr/bin/env tsx
/**
 * Comprehensive TypeScript type validation script
 * Provides staged strictness improvements and detailed type checking
 */

import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

interface ValidationOptions {
  mode: 'strict' | 'progressive' | 'minimal';
  checkCoverage: boolean;
  generateReport: boolean;
  failOnError: boolean;
  verbose: boolean;
}

interface ValidationResult {
  success: boolean;
  errors: number;
  warnings: number;
  coverage?: number;
  duration: number;
  details: string[];
}

class TypeValidator {
  private projectRoot: string;
  private options: ValidationOptions;

  constructor(options: Partial<ValidationOptions> = {}) {
    this.projectRoot = process.cwd();
    this.options = {
      mode: 'strict',
      checkCoverage: true,
      generateReport: false,
      failOnError: true,
      verbose: false,
      ...options
    };
  }

  async validateTypes(): Promise<ValidationResult> {
    const startTime = Date.now();
    const result: ValidationResult = {
      success: false,
      errors: 0,
      warnings: 0,
      duration: 0,
      details: []
    };

    console.log('🔍 Starting TypeScript validation...');
    console.log(`Mode: ${this.options.mode}`);

    try {
      // Step 1: Basic type checking
      await this.runTypeCheck(result);

      // Step 2: Check type coverage if enabled
      if (this.options.checkCoverage) {
        await this.checkTypeCoverage(result);
      }

      // Step 3: Lint with TypeScript rules
      await this.runTypedLint(result);

      // Step 4: Progressive strictness checks
      if (this.options.mode === 'progressive') {
        await this.runProgressiveChecks(result);
      }

      // Step 5: Generate report if requested
      if (this.options.generateReport) {
        await this.generateValidationReport(result);
      }

      result.success = result.errors === 0;
      result.duration = Date.now() - startTime;

      this.printSummary(result);
      
      if (!result.success && this.options.failOnError) {
        process.exit(1);
      }

      return result;
    } catch (error) {
      console.error('❌ Type validation failed:', error);
      result.duration = Date.now() - startTime;
      
      if (this.options.failOnError) {
        process.exit(1);
      }
      
      return result;
    }
  }

  private async runTypeCheck(result: ValidationResult): Promise<void> {
    console.log('🔍 Running TypeScript compiler checks...');

    const configs = this.getConfigsForMode();
    
    for (const config of configs) {
      try {
        console.log(`   Checking with ${config}...`);
        const output = execSync(
          `npx tsc --project ${config} --noEmit --pretty --listFiles false`,
          { encoding: 'utf8', cwd: this.projectRoot }
        );
        
        if (this.options.verbose) {
          console.log(output);
        }
        
        result.details.push(`✅ ${config}: Type check passed`);
      } catch (error: any) {
        const errorOutput = error.stdout || error.stderr || error.message;
        const errorCount = this.countTypeScriptErrors(errorOutput);
        
        result.errors += errorCount;
        result.details.push(`❌ ${config}: ${errorCount} type errors`);
        
        if (this.options.verbose) {
          console.log(errorOutput);
        }
      }
    }
  }

  private async checkTypeCoverage(result: ValidationResult): Promise<void> {
    console.log('📊 Checking type coverage...');

    try {
      const output = execSync(
        'npx type-coverage --detail --at-least 85',
        { encoding: 'utf8', cwd: this.projectRoot }
      );
      
      const coverageMatch = output.match(/(\d+\.?\d*)% type coverage/);
      if (coverageMatch) {
        result.coverage = parseFloat(coverageMatch[1]);
        result.details.push(`📊 Type coverage: ${result.coverage}%`);
        
        if (result.coverage < 85) {
          result.warnings++;
          result.details.push('⚠️ Type coverage below 85% threshold');
        }
      }
      
      if (this.options.verbose) {
        console.log(output);
      }
    } catch (error: any) {
      const errorOutput = error.stdout || error.stderr || error.message;
      result.warnings++;
      result.details.push('⚠️ Type coverage check failed');
      
      if (this.options.verbose) {
        console.log(errorOutput);
      }
    }
  }

  private async runTypedLint(result: ValidationResult): Promise<void> {
    console.log('🧹 Running ESLint with TypeScript rules...');

    try {
      const output = execSync(
        'npx eslint "src/**/*.ts" --format compact',
        { encoding: 'utf8', cwd: this.projectRoot }
      );
      
      result.details.push('✅ ESLint: No type-related issues');
      
      if (this.options.verbose && output) {
        console.log(output);
      }
    } catch (error: any) {
      const errorOutput = error.stdout || error.stderr || error.message;
      const lintErrors = this.countESLintErrors(errorOutput);
      
      result.warnings += lintErrors;
      result.details.push(`⚠️ ESLint: ${lintErrors} style/type warnings`);
      
      if (this.options.verbose) {
        console.log(errorOutput);
      }
    }
  }

  private async runProgressiveChecks(result: ValidationResult): Promise<void> {
    console.log('🎯 Running progressive strictness checks...');

    const progressiveConfigs = [
      { name: 'noImplicitAny', flag: '--noImplicitAny' },
      { name: 'strictNullChecks', flag: '--strictNullChecks' },
      { name: 'strictFunctionTypes', flag: '--strictFunctionTypes' },
      { name: 'strictBindCallApply', flag: '--strictBindCallApply' },
      { name: 'strictPropertyInitialization', flag: '--strictPropertyInitialization' }
    ];

    for (const config of progressiveConfigs) {
      try {
        console.log(`   Testing ${config.name}...`);
        execSync(
          `npx tsc --noEmit ${config.flag} --skipLibCheck`,
          { encoding: 'utf8', cwd: this.projectRoot }
        );
        
        result.details.push(`✅ ${config.name}: Ready for enforcement`);
      } catch (error: any) {
        const errorOutput = error.stdout || error.stderr || error.message;
        const errorCount = this.countTypeScriptErrors(errorOutput);
        
        result.details.push(`📋 ${config.name}: ${errorCount} issues to resolve`);
      }
    }
  }

  private async generateValidationReport(result: ValidationResult): Promise<void> {
    console.log('📝 Generating validation report...');

    const report = {
      timestamp: new Date().toISOString(),
      mode: this.options.mode,
      summary: {
        success: result.success,
        errors: result.errors,
        warnings: result.warnings,
        coverage: result.coverage,
        duration: result.duration
      },
      details: result.details
    };

    const reportPath = join(this.projectRoot, 'reports', 'type-validation.json');
    
    try {
      const fs = await import('fs/promises');
      await fs.mkdir(join(this.projectRoot, 'reports'), { recursive: true });
      await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
      
      result.details.push(`📝 Report saved to: ${reportPath}`);
    } catch (error) {
      result.warnings++;
      result.details.push('⚠️ Failed to save validation report');
    }
  }

  private getConfigsForMode(): string[] {
    switch (this.options.mode) {
      case 'strict':
        return ['tsconfig.typecheck.json', 'tsconfig.build.json'];
      case 'progressive':
        return ['tsconfig.json'];
      case 'minimal':
        return ['tsconfig.build.json'];
      default:
        return ['tsconfig.json'];
    }
  }

  private countTypeScriptErrors(output: string): number {
    const errorLines = output.split('\n').filter(line => 
      line.includes('error TS') || line.includes(': error')
    );
    return errorLines.length;
  }

  private countESLintErrors(output: string): number {
    const errorLines = output.split('\n').filter(line => 
      line.includes(' error ') || line.includes(' warning ')
    );
    return errorLines.length;
  }

  private printSummary(result: ValidationResult): void {
    console.log('\n📋 Validation Summary');
    console.log('=====================================');
    console.log(`Status: ${result.success ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`Errors: ${result.errors}`);
    console.log(`Warnings: ${result.warnings}`);
    
    if (result.coverage !== undefined) {
      console.log(`Type Coverage: ${result.coverage}%`);
    }
    
    console.log(`Duration: ${result.duration}ms`);
    console.log('=====================================');
    
    if (result.details.length > 0) {
      console.log('\n📝 Details:');
      result.details.forEach(detail => console.log(`  ${detail}`));
    }
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const options: Partial<ValidationOptions> = {
    verbose: args.includes('--verbose') || args.includes('-v'),
    generateReport: args.includes('--report') || args.includes('-r'),
    failOnError: !args.includes('--no-fail'),
    checkCoverage: !args.includes('--no-coverage')
  };

  if (args.includes('--mode=progressive')) {
    options.mode = 'progressive';
  } else if (args.includes('--mode=minimal')) {
    options.mode = 'minimal';
  } else {
    options.mode = 'strict';
  }

  const validator = new TypeValidator(options);
  await validator.validateTypes();
}

if (require.main === module) {
  main().catch(console.error);
}

export { TypeValidator, ValidationOptions, ValidationResult };