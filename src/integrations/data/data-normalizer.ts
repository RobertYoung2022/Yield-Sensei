/**
 * Data Normalizer
 * Normalizes and transforms data from various institutional data providers into standardized formats
 */

import { EventEmitter } from 'events';
import Logger from '@/shared/logging/logger';
import {
  DataProvider,
  DataNormalizationConfig,
  NormalizedData,
  PriceData,
  ProtocolData,
  YieldData,
  TokenData,
  NFTData,
  OnChainMetrics
} from './types';

const logger = Logger.getLogger('data-normalizer');

export class DataNormalizer extends EventEmitter {
  private config: DataNormalizationConfig;

  constructor(config: DataNormalizationConfig) {
    super();
    this.config = {
      enableNormalization: true,
      outputFormat: 'json',
      timestampFormat: 'unix',
      numberPrecision: 8,
      currencyConversion: {
        enabled: false,
        baseCurrency: 'USD',
        exchangeRates: {}
      },
      fieldMapping: {},
      dataValidation: {
        enabled: true,
        strictMode: false,
        requiredFields: []
      },
      ...config
    };
  }

  /**
   * Normalize price data from any provider
   */
  normalizePriceData(
    data: any, 
    provider: DataProvider, 
    originalFormat: string = 'json'
  ): NormalizedData {
    try {
      let normalizedData: PriceData[];

      switch (provider) {
        case 'coingecko':
          normalizedData = this.normalizeCoinGeckoPriceData(data);
          break;
        case 'moralis':
          normalizedData = this.normalizeMoralisPriceData(data);
          break;
        default:
          normalizedData = Array.isArray(data) ? data : [data];
      }

      return this.createNormalizedData(
        normalizedData,
        provider,
        'price_data',
        originalFormat
      );
    } catch (error) {
      logger.error('Failed to normalize price data:', error);
      throw error;
    }
  }

  /**
   * Normalize protocol data from DeFi providers
   */
  normalizeProtocolData(
    data: any,
    provider: DataProvider,
    originalFormat: string = 'json'
  ): NormalizedData {
    try {
      let normalizedData: ProtocolData[];

      switch (provider) {
        case 'defillama':
          normalizedData = this.normalizeDefiLlamaProtocolData(data);
          break;
        default:
          normalizedData = Array.isArray(data) ? data : [data];
      }

      return this.createNormalizedData(
        normalizedData,
        provider,
        'protocol_data',
        originalFormat
      );
    } catch (error) {
      logger.error('Failed to normalize protocol data:', error);
      throw error;
    }
  }

  /**
   * Normalize yield farming data
   */
  normalizeYieldData(
    data: any,
    provider: DataProvider,
    originalFormat: string = 'json'
  ): NormalizedData {
    try {
      let normalizedData: YieldData[];

      switch (provider) {
        case 'defillama':
          normalizedData = this.normalizeDefiLlamaYieldData(data);
          break;
        default:
          normalizedData = Array.isArray(data) ? data : [data];
      }

      return this.createNormalizedData(
        normalizedData,
        provider,
        'yield_data',
        originalFormat
      );
    } catch (error) {
      logger.error('Failed to normalize yield data:', error);
      throw error;
    }
  }

  /**
   * Normalize token data from blockchain providers
   */
  normalizeTokenData(
    data: any,
    provider: DataProvider,
    originalFormat: string = 'json'
  ): NormalizedData {
    try {
      let normalizedData: TokenData[];

      switch (provider) {
        case 'moralis':
          normalizedData = this.normalizeMoralisTokenData(data);
          break;
        default:
          normalizedData = Array.isArray(data) ? data : [data];
      }

      return this.createNormalizedData(
        normalizedData,
        provider,
        'token_data',
        originalFormat
      );
    } catch (error) {
      logger.error('Failed to normalize token data:', error);
      throw error;
    }
  }

