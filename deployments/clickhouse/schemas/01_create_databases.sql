-- YieldSensei ClickHouse Database Schema
-- Optimized for high-frequency DeFi time-series data analytics
-- Author: YieldSensei Database Team
-- Date: 2025-01-20

-- =============================================================================
-- DATABASE CREATION
-- =============================================================================

-- Create main database for DeFi analytics
CREATE DATABASE IF NOT EXISTS yieldsensei
ENGINE = Atomic
COMMENT 'YieldSensei DeFi Analytics Database';

-- Use the database
USE yieldsensei;

-- =============================================================================
-- PRICE DATA TABLES - OHLCV Market Data
-- =============================================================================

-- Raw price data with highest granularity (1-minute intervals)
CREATE TABLE IF NOT EXISTS price_data_raw
(
    timestamp DateTime64(3) CODEC(Delta, ZSTD(1)),
    asset_id String CODEC(ZSTD(1)),
    chain_id UInt32 CODEC(ZSTD(1)),
    protocol_id String CODEC(ZSTD(1)),
    
    -- OHLCV Data
    open Decimal64(8) CODEC(ZSTD(1)),
    high Decimal64(8) CODEC(ZSTD(1)),
    low Decimal64(8) CODEC(ZSTD(1)),
    close Decimal64(8) CODEC(ZSTD(1)),
    volume Decimal64(8) CODEC(ZSTD(1)),
    
    -- Additional Price Metrics
    volume_usd Decimal64(8) CODEC(ZSTD(1)),
    market_cap Decimal64(8) CODEC(ZSTD(1)),
    total_supply Decimal64(8) CODEC(ZSTD(1)),
    circulating_supply Decimal64(8) CODEC(ZSTD(1)),
    
    -- Price Change Metrics
    price_change_24h Decimal64(8) CODEC(ZSTD(1)),
    price_change_percent_24h Decimal64(4) CODEC(ZSTD(1)),
    price_change_7d Decimal64(8) CODEC(ZSTD(1)),
    price_change_percent_7d Decimal64(4) CODEC(ZSTD(1)),
    
    -- Metadata
    data_source String CODEC(ZSTD(1)),
    confidence_score Float32 CODEC(ZSTD(1)),
    created_at DateTime64(3) DEFAULT now64() CODEC(Delta, ZSTD(1))
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (asset_id, timestamp)
SETTINGS 
    index_granularity = 8192,
    compress_marks = 1,
    compress_primary_key = 1,
    min_bytes_for_wide_part = 0,
    enable_mixed_granularity_parts = 1;

-- Aggregated price data (hourly intervals) for faster queries
CREATE TABLE IF NOT EXISTS price_data_hourly
(
    timestamp DateTime CODEC(Delta, ZSTD(1)),
    asset_id String CODEC(ZSTD(1)),
    chain_id UInt32 CODEC(ZSTD(1)),
    protocol_id String CODEC(ZSTD(1)),
    
    -- OHLCV Data (hourly aggregated)
    open Decimal64(8) CODEC(ZSTD(1)),
    high Decimal64(8) CODEC(ZSTD(1)),
    low Decimal64(8) CODEC(ZSTD(1)),
    close Decimal64(8) CODEC(ZSTD(1)),
    volume Decimal64(8) CODEC(ZSTD(1)),
    volume_usd Decimal64(8) CODEC(ZSTD(1)),
    
    -- Volume-weighted average price
    vwap Decimal64(8) CODEC(ZSTD(1)),
    
    -- Trade count and metrics
    trade_count UInt64 CODEC(ZSTD(1)),
    unique_traders UInt32 CODEC(ZSTD(1)),
    
    -- Price volatility metrics
    volatility Float32 CODEC(ZSTD(1)),
    price_std_dev Float32 CODEC(ZSTD(1)),
    
    created_at DateTime64(3) DEFAULT now64() CODEC(Delta, ZSTD(1))
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (asset_id, timestamp)
SETTINGS 
    index_granularity = 8192,
    compress_marks = 1,
    compress_primary_key = 1;

-- Daily price summaries for long-term analysis
CREATE TABLE IF NOT EXISTS price_data_daily
(
    date Date CODEC(Delta, ZSTD(1)),
    asset_id String CODEC(ZSTD(1)),
    chain_id UInt32 CODEC(ZSTD(1)),
    protocol_id String CODEC(ZSTD(1)),
    
    -- Daily OHLCV
    open Decimal64(8) CODEC(ZSTD(1)),
    high Decimal64(8) CODEC(ZSTD(1)),
    low Decimal64(8) CODEC(ZSTD(1)),
    close Decimal64(8) CODEC(ZSTD(1)),
    volume Decimal64(8) CODEC(ZSTD(1)),
    volume_usd Decimal64(8) CODEC(ZSTD(1)),
    
    -- Daily metrics
    vwap Decimal64(8) CODEC(ZSTD(1)),
    trade_count UInt64 CODEC(ZSTD(1)),
    unique_traders UInt32 CODEC(ZSTD(1)),
    active_hours UInt8 CODEC(ZSTD(1)),
    
    -- Price performance
    price_change Decimal64(8) CODEC(ZSTD(1)),
    price_change_percent Decimal64(4) CODEC(ZSTD(1)),
    volatility Float32 CODEC(ZSTD(1)),
    
    -- Market metrics
    market_cap_start Decimal64(8) CODEC(ZSTD(1)),
    market_cap_end Decimal64(8) CODEC(ZSTD(1)),
    market_cap_high Decimal64(8) CODEC(ZSTD(1)),
    market_cap_low Decimal64(8) CODEC(ZSTD(1)),
    
    created_at DateTime64(3) DEFAULT now64() CODEC(Delta, ZSTD(1))
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(date)
ORDER BY (asset_id, date)
SETTINGS 
    index_granularity = 8192,
    compress_marks = 1,
    compress_primary_key = 1;

-- =============================================================================
-- LIQUIDITY AND TRADING METRICS
-- =============================================================================

-- Liquidity pool data for DEX analytics
CREATE TABLE IF NOT EXISTS liquidity_pools
(
    timestamp DateTime64(3) CODEC(Delta, ZSTD(1)),
    pool_id String CODEC(ZSTD(1)),
    protocol_id String CODEC(ZSTD(1)),
    chain_id UInt32 CODEC(ZSTD(1)),
    
    -- Pool composition
    token0_id String CODEC(ZSTD(1)),
    token1_id String CODEC(ZSTD(1)),
    token0_symbol String CODEC(ZSTD(1)),
    token1_symbol String CODEC(ZSTD(1)),
    
    -- Liquidity metrics
    tvl_usd Decimal64(8) CODEC(ZSTD(1)),
    token0_reserve Decimal64(8) CODEC(ZSTD(1)),
    token1_reserve Decimal64(8) CODEC(ZSTD(1)),
    token0_reserve_usd Decimal64(8) CODEC(ZSTD(1)),
    token1_reserve_usd Decimal64(8) CODEC(ZSTD(1)),
    
    -- Trading metrics
    volume_24h_usd Decimal64(8) CODEC(ZSTD(1)),
    volume_7d_usd Decimal64(8) CODEC(ZSTD(1)),
    fees_24h_usd Decimal64(8) CODEC(ZSTD(1)),
    fees_apr Float32 CODEC(ZSTD(1)),
    
    -- Pool performance
    price_token0 Decimal64(8) CODEC(ZSTD(1)),
    price_token1 Decimal64(8) CODEC(ZSTD(1)),
    price_change_24h Float32 CODEC(ZSTD(1)),
    impermanent_loss Float32 CODEC(ZSTD(1)),
    
    -- Activity metrics
    tx_count_24h UInt32 CODEC(ZSTD(1)),
    unique_traders_24h UInt32 CODEC(ZSTD(1)),
    liquidity_providers_count UInt32 CODEC(ZSTD(1)),
    
    created_at DateTime64(3) DEFAULT now64() CODEC(Delta, ZSTD(1))
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (protocol_id, pool_id, timestamp)
SETTINGS 
    index_granularity = 8192,
    compress_marks = 1,
    compress_primary_key = 1;

-- Order book snapshots for market depth analysis
CREATE TABLE IF NOT EXISTS order_book_snapshots
(
    timestamp DateTime64(3) CODEC(Delta, ZSTD(1)),
    asset_id String CODEC(ZSTD(1)),
    protocol_id String CODEC(ZSTD(1)),
    
    -- Bid side (buyers)
    bid_prices Array(Decimal64(8)) CODEC(ZSTD(1)),
    bid_quantities Array(Decimal64(8)) CODEC(ZSTD(1)),
    bid_counts Array(UInt32) CODEC(ZSTD(1)),
    
    -- Ask side (sellers)
    ask_prices Array(Decimal64(8)) CODEC(ZSTD(1)),
    ask_quantities Array(Decimal64(8)) CODEC(ZSTD(1)),
    ask_counts Array(UInt32) CODEC(ZSTD(1)),
    
    -- Market depth metrics
    spread_bps UInt16 CODEC(ZSTD(1)),
    mid_price Decimal64(8) CODEC(ZSTD(1)),
    total_bid_liquidity Decimal64(8) CODEC(ZSTD(1)),
    total_ask_liquidity Decimal64(8) CODEC(ZSTD(1)),
    
    -- Depth at different price levels
    depth_1_percent Decimal64(8) CODEC(ZSTD(1)),
    depth_5_percent Decimal64(8) CODEC(ZSTD(1)),
    depth_10_percent Decimal64(8) CODEC(ZSTD(1)),
    
    created_at DateTime64(3) DEFAULT now64() CODEC(Delta, ZSTD(1))
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (asset_id, protocol_id, timestamp)
SETTINGS 
    index_granularity = 8192,
    compress_marks = 1,
    compress_primary_key = 1;

-- =============================================================================
-- PROTOCOL METRICS AND TVL DATA
-- =============================================================================

-- Protocol total value locked (TVL) time series
CREATE TABLE IF NOT EXISTS protocol_tvl_history
(
    timestamp DateTime64(3) CODEC(Delta, ZSTD(1)),
    protocol_id String CODEC(ZSTD(1)),
    chain_id UInt32 CODEC(ZSTD(1)),
    
    -- TVL metrics
    tvl_usd Decimal64(8) CODEC(ZSTD(1)),
    tvl_eth Decimal64(8) CODEC(ZSTD(1)),
    tvl_btc Decimal64(8) CODEC(ZSTD(1)),
    
    -- TVL change metrics
    tvl_change_24h Decimal64(8) CODEC(ZSTD(1)),
    tvl_change_percent_24h Float32 CODEC(ZSTD(1)),
    tvl_change_7d Decimal64(8) CODEC(ZSTD(1)),
    tvl_change_percent_7d Float32 CODEC(ZSTD(1)),
    
    -- Protocol activity
    active_users_24h UInt32 CODEC(ZSTD(1)),
    transactions_24h UInt32 CODEC(ZSTD(1)),
    volume_24h_usd Decimal64(8) CODEC(ZSTD(1)),
    fees_24h_usd Decimal64(8) CODEC(ZSTD(1)),
    revenue_24h_usd Decimal64(8) CODEC(ZSTD(1)),
    
    -- Yield metrics
    average_apy Float32 CODEC(ZSTD(1)),
    max_apy Float32 CODEC(ZSTD(1)),
    min_apy Float32 CODEC(ZSTD(1)),
    weighted_apy Float32 CODEC(ZSTD(1)),
    
    -- Risk metrics
    risk_score Float32 CODEC(ZSTD(1)),
    audit_score Float32 CODEC(ZSTD(1)),
    exploit_history UInt8 CODEC(ZSTD(1)),
    insurance_coverage Decimal64(8) CODEC(ZSTD(1)),
    
    created_at DateTime64(3) DEFAULT now64() CODEC(Delta, ZSTD(1))
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (protocol_id, chain_id, timestamp)
SETTINGS 
    index_granularity = 8192,
    compress_marks = 1,
    compress_primary_key = 1;

-- Protocol category performance for sector analysis
CREATE TABLE IF NOT EXISTS protocol_category_metrics
(
    timestamp DateTime64(3) CODEC(Delta, ZSTD(1)),
    category String CODEC(ZSTD(1)),
    chain_id UInt32 CODEC(ZSTD(1)),
    
    -- Aggregate TVL metrics
    total_tvl_usd Decimal64(8) CODEC(ZSTD(1)),
    protocol_count UInt16 CODEC(ZSTD(1)),
    average_tvl_usd Decimal64(8) CODEC(ZSTD(1)),
    median_tvl_usd Decimal64(8) CODEC(ZSTD(1)),
    
    -- Market share
    market_share_percent Float32 CODEC(ZSTD(1)),
    dominance_index Float32 CODEC(ZSTD(1)),
    
    -- Activity metrics
    total_volume_24h_usd Decimal64(8) CODEC(ZSTD(1)),
    total_fees_24h_usd Decimal64(8) CODEC(ZSTD(1)),
    total_active_users_24h UInt32 CODEC(ZSTD(1)),
    total_transactions_24h UInt32 CODEC(ZSTD(1)),
    
    -- Yield analysis
    average_apy Float32 CODEC(ZSTD(1)),
    weighted_apy Float32 CODEC(ZSTD(1)),
    apy_volatility Float32 CODEC(ZSTD(1)),
    
    -- Growth metrics
    tvl_growth_24h Float32 CODEC(ZSTD(1)),
    tvl_growth_7d Float32 CODEC(ZSTD(1)),
    tvl_growth_30d Float32 CODEC(ZSTD(1)),
    
    created_at DateTime64(3) DEFAULT now64() CODEC(Delta, ZSTD(1))
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (category, chain_id, timestamp)
SETTINGS 
    index_granularity = 8192,
    compress_marks = 1,
    compress_primary_key = 1;

-- =============================================================================
-- TRANSACTION AND USER ACTIVITY DATA
-- =============================================================================

-- Detailed transaction events for activity analysis
CREATE TABLE IF NOT EXISTS transaction_events
(
    timestamp DateTime64(3) CODEC(Delta, ZSTD(1)),
    block_number UInt64 CODEC(ZSTD(1)),
    transaction_hash String CODEC(ZSTD(1)),
    chain_id UInt32 CODEC(ZSTD(1)),
    protocol_id String CODEC(ZSTD(1)),
    
    -- Transaction details
    from_address String CODEC(ZSTD(1)),
    to_address String CODEC(ZSTD(1)),
    transaction_type Enum8('swap' = 1, 'add_liquidity' = 2, 'remove_liquidity' = 3, 
                           'stake' = 4, 'unstake' = 5, 'claim' = 6, 'deposit' = 7, 
                           'withdraw' = 8, 'bridge' = 9, 'other' = 10) CODEC(ZSTD(1)),
    
    -- Asset information
    token_in_id String CODEC(ZSTD(1)),
    token_out_id String CODEC(ZSTD(1)),
    amount_in Decimal64(8) CODEC(ZSTD(1)),
    amount_out Decimal64(8) CODEC(ZSTD(1)),
    amount_in_usd Decimal64(8) CODEC(ZSTD(1)),
    amount_out_usd Decimal64(8) CODEC(ZSTD(1)),
    
    -- Transaction costs
    gas_used UInt64 CODEC(ZSTD(1)),
    gas_price UInt64 CODEC(ZSTD(1)),
    transaction_fee_usd Decimal64(8) CODEC(ZSTD(1)),
    
    -- Protocol-specific fees
    protocol_fee_usd Decimal64(8) CODEC(ZSTD(1)),
    slippage_percent Float32 CODEC(ZSTD(1)),
    price_impact_percent Float32 CODEC(ZSTD(1)),
    
    -- MEV and arbitrage detection
    is_arbitrage UInt8 CODEC(ZSTD(1)),
    mev_value_usd Decimal64(8) CODEC(ZSTD(1)),
    sandwich_attack UInt8 CODEC(ZSTD(1)),
    
    -- Success and error tracking
    transaction_status Enum8('success' = 1, 'failed' = 2, 'reverted' = 3) CODEC(ZSTD(1)),
    error_message String CODEC(ZSTD(1)),
    
    created_at DateTime64(3) DEFAULT now64() CODEC(Delta, ZSTD(1))
)
ENGINE = MergeTree()
PARTITION BY (toYYYYMM(timestamp), chain_id)
ORDER BY (chain_id, protocol_id, timestamp, transaction_hash)
SETTINGS 
    index_granularity = 8192,
    compress_marks = 1,
    compress_primary_key = 1;

-- User activity aggregations for analytics
CREATE TABLE IF NOT EXISTS user_activity_daily
(
    date Date CODEC(Delta, ZSTD(1)),
    user_address String CODEC(ZSTD(1)),
    chain_id UInt32 CODEC(ZSTD(1)),
    
    -- Activity summary
    transaction_count UInt32 CODEC(ZSTD(1)),
    protocols_used Array(String) CODEC(ZSTD(1)),
    protocol_count UInt16 CODEC(ZSTD(1)),
    
    -- Volume metrics
    total_volume_usd Decimal64(8) CODEC(ZSTD(1)),
    swap_volume_usd Decimal64(8) CODEC(ZSTD(1)),
    liquidity_provided_usd Decimal64(8) CODEC(ZSTD(1)),
    liquidity_removed_usd Decimal64(8) CODEC(ZSTD(1)),
    
    -- Cost analysis
    total_gas_fees_usd Decimal64(8) CODEC(ZSTD(1)),
    total_protocol_fees_usd Decimal64(8) CODEC(ZSTD(1)),
    average_gas_price UInt64 CODEC(ZSTD(1)),
    
    -- Portfolio metrics
    assets_traded Array(String) CODEC(ZSTD(1)),
    unique_assets_count UInt16 CODEC(ZSTD(1)),
    largest_trade_usd Decimal64(8) CODEC(ZSTD(1)),
    
    -- Behavioral metrics
    is_whale UInt8 CODEC(ZSTD(1)),
    is_arbitrageur UInt8 CODEC(ZSTD(1)),
    activity_score Float32 CODEC(ZSTD(1)),
    risk_score Float32 CODEC(ZSTD(1)),
    
    created_at DateTime64(3) DEFAULT now64() CODEC(Delta, ZSTD(1))
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(date)
ORDER BY (user_address, date, chain_id)
SETTINGS 
    index_granularity = 8192,
    compress_marks = 1,
    compress_primary_key = 1;

-- =============================================================================
-- YIELD AND APY TRACKING
-- =============================================================================

-- Historical APY data for yield farming opportunities
CREATE TABLE IF NOT EXISTS yield_history
(
    timestamp DateTime64(3) CODEC(Delta, ZSTD(1)),
    protocol_id String CODEC(ZSTD(1)),
    pool_id String CODEC(ZSTD(1)),
    chain_id UInt32 CODEC(ZSTD(1)),
    
    -- Asset information
    asset_id String CODEC(ZSTD(1)),
    asset_symbol String CODEC(ZSTD(1)),
    strategy_type Enum8('lending' = 1, 'liquidity_mining' = 2, 'staking' = 3, 
                        'farming' = 4, 'vaults' = 5, 'bonds' = 6, 'other' = 7) CODEC(ZSTD(1)),
    
    -- Yield metrics
    apy Float32 CODEC(ZSTD(1)),
    apy_base Float32 CODEC(ZSTD(1)),
    apy_reward Float32 CODEC(ZSTD(1)),
    apr Float32 CODEC(ZSTD(1)),
    
    -- TVL and capacity
    tvl_usd Decimal64(8) CODEC(ZSTD(1)),
    max_capacity_usd Decimal64(8) CODEC(ZSTD(1)),
    utilization_rate Float32 CODEC(ZSTD(1)),
    
    -- Risk metrics
    il_risk Float32 CODEC(ZSTD(1)),
    smart_contract_risk Float32 CODEC(ZSTD(1)),
    overall_risk_score Float32 CODEC(ZSTD(1)),
    
    -- Performance tracking
    daily_return Float32 CODEC(ZSTD(1)),
    weekly_return Float32 CODEC(ZSTD(1)),
    monthly_return Float32 CODEC(ZSTD(1)),
    volatility Float32 CODEC(ZSTD(1)),
    sharpe_ratio Float32 CODEC(ZSTD(1)),
    
    -- Conditions and requirements
    min_deposit_usd Decimal64(8) CODEC(ZSTD(1)),
    lock_period_days UInt16 CODEC(ZSTD(1)),
    auto_compound UInt8 CODEC(ZSTD(1)),
    withdrawal_fee_percent Float32 CODEC(ZSTD(1)),
    
    created_at DateTime64(3) DEFAULT now64() CODEC(Delta, ZSTD(1))
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (protocol_id, asset_id, timestamp)
SETTINGS 
    index_granularity = 8192,
    compress_marks = 1,
    compress_primary_key = 1;

-- =============================================================================
-- MARKET SENTIMENT AND SOCIAL METRICS
-- =============================================================================

-- Social sentiment tracking for market analysis
CREATE TABLE IF NOT EXISTS market_sentiment
(
    timestamp DateTime64(3) CODEC(Delta, ZSTD(1)),
    asset_id String CODEC(ZSTD(1)),
    source Enum8('twitter' = 1, 'reddit' = 2, 'telegram' = 3, 'discord' = 4, 
                 'news' = 5, 'forums' = 6, 'other' = 7) CODEC(ZSTD(1)),
    
    -- Sentiment metrics
    sentiment_score Float32 CODEC(ZSTD(1)),
    positive_mentions UInt32 CODEC(ZSTD(1)),
    negative_mentions UInt32 CODEC(ZSTD(1)),
    neutral_mentions UInt32 CODEC(ZSTD(1)),
    total_mentions UInt32 CODEC(ZSTD(1)),
    
    -- Engagement metrics
    likes_count UInt32 CODEC(ZSTD(1)),
    shares_count UInt32 CODEC(ZSTD(1)),
    comments_count UInt32 CODEC(ZSTD(1)),
    engagement_rate Float32 CODEC(ZSTD(1)),
    
    -- Influence metrics
    influencer_mentions UInt16 CODEC(ZSTD(1)),
    whale_mentions UInt16 CODEC(ZSTD(1)),
    verified_mentions UInt16 CODEC(ZSTD(1)),
    
    -- Topic analysis
    trending_keywords Array(String) CODEC(ZSTD(1)),
    topic_relevance Float32 CODEC(ZSTD(1)),
    controversy_score Float32 CODEC(ZSTD(1)),
    
    created_at DateTime64(3) DEFAULT now64() CODEC(Delta, ZSTD(1))
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (asset_id, source, timestamp)
SETTINGS 
    index_granularity = 8192,
    compress_marks = 1,
    compress_primary_key = 1;

-- =============================================================================
-- CREATE INDEXES FOR PERFORMANCE OPTIMIZATION
-- =============================================================================

-- Price data indexes for fast time-range queries
ALTER TABLE price_data_raw ADD INDEX idx_timestamp_asset (timestamp, asset_id) TYPE minmax GRANULARITY 1;
ALTER TABLE price_data_raw ADD INDEX idx_chain_protocol (chain_id, protocol_id) TYPE set(100) GRANULARITY 1;

-- Liquidity pool indexes
ALTER TABLE liquidity_pools ADD INDEX idx_tvl_range (tvl_usd) TYPE minmax GRANULARITY 1;
ALTER TABLE liquidity_pools ADD INDEX idx_volume_range (volume_24h_usd) TYPE minmax GRANULARITY 1;

-- Transaction event indexes
ALTER TABLE transaction_events ADD INDEX idx_tx_type (transaction_type) TYPE set(10) GRANULARITY 1;
ALTER TABLE transaction_events ADD INDEX idx_amount_range (amount_in_usd, amount_out_usd) TYPE minmax GRANULARITY 1;
ALTER TABLE transaction_events ADD INDEX idx_user_address (from_address, to_address) TYPE bloom_filter(0.001) GRANULARITY 1;

-- Protocol TVL indexes
ALTER TABLE protocol_tvl_history ADD INDEX idx_tvl_category (tvl_usd) TYPE minmax GRANULARITY 1;
ALTER TABLE protocol_tvl_history ADD INDEX idx_apy_range (average_apy) TYPE minmax GRANULARITY 1;

-- Yield tracking indexes
ALTER TABLE yield_history ADD INDEX idx_apy_performance (apy, apy_base, apy_reward) TYPE minmax GRANULARITY 1;
ALTER TABLE yield_history ADD INDEX idx_strategy_type (strategy_type) TYPE set(10) GRANULARITY 1;

-- Sentiment analysis indexes
ALTER TABLE market_sentiment ADD INDEX idx_sentiment_range (sentiment_score) TYPE minmax GRANULARITY 1;
ALTER TABLE market_sentiment ADD INDEX idx_mentions_range (total_mentions) TYPE minmax GRANULARITY 1; 