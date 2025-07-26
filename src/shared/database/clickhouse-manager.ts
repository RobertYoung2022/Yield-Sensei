/**
 * YieldSensei ClickHouse Manager
 * High-performance time-series analytics database for DeFi data
 */

import { ClickHouseClient } from '@clickhouse/client';
import Logger from '@/shared/logging/logger';
// Note: config import removed as it was unused
import { EventEmitter } from 'events';

const logger = Logger.getLogger('clickhouse-manager');

export interface ClickHouseConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
  compression: boolean;
  max_execution_time: number;
  max_memory_usage: number;
}

export interface QueryResult<T = any> {
  data: T[];
  rows: number;
  statistics: {
    elapsed: number;
    rows_read: number;
    bytes_read: number;
  };
}

export interface PriceDataPoint {
  timestamp: Date;
  asset_id: string;
  chain_id: number;
  protocol_id: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  volume_usd: number;
  market_cap: number;
}

export interface PoolMetrics {
  timestamp: Date;
  pool_id: string;
  protocol_id: string;
  chain_id: number;
  tvl_usd: number;
  volume_24h_usd: number;
  fees_24h_usd: number;
  token0_symbol: string;
  token1_symbol: string;
}

export interface YieldOpportunity {
  timestamp: Date;
  protocol_id: string;
  pool_id: string;
  asset_symbol: string;
  apy: number;
  tvl_usd: number;
  risk_score: number;
  strategy_type: string;
}

/**
 * ClickHouse manager for high-performance analytics
 */
export class ClickHouseManager extends EventEmitter {
  private static instance: ClickHouseManager;
  private client: ClickHouseClient;
  private config: ClickHouseConfig;
  private connected: boolean = false;

  private constructor() {
    super();
    this.config = this.parseConfig();
    this.client = this.createClient();
  }

  public static getInstance(): ClickHouseManager {
    if (!ClickHouseManager.instance) {
      ClickHouseManager.instance = new ClickHouseManager();
    }
    return ClickHouseManager.instance;
  }

  /**
   * Parse ClickHouse configuration from environment
   */
  private parseConfig(): ClickHouseConfig {
    return {
      host: process.env.CLICKHOUSE_HOST || 'localhost',
      port: parseInt(process.env.CLICKHOUSE_PORT || '8123'),
      username: process.env.CLICKHOUSE_USER || 'yieldsensei',
      password: process.env.CLICKHOUSE_PASSWORD || 'changeme_in_production',
      database: process.env.CLICKHOUSE_DATABASE || 'yieldsensei',
      compression: true,
      max_execution_time: 300,
      max_memory_usage: 10000000000, // 10GB
    };
  }

  /**
   * Create ClickHouse client instance
   */
  private createClient(): ClickHouseClient {
    return new ClickHouseClient({
      host: `http://${this.config.host}:${this.config.port}`,
      username: this.config.username,
      password: this.config.password,
      database: this.config.database,
      compression: {
        response: this.config.compression,
        request: this.config.compression,
      },
      session_timeout: 30000,
      request_timeout: 60000,
      settings: {
        max_execution_time: this.config.max_execution_time,
        max_memory_usage: this.config.max_memory_usage,
        use_uncompressed_cache: 1,
        max_threads: 8,
      },
    });
  }

  /**
   * Initialize ClickHouse connection and schema
   */
  async initialize(): Promise<void> {
    try {
      logger.info('Initializing ClickHouse connection...');
      
      // Test connection
      await this.ping();
      
      // Initialize schema if needed
      await this.initializeSchema();
      
      this.connected = true;
      logger.info('ClickHouse initialized successfully');
      this.emit('connected');
    } catch (error) {
      logger.error('Failed to initialize ClickHouse:', error);
      throw error;
    }
  }

  /**
   * Test ClickHouse connection
   */
  async ping(): Promise<boolean> {
    try {
      const result = await this.client.ping();
      logger.info('ClickHouse ping successful');
      return result.success;
    } catch (error) {
      logger.error('ClickHouse ping failed:', error);
      throw error;
    }
  }

