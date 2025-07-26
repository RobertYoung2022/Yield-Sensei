/**
 * Database Schema Registry
 * Centralized registry of all database table validation schemas
 */

import type {
  TableValidationSchema,
  ProtocolSchema,
  AssetSchema,
  ChainSchema,
  PriceDataSchema,
  PoolSchema,
  YieldOpportunitySchema,
  TableName,
} from '../../types/database-schemas.js';
import { CommonValidations } from '../../utils/database-validation.js';

// =============================================================================
// PROTOCOL SCHEMA VALIDATION
// =============================================================================

export const ProtocolValidationSchema: TableValidationSchema<ProtocolSchema> = {
  tableName: 'protocols',
  fields: {
    id: CommonValidations.id,
    created_at: CommonValidations.timestamp,
    updated_at: CommonValidations.timestamp,
    version: { required: true, type: 'number', min: 1 },
    created_by: { type: 'string' },
    updated_by: { type: 'string' },
    name: { required: true, type: 'string', minLength: 1, maxLength: 255 },
    slug: { required: true, type: 'string', minLength: 1, maxLength: 100, pattern: '^[a-z0-9-]+$' },
    description: { type: 'string', maxLength: 1000 },
    website_url: CommonValidations.url,
    documentation_url: CommonValidations.url,
    github_url: CommonValidations.url,
    twitter_handle: { type: 'string', pattern: '^@?[a-zA-Z0-9_]+$' },
    discord_url: CommonValidations.url,
    telegram_url: CommonValidations.url,
    category: {
      required: true,
      type: 'string',
      enum: ['lending', 'dex', 'yield-farming', 'staking', 'derivatives', 'insurance', 'bridge', 'other']
    },
    chains: { required: true, type: 'array' },
    total_tvl_usd: { required: true, type: 'number', min: 0 },
    risk_score: CommonValidations.riskScore,
    audit_status: {
      required: true,
      type: 'string',
      enum: ['unaudited', 'pending', 'audited', 'multiple-audits']
    },
    audit_firms: { type: 'array' },
    launch_date: { type: 'date' },
    is_active: { required: true, type: 'boolean' },
    tags: { required: true, type: 'array' },
    logo_url: CommonValidations.url,
    metadata: { required: true, type: 'object' },
  },
  indexes: [
    { name: 'idx_protocols_slug', fields: ['slug'], unique: true },
    { name: 'idx_protocols_category', fields: ['category'] },
    { name: 'idx_protocols_risk_score', fields: ['risk_score'] },
    { name: 'idx_protocols_active', fields: ['is_active'] },
  ],
  constraints: [
    { name: 'pk_protocols', type: 'primary_key', fields: ['id'] },
    { name: 'uq_protocols_slug', type: 'unique', fields: ['slug'] },
  ],
};

// =============================================================================
// ASSET SCHEMA VALIDATION
// =============================================================================

export const AssetValidationSchema: TableValidationSchema<AssetSchema> = {
  tableName: 'assets',
  fields: {
    id: CommonValidations.id,
    created_at: CommonValidations.timestamp,
    updated_at: CommonValidations.timestamp,
    version: { required: true, type: 'number', min: 1 },
    created_by: { type: 'string' },
    updated_by: { type: 'string' },
    symbol: { required: true, type: 'string', minLength: 1, maxLength: 20 },
    name: { required: true, type: 'string', minLength: 1, maxLength: 255 },
    asset_id: { required: true, type: 'string', minLength: 1, maxLength: 100 },
    chain_id: CommonValidations.chainId,
    contract_address: CommonValidations.address,
    decimals: { required: true, type: 'number', min: 0, max: 18 },
    is_native: { required: true, type: 'boolean' },
    is_stablecoin: { required: true, type: 'boolean' },
    coingecko_id: { type: 'string', maxLength: 100 },
    coinmarketcap_id: { type: 'string', maxLength: 100 },
    logo_url: CommonValidations.url,
    description: { type: 'string', maxLength: 1000 },
    website_url: CommonValidations.url,
    market_cap_usd: { type: 'number', min: 0 },
    circulating_supply: { type: 'bigint', min: 0 },
    total_supply: { type: 'bigint', min: 0 },
    max_supply: { type: 'bigint', min: 0 },
    is_active: { required: true, type: 'boolean' },
    metadata: { required: true, type: 'object' },
  },
  indexes: [
    { name: 'idx_assets_symbol_chain', fields: ['symbol', 'chain_id'], unique: true },
    { name: 'idx_assets_asset_id', fields: ['asset_id'] },
    { name: 'idx_assets_contract', fields: ['contract_address'] },
    { name: 'idx_assets_active', fields: ['is_active'] },
  ],
  constraints: [
    { name: 'pk_assets', type: 'primary_key', fields: ['id'] },
    { name: 'uq_assets_symbol_chain', type: 'unique', fields: ['symbol', 'chain_id'] },
  ],
};

