/**
 * Security Configuration
 * Configuration for security measures and rate limiting
 */

import { SecurityConfig } from '../middleware/security.middleware';
import { APIKeyConfig } from '../services/api-key.service';
import { RateLimitConfig, TieredRateLimitConfig } from '../services/rate-limiter.service';

export const securityConfig: SecurityConfig = {
  cors: {
    origin: process.env['CORS_ORIGIN'] ? 
      process.env['CORS_ORIGIN'].split(',') : 
      ['http://localhost:3000', 'https://yieldsensei.com'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-API-Key',
      'X-CSRF-Token',
      'X-Requested-With',
    ],
  },
  helmet: {
    contentSecurityPolicy: process.env['NODE_ENV'] === 'production',
    crossOriginEmbedderPolicy: true,
    crossOriginOpenerPolicy: true,
    crossOriginResourcePolicy: true,
    dnsPrefetchControl: true,
    frameguard: true,
    hidePoweredBy: true,
    hsts: process.env['NODE_ENV'] === 'production',
    ieNoOpen: true,
    noSniff: true,
    permittedCrossDomainPolicies: true,
    referrerPolicy: true,
    xssFilter: true,
  },
  rateLimit: {
    windowMs: parseInt(process.env['RATE_LIMIT_WINDOW_MS'] || '900000'), // 15 minutes
    maxRequests: parseInt(process.env['RATE_LIMIT_MAX_REQUESTS'] || '100'),
  },
};

export const apiKeyConfig: APIKeyConfig = {
  keyLength: parseInt(process.env['API_KEY_LENGTH'] || '32'),
  prefix: process.env['API_KEY_PREFIX'] || 'ys',
  expirationDays: parseInt(process.env['API_KEY_EXPIRATION_DAYS'] || '365'),
  maxKeysPerUser: parseInt(process.env['API_KEY_MAX_PER_USER'] || '10'),
};

// Rate limiting configurations for different endpoints
export const rateLimitConfigs: Record<string, RateLimitConfig> = {
  // Authentication endpoints
  auth: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5, // 5 attempts per 15 minutes
    skipSuccessfulRequests: true,
  },
  
  // API endpoints
  api: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 60, // 60 requests per minute
  },
  
  // File upload endpoints
  upload: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 10, // 10 uploads per minute
  },
  
  // GraphQL endpoints
  graphql: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 100, // 100 queries per minute
  },
  
  // Health check endpoints
  health: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 30, // 30 checks per minute
  },
};

// Tiered rate limiting configurations
export const tieredRateLimitConfigs: Record<string, TieredRateLimitConfig> = {
  // General API usage
  api: {
    free: {
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 30, // 30 requests per minute
    },
    standard: {
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 100, // 100 requests per minute
    },
    premium: {
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 300, // 300 requests per minute
    },
    admin: {
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 1000, // 1000 requests per minute
    },
  },
  
  // Data export endpoints
  export: {
    free: {
      windowMs: 60 * 60 * 1000, // 1 hour
      maxRequests: 1, // 1 export per hour
    },
    standard: {
      windowMs: 60 * 60 * 1000, // 1 hour
      maxRequests: 5, // 5 exports per hour
    },
    premium: {
      windowMs: 60 * 60 * 1000, // 1 hour
      maxRequests: 20, // 20 exports per hour
    },
    admin: {
      windowMs: 60 * 60 * 1000, // 1 hour
      maxRequests: 100, // 100 exports per hour
    },
  },
  
  // Real-time data endpoints
  realtime: {
    free: {
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 10, // 10 requests per minute
    },
    standard: {
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 50, // 50 requests per minute
    },
    premium: {
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 200, // 200 requests per minute
    },
    admin: {
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 500, // 500 requests per minute
    },
  },
};

// Environment-specific configurations
export const getSecurityConfig = (): SecurityConfig => {
  const env = process.env['NODE_ENV'] || 'development';
  
  switch (env) {
    case 'production':
      return {
        ...securityConfig,
        cors: {
          ...securityConfig.cors,
          origin: process.env['CORS_ORIGIN'] ? 
            process.env['CORS_ORIGIN'].split(',') : 
            ['https://yieldsensei.com', 'https://www.yieldsensei.com'],
        },
        helmet: {
          ...securityConfig.helmet,
          contentSecurityPolicy: true,
          hsts: true,
        },
      };
    
    case 'staging':
      return {
        ...securityConfig,
        cors: {
          ...securityConfig.cors,
          origin: process.env['CORS_ORIGIN'] ? 
            process.env['CORS_ORIGIN'].split(',') : 
            ['https://staging.yieldsensei.com'],
        },
      };
    
    case 'development':
    default:
      return securityConfig;
  }
};

export const getAPIKeyConfig = (): APIKeyConfig => {
  const env = process.env['NODE_ENV'] || 'development';
  
  switch (env) {
    case 'production':
      return {
        ...apiKeyConfig,
        keyLength: 64, // Longer keys in production
        expirationDays: 90, // Shorter expiration in production
      };
    
    case 'staging':
      return {
        ...apiKeyConfig,
        keyLength: 48,
        expirationDays: 180,
      };
    
    case 'development':
    default:
      return apiKeyConfig;
  }
};

// Validation function
export const validateSecurityConfig = (config: SecurityConfig): void => {
  const errors: string[] = [];

  // Validate CORS configuration
  if (!config.cors.origin || (Array.isArray(config.cors.origin) && config.cors.origin.length === 0)) {
    errors.push('CORS origin must be specified');
  }

  if (!Array.isArray(config.cors.methods) || config.cors.methods.length === 0) {
    errors.push('CORS methods must be specified');
  }

  // Validate rate limit configuration
  if (config.rateLimit.windowMs < 60000) {
    errors.push('Rate limit window must be at least 60 seconds');
  }

  if (config.rateLimit.maxRequests < 1) {
    errors.push('Rate limit max requests must be at least 1');
  }

  if (errors.length > 0) {
    throw new Error(`Security configuration validation failed:\n${errors.join('\n')}`);
  }
};

export const validateAPIKeyConfig = (config: APIKeyConfig): void => {
  const errors: string[] = [];

  // Validate API key configuration
  if (config.keyLength < 16 || config.keyLength > 128) {
    errors.push('API key length must be between 16 and 128 characters');
  }

  if (!config.prefix || config.prefix.length < 2) {
    errors.push('API key prefix must be at least 2 characters');
  }

  if (config.expirationDays < 1 || config.expirationDays > 3650) {
    errors.push('API key expiration must be between 1 and 3650 days');
  }

  if (config.maxKeysPerUser < 1 || config.maxKeysPerUser > 100) {
    errors.push('API key max per user must be between 1 and 100');
  }

  if (errors.length > 0) {
    throw new Error(`API key configuration validation failed:\n${errors.join('\n')}`);
  }
};

// Export default configurations
export default {
  security: getSecurityConfig(),
  apiKey: getAPIKeyConfig(),
  rateLimit: rateLimitConfigs,
  tieredRateLimit: tieredRateLimitConfigs,
}; 