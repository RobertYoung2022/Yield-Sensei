#!/usr/bin/env node
/**
 * Environment Security Validation CLI
 * 
 * Command-line interface for environment variable and configuration security validation
 */

import { program } from 'commander';
import { writeFileSync } from 'fs';
import { environmentSecurityValidator } from './environment-security-validation';

// Define CLI program
program
  .name('environment-security')
  .description('Environment Variable and Configuration Security Validation CLI')
  .version('1.0.0');

// Main validation command
program
  .command('validate')
  .description('Run environment security validation tests')
  .option('-e, --environment <env>', 'Target environment', 'development')
  .option('-f, --format <format>', 'Output format (json|html|csv)', 'json')
  .option('-o, --output <file>', 'Output file path')
  .option('-v, --verbose', 'Verbose output')
  .action(async (options) => {
    try {
      if (options.verbose) {
        console.log(`🔒 Starting environment security validation for ${options.environment}`);
      }

      const report = await environmentSecurityValidator.runValidation(options.environment);
      const output = environmentSecurityValidator.exportReport(report, options.format);

      if (options.output) {
        writeFileSync(options.output, output);
        console.log(`📄 Environment security report saved to: ${options.output}`);
      } else {
        console.log(output);
      }

      // Exit with appropriate code
      const exitCode = report.summary.criticalIssues > 0 ? 1 : 0;
      process.exit(exitCode);

    } catch (error) {
      console.error('❌ Validation failed:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Quick validation command
program
  .command('quick')
  .description('Run quick environment security check (critical issues only)')
  .option('-e, --environment <env>', 'Target environment', 'development')
  .action(async (options) => {
    try {
      console.log(`⚡ Running quick environment security check for ${options.environment}`);
      
      const report = await environmentSecurityValidator.runValidation(options.environment);
      const criticalVulns = report.testResults.flatMap(r => r.vulnerabilities)
        .filter(v => v.severity === 'critical');

      console.log(`\n📊 Quick Security Check Results:`);
      console.log(`Environment: ${report.environment}`);
      console.log(`Security Score: ${report.summary.securityScore}/100`);
      console.log(`Configuration Health: ${report.summary.configurationHealth.toUpperCase()}`);
      console.log(`Critical Issues: ${report.summary.criticalIssues}`);

      if (criticalVulns.length > 0) {
        console.log(`\n🚨 Critical Issues Found:`);
        for (const vuln of criticalVulns.slice(0, 5)) {
          console.log(`  - ${vuln.description}`);
        }
        if (criticalVulns.length > 5) {
          console.log(`  ... and ${criticalVulns.length - 5} more`);
        }
        process.exit(1);
      } else {
        console.log(`\n✅ No critical environment security issues found`);
        if (report.summary.securityScore < 80) {
          console.log(`⚠️ Security score is below 80, consider reviewing recommendations`);
        }
        process.exit(0);
      }

    } catch (error) {
      console.error('❌ Quick validation failed:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// List required variables command
program
  .command('list-required')
  .description('List all required environment variables')
  .option('-e, --environment <env>', 'Filter by environment', 'all')
  .action((options) => {
    console.log(`\n📋 Required Environment Variables${options.environment !== 'all' ? ` for ${options.environment}` : ''}:\n`);
    
    // Access the required variables from the validator
    const requiredVars = environmentSecurityValidator['requiredVariables'];
    
    const categories = new Map<string, Array<{name: string, requirement: any}>>();
    
    for (const [name, requirement] of requiredVars) {
      if (options.environment !== 'all' && !requirement.environments.includes(options.environment)) {
        continue;
      }

      const category = requirement.security;
      if (!categories.has(category)) {
        categories.set(category, []);
      }
      categories.get(category)!.push({name, requirement});
    }

    const severityOrder = ['critical', 'high', 'medium', 'low'];
    for (const severity of severityOrder) {
      const vars = categories.get(severity);
      if (vars && vars.length > 0) {
        const icon = severity === 'critical' ? '🔴' : 
                    severity === 'high' ? '🟠' : 
                    severity === 'medium' ? '🟡' : '🟢';
        
        console.log(`${icon} ${severity.toUpperCase()} SECURITY:`);
        for (const {name, requirement} of vars) {
          const required = requirement.required ? '(Required)' : '(Optional)';
          const envs = `[${requirement.environments.join(', ')}]`;
          console.log(`  - ${name} ${required} ${envs}`);
          console.log(`    ${requirement.description}`);
          if (requirement.defaultValue) {
            console.log(`    Default: ${requirement.defaultValue}`);
          }
        }
        console.log();
      }
    }
  });

// Environment analysis command
program
  .command('analyze')
  .description('Analyze current environment configuration')
  .option('-e, --environment <env>', 'Target environment', 'development')
  .action(async (options) => {
    try {
      console.log(`🔍 Analyzing environment configuration for ${options.environment}`);
      
      const report = await environmentSecurityValidator.runValidation(options.environment);
      const analysis = report.environmentAnalysis;

      console.log(`\n📊 Environment Analysis:`);
      console.log(`Node Environment: ${report.environment}`);
      console.log(`Total Environment Variables: ${Object.keys(process.env).length}`);
      console.log(`Required Variables: ${analysis.requiredVariables.length}`);
      console.log(`Optional Variables: ${analysis.optionalVariables.length}`);
      console.log(`Security Variables: ${analysis.securityVariables.length}`);
      console.log(`Unknown Variables: ${analysis.unknownVariables.length}`);

      console.log(`\n🔒 Security Variable Status:`);
      for (const secVar of analysis.securityVariables) {
        const statusIcon = secVar.strength === 'strong' ? '✅' : 
                          secVar.strength === 'medium' ? '⚠️' : '❌';
        console.log(`  ${statusIcon} ${secVar.name} (${secVar.category}) - ${secVar.strength.toUpperCase()}`);
        if (secVar.issues.length > 0) {
          secVar.issues.forEach(issue => console.log(`    - ${issue}`));
        }
      }

      if (analysis.unknownVariables.length > 0) {
        console.log(`\n❓ Unknown Variables:`);
        analysis.unknownVariables.slice(0, 10).forEach(name => console.log(`  - ${name}`));
        if (analysis.unknownVariables.length > 10) {
          console.log(`  ... and ${analysis.unknownVariables.length - 10} more`);
        }
      }

      console.log(`\n📈 Overall Security Score: ${report.summary.securityScore}/100`);
      console.log(`Configuration Health: ${report.summary.configurationHealth.toUpperCase()}`);

    } catch (error) {
      console.error('❌ Analysis failed:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Check specific variable command
program
  .command('check-var <variable>')
  .description('Check a specific environment variable')
  .action(async (variable) => {
    try {
      console.log(`🔍 Checking environment variable: ${variable}`);
      
      const value = process.env[variable];
      const requiredVars = environmentSecurityValidator['requiredVariables'];
      const requirement = requiredVars.get(variable);

      console.log(`\n📋 Variable Information:`);
      console.log(`Name: ${variable}`);
      console.log(`Present: ${value ? 'Yes' : 'No'}`);
      
      if (value) {
        console.log(`Length: ${value.length} characters`);
        console.log(`Value: ${value.substring(0, 4)}${'*'.repeat(Math.max(0, value.length - 4))}`);
      }

      if (requirement) {
        console.log(`\n🔒 Security Requirements:`);
        console.log(`Required: ${requirement.required ? 'Yes' : 'No'}`);
        console.log(`Security Level: ${requirement.security.toUpperCase()}`);
        console.log(`Description: ${requirement.description}`);
        console.log(`Environments: ${requirement.environments.join(', ')}`);
        
        if (requirement.format && value) {
          const formatValid = requirement.format.test(value);
          console.log(`Format Valid: ${formatValid ? '✅ Yes' : '❌ No'}`);
        }

        if (requirement.minLength && value) {
          const lengthValid = value.length >= requirement.minLength;
          console.log(`Length Valid: ${lengthValid ? '✅ Yes' : `❌ No (minimum ${requirement.minLength})`}`);
        }

        if (requirement.defaultValue) {
          const usingDefault = value === requirement.defaultValue;
          console.log(`Using Default: ${usingDefault ? '⚠️ Yes' : '✅ No'}`);
        }
      } else {
        console.log(`\n❓ This variable is not in the required variables list`);
      }

    } catch (error) {
      console.error('❌ Variable check failed:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Generate secure defaults command
program
  .command('generate-template')
  .description('Generate environment template with secure defaults')
  .option('-e, --environment <env>', 'Target environment', 'development')
  .option('-o, --output <file>', 'Output file path', '.env.template')
  .action((options) => {
    try {
      console.log(`📝 Generating environment template for ${options.environment}`);
      
      const requiredVars = environmentSecurityValidator['requiredVariables'];
      let template = `# Environment Configuration Template for ${options.environment}\n`;
      template += `# Generated on ${new Date().toISOString()}\n`;
      template += `# Replace placeholder values with actual secure values\n\n`;

      template += `NODE_ENV=${options.environment}\n\n`;

      const categories = new Map<string, Array<{name: string, requirement: any}>>();
      
      for (const [name, requirement] of requiredVars) {
        if (!requirement.environments.includes(options.environment)) {
          continue;
        }

        const category = requirement.security;
        if (!categories.has(category)) {
          categories.set(category, []);
        }
        categories.get(category)!.push({name, requirement});
      }

      const severityOrder = ['critical', 'high', 'medium', 'low'];
      for (const severity of severityOrder) {
        const vars = categories.get(severity);
        if (vars && vars.length > 0) {
          template += `# ${severity.toUpperCase()} SECURITY VARIABLES\n`;
          
          for (const {name, requirement} of vars) {
            template += `# ${requirement.description}\n`;
            if (requirement.format) {
              template += `# Format: ${requirement.format.source}\n`;
            }
            if (requirement.minLength) {
              template += `# Minimum length: ${requirement.minLength} characters\n`;
            }
            
            let value = 'CHANGE_ME';
            if (requirement.defaultValue && requirement.defaultAllowed) {
              value = requirement.defaultValue;
            } else if (name.includes('SECRET') || name.includes('KEY')) {
              value = 'GENERATE_SECURE_' + (requirement.minLength || 32) + '_CHAR_VALUE';
            } else if (name.includes('URL')) {
              value = 'https://your-domain.com';
            }
            
            template += `${name}=${value}\n\n`;
          }
        }
      }

      writeFileSync(options.output, template);
      console.log(`✅ Environment template saved to: ${options.output}`);
      console.log(`\n⚠️ Remember to:`);
      console.log(`  1. Replace all placeholder values with secure, unique values`);
      console.log(`  2. Never commit this file with real secrets`);
      console.log(`  3. Use a secrets management system for production`);

    } catch (error) {
      console.error('❌ Template generation failed:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Parse command line arguments
program.parse();

export { program };