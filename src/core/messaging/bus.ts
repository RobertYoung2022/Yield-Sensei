/**
 * YieldSensei Message Bus Implementation
 * Task 1.3: Message Bus Implementation
 * 
 * High-performance message bus for inter-agent communication using Kafka
 */

import { EventEmitter } from 'events';
import { Kafka, Producer, Consumer, KafkaConfig, logLevel } from 'kafkajs';
import { Message, MessageEnvelope, AgentId, MessageError } from '@/types';
import { ProtocolManager } from '@/core/communication/protocol';
import Logger from '@/shared/logging/logger';

const logger = Logger.getLogger('message-bus');

/**
 * Message Bus configuration
 */
export interface MessageBusConfig {
  kafka: KafkaConfig;
  topics: {
    default: string;
    priority: string;
    broadcast: string;
    events: string;
    heartbeat: string;
  };
  producer: {
    maxInFlightRequests: number;
    idempotent: boolean;
    transactionTimeout: number;
    acks: number;
  };
  consumer: {
    groupId: string;
    sessionTimeout: number;
    heartbeatInterval: number;
    maxWaitTimeInMs: number;
  };
  retry: {
    maxRetries: number;
    initialRetryTime: number;
    maxRetryTime: number;
  };
  persistence: {
    enabled: boolean;
    retentionMs: number;
  };
}

export const DEFAULT_MESSAGE_BUS_CONFIG: MessageBusConfig = {
  kafka: {
    clientId: 'yieldsensei-message-bus',
    brokers: ['localhost:9092'],
    logLevel: logLevel.WARN,
    retry: {
      initialRetryTime: 100,
      retries: 8,
    },
  },
  topics: {
    default: 'yieldsensei.messages',
    priority: 'yieldsensei.priority',
    broadcast: 'yieldsensei.broadcast',
    events: 'yieldsensei.events',
    heartbeat: 'yieldsensei.heartbeat',
  },
  producer: {
    maxInFlightRequests: 1,
    idempotent: true,
    transactionTimeout: 30000,
    acks: -1, // Wait for all replicas
  },
  consumer: {
    groupId: 'yieldsensei-agents',
    sessionTimeout: 30000,
    heartbeatInterval: 3000,
    maxWaitTimeInMs: 5000,
  },
  retry: {
    maxRetries: 3,
    initialRetryTime: 1000,
    maxRetryTime: 30000,
  },
  persistence: {
    enabled: true,
    retentionMs: 24 * 60 * 60 * 1000, // 24 hours
  },
};

/**
 * Message Bus Statistics
 */
export interface MessageBusStats {
  messagesSent: number;
  messagesReceived: number;
  messagesRetried: number;
  messagesFailed: number;
  averageLatency: number;
  topicStats: Map<string, {
    messageCount: number;
    avgProcessingTime: number;
    errors: number;
  }>;
  connectionStatus: 'connected' | 'disconnected' | 'connecting' | 'error';
}

/**
 * Message Bus Implementation
 * Provides high-performance, persistent messaging for agent communication
 */
export class MessageBus extends EventEmitter {
  private config: MessageBusConfig;
  private kafka: Kafka;
  private producer: Producer | null = null;
  private consumer: Consumer | null = null;
  private protocolManager: ProtocolManager;
  private isConnected: boolean = false;
  private isShuttingDown: boolean = false;
  
  // Message tracking
  private messageQueue: Map<string, MessageEnvelope> = new Map();
  private subscriptions: Map<AgentId, Set<string>> = new Map(); // Agent -> Topic subscriptions
  
  // Statistics
  private stats: MessageBusStats = {
    messagesSent: 0,
    messagesReceived: 0,
    messagesRetried: 0,
    messagesFailed: 0,
    averageLatency: 0,
    topicStats: new Map(),
    connectionStatus: 'disconnected',
  };

  constructor(busConfig: MessageBusConfig = DEFAULT_MESSAGE_BUS_CONFIG) {
    super();
    this.config = busConfig;
    this.kafka = new Kafka(this.config.kafka);
    this.protocolManager = new ProtocolManager();
    
    this.setupProtocolManagerEvents();
  }

