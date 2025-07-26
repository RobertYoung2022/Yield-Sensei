/**
 * Comprehensive Database Schema Type Definitions
 * Centralized type system for all database tables, relationships, and operations
 */

import { SafeBigInt, ChainID, AssetID } from './common.js';

// =============================================================================
// BASE SCHEMA TYPES
// =============================================================================

/** Common fields for all database entities */
export interface BaseEntity {
  readonly id: string;
  readonly created_at: Date;
  readonly updated_at: Date;
}

/** Common fields for versioned entities */
export interface VersionedEntity extends BaseEntity {
  readonly version: number;
  readonly created_by?: string;
  readonly updated_by?: string;
}

/** Common fields for soft-deletable entities */
export interface SoftDeletableEntity extends BaseEntity {
  readonly deleted_at?: Date;
  readonly deleted_by?: string;
}

// =============================================================================
// PROTOCOL AND ASSET SCHEMAS
// =============================================================================

/** Protocol information table */
export interface ProtocolSchema extends VersionedEntity {
  readonly name: string;
  readonly slug: string;
  readonly description?: string;
  readonly website_url?: string;
  readonly documentation_url?: string;
  readonly github_url?: string;
  readonly twitter_handle?: string;
  readonly discord_url?: string;
  readonly telegram_url?: string;
  readonly category: 'lending' | 'dex' | 'yield-farming' | 'staking' | 'derivatives' | 'insurance' | 'bridge' | 'other';
  readonly chains: ChainID[];
  readonly total_tvl_usd: number;
  readonly risk_score: number; // 0-100
  readonly audit_status: 'unaudited' | 'pending' | 'audited' | 'multiple-audits';
  readonly audit_firms?: string[];
  readonly launch_date?: Date;
  readonly is_active: boolean;
  readonly tags: string[];
  readonly logo_url?: string;
  readonly metadata: Record<string, any>;
}

/** Asset information table */
export interface AssetSchema extends VersionedEntity {
  readonly symbol: string;
  readonly name: string;
  readonly asset_id: AssetID;
  readonly chain_id: ChainID;
  readonly contract_address?: string;
  readonly decimals: number;
  readonly is_native: boolean;
  readonly is_stablecoin: boolean;
  readonly coingecko_id?: string;
  readonly coinmarketcap_id?: string;
  readonly logo_url?: string;
  readonly description?: string;
  readonly website_url?: string;
  readonly market_cap_usd?: number;
  readonly circulating_supply?: SafeBigInt;
  readonly total_supply?: SafeBigInt;
  readonly max_supply?: SafeBigInt;
  readonly is_active: boolean;
  readonly metadata: Record<string, any>;
}

/** Chain information table */
export interface ChainSchema extends VersionedEntity {
  readonly chain_id: ChainID;
  readonly name: string;
  readonly display_name: string;
  readonly native_currency: string;
  readonly rpc_urls: string[];
  readonly explorer_urls: string[];
  readonly bridge_urls?: string[];
  readonly average_block_time: number; // seconds
  readonly average_gas_price: SafeBigInt;
  readonly max_gas_limit: SafeBigInt;
  readonly is_testnet: boolean;
  readonly is_active: boolean;
  readonly logo_url?: string;
  readonly color?: string;
  readonly metadata: Record<string, any>;
}

// =============================================================================
// PRICE AND MARKET DATA SCHEMAS
// =============================================================================

/** Real-time price data table */
export interface PriceDataSchema extends BaseEntity {
  readonly asset_id: AssetID;
  readonly chain_id: ChainID;
  readonly protocol_id?: string;
  readonly source: string;
  readonly price_usd: number;
  readonly price_eth?: number;
  readonly price_btc?: number;
  readonly volume_24h_usd: number;
  readonly market_cap_usd?: number;
  readonly circulating_supply?: SafeBigInt;
  readonly percent_change_1h?: number;
  readonly percent_change_24h?: number;
  readonly percent_change_7d?: number;
  readonly liquidity_usd?: number;
  readonly timestamp: Date;
  readonly block_number?: SafeBigInt;
  readonly confidence_score: number; // 0-1
  readonly metadata: Record<string, any>;
}

