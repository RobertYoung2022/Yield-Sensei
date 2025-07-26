/**
 * Production Environment Configuration
 * 
 * Provides strict security requirements and validation for production environment.
 * This configuration enforces all security best practices.
 */

import { Config } from '../environment';

export const productionConfig: Partial<Config> = {
  // Application
  nodeEnv: 'production',
  port: 3000,
  logLevel: 'info', // Less verbose for production
  
  // Performance (Production settings)
  rateLimitWindowMs: 60000,
  rateLimitMaxRequests: 100, // Stricter limit for production
  
  // Monitoring (Production settings)
  performanceMonitoringEnabled: true,
  metricsCollectionInterval: 60000, // Less frequent for production
  
  // Production features
  debugMode: false, // Never enable debug in production
  mockExternalApis: false, // Always use real APIs in production
};

/**
 * Production environment validation rules
 */
export const productionValidationRules = {
  // Strict secret requirements for production
  minSecretLength: 32,
  
  // Disallow localhost connections in production
  allowLocalhost: false,
  
  // Production-specific requirements
  requirements: [
    'All secrets must be at least 32 characters long',
    'SSL/TLS must be enabled for all database connections',
    'External API keys must be valid and active',
    'Debug mode must be disabled',
    'Mock APIs must be disabled',
    'All database passwords must be strong',
    'Rate limiting must be properly configured',
    'Monitoring must be enabled'
  ]
};

/**
 * Production environment security checklist
 */
export const productionSecurityChecklist = [
  '✅ JWT_SECRET is set (minimum 32 characters)',
  '✅ ENCRYPTION_KEY is set (minimum 32 characters)',
  '✅ All database passwords are strong',
  '✅ Vector DB API key is set and valid',
  '✅ SSL/TLS is enabled for all connections',
  '✅ Debug mode is disabled',
  '✅ Mock APIs are disabled',
  '✅ Rate limiting is properly configured',
  '✅ Monitoring is enabled',
  '✅ External API keys are valid',
  '✅ No localhost connections in production',
  '✅ All secrets are stored securely',
  '✅ Environment variables are properly validated'
];

/**
 * Production environment security validation
 */
export function validateProductionEnvironment(): string[] {
  const errors: string[] = [];
  const config = process.env;
  
  // Check for debug mode
  if (config['DEBUG_MODE'] === 'true') {
    errors.push('Debug mode must be disabled in production');
  }
  
  // Check for mock APIs
  if (config['MOCK_EXTERNAL_APIS'] === 'true') {
    errors.push('Mock external APIs must be disabled in production');
  }
  
  // Check for localhost connections
  const localhostPatterns = ['localhost', '127.0.0.1', '::1'];
  const connectionVars = ['POSTGRES_HOST', 'CLICKHOUSE_HOST', 'REDIS_HOST', 'VECTOR_DB_HOST'];
  
  for (const varName of connectionVars) {
    const value = config[varName];
    if (value && localhostPatterns.some(pattern => value.includes(pattern))) {
      errors.push(`${varName} cannot use localhost in production`);
    }
  }
  
  // Check SSL requirements
  if (config['POSTGRES_SSL'] !== 'true') {
    errors.push('PostgreSQL SSL must be enabled in production');
  }
  
  // Check secret strength
  const secretVars = ['JWT_SECRET', 'ENCRYPTION_KEY', 'POSTGRES_PASSWORD', 'CLICKHOUSE_PASSWORD'];
  for (const varName of secretVars) {
    const value = config[varName];
    if (value && value.length < 32) {
      errors.push(`${varName} must be at least 32 characters long in production`);
    }
  }
  
  return errors;
} 