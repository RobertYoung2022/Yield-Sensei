/**
 * YieldSensei Cross-Database Integration Manager
 * 
 * Implements data consistency and synchronization across:
 * - PostgreSQL (transactional data)
 * - ClickHouse (analytics data)
 * - Redis (caching and real-time data)
 * - Vector DB (ML embeddings)
 * - Kafka (streaming integration)
 */

import { EventEmitter } from 'events';
import Logger from '@/shared/logging/logger';
import { DatabaseManager } from './manager';
import { ClickHouseManager } from './clickhouse-manager';
import { VectorManager } from './vector-manager';
import { KafkaManager } from '../streaming/kafka-manager';

const logger = Logger.getLogger('database-integration');

// =============================================================================
// INTERFACES AND TYPES
// =============================================================================

export interface DataSyncConfig {
  // PostgreSQL to ClickHouse sync
  postgresToClickhouse: {
    enabled: boolean;
    batchSize: number;
    syncInterval: number; // milliseconds
    tables: string[];
  };
  
  // Cache invalidation
  cacheInvalidation: {
    enabled: boolean;
    ttl: number; // seconds
    patterns: string[];
  };
  
  // Data validation
  validation: {
    enabled: boolean;
    checkInterval: number; // milliseconds
    tolerance: number; // percentage difference allowed
  };
  
  // Transaction boundaries
  transactions: {
    enabled: boolean;
    timeout: number; // milliseconds
    retryAttempts: number;
  };
}

export interface SyncStatus {
  lastSync: Date;
  recordsProcessed: number;
  errors: string[];
  duration: number;
  status: 'idle' | 'running' | 'error' | 'completed';
}

export interface DataValidationResult {
  table: string;
  sourceCount: number;
  targetCount: number;
  difference: number;
  percentageDiff: number;
  isValid: boolean;
  timestamp: Date;
}

export interface CrossDatabaseQuery {
  query: string;
  databases: ('postgres' | 'clickhouse' | 'redis' | 'vector')[];
  aggregation?: 'union' | 'join' | 'merge';
  timeout?: number;
}

export interface UnifiedQueryResult {
  data: any[];
  metadata: {
    sources: string[];
    executionTime: number;
    recordCount: number;
    warnings: string[];
  };
}

// =============================================================================
// CHANGE DATA CAPTURE (CDC) INTERFACES
// =============================================================================

export interface CDCChange {
  table: string;
  operation: 'INSERT' | 'UPDATE' | 'DELETE';
  oldRecord?: Record<string, any>;
  newRecord?: Record<string, any>;
  timestamp: Date;
  transactionId: string;
}

export interface CDCHandler {
  handleChange(change: CDCChange): Promise<void>;
}

// =============================================================================
// MAIN INTEGRATION MANAGER
// =============================================================================

export class DatabaseIntegrationManager extends EventEmitter {
  private static instance: DatabaseIntegrationManager;
  private dbManager: DatabaseManager;
  private kafkaManager: KafkaManager | null = null;
  private config: DataSyncConfig;
  private syncStatus: Map<string, SyncStatus> = new Map();
  private cdcHandlers: Map<string, CDCHandler> = new Map();
  private isInitialized = false;

  private constructor() {
    super();
    this.dbManager = DatabaseManager.getInstance();
    this.config = this.getDefaultConfig();
  }

  public static getInstance(): DatabaseIntegrationManager {
    if (!DatabaseIntegrationManager.instance) {
      DatabaseIntegrationManager.instance = new DatabaseIntegrationManager();
    }
    return DatabaseIntegrationManager.instance;
  }

  /**
   * Initialize the integration manager
   */
  async initialize(kafkaConfig?: any): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      logger.info('Initializing Database Integration Manager...');

      // Initialize Kafka manager for CDC
      if (kafkaConfig) {
        this.kafkaManager = KafkaManager.getInstance(kafkaConfig);
        await this.kafkaManager.connect();
      }