  /**
   * Initialize the message bus
   */
  async initialize(): Promise<void> {
    try {
      logger.info('Initializing message bus...');
      this.stats.connectionStatus = 'connecting';

      // Create producer
      this.producer = this.kafka.producer({
        maxInFlightRequests: this.config.producer.maxInFlightRequests,
        idempotent: this.config.producer.idempotent,
        transactionTimeout: this.config.producer.transactionTimeout,
      });

      // Create consumer
      this.consumer = this.kafka.consumer({
        groupId: this.config.consumer.groupId,
        sessionTimeout: this.config.consumer.sessionTimeout,
        heartbeatInterval: this.config.consumer.heartbeatInterval,
      });

      // Connect producer and consumer
      await Promise.all([
        this.producer.connect(),
        this.consumer.connect(),
      ]);

      // Create topics if they don't exist
      await this.createTopics();

      // Set up consumer handlers
      await this.setupConsumer();

      this.isConnected = true;
      this.stats.connectionStatus = 'connected';
      
      logger.info('Message bus initialized successfully');
      this.emit('connected');
    } catch (error: unknown) {
      this.stats.connectionStatus = 'error';
      logger.error('Failed to initialize message bus:', error as Error);
      throw error;
    }
  }

  /**
   * Send a message through the bus
   */
  async sendMessage(
    message: Message,
    options: {
      persistent?: boolean;
      priority?: 'high' | 'medium' | 'low';
      partition?: number;
    } = {}
  ): Promise<void> {
    if (!this.isConnected || !this.producer) {
      throw new MessageError('Message bus not connected', message.id, 'NOT_CONNECTED');
    }

    try {
      const startTime = Date.now();
      
      // Serialize message
      const serializedMessage = this.protocolManager.serializer.serialize(message);

      // Determine topic based on message type and priority
      const topic = this.getTopicForMessage(message, options.priority);
      
      // Create message envelope
      const envelope: MessageEnvelope = {
        message,
        retryCount: 0,
        maxRetries: this.config.retry.maxRetries,
        deliveryAttempts: [new Date()],
      };

      // Store in queue for tracking
      this.messageQueue.set(message.id, envelope);

      const kafkaMessage: { key: string | null; value: Buffer; headers: { [key: string]: string; }; partition?: number; } = {
        key: message.to === 'broadcast' ? null : message.to,
        value: serializedMessage,
        headers: {
          messageId: message.id,
          messageType: message.type,
          from: message.from,
          to: message.to,
          priority: message.priority,
          timestamp: message.timestamp.toISOString(),
          correlationId: message.correlationId || '',
        },
      };

      if (options.partition !== undefined) {
        kafkaMessage.partition = options.partition;
      }

      // Send to Kafka
      await this.producer.send({
        topic,
        messages: [kafkaMessage],
      });

      // Update statistics
      const latency = Date.now() - startTime;
      this.updateStats('sent', topic, latency);
      
      logger.debug(`Message ${message.id} sent to topic ${topic} in ${latency}ms`);
      this.emit('message_sent', { message, topic, latency });
      
      // Clean up tracking
      this.messageQueue.delete(message.id);
    } catch (error: unknown) {
      this.stats.messagesFailed++;
      logger.error(`Failed to send message ${message.id}:`, error as Error);
      
      // Attempt retry if configured
      await this.handleSendFailure(message, error as Error);
      throw error;
    }
  }

