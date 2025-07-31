/**
 * Discord Bot Client
 * Provides integration with Discord API for server monitoring and message analysis
 */

import { EventEmitter } from 'events';
import axios, { AxiosInstance } from 'axios';
import WebSocket from 'ws';
import Logger from '@/shared/logging/logger';
import {
  SocialMediaClient,
  DiscordConfig,
  SocialMediaResponse,
  SocialMediaMessage,
  SocialMediaStream,
  SocialMediaUser,
  SearchOptions,
  RateLimitStatus,
  MessageMetrics,
  SocialMediaError
} from './types';

const logger = Logger.getLogger('discord-client');

interface DiscordMessage {
  id: string;
  channel_id: string;
  guild_id?: string;
  author: DiscordUser;
  content: string;
  timestamp: string;
  edited_timestamp?: string;
  tts: boolean;
  mention_everyone: boolean;
  mentions: DiscordUser[];
  mention_roles: string[];
  attachments: DiscordAttachment[];
  embeds: DiscordEmbed[];
  reactions?: DiscordReaction[];
  nonce?: string;
  pinned: boolean;
  webhook_id?: string;
  type: number;
  message_reference?: {
    message_id?: string;
    channel_id?: string;
    guild_id?: string;
  };
}

interface DiscordUser {
  id: string;
  username: string;
  discriminator: string;
  avatar?: string;
  bot?: boolean;
  system?: boolean;
  mfa_enabled?: boolean;
  verified?: boolean;
  email?: string;
  flags?: number;
  premium_type?: number;
  public_flags?: number;
}

interface DiscordAttachment {
  id: string;
  filename: string;
  size: number;
  url: string;
  proxy_url: string;
  height?: number;
  width?: number;
  content_type?: string;
}

interface DiscordEmbed {
  title?: string;
  type?: string;
  description?: string;
  url?: string;
  timestamp?: string;
  color?: number;
  footer?: {
    text: string;
    icon_url?: string;
  };
  image?: {
    url: string;
    height?: number;
    width?: number;
  };
  thumbnail?: {
    url: string;
    height?: number;
    width?: number;
  };
  author?: {
    name: string;
    url?: string;
    icon_url?: string;
  };
  fields?: Array<{
    name: string;
    value: string;
    inline?: boolean;
  }>;
}

interface DiscordReaction {
  count: number;
  me: boolean;
  emoji: {
    id?: string;
    name: string;
    animated?: boolean;
  };
}

interface DiscordGatewayPayload {
  op: number;
  d?: any;
  s?: number;
  t?: string;
}

export class DiscordClient extends EventEmitter implements SocialMediaClient {
  public readonly platform = 'discord' as const;
  public readonly config: DiscordConfig;
  
  private client: AxiosInstance;
  private gateway?: WebSocket;
  private heartbeatInterval?: NodeJS.Timeout;
  private sequenceNumber?: number;
  private sessionId?: string;
  private activeStreams: Map<string, SocialMediaStream> = new Map();
  private rateLimitBuckets: Map<string, RateLimitStatus> = new Map();
  private isConnected = false;
  private shouldReconnect = true;

  constructor(config: DiscordConfig) {
    super();
    this.config = {
      intents: 512 | 32768, // GUILD_MESSAGES | MESSAGE_CONTENT
      messageCache: true,
      ...config
    };

    this.client = axios.create({
      baseURL: 'https://discord.com/api/v10',
      timeout: 30000,
      headers: {
        'Authorization': `Bot ${this.config.botToken}`,
        'Content-Type': 'application/json',
        'User-Agent': 'YieldSensei/1.0.0'
      }
    });

    this.setupInterceptors();
  }

  async initialize(): Promise<void> {
    try {
      logger.info('Initializing Discord client...');
      
      // Test authentication
      const authResult = await this.authenticate();
      if (!authResult) {
        throw new Error('Discord authentication failed');
      }

      // Connect to gateway
      await this.connectToGateway();

      logger.info('Discord client initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Discord client:', error);
      throw error;
    }
  }

  async authenticate(): Promise<boolean> {
    try {
      const response = await this.client.get('/users/@me');
      
      if (response.status === 200) {
        logger.info('Discord authentication successful', { 
          botId: response.data.id,
          username: response.data.username 
        });
        return true;
      }
      
      return false;
    } catch (error) {
      logger.error('Discord authentication failed:', error);
      return false;
    }
  }

