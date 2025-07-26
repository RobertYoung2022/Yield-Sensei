#!/usr/bin/env tsx
/**
 * Pre-commit type checking script
 * Ensures TypeScript compliance before commits
 */

import { execSync } from 'child_process';
import { existsSync } from 'fs';

interface TypeCheckResult {
  success: boolean;
  errors: string[];
  warnings: string[];
}

class PreCommitTypeChecker {
  private projectRoot: string;

  constructor() {
    this.projectRoot = process.cwd();
  }

  async runPreCommitChecks(): Promise<TypeCheckResult> {
    const result: TypeCheckResult = {
      success: false,
      errors: [],
      warnings: []
    };

    console.log('🔍 Running pre-commit type checks...');

    try {
      // Check if TypeScript files are staged
      const stagedFiles = this.getStagedTypeScriptFiles();
      if (stagedFiles.length === 0) {
        console.log('📝 No TypeScript files staged, skipping type check');
        result.success = true;
        return result;
      }

      console.log(`📝 Found ${stagedFiles.length} staged TypeScript files`);

      // Run incremental type check
      await this.runIncrementalTypeCheck(result);

      // Run lint on staged files
      await this.runLintOnStagedFiles(result, stagedFiles);

      // Check type coverage for changed files
      await this.checkTypeCoverageForChanges(result, stagedFiles);

      result.success = result.errors.length === 0;

      this.printResults(result);

      if (!result.success) {
        console.log('\n❌ Pre-commit checks failed. Please fix the issues above.');
        process.exit(1);
      }

      console.log('\n✅ Pre-commit checks passed!');
      return result;

    } catch (error) {
      console.error('❌ Pre-commit check failed:', error);
      process.exit(1);
    }
  }

  private getStagedTypeScriptFiles(): string[] {
    try {
      const output = execSync('git diff --cached --name-only', { encoding: 'utf8' });
      return output
        .split('\n')
        .filter(file => file.endsWith('.ts') || file.endsWith('.tsx'))
        .filter(file => file.length > 0)
        .filter(file => existsSync(file));
    } catch (error) {
      return [];
    }
  }

  private async runIncrementalTypeCheck(result: TypeCheckResult): Promise<void> {
    console.log('🔍 Running incremental type check...');

    try {
      const output = execSync(
        'npx tsc --noEmit --incremental',
        { encoding: 'utf8', cwd: this.projectRoot }
      );

      console.log('✅ TypeScript compilation passed');
    } catch (error: any) {
      const errorOutput = error.stdout || error.stderr || error.message;
      
      // Parse TypeScript errors
      const errors = this.parseTypeScriptErrors(errorOutput);
      result.errors.push(...errors);

      if (errors.length > 0) {
        console.log(`❌ Found ${errors.length} TypeScript errors`);
        errors.slice(0, 5).forEach(err => console.log(`  ${err}`));
        
        if (errors.length > 5) {
          console.log(`  ... and ${errors.length - 5} more errors`);
        }
      }
    }
  }

  private async runLintOnStagedFiles(result: TypeCheckResult, stagedFiles: string[]): Promise<void> {
    console.log('🧹 Running ESLint on staged files...');

    if (stagedFiles.length === 0) return;

    try {
      const files = stagedFiles.join(' ');
      const output = execSync(
        `npx eslint ${files} --format compact`,
        { encoding: 'utf8', cwd: this.projectRoot }
      );

      console.log('✅ ESLint passed');
    } catch (error: any) {
      const errorOutput = error.stdout || error.stderr || error.message;
      
      // Parse ESLint errors and warnings
      const { errors, warnings } = this.parseESLintOutput(errorOutput);
      
      result.errors.push(...errors);
      result.warnings.push(...warnings);

      if (errors.length > 0) {
        console.log(`❌ Found ${errors.length} ESLint errors`);
      }
      
      if (warnings.length > 0) {
        console.log(`⚠️ Found ${warnings.length} ESLint warnings`);
      }
    }
  }

  private async checkTypeCoverageForChanges(result: TypeCheckResult, stagedFiles: string[]): Promise<void> {
    console.log('📊 Checking type coverage for changed files...');

    try {
      // Run type coverage on specific files if possible
      // For now, we'll run a general check
      const output = execSync(
        'npx type-coverage --at-least 85',
        { encoding: 'utf8', cwd: this.projectRoot }
      );

      const coverageMatch = output.match(/(\d+\.?\d*)% type coverage/);
      if (coverageMatch) {
        const coverage = parseFloat(coverageMatch[1]);
        if (coverage < 85) {
          result.warnings.push(`Type coverage is ${coverage}% (below 85% threshold)`);
        } else {
          console.log(`✅ Type coverage: ${coverage}%`);
        }
      }
    } catch (error: any) {
      result.warnings.push('Unable to check type coverage');
    }
  }

  private parseTypeScriptErrors(output: string): string[] {
    const lines = output.split('\n');
    const errors: string[] = [];

    for (const line of lines) {
      if (line.includes('error TS') && !line.includes('node_modules')) {
        errors.push(line.trim());
      }
    }

    return errors;
  }

  private parseESLintOutput(output: string): { errors: string[]; warnings: string[] } {
    const lines = output.split('\n');
    const errors: string[] = [];
    const warnings: string[] = [];

    for (const line of lines) {
      if (line.includes(' error ') && !line.includes('node_modules')) {
        errors.push(line.trim());
      } else if (line.includes(' warning ') && !line.includes('node_modules')) {
        warnings.push(line.trim());
      }
    }

    return { errors, warnings };
  }

  private printResults(result: TypeCheckResult): void {
    console.log('\n📋 Pre-commit Check Results');
    console.log('================================');
    console.log(`Status: ${result.success ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`Errors: ${result.errors.length}`);
    console.log(`Warnings: ${result.warnings.length}`);

    if (result.warnings.length > 0) {
      console.log('\n⚠️ Warnings:');
      result.warnings.forEach(warning => console.log(`  ${warning}`));
    }
  }
}

// CLI interface
async function main() {
  const checker = new PreCommitTypeChecker();
  await checker.runPreCommitChecks();
}

if (require.main === module) {
  main().catch(console.error);
}

export { PreCommitTypeChecker };