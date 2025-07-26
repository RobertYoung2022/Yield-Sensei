/**
 * Development Environment Configuration
 * 
 * Provides secure defaults and validation for development environment.
 * This configuration should be used for local development and testing.
 */

import { Config } from '../environment';

export const developmentConfig: Partial<Config> = {
  // Application
  nodeEnv: 'development',
  port: 3000,
  logLevel: 'debug',
  
  // Database URLs (Development defaults - credentials should be set via environment variables)
  databaseUrl: 'postgresql://localhost:5432/yieldsensei_dev',
  clickhouseUrl: 'http://localhost:8123',
  redisUrl: 'redis://localhost:6379',
  vectorDbUrl: 'http://localhost:6333',
  
  // Vector Database
  vectorDbHost: 'localhost',
  vectorDbPort: 6333,
  
  // Performance (Development settings)
  rateLimitWindowMs: 60000,
  rateLimitMaxRequests: 1000, // Higher limit for development
  
  // Monitoring (Development settings)
  performanceMonitoringEnabled: true,
  metricsCollectionInterval: 30000, // More frequent for development
  
  // Development features
  debugMode: true,
  mockExternalApis: true,
};

/**
 * Development environment validation rules
 */
export const developmentValidationRules = {
  // Allow weaker secrets in development (but still validate)
  minSecretLength: 16,
  
  // Allow localhost connections
  allowLocalhost: true,
  
  // Development-specific warnings
  warnings: [
    'Using development configuration - not suitable for production',
    'Debug mode is enabled - sensitive information may be logged',
    'Mock external APIs are enabled - external integrations will be simulated',
    'Rate limiting is relaxed for development convenience'
  ]
};

/**
 * Development environment security checklist
 */
export const developmentSecurityChecklist = [
  '✅ JWT_SECRET is set (minimum 16 characters)',
  '✅ ENCRYPTION_KEY is set (minimum 16 characters)',
  '✅ Database passwords are set',
  '✅ Vector DB API key is set',
  '⚠️ Using development configuration (not for production)',
  '⚠️ Debug mode enabled (may expose sensitive data)',
  '⚠️ Mock APIs enabled (external integrations simulated)',
  '⚠️ Localhost connections allowed (development only)'
]; 