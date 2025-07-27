#!/usr/bin/env node
/**
 * Comprehensive Security Validation CLI
 * 
 * Command-line interface for comprehensive security testing and validation
 */

import { program } from 'commander';
import { writeFileSync } from 'fs';
import { comprehensiveSecurityValidator } from './comprehensive-security-validation';

// Define CLI program
program
  .name('comprehensive-security')
  .description('Comprehensive Security Validation CLI')
  .version('1.0.0');

// Main validation command
program
  .command('validate')
  .description('Run comprehensive security validation')
  .option('-e, --environment <env>', 'Target environment', 'development')
  .option('-f, --format <format>', 'Output format (json|html|csv)', 'json')
  .option('-o, --output <file>', 'Output file path')
  .option('-v, --verbose', 'Verbose output')
  .action(async (options) => {
    try {
      if (options.verbose) {
        console.log(`🔒 Starting comprehensive security validation for ${options.environment}`);
      }

      const report = await comprehensiveSecurityValidator.runValidation(options.environment);
      const output = comprehensiveSecurityValidator.exportReport(report, options.format);

      if (options.output) {
        writeFileSync(options.output, output);
        console.log(`📄 Security report saved to: ${options.output}`);
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

// Quick security check command
program
  .command('quick')
  .description('Run quick security check (critical issues only)')
  .option('-e, --environment <env>', 'Target environment', 'development')
  .action(async (options) => {
    try {
      console.log(`⚡ Running quick security check for ${options.environment}`);
      
      const report = await comprehensiveSecurityValidator.runValidation(options.environment);
      const criticalVulns = report.testResults.flatMap(r => r.vulnerabilities)
        .filter(v => v.severity === 'critical');
      const highRiskVulns = report.testResults.flatMap(r => r.vulnerabilities)
        .filter(v => v.severity === 'high');

      console.log(`\n📊 Quick Security Check Results:`);
      console.log(`Environment: ${report.environment}`);
      console.log(`Overall Score: ${report.summary.overallScore}/100`);
      console.log(`Security Posture: ${report.summary.securityPosture.toUpperCase()}`);
      console.log(`Critical Vulnerabilities: ${report.summary.criticalVulnerabilities}`);
      console.log(`High Risk Issues: ${report.summary.highRiskIssues}`);
      console.log(`OWASP Compliance: ${report.summary.owaspCompliance.compliant ? '✅ Compliant' : '❌ Non-Compliant'}`);

      if (criticalVulns.length > 0) {
        console.log(`\n🚨 Critical Issues Found:`);
        for (const vuln of criticalVulns.slice(0, 5)) {
          console.log(`  - ${vuln.description}`);
          if (vuln.owaspCategory) {
            console.log(`    OWASP: ${vuln.owaspCategory}`);
          }
        }
        if (criticalVulns.length > 5) {
          console.log(`  ... and ${criticalVulns.length - 5} more`);
        }
      }

      if (highRiskVulns.length > 0 && criticalVulns.length === 0) {
        console.log(`\n⚠️ High Risk Issues Found:`);
        for (const vuln of highRiskVulns.slice(0, 3)) {
          console.log(`  - ${vuln.description}`);
        }
        if (highRiskVulns.length > 3) {
          console.log(`  ... and ${highRiskVulns.length - 3} more`);
        }
      }

      if (criticalVulns.length === 0 && highRiskVulns.length === 0) {
        console.log(`\n✅ No critical or high-risk security issues found`);
        if (report.summary.overallScore < 80) {
          console.log(`⚠️ Security score is below 80, consider reviewing medium/low severity issues`);
        }
      }

      process.exit(criticalVulns.length > 0 ? 1 : 0);

    } catch (error) {
      console.error('❌ Quick check failed:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// OWASP compliance check command
program
  .command('owasp')
  .description('Check OWASP Top 10 compliance')
  .option('-e, --environment <env>', 'Target environment', 'development')
  .action(async (options) => {
    try {
      console.log(`🛡️ Checking OWASP Top 10 compliance for ${options.environment}`);
      
      const report = await comprehensiveSecurityValidator.runValidation(options.environment);
      const owaspCompliance = report.summary.owaspCompliance;
      
      console.log(`\n📊 OWASP Compliance Results:`);
      console.log(`Overall Compliance: ${owaspCompliance.compliant ? '✅ COMPLIANT' : '❌ NON-COMPLIANT'}`);
      console.log(`Compliance Score: ${owaspCompliance.score}%`);
      
      // Group tests by OWASP category
      const owaspTests = report.testResults.filter(r => r.owaspCompliance);
      const owaspCategories = new Map<string, { passed: number, failed: number, tests: any[] }>();
      
      for (const test of owaspTests) {
        const category = test.owaspCompliance!.category;
        if (!owaspCategories.has(category)) {
          owaspCategories.set(category, { passed: 0, failed: 0, tests: [] });
        }
        const cat = owaspCategories.get(category)!;
        cat.tests.push(test);
        if (test.passed) {
          cat.passed++;
        } else {
          cat.failed++;
        }
      }
      
      console.log(`\n📋 OWASP Categories:`);
      for (const [category, data] of owaspCategories) {
        const status = data.failed === 0 ? '✅' : '❌';
        console.log(`\n${status} ${category}`);
        console.log(`   Tests: ${data.passed}/${data.tests.length} passed`);
        
        if (data.failed > 0) {
          console.log(`   Failed Tests:`);
          for (const test of data.tests.filter(t => !t.passed)) {
            console.log(`   - ${test.name}`);
          }
        }
      }
      
      if (owaspCompliance.failedCategories.length > 0) {
        console.log(`\n❌ Failed Categories:`);
        for (const category of owaspCompliance.failedCategories) {
          console.log(`  - ${category}`);
        }
        
        console.log(`\n💡 Recommendations:`);
        console.log(`  - Address all failing tests in non-compliant categories`);
        console.log(`  - Prioritize critical and high severity vulnerabilities`);
        console.log(`  - Review OWASP guidelines for failed categories`);
      }

      process.exit(owaspCompliance.compliant ? 0 : 1);

    } catch (error) {
      console.error('❌ OWASP check failed:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Security metrics command
program
  .command('metrics')
  .description('Display detailed security metrics')
  .option('-e, --environment <env>', 'Target environment', 'development')
  .action(async (options) => {
    try {
      console.log(`📊 Calculating security metrics for ${options.environment}`);
      
      const report = await comprehensiveSecurityValidator.runValidation(options.environment);
      const metrics = report.securityMetrics;
      
      console.log(`\n🔒 Security Metrics Dashboard:`);
      console.log(`Overall Score: ${report.summary.overallScore}/100`);
      console.log(`Security Posture: ${report.summary.securityPosture.toUpperCase()}`);
      
      console.log(`\n📈 Detailed Metrics:`);
      
      const metricDisplay = [
        { key: 'authenticationStrength', name: '🔐 Authentication Strength', icon: '🔐' },
        { key: 'authorizationCoverage', name: '🛡️ Authorization Coverage', icon: '🛡️' },
        { key: 'inputValidationScore', name: '✔️ Input Validation', icon: '✔️' },
        { key: 'sessionSecurityScore', name: '🔑 Session Security', icon: '🔑' },
        { key: 'apiSecurityScore', name: '🌐 API Security', icon: '🌐' },
        { key: 'injectionProtection', name: '💉 Injection Protection', icon: '💉' },
        { key: 'xssProtection', name: '🚫 XSS Protection', icon: '🚫' },
        { key: 'csrfProtection', name: '🔒 CSRF Protection', icon: '🔒' },
        { key: 'headersSecurity', name: '📋 Security Headers', icon: '📋' },
        { key: 'rateLimitingEffectiveness', name: '⏱️ Rate Limiting', icon: '⏱️' }
      ];
      
      for (const metric of metricDisplay) {
        const score = metrics[metric.key] || 0;
        const bar = generateProgressBar(score);
        const status = score >= 80 ? '✅' : score >= 60 ? '⚠️' : '❌';
        console.log(`\n${metric.icon} ${metric.name}: ${score}/100 ${status}`);
        console.log(`   ${bar}`);
      }
      
      console.log(`\n🏆 Compliance Status:`);
      console.log(`  OWASP: ${report.complianceStatus.owasp ? '✅ Compliant' : '❌ Non-Compliant'}`);
      console.log(`  PCI-DSS: ${report.complianceStatus.pci ? '✅ Compliant' : '❌ Non-Compliant'}`);
      console.log(`  HIPAA: ${report.complianceStatus.hipaa ? '✅ Compliant' : '❌ Non-Compliant'}`);
      console.log(`  GDPR: ${report.complianceStatus.gdpr ? '✅ Compliant' : '❌ Non-Compliant'}`);
      
    } catch (error) {
      console.error('❌ Metrics calculation failed:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Category-specific testing command
program
  .command('test-category <category>')
  .description('Test specific security category')
  .option('-e, --environment <env>', 'Target environment', 'development')
  .action(async (category, options) => {
    try {
      console.log(`🔍 Testing ${category} security for ${options.environment}`);
      
      const report = await comprehensiveSecurityValidator.runValidation(options.environment);
      const categoryTests = report.testResults.filter(r => r.category === category);
      
      if (categoryTests.length === 0) {
        console.error(`❌ No tests found for category: ${category}`);
        console.log(`\nAvailable categories:`);
        const categories = new Set(report.testResults.map(r => r.category));
        for (const cat of categories) {
          console.log(`  - ${cat}`);
        }
        process.exit(1);
      }
      
      console.log(`\n📊 ${category.toUpperCase()} Security Results:`);
      console.log(`Tests Run: ${categoryTests.length}`);
      
      const passed = categoryTests.filter(t => t.passed).length;
      const failed = categoryTests.length - passed;
      console.log(`Passed: ${passed}`);
      console.log(`Failed: ${failed}`);
      
      const avgScore = Math.round(categoryTests.reduce((sum, t) => sum + t.score, 0) / categoryTests.length);
      console.log(`Average Score: ${avgScore}/100`);
      
      console.log(`\n📋 Test Results:`);
      for (const test of categoryTests) {
        const icon = test.passed ? '✅' : '❌';
        console.log(`\n${icon} ${test.name}`);
        console.log(`   Score: ${test.score}/100`);
        console.log(`   Execution Time: ${test.executionTime}ms`);
        
        if (test.vulnerabilities.length > 0) {
          console.log(`   Vulnerabilities:`);
          for (const vuln of test.vulnerabilities) {
            const severityIcon = vuln.severity === 'critical' ? '🔴' : 
                               vuln.severity === 'high' ? '🟠' : 
                               vuln.severity === 'medium' ? '🟡' : '🟢';
            console.log(`     ${severityIcon} ${vuln.description}`);
          }
        }
      }
      
      const vulnerabilities = categoryTests.flatMap(t => t.vulnerabilities);
      const criticalCount = vulnerabilities.filter(v => v.severity === 'critical').length;
      
      process.exit(criticalCount > 0 ? 1 : 0);
      
    } catch (error) {
      console.error('❌ Category test failed:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// List tests command
program
  .command('list-tests')
  .description('List all available security tests')
  .action(() => {
    const testCases = Array.from(comprehensiveSecurityValidator['testCases'].values());
    
    console.log(`\n📋 Available Security Tests (${testCases.length} total):\n`);
    
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
        if (test.owaspCategory) {
          console.log(`     OWASP: ${test.owaspCategory}`);
        }
        console.log(`     Environments: ${test.environment.join(', ')}`);
      }
    }
  });

// Compare reports command
program
  .command('compare')
  .description('Compare two security reports')
  .option('-b, --baseline <file>', 'Baseline report file')
  .option('-c, --current <file>', 'Current report file (or generate new)')
  .option('-e, --environment <env>', 'Environment for new report', 'development')
  .action(async (options) => {
    try {
      if (!options.baseline) {
        console.error('❌ Baseline file is required for comparison');
        process.exit(1);
      }

      console.log(`🔍 Comparing security reports`);
      
      // Load baseline
      const baselineContent = require('fs').readFileSync(options.baseline, 'utf8');
      const baselineReport = JSON.parse(baselineContent);
      
      // Get current report
      let currentReport;
      if (options.current) {
        const currentContent = require('fs').readFileSync(options.current, 'utf8');
        currentReport = JSON.parse(currentContent);
      } else {
        console.log(`Generating current report for ${options.environment}...`);
        currentReport = await comprehensiveSecurityValidator.runValidation(options.environment);
      }
      
      console.log(`\n📊 Security Comparison Results:`);
      console.log(`Baseline: ${baselineReport.generated} (Score: ${baselineReport.summary.overallScore})`);
      console.log(`Current: ${currentReport.generated} (Score: ${currentReport.summary.overallScore})`);
      
      const scoreDiff = currentReport.summary.overallScore - baselineReport.summary.overallScore;
      if (scoreDiff > 0) {
        console.log(`✅ Security improved by ${scoreDiff} points`);
      } else if (scoreDiff < 0) {
        console.log(`⚠️ Security decreased by ${Math.abs(scoreDiff)} points`);
      } else {
        console.log(`➡️ No change in overall score`);
      }
      
      // Compare vulnerabilities
      const baselineVulns = baselineReport.summary.criticalVulnerabilities + baselineReport.summary.highRiskIssues;
      const currentVulns = currentReport.summary.criticalVulnerabilities + currentReport.summary.highRiskIssues;
      
      console.log(`\n🔒 Vulnerability Comparison:`);
      console.log(`Critical Issues: ${baselineReport.summary.criticalVulnerabilities} → ${currentReport.summary.criticalVulnerabilities}`);
      console.log(`High Risk Issues: ${baselineReport.summary.highRiskIssues} → ${currentReport.summary.highRiskIssues}`);
      
      if (currentVulns < baselineVulns) {
        console.log(`✅ ${baselineVulns - currentVulns} vulnerabilities fixed`);
      } else if (currentVulns > baselineVulns) {
        console.log(`⚠️ ${currentVulns - baselineVulns} new vulnerabilities introduced`);
      }
      
      // Compare test results
      const newFailures: string[] = [];
      const newPasses: string[] = [];
      
      for (const currentTest of currentReport.testResults) {
        const baselineTest = baselineReport.testResults.find((t: any) => t.testId === currentTest.testId);
        if (baselineTest) {
          if (!currentTest.passed && baselineTest.passed) {
            newFailures.push(currentTest.name);
          } else if (currentTest.passed && !baselineTest.passed) {
            newPasses.push(currentTest.name);
          }
        }
      }
      
      if (newFailures.length > 0) {
        console.log(`\n❌ New Test Failures:`);
        for (const failure of newFailures) {
          console.log(`  - ${failure}`);
        }
      }
      
      if (newPasses.length > 0) {
        console.log(`\n✅ Newly Passing Tests:`);
        for (const pass of newPasses) {
          console.log(`  - ${pass}`);
        }
      }
      
      // Exit with error if security degraded
      if (scoreDiff < 0 || currentVulns > baselineVulns || newFailures.length > 0) {
        console.log(`\n⚠️ Security has degraded from baseline`);
        process.exit(1);
      } else {
        console.log(`\n✅ Security meets or exceeds baseline`);
        process.exit(0);
      }
      
    } catch (error) {
      console.error('❌ Comparison failed:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Generate baseline command
program
  .command('baseline')
  .description('Generate security baseline')
  .option('-e, --environment <env>', 'Target environment', 'development')
  .option('-o, --output <file>', 'Output file path')
  .action(async (options) => {
    try {
      console.log(`📋 Generating security baseline for ${options.environment}`);
      
      const report = await comprehensiveSecurityValidator.runValidation(options.environment);
      
      if (options.output) {
        const output = JSON.stringify(report, null, 2);
        writeFileSync(options.output, output);
        console.log(`📄 Baseline saved to: ${options.output}`);
      }
      
      console.log(`\n📊 Baseline Summary:`);
      console.log(`Environment: ${report.environment}`);
      console.log(`Overall Score: ${report.summary.overallScore}/100`);
      console.log(`Security Posture: ${report.summary.securityPosture.toUpperCase()}`);
      console.log(`Total Tests: ${report.summary.totalTests}`);
      console.log(`Critical Vulnerabilities: ${report.summary.criticalVulnerabilities}`);
      console.log(`High Risk Issues: ${report.summary.highRiskIssues}`);
      console.log(`OWASP Compliance: ${report.summary.owaspCompliance.compliant ? 'Compliant' : 'Non-Compliant'}`);
      
    } catch (error) {
      console.error('❌ Baseline generation failed:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Recommendations command
program
  .command('recommendations')
  .description('Get security improvement recommendations')
  .option('-e, --environment <env>', 'Target environment', 'development')
  .option('-p, --priority <level>', 'Filter by priority (critical|high|medium|low)')
  .action(async (options) => {
    try {
      console.log(`💡 Generating security recommendations for ${options.environment}`);
      
      const report = await comprehensiveSecurityValidator.runValidation(options.environment);
      
      console.log(`\n📊 Security Status:`);
      console.log(`Overall Score: ${report.summary.overallScore}/100`);
      console.log(`Security Posture: ${report.summary.securityPosture.toUpperCase()}`);
      
      // Group vulnerabilities by severity
      const vulnerabilities = report.testResults.flatMap(r => r.vulnerabilities);
      const grouped = new Map<string, typeof vulnerabilities>();
      
      for (const vuln of vulnerabilities) {
        if (!grouped.has(vuln.severity)) {
          grouped.set(vuln.severity, []);
        }
        grouped.get(vuln.severity)!.push(vuln);
      }
      
      const severityOrder = ['critical', 'high', 'medium', 'low'];
      const priorityFilter = options.priority?.toLowerCase();
      
      console.log(`\n🔒 Security Recommendations:`);
      
      for (const severity of severityOrder) {
        if (priorityFilter && severity !== priorityFilter) continue;
        
        const vulns = grouped.get(severity) || [];
        if (vulns.length === 0) continue;
        
        const icon = severity === 'critical' ? '🔴' : 
                    severity === 'high' ? '🟠' : 
                    severity === 'medium' ? '🟡' : '🟢';
        
        console.log(`\n${icon} ${severity.toUpperCase()} Priority (${vulns.length} issues):`);
        
        // Group by remediation
        const remediations = new Map<string, number>();
        for (const vuln of vulns) {
          const count = remediations.get(vuln.remediation) || 0;
          remediations.set(vuln.remediation, count + 1);
        }
        
        // Sort by frequency
        const sortedRemediations = Array.from(remediations.entries())
          .sort((a, b) => b[1] - a[1]);
        
        for (const [remediation, count] of sortedRemediations) {
          console.log(`  - ${remediation} (${count} issues)`);
        }
      }
      
      console.log(`\n📋 Next Actions:`);
      for (const action of report.nextActions.slice(0, 5)) {
        console.log(`  1. ${action}`);
      }
      
      console.log(`\n💡 General Recommendations:`);
      for (const rec of report.recommendations.slice(0, 10)) {
        console.log(`  - ${rec}`);
      }
      
    } catch (error) {
      console.error('❌ Recommendations generation failed:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Helper function to generate progress bar
function generateProgressBar(score: number): string {
  const filled = Math.round(score / 5);
  const empty = 20 - filled;
  return '█'.repeat(filled) + '░'.repeat(empty) + ` ${score}%`;
}

// Parse command line arguments
program.parse();

export { program };