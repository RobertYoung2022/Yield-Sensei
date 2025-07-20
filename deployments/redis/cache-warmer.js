#!/usr/bin/env node

const Redis = require('ioredis');

// Configuration
const config = {
  host: process.env.REDIS_MASTER_HOST || 'localhost',
  port: process.env.REDIS_MASTER_PORT || 6379,
  password: process.env.REDIS_PASSWORD || '',
  warmInterval: parseInt(process.env.CACHE_WARM_INTERVAL) || 300, // 5 minutes
  keyPrefix: 'yieldsensei:',
};

// Mock data for cache warming (replace with actual data sources)
const mockData = {
  // Popular protocol data
  protocols: [
    { id: 'uniswap-v3', name: 'Uniswap V3', tvl: 4200000000, apy: 0.15 },
    { id: 'aave', name: 'Aave', tvl: 6500000000, apy: 0.08 },
    { id: 'compound', name: 'Compound', tvl: 3100000000, apy: 0.12 },
  ],
  
  // Popular token prices
  tokenPrices: {
    'eth': { price: 2500, change24h: 0.025 },
    'btc': { price: 45000, change24h: -0.015 },
    'usdc': { price: 1.001, change24h: 0.001 },
    'dai': { price: 0.999, change24h: -0.001 },
  },
  
  // Top pools by TVL
  topPools: [
    { id: 'eth-usdc-0.3', protocol: 'uniswap-v3', tvl: 125000000, apy: 0.18 },
    { id: 'wbtc-eth-0.3', protocol: 'uniswap-v3', tvl: 89000000, apy: 0.22 },
    { id: 'usdc-dai-0.01', protocol: 'uniswap-v3', tvl: 67000000, apy: 0.05 },
  ],
  
  // Market metrics
  marketMetrics: {
    totalTvl: 15800000000,
    totalVolume24h: 2100000000,
    activeProtocols: 127,
    topGainer: { symbol: 'COMP', change: 0.15 },
    topLoser: { symbol: 'UNI', change: -0.08 },
  }
};

class CacheWarmer {
  constructor() {
    this.redis = new Redis(config);
    this.isConnected = false;
    
    this.setupEventListeners();
  }
  
  setupEventListeners() {
    this.redis.on('connect', () => {
      console.log('[INFO] Connected to Redis');
      this.isConnected = true;
    });
    
    this.redis.on('error', (error) => {
      console.error('[ERROR] Redis connection error:', error);
      this.isConnected = false;
    });
    
    this.redis.on('close', () => {
      console.log('[WARN] Redis connection closed');
      this.isConnected = false;
    });
  }
  
  /**
   * Warm cache with protocol data
   */
  async warmProtocolData() {
    console.log('[INFO] Warming protocol data...');
    
    for (const protocol of mockData.protocols) {
      const key = `protocol:${protocol.id}`;
      await this.redis.setex(key, 3600, JSON.stringify(protocol)); // 1 hour TTL
      
      // Add to protocols list
      await this.redis.sadd('protocols:list', protocol.id);
      await this.redis.expire('protocols:list', 3600);
    }
    
    // Cache protocol rankings
    const rankings = mockData.protocols
      .sort((a, b) => b.tvl - a.tvl)
      .map((p, index) => ({ ...p, rank: index + 1 }));
    
    await this.redis.setex('protocols:rankings:tvl', 1800, JSON.stringify(rankings)); // 30 min TTL
    
    console.log(`[INFO] Cached ${mockData.protocols.length} protocols`);
  }
  
  /**
   * Warm cache with token price data
   */
  async warmTokenPrices() {
    console.log('[INFO] Warming token price data...');
    
    for (const [symbol, data] of Object.entries(mockData.tokenPrices)) {
      const key = `price:${symbol}`;
      await this.redis.setex(key, 300, JSON.stringify(data)); // 5 min TTL
    }
    
    // Cache all prices in one key for quick access
    await this.redis.setex('prices:all', 300, JSON.stringify(mockData.tokenPrices));
    
    console.log(`[INFO] Cached ${Object.keys(mockData.tokenPrices).length} token prices`);
  }
  
  /**
   * Warm cache with pool data
   */
  async warmPoolData() {
    console.log('[INFO] Warming pool data...');
    
    for (const pool of mockData.topPools) {
      const key = `pool:${pool.id}`;
      await this.redis.setex(key, 1800, JSON.stringify(pool)); // 30 min TTL
    }
    
    // Cache top pools ranking
    const sortedPools = mockData.topPools.sort((a, b) => b.tvl - a.tvl);
    await this.redis.setex('pools:top:tvl', 1800, JSON.stringify(sortedPools));
    
    console.log(`[INFO] Cached ${mockData.topPools.length} pools`);
  }
  
