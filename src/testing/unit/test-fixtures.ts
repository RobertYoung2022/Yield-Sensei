/**
 * Test Fixtures
 * Standardized test data fixtures for different domains
 */

export interface UserFixture {
  id: string;
  email: string;
  username: string;
  hashedPassword: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  profile?: {
    firstName: string;
    lastName: string;
    avatar?: string;
  };
}

export interface PortfolioFixture {
  id: string;
  userId: string;
  name: string;
  description: string;
  totalValue: number;
  currency: string;
  positions: PositionFixture[];
  riskProfile: 'conservative' | 'moderate' | 'aggressive';
  createdAt: Date;
  updatedAt: Date;
}

export interface PositionFixture {
  id: string;
  portfolioId: string;
  tokenAddress: string;
  tokenSymbol: string;
  amount: string;
  value: number;
  averagePrice: number;
  unrealizedPnl: number;
  chain: string;
  protocol: string;
  positionType: 'spot' | 'lending' | 'liquidity' | 'staking';
}

export interface TransactionFixture {
  id: string;
  userId: string;
  portfolioId: string;
  hash: string;
  chain: string;
  blockNumber: number;
  fromAddress: string;
  toAddress: string;
  value: string;
  gasUsed: number;
  gasPrice: string;
  status: 'pending' | 'confirmed' | 'failed';
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface MarketDataFixture {
  symbol: string;
  price: number;
  change24h: number;
  volume24h: number;
  marketCap: number;
  supply: {
    circulating: number;
    total: number;
    max?: number;
  };
  timestamp: Date;
}

export interface RiskAssessmentFixture {
  id: string;
  portfolioId: string;
  riskScore: number;
  volatility: number;
  sharpeRatio: number;
  maxDrawdown: number;
  var95: number;
  correlations: Record<string, number>;
  recommendations: string[];
  timestamp: Date;
}

export interface OpportunityFixture {
  id: string;
  type: 'yield-farming' | 'arbitrage' | 'liquidity-mining' | 'staking';
  protocol: string;
  chain: string;
  apy: number;
  tvl: number;
  riskLevel: 'low' | 'medium' | 'high';
  tokens: string[];
  requirements: {
    minAmount: number;
    lockPeriod?: number;
    complexity: 'beginner' | 'intermediate' | 'advanced';
  };
  metadata: Record<string, any>;
}

export class TestFixtures {
  static createUser(overrides: Partial<UserFixture> = {}): UserFixture {
    return {
      id: this.generateId(),
      email: 'test@example.com',
      username: 'testuser',
      hashedPassword: '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewreZy7xHQf4LYU6', // 'password123'
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      profile: {
        firstName: 'Test',
        lastName: 'User',
      },
      ...overrides,
    };
  }

  static createPortfolio(overrides: Partial<PortfolioFixture> = {}): PortfolioFixture {
    const userId = overrides.userId || this.generateId();
    return {
      id: this.generateId(),
      userId,
      name: 'Test Portfolio',
      description: 'A test portfolio for unit testing',
      totalValue: 10000,
      currency: 'USD',
      positions: [],
      riskProfile: 'moderate',
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    };
  }

  static createPosition(overrides: Partial<PositionFixture> = {}): PositionFixture {
    const portfolioId = overrides.portfolioId || this.generateId();
    return {
      id: this.generateId(),
      portfolioId,
      tokenAddress: '0x1234567890123456789012345678901234567890',
      tokenSymbol: 'TEST',
      amount: '100.0',
      value: 1000,
      averagePrice: 10,
      unrealizedPnl: 50,
      chain: 'ethereum',
      protocol: 'uniswap',
      positionType: 'spot',
      ...overrides,
    };
  }

  static createTransaction(overrides: Partial<TransactionFixture> = {}): TransactionFixture {
    const userId = overrides.userId || this.generateId();
    const portfolioId = overrides.portfolioId || this.generateId();
    return {
      id: this.generateId(),
      userId,
      portfolioId,
      hash: '0x' + Array(64).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join(''),
      chain: 'ethereum',
      blockNumber: 18000000,
      fromAddress: '0x1234567890123456789012345678901234567890',
      toAddress: '0x0987654321098765432109876543210987654321',
      value: '1000000000000000000', // 1 ETH in wei
      gasUsed: 21000,
      gasPrice: '20000000000', // 20 gwei
      status: 'confirmed',
      timestamp: new Date(),
      ...overrides,
    };
  }

