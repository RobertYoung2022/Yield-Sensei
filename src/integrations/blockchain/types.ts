/**
 * Blockchain Integration Types
 * Common interfaces and types for blockchain provider integrations
 */

export type BlockchainNetwork = 
  | 'ethereum' 
  | 'polygon' 
  | 'arbitrum' 
  | 'optimism' 
  | 'bsc' 
  | 'avalanche' 
  | 'solana' 
  | 'cosmos';

export type BlockchainProvider = 'infura' | 'alchemy' | 'quicknode' | 'public';

export interface BlockchainConfig {
  apiKey?: string;
  baseUrl?: string;
  timeout?: number;
  maxRetries?: number;
  retryDelay?: number;
  rateLimitRpm?: number;
  network: BlockchainNetwork;
  provider: BlockchainProvider;
}

export interface BlockchainResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  metadata?: {
    provider?: string;
    network?: string;
    blockNumber?: number;
    timestamp?: number;
  };
}

export interface TransactionRequest {
  to: string;
  from?: string;
  value?: string;
  data?: string;
  gas?: string;
  gasPrice?: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
  nonce?: number;
}

export interface TransactionResponse {
  hash: string;
  blockNumber?: number;
  blockHash?: string;
  transactionIndex?: number;
  from: string;
  to: string;
  value: string;
  gas: string;
  gasPrice: string;
  gasUsed?: string;
  status?: number;
  confirmations?: number;
}

export interface BlockData {
  number: number;
  hash: string;
  parentHash: string;
  timestamp: number;
  gasLimit: string;
  gasUsed: string;
  transactions: string[];
  transactionCount: number;
}

export interface TokenBalance {
  token: string;
  balance: string;
  decimals: number;
  symbol: string;
  name: string;
}

export interface PriceData {
  token: string;
  price: number;
  priceChange24h: number;
  volume24h: number;
  marketCap: number;
  timestamp: number;
}

export interface ProviderHealth {
  isHealthy: boolean;
  latency: number;
  blockNumber: number;
  lastChecked: Date;
  errorCount: number;
}

export interface ConnectionPoolConfig {
  maxConnections: number;
  minConnections: number;
  acquireTimeoutMs: number;
  idleTimeoutMs: number;
  reapIntervalMs: number;
}

export interface BlockchainClient {
  readonly provider: BlockchainProvider;
  readonly network: BlockchainNetwork;
  readonly config: BlockchainConfig;

  // Core operations
  getBlockNumber(): Promise<BlockchainResponse<number>>;
  getBlock(blockNumber: number | 'latest'): Promise<BlockchainResponse<BlockData>>;
  getTransaction(hash: string): Promise<BlockchainResponse<TransactionResponse>>;
  sendTransaction(tx: TransactionRequest): Promise<BlockchainResponse<string>>;
  
  // Token operations
  getBalance(address: string): Promise<BlockchainResponse<string>>;
  getTokenBalance(address: string, tokenAddress: string): Promise<BlockchainResponse<TokenBalance>>;
  getTokenPrice(tokenAddress: string): Promise<BlockchainResponse<PriceData>>;
  
  // Utility operations
  healthCheck(): Promise<boolean>;
  getGasPrice(): Promise<BlockchainResponse<string>>;
  estimateGas(tx: TransactionRequest): Promise<BlockchainResponse<string>>;
}

export interface ProviderManagerConfig {
  providers: BlockchainConfig[];
  connectionPool: ConnectionPoolConfig;
  healthCheckInterval: number;
  failoverThreshold: number;
  loadBalancing: {
    enabled: boolean;
    strategy: 'round-robin' | 'least-latency' | 'random';
  };
}

export interface BlockchainError extends Error {
  code?: string;
  provider?: BlockchainProvider;
  network?: BlockchainNetwork;
  retryable?: boolean;
}

export interface WebSocketConnection {
  url: string;
  reconnectAttempts: number;
  maxReconnectAttempts: number;
  reconnectDelay: number;
  isConnected: boolean;
  lastHeartbeat: Date;
}

export interface StreamSubscription {
  id: string;
  type: 'blocks' | 'transactions' | 'logs' | 'pending';
  filters?: Record<string, any>;
  callback: (data: any) => void;
  isActive: boolean;
}