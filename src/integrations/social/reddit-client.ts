/**
 * Reddit API Client
 * Provides integration with Reddit API for subreddit monitoring and post analysis
 */

import { EventEmitter } from 'events';
import axios, { AxiosInstance } from 'axios';
import Logger from '@/shared/logging/logger';
import {
  SocialMediaClient,
  RedditConfig,
  SocialMediaResponse,
  SocialMediaMessage,
  SocialMediaStream,
  SocialMediaUser,
  SearchOptions,
  RateLimitStatus,
  MessageMetrics,
  SocialMediaError
} from './types';

const logger = Logger.getLogger('reddit-client');

interface RedditTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
}

interface RedditListing {
  kind: string;
  data: {
    after?: string;
    before?: string;
    dist: number;
    children: RedditListingItem[];
  };
}

interface RedditListingItem {
  kind: string;
  data: RedditPost | RedditComment;
}

interface RedditPost {
  id: string;
  name: string;
  title: string;
  selftext: string;
  author: string;
  author_fullname?: string;
  subreddit: string;
  subreddit_name_prefixed: string;
  created_utc: number;
  score: number;
  upvote_ratio: number;
  num_comments: number;
  url: string;
  permalink: string;
  thumbnail?: string;
  is_video: boolean;
  is_self: boolean;
  over_18: boolean;
  spoiler: boolean;
  locked: boolean;
  stickied: boolean;
  gilded: number;
  archived: boolean;
  distinguished?: string;
  link_flair_text?: string;
  author_flair_text?: string;
  media?: any;
  media_embed?: any;
  secure_media?: any;
  secure_media_embed?: any;
}

interface RedditComment {
  id: string;
  name: string;
  author: string;
  author_fullname?: string;
  body: string;
  body_html: string;
  subreddit: string;
  created_utc: number;
  score: number;
  ups: number;
  downs: number;
  parent_id: string;
  link_id: string;
  depth: number;
  is_submitter: boolean;
  distinguished?: string;
  gilded: number;
  archived: boolean;
  replies?: RedditListing | string;
}

interface RedditUser {
  id: string;
  name: string;
  icon_img: string;
  created_utc: number;
  link_karma: number;
  comment_karma: number;
  verified: boolean;
  is_gold: boolean;
  is_mod: boolean;
  has_verified_email: boolean;
  subreddit?: {
    display_name: string;
    public_description: string;
    subscribers: number;
  };
}

export class RedditClient extends EventEmitter implements SocialMediaClient {
  public readonly platform = 'reddit' as const;
  public readonly config: RedditConfig;
  
  private client: AxiosInstance;
  private accessToken?: string;
  private tokenExpiresAt?: Date;
  private pollingInterval?: NodeJS.Timeout;
  private activeStreams: Map<string, SocialMediaStream> = new Map();
  private rateLimitStatus: RateLimitStatus;
  private isPolling = false;
  private lastPostIds: Set<string> = new Set();

  constructor(config: RedditConfig) {
    super();
    this.config = {
      sortBy: 'hot',
      timeRange: 'day',
      userAgent: 'YieldSensei/1.0.0',
      ...config
    };

    this.client = axios.create({
      timeout: 30000,
      headers: {
        'User-Agent': this.config.userAgent
      }
    });

    this.rateLimitStatus = {
      remaining: 60,
      reset: new Date(Date.now() + 60 * 1000),
      limit: 60,
      resetInSeconds: 60
    };

    this.setupInterceptors();
  }

  async initialize(): Promise<void> {
    try {
      logger.info('Initializing Reddit client...');
      
      // Authenticate and get access token
      const authResult = await this.authenticate();
      if (!authResult) {
        throw new Error('Reddit authentication failed');
      }

      // Start monitoring subreddits if configured
      if (this.config.subreddits && this.config.subreddits.length > 0) {
        await this.startMonitoring();
      }

      logger.info('Reddit client initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Reddit client:', error);
      throw error;
    }
  }

