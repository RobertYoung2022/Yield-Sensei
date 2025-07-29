#!/usr/bin/env node

/**
 * Generate comprehensive test report from all artifacts
 */

const fs = require('fs');
const path = require('path');

function generateComprehensiveReport(artifactsDir) {
  const report = {
    metadata: {
      generated: new Date().toISOString(),
      repository: process.env.GITHUB_REPOSITORY || 'yield-sensei/yield-sensei',
      commit: process.env.GITHUB_SHA || 'unknown',
      branch: process.env.GITHUB_REF_NAME || 'unknown',
      runId: process.env.GITHUB_RUN_ID || 'unknown'
    },
    summary: {
      overall: 'unknown',
      tests: { total: 0, passed: 0, failed: 0, skipped: 0 },
      coverage: { overall: 0, statements: 0, branches: 0, functions: 0, lines: 0 },
      performance: { regressions: 0, improvements: 0, avgDuration: 0 },
      security: { issues: 0, critical: 0, high: 0, medium: 0, low: 0 },
      satellites: {}
    },
    details: {
      failures: [],
      slowTests: [],
      securityIssues: [],
      performanceRegressions: []
    }
  };

  // Process all artifact directories
  const artifacts = findArtifactDirs(artifactsDir);
  
  artifacts.forEach(artifact => {
    const artifactName = path.basename(artifact);
    
    if (artifactName.includes('unit') || artifactName.includes('satellite')) {
      processUnitResults(artifact, report);
    } else if (artifactName.includes('integration')) {
      processIntegrationResults(artifact, report);
    } else if (artifactName.includes('security')) {
      processSecurityResults(artifact, report);
    } else if (artifactName.includes('performance')) {
      processPerformanceResults(artifact, report);
    }
  });

  // Determine overall status
  if (report.summary.tests.failed > 0 || report.summary.security.critical > 0) {
    report.summary.overall = 'failed';
  } else if (report.summary.coverage.overall < 80 || report.summary.performance.regressions > 0) {
    report.summary.overall = 'warning';
  } else {
    report.summary.overall = 'success';
  }

  return generateMarkdownReport(report);
}

function findArtifactDirs(baseDir) {
  const dirs = [];
  
  try {
    const entries = fs.readdirSync(baseDir);
    entries.forEach(entry => {
      const fullPath = path.join(baseDir, entry);
      if (fs.statSync(fullPath).isDirectory()) {
        dirs.push(fullPath);
      }
    });
  } catch (error) {
    console.error(`Error reading artifacts directory: ${error.message}`);
  }
  
  return dirs;
}

function processUnitResults(dir, report) {
  const resultFiles = findFiles(dir, /test-results.*\.json$/);
  
  resultFiles.forEach(file => {
    try {
      const data = JSON.parse(fs.readFileSync(file, 'utf8'));
      
      if (data.numTotalTests) {
        report.summary.tests.total += data.numTotalTests;
        report.summary.tests.passed += data.numPassedTests || 0;
        report.summary.tests.failed += data.numFailedTests || 0;
        report.summary.tests.skipped += data.numPendingTests || 0;
      }

      // Process satellite-specific results
      if (data.testResults) {
        data.testResults.forEach(suite => {
          const suitePath = suite.testFilePath;
          const satelliteMatch = suitePath.match(/satellites\/(\w+)/);
          
          if (satelliteMatch) {
            const satellite = satelliteMatch[1];
            if (!report.summary.satellites[satellite]) {
              report.summary.satellites[satellite] = { passed: 0, failed: 0, total: 0 };
            }
            
            report.summary.satellites[satellite].passed += suite.numPassingTests || 0;
            report.summary.satellites[satellite].failed += suite.numFailingTests || 0;
            report.summary.satellites[satellite].total += (suite.numPassingTests || 0) + (suite.numFailingTests || 0);
          }

          // Collect failures
          if (suite.testResults) {
            suite.testResults
              .filter(test => test.status === 'failed')
              .forEach(test => {
                report.details.failures.push({
                  suite: path.basename(suite.testFilePath),
                  test: test.fullName,
                  error: test.failureMessages?.[0] || 'Unknown error'
                });
              });

            // Collect slow tests
            suite.testResults
              .filter(test => test.duration && test.duration > 5000)
              .forEach(test => {
                report.details.slowTests.push({
                  suite: path.basename(suite.testFilePath),
                  test: test.fullName,
                  duration: test.duration
                });
              });
          }
        });
      }
    } catch (error) {
      console.error(`Error processing ${file}: ${error.message}`);
    }
  });

  // Process coverage
  const coverageFiles = findFiles(dir, /coverage-final\.json$/);
  coverageFiles.forEach(file => {
    try {
      const coverage = JSON.parse(fs.readFileSync(file, 'utf8'));
      processCoverage(coverage, report);
    } catch (error) {
      console.error(`Error processing coverage ${file}: ${error.message}`);
    }
  });
}

function processIntegrationResults(dir, report) {
  // Similar to unit results but may have different structure
  processUnitResults(dir, report);
}

