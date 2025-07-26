import { EventEmitter } from 'events';

// Simple logger interface
interface Logger {
  info(message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  error(message: string, ...args: any[]): void;
}

// Basic logger implementation
class SimpleLogger implements Logger {
  constructor(private context: string) {}

  info(message: string, ...args: any[]): void {
    console.log(`[${this.context}] INFO:`, message, ...args);
  }

  warn(message: string, ...args: any[]): void {
    console.warn(`[${this.context}] WARN:`, message, ...args);
  }

  error(message: string, ...args: any[]): void {
    console.error(`[${this.context}] ERROR:`, message, ...args);
  }
}

export interface RedisConfig {
  sentinels?: Array<{ host: string; port: number }>;
  name?: string;
  host?: string;
  port?: number;
  password?: string;
  db?: number;
  retryDelayOnFailover?: number;
  maxRetriesPerRequest?: number;
  lazyConnect?: boolean;
  enableAutoPipelining?: boolean;
  maxmemoryPolicy?: string;
  keyPrefix?: string;
}

export interface CacheOptions {
  ttl?: number;
  tags?: string[];
  skipCache?: boolean;
  serializeJson?: boolean;
}

export interface PubSubMessage {
  channel: string;
  pattern?: string;
  data: any;
  timestamp: number;
}

export interface CacheStats {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  hitRate: number;
}

/**
 * Redis Manager for YieldSensei DeFi Platform
 * 
 * Provides high-performance caching and pub/sub functionality
 * with support for Redis Sentinel high availability.
 * 
 * Note: This is a simplified implementation. For production use,
 * install the ioredis package: npm install ioredis @types/ioredis
 */
export class RedisManager extends EventEmitter {
  private static instance: RedisManager;
  private config: RedisConfig;
  private logger: Logger;
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
    hitRate: 0,
  };
  private isConnected = false;
  private readonly defaultTTL = 3600; // 1 hour
  private readonly maxKeyLength = 250;

  // In-memory cache for development/testing
  private cache = new Map<string, { value: string; expires: number; tags?: string[] }>();
  private tagMap = new Map<string, Set<string>>();
  private subscribers = new Map<string, Set<(message: PubSubMessage) => void>>();
  private patternSubscribers = new Map<string, Set<(message: PubSubMessage) => void>>();

  private constructor(config: RedisConfig) {
    super();
    this.config = config;
    this.logger = new SimpleLogger('RedisManager');
  }

  public static getInstance(config?: RedisConfig): RedisManager {
    if (!RedisManager.instance) {
      if (!config) {
        throw new Error('Redis configuration is required for first initialization');
      }
      RedisManager.instance = new RedisManager(config);
    }
    return RedisManager.instance;
  }

