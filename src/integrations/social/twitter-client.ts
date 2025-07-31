/**
 * Twitter API Client
 * Provides integration with Twitter API v2 for real-time tweet streaming and analysis
 */

import axios, { AxiosInstance } from 'axios';
import { EventEmitter } from 'events';
import WebSocket from 'ws';
import Logger from '@/shared/logging/logger';
import {
  SocialMediaClient,
  TwitterConfig,
  SocialMediaResponse,
  SocialMediaMessage,
  SocialMediaStream,
  SocialMediaUser,
  SearchOptions,
  RateLimitStatus,
  SentimentScore,
  MessageMetrics,
  SocialMediaError
} from './types';

const logger = Logger.getLogger('twitter-client');

interface TwitterTweet {
  id: string;
  text: string;
  author_id: string;
  created_at: string;
  public_metrics?: {
    retweet_count: number;
    like_count: number;
    reply_count: number;
    quote_count: number;
  };
  entities?: {
    hashtags?: Array<{ tag: string }>;
    mentions?: Array<{ username: string; id: string }>;
    urls?: Array<{ expanded_url: string; display_url: string }>;
  };
  referenced_tweets?: Array<{
    type: 'retweeted' | 'quoted' | 'replied_to';
    id: string;
  }>;
  attachments?: {
    media_keys?: string[];
  };
}

interface TwitterUser {
  id: string;
  username: string;
  name: string;
  description?: string;
  profile_image_url?: string;
  verified?: boolean;
  public_metrics?: {
    followers_count: number;
    following_count: number;
    tweet_count: number;
  };
  created_at?: string;
  location?: string;
  url?: string;
}

interface TwitterStreamRule {
  value: string;
  tag?: string;
  id?: string;
}

export class TwitterClient extends EventEmitter implements SocialMediaClient {
  public readonly platform = 'twitter' as const;
  public readonly config: TwitterConfig;
  
  private client: AxiosInstance;
  private streamWs?: WebSocket;
  private activeStreams: Map<string, SocialMediaStream> = new Map();
  private rateLimitStatus: Map<string, RateLimitStatus> = new Map();
  private isAuthenticated = false;

  constructor(config: TwitterConfig) {
    super();
    this.config = {
      tweetFields: ['created_at', 'author_id', 'public_metrics', 'entities', 'referenced_tweets'],
      userFields: ['username', 'name', 'description', 'profile_image_url', 'verified', 'public_metrics'],
      expansions: ['author_id', 'referenced_tweets.id'],
      maxResults: 100,
      rateLimitRpm: 300,
      ...config
    };

    this.client = axios.create({
      baseURL: 'https://api.twitter.com/2',
      timeout: 30000,
      headers: {
        'Authorization': `Bearer ${this.config.bearerToken}`,
        'Content-Type': 'application/json'
      }
    });

    this.setupInterceptors();
  }

  async initialize(): Promise<void> {
    try {
      logger.info('Initializing Twitter client...');
      
      // Test authentication
      const authResult = await this.authenticate();
      if (!authResult) {
        throw new Error('Twitter authentication failed');
      }

      logger.info('Twitter client initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Twitter client:', error);
      throw error;
    }
  }

  async authenticate(): Promise<boolean> {
    try {
      // Test the bearer token with a simple API call
      const response = await this.client.get('/users/me');
      
      if (response.status === 200) {
        this.isAuthenticated = true;
        logger.info('Twitter authentication successful');
        return true;
      }
      
      return false;
    } catch (error) {
      logger.error('Twitter authentication failed:', error);
      this.isAuthenticated = false;
      return false;
    }
  }

  async disconnect(): Promise<void> {
    try {
      logger.info('Disconnecting Twitter client...');
      
      // Stop all active streams
      for (const streamId of this.activeStreams.keys()) {
        await this.stopStream(streamId);
      }

      // Close WebSocket connection
      if (this.streamWs) {
        this.streamWs.close();
        this.streamWs = undefined;
      }

      this.isAuthenticated = false;
      logger.info('Twitter client disconnected');
    } catch (error) {
      logger.error('Error disconnecting Twitter client:', error);
      throw error;
    }
  }

  async sendMessage(content: string, _channelId?: string): Promise<SocialMediaResponse<string>> {
    try {
      const response = await this.client.post('/tweets', {
        text: content
      });

      return {
        success: true,
        data: response.data.data?.id,
        metadata: {
          platform: this.platform,
          timestamp: Date.now()
        }
      };
    } catch (error) {
      return this.handleError('sendMessage', error);
    }
  }

