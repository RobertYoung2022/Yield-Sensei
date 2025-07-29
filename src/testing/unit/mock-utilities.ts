/**
 * Mock Utilities
 * Advanced mocking utilities for external dependencies and services
 */

import { MockObject, MockConfig } from './unit-test-framework';

export interface DatabaseMockConfig {
  queryResults?: any[];
  queryError?: Error;
  connectionDelay?: number;
  transactionSupport?: boolean;
}

export interface RedisMockConfig {
  data?: Map<string, string>;
  connectionDelay?: number;
  operationDelay?: number;
}

export interface KafkaMockConfig {
  topics?: string[];
  messages?: Array<{ topic: string; partition: number; message: any }>;
  producerDelay?: number;
  consumerDelay?: number;
}

export interface ExternalApiMockConfig {
  baseUrl?: string;
  responses?: Record<string, any>;
  errors?: Record<string, Error>;
  delay?: number;
}

export class DatabaseMock extends MockObject {
  private queryResults: any[] = [];
  private queryError?: Error;
  private isConnected = false;
  private transactionActive = false;

  constructor(config: DatabaseMockConfig = {}) {
    super({ mockType: 'class' });
    this.queryResults = config.queryResults || [];
    this.queryError = config.queryError;
  }

  async connect(): Promise<void> {
    await this.delay(100);
    this.isConnected = true;
  }

  async disconnect(): Promise<void> {
    await this.delay(50);
    this.isConnected = false;
  }

  async query(_sql: string, _params?: any[]): Promise<any[]> {
    if (!this.isConnected) {
      throw new Error('Database not connected');
    }

    if (this.queryError) {
      throw this.queryError;
    }

    await this.delay(10);
    return this.queryResults;
  }

  async beginTransaction(): Promise<void> {
    if (!this.isConnected) {
      throw new Error('Database not connected');
    }
    this.transactionActive = true;
  }

  async commit(): Promise<void> {
    if (!this.transactionActive) {
      throw new Error('No active transaction');
    }
    this.transactionActive = false;
  }

  async rollback(): Promise<void> {
    if (!this.transactionActive) {
      throw new Error('No active transaction');
    }
    this.transactionActive = false;
  }

  setQueryResults(results: any[]): void {
    this.queryResults = results;
  }

  setQueryError(error?: Error): void {
    this.queryError = error;
  }

