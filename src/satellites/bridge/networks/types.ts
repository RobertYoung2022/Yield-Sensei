/**
 * Blockchain Networks Integration Types
 * Standardized interfaces for multi-chain support
 */

export type NetworkType = 'evm' | 'solana' | 'cosmos' | 'substrate' | 'tendermint';
export type NetworkID = string;
export type TransactionHash = string;
export type BlockHash = string;
export type Address = string;

export interface NetworkConfig {
  id: NetworkID;
  name: string;
  type: NetworkType;
  chainId?: number; // For EVM chains
  rpcUrls: string[]; // Primary and fallback RPC endpoints
  wsUrls?: string[]; // WebSocket endpoints for real-time data
  explorerUrls: string[];
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  blockTime: number; // Average block time in seconds
  confirmationBlocks: number; // Required confirmations for finality
  gasTokenSymbol: string;
  maxGasPrice?: string;
  features: NetworkFeatures;
  endpoints?: NetworkEndpoints;
}

export interface NetworkFeatures {
  smartContracts: boolean;
  eip1559: boolean; // EIP-1559 gas pricing
  multisig: boolean;
  tokenStandards: string[]; // e.g., ['ERC-20', 'ERC-721', 'SPL']
  bridgeSupport: boolean;
  stakingSupport: boolean;
  governanceSupport: boolean;
}

export interface NetworkEndpoints {
  rpc: string[];
  websocket?: string[];
  rest?: string[]; // For Cosmos chains
  grpc?: string[]; // For Cosmos chains
}

export interface NetworkConnection {
  networkId: NetworkID;
  config: NetworkConfig;
  isConnected: boolean;
  currentBlock: number;
  currentBlockHash?: BlockHash;
  gasPrice?: string;
  baseFee?: string;
  priorityFee?: string;
  lastUpdate: number;
  latency: number;
  failoverIndex: number; // Current RPC endpoint index
  connectionAttempts: number;
  lastConnectionAttempt: number;
  healthScore: number; // 0-100
}

export interface TransactionRequest {
  networkId: NetworkID;
  from: Address;
  to: Address;
  value?: string;
  data?: string;
  gasLimit?: string;
  gasPrice?: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
  nonce?: number;
  type?: number; // Transaction type (0, 1, 2)
}

export interface TransactionReceipt {
  networkId: NetworkID;
  transactionHash: TransactionHash;
  blockNumber: number;
  blockHash: BlockHash;
  from: Address;
  to: Address;
  gasUsed: string;
  gasPrice: string;
  status: 'success' | 'failed' | 'pending';
  confirmations: number;
  timestamp: number;
  logs?: any[];
  events?: any[];
}

export interface NetworkStats {
  networkId: NetworkID;
  totalTransactions: number;
  successfulTransactions: number;
  failedTransactions: number;
  averageBlockTime: number;
  averageGasPrice: string;
  currentBlockHeight: number;
  networkLatency: number;
  uptimePercentage: number;
  lastSyncTime: number;
}

export interface NetworkHealth {
  networkId: NetworkID;
  isHealthy: boolean;
  healthScore: number; // 0-100
  issues: NetworkIssue[];
  lastHealthCheck: number;
  syncStatus: {
    isSyncing: boolean;
    currentBlock: number;
    highestBlock: number;
    syncPercentage: number;
  };
  connectionStatus: {
    activeConnections: number;
    totalEndpoints: number;
    failedEndpoints: string[];
  };
}

export interface NetworkIssue {
  type: 'connectivity' | 'sync' | 'gas' | 'congestion' | 'consensus';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  timestamp: number;
  acknowledged: boolean;
}

export interface GasEstimate {
  networkId: NetworkID;
  gasLimit: string;
  gasPrice: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
  estimatedCost: string;
  estimatedTime: number;
  confidence: number; // 0-1
  timestamp: number;
}

export interface BlockInfo {
  networkId: NetworkID;
  blockNumber: number;
  blockHash: BlockHash;
  parentHash: BlockHash;
  timestamp: number;
  gasLimit?: string;
  gasUsed?: string;
  baseFeePerGas?: string;
  transactionCount: number;
  validator?: Address;
}

// Network-specific types

export interface EVMNetworkConfig extends NetworkConfig {
  type: 'evm';
  chainId: number;
}

export interface SolanaNetworkConfig extends NetworkConfig {
  type: 'solana';
  cluster: 'mainnet-beta' | 'testnet' | 'devnet';
  commitment: 'processed' | 'confirmed' | 'finalized';
}

export interface CosmosNetworkConfig extends NetworkConfig {
  type: 'cosmos';
  chainId: string;
  bech32Prefix: string;
  slip44: number;
  stakingDenom: string;
  feeDenoms: string[];
}

