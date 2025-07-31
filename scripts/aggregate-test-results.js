#!/usr/bin/env node

/**
 * Aggregate test results from multiple test runs
 */

const fs = require('fs');
const path = require('path');

function aggregateTestResults(artifactsDir) {
  const results = {
    totalTests: 0,
    passed: 0,
    failed: 0,
    skipped: 0,
    coverage: 0,
    duration: 0,
    testSuites: {},
    failures: [],
    slowTests: [],
    timestamp: new Date().toISOString()
  };

  // Find all test result files
  const testResultFiles = findFiles(artifactsDir, /test-results.*\.json$/);
  const coverageFiles = findFiles(artifactsDir, /coverage-final\.json$/);

  // Aggregate test results
  testResultFiles.forEach(file => {
    try {
      const data = JSON.parse(fs.readFileSync(file, 'utf8'));
      
      if (data.numTotalTests) {
        results.totalTests += data.numTotalTests;
        results.passed += data.numPassedTests || 0;
        results.failed += data.numFailedTests || 0;
        results.skipped += data.numPendingTests || 0;
        results.duration += data.testResults?.reduce((sum, r) => sum + (r.perfStats?.runtime || 0), 0) || 0;
      }

      // Collect failures
      if (data.testResults) {
        data.testResults.forEach(suite => {
          const suiteName = path.relative(process.cwd(), suite.testFilePath);
          results.testSuites[suiteName] = {
            passed: suite.numPassingTests,
            failed: suite.numFailingTests,
            duration: suite.perfStats?.runtime || 0
          };

          // Collect failures
          if (suite.testResults) {
            suite.testResults
              .filter(test => test.status === 'failed')
              .forEach(test => {
                results.failures.push({
                  suite: suiteName,
                  test: test.fullName,
                  error: test.failureMessages?.join('\n') || 'Unknown error'
                });
              });

            // Collect slow tests (> 5 seconds)
            suite.testResults
              .filter(test => test.duration && test.duration > 5000)
              .forEach(test => {
                results.slowTests.push({
                  suite: suiteName,
                  test: test.fullName,
                  duration: test.duration
                });
              });
          }
        });
      }
    } catch (error) {
      console.error(`Error parsing ${file}:`, error.message);
    }
  });

  // Aggregate coverage
  let totalStatements = 0;
  let coveredStatements = 0;
  let totalBranches = 0;
  let coveredBranches = 0;
  let totalFunctions = 0;
  let coveredFunctions = 0;
  let totalLines = 0;
  let coveredLines = 0;

  coverageFiles.forEach(file => {
    try {
      const coverage = JSON.parse(fs.readFileSync(file, 'utf8'));
      
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
    } catch (error) {
      console.error(`Error parsing coverage ${file}:`, error.message);
    }
  });

  // Calculate coverage percentage
  if (totalStatements > 0) {
    results.coverage = Math.round((coveredStatements / totalStatements) * 100);
  }

  results.coverageDetails = {
    statements: { total: totalStatements, covered: coveredStatements, pct: totalStatements ? Math.round((coveredStatements / totalStatements) * 100) : 0 },
    branches: { total: totalBranches, covered: coveredBranches, pct: totalBranches ? Math.round((coveredBranches / totalBranches) * 100) : 0 },
    functions: { total: totalFunctions, covered: coveredFunctions, pct: totalFunctions ? Math.round((coveredFunctions / totalFunctions) * 100) : 0 },
    lines: { total: totalLines, covered: coveredLines, pct: totalLines ? Math.round((coveredLines / totalLines) * 100) : 0 }
  };

  // Generate detailed summary
  results.details = generateDetailedSummary(results);

  return results;
}

function findFiles(dir, pattern) {
  const files = [];
  
  function walk(currentDir) {
    try {
      const entries = fs.readdirSync(currentDir);
      
      entries.forEach(entry => {
        const fullPath = path.join(currentDir, entry);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
          walk(fullPath);
        } else if (pattern.test(entry)) {
          files.push(fullPath);
        }
      });
    } catch (error) {
      console.error(`Error reading directory ${currentDir}:`, error.message);
    }
  }
  
  walk(dir);
  return files;
}

function generateDetailedSummary(results) {
  let summary = '### Test Execution Summary\n\n';
  
  // Overall stats
  summary += `- **Total Tests:** ${results.totalTests}\n`;
  summary += `- **Passed:** ${results.passed} (${Math.round((results.passed / results.totalTests) * 100)}%)\n`;
  summary += `- **Failed:** ${results.failed}\n`;
  summary += `- **Skipped:** ${results.skipped}\n`;
  summary += `- **Duration:** ${Math.round(results.duration / 1000)}s\n\n`;
  
  // Coverage
  summary += '### Coverage Report\n\n';
  summary += `- **Overall:** ${results.coverage}%\n`;
  summary += `- **Statements:** ${results.coverageDetails.statements.pct}% (${results.coverageDetails.statements.covered}/${results.coverageDetails.statements.total})\n`;
  summary += `- **Branches:** ${results.coverageDetails.branches.pct}% (${results.coverageDetails.branches.covered}/${results.coverageDetails.branches.total})\n`;
  summary += `- **Functions:** ${results.coverageDetails.functions.pct}% (${results.coverageDetails.functions.covered}/${results.coverageDetails.functions.total})\n`;
  summary += `- **Lines:** ${results.coverageDetails.lines.pct}% (${results.coverageDetails.lines.covered}/${results.coverageDetails.lines.total})\n\n`;
  
  // Failures
  if (results.failures.length > 0) {
    summary += '### Failed Tests\n\n';
    results.failures.slice(0, 10).forEach(failure => {
      summary += `#### ${failure.test}\n`;
      summary += `- **Suite:** ${failure.suite}\n`;
      summary += `- **Error:** \`\`\`\n${failure.error.split('\n')[0]}\n\`\`\`\n\n`;
    });
    
    if (results.failures.length > 10) {
      summary += `_... and ${results.failures.length - 10} more failures_\n\n`;
    }
  }
  
  // Slow tests
  if (results.slowTests.length > 0) {
    summary += '### Slow Tests (>5s)\n\n';
    results.slowTests
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 5)
      .forEach(test => {
        summary += `- **${test.test}** (${Math.round(test.duration / 1000)}s)\n`;
      });
    summary += '\n';
  }
  
  return summary;
}

// Main execution
if (require.main === module) {
  const artifactsDir = process.argv[2];
  
  if (!artifactsDir) {
    console.error('Usage: aggregate-test-results.js <artifacts-directory>');
    process.exit(1);
  }
  
  const results = aggregateTestResults(artifactsDir);
  console.log(JSON.stringify(results, null, 2));
}