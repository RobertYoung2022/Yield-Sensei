/**
 * Moralis API Client
 * Provides integration with Moralis for real-time blockchain data across multiple chains
 */

import axios, { AxiosInstance } from 'axios';
import { EventEmitter } from 'events';
import Logger from '@/shared/logging/logger';
import {
  DataProviderClient,
  DataProviderConfig,
  DataResponse,
  TokenData,
  NFTData,
  RateLimitStatus,
  DataProviderError,
  CacheEntry
} from './types';

const logger = Logger.getLogger('moralis-client');

interface MoralisBalance {
  token_address: string;
  name: string;
  symbol: string;
  logo?: string;
  thumbnail?: string;
  decimals: number;
  balance: string;
  possible_spam: boolean;
  verified_contract: boolean;
  total_supply?: string;
  total_supply_formatted?: string;
  percentage_relative_to_total_supply?: number;
}

interface MoralisNFT {
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

interface MoralisTransaction {
  hash: string;
  nonce: string;
  transaction_index: string;
  from_address: string;
  to_address?: string;
  value: string;
  gas: string;
  gas_price: string;
  input: string;
  receipt_cumulative_gas_used: string;
  receipt_gas_used: string;
  receipt_contract_address?: string;
  receipt_root?: string;
  receipt_status: string;
  block_timestamp: string;
  block_number: string;
  block_hash: string;
  logs?: any[];
}

interface MoralisTokenMetadata {
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  logo: string;
  logo_hash: string;
  thumbnail: string;
  block_number?: string;
  validated?: number;
  created_at: string;
  possible_spam: boolean;
  verified_contract: boolean;
}

interface MoralisChainData {
  chain: string;
  name: string;
  chain_id: string;
  rpc_url: string;
  native_token: {
    name: string;
    symbol: string;
    decimals: number;
  };
}

export class MoralisClient extends EventEmitter implements DataProviderClient {
  public readonly provider = 'moralis' as const;
  public readonly config: DataProviderConfig;
  
  private client: AxiosInstance;
  private rateLimitStatus: RateLimitStatus;
  private cache: Map<string, CacheEntry<any>> = new Map();
  private isInitialized = false;

  // Supported chains mapping
  private readonly chainMap: Record<string, string> = {
    'ethereum': '0x1',
    'polygon': '0x89',
    'bsc': '0x38',
    'avalanche': '0xa86a',
    'fantom': '0xfa',
    'cronos': '0x19',
    'arbitrum': '0xa4b1',
    'palm': '0x2a15c308d',
    'sepolia': '0xaa36a7'
  };

  constructor(config: DataProviderConfig) {
    super();
    this.config = {
      baseUrl: 'https://deep-index.moralis.io/api/v2.2',
      rateLimitRpm: 1500, // Moralis free tier rate limit
      timeout: 15000,
      retries: 3,
      enableCaching: true,
      cacheTTL: 300000, // 5 minutes default
      ...config
    };

    if (!this.config.apiKey) {
      throw new Error('Moralis API key is required');
    }

    this.client = axios.create({
      baseURL: this.config.baseUrl,
      timeout: this.config.timeout,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.config.apiKey
      }
    });

    this.rateLimitStatus = {
      remaining: this.config.rateLimitRpm || 1500,
      reset: new Date(Date.now() + 60000),
      limit: this.config.rateLimitRpm || 1500,
      resetInSeconds: 60
    };

    this.setupInterceptors();
  }

  async initialize(): Promise<void> {
    try {
      logger.info('Initializing Moralis client...');
      
      // Test API key with a simple request
      const response = await this.client.get('/block/1/date', {
        params: { chain: '0x1' }
      });
      
      if (response.status !== 200) {
        throw new Error('Invalid API response from Moralis');
      }

      this.isInitialized = true;
      logger.info('Moralis client initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Moralis client:', error);
      throw error;
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.client.get('/block/1/date', {
        params: { chain: '0x1' }
      });
      return response.status === 200;
    } catch (error) {
      logger.warn('Moralis health check failed:', error);
      return false;
    }
  }

  async getRateLimitStatus(): Promise<RateLimitStatus> {
    return this.rateLimitStatus;
  }

  async getTokenBalances(address: string, chain: string): Promise<DataResponse<TokenData[]>> {
    try {
      const chainId = this.getChainId(chain);
      const cacheKey = `balances:${address}:${chainId}`;
      const cached = this.getFromCache<TokenData[]>(cacheKey);
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

      const response = await this.client.get(`/${address}/erc20`, {
        params: { 
          chain: chainId,
          exclude_spam: true,
          exclude_unverified_contracts: false
        }
      });

      const balances: MoralisBalance[] = response.data || [];

      // Transform to our TokenData format
      const tokenData: TokenData[] = balances.map(balance => ({
        address: balance.token_address,
        symbol: balance.symbol,
        name: balance.name,
        decimals: balance.decimals,
        logo: balance.logo,
        thumbnail: balance.thumbnail,
        balance: balance.balance,
        possible_spam: balance.possible_spam,
        verified_contract: balance.verified_contract,
        total_supply: balance.total_supply,
        total_supply_formatted: balance.total_supply_formatted,
        percentage_relative_to_total_supply: balance.percentage_relative_to_total_supply
      }));

      this.setCache(cacheKey, tokenData, this.config.cacheTTL || 300000);

      return {
        success: true,
        data: tokenData,
        metadata: {
          provider: this.provider,
          timestamp: Date.now(),
          rateLimitRemaining: this.rateLimitStatus.remaining
        }
      };
    } catch (error) {
      return this.handleError('getTokenBalances', error);
    }
  }