// Event types

export interface NetworkEvent {
  networkId: NetworkID;
  type: 'block' | 'transaction' | 'error' | 'connection' | 'sync';
  timestamp: number;
  data: any;
}

export interface BlockEvent extends NetworkEvent {
  type: 'block';
  data: {
    blockNumber: number;
    blockHash: BlockHash;
    timestamp: number;
    transactionCount: number;
  };
}

export interface TransactionEvent extends NetworkEvent {
  type: 'transaction';
  data: {
    transactionHash: TransactionHash;
    from: Address;
    to: Address;
    value: string;
    status: 'pending' | 'confirmed' | 'failed';
  };
}

export interface ConnectionEvent extends NetworkEvent {
  type: 'connection';
  data: {
    status: 'connected' | 'disconnected' | 'reconnecting';
    endpoint: string;
    latency?: number;
  };
}

// Network monitoring types

export interface NetworkMonitoringConfig {
  updateInterval: number; // milliseconds
  healthCheckInterval: number; // milliseconds
  maxConnectionAttempts: number;
  connectionTimeout: number; // milliseconds
  healthThresholds: {
    minHealthScore: number;
    maxLatency: number;
    maxFailedAttempts: number;
  };
  alertConfig: {
    enabled: boolean;
    endpoints: string[];
    severityLevels: ('low' | 'medium' | 'high' | 'critical')[];
  };
}

// Network capabilities

export interface NetworkCapabilities {
  networkId: NetworkID;
  supportsSmartContracts: boolean;
  supportsTokens: boolean;
  supportsNFTs: boolean;
  supportsMultisig: boolean;
  supportsStaking: boolean;
  supportsBridging: boolean;
  maxTransactionsPerBlock: number;
  averageTransactionCost: string;
  finalityTime: number; // seconds
  tokenStandards: string[];
  supportedWallets: string[];
}

