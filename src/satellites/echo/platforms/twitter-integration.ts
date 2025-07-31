/**
 * Twitter Integration
 * Handles Twitter/X API integration for sentiment data collection
 */

import { EventEmitter } from 'events';
import { Logger } from 'winston';
import { createLogger, format, transports } from 'winston';
import { SentimentData, SocialPlatform } from '../types';
import { TwitterClient } from '../../../integrations/social/twitter-client';
import { getUnifiedAIClient } from '../../../integrations/ai/unified-ai-client';

export interface TwitterConfig {
  apiKey: string;
  apiSecret: string;
  bearerToken: string;
  accessToken: string;
  accessTokenSecret: string;
  rateLimit: {
    requestsPerMinute: number;
    requestsPerHour: number;
  };
}

export class TwitterIntegration extends EventEmitter {
  private logger: Logger;
  private config: TwitterConfig;
  private twitterClient: TwitterClient;
  private aiClient = getUnifiedAIClient();
  private isConnected: boolean = false;
  private isCollecting: boolean = false;
  private lastCollectionTime: Date = new Date();
  private dataCollectedCount: number = 0;
  private errorCount: number = 0;
  private rateLimitStatus = {
    remaining: 0,
    resetTime: new Date()
  };
  private collectionInterval?: NodeJS.Timeout;

  constructor(config: TwitterConfig) {
    super();
    this.config = config;
    this.twitterClient = new TwitterClient({
      apiKey: config.apiKey,
      apiSecret: config.apiSecret,
      bearerToken: config.bearerToken,
      accessToken: config.accessToken,
      accessTokenSecret: config.accessTokenSecret
    });
    
    this.logger = createLogger({
      level: 'info',
      format: format.combine(
        format.timestamp(),
        format.simple()
      ),
      transports: [
        new transports.Console(),
        new transports.File({ filename: 'logs/twitter-integration.log' })
      ],
    });
  }

  async initialize(): Promise<void> {
    try {
      this.logger.info('Initializing Twitter integration...');
      
      // Initialize Twitter client
      await this.twitterClient.initialize();
      
      // Test connection
      const status = await this.twitterClient.getHealthStatus();
      if (!status.isHealthy) {
        throw new Error('Twitter client health check failed');
      }

      this.isConnected = true;
      this.rateLimitStatus = {
        remaining: 100, // Default
        resetTime: new Date(Date.now() + 15 * 60 * 1000) // 15 minutes
      };
      
      this.logger.info('Twitter integration initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize Twitter integration:', error);
      this.errorCount++;
      throw error;
    }
  }

  async startCollection(): Promise<void> {
    try {
      this.logger.info('Starting Twitter data collection...');
      this.isCollecting = true;
      
      // Start periodic collection
      this.collectionInterval = setInterval(() => {
        this.collectData().catch(error => {
          this.logger.error('Error in periodic collection:', error);
        });
      }, 5 * 60 * 1000); // Every 5 minutes
      
      this.logger.info('Twitter data collection started');
    } catch (error) {
      this.logger.error('Failed to start Twitter collection:', error);
      this.errorCount++;
      throw error;
    }
  }

  async stopCollection(): Promise<void> {
    try {
      this.logger.info('Stopping Twitter data collection...');
      this.isCollecting = false;
      
      if (this.collectionInterval) {
        clearInterval(this.collectionInterval);
        this.collectionInterval = undefined;
      }
      
      this.logger.info('Twitter data collection stopped');
    } catch (error) {
      this.logger.error('Failed to stop Twitter collection:', error);
      this.errorCount++;
      throw error;
    }
  }

  async collectData(): Promise<void> {
    try {
      if (!this.isCollecting) return;

      // Search for crypto-related tweets
      const queries = [
        'DeFi OR "decentralized finance"',
        'Bitcoin OR BTC',
        'Ethereum OR ETH',
        'yield farming',
        'staking rewards',
        'bridge protocol'
      ];

      const allTweets: any[] = [];
      
      for (const query of queries) {
        try {
          const tweets = await this.twitterClient.searchTweets({
            query,
            maxResults: 100,
            sortOrder: 'recency'
          });
          
          if (tweets.success && tweets.data) {
            allTweets.push(...tweets.data.tweets);
          }
        } catch (error) {
          this.logger.warn(`Failed to search for "${query}":`, error);
        }
      }

      if (allTweets.length > 0) {
        const sentimentData = this.convertToSentimentData(allTweets);
        this.dataCollectedCount += sentimentData.length;
        this.emit('data_collected', sentimentData);
        
        this.logger.info(`Collected ${sentimentData.length} tweets`);
      }
      
      this.lastCollectionTime = new Date();
    } catch (error) {
      this.logger.error('Failed to collect Twitter data:', error);
      this.errorCount++;
      this.emit('error', error);
    }
  }

