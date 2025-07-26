/**
 * Rate Limiter for Perplexity API
 * Implements token bucket algorithm with burst support
 */

import { EventEmitter } from 'events';
import { RateLimitConfig, RateLimitStatus } from '../types';
import Logger from '@/shared/logging/logger';

const logger = Logger.getLogger('perplexity-rate-limiter');

interface QueuedRequest {
  id: string;
  execute: () => Promise<any>;
  resolve: (value: any) => void;
  reject: (error: any) => void;
  priority: number;
  timestamp: Date;
}

export class RateLimiter extends EventEmitter {
  private config: RateLimitConfig;
  private tokens: Map<string, number> = new Map();
  private lastRefill: Map<string, Date> = new Map();
  private queue: QueuedRequest[] = [];
  private processing: boolean = false;
  private requestCounts: Map<string, number> = new Map();
  private windowStart: Map<string, Date> = new Map();

  constructor(config: RateLimitConfig) {
    super();
    this.config = config;
    this.initializeTokenBuckets();
    this.startRefillTimer();
  }

  private initializeTokenBuckets(): void {
    // Initialize token buckets for different time windows
    this.tokens.set('minute', this.config.maxRequestsPerMinute);
    this.tokens.set('hour', this.config.maxRequestsPerHour);
    this.tokens.set('day', this.config.maxRequestsPerDay);

    // Initialize refill timestamps
    const now = new Date();
    this.lastRefill.set('minute', now);
    this.lastRefill.set('hour', now);
    this.lastRefill.set('day', now);

    // Initialize request counts
    this.requestCounts.set('minute', 0);
    this.requestCounts.set('hour', 0);
    this.requestCounts.set('day', 0);

    // Initialize window starts
    this.windowStart.set('minute', now);
    this.windowStart.set('hour', now);
    this.windowStart.set('day', now);
  }

  private startRefillTimer(): void {
    // Refill tokens every second
    setInterval(() => {
      this.refillTokens();
      this.processQueue();
    }, 1000);
  }

  private refillTokens(): void {
    const now = new Date();

    // Refill minute tokens
    const minuteElapsed = now.getTime() - this.lastRefill.get('minute')!.getTime();
    if (minuteElapsed >= 60000) {
      this.tokens.set('minute', this.config.maxRequestsPerMinute);
      this.lastRefill.set('minute', now);
      this.requestCounts.set('minute', 0);
      this.windowStart.set('minute', now);
    }

    // Refill hour tokens
    const hourElapsed = now.getTime() - this.lastRefill.get('hour')!.getTime();
    if (hourElapsed >= 3600000) {
      this.tokens.set('hour', this.config.maxRequestsPerHour);
      this.lastRefill.set('hour', now);
      this.requestCounts.set('hour', 0);
      this.windowStart.set('hour', now);
    }

    // Refill day tokens
    const dayElapsed = now.getTime() - this.lastRefill.get('day')!.getTime();
    if (dayElapsed >= 86400000) {
      this.tokens.set('day', this.config.maxRequestsPerDay);
      this.lastRefill.set('day', now);
      this.requestCounts.set('day', 0);
      this.windowStart.set('day', now);
    }
  }

