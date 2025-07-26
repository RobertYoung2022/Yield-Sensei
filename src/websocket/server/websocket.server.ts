import { Server as SocketIOServer } from 'socket.io';
import { createServer, Server as HTTPServer } from 'http';
import { EventEmitter } from 'events';
import { 
  WebSocketConfig, 
  WebSocketMessage, 
  MessageType, 
  WebSocketConnection,
  WebSocketError,
  WebSocketErrorCode,
  SubscriptionFilters,
  WebSocketAuth,
  WebSocketMetrics,
  ChannelType
} from '../types';
import { websocketConfig, securityConfig } from '../config/websocket.config';
import { ConnectionManagerService } from '../services/connection-manager.service';
import { ChannelManagerService } from '../services/channel-manager.service';
import { MessageQueueService } from '../services/message-queue.service';

/**
 * WebSocket Server
 * Main WebSocket server that integrates all services
 */
export class WebSocketServer extends EventEmitter {
  private httpServer: HTTPServer;
  private io: SocketIOServer;
  private connectionManager: ConnectionManagerService;
  private channelManager: ChannelManagerService;
  private messageQueue: MessageQueueService;
  private metricsInterval: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;

  constructor(config: WebSocketConfig = websocketConfig) {
    super();
    
    // Create HTTP server
    this.httpServer = createServer();
    
    // Create Socket.IO server
    this.io = new SocketIOServer(this.httpServer, {
      cors: config.cors,
      pingTimeout: securityConfig.pingTimeout,
      pingInterval: securityConfig.pingInterval,
      upgradeTimeout: securityConfig.upgradeTimeout,
      allowEIO3: securityConfig.allowEIO3,
      transports: securityConfig.transports as any,
      allowRequest: securityConfig.allowRequest,
      maxHttpBufferSize: securityConfig.maxMessageSize,
    });

    // Initialize services
    this.connectionManager = new ConnectionManagerService();
    this.channelManager = new ChannelManagerService(this.connectionManager);
    this.messageQueue = new MessageQueueService(this.connectionManager);

    // Set up event handlers
    this.setupEventHandlers();
  }

  /**
   * Start the WebSocket server
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      throw new Error('WebSocket server is already running');
    }

    try {
      // Start HTTP server
      await new Promise<void>((resolve, reject) => {
        this.httpServer.listen(websocketConfig.port, () => {
          console.log(`WebSocket server started on port ${websocketConfig.port}`);
          resolve();
        });
        
        this.httpServer.on('error', (error) => {
          reject(error);
        });
      });

      // Set up Socket.IO connection handling
      this.io.on('connection', (socket) => {
        this.handleConnection(socket);
      });

      // Start metrics collection
      if (websocketConfig.monitoring.enabled) {
        this.startMetricsCollection();
      }

      this.isRunning = true;
      this.emit('server_started', websocketConfig.port);
    } catch (error) {
      console.error('Failed to start WebSocket server:', error);
      throw error;
    }
  }

  /**
   * Stop the WebSocket server
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    try {
      // Stop metrics collection
      if (this.metricsInterval) {
        clearInterval(this.metricsInterval);
        this.metricsInterval = null;
      }

      // Stop message queue service
      this.messageQueue.stop();

      // Close Socket.IO server
      await new Promise<void>((resolve) => {
        this.io.close(() => {
          resolve();
        });
      });

      // Close HTTP server
      await new Promise<void>((resolve) => {
        this.httpServer.close(() => {
          resolve();
        });
      });

      this.isRunning = false;
      this.emit('server_stopped');
      console.log('WebSocket server stopped');
    } catch (error) {
      console.error('Error stopping WebSocket server:', error);
      throw error;
    }
  }

  /**
   * Handle new Socket.IO connection
   */
  private handleConnection(socket: any): void {
    try {
      // Create connection
      const connection = this.connectionManager.createConnection(socket);

      // Set up socket event handlers
      this.setupSocketEventHandlers(connection);

      console.log(`New WebSocket connection: ${connection.id}`);
    } catch (error) {
      console.error('Error handling connection:', error);
      socket.disconnect();
    }
  }

