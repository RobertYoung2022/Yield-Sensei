import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { 
  Channel, 
  ChannelType, 
  ChannelSubscription, 
  SubscriptionFilters, 
  WebSocketMessage, 
  WebSocketConnection,
  WebSocketError,
  WebSocketErrorCode
} from '../types';
import { websocketConfig, channelConfigs } from '../config/websocket.config';
import { ConnectionManagerService } from './connection-manager.service';

/**
 * WebSocket Channel Manager Service
 * Manages channel subscriptions, message broadcasting, and channel lifecycle
 */
export class ChannelManagerService extends EventEmitter {
  private channels: Map<string, Channel> = new Map();
  private subscriptions: Map<string, Set<string>> = new Map(); // channelId -> Set<connectionId>
  private connectionSubscriptions: Map<string, Set<string>> = new Map(); // connectionId -> Set<channelId>
  private messageHistory: Map<string, WebSocketMessage[]> = new Map(); // channelId -> messages[]
  private connectionManager: ConnectionManagerService;

  constructor(connectionManager: ConnectionManagerService) {
    super();
    this.connectionManager = connectionManager;
    this.initializeDefaultChannels();
  }

  /**
   * Initialize default channels
   */
  private initializeDefaultChannels(): void {
    const defaultChannels: Channel[] = [
      {
        id: 'market-data',
        name: 'Market Data',
        type: ChannelType.MARKET_DATA,
        description: 'Real-time market data updates',
        isPublic: true,
        requiresAuth: false,
        rateLimit: {
          windowMs: 60000,
          maxRequests: 30,
        },
        maxSubscribers: channelConfigs.marketData.maxSubscribers,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'notifications',
        name: 'User Notifications',
        type: ChannelType.USER_NOTIFICATIONS,
        description: 'User-specific notifications and alerts',
        isPublic: false,
        requiresAuth: true,
        rateLimit: {
          windowMs: 60000,
          maxRequests: 10,
        },
        maxSubscribers: channelConfigs.notifications.maxSubscribers,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'portfolio',
        name: 'Portfolio Updates',
        type: ChannelType.PORTFOLIO_UPDATES,
        description: 'Real-time portfolio updates and changes',
        isPublic: false,
        requiresAuth: true,
        rateLimit: {
          windowMs: 60000,
          maxRequests: 20,
        },
        maxSubscribers: channelConfigs.portfolio.maxSubscribers,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'alerts',
        name: 'Trading Alerts',
        type: ChannelType.ALERTS,
        description: 'Trading alerts and signals',
        isPublic: false,
        requiresAuth: true,
        rateLimit: {
          windowMs: 60000,
          maxRequests: 5,
        },
        maxSubscribers: channelConfigs.alerts.maxSubscribers,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'system',
        name: 'System Messages',
        type: ChannelType.SYSTEM,
        description: 'System-wide messages and announcements',
        isPublic: true,
        requiresAuth: false,
        rateLimit: {
          windowMs: 60000,
          maxRequests: 5,
        },
        maxSubscribers: channelConfigs.system.maxSubscribers,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    defaultChannels.forEach(channel => {
      this.createChannel(channel);
    });
  }

  /**
   * Create a new channel
   */
  createChannel(channel: Channel): Channel {
    if (this.channels.has(channel.id)) {
      throw new WebSocketError(
        `Channel with ID '${channel.id}' already exists`,
        WebSocketErrorCode.INTERNAL_ERROR,
        400
      );
    }

    this.channels.set(channel.id, channel);
    this.subscriptions.set(channel.id, new Set());
    this.messageHistory.set(channel.id, []);

    this.emit('channel_created', channel);
    return channel;
  }

  /**
   * Get channel by ID
   */
  getChannel(channelId: string): Channel | undefined {
    return this.channels.get(channelId);
  }

  /**
   * Get all channels
   */
  getAllChannels(): Channel[] {
    return Array.from(this.channels.values());
  }

  /**
   * Get channels by type
   */
  getChannelsByType(type: ChannelType): Channel[] {
    return Array.from(this.channels.values()).filter(channel => channel.type === type);
  }

  /**
   * Get public channels
   */
  getPublicChannels(): Channel[] {
    return Array.from(this.channels.values()).filter(channel => channel.isPublic);
  }

  /**
   * Subscribe a connection to a channel
   */
  subscribeToChannel(
    connectionId: string, 
    channelId: string, 
    filters?: SubscriptionFilters
  ): ChannelSubscription {
    const connection = this.connectionManager.getConnection(connectionId);
    if (!connection) {
      throw new WebSocketError(
        'Connection not found',
        WebSocketErrorCode.INTERNAL_ERROR,
        404
      );
    }

    const channel = this.channels.get(channelId);
    if (!channel) {
      throw new WebSocketError(
        `Channel '${channelId}' not found`,
        WebSocketErrorCode.CHANNEL_NOT_FOUND,
        404
      );
    }

    // Check if channel requires authentication
    if (channel.requiresAuth && !connection.isAuthenticated) {
      throw new WebSocketError(
        'Authentication required for this channel',
        WebSocketErrorCode.CHANNEL_ACCESS_DENIED,
        403
      );
    }

    // Check subscription limits
    const currentSubscriptions = this.connectionSubscriptions.get(connectionId)?.size || 0;
    if (currentSubscriptions >= websocketConfig.channels.maxSubscriptions) {
      throw new WebSocketError(
        'Maximum subscription limit reached',
        WebSocketErrorCode.SUBSCRIPTION_LIMIT_EXCEEDED,
        429
      );
    }

    // Check channel subscriber limit
    const channelSubscribers = this.subscriptions.get(channelId)?.size || 0;
    if (channel.maxSubscribers && channelSubscribers >= channel.maxSubscribers) {
      throw new WebSocketError(
        'Channel subscriber limit reached',
        WebSocketErrorCode.SUBSCRIPTION_LIMIT_EXCEEDED,
        429
      );
    }

    // Add subscription
    if (!this.subscriptions.has(channelId)) {
      this.subscriptions.set(channelId, new Set());
    }
    this.subscriptions.get(channelId)!.add(connectionId);

    if (!this.connectionSubscriptions.has(connectionId)) {
      this.connectionSubscriptions.set(connectionId, new Set());
    }
    this.connectionSubscriptions.get(connectionId)!.add(channelId);

    // Add channel to connection's channels set
    connection.channels.add(channelId);

    const subscription: ChannelSubscription = {
      channelId,
      connectionId,
      subscribedAt: new Date(),
    };

    if (connection.userId) {
      subscription.userId = connection.userId;
    }

    if (filters) {
      subscription.filters = filters;
    }

    this.emit('subscribe', connection, channelId, filters);
    return subscription;
  }

  /**
   * Unsubscribe a connection from a channel
   */
  unsubscribeFromChannel(connectionId: string, channelId: string): void {
    const connection = this.connectionManager.getConnection(connectionId);
    if (!connection) return;

    // Remove from subscriptions
    const channelSubscriptions = this.subscriptions.get(channelId);
    if (channelSubscriptions) {
      channelSubscriptions.delete(connectionId);
      if (channelSubscriptions.size === 0) {
        this.subscriptions.delete(channelId);
      }
    }

    // Remove from connection subscriptions
    const connectionSubscriptions = this.connectionSubscriptions.get(connectionId);
    if (connectionSubscriptions) {
      connectionSubscriptions.delete(channelId);
      if (connectionSubscriptions.size === 0) {
        this.connectionSubscriptions.delete(connectionId);
      }
    }

    // Remove from connection's channels set
    connection.channels.delete(channelId);

    this.emit('unsubscribe', connection, channelId);
  }

  /**
   * Get channel subscribers
   */
  getChannelSubscribers(channelId: string): WebSocketConnection[] {
    const subscriberIds = this.subscriptions.get(channelId);
    if (!subscriberIds) return [];

    return Array.from(subscriberIds)
      .map(id => this.connectionManager.getConnection(id))
      .filter((conn): conn is WebSocketConnection => conn !== undefined);
  }

  /**
   * Get connection subscriptions
   */
  getConnectionSubscriptions(connectionId: string): Channel[] {
    const channelIds = this.connectionSubscriptions.get(connectionId);
    if (!channelIds) return [];

    return Array.from(channelIds)
      .map(id => this.channels.get(id))
      .filter((channel): channel is Channel => channel !== undefined);
  }

  /**
   * Broadcast message to a channel
   */
  broadcastToChannel(
    channelId: string, 
    message: Omit<WebSocketMessage, 'id' | 'timestamp'>,
    filter?: (connection: WebSocketConnection) => boolean
  ): number {
    const channel = this.channels.get(channelId);
    if (!channel) {
      throw new WebSocketError(
        `Channel '${channelId}' not found`,
        WebSocketErrorCode.CHANNEL_NOT_FOUND,
        404
      );
    }

    const subscribers = this.getChannelSubscribers(channelId);
    const filteredSubscribers = filter ? subscribers.filter(filter) : subscribers;

    const fullMessage: WebSocketMessage = {
      id: uuidv4(),
      timestamp: new Date(),
      ...message,
    };

    let sentCount = 0;
    filteredSubscribers.forEach(connection => {
      if (this.connectionManager.sendToConnection(connection.id, fullMessage)) {
        sentCount++;
      }
    });

    // Store message in history
    this.addMessageToHistory(channelId, fullMessage);

    this.emit('message_broadcast', channelId, fullMessage, sentCount);
    return sentCount;
  }

  /**
   * Send message to specific subscribers
   */
  sendToSubscribers(
    channelId: string,
    message: Omit<WebSocketMessage, 'id' | 'timestamp'>,
    subscriberIds: string[]
  ): number {
    const fullMessage: WebSocketMessage = {
      id: uuidv4(),
      timestamp: new Date(),
      ...message,
    };

    let sentCount = 0;
    subscriberIds.forEach(connectionId => {
      if (this.connectionManager.sendToConnection(connectionId, fullMessage)) {
        sentCount++;
      }
    });

    this.emit('message_sent', channelId, fullMessage, sentCount);
    return sentCount;
  }

  /**
   * Get message history for a channel
   */
  getMessageHistory(channelId: string, limit: number = 50): WebSocketMessage[] {
    const history = this.messageHistory.get(channelId) || [];
    return history.slice(-limit);
  }

  /**
   * Add message to channel history
   */
  private addMessageToHistory(channelId: string, message: WebSocketMessage): void {
    const history = this.messageHistory.get(channelId);
    if (!history) return;

    const channel = this.channels.get(channelId);
    const maxHistory = channel?.maxSubscribers 
      ? channelConfigs[channel.type as keyof typeof channelConfigs]?.messageHistorySize || 50
      : websocketConfig.channels.messageHistorySize;

    history.push(message);
    
    // Keep only the latest messages
    if (history.length > maxHistory) {
      history.splice(0, history.length - maxHistory);
    }
  }

  /**
   * Clean up subscriptions for a disconnected connection
   */
  cleanupConnectionSubscriptions(connectionId: string): void {
    const channelIds = this.connectionSubscriptions.get(connectionId);
    if (!channelIds) return;

    channelIds.forEach(channelId => {
      const channelSubscriptions = this.subscriptions.get(channelId);
      if (channelSubscriptions) {
        channelSubscriptions.delete(connectionId);
        if (channelSubscriptions.size === 0) {
          this.subscriptions.delete(channelId);
        }
      }
    });

    this.connectionSubscriptions.delete(connectionId);
  }

  /**
   * Get channel statistics
   */
  getChannelStatistics(channelId: string): {
    subscriberCount: number;
    messageCount: number;
    lastMessageAt?: Date;
  } {
    const subscribers = this.subscriptions.get(channelId);
    const history = this.messageHistory.get(channelId);
    const lastMessage = history && history.length > 0 ? history[history.length - 1] : undefined;
    
    const result: {
      subscriberCount: number;
      messageCount: number;
      lastMessageAt?: Date;
    } = {
      subscriberCount: subscribers?.size || 0,
      messageCount: history?.length || 0,
    };

    if (lastMessage) {
      result.lastMessageAt = lastMessage.timestamp;
    }
    
    return result;
  }

  /**
   * Get overall statistics
   */
  getStatistics(): {
    totalChannels: number;
    totalSubscriptions: number;
    channelsByType: Record<ChannelType, number>;
    mostActiveChannels: Array<{ channelId: string; subscriberCount: number; messageCount: number }>;
  } {
    const channels = Array.from(this.channels.values());
    const channelsByType: Record<ChannelType, number> = {} as any;
    
    channels.forEach(channel => {
      channelsByType[channel.type] = (channelsByType[channel.type] || 0) + 1;
    });

    const mostActiveChannels = channels
      .map(channel => {
        const stats = this.getChannelStatistics(channel.id);
        return {
          channelId: channel.id,
          subscriberCount: stats.subscriberCount,
          messageCount: stats.messageCount,
        };
      })
      .sort((a, b) => b.subscriberCount - a.subscriberCount)
      .slice(0, 10);

    return {
      totalChannels: channels.length,
      totalSubscriptions: Array.from(this.subscriptions.values()).reduce((sum, set) => sum + set.size, 0),
      channelsByType,
      mostActiveChannels,
    };
  }

  /**
   * Check if connection is subscribed to channel
   */
  isSubscribed(connectionId: string, channelId: string): boolean {
    return this.connectionSubscriptions.get(connectionId)?.has(channelId) || false;
  }

  /**
   * Get subscription count for a channel
   */
  getSubscriptionCount(channelId: string): number {
    return this.subscriptions.get(channelId)?.size || 0;
  }
} 