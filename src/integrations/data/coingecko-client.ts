/**
 * CoinGecko Pro API Client
 * Provides integration with CoinGecko's professional-grade cryptocurrency data API
 */

import axios, { AxiosInstance } from 'axios';
import { EventEmitter } from 'events';
import Logger from '@/shared/logging/logger';
import {
  DataProviderClient,
  DataProviderConfig,
  DataResponse,
  PriceData,
  HistoricalPrice,
  RateLimitStatus,
  DataProviderError,
  CacheEntry
} from './types';

const logger = Logger.getLogger('coingecko-client');

interface CoinGeckoSearchResult {
  id: string;
  name: string;
  symbol: string;
  market_cap_rank: number;
  thumb: string;
  large: string;
}

interface CoinGeckoMarketData {
  current_price: Record<string, number>;
  market_cap: Record<string, number>;
  total_volume: Record<string, number>;
  high_24h: Record<string, number>;
  low_24h: Record<string, number>;
  price_change_24h: number;
  price_change_percentage_24h: number;
  price_change_percentage_7d: number;
  price_change_percentage_14d: number;
  price_change_percentage_30d: number;
  price_change_percentage_60d: number;
  price_change_percentage_200d: number;
  price_change_percentage_1y: number;
  market_cap_change_24h: number;
  market_cap_change_percentage_24h: number;
  total_supply: number;
  max_supply: number;
  circulating_supply: number;
  last_updated: string;
}

interface CoinGeckoDetailedCoin {
  id: string;
  symbol: string;
  name: string;
  description: { en: string };
  links: {
    homepage: string[];
    blockchain_site: string[];
    official_forum_url: string[];
    chat_url: string[];
    announcement_url: string[];
    twitter_screen_name: string;
    facebook_username: string;
    bitcointalk_thread_identifier: number;
    telegram_channel_identifier: string;
    subreddit_url: string;
    repos_url: {
      github: string[];
      bitbucket: string[];
    };
  };
  image: {
    thumb: string;
    small: string;
    large: string;
  };
  country_origin: string;
  genesis_date: string;
  market_cap_rank: number;
  coingecko_rank: number;
  coingecko_score: number;
  developer_score: number;
  community_score: number;
  liquidity_score: number;
  public_interest_score: number;
  market_data: CoinGeckoMarketData;
  community_data: {
    facebook_likes: number;
    twitter_followers: number;
    reddit_average_posts_48h: number;
    reddit_average_comments_48h: number;
    reddit_subscribers: number;
    reddit_accounts_active_48h: number;
    telegram_channel_user_count: number;
  };
  developer_data: {
    forks: number;
    stars: number;
    subscribers: number;
    total_issues: number;
    closed_issues: number;
    pull_requests_merged: number;
    pull_request_contributors: number;
    code_additions_deletions_4_weeks: {
      additions: number;
      deletions: number;
    };
    commit_count_4_weeks: number;
    last_4_weeks_commit_activity_series: number[];
  };
  public_interest_stats: {
    alexa_rank: number;
    bing_matches: number;
  };
  status_updates: any[];
  last_updated: string;
}

export class CoinGeckoClient extends EventEmitter implements DataProviderClient {
  public readonly provider = 'coingecko' as const;
  public readonly config: DataProviderConfig;
  
  private client: AxiosInstance;
  private rateLimitStatus: RateLimitStatus;
  private cache: Map<string, CacheEntry<any>> = new Map();
  private isInitialized = false;

  constructor(config: DataProviderConfig) {
    super();
    this.config = {
      baseUrl: 'https://pro-api.coingecko.com/api/v3',
      rateLimitRpm: 500, // Pro API limit
      timeout: 10000,
      retries: 3,
      enableCaching: true,
      cacheTTL: 60000, // 1 minute default
      ...config
    };

    this.client = axios.create({
      baseURL: this.config.baseUrl,
      timeout: this.config.timeout,
      headers: {
        'Content-Type': 'application/json',
        'x-cg-pro-api-key': this.config.apiKey
      }
    });

    this.rateLimitStatus = {
      remaining: this.config.rateLimitRpm || 500,
      reset: new Date(Date.now() + 60000),
      limit: this.config.rateLimitRpm || 500,
      resetInSeconds: 60
    };

    this.setupInterceptors();
  }

