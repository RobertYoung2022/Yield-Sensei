/**
 * Social Media Manager
 * Coordinates multiple social media platform integrations with aggregation and analysis
 */

import { EventEmitter } from 'events';
import Logger from '@/shared/logging/logger';
import {
  SocialMediaClient,
  SocialMediaManagerConfig,
  SocialMediaConfig,
  SocialPlatform,
  SocialMediaMessage,
  SocialMediaStream,
  AggregatedSocialData,
  TrendingTopic,
  SocialMediaEvent,
  SentimentScore,
  SocialMediaUser
} from './types';
import { TwitterClient } from './twitter-client';
import { DiscordClient } from './discord-client';
import { TelegramClient } from './telegram-client';
import { RedditClient } from './reddit-client';

const logger = Logger.getLogger('social-media-manager');

interface PlatformManager {
  client: SocialMediaClient;
  isActive: boolean;
  streams: Map<string, SocialMediaStream>;
  messageBuffer: SocialMediaMessage[];
  lastProcessed: Date;
}

interface MessageAnalysis {
  sentiment: SentimentScore;
  keywords: string[];
  topics: string[];
  influence: number;
}

export class SocialMediaManager extends EventEmitter {
  private config: SocialMediaManagerConfig;
  private platforms: Map<SocialPlatform, PlatformManager> = new Map();
  private messageStorage: Map<string, SocialMediaMessage> = new Map();
  private processingInterval?: NodeJS.Timeout;
  private cleanupInterval?: NodeJS.Timeout;
  private aggregationCache: Map<string, AggregatedSocialData> = new Map();
  private trendingTopics: Map<string, TrendingTopic> = new Map();

  constructor(config: SocialMediaManagerConfig) {
    super();
    this.config = {
      enableAggregation: true,
      sentimentAnalysis: {
        enabled: true,
        threshold: 0.6
      },
      realTimeProcessing: {
        enabled: true,
        batchSize: 100,
        processingInterval: 30000 // 30 seconds
      },
      storage: {
        enabled: true,
        retentionDays: 7,
        indexMessages: true
      },
      alerts: {
        enabled: true,
        sentimentThreshold: 0.8,
        volumeThreshold: 100,
        keywordAlerts: []
      },
      ...config
    };

    this.setupEventHandlers();
  }

  async initialize(): Promise<void> {
    try {
      logger.info('Initializing Social Media Manager...');

      // Initialize platform clients
      await this.initializePlatforms();

      // Start real-time processing
      if (this.config.realTimeProcessing.enabled) {
        this.startRealTimeProcessing();
      }

      // Start cleanup tasks
      this.startCleanupTasks();

      logger.info('Social Media Manager initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Social Media Manager:', error);
      throw error;
    }
  }

  private async initializePlatforms(): Promise<void> {
    for (const platformConfig of this.config.platforms) {
      try {
        const client = this.createClient(platformConfig);
        await client.initialize();

        const manager: PlatformManager = {
          client,
          isActive: true,
          streams: new Map(),
          messageBuffer: [],
          lastProcessed: new Date()
        };

        this.platforms.set(platformConfig.platform, manager);
        this.setupPlatformEventHandlers(platformConfig.platform, client);

        logger.info('Platform initialized', { platform: platformConfig.platform });
      } catch (error) {
        logger.error('Failed to initialize platform', { 
          platform: platformConfig.platform, 
          error 
        });
      }
    }
  }

  private createClient(config: SocialMediaConfig): SocialMediaClient {
    switch (config.platform) {
      case 'twitter':
        return new TwitterClient(config as any);
      case 'discord':
        return new DiscordClient(config as any);
      case 'telegram':
        return new TelegramClient(config as any);
      case 'reddit':
        return new RedditClient(config as any);
      default:
        throw new Error(`Unsupported platform: ${config.platform}`);
    }
  }

  private setupPlatformEventHandlers(platform: SocialPlatform, client: SocialMediaClient): void {
    client.on('message', (message: SocialMediaMessage) => {
      this.handleIncomingMessage(message);
    });

    client.on('error', (error: Error) => {
      logger.error(`Platform error from ${platform}:`, error);
      this.emit('platform_error', { platform, error });
    });
  }

