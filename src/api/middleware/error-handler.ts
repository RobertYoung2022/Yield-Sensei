/**
 * Global Error Handler Middleware
 * Provides standardized error responses and logging
 */

import { Request, Response, NextFunction } from 'express';
import Logger from '../../shared/logging/logger';

const logger = Logger.getLogger('error-handler');

export interface ApiError extends Error {
  statusCode?: number;
  code?: string;
  details?: any;
  isOperational?: boolean;
}

export class ValidationError extends Error implements ApiError {
  public statusCode: number = 400;
  public code: string = 'VALIDATION_ERROR';
  public isOperational: boolean = true;

  constructor(message: string, public details?: any) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class AuthenticationError extends Error implements ApiError {
  public statusCode: number = 401;
  public code: string = 'AUTHENTICATION_ERROR';
  public isOperational: boolean = true;

  constructor(message: string = 'Authentication required') {
    super(message);
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends Error implements ApiError {
  public statusCode: number = 403;
  public code: string = 'AUTHORIZATION_ERROR';
  public isOperational: boolean = true;

  constructor(message: string = 'Insufficient permissions') {
    super(message);
    this.name = 'AuthorizationError';
  }
}

export class NotFoundError extends Error implements ApiError {
  public statusCode: number = 404;
  public code: string = 'NOT_FOUND';
  public isOperational: boolean = true;

  constructor(resource: string = 'Resource') {
    super(`${resource} not found`);
    this.name = 'NotFoundError';
  }
}

export class RateLimitError extends Error implements ApiError {
  public statusCode: number = 429;
  public code: string = 'RATE_LIMIT_EXCEEDED';
  public isOperational: boolean = true;

  constructor(message: string = 'Rate limit exceeded') {
    super(message);
    this.name = 'RateLimitError';
  }
}

export function errorHandler(
  error: ApiError,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  // Log the error
  const errorLog = {
    message: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString(),
  };

  if (error.isOperational) {
    logger.warn('Operational error:', errorLog);
  } else {
    logger.error('System error:', errorLog);
  }

  // Determine status code
  const statusCode = error.statusCode || 500;
  const code = error.code || 'INTERNAL_SERVER_ERROR';

  // Don't expose internal errors in production
  const message = statusCode === 500 && process.env['NODE_ENV'] === 'production'
    ? 'Internal server error'
    : error.message;

  // Send error response
  res.status(statusCode).json({
    error: {
      code,
      message,
      ...(error.details && { details: error.details }),
      timestamp: new Date().toISOString(),
      path: req.path,
      method: req.method,
    },
  });
} 