// =============================================================================
// CHAIN SCHEMA VALIDATION
// =============================================================================

export const ChainValidationSchema: TableValidationSchema<ChainSchema> = {
  tableName: 'chains',
  fields: {
    id: CommonValidations.id,
    created_at: CommonValidations.timestamp,
    updated_at: CommonValidations.timestamp,
    version: { required: true, type: 'number', min: 1 },
    created_by: { type: 'string' },
    updated_by: { type: 'string' },
    chain_id: CommonValidations.chainId,
    name: { required: true, type: 'string', minLength: 1, maxLength: 100 },
    display_name: { required: true, type: 'string', minLength: 1, maxLength: 100 },
    native_currency: { required: true, type: 'string', minLength: 1, maxLength: 20 },
    rpc_urls: { required: true, type: 'array' },
    explorer_urls: { required: true, type: 'array' },
    bridge_urls: { type: 'array' },
    average_block_time: { required: true, type: 'number', min: 0 },
    average_gas_price: CommonValidations.bigintAmount,
    max_gas_limit: CommonValidations.bigintAmount,
    is_testnet: { required: true, type: 'boolean' },
    is_active: { required: true, type: 'boolean' },
    logo_url: CommonValidations.url,
    color: { type: 'string', pattern: '^#[0-9a-fA-F]{6}$' },
    metadata: { required: true, type: 'object' },
  },
  indexes: [
    { name: 'idx_chains_chain_id', fields: ['chain_id'], unique: true },
    { name: 'idx_chains_active', fields: ['is_active'] },
    { name: 'idx_chains_testnet', fields: ['is_testnet'] },
  ],
  constraints: [
    { name: 'pk_chains', type: 'primary_key', fields: ['id'] },
    { name: 'uq_chains_chain_id', type: 'unique', fields: ['chain_id'] },
  ],
};

// =============================================================================
// PRICE DATA SCHEMA VALIDATION
// =============================================================================

export const PriceDataValidationSchema: TableValidationSchema<PriceDataSchema> = {
  tableName: 'price_data',
  fields: {
    id: CommonValidations.id,
    created_at: CommonValidations.timestamp,
    updated_at: CommonValidations.timestamp,
    asset_id: { required: true, type: 'string', minLength: 1, maxLength: 100 },
    chain_id: CommonValidations.chainId,
    protocol_id: { type: 'string', maxLength: 255 },
    source: { required: true, type: 'string', minLength: 1, maxLength: 100 },
    price_usd: { required: true, type: 'number', min: 0 },
    price_eth: { type: 'number', min: 0 },
    price_btc: { type: 'number', min: 0 },
    volume_24h_usd: { required: true, type: 'number', min: 0 },
    market_cap_usd: { type: 'number', min: 0 },
    circulating_supply: { type: 'bigint', min: 0 },
    percent_change_1h: { type: 'number' },
    percent_change_24h: { type: 'number' },
    percent_change_7d: { type: 'number' },
    liquidity_usd: { type: 'number', min: 0 },
    timestamp: CommonValidations.timestamp,
    block_number: { type: 'bigint', min: 0 },
    confidence_score: { required: true, type: 'number', min: 0, max: 1 },
    metadata: { required: true, type: 'object' },
  },
  indexes: [
    { name: 'idx_price_data_asset_timestamp', fields: ['asset_id', 'timestamp'] },
    { name: 'idx_price_data_chain_timestamp', fields: ['chain_id', 'timestamp'] },
    { name: 'idx_price_data_source', fields: ['source'] },
    { name: 'idx_price_data_timestamp', fields: ['timestamp'] },
  ],
  constraints: [
    { name: 'pk_price_data', type: 'primary_key', fields: ['id'] },
  ],
  relationships: [
    {
      name: 'price_data_asset',
      type: 'many_to_one',
      local_field: 'asset_id',
      foreign_table: 'assets',
      foreign_field: 'asset_id',
    },
    {
      name: 'price_data_chain',
      type: 'many_to_one',
      local_field: 'chain_id',
      foreign_table: 'chains',
      foreign_field: 'chain_id',
    },
  ],
};

