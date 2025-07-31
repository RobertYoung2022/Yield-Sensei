/**
 * Message Queue Testing Support
 * Utilities for testing message queue interactions in satellite components
 */

import { EventEmitter } from 'events';
import { Kafka, Producer, Consumer, EachMessagePayload } from 'kafkajs';
import { Redis } from 'ioredis';
import { Logger } from 'winston';
import { createLogger, format, transports } from 'winston';

export interface MessageQueueTestConfig {
  type: 'kafka' | 'redis' | 'rabbitmq';
  connectionConfig: any;
  topics?: string[];
  queues?: string[];
  testMode: 'mock' | 'real' | 'hybrid';
  recordMessages: boolean;
  simulateLatency?: { min: number; max: number };
  simulateFailures?: {
    probability: number;
    types: ('timeout' | 'connection' | 'processing')[];
  };
}

export interface TestMessage {
  id: string;
  topic: string;
  partition?: number;
  key?: string;
  value: any;
  headers?: Record<string, string>;
  timestamp: Date;
  metadata?: {
    retryCount?: number;
    processingTime?: number;
    error?: string;
  };
}

export interface MessageExpectation {
  topic: string;
  matcher: (message: TestMessage) => boolean;
  timeout: number;
  count?: number;
  ordered?: boolean;
}

export interface MessageQueueMetrics {
  messagesSent: number;
  messagesReceived: number;
  messagesProcessed: number;
  messagesFailed: number;
  avgProcessingTime: number;
  totalBytes: number;
}

export class MessageQueueTestHelper extends EventEmitter {
  private logger: Logger;
  private config: MessageQueueTestConfig;
  private messageHistory: TestMessage[] = [];
  private expectations: Map<string, MessageExpectation> = new Map();
  private metrics: MessageQueueMetrics = {
    messagesSent: 0,
    messagesReceived: 0,
    messagesProcessed: 0,
    messagesFailed: 0,
    avgProcessingTime: 0,
    totalBytes: 0,
  };
  
  // Kafka specific
  private kafka?: Kafka;
  private producer?: Producer;
  private consumers: Map<string, Consumer> = new Map();
  
  // Redis specific
  private redisPub?: Redis;
  private redisSub?: Redis;
  
  // Mock mode storage
  private mockQueues: Map<string, TestMessage[]> = new Map();
  private mockSubscribers: Map<string, Set<(message: TestMessage) => void>> = new Map();

  constructor(config: MessageQueueTestConfig) {
    super();
    this.config = config;
    this.logger = createLogger({
      level: 'info',
      format: format.combine(
        format.timestamp(),
        format.simple()
      ),
      transports: [
        new transports.Console(),
        new transports.File({ filename: 'logs/message-queue-testing.log' })
      ],
    });
  }

  async initialize(): Promise<void> {
    this.logger.info(`Initializing ${this.config.type} message queue helper in ${this.config.testMode} mode`);

    if (this.config.testMode === 'mock') {
      this.initializeMockQueues();
      return;
    }

    switch (this.config.type) {
      case 'kafka':
        await this.initializeKafka();
        break;
      case 'redis':
        await this.initializeRedis();
        break;
      case 'rabbitmq':
        await this.initializeRabbitMQ();
        break;
    }
  }

  private initializeMockQueues(): void {
    // Initialize mock queues for topics/channels
    const queueNames = this.config.topics || this.config.queues || [];
    for (const name of queueNames) {
      this.mockQueues.set(name, []);
      this.mockSubscribers.set(name, new Set());
    }
    this.logger.info('Mock message queues initialized');
  }

  private async initializeKafka(): Promise<void> {
    this.kafka = new Kafka({
      clientId: 'test-client',
      brokers: this.config.connectionConfig.brokers,
      ...this.config.connectionConfig,
    });

    this.producer = this.kafka.producer();
    await this.producer.connect();

    // Create topics if they don't exist
    if (this.config.topics) {
      const admin = this.kafka.admin();
      await admin.connect();
      
      try {
        await admin.createTopics({
          topics: this.config.topics.map(topic => ({
            topic,
            numPartitions: 1,
            replicationFactor: 1,
          })),
        });
      } catch (error) {
        // Topics might already exist
        this.logger.debug('Topics might already exist:', error);
      }
      
      await admin.disconnect();
    }

    this.logger.info('Kafka initialized successfully');
  }

