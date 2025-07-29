/**
 * Mock External API Services
 * Provides mock implementations of external APIs and services for testing
 */

import { EventEmitter } from 'events';
import { testDataFactory, TestDataFactory } from '../data/test-data-factory';

// ========================================
// BLOCKCHAIN NODE MOCKS
// ========================================

export interface BlockchainNodeMock {
  chainId: string;
  name: string;
  rpcUrl: string;
  status: 'connected' | 'disconnected' | 'syncing' | 'error';
  latency: number;
  blockHeight: number;
}

export class MockEthereumNode extends EventEmitter implements BlockchainNodeMock {
  public chainId = '1';
  public name = 'Ethereum Mainnet Mock';
  public rpcUrl = 'http://localhost:8545';
  public status: 'connected' | 'disconnected' | 'syncing' | 'error' = 'disconnected';
  public latency = 0;
  public blockHeight = 0;

  private simulationInterval?: NodeJS.Timeout;

  constructor(private dataFactory: TestDataFactory = testDataFactory) {
    super();
  }

  async connect(): Promise<void> {
    this.status = 'syncing';
    this.latency = 50 + Math.random() * 100;
    this.blockHeight = 18000000 + Math.floor(Math.random() * 100000);
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    this.status = 'connected';
    this.startBlockSimulation();
    this.emit('connected', { chainId: this.chainId });
  }

  async disconnect(): Promise<void> {
    this.status = 'disconnected';
    if (this.simulationInterval) {
      clearInterval(this.simulationInterval);
    }
    this.emit('disconnected', { chainId: this.chainId });
  }

  async getBlock(blockNumber: number | 'latest'): Promise<any> {
    if (this.status !== 'connected') {
      throw new Error('Node not connected');
    }

    const blockNum = blockNumber === 'latest' ? this.blockHeight : blockNumber;
    await this.simulateLatency();

    return {
      number: blockNum,
      hash: `0x${Math.random().toString(16).substring(2, 66)}`,
      timestamp: Date.now() - (this.blockHeight - blockNum) * 12000, // 12 sec blocks
      transactions: this.generateMockTransactions(10 + Math.floor(Math.random() * 200)),
      gasUsed: 10000000 + Math.random() * 20000000,
      gasLimit: 30000000
    };
  }

  async getTransaction(txHash: string): Promise<any> {
    if (this.status !== 'connected') {
      throw new Error('Node not connected');
    }

    await this.simulateLatency();

    return {
      hash: txHash,
      blockNumber: this.blockHeight - Math.floor(Math.random() * 10),
      from: `0x${Math.random().toString(16).substring(2, 42)}`,
      to: `0x${Math.random().toString(16).substring(2, 42)}`,
      value: Math.floor(Math.random() * 1000000000000000000).toString(),
      gasPrice: (20 + Math.random() * 100).toString(),
      gasUsed: (21000 + Math.random() * 200000).toString(),
      status: Math.random() > 0.05 ? 1 : 0 // 95% success rate
    };
  }

  async getBalance(address: string): Promise<string> {
    if (this.status !== 'connected') {
      throw new Error('Node not connected');
    }

    await this.simulateLatency();
    return Math.floor(Math.random() * 1000000000000000000).toString();
  }

  async sendRawTransaction(signedTx: string): Promise<string> {
    if (this.status !== 'connected') {
      throw new Error('Node not connected');
    }

    await this.simulateLatency();
    
    // Simulate occasional failures
    if (Math.random() < 0.02) {
      throw new Error('Transaction rejected');
    }

    const txHash = `0x${Math.random().toString(16).substring(2, 66)}`;
    
    // Simulate confirmation after delay
    setTimeout(() => {
      this.emit('transaction_confirmed', { hash: txHash, blockNumber: this.blockHeight });
    }, 15000 + Math.random() * 45000); // 15-60 seconds

    return txHash;
  }

  async estimateGas(transaction: any): Promise<string> {
    if (this.status !== 'connected') {
      throw new Error('Node not connected');
    }

    await this.simulateLatency();
    return (21000 + Math.random() * 200000).toString();
  }

  private startBlockSimulation(): void {
    this.simulationInterval = setInterval(() => {
      this.blockHeight++;
      this.emit('new_block', {
        number: this.blockHeight,
        hash: `0x${Math.random().toString(16).substring(2, 66)}`,
        timestamp: Date.now()
      });
    }, 12000); // New block every 12 seconds
  }

