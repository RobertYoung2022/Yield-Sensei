/**
 * Test Data Factory
 * Centralized factory for generating realistic test data across all satellites
 */

import { faker } from '@faker-js/faker';

// Import all satellite types
import type {
  OracleFeed,
  RWAProtocol
} from '../../satellites/oracle/types';

import type {
  SentimentData,
  SocialPlatform
} from '../../satellites/echo/types';

import type {
  YieldOpportunity,
  YieldStrategy,
  ValidatorInfo,
  StrategyType,
  RiskFactor,
  SustainabilityCategory,
  SustainabilityAnalysis
} from '../../satellites/pulse/types';

// Local types for test data
export interface PriceData {
  symbol: string;
  price: number;
  priceUsd: number;
  volume24h: number;
  marketCap: number;
  supply: number;
  change1h: number;
  change24h: number;
  change7d: number;
  timestamp: Date;
}

// Configuration types
export interface DataFactoryConfig {
  locale?: string;
  seed?: number;
  realistic?: boolean;
  variance?: number;
  timeZone?: string;
}

export interface GenerationOptions {
  count?: number;
  startDate?: Date;
  endDate?: Date;
  variation?: number;
  distribution?: 'uniform' | 'normal' | 'exponential' | 'realistic';
  correlations?: Record<string, number>;
}

/**
 * Main Test Data Factory Class
 */
export class TestDataFactory {
  private config: DataFactoryConfig;
  private cryptoSymbols: string[];
  private defiProtocols: string[];
  private blockchains: string[];
  private socialPlatforms: string[];
  private regulatoryFrameworks: string[];

  constructor(config: DataFactoryConfig = {}) {
    this.config = {
      locale: 'en',
      seed: 12345,
      realistic: true,
      variance: 0.2,
      timeZone: 'UTC',
      ...config
    };

    // Set faker seed for reproducible tests
    if (this.config.seed) {
      faker.seed(this.config.seed);
    }

    // Initialize reference data
    this.cryptoSymbols = [
      'BTC', 'ETH', 'USDC', 'USDT', 'BNB', 'ADA', 'SOL', 'XRP', 'DOT', 'AVAX',
      'MATIC', 'LINK', 'UNI', 'LTC', 'BCH', 'XLM', 'VET', 'FIL', 'TRX', 'ETC',
      'ATOM', 'XMR', 'ALGO', 'HBAR', 'ICP', 'NEAR', 'FTM', 'SAND', 'MANA', 'CRV'
    ];

    this.defiProtocols = [
      'Uniswap', 'Aave', 'Compound', 'MakerDAO', 'Curve', 'Balancer', 'SushiSwap',
      'PancakeSwap', 'Yearn', 'Convex', 'Lido', 'Rocket Pool', 'Frax', 'Euler',
      'Morpho', 'Radiant', 'Venus', 'JustLend', 'Benqi', 'Trader Joe'
    ];

    this.blockchains = [
      'ethereum', 'polygon', 'arbitrum', 'optimism', 'avalanche', 'fantom',
      'bsc', 'solana', 'cosmos', 'polkadot', 'cardano', 'near', 'algorand',
      'tron', 'harmony', 'moonbeam', 'cronos', 'aurora', 'celo', 'gnosis'
    ];

    this.socialPlatforms = [
      'twitter', 'discord', 'telegram', 'reddit', 'youtube', 'medium',
      'substack', 'clubhouse', 'tiktok', 'instagram', 'linkedin', 'facebook'
    ];

    this.regulatoryFrameworks = [
      'SEC', 'FINRA', 'CFTC', 'OCC', 'FDIC', 'EU_MiFID', 'EU_EMIR', 'UK_FCA',
      'CA_CSA', 'AU_ASIC', 'JP_FSA', 'SG_MAS', 'HK_SFC', 'CH_FINMA'
    ];
  }

  // ========================================
  // ORACLE SATELLITE DATA FACTORIES
  // ========================================

  createOracleFeed(options: Partial<OracleFeed> = {}): OracleFeed {
    return {
      id: options.id || `oracle_feed_${faker.string.alphanumeric(8)}`,
      name: options.name || faker.company.name(),
      provider: options.provider || faker.helpers.arrayElement(['binance', 'coinbase', 'kraken', 'ftx']),
      endpoint: options.endpoint || `https://api.${faker.internet.domainName()}/v1/data`,
      type: options.type || faker.helpers.arrayElement(['price', 'rwa', 'event', 'identity', 'credit']),
      status: options.status || faker.helpers.arrayElement(['active', 'inactive', 'deprecated']),
      reliability: options.reliability || faker.number.float({ min: 0.8, max: 1.0 }),
      accuracy: options.accuracy || faker.number.float({ min: 0.8, max: 1.0 }),
      lastUpdate: options.lastUpdate || new Date(),
      updateFrequency: options.updateFrequency || faker.number.int({ min: 60, max: 3600 }),
      configuration: options.configuration || {
        timeout: 5000,
        retries: 3,
        validationRules: [],
        aggregationMethod: 'median',
        minSources: 2,
        maxDeviation: 0.05,
        historicalWindow: 86400
      },
      ...options
    };
  }

