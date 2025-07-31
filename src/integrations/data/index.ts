/**
 * Data Integration Index
 * Exports all data provider clients and utilities for institutional data feeds
 */

// Type definitions
export * from './types';

// Data provider clients
export { CoinGeckoClient } from './coingecko-client';
export { DefiLlamaClient } from './defillama-client';
export { DuneClient } from './dune-client';
export { MoralisClient } from './moralis-client';

// Data normalization utilities
export { DataNormalizer } from './data-normalizer';

// Re-export common types for convenience
export type {
  DataProvider,
  DataProviderClient,
  DataProviderConfig,
  DataResponse,
  PriceData,
  ProtocolData,
  YieldData,
  TokenData,
  NFTData,
  OnChainMetrics,
  DuneQuery,
  DuneResult,
  HistoricalPrice,
  RateLimitStatus,
  DataProviderError,
  CacheEntry,
  NormalizedData,
  DataNormalizationConfig
} from './types';