  /**
   * Warm cache with market metrics
   */
  async warmMarketMetrics() {
    console.log('[INFO] Warming market metrics...');
    
    // Cache individual metrics
    for (const [metric, value] of Object.entries(mockData.marketMetrics)) {
      const key = `metric:${metric}`;
      await this.redis.setex(key, 600, JSON.stringify(value)); // 10 min TTL
    }
    
    // Cache all metrics together
    await this.redis.setex('metrics:market:all', 600, JSON.stringify(mockData.marketMetrics));
    
    console.log('[INFO] Cached market metrics');
  }
  
  /**
   * Warm frequently accessed user data patterns
   */
  async warmUserDataPatterns() {
    console.log('[INFO] Warming user data patterns...');
    
    // Common user queries cache keys
    const commonQueries = [
      'user:portfolio:summary',
      'user:transactions:recent',
      'user:yields:best',
      'user:notifications:unread',
    ];
    
    for (const query of commonQueries) {
      // Pre-allocate space for these keys with empty data
      await this.redis.setex(`template:${query}`, 1800, JSON.stringify({ cached_at: Date.now() }));
    }
    
    console.log('[INFO] Warmed user data patterns');
  }
  
  /**
   * Warm analytics aggregations
   */
  async warmAnalyticsData() {
    console.log('[INFO] Warming analytics data...');
    
    // TVL history (last 30 days)
    const tvlHistory = Array.from({ length: 30 }, (_, i) => ({
      date: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      tvl: mockData.marketMetrics.totalTvl + Math.random() * 1000000000 - 500000000,
    })).reverse();
    
    await this.redis.setex('analytics:tvl:30d', 3600, JSON.stringify(tvlHistory)); // 1 hour TTL
    
    // Volume history
    const volumeHistory = Array.from({ length: 24 }, (_, i) => ({
      hour: i,
      volume: Math.random() * 100000000,
    }));
    
    await this.redis.setex('analytics:volume:24h', 1800, JSON.stringify(volumeHistory)); // 30 min TTL
    
    console.log('[INFO] Cached analytics data');
  }
  
  /**
   * Run complete cache warming cycle
   */
  async warmCache() {
    if (!this.isConnected) {
      console.log('[WARN] Redis not connected, skipping cache warming');
      return;
    }
    
    const startTime = Date.now();
    console.log('[INFO] Starting cache warming cycle...');
    
    try {
      await Promise.all([
        this.warmProtocolData(),
        this.warmTokenPrices(),
        this.warmPoolData(),
        this.warmMarketMetrics(),
        this.warmUserDataPatterns(),
        this.warmAnalyticsData(),
      ]);
      
      const duration = Date.now() - startTime;
      console.log(`[INFO] Cache warming completed in ${duration}ms`);
      
      // Update last warming timestamp
      await this.redis.set('cache:last_warmed', Date.now());
      
    } catch (error) {
      console.error('[ERROR] Cache warming failed:', error);
    }
  }
  
  /**
   * Get cache statistics
   */
  async getCacheStats() {
    try {
      const info = await this.redis.info('memory');
      const dbsize = await this.redis.dbsize();
      const lastWarmed = await this.redis.get('cache:last_warmed');
      
      console.log('[INFO] Cache Statistics:');
      console.log(`  Keys: ${dbsize}`);
      console.log(`  Last warmed: ${lastWarmed ? new Date(parseInt(lastWarmed)).toISOString() : 'Never'}`);
      
      // Memory info
      const memLines = info.split('\n').filter(line => 
        line.includes('used_memory_human') || 
        line.includes('used_memory_peak_human')
      );
      memLines.forEach(line => console.log(`  ${line}`));
      
    } catch (error) {
      console.error('[ERROR] Failed to get cache stats:', error);
    }
  }
  
  /**
   * Start the cache warming service
   */
  async start() {
    console.log('[INFO] Starting Redis Cache Warmer for YieldSensei');
    console.log(`[INFO] Warming interval: ${config.warmInterval} seconds`);
    
    // Initial warming
    await this.warmCache();
    await this.getCacheStats();
    
    // Set up periodic warming
    setInterval(async () => {
      await this.warmCache();
      await this.getCacheStats();
    }, config.warmInterval * 1000);
    
    console.log('[INFO] Cache warmer service started');
  }
  
  /**
   * Graceful shutdown
   */
  async shutdown() {
    console.log('[INFO] Shutting down cache warmer...');
    await this.redis.quit();
    process.exit(0);
  }
}

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  if (warmer) {
    await warmer.shutdown();
  }
});

process.on('SIGINT', async () => {
  if (warmer) {
    await warmer.shutdown();
  }
});

// Start the cache warmer
const warmer = new CacheWarmer();
warmer.start().catch(error => {
  console.error('[ERROR] Failed to start cache warmer:', error);
  process.exit(1);
}); 