  private handleIncomingMessage(message: SocialMediaMessage): void {
    const manager = this.platforms.get(message.platform);
    if (!manager) {
      return;
    }

    // Add to message buffer
    manager.messageBuffer.push(message);

    // Store message if enabled
    if (this.config.storage.enabled) {
      this.messageStorage.set(message.id, message);
    }

    // Analyze message if sentiment analysis is enabled
    if (this.config.sentimentAnalysis.enabled) {
      this.analyzeMessage(message);
    }

    // Check for alerts
    this.checkAlerts(message);

    // Emit event
    const event: SocialMediaEvent = {
      type: 'message',
      platform: message.platform,
      timestamp: new Date(),
      data: message
    };
    this.emit('social_event', event);
  }

  private analyzeMessage(message: SocialMediaMessage): void {
    try {
      // Simple sentiment analysis (in production, would use AI service)
      const sentiment = this.calculateSentiment(message.content);
      message.sentiment = sentiment;

      // Extract keywords and topics
      const analysis = this.extractKeywords(message.content);
      
      // Update trending topics
      this.updateTrendingTopics(message, analysis);

      logger.debug('Message analyzed', { 
        messageId: message.id, 
        sentiment: sentiment.label,
        keywords: analysis.keywords.slice(0, 3)
      });
    } catch (error) {
      logger.error('Message analysis failed:', error);
    }
  }

  private calculateSentiment(content: string): SentimentScore {
    // Simplified sentiment analysis
    const positiveWords = ['good', 'great', 'excellent', 'amazing', 'bullish', 'moon', 'pump', 'gain'];
    const negativeWords = ['bad', 'terrible', 'awful', 'crash', 'dump', 'bearish', 'drop', 'loss'];
    
    const words = content.toLowerCase().split(/\s+/);
    let positiveCount = 0;
    let negativeCount = 0;
    
    words.forEach(word => {
      if (positiveWords.includes(word)) positiveCount++;
      if (negativeWords.includes(word)) negativeCount++;
    });
    
    const totalSentimentWords = positiveCount + negativeCount;
    const score = totalSentimentWords > 0 
      ? (positiveCount - negativeCount) / totalSentimentWords 
      : 0;
    
    return {
      score: Math.max(-1, Math.min(1, score)),
      confidence: Math.min(totalSentimentWords / words.length * 10, 1),
      label: score > 0.1 ? 'positive' : score < -0.1 ? 'negative' : 'neutral',
      keywords: words.filter(word => [...positiveWords, ...negativeWords].includes(word))
    };
  }