  async getTokenMetadata(addresses: string[], chain: string): Promise<DataResponse<TokenData[]>> {
    try {
      const chainId = this.getChainId(chain);
      const cacheKey = `metadata:${addresses.join(',')}:${chainId}`;
      const cached = this.getFromCache<TokenData[]>(cacheKey);
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

      // Moralis doesn't have batch metadata endpoint, so we'll get them individually
      const metadataPromises = addresses.map(async (address) => {
        try {
          const response = await this.client.get(`/erc20/metadata`, {
            params: {
              chain: chainId,
              addresses: address
            }
          });
          return response.data[0] as MoralisTokenMetadata;
        } catch (error) {
          logger.warn(`Failed to get metadata for ${address}:`, error);
          return null;
        }
      });

      const metadataResults = await Promise.all(metadataPromises);
      const validMetadata = metadataResults.filter(meta => meta !== null) as MoralisTokenMetadata[];

      const tokenData: TokenData[] = validMetadata.map(meta => ({
        address: meta.address,
        symbol: meta.symbol,
        name: meta.name,
        decimals: meta.decimals,
        logo: meta.logo,
        thumbnail: meta.thumbnail,
        balance: '0', // Not available in metadata
        possible_spam: meta.possible_spam,
        verified_contract: meta.verified_contract
      }));

      this.setCache(cacheKey, tokenData, this.config.cacheTTL || 600000); // Cache for 10 minutes

      return {
        success: true,
        data: tokenData,
        metadata: {
          provider: this.provider,
          timestamp: Date.now(),
          rateLimitRemaining: this.rateLimitStatus.remaining
        }
      };
    } catch (error) {
      return this.handleError('getTokenMetadata', error);
    }
  }

  async getNFTs(address: string, chain: string): Promise<DataResponse<NFTData[]>> {
    try {
      const chainId = this.getChainId(chain);
      const cacheKey = `nfts:${address}:${chainId}`;
      const cached = this.getFromCache<NFTData[]>(cacheKey);
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

      const response = await this.client.get(`/${address}/nft`, {
        params: { 
          chain: chainId,
          format: 'decimal',
          exclude_spam: true,
          media_items: false
        }
      });

      const nfts: MoralisNFT[] = response.data.result || [];

      // Transform to our NFTData format
      const nftData: NFTData[] = nfts.map(nft => ({
        token_address: nft.token_address,
        token_id: nft.token_id,
        contract_type: nft.contract_type,
        owner_of: nft.owner_of,
        block_number: nft.block_number,
        block_number_minted: nft.block_number_minted,
        token_uri: nft.token_uri,
        metadata: nft.metadata,
        synced_at: nft.synced_at,
        amount: nft.amount,
        name: nft.name,
        symbol: nft.symbol,
        token_hash: nft.token_hash,
        last_token_uri_sync: nft.last_token_uri_sync,
        last_metadata_sync: nft.last_metadata_sync,
        minter_address: nft.minter_address,
        verified_collection: nft.verified_collection,
        possible_spam: nft.possible_spam
      }));

      this.setCache(cacheKey, nftData, this.config.cacheTTL || 300000);

      return {
        success: true,
        data: nftData,
        metadata: {
          provider: this.provider,
          timestamp: Date.now(),
          rateLimitRemaining: this.rateLimitStatus.remaining
        }
      };
    } catch (error) {
      return this.handleError('getNFTs', error);
    }
  }

  async getTransactions(address: string, chain: string): Promise<DataResponse<MoralisTransaction[]>> {
    try {
      const chainId = this.getChainId(chain);
      const cacheKey = `transactions:${address}:${chainId}`;
      const cached = this.getFromCache<MoralisTransaction[]>(cacheKey);
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

      const response = await this.client.get(`/${address}`, {
        params: { 
          chain: chainId,
          include: 'internal_transactions'
        }
      });

      const transactions: MoralisTransaction[] = response.data.result || [];

      this.setCache(cacheKey, transactions, this.config.cacheTTL || 60000); // Cache for 1 minute

      return {
        success: true,
        data: transactions,
        metadata: {
          provider: this.provider,
          timestamp: Date.now(),
          rateLimitRemaining: this.rateLimitStatus.remaining
        }
      };
    } catch (error) {
      return this.handleError('getTransactions', error);
    }
  }

