/**
 * Cosmos Network Manager
 * Manages connections to Cosmos-based blockchains
 */

import axios, { AxiosInstance } from 'axios';
import Logger from '../../../shared/logging/logger';
import { BaseNetworkManager } from './base-network-manager';
import {
  CosmosNetworkConfig,
  TransactionRequest,
  TransactionReceipt,
  GasEstimate,
  BlockInfo,
  TransactionHash,
  Address,
  BlockEvent,
} from './types';

const logger = Logger.getLogger('cosmos-network-manager');

interface CosmosBlock {
  block_id: {
    hash: string;
    parts: {
      total: number;
      hash: string;
    };
  };
  block: {
    header: {
      version: any;
      chain_id: string;
      height: string;
      time: string;
      last_block_id: {
        hash: string;
      };
      proposer_address: string;
    };
    data: {
      txs: string[];
    };
  };
}

interface CosmosTransaction {
  hash: string;
  height: string;
  index: number;
  tx_result: {
    code: number;
    data: string;
    log: string;
    info: string;
    gas_wanted: string;
    gas_used: string;
    events: any[];
  };
  tx: any;
}

interface CosmosAccount {
  '@type': string;
  address: string;
  pub_key?: any;
  account_number: string;
  sequence: string;
}

export class CosmosNetworkManager extends BaseNetworkManager {
  private rpcClient: AxiosInstance | null = null;
  private restClient: AxiosInstance | null = null;
  private blockPollingInterval: NodeJS.Timeout | null = null;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private lastKnownHeight = 0;

  constructor(config: CosmosNetworkConfig) {
    super(config);
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.warn(`${this.config.name} already initialized`);
      return;
    }