  /**
   * Normalize on-chain metrics from analytics providers
   */
  normalizeOnChainMetrics(
    data: any,
    provider: DataProvider,
    originalFormat: string = 'json'
  ): NormalizedData {
    try {
      let normalizedData: OnChainMetrics[];

      switch (provider) {
        case 'dune':
          normalizedData = this.normalizeDuneAnalyticsData(data);
          break;
        default:
          normalizedData = Array.isArray(data) ? data : [data];
      }

      return this.createNormalizedData(
        normalizedData,
        provider,
        'onchain_metrics',
        originalFormat
      );
    } catch (error) {
      logger.error('Failed to normalize on-chain metrics:', error);
      throw error;
    }
  }

  /**
   * Apply field mappings to normalize field names
   */
  applyFieldMappings(data: any): any {
    if (!this.config.fieldMapping || Object.keys(this.config.fieldMapping).length === 0) {
      return data;
    }

    if (Array.isArray(data)) {
      return data.map(item => this.applyFieldMappings(item));
    }

    if (typeof data === 'object' && data !== null) {
      const mappedData: any = {};
      
      for (const [key, value] of Object.entries(data)) {
        const mappedKey = this.config.fieldMapping[key] || key;
        mappedData[mappedKey] = this.applyFieldMappings(value);
      }
      
      return mappedData;
    }

    return data;
  }

  /**
   * Convert timestamps to specified format
   */
  normalizeTimestamp(timestamp: any): number | string {
    let unixTimestamp: number;

    if (typeof timestamp === 'string') {
      unixTimestamp = new Date(timestamp).getTime();
    } else if (typeof timestamp === 'number') {
      // Assume it's already a Unix timestamp
      unixTimestamp = timestamp > 1e10 ? timestamp : timestamp * 1000;
    } else {
      unixTimestamp = Date.now();
    }

    switch (this.config.timestampFormat) {
      case 'unix':
        return Math.floor(unixTimestamp / 1000);
      case 'iso':
        return new Date(unixTimestamp).toISOString();
      case 'human':
        return new Date(unixTimestamp).toLocaleString();
      default:
        return unixTimestamp;
    }
  }

  /**
   * Normalize numeric values with precision
   */
  normalizeNumber(value: any): number {
    const num = parseFloat(value);
    if (isNaN(num)) {
      return 0;
    }
    return parseFloat(num.toFixed(this.config.numberPrecision));
  }

  /**
   * Apply currency conversion if enabled
   */
  applyCurrencyConversion(value: number, fromCurrency: string = 'USD'): number {
    if (!this.config.currencyConversion.enabled) {
      return value;
    }

    const baseCurrency = this.config.currencyConversion.baseCurrency;
    if (fromCurrency === baseCurrency) {
      return value;
    }

    const exchangeRate = this.config.currencyConversion.exchangeRates[fromCurrency];
    if (!exchangeRate) {
      logger.warn(`Exchange rate not found for ${fromCurrency}`);
      return value;
    }

    return value * exchangeRate;
  }

  /**
   * Validate data according to validation rules
   */
  validateData(data: any, dataType: string): boolean {
    if (!this.config.dataValidation.enabled) {
      return true;
    }

    try {
      // Check required fields
      if (this.config.dataValidation.requiredFields.length > 0) {
        for (const field of this.config.dataValidation.requiredFields) {
          if (!(field in data)) {
            if (this.config.dataValidation.strictMode) {
              throw new Error(`Required field missing: ${field}`);
            }
            logger.warn(`Required field missing: ${field}`);
            return false;
          }
        }
      }

      // Type-specific validation
      switch (dataType) {
        case 'price_data':
          return this.validatePriceData(data);
        case 'protocol_data':
          return this.validateProtocolData(data);
        case 'yield_data':
          return this.validateYieldData(data);
        default:
          return true;
      }
    } catch (error) {
      logger.error('Data validation failed:', error);
      return false;
    }
  }

  // Provider-specific normalization methods

