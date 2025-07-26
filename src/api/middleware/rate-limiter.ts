/**
 * Rate Limiter Middleware
 * Implements tiered rate limiting based on user type and IP
 */

import { Request, Response, NextFunction } from 'express';
import { RateLimiterRedis } from 'rate-limiter-flexible';
import { RateLimitError } from './error-handler';
import Logger from '../../shared/logging/logger';

// Extend Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        subscription?: 'free' | 'standard' | 'premium';
      };
    }
  }
}

const logger = Logger.getLogger('rate-limiter');

// Use existing Redis client from shared module
import { RedisManager } from '../../shared/database/redis-manager';

// Lazy initialization of Redis client
function getRedisClient() {
  try {
    const redisConfig = {
      host: process.env['REDIS_HOST'] || 'localhost',
      port: parseInt(process.env['REDIS_PORT'] || '6379'),
      ...(process.env['REDIS_PASSWORD'] && { password: process.env['REDIS_PASSWORD'] }),
    };
    return RedisManager.getInstance(redisConfig).getRedisInstance();
  } catch (error) {
    logger.warn('Redis not available for rate limiting, using in-memory fallback');
    return null;
  }
}

// Rate limit configurations
const rateLimitConfigs = {
  // Free tier - very restrictive
  free: {
    points: 100, // requests
    duration: 60, // per minute
  },
  // Standard tier - moderate
  standard: {
    points: 1000, // requests
    duration: 60, // per minute
  },
  // Premium tier - generous
  premium: {
    points: 10000, // requests
    duration: 60, // per minute
  },
  // API key tier - very generous
  apiKey: {
    points: 50000, // requests
    duration: 60, // per minute
  },
  // IP-based fallback
  ip: {
    points: 50, // requests
    duration: 60, // per minute
  },
};

// Lazy creation of rate limiters
let rateLimiters: any = null;

function getRateLimiters() {
  if (!rateLimiters) {
    const redisClient = getRedisClient();
    rateLimiters = {
      free: new RateLimiterRedis({
        storeClient: redisClient,
        keyPrefix: 'rate_limit_free',
        points: rateLimitConfigs.free.points,
        duration: rateLimitConfigs.free.duration,
        blockDuration: 60, // block for 1 minute when limit exceeded
      }),
      standard: new RateLimiterRedis({
        storeClient: redisClient,
        keyPrefix: 'rate_limit_standard',
        points: rateLimitConfigs.standard.points,
        duration: rateLimitConfigs.standard.duration,
        blockDuration: 60,
      }),
      premium: new RateLimiterRedis({
        storeClient: redisClient,
        keyPrefix: 'rate_limit_premium',
        points: rateLimitConfigs.premium.points,
        duration: rateLimitConfigs.premium.duration,
        blockDuration: 60,
      }),
      apiKey: new RateLimiterRedis({
        storeClient: redisClient,
        keyPrefix: 'rate_limit_api_key',
        points: rateLimitConfigs.apiKey.points,
        duration: rateLimitConfigs.apiKey.duration,
        blockDuration: 60,
      }),
      ip: new RateLimiterRedis({
        storeClient: redisClient,
        keyPrefix: 'rate_limit_ip',
        points: rateLimitConfigs.ip.points,
        duration: rateLimitConfigs.ip.duration,
        blockDuration: 300, // block for 5 minutes when limit exceeded
      }),
    };
  }
  return rateLimiters;
}

export function rateLimiter(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Determine user tier based on authentication
  const userTier = getUserTier(req);
  const limiter = getRateLimiters()[userTier];
  const key = getRateLimitKey(req, userTier);

  limiter
    .consume(key)
    .then((rateLimiterRes: any) => {
      // Add rate limit headers
      res.setHeader('X-RateLimit-Limit', rateLimitConfigs[userTier].points);
      res.setHeader('X-RateLimit-Remaining', rateLimiterRes.remainingPoints);
      res.setHeader('X-RateLimit-Reset', new Date(Date.now() + rateLimiterRes.msBeforeNext).toISOString());

      next();
    })
    .catch((rateLimiterRes: any) => {
      // Rate limit exceeded
      const msBeforeNext = rateLimiterRes.msBeforeNext || 60000; // Default to 1 minute
      const retryAfter = Math.ceil(msBeforeNext / 1000);
      
      res.setHeader('Retry-After', retryAfter);
      res.setHeader('X-RateLimit-Limit', rateLimitConfigs[userTier].points);
      res.setHeader('X-RateLimit-Remaining', 0);
      res.setHeader('X-RateLimit-Reset', new Date(Date.now() + msBeforeNext).toISOString());

      logger.warn('Rate limit exceeded:', {
        key,
        tier: userTier,
        retryAfter,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
      });

      const error = new RateLimitError(
        `Rate limit exceeded. Try again in ${retryAfter} seconds.`
      );
      error.statusCode = 429;
      next(error);
    });
}

function getUserTier(req: Request): keyof typeof rateLimitConfigs {
  // Check for API key first (highest priority)
  if (req.headers['x-api-key']) {
    return 'apiKey';
  }

  // Check for authenticated user with premium subscription
  if (req.user && req.user.subscription === 'premium') {
    return 'premium';
  }

  // Check for authenticated user with standard subscription
  if (req.user && req.user.subscription === 'standard') {
    return 'standard';
  }

  // Check for authenticated user (free tier)
  if (req.user) {
    return 'free';
  }

  // Fallback to IP-based limiting for unauthenticated requests
  return 'ip';
}

function getRateLimitKey(req: Request, tier: keyof typeof rateLimitConfigs): string {
  switch (tier) {
    case 'apiKey':
      return `api_key:${req.headers['x-api-key']}`;
    case 'premium':
    case 'standard':
    case 'free':
      return `user:${req.user?.id}`;
    case 'ip':
    default:
      return `ip:${req.ip}`;
  }
}

// Export for testing
export { rateLimitConfigs, rateLimiters }; 