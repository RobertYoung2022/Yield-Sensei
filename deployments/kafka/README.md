# Kafka Streaming Architecture for YieldSensei

This directory contains the comprehensive Kafka streaming infrastructure for YieldSensei, designed to handle real-time DeFi data processing, risk assessment, and cross-chain arbitrage detection.

## Overview

The Kafka streaming architecture provides:

- **Real-time Data Ingestion**: Capture DeFi protocol data, market prices, user transactions, and cross-chain events
- **Stream Processing**: Price aggregation, risk assessment, and arbitrage detection
- **Database Integration**: Seamless data flow between PostgreSQL, ClickHouse, Redis, and Vector DB
- **High Availability**: 3-broker cluster with replication and monitoring
- **Scalability**: Horizontal scaling with partitioned topics and consumer groups

## Architecture Components

### Core Infrastructure

1. **Zookeeper**: Coordination service for Kafka cluster management
2. **Kafka Brokers (3x)**: Distributed messaging backbone with replication factor 3
3. **Schema Registry**: Avro schema management for structured data
4. **Kafka Connect**: Database integration connectors
5. **KSQL**: Stream processing SQL engine

### Monitoring & Management

1. **Control Center**: Web UI for cluster monitoring and management
2. **Kafdrop**: Lightweight Kafka topic browser
3. **Lag Exporter**: Consumer lag monitoring for Prometheus
4. **JMX Metrics**: Performance monitoring endpoints

## Topic Architecture

### DeFi Data Streams

```
defi.protocols       (12 partitions, RF=3)  - Protocol metadata and updates
defi.tokens          (12 partitions, RF=3)  - Token information and prices
defi.transactions    (24 partitions, RF=3)  - User transactions (high volume)
defi.liquidity-pools (12 partitions, RF=3)  - Liquidity pool data
defi.yields          (6 partitions, RF=3)   - Yield farming data
```

### Market Data Streams

```
market.prices        (12 partitions, RF=3)  - Real-time price feeds
market.analytics     (6 partitions, RF=3)   - Aggregated market metrics
market.sentiment     (6 partitions, RF=3)   - Social sentiment data
```

### User & System Events

```
users.events         (6 partitions, RF=3)   - User activity events
users.portfolios     (6 partitions, RF=3)   - Portfolio updates
system.alerts        (3 partitions, RF=3)   - System notifications
system.metrics       (3 partitions, RF=3)   - Application metrics
```

### Risk Management

```
risk.assessments     (6 partitions, RF=3)   - Risk calculation results
risk.alerts          (6 partitions, RF=3)   - Risk-based alerts
```

### Cross-Chain Data

```
crosschain.events    (12 partitions, RF=3)  - Cross-chain transactions
crosschain.arbitrage (6 partitions, RF=3)   - Arbitrage opportunities
```

## Quick Start

### 1. Environment Setup

Add these variables to your `.env` file:

```bash
# Kafka Configuration
KAFKA_BOOTSTRAP_SERVERS=localhost:9092,localhost:9093,localhost:9094
KAFKA_CLIENT_ID=yieldsensei-app
KAFKA_CONSUMER_GROUP=yieldsensei-consumers
```

### 2. Start Kafka Cluster

```bash
cd deployments/kafka
docker-compose up -d
```

### 3. Verify Installation

```bash
# Check cluster health
curl http://localhost:9021/health

# View topics
docker exec yieldsensei-kafka-1 kafka-topics --bootstrap-server localhost:9092 --list

# Check consumer groups
docker exec yieldsensei-kafka-1 kafka-consumer-groups --bootstrap-server localhost:9092 --list
```

### 4. Access Management UIs

- **Confluent Control Center**: http://localhost:9021
- **Kafdrop**: http://localhost:9000
- **Schema Registry**: http://localhost:8081
- **Kafka Connect**: http://localhost:8083
- **KSQL Server**: http://localhost:8088

