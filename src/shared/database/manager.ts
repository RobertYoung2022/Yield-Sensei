/**
 * YieldSensei Database Manager
 * Manages connections to PostgreSQL, ClickHouse, Redis, and Vector DB
 */

import { Pool, PoolClient } from 'pg';
import Logger from '@/shared/logging/logger';
import { config } from '@/config/environment';
import { EventEmitter } from 'events';
import { PostgreSQLSchemaManager } from './schema-manager';
import { ClickHouseManager } from './clickhouse-manager';
import { RedisManager, RedisConfig } from './redis-manager-simple';
import { VectorManager, VectorConfig } from './vector-manager';
import { DatabaseIntegrationManager } from './integration-manager';
import { CDCManager } from './cdc-manager';
import { UnifiedQueryManager } from './unified-query';

const logger = Logger.getLogger('database');

export interface DatabaseConfig {
  postgres: {
    host: string;
    port: number;
    database: string;
    username: string;
    password: string;
    ssl?: boolean;
    max?: number;
  };
  redis: {
    host: string;
    port: number;
    password?: string;
    db?: number;
  };
  clickhouse: {
    host: string;
    port: number;
    database: string;
    username: string;
    password: string;
  };
  vector: VectorConfig;
}

export interface DatabaseStatus {
  postgres: 'connected' | 'disconnected' | 'error';
  redis: 'connected' | 'disconnected' | 'error';
  clickhouse: 'connected' | 'disconnected' | 'error';
  vector: 'connected' | 'disconnected' | 'error';
}

export class DatabaseManager extends EventEmitter {
  private static instance: DatabaseManager;
  private config: DatabaseConfig;
  private schemaManager: PostgreSQLSchemaManager;
  private clickhouseManager: ClickHouseManager;
  private redisManager: RedisManager;
  
  // Integration components
  private integrationManager: DatabaseIntegrationManager;
  private cdcManager: CDCManager;
  private unifiedQueryManager: UnifiedQueryManager;
  
  // Connection instances
  private postgresPool: Pool | null = null;
  private clickhouseClient: any | null = null; // ClickHouse client
  private vectorManager: VectorManager | null = null;
  
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
    this.clickhouseManager = ClickHouseManager.getInstance();
    
    // Initialize integration components
    this.integrationManager = DatabaseIntegrationManager.getInstance();
    this.cdcManager = CDCManager.getInstance();
    this.unifiedQueryManager = UnifiedQueryManager.getInstance();
    
    // Initialize Redis manager with config
    const redisConfig: RedisConfig = {
      host: this.config.redis.host,
      port: this.config.redis.port,
      db: this.config.redis.db,
      keyPrefix: 'yieldsensei:',
    };
    
    // Add password if it exists
    if (this.config.redis.password) {
      redisConfig.password = this.config.redis.password;
    }
    