  private extractKeywords(content: string): MessageAnalysis {
    // Simple keyword extraction
    const words = content.toLowerCase()
      .replace(/[^\w\s#@]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 3);

    const cryptoKeywords = ['bitcoin', 'ethereum', 'crypto', 'blockchain', 'defi', 'nft', 'yield', 'farming'];
    const financialKeywords = ['investment', 'portfolio', 'market', 'trading', 'stocks', 'bonds'];
    
    const keywords = words.filter(word => 
      cryptoKeywords.includes(word) || financialKeywords.includes(word)
    );

    return {
      sentiment: this.calculateSentiment(content),
      keywords: [...new Set(keywords)].slice(0, 10),
      topics: this.extractTopics(content),
      influence: this.calculateInfluence(content, keywords)
    };
  }

  private extractTopics(content: string): string[] {
    const topicPatterns = {
      'DeFi': /\b(defi|decentralized finance|yield farming|liquidity mining)\b/i,
      'NFT': /\b(nft|non-fungible token|opensea|collectible)\b/i,
      'Bitcoin': /\b(bitcoin|btc|satoshi)\b/i,
      'Ethereum': /\b(ethereum|eth|vitalik)\b/i,
      'Regulation': /\b(regulation|sec|compliance|legal)\b/i,
      'Market': /\b(market|trading|price|pump|dump)\b/i
    };

    const topics: string[] = [];
    for (const [topic, pattern] of Object.entries(topicPatterns)) {
      if (pattern.test(content)) {
        topics.push(topic);
      }
    }

    return topics;
  }

  private calculateInfluence(content: string, keywords: string[]): number {
    let influence = 0;
    
    // Base influence from content length and keywords
    influence += Math.min(content.length / 1000, 1) * 0.3;
    influence += Math.min(keywords.length / 10, 1) * 0.7;
    
    return Math.min(influence, 1);
  }

  private updateTrendingTopics(message: SocialMediaMessage, analysis: MessageAnalysis): void {
    for (const topic of analysis.topics) {
      const existing = this.trendingTopics.get(topic);
      
      if (existing) {
        existing.volume++;
        existing.platforms = [...new Set([...existing.platforms, message.platform])];
        existing.sentiment = {
          score: (existing.sentiment.score + analysis.sentiment.score) / 2,
          confidence: (existing.sentiment.confidence + analysis.sentiment.confidence) / 2,
          label: existing.sentiment.score > 0.1 ? 'positive' : 
                 existing.sentiment.score < -0.1 ? 'negative' : 'neutral',
          keywords: [...new Set([...existing.sentiment.keywords || [], ...analysis.sentiment.keywords || []])]
        };
      } else {
        this.trendingTopics.set(topic, {
          topic,
          volume: 1,
          platforms: [message.platform],
          sentiment: analysis.sentiment,
          timeRange: {
            start: new Date(),
            end: new Date()
          },
          relatedTopics: analysis.topics.filter(t => t !== topic),
          influencers: []
        });
      }
    }
  }

  private checkAlerts(message: SocialMediaMessage): void {
    if (!this.config.alerts.enabled) {
      return;
    }

    const alerts: string[] = [];

    // Sentiment alerts
    if (message.sentiment && this.config.alerts.sentimentThreshold) {
      if (Math.abs(message.sentiment.score) >= this.config.alerts.sentimentThreshold) {
        alerts.push(`High ${message.sentiment.label} sentiment detected`);
      }
    }

    // Keyword alerts
    if (this.config.alerts.keywordAlerts) {
      const content = message.content.toLowerCase();
      for (const keyword of this.config.alerts.keywordAlerts) {
        if (content.includes(keyword.toLowerCase())) {
          alerts.push(`Keyword alert: ${keyword}`);
        }
      }
    }

    // Emit alerts
    if (alerts.length > 0) {
      this.emit('alert', {
        type: 'alert',
        platform: message.platform,
        timestamp: new Date(),
        data: {
          message,
          alerts
        }
      });
    }
  }

  private startRealTimeProcessing(): void {
    const interval = this.config.realTimeProcessing.processingInterval || 30000;
    
    this.processingInterval = setInterval(() => {
      this.processMessageBuffers();
    }, interval);

    logger.info('Real-time processing started', { interval });
  }

  private processMessageBuffers(): void {
    try {
      for (const [platform, manager] of this.platforms) {
        if (manager.messageBuffer.length === 0) {
          continue;
        }

        const batchSize = this.config.realTimeProcessing.batchSize || 100;
        const messages = manager.messageBuffer.splice(0, batchSize);
        
        // Process batch
        this.processBatch(platform, messages);
        manager.lastProcessed = new Date();

        logger.debug('Processed message batch', { 
          platform, 
          count: messages.length 
        });
      }

      // Update aggregation
      if (this.config.enableAggregation) {
        this.updateAggregation();
      }

    } catch (error) {
      logger.error('Error processing message buffers:', error);
    }
  }

  private processBatch(platform: SocialPlatform, messages: SocialMediaMessage[]): void {
    // Aggregate batch statistics
    const batchStats = {
      platform,
      messageCount: messages.length,
      sentimentBreakdown: {
        positive: 0,
        negative: 0,
        neutral: 0
      },
      topKeywords: new Map<string, number>(),
      timeRange: {
        start: messages[0]?.timestamp || new Date(),
        end: messages[messages.length - 1]?.timestamp || new Date()
      }
    };

    for (const message of messages) {
      // Count sentiment
      if (message.sentiment) {
        batchStats.sentimentBreakdown[message.sentiment.label]++;
      }

      // Count keywords
      if (message.sentiment?.keywords) {
        for (const keyword of message.sentiment.keywords) {
          batchStats.topKeywords.set(keyword, (batchStats.topKeywords.get(keyword) || 0) + 1);
        }
      }
    }

    // Emit batch processed event
    this.emit('batch_processed', batchStats);
  }

  private updateAggregation(): void {
    try {
      const now = new Date();
      const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      
      // Get messages from last hour
      const recentMessages = Array.from(this.messageStorage.values())
        .filter(msg => msg.timestamp >= hourAgo);

      if (recentMessages.length === 0) {
        return;
      }

      const aggregation = this.createAggregation(recentMessages, hourAgo, now);
      this.aggregationCache.set('hourly', aggregation);

      logger.debug('Aggregation updated', { 
        messageCount: recentMessages.length,
        platforms: Object.keys(aggregation.platformBreakdown)
      });

    } catch (error) {
      logger.error('Error updating aggregation:', error);
    }
  }

  private createAggregation(
    messages: SocialMediaMessage[],
    startTime: Date,
    endTime: Date
  ): AggregatedSocialData {
    const platformBreakdown: Record<SocialPlatform, number> = {} as any;
    const sentimentSummary = { positive: 0, negative: 0, neutral: 0, averageScore: 0 };
    const keywordCounts = new Map<string, { count: number; sentiment: number }>();
    const hashtagCounts = new Map<string, { count: number; platforms: Set<SocialPlatform> }>();
    const influentialUsers = new Map<string, { user: SocialMediaUser; influence: number; sentiment: number }>();

    let totalSentimentScore = 0;
    let sentimentCount = 0;

    for (const message of messages) {
      // Platform breakdown
      platformBreakdown[message.platform] = (platformBreakdown[message.platform] || 0) + 1;

      // Sentiment analysis
      if (message.sentiment) {
        sentimentSummary[message.sentiment.label]++;
        totalSentimentScore += message.sentiment.score;
        sentimentCount++;

        // Keywords
        if (message.sentiment.keywords) {
          for (const keyword of message.sentiment.keywords) {
            const existing = keywordCounts.get(keyword) || { count: 0, sentiment: 0 };
            keywordCounts.set(keyword, {
              count: existing.count + 1,
              sentiment: (existing.sentiment + message.sentiment.score) / 2
            });
          }
        }
      }

      // Hashtags
      if (message.hashtags) {
        for (const hashtag of message.hashtags) {
          const existing = hashtagCounts.get(hashtag) || { count: 0, platforms: new Set() };
          existing.count++;
          existing.platforms.add(message.platform);
          hashtagCounts.set(hashtag, existing);
        }
      }

      // Influential users (simplified)
      const userKey = `${message.platform}:${message.author.id}`;
      const existing = influentialUsers.get(userKey);
      const influence = (message.author.followerCount || 0) / 1000000; // Normalize to millions
      
      if (!existing || influence > existing.influence) {
        influentialUsers.set(userKey, {
          user: message.author as SocialMediaUser,
          influence,
          sentiment: message.sentiment?.score || 0
        });
      }
    }

    return {
      totalMessages: messages.length,
      platformBreakdown,
      sentimentSummary: {
        ...sentimentSummary,
        averageScore: sentimentCount > 0 ? totalSentimentScore / sentimentCount : 0
      },
      topKeywords: Array.from(keywordCounts.entries())
        .map(([keyword, data]) => ({ keyword, count: data.count, sentiment: data.sentiment }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 20),
      topHashtags: Array.from(hashtagCounts.entries())
        .map(([hashtag, data]) => ({ hashtag, count: data.count, platforms: Array.from(data.platforms) }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 20),
      influentialUsers: Array.from(influentialUsers.values())
        .sort((a, b) => b.influence - a.influence)
        .slice(0, 10),
      timeRange: { start: startTime, end: endTime },
      metadata: {
        generatedAt: new Date(),
        dataPoints: messages.length,
        coverage: Object.fromEntries(
          Object.entries(platformBreakdown).map(([platform, count]) => [
            platform,
            { messages: count, coverage: count / messages.length }
          ])
        )
      }
    };
  }

  private startCleanupTasks(): void {
    // Clean up old messages every hour
    this.cleanupInterval = setInterval(() => {
      this.cleanupOldMessages();
    }, 60 * 60 * 1000);
  }

  private cleanupOldMessages(): void {
    if (!this.config.storage.enabled || !this.config.storage.retentionDays) {
      return;
    }

    const cutoffDate = new Date(Date.now() - this.config.storage.retentionDays * 24 * 60 * 60 * 1000);
    let removedCount = 0;

    for (const [id, message] of this.messageStorage) {
      if (message.timestamp < cutoffDate) {
        this.messageStorage.delete(id);
        removedCount++;
      }
    }

    if (removedCount > 0) {
      logger.info('Cleaned up old messages', { removedCount });
    }
  }

  // Public API methods
  async createGlobalStream(keywords: string[], platforms?: SocialPlatform[]): Promise<Map<SocialPlatform, SocialMediaStream>> {
    const streams = new Map<SocialPlatform, SocialMediaStream>();
    const targetPlatforms = platforms || Array.from(this.platforms.keys());

    for (const platform of targetPlatforms) {
      const manager = this.platforms.get(platform);
      if (manager && manager.isActive) {
        try {
          const stream = await manager.client.createStream(keywords);
          streams.set(platform, stream);
          manager.streams.set(stream.id, stream);
          
          logger.info('Stream created', { platform, streamId: stream.id, keywords });
        } catch (error) {
          logger.error('Failed to create stream', { platform, error });
        }
      }
    }

    return streams;
  }

  async stopGlobalStream(streamIds: Map<SocialPlatform, string>): Promise<boolean> {
    let allStopped = true;

    for (const [platform, streamId] of streamIds) {
      const manager = this.platforms.get(platform);
      if (manager) {
        try {
          const stopped = await manager.client.stopStream(streamId);
          if (stopped) {
            manager.streams.delete(streamId);
          }
          allStopped = allStopped && stopped;
        } catch (error) {
          logger.error('Failed to stop stream', { platform, streamId, error });
          allStopped = false;
        }
      }
    }

    return allStopped;
  }

  getAggregatedData(timeframe: 'hourly' | 'daily' = 'hourly'): AggregatedSocialData | undefined {
    return this.aggregationCache.get(timeframe);
  }

  getTrendingTopics(): TrendingTopic[] {
    return Array.from(this.trendingTopics.values())
      .sort((a, b) => b.volume - a.volume);
  }

  getPlatformHealth(): Record<SocialPlatform, boolean> {
    const health: Record<SocialPlatform, boolean> = {} as any;
    
    for (const [platform, manager] of this.platforms) {
      health[platform] = manager.isActive;
    }

    return health;
  }

  private setupEventHandlers(): void {
    this.on('social_event', (event: SocialMediaEvent) => {
      logger.debug('Social event received', { 
        type: event.type, 
        platform: event.platform 
      });
    });

    this.on('alert', (alert: SocialMediaEvent) => {
      logger.warn('Social media alert', alert.data);
    });

    this.on('batch_processed', (stats: any) => {
      logger.debug('Batch processed', stats);
    });
  }

  async shutdown(): Promise<void> {
    try {
      logger.info('Shutting down Social Media Manager...');

      // Stop intervals
      if (this.processingInterval) {
        clearInterval(this.processingInterval);
      }
      if (this.cleanupInterval) {
        clearInterval(this.cleanupInterval);
      }

      // Disconnect all platforms
      for (const [platform, manager] of this.platforms) {
        try {
          await manager.client.disconnect();
          logger.info('Platform disconnected', { platform });
        } catch (error) {
          logger.error('Error disconnecting platform', { platform, error });
        }
      }

      // Clear data
      this.platforms.clear();
      this.messageStorage.clear();
      this.aggregationCache.clear();
      this.trendingTopics.clear();

      logger.info('Social Media Manager shutdown complete');
    } catch (error) {
      logger.error('Error during Social Media Manager shutdown:', error);
      throw error;
    }
  }
}