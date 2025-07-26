/**
 * Authentication Configuration
 * Configuration for authentication and authorization system
 */

import { AuthConfig } from '../types';

export const authConfig: AuthConfig = {
  jwt: {
    secret: process.env['JWT_SECRET'] || 'your-super-secret-jwt-key-change-in-production',
    accessTokenExpiry: parseInt(process.env['JWT_ACCESS_TOKEN_EXPIRY'] || '900'), // 15 minutes
    refreshTokenExpiry: parseInt(process.env['JWT_REFRESH_TOKEN_EXPIRY'] || '604800'), // 7 days
    issuer: process.env['JWT_ISSUER'] || 'yieldsensei',
    audience: process.env['JWT_AUDIENCE'] || 'yieldsensei-api',
  },
  bcrypt: {
    saltRounds: parseInt(process.env['BCRYPT_SALT_ROUNDS'] || '12'),
  },
  mfa: {
    totp: {
      issuer: process.env['MFA_TOTP_ISSUER'] || 'YieldSensei',
      algorithm: 'sha1',
      digits: 6,
      period: 30,
    },
    backupCodes: {
      count: 10,
      length: 8,
    },
  },
  session: {
    maxSessionsPerUser: parseInt(process.env['MAX_SESSIONS_PER_USER'] || '5'),
    sessionTimeout: parseInt(process.env['SESSION_TIMEOUT'] || '3600'), // 1 hour
  },
  rateLimit: {
    loginAttempts: parseInt(process.env['LOGIN_ATTEMPTS_LIMIT'] || '5'),
    windowMs: parseInt(process.env['LOGIN_WINDOW_MS'] || '900000'), // 15 minutes
  },
};

// Environment-specific configurations
export const getAuthConfig = (): AuthConfig => {
  const env = process.env['NODE_ENV'] || 'development';
  
  switch (env) {
    case 'production':
      return {
        ...authConfig,
        jwt: {
          ...authConfig.jwt,
          secret: process.env['JWT_SECRET'] || (() => {
            throw new Error('JWT_SECRET is required in production');
          })(),
        },
      };
    
    case 'staging':
      return {
        ...authConfig,
        jwt: {
          ...authConfig.jwt,
          accessTokenExpiry: 1800, // 30 minutes
          refreshTokenExpiry: 2592000, // 30 days
        },
      };
    
    case 'development':
    default:
      return authConfig;
  }
};

// Validation function
export const validateAuthConfig = (config: AuthConfig): void => {
  const errors: string[] = [];

  // Validate JWT configuration
  if (!config.jwt.secret || config.jwt.secret.length < 32) {
    errors.push('JWT_SECRET must be at least 32 characters long');
  }

  if (config.jwt.accessTokenExpiry < 60) {
    errors.push('JWT_ACCESS_TOKEN_EXPIRY must be at least 60 seconds');
  }

  if (config.jwt.refreshTokenExpiry < config.jwt.accessTokenExpiry) {
    errors.push('JWT_REFRESH_TOKEN_EXPIRY must be greater than JWT_ACCESS_TOKEN_EXPIRY');
  }

  // Validate bcrypt configuration
  if (config.bcrypt.saltRounds < 10 || config.bcrypt.saltRounds > 14) {
    errors.push('BCRYPT_SALT_ROUNDS must be between 10 and 14');
  }

  // Validate MFA configuration
  if (config.mfa.backupCodes.count < 5 || config.mfa.backupCodes.count > 20) {
    errors.push('MFA_BACKUP_CODES_COUNT must be between 5 and 20');
  }

  if (config.mfa.backupCodes.length < 6 || config.mfa.backupCodes.length > 10) {
    errors.push('MFA_BACKUP_CODES_LENGTH must be between 6 and 10');
  }

  // Validate session configuration
  if (config.session.maxSessionsPerUser < 1 || config.session.maxSessionsPerUser > 20) {
    errors.push('MAX_SESSIONS_PER_USER must be between 1 and 20');
  }

  if (config.session.sessionTimeout < 300 || config.session.sessionTimeout > 86400) {
    errors.push('SESSION_TIMEOUT must be between 300 and 86400 seconds');
  }

  // Validate rate limit configuration
  if (config.rateLimit.loginAttempts < 3 || config.rateLimit.loginAttempts > 10) {
    errors.push('LOGIN_ATTEMPTS_LIMIT must be between 3 and 10');
  }

  if (config.rateLimit.windowMs < 60000 || config.rateLimit.windowMs > 3600000) {
    errors.push('LOGIN_WINDOW_MS must be between 60000 and 3600000 milliseconds');
  }

  if (errors.length > 0) {
    throw new Error(`Authentication configuration validation failed:\n${errors.join('\n')}`);
  }
};

// Export default configuration
export default getAuthConfig(); 