  private async simulateLatency(): Promise<void> {
    const delay = this.latency + Math.random() * 50;
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  private generateMockTransactions(count: number): string[] {
    return Array(count).fill(null).map(() => 
      `0x${Math.random().toString(16).substring(2, 66)}`
    );
  }
}

export class MockPolygonNode extends MockEthereumNode {
  public chainId = '137';
  public name = 'Polygon Mainnet Mock';
  public rpcUrl = 'http://localhost:8546';

  constructor(dataFactory: TestDataFactory = testDataFactory) {
    super(dataFactory);
    this.blockHeight = 50000000 + Math.floor(Math.random() * 1000000);
  }

  private startBlockSimulation(): void {
    this.simulationInterval = setInterval(() => {
      this.blockHeight++;
      this.emit('new_block', {
        number: this.blockHeight,
        hash: `0x${Math.random().toString(16).substring(2, 66)}`,
        timestamp: Date.now()
      });
    }, 2000); // Faster blocks on Polygon
  }
}

// ========================================
// PRICE FEED MOCKS
// ========================================

export class MockChainlinkPriceFeed extends EventEmitter {
  private feeds: Map<string, any> = new Map();
  private updateInterval?: NodeJS.Timeout;

  constructor(private dataFactory: TestDataFactory = testDataFactory) {
    super();
    this.initializeFeeds();
  }

  start(): void {
    this.updateInterval = setInterval(() => {
      this.updatePrices();
    }, 60000); // Update every minute
  }

  stop(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }
  }

  getLatestPrice(pair: string): any {
    const feed = this.feeds.get(pair);
    if (!feed) {
      throw new Error(`Price feed not found for pair: ${pair}`);
    }
    return feed;
  }

  private initializeFeeds(): void {
    const pairs = ['BTC/USD', 'ETH/USD', 'LINK/USD', 'UNI/USD', 'USDC/USD'];
    pairs.forEach(pair => {
      this.feeds.set(pair, this.dataFactory.createPriceData({ asset: pair.split('/')[0] }));
    });
  }

  private updatePrices(): void {
    this.feeds.forEach((feed, pair) => {
      const asset = pair.split('/')[0];
      const newPrice = this.dataFactory.createPriceData({ asset });
      
      this.feeds.set(pair, {
        ...newPrice,
        pair,
        roundId: feed.roundId + 1,
        updatedAt: Date.now()
      });

      this.emit('price_updated', { pair, price: newPrice.price });
    });
  }
}

// ========================================
// DEFI PROTOCOL MOCKS
// ========================================

export class MockUniswapV3 extends EventEmitter {
  private pools: Map<string, any> = new Map();
  private positions: Map<string, any> = new Map();

  constructor(private dataFactory: TestDataFactory = testDataFactory) {
    super();
    this.initializePools();
  }

  async getPool(token0: string, token1: string, fee: number): Promise<any> {
    const poolKey = `${token0}-${token1}-${fee}`;
    return this.pools.get(poolKey) || null;
  }

  async getPosition(tokenId: string): Promise<any> {
    return this.positions.get(tokenId) || null;
  }

  async quoteBuy(tokenIn: string, tokenOut: string, amountIn: string): Promise<any> {
    await this.simulateLatency();
    
    const amountOut = (BigInt(amountIn) * BigInt(95) / BigInt(100)).toString(); // 5% slippage
    const gasEstimate = (150000 + Math.random() * 50000).toString();

    return {
      amountOut,
      gasEstimate,
      priceImpact: 0.05,
      route: [tokenIn, tokenOut]
    };
  }

  async swap(params: any): Promise<string> {
    await this.simulateLatency();
    
    if (Math.random() < 0.02) {
      throw new Error('Swap failed: Insufficient liquidity');
    }

    const txHash = `0x${Math.random().toString(16).substring(2, 66)}`;
    
    setTimeout(() => {
      this.emit('swap_completed', {
        hash: txHash,
        tokenIn: params.tokenIn,
        tokenOut: params.tokenOut,
        amountIn: params.amountIn,
        amountOut: params.amountOut
      });
    }, 15000);

    return txHash;
  }

