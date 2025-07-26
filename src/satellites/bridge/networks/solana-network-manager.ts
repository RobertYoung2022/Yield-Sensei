/**
 * Solana Network Manager
 * Manages connections to Solana blockchain
 */

import {
  Connection,
  PublicKey,
  Transaction,
  SendOptions,
  Commitment,
  BlockheightBasedTransactionConfirmationStrategy,
  ParsedTransactionWithMeta,
  BlockResponse,
} from '@solana/web3.js';
import Logger from '../../../shared/logging/logger';
import { BaseNetworkManager } from './base-network-manager';
import {
  SolanaNetworkConfig,
  TransactionRequest,
  TransactionReceipt,
  GasEstimate,
  BlockInfo,
  TransactionHash,
  Address,
  BlockEvent,
} from './types';

const logger = Logger.getLogger('solana-network-manager');

export class SolanaNetworkManager extends BaseNetworkManager {
  private connection: Connection | null = null;
  private wsConnection: Connection | null = null;
  private blockSubscriptionId: number | null = null;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;

  constructor(config: SolanaNetworkConfig) {
    super(config);
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.warn(`${this.config.name} already initialized`);
      return;
    }

    try {
      logger.info(`Initializing Solana network manager for ${this.config.name}...`);

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

    // Start slot monitoring (Solana's equivalent of blocks)
    this.startSlotListener();

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
    this.stopSlotListener();
    this.stopHealthMonitoring();

    // Disconnect
    await this.disconnect();

    logger.info(`🛑 ${this.config.name} network manager stopped`);
  }