  createPriceData(options: Partial<PriceData> = {}): PriceData {
    const symbol = options.symbol || faker.helpers.arrayElement(this.cryptoSymbols);
    const basePrice = this.getRealisticPrice(symbol);

    return {
      symbol,
      price: options.price || this.addVariance(basePrice, 0.03),
      priceUsd: options.priceUsd || this.addVariance(basePrice, 0.03),
      volume24h: options.volume24h || faker.number.float({ min: 1000000, max: 5000000000 }),
      marketCap: options.marketCap || faker.number.float({ min: 100000000, max: 800000000000 }),
      supply: options.supply || faker.number.float({ min: 1000000, max: 1000000000 }),
      change1h: options.change1h || faker.number.float({ min: -0.05, max: 0.05 }),
      change24h: options.change24h || faker.number.float({ min: -0.15, max: 0.15 }),
      change7d: options.change7d || faker.number.float({ min: -0.3, max: 0.3 }),
      timestamp: options.timestamp || new Date(),
      ...options
    };
  }

  createRWAProtocol(options: Partial<RWAProtocol> = {}): RWAProtocol {
    return {
      id: options.id || `rwa_protocol_${faker.string.alphanumeric(8)}`,
      name: options.name || `${faker.company.name()} RWA Protocol`,
      description: options.description || faker.lorem.sentences(2),
      assetType: options.assetType || faker.helpers.arrayElement(['real_estate', 'treasury_bills', 'corporate_bonds', 'commodities', 'art_collectibles', 'carbon_credits', 'infrastructure', 'private_equity', 'debt_instruments']),
      assetIssuer: options.assetIssuer || faker.company.name(),
      totalValueLocked: options.totalValueLocked || faker.number.float({ min: 1000000, max: 1000000000 }),
      tokenSupply: options.tokenSupply || faker.number.float({ min: 1000000, max: 100000000 }),
      assetClaims: options.assetClaims || [],
      team: options.team || {
        members: [],
        advisors: [],
        organization: faker.company.name(),
        headquarters: faker.location.city()
      },
      financials: options.financials || {
        revenue: [],
        expenses: [],
        assets: [],
        liabilities: [],
        auditedStatements: [],
        cashFlow: []
      },
      regulatory: options.regulatory || {
        jurisdiction: [faker.location.countryCode()],
        licenses: [],
        compliance: [],
        filings: [],
        restrictions: []
      },
      auditReports: options.auditReports || [],
      riskFactors: options.riskFactors || [],
      createdAt: options.createdAt || faker.date.past(),
      updatedAt: options.updatedAt || faker.date.recent(),
      ...options
    };
  }

  createMarketData(symbols?: string[], options: GenerationOptions = {}): Record<string, any> {
    const targetSymbols = symbols || faker.helpers.arrayElements(this.cryptoSymbols, 10);
    const marketData: Record<string, any> = {};

    targetSymbols.forEach(symbol => {
      const basePrice = this.getRealisticPrice(symbol);
      marketData[symbol] = {
        price: this.addVariance(basePrice, options.variation || 0.05),
        volume: faker.number.float({ min: 1000000, max: 8000000000 }),
        marketCap: faker.number.float({ min: 100000000, max: 600000000000 }),
        change24h: faker.number.float({ min: -0.2, max: 0.2 }),
        high24h: this.addVariance(basePrice, 0.08),
        low24h: this.addVariance(basePrice, -0.08),
        timestamp: new Date()
      };
    });

    return marketData;
  }

  // ========================================
  // ECHO SATELLITE DATA FACTORIES
  // ========================================

  createSentimentData(options: Partial<SentimentData> = {}): SentimentData {
    return {
      id: options.id || `sentiment_${faker.string.alphanumeric(8)}`,
      content: options.content || this.generateCryptoSentimentText(),
      source: options.source || faker.helpers.arrayElement([SocialPlatform.TWITTER, SocialPlatform.DISCORD, SocialPlatform.TELEGRAM, SocialPlatform.REDDIT]),
      author: options.author || {
        id: faker.string.alphanumeric(8),
        username: faker.internet.userName(),
        followersCount: faker.number.int({ min: 100, max: 1000000 }),
        verified: faker.datatype.boolean(),
        influence: faker.number.float({ min: 0, max: 100 })
      },
      timestamp: options.timestamp || new Date(),
      engagement: options.engagement || {
        likes: faker.number.int({ min: 0, max: 10000 }),
        retweets: faker.number.int({ min: 0, max: 1000 }),
        replies: faker.number.int({ min: 0, max: 500 }),
        views: faker.number.int({ min: 100, max: 100000 }),
        shares: faker.number.int({ min: 0, max: 1000 })
      },
      metadata: options.metadata || {
        url: faker.internet.url(),
        threadId: faker.string.alphanumeric(10),
        channelId: faker.string.alphanumeric(8),
        language: 'en' as const,
        isRetweet: faker.datatype.boolean(),
        parentId: faker.datatype.boolean() ? faker.string.alphanumeric(10) : undefined
      },
      ...options
    };
  }

