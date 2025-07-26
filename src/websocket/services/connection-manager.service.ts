import { Socket } from 'socket.io';
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { 
  WebSocketConnection, 
  ConnectionMetadata, 
  RateLimitInfo, 
  WebSocketAuth, 
  AuthResult,
  WebSocketError,
  WebSocketErrorCode
} from '../types';
import { AuthenticatedUser } from '../../auth/types';
import { websocketConfig } from '../config/websocket.config';
import { JWTService } from '../../auth/services/jwt.service';

/**
 * WebSocket Connection Manager Service
 * Manages WebSocket connections, authentication, and rate limiting
 */
export class ConnectionManagerService extends EventEmitter {
  private connections: Map<string, WebSocketConnection> = new Map();
  private userConnections: Map<string, Set<string>> = new Map();
  private jwtService: JWTService;

  constructor() {
    super();
    this.jwtService = new JWTService({} as any); // TODO: Pass proper config
  }

  /**
   * Create a new WebSocket connection
   */
  createConnection(socket: Socket): WebSocketConnection {
    const connectionId = uuidv4();
    const metadata = this.extractConnectionMetadata(socket);
    
    const connection: WebSocketConnection = {
      id: connectionId,
      socket,
      channels: new Set(),
      metadata,
      connectedAt: new Date(),
      lastActivity: new Date(),
      isAuthenticated: false,
      rateLimitInfo: {
        messageCount: 0,
        lastReset: new Date(),
        limit: websocketConfig.rateLimiting.maxMessages,
        windowMs: websocketConfig.rateLimiting.windowMs,
      },
    };

    this.connections.set(connectionId, connection);
    this.emit('connection', connection);

    // Set up socket event handlers
    this.setupSocketHandlers(connection);

    return connection;
  }

  /**
   * Remove a WebSocket connection
   */
  removeConnection(connectionId: string, reason: string = 'disconnected'): void {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    // Remove from user connections
    if (connection.userId) {
      const userConnections = this.userConnections.get(connection.userId);
      if (userConnections) {
        userConnections.delete(connectionId);
        if (userConnections.size === 0) {
          this.userConnections.delete(connection.userId);
        }
      }
    }

    // Clean up connection
    this.connections.delete(connectionId);
    this.emit('disconnect', connection, reason);
  }

  /**
   * Authenticate a WebSocket connection
   */
  async authenticateConnection(connectionId: string, auth: WebSocketAuth): Promise<AuthResult> {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      return { success: false, error: 'Connection not found' };
    }

