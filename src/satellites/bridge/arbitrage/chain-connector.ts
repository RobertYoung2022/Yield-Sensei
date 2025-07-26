/**
 * Chain Connector Service
 * Manages connections to multiple blockchain networks and DEXs
 */

import { ethers } from 'ethers';
import Logger from '../../../shared/logging/logger';
import { ChainID, ChainConfig } from '../types';

const logger = Logger.getLogger('chain-connector');

export interface DEXConfig {
  name: string;
  chainId: ChainID;
  routerAddress: string;
  factoryAddress: string;
  type: 'uniswapV2' | 'uniswapV3' | 'sushiswap' | 'quickswap' | 'traderjoe' | 'pangolin';
  fee?: number; // For V3 pools
}

export interface ChainConnection {
  chainId: ChainID;
  provider: ethers.Provider;
  config: ChainConfig;
  blockNumber: number;
  gasPrice: bigint;
  lastUpdate: number;
  isConnected: boolean;
}

export interface GasEstimate {
  chainId: ChainID;
  gasPrice: bigint;
  baseFee?: bigint;
  priorityFee?: bigint;
  estimatedCost: bigint;
  timestamp: number;
}

export class ChainConnectorService {
  private connections: Map<ChainID, ChainConnection> = new Map();
  private dexConfigs: Map<string, DEXConfig> = new Map();
  private blockListeners: Map<ChainID, ethers.Listener> = new Map();
  private gasUpdateInterval: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor(
    private chainConfigs: ChainConfig[],
    private dexes: DEXConfig[]
  ) {
    // Initialize DEX configs
    for (const dex of dexes) {
      this.dexConfigs.set(`${dex.chainId}:${dex.name}`, dex);
    }
  }

  async initialize(): Promise<void> {
    try {
      logger.info('Initializing Chain Connector Service...');

      // Create providers for each chain
      for (const config of this.chainConfigs) {
        await this.connectToChain(config);
      }

      logger.info(`Connected to ${this.connections.size} chains`);
    } catch (error) {
      logger.error('Failed to initialize Chain Connector:', error);
      throw error;
    }
  }

  private async connectToChain(config: ChainConfig): Promise<void> {
    try {
      const provider = new ethers.JsonRpcProvider(config.rpcUrl);
      
      // Test connection
      const network = await provider.getNetwork();
      const blockNumber = await provider.getBlockNumber();
      const feeData = await provider.getFeeData();

      const connection: ChainConnection = {
        chainId: config.id,
        provider,
        config,
        blockNumber,
        gasPrice: feeData.gasPrice || BigInt(0),
        lastUpdate: Date.now(),
        isConnected: true,
      };

      this.connections.set(config.id, connection);
      
      logger.info(`Connected to ${config.name} (${config.id})`, {
        blockNumber,
        gasPrice: ethers.formatUnits(feeData.gasPrice || 0, 'gwei'),
      });
    } catch (error) {
      logger.error(`Failed to connect to ${config.name}:`, error);
      
      // Store failed connection
      this.connections.set(config.id, {
        chainId: config.id,
        provider: new ethers.JsonRpcProvider(config.rpcUrl),
        config,
        blockNumber: 0,
        gasPrice: BigInt(0),
        lastUpdate: Date.now(),
        isConnected: false,
      });
    }
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Chain Connector already running');
      return;
    }

    this.isRunning = true;

    // Start block listeners
    for (const [chainId, connection] of this.connections) {
      if (connection.isConnected) {
        this.startBlockListener(chainId);
      }
    }

    // Start gas price monitoring
    this.startGasMonitoring();

    logger.info('Chain Connector Service started');
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;

    // Remove block listeners
    for (const [chainId, listener] of this.blockListeners) {
      const connection = this.connections.get(chainId);
      if (connection) {
        connection.provider.off('block', listener);
      }
    }
    this.blockListeners.clear();

    // Stop gas monitoring
    if (this.gasUpdateInterval) {
      clearInterval(this.gasUpdateInterval);
      this.gasUpdateInterval = null;
    }

