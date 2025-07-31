/**
 * Social Media Platform Manager
 * Coordinates data collection from various social media platforms
 */

import { EventEmitter } from 'events';
import { Logger } from 'winston';
import { createLogger, format, transports } from 'winston';
import { 
  SocialPlatform, 
  SentimentData, 
  TimeFrame,
  CrossPlatformAnalysis,
  PlatformMetrics
} from '../types';
import { TwitterIntegration } from './twitter-integration';
import { DiscordIntegration } from './discord-integration';
import { TelegramIntegration } from './telegram-integration';
import { RedditIntegration } from './reddit-integration';

export interface SocialPlatformConfig {
  enabledPlatforms: SocialPlatform[];
  dataCollectionInterval: number;
  rateLimit: {
    requestsPerMinute: number;
    requestsPerHour: number;
  };
  enableDataValidation: boolean;
  enableDuplicateDetection: boolean;
  maxDataAge: number;
  enableContentFiltering: boolean;
  apiKeys?: {
    twitter?: {
      bearerToken?: string;
      apiKey?: string;
      apiSecret?: string;
      accessToken?: string;
      accessTokenSecret?: string;
    };
    discord?: {
      botToken?: string;
      clientId?: string;
      clientSecret?: string;
    };
    telegram?: {
      botToken?: string;
      apiId?: string;
      apiHash?: string;
    };
    reddit?: {
      clientId?: string;
      clientSecret?: string;
      userAgent?: string;
      username?: string;
      password?: string;
    };
  };
}

export interface DataCollectionRequest {
  entity?: string;
  platform?: SocialPlatform;
  timeframe?: TimeFrame;
  includeInfluencers?: boolean;
}

export interface PlatformStatus {
  platform: SocialPlatform;
  isConnected: boolean;
  isCollecting: boolean;
  lastDataCollection: Date;
  dataCollected: number;
  errorsCount: number;
  rateLimit: {
    remaining: number;
    resetTime: Date;
  };
}

export interface DataCollectionMetrics {
  totalDataPoints: number;
  dataPointsByPlatform: Map<SocialPlatform, number>;
  collectionRate: number; // data points per minute
  errorRate: number;
  duplicatesFiltered: number;
  lastCollectionTime: Date;
}

export class SocialMediaPlatformManager extends EventEmitter {
  private static instance: SocialMediaPlatformManager;
  private logger: Logger;
  private config: SocialPlatformConfig;
  private platformIntegrations: Map<SocialPlatform, any> = new Map();
  private collectionIntervals: Map<SocialPlatform, NodeJS.Timeout> = new Map();
  private recentData: SentimentData[] = [];
  private dataCache: Map<string, SentimentData[]> = new Map();
  private duplicateHashes: Set<string> = new Set();
  private isInitialized: boolean = false;
  private isCollecting: boolean = false;

  private constructor(config: SocialPlatformConfig) {
    super();
    this.config = config;
    this.logger = createLogger({
      level: 'info',
      format: format.combine(
        format.timestamp(),
        format.simple()
      ),
      transports: [
        new transports.Console(),
        new transports.File({ filename: 'logs/social-platforms.log' })
      ],
    });
  }

  static getInstance(config?: SocialPlatformConfig): SocialMediaPlatformManager {
    if (!SocialMediaPlatformManager.instance && config) {
      SocialMediaPlatformManager.instance = new SocialMediaPlatformManager(config);
    } else if (!SocialMediaPlatformManager.instance) {
      throw new Error('SocialMediaPlatformManager must be initialized with config first');
    }
    return SocialMediaPlatformManager.instance;
  }

  async initialize(): Promise<void> {
    try {
      this.logger.info('Initializing Social Media Platform Manager...');

      // Initialize platform integrations
      for (const platform of this.config.enabledPlatforms) {
        await this.initializePlatform(platform);
      }

      this.isInitialized = true;
      this.logger.info('Social Media Platform Manager initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize Social Media Platform Manager:', error);
      throw error;
    }
  }

