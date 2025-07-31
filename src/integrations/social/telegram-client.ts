/**
 * Telegram Bot Client
 * Provides integration with Telegram Bot API for channel monitoring and message analysis
 */

import { EventEmitter } from 'events';
import axios, { AxiosInstance } from 'axios';
import Logger from '@/shared/logging/logger';
import {
  SocialMediaClient,
  TelegramConfig,
  SocialMediaResponse,
  SocialMediaMessage,
  SocialMediaStream,
  SocialMediaUser,
  SearchOptions,
  RateLimitStatus,
  MessageMetrics,
  SocialMediaError
} from './types';

const logger = Logger.getLogger('telegram-client');

interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  edited_message?: TelegramMessage;
  channel_post?: TelegramMessage;
  edited_channel_post?: TelegramMessage;
  inline_query?: TelegramInlineQuery;
  chosen_inline_result?: TelegramChosenInlineResult;
  callback_query?: TelegramCallbackQuery;
}

interface TelegramMessage {
  message_id: number;
  from?: TelegramUser;
  sender_chat?: TelegramChat;
  date: number;
  chat: TelegramChat;
  forward_from?: TelegramUser;
  forward_from_chat?: TelegramChat;
  forward_from_message_id?: number;
  forward_signature?: string;
  forward_sender_name?: string;
  forward_date?: number;
  reply_to_message?: TelegramMessage;
  via_bot?: TelegramUser;
  edit_date?: number;
  media_group_id?: string;
  author_signature?: string;
  text?: string;
  entities?: TelegramMessageEntity[];
  animation?: TelegramAnimation;
  audio?: TelegramAudio;
  document?: TelegramDocument;
  photo?: TelegramPhotoSize[];
  sticker?: TelegramSticker;
  video?: TelegramVideo;
  video_note?: TelegramVideoNote;
  voice?: TelegramVoice;
  caption?: string;
  caption_entities?: TelegramMessageEntity[];
  contact?: TelegramContact;
  dice?: TelegramDice;
  game?: TelegramGame;
  poll?: TelegramPoll;
  venue?: TelegramVenue;
  location?: TelegramLocation;
  new_chat_members?: TelegramUser[];
  left_chat_member?: TelegramUser;
  new_chat_title?: string;
  new_chat_photo?: TelegramPhotoSize[];
  delete_chat_photo?: boolean;
  group_chat_created?: boolean;
  supergroup_chat_created?: boolean;
  channel_chat_created?: boolean;
  migrate_to_chat_id?: number;
  migrate_from_chat_id?: number;
  pinned_message?: TelegramMessage;
  invoice?: TelegramInvoice;
  successful_payment?: TelegramSuccessfulPayment;
  connected_website?: string;
  passport_data?: TelegramPassportData;
  proximity_alert_triggered?: TelegramProximityAlertTriggered;
  voice_chat_scheduled?: TelegramVoiceChatScheduled;
  voice_chat_started?: TelegramVoiceChatStarted;
  voice_chat_ended?: TelegramVoiceChatEnded;
  voice_chat_participants_invited?: TelegramVoiceChatParticipantsInvited;
  reply_markup?: TelegramInlineKeyboardMarkup;
}

interface TelegramUser {
  id: number;
  is_bot: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  can_join_groups?: boolean;
  can_read_all_group_messages?: boolean;
  supports_inline_queries?: boolean;
}

interface TelegramChat {
  id: number;
  type: 'private' | 'group' | 'supergroup' | 'channel';
  title?: string;
  username?: string;
  first_name?: string;
  last_name?: string;
  photo?: TelegramChatPhoto;
  bio?: string;
  description?: string;
  invite_link?: string;
  pinned_message?: TelegramMessage;
  permissions?: TelegramChatPermissions;
  slow_mode_delay?: number;
  message_auto_delete_time?: number;
  sticker_set_name?: string;
  can_set_sticker_set?: boolean;
  linked_chat_id?: number;
  location?: TelegramChatLocation;
}

interface TelegramMessageEntity {
  type: 'mention' | 'hashtag' | 'cashtag' | 'bot_command' | 'url' | 'email' | 'phone_number' | 'bold' | 'italic' | 'underline' | 'strikethrough' | 'code' | 'pre' | 'text_link' | 'text_mention';
  offset: number;
  length: number;
  url?: string;
  user?: TelegramUser;
  language?: string;
}

