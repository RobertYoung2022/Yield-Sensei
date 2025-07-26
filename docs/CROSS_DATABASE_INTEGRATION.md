# Cross-Database Integration and Data Consistency

## Overview

The YieldSensei platform implements a sophisticated cross-database integration system that ensures data consistency and seamless operation across multiple database technologies:

- **PostgreSQL**: Transactional data and user management
- **ClickHouse**: High-frequency analytics and time-series data
- **Redis**: Real-time caching and session management
- **Vector DB**: ML embeddings and similarity search
- **Kafka**: Real-time streaming and event processing

## Architecture Components

### 1. Database Integration Manager

The `DatabaseIntegrationManager` serves as the central coordinator for cross-database operations.

**Key Features:**
- **Data Synchronization**: Automatic sync between PostgreSQL and ClickHouse
- **Change Data Capture (CDC)**: Real-time change tracking and propagation
- **Data Validation**: Consistency checks and reconciliation
- **Unified Query Layer**: Single interface for multi-database queries
- **Transaction Boundaries**: Cross-database transaction management

**Usage Example:**
```typescript
import { DatabaseManager } from '@/shared/database/manager';

const dbManager = DatabaseManager.getInstance();
const integrationManager = dbManager.getIntegrationManager();

// Initialize integration
await integrationManager.initialize();

// Force sync for a specific table
const syncStatus = await integrationManager.forceSync('transaction_history');

// Validate data consistency
const validationResults = await integrationManager.validateDataConsistency();
```

### 2. Change Data Capture (CDC) Manager

The `CDCManager` implements PostgreSQL triggers and change capture for real-time data synchronization.

**Key Features:**
- **Automatic Triggers**: PostgreSQL triggers for INSERT/UPDATE/DELETE operations
- **Change Logging**: Centralized change log with processing status
- **Real-time Processing**: Immediate propagation to other databases
- **Error Handling**: Retry mechanisms and error tracking
- **Kafka Integration**: Event streaming for external consumers

**CDC Schema:**
```sql
CREATE TABLE cdc.change_log (
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
```

**Usage Example:**
```typescript
import { CDCManager } from '@/shared/database/cdc-manager';

const cdcManager = CDCManager.getInstance();

// Initialize CDC with Kafka
await cdcManager.initialize(kafkaConfig);

// Process pending changes
const processedCount = await cdcManager.processPendingChanges(100);

// Get CDC statistics
const stats = await cdcManager.getCDCStats();
```

### 3. Unified Query Manager

The `UnifiedQueryManager` provides a single interface for querying across all database systems.

**Key Features:**
- **Query Routing**: Intelligent routing based on query type
- **Result Aggregation**: Union, join, and merge operations
- **Caching**: Built-in query result caching
- **Predefined Patterns**: Common query patterns for DeFi operations
- **Performance Optimization**: Parallel execution and result optimization

**Query Types:**
- **Transactional**: PostgreSQL queries for user data and transactions
- **Analytics**: ClickHouse queries for market data and analytics
- **Cache**: Redis pattern-based queries
- **Vector**: Similarity search queries
- **Unified**: Cross-database queries with aggregation

**Usage Example:**
```typescript
import { UnifiedQueryManager } from '@/shared/database/unified-query';

const queryManager = UnifiedQueryManager.getInstance();

// Get user portfolio (unified query)
const portfolio = await queryManager.getUserPortfolio(userId);

// Get transaction history (unified query)
const transactions = await queryManager.getTransactionHistory(userId, 100);

// Get market data (analytics query)
const marketData = await queryManager.getMarketData('ETH', 'hourly');

// Search similar assets (vector query)
const similarAssets = await queryManager.searchSimilarAssets(embedding, 10);

// Custom unified query
const result = await queryManager.executeQuery({
  query: 'GET_PROTOCOL_ANALYTICS',
  type: 'unified',
  parameters: { protocolId: 'uniswap-v3' },
  cache: true,
  cacheTTL: 300
});
```

## Data Flow Patterns

### 1. Transaction Processing Flow

```
User Transaction → PostgreSQL → CDC Trigger → Change Log → 
ClickHouse (Analytics) + Redis (Cache) + Kafka (Streaming)
```

**Implementation:**
```typescript
// Transaction is inserted into PostgreSQL
await postgres.query(`
  INSERT INTO transaction_history (user_id, protocol_id, type, amount, ...)
  VALUES ($1, $2, $3, $4, ...)
`, [userId, protocolId, type, amount]);

// CDC trigger automatically captures the change
// Integration manager processes the change
await integrationManager.handleTransactionChange({
  table: 'transaction_history',
  operation: 'INSERT',
  newRecord: transactionData,
  timestamp: new Date(),
  transactionId: txId
});
```

