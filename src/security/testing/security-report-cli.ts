#!/usr/bin/env node
/**
 * Security Report Generator CLI
 * 
 * Command-line interface for generating consolidated security reports
 */

import { program } from 'commander';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { securityReportGenerator, SecurityReportConfig } from './security-report-generator';

// Define CLI program
program
  .name('security-report')
  .description('Automated Security Report Generator CLI')
  .version('1.0.0');

// Generate comprehensive security report
program
  .command('generate')
  .description('Generate comprehensive security report')
  .option('-e, --environment <env>', 'Target environment', 'development')
  .option('-o, --output <dir>', 'Output directory', './security-reports')
  .option('-f, --formats <formats>', 'Output formats (json,html,csv)', 'json,html')
  .option('-c, --components <components>', 'Components to include (comprehensive,encryption,environment,database,compliance,auditLogs)', 'all')
  .option('-s, --standards <standards>', 'Compliance standards', 'nist,owasp,pci_dss')
  .option('-t, --time-range <hours>', 'Time range for audit logs in hours', '24')
  .option('-v, --verbose', 'Verbose output')
  .action(async (options) => {
    try {
      if (options.verbose) {
        console.log(`🛡️ Generating comprehensive security report for ${options.environment}`);
        console.log(`📂 Output directory: ${options.output}`);
        console.log(`📋 Formats: ${options.formats}`);
      }

      // Parse options
      const formats = options.formats.split(',') as ('json' | 'html' | 'csv')[];
      const componentsList = options.components === 'all' ? 
        ['comprehensive', 'encryption', 'environment', 'database', 'compliance', 'auditLogs'] :
        options.components.split(',');
      
      const includeComponents = {
        comprehensive: componentsList.includes('comprehensive'),
        encryption: componentsList.includes('encryption'),
        environment: componentsList.includes('environment'),
        database: componentsList.includes('database'),
        compliance: componentsList.includes('compliance'),
        auditLogs: componentsList.includes('auditLogs')
      };

      const config: SecurityReportConfig = {
        environment: options.environment,
        includeComponents,
        formats,
        outputDirectory: options.output,
        timeRange: {
          hours: parseInt(options.timeRange, 10)
        },
        compliance: {
          standards: options.standards.split(',')
        }
      };

      console.log(`🔄 Generating security report...`);
      const report = await securityReportGenerator.generateReport(config);

      // Ensure output directory exists
      if (!existsSync(options.output)) {
        mkdirSync(options.output, { recursive: true });
      }

      // Generate reports in requested formats
      for (const format of formats) {
        const output = securityReportGenerator.exportReport(report, format);
        const filename = `security-report-${report.environment}-${report.generated.toISOString().split('T')[0]}.${format}`;
        const filepath = join(options.output, filename);
        
        writeFileSync(filepath, output);
        console.log(`📄 ${format.toUpperCase()} report saved: ${filepath}`);
      }

      // Show summary
      console.log(`\n📊 Security Report Summary:`);
      console.log(`Environment: ${report.environment}`);
      console.log(`Overall Security Score: ${report.executiveSummary.overallSecurityScore}/100`);
      console.log(`Risk Level: ${report.executiveSummary.riskLevel.toUpperCase()}`);
      console.log(`Critical Findings: ${report.executiveSummary.criticalFindings}`);
      console.log(`High Priority: ${report.executiveSummary.highPriorityFindings}`);
      console.log(`Components Analyzed: ${Object.entries(includeComponents).filter(([_, enabled]) => enabled).map(([name]) => name).join(', ')}`);

      if (report.executiveSummary.criticalFindings > 0) {
        console.log(`\n🚨 IMMEDIATE ATTENTION REQUIRED:`);
        console.log(`${report.executiveSummary.criticalFindings} critical security issues found`);
        console.log(`Review the detailed report for remediation steps.`);
      }

      // Exit with appropriate code
      const exitCode = report.executiveSummary.criticalFindings > 0 ? 1 : 0;
      process.exit(exitCode);

    } catch (error) {
      console.error('❌ Report generation failed:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Quick security overview
program
  .command('overview')
  .description('Generate quick security overview')
  .option('-e, --environment <env>', 'Target environment', 'development')
  .action(async (options) => {
    try {
      console.log(`⚡ Generating quick security overview for ${options.environment}`);

      const config: SecurityReportConfig = {
        environment: options.environment,
        includeComponents: {
          comprehensive: true,
          encryption: true,
          environment: true,
          database: false,
          compliance: false,
          auditLogs: false
        },
        formats: ['json'],
        outputDirectory: './temp',
        timeRange: { hours: 1 }
      };

      const report = await securityReportGenerator.generateReport(config);

      console.log(`\n🛡️ Security Overview - ${options.environment.toUpperCase()}:`);
      console.log(`Generated: ${report.generated.toLocaleString()}`);
      console.log(`Overall Score: ${report.executiveSummary.overallSecurityScore}/100`);
      console.log(`Risk Level: ${report.executiveSummary.riskLevel.toUpperCase()}`);
      
      console.log(`\n📊 Finding Summary:`);
      console.log(`Critical: ${report.executiveSummary.criticalFindings}`);
      console.log(`High: ${report.executiveSummary.highPriorityFindings}`);
      console.log(`Medium: ${report.executiveSummary.mediumPriorityFindings}`);
      console.log(`Low: ${report.executiveSummary.lowPriorityFindings}`);

      console.log(`\n🔍 Component Status:`);
      for (const [component, metrics] of Object.entries(report.componentSummary)) {
        const statusIcon = metrics.score >= 90 ? '✅' : metrics.score >= 70 ? '⚠️' : '❌';
        console.log(`${statusIcon} ${component}: ${metrics.score}/100 (${metrics.findings} findings)`);
      }

      if (report.executiveSummary.topRecommendations.length > 0) {
        console.log(`\n💡 Top Recommendations:`);
        for (const rec of report.executiveSummary.topRecommendations.slice(0, 3)) {
          console.log(`  - ${rec}`);
        }
      }

      process.exit(report.executiveSummary.criticalFindings > 0 ? 1 : 0);

    } catch (error) {
      console.error('❌ Overview generation failed:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Component-specific reports
program
  .command('compliance')
  .description('Generate compliance-focused report')
  .option('-e, --environment <env>', 'Target environment', 'production')
  .option('-s, --standards <standards>', 'Compliance standards', 'all')
  .option('-f, --format <format>', 'Output format', 'html')
  .option('-o, --output <file>', 'Output file path')
  .action(async (options) => {
    try {
      console.log(`🏛️ Generating compliance report for ${options.environment}`);

      const standards = options.standards === 'all' ? 
        ['nist', 'owasp', 'pci_dss', 'hipaa', 'sox', 'gdpr', 'iso27001', 'fips140_2'] :
        options.standards.split(',');

      const config: SecurityReportConfig = {
        environment: options.environment,
        includeComponents: {
          comprehensive: false,
          encryption: true,
          environment: true,
          database: true,
          compliance: true,
          auditLogs: true
        },
        formats: [options.format as 'json' | 'html' | 'csv'],
        outputDirectory: './compliance-reports',
        compliance: { standards }
      };

      const report = await securityReportGenerator.generateReport(config);
      const output = securityReportGenerator.exportReport(report, options.format as any);

      if (options.output) {
        writeFileSync(options.output, output);
        console.log(`📄 Compliance report saved: ${options.output}`);
      } else {
        console.log(output);
      }

      console.log(`\n🏛️ Compliance Summary:`);
      console.log(`Standards Assessed: ${standards.join(', ')}`);
      console.log(`Compliance Score: ${report.complianceMatrix.overallCompliance}/100`);
      console.log(`Compliant Standards: ${report.complianceMatrix.compliantStandards}/${report.complianceMatrix.totalStandards}`);

      process.exit(report.complianceMatrix.criticalNonCompliance > 0 ? 1 : 0);

    } catch (error) {
      console.error('❌ Compliance report failed:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Audit logs report
program
  .command('audit-logs')
  .description('Generate audit logs analysis report')
  .option('-e, --environment <env>', 'Target environment', 'production')
  .option('-t, --time-range <hours>', 'Time range in hours', '168') // 1 week
  .option('-f, --format <format>', 'Output format', 'html')
  .action(async (options) => {
    try {
      console.log(`📋 Generating audit logs report for ${options.environment}`);
      console.log(`⏰ Analyzing last ${options.timeRange} hours`);

      const config: SecurityReportConfig = {
        environment: options.environment,
        includeComponents: {
          comprehensive: false,
          encryption: false,
          environment: false,
          database: false,
          compliance: true,
          auditLogs: true
        },
        formats: [options.format as 'json' | 'html' | 'csv'],
        outputDirectory: './audit-reports',
        timeRange: {
          hours: parseInt(options.timeRange, 10)
        },
        compliance: {
          standards: ['sox', 'hipaa', 'pci_dss'] // Audit-focused standards
        }
      };

      const report = await securityReportGenerator.generateReport(config);
      const output = securityReportGenerator.exportReport(report, options.format as any);

      const filename = `audit-logs-report-${options.environment}-${new Date().toISOString().split('T')[0]}.${options.format}`;
      writeFileSync(filename, output);
      console.log(`📄 Audit logs report saved: ${filename}`);

      console.log(`\n📊 Audit Log Analysis:`);
      const auditMetrics = report.componentSummary.auditLogs;
      if (auditMetrics) {
        console.log(`Completeness: ${auditMetrics.score}/100`);
        console.log(`Issues Found: ${auditMetrics.findings}`);
        console.log(`Time Range: ${options.timeRange} hours`);
      }

      process.exit(report.executiveSummary.criticalFindings > 0 ? 1 : 0);

    } catch (error) {
      console.error('❌ Audit logs report failed:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Risk assessment report
program
  .command('risk-assessment')
  .description('Generate risk assessment report')
  .option('-e, --environment <env>', 'Target environment', 'production')
  .option('-f, --format <format>', 'Output format', 'html')
  .action(async (options) => {
    try {
      console.log(`🎯 Generating risk assessment for ${options.environment}`);

      const config: SecurityReportConfig = {
        environment: options.environment,
        includeComponents: {
          comprehensive: true,
          encryption: true,
          environment: true,
          database: true,
          compliance: true,
          auditLogs: true
        },
        formats: [options.format as 'json' | 'html' | 'csv'],
        outputDirectory: './risk-reports',
        compliance: {
          standards: ['all']
        }
      };

      const report = await securityReportGenerator.generateReport(config);
      const output = securityReportGenerator.exportReport(report, options.format as any);

      const filename = `risk-assessment-${options.environment}-${new Date().toISOString().split('T')[0]}.${options.format}`;
      writeFileSync(filename, output);
      console.log(`📄 Risk assessment saved: ${filename}`);

      console.log(`\n🎯 Risk Assessment Summary:`);
      console.log(`Overall Risk: ${report.executiveSummary.riskLevel.toUpperCase()}`);
      console.log(`Business Impact: ${report.riskAssessment.businessImpact}`);
      console.log(`Remediation Cost: ${report.riskAssessment.estimatedRemediationCost}`);
      console.log(`Timeline: ${report.riskAssessment.remediationTimeline}`);

      if (report.riskAssessment.topRisks.length > 0) {
        console.log(`\n🚨 Top Risks:`);
        for (const risk of report.riskAssessment.topRisks.slice(0, 3)) {
          console.log(`  - ${risk.title} (${risk.severity.toUpperCase()})`);
          console.log(`    Impact: ${risk.impact}`);
        }
      }

      const riskLevel = report.executiveSummary.riskLevel;
      const exitCode = riskLevel === 'critical' ? 2 : riskLevel === 'high' ? 1 : 0;
      process.exit(exitCode);

    } catch (error) {
      console.error('❌ Risk assessment failed:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// History and comparison
program
  .command('history')
  .description('Show report generation history')
  .action(() => {
    try {
      const history = securityReportGenerator.getReportHistory();
      
      if (history.length === 0) {
        console.log('📝 No previous reports found');
        return;
      }

      console.log(`\n📚 Report History (${history.length} reports):\n`);
      
      for (const report of history.slice(-10)) { // Show last 10
        console.log(`📄 ${report.id}`);
        console.log(`   Generated: ${report.generated.toLocaleString()}`);
        console.log(`   Environment: ${report.environment}`);
        console.log(`   Score: ${report.executiveSummary.overallSecurityScore}/100`);
        console.log(`   Risk: ${report.executiveSummary.riskLevel.toUpperCase()}`);
        console.log(`   Critical Findings: ${report.executiveSummary.criticalFindings}`);
        console.log('');
      }

      if (history.length > 10) {
        console.log(`... and ${history.length - 10} more reports`);
      }

    } catch (error) {
      console.error('❌ Failed to retrieve history:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Help command
program
  .command('help-extended')
  .description('Show extended help and examples')
  .action(() => {
    console.log(`
🛡️ Security Report Generator CLI - Extended Help

OVERVIEW:
This tool generates comprehensive security reports by consolidating results from
multiple security validation frameworks including compliance, encryption,
environment security, database security, and audit log verification.

COMMANDS:
  generate              Generate comprehensive security report
  overview              Quick security overview
  compliance            Compliance-focused report
  audit-logs            Audit logs analysis report
  risk-assessment       Risk assessment report
  history               Show report generation history

EXAMPLES:
  # Comprehensive production security report
  security-report generate -e production -f json,html -o ./reports

  # Quick development overview
  security-report overview -e development

  # SOX compliance report for audit
  security-report compliance -e production -s sox,hipaa -f html

  # Weekly audit logs analysis
  security-report audit-logs -e production -t 168 -f html

  # Risk assessment for executive review
  security-report risk-assessment -e production -f html

  # Generate all formats with specific components
  security-report generate -e production -f json,html,csv -c comprehensive,compliance,auditLogs

COMPONENT OPTIONS:
  comprehensive         Core security validation (OWASP, authentication, etc.)
  encryption           Encryption framework validation
  environment          Environment security and configuration
  database             Database security validation
  compliance           Regulatory compliance (NIST, SOX, HIPAA, PCI-DSS, etc.)
  auditLogs            Audit log completeness and integrity

OUTPUT FORMATS:
  json                 JSON format (machine readable)
  html                 HTML report with charts and visualizations
  csv                  CSV format for spreadsheet analysis
  pdf                  PDF format (requires HTML conversion)

COMPLIANCE STANDARDS:
  nist                 NIST Cybersecurity Framework
  owasp                OWASP Top 10 2021
  pci_dss              PCI-DSS v4.0
  hipaa                HIPAA
  sox                  Sarbanes-Oxley Act
  gdpr                 GDPR
  iso27001             ISO 27001:2022
  fips140_2            FIPS 140-2

EXIT CODES:
  0                    Success, no critical issues
  1                    Warning, critical issues found
  2                    Critical risk level detected

ENVIRONMENT VARIABLES:
  SECURITY_REPORT_DIR  Default output directory
  SECURITY_LOG_LEVEL   Logging level (debug, info, warn, error)
  SECURITY_DB_URL      Database connection for audit logs
    `);
  });

// Parse command line arguments
program.parse();

export { program };