#!/usr/bin/env npx tsx

import { Command } from 'commander';
import { runIntegrationTests, TestSuiteConfig } from '../tests/integrations/test-suite-runner';

const program = new Command();

program
  .name('run-integration-tests')
  .description('Run YieldSensei integration tests')
  .version('1.0.0');

program
  .option('-e, --environment <env>', 'Test environment (local, staging, production)', 'local')
  .option('-p, --parallel', 'Run tests in parallel', false)
  .option('--max-retries <num>', 'Maximum number of retries for failed tests', '1')
  .option('--timeout <ms>', 'Test timeout in milliseconds', '300000')
  .option('--no-reporting', 'Disable test reporting')
  .option('--ci', 'Run in CI mode', false)
  .option('--fixtures <fixtures>', 'Comma-separated list of fixtures to load', 'database,service-mocks,performance-baselines')
  .option('--groups <groups>', 'Comma-separated list of test groups to run', '')
  .option('--verbose', 'Enable verbose logging', false)
  .option('--bail', 'Stop on first test failure', false)
  .option('--coverage', 'Generate coverage report', true)
  .option('--performance', 'Generate performance report', true);

program.parse();

const options = program.opts();

async function main(): Promise<void> {
  console.log('🚀 YieldSensei Integration Test Runner');
  console.log('=====================================\n');

  if (options.verbose) {
    console.log('Configuration:');
    console.log(JSON.stringify(options, null, 2));
    console.log('');
  }

  // Validate environment
  if (!['local', 'staging', 'production'].includes(options.environment)) {
    console.error('❌ Invalid environment. Must be: local, staging, or production');
    process.exit(1);
  }

  // Check required environment variables
  const requiredEnvVars = getRequiredEnvVars(options.environment);
  const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);
  
  if (missingEnvVars.length > 0) {
    console.error('❌ Missing required environment variables:');
    missingEnvVars.forEach(envVar => console.error(`  - ${envVar}`));
    console.error('\nPlease set these variables and try again.');
    process.exit(1);
  }

  // Prepare test configuration
  const config: TestSuiteConfig = {
    environment: options.environment as 'local' | 'staging' | 'production',
    parallel: options.parallel,
    maxRetries: parseInt(options.maxRetries),
    timeout: parseInt(options.timeout),
    reportingEnabled: options.reporting !== false,
    ciMode: options.ci || process.env.CI === 'true',
    fixtures: options.fixtures.split(',').map((f: string) => f.trim()),
    testGroups: options.groups ? options.groups.split(',').map((g: string) => g.trim()) : []
  };

  // Set up logging level
  if (options.verbose) {
    process.env.LOG_LEVEL = 'debug';
  } else if (config.ciMode) {
    process.env.LOG_LEVEL = 'error';
  } else {
    process.env.LOG_LEVEL = 'info';
  }

  try {
    console.log(`🏃 Running integration tests in ${config.environment} environment...\n`);
    
    await runIntegrationTests(config);
    
    console.log('\n✅ All integration tests completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Integration tests failed:', error);
    
    if (options.bail) {
      console.log('🛑 Stopping execution due to --bail flag');
    }
    
    process.exit(1);
  }
}

function getRequiredEnvVars(environment: string): string[] {
  const baseVars = [
    'DB_HOST',
    'DB_PORT',
    'DB_NAME',
    'DB_USER',
    'DB_PASSWORD'
  ];

  const localVars = [
    ...baseVars,
    'REDIS_HOST',
    'REDIS_PORT'
  ];

  const stagingVars = [
    ...baseVars,
    'STAGING_API_KEY',
    'REDIS_URL'
  ];

  const productionVars = [
    ...baseVars,
    'PRODUCTION_API_KEY',
    'REDIS_URL',
    'MONITORING_TOKEN'
  ];

  switch (environment) {
    case 'local':
      return localVars;
    case 'staging':
      return stagingVars;
    case 'production':
      return productionVars;
    default:
      return baseVars;
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Received SIGINT. Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Received SIGTERM. Shutting down gracefully...');
  process.exit(0);
});

// Run the main function
main().catch((error) => {
  console.error('❌ Unexpected error:', error);
  process.exit(1);
});