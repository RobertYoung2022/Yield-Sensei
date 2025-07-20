/**
 * YieldSensei Communication Protocol Implementation
 * Subtask 1.1: Communication Protocol Design
 * 
 * Defines and implements the inter-agent messaging protocols for the multi-agent system
 */

import { Message, MessageType, AgentId, ProtocolConfig, MessageError } from '@/types';
import Logger from '@/shared/logging/logger';
import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';

const logger = Logger.getLogger('protocol');

/**
 * Protocol version and configuration
 */
export const PROTOCOL_VERSION = '1.0.0';

export const DEFAULT_PROTOCOL_CONFIG: ProtocolConfig = {
  version: PROTOCOL_VERSION,
  encryption: true,
  compression: true,
  messageFormat: 'json',
  maxMessageSize: 10 * 1024 * 1024, // 10MB
  heartbeatInterval: 30000, // 30 seconds
  timeout: 5000, // 5 seconds
};

/**
 * Message validation schema
 */
export interface MessageSchema {
  required: string[];
  optional: string[];
  validation: {
    [key: string]: (value: any) => boolean;
  };
}

export const MESSAGE_SCHEMAS: Record<MessageType, MessageSchema> = {
  command: {
    required: ['action', 'params'],
    optional: ['timeout', 'callback'],
    validation: {
      action: (value) => typeof value === 'string' && value.length > 0,
      params: (value) => typeof value === 'object',
    }
  },
  query: {
    required: ['query', 'params'],
    optional: ['timeout'],
    validation: {
      query: (value) => typeof value === 'string' && value.length > 0,
      params: (value) => typeof value === 'object',
    }
  },
  response: {
    required: ['correlationId', 'status'],
    optional: ['data', 'error'],
    validation: {
      correlationId: (value) => typeof value === 'string',
      status: (value) => ['success', 'error', 'timeout'].includes(value),
    }
  },
  event: {
    required: ['eventType', 'data'],
    optional: ['source'],
    validation: {
      eventType: (value) => typeof value === 'string',
      data: (value) => typeof value === 'object',
    }
  },
  heartbeat: {
    required: ['timestamp', 'status'],
    optional: ['metrics'],
    validation: {
      timestamp: (value) => typeof value === 'string' || value instanceof Date,
      status: (value) => ['healthy', 'degraded', 'unhealthy'].includes(value),
    }
  },
  error: {
    required: ['errorCode', 'message'],
    optional: ['details', 'recoverable'],
    validation: {
      errorCode: (value) => typeof value === 'string',
      message: (value) => typeof value === 'string',
    }
  },
  data: {
    required: ['dataType', 'payload'],
    optional: ['metadata'],
    validation: {
      dataType: (value) => typeof value === 'string',
      payload: (value) => typeof value === 'object',
    }
  },
  notification: {
    required: ['title', 'message'],
    optional: ['severity', 'actions'],
    validation: {
      title: (value) => typeof value === 'string',
      message: (value) => typeof value === 'string',
    }
  },
};

/**
 * Message serialization/deserialization
 */
export class MessageSerializer {
  private config: ProtocolConfig;

  constructor(config: ProtocolConfig = DEFAULT_PROTOCOL_CONFIG) {
    this.config = config;
  }

