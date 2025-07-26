#!/usr/bin/env node

/**
 * Simple Environment Variable Security Runner
 */

import { SimpleEnvironmentValidator } from './env-validator-simple';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

class SimpleEnvRunner {
  async run(): Promise<void> {
    console.log('🔍 YieldSensei Environment Variable Security Validator\n');

    const validator = new SimpleEnvironmentValidator();
    
    try {
      const summary = await validator.validateAll();
      
      console.log('\n📊 Security Validation Results');
      console.log('==============================\n');
      
      console.log(`✅ Tests Passed:       ${summary.passed}/${summary.totalTests}`);
      console.log(`❌ Tests Failed:       ${summary.failed}/${summary.totalTests}`);
      console.log(`📈 Success Rate:       ${summary.successRate.toFixed(2)}%\n`);
      
      if (summary.criticalIssues > 0 || summary.highIssues > 0) {
        console.log('🚨 Issues by Severity:');
        if (summary.criticalIssues > 0) {
          console.log(`   🔴 Critical:        ${summary.criticalIssues}`);
        }
        if (summary.highIssues > 0) {
          console.log(`   🟠 High:            ${summary.highIssues}`);
        }
        if (summary.mediumIssues > 0) {
          console.log(`   🟡 Medium:          ${summary.mediumIssues}`);
        }
        console.log('');
      }
      
      if (summary.recommendations.length > 0) {
        console.log('💡 Top Recommendations:');
        summary.recommendations.slice(0, 5).forEach(rec => {
          console.log(`   - ${rec}`);
        });
        console.log('');
      }
      
      // Save detailed report
      const reportDir = join(process.cwd(), 'reports');
      if (!existsSync(reportDir)) {
        mkdirSync(reportDir, { recursive: true });
      }
      
      const reportPath = join(reportDir, 'env-security-report.md');
      const report = validator.generateReport();
      writeFileSync(reportPath, report);
      console.log(`📄 Detailed report saved to: ${reportPath}\n`);
      
      // Exit with appropriate code
      const exitCode = summary.criticalIssues > 0 ? 2 : summary.highIssues > 0 ? 1 : 0;
      
      if (exitCode === 0) {
        console.log('✅ Environment variable security validation completed successfully');
      } else if (exitCode === 1) {
        console.log('🟠 Environment variable security validation completed with high priority issues');
      } else {
        console.log('🔴 Environment variable security validation completed with CRITICAL issues');
      }
      
      process.exit(exitCode);
      
    } catch (error) {
      console.error('❌ Validation failed:', error);
      process.exit(1);
    }
  }
}

// Run if called directly
if (require.main === module) {
  const runner = new SimpleEnvRunner();
  runner.run();
}

export { SimpleEnvRunner };