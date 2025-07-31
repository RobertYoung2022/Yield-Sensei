/**
 * Telegram Integration
 * Handles Telegram API integration for sentiment data collection
 */

import { EventEmitter } from 'events';
import { Logger } from 'winston';
import { createLogger, format, transports } from 'winston';
import { SentimentData, SocialPlatform } from '../types';
import { TelegramClient } from '../../../integrations/social/telegram-client';
import { getUnifiedAIClient } from '../../../integrations/ai/unified-ai-client';

export interface TelegramConfig {
  botToken: string;
  apiId: string;
  apiHash: string;
  rateLimit: {
    requestsPerMinute: number;
    requestsPerHour: number;
  };
}

export class TelegramIntegration extends EventEmitter {
  private logger: Logger;
  private config: TelegramConfig;
  private telegramClient: TelegramClient;
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

  constructor(config: TelegramConfig) {
    super();
    this.config = config;
    this.telegramClient = new TelegramClient({
      botToken: config.botToken,
      apiId: config.apiId,
      apiHash: config.apiHash
    });
    
    this.logger = createLogger({
      level: 'info',
      format: format.combine(
        format.timestamp(),
        format.simple()
      ),
      transports: [
        new transports.Console(),
        new transports.File({ filename: 'logs/telegram-integration.log' })
      ],
    });
  }

  async initialize(): Promise<void> {
    try {
      this.logger.info('Initializing Telegram integration...');
      
      // Initialize Telegram client
      await this.telegramClient.initialize();
      
      // Test connection
      const status = await this.telegramClient.getHealthStatus();
      if (!status.isHealthy) {
        throw new Error('Telegram client health check failed');
      }

      this.isConnected = true;
      this.rateLimitStatus = {
        remaining: 100, // Default
        resetTime: new Date(Date.now() + 15 * 60 * 1000) // 15 minutes
      };
      
      this.logger.info('Telegram integration initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize Telegram integration:', error);
      this.errorCount++;
      throw error;
    }
  }

  async startCollection(): Promise<void> {
    try {
      this.logger.info('Starting Telegram data collection...');
      this.isCollecting = true;
      
      // Start periodic collection
      this.collectionInterval = setInterval(() => {
        this.collectData().catch(error => {
          this.logger.error('Error in periodic collection:', error);
        });
      }, 5 * 60 * 1000); // Every 5 minutes
      
      this.logger.info('Telegram data collection started');
    } catch (error) {
      this.logger.error('Failed to start Telegram collection:', error);
      this.errorCount++;
      throw error;
    }
  }

  async stopCollection(): Promise<void> {
    try {
      this.logger.info('Stopping Telegram data collection...');
      this.isCollecting = false;
      
      if (this.collectionInterval) {
        clearInterval(this.collectionInterval);
        this.collectionInterval = undefined;
      }
      
      this.logger.info('Telegram data collection stopped');
    } catch (error) {
      this.logger.error('Failed to stop Telegram collection:', error);
      this.errorCount++;
      throw error;
    }
  }

  async collectData(): Promise<void> {
    try {
      if (!this.isCollecting) return;

      // Search for crypto-related messages in monitored Telegram channels
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
          const messages = await this.telegramClient.searchMessages({
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
        
        this.logger.info(`Collected ${sentimentData.length} Telegram messages`);
      }
      
      this.lastCollectionTime = new Date();
    } catch (error) {
      this.logger.error('Failed to collect Telegram data:', error);
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
        query += ' channel:@CryptoChannel OR channel:@DeFiChannel';
      }

      // Search messages
      const result = await this.telegramClient.searchMessages({
        query,
        maxResults: 1000,
        timeframe: timeframe || '1h'
      });

      if (!result.success || !result.data) {
        throw new Error(`Telegram search failed: ${result.error}`);
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
      this.logger.error('Failed to fetch Telegram data:', error);
      this.errorCount++;
      throw error;
    }
  }

  private convertToSentimentData(messages: any[]): SentimentData[] {
    return messages.map(message => ({
      id: message.id.toString(),
      source: SocialPlatform.TELEGRAM,
      content: message.message || '',
      author: {
        id: message.fromId?.userId?.toString() || 'unknown',
        username: message.from?.username || message.from?.firstName || 'unknown',
        followersCount: undefined, // Telegram doesn't have followers
        verified: message.from?.verified || false,
        influence: this.calculateInfluenceScore(message.from, message.peer)
      },
      timestamp: new Date(message.date * 1000),
      engagement: {
        views: message.views,
        shares: message.forwards,
        replies: message.replies?.replies || 0
      },
      metadata: {
        channelId: message.peerId?.channelId?.toString(),
        threadId: message.replyTo?.replyToMsgId?.toString(),
        language: message.from?.langCode,
        parentId: message.replyTo?.replyToMsgId?.toString()
      }
    }));
  }

  private calculateInfluenceScore(from: any, peer: any): number {
    // Calculate influence based on activity and channel role
    let score = 0.1; // Base score
    
    if (from?.premium) {
      score += 0.2; // Premium user
    }
    
    if (from?.bot) {
      score += 0.1; // Bot (can be influential)
    }
    
    // In channels, admins typically have higher influence
    if (peer?.channelId && from?.admin) {
      score += 0.4;
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
      this.logger.info('Shutting down Telegram integration...');
      
      if (this.isCollecting) {
        await this.stopCollection();
      }
      
      this.isConnected = false;
      this.removeAllListeners();
      
      this.logger.info('Telegram integration shutdown complete');
    } catch (error) {
      this.logger.error('Failed to shutdown Telegram integration:', error);
      throw error;
    }
  }
}