## Data Flow Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   PostgreSQL    │────▶│   Kafka Connect │────▶│  Kafka Topics   │
│   (Source)      │     │   (Debezium)    │     │  (defi.*)       │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                                          │
┌─────────────────┐     ┌─────────────────┐     ┌─────────▼─────────┐
│   ClickHouse    │◀────│   Kafka Connect │◀────│ Stream Processors │
│   (Analytics)   │     │   (Sink)        │     │ - Price Agg      │
└─────────────────┘     └─────────────────┘     │ - Risk Calc      │
                                                │ - Arbitrage      │
┌─────────────────┐     ┌─────────────────┐     └───────────────────┘
│   Vector DB     │◀────│   Vector Sink   │
│   (Embeddings)  │     │   (Custom)      │
└─────────────────┘     └─────────────────┘
```

## Stream Processing Components

### 1. Price Aggregation Processor

**Purpose**: Aggregate price updates and calculate time-weighted average prices (TWAP)

**Consumer Group**: `price-aggregation-processor`

**Input Topics**: `market.prices`

**Output Topics**: `market.analytics`

**Features**:
- 1-minute sliding window TWAP calculation
- Price volatility calculation
- Multi-source price consolidation

### 2. Risk Assessment Processor

**Purpose**: Real-time risk calculation for positions and portfolios

**Consumer Group**: `risk-assessment-processor`

**Input Topics**: `defi.transactions`, `users.portfolios`, `market.analytics`

**Output Topics**: `risk.assessments`, `risk.alerts`

**Features**:
- Position-level risk scoring
- Portfolio diversification analysis
- Volatility-based risk alerts
- Liquidation risk monitoring

### 3. Cross-Chain Arbitrage Processor

**Purpose**: Detect arbitrage opportunities across blockchain networks

**Consumer Group**: `crosschain-arbitrage-processor`

**Input Topics**: `market.prices`, `crosschain.events`

**Output Topics**: `crosschain.arbitrage`

**Features**:
- Multi-chain price comparison
- Spread calculation and thresholding
- Liquidity-adjusted opportunity scoring
- Real-time alert generation

## Database Integration

### PostgreSQL Source Connector

**Configuration**: `connectors/postgres-source.json`

**Tables Monitored**:
- users, portfolios, transactions
- protocols, tokens, liquidity_pools
- yield_strategies, risk_assessments

**Features**:
- Change Data Capture (CDC) with Debezium
- Schema evolution support
- Snapshot + streaming mode

### ClickHouse Sink Connector

**Configuration**: `connectors/clickhouse-sink.json`

**Target Tables**:
- transactions, market_data, analytics
- yield_data, risk_data, crosschain_data

**Features**:
- Automatic table creation
- Batch processing for performance
- Exactly-once delivery semantics

### Vector Database Sink Connector

**Configuration**: `connectors/vector-sink.json`

**Collections**:
- protocols → protocols collection
- tokens → tokens collection
- portfolios → user_behavior collection
- sentiment → documents collection

**Features**:
- Automatic embedding generation
- Payload field mapping
- Upsert mode for updates

## Usage Examples

### Basic Producer (TypeScript)

```typescript
import { KafkaManager } from '@/shared/streaming/kafka-manager';

const kafkaManager = KafkaManager.getInstance({
  clientId: 'yieldsensei-producer',
  brokers: ['localhost:9092', 'localhost:9093', 'localhost:9094']
});

await kafkaManager.connect();

// Produce protocol data
await kafkaManager.produceProtocolData({
  id: 'aave-v3',
  name: 'Aave V3',
  description: 'Decentralized lending protocol',
  category: 'lending',
  tvl: 5200000000,
  apy: 4.2,
  riskScore: 0.3
});
```

### Basic Consumer (TypeScript)

```typescript
// Subscribe to risk alerts
await kafkaManager.subscribe({
  topics: ['risk.alerts'],
  groupId: 'risk-notification-service',
  handler: async (message) => {
    const alert = JSON.parse(message.value);
    console.log(`Risk Alert: ${alert.message}`);
    
    // Send notification to user
    await sendNotification(alert.userId, alert.message);
  }
});
```

### Stream Processing Pipeline

```typescript
import { StreamProcessorManager } from '@/shared/streaming/stream-processors';

