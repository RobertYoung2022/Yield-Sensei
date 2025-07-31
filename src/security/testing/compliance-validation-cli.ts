#!/usr/bin/env node
/**
 * Compliance Validation CLI
 * 
 * Command-line interface for compliance and regulatory validation
 */

import { program } from 'commander';
import { writeFileSync } from 'fs';
import { complianceValidationFramework } from './compliance-validation-framework';

// Define CLI program
program
  .name('compliance-validation')
  .description('Compliance and Regulatory Validation CLI')
  .version('1.0.0');

// Main validation command
program
  .command('validate')
  .description('Run comprehensive compliance validation')
  .option('-e, --environment <env>', 'Target environment', 'development')
  .option('-s, --standards <standards>', 'Comma-separated list of standards (nist,owasp,pci_dss,hipaa,sox,gdpr,iso27001,fips140_2)', 'all')
  .option('-f, --format <format>', 'Output format (json|html|csv)', 'json')
  .option('-o, --output <file>', 'Output file path')
  .option('-v, --verbose', 'Verbose output')
  .action(async (options) => {
    try {
      if (options.verbose) {
        console.log(`🏛️ Starting compliance validation for ${options.environment}`);
        console.log(`📋 Standards: ${options.standards}`);
      }

      const standards = options.standards === 'all' ? ['all'] : options.standards.split(',');
      const report = await complianceValidationFramework.runValidation(options.environment, standards);
      const output = complianceValidationFramework.exportReport(report, options.format);

      if (options.output) {
        writeFileSync(options.output, output);
        console.log(`📄 Compliance report saved to: ${options.output}`);
      } else {
        console.log(output);
      }

      // Exit with appropriate code
      const exitCode = report.summary.criticalFindings > 0 ? 1 : 0;
      process.exit(exitCode);

    } catch (error) {
      console.error('❌ Validation failed:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Quick compliance check command
program
  .command('quick')
  .description('Run quick compliance check (critical issues only)')
  .option('-e, --environment <env>', 'Target environment', 'development')
  .option('-s, --standards <standards>', 'Comma-separated list of standards', 'nist,owasp')
  .action(async (options) => {
    try {
      console.log(`⚡ Running quick compliance check for ${options.environment}`);
      
      const standards = options.standards.split(',');
      const report = await complianceValidationFramework.runValidation(options.environment, standards);
      
      const criticalFindings = report.complianceResults.flatMap(r => r.findings)
        .filter(f => f.severity === 'critical');
      const highRiskFindings = report.complianceResults.flatMap(r => r.findings)
        .filter(f => f.severity === 'high');

      console.log(`\n📊 Quick Compliance Check Results:`);
      console.log(`Environment: ${report.environment}`);
      console.log(`Overall Score: ${report.overallScore}/100`);
      console.log(`Standards Assessed: ${report.scope.join(', ')}`);
      console.log(`Total Controls: ${report.summary.totalControls}`);
      console.log(`Compliant Controls: ${report.summary.compliantControls}`);
      console.log(`Critical Findings: ${report.summary.criticalFindings}`);
      console.log(`High Risk Findings: ${report.summary.highRiskFindings}`);
      console.log(`Total Risk Score: ${report.summary.totalRiskScore}`);

      if (criticalFindings.length > 0) {
        console.log(`\n🚨 Critical Compliance Issues Found:`);
        for (const finding of criticalFindings.slice(0, 5)) {
          console.log(`  - ${finding.title}`);
          console.log(`    Impact: ${finding.impact}`);
          console.log(`    Control: ${finding.controlReference}`);
          console.log(`    Risk Score: ${finding.riskScore}/10`);
        }
        if (criticalFindings.length > 5) {
          console.log(`  ... and ${criticalFindings.length - 5} more critical issues`);
        }
      }

      if (highRiskFindings.length > 0 && criticalFindings.length === 0) {
        console.log(`\n⚠️ High Risk Compliance Issues Found:`);
        for (const finding of highRiskFindings.slice(0, 3)) {
          console.log(`  - ${finding.title}`);
          console.log(`    Control: ${finding.controlReference}`);
        }
        if (highRiskFindings.length > 3) {
          console.log(`  ... and ${highRiskFindings.length - 3} more high risk issues`);
        }
      }

      if (criticalFindings.length === 0 && highRiskFindings.length === 0) {
        console.log(`\n✅ No critical or high-risk compliance issues found`);
        if (report.overallScore < 80) {
          console.log(`⚠️ Compliance score is below 80, consider reviewing medium/low severity issues`);
        }
      }

      // Show standards compliance summary
      console.log(`\n🏛️ Standards Compliance Summary:`);
      for (const [standard, result] of Object.entries(report.standardsCompliance)) {
        const statusIcon = result.status === 'compliant' ? '✅' : 
                          result.status === 'partially-compliant' ? '⚠️' : '❌';
        console.log(`${statusIcon} ${result.standard}: ${result.overallCompliance}% (${result.implementedControls}/${result.totalControls})`);
      }

      process.exit(criticalFindings.length > 0 ? 1 : 0);

    } catch (error) {
      console.error('❌ Quick check failed:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Standards-specific validation commands
program
  .command('nist')
  .description('Run NIST Cybersecurity Framework compliance check')
  .option('-e, --environment <env>', 'Target environment', 'development')
  .action(async (options) => {
    await runStandardValidation('nist', 'NIST Cybersecurity Framework', options.environment);
  });

program
  .command('owasp')
  .description('Run OWASP Top 10 compliance check')
  .option('-e, --environment <env>', 'Target environment', 'development')
  .action(async (options) => {
    await runStandardValidation('owasp', 'OWASP Top 10 2021', options.environment);
  });

program
  .command('pci-dss')
  .description('Run PCI-DSS compliance check')
  .option('-e, --environment <env>', 'Target environment', 'production')
  .action(async (options) => {
    await runStandardValidation('pci_dss', 'PCI-DSS v4.0', options.environment);
  });

program
  .command('hipaa')
  .description('Run HIPAA compliance check')
  .option('-e, --environment <env>', 'Target environment', 'production')
  .action(async (options) => {
    await runStandardValidation('hipaa', 'HIPAA', options.environment);
  });

program
  .command('sox')
  .description('Run SOX compliance check')
  .option('-e, --environment <env>', 'Target environment', 'production')
  .action(async (options) => {
    await runStandardValidation('sox', 'Sarbanes-Oxley Act', options.environment);
  });

program
  .command('gdpr')
  .description('Run GDPR compliance check')
  .option('-e, --environment <env>', 'Target environment', 'production')
  .action(async (options) => {
    await runStandardValidation('gdpr', 'GDPR', options.environment);
  });

// Risk assessment command
program
  .command('risk-assessment')
  .description('Generate compliance risk assessment')
  .option('-e, --environment <env>', 'Target environment', 'development')
  .option('-s, --standards <standards>', 'Standards to assess', 'all')
  .action(async (options) => {
    try {
      console.log(`🎯 Generating compliance risk assessment for ${options.environment}`);
      
      const standards = options.standards === 'all' ? ['all'] : options.standards.split(',');
      const report = await complianceValidationFramework.runValidation(options.environment, standards);
      
      console.log(`\n📊 Risk Assessment Results:`);
      console.log(`Overall Risk Level: ${report.riskAssessment.overallRiskLevel.toUpperCase()}`);
      console.log(`Total Risk Score: ${report.summary.totalRiskScore}`);
      console.log(`Estimated Remediation: ${report.remediationPlan.resources.estimatedCost}`);
      console.log(`Timeline: ${report.remediationPlan.resources.timeline}`);
      
      console.log(`\n🚨 Top Risks:`);
      for (const risk of report.riskAssessment.topRisks.slice(0, 5)) {
        const severityIcon = risk.severity === 'critical' ? '🔴' : 
                            risk.severity === 'high' ? '🟠' : 
                            risk.severity === 'medium' ? '🟡' : '🟢';
        console.log(`\n${severityIcon} ${risk.title}`);
        console.log(`   Risk Score: ${risk.riskScore}/10`);
        console.log(`   Impact: ${risk.impact}`);
        console.log(`   Business Impact: ${risk.businessImpact.toUpperCase()}`);
        console.log(`   Remediation: ${risk.remediation}`);
        console.log(`   Effort: ${risk.technicalDebt} hours`);
      }
      
      console.log(`\n💼 Business Impact Assessment:`);
      console.log(`Financial: ${report.riskAssessment.businessImpact.financial}`);
      console.log(`Operational: ${report.riskAssessment.businessImpact.operational}`);
      console.log(`Reputational: ${report.riskAssessment.businessImpact.reputational}`);
      console.log(`Regulatory: ${report.riskAssessment.businessImpact.regulatory}`);
      
    } catch (error) {
      console.error('❌ Risk assessment failed:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Remediation plan command
program
  .command('remediation-plan')
  .description('Generate compliance remediation plan')
  .option('-e, --environment <env>', 'Target environment', 'development')
  .option('-s, --standards <standards>', 'Standards to assess', 'all')
  .option('-p, --priority <level>', 'Filter by priority (immediate|short|medium|long)')
  .action(async (options) => {
    try {
      console.log(`🔧 Generating compliance remediation plan for ${options.environment}`);
      
      const standards = options.standards === 'all' ? ['all'] : options.standards.split(',');
      const report = await complianceValidationFramework.runValidation(options.environment, standards);
      
      console.log(`\n📋 Remediation Plan Summary:`);
      console.log(`Total Estimated Cost: ${report.remediationPlan.resources.estimatedCost}`);
      console.log(`Timeline: ${report.remediationPlan.resources.timeline}`);
      console.log(`Required Skills: ${report.remediationPlan.resources.requiredSkills.join(', ')}`);
      
      const showSection = (title: string, items: any[], icon: string) => {
        if (!options.priority || title.toLowerCase().includes(options.priority.toLowerCase())) {
          console.log(`\n${icon} ${title} (${items.length} items):`);
          for (const item of items) {
            console.log(`  - ${item.title}`);
            console.log(`    Remediation: ${item.remediation}`);
            console.log(`    Effort: ${item.technicalDebt} hours`);
            console.log(`    Business Impact: ${item.businessImpact.toUpperCase()}`);
          }
        }
      };
      
      showSection('Immediate Action Required', report.remediationPlan.immediate, '🚨');
      showSection('Short Term (30 days)', report.remediationPlan.shortTerm, '⚡');
      showSection('Medium Term (90 days)', report.remediationPlan.mediumTerm, '🔧');
      showSection('Long Term (180+ days)', report.remediationPlan.longTerm, '📅');
      
    } catch (error) {
      console.error('❌ Remediation plan generation failed:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Audit readiness command
program
  .command('audit-readiness')
  .description('Assess audit readiness')
  .option('-e, --environment <env>', 'Target environment', 'production')
  .option('-s, --standards <standards>', 'Standards to assess', 'all')
  .action(async (options) => {
    try {
      console.log(`📋 Assessing audit readiness for ${options.environment}`);
      
      const standards = options.standards === 'all' ? ['all'] : options.standards.split(',');
      const report = await complianceValidationFramework.runValidation(options.environment, standards);
      
      console.log(`\n✅ Audit Readiness Assessment:`);
      console.log(`Readiness Score: ${report.auditReadiness.score}/100`);
      
      const readinessLevel = report.auditReadiness.score >= 90 ? 'Excellent' :
                           report.auditReadiness.score >= 80 ? 'Good' :
                           report.auditReadiness.score >= 70 ? 'Fair' : 'Poor';
      
      console.log(`Readiness Level: ${readinessLevel}`);
      
      if (report.auditReadiness.missingDocumentation.length > 0) {
        console.log(`\n📄 Missing Documentation (${report.auditReadiness.missingDocumentation.length} items):`);
        for (const doc of report.auditReadiness.missingDocumentation.slice(0, 10)) {
          console.log(`  - ${doc}`);
        }
        if (report.auditReadiness.missingDocumentation.length > 10) {
          console.log(`  ... and ${report.auditReadiness.missingDocumentation.length - 10} more`);
        }
      }
      
      if (report.auditReadiness.incompleteControls.length > 0) {
        console.log(`\n⚠️ Incomplete Controls (${report.auditReadiness.incompleteControls.length} items):`);
        for (const control of report.auditReadiness.incompleteControls.slice(0, 10)) {
          console.log(`  - ${control}`);
        }
        if (report.auditReadiness.incompleteControls.length > 10) {
          console.log(`  ... and ${report.auditReadiness.incompleteControls.length - 10} more`);
        }
      }
      
      console.log(`\n💡 Recommendations:`);
      for (const rec of report.auditReadiness.recommendations) {
        console.log(`  - ${rec}`);
      }
      
      const exitCode = report.auditReadiness.score >= 80 ? 0 : 1;
      process.exit(exitCode);
      
    } catch (error) {
      console.error('❌ Audit readiness assessment failed:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Gap analysis command
program
  .command('gap-analysis')
  .description('Perform compliance gap analysis')
  .option('-e, --environment <env>', 'Target environment', 'development')
  .option('-s, --standard <standard>', 'Specific standard for gap analysis', 'nist')
  .action(async (options) => {
    try {
      console.log(`🔍 Performing gap analysis for ${options.standard.toUpperCase()} in ${options.environment}`);
      
      const report = await complianceValidationFramework.runValidation(options.environment, [options.standard]);
      const standardResult = report.standardsCompliance[options.standard];
      
      if (!standardResult) {
        console.error(`❌ Standard '${options.standard}' not found`);
        process.exit(1);
      }
      
      console.log(`\n📊 ${standardResult.standard} Gap Analysis:`);
      console.log(`Overall Compliance: ${standardResult.overallCompliance}%`);
      console.log(`Implemented Controls: ${standardResult.implementedControls}/${standardResult.totalControls}`);
      console.log(`Critical Gaps: ${standardResult.criticalGaps}`);
      console.log(`Status: ${standardResult.status.toUpperCase()}`);
      
      const gaps = report.complianceResults
        .filter(r => r.category === options.standard && r.complianceStatus !== 'compliant')
        .sort((a, b) => {
          const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
          const maxSeverityA = Math.max(...a.findings.map(f => severityOrder[f.severity] || 0));
          const maxSeverityB = Math.max(...b.findings.map(f => severityOrder[f.severity] || 0));
          return maxSeverityB - maxSeverityA;
        });
      
      console.log(`\n❌ Identified Gaps (${gaps.length} total):`);
      for (const gap of gaps) {
        const maxSeverity = gap.findings.reduce((max, f) => 
          f.severity === 'critical' ? 'critical' :
          f.severity === 'high' && max !== 'critical' ? 'high' :
          f.severity === 'medium' && !['critical', 'high'].includes(max) ? 'medium' : max
        , 'low');
        
        const severityIcon = maxSeverity === 'critical' ? '🔴' : 
                           maxSeverity === 'high' ? '🟠' : 
                           maxSeverity === 'medium' ? '🟡' : '🟢';
        
        console.log(`\n${severityIcon} ${gap.name}`);
        console.log(`   Status: ${gap.complianceStatus.toUpperCase()}`);
        console.log(`   Score: ${gap.score}/100`);
        console.log(`   Findings: ${gap.findings.length}`);
        
        if (gap.findings.length > 0) {
          const topFinding = gap.findings[0];
          console.log(`   Primary Issue: ${topFinding.description}`);
          console.log(`   Remediation: ${topFinding.remediation}`);
          console.log(`   Effort: ${topFinding.technicalDebt} hours`);
        }
      }
      
      if (gaps.length === 0) {
        console.log(`✅ No gaps identified for ${standardResult.standard}`);
      }
      
    } catch (error) {
      console.error('❌ Gap analysis failed:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// List available standards command
program
  .command('list-standards')
  .description('List all available compliance standards')
  .action(() => {
    console.log(`\n📋 Available Compliance Standards:\n`);
    
    const standards = [
      { key: 'nist', name: 'NIST Cybersecurity Framework', version: '1.1', description: 'Comprehensive cybersecurity framework' },
      { key: 'owasp', name: 'OWASP Top 10', version: '2021', description: 'Top 10 web application security risks' },
      { key: 'pci_dss', name: 'PCI-DSS', version: '4.0', description: 'Payment Card Industry Data Security Standard' },
      { key: 'hipaa', name: 'HIPAA', version: '2013', description: 'Health Insurance Portability and Accountability Act' },
      { key: 'sox', name: 'SOX', version: '2002', description: 'Sarbanes-Oxley Act' },
      { key: 'gdpr', name: 'GDPR', version: '2018', description: 'General Data Protection Regulation' },
      { key: 'iso27001', name: 'ISO 27001', version: '2022', description: 'Information Security Management' },
      { key: 'fips140_2', name: 'FIPS 140-2', version: '2001', description: 'Federal Information Processing Standards' }
    ];
    
    for (const standard of standards) {
      console.log(`🏛️ ${standard.name} (${standard.version})`);
      console.log(`   Key: ${standard.key}`);
      console.log(`   Description: ${standard.description}`);
      console.log(`   Usage: compliance-validation ${standard.key} -e production\n`);
    }
    
    console.log(`💡 Usage Examples:`);
    console.log(`   compliance-validation validate -s nist,owasp -e production`);
    console.log(`   compliance-validation quick -s pci_dss,hipaa -e production`);
    console.log(`   compliance-validation risk-assessment -s all -e production`);
    console.log(`   compliance-validation gap-analysis -s nist -e development`);
  });

// Helper function for standard-specific validation
async function runStandardValidation(standard: string, standardName: string, environment: string) {
  try {
    console.log(`🏛️ Running ${standardName} compliance validation for ${environment}`);
    
    const report = await complianceValidationFramework.runValidation(environment, [standard]);
    const standardResult = report.standardsCompliance[standard];
    
    console.log(`\n📊 ${standardName} Compliance Results:`);
    console.log(`Overall Compliance: ${standardResult.overallCompliance}%`);
    console.log(`Status: ${standardResult.status.toUpperCase()}`);
    console.log(`Implemented Controls: ${standardResult.implementedControls}/${standardResult.totalControls}`);
    console.log(`Critical Gaps: ${standardResult.criticalGaps}`);
    console.log(`Next Review: ${standardResult.nextReview.toLocaleDateString()}`);
    
    const findings = report.complianceResults.flatMap(r => r.findings);
    const criticalFindings = findings.filter(f => f.severity === 'critical');
    const highFindings = findings.filter(f => f.severity === 'high');
    
    if (criticalFindings.length > 0) {
      console.log(`\n🚨 Critical Issues (${criticalFindings.length}):`);
      for (const finding of criticalFindings.slice(0, 3)) {
        console.log(`  - ${finding.title}`);
        console.log(`    ${finding.description}`);
        console.log(`    Remediation: ${finding.remediation}`);
      }
    }
    
    if (highFindings.length > 0) {
      console.log(`\n⚠️ High Priority Issues (${highFindings.length}):`);
      for (const finding of highFindings.slice(0, 3)) {
        console.log(`  - ${finding.title}`);
        console.log(`    ${finding.description}`);
      }
    }
    
    if (findings.length === 0) {
      console.log(`\n✅ No compliance issues found for ${standardName}`);
    }
    
    console.log(`\n💡 Recommendations:`);
    const recommendations = report.complianceResults
      .flatMap(r => r.recommendations)
      .filter((rec, index, arr) => arr.indexOf(rec) === index)
      .slice(0, 5);
    
    for (const rec of recommendations) {
      console.log(`  - ${rec}`);
    }
    
    process.exit(standardResult.status === 'compliant' ? 0 : 1);
    
  } catch (error) {
    console.error(`❌ ${standardName} validation failed:`, error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

// Parse command line arguments
program.parse();

export { program };