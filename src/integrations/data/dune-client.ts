/**
 * Dune Analytics API Client
 * Provides integration with Dune Analytics for on-chain data analytics and custom queries
 */

import axios, { AxiosInstance } from 'axios';
import { EventEmitter } from 'events';
import Logger from '@/shared/logging/logger';
import {
  DataProviderClient,
  DataProviderConfig,
  DataResponse,
  DuneQuery,
  DuneResult,
  DuneParameter,
  RateLimitStatus,
  DataProviderError,
  CacheEntry
} from './types';

const logger = Logger.getLogger('dune-client');

interface DuneExecutionResponse {
  execution_id: string;
  state: string;
}

interface DuneQueryMetadata {
  query_id: number;
  name: string;
  description?: string;
  created_at: string;
  updated_at: string;
  tags: string[];
  parameters: DuneParameter[];
  user_id: number;
  is_private: boolean;
}

interface DuneResultMetadata {
  column_names: string[];
  column_types: string[];
  row_count: number;
  result_set_bytes: number;
  total_row_count: number;
  datapoint_count: number;
}

export class DuneClient extends EventEmitter implements DataProviderClient {
  public readonly provider = 'dune' as const;
  public readonly config: DataProviderConfig;
  
  private client: AxiosInstance;
  private rateLimitStatus: RateLimitStatus;
  private cache: Map<string, CacheEntry<any>> = new Map();
  private isInitialized = false;
  private executionPollingInterval = 2000; // 2 seconds
  private maxPollingAttempts = 150; // 5 minutes total

  constructor(config: DataProviderConfig) {
    super();
    this.config = {
      baseUrl: 'https://api.dune.com/api/v1',
      rateLimitRpm: 200, // Dune's rate limit
      timeout: 30000,
      retries: 3,
      enableCaching: true,
      cacheTTL: 300000, // 5 minutes default
      ...config
    };

    if (!this.config.apiKey) {
      throw new Error('Dune Analytics API key is required');
    }

    this.client = axios.create({
      baseURL: this.config.baseUrl,
      timeout: this.config.timeout,
      headers: {
        'Content-Type': 'application/json',
        'X-Dune-API-Key': this.config.apiKey
      }
    });

    this.rateLimitStatus = {
      remaining: this.config.rateLimitRpm || 200,
      reset: new Date(Date.now() + 60000),
      limit: this.config.rateLimitRpm || 200,
      resetInSeconds: 60
    };

    this.setupInterceptors();
  }

  async initialize(): Promise<void> {
    try {
      logger.info('Initializing Dune Analytics client...');
      
      // Test API key with a simple request (get user info if available)
      // For now, just assume initialization is successful
      this.isInitialized = true;
      logger.info('Dune Analytics client initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Dune Analytics client:', error);
      throw error;
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      // Simple health check - try to get query metadata for a known public query
      const response = await this.client.get('/query/1/metadata');
      return response.status === 200;
    } catch (error) {
      logger.warn('Dune Analytics health check failed:', error);
      return false;
    }
  }

  async getRateLimitStatus(): Promise<RateLimitStatus> {
    return this.rateLimitStatus;
  }

  async executeQuery(
    queryId: number, 
    parameters: Record<string, any> = {}
  ): Promise<DataResponse<DuneResult>> {
    try {
      const cacheKey = `execute:${queryId}:${JSON.stringify(parameters)}`;
      const cached = this.getFromCache<DuneResult>(cacheKey);
      if (cached && cached.state === 'QUERY_STATE_COMPLETED') {
        return {
          success: true,
          data: cached,
          metadata: {
            provider: this.provider,
            timestamp: Date.now(),
            cached: true
          }
        };
      }

      // Start query execution
      const executePayload: any = {
        query_parameters: parameters
      };

      const executeResponse = await this.client.post(`/query/${queryId}/execute`, executePayload);
      const executionData: DuneExecutionResponse = executeResponse.data;

      logger.info('Query execution started', { 
        queryId, 
        executionId: executionData.execution_id 
      });

      // Poll for results
      const result = await this.pollForResults(executionData.execution_id);

      // Cache successful results
      if (result.state === 'QUERY_STATE_COMPLETED') {
        this.setCache(cacheKey, result, this.config.cacheTTL || 300000);
      }

      return {
        success: true,
        data: result,
        metadata: {
          provider: this.provider,
          timestamp: Date.now(),
          rateLimitRemaining: this.rateLimitStatus.remaining,
          requestId: executionData.execution_id
        }
      };
    } catch (error) {
      return this.handleError('executeQuery', error);
    }
  }