  async initialize(): Promise<void> {
    try {
      logger.info('Initializing CoinGecko client...');
      
      // Test API key with a simple request
      const response = await this.client.get('/ping');
      if (response.data.gecko_says !== '(V3) To the Moon!') {
        throw new Error('Invalid API response from CoinGecko');
      }

      this.isInitialized = true;
      logger.info('CoinGecko client initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize CoinGecko client:', error);
      throw error;
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.client.get('/ping');
      return response.data.gecko_says === '(V3) To the Moon!';
    } catch (error) {
      logger.warn('CoinGecko health check failed:', error);
      return false;
    }
  }

  async getRateLimitStatus(): Promise<RateLimitStatus> {
    return this.rateLimitStatus;
  }

  async getCurrentPrices(
    coins: string[], 
    vs_currencies: string[] = ['usd']
  ): Promise<DataResponse<Record<string, Record<string, number>>>> {
    try {
      const cacheKey = `prices:${coins.join(',')}:${vs_currencies.join(',')}`;
      const cached = this.getFromCache<Record<string, Record<string, number>>>(cacheKey);
      if (cached) {
        return {
          success: true,
          data: cached,
          metadata: {
            provider: this.provider,
            timestamp: Date.now(),
            cached: true
          }
        };
      }

      const params = {
        ids: coins.join(','),
        vs_currencies: vs_currencies.join(','),
        include_market_cap: true,
        include_24hr_vol: true,
        include_24hr_change: true,
        include_last_updated_at: true
      };

      const response = await this.client.get('/simple/price', { params });
      const data = response.data;

      this.setCache(cacheKey, data, this.config.cacheTTL || 60000);

      return {
        success: true,
        data,
        metadata: {
          provider: this.provider,
          timestamp: Date.now(),
          rateLimitRemaining: this.rateLimitStatus.remaining
        }
      };
    } catch (error) {
      return this.handleError('getCurrentPrices', error);
    }
  }

  async getHistoricalPrices(
    coin: string, 
    days: number, 
    vs_currency: string = 'usd'
  ): Promise<DataResponse<HistoricalPrice[]>> {
    try {
      const cacheKey = `history:${coin}:${days}:${vs_currency}`;
      const cached = this.getFromCache<HistoricalPrice[]>(cacheKey);
      if (cached) {
        return {
          success: true,
          data: cached,
          metadata: {
            provider: this.provider,
            timestamp: Date.now(),
            cached: true
          }
        };
      }

      const params = {
        vs_currency,
        days: days.toString(),
        interval: days > 90 ? 'daily' : days > 1 ? 'hourly' : undefined
      };

      const response = await this.client.get(`/coins/${coin}/market_chart`, { params });
      const data = response.data;

      // Transform data to our format
      const prices: HistoricalPrice[] = data.prices.map((point: [number, number], index: number) => ({
        timestamp: point[0],
        price: point[1],
        market_cap: data.market_caps?.[index]?.[1],
        total_volume: data.total_volumes?.[index]?.[1]
      }));

      this.setCache(cacheKey, prices, this.config.cacheTTL || 300000); // Cache for 5 minutes

      return {
        success: true,
        data: prices,
        metadata: {
          provider: this.provider,
          timestamp: Date.now(),
          rateLimitRemaining: this.rateLimitStatus.remaining
        }
      };
    } catch (error) {
      return this.handleError('getHistoricalPrices', error);
    }
  }