    try {
      logger.info(`Initializing Cosmos network manager for ${this.config.name}...`);

      await this.connect();
      this.isInitialized = true;

      logger.info(`✅ ${this.config.name} initialized successfully`);
    } catch (error) {
      logger.error(`Failed to initialize ${this.config.name}:`, error);
      throw error;
    }
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn(`${this.config.name} already running`);
      return;
    }

    if (!this.isInitialized) {
      await this.initialize();
    }

    this.isRunning = true;

    // Start block monitoring (polling-based for Cosmos)
    this.startBlockPolling();

    // Start health monitoring
    this.startHealthMonitoring();

    logger.info(`🚀 ${this.config.name} network manager started`);
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;

    // Stop monitoring
    this.stopBlockPolling();
    this.stopHealthMonitoring();

    // Disconnect
    await this.disconnect();

    logger.info(`🛑 ${this.config.name} network manager stopped`);
  }

  async connect(): Promise<boolean> {
    try {
      const success = await this.attemptConnection();
      
      if (success && this.rpcClient) {
        // Test the connection
        const status = await this.getNodeStatus();
        const latestHeight = parseInt(status.sync_info.latest_block_height);
        
        logger.info(`Connected to ${this.config.name}`, {
          chainId: status.node_info.network,
          latestHeight,
        });

        // Verify chain ID matches
        const cosmosConfig = this.config as CosmosNetworkConfig;
        if (status.node_info.network !== cosmosConfig.chainId) {
          throw new Error(
            `Chain ID mismatch: expected ${cosmosConfig.chainId}, got ${status.node_info.network}`
          );
        }

        this.connection.currentBlock = latestHeight;
        this.connection.isConnected = true;
        this.connection.lastUpdate = Date.now();
        this.lastKnownHeight = latestHeight;

        return true;
      }

      return false;
    } catch (error) {
      logger.error(`Failed to connect to ${this.config.name}:`, error);
      this.connection.isConnected = false;
      return false;
    }
  }

  async disconnect(): Promise<void> {
    this.stopBlockPolling();
    
    if (this.rpcClient) {
      this.rpcClient = null;
    }
    
    if (this.restClient) {
      this.restClient = null;
    }

    this.connection.isConnected = false;
    logger.info(`Disconnected from ${this.config.name}`);
  }

  protected async connectToEndpoint(endpoint: string): Promise<boolean> {
    try {
      // Create RPC client
      this.rpcClient = axios.create({
        baseURL: endpoint,
        timeout: 10000,
        headers: {
          'Content-Type': 'application/json',
        },
      });

      // Create REST client if REST endpoints are available
      const cosmosConfig = this.config as CosmosNetworkConfig;
      if (cosmosConfig.endpoints?.rest && cosmosConfig.endpoints.rest.length > 0) {
        const restEndpoint = cosmosConfig.endpoints.rest[this.connection.failoverIndex] || cosmosConfig.endpoints.rest[0];
        this.restClient = axios.create({
          baseURL: restEndpoint,
          timeout: 10000,
          headers: {
            'Content-Type': 'application/json',
          },
        });
      }

      // Test connection
      await this.getNodeStatus();

      return true;
    } catch (error) {
      logger.error(`Failed to connect to endpoint ${endpoint}:`, error);
      return false;
    }
  }

  async getCurrentBlock(): Promise<number> {
    if (!this.rpcClient) {
      throw new Error(`${this.config.name} not connected`);
    }

    try {
      const status = await this.getNodeStatus();
      const height = parseInt(status.sync_info.latest_block_height);
      this.connection.currentBlock = height;
      return height;
    } catch (error) {
      logger.error(`Failed to get current block for ${this.config.name}:`, error);
      throw error;
    }
  }

  async getBlockInfo(blockNumber?: number): Promise<BlockInfo | null> {
    if (!this.rpcClient) {
      throw new Error(`${this.config.name} not connected`);
    }

    try {
      const height = blockNumber || await this.getCurrentBlock();
      const response = await this.rpcClient.get(`/block?height=${height}`);
      const block: CosmosBlock = response.data.result;

      return {
        networkId: this.config.id,
        blockNumber: parseInt(block.block.header.height),
        blockHash: block.block_id.hash,
        parentHash: block.block.header.last_block_id.hash,
        timestamp: new Date(block.block.header.time).getTime(),
        transactionCount: block.block.data.txs.length,
        validator: block.block.header.proposer_address,
      };
    } catch (error) {
      logger.error(`Failed to get block info for ${this.config.name}:`, error);
      return null;
    }
  }

  async sendTransaction(tx: TransactionRequest): Promise<TransactionHash> {
    if (!this.rpcClient) {
      throw new Error(`${this.config.name} not connected`);
    }

    try {
      // Note: This is a simplified version. In practice, you'd need to:
      // 1. Create a proper Cosmos transaction from the request
      // 2. Sign it with the appropriate key
      // 3. Broadcast it using the RPC client
      
      throw new Error('Transaction sending not implemented - requires proper transaction construction and signing');

      // Example implementation would look like:
      // const broadcastReq = {
      //   tx_bytes: signedTxBytes,
      //   mode: 'BROADCAST_MODE_SYNC'
      // };
      // const response = await this.rpcClient.post('/cosmos/tx/v1beta1/txs', broadcastReq);
      // this.incrementTransactionCount(true);
      // return response.data.tx_response.txhash;
      
    } catch (error) {
      this.incrementTransactionCount(false);
      logger.error(`Failed to send transaction on ${this.config.name}:`, error);
      throw error;
    }
  }

  async getTransactionReceipt(hash: TransactionHash): Promise<TransactionReceipt | null> {
    if (!this.rpcClient) {
      throw new Error(`${this.config.name} not connected`);
    }

    try {
      const response = await this.rpcClient.get(`/tx?hash=0x${hash}`);
      const tx: CosmosTransaction = response.data.result;

      const currentHeight = await this.getCurrentBlock();
      const confirmations = Math.max(0, currentHeight - parseInt(tx.height));

      return {
        networkId: this.config.id,
        transactionHash: hash,
        blockNumber: parseInt(tx.height),
        blockHash: '', // Would need to fetch block for hash
        from: '', // Would need to parse transaction for sender
        to: '', // Would need to parse transaction for recipient
        gasUsed: tx.tx_result.gas_used,
        gasPrice: '0', // Cosmos has different fee structure
        status: tx.tx_result.code === 0 ? 'success' : 'failed',
        confirmations,
        timestamp: Date.now(), // Would need to get from block
        logs: [tx.tx_result.log],
        events: tx.tx_result.events,
      };
    } catch (error) {
      logger.error(`Failed to get transaction receipt for ${hash} on ${this.config.name}:`, error);
      return null;
    }
  }

  async estimateGas(tx: TransactionRequest): Promise<GasEstimate> {
    if (!this.rpcClient || !this.restClient) {
      throw new Error(`${this.config.name} not connected or missing REST client`);
    }

    try {
      // Simulate transaction to get gas estimate
      // This is a simplified estimation
      const estimatedGas = '200000'; // Default gas limit
      const gasPrice = '0.025'; // Default gas price in base denom
      const estimatedCost = (parseInt(estimatedGas) * parseFloat(gasPrice)).toString();

      return {
        networkId: this.config.id,
        gasLimit: estimatedGas,
        gasPrice: gasPrice,
        estimatedCost: estimatedCost,
        estimatedTime: this.config.blockTime,
        confidence: 0.7, // Lower confidence due to simplified estimation
        timestamp: Date.now(),
      };
    } catch (error) {
      logger.error(`Failed to estimate gas on ${this.config.name}:`, error);
      throw error;
    }
  }

  async getBalance(address: Address): Promise<string> {
    if (!this.restClient) {
      throw new Error(`${this.config.name} REST client not connected`);
    }

    try {
      const cosmosConfig = this.config as CosmosNetworkConfig;
      const response = await this.restClient.get(`/cosmos/bank/v1beta1/balances/${address}`);
      const balances = response.data.balances;

      // Find the native token balance
      const nativeBalance = balances.find((balance: any) => 
        balance.denom === cosmosConfig.stakingDenom || 
        balance.denom === this.config.nativeCurrency.symbol.toLowerCase()
      );

      if (!nativeBalance) {
        return '0';
      }

      // Convert from base denomination to human-readable format
      const amount = parseFloat(nativeBalance.amount);
      const decimals = this.config.nativeCurrency.decimals;
      return (amount / Math.pow(10, decimals)).toString();
    } catch (error) {
      logger.error(`Failed to get balance for ${address} on ${this.config.name}:`, error);
      throw error;
    }
  }

  isValidAddress(address: string): boolean {
    const cosmosConfig = this.config as CosmosNetworkConfig;
    const prefix = cosmosConfig.bech32Prefix || 'cosmos';
    
    // Basic validation: should start with the correct prefix and be the right length
    if (!address.startsWith(prefix)) {
      return false;
    }

    // Cosmos addresses are typically 39-45 characters
    if (address.length < 39 || address.length > 45) {
      return false;
    }

    // More sophisticated validation would require bech32 decoding
    return true;
  }

  // Private monitoring methods

  private startBlockPolling(): void {
    if (!this.rpcClient) return;

    const pollBlocks = async () => {
      if (!this.isRunning || !this.rpcClient) return;

      try {
        const currentHeight = await this.getCurrentBlock();
        
        // Check for new blocks
        if (currentHeight > this.lastKnownHeight) {
          for (let height = this.lastKnownHeight + 1; height <= currentHeight; height++) {
            const blockInfo = await this.getBlockInfo(height);
            
            if (blockInfo) {
              const blockEvent: BlockEvent = {
                networkId: this.config.id,
                type: 'block',
                timestamp: Date.now(),
                data: {
                  blockNumber: height,
                  blockHash: blockInfo.blockHash,
                  timestamp: blockInfo.timestamp,
                  transactionCount: blockInfo.transactionCount,
                },
              };

              this.emitEvent(blockEvent);
              logger.debug(`New block on ${this.config.name}: ${height}`);
            }
          }
          
          this.lastKnownHeight = currentHeight;
        }

        this.connection.lastUpdate = Date.now();
      } catch (error) {
        logger.error(`Error polling blocks for ${this.config.name}:`, error);
      }
    };

    // Initial poll
    pollBlocks();

    // Poll every 6 seconds (typical Cosmos block time)
    this.blockPollingInterval = setInterval(pollBlocks, 6000);

    logger.info(`Block polling started for ${this.config.name}`);
  }

  private stopBlockPolling(): void {
    if (this.blockPollingInterval) {
      clearInterval(this.blockPollingInterval);
      this.blockPollingInterval = null;
      logger.info(`Block polling stopped for ${this.config.name}`);
    }
  }

  private startHealthMonitoring(): void {
    const performHealthCheck = async () => {
      if (!this.isRunning) return;

      try {
        await this.performHealthCheck();

        // Schedule reconnection if unhealthy
        if (!this.isHealthy() && !this.reconnectTimer) {
          this.scheduleReconnection();
        }
      } catch (error) {
        logger.error(`Health check failed for ${this.config.name}:`, error);
      }
    };

    // Initial health check
    performHealthCheck();

    // Regular health checks every 30 seconds
    this.healthCheckInterval = setInterval(performHealthCheck, 30000);
  }

  private stopHealthMonitoring(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private scheduleReconnection(): void {
    if (this.reconnectTimer) return;

    const delay = Math.min(30000, 5000 * Math.pow(2, this.connection.connectionAttempts)); // Exponential backoff

    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;

      if (!this.isRunning) return;

      logger.info(`Attempting scheduled reconnection for ${this.config.name}...`);
      
      const success = await this.reconnect();
      
      if (!success && this.isRunning) {
        this.scheduleReconnection(); // Schedule another attempt
      }
    }, delay);
  }

  // Additional Cosmos-specific methods

  private async getNodeStatus(): Promise<any> {
    if (!this.rpcClient) {
      throw new Error(`${this.config.name} not connected`);
    }

    const response = await this.rpcClient.get('/status');
    return response.data.result;
  }

  async getAccount(address: Address): Promise<CosmosAccount | null> {
    if (!this.restClient) {
      throw new Error(`${this.config.name} REST client not connected`);
    }

    try {
      const response = await this.restClient.get(`/cosmos/auth/v1beta1/accounts/${address}`);
      return response.data.account;
    } catch (error) {
      logger.error(`Failed to get account info for ${address}:`, error);
      return null;
    }
  }

  async getValidators(): Promise<any[]> {
    if (!this.restClient) {
      throw new Error(`${this.config.name} REST client not connected`);
    }

    try {
      const response = await this.restClient.get('/cosmos/staking/v1beta1/validators?status=BOND_STATUS_BONDED');
      return response.data.validators;
    } catch (error) {
      logger.error(`Failed to get validators for ${this.config.name}:`, error);
      throw error;
    }
  }

  async getDelegations(delegatorAddress: Address): Promise<any[]> {
    if (!this.restClient) {
      throw new Error(`${this.config.name} REST client not connected`);
    }

    try {
      const response = await this.restClient.get(`/cosmos/staking/v1beta1/delegations/${delegatorAddress}`);
      return response.data.delegation_responses;
    } catch (error) {
      logger.error(`Failed to get delegations for ${delegatorAddress}:`, error);
      throw error;
    }
  }

  async getStakingRewards(delegatorAddress: Address): Promise<any> {
    if (!this.restClient) {
      throw new Error(`${this.config.name} REST client not connected`);
    }

    try {
      const response = await this.restClient.get(`/cosmos/distribution/v1beta1/delegators/${delegatorAddress}/rewards`);
      return response.data;
    } catch (error) {
      logger.error(`Failed to get staking rewards for ${delegatorAddress}:`, error);
      throw error;
    }
  }

  async getGovernanceProposals(): Promise<any[]> {
    if (!this.restClient) {
      throw new Error(`${this.config.name} REST client not connected`);
    }

    try {
      const response = await this.restClient.get('/cosmos/gov/v1beta1/proposals');
      return response.data.proposals;
    } catch (error) {
      logger.error(`Failed to get governance proposals for ${this.config.name}:`, error);
      throw error;
    }
  }
}