/**
 * YieldSensei Database Manager
 * Manages connections to PostgreSQL, ClickHouse, Redis, and Vector DB
 */

import { Pool, PoolClient } from 'pg';
import { createClient, RedisClientType } from 'redis';
import { QdrantClient } from '@qdrant/js-client-rest';
import Logger from '@/shared/logging/logger';
import { config } from '@/config/environment';
import { EventEmitter } from 'events';
import { PostgreSQLSchemaManager } from './schema-manager';

const logger = Logger.getLogger('database');

/**
 * Database connection status
 */
export interface DatabaseStatus {
  postgres: 'connected' | 'disconnected' | 'error';
  redis: 'connected' | 'disconnected' | 'error';
  clickhouse: 'connected' | 'disconnected' | 'error';
  vector: 'connected' | 'disconnected' | 'error';
}

/**
 * Database configuration
 */
export interface DatabaseConfig {
  postgres: {
    host: string;
    port: number;
    database: string;
    username: string;
    password: string;
    ssl?: boolean;
    max: number;
    idleTimeoutMillis: number;
    connectionTimeoutMillis: number;
  };
  redis: {
    url: string;
    maxRetriesPerRequest: number;
    retryDelayOnFailover: number;
  };
  clickhouse: {
    url: string;
    username?: string;
    password?: string;
    database: string;
    requestTimeout: number;
  };
  vector: {
    url: string;
    apiKey?: string;
    timeout: number;
  };
}

/**
 * Database connection pools and clients
 */
export class DatabaseManager extends EventEmitter {
  private static instance: DatabaseManager;
  private config: DatabaseConfig;
  private schemaManager: PostgreSQLSchemaManager;
  
  // Connection instances
  private postgresPool: Pool | null = null;
  private redisClient: RedisClientType | null = null;
  private clickhouseClient: any | null = null; // ClickHouse client
  private vectorClient: any | null = null;
  
  // Connection status
  private status: DatabaseStatus = {
    postgres: 'disconnected',
    redis: 'disconnected',
    clickhouse: 'disconnected',
    vector: 'disconnected',
  };

  private constructor() {
    super();
    this.config = this.parseConfig();
    this.schemaManager = new PostgreSQLSchemaManager();
  }

  /**
   * Get singleton instance
   */
  static getInstance(): DatabaseManager {
    if (!DatabaseManager.instance) {
      DatabaseManager.instance = new DatabaseManager();
    }
    return DatabaseManager.instance;
  }

  /**
   * Initialize all database connections and schema
   */
  async initialize(): Promise<void> {
    try {
      logger.info('Initializing database connections...');

      // Initialize connections in parallel
      await Promise.all([
        this.initializePostgres(),
        this.initializeRedis(),
        this.initializeClickHouse(),
        this.initializeVector(),
      ]);

      // Initialize PostgreSQL schema after connection is established
      await this.initializeSchema();

      logger.info('All database connections and schema initialized successfully');
      this.emit('initialized');
    } catch (error: unknown) {
      logger.error('Failed to initialize databases:', error as Error);
      throw error;
    }
  }

  /**
   * Initialize PostgreSQL schema with migrations and partitions
   */
  async initializeSchema(): Promise<void> {
    try {
      logger.info('Initializing PostgreSQL schema...');
      
      // Run schema initialization (migrations, partitions, etc.)
      await this.schemaManager.initializeSchema();
      
      // Validate schema integrity
      const validation = await this.schemaManager.validateSchema();
      if (!validation.valid) {
        logger.warn('Schema validation issues found:', validation.issues);
      }
      
      // Log schema statistics
      const stats = await this.schemaManager.getSchemaStats();
      logger.info('Schema statistics:', stats);
      
      logger.info('PostgreSQL schema initialization completed');
    } catch (error) {
      logger.error('Schema initialization failed:', error);
      throw error;
    }
  }

