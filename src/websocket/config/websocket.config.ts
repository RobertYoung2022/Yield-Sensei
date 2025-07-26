import { WebSocketConfig } from '../types';

/**
 * WebSocket Configuration
 * Environment-based configuration for the WebSocket server
 */

const isDevelopment = process.env['NODE_ENV'] === 'development';
const isProduction = process.env['NODE_ENV'] === 'production';

export const websocketConfig: WebSocketConfig = {
  port: parseInt(process.env['WEBSOCKET_PORT'] || '3001', 10),
  cors: {
    origin: isProduction 
      ? process.env['WEBSOCKET_CORS_ORIGIN']?.split(',') || ['https://yieldsensei.com']
      : ['http://localhost:3000', 'http://localhost:3001', 'http://127.0.0.1:3000'],
    credentials: true,
  },
  authentication: {
    required: process.env['WEBSOCKET_AUTH_REQUIRED'] !== 'false',
    timeout: parseInt(process.env['WEBSOCKET_AUTH_TIMEOUT'] || '30000', 10),
    tokenExpiry: parseInt(process.env['WEBSOCKET_TOKEN_EXPIRY'] || '3600', 10),
  },
  rateLimiting: {
    enabled: process.env['WEBSOCKET_RATE_LIMIT_ENABLED'] !== 'false',
    windowMs: parseInt(process.env['WEBSOCKET_RATE_LIMIT_WINDOW'] || '60000', 10),
    maxMessages: parseInt(process.env['WEBSOCKET_RATE_LIMIT_MESSAGES'] || '100', 10),
    maxConnections: parseInt(process.env['WEBSOCKET_RATE_LIMIT_CONNECTIONS'] || '1000', 10),
  },
  channels: {
    maxSubscriptions: parseInt(process.env['WEBSOCKET_MAX_SUBSCRIPTIONS'] || '50', 10),
    maxSubscribers: parseInt(process.env['WEBSOCKET_MAX_SUBSCRIBERS'] || '10000', 10),
    messageHistorySize: parseInt(process.env['WEBSOCKET_MESSAGE_HISTORY'] || '100', 10),
  },
  queue: {
    enabled: process.env['WEBSOCKET_QUEUE_ENABLED'] !== 'false',
    maxSize: parseInt(process.env['WEBSOCKET_QUEUE_MAX_SIZE'] || '10000', 10),
    ttl: parseInt(process.env['WEBSOCKET_QUEUE_TTL'] || '3600', 10), // 1 hour
    batchSize: parseInt(process.env['WEBSOCKET_QUEUE_BATCH_SIZE'] || '100', 10),
  },
  monitoring: {
    enabled: process.env['WEBSOCKET_MONITORING_ENABLED'] !== 'false',
    metricsInterval: parseInt(process.env['WEBSOCKET_METRICS_INTERVAL'] || '30000', 10),
    logLevel: (process.env['WEBSOCKET_LOG_LEVEL'] as 'debug' | 'info' | 'warn' | 'error') || 'info',
  },
};

// Channel-specific configurations
export const channelConfigs = {
  marketData: {
    rateLimit: {
      free: { points: 30, duration: 60000 }, // 30 messages per minute
      standard: { points: 100, duration: 60000 }, // 100 messages per minute
      premium: { points: 300, duration: 60000 }, // 300 messages per minute
      admin: { points: 1000, duration: 60000 }, // 1000 messages per minute
    },
    maxSubscribers: 5000,
    messageHistorySize: 50,
  },
  notifications: {
    rateLimit: {
      free: { points: 10, duration: 60000 }, // 10 messages per minute
      standard: { points: 30, duration: 60000 }, // 30 messages per minute
      premium: { points: 100, duration: 60000 }, // 100 messages per minute
      admin: { points: 500, duration: 60000 }, // 500 messages per minute
    },
    maxSubscribers: 1000,
    messageHistorySize: 20,
  },
  portfolio: {
    rateLimit: {
      free: { points: 20, duration: 60000 }, // 20 messages per minute
      standard: { points: 60, duration: 60000 }, // 60 messages per minute
      premium: { points: 200, duration: 60000 }, // 200 messages per minute
      admin: { points: 1000, duration: 60000 }, // 1000 messages per minute
    },
    maxSubscribers: 2000,
    messageHistorySize: 30,
  },
  alerts: {
    rateLimit: {
      free: { points: 5, duration: 60000 }, // 5 messages per minute
      standard: { points: 15, duration: 60000 }, // 15 messages per minute
      premium: { points: 50, duration: 60000 }, // 50 messages per minute
      admin: { points: 200, duration: 60000 }, // 200 messages per minute
    },
    maxSubscribers: 500,
    messageHistorySize: 10,
  },
  system: {
    rateLimit: {
      free: { points: 5, duration: 60000 }, // 5 messages per minute
      standard: { points: 10, duration: 60000 }, // 10 messages per minute
      premium: { points: 20, duration: 60000 }, // 20 messages per minute
      admin: { points: 100, duration: 60000 }, // 100 messages per minute
    },
    maxSubscribers: 100,
    messageHistorySize: 5,
  },
};

