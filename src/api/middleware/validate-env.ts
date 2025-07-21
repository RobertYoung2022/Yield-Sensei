/**
 * Environment Validation Middleware
 * Validates required environment variables are set
 */

import { Request, Response, NextFunction } from 'express';
import Logger from '../../shared/logging/logger';

const logger = Logger.getLogger('validate-env');

// Required environment variables for API functionality
const requiredEnvVars = [
  'NODE_ENV',
  'JWT_SECRET',
  'REDIS_HOST',
  'REDIS_PORT',
  'DATABASE_URL',
];

// Optional but recommended environment variables
const recommendedEnvVars = [
  'ALLOWED_ORIGINS',
  'API_PORT',
  'LOG_LEVEL',
  'CORS_ORIGIN',
];

export function validateEnv(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const missingRequired = requiredEnvVars.filter(
    (envVar) => !process.env[envVar]
  );

  if (missingRequired.length > 0) {
    logger.error('Missing required environment variables:', missingRequired);
    res.status(500).json({
      error: {
        code: 'CONFIGURATION_ERROR',
        message: 'Server configuration error',
        details: {
          missing: missingRequired,
        },
        timestamp: new Date().toISOString(),
      },
    });
    return;
  }

  const missingRecommended = recommendedEnvVars.filter(
    (envVar) => !process.env[envVar]
  );

  if (missingRecommended.length > 0) {
    logger.warn('Missing recommended environment variables:', missingRecommended);
  }

  next();
} 