  private async initializeRedis(): Promise<void> {
    this.redisPub = new Redis(this.config.connectionConfig);
    this.redisSub = new Redis(this.config.connectionConfig);

    this.redisSub.on('message', (channel, message) => {
      this.handleRedisMessage(channel, message);
    });

    // Subscribe to test channels
    if (this.config.topics) {
      for (const topic of this.config.topics) {
        await this.redisSub.subscribe(topic);
      }
    }

    this.logger.info('Redis Pub/Sub initialized successfully');
  }

  private async initializeRabbitMQ(): Promise<void> {
    // RabbitMQ initialization would go here
    this.logger.warn('RabbitMQ support not yet implemented');
  }

  async publish(topic: string, message: any, options?: {
    key?: string;
    headers?: Record<string, string>;
    partition?: number;
  }): Promise<TestMessage> {
    const testMessage: TestMessage = {
      id: this.generateMessageId(),
      topic,
      key: options?.key,
      value: message,
      headers: options?.headers,
      partition: options?.partition,
      timestamp: new Date(),
    };

    // Apply simulated latency
    if (this.config.simulateLatency) {
      const delay = this.randomDelay(
        this.config.simulateLatency.min,
        this.config.simulateLatency.max
      );
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    // Simulate failures
    if (this.shouldSimulateFailure()) {
      const error = new Error('Simulated publish failure');
      testMessage.metadata = { error: error.message };
      this.metrics.messagesFailed++;
      this.emit('publishError', { message: testMessage, error });
      throw error;
    }

    try {
      if (this.config.testMode === 'mock') {
        await this.publishMock(testMessage);
      } else {
        await this.publishReal(testMessage);
      }

      this.metrics.messagesSent++;
      this.metrics.totalBytes += JSON.stringify(message).length;

      if (this.config.recordMessages) {
        this.messageHistory.push(testMessage);
      }

      this.emit('messageSent', testMessage);
      this.checkExpectations(testMessage);

      return testMessage;
    } catch (error) {
      this.metrics.messagesFailed++;
      testMessage.metadata = { error: (error as Error).message };
      throw error;
    }
  }

  private async publishMock(message: TestMessage): Promise<void> {
    const queue = this.mockQueues.get(message.topic);
    if (!queue) {
      throw new Error(`Topic ${message.topic} not found`);
    }

    queue.push(message);

    // Notify subscribers
    const subscribers = this.mockSubscribers.get(message.topic);
    if (subscribers) {
      for (const subscriber of subscribers) {
        // Simulate async processing
        setImmediate(() => subscriber(message));
      }
    }
  }

  private async publishReal(message: TestMessage): Promise<void> {
    switch (this.config.type) {
      case 'kafka':
        if (!this.producer) throw new Error('Kafka producer not initialized');
        
        await this.producer.send({
          topic: message.topic,
          messages: [{
            key: message.key || null,
            value: JSON.stringify(message.value),
            headers: message.headers,
          }],
        });
        break;

      case 'redis':
        if (!this.redisPub) throw new Error('Redis publisher not initialized');
        
        await this.redisPub.publish(
          message.topic,
          JSON.stringify({
            ...message,
            value: message.value,
          })
        );
        break;

      case 'rabbitmq':
        throw new Error('RabbitMQ not yet implemented');
    }
  }

  async subscribe(
    topic: string,
    handler: (message: TestMessage) => Promise<void>,
    options?: {
      groupId?: string;
      fromBeginning?: boolean;
    }
  ): Promise<void> {
    this.logger.info(`Subscribing to topic: ${topic}`);

    if (this.config.testMode === 'mock') {
      const subscribers = this.mockSubscribers.get(topic) || new Set();
      subscribers.add(async (message) => {
        await this.processMessage(message, handler);
      });
      this.mockSubscribers.set(topic, subscribers);
      return;
    }

    switch (this.config.type) {
      case 'kafka':
        await this.subscribeKafka(topic, handler, options);
        break;
      
      case 'redis':
        // Already subscribed in initialization
        this.redisSub?.on('message', async (channel, messageStr) => {
          if (channel === topic) {
            const message = JSON.parse(messageStr) as TestMessage;
            await this.processMessage(message, handler);
          }
        });
        break;
    }
  }

  private async subscribeKafka(
    topic: string,
    handler: (message: TestMessage) => Promise<void>,
    options?: { groupId?: string; fromBeginning?: boolean }
  ): Promise<void> {
    if (!this.kafka) throw new Error('Kafka not initialized');

    const groupId = options?.groupId || `test-group-${Date.now()}`;
    const consumer = this.kafka.consumer({ groupId });
    
    await consumer.connect();
    await consumer.subscribe({
      topic,
      fromBeginning: options?.fromBeginning ?? false,
    });

    await consumer.run({
      eachMessage: async (payload: EachMessagePayload) => {
        const testMessage: TestMessage = {
          id: this.generateMessageId(),
          topic: payload.topic,
          partition: payload.partition,
          key: payload.message.key?.toString(),
          value: JSON.parse(payload.message.value?.toString() || '{}'),
          headers: this.parseKafkaHeaders(payload.message.headers),
          timestamp: new Date(Number(payload.message.timestamp)),
        };

        await this.processMessage(testMessage, handler);
      },
    });

    this.consumers.set(`${topic}-${groupId}`, consumer);
  }

  private async processMessage(
    message: TestMessage,
    handler: (message: TestMessage) => Promise<void>
  ): Promise<void> {
    const startTime = Date.now();
    this.metrics.messagesReceived++;

    if (this.config.recordMessages) {
      this.messageHistory.push(message);
    }

    try {
      // Simulate processing failures
      if (this.shouldSimulateFailure()) {
        throw new Error('Simulated processing failure');
      }

      await handler(message);

      const processingTime = Date.now() - startTime;
      message.metadata = { ...message.metadata, processingTime };
      
      this.metrics.messagesProcessed++;
      this.updateAvgProcessingTime(processingTime);
      
      this.emit('messageProcessed', message);
      this.checkExpectations(message);
    } catch (error) {
      this.metrics.messagesFailed++;
      message.metadata = {
        ...message.metadata,
        error: (error as Error).message,
        processingTime: Date.now() - startTime,
      };
      
      this.emit('messageError', { message, error });
      throw error;
    }
  }

  async expectMessage(expectation: MessageExpectation): Promise<TestMessage> {
    const expectationId = `${expectation.topic}-${Date.now()}`;
    this.expectations.set(expectationId, expectation);

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.expectations.delete(expectationId);
        reject(new Error(`Timeout waiting for message on topic ${expectation.topic}`));
      }, expectation.timeout);

