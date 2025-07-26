/**
 * API Key Management Service
 * Secure API key generation, validation, and management
 */

import crypto from 'crypto';
import { RedisClientType } from 'redis';

export interface APIKey {
  id: string;
  key: string;
  name: string;
  userId: string;
  permissions: string[];
  scopes: string[];
  active: boolean;
  lastUsed?: Date;
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface APIKeyConfig {
  keyLength: number;
  prefix: string;
  expirationDays: number;
  maxKeysPerUser: number;
}

export class APIKeyService {
  private redisClient: RedisClientType;
  private config: APIKeyConfig;

  constructor(redisClient: RedisClientType, config: APIKeyConfig) {
    this.redisClient = redisClient;
    this.config = config;
  }

  /**
   * Generate a new API key
   */
  generateAPIKey(): string {
    const randomBytes = crypto.randomBytes(this.config.keyLength);
    const key = randomBytes.toString('hex');
    return `${this.config.prefix}_${key}`;
  }

  /**
   * Create a new API key for a user
   */
  async createAPIKey(
    userId: string,
    name: string,
    permissions: string[] = [],
    scopes: string[] = ['read'],
    expiresInDays?: number
  ): Promise<APIKey> {
    const key = this.generateAPIKey();
    const id = crypto.randomUUID();
    
    const apiKey: APIKey = {
      id,
      key,
      name,
      userId,
      permissions,
      scopes,
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...(expiresInDays && {
        expiresAt: new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000),
      }),
    };

    // Store in Redis with expiration
    const keyData = JSON.stringify(apiKey);
    const ttl = expiresInDays ? expiresInDays * 24 * 60 * 60 : 0; // 0 = no expiration
    
    await this.redisClient.setEx(
      `api_key:${key}`,
      ttl,
      keyData
    );

    // Store user's API keys list
    await this.redisClient.sAdd(`user_api_keys:${userId}`, id);
    
    // Set expiration for user's API keys list if needed
    if (expiresInDays) {
      await this.redisClient.expire(
        `user_api_keys:${userId}`,
        expiresInDays * 24 * 60 * 60
      );
    }

    return apiKey;
  }

  /**
   * Validate an API key
   */
  async validateAPIKey(key: string): Promise<{
    isValid: boolean;
    apiKey?: APIKey;
    error?: string;
  }> {
    try {
      const keyData = await this.redisClient.get(`api_key:${key}`);
      
      if (!keyData) {
        return {
          isValid: false,
          error: 'API key not found',
        };
      }

      const apiKey: APIKey = JSON.parse(keyData);

      // Check if key is active
      if (!apiKey.active) {
        return {
          isValid: false,
          error: 'API key is inactive',
        };
      }

      // Check if key has expired
      if (apiKey.expiresAt && new Date() > apiKey.expiresAt) {
        return {
          isValid: false,
          error: 'API key has expired',
        };
      }

      // Update last used timestamp
      apiKey.lastUsed = new Date();
      apiKey.updatedAt = new Date();
      
      await this.redisClient.setEx(
        `api_key:${key}`,
        apiKey.expiresAt ? Math.ceil((apiKey.expiresAt.getTime() - Date.now()) / 1000) : 0,
        JSON.stringify(apiKey)
      );

      return {
        isValid: true,
        apiKey,
      };
    } catch (error) {
      return {
        isValid: false,
        error: 'Invalid API key format',
      };
    }
  }