      // Set up CDC handlers
      this.setupCDCHandlers();

      // Start background sync processes
      if (this.config.postgresToClickhouse.enabled) {
        this.startPostgresToClickhouseSync();
      }

      // Start data validation
      if (this.config.validation.enabled) {
        this.startDataValidation();
      }

      this.isInitialized = true;
      logger.info('Database Integration Manager initialized successfully');
      this.emit('initialized');
    } catch (error) {
      logger.error('Failed to initialize Database Integration Manager:', error);
      throw error;
    }
  }

  // =============================================================================
  // POSTGRESQL TO CLICKHOUSE SYNCHRONIZATION
  // =============================================================================

  /**
   * Synchronize data from PostgreSQL to ClickHouse
   */
  async syncPostgresToClickhouse(table: string, batchSize = 1000): Promise<SyncStatus> {
    const syncId = `postgres_to_clickhouse_${table}`;
    const status: SyncStatus = {
      lastSync: new Date(),
      recordsProcessed: 0,
      errors: [],
      duration: 0,
      status: 'running'
    };

    this.syncStatus.set(syncId, status);
    const startTime = Date.now();

    try {
      logger.info(`Starting PostgreSQL to ClickHouse sync for table: ${table}`);

      const postgres = this.dbManager.getPostgres();
      const clickhouse = this.dbManager.getClickHouse();

      // Get the last sync timestamp
      const lastSyncTime = await this.getLastSyncTime(table);
      
      // Query new/updated records from PostgreSQL
      const query = this.buildSyncQuery(table, lastSyncTime);
      const result = await postgres.query(query);
      
      if (result.rows.length === 0) {
        status.status = 'completed';
        status.duration = Date.now() - startTime;
        logger.info(`No new data to sync for table: ${table}`);
        return status;
      }

      // Process in batches
      const batches = this.chunkArray(result.rows, batchSize);
      
      for (const batch of batches) {
        await this.processBatch(table, batch, clickhouse);
        status.recordsProcessed += batch.length;
      }

      // Update last sync time
      await this.updateLastSyncTime(table);

      status.status = 'completed';
      status.duration = Date.now() - startTime;
      
      logger.info(`Sync completed for ${table}: ${status.recordsProcessed} records in ${status.duration}ms`);
      this.emit('syncCompleted', { table, status });
      
    } catch (error) {
      status.status = 'error';
      status.errors.push(error instanceof Error ? error.message : String(error));
      status.duration = Date.now() - startTime;
      
      logger.error(`Sync failed for table ${table}:`, error);
      this.emit('syncError', { table, error, status });
    }

    this.syncStatus.set(syncId, status);
    return status;
  }

  /**
   * Build sync query based on table structure
   */
  private buildSyncQuery(table: string, lastSyncTime: Date | null): string {
    const timestampColumn = this.getTimestampColumn(table);
    const whereClause = lastSyncTime 
      ? `WHERE ${timestampColumn} > '${lastSyncTime.toISOString()}'`
      : '';

    return `
      SELECT * FROM ${table}
      ${whereClause}
      ORDER BY ${timestampColumn}
    `;
  }

  /**
   * Process a batch of records for ClickHouse insertion
   */
  private async processBatch(table: string, batch: any[], clickhouse: ClickHouseManager): Promise<void> {
    const clickhouseTable = this.mapTableToClickHouse(table);
    
    if (!clickhouseTable) {
      throw new Error(`No ClickHouse mapping found for table: ${table}`);
    }

    // Transform data for ClickHouse schema
    const transformedData = batch.map(record => 
      this.transformRecordForClickHouse(table, record)
    );

    // Insert into ClickHouse
    await clickhouse.insert(clickhouseTable, transformedData);
  }

  /**
   * Transform PostgreSQL record to ClickHouse format
   */
  private transformRecordForClickHouse(table: string, record: any): any {
    switch (table) {
      case 'transaction_history':
        return {
          timestamp: record.block_timestamp,
          transaction_id: record.id,
          user_id: record.user_id,
          protocol_id: record.protocol_id,
          transaction_type: record.type,
          amount: record.amount,
          token_address: record.token_address,
          block_number: record.block_number,
          tx_hash: record.tx_hash,
          gas_used: record.gas_used || 0,
          gas_price: record.gas_price || 0,
          status: record.status,
          created_at: record.created_at
        };
      
      case 'portfolio_holdings':
        return {
          timestamp: record.updated_at,
          user_id: record.user_id,
          asset_id: record.asset_id,
          protocol_id: record.protocol_id,
          quantity: record.quantity,
          value_usd: record.value_usd,
          apy: record.apy || 0,
          risk_score: record.risk_score || 0,
          created_at: record.created_at,
          updated_at: record.updated_at
        };

      default:
        return record;
    }
  }

  // =============================================================================
  // CHANGE DATA CAPTURE (CDC) IMPLEMENTATION
  // =============================================================================

  /**
   * Set up CDC handlers for real-time data synchronization
   */
  private setupCDCHandlers(): void {
    // Transaction history CDC
    this.cdcHandlers.set('transaction_history', {
      handleChange: async (change: CDCChange) => {
        await this.handleTransactionChange(change);
      }
    });

    // Portfolio holdings CDC
    this.cdcHandlers.set('portfolio_holdings', {
      handleChange: async (change: CDCChange) => {
        await this.handlePortfolioChange(change);
      }
    });

    // Protocol updates CDC
    this.cdcHandlers.set('protocols', {
      handleChange: async (change: CDCChange) => {
        await this.handleProtocolChange(change);
      }
    });
  }

  /**
   * Handle transaction history changes
   */
  private async handleTransactionChange(change: CDCChange): Promise<void> {
    try {
      const clickhouse = this.dbManager.getClickHouse();
      const redis = this.dbManager.getRedis();

      // Update ClickHouse analytics
      if (change.operation === 'INSERT' && change.newRecord) {
        const transformedRecord = this.transformRecordForClickHouse('transaction_history', change.newRecord);
        await clickhouse.insert('transaction_events', [transformedRecord]);
      }

      // Update Redis cache
      const cacheKey = `transaction:${change.newRecord?.['id'] || change.oldRecord?.['id']}`;
      if (change.operation === 'DELETE') {
        await redis.delete(cacheKey);
      } else {
        await redis.set(cacheKey, JSON.stringify(change.newRecord), { ttl: 3600 });
      }

      // Publish to Kafka for real-time processing
      if (this.kafkaManager) {
        await this.kafkaManager.produceTransactionData({
          id: change.newRecord?.['id'] || change.oldRecord?.['id'],
          userId: change.newRecord?.['user_id'] || change.oldRecord?.['user_id'],
          protocolId: change.newRecord?.['protocol_id'] || change.oldRecord?.['protocol_id'],
          type: change.newRecord?.['type'] || change.oldRecord?.['type'],
          amount: change.newRecord?.['amount'] || change.oldRecord?.['amount'],
          tokenAddress: change.newRecord?.['token_address'] || change.oldRecord?.['token_address'],
          blockNumber: change.newRecord?.['block_number'] || change.oldRecord?.['block_number'],
          txHash: change.newRecord?.['tx_hash'] || change.oldRecord?.['tx_hash']
        });
      }

    } catch (error) {
      logger.error('Error handling transaction change:', error);
      this.emit('cdcError', { table: 'transaction_history', change, error });
    }
  }

  /**
   * Handle portfolio holdings changes
   */
  private async handlePortfolioChange(change: CDCChange): Promise<void> {
    try {
      const redis = this.dbManager.getRedis();

      // Update Redis cache with portfolio data
      const userId = change.newRecord?.['user_id'] || change.oldRecord?.['user_id'];
      const cacheKey = `portfolio:${userId}`;
      
      if (change.operation === 'DELETE') {
        // Remove from portfolio cache - use individual key
        const assetKey = `${cacheKey}:${change.oldRecord?.['asset_id']}`;
        await redis.delete(assetKey);
      } else {
        // Update portfolio cache - use individual key
        const assetKey = `${cacheKey}:${change.newRecord?.['asset_id']}`;
        await redis.set(assetKey, JSON.stringify(change.newRecord), { ttl: 1800 }); // 30 minutes TTL
      }

      // Publish portfolio update event
      if (this.kafkaManager) {
        await this.kafkaManager.produce({
          topic: 'defi.portfolio.updates',
          key: userId,
          value: JSON.stringify({
            userId,
            assetId: change.newRecord?.['asset_id'] || change.oldRecord?.['asset_id'],
            operation: change.operation,
            timestamp: new Date().toISOString()
          })
        });
      }

    } catch (error) {
      logger.error('Error handling portfolio change:', error);
      this.emit('cdcError', { table: 'portfolio_holdings', change, error });
    }
  }

  /**
   * Handle protocol changes
   */
  private async handleProtocolChange(change: CDCChange): Promise<void> {
    try {
      const redis = this.dbManager.getRedis();
      const clickhouse = this.dbManager.getClickHouse();

      // Update Redis cache
      const cacheKey = `protocol:${change.newRecord?.['id'] || change.oldRecord?.['id']}`;
      if (change.operation === 'DELETE') {
        await redis.delete(cacheKey);
      } else {
        await redis.set(cacheKey, JSON.stringify(change.newRecord), { ttl: 3600 });
      }

      // Update ClickHouse protocol metrics
      if (change.operation === 'INSERT' || change.operation === 'UPDATE') {
        await clickhouse.insert('protocol_tvl_history', [{
          timestamp: new Date(),
          protocol_id: change.newRecord?.['id'],
          tvl: change.newRecord?.['tvl'] || 0,
          apy: change.newRecord?.['apy'] || 0,
          risk_score: change.newRecord?.['risk_score'] || 0,
          user_count: change.newRecord?.['user_count'] || 0
        }]);
      }

      // Publish protocol update
      if (this.kafkaManager) {
        await this.kafkaManager.produceProtocolData({
          id: change.newRecord?.['id'] || change.oldRecord?.['id'],
          name: change.newRecord?.['name'] || change.oldRecord?.['name'],
          description: change.newRecord?.['description'] || change.oldRecord?.['description'],
          category: change.newRecord?.['category'] || change.oldRecord?.['category'],
          tvl: change.newRecord?.['tvl'] || change.oldRecord?.['tvl'] || 0,
          apy: change.newRecord?.['apy'] || change.oldRecord?.['apy'] || 0,
          riskScore: change.newRecord?.['risk_score'] || change.oldRecord?.['risk_score'] || 0
        });
      }

    } catch (error) {
      logger.error('Error handling protocol change:', error);
      this.emit('cdcError', { table: 'protocols', change, error });
    }
  }

  // =============================================================================
  // DATA VALIDATION AND RECONCILIATION
  // =============================================================================

  /**
   * Validate data consistency between databases
   */
  async validateDataConsistency(): Promise<DataValidationResult[]> {
    const results: DataValidationResult[] = [];

    try {
      logger.info('Starting data consistency validation...');

      // Validate transaction counts
      const transactionValidation = await this.validateTableCounts('transaction_history', 'transaction_events');
      results.push(transactionValidation);

      // Validate portfolio data
      const portfolioValidation = await this.validateTableCounts('portfolio_holdings', 'user_activity_daily');
      results.push(portfolioValidation);

      // Validate protocol data
      const protocolValidation = await this.validateTableCounts('protocols', 'protocol_tvl_history');
      results.push(protocolValidation);

      // Check for data drift
      const driftResults = await this.checkDataDrift();
      results.push(...driftResults);

      logger.info(`Data validation completed: ${results.length} checks performed`);
      this.emit('validationCompleted', results);

    } catch (error) {
      logger.error('Data validation failed:', error);
      this.emit('validationError', error);
    }

    return results;
  }

  /**
   * Validate record counts between PostgreSQL and ClickHouse
   */
  private async validateTableCounts(postgresTable: string, clickhouseTable: string): Promise<DataValidationResult> {
    const postgres = this.dbManager.getPostgres();
    const clickhouse = this.dbManager.getClickHouse();

    // Get PostgreSQL count
    const pgResult = await postgres.query(`SELECT COUNT(*) as count FROM ${postgresTable}`);
    const pgCount = parseInt(pgResult.rows[0].count);

    // Get ClickHouse count
    const chResult = await clickhouse.query(`SELECT COUNT(*) as count FROM ${clickhouseTable}`);
    const chCount = parseInt(chResult.data[0].count);

    const difference = Math.abs(pgCount - chCount);
    const percentageDiff = pgCount > 0 ? (difference / pgCount) * 100 : 0;
    const isValid = percentageDiff <= this.config.validation.tolerance;

    return {
      table: `${postgresTable} -> ${clickhouseTable}`,
      sourceCount: pgCount,
      targetCount: chCount,
      difference,
      percentageDiff,
      isValid,
      timestamp: new Date()
    };
  }

  /**
   * Check for data drift between databases
   */
  private async checkDataDrift(): Promise<DataValidationResult[]> {
    const results: DataValidationResult[] = [];
    
    // Check for orphaned records in ClickHouse
    const orphanedRecords = await this.findOrphanedRecords();
    
    for (const orphan of orphanedRecords) {
      results.push({
        table: `orphaned_${orphan.table}`,
        sourceCount: 0,
        targetCount: orphan.count,
        difference: orphan.count,
        percentageDiff: 100,
        isValid: false,
        timestamp: new Date()
      });
    }

    return results;
  }

  /**
   * Find orphaned records in ClickHouse that don't exist in PostgreSQL
   */
  private async findOrphanedRecords(): Promise<Array<{ table: string; count: number }>> {
    const clickhouse = this.dbManager.getClickHouse();
    const results: Array<{ table: string; count: number }> = [];

    // Check for orphaned transaction events
    const orphanedTransactions = await clickhouse.query(`
      SELECT COUNT(*) as count 
      FROM transaction_events te
      LEFT JOIN postgres_transaction_history pth ON te.transaction_id = pth.id
      WHERE pth.id IS NULL
    `);
    
    if (orphanedTransactions.data[0].count > 0) {
      results.push({ table: 'transaction_events', count: orphanedTransactions.data[0].count });
    }

    return results;
  }

  // =============================================================================
  // UNIFIED QUERY LAYER
  // =============================================================================

  /**
   * Execute queries across multiple databases
   */
  async executeUnifiedQuery(query: CrossDatabaseQuery): Promise<UnifiedQueryResult> {
    const startTime = Date.now();
    const results: any[] = [];
    const warnings: string[] = [];

    try {
      logger.info(`Executing unified query across databases: ${query.databases.join(', ')}`);

      // Execute queries in parallel
      const queryPromises = query.databases.map(db => this.executeDatabaseQuery(db, query.query));
      const dbResults = await Promise.allSettled(queryPromises);

      // Process results
      for (let i = 0; i < dbResults.length; i++) {
        const result = dbResults[i];
        const database = query.databases[i];
        
        if (!result || !database) continue;

        if (result.status === 'fulfilled') {
          results.push(...result.value);
        } else {
          warnings.push(`Query failed for ${database}: ${result.reason}`);
          logger.warn(`Query failed for ${database}:`, result.reason);
        }
      }

      // Apply aggregation if specified
      let finalResults = results;
      if (query.aggregation) {
        finalResults = this.aggregateResults(results, query.aggregation);
      }

      const executionTime = Date.now() - startTime;

      const unifiedResult: UnifiedQueryResult = {
        data: finalResults,
        metadata: {
          sources: query.databases,
          executionTime,
          recordCount: finalResults.length,
          warnings
        }
      };

      logger.info(`Unified query completed in ${executionTime}ms with ${finalResults.length} records`);
      return unifiedResult;

    } catch (error) {
      logger.error('Unified query execution failed:', error);
      throw error;
    }
  }

  /**
   * Execute query on specific database
   */
  private async executeDatabaseQuery(database: string, query: string): Promise<any[]> {
    switch (database) {
      case 'postgres':
        const postgres = this.dbManager.getPostgres();
        const result = await postgres.query(query);
        return result.rows;

      case 'clickhouse':
        const clickhouse = this.dbManager.getClickHouse();
        const chResult = await clickhouse.query(query);
        return chResult.data;

      case 'redis':
        const redis = this.dbManager.getRedis();
        // For Redis, we'll implement pattern-based queries
        return await this.executeRedisQuery(redis, query);

      case 'vector':
        const vector = this.dbManager.getVector();
        // For Vector DB, we'll implement similarity search queries
        return await this.executeVectorQuery(vector, query);

      default:
        throw new Error(`Unsupported database: ${database}`);
    }
  }

  /**
   * Execute Redis pattern-based queries
   */
  private async executeRedisQuery(redis: any, pattern: string): Promise<any[]> {
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

    return results;
  }

  /**
   * Execute Vector DB similarity search queries
   */
  private async executeVectorQuery(vector: VectorManager, query: string): Promise<any[]> {
    // Parse query for vector search parameters
    const parsedParams = this.parseVectorQuery(query);
    
    // Create proper SearchParams object
    const searchParams = {
      vector: parsedParams.vector || [],
      limit: parsedParams.limit || 10,
      with_payload: true,
      with_vector: false,
    };
    
    return await vector.search('default', searchParams);
  }

  /**
   * Aggregate results from multiple databases
   */
  private aggregateResults(results: any[], aggregation: string): any[] {
    switch (aggregation) {
      case 'union':
        // Remove duplicates based on common ID fields
        const seen = new Set();
        return results.filter(item => {
          const id = item.id || item.transaction_id || item.user_id;
          if (seen.has(id)) return false;
          seen.add(id);
          return true;
        });

      case 'join':
        // Join results on common fields
        return this.joinResults(results);

      case 'merge':
        // Merge results with conflict resolution
        return this.mergeResults(results);

      default:
        return results;
    }
  }

  // =============================================================================
  // TRANSACTION BOUNDARIES
  // =============================================================================

  /**
   * Execute operations across multiple databases with transaction boundaries
   */
  async executeCrossDatabaseTransaction<T>(
    operations: Array<{
      database: string;
      operation: () => Promise<T>;
      rollback?: () => Promise<void>;
    }>
  ): Promise<T[]> {
    const results: T[] = [];
    const rollbacks: Array<() => Promise<void>> = [];

    try {
      for (const op of operations) {
        const result = await op.operation();
        results.push(result);
        
        if (op.rollback) {
          rollbacks.push(op.rollback);
        }
      }

      return results;

    } catch (error) {
      logger.error('Cross-database transaction failed, rolling back...', error);

      // Execute rollbacks in reverse order
      for (let i = rollbacks.length - 1; i >= 0; i--) {
        const rollbackFn = rollbacks[i];
        if (rollbackFn) {
          try {
            await rollbackFn();
          } catch (rollbackError) {
            logger.error('Rollback operation failed:', rollbackError);
          }
        }
      }

      throw error;
    }
  }

  // =============================================================================
  // UTILITY METHODS
  // =============================================================================

  private getDefaultConfig(): DataSyncConfig {
    return {
      postgresToClickhouse: {
        enabled: true,
        batchSize: 1000,
        syncInterval: 30000, // 30 seconds
        tables: ['transaction_history', 'portfolio_holdings', 'protocols']
      },
      cacheInvalidation: {
        enabled: true,
        ttl: 3600, // 1 hour
        patterns: ['user:*', 'protocol:*', 'transaction:*']
      },
      validation: {
        enabled: true,
        checkInterval: 300000, // 5 minutes
        tolerance: 1.0 // 1% tolerance
      },
      transactions: {
        enabled: true,
        timeout: 30000, // 30 seconds
        retryAttempts: 3
      }
    };
  }

  private getTimestampColumn(table: string): string {
    const timestampColumns: Record<string, string> = {
      'transaction_history': 'block_timestamp',
      'portfolio_holdings': 'updated_at',
      'protocols': 'updated_at',
      'users': 'updated_at'
    };
    return timestampColumns[table] || 'created_at';
  }

  private mapTableToClickHouse(table: string): string | null {
    const mappings: Record<string, string> = {
      'transaction_history': 'transaction_events',
      'portfolio_holdings': 'user_activity_daily',
      'protocols': 'protocol_tvl_history'
    };
    return mappings[table] || null;
  }

  private async getLastSyncTime(table: string): Promise<Date | null> {
    const redis = this.dbManager.getRedis();
    const lastSyncKey = `sync:last:${table}`;
    const lastSync = await redis.get(lastSyncKey);
    return lastSync ? new Date(lastSync) : null;
  }

  private async updateLastSyncTime(table: string): Promise<void> {
    const redis = this.dbManager.getRedis();
    const lastSyncKey = `sync:last:${table}`;
    await redis.set(lastSyncKey, new Date().toISOString());
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  private parseVectorQuery(query: string): any {
    // Simple query parser for vector search
    // In a real implementation, this would be more sophisticated
    const params: any = {
      vector: [], // Default empty vector
      limit: 10,
    };
    
    if (query.includes('similarity')) {
      params.type = 'similarity';
      // In real implementation, would extract vector from query
      params.vector = new Array(512).fill(0); // Default 512-dim zero vector
    } else if (query.includes('embedding')) {
      params.type = 'embedding';
      params.vector = new Array(512).fill(0);
    }
    
    return params;
  }

  private joinResults(results: any[]): any[] {
    // Simple join implementation
    // In a real implementation, this would be more sophisticated
    return results;
  }

  private mergeResults(results: any[]): any[] {
    // Simple merge implementation with conflict resolution
    const merged = new Map();
    
    for (const item of results) {
      const key = item.id || item.transaction_id || item.user_id;
      if (!merged.has(key) || item.updated_at > merged.get(key).updated_at) {
        merged.set(key, item);
      }
    }
    
    return Array.from(merged.values());
  }

  private startPostgresToClickhouseSync(): void {
    setInterval(async () => {
      for (const table of this.config.postgresToClickhouse.tables) {
        try {
          await this.syncPostgresToClickhouse(table, this.config.postgresToClickhouse.batchSize);
        } catch (error) {
          logger.error(`Background sync failed for table ${table}:`, error);
        }
      }
    }, this.config.postgresToClickhouse.syncInterval);
  }

  private startDataValidation(): void {
    setInterval(async () => {
      try {
        await this.validateDataConsistency();
      } catch (error) {
        logger.error('Background data validation failed:', error);
      }
    }, this.config.validation.checkInterval);
  }

  // =============================================================================
  // PUBLIC API METHODS
  // =============================================================================

  /**
   * Get sync status for all tables
   */
  getSyncStatus(): Map<string, SyncStatus> {
    return new Map(this.syncStatus);
  }

  /**
   * Force sync for a specific table
   */
  async forceSync(table: string): Promise<SyncStatus> {
    return await this.syncPostgresToClickhouse(table);
  }

  /**
   * Get integration health status
   */
  async getHealthStatus(): Promise<any> {
    return {
      isInitialized: this.isInitialized,
      syncStatus: this.getSyncStatus(),
      databaseHealth: this.dbManager.getStatus(),
      kafkaConnected: this.kafkaManager?.isConnectedToKafka() || false
    };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<DataSyncConfig>): void {
    this.config = { ...this.config, ...newConfig };
    logger.info('Integration configuration updated');
  }
} 