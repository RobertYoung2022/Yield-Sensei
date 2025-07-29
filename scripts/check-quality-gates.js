#!/usr/bin/env node

/**
 * Check quality gates based on test results
 */

const fs = require('fs');

const DEFAULT_GATES = {
  MIN_COVERAGE: 80,
  MAX_FAILING_TESTS: 0,
  MAX_SECURITY_ISSUES: 0,
  MAX_SLOW_TESTS: 10,
  MAX_TEST_DURATION: 600000 // 10 minutes
};

function checkQualityGates(summaryPath) {
  // Read environment variables for gate thresholds
  const gates = {
    minCoverage: parseInt(process.env.MIN_COVERAGE) || DEFAULT_GATES.MIN_COVERAGE,
    maxFailingTests: parseInt(process.env.MAX_FAILING_TESTS) || DEFAULT_GATES.MAX_FAILING_TESTS,
    maxSecurityIssues: parseInt(process.env.MAX_SECURITY_ISSUES) || DEFAULT_GATES.MAX_SECURITY_ISSUES,
    maxSlowTests: parseInt(process.env.MAX_SLOW_TESTS) || DEFAULT_GATES.MAX_SLOW_TESTS,
    maxTestDuration: parseInt(process.env.MAX_TEST_DURATION) || DEFAULT_GATES.MAX_TEST_DURATION
  };

  console.log('Quality Gate Thresholds:');
  console.log(`- Minimum Coverage: ${gates.minCoverage}%`);
  console.log(`- Maximum Failing Tests: ${gates.maxFailingTests}`);
  console.log(`- Maximum Security Issues: ${gates.maxSecurityIssues}`);
  console.log(`- Maximum Slow Tests: ${gates.maxSlowTests}`);
  console.log(`- Maximum Test Duration: ${gates.maxTestDuration}ms`);
  console.log('');

  // Read test summary
  let summary;
  try {
    summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
  } catch (error) {
    console.error(`Failed to read test summary: ${error.message}`);
    process.exit(1);
  }

  const failures = [];
  const warnings = [];

  // Check coverage
  if (summary.coverage < gates.minCoverage) {
    failures.push(`Coverage ${summary.coverage}% is below minimum ${gates.minCoverage}%`);
  }

  // Check failing tests
  if (summary.failed > gates.maxFailingTests) {
    failures.push(`${summary.failed} tests failed (maximum allowed: ${gates.maxFailingTests})`);
  }

  // Check slow tests
  if (summary.slowTests && summary.slowTests.length > gates.maxSlowTests) {
    warnings.push(`${summary.slowTests.length} slow tests detected (threshold: ${gates.maxSlowTests})`);
  }

  // Check test duration
  if (summary.duration > gates.maxTestDuration) {
    warnings.push(`Test suite took ${Math.round(summary.duration / 1000)}s (threshold: ${gates.maxTestDuration / 1000}s)`);
  }

  // Check security issues (if security results are included)
  if (summary.securityIssues) {
    const criticalIssues = summary.securityIssues.filter(issue => issue.severity === 'critical' || issue.severity === 'high');
    if (criticalIssues.length > gates.maxSecurityIssues) {
      failures.push(`${criticalIssues.length} critical/high security issues found (maximum allowed: ${gates.maxSecurityIssues})`);
    }
  }

  // Check coverage details
  if (summary.coverageDetails) {
    const coverageTypes = ['statements', 'branches', 'functions', 'lines'];
    coverageTypes.forEach(type => {
      if (summary.coverageDetails[type] && summary.coverageDetails[type].pct < gates.minCoverage) {
        warnings.push(`${type} coverage ${summary.coverageDetails[type].pct}% is below minimum ${gates.minCoverage}%`);
      }
    });
  }

  // Output results
  console.log('Quality Gate Results:');
  console.log('====================');
  
  if (failures.length === 0 && warnings.length === 0) {
    console.log('✅ All quality gates passed!');
    console.log('');
    console.log('Summary:');
    console.log(`- Tests: ${summary.passed}/${summary.totalTests} passed`);
    console.log(`- Coverage: ${summary.coverage}%`);
    console.log(`- Duration: ${Math.round(summary.duration / 1000)}s`);
  } else {
    if (failures.length > 0) {
      console.log('❌ Quality gate FAILED:');
      failures.forEach(failure => console.log(`   - ${failure}`));
      console.log('');
    }
    
    if (warnings.length > 0) {
      console.log('⚠️  Warnings:');
      warnings.forEach(warning => console.log(`   - ${warning}`));
      console.log('');
    }
  }

  // Generate GitHub Actions summary
  if (process.env.GITHUB_STEP_SUMMARY) {
    const summaryContent = generateGitHubSummary(summary, failures, warnings, gates);
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, summaryContent);
  }

  // Exit with appropriate code
  if (failures.length > 0) {
    process.exit(1);
  }
}