/** Historical OHLCV data table */
export interface OHLCVSchema extends BaseEntity {
  readonly asset_id: AssetID;
  readonly chain_id: ChainID;
  readonly timeframe: '1m' | '5m' | '15m' | '1h' | '4h' | '1d' | '1w' | '1M';
  readonly timestamp: Date;
  readonly open: number;
  readonly high: number;
  readonly low: number;
  readonly close: number;
  readonly volume: number;
  readonly volume_usd: number;
  readonly trades_count?: number;
  readonly vwap?: number; // Volume Weighted Average Price
  readonly metadata: Record<string, any>;
}

// =============================================================================
// LIQUIDITY POOL SCHEMAS
// =============================================================================

/** Liquidity pool information table */
export interface PoolSchema extends VersionedEntity {
  readonly pool_id: string;
  readonly protocol_id: string;
  readonly chain_id: ChainID;
  readonly pool_address: string;
  readonly pool_type: 'constant-product' | 'stable' | 'weighted' | 'concentrated' | 'other';
  readonly tokens: PoolTokenInfo[];
  readonly fee_tier: number; // basis points (e.g., 30 = 0.3%)
  readonly tvl_usd: number;
  readonly volume_24h_usd: number;
  readonly volume_7d_usd: number;
  readonly fees_24h_usd: number;
  readonly fees_7d_usd: number;
  readonly apy_24h?: number;
  readonly apy_7d?: number;
  readonly apy_30d?: number;
  readonly reserves: PoolReserve[];
  readonly is_active: boolean;
  readonly is_verified: boolean;
  readonly created_block: SafeBigInt;
  readonly created_timestamp: Date;
  readonly metadata: Record<string, any>;
}

/** Pool token information */
export interface PoolTokenInfo {
  readonly asset_id: AssetID;
  readonly weight?: number; // for weighted pools (0-1)
  readonly reserve: SafeBigInt;
  readonly reserve_usd: number;
}

/** Pool reserve snapshots */
export interface PoolReserve {
  readonly asset_id: AssetID;
  readonly reserve: SafeBigInt;
  readonly reserve_usd: number;
  readonly price_usd: number;
  readonly timestamp: Date;
}

// =============================================================================
// YIELD OPPORTUNITY SCHEMAS
// =============================================================================

/** Yield opportunities table */
export interface YieldOpportunitySchema extends VersionedEntity {
  readonly protocol_id: string;
  readonly pool_id?: string;
  readonly chain_id: ChainID;
  readonly strategy_type: 'lending' | 'liquidity-provision' | 'staking' | 'farming' | 'vault' | 'other';
  readonly asset_id: AssetID;
  readonly reward_assets: AssetID[];
  readonly apy: number;
  readonly apy_breakdown: APYBreakdown;
  readonly tvl_usd: number;
  readonly min_deposit?: SafeBigInt;
  readonly max_deposit?: SafeBigInt;
  readonly lock_period?: number; // seconds
  readonly withdrawal_fee?: number; // basis points
  readonly performance_fee?: number; // basis points
  readonly risk_score: number; // 0-100
  readonly risk_factors: RiskFactor[];
  readonly is_active: boolean;
  readonly is_audited: boolean;
  readonly audit_reports?: string[];
  readonly impermanent_loss_protection?: boolean;
  readonly auto_compound: boolean;
  readonly metadata: Record<string, any>;
}

/** APY breakdown details */
export interface APYBreakdown {
  readonly base_apy: number;
  readonly reward_apy: number;
  readonly compound_apy?: number;
  readonly fees_apy?: number;
  readonly incentive_apy?: number;
  readonly calculation_method: 'compound' | 'simple' | 'estimated';
  readonly last_updated: Date;
}

/** Risk assessment factors */
export interface RiskFactor {
  readonly type: 'smart-contract' | 'liquidity' | 'market' | 'operational' | 'regulatory';
  readonly severity: 'low' | 'medium' | 'high' | 'critical';
  readonly description: string;
  readonly mitigation?: string;
  readonly score: number; // 0-100
}

// =============================================================================
// BRIDGE AND CROSS-CHAIN SCHEMAS
// =============================================================================