  async getMessage(messageId: string): Promise<SocialMediaResponse<SocialMediaMessage>> {
    try {
      const params = {
        'tweet.fields': this.config.tweetFields?.join(','),
        'user.fields': this.config.userFields?.join(','),
        'expansions': this.config.expansions?.join(',')
      };

      const response = await this.client.get(`/tweets/${messageId}`, { params });
      const tweet = response.data.data;
      const includes = response.data.includes || {};

      if (!tweet) {
        return {
          success: false,
          error: 'Tweet not found',
          metadata: { platform: this.platform, timestamp: Date.now() }
        };
      }

      const socialMessage = this.convertTweetToSocialMessage(tweet, includes);

      return {
        success: true,
        data: socialMessage,
        metadata: {
          platform: this.platform,
          timestamp: Date.now()
        }
      };
    } catch (error) {
      return this.handleError('getMessage', error);
    }
  }

  async deleteMessage(messageId: string): Promise<SocialMediaResponse<boolean>> {
    try {
      const response = await this.client.delete(`/tweets/${messageId}`);
      
      return {
        success: true,
        data: response.data.data?.deleted || false,
        metadata: {
          platform: this.platform,
          timestamp: Date.now()
        }
      };
    } catch (error) {
      return this.handleError('deleteMessage', error);
    }
  }

  async createStream(keywords: string[], _channels?: string[]): Promise<SocialMediaStream> {
    try {
      logger.info('Creating Twitter stream', { keywords });

      // Create stream rules
      const rules: TwitterStreamRule[] = keywords.map(keyword => ({
        value: keyword,
        tag: `keyword_${keyword.replace(/\s+/g, '_')}`
      }));

      // Add rules to Twitter
      await this.addStreamRules(rules);

      const streamId = `twitter_stream_${Date.now()}`;
      
      const stream: SocialMediaStream = {
        id: streamId,
        platform: this.platform,
        type: 'real-time',
        keywords,
        channels: [],
        isActive: false,
        onMessage: () => {},
        onError: () => {}
      };

      this.activeStreams.set(streamId, stream);

      // Start the actual streaming connection
      await this.startStreamConnection(stream);

      return stream;
    } catch (error) {
      logger.error('Failed to create Twitter stream:', error);
      throw error;
    }
  }

  private async addStreamRules(rules: TwitterStreamRule[]): Promise<void> {
    try {
      // Delete existing rules first
      const existingRulesResponse = await this.client.get('/tweets/search/stream/rules');
      const existingRules = existingRulesResponse.data.data || [];
      
      if (existingRules.length > 0) {
        const ruleIds = existingRules.map((rule: any) => rule.id);
        await this.client.post('/tweets/search/stream/rules', {
          delete: { ids: ruleIds }
        });
      }

      // Add new rules
      await this.client.post('/tweets/search/stream/rules', {
        add: rules
      });

      logger.info('Stream rules updated', { rulesCount: rules.length });
    } catch (error) {
      logger.error('Failed to update stream rules:', error);
      throw error;
    }
  }

  private async startStreamConnection(stream: SocialMediaStream): Promise<void> {
    try {
      const streamUrl = `https://api.twitter.com/2/tweets/search/stream?tweet.fields=${this.config.tweetFields?.join(',')}&user.fields=${this.config.userFields?.join(',')}&expansions=${this.config.expansions?.join(',')}`;
      
      // Use Server-Sent Events for Twitter streaming
      const response = await this.client.get(streamUrl, {
        responseType: 'stream',
        headers: {
          'Accept': 'application/json'
        }
      });

      stream.isActive = true;

      response.data.on('data', (chunk: Buffer) => {
        const lines = chunk.toString().split('\n').filter(line => line.trim());
        
        for (const line of lines) {
          try {
            const data = JSON.parse(line);
            if (data.data) {
              const socialMessage = this.convertTweetToSocialMessage(data.data, data.includes || {});
              stream.onMessage(socialMessage);
              this.emit('message', socialMessage);
            }
          } catch (parseError) {
            logger.debug('Failed to parse stream data:', parseError);
          }
        }
      });

      response.data.on('error', (error: Error) => {
        logger.error('Twitter stream error:', error);
        stream.onError(error);
        stream.isActive = false;
      });

      response.data.on('end', () => {
        logger.info('Twitter stream ended');
        stream.isActive = false;
      });

      logger.info('Twitter stream connection started', { streamId: stream.id });
    } catch (error) {
      logger.error('Failed to start stream connection:', error);
      stream.isActive = false;
      throw error;
    }
  }

