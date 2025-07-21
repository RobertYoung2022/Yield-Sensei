/**
 * Rate Limiting Service
 * Comprehensive rate limiting with Redis-based storage and tiered limits
 */

import { RateLimiterRedis } from 'rate-limiter-flexible';
import { RedisClientType } from 'redis';
import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../auth/types';

export interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
  skipSuccessfulRequests?: boolean; // Skip rate limiting for successful requests
  skipFailedRequests?: boolean; // Skip rate limiting for failed requests
  keyGenerator?: (req: Request) => string; // Custom key generator
  handler?: (req: Request, res: Response, next: NextFunction) => void; // Custom handler
}

export interface TieredRateLimitConfig {
  free: RateLimitConfig;
  standard: RateLimitConfig;
  premium: RateLimitConfig;
  admin: RateLimitConfig;
}

export class RateLimiterService {
  private redisClient: RedisClientType;
  private limiters: Map<string, RateLimiterRedis> = new Map();

  constructor(redisClient: RedisClientType) {
    this.redisClient = redisClient;
  }

  /**
   * Create a rate limiter for a specific endpoint
   */
  createLimiter(
    name: string,
    config: RateLimitConfig
  ): RateLimiterRedis {
    const limiter = new RateLimiterRedis({
      storeClient: this.redisClient,
      keyPrefix: `rate_limit:${name}`,
      points: config.maxRequests,
      duration: config.windowMs / 1000, // Convert to seconds
      blockDuration: config.windowMs / 1000, // Block for the same duration
    });

    this.limiters.set(name, limiter);
    return limiter;
  }

  /**
   * Create tiered rate limiters
   */
  createTieredLimiters(name: string, config: TieredRateLimitConfig): {
    free: RateLimiterRedis;
    standard: RateLimiterRedis;
    premium: RateLimiterRedis;
    admin: RateLimiterRedis;
  } {
    return {
      free: this.createLimiter(`${name}:free`, config.free),
      standard: this.createLimiter(`${name}:standard`, config.standard),
      premium: this.createLimiter(`${name}:premium`, config.premium),
      admin: this.createLimiter(`${name}:admin`, config.admin),
    };
  }

  /**
   * Get rate limiter by name
   */
  getLimiter(name: string): RateLimiterRedis | undefined {
    return this.limiters.get(name);
  }

  /**
   * Generate key for rate limiting
   */
  generateKey(req: Request): string {
    // Use user ID if authenticated, otherwise use IP
    const user = (req as AuthenticatedRequest).user;
    if (user) {
      return `user:${user.id}`;
    }
    
    // Use IP address with X-Forwarded-For support
    const ip = this.getClientIP(req);
    return `ip:${ip}`;
  }

  /**
   * Get client IP address
   */
  private getClientIP(req: Request): string {
    return (
      req.headers['x-forwarded-for'] as string ||
      req.headers['x-real-ip'] as string ||
      req.connection.remoteAddress ||
      req.socket.remoteAddress ||
      'unknown'
    ).split(',')[0].trim();
  }

  /**
   * Consume rate limit points
   */
  async consume(key: string, limiter: RateLimiterRedis, points: number = 1): Promise<{
    remainingPoints: number;
    msBeforeNext: number;
    isBlocked: boolean;
  }> {
    try {
      const result = await limiter.consume(key, points);
      return {
        remainingPoints: result.remainingPoints,
        msBeforeNext: result.msBeforeNext,
        isBlocked: false,
      };
    } catch (error: any) {
      if (error.msBeforeNext) {
        return {
          remainingPoints: 0,
          msBeforeNext: error.msBeforeNext,
          isBlocked: true,
        };
      }
      throw error;
    }
  }

  /**
   * Get rate limit info for a key
   */
  async getRateLimitInfo(key: string, limiter: RateLimiterRedis): Promise<{
    remainingPoints: number;
    totalPoints: number;
    msBeforeNext: number;
    isBlocked: boolean;
  }> {
    try {
      const result = await limiter.get(key);
      return {
        remainingPoints: result ? result.remainingPoints : limiter.points,
        totalPoints: limiter.points,
        msBeforeNext: result ? result.msBeforeNext : 0,
        isBlocked: false,
      };
    } catch (error: any) {
      return {
        remainingPoints: 0,
        totalPoints: limiter.points,
        msBeforeNext: error.msBeforeNext || 0,
        isBlocked: true,
      };
    }
  }

