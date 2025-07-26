/**
 * Utils Tests
 * Comprehensive test suite for utility components
 */

import { RateLimiter } from '../utils/rate-limiter';
import { Cache } from '../utils/cache';
import { RetryPolicy, CircuitBreaker } from '../utils/retry-policy';

// Mock dependencies
jest.mock('@/shared/logging/logger');

describe('Utility Components', () => {
  describe('RateLimiter', () => {
    let rateLimiter: RateLimiter;

    beforeEach(() => {
      rateLimiter = new RateLimiter({
        maxRequestsPerMinute: 5,
        maxRequestsPerHour: 20,
        maxRequestsPerDay: 100,
        queueSize: 10
      });
    });

    afterEach(() => {
      rateLimiter.shutdown();
    });

    it('should allow requests within limits', async () => {
      const mockFn = jest.fn().mockResolvedValue('success');

      const result = await rateLimiter.execute(mockFn);

      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('should queue requests when rate limit exceeded', async () => {
      const mockFn = jest.fn().mockResolvedValue('success');

      // Fill up the rate limit
      const promises = Array(6).fill(null).map(() => 
        rateLimiter.execute(mockFn)
      );

      const results = await Promise.all(promises);

      expect(results).toHaveLength(6);
      expect(results.every(r => r === 'success')).toBe(true);
      expect(mockFn).toHaveBeenCalledTimes(6);
    });

    it('should reject when queue is full', async () => {
      const mockFn = jest.fn().mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 1000))
      );

      // Fill up rate limits and queue
      const promises = Array(20).fill(null).map(() => 
        rateLimiter.execute(mockFn)
      );

      // Some promises should be rejected
      const results = await Promise.allSettled(promises);
      const rejected = results.filter(r => r.status === 'rejected');

      expect(rejected.length).toBeGreaterThan(0);
    });

    it('should handle function execution errors', async () => {
      const mockFn = jest.fn().mockRejectedValue(new Error('Function error'));

      await expect(rateLimiter.execute(mockFn)).rejects.toThrow('Function error');
    });

    it('should provide accurate status information', () => {
      const status = rateLimiter.getStatus();

      expect(status).toHaveProperty('requestsThisMinute');
      expect(status).toHaveProperty('requestsThisHour');
      expect(status).toHaveProperty('requestsThisDay');
      expect(status).toHaveProperty('remainingMinute');
      expect(status).toHaveProperty('remainingHour');
      expect(status).toHaveProperty('remainingDay');
    });

    it('should update configuration', () => {
      const newConfig = {
        maxRequestsPerMinute: 10,
        maxRequestsPerHour: 50
      };

      rateLimiter.updateConfig(newConfig);

      const status = rateLimiter.getStatus();
      expect(status.remainingMinute).toBeLessThanOrEqual(10);
      expect(status.remainingHour).toBeLessThanOrEqual(50);
    });

    it('should clear queue', () => {
      const queueStatus = rateLimiter.getQueueStatus();
      rateLimiter.clearQueue();

      const newQueueStatus = rateLimiter.getQueueStatus();
      expect(newQueueStatus.size).toBe(0);
    });
  });

  describe('Cache', () => {
    let cache: Cache<string>;

    beforeEach(() => {
      cache = new Cache<string>({
        enabled: true,
        ttl: 1000, // 1 second for testing
        maxSize: 1, // 1 MB
        strategy: 'lru'
      });
    });

    afterEach(async () => {
      await cache.shutdown();
    });

    it('should store and retrieve values', async () => {
      await cache.set('key1', 'value1');
      const result = await cache.get('key1');

      expect(result).toBe('value1');
    });

    it('should return undefined for non-existent keys', async () => {
      const result = await cache.get('non-existent');
      expect(result).toBeUndefined();
    });

    it('should expire entries based on TTL', async () => {
      await cache.set('key1', 'value1', 100); // 100ms TTL

      // Should exist immediately
      let result = await cache.get('key1');
      expect(result).toBe('value1');

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 150));

      // Should be expired
      result = await cache.get('key1');
      expect(result).toBeUndefined();
    });

    it('should handle LRU eviction', async () => {
      // Set very small max size to trigger eviction
      const smallCache = new Cache<string>({
        enabled: true,
        ttl: 60000,
        maxSize: 0.001, // Very small size
        strategy: 'lru'
      });

      await smallCache.set('key1', 'value1');
      await smallCache.set('key2', 'value2');
      await smallCache.set('key3', 'value3');

      // First key should be evicted due to LRU
      const result1 = await smallCache.get('key1');
      const result3 = await smallCache.get('key3');

      expect(result1).toBeUndefined();
      expect(result3).toBe('value3');

      await smallCache.shutdown();
    });

    it('should delete entries', async () => {
      await cache.set('key1', 'value1');
      
      const deleted = cache.delete('key1');
      expect(deleted).toBe(true);

      const result = await cache.get('key1');
      expect(result).toBeUndefined();
    });

    it('should clear all entries', async () => {
      await cache.set('key1', 'value1');
      await cache.set('key2', 'value2');

      cache.clear();

      expect(await cache.get('key1')).toBeUndefined();
      expect(await cache.get('key2')).toBeUndefined();
    });

    it('should check if key exists', async () => {
      await cache.set('key1', 'value1');

      expect(cache.has('key1')).toBe(true);
      expect(cache.has('non-existent')).toBe(false);
    });

    it('should provide accurate statistics', async () => {
      await cache.set('key1', 'value1');
      await cache.get('key1'); // Cache hit
      await cache.get('non-existent'); // Cache miss

      const stats = cache.getStats();

      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);
      expect(stats.entryCount).toBe(1);
    });

    it('should generate consistent cache keys', () => {
      const key1 = cache.generateKey('test', { param: 'value' }, 123);
      const key2 = cache.generateKey('test', { param: 'value' }, 123);
      const key3 = cache.generateKey('test', { param: 'different' }, 123);

      expect(key1).toBe(key2);
      expect(key1).not.toBe(key3);
    });

    it('should get entry information', async () => {
      await cache.set('key1', 'value1');
      await cache.set('key2', 'value2');

      const entries = cache.getEntries();

      expect(entries).toHaveLength(2);
      expect(entries[0]).toHaveProperty('key');
      expect(entries[0]).toHaveProperty('size');
      expect(entries[0]).toHaveProperty('age');
      expect(entries[0]).toHaveProperty('accessCount');
    });
  });

  describe('RetryPolicy', () => {
    let retryPolicy: RetryPolicy;

    beforeEach(() => {
      retryPolicy = new RetryPolicy({
        maxRetries: 3,
        initialDelay: 10,
        maxDelay: 1000,
        backoffFactor: 2,
        jitterFactor: 0.1
      });
    });

    it('should succeed on first attempt', async () => {
      const mockFn = jest.fn().mockResolvedValue('success');

      const result = await retryPolicy.execute(mockFn);

      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('should retry on retryable errors', async () => {
      const mockFn = jest.fn()
        .mockRejectedValueOnce(new Error('ETIMEDOUT'))
        .mockRejectedValueOnce(new Error('ECONNRESET'))
        .mockResolvedValueOnce('success');

      const result = await retryPolicy.execute(mockFn);

      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledTimes(3);
    });

    it('should fail after max retries', async () => {
      const mockFn = jest.fn().mockRejectedValue(new Error('ETIMEDOUT'));

      await expect(retryPolicy.execute(mockFn)).rejects.toThrow('ETIMEDOUT');
      expect(mockFn).toHaveBeenCalledTimes(4); // 1 initial + 3 retries
    });

    it('should not retry non-retryable errors', async () => {
      const mockFn = jest.fn().mockRejectedValue(new Error('INVALID_INPUT'));

      await expect(retryPolicy.execute(mockFn)).rejects.toThrow('INVALID_INPUT');
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('should retry HTTP 429 errors', async () => {
      const httpError = {
        response: { status: 429 },
        message: 'Rate limit exceeded'
      };

      const mockFn = jest.fn()
        .mockRejectedValueOnce(httpError)
        .mockResolvedValueOnce('success');

      const result = await retryPolicy.execute(mockFn);

      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledTimes(2);
    });

    it('should emit retry events', async () => {
      const attemptSpy = jest.fn();
      const errorSpy = jest.fn();

      retryPolicy.on('retry-attempt', attemptSpy);
      retryPolicy.on('retry-error', errorSpy);

      const mockFn = jest.fn()
        .mockRejectedValueOnce(new Error('ETIMEDOUT'))
        .mockResolvedValueOnce('success');

      await retryPolicy.execute(mockFn);

      expect(attemptSpy).toHaveBeenCalledTimes(2);
      expect(errorSpy).toHaveBeenCalledTimes(1);
    });

    it('should update configuration', () => {
      const newConfig = {
        maxRetries: 5,
        initialDelay: 100
      };

      retryPolicy.updateConfig(newConfig);
      const config = retryPolicy.getConfig();

      expect(config.maxRetries).toBe(5);
      expect(config.initialDelay).toBe(100);
    });
  });

  describe('CircuitBreaker', () => {
    let circuitBreaker: CircuitBreaker;

    beforeEach(() => {
      circuitBreaker = new CircuitBreaker({
        failureThreshold: 3,
        successThreshold: 2,
        timeout: 100,
        resetTimeout: 200
      });
    });

    it('should execute successfully when closed', async () => {
      const mockFn = jest.fn().mockResolvedValue('success');

      const result = await circuitBreaker.execute(mockFn);

      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('should open after failure threshold', async () => {
      const mockFn = jest.fn().mockRejectedValue(new Error('Service error'));

      // Fail 3 times to trigger circuit opening
      await expect(circuitBreaker.execute(mockFn)).rejects.toThrow();
      await expect(circuitBreaker.execute(mockFn)).rejects.toThrow();
      await expect(circuitBreaker.execute(mockFn)).rejects.toThrow();

      // Circuit should now be open
      const state = circuitBreaker.getState();
      expect(state.state).toBe('open');
    });

    it('should reject immediately when open', async () => {
      const mockFn = jest.fn().mockRejectedValue(new Error('Service error'));

      // Trigger circuit opening
      for (let i = 0; i < 3; i++) {
        await expect(circuitBreaker.execute(mockFn)).rejects.toThrow();
      }

      // Reset mock to avoid confusion
      mockFn.mockClear();

      // Should reject immediately without calling function
      await expect(circuitBreaker.execute(mockFn)).rejects.toThrow('Circuit breaker is open');
      expect(mockFn).not.toHaveBeenCalled();
    });

    it('should transition to half-open after timeout', async () => {
      const mockFn = jest.fn().mockRejectedValue(new Error('Service error'));

      // Trigger circuit opening
      for (let i = 0; i < 3; i++) {
        await expect(circuitBreaker.execute(mockFn)).rejects.toThrow();
      }

      // Wait for timeout
      await new Promise(resolve => setTimeout(resolve, 150));

      // Mock successful response for half-open test
      mockFn.mockResolvedValueOnce('success');

      const result = await circuitBreaker.execute(mockFn);
      expect(result).toBe('success');
    });

    it('should close after successful executions in half-open state', async () => {
      const mockFn = jest.fn();

      // Trigger circuit opening
      mockFn.mockRejectedValue(new Error('Service error'));
      for (let i = 0; i < 3; i++) {
        await expect(circuitBreaker.execute(mockFn)).rejects.toThrow();
      }

      // Wait for timeout to enter half-open
      await new Promise(resolve => setTimeout(resolve, 150));

      // Succeed enough times to close circuit
      mockFn.mockResolvedValue('success');
      await circuitBreaker.execute(mockFn);
      await circuitBreaker.execute(mockFn);

      const state = circuitBreaker.getState();
      expect(state.state).toBe('closed');
    });

    it('should emit state change events', async () => {
      const stateChangeSpy = jest.fn();
      circuitBreaker.on('state-change', stateChangeSpy);

      const mockFn = jest.fn().mockRejectedValue(new Error('Service error'));

      // Trigger state changes
      for (let i = 0; i < 3; i++) {
        await expect(circuitBreaker.execute(mockFn)).rejects.toThrow();
      }

      expect(stateChangeSpy).toHaveBeenCalledWith({ state: 'open' });
    });

    it('should reset circuit breaker state', () => {
      const mockFn = jest.fn().mockRejectedValue(new Error('Service error'));

      // Open the circuit
      Promise.all([
        circuitBreaker.execute(mockFn).catch(() => {}),
        circuitBreaker.execute(mockFn).catch(() => {}),
        circuitBreaker.execute(mockFn).catch(() => {})
      ]);

      circuitBreaker.reset();

      const state = circuitBreaker.getState();
      expect(state.state).toBe('closed');
      expect(state.failureCount).toBe(0);
    });

    it('should provide accurate state information', () => {
      const state = circuitBreaker.getState();

      expect(state).toHaveProperty('state');
      expect(state).toHaveProperty('failureCount');
      expect(state).toHaveProperty('successCount');
      expect(['closed', 'open', 'half-open']).toContain(state.state);
      expect(typeof state.failureCount).toBe('number');
      expect(typeof state.successCount).toBe('number');
    });
  });
});