  async fetchData(request: any): Promise<SentimentData[]> {
    try {
      const { entity, timeframe, includeInfluencers } = request;
      
      // Build search query
      let query = entity || 'crypto OR DeFi OR blockchain';
      
      if (includeInfluencers) {
        query += ' (from:VitalikButerin OR from:AnthonyPompliano OR from:cz_binance OR from:elonmusk)';
      }

      // Search tweets
      const result = await this.twitterClient.searchTweets({
        query,
        maxResults: 1000,
        sortOrder: 'recency'
      });

      if (!result.success || !result.data) {
        throw new Error(`Twitter search failed: ${result.error}`);
      }

      // Convert to sentiment data
      const sentimentData = this.convertToSentimentData(result.data.tweets);
      
      // Filter by timeframe if specified
      if (timeframe) {
        const cutoff = this.getTimeframeCutoff(timeframe);
        return sentimentData.filter(data => data.timestamp >= cutoff);
      }

      return sentimentData;
    } catch (error) {
      this.logger.error('Failed to fetch Twitter data:', error);
      this.errorCount++;
      throw error;
    }
  }

  private convertToSentimentData(tweets: any[]): SentimentData[] {
    return tweets.map(tweet => ({
      id: tweet.id,
      source: SocialPlatform.TWITTER,
      content: tweet.text || tweet.full_text,
      author: {
        id: tweet.user.id_str,
        username: tweet.user.screen_name,
        followersCount: tweet.user.followers_count,
        verified: tweet.user.verified,
        influence: this.calculateInfluenceScore(tweet.user)
      },
      timestamp: new Date(tweet.created_at),
      engagement: {
        likes: tweet.favorite_count,
        retweets: tweet.retweet_count,
        replies: tweet.reply_count,
        views: tweet.view_count
      },
      metadata: {
        url: `https://twitter.com/${tweet.user.screen_name}/status/${tweet.id_str}`,
        language: tweet.lang,
        isRetweet: tweet.retweeted,
        parentId: tweet.in_reply_to_status_id_str
      }
    }));
  }

  private calculateInfluenceScore(user: any): number {
    // Simple influence calculation based on followers and engagement
    const followers = user.followers_count || 0;
    const verified = user.verified ? 1.5 : 1;
    return Math.min((followers / 1000000) * verified, 1); // Normalize to 0-1
  }

  private getTimeframeCutoff(timeframe: string): Date {
    const now = Date.now();
    let cutoff: number;

    switch (timeframe) {
      case 'hour':
        cutoff = now - (60 * 60 * 1000);
        break;
      case 'day':
        cutoff = now - (24 * 60 * 60 * 1000);
        break;
      case 'week':
        cutoff = now - (7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        cutoff = now - (30 * 24 * 60 * 60 * 1000);
        break;
      default:
        cutoff = now - (60 * 60 * 1000); // Default to 1 hour
    }

    return new Date(cutoff);
  }

  // Status methods
  isConnected(): boolean {
    return this.isConnected;
  }

  isCollecting(): boolean {
    return this.isCollecting;
  }

  getLastCollectionTime(): Date {
    return this.lastCollectionTime;
  }

  getDataCollectedCount(): number {
    return this.dataCollectedCount;
  }

  getErrorCount(): number {
    return this.errorCount;
  }

  getRateLimitStatus(): any {
    return this.rateLimitStatus;
  }

  async shutdown(): Promise<void> {
    try {
      this.logger.info('Shutting down Twitter integration...');
      
      if (this.isCollecting) {
        await this.stopCollection();
      }
      
      this.isConnected = false;
      this.removeAllListeners();
      
      this.logger.info('Twitter integration shutdown complete');
    } catch (error) {
      this.logger.error('Failed to shutdown Twitter integration:', error);
      throw error;
    }
  }
}