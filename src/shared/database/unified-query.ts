/**
 * YieldSensei Unified Query Layer
 * 
 * Provides a single interface for querying across all database systems:
 * - PostgreSQL (transactional queries)
 * - ClickHouse (analytics queries)
 * - Redis (cache queries)
 * - Vector DB (similarity search queries)
 */

import { Pool } from 'pg';
import Logger from '@/shared/logging/logger';
import { DatabaseManager } from './manager';
import { ClickHouseManager } from './clickhouse-manager';
import { RedisManager } from './redis-manager-simple';
import { VectorManager } from './vector-manager';

const logger = Logger.getLogger('unified-query');

// =============================================================================
// INTERFACES AND TYPES
// =============================================================================

export interface QueryRequest {
  query: string;
  type: 'transactional' | 'analytics' | 'cache' | 'vector' | 'unified';
  parameters?: Record<string, any>;
  timeout?: number;
  cache?: boolean;
  cacheTTL?: number;
}

export interface QueryResult {
  data: any[];
  metadata: {
    source: 'postgres' | 'clickhouse' | 'redis' | 'vector' | 'unified';
    executionTime: number;
    recordCount: number;
    cached: boolean;
    timestamp: Date;
  };
  error?: string;
}

export interface UnifiedQueryPlan {
  queries: Array<{
    database: 'postgres' | 'clickhouse' | 'redis' | 'vector';
    query: string;
    parameters?: Record<string, any>;
  }>;
  aggregation: 'union' | 'join' | 'merge' | 'none';
  joinKey?: string;
}

export interface QueryCache {
  key: string;
  data: any[];
  timestamp: Date;
  ttl: number;
}

// =============================================================================
// UNIFIED QUERY MANAGER
// =============================================================================

export class UnifiedQueryManager {
  private static instance: UnifiedQueryManager;
  private dbManager: DatabaseManager;
  private cache: Map<string, QueryCache> = new Map();
  private queryPatterns: Map<string, UnifiedQueryPlan> = new Map();

  private constructor() {
    this.dbManager = DatabaseManager.getInstance();
    this.initializeQueryPatterns();
  }

  public static getInstance(): UnifiedQueryManager {
    if (!UnifiedQueryManager.instance) {
      UnifiedQueryManager.instance = new UnifiedQueryManager();
    }
    return UnifiedQueryManager.instance;
  }

  /**
   * Execute a unified query across databases
   */
  async executeQuery(request: QueryRequest): Promise<QueryResult> {
    const startTime = Date.now();
    
    try {
      logger.info(`Executing ${request.type} query: ${request.query.substring(0, 100)}...`);

      // Check cache first
      if (request.cache !== false) {
        const cachedResult = this.getCachedResult(request);
        if (cachedResult) {
          return {
            data: cachedResult.data,
            metadata: {
              source: 'unified',
              executionTime: Date.now() - startTime,
              recordCount: cachedResult.data.length,
              cached: true,
              timestamp: new Date()
            }
          };
        }
      }

      let result: QueryResult;

      // Route query based on type
      switch (request.type) {
        case 'transactional':
          result = await this.executeTransactionalQuery(request);
          break;
        case 'analytics':
          result = await this.executeAnalyticsQuery(request);
          break;
        case 'cache':
          result = await this.executeCacheQuery(request);
          break;
        case 'vector':
          result = await this.executeVectorQuery(request);
          break;
        case 'unified':
          result = await this.executeUnifiedQuery(request);
          break;
        default:
          throw new Error(`Unsupported query type: ${request.type}`);
      }

      // Cache result if requested
      if (request.cache !== false) {
        this.cacheResult(request, result.data, request.cacheTTL || 300);
      }

      return result;

    } catch (error) {
      logger.error('Query execution failed:', error);
      return {
        data: [],
        metadata: {
          source: 'unified',
          executionTime: Date.now() - startTime,
          recordCount: 0,
          cached: false,
          timestamp: new Date()
        },
        error: (error as Error).message
      };
    }
  }

