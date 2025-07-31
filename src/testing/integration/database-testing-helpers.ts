/**
 * Database Testing Helpers
 * Utilities for database setup, teardown, and validation in integration tests
 */

import { Client as PgClient } from 'pg';
import { Redis } from 'ioredis';
import { Logger } from 'winston';
import { createLogger, format, transports } from 'winston';
import crypto from 'crypto';

export interface DatabaseTestConfig {
  type: 'postgresql' | 'redis' | 'clickhouse' | 'mongodb';
  connectionString: string;
  schemas?: string[];
  fixtures?: string[];
  isolationLevel?: 'shared' | 'isolated';
  cleanupStrategy?: 'truncate' | 'drop' | 'none';
}

export interface TestDatabase {
  name: string;
  type: string;
  connection: any;
  transactionInProgress: boolean;
  isolatedSchemaName?: string;
}

export interface DatabaseSnapshot {
  id: string;
  database: string;
  timestamp: Date;
  tables: Map<string, any[]>;
  metadata: Record<string, any>;
}

export class DatabaseTestingHelpers {
  private logger: Logger;
  private databases: Map<string, TestDatabase> = new Map();
  private snapshots: Map<string, DatabaseSnapshot> = new Map();
  private activeTransactions: Map<string, any> = new Map();

  constructor() {
    this.logger = createLogger({
      level: 'info',
      format: format.combine(
        format.timestamp(),
        format.simple()
      ),
      transports: [
        new transports.Console(),
        new transports.File({ filename: 'logs/database-testing.log' })
      ],
    });
  }

  async setupDatabase(config: DatabaseTestConfig): Promise<TestDatabase> {
    this.logger.info(`Setting up test database: ${config.type}`);

    const database: TestDatabase = {
      name: this.generateDatabaseName(config),
      type: config.type,
      connection: null,
      transactionInProgress: false,
    };

    try {
      switch (config.type) {
        case 'postgresql':
          database.connection = await this.setupPostgreSQL(config, database);
          break;
        case 'redis':
          database.connection = await this.setupRedis(config, database);
          break;
        case 'clickhouse':
          database.connection = await this.setupClickHouse(config, database);
          break;
        case 'mongodb':
          database.connection = await this.setupMongoDB(config, database);
          break;
        default:
          throw new Error(`Unsupported database type: ${config.type}`);
      }

      // Apply schemas if provided
      if (config.schemas && config.schemas.length > 0) {
        await this.applySchemas(database, config.schemas);
      }

      // Load fixtures if provided
      if (config.fixtures && config.fixtures.length > 0) {
        await this.loadFixtures(database, config.fixtures);
      }

      this.databases.set(database.name, database);
      this.logger.info(`Database ${database.name} setup complete`);

      return database;
    } catch (error) {
      this.logger.error(`Failed to setup database ${config.type}:`, error);
      throw error;
    }
  }

