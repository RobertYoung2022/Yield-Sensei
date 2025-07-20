-- YieldSensei Database Initialization Script
-- This script sets up the core PostgreSQL database structure

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "btree_gin";

-- Create custom types
CREATE TYPE user_type_enum AS ENUM ('retail', 'institutional', 'family_office');
CREATE TYPE kyc_status_enum AS ENUM ('pending', 'verified', 'rejected', 'expired');
CREATE TYPE risk_profile_enum AS ENUM ('conservative', 'moderate', 'aggressive', 'custom');
CREATE TYPE rebalancing_strategy_enum AS ENUM ('daily', 'weekly', 'monthly', 'quarterly', 'dynamic');
CREATE TYPE position_type_enum AS ENUM ('spot', 'staked', 'lp_token', 'yield_farm', 'lending', 'borrowing');
CREATE TYPE asset_type_enum AS ENUM ('crypto', 'lp_token', 'staked_token', 'yield_token', 'rwa_token');
CREATE TYPE strategy_type_enum AS ENUM ('yield_farming', 'liquidity_provision', 'arbitrage', 'staking', 'lending');
CREATE TYPE transaction_type_enum AS ENUM ('swap', 'stake', 'unstake', 'deposit', 'withdraw', 'claim', 'bridge');
CREATE TYPE transaction_status_enum AS ENUM ('pending', 'confirmed', 'failed', 'replaced');
CREATE TYPE risk_assessment_type_enum AS ENUM ('liquidation', 'correlation', 'protocol', 'market', 'regulatory');
CREATE TYPE risk_alert_type_enum AS ENUM ('liquidation_risk', 'high_correlation', 'protocol_risk', 'unusual_activity');
CREATE TYPE severity_enum AS ENUM ('low', 'medium', 'high', 'critical');
CREATE TYPE agent_type_enum AS ENUM ('logic', 'builder', 'growth', 'security', 'sentiment', 'logistics', 'cross_chain', 'data');
CREATE TYPE implementation_type_enum AS ENUM ('custom', 'elizaos', 'hybrid');
CREATE TYPE health_status_enum AS ENUM ('healthy', 'degraded', 'unhealthy', 'unknown');
CREATE TYPE task_status_enum AS ENUM ('pending', 'running', 'completed', 'failed', 'cancelled');

-- Create core tables
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

CREATE TABLE satellite_agents (
    id VARCHAR(50) PRIMARY KEY,
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

-- Insert initial satellite agents
INSERT INTO satellite_agents VALUES
('sage', 'Sage - Logic & Research', 'Market analysis and RWA integration', 'logic', 'custom', '1.0.0', '{}', '{}', 'unknown', NULL, true, NOW(), NOW()),
('forge', 'Forge - Builder & Engineering', 'Smart contract optimization and MEV protection', 'builder', 'custom', '1.0.0', '{}', '{}', 'unknown', NULL, true, NOW(), NOW()),
('pulse', 'Pulse - Growth & Optimization', 'Yield farming and staking optimization', 'growth', 'hybrid', '1.0.0', '{}', '{}', 'unknown', NULL, true, NOW(), NOW()),
('aegis', 'Aegis - Security & Risk', 'Risk management and liquidation protection', 'security', 'custom', '1.0.0', '{}', '{}', 'unknown', NULL, true, NOW(), NOW()),
('echo', 'Echo - Sentiment & Community', 'Social monitoring and sentiment analysis', 'sentiment', 'elizaos', '1.0.0', '{}', '{}', 'unknown', NULL, true, NOW(), NOW()),
('fuel', 'Fuel - Logistics & Capital', 'Capital deployment and gas optimization', 'logistics', 'hybrid', '1.0.0', '{}', '{}', 'unknown', NULL, true, NOW(), NOW()),
('bridge', 'Bridge - Cross-Chain Operations', 'Multi-chain coordination and arbitrage', 'cross_chain', 'custom', '1.0.0', '{}', '{}', 'unknown', NULL, true, NOW(), NOW()),
('oracle', 'Oracle - Data Integrity', 'Data validation and RWA verification', 'data', 'hybrid', '1.0.0', '{}', '{}', 'unknown', NULL, true, NOW(), NOW());

-- Create schema migration tracking
CREATE TABLE schema_migrations (
    version VARCHAR(50) PRIMARY KEY,
    description TEXT NOT NULL,
    applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    rollback_sql TEXT
);

-- Record initial migration
INSERT INTO schema_migrations (version, description) 
VALUES ('001_initial_schema', 'Initial database schema with satellite agents');

-- Create performance indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_portfolios_user_id ON portfolios(user_id);
CREATE INDEX idx_assets_symbol_chain ON assets(symbol, chain_id);
CREATE INDEX idx_satellite_agents_type ON satellite_agents(agent_type);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_assets_updated_at BEFORE UPDATE ON assets FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_portfolios_updated_at BEFORE UPDATE ON portfolios FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_satellite_agents_updated_at BEFORE UPDATE ON satellite_agents FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();