  static createMarketData(overrides: Partial<MarketDataFixture> = {}): MarketDataFixture {
    return {
      symbol: 'ETH',
      price: 2000,
      change24h: 5.5,
      volume24h: 1000000000,
      marketCap: 240000000000,
      supply: {
        circulating: 120000000,
        total: 120000000,
      },
      timestamp: new Date(),
      ...overrides,
    };
  }

  static createRiskAssessment(overrides: Partial<RiskAssessmentFixture> = {}): RiskAssessmentFixture {
    const portfolioId = overrides.portfolioId || this.generateId();
    return {
      id: this.generateId(),
      portfolioId,
      riskScore: 7.5,
      volatility: 0.65,
      sharpeRatio: 1.2,
      maxDrawdown: -0.25,
      var95: -0.15,
      correlations: {
        'BTC': 0.8,
        'SOL': 0.6,
        'AVAX': 0.7,
      },
      recommendations: [
        'Consider diversifying into more stable assets',
        'Your portfolio shows high correlation with market movements',
      ],
      timestamp: new Date(),
      ...overrides,
    };
  }

  static createOpportunity(overrides: Partial<OpportunityFixture> = {}): OpportunityFixture {
    return {
      id: this.generateId(),
      type: 'yield-farming',
      protocol: 'Compound',
      chain: 'ethereum',
      apy: 12.5,
      tvl: 50000000,
      riskLevel: 'medium',
      tokens: ['USDC', 'DAI'],
      requirements: {
        minAmount: 100,
        complexity: 'intermediate',
      },
      metadata: {
        fees: 0.3,
        liquidityUtilization: 0.75,
        historicalApy: [10.2, 11.8, 13.1, 12.5],
      },
      ...overrides,
    };
  }

  // Satellite-specific fixtures
  static createEchoSentimentData(overrides: Partial<any> = {}) {
    return {
      id: this.generateId(),
      source: 'twitter',
      content: 'Bullish on $ETH! 🚀',
      sentiment: 'positive',
      confidence: 0.85,
      timestamp: new Date(),
      metadata: {
        engagement: 156,
        reach: 2400,
        influencerScore: 0.7,
      },
      ...overrides,
    };
  }

  static createSageRwaData(overrides: Partial<any> = {}) {
    return {
      id: this.generateId(),
      assetType: 'real-estate',
      tokenAddress: '0x' + Array(40).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join(''),
      underlyingValue: 1000000,
      tokenPrice: 100,
      totalSupply: 10000,
      yield: 8.5,
      maturity: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
      riskRating: 'BBB+',
      jurisdiction: 'US',
      ...overrides,
    };
  }

  static createBridgeArbitrageData(overrides: Partial<any> = {}) {
    return {
      id: this.generateId(),
      sourceChain: 'ethereum',
      targetChain: 'polygon',
      token: 'USDC',
      sourcePlatform: 'uniswap',
      targetPlatform: 'quickswap',
      sourcePrice: 1.001,
      targetPrice: 0.998,
      profitMargin: 0.003,
      estimatedGas: {
        source: 0.02,
        bridge: 0.01,
        target: 0.005,
      },
      estimatedTime: 300, // seconds
      ...overrides,
    };
  }

  static createAegisRiskData(overrides: Partial<any> = {}) {
    return {
      id: this.generateId(),
      contractAddress: '0x' + Array(40).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join(''),
      riskLevel: 'medium',
      vulnerabilities: [
        {
          type: 'reentrancy',
          severity: 'low',
          description: 'Potential reentrancy in withdraw function',
        },
      ],
      auditScore: 85,
      liquidityRisk: 0.15,
      smartContractRisk: 0.1,
      timestamp: new Date(),
      ...overrides,
    };
  }

  static createPulseMetricsData(overrides: Partial<any> = {}) {
    return {
      id: this.generateId(),
      timestamp: new Date(),
      metrics: {
        totalTvl: 1250000000,
        totalVolume24h: 85000000,
        activeUsers24h: 12500,
        transactionCount24h: 45000,
        averageGasPrice: 25,
        networkUtilization: 0.75,
      },
      chains: {
        ethereum: { tvl: 800000000, volume: 50000000 },
        polygon: { tvl: 250000000, volume: 20000000 },
        arbitrum: { tvl: 200000000, volume: 15000000 },
      },
      ...overrides,
    };
  }

  static createForgeOptimizationData(overrides: Partial<any> = {}) {
    return {
      id: this.generateId(),
      strategyId: 'compound-yield-v2',
      optimizations: [
        {
          parameter: 'rebalanceThreshold',
          currentValue: 0.05,
          suggestedValue: 0.03,
          expectedImprovement: 0.015,
        },
        {
          parameter: 'slippageTolerance',
          currentValue: 0.01,
          suggestedValue: 0.008,
          expectedImprovement: 0.002,
        },
      ],
      backtestResults: {
        annualizedReturn: 0.125,
        sharpeRatio: 1.8,
        maxDrawdown: -0.08,
      },
      confidence: 0.92,
      ...overrides,
    };
  }

