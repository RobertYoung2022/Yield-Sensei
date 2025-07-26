-- YieldSensei PostgreSQL Schema Design
-- Multi-tiered database architecture for DeFi yield farming platform
-- Implements partitioning strategy for scalable transaction history storage

-- ============================================================================
-- EXTENSIONS
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ============================================================================
-- CUSTOM TYPES
-- ============================================================================

-- Portfolio asset types
CREATE TYPE asset_type AS ENUM (
    'NATIVE',           -- ETH, MATIC, etc.
    'ERC20',           -- Standard tokens
    'LP_TOKEN',        -- Liquidity provider tokens
    'YIELD_TOKEN',     -- Yield-bearing tokens
    'SYNTHETIC',       -- Synthetic assets
    'NFT'              -- Non-fungible tokens
);

-- Transaction types for comprehensive tracking
CREATE TYPE transaction_type AS ENUM (
    'DEPOSIT',
    'WITHDRAWAL',
    'SWAP',
    'STAKE',
    'UNSTAKE',
    'CLAIM_REWARDS',
    'LIQUIDITY_ADD',
    'LIQUIDITY_REMOVE',
    'BRIDGE',
    'FEE_PAYMENT'
);

-- Transaction status for tracking completion
CREATE TYPE transaction_status AS ENUM (
    'PENDING',
    'CONFIRMED',
    'FAILED',
    'CANCELLED'
);

-- Protocol categories for yield farming strategies
CREATE TYPE protocol_category AS ENUM (
    'DEX',             -- Decentralized exchanges
    'LENDING',         -- Lending protocols
    'YIELD_FARMING',   -- Yield farming platforms
    'LIQUID_STAKING',  -- Liquid staking protocols
    'DERIVATIVES',     -- Derivatives platforms
    'BRIDGE',          -- Cross-chain bridges
    'OTHER'
);

-- Risk levels for strategy assessment
CREATE TYPE risk_level AS ENUM (
    'LOW',
    'MEDIUM',
    'HIGH',
    'VERY_HIGH'
);

-- ============================================================================
-- CORE TABLES
-- ============================================================================

-- Users table with comprehensive profile management
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Identity
    address VARCHAR(42) UNIQUE NOT NULL,        -- Ethereum address
    username VARCHAR(50) UNIQUE,                -- Optional username
    email VARCHAR(255) UNIQUE,                  -- Optional email
    
    -- Profile
    display_name VARCHAR(100),
    avatar_url TEXT,
    bio TEXT,
    
    -- Settings
    default_slippage DECIMAL(5,4) DEFAULT 0.005,  -- 0.5% default
    auto_compound BOOLEAN DEFAULT true,
    notification_preferences JSONB DEFAULT '{}',
    risk_tolerance risk_level DEFAULT 'MEDIUM',
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_active_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Security
    is_active BOOLEAN DEFAULT true,
    is_verified BOOLEAN DEFAULT false,
    kyc_level INTEGER DEFAULT 0,
    
    -- Constraints
    CONSTRAINT valid_address CHECK (address ~ '^0x[a-fA-F0-9]{40}$'),
    CONSTRAINT valid_slippage CHECK (default_slippage >= 0 AND default_slippage <= 1),
    CONSTRAINT valid_kyc_level CHECK (kyc_level >= 0 AND kyc_level <= 3)
);

-- Protocols table for supported DeFi protocols
CREATE TABLE protocols (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Protocol identity
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(50) UNIQUE NOT NULL,
    website_url TEXT,
    
    -- Classification
    category protocol_category NOT NULL,
    risk_level risk_level NOT NULL,
    
    -- Technical details
    contract_addresses JSONB NOT NULL DEFAULT '{}',  -- Chain -> contract mapping
    supported_chains INTEGER[] NOT NULL DEFAULT '{}',
    api_endpoints JSONB DEFAULT '{}',
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    is_audited BOOLEAN DEFAULT false,
    audit_reports JSONB DEFAULT '[]',
    
    -- Metadata
    description TEXT,
    logo_url TEXT,
    docs_url TEXT,
    
    -- Analytics
    tvl_usd DECIMAL(20,2),
    apy_range JSONB,  -- {min: number, max: number}
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Assets table for tracking all supported assets
CREATE TABLE assets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Asset identity
    symbol VARCHAR(20) NOT NULL,
    name VARCHAR(100) NOT NULL,
    asset_type asset_type NOT NULL,
    
    -- Contract details
    chain_id INTEGER NOT NULL,
    contract_address VARCHAR(42),
    decimals INTEGER NOT NULL DEFAULT 18,
    
    -- Metadata
    description TEXT,
    logo_url TEXT,
    website_url TEXT,
    coingecko_id VARCHAR(100),
    
    -- Price tracking
    price_usd DECIMAL(20,8),
    price_updated_at TIMESTAMP WITH TIME ZONE,
    market_cap_usd DECIMAL(20,2),
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    is_verified BOOLEAN DEFAULT false,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    UNIQUE (symbol, chain_id),
    CONSTRAINT valid_contract_address CHECK (
        contract_address IS NULL OR 
        contract_address ~ '^0x[a-fA-F0-9]{40}$'
    ),
    CONSTRAINT valid_decimals CHECK (decimals >= 0 AND decimals <= 18)
);