  async authenticate(): Promise<boolean> {
    try {
      const credentials = Buffer.from(`${this.config.clientId}:${this.config.clientSecret}`).toString('base64');
      
      const response = await axios.post('https://www.reddit.com/api/v1/access_token', 
        'grant_type=client_credentials',
        {
          headers: {
            'Authorization': `Basic ${credentials}`,
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': this.config.userAgent
          }
        }
      );

      const tokenData: RedditTokenResponse = response.data;
      this.accessToken = tokenData.access_token;
      this.tokenExpiresAt = new Date(Date.now() + (tokenData.expires_in * 1000));

      // Update client headers with access token
      this.client.defaults.baseURL = 'https://oauth.reddit.com';
      this.client.defaults.headers['Authorization'] = `Bearer ${this.accessToken}`;

      logger.info('Reddit authentication successful');
      return true;
    } catch (error) {
      logger.error('Reddit authentication failed:', error);
      return false;
    }
  }

  private async ensureValidToken(): Promise<void> {
    if (!this.accessToken || !this.tokenExpiresAt || this.tokenExpiresAt <= new Date()) {
      await this.authenticate();
    }
  }

  private async startMonitoring(): Promise<void> {
    if (this.isPolling) {
      return;
    }

    this.isPolling = true;
    logger.info('Starting Reddit monitoring...', { subreddits: this.config.subreddits });

    const poll = async () => {
      try {
        await this.ensureValidToken();
        
        for (const subreddit of this.config.subreddits || []) {
          await this.checkSubredditForNewPosts(subreddit);
        }
      } catch (error) {
        logger.error('Reddit polling error:', error);
      }

      if (this.isPolling) {
        this.pollingInterval = setTimeout(poll, 60000); // Poll every minute
      }
    };

    poll();
  }

  private async checkSubredditForNewPosts(subreddit: string): Promise<void> {
    try {
      const response = await this.client.get(`/r/${subreddit}/${this.config.sortBy}`, {
        params: {
          limit: 25,
          t: this.config.timeRange
        }
      });

      const listing: RedditListing = response.data;
      
      for (const item of listing.data.children) {
        if (item.kind === 't3') { // Post
          const post = item.data as RedditPost;
          
          if (!this.lastPostIds.has(post.id)) {
            this.lastPostIds.add(post.id);
            
            const socialMessage = this.convertRedditPostToSocialMessage(post);
            
            // Emit to active streams
            for (const stream of this.activeStreams.values()) {
              if (this.messageMatchesStreamKeywords(socialMessage.content, stream.keywords)) {
                stream.onMessage(socialMessage);
              }
            }

            this.emit('message', socialMessage);
          }
        }
      }

      // Keep only recent post IDs (last 1000)
      if (this.lastPostIds.size > 1000) {
        const idsArray = Array.from(this.lastPostIds);
        this.lastPostIds = new Set(idsArray.slice(-500));
      }

    } catch (error) {
      logger.error(`Error checking subreddit ${subreddit}:`, error);
    }
  }

  private messageMatchesStreamKeywords(content: string, keywords: string[]): boolean {
    const lowerContent = content.toLowerCase();
    return keywords.some(keyword => lowerContent.includes(keyword.toLowerCase()));
  }

  async disconnect(): Promise<void> {
    try {
      logger.info('Disconnecting Reddit client...');
      
      this.isPolling = false;
      
      if (this.pollingInterval) {
        clearTimeout(this.pollingInterval);
        this.pollingInterval = undefined;
      }

      this.activeStreams.clear();
      this.accessToken = undefined;
      this.tokenExpiresAt = undefined;
      
      logger.info('Reddit client disconnected');
    } catch (error) {
      logger.error('Error disconnecting Reddit client:', error);
      throw error;
    }
  }

  async sendMessage(_content: string, _channelId?: string): Promise<SocialMediaResponse<string>> {
    return {
      success: false,
      error: 'Reddit does not support sending messages through this API',
      metadata: { platform: this.platform, timestamp: Date.now() }
    };
  }

