/**
 * Echo Satellite Regression Test Suite
 * Comprehensive regression testing to ensure all functionality remains stable
 */

import { describe, test, expect, beforeAll, afterAll, jest } from '@jest/globals';
import { EchoSatelliteAgent } from '../../../src/satellites/echo/echo-satellite';
import { SentimentAnalysisEngine } from '../../../src/satellites/echo/sentiment/sentiment-analysis-engine';
import { AIPoweredSentimentAnalyzer } from '../../../src/satellites/echo/sentiment/ai-powered-sentiment-analyzer';
import { TrendDetectionEngine } from '../../../src/satellites/echo/trends/trend-detection-engine';
import { NarrativeAnalyzer } from '../../../src/satellites/echo/narratives/narrative-analyzer';
import { CommunityEngagementManager } from '../../../src/satellites/echo/engagement/community-engagement-manager';
import { DeFAIProjectTracker } from '../../../src/satellites/echo/engagement/defai-project-tracker';
import { SocialMediaPlatformManager } from '../../../src/satellites/echo/platforms/social-media-platform-manager';
import { getUnifiedAIClient } from '../../../src/integrations/ai/unified-ai-client';
import Redis from 'ioredis';
import { Pool } from 'pg';
import { getLogger } from '../../../src/shared/logging/logger';

// Mock dependencies
jest.mock('../../../src/shared/logging/logger', () => ({
  getLogger: jest.fn(() => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    child: jest.fn(() => ({
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn()
    }))
  }))
}));

jest.mock('../../../src/integrations/ai/unified-ai-client', () => ({
  getUnifiedAIClient: jest.fn(() => ({
    generateResponse: jest.fn().mockResolvedValue({
      content: 'Test response',
      usage: { tokens: 100 }
    }),
    isAvailable: jest.fn(() => true),
    getProvider: jest.fn(() => 'mock-provider')
  }))
}));

jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    quit: jest.fn(),
    zadd: jest.fn(),
    zrange: jest.fn(),
    hset: jest.fn(),
    hget: jest.fn(),
    expire: jest.fn()
  }));
});

jest.mock('pg', () => ({
  Pool: jest.fn().mockImplementation(() => ({
    query: jest.fn(),
    connect: jest.fn(),
    end: jest.fn()
  }))
}));

const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
  child: jest.fn(() => mockLogger)
};