    logger.info('Chain Connector Service stopped');
  }

  private startBlockListener(chainId: ChainID): void {
    const connection = this.connections.get(chainId);
    if (!connection) return;

    const listener = async (blockNumber: number) => {
      connection.blockNumber = blockNumber;
      connection.lastUpdate = Date.now();
      
      logger.debug(`New block on ${chainId}: ${blockNumber}`);
    };

    connection.provider.on('block', listener);
    this.blockListeners.set(chainId, listener);
  }

  private startGasMonitoring(): void {
    const updateGasPrices = async () => {
      for (const [chainId, connection] of this.connections) {
        if (!connection.isConnected) continue;

        try {
          const feeData = await connection.provider.getFeeData();
          connection.gasPrice = feeData.gasPrice || BigInt(0);
          connection.lastUpdate = Date.now();
        } catch (error) {
          logger.error(`Failed to update gas price for ${chainId}:`, error);
        }
      }
    };

    // Initial update
    updateGasPrices();

    // Update every 15 seconds
    this.gasUpdateInterval = setInterval(updateGasPrices, 15000);
  }

  async getProvider(chainId: ChainID): Promise<ethers.Provider | null> {
    const connection = this.connections.get(chainId);
    return connection?.provider || null;
  }

  async getCurrentBlock(chainId: ChainID): Promise<number> {
    const connection = this.connections.get(chainId);
    if (!connection || !connection.isConnected) {
      return 0;
    }

    try {
      const blockNumber = await connection.provider.getBlockNumber();
      connection.blockNumber = blockNumber;
      return blockNumber;
    } catch (error) {
      logger.error(`Failed to get block number for ${chainId}:`, error);
      return connection.blockNumber;
    }
  }

  async getGasEstimate(chainId: ChainID, gasLimit: bigint = BigInt(300000)): Promise<GasEstimate> {
    const connection = this.connections.get(chainId);
    if (!connection || !connection.isConnected) {
      throw new Error(`Chain ${chainId} not connected`);
    }

    try {
      const feeData = await connection.provider.getFeeData();
      const gasPrice = feeData.gasPrice || BigInt(0);
      const estimatedCost = gasPrice * gasLimit;

      return {
        chainId,
        gasPrice,
        baseFee: feeData.maxFeePerGas,
        priorityFee: feeData.maxPriorityFeePerGas,
        estimatedCost,
        timestamp: Date.now(),
      };
    } catch (error) {
      logger.error(`Failed to estimate gas for ${chainId}:`, error);
      throw error;
    }
  }

  async getMultiChainGasEstimates(gasLimit: bigint = BigInt(300000)): Promise<Map<ChainID, GasEstimate>> {
    const estimates = new Map<ChainID, GasEstimate>();

    await Promise.all(
      Array.from(this.connections.keys()).map(async (chainId) => {
        try {
          const estimate = await this.getGasEstimate(chainId, gasLimit);
          estimates.set(chainId, estimate);
        } catch (error) {
          logger.error(`Failed to get gas estimate for ${chainId}:`, error);
        }
      })
    );

    return estimates;
  }

  async getDEXContract(
    chainId: ChainID,
    dexName: string,
    contractType: 'router' | 'factory'
  ): Promise<ethers.Contract | null> {
    const dexConfig = this.dexConfigs.get(`${chainId}:${dexName}`);
    if (!dexConfig) {
      logger.error(`DEX config not found: ${chainId}:${dexName}`);
      return null;
    }

    const provider = await this.getProvider(chainId);
    if (!provider) {
      logger.error(`Provider not found for chain: ${chainId}`);
      return null;
    }

    const address = contractType === 'router' ? dexConfig.routerAddress : dexConfig.factoryAddress;
    const abi = contractType === 'router' ? this.getRouterABI(dexConfig.type) : this.getFactoryABI(dexConfig.type);

    return new ethers.Contract(address, abi, provider);
  }

  private getRouterABI(dexType: string): any[] {
    // Simplified ABI for common DEX router functions
    return [
      'function getAmountsOut(uint amountIn, address[] memory path) public view returns (uint[] memory amounts)',
      'function getAmountsIn(uint amountOut, address[] memory path) public view returns (uint[] memory amounts)',
      'function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)',
      'function swapTokensForExactTokens(uint amountOut, uint amountInMax, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)',
      'function factory() external pure returns (address)',
      'function WETH() external pure returns (address)',
    ];
  }

  private getFactoryABI(dexType: string): any[] {
    // Simplified ABI for factory functions
    return [
      'function getPair(address tokenA, address tokenB) external view returns (address pair)',
      'function allPairs(uint) external view returns (address pair)',
      'function allPairsLength() external view returns (uint)',
    ];
  }

  async getTokenPairLiquidity(
    chainId: ChainID,
    dexName: string,
    tokenA: string,
    tokenB: string
  ): Promise<{ reserve0: bigint; reserve1: bigint; token0: string; token1: string } | null> {
    try {
      const factory = await this.getDEXContract(chainId, dexName, 'factory');
      if (!factory) return null;

      const pairAddress = await factory.getPair(tokenA, tokenB);
      if (pairAddress === ethers.ZeroAddress) {
        return null;
      }

      const provider = await this.getProvider(chainId);
      if (!provider) return null;

      const pairContract = new ethers.Contract(
        pairAddress,
        [
          'function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)',
          'function token0() external view returns (address)',
          'function token1() external view returns (address)',
        ],
        provider
      );

      const [reserves, token0, token1] = await Promise.all([
        pairContract.getReserves(),
        pairContract.token0(),
        pairContract.token1(),
      ]);

      return {
        reserve0: BigInt(reserves[0]),
        reserve1: BigInt(reserves[1]),
        token0,
        token1,
      };
    } catch (error) {
      logger.error(`Failed to get liquidity for ${tokenA}/${tokenB} on ${chainId}:${dexName}:`, error);
      return null;
    }
  }

  getConnectionStatus(): Map<ChainID, {
    isConnected: boolean;
    blockNumber: number;
    gasPrice: string;
    lastUpdate: number;
    latency?: number;
  }> {
    const status = new Map();

    for (const [chainId, connection] of this.connections) {
      status.set(chainId, {
        isConnected: connection.isConnected,
        blockNumber: connection.blockNumber,
        gasPrice: ethers.formatUnits(connection.gasPrice, 'gwei'),
        lastUpdate: connection.lastUpdate,
        latency: Date.now() - connection.lastUpdate,
      });
    }

    return status;
  }

  async reconnectChain(chainId: ChainID): Promise<boolean> {
    const connection = this.connections.get(chainId);
    if (!connection) return false;

    try {
      await this.connectToChain(connection.config);
      
      if (this.isRunning && !this.blockListeners.has(chainId)) {
        this.startBlockListener(chainId);
      }
      
      return true;
    } catch (error) {
      logger.error(`Failed to reconnect to ${chainId}:`, error);
      return false;
    }
  }

  getSupportedDEXs(chainId: ChainID): DEXConfig[] {
    const dexes: DEXConfig[] = [];
    
    for (const [key, dex] of this.dexConfigs) {
      if (dex.chainId === chainId) {
        dexes.push(dex);
      }
    }
    
    return dexes;
  }
}