function processSecurityResults(dir, report) {
  const securityFiles = findFiles(dir, /security.*\.json$/);
  
  securityFiles.forEach(file => {
    try {
      const data = JSON.parse(fs.readFileSync(file, 'utf8'));
      
      if (data.vulnerabilities) {
        data.vulnerabilities.forEach(vuln => {
          report.summary.security.issues++;
          
          switch (vuln.severity?.toLowerCase()) {
            case 'critical':
              report.summary.security.critical++;
              break;
            case 'high':
              report.summary.security.high++;
              break;
            case 'medium':
              report.summary.security.medium++;
              break;
            case 'low':
              report.summary.security.low++;
              break;
          }
          
          if (vuln.severity === 'critical' || vuln.severity === 'high') {
            report.details.securityIssues.push({
              type: vuln.type || 'Unknown',
              severity: vuln.severity,
              description: vuln.description || vuln.title || 'No description',
              location: vuln.location || 'Unknown'
            });
          }
        });
      }
    } catch (error) {
      console.error(`Error processing security ${file}: ${error.message}`);
    }
  });
}

function processPerformanceResults(dir, report) {
  const perfFiles = findFiles(dir, /performance.*\.json$/);
  
  perfFiles.forEach(file => {
    try {
      const data = JSON.parse(fs.readFileSync(file, 'utf8'));
      
      if (data.regressions) {
        report.summary.performance.regressions += data.regressions.length;
        report.details.performanceRegressions.push(...data.regressions.slice(0, 5));
      }
      
      if (data.improvements) {
        report.summary.performance.improvements += data.improvements.length;
      }
      
      if (data.avgDuration) {
        report.summary.performance.avgDuration = data.avgDuration;
      }
    } catch (error) {
      console.error(`Error processing performance ${file}: ${error.message}`);
    }
  });
}

function processCoverage(coverage, report) {
  let totalStatements = 0, coveredStatements = 0;
  let totalBranches = 0, coveredBranches = 0;
  let totalFunctions = 0, coveredFunctions = 0;
  let totalLines = 0, coveredLines = 0;

  Object.values(coverage).forEach(fileCoverage => {
    // Statements
    totalStatements += Object.keys(fileCoverage.s || {}).length;
    coveredStatements += Object.values(fileCoverage.s || {}).filter(c => c > 0).length;
    
    // Branches
    Object.values(fileCoverage.b || {}).forEach(branch => {
      totalBranches += branch.length;
      coveredBranches += branch.filter(c => c > 0).length;
    });
    
    // Functions
    totalFunctions += Object.keys(fileCoverage.f || {}).length;
    coveredFunctions += Object.values(fileCoverage.f || {}).filter(c => c > 0).length;
    
    // Lines
    totalLines += Object.keys(fileCoverage.l || {}).length;
    coveredLines += Object.values(fileCoverage.l || {}).filter(c => c > 0).length;
  });

  if (totalStatements > 0) {
    report.summary.coverage.overall = Math.round((coveredStatements / totalStatements) * 100);
    report.summary.coverage.statements = Math.round((coveredStatements / totalStatements) * 100);
    report.summary.coverage.branches = Math.round((coveredBranches / totalBranches) * 100);
    report.summary.coverage.functions = Math.round((coveredFunctions / totalFunctions) * 100);
    report.summary.coverage.lines = Math.round((coveredLines / totalLines) * 100);
  }
}

function findFiles(dir, pattern) {
  const files = [];
  
  try {
    const entries = fs.readdirSync(dir);
    entries.forEach(entry => {
      const fullPath = path.join(dir, entry);
      if (fs.statSync(fullPath).isFile() && pattern.test(entry)) {
        files.push(fullPath);
      }
    });
  } catch (error) {
    // Directory might not exist
  }
  
  return files;
}