  /**
   * Initialize database schema
   */
  private async initializeSchema(): Promise<void> {
    try {
      logger.info('Initializing ClickHouse schema...');
      
      // Check if database exists
      const dbExists = await this.query<{ name: string }>(`
        SELECT name FROM system.databases WHERE name = '${this.config.database}'
      `);
      
      if (dbExists.data.length === 0) {
        logger.info('Creating ClickHouse database...');
        await this.client.exec({
          query: `CREATE DATABASE IF NOT EXISTS ${this.config.database}`,
        });
      }

      // Check if core tables exist
      const tables = await this.query<{ name: string }>(`
        SELECT name FROM system.tables 
        WHERE database = '${this.config.database}' 
        AND name IN ('price_data_raw', 'liquidity_pools', 'yield_history')
      `);

      if (tables.data.length < 3) {
        logger.warn('Core tables missing. Please run schema initialization scripts.');
      }

      logger.info('ClickHouse schema initialization complete');
    } catch (error) {
      logger.error('Schema initialization failed:', error);
      throw error;
    }
  }

  /**
   * Execute a query and return results
   */
  async query<T = any>(query: string, params?: Record<string, any>): Promise<QueryResult<T>> {
    const startTime = Date.now();
    
    try {
      logger.debug(`Executing query: ${query.substring(0, 100)}...`);
      
      const result = await this.client.query({
        query,
        query_params: params,
        format: 'JSONEachRow',
      });

      const data = await result.json<T>();
      const statistics = {
        elapsed: Date.now() - startTime,
        rows_read: data.length,
        bytes_read: 0, // ClickHouse doesn't provide this in simple queries
      };

      logger.debug(`Query completed in ${statistics.elapsed}ms, ${statistics.rows_read} rows`);
      
      return {
        data: Array.isArray(data) ? data : [data],
        rows: statistics.rows_read,
        statistics,
      };
    } catch (error) {
      logger.error('Query execution failed:', error);
      throw error;
    }
  }

  /**
   * Insert data into a table
   */
  async insert<T>(table: string, data: T[]): Promise<void> {
    if (!data || data.length === 0) {
      logger.warn(`No data provided for insert into ${table}`);
      return;
    }

    try {
      logger.debug(`Inserting ${data.length} rows into ${table}`);
      
      await this.client.insert({
        table: `${this.config.database}.${table}`,
        values: data,
        format: 'JSONEachRow',
      });

      logger.debug(`Successfully inserted ${data.length} rows into ${table}`);
    } catch (error) {
      logger.error(`Failed to insert data into ${table}:`, error);
      throw error;
    }
  }

  /**
   * Batch insert with automatic chunking
   */
  async batchInsert<T>(table: string, data: T[], batchSize: number = 10000): Promise<void> {
    if (!data || data.length === 0) return;

    const chunks = [];
    for (let i = 0; i < data.length; i += batchSize) {
      chunks.push(data.slice(i, i + batchSize));
    }

    logger.info(`Batch inserting ${data.length} rows into ${table} in ${chunks.length} chunks`);

    for (let i = 0; i < chunks.length; i++) {
      await this.insert(table, chunks[i]);
      logger.debug(`Inserted chunk ${i + 1}/${chunks.length}`);
    }

    logger.info(`Batch insert completed for ${table}`);
  }

  // =============================================================================
  // SPECIALIZED ANALYTICS METHODS
  // =============================================================================

  /**
   * Get latest price data for assets
   */
  async getLatestPrices(assetIds?: string[]): Promise<PriceDataPoint[]> {
    let whereClause = '';
    if (assetIds && assetIds.length > 0) {
      whereClause = `WHERE asset_id IN (${assetIds.map(id => `'${id}'`).join(',')})`;
    }

    const query = `
      SELECT 
        timestamp,
        asset_id,
        chain_id,
        protocol_id,
        open,
        high,
        low,
        close,
        volume,
        volume_usd,
        market_cap
      FROM ${this.config.database}.price_data_raw
      ${whereClause}
      ORDER BY timestamp DESC
      LIMIT 1000
    `;

    const result = await this.query<PriceDataPoint>(query);
    return result.data;
  }

  /**
   * Get top performing pools by volume
   */
  async getTopPoolsByVolume(limit: number = 50): Promise<PoolMetrics[]> {
    const query = `
      SELECT 
        timestamp,
        pool_id,
        protocol_id,
        chain_id,
        tvl_usd,
        volume_24h_usd,
        fees_24h_usd,
        token0_symbol,
        token1_symbol
      FROM ${this.config.database}.mv_top_pools_by_volume
      WHERE timestamp >= now() - INTERVAL 1 HOUR
      ORDER BY volume_24h_usd DESC
      LIMIT ${limit}
    `;

    const result = await this.query<PoolMetrics>(query);
    return result.data;
  }