  async stopStream(streamId: string): Promise<boolean> {
    try {
      const stream = this.activeStreams.get(streamId);
      if (!stream) {
        return false;
      }

      stream.isActive = false;
      this.activeStreams.delete(streamId);

      logger.info('Twitter stream stopped', { streamId });
      return true;
    } catch (error) {
      logger.error('Failed to stop Twitter stream:', error);
      return false;
    }
  }

  async searchMessages(query: string, options: SearchOptions = {}): Promise<SocialMediaResponse<SocialMediaMessage[]>> {
    try {
      const params: any = {
        query,
        max_results: options.limit || this.config.maxResults,
        'tweet.fields': this.config.tweetFields?.join(','),
        'user.fields': this.config.userFields?.join(','),
        'expansions': this.config.expansions?.join(',')
      };

      if (options.startTime) {
        params.start_time = options.startTime.toISOString();
      }
      if (options.endTime) {
        params.end_time = options.endTime.toISOString();
      }
      if (options.sinceId) {
        params.since_id = options.sinceId;
      }
      if (options.untilId) {
        params.until_id = options.untilId;
      }

      const response = await this.client.get('/tweets/search/recent', { params });
      const tweets = response.data.data || [];
      const includes = response.data.includes || {};

      const socialMessages = tweets.map((tweet: TwitterTweet) =>
        this.convertTweetToSocialMessage(tweet, includes)
      );

      return {
        success: true,
        data: socialMessages,
        metadata: {
          platform: this.platform,
          timestamp: Date.now()
        }
      };
    } catch (error) {
      return this.handleError('searchMessages', error);
    }
  }

  async getChannelMessages(_channelId: string, _options?: SearchOptions): Promise<SocialMediaResponse<SocialMediaMessage[]>> {
    // Twitter doesn't have channels, so this is not applicable
    return {
      success: false,
      error: 'Twitter does not support channel-based message retrieval',
      metadata: { platform: this.platform, timestamp: Date.now() }
    };
  }

  async getUser(userId: string): Promise<SocialMediaResponse<SocialMediaUser>> {
    try {
      const params = {
        'user.fields': this.config.userFields?.join(',')
      };

      const response = await this.client.get(`/users/${userId}`, { params });
      const user = response.data.data;

      if (!user) {
        return {
          success: false,
          error: 'User not found',
          metadata: { platform: this.platform, timestamp: Date.now() }
        };
      }

      const socialUser = this.convertTwitterUserToSocialUser(user);

      return {
        success: true,
        data: socialUser,
        metadata: {
          platform: this.platform,
          timestamp: Date.now()
        }
      };
    } catch (error) {
      return this.handleError('getUser', error);
    }
  }

  async followUser(userId: string): Promise<SocialMediaResponse<boolean>> {
    try {
      const response = await this.client.post('/users/me/following', {
        target_user_id: userId
      });

      return {
        success: true,
        data: response.data.data?.following || false,
        metadata: {
          platform: this.platform,
          timestamp: Date.now()
        }
      };
    } catch (error) {
      return this.handleError('followUser', error);
    }
  }

  async unfollowUser(userId: string): Promise<SocialMediaResponse<boolean>> {
    try {
      const response = await this.client.delete(`/users/me/following/${userId}`);

      return {
        success: true,
        data: response.data.data?.following === false,
        metadata: {
          platform: this.platform,
          timestamp: Date.now()
        }
      };
    } catch (error) {
      return this.handleError('unfollowUser', error);
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.client.get('/users/me');
      return response.status === 200;
    } catch (error) {
      logger.warn('Twitter health check failed:', error);
      return false;
    }
  }

  async getRateLimitStatus(): Promise<RateLimitStatus> {
    const defaultStatus: RateLimitStatus = {
      remaining: 0,
      reset: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes from now
      limit: this.config.rateLimitRpm || 300,
      resetInSeconds: 15 * 60
    };

    return this.rateLimitStatus.get('default') || defaultStatus;
  }