  /**
   * Connect to Redis (simplified implementation uses in-memory cache)
   */
  public async connect(): Promise<void> {
    try {
      this.logger.warn('Using in-memory cache - install ioredis for production Redis support');
      
      // Simulate connection delay
      await new Promise(resolve => setTimeout(resolve, 100));
      
      this.isConnected = true;
      this.logger.info('Redis connection established (in-memory mode)');
      this.emit('connected');
    } catch (error) {
      this.logger.error('Failed to connect to Redis:', error);
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Health check for Redis connection
   */
  public async healthCheck(): Promise<{ status: string; latency?: number }> {
    if (!this.isConnected) {
      return { status: 'disconnected' };
    }

    try {
      const start = Date.now();
      // Simulate ping
      await new Promise(resolve => setTimeout(resolve, 1));
      const latency = Date.now() - start;
      
      return { status: 'healthy', latency };
    } catch (error) {
      this.logger.error('Redis health check failed:', error);
      return { status: 'unhealthy' };
    }
  }

  /**
   * Cache a value with optional TTL and tags
   */
  public async set(
    key: string,
    value: any,
    options: CacheOptions = {}
  ): Promise<boolean> {
    if (options.skipCache) return false;

    try {
      const sanitizedKey = this.sanitizeKey(key);
      const ttl = options.ttl || this.defaultTTL;
      const expires = Date.now() + (ttl * 1000);
      
      let serializedValue: string;
      if (options.serializeJson !== false && typeof value === 'object') {
        serializedValue = JSON.stringify(value);
      } else {
        serializedValue = String(value);
      }

      // Store in cache
      const cacheEntry: { value: string; expires: number; tags?: string[] } = {
        value: serializedValue,
        expires
      };
      
      if (options.tags) {
        cacheEntry.tags = options.tags;
      }
      
      this.cache.set(sanitizedKey, cacheEntry);

      // Add cache tags for invalidation
      if (options.tags && options.tags.length > 0) {
        for (const tag of options.tags) {
          if (!this.tagMap.has(tag)) {
            this.tagMap.set(tag, new Set());
          }
          this.tagMap.get(tag)!.add(sanitizedKey);
        }
      }
      
      this.stats.sets++;
      this.updateHitRate();
      
      return true;
    } catch (error) {
      this.logger.error('Redis SET error:', error);
      return false;
    }
  }

  /**
   * Get a cached value
   */
  public async get<T = any>(
    key: string,
    parseJson = true
  ): Promise<T | null> {
    try {
      const sanitizedKey = this.sanitizeKey(key);
      const cached = this.cache.get(sanitizedKey);
      
      if (!cached || cached.expires < Date.now()) {
        if (cached) {
          this.cache.delete(sanitizedKey);
        }
        this.stats.misses++;
        this.updateHitRate();
        return null;
      }

      this.stats.hits++;
      this.updateHitRate();

      if (parseJson) {
        try {
          return JSON.parse(cached.value) as T;
        } catch {
          return cached.value as T;
        }
      }
      
      return cached.value as T;
    } catch (error) {
      this.logger.error('Redis GET error:', error);
      this.stats.misses++;
      this.updateHitRate();
      return null;
    }
  }

  /**
   * Delete a cached value
   */
  public async delete(key: string): Promise<boolean> {
    try {
      const sanitizedKey = this.sanitizeKey(key);
      const result = this.cache.delete(sanitizedKey);
      
      if (result) {
        this.stats.deletes++;
      }
      return result;
    } catch (error) {
      this.logger.error('Redis DELETE error:', error);
      return false;
    }
  }

  /**
   * Invalidate cache by tags
   */
  public async invalidateByTags(tags: string[]): Promise<number> {
    try {
      let deletedCount = 0;
      
      for (const tag of tags) {
        const keys = this.tagMap.get(tag);
        if (keys) {
          for (const key of keys) {
            if (this.cache.delete(key)) {
              deletedCount++;
            }
          }
          this.tagMap.delete(tag);
        }
      }

      this.stats.deletes += deletedCount;
      return deletedCount;
    } catch (error) {
      this.logger.error('Redis tag invalidation error:', error);
      return 0;
    }
  }

  /**
   * Cache with automatic JSON serialization for objects
   */
  public async cacheJson(
    key: string,
    value: any,
    ttl = this.defaultTTL
  ): Promise<boolean> {
    return this.set(key, value, { ttl, serializeJson: true });
  }

  /**
   * Get JSON cached value with automatic parsing
   */
  public async getCachedJson<T = any>(key: string): Promise<T | null> {
    return this.get<T>(key, true);
  }

  /**
   * Increment a numeric value (atomic operation)
   */
  public async increment(key: string, by = 1): Promise<number | null> {
    try {
      const sanitizedKey = this.sanitizeKey(key);
      const cached = this.cache.get(sanitizedKey);
      
      let currentValue = 0;
      if (cached && cached.expires > Date.now()) {
        currentValue = parseInt(cached.value) || 0;
      }
      
      const newValue = currentValue + by;
      await this.set(sanitizedKey, newValue.toString(), { serializeJson: false });
      
      return newValue;
    } catch (error) {
      this.logger.error('Redis INCREMENT error:', error);
      return null;
    }
  }

  /**
   * Set expiration for a key
   */
  public async expire(key: string, seconds: number): Promise<boolean> {
    try {
      const sanitizedKey = this.sanitizeKey(key);
      const cached = this.cache.get(sanitizedKey);
      
      if (!cached) return false;
      
      cached.expires = Date.now() + (seconds * 1000);
      return true;
    } catch (error) {
      this.logger.error('Redis EXPIRE error:', error);
      return false;
    }
  }

  /**
   * Check if key exists
   */
  public async exists(key: string): Promise<boolean> {
    try {
      const sanitizedKey = this.sanitizeKey(key);
      const cached = this.cache.get(sanitizedKey);
      return cached !== undefined && cached.expires > Date.now();
    } catch (error) {
      this.logger.error('Redis EXISTS error:', error);
      return false;
    }
  }

  /**
   * Get multiple keys at once
   */
  public async mget<T = any>(keys: string[]): Promise<(T | null)[]> {
    if (keys.length === 0) return [];

    try {
      const results: (T | null)[] = [];
      
      for (const key of keys) {
        const value = await this.get<T>(key);
        results.push(value);
      }
      
      return results;
    } catch (error) {
      this.logger.error('Redis MGET error:', error);
      this.stats.misses += keys.length;
      this.updateHitRate();
      return new Array(keys.length).fill(null);
    }
  }

  /**
   * Publish a message to a channel
   */
  public async publish(
    channel: string,
    message: any
  ): Promise<boolean> {
    try {
      const payload: PubSubMessage = {
        channel,
        data: message,
        timestamp: Date.now(),
      };

      // Send to channel subscribers
      const channelSubs = this.subscribers.get(channel);
      if (channelSubs) {
        for (const callback of channelSubs) {
          try {
            callback(payload);
          } catch (error) {
            this.logger.error('Error in subscriber callback:', error);
          }
        }
      }

      // Send to pattern subscribers
      for (const [pattern, callbacks] of this.patternSubscribers) {
        if (this.matchPattern(pattern, channel)) {
          for (const callback of callbacks) {
            try {
              callback({ ...payload, pattern });
            } catch (error) {
              this.logger.error('Error in pattern subscriber callback:', error);
            }
          }
        }
      }
      
      return true;
    } catch (error) {
      this.logger.error('Redis PUBLISH error:', error);
      return false;
    }
  }

  /**
   * Subscribe to a channel
   */
  public async subscribe(
    channel: string,
    callback: (message: PubSubMessage) => void
  ): Promise<boolean> {
    try {
      if (!this.subscribers.has(channel)) {
        this.subscribers.set(channel, new Set());
      }
      this.subscribers.get(channel)!.add(callback);
      
      return true;
    } catch (error) {
      this.logger.error('Redis SUBSCRIBE error:', error);
      return false;
    }
  }

  /**
   * Subscribe to a pattern
   */
  public async psubscribe(
    pattern: string,
    callback: (message: PubSubMessage) => void
  ): Promise<boolean> {
    try {
      if (!this.patternSubscribers.has(pattern)) {
        this.patternSubscribers.set(pattern, new Set());
      }
      this.patternSubscribers.get(pattern)!.add(callback);
      
      return true;
    } catch (error) {
      this.logger.error('Redis PSUBSCRIBE error:', error);
      return false;
    }
  }

  /**
   * Unsubscribe from a channel
   */
  public async unsubscribe(channel: string): Promise<boolean> {
    try {
      this.subscribers.delete(channel);
      return true;
    } catch (error) {
      this.logger.error('Redis UNSUBSCRIBE error:', error);
      return false;
    }
  }

  /**
   * Get cache statistics
   */
  public getStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * Clear cache statistics
   */
  public clearStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      hitRate: 0,
    };
  }

