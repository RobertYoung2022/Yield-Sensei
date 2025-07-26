-- YieldSensei ClickHouse Materialized Views
-- Real-time analytics and aggregations for DeFi data
-- Author: YieldSensei Database Team
-- Date: 2025-01-20

USE yieldsensei;

-- =============================================================================
-- REAL-TIME PRICE ANALYTICS VIEWS
-- =============================================================================

-- Real-time price metrics with 5-minute aggregations
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_price_metrics_5min
(
    timestamp DateTime,
    asset_id String,
    chain_id UInt32,
    protocol_id String,
    price_avg Decimal64(8),
    price_high Decimal64(8),
    price_low Decimal64(8),
    volume_sum Decimal64(8),
    volume_usd_sum Decimal64(8),
    trade_count UInt64,
    price_volatility Float32,
    price_change_percent Float32
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (asset_id, timestamp)
SETTINGS index_granularity = 8192
AS SELECT
    toStartOfFiveMinute(timestamp) as timestamp,
    asset_id,
    chain_id,
    protocol_id,
    avg(close) as price_avg,
    max(high) as price_high,
    min(low) as price_low,
    sum(volume) as volume_sum,
    sum(volume_usd) as volume_usd_sum,
    count() as trade_count,
    stddevSamp(close) / avg(close) as price_volatility,
    (last_value(close) - first_value(open)) / first_value(open) * 100 as price_change_percent
FROM price_data_raw
GROUP BY 
    toStartOfFiveMinute(timestamp),
    asset_id,
    chain_id,
    protocol_id;

-- Top movers by price change (updated every minute)
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_top_movers_realtime
(
    timestamp DateTime,
    asset_id String,
    chain_id UInt32,
    protocol_id String,
    current_price Decimal64(8),
    price_change_1h Float32,
    price_change_24h Float32,
    volume_24h_usd Decimal64(8),
    market_cap Decimal64(8),
    price_rank UInt32
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (timestamp, price_rank)
SETTINGS index_granularity = 8192
AS SELECT
    toStartOfMinute(timestamp) as timestamp,
    asset_id,
    chain_id,
    protocol_id,
    argMax(close, timestamp) as current_price,
    (current_price - lagInFrame(current_price, 1) OVER (PARTITION BY asset_id ORDER BY timestamp ROWS BETWEEN 60 PRECEDING AND CURRENT ROW)) / lagInFrame(current_price, 1) OVER (PARTITION BY asset_id ORDER BY timestamp ROWS BETWEEN 60 PRECEDING AND CURRENT ROW) * 100 as price_change_1h,
    price_change_percent_24h as price_change_24h,
    sum(volume_usd) OVER (PARTITION BY asset_id ORDER BY timestamp ROWS BETWEEN 1440 PRECEDING AND CURRENT ROW) as volume_24h_usd,
    argMax(market_cap, timestamp) as market_cap,
    row_number() OVER (PARTITION BY timestamp ORDER BY abs(price_change_24h) DESC) as price_rank
FROM price_data_raw
WHERE timestamp >= now() - INTERVAL 24 HOUR
GROUP BY 
    toStartOfMinute(timestamp),
    asset_id,
    chain_id,
    protocol_id,
    price_change_percent_24h;

-- =============================================================================
-- LIQUIDITY AND TVL ANALYTICS
-- =============================================================================

-- Real-time TVL aggregations by protocol
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_protocol_tvl_realtime
(
    timestamp DateTime,
    protocol_id String,
    chain_id UInt32,
    total_tvl_usd Decimal64(8),
    pool_count UInt32,
    avg_pool_size Decimal64(8),
    largest_pool_tvl Decimal64(8),
    tvl_change_1h Float32,
    tvl_change_24h Float32,
    active_pools UInt32
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (protocol_id, timestamp)
SETTINGS index_granularity = 8192
AS SELECT
    toStartOfHour(timestamp) as timestamp,
    protocol_id,
    chain_id,
    sum(tvl_usd) as total_tvl_usd,
    count() as pool_count,
    avg(tvl_usd) as avg_pool_size,
    max(tvl_usd) as largest_pool_tvl,
    (total_tvl_usd - lagInFrame(total_tvl_usd, 1) OVER (PARTITION BY protocol_id ORDER BY timestamp ROWS BETWEEN 1 PRECEDING AND CURRENT ROW)) / lagInFrame(total_tvl_usd, 1) OVER (PARTITION BY protocol_id ORDER BY timestamp ROWS BETWEEN 1 PRECEDING AND CURRENT ROW) * 100 as tvl_change_1h,
    (total_tvl_usd - lagInFrame(total_tvl_usd, 24) OVER (PARTITION BY protocol_id ORDER BY timestamp ROWS BETWEEN 24 PRECEDING AND CURRENT ROW)) / lagInFrame(total_tvl_usd, 24) OVER (PARTITION BY protocol_id ORDER BY timestamp ROWS BETWEEN 24 PRECEDING AND CURRENT ROW) * 100 as tvl_change_24h,
    countIf(tvl_usd > 1000) as active_pools
FROM liquidity_pools
GROUP BY 
    toStartOfHour(timestamp),
    protocol_id,
    chain_id;

-- Top liquidity pools by volume and fees
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_top_pools_by_volume
(
    timestamp DateTime,
    pool_id String,
    protocol_id String,
    chain_id UInt32,
    token0_symbol String,
    token1_symbol String,
    tvl_usd Decimal64(8),
    volume_24h_usd Decimal64(8),
    fees_24h_usd Decimal64(8),
    fees_apr Float32,
    volume_rank UInt32,
    fees_rank UInt32
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (timestamp, volume_rank)
SETTINGS index_granularity = 8192
AS SELECT
    toStartOfHour(timestamp) as timestamp,
    pool_id,
    protocol_id,
    chain_id,
    argMax(token0_symbol, timestamp) as token0_symbol,
    argMax(token1_symbol, timestamp) as token1_symbol,
    argMax(tvl_usd, timestamp) as tvl_usd,
    argMax(volume_24h_usd, timestamp) as volume_24h_usd,
    argMax(fees_24h_usd, timestamp) as fees_24h_usd,
    argMax(fees_apr, timestamp) as fees_apr,
    row_number() OVER (PARTITION BY timestamp ORDER BY volume_24h_usd DESC) as volume_rank,
    row_number() OVER (PARTITION BY timestamp ORDER BY fees_24h_usd DESC) as fees_rank
FROM liquidity_pools
WHERE tvl_usd > 10000  -- Filter out dust pools
GROUP BY 
    toStartOfHour(timestamp),
    pool_id,
    protocol_id,
    chain_id;

-- =============================================================================
-- YIELD FARMING ANALYTICS
-- =============================================================================

-- Best yield opportunities aggregated by strategy
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_best_yields_by_strategy
(
    timestamp DateTime,
    strategy_type String,
    chain_id UInt32,
    best_apy Float32,
    avg_apy Float32,
    median_apy Float32,
    total_opportunities UInt32,
    total_tvl_available Decimal64(8),
    weighted_avg_apy Float32,
    risk_adjusted_apy Float32,
    top_protocol_id String,
    top_pool_id String
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (strategy_type, timestamp)
SETTINGS index_granularity = 8192
AS SELECT
    toStartOfHour(timestamp) as timestamp,
    strategy_type,
    chain_id,
    max(apy) as best_apy,
    avg(apy) as avg_apy,
    quantile(0.5)(apy) as median_apy,
    count() as total_opportunities,
    sum(tvl_usd) as total_tvl_available,
    sum(apy * tvl_usd) / sum(tvl_usd) as weighted_avg_apy,
    sum(apy * (1 - overall_risk_score) * tvl_usd) / sum((1 - overall_risk_score) * tvl_usd) as risk_adjusted_apy,
    argMax(protocol_id, apy) as top_protocol_id,
    argMax(pool_id, apy) as top_pool_id
FROM yield_history
WHERE tvl_usd > 1000 AND apy < 1000  -- Filter out suspicious yields
GROUP BY 
    toStartOfHour(timestamp),
    strategy_type,
    chain_id;

-- APY trending analysis
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_apy_trends
(
    timestamp DateTime,
    protocol_id String,
    pool_id String,
    asset_symbol String,
    current_apy Float32,
    apy_7d_avg Float32,
    apy_30d_avg Float32,
    apy_volatility Float32,
    apy_trend_direction String,
    yield_stability_score Float32
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (protocol_id, timestamp)
SETTINGS index_granularity = 8192
AS SELECT
    toStartOfDay(timestamp) as timestamp,
    protocol_id,
    pool_id,
    asset_symbol,
    argMax(apy, timestamp) as current_apy,
    avg(apy) OVER (PARTITION BY protocol_id, pool_id ORDER BY timestamp ROWS BETWEEN 7 PRECEDING AND CURRENT ROW) as apy_7d_avg,
    avg(apy) OVER (PARTITION BY protocol_id, pool_id ORDER BY timestamp ROWS BETWEEN 30 PRECEDING AND CURRENT ROW) as apy_30d_avg,
    stddevSamp(apy) OVER (PARTITION BY protocol_id, pool_id ORDER BY timestamp ROWS BETWEEN 30 PRECEDING AND CURRENT ROW) as apy_volatility,
    if(current_apy > apy_7d_avg, 'increasing', 
       if(current_apy < apy_7d_avg, 'decreasing', 'stable')) as apy_trend_direction,
    1 / (1 + apy_volatility) as yield_stability_score
FROM yield_history
GROUP BY 
    toStartOfDay(timestamp),
    protocol_id,
    pool_id,
    asset_symbol;

-- =============================================================================
-- USER ACTIVITY AND BEHAVIOR ANALYTICS
-- =============================================================================

-- Daily active users and transaction patterns
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_daily_activity_metrics
(
    date Date,
    chain_id UInt32,
    protocol_id String,
    unique_users UInt32,
    total_transactions UInt32,
    total_volume_usd Decimal64(8),
    avg_transaction_size_usd Decimal64(8),
    whale_transactions UInt32,
    retail_transactions UInt32,
    gas_fees_total_usd Decimal64(8),
    new_users UInt32,
    returning_users UInt32
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(date)
ORDER BY (chain_id, protocol_id, date)
SETTINGS index_granularity = 8192
AS SELECT
    toDate(timestamp) as date,
    chain_id,
    protocol_id,
    uniq(from_address) as unique_users,
    count() as total_transactions,
    sum(amount_in_usd + amount_out_usd) / 2 as total_volume_usd,
    total_volume_usd / total_transactions as avg_transaction_size_usd,
    countIf(amount_in_usd > 100000) as whale_transactions,
    countIf(amount_in_usd <= 100000) as retail_transactions,
    sum(transaction_fee_usd) as gas_fees_total_usd,
    uniqIf(from_address, 
        from_address NOT IN (
            SELECT DISTINCT from_address 
            FROM transaction_events 
            WHERE timestamp < date AND timestamp >= date - INTERVAL 30 DAY
        )
    ) as new_users,
    unique_users - new_users as returning_users
FROM transaction_events
WHERE transaction_status = 'success'
GROUP BY 
    toDate(timestamp),
    chain_id,
    protocol_id;

-- MEV and arbitrage detection patterns
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_mev_analytics
(
    timestamp DateTime,
    chain_id UInt32,
    protocol_id String,
    mev_transactions UInt32,
    total_mev_value_usd Decimal64(8),
    arbitrage_transactions UInt32,
    sandwich_attacks UInt32,
    avg_mev_profit_usd Decimal64(8),
    mev_users UInt32,
    top_mev_user String
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (chain_id, protocol_id, timestamp)
SETTINGS index_granularity = 8192
AS SELECT
    toStartOfHour(timestamp) as timestamp,
    chain_id,
    protocol_id,
    countIf(mev_value_usd > 0) as mev_transactions,
    sum(mev_value_usd) as total_mev_value_usd,
    countIf(is_arbitrage = 1) as arbitrage_transactions,
    countIf(sandwich_attack = 1) as sandwich_attacks,
    avg(mev_value_usd) as avg_mev_profit_usd,
    uniqIf(from_address, mev_value_usd > 0) as mev_users,
    argMax(from_address, mev_value_usd) as top_mev_user
FROM transaction_events
WHERE transaction_status = 'success'
GROUP BY 
    toStartOfHour(timestamp),
    chain_id,
    protocol_id;

-- =============================================================================
-- CROSS-CHAIN ANALYTICS
-- =============================================================================

-- Cross-chain TVL and activity comparison
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_cross_chain_metrics
(
    timestamp DateTime,
    chain_id UInt32,
    total_tvl_usd Decimal64(8),
    total_volume_24h_usd Decimal64(8),
    unique_protocols UInt32,
    active_users_24h UInt32,
    transactions_24h UInt32,
    avg_gas_fee_usd Decimal64(8),
    market_share_tvl Float32,
    market_share_volume Float32
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (timestamp, total_tvl_usd DESC)
SETTINGS index_granularity = 8192
AS SELECT
    toStartOfHour(timestamp) as timestamp,
    chain_id,
    sum(tvl_usd) as total_tvl_usd,
    sum(volume_24h_usd) as total_volume_24h_usd,
    uniq(protocol_id) as unique_protocols,
    (SELECT uniq(from_address) FROM transaction_events te WHERE te.chain_id = lp.chain_id AND te.timestamp >= timestamp - INTERVAL 24 HOUR AND te.timestamp < timestamp + INTERVAL 1 HOUR) as active_users_24h,
    (SELECT count() FROM transaction_events te WHERE te.chain_id = lp.chain_id AND te.timestamp >= timestamp - INTERVAL 24 HOUR AND te.timestamp < timestamp + INTERVAL 1 HOUR) as transactions_24h,
    (SELECT avg(transaction_fee_usd) FROM transaction_events te WHERE te.chain_id = lp.chain_id AND te.timestamp >= timestamp - INTERVAL 24 HOUR AND te.timestamp < timestamp + INTERVAL 1 HOUR) as avg_gas_fee_usd,
    total_tvl_usd / (SELECT sum(total_tvl_usd) FROM mv_cross_chain_metrics WHERE timestamp = lp.timestamp) * 100 as market_share_tvl,
    total_volume_24h_usd / (SELECT sum(total_volume_24h_usd) FROM mv_cross_chain_metrics WHERE timestamp = lp.timestamp) * 100 as market_share_volume
FROM liquidity_pools lp
GROUP BY 
    toStartOfHour(timestamp),
    chain_id;

-- =============================================================================
-- RISK AND SECURITY ANALYTICS
-- =============================================================================

-- Protocol risk assessment aggregations
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_protocol_risk_metrics
(
    timestamp DateTime,
    protocol_id String,
    chain_id UInt32,
    avg_risk_score Float32,
    max_risk_score Float32,
    total_tvl_at_risk Decimal64(8),
    high_risk_pools UInt32,
    exploit_incidents UInt8,
    insurance_coverage_ratio Float32,
    risk_adjusted_tvl Decimal64(8)
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (protocol_id, timestamp)
SETTINGS index_granularity = 8192
AS SELECT
    toStartOfDay(timestamp) as timestamp,
    protocol_id,
    chain_id,
    avg(overall_risk_score) as avg_risk_score,
    max(overall_risk_score) as max_risk_score,
    sum(tvl_usd) as total_tvl_at_risk,
    countIf(overall_risk_score > 0.7) as high_risk_pools,
    max(exploit_history) as exploit_incidents,
    sum(insurance_coverage) / sum(tvl_usd) as insurance_coverage_ratio,
    sum(tvl_usd * (1 - overall_risk_score)) as risk_adjusted_tvl
FROM yield_history
GROUP BY 
    toStartOfDay(timestamp),
    protocol_id,
    chain_id;

-- =============================================================================
-- MARKET SENTIMENT AGGREGATIONS
-- =============================================================================

-- Sentiment trends and social metrics
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_sentiment_trends
(
    timestamp DateTime,
    asset_id String,
    overall_sentiment Float32,
    sentiment_volatility Float32,
    total_mentions UInt32,
    influencer_sentiment Float32,
    trending_score Float32,
    bullish_ratio Float32,
    bearish_ratio Float32
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (asset_id, timestamp)
SETTINGS index_granularity = 8192
AS SELECT
    toStartOfHour(timestamp) as timestamp,
    asset_id,
    avg(sentiment_score) as overall_sentiment,
    stddevSamp(sentiment_score) as sentiment_volatility,
    sum(total_mentions) as total_mentions,
    avgIf(sentiment_score, influencer_mentions > 0) as influencer_sentiment,
    total_mentions * overall_sentiment as trending_score,
    countIf(sentiment_score > 0.1) / count() as bullish_ratio,
    countIf(sentiment_score < -0.1) / count() as bearish_ratio
FROM market_sentiment
GROUP BY 
    toStartOfHour(timestamp),
    asset_id;

-- =============================================================================
-- PERFORMANCE OPTIMIZATION VIEWS
-- =============================================================================

-- Query performance statistics for optimization
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_query_performance_stats
(
    date Date,
    query_kind String,
    avg_duration_ms Float32,
    p95_duration_ms Float32,
    p99_duration_ms Float32,
    total_queries UInt32,
    failed_queries UInt32,
    success_rate Float32,
    avg_memory_usage UInt64,
    avg_read_rows UInt64
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(date)
ORDER BY (date, query_kind)
SETTINGS index_granularity = 8192
AS SELECT
    toDate(event_time) as date,
    query_kind,
    avg(query_duration_ms) as avg_duration_ms,
    quantile(0.95)(query_duration_ms) as p95_duration_ms,
    quantile(0.99)(query_duration_ms) as p99_duration_ms,
    count() as total_queries,
    countIf(exception_code != 0) as failed_queries,
    (total_queries - failed_queries) / total_queries * 100 as success_rate,
    avg(memory_usage) as avg_memory_usage,
    avg(read_rows) as avg_read_rows
FROM system.query_log
WHERE event_date >= today() - 30
GROUP BY 
    toDate(event_time),
    query_kind; 