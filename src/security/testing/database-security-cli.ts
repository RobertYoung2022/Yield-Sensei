#!/usr/bin/env node
/**
 * Database Security Validation CLI
 * 
 * Command-line interface for database security testing and validation
 */

import { program } from 'commander';
import { writeFileSync } from 'fs';
import { databaseSecurityValidator } from './database-security-validation';

// Define CLI program
program
  .name('database-security')
  .description('Database Security Validation CLI')
  .version('1.0.0');

// Main validation command
program
  .command('validate')
  .description('Run comprehensive database security validation')
  .option('-e, --environment <env>', 'Target environment', 'development')
  .option('-f, --format <format>', 'Output format (json|html|csv)', 'json')
  .option('-o, --output <file>', 'Output file path')
  .option('-v, --verbose', 'Verbose output')
  .action(async (options) => {
    try {
      if (options.verbose) {
        console.log(`🔒 Starting database security validation for ${options.environment}`);
      }

      const report = await databaseSecurityValidator.runValidation(options.environment);
      const output = databaseSecurityValidator.exportReport(report, options.format);

      if (options.output) {
        writeFileSync(options.output, output);
        console.log(`📄 Database security report saved to: ${options.output}`);
      } else {
        console.log(output);
      }

      // Exit with appropriate code
      const exitCode = report.summary.criticalVulnerabilities > 0 ? 1 : 0;
      process.exit(exitCode);

    } catch (error) {
      console.error('❌ Validation failed:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Quick validation command
program
  .command('quick')
  .description('Run quick database security check (critical issues only)')
  .option('-e, --environment <env>', 'Target environment', 'development')
  .action(async (options) => {
    try {
      console.log(`⚡ Running quick database security check for ${options.environment}`);
      
      const report = await databaseSecurityValidator.runValidation(options.environment);
      const criticalVulns = report.testResults.flatMap(r => r.vulnerabilities)
        .filter(v => v.severity === 'critical');
      const highRiskVulns = report.testResults.flatMap(r => r.vulnerabilities)
        .filter(v => v.severity === 'high');

      console.log(`\n📊 Quick Security Check Results:`);
      console.log(`Environment: ${report.environment}`);
      console.log(`Overall Score: ${report.summary.overallScore}/100`);
      console.log(`Security Level: ${report.summary.securityLevel.toUpperCase()}`);
      console.log(`Compliance Status: ${report.summary.complianceStatus.replace('_', ' ').toUpperCase()}`);
      console.log(`Critical Vulnerabilities: ${report.summary.criticalVulnerabilities}`);
      console.log(`High Risk Issues: ${report.summary.highRiskIssues}`);

      if (criticalVulns.length > 0) {
        console.log(`\n🚨 Critical Issues Found:`);
        for (const vuln of criticalVulns.slice(0, 5)) {
          console.log(`  - ${vuln.description}`);
        }
        if (criticalVulns.length > 5) {
          console.log(`  ... and ${criticalVulns.length - 5} more`);
        }
        process.exit(1);
      } else if (highRiskVulns.length > 0) {
        console.log(`\n⚠️ High Risk Issues Found:`);
        for (const vuln of highRiskVulns.slice(0, 3)) {
          console.log(`  - ${vuln.description}`);
        }
        if (highRiskVulns.length > 3) {
          console.log(`  ... and ${highRiskVulns.length - 3} more`);
        }
        console.log(`\n⚠️ Consider addressing high risk issues`);
        process.exit(0);
      } else {
        console.log(`\n✅ No critical database security issues found`);
        if (report.summary.overallScore < 80) {
          console.log(`⚠️ Security score is below 80, consider reviewing recommendations`);
        }
        process.exit(0);
      }

    } catch (error) {
      console.error('❌ Quick validation failed:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Connection test command
program
  .command('test-connections')
  .description('Test database connection security')
  .option('-e, --environment <env>', 'Target environment', 'development')
  .action(async (options) => {
    try {
      console.log(`🔗 Testing database connections for ${options.environment}`);
      
      const report = await databaseSecurityValidator.runValidation(options.environment);
      const connectionTests = report.testResults.filter(r => r.category === 'connection');
      
      console.log(`\n📊 Connection Security Results:`);
      console.log(`Connections Tested: ${report.databaseAnalysis.connections.length}`);
      
      for (const connection of report.databaseAnalysis.connections) {
        const statusIcon = connection.ssl ? '🔒' : '🔓';
        console.log(`\n${statusIcon} ${connection.name} (${connection.type}):`);
        console.log(`  Host: ${connection.host}:${connection.port}`);
        console.log(`  SSL Enabled: ${connection.ssl ? 'Yes' : 'No'}`);
        console.log(`  TLS Version: ${connection.tlsVersion || 'N/A'}`);
        console.log(`  Certificate Validation: ${connection.certificateValidation ? 'Yes' : 'No'}`);
        console.log(`  Encrypted at Rest: ${connection.encrypted ? 'Yes' : 'No'}`);
      }

      const connectionIssues = connectionTests.filter(t => !t.passed);
      if (connectionIssues.length > 0) {
        console.log(`\n⚠️ Connection Issues Found:`);
        for (const issue of connectionIssues) {
          console.log(`  - ${issue.name}: ${issue.vulnerabilities.length} vulnerabilities`);
        }
      } else {
        console.log(`\n✅ All connection security tests passed`);
      }

    } catch (error) {
      console.error('❌ Connection test failed:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Access control test command
program
  .command('test-access')
  .description('Test database access controls and authentication')
  .option('-e, --environment <env>', 'Target environment', 'development')
  .action(async (options) => {
    try {
      console.log(`🔐 Testing database access controls for ${options.environment}`);
      
      const report = await databaseSecurityValidator.runValidation(options.environment);
      const accessTests = report.testResults.filter(r => r.category === 'access_control');
      
      console.log(`\n📊 Access Control Results:`);
      
      for (const test of accessTests) {
        const statusIcon = test.passed ? '✅' : '❌';
        console.log(`\n${statusIcon} ${test.name}:`);
        console.log(`  Score: ${test.score}/100`);
        console.log(`  Status: ${test.passed ? 'PASSED' : 'FAILED'}`);
        
        if (test.vulnerabilities.length > 0) {
          console.log(`  Issues:`);
          for (const vuln of test.vulnerabilities) {
            const severityIcon = vuln.severity === 'critical' ? '🔴' : 
                               vuln.severity === 'high' ? '🟠' : 
                               vuln.severity === 'medium' ? '🟡' : '🟢';
            console.log(`    ${severityIcon} ${vuln.description}`);
          }
        }
      }

      // Show encryption status
      console.log(`\n🔒 Encryption Status:`);
      console.log(`  Data at Rest: ${report.databaseAnalysis.encryptionStatus.atRest ? 'Encrypted' : 'Not Encrypted'}`);
      console.log(`  Data in Transit: ${report.databaseAnalysis.encryptionStatus.inTransit ? 'Encrypted' : 'Not Encrypted'}`);
      console.log(`  Key Management: ${report.databaseAnalysis.encryptionStatus.keyManagement.toUpperCase()}`);

    } catch (error) {
      console.error('❌ Access control test failed:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Security scan command
program
  .command('scan')
  .description('Perform comprehensive security scan')
  .option('-e, --environment <env>', 'Target environment', 'development')
  .option('--include-tests <tests>', 'Comma-separated list of test categories to include')
  .option('--exclude-tests <tests>', 'Comma-separated list of test categories to exclude')
  .action(async (options) => {
    try {
      console.log(`🔍 Performing database security scan for ${options.environment}`);
      
      const report = await databaseSecurityValidator.runValidation(options.environment);
      
      // Filter tests if specified
      let filteredResults = report.testResults;
      
      if (options.includeTests) {
        const includeCategories = options.includeTests.split(',').map((s: string) => s.trim());
        filteredResults = filteredResults.filter(r => includeCategories.includes(r.category));
      }
      
      if (options.excludeTests) {
        const excludeCategories = options.excludeTests.split(',').map((s: string) => s.trim());
        filteredResults = filteredResults.filter(r => !excludeCategories.includes(r.category));
      }

      console.log(`\n📊 Security Scan Results:`);
      console.log(`Environment: ${report.environment}`);
      console.log(`Tests Run: ${filteredResults.length}`);
      console.log(`Overall Score: ${report.summary.overallScore}/100`);
      console.log(`Security Level: ${report.summary.securityLevel.toUpperCase()}`);

      // Group results by category
      const categories = new Map<string, typeof filteredResults>();
      for (const result of filteredResults) {
        if (!categories.has(result.category)) {
          categories.set(result.category, []);
        }
        categories.get(result.category)!.push(result);
      }

      for (const [category, tests] of categories) {
        const passed = tests.filter(t => t.passed).length;
        const total = tests.length;
        const statusIcon = passed === total ? '✅' : passed > 0 ? '⚠️' : '❌';
        
        console.log(`\n${statusIcon} ${category.replace('_', ' ').toUpperCase()}: ${passed}/${total} passed`);
        
        for (const test of tests) {
          const testIcon = test.passed ? '  ✅' : '  ❌';
          console.log(`${testIcon} ${test.name} (${test.score}/100)`);
          
          if (!test.passed && test.vulnerabilities.length > 0) {
            for (const vuln of test.vulnerabilities.slice(0, 2)) {
              console.log(`    - ${vuln.description}`);
            }
            if (test.vulnerabilities.length > 2) {
              console.log(`    ... and ${test.vulnerabilities.length - 2} more issues`);
            }
          }
        }
      }

      if (report.recommendations.length > 0) {
        console.log(`\n💡 Recommendations:`);
        for (const rec of report.recommendations.slice(0, 5)) {
          console.log(`  - ${rec}`);
        }
        if (report.recommendations.length > 5) {
          console.log(`  ... and ${report.recommendations.length - 5} more`);
        }
      }

    } catch (error) {
      console.error('❌ Security scan failed:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Generate baseline command
program
  .command('baseline')
  .description('Generate database security baseline')
  .option('-e, --environment <env>', 'Target environment', 'development')
  .option('-o, --output <file>', 'Output file path')
  .action(async (options) => {
    try {
      console.log(`📋 Generating database security baseline for ${options.environment}`);
      
      const report = await databaseSecurityValidator.runValidation(options.environment);
      const baseline = {
        environment: options.environment,
        generated: new Date().toISOString(),
        version: '1.0.0',
        baseline: {
          overallScore: report.summary.overallScore,
          securityLevel: report.summary.securityLevel,
          complianceStatus: report.summary.complianceStatus,
          testResults: report.testResults.map(r => ({
            testId: r.testId,
            category: r.category,
            passed: r.passed,
            score: r.score,
            vulnerabilityCount: r.vulnerabilities.length
          })),
          databaseAnalysis: report.databaseAnalysis
        }
      };

      const output = JSON.stringify(baseline, null, 2);
      
      if (options.output) {
        writeFileSync(options.output, output);
        console.log(`📄 Baseline saved to: ${options.output}`);
      } else {
        console.log(output);
      }

      console.log(`\n📊 Baseline Summary:`);
      console.log(`Overall Score: ${report.summary.overallScore}/100`);
      console.log(`Security Level: ${report.summary.securityLevel.toUpperCase()}`);
      console.log(`Total Tests: ${report.summary.totalTests}`);
      console.log(`Connections: ${report.databaseAnalysis.connections.length}`);

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
      
      const currentReport = await databaseSecurityValidator.runValidation(options.environment);
      
      console.log(`\n📊 Comparison Results:`);
      console.log(`Current Score: ${currentReport.summary.overallScore} (Baseline: ${baseline.baseline.overallScore})`);
      
      const scoreDiff = currentReport.summary.overallScore - baseline.baseline.overallScore;
      if (scoreDiff > 0) {
        console.log(`✅ Improved by ${scoreDiff} points`);
      } else if (scoreDiff < 0) {
        console.log(`⚠️ Decreased by ${Math.abs(scoreDiff)} points`);
      } else {
        console.log(`➡️ No change in overall score`);
      }

      console.log(`Current Security Level: ${currentReport.summary.securityLevel.toUpperCase()} (Baseline: ${baseline.baseline.securityLevel.toUpperCase()})`);

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

      // Exit with error if security degraded
      if (scoreDiff < 0 || newFailures.length > 0) {
        process.exit(1);
      }

    } catch (error) {
      console.error('❌ Comparison failed:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// List available tests command
program
  .command('list-tests')
  .description('List available database security tests')
  .action(() => {
    const testCases = Array.from(databaseSecurityValidator['testCases'].values());
    
    console.log(`\n📋 Available Database Security Tests (${testCases.length} total):\n`);
    
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
        console.log(`     Environments: ${test.environment.join(', ')}`);
      }
    }
  });

// Parse command line arguments
program.parse();

export { program };