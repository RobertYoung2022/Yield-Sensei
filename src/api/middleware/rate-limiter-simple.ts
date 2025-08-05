/**
 * Simple Rate Limiter Middleware for MVP
 * In-memory rate limiting without Redis dependency
 */

import { Request, Response, NextFunction } from 'express';
import { getLogger } from "../../shared/utils/logger";

const logger = getLogger('rate-limiter');

// Simple in-memory store for rate limiting
const requestCounts = new Map<string, { count: number; resetTime: number }>();

// Clean up old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of requestCounts.entries()) {
    if (now > value.resetTime) {
      requestCounts.delete(key);
    }
  }
}, 5 * 60 * 1000);

export function rateLimiter(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const key = req.ip || 'unknown';
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute window
  const maxRequests = 1000; // Allow 1000 requests per minute for MVP

  const current = requestCounts.get(key);
  
  if (!current || now > current.resetTime) {
    // Reset or initialize counter
    requestCounts.set(key, {
      count: 1,
      resetTime: now + windowMs
    });
    return next();
  }

  if (current.count >= maxRequests) {
    logger.warn(`Rate limit exceeded for IP: ${key}`, { ip: key, count: current.count });
    res.status(429).json({
      error: 'Too Many Requests',
      message: 'Rate limit exceeded. Please try again later.',
      retryAfter: Math.ceil((current.resetTime - now) / 1000)
    });
    return;
  }

  // Increment counter
  current.count++;
  requestCounts.set(key, current);
  
  next();
}