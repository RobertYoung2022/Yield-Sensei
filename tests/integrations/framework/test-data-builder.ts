export interface TestData {
  id: string;
  type: string;
  data: any;
  metadata: TestDataMetadata;
}

export interface TestDataMetadata {
  createdAt: number;
  createdBy: string;
  tags: string[];
  cleanup: boolean;
}

export class TestDataBuilder {
  private testData: Map<string, TestData> = new Map();
  private factories: Map<string, DataFactory> = new Map();

  registerFactory(type: string, factory: DataFactory): void {
    this.factories.set(type, factory);
  }

  async create<T = any>(type: string, overrides?: Partial<T>): Promise<TestData> {
    const factory = this.factories.get(type);
    if (!factory) {
      throw new Error(`No factory registered for type: ${type}`);
    }

    const data = await factory.create(overrides);
    const testData: TestData = {
      id: `${type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      data,
      metadata: {
        createdAt: Date.now(),
        createdBy: 'integration-test',
        tags: [type],
        cleanup: true
      }
    };

    this.testData.set(testData.id, testData);
    return testData;
  }

  async createMany<T = any>(
    type: string,
    count: number,
    overrides?: Partial<T>[]
  ): Promise<TestData[]> {
    const results: TestData[] = [];
    
    for (let i = 0; i < count; i++) {
      const override = overrides?.[i] || {};
      const data = await this.create(type, override);
      results.push(data);
    }
    
    return results;
  }

  async cleanup(): Promise<void> {
    const cleanupTasks: Promise<void>[] = [];
    
    for (const [id, data] of this.testData) {
      if (data.metadata.cleanup) {
        const factory = this.factories.get(data.type);
        if (factory?.cleanup) {
          cleanupTasks.push(factory.cleanup(data));
        }
      }
    }
    
    await Promise.all(cleanupTasks);
    this.testData.clear();
  }

  getAll(): TestData[] {
    return Array.from(this.testData.values());
  }

  getByType(type: string): TestData[] {
    return this.getAll().filter(data => data.type === type);
  }

  getById(id: string): TestData | undefined {
    return this.testData.get(id);
  }
}

export interface DataFactory<T = any> {
  create(overrides?: Partial<T>): Promise<T>;
  cleanup?(data: TestData): Promise<void>;
}

// Predefined factories for common data types

export class UserDataFactory implements DataFactory {
  async create(overrides?: Partial<any>): Promise<any> {
    return {
      id: `user-${Date.now()}`,
      email: `test-${Date.now()}@example.com`,
      username: `testuser${Date.now()}`,
      password: 'Test123!@#',
      role: 'user',
      isActive: true,
      createdAt: new Date(),
      ...overrides
    };
  }

  async cleanup(data: TestData): Promise<void> {
    // Delete user from database
    console.log(`Cleaning up user: ${data.data.id}`);
  }
}

export class PortfolioDataFactory implements DataFactory {
  async create(overrides?: Partial<any>): Promise<any> {
    return {
      id: `portfolio-${Date.now()}`,
      userId: overrides?.userId || `user-${Date.now()}`,
      name: 'Test Portfolio',
      description: 'Integration test portfolio',
      totalValue: 10000,
      currency: 'USD',
      assets: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides
    };
  }

  async cleanup(data: TestData): Promise<void> {
    // Delete portfolio from database
    console.log(`Cleaning up portfolio: ${data.data.id}`);
  }
}

export class AssetDataFactory implements DataFactory {
  async create(overrides?: Partial<any>): Promise<any> {
    return {
      id: `asset-${Date.now()}`,
      portfolioId: overrides?.portfolioId || `portfolio-${Date.now()}`,
      symbol: 'ETH',
      name: 'Ethereum',
      type: 'cryptocurrency',
      amount: 10,
      currentPrice: 2000,
      totalValue: 20000,
      purchasePrice: 1800,
      purchaseDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
      ...overrides
    };
  }
}

export class YieldStrategyDataFactory implements DataFactory {
  async create(overrides?: Partial<any>): Promise<any> {
    return {
      id: `strategy-${Date.now()}`,
      name: 'Test Yield Strategy',
      description: 'Integration test yield strategy',
      type: 'staking',
      protocol: 'test-protocol',
      chain: 'ethereum',
      apy: 12.5,
      tvl: 1000000,
      risk: 'medium',
      minInvestment: 100,
      lockPeriod: 0,
      isActive: true,
      ...overrides
    };
  }
}

export class TransactionDataFactory implements DataFactory {
  async create(overrides?: Partial<any>): Promise<any> {
    return {
      id: `tx-${Date.now()}`,
      userId: overrides?.userId || `user-${Date.now()}`,
      portfolioId: overrides?.portfolioId || `portfolio-${Date.now()}`,
      type: 'deposit',
      status: 'completed',
      amount: 1000,
      currency: 'USDC',
      hash: `0x${Math.random().toString(16).substr(2, 64)}`,
      blockNumber: Math.floor(Math.random() * 1000000) + 15000000,
      gasUsed: 21000,
      gasPrice: '20',
      timestamp: new Date(),
      ...overrides
    };
  }
}

export class RWADataFactory implements DataFactory {
  async create(overrides?: Partial<any>): Promise<any> {
    return {
      id: `rwa-${Date.now()}`,
      name: 'Test Real World Asset',
      type: 'real-estate',
      issuer: 'Test Issuer Corp',
      totalValue: 10000000,
      tokenSupply: 10000,
      tokenPrice: 1000,
      yield: 8.5,
      maturityDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
      rating: 'A',
      compliance: {
        kyc: true,
        aml: true,
        accreditation: true
      },
      documents: [],
      ...overrides
    };
  }
}

export class SentimentDataFactory implements DataFactory {
  async create(overrides?: Partial<any>): Promise<any> {
    return {
      id: `sentiment-${Date.now()}`,
      source: 'twitter',
      symbol: 'BTC',
      sentiment: 0.75, // -1 to 1
      volume: 1000,
      mentions: 500,
      engagement: 10000,
      influencerScore: 0.8,
      timestamp: new Date(),
      sample: [
        {
          text: 'Bitcoin is looking bullish!',
          author: 'crypto_influencer',
          sentiment: 0.9,
          engagement: 1000
        }
      ],
      ...overrides
    };
  }
}

export class AlertDataFactory implements DataFactory {
  async create(overrides?: Partial<any>): Promise<any> {
    return {
      id: `alert-${Date.now()}`,
      userId: overrides?.userId || `user-${Date.now()}`,
      type: 'price',
      condition: {
        asset: 'BTC',
        operator: 'gte',
        value: 50000
      },
      status: 'active',
      notification: {
        email: true,
        push: true,
        sms: false
      },
      triggeredCount: 0,
      createdAt: new Date(),
      ...overrides
    };
  }
}

// Test scenario builders

export class TestScenarioBuilder {
  private dataBuilder: TestDataBuilder;

  constructor(dataBuilder: TestDataBuilder) {
    this.dataBuilder = dataBuilder;
  }

  async createCompleteUserScenario(): Promise<{
    user: TestData;
    portfolio: TestData;
    assets: TestData[];
    transactions: TestData[];
  }> {
    // Create user
    const user = await this.dataBuilder.create('user');
    
    // Create portfolio
    const portfolio = await this.dataBuilder.create('portfolio', {
      userId: user.data.id
    });
    
    // Create assets
    const assets = await this.dataBuilder.createMany('asset', 3, [
      { portfolioId: portfolio.data.id, symbol: 'BTC', amount: 0.5 },
      { portfolioId: portfolio.data.id, symbol: 'ETH', amount: 10 },
      { portfolioId: portfolio.data.id, symbol: 'USDC', amount: 5000 }
    ]);
    
    // Create transactions
    const transactions = await this.dataBuilder.createMany('transaction', 2, [
      { 
        userId: user.data.id, 
        portfolioId: portfolio.data.id,
        type: 'deposit',
        currency: 'USDC',
        amount: 5000
      },
      { 
        userId: user.data.id, 
        portfolioId: portfolio.data.id,
        type: 'swap',
        currency: 'ETH',
        amount: 10
      }
    ]);
    
    return { user, portfolio, assets, transactions };
  }

  async createYieldOptimizationScenario(): Promise<{
    user: TestData;
    portfolio: TestData;
    strategies: TestData[];
    positions: any[];
  }> {
    const user = await this.dataBuilder.create('user');
    const portfolio = await this.dataBuilder.create('portfolio', {
      userId: user.data.id
    });
    
    const strategies = await this.dataBuilder.createMany('yieldStrategy', 3, [
      { type: 'staking', apy: 15, risk: 'low' },
      { type: 'liquidity-pool', apy: 25, risk: 'medium' },
      { type: 'lending', apy: 8, risk: 'low' }
    ]);
    
    // Create positions (these would be actual yield positions)
    const positions = strategies.map(strategy => ({
      portfolioId: portfolio.data.id,
      strategyId: strategy.data.id,
      amount: 1000,
      startDate: new Date(),
      estimatedYield: strategy.data.apy * 10 // Simplified calculation
    }));
    
    return { user, portfolio, strategies, positions };
  }

  async createRWAInvestmentScenario(): Promise<{
    user: TestData;
    portfolio: TestData;
    rwas: TestData[];
    investments: any[];
  }> {
    const user = await this.dataBuilder.create('user', {
      role: 'accredited-investor'
    });
    
    const portfolio = await this.dataBuilder.create('portfolio', {
      userId: user.data.id,
      type: 'rwa-portfolio'
    });
    
    const rwas = await this.dataBuilder.createMany('rwa', 2, [
      { 
        type: 'real-estate',
        name: 'Commercial Property Fund A',
        yield: 8.5,
        rating: 'A'
      },
      { 
        type: 'private-credit',
        name: 'Corporate Debt Fund B',
        yield: 10.2,
        rating: 'BBB'
      }
    ]);
    
    const investments = rwas.map(rwa => ({
      portfolioId: portfolio.data.id,
      rwaId: rwa.data.id,
      amount: 50000,
      tokens: 50,
      purchaseDate: new Date()
    }));
    
    return { user, portfolio, rwas, investments };
  }
}

// Fixture management

export class FixtureManager {
  private fixtures: Map<string, any> = new Map();
  private loaders: Map<string, FixtureLoader> = new Map();

  registerLoader(name: string, loader: FixtureLoader): void {
    this.loaders.set(name, loader);
  }

  async load(name: string): Promise<any> {
    if (this.fixtures.has(name)) {
      return this.fixtures.get(name);
    }

    const loader = this.loaders.get(name);
    if (!loader) {
      throw new Error(`No loader registered for fixture: ${name}`);
    }

    const data = await loader.load();
    this.fixtures.set(name, data);
    return data;
  }

  async loadAll(names: string[]): Promise<Map<string, any>> {
    const results = new Map<string, any>();
    
    for (const name of names) {
      const data = await this.load(name);
      results.set(name, data);
    }
    
    return results;
  }

  async cleanup(): Promise<void> {
    const cleanupTasks: Promise<void>[] = [];
    
    for (const [name, data] of this.fixtures) {
      const loader = this.loaders.get(name);
      if (loader?.cleanup) {
        cleanupTasks.push(loader.cleanup(data));
      }
    }
    
    await Promise.all(cleanupTasks);
    this.fixtures.clear();
  }
}

export interface FixtureLoader<T = any> {
  load(): Promise<T>;
  cleanup?(data: T): Promise<void>;
}

// Common fixtures

export class DatabaseFixtureLoader implements FixtureLoader {
  async load(): Promise<any> {
    // Load database schema, migrations, etc.
    return {
      tables: ['users', 'portfolios', 'assets', 'transactions'],
      version: '1.0.0'
    };
  }

  async cleanup(): Promise<void> {
    // Clean up database
  }
}

export class ConfigurationFixtureLoader implements FixtureLoader {
  async load(): Promise<any> {
    return {
      api: {
        baseUrl: process.env.API_BASE_URL || 'http://localhost:3000',
        version: 'v1'
      },
      satellites: {
        sage: process.env.SAGE_URL || 'http://localhost:3001',
        echo: process.env.ECHO_URL || 'http://localhost:3002',
        forge: process.env.FORGE_URL || 'http://localhost:3003',
        pulse: process.env.PULSE_URL || 'http://localhost:3004',
        bridge: process.env.BRIDGE_URL || 'http://localhost:3005',
        oracle: process.env.ORACLE_URL || 'http://localhost:3006'
      },
      database: {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432'),
        name: process.env.DB_NAME || 'yieldsensei_test'
      }
    };
  }
}