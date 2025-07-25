/**
 * YieldSensei PostgreSQL Schema Manager
 * Handles schema migrations, partition management, and database setup
 */

import { Pool, PoolClient } from 'pg';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import Logger from '@/shared/logging/logger';
import { DatabaseManager } from './manager';

const logger = Logger.getLogger('schema-manager');

export interface MigrationRecord {
  id: number;
  version: string;
  description: string;
  applied_at: Date;
  checksum: string;
}

export interface PartitionInfo {
  table_name: string;
  partition_name: string;
  size_bytes: number;
  size_pretty: string;
  row_count: number;
}

/**
 * Schema management for PostgreSQL database
 */
export class PostgreSQLSchemaManager {
  private dbManager: DatabaseManager | null = null;
  private migrationsPath: string;

  constructor() {
    this.migrationsPath = join(__dirname, 'migrations');
  }
  
  /**
   * Initialize with database manager instance
   */
  setDatabaseManager(dbManager: DatabaseManager): void {
    this.dbManager = dbManager;
  }
  
  /**
   * Get database manager, throwing error if not set
   */
  private getDbManager(): DatabaseManager {
    if (!this.dbManager) {
      throw new Error('DatabaseManager not set. Call setDatabaseManager() first.');
    }
    return this.dbManager;
  }

  /**
   * Initialize schema with all migrations
   */
  async initializeSchema(): Promise<void> {
    try {
      logger.info('Initializing PostgreSQL schema...');

      // Ensure database connection
      await this.getDbManager().initialize();

      // Run all pending migrations
      await this.runMigrations();

      // Set up automatic partition management
      await this.setupPartitionManagement();

      logger.info('Schema initialization completed successfully');
    } catch (error) {
      logger.error('Schema initialization failed:', error);
      throw error;
    }
  }

  /**
   * Run all pending migrations
   */
  async runMigrations(): Promise<void> {
    logger.info('Running database migrations...');

    const client = await this.getDbManager().getPostgresConnection();
    
    try {
      // Create migrations table if it doesn't exist
      await this.ensureMigrationsTable(client);

      // Get applied migrations
      const appliedMigrations = await this.getAppliedMigrations(client);
      const appliedVersions = new Set(appliedMigrations.map(m => m.version));

      // Get all migration files
      const migrationFiles = this.getMigrationFiles();

      // Run pending migrations
      for (const file of migrationFiles) {
        const version = this.extractVersionFromFilename(file);
        
        if (!appliedVersions.has(version)) {
          await this.runMigration(client, file, version);
        } else {
          logger.debug(`Migration ${version} already applied, skipping`);
        }
      }

      logger.info(`Migrations completed. Applied ${migrationFiles.length} total migrations.`);
    } finally {
      client.release();
    }
  }

  /**
   * Create the migrations tracking table
   */
  private async ensureMigrationsTable(client: PoolClient): Promise<void> {
    const sql = `
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        version VARCHAR(50) UNIQUE NOT NULL,
        description TEXT NOT NULL,
        applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        checksum VARCHAR(64)
      );
    `;
    
    await client.query(sql);
    logger.debug('Migrations table ensured');
  }

  /**
   * Get list of applied migrations
   */
  private async getAppliedMigrations(client: PoolClient): Promise<MigrationRecord[]> {
    const result = await client.query(
      'SELECT * FROM schema_migrations ORDER BY applied_at ASC'
    );
    return result.rows;
  }

  /**
   * Get sorted list of migration files
   */
  private getMigrationFiles(): string[] {
    try {
      const files = readdirSync(this.migrationsPath)
        .filter(file => file.endsWith('.sql'))
        .sort();
      
      logger.debug(`Found ${files.length} migration files`);
      return files;
    } catch (error) {
      logger.warn('No migrations directory found, creating empty array');
      return [];
    }
  }

  /**
   * Extract version number from migration filename
   */
  private extractVersionFromFilename(filename: string): string {
    const match = filename.match(/^(\d+)/);
    if (!match || !match[1]) {
      throw new Error(`Invalid migration filename format: ${filename}`);
    }
    return match[1];
  }

