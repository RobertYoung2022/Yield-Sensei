/**
 * Social Media Integration Types
 * Common interfaces and types for social media platform integrations
 */

export type SocialPlatform = 'twitter' | 'discord' | 'telegram' | 'reddit';

export interface SocialMediaConfig {
  platform: SocialPlatform;
  apiKey?: string;
  apiSecret?: string;
  accessToken?: string;
  accessTokenSecret?: string;
  bearerToken?: string;
  botToken?: string;
  clientId?: string;
  clientSecret?: string;
  webhookUrl?: string;
  rateLimitRpm?: number;
  enableRealTime?: boolean;
  monitoredChannels?: string[];
  monitoredKeywords?: string[];
  sentimentAnalysis?: boolean;
}

export interface SocialMediaResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  metadata?: {
    platform?: string;
    timestamp?: number;
    rateLimitRemaining?: number;
    rateLimitReset?: number;
  };
}

export interface SocialMediaMessage {
  id: string;
  platform: SocialPlatform;
  author: {
    id: string;
    username: string;
    displayName?: string;
    verified?: boolean;
    followerCount?: number;
  };
  content: string;
  timestamp: Date;
  url?: string;
  channel?: string;
  hashtags?: string[];
  mentions?: string[];
  metrics?: MessageMetrics;
  sentiment?: SentimentScore;
  attachments?: MessageAttachment[];
  parentMessageId?: string;
  isReply?: boolean;
  isRetweet?: boolean;
  originalMessageId?: string;
}

export interface MessageMetrics {
  likes?: number;
  retweets?: number;
  replies?: number;
  shares?: number;
  views?: number;
  reactions?: Record<string, number>;
}

export interface SentimentScore {
  score: number; // -1 to 1, where -1 is very negative, 1 is very positive
  confidence: number; // 0 to 1
  label: 'positive' | 'negative' | 'neutral';
  keywords?: string[];
}

export interface MessageAttachment {
  type: 'image' | 'video' | 'audio' | 'document' | 'link';
  url: string;
  title?: string;
  description?: string;
  thumbnail?: string;
}

export interface SocialMediaStream {
  id: string;
  platform: SocialPlatform;
  type: 'real-time' | 'webhook' | 'polling';
  keywords: string[];
  channels: string[];
  languages?: string[];
  isActive: boolean;
  onMessage: (message: SocialMediaMessage) => void;
  onError: (error: Error) => void;
}

export interface TwitterConfig extends SocialMediaConfig {
  platform: 'twitter';
  bearerToken: string;
  apiKey?: string;
  apiSecret?: string;
  accessToken?: string;
  accessTokenSecret?: string;
  tweetFields?: string[];
  userFields?: string[];
  expansions?: string[];
  maxResults?: number;
}

export interface DiscordConfig extends SocialMediaConfig {
  platform: 'discord';
  botToken: string;
  guildIds?: string[];
  channelIds?: string[];
  intents?: number;
  messageCache?: boolean;
}

export interface TelegramConfig extends SocialMediaConfig {
  platform: 'telegram';
  botToken: string;
  chatIds?: string[];
  allowedUpdates?: string[];
  webhook?: {
    url: string;
    maxConnections?: number;
    allowedUpdates?: string[];
  };
}

export interface RedditConfig extends SocialMediaConfig {
  platform: 'reddit';
  clientId: string;
  clientSecret: string;
  userAgent: string;
  subreddits?: string[];
  sortBy?: 'hot' | 'new' | 'rising' | 'top';
  timeRange?: 'hour' | 'day' | 'week' | 'month' | 'year' | 'all';
}

export interface SocialMediaClient {
  readonly platform: SocialPlatform;
  readonly config: SocialMediaConfig;

  // Core operations
  initialize(): Promise<void>;
  authenticate(): Promise<boolean>;
  disconnect(): Promise<void>;
  
  // Message operations
  sendMessage(content: string, channelId?: string): Promise<SocialMediaResponse<string>>;
  getMessage(messageId: string): Promise<SocialMediaResponse<SocialMediaMessage>>;
  deleteMessage(messageId: string): Promise<SocialMediaResponse<boolean>>;
  