-- Portfolio holdings with real-time balance tracking
CREATE TABLE portfolio_holdings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Ownership
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    asset_id UUID NOT NULL REFERENCES assets(id),
    protocol_id UUID REFERENCES protocols(id),
    
    -- Position details
    balance DECIMAL(28,18) NOT NULL DEFAULT 0,  -- Raw token amount
    balance_usd DECIMAL(20,2) NOT NULL DEFAULT 0,
    
    -- Strategy context
    strategy_name VARCHAR(100),
    position_type VARCHAR(50),  -- 'spot', 'staked', 'lp', 'borrowed'
    
    -- Performance tracking
    initial_investment_usd DECIMAL(20,2),
    unrealized_pnl_usd DECIMAL(20,2) DEFAULT 0,
    realized_pnl_usd DECIMAL(20,2) DEFAULT 0,
    
    -- APY tracking
    current_apy DECIMAL(8,4),
    average_apy DECIMAL(8,4),
    
    -- Metadata
    notes TEXT,
    tags VARCHAR(50)[],
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    UNIQUE (user_id, asset_id, protocol_id, position_type),
    CONSTRAINT positive_balance CHECK (balance >= 0),
    CONSTRAINT positive_balance_usd CHECK (balance_usd >= 0)
);

-- ============================================================================
-- PARTITIONED TABLES FOR HISTORICAL DATA
-- ============================================================================

-- Transaction history with date-based partitioning for scalability
CREATE TABLE transaction_history (
    id UUID DEFAULT uuid_generate_v4(),
    
    -- Transaction identity
    tx_hash VARCHAR(66) NOT NULL,
    chain_id INTEGER NOT NULL,
    block_number BIGINT NOT NULL,
    transaction_index INTEGER,
    
    -- User context
    user_id UUID NOT NULL REFERENCES users(id),
    
    -- Transaction details
    transaction_type transaction_type NOT NULL,
    status transaction_status NOT NULL,
    
    -- Asset information
    asset_id UUID NOT NULL REFERENCES assets(id),
    protocol_id UUID REFERENCES protocols(id),
    
    -- Financial data
    amount DECIMAL(28,18) NOT NULL,
    amount_usd DECIMAL(20,2),
    gas_used BIGINT,
    gas_price_gwei DECIMAL(10,2),
    gas_cost_usd DECIMAL(10,4),
    
    -- Strategy context
    strategy_name VARCHAR(100),
    position_context JSONB,  -- Additional position-specific data
    
    -- Timestamps
    block_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Metadata
    notes TEXT,
    external_id VARCHAR(100),  -- For reconciliation with external systems
    
    -- Constraints
    CONSTRAINT valid_tx_hash CHECK (tx_hash ~ '^0x[a-fA-F0-9]{64}$'),
    CONSTRAINT positive_amount CHECK (amount >= 0),
    CONSTRAINT valid_gas_used CHECK (gas_used IS NULL OR gas_used >= 0)
    
) PARTITION BY RANGE (block_timestamp);

-- Create monthly partitions for transaction history (example for 2024-2025)
CREATE TABLE transaction_history_2024_01 PARTITION OF transaction_history
    FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');
CREATE TABLE transaction_history_2024_02 PARTITION OF transaction_history
    FOR VALUES FROM ('2024-02-01') TO ('2024-03-01');
CREATE TABLE transaction_history_2024_03 PARTITION OF transaction_history
    FOR VALUES FROM ('2024-03-01') TO ('2024-04-01');
CREATE TABLE transaction_history_2024_04 PARTITION OF transaction_history
    FOR VALUES FROM ('2024-04-01') TO ('2024-05-01');
CREATE TABLE transaction_history_2024_05 PARTITION OF transaction_history
    FOR VALUES FROM ('2024-05-01') TO ('2024-06-01');
CREATE TABLE transaction_history_2024_06 PARTITION OF transaction_history
    FOR VALUES FROM ('2024-06-01') TO ('2024-07-01');