      const checkExisting = () => {
        const found = this.messageHistory.find(msg => 
          msg.topic === expectation.topic && expectation.matcher(msg)
        );
        
        if (found) {
          clearTimeout(timeout);
          this.expectations.delete(expectationId);
          resolve(found);
          return true;
        }
        return false;
      };

      // Check existing messages first
      if (checkExisting()) return;

      // Set up listener for new messages
      const listener = (message: TestMessage) => {
        if (message.topic === expectation.topic && expectation.matcher(message)) {
          clearTimeout(timeout);
          this.expectations.delete(expectationId);
          this.removeListener('messageSent', listener);
          this.removeListener('messageProcessed', listener);
          resolve(message);
        }
      };

      this.on('messageSent', listener);
      this.on('messageProcessed', listener);
    });
  }

  async expectMessages(expectation: MessageExpectation & { count: number }): Promise<TestMessage[]> {
    const messages: TestMessage[] = [];
    const startTime = Date.now();

    while (messages.length < expectation.count) {
      const remainingTime = expectation.timeout - (Date.now() - startTime);
      if (remainingTime <= 0) {
        throw new Error(
          `Timeout: Expected ${expectation.count} messages, received ${messages.length}`
        );
      }

      try {
        const message = await this.expectMessage({
          ...expectation,
          timeout: remainingTime,
        });
        messages.push(message);
      } catch (error) {
        if (messages.length > 0) {
          throw new Error(
            `Expected ${expectation.count} messages, received ${messages.length}`
          );
        }
        throw error;
      }
    }

    return messages;
  }

  async waitForProcessing(timeout: number = 5000): Promise<void> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      const pending = this.metrics.messagesReceived - 
        (this.metrics.messagesProcessed + this.metrics.messagesFailed);
      
      if (pending === 0) {
        return;
      }
      
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    throw new Error('Timeout waiting for message processing to complete');
  }

  getMessageHistory(filter?: {
    topic?: string;
    since?: Date;
    matcher?: (message: TestMessage) => boolean;
  }): TestMessage[] {
    let messages = [...this.messageHistory];

    if (filter?.topic) {
      messages = messages.filter(m => m.topic === filter.topic);
    }

    if (filter?.since) {
      messages = messages.filter(m => m.timestamp >= filter.since);
    }

    if (filter?.matcher) {
      messages = messages.filter(filter.matcher);
    }

    return messages;
  }

  clearHistory(): void {
    this.messageHistory = [];
    this.emit('historyCleared');
  }

  getMetrics(): MessageQueueMetrics {
    return { ...this.metrics };
  }

  resetMetrics(): void {
    this.metrics = {
      messagesSent: 0,
      messagesReceived: 0,
      messagesProcessed: 0,
      messagesFailed: 0,
      avgProcessingTime: 0,
      totalBytes: 0,
    };
  }

  async simulateMessageDelay(topic: string, delay: number): Promise<void> {
    this.logger.info(`Simulating ${delay}ms delay for topic ${topic}`);
    
    if (this.config.testMode !== 'mock') {
      throw new Error('Message delay simulation only available in mock mode');
    }

    const queue = this.mockQueues.get(topic);
    if (!queue) return;

    const delayedMessages = [...queue];
    queue.length = 0;

    setTimeout(() => {
      for (const message of delayedMessages) {
        queue.push(message);
        const subscribers = this.mockSubscribers.get(topic);
        if (subscribers) {
          for (const subscriber of subscribers) {
            subscriber(message);
          }
        }
      }
    }, delay);
  }

  async simulateMessageLoss(topic: string, percentage: number): Promise<void> {
    this.logger.info(`Simulating ${percentage}% message loss for topic ${topic}`);
    
    if (this.config.testMode !== 'mock') {
      throw new Error('Message loss simulation only available in mock mode');
    }

    const queue = this.mockQueues.get(topic);
    if (!queue) return;

    const remainingMessages = queue.filter(() => Math.random() > percentage / 100);
    queue.length = 0;
    queue.push(...remainingMessages);
  }

  async cleanup(): Promise<void> {
    this.logger.info('Cleaning up message queue test helper');

    // Close Kafka connections
    if (this.producer) {
      await this.producer.disconnect();
    }

    for (const consumer of this.consumers.values()) {
      await consumer.disconnect();
    }

    // Close Redis connections
    if (this.redisPub) {
      this.redisPub.disconnect();
    }
    if (this.redisSub) {
      this.redisSub.disconnect();
    }

    // Clear mock queues
    this.mockQueues.clear();
    this.mockSubscribers.clear();

    // Clear state
    this.messageHistory = [];
    this.expectations.clear();
    this.resetMetrics();

    this.emit('cleanup');
  }

  // Helper methods

  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private randomDelay(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  private shouldSimulateFailure(): boolean {
    if (!this.config.simulateFailures) return false;
    return Math.random() < this.config.simulateFailures.probability;
  }

  private parseKafkaHeaders(headers?: Record<string, Buffer>): Record<string, string> {
    if (!headers) return {};
    
    const parsed: Record<string, string> = {};
    for (const [key, value] of Object.entries(headers)) {
      parsed[key] = value.toString();
    }
    return parsed;
  }

  private handleRedisMessage(channel: string, message: string): void {
    try {
      const parsedMessage = JSON.parse(message) as TestMessage;
      if (!parsedMessage.id) {
        parsedMessage.id = this.generateMessageId();
      }
      if (!parsedMessage.timestamp) {
        parsedMessage.timestamp = new Date();
      }
      
      this.emit('messageReceived', parsedMessage);
    } catch (error) {
      this.logger.error('Failed to parse Redis message:', error);
    }
  }

  private checkExpectations(message: TestMessage): void {
    for (const [id, expectation] of this.expectations) {
      if (message.topic === expectation.topic && expectation.matcher(message)) {
        this.emit('expectationMet', { id, message });
      }
    }
  }

  private updateAvgProcessingTime(newTime: number): void {
    const totalProcessed = this.metrics.messagesProcessed;
    const currentAvg = this.metrics.avgProcessingTime;
    this.metrics.avgProcessingTime = 
      (currentAvg * (totalProcessed - 1) + newTime) / totalProcessed;
  }

  // Utility methods for creating common matchers

  static createMessageMatcher(criteria: {
    key?: string;
    valueContains?: any;
    valueEquals?: any;
    headers?: Record<string, string>;
  }): (message: TestMessage) => boolean {
    return (message: TestMessage) => {
      if (criteria.key && message.key !== criteria.key) {
        return false;
      }

      if (criteria.valueEquals && 
          JSON.stringify(message.value) !== JSON.stringify(criteria.valueEquals)) {
        return false;
      }

      if (criteria.valueContains) {
        const messageStr = JSON.stringify(message.value);
        const containsStr = JSON.stringify(criteria.valueContains);
        if (!messageStr.includes(containsStr)) {
          return false;
        }
      }

      if (criteria.headers) {
        for (const [key, value] of Object.entries(criteria.headers)) {
          if (message.headers?.[key] !== value) {
            return false;
          }
        }
      }

      return true;
    };
  }
}