### 2. Portfolio Update Flow

```
Portfolio Change → PostgreSQL → CDC → Redis Cache Update → 
ClickHouse Activity Log + Kafka Portfolio Event
```

**Implementation:**
```typescript
// Portfolio holding is updated
await postgres.query(`
  UPDATE portfolio_holdings 
  SET quantity = $1, value_usd = $2, updated_at = NOW()
  WHERE user_id = $3 AND asset_id = $4
`, [newQuantity, newValue, userId, assetId]);

// CDC automatically triggers cache update and analytics
// Redis cache is updated with new portfolio data
// ClickHouse receives user activity record
// Kafka publishes portfolio update event
```

### 3. Market Data Flow

```
External Data → ClickHouse → Materialized Views → 
Redis Cache + PostgreSQL Aggregates + Kafka Market Events
```

**Implementation:**
```typescript
// Market data is inserted into ClickHouse
await clickhouse.insert('price_data_raw', [{
  timestamp: new Date(),
  asset_id: 'ETH',
  price: 2000.50,
  volume: 1000000,
  // ... other fields
}]);

// Materialized views automatically update
// Redis cache is updated with latest prices
// PostgreSQL receives aggregated metrics
// Kafka publishes market update events
```

## Data Consistency Guarantees

### 1. Eventual Consistency

The system provides **eventual consistency** with the following guarantees:

- **PostgreSQL → ClickHouse**: Changes are propagated within 30 seconds
- **PostgreSQL → Redis**: Cache updates occur within 5 seconds
- **Cross-database Queries**: Results are consistent within 1 minute

### 2. Data Validation

Automatic validation ensures data consistency:

```typescript
// Validate data consistency across databases
const validationResults = await integrationManager.validateDataConsistency();

for (const result of validationResults) {
  if (!result.isValid) {
    logger.warn(`Data inconsistency detected: ${result.table}`);
    logger.warn(`Difference: ${result.difference} records (${result.percentageDiff}%)`);
  }
}
```

### 3. Reconciliation

Automatic reconciliation processes:

```typescript
// Find and fix orphaned records
const orphanedRecords = await integrationManager.findOrphanedRecords();

for (const orphan of orphanedRecords) {
  logger.info(`Found ${orphan.count} orphaned records in ${orphan.table}`);
  // Trigger reconciliation process
}
```

## Performance Optimization

### 1. Batch Processing

Large data operations are processed in batches:

```typescript
// Batch sync from PostgreSQL to ClickHouse
const syncStatus = await integrationManager.syncPostgresToClickhouse(
  'transaction_history', 
  1000 // batch size
);
```

### 2. Parallel Execution

Cross-database queries execute in parallel:

```typescript
// Parallel execution of multiple database queries
const results = await Promise.all([
  postgres.query('SELECT * FROM users WHERE id = $1', [userId]),
  clickhouse.query('SELECT * FROM user_activity WHERE user_id = {user_id:String}', { user_id: userId }),
  redis.hgetall(`portfolio:${userId}`)
]);
```

### 3. Intelligent Caching

Multi-level caching strategy:

```typescript
// Query with caching
const result = await queryManager.executeQuery({
  query: 'SELECT * FROM protocols WHERE tvl > 1000000',
  type: 'transactional',
  cache: true,
  cacheTTL: 300 // 5 minutes
});
```

## Monitoring and Health Checks

### 1. Integration Health

```typescript
// Get overall integration health
const health = await integrationManager.getHealthStatus();

console.log('Integration Health:', {
  isInitialized: health.isInitialized,
  syncStatus: health.syncStatus,
  databaseHealth: health.databaseHealth,
  kafkaConnected: health.kafkaConnected
});
```

### 2. CDC Monitoring

```typescript
// Monitor CDC performance
const cdcHealth = await cdcManager.getHealthStatus();

console.log('CDC Health:', {
  isInitialized: cdcHealth.isInitialized,
  pendingChanges: cdcHealth.pendingChanges,
  errorRate: cdcHealth.errorRate,
  kafkaConnected: cdcHealth.kafkaConnected
});
```

### 3. Query Performance

```typescript
// Monitor query performance
const cacheStats = queryManager.getCacheStats();

console.log('Query Cache Stats:', {
  totalEntries: cacheStats.totalEntries,
  totalSize: cacheStats.totalSize,
  averageEntrySize: cacheStats.averageEntrySize
});
```

## Error Handling and Recovery

### 1. CDC Error Recovery

```typescript
// Process failed CDC changes with retry
const failedChanges = await postgres.query(`
  SELECT * FROM cdc.change_log 
  WHERE error_message IS NOT NULL 
  AND retry_count < 3