// =============================================================================
// POOL SCHEMA VALIDATION
// =============================================================================

export const PoolValidationSchema: TableValidationSchema<PoolSchema> = {
  tableName: 'pools',
  fields: {
    id: CommonValidations.id,
    created_at: CommonValidations.timestamp,
    updated_at: CommonValidations.timestamp,
    version: { required: true, type: 'number', min: 1 },
    created_by: { type: 'string' },
    updated_by: { type: 'string' },
    pool_id: { required: true, type: 'string', minLength: 1, maxLength: 255 },
    protocol_id: { required: true, type: 'string', minLength: 1, maxLength: 255 },
    chain_id: CommonValidations.chainId,
    pool_address: CommonValidations.address,
    pool_type: {
      required: true,
      type: 'string',
      enum: ['constant-product', 'stable', 'weighted', 'concentrated', 'other']
    },
    tokens: { required: true, type: 'array' },
    fee_tier: { required: true, type: 'number', min: 0, max: 10000 }, // basis points
    tvl_usd: { required: true, type: 'number', min: 0 },
    volume_24h_usd: { required: true, type: 'number', min: 0 },
    volume_7d_usd: { required: true, type: 'number', min: 0 },
    fees_24h_usd: { required: true, type: 'number', min: 0 },
    fees_7d_usd: { required: true, type: 'number', min: 0 },
    apy_24h: CommonValidations.apy,
    apy_7d: CommonValidations.apy,
    apy_30d: CommonValidations.apy,
    reserves: { required: true, type: 'array' },
    is_active: { required: true, type: 'boolean' },
    is_verified: { required: true, type: 'boolean' },
    created_block: { required: true, type: 'bigint', min: 0 },
    created_timestamp: CommonValidations.timestamp,
    metadata: { required: true, type: 'object' },
  },
  indexes: [
    { name: 'idx_pools_pool_id', fields: ['pool_id'], unique: true },
    { name: 'idx_pools_protocol', fields: ['protocol_id'] },
    { name: 'idx_pools_chain', fields: ['chain_id'] },
    { name: 'idx_pools_tvl', fields: ['tvl_usd'] },
    { name: 'idx_pools_active', fields: ['is_active'] },
  ],
  constraints: [
    { name: 'pk_pools', type: 'primary_key', fields: ['id'] },
    { name: 'uq_pools_pool_id', type: 'unique', fields: ['pool_id'] },
  ],
  relationships: [
    {
      name: 'pool_protocol',
      type: 'many_to_one',
      local_field: 'protocol_id',
      foreign_table: 'protocols',
      foreign_field: 'id',
    },
    {
      name: 'pool_chain',
      type: 'many_to_one',
      local_field: 'chain_id',
      foreign_table: 'chains',
      foreign_field: 'chain_id',
    },
  ],
};

// =============================================================================
// YIELD OPPORTUNITY SCHEMA VALIDATION
// =============================================================================