  private async connectToGateway(): Promise<void> {
    try {
      // Get gateway URL
      const gatewayResponse = await this.client.get('/gateway/bot');
      const gatewayUrl = gatewayResponse.data.url;

      this.gateway = new WebSocket(`${gatewayUrl}?v=10&encoding=json`);

      this.gateway.on('open', () => {
        logger.info('Discord gateway connection opened');
        this.isConnected = true;
      });

      this.gateway.on('message', (data: Buffer) => {
        this.handleGatewayMessage(JSON.parse(data.toString()));
      });

      this.gateway.on('close', (code: number, reason: string) => {
        logger.warn('Discord gateway connection closed', { code, reason });
        this.isConnected = false;
        this.cleanup();
        
        if (this.shouldReconnect) {
          setTimeout(() => this.connectToGateway(), 5000);
        }
      });

      this.gateway.on('error', (error: Error) => {
        logger.error('Discord gateway error:', error);
        this.isConnected = false;
      });

    } catch (error) {
      logger.error('Failed to connect to Discord gateway:', error);
      throw error;
    }
  }

  private handleGatewayMessage(payload: DiscordGatewayPayload): void {
    const { op, d, s, t } = payload;

    if (s) {
      this.sequenceNumber = s;
    }

    switch (op) {
      case 10: // Hello
        this.startHeartbeat(d.heartbeat_interval);
        this.identify();
        break;

      case 0: // Dispatch
        this.handleDispatchEvent(t!, d);
        break;

      case 1: // Heartbeat request
        this.sendHeartbeat();
        break;

      case 7: // Reconnect
        logger.info('Discord gateway requesting reconnect');
        this.gateway?.close();
        break;

      case 9: // Invalid session
        logger.warn('Discord invalid session, reconnecting...');
        this.sessionId = undefined;
        this.sequenceNumber = undefined;
        setTimeout(() => this.identify(), Math.random() * 5000);
        break;

      case 11: // Heartbeat ACK
        logger.debug('Discord heartbeat acknowledged');
        break;
    }
  }

  private handleDispatchEvent(eventType: string, data: any): void {
    switch (eventType) {
      case 'READY':
        this.sessionId = data.session_id;
        logger.info('Discord bot ready', { sessionId: this.sessionId });
        break;

      case 'MESSAGE_CREATE':
        this.handleMessageCreate(data);
        break;

      case 'MESSAGE_UPDATE':
        this.handleMessageUpdate(data);
        break;

      case 'MESSAGE_DELETE':
        this.handleMessageDelete(data);
        break;
    }
  }

  private handleMessageCreate(discordMessage: DiscordMessage): void {
    // Skip bot messages unless configured otherwise
    if (discordMessage.author.bot && !this.config.messageCache) {
      return;
    }

    // Check if message is from monitored channels
    const monitoredChannels = this.config.channelIds || [];
    if (monitoredChannels.length > 0 && !monitoredChannels.includes(discordMessage.channel_id)) {
      return;
    }

    const socialMessage = this.convertDiscordMessageToSocialMessage(discordMessage);
    
    // Emit to active streams
    for (const stream of this.activeStreams.values()) {
      if (this.messageMatchesStreamKeywords(socialMessage.content, stream.keywords)) {
        stream.onMessage(socialMessage);
      }
    }

    this.emit('message', socialMessage);
  }

  private handleMessageUpdate(discordMessage: DiscordMessage): void {
    logger.debug('Discord message updated', { messageId: discordMessage.id });
  }

  private handleMessageDelete(data: { id: string; channel_id: string; guild_id?: string }): void {
    logger.debug('Discord message deleted', { messageId: data.id });
  }

  private messageMatchesStreamKeywords(content: string, keywords: string[]): boolean {
    const lowerContent = content.toLowerCase();
    return keywords.some(keyword => lowerContent.includes(keyword.toLowerCase()));
  }