// Default network configurations
export const NETWORK_CONFIGS: Record<string, NetworkConfig> = {
  ethereum: {
    id: 'ethereum',
    name: 'Ethereum Mainnet',
    type: 'evm',
    chainId: 1,
    rpcUrls: [
      'https://eth-mainnet.alchemyapi.io/v2/demo',
      'https://mainnet.infura.io/v3/demo',
      'https://ethereum.publicnode.com',
    ],
    wsUrls: [
      'wss://eth-mainnet.alchemyapi.io/v2/demo',
      'wss://mainnet.infura.io/ws/v3/demo',
    ],
    explorerUrls: ['https://etherscan.io'],
    nativeCurrency: {
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18,
    },
    blockTime: 12,
    confirmationBlocks: 6,
    gasTokenSymbol: 'ETH',
    maxGasPrice: '100000000000', // 100 gwei
    features: {
      smartContracts: true,
      eip1559: true,
      multisig: true,
      tokenStandards: ['ERC-20', 'ERC-721', 'ERC-1155'],
      bridgeSupport: true,
      stakingSupport: true,
      governanceSupport: true,
    },
  },
  polygon: {
    id: 'polygon',
    name: 'Polygon Mainnet',
    type: 'evm',
    chainId: 137,
    rpcUrls: [
      'https://polygon-rpc.com',
      'https://rpc.ankr.com/polygon',
      'https://polygon.llamarpc.com',
    ],
    explorerUrls: ['https://polygonscan.com'],
    nativeCurrency: {
      name: 'MATIC',
      symbol: 'MATIC',
      decimals: 18,
    },
    blockTime: 2,
    confirmationBlocks: 12,
    gasTokenSymbol: 'MATIC',
    maxGasPrice: '30000000000', // 30 gwei
    features: {
      smartContracts: true,
      eip1559: true,
      multisig: true,
      tokenStandards: ['ERC-20', 'ERC-721', 'ERC-1155'],
      bridgeSupport: true,
      stakingSupport: true,
      governanceSupport: true,
    },
  },
  bsc: {
    id: 'bsc',
    name: 'Binance Smart Chain',
    type: 'evm',
    chainId: 56,
    rpcUrls: [
      'https://bsc-dataseed.binance.org',
      'https://bsc-dataseed1.defibit.io',
      'https://bsc-dataseed1.ninicoin.io',
    ],
    explorerUrls: ['https://bscscan.com'],
    nativeCurrency: {
      name: 'BNB',
      symbol: 'BNB',
      decimals: 18,
    },
    blockTime: 3,
    confirmationBlocks: 3,
    gasTokenSymbol: 'BNB',
    maxGasPrice: '20000000000', // 20 gwei
    features: {
      smartContracts: true,
      eip1559: false,
      multisig: true,
      tokenStandards: ['BEP-20', 'BEP-721', 'BEP-1155'],
      bridgeSupport: true,
      stakingSupport: true,
      governanceSupport: true,
    },
  },
  arbitrum: {
    id: 'arbitrum',
    name: 'Arbitrum One',
    type: 'evm',
    chainId: 42161,
    rpcUrls: [
      'https://arb1.arbitrum.io/rpc',
      'https://arbitrum.llamarpc.com',
      'https://rpc.ankr.com/arbitrum',
    ],
    explorerUrls: ['https://arbiscan.io'],
    nativeCurrency: {
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18,
    },
    blockTime: 1,
    confirmationBlocks: 1,
    gasTokenSymbol: 'ETH',
    maxGasPrice: '10000000000', // 10 gwei
    features: {
      smartContracts: true,
      eip1559: true,
      multisig: true,
      tokenStandards: ['ERC-20', 'ERC-721', 'ERC-1155'],
      bridgeSupport: true,
      stakingSupport: false,
      governanceSupport: true,
    },
  },
  optimism: {
    id: 'optimism',
    name: 'Optimism',
    type: 'evm',
    chainId: 10,
    rpcUrls: [
      'https://mainnet.optimism.io',
      'https://optimism.llamarpc.com',
      'https://rpc.ankr.com/optimism',
    ],
    explorerUrls: ['https://optimistic.etherscan.io'],
    nativeCurrency: {
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18,
    },
    blockTime: 2,
    confirmationBlocks: 1,
    gasTokenSymbol: 'ETH',
    maxGasPrice: '10000000000', // 10 gwei
    features: {
      smartContracts: true,
      eip1559: true,
      multisig: true,
      tokenStandards: ['ERC-20', 'ERC-721', 'ERC-1155'],
      bridgeSupport: true,
      stakingSupport: false,
      governanceSupport: true,
    },
  },
  avalanche: {
    id: 'avalanche',
    name: 'Avalanche C-Chain',
    type: 'evm',
    chainId: 43114,
    rpcUrls: [
      'https://api.avax.network/ext/bc/C/rpc',
      'https://rpc.ankr.com/avalanche',
      'https://avalanche.llamarpc.com',
    ],
    explorerUrls: ['https://snowtrace.io'],
    nativeCurrency: {
      name: 'Avalanche',
      symbol: 'AVAX',
      decimals: 18,
    },
    blockTime: 1,
    confirmationBlocks: 1,
    gasTokenSymbol: 'AVAX',
    maxGasPrice: '25000000000', // 25 gwei
    features: {
      smartContracts: true,
      eip1559: true,
      multisig: true,
      tokenStandards: ['ERC-20', 'ERC-721', 'ERC-1155'],
      bridgeSupport: true,
      stakingSupport: true,
      governanceSupport: true,
    },
  },
  solana: {
    id: 'solana',
    name: 'Solana Mainnet',
    type: 'solana',
    rpcUrls: [
      'https://api.mainnet-beta.solana.com',
      'https://solana-api.projectserum.com',
      'https://rpc.ankr.com/solana',
    ],
    explorerUrls: ['https://explorer.solana.com'],
    nativeCurrency: {
      name: 'Solana',
      symbol: 'SOL',
      decimals: 9,
    },
    blockTime: 0.4,
    confirmationBlocks: 32,
    gasTokenSymbol: 'SOL',
    features: {
      smartContracts: true,
      eip1559: false,
      multisig: true,
      tokenStandards: ['SPL'],
      bridgeSupport: true,
      stakingSupport: true,
      governanceSupport: true,
    },
  },
  cosmos: {
    id: 'cosmos',
    name: 'Cosmos Hub',
    type: 'cosmos',
    rpcUrls: [
      'https://cosmos-rpc.polkachu.com',
      'https://rpc-cosmoshub.blockapsis.com',
      'https://cosmos.validator.network',
    ],
    explorerUrls: ['https://www.mintscan.io/cosmos'],
    nativeCurrency: {
      name: 'Cosmos',
      symbol: 'ATOM',
      decimals: 6,
    },
    blockTime: 6,
    confirmationBlocks: 1,
    gasTokenSymbol: 'ATOM',
    features: {
      smartContracts: true,
      eip1559: false,
      multisig: true,
      tokenStandards: ['ICS-20'],
      bridgeSupport: true,
      stakingSupport: true,
      governanceSupport: true,
    },
    endpoints: {
      rpc: [
        'https://cosmos-rpc.polkachu.com',
        'https://rpc-cosmoshub.blockapsis.com',
      ],
      rest: [
        'https://cosmos-api.polkachu.com',
        'https://lcd-cosmoshub.blockapsis.com',
      ],
      grpc: [
        'cosmos-grpc.polkachu.com:14890',
        'grpc-cosmoshub.blockapsis.com:9090',
      ],
    },
  },
};