  private normalizeCoinGeckoPriceData(data: any): PriceData[] {
    if (!Array.isArray(data)) {
      data = [data];
    }

    return data.map((item: any) => ({
      id: item.id || '',
      symbol: item.symbol || '',
      name: item.name || '',
      current_price: this.normalizeNumber(item.current_price || 0),
      market_cap: this.normalizeNumber(item.market_cap || 0),
      market_cap_rank: parseInt(item.market_cap_rank || 0),
      fully_diluted_valuation: this.normalizeNumber(item.fully_diluted_valuation || 0),
      total_volume: this.normalizeNumber(item.total_volume || 0),
      high_24h: this.normalizeNumber(item.high_24h || 0),
      low_24h: this.normalizeNumber(item.low_24h || 0),
      price_change_24h: this.normalizeNumber(item.price_change_24h || 0),
      price_change_percentage_24h: this.normalizeNumber(item.price_change_percentage_24h || 0),
      price_change_percentage_7d: this.normalizeNumber(item.price_change_percentage_7d || 0),
      price_change_percentage_30d: this.normalizeNumber(item.price_change_percentage_30d || 0),
      market_cap_change_24h: this.normalizeNumber(item.market_cap_change_24h || 0),
      market_cap_change_percentage_24h: this.normalizeNumber(item.market_cap_change_percentage_24h || 0),
      circulating_supply: this.normalizeNumber(item.circulating_supply || 0),
      total_supply: this.normalizeNumber(item.total_supply || 0),
      max_supply: this.normalizeNumber(item.max_supply || 0),
      ath: this.normalizeNumber(item.ath || 0),
      ath_change_percentage: this.normalizeNumber(item.ath_change_percentage || 0),
      ath_date: item.ath_date || '',
      atl: this.normalizeNumber(item.atl || 0),
      atl_change_percentage: this.normalizeNumber(item.atl_change_percentage || 0),
      atl_date: item.atl_date || '',
      last_updated: item.last_updated || new Date().toISOString()
    }));
  }

  private normalizeMoralisPriceData(data: any): PriceData[] {
    // Moralis doesn't directly provide price data in the same format
    // This would need to be adapted based on actual Moralis price response
    return Array.isArray(data) ? data : [data];
  }

  private normalizeDefiLlamaProtocolData(data: any): ProtocolData[] {
    if (!Array.isArray(data)) {
      data = [data];
    }

    return data.map((item: any) => ({
      id: item.id || '',
      name: item.name || '',
      symbol: item.symbol || '',
      slug: item.slug || '',
      tvl: this.normalizeNumber(item.tvl || 0),
      tvlPrevDay: this.normalizeNumber(item.tvlPrevDay || 0),
      tvlPrevWeek: this.normalizeNumber(item.tvlPrevWeek || 0),
      tvlPrevMonth: this.normalizeNumber(item.tvlPrevMonth || 0),
      chains: Array.isArray(item.chains) ? item.chains : [],
      category: item.category || '',
      logo: item.logo || '',
      url: item.url || '',
      description: item.description || '',
      twitter: item.twitter || '',
      forkedFrom: Array.isArray(item.forkedFrom) ? item.forkedFrom : [],
      gecko_id: item.gecko_id || '',
      cmcId: item.cmcId || '',
      audit: Array.isArray(item.audit) ? item.audit : [],
      methodology: item.methodology || '',
      parentProtocol: item.parentProtocol || '',
      module: item.module || ''
    }));
  }

  private normalizeDefiLlamaYieldData(data: any): YieldData[] {
    if (!Array.isArray(data)) {
      data = [data];
    }

    return data.map((item: any) => ({
      pool: item.pool || '',
      chain: item.chain || '',
      project: item.project || '',
      symbol: item.symbol || '',
      tvlUsd: this.normalizeNumber(item.tvlUsd || 0),
      apy: this.normalizeNumber(item.apy || 0),
      apyBase: this.normalizeNumber(item.apyBase || 0),
      apyReward: this.normalizeNumber(item.apyReward || 0),
      rewardTokens: Array.isArray(item.rewardTokens) ? item.rewardTokens : [],
      il7d: this.normalizeNumber(item.il7d || 0),
      apyBase7d: this.normalizeNumber(item.apyBase7d || 0),
      apyMean30d: this.normalizeNumber(item.apyMean30d || 0),
      volumeUsd1d: this.normalizeNumber(item.volumeUsd1d || 0),
      volumeUsd7d: this.normalizeNumber(item.volumeUsd7d || 0),
      apyBaseInception: this.normalizeNumber(item.apyBaseInception || 0),
      underlyingTokens: Array.isArray(item.underlyingTokens) ? item.underlyingTokens : [],
      poolMeta: item.poolMeta || '',
      url: item.url || '',
      category: item.category || '',
      exposure: item.exposure || '',
      predictions: item.predictions || null
    }));
  }