  /**
   * Subscribe an agent to specific message types or topics
   */
  async subscribeAgent(agentId: AgentId, topics: string[] = []): Promise<void> {
    try {
      // Default subscription includes all message topics
      const defaultTopics: string[] = Object.values(this.config.topics);
      const subscriptionTopics: string[] = topics.length > 0 ? topics : defaultTopics as string[];
      
      // Store subscription
      this.subscriptions.set(agentId, new Set(subscriptionTopics));
      
      // Subscribe consumer to topics
      if (this.consumer) {
        await this.consumer.subscribe({
          topics: subscriptionTopics,
          fromBeginning: false,
        });
      }
      
      logger.info(`Agent ${agentId} subscribed to topics: ${subscriptionTopics.join(', ')}`);
      this.emit('agent_subscribed', { agentId, topics: subscriptionTopics });
    } catch (error: unknown) {
      logger.error(`Failed to subscribe agent ${agentId}:`, error as Error);
      throw error;
    }
  }

  /**
   * Unsubscribe an agent
   */
  async unsubscribeAgent(agentId: AgentId): Promise<void> {
    try {
      this.subscriptions.delete(agentId);
      logger.info(`Agent ${agentId} unsubscribed from message bus`);
      this.emit('agent_unsubscribed', { agentId });
    } catch (error: unknown) {
      logger.error(`Failed to unsubscribe agent ${agentId}:`, error as Error);
      throw error;
    }
  }

  /**
   * Get message bus statistics
   */
  getStats(): MessageBusStats {
    return { ...this.stats };
  }

  /**
   * Health check for the message bus
   */
  async healthCheck(): Promise<{ healthy: boolean; details: any }> {
    try {
      // Check Kafka connection
      if (!this.isConnected) {
        return { healthy: false, details: { error: 'Not connected to Kafka' } };
      }

      // Check producer and consumer health
      const details = {
        connected: this.isConnected,
        stats: this.getStats(),
        queueSize: this.messageQueue.size,
        subscriptions: this.subscriptions.size,
      };

      return { healthy: true, details };
    } catch (error: unknown) {
      return { healthy: false, details: { error: (error as Error).message } };
    }
  }

  /**
   * Shutdown the message bus
   */
  async shutdown(): Promise<void> {
    if (this.isShuttingDown) {
      return;
    }

    this.isShuttingDown = true;
    logger.info('Shutting down message bus...');

    try {
      // Process remaining messages
      if (this.messageQueue.size > 0) {
        logger.info(`Processing ${this.messageQueue.size} remaining messages...`);
        // Give some time for messages to be processed
        await new Promise(resolve => setTimeout(resolve, 5000));
      }

      // Disconnect producer and consumer
      const disconnectPromises = [];
      if (this.producer) {
        disconnectPromises.push(this.producer.disconnect());
      }
      if (this.consumer) {
        disconnectPromises.push(this.consumer.disconnect());
      }

      await Promise.all(disconnectPromises);

      this.isConnected = false;
      this.stats.connectionStatus = 'disconnected';
      
      logger.info('Message bus shut down successfully');
      this.emit('disconnected');
    } catch (error: unknown) {
      logger.error('Error during message bus shutdown:', error as Error);
      throw error;
    }
  }

  /**
   * Create Kafka topics if they don't exist
   */
  private async createTopics(): Promise<void> {
    try {
      const admin = this.kafka.admin();
      await admin.connect();

      const topics = Object.values(this.config.topics).map(topic => ({
        topic,
        numPartitions: 3,
        replicationFactor: 1,
        configEntries: [
          { name: 'retention.ms', value: this.config.persistence.retentionMs.toString() },
          { name: 'cleanup.policy', value: 'delete' },
        ],
      }));

      await admin.createTopics({ topics });
      await admin.disconnect();
      
      logger.info('Kafka topics created/verified');
    } catch (error: unknown) {
      logger.debug('Topic creation result:', (error as Error).message);
    }
  }

  /**
   * Set up consumer message handling
   */
  private async setupConsumer(): Promise<void> {
    if (!this.consumer) return;

    await this.consumer.run({
      eachMessage: async ({ topic, message, heartbeat }) => {
        const startTime = Date.now();
        
        try {
          // Keep consumer alive
          await heartbeat();

          // Parse message
          const messageData = this.parseKafkaMessage(message);
          if (!messageData) return;

          // Update statistics
          const processingTime = Date.now() - startTime;
          this.updateStats('received', topic, processingTime);

          // Emit to protocol manager
          this.protocolManager.handleIncomingMessage(message.value as Buffer);
          
          logger.debug(`Processed message from topic ${topic} in ${processingTime}ms`);
          this.emit('message_received', { message: messageData, topic, processingTime });
        } catch (error: unknown) {
          logger.error('Error processing message:', error as Error);
          this.updateStats('error', topic, 0);
        }
      },
    });
  }

