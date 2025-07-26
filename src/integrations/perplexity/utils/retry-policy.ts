/**
 * Retry Policy for Perplexity API
 * Implements exponential backoff with jitter
 */

import { EventEmitter } from 'events';
import Logger from '@/shared/logging/logger';

const logger = Logger.getLogger('perplexity-retry');

export interface RetryConfig {
  maxRetries: number;
  initialDelay: number;
  maxDelay: number;
  backoffFactor: number;
  jitterFactor: number;
  retryableErrors?: string[];
  retryableStatusCodes?: number[];
}

export interface RetryContext {
  attempt: number;
  totalAttempts: number;
  error?: Error;
  delay: number;
  willRetry: boolean;
}

export class RetryPolicy extends EventEmitter {
  private config: RetryConfig;

  constructor(config: Partial<RetryConfig> = {}) {
    super();
    this.config = {
      maxRetries: 3,
      initialDelay: 1000,
      maxDelay: 30000,
      backoffFactor: 2,
      jitterFactor: 0.1,
      retryableErrors: [
        'ETIMEDOUT',
        'ECONNRESET',
        'ENOTFOUND',
        'ECONNREFUSED',
        'EAI_AGAIN'
      ],
      retryableStatusCodes: [408, 429, 500, 502, 503, 504],
      ...config
    };
  }

  async execute<T>(
    fn: () => Promise<T>,
    context?: { requestId?: string; operation?: string }
  ): Promise<T> {
    let lastError: Error | undefined;
    let attempt = 0;

    while (attempt <= this.config.maxRetries) {
      try {
        // Emit attempt event
        this.emit('retry-attempt', {
          attempt,
          totalAttempts: this.config.maxRetries + 1,
          context
        });

        // Execute the function
        const result = await fn();
        
        // Success - emit event and return
        if (attempt > 0) {
          this.emit('retry-success', {
            attempt,
            context
          });
        }
        
        return result;
      } catch (error) {
        lastError = error as Error;
        attempt++;

        // Check if we should retry
        const shouldRetry = this.shouldRetry(error, attempt);
        
        if (!shouldRetry) {
          this.emit('retry-exhausted', {
            attempt,
            error,
            context
          });
          throw error;
        }

        // Calculate delay with exponential backoff and jitter
        const delay = this.calculateDelay(attempt);
        
        // Emit retry event
        const retryContext: RetryContext = {
          attempt,
          totalAttempts: this.config.maxRetries + 1,
          error: error as Error,
          delay,
          willRetry: true
        };
        
        this.emit('retry-error', {
          ...retryContext,
          context
        });

        // Wait before retrying
        await this.delay(delay);
      }
    }

    // Should never reach here, but just in case
    throw lastError || new Error('Retry failed with unknown error');
  }

  private shouldRetry(error: any, attempt: number): boolean {
    // Check if we've exceeded max retries
    if (attempt > this.config.maxRetries) {
      return false;
    }

    // Check if error is retryable
    if (error.code && this.config.retryableErrors?.includes(error.code)) {
      return true;
    }

    // Check status code for HTTP errors
    if (error.response?.status && 
        this.config.retryableStatusCodes?.includes(error.response.status)) {
      return true;
    }

    // Check for rate limit errors
    if (error.response?.status === 429 || error.message?.includes('rate limit')) {
      return true;
    }

    // Check for timeout errors
    if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
      return true;
    }

    // Default to not retrying
    return false;
  }

  private calculateDelay(attempt: number): number {
    // Exponential backoff
    let delay = this.config.initialDelay * Math.pow(this.config.backoffFactor, attempt - 1);
    
    // Add jitter to prevent thundering herd
    const jitter = delay * this.config.jitterFactor * (Math.random() * 2 - 1);
    delay += jitter;
    
    // Cap at max delay
    delay = Math.min(delay, this.config.maxDelay);
    
    // Ensure minimum delay
    delay = Math.max(delay, this.config.initialDelay);
    
    return Math.round(delay);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  updateConfig(config: Partial<RetryConfig>): void {
    this.config = { ...this.config, ...config };
    logger.debug('Retry policy configuration updated', config);
  }

  getConfig(): RetryConfig {
    return { ...this.config };
  }
}

/**
 * Circuit Breaker for API calls
 * Prevents cascading failures by temporarily blocking calls
 */
export class CircuitBreaker extends EventEmitter {
  private state: 'closed' | 'open' | 'half-open' = 'closed';
  private failureCount: number = 0;
  private successCount: number = 0;
  private lastFailureTime?: Date;
  private nextAttemptTime?: Date;

  constructor(
    private config: {
      failureThreshold: number;
      successThreshold: number;
      timeout: number;
      resetTimeout: number;
    }
  ) {
    super();
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // Check circuit state
    if (this.state === 'open') {
      if (!this.canAttempt()) {
        throw new Error('Circuit breaker is open');
      }
      // Try half-open
      this.state = 'half-open';
      this.emit('state-change', { state: 'half-open' });
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private canAttempt(): boolean {
    if (!this.nextAttemptTime) return true;
    return new Date() >= this.nextAttemptTime;
  }

  private onSuccess(): void {
    this.failureCount = 0;
    
    if (this.state === 'half-open') {
      this.successCount++;
      
      if (this.successCount >= this.config.successThreshold) {
        this.state = 'closed';
        this.successCount = 0;
        this.emit('state-change', { state: 'closed' });
        logger.info('Circuit breaker closed');
      }
    }
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = new Date();
    
    if (this.state === 'half-open') {
      this.state = 'open';
      this.successCount = 0;
      this.nextAttemptTime = new Date(Date.now() + this.config.resetTimeout);
      this.emit('state-change', { state: 'open' });
      logger.warn('Circuit breaker opened');
    } else if (this.failureCount >= this.config.failureThreshold) {
      this.state = 'open';
      this.nextAttemptTime = new Date(Date.now() + this.config.timeout);
      this.emit('state-change', { state: 'open' });
      logger.warn('Circuit breaker opened');
    }
  }

  getState(): {
    state: string;
    failureCount: number;
    successCount: number;
    lastFailureTime?: Date;
    nextAttemptTime?: Date;
  } {
    const status: {
      state: string;
      failureCount: number;
      successCount: number;
      lastFailureTime?: Date;
      nextAttemptTime?: Date;
    } = {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount
    };
    
    if (this.lastFailureTime !== undefined) {
      status.lastFailureTime = this.lastFailureTime;
    }
    
    if (this.nextAttemptTime !== undefined) {
      status.nextAttemptTime = this.nextAttemptTime;
    }
    
    return status;
  }

  reset(): void {
    this.state = 'closed';
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = undefined as Date | undefined;
    this.nextAttemptTime = undefined as Date | undefined;
    this.emit('state-change', { state: 'closed' });
    logger.info('Circuit breaker reset');
  }
}