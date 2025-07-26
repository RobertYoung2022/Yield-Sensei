/**
 * Configuration Validation and Drift Detection System
 * 
 * Provides comprehensive configuration validation, drift detection,
 * and monitoring capabilities for the YieldSensei platform.
 */

import { ConfigValidator, ValidationResult, ConfigSnapshot } from './config-validator';
import { DriftDetector, DriftDetectionConfig, DriftReport } from './drift-detector';
import { ConfigMonitor, MonitorConfig } from './config-monitor';
import { loadConfiguration } from '../config-loader';
import { join } from 'path';

export * from './config-validator';
export * from './drift-detector';
export * from './config-monitor';

/**
 * Default monitor configuration
 */
export function createDefaultMonitorConfig(): MonitorConfig {
  const environment = process.env.NODE_ENV || 'development';
  const baseDir = process.cwd();

  return {
    validationInterval: environment === 'production' ? 300000 : 60000, // 5 min prod, 1 min dev
    driftCheckInterval: environment === 'production' ? 600000 : 120000, // 10 min prod, 2 min dev
    baselinePath: join(baseDir, '.config', 'baseline.json'),
    reportPath: join(baseDir, '.config', 'reports'),
    alerting: {
      enabled: environment === 'production',
      channels: [
        {
          type: 'console',
          config: {},
          severity: ['high', 'critical']
        },
        {
          type: 'file',
          config: { path: join(baseDir, '.config', 'alerts') },
          severity: ['medium', 'high', 'critical']
        }
      ],
      thresholds: {
        errorCount: 3,
        warningCount: 10,
        driftSeverity: 'medium'
      }
    },
    persistence: {
      enabled: true,
      retentionDays: environment === 'production' ? 90 : 7,
      compressOldReports: environment === 'production'
    },
    schedules: [
      {
        name: 'daily-report',
        cron: '0 0 * * *', // Daily at midnight
        action: 'report'
      },
      {
        name: 'hourly-backup',
        cron: '0 * * * *', // Every hour
        action: 'backup',
        config: { path: join(baseDir, '.config', 'backups') }
      }
    ]
  };
}

/**
 * Create and configure a configuration monitor
 */
export function createConfigMonitor(config?: Partial<MonitorConfig>): ConfigMonitor {
  const defaultConfig = createDefaultMonitorConfig();
  const finalConfig = { ...defaultConfig, ...config };
  
  return new ConfigMonitor(finalConfig);
}

/**
 * Quick validation function
 */
export async function validateCurrentConfig(): Promise<ValidationResult> {
  const validator = new ConfigValidator();
  const loaded = loadConfiguration();
  
  return validator.validate(loaded.config, loaded.validation.environment);
}

/**
 * Quick drift check function
 */
export async function checkConfigDrift(baselinePath?: string): Promise<DriftReport | null> {
  const validator = new ConfigValidator();
  const loaded = loadConfiguration();
  
  const driftConfig: DriftDetectionConfig = {
    baselinePath: baselinePath || join(process.cwd(), '.config', 'baseline.json'),
    checkInterval: 60000,
    alertThreshold: 5,
    ignorePatterns: [],
    notificationChannels: [{
      type: 'console',
      config: {}
    }],
    autoCorrect: false,
    environment: loaded.validation.environment
  };
  
  const detector = new DriftDetector(driftConfig, validator);
  return detector.checkForDrift(loaded.config);
}

/**
 * Create configuration baseline
 */
export function createConfigBaseline(outputPath?: string): void {
  const validator = new ConfigValidator();
  const loaded = loadConfiguration();
  
  const baselinePath = outputPath || join(process.cwd(), '.config', 'baseline.json');
  
  const driftConfig: DriftDetectionConfig = {
    baselinePath,
    checkInterval: 60000,
    alertThreshold: 5,
    ignorePatterns: [],
    notificationChannels: [],
    autoCorrect: false,
    environment: loaded.validation.environment
  };
  
  const detector = new DriftDetector(driftConfig, validator);
  detector.saveBaseline(loaded.config);
}

/**
 * CLI Integration
 */
export function runValidationCLI(): void {
  console.log('🔍 YieldSensei Configuration Validation\n');
  
  const loaded = loadConfiguration();
  const validator = new ConfigValidator();
  const result = validator.validate(loaded.config, loaded.validation.environment);
  
  if (result.valid) {
    console.log('✅ Configuration is valid!');
    console.log(`   Checks passed: ${result.statistics.passedChecks}/${result.statistics.totalChecks}`);
  } else {
    console.log('❌ Configuration validation failed!');
    console.log(`   Errors: ${result.errors.length}`);
    console.log(`   Warnings: ${result.warnings.length}`);
    
    console.log('\nErrors:');
    result.errors.forEach(error => {
      console.log(`  - [${error.path}] ${error.message}`);
    });
    
    if (result.warnings.length > 0) {
      console.log('\nWarnings:');
      result.warnings.forEach(warning => {
        console.log(`  - [${warning.path}] ${warning.message}`);
        if (warning.suggestion) {
          console.log(`    💡 ${warning.suggestion}`);
        }
      });
    }
  }
  
  // Generate report
  const report = validator.generateReport(result);
  const reportPath = join(process.cwd(), '.config', 'validation-report.md');
  
  const { writeFileSync, mkdirSync } = require('fs');
  mkdirSync(join(process.cwd(), '.config'), { recursive: true });
  writeFileSync(reportPath, report);
  
  console.log(`\n📄 Full report saved to: ${reportPath}`);
  
  process.exit(result.valid ? 0 : 1);
}

/**
 * Drift Detection CLI
 */
export function runDriftCheckCLI(): void {
  console.log('🔍 YieldSensei Configuration Drift Detection\n');
  
  checkConfigDrift()
    .then(report => {
      if (!report) {
        console.log('✅ No configuration drift detected!');
      } else {
        console.log('🚨 Configuration drift detected!');
        console.log(`   Changes: ${report.changes.length}`);
        console.log(`   Risk: ${report.riskAssessment.overallRisk.toUpperCase()}`);
        
        console.log('\nChanges:');
        report.changes.forEach(change => {
          const emoji = change.risk === 'high' ? '❌' : change.risk === 'medium' ? '⚠️' : 'ℹ️';
          console.log(`  ${emoji} [${change.risk.toUpperCase()}] ${change.description}`);
        });
        
        if (report.recommendations.length > 0) {
          console.log('\nRecommendations:');
          report.recommendations.forEach(rec => console.log(`  ${rec}`));
        }
      }
    })
    .catch(error => {
      console.error('❌ Drift check failed:', error);
      process.exit(1);
    });
}

/**
 * Monitoring CLI
 */
export async function runMonitorCLI(): Promise<void> {
  console.log('🚀 YieldSensei Configuration Monitor\n');
  
  const monitor = createConfigMonitor();
  
  // Handle shutdown gracefully
  process.on('SIGINT', () => {
    console.log('\n\nShutting down monitor...');
    monitor.stop();
    process.exit(0);
  });
  
  try {
    await monitor.start();
    
    // Display status every 30 seconds
    setInterval(() => {
      const status = monitor.getStatus();
      console.log(`\n📊 Monitor Status (${new Date().toLocaleTimeString()})`);
      console.log(`   Validations: ${status.statistics.totalValidations} (${status.statistics.failedValidations} failed)`);
      console.log(`   Drift Checks: ${status.statistics.totalDriftChecks} (${status.statistics.driftDetections} detections)`);
      console.log(`   Alerts: ${status.statistics.alerts}`);
    }, 30000);
    
  } catch (error) {
    console.error('❌ Failed to start monitor:', error);
    process.exit(1);
  }
}

// CLI entry points
if (require.main === module) {
  const command = process.argv[2];
  
  switch (command) {
    case 'validate':
      runValidationCLI();
      break;
    case 'drift':
      runDriftCheckCLI();
      break;
    case 'monitor':
      runMonitorCLI();
      break;
    case 'baseline':
      createConfigBaseline();
      console.log('✅ Configuration baseline created');
      break;
    default:
      console.log('Usage: config-validation [validate|drift|monitor|baseline]');
      process.exit(1);
  }
}