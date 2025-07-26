# Qdrant Vector Database Setup

This directory contains the Docker Compose configuration and setup for Qdrant vector database, optimized for YieldSensei's DeFi semantic search and ML workloads.

## Overview

Qdrant is used for:
- **Protocol embeddings** for semantic search across DeFi protocols
- **Token embeddings** for financial analysis and correlations
- **User behavior embeddings** for personalization and recommendations
- **Strategy embeddings** for yield farming strategy recommendations
- **Document embeddings** for knowledge base search

## Quick Start

1. **Environment Setup**
   Add these variables to your `.env` file:
   ```bash
   # Vector Database (Qdrant)
   VECTOR_DB_URL=http://localhost:6333
   VECTOR_DB_HOST=localhost
   VECTOR_DB_PORT=6333
   VECTOR_DB_API_KEY=  # Optional, leave empty for development
   ```

2. **Start Qdrant Cluster**
   ```bash
   cd deployments/qdrant
   docker-compose up -d
   ```

3. **Verify Installation**
   ```bash
   # Check health
   curl http://localhost:6333/health
   
   # Check collections
   curl http://localhost:6333/collections
   ```

## Services

### Core Services
- **qdrant** (port 6333): Main vector database with HTTP API
- **qdrant-backup**: Automated backup service with retention management
- **qdrant-web-ui** (port 6334): Web interface for database management

### Supporting Services
- **embeddings-generator** (port 8001): Text-to-embeddings API service
- **vector-search-api** (port 8002): High-level search API with business logic
- **qdrant-metrics** (port 9090): Prometheus metrics exporter
- **redis-vector-cache** (port 6380): Cache for frequently accessed vectors

## Configuration

### Qdrant Server Config
The main configuration is in `config/config.yaml`:
- **Storage**: Optimized for SSD with memory mapping
- **Performance**: Tuned for DeFi workload patterns
- **HNSW Indexing**: Configured for high recall and performance
- **Snapshots**: Automatic backup every 6 hours
- **Rate Limiting**: Protects against abuse

### Collection Schemas
Pre-configured collections are automatically created:

1. **protocols** (384D): Protocol descriptions and metadata
2. **tokens** (384D): Token information and relationships
3. **user_behavior** (256D): User interaction patterns
4. **strategies** (512D): Yield farming strategy descriptions
5. **documents** (384D): Knowledge base articles

## Usage Examples

### Basic Search
```typescript
import { VectorManager } from '@/shared/database/vector-manager';

const vectorManager = VectorManager.getInstance({
  host: 'localhost',
  port: 6333,
});

await vectorManager.connect();

// Search for similar protocols
const results = await vectorManager.searchProtocols(
  queryVector,    // 384-dimensional embedding
  10,            // limit
  { category: 'lending' }  // optional filter
);
```

### Protocol Embeddings
```typescript
// Upsert protocol data
await vectorManager.upsertProtocols([
  {
    id: 'aave-v3',
    name: 'Aave V3',
    description: 'Decentralized lending protocol with cross-chain capabilities',
    category: 'lending',
    tvl: 5200000000,
    apy: 4.2,
    riskScore: 0.3,
    embedding: protocolEmbedding  // 384D vector
  }
]);
```

### Strategy Recommendations
```typescript
// Find similar strategies
const strategies = await vectorManager.searchStrategies(
  userPreferenceVector,
  'medium',  // risk level
  5.0       // minimum APY
);
```

## Monitoring

### Health Checks
- **Qdrant Health**: `http://localhost:6333/health`
- **Metrics**: `http://localhost:9090/metrics`
- **Web UI**: `http://localhost:6334`

### Key Metrics
- Collection points count
- Search latency (p50, p95, p99)
- Memory usage and disk space
- Index build time
- Backup success/failure

## Backup & Recovery

### Automatic Backups
- **Schedule**: Daily at 2 AM
- **Retention**: 30 days
- **Location**: `./backups/` directory
- **Format**: Qdrant snapshot format

### Manual Backup
```bash
# Create collection snapshot
curl -X POST http://localhost:6333/collections/{collection_name}/snapshots

# Create full snapshot
curl -X POST http://localhost:6333/snapshots
```

### Recovery
```bash
# Restore from snapshot
curl -X PUT http://localhost:6333/collections/{collection_name}/snapshots/upload \
  -F 'snapshot=@snapshot_file.snapshot'
```

## Performance Tuning

### Hardware Recommendations
- **CPU**: 4+ cores for indexing
- **RAM**: 8GB+ for collections with 1M+ vectors
- **Storage**: SSD required for good performance
- **Network**: Low latency for real-time search

### Optimization Settings
- **HNSW M**: 16 (balance between speed and memory)
- **ef_construct**: 100-200 (higher for better recall)
- **Segment size**: 5GB max per segment
- **Memory mapping**: Enabled for large collections

## Development

### Local Development
```bash
# Start only core services
docker-compose up qdrant qdrant-web-ui

# Start with cache
docker-compose up qdrant redis-vector-cache qdrant-web-ui
```

### Testing
```bash
# Run health checks
curl http://localhost:6333/health

# Test vector search
curl -X POST http://localhost:6333/collections/protocols/points/search \
  -H "Content-Type: application/json" \
  -d '{
    "vector": [0.1, 0.2, ...],
    "limit": 5
  }'
```

## Production Considerations

### Scaling
- **Horizontal**: Use Qdrant cluster mode with multiple nodes
- **Vertical**: Increase memory and CPU for better performance
- **Sharding**: Distribute collections across shards

### Security
- **API Keys**: Set `VECTOR_DB_API_KEY` for production
- **Network**: Use internal networks, limit external access
- **Backups**: Encrypt backup files, test recovery procedures

### Monitoring
- Set up alerts for disk space, memory usage
- Monitor search latency and success rates
- Track collection growth and replication lag

## Troubleshooting

### Common Issues
1. **High Memory Usage**: Reduce `hnsw_config.m` or enable more aggressive memory mapping
2. **Slow Searches**: Check HNSW parameters, consider increasing `ef` parameter
3. **Failed Backups**: Check disk space, permissions on backup directory
4. **Connection Timeouts**: Increase client timeout, check network connectivity

### Logs
```bash
# View Qdrant logs
docker-compose logs qdrant

# View backup logs
docker-compose logs qdrant-backup

# Real-time monitoring
docker-compose logs -f qdrant
```

## API Reference

### VectorManager Methods
- `connect()`: Establish connection to Qdrant
- `createCollection(schema)`: Create new vector collection
- `upsertPoints(collection, points)`: Add/update vectors
- `search(collection, params)`: Semantic search
- `getCollectionInfo(collection)`: Get collection statistics
- `createSnapshot(collection?)`: Create backup snapshot

For complete API documentation, see the VectorManager class in `src/shared/database/vector-manager.ts`.

## Support

For issues related to:
- **Qdrant server**: Check official Qdrant documentation
- **VectorManager**: See TypeScript source code and comments
- **Performance**: Review monitoring dashboards and logs
- **Data issues**: Use Qdrant web UI for debugging 