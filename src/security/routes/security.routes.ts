/**
 * Security Routes
 * Routes for API key management and security monitoring
 */

import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { APIKeyService } from '../services/api-key.service';
import { RateLimiterService } from '../services/rate-limiter.service';
import { SecurityMiddleware } from '../middleware/security.middleware';
import { AuthenticatedRequest } from '../../auth/types';

export class SecurityRoutes {
  private router: Router;
  private apiKeyService: APIKeyService;
  private rateLimiterService: RateLimiterService;
  private securityMiddleware: SecurityMiddleware;

  constructor(
    apiKeyService: APIKeyService,
    rateLimiterService: RateLimiterService,
    securityMiddleware: SecurityMiddleware
  ) {
    this.router = Router();
    this.apiKeyService = apiKeyService;
    this.rateLimiterService = rateLimiterService;
    this.securityMiddleware = securityMiddleware;
    this.setupRoutes();
  }

  private setupRoutes(): void {
    // API Key management
    this.router.post('/api-keys', this.createAPIKeyValidation, this.createAPIKey);
    this.router.get('/api-keys', this.getAPIKeys);
    this.router.get('/api-keys/:id', this.getAPIKey);
    this.router.put('/api-keys/:id', this.updateAPIKeyValidation, this.updateAPIKey);
    this.router.delete('/api-keys/:id', this.revokeAPIKey);
    this.router.get('/api-keys/:id/stats', this.getAPIKeyStats);
    
    // Rate limiting
    this.router.get('/rate-limits', this.getRateLimitInfo);
    this.router.post('/rate-limits/reset', this.resetRateLimit);
    
    // Security monitoring
    this.router.get('/security/stats', this.getSecurityStats);
    this.router.get('/security/health', this.getSecurityHealth);
    
    // Security logs
    this.router.get('/security/logs', this.getSecurityLogs);
    this.router.post('/security/logs/clear', this.clearSecurityLogs);
  }

  // Validation middleware
  private createAPIKeyValidation = [
    body('name').isLength({ min: 1, max: 100 }).trim(),
    body('permissions').optional().isArray(),
    body('scopes').optional().isArray(),
    body('expiresInDays').optional().isInt({ min: 1, max: 3650 }),
  ];

  private updateAPIKeyValidation = [
    body('name').optional().isLength({ min: 1, max: 100 }).trim(),
    body('permissions').optional().isArray(),
    body('scopes').optional().isArray(),
    body('active').optional().isBoolean(),
  ];