  private async initializePlatform(platform: SocialPlatform): Promise<void> {
    try {
      let integration: any;

      switch (platform) {
        case SocialPlatform.TWITTER:
          integration = new TwitterIntegration({
            apiKey: this.config.apiKeys?.twitter?.apiKey || '',
            apiSecret: this.config.apiKeys?.twitter?.apiSecret || '',
            bearerToken: this.config.apiKeys?.twitter?.bearerToken || '',
            accessToken: this.config.apiKeys?.twitter?.accessToken || '',
            accessTokenSecret: this.config.apiKeys?.twitter?.accessTokenSecret || '',
            rateLimit: this.config.rateLimit
          });
          break;

        case SocialPlatform.DISCORD:
          integration = new DiscordIntegration({
            botToken: this.config.apiKeys?.discord?.botToken || '',
            clientId: this.config.apiKeys?.discord?.clientId || '',
            clientSecret: this.config.apiKeys?.discord?.clientSecret || '',
            rateLimit: this.config.rateLimit
          });
          break;

        case SocialPlatform.TELEGRAM:
          integration = new TelegramIntegration({
            botToken: this.config.apiKeys?.telegram?.botToken || '',
            apiId: this.config.apiKeys?.telegram?.apiId || '',
            apiHash: this.config.apiKeys?.telegram?.apiHash || '',
            rateLimit: this.config.rateLimit
          });
          break;

        case SocialPlatform.REDDIT:
          integration = new RedditIntegration({
            clientId: this.config.apiKeys?.reddit?.clientId || '',
            clientSecret: this.config.apiKeys?.reddit?.clientSecret || '',
            userAgent: this.config.apiKeys?.reddit?.userAgent || 'YieldSensei/1.0',
            username: this.config.apiKeys?.reddit?.username || '',
            password: this.config.apiKeys?.reddit?.password || '',
            rateLimit: this.config.rateLimit
          });
          break;

        default:
          this.logger.warn(`Platform ${platform} not supported yet`);
          return;
      }

      await integration.initialize();
      this.platformIntegrations.set(platform, integration);

      // Setup event handlers
      integration.on('data_collected', (data: SentimentData[]) => {
        this.handleCollectedData(platform, data);
      });

      integration.on('error', (error: Error) => {
        this.logger.error(`Platform ${platform} error:`, error);
        this.emit('platform_error', { platform, error });
      });

      this.logger.info(`Platform ${platform} initialized successfully`);
    } catch (error) {
      this.logger.error(`Failed to initialize platform ${platform}:`, error);
      throw error;
    }
  }

  async startDataCollection(): Promise<void> {
    try {
      if (!this.isInitialized) {
        throw new Error('Platform manager must be initialized before starting data collection');
      }

      this.logger.info('Starting data collection from all platforms...');

      for (const [platform, integration] of this.platformIntegrations) {
        await this.startPlatformCollection(platform, integration);
      }

      this.isCollecting = true;
      this.logger.info('Data collection started successfully');
    } catch (error) {
      this.logger.error('Failed to start data collection:', error);
      throw error;
    }
  }

  private async startPlatformCollection(platform: SocialPlatform, integration: any): Promise<void> {
    try {
      // Start platform-specific data collection
      await integration.startCollection();

      // Set up periodic collection if supported
      const interval = setInterval(async () => {
        try {
          await integration.collectData();
        } catch (error) {
          this.logger.error(`Collection error for ${platform}:`, error);
        }
      }, this.config.dataCollectionInterval);

      this.collectionIntervals.set(platform, interval);
      this.logger.info(`Started data collection for ${platform}`);
    } catch (error) {
      this.logger.error(`Failed to start collection for ${platform}:`, error);
      throw error;
    }
  }