  static createOraclePriceData(overrides: Partial<any> = {}) {
    return {
      id: this.generateId(),
      symbol: 'ETH/USD',
      price: 2000.50,
      sources: [
        { provider: 'chainlink', price: 2000.25, weight: 0.4 },
        { provider: 'uniswap', price: 2000.75, weight: 0.3 },
        { provider: 'coinbase', price: 2000.50, weight: 0.3 },
      ],
      confidence: 0.98,
      deviation: 0.0025,
      timestamp: new Date(),
      ...overrides,
    };
  }

  // Batch creation utilities
  static createMultipleUsers(count: number, baseOverrides: Partial<UserFixture> = {}): UserFixture[] {
    return Array.from({ length: count }, (_, index) => 
      this.createUser({
        email: `user${index}@example.com`,
        username: `user${index}`,
        ...baseOverrides,
      })
    );
  }

  static createPortfolioWithPositions(
    positionCount: number = 3,
    portfolioOverrides: Partial<PortfolioFixture> = {}
  ): PortfolioFixture {
    const portfolio = this.createPortfolio(portfolioOverrides);
    const positions = Array.from({ length: positionCount }, () => 
      this.createPosition({ portfolioId: portfolio.id })
    );
    
    portfolio.positions = positions;
    portfolio.totalValue = positions.reduce((sum, pos) => sum + pos.value, 0);
    
    return portfolio;
  }

  static createMarketDataSet(symbols: string[]): MarketDataFixture[] {
    return symbols.map(symbol => this.createMarketData({ symbol }));
  }

  // Helper methods
  private static generateId(): string {
    return 'test_' + Math.random().toString(36).substr(2, 9);
  }

  static generateRandomAddress(): string {
    return '0x' + Array(40).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join('');
  }

  static generateRandomHash(): string {
    return '0x' + Array(64).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join('');
  }

  static createDateRange(start: Date, end: Date, points: number): Date[] {
    const diff = end.getTime() - start.getTime();
    const step = diff / (points - 1);
    
    return Array.from({ length: points }, (_, index) => 
      new Date(start.getTime() + index * step)
    );
  }

  static createTimeSeriesData<T>(
    dates: Date[],
    createDataPoint: (date: Date, index: number) => T
  ): T[] {
    return dates.map(createDataPoint);
  }
}

// Pre-configured fixture sets for common scenarios
export const CommonFixtureSets = {
  basicUserWithPortfolio: () => {
    const user = TestFixtures.createUser();
    const portfolio = TestFixtures.createPortfolioWithPositions(3, { userId: user.id });
    return { user, portfolio };
  },

  multiChainPortfolio: () => {
    const user = TestFixtures.createUser();
    const portfolio = TestFixtures.createPortfolio({ userId: user.id });
    const positions = [
      TestFixtures.createPosition({ portfolioId: portfolio.id, chain: 'ethereum', tokenSymbol: 'ETH' }),
      TestFixtures.createPosition({ portfolioId: portfolio.id, chain: 'polygon', tokenSymbol: 'MATIC' }),
      TestFixtures.createPosition({ portfolioId: portfolio.id, chain: 'arbitrum', tokenSymbol: 'ARB' }),
    ];
    portfolio.positions = positions;
    portfolio.totalValue = positions.reduce((sum, pos) => sum + pos.value, 0);
    return { user, portfolio, positions };
  },

  yieldFarmingScenario: () => {
    const user = TestFixtures.createUser();
    const portfolio = TestFixtures.createPortfolio({ userId: user.id });
    const opportunities = [
      TestFixtures.createOpportunity({ type: 'yield-farming', apy: 15.2 }),
      TestFixtures.createOpportunity({ type: 'liquidity-mining', apy: 22.8 }),
      TestFixtures.createOpportunity({ type: 'staking', apy: 8.5 }),
    ];
    return { user, portfolio, opportunities };
  },

  riskAnalysisScenario: () => {
    const { user, portfolio } = CommonFixtureSets.basicUserWithPortfolio();
    const riskAssessment = TestFixtures.createRiskAssessment({ portfolioId: portfolio.id });
    const aegisData = TestFixtures.createAegisRiskData();
    return { user, portfolio, riskAssessment, aegisData };
  },
};