  private initializePools(): void {
    const pairs = [
      { token0: 'WETH', token1: 'USDC', fee: 3000 },
      { token0: 'WETH', token1: 'WBTC', fee: 3000 },
      { token0: 'USDC', token1: 'USDT', fee: 500 }
    ];

    pairs.forEach(({ token0, token1, fee }) => {
      const poolKey = `${token0}-${token1}-${fee}`;
      this.pools.set(poolKey, {
        token0,
        token1,
        fee,
        liquidity: (Math.random() * 1000000000).toString(),
        sqrtPriceX96: (Math.random() * 1000000000000000000000).toString(),
        tick: Math.floor(Math.random() * 887272) - 443636
      });
    });
  }

  private async simulateLatency(): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));
  }
}

export class MockAave extends EventEmitter {
  private reserves: Map<string, any> = new Map();
  private userPositions: Map<string, any> = new Map();

  constructor(private dataFactory: TestDataFactory = testDataFactory) {
    super();
    this.initializeReserves();
  }

  async getReserveData(asset: string): Promise<any> {
    await this.simulateLatency();
    return this.reserves.get(asset) || null;
  }

  async getUserAccountData(user: string): Promise<any> {
    await this.simulateLatency();
    return this.userPositions.get(user) || {
      totalCollateralETH: '0',
      totalDebtETH: '0',
      availableBorrowsETH: '0',
      currentLiquidationThreshold: 8000,
      ltv: 7500,
      healthFactor: '0'
    };
  }

  async deposit(asset: string, amount: string, user: string): Promise<string> {
    await this.simulateLatency();
    
    const txHash = `0x${Math.random().toString(16).substring(2, 66)}`;
    
    setTimeout(() => {
      this.emit('deposit_completed', {
        hash: txHash,
        asset,
        amount,
        user
      });
    }, 15000);

    return txHash;
  }

  async withdraw(asset: string, amount: string, user: string): Promise<string> {
    await this.simulateLatency();
    
    const txHash = `0x${Math.random().toString(16).substring(2, 66)}`;
    
    setTimeout(() => {
      this.emit('withdraw_completed', {
        hash: txHash,
        asset,
        amount,
        user
      });
    }, 15000);

    return txHash;
  }

  private initializeReserves(): void {
    const assets = ['WETH', 'WBTC', 'USDC', 'USDT', 'DAI'];
    
    assets.forEach(asset => {
      this.reserves.set(asset, {
        asset,
        liquidityRate: (Math.random() * 0.1).toString(), // 0-10% APY
        variableBorrowRate: (Math.random() * 0.15 + 0.05).toString(), // 5-20% APY
        stableBorrowRate: (Math.random() * 0.12 + 0.08).toString(), // 8-20% APY
        utilizationRate: (Math.random() * 0.8).toString(), // 0-80% utilization
        totalSupply: (Math.random() * 1000000000).toString(),
        totalDebt: (Math.random() * 500000000).toString()
      });
    });
  }

  private async simulateLatency(): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 300));
  }
}

// ========================================
// SOCIAL MEDIA API MOCKS
// ========================================

export class MockTwitterAPI extends EventEmitter {
  private streamActive = false;
  private keywords: string[] = [];

  constructor(private dataFactory: TestDataFactory = testDataFactory) {
    super();
  }

  async startStream(keywords: string[]): Promise<void> {
    this.keywords = keywords;
    this.streamActive = true;
    
    // Simulate tweets
    const streamInterval = setInterval(() => {
      if (!this.streamActive) {
        clearInterval(streamInterval);
        return;
      }

      const tweet = this.dataFactory.createSocialMediaPost({
        platform: 'twitter',
        keywords: this.keywords
      });

      this.emit('tweet', tweet);
    }, 2000 + Math.random() * 8000); // Tweet every 2-10 seconds
  }

  async stopStream(): Promise<void> {
    this.streamActive = false;
    this.emit('stream_stopped');
  }

  async searchTweets(query: string, count: number = 100): Promise<any[]> {
    await this.simulateLatency();
    
    return Array(count).fill(null).map(() => 
      this.dataFactory.createSocialMediaPost({
        platform: 'twitter',
        query
      })
    );
  }

  private async simulateLatency(): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 200 + Math.random() * 500));
  }
}

export class MockRedditAPI extends EventEmitter {
  private subreddits = ['CryptoCurrency', 'DeFi', 'ethereum', 'Bitcoin'];

  constructor(private dataFactory: TestDataFactory = testDataFactory) {
    super();
  }