  createSocialMediaPost(options: Partial<any> = {}): any {
    return {
      id: options.id || `post_${faker.string.alphanumeric(10)}`,
      platform: options.platform || faker.helpers.arrayElement(this.socialPlatforms),
      content: options.content || this.generateCryptoSentimentText(),
      author: options.author || {
        id: faker.string.alphanumeric(8),
        username: faker.internet.userName(),
        displayName: faker.person.fullName(),
        verified: faker.datatype.boolean(0.1),
        followerCount: faker.number.int({ min: 100, max: 1000000 }),
        influence: faker.number.float({ min: 0.1, max: 1.0 })
      },
      timestamp: options.timestamp || new Date(),
      engagement: options.engagement || {
        likes: faker.number.int({ min: 0, max: 50000 }),
        shares: faker.number.int({ min: 0, max: 5000 }),
        comments: faker.number.int({ min: 0, max: 2000 }),
        views: faker.number.int({ min: 1000, max: 500000 })
      },
      entities: options.entities || {
        tokens: faker.helpers.arrayElements(this.cryptoSymbols, 3),
        protocols: faker.helpers.arrayElements(this.defiProtocols, 2),
        hashtags: faker.helpers.arrayElements(['#DeFi', '#Yield', '#Staking'], 2),
        mentions: [],
        urls: []
      },
      sentiment: options.sentiment || {
        overall: faker.helpers.arrayElement(['bullish', 'bearish', 'neutral']),
        confidence: faker.number.float({ min: 0.5, max: 1.0 }),
        emotions: {
          joy: faker.number.float({ min: 0, max: 1 }),
          optimism: faker.number.float({ min: 0, max: 1 }),
          fear: faker.number.float({ min: 0, max: 1 }),
          anger: faker.number.float({ min: 0, max: 1 }),
          surprise: faker.number.float({ min: 0, max: 1 })
        }
      },
      ...options
    };
  }

  createInfluencerData(options: Partial<any> = {}): any {
    return {
      id: options.id || `influencer_${faker.string.alphanumeric(8)}`,
      username: options.username || faker.internet.userName(),
      platform: options.platform || faker.helpers.arrayElement(this.socialPlatforms),
      followerCount: options.followerCount || faker.number.int({ min: 10000, max: 5000000 }),
      verified: options.verified || faker.datatype.boolean(0.3),
      influence: options.influence || faker.number.float({ min: 0.3, max: 1.0 }),
      expertise: options.expertise || faker.helpers.arrayElements(['defi', 'trading', 'analysis', 'tech'], 2),
      recentSentiment: options.recentSentiment || faker.helpers.arrayElement(['bullish', 'bearish', 'neutral']),
      engagementRate: options.engagementRate || faker.number.float({ min: 0.01, max: 0.15 }),
      credibilityScore: options.credibilityScore || faker.number.float({ min: 0.5, max: 1.0 }),
      ...options
    };
  }

  // ========================================
  // PULSE SATELLITE DATA FACTORIES
  // ========================================

