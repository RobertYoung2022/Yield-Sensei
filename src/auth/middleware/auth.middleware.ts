/**
 * Authentication Middleware
 * Middleware for protecting routes and validating authentication
 */

import { Request, Response, NextFunction } from 'express';
import { 
  AuthenticatedRequest, 
  AuthenticatedUser, 
  Permission, 
  UserRole,
  AuthenticationError,
  AuthorizationError,
  TokenError 
} from '../types';
import { JWTService } from '../services/jwt.service';

export class AuthMiddleware {
  private jwtService: JWTService;

  constructor(jwtService: JWTService) {
    this.jwtService = jwtService;
  }

  /**
   * Extract token from request headers
   */
  private extractToken(req: Request): string | null {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return null;
    }

    const parts = authHeader.split(' ');
    
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return null;
    }

    return parts[1];
  }

  /**
   * Authenticate user from token
   */
  authenticate = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const token = this.extractToken(req);
      
      if (!token) {
        throw new AuthenticationError('No token provided', 'NO_TOKEN');
      }

      // Verify the token
      const payload = this.jwtService.verifyAccessToken(token);
      
      // Create authenticated user object
      const user: AuthenticatedUser = {
        id: payload.sub,
        email: payload.email,
        role: payload.role,
        permissions: payload.permissions,
        status: 'ACTIVE' as any, // TODO: Get from database
        mfaEnabled: false, // TODO: Get from database
        createdAt: new Date(), // TODO: Get from database
        updatedAt: new Date(), // TODO: Get from database
      };

      // Attach user to request
      req.user = user;
      req.token = token;

      next();
    } catch (error) {
      if (error instanceof TokenError) {
        next(new AuthenticationError(error.message, error.code, error.statusCode));
      } else {
        next(new AuthenticationError('Authentication failed', 'AUTHENTICATION_FAILED'));
      }
    }
  };

  /**
   * Optional authentication (doesn't fail if no token)
   */
  optionalAuth = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const token = this.extractToken(req);
      
      if (!token) {
        return next();
      }

      // Verify the token
      const payload = this.jwtService.verifyAccessToken(token);
      
      // Create authenticated user object
      const user: AuthenticatedUser = {
        id: payload.sub,
        email: payload.email,
        role: payload.role,
        permissions: payload.permissions,
        status: 'ACTIVE' as any, // TODO: Get from database
        mfaEnabled: false, // TODO: Get from database
        createdAt: new Date(), // TODO: Get from database
        updatedAt: new Date(), // TODO: Get from database
      };

      // Attach user to request
      req.user = user;
      req.token = token;

      next();
    } catch (error) {
      // Don't fail for optional auth, just continue without user
      next();
    }
  };

  /**
   * Require specific role
   */
  requireRole = (roles: UserRole | UserRole[]) => {
    return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
      if (!req.user) {
        throw new AuthenticationError('Authentication required', 'AUTHENTICATION_REQUIRED');
      }

      const requiredRoles = Array.isArray(roles) ? roles : [roles];
      
      if (!requiredRoles.includes(req.user.role)) {
        throw new AuthorizationError(
          `Insufficient role. Required: ${requiredRoles.join(', ')}, Got: ${req.user.role}`,
          'INSUFFICIENT_ROLE'
        );
      }

      next();
    };
  };

  /**
   * Require specific permission
   */
  requirePermission = (permissions: Permission | Permission[]) => {
    return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
      if (!req.user) {
        throw new AuthenticationError('Authentication required', 'AUTHENTICATION_REQUIRED');
      }

      const requiredPermissions = Array.isArray(permissions) ? permissions : [permissions];
      
      const hasAllPermissions = requiredPermissions.every(permission => 
        req.user!.permissions.includes(permission)
      );

      if (!hasAllPermissions) {
        throw new AuthorizationError(
          `Insufficient permissions. Required: ${requiredPermissions.join(', ')}`,
          'INSUFFICIENT_PERMISSIONS'
        );
      }

      next();
    };
  };

  /**
   * Require any of the specified permissions
   */
  requireAnyPermission = (permissions: Permission[]) => {
    return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
      if (!req.user) {
        throw new AuthenticationError('Authentication required', 'AUTHENTICATION_REQUIRED');
      }

      const hasAnyPermission = permissions.some(permission => 
        req.user!.permissions.includes(permission)
      );

      if (!hasAnyPermission) {
        throw new AuthorizationError(
          `Insufficient permissions. Required one of: ${permissions.join(', ')}`,
          'INSUFFICIENT_PERMISSIONS'
        );
      }

      next();
    };
  };

  /**
   * Require admin role
   */
  requireAdmin = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw new AuthenticationError('Authentication required', 'AUTHENTICATION_REQUIRED');
    }

    if (req.user.role !== UserRole.ADMIN) {
      throw new AuthorizationError('Admin access required', 'ADMIN_ACCESS_REQUIRED');
    }

    next();
  };

  /**
   * Require system role
   */
  requireSystem = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw new AuthenticationError('Authentication required', 'AUTHENTICATION_REQUIRED');
    }

    if (req.user.role !== UserRole.SYSTEM) {
      throw new AuthorizationError('System access required', 'SYSTEM_ACCESS_REQUIRED');
    }

    next();
  };

  /**
   * Check if user owns the resource or has admin access
   */
  requireOwnershipOrAdmin = (resourceUserId: string) => {
    return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
      if (!req.user) {
        throw new AuthenticationError('Authentication required', 'AUTHENTICATION_REQUIRED');
      }

      const isOwner = req.user.id === resourceUserId;
      const isAdmin = req.user.role === UserRole.ADMIN;

      if (!isOwner && !isAdmin) {
        throw new AuthorizationError('Access denied', 'ACCESS_DENIED');
      }

      next();
    };
  };

  /**
   * Rate limiting for authentication attempts
   */
  authRateLimit = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    // TODO: Implement rate limiting for auth endpoints
    // This would typically use Redis to track failed attempts
    next();
  };

  /**
   * Validate token and return user info
   */
  validateToken = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const token = this.extractToken(req);
      
      if (!token) {
        return res.status(401).json({
          error: {
            code: 'NO_TOKEN',
            message: 'No token provided',
          },
        });
      }

      const payload = this.jwtService.verifyAccessToken(token);
      
      const user: AuthenticatedUser = {
        id: payload.sub,
        email: payload.email,
        role: payload.role,
        permissions: payload.permissions,
        status: 'ACTIVE' as any, // TODO: Get from database
        mfaEnabled: false, // TODO: Get from database
        createdAt: new Date(), // TODO: Get from database
        updatedAt: new Date(), // TODO: Get from database
      };

      res.json({
        data: {
          user,
          token: {
            expiresIn: this.jwtService.getTimeUntilExpiration(token),
            type: payload.type,
          },
        },
      });
    } catch (error) {
      if (error instanceof TokenError) {
        res.status(error.statusCode).json({
          error: {
            code: error.code,
            message: error.message,
          },
        });
      } else {
        res.status(401).json({
          error: {
            code: 'TOKEN_VALIDATION_FAILED',
            message: 'Token validation failed',
          },
        });
      }
    }
  };
} 