/**
 * YieldSensei Change Data Capture (CDC) Manager
 * 
 * Implements PostgreSQL triggers and change capture for real-time data synchronization
 * across PostgreSQL, ClickHouse, Redis, and Vector DB systems.
 */

import { Pool, PoolClient } from 'pg';
import { EventEmitter } from 'events';
import Logger from '@/shared/logging/logger';
import { DatabaseManager } from './manager';
import { KafkaManager } from '../streaming/kafka-manager';
import { CDCChange, CDCHandler } from './integration-manager';

const logger = Logger.getLogger('database-cdc');

// =============================================================================
// INTERFACES AND TYPES
// =============================================================================

export interface CDCTriggerConfig {
  table: string;
  enabled: boolean;
  captureColumns: string[];
  excludeColumns?: string[];
  topic?: string;
}

export interface CDCTrigger {
  name: string;
  table: string;
  function: string;
  events: string[];
  timing: 'BEFORE' | 'AFTER';
  enabled: boolean;
}

export interface CDCMessage {
  id: string;
  table: string;
  operation: 'INSERT' | 'UPDATE' | 'DELETE';
  oldRecord?: Record<string, any>;
  newRecord?: Record<string, any>;
  timestamp: Date;
  transactionId: string;
  metadata: {
    source: string;
    version: string;
    checksum: string;
  };
}

// =============================================================================
// CDC MANAGER CLASS
// =============================================================================

export class CDCManager extends EventEmitter {
  private static instance: CDCManager;
  private dbManager: DatabaseManager;
  private kafkaManager: KafkaManager | null = null;
  private config: CDCTriggerConfig[];
  private handlers: Map<string, CDCHandler> = new Map();
  private isInitialized = false;

  private constructor() {
    super();
    this.dbManager = DatabaseManager.getInstance();
    this.config = this.getDefaultConfig();
  }

  public static getInstance(): CDCManager {
    if (!CDCManager.instance) {
      CDCManager.instance = new CDCManager();
    }
    return CDCManager.instance;
  }

  /**
   * Initialize CDC manager and create triggers
   */
  async initialize(kafkaConfig?: any): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      logger.info('Initializing CDC Manager...');

      // Initialize Kafka manager
      if (kafkaConfig) {
        this.kafkaManager = KafkaManager.getInstance(kafkaConfig);
        await this.kafkaManager.connect();
      }

      // Create CDC schema and functions
      await this.createCDCSchema();

      // Create triggers for configured tables
      await this.createTriggers();

      // Set up change handlers
      this.setupChangeHandlers();

