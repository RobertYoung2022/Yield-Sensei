#!/usr/bin/env node
/**
 * Audit Log Verification CLI
 * 
 * Command-line interface for audit log completeness and integrity verification
 */

import { program } from 'commander';
import { writeFileSync } from 'fs';
import { auditLogVerificationFramework } from './audit-log-verification';

// Define CLI program
program
  .name('audit-log-verification')
  .description('Audit Log Verification CLI')
  .version('1.0.0');

// Main verification command
program
  .command('verify')
  .description('Run comprehensive audit log verification')
  .option('-e, --environment <env>', 'Target environment', 'development')
  .option('-t, --time-range <hours>', 'Time range in hours to verify', '24')
  .option('-f, --format <format>', 'Output format (json|html|csv)', 'json')
  .option('-o, --output <file>', 'Output file path')
  .option('-v, --verbose', 'Verbose output')
  .action(async (options) => {
    try {
      if (options.verbose) {
        console.log(`📋 Starting audit log verification for ${options.environment}`);
        console.log(`⏰ Time range: ${options.timeRange} hours`);
      }

      const timeRangeHours = parseInt(options.timeRange, 10);
      const report = await auditLogVerificationFramework.runVerification(options.environment, timeRangeHours);
      const output = auditLogVerificationFramework.exportReport(report, options.format);

      if (options.output) {
        writeFileSync(options.output, output);
        console.log(`📄 Audit log verification report saved to: ${options.output}`);
      } else {
        console.log(output);
      }

      // Exit with appropriate code
      const exitCode = report.summary.criticalFindings > 0 ? 1 : 0;
      process.exit(exitCode);

    } catch (error) {
      console.error('❌ Verification failed:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Quick verification command
program
  .command('quick')
  .description('Run quick audit log verification (critical issues only)')
  .option('-e, --environment <env>', 'Target environment', 'development')
  .option('-t, --time-range <hours>', 'Time range in hours to verify', '24')
  .action(async (options) => {
    try {
      console.log(`⚡ Running quick audit log verification for ${options.environment}`);
      console.log(`⏰ Checking last ${options.timeRange} hours`);
      
      const timeRangeHours = parseInt(options.timeRange, 10);
      const report = await auditLogVerificationFramework.runVerification(options.environment, timeRangeHours);
      
      const criticalFindings = report.testResults.flatMap(r => r.findings)
        .filter(f => f.severity === 'critical');
      const highRiskFindings = report.testResults.flatMap(r => r.findings)
        .filter(f => f.severity === 'high');

      console.log(`\n📊 Quick Audit Log Verification Results:`);
      console.log(`Environment: ${report.environment}`);
      console.log(`Time Range: ${report.timeRange.start.toLocaleString()} - ${report.timeRange.end.toLocaleString()}`);
      console.log(`Overall Score: ${report.summary.overallScore}/100`);
      console.log(`Compliance Status: ${report.summary.complianceStatus.toUpperCase()}`);
      console.log(`Total Tests: ${report.summary.totalTests}`);
      console.log(`Passed Tests: ${report.summary.passedTests}`);
      console.log(`Critical Findings: ${report.summary.criticalFindings}`);
      console.log(`Logs Analyzed: ${report.overallMetrics.logsAnalyzed.toLocaleString()}`);

      // Show overall metrics
      console.log(`\n📈 Key Metrics:`);
      console.log(`Completeness: ${report.overallMetrics.completenessScore}/100`);
      console.log(`Integrity: ${report.overallMetrics.integrityScore}/100`);
      console.log(`Retention Compliance: ${report.overallMetrics.retentionComplianceScore}/100`);
      console.log(`Accessibility: ${report.overallMetrics.accessibilityScore}/100`);

      if (criticalFindings.length > 0) {
        console.log(`\n🚨 Critical Audit Log Issues Found:`);
        for (const finding of criticalFindings.slice(0, 5)) {
          console.log(`  - ${finding.title}`);
          console.log(`    Impact: ${finding.impact}`);
          console.log(`    Affected Logs: ${finding.affectedLogs.join(', ')}`);
          if (finding.regulatoryImpact) {
            console.log(`    Regulatory Impact: ${finding.regulatoryImpact}`);
          }
          console.log(`    Fix Time: ${finding.estimatedFixTime} hours`);
        }
        if (criticalFindings.length > 5) {
          console.log(`  ... and ${criticalFindings.length - 5} more critical issues`);
        }
      }

      if (highRiskFindings.length > 0 && criticalFindings.length === 0) {
        console.log(`\n⚠️ High Risk Audit Log Issues Found:`);
        for (const finding of highRiskFindings.slice(0, 3)) {
          console.log(`  - ${finding.title}`);
          console.log(`    Impact: ${finding.impact}`);
          console.log(`    Fix Time: ${finding.estimatedFixTime} hours`);
        }
        if (highRiskFindings.length > 3) {
          console.log(`  ... and ${highRiskFindings.length - 3} more high risk issues`);
        }
      }

      if (criticalFindings.length === 0 && highRiskFindings.length === 0) {
        console.log(`\n✅ No critical or high-risk audit log issues found`);
        if (report.summary.overallScore < 80) {
          console.log(`⚠️ Overall score is below 80, consider reviewing medium/low severity issues`);
        }
      }

      // Show compliance status
      console.log(`\n🏛️ Compliance Assessment:`);
      for (const [standard, assessment] of Object.entries(report.complianceAssessment)) {
        const statusIcon = assessment.compliant ? '✅' : '❌';
        console.log(`${statusIcon} ${standard.toUpperCase()}: ${assessment.score}/100 (${assessment.compliant ? 'Compliant' : 'Non-Compliant'})`);
        if (assessment.gaps.length > 0) {
          console.log(`   Gaps: ${assessment.gaps.slice(0, 2).join(', ')}${assessment.gaps.length > 2 ? '...' : ''}`);
        }
      }

      process.exit(criticalFindings.length > 0 ? 1 : 0);

    } catch (error) {
      console.error('❌ Quick verification failed:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Completeness check command
program
  .command('completeness')
  .description('Check audit log completeness')
  .option('-e, --environment <env>', 'Target environment', 'development')
  .option('-t, --time-range <hours>', 'Time range in hours to check', '24')
  .action(async (options) => {
    try {
      console.log(`📊 Checking audit log completeness for ${options.environment}`);
      
      const timeRangeHours = parseInt(options.timeRange, 10);
      const report = await auditLogVerificationFramework.runVerification(options.environment, timeRangeHours);
      
      const completenessTests = report.testResults.filter(r => r.category === 'completeness');
      
      console.log(`\n📋 Completeness Check Results:`);
      console.log(`Time Range: ${report.timeRange.start.toLocaleString()} - ${report.timeRange.end.toLocaleString()}`);
      console.log(`Completeness Score: ${report.overallMetrics.completenessScore}/100`);
      console.log(`Total Logs: ${report.overallMetrics.totalLogs.toLocaleString()}`);
      console.log(`Logs Analyzed: ${report.overallMetrics.logsAnalyzed.toLocaleString()}`);
      
      console.log(`\n📈 Gap Detection:`);
      console.log(`Missing Days: ${report.overallMetrics.gapsDetected.missingDays}`);
      console.log(`Incomplete Hours: ${report.overallMetrics.gapsDetected.incompleteHours}`);
      console.log(`Corrupted Entries: ${report.overallMetrics.gapsDetected.corruptedEntries}`);
      
      if (completenessTests.length > 0) {
        console.log(`\n🔍 Completeness Test Results:`);
        for (const test of completenessTests) {
          const statusIcon = test.passed ? '✅' : '❌';
          console.log(`\n${statusIcon} ${test.name}`);
          console.log(`   Score: ${test.score}/100`);
          console.log(`   Execution Time: ${test.executionTime}ms`);
          
          if (test.findings.length > 0) {
            console.log(`   Issues Found:`);
            for (const finding of test.findings) {
              const severityIcon = finding.severity === 'critical' ? '🔴' : 
                                 finding.severity === 'high' ? '🟠' : 
                                 finding.severity === 'medium' ? '🟡' : '🟢';
              console.log(`     ${severityIcon} ${finding.title}`);
              console.log(`       ${finding.description}`);
            }
          }
        }
      }
      
      const totalGaps = report.overallMetrics.gapsDetected.missingDays + 
                       report.overallMetrics.gapsDetected.incompleteHours + 
                       report.overallMetrics.gapsDetected.corruptedEntries;
      
      process.exit(totalGaps > 0 ? 1 : 0);
      
    } catch (error) {
      console.error('❌ Completeness check failed:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Integrity check command
program
  .command('integrity')
  .description('Check audit log integrity')
  .option('-e, --environment <env>', 'Target environment', 'development')
  .option('-t, --time-range <hours>', 'Time range in hours to check', '24')
  .action(async (options) => {
    try {
      console.log(`🔒 Checking audit log integrity for ${options.environment}`);
      
      const timeRangeHours = parseInt(options.timeRange, 10);
      const report = await auditLogVerificationFramework.runVerification(options.environment, timeRangeHours);
      
      const integrityTests = report.testResults.filter(r => r.category === 'integrity');
      
      console.log(`\n🔐 Integrity Check Results:`);
      console.log(`Time Range: ${report.timeRange.start.toLocaleString()} - ${report.timeRange.end.toLocaleString()}`);
      console.log(`Integrity Score: ${report.overallMetrics.integrityScore}/100`);
      
      if (integrityTests.length > 0) {
        console.log(`\n🔍 Integrity Test Results:`);
        for (const test of integrityTests) {
          const statusIcon = test.passed ? '✅' : '❌';
          console.log(`\n${statusIcon} ${test.name}`);
          console.log(`   Score: ${test.score}/100`);
          console.log(`   Execution Time: ${test.executionTime}ms`);
          
          if (test.findings.length > 0) {
            console.log(`   Integrity Issues:`);
            for (const finding of test.findings) {
              const severityIcon = finding.severity === 'critical' ? '🔴' : 
                                 finding.severity === 'high' ? '🟠' : 
                                 finding.severity === 'medium' ? '🟡' : '🟢';
              console.log(`     ${severityIcon} ${finding.title}`);
              console.log(`       ${finding.description}`);
              console.log(`       Remediation: ${finding.remediation}`);
            }
          }
        }
      }
      
      const integrityIssues = integrityTests.flatMap(t => t.findings).length;
      const criticalIntegrityIssues = integrityTests.flatMap(t => t.findings)
        .filter(f => f.severity === 'critical').length;
      
      if (integrityIssues === 0) {
        console.log(`\n✅ Audit log integrity is maintained`);
      } else {
        console.log(`\n⚠️ ${integrityIssues} integrity issues found (${criticalIntegrityIssues} critical)`);
      }
      
      process.exit(criticalIntegrityIssues > 0 ? 1 : 0);
      
    } catch (error) {
      console.error('❌ Integrity check failed:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Retention compliance command
program
  .command('retention')
  .description('Check audit log retention compliance')
  .option('-e, --environment <env>', 'Target environment', 'production')
  .action(async (options) => {
    try {
      console.log(`📅 Checking audit log retention compliance for ${options.environment}`);
      
      const report = await auditLogVerificationFramework.runVerification(options.environment, 24);
      
      const retentionTests = report.testResults.filter(r => r.category === 'retention');
      
      console.log(`\n📋 Retention Compliance Results:`);
      console.log(`Retention Compliance Score: ${report.overallMetrics.retentionComplianceScore}/100`);
      
      // Show compliance assessment
      console.log(`\n🏛️ Regulatory Compliance:`);
      const standards = [
        { key: 'sox', name: 'SOX (Sarbanes-Oxley)', requirement: '7 years' },
        { key: 'hipaa', name: 'HIPAA', requirement: '6 years' },
        { key: 'pci_dss', name: 'PCI-DSS', requirement: '1 year' },
        { key: 'gdpr', name: 'GDPR', requirement: 'As needed' }
      ];
      
      for (const standard of standards) {
        const assessment = report.complianceAssessment[standard.key];
        if (assessment) {
          const statusIcon = assessment.compliant ? '✅' : '❌';
          console.log(`${statusIcon} ${standard.name} (${standard.requirement}): ${assessment.score}/100`);
          if (assessment.gaps.length > 0) {
            console.log(`   Issues: ${assessment.gaps.join(', ')}`);
          }
        }
      }
      
      if (retentionTests.length > 0) {
        console.log(`\n🔍 Retention Test Results:`);
        for (const test of retentionTests) {
          const statusIcon = test.passed ? '✅' : '❌';
          console.log(`\n${statusIcon} ${test.name}`);
          console.log(`   Score: ${test.score}/100`);
          
          if (test.findings.length > 0) {
            console.log(`   Retention Issues:`);
            for (const finding of test.findings) {
              const severityIcon = finding.severity === 'critical' ? '🔴' : 
                                 finding.severity === 'high' ? '🟠' : 
                                 finding.severity === 'medium' ? '🟡' : '🟢';
              console.log(`     ${severityIcon} ${finding.title}`);
              console.log(`       ${finding.description}`);
              if (finding.regulatoryImpact) {
                console.log(`       Regulatory Impact: ${finding.regulatoryImpact}`);
              }
            }
          }
        }
      }
      
      const retentionIssues = retentionTests.flatMap(t => t.findings).length;
      const nonCompliantStandards = Object.values(report.complianceAssessment)
        .filter((assessment: any) => !assessment.compliant).length;
      
      process.exit(nonCompliantStandards > 0 || retentionIssues > 0 ? 1 : 0);
      
    } catch (error) {
      console.error('❌ Retention compliance check failed:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Performance check command
program
  .command('performance')
  .description('Check audit log performance metrics')
  .option('-e, --environment <env>', 'Target environment', 'development')
  .action(async (options) => {
    try {
      console.log(`⚡ Checking audit log performance for ${options.environment}`);
      
      const report = await auditLogVerificationFramework.runVerification(options.environment, 24);
      
      console.log(`\n📊 Performance Metrics:`);
      console.log(`Average Query Time: ${report.overallMetrics.performanceMetrics.averageQueryTime}ms`);
      console.log(`Indexing Efficiency: ${report.overallMetrics.performanceMetrics.indexingEfficiency}/100`);
      console.log(`Storage Utilization: ${report.overallMetrics.performanceMetrics.storageUtilization}%`);
      
      const performanceTests = report.testResults.filter(r => r.category === 'performance');
      
      if (performanceTests.length > 0) {
        console.log(`\n🔍 Performance Test Results:`);
        for (const test of performanceTests) {
          const statusIcon = test.passed ? '✅' : '❌';
          console.log(`\n${statusIcon} ${test.name}`);
          console.log(`   Score: ${test.score}/100`);
          console.log(`   Execution Time: ${test.executionTime}ms`);
          
          if (test.findings.length > 0) {
            console.log(`   Performance Issues:`);
            for (const finding of test.findings) {
              console.log(`     - ${finding.title}`);
              console.log(`       ${finding.description}`);
            }
          }
        }
      }
      
      // Performance benchmarks
      const queryTimeThreshold = 500; // ms
      const indexingThreshold = 80;
      const storageThreshold = 90;
      
      const performanceIssues = [];
      if (report.overallMetrics.performanceMetrics.averageQueryTime > queryTimeThreshold) {
        performanceIssues.push('Query time exceeds threshold');
      }
      if (report.overallMetrics.performanceMetrics.indexingEfficiency < indexingThreshold) {
        performanceIssues.push('Indexing efficiency below threshold');
      }
      if (report.overallMetrics.performanceMetrics.storageUtilization > storageThreshold) {
        performanceIssues.push('Storage utilization high');
      }
      
      if (performanceIssues.length === 0) {
        console.log(`\n✅ Audit log performance meets requirements`);
      } else {
        console.log(`\n⚠️ Performance Issues Detected:`);
        for (const issue of performanceIssues) {
          console.log(`  - ${issue}`);
        }
      }
      
      console.log(`\n💡 Performance Recommendations:`);
      if (report.overallMetrics.performanceMetrics.averageQueryTime > queryTimeThreshold) {
        console.log(`  - Optimize database indexes for faster query performance`);
        console.log(`  - Consider partitioning large audit log tables`);
      }
      if (report.overallMetrics.performanceMetrics.indexingEfficiency < indexingThreshold) {
        console.log(`  - Review and optimize database indexing strategy`);
        console.log(`  - Consider adding composite indexes for common queries`);
      }
      if (report.overallMetrics.performanceMetrics.storageUtilization > storageThreshold) {
        console.log(`  - Implement archival strategy for old audit logs`);
        console.log(`  - Consider log compression or summarization`);
      }
      
      process.exit(performanceIssues.length > 0 ? 1 : 0);
      
    } catch (error) {
      console.error('❌ Performance check failed:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Gap analysis command
program
  .command('gap-analysis')
  .description('Perform audit log gap analysis')
  .option('-e, --environment <env>', 'Target environment', 'development')
  .option('-t, --time-range <hours>', 'Time range in hours to analyze', '168') // 1 week default
  .action(async (options) => {
    try {
      console.log(`🔍 Performing audit log gap analysis for ${options.environment}`);
      console.log(`⏰ Analyzing ${options.timeRange} hours of audit logs`);
      
      const timeRangeHours = parseInt(options.timeRange, 10);
      const report = await auditLogVerificationFramework.runVerification(options.environment, timeRangeHours);
      
      console.log(`\n📊 Gap Analysis Results:`);
      console.log(`Time Range Analyzed: ${report.overallMetrics.timeRangeCovered.totalDays} days`);
      console.log(`Total Logs Expected: ${report.overallMetrics.totalLogs.toLocaleString()}`);
      console.log(`Logs Found: ${report.overallMetrics.logsAnalyzed.toLocaleString()}`);
      
      const gapsDetected = report.overallMetrics.gapsDetected;
      console.log(`\n🕳️ Gaps Detected:`);
      console.log(`Missing Days: ${gapsDetected.missingDays}`);
      console.log(`Incomplete Hours: ${gapsDetected.incompleteHours}`);
      console.log(`Corrupted Entries: ${gapsDetected.corruptedEntries}`);
      
      const totalGaps = gapsDetected.missingDays + gapsDetected.incompleteHours + gapsDetected.corruptedEntries;
      
      if (totalGaps === 0) {
        console.log(`\n✅ No gaps detected in audit log coverage`);
      } else {
        console.log(`\n⚠️ ${totalGaps} gaps detected in audit log coverage`);
        
        // Show findings related to gaps
        const gapFindings = report.testResults.flatMap(r => r.findings)
          .filter(f => f.type === 'missing_logs' || f.type === 'integrity_failure');
        
        if (gapFindings.length > 0) {
          console.log(`\n🔍 Detailed Gap Analysis:`);
          for (const finding of gapFindings) {
            const severityIcon = finding.severity === 'critical' ? '🔴' : 
                               finding.severity === 'high' ? '🟠' : 
                               finding.severity === 'medium' ? '🟡' : '🟢';
            console.log(`\n${severityIcon} ${finding.title}`);
            console.log(`   Description: ${finding.description}`);
            console.log(`   Impact: ${finding.impact}`);
            console.log(`   Affected Logs: ${finding.affectedLogs.join(', ')}`);
            if (finding.timeRange) {
              console.log(`   Time Range: ${finding.timeRange.start.toLocaleString()} - ${finding.timeRange.end.toLocaleString()}`);
            }
            console.log(`   Remediation: ${finding.remediation}`);
            console.log(`   Estimated Fix Time: ${finding.estimatedFixTime} hours`);
          }
        }
      }
      
      // Recommendations for gap mitigation
      console.log(`\n💡 Gap Mitigation Recommendations:`);
      if (gapsDetected.missingDays > 0) {
        console.log(`  - Investigate log collection failures for missing days`);
        console.log(`  - Implement log collection monitoring and alerting`);
        console.log(`  - Review log rotation and archival processes`);
      }
      if (gapsDetected.incompleteHours > 0) {
        console.log(`  - Check for intermittent log collection issues`);
        console.log(`  - Verify log shipping and aggregation processes`);
        console.log(`  - Implement hourly log completeness checks`);
      }
      if (gapsDetected.corruptedEntries > 0) {
        console.log(`  - Investigate log corruption causes`);
        console.log(`  - Implement log integrity verification`);
        console.log(`  - Review storage system health`);
      }
      if (totalGaps === 0) {
        console.log(`  - Continue current log management practices`);
        console.log(`  - Consider implementing proactive monitoring`);
        console.log(`  - Regular gap analysis scheduling recommended`);
      }
      
      process.exit(totalGaps > 0 ? 1 : 0);
      
    } catch (error) {
      console.error('❌ Gap analysis failed:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Risk assessment command
program
  .command('risk-assessment')
  .description('Perform audit log risk assessment')
  .option('-e, --environment <env>', 'Target environment', 'production')
  .action(async (options) => {
    try {
      console.log(`🎯 Performing audit log risk assessment for ${options.environment}`);
      
      const report = await auditLogVerificationFramework.runVerification(options.environment, 24);
      
      console.log(`\n📊 Risk Assessment Results:`);
      console.log(`Data Loss Risk: ${report.riskAssessment.dataLossRisk.toUpperCase()}`);
      console.log(`Compliance Risk: ${report.riskAssessment.complianceRisk.toUpperCase()}`);
      console.log(`Operational Risk: ${report.riskAssessment.operationalRisk.toUpperCase()}`);
      
      // Overall risk level
      const riskLevels = [
        report.riskAssessment.dataLossRisk,
        report.riskAssessment.complianceRisk,
        report.riskAssessment.operationalRisk
      ];
      
      const maxRisk = riskLevels.includes('critical') ? 'critical' :
                     riskLevels.includes('high') ? 'high' :
                     riskLevels.includes('medium') ? 'medium' : 'low';
      
      const riskIcon = maxRisk === 'critical' ? '🔴' : 
                      maxRisk === 'high' ? '🟠' : 
                      maxRisk === 'medium' ? '🟡' : '🟢';
      
      console.log(`\n${riskIcon} Overall Risk Level: ${maxRisk.toUpperCase()}`);
      
      if (report.riskAssessment.mitigationPriority.length > 0) {
        console.log(`\n🎯 Priority Mitigations:`);
        for (const finding of report.riskAssessment.mitigationPriority) {
          const severityIcon = finding.severity === 'critical' ? '🔴' : 
                             finding.severity === 'high' ? '🟠' : 
                             finding.severity === 'medium' ? '🟡' : '🟢';
          console.log(`\n${severityIcon} ${finding.title}`);
          console.log(`   Risk Type: ${finding.type.replace('_', ' ').toUpperCase()}`);
          console.log(`   Impact: ${finding.impact}`);
          console.log(`   Affected Logs: ${finding.affectedLogs.join(', ')}`);
          console.log(`   Remediation: ${finding.remediation}`);
          console.log(`   Estimated Effort: ${finding.estimatedFixTime} hours`);
          if (finding.regulatoryImpact) {
            console.log(`   Regulatory Impact: ${finding.regulatoryImpact}`);
          }
        }
      }
      
      // Risk mitigation strategy
      console.log(`\n🛡️ Risk Mitigation Strategy:`);
      if (maxRisk === 'critical') {
        console.log(`  IMMEDIATE ACTION REQUIRED:`);
        console.log(`  - Address all critical findings immediately`);
        console.log(`  - Implement emergency log protection measures`);
        console.log(`  - Notify compliance and security teams`);
      } else if (maxRisk === 'high') {
        console.log(`  HIGH PRIORITY ACTIONS:`);
        console.log(`  - Address high-risk findings within 24-48 hours`);
        console.log(`  - Review and strengthen audit log controls`);
        console.log(`  - Increase monitoring and alerting`);
      } else if (maxRisk === 'medium') {
        console.log(`  MODERATE PRIORITY ACTIONS:`);
        console.log(`  - Address medium-risk findings within 1 week`);
        console.log(`  - Review audit log policies and procedures`);
        console.log(`  - Consider preventive measures`);
      } else {
        console.log(`  MAINTENANCE ACTIONS:`);
        console.log(`  - Continue current practices`);
        console.log(`  - Regular monitoring and assessment`);
        console.log(`  - Proactive improvement opportunities`);
      }
      
      // Risk scores and metrics
      const totalFindings = report.testResults.flatMap(r => r.findings).length;
      const criticalFindings = report.testResults.flatMap(r => r.findings)
        .filter(f => f.severity === 'critical').length;
      
      console.log(`\n📈 Risk Metrics:`);
      console.log(`Total Findings: ${totalFindings}`);
      console.log(`Critical Findings: ${criticalFindings}`);
      console.log(`Overall Score: ${report.summary.overallScore}/100`);
      console.log(`Compliance Status: ${report.summary.complianceStatus.toUpperCase()}`);
      
      process.exit(maxRisk === 'critical' ? 2 : maxRisk === 'high' ? 1 : 0);
      
    } catch (error) {
      console.error('❌ Risk assessment failed:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Help command
program
  .command('help-extended')
  .description('Show extended help and examples')
  .action(() => {
    console.log(`
📋 Audit Log Verification CLI - Extended Help

OVERVIEW:
This tool provides comprehensive audit log verification including completeness,
integrity, retention compliance, and regulatory requirements validation.

COMMANDS:
  verify              Run comprehensive audit log verification
  quick               Quick verification (critical issues only)
  completeness        Check log completeness and gaps
  integrity           Check log integrity and tampering detection
  retention           Check retention policy compliance
  performance         Check performance metrics
  gap-analysis        Perform detailed gap analysis
  risk-assessment     Perform risk assessment

EXAMPLES:
  # Quick verification of last 24 hours
  audit-log-verification quick -e production -t 24

  # Comprehensive verification with HTML report
  audit-log-verification verify -e production -f html -o audit_report.html

  # Check completeness for last week
  audit-log-verification completeness -e production -t 168

  # Integrity check for critical systems
  audit-log-verification integrity -e production -t 24

  # Retention compliance for financial data (SOX)
  audit-log-verification retention -e production

  # Performance monitoring
  audit-log-verification performance -e development

  # Gap analysis for compliance audit
  audit-log-verification gap-analysis -e production -t 720  # 30 days

  # Risk assessment for security review
  audit-log-verification risk-assessment -e production

OUTPUT FORMATS:
  json    JSON format (default, machine readable)
  html    HTML report (human readable with charts)
  csv     CSV format (spreadsheet compatible)

COMPLIANCE STANDARDS:
  SOX      Sarbanes-Oxley Act (7 year retention)
  HIPAA    Health Insurance Portability (6 year retention)
  PCI-DSS  Payment Card Industry (1 year retention)
  GDPR     General Data Protection Regulation
  
EXIT CODES:
  0    Success, no critical issues
  1    Warning, some issues found
  2    Critical issues require immediate attention

ENVIRONMENT VARIABLES:
  AUDIT_LOG_PATH       Path to audit log storage
  AUDIT_RETENTION_SOX  SOX retention period override
  AUDIT_DB_CONNECTION  Database connection for audit logs
    `);
  });

// Parse command line arguments
program.parse();

export { program };