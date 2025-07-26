import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { 
  QueuedMessage, 
  MessageQueue, 
  WebSocketMessage, 
  WebSocketError,
  WebSocketErrorCode
} from '../types';
import { messageQueueConfig } from '../config/websocket.config';
import { ConnectionManagerService } from './connection-manager.service';

/**
 * WebSocket Message Queue Service
 * Handles offline message delivery and message persistence
 */
export class MessageQueueService extends EventEmitter {
  private queues: Map<string, MessageQueue> = new Map();
  private connectionManager: ConnectionManagerService;
  private processingInterval: NodeJS.Timeout | null = null;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(connectionManager: ConnectionManagerService) {
    super();
    this.connectionManager = connectionManager;
    this.startProcessing();
    this.startCleanup();
  }

  /**
   * Queue a message for a user
   */
  queueMessage(
    userId: string, 
    channelId: string, 
    message: WebSocketMessage, 
    priority: number = 1
  ): QueuedMessage {
    if (!messageQueueConfig.enabled) {
      throw new WebSocketError(
        'Message queue is disabled',
        WebSocketErrorCode.INTERNAL_ERROR,
        503
      );
    }

    const queuedMessage: QueuedMessage = {
      id: uuidv4(),
      userId,
      channelId,
      message,
      queuedAt: new Date(),
      expiresAt: new Date(Date.now() + messageQueueConfig.cleanup.ttl * 1000),
      priority,
      attempts: 0,
      maxAttempts: messageQueueConfig.processing.maxRetries,
    };

    // Get or create user queue
    let userQueue = this.queues.get(userId);
    if (!userQueue) {
      userQueue = {
        userId,
        messages: [],
        lastProcessed: new Date(),
        isProcessing: false,
      };
      this.queues.set(userId, userQueue);
    }

    // Add message to queue
    userQueue.messages.push(queuedMessage);

    // Sort by priority (higher priority first)
    userQueue.messages.sort((a, b) => b.priority - a.priority);

    // Check queue size limit (use a reasonable default)
    const maxQueueSize = 1000; // Default max queue size
    if (userQueue.messages.length > maxQueueSize) {
      // Remove lowest priority messages
      userQueue.messages = userQueue.messages.slice(0, maxQueueSize);
    }

    this.emit('message_queued', queuedMessage);
    return queuedMessage;
  }

  /**
   * Process queued messages for a user
   */
  async processUserQueue(userId: string): Promise<number> {
    const userQueue = this.queues.get(userId);
    if (!userQueue || userQueue.isProcessing) {
      return 0;
    }

    userQueue.isProcessing = true;
    let processedCount = 0;

    try {
      const userConnections = this.connectionManager.getUserConnections(userId);
      
      if (userConnections.length === 0) {
        // No active connections, keep messages in queue
        return 0;
      }

      const messagesToProcess = userQueue.messages.slice(0, messageQueueConfig.processing.batchSize);
      const processedMessages: string[] = [];

      for (const queuedMessage of messagesToProcess) {
        try {
          // Check if message has expired
          if (queuedMessage.expiresAt < new Date()) {
            processedMessages.push(queuedMessage.id);
            continue;
          }

          // Check if user is subscribed to the channel
          const isSubscribed = userConnections.some(connection => 
            connection.channels.has(queuedMessage.channelId)
          );

          if (!isSubscribed) {
            // User not subscribed, remove message
            processedMessages.push(queuedMessage.id);
            continue;
          }

          // Try to send message to user connections
          const sentCount = this.connectionManager.sendToUser(userId, queuedMessage.message);
          
          if (sentCount > 0) {
            // Message sent successfully
            processedMessages.push(queuedMessage.id);
            processedCount++;
            this.emit('message_delivered', queuedMessage, sentCount);
          } else {
            // Increment attempt count
            queuedMessage.attempts++;
            
            if (queuedMessage.attempts >= queuedMessage.maxAttempts) {
              // Max attempts reached, remove message
              processedMessages.push(queuedMessage.id);
              this.emit('message_failed', queuedMessage, 'Max attempts reached');
            }
          }
        } catch (error) {
          queuedMessage.attempts++;
          
          if (queuedMessage.attempts >= queuedMessage.maxAttempts) {
            processedMessages.push(queuedMessage.id);
            this.emit('message_failed', queuedMessage, error instanceof Error ? error.message : 'Unknown error');
          }
        }
      }

      // Remove processed messages
      userQueue.messages = userQueue.messages.filter(msg => !processedMessages.includes(msg.id));
      userQueue.lastProcessed = new Date();

    } finally {
      userQueue.isProcessing = false;
    }

    return processedCount;
  }

  /**
   * Process all user queues
   */
  async processAllQueues(): Promise<number> {
    let totalProcessed = 0;

    for (const [userId] of this.queues) {
      const processed = await this.processUserQueue(userId);
      totalProcessed += processed;
    }

    return totalProcessed;
  }

  /**
   * Get queued messages for a user
   */
  getUserMessages(userId: string, limit?: number): QueuedMessage[] {
    const userQueue = this.queues.get(userId);
    if (!userQueue) return [];

    const messages = userQueue.messages;
    return limit ? messages.slice(0, limit) : messages;
  }