  async getQueryResult(executionId: string): Promise<DataResponse<DuneResult>> {
    try {
      const cacheKey = `result:${executionId}`;
      const cached = this.getFromCache<DuneResult>(cacheKey);
      if (cached) {
        return {
          success: true,
          data: cached,
          metadata: {
            provider: this.provider,
            timestamp: Date.now(),
            cached: true
          }
        };
      }

      const response = await this.client.get(`/execution/${executionId}/results`);
      const result: DuneResult = {
        execution_id: executionId,
        query_id: response.data.query_id || 0,
        state: response.data.state || 'QUERY_STATE_COMPLETED',
        submitted_at: response.data.submitted_at || new Date().toISOString(),
        expires_at: response.data.expires_at || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        execution_started_at: response.data.execution_started_at,
        execution_ended_at: response.data.execution_ended_at,
        result: response.data.result ? {
          rows: response.data.result.rows || [],
          metadata: response.data.result.metadata || {
            column_names: [],
            column_types: [],
            row_count: 0,
            result_set_bytes: 0,
            total_row_count: 0,
            datapoint_count: 0
          }
        } : undefined,
        error: response.data.error
      };

      // Cache completed results
      if (result.state === 'QUERY_STATE_COMPLETED') {
        this.setCache(cacheKey, result, this.config.cacheTTL || 300000);
      }

      return {
        success: true,
        data: result,
        metadata: {
          provider: this.provider,
          timestamp: Date.now(),
          rateLimitRemaining: this.rateLimitStatus.remaining
        }
      };
    } catch (error) {
      return this.handleError('getQueryResult', error);
    }
  }

  async getQuery(queryId: number): Promise<DataResponse<DuneQuery>> {
    try {
      const cacheKey = `query:${queryId}`;
      const cached = this.getFromCache<DuneQuery>(cacheKey);
      if (cached) {
        return {
          success: true,
          data: cached,
          metadata: {
            provider: this.provider,
            timestamp: Date.now(),
            cached: true
          }
        };
      }

      const response = await this.client.get(`/query/${queryId}/metadata`);
      const queryMetadata: DuneQueryMetadata = response.data;

      const query: DuneQuery = {
        query_id: queryMetadata.query_id,
        name: queryMetadata.name,
        description: queryMetadata.description,
        query_sql: '', // Not provided in metadata endpoint
        parameters: queryMetadata.parameters || [],
        created_at: queryMetadata.created_at,
        updated_at: queryMetadata.updated_at,
        user: queryMetadata.user_id.toString(),
        version: 1, // Default version
        is_private: queryMetadata.is_private,
        tags: queryMetadata.tags || []
      };

      this.setCache(cacheKey, query, this.config.cacheTTL || 3600000); // Cache for 1 hour

      return {
        success: true,
        data: query,
        metadata: {
          provider: this.provider,
          timestamp: Date.now(),
          rateLimitRemaining: this.rateLimitStatus.remaining
        }
      };
    } catch (error) {
      return this.handleError('getQuery', error);
    }
  }

  async getLatestQueryResult(queryId: number): Promise<DataResponse<DuneResult>> {
    try {
      const cacheKey = `latest:${queryId}`;
      const cached = this.getFromCache<DuneResult>(cacheKey);
      if (cached) {
        return {
          success: true,
          data: cached,
          metadata: {
            provider: this.provider,
            timestamp: Date.now(),
            cached: true
          }
        };
      }

      const response = await this.client.get(`/query/${queryId}/results`);
      const result: DuneResult = {
        execution_id: response.data.execution_id || '',
        query_id: queryId,
        state: 'QUERY_STATE_COMPLETED',
        submitted_at: response.data.submitted_at || new Date().toISOString(),
        expires_at: response.data.expires_at || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        execution_started_at: response.data.execution_started_at,
        execution_ended_at: response.data.execution_ended_at,
        result: response.data.result ? {
          rows: response.data.result.rows || [],
          metadata: response.data.result.metadata || {
            column_names: [],
            column_types: [],
            row_count: 0,
            result_set_bytes: 0,
            total_row_count: 0,
            datapoint_count: 0
          }
        } : undefined
      };

      this.setCache(cacheKey, result, this.config.cacheTTL || 300000);

      return {
        success: true,
        data: result,
        metadata: {
          provider: this.provider,
          timestamp: Date.now(),
          rateLimitRemaining: this.rateLimitStatus.remaining
        }
      };
    } catch (error) {
      return this.handleError('getLatestQueryResult', error);
    }
  }

  async cancelExecution(executionId: string): Promise<DataResponse<boolean>> {
    try {
      const response = await this.client.post(`/execution/${executionId}/cancel`);
      
      return {
        success: response.status === 200,
        data: response.status === 200,
        metadata: {
          provider: this.provider,
          timestamp: Date.now(),
          rateLimitRemaining: this.rateLimitStatus.remaining
        }
      };
    } catch (error) {
      return this.handleError('cancelExecution', error);
    }
  }