  async getNativeBalance(address: string, chain: string): Promise<DataResponse<{ balance: string }>> {
    try {
      const chainId = this.getChainId(chain);
      const cacheKey = `native_balance:${address}:${chainId}`;
      const cached = this.getFromCache<{ balance: string }>(cacheKey);
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

      const response = await this.client.get(`/${address}/balance`, {
        params: { chain: chainId }
      });

      const balance = { balance: response.data.balance };

      this.setCache(cacheKey, balance, this.config.cacheTTL || 60000);

      return {
        success: true,
        data: balance,
        metadata: {
          provider: this.provider,
          timestamp: Date.now(),
          rateLimitRemaining: this.rateLimitStatus.remaining
        }
      };
    } catch (error) {
      return this.handleError('getNativeBalance', error);
    }
  }

  async getTokenPrice(address: string, chain: string): Promise<DataResponse<any>> {
    try {
      const chainId = this.getChainId(chain);
      const cacheKey = `price:${address}:${chainId}`;
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

      const response = await this.client.get(`/erc20/${address}/price`, {
        params: { chain: chainId }
      });

      const priceData = response.data;

      this.setCache(cacheKey, priceData, this.config.cacheTTL || 60000);

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
      return this.handleError('getTokenPrice', error);
    }
  }

  async getBlock(blockNumber: number | 'latest', chain: string): Promise<DataResponse<any>> {
    try {
      const chainId = this.getChainId(chain);
      const blockParam = blockNumber === 'latest' ? 'latest' : blockNumber.toString();
      const cacheKey = `block:${blockParam}:${chainId}`;
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

      const response = await this.client.get(`/block/${blockParam}`, {
        params: { 
          chain: chainId,
          include: 'internal_transactions'
        }
      });

      const blockData = response.data;

      // Cache blocks for shorter time
      this.setCache(cacheKey, blockData, blockNumber === 'latest' ? 10000 : 3600000);

      return {
        success: true,
        data: blockData,
        metadata: {
          provider: this.provider,
          timestamp: Date.now(),
          rateLimitRemaining: this.rateLimitStatus.remaining
        }
      };
    } catch (error) {
      return this.handleError('getBlock', error);
    }
  }

  async getChainData(): Promise<DataResponse<MoralisChainData[]>> {
    try {
      const cacheKey = 'chains';
      const cached = this.getFromCache<MoralisChainData[]>(cacheKey);
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

      // Mock chain data based on supported chains
      const chainData: MoralisChainData[] = Object.entries(this.chainMap).map(([name, chainId]) => ({
        chain: name,
        name: name.charAt(0).toUpperCase() + name.slice(1),
        chain_id: chainId,
        rpc_url: `https://${name}.moralis.io`,
        native_token: {
          name: name === 'ethereum' ? 'Ether' : name === 'polygon' ? 'MATIC' : 'Token',
          symbol: name === 'ethereum' ? 'ETH' : name === 'polygon' ? 'MATIC' : 'TOK',
          decimals: 18
        }
      }));

      this.setCache(cacheKey, chainData, 3600000); // Cache for 1 hour

      return {
        success: true,
        data: chainData,
        metadata: {
          provider: this.provider,
          timestamp: Date.now(),
          rateLimitRemaining: this.rateLimitStatus.remaining
        }
      };
    } catch (error) {
      return this.handleError('getChainData', error);
    }
  }

  private getChainId(chain: string): string {
    const chainId = this.chainMap[chain.toLowerCase()];
    if (!chainId) {
      throw new Error(`Unsupported chain: ${chain}`);
    }
    return chainId;
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
    if (this.cache.size > 500) {
      const now = Date.now();
      for (const [k, entry] of this.cache.entries()) {
        if (now - entry.timestamp > entry.ttl) {
          this.cache.delete(k);
        }
      }
    }
  }

  private handleError(operation: string, error: any): DataResponse<any> {
    logger.error(`Moralis ${operation} failed:`, error);

    const dataError: DataProviderError = new Error(
      error?.response?.data?.message || error?.message || 'Unknown Moralis API error'
    ) as DataProviderError;

    dataError.provider = this.provider;
    dataError.code = error?.response?.status?.toString() || error?.code;
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
        logger.debug('Moralis API request', {
          method: config.method,
          url: config.url,
          params: config.params
        });
        return config;
      },
      (error) => {
        logger.error('Moralis API request error:', error);
        return Promise.reject(error);
      }
    );

    // Response interceptor for rate limit tracking
    this.client.interceptors.response.use(
      (response) => {
        // Track rate limits from headers
        const headers = response.headers;
        if (headers['x-rate-limit-remaining'] && headers['x-rate-limit-reset']) {
          this.rateLimitStatus = {
            remaining: parseInt(headers['x-rate-limit-remaining']),
            reset: new Date(parseInt(headers['x-rate-limit-reset']) * 1000),
            limit: parseInt(headers['x-rate-limit-limit'] || this.config.rateLimitRpm?.toString() || '1500'),
            resetInSeconds: parseInt(headers['x-rate-limit-reset']) - Math.floor(Date.now() / 1000)
          };
        }

        logger.debug('Moralis API response', {
          status: response.status,
          rateLimitRemaining: headers['x-rate-limit-remaining']
        });
        return response;
      },
      (error) => {
        logger.error('Moralis API response error:', {
          status: error.response?.status,
          message: error.response?.data?.message || error.message
        });
        return Promise.reject(error);
      }
    );
  }
}