// Redis configuration for WebSocket
export const redisConfig = {
  host: process.env['REDIS_HOST'] || 'localhost',
  port: parseInt(process.env['REDIS_PORT'] || '6379', 10),
  password: process.env['REDIS_PASSWORD'],
  db: parseInt(process.env['REDIS_WEBSOCKET_DB'] || '1', 10),
  keyPrefix: 'ws:',
  retryDelayOnFailover: 100,
  maxRetriesPerRequest: 3,
  lazyConnect: true,
  keepAlive: 30000,
  family: 4,
  maxLoadingTimeout: 10000,
  enableReadyCheck: true,
  enableOfflineQueue: true,
  connectTimeout: 10000,
  commandTimeout: 5000,
};

// Load balancing configuration
export const loadBalancerConfig = {
  enabled: process.env['WEBSOCKET_LOAD_BALANCER_ENABLED'] === 'true',
  instanceId: process.env['WEBSOCKET_INSTANCE_ID'] || `ws-${Date.now()}`,
  heartbeatInterval: parseInt(process.env['WEBSOCKET_HEARTBEAT_INTERVAL'] || '30000', 10),
  maxConnections: parseInt(process.env['WEBSOCKET_MAX_CONNECTIONS'] || '10000', 10),
  healthCheckInterval: parseInt(process.env['WEBSOCKET_HEALTH_CHECK_INTERVAL'] || '10000', 10),
};

// Message queue configuration
export const messageQueueConfig = {
  enabled: process.env['WEBSOCKET_MESSAGE_QUEUE_ENABLED'] !== 'false',
  redis: {
    host: process.env['REDIS_HOST'] || 'localhost',
    port: parseInt(process.env['REDIS_PORT'] || '6379', 10),
    password: process.env['REDIS_PASSWORD'],
    db: parseInt(process.env['REDIS_QUEUE_DB'] || '2', 10),
    keyPrefix: 'ws:queue:',
  },
  processing: {
    batchSize: parseInt(process.env['WEBSOCKET_QUEUE_BATCH_SIZE'] || '100', 10),
    interval: parseInt(process.env['WEBSOCKET_QUEUE_INTERVAL'] || '5000', 10),
    maxRetries: parseInt(process.env['WEBSOCKET_QUEUE_MAX_RETRIES'] || '3', 10),
    retryDelay: parseInt(process.env['WEBSOCKET_QUEUE_RETRY_DELAY'] || '5000', 10),
  },
  cleanup: {
    enabled: true,
    interval: parseInt(process.env['WEBSOCKET_QUEUE_CLEANUP_INTERVAL'] || '300000', 10), // 5 minutes
    ttl: parseInt(process.env['WEBSOCKET_QUEUE_TTL'] || '3600', 10), // 1 hour
  },
};

// Security configuration
export const securityConfig = {
  maxMessageSize: parseInt(process.env['WEBSOCKET_MAX_MESSAGE_SIZE'] || '1048576', 10), // 1MB
  pingTimeout: parseInt(process.env['WEBSOCKET_PING_TIMEOUT'] || '60000', 10),
  pingInterval: parseInt(process.env['WEBSOCKET_PING_INTERVAL'] || '25000', 10),
  upgradeTimeout: parseInt(process.env['WEBSOCKET_UPGRADE_TIMEOUT'] || '10000', 10),
  allowEIO3: false,
  transports: ['websocket', 'polling'],
  allowRequest: (req: any, callback: any) => {
    // Custom request validation
    const origin = req.headers.origin;
    if (isProduction && origin && !websocketConfig.cors.origin.includes(origin)) {
      return callback(null, false);
    }
    callback(null, true);
  },
};

// Validation function for configuration
export function validateWebSocketConfig(config: WebSocketConfig): void {
  const errors: string[] = [];

  if (config.port < 1 || config.port > 65535) {
    errors.push('Invalid WebSocket port number');
  }

  if (config.authentication.timeout < 1000) {
    errors.push('Authentication timeout must be at least 1000ms');
  }

  if (config.rateLimiting.windowMs < 1000) {
    errors.push('Rate limiting window must be at least 1000ms');
  }

  if (config.channels.maxSubscriptions < 1) {
    errors.push('Max subscriptions must be at least 1');
  }

  if (config.queue.maxSize < 1) {
    errors.push('Queue max size must be at least 1');
  }

  if (errors.length > 0) {
    throw new Error(`WebSocket configuration validation failed: ${errors.join(', ')}`);
  }
}

// Environment-specific overrides
if (isDevelopment) {
  websocketConfig.monitoring.logLevel = 'debug';
  websocketConfig.rateLimiting.maxMessages = 1000; // More lenient in development
  websocketConfig.rateLimiting.maxConnections = 10000;
}

if (isProduction) {
  websocketConfig.monitoring.logLevel = 'warn';
  websocketConfig.authentication.required = true;
  websocketConfig.rateLimiting.enabled = true;
  websocketConfig.queue.enabled = true;
}

// Validate configuration on load
validateWebSocketConfig(websocketConfig);

export default websocketConfig; 