const streamManager = new StreamProcessorManager(kafkaManager);
await streamManager.start();

// Processors automatically handle:
// - Price aggregation → market.analytics
// - Risk assessment → risk.assessments + risk.alerts  
// - Arbitrage detection → crosschain.arbitrage
```

## Performance Tuning

### Producer Configuration

```typescript
const kafkaConfig = {
  // High throughput settings
  'batch.size': 65536,
  'linger.ms': 100,
  'compression.type': 'snappy',
  'buffer.memory': 67108864,
  
  // Reliability settings
  'acks': 'all',
  'retries': 5,
  'max.in.flight.requests.per.connection': 1,
  'enable.idempotence': true
};
```

### Consumer Configuration

```typescript
const consumerConfig = {
  // Performance settings
  'fetch.min.bytes': 1024,
  'fetch.max.wait.ms': 500,
  'max.partition.fetch.bytes': 1048576,
  'max.poll.records': 1000,
  
  // Reliability settings
  'session.timeout.ms': 30000,
  'heartbeat.interval.ms': 3000,
  'enable.auto.commit': false  // Manual commit for exactly-once
};
```

### Topic Configuration

```bash
# High throughput topic
kafka-topics --create --topic defi.transactions \
  --partitions 24 \
  --replication-factor 3 \
  --config compression.type=snappy \
  --config segment.ms=86400000 \
  --config retention.ms=2592000000

# Compacted topic for latest state
kafka-topics --create --topic defi.protocols \
  --partitions 12 \
  --replication-factor 3 \
  --config cleanup.policy=compact \
  --config compression.type=snappy
```

## Monitoring

### Key Metrics to Monitor

1. **Throughput**:
   - Messages/sec per topic
   - Bytes/sec ingestion rate
   - Consumer lag per partition

2. **Latency**:
   - End-to-end message latency
   - Producer send time
   - Consumer processing time

3. **Availability**:
   - Broker uptime
   - Under-replicated partitions
   - Failed producer/consumer instances

4. **Resource Usage**:
   - CPU and memory per broker
   - Disk usage and I/O
   - Network bandwidth

### Monitoring Stack

```yaml
# Prometheus metrics endpoints
- Kafka JMX: :9101, :9102, :9103
- Lag Exporter: :8000
- Connect: :8083/metrics
- Schema Registry: :8081/metrics

# Log aggregation
- Kafka broker logs: /var/log/kafka/
- Connect logs: /var/log/connect/
- Application logs: /var/log/app/
```

### Alerting Rules

```yaml
# High consumer lag
- alert: HighConsumerLag
  expr: kafka_consumer_lag_sum > 10000
  for: 5m

# Under-replicated partitions  
- alert: UnderReplicatedPartitions
  expr: kafka_server_replicamanager_underreplicatedpartitions > 0
  for: 2m

# Broker down
- alert: BrokerDown
  expr: up{job="kafka"} == 0
  for: 1m
```

## Security Configuration

### Authentication (SASL)

```yaml
# docker-compose.yml
environment:
  KAFKA_SASL_ENABLED_MECHANISMS: SCRAM-SHA-512
  KAFKA_SASL_MECHANISM_INTER_BROKER_PROTOCOL: SCRAM-SHA-512
  KAFKA_SECURITY_INTER_BROKER_PROTOCOL: SASL_SSL
  KAFKA_SASL_JAAS_CONFIG: |
    org.apache.kafka.common.security.scram.ScramLoginModule required
    username="admin"
    password="admin-secret";
```

### Authorization (ACLs)

```bash
# Create service user
kafka-configs --zookeeper zookeeper:2181 \
  --alter --add-config 'SCRAM-SHA-512=[password=service-secret]' \
  --entity-type users --entity-name yieldsensei-service