CREATE TABLE transaction_history_2024_07 PARTITION OF transaction_history
    FOR VALUES FROM ('2024-07-01') TO ('2024-08-01');
CREATE TABLE transaction_history_2024_08 PARTITION OF transaction_history
    FOR VALUES FROM ('2024-08-01') TO ('2024-09-01');
CREATE TABLE transaction_history_2024_09 PARTITION OF transaction_history
    FOR VALUES FROM ('2024-09-01') TO ('2024-10-01');
CREATE TABLE transaction_history_2024_10 PARTITION OF transaction_history
    FOR VALUES FROM ('2024-10-01') TO ('2024-11-01');
CREATE TABLE transaction_history_2024_11 PARTITION OF transaction_history
    FOR VALUES FROM ('2024-11-01') TO ('2024-12-01');
CREATE TABLE transaction_history_2024_12 PARTITION OF transaction_history
    FOR VALUES FROM ('2024-12-01') TO ('2025-01-01');

-- Portfolio snapshots for historical performance tracking
CREATE TABLE portfolio_snapshots (
    id UUID DEFAULT uuid_generate_v4(),
    
    -- Snapshot context
    user_id UUID NOT NULL REFERENCES users(id),
    snapshot_date DATE NOT NULL,
    
    -- Portfolio metrics
    total_value_usd DECIMAL(20,2) NOT NULL,
    total_invested_usd DECIMAL(20,2) NOT NULL,
    total_pnl_usd DECIMAL(20,2) NOT NULL,
    total_yield_earned_usd DECIMAL(20,2) NOT NULL,
    
    -- Performance metrics
    portfolio_apy DECIMAL(8,4),
    sharpe_ratio DECIMAL(8,4),
    max_drawdown DECIMAL(8,4),
    
    -- Asset allocation
    asset_allocation JSONB NOT NULL,  -- {asset_id: {value_usd, percentage}}
    protocol_allocation JSONB NOT NULL,  -- {protocol_id: {value_usd, percentage}}
    
    -- Risk metrics
    portfolio_risk_score DECIMAL(4,2),
    concentration_risk DECIMAL(4,2),
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    UNIQUE (user_id, snapshot_date),
    CONSTRAINT positive_total_value CHECK (total_value_usd >= 0)
    
) PARTITION BY RANGE (snapshot_date);

-- Create quarterly partitions for portfolio snapshots
CREATE TABLE portfolio_snapshots_2024_q1 PARTITION OF portfolio_snapshots
    FOR VALUES FROM ('2024-01-01') TO ('2024-04-01');
CREATE TABLE portfolio_snapshots_2024_q2 PARTITION OF portfolio_snapshots
    FOR VALUES FROM ('2024-04-01') TO ('2024-07-01');
CREATE TABLE portfolio_snapshots_2024_q3 PARTITION OF portfolio_snapshots
    FOR VALUES FROM ('2024-07-01') TO ('2024-10-01');
CREATE TABLE portfolio_snapshots_2024_q4 PARTITION OF portfolio_snapshots
    FOR VALUES FROM ('2024-10-01') TO ('2025-01-01');

-- ============================================================================
-- INDEXES FOR OPTIMAL QUERY PERFORMANCE
-- ============================================================================

-- Users table indexes
CREATE INDEX idx_users_address ON users(address);
CREATE INDEX idx_users_active ON users(is_active);
CREATE INDEX idx_users_last_active ON users(last_active_at DESC);

-- Protocols table indexes
CREATE INDEX idx_protocols_category ON protocols(category);
CREATE INDEX idx_protocols_active ON protocols(is_active);
CREATE INDEX idx_protocols_risk_level ON protocols(risk_level);

-- Assets table indexes
CREATE INDEX idx_assets_symbol_chain ON assets(symbol, chain_id);
CREATE INDEX idx_assets_active ON assets(is_active);
CREATE INDEX idx_assets_type ON assets(asset_type);

-- Portfolio holdings indexes
CREATE INDEX idx_portfolio_user ON portfolio_holdings(user_id);
CREATE INDEX idx_portfolio_asset ON portfolio_holdings(asset_id);
CREATE INDEX idx_portfolio_protocol ON portfolio_holdings(protocol_id);
CREATE INDEX idx_portfolio_user_protocol ON portfolio_holdings(user_id, protocol_id);
CREATE INDEX idx_portfolio_updated ON portfolio_holdings(updated_at DESC);

