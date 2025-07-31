/**
 * Discord Integration
 * Handles Discord API integration for sentiment data collection
 */

import { EventEmitter } from 'events';
import { Logger } from 'winston';
import { createLogger, format, transports } from 'winston';
import { SentimentData, SocialPlatform } from '../types';
import { DiscordClient } from '../../../integrations/social/discord-client';
import { getUnifiedAIClient } from '../../../integrations/ai/unified-ai-client';

export interface DiscordConfig {
  botToken: string;
  clientId: string;
  clientSecret: string;
  rateLimit: {
    requestsPerMinute: number;
    requestsPerHour: number;
  };
}

export class DiscordIntegration extends EventEmitter {
  private logger: Logger;
  private config: DiscordConfig;
  private discordClient: DiscordClient;
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

  constructor(config: DiscordConfig) {
    super();
    this.config = config;
    this.discordClient = new DiscordClient({
      botToken: config.botToken,
      clientId: config.clientId,
      clientSecret: config.clientSecret
    });
    
    this.logger = createLogger({
      level: 'info',
      format: format.combine(
        format.timestamp(),
        format.simple()
      ),
      transports: [
        new transports.Console(),
        new transports.File({ filename: 'logs/discord-integration.log' })
      ],
    });
  }

  async initialize(): Promise<void> {
    try {
      this.logger.info('Initializing Discord integration...');
      
      // Initialize Discord client
      await this.discordClient.initialize();
      
      // Test connection
      const status = await this.discordClient.getHealthStatus();
      if (!status.isHealthy) {
        throw new Error('Discord client health check failed');
      }

      this.isConnected = true;
      this.rateLimitStatus = {
        remaining: 100, // Default
        resetTime: new Date(Date.now() + 15 * 60 * 1000) // 15 minutes
      };
      
      this.logger.info('Discord integration initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize Discord integration:', error);
      this.errorCount++;
      throw error;
    }
  }

  async startCollection(): Promise<void> {
    try {
      this.logger.info('Starting Discord data collection...');
      this.isCollecting = true;
      
      // Start periodic collection
      this.collectionInterval = setInterval(() => {
        this.collectData().catch(error => {
          this.logger.error('Error in periodic collection:', error);
        });
      }, 5 * 60 * 1000); // Every 5 minutes
      
      this.logger.info('Discord data collection started');
    } catch (error) {
      this.logger.error('Failed to start Discord collection:', error);
      this.errorCount++;
      throw error;
    }
  }

  async stopCollection(): Promise<void> {
    try {
      this.logger.info('Stopping Discord data collection...');
      this.isCollecting = false;
      
      if (this.collectionInterval) {
        clearInterval(this.collectionInterval);
        this.collectionInterval = undefined;
      }
      
      this.logger.info('Discord data collection stopped');
    } catch (error) {
      this.logger.error('Failed to stop Discord collection:', error);
      this.errorCount++;
      throw error;
    }
  }

  async collectData(): Promise<void> {
    try {
      if (!this.isCollecting) return;

      // Search for crypto-related messages in monitored Discord servers
      const queries = [
        'DeFi OR "decentralized finance"',
        'Bitcoin OR BTC',
        'Ethereum OR ETH', 
        'yield farming',
        'staking rewards',
        'bridge protocol'
      ];

      const allMessages: any[] = [];
      
      for (const query of queries) {
        try {
          const messages = await this.discordClient.searchMessages({
            query,
            maxResults: 100,
            timeframe: '1h'
          });
          
          if (messages.success && messages.data) {
            allMessages.push(...messages.data.messages);
          }
        } catch (error) {
          this.logger.warn(`Failed to search for "${query}":`, error);
        }
      }

      if (allMessages.length > 0) {
        const sentimentData = this.convertToSentimentData(allMessages);
        this.dataCollectedCount += sentimentData.length;
        this.emit('data_collected', sentimentData);
        
        this.logger.info(`Collected ${sentimentData.length} Discord messages`);
      }
      
      this.lastCollectionTime = new Date();
    } catch (error) {
      this.logger.error('Failed to collect Discord data:', error);
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
        // Search in channels where crypto influencers are active
        query += ' in:general OR in:trading OR in:defi OR in:announcements';
      }

      // Search messages
      const result = await this.discordClient.searchMessages({
        query,
        maxResults: 1000,
        timeframe: timeframe || '1h'
      });

      if (!result.success || !result.data) {
        throw new Error(`Discord search failed: ${result.error}`);
      }

      // Convert to sentiment data
      const sentimentData = this.convertToSentimentData(result.data.messages);
      
      // Filter by timeframe if specified
      if (timeframe) {
        const cutoff = this.getTimeframeCutoff(timeframe);
        return sentimentData.filter(data => data.timestamp >= cutoff);
      }

      return sentimentData;
    } catch (error) {
      this.logger.error('Failed to fetch Discord data:', error);
      this.errorCount++;
      throw error;
    }
  }

  private convertToSentimentData(messages: any[]): SentimentData[] {
    return messages.map(message => ({
      id: message.id,
      source: SocialPlatform.DISCORD,
      content: message.content,
      author: {
        id: message.author.id,
        username: message.author.username,
        followersCount: undefined, // Discord doesn't have followers
        verified: message.author.bot === false,
        influence: this.calculateInfluenceScore(message.author, message.member)
      },
      timestamp: new Date(message.timestamp),
      engagement: {
        likes: message.reactions?.reduce((sum: number, reaction: any) => sum + reaction.count, 0) || 0,
        replies: message.reference ? 1 : 0
      },
      metadata: {
        url: `https://discord.com/channels/${message.guild?.id}/${message.channel.id}/${message.id}`,
        channelId: message.channel.id,
        threadId: message.thread?.id,
        parentId: message.reference?.messageId
      }
    }));
  }

  private calculateInfluenceScore(author: any, member: any): number {
    // Calculate influence based on roles, permissions, and activity
    let score = 0.1; // Base score
    
    if (member?.roles?.cache?.size > 1) {
      score += 0.2; // Has roles
    }
    
    if (member?.permissions?.has('ADMINISTRATOR')) {
      score += 0.5; // Admin
    } else if (member?.permissions?.has('MANAGE_MESSAGES')) {
      score += 0.3; // Moderator
    }
    
    return Math.min(score, 1);
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
      this.logger.info('Shutting down Discord integration...');
      
      if (this.isCollecting) {
        await this.stopCollection();
      }
      
      this.isConnected = false;
      this.removeAllListeners();
      
      this.logger.info('Discord integration shutdown complete');
    } catch (error) {
      this.logger.error('Failed to shutdown Discord integration:', error);
      throw error;
    }
  }
}