  // Stream operations
  createStream(keywords: string[], channels?: string[]): Promise<SocialMediaStream>;
  stopStream(streamId: string): Promise<boolean>;
  
  // Search operations
  searchMessages(query: string, options?: SearchOptions): Promise<SocialMediaResponse<SocialMediaMessage[]>>;
  getChannelMessages(channelId: string, options?: SearchOptions): Promise<SocialMediaResponse<SocialMediaMessage[]>>;
  
  // User operations
  getUser(userId: string): Promise<SocialMediaResponse<SocialMediaUser>>;
  followUser(userId: string): Promise<SocialMediaResponse<boolean>>;
  unfollowUser(userId: string): Promise<SocialMediaResponse<boolean>>;
  
  // Health check
  healthCheck(): Promise<boolean>;
  getRateLimitStatus(): Promise<RateLimitStatus>;
}

export interface SearchOptions {
  limit?: number;
  sinceId?: string;
  untilId?: string;
  startTime?: Date;
  endTime?: Date;
  sortBy?: 'relevance' | 'recency';
  includeReplies?: boolean;
  includeRetweets?: boolean;
  language?: string;
}

export interface SocialMediaUser {
  id: string;
  username: string;
  displayName: string;
  description?: string;
  avatarUrl?: string;
  verified: boolean;
  followerCount: number;
  followingCount: number;
  createdAt: Date;
  location?: string;
  website?: string;
  metrics?: UserMetrics;
}

export interface UserMetrics {
  totalTweets?: number;
  totalMessages?: number;
  engagementRate?: number;
  averageSentiment?: number;
  topHashtags?: string[];
  mostMentioned?: string[];
}

export interface RateLimitStatus {
  remaining: number;
  reset: Date;
  limit: number;
  resetInSeconds: number;
}

export interface SocialMediaManagerConfig {
  platforms: SocialMediaConfig[];
  enableAggregation: boolean;
  sentimentAnalysis: {
    enabled: boolean;
    provider?: 'local' | 'aws' | 'google' | 'azure';
    threshold?: number;
  };
  realTimeProcessing: {
    enabled: boolean;
    batchSize?: number;
    processingInterval?: number;
  };
  storage: {
    enabled: boolean;
    retentionDays?: number;
    indexMessages?: boolean;
  };
  alerts: {
    enabled: boolean;
    sentimentThreshold?: number;
    volumeThreshold?: number;
    keywordAlerts?: string[];
  };
}

export interface AggregatedSocialData {
  totalMessages: number;
  platformBreakdown: Record<SocialPlatform, number>;
  sentimentSummary: {
    positive: number;
    negative: number;
    neutral: number;
    averageScore: number;
  };
  topKeywords: Array<{ keyword: string; count: number; sentiment: number }>;
  topHashtags: Array<{ hashtag: string; count: number; platforms: SocialPlatform[] }>;
  influentialUsers: Array<{
    user: SocialMediaUser;
    platform: SocialPlatform;
    influence: number;
    sentiment: number;
  }>;
  timeRange: {
    start: Date;
    end: Date;
  };
  metadata: {
    generatedAt: Date;
    dataPoints: number;
    coverage: Record<SocialPlatform, { messages: number; coverage: number }>;
  };
}

export interface SocialMediaEvent {
  type: 'message' | 'user_action' | 'trend' | 'alert';
  platform: SocialPlatform;
  timestamp: Date;
  data: any;
  metadata?: Record<string, any>;
}

export interface TrendingTopic {
  topic: string;
  hashtag?: string;
  volume: number;
  platforms: SocialPlatform[];
  sentiment: SentimentScore;
  timeRange: {
    start: Date;
    end: Date;
  };
  relatedTopics: string[];
  influencers: Array<{
    user: SocialMediaUser;
    platform: SocialPlatform;
    contribution: number;
  }>;
}

export interface WebhookPayload {
  platform: SocialPlatform;
  event: string;
  data: any;
  timestamp: Date;
  signature?: string;
}

export interface SocialMediaError extends Error {
  platform?: SocialPlatform;
  code?: string;
  rateLimited?: boolean;
  retryAfter?: number;
  retryable?: boolean;
}