  isTransactionActive(): boolean {
    return this.transactionActive;
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export class RedisMock extends MockObject {
  private data = new Map<string, string>();
  private hashes = new Map<string, Map<string, string>>();
  private lists = new Map<string, string[]>();
  private sets = new Map<string, Set<string>>();
  private expirations = new Map<string, number>();

  constructor(config: RedisMockConfig = {}) {
    super({ mockType: 'class' });
    if (config.data) {
      this.data = new Map(config.data);
    }
  }

  async get(key: string): Promise<string | null> {
    await this.delay(1);
    this.checkExpiration(key);
    return this.data.get(key) || null;
  }

  async set(key: string, value: string, ex?: number): Promise<'OK'> {
    await this.delay(1);
    this.data.set(key, value);
    if (ex) {
      this.expirations.set(key, Date.now() + ex * 1000);
    }
    return 'OK';
  }

  async del(key: string): Promise<number> {
    await this.delay(1);
    const existed = this.data.has(key);
    this.data.delete(key);
    this.expirations.delete(key);
    return existed ? 1 : 0;
  }

  async exists(key: string): Promise<number> {
    await this.delay(1);
    this.checkExpiration(key);
    return this.data.has(key) ? 1 : 0;
  }

  async expire(key: string, seconds: number): Promise<number> {
    await this.delay(1);
    if (this.data.has(key)) {
      this.expirations.set(key, Date.now() + seconds * 1000);
      return 1;
    }
    return 0;
  }

  async ttl(key: string): Promise<number> {
    await this.delay(1);
    const expiration = this.expirations.get(key);
    if (!expiration) return -1;
    const remaining = Math.ceil((expiration - Date.now()) / 1000);
    return remaining > 0 ? remaining : -2;
  }

  // Hash operations
  async hget(key: string, field: string): Promise<string | null> {
    await this.delay(1);
    this.checkExpiration(key);
    const hash = this.hashes.get(key);
    return hash?.get(field) || null;
  }

  async hset(key: string, field: string, value: string): Promise<number> {
    await this.delay(1);
    if (!this.hashes.has(key)) {
      this.hashes.set(key, new Map());
    }
    const hash = this.hashes.get(key)!;
    const isNew = !hash.has(field);
    hash.set(field, value);
    return isNew ? 1 : 0;
  }

  async hgetall(key: string): Promise<Record<string, string>> {
    await this.delay(1);
    this.checkExpiration(key);
    const hash = this.hashes.get(key);
    if (!hash) return {};
    
    const result: Record<string, string> = {};
    for (const [field, value] of Array.from(hash)) {
      result[field] = value;
    }
    return result;
  }

  // List operations
  async lpush(key: string, ...values: string[]): Promise<number> {
    await this.delay(1);
    if (!this.lists.has(key)) {
      this.lists.set(key, []);
    }
    const list = this.lists.get(key)!;
    list.unshift(...values);
    return list.length;
  }

  async rpush(key: string, ...values: string[]): Promise<number> {
    await this.delay(1);
    if (!this.lists.has(key)) {
      this.lists.set(key, []);
    }
    const list = this.lists.get(key)!;
    list.push(...values);
    return list.length;
  }

  async lpop(key: string): Promise<string | null> {
    await this.delay(1);
    const list = this.lists.get(key);
    return list?.shift() || null;
  }

  async rpop(key: string): Promise<string | null> {
    await this.delay(1);
    const list = this.lists.get(key);
    return list?.pop() || null;
  }

  async llen(key: string): Promise<number> {
    await this.delay(1);
    return this.lists.get(key)?.length || 0;
  }

  // Set operations
  async sadd(key: string, ...members: string[]): Promise<number> {
    await this.delay(1);
    if (!this.sets.has(key)) {
      this.sets.set(key, new Set());
    }
    const set = this.sets.get(key)!;
    let added = 0;
    for (const member of members) {
      if (!set.has(member)) {
        set.add(member);
        added++;
      }
    }
    return added;
  }

  async srem(key: string, ...members: string[]): Promise<number> {
    await this.delay(1);
    const set = this.sets.get(key);
    if (!set) return 0;
    
    let removed = 0;
    for (const member of members) {
      if (set.delete(member)) {
        removed++;
      }
    }
    return removed;
  }

  async smembers(key: string): Promise<string[]> {
    await this.delay(1);
    const set = this.sets.get(key);
    return set ? Array.from(set) : [];
  }

  async sismember(key: string, member: string): Promise<number> {
    await this.delay(1);
    const set = this.sets.get(key);
    return set?.has(member) ? 1 : 0;
  }

  async flushall(): Promise<'OK'> {
    await this.delay(5);
    this.data.clear();
    this.hashes.clear();
    this.lists.clear();
    this.sets.clear();
    this.expirations.clear();
    return 'OK';
  }

  private checkExpiration(key: string): void {
    const expiration = this.expirations.get(key);
    if (expiration && Date.now() > expiration) {
      this.data.delete(key);
      this.hashes.delete(key);
      this.lists.delete(key);
      this.sets.delete(key);
      this.expirations.delete(key);
    }
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export class KafkaMock extends MockObject {
  private topics = new Set<string>();
  private messages: Array<{ topic: string; partition: number; message: any; offset: number }> = [];
  private consumers = new Map<string, any>();
  private producers = new Map<string, any>();

  constructor(config: KafkaMockConfig = {}) {
    super({ mockType: 'class' });
    if (config.topics) {
      config.topics.forEach(topic => this.topics.add(topic));
    }
    if (config.messages) {
      config.messages.forEach((msg, index) => {
        this.messages.push({ ...msg, offset: index });
      });
    }
  }

  admin() {
    return {
      connect: async () => { await this.delay(10); },
      disconnect: async () => { await this.delay(5); },
      createTopics: async (configs: any[]) => {
        await this.delay(50);
        configs.forEach(config => this.topics.add(config.topic));
        return true;
      },
      listTopics: async () => {
        await this.delay(10);
        return Array.from(this.topics);
      },
      deleteTopics: async (topics: string[]) => {
        await this.delay(30);
        topics.forEach(topic => this.topics.delete(topic));
      },
    };
  }

  producer(_config?: any) {
    const producerId = Math.random().toString(36);
    const producer = {
      connect: async () => { await this.delay(20); },
      disconnect: async () => { await this.delay(10); },
      send: async (record: any) => {
        await this.delay(5);
        const message = {
          topic: record.topic,
          partition: record.partition || 0,
          message: record.messages[0],
          offset: this.messages.length,
        };
        this.messages.push(message);
        return [{ partition: message.partition, errorCode: 0, offset: message.offset }];
      },
    };
    this.producers.set(producerId, producer);
    return producer;
  }

  consumer(_config: any) {
    const consumerId = Math.random().toString(36);
    let subscribedTopics: string[] = [];
    let running = false;
    
    const consumer = {
      connect: async () => { await this.delay(20); },
      disconnect: async () => { await this.delay(10); running = false; },
      subscribe: async (options: { topic?: string; topics?: string[] }) => {
        await this.delay(5);
        if (options.topic) subscribedTopics = [options.topic];
        if (options.topics) subscribedTopics = options.topics;
      },
      run: async (options: { eachMessage: (data: any) => Promise<void> }) => {
        running = true;
        await this.delay(10);
        
        // Simulate message consumption
        const relevantMessages = this.messages.filter(msg => 
          subscribedTopics.includes(msg.topic)
        );
        
        for (const msg of relevantMessages) {
          if (!running) break;
          await options.eachMessage!({
            topic: msg.topic,
            partition: msg.partition,
            message: {
              offset: msg.offset.toString(),
              value: Buffer.from(JSON.stringify(msg.message)),
              key: null,
              timestamp: Date.now().toString(),
            },
          });
          await this.delay(1);
        }
      },
      stop: async () => { running = false; await this.delay(5); },
    };
    
    this.consumers.set(consumerId, consumer);
    return consumer;
  }

  addMessage(topic: string, message: any, partition: number = 0): void {
    this.messages.push({
      topic,
      partition,
      message,
      offset: this.messages.length,
    });
  }

  getMessages(topic?: string): Array<{ topic: string; partition: number; message: any; offset: number }> {
    if (topic) {
      return this.messages.filter(msg => msg.topic === topic);
    }
    return [...this.messages];
  }

  clearMessages(): void {
    this.messages = [];
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export class ExternalApiMock extends MockObject {
  private responses = new Map<string, any>();
  private errors = new Map<string, Error>();
  private requestHistory: Array<{ method: string; url: string; data?: any; timestamp: number }> = [];

  constructor(config: ExternalApiMockConfig = {}) {
    super({ mockType: 'api' });
    if (config.responses) {
      Object.entries(config.responses).forEach(([endpoint, response]) => {
        this.responses.set(endpoint, response);
      });
    }
    if (config.errors) {
      Object.entries(config.errors).forEach(([endpoint, error]) => {
        this.errors.set(endpoint, error);
      });
    }
  }

  async get(url: string, config?: any): Promise<any> {
    return this.makeRequest('GET', url, undefined, config);
  }

  async post(url: string, data?: any, config?: any): Promise<any> {
    return this.makeRequest('POST', url, data, config);
  }

  async put(url: string, data?: any, config?: any): Promise<any> {
    return this.makeRequest('PUT', url, data, config);
  }

  async delete(url: string, config?: any): Promise<any> {
    return this.makeRequest('DELETE', url, undefined, config);
  }

  async patch(url: string, data?: any, config?: any): Promise<any> {
    return this.makeRequest('PATCH', url, data, config);
  }

  private async makeRequest(method: string, url: string, data?: any, config?: any): Promise<any> {
    await this.delay(10);
    
    this.requestHistory.push({
      method,
      url,
      data,
      timestamp: Date.now(),
    });

    const endpoint = this.normalizeEndpoint(url);
    
    if (this.errors.has(endpoint)) {
      throw this.errors.get(endpoint);
    }

    if (this.responses.has(endpoint)) {
      return {
        status: 200,
        statusText: 'OK',
        data: this.responses.get(endpoint),
        headers: {},
        config: config || {},
      };
    }

    // Default response
    return {
      status: 200,
      statusText: 'OK',
      data: {},
      headers: {},
      config: config || {},
    };
  }

  setResponse(endpoint: string, response: any): void {
    this.responses.set(this.normalizeEndpoint(endpoint), response);
  }

  setError(endpoint: string, error: Error): void {
    this.errors.set(this.normalizeEndpoint(endpoint), error);
  }

  getRequestHistory(): Array<{ method: string; url: string; data?: any; timestamp: number }> {
    return [...this.requestHistory];
  }

  clearRequestHistory(): void {
    this.requestHistory = [];
  }

  wasRequestMade(method: string, url: string): boolean {
    return this.requestHistory.some(req => 
      req.method === method && req.url.includes(url)
    );
  }

  private normalizeEndpoint(url: string): string {
    // Remove base URL and query parameters for matching
    return url.split('?')[0].replace(/^https?:\/\/[^\/]+/, '');
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Factory functions for common mocks
export const createDatabaseMock = (config?: DatabaseMockConfig) => new DatabaseMock(config);
export const createRedisMock = (config?: RedisMockConfig) => new RedisMock(config);
export const createKafkaMock = (config?: KafkaMockConfig) => new KafkaMock(config);
export const createExternalApiMock = (config?: ExternalApiMockConfig) => new ExternalApiMock(config);

// Utility to create all common mocks at once
export function createCommonMocks() {
  return {
    database: createDatabaseMock(),
    redis: createRedisMock(),
    kafka: createKafkaMock(),
    api: createExternalApiMock(),
  };
}