  /**
   * Execute transactional query (PostgreSQL)
   */
  private async executeTransactionalQuery(request: QueryRequest): Promise<QueryResult> {
    const startTime = Date.now();
    const postgres = this.dbManager.getPostgres();

    try {
      const result = await postgres.query(request.query, Object.values(request.parameters || {}));
      
      return {
        data: result.rows,
        metadata: {
          source: 'postgres',
          executionTime: Date.now() - startTime,
          recordCount: result.rows.length,
          cached: false,
          timestamp: new Date()
        }
      };
    } catch (error) {
      throw new Error(`PostgreSQL query failed: ${(error as Error).message}`);
    }
  }

  /**
   * Execute analytics query (ClickHouse)
   */
  private async executeAnalyticsQuery(request: QueryRequest): Promise<QueryResult> {
    const startTime = Date.now();
    const clickhouse = this.dbManager.getClickHouse();

    try {
      const result = await clickhouse.query(request.query);
      
      return {
        data: result.data,
        metadata: {
          source: 'clickhouse',
          executionTime: Date.now() - startTime,
          recordCount: result.data.length,
          cached: false,
          timestamp: new Date()
        }
      };
    } catch (error) {
      throw new Error(`ClickHouse query failed: ${(error as Error).message}`);
    }
  }

  /**
   * Execute cache query (Redis)
   */
  private async executeCacheQuery(request: QueryRequest): Promise<QueryResult> {
    const startTime = Date.now();
    const redis = this.dbManager.getRedis();

    try {
      const pattern = request.query; // For Redis, query is the pattern
      const keys = await redis.keys(pattern);
      const results = [];

      for (const key of keys) {
        const value = await redis.get(key);
        if (value) {
          try {
            results.push(JSON.parse(value));
          } catch {
            results.push({ key, value });
          }
        }
      }

      return {
        data: results,
        metadata: {
          source: 'redis',
          executionTime: Date.now() - startTime,
          recordCount: results.length,
          cached: false,
          timestamp: new Date()
        }
      };
    } catch (error) {
      throw new Error(`Redis query failed: ${(error as Error).message}`);
    }
  }

  /**
   * Execute vector query (Vector DB)
   */
  private async executeVectorQuery(request: QueryRequest): Promise<QueryResult> {
    const startTime = Date.now();
    const vector = this.dbManager.getVector();

    try {
      const searchParams = this.parseVectorQuery(request.query);
      const results = await vector.search(searchParams);

      return {
        data: results,
        metadata: {
          source: 'vector',
          executionTime: Date.now() - startTime,
          recordCount: results.length,
          cached: false,
          timestamp: new Date()
        }
      };
    } catch (error) {
      throw new Error(`Vector query failed: ${(error as Error).message}`);
    }
  }

  /**
   * Execute unified query across multiple databases
   */
  private async executeUnifiedQuery(request: QueryRequest): Promise<QueryResult> {
    const startTime = Date.now();

    try {
      // Parse query to determine execution plan
      const plan = this.parseUnifiedQuery(request.query);
      
      // Execute queries in parallel
      const queryPromises = plan.queries.map(async (query) => {
        switch (query.database) {
          case 'postgres':
            return await this.executeTransactionalQuery({
              ...request,
              query: query.query,
              parameters: query.parameters
            });
          case 'clickhouse':
            return await this.executeAnalyticsQuery({
              ...request,
              query: query.query
            });
          case 'redis':
            return await this.executeCacheQuery({
              ...request,
              query: query.query
            });
          case 'vector':
            return await this.executeVectorQuery({
              ...request,
              query: query.query
            });
          default:
            throw new Error(`Unsupported database: ${query.database}`);
        }
      });

      const results = await Promise.all(queryPromises);
      
      // Aggregate results
      const aggregatedData = this.aggregateResults(
        results.map(r => r.data),
        plan.aggregation,
        plan.joinKey
      );

      return {
        data: aggregatedData,
        metadata: {
          source: 'unified',
          executionTime: Date.now() - startTime,
          recordCount: aggregatedData.length,
          cached: false,
          timestamp: new Date()
        }
      };

    } catch (error) {
      throw new Error(`Unified query failed: ${(error as Error).message}`);
    }
  }