      this.isInitialized = true;
      logger.info('CDC Manager initialized successfully');
      this.emit('initialized');

    } catch (error) {
      logger.error('Failed to initialize CDC Manager:', error);
      throw error;
    }
  }

  /**
   * Create CDC schema and functions
   */
  private async createCDCSchema(): Promise<void> {
    const postgres = this.dbManager.getPostgres();
    
    // Create CDC schema
    await postgres.query(`
      CREATE SCHEMA IF NOT EXISTS cdc;
    `);

    // Create CDC log table
    await postgres.query(`
      CREATE TABLE IF NOT EXISTS cdc.change_log (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        table_name VARCHAR(255) NOT NULL,
        operation VARCHAR(10) NOT NULL,
        old_record JSONB,
        new_record JSONB,
        timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        transaction_id VARCHAR(255),
        processed BOOLEAN DEFAULT FALSE,
        error_message TEXT,
        retry_count INTEGER DEFAULT 0
      );
    `);

    // Create indexes for performance
    await postgres.query(`
      CREATE INDEX IF NOT EXISTS idx_cdc_change_log_table_timestamp 
      ON cdc.change_log(table_name, timestamp);
      
      CREATE INDEX IF NOT EXISTS idx_cdc_change_log_processed 
      ON cdc.change_log(processed) WHERE processed = FALSE;
      
      CREATE INDEX IF NOT EXISTS idx_cdc_change_log_transaction 
      ON cdc.change_log(transaction_id);
    `);

    // Create CDC function for capturing changes
    await postgres.query(`
      CREATE OR REPLACE FUNCTION cdc.capture_change()
      RETURNS TRIGGER AS $$
      DECLARE
        old_record JSONB;
        new_record JSONB;
        operation VARCHAR(10);
      BEGIN
        -- Determine operation type
        IF TG_OP = 'INSERT' THEN
          operation := 'INSERT';
          old_record := NULL;
          new_record := to_jsonb(NEW);
        ELSIF TG_OP = 'UPDATE' THEN
          operation := 'UPDATE';
          old_record := to_jsonb(OLD);
          new_record := to_jsonb(NEW);
        ELSIF TG_OP = 'DELETE' THEN
          operation := 'DELETE';
          old_record := to_jsonb(OLD);
          new_record := NULL;
        END IF;

        -- Insert change record
        INSERT INTO cdc.change_log (
          table_name,
          operation,
          old_record,
          new_record,
          transaction_id
        ) VALUES (
          TG_TABLE_NAME,
          operation,
          old_record,
          new_record,
          txid_current()::text
        );

        -- Return appropriate record
        IF TG_OP = 'DELETE' THEN
          RETURN OLD;
        ELSE
          RETURN NEW;
        END IF;
      END;
      $$ LANGUAGE plpgsql;
    `);

    logger.info('CDC schema and functions created successfully');
  }

  /**
   * Create triggers for configured tables
   */
  private async createTriggers(): Promise<void> {
    const postgres = this.dbManager.getPostgres();

    for (const tableConfig of this.config) {
      if (!tableConfig.enabled) continue;

      try {
        // Create trigger function for specific table
        await this.createTableTriggerFunction(tableConfig);

        // Create trigger
        await postgres.query(`
          DROP TRIGGER IF EXISTS cdc_trigger_${tableConfig.table} ON ${tableConfig.table};
          
          CREATE TRIGGER cdc_trigger_${tableConfig.table}
          AFTER INSERT OR UPDATE OR DELETE ON ${tableConfig.table}
          FOR EACH ROW EXECUTE FUNCTION cdc.capture_change();
        `);

        logger.info(`CDC trigger created for table: ${tableConfig.table}`);

      } catch (error) {
        logger.error(`Failed to create CDC trigger for table ${tableConfig.table}:`, error);
      }
    }
  }

  /**
   * Create table-specific trigger function with column filtering
   */
  private async createTableTriggerFunction(tableConfig: CDCTriggerConfig): Promise<void> {
    const postgres = this.dbManager.getPostgres();
    
    // Get table columns
    const columnsResult = await postgres.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = $1 
      AND table_schema = 'public'
      ORDER BY ordinal_position
    `, [tableConfig.table]);

    const allColumns = columnsResult.rows.map(row => row.column_name);
    const captureColumns = tableConfig.captureColumns.length > 0 
      ? tableConfig.captureColumns 
      : allColumns;

    // Filter out excluded columns
    const finalColumns = captureColumns.filter(col => 
      !tableConfig.excludeColumns?.includes(col)
    );

    // Create filtered trigger function
    const functionName = `cdc.capture_change_${tableConfig.table}`;
    
    await postgres.query(`
      CREATE OR REPLACE FUNCTION ${functionName}()
      RETURNS TRIGGER AS $$
      DECLARE
        old_record JSONB;
        new_record JSONB;
        operation VARCHAR(10);
        filtered_old JSONB;
        filtered_new JSONB;
      BEGIN
        -- Determine operation type
        IF TG_OP = 'INSERT' THEN
          operation := 'INSERT';
          old_record := NULL;
          new_record := to_jsonb(NEW);
        ELSIF TG_OP = 'UPDATE' THEN
          operation := 'UPDATE';
          old_record := to_jsonb(OLD);
          new_record := to_jsonb(NEW);
        ELSIF TG_OP = 'DELETE' THEN
          operation := 'DELETE';
          old_record := to_jsonb(OLD);
          new_record := NULL;
        END IF;

        -- Filter columns for old record
        IF old_record IS NOT NULL THEN
          filtered_old := '{}'::jsonb;
          FOREACH col IN ARRAY $1
          LOOP
            IF old_record ? col THEN
              filtered_old := filtered_old || jsonb_build_object(col, old_record->col);
            END IF;
          END LOOP;
        END IF;

        -- Filter columns for new record
        IF new_record IS NOT NULL THEN
          filtered_new := '{}'::jsonb;
          FOREACH col IN ARRAY $1
          LOOP
            IF new_record ? col THEN
              filtered_new := filtered_new || jsonb_build_object(col, new_record->col);
            END IF;
          END LOOP;
        END IF;

        -- Insert change record
        INSERT INTO cdc.change_log (
          table_name,
          operation,
          old_record,
          new_record,
          transaction_id
        ) VALUES (
          TG_TABLE_NAME,
          operation,
          filtered_old,
          filtered_new,
          txid_current()::text
        );

        -- Return appropriate record
        IF TG_OP = 'DELETE' THEN
          RETURN OLD;
        ELSE
          RETURN NEW;
        END IF;
      END;
      $$ LANGUAGE plpgsql;
    `, [finalColumns]);

    // Update trigger to use table-specific function
    await postgres.query(`
      DROP TRIGGER IF EXISTS cdc_trigger_${tableConfig.table} ON ${tableConfig.table};
      
      CREATE TRIGGER cdc_trigger_${tableConfig.table}
      AFTER INSERT OR UPDATE OR DELETE ON ${tableConfig.table}
      FOR EACH ROW EXECUTE FUNCTION ${functionName}();
    `);
  }

  /**
   * Set up change handlers for different tables
   */
  private setupChangeHandlers(): void {
    // Transaction history handler
    this.handlers.set('transaction_history', {
      handleChange: async (change: CDCChange) => {
        await this.handleTransactionChange(change);
      }
    });

    // Portfolio holdings handler
    this.handlers.set('portfolio_holdings', {
      handleChange: async (change: CDCChange) => {
        await this.handlePortfolioChange(change);
      }
    });

    // Protocols handler
    this.handlers.set('protocols', {
      handleChange: async (change: CDCChange) => {
        await this.handleProtocolChange(change);
      }
    });

    // Users handler
    this.handlers.set('users', {
      handleChange: async (change: CDCChange) => {
        await this.handleUserChange(change);
      }
    });
  }

  /**
   * Process pending CDC changes
   */
  async processPendingChanges(batchSize = 100): Promise<number> {
    const postgres = this.dbManager.getPostgres();
    let processedCount = 0;

    try {
      // Get pending changes
      const result = await postgres.query(`
        SELECT 
          id,
          table_name,
          operation,
          old_record,
          new_record,
          timestamp,
          transaction_id
        FROM cdc.change_log 
        WHERE processed = FALSE 
        ORDER BY timestamp 
        LIMIT $1
      `, [batchSize]);

      if (result.rows.length === 0) {
        return 0;
      }

      logger.info(`Processing ${result.rows.length} pending CDC changes`);

      // Process each change
      for (const row of result.rows) {
        try {
          const change: CDCChange = {
            table: row.table_name,
            operation: row.operation,
            oldRecord: row.old_record,
            newRecord: row.new_record,
            timestamp: row.timestamp,
            transactionId: row.transaction_id
          };

          // Handle change
          await this.handleChange(change);

          // Mark as processed
          await postgres.query(`
            UPDATE cdc.change_log 
            SET processed = TRUE 
            WHERE id = $1
          `, [row.id]);

          processedCount++;

                 } catch (error) {
           logger.error(`Error processing CDC change ${row.id}:`, error);
           
           // Update error count
           await postgres.query(`
             UPDATE cdc.change_log 
             SET error_message = $1, retry_count = retry_count + 1
             WHERE id = $2
           `, [(error as Error).message, row.id]);
        }
      }

      logger.info(`Processed ${processedCount} CDC changes successfully`);
      return processedCount;

    } catch (error) {
      logger.error('Error processing pending CDC changes:', error);
      throw error;
    }
  }

  /**
   * Handle individual change
   */
  private async handleChange(change: CDCChange): Promise<void> {
    const handler = this.handlers.get(change.table);
    
    if (handler) {
      await handler.handleChange(change);
    }

    // Publish to Kafka if configured
    if (this.kafkaManager) {
      await this.publishToKafka(change);
    }

    this.emit('changeProcessed', change);
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
         const transformedRecord = {
           timestamp: change.newRecord['block_timestamp'],
           transaction_id: change.newRecord['id'],
           user_id: change.newRecord['user_id'],
           protocol_id: change.newRecord['protocol_id'],
           transaction_type: change.newRecord['type'],
           amount: change.newRecord['amount'],
           token_address: change.newRecord['token_address'],
           block_number: change.newRecord['block_number'],
           tx_hash: change.newRecord['tx_hash'],
           gas_used: change.newRecord['gas_used'] || 0,
           gas_price: change.newRecord['gas_price'] || 0,
           status: change.newRecord['status'],
           created_at: change.newRecord['created_at']
         };

        await clickhouse.insert('transaction_events', [transformedRecord]);
      }

      // Update Redis cache
      const cacheKey = `transaction:${change.newRecord?.id || change.oldRecord?.id}`;
      if (change.operation === 'DELETE') {
        await redis.del(cacheKey);
      } else {
        await redis.setex(cacheKey, 3600, JSON.stringify(change.newRecord));
      }

    } catch (error) {
      logger.error('Error handling transaction change:', error);
      throw error;
    }
  }

  /**
   * Handle portfolio holdings changes
   */
  private async handlePortfolioChange(change: CDCChange): Promise<void> {
    try {
      const redis = this.dbManager.getRedis();
      const clickhouse = this.dbManager.getClickHouse();

      const userId = change.newRecord?.user_id || change.oldRecord?.user_id;
      const cacheKey = `portfolio:${userId}`;

      // Update Redis cache
      if (change.operation === 'DELETE') {
        await redis.hdel(cacheKey, change.oldRecord?.asset_id);
      } else {
        await redis.hset(cacheKey, change.newRecord?.asset_id, JSON.stringify(change.newRecord));
        await redis.expire(cacheKey, 1800); // 30 minutes TTL
      }

      // Update ClickHouse user activity
      if (change.operation === 'INSERT' || change.operation === 'UPDATE') {
        await clickhouse.insert('user_activity_daily', [{
          timestamp: new Date(),
          user_id: userId,
          asset_id: change.newRecord?.asset_id,
          protocol_id: change.newRecord?.protocol_id,
          activity_type: change.operation.toLowerCase(),
          quantity: change.newRecord?.quantity || 0,
          value_usd: change.newRecord?.value_usd || 0
        }]);
      }

    } catch (error) {
      logger.error('Error handling portfolio change:', error);
      throw error;
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
      const cacheKey = `protocol:${change.newRecord?.id || change.oldRecord?.id}`;
      if (change.operation === 'DELETE') {
        await redis.del(cacheKey);
      } else {
        await redis.setex(cacheKey, 3600, JSON.stringify(change.newRecord));
      }

      // Update ClickHouse protocol metrics
      if (change.operation === 'INSERT' || change.operation === 'UPDATE') {
        await clickhouse.insert('protocol_tvl_history', [{
          timestamp: new Date(),
          protocol_id: change.newRecord?.id,
          tvl: change.newRecord?.tvl || 0,
          apy: change.newRecord?.apy || 0,
          risk_score: change.newRecord?.risk_score || 0,
          user_count: change.newRecord?.user_count || 0
        }]);
      }

    } catch (error) {
      logger.error('Error handling protocol change:', error);
      throw error;
    }
  }

  /**
   * Handle user changes
   */
  private async handleUserChange(change: CDCChange): Promise<void> {
    try {
      const redis = this.dbManager.getRedis();

      // Update Redis cache
      const cacheKey = `user:${change.newRecord?.id || change.oldRecord?.id}`;
      if (change.operation === 'DELETE') {
        await redis.del(cacheKey);
      } else {
        await redis.setex(cacheKey, 7200, JSON.stringify(change.newRecord)); // 2 hours TTL
      }

    } catch (error) {
      logger.error('Error handling user change:', error);
      throw error;
    }
  }

  /**
   * Publish change to Kafka
   */
  private async publishToKafka(change: CDCChange): Promise<void> {
    try {
      const message: CDCMessage = {
        id: crypto.randomUUID(),
        table: change.table,
        operation: change.operation,
        oldRecord: change.oldRecord,
        newRecord: change.newRecord,
        timestamp: change.timestamp,
        transactionId: change.transactionId,
        metadata: {
          source: 'postgresql',
          version: '1.0',
          checksum: this.calculateChecksum(change)
        }
      };

      const topic = this.getTopicForTable(change.table);
      
      await this.kafkaManager.produce({
        topic,
        key: change.newRecord?.id || change.oldRecord?.id,
        value: JSON.stringify(message),
        headers: {
          'table': change.table,
          'operation': change.operation,
          'timestamp': change.timestamp.toISOString()
        }
      });

    } catch (error) {
      logger.error('Error publishing to Kafka:', error);
      throw error;
    }
  }

  /**
   * Get Kafka topic for table
   */
  private getTopicForTable(table: string): string {
    const topicMap: Record<string, string> = {
      'transaction_history': 'defi.transactions',
      'portfolio_holdings': 'defi.portfolio',
      'protocols': 'defi.protocols',
      'users': 'defi.users'
    };
    return topicMap[table] || 'defi.changes';
  }

  /**
   * Calculate checksum for change validation
   */
  private calculateChecksum(change: CDCChange): string {
    const data = JSON.stringify({
      table: change.table,
      operation: change.operation,
      oldRecord: change.oldRecord,
      newRecord: change.newRecord,
      timestamp: change.timestamp.toISOString()
    });
    
    // Simple hash function (in production, use crypto.createHash)
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(16);
  }

  /**
   * Get default CDC configuration
   */
  private getDefaultConfig(): CDCTriggerConfig[] {
    return [
      {
        table: 'transaction_history',
        enabled: true,
        captureColumns: ['id', 'user_id', 'protocol_id', 'type', 'amount', 'token_address', 'block_number', 'tx_hash', 'status', 'created_at'],
        topic: 'defi.transactions'
      },
      {
        table: 'portfolio_holdings',
        enabled: true,
        captureColumns: ['id', 'user_id', 'asset_id', 'protocol_id', 'quantity', 'value_usd', 'apy', 'risk_score', 'created_at', 'updated_at'],
        topic: 'defi.portfolio'
      },
      {
        table: 'protocols',
        enabled: true,
        captureColumns: ['id', 'name', 'description', 'category', 'tvl', 'apy', 'risk_score', 'user_count', 'created_at', 'updated_at'],
        topic: 'defi.protocols'
      },
      {
        table: 'users',
        enabled: true,
        captureColumns: ['id', 'address', 'username', 'email', 'display_name', 'risk_tolerance', 'created_at', 'updated_at'],
        excludeColumns: ['password_hash'],
        topic: 'defi.users'
      }
    ];
  }

  /**
   * Get CDC statistics
   */
  async getCDCStats(): Promise<any> {
    const postgres = this.dbManager.getPostgres();
    
    const stats = await postgres.query(`
      SELECT 
        COUNT(*) as total_changes,
        COUNT(*) FILTER (WHERE processed = TRUE) as processed_changes,
        COUNT(*) FILTER (WHERE processed = FALSE) as pending_changes,
        COUNT(*) FILTER (WHERE error_message IS NOT NULL) as error_changes,
        MIN(timestamp) as earliest_change,
        MAX(timestamp) as latest_change
      FROM cdc.change_log
    `);

    return stats.rows[0];
  }

  /**
   * Clean up old processed changes
   */
  async cleanupOldChanges(daysToKeep = 7): Promise<number> {
    const postgres = this.dbManager.getPostgres();
    
    const result = await postgres.query(`
      DELETE FROM cdc.change_log 
      WHERE processed = TRUE 
      AND timestamp < NOW() - INTERVAL '${daysToKeep} days'
    `);

    logger.info(`Cleaned up ${result.rowCount} old CDC changes`);
    return result.rowCount;
  }

  /**
   * Get CDC health status
   */
  async getHealthStatus(): Promise<any> {
    const stats = await this.getCDCStats();
    
    return {
      isInitialized: this.isInitialized,
      stats,
      kafkaConnected: this.kafkaManager?.isConnectedToKafka() || false,
      pendingChanges: stats.pending_changes,
      errorRate: stats.total_changes > 0 ? (stats.error_changes / stats.total_changes) * 100 : 0
    };
  }
} 