    try {
      // Verify JWT token
      const payload = await this.jwtService.verifyAccessToken(auth.token);
      if (!payload) {
        return { success: false, error: 'Invalid token' };
      }

      // Get user information
      const user = await this.getUserFromToken(payload.sub);
      if (!user) {
        return { success: false, error: 'User not found' };
      }

      // Update connection with user information
      connection.userId = user.id;
      connection.user = user;
      connection.isAuthenticated = true;
      connection.lastActivity = new Date();

      // Add to user connections map
      if (!this.userConnections.has(user.id)) {
        this.userConnections.set(user.id, new Set());
      }
      this.userConnections.get(user.id)!.add(connectionId);

      // Update rate limit based on user tier
      this.updateRateLimitForUser(connection, user);

      this.emit('authenticate', connection, auth);
      return { success: true, user, permissions: auth.permissions };
    } catch (error) {
      const wsError = new WebSocketError(
        'Authentication failed',
        WebSocketErrorCode.AUTHENTICATION_FAILED,
        401,
        { error: error instanceof Error ? error.message : 'Unknown error' }
      );
      this.emit('error', connection, wsError);
      return { success: false, error: wsError.message };
    }
  }

  /**
   * Get connection by ID
   */
  getConnection(connectionId: string): WebSocketConnection | undefined {
    return this.connections.get(connectionId);
  }

  /**
   * Get all connections for a user
   */
  getUserConnections(userId: string): WebSocketConnection[] {
    const connectionIds = this.userConnections.get(userId);
    if (!connectionIds) return [];

    return Array.from(connectionIds)
      .map(id => this.connections.get(id))
      .filter((conn): conn is WebSocketConnection => conn !== undefined);
  }

  /**
   * Get all active connections
   */
  getAllConnections(): WebSocketConnection[] {
    return Array.from(this.connections.values());
  }

  /**
   * Get connection count
   */
  getConnectionCount(): number {
    return this.connections.size;
  }

  /**
   * Get authenticated connection count
   */
  getAuthenticatedConnectionCount(): number {
    return Array.from(this.connections.values()).filter(conn => conn.isAuthenticated).length;
  }

  /**
   * Check if connection is rate limited
   */
  isRateLimited(connectionId: string): boolean {
    const connection = this.connections.get(connectionId);
    if (!connection) return true;

    const now = new Date();
    const timeSinceReset = now.getTime() - connection.rateLimitInfo.lastReset.getTime();

    // Reset rate limit if window has passed
    if (timeSinceReset >= connection.rateLimitInfo.windowMs) {
      connection.rateLimitInfo.messageCount = 0;
      connection.rateLimitInfo.lastReset = now;
    }

    return connection.rateLimitInfo.messageCount >= connection.rateLimitInfo.limit;
  }

  /**
   * Increment message count for rate limiting
   */
  incrementMessageCount(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    connection.rateLimitInfo.messageCount++;
    connection.lastActivity = new Date();
  }

  /**
   * Update connection activity
   */
  updateActivity(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (connection) {
      connection.lastActivity = new Date();
    }
  }

  /**
   * Get inactive connections (for cleanup)
   */
  getInactiveConnections(timeoutMs: number): WebSocketConnection[] {
    const now = new Date();
    const timeout = now.getTime() - timeoutMs;

    return Array.from(this.connections.values()).filter(
      connection => connection.lastActivity.getTime() < timeout
    );
  }

  /**
   * Clean up inactive connections
   */
  cleanupInactiveConnections(timeoutMs: number = 300000): number { // 5 minutes default
    const inactiveConnections = this.getInactiveConnections(timeoutMs);
    
    inactiveConnections.forEach(connection => {
      this.removeConnection(connection.id, 'inactive');
    });

    return inactiveConnections.length;
  }

  /**
   * Broadcast message to all connections
   */
  broadcast(message: any, filter?: (connection: WebSocketConnection) => boolean): void {
    const connections = filter 
      ? Array.from(this.connections.values()).filter(filter)
      : Array.from(this.connections.values());

    connections.forEach(connection => {
      try {
        connection.socket.emit('message', message);
      } catch (error) {
        console.error(`Failed to send message to connection ${connection.id}:`, error);
      }
    });
  }

  /**
   * Send message to specific connection
   */
  sendToConnection(connectionId: string, message: any): boolean {
    const connection = this.connections.get(connectionId);
    if (!connection) return false;

    try {
      connection.socket.emit('message', message);
      this.updateActivity(connectionId);
      return true;
    } catch (error) {
      console.error(`Failed to send message to connection ${connectionId}:`, error);
      return false;
    }
  }

  /**
   * Send message to all connections of a user
   */
  sendToUser(userId: string, message: any): number {
    const userConnections = this.getUserConnections(userId);
    let sentCount = 0;

    userConnections.forEach(connection => {
      if (this.sendToConnection(connection.id, message)) {
        sentCount++;
      }
    });

    return sentCount;
  }

  /**
   * Extract connection metadata from socket
   */
  private extractConnectionMetadata(socket: Socket): ConnectionMetadata {
    const handshake = socket.handshake;
    const forwardedFor = handshake.headers['x-forwarded-for'];
    const ipAddress = typeof forwardedFor === 'string' 
      ? forwardedFor.split(',')[0]?.trim() 
      : handshake.address;
    
    return {
      userAgent: handshake.headers['user-agent'] || undefined,
      ipAddress: ipAddress || undefined,
      clientVersion: handshake.headers['x-client-version'] as string || undefined,
      subscriptionTier: handshake.headers['x-subscription-tier'] as string || undefined,
      preferences: this.parseClientPreferences(handshake.headers['x-client-preferences'] as string),
    };
  }

  /**
   * Parse client preferences from header
   */
  private parseClientPreferences(preferencesHeader?: string): ConnectionMetadata['preferences'] {
    if (!preferencesHeader) {
      return {
        dataFormat: 'json',
        compression: false,
        batchSize: 1,
        updateFrequency: 'realtime',
      };
    }

    try {
      const preferences = JSON.parse(preferencesHeader);
      return {
        dataFormat: preferences.dataFormat || 'json',
        compression: preferences.compression || false,
        batchSize: preferences.batchSize || 1,
        updateFrequency: preferences.updateFrequency || 'realtime',
      };
    } catch {
      return {
        dataFormat: 'json',
        compression: false,
        batchSize: 1,
        updateFrequency: 'realtime',
      };
    }
  }

  /**
   * Set up socket event handlers
   */
  private setupSocketHandlers(connection: WebSocketConnection): void {
    const { socket } = connection;

    socket.on('disconnect', (reason) => {
      this.removeConnection(connection.id, reason);
    });

    socket.on('error', (error) => {
      const wsError = new WebSocketError(
        'Socket error',
        WebSocketErrorCode.INTERNAL_ERROR,
        500,
        { error: error.message }
      );
      this.emit('error', connection, wsError);
    });

    socket.on('ping', () => {
      this.updateActivity(connection.id);
      socket.emit('pong');
    });

    socket.on('authenticate', async (data: WebSocketAuth) => {
      const result = await this.authenticateConnection(connection.id, data);
      socket.emit('authentication_result', result);
    });
  }

  /**
   * Get user from token (placeholder - implement based on your user service)
   */
  private async getUserFromToken(userId: string): Promise<AuthenticatedUser | null> {
    // TODO: Implement user retrieval from your user service
    // This is a placeholder implementation
    try {
      // Example implementation:
      // const user = await userService.findById(userId);
      // return user;
      
      // For now, return a mock user
      return {
        id: userId,
        email: 'user@example.com',
        role: 'USER' as any,
        permissions: [],
        status: 'ACTIVE' as any,
        mfaEnabled: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    } catch (error) {
      console.error('Failed to get user from token:', error);
      return null;
    }
  }

  /**
   * Update rate limit based on user subscription tier
   */
  private updateRateLimitForUser(connection: WebSocketConnection, user: AuthenticatedUser): void {
    // Update rate limit based on user role/subscription tier
    let limit = websocketConfig.rateLimiting.maxMessages;
    
    if (user.role === 'ADMIN') {
      limit = 1000; // Higher limit for admins
    } else if (user.role === 'INSTITUTIONAL') {
      limit = 500; // Higher limit for institutional users
    }

    connection.rateLimitInfo.limit = limit;
    connection.metadata.subscriptionTier = user.role;
  }

  /**
   * Get connection statistics
   */
  getStatistics(): {
    totalConnections: number;
    authenticatedConnections: number;
    userConnections: number;
    averageConnectionsPerUser: number;
  } {
    const totalConnections = this.getConnectionCount();
    const authenticatedConnections = this.getAuthenticatedConnectionCount();
    const userConnections = this.userConnections.size;
    const averageConnectionsPerUser = userConnections > 0 
      ? totalConnections / userConnections 
      : 0;

    return {
      totalConnections,
      authenticatedConnections,
      userConnections,
      averageConnectionsPerUser,
    };
  }
} 