  createYieldOpportunity(options: Partial<YieldOpportunity> = {}): YieldOpportunity {
    return {
      id: options.id || `yield_opp_${faker.string.alphanumeric(8)}`,
      protocol: options.protocol || faker.helpers.arrayElement(this.defiProtocols),
      chain: options.chain || faker.helpers.arrayElement(this.blockchains),
      asset: options.asset || faker.helpers.arrayElement(this.cryptoSymbols),
      strategy: options.strategy || {
        type: faker.helpers.arrayElement([StrategyType.LENDING, StrategyType.YIELD_FARMING, StrategyType.LIQUID_STAKING]),
        name: `${faker.company.name()} Strategy`,
        description: faker.lorem.sentences(2),
        complexity: faker.helpers.arrayElement(['simple', 'intermediate', 'advanced'] as const),
        components: [],
        allocations: [],
        rebalanceFrequency: faker.number.int({ min: 3600, max: 86400 }),
        exitStrategy: {
          triggers: [],
          maxSlippage: 0.05,
          timeoutDuration: 3600,
          emergencyWithdrawal: true,
          partialExitAllowed: true
        },
        gasEfficiency: faker.number.float({ min: 0.5, max: 1.0 })
      },
      apy: options.apy || {
        current: faker.number.float({ min: 0.01, max: 0.25 }),
        historical: Array.from({ length: 30 }, () => faker.number.float({ min: 0.01, max: 0.30 })),
        projected: faker.number.float({ min: 0.01, max: 0.20 }),
        confidence: faker.number.float({ min: 0.6, max: 0.95 }),
        trend: faker.helpers.arrayElement(['increasing', 'decreasing', 'stable'] as const)
      },
      tvl: options.tvl || faker.number.float({ min: 1000000, max: 1000000000 }),
      liquidity: {
        depth: faker.number.float({ min: 100000, max: 10000000 }),
        withdrawalTime: faker.number.int({ min: 60, max: 3600 }),
        fees: faker.number.float({ min: 0.001, max: 0.01 })
      },
      risk: options.risk || faker.helpers.arrayElement(['low', 'medium', 'high']),
      lockPeriod: options.lockPeriod || faker.number.int({ min: 0, max: 365 }),
      minimumDeposit: options.minimumDeposit || faker.number.float({ min: 0.01, max: 1000 }),
      fees: options.fees || {
        deposit: faker.number.float({ min: 0, max: 0.01 }),
        withdrawal: faker.number.float({ min: 0, max: 0.01 }),
        performance: faker.number.float({ min: 0, max: 0.2 })
      },
      ...options
    };
  }

  createValidatorInfo(options: Partial<ValidatorInfo> = {}): ValidatorInfo {
    return {
      id: options.id || `validator_${faker.string.alphanumeric(8)}`,
      name: options.name || `${faker.company.name()} Validator`,
      chain: options.chain || faker.helpers.arrayElement(['ethereum', 'polygon', 'avalanche']),
      address: options.address || `0x${faker.string.hexadecimal({ length: 40, casing: 'lower' })}`,
      commission: options.commission || faker.number.float({ min: 0.01, max: 0.15 }),
      apy: options.apy || faker.number.float({ min: 0.03, max: 0.12 }),
      totalStaked: options.totalStaked || faker.number.float({ min: 1000, max: 100000 }),
      uptime: options.uptime || faker.number.float({ min: 0.95, max: 1.0 }),
      reputation: options.reputation || faker.number.float({ min: 0.7, max: 1.0 }),
      slashingHistory: options.slashingHistory || [],
      performance: options.performance || {
        averageBlockTime: faker.number.float({ min: 10, max: 15 }),
        missedBlocks: faker.number.int({ min: 0, max: 10 }),
        totalBlocks: faker.number.int({ min: 1000, max: 100000 })
      },
      ...options
    };
  }

  createPortfolioOptimization(options: Partial<PortfolioOptimization> = {}): PortfolioOptimization {
    const assets = faker.helpers.arrayElements(this.cryptoSymbols, 8);
    
    return {
      id: options.id || `portfolio_opt_${faker.string.alphanumeric(8)}`,
      assets: options.assets || assets,
      weights: options.weights || this.generateNormalizedWeights(assets.length),
      expectedReturn: options.expectedReturn || faker.number.float({ min: 0.05, max: 0.3 }),
      volatility: options.volatility || faker.number.float({ min: 0.1, max: 0.8 }),
      sharpeRatio: options.sharpeRatio || faker.number.float({ min: 0.5, max: 3.0 }),
      maxDrawdown: options.maxDrawdown || faker.number.float({ min: 0.1, max: 0.5 }),
      riskScore: options.riskScore || faker.number.float({ min: 1, max: 10 }),
      rebalanceFrequency: options.rebalanceFrequency || faker.helpers.arrayElement(['daily', 'weekly', 'monthly']),
      constraints: options.constraints || {
        maxSingleAsset: faker.number.float({ min: 0.2, max: 0.5 }),
        minAssetWeight: faker.number.float({ min: 0.01, max: 0.05 }),
        allowShort: faker.datatype.boolean(0.3)
      },
      ...options
    };
  }

  // ========================================
  // SAGE SATELLITE DATA FACTORIES
  // ========================================

