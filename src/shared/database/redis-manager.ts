// TODO: Install ioredis package - npm install ioredis @types/ioredis
// For now, providing basic type definitions to prevent compilation errors

import { EventEmitter } from 'events';

// Basic Redis interface definitions (replace with actual ioredis when installed)
interface RedisOptions {
  host?: string;
  port?: number;
  password?: string;
  db?: number;
  retryDelayOnFailover?: number;
  maxRetriesPerRequest?: number;
  lazyConnect?: boolean;
  enableAutoPipelining?: boolean;
  keyPrefix?: string;
  sentinels?: Array<{ host: string; port: number }>;
  name?: string;
}

interface RedisPipeline {
  setex(key: string, seconds: number, value: string): RedisPipeline;
  sadd(key: string, ...members: string[]): RedisPipeline;
  expire(key: string, seconds: number): RedisPipeline;
  exec(): Promise<any[]>;
}

interface RedisInterface {
  ping(): Promise<string>;
  pipeline(): RedisPipeline;
  setex(key: string, seconds: number, value: string): Promise<any>;
  get(key: string): Promise<string | null>;
  del(...keys: string[]): Promise<number>;
  smembers(key: string): Promise<string[]>;
  sadd(key: string, ...members: string[]): Promise<number>;
  expire(key: string, seconds: number): Promise<number>;
  incrby(key: string, increment: number): Promise<number>;
  exists(key: string): Promise<number>;
  mget(...keys: string[]): Promise<(string | null)[]>;
  publish(channel: string, message: string): Promise<number>;
  subscribe(channel: string): Promise<void>;
  psubscribe(pattern: string): Promise<void>;
  unsubscribe(channel: string): Promise<void>;
  info(section?: string): Promise<string>;
  call(command: string, ...args: any[]): Promise<any>;
  quit(): Promise<void>;
  duplicate(): RedisInterface;
  on(event: string, listener: (...args: any[]) => void): this;
}

// Stub implementations (replace with actual ioredis when installed)
class Redis implements RedisInterface {
  constructor(options: RedisOptions) {
    console.warn('Redis stub - install ioredis package for actual implementation');
  }
  
  async ping(): Promise<string> { return 'PONG'; }
  pipeline(): RedisPipeline { 
    return {
      setex: () => this.pipeline(),
      sadd: () => this.pipeline(),
      expire: () => this.pipeline(),
      exec: async () => []
    };
  }
  async setex(): Promise<any> { return 'OK'; }
  async get(): Promise<string | null> { return null; }
  async del(): Promise<number> { return 0; }
  async smembers(): Promise<string[]> { return []; }
  async sadd(): Promise<number> { return 0; }
  async expire(): Promise<number> { return 0; }
  async incrby(): Promise<number> { return 0; }
  async exists(): Promise<number> { return 0; }
  async mget(): Promise<(string | null)[]> { return []; }
  async publish(): Promise<number> { return 0; }
  async subscribe(): Promise<void> { }
  async psubscribe(): Promise<void> { }
  async unsubscribe(): Promise<void> { }
  async info(): Promise<string> { return ''; }
  async call(): Promise<any> { return null; }
  async quit(): Promise<void> { }
  duplicate(): RedisInterface { return new Redis({}); }
  on(): this { return this; }
}

class Cluster implements RedisInterface {
  constructor(options: RedisOptions) {
    console.warn('Redis Cluster stub - install ioredis package for actual implementation');
  }
  
  async ping(): Promise<string> { return 'PONG'; }
  pipeline(): RedisPipeline { 
    return {
      setex: () => this.pipeline(),
      sadd: () => this.pipeline(),
      expire: () => this.pipeline(),
      exec: async () => []
    };
  }
  async setex(): Promise<any> { return 'OK'; }
  async get(): Promise<string | null> { return null; }
  async del(): Promise<number> { return 0; }
  async smembers(): Promise<string[]> { return []; }
  async sadd(): Promise<number> { return 0; }
  async expire(): Promise<number> { return 0; }
  async incrby(): Promise<number> { return 0; }
  async exists(): Promise<number> { return 0; }
  async mget(): Promise<(string | null)[]> { return []; }
  async publish(): Promise<number> { return 0; }
  async subscribe(): Promise<void> { }
  async psubscribe(): Promise<void> { }
  async unsubscribe(): Promise<void> { }
  async info(): Promise<string> { return ''; }
  async call(): Promise<any> { return null; }
  async quit(): Promise<void> { }
  duplicate(): RedisInterface { return new Cluster({}); }
  on(): this { return this; }
}

// Simple logger interface for now
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

