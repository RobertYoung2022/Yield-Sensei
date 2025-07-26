/**
 * Async message handling utilities for protocol communication
 * Provides typed async patterns for message handling
 */

import { 
  Message, 
  MessageType, 
  AgentId, 
  MessageError,
  SatelliteAgent 
} from '@/types';
import { EventEmitter } from 'events';
import Logger from '@/shared/logging/logger';

const logger = Logger.getLogger('async-message-handler');

/**
 * Message handler function type
 */
export type MessageHandler<T = any> = (
  message: Message,
  agent: SatelliteAgent
) => Promise<T>;

/**
 * Message filter function type
 */
export type MessageFilter = (message: Message) => boolean;

/**
 * Response handler options
 */
export interface ResponseHandlerOptions {
  timeout?: number;
  retryCount?: number;
  retryDelay?: number;
}

/**
 * Async message response
 */
export interface AsyncMessageResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  duration: number;
}

/**
 * Message handler registry
 */
export class MessageHandlerRegistry {
  private handlers = new Map<MessageType, MessageHandler[]>();
  private filters = new Map<string, MessageFilter>();

  /**
   * Register a message handler
   */
  register<T = any>(
    type: MessageType,
    handler: MessageHandler<T>,
    filter?: MessageFilter
  ): void {
    const handlers = this.handlers.get(type) || [];
    handlers.push(handler);
    this.handlers.set(type, handlers);

    if (filter) {
      const filterId = `${type}-${handlers.length}`;
      this.filters.set(filterId, filter);
    }
  }

  /**
   * Get handlers for a message type
   */
  getHandlers(type: MessageType, message: Message): MessageHandler[] {
    const handlers = this.handlers.get(type) || [];
    return handlers.filter((_, index) => {
      const filterId = `${type}-${index + 1}`;
      const filter = this.filters.get(filterId);
      return !filter || filter(message);
    });
  }

  /**
   * Clear all handlers
   */
  clear(): void {
    this.handlers.clear();
    this.filters.clear();
  }
}

/**
 * Async message processor
 */
export class AsyncMessageProcessor extends EventEmitter {
  private registry = new MessageHandlerRegistry();
  private pendingResponses = new Map<string, {
    resolve: (value: any) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
  }>();

  /**
   * Process a message asynchronously
   */
  async processMessage(
    message: Message,
    agent: SatelliteAgent
  ): Promise<AsyncMessageResponse> {
    const startTime = Date.now();

    try {
      const handlers = this.registry.getHandlers(message.type, message);
      
      if (handlers.length === 0) {
        logger.warn(`No handlers registered for message type: ${message.type}`);
        return {
          success: false,
          error: `No handlers for message type: ${message.type}`,
          duration: Date.now() - startTime
        };
      }

      // Execute handlers in parallel
      const results = await Promise.allSettled(
        handlers.map(handler => this.executeHandler(handler, message, agent))
      );

      // Collect successful results
      const successfulResults = results
        .filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled')
        .map(r => r.value);

      // Log failures
      results
        .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
        .forEach(r => {
          logger.error('Handler failed:', r.reason);
        });

      return {
        success: successfulResults.length > 0,
        data: successfulResults.length === 1 ? successfulResults[0] : successfulResults,
        duration: Date.now() - startTime
      };
    } catch (error) {
      logger.error('Message processing failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime
      };
    }
  }

  /**
   * Execute a single handler with error handling
   */
  private async executeHandler(
    handler: MessageHandler,
    message: Message,
    agent: SatelliteAgent
  ): Promise<any> {
    try {
      return await handler(message, agent);
    } catch (error) {
      logger.error(`Handler error for message ${message.id}:`, error);
      throw error;
    }
  }

  /**
   * Send message and wait for response
   */
  async sendAndWaitForResponse<T = any>(
    message: Message,
    sendFn: (msg: Message) => Promise<void>,
    options: ResponseHandlerOptions = {}
  ): Promise<T> {
    const { 
      timeout = 5000, 
      retryCount = 0, 
      retryDelay = 1000 
    } = options;

    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= retryCount; attempt++) {
      try {
        if (attempt > 0) {
          logger.info(`Retry attempt ${attempt} for message ${message.id}`);
          await this.delay(retryDelay);
        }

        return await this.sendWithTimeout<T>(message, sendFn, timeout);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        logger.warn(`Attempt ${attempt + 1} failed:`, lastError);
      }
    }

    throw lastError || new Error('Failed to send message');
  }

  /**
   * Send message with timeout
   */
  private async sendWithTimeout<T>(
    message: Message,
    sendFn: (msg: Message) => Promise<void>,
    timeout: number
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timeoutHandle = setTimeout(() => {
        this.pendingResponses.delete(message.id);
        reject(new MessageError(
          `Response timeout for message ${message.id}`,
          message.id,
          'TIMEOUT'
        ));
      }, timeout);

      this.pendingResponses.set(message.id, {
        resolve,
        reject,
        timeout: timeoutHandle
      });

      sendFn(message).catch(error => {
        clearTimeout(timeoutHandle);
        this.pendingResponses.delete(message.id);
        reject(error);
      });
    });
  }

  /**
   * Handle incoming response
   */
  handleResponse(message: Message): void {
    if (message.type !== 'response' || !message.payload.correlationId) {
      return;
    }

    const pending = this.pendingResponses.get(message.payload.correlationId);
    if (!pending) {
      return;
    }

    clearTimeout(pending.timeout);
    this.pendingResponses.delete(message.payload.correlationId);

    if (message.payload.status === 'success') {
      pending.resolve(message.payload.data);
    } else {
      pending.reject(new MessageError(
        message.payload.error || 'Response error',
        message.id,
        'RESPONSE_ERROR'
      ));
    }
  }

  /**
   * Register a typed message handler
   */
  registerHandler<T = any>(
    type: MessageType,
    handler: MessageHandler<T>,
    filter?: MessageFilter
  ): void {
    this.registry.register(type, handler, filter);
  }

  /**
   * Delay utility
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Clear pending responses
   */
  clearPending(): void {
    this.pendingResponses.forEach(({ timeout }) => clearTimeout(timeout));
    this.pendingResponses.clear();
  }
}

/**
 * Create typed message handler
 */
export function createTypedHandler<TPayload, TResponse>(
  payloadValidator: (payload: unknown) => payload is TPayload,
  handler: (payload: TPayload, message: Message, agent: SatelliteAgent) => Promise<TResponse>
): MessageHandler<TResponse> {
  return async (message: Message, agent: SatelliteAgent) => {
    if (!payloadValidator(message.payload)) {
      throw new MessageError(
        'Invalid payload type',
        message.id,
        'INVALID_PAYLOAD_TYPE'
      );
    }
    return handler(message.payload, message, agent);
  };
}

/**
 * Create message filter by agent ID
 */
export function createAgentFilter(agentIds: AgentId[]): MessageFilter {
  const idSet = new Set(agentIds);
  return (message: Message) => idSet.has(message.from);
}

/**
 * Create message filter by priority
 */
export function createPriorityFilter(
  minPriority: Message['priority']
): MessageFilter {
  const priorityOrder = { low: 0, medium: 1, high: 2, critical: 3 };
  const minLevel = priorityOrder[minPriority];
  
  return (message: Message) => {
    const messageLevel = priorityOrder[message.priority];
    return messageLevel >= minLevel;
  };
}

/**
 * Export async utilities
 */
export const AsyncMessageUtils = {
  createTypedHandler,
  createAgentFilter,
  createPriorityFilter
};