  async getCoinDetails(coin: string): Promise<DataResponse<PriceData>> {
    try {
      const cacheKey = `details:${coin}`;
      const cached = this.getFromCache<PriceData>(cacheKey);
      if (cached) {
        return {
          success: true,
          data: cached,
          metadata: {
            provider: this.provider,
            timestamp: Date.now(),
            cached: true
          }
        };
      }

      const params = {
        localization: false,
        tickers: false,
        market_data: true,
        community_data: false,
        developer_data: false,
        sparkline: false
      };

      const response = await this.client.get(`/coins/${coin}`, { params });
      const coinData: CoinGeckoDetailedCoin = response.data;

      // Transform to our PriceData format
      const priceData: PriceData = {
        id: coinData.id,
        symbol: coinData.symbol,
        name: coinData.name,
        current_price: coinData.market_data.current_price.usd || 0,
        market_cap: coinData.market_data.market_cap.usd || 0,
        market_cap_rank: coinData.market_cap_rank || 0,
        fully_diluted_valuation: coinData.market_data.market_cap.usd || 0,
        total_volume: coinData.market_data.total_volume.usd || 0,
        high_24h: coinData.market_data.high_24h.usd || 0,
        low_24h: coinData.market_data.low_24h.usd || 0,
        price_change_24h: coinData.market_data.price_change_24h || 0,
        price_change_percentage_24h: coinData.market_data.price_change_percentage_24h || 0,
        price_change_percentage_7d: coinData.market_data.price_change_percentage_7d || 0,
        price_change_percentage_30d: coinData.market_data.price_change_percentage_30d || 0,
        market_cap_change_24h: coinData.market_data.market_cap_change_24h || 0,
        market_cap_change_percentage_24h: coinData.market_data.market_cap_change_percentage_24h || 0,
        circulating_supply: coinData.market_data.circulating_supply || 0,
        total_supply: coinData.market_data.total_supply || 0,
        max_supply: coinData.market_data.max_supply || 0,
        ath: coinData.market_data.current_price.usd || 0, // Simplified
        ath_change_percentage: 0, // Would need ATH data
        ath_date: coinData.genesis_date || new Date().toISOString(),
        atl: coinData.market_data.current_price.usd || 0, // Simplified  
        atl_change_percentage: 0, // Would need ATL data
        atl_date: coinData.genesis_date || new Date().toISOString(),
        last_updated: coinData.last_updated
      };

      this.setCache(cacheKey, priceData, this.config.cacheTTL || 300000);

      return {
        success: true,
        data: priceData,
        metadata: {
          provider: this.provider,
          timestamp: Date.now(),
          rateLimitRemaining: this.rateLimitStatus.remaining
        }
      };
    } catch (error) {
      return this.handleError('getCoinDetails', error);
    }
  }

  async searchCoins(query: string): Promise<DataResponse<CoinGeckoSearchResult[]>> {
    try {
      const cacheKey = `search:${query}`;
      const cached = this.getFromCache<CoinGeckoSearchResult[]>(cacheKey);
      if (cached) {
        return {
          success: true,
          data: cached,
          metadata: {
            provider: this.provider,
            timestamp: Date.now(),
            cached: true
          }
        };
      }

      const response = await this.client.get('/search', {
        params: { query }
      });

      const coins: CoinGeckoSearchResult[] = response.data.coins || [];

      this.setCache(cacheKey, coins, this.config.cacheTTL || 300000);

      return {
        success: true,
        data: coins,
        metadata: {
          provider: this.provider,
          timestamp: Date.now(),
          rateLimitRemaining: this.rateLimitStatus.remaining
        }
      };
    } catch (error) {
      return this.handleError('searchCoins', error);
    }
  }

  async getTopCoins(limit: number = 100, vs_currency: string = 'usd'): Promise<DataResponse<PriceData[]>> {
    try {
      const cacheKey = `top:${limit}:${vs_currency}`;
      const cached = this.getFromCache<PriceData[]>(cacheKey);
      if (cached) {
        return {
          success: true,
          data: cached,
          metadata: {
            provider: this.provider,
            timestamp: Date.now(),
            cached: true
          }
        };
      }

      const params = {
        vs_currency,
        order: 'market_cap_desc',
        per_page: Math.min(limit, 250).toString(),
        page: '1',
        sparkline: false,
        price_change_percentage: '1h,24h,7d,14d,30d,200d,1y'
      };

      const response = await this.client.get('/coins/markets', { params });
      const coins: PriceData[] = response.data;

      this.setCache(cacheKey, coins, this.config.cacheTTL || 60000);

      return {
        success: true,
        data: coins,
        metadata: {
          provider: this.provider,
          timestamp: Date.now(),
          rateLimitRemaining: this.rateLimitStatus.remaining
        }
      };
    } catch (error) {
      return this.handleError('getTopCoins', error);
    }
  }

