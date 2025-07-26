/**
 * Security Middleware
 * Comprehensive security measures for input validation, sanitization, and attack protection
 */

import { Request, Response, NextFunction } from 'express';
import { body, validationResult, ValidationChain } from 'express-validator';
import helmet from 'helmet';
import cors from 'cors';
import hpp from 'hpp';
import mongoSanitize from 'express-mongo-sanitize';

export interface SecurityConfig {
  cors: {
    origin: string | string[] | boolean;
    credentials: boolean;
    methods: string[];
    allowedHeaders: string[];
  };
  helmet: {
    contentSecurityPolicy: boolean;
    crossOriginEmbedderPolicy: boolean;
    crossOriginOpenerPolicy: boolean;
    crossOriginResourcePolicy: boolean;
    dnsPrefetchControl: boolean;
    frameguard: boolean;
    hidePoweredBy: boolean;
    hsts: boolean;
    ieNoOpen: boolean;
    noSniff: boolean;
    permittedCrossDomainPolicies: boolean;
    referrerPolicy: boolean;
    xssFilter: boolean;
  };
  rateLimit: {
    windowMs: number;
    maxRequests: number;
  };
}

export class SecurityMiddleware {
  private config: SecurityConfig;

  constructor(config: SecurityConfig) {
    this.config = config;
  }

