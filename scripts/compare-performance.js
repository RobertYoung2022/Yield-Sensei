#!/usr/bin/env node

/**
 * Compare performance test results between base and PR branches
 */

const fs = require('fs');

const THRESHOLD = {
  REGRESSION: 1.1, // 10% slower is considered a regression
  IMPROVEMENT: 0.9 // 10% faster is considered an improvement
};

function comparePerformance(baseResultsPath, prResultsPath) {
  let baseResults, prResults;
  
  try {
    baseResults = JSON.parse(fs.readFileSync(baseResultsPath, 'utf8'));
    prResults = JSON.parse(fs.readFileSync(prResultsPath, 'utf8'));
  } catch (error) {
    console.error(`Failed to read performance results: ${error.message}`);
    process.exit(1);
  }

  const comparison = {
    timestamp: new Date().toISOString(),
    summary: {
      totalTests: 0,
      regressions: 0,
      improvements: 0,
      unchanged: 0
    },
    details: [],
    regressionDetails: [],
    improvementDetails: []
  };

  // Compare test results
  if (baseResults.testResults && prResults.testResults) {
    baseResults.testResults.forEach(baseTest => {
      const prTest = prResults.testResults.find(t => 
        t.testFilePath === baseTest.testFilePath
      );
      
      if (prTest && baseTest.perfStats && prTest.perfStats) {
        comparison.summary.totalTests++;
        
        const baseDuration = baseTest.perfStats.runtime || 0;
        const prDuration = prTest.perfStats.runtime || 0;
        const ratio = prDuration / baseDuration;
        
        const testComparison = {
          name: baseTest.testFilePath.split('/').pop(),
          baseDuration,
          prDuration,
          difference: prDuration - baseDuration,
          ratio,
          status: 'unchanged'
        };
        
        if (ratio > THRESHOLD.REGRESSION) {
          testComparison.status = 'regression';
          comparison.summary.regressions++;
          comparison.regressionDetails.push(testComparison);
        } else if (ratio < THRESHOLD.IMPROVEMENT) {
          testComparison.status = 'improvement';
          comparison.summary.improvements++;
          comparison.improvementDetails.push(testComparison);
        } else {
          comparison.summary.unchanged++;
        }
        
        comparison.details.push(testComparison);
      }
    });
  }

  // Generate report
  generateReport(comparison);
  
  // Exit with error if regressions found
  if (comparison.summary.regressions > 0) {
    process.exit(1);
  }
}

function generateReport(comparison) {
  console.log('Performance Comparison Report');
  console.log('=============================\n');
  
  console.log('Summary:');
  console.log(`- Total Tests Compared: ${comparison.summary.totalTests}`);
  console.log(`- Regressions: ${comparison.summary.regressions}`);
  console.log(`- Improvements: ${comparison.summary.improvements}`);
  console.log(`- Unchanged: ${comparison.summary.unchanged}`);
  console.log('');
  
  if (comparison.regressionDetails.length > 0) {
    console.log('❌ Performance Regressions:');
    comparison.regressionDetails.forEach(test => {
      const percentChange = ((test.ratio - 1) * 100).toFixed(2);
      console.log(`   - ${test.name}: ${test.baseDuration}ms → ${test.prDuration}ms (+${percentChange}%)`);
    });
    console.log('');
  }
  
  if (comparison.improvementDetails.length > 0) {
    console.log('✅ Performance Improvements:');
    comparison.improvementDetails.forEach(test => {
      const percentChange = ((1 - test.ratio) * 100).toFixed(2);
      console.log(`   - ${test.name}: ${test.baseDuration}ms → ${test.prDuration}ms (-${percentChange}%)`);
    });
    console.log('');
  }
  
  // Generate markdown report for PR comment
  if (process.env.GITHUB_OUTPUT) {
    const markdown = generateMarkdownReport(comparison);
    fs.writeFileSync('performance-comparison.md', markdown);
    console.log('Generated performance-comparison.md');
  }
  
  // Output for GitHub Actions
  if (process.env.GITHUB_STEP_SUMMARY) {
    const summary = generateGitHubSummary(comparison);
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
  }
}