  /**
   * Set up socket event handlers
   */
  private setupSocketEventHandlers(connection: WebSocketConnection): void {
    const { socket } = connection;

    // Authentication
    socket.on('authenticate', async (data: WebSocketAuth) => {
      try {
        const result = await this.connectionManager.authenticateConnection(connection.id, data);
        socket.emit('authentication_result', result);
        
        if (result.success) {
          // Send connection status update
          this.sendConnectionStatus(connection, 'authenticated');
        }
      } catch (error) {
        socket.emit('error', {
          code: WebSocketErrorCode.AUTHENTICATION_FAILED,
          message: error instanceof Error ? error.message : 'Authentication failed',
        });
      }
    });

    // Channel subscription
    socket.on('subscribe', async (data: { channelId: string; filters?: SubscriptionFilters }) => {
      try {
        if (!connection.isAuthenticated && websocketConfig.authentication.required) {
          throw new WebSocketError(
            'Authentication required',
            WebSocketErrorCode.AUTHORIZATION_FAILED,
            401
          );
        }

        const subscription = this.channelManager.subscribeToChannel(
          connection.id,
          data.channelId,
          data.filters
        );

        socket.emit('subscription_result', {
          success: true,
          subscription,
        });

        // Send subscription confirmation
        this.sendSubscriptionUpdate(connection, data.channelId, 'subscribed');
      } catch (error) {
        socket.emit('subscription_result', {
          success: false,
          error: error instanceof Error ? error.message : 'Subscription failed',
        });
      }
    });

    // Channel unsubscription
    socket.on('unsubscribe', (data: { channelId: string }) => {
      try {
        this.channelManager.unsubscribeFromChannel(connection.id, data.channelId);
        
        socket.emit('unsubscription_result', {
          success: true,
          channelId: data.channelId,
        });

        // Send unsubscription confirmation
        this.sendSubscriptionUpdate(connection, data.channelId, 'unsubscribed');
      } catch (error) {
        socket.emit('unsubscription_result', {
          success: false,
          error: error instanceof Error ? error.message : 'Unsubscription failed',
        });
      }
    });

    // Custom message handling
    socket.on('message', (data: any) => {
      try {
        // Rate limiting check
        if (this.connectionManager.isRateLimited(connection.id)) {
          throw new WebSocketError(
            'Rate limit exceeded',
            WebSocketErrorCode.RATE_LIMIT_EXCEEDED,
            429
          );
        }

        this.connectionManager.incrementMessageCount(connection.id);
        this.emit('message', connection, data);
      } catch (error) {
        socket.emit('error', {
          code: error instanceof WebSocketError ? error.code : WebSocketErrorCode.INTERNAL_ERROR,
          message: error instanceof Error ? error.message : 'Message processing failed',
        });
      }
    });

    // Ping/Pong
    socket.on('ping', () => {
      socket.emit('pong');
    });

    // Disconnect
    socket.on('disconnect', (reason: string) => {
      console.log(`WebSocket connection disconnected: ${connection.id}, reason: ${reason}`);
      
      // Clean up subscriptions
      this.channelManager.cleanupConnectionSubscriptions(connection.id);
      
      // Remove connection
      this.connectionManager.removeConnection(connection.id, reason);
    });
  }

  /**
   * Set up service event handlers
   */
  private setupEventHandlers(): void {
    // Connection manager events
    this.connectionManager.on('connection', (connection) => {
      this.emit('connection', connection);
    });

    this.connectionManager.on('disconnect', (connection, reason) => {
      this.emit('disconnect', connection, reason);
    });

    this.connectionManager.on('authenticate', (connection, auth) => {
      this.emit('authenticate', connection, auth);
    });

    // Channel manager events
    this.channelManager.on('subscribe', (connection, channelId, filters) => {
      this.emit('subscribe', connection, channelId, filters);
    });

    this.channelManager.on('unsubscribe', (connection, channelId) => {
      this.emit('unsubscribe', connection, channelId);
    });

    this.channelManager.on('message_broadcast', (channelId, message, sentCount) => {
      this.emit('message_broadcast', channelId, message, sentCount);
    });

    // Message queue events
    this.messageQueue.on('message_queued', (queuedMessage) => {
      this.emit('message_queued', queuedMessage);
    });

    this.messageQueue.on('message_delivered', (queuedMessage, sentCount) => {
      this.emit('message_delivered', queuedMessage, sentCount);
    });

    this.messageQueue.on('message_failed', (queuedMessage, error) => {
      this.emit('message_failed', queuedMessage, error);
    });
  }

