/**
 * Message validation utilities for protocol communication
 * Provides runtime type validation and type guards for messages
 */

import { 
  Message, 
  MessageType, 
  AgentId, 
  MessageError,
  MessageEnvelope 
} from '@/types';

/**
 * Type guard for Message interface
 */
export function isValidMessage(value: unknown): value is Message {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const msg = value as Record<string, unknown>;

  return (
    typeof msg['id'] === 'string' &&
    isValidMessageType(msg['type']) &&
    isValidAgentId(msg['from']) &&
    (isValidAgentId(msg['to']) || msg['to'] === 'broadcast') &&
    msg['timestamp'] instanceof Date &&
    msg['payload'] !== undefined &&
    isValidPriority(msg['priority']) &&
    (msg['correlationId'] === undefined || typeof msg['correlationId'] === 'string') &&
    (msg['ttl'] === undefined || typeof msg['ttl'] === 'number')
  );
}

/**
 * Type guard for MessageType
 */
export function isValidMessageType(value: unknown): value is MessageType {
  return typeof value === 'string' && [
    'command',
    'query',
    'response',
    'event',
    'heartbeat',
    'error',
    'data',
    'notification'
  ].includes(value);
}

/**
 * Type guard for AgentId
 */
export function isValidAgentId(value: unknown): value is AgentId {
  return typeof value === 'string' && value.length > 0;
}

/**
 * Type guard for message priority
 */
export function isValidPriority(value: unknown): value is Message['priority'] {
  return typeof value === 'string' && 
    ['low', 'medium', 'high', 'critical'].includes(value);
}

/**
 * Type guard for MessageEnvelope
 */
export function isValidMessageEnvelope(value: unknown): value is MessageEnvelope {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const envelope = value as Record<string, unknown>;

  return (
    isValidMessage(envelope['message']) &&
    typeof envelope['retryCount'] === 'number' &&
    typeof envelope['maxRetries'] === 'number' &&
    Array.isArray(envelope['deliveryAttempts']) &&
    (envelope['deliveryAttempts'] as unknown[]).every((d: unknown) => d instanceof Date)
  );
}

/**
 * Validate message payload based on message type
 */
export function validateMessagePayload(
  type: MessageType, 
  payload: unknown
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!payload || typeof payload !== 'object') {
    return { valid: false, errors: ['Payload must be an object'] };
  }

  const p = payload as Record<string, unknown>;

  switch (type) {
    case 'command':
      if (typeof p['action'] !== 'string' || (p['action'] as string).length === 0) {
        errors.push('Command message must have a non-empty action string');
      }
      if (!p['params'] || typeof p['params'] !== 'object') {
        errors.push('Command message must have params object');
      }
      break;

    case 'query':
      if (typeof p['query'] !== 'string' || (p['query'] as string).length === 0) {
        errors.push('Query message must have a non-empty query string');
      }
      if (!p['params'] || typeof p['params'] !== 'object') {
        errors.push('Query message must have params object');
      }
      break;

    case 'response':
      if (typeof p['correlationId'] !== 'string') {
        errors.push('Response message must have correlationId string');
      }
      if (!['success', 'error', 'timeout'].includes(p['status'] as string)) {
        errors.push('Response message status must be success, error, or timeout');
      }
      break;

    case 'event':
      if (typeof p['eventType'] !== 'string') {
        errors.push('Event message must have eventType string');
      }
      if (p['data'] === undefined) {
        errors.push('Event message must have data property');
      }
      break;

    case 'heartbeat':
      if (!p['timestamp'] || (!(p['timestamp'] instanceof Date) && typeof p['timestamp'] !== 'string')) {
        errors.push('Heartbeat message must have timestamp');
      }
      if (!['healthy', 'degraded', 'unhealthy'].includes(p['status'] as string)) {
        errors.push('Heartbeat status must be healthy, degraded, or unhealthy');
      }
      break;

    case 'error':
      if (typeof p['errorCode'] !== 'string') {
        errors.push('Error message must have errorCode string');
      }
      if (typeof p['message'] !== 'string') {
        errors.push('Error message must have message string');
      }
      break;

    case 'data':
      if (typeof p['dataType'] !== 'string') {
        errors.push('Data message must have dataType string');
      }
      if (p['payload'] === undefined) {
        errors.push('Data message must have payload property');
      }
      break;

    case 'notification':
      if (typeof p['title'] !== 'string') {
        errors.push('Notification message must have title string');
      }
      if (typeof p['message'] !== 'string') {
        errors.push('Notification message must have message string');
      }
      break;
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Create a validated message
 */
export function createValidatedMessage(
  type: MessageType,
  from: AgentId,
  to: AgentId | 'broadcast',
  payload: unknown,
  options: {
    id?: string;
    priority?: Message['priority'];
    correlationId?: string;
    ttl?: number;
  } = {}
): Message {
  // Validate payload
  const validation = validateMessagePayload(type, payload);
  if (!validation.valid) {
    throw new MessageError(
      `Invalid payload for ${type} message: ${validation.errors.join(', ')}`,
      options.id || 'unknown',
      'INVALID_PAYLOAD'
    );
  }

  const message: Message = {
    id: options.id || generateMessageId(),
    type,
    from,
    to,
    timestamp: new Date(),
    payload,
    priority: options.priority || 'medium'
  };

  if (options.correlationId) {
    message.correlationId = options.correlationId;
  }

  if (options.ttl) {
    message.ttl = options.ttl;
  }

  return message;
}

/**
 * Generate a unique message ID
 */
function generateMessageId(): string {
  return `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Safe message parsing with validation
 */
export function parseMessage(data: string | Buffer): Message {
  try {
    const parsed = typeof data === 'string' 
      ? JSON.parse(data) 
      : JSON.parse(data.toString('utf8'));

    // Convert timestamp string back to Date
    if (parsed['timestamp']) {
      parsed['timestamp'] = new Date(parsed['timestamp'] as string);
    }

    if (!isValidMessage(parsed)) {
      throw new MessageError(
        'Parsed data is not a valid Message',
        (parsed['id'] as string) || 'unknown',
        'INVALID_MESSAGE_FORMAT'
      );
    }

    return parsed;
  } catch (error) {
    if (error instanceof MessageError) {
      throw error;
    }
    throw new MessageError(
      `Failed to parse message: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'unknown',
      'PARSE_ERROR'
    );
  }
}

/**
 * Export validation utilities
 */
export const MessageValidator = {
  isValidMessage,
  isValidMessageType,
  isValidAgentId,
  isValidPriority,
  isValidMessageEnvelope,
  validateMessagePayload,
  createValidatedMessage,
  parseMessage
};