  /**
   * Serialize a message for transmission
   */
  serialize(message: Message): Buffer {
    try {
      // Validate message
      this.validateMessage(message);

      // Convert to wire format
      const wireMessage = {
        ...message,
        timestamp: message.timestamp.toISOString(),
        protocol_version: this.config.version,
      };

      let serialized: Buffer;

      switch (this.config.messageFormat) {
        case 'json':
          serialized = Buffer.from(JSON.stringify(wireMessage), 'utf8');
          break;
        case 'protobuf':
          // TODO: Implement protobuf serialization
          throw new MessageError('Protobuf serialization not implemented', message.id, 'SERIALIZATION_ERROR');
        case 'msgpack':
          // TODO: Implement msgpack serialization
          throw new MessageError('MessagePack serialization not implemented', message.id, 'SERIALIZATION_ERROR');
        default:
          throw new MessageError(`Unsupported message format: ${this.config.messageFormat}`, message.id, 'INVALID_FORMAT');
      }

      // Check size limits
      if (serialized.length > this.config.maxMessageSize) {
        throw new MessageError(
          `Message size ${serialized.length} exceeds limit ${this.config.maxMessageSize}`,
          message.id,
          'MESSAGE_TOO_LARGE'
        );
      }

      // Apply compression if enabled
      if (this.config.compression) {
        serialized = this.compress(serialized);
      }

      // Apply encryption if enabled
      if (this.config.encryption) {
        serialized = this.encrypt(serialized);
      }

      return serialized;
    } catch (error) {
      logger.error('Failed to serialize message:', error);
      throw error;
    }
  }

  /**
   * Deserialize a message from transmission
   */
  deserialize(data: Buffer): Message {
    try {
      let processed = data;

      // Apply decryption if enabled
      if (this.config.encryption) {
        processed = this.decrypt(processed);
      }

      // Apply decompression if enabled
      if (this.config.compression) {
        processed = this.decompress(processed);
      }

      let messageData: any;

      switch (this.config.messageFormat) {
        case 'json':
          messageData = JSON.parse(processed.toString('utf8'));
          break;
        case 'protobuf':
          // TODO: Implement protobuf deserialization
          throw new MessageError('Protobuf deserialization not implemented', 'unknown', 'DESERIALIZATION_ERROR');
        case 'msgpack':
          // TODO: Implement msgpack deserialization
          throw new MessageError('MessagePack deserialization not implemented', 'unknown', 'DESERIALIZATION_ERROR');
        default:
          throw new MessageError(`Unsupported message format: ${this.config.messageFormat}`, 'unknown', 'INVALID_FORMAT');
      }

      // Convert back to Message format
      const message: Message = {
        ...messageData,
        timestamp: new Date(messageData.timestamp),
      };

      // Validate deserialized message
      this.validateMessage(message);

      return message;
    } catch (error) {
      logger.error('Failed to deserialize message:', error);
      throw error;
    }
  }

  /**
   * Validate message structure and content
   */
  private validateMessage(message: Message): void {
    // Basic structure validation
    if (!message.id || !message.type || !message.from || !message.to || !message.timestamp) {
      throw new MessageError('Message missing required fields', message.id || 'unknown', 'INVALID_MESSAGE');
    }

    // Type-specific validation
    const schema = MESSAGE_SCHEMAS[message.type];
    if (!schema) {
      throw new MessageError(`Unknown message type: ${message.type}`, message.id, 'INVALID_MESSAGE_TYPE');
    }

    // Check required fields
    for (const field of schema.required) {
      if (!(field in message.payload)) {
        throw new MessageError(`Missing required field: ${field}`, message.id, 'MISSING_FIELD');
      }
    }

    // Run field validation
    for (const [field, validator] of Object.entries(schema.validation)) {
      if (field in message.payload && !validator(message.payload[field])) {
        throw new MessageError(`Invalid field value: ${field}`, message.id, 'INVALID_FIELD');
      }
    }
  }

  /**
   * Compress data (placeholder - implement with zlib or similar)
   */
  private compress(data: Buffer): Buffer {
    // TODO: Implement compression
    return data;
  }

  /**
   * Decompress data (placeholder - implement with zlib or similar)
   */
  private decompress(data: Buffer): Buffer {
    // TODO: Implement decompression
    return data;
  }

  /**
   * Encrypt data (placeholder - implement with crypto)
   */
  private encrypt(data: Buffer): Buffer {
    // TODO: Implement encryption
    return data;
  }

  /**
   * Decrypt data (placeholder - implement with crypto)
   */
  private decrypt(data: Buffer): Buffer {
    // TODO: Implement decryption
    return data;
  }
}

/**
 * Protocol manager for handling message routing and delivery
 */