  async stopDataCollection(): Promise<void> {
    try {
      this.logger.info('Stopping data collection from all platforms...');

      // Stop collection intervals
      for (const [platform, interval] of this.collectionIntervals) {
        clearInterval(interval);
        this.collectionIntervals.delete(platform);
      }

      // Stop platform integrations
      for (const [platform, integration] of this.platformIntegrations) {
        try {
          await integration.stopCollection();
        } catch (error) {
          this.logger.warn(`Failed to stop collection for ${platform}:`, error);
        }
      }

      this.isCollecting = false;
      this.logger.info('Data collection stopped successfully');
    } catch (error) {
      this.logger.error('Failed to stop data collection:', error);
      throw error;
    }
  }

  async fetchSentimentData(request: DataCollectionRequest): Promise<SentimentData[]> {
    try {
      const results: SentimentData[] = [];

      if (request.platform) {
        // Fetch from specific platform
        const integration = this.platformIntegrations.get(request.platform);
        if (integration) {
          const data = await integration.fetchData(request);
          results.push(...data);
        }
      } else {
        // Fetch from all platforms
        const promises = Array.from(this.platformIntegrations.entries()).map(
          async ([platform, integration]) => {
            try {
              return await integration.fetchData({ ...request, platform });
            } catch (error) {
              this.logger.warn(`Failed to fetch data from ${platform}:`, error);
              return [];
            }
          }
        );

        const platformResults = await Promise.all(promises);
        platformResults.forEach(data => results.push(...data));
      }

      // Filter and validate data
      const filteredData = this.filterAndValidateData(results);

      this.logger.info(`Fetched ${filteredData.length} sentiment data points`, {
        entity: request.entity,
        platform: request.platform,
        timeframe: request.timeframe
      });

      return filteredData;
    } catch (error) {
      this.logger.error('Failed to fetch sentiment data:', error);
      throw error;
    }
  }

  async getRecentData(timeframe: TimeFrame = TimeFrame.HOUR): Promise<SentimentData[]> {
    const cutoffTime = this.getTimeframeCutoff(timeframe);
    return this.recentData.filter(data => data.timestamp >= cutoffTime);
  }