  /**
   * Get message by ID
   */
  getMessage(messageId: string): QueuedMessage | undefined {
    for (const userQueue of this.queues.values()) {
      const message = userQueue.messages.find(msg => msg.id === messageId);
      if (message) return message;
    }
    return undefined;
  }

  /**
   * Remove a specific message from queue
   */
  removeMessage(messageId: string): boolean {
    for (const [userId, userQueue] of this.queues) {
      const messageIndex = userQueue.messages.findIndex(msg => msg.id === messageId);
      if (messageIndex !== -1) {
        userQueue.messages.splice(messageIndex, 1);
        this.emit('message_removed', messageId, userId);
        return true;
      }
    }
    return false;
  }

  /**
   * Clear all messages for a user
   */
  clearUserMessages(userId: string): number {
    const userQueue = this.queues.get(userId);
    if (!userQueue) return 0;

    const messageCount = userQueue.messages.length;
    userQueue.messages = [];
    this.emit('user_messages_cleared', userId, messageCount);
    return messageCount;
  }

  /**
   * Get queue statistics
   */
  getQueueStatistics(): {
    totalQueues: number;
    totalMessages: number;
    oldestMessage: Date | null;
    averageQueueSize: number;
    processingStatus: 'active' | 'inactive';
  } {
    const queues = Array.from(this.queues.values());
    const totalQueues = queues.length;
    const totalMessages = queues.reduce((sum, queue) => sum + queue.messages.length, 0);
    
    let oldestMessage: Date | null = null;
    for (const queue of queues) {
      for (const message of queue.messages) {
        if (!oldestMessage || message.queuedAt < oldestMessage) {
          oldestMessage = message.queuedAt;
        }
      }
    }

    const averageQueueSize = totalQueues > 0 ? totalMessages / totalQueues : 0;
    const processingStatus = this.processingInterval ? 'active' : 'inactive';

    return {
      totalQueues,
      totalMessages,
      oldestMessage,
      averageQueueSize,
      processingStatus,
    };
  }

  /**
   * Get user queue statistics
   */
  getUserQueueStatistics(userId: string): {
    messageCount: number;
    oldestMessage?: Date;
    lastProcessed: Date | null;
    isProcessing: boolean;
  } {
    const userQueue = this.queues.get(userId);
    if (!userQueue) {
      return {
        messageCount: 0,
        lastProcessed: null,
        isProcessing: false,
      };
    }

    let oldestMessage: Date | undefined;
    if (userQueue.messages.length > 0) {
      oldestMessage = userQueue.messages.reduce((oldest, msg) => 
        msg.queuedAt < oldest ? msg.queuedAt : oldest
      , userQueue.messages[0]!.queuedAt);
    }

    const result: {
      messageCount: number;
      oldestMessage?: Date;
      lastProcessed: Date | null;
      isProcessing: boolean;
    } = {
      messageCount: userQueue.messages.length,
      lastProcessed: userQueue.lastProcessed,
      isProcessing: userQueue.isProcessing,
    };

    if (oldestMessage) {
      result.oldestMessage = oldestMessage;
    }

    return result;
  }

  /**
   * Start message processing
   */
  private startProcessing(): void {
    if (!messageQueueConfig.enabled) return;

    this.processingInterval = setInterval(async () => {
      try {
        const processed = await this.processAllQueues();
        if (processed > 0) {
          this.emit('batch_processed', processed);
        }
      } catch (error) {
        console.error('Error processing message queues:', error);
        this.emit('processing_error', error);
      }
    }, messageQueueConfig.processing.interval);
  }

  /**
   * Start cleanup process
   */
  private startCleanup(): void {
    if (!messageQueueConfig.cleanup.enabled) return;

    this.cleanupInterval = setInterval(() => {
      try {
        const cleanedCount = this.cleanupExpiredMessages();
        if (cleanedCount > 0) {
          this.emit('cleanup_completed', cleanedCount);
        }
      } catch (error) {
        console.error('Error during message cleanup:', error);
        this.emit('cleanup_error', error);
      }
    }, messageQueueConfig.cleanup.interval);
  }

  /**
   * Clean up expired messages
   */
  private cleanupExpiredMessages(): number {
    const now = new Date();
    let cleanedCount = 0;

    for (const [userId, userQueue] of this.queues) {
      const originalCount = userQueue.messages.length;
      userQueue.messages = userQueue.messages.filter(msg => msg.expiresAt > now);
      cleanedCount += originalCount - userQueue.messages.length;

      // Remove empty queues
      if (userQueue.messages.length === 0) {
        this.queues.delete(userId);
      }
    }

    return cleanedCount;
  }

  /**
   * Stop the service
   */
  stop(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }

    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    this.emit('service_stopped');
  }

  /**
   * Resume the service
   */
  resume(): void {
    this.startProcessing();
    this.startCleanup();
    this.emit('service_resumed');
  }

  /**
   * Check if service is running
   */
  isRunning(): boolean {
    return this.processingInterval !== null;
  }
} 