  private async setupPostgreSQL(config: DatabaseTestConfig, database: TestDatabase): Promise<PgClient> {
    const connectionConfig = this.parsePostgreSQLConnectionString(config.connectionString);
    
    if (config.isolationLevel === 'isolated') {
      // Create isolated schema for this test
      database.isolatedSchemaName = `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const adminClient = new PgClient(connectionConfig);
      await adminClient.connect();
      
      try {
        await adminClient.query(`CREATE SCHEMA IF NOT EXISTS ${database.isolatedSchemaName}`);
        await adminClient.end();
      } catch (error) {
        await adminClient.end();
        throw error;
      }

      // Update connection to use isolated schema
      connectionConfig.options = `-c search_path=${database.isolatedSchemaName}`;
    }

    const client = new PgClient(connectionConfig);
    await client.connect();
    
    return client;
  }

  private async setupRedis(config: DatabaseTestConfig, database: TestDatabase): Promise<Redis> {
    const redis = new Redis(config.connectionString);
    
    if (config.isolationLevel === 'isolated') {
      // Use a specific database index for isolation
      const dbIndex = Math.floor(Math.random() * 15) + 1; // Use databases 1-15 for tests
      await redis.select(dbIndex);
    }
    
    return redis;
  }

  private async setupClickHouse(config: DatabaseTestConfig, database: TestDatabase): Promise<any> {
    // ClickHouse setup would be implemented here
    // For now, return a mock connection
    return {
      query: async (sql: string) => {
        this.logger.debug(`ClickHouse query: ${sql}`);
        return { rows: [], rowCount: 0 };
      },
    };
  }

  private async setupMongoDB(config: DatabaseTestConfig, database: TestDatabase): Promise<any> {
    // MongoDB setup would be implemented here
    // For now, return a mock connection
    return {
      collection: (name: string) => ({
        find: async () => [],
        insertOne: async (doc: any) => ({ insertedId: 'test_id' }),
        deleteMany: async () => ({ deletedCount: 0 }),
      }),
    };
  }

  async beginTransaction(databaseName: string): Promise<void> {
    const database = this.databases.get(databaseName);
    if (!database) {
      throw new Error(`Database ${databaseName} not found`);
    }

    if (database.transactionInProgress) {
      throw new Error(`Transaction already in progress for ${databaseName}`);
    }

    switch (database.type) {
      case 'postgresql':
        await database.connection.query('BEGIN');
        database.transactionInProgress = true;
        this.activeTransactions.set(databaseName, true);
        break;
      
      case 'redis':
        // Redis doesn't support traditional transactions, use MULTI
        database.connection.multi();
        database.transactionInProgress = true;
        break;
      
      default:
        this.logger.warn(`Transactions not supported for ${database.type}`);
    }
  }

  async commitTransaction(databaseName: string): Promise<void> {
    const database = this.databases.get(databaseName);
    if (!database || !database.transactionInProgress) {
      throw new Error(`No active transaction for ${databaseName}`);
    }

    switch (database.type) {
      case 'postgresql':
        await database.connection.query('COMMIT');
        break;
      
      case 'redis':
        await database.connection.exec();
        break;
    }

    database.transactionInProgress = false;
    this.activeTransactions.delete(databaseName);
  }

  async rollbackTransaction(databaseName: string): Promise<void> {
    const database = this.databases.get(databaseName);
    if (!database || !database.transactionInProgress) {
      throw new Error(`No active transaction for ${databaseName}`);
    }

    switch (database.type) {
      case 'postgresql':
        await database.connection.query('ROLLBACK');
        break;
      
      case 'redis':
        database.connection.discard();
        break;
    }

    database.transactionInProgress = false;
    this.activeTransactions.delete(databaseName);
  }

  async createSnapshot(databaseName: string): Promise<string> {
    const database = this.databases.get(databaseName);
    if (!database) {
      throw new Error(`Database ${databaseName} not found`);
    }

    const snapshotId = `snapshot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const snapshot: DatabaseSnapshot = {
      id: snapshotId,
      database: databaseName,
      timestamp: new Date(),
      tables: new Map(),
      metadata: {},
    };

    switch (database.type) {
      case 'postgresql':
        await this.snapshotPostgreSQL(database, snapshot);
        break;
      
      case 'redis':
        await this.snapshotRedis(database, snapshot);
        break;
      
      default:
        throw new Error(`Snapshots not supported for ${database.type}`);
    }

    this.snapshots.set(snapshotId, snapshot);
    this.logger.info(`Created snapshot ${snapshotId} for ${databaseName}`);
    
    return snapshotId;
  }

  async restoreSnapshot(snapshotId: string): Promise<void> {
    const snapshot = this.snapshots.get(snapshotId);
    if (!snapshot) {
      throw new Error(`Snapshot ${snapshotId} not found`);
    }

    const database = this.databases.get(snapshot.database);
    if (!database) {
      throw new Error(`Database ${snapshot.database} not found`);
    }

    switch (database.type) {
      case 'postgresql':
        await this.restorePostgreSQLSnapshot(database, snapshot);
        break;
      
      case 'redis':
        await this.restoreRedisSnapshot(database, snapshot);
        break;
      
      default:
        throw new Error(`Snapshot restore not supported for ${database.type}`);
    }

    this.logger.info(`Restored snapshot ${snapshotId} for ${snapshot.database}`);
  }

  private async snapshotPostgreSQL(database: TestDatabase, snapshot: DatabaseSnapshot): Promise<void> {
    const client = database.connection as PgClient;
    
    // Get all tables in the schema
    const schemaName = database.isolatedSchemaName || 'public';
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = $1 
      AND table_type = 'BASE TABLE'
    `, [schemaName]);

    // Backup each table
    for (const row of tablesResult.rows) {
      const tableName = row.table_name;
      const dataResult = await client.query(`SELECT * FROM ${schemaName}.${tableName}`);
      snapshot.tables.set(tableName, dataResult.rows);
    }

    // Store additional metadata
    snapshot.metadata.schemaName = schemaName;
    snapshot.metadata.tableCount = snapshot.tables.size;
  }

  private async snapshotRedis(database: TestDatabase, snapshot: DatabaseSnapshot): Promise<void> {
    const redis = database.connection as Redis;
    
    // Get all keys
    const keys = await redis.keys('*');
    
    // Backup each key
    for (const key of keys) {
      const type = await redis.type(key);
      let value: any;
      
      switch (type) {
        case 'string':
          value = await redis.get(key);
          break;
        case 'hash':
          value = await redis.hgetall(key);
          break;
        case 'list':
          value = await redis.lrange(key, 0, -1);
          break;
        case 'set':
          value = await redis.smembers(key);
          break;
        case 'zset':
          value = await redis.zrange(key, 0, -1, 'WITHSCORES');
          break;
        default:
          continue;
      }
      
      snapshot.tables.set(key, { type, value });
    }
    
    snapshot.metadata.keyCount = keys.length;
  }

  private async restorePostgreSQLSnapshot(database: TestDatabase, snapshot: DatabaseSnapshot): Promise<void> {
    const client = database.connection as PgClient;
    const schemaName = snapshot.metadata.schemaName || 'public';
    
    // Begin transaction for atomic restore
    await client.query('BEGIN');
    
    try {
      // Disable foreign key checks temporarily
      await client.query('SET session_replication_role = replica');
      
      // Truncate all tables
      for (const tableName of snapshot.tables.keys()) {
        await client.query(`TRUNCATE TABLE ${schemaName}.${tableName} CASCADE`);
      }
      
      // Restore data
      for (const [tableName, rows] of snapshot.tables) {
        if (rows.length === 0) continue;
        
        const columns = Object.keys(rows[0]);
        const values = rows.map(row => columns.map(col => row[col]));
        
        // Generate INSERT statement with placeholders
        const placeholders = values.map((_, rowIndex) => 
          `(${columns.map((_, colIndex) => `$${rowIndex * columns.length + colIndex + 1}`).join(', ')})`
        ).join(', ');
        
        const query = `INSERT INTO ${schemaName}.${tableName} (${columns.join(', ')}) VALUES ${placeholders}`;
        const flatValues = values.flat();
        
        await client.query(query, flatValues);
      }
      
      // Re-enable foreign key checks
      await client.query('SET session_replication_role = DEFAULT');
      
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  }

  private async restoreRedisSnapshot(database: TestDatabase, snapshot: DatabaseSnapshot): Promise<void> {
    const redis = database.connection as Redis;
    
    // Clear current data
    await redis.flushdb();
    
    // Restore each key
    for (const [key, data] of snapshot.tables) {
      const { type, value } = data as any;
      
      switch (type) {
        case 'string':
          await redis.set(key, value);
          break;
        case 'hash':
          await redis.hmset(key, value);
          break;
        case 'list':
          if (value.length > 0) {
            await redis.rpush(key, ...value);
          }
          break;
        case 'set':
          if (value.length > 0) {
            await redis.sadd(key, ...value);
          }
          break;
        case 'zset':
          if (value.length > 0) {
            await redis.zadd(key, ...value);
          }
          break;
      }
    }
  }

  async cleanupDatabase(databaseName: string, strategy: 'truncate' | 'drop' | 'none' = 'truncate'): Promise<void> {
    const database = this.databases.get(databaseName);
    if (!database) {
      throw new Error(`Database ${databaseName} not found`);
    }

    if (strategy === 'none') return;

    this.logger.info(`Cleaning up database ${databaseName} with strategy: ${strategy}`);

    switch (database.type) {
      case 'postgresql':
        await this.cleanupPostgreSQL(database, strategy);
        break;
      
      case 'redis':
        await this.cleanupRedis(database, strategy);
        break;
      
      case 'clickhouse':
        await this.cleanupClickHouse(database, strategy);
        break;
      
      case 'mongodb':
        await this.cleanupMongoDB(database, strategy);
        break;
    }
  }

  private async cleanupPostgreSQL(database: TestDatabase, strategy: string): Promise<void> {
    const client = database.connection as PgClient;
    
    if (strategy === 'drop' && database.isolatedSchemaName) {
      await client.query(`DROP SCHEMA IF EXISTS ${database.isolatedSchemaName} CASCADE`);
    } else if (strategy === 'truncate') {
      const schemaName = database.isolatedSchemaName || 'public';
      const tablesResult = await client.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = $1 
        AND table_type = 'BASE TABLE'
      `, [schemaName]);
      
      for (const row of tablesResult.rows) {
        await client.query(`TRUNCATE TABLE ${schemaName}.${row.table_name} CASCADE`);
      }
    }
  }

  private async cleanupRedis(database: TestDatabase, strategy: string): Promise<void> {
    const redis = database.connection as Redis;
    await redis.flushdb();
  }

  private async cleanupClickHouse(database: TestDatabase, strategy: string): Promise<void> {
    // ClickHouse cleanup implementation
    this.logger.info('ClickHouse cleanup not yet implemented');
  }

  private async cleanupMongoDB(database: TestDatabase, strategy: string): Promise<void> {
    // MongoDB cleanup implementation
    this.logger.info('MongoDB cleanup not yet implemented');
  }

  async disconnect(databaseName: string): Promise<void> {
    const database = this.databases.get(databaseName);
    if (!database) return;

    try {
      switch (database.type) {
        case 'postgresql':
          await (database.connection as PgClient).end();
          break;
        
        case 'redis':
          (database.connection as Redis).disconnect();
          break;
      }
      
      this.databases.delete(databaseName);
      this.logger.info(`Disconnected from database ${databaseName}`);
    } catch (error) {
      this.logger.error(`Error disconnecting from ${databaseName}:`, error);
    }
  }

  async disconnectAll(): Promise<void> {
    for (const databaseName of this.databases.keys()) {
      await this.disconnect(databaseName);
    }
  }

  // Utility methods

  async executeQuery(databaseName: string, query: string, params?: any[]): Promise<any> {
    const database = this.databases.get(databaseName);
    if (!database) {
      throw new Error(`Database ${databaseName} not found`);
    }

    switch (database.type) {
      case 'postgresql':
        const result = await (database.connection as PgClient).query(query, params);
        return result.rows;
      
      case 'redis':
        throw new Error('Use Redis-specific methods for Redis operations');
      
      default:
        throw new Error(`Query execution not supported for ${database.type}`);
    }
  }

  async assertTableExists(databaseName: string, tableName: string): Promise<boolean> {
    const database = this.databases.get(databaseName);
    if (!database) {
      throw new Error(`Database ${databaseName} not found`);
    }

    switch (database.type) {
      case 'postgresql':
        const schemaName = database.isolatedSchemaName || 'public';
        const result = await (database.connection as PgClient).query(`
          SELECT EXISTS (
            SELECT 1 
            FROM information_schema.tables 
            WHERE table_schema = $1 
            AND table_name = $2
          )
        `, [schemaName, tableName]);
        return result.rows[0].exists;
      
      default:
        throw new Error(`Table existence check not supported for ${database.type}`);
    }
  }

  async assertRecordExists(
    databaseName: string, 
    tableName: string, 
    conditions: Record<string, any>
  ): Promise<boolean> {
    const database = this.databases.get(databaseName);
    if (!database) {
      throw new Error(`Database ${databaseName} not found`);
    }

    switch (database.type) {
      case 'postgresql':
        const schemaName = database.isolatedSchemaName || 'public';
        const whereClause = Object.entries(conditions)
          .map(([key, _], index) => `${key} = $${index + 1}`)
          .join(' AND ');
        const values = Object.values(conditions);
        
        const result = await (database.connection as PgClient).query(
          `SELECT EXISTS (SELECT 1 FROM ${schemaName}.${tableName} WHERE ${whereClause})`,
          values
        );
        return result.rows[0].exists;
      
      default:
        throw new Error(`Record existence check not supported for ${database.type}`);
    }
  }

  private generateDatabaseName(config: DatabaseTestConfig): string {
    const hash = crypto.createHash('sha256')
      .update(config.connectionString)
      .digest('hex')
      .substring(0, 8);
    return `testdb_${config.type}_${hash}`;
  }

  private parsePostgreSQLConnectionString(connectionString: string): any {
    const url = new URL(connectionString);
    return {
      host: url.hostname,
      port: parseInt(url.port || '5432'),
      user: url.username,
      password: url.password,
      database: url.pathname.substring(1),
    };
  }

  private async applySchemas(database: TestDatabase, schemas: string[]): Promise<void> {
    this.logger.info(`Applying ${schemas.length} schemas to ${database.name}`);
    
    for (const schemaPath of schemas) {
      try {
        const fs = await import('fs/promises');
        const schema = await fs.readFile(schemaPath, 'utf-8');
        
        switch (database.type) {
          case 'postgresql':
            await (database.connection as PgClient).query(schema);
            break;
          
          default:
            this.logger.warn(`Schema application not implemented for ${database.type}`);
        }
      } catch (error) {
        this.logger.error(`Failed to apply schema ${schemaPath}:`, error);
        throw error;
      }
    }
  }

  private async loadFixtures(database: TestDatabase, fixtures: string[]): Promise<void> {
    this.logger.info(`Loading ${fixtures.length} fixtures into ${database.name}`);
    
    for (const fixturePath of fixtures) {
      try {
        const fs = await import('fs/promises');
        const fixtureContent = await fs.readFile(fixturePath, 'utf-8');
        const fixtureData = JSON.parse(fixtureContent);
        
        // Process fixture data based on database type
        await this.loadFixtureData(database, fixtureData);
      } catch (error) {
        this.logger.error(`Failed to load fixture ${fixturePath}:`, error);
        throw error;
      }
    }
  }

  private async loadFixtureData(database: TestDatabase, fixtureData: any): Promise<void> {
    switch (database.type) {
      case 'postgresql':
        for (const [tableName, records] of Object.entries(fixtureData)) {
          if (!Array.isArray(records)) continue;
          
          for (const record of records) {
            const columns = Object.keys(record);
            const values = Object.values(record);
            const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
            
            const schemaName = database.isolatedSchemaName || 'public';
            const query = `INSERT INTO ${schemaName}.${tableName} (${columns.join(', ')}) VALUES (${placeholders})`;
            
            await (database.connection as PgClient).query(query, values);
          }
        }
        break;
      
      case 'redis':
        const redis = database.connection as Redis;
        for (const [key, value] of Object.entries(fixtureData)) {
          if (typeof value === 'string') {
            await redis.set(key, value);
          } else if (typeof value === 'object') {
            await redis.hmset(key, value);
          }
        }
        break;
      
      default:
        this.logger.warn(`Fixture loading not implemented for ${database.type}`);
    }
  }
}