  /**
   * Get best yield opportunities
   */
  async getBestYieldOpportunities(strategyType?: string, minTvl?: number): Promise<YieldOpportunity[]> {
    let whereClause = 'WHERE tvl_usd > 1000 AND apy < 1000';
    
    if (strategyType) {
      whereClause += ` AND strategy_type = '${strategyType}'`;
    }
    
    if (minTvl) {
      whereClause += ` AND tvl_usd >= ${minTvl}`;
    }

    const query = `
      SELECT 
        timestamp,
        protocol_id,
        pool_id,
        asset_symbol,
        apy,
        tvl_usd,
        overall_risk_score as risk_score,
        strategy_type
      FROM ${this.config.database}.yield_history
      ${whereClause}
      ORDER BY (apy * (1 - overall_risk_score)) DESC
      LIMIT 100
    `;

    const result = await this.query<YieldOpportunity>(query);
    return result.data;
  }

  /**
   * Get protocol TVL trends
   */
  async getProtocolTVLTrends(protocolId: string, days: number = 30): Promise<any[]> {
    const query = `
      SELECT 
        timestamp,
        protocol_id,
        total_tvl_usd,
        tvl_change_24h,
        pool_count,
        active_pools
      FROM ${this.config.database}.mv_protocol_tvl_realtime
      WHERE protocol_id = '${protocolId}'
        AND timestamp >= now() - INTERVAL ${days} DAY
      ORDER BY timestamp ASC
    `;

    const result = await this.query(query);
    return result.data;
  }

  /**
   * Get market sentiment for asset
   */
  async getMarketSentiment(assetId: string, hours: number = 24): Promise<any[]> {
    const query = `
      SELECT 
        timestamp,
        asset_id,
        overall_sentiment,
        total_mentions,
        trending_score,
        bullish_ratio,
        bearish_ratio
      FROM ${this.config.database}.mv_sentiment_trends
      WHERE asset_id = '${assetId}'
        AND timestamp >= now() - INTERVAL ${hours} HOUR
      ORDER BY timestamp DESC
    `;

    const result = await this.query(query);
    return result.data;
  }

  /**
   * Get query performance statistics
   */
  async getQueryPerformanceStats(days: number = 7): Promise<any[]> {
    const query = `
      SELECT 
        date,
        query_kind,
        avg_duration_ms,
        p95_duration_ms,
        total_queries,
        success_rate,
        avg_memory_usage
      FROM ${this.config.database}.mv_query_performance_stats
      WHERE date >= today() - ${days}
      ORDER BY date DESC, avg_duration_ms DESC
    `;

    const result = await this.query(query);
    return result.data;
  }

  /**
   * Optimize table performance
   */
  async optimizeTable(tableName: string): Promise<void> {
    try {
      logger.info(`Optimizing table ${tableName}...`);
      
      await this.client.exec({
        query: `OPTIMIZE TABLE ${this.config.database}.${tableName} FINAL`,
      });

      logger.info(`Table ${tableName} optimization completed`);
    } catch (error) {
      logger.error(`Failed to optimize table ${tableName}:`, error);
      throw error;
    }
  }

  /**
   * Get database statistics
   */
  async getDatabaseStats(): Promise<any> {
    const queries = [
      // Table sizes
      `SELECT 
        table,
        formatReadableSize(sum(bytes)) as size,
        sum(rows) as rows,
        count() as parts
      FROM system.parts 
      WHERE database = '${this.config.database}' 
      GROUP BY table 
      ORDER BY sum(bytes) DESC`,

      // Recent query performance
      `SELECT 
        avg(query_duration_ms) as avg_duration,
        quantile(0.95)(query_duration_ms) as p95_duration,
        count() as total_queries
      FROM system.query_log 
      WHERE event_date >= today() - 1 
        AND type = 'QueryFinish'`,
    ];

    const [tableSizes, queryStats] = await Promise.all([
      this.query(queries[0]),
      this.query(queries[1]),
    ]);

    return {
      tableSizes: tableSizes.data,
      queryStats: queryStats.data[0] || {},
      connected: this.connected,
      config: {
        host: this.config.host,
        port: this.config.port,
        database: this.config.database,
      },
    };
  }

  /**
   * Close the connection
   */
  async close(): Promise<void> {
    try {
      await this.client.close();
      this.connected = false;
      logger.info('ClickHouse connection closed');
      this.emit('disconnected');
    } catch (error) {
      logger.error('Error closing ClickHouse connection:', error);
      throw error;
    }
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Get raw client for advanced operations
   */
  getClient(): ClickHouseClient {
    return this.client;
  }
} 