  /**
   * Get API key by ID
   */
  async getAPIKeyById(id: string): Promise<APIKey | null> {
    try {
      // This would require a reverse lookup
      // For now, we'll need to scan through keys
      const keys = await this.redisClient.keys('api_key:*');
      
      for (const key of keys) {
        const keyData = await this.redisClient.get(key);
        if (keyData) {
          const apiKey: APIKey = JSON.parse(keyData);
          if (apiKey.id === id) {
            return apiKey;
          }
        }
      }
      
      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Get all API keys for a user
   */
  async getUserAPIKeys(userId: string): Promise<APIKey[]> {
    try {
      const keyIds = await this.redisClient.sMembers(`user_api_keys:${userId}`);
      const apiKeys: APIKey[] = [];

      for (const id of keyIds) {
        const apiKey = await this.getAPIKeyById(id);
        if (apiKey) {
          apiKeys.push(apiKey);
        }
      }

      return apiKeys;
    } catch (error) {
      return [];
    }
  }

  /**
   * Update API key
   */
  async updateAPIKey(
    key: string,
    updates: Partial<Pick<APIKey, 'name' | 'permissions' | 'scopes' | 'active'>>
  ): Promise<boolean> {
    try {
      const keyData = await this.redisClient.get(`api_key:${key}`);
      
      if (!keyData) {
        return false;
      }

      const apiKey: APIKey = JSON.parse(keyData);
      const updatedAPIKey = {
        ...apiKey,
        ...updates,
        updatedAt: new Date(),
      };

      const ttl = apiKey.expiresAt ? Math.ceil((apiKey.expiresAt.getTime() - Date.now()) / 1000) : 0;
      
      await this.redisClient.setEx(
        `api_key:${key}`,
        ttl,
        JSON.stringify(updatedAPIKey)
      );

      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Revoke an API key
   */
  async revokeAPIKey(key: string): Promise<boolean> {
    try {
      const keyData = await this.redisClient.get(`api_key:${key}`);
      
      if (!keyData) {
        return false;
      }

      const apiKey: APIKey = JSON.parse(keyData);
      
      // Remove from user's API keys list
      await this.redisClient.sRem(`user_api_keys:${apiKey.userId}`, apiKey.id);
      
      // Delete the API key
      await this.redisClient.del(`api_key:${key}`);
      
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Check if user has reached API key limit
   */
  async hasReachedKeyLimit(userId: string): Promise<boolean> {
    try {
      const keyCount = await this.redisClient.sCard(`user_api_keys:${userId}`);
      return keyCount >= this.config.maxKeysPerUser;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get API key usage statistics
   */
  async getAPIKeyStats(userId: string): Promise<{
    totalKeys: number;
    activeKeys: number;
    expiredKeys: number;
    lastUsed: Date | null;
  }> {
    try {
      const apiKeys = await this.getUserAPIKeys(userId);
      const now = new Date();
      
      const stats = {
        totalKeys: apiKeys.length,
        activeKeys: apiKeys.filter(key => key.active && (!key.expiresAt || key.expiresAt > now)).length,
        expiredKeys: apiKeys.filter(key => key.expiresAt && key.expiresAt <= now).length,
        lastUsed: null as Date | null,
      };

      // Find the most recently used key
      const lastUsedKey = apiKeys
        .filter(key => key.lastUsed)
        .sort((a, b) => (b.lastUsed?.getTime() || 0) - (a.lastUsed?.getTime() || 0))[0];

      if (lastUsedKey?.lastUsed) {
        stats.lastUsed = lastUsedKey.lastUsed;
      }

      return stats;
    } catch (error) {
      return {
        totalKeys: 0,
        activeKeys: 0,
        expiredKeys: 0,
        lastUsed: null,
      };
    }
  }

  /**
   * Clean up expired API keys
   */
  async cleanupExpiredKeys(): Promise<number> {
    try {
      const keys = await this.redisClient.keys('api_key:*');
      let cleanedCount = 0;

      for (const key of keys) {
        const keyData = await this.redisClient.get(key);
        if (keyData) {
          const apiKey: APIKey = JSON.parse(keyData);
          
          if (apiKey.expiresAt && new Date() > apiKey.expiresAt) {
            await this.revokeAPIKey(apiKey.key);
            cleanedCount++;
          }
        }
      }

      return cleanedCount;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Validate API key permissions
   */
  validatePermissions(apiKey: APIKey, requiredPermissions: string[]): boolean {
    return requiredPermissions.every(permission => 
      apiKey.permissions.includes(permission)
    );
  }

  /**
   * Validate API key scopes
   */
  validateScopes(apiKey: APIKey, requiredScopes: string[]): boolean {
    return requiredScopes.every(scope => 
      apiKey.scopes.includes(scope)
    );
  }

  /**
   * Generate API key hash for storage
   */
  private hashAPIKey(key: string): string {
    return crypto.createHash('sha256').update(key).digest('hex');
  }

  /**
   * Extract API key from request
   */
  extractAPIKey(req: any): string | null {
    // Check Authorization header
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      if (token.startsWith(this.config.prefix)) {
        return token;
      }
    }

    // Check X-API-Key header
    const apiKeyHeader = req.headers['x-api-key'];
    if (apiKeyHeader && typeof apiKeyHeader === 'string') {
      return apiKeyHeader;
    }

    // Check query parameter
    const queryKey = req.query.api_key;
    if (queryKey && typeof queryKey === 'string') {
      return queryKey;
    }

    return null;
  }
} 