  createRWAAsset(options: Partial<RWAAsset> = {}): RWAAsset {
    return {
      id: options.id || `rwa_asset_${faker.string.alphanumeric(8)}`,
      name: options.name || `${faker.company.name()} ${faker.helpers.arrayElement(['Fund', 'Trust', 'REIT'])}`,
      type: options.type || faker.helpers.arrayElement(['real_estate', 'bonds', 'commodities', 'private_equity']),
      issuer: options.issuer || faker.company.name(),
      totalValue: options.totalValue || faker.number.float({ min: 10000000, max: 1000000000 }),
      tokenSupply: options.tokenSupply || faker.number.float({ min: 1000000, max: 100000000 }),
      tokenAddress: options.tokenAddress || `0x${faker.string.hexadecimal({ length: 40, casing: 'lower' })}`,
      chain: options.chain || faker.helpers.arrayElement(this.blockchains),
      underlyingAssets: options.underlyingAssets || this.generateUnderlyingAssets(),
      custodian: options.custodian || {
        name: faker.helpers.arrayElement(['State Street', 'BNY Mellon', 'JPMorgan Chase']),
        address: faker.location.streetAddress(),
        licenses: faker.helpers.arrayElements(['OCC', 'Federal Reserve', 'SEC'], 2),
        insurance: 'FDIC',
        auditFirm: faker.helpers.arrayElement(['KPMG', 'Deloitte', 'PwC', 'EY'])
      },
      compliance: options.compliance || {
        status: faker.helpers.arrayElement(['compliant', 'pending', 'non_compliant']),
        frameworks: faker.helpers.arrayElements(this.regulatoryFrameworks, 3),
        lastAudit: faker.date.recent({ days: 180 }),
        nextAudit: faker.date.future({ years: 1 }),
        jurisdiction: faker.helpers.arrayElement(['US', 'EU', 'UK', 'CA'])
      },
      ...options
    };
  }

  createComplianceCheck(options: Partial<ComplianceCheck> = {}): ComplianceCheck {
    return {
      id: options.id || `compliance_${faker.string.alphanumeric(8)}`,
      assetId: options.assetId || `rwa_asset_${faker.string.alphanumeric(8)}`,
      framework: options.framework || faker.helpers.arrayElement(this.regulatoryFrameworks),
      checkType: options.checkType || faker.helpers.arrayElement(['registration', 'disclosure', 'reporting', 'audit']),
      status: options.status || faker.helpers.arrayElement(['passed', 'failed', 'pending', 'review']),
      details: options.details || {
        registrationNumber: `REG-${faker.string.alphanumeric(8)}`,
        filingDate: faker.date.recent({ days: 30 }),
        complianceOfficer: faker.person.fullName(),
        requirements: faker.helpers.arrayElements(['Form D filing', 'Quarterly reports', 'Annual audit'], 3),
        violations: [],
        recommendations: []
      },
      timestamp: options.timestamp || new Date(),
      expiryDate: options.expiryDate || faker.date.future({ years: 1 }),
      nextReview: options.nextReview || faker.date.future({ days: 90 }),
      ...options
    };
  }

  createAuditEvent(options: Partial<AuditEvent> = {}): AuditEvent {
    return {
      id: options.id || `audit_${faker.string.alphanumeric(8)}`,
      timestamp: options.timestamp || new Date(),
      userId: options.userId || `user_${faker.string.alphanumeric(6)}`,
      action: options.action || faker.helpers.arrayElement(['create', 'update', 'delete', 'view', 'approve']),
      resource: options.resource || faker.helpers.arrayElement(['asset', 'compliance', 'report', 'document']),
      resourceId: options.resourceId || faker.string.alphanumeric(10),
      details: options.details || {
        ip: faker.internet.ip(),
        userAgent: faker.internet.userAgent(),
        location: faker.location.city(),
        sessionId: faker.string.alphanumeric(16)
      },
      result: options.result || faker.helpers.arrayElement(['success', 'failure', 'partial']),
      ...options
    };
  }

  // ========================================
  // AEGIS SATELLITE DATA FACTORIES
  // ========================================

  createSecurityThreat(options: Partial<SecurityThreat> = {}): SecurityThreat {
    return {
      id: options.id || `threat_${faker.string.alphanumeric(8)}`,
      type: options.type || faker.helpers.arrayElement(['ddos', 'price_manipulation', 'smart_contract_exploit', 'phishing']),
      severity: options.severity || faker.helpers.arrayElement(['low', 'medium', 'high', 'critical']),
      source: options.source || faker.internet.ip(),
      target: options.target || faker.helpers.arrayElement(['oracle', 'echo', 'pulse', 'sage']),
      description: options.description || `${faker.hacker.noun()} ${faker.hacker.verb()} detected`,
      indicators: options.indicators || {
        ips: [faker.internet.ip(), faker.internet.ip()],
        domains: [faker.internet.domainName()],
        hashes: [`0x${faker.string.hexadecimal({ length: 64, casing: 'lower' })}`],
        patterns: [faker.hacker.phrase()]
      },
      confidence: options.confidence || faker.number.float({ min: 0.5, max: 1.0 }),
      timestamp: options.timestamp || new Date(),
      status: options.status || faker.helpers.arrayElement(['detected', 'investigating', 'mitigated', 'resolved']),
      ...options
    };
  }