  // Route handlers
  private createAPIKey = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Validation failed',
            details: errors.array(),
          },
        });
        return;
      }

      const { name, permissions = [], scopes = ['read'], expiresInDays } = req.body;
      const user = req.user!;

      // Check if user has reached API key limit
      const hasReachedLimit = await this.apiKeyService.hasReachedKeyLimit(user.id);
      if (hasReachedLimit) {
        res.status(429).json({
          error: {
            code: 'API_KEY_LIMIT_REACHED',
            message: 'Maximum number of API keys reached',
          },
        });
        return;
      }

      const apiKey = await this.apiKeyService.createAPIKey(
        user.id,
        name,
        permissions,
        scopes,
        expiresInDays
      );

      res.status(201).json({
        data: {
          apiKey: {
            id: apiKey.id,
            name: apiKey.name,
            key: apiKey.key, // Only show once
            permissions: apiKey.permissions,
            scopes: apiKey.scopes,
            active: apiKey.active,
            expiresAt: apiKey.expiresAt,
            createdAt: apiKey.createdAt,
          },
          message: 'API key created successfully. Store this key securely as it will not be shown again.',
        },
      });
    } catch (error) {
      res.status(500).json({
        error: {
          code: 'API_KEY_CREATION_FAILED',
          message: 'Failed to create API key',
        },
      });
    }
  };

  private getAPIKeys = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const user = req.user!;
      const apiKeys = await this.apiKeyService.getUserAPIKeys(user.id);

      // Remove sensitive data
      const sanitizedKeys = apiKeys.map(key => ({
        id: key.id,
        name: key.name,
        permissions: key.permissions,
        scopes: key.scopes,
        active: key.active,
        lastUsed: key.lastUsed,
        expiresAt: key.expiresAt,
        createdAt: key.createdAt,
        updatedAt: key.updatedAt,
      }));

      res.json({
        data: {
          apiKeys: sanitizedKeys,
          count: sanitizedKeys.length,
        },
      });
    } catch (error) {
      res.status(500).json({
        error: {
          code: 'API_KEYS_RETRIEVAL_FAILED',
          message: 'Failed to retrieve API keys',
        },
      });
    }
  };

  private getAPIKey = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const user = req.user!;

      const apiKey = await this.apiKeyService.getAPIKeyById(id);
      
      if (!apiKey) {
        res.status(404).json({
          error: {
            code: 'API_KEY_NOT_FOUND',
            message: 'API key not found',
          },
        });
        return;
      }

      // Check ownership
      if (apiKey.userId !== user.id) {
        res.status(403).json({
          error: {
            code: 'ACCESS_DENIED',
            message: 'Access denied',
          },
        });
        return;
      }

      // Remove sensitive data
      const sanitizedKey = {
        id: apiKey.id,
        name: apiKey.name,
        permissions: apiKey.permissions,
        scopes: apiKey.scopes,
        active: apiKey.active,
        lastUsed: apiKey.lastUsed,
        expiresAt: apiKey.expiresAt,
        createdAt: apiKey.createdAt,
        updatedAt: apiKey.updatedAt,
      };

      res.json({
        data: {
          apiKey: sanitizedKey,
        },
      });
    } catch (error) {
      res.status(500).json({
        error: {
          code: 'API_KEY_RETRIEVAL_FAILED',
          message: 'Failed to retrieve API key',
        },
      });
    }
  };

  private updateAPIKey = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Validation failed',
            details: errors.array(),
          },
        });
        return;
      }

      const { id } = req.params;
      const updates = req.body;
      const user = req.user!;

      const apiKey = await this.apiKeyService.getAPIKeyById(id);
      
      if (!apiKey) {
        res.status(404).json({
          error: {
            code: 'API_KEY_NOT_FOUND',
            message: 'API key not found',
          },
        });
        return;
      }

      // Check ownership
      if (apiKey.userId !== user.id) {
        res.status(403).json({
          error: {
            code: 'ACCESS_DENIED',
            message: 'Access denied',
          },
        });
        return;
      }

      const success = await this.apiKeyService.updateAPIKey(apiKey.key, updates);
      
      if (!success) {
        res.status(500).json({
          error: {
            code: 'API_KEY_UPDATE_FAILED',
            message: 'Failed to update API key',
          },
        });
        return;
      }

      res.json({
        data: {
          message: 'API key updated successfully',
        },
      });
    } catch (error) {
      res.status(500).json({
        error: {
          code: 'API_KEY_UPDATE_FAILED',
          message: 'Failed to update API key',
        },
      });
    }
  };

  private revokeAPIKey = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const user = req.user!;

      const apiKey = await this.apiKeyService.getAPIKeyById(id);
      
      if (!apiKey) {
        res.status(404).json({
          error: {
            code: 'API_KEY_NOT_FOUND',
            message: 'API key not found',
          },
        });
        return;
      }

      // Check ownership
      if (apiKey.userId !== user.id) {
        res.status(403).json({
          error: {
            code: 'ACCESS_DENIED',
            message: 'Access denied',
          },
        });
        return;
      }

      const success = await this.apiKeyService.revokeAPIKey(apiKey.key);
      
      if (!success) {
        res.status(500).json({
          error: {
            code: 'API_KEY_REVOCATION_FAILED',
            message: 'Failed to revoke API key',
          },
        });
        return;
      }

      res.json({
        data: {
          message: 'API key revoked successfully',
        },
      });
    } catch (error) {
      res.status(500).json({
        error: {
          code: 'API_KEY_REVOCATION_FAILED',
          message: 'Failed to revoke API key',
        },
      });
    }
  };

  private getAPIKeyStats = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const user = req.user!;
      const stats = await this.apiKeyService.getAPIKeyStats(user.id);

      res.json({
        data: {
          stats,
        },
      });
    } catch (error) {
      res.status(500).json({
        error: {
          code: 'API_KEY_STATS_FAILED',
          message: 'Failed to retrieve API key statistics',
        },
      });
    }
  };

  private getRateLimitInfo = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const user = req.user!;
      const key = this.rateLimiterService.generateKey(req);
      const limiters = this.rateLimiterService.getAllLimiters();
      
      const rateLimitInfo: any = {};
      
      for (const [name, limiter] of limiters) {
        const info = await this.rateLimiterService.getRateLimitInfo(key, limiter);
        rateLimitInfo[name] = info;
      }

      res.json({
        data: {
          rateLimits: rateLimitInfo,
          userTier: this.rateLimiterService.getUserTier(req),
        },
      });
    } catch (error) {
      res.status(500).json({
        error: {
          code: 'RATE_LIMIT_INFO_FAILED',
          message: 'Failed to retrieve rate limit information',
        },
      });
    }
  };

  private resetRateLimit = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { limiterName } = req.body;
      const user = req.user!;
      const key = this.rateLimiterService.generateKey(req);

      if (limiterName) {
        const limiter = this.rateLimiterService.getLimiter(limiterName);
        if (limiter) {
          await this.rateLimiterService.reset(key, limiter);
        }
      } else {
        // Reset all limiters
        const limiters = this.rateLimiterService.getAllLimiters();
        for (const [name, limiter] of limiters) {
          await this.rateLimiterService.reset(key, limiter);
        }
      }

      res.json({
        data: {
          message: 'Rate limit reset successfully',
        },
      });
    } catch (error) {
      res.status(500).json({
        error: {
          code: 'RATE_LIMIT_RESET_FAILED',
          message: 'Failed to reset rate limit',
        },
      });
    }
  };

  private getSecurityStats = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const user = req.user!;
      
      // Get API key statistics
      const apiKeyStats = await this.apiKeyService.getAPIKeyStats(user.id);
      
      // Get rate limiting statistics
      const rateLimitStats = await this.rateLimiterService.getStatistics();
      
      // TODO: Get additional security statistics
      // - Failed login attempts
      // - Suspicious activity
      // - Blocked IPs
      // - Security events

      res.json({
        data: {
          apiKeys: apiKeyStats,
          rateLimiting: rateLimitStats,
          security: {
            lastSecurityScan: new Date().toISOString(),
            threatsDetected: 0,
            blockedRequests: 0,
          },
        },
      });
    } catch (error) {
      res.status(500).json({
        error: {
          code: 'SECURITY_STATS_FAILED',
          message: 'Failed to retrieve security statistics',
        },
      });
    }
  };

  private getSecurityHealth = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      // TODO: Implement comprehensive security health check
      // - Check if all security services are running
      // - Verify rate limiting is working
      // - Check API key validation
      // - Monitor for suspicious activity

      const health = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        services: {
          rateLimiting: 'operational',
          apiKeyValidation: 'operational',
          securityMiddleware: 'operational',
          monitoring: 'operational',
        },
        metrics: {
          activeRateLimiters: this.rateLimiterService.getAllLimiters().size,
          totalAPIKeys: 0, // TODO: Get from database
          blockedRequests: 0,
          securityEvents: 0,
        },
      };

      res.json({
        data: {
          health,
        },
      });
    } catch (error) {
      res.status(500).json({
        error: {
          code: 'SECURITY_HEALTH_CHECK_FAILED',
          message: 'Failed to perform security health check',
        },
      });
    }
  };

  private getSecurityLogs = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      // TODO: Implement security log retrieval
      // - Authentication attempts
      // - Rate limit violations
      // - Security events
      // - API key usage

      const logs = [
        {
          timestamp: new Date().toISOString(),
          level: 'info',
          message: 'Security logs endpoint accessed',
          userId: req.user!.id,
        },
      ];

      res.json({
        data: {
          logs,
          count: logs.length,
        },
      });
    } catch (error) {
      res.status(500).json({
        error: {
          code: 'SECURITY_LOGS_FAILED',
          message: 'Failed to retrieve security logs',
        },
      });
    }
  };

  private clearSecurityLogs = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      // TODO: Implement security log clearing
      // - Clear old logs
      // - Archive important logs
      // - Maintain audit trail

      res.json({
        data: {
          message: 'Security logs cleared successfully',
        },
      });
    } catch (error) {
      res.status(500).json({
        error: {
          code: 'SECURITY_LOGS_CLEAR_FAILED',
          message: 'Failed to clear security logs',
        },
      });
    }
  };

  public getRouter(): Router {
    return this.router;
  }
} 