/**
 * QuickNode Blockchain Client
 * Provides integration with QuickNode's blockchain infrastructure
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

const logger = Logger.getLogger('quicknode-client');

interface QuickNodeRPCRequest {
  jsonrpc: string;
  method: string;
  params: any[];
  id: number;
}

interface QuickNodeRPCResponse<T = any> {
  jsonrpc: string;
  id: number;
  result?: T;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

export class QuickNodeClient implements BlockchainClient {
  public readonly provider = 'quicknode' as const;
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

    if (!config.baseUrl) {
      throw new Error('QuickNode endpoint URL is required');
    }

    this.client = axios.create({
      baseURL: config.baseUrl,
      timeout: this.config.timeout,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    this.setupInterceptors();
  }

  private async makeRPCCall<T>(method: string, params: any[] = []): Promise<BlockchainResponse<T>> {
    try {
      const request: QuickNodeRPCRequest = {
        jsonrpc: '2.0',
        method,
        params,
        id: ++this.requestId
      };

      logger.debug('Making RPC call', { method, params: params.slice(0, 2) });

      const response = await this.client.post<QuickNodeRPCResponse<T>>('', request);
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
      // Get token decimals
      const decimalsData = '0x313ce567'; // decimals() function selector
      const decimalsResponse = await this.makeRPCCall<string>('eth_call', [
        { to: tokenAddress, data: decimalsData },
        'latest'
      ]);

      // Get token symbol
      const symbolData = '0x95d89b41'; // symbol() function selector
      const symbolResponse = await this.makeRPCCall<string>('eth_call', [
        { to: tokenAddress, data: symbolData },
        'latest'
      ]);

      // Get token name
      const nameData = '0x06fdde03'; // name() function selector
      const nameResponse = await this.makeRPCCall<string>('eth_call', [
        { to: tokenAddress, data: nameData },
        'latest'
      ]);

      const decimals = decimalsResponse.success && decimalsResponse.data 
        ? parseInt(decimalsResponse.data, 16) 
        : 18;

      const symbol = symbolResponse.success && symbolResponse.data
        ? this.parseStringFromHex(symbolResponse.data)
        : 'TOKEN';

      const name = nameResponse.success && nameResponse.data
        ? this.parseStringFromHex(nameResponse.data)
        : 'Token';

      return {
        ...response,
        data: {
          token: tokenAddress,
          balance: response.data,
          decimals,
          symbol,
          name
        }
      };
    }

    return response as BlockchainResponse<TokenBalance>;
  }

  async getTokenPrice(tokenAddress: string): Promise<BlockchainResponse<PriceData>> {
    // QuickNode doesn't provide direct price data, would need external oracle
    return {
      success: false,
      error: 'Token price fetching not implemented in QuickNode client',
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
      logger.warn('QuickNode health check failed', { error });
      return false;
    }
  }

  private parseStringFromHex(hexString: string): string {
    try {
      // Remove 0x prefix
      const hex = hexString.startsWith('0x') ? hexString.slice(2) : hexString;
      
      // Convert hex to buffer
      const buffer = Buffer.from(hex, 'hex');
      
      // For dynamic strings, skip the first 32 bytes (offset) and next 32 bytes (length)
      // Then read the actual string data
      const length = parseInt(hex.slice(64, 128), 16);
      const stringHex = hex.slice(128, 128 + length * 2);
      
      return Buffer.from(stringHex, 'hex').toString('utf8').replace(/\0/g, '');
    } catch (error) {
      logger.warn('Failed to parse string from hex', { hexString, error });
      return 'UNKNOWN';
    }
  }

  private setupInterceptors(): void {
    // Request interceptor
    this.client.interceptors.request.use(
      (config) => {
        logger.debug('QuickNode request', { 
          method: config.method,
          url: config.url,
          network: this.network
        });
        return config;
      },
      (error) => {
        logger.error('QuickNode request error', { error });
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response) => {
        logger.debug('QuickNode response', { 
          status: response.status,
          network: this.network
        });
        return response;
      },
      (error) => {
        logger.error('QuickNode response error', { 
          status: error.response?.status,
          network: this.network,
          error: error.message
        });
        return Promise.reject(error);
      }
    );
  }
}