  /**
   * Initialize PostgreSQL connection
   */
  private async initializePostgres(): Promise<void> {
    try {
      logger.info('Connecting to PostgreSQL...');
      
      this.postgresPool = new Pool({
        host: this.config.postgres.host,
        port: this.config.postgres.port,
        database: this.config.postgres.database,
        user: this.config.postgres.username,
        password: this.config.postgres.password,
        ssl: this.config.postgres.ssl,
        max: this.config.postgres.max,
        idleTimeoutMillis: this.config.postgres.idleTimeoutMillis,
        connectionTimeoutMillis: this.config.postgres.connectionTimeoutMillis,
      });

      // Test connection
      const client = await this.postgresPool.connect();
      await client.query('SELECT NOW()');
      client.release();

      this.status.postgres = 'connected';
      logger.info('PostgreSQL connected successfully');
      
      // Set up connection event handlers
      this.postgresPool.on('error', (error) => {
        logger.error('PostgreSQL connection error:', error);
        this.status.postgres = 'error';
        this.emit('postgres_error', error);
      });

      this.postgresPool.on('connect', () => {
        logger.debug('New PostgreSQL client connected');
      });

    } catch (error: unknown) {
      this.status.postgres = 'error';
      logger.error('Failed to connect to PostgreSQL:', error as Error);
      throw error;
    }
  }

  /**
   * Initialize Redis connection
   */
  private async initializeRedis(): Promise<void> {
    try {
      logger.info('Connecting to Redis...');
      
      this.redisClient = createClient({
        url: this.config.redis.url,
        socket: {
          reconnectStrategy: (retries) => Math.min(retries * 50, 500),
        },
      });

      // Set up event handlers
      this.redisClient.on('error', (error) => {
        logger.error('Redis connection error:', error);
        this.status.redis = 'error';
        this.emit('redis_error', error);
      });

      this.redisClient.on('connect', () => {
        logger.debug('Redis client connected');
        this.status.redis = 'connected';
      });

      this.redisClient.on('ready', () => {
        logger.info('Redis client ready');
      });

      this.redisClient.on('end', () => {
        logger.warn('Redis connection ended');
        this.status.redis = 'disconnected';
      });

      // Connect
      await this.redisClient.connect();

      // Test connection
      await this.redisClient.ping();
      
      this.status.redis = 'connected';
      logger.info('Redis connected successfully');
    } catch (error: unknown) {
      this.status.redis = 'error';
      logger.error('Failed to connect to Redis:', error as Error);
      throw error;
    }
  }

  /**
   * Initialize ClickHouse connection
   */
  private async initializeClickHouse(): Promise<void> {
    try {
      logger.info('Connecting to ClickHouse...');
      
      // For now, we'll use a simple HTTP client approach
      // In production, you'd use the official ClickHouse client
      this.clickhouseClient = {
        url: this.config.clickhouse.url,
        username: this.config.clickhouse.username,
        password: this.config.clickhouse.password,
        database: this.config.clickhouse.database,
      };

      // Test connection with a simple query
      await this.executeClickHouseQuery('SELECT 1');
      
      this.status.clickhouse = 'connected';
      logger.info('ClickHouse connected successfully');
    } catch (error: unknown) {
      this.status.clickhouse = 'error';
      logger.error('Failed to connect to ClickHouse:', error as Error);
      throw error;
    }
  }

  /**
   * Initialize Vector Database (Qdrant) connection
   */
  private async initializeVector(): Promise<void> {
    try {
      logger.info('Connecting to Vector Database (Qdrant)...');
      
      this.vectorClient = new QdrantClient({
        url: this.config.vector.url,
        apiKey: this.config.vector.apiKey,
      });

      // Test connection
      await this.vectorClient.getCollections();
      
      this.status.vector = 'connected';
      logger.info('Vector Database connected successfully');
    } catch (error: unknown) {
      this.status.vector = 'error';
      logger.error('Failed to connect to Vector Database:', error as Error);
      throw error;
    }
  }