  /**
   * Reset rate limit for a key
   */
  async reset(key: string, limiter: RateLimiterRedis): Promise<void> {
    await limiter.delete(key);
  }

  /**
   * Block a key for a specific duration
   */
  async block(key: string, limiter: RateLimiterRedis, durationMs: number): Promise<void> {
    await limiter.block(key, Math.ceil(durationMs / 1000));
  }

  /**
   * Get user tier for rate limiting
   */
  getUserTier(req: AuthenticatedRequest): 'free' | 'standard' | 'premium' | 'admin' {
    if (!req.user) {
      return 'free';
    }

    // TODO: Get user subscription from database
    // For now, use role-based tiering
    switch (req.user.role) {
      case 'ADMIN':
        return 'admin';
      case 'INSTITUTIONAL':
        return 'premium';
      case 'USER':
        return 'standard';
      default:
        return 'free';
    }
  }

  /**
   * Create middleware for rate limiting
   */
  createRateLimitMiddleware(
    name: string,
    config: RateLimitConfig
  ) {
    const limiter = this.createLimiter(name, config);
    
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const key = config.keyGenerator ? config.keyGenerator(req) : this.generateKey(req);
        
        // Skip rate limiting for successful requests if configured
        if (config.skipSuccessfulRequests && res.statusCode < 400) {
          return next();
        }

        // Skip rate limiting for failed requests if configured
        if (config.skipFailedRequests && res.statusCode >= 400) {
          return next();
        }

        const result = await this.consume(key, limiter);
        
        // Set rate limit headers
        res.setHeader('X-RateLimit-Limit', config.maxRequests);
        res.setHeader('X-RateLimit-Remaining', result.remainingPoints);
        res.setHeader('X-RateLimit-Reset', new Date(Date.now() + result.msBeforeNext).toISOString());

        if (result.isBlocked) {
          res.setHeader('Retry-After', Math.ceil(result.msBeforeNext / 1000));
          
          if (config.handler) {
            return config.handler(req, res, next);
          }

          return res.status(429).json({
            error: {
              code: 'RATE_LIMIT_EXCEEDED',
              message: 'Too many requests',
              retryAfter: Math.ceil(result.msBeforeNext / 1000),
            },
          });
        }

        next();
      } catch (error) {
        console.error('Rate limiting error:', error);
        next();
      }
    };
  }

  /**
   * Create tiered rate limit middleware
   */
  createTieredRateLimitMiddleware(name: string, config: TieredRateLimitConfig) {
    const limiters = this.createTieredLimiters(name, config);
    
    return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
      try {
        const tier = this.getUserTier(req);
        const limiter = limiters[tier];
        const key = this.generateKey(req);
        
        const result = await this.consume(key, limiter);
        
        // Set rate limit headers
        const tierConfig = config[tier];
        res.setHeader('X-RateLimit-Limit', tierConfig.maxRequests);
        res.setHeader('X-RateLimit-Remaining', result.remainingPoints);
        res.setHeader('X-RateLimit-Reset', new Date(Date.now() + result.msBeforeNext).toISOString());
        res.setHeader('X-RateLimit-Tier', tier);

        if (result.isBlocked) {
          res.setHeader('Retry-After', Math.ceil(result.msBeforeNext / 1000));
          
          return res.status(429).json({
            error: {
              code: 'RATE_LIMIT_EXCEEDED',
              message: 'Too many requests',
              retryAfter: Math.ceil(result.msBeforeNext / 1000),
              tier,
            },
          });
        }

        next();
      } catch (error) {
        console.error('Tiered rate limiting error:', error);
        next();
      }
    };
  }

  /**
   * Get all active limiters
   */
  getAllLimiters(): Map<string, RateLimiterRedis> {
    return this.limiters;
  }

  /**
   * Clear all rate limit data
   */
  async clearAll(): Promise<void> {
    for (const [name, limiter] of this.limiters) {
      await limiter.deleteAll();
    }
  }

  /**
   * Get rate limit statistics
   */
  async getStatistics(): Promise<{
    totalLimiters: number;
    activeKeys: number;
    blockedKeys: number;
  }> {
    let activeKeys = 0;
    let blockedKeys = 0;

    for (const [name, limiter] of this.limiters) {
      // TODO: Implement statistics collection
      // This would require additional Redis operations to count keys
    }

    return {
      totalLimiters: this.limiters.size,
      activeKeys,
      blockedKeys,
    };
  }
} 