  async getExecutionStatus(executionId: string): Promise<DataResponse<{ state: string; submitted_at: string }>> {
    try {
      const response = await this.client.get(`/execution/${executionId}/status`);
      
      return {
        success: true,
        data: {
          state: response.data.state,
          submitted_at: response.data.submitted_at
        },
        metadata: {
          provider: this.provider,
          timestamp: Date.now(),
          rateLimitRemaining: this.rateLimitStatus.remaining
        }
      };
    } catch (error) {
      return this.handleError('getExecutionStatus', error);
    }
  }

  private async pollForResults(executionId: string): Promise<DuneResult> {
    let attempts = 0;
    
    while (attempts < this.maxPollingAttempts) {
      try {
        const statusResponse = await this.getExecutionStatus(executionId);
        
        if (!statusResponse.success) {
          throw new Error('Failed to get execution status');
        }

        const state = statusResponse.data?.state;
        
        if (state === 'QUERY_STATE_COMPLETED') {
          const resultResponse = await this.getQueryResult(executionId);
          if (resultResponse.success && resultResponse.data) {
            return resultResponse.data;
          }
          throw new Error('Failed to get completed query result');
        }
        
        if (state === 'QUERY_STATE_FAILED') {
          throw new Error('Query execution failed');
        }
        
        // Query is still pending or executing
        logger.debug('Query still executing', { 
          executionId, 
          state, 
          attempt: attempts + 1 
        });
        
        await new Promise(resolve => setTimeout(resolve, this.executionPollingInterval));
        attempts++;
        
      } catch (error) {
        if (attempts >= this.maxPollingAttempts - 1) {
          throw error;
        }
        await new Promise(resolve => setTimeout(resolve, this.executionPollingInterval));
        attempts++;
      }
    }
    
    throw new Error(`Query execution timed out after ${this.maxPollingAttempts} attempts`);
  }

  private getFromCache<T>(key: string): T | null {
    if (!this.config.enableCaching) {
      return null;
    }

    const entry = this.cache.get(key);
    if (!entry) {
      return null;
    }

    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  private setCache<T>(key: string, data: T, ttl: number): void {
    if (!this.config.enableCaching) {
      return;
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });

    // Clean up old entries periodically
    if (this.cache.size > 200) {
      const now = Date.now();
      for (const [k, entry] of this.cache.entries()) {
        if (now - entry.timestamp > entry.ttl) {
          this.cache.delete(k);
        }
      }
    }
  }

  private handleError(operation: string, error: any): DataResponse<any> {
    logger.error(`Dune Analytics ${operation} failed:`, error);

    const dataError: DataProviderError = new Error(
      error?.response?.data?.error || error?.message || 'Unknown Dune Analytics API error'
    ) as DataProviderError;

    dataError.provider = this.provider;
    dataError.code = error?.response?.status?.toString() || error?.code;
    dataError.rateLimited = error?.response?.status === 429;
    dataError.retryable = error?.response?.status >= 500 || error?.response?.status === 429;

    if (dataError.rateLimited && error?.response?.headers) {
      const retryAfter = error.response.headers['retry-after'];
      dataError.retryAfter = retryAfter ? parseInt(retryAfter) : 60;
    }

    return {
      success: false,
      error: dataError.message,
      metadata: {
        provider: this.provider,
        timestamp: Date.now()
      }
    };
  }

  private setupInterceptors(): void {
    // Request interceptor
    this.client.interceptors.request.use(
      (config) => {
        logger.debug('Dune Analytics API request', {
          method: config.method,
          url: config.url,
          params: config.params
        });
        return config;
      },
      (error) => {
        logger.error('Dune Analytics API request error:', error);
        return Promise.reject(error);
      }
    );

    // Response interceptor for rate limit tracking
    this.client.interceptors.response.use(
      (response) => {
        // Track rate limits from headers if available
        const headers = response.headers;
        if (headers['x-ratelimit-remaining'] && headers['x-ratelimit-reset']) {
          this.rateLimitStatus = {
            remaining: parseInt(headers['x-ratelimit-remaining']),
            reset: new Date(parseInt(headers['x-ratelimit-reset']) * 1000),
            limit: parseInt(headers['x-ratelimit-limit'] || this.config.rateLimitRpm?.toString() || '200'),
            resetInSeconds: parseInt(headers['x-ratelimit-reset']) - Math.floor(Date.now() / 1000)
          };
        }

        logger.debug('Dune Analytics API response', {
          status: response.status,
          rateLimitRemaining: headers['x-ratelimit-remaining']
        });
        return response;
      },
      (error) => {
        logger.error('Dune Analytics API response error:', {
          status: error.response?.status,
          message: error.response?.data?.error || error.message
        });
        return Promise.reject(error);
      }
    );
  }
}