#!/usr/bin/env node
/**
 * Configuration Validator CLI Runner
 * 
 * Runs configuration validation and reports results
 */

import { securityConfigValidator } from './security-config-validator';
import { configurationAuditLogger } from './audit-logger';

async function main() {
  try {
    console.log('🔍 Running configuration validation...');
    
    // Load configuration from environment or config files
    const config = {
      security: {
        jwt: {
          secret: process.env['JWT_SECRET'] || 'default-secret',
          expiresIn: '1h'
        },
        encryption: {
          algorithm: 'aes-256-gcm',
          keyLength: 32
        }
      },
      database: {
        ssl: process.env['NODE_ENV'] === 'production',
        host: process.env['DB_HOST'] || 'localhost'
      },
      api: {
        cors: {
          origin: process.env['CORS_ORIGIN'] || 'http://localhost:3000'
        },
        rateLimit: {
          windowMs: parseInt(process.env['RATE_LIMIT_WINDOW_MS'] || '900000'),
          max: parseInt(process.env['RATE_LIMIT_MAX_REQUESTS'] || '100')
        }
      }
    };

    // Validate configuration
    const result = await securityConfigValidator.validateSecurityConfiguration(
      process.env['NODE_ENV'] || 'development'
    );
    
    // Log validation attempt
    await configurationAuditLogger.logConfigurationChange(
      'system',
      'validate',
      {
        type: 'configuration',
        identifier: 'system-config',
        environment: process.env['NODE_ENV'] || 'development'
      },
      undefined,
      { validationResult: result.overallScore >= 80, violationCount: result.failedRules }
    );

    // Report results
    const isValid = result.overallScore >= 80 && result.criticalIssues.length === 0;
    
    if (isValid) {
      console.log('✅ Configuration validation passed!');
      console.log(`📊 Security Score: ${result.overallScore}/100`);
      console.log(`📋 Checked ${result.totalRules} rules (${result.passedRules} passed, ${result.failedRules} failed)`);
      
      if (result.failedRules > 0) {
        console.log('\n⚠️ Non-critical issues:');
        result.results.filter(r => !r.result.passed && r.rule.severity !== 'critical').forEach(ruleResult => {
          console.log(`  - ${ruleResult.rule.name}: ${ruleResult.result.message}`);
        });
      }
      
      process.exit(0);
    } else {
      console.log('❌ Configuration validation failed!');
      console.log(`📊 Security Score: ${result.overallScore}/100`);
      console.log(`📋 Found ${result.failedRules} failed rules out of ${result.totalRules} total`);
      
      if (result.criticalIssues.length > 0) {
        console.log('\n🚨 Critical Issues:');
        result.criticalIssues.forEach(ruleResult => {
          console.log(`  - ${ruleResult.rule.name}: ${ruleResult.result.message}`);
          if (ruleResult.rule.remediation) {
            console.log(`    💡 Remediation: ${ruleResult.rule.remediation}`);
          }
        });
      }
      
      if (result.recommendations.length > 0) {
        console.log('\n💡 Recommendations:');
        result.recommendations.forEach(recommendation => {
          console.log(`  - ${recommendation}`);
        });
      }
      
      process.exit(1);
    }

  } catch (error) {
    console.error('💥 Configuration validation failed with error:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

export { main as validateConfiguration };