  createSecurityIncident(options: Partial<SecurityIncident> = {}): SecurityIncident {
    return {
      id: options.id || `incident_${faker.string.alphanumeric(8)}`,
      title: options.title || `${faker.hacker.noun()} ${faker.hacker.verb()} Incident`,
      description: options.description || faker.hacker.phrase(),
      severity: options.severity || faker.helpers.arrayElement(['low', 'medium', 'high', 'critical']),
      category: options.category || faker.helpers.arrayElement(['breach', 'malware', 'unauthorized_access', 'data_leak']),
      affectedSystems: options.affectedSystems || faker.helpers.arrayElements(['oracle', 'echo', 'pulse'], 2),
      timeline: options.timeline || {
        detected: faker.date.recent({ days: 1 }),
        reported: faker.date.recent({ days: 1 }),
        investigated: faker.date.recent({ days: 1 }),
        contained: faker.date.recent({ days: 1 }),
        resolved: null
      },
      status: options.status || faker.helpers.arrayElement(['open', 'investigating', 'contained', 'resolved']),
      assignee: options.assignee || faker.person.fullName(),
      ...options
    };
  }

  // ========================================
  // FORGE SATELLITE DATA FACTORIES
  // ========================================

  createTradeOrder(options: Partial<TradeOrder> = {}): TradeOrder {
    return {
      id: options.id || `order_${faker.string.alphanumeric(8)}`,
      type: options.type || faker.helpers.arrayElement(['market', 'limit', 'stop', 'stop_limit']),
      side: options.side || faker.helpers.arrayElement(['buy', 'sell']),
      asset: options.asset || faker.helpers.arrayElement(this.cryptoSymbols),
      quantity: options.quantity || faker.number.float({ min: 0.01, max: 100 }),
      price: options.price || this.getRealisticPrice(options.asset || 'BTC'),
      timestamp: options.timestamp || new Date(),
      status: options.status || faker.helpers.arrayElement(['pending', 'filled', 'partial', 'cancelled']),
      exchange: options.exchange || faker.helpers.arrayElement(['binance', 'coinbase', 'kraken', 'uniswap']),
      fees: options.fees || {
        trading: faker.number.float({ min: 0.001, max: 0.01 }),
        gas: faker.number.float({ min: 0.001, max: 0.05 }),
        slippage: faker.number.float({ min: 0.001, max: 0.02 })
      },
      ...options
    };
  }

  createLiquidityPool(options: Partial<LiquidityPool> = {}): LiquidityPool {
    const token0 = faker.helpers.arrayElement(this.cryptoSymbols);
    const token1 = faker.helpers.arrayElement(this.cryptoSymbols.filter(s => s !== token0));

    return {
      id: options.id || `pool_${faker.string.alphanumeric(8)}`,
      protocol: options.protocol || faker.helpers.arrayElement(this.defiProtocols),
      chain: options.chain || faker.helpers.arrayElement(this.blockchains),
      token0: options.token0 || token0,
      token1: options.token1 || token1,
      reserve0: options.reserve0 || faker.number.float({ min: 1000, max: 1000000 }),
      reserve1: options.reserve1 || faker.number.float({ min: 1000, max: 1000000 }),
      fee: options.fee || faker.number.float({ min: 0.0005, max: 0.01 }),
      apr: options.apr || faker.number.float({ min: 0.01, max: 0.5 }),
      tvl: options.tvl || faker.number.float({ min: 100000, max: 100000000 }),
      volume24h: options.volume24h || faker.number.float({ min: 10000, max: 10000000 }),
      ...options
    };
  }

  createCrossChainTransaction(options: Partial<CrossChainTransaction> = {}): CrossChainTransaction {
    return {
      id: options.id || `cross_chain_tx_${faker.string.alphanumeric(8)}`,
      sourceChain: options.sourceChain || faker.helpers.arrayElement(this.blockchains),
      destinationChain: options.destinationChain || faker.helpers.arrayElement(this.blockchains),
      asset: options.asset || faker.helpers.arrayElement(this.cryptoSymbols),
      amount: options.amount || faker.number.float({ min: 0.1, max: 1000 }),
      sender: options.sender || `0x${faker.string.hexadecimal({ length: 40, casing: 'lower' })}`,
      recipient: options.recipient || `0x${faker.string.hexadecimal({ length: 40, casing: 'lower' })}`,
      bridge: options.bridge || faker.helpers.arrayElement(['LayerZero', 'Wormhole', 'Axelar']),
      status: options.status || faker.helpers.arrayElement(['pending', 'confirmed', 'failed']),
      fees: options.fees || {
        sourceFee: faker.number.float({ min: 0.001, max: 0.01 }),
        destinationFee: faker.number.float({ min: 0.001, max: 0.01 }),
        bridgeFee: faker.number.float({ min: 0.001, max: 0.01 })
      },
      estimatedTime: options.estimatedTime || faker.number.int({ min: 60, max: 3600 }),
      timestamp: options.timestamp || new Date(),
      ...options
    };
  }