  async getMessage(messageId: string): Promise<SocialMediaResponse<SocialMediaMessage>> {
    try {
      await this.ensureValidToken();
      
      // Try to get as post first
      const response = await this.client.get(`/comments/${messageId}`, {
        params: { limit: 1 }
      });

      const listing: RedditListing[] = response.data;
      if (listing.length > 0 && listing[0].data.children.length > 0) {
        const post = listing[0].data.children[0].data as RedditPost;
        const socialMessage = this.convertRedditPostToSocialMessage(post);

        return {
          success: true,
          data: socialMessage,
          metadata: {
            platform: this.platform,
            timestamp: Date.now()
          }
        };
      }

      return {
        success: false,
        error: 'Post not found',
        metadata: { platform: this.platform, timestamp: Date.now() }
      };
    } catch (error) {
      return this.handleError('getMessage', error);
    }
  }

  async deleteMessage(_messageId: string): Promise<SocialMediaResponse<boolean>> {
    return {
      success: false,
      error: 'Reddit does not support deleting messages through this API',
      metadata: { platform: this.platform, timestamp: Date.now() }
    };
  }

  async createStream(keywords: string[], channels?: string[]): Promise<SocialMediaStream> {
    const streamId = `reddit_stream_${Date.now()}`;
    
    const stream: SocialMediaStream = {
      id: streamId,
      platform: this.platform,
      type: 'polling',
      keywords,
      channels: channels || this.config.subreddits || [],
      isActive: true,
      onMessage: () => {},
      onError: () => {}
    };

    this.activeStreams.set(streamId, stream);
    
    logger.info('Reddit stream created', { 
      streamId, 
      keywords, 
      subreddits: stream.channels.length 
    });

    return stream;
  }

  async stopStream(streamId: string): Promise<boolean> {
    const stream = this.activeStreams.get(streamId);
    if (!stream) {
      return false;
    }

    stream.isActive = false;
    this.activeStreams.delete(streamId);
    
    logger.info('Reddit stream stopped', { streamId });
    return true;
  }