# Grant permissions
kafka-acls --authorizer kafka.security.auth.SimpleAclAuthorizer \
  --authorizer-properties zookeeper.connect=zookeeper:2181 \
  --add --allow-principal User:yieldsensei-service \
  --operation All --topic defi.*
```

### SSL/TLS Encryption

```yaml
# SSL configuration
KAFKA_SSL_KEYSTORE_LOCATION: /var/ssl/private/kafka.keystore.jks
KAFKA_SSL_KEYSTORE_PASSWORD: keystore-password
KAFKA_SSL_KEY_PASSWORD: key-password
KAFKA_SSL_TRUSTSTORE_LOCATION: /var/ssl/private/kafka.truststore.jks
KAFKA_SSL_TRUSTSTORE_PASSWORD: truststore-password
```

## Troubleshooting

### Common Issues

1. **Topic Creation Fails**
   ```bash
   # Check broker connectivity
   kafka-broker-api-versions --bootstrap-server localhost:9092
   
   # Verify topic configuration
   kafka-topics --describe --topic defi.protocols --bootstrap-server localhost:9092
   ```

2. **Consumer Lag Increasing**
   ```bash
   # Check consumer group status
   kafka-consumer-groups --describe --group price-aggregation-processor \
     --bootstrap-server localhost:9092
   
   # Reset consumer offset if needed
   kafka-consumer-groups --reset-offsets --group price-aggregation-processor \
     --topic market.prices --to-latest --bootstrap-server localhost:9092
   ```

3. **Connect Task Failures**
   ```bash
   # Check connector status
   curl http://localhost:8083/connectors/yieldsensei-postgres-source/status
   
   # View connector logs
   docker logs yieldsensei-kafka-connect
   ```

4. **Schema Registry Issues**
   ```bash
   # List schemas
   curl http://localhost:8081/subjects
   
   # Get schema details
   curl http://localhost:8081/subjects/defi.protocols-value/versions/latest
   ```

### Performance Issues

1. **High Memory Usage**
   - Increase broker heap size: `KAFKA_HEAP_OPTS: "-Xmx4G -Xms4G"`
   - Tune batch sizes and buffer memory
   - Enable compression

2. **Slow Consumer Processing**
   - Increase partition count for parallelism
   - Optimize consumer batch processing
   - Scale consumer instances

3. **Network Bottlenecks**
   - Monitor network I/O per broker
   - Consider rack-aware replica placement
   - Optimize serialization format

### Data Quality Issues

1. **Schema Evolution**
   - Use backward/forward compatible schemas
   - Version schema changes properly
   - Test compatibility before deployment

2. **Message Ordering**
   - Use message keys for partition assignment
   - Configure idempotent producers
   - Handle duplicate messages in consumers

## Development Workflow

### Local Development

```bash
# Start minimal cluster for development
docker-compose up zookeeper kafka-broker-1 schema-registry

# Create development topics
./scripts/create-dev-topics.sh

# Run application with local Kafka
npm run dev
```

### Testing

```bash
# Unit tests
npm test

# Integration tests with test containers
npm run test:integration

# Load testing
npm run test:load
```

### Deployment

```bash
# Production deployment
docker-compose -f docker-compose.prod.yml up -d

# Apply connector configurations
./scripts/deploy-connectors.sh

# Verify deployment
./scripts/health-check.sh
```

## Support

For issues related to:
- **Kafka Infrastructure**: Check broker logs and cluster health
- **Stream Processing**: Review processor logs and consumer lag
- **Database Integration**: Verify connector status and configurations
- **Performance**: Monitor JMX metrics and resource usage

**Useful Commands**:
```bash
# View all logs
docker-compose logs -f

# Check specific service
docker-compose logs kafka-broker-1

# Monitor consumer lag
docker exec yieldsensei-lag-exporter curl localhost:8000/metrics
``` 