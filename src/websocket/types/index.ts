import { Socket } from 'socket.io';
import { AuthenticatedUser } from '../../auth/types';
import { RateLimitConfig } from '../../security/services/rate-limiter.service';

// WebSocket Connection Types
export interface WebSocketConnection {
  id: string;
  userId?: string;
  user?: AuthenticatedUser;
  socket: Socket;
  channels: Set<string>;
  metadata: ConnectionMetadata;
  connectedAt: Date;
  lastActivity: Date;
  isAuthenticated: boolean;
  rateLimitInfo: RateLimitInfo;
}

export interface ConnectionMetadata {
  userAgent?: string;
  ipAddress?: string;
  clientVersion?: string;
  subscriptionTier?: string;
  preferences?: ClientPreferences;
}

export interface ClientPreferences {
  dataFormat: 'json' | 'protobuf';
  compression: boolean;
  batchSize: number;
  updateFrequency: 'realtime' | '1s' | '5s' | '10s';
}

export interface RateLimitInfo {
  messageCount: number;
  lastReset: Date;
  limit: number;
  windowMs: number;
}

// Channel and Topic Types
export interface Channel {
  id: string;
  name: string;
  type: ChannelType;
  description?: string;
  isPublic: boolean;
  requiresAuth: boolean;
  rateLimit?: RateLimitConfig;
  maxSubscribers?: number;
  createdAt: Date;
  updatedAt: Date;
}

export enum ChannelType {
  MARKET_DATA = 'market_data',
  USER_NOTIFICATIONS = 'user_notifications',
  PORTFOLIO_UPDATES = 'portfolio_updates',
  ALERTS = 'alerts',
  SYSTEM = 'system',
  CUSTOM = 'custom'
}

export interface ChannelSubscription {
  channelId: string;
  connectionId: string;
  userId?: string;
  subscribedAt: Date;
  filters?: SubscriptionFilters;
  lastMessageAt?: Date;
}

export interface SubscriptionFilters {
  symbols?: string[];
  priceRange?: {
    min: number;
    max: number;
  };
  volumeThreshold?: number;
  alertTypes?: string[];
  customFilters?: Record<string, any>;
}

// Message Types
export interface WebSocketMessage {
  id: string;
  type: MessageType;
  channel: string;
  data: any;
  timestamp: Date;
  metadata?: MessageMetadata;
}

export enum MessageType {
  // Market Data Messages
  PRICE_UPDATE = 'price_update',
  VOLUME_UPDATE = 'volume_update',
  TRADE_UPDATE = 'trade_update',
  MARKET_STATUS = 'market_status',
  
  // User Messages
  NOTIFICATION = 'notification',
  ALERT = 'alert',
  PORTFOLIO_UPDATE = 'portfolio_update',
  
  // System Messages
  CONNECTION_STATUS = 'connection_status',
  SUBSCRIPTION_UPDATE = 'subscription_update',
  ERROR = 'error',
  HEARTBEAT = 'heartbeat',
  
  // Control Messages
  SUBSCRIBE = 'subscribe',
  UNSUBSCRIBE = 'unsubscribe',
  AUTHENTICATE = 'authenticate',
  PING = 'ping',
  PONG = 'pong'
}

export interface MessageMetadata {
  source?: string;
  priority?: 'low' | 'normal' | 'high' | 'critical';
  ttl?: number; // Time to live in seconds
  retryCount?: number;
  correlationId?: string;
}

// Market Data Specific Types
export interface MarketDataMessage {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  high: number;
  low: number;
  open: number;
  previousClose: number;
  timestamp: Date;
  exchange: string;
}

export interface TradeMessage {
  symbol: string;
  price: number;
  quantity: number;
  side: 'buy' | 'sell';
  timestamp: Date;
  tradeId: string;
  exchange: string;
}

// Notification Types
export interface NotificationMessage {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  priority: 'low' | 'normal' | 'high' | 'critical';
  data?: any;
  timestamp: Date;
  expiresAt?: Date;
}

export enum NotificationType {
  PRICE_ALERT = 'price_alert',
  VOLUME_ALERT = 'volume_alert',
  PORTFOLIO_ALERT = 'portfolio_alert',
  SYSTEM_ALERT = 'system_alert',
  NEWS_ALERT = 'news_alert',
  CUSTOM_ALERT = 'custom_alert'
}