  async getTrendingCoins(): Promise<DataResponse<any[]>> {
    try {
      const cacheKey = 'trending';
      const cached = this.getFromCache<any[]>(cacheKey);
      if (cached) {
        return {
          success: true,
          data: cached,
          metadata: {
            provider: this.provider,
            timestamp: Date.now(),
            cached: true
          }
        };
      }

      const response = await this.client.get('/search/trending');
      const trending = response.data.coins || [];

      this.setCache(cacheKey, trending, this.config.cacheTTL || 300000); // Cache for 5 minutes

      return {
        success: true,
        data: trending,
        metadata: {
          provider: this.provider,
          timestamp: Date.now(),
          rateLimitRemaining: this.rateLimitStatus.remaining
        }
      };
    } catch (error) {
      return this.handleError('getTrendingCoins', error);
    }
  }

  async getGlobalData(): Promise<DataResponse<any>> {
    try {
      const cacheKey = 'global';
      const cached = this.getFromCache<any>(cacheKey);
      if (cached) {
        return {
          success: true,
          data: cached,
          metadata: {
            provider: this.provider,
            timestamp: Date.now(),
            cached: true
          }
        };
      }

      const response = await this.client.get('/global');
      const global = response.data.data;

      this.setCache(cacheKey, global, this.config.cacheTTL || 300000);

      return {
        success: true,
        data: global,
        metadata: {
          provider: this.provider,
          timestamp: Date.now(),
          rateLimitRemaining: this.rateLimitStatus.remaining
        }
      };
    } catch (error) {
      return this.handleError('getGlobalData', error);
    }
  }

  private getFromCache<T>(key: string): T | null {
    if (!this.config.enableCaching) {
      return null;
    }

    const entry = this.cache.get(key);
    if (!entry) {
      return null;
    }

    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  private setCache<T>(key: string, data: T, ttl: number): void {
    if (!this.config.enableCaching) {
      return;
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });

    // Clean up old entries periodically
    if (this.cache.size > 1000) {
      const now = Date.now();
      for (const [k, entry] of this.cache.entries()) {
        if (now - entry.timestamp > entry.ttl) {
          this.cache.delete(k);
        }
      }
    }
  }

  private handleError(operation: string, error: any): DataResponse<any> {
    logger.error(`CoinGecko ${operation} failed:`, error);

    const dataError: DataProviderError = new Error(
      error?.response?.data?.error || error?.message || 'Unknown CoinGecko API error'
    ) as DataProviderError;

    dataError.provider = this.provider;
    dataError.code = error?.response?.data?.error_code || error?.code;
    dataError.rateLimited = error?.response?.status === 429;
    dataError.retryable = error?.response?.status >= 500 || error?.response?.status === 429;

    if (dataError.rateLimited && error?.response?.headers) {
      const retryAfter = error.response.headers['retry-after'];
      dataError.retryAfter = retryAfter ? parseInt(retryAfter) : 60;
    }

    return {
      success: false,
      error: dataError.message,
      metadata: {
        provider: this.provider,
        timestamp: Date.now()
      }
    };
  }

  private setupInterceptors(): void {
    // Request interceptor
    this.client.interceptors.request.use(
      (config) => {
        logger.debug('CoinGecko API request', {
          method: config.method,
          url: config.url,
          params: config.params
        });
        return config;
      },
      (error) => {
        logger.error('CoinGecko API request error:', error);
        return Promise.reject(error);
      }
    );

    // Response interceptor for rate limit tracking
    this.client.interceptors.response.use(
      (response) => {
        // Update rate limit status from headers
        const headers = response.headers;
        if (headers['x-ratelimit-remaining'] && headers['x-ratelimit-reset']) {
          this.rateLimitStatus = {
            remaining: parseInt(headers['x-ratelimit-remaining']),
            reset: new Date(parseInt(headers['x-ratelimit-reset']) * 1000),
            limit: parseInt(headers['x-ratelimit-limit'] || this.config.rateLimitRpm?.toString() || '500'),
            resetInSeconds: parseInt(headers['x-ratelimit-reset']) - Math.floor(Date.now() / 1000)
          };
        }

        logger.debug('CoinGecko API response', {
          status: response.status,
          rateLimitRemaining: headers['x-ratelimit-remaining']
        });
        return response;
      },
      (error) => {
        logger.error('CoinGecko API response error:', {
          status: error.response?.status,
          message: error.response?.data?.error || error.message
        });
        return Promise.reject(error);
      }
    );
  }
}