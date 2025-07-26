/**
 * Default Configuration for Perplexity Integration
 */

import { PerplexityConfig } from '../types';

export const DEFAULT_PERPLEXITY_CONFIG: PerplexityConfig = {
  apiKey: process.env.PERPLEXITY_API_KEY || '',
  baseUrl: 'https://api.perplexity.ai',
  timeout: 30000,
  maxRetries: 3,
  rateLimit: {
    maxRequestsPerMinute: 60,
    maxRequestsPerHour: 1000,
    maxRequestsPerDay: 10000,
    queueSize: 100,
    enableBurstMode: true,
    burstLimit: 10
  },
  cache: {
    enabled: true,
    ttl: 3600000, // 1 hour
    maxSize: 100, // 100 MB
    strategy: 'lru',
    persistToDisk: true,
    diskPath: './cache/perplexity'
  },
  fallback: {
    enabled: true,
    providers: [
      {
        name: 'cache-fallback',
        type: 'cache',
        config: {
          maxAge: 86400000 // 24 hours
        }
      }
    ],
    strategy: 'sequential'
  }
};