  async execute<T>(
    fn: () => Promise<T>,
    priority: number = 0
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const request: QueuedRequest = {
        id: `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        execute: fn,
        resolve,
        reject,
        priority,
        timestamp: new Date()
      };

      // Check if we can execute immediately
      if (this.canExecuteNow()) {
        this.executeRequest(request);
      } else {
        // Add to queue
        this.addToQueue(request);
        logger.debug('Request queued', {
          requestId: request.id,
          queueSize: this.queue.length,
          priority
        });
      }
    });
  }

  private canExecuteNow(): boolean {
    // Check if we have tokens in all buckets
    const hasMinuteTokens = this.tokens.get('minute')! > 0;
    const hasHourTokens = this.tokens.get('hour')! > 0;
    const hasDayTokens = this.tokens.get('day')! > 0;

    // Check burst mode
    if (this.config.enableBurstMode && this.config.burstLimit) {
      const currentBurst = this.requestCounts.get('minute')!;
      if (currentBurst < this.config.burstLimit) {
        return hasHourTokens && hasDayTokens;
      }
    }

    return hasMinuteTokens && hasHourTokens && hasDayTokens;
  }

  private async executeRequest(request: QueuedRequest): Promise<void> {
    try {
      // Consume tokens
      this.consumeTokens();

      // Emit event
      this.emit('request-started', {
        requestId: request.id,
        timestamp: new Date()
      });

      // Execute the request
      const result = await request.execute();
      request.resolve(result);

      // Emit event
      this.emit('request-completed', {
        requestId: request.id,
        timestamp: new Date()
      });
    } catch (error) {
      request.reject(error);

      // Emit event
      this.emit('request-failed', {
        requestId: request.id,
        error,
        timestamp: new Date()
      });
    }
  }

  private consumeTokens(): void {
    // Consume one token from each bucket
    this.tokens.set('minute', Math.max(0, this.tokens.get('minute')! - 1));
    this.tokens.set('hour', Math.max(0, this.tokens.get('hour')! - 1));
    this.tokens.set('day', Math.max(0, this.tokens.get('day')! - 1));

    // Increment request counts
    this.requestCounts.set('minute', this.requestCounts.get('minute')! + 1);
    this.requestCounts.set('hour', this.requestCounts.get('hour')! + 1);
    this.requestCounts.set('day', this.requestCounts.get('day')! + 1);
  }

  private addToQueue(request: QueuedRequest): void {
    // Check queue size limit
    if (this.queue.length >= this.config.queueSize) {
      request.reject(new Error('Rate limit queue is full'));
      return;
    }

    // Add to queue sorted by priority (higher priority first)
    const insertIndex = this.queue.findIndex(r => r.priority < request.priority);
    if (insertIndex === -1) {
      this.queue.push(request);
    } else {
      this.queue.splice(insertIndex, 0, request);
    }

    // Emit event
    this.emit('request-queued', {
      requestId: request.id,
      queueSize: this.queue.length,
      priority: request.priority
    });
  }

  private async processQueue(): Promise<void> {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;

    while (this.queue.length > 0 && this.canExecuteNow()) {
      const request = this.queue.shift()!;
      
      // Check if request has expired (older than 5 minutes)
      const age = Date.now() - request.timestamp.getTime();
      if (age > 300000) {
        request.reject(new Error('Request expired in queue'));
        continue;
      }

      await this.executeRequest(request);
    }

    this.processing = false;
  }

  getStatus(): RateLimitStatus {
    const now = new Date();
    
    return {
      requestsThisMinute: this.requestCounts.get('minute')!,
      requestsThisHour: this.requestCounts.get('hour')!,
      requestsThisDay: this.requestCounts.get('day')!,
      remainingMinute: this.tokens.get('minute')!,
      remainingHour: this.tokens.get('hour')!,
      remainingDay: this.tokens.get('day')!,
      nextResetMinute: new Date(this.windowStart.get('minute')!.getTime() + 60000),
      nextResetHour: new Date(this.windowStart.get('hour')!.getTime() + 3600000),
      nextResetDay: new Date(this.windowStart.get('day')!.getTime() + 86400000)
    };
  }

  getQueueStatus(): {
    size: number;
    oldestRequest?: Date;
    priorityDistribution: Record<number, number>;
  } {
    if (this.queue.length === 0) {
      return {
        size: 0,
        priorityDistribution: {}
      };
    }

    const priorityDist: Record<number, number> = {};
    this.queue.forEach(req => {
      priorityDist[req.priority] = (priorityDist[req.priority] || 0) + 1;
    });

    return {
      size: this.queue.length,
      oldestRequest: this.queue[this.queue.length - 1].timestamp,
      priorityDistribution: priorityDist
    };
  }

  clearQueue(): void {
    const queuedRequests = [...this.queue];
    this.queue = [];

    // Reject all queued requests
    queuedRequests.forEach(request => {
      request.reject(new Error('Queue cleared'));
    });

    logger.info('Rate limiter queue cleared', {
      clearedCount: queuedRequests.length
    });
  }

  updateConfig(config: Partial<RateLimitConfig>): void {
    this.config = { ...this.config, ...config };
    this.initializeTokenBuckets();
    
    logger.info('Rate limiter configuration updated', config);
  }

  shutdown(): void {
    this.clearQueue();
    this.removeAllListeners();
  }
}