`);

for (const change of failedChanges.rows) {
  try {
    await cdcManager.handleChange(change);
    await postgres.query(`
      UPDATE cdc.change_log 
      SET processed = TRUE, error_message = NULL 
      WHERE id = $1
    `, [change.id]);
  } catch (error) {
    logger.error(`Failed to process change ${change.id}:`, error);
  }
}
```

### 2. Data Reconciliation

```typescript
// Reconcile data inconsistencies
const inconsistencies = await integrationManager.validateDataConsistency();

for (const inconsistency of inconsistencies) {
  if (!inconsistency.isValid) {
    // Trigger reconciliation process
    await integrationManager.reconcileData(inconsistency.table);
  }
}
```

### 3. Connection Recovery

```typescript
// Automatic connection recovery
dbManager.on('error', async (error) => {
  logger.error('Database connection error:', error);
  
  // Attempt reconnection
  try {
    await dbManager.initialize();
    logger.info('Database connections recovered');
  } catch (reconnectError) {
    logger.error('Failed to reconnect:', reconnectError);
  }
});
```

## Configuration

### 1. Integration Configuration

```typescript
// Configure integration settings
integrationManager.updateConfig({
  postgresToClickhouse: {
    enabled: true,
    batchSize: 1000,
    syncInterval: 30000, // 30 seconds
    tables: ['transaction_history', 'portfolio_holdings', 'protocols']
  },
  validation: {
    enabled: true,
    checkInterval: 300000, // 5 minutes
    tolerance: 1.0 // 1% tolerance
  }
});
```

### 2. CDC Configuration

```typescript
// Configure CDC triggers
const cdcConfig = [
  {
    table: 'transaction_history',
    enabled: true,
    captureColumns: ['id', 'user_id', 'protocol_id', 'type', 'amount'],
    topic: 'defi.transactions'
  },
  {
    table: 'portfolio_holdings',
    enabled: true,
    captureColumns: ['id', 'user_id', 'asset_id', 'quantity', 'value_usd'],
    topic: 'defi.portfolio'
  }
];
```

### 3. Query Configuration

```typescript
// Configure query patterns
const queryPatterns = {
  'GET_USER_PORTFOLIO': {
    queries: [
      { database: 'postgres', query: 'SELECT * FROM portfolio_holdings WHERE user_id = $1' },
      { database: 'redis', query: 'portfolio:*' }
    ],
    aggregation: 'merge',
    joinKey: 'user_id'
  }
};
```

## Best Practices

### 1. Query Optimization

- Use appropriate query types for different data access patterns
- Leverage caching for frequently accessed data
- Use batch operations for large data sets
- Monitor query performance and optimize slow queries

### 2. Data Consistency

- Implement proper error handling and retry mechanisms
- Monitor data validation results regularly
- Use transaction boundaries for critical operations
- Implement proper rollback mechanisms

### 3. Performance Monitoring

- Monitor CDC processing latency
- Track query execution times
- Monitor cache hit rates
- Set up alerts for data inconsistencies

### 4. Scalability

- Use appropriate batch sizes for data synchronization
- Implement connection pooling
- Monitor resource usage
- Scale components independently

## Troubleshooting

### Common Issues

1. **CDC Processing Delays**
   - Check PostgreSQL trigger status
   - Monitor change log table size
   - Verify Kafka connectivity

2. **Data Inconsistencies**
   - Run data validation checks
   - Check sync status for affected tables
   - Review error logs for failed operations

3. **Query Performance Issues**
   - Check cache hit rates
   - Monitor database connection pools
   - Review query execution plans

4. **Connection Failures**
   - Check network connectivity
   - Verify database credentials
   - Monitor connection pool status

### Debug Commands

```typescript
// Debug CDC processing
const cdcStats = await cdcManager.getCDCStats();
console.log('CDC Stats:', cdcStats);

// Debug sync status
const syncStatus = integrationManager.getSyncStatus();
console.log('Sync Status:', syncStatus);

// Debug query cache
const cacheStats = queryManager.getCacheStats();
console.log('Cache Stats:', cacheStats);

// Debug database health
const health = await dbManager.getHealthMetrics();
console.log('Database Health:', health);
```

## Conclusion

The cross-database integration system provides a robust foundation for YieldSensei's multi-tiered database architecture. It ensures data consistency, provides real-time synchronization, and offers a unified interface for complex queries across all database systems.

The system is designed to be scalable, maintainable, and resilient, with comprehensive monitoring and error handling capabilities. It supports the high-performance requirements of DeFi applications while maintaining data integrity and consistency across all database tiers. 