interface TelegramPhotoSize {
  file_id: string;
  file_unique_id: string;
  width: number;
  height: number;
  file_size?: number;
}

// Simplified interfaces for other Telegram types
interface TelegramAnimation { file_id: string; file_unique_id: string; width: number; height: number; duration: number; }
interface TelegramAudio { file_id: string; file_unique_id: string; duration: number; }
interface TelegramDocument { file_id: string; file_unique_id: string; file_name?: string; mime_type?: string; }
interface TelegramSticker { file_id: string; file_unique_id: string; width: number; height: number; is_animated: boolean; }
interface TelegramVideo { file_id: string; file_unique_id: string; width: number; height: number; duration: number; }
interface TelegramVideoNote { file_id: string; file_unique_id: string; length: number; duration: number; }
interface TelegramVoice { file_id: string; file_unique_id: string; duration: number; }
interface TelegramContact { phone_number: string; first_name: string; }
interface TelegramDice { emoji: string; value: number; }
interface TelegramGame { title: string; description: string; }
interface TelegramPoll { id: string; question: string; options: Array<{ text: string; voter_count: number }>; }
interface TelegramVenue { location: TelegramLocation; title: string; address: string; }
interface TelegramLocation { longitude: number; latitude: number; }
interface TelegramInvoice { title: string; description: string; start_parameter: string; currency: string; total_amount: number; }
interface TelegramSuccessfulPayment { currency: string; total_amount: number; }
interface TelegramPassportData { data: any[]; credentials: any; }
interface TelegramProximityAlertTriggered { traveler: TelegramUser; watcher: TelegramUser; distance: number; }
interface TelegramVoiceChatScheduled { start_date: number; }
interface TelegramVoiceChatStarted { }
interface TelegramVoiceChatEnded { duration: number; }
interface TelegramVoiceChatParticipantsInvited { users: TelegramUser[]; }
interface TelegramInlineKeyboardMarkup { inline_keyboard: any[][]; }
interface TelegramChatPhoto { small_file_id: string; big_file_id: string; }
interface TelegramChatPermissions { can_send_messages?: boolean; can_send_media_messages?: boolean; }
interface TelegramChatLocation { location: TelegramLocation; address: string; }
interface TelegramInlineQuery { id: string; from: TelegramUser; query: string; offset: string; }
interface TelegramChosenInlineResult { result_id: string; from: TelegramUser; query: string; }
interface TelegramCallbackQuery { id: string; from: TelegramUser; message?: TelegramMessage; data?: string; }

export class TelegramClient extends EventEmitter implements SocialMediaClient {
  public readonly platform = 'telegram' as const;
  public readonly config: TelegramConfig;
  
  private client: AxiosInstance;
  private pollingInterval?: NodeJS.Timeout;
  private lastUpdateId = 0;
  private activeStreams: Map<string, SocialMediaStream> = new Map();
  private rateLimitStatus: RateLimitStatus;
  private isPolling = false;