/** Bridge route information */
export interface BridgeRouteSchema extends VersionedEntity {
  readonly source_chain: ChainID;
  readonly target_chain: ChainID;
  readonly source_asset: AssetID;
  readonly target_asset: AssetID;
  readonly bridge_protocol: string;
  readonly route_id: string;
  readonly min_amount: SafeBigInt;
  readonly max_amount: SafeBigInt;
  readonly fee_fixed?: SafeBigInt;
  readonly fee_percentage?: number; // basis points
  readonly estimated_time: number; // seconds
  readonly success_rate: number; // 0-1
  readonly is_active: boolean;
  readonly security_rating: number; // 0-100
  readonly metadata: Record<string, any>;
}

/** Bridge transaction history */
export interface BridgeTransactionSchema extends BaseEntity {
  readonly transaction_id: string;
  readonly user_address: string;
  readonly source_chain: ChainID;
  readonly target_chain: ChainID;
  readonly source_asset: AssetID;
  readonly target_asset: AssetID;
  readonly source_amount: SafeBigInt;
  readonly target_amount: SafeBigInt;
  readonly bridge_protocol: string;
  readonly route_id: string;
  readonly source_tx_hash: string;
  readonly target_tx_hash?: string;
  readonly status: 'pending' | 'confirmed' | 'failed' | 'refunded';
  readonly initiated_at: Date;
  readonly completed_at?: Date;
  readonly fee_paid: SafeBigInt;
  readonly gas_used?: SafeBigInt;
  readonly failure_reason?: string;
  readonly metadata: Record<string, any>;
}

// =============================================================================
// ARBITRAGE OPPORTUNITY SCHEMAS
// =============================================================================

/** Arbitrage opportunities table */
export interface ArbitrageOpportunitySchema extends BaseEntity {
  readonly opportunity_id: string;
  readonly asset_id: AssetID;
  readonly source_protocol: string;
  readonly target_protocol: string;
  readonly source_chain: ChainID;
  readonly target_chain: ChainID;
  readonly source_price: number;
  readonly target_price: number;
  readonly price_difference: number;
  readonly profit_percentage: number;
  readonly profit_usd: number;
  readonly required_capital: SafeBigInt;
  readonly execution_path: ExecutionStep[];
  readonly estimated_gas_cost: SafeBigInt;
  readonly estimated_time: number; // seconds
  readonly risk_score: number; // 0-100
  readonly confidence_score: number; // 0-1
  readonly is_executable: boolean;
  readonly expires_at: Date;
  readonly metadata: Record<string, any>;
}

/** Execution steps for arbitrage */
export interface ExecutionStep {
  readonly step_number: number;
  readonly operation: 'swap' | 'bridge' | 'transfer' | 'wrap' | 'unwrap';
  readonly protocol: string;
  readonly chain_id: ChainID;
  readonly from_asset: AssetID;
  readonly to_asset: AssetID;
  readonly amount_in: SafeBigInt;
  readonly amount_out: SafeBigInt;
  readonly estimated_gas: SafeBigInt;
  readonly slippage_tolerance: number;
  readonly metadata: Record<string, any>;
}

// =============================================================================
// USER AND TRANSACTION SCHEMAS
// =============================================================================

/** User portfolio tracking */
export interface UserPortfolioSchema extends VersionedEntity {
  readonly user_address: string;
  readonly chain_id: ChainID;
  readonly total_balance_usd: number;
  readonly positions: PortfolioPosition[];
  readonly yield_strategies: YieldPosition[];
  readonly last_updated: Date;
  readonly metadata: Record<string, any>;
}

/** Individual portfolio positions */
export interface PortfolioPosition {
  readonly asset_id: AssetID;
  readonly protocol_id?: string;
  readonly position_type: 'holding' | 'staked' | 'lp' | 'borrowed' | 'lent';
  readonly amount: SafeBigInt;
  readonly value_usd: number;
  readonly entry_price?: number;
  readonly unrealized_pnl_usd?: number;
  readonly yield_earned_usd?: number;
  readonly last_updated: Date;
}

