# YieldSensei Database Schema Design

## Overview

YieldSensei uses a multi-database architecture optimized for different data access patterns:

- **PostgreSQL**: Transactional data (ACID compliance)
- **ClickHouse**: High-frequency analytics and time-series data
- **Redis**: Real-time caching and session management
- **Vector Database (Qdrant)**: ML models and embeddings

## PostgreSQL Schema (Transactional Data)

### Core Tables

#### Users and Authentication
```sql
-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    user_type user_type_enum NOT NULL DEFAULT 'retail',
    kyc_status kyc_status_enum NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,
    settings JSONB DEFAULT '{}'::jsonb
);

-- User types enum
CREATE TYPE user_type_enum AS ENUM ('retail', 'institutional', 'family_office');
CREATE TYPE kyc_status_enum AS ENUM ('pending', 'verified', 'rejected', 'expired');

-- API keys for users
CREATE TABLE user_api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    key_hash VARCHAR(255) NOT NULL,
    name VARCHAR(100) NOT NULL,
    permissions JSONB NOT NULL DEFAULT '[]'::jsonb,
    is_active BOOLEAN DEFAULT true,
    expires_at TIMESTAMP WITH TIME ZONE,
    last_used_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User sessions
CREATE TABLE user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_token VARCHAR(255) UNIQUE NOT NULL,
    ip_address INET,
    user_agent TEXT,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### Portfolios and Assets
```sql
-- Portfolio management
CREATE TABLE portfolios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    risk_profile risk_profile_enum NOT NULL DEFAULT 'moderate',
    target_allocation JSONB NOT NULL DEFAULT '{}'::jsonb,
    rebalancing_strategy rebalancing_strategy_enum DEFAULT 'monthly',
    max_drawdown DECIMAL(5,4) DEFAULT 0.20,
    target_return DECIMAL(5,4) DEFAULT 0.15,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TYPE risk_profile_enum AS ENUM ('conservative', 'moderate', 'aggressive', 'custom');
CREATE TYPE rebalancing_strategy_enum AS ENUM ('daily', 'weekly', 'monthly', 'quarterly', 'dynamic');

-- Portfolio positions
CREATE TABLE portfolio_positions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    portfolio_id UUID NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
    asset_id UUID NOT NULL REFERENCES assets(id),
    quantity DECIMAL(36,18) NOT NULL,
    average_cost DECIMAL(36,18) NOT NULL,
    current_value DECIMAL(36,18) NOT NULL,
    allocation_percentage DECIMAL(5,4) NOT NULL,
    position_type position_type_enum NOT NULL,
    protocol_address VARCHAR(42),
    chain_id INTEGER,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TYPE position_type_enum AS ENUM ('spot', 'staked', 'lp_token', 'yield_farm', 'lending', 'borrowing');

-- Assets registry
CREATE TABLE assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    symbol VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    asset_type asset_type_enum NOT NULL,
    contract_address VARCHAR(42),
    chain_id INTEGER,
    decimals INTEGER DEFAULT 18,
    coingecko_id VARCHAR(100),
    is_active BOOLEAN DEFAULT true,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(symbol, chain_id)
);

CREATE TYPE asset_type_enum AS ENUM ('crypto', 'lp_token', 'staked_token', 'yield_token', 'rwa_token');
```

#### Trading and Transactions
```sql
-- Trading strategies
CREATE TABLE trading_strategies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    portfolio_id UUID NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
    satellite_id VARCHAR(50) NOT NULL, -- Which satellite manages this strategy
    strategy_type strategy_type_enum NOT NULL,
    name VARCHAR(255) NOT NULL,
    parameters JSONB NOT NULL DEFAULT '{}'::jsonb,
    performance_metrics JSONB DEFAULT '{}'::jsonb,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TYPE strategy_type_enum AS ENUM ('yield_farming', 'liquidity_provision', 'arbitrage', 'staking', 'lending');

-- Transaction records
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    portfolio_id UUID NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
    strategy_id UUID REFERENCES trading_strategies(id),
    transaction_hash VARCHAR(66) UNIQUE NOT NULL,
    chain_id INTEGER NOT NULL,
    block_number BIGINT NOT NULL,
    transaction_type transaction_type_enum NOT NULL,
    from_asset_id UUID REFERENCES assets(id),
    to_asset_id UUID REFERENCES assets(id),
    from_amount DECIMAL(36,18),
    to_amount DECIMAL(36,18),
    gas_used DECIMAL(36,18),
    gas_price DECIMAL(36,18),
    protocol_name VARCHAR(100),
    status transaction_status_enum NOT NULL DEFAULT 'pending',
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb
);

