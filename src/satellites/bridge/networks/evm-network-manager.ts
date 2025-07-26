/**
 * EVM Network Manager
 * Manages connections to EVM-compatible blockchains (Ethereum, Polygon, BSC, etc.)
 */

import { ethers } from 'ethers';
import Logger from '../../../shared/logging/logger';
import { BaseNetworkManager } from './base-network-manager';
import {
  EVMNetworkConfig,
  TransactionRequest,
  TransactionReceipt,
  GasEstimate,
  BlockInfo,
  TransactionHash,
  Address,
  BlockEvent,
  TransactionEvent,
} from './types';

const logger = Logger.getLogger('evm-network-manager');

export class EVMNetworkManager extends BaseNetworkManager {
  private provider: ethers.Provider | null = null;
  private wsProvider: ethers.Provider | null = null;
  private blockListener: ethers.Listener | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private gasUpdateInterval: NodeJS.Timeout | null = null;

  constructor(config: EVMNetworkConfig) {
    super(config);
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.warn(`${this.config.name} already initialized`);
      return;
    }

    try {
      logger.info(`Initializing EVM network manager for ${this.config.name}...`);

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

    // Start block monitoring
    this.startBlockListener();

    // Start gas price monitoring
    this.startGasMonitoring();

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
    this.stopBlockListener();
    this.stopGasMonitoring();
    this.stopHealthMonitoring();

    // Disconnect
    await this.disconnect();

    logger.info(`🛑 ${this.config.name} network manager stopped`);
  }

