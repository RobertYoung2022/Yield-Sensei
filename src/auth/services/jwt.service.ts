/**
 * JWT Token Service
 * Handles JWT token generation, validation, and management
 */

import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { 
  JWTPayload, 
  RefreshTokenPayload, 
  TokenType, 
  AuthenticatedUser,
  TokenError,
  AuthConfig 
} from '../types';

export class JWTService {
  private config: AuthConfig;

  constructor(config: AuthConfig) {
    this.config = config;
  }

  /**
   * Generate a unique JWT ID
   */
  private generateJWTId(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Generate access token
   */
  generateAccessToken(user: AuthenticatedUser, clientId?: string): string {
    const payload: JWTPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      permissions: user.permissions,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + this.config.jwt.accessTokenExpiry,
      jti: this.generateJWTId(),
      type: TokenType.ACCESS_TOKEN,
      ...(clientId && { clientId }),
    };

    return jwt.sign(payload, this.config.jwt.secret, {
      issuer: this.config.jwt.issuer,
      audience: this.config.jwt.audience,
      algorithm: 'HS256',
    });
  }

  /**
   * Generate refresh token
   */
  generateRefreshToken(userId: string, clientId?: string): string {
    const payload: RefreshTokenPayload = {
      sub: userId,
      jti: this.generateJWTId(),
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + this.config.jwt.refreshTokenExpiry,
      type: TokenType.REFRESH_TOKEN,
      ...(clientId && { clientId }),
    };

    return jwt.sign(payload, this.config.jwt.secret, {
      issuer: this.config.jwt.issuer,
      audience: this.config.jwt.audience,
      algorithm: 'HS256',
    });
  }

  /**
   * Verify and decode access token
   */
  verifyAccessToken(token: string): JWTPayload {
    try {
      const decoded = jwt.verify(token, this.config.jwt.secret, {
        issuer: this.config.jwt.issuer,
        audience: this.config.jwt.audience,
        algorithms: ['HS256'],
      }) as JWTPayload;

      if (decoded.type !== TokenType.ACCESS_TOKEN) {
        throw new TokenError('Invalid token type', 'INVALID_TOKEN_TYPE');
      }

      return decoded;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new TokenError('Token expired', 'TOKEN_EXPIRED');
      } else if (error instanceof jwt.JsonWebTokenError) {
        throw new TokenError('Invalid token', 'INVALID_TOKEN');
      } else if (error instanceof TokenError) {
        throw error;
      } else {
        throw new TokenError('Token verification failed', 'TOKEN_VERIFICATION_FAILED');
      }
    }
  }

  /**
   * Verify and decode refresh token
   */
  verifyRefreshToken(token: string): RefreshTokenPayload {
    try {
      const decoded = jwt.verify(token, this.config.jwt.secret, {
        issuer: this.config.jwt.issuer,
        audience: this.config.jwt.audience,
        algorithms: ['HS256'],
      }) as RefreshTokenPayload;

      if (decoded.type !== TokenType.REFRESH_TOKEN) {
        throw new TokenError('Invalid token type', 'INVALID_TOKEN_TYPE');
      }

      return decoded;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new TokenError('Refresh token expired', 'REFRESH_TOKEN_EXPIRED');
      } else if (error instanceof jwt.JsonWebTokenError) {
        throw new TokenError('Invalid refresh token', 'INVALID_REFRESH_TOKEN');
      } else if (error instanceof TokenError) {
        throw error;
      } else {
        throw new TokenError('Refresh token verification failed', 'REFRESH_TOKEN_VERIFICATION_FAILED');
      }
    }
  }

  /**
   * Decode token without verification (for debugging)
   */
  decodeToken(token: string): any {
    try {
      return jwt.decode(token);
    } catch (error) {
      throw new TokenError('Token decode failed', 'TOKEN_DECODE_FAILED');
    }
  }

  /**
   * Get token expiration time
   */
  getTokenExpiration(token: string): Date {
    try {
      const decoded = jwt.decode(token) as any;
      if (!decoded || !decoded.exp) {
        throw new TokenError('Invalid token format', 'INVALID_TOKEN_FORMAT');
      }
      return new Date(decoded.exp * 1000);
    } catch (error) {
      if (error instanceof TokenError) {
        throw error;
      }
      throw new TokenError('Failed to get token expiration', 'TOKEN_EXPIRATION_FAILED');
    }
  }

  /**
   * Check if token is expired
   */
  isTokenExpired(token: string): boolean {
    try {
      const expiration = this.getTokenExpiration(token);
      return expiration < new Date();
    } catch (error) {
      return true; // Consider invalid tokens as expired
    }
  }

  /**
   * Get time until token expires (in seconds)
   */
  getTimeUntilExpiration(token: string): number {
    try {
      const expiration = this.getTokenExpiration(token);
      const now = Math.floor(Date.now() / 1000);
      const exp = Math.floor(expiration.getTime() / 1000);
      return Math.max(0, exp - now);
    } catch (error) {
      return 0;
    }
  }

  /**
   * Generate token pair (access + refresh)
   */
  generateTokenPair(user: AuthenticatedUser, clientId?: string): {
    accessToken: string;
    refreshToken: string;
    accessTokenExpiresIn: number;
    refreshTokenExpiresIn: number;
  } {
    const accessToken = this.generateAccessToken(user, clientId);
    const refreshToken = this.generateRefreshToken(user.id, clientId);

    return {
      accessToken,
      refreshToken,
      accessTokenExpiresIn: this.config.jwt.accessTokenExpiry,
      refreshTokenExpiresIn: this.config.jwt.refreshTokenExpiry,
    };
  }

  /**
   * Refresh access token using refresh token
   */
  refreshAccessToken(
    refreshToken: string, 
    user: AuthenticatedUser, 
    clientId?: string
  ): string {
    // Verify the refresh token
    const refreshPayload = this.verifyRefreshToken(refreshToken);
    
    // Check if the user ID matches
    if (refreshPayload.sub !== user.id) {
      throw new TokenError('Refresh token user mismatch', 'REFRESH_TOKEN_USER_MISMATCH');
    }

    // Check if client ID matches (if provided)
    if (clientId && refreshPayload.clientId && refreshPayload.clientId !== clientId) {
      throw new TokenError('Refresh token client mismatch', 'REFRESH_TOKEN_CLIENT_MISMATCH');
    }

    // Generate new access token
    return this.generateAccessToken(user, clientId);
  }
} 