CREATE TYPE transaction_type_enum AS ENUM ('swap', 'stake', 'unstake', 'deposit', 'withdraw', 'claim', 'bridge');
CREATE TYPE transaction_status_enum AS ENUM ('pending', 'confirmed', 'failed', 'replaced');
```

#### Risk Management
```sql
-- Risk assessments
CREATE TABLE risk_assessments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    portfolio_id UUID NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
    assessment_type risk_assessment_type_enum NOT NULL,
    risk_score DECIMAL(5,4) NOT NULL, -- 0-1 scale
    confidence_level DECIMAL(5,4) NOT NULL,
    factors JSONB NOT NULL DEFAULT '{}'::jsonb,
    recommendations JSONB DEFAULT '{}'::jsonb,
    satellite_source VARCHAR(50) NOT NULL, -- Which satellite generated this
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE
);

CREATE TYPE risk_assessment_type_enum AS ENUM ('liquidation', 'correlation', 'protocol', 'market', 'regulatory');

-- Risk alerts
CREATE TABLE risk_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    portfolio_id UUID NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
    alert_type risk_alert_type_enum NOT NULL,
    severity severity_enum NOT NULL,
    message TEXT NOT NULL,
    details JSONB DEFAULT '{}'::jsonb,
    is_acknowledged BOOLEAN DEFAULT false,
    acknowledged_at TIMESTAMP WITH TIME ZONE,
    acknowledged_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    resolved_at TIMESTAMP WITH TIME ZONE
);

