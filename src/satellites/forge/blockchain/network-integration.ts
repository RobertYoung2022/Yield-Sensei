import { ethers, BigNumber } from 'ethers';

export interface NetworkConfig {
  chainId: number;
  name: string;
  rpcUrls: string[];
  fallbackRpcUrls: string[];
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  blockExplorerUrls: string[];
  iconUrls?: string[];
  maxRetries: number;
  retryDelay: number;
  timeout: number;
  rateLimitPerSecond: number;
  gasPrice?: {
    min: BigNumber;
    max: BigNumber;
    multiplier: number;
  };
}

export interface NetworkStatus {
  chainId: number;
  isConnected: boolean;
  blockNumber: number;
  gasPrice: BigNumber;
  lastBlockTime: number;
  latency: number;
  health: 'healthy' | 'degraded' | 'down';
  providerUrl: string;
  errorCount: number;
  lastError?: string;
}

export interface TransactionRequest {
  to?: string;
  from?: string;
  value?: BigNumber;
  data?: string;
  gasLimit?: BigNumber;
  gasPrice?: BigNumber;
  maxFeePerGas?: BigNumber;
  maxPriorityFeePerGas?: BigNumber;
  nonce?: number;
  type?: number;
  chainId?: number;
}

export interface TransactionResult {
  hash: string;
  blockNumber?: number;
  gasUsed?: BigNumber;
  effectiveGasPrice?: BigNumber;
  status: 'pending' | 'confirmed' | 'failed';
  receipt?: ethers.providers.TransactionReceipt;
  error?: string;
}

export interface EventFilter {
  address?: string;
  topics?: Array<string | string[]>;
  fromBlock?: number | string;
  toBlock?: number | string;
}

export interface ContractInteraction {
  address: string;
  abi: any[];
  functionName: string;
  parameters: any[];
  value?: BigNumber;
  gasLimit?: BigNumber;
}

export class NetworkIntegrationManager {
  private providers: Map<number, ethers.providers.JsonRpcProvider[]> = new Map();
  private activeProviders: Map<number, ethers.providers.JsonRpcProvider> = new Map();
  private networkConfigs: Map<number, NetworkConfig> = new Map();
  private networkStatus: Map<number, NetworkStatus> = new Map();
  private rateLimiters: Map<string, RateLimiter> = new Map();
  private eventListeners: Map<string, EventListener[]> = new Map();

  constructor() {
    this.initializeNetworks();
    this.startHealthMonitoring();
  }

  /**
   * Add a new network configuration
   */
  addNetwork(config: NetworkConfig): void {
    this.networkConfigs.set(config.chainId, config);
    this.initializeNetworkProviders(config);
  }

  /**
   * Get provider for a specific chain
   */
  getProvider(chainId: number): ethers.providers.JsonRpcProvider {
    const provider = this.activeProviders.get(chainId);
    if (!provider) {
      throw new Error(`No active provider for chain ${chainId}`);
    }
    return provider;
  }

  /**
   * Switch to a different network
   */
  async switchNetwork(chainId: number): Promise<void> {
    const config = this.networkConfigs.get(chainId);
    if (!config) {
      throw new Error(`Network ${chainId} not configured`);
    }

    const provider = await this.findHealthyProvider(chainId);
    if (!provider) {
      throw new Error(`No healthy provider available for chain ${chainId}`);
    }

    this.activeProviders.set(chainId, provider);
    await this.updateNetworkStatus(chainId);
  }