  // ========================================
  // BRIDGE SATELLITE DATA FACTORIES
  // ========================================

  createCrossChainMessage(options: Partial<CrossChainMessage> = {}): CrossChainMessage {
    return {
      id: options.id || `msg_${faker.string.alphanumeric(12)}`,
      sourceChain: options.sourceChain || faker.helpers.arrayElement(this.blockchains),
      destinationChain: options.destinationChain || faker.helpers.arrayElement(this.blockchains),
      messageType: options.messageType || faker.helpers.arrayElement(['token_transfer', 'data_message', 'function_call']),
      payload: options.payload || {
        recipient: `0x${faker.string.hexadecimal({ length: 40, casing: 'lower' })}`,
        amount: faker.number.float({ min: 0.1, max: 1000 }).toString(),
        data: `0x${faker.string.hexadecimal({ length: 64, casing: 'lower' })}`
      },
      sequenceNumber: options.sequenceNumber || faker.number.int({ min: 1, max: 1000000 }),
      timestamp: options.timestamp || new Date(),
      relayerInfo: options.relayerInfo || {
        relayerId: `relayer_${faker.string.alphanumeric(6)}`,
        reputation: faker.number.float({ min: 0.8, max: 1.0 }),
        stake: faker.number.float({ min: 10, max: 1000 }).toString(),
        commission: faker.number.float({ min: 0.001, max: 0.01 })
      },
      proof: options.proof || {
        merkleRoot: `0x${faker.string.hexadecimal({ length: 64, casing: 'lower' })}`,
        merkleProof: Array(4).fill(null).map(() => `0x${faker.string.hexadecimal({ length: 64, casing: 'lower' })}`),
        validators: Array(3).fill(null).map(() => `0x${faker.string.hexadecimal({ length: 40, casing: 'lower' })}`),
        signatures: Array(3).fill(null).map(() => `0x${faker.string.hexadecimal({ length: 128, casing: 'lower' })}`)
      },
      status: options.status || faker.helpers.arrayElement(['pending', 'confirmed', 'failed']),
      ...options
    };
  }

  createBridgeTransaction(options: Partial<BridgeTransaction> = {}): BridgeTransaction {
    return {
      id: options.id || `bridge_tx_${faker.string.alphanumeric(8)}`,
      messageId: options.messageId || `msg_${faker.string.alphanumeric(12)}`,
      sourceChain: options.sourceChain || faker.helpers.arrayElement(this.blockchains),
      destinationChain: options.destinationChain || faker.helpers.arrayElement(this.blockchains),
      sourceTransaction: options.sourceTransaction || `0x${faker.string.hexadecimal({ length: 64, casing: 'lower' })}`,
      destinationTransaction: options.destinationTransaction || `0x${faker.string.hexadecimal({ length: 64, casing: 'lower' })}`,
      amount: options.amount || faker.number.float({ min: 0.1, max: 1000 }).toString(),
      tokenAddress: options.tokenAddress || `0x${faker.string.hexadecimal({ length: 40, casing: 'lower' })}`,
      sender: options.sender || `0x${faker.string.hexadecimal({ length: 40, casing: 'lower' })}`,
      recipient: options.recipient || `0x${faker.string.hexadecimal({ length: 40, casing: 'lower' })}`,
      status: options.status || faker.helpers.arrayElement(['initiated', 'confirmed', 'executed', 'failed']),
      timestamps: options.timestamps || {
        initiated: faker.date.recent({ days: 1 }),
        confirmed: faker.date.recent({ days: 1 }),
        executed: faker.date.recent({ days: 1 }),
        finalized: new Date()
      },
      fees: options.fees || {
        sourceFee: faker.number.float({ min: 0.001, max: 0.01 }).toString(),
        destinationFee: faker.number.float({ min: 0.001, max: 0.01 }).toString(),
        relayerFee: faker.number.float({ min: 0.0005, max: 0.005 }).toString(),
        protocolFee: faker.number.float({ min: 0.0001, max: 0.001 }).toString()
      },
      ...options
    };
  }

  // ========================================
  // UTILITY METHODS
  // ========================================

  private getRealisticPrice(symbol: string): number {
    const priceMap: Record<string, number> = {
      'BTC': 45000,
      'ETH': 3200,
      'USDC': 1.00,
      'USDT': 1.00,
      'BNB': 300,
      'ADA': 0.5,
      'SOL': 100,
      'XRP': 0.6,
      'DOT': 8,
      'AVAX': 25,
      'MATIC': 0.8,
      'LINK': 15,
      'UNI': 7,
      'LTC': 70,
      'BCH': 250
    };

    return priceMap[symbol] || faker.number.float({ min: 0.01, max: 1000 });
  }