/** Yield farming positions */
export interface YieldPosition {
  readonly opportunity_id: string;
  readonly protocol_id: string;
  readonly pool_id?: string;
  readonly staked_amount: SafeBigInt;
  readonly rewards_earned: RewardEarned[];
  readonly entry_timestamp: Date;
  readonly last_claim_timestamp?: Date;
  readonly auto_compound: boolean;
  readonly is_active: boolean;
}

/** Rewards earned tracking */
export interface RewardEarned {
  readonly asset_id: AssetID;
  readonly amount: SafeBigInt;
  readonly value_usd: number;
  readonly claimed: boolean;
  readonly earned_timestamp: Date;
}

// =============================================================================
// ANALYTICS AND METRICS SCHEMAS
// =============================================================================

/** Protocol TVL snapshots */
export interface ProtocolTVLSchema extends BaseEntity {
  readonly protocol_id: string;
  readonly chain_id: ChainID;
  readonly tvl_usd: number;
  readonly tvl_change_24h: number;
  readonly tvl_change_7d: number;
  readonly pool_count: number;
  readonly active_pools: number;
  readonly user_count?: number;
  readonly transaction_count_24h?: number;
  readonly volume_24h_usd?: number;
  readonly fees_24h_usd?: number;
  readonly timestamp: Date;
  readonly metadata: Record<string, any>;
}

/** Market sentiment analysis */
export interface MarketSentimentSchema extends BaseEntity {
  readonly asset_id: AssetID;
  readonly sentiment_score: number; // -1 to 1
  readonly confidence: number; // 0-1
  readonly total_mentions: number;
  readonly bullish_mentions: number;
  readonly bearish_mentions: number;
  readonly neutral_mentions: number;
  readonly trending_score: number; // 0-100
  readonly sources: SentimentSource[];
  readonly timestamp: Date;
  readonly metadata: Record<string, any>;
}

/** Sentiment data sources */
export interface SentimentSource {
  readonly source: 'twitter' | 'reddit' | 'discord' | 'telegram' | 'news' | 'other';
  readonly mentions: number;
  readonly avg_sentiment: number;
  readonly weight: number;
}

// =============================================================================
// SECURITY AND AUDIT SCHEMAS
// =============================================================================

/** Security audit information */
export interface SecurityAuditSchema extends VersionedEntity {
  readonly protocol_id: string;
  readonly audit_firm: string;
  readonly audit_type: 'smart-contract' | 'economic' | 'operational' | 'comprehensive';
  readonly scope: string[];
  readonly report_url?: string;
  readonly report_hash?: string;
  readonly findings_count: AuditFindings;
  readonly overall_rating: 'excellent' | 'good' | 'fair' | 'poor' | 'critical';
  readonly audit_date: Date;
  readonly expiry_date?: Date;
  readonly is_public: boolean;
  readonly metadata: Record<string, any>;
}

/** Audit findings breakdown */
export interface AuditFindings {
  readonly critical: number;
  readonly high: number;
  readonly medium: number;
  readonly low: number;
  readonly informational: number;
  readonly total: number;
}

// =============================================================================
// DATABASE OPERATION TYPES
// =============================================================================

/** Database query filters */
export interface QueryFilter<T = any> {
  readonly field: keyof T;
  readonly operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'nin' | 'like' | 'between';
  readonly value: any;
}

/** Database sort options */
export interface SortOption<T = any> {
  readonly field: keyof T;
  readonly direction: 'asc' | 'desc';
}

/** Pagination options */
export interface PaginationOptions {
  readonly page?: number;
  readonly limit?: number;
  readonly offset?: number;
}

/** Database query options */
export interface QueryOptions<T = any> {
  readonly filters?: QueryFilter<T>[];
  readonly sort?: SortOption<T>[];
  readonly pagination?: PaginationOptions;
  readonly include?: string[];
  readonly fields?: (keyof T)[];
}

/** Database transaction context */
export interface TransactionContext {
  readonly id: string;
  readonly isolation_level?: 'read_uncommitted' | 'read_committed' | 'repeatable_read' | 'serializable';
  readonly timeout?: number;
  readonly readonly?: boolean;
}

// =============================================================================
// MIGRATION AND VERSIONING TYPES
// =============================================================================