    this.redisManager = RedisManager.getInstance(redisConfig);
  }

  public static getInstance(): DatabaseManager {
    if (!DatabaseManager.instance) {
      DatabaseManager.instance = new DatabaseManager();
    }
    return DatabaseManager.instance;
  }

  /**
   * Parse database configuration from environment variables
   */
  private parseConfig(): DatabaseConfig {
    return {
      postgres: {
        host: process.env['POSTGRES_HOST'] || 'localhost',
        port: parseInt(process.env['POSTGRES_PORT'] || '5432'),
        database: process.env['POSTGRES_DB'] || 'yieldsensei',
        username: process.env['POSTGRES_USER'] || 'yieldsensei_app',
        password: process.env['POSTGRES_PASSWORD'] || 'changeme_in_production',
        ssl: process.env['POSTGRES_SSL'] === 'true',
        max: parseInt(process.env['POSTGRES_MAX_CONNECTIONS'] || '20'),
      },
      redis: {
        host: process.env['REDIS_HOST'] || 'localhost',
        port: parseInt(process.env['REDIS_PORT'] || '6379'),
        password: process.env['REDIS_PASSWORD'] || undefined,
        db: parseInt(process.env['REDIS_DB'] || '0'),
      },
      clickhouse: {
        host: process.env.CLICKHOUSE_HOST || 'localhost',
        port: parseInt(process.env.CLICKHOUSE_PORT || '8123'),
        database: process.env.CLICKHOUSE_DATABASE || 'yieldsensei',
        username: process.env.CLICKHOUSE_USER || 'yieldsensei',
        password: process.env.CLICKHOUSE_PASSWORD || 'changeme_in_production',
      },
              vector: {
          host: config.vectorDbHost,
          port: config.vectorDbPort,
          apiKey: config.vectorDbApiKey,
        },
    };
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
        ssl: this.config.postgres.ssl ? { rejectUnauthorized: false } : false,
        max: this.config.postgres.max,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
      });

      // Test connection
      const client = await this.postgresPool.connect();
      await client.query('SELECT NOW()');
      client.release();

      this.status.postgres = 'connected';
      logger.info('PostgreSQL connected successfully');
    } catch (error) {
      this.status.postgres = 'error';
      logger.error('Failed to connect to PostgreSQL:', error);
      throw error;
    }
  }

  /**
   * Initialize Redis connection using RedisManager
   */
  private async initializeRedis(): Promise<void> {
    try {
      logger.info('Connecting to Redis...');
      
      // Set up Redis manager event listeners
      this.redisManager.on('error', (err) => {
        logger.error('Redis Manager Error:', err);
        this.status.redis = 'error';
      });

      this.redisManager.on('connected', () => {
        this.status.redis = 'connected';
        logger.info('Redis connected successfully via RedisManager');
      });

      this.redisManager.on('disconnected', () => {
        this.status.redis = 'disconnected';
        logger.warn('Redis disconnected');
      });

      // Connect to Redis
      await this.redisManager.connect();
      
      // Test connection
      const healthCheck = await this.redisManager.healthCheck();
      if (healthCheck.status !== 'healthy') {
        throw new Error(`Redis health check failed: ${healthCheck.status}`);
      }

      logger.info(`Redis connected successfully (latency: ${healthCheck.latency}ms)`);
    } catch (error) {
      this.status.redis = 'error';
      logger.error('Failed to connect to Redis:', error);
      throw error;
    }
  }

  /**
   * Initialize ClickHouse connection
   */
  private async initializeClickHouse(): Promise<void> {
    try {
      logger.info('Connecting to ClickHouse...');
      
      await this.clickhouseManager.initialize();
      
      this.status.clickhouse = 'connected';
      logger.info('ClickHouse connected successfully');
    } catch (error) {
      this.status.clickhouse = 'error';
      logger.error('Failed to connect to ClickHouse:', error);
      throw error;
    }
  }

    /**
   * Initialize Vector DB connection
   */
  private async initializeVector(): Promise<void> {
    try {
      logger.info('Connecting to Vector DB...');
      
      this.vectorManager = VectorManager.getInstance(this.config.vector);
      await this.vectorManager.connect();
      
      this.status.vector = 'connected';
      logger.info('Vector DB connected successfully');
    } catch (error) {
      this.status.vector = 'error';
      logger.error('Failed to connect to Vector DB:', error);
      throw error;
    }
  }

  /**
   * Initialize PostgreSQL schema with migrations and partitions
   */
  private async initializeSchema(): Promise<void> {
    try {
      logger.info('Initializing PostgreSQL schema...');
      
      if (!this.postgresPool) {
        throw new Error('PostgreSQL connection not available');
      }

      await this.schemaManager.runMigrations(this.postgresPool);
      await this.schemaManager.createPartitions(this.postgresPool);
      
      logger.info('PostgreSQL schema initialization completed');
    } catch (error) {
      logger.error('Schema initialization failed:', error);
      throw error;
    }
  }

  // =============================================================================
  // CONNECTION GETTERS
  // =============================================================================

  /**
   * Get PostgreSQL connection pool
   */
  getPostgres(): Pool {
    if (!this.postgresPool) {
      throw new Error('PostgreSQL connection not initialized');
    }
    return this.postgresPool;
  }

  /**
   * Get Redis client
   */
  getRedis(): RedisClientType {
    if (!this.redisClient) {
      throw new Error('Redis connection not initialized');
    }
    return this.redisClient;
  }

  /**
   * Get ClickHouse manager
   */
  getClickHouse(): ClickHouseManager {
    if (!this.clickhouseManager.isConnected()) {
      throw new Error('ClickHouse connection not initialized');
    }
    return this.clickhouseManager;
  }

  /**
   * Get Vector DB manager
   */
  getVector(): VectorManager {
    if (!this.vectorManager) {
      throw new Error('Vector DB connection not initialized');
    }
    return this.vectorManager;
  }

  /**
   * Get integration manager
   */
  getIntegrationManager(): DatabaseIntegrationManager {
    return this.integrationManager;
  }

  /**
   * Get CDC manager
   */
  getCDCManager(): CDCManager {
    return this.cdcManager;
  }

  /**
   * Get unified query manager
   */
  getUnifiedQueryManager(): UnifiedQueryManager {
    return this.unifiedQueryManager;
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

  /**
   * Get overall database status
   */
  getStatus(): DatabaseStatus {
    return { ...this.status };
  }

  /**
   * Check if all databases are connected
   */
  isHealthy(): boolean {
    return Object.values(this.status).every(status => status === 'connected');
  }

  /**
   * Get database health metrics
   */
  async getHealthMetrics(): Promise<any> {
    const metrics: any = {
      status: this.getStatus(),
      timestamp: new Date().toISOString(),
    };

    try {
      // PostgreSQL metrics
      if (this.status.postgres === 'connected' && this.postgresPool) {
        const client = await this.postgresPool.connect();
        const pgStats = await client.query(`
          SELECT 
            numbackends as active_connections,
            xact_commit as transactions_committed,
            xact_rollback as transactions_rolled_back,
            blks_read as blocks_read,
            blks_hit as blocks_hit,
            tup_returned as tuples_returned,
            tup_fetched as tuples_fetched
          FROM pg_stat_database 
          WHERE datname = current_database()
        `);
        client.release();
        metrics.postgres = pgStats.rows[0];
      }

      // Redis metrics
      if (this.status.redis === 'connected' && this.redisClient) {
        const redisInfo = await this.redisClient.info();
        metrics.redis = {
          connected_clients: redisInfo.match(/connected_clients:(\d+)/)?.[1] || '0',
          used_memory: redisInfo.match(/used_memory:(\d+)/)?.[1] || '0',
          keyspace_hits: redisInfo.match(/keyspace_hits:(\d+)/)?.[1] || '0',
          keyspace_misses: redisInfo.match(/keyspace_misses:(\d+)/)?.[1] || '0',
        };
      }

      // ClickHouse metrics
      if (this.status.clickhouse === 'connected') {
        metrics.clickhouse = await this.clickhouseManager.getDatabaseStats();
      }

    } catch (error) {
      logger.error('Error collecting health metrics:', error);
      metrics.error = 'Failed to collect some metrics';
    }

    return metrics;
  }

  /**
   * Close all database connections
   */
  async close(): Promise<void> {
    logger.info('Closing all database connections...');

    const closePromises = [];

    if (this.postgresPool) {
      closePromises.push(this.postgresPool.end());
    }

    if (this.redisClient) {
      closePromises.push(this.redisClient.disconnect());
    }

    if (this.clickhouseManager.isConnected()) {
      closePromises.push(this.clickhouseManager.close());
    }

    try {
      await Promise.all(closePromises);
      
      // Reset status
      this.status = {
        postgres: 'disconnected',
        redis: 'disconnected',
        clickhouse: 'disconnected',
        vector: 'disconnected',
      };

      logger.info('All database connections closed successfully');
      this.emit('closed');
    } catch (error) {
      logger.error('Error closing database connections:', error);
      throw error;
    }
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