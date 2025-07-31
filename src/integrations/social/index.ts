/**
 * Social Media Integration Module
 * Unified exports for social media platform integrations
 */

// Core types
export * from './types';

// Platform clients
export { TwitterClient } from './twitter-client';
export { DiscordClient } from './discord-client';
export { TelegramClient } from './telegram-client';
export { RedditClient } from './reddit-client';

// Main manager
export { SocialMediaManager } from './social-media-manager';

// Utility functions
export const createSocialMediaClient = (config: import('./types').SocialMediaConfig): import('./types').SocialMediaClient => {
  switch (config.platform) {
    case 'twitter':
      const { TwitterClient } = require('./twitter-client');
      return new TwitterClient(config);
    case 'discord':
      const { DiscordClient } = require('./discord-client');
      return new DiscordClient(config);
    case 'telegram':
      const { TelegramClient } = require('./telegram-client');
      return new TelegramClient(config);
    case 'reddit':
      const { RedditClient } = require('./reddit-client');
      return new RedditClient(config);
    default:
      throw new Error(`Unsupported social media platform: ${config.platform}`);
  }
};

export const createSocialMediaManager = (config: import('./types').SocialMediaManagerConfig): import('./social-media-manager').SocialMediaManager => {
  const { SocialMediaManager } = require('./social-media-manager');
  return new SocialMediaManager(config);
};

// Default configurations
export const DEFAULT_TWITTER_CONFIG: Partial<import('./types').TwitterConfig> = {
  platform: 'twitter',
  tweetFields: ['created_at', 'author_id', 'public_metrics', 'entities', 'referenced_tweets'],
  userFields: ['username', 'name', 'description', 'profile_image_url', 'verified', 'public_metrics'],
  expansions: ['author_id', 'referenced_tweets.id'],
  maxResults: 100,
  rateLimitRpm: 300
};

export const DEFAULT_DISCORD_CONFIG: Partial<import('./types').DiscordConfig> = {
  platform: 'discord',
  intents: 512 | 32768, // GUILD_MESSAGES | MESSAGE_CONTENT
  messageCache: true
};

export const DEFAULT_TELEGRAM_CONFIG: Partial<import('./types').TelegramConfig> = {
  platform: 'telegram',
  allowedUpdates: ['message', 'edited_message', 'channel_post', 'edited_channel_post']
};

export const DEFAULT_REDDIT_CONFIG: Partial<import('./types').RedditConfig> = {
  platform: 'reddit',
  sortBy: 'hot',
  timeRange: 'day',
  userAgent: 'YieldSensei/1.0.0'
};

export const DEFAULT_SOCIAL_MANAGER_CONFIG: Partial<import('./types').SocialMediaManagerConfig> = {
  enableAggregation: true,
  sentimentAnalysis: {
    enabled: true,
    threshold: 0.6
  },
  realTimeProcessing: {
    enabled: true,
    batchSize: 100,
    processingInterval: 30000
  },
  storage: {
    enabled: true,
    retentionDays: 7,
    indexMessages: true
  },
  alerts: {
    enabled: true,
    sentimentThreshold: 0.8,
    volumeThreshold: 100
  }
};