function generateMarkdownReport(report) {
  const status = report.summary.overall;
  const statusIcon = status === 'success' ? '✅' : status === 'warning' ? '⚠️' : '❌';
  
  let markdown = `# ${statusIcon} Comprehensive Test Report\n\n`;
  
  // Metadata
  markdown += '## Report Metadata\n\n';
  markdown += `- **Generated:** ${report.metadata.generated}\n`;
  markdown += `- **Repository:** ${report.metadata.repository}\n`;
  markdown += `- **Branch:** ${report.metadata.branch}\n`;
  markdown += `- **Commit:** ${report.metadata.commit.substring(0, 8)}\n`;
  markdown += `- **Run ID:** ${report.metadata.runId}\n\n`;
  
  // Executive Summary
  markdown += '## Executive Summary\n\n';
  if (status === 'success') {
    markdown += '✅ **All systems operational** - Tests passing, coverage adequate, no critical security issues.\n\n';
  } else if (status === 'warning') {
    markdown += '⚠️ **Some issues detected** - Review required but system is functional.\n\n';
  } else {
    markdown += '❌ **Critical issues found** - Immediate attention required.\n\n';
  }
  
  // Test Summary
  markdown += '## Test Results Summary\n\n';
  markdown += '| Metric | Value |\n';
  markdown += '|--------|-------|\n';
  markdown += `| Total Tests | ${report.summary.tests.total} |\n`;
  markdown += `| Passed | ${report.summary.tests.passed} (${Math.round((report.summary.tests.passed / report.summary.tests.total) * 100)}%) |\n`;
  markdown += `| Failed | ${report.summary.tests.failed} |\n`;
  markdown += `| Skipped | ${report.summary.tests.skipped} |\n\n`;
  
  // Coverage Summary
  markdown += '## Code Coverage\n\n';
  markdown += '| Type | Coverage |\n';
  markdown += '|------|----------|\n';
  markdown += `| Overall | ${report.summary.coverage.overall}% |\n`;
  markdown += `| Statements | ${report.summary.coverage.statements}% |\n`;
  markdown += `| Branches | ${report.summary.coverage.branches}% |\n`;
  markdown += `| Functions | ${report.summary.coverage.functions}% |\n`;
  markdown += `| Lines | ${report.summary.coverage.lines}% |\n\n`;
  
  // Satellite Status
  if (Object.keys(report.summary.satellites).length > 0) {
    markdown += '## Satellite Module Status\n\n';
    markdown += '| Satellite | Passed | Failed | Total | Status |\n';
    markdown += '|-----------|--------|--------|-------|--------|\n';
    
    Object.entries(report.summary.satellites).forEach(([name, stats]) => {
      const statusIcon = stats.failed === 0 ? '✅' : '❌';
      const passRate = Math.round((stats.passed / stats.total) * 100);
      markdown += `| ${name} | ${stats.passed} | ${stats.failed} | ${stats.total} | ${statusIcon} (${passRate}%) |\n`;
    });
    markdown += '\n';
  }
  
  // Security Issues
  if (report.summary.security.issues > 0) {
    markdown += '## Security Issues\n\n';
    markdown += '| Severity | Count |\n';
    markdown += '|----------|-------|\n';
    markdown += `| Critical | ${report.summary.security.critical} |\n`;
    markdown += `| High | ${report.summary.security.high} |\n`;
    markdown += `| Medium | ${report.summary.security.medium} |\n`;
    markdown += `| Low | ${report.summary.security.low} |\n\n`;
    
    if (report.details.securityIssues.length > 0) {
      markdown += '### Critical/High Severity Issues\n\n';
      report.details.securityIssues.slice(0, 10).forEach((issue, index) => {
        markdown += `${index + 1}. **${issue.type}** (${issue.severity})\n`;
        markdown += `   - ${issue.description}\n`;
        markdown += `   - Location: ${issue.location}\n\n`;
      });
    }
  }
  
  // Performance
  if (report.summary.performance.regressions > 0 || report.summary.performance.improvements > 0) {
    markdown += '## Performance Impact\n\n';
    markdown += `- **Regressions:** ${report.summary.performance.regressions}\n`;
    markdown += `- **Improvements:** ${report.summary.performance.improvements}\n`;
    if (report.summary.performance.avgDuration > 0) {
      markdown += `- **Average Duration:** ${Math.round(report.summary.performance.avgDuration / 1000)}s\n`;
    }
    markdown += '\n';
  }
  
  // Failures Detail
  if (report.details.failures.length > 0) {
    markdown += '## Test Failures\n\n';
    report.details.failures.slice(0, 10).forEach((failure, index) => {
      markdown += `${index + 1}. **${failure.test}**\n`;
      markdown += `   - Suite: ${failure.suite}\n`;
      markdown += `   - Error: \`${failure.error.split('\n')[0]}\`\n\n`;
    });
    
    if (report.details.failures.length > 10) {
      markdown += `_... and ${report.details.failures.length - 10} more failures_\n\n`;
    }
  }
  
  // Recommendations
  markdown += '## Recommendations\n\n';
  if (status === 'failed') {
    markdown += '🚨 **Immediate Actions Required:**\n';
    if (report.summary.tests.failed > 0) {
      markdown += `- Fix ${report.summary.tests.failed} failing tests\n`;
    }
    if (report.summary.security.critical > 0) {
      markdown += `- Address ${report.summary.security.critical} critical security issues\n`;
    }
  } else if (status === 'warning') {
    markdown += '⚠️ **Recommended Actions:**\n';
    if (report.summary.coverage.overall < 80) {
      markdown += '- Improve test coverage to meet 80% threshold\n';
    }
    if (report.summary.performance.regressions > 0) {
      markdown += '- Review and optimize performance regressions\n';
    }
  } else {
    markdown += '✅ **Maintenance Actions:**\n';
    markdown += '- Continue monitoring test suite performance\n';
    markdown += '- Schedule regular security audits\n';
    markdown += '- Consider expanding test coverage for new features\n';
  }
  
  markdown += `\n---\n_Report generated on ${new Date().toISOString()}_\n`;
  
  return markdown;
}

// Main execution
if (require.main === module) {
  const artifactsDir = process.argv[2];
  
  if (!artifactsDir) {
    console.error('Usage: generate-comprehensive-report.js <artifacts-directory>');
    process.exit(1);
  }
  
  const report = generateComprehensiveReport(artifactsDir);
  console.log(report);
}