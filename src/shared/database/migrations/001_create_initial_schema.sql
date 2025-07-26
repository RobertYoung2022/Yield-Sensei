-- Migration: 001_create_initial_schema.sql
-- Description: Create initial YieldSensei PostgreSQL schema with partitioning
-- Author: YieldSensei Database Team
-- Date: 2025-01-20

-- Begin transaction
BEGIN;

-- ============================================================================
-- SCHEMA VERSIONING
-- ============================================================================

-- Create migrations table to track schema versions
CREATE TABLE IF NOT EXISTS schema_migrations (
    id SERIAL PRIMARY KEY,
    version VARCHAR(50) UNIQUE NOT NULL,
    description TEXT NOT NULL,
    applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    checksum VARCHAR(64)
);

-- Record this migration
INSERT INTO schema_migrations (version, description, checksum) 
VALUES ('001', 'Create initial schema with partitioning', md5(current_timestamp::text))
ON CONFLICT (version) DO NOTHING;

-- ============================================================================
-- LOAD MAIN SCHEMA
-- ============================================================================

-- Include the main schema file
\i src/shared/database/schemas/postgresql.sql

-- ============================================================================
-- ADDITIONAL SETUP FOR PRODUCTION
-- ============================================================================

-- Create application database user
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'yieldsensei_app') THEN
        CREATE ROLE yieldsensei_app WITH LOGIN PASSWORD 'changeme_in_production';
    END IF;
END
$$;

-- Grant necessary permissions
GRANT CONNECT ON DATABASE yieldsensei TO yieldsensei_app;
GRANT USAGE ON SCHEMA public TO yieldsensei_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO yieldsensei_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO yieldsensei_app;

-- Set default privileges for future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO yieldsensei_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO yieldsensei_app;

-- ============================================================================
-- MONITORING SETUP
-- ============================================================================

-- Enable performance monitoring
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- Create function to monitor partition sizes
CREATE OR REPLACE FUNCTION get_partition_sizes()
RETURNS TABLE (
    table_name text,
    partition_name text,
    size_bytes bigint,
    size_pretty text,
    row_count bigint
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        schemaname||'.'||tablename as table_name,
        schemaname||'.'||tablename as partition_name,
        pg_total_relation_size(schemaname||'.'||tablename) as size_bytes,
        pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size_pretty,
        reltuples::bigint as row_count
    FROM pg_tables t
    JOIN pg_class c ON c.relname = t.tablename
    WHERE schemaname = 'public' 
    AND (tablename LIKE '%_2024_%' OR tablename LIKE '%_2025_%')
    ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- SAMPLE DATA FOR DEVELOPMENT
-- ============================================================================

-- Insert sample protocols for development/testing
INSERT INTO protocols (name, slug, category, risk_level, contract_addresses, supported_chains, description) VALUES
    ('Uniswap V3', 'uniswap-v3', 'DEX', 'LOW', '{"1": "0x1F98431c8aD98523631AE4a59f267346ea31F984"}', '{1,137,42161}', 'Decentralized exchange with concentrated liquidity'),
    ('Aave', 'aave', 'LENDING', 'LOW', '{"1": "0x7d2768dE32b0b80b7a3454c06BdAc94A69DDc7A9"}', '{1,137,43114}', 'Decentralized lending protocol'),
    ('Compound', 'compound', 'LENDING', 'MEDIUM', '{"1": "0x3d9819210A31b4961b30EF54bE2aeD79B9c9Cd3B"}', '{1}', 'Algorithmic money markets'),
    ('Curve Finance', 'curve', 'DEX', 'MEDIUM', '{"1": "0x79a8C46DeA5aDa233ABaFFD40F3A0A2B1e5A4F27"}', '{1,137,43114}', 'Decentralized exchange for stablecoins'),
    ('Lido', 'lido', 'LIQUID_STAKING', 'LOW', '{"1": "0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84"}', '{1}', 'Liquid staking for Ethereum 2.0')
ON CONFLICT (slug) DO NOTHING;

-- Insert sample assets for development/testing
INSERT INTO assets (symbol, name, asset_type, chain_id, contract_address, decimals, coingecko_id) VALUES
    ('ETH', 'Ethereum', 'NATIVE', 1, NULL, 18, 'ethereum'),
    ('USDC', 'USD Coin', 'ERC20', 1, '0xA0b86a33E6441853A Bf4C4FB2f1f00C79bbE7', 6, 'usd-coin'),
    ('USDT', 'Tether USD', 'ERC20', 1, '0xdAC17F958D2ee523a2206206994597C13D831ec7', 6, 'tether'),
    ('DAI', 'Dai Stablecoin', 'ERC20', 1, '0x6B175474E89094C44Da98b954EedeAC495271d0F', 18, 'dai'),
    ('WETH', 'Wrapped Ether', 'ERC20', 1, '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', 18, 'weth'),
    ('UNI', 'Uniswap', 'ERC20', 1, '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984', 18, 'uniswap'),
    ('AAVE', 'Aave Token', 'ERC20', 1, '0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9', 18, 'aave'),
    ('COMP', 'Compound', 'ERC20', 1, '0xc00e94Cb662C3520282E6f5717214004A7f26888', 18, 'compound-governance-token'),
    ('CRV', 'Curve DAO Token', 'ERC20', 1, '0xD533a949740bb3306d119CC777fa900bA034cd52', 18, 'curve-dao-token'),
    ('LDO', 'Lido DAO Token', 'ERC20', 1, '0x5A98FcBEA516Cf06857215779Fd812CA3beF1B32', 18, 'lido-dao')
ON CONFLICT (symbol, chain_id) DO NOTHING;

-- Commit transaction
COMMIT;

-- ============================================================================
-- POST-MIGRATION VERIFICATION
-- ============================================================================

-- Verify all tables were created
DO $$
DECLARE
    table_count INTEGER;
    expected_tables TEXT[] := ARRAY[
        'users', 'protocols', 'assets', 'portfolio_holdings', 
        'transaction_history', 'portfolio_snapshots'
    ];
    missing_tables TEXT[] := ARRAY[]::TEXT[];
    table_name TEXT;
BEGIN
    FOREACH table_name IN ARRAY expected_tables LOOP
        SELECT COUNT(*) INTO table_count 
        FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = table_name;
        
        IF table_count = 0 THEN
            missing_tables := array_append(missing_tables, table_name);
        END IF;
    END LOOP;
    
    IF array_length(missing_tables, 1) > 0 THEN
        RAISE EXCEPTION 'Migration failed: Missing tables: %', array_to_string(missing_tables, ', ');
    ELSE
        RAISE NOTICE 'Migration completed successfully. All % tables created.', array_length(expected_tables, 1);
    END IF;
END $$;

-- Verify partitions were created
SELECT 
    schemaname, 
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables 
WHERE tablename LIKE '%_2024_%' OR tablename LIKE '%_2025_%'
ORDER BY tablename;

-- Final success message
\echo 'Migration 001_create_initial_schema.sql completed successfully!' 