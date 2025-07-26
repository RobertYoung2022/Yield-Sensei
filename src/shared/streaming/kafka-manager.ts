import { Kafka, Producer, Consumer, Admin, KafkaConfig, ProducerConfig, ConsumerConfig } from 'kafkajs';
import { EventEmitter } from 'events';

// Configuration interfaces
export interface KafkaManagerConfig {
  clientId: string;
  brokers: string[];
  ssl?: boolean;
  sasl?: {
    mechanism: 'plain' | 'scram-sha-256' | 'scram-sha-512';
    username: string;
    password: string;
  };
  connectionTimeout?: number;
  requestTimeout?: number;
  retry?: {
    maxRetryTime?: number;
    initialRetryTime?: number;
    factor?: number;
    multiplier?: number;
    retries?: number;
  };
}

export interface TopicConfig {
  topic: string;
  numPartitions?: number;
  replicationFactor?: number;
  configEntries?: { name: string; value: string }[];
}

export interface ProducerMessage {
  topic: string;
  key?: string;
  value: string | Buffer;
  headers?: Record<string, string>;
  partition?: number;
  timestamp?: string;
}

export interface ConsumerSubscription {
  topics: string[];
  groupId: string;
  handler: (message: any) => Promise<void>;
  fromBeginning?: boolean;
  autoCommit?: boolean;
  sessionTimeout?: number;
  heartbeatInterval?: number;
}

// Logger interface
interface Logger {
  info(message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  error(message: string, ...args: any[]): void;
  debug(message: string, ...args: any[]): void;
}

class SimpleLogger implements Logger {
  constructor(private context: string) {}

  info(message: string, ...args: any[]): void {
    console.log(`[${this.context}] INFO:`, message, ...args);
  }

  warn(message: string, ...args: any[]): void {
    console.warn(`[${this.context}] WARN:`, message, ...args);
  }

  error(message: string, ...args: any[]): void {
    console.error(`[${this.context}] ERROR:`, message, ...args);
  }

  debug(message: string, ...args: any[]): void {
    console.debug(`[${this.context}] DEBUG:`, message, ...args);
  }
}

/**
 * Kafka Manager for YieldSensei Streaming Infrastructure
 * 
 * Provides high-level abstractions for Kafka operations including:
 * - Message production with automatic serialization
 * - Consumer group management with error handling
 * - Topic administration and monitoring
 * - DeFi-specific message routing and processing
 */
export class KafkaManager extends EventEmitter {
  private static instance: KafkaManager;
  private kafka: Kafka;
  private config: KafkaManagerConfig;
  private logger: Logger;
  private producer: Producer | null = null;
  private consumers: Map<string, Consumer> = new Map();
  private admin: Admin | null = null;
  private isConnected = false;

  // DeFi-specific topic configurations
  private readonly topicConfigs: Record<string, TopicConfig> = {
    'defi.protocols': {
      topic: 'defi.protocols',
      numPartitions: 12,
      replicationFactor: 3,
      configEntries: [
        { name: 'cleanup.policy', value: 'compact' },
        { name: 'retention.ms', value: '604800000' }, // 7 days
        { name: 'compression.type', value: 'snappy' }
      ]
    },
    'defi.tokens': {
      topic: 'defi.tokens',
      numPartitions: 12,
      replicationFactor: 3,
      configEntries: [
        { name: 'cleanup.policy', value: 'compact' },
        { name: 'retention.ms', value: '604800000' }
      ]
    },
    'defi.transactions': {
      topic: 'defi.transactions',
      numPartitions: 24,
      replicationFactor: 3,
      configEntries: [
        { name: 'cleanup.policy', value: 'delete' },
        { name: 'retention.ms', value: '2592000000' }, // 30 days
        { name: 'segment.ms', value: '86400000' } // 1 day
      ]
    },
    'market.prices': {
      topic: 'market.prices',
      numPartitions: 12,
      replicationFactor: 3,
      configEntries: [
        { name: 'cleanup.policy', value: 'compact' },
        { name: 'retention.ms', value: '86400000' } // 1 day for latest prices
      ]
    },
    'risk.alerts': {
      topic: 'risk.alerts',
      numPartitions: 6,
      replicationFactor: 3,
      configEntries: [
        { name: 'cleanup.policy', value: 'delete' },
        { name: 'retention.ms', value: '259200000' } // 3 days
      ]
    }
  };

  private constructor(config: KafkaManagerConfig) {
    super();
    this.config = config;
    this.logger = new SimpleLogger('KafkaManager');
    
    const kafkaConfig: KafkaConfig = {
      clientId: config.clientId,
      brokers: config.brokers,
      connectionTimeout: config.connectionTimeout || 3000,
      requestTimeout: config.requestTimeout || 30000,
      retry: config.retry || {
        maxRetryTime: 30000,
        initialRetryTime: 300,
        factor: 0.2,
        multiplier: 2,
        retries: 5
      }
    };

    if (config.ssl) {
      kafkaConfig.ssl = config.ssl;
    }

    if (config.sasl) {
      kafkaConfig.sasl = config.sasl as any;
    }

    this.kafka = new Kafka(kafkaConfig);
  }