  /**
   * Send connection status update
   */
  private sendConnectionStatus(connection: WebSocketConnection, status: string): void {
    const message: WebSocketMessage = {
      id: `status-${Date.now()}`,
      type: MessageType.CONNECTION_STATUS,
      channel: 'system',
      data: {
        status,
        connectionId: connection.id,
        timestamp: new Date(),
      },
      timestamp: new Date(),
    };

    this.connectionManager.sendToConnection(connection.id, message);
  }

  /**
   * Send subscription update
   */
  private sendSubscriptionUpdate(connection: WebSocketConnection, channelId: string, action: string): void {
    const message: WebSocketMessage = {
      id: `subscription-${Date.now()}`,
      type: MessageType.SUBSCRIPTION_UPDATE,
      channel: 'system',
      data: {
        channelId,
        action,
        timestamp: new Date(),
      },
      timestamp: new Date(),
    };

    this.connectionManager.sendToConnection(connection.id, message);
  }

  /**
   * Start metrics collection
   */
  private startMetricsCollection(): void {
    this.metricsInterval = setInterval(() => {
      try {
        const metrics = this.getMetrics();
        this.emit('metrics', metrics);
      } catch (error) {
        console.error('Error collecting metrics:', error);
      }
    }, websocketConfig.monitoring.metricsInterval);
  }

  /**
   * Get server metrics
   */
  getMetrics(): WebSocketMetrics {
    const connectionStats = this.connectionManager.getStatistics();
    const channelStats = this.channelManager.getStatistics();
    const queueStats = this.messageQueue.getQueueStatistics();

    return {
      totalConnections: connectionStats.totalConnections,
      activeConnections: connectionStats.authenticatedConnections,
      totalMessages: 0, // TODO: Implement message counting
      messagesPerSecond: 0, // TODO: Implement message rate calculation
      channels: channelStats.mostActiveChannels.map(channel => ({
        channelId: channel.channelId,
        subscribers: channel.subscriberCount,
        messagesSent: channel.messageCount,
        messagesPerSecond: 0, // TODO: Implement per-channel rate calculation
        lastActivity: new Date(),
      })),
      errors: [], // TODO: Implement error tracking
      performance: {
        averageLatency: 0, // TODO: Implement latency tracking
        maxLatency: 0,
        minLatency: 0,
        connectionTime: 0,
        messageQueueSize: queueStats.totalMessages,
        memoryUsage: process.memoryUsage().heapUsed,
        cpuUsage: 0, // TODO: Implement CPU usage tracking
      },
    };
  }

  /**
   * Broadcast message to a channel
   */
  broadcastToChannel(
    channelId: string, 
    message: Omit<WebSocketMessage, 'id' | 'timestamp'>,
    filter?: (connection: WebSocketConnection) => boolean
  ): number {
    return this.channelManager.broadcastToChannel(channelId, message, filter);
  }

  /**
   * Send message to specific user
   */
  sendToUser(userId: string, message: Omit<WebSocketMessage, 'id' | 'timestamp'>): number {
    const fullMessage: WebSocketMessage = {
      id: `user-${Date.now()}`,
      timestamp: new Date(),
      ...message,
    };

    return this.connectionManager.sendToUser(userId, fullMessage);
  }

  /**
   * Queue message for offline delivery
   */
  queueMessage(
    userId: string, 
    channelId: string, 
    message: WebSocketMessage, 
    priority: number = 1
  ): any {
    return this.messageQueue.queueMessage(userId, channelId, message, priority);
  }

  /**
   * Get server status
   */
  getStatus(): {
    isRunning: boolean;
    port: number;
    connections: number;
    channels: number;
    queueSize: number;
  } {
    const connectionStats = this.connectionManager.getStatistics();
    const channelStats = this.channelManager.getStatistics();
    const queueStats = this.messageQueue.getQueueStatistics();

    return {
      isRunning: this.isRunning,
      port: websocketConfig.port,
      connections: connectionStats.totalConnections,
      channels: channelStats.totalChannels,
      queueSize: queueStats.totalMessages,
    };
  }

  /**
   * Get Socket.IO server instance
   */
  getSocketIOServer(): SocketIOServer {
    return this.io;
  }

  /**
   * Get HTTP server instance
   */
  getHTTPServer(): HTTPServer {
    return this.httpServer;
  }
} 