  async getHotPosts(subreddit: string, limit: number = 25): Promise<any[]> {
    await this.simulateLatency();
    
    return Array(limit).fill(null).map(() => 
      this.dataFactory.createSocialMediaPost({
        platform: 'reddit',
        subreddit
      })
    );
  }

  async getComments(postId: string): Promise<any[]> {
    await this.simulateLatency();
    
    const commentCount = 5 + Math.floor(Math.random() * 50);
    return Array(commentCount).fill(null).map(() => 
      this.dataFactory.createSocialMediaPost({
        platform: 'reddit',
        type: 'comment',
        parentId: postId
      })
    );
  }

  private async simulateLatency(): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 300 + Math.random() * 700));
  }
}

// ========================================
// REGULATORY API MOCKS
// ========================================

export class MockChainalysisAPI extends EventEmitter {
  constructor(private dataFactory: TestDataFactory = testDataFactory) {
    super();
  }

  async screenAddress(address: string): Promise<any> {
    await this.simulateLatency();
    
    return {
      address,
      riskScore: Math.random() * 100,
      category: Math.random() > 0.95 ? 'high_risk' : 'low_risk',
      sanctions: Math.random() > 0.99 ? ['OFAC'] : [],
      pep: Math.random() > 0.99,
      lastSeen: new Date(Date.now() - Math.random() * 86400000 * 30) // Last 30 days
    };
  }

  async getTransactionRisk(txHash: string): Promise<any> {
    await this.simulateLatency();
    
    return {
      txHash,
      riskScore: Math.random() * 100,
      mixerExposure: Math.random() > 0.9,
      darknetExposure: Math.random() > 0.95,
      sanctionsExposure: Math.random() > 0.99,
      analysis: this.dataFactory.createAuditEvent({ transactionHash: txHash })
    };
  }

  private async simulateLatency(): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1500));
  }
}

// ========================================
// MOCK EXTERNAL API FACTORY
// ========================================

export class MockExternalAPIFactory {
  static createBlockchainNode(chain: string): MockEthereumNode | MockPolygonNode {
    switch (chain.toLowerCase()) {
      case 'ethereum':
        return new MockEthereumNode();
      case 'polygon':
        return new MockPolygonNode();
      default:
        return new MockEthereumNode();
    }
  }

  static createPriceFeed(): MockChainlinkPriceFeed {
    return new MockChainlinkPriceFeed();
  }

  static createDeFiProtocol(protocol: string): MockUniswapV3 | MockAave {
    switch (protocol.toLowerCase()) {
      case 'uniswap':
      case 'uniswapv3':
        return new MockUniswapV3();
      case 'aave':
        return new MockAave();
      default:
        throw new Error(`Unknown DeFi protocol: ${protocol}`);
    }
  }

  static createSocialMediaAPI(platform: string): MockTwitterAPI | MockRedditAPI {
    switch (platform.toLowerCase()) {
      case 'twitter':
        return new MockTwitterAPI();
      case 'reddit':
        return new MockRedditAPI();
      default:
        throw new Error(`Unknown social media platform: ${platform}`);
    }
  }

  static createRegulatoryAPI(provider: string): MockChainalysisAPI {
    switch (provider.toLowerCase()) {
      case 'chainalysis':
        return new MockChainalysisAPI();
      default:
        throw new Error(`Unknown regulatory API provider: ${provider}`);
    }
  }

  static createAllMockAPIs(): {
    blockchainNodes: Record<string, MockEthereumNode | MockPolygonNode>;
    priceFeeds: MockChainlinkPriceFeed;
    defiProtocols: Record<string, MockUniswapV3 | MockAave>;
    socialMedia: Record<string, MockTwitterAPI | MockRedditAPI>;
    regulatory: Record<string, MockChainalysisAPI>;
  } {
    return {
      blockchainNodes: {
        ethereum: new MockEthereumNode(),
        polygon: new MockPolygonNode()
      },
      priceFeeds: new MockChainlinkPriceFeed(),
      defiProtocols: {
        uniswap: new MockUniswapV3(),
        aave: new MockAave()
      },
      socialMedia: {
        twitter: new MockTwitterAPI(),
        reddit: new MockRedditAPI()
      },
      regulatory: {
        chainalysis: new MockChainalysisAPI()
      }
    };
  }
}

// Export singleton instances
export const mockExternalAPIs = MockExternalAPIFactory.createAllMockAPIs();