  async connect(): Promise<boolean> {
    try {
      const success = await this.attemptConnection();
      
      if (success && this.provider) {
        // Test the connection
        const network = await this.provider.getNetwork();
        const blockNumber = await this.provider.getBlockNumber();
        
        logger.info(`Connected to ${this.config.name}`, {
          chainId: network.chainId.toString(),
          blockNumber,
        });

        // Verify chain ID matches
        if (Number(network.chainId) !== (this.config as EVMNetworkConfig).chainId) {
          throw new Error(
            `Chain ID mismatch: expected ${(this.config as EVMNetworkConfig).chainId}, got ${network.chainId}`
          );
        }

        this.connection.currentBlock = blockNumber;
        this.connection.isConnected = true;
        this.connection.lastUpdate = Date.now();

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
    this.stopBlockListener();
    
    if (this.provider) {
      // Note: ethers providers don't have explicit disconnect methods
      this.provider = null;
    }
    
    if (this.wsProvider) {
      this.wsProvider = null;
    }

    this.connection.isConnected = false;
    logger.info(`Disconnected from ${this.config.name}`);
  }

  protected async connectToEndpoint(endpoint: string): Promise<boolean> {
    try {
      // Create HTTP provider
      this.provider = new ethers.JsonRpcProvider(endpoint, {
        chainId: (this.config as EVMNetworkConfig).chainId,
        name: this.config.name,
      });

      // Test connection with timeout
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Connection timeout')), 10000)
      );

      const testPromise = this.provider.getBlockNumber();
      await Promise.race([testPromise, timeoutPromise]);

      // Try to connect WebSocket if available
      if (this.config.wsUrls && this.config.wsUrls.length > 0) {
        try {
          const wsEndpoint = this.config.wsUrls[this.connection.failoverIndex] || this.config.wsUrls[0];
          this.wsProvider = new ethers.WebSocketProvider(wsEndpoint, {
            chainId: (this.config as EVMNetworkConfig).chainId,
            name: this.config.name,
          });
        } catch (wsError) {
          logger.warn(`WebSocket connection failed for ${this.config.name}, using HTTP only:`, wsError);
        }
      }

      return true;
    } catch (error) {
      logger.error(`Failed to connect to endpoint ${endpoint}:`, error);
      return false;
    }
  }

  async getCurrentBlock(): Promise<number> {
    if (!this.provider) {
      throw new Error(`${this.config.name} not connected`);
    }

    try {
      const blockNumber = await this.provider.getBlockNumber();
      this.connection.currentBlock = blockNumber;
      return blockNumber;
    } catch (error) {
      logger.error(`Failed to get current block for ${this.config.name}:`, error);
      throw error;
    }
  }

  async getBlockInfo(blockNumber?: number): Promise<BlockInfo | null> {
    if (!this.provider) {
      throw new Error(`${this.config.name} not connected`);
    }

    try {
      const block = await this.provider.getBlock(blockNumber || 'latest');
      if (!block) return null;

      return {
        networkId: this.config.id,
        blockNumber: block.number,
        blockHash: block.hash,
        parentHash: block.parentHash,
        timestamp: block.timestamp * 1000, // Convert to milliseconds
        gasLimit: block.gasLimit?.toString(),
        gasUsed: block.gasUsed?.toString(),
        baseFeePerGas: block.baseFeePerGas?.toString(),
        transactionCount: block.transactions.length,
        validator: block.miner,
      };
    } catch (error) {
      logger.error(`Failed to get block info for ${this.config.name}:`, error);
      return null;
    }
  }

  async sendTransaction(tx: TransactionRequest): Promise<TransactionHash> {
    if (!this.provider) {
      throw new Error(`${this.config.name} not connected`);
    }

    try {
      // Convert transaction request to ethers format
      const ethersTransaction: ethers.TransactionRequest = {
        to: tx.to,
        value: tx.value ? ethers.parseEther(tx.value) : undefined,
        data: tx.data,
        gasLimit: tx.gasLimit ? BigInt(tx.gasLimit) : undefined,
        gasPrice: tx.gasPrice ? BigInt(tx.gasPrice) : undefined,
        maxFeePerGas: tx.maxFeePerGas ? BigInt(tx.maxFeePerGas) : undefined,
        maxPriorityFeePerGas: tx.maxPriorityFeePerGas ? BigInt(tx.maxPriorityFeePerGas) : undefined,
        nonce: tx.nonce,
        type: tx.type,
      };

      // Note: This is a simplified version. In practice, you'd need a wallet/signer
      // to actually send transactions. This would typically be handled by the caller.
      const response = await this.provider.broadcastTransaction(
        ethers.Transaction.from(ethersTransaction).serialized
      );

      this.incrementTransactionCount(true);

      return response.hash;
    } catch (error) {
      this.incrementTransactionCount(false);
      logger.error(`Failed to send transaction on ${this.config.name}:`, error);
      throw error;
    }
  }

  async getTransactionReceipt(hash: TransactionHash): Promise<TransactionReceipt | null> {
    if (!this.provider) {
      throw new Error(`${this.config.name} not connected`);
    }

    try {
      const receipt = await this.provider.getTransactionReceipt(hash);
      if (!receipt) return null;

      const currentBlock = await this.getCurrentBlock();
      const confirmations = Math.max(0, currentBlock - receipt.blockNumber);

      return {
        networkId: this.config.id,
        transactionHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        blockHash: receipt.blockHash,
        from: receipt.from,
        to: receipt.to || '',
        gasUsed: receipt.gasUsed.toString(),
        gasPrice: receipt.gasPrice?.toString() || '0',
        status: receipt.status === 1 ? 'success' : 'failed',
        confirmations,
        timestamp: Date.now(), // Would need to get from block
        logs: receipt.logs,
      };
    } catch (error) {
      logger.error(`Failed to get transaction receipt for ${hash} on ${this.config.name}:`, error);
      return null;
    }
  }

  async estimateGas(tx: TransactionRequest): Promise<GasEstimate> {
    if (!this.provider) {
      throw new Error(`${this.config.name} not connected`);
    }

    try {
      const ethersTransaction = {
        to: tx.to,
        value: tx.value ? ethers.parseEther(tx.value) : undefined,
        data: tx.data,
        from: tx.from,
      };

      const [gasLimit, feeData] = await Promise.all([
        this.provider.estimateGas(ethersTransaction),
        this.provider.getFeeData(),
      ]);

      const gasPrice = feeData.gasPrice || BigInt(0);
      const estimatedCost = gasLimit * gasPrice;

      return {
        networkId: this.config.id,
        gasLimit: gasLimit.toString(),
        gasPrice: gasPrice.toString(),
        maxFeePerGas: feeData.maxFeePerGas?.toString(),
        maxPriorityFeePerGas: feeData.maxPriorityFeePerGas?.toString(),
        estimatedCost: estimatedCost.toString(),
        estimatedTime: this.config.blockTime,
        confidence: 0.9,
        timestamp: Date.now(),
      };
    } catch (error) {
      logger.error(`Failed to estimate gas on ${this.config.name}:`, error);
      throw error;
    }
  }

  async getBalance(address: Address): Promise<string> {
    if (!this.provider) {
      throw new Error(`${this.config.name} not connected`);
    }

    try {
      const balance = await this.provider.getBalance(address);
      return ethers.formatEther(balance);
    } catch (error) {
      logger.error(`Failed to get balance for ${address} on ${this.config.name}:`, error);
      throw error;
    }
  }

  isValidAddress(address: string): boolean {
    return ethers.isAddress(address);
  }

  // Private monitoring methods

  private startBlockListener(): void {
    if (!this.provider || this.blockListener) return;

    this.blockListener = async (blockNumber: number) => {
      try {
        this.connection.currentBlock = blockNumber;
        this.connection.lastUpdate = Date.now();

        const blockEvent: BlockEvent = {
          networkId: this.config.id,
          type: 'block',
          timestamp: Date.now(),
          data: {
            blockNumber,
            blockHash: '', // Would need to fetch block for hash
            timestamp: Date.now(),
            transactionCount: 0, // Would need to fetch block for tx count
          },
        };

        this.emitEvent(blockEvent);
        
        logger.debug(`New block on ${this.config.name}: ${blockNumber}`);
      } catch (error) {
        logger.error(`Error processing block ${blockNumber} on ${this.config.name}:`, error);
      }
    };

    // Use WebSocket provider if available, otherwise HTTP
    const providerForListener = this.wsProvider || this.provider;
    providerForListener.on('block', this.blockListener);

    logger.info(`Block listener started for ${this.config.name}`);
  }

  private stopBlockListener(): void {
    if (this.blockListener && this.provider) {
      const providerForListener = this.wsProvider || this.provider;
      providerForListener.off('block', this.blockListener);
      this.blockListener = null;
      logger.info(`Block listener stopped for ${this.config.name}`);
    }
  }

  private startGasMonitoring(): void {
    const updateGasPrice = async () => {
      if (!this.provider || !this.isRunning) return;

      try {
        const feeData = await this.provider.getFeeData();
        
        if (feeData.gasPrice) {
          this.connection.gasPrice = feeData.gasPrice.toString();
          this.stats.averageGasPrice = ethers.formatUnits(feeData.gasPrice, 'gwei');
        }

        if (feeData.maxFeePerGas) {
          this.connection.baseFee = feeData.maxFeePerGas.toString();
        }

        if (feeData.maxPriorityFeePerGas) {
          this.connection.priorityFee = feeData.maxPriorityFeePerGas.toString();
        }

      } catch (error) {
        logger.error(`Failed to update gas price for ${this.config.name}:`, error);
      }
    };

    // Initial update
    updateGasPrice();

    // Update every 15 seconds
    this.gasUpdateInterval = setInterval(updateGasPrice, 15000);
  }

  private stopGasMonitoring(): void {
    if (this.gasUpdateInterval) {
      clearInterval(this.gasUpdateInterval);
      this.gasUpdateInterval = null;
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
    setInterval(performHealthCheck, 30000);
  }

  private stopHealthMonitoring(): void {
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

  // Additional EVM-specific methods

  async getTokenBalance(tokenAddress: Address, holderAddress: Address): Promise<string> {
    if (!this.provider) {
      throw new Error(`${this.config.name} not connected`);
    }

    try {
      const tokenContract = new ethers.Contract(
        tokenAddress,
        [
          'function balanceOf(address owner) view returns (uint256)',
          'function decimals() view returns (uint8)',
        ],
        this.provider
      );

      const [balance, decimals] = await Promise.all([
        tokenContract.balanceOf(holderAddress),
        tokenContract.decimals(),
      ]);

      return ethers.formatUnits(balance, decimals);
    } catch (error) {
      logger.error(`Failed to get token balance for ${tokenAddress}:`, error);
      throw error;
    }
  }

  async getContractCode(address: Address): Promise<string> {
    if (!this.provider) {
      throw new Error(`${this.config.name} not connected`);
    }

    return this.provider.getCode(address);
  }

  async isContract(address: Address): Promise<boolean> {
    const code = await this.getContractCode(address);
    return code !== '0x';
  }
}