  /**
   * Run a single migration
   */
  private async runMigration(client: PoolClient, filename: string, version: string): Promise<void> {
    logger.info(`Running migration ${version}: ${filename}`);

    try {
      // Read migration file
      const migrationPath = join(this.migrationsPath, filename);
      const sql = readFileSync(migrationPath, 'utf-8');

      // Extract description from filename
      const description = filename.replace(/^\d+_/, '').replace(/\.sql$/, '').replace(/_/g, ' ');

      // Calculate checksum
      const checksum = require('crypto').createHash('md5').update(sql).digest('hex');

      // Begin transaction
      await client.query('BEGIN');

      try {
        // Run migration SQL
        await client.query(sql);

        // Record migration
        await client.query(
          'INSERT INTO schema_migrations (version, description, checksum) VALUES ($1, $2, $3)',
          [version, description, checksum]
        );

        // Commit transaction
        await client.query('COMMIT');

        logger.info(`Migration ${version} completed successfully`);
      } catch (error) {
        // Rollback on error
        await client.query('ROLLBACK');
        throw error;
      }
    } catch (error) {
      logger.error(`Migration ${version} failed:`, error);
      throw error;
    }
  }

  /**
   * Set up automatic partition management
   */
  async setupPartitionManagement(): Promise<void> {
    logger.info('Setting up automatic partition management...');

    const client = await this.getDbManager().getPostgresConnection();
    
    try {
      // Create partitions for current and next month
      await this.createTransactionHistoryPartitions(client, 6); // 6 months ahead
      await this.createPortfolioSnapshotPartitions(client, 8); // 8 quarters ahead

      logger.info('Partition management setup completed');
    } finally {
      client.release();
    }
  }