  private normalizeMoralisTokenData(data: any): TokenData[] {
    if (!Array.isArray(data)) {
      data = [data];
    }

    return data.map((item: any) => ({
      address: item.address || item.token_address || '',
      symbol: item.symbol || '',
      name: item.name || '',
      decimals: parseInt(item.decimals || 18),
      logo: item.logo || '',
      thumbnail: item.thumbnail || '',
      balance: item.balance || '0',
      possible_spam: Boolean(item.possible_spam),
      verified_contract: Boolean(item.verified_contract),
      total_supply: item.total_supply || '',
      total_supply_formatted: item.total_supply_formatted || '',
      percentage_relative_to_total_supply: this.normalizeNumber(item.percentage_relative_to_total_supply || 0)
    }));
  }

  private normalizeDuneAnalyticsData(data: any): OnChainMetrics[] {
    // This would need to be customized based on the specific Dune query results
    // For now, return a generic structure
    const rows = data.result?.rows || [];
    
    return rows.map((row: any) => ({
      protocol: row.protocol || 'unknown',
      chain: row.chain || 'ethereum',
      timestamp: this.normalizeTimestamp(row.timestamp || row.date || Date.now()) as number,
      activeUsers: parseInt(row.active_users || row.users || 0),
      transactions: parseInt(row.transactions || row.tx_count || 0),
      volume: this.normalizeNumber(row.volume || row.volume_usd || 0),
      fees: this.normalizeNumber(row.fees || row.fees_usd || 0),
      revenue: this.normalizeNumber(row.revenue || row.revenue_usd || 0),
      uniqueAddresses: parseInt(row.unique_addresses || 0),
      newAddresses: parseInt(row.new_addresses || 0),
      returningAddresses: parseInt(row.returning_addresses || 0)
    }));
  }

  private validatePriceData(data: PriceData): boolean {
    return Boolean(
      data.id &&
      data.symbol &&
      data.name &&
      typeof data.current_price === 'number' &&
      data.current_price >= 0
    );
  }

  private validateProtocolData(data: ProtocolData): boolean {
    return Boolean(
      data.id &&
      data.name &&
      data.slug &&
      typeof data.tvl === 'number' &&
      data.tvl >= 0 &&
      Array.isArray(data.chains)
    );
  }

  private validateYieldData(data: YieldData): boolean {
    return Boolean(
      data.pool &&
      data.chain &&
      data.project &&
      typeof data.tvlUsd === 'number' &&
      typeof data.apy === 'number' &&
      data.tvlUsd >= 0 &&
      data.apy >= 0
    );
  }

  private createNormalizedData(
    data: any,
    provider: DataProvider,
    dataType: string,
    originalFormat: string
  ): NormalizedData {
    // Apply field mappings
    const mappedData = this.applyFieldMappings(data);

    // Validate if enabled
    if (this.config.dataValidation.enabled && Array.isArray(mappedData)) {
      mappedData.forEach((item, index) => {
        if (!this.validateData(item, dataType)) {
          if (this.config.dataValidation.strictMode) {
            throw new Error(`Data validation failed for item at index ${index}`);
          }
          logger.warn(`Data validation failed for item at index ${index}`);
        }
      });
    }

    const normalizedData: NormalizedData = {
      provider,
      dataType,
      timestamp: this.normalizeTimestamp(Date.now()) as number,
      data: mappedData,
      metadata: {
        originalFormat,
        normalizedAt: Date.now(),
        version: '1.0.0',
        fields: this.extractFields(mappedData),
        recordCount: Array.isArray(mappedData) ? mappedData.length : 1
      }
    };

    this.emit('data_normalized', normalizedData);
    return normalizedData;
  }

  private extractFields(data: any): string[] {
    if (Array.isArray(data) && data.length > 0) {
      return Object.keys(data[0]);
    } else if (typeof data === 'object' && data !== null) {
      return Object.keys(data);
    }
    return [];
  }
}