  public static getInstance(config?: KafkaManagerConfig): KafkaManager {
    if (!KafkaManager.instance) {
      if (!config) {
        throw new Error('Kafka configuration is required for first initialization');
      }
      KafkaManager.instance = new KafkaManager(config);
    }
    return KafkaManager.instance;
  }

  /**
   * Connect to Kafka cluster and initialize components
   */
  public async connect(): Promise<void> {
    try {
      this.logger.info('Connecting to Kafka cluster...');
      
      // Initialize admin client
      this.admin = this.kafka.admin();
      await this.admin.connect();
      
      // Initialize producer
      this.producer = this.kafka.producer({
        maxInFlightRequests: 1,
        idempotent: true,
        transactionTimeout: 30000,
        retry: {
          maxRetryTime: 30000,
          initialRetryTime: 300,
          factor: 0.2,
          multiplier: 2,
          retries: 5
        }
      });
      await this.producer.connect();
      
      this.isConnected = true;
      this.logger.info('Successfully connected to Kafka cluster');
      this.emit('connected');
      
      // Create default topics if they don't exist
      await this.ensureTopicsExist();
      
    } catch (error) {
      this.logger.error('Failed to connect to Kafka:', error);
      this.isConnected = false;
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Health check for Kafka cluster
   */
  public async healthCheck(): Promise<{ status: string; metadata?: any }> {
    if (!this.isConnected || !this.admin) {
      return { status: 'disconnected' };
    }

    try {
      const metadata = await this.admin.fetchTopicMetadata();
             return { 
         status: 'healthy', 
         metadata: {
           topics: metadata.topics.length
         }
       };
    } catch (error) {
      this.logger.error('Health check failed:', error);
      return { status: 'error' };
    }
  }

  /**
   * Ensure all required topics exist
   */
  private async ensureTopicsExist(): Promise<void> {
    if (!this.admin) {
      throw new Error('Admin client not initialized');
    }

    try {
      const existingTopics = await this.admin.listTopics();
      const topicsToCreate = Object.values(this.topicConfigs)
        .filter(config => !existingTopics.includes(config.topic));

      if (topicsToCreate.length > 0) {
        this.logger.info(`Creating ${topicsToCreate.length} topics...`);
        
                 await this.admin.createTopics({
           topics: topicsToCreate.map(config => ({
             topic: config.topic,
             numPartitions: config.numPartitions || 12,
             replicationFactor: config.replicationFactor || 3,
             configEntries: config.configEntries || []
           }))
         });
        
        this.logger.info('Topics created successfully');
      }
    } catch (error) {
      this.logger.error('Failed to ensure topics exist:', error);
      throw error;
    }
  }

  /**
   * Produce a message to a topic
   */
  public async produce(message: ProducerMessage): Promise<void> {
    if (!this.producer) {
      throw new Error('Producer not initialized');
    }

    try {
             const result = await this.producer.send({
         topic: message.topic,
         messages: [{
           key: message.key || null,
           value: message.value,
           headers: message.headers,
           partition: message.partition,
           timestamp: message.timestamp
         }]
       });

      this.logger.debug(`Message sent to ${message.topic}:`, result);
    } catch (error) {
      this.logger.error(`Failed to produce message to ${message.topic}:`, error);
      throw error;
    }
  }

  /**
   * Produce multiple messages in a batch
   */
  public async produceBatch(messages: ProducerMessage[]): Promise<void> {
    if (!this.producer) {
      throw new Error('Producer not initialized');
    }

    try {
      // Group messages by topic for efficient batching
      const messagesByTopic = messages.reduce((acc, msg) => {
        if (!acc[msg.topic]) {
          acc[msg.topic] = [];
        }
        acc[msg.topic].push({
          key: msg.key,
          value: msg.value,
          headers: msg.headers,
          partition: msg.partition,
          timestamp: msg.timestamp
        });
        return acc;
      }, {} as Record<string, any[]>);

      const batches = Object.entries(messagesByTopic).map(([topic, messages]) => ({
        topic,
        messages
      }));

      await this.producer.sendBatch({ topicMessages: batches });
      this.logger.debug(`Batch of ${messages.length} messages sent successfully`);
    } catch (error) {
      this.logger.error('Failed to produce batch messages:', error);
      throw error;
    }
  }

  /**
   * Subscribe to topics with a consumer
   */
  public async subscribe(subscription: ConsumerSubscription): Promise<void> {
    try {
      const consumer = this.kafka.consumer({
        groupId: subscription.groupId,
        sessionTimeout: subscription.sessionTimeout || 30000,
        heartbeatInterval: subscription.heartbeatInterval || 3000,
        maxBytesPerPartition: 1048576, // 1MB
        retry: {
          maxRetryTime: 30000,
          initialRetryTime: 300,
          factor: 0.2,
          multiplier: 2,
          retries: 8
        }
      });

      await consumer.connect();
      await consumer.subscribe({ 
        topics: subscription.topics,
        fromBeginning: subscription.fromBeginning || false
      });

      await consumer.run({
        autoCommit: subscription.autoCommit !== false,
        eachMessage: async ({ topic, partition, message }) => {
          try {
            const messageData = {
              topic,
              partition,
              offset: message.offset,
              key: message.key?.toString(),
              value: message.value?.toString(),
              headers: message.headers,
              timestamp: message.timestamp
            };

            await subscription.handler(messageData);
          } catch (error) {
            this.logger.error(`Error processing message from ${topic}:`, error);
            this.emit('messageError', { topic, partition, error });
          }
        }
      });

      this.consumers.set(subscription.groupId, consumer);
      this.logger.info(`Subscribed to topics: ${subscription.topics.join(', ')} with group: ${subscription.groupId}`);
    } catch (error) {
      this.logger.error('Failed to subscribe to topics:', error);
      throw error;
    }
  }

  /**
   * Unsubscribe a consumer group
   */
  public async unsubscribe(groupId: string): Promise<void> {
    const consumer = this.consumers.get(groupId);
    if (consumer) {
      await consumer.disconnect();
      this.consumers.delete(groupId);
      this.logger.info(`Unsubscribed consumer group: ${groupId}`);
    }
  }

  /**
   * DeFi-specific helper: Produce protocol data
   */
  public async produceProtocolData(protocolData: {
    id: string;
    name: string;
    description: string;
    category: string;
    tvl: number;
    apy: number;
    riskScore: number;
  }): Promise<void> {
    await this.produce({
      topic: 'defi.protocols',
      key: protocolData.id,
      value: JSON.stringify({
        ...protocolData,
        timestamp: Date.now(),
        type: 'protocol_update'
      })
    });
  }

  /**
   * DeFi-specific helper: Produce transaction data
   */
  public async produceTransactionData(transactionData: {
    id: string;
    userId: string;
    protocolId: string;
    type: string;
    amount: number;
    tokenAddress: string;
    blockNumber: number;
    txHash: string;
  }): Promise<void> {
    await this.produce({
      topic: 'defi.transactions',
      key: transactionData.id,
      value: JSON.stringify({
        ...transactionData,
        timestamp: Date.now(),
        type: 'transaction'
      })
    });
  }

  /**
   * DeFi-specific helper: Produce market price data
   */
  public async produceMarketData(priceData: {
    tokenAddress: string;
    symbol: string;
    price: number;
    volume24h: number;
    marketCap: number;
    source: string;
  }): Promise<void> {
    await this.produce({
      topic: 'market.prices',
      key: priceData.tokenAddress,
      value: JSON.stringify({
        ...priceData,
        timestamp: Date.now(),
        type: 'price_update'
      })
    });
  }

  /**
   * DeFi-specific helper: Produce risk alert
   */
  public async produceRiskAlert(alertData: {
    userId: string;
    alertType: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    message: string;
    metadata: Record<string, any>;
  }): Promise<void> {
    await this.produce({
      topic: 'risk.alerts',
      key: `${alertData.userId}-${Date.now()}`,
      value: JSON.stringify({
        ...alertData,
        timestamp: Date.now(),
        type: 'risk_alert'
      })
    });
  }

  /**
   * Get topic metadata
   */
  public async getTopicMetadata(topic: string): Promise<any> {
    if (!this.admin) {
      throw new Error('Admin client not initialized');
    }

    try {
      const metadata = await this.admin.fetchTopicMetadata({ topics: [topic] });
      return metadata.topics.find(t => t.name === topic);
    } catch (error) {
      this.logger.error(`Failed to get metadata for topic ${topic}:`, error);
      throw error;
    }
  }

  /**
   * List all consumer groups
   */
  public async listConsumerGroups(): Promise<any> {
    if (!this.admin) {
      throw new Error('Admin client not initialized');
    }

    try {
      return await this.admin.listGroups();
    } catch (error) {
      this.logger.error('Failed to list consumer groups:', error);
      throw error;
    }
  }

  /**
   * Get consumer group offsets
   */
  public async getConsumerGroupOffsets(groupId: string): Promise<any> {
    if (!this.admin) {
      throw new Error('Admin client not initialized');
    }

    try {
      return await this.admin.fetchOffsets({ groupId });
    } catch (error) {
      this.logger.error(`Failed to get offsets for group ${groupId}:`, error);
      throw error;
    }
  }

  /**
   * Disconnect from Kafka
   */
  public async disconnect(): Promise<void> {
    try {
      // Disconnect all consumers
      for (const [groupId, consumer] of this.consumers) {
        await consumer.disconnect();
        this.logger.debug(`Disconnected consumer group: ${groupId}`);
      }
      this.consumers.clear();

      // Disconnect producer
      if (this.producer) {
        await this.producer.disconnect();
        this.producer = null;
      }

      // Disconnect admin
      if (this.admin) {
        await this.admin.disconnect();
        this.admin = null;
      }

      this.isConnected = false;
      this.logger.info('Disconnected from Kafka cluster');
      this.emit('disconnected');
    } catch (error) {
      this.logger.error('Error during disconnect:', error);
      throw error;
    }
  }

  /**
   * Check if connected to Kafka
   */
  public isConnectedToKafka(): boolean {
    return this.isConnected;
  }
}

export default KafkaManager; 