  async processSocialMediaData(data: any): Promise<void> {
    try {
      // Convert raw data to SentimentData format
      const sentimentData: SentimentData = {
        id: data.id || `data_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        source: data.platform || SocialPlatform.TWITTER,
        content: data.content || data.text || '',
        author: {
          id: data.author?.id || 'unknown',
          username: data.author?.username || 'unknown',
          followersCount: data.author?.followers_count,
          verified: data.author?.verified,
          influence: data.author?.influence_score
        },
        timestamp: new Date(data.timestamp || data.created_at || Date.now()),
        engagement: {
          likes: data.likes || data.favorite_count,
          retweets: data.retweets || data.retweet_count,
          replies: data.replies || data.reply_count,
          views: data.views || data.view_count,
          shares: data.shares || data.share_count
        },
        metadata: {
          url: data.url,
          threadId: data.thread_id,
          channelId: data.channel_id,
          language: data.language,
          isRetweet: data.is_retweet,
          parentId: data.parent_id
        }
      };

      // Add to recent data
      this.recentData.push(sentimentData);

      // Emit data processed event
      this.emit('data_collected', sentimentData);

      // Cleanup old data
      this.cleanupOldData();
    } catch (error) {
      this.logger.error('Failed to process social media data:', error);
      throw error;
    }
  }

  private handleCollectedData(platform: SocialPlatform, data: SentimentData[]): void {
    try {
      const filteredData = this.filterAndValidateData(data);
      
      // Add to recent data
      this.recentData.push(...filteredData);

      // Cache the data
      const cacheKey = `${platform}_${Date.now()}`;
      this.dataCache.set(cacheKey, filteredData);

      this.logger.debug(`Collected ${filteredData.length} data points from ${platform}`);

      // Emit collected data event
      this.emit('data_collected', {
        platform,
        data: filteredData,
        timestamp: new Date()
      });

      // Cleanup old data periodically
      this.cleanupOldData();
    } catch (error) {
      this.logger.error(`Failed to handle collected data from ${platform}:`, error);
    }
  }

  private filterAndValidateData(data: SentimentData[]): SentimentData[] {
    return data.filter(item => {
      // Skip if data validation is disabled
      if (!this.config.enableDataValidation) {
        return true;
      }

      // Check data age
      const age = Date.now() - item.timestamp.getTime();
      if (age > this.config.maxDataAge) {
        return false;
      }

      // Check for duplicates
      if (this.config.enableDuplicateDetection) {
        const hash = this.generateDataHash(item);
        if (this.duplicateHashes.has(hash)) {
          return false;
        }
        this.duplicateHashes.add(hash);
      }

      // Content filtering
      if (this.config.enableContentFiltering) {
        if (!item.content || item.content.trim().length === 0) {
          return false;
        }
      }

      return true;
    });
  }

  private generateDataHash(data: SentimentData): string {
    const key = `${data.source}_${data.content}_${data.author.id}_${data.timestamp.getTime()}`;
    return Buffer.from(key).toString('base64');
  }

  private cleanupOldData(): void {
    const cutoff = Date.now() - this.config.maxDataAge;
    
    // Clean recent data
    this.recentData = this.recentData.filter(
      item => item.timestamp.getTime() > cutoff
    );

    // Clean cache
    for (const [key, data] of this.dataCache) {
      if (data.length > 0 && data[0].timestamp.getTime() < cutoff) {
        this.dataCache.delete(key);
      }
    }

    // Clean duplicate hashes (keep only recent)
    if (this.duplicateHashes.size > 10000) {
      this.duplicateHashes.clear();
    }
  }

  private getTimeframeCutoff(timeframe: TimeFrame): Date {
    const now = Date.now();
    let cutoff: number;

    switch (timeframe) {
      case TimeFrame.HOUR:
        cutoff = now - (60 * 60 * 1000);
        break;
      case TimeFrame.FOUR_HOURS:
        cutoff = now - (4 * 60 * 60 * 1000);
        break;
      case TimeFrame.DAY:
        cutoff = now - (24 * 60 * 60 * 1000);
        break;
      case TimeFrame.WEEK:
        cutoff = now - (7 * 24 * 60 * 60 * 1000);
        break;
      case TimeFrame.MONTH:
        cutoff = now - (30 * 24 * 60 * 60 * 1000);
        break;
      default:
        cutoff = now - (60 * 60 * 1000); // Default to 1 hour
    }

    return new Date(cutoff);
  }

  async getCrossPlatformAnalysis(entity: string, timeframe: TimeFrame): Promise<CrossPlatformAnalysis> {
    try {
      const platformMetrics = new Map<SocialPlatform, PlatformMetrics>();

      // Collect metrics from each platform
      for (const platform of this.config.enabledPlatforms) {
        try {
          const data = await this.fetchSentimentData({ entity, platform, timeframe });
          
          const metrics: PlatformMetrics = {
            volume: data.length,
            sentiment: {
              current: data.length > 0 ? this.calculateAverageSentiment(data) : 'neutral' as any,
              previous: 'neutral' as any, // Would need historical data
              change: 0,
              direction: 'stable',
              momentum: 'steady',
              volatility: 0,
              timeline: []
            },
            engagement: {
              current: this.calculateAverageEngagement(data),
              previous: 0,
              change: 0,
              peak: { value: 0, timestamp: new Date() },
              average: 0,
              timeline: []
            },
            unique_voices: new Set(data.map(d => d.author.id)).size,
            top_influencers: this.getTopInfluencers(data),
            trending_topics: this.getTrendingTopics(data)
          };

          platformMetrics.set(platform, metrics);
        } catch (error) {
          this.logger.warn(`Failed to get metrics for ${platform}:`, error);
        }
      }

      // Calculate cross-platform consistency
      const consistency = this.calculateConsistency(platformMetrics);

      return {
        entity,
        timeframe,
        platforms: platformMetrics,
        consistency,
        lead_platform: this.determineLeedPlatform(platformMetrics),
        amplification: {
          primary: SocialPlatform.TWITTER, // Default
          secondary: [],
          delay: 0
        },
        cross_pollination: this.calculateCrossPollination(platformMetrics)
      };
    } catch (error) {
      this.logger.error('Failed to generate cross-platform analysis:', error);
      throw error;
    }
  }

  private calculateAverageSentiment(data: SentimentData[]): any {
    // This would integrate with sentiment analysis engine
    return 'neutral';
  }

  private calculateAverageEngagement(data: SentimentData[]): number {
    if (data.length === 0) return 0;
    
    const totalEngagement = data.reduce((sum, item) => {
      const engagement = (item.engagement.likes || 0) + 
                       (item.engagement.retweets || 0) + 
                       (item.engagement.replies || 0) + 
                       (item.engagement.views || 0) + 
                       (item.engagement.shares || 0);
      return sum + engagement;
    }, 0);

    return totalEngagement / data.length;
  }

  private getTopInfluencers(data: SentimentData[]): string[] {
    const influencerScores = new Map<string, number>();
    
    data.forEach(item => {
      const score = (item.author.followersCount || 0) * (item.author.influence || 1);
      influencerScores.set(item.author.username, score);
    });

    return Array.from(influencerScores.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(entry => entry[0]);
  }

  private getTrendingTopics(data: SentimentData[]): string[] {
    // Simple hashtag/mention extraction
    const topics = new Map<string, number>();
    
    data.forEach(item => {
      const hashtags = item.content.match(/#\w+/g) || [];
      const mentions = item.content.match(/@\w+/g) || [];
      
      [...hashtags, ...mentions].forEach(topic => {
        topics.set(topic.toLowerCase(), (topics.get(topic.toLowerCase()) || 0) + 1);
      });
    });

    return Array.from(topics.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(entry => entry[0]);
  }

  private calculateConsistency(platformMetrics: Map<SocialPlatform, PlatformMetrics>): any {
    // Calculate consistency across platforms
    return {
      sentiment: 0.8, // Placeholder
      volume: 0.7,
      timing: 0.9
    };
  }

  private determineLeedPlatform(platformMetrics: Map<SocialPlatform, PlatformMetrics>): SocialPlatform | undefined {
    let maxVolume = 0;
    let leadPlatform: SocialPlatform | undefined;

    for (const [platform, metrics] of platformMetrics) {
      if (metrics.volume > maxVolume) {
        maxVolume = metrics.volume;
        leadPlatform = platform;
      }
    }

    return leadPlatform;
  }

  private calculateCrossPollination(platformMetrics: Map<SocialPlatform, PlatformMetrics>): number {
    // Calculate how much content spreads between platforms
    return 0.5; // Placeholder
  }

  getStatus(): any {
    const platformStatuses: PlatformStatus[] = [];

    for (const [platform, integration] of this.platformIntegrations) {
      platformStatuses.push({
        platform,
        isConnected: integration.isConnected(),
        isCollecting: integration.isCollecting(),
        lastDataCollection: integration.getLastCollectionTime(),
        dataCollected: integration.getDataCollectedCount(),
        errorsCount: integration.getErrorCount(),
        rateLimit: integration.getRateLimitStatus()
      });
    }

    return {
      isInitialized: this.isInitialized,
      isCollecting: this.isCollecting,
      platforms: platformStatuses,
      recentDataCount: this.recentData.length,
      cacheSize: this.dataCache.size
    };
  }

  async shutdown(): Promise<void> {
    try {
      this.logger.info('Shutting down Social Media Platform Manager...');

      // Stop data collection
      await this.stopDataCollection();

      // Shutdown platform integrations
      for (const [platform, integration] of this.platformIntegrations) {
        try {
          await integration.shutdown();
        } catch (error) {
          this.logger.warn(`Failed to shutdown ${platform} integration:`, error);
        }
      }

      // Clear data
      this.recentData = [];
      this.dataCache.clear();
      this.duplicateHashes.clear();

      this.logger.info('Social Media Platform Manager shutdown complete');
    } catch (error) {
      this.logger.error('Failed to shutdown Social Media Platform Manager:', error);
      throw error;
    }
  }
}