-- Transaction history indexes (applied to all partitions)
CREATE INDEX idx_transaction_user_time ON transaction_history(user_id, block_timestamp DESC);
CREATE INDEX idx_transaction_hash ON transaction_history(tx_hash);
CREATE INDEX idx_transaction_type ON transaction_history(transaction_type);
CREATE INDEX idx_transaction_status ON transaction_history(status);
CREATE INDEX idx_transaction_asset ON transaction_history(asset_id);
CREATE INDEX idx_transaction_protocol ON transaction_history(protocol_id);
CREATE INDEX idx_transaction_user_asset ON transaction_history(user_id, asset_id);

-- Portfolio snapshots indexes (applied to all partitions)
CREATE INDEX idx_snapshots_user_date ON portfolio_snapshots(user_id, snapshot_date DESC);
CREATE INDEX idx_snapshots_date ON portfolio_snapshots(snapshot_date DESC);

-- Full-text search indexes
CREATE INDEX idx_protocols_name_search ON protocols USING gin (name gin_trgm_ops);
CREATE INDEX idx_assets_name_search ON assets USING gin (name gin_trgm_ops);

-- ============================================================================
-- VIEWS FOR COMMON QUERIES
-- ============================================================================

-- User portfolio summary view
CREATE VIEW user_portfolio_summary AS
SELECT 
    u.id as user_id,
    u.address,
    u.display_name,
    COUNT(DISTINCT ph.asset_id) as asset_count,
    COUNT(DISTINCT ph.protocol_id) as protocol_count,
    SUM(ph.balance_usd) as total_value_usd,
    AVG(ph.current_apy) as average_apy,
    SUM(ph.unrealized_pnl_usd + ph.realized_pnl_usd) as total_pnl_usd
FROM users u
LEFT JOIN portfolio_holdings ph ON u.id = ph.user_id
WHERE u.is_active = true
GROUP BY u.id, u.address, u.display_name;

-- Protocol TVL summary view
CREATE VIEW protocol_tvl_summary AS
SELECT 
    p.id as protocol_id,
    p.name,
    p.category,
    p.risk_level,
    COUNT(DISTINCT ph.user_id) as user_count,
    SUM(ph.balance_usd) as total_tvl_usd,
    AVG(ph.current_apy) as average_apy
FROM protocols p
LEFT JOIN portfolio_holdings ph ON p.id = ph.protocol_id
WHERE p.is_active = true
GROUP BY p.id, p.name, p.category, p.risk_level;

-- Recent transactions view (last 30 days)
CREATE VIEW recent_transactions AS
SELECT 
    th.id,
    th.tx_hash,
    th.user_id,
    u.address as user_address,
    th.transaction_type,
    th.status,
    a.symbol as asset_symbol,
    p.name as protocol_name,
    th.amount,
    th.amount_usd,
    th.block_timestamp
FROM transaction_history th
JOIN users u ON th.user_id = u.id
JOIN assets a ON th.asset_id = a.id
LEFT JOIN protocols p ON th.protocol_id = p.id
WHERE th.block_timestamp >= NOW() - INTERVAL '30 days'
ORDER BY th.block_timestamp DESC;

-- ============================================================================
-- TRIGGERS AND FUNCTIONS
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers to relevant tables
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_protocols_updated_at BEFORE UPDATE ON protocols
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_assets_updated_at BEFORE UPDATE ON assets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_portfolio_updated_at BEFORE UPDATE ON portfolio_holdings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to automatically create new partitions
CREATE OR REPLACE FUNCTION create_monthly_partition(table_name text, start_date date)
RETURNS void AS $$
DECLARE
    partition_name text;
    end_date date;
BEGIN
    partition_name := table_name || '_' || to_char(start_date, 'YYYY_MM');
    end_date := start_date + interval '1 month';
    
    EXECUTE format('CREATE TABLE IF NOT EXISTS %I PARTITION OF %I 
                    FOR VALUES FROM (%L) TO (%L)',
                   partition_name, table_name, start_date, end_date);
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- INITIAL DATA AND CONSTRAINTS
-- ============================================================================

-- Add constraint to ensure primary keys are included in partitioned tables
ALTER TABLE transaction_history ADD PRIMARY KEY (id, block_timestamp);
ALTER TABLE portfolio_snapshots ADD PRIMARY KEY (id, snapshot_date);

-- Create default admin user (for testing)
INSERT INTO users (address, username, display_name, is_verified, kyc_level) 
VALUES ('0x0000000000000000000000000000000000000000', 'admin', 'System Admin', true, 3)
ON CONFLICT (address) DO NOTHING;

-- Grant permissions for application user
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO yieldsensei_app;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO yieldsensei_app; 