  /**
   * Get Redis info
   */
  public async getInfo(section?: string): Promise<string | null> {
    return `# In-Memory Cache Info
cache_size:${this.cache.size}
connected:${this.isConnected}
hits:${this.stats.hits}
misses:${this.stats.misses}
hit_rate:${this.stats.hitRate.toFixed(3)}`;
  }

  /**
   * Execute a custom Redis command (limited support)
   */
  public async executeCommand(command: string, ...args: any[]): Promise<any> {
    this.logger.warn(`Custom command '${command}' not supported in simplified mode`);
    return null;
  }

  /**
   * Disconnect from Redis
   */
  public async disconnect(): Promise<void> {
    try {
      this.cache.clear();
      this.tagMap.clear();
      this.subscribers.clear();
      this.patternSubscribers.clear();
      
      this.isConnected = false;
      this.logger.info('Redis connections closed (in-memory mode)');
      this.emit('disconnected');
    } catch (error) {
      this.logger.error('Error disconnecting from Redis:', error);
      throw error;
    }
  }

  /**
   * Sanitize Redis keys to prevent issues
   */
  private sanitizeKey(key: string): string {
    const prefix = this.config.keyPrefix || 'yieldsensei:';
    const sanitized = key
      .replace(/[^a-zA-Z0-9:_-]/g, '_')
      .substring(0, this.maxKeyLength - prefix.length);
    
    return prefix + sanitized;
  }

