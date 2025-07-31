#!/usr/bin/env node
/**
 * Encryption Validation CLI
 * 
 * Command-line interface for running encryption validation tests
 */

import { program } from 'commander';
import { writeFileSync } from 'fs';
import { encryptionValidationFramework } from './encryption-validation-framework';

// Define CLI program
program
  .name('encryption-validation')
  .description('Encryption Mechanism Validation CLI')
  .version('1.0.0');

// Main validation command
program
  .command('validate')
  .description('Run encryption validation tests')
  .option('-e, --environment <env>', 'Target environment', 'development')
  .option('-f, --format <format>', 'Output format (json|html|csv)', 'json')
  .option('-o, --output <file>', 'Output file path')
  .option('-v, --verbose', 'Verbose output')
  .action(async (options) => {
    try {
      if (options.verbose) {
        console.log(`🔐 Starting encryption validation for ${options.environment}`);
      }

      const report = await encryptionValidationFramework.runValidation(options.environment);
      const output = encryptionValidationFramework.exportReport(report, options.format);

      if (options.output) {
        writeFileSync(options.output, output);
        console.log(`📄 Validation report saved to: ${options.output}`);
      } else {
        console.log(output);
      }

      // Exit with appropriate code
      const exitCode = report.summary.highRiskIssues > 0 ? 1 : 0;
      process.exit(exitCode);

    } catch (error) {
      console.error('❌ Validation failed:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Quick validation command
program
  .command('quick')
  .description('Run quick encryption validation (critical tests only)')
  .option('-e, --environment <env>', 'Target environment', 'development')
  .action(async (options) => {
    try {
      console.log(`⚡ Running quick encryption validation for ${options.environment}`);
      
      // Run only critical tests
      const report = await encryptionValidationFramework.runValidation(options.environment);
      const testCases = Array.from(encryptionValidationFramework['testCases'].values()) as any[];
      const criticalResults = report.testResults.filter(r => 
        testCases.find(tc => tc.id === r.testId)?.severity === 'critical'
      );

      console.log(`\n📊 Quick Validation Results:`);
      console.log(`Critical Tests: ${criticalResults.length}`);
      console.log(`Passed: ${criticalResults.filter(r => r.passed).length}`);
      console.log(`Failed: ${criticalResults.filter(r => !r.passed).length}`);

      const criticalIssues = criticalResults.flatMap(r => r.vulnerabilities)
        .filter(v => v.severity === 'critical');

      if (criticalIssues.length > 0) {
        console.log(`\n🚨 Critical Issues Found:`);
        for (const issue of criticalIssues) {
          console.log(`  - ${issue.description}`);
        }
        process.exit(1);
      } else {
        console.log(`\n✅ No critical encryption issues found`);
        process.exit(0);
      }

    } catch (error) {
      console.error('❌ Quick validation failed:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// List tests command
program
  .command('list-tests')
  .description('List available encryption tests')
  .action(() => {
    const testCases = Array.from(encryptionValidationFramework['testCases'].values());
    
    console.log(`\n📋 Available Encryption Tests (${testCases.length} total):\n`);
    
    const categories = new Map<string, typeof testCases>();
    for (const test of testCases) {
      if (!categories.has(test.category)) {
        categories.set(test.category, []);
      }
      categories.get(test.category)!.push(test);
    }

    for (const [category, tests] of categories) {
      console.log(`\n🔹 ${category.replace(/_/g, ' ').toUpperCase()}:`);
      for (const test of tests) {
        const severityIcon = test.severity === 'critical' ? '🔴' : 
                           test.severity === 'high' ? '🟠' : 
                           test.severity === 'medium' ? '🟡' : '🟢';
        console.log(`  ${severityIcon} ${test.name} (${test.id})`);
        console.log(`     ${test.description}`);
      }
    }
  });

// Generate baseline command
program
  .command('baseline')
  .description('Generate encryption validation baseline')
  .option('-e, --environment <env>', 'Target environment', 'development')
  .option('-o, --output <file>', 'Output file path')
  .action(async (options) => {
    try {
      console.log(`📋 Generating encryption validation baseline for ${options.environment}`);
      
      const report = await encryptionValidationFramework.runValidation(options.environment);
      const baseline = {
        environment: options.environment,
        generated: new Date().toISOString(),
        version: '1.0.0',
        baseline: {
          overallScore: report.overallScore,
          testResults: report.testResults.map(r => ({
            testId: r.testId,
            passed: r.passed,
            score: r.score,
            vulnerabilityCount: r.vulnerabilities.length
          })),
          complianceStatus: report.summary.complianceStatus
        }
      };

      const output = JSON.stringify(baseline, null, 2);
      
      if (options.output) {
        writeFileSync(options.output, output);
        console.log(`📄 Baseline saved to: ${options.output}`);
      } else {
        console.log(output);
      }

    } catch (error) {
      console.error('❌ Baseline generation failed:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Compare with baseline command
program
  .command('compare')
  .description('Compare current state with baseline')
  .option('-b, --baseline <file>', 'Baseline file path')
  .option('-e, --environment <env>', 'Target environment', 'development')
  .action(async (options) => {
    try {
      if (!options.baseline) {
        console.error('❌ Baseline file is required for comparison');
        process.exit(1);
      }

      console.log(`🔍 Comparing ${options.environment} with baseline: ${options.baseline}`);
      
      const baselineContent = require('fs').readFileSync(options.baseline, 'utf8');
      const baseline = JSON.parse(baselineContent);
      
      const currentReport = await encryptionValidationFramework.runValidation(options.environment);
      
      console.log(`\n📊 Comparison Results:`);
      console.log(`Current Score: ${currentReport.overallScore} (Baseline: ${baseline.baseline.overallScore})`);
      
      const scoreDiff = currentReport.overallScore - baseline.baseline.overallScore;
      if (scoreDiff > 0) {
        console.log(`✅ Improved by ${scoreDiff} points`);
      } else if (scoreDiff < 0) {
        console.log(`⚠️ Decreased by ${Math.abs(scoreDiff)} points`);
      } else {
        console.log(`➡️ No change in overall score`);
      }

      // Compare individual tests
      const newFailures: string[] = [];
      const newPasses: string[] = [];
      
      for (const currentResult of currentReport.testResults) {
        const baselineResult = baseline.baseline.testResults.find((r: any) => r.testId === currentResult.testId);
        if (baselineResult) {
          if (!currentResult.passed && baselineResult.passed) {
            newFailures.push(currentResult.testId);
          } else if (currentResult.passed && !baselineResult.passed) {
            newPasses.push(currentResult.testId);
          }
        }
      }

      if (newFailures.length > 0) {
        console.log(`\n🔴 New Test Failures:`);
        for (const failure of newFailures) {
          console.log(`  - ${failure}`);
        }
      }

      if (newPasses.length > 0) {
        console.log(`\n🟢 New Test Passes:`);
        for (const pass of newPasses) {
          console.log(`  - ${pass}`);
        }
      }

      if (newFailures.length === 0 && newPasses.length === 0) {
        console.log(`\n➡️ No changes in test results`);
      }

    } catch (error) {
      console.error('❌ Comparison failed:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Parse command line arguments
program.parse();

export { program };