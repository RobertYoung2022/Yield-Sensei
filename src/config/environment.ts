/**
 * Environment configuration for YieldSensei
 */

import { config as dotenvConfig } from 'dotenv';

// Load environment variables
dotenvConfig();

export interface Config {
  // Application
  nodeEnv: string;
  port: number;
  logLevel: string;
  
  // Database URLs
  databaseUrl: string;
  clickhouseUrl: string;
  redisUrl: string;
  vectorDbUrl: string;
  
  // Vector Database
  vectorDbHost: string;
  vectorDbPort: number;
  vectorDbApiKey?: string | undefined;
  
  // API Keys
  anthropicApiKey?: string | undefined;
  perplexityApiKey?: string | undefined;
  openaiApiKey?: string | undefined;
  googleApiKey?: string | undefined;
  ethereumRpcUrl?: string | undefined;
  polygonRpcUrl?: string | undefined;
  arbitrumRpcUrl?: string | undefined;
  optimismRpcUrl?: string | undefined;
  elizaosApiKey?: string | undefined;
  elizaosWebhookSecret?: string | undefined;
  twitterApiKey?: string | undefined;
  twitterApiSecret?: string | undefined;
  discordBotToken?: string | undefined;
  telegramBotToken?: string | undefined;
  
  // Security
  jwtSecret: string;
  encryptionKey: string;
  
  // Performance
  rateLimitWindowMs: number;
  rateLimitMaxRequests: number;
  
  // Monitoring
  performanceMonitoringEnabled: boolean;
  metricsCollectionInterval: number;
  
  // Development
  debugMode: boolean;
  mockExternalApis: boolean;
}

export const config: Config = {
  // Application
  nodeEnv: process.env['NODE_ENV'] || 'development',
  port: parseInt(process.env['PORT'] || '3000', 10),
  logLevel: process.env['LOG_LEVEL'] || 'info',
  
  // Database URLs
  databaseUrl: process.env['DATABASE_URL'] || 'postgresql://yieldsensei:password@localhost:5432/yieldsensei',
  clickhouseUrl: process.env['CLICKHOUSE_URL'] || 'http://localhost:8123',
  redisUrl: process.env['REDIS_URL'] || 'redis://localhost:6379',
  vectorDbUrl: process.env['VECTOR_DB_URL'] || 'http://localhost:8000',
  
  // Vector Database
  vectorDbHost: process.env['VECTOR_DB_HOST'] || 'localhost',
  vectorDbPort: parseInt(process.env['VECTOR_DB_PORT'] || '8000', 10),
  vectorDbApiKey: process.env['VECTOR_DB_API_KEY'],
  
  // API Keys
  anthropicApiKey: process.env['ANTHROPIC_API_KEY'],
  perplexityApiKey: process.env['PERPLEXITY_API_KEY'],
  openaiApiKey: process.env['OPENAI_API_KEY'],
  googleApiKey: process.env['GOOGLE_API_KEY'],
  
  // Blockchain RPCs
  ethereumRpcUrl: process.env['ETHEREUM_RPC_URL'],
  polygonRpcUrl: process.env['POLYGON_RPC_URL'],
  arbitrumRpcUrl: process.env['ARBITRUM_RPC_URL'],
  optimismRpcUrl: process.env['OPTIMISM_RPC_URL'],
  
  // Security
  jwtSecret: process.env['JWT_SECRET'] || 'default-jwt-secret-change-in-production',
  encryptionKey: process.env['ENCRYPTION_KEY'] || 'default-encryption-key-change-in-production',
  
  // Performance
  rateLimitWindowMs: parseInt(process.env['RATE_LIMIT_WINDOW_MS'] || '60000', 10),
  rateLimitMaxRequests: parseInt(process.env['RATE_LIMIT_MAX_REQUESTS'] || '100', 10),
  
  // ElizaOS
  elizaosApiKey: process.env['ELIZAOS_API_KEY'],
  elizaosWebhookSecret: process.env['ELIZAOS_WEBHOOK_SECRET'],
  
  // Social Media APIs
  twitterApiKey: process.env['TWITTER_API_KEY'],
  twitterApiSecret: process.env['TWITTER_API_SECRET'],
  discordBotToken: process.env['DISCORD_BOT_TOKEN'],
  telegramBotToken: process.env['TELEGRAM_BOT_TOKEN'],
  
  // Monitoring
  performanceMonitoringEnabled: process.env['PERFORMANCE_MONITORING_ENABLED'] === 'true',
  metricsCollectionInterval: parseInt(process.env['METRICS_COLLECTION_INTERVAL'] || '60000', 10),
  
  // Development
  debugMode: process.env['DEBUG_MODE'] === 'true',
  mockExternalApis: process.env['MOCK_EXTERNAL_APIS'] === 'true',
};