  /**
   * Parse unified query to determine execution plan
   */
  private parseUnifiedQuery(query: string): UnifiedQueryPlan {
    // Check for predefined patterns
    const pattern = this.queryPatterns.get(query);
    if (pattern) {
      return pattern;
    }

    // Simple query parsing (in production, use a proper SQL parser)
    const queries: Array<{
      database: 'postgres' | 'clickhouse' | 'redis' | 'vector';
      query: string;
      parameters?: Record<string, any>;
    }> = [];

    let aggregation: 'union' | 'join' | 'merge' | 'none' = 'none';
    let joinKey: string | undefined;

    // Detect query type based on keywords
    if (query.toLowerCase().includes('select') && query.toLowerCase().includes('from')) {
      if (query.toLowerCase().includes('transaction') || query.toLowerCase().includes('user')) {
        queries.push({ database: 'postgres', query });
      } else if (query.toLowerCase().includes('price') || query.toLowerCase().includes('analytics')) {
        queries.push({ database: 'clickhouse', query });
      }
    } else if (query.includes('*')) {
      queries.push({ database: 'redis', query });
    } else if (query.toLowerCase().includes('similar') || query.toLowerCase().includes('embedding')) {
      queries.push({ database: 'vector', query });
    }

    // Detect aggregation type
    if (query.toLowerCase().includes('union')) {
      aggregation = 'union';
    } else if (query.toLowerCase().includes('join')) {
      aggregation = 'join';
    } else if (queries.length > 1) {
      aggregation = 'merge';
    }

    return { queries, aggregation, joinKey };
  }

  /**
   * Aggregate results from multiple databases
   */
  private aggregateResults(
    dataArrays: any[][],
    aggregation: 'union' | 'join' | 'merge' | 'none',
    joinKey?: string
  ): any[] {
    if (dataArrays.length === 0) return [];
    if (dataArrays.length === 1) return dataArrays[0];

    switch (aggregation) {
      case 'union':
        return this.unionResults(dataArrays);
      case 'join':
        return this.joinResults(dataArrays, joinKey);
      case 'merge':
        return this.mergeResults(dataArrays);
      default:
        return dataArrays.flat();
    }
  }

  /**
   * Union results (remove duplicates)
   */
  private unionResults(dataArrays: any[][]): any[] {
    const seen = new Set();
    const result: any[] = [];

    for (const array of dataArrays) {
      for (const item of array) {
        const key = item.id || item.transaction_id || item.user_id || JSON.stringify(item);
        if (!seen.has(key)) {
          seen.add(key);
          result.push(item);
        }
      }
    }

    return result;
  }

  /**
   * Join results on common key
   */
  private joinResults(dataArrays: any[][], joinKey?: string): any[] {
    if (!joinKey || dataArrays.length < 2) {
      return dataArrays.flat();
    }

    const primaryArray = dataArrays[0];
    const result: any[] = [];

    for (const primaryItem of primaryArray) {
      const joinedItem = { ...primaryItem };

      for (let i = 1; i < dataArrays.length; i++) {
        const matchingItem = dataArrays[i].find(item => 
          item[joinKey] === primaryItem[joinKey]
        );
        if (matchingItem) {
          Object.assign(joinedItem, matchingItem);
        }
      }

      result.push(joinedItem);
    }

    return result;
  }

  /**
   * Merge results with conflict resolution
   */
  private mergeResults(dataArrays: any[][]): any[] {
    const merged = new Map();

    for (const array of dataArrays) {
      for (const item of array) {
        const key = item.id || item.transaction_id || item.user_id;
        if (key) {
          if (!merged.has(key) || item.updated_at > merged.get(key).updated_at) {
            merged.set(key, item);
          }
        } else {
          merged.set(crypto.randomUUID(), item);
        }
      }
    }

    return Array.from(merged.values());
  }

  /**
   * Parse vector query parameters
   */
  private parseVectorQuery(query: string): any {
    const params: any = {};
    
    if (query.toLowerCase().includes('similarity')) {
      params.type = 'similarity';
    } else if (query.toLowerCase().includes('embedding')) {
      params.type = 'embedding';
    }
    
    // Extract parameters from query string
    const matches = query.match(/(\w+):\s*([^\s,]+)/g);
    if (matches) {
      for (const match of matches) {
        const [key, value] = match.split(':').map(s => s.trim());
        params[key] = value;
      }
    }
    
    return params;
  }

