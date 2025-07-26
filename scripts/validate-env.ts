#!/usr/bin/env ts-node

/**
 * Environment Validation CLI Script
 * 
 * Validates environment configuration and generates reports.
 * Usage: npm run validate-env [-- --environment=production]
 */

import { runConfigurationValidation, generateConfigurationReport, validateConfigurationForEnvironment } from '../src/config/config-loader';
import { writeFileSync } from 'fs';
import { join } from 'path';

// Parse command line arguments
const args = process.argv.slice(2);
const environment = args.find(arg => arg.startsWith('--environment='))?.split('=')[1];
const outputFile = args.find(arg => arg.startsWith('--output='))?.split('=')[1];

console.log('🔍 YieldSensei Environment Validator\n');

if (environment) {
  console.log(`Validating configuration for environment: ${environment}\n`);
  
  try {
    const result = validateConfigurationForEnvironment(environment);
    
    if (result.validation.isValid) {
      console.log('✅ Configuration is valid!');
    } else {
      console.log('❌ Configuration has errors:');
      result.validation.errors.forEach(error => console.error(`  - ${error}`));
    }
    
    if (result.validation.warnings.length > 0) {
      console.log('\n⚠️ Warnings:');
      result.validation.warnings.forEach(warning => console.warn(`  - ${warning}`));
    }
    
    // Generate report
    const reportPath = outputFile || join(process.cwd(), `config-report-${environment}.md`);
    const report = generateConfigurationReport(reportPath);
    
    console.log(`\n📄 Configuration report saved to: ${reportPath}`);
    
    // Exit with appropriate code
    process.exit(result.validation.isValid ? 0 : 1);
    
  } catch (error) {
    console.error('❌ Validation failed:', error);
    process.exit(1);
  }
} else {
  // Run default validation for current environment
  runConfigurationValidation();
} 