export const YieldOpportunityValidationSchema: TableValidationSchema<YieldOpportunitySchema> = {
  tableName: 'yield_opportunities',
  fields: {
    id: CommonValidations.id,
    created_at: CommonValidations.timestamp,
    updated_at: CommonValidations.timestamp,
    version: { required: true, type: 'number', min: 1 },
    created_by: { type: 'string' },
    updated_by: { type: 'string' },
    protocol_id: { required: true, type: 'string', minLength: 1, maxLength: 255 },
    pool_id: { type: 'string', maxLength: 255 },
    chain_id: CommonValidations.chainId,
    strategy_type: {
      required: true,
      type: 'string',
      enum: ['lending', 'liquidity-provision', 'staking', 'farming', 'vault', 'other']
    },
    asset_id: { required: true, type: 'string', minLength: 1, maxLength: 100 },
    reward_assets: { required: true, type: 'array' },
    apy: CommonValidations.apy,
    apy_breakdown: { required: true, type: 'object' },
    tvl_usd: { required: true, type: 'number', min: 0 },
    min_deposit: { type: 'bigint', min: 0 },
    max_deposit: { type: 'bigint', min: 0 },
    lock_period: { type: 'number', min: 0 }, // seconds
    withdrawal_fee: { type: 'number', min: 0, max: 10000 }, // basis points
    performance_fee: { type: 'number', min: 0, max: 10000 }, // basis points
    risk_score: CommonValidations.riskScore,
    risk_factors: { required: true, type: 'array' },
    is_active: { required: true, type: 'boolean' },
    is_audited: { required: true, type: 'boolean' },
    audit_reports: { type: 'array' },
    impermanent_loss_protection: { type: 'boolean' },
    auto_compound: { required: true, type: 'boolean' },
    metadata: { required: true, type: 'object' },
  },
  indexes: [
    { name: 'idx_yield_opportunities_protocol', fields: ['protocol_id'] },
    { name: 'idx_yield_opportunities_chain', fields: ['chain_id'] },
    { name: 'idx_yield_opportunities_apy', fields: ['apy'] },
    { name: 'idx_yield_opportunities_risk', fields: ['risk_score'] },
    { name: 'idx_yield_opportunities_active', fields: ['is_active'] },
  ],
  constraints: [
    { name: 'pk_yield_opportunities', type: 'primary_key', fields: ['id'] },
  ],
  relationships: [
    {
      name: 'yield_opportunity_protocol',
      type: 'many_to_one',
      local_field: 'protocol_id',
      foreign_table: 'protocols',
      foreign_field: 'id',
    },
    {
      name: 'yield_opportunity_pool',
      type: 'many_to_one',
      local_field: 'pool_id',
      foreign_table: 'pools',
      foreign_field: 'pool_id',
    },
  ],
};

// =============================================================================
// SCHEMA REGISTRY
// =============================================================================

/**
 * Centralized registry of all table validation schemas
 */
export const SchemaRegistry = {
  protocols: ProtocolValidationSchema,
  assets: AssetValidationSchema,
  chains: ChainValidationSchema,
  price_data: PriceDataValidationSchema,
  pools: PoolValidationSchema,
  yield_opportunities: YieldOpportunityValidationSchema,
  // Additional schemas can be added here as needed
} as const;

/**
 * Get validation schema for a table
 */
export function getValidationSchema<T extends keyof typeof SchemaRegistry>(
  tableName: T
): typeof SchemaRegistry[T] {
  const schema = SchemaRegistry[tableName];
  if (!schema) {
    throw new Error(`No validation schema found for table: ${tableName}`);
  }
  return schema;
}

/**
 * Get all available table names
 */
export function getAvailableTableNames(): (keyof typeof SchemaRegistry)[] {
  return Object.keys(SchemaRegistry) as (keyof typeof SchemaRegistry)[];
}

/**
 * Check if a table has a validation schema
 */
export function hasValidationSchema(tableName: string): tableName is keyof typeof SchemaRegistry {
  return tableName in SchemaRegistry;
}

/**
 * Validate that all required schemas are present
 */
export function validateSchemaRegistry(): {
  isComplete: boolean;
  missingSchemas: string[];
  availableSchemas: string[];
} {
  const requiredTables: TableName[] = [
    'protocols',
    'assets', 
    'chains',
    'price_data',
    'ohlcv_data',
    'pools',
    'yield_opportunities',
    'bridge_routes',
    'bridge_transactions',
    'arbitrage_opportunities',
    'user_portfolios',
    'protocol_tvl',
    'market_sentiment',
    'security_audits',
  ];
  
  const availableSchemas = getAvailableTableNames();
  const missingSchemas = requiredTables.filter(
    table => !availableSchemas.includes(table as any)
  );
  
  return {
    isComplete: missingSchemas.length === 0,
    missingSchemas,
    availableSchemas: availableSchemas as string[],
  };
}