  private addVariance(value: number, variance: number): number {
    const multiplier = 1 + (faker.number.float({ min: -variance, max: variance }));
    return value * multiplier;
  }

  private generateNormalizedWeights(count: number): number[] {
    const weights = Array(count).fill(null).map(() => faker.number.float({ min: 0.1, max: 1 }));
    const sum = weights.reduce((acc, weight) => acc + weight, 0);
    return weights.map(weight => weight / sum);
  }

  private generateUnderlyingAssets(): any[] {
    return Array(faker.number.int({ min: 1, max: 5 })).fill(null).map(() => ({
      type: faker.helpers.arrayElement(['US Treasury Bill', 'Corporate Bond', 'Real Estate', 'Commodity']),
      cusip: faker.string.alphanumeric(9).toUpperCase(),
      value: faker.number.float({ min: 1000000, max: 50000000 }),
      maturityDate: faker.date.future({ years: 5 }),
      yieldRate: faker.number.float({ min: 0.02, max: 0.08 }),
      rating: faker.helpers.arrayElement(['AAA', 'AA', 'A', 'BBB', 'BB'])
    }));
  }

  private generateCryptoSentimentText(): string {
    const sentiments = [
      'Bitcoin is looking bullish with strong institutional adoption! 🚀',
      'DeFi yields are incredible right now, especially on Ethereum Layer 2s',
      'Market volatility is high, but HODLing has always been the way',
      'New protocol launch showing promising TVL growth',
      'Bearish sentiment in traditional markets affecting crypto prices',
      'Staking rewards are providing steady passive income',
      'Cross-chain bridges making DeFi more accessible',
      'Yield farming opportunities in emerging protocols',
      'NFT market correlation with broader crypto trends',
      'Regulatory clarity needed for institutional adoption'
    ];

    return faker.helpers.arrayElement(sentiments);
  }

  // ========================================
  // BATCH GENERATION METHODS
  // ========================================

  generateBatchData<T>(
    factory: (options?: any) => T,
    count: number,
    options: GenerationOptions = {}
  ): T[] {
    return Array(count).fill(null).map(() => factory(options));
  }

  generateTimeSeriesData<T>(
    factory: (options?: any) => T,
    count: number,
    startDate: Date = new Date(Date.now() - 86400000), // 24 hours ago
    endDate: Date = new Date(),
    options: GenerationOptions = {}
  ): T[] {
    const interval = (endDate.getTime() - startDate.getTime()) / count;
    
    return Array(count).fill(null).map((_, index) => {
      const timestamp = new Date(startDate.getTime() + (interval * index));
      return factory({ ...options, timestamp });
    });
  }

  generateCorrelatedData<T>(
    factory: (options?: any) => T,
    count: number,
    correlationField: string,
    correlationStrength: number = 0.8,
    options: GenerationOptions = {}
  ): T[] {
    const baseValue = faker.number.float({ min: 0, max: 1 });
    
    return Array(count).fill(null).map(() => {
      const correlatedValue = correlationStrength * baseValue + 
                             (1 - correlationStrength) * faker.number.float({ min: 0, max: 1 });
      
      return factory({
        ...options,
        [correlationField]: correlatedValue
      });
    });
  }

  // ========================================
  // CONFIGURATION AND RESET
  // ========================================

  updateConfig(newConfig: Partial<DataFactoryConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    if (newConfig.seed) {
      faker.seed(newConfig.seed);
    }
  }

  resetToDefaults(): void {
    this.config = {
      locale: 'en',
      seed: 12345,
      realistic: true,
      variance: 0.2,
      timeZone: 'UTC'
    };
    
    faker.seed(12345);
  }

  // Seed management for deterministic tests
  setSeed(seed: number): void {
    this.config.seed = seed;
    faker.seed(seed);
  }

  getCurrentSeed(): number | undefined {
    return this.config.seed;
  }
}

// Export singleton instance
export const testDataFactory = new TestDataFactory();

// Export individual factory functions for convenience
export const createOracleFeed = testDataFactory.createOracleFeed.bind(testDataFactory);
export const createSentimentData = testDataFactory.createSentimentData.bind(testDataFactory);
export const createYieldOpportunity = testDataFactory.createYieldOpportunity.bind(testDataFactory);
export const createRWAAsset = testDataFactory.createRWAAsset.bind(testDataFactory);
export const createSecurityThreat = testDataFactory.createSecurityThreat.bind(testDataFactory);
export const createTradeOrder = testDataFactory.createTradeOrder.bind(testDataFactory);
export const createCrossChainMessage = testDataFactory.createCrossChainMessage.bind(testDataFactory);