export class ProtocolManager extends EventEmitter {
  private config: ProtocolConfig;
  public serializer: MessageSerializer;
  private messageHistory: Map<string, Message> = new Map();
  private responseCallbacks: Map<string, (message: Message) => void> = new Map();

  constructor(config: ProtocolConfig = DEFAULT_PROTOCOL_CONFIG) {
    super();
    this.config = config;
    this.serializer = new MessageSerializer(config);
  }

  /**
   * Create a new message
   */
  createMessage(
    type: MessageType,
    from: AgentId,
    to: AgentId | 'broadcast',
    payload: any,
    options: {
      priority?: Message['priority'];
      correlationId?: string;
      ttl?: number;
    } = {}
  ): Message {
    const message: Message = {
      id: randomUUID(),
      type,
      from,
      to,
      timestamp: new Date(),
      payload,
      priority: options.priority || 'medium',
    };

    if (options.correlationId) {
      message.correlationId = options.correlationId;
    }
    if (options.ttl) {
      message.ttl = options.ttl;
    }

    // Store in history
    this.messageHistory.set(message.id, message);

    return message;
  }

  /**
   * Send a message and optionally wait for response
   */
  async sendMessage(message: Message, expectResponse: boolean = false): Promise<Message | void> {
    try {
      logger.debug(`Sending message ${message.id} from ${message.from} to ${message.to}`);

      // Serialize message
      const serialized = this.serializer.serialize(message);

      // Emit for transport layer to handle
      this.emit('message_send', { message, serialized });

      // If expecting response, wait for it
      if (expectResponse) {
        return new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            this.responseCallbacks.delete(message.id);
            reject(new MessageError(`Response timeout for message ${message.id}`, message.id, 'TIMEOUT'));
          }, this.config.timeout);

          this.responseCallbacks.set(message.id, (response: Message) => {
            clearTimeout(timeout);
            resolve(response);
          });
        });
      }
    } catch (error) {
      logger.error(`Failed to send message ${message.id}:`, error);
      throw error;
    }
  }

  /**
   * Handle incoming message
   */
  handleIncomingMessage(data: Buffer): void {
    try {
      const message = this.serializer.deserialize(data);
      
      logger.debug(`Received message ${message.id} from ${message.from} to ${message.to}`);

      // Check TTL
      if (message.ttl && Date.now() - message.timestamp.getTime() > message.ttl) {
        logger.warn(`Message ${message.id} expired, dropping`);
        return;
      }

      // Handle response messages
      if (message.type === 'response' && message.correlationId) {
        const callback = this.responseCallbacks.get(message.correlationId);
        if (callback) {
          this.responseCallbacks.delete(message.correlationId);
          callback(message);
          return;
        }
      }

      // Emit for agent layer to handle
      this.emit('message_received', message);
    } catch (error) {
      logger.error('Failed to handle incoming message:', error);
      this.emit('protocol_error', error);
    }
  }

  /**
   * Create a response message
   */
  createResponse(
    originalMessage: Message,
    from: AgentId,
    status: 'success' | 'error' | 'timeout',
    data?: any,
    error?: string
  ): Message {
    return this.createMessage(
      'response',
      from,
      originalMessage.from,
      {
        correlationId: originalMessage.id,
        status,
        data,
        error,
      },
      {
        priority: originalMessage.priority,
        correlationId: originalMessage.id,
      }
    );
  }

  /**
   * Get protocol statistics
   */
  getStats() {
    return {
      messagesProcessed: this.messageHistory.size,
      pendingResponses: this.responseCallbacks.size,
      protocolVersion: this.config.version,
      config: this.config,
    };
  }
}

/**
 * Export protocol constants and utilities
 */
export const PROTOCOL_CONSTANTS = {
  VERSION: PROTOCOL_VERSION,
  MAX_RETRIES: 3,
  HEARTBEAT_TIMEOUT: 60000, // 1 minute
  BROADCAST_ADDRESS: 'broadcast' as const,
  SYSTEM_AGENT_ID: 'system' as const,
};

export { DEFAULT_PROTOCOL_CONFIG as ProtocolConfig };