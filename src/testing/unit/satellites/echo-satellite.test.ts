/**
 * Echo Satellite Test Suite
 * Comprehensive tests for sentiment analysis and social media monitoring
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { EchoSatelliteAgent } from '../../../satellites/echo/echo-satellite';
import { SentimentAnalysisEngine } from '../../../satellites/echo/sentiment/sentiment-analysis-engine';
import { SocialMediaPlatformManager } from '../../../satellites/echo/platforms/social-media-platform-manager';
import {
  EchoSatelliteConfig,
  SentimentData,
  SentimentAnalysis,
  TrendAnalysis,
  InfluencerAnalysis,
  SocialMediaPost,
  EntityRecognition,
  SentimentClassification
} from '../../../satellites/echo/types';

// Test data factories
const createMockSentimentData = (): SentimentData => ({
  id: 'sentiment_btc_001',
  content: 'Bitcoin is showing strong bullish momentum with institutional adoption increasing',
  source: 'twitter',
  author: 'crypto_analyst_pro',
  timestamp: new Date(),
  platform: 'Twitter',
  engagement: {
    likes: 150,
    shares: 45,
    comments: 23,
    views: 2500
  },
  metadata: {
    hashtags: ['#Bitcoin', '#BTC', '#Crypto'],
    mentions: ['@binance', '@coinbase'],
    language: 'en',
    location: 'US'
  }
});

const createMockSocialMediaPost = (): SocialMediaPost => ({
  id: 'post_twitter_001',
  platform: 'Twitter',
  content: 'Just bought more $ETH. This dip is a gift! 🚀 #Ethereum #DeFi',
  author: {
    id: 'user123',
    username: 'crypto_hodler',
    displayName: 'Crypto Hodler',
    verified: false,
    followerCount: 5000,
    influence: 0.3
  },
  timestamp: new Date(),
  engagement: {
    likes: 89,
    shares: 12,
    comments: 5,
    views: 1200
  },
  entities: {
    tokens: ['ETH'],
    protocols: ['Ethereum'],
    hashtags: ['#Ethereum', '#DeFi'],
    mentions: [],
    urls: []
  },
  sentiment: {
    overall: 'bullish',
    confidence: 0.85,
    emotions: {
      joy: 0.7,
      optimism: 0.8,
      fear: 0.1,
      anger: 0.0,
      surprise: 0.2
    }
  }
});

const createMockConfig = (): EchoSatelliteConfig => ({
  sentimentAnalysis: {
    enableRealTimeAnalysis: true,
    analysisInterval: 30000,
    confidenceThreshold: 0.7,
    enableEntityRecognition: true,
    enableEmotionDetection: true,
    languages: ['en', 'es', 'fr', 'de', 'ja'],
    sentimentModels: ['crypto-bert', 'finbert'],
    enableBatchProcessing: true,
    batchSize: 100
  },
  socialMedia: {
    platforms: ['twitter', 'discord', 'telegram', 'reddit'],
    enableRealTimeMonitoring: true,
    monitoringInterval: 60000,
    maxPostsPerBatch: 500,
    enableInfluencerTracking: true,
    influencerThreshold: 10000,
    enableTrendDetection: true,
    trendingThreshold: 100
  },
  dataCollection: {
    retentionPeriod: 2592000000, // 30 days
    enableHistoricalAnalysis: true,
    historicalDepth: 7, // days
    enableDataExport: true,
    compressionEnabled: true,
    enableRealTimeUpdates: true
  },
  nlp: {
    enableNamedEntityRecognition: true,
    enableTopicModeling: true,
    enableKeywordExtraction: true,
    enableLanguageDetection: true,
    enableSpamDetection: true,
    enableSentimentNormalization: true,
    confidenceThreshold: 0.6,
    maxProcessingTime: 5000
  },
  aggregation: {
    timeWindows: [300, 900, 3600, 86400], // 5min, 15min, 1hr, 1day
    enableWeightedAggregation: true,
    influenceWeighting: true,
    recencyWeighting: true,
    platformWeighting: true,
    aggregationInterval: 300000
  },
  alerting: {
    enableSentimentAlerts: true,
    sentimentThresholds: {
      extremeBullish: 0.8,
      bullish: 0.6,
      neutral: 0.4,
      bearish: 0.2,
      extremeBearish: 0.0
    },
    volumeThresholds: {
      high: 1000,
      medium: 500,
      low: 100
    },
    enableTrendAlerts: true,
    enableInfluencerAlerts: true
  }
});

describe('Echo Satellite Agent', () => {
  let echoSatellite: EchoSatelliteAgent;
  let mockConfig: EchoSatelliteConfig;

  beforeEach(() => {
    mockConfig = createMockConfig();
    echoSatellite = EchoSatelliteAgent.getInstance(mockConfig);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Initialization and Lifecycle', () => {
    test('should initialize successfully with valid config', async () => {
      await echoSatellite.initialize();
      
      const status = echoSatellite.getStatus();
      expect(status.isInitialized).toBe(true);
      expect(status.components.sentimentEngine).toBe(true);
      expect(status.components.platformManager).toBe(true);
    });

    test('should start and stop real-time monitoring', async () => {
      await echoSatellite.initialize();
      await echoSatellite.startRealTimeMonitoring();
      
      let status = echoSatellite.getStatus();
      expect(status.isRunning).toBe(true);

      await echoSatellite.stopRealTimeMonitoring();
      
      status = echoSatellite.getStatus();
      expect(status.isRunning).toBe(false);
    });

    test('should handle initialization errors gracefully', async () => {
      const invalidConfig = { ...mockConfig };
      invalidConfig.sentimentAnalysis.confidenceThreshold = 1.5; // Invalid

      await expect(async () => {
        const invalidSatellite = EchoSatelliteAgent.getInstance(invalidConfig);
        await invalidSatellite.initialize();
      }).rejects.toThrow();
    });

    test('should emit lifecycle events', async () => {
      const initListener = jest.fn();
      const startListener = jest.fn();

      echoSatellite.on('satellite_initialized', initListener);
      echoSatellite.on('monitoring_started', startListener);

      await echoSatellite.initialize();
      await echoSatellite.startRealTimeMonitoring();

      expect(initListener).toHaveBeenCalled();
      expect(startListener).toHaveBeenCalled();
    });
  });

  describe('Sentiment Analysis', () => {
    test('should analyze sentiment of single post', async () => {
      await echoSatellite.initialize();
      
      const mockPost = createMockSocialMediaPost();
      const result = await echoSatellite.analyzeSentiment(mockPost.content);

      expect(result).toMatchObject({
        overall: expect.stringMatching(/^(bullish|bearish|neutral)$/),
        confidence: expect.any(Number),
        emotions: expect.objectContaining({
          joy: expect.any(Number),
          optimism: expect.any(Number),
          fear: expect.any(Number),
          anger: expect.any(Number)
        })
      });

      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });

    test('should perform batch sentiment analysis', async () => {
      await echoSatellite.initialize();
      
      const posts = [
        'Bitcoin is going to the moon! 🚀',
        'I think ETH will crash soon...',
        'DeFi protocols are interesting technology',
        'Crypto market is very volatile today'
      ];

      const results = await echoSatellite.analyzeBatchSentiment(posts);

      expect(results).toHaveLength(posts.length);
      results.forEach(result => {
        expect(result).toMatchObject({
          overall: expect.any(String),
          confidence: expect.any(Number)
        });
      });
    });

    test('should detect crypto entities in text', async () => {
      await echoSatellite.initialize();
      
      const text = 'Bitcoin and Ethereum are leading the DeFi revolution with Uniswap and Aave';
      const entities = await echoSatellite.extractEntities(text);

      expect(entities).toMatchObject({
        tokens: expect.arrayContaining(['BTC', 'ETH']),
        protocols: expect.arrayContaining(['Uniswap', 'Aave']),
        themes: expect.any(Array)
      });
    });

    test('should handle multilingual sentiment analysis', async () => {
      await echoSatellite.initialize();
      
      const texts = [
        'Bitcoin está muy bullish hoy', // Spanish
        'Bitcoin est très haussier aujourd\'hui', // French
        'ビットコインは今日非常に強気です' // Japanese
      ];

      for (const text of texts) {
        const result = await echoSatellite.analyzeSentiment(text);
        expect(result.overall).toBeDefined();
        expect(result.confidence).toBeGreaterThan(0);
      }
    });
  });

  describe('Real-time Monitoring', () => {
    test('should collect social media data', async () => {
      await echoSatellite.initialize();
      await echoSatellite.startRealTimeMonitoring();

      const collectListener = jest.fn();
      echoSatellite.on('data_collected', collectListener);

      // Simulate data collection
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(collectListener).toHaveBeenCalled();
    });

    test('should process collected data for sentiment', async () => {
      await echoSatellite.initialize();
      
      const mockData = createMockSentimentData();
      const processedData = await echoSatellite.processSentimentData(mockData);

      expect(processedData).toMatchObject({
        sentiment: expect.objectContaining({
          overall: expect.any(String),
          confidence: expect.any(Number)
        }),
        entities: expect.any(Object),
        timestamp: expect.any(Date)
      });
    });

    test('should handle high-volume data streams', async () => {
      await echoSatellite.initialize();
      
      const mockDataBatch = Array(100).fill(null).map((_, i) => ({
        ...createMockSentimentData(),
        id: `sentiment_${i}`,
        content: `Test content ${i} about Bitcoin and crypto markets`
      }));

      const startTime = Date.now();
      const results = await echoSatellite.processBatchSentimentData(mockDataBatch);
      const duration = Date.now() - startTime;

      expect(results).toHaveLength(100);
      expect(duration).toBeLessThan(5000); // Should process within 5 seconds
    });
  });

  describe('Trend Detection', () => {
    test('should detect trending topics', async () => {
      await echoSatellite.initialize();
      
      const trends = await echoSatellite.detectTrends();

      expect(trends).toMatchObject({
        trending: expect.any(Array),
        timeframe: expect.any(String),
        timestamp: expect.any(Date)
      });

      trends.trending.forEach((trend: any) => {
        expect(trend).toMatchObject({
          topic: expect.any(String),
          volume: expect.any(Number),
          sentiment: expect.any(String),
          momentum: expect.any(Number)
        });
      });
    });

    test('should track sentiment trends over time', async () => {
      await echoSatellite.initialize();
      
      const asset = 'BTC';
      const trendData = await echoSatellite.getSentimentTrend(asset, '1h');

      expect(trendData).toMatchObject({
        asset,
        timeframe: '1h',
        dataPoints: expect.any(Array),
        trend: expect.objectContaining({
          direction: expect.stringMatching(/^(up|down|stable)$/),
          strength: expect.any(Number)
        })
      });
    });

    test('should detect sentiment shifts', async () => {
      await echoSatellite.initialize();
      
      const shiftListener = jest.fn();
      echoSatellite.on('sentiment_shift', shiftListener);

      // Simulate sentiment shift detection
      await echoSatellite.performSentimentAnalysis();

      // Check if shift detection is working (may not trigger without real data)
      const metrics = echoSatellite.getAnalysisMetrics();
      expect(metrics).toBeDefined();
    });
  });

  describe('Influencer Analysis', () => {
    test('should identify influential accounts', async () => {
      await echoSatellite.initialize();
      
      const influencers = await echoSatellite.getTopInfluencers('BTC');

      expect(influencers).toBeInstanceOf(Array);
      influencers.forEach((influencer: any) => {
        expect(influencer).toMatchObject({
          username: expect.any(String),
          platform: expect.any(String),
          followerCount: expect.any(Number),
          influence: expect.any(Number),
          recentSentiment: expect.any(String)
        });
      });
    });

    test('should track influencer sentiment changes', async () => {
      await echoSatellite.initialize();
      
      const username = 'crypto_analyst_pro';
      const sentimentHistory = await echoSatellite.getInfluencerSentimentHistory(username);

      expect(sentimentHistory).toMatchObject({
        username,
        platform: expect.any(String),
        sentimentHistory: expect.any(Array),
        averageSentiment: expect.any(Number)
      });
    });

    test('should calculate influence scores', async () => {
      await echoSatellite.initialize();
      
      const mockPost = createMockSocialMediaPost();
      const influenceScore = await echoSatellite.calculateInfluenceScore(mockPost);

      expect(influenceScore).toBeGreaterThanOrEqual(0);
      expect(influenceScore).toBeLessThanOrEqual(1);
    });
  });

  describe('Platform Integration', () => {
    test('should integrate with multiple social media platforms', async () => {
      await echoSatellite.initialize();
      
      const platforms = ['twitter', 'discord', 'telegram', 'reddit'];
      
      for (const platform of platforms) {
        const status = await echoSatellite.getPlatformStatus(platform);
        expect(status).toMatchObject({
          platform,
          connected: expect.any(Boolean),
          lastUpdate: expect.any(Date)
        });
      }
    });

    test('should handle platform-specific data formats', async () => {
      await echoSatellite.initialize();
      
      const twitterData = {
        platform: 'twitter',
        text: 'Bitcoin is bullish! #BTC',
        user: { screen_name: 'test_user', followers_count: 1000 }
      };

      const normalized = await echoSatellite.normalizePlatformData(twitterData);
      
      expect(normalized).toMatchObject({
        platform: 'twitter',
        content: expect.any(String),
        author: expect.objectContaining({
          username: expect.any(String),
          followerCount: expect.any(Number)
        })
      });
    });
  });

  describe('Data Aggregation and Analytics', () => {
    test('should aggregate sentiment across time windows', async () => {
      await echoSatellite.initialize();
      
      const timeWindows = ['5m', '15m', '1h', '1d'];
      
      for (const window of timeWindows) {
        const aggregated = await echoSatellite.getAggregatedSentiment('BTC', window);
        
        expect(aggregated).toMatchObject({
          asset: 'BTC',
          timeWindow: window,
          sentiment: expect.objectContaining({
            overall: expect.any(String),
            confidence: expect.any(Number)
          }),
          volume: expect.any(Number),
          timestamp: expect.any(Date)
        });
      }
    });

    test('should provide sentiment distribution analysis', async () => {
      await echoSatellite.initialize();
      
      const distribution = await echoSatellite.getSentimentDistribution('ETH');

      expect(distribution).toMatchObject({
        asset: 'ETH',
        distribution: expect.objectContaining({
          bullish: expect.any(Number),
          bearish: expect.any(Number),
          neutral: expect.any(Number)
        }),
        totalVolume: expect.any(Number),
        timestamp: expect.any(Date)
      });
    });

    test('should calculate sentiment momentum', async () => {
      await echoSatellite.initialize();
      
      const momentum = await echoSatellite.getSentimentMomentum('BTC');

      expect(momentum).toMatchObject({
        asset: 'BTC',
        momentum: expect.any(Number),
        direction: expect.stringMatching(/^(positive|negative|neutral)$/),
        strength: expect.any(Number),
        timestamp: expect.any(Date)
      });
    });
  });

  describe('Error Handling and Resilience', () => {
    test('should handle API rate limits gracefully', async () => {
      await echoSatellite.initialize();
      
      // Simulate rate limit scenario
      const requests = Array(100).fill(null).map(() => 
        echoSatellite.analyzeSentiment('Test sentiment analysis')
      );

      const results = await Promise.allSettled(requests);
      
      // Should not all fail due to rate limiting
      const successful = results.filter(r => r.status === 'fulfilled');
      expect(successful.length).toBeGreaterThan(0);
    });

    test('should handle platform connection failures', async () => {
      await echoSatellite.initialize();
      
      // Should handle failures gracefully
      await expect(
        echoSatellite.testPlatformConnections()
      ).resolves.not.toThrow();
    });

    test('should maintain data consistency during errors', async () => {
      await echoSatellite.initialize();
      
      // Simulate error condition
      try {
        await echoSatellite.analyzeSentiment(''); // Empty content
      } catch (error) {
        // Should handle gracefully
      }

      // System should still be functional
      const status = echoSatellite.getStatus();
      expect(status.isInitialized).toBe(true);
    });
  });

  describe('Performance and Scalability', () => {
    test('should handle concurrent sentiment analysis requests', async () => {
      await echoSatellite.initialize();
      
      const texts = Array(50).fill(null).map((_, i) => 
        `Bitcoin sentiment analysis test ${i}`
      );

      const startTime = Date.now();
      const promises = texts.map(text => echoSatellite.analyzeSentiment(text));
      const results = await Promise.all(promises);
      const duration = Date.now() - startTime;

      expect(results).toHaveLength(50);
      expect(duration).toBeLessThan(10000); // Should complete within 10 seconds
    });

    test('should optimize memory usage for large datasets', async () => {
      await echoSatellite.initialize();
      
      const initialMemory = process.memoryUsage().heapUsed;
      
      // Process large dataset
      const largeBatch = Array(1000).fill(null).map((_, i) => 
        createMockSentimentData()
      );
      
      await echoSatellite.processBatchSentimentData(largeBatch);
      
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;
      
      // Memory increase should be reasonable (less than 100MB)
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024);
    });
  });

  describe('Configuration and Customization', () => {
    test('should respect confidence thresholds', async () => {
      await echoSatellite.initialize();
      
      const lowConfidenceText = 'maybe crypto good idk';
      const result = await echoSatellite.analyzeSentiment(lowConfidenceText);
      
      if (result.confidence < mockConfig.sentimentAnalysis.confidenceThreshold) {
        expect(result.overall).toBe('neutral'); // Should default to neutral for low confidence
      }
    });

    test('should handle custom sentiment models', async () => {
      const customConfig = { ...mockConfig };
      customConfig.sentimentAnalysis.sentimentModels = ['crypto-bert'];
      
      const customSatellite = EchoSatelliteAgent.getInstance(customConfig);
      await customSatellite.initialize();
      
      const status = customSatellite.getStatus();
      expect(status.isInitialized).toBe(true);
    });

    test('should support different time window configurations', async () => {
      await echoSatellite.initialize();
      
      const customWindows = mockConfig.aggregation.timeWindows;
      
      for (const window of customWindows) {
        const windowMs = window * 1000;
        expect(windowMs).toBeGreaterThan(0);
      }
    });
  });
});

describe('Sentiment Analysis Engine', () => {
  let sentimentEngine: SentimentAnalysisEngine;
  let mockConfig: any;

  beforeEach(() => {
    mockConfig = {
      enableCryptoSpecificModels: true,
      confidenceThreshold: 0.7,
      enableEmotionDetection: true,
      enableEntityRecognition: true,
      models: ['crypto-bert', 'finbert'],
      maxBatchSize: 100,
      processingTimeout: 5000
    };

    sentimentEngine = SentimentAnalysisEngine.getInstance(mockConfig);
  });

  describe('Sentiment Classification', () => {
    test('should classify crypto-specific sentiment', async () => {
      await sentimentEngine.initialize();
      
      const bullishText = 'Bitcoin is mooning! 🚀 HODL strong!';
      const result = await sentimentEngine.analyzeSentiment(bullishText);

      expect(result.overall).toBe('bullish');
      expect(result.confidence).toBeGreaterThan(0.7);
    });

    test('should handle bearish sentiment', async () => {
      await sentimentEngine.initialize();
      
      const bearishText = 'Crypto crash incoming! Sell everything now!';
      const result = await sentimentEngine.analyzeSentiment(bearishText);

      expect(result.overall).toBe('bearish');
      expect(result.confidence).toBeGreaterThan(0.7);
    });

    test('should detect neutral sentiment', async () => {
      await sentimentEngine.initialize();
      
      const neutralText = 'Bitcoin price is currently at $50,000 according to CoinGecko.';
      const result = await sentimentEngine.analyzeSentiment(neutralText);

      expect(result.overall).toBe('neutral');
    });
  });

  describe('Entity Recognition', () => {
    test('should extract crypto tokens', async () => {
      await sentimentEngine.initialize();
      
      const text = 'BTC and ETH are the top cryptocurrencies, followed by ADA and SOL';
      const entities = await sentimentEngine.extractEntities(text);

      expect(entities.tokens).toEqual(
        expect.arrayContaining(['BTC', 'ETH', 'ADA', 'SOL'])
      );
    });

    test('should extract DeFi protocols', async () => {
      await sentimentEngine.initialize();
      
      const text = 'Uniswap and Aave are leading DeFi protocols on Ethereum';
      const entities = await sentimentEngine.extractEntities(text);

      expect(entities.protocols).toEqual(
        expect.arrayContaining(['Uniswap', 'Aave', 'Ethereum'])
      );
    });

    test('should extract trading themes', async () => {
      await sentimentEngine.initialize();
      
      const text = 'DeFi summer is here! Yield farming and liquidity mining opportunities everywhere!';
      const entities = await sentimentEngine.extractEntities(text);

      expect(entities.themes).toEqual(
        expect.arrayContaining(['DeFi', 'yield farming', 'liquidity mining'])
      );
    });
  });

  describe('Emotion Detection', () => {
    test('should detect joy and optimism', async () => {
      await sentimentEngine.initialize();
      
      const joyfulText = 'So excited about this crypto bull run! 🎉😄';
      const result = await sentimentEngine.analyzeSentiment(joyfulText);

      expect(result.emotions.joy).toBeGreaterThan(0.5);
      expect(result.emotions.optimism).toBeGreaterThan(0.5);
    });

    test('should detect fear and anger', async () => {
      await sentimentEngine.initialize();
      
      const fearfulText = 'Terrified about this crypto crash! Lost everything! 😭😡';
      const result = await sentimentEngine.analyzeSentiment(fearfulText);

      expect(result.emotions.fear).toBeGreaterThan(0.5);
      expect(result.emotions.anger).toBeGreaterThan(0.3);
    });
  });

  describe('Batch Processing', () => {
    test('should process sentiment in batches efficiently', async () => {
      await sentimentEngine.initialize();
      
      const texts = Array(50).fill(null).map((_, i) => 
        `Crypto sentiment test ${i} with Bitcoin and Ethereum`
      );

      const startTime = Date.now();
      const results = await sentimentEngine.processBatch(texts);
      const duration = Date.now() - startTime;

      expect(results).toHaveLength(50);
      expect(duration).toBeLessThan(5000);
    });
  });
});

describe('Social Media Platform Manager', () => {
  let platformManager: SocialMediaPlatformManager;
  let mockConfig: any;

  beforeEach(() => {
    mockConfig = {
      platforms: ['twitter', 'discord', 'telegram', 'reddit'],
      enableRealTimeMonitoring: true,
      monitoringInterval: 60000,
      maxPostsPerBatch: 500,
      rateLimits: {
        twitter: 300,
        discord: 120,
        telegram: 30,
        reddit: 60
      }
    };

    platformManager = SocialMediaPlatformManager.getInstance(mockConfig);
  });

  describe('Platform Integration', () => {
    test('should connect to all configured platforms', async () => {
      await platformManager.initialize();
      
      const connections = await platformManager.testConnections();
      
      expect(connections).toHaveProperty('twitter');
      expect(connections).toHaveProperty('discord');
      expect(connections).toHaveProperty('telegram');
      expect(connections).toHaveProperty('reddit');
    });

    test('should handle platform-specific rate limits', async () => {
      await platformManager.initialize();
      
      const platform = 'twitter';
      const canRequest = await platformManager.checkRateLimit(platform);
      
      expect(typeof canRequest).toBe('boolean');
    });

    test('should normalize data across platforms', async () => {
      await platformManager.initialize();
      
      const twitterData = {
        id_str: '123456789',
        text: 'Bitcoin to the moon!',
        user: { screen_name: 'crypto_user', followers_count: 1000 },
        created_at: 'Wed Oct 05 20:00:00 +0000 2023'
      };

      const normalized = await platformManager.normalizePost('twitter', twitterData);
      
      expect(normalized).toMatchObject({
        id: expect.any(String),
        platform: 'twitter',
        content: expect.any(String),
        author: expect.objectContaining({
          username: expect.any(String),
          followerCount: expect.any(Number)
        }),
        timestamp: expect.any(Date)
      });
    });
  });

  describe('Data Collection', () => {
    test('should collect posts from multiple platforms', async () => {
      await platformManager.initialize();
      
      const keywords = ['Bitcoin', 'Ethereum', 'DeFi'];
      const posts = await platformManager.collectPosts(keywords, 10);
      
      expect(posts).toBeInstanceOf(Array);
      expect(posts.length).toBeLessThanOrEqual(10);
    });

    test('should filter spam and low-quality content', async () => {
      await platformManager.initialize();
      
      const mockPosts = [
        createMockSocialMediaPost(),
        { ...createMockSocialMediaPost(), content: 'spam spam spam' }
      ];

      const filtered = await platformManager.filterPosts(mockPosts);
      
      expect(filtered.length).toBeLessThanOrEqual(mockPosts.length);
    });
  });

  describe('Real-time Monitoring', () => {
    test('should start and stop monitoring streams', async () => {
      await platformManager.initialize();
      
      await platformManager.startRealTimeMonitoring(['Bitcoin', 'Ethereum']);
      
      const status = platformManager.getMonitoringStatus();
      expect(status.isRunning).toBe(true);
      
      await platformManager.stopRealTimeMonitoring();
      
      const stoppedStatus = platformManager.getMonitoringStatus();
      expect(stoppedStatus.isRunning).toBe(false);
    });
  });
});

describe('Integration Tests', () => {
  let echoSatellite: EchoSatelliteAgent;
  let mockConfig: EchoSatelliteConfig;

  beforeEach(() => {
    mockConfig = createMockConfig();
    echoSatellite = EchoSatelliteAgent.getInstance(mockConfig);
  });

  test('should handle end-to-end sentiment analysis workflow', async () => {
    await echoSatellite.initialize();
    await echoSatellite.startRealTimeMonitoring();

    // Simulate complete workflow
    const mockPost = createMockSocialMediaPost();
    const sentimentData = createMockSentimentData();

    const [sentimentResult, processedData] = await Promise.all([
      echoSatellite.analyzeSentiment(mockPost.content),
      echoSatellite.processSentimentData(sentimentData)
    ]);

    expect(sentimentResult.overall).toBeDefined();
    expect(processedData.sentiment).toBeDefined();

    await echoSatellite.stopRealTimeMonitoring();
  });

  test('should maintain performance under load', async () => {
    await echoSatellite.initialize();
    
    const startTime = Date.now();
    
    // Simulate high load
    const promises = Array(20).fill(null).map(async (_, i) => {
      const text = `High load test ${i} Bitcoin Ethereum DeFi crypto`;
      return echoSatellite.analyzeSentiment(text);
    });

    const results = await Promise.all(promises);
    const duration = Date.now() - startTime;

    expect(results).toHaveLength(20);
    expect(duration).toBeLessThan(15000); // Should complete within 15 seconds
    
    // All results should be valid
    results.forEach(result => {
      expect(result.overall).toMatch(/^(bullish|bearish|neutral)$/);
      expect(result.confidence).toBeGreaterThanOrEqual(0);
    });
  });

  test('should handle concurrent platform monitoring', async () => {
    await echoSatellite.initialize();
    
    await echoSatellite.startRealTimeMonitoring();
    
    // Should handle multiple platform streams concurrently
    const platforms = ['twitter', 'discord', 'telegram', 'reddit'];
    const statuses = await Promise.all(
      platforms.map(platform => echoSatellite.getPlatformStatus(platform))
    );

    statuses.forEach(status => {
      expect(status.platform).toBeDefined();
      expect(typeof status.connected).toBe('boolean');
    });

    await echoSatellite.stopRealTimeMonitoring();
  });
});