function generateMarkdownReport(comparison) {
  let markdown = '## Performance Impact Analysis\n\n';
  
  if (comparison.summary.regressions === 0 && comparison.summary.improvements === 0) {
    markdown += '✅ **No significant performance changes detected**\n\n';
  } else {
    if (comparison.summary.regressions > 0) {
      markdown += `⚠️ **${comparison.summary.regressions} performance regression(s) detected**\n\n`;
    }
    if (comparison.summary.improvements > 0) {
      markdown += `🚀 **${comparison.summary.improvements} performance improvement(s) detected**\n\n`;
    }
  }
  
  markdown += '### Summary\n\n';
  markdown += '| Metric | Count |\n';
  markdown += '|--------|-------|\n';
  markdown += `| Total Tests | ${comparison.summary.totalTests} |\n`;
  markdown += `| Regressions | ${comparison.summary.regressions} |\n`;
  markdown += `| Improvements | ${comparison.summary.improvements} |\n`;
  markdown += `| Unchanged | ${comparison.summary.unchanged} |\n\n`;
  
  if (comparison.regressionDetails.length > 0) {
    markdown += '### ❌ Regressions\n\n';
    markdown += '| Test | Base Duration | PR Duration | Change |\n';
    markdown += '|------|---------------|-------------|--------|\n';
    comparison.regressionDetails.forEach(test => {
      const percentChange = ((test.ratio - 1) * 100).toFixed(2);
      markdown += `| ${test.name} | ${test.baseDuration}ms | ${test.prDuration}ms | +${percentChange}% |\n`;
    });
    markdown += '\n';
  }
  
  if (comparison.improvementDetails.length > 0) {
    markdown += '### ✅ Improvements\n\n';
    markdown += '| Test | Base Duration | PR Duration | Change |\n';
    markdown += '|------|---------------|-------------|--------|\n';
    comparison.improvementDetails.forEach(test => {
      const percentChange = ((1 - test.ratio) * 100).toFixed(2);
      markdown += `| ${test.name} | ${test.baseDuration}ms | ${test.prDuration}ms | -${percentChange}% |\n`;
    });
    markdown += '\n';
  }
  
  markdown += '_Regressions are defined as >10% slower, improvements as >10% faster_\n';
  
  return markdown;
}

function generateGitHubSummary(comparison) {
  let summary = '## Performance Comparison\n\n';
  
  if (comparison.summary.regressions > 0) {
    summary += `### ⚠️ ${comparison.summary.regressions} Performance Regression(s) Found\n\n`;
    summary += 'The following tests showed significant performance degradation:\n\n';
    comparison.regressionDetails.slice(0, 5).forEach(test => {
      const percentChange = ((test.ratio - 1) * 100).toFixed(2);
      summary += `- **${test.name}**: ${test.baseDuration}ms → ${test.prDuration}ms (+${percentChange}%)\n`;
    });
    if (comparison.regressionDetails.length > 5) {
      summary += `- _...and ${comparison.regressionDetails.length - 5} more_\n`;
    }
    summary += '\n';
  } else {
    summary += '### ✅ No Performance Regressions\n\n';
  }
  
  if (comparison.summary.improvements > 0) {
    summary += `### 🚀 ${comparison.summary.improvements} Performance Improvement(s)\n\n`;
    comparison.improvementDetails.slice(0, 3).forEach(test => {
      const percentChange = ((1 - test.ratio) * 100).toFixed(2);
      summary += `- **${test.name}**: improved by ${percentChange}%\n`;
    });
    summary += '\n';
  }
  
  return summary;
}

// Main execution
if (require.main === module) {
  const [baseResultsPath, prResultsPath] = process.argv.slice(2);
  
  if (!baseResultsPath || !prResultsPath) {
    console.error('Usage: compare-performance.js <base-results.json> <pr-results.json>');
    process.exit(1);
  }
  
  comparePerformance(baseResultsPath, prResultsPath);
}