// Queue and Offline Message Types
export interface QueuedMessage {
  id: string;
  userId: string;
  channelId: string;
  message: WebSocketMessage;
  queuedAt: Date;
  expiresAt: Date;
  priority: number;
  attempts: number;
  maxAttempts: number;
}

export interface MessageQueue {
  userId: string;
  messages: QueuedMessage[];
  lastProcessed: Date;
  isProcessing: boolean;
}

// Authentication Types
export interface WebSocketAuth {
  token: string;
  userId: string;
  permissions: string[];
  subscriptionTier: string;
  expiresAt: Date;
}

export interface AuthResult {
  success: boolean;
  user?: AuthenticatedUser;
  error?: string;
  permissions?: string[];
}

// Error Types
export class WebSocketError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 400,
    public data?: any
  ) {
    super(message);
    this.name = 'WebSocketError';
  }
}

export enum WebSocketErrorCode {
  AUTHENTICATION_FAILED = 'AUTHENTICATION_FAILED',
  AUTHORIZATION_FAILED = 'AUTHORIZATION_FAILED',
  CHANNEL_NOT_FOUND = 'CHANNEL_NOT_FOUND',
  CHANNEL_ACCESS_DENIED = 'CHANNEL_ACCESS_DENIED',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  INVALID_MESSAGE_FORMAT = 'INVALID_MESSAGE_FORMAT',
  CONNECTION_LIMIT_EXCEEDED = 'CONNECTION_LIMIT_EXCEEDED',
  SUBSCRIPTION_LIMIT_EXCEEDED = 'SUBSCRIPTION_LIMIT_EXCEEDED',
  INTERNAL_ERROR = 'INTERNAL_ERROR'
}

// Monitoring and Metrics Types
export interface WebSocketMetrics {
  totalConnections: number;
  activeConnections: number;
  totalMessages: number;
  messagesPerSecond: number;
  channels: ChannelMetrics[];
  errors: ErrorMetrics[];
  performance: PerformanceMetrics;
}

export interface ChannelMetrics {
  channelId: string;
  subscribers: number;
  messagesSent: number;
  messagesPerSecond: number;
  lastActivity: Date;
}

export interface ErrorMetrics {
  code: string;
  count: number;
  lastOccurrence: Date;
  affectedConnections: number;
}

export interface PerformanceMetrics {
  averageLatency: number;
  maxLatency: number;
  minLatency: number;
  connectionTime: number;
  messageQueueSize: number;
  memoryUsage: number;
  cpuUsage: number;
}

// Configuration Types
export interface WebSocketConfig {
  port: number;
  cors: {
    origin: string | string[];
    credentials: boolean;
  };
  authentication: {
    required: boolean;
    timeout: number;
    tokenExpiry: number;
  };
  rateLimiting: {
    enabled: boolean;
    windowMs: number;
    maxMessages: number;
    maxConnections: number;
  };
  channels: {
    maxSubscriptions: number;
    maxSubscribers: number;
    messageHistorySize: number;
  };
  queue: {
    enabled: boolean;
    maxSize: number;
    ttl: number;
    batchSize: number;
  };
  monitoring: {
    enabled: boolean;
    metricsInterval: number;
    logLevel: 'debug' | 'info' | 'warn' | 'error';
  };
}

// Event Types
export interface WebSocketEvents {
  connection: (connection: WebSocketConnection) => void;
  disconnect: (connection: WebSocketConnection, reason: string) => void;
  message: (connection: WebSocketConnection, message: WebSocketMessage) => void;
  subscribe: (connection: WebSocketConnection, channelId: string, filters?: SubscriptionFilters) => void;
  unsubscribe: (connection: WebSocketConnection, channelId: string) => void;
  authenticate: (connection: WebSocketConnection, auth: WebSocketAuth) => void;
  error: (connection: WebSocketConnection, error: WebSocketError) => void;
}

// Load Balancing Types
export interface LoadBalancerInfo {
  instanceId: string;
  host: string;
  port: number;
  connections: number;
  maxConnections: number;
  load: number;
  health: 'healthy' | 'unhealthy' | 'degraded';
  lastHeartbeat: Date;
}

export interface ClusterMessage {
  type: 'broadcast' | 'direct' | 'subscribe' | 'unsubscribe';
  target?: string;
  data: any;
  timestamp: Date;
  source: string;
} 