function generateGitHubSummary(summary, failures, warnings, gates) {
  let content = '## Quality Gate Results\n\n';
  
  if (failures.length === 0 && warnings.length === 0) {
    content += '### ✅ All quality gates passed!\n\n';
  } else {
    if (failures.length > 0) {
      content += '### ❌ Failed Checks\n\n';
      failures.forEach(failure => content += `- ${failure}\n`);
      content += '\n';
    }
    
    if (warnings.length > 0) {
      content += '### ⚠️ Warnings\n\n';
      warnings.forEach(warning => content += `- ${warning}\n`);
      content += '\n';
    }
  }
  
  content += '### Test Summary\n\n';
  content += '| Metric | Value | Threshold | Status |\n';
  content += '|--------|-------|-----------|--------|\n';
  content += `| Test Pass Rate | ${Math.round((summary.passed / summary.totalTests) * 100)}% | ${100 - (gates.maxFailingTests / summary.totalTests * 100)}% | ${summary.failed <= gates.maxFailingTests ? '✅' : '❌'} |\n`;
  content += `| Code Coverage | ${summary.coverage}% | ${gates.minCoverage}% | ${summary.coverage >= gates.minCoverage ? '✅' : '❌'} |\n`;
  content += `| Test Duration | ${Math.round(summary.duration / 1000)}s | ${gates.maxTestDuration / 1000}s | ${summary.duration <= gates.maxTestDuration ? '✅' : '⚠️'} |\n`;
  content += `| Slow Tests | ${summary.slowTests?.length || 0} | ${gates.maxSlowTests} | ${(summary.slowTests?.length || 0) <= gates.maxSlowTests ? '✅' : '⚠️'} |\n`;
  
  if (summary.coverageDetails) {
    content += '\n### Coverage Details\n\n';
    content += '| Type | Coverage | Covered/Total |\n';
    content += '|------|----------|---------------|\n';
    content += `| Statements | ${summary.coverageDetails.statements.pct}% | ${summary.coverageDetails.statements.covered}/${summary.coverageDetails.statements.total} |\n`;
    content += `| Branches | ${summary.coverageDetails.branches.pct}% | ${summary.coverageDetails.branches.covered}/${summary.coverageDetails.branches.total} |\n`;
    content += `| Functions | ${summary.coverageDetails.functions.pct}% | ${summary.coverageDetails.functions.covered}/${summary.coverageDetails.functions.total} |\n`;
    content += `| Lines | ${summary.coverageDetails.lines.pct}% | ${summary.coverageDetails.lines.covered}/${summary.coverageDetails.lines.total} |\n`;
  }
  
  return content;
}

// Main execution
if (require.main === module) {
  const summaryPath = process.argv[2];
  
  if (!summaryPath) {
    console.error('Usage: check-quality-gates.js <test-summary.json>');
    process.exit(1);
  }
  
  checkQualityGates(summaryPath);
}