  /**
   * Set up protocol manager event handlers
   */
  private setupProtocolManagerEvents(): void {
    this.protocolManager.on('message_send', async ({ message }) => {
      // Protocol manager wants to send a message
      await this.sendMessage(message);
    });

    this.protocolManager.on('message_received', (message: Message) => {
      // Forward received messages to subscribers
      this.emit('agent_message', message);
    });
  }

  /**
   * Determine the appropriate topic for a message
   */
  private getTopicForMessage(message: Message, priority?: string): string {
    if (message.to === 'broadcast') {
      return this.config.topics.broadcast;
    }
    
    if (message.type === 'heartbeat') {
      return this.config.topics.heartbeat;
    }
    
    if (message.type === 'event') {
      return this.config.topics.events;
    }
    
    if (priority === 'high' || message.priority === 'critical') {
      return this.config.topics.priority;
    }
    
    return this.config.topics.default;
  }

  /**
   * Parse Kafka message to our Message format
   */
  private parseKafkaMessage(kafkaMessage: any): Message | null {
    try {
      const messageData = JSON.parse(kafkaMessage.value.toString());
      
      return {
        ...messageData,
        timestamp: new Date(messageData.timestamp),
      };
    } catch (error: unknown) {
      logger.error('Failed to parse Kafka message:', error as Error);
      return null;
    }
  }

  /**
   * Handle message send failures
   */
  private async handleSendFailure(message: Message, error: Error): Promise<void> {
    const envelope = this.messageQueue.get(message.id);
    if (!envelope) return;

    envelope.retryCount++;
    envelope.deliveryAttempts.push(new Date());

    if (envelope.retryCount < envelope.maxRetries) {
      this.stats.messagesRetried++;
      
      // Exponential backoff
      const delay = Math.min(
        this.config.retry.initialRetryTime * Math.pow(2, envelope.retryCount),
        this.config.retry.maxRetryTime
      );
      
      logger.warn(`Retrying message ${message.id} in ${delay}ms (attempt ${envelope.retryCount}/${envelope.maxRetries})`);
      
      setTimeout(async () => {
        try {
          await this.sendMessage(message);
        } catch (retryError) {
          await this.handleSendFailure(message, retryError as Error);
        }
      }, delay);
    } else {
      logger.error(`Message ${message.id} failed after ${envelope.maxRetries} attempts`);
      this.messageQueue.delete(message.id);
      this.emit('message_failed', { message, error, attempts: envelope.retryCount });
    }
  }

  /**
   * Update message bus statistics
   */
  private updateStats(type: 'sent' | 'received' | 'error', topic: string, latency: number): void {
    switch (type) {
      case 'sent':
        this.stats.messagesSent++;
        break;
      case 'received':
        this.stats.messagesReceived++;
        break;
      case 'error':
        this.stats.messagesFailed++;
        break;
    }

    // Update average latency
    const totalMessages = this.stats.messagesSent + this.stats.messagesReceived;
    this.stats.averageLatency = (this.stats.averageLatency * (totalMessages - 1) + latency) / totalMessages;

    // Update topic stats
    if (!this.stats.topicStats.has(topic)) {
      this.stats.topicStats.set(topic, {
        messageCount: 0,
        avgProcessingTime: 0,
        errors: 0,
      });
    }

    const topicStats = this.stats.topicStats.get(topic)!;
    topicStats.messageCount++;
    topicStats.avgProcessingTime = (topicStats.avgProcessingTime * (topicStats.messageCount - 1) + latency) / topicStats.messageCount;
    
    if (type === 'error') {
      topicStats.errors++;
    }
  }
}