  /**
   * Get PostgreSQL connection from pool
   */
  async getPostgresConnection(): Promise<PoolClient> {
    if (!this.postgresPool) {
      throw new Error('PostgreSQL not initialized');
    }
    return this.postgresPool.connect();
  }

  /**
   * Execute PostgreSQL query
   */
  async executePostgresQuery(query: string, params: any[] = []): Promise<any> {
    const client = await this.getPostgresConnection();
    try {
      const result = await client.query(query, params);
      return result.rows;
    } finally {
      client.release();
    }
  }

  /**
   * Get Redis client
   */
  getRedisClient(): RedisClientType {
    if (!this.redisClient) {
      throw new Error('Redis not initialized');
    }
    return this.redisClient;
  }

  /**
   * Execute Redis command
   */
  async executeRedisCommand(command: string, ...args: any[]): Promise<any> {
    const client = this.getRedisClient();
    return (client as any)[command](...args);
  }

  /**
   * Execute ClickHouse query
   */
  async executeClickHouseQuery(query: string, params: any = {}): Promise<any> {
    if (!this.clickhouseClient) {
      throw new Error('ClickHouse not initialized');
    }

    try {
      // Simple HTTP-based query execution
      const url = new URL('/?' + new URLSearchParams({
        query,
        database: this.config.clickhouse.database,
        ...params,
      }), this.config.clickhouse.url);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`ClickHouse query failed: ${response.statusText}`);
      }

