/**
 * Institutional Data Feed Types
 * Common interfaces and types for institutional data provider integrations
 */

export type DataProvider = 'coingecko' | 'dune' | 'defillama' | 'moralis';

export interface DataProviderConfig {
  provider: DataProvider;
  apiKey?: string;
  baseUrl?: string;
  rateLimitRpm?: number;
  timeout?: number;
  retries?: number;
  enableCaching?: boolean;
  cacheTTL?: number;
}

export interface DataResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  metadata?: {
    provider?: string;
    timestamp?: number;
    rateLimitRemaining?: number;
    rateLimitReset?: number;
    cached?: boolean;
    requestId?: string;
  };
}

export interface PriceData {
  id: string;
  symbol: string;
  name: string;
  current_price: number;
  market_cap: number;
  market_cap_rank: number;
  fully_diluted_valuation?: number;
  total_volume: number;
  high_24h: number;
  low_24h: number;
  price_change_24h: number;
  price_change_percentage_24h: number;
  price_change_percentage_7d?: number;
  price_change_percentage_30d?: number;
  market_cap_change_24h: number;
  market_cap_change_percentage_24h: number;
  circulating_supply: number;
  total_supply?: number;
  max_supply?: number;
  ath: number;
  ath_change_percentage: number;
  ath_date: string;
  atl: number;
  atl_change_percentage: number;
  atl_date: string;
  last_updated: string;
}

export interface HistoricalPrice {
  timestamp: number;
  price: number;
  market_cap?: number;
  total_volume?: number;
}

export interface ProtocolData {
  id: string;
  name: string;
  symbol?: string;
  slug: string;
  tvl: number;
  tvlPrevDay?: number;
  tvlPrevWeek?: number;
  tvlPrevMonth?: number;
  chains: string[];
  category: string;
  logo?: string;
  url?: string;
  description?: string;
  twitter?: string;
  forkedFrom?: string[];
  gecko_id?: string;
  cmcId?: string;
  audit?: {
    date: string;
    name: string;
    link: string;
  }[];
  methodology?: string;
  parentProtocol?: string;
  module?: string;
}

export interface YieldData {
  pool: string;
  chain: string;
  project: string;
  symbol: string;
  tvlUsd: number;
  apy: number;
  apyBase?: number;
  apyReward?: number;
  rewardTokens?: string[];
  il7d?: number;
  apyBase7d?: number;
  apyMean30d?: number;
  volumeUsd1d?: number;
  volumeUsd7d?: number;
  apyBaseInception?: number;
  underlyingTokens?: string[];
  poolMeta?: string;
  url?: string;
  category?: string;
  exposure?: string;
  predictions?: {
    predictedClass: string;
    predictedProbability: number;
    binnedConfidence: number;
  };
}

export interface OnChainMetrics {
  protocol: string;
  chain: string;
  timestamp: number;
  activeUsers: number;
  transactions: number;
  volume: number;
  fees: number;
  revenue: number;
  uniqueAddresses?: number;
  newAddresses?: number;
  returningAddresses?: number;
}

export interface TokenData {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logo?: string;
  thumbnail?: string;
  balance?: string;
  possible_spam?: boolean;
  verified_contract?: boolean;
  total_supply?: string;
  total_supply_formatted?: string;
  percentage_relative_to_total_supply?: number;
}

export interface NFTData {
  token_address: string;
  token_id: string;
  contract_type: string;
  owner_of: string;
  block_number: string;
  block_number_minted: string;
  token_uri?: string;
  metadata?: any;
  synced_at: string;
  amount: string;
  name: string;
  symbol: string;
  token_hash: string;
  last_token_uri_sync: string;
  last_metadata_sync: string;
  minter_address: string;
  verified_collection?: boolean;
  possible_spam?: boolean;
}

export interface DuneQuery {
  query_id: number;
  name: string;
  description?: string;
  query_sql: string;
  parameters?: DuneParameter[];
  created_at: string;
  updated_at: string;
  user: string;
  version: number;
  is_private: boolean;
  tags?: string[];
}

export interface DuneParameter {
  key: string;
  type: 'text' | 'number' | 'date' | 'datetime' | 'enum';
  value: any;
  enum_options?: string[];
}

export interface DuneResult {
  execution_id: string;
  query_id: number;
  state: 'QUERY_STATE_PENDING' | 'QUERY_STATE_EXECUTING' | 'QUERY_STATE_COMPLETED' | 'QUERY_STATE_FAILED';
  submitted_at: string;
  expires_at: string;
  execution_started_at?: string;
  execution_ended_at?: string;
  result?: {
    rows: any[];
    metadata: {
      column_names: string[];
      column_types: string[];
      row_count: number;
      result_set_bytes: number;
      total_row_count: number;
      datapoint_count: number;
    };
  };
  error?: string;
}

export interface DataProviderClient {
  readonly provider: DataProvider;
  readonly config: DataProviderConfig;

  // Core operations
  initialize(): Promise<void>;
  healthCheck(): Promise<boolean>;
  getRateLimitStatus(): Promise<RateLimitStatus>;
  
  // Price data methods (CoinGecko)
  getCurrentPrices?(coins: string[], vs_currencies?: string[]): Promise<DataResponse<Record<string, Record<string, number>>>>;
  getHistoricalPrices?(coin: string, days: number, vs_currency?: string): Promise<DataResponse<HistoricalPrice[]>>;
  getCoinDetails?(coin: string): Promise<DataResponse<PriceData>>;
  searchCoins?(query: string): Promise<DataResponse<any[]>>;
  