export class RedisManager extends EventEmitter {
  private static instance: RedisManager;
  private redis: Redis | Cluster | null = null;
  private subscriber: Redis | null = null;
  private publisher: Redis | null = null;
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
   * Connect to Redis with Sentinel support for high availability
   */
  public async connect(): Promise<void> {
    try {
      const redisOptions: RedisOptions = {
        password: this.config.password,
        db: this.config.db || 0,
        retryDelayOnFailover: this.config.retryDelayOnFailover || 100,
        maxRetriesPerRequest: this.config.maxRetriesPerRequest || 3,
        lazyConnect: this.config.lazyConnect !== false,
        enableAutoPipelining: this.config.enableAutoPipelining !== false,
        keyPrefix: this.config.keyPrefix || 'yieldsensei:',
      };

      // Use Sentinel if configured, otherwise direct connection
      if (this.config.sentinels && this.config.sentinels.length > 0) {
        this.redis = new Redis({
          sentinels: this.config.sentinels,
          name: this.config.name || 'yieldsensei-master',
          ...redisOptions,
        });
      } else {
        this.redis = new Redis({
          host: this.config.host || 'localhost',
          port: this.config.port || 6379,
          ...redisOptions,
        });
      }

      // Create separate connections for pub/sub
      this.subscriber = this.redis.duplicate();
      this.publisher = this.redis.duplicate();

      // Set up event listeners
      this.setupEventListeners();

      // Test connection
      await this.redis.ping();
      this.isConnected = true;

      this.logger.info('Redis connection established successfully');
      this.emit('connected');
    } catch (error) {
      this.logger.error('Failed to connect to Redis:', error);
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Set up Redis event listeners for monitoring and error handling
   */
  private setupEventListeners(): void {
    if (!this.redis) return;

    this.redis.on('connect', () => {
      this.logger.info('Redis connected');
      this.isConnected = true;
      this.emit('connected');
    });

    this.redis.on('ready', () => {
      this.logger.info('Redis ready');
      this.emit('ready');
    });

    this.redis.on('error', (error: any) => {
      this.logger.error('Redis error:', error);
      this.isConnected = false;
      this.emit('error', error);
    });

    this.redis.on('close', () => {
      this.logger.warn('Redis connection closed');
      this.isConnected = false;
      this.emit('disconnected');
    });

    this.redis.on('reconnecting', () => {
      this.logger.info('Redis reconnecting...');
      this.emit('reconnecting');
    });

    this.redis.on('end', () => {
      this.logger.warn('Redis connection ended');
      this.isConnected = false;
      this.emit('end');
    });
  }

  /**
   * Health check for Redis connection
   */
  public async healthCheck(): Promise<{ status: string; latency?: number }> {
    if (!this.redis || !this.isConnected) {
      return { status: 'disconnected' };
    }

    try {
      const start = Date.now();
      await this.redis.ping();
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
    if (!this.redis || options.skipCache) return false;

    try {
      const sanitizedKey = this.sanitizeKey(key);
      const ttl = options.ttl || this.defaultTTL;
      
      let serializedValue: string;
      if (options.serializeJson !== false && typeof value === 'object') {
        serializedValue = JSON.stringify(value);
      } else {
        serializedValue = String(value);
      }

      // Use pipeline for better performance
      const pipeline = this.redis.pipeline();
      pipeline.setex(sanitizedKey, ttl, serializedValue);

      // Add cache tags for invalidation
      if (options.tags && options.tags.length > 0) {
        for (const tag of options.tags) {
          pipeline.sadd(`tag:${tag}`, sanitizedKey);
          pipeline.expire(`tag:${tag}`, ttl);
        }
      }

      await pipeline.exec();
      
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
    if (!this.redis) return null;

    try {
      const sanitizedKey = this.sanitizeKey(key);
      const value = await this.redis.get(sanitizedKey);
      
      if (value === null) {
        this.stats.misses++;
        this.updateHitRate();
        return null;
      }

      this.stats.hits++;
      this.updateHitRate();

      if (parseJson) {
        try {
          return JSON.parse(value) as T;
        } catch {
          return value as T;
        }
      }
      
      return value as T;
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
    if (!this.redis) return false;

    try {
      const sanitizedKey = this.sanitizeKey(key);
      const result = await this.redis.del(sanitizedKey);
      
      this.stats.deletes++;
      return result > 0;
    } catch (error) {
      this.logger.error('Redis DELETE error:', error);
      return false;
    }
  }

  /**
   * Invalidate cache by tags
   */
  public async invalidateByTags(tags: string[]): Promise<number> {
    if (!this.redis) return 0;

    try {
      let deletedCount = 0;
      
      for (const tag of tags) {
        const keys = await this.redis.smembers(`tag:${tag}`);
        if (keys.length > 0) {
          const deleted = await this.redis.del(...keys);
          deletedCount += deleted;
        }
        await this.redis.del(`tag:${tag}`);
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
    if (!this.redis) return null;

    try {
      const sanitizedKey = this.sanitizeKey(key);
      return await this.redis.incrby(sanitizedKey, by);
    } catch (error) {
      this.logger.error('Redis INCREMENT error:', error);
      return null;
    }
  }

  /**
   * Set expiration for a key
   */
  public async expire(key: string, seconds: number): Promise<boolean> {
    if (!this.redis) return false;

    try {
      const sanitizedKey = this.sanitizeKey(key);
      const result = await this.redis.expire(sanitizedKey, seconds);
      return result === 1;
    } catch (error) {
      this.logger.error('Redis EXPIRE error:', error);
      return false;
    }
  }

  /**
   * Check if key exists
   */
  public async exists(key: string): Promise<boolean> {
    if (!this.redis) return false;

    try {
      const sanitizedKey = this.sanitizeKey(key);
      const result = await this.redis.exists(sanitizedKey);
      return result === 1;
    } catch (error) {
      this.logger.error('Redis EXISTS error:', error);
      return false;
    }
  }

  /**
   * Get multiple keys at once
   */
  public async mget<T = any>(keys: string[]): Promise<(T | null)[]> {
    if (!this.redis || keys.length === 0) return [];

    try {
      const sanitizedKeys = keys.map(key => this.sanitizeKey(key));
      const values = await this.redis.mget(...sanitizedKeys);
      
      return values.map((value: string | null, index: number) => {
        if (value === null) {
          this.stats.misses++;
          return null;
        }
        this.stats.hits++;
        try {
          return JSON.parse(value) as T;
        } catch {
          return value as T;
        }
      });
    } catch (error) {
      this.logger.error('Redis MGET error:', error);
      this.stats.misses += keys.length;
      return new Array(keys.length).fill(null);
    } finally {
      this.updateHitRate();
    }
  }

  /**
   * Publish a message to a channel
   */
  public async publish(
    channel: string,
    message: any
  ): Promise<boolean> {
    if (!this.publisher) return false;

    try {
      const payload = {
        data: message,
        timestamp: Date.now(),
      };

      const serialized = JSON.stringify(payload);
      await this.publisher.publish(channel, serialized);
      
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
    if (!this.subscriber) return false;

    try {
      this.subscriber.on('message', (receivedChannel: string, message: string) => {
        if (receivedChannel === channel) {
          try {
            const parsed = JSON.parse(message);
            callback({
              channel: receivedChannel,
              data: parsed.data,
              timestamp: parsed.timestamp,
            });
          } catch (error) {
            this.logger.error('Error parsing pub/sub message:', error);
          }
        }
      });

      await this.subscriber.subscribe(channel);
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
    if (!this.subscriber) return false;

    try {
      this.subscriber.on('pmessage', (receivedPattern: string, channel: string, message: string) => {
        if (receivedPattern === pattern) {
          try {
            const parsed = JSON.parse(message);
            callback({
              channel,
              pattern: receivedPattern,
              data: parsed.data,
              timestamp: parsed.timestamp,
            });
          } catch (error) {
            this.logger.error('Error parsing pub/sub message:', error);
          }
        }
      });

      await this.subscriber.psubscribe(pattern);
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
    if (!this.subscriber) return false;

    try {
      await this.subscriber.unsubscribe(channel);
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
    if (!this.redis) return null;

    try {
      return await this.redis.info(section);
    } catch (error) {
      this.logger.error('Redis INFO error:', error);
      return null;
    }
  }

  /**
   * Execute a custom Redis command
   */
  public async executeCommand(command: string, ...args: any[]): Promise<any> {
    if (!this.redis) return null;

    try {
      return await this.redis.call(command, ...args);
    } catch (error) {
      this.logger.error(`Redis ${command} error:`, error);
      return null;
    }
  }

  /**
   * Disconnect from Redis
   */
  public async disconnect(): Promise<void> {
    try {
      if (this.subscriber) {
        await this.subscriber.quit();
        this.subscriber = null;
      }

      if (this.publisher) {
        await this.publisher.quit();
        this.publisher = null;
      }

      if (this.redis) {
        await this.redis.quit();
        this.redis = null;
      }

      this.isConnected = false;
      this.logger.info('Redis connections closed');
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
    // Remove invalid characters and limit length
    const sanitized = key
      .replace(/[^a-zA-Z0-9:_-]/g, '_')
      .substring(0, this.maxKeyLength);
    
    return sanitized;
  }

  /**
   * Update hit rate statistics
   */
  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? this.stats.hits / total : 0;
  }

  /**
   * Check if Redis is connected
   */
  public isConnectedToRedis(): boolean {
    return this.isConnected;
  }

  /**
   * Get Redis connection instance (use with caution)
   */
  public getRedisInstance(): Redis | Cluster | null {
    return this.redis;
  }
} 