  /**
   * Create transaction history partitions
   */
  private async createTransactionHistoryPartitions(client: PoolClient, monthsAhead: number): Promise<void> {
    const currentDate = new Date();
    
    for (let i = 0; i < monthsAhead; i++) {
      const targetDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + i, 1);
      const year = targetDate.getFullYear();
      const month = (targetDate.getMonth() + 1).toString().padStart(2, '0');
      
      const partitionName = `transaction_history_${year}_${month}`;
      const startDate = `${year}-${month}-01`;
      const endDate = new Date(year, targetDate.getMonth() + 1, 1).toISOString().split('T')[0];

      const sql = `
        CREATE TABLE IF NOT EXISTS ${partitionName} PARTITION OF transaction_history
        FOR VALUES FROM ('${startDate}') TO ('${endDate}');
      `;

      try {
        await client.query(sql);
        logger.debug(`Created partition: ${partitionName}`);
      } catch (error: any) {
        if (error.code === '42P07') { // Relation already exists
          logger.debug(`Partition ${partitionName} already exists`);
        } else {
          throw error;
        }
      }
    }
  }

  /**
   * Create portfolio snapshot partitions
   */
  private async createPortfolioSnapshotPartitions(client: PoolClient, quartersAhead: number): Promise<void> {
    const currentDate = new Date();
    const currentQuarter = Math.floor(currentDate.getMonth() / 3);
    const currentYear = currentDate.getFullYear();
    
    for (let i = 0; i < quartersAhead; i++) {
      const targetQuarter = (currentQuarter + i) % 4;
      const targetYear = currentYear + Math.floor((currentQuarter + i) / 4);
      
      const partitionName = `portfolio_snapshots_${targetYear}_q${targetQuarter + 1}`;
      const startMonth = (targetQuarter * 3) + 1;
      const endMonth = startMonth + 3;
      
      const startDate = `${targetYear}-${startMonth.toString().padStart(2, '0')}-01`;
      const endDate = endMonth > 12 
        ? `${targetYear + 1}-01-01`
        : `${targetYear}-${endMonth.toString().padStart(2, '0')}-01`;

      const sql = `
        CREATE TABLE IF NOT EXISTS ${partitionName} PARTITION OF portfolio_snapshots
        FOR VALUES FROM ('${startDate}') TO ('${endDate}');
      `;

      try {
        await client.query(sql);
        logger.debug(`Created partition: ${partitionName}`);
      } catch (error: any) {
        if (error.code === '42P07') { // Relation already exists
          logger.debug(`Partition ${partitionName} already exists`);
        } else {
          throw error;
        }
      }
    }
  }

  /**
   * Get partition information
   */
  async getPartitionInfo(): Promise<PartitionInfo[]> {
    const result = await this.getDbManager().executePostgresQuery(`
      SELECT * FROM get_partition_sizes()
      ORDER BY size_bytes DESC;
    `);
    
    return result;
  }

  /**
   * Drop old partitions (for maintenance)
   */
  async dropOldPartitions(olderThanMonths: number = 24): Promise<void> {
    logger.info(`Dropping partitions older than ${olderThanMonths} months...`);

    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - olderThanMonths);

    const client = await this.getDbManager().getPostgresConnection();
    
    try {
      // Find old transaction history partitions
      const result = await client.query(`
        SELECT schemaname, tablename 
        FROM pg_tables 
        WHERE tablename LIKE 'transaction_history_%'
        AND tablename < 'transaction_history_' || to_char($1, 'YYYY_MM')
      `, [cutoffDate]);

      for (const row of result.rows) {
        const partitionName = `${row.schemaname}.${row.tablename}`;
        
        logger.info(`Dropping old partition: ${partitionName}`);
        await client.query(`DROP TABLE IF EXISTS ${partitionName}`);
      }

      logger.info('Old partition cleanup completed');
    } finally {
      client.release();
    }
  }

  /**
   * Validate schema integrity
   */
  async validateSchema(): Promise<{ valid: boolean; issues: string[] }> {
    const issues: string[] = [];

    try {
      const client = await this.getDbManager().getPostgresConnection();
      
      try {
        // Check for required tables
        const requiredTables = [
          'users', 'protocols', 'assets', 'portfolio_holdings',
          'transaction_history', 'portfolio_snapshots'
        ];

        for (const table of requiredTables) {
          const result = await client.query(
            'SELECT COUNT(*) FROM information_schema.tables WHERE table_name = $1',
            [table]
          );
          
          if (parseInt(result.rows[0].count) === 0) {
            issues.push(`Missing required table: ${table}`);
          }
        }

        // Check for required indexes
        const requiredIndexes = [
          'idx_users_address', 'idx_portfolio_user', 'idx_transaction_user_time'
        ];

        for (const index of requiredIndexes) {
          const result = await client.query(
            'SELECT COUNT(*) FROM pg_indexes WHERE indexname = $1',
            [index]
          );
          
          if (parseInt(result.rows[0].count) === 0) {
            issues.push(`Missing required index: ${index}`);
          }
        }

        // Check partition health
        const partitionCount = await client.query(`
          SELECT COUNT(*) FROM pg_tables 
          WHERE tablename LIKE '%_2024_%' OR tablename LIKE '%_2025_%'
        `);
        
        if (parseInt(partitionCount.rows[0].count) < 12) {
          issues.push('Insufficient partitions created');
        }

      } finally {
        client.release();
      }

    } catch (error) {
      issues.push(`Schema validation failed: ${error}`);
    }

    return {
      valid: issues.length === 0,
      issues
    };
  }

  /**
   * Get schema statistics
   */
  async getSchemaStats(): Promise<any> {
    const stats = await this.getDbManager().executePostgresQuery(`
      SELECT 
        (SELECT COUNT(*) FROM users) as user_count,
        (SELECT COUNT(*) FROM protocols) as protocol_count,
        (SELECT COUNT(*) FROM assets) as asset_count,
        (SELECT COUNT(*) FROM portfolio_holdings) as portfolio_count,
        (SELECT COUNT(*) FROM schema_migrations) as migration_count,
        (SELECT COUNT(*) FROM pg_tables WHERE tablename LIKE '%_2024_%' OR tablename LIKE '%_2025_%') as partition_count
    `);

    return stats[0];
  }
} 