  constructor(config: TelegramConfig) {
    super();
    this.config = {
      allowedUpdates: ['message', 'edited_message', 'channel_post', 'edited_channel_post'],
      ...config
    };

    this.client = axios.create({
      baseURL: `https://api.telegram.org/bot${this.config.botToken}`,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    this.rateLimitStatus = {
      remaining: 30,
      reset: new Date(Date.now() + 60 * 1000),
      limit: 30,
      resetInSeconds: 60
    };

    this.setupInterceptors();
  }

  async initialize(): Promise<void> {
    try {
      logger.info('Initializing Telegram client...');
      
      // Test authentication
      const authResult = await this.authenticate();
      if (!authResult) {
        throw new Error('Telegram authentication failed');
      }

      // Set webhook or start polling
      if (this.config.webhook?.url) {
        await this.setWebhook();
      } else {
        await this.startPolling();
      }

      logger.info('Telegram client initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Telegram client:', error);
      throw error;
    }
  }

  async authenticate(): Promise<boolean> {
    try {
      const response = await this.client.get('/getMe');
      
      if (response.data.ok) {
        logger.info('Telegram authentication successful', { 
          botId: response.data.result.id,
          username: response.data.result.username 
        });
        return true;
      }
      
      return false;
    } catch (error) {
      logger.error('Telegram authentication failed:', error);
      return false;
    }
  }

  private async setWebhook(): Promise<void> {
    try {
      const response = await this.client.post('/setWebhook', {
        url: this.config.webhook!.url,
        max_connections: this.config.webhook!.maxConnections || 40,
        allowed_updates: this.config.webhook!.allowedUpdates || this.config.allowedUpdates
      });

      if (response.data.ok) {
        logger.info('Telegram webhook set successfully', { url: this.config.webhook!.url });
      } else {
        throw new Error(`Failed to set webhook: ${response.data.description}`);
      }
    } catch (error) {
      logger.error('Failed to set Telegram webhook:', error);
      throw error;
    }
  }

  private async startPolling(): Promise<void> {
    if (this.isPolling) {
      return;
    }

    this.isPolling = true;
    logger.info('Starting Telegram polling...');

    const poll = async () => {
      try {
        const response = await this.client.post('/getUpdates', {
          offset: this.lastUpdateId + 1,
          limit: 100,
          timeout: 30,
          allowed_updates: this.config.allowedUpdates
        });

        if (response.data.ok && response.data.result.length > 0) {
          const updates: TelegramUpdate[] = response.data.result;
          
          for (const update of updates) {
            this.handleUpdate(update);
            this.lastUpdateId = Math.max(this.lastUpdateId, update.update_id);
          }
        }
      } catch (error) {
        logger.error('Telegram polling error:', error);
        // Continue polling even on errors
      }

      if (this.isPolling) {
        this.pollingInterval = setTimeout(poll, 1000);
      }
    };

    poll();
  }

  private handleUpdate(update: TelegramUpdate): void {
    const message = update.message || update.edited_message || update.channel_post || update.edited_channel_post;
    
    if (message) {
      this.handleMessage(message);
    }

    if (update.inline_query) {
      this.handleInlineQuery(update.inline_query);
    }

    if (update.callback_query) {
      this.handleCallbackQuery(update.callback_query);
    }
  }

  private handleMessage(telegramMessage: TelegramMessage): void {
    // Check if message is from monitored chats
    const monitoredChats = this.config.chatIds || [];
    if (monitoredChats.length > 0 && !monitoredChats.includes(telegramMessage.chat.id.toString())) {
      return;
    }

    const socialMessage = this.convertTelegramMessageToSocialMessage(telegramMessage);
    
    // Emit to active streams
    for (const stream of this.activeStreams.values()) {
      if (this.messageMatchesStreamKeywords(socialMessage.content, stream.keywords)) {
        stream.onMessage(socialMessage);
      }
    }

    this.emit('message', socialMessage);
  }

  private handleInlineQuery(inlineQuery: TelegramInlineQuery): void {
    logger.debug('Telegram inline query received', { queryId: inlineQuery.id, query: inlineQuery.query });
  }

  private handleCallbackQuery(callbackQuery: TelegramCallbackQuery): void {
    logger.debug('Telegram callback query received', { queryId: callbackQuery.id, data: callbackQuery.data });
  }

  private messageMatchesStreamKeywords(content: string, keywords: string[]): boolean {
    const lowerContent = content.toLowerCase();
    return keywords.some(keyword => lowerContent.includes(keyword.toLowerCase()));
  }

  async disconnect(): Promise<void> {
    try {
      logger.info('Disconnecting Telegram client...');
      
      this.isPolling = false;
      
      if (this.pollingInterval) {
        clearTimeout(this.pollingInterval);
        this.pollingInterval = undefined;
      }

      // Remove webhook if set
      if (this.config.webhook?.url) {
        await this.client.post('/deleteWebhook');
      }

      this.activeStreams.clear();
      
      logger.info('Telegram client disconnected');
    } catch (error) {
      logger.error('Error disconnecting Telegram client:', error);
      throw error;
    }
  }

  async sendMessage(content: string, channelId?: string): Promise<SocialMediaResponse<string>> {
    if (!channelId) {
      return {
        success: false,
        error: 'Chat ID is required for Telegram messages',
        metadata: { platform: this.platform, timestamp: Date.now() }
      };
    }

    try {
      const response = await this.client.post('/sendMessage', {
        chat_id: channelId,
        text: content,
        parse_mode: 'HTML'
      });

      if (response.data.ok) {
        return {
          success: true,
          data: response.data.result.message_id.toString(),
          metadata: {
            platform: this.platform,
            timestamp: Date.now()
          }
        };
      } else {
        throw new Error(response.data.description);
      }
    } catch (error) {
      return this.handleError('sendMessage', error);
    }
  }

  async getMessage(messageId: string): Promise<SocialMediaResponse<SocialMediaMessage>> {
    // Telegram doesn't provide a direct way to get a message by ID without knowing the chat
    return {
      success: false,
      error: 'Telegram requires chat ID to retrieve messages',
      metadata: { platform: this.platform, timestamp: Date.now() }
    };
  }

  async deleteMessage(messageId: string): Promise<SocialMediaResponse<boolean>> {
    // Telegram requires chat ID to delete a message
    return {
      success: false,
      error: 'Telegram requires chat ID to delete messages',
      metadata: { platform: this.platform, timestamp: Date.now() }
    };
  }

  async createStream(keywords: string[], channels?: string[]): Promise<SocialMediaStream> {
    const streamId = `telegram_stream_${Date.now()}`;
    
    const stream: SocialMediaStream = {
      id: streamId,
      platform: this.platform,
      type: 'polling',
      keywords,
      channels: channels || [],
      isActive: true,
      onMessage: () => {},
      onError: () => {}
    };

    this.activeStreams.set(streamId, stream);
    
    logger.info('Telegram stream created', { 
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
    
    logger.info('Telegram stream stopped', { streamId });
    return true;
  }

  async searchMessages(_query: string, _options: SearchOptions = {}): Promise<SocialMediaResponse<SocialMediaMessage[]>> {
    return {
      success: false,
      error: 'Telegram does not support message search through bot API',
      metadata: { platform: this.platform, timestamp: Date.now() }
    };
  }

  async getChannelMessages(_channelId: string, _options: SearchOptions = {}): Promise<SocialMediaResponse<SocialMediaMessage[]>> {
    return {
      success: false,
      error: 'Telegram does not support retrieving historical messages through bot API',
      metadata: { platform: this.platform, timestamp: Date.now() }
    };
  }

  async getUser(userId: string): Promise<SocialMediaResponse<SocialMediaUser>> {
    try {
      const response = await this.client.post('/getChatMember', {
        chat_id: userId,
        user_id: userId
      });

      if (response.data.ok && response.data.result.user) {
        const user = response.data.result.user;
        const socialUser = this.convertTelegramUserToSocialUser(user);

        return {
          success: true,
          data: socialUser,
          metadata: {
            platform: this.platform,
            timestamp: Date.now()
          }
        };
      } else {
        throw new Error(response.data.description);
      }
    } catch (error) {
      return this.handleError('getUser', error);
    }
  }

  async followUser(_userId: string): Promise<SocialMediaResponse<boolean>> {
    return {
      success: false,
      error: 'Telegram does not support following users',
      metadata: { platform: this.platform, timestamp: Date.now() }
    };
  }

  async unfollowUser(_userId: string): Promise<SocialMediaResponse<boolean>> {
    return {
      success: false,
      error: 'Telegram does not support unfollowing users',
      metadata: { platform: this.platform, timestamp: Date.now() }
    };
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.client.get('/getMe');
      return response.data.ok;
    } catch (error) {
      logger.warn('Telegram health check failed:', error);
      return false;
    }
  }

  async getRateLimitStatus(): Promise<RateLimitStatus> {
    return this.rateLimitStatus;
  }

  private convertTelegramMessageToSocialMessage(telegramMessage: TelegramMessage): SocialMediaMessage {
    const author = telegramMessage.from || {
      id: telegramMessage.sender_chat?.id || 0,
      is_bot: false,
      first_name: telegramMessage.sender_chat?.title || 'Channel'
    };

    const mentions: string[] = [];
    const hashtags: string[] = [];

    if (telegramMessage.entities) {
      for (const entity of telegramMessage.entities) {
        const text = telegramMessage.text?.substring(entity.offset, entity.offset + entity.length) || '';
        
        if (entity.type === 'mention') {
          mentions.push(text.substring(1)); // Remove @ symbol
        } else if (entity.type === 'hashtag') {
          hashtags.push(text.substring(1)); // Remove # symbol
        }
      }
    }

    const attachments = [];
    if (telegramMessage.photo) {
      attachments.push({
        type: 'image' as const,
        url: telegramMessage.photo[telegramMessage.photo.length - 1].file_id
      });
    }
    if (telegramMessage.video) {
      attachments.push({
        type: 'video' as const,
        url: telegramMessage.video.file_id
      });
    }
    if (telegramMessage.audio) {
      attachments.push({
        type: 'audio' as const,
        url: telegramMessage.audio.file_id
      });
    }
    if (telegramMessage.document) {
      attachments.push({
        type: 'document' as const,
        url: telegramMessage.document.file_id,
        title: telegramMessage.document.file_name
      });
    }

    return {
      id: telegramMessage.message_id.toString(),
      platform: this.platform,
      author: {
        id: author.id.toString(),
        username: author.username || author.first_name,
        displayName: [author.first_name, author.last_name].filter(Boolean).join(' ')
      },
      content: telegramMessage.text || telegramMessage.caption || '',
      timestamp: new Date(telegramMessage.date * 1000),
      channel: telegramMessage.chat.id.toString(),
      mentions,
      hashtags,
      attachments,
      parentMessageId: telegramMessage.reply_to_message?.message_id.toString(),
      isReply: !!telegramMessage.reply_to_message
    };
  }

  private convertTelegramUserToSocialUser(user: TelegramUser): SocialMediaUser {
    return {
      id: user.id.toString(),
      username: user.username || user.first_name,
      displayName: [user.first_name, user.last_name].filter(Boolean).join(' '),
      verified: false, // Telegram doesn't have verification badges for regular users
      followerCount: 0, // Telegram doesn't expose follower counts
      followingCount: 0,
      createdAt: new Date() // Telegram doesn't provide user creation date
    };
  }

  private handleError(operation: string, error: any): SocialMediaResponse<any> {
    logger.error(`Telegram ${operation} failed:`, error);

    const socialError: SocialMediaError = new Error(
      error?.response?.data?.description || error?.message || 'Unknown Telegram API error'
    ) as SocialMediaError;

    socialError.platform = this.platform;
    socialError.code = error?.response?.data?.error_code?.toString() || error?.code;
    socialError.rateLimited = error?.response?.status === 429;
    socialError.retryable = error?.response?.status >= 500 || error?.response?.status === 429;

    if (socialError.rateLimited) {
      socialError.retryAfter = 60; // Telegram rate limits are typically 1 minute
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
        logger.debug('Telegram API request', {
          method: config.method,
          url: config.url
        });
        return config;
      },
      (error) => {
        logger.error('Telegram API request error:', error);
        return Promise.reject(error);
      }
    );

    // Response interceptor for rate limit tracking
    this.client.interceptors.response.use(
      (response) => {
        logger.debug('Telegram API response', {
          ok: response.data.ok
        });
        
        // Update rate limit status (Telegram has a general rate limit of 30 requests per second)
        this.rateLimitStatus = {
          remaining: Math.max(0, this.rateLimitStatus.remaining - 1),
          reset: this.rateLimitStatus.reset,
          limit: 30,
          resetInSeconds: Math.ceil((this.rateLimitStatus.reset.getTime() - Date.now()) / 1000)
        };

        // Reset rate limit counter every second
        if (this.rateLimitStatus.resetInSeconds <= 0) {
          this.rateLimitStatus = {
            remaining: 30,
            reset: new Date(Date.now() + 1000),
            limit: 30,
            resetInSeconds: 1
          };
        }

        return response;
      },
      (error) => {
        logger.error('Telegram API response error:', {
          status: error.response?.status,
          description: error.response?.data?.description || error.message
        });
        return Promise.reject(error);
      }
    );
  }
}