  async connect(): Promise<boolean> {
    try {
      const success = await this.attemptConnection();
      
      if (success && this.connection) {
        // Test the connection
        const slot = await this.connection.getSlot();
        const epochInfo = await this.connection.getEpochInfo();
        
        logger.info(`Connected to ${this.config.name}`, {
          slot,
          epoch: epochInfo.epoch,
        });

        this.connection.currentBlock = slot;
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
    this.stopSlotListener();
    
    if (this.connection) {
      // Solana connections don't need explicit disconnection
      this.connection = null;
    }
    
    if (this.wsConnection) {
      this.wsConnection = null;
    }

    this.connection.isConnected = false;
    logger.info(`Disconnected from ${this.config.name}`);
  }

  protected async connectToEndpoint(endpoint: string): Promise<boolean> {
    try {
      const config = this.config as SolanaNetworkConfig;
      
      // Create connection with proper commitment level
      this.connection = new Connection(endpoint, {
        commitment: config.commitment || 'confirmed',
        confirmTransactionInitialTimeout: 60000,
      });

      // Test connection with timeout
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Connection timeout')), 10000)
      );

      const testPromise = this.connection.getSlot();
      await Promise.race([testPromise, timeoutPromise]);

      // Create WebSocket connection for real-time updates
      try {
        this.wsConnection = new Connection(endpoint, {
          commitment: config.commitment || 'confirmed',
          wsEndpoint: endpoint.replace('https://', 'wss://').replace('http://', 'ws://'),
        });
      } catch (wsError) {
        logger.warn(`WebSocket connection failed for ${this.config.name}, using HTTP only:`, wsError);
      }

      return true;
    } catch (error) {
      logger.error(`Failed to connect to endpoint ${endpoint}:`, error);
      return false;
    }
  }

  async getCurrentBlock(): Promise<number> {
    if (!this.connection) {
      throw new Error(`${this.config.name} not connected`);
    }

    try {
      const slot = await this.connection.getSlot();
      this.connection.currentBlock = slot;
      return slot;
    } catch (error) {
      logger.error(`Failed to get current slot for ${this.config.name}:`, error);
      throw error;
    }
  }

  async getBlockInfo(blockNumber?: number): Promise<BlockInfo | null> {
    if (!this.connection) {
      throw new Error(`${this.config.name} not connected`);
    }

    try {
      const slot = blockNumber || await this.connection.getSlot();
      const block = await this.connection.getBlock(slot, {
        maxSupportedTransactionVersion: 0,
      });
      
      if (!block) return null;

      return {
        networkId: this.config.id,
        blockNumber: slot,
        blockHash: block.blockhash,
        parentHash: block.previousBlockhash,
        timestamp: (block.blockTime || 0) * 1000, // Convert to milliseconds
        transactionCount: block.transactions.length,
        validator: block.transactions[0]?.transaction.message.accountKeys[0]?.toBase58(),
      };
    } catch (error) {
      logger.error(`Failed to get block info for ${this.config.name}:`, error);
      return null;
    }
  }

  async sendTransaction(tx: TransactionRequest): Promise<TransactionHash> {
    if (!this.connection) {
      throw new Error(`${this.config.name} not connected`);
    }

    try {
      // Note: This is a simplified version. In practice, you'd need to:
      // 1. Create a proper Solana transaction from the request
      // 2. Sign it with the appropriate keypair
      // 3. Send it using the connection
      
      // For now, we'll throw an error indicating this needs implementation
      throw new Error('Transaction sending not implemented - requires proper transaction construction and signing');

      // Example implementation would look like:
      // const transaction = new Transaction();
      // // ... construct transaction from tx request
      // const signature = await this.connection.sendTransaction(transaction, [signer]);
      // this.incrementTransactionCount(true);
      // return signature;
      
    } catch (error) {
      this.incrementTransactionCount(false);
      logger.error(`Failed to send transaction on ${this.config.name}:`, error);
      throw error;
    }
  }

  async getTransactionReceipt(hash: TransactionHash): Promise<TransactionReceipt | null> {
    if (!this.connection) {
      throw new Error(`${this.config.name} not connected`);
    }

    try {
      const transaction = await this.connection.getParsedTransaction(hash, {
        maxSupportedTransactionVersion: 0,
      });

      if (!transaction) return null;

      const currentSlot = await this.getCurrentBlock();
      const confirmations = transaction.slot ? Math.max(0, currentSlot - transaction.slot) : 0;

      return {
        networkId: this.config.id,
        transactionHash: hash,
        blockNumber: transaction.slot || 0,
        blockHash: transaction.transaction.message.recentBlockhash || '',
        from: transaction.transaction.message.accountKeys?.[0]?.pubkey?.toBase58() || '',
        to: transaction.transaction.message.accountKeys?.[1]?.pubkey?.toBase58() || '',
        gasUsed: '0', // Solana uses compute units, not gas
        gasPrice: '0', // Solana has different fee structure
        status: transaction.meta?.err ? 'failed' : 'success',
        confirmations,
        timestamp: (transaction.blockTime || 0) * 1000,
        logs: transaction.meta?.logMessages,
      };
    } catch (error) {
      logger.error(`Failed to get transaction receipt for ${hash} on ${this.config.name}:`, error);
      return null;
    }
  }

  async estimateGas(tx: TransactionRequest): Promise<GasEstimate> {
    if (!this.connection) {
      throw new Error(`${this.config.name} not connected`);
    }

    try {
      // Get recent blockhash for fee estimation
      const { blockhash, feeCalculator } = await this.connection.getRecentBlockhash();
      
      // Solana uses compute units and lamports per signature
      // This is a simplified estimation
      const estimatedComputeUnits = 200000; // Default estimate
      const estimatedSignatures = 1;
      const estimatedCost = feeCalculator.lamportsPerSignature * estimatedSignatures;

      return {
        networkId: this.config.id,
        gasLimit: estimatedComputeUnits.toString(),
        gasPrice: feeCalculator.lamportsPerSignature.toString(),
        estimatedCost: estimatedCost.toString(),
        estimatedTime: this.config.blockTime,
        confidence: 0.8, // Lower confidence due to simplified estimation
        timestamp: Date.now(),
      };
    } catch (error) {
      logger.error(`Failed to estimate gas on ${this.config.name}:`, error);
      throw error;
    }
  }

  async getBalance(address: Address): Promise<string> {
    if (!this.connection) {
      throw new Error(`${this.config.name} not connected`);
    }

    try {
      const publicKey = new PublicKey(address);
      const balance = await this.connection.getBalance(publicKey);
      
      // Convert lamports to SOL (1 SOL = 1e9 lamports)
      return (balance / 1e9).toString();
    } catch (error) {
      logger.error(`Failed to get balance for ${address} on ${this.config.name}:`, error);
      throw error;
    }
  }

  isValidAddress(address: string): boolean {
    try {
      new PublicKey(address);
      return true;
    } catch {
      return false;
    }
  }

  // Private monitoring methods

  private startSlotListener(): void {
    if (!this.connection) return;

    const connectionForListener = this.wsConnection || this.connection;

    this.blockSubscriptionId = connectionForListener.onSlotChange((slotInfo) => {
      try {
        this.connection.currentBlock = slotInfo.slot;
        this.connection.lastUpdate = Date.now();

        const blockEvent: BlockEvent = {
          networkId: this.config.id,
          type: 'block',
          timestamp: Date.now(),
          data: {
            blockNumber: slotInfo.slot,
            blockHash: '', // Slot info doesn't include blockhash
            timestamp: Date.now(),
            transactionCount: 0, // Would need to fetch block for tx count
          },
        };

        this.emitEvent(blockEvent);
        
        logger.debug(`New slot on ${this.config.name}: ${slotInfo.slot}`);
      } catch (error) {
        logger.error(`Error processing slot ${slotInfo.slot} on ${this.config.name}:`, error);
      }
    });

    logger.info(`Slot listener started for ${this.config.name}`);
  }

  private stopSlotListener(): void {
    if (this.blockSubscriptionId && this.connection) {
      const connectionForListener = this.wsConnection || this.connection;
      connectionForListener.removeSlotChangeListener(this.blockSubscriptionId);
      this.blockSubscriptionId = null;
      logger.info(`Slot listener stopped for ${this.config.name}`);
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

  // Additional Solana-specific methods

  async getTokenBalance(tokenMintAddress: Address, holderAddress: Address): Promise<string> {
    if (!this.connection) {
      throw new Error(`${this.config.name} not connected`);
    }

    try {
      const holderPublicKey = new PublicKey(holderAddress);
      const tokenMintPublicKey = new PublicKey(tokenMintAddress);

      const tokenAccounts = await this.connection.getParsedTokenAccountsByOwner(
        holderPublicKey,
        { mint: tokenMintPublicKey }
      );

      if (tokenAccounts.value.length === 0) {
        return '0';
      }

      const tokenAccount = tokenAccounts.value[0];
      const balance = tokenAccount.account.data.parsed.info.tokenAmount;
      
      return balance.uiAmountString || '0';
    } catch (error) {
      logger.error(`Failed to get token balance for ${tokenMintAddress}:`, error);
      throw error;
    }
  }

  async getAccountInfo(address: Address): Promise<any> {
    if (!this.connection) {
      throw new Error(`${this.config.name} not connected`);
    }

    try {
      const publicKey = new PublicKey(address);
      return await this.connection.getAccountInfo(publicKey);
    } catch (error) {
      logger.error(`Failed to get account info for ${address}:`, error);
      throw error;
    }
  }

  async isContract(address: Address): Promise<boolean> {
    try {
      const accountInfo = await this.getAccountInfo(address);
      return accountInfo !== null && accountInfo.executable;
    } catch {
      return false;
    }
  }

  async getEpochInfo(): Promise<any> {
    if (!this.connection) {
      throw new Error(`${this.config.name} not connected`);
    }

    return this.connection.getEpochInfo();
  }

  async getInflationReward(addresses: Address[], epoch?: number): Promise<any> {
    if (!this.connection) {
      throw new Error(`${this.config.name} not connected`);
    }

    const publicKeys = addresses.map(addr => new PublicKey(addr));
    return this.connection.getInflationReward(publicKeys, epoch);
  }
}