  private convertTweetToSocialMessage(tweet: TwitterTweet, includes: any): SocialMediaMessage {
    const author = includes.users?.find((u: TwitterUser) => u.id === tweet.author_id) || {
      id: tweet.author_id,
      username: 'unknown',
      name: 'Unknown User'
    };

    const metrics: MessageMetrics = tweet.public_metrics ? {
      likes: tweet.public_metrics.like_count,
      retweets: tweet.public_metrics.retweet_count,
      replies: tweet.public_metrics.reply_count,
      shares: tweet.public_metrics.quote_count
    } : {};

    const hashtags = tweet.entities?.hashtags?.map(h => h.tag) || [];
    const mentions = tweet.entities?.mentions?.map(m => m.username) || [];

    return {
      id: tweet.id,
      platform: this.platform,
      author: {
        id: author.id,
        username: author.username,
        displayName: author.name,
        verified: author.verified || false,
        followerCount: author.public_metrics?.followers_count
      },
      content: tweet.text,
      timestamp: new Date(tweet.created_at),
      url: `https://twitter.com/${author.username}/status/${tweet.id}`,
      hashtags,
      mentions,
      metrics,
      isReply: tweet.referenced_tweets?.some(rt => rt.type === 'replied_to') || false,
      isRetweet: tweet.referenced_tweets?.some(rt => rt.type === 'retweeted') || false,
      originalMessageId: tweet.referenced_tweets?.find(rt => rt.type === 'retweeted')?.id
    };
  }

  private convertTwitterUserToSocialUser(user: TwitterUser): SocialMediaUser {
    return {
      id: user.id,
      username: user.username,
      displayName: user.name,
      description: user.description,
      avatarUrl: user.profile_image_url,
      verified: user.verified || false,
      followerCount: user.public_metrics?.followers_count || 0,
      followingCount: user.public_metrics?.following_count || 0,
      createdAt: user.created_at ? new Date(user.created_at) : new Date(),
      location: user.location,
      website: user.url,
      metrics: {
        totalTweets: user.public_metrics?.tweet_count
      }
    };
  }

  private handleError(operation: string, error: any): SocialMediaResponse<any> {
    logger.error(`Twitter ${operation} failed:`, error);

    const socialError: SocialMediaError = new Error(
      error?.response?.data?.detail || error?.message || 'Unknown Twitter API error'
    ) as SocialMediaError;

    socialError.platform = this.platform;
    socialError.code = error?.response?.data?.type || error?.code;
    socialError.rateLimited = error?.response?.status === 429;
    socialError.retryable = error?.response?.status >= 500 || error?.response?.status === 429;

    if (socialError.rateLimited && error?.response?.headers) {
      const resetTime = error.response.headers['x-rate-limit-reset'];
      socialError.retryAfter = resetTime ? parseInt(resetTime) - Math.floor(Date.now() / 1000) : 900;
    }

    return {
      success: false,
      error: socialError.message,
      metadata: {
        platform: this.platform,
        timestamp: Date.now()
      }
    };
  }

  private setupInterceptors(): void {
    // Request interceptor
    this.client.interceptors.request.use(
      (config) => {
        logger.debug('Twitter API request', {
          method: config.method,
          url: config.url
        });
        return config;
      },
      (error) => {
        logger.error('Twitter API request error:', error);
        return Promise.reject(error);
      }
    );

    // Response interceptor for rate limit tracking
    this.client.interceptors.response.use(
      (response) => {
        // Track rate limits
        const headers = response.headers;
        if (headers['x-rate-limit-remaining'] && headers['x-rate-limit-reset']) {
          const rateLimitStatus: RateLimitStatus = {
            remaining: parseInt(headers['x-rate-limit-remaining']),
            reset: new Date(parseInt(headers['x-rate-limit-reset']) * 1000),
            limit: parseInt(headers['x-rate-limit-limit'] || '300'),
            resetInSeconds: parseInt(headers['x-rate-limit-reset']) - Math.floor(Date.now() / 1000)
          };
          this.rateLimitStatus.set('default', rateLimitStatus);
        }

        logger.debug('Twitter API response', {
          status: response.status,
          rateLimitRemaining: headers['x-rate-limit-remaining']
        });
        return response;
      },
      (error) => {
        logger.error('Twitter API response error:', {
          status: error.response?.status,
          message: error.response?.data?.detail || error.message
        });
        return Promise.reject(error);
      }
    );
  }
}