/** Database migration definition */
export interface DatabaseMigration {
  readonly version: string;
  readonly name: string;
  readonly description: string;
  readonly up: string | string[];
  readonly down: string | string[];
  readonly dependencies?: string[];
  readonly created_at: Date;
  readonly created_by: string;
}

/** Schema version tracking */
export interface SchemaVersion {
  readonly version: string;
  readonly applied_at: Date;
  readonly applied_by: string;
  readonly checksum: string;
  readonly execution_time_ms: number;
  readonly success: boolean;
  readonly error_message?: string;
}

// =============================================================================
// VALIDATION SCHEMAS
// =============================================================================

/** Field validation rules */
export interface FieldValidation {
  readonly required?: boolean;
  readonly type?: 'string' | 'number' | 'boolean' | 'date' | 'bigint' | 'array' | 'object';
  readonly min?: number;
  readonly max?: number;
  readonly minLength?: number;
  readonly maxLength?: number;
  readonly pattern?: string;
  readonly enum?: readonly string[] | readonly number[] | any[];
  readonly custom?: (value: any) => boolean | string;
}

/** Table validation schema */
export interface TableValidationSchema<T = any> {
  readonly tableName: string;
  readonly fields: Record<keyof T, FieldValidation>;
  readonly indexes?: IndexDefinition[];
  readonly constraints?: ConstraintDefinition[];
  readonly relationships?: RelationshipDefinition[];
}

/** Index definitions */
export interface IndexDefinition {
  readonly name: string;
  readonly fields: string[];
  readonly unique?: boolean;
  readonly partial?: string;
  readonly type?: 'btree' | 'hash' | 'gin' | 'gist';
}

/** Constraint definitions */
export interface ConstraintDefinition {
  readonly name: string;
  readonly type: 'primary_key' | 'foreign_key' | 'unique' | 'check' | 'not_null';
  readonly fields: string[];
  readonly reference_table?: string;
  readonly reference_fields?: string[];
  readonly on_delete?: 'cascade' | 'restrict' | 'set_null' | 'set_default';
  readonly on_update?: 'cascade' | 'restrict' | 'set_null' | 'set_default';
  readonly condition?: string;
}

/** Relationship definitions */
export interface RelationshipDefinition {
  readonly name: string;
  readonly type: 'one_to_one' | 'one_to_many' | 'many_to_one' | 'many_to_many';
  readonly local_field: string;
  readonly foreign_table: string;
  readonly foreign_field: string;
  readonly junction_table?: string;
  readonly cascade_delete?: boolean;
}

// =============================================================================
// EXPORT ALL SCHEMA TYPES
// =============================================================================

/** Union of all database schema types */
export type DatabaseSchema = 
  | ProtocolSchema
  | AssetSchema
  | ChainSchema
  | PriceDataSchema
  | OHLCVSchema
  | PoolSchema
  | YieldOpportunitySchema
  | BridgeRouteSchema
  | BridgeTransactionSchema
  | ArbitrageOpportunitySchema
  | UserPortfolioSchema
  | ProtocolTVLSchema
  | MarketSentimentSchema
  | SecurityAuditSchema;

/** Database table names */
export type TableName = 
  | 'protocols'
  | 'assets'
  | 'chains'
  | 'price_data'
  | 'ohlcv_data'
  | 'pools'
  | 'yield_opportunities'
  | 'bridge_routes'
  | 'bridge_transactions'
  | 'arbitrage_opportunities'
  | 'user_portfolios'
  | 'protocol_tvl'
  | 'market_sentiment'
  | 'security_audits';

/** Type mapping for table names to schemas */
export interface TableSchemaMap {
  protocols: ProtocolSchema;
  assets: AssetSchema;
  chains: ChainSchema;
  price_data: PriceDataSchema;
  ohlcv_data: OHLCVSchema;
  pools: PoolSchema;
  yield_opportunities: YieldOpportunitySchema;
  bridge_routes: BridgeRouteSchema;
  bridge_transactions: BridgeTransactionSchema;
  arbitrage_opportunities: ArbitrageOpportunitySchema;
  user_portfolios: UserPortfolioSchema;
  protocol_tvl: ProtocolTVLSchema;
  market_sentiment: MarketSentimentSchema;
  security_audits: SecurityAuditSchema;
}