  /**
   * Initialize predefined query patterns
   */
  private initializeQueryPatterns(): void {
    // User portfolio query
    this.queryPatterns.set('GET_USER_PORTFOLIO', {
      queries: [
        {
          database: 'postgres',
          query: 'SELECT * FROM portfolio_holdings WHERE user_id = $1'
        },
        {
          database: 'redis',
          query: 'portfolio:*'
        }
      ],
      aggregation: 'merge',
      joinKey: 'user_id'
    });

    // Transaction history query
    this.queryPatterns.set('GET_TRANSACTION_HISTORY', {
      queries: [
        {
          database: 'postgres',
          query: 'SELECT * FROM transaction_history WHERE user_id = $1 ORDER BY block_timestamp DESC'
        },
        {
          database: 'clickhouse',
          query: 'SELECT * FROM transaction_events WHERE user_id = {user_id:String} ORDER BY timestamp DESC'
        }
      ],
      aggregation: 'union',
      joinKey: 'transaction_id'
    });

    // Protocol analytics query
    this.queryPatterns.set('GET_PROTOCOL_ANALYTICS', {
      queries: [
        {
          database: 'postgres',
          query: 'SELECT * FROM protocols WHERE id = $1'
        },
        {
          database: 'clickhouse',
          query: 'SELECT * FROM protocol_tvl_history WHERE protocol_id = {protocol_id:String} ORDER BY timestamp DESC'
        }
      ],
      aggregation: 'join',
      joinKey: 'protocol_id'
    });
  }

  /**
   * Cache management
   */
  private getCachedResult(request: QueryRequest): QueryCache | null {
    const key = this.generateCacheKey(request);
    const cached = this.cache.get(key);
    
    if (cached && Date.now() - cached.timestamp.getTime() < cached.ttl * 1000) {
      return cached;
    }
    
    if (cached) {
      this.cache.delete(key);
    }
    
    return null;
  }

  private cacheResult(request: QueryRequest, data: any[], ttl: number): void {
    const key = this.generateCacheKey(request);
    this.cache.set(key, {
      key,
      data,
      timestamp: new Date(),
      ttl
    });

    // Clean up old cache entries
    this.cleanupCache();
  }

  private generateCacheKey(request: QueryRequest): string {
    return `query:${request.type}:${request.query}:${JSON.stringify(request.parameters || {})}`;
  }

  private cleanupCache(): void {
    const now = Date.now();
    for (const [key, cached] of this.cache.entries()) {
      if (now - cached.timestamp.getTime() > cached.ttl * 1000) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Predefined query methods
   */
  async getUserPortfolio(userId: string): Promise<QueryResult> {
    return this.executeQuery({
      query: 'GET_USER_PORTFOLIO',
      type: 'unified',
      parameters: { userId }
    });
  }

  async getTransactionHistory(userId: string, limit = 100): Promise<QueryResult> {
    return this.executeQuery({
      query: 'GET_TRANSACTION_HISTORY',
      type: 'unified',
      parameters: { userId, limit }
    });
  }

  async getProtocolAnalytics(protocolId: string): Promise<QueryResult> {
    return this.executeQuery({
      query: 'GET_PROTOCOL_ANALYTICS',
      type: 'unified',
      parameters: { protocolId }
    });
  }

  async getMarketData(symbol: string, timeframe: string): Promise<QueryResult> {
    return this.executeQuery({
      query: `SELECT * FROM price_data_${timeframe} WHERE asset_id = '{symbol:String}' ORDER BY timestamp DESC LIMIT 1000`,
      type: 'analytics'
    });
  }

  async searchSimilarAssets(embedding: number[], limit = 10): Promise<QueryResult> {
    return this.executeQuery({
      query: `similarity: embedding:${JSON.stringify(embedding)} limit:${limit}`,
      type: 'vector'
    });
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): any {
    const totalEntries = this.cache.size;
    let totalSize = 0;
    
    for (const cached of this.cache.values()) {
      totalSize += JSON.stringify(cached.data).length;
    }

    return {
      totalEntries,
      totalSize,
      averageEntrySize: totalEntries > 0 ? totalSize / totalEntries : 0
    };
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
    logger.info('Query cache cleared');
  }
} 