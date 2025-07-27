#!/usr/bin/env node
/**
 * Configuration Validation CLI
 * 
 * Command-line interface for all configuration validation and monitoring tools:
 * - Comprehensive health checks
 * - Configuration drift detection
 * - Security validation
 * - Secret health monitoring
 * - Alert system testing
 * - Audit logging verification
 */

import { program } from 'commander';
import { comprehensiveHealthChecker } from './comprehensive-health-checker';
import { enhancedDriftDetector } from './enhanced-drift-detector';
import { securityConfigValidator } from './security-config-validator';
import { secretHealthChecker } from './secret-health-checker';
import { securityAlertSystem } from './security-alert-system';
import { configurationAuditLogger } from './audit-logger';

// Define CLI program
program
  .name('validation-cli')
  .description('Configuration Validation and Monitoring CLI')
  .version('1.0.0');

// Health Check Commands
program
  .command('health')
  .description('Perform comprehensive health check')
  .option('-e, --environment <env>', 'Target environment', 'development')
  .option('-c, --component <comp>', 'Check specific component only')
  .option('-f, --format <format>', 'Output format (json|table|report)', 'table')
  .option('-w, --watch', 'Start continuous monitoring')
  .option('-i, --interval <seconds>', 'Monitoring interval in seconds', '300')
  .action(async (options) => {
    try {
      if (options.watch) {
        console.log(`🔄 Starting health monitoring for ${options.environment} (interval: ${options.interval}s)`);
        await comprehensiveHealthChecker.startMonitoring(options.environment, {
          environment: options.environment,
          check_interval: parseInt(options.interval),
          timeout: 30,
          enabled_components: ['configuration_validation', 'secret_management', 'drift_detection', 'security_alerts', 'audit_logging'],
          alert_thresholds: {
            critical_score: 30,
            degraded_score: 70,
            response_time_ms: 10000,
            error_rate_percentage: 10
          },
          notification_channels: ['console'],
          auto_remediation: {
            enabled: false,
            safe_mode: true,
            max_attempts: 3
          }
        });

        // Keep process running
        process.on('SIGINT', () => {
          comprehensiveHealthChecker.stopMonitoring(options.environment);
          process.exit(0);
        });

        // Prevent exit
        setInterval(() => {}, 1000);
      } else if (options.component) {
        const result = await comprehensiveHealthChecker.getComponentHealth(options.component, options.environment);
        outputResult(result, options.format);
      } else {
        const report = await comprehensiveHealthChecker.performHealthCheck(options.environment);
        outputResult(report, options.format);
      }
    } catch (error) {
      console.error('❌ Health check failed:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Health Report Command
program
  .command('health-report')
  .description('Generate health report')
  .option('-e, --environment <env>', 'Target environment')
  .option('-p, --period <period>', 'Report period (day|week|month)', 'day')
  .option('-o, --output <file>', 'Output file path')
  .action(async (options) => {
    try {
      const report = comprehensiveHealthChecker.generateHealthReport(options.environment, options.period);
      
      if (options.output) {
        require('fs').writeFileSync(options.output, report);
        console.log(`📄 Health report saved to: ${options.output}`);
      } else {
        console.log(report);
      }
    } catch (error) {
      console.error('❌ Report generation failed:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Drift Detection Commands
program
  .command('drift')
  .description('Configuration drift detection')
  .option('-e, --environment <env>', 'Target environment', 'development')
  .option('-c, --create-baseline', 'Create new baseline')
  .option('-a, --author <author>', 'Baseline author', 'validation-cli')
  .option('-d, --description <desc>', 'Baseline description')
  .option('-m, --monitor', 'Start drift monitoring')
  .option('-r, --report', 'Generate drift report')
  .action(async (options) => {
    try {
      if (options.createBaseline) {
        const baseline = await enhancedDriftDetector.createBaseline(options.environment, {
          author: options.author,
          description: options.description || `Baseline created by CLI for ${options.environment}`
        });
        console.log(`📋 Baseline created: ${baseline.id}`);
        outputResult(baseline, 'json');
      } else if (options.monitor) {
        console.log(`👁️ Starting drift monitoring for ${options.environment}`);
        await enhancedDriftDetector.startMonitoring(options.environment, {
          environment: options.environment,
          monitoringInterval: 60000, // 1 minute
          alertThresholds: {
            driftScore: 50,
            criticalChanges: 1,
            unauthorizedChanges: 1
          },
          watchedPaths: ['.env', 'config/', 'package.json'],
          excludedPaths: ['node_modules', '.git', 'dist'],
          complianceStandards: ['SOC2', 'PCI-DSS'],
          notificationChannels: [{
            type: 'console',
            config: {},
            severity: ['medium', 'high', 'critical']
          }],
          autoRemediation: {
            enabled: false,
            maxRiskLevel: 'low',
            requireApproval: true
          }
        });

        // Keep process running
        process.on('SIGINT', () => {
          enhancedDriftDetector.stopMonitoring(options.environment);
          process.exit(0);
        });

        setInterval(() => {}, 1000);
      } else if (options.report) {
        const report = enhancedDriftDetector.generateComprehensiveReport([options.environment]);
        console.log(report);
      } else {
        const result = await enhancedDriftDetector.detectDrift(options.environment);
        outputResult(result, 'json');
      }
    } catch (error) {
      console.error('❌ Drift detection failed:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Security Validation Commands
program
  .command('security')
  .description('Security configuration validation')
  .option('-e, --environment <env>', 'Target environment', 'development')
  .option('-r, --report', 'Generate security report')
  .option('-b, --baseline', 'Create security baseline')
  .option('-c, --compare <baselineId>', 'Compare with baseline')
  .action(async (options) => {
    try {
      if (options.baseline) {
        const baseline = await securityConfigValidator.createSecurityBaseline(options.environment);
        console.log(`🔒 Security baseline created: ${baseline.version}`);
        outputResult(baseline, 'json');
      } else if (options.compare) {
        const comparison = await securityConfigValidator.compareWithBaseline(options.environment);
        outputResult(comparison, 'json');
      } else if (options.report) {
        const report = securityConfigValidator.generateSecurityReport([options.environment]);
        console.log(report);
      } else {
        const result = await securityConfigValidator.validateSecurityConfiguration(options.environment);
        outputResult(result, 'json');
      }
    } catch (error) {
      console.error('❌ Security validation failed:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Secret Management Commands
program
  .command('secrets')
  .description('Secret management and health checks')
  .option('-h, --health', 'Perform secret health check')
  .option('-r, --report', 'Generate secret health report')
  .option('-a, --audit', 'Audit secret access patterns')
  .action(async (options) => {
    try {
      if (options.health) {
        const healthReport = await secretHealthChecker.performHealthCheck();
        outputResult(healthReport, 'json');
      } else if (options.report) {
        const report = secretHealthChecker.generateHealthReport();
        console.log(report);
      } else if (options.audit) {
        console.log('🔍 Secret access audit functionality would be implemented here');
      } else {
        const healthReport = await secretHealthChecker.performHealthCheck();
        outputResult(healthReport, 'table');
      }
    } catch (error) {
      console.error('❌ Secret management check failed:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Alert System Commands
program
  .command('alerts')
  .description('Security alert system management')
  .option('-l, --list', 'List current alerts')
  .option('-d, --dashboard', 'Show alert dashboard')
  .option('-e, --export <format>', 'Export alerts (json|csv|siem)')
  .option('-t, --test', 'Test alert system')
  .option('-s, --severity <level>', 'Filter by severity')
  .option('-c, --category <cat>', 'Filter by category')
  .action(async (options) => {
    try {
      if (options.test) {
        const alertId = await securityAlertSystem.createAlert({
          severity: 'medium',
          category: 'configuration_drift',
          title: 'Test Alert from CLI',
          description: 'This is a test alert created by the validation CLI',
          source: 'validation_cli',
          environment: 'development',
          affected_resources: ['validation_system'],
          indicators: [{
            type: 'anomaly',
            description: 'CLI test alert',
            confidence: 100,
            evidence: [{
              type: 'log',
              description: 'CLI test execution',
              data: { test: true },
              timestamp: new Date(),
              source: 'validation_cli'
            }]
          }],
          metadata: {
            detection_method: 'cli_test',
            risk_score: 25,
            business_impact: 'low',
            compliance_implications: [],
            attack_vectors: [],
            affected_services: ['testing']
          },
          response_actions: []
        });
        console.log(`🚨 Test alert created: ${alertId}`);
      } else if (options.dashboard) {
        const dashboard = securityAlertSystem.generateSecurityDashboard();
        outputResult(dashboard, 'json');
      } else if (options.export) {
        const filter: any = {};
        if (options.severity) filter.severity = [options.severity];
        if (options.category) filter.category = [options.category];
        
        const exported = securityAlertSystem.exportAlerts(filter, options.export as any);
        console.log(exported);
      } else {
        const filter: any = {};
        if (options.severity) filter.severity = [options.severity];
        if (options.category) filter.category = [options.category];
        
        const alerts = securityAlertSystem.queryAlerts(filter);
        outputResult(alerts.slice(0, 10), 'table');
      }
    } catch (error) {
      console.error('❌ Alert system operation failed:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Audit Commands
program
  .command('audit')
  .description('Audit logging and compliance')
  .option('-l, --log <message>', 'Create test audit log')
  .option('-s, --search <query>', 'Search audit logs')
  .option('-r, --report', 'Generate audit report')
  .option('-t, --type <type>', 'Log entry type', 'system')
  .action(async (options) => {
    try {
      if (options.log) {
        const logId = await configurationAuditLogger.logSystemEvent(
          'validation_cli',
          'test_log',
          { message: options.log, type: options.type },
          'info',
          { source: 'cli' }
        );
        console.log(`📝 Audit log created: ${logId}`);
      } else if (options.search) {
        console.log('🔍 Audit log search functionality would be implemented here');
        console.log(`Query: ${options.search}`);
      } else if (options.report) {
        console.log('📊 Audit report generation would be implemented here');
      } else {
        console.log('📝 Use --log, --search, or --report options');
      }
    } catch (error) {
      console.error('❌ Audit operation failed:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Comprehensive Command
program
  .command('validate-all')
  .description('Run all validation checks')
  .option('-e, --environment <env>', 'Target environment', 'development')
  .option('-f, --format <format>', 'Output format (json|table|report)', 'report')
  .option('-o, --output <file>', 'Output file path')
  .action(async (options) => {
    try {
      console.log('🔍 Running comprehensive validation...\n');
      
      // Run health check
      const healthReport = await comprehensiveHealthChecker.performHealthCheck(options.environment);
      
      // Generate summary report
      let report = `# Comprehensive Validation Report\n\n`;
      report += `**Environment:** ${options.environment}\n`;
      report += `**Timestamp:** ${new Date().toISOString()}\n`;
      report += `**Overall Status:** ${healthReport.overall_status.toUpperCase()}\n`;
      report += `**Overall Score:** ${healthReport.overall_score}/100\n\n`;
      
      report += `## Summary\n`;
      report += `- Total Components: ${healthReport.components.length}\n`;
      report += `- Healthy Components: ${healthReport.components.filter(c => c.status === 'healthy').length}\n`;
      report += `- Degraded Components: ${healthReport.components.filter(c => c.status === 'degraded').length}\n`;
      report += `- Critical Components: ${healthReport.components.filter(c => c.status === 'critical').length}\n\n`;
      
      if (healthReport.critical_issues.length > 0) {
        report += `## Critical Issues\n`;
        for (const issue of healthReport.critical_issues) {
          report += `- ${issue}\n`;
        }
        report += `\n`;
      }
      
      if (healthReport.warnings.length > 0) {
        report += `## Warnings\n`;
        for (const warning of healthReport.warnings) {
          report += `- ${warning}\n`;
        }
        report += `\n`;
      }
      
      if (healthReport.recommendations.length > 0) {
        report += `## Recommendations\n`;
        for (const recommendation of healthReport.recommendations) {
          report += `- ${recommendation}\n`;
        }
        report += `\n`;
      }
      
      report += `## Component Details\n\n`;
      for (const component of healthReport.components) {
        report += `### ${component.component.replace(/_/g, ' ').toUpperCase()}\n`;
        report += `- Status: ${component.status.toUpperCase()}\n`;
        report += `- Score: ${component.score}/100\n`;
        report += `- Response Time: ${component.metadata.response_time}ms\n`;
        report += `- Uptime: ${component.metadata.uptime_percentage}%\n`;
        
        if (component.checks.some(c => c.status !== 'pass')) {
          report += `- Issues:\n`;
          component.checks.filter(c => c.status !== 'pass').forEach(check => {
            report += `  - ${check.name}: ${check.message}\n`;
          });
        }
        report += `\n`;
      }
      
      if (options.output) {
        require('fs').writeFileSync(options.output, report);
        console.log(`📄 Validation report saved to: ${options.output}`);
      } else if (options.format === 'report') {
        console.log(report);
      } else {
        outputResult(healthReport, options.format);
      }
      
      // Exit with appropriate code
      process.exit(healthReport.overall_status === 'critical' ? 1 : 0);
      
    } catch (error) {
      console.error('❌ Comprehensive validation failed:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Utility function to format output
function outputResult(data: any, format: string): void {
  switch (format) {
    case 'json':
      console.log(JSON.stringify(data, null, 2));
      break;
    
    case 'table':
      if (Array.isArray(data)) {
        console.table(data);
      } else {
        console.table([data]);
      }
      break;
    
    case 'report':
      if (typeof data === 'object' && data.overall_status) {
        // Health report format
        console.log(`\n📊 Health Check Results`);
        console.log(`Overall Status: ${data.overall_status.toUpperCase()}`);
        console.log(`Overall Score: ${data.overall_score}/100`);
        console.log(`Environment: ${data.environment}`);
        console.log(`Components: ${data.components.length}`);
        
        if (data.critical_issues.length > 0) {
          console.log(`\n🚨 Critical Issues:`);
          data.critical_issues.forEach((issue: string) => console.log(`  - ${issue}`));
        }
        
        if (data.warnings.length > 0) {
          console.log(`\n⚠️ Warnings:`);
          data.warnings.forEach((warning: string) => console.log(`  - ${warning}`));
        }
        
        console.log(`\n📋 Component Status:`);
        data.components.forEach((comp: any) => {
          const statusIcon = comp.status === 'healthy' ? '✅' : 
                           comp.status === 'degraded' ? '⚠️' : '❌';
          console.log(`  ${statusIcon} ${comp.component}: ${comp.status} (${comp.score}/100)`);
        });
      } else {
        console.log(JSON.stringify(data, null, 2));
      }
      break;
    
    default:
      console.log(data);
  }
}

// Parse command line arguments
program.parse();

export { program };