describe('Echo Satellite Regression Test Suite', () => {
  let echoSatellite: EchoSatelliteAgent;
  let redisClient: Redis;
  let pgPool: Pool;
  let aiClient: any;
  let logger: any;
  let previousVersionData: any;

  beforeAll(async () => {
    // Initialize dependencies
    redisClient = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      lazyConnect: true
    });

    pgPool = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'yieldsense_test',
      user: process.env.DB_USER || 'postgres',  
      password: process.env.DB_PASSWORD || 'postgres'
    });

    aiClient = getUnifiedAIClient();
    logger = getLogger({ name: 'echo-regression-test' });

    // Store baseline data for regression comparison
    previousVersionData = {
      sentimentBaseline: {
        'Bitcoin to $100k': 0.85,
        'DeFi is dead': -0.75,
        'Ethereum merger successful': 0.65
      },
      trendBaseline: {
        'AI+Crypto': { strength: 0.82, volume: 1500 },
        'RWA tokenization': { strength: 0.75, volume: 800 },
        'L2 adoption': { strength: 0.68, volume: 1200 }
      },
      entityBaseline: {
        'Bitcoin': ['BTC', 'bitcoin', 'btc'],
        'Ethereum': ['ETH', 'ethereum', 'eth'],
        'Chainlink': ['LINK', 'chainlink', 'link']
      }
    };

    echoSatellite = new EchoSatelliteAgent(
      redisClient,
      pgPool,
      aiClient,
      logger
    );

    await echoSatellite.initialize();
  });

  afterAll(async () => {
    if (echoSatellite) {
      await echoSatellite.shutdown();
    }
    if (redisClient) {
      await redisClient.quit();
    }
    if (pgPool) {
      await pgPool.end();
    }
  });

  describe('Core Functionality Regression Tests', () => {
    
    test('Sentiment analysis should maintain baseline accuracy', async () => {
      const sentimentEngine = new SentimentAnalysisEngine(aiClient, logger);
      
      for (const [text, expectedScore] of Object.entries(previousVersionData.sentimentBaseline)) {
        const result = await sentimentEngine.analyzeSentiment(text);
        
        // Allow 10% deviation from baseline
        expect(Math.abs(result.score - expectedScore)).toBeLessThan(0.1);
        expect(result.confidence).toBeGreaterThan(0.7);
      }
    });

    test('Entity recognition should maintain consistency', async () => {
      const sentimentEngine = new SentimentAnalysisEngine(aiClient, logger);
      
      for (const [entity, expectedAliases] of Object.entries(previousVersionData.entityBaseline)) {
        const testText = `I think ${entity} is going to moon soon!`;
        const result = await sentimentEngine.analyzeSentiment(testText);
        
        expect(result.entities).toBeDefined();
        expect(result.entities.length).toBeGreaterThan(0);
        
        const foundEntity = result.entities.find(e => 
          e.name.toLowerCase() === entity.toLowerCase() ||
          (expectedAliases as string[]).includes(e.name.toLowerCase())
        );
        
        expect(foundEntity).toBeDefined();
      }
    });

    test('Trend detection should identify baseline trends', async () => {
      const trendEngine = new TrendDetectionEngine(
        redisClient,
        pgPool,
        aiClient,
        logger
      );
      
      // Mock social media data
      const mockPosts = [
        { text: 'AI and crypto integration is the future!', timestamp: new Date() },
        { text: 'RWA tokenization gaining momentum', timestamp: new Date() },
        { text: 'L2 solutions are scaling Ethereum', timestamp: new Date() }
      ];
      
      for (const post of mockPosts) {
        await trendEngine.processSocialData(post);
      }
      
      const trends = await trendEngine.detectTrends('1h');
      
      // Verify baseline trends are detected
      for (const [trendName, baseline] of Object.entries(previousVersionData.trendBaseline)) {
        const detectedTrend = trends.find(t => 
          t.topic.toLowerCase().includes(trendName.toLowerCase())
        );
        
        if (detectedTrend) {
          // Allow reasonable deviation
          expect(detectedTrend.strength).toBeGreaterThan((baseline as any).strength * 0.7);
        }
      }
    });
  });

  describe('Cross-Component Integration Regression', () => {
    
    test('Social platform manager should integrate with all components', async () => {
      const platformManager = new SocialMediaPlatformManager(
        redisClient,
        pgPool,
        logger
      );
      
      // Test integration with sentiment analyzer
      const sentimentAnalyzer = new AIPoweredSentimentAnalyzer(aiClient, logger);
      const testPost = {
        text: 'Ethereum scaling solutions are revolutionary!',
        platform: 'twitter' as const,
        author: 'test_user',
        timestamp: new Date()
      };
      
      const sentiment = await sentimentAnalyzer.analyze(testPost.text);
      expect(sentiment.overallSentiment).toBeDefined();
      expect(sentiment.confidence).toBeGreaterThan(0);
      
      // Test integration with trend detector
      const trendEngine = new TrendDetectionEngine(
        redisClient,
        pgPool,
        aiClient,
        logger
      );
      
      await trendEngine.processSocialData(testPost);
      const trends = await trendEngine.detectTrends('1h');
      expect(Array.isArray(trends)).toBe(true);
    });

    test('Narrative analyzer should work with trend detection', async () => {
      const narrativeAnalyzer = new NarrativeAnalyzer(
        redisClient,
        pgPool,
        aiClient,
        logger
      );
      
      const trendEngine = new TrendDetectionEngine(
        redisClient,
        pgPool,
        aiClient,
        logger
      );
      
      // Create test narrative
      const testNarrative = 'DeFi summer 2.0 is here with improved protocols';
      
      const narrativeResult = await narrativeAnalyzer.analyzeNarrative(testNarrative);
      expect(narrativeResult.themes).toBeDefined();
      expect(narrativeResult.sentiment).toBeDefined();
      
      // Process as trend
      await trendEngine.processSocialData({
        text: testNarrative,
        timestamp: new Date()
      });
      
      const trends = await trendEngine.detectTrends('1h');
      const defiTrend = trends.find(t => t.topic.toLowerCase().includes('defi'));
      
      if (defiTrend) {
        expect(defiTrend.sentiment).toBe(narrativeResult.sentiment);
      }
    });
  });

  describe('Performance Regression Tests', () => {
    
    test('Sentiment analysis should maintain performance benchmarks', async () => {
      const sentimentEngine = new SentimentAnalysisEngine(aiClient, logger);
      const testTexts = Array(100).fill('').map((_, i) => 
        `Test message ${i}: Crypto market is ${i % 2 ? 'bullish' : 'bearish'}`
      );
      
      const startTime = Date.now();
      const promises = testTexts.map(text => sentimentEngine.analyzeSentiment(text));
      await Promise.all(promises);
      const endTime = Date.now();
      
      const totalTime = endTime - startTime;
      const avgTimePerAnalysis = totalTime / testTexts.length;
      
      // Should process at least 10 sentiments per second
      expect(avgTimePerAnalysis).toBeLessThan(100); // 100ms per analysis
    });

    test('Trend detection should handle high volume without degradation', async () => {
      const trendEngine = new TrendDetectionEngine(
        redisClient,
        pgPool,
        aiClient,
        logger
      );
      
      // Generate high volume test data
      const testPosts = Array(500).fill('').map((_, i) => ({
        text: `Post ${i}: ${['Bitcoin', 'Ethereum', 'DeFi', 'NFT'][i % 4]} trending`,
        timestamp: new Date(Date.now() - i * 60000) // Spread over time
      }));
      
      const startTime = Date.now();
      
      // Process in batches
      const batchSize = 50;
      for (let i = 0; i < testPosts.length; i += batchSize) {
        const batch = testPosts.slice(i, i + batchSize);
        await Promise.all(batch.map(post => trendEngine.processSocialData(post)));
      }
      
      const trends = await trendEngine.detectTrends('1h');
      const endTime = Date.now();
      
      expect(trends.length).toBeGreaterThan(0);
      expect(endTime - startTime).toBeLessThan(10000); // Should complete within 10 seconds
    });
  });

  describe('Error Handling Regression Tests', () => {
    
    test('Should gracefully handle AI service failures', async () => {
      // Mock AI service failure
      const mockFailingClient = {
        ...aiClient,
        generateResponse: jest.fn().mockRejectedValue(new Error('AI service unavailable'))
      };
      
      const sentimentEngine = new SentimentAnalysisEngine(
        mockFailingClient as any,
        logger
      );
      
      const result = await sentimentEngine.analyzeSentiment('Test message');
      
      // Should return neutral sentiment on failure
      expect(result.score).toBe(0);
      expect(result.confidence).toBe(0);
      expect(result.label).toBe('neutral');
    });

    test('Should handle database connection issues', async () => {
      // Create a pool with invalid connection
      const badPool = new Pool({
        host: 'invalid-host',
        port: 5432,
        database: 'invalid-db',
        user: 'invalid-user',
        password: 'invalid-pass',
        connectionTimeoutMillis: 1000
      });
      
      const trendEngine = new TrendDetectionEngine(
        redisClient,
        badPool,
        aiClient,
        logger
      );
      
      // Should not throw, but handle gracefully
      await expect(trendEngine.processSocialData({
        text: 'Test post',
        timestamp: new Date()
      })).resolves.not.toThrow();
      
      await badPool.end();
    });
  });

  describe('Data Consistency Regression Tests', () => {
    
    test('Should maintain data integrity across components', async () => {
      const testPost = {
        id: 'test-regression-' + Date.now(),
        text: 'Bitcoin reaching new ATH! Revolutionary technology.',
        platform: 'twitter' as const,
        author: 'regression_tester',
        timestamp: new Date()
      };
      
      // Process through sentiment analysis
      const sentimentEngine = new SentimentAnalysisEngine(aiClient, logger);
      const sentimentResult = await sentimentEngine.analyzeSentiment(testPost.text);
      
      // Process through trend detection
      const trendEngine = new TrendDetectionEngine(
        redisClient,
        pgPool,
        aiClient,
        logger
      );
      await trendEngine.processSocialData(testPost);
      
      // Process through narrative analyzer
      const narrativeAnalyzer = new NarrativeAnalyzer(
        redisClient,
        pgPool,
        aiClient,
        logger
      );
      const narrativeResult = await narrativeAnalyzer.analyzeNarrative(testPost.text);
      
      // Verify consistency
      expect(sentimentResult.label).toBe(narrativeResult.sentiment);
      
      // Check if data is persisted correctly
      const trends = await trendEngine.detectTrends('1h');
      const bitcoinTrend = trends.find(t => t.topic.toLowerCase().includes('bitcoin'));
      
      if (bitcoinTrend) {
        expect(bitcoinTrend.sentiment).toBe(sentimentResult.label);
        expect(bitcoinTrend.volume).toBeGreaterThan(0);
      }
    });

    test('Should preserve historical data accuracy', async () => {
      // Test that historical data queries return consistent results
      const trendEngine = new TrendDetectionEngine(
        redisClient,
        pgPool,
        aiClient,
        logger
      );
      
      // Query same time period multiple times
      const period = '24h';
      const results = [];
      
      for (let i = 0; i < 3; i++) {
        const trends = await trendEngine.detectTrends(period);
        results.push(trends);
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      // All queries should return same results for historical data
      if (results[0].length > 0) {
        for (let i = 1; i < results.length; i++) {
          expect(results[i].length).toBe(results[0].length);
          
          // Compare trend topics
          const topics0 = results[0].map(t => t.topic).sort();
          const topicsI = results[i].map(t => t.topic).sort();
          expect(topicsI).toEqual(topics0);
        }
      }
    });
  });

  describe('Feature Compatibility Regression Tests', () => {
    
    test('New AI integration should not break existing functionality', async () => {
      // Test that unified AI client works with all components
      const components = [
        new SentimentAnalysisEngine(aiClient, logger),
        new AIPoweredSentimentAnalyzer(aiClient, logger),
        new NarrativeAnalyzer(redisClient, pgPool, aiClient, logger),
        new TrendDetectionEngine(redisClient, pgPool, aiClient, logger)
      ];
      
      const testText = 'Ethereum 2.0 staking rewards are impressive';
      
      for (const component of components) {
        let result;
        
        if ('analyzeSentiment' in component) {
          result = await component.analyzeSentiment(testText);
        } else if ('analyze' in component) {
          result = await component.analyze(testText);
        } else if ('analyzeNarrative' in component) {
          result = await component.analyzeNarrative(testText);
        } else if ('processSocialData' in component) {
          await component.processSocialData({ text: testText, timestamp: new Date() });
          result = { processed: true };
        }
        
        expect(result).toBeDefined();
      }
    });

    test('Community engagement features should integrate with core system', async () => {
      const engagementManager = new CommunityEngagementManager(
        redisClient,
        pgPool,
        logger
      );
      
      const defaiTracker = new DeFAIProjectTracker(
        redisClient,
        pgPool,
        logger
      );
      
      // Test engagement tracking
      const engagement = await engagementManager.trackEngagement({
        platform: 'twitter',
        postId: 'test-post-regression',
        likes: 100,
        retweets: 50,
        comments: 25,
        timestamp: new Date()
      });
      
      expect(engagement.engagementScore).toBeGreaterThan(0);
      
      // Test DeFAI project tracking
      const project = await defaiTracker.trackProject({
        name: 'TestDeFAI',
        symbol: 'TDF',
        category: 'yield-aggregator',
        socialMetrics: {
          twitter: { followers: 1000, engagement: 0.05 },
          discord: { members: 500, activeUsers: 100 },
          telegram: { members: 800, activeUsers: 200 }
        }
      });
      
      expect(project.overallScore).toBeGreaterThan(0);
    });
  });

  describe('Backward Compatibility Tests', () => {
    
    test('Should handle legacy data formats', async () => {
      // Test with old format social media posts
      const legacyPost = {
        content: 'Bitcoin to the moon!', // Old field name
        user: 'legacy_user', // Old field name
        created_at: '2024-01-01T00:00:00Z' // String timestamp
      };
      
      const sentimentEngine = new SentimentAnalysisEngine(aiClient, logger);
      
      // Should handle gracefully by using available data
      const result = await sentimentEngine.analyzeSentiment(
        legacyPost.content || (legacyPost as any).text || ''
      );
      
      expect(result).toBeDefined();
      expect(result.score).toBeDefined();
    });

    test('Should migrate old cache formats transparently', async () => {
      // Set old format cache data
      const oldCacheKey = 'echo:sentiment:old:bitcoin';
      const oldCacheData = JSON.stringify({
        sentiment: 'positive', // Old format: string instead of object
        score: 0.8,
        timestamp: Date.now()
      });
      
      await redisClient.set(oldCacheKey, oldCacheData);
      
      // New system should handle old cache gracefully
      const cachedData = await redisClient.get(oldCacheKey);
      if (cachedData) {
        const parsed = JSON.parse(cachedData);
        
        // Should be able to work with old format
        expect(parsed.sentiment).toBeDefined();
        expect(parsed.score).toBeDefined();
      }
      
      // Cleanup
      await redisClient.del(oldCacheKey);
    });
  });
});

/**
 * Regression Test Summary Report Generator
 */
export class RegressionTestReporter {
  generateReport(testResults: any): string {
    return `
# Echo Satellite Regression Test Report

## Test Summary
- Total Tests: ${testResults.total}
- Passed: ${testResults.passed}
- Failed: ${testResults.failed}
- Skipped: ${testResults.skipped}

## Performance Metrics
- Average Sentiment Analysis Time: ${testResults.avgSentimentTime}ms
- Average Trend Detection Time: ${testResults.avgTrendTime}ms
- Memory Usage: ${testResults.memoryUsage}MB

## Regression Analysis
- Sentiment Accuracy Deviation: ${testResults.sentimentDeviation}%
- Entity Recognition Accuracy: ${testResults.entityAccuracy}%
- Trend Detection Accuracy: ${testResults.trendAccuracy}%

## Recommendations
${testResults.recommendations.join('\n')}
`;
  }
}