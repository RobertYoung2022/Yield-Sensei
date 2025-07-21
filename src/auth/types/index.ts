/**
 * Authentication Types and Interfaces
 * Core types for the authentication and authorization system
 */

import { Request } from 'express';

// User roles and permissions
export enum UserRole {
  USER = 'USER',
  ADMIN = 'ADMIN',
  INSTITUTIONAL = 'INSTITUTIONAL',
  SYSTEM = 'SYSTEM',
}

export enum Permission {
  // Portfolio permissions
  PORTFOLIO_READ = 'PORTFOLIO_READ',
  PORTFOLIO_WRITE = 'PORTFOLIO_WRITE',
  PORTFOLIO_DELETE = 'PORTFOLIO_DELETE',
  
  // Satellite permissions
  SATELLITE_READ = 'SATELLITE_READ',
  SATELLITE_WRITE = 'SATELLITE_WRITE',
  SATELLITE_CONTROL = 'SATELLITE_CONTROL',
  
  // Risk assessment permissions
  RISK_READ = 'RISK_READ',
  RISK_WRITE = 'RISK_WRITE',
  
  // Market data permissions
  MARKET_DATA_READ = 'MARKET_DATA_READ',
  MARKET_DATA_WRITE = 'MARKET_DATA_WRITE',
  
  // Transaction permissions
  TRANSACTION_READ = 'TRANSACTION_READ',
  TRANSACTION_WRITE = 'TRANSACTION_WRITE',
  
  // User management permissions
  USER_READ = 'USER_READ',
  USER_WRITE = 'USER_WRITE',
  USER_DELETE = 'USER_DELETE',
  
  // Analytics permissions
  ANALYTICS_READ = 'ANALYTICS_READ',
  ANALYTICS_WRITE = 'ANALYTICS_WRITE',
  
  // System permissions
  SYSTEM_CONFIG = 'SYSTEM_CONFIG',
  SYSTEM_MONITOR = 'SYSTEM_MONITOR',
}

// OAuth 2.0 grant types
export enum GrantType {
  AUTHORIZATION_CODE = 'authorization_code',
  CLIENT_CREDENTIALS = 'client_credentials',
  PASSWORD = 'password',
  REFRESH_TOKEN = 'refresh_token',
}

// Token types
export enum TokenType {
  ACCESS_TOKEN = 'access_token',
  REFRESH_TOKEN = 'refresh_token',
  ID_TOKEN = 'id_token',
}

// MFA types
export enum MFAType {
  TOTP = 'TOTP',
  SMS = 'SMS',
  EMAIL = 'EMAIL',
  HARDWARE_KEY = 'HARDWARE_KEY',
}

// User status
export enum UserStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  SUSPENDED = 'SUSPENDED',
  PENDING_VERIFICATION = 'PENDING_VERIFICATION',
}

// Authentication interfaces
export interface AuthenticatedUser {
  id: string;
  email: string;
  username?: string;
  role: UserRole;
  permissions: Permission[];
  status: UserStatus;
  mfaEnabled: boolean;
  mfaType?: MFAType;
  lastLogin?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface JWTPayload {
  sub: string; // User ID
  email: string;
  role: UserRole;
  permissions: Permission[];
  iat: number; // Issued at
  exp: number; // Expiration
  jti: string; // JWT ID
  type: TokenType;
  clientId?: string; // For OAuth clients
}

export interface RefreshTokenPayload {
  sub: string; // User ID
  jti: string; // JWT ID
  iat: number;
  exp: number;
  type: TokenType.REFRESH_TOKEN;
  clientId?: string;
}

export interface OAuthClient {
  id: string;
  name: string;
  secret: string;
  redirectUris: string[];
  grantTypes: GrantType[];
  scopes: string[];
  userId: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface OAuthAuthorizationCode {
  code: string;
  clientId: string;
  userId: string;
  redirectUri: string;
  scope: string[];
  expiresAt: Date;
  used: boolean;
  createdAt: Date;
}

export interface Session {
  id: string;
  userId: string;
  refreshTokenId: string;
  userAgent: string;
  ipAddress: string;
  expiresAt: Date;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface MFASecret {
  userId: string;
  secret: string;
  backupCodes: string[];
  verified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Request extensions
export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
  token?: string;
  clientId?: string;
  scopes?: string[];
}

// Authentication response types
export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  scope: string[];
  user: AuthenticatedUser;
}

export interface TokenResponse {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  scope: string[];
}

export interface MFAChallenge {
  type: MFAType;
  secret?: string; // For TOTP setup
  qrCode?: string; // For TOTP QR code
  backupCodes?: string[]; // For backup codes
}

// Error types
export class AuthenticationError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 401
  ) {
    super(message);
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 403
  ) {
    super(message);
    this.name = 'AuthorizationError';
  }
}

export class TokenError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 401
  ) {
    super(message);
    this.name = 'TokenError';
  }
}

// Configuration interfaces
export interface AuthConfig {
  jwt: {
    secret: string;
    accessTokenExpiry: number; // seconds
    refreshTokenExpiry: number; // seconds
    issuer: string;
    audience: string;
  };
  bcrypt: {
    saltRounds: number;
  };
  mfa: {
    totp: {
      issuer: string;
      algorithm: 'sha1' | 'sha256' | 'sha512';
      digits: number;
      period: number;
    };
    backupCodes: {
      count: number;
      length: number;
    };
  };
  session: {
    maxSessionsPerUser: number;
    sessionTimeout: number; // seconds
  };
  rateLimit: {
    loginAttempts: number;
    windowMs: number; // milliseconds
  };
} 