  /**
   * Update hit rate statistics
   */
  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? this.stats.hits / total : 0;
  }

  /**
   * Simple pattern matching for pub/sub
   */
  private matchPattern(pattern: string, channel: string): boolean {
    const regexPattern = pattern
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');
    
    return new RegExp(`^${regexPattern}$`).test(channel);
  }

  /**
   * Check if Redis is connected
   */
  public isConnectedToRedis(): boolean {
    return this.isConnected;
  }

  /**
   * Delete a key (alias for delete method)
   */
  public async del(key: string): Promise<boolean> {
    return this.delete(key);
  }

  /**
   * Set key with expiration time in seconds
   */
  public async setex(key: string, seconds: number, value: any): Promise<boolean> {
    try {
      await this.set(key, value, { ttl: seconds });
      return true;
    } catch (error) {
      this.logger.error('Redis SETEX error:', error);
      return false;
    }
  }

  /**
   * Delete a hash field
   */
  public async hdel(key: string, field: string): Promise<number> {
    try {
      const hashKey = this.buildKey(`${key}:${field}`);
      const existed = this.cache.has(hashKey);
      this.cache.delete(hashKey);
      
      if (existed) {
        this.stats.deletes++;
        return 1;
      }
      return 0;
    } catch (error) {
      this.logger.error('Redis HDEL error:', error);
      return 0;
    }
  }

  /**
   * Set a hash field
   */
  public async hset(key: string, field: string, value: any): Promise<number> {
    try {
      const hashKey = this.buildKey(`${key}:${field}`);
      const existed = this.cache.has(hashKey);
      
      await this.set(hashKey, value);
      
      return existed ? 0 : 1;
    } catch (error) {
      this.logger.error('Redis HSET error:', error);
      return 0;
    }
  }

  /**
   * Get a hash field
   */
  public async hget(key: string, field: string): Promise<any> {
    try {
      const hashKey = this.buildKey(`${key}:${field}`);
      return this.get(hashKey);
    } catch (error) {
      this.logger.error('Redis HGET error:', error);
      return null;
    }
  }

  /**
   * Clean up expired entries (maintenance function)
   */
  public async cleanup(): Promise<number> {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [key, cached] of this.cache) {
      if (cached.expires < now) {
        this.cache.delete(key);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      this.logger.info(`Cleaned up ${cleaned} expired cache entries`);
    }
    
    return cleaned;
  }
} 