CREATE TYPE risk_alert_type_enum AS ENUM ('liquidation_risk', 'high_correlation', 'protocol_risk', 'unusual_activity');
CREATE TYPE severity_enum AS ENUM ('low', 'medium', 'high', 'critical');
```

#### Satellite System Management
```sql
-- Satellite agents registry
CREATE TABLE satellite_agents (
    id VARCHAR(50) PRIMARY KEY, -- sage, forge, pulse, etc.
    name VARCHAR(255) NOT NULL,
    description TEXT,
    agent_type agent_type_enum NOT NULL,
    implementation_type implementation_type_enum NOT NULL,
    version VARCHAR(50) NOT NULL,
    configuration JSONB NOT NULL DEFAULT '{}'::jsonb,
    performance_metrics JSONB DEFAULT '{}'::jsonb,
    health_status health_status_enum DEFAULT 'unknown',
    last_health_check TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TYPE agent_type_enum AS ENUM ('logic', 'builder', 'growth', 'security', 'sentiment', 'logistics', 'cross_chain', 'data');
CREATE TYPE implementation_type_enum AS ENUM ('custom', 'elizaos', 'hybrid');
CREATE TYPE health_status_enum AS ENUM ('healthy', 'degraded', 'unhealthy', 'unknown');

-- Agent tasks and coordination
CREATE TABLE agent_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id VARCHAR(50) NOT NULL REFERENCES satellite_agents(id),
    task_type VARCHAR(100) NOT NULL,
    priority INTEGER NOT NULL DEFAULT 5, -- 1-10 scale
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    status task_status_enum NOT NULL DEFAULT 'pending',
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    result JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TYPE task_status_enum AS ENUM ('pending', 'running', 'completed', 'failed', 'cancelled');
```

### Indexes and Performance Optimization

```sql
-- Performance indexes
CREATE INDEX idx_portfolios_user_id ON portfolios(user_id);
CREATE INDEX idx_portfolio_positions_portfolio_id ON portfolio_positions(portfolio_id);
CREATE INDEX idx_transactions_portfolio_id ON transactions(portfolio_id);
CREATE INDEX idx_transactions_timestamp ON transactions(timestamp DESC);
CREATE INDEX idx_transactions_chain_block ON transactions(chain_id, block_number);
CREATE INDEX idx_risk_assessments_portfolio_id ON risk_assessments(portfolio_id);
CREATE INDEX idx_risk_alerts_portfolio_severity ON risk_alerts(portfolio_id, severity);
CREATE INDEX idx_agent_tasks_agent_status ON agent_tasks(agent_id, status);

-- Composite indexes for common queries
CREATE INDEX idx_portfolio_positions_asset_type ON portfolio_positions(portfolio_id, position_type);
CREATE INDEX idx_transactions_type_status ON transactions(transaction_type, status);
CREATE INDEX idx_risk_assessments_type_score ON risk_assessments(assessment_type, risk_score DESC);
```

## ClickHouse Schema (Analytics Data)

### Market Data Tables
```sql
-- High-frequency price data
CREATE TABLE market_data (
    timestamp DateTime64(3),
    asset_id String,
    chain_id UInt32,
    price Decimal64(18),
    volume_24h Decimal64(18),
    market_cap Decimal64(18),
    price_change_24h Decimal64(8),
    source String
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (asset_id, timestamp)
SETTINGS index_granularity = 8192;

-- DEX trading data
CREATE TABLE dex_trades (
    timestamp DateTime64(3),
    chain_id UInt32,
    dex_name String,
    pair_address String,
    token0_address String,
    token1_address String,
    amount0 Decimal64(18),
    amount1 Decimal64(18),
    price Decimal64(18),
    transaction_hash String,
    block_number UInt64
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (chain_id, dex_name, timestamp)
SETTINGS index_granularity = 8192;

-- Yield farming metrics
CREATE TABLE yield_metrics (
    timestamp DateTime64(3),
    protocol_name String,
    pool_address String,
    chain_id UInt32,
    apy Decimal64(8),
    tvl Decimal64(18),
    rewards_apr Decimal64(8),
    trading_fees_apr Decimal64(8),
    impermanent_loss_risk Decimal64(8)
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (protocol_name, pool_address, timestamp)
SETTINGS index_granularity = 8192;
```

### Performance Analytics
```sql
-- Portfolio performance snapshots
CREATE TABLE portfolio_snapshots (
    timestamp DateTime64(3),
    portfolio_id String,
    total_value Decimal64(18),
    total_return Decimal64(8),
    daily_return Decimal64(8),
    sharpe_ratio Decimal64(8),
    max_drawdown Decimal64(8),
    volatility Decimal64(8),
    asset_allocation Map(String, Decimal64(8))
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (portfolio_id, timestamp)
SETTINGS index_granularity = 8192;

-- Risk metrics time series
CREATE TABLE risk_metrics (
    timestamp DateTime64(3),
    portfolio_id String,
    var_95 Decimal64(18), -- Value at Risk 95%
    cvar_95 Decimal64(18), -- Conditional Value at Risk
    correlation_score Decimal64(8),
    liquidation_distance Decimal64(8),
    protocol_risk_score Decimal64(8)
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (portfolio_id, timestamp)
SETTINGS index_granularity = 8192;
```

### Satellite Performance Metrics
```sql
-- Agent performance tracking
CREATE TABLE satellite_performance (
    timestamp DateTime64(3),
    agent_id String,
    metric_name String,
    metric_value Decimal64(18),
    response_time_ms UInt32,
    success_rate Decimal64(4),
    error_count UInt32,
    metadata Map(String, String)
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (agent_id, metric_name, timestamp)
SETTINGS index_granularity = 8192;
```

## Redis Schema (Caching Layer)

### Cache Key Patterns
```javascript
// Price data caching (TTL: 60 seconds)
const priceKeys = {
  current: 'price:current:{assetId}:{chainId}',
  historical: 'price:hist:{assetId}:{period}', // 1h, 24h, 7d
  alerts: 'price:alerts:{assetId}' // Price movement alerts
};

// Portfolio caching (TTL: 300 seconds)
const portfolioKeys = {
  positions: 'portfolio:positions:{portfolioId}',
  performance: 'portfolio:perf:{portfolioId}:{period}',
  risk: 'portfolio:risk:{portfolioId}',
  rebalancing: 'portfolio:rebalance:{portfolioId}'
};

// Satellite agent caching (TTL: 60 seconds)
const agentKeys = {
  health: 'agent:health:{agentId}',
  tasks: 'agent:tasks:{agentId}:pending',
  performance: 'agent:perf:{agentId}',
  config: 'agent:config:{agentId}' // TTL: 3600 seconds
};

// User session management (TTL: 24 hours)
const sessionKeys = {
  user: 'session:user:{sessionToken}',
  permissions: 'session:perms:{userId}',
  rateLimit: 'rate:limit:{userId}:{endpoint}' // TTL: 900 seconds
};
```

### Data Structures
```javascript
// Real-time risk monitoring (Sorted Sets for time-based queries)
const riskStructures = {
  liquidationRisk: 'risk:liquidation', // Score = risk level, Member = portfolioId
  correlationMatrix: 'risk:correlation:{portfolioId}', // Hash of asset correlations
  alertQueue: 'alerts:queue:high', // List of high-priority alerts
};

// Cross-chain arbitrage opportunities (TTL: 30 seconds)
const arbitrageStructures = {
  opportunities: 'arbitrage:opps', // Sorted set by profit potential
  routes: 'arbitrage:routes:{assetId}', // Hash of bridge routes
  fees: 'bridge:fees:{chainId}:{targetChainId}' // Current bridge fees
};
```

## Vector Database Schema (Qdrant)

### Collections for ML Models
```javascript
// Market sentiment embeddings
const sentimentCollection = {
  name: 'market_sentiment',
  vectors: {
    size: 384, // Sentence transformer dimensions
    distance: 'Cosine'
  },
  payload_schema: {
    timestamp: 'integer',
    source: 'keyword', // twitter, discord, news, etc.
    sentiment_score: 'float',
    confidence: 'float',
    asset_mentioned: 'keyword[]',
    content_hash: 'keyword'
  }
};

// Protocol analysis embeddings
const protocolCollection = {
  name: 'protocol_analysis',
  vectors: {
    size: 768, // BERT dimensions
    distance: 'Cosine'
  },
  payload_schema: {
    protocol_name: 'keyword',
    chain_id: 'integer',
    risk_score: 'float',
    tvl: 'float',
    audit_status: 'keyword',
    analysis_date: 'integer'
  }
};

// Trading pattern embeddings
const tradingCollection = {
  name: 'trading_patterns',
  vectors: {
    size: 512,
    distance: 'Cosine'
  },
  payload_schema: {
    pattern_type: 'keyword',
    success_rate: 'float',
    market_conditions: 'keyword[]',
    timeframe: 'keyword',
    assets_involved: 'keyword[]'
  }
};
```

## Database Migration Strategy

### Migration Scripts Structure
```sql
-- Version control for schema changes
CREATE TABLE schema_migrations (
    version VARCHAR(50) PRIMARY KEY,
    description TEXT NOT NULL,
    applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    rollback_sql TEXT
);

-- Initial data seeding
INSERT INTO satellite_agents VALUES
('sage', 'Sage - Logic & Research', 'Market analysis and RWA integration', 'logic', 'custom', '1.0.0', '{}', '{}', 'unknown', NULL, true, NOW(), NOW()),
('forge', 'Forge - Builder & Engineering', 'Smart contract optimization and MEV protection', 'builder', 'custom', '1.0.0', '{}', '{}', 'unknown', NULL, true, NOW(), NOW()),
('pulse', 'Pulse - Growth & Optimization', 'Yield farming and staking optimization', 'growth', 'hybrid', '1.0.0', '{}', '{}', 'unknown', NULL, true, NOW(), NOW()),
('aegis', 'Aegis - Security & Risk', 'Risk management and liquidation protection', 'security', 'custom', '1.0.0', '{}', '{}', 'unknown', NULL, true, NOW(), NOW()),
('echo', 'Echo - Sentiment & Community', 'Social monitoring and sentiment analysis', 'sentiment', 'elizaos', '1.0.0', '{}', '{}', 'unknown', NULL, true, NOW(), NOW()),
('fuel', 'Fuel - Logistics & Capital', 'Capital deployment and gas optimization', 'logistics', 'hybrid', '1.0.0', '{}', '{}', 'unknown', NULL, true, NOW(), NOW()),
('bridge', 'Bridge - Cross-Chain Operations', 'Multi-chain coordination and arbitrage', 'cross_chain', 'custom', '1.0.0', '{}', '{}', 'unknown', NULL, true, NOW(), NOW()),
('oracle', 'Oracle - Data Integrity', 'Data validation and RWA verification', 'data', 'hybrid', '1.0.0', '{}', '{}', 'unknown', NULL, true, NOW(), NOW());
```

## Performance Optimization Strategy

### Database-Specific Optimizations

#### PostgreSQL
- **Partitioning**: Time-based partitioning for large tables (transactions, risk_assessments)
- **Connection pooling**: PgBouncer for connection management
- **Read replicas**: For analytics queries and reporting
- **Materialized views**: For complex aggregations

#### ClickHouse  
- **Compression**: LZ4 compression for storage efficiency
- **Projections**: Pre-aggregated data for common queries
- **Distributed tables**: For horizontal scaling
- **TTL policies**: Automatic data retention management

#### Redis
- **Memory optimization**: Use appropriate data structures
- **Clustering**: Redis Cluster for high availability
- **Persistence**: RDB + AOF for durability
- **Monitoring**: Redis Sentinel for failover

This multi-database architecture ensures optimal performance for each data access pattern while maintaining consistency and reliability across the YieldSensei platform.