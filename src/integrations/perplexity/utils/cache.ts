/**
 * Cache Implementation for Perplexity API
 * Supports multiple caching strategies with optional disk persistence
 */

import { EventEmitter } from 'events';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import { CacheConfig } from '../types';
import Logger from '@/shared/logging/logger';

const logger = Logger.getLogger('perplexity-cache');

interface CacheEntry<T> {
  key: string;
  value: T;
  timestamp: Date;
  expiresAt: Date;
  size: number;
  accessCount: number;
  lastAccessTime: Date;
  metadata?: Record<string, any>;
}

interface CacheStats {
  hits: number;
  misses: number;
  evictions: number;
  size: number;
  entryCount: number;
}

export class Cache<T = any> extends EventEmitter {
  private config: CacheConfig;
  private cache: Map<string, CacheEntry<T>> = new Map();
  private accessOrder: string[] = []; // For LRU
  private accessCounts: Map<string, number> = new Map(); // For LFU
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    evictions: 0,
    size: 0,
    entryCount: 0
  };
  private persistenceTimer?: NodeJS.Timeout;

  constructor(config: CacheConfig) {
    super();
    this.config = config;
    
    if (config.persistToDisk) {
      this.startPersistenceTimer();
      this.loadFromDisk().catch(error => {
        logger.error('Failed to load cache from disk:', error);
      });
    }
  }

  async get(key: string): Promise<T | undefined> {
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.stats.misses++;
      this.emit('cache-miss', { key });
      return undefined;
    }

    // Check if expired
    if (entry.expiresAt.getTime() < Date.now()) {
      this.delete(key);
      this.stats.misses++;
      this.emit('cache-miss', { key, reason: 'expired' });
      return undefined;
    }

    // Update access info
    entry.accessCount++;
    entry.lastAccessTime = new Date();
    this.updateAccessTracking(key);

    this.stats.hits++;
    this.emit('cache-hit', { key });
    
    return entry.value;
  }

  async set(
    key: string, 
    value: T, 
    ttl?: number,
    metadata?: Record<string, any>
  ): Promise<void> {
    const effectiveTTL = ttl || this.config.ttl;
    const size = this.calculateSize(value);
    
    // Check if we need to evict entries
    await this.ensureCapacity(size);

    const entry: CacheEntry<T> = {
      key,
      value,
      timestamp: new Date(),
      expiresAt: new Date(Date.now() + effectiveTTL),
      size,
      accessCount: 1,
      lastAccessTime: new Date(),
      ...(metadata !== undefined && { metadata })
    };

    // Remove old entry if exists
    if (this.cache.has(key)) {
      this.delete(key);
    }

    this.cache.set(key, entry);
    this.updateAccessTracking(key);
    this.stats.size += size;
    this.stats.entryCount++;

    this.emit('cache-set', { key, size, ttl: effectiveTTL });
  }

  delete(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    this.cache.delete(key);
    this.stats.size -= entry.size;
    this.stats.entryCount--;
    
    // Remove from tracking
    this.removeFromAccessTracking(key);
    
    this.emit('cache-delete', { key });
    return true;
  }

  clear(): void {
    const previousSize = this.stats.size;
    const previousCount = this.stats.entryCount;
    
    this.cache.clear();
    this.accessOrder = [];
    this.accessCounts.clear();
    this.stats.size = 0;
    this.stats.entryCount = 0;
    
    this.emit('cache-clear', { 
      previousSize, 
      previousCount 
    });
  }

  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    
    // Check if expired
    if (entry.expiresAt.getTime() < Date.now()) {
      this.delete(key);
      return false;
    }
    
    return true;
  }

  getStats(): CacheStats {
    return { ...this.stats };
  }

  getEntries(): Array<{
    key: string;
    size: number;
    age: number;
    accessCount: number;
    expiresIn: number;
  }> {
    const now = Date.now();
    return Array.from(this.cache.entries()).map(([key, entry]) => ({
      key,
      size: entry.size,
      age: now - entry.timestamp.getTime(),
      accessCount: entry.accessCount,
      expiresIn: Math.max(0, entry.expiresAt.getTime() - now)
    }));
  }

  private updateAccessTracking(key: string): void {
    switch (this.config.strategy) {
      case 'lru':
        // Remove from current position and add to front
        const index = this.accessOrder.indexOf(key);
        if (index > -1) {
          this.accessOrder.splice(index, 1);
        }
        this.accessOrder.unshift(key);
        break;
        
      case 'lfu':
        // Update access count
        this.accessCounts.set(key, (this.accessCounts.get(key) || 0) + 1);
        break;
        
      case 'fifo':
        // No special tracking needed for FIFO
        break;
    }
  }

  private removeFromAccessTracking(key: string): void {
    const index = this.accessOrder.indexOf(key);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
    this.accessCounts.delete(key);
  }

  private async ensureCapacity(requiredSize: number): Promise<void> {
    const maxSizeBytes = this.config.maxSize * 1024 * 1024; // Convert MB to bytes
    
    while (this.stats.size + requiredSize > maxSizeBytes && this.cache.size > 0) {
      const keyToEvict = this.selectEvictionCandidate();
      if (keyToEvict) {
        this.delete(keyToEvict);
        this.stats.evictions++;
        this.emit('cache-eviction', { key: keyToEvict });
      } else {
        break;
      }
    }
  }

  private selectEvictionCandidate(): string | undefined {
    if (this.cache.size === 0) return undefined;

    switch (this.config.strategy) {
      case 'lru':
        // Evict least recently used
        return this.accessOrder[this.accessOrder.length - 1];
        
      case 'lfu':
        // Evict least frequently used
        let minCount = Infinity;
        let candidate: string | undefined;
        for (const [key, count] of this.accessCounts.entries()) {
          if (count < minCount) {
            minCount = count;
            candidate = key;
          }
        }
        return candidate;
        
      case 'fifo':
        // Evict oldest entry
        let oldestTime = Infinity;
        let oldestKey: string | undefined;
        for (const [key, entry] of this.cache.entries()) {
          if (entry.timestamp.getTime() < oldestTime) {
            oldestTime = entry.timestamp.getTime();
            oldestKey = key;
          }
        }
        return oldestKey;
        
      default:
        // Default to FIFO
        return this.cache.keys().next().value;
    }
  }

  private calculateSize(value: T): number {
    // Estimate size in bytes
    const str = JSON.stringify(value);
    return Buffer.byteLength(str, 'utf8');
  }

  private startPersistenceTimer(): void {
    // Persist cache to disk every 5 minutes
    this.persistenceTimer = setInterval(() => {
      this.saveToDisk().catch(error => {
        logger.error('Failed to persist cache to disk:', error);
      });
    }, 300000);
  }

  private async saveToDisk(): Promise<void> {
    if (!this.config.persistToDisk || !this.config.diskPath) {
      return;
    }

    try {
      const data = {
        version: '1.0',
        timestamp: new Date().toISOString(),
        entries: Array.from(this.cache.entries()).map(([key, entry]) => ({
          key,
          value: entry.value,
          timestamp: entry.timestamp.toISOString(),
          expiresAt: entry.expiresAt.toISOString(),
          size: entry.size,
          accessCount: entry.accessCount,
          lastAccessTime: entry.lastAccessTime.toISOString(),
          metadata: entry.metadata
        })),
        stats: this.stats
      };

      const filePath = path.join(this.config.diskPath, 'perplexity-cache.json');
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, JSON.stringify(data, null, 2));
      
      logger.debug('Cache persisted to disk', {
        entries: this.cache.size,
        size: this.stats.size
      });
    } catch (error) {
      logger.error('Failed to save cache to disk:', error);
      throw error;
    }
  }

  private async loadFromDisk(): Promise<void> {
    if (!this.config.persistToDisk || !this.config.diskPath) {
      return;
    }

    try {
      const filePath = path.join(this.config.diskPath, 'perplexity-cache.json');
      const exists = await fs.access(filePath).then(() => true).catch(() => false);
      
      if (!exists) {
        logger.debug('No cache file found on disk');
        return;
      }

      const data = JSON.parse(await fs.readFile(filePath, 'utf8'));
      
      // Validate version
      if (data.version !== '1.0') {
        logger.warn('Incompatible cache version, skipping load');
        return;
      }

      // Load entries
      const now = Date.now();
      let loadedCount = 0;
      
      for (const entry of data.entries) {
        const expiresAt = new Date(entry.expiresAt);
        
        // Skip expired entries
        if (expiresAt.getTime() < now) {
          continue;
        }

        this.cache.set(entry.key, {
          key: entry.key,
          value: entry.value,
          timestamp: new Date(entry.timestamp),
          expiresAt,
          size: entry.size,
          accessCount: entry.accessCount,
          lastAccessTime: new Date(entry.lastAccessTime),
          metadata: entry.metadata
        });
        
        loadedCount++;
      }

      // Update stats
      this.stats = data.stats || this.stats;
      this.stats.entryCount = this.cache.size;
      
      logger.info('Cache loaded from disk', {
        loadedEntries: loadedCount,
        totalEntries: data.entries.length
      });
    } catch (error) {
      logger.error('Failed to load cache from disk:', error);
      throw error;
    }
  }

  generateKey(...parts: any[]): string {
    const combined = parts.map(p => 
      typeof p === 'object' ? JSON.stringify(p) : String(p)
    ).join(':');
    
    return crypto
      .createHash('sha256')
      .update(combined)
      .digest('hex');
  }

  async shutdown(): Promise<void> {
    if (this.persistenceTimer) {
      clearInterval(this.persistenceTimer);
    }
    
    if (this.config.persistToDisk) {
      await this.saveToDisk();
    }
    
    this.clear();
    this.removeAllListeners();
  }
}