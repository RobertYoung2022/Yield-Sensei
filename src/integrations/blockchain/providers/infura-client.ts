/**
 * Infura Blockchain Client
 * Provides integration with Infura's blockchain infrastructure
 */

import axios, { AxiosInstance } from 'axios';
import Logger from '@/shared/logging/logger';
import {
  BlockchainClient,
  BlockchainConfig,
  BlockchainResponse,
  TransactionRequest,
  TransactionResponse,
  BlockData,
  TokenBalance,
  PriceData,
  BlockchainError
} from '../types';

const logger = Logger.getLogger('infura-client');

interface InfuraRPCRequest {
  jsonrpc: string;
  method: string;
  params: any[];
  id: number;
}

interface InfuraRPCResponse<T = any> {
  jsonrpc: string;
  id: number;
  result?: T;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

export class InfuraClient implements BlockchainClient {
  public readonly provider = 'infura' as const;
  public readonly network: string;
  public readonly config: BlockchainConfig;
  
  private client: AxiosInstance;
  private requestId = 0;

  constructor(config: BlockchainConfig) {
    this.config = {
      timeout: 10000,
      maxRetries: 3,
      retryDelay: 1000,
      rateLimitRpm: 100,
      ...config
    };
    
    this.network = config.network;

    if (!config.apiKey) {
      throw new Error('Infura API key is required');
    }

    this.client = axios.create({
      baseURL: this.getBaseUrl(),
      timeout: this.config.timeout,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    this.setupInterceptors();
  }

  private getBaseUrl(): string {
    const networkUrls: Record<string, string> = {
      ethereum: `https://mainnet.infura.io/v3/${this.config.apiKey}`,
      polygon: `https://polygon-mainnet.infura.io/v3/${this.config.apiKey}`,
      arbitrum: `https://arbitrum-mainnet.infura.io/v3/${this.config.apiKey}`,
      optimism: `https://optimism-mainnet.infura.io/v3/${this.config.apiKey}`,
      avalanche: `https://avalanche-mainnet.infura.io/v3/${this.config.apiKey}`,
    };

    const url = networkUrls[this.network];
    if (!url) {
      throw new Error(`Unsupported network for Infura: ${this.network}`);
    }

    return url;
  }

  private async makeRPCCall<T>(method: string, params: any[] = []): Promise<BlockchainResponse<T>> {
    try {
      const request: InfuraRPCRequest = {
        jsonrpc: '2.0',
        method,
        params,
        id: ++this.requestId
      };

      logger.debug('Making RPC call', { method, params: params.slice(0, 2) });

      const response = await this.client.post<InfuraRPCResponse<T>>('', request);
      const data = response.data;

      if (data.error) {
        throw new Error(`RPC Error: ${data.error.message}`);
      }

      return {
        success: true,
        data: data.result,
        metadata: {
          provider: this.provider,
          network: this.network,
          timestamp: Date.now()
        }
      };

    } catch (error) {
      logger.error('RPC call failed', { method, error });
      
      const blockchainError: BlockchainError = new Error(
        error instanceof Error ? error.message : 'Unknown RPC error'
      ) as BlockchainError;
      
      blockchainError.provider = this.provider;
      blockchainError.network = this.network as any;
      blockchainError.retryable = this.isRetryableError(error);

      return {
        success: false,
        error: blockchainError.message,
        metadata: {
          provider: this.provider,
          network: this.network,
          timestamp: Date.now()
        }
      };
    }
  }

  private isRetryableError(error: any): boolean {
    if (axios.isAxiosError(error)) {
      // Retry on network errors and 5xx status codes
      return !error.response || (error.response.status >= 500);
    }
    return false;
  }

  async getBlockNumber(): Promise<BlockchainResponse<number>> {
    const response = await this.makeRPCCall<string>('eth_blockNumber');
    
    if (response.success && response.data) {
      return {
        ...response,
        data: parseInt(response.data, 16)
      };
    }
    
    return response as BlockchainResponse<number>;
  }

  async getBlock(blockNumber: number | 'latest'): Promise<BlockchainResponse<BlockData>> {
    const blockParam = blockNumber === 'latest' ? 'latest' : `0x${blockNumber.toString(16)}`;
    const response = await this.makeRPCCall<any>('eth_getBlockByNumber', [blockParam, false]);
    
    if (response.success && response.data) {
      const block = response.data;
      return {
        ...response,
        data: {
          number: parseInt(block.number, 16),
          hash: block.hash,
          parentHash: block.parentHash,
          timestamp: parseInt(block.timestamp, 16),
          gasLimit: block.gasLimit,
          gasUsed: block.gasUsed,
          transactions: block.transactions,
          transactionCount: block.transactions.length
        }
      };
    }
    
    return response as BlockchainResponse<BlockData>;
  }

  async getTransaction(hash: string): Promise<BlockchainResponse<TransactionResponse>> {
    const response = await this.makeRPCCall<any>('eth_getTransactionByHash', [hash]);
    
    if (response.success && response.data) {
      const tx = response.data;
      return {
        ...response,
        data: {
          hash: tx.hash,
          blockNumber: tx.blockNumber ? parseInt(tx.blockNumber, 16) : undefined,
          blockHash: tx.blockHash,
          transactionIndex: tx.transactionIndex ? parseInt(tx.transactionIndex, 16) : undefined,
          from: tx.from,
          to: tx.to,
          value: tx.value,
          gas: tx.gas,
          gasPrice: tx.gasPrice
        }
      };
    }
    
    return response as BlockchainResponse<TransactionResponse>;
  }

  async sendTransaction(tx: TransactionRequest): Promise<BlockchainResponse<string>> {
    const response = await this.makeRPCCall<string>('eth_sendRawTransaction', [tx.data || '0x']);
    return response;
  }

  async getBalance(address: string): Promise<BlockchainResponse<string>> {
    const response = await this.makeRPCCall<string>('eth_getBalance', [address, 'latest']);
    return response;
  }

  async getTokenBalance(address: string, tokenAddress: string): Promise<BlockchainResponse<TokenBalance>> {
    // ERC-20 balanceOf method call
    const balanceData = `0x70a08231${address.slice(2).padStart(64, '0')}`;
    const response = await this.makeRPCCall<string>('eth_call', [
      { to: tokenAddress, data: balanceData },
      'latest'
    ]);

    if (response.success && response.data) {
      // Get token decimals and symbol (simplified implementation)
      return {
        ...response,
        data: {
          token: tokenAddress,
          balance: response.data,
          decimals: 18, // Default assumption
          symbol: 'TOKEN',
          name: 'Token'
        }
      };
    }

    return response as BlockchainResponse<TokenBalance>;
  }

  async getTokenPrice(tokenAddress: string): Promise<BlockchainResponse<PriceData>> {
    // This would typically integrate with a price oracle or DEX
    // For now, return a placeholder implementation
    return {
      success: false,
      error: 'Token price fetching not implemented in Infura client',
      metadata: {
        provider: this.provider,
        network: this.network,
        timestamp: Date.now()
      }
    };
  }

  async getGasPrice(): Promise<BlockchainResponse<string>> {
    const response = await this.makeRPCCall<string>('eth_gasPrice');
    return response;
  }

  async estimateGas(tx: TransactionRequest): Promise<BlockchainResponse<string>> {
    const response = await this.makeRPCCall<string>('eth_estimateGas', [tx]);
    return response;
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.getBlockNumber();
      return response.success;
    } catch (error) {
      logger.warn('Infura health check failed', { error });
      return false;
    }
  }

  private setupInterceptors(): void {
    // Request interceptor
    this.client.interceptors.request.use(
      (config) => {
        logger.debug('Infura request', { 
          method: config.method,
          url: config.url,
          network: this.network
        });
        return config;
      },
      (error) => {
        logger.error('Infura request error', { error });
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response) => {
        logger.debug('Infura response', { 
          status: response.status,
          network: this.network
        });
        return response;
      },
      (error) => {
        logger.error('Infura response error', { 
          status: error.response?.status,
          network: this.network,
          error: error.message
        });
        return Promise.reject(error);
      }
    );
  }
}