  /**
   * Execute transaction with automatic retry and fallback
   */
  async executeTransaction(
    chainId: number,
    transaction: TransactionRequest,
    signer: ethers.Signer
  ): Promise<TransactionResult> {
    const config = this.networkConfigs.get(chainId);
    if (!config) {
      throw new Error(`Network ${chainId} not configured`);
    }

    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt < config.maxRetries; attempt++) {
      try {
        const provider = await this.getHealthyProvider(chainId);
        const connectedSigner = signer.connect(provider);

        // Apply rate limiting
        await this.applyRateLimit(chainId);

        // Enhance transaction with network-specific parameters
        const enhancedTx = await this.enhanceTransaction(transaction, chainId);

        // Execute transaction
        const txResponse = await connectedSigner.sendTransaction(enhancedTx);
        
        return {
          hash: txResponse.hash,
          status: 'pending'
        };
      } catch (error) {
        lastError = error as Error;
        console.error(`Transaction attempt ${attempt + 1} failed:`, error);
        
        // Try fallback provider if available
        await this.rotateProvider(chainId);
        
        if (attempt < config.maxRetries - 1) {
          await this.sleep(config.retryDelay * Math.pow(2, attempt));
        }
      }
    }

    throw lastError || new Error('Transaction failed after all retries');
  }

  /**
   * Wait for transaction confirmation
   */
  async waitForConfirmation(
    chainId: number,
    txHash: string,
    confirmations: number = 1,
    timeout: number = 300000
  ): Promise<TransactionResult> {
    const provider = this.getProvider(chainId);
    
    try {
      const receipt = await provider.waitForTransaction(txHash, confirmations, timeout);
      
      return {
        hash: txHash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed,
        effectiveGasPrice: receipt.effectiveGasPrice || BigNumber.from(0),
        status: receipt.status === 1 ? 'confirmed' : 'failed',
        receipt
      };
    } catch (error) {
      return {
        hash: txHash,
        status: 'failed',
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Call contract function (read-only)
   */
  async callContract(
    chainId: number,
    interaction: ContractInteraction
  ): Promise<any> {
    const provider = await this.getHealthyProvider(chainId);
    const contract = new ethers.Contract(interaction.address, interaction.abi, provider);
    
    await this.applyRateLimit(chainId);
    
    try {
      const result = await contract[interaction.functionName](...interaction.parameters);
      return result;
    } catch (error) {
      console.error(`Contract call failed:`, error);
      throw error;
    }
  }

  /**
   * Send contract transaction
   */
  async sendContractTransaction(
    chainId: number,
    interaction: ContractInteraction,
    signer: ethers.Signer
  ): Promise<TransactionResult> {
    const provider = await this.getHealthyProvider(chainId);
    const connectedSigner = signer.connect(provider);
    const contract = new ethers.Contract(interaction.address, interaction.abi, connectedSigner);
    
    await this.applyRateLimit(chainId);
    
    try {
      const tx = await contract[interaction.functionName](...interaction.parameters, {
        value: interaction.value || 0,
        gasLimit: interaction.gasLimit
      });
      
      return {
        hash: tx.hash,
        status: 'pending'
      };
    } catch (error) {
      return {
        hash: '',
        status: 'failed',
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Listen for events
   */
  async addEventListener(
    chainId: number,
    filter: EventFilter,
    callback: (event: any) => void
  ): Promise<string> {
    const provider = this.getProvider(chainId);
    const listener = new EventListener(provider, filter, callback);
    
    const listenerId = `${chainId}-${Date.now()}-${Math.random()}`;
    
    if (!this.eventListeners.has(listenerId)) {
      this.eventListeners.set(listenerId, []);
    }
    this.eventListeners.get(listenerId)!.push(listener);
    
    await listener.start();
    return listenerId;
  }

  /**
   * Remove event listener
   */
  async removeEventListener(listenerId: string): Promise<void> {
    const listeners = this.eventListeners.get(listenerId);
    if (listeners) {
      for (const listener of listeners) {
        await listener.stop();
      }
      this.eventListeners.delete(listenerId);
    }
  }

  /**
   * Get network status
   */
  getNetworkStatus(chainId: number): NetworkStatus | null {
    return this.networkStatus.get(chainId) || null;
  }

  /**
   * Get all network statuses
   */
  getAllNetworkStatus(): Map<number, NetworkStatus> {
    return new Map(this.networkStatus);
  }

  /**
   * Estimate gas for transaction
   */
  async estimateGas(
    chainId: number,
    transaction: TransactionRequest
  ): Promise<BigNumber> {
    const provider = await this.getHealthyProvider(chainId);
    await this.applyRateLimit(chainId);
    
    try {
      return await provider.estimateGas(transaction);
    } catch (error) {
      console.error('Gas estimation failed:', error);
      // Return a reasonable default
      return BigNumber.from('21000');
    }
  }

  /**
   * Get current gas price
   */
  async getGasPrice(chainId: number): Promise<BigNumber> {
    const provider = await this.getHealthyProvider(chainId);
    await this.applyRateLimit(chainId);
    
    try {
      return await provider.getGasPrice();
    } catch (error) {
      console.error('Gas price fetch failed:', error);
      throw error;
    }
  }

  /**
   * Get account balance
   */
  async getBalance(chainId: number, address: string): Promise<BigNumber> {
    const provider = await this.getHealthyProvider(chainId);
    await this.applyRateLimit(chainId);
    
    try {
      return await provider.getBalance(address);
    } catch (error) {
      console.error('Balance fetch failed:', error);
      throw error;
    }
  }

  /**
   * Get transaction count (nonce)
   */
  async getTransactionCount(chainId: number, address: string): Promise<number> {
    const provider = await this.getHealthyProvider(chainId);
    await this.applyRateLimit(chainId);
    
    try {
      return await provider.getTransactionCount(address, 'pending');
    } catch (error) {
      console.error('Nonce fetch failed:', error);
      throw error;
    }
  }

  private initializeNetworks(): void {
    const networks: NetworkConfig[] = [
      {
        chainId: 1,
        name: 'Ethereum Mainnet',
        rpcUrls: [
          'https://eth-mainnet.alchemyapi.io/v2/your-api-key',
          'https://mainnet.infura.io/v3/your-project-id'
        ],
        fallbackRpcUrls: [
          'https://rpc.ankr.com/eth',
          'https://ethereum.publicnode.com'
        ],
        nativeCurrency: {
          name: 'Ether',
          symbol: 'ETH',
          decimals: 18
        },
        blockExplorerUrls: ['https://etherscan.io'],
        maxRetries: 3,
        retryDelay: 1000,
        timeout: 30000,
        rateLimitPerSecond: 10,
        gasPrice: {
          min: ethers.utils.parseUnits('1', 'gwei'),
          max: ethers.utils.parseUnits('500', 'gwei'),
          multiplier: 1.1
        }
      },
      {
        chainId: 137,
        name: 'Polygon',
        rpcUrls: [
          'https://polygon-mainnet.alchemyapi.io/v2/your-api-key',
          'https://polygon-rpc.com'
        ],
        fallbackRpcUrls: [
          'https://rpc.ankr.com/polygon',
          'https://polygon.publicnode.com'
        ],
        nativeCurrency: {
          name: 'MATIC',
          symbol: 'MATIC',
          decimals: 18
        },
        blockExplorerUrls: ['https://polygonscan.com'],
        maxRetries: 3,
        retryDelay: 500,
        timeout: 20000,
        rateLimitPerSecond: 15,
        gasPrice: {
          min: ethers.utils.parseUnits('1', 'gwei'),
          max: ethers.utils.parseUnits('100', 'gwei'),
          multiplier: 1.2
        }
      },
      {
        chainId: 42161,
        name: 'Arbitrum One',
        rpcUrls: [
          'https://arb-mainnet.alchemyapi.io/v2/your-api-key',
          'https://arb1.arbitrum.io/rpc'
        ],
        fallbackRpcUrls: [
          'https://rpc.ankr.com/arbitrum',
          'https://arbitrum.publicnode.com'
        ],
        nativeCurrency: {
          name: 'Ether',
          symbol: 'ETH',
          decimals: 18
        },
        blockExplorerUrls: ['https://arbiscan.io'],
        maxRetries: 3,
        retryDelay: 800,
        timeout: 25000,
        rateLimitPerSecond: 12
      }
    ];

    networks.forEach(config => {
      this.networkConfigs.set(config.chainId, config);
      this.initializeNetworkProviders(config);
    });
  }

  private initializeNetworkProviders(config: NetworkConfig): void {
    const providers: ethers.providers.JsonRpcProvider[] = [];
    
    // Primary providers
    config.rpcUrls.forEach(url => {
      const provider = new ethers.providers.JsonRpcProvider({
        url,
        timeout: config.timeout
      });
      providers.push(provider);
    });
    
    // Fallback providers
    config.fallbackRpcUrls.forEach(url => {
      const provider = new ethers.providers.JsonRpcProvider({
        url,
        timeout: config.timeout
      });
      providers.push(provider);
    });
    
    this.providers.set(config.chainId, providers);
    
    // Set first provider as active initially
    if (providers.length > 0) {
      this.activeProviders.set(config.chainId, providers[0]);
    }

    // Initialize rate limiter
    const rateLimiter = new RateLimiter(config.rateLimitPerSecond);
    this.rateLimiters.set(config.chainId.toString(), rateLimiter);
  }

  private async findHealthyProvider(chainId: number): Promise<ethers.providers.JsonRpcProvider | null> {
    const providers = this.providers.get(chainId);
    if (!providers) return null;

    for (const provider of providers) {
      try {
        // Test provider health
        await provider.getBlockNumber();
        return provider;
      } catch (error) {
        console.error(`Provider ${provider.connection.url} unhealthy:`, error);
      }
    }

    return null;
  }

  private async getHealthyProvider(chainId: number): Promise<ethers.providers.JsonRpcProvider> {
    const activeProvider = this.activeProviders.get(chainId);
    
    if (activeProvider) {
      try {
        // Quick health check
        await activeProvider.getBlockNumber();
        return activeProvider;
      } catch (error) {
        console.error('Active provider failed, finding fallback:', error);
      }
    }

    const healthyProvider = await this.findHealthyProvider(chainId);
    if (!healthyProvider) {
      throw new Error(`No healthy provider available for chain ${chainId}`);
    }

    this.activeProviders.set(chainId, healthyProvider);
    return healthyProvider;
  }

  private async rotateProvider(chainId: number): Promise<void> {
    const providers = this.providers.get(chainId);
    if (!providers || providers.length <= 1) return;

    const currentProvider = this.activeProviders.get(chainId);
    const currentIndex = providers.indexOf(currentProvider!);
    const nextIndex = (currentIndex + 1) % providers.length;
    
    this.activeProviders.set(chainId, providers[nextIndex]);
  }

  private async enhanceTransaction(
    transaction: TransactionRequest,
    chainId: number
  ): Promise<TransactionRequest> {
    const config = this.networkConfigs.get(chainId);
    if (!config) return transaction;

    const enhanced = { ...transaction };

    // Set chain ID if not present
    if (!enhanced.chainId) {
      enhanced.chainId = chainId;
    }

    // Estimate gas if not provided
    if (!enhanced.gasLimit) {
      try {
        enhanced.gasLimit = await this.estimateGas(chainId, transaction);
      } catch (error) {
        console.warn('Gas estimation failed, using default:', error);
        enhanced.gasLimit = BigNumber.from('21000');
      }
    }

    // Set gas price if not provided
    if (!enhanced.gasPrice && !enhanced.maxFeePerGas) {
      try {
        const gasPrice = await this.getGasPrice(chainId);
        
        if (config.gasPrice) {
          const adjustedGasPrice = gasPrice.mul(Math.floor(config.gasPrice.multiplier * 100)).div(100);
          enhanced.gasPrice = BigNumber.from(Math.max(
            adjustedGasPrice.toNumber(),
            config.gasPrice.min.toNumber()
          ));
          
          if (enhanced.gasPrice.gt(config.gasPrice.max)) {
            enhanced.gasPrice = config.gasPrice.max;
          }
        } else {
          enhanced.gasPrice = gasPrice;
        }
      } catch (error) {
        console.warn('Gas price fetch failed:', error);
      }
    }

    return enhanced;
  }

  private async applyRateLimit(chainId: number): Promise<void> {
    const rateLimiter = this.rateLimiters.get(chainId.toString());
    if (rateLimiter) {
      await rateLimiter.acquire();
    }
  }

  private async updateNetworkStatus(chainId: number): Promise<void> {
    const provider = this.activeProviders.get(chainId);
    if (!provider) return;

    try {
      const startTime = Date.now();
      const blockNumber = await provider.getBlockNumber();
      const gasPrice = await provider.getGasPrice();
      const latency = Date.now() - startTime;

      const status: NetworkStatus = {
        chainId,
        isConnected: true,
        blockNumber,
        gasPrice,
        lastBlockTime: Date.now(),
        latency,
        health: latency < 1000 ? 'healthy' : latency < 5000 ? 'degraded' : 'down',
        providerUrl: provider.connection.url,
        errorCount: 0
      };

      this.networkStatus.set(chainId, status);
    } catch (error) {
      const currentStatus = this.networkStatus.get(chainId);
      const errorCount = (currentStatus?.errorCount || 0) + 1;

      const status: NetworkStatus = {
        chainId,
        isConnected: false,
        blockNumber: currentStatus?.blockNumber || 0,
        gasPrice: currentStatus?.gasPrice || BigNumber.from(0),
        lastBlockTime: currentStatus?.lastBlockTime || Date.now(),
        latency: 999999,
        health: 'down',
        providerUrl: provider.connection.url,
        errorCount,
        lastError: error instanceof Error ? error.message : String(error)
      };

      this.networkStatus.set(chainId, status);
    }
  }

  private startHealthMonitoring(): void {
    setInterval(async () => {
      for (const chainId of this.networkConfigs.keys()) {
        await this.updateNetworkStatus(chainId);
      }
    }, 30000); // Update every 30 seconds
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

class RateLimiter {
  private tokens: number;
  private maxTokens: number;
  private refillRate: number;
  private lastRefill: number;

  constructor(requestsPerSecond: number) {
    this.maxTokens = requestsPerSecond;
    this.tokens = requestsPerSecond;
    this.refillRate = requestsPerSecond;
    this.lastRefill = Date.now();
  }

  async acquire(): Promise<void> {
    this.refill();
    
    if (this.tokens < 1) {
      const waitTime = (1 - this.tokens) * (1000 / this.refillRate);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      this.refill();
    }
    
    this.tokens -= 1;
  }

  private refill(): void {
    const now = Date.now();
    const timePassed = (now - this.lastRefill) / 1000;
    this.tokens = Math.min(this.maxTokens, this.tokens + (timePassed * this.refillRate));
    this.lastRefill = now;
  }
}

class EventListener {
  private provider: ethers.providers.JsonRpcProvider;
  private filter: EventFilter;
  private callback: (event: any) => void;
  private isActive: boolean = false;

  constructor(
    provider: ethers.providers.JsonRpcProvider,
    filter: EventFilter,
    callback: (event: any) => void
  ) {
    this.provider = provider;
    this.filter = filter;
    this.callback = callback;
  }

  async start(): Promise<void> {
    if (this.isActive) return;
    
    this.isActive = true;
    
    try {
      this.provider.on(this.filter, this.callback);
    } catch (error) {
      console.error('Failed to start event listener:', error);
      this.isActive = false;
    }
  }

  async stop(): Promise<void> {
    if (!this.isActive) return;
    
    this.isActive = false;
    
    try {
      this.provider.off(this.filter, this.callback);
    } catch (error) {
      console.error('Failed to stop event listener:', error);
    }
  }
}