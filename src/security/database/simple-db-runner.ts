#!/usr/bin/env node

/**
 * Simple Database Security Runner
 */

import { SimpleDatabaseSecurityValidator } from './db-security-validator-simple';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

class SimpleDbRunner {
  async run(): Promise<void> {
    console.log('🗄️  YieldSensei Database Security Validator\n');

    const validator = new SimpleDatabaseSecurityValidator();
    
    try {
      const summary = await validator.validateAll();
      
      console.log('\n📊 Database Security Validation Results');
      console.log('========================================\n');
      
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
      
      const reportPath = join(reportDir, 'database-security-report.md');
      const report = validator.generateReport();
      writeFileSync(reportPath, report);
      console.log(`📄 Detailed report saved to: ${reportPath}\n`);
      
      // Show category breakdown
      this.showCategoryBreakdown(validator);
      
      // Exit with appropriate code
      const exitCode = summary.criticalIssues > 0 ? 2 : summary.highIssues > 0 ? 1 : 0;
      
      if (exitCode === 0) {
        console.log('✅ Database security validation completed successfully');
      } else if (exitCode === 1) {
        console.log('🟠 Database security validation completed with high priority issues');
      } else {
        console.log('🔴 Database security validation completed with CRITICAL issues');
      }
      
      process.exit(exitCode);
      
    } catch (error) {
      console.error('❌ Database security validation failed:', error);
      process.exit(1);
    }
  }

  private showCategoryBreakdown(validator: SimpleDatabaseSecurityValidator): void {
    const results = validator.getResults();
    const categories = ['connection', 'injection', 'access', 'encryption', 'monitoring'];
    
    console.log('📋 Results by Category:');
    categories.forEach(category => {
      const categoryResults = results.filter(r => r.category === category);
      const passed = categoryResults.filter(r => r.passed).length;
      const total = categoryResults.length;
      
      if (total > 0) {
        const icon = passed === total ? '✅' : passed > total / 2 ? '⚠️' : '❌';
        console.log(`   ${icon} ${category.charAt(0).toUpperCase() + category.slice(1)}: ${passed}/${total}`);
      }
    });
    console.log('');
  }
}

// Run if called directly
if (require.main === module) {
  const runner = new SimpleDbRunner();
  runner.run();
}

export { SimpleDbRunner };