  private startHeartbeat(interval: number): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    this.heartbeatInterval = setInterval(() => {
      this.sendHeartbeat();
    }, interval);
  }

  private sendHeartbeat(): void {
    if (this.gateway?.readyState === WebSocket.OPEN) {
      this.gateway.send(JSON.stringify({
        op: 1,
        d: this.sequenceNumber
      }));
    }
  }

  private identify(): void {
    if (this.gateway?.readyState === WebSocket.OPEN) {
      this.gateway.send(JSON.stringify({
        op: 2,
        d: {
          token: this.config.botToken,
          intents: this.config.intents,
          properties: {
            $os: 'linux',
            $browser: 'YieldSensei',
            $device: 'YieldSensei'
          }
        }
      }));
    }
  }

  private cleanup(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = undefined;
    }
  }

  async disconnect(): Promise<void> {
    try {
      logger.info('Disconnecting Discord client...');
      
      this.shouldReconnect = false;
      this.cleanup();
      
      if (this.gateway) {
        this.gateway.close();
        this.gateway = undefined;
      }

      this.isConnected = false;
      this.activeStreams.clear();
      
      logger.info('Discord client disconnected');
    } catch (error) {
      logger.error('Error disconnecting Discord client:', error);
      throw error;
    }
  }

  async sendMessage(content: string, channelId?: string): Promise<SocialMediaResponse<string>> {
    if (!channelId) {
      return {
        success: false,
        error: 'Channel ID is required for Discord messages',
        metadata: { platform: this.platform, timestamp: Date.now() }
      };
    }

    try {
      const response = await this.client.post(`/channels/${channelId}/messages`, {
        content
      });

      return {
        success: true,
        data: response.data.id,
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
    // Discord requires channel ID to get a message, this is a limitation
    return {
      success: false,
      error: 'Discord requires channel ID to retrieve messages',
      metadata: { platform: this.platform, timestamp: Date.now() }
    };
  }

  async deleteMessage(messageId: string): Promise<SocialMediaResponse<boolean>> {
    // Discord requires channel ID to delete a message, this is a limitation
    return {
      success: false,
      error: 'Discord requires channel ID to delete messages',
      metadata: { platform: this.platform, timestamp: Date.now() }
    };
  }

  async createStream(keywords: string[], channels?: string[]): Promise<SocialMediaStream> {
    const streamId = `discord_stream_${Date.now()}`;
    
    const stream: SocialMediaStream = {
      id: streamId,
      platform: this.platform,
      type: 'real-time',
      keywords,
      channels: channels || [],
      isActive: true,
      onMessage: () => {},
      onError: () => {}
    };

    this.activeStreams.set(streamId, stream);
    
    logger.info('Discord stream created', { 
      streamId, 
      keywords, 
      channels: channels?.length || 0 
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
    
    logger.info('Discord stream stopped', { streamId });
    return true;
  }

  async searchMessages(_query: string, _options: SearchOptions = {}): Promise<SocialMediaResponse<SocialMediaMessage[]>> {
    return {
      success: false,
      error: 'Discord does not support message search through bot API',
      metadata: { platform: this.platform, timestamp: Date.now() }
    };
  }

  async getChannelMessages(channelId: string, options: SearchOptions = {}): Promise<SocialMediaResponse<SocialMediaMessage[]>> {
    try {
      const params: any = {
        limit: Math.min(options.limit || 50, 100)
      };

      if (options.sinceId) {
        params.after = options.sinceId;
      }
      if (options.untilId) {
        params.before = options.untilId;
      }

      const response = await this.client.get(`/channels/${channelId}/messages`, { params });
      const messages = response.data || [];

      const socialMessages = messages.map((msg: DiscordMessage) =>
        this.convertDiscordMessageToSocialMessage(msg)
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
      return this.handleError('getChannelMessages', error);
    }
  }

  async getUser(userId: string): Promise<SocialMediaResponse<SocialMediaUser>> {
    try {
      const response = await this.client.get(`/users/${userId}`);
      const user = response.data;

      const socialUser = this.convertDiscordUserToSocialUser(user);

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
      error: 'Discord does not support following users',
      metadata: { platform: this.platform, timestamp: Date.now() }
    };
  }

  async unfollowUser(_userId: string): Promise<SocialMediaResponse<boolean>> {
    return {
      success: false,
      error: 'Discord does not support unfollowing users',
      metadata: { platform: this.platform, timestamp: Date.now() }
    };
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.client.get('/users/@me');
      return response.status === 200 && this.isConnected;
    } catch (error) {
      logger.warn('Discord health check failed:', error);
      return false;
    }
  }

  async getRateLimitStatus(): Promise<RateLimitStatus> {
    const defaultStatus: RateLimitStatus = {
      remaining: 50,
      reset: new Date(Date.now() + 60 * 1000), // 1 minute from now
      limit: 50,
      resetInSeconds: 60
    };

    return this.rateLimitBuckets.get('default') || defaultStatus;
  }

  private convertDiscordMessageToSocialMessage(discordMessage: DiscordMessage): SocialMediaMessage {
    const metrics: MessageMetrics = {};
    
    if (discordMessage.reactions) {
      const reactions: Record<string, number> = {};
      discordMessage.reactions.forEach(reaction => {
        reactions[reaction.emoji.name] = reaction.count;
      });
      metrics.reactions = reactions;
    }

    return {
      id: discordMessage.id,
      platform: this.platform,
      author: {
        id: discordMessage.author.id,
        username: discordMessage.author.username,
        displayName: `${discordMessage.author.username}#${discordMessage.author.discriminator}` 
      },
      content: discordMessage.content,
      timestamp: new Date(discordMessage.timestamp),
      channel: discordMessage.channel_id,
      mentions: discordMessage.mentions.map(u => u.username),
      metrics,
      attachments: discordMessage.attachments.map(att => ({
        type: this.getAttachmentType(att.content_type),
        url: att.url,
        title: att.filename
      })),
      parentMessageId: discordMessage.message_reference?.message_id,
      isReply: !!discordMessage.message_reference
    };
  }

  private convertDiscordUserToSocialUser(user: DiscordUser): SocialMediaUser {
    return {
      id: user.id,
      username: user.username,
      displayName: `${user.username}#${user.discriminator}`,
      avatarUrl: user.avatar ? 
        `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png` : 
        undefined,
      verified: user.verified || false,
      followerCount: 0, // Discord doesn't expose follower counts
      followingCount: 0,
      createdAt: new Date(parseInt(user.id) / 4194304 + 1420070400000) // Discord snowflake timestamp
    };
  }

  private getAttachmentType(contentType?: string): 'image' | 'video' | 'audio' | 'document' | 'link' {
    if (!contentType) return 'document';
    
    if (contentType.startsWith('image/')) return 'image';
    if (contentType.startsWith('video/')) return 'video';
    if (contentType.startsWith('audio/')) return 'audio';
    return 'document';
  }

  private handleError(operation: string, error: any): SocialMediaResponse<any> {
    logger.error(`Discord ${operation} failed:`, error);

    const socialError: SocialMediaError = new Error(
      error?.response?.data?.message || error?.message || 'Unknown Discord API error'
    ) as SocialMediaError;

    socialError.platform = this.platform;
    socialError.code = error?.response?.data?.code?.toString() || error?.code;
    socialError.rateLimited = error?.response?.status === 429;
    socialError.retryable = error?.response?.status >= 500 || error?.response?.status === 429;

    if (socialError.rateLimited && error?.response?.headers) {
      const retryAfter = error.response.headers['retry-after'];
      socialError.retryAfter = retryAfter ? parseFloat(retryAfter) : 60;
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
        logger.debug('Discord API request', {
          method: config.method,
          url: config.url
        });
        return config;
      },
      (error) => {
        logger.error('Discord API request error:', error);
        return Promise.reject(error);
      }
    );

    // Response interceptor for rate limit tracking
    this.client.interceptors.response.use(
      (response) => {
        // Track rate limits
        const headers = response.headers;
        if (headers['x-ratelimit-remaining'] && headers['x-ratelimit-reset']) {
          const bucket = headers['x-ratelimit-bucket'] || 'default';
          const rateLimitStatus: RateLimitStatus = {
            remaining: parseInt(headers['x-ratelimit-remaining']),
            reset: new Date(parseFloat(headers['x-ratelimit-reset']) * 1000),
            limit: parseInt(headers['x-ratelimit-limit'] || '50'),
            resetInSeconds: Math.ceil(parseFloat(headers['x-ratelimit-reset']) - Date.now() / 1000)
          };
          this.rateLimitBuckets.set(bucket, rateLimitStatus);
        }

        logger.debug('Discord API response', {
          status: response.status,
          rateLimitRemaining: headers['x-ratelimit-remaining']
        });
        return response;
      },
      (error) => {
        logger.error('Discord API response error:', {
          status: error.response?.status,
          message: error.response?.data?.message || error.message
        });
        return Promise.reject(error);
      }
    );
  }
}