  async searchMessages(query: string, options: SearchOptions = {}): Promise<SocialMediaResponse<SocialMediaMessage[]>> {
    try {
      await this.ensureValidToken();

      const params: any = {
        q: query,
        sort: options.sortBy === 'recency' ? 'new' : 'relevance',
        limit: options.limit || 25,
        type: 'link'
      };

      if (options.startTime) {
        params.after = Math.floor(options.startTime.getTime() / 1000);
      }
      if (options.endTime) {
        params.before = Math.floor(options.endTime.getTime() / 1000);
      }

      const response = await this.client.get('/search', { params });
      const listing: RedditListing = response.data;

      const socialMessages = listing.data.children
        .filter(item => item.kind === 't3')
        .map(item => this.convertRedditPostToSocialMessage(item.data as RedditPost));

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

  async getChannelMessages(subreddit: string, options: SearchOptions = {}): Promise<SocialMediaResponse<SocialMediaMessage[]>> {
    try {
      await this.ensureValidToken();

      const params: any = {
        limit: options.limit || 25,
        t: this.config.timeRange
      };

      if (options.sinceId) {
        params.after = `t3_${options.sinceId}`;
      }
      if (options.untilId) {
        params.before = `t3_${options.untilId}`;
      }

      const sortBy = options.sortBy === 'recency' ? 'new' : this.config.sortBy;
      const response = await this.client.get(`/r/${subreddit}/${sortBy}`, { params });
      const listing: RedditListing = response.data;

      const socialMessages = listing.data.children
        .filter(item => item.kind === 't3')
        .map(item => this.convertRedditPostToSocialMessage(item.data as RedditPost));

      return {
        success: true,
        data: socialMessages,
        metadata: {
          platform: this.platform,
          timestamp: Date.now()
        }
      };
    } catch (error) {
      return this.handleError('getChannelMessages', error);
    }
  }

  async getUser(username: string): Promise<SocialMediaResponse<SocialMediaUser>> {
    try {
      await this.ensureValidToken();

      const response = await this.client.get(`/user/${username}/about`);
      const userData: RedditUser = response.data.data;

      const socialUser = this.convertRedditUserToSocialUser(userData);

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

  async followUser(_userId: string): Promise<SocialMediaResponse<boolean>> {
    return {
      success: false,
      error: 'Reddit does not support following users through this API',
      metadata: { platform: this.platform, timestamp: Date.now() }
    };
  }

  async unfollowUser(_userId: string): Promise<SocialMediaResponse<boolean>> {
    return {
      success: false,
      error: 'Reddit does not support unfollowing users through this API',
      metadata: { platform: this.platform, timestamp: Date.now() }
    };
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.ensureValidToken();
      const response = await this.client.get('/api/v1/me');
      return response.status === 200;
    } catch (error) {
      logger.warn('Reddit health check failed:', error);
      return false;
    }
  }

  async getRateLimitStatus(): Promise<RateLimitStatus> {
    return this.rateLimitStatus;
  }

  private convertRedditPostToSocialMessage(post: RedditPost): SocialMediaMessage {
    const metrics: MessageMetrics = {
      likes: post.score,
      replies: post.num_comments,
      shares: 0 // Reddit doesn't expose share counts
    };

    const content = post.is_self ? `${post.title}\n\n${post.selftext}` : post.title;

    return {
      id: post.id,
      platform: this.platform,
      author: {
        id: post.author_fullname || post.author,
        username: post.author,
        displayName: post.author
      },
      content,
      timestamp: new Date(post.created_utc * 1000),
      url: `https://reddit.com${post.permalink}`,
      channel: post.subreddit,
      metrics,
      hashtags: [], // Reddit doesn't have hashtags in the same way
      mentions: [] // Would need to parse from content
    };
  }

  private convertRedditUserToSocialUser(user: RedditUser): SocialMediaUser {
    return {
      id: user.id,
      username: user.name,
      displayName: user.name,
      avatarUrl: user.icon_img || undefined,
      verified: user.verified,
      followerCount: user.subreddit?.subscribers || 0,
      followingCount: 0, // Reddit doesn't expose this
      createdAt: new Date(user.created_utc * 1000),
      metrics: {
        totalTweets: user.link_karma + user.comment_karma
      }
    };
  }

  private handleError(operation: string, error: any): SocialMediaResponse<any> {
    logger.error(`Reddit ${operation} failed:`, error);

    const socialError: SocialMediaError = new Error(
      error?.response?.data?.message || error?.message || 'Unknown Reddit API error'
    ) as SocialMediaError;

    socialError.platform = this.platform;
    socialError.code = error?.response?.data?.error || error?.code;
    socialError.rateLimited = error?.response?.status === 429;
    socialError.retryable = error?.response?.status >= 500 || error?.response?.status === 429;

    if (socialError.rateLimited) {
      socialError.retryAfter = 60; // Reddit rate limits are typically per minute
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
        logger.debug('Reddit API request', {
          method: config.method,
          url: config.url
        });
        return config;
      },
      (error) => {
        logger.error('Reddit API request error:', error);
        return Promise.reject(error);
      }
    );

    // Response interceptor for rate limit tracking
    this.client.interceptors.response.use(
      (response) => {
        // Track rate limits from headers
        const headers = response.headers;
        if (headers['x-ratelimit-remaining'] && headers['x-ratelimit-reset']) {
          this.rateLimitStatus = {
            remaining: parseInt(headers['x-ratelimit-remaining']),
            reset: new Date(parseInt(headers['x-ratelimit-reset']) * 1000),
            limit: parseInt(headers['x-ratelimit-limit'] || '60'),
            resetInSeconds: parseInt(headers['x-ratelimit-reset']) - Math.floor(Date.now() / 1000)
          };
        }

        logger.debug('Reddit API response', {
          status: response.status,
          rateLimitRemaining: headers['x-ratelimit-remaining']
        });
        return response;
      },
      (error) => {
        logger.error('Reddit API response error:', {
          status: error.response?.status,
          message: error.response?.data?.message || error.message
        });
        return Promise.reject(error);
      }
    );
  }
}