      const text = await response.text();
      return text.trim().split('\n').map(line => {
        try {
          return JSON.parse(line);
        } catch {
          return line;
        }
      });
    } catch (error: unknown) {
      logger.error('ClickHouse query failed:', error as Error);
      throw error;
    }
  }

  /**
   * Get Vector Database client
   */
  getVectorClient(): any {
    if (!this.vectorClient) {
      throw new Error('Vector Database not initialized');
    }
    return this.vectorClient;
  }

  /**
   * Get connection status for all databases
   */
  getStatus(): DatabaseStatus {
    return { ...this.status };
  }

  /**
   * Health check for all databases
   */
  async healthCheck(): Promise<{ healthy: boolean; details: DatabaseStatus & { errors?: string[] | undefined } }> {
    const errors: string[] = [];
    const details = { ...this.status };

    try {
      // Check PostgreSQL
      if (this.postgresPool) {
        const client = await this.postgresPool.connect();
        await client.query('SELECT 1');
        client.release();
        details.postgres = 'connected';
      } else {
        errors.push('PostgreSQL not initialized');
        details.postgres = 'error';
      }
    } catch (error: unknown) {
      errors.push(`PostgreSQL: ${(error as Error).message}`);
      details.postgres = 'error';
    }

    try {
      // Check Redis
      if (this.redisClient) {
        await this.redisClient.ping();
        details.redis = 'connected';
      } else {
        errors.push('Redis not initialized');
        details.redis = 'error';
      }
    } catch (error: unknown) {
      errors.push(`Redis: ${(error as Error).message}`);
      details.redis = 'error';
    }

    try {
      // Check ClickHouse
      if (this.clickhouseClient) {
        await this.executeClickHouseQuery('SELECT 1');
        details.clickhouse = 'connected';
      } else {
        errors.push('ClickHouse not initialized');
        details.clickhouse = 'error';
      }
    } catch (error: unknown) {
      errors.push(`ClickHouse: ${(error as Error).message}`);
      details.clickhouse = 'error';
    }

    try {
      // Check Vector Database
      if (this.vectorClient) {
        await this.vectorClient.getCollections();
        details.vector = 'connected';
      } else {
        errors.push('Vector Database not initialized');
        details.vector = 'error';
      }
    } catch (error: unknown) {
      errors.push(`Vector Database: ${(error as Error).message}`);
      details.vector = 'error';
    }

    const healthy = errors.length === 0;
    return { healthy, details: { ...details, errors: errors.length > 0 ? errors : undefined } };
  }

  /**
   * Disconnect from all databases
   */
  async disconnect(): Promise<void> {
    logger.info('Disconnecting from all databases...');

    const disconnectPromises = [];

    // Disconnect PostgreSQL
    if (this.postgresPool) {
      disconnectPromises.push(
        this.postgresPool.end().then(() => {
          this.status.postgres = 'disconnected';
          logger.info('PostgreSQL disconnected');
        }).catch(error => {
          logger.error('Error disconnecting PostgreSQL:', error);
        })
      );
    }

    // Disconnect Redis
    if (this.redisClient) {
      disconnectPromises.push(
        this.redisClient.disconnect().then(() => {
          this.status.redis = 'disconnected';
          logger.info('Redis disconnected');
        }).catch(error => {
          logger.error('Error disconnecting Redis:', error);
        })
      );
    }

    // ClickHouse doesn't need explicit disconnect for HTTP client
    this.status.clickhouse = 'disconnected';

    // Vector Database doesn't need explicit disconnect
    this.status.vector = 'disconnected';

    await Promise.all(disconnectPromises);
    
    logger.info('All databases disconnected');
    this.emit('disconnected');
  }

  /**
   * Parse configuration from environment
   */
  private parseConfig(): DatabaseConfig {
    // Parse PostgreSQL URL
    const pgUrl = new URL(config.databaseUrl);
    
    return {
      postgres: {
        host: pgUrl.hostname,
        port: parseInt(pgUrl.port) || 5432,
        database: pgUrl.pathname.slice(1),
        username: pgUrl.username,
        password: pgUrl.password,
        ssl: config.nodeEnv === 'production',
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
      },
      redis: {
        url: config.redisUrl,
        maxRetriesPerRequest: 3,
        retryDelayOnFailover: 100,
      },
      clickhouse: {
        url: config.clickhouseUrl,
        database: 'yieldsensei_analytics',
        requestTimeout: 30000,
      },
      vector: {
        url: 'http://localhost:6333',
        timeout: 30000,
      },
    };
  }

  /**
   * Get schema manager for advanced operations
   */
  getSchemaManager(): PostgreSQLSchemaManager {
    return this.schemaManager;
  }

  /**
   * Get partition information
   */
  async getPartitionInfo() {
    return this.schemaManager.getPartitionInfo();
  }

  /**
   * Validate schema integrity
   */
  async validateSchema() {
    return this.schemaManager.validateSchema();
  }

  /**
   * Get schema statistics
   */
  async getSchemaStats() {
    return this.schemaManager.getSchemaStats();
  }
}

/**
 * Database query builders and utilities
 */
export class DatabaseUtils {
  /**
   * Build parameterized PostgreSQL query
   */
  static buildPostgresQuery(query: string, params: Record<string, any>): { query: string; values: any[] } {
    let paramIndex = 1;
    const values: any[] = [];
    const paramMap: Record<string, string> = {};

    // Replace named parameters with $1, $2, etc.
    const processedQuery = query.replace(/:(\w+)/g, (_match, paramName) => {
      if (!(paramName in paramMap)) {
        paramMap[paramName] = `${paramIndex++}`;
        values.push(params[paramName]);
      }
      return paramMap[paramName] || '';
    });

    return { query: processedQuery, values };
  }

  /**
   * Build ClickHouse INSERT query
   */
  static buildClickHouseInsert(table: string, data: Record<string, any>[]): string {
    if (data.length === 0 || !data[0]) return '';

    const columns = Object.keys(data[0]);
    const values = data.map(row => 
      `(${columns.map(col => {
        const value = row[col];
        if (typeof value === 'string') {
          return `'${value.replace(/'/g, "''")}'`;
        }
        return value;
      }).join(', ')})`
    ).join(', ');

    return `INSERT INTO ${table} (${columns.join(', ')}) VALUES ${values}`;
  }
}