  // Protocol data methods (DefiLlama)
  getProtocols?(): Promise<DataResponse<ProtocolData[]>>;
  getProtocol?(protocol: string): Promise<DataResponse<ProtocolData>>;
  getProtocolTVL?(protocol: string): Promise<DataResponse<any[]>>;
  getYieldPools?(): Promise<DataResponse<YieldData[]>>;
  
  // On-chain analytics methods (Dune)
  executeQuery?(queryId: number, parameters?: Record<string, any>): Promise<DataResponse<DuneResult>>;
  getQueryResult?(executionId: string): Promise<DataResponse<DuneResult>>;
  getQuery?(queryId: number): Promise<DataResponse<DuneQuery>>;
  
  // Blockchain data methods (Moralis)
  getTokenBalances?(address: string, chain: string): Promise<DataResponse<TokenData[]>>;
  getTokenMetadata?(addresses: string[], chain: string): Promise<DataResponse<TokenData[]>>;
  getNFTs?(address: string, chain: string): Promise<DataResponse<NFTData[]>>;
  getTransactions?(address: string, chain: string): Promise<DataResponse<any[]>>;
}

export interface RateLimitStatus {
  remaining: number;
  reset: Date;
  limit: number;
  resetInSeconds: number;
}

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

export interface DataNormalizationConfig {
  enableNormalization: boolean;
  outputFormat: 'json' | 'csv' | 'parquet';
  timestampFormat: 'unix' | 'iso' | 'human';
  numberPrecision: number;
  currencyConversion: {
    enabled: boolean;
    baseCurrency: string;
    exchangeRates: Record<string, number>;
  };
  fieldMapping: Record<string, string>;
  dataValidation: {
    enabled: boolean;
    strictMode: boolean;
    requiredFields: string[];
  };
}

export interface NormalizedData {
  provider: DataProvider;
  dataType: string;
  timestamp: number;
  data: any;
  metadata: {
    originalFormat: string;
    normalizedAt: number;
    version: string;
    fields: string[];
    recordCount: number;
  };
}

export interface DataManagerConfig {
  providers: DataProviderConfig[];
  normalization: DataNormalizationConfig;
  caching: {
    enabled: boolean;
    provider: 'memory' | 'redis' | 'file';
    defaultTTL: number;
    maxSize: number;
  };
  aggregation: {
    enabled: boolean;
    interval: number;
    retention: number;
    metrics: string[];
  };
  alerts: {
    enabled: boolean;
    priceChangeThreshold: number;
    volumeChangeThreshold: number;
    tvlChangeThreshold: number;
    notificationChannels: string[];
  };
  healthCheck: {
    enabled: boolean;
    interval: number;
    timeout: number;
    retryAttempts: number;
  };
}

export interface AggregatedMetrics {
  timestamp: number;
  timeframe: string;
  metrics: {
    totalMarketCap: number;
    totalVolume: number;
    totalTVL: number;
    activeProtocols: number;
    topGainers: Array<{ symbol: string; change: number }>;
    topLosers: Array<{ symbol: string; change: number }>;
    averageAPY: number;
    highestAPY: { pool: string; apy: number };
  };
  breakdown: {
    byChain: Record<string, { tvl: number; protocols: number }>;
    byCategory: Record<string, { tvl: number; protocols: number }>;
    byProvider: Record<string, { dataPoints: number; coverage: number }>;
  };
}

export interface DataProviderError extends Error {
  provider?: DataProvider;
  code?: string;
  rateLimited?: boolean;
  retryAfter?: number;
  retryable?: boolean;
  requestId?: string;
}

export interface WebhookPayload {
  provider: DataProvider;
  event: string;
  data: any;
  timestamp: number;
  signature?: string;
}

export interface DataStream {
  id: string;
  provider: DataProvider;
  type: 'price' | 'protocol' | 'yield' | 'onchain';
  filters: Record<string, any>;
  isActive: boolean;
  lastUpdate: Date;
  updateInterval: number;
  onData: (data: any) => void;
  onError: (error: Error) => void;
}

export interface DataQuery {
  id: string;
  provider: DataProvider;
  method: string;
  parameters: Record<string, any>;
  cacheKey?: string;
  cacheTTL?: number;
  priority: 'low' | 'medium' | 'high';
  createdAt: Date;
  executedAt?: Date;
  completedAt?: Date;
  status: 'pending' | 'executing' | 'completed' | 'failed';
  result?: DataResponse<any>;
  error?: string;
}

export interface DataPipeline {
  id: string;
  name: string;
  description: string;
  providers: DataProvider[];
  queries: DataQuery[];
  transformations: Array<{
    type: 'filter' | 'map' | 'reduce' | 'join' | 'aggregate';
    config: Record<string, any>;
  }>;
  output: {
    format: 'json' | 'csv' | 'parquet';
    destination: 'storage' | 'webhook' | 'stream';
    schedule?: string; // cron expression
  };
  isActive: boolean;
  lastRun?: Date;
  nextRun?: Date;
  metrics: {
    totalRuns: number;
    successfulRuns: number;
    failedRuns: number;
    averageExecutionTime: number;
    lastExecutionTime: number;
  };
}