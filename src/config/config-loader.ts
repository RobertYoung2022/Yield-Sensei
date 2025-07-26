/**
 * Configuration Loader
 * 
 * Loads and validates environment-specific configurations with comprehensive
 * error reporting and security validation.
 */

import { config as baseConfig } from './environment';
import { validateEnvironment, generateEnvironmentReport } from './environment-validator';
import { developmentConfig, developmentSecurityChecklist } from './environments/development';
import { productionConfig, productionSecurityChecklist, validateProductionEnvironment } from './environments/production';
// Removed unused imports: validateEnvironmentOrThrow, developmentValidationRules, productionValidationRules
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

export interface LoadedConfig {
  config: any;
  validation: {
    isValid: boolean;
    errors: string[];
    warnings: string[];
    environment: string;
  };
  security: {
    checklist: string[];
    passed: boolean;
  };
}

/**
 * Loads configuration for the current environment
 */
export function loadConfiguration(): LoadedConfig {
  const environment = process.env['NODE_ENV'] || 'development';
  
  // Validate environment variables
  const validation = validateEnvironment();
  
  // Load environment-specific configuration
  let envConfig: any = {};
  let securityChecklist: string[] = [];
  
  switch (environment) {
    case 'development':
      envConfig = developmentConfig;
      securityChecklist = developmentSecurityChecklist;
      break;
    case 'production':
      envConfig = productionConfig;
      securityChecklist = productionSecurityChecklist;
      
      // Additional production validation
      const productionErrors = validateProductionEnvironment();
      validation.errors.push(...productionErrors);
      validation.isValid = validation.errors.length === 0;
      break;
    case 'staging':
      // Staging uses production config with some overrides
      envConfig = { ...productionConfig, nodeEnv: 'staging' };
      securityChecklist = productionSecurityChecklist;
      break;
    case 'test':
      // Test environment configuration
      envConfig = {
        nodeEnv: 'test',
        port: 3001,
        logLevel: 'error',
        debugMode: false,
        mockExternalApis: true,
        performanceMonitoringEnabled: false
      };
      securityChecklist = developmentSecurityChecklist;
      break;
    default:
      throw new Error(`Unknown environment: ${environment}`);
  }
  
  // Merge configurations
  const mergedConfig = { ...baseConfig, ...envConfig };
  
  // Generate security checklist status
  const securityPassed = validation.isValid && validation.errors.length === 0;
  
  return {
    config: mergedConfig,
    validation: {
      isValid: validation.isValid,
      errors: validation.errors,
      warnings: validation.warnings,
      environment
    },
    security: {
      checklist: securityChecklist,
      passed: securityPassed
    }
  };
}

/**
 * Loads configuration and throws error if invalid
 */
export function loadConfigurationOrThrow(): any {
  const loaded = loadConfiguration();
  
  if (!loaded.validation.isValid) {
    console.error('❌ Configuration validation failed:');
    loaded.validation.errors.forEach(error => console.error(`  - ${error}`));
    
    if (loaded.validation.warnings.length > 0) {
      console.warn('⚠️ Configuration warnings:');
      loaded.validation.warnings.forEach(warning => console.warn(`  - ${warning}`));
    }
    
    throw new Error(`Configuration validation failed with ${loaded.validation.errors.length} errors`);
  }
  
  if (loaded.validation.warnings.length > 0) {
    console.warn('⚠️ Configuration warnings:');
    loaded.validation.warnings.forEach(warning => console.warn(`  - ${warning}`));
  }
  
  console.log(`✅ Configuration loaded successfully for ${loaded.validation.environment} environment`);
  
  return loaded.config;
}

/**
 * Generates and saves configuration report
 */
export function generateConfigurationReport(outputPath?: string): string {
  const report = generateEnvironmentReport();
  const loaded = loadConfiguration();
  
  let fullReport = report;
  fullReport += `\n## 🔒 Security Checklist\n\n`;
  
  loaded.security.checklist.forEach(item => {
    fullReport += `${item}\n`;
  });
  
  fullReport += `\n## 📊 Configuration Summary\n\n`;
  fullReport += `- **Environment:** ${loaded.validation.environment}\n`;
  fullReport += `- **Validation Status:** ${loaded.validation.isValid ? '✅ Valid' : '❌ Invalid'}\n`;
  fullReport += `- **Security Status:** ${loaded.security.passed ? '✅ Passed' : '❌ Failed'}\n`;
  fullReport += `- **Errors:** ${loaded.validation.errors.length}\n`;
  fullReport += `- **Warnings:** ${loaded.validation.warnings.length}\n`;
  
  if (outputPath) {
    try {
      // Ensure directory exists
      const dir = join(outputPath, '..');
      mkdirSync(dir, { recursive: true });
      
      // Write report to file
      writeFileSync(outputPath, fullReport);
      console.log(`📄 Configuration report saved to: ${outputPath}`);
    } catch (error) {
      console.error('Failed to save configuration report:', error);
    }
  }
  
  return fullReport;
}

/**
 * Validates configuration for a specific environment
 */
export function validateConfigurationForEnvironment(environment: string): LoadedConfig {
  const originalEnv = process.env['NODE_ENV'];
  process.env['NODE_ENV'] = environment;
  
  try {
    return loadConfiguration();
  } finally {
    if (originalEnv) {
      process.env['NODE_ENV'] = originalEnv;
    } else {
      delete process.env['NODE_ENV'];
    }
  }
}

/**
 * CLI tool for configuration validation
 */
export function runConfigurationValidation(): void {
  console.log('🔍 YieldSensei Configuration Validator\n');
  
  const loaded = loadConfiguration();
  
  // Display validation results
  if (loaded.validation.isValid) {
    console.log('✅ Configuration is valid!');
  } else {
    console.log('❌ Configuration has errors:');
    loaded.validation.errors.forEach(error => console.error(`  - ${error}`));
  }
  
  if (loaded.validation.warnings.length > 0) {
    console.log('\n⚠️ Warnings:');
    loaded.validation.warnings.forEach(warning => console.warn(`  - ${warning}`));
  }
  
  // Display security checklist
  console.log('\n🔒 Security Checklist:');
  loaded.security.checklist.forEach(item => console.log(`  ${item}`));
  
  // Generate report
  const reportPath = join(process.cwd(), 'config-report.md');
  generateConfigurationReport(reportPath);
  
  // Exit with appropriate code
  process.exit(loaded.validation.isValid ? 0 : 1);
}

// Export for CLI usage
if (require.main === module) {
  runConfigurationValidation();
} 