  /**
   * Helmet security headers middleware
   */
  helmetMiddleware() {
    return helmet({
      contentSecurityPolicy: this.config.helmet.contentSecurityPolicy ? {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
          connectSrc: ["'self'"],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          frameSrc: ["'none'"],
        },
      } : false,
      crossOriginEmbedderPolicy: this.config.helmet.crossOriginEmbedderPolicy,
      crossOriginOpenerPolicy: this.config.helmet.crossOriginOpenerPolicy,
      crossOriginResourcePolicy: this.config.helmet.crossOriginResourcePolicy,
      dnsPrefetchControl: this.config.helmet.dnsPrefetchControl,
      frameguard: this.config.helmet.frameguard,
      hidePoweredBy: this.config.helmet.hidePoweredBy,
      hsts: this.config.helmet.hsts ? {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true,
      } : false,
      ieNoOpen: this.config.helmet.ieNoOpen,
      noSniff: this.config.helmet.noSniff,
      permittedCrossDomainPolicies: this.config.helmet.permittedCrossDomainPolicies,
      referrerPolicy: this.config.helmet.referrerPolicy,
      xssFilter: this.config.helmet.xssFilter,
    });
  }

  /**
   * CORS middleware
   */
  corsMiddleware() {
    return cors({
      origin: this.config.cors.origin,
      credentials: this.config.cors.credentials,
      methods: this.config.cors.methods,
      allowedHeaders: this.config.cors.allowedHeaders,
    });
  }

  /**
   * HTTP Parameter Pollution protection
   */
  hppMiddleware() {
    return hpp({
      whitelist: ['filter', 'sort', 'page', 'limit'], // Allow these parameters to have multiple values
    });
  }

  /**
   * MongoDB injection protection
   */
  mongoSanitizeMiddleware() {
    return mongoSanitize({
      replaceWith: '_',
      onSanitize: ({ req, key }) => {
        console.warn(`MongoDB injection attempt detected: ${key} in ${req.url}`);
      },
    });
  }

  /**
   * XSS protection middleware
   */
  xssProtectionMiddleware() {
    return (req: Request, res: Response, next: NextFunction): void => {
      // Sanitize request body
      if (req.body) {
        req.body = this.sanitizeObject(req.body);
      }

      // Sanitize query parameters
      if (req.query) {
        req.query = this.sanitizeObject(req.query);
      }

      // Sanitize URL parameters
      if (req.params) {
        req.params = this.sanitizeObject(req.params);
      }

      next();
    };
  }

  /**
   * SQL injection protection middleware
   */
  sqlInjectionProtectionMiddleware() {
    return (req: Request, res: Response, next: NextFunction): void => {
      const sqlPatterns = [
        /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|SCRIPT)\b)/i,
        /(\b(OR|AND)\b\s+\d+\s*=\s*\d+)/i,
        /(\b(OR|AND)\b\s+['"]?\w+['"]?\s*=\s*['"]?\w+['"]?)/i,
        /(\b(OR|AND)\b\s+\d+\s*=\s*\d+\s*--)/i,
        /(\b(OR|AND)\b\s+\d+\s*=\s*\d+\s*#)/i,
        /(\b(OR|AND)\b\s+\d+\s*=\s*\d+\s*\/\*)/i,
        /(\b(OR|AND)\b\s+\d+\s*=\s*\d+\s*\*\/)/i,
        /(\b(OR|AND)\b\s+\d+\s*=\s*\d+\s*;)/i,
        /(\b(OR|AND)\b\s+\d+\s*=\s*\d+\s*$)/i,
      ];

      const checkForSQLInjection = (obj: any): boolean => {
        for (const key in obj) {
          if (obj.hasOwnProperty(key)) {
            const value = obj[key];
            
            if (typeof value === 'string') {
              for (const pattern of sqlPatterns) {
                if (pattern.test(value)) {
                  return true;
                }
              }
            } else if (typeof value === 'object' && value !== null) {
              if (checkForSQLInjection(value)) {
                return true;
              }
            }
          }
        }
        return false;
      };

      const hasSQLInjection = 
        checkForSQLInjection(req.body) ||
        checkForSQLInjection(req.query) ||
        checkForSQLInjection(req.params);

      if (hasSQLInjection) {
        console.warn(`SQL injection attempt detected: ${req.url}`);
        return res.status(400).json({
          error: {
            code: 'INVALID_INPUT',
            message: 'Invalid input detected',
          },
        });
      }

      next();
    };
  }

  /**
   * CSRF protection middleware
   */
  csrfProtectionMiddleware() {
    return (req: Request, res: Response, next: NextFunction): void => {
      // Skip CSRF check for GET requests
      if (req.method === 'GET') {
        return next();
      }

      // Check for CSRF token in headers
      const csrfToken = req.headers['x-csrf-token'] || req.headers['csrf-token'];
      
      if (!csrfToken) {
        return res.status(403).json({
          error: {
            code: 'CSRF_TOKEN_MISSING',
            message: 'CSRF token is required',
          },
        });
      }

      // TODO: Validate CSRF token against session
      // For now, just check if token exists
      next();
    };
  }

  /**
   * Request size limiting middleware
   */
  requestSizeLimitMiddleware(maxSize: string = '10mb') {
    return (req: Request, res: Response, next: NextFunction): void => {
      const contentLength = parseInt(req.headers['content-length'] || '0');
      const maxSizeBytes = this.parseSize(maxSize);

      if (contentLength > maxSizeBytes) {
        return res.status(413).json({
          error: {
            code: 'REQUEST_TOO_LARGE',
            message: 'Request entity too large',
          },
        });
      }

      next();
    };
  }

  /**
   * Content type validation middleware
   */
  contentTypeValidationMiddleware(allowedTypes: string[] = ['application/json']) {
    return (req: Request, res: Response, next: NextFunction): void => {
      if (req.method === 'GET') {
        return next();
      }

      const contentType = req.headers['content-type'];
      
      if (!contentType) {
        return res.status(400).json({
          error: {
            code: 'CONTENT_TYPE_MISSING',
            message: 'Content-Type header is required',
          },
        });
      }

      const isValidType = allowedTypes.some(type => 
        contentType.includes(type)
      );

      if (!isValidType) {
        return res.status(415).json({
          error: {
            code: 'UNSUPPORTED_CONTENT_TYPE',
            message: 'Unsupported content type',
          },
        });
      }

      next();
    };
  }

  /**
   * Input validation middleware
   */
  validationMiddleware(validations: ValidationChain[]) {
    return [
      ...validations,
      (req: Request, res: Response, next: NextFunction): void => {
        const errors = validationResult(req);
        
        if (!errors.isEmpty()) {
          return res.status(400).json({
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Validation failed',
              details: errors.array(),
            },
          });
        }

        next();
      },
    ];
  }

  /**
   * Common validation rules
   */
  static commonValidations = {
    email: body('email').isEmail().normalizeEmail(),
    password: body('password').isLength({ min: 8 }).matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/),
    username: body('username').isLength({ min: 3, max: 30 }).matches(/^[a-zA-Z0-9_-]+$/),
    id: body('id').isUUID(),
    pagination: [
      body('page').optional().isInt({ min: 1 }),
      body('limit').optional().isInt({ min: 1, max: 100 }),
    ],
    sorting: [
      body('sortBy').optional().isString(),
      body('sortOrder').optional().isIn(['asc', 'desc']),
    ],
  };

  /**
   * Sanitize object recursively
   */
  private sanitizeObject(obj: any): any {
    if (typeof obj !== 'object' || obj === null) {
      return this.sanitizeString(obj);
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.sanitizeObject(item));
    }

    const sanitized: any = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        sanitized[key] = this.sanitizeObject(obj[key]);
      }
    }

    return sanitized;
  }

  /**
   * Sanitize string
   */
  private sanitizeString(value: any): any {
    if (typeof value !== 'string') {
      return value;
    }

    return value
      .replace(/[<>]/g, '') // Remove < and >
      .replace(/javascript:/gi, '') // Remove javascript: protocol
      .replace(/on\w+=/gi, '') // Remove event handlers
      .trim();
  }

  /**
   * Parse size string to bytes
   */
  private parseSize(size: string): number {
    const units: { [key: string]: number } = {
      'b': 1,
      'kb': 1024,
      'mb': 1024 * 1024,
      'gb': 1024 * 1024 * 1024,
    };

    const match = size.toLowerCase().match(/^(\d+)([kmg]?b?)$/);
    if (!match) {
      return 1024 * 1024; // Default to 1MB
    }

    const value = parseInt(match[1]);
    const unit = match[2] || 'b';
    
    return value * (units[unit] || 1);
  }

  /**
   * Security headers middleware
   */
  securityHeadersMiddleware() {
    return (req: Request, res: Response, next: NextFunction): void => {
      // Additional security headers
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Frame-Options', 'DENY');
      res.setHeader('X-XSS-Protection', '1; mode=block');
      res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
      res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
      
      // Remove server information
      res.removeHeader('X-Powered-By');
      
      next();
    };
  }

  /**
   * Request logging middleware
   */
  requestLoggingMiddleware() {
    return (req: Request, res: Response, next: NextFunction): void => {
      const start = Date.now();
      
      res.on('finish', () => {
        const duration = Date.now() - start;
        const logData = {
          method: req.method,
          url: req.url,
          statusCode: res.statusCode,
          duration: `${duration}ms`,
          userAgent: req.headers['user-agent'],
          ip: req.ip || req.connection.remoteAddress,
          timestamp: new Date().toISOString(),
        };

        if (res.statusCode >= 400) {
          console.warn('Request failed:', logData);
        } else {
          console.log('Request completed:', logData);
        }
      });

      next();
    };
  }
} 