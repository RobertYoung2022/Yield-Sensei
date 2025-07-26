/**
 * Perplexity API Integration
 * Enhanced market research and protocol analysis capabilities
 */

import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { EventEmitter } from 'events';
import { 
  ProtocolData, 
  RWAData, 
  ModelPrediction,
  FeatureImportance 
} from '../types';
import Logger from '@/shared/logging/logger';

const logger = Logger.getLogger('perplexity-integration');

/**
 * Perplexity API Configuration
 */
export interface PerplexityConfig {
  apiKey: string;
  baseUrl: string;
  timeout: number;
  maxRetries: number;
  rateLimit: {
    requestsPerMinute: number;
    requestsPerHour: number;
  };
  enableCaching: boolean;
  cacheTTL: number; // milliseconds
  enableRateLimiting: boolean;
  enableLogging: boolean;
}

export const DEFAULT_PERPLEXITY_CONFIG: PerplexityConfig = {
  apiKey: '',
  baseUrl: 'https://api.perplexity.ai',
  timeout: 30000,
  maxRetries: 3,
  rateLimit: {
    requestsPerMinute: 60,
    requestsPerHour: 1000
  },
  enableCaching: true,
  cacheTTL: 3600000, // 1 hour
  enableRateLimiting: true,
  enableLogging: true
};

/**
 * Perplexity API Response Types
 */
export interface PerplexityQuery {
  query: string;
  model?: string;
  search_domain?: string;
  include_domains?: string[];
  exclude_domains?: string[];
  include_answer?: boolean;
  include_images?: boolean;
  include_raw_content?: boolean;
  max_results?: number;
}

export interface PerplexityResponse {
  id: string;
  model: string;
  created: number;
  object: string;
  choices: PerplexityChoice[];
  usage: PerplexityUsage;
}

export interface PerplexityChoice {
  index: number;
  finish_reason: string;
  message: PerplexityMessage;
}

export interface PerplexityMessage {
  role: string;
  content: string;
  tool_calls?: PerplexityToolCall[];
}

export interface PerplexityToolCall {
  id: string;
  type: string;
  function: {
    name: string;
    arguments: string;
  };
}

export interface PerplexityUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

/**
 * Research Query Types
 */
export interface ResearchQuery {
  id: string;
  type: 'protocol_analysis' | 'market_research' | 'regulatory_research' | 'company_research';
  query: string;
  context?: {
    protocolId?: string;
    rwaId?: string;
    jurisdiction?: string;
    timeframe?: string;
  };
  priority: 'low' | 'medium' | 'high' | 'critical';
  timestamp: Date;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  result?: ResearchResult;
  error?: string;
}

export interface ResearchResult {
  summary: string;
  keyFindings: string[];
  sources: ResearchSource[];
  confidence: number;
  recommendations: string[];
  metadata: Record<string, any>;
}

export interface ResearchSource {
  title: string;
  url: string;
  domain: string;
  snippet: string;
  relevance: number;
}

/**
 * Cached Response
 */
interface CachedResponse {
  response: PerplexityResponse;
  timestamp: Date;
  queryHash: string;
}

/**
 * Rate Limiting
 */
interface RateLimitState {
  requestsThisMinute: number;
  requestsThisHour: number;
  lastMinuteReset: Date;
  lastHourReset: Date;
}

/**
 * Perplexity API Integration
 */
export class PerplexityIntegration extends EventEmitter {
  private static instance: PerplexityIntegration;
  private config: PerplexityConfig;
  private client: AxiosInstance;
  private cache: Map<string, CachedResponse> = new Map();
  private rateLimitState: RateLimitState;
  private isInitialized: boolean = false;
  private pendingQueries: Map<string, ResearchQuery> = new Map();

  private constructor(config: PerplexityConfig = DEFAULT_PERPLEXITY_CONFIG) {
    super();
    this.config = config;
    
    this.client = axios.create({
      baseURL: this.config.baseUrl,
      timeout: this.config.timeout,
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    this.rateLimitState = {
      requestsThisMinute: 0,
      requestsThisHour: 0,
      lastMinuteReset: new Date(),
      lastHourReset: new Date()
    };

    this.setupInterceptors();
  }

  static getInstance(config?: PerplexityConfig): PerplexityIntegration {
    if (!PerplexityIntegration.instance) {
      PerplexityIntegration.instance = new PerplexityIntegration(config);
    }
    return PerplexityIntegration.instance;
  }

  async initialize(): Promise<void> {
    try {
      if (this.isInitialized) {
        return;
      }

      logger.info('Initializing Perplexity API Integration...');

      // Validate API key
      if (!this.config.apiKey) {
        throw new Error('Perplexity API key is required');
      }

      // Test API connection
      await this.testConnection();

      this.isInitialized = true;
      logger.info('Perplexity API Integration initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Perplexity API Integration:', error);
      throw error;
    }
  }

  async researchProtocol(protocolData: ProtocolData): Promise<ResearchResult> {
    try {
      logger.info('Starting protocol research', { protocolId: protocolData.id });

      const queries = this.generateProtocolQueries(protocolData);
      const results: ResearchResult[] = [];

      for (const query of queries) {
        const result = await this.executeResearchQuery(query);
        results.push(result);
      }

      // Combine results
      const combinedResult = this.combineProtocolResults(results, protocolData);

      logger.info('Protocol research completed', { 
        protocolId: protocolData.id,
        queriesCount: queries.length 
      });

      return combinedResult;
    } catch (error) {
      logger.error('Protocol research failed', { 
        protocolId: protocolData.id, 
        error 
      });
      throw error;
    }
  }

  async researchRWA(rwaData: RWAData): Promise<ResearchResult> {
    try {
      logger.info('Starting RWA research', { rwaId: rwaData.id });

      const queries = this.generateRWAQueries(rwaData);
      const results: ResearchResult[] = [];

      for (const query of queries) {
        const result = await this.executeResearchQuery(query);
        results.push(result);
      }

      // Combine results
      const combinedResult = this.combineRWAResults(results, rwaData);

      logger.info('RWA research completed', { 
        rwaId: rwaData.id,
        queriesCount: queries.length 
      });

      return combinedResult;
    } catch (error) {
      logger.error('RWA research failed', { 
        rwaId: rwaData.id, 
        error 
      });
      throw error;
    }
  }

  async researchMarket(topic: string, jurisdiction?: string): Promise<ResearchResult> {
    try {
      logger.info('Starting market research', { topic, jurisdiction });

      const query: ResearchQuery = {
        id: `market-${Date.now()}`,
        type: 'market_research',
        query: this.generateMarketQuery(topic, jurisdiction),
        context: { ...(jurisdiction && { jurisdiction }) },
        priority: 'medium',
        timestamp: new Date(),
        status: 'pending'
      };

      const result = await this.executeResearchQuery(query);

      logger.info('Market research completed', { topic, jurisdiction });

      return result;
    } catch (error) {
      logger.error('Market research failed', { topic, jurisdiction, error });
      throw error;
    }
  }

  async researchRegulatory(jurisdiction: string, topic?: string): Promise<ResearchResult> {
    try {
      logger.info('Starting regulatory research', { jurisdiction, topic });

      const query: ResearchQuery = {
        id: `regulatory-${Date.now()}`,
        type: 'regulatory_research',
        query: this.generateRegulatoryQuery(jurisdiction, topic),
        context: { jurisdiction },
        priority: 'high',
        timestamp: new Date(),
        status: 'pending'
      };

      const result = await this.executeResearchQuery(query);

      logger.info('Regulatory research completed', { jurisdiction, topic });

      return result;
    } catch (error) {
      logger.error('Regulatory research failed', { jurisdiction, topic, error });
      throw error;
    }
  }

  async researchCompany(companyName: string): Promise<ResearchResult> {
    try {
      logger.info('Starting company research', { companyName });

      const query: ResearchQuery = {
        id: `company-${Date.now()}`,
        type: 'company_research',
        query: this.generateCompanyQuery(companyName),
        context: {},
        priority: 'medium',
        timestamp: new Date(),
        status: 'pending'
      };

      const result = await this.executeResearchQuery(query);

      logger.info('Company research completed', { companyName });

      return result;
    } catch (error) {
      logger.error('Company research failed', { companyName, error });
      throw error;
    }
  }

  private async executeResearchQuery(query: ResearchQuery): Promise<ResearchResult> {
    try {
      // Check cache first
      const cacheKey = this.generateCacheKey(query);
      const cached = this.cache.get(cacheKey);
      
      if (cached && Date.now() - cached.timestamp.getTime() < this.config.cacheTTL) {
        logger.debug('Returning cached research result', { queryId: query.id });
        return this.parseCachedResponse(cached.response, query);
      }

      // Check rate limits
      await this.checkRateLimits();

      // Update query status
      query.status = 'processing';
      this.pendingQueries.set(query.id, query);

      // Execute API call
      const perplexityQuery: PerplexityQuery = {
        query: query.query,
        model: 'mixtral-8x7b-instruct',
        include_answer: true,
        include_images: false,
        include_raw_content: false,
        max_results: 10
      };

      const response = await this.client.post<PerplexityResponse>('/chat/completions', perplexityQuery);

      // Parse response
      const result = this.parsePerplexityResponse(response.data, query);

      // Cache result
      if (this.config.enableCaching) {
        this.cache.set(cacheKey, {
          response: response.data,
          timestamp: new Date(),
          queryHash: cacheKey
        });
      }

      // Update query status
      query.status = 'completed';
      query.result = result;
      this.pendingQueries.delete(query.id);

      // Emit completion event
      this.emit('research_completed', {
        queryId: query.id,
        result,
        timestamp: new Date()
      });

      return result;
    } catch (error) {
      // Update query status
      query.status = 'failed';
      query.error = error instanceof Error ? error.message : 'Unknown error';
      this.pendingQueries.delete(query.id);

      logger.error('Research query execution failed', { 
        queryId: query.id, 
        error 
      });
      throw error;
    }
  }

  private generateProtocolQueries(protocolData: ProtocolData): ResearchQuery[] {
    const queries: ResearchQuery[] = [];

    // Protocol fundamentals query
    queries.push({
      id: `protocol-fundamentals-${protocolData.id}`,
      type: 'protocol_analysis',
      query: `Analyze the fundamentals of ${protocolData.name} (${protocolData.category} protocol). Focus on: 1) Recent performance and TVL trends, 2) Revenue generation and sustainability, 3) Security audits and vulnerabilities, 4) Team background and credibility, 5) Competitive positioning. Provide specific data and insights.`,
      context: { protocolId: protocolData.id },
      priority: 'high',
      timestamp: new Date(),
      status: 'pending'
    });

    // Security analysis query
    queries.push({
      id: `protocol-security-${protocolData.id}`,
      type: 'protocol_analysis',
      query: `Research security aspects of ${protocolData.name}: 1) Recent security audits and their findings, 2) Known vulnerabilities or exploits, 3) Insurance coverage and risk management, 4) Bug bounty programs, 5) Security best practices implementation.`,
      context: { protocolId: protocolData.id },
      priority: 'high',
      timestamp: new Date(),
      status: 'pending'
    });

    // Market analysis query
    queries.push({
      id: `protocol-market-${protocolData.id}`,
      type: 'market_research',
      query: `Analyze the market position of ${protocolData.name} in the ${protocolData.category} sector: 1) Market share and competitive landscape, 2) User growth and adoption trends, 3) Regulatory considerations, 4) Future outlook and roadmap, 5) Investment thesis.`,
      context: { protocolId: protocolData.id },
      priority: 'medium',
      timestamp: new Date(),
      status: 'pending'
    });

    return queries;
  }

  private generateRWAQueries(rwaData: RWAData): ResearchQuery[] {
    const queries: ResearchQuery[] = [];

    // RWA fundamentals query
    queries.push({
      id: `rwa-fundamentals-${rwaData.id}`,
      type: 'market_research',
      query: `Research the fundamentals of ${rwaData.type} real-world assets: 1) Market size and growth trends, 2) Risk factors and volatility, 3) Regulatory environment, 4) Liquidity characteristics, 5) Yield expectations and sustainability.`,
      context: { rwaId: rwaData.id },
      priority: 'high',
      timestamp: new Date(),
      status: 'pending'
    });

    // Issuer research query
    queries.push({
      id: `rwa-issuer-${rwaData.id}`,
      type: 'company_research',
      query: `Research the issuer ${rwaData.issuer}: 1) Company background and financial health, 2) Credit rating and risk profile, 3) Regulatory compliance history, 4) Market reputation and track record, 5) Recent news and developments.`,
      context: { rwaId: rwaData.id },
      priority: 'high',
      timestamp: new Date(),
      status: 'pending'
    });

    // Regulatory compliance query
    queries.push({
      id: `rwa-regulatory-${rwaData.id}`,
      type: 'regulatory_research',
      query: `Research regulatory requirements for ${rwaData.type} assets in ${rwaData.regulatoryStatus.jurisdiction}: 1) Licensing requirements, 2) Compliance obligations, 3) Recent regulatory changes, 4) Enforcement actions, 5) Best practices for compliance.`,
      context: { rwaId: rwaData.id, jurisdiction: rwaData.regulatoryStatus.jurisdiction },
      priority: 'high',
      timestamp: new Date(),
      status: 'pending'
    });

    return queries;
  }

  private generateMarketQuery(topic: string, jurisdiction?: string): string {
    let query = `Research the ${topic} market: 1) Current market size and growth trends, 2) Key players and competitive landscape, 3) Regulatory environment and compliance requirements, 4) Risk factors and market dynamics, 5) Future outlook and opportunities.`;
    
    if (jurisdiction) {
      query += ` Focus on the ${jurisdiction} market specifically.`;
    }
    
    return query;
  }

  private generateRegulatoryQuery(jurisdiction: string, topic?: string): string {
    let query = `Research regulatory requirements in ${jurisdiction}: 1) Current regulatory framework, 2) Recent regulatory changes and updates, 3) Compliance requirements and obligations, 4) Enforcement actions and penalties, 5) Best practices for regulatory compliance.`;
    
    if (topic) {
      query += ` Focus on regulations related to ${topic}.`;
    }
    
    return query;
  }

  private generateCompanyQuery(companyName: string): string {
    return `Research ${companyName}: 1) Company background and history, 2) Financial performance and health, 3) Business model and operations, 4) Regulatory compliance and legal issues, 5) Market position and competitive advantages, 6) Recent news and developments.`;
  }

  private parsePerplexityResponse(response: PerplexityResponse, query: ResearchQuery): ResearchResult {
    try {
      const content = response.choices[0]?.message?.content || '';
      
      // Extract key findings
      const keyFindings = this.extractKeyFindings(content);
      
      // Generate sources (simplified - in real implementation would parse actual sources)
      const sources: ResearchSource[] = this.generateSources(content);
      
      // Calculate confidence based on response quality
      const confidence = this.calculateConfidence(content, response.usage);
      
      // Generate recommendations
      const recommendations = this.generateRecommendations(content, query.type);
      
      return {
        summary: this.generateSummary(content),
        keyFindings,
        sources,
        confidence,
        recommendations,
        metadata: {
          model: response.model,
          usage: response.usage,
          queryType: query.type,
          timestamp: new Date()
        }
      };
    } catch (error) {
      logger.error('Failed to parse Perplexity response:', error);
      throw error;
    }
  }

  private parseCachedResponse(response: PerplexityResponse, query: ResearchQuery): ResearchResult {
    return this.parsePerplexityResponse(response, query);
  }

  private extractKeyFindings(content: string): string[] {
    const findings: string[] = [];
    
    // Simple extraction - in real implementation would use more sophisticated parsing
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 20);
    
    // Look for key phrases that indicate findings
    const keyPhrases = [
      'market size', 'growth rate', 'revenue', 'profitability', 'risk factors',
      'regulatory', 'compliance', 'security', 'audit', 'vulnerability',
      'competitive', 'market share', 'adoption', 'user growth', 'trends'
    ];
    
    for (const sentence of sentences) {
      const lowerSentence = sentence.toLowerCase();
      if (keyPhrases.some(phrase => lowerSentence.includes(phrase))) {
        findings.push(sentence.trim());
      }
    }
    
    return findings.slice(0, 5); // Limit to top 5 findings
  }

  private generateSources(content: string): ResearchSource[] {
    // Simplified source generation
    // In a real implementation, this would parse actual sources from the response
    const mockSources: ResearchSource[] = [
      {
        title: 'Market Research Report',
        url: 'https://example.com/market-report',
        domain: 'example.com',
        snippet: 'Comprehensive market analysis and trends',
        relevance: 0.9
      },
      {
        title: 'Regulatory Database',
        url: 'https://regulatory.example.com',
        domain: 'regulatory.example.com',
        snippet: 'Official regulatory requirements and guidelines',
        relevance: 0.8
      }
    ];
    
    return mockSources;
  }

  private calculateConfidence(content: string, usage: PerplexityUsage): number {
    let confidence = 0.5; // Base confidence
    
    // Content length bonus
    if (content.length > 1000) confidence += 0.2;
    else if (content.length > 500) confidence += 0.1;
    
    // Token usage bonus (indicates comprehensive response)
    if (usage.total_tokens > 1000) confidence += 0.2;
    else if (usage.total_tokens > 500) confidence += 0.1;
    
    // Content quality indicators
    if (content.includes('data') || content.includes('analysis')) confidence += 0.1;
    if (content.includes('regulatory') || content.includes('compliance')) confidence += 0.1;
    
    return Math.min(1, confidence);
  }

  private generateRecommendations(content: string, queryType: string): string[] {
    const recommendations: string[] = [];
    
    // Generate recommendations based on query type and content
    switch (queryType) {
      case 'protocol_analysis':
        if (content.toLowerCase().includes('security')) {
          recommendations.push('Conduct additional security audits');
        }
        if (content.toLowerCase().includes('regulatory')) {
          recommendations.push('Review regulatory compliance status');
        }
        break;
      case 'market_research':
        if (content.toLowerCase().includes('growth')) {
          recommendations.push('Monitor market growth trends');
        }
        if (content.toLowerCase().includes('competition')) {
          recommendations.push('Analyze competitive landscape');
        }
        break;
      case 'regulatory_research':
        recommendations.push('Stay updated on regulatory changes');
        recommendations.push('Implement compliance monitoring');
        break;
      case 'company_research':
        recommendations.push('Monitor company financial health');
        recommendations.push('Track regulatory compliance');
        break;
    }
    
    return recommendations;
  }

  private generateSummary(content: string): string {
    // Generate a concise summary from the content
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 20);
    const summarySentences = sentences.slice(0, 3); // Take first 3 sentences
    return summarySentences.join('. ') + '.';
  }

  private combineProtocolResults(results: ResearchResult[], protocolData: ProtocolData): ResearchResult {
    // Combine multiple research results into a single comprehensive result
    const combinedSummary = results.map(r => r.summary).join(' ');
    const allFindings = results.flatMap(r => r.keyFindings);
    const allSources = results.flatMap(r => r.sources);
    const allRecommendations = results.flatMap(r => r.recommendations);
    
    const averageConfidence = results.reduce((sum, r) => sum + r.confidence, 0) / results.length;
    
    return {
      summary: this.generateSummary(combinedSummary),
      keyFindings: allFindings.slice(0, 10), // Limit to top 10
      sources: allSources.slice(0, 10), // Limit to top 10
      confidence: averageConfidence,
      recommendations: [...new Set(allRecommendations)], // Remove duplicates
      metadata: {
        protocolId: protocolData.id,
        resultsCount: results.length,
        timestamp: new Date()
      }
    };
  }

  private combineRWAResults(results: ResearchResult[], rwaData: RWAData): ResearchResult {
    // Combine multiple research results into a single comprehensive result
    const combinedSummary = results.map(r => r.summary).join(' ');
    const allFindings = results.flatMap(r => r.keyFindings);
    const allSources = results.flatMap(r => r.sources);
    const allRecommendations = results.flatMap(r => r.recommendations);
    
    const averageConfidence = results.reduce((sum, r) => sum + r.confidence, 0) / results.length;
    
    return {
      summary: this.generateSummary(combinedSummary),
      keyFindings: allFindings.slice(0, 10), // Limit to top 10
      sources: allSources.slice(0, 10), // Limit to top 10
      confidence: averageConfidence,
      recommendations: [...new Set(allRecommendations)], // Remove duplicates
      metadata: {
        rwaId: rwaData.id,
        resultsCount: results.length,
        timestamp: new Date()
      }
    };
  }

  private generateCacheKey(query: ResearchQuery): string {
    // Generate a unique cache key for the query
    const queryString = `${query.type}-${query.query}-${JSON.stringify(query.context)}`;
    return Buffer.from(queryString).toString('base64');
  }

  private async checkRateLimits(): Promise<void> {
    if (!this.config.enableRateLimiting) {
      return;
    }

    const now = new Date();

    // Reset counters if needed
    if (now.getTime() - this.rateLimitState.lastMinuteReset.getTime() > 60000) {
      this.rateLimitState.requestsThisMinute = 0;
      this.rateLimitState.lastMinuteReset = now;
    }

    if (now.getTime() - this.rateLimitState.lastHourReset.getTime() > 3600000) {
      this.rateLimitState.requestsThisHour = 0;
      this.rateLimitState.lastHourReset = now;
    }

    // Check limits
    if (this.rateLimitState.requestsThisMinute >= this.config.rateLimit.requestsPerMinute) {
      throw new Error('Rate limit exceeded: too many requests per minute');
    }

    if (this.rateLimitState.requestsThisHour >= this.config.rateLimit.requestsPerHour) {
      throw new Error('Rate limit exceeded: too many requests per hour');
    }

    // Increment counters
    this.rateLimitState.requestsThisMinute++;
    this.rateLimitState.requestsThisHour++;
  }

  private async testConnection(): Promise<void> {
    try {
      const testQuery: PerplexityQuery = {
        query: 'Test connection',
        model: 'mixtral-8x7b-instruct',
        max_results: 1
      };

      await this.client.post('/chat/completions', testQuery);
      logger.info('Perplexity API connection test successful');
    } catch (error) {
      logger.error('Perplexity API connection test failed:', error);
      throw new Error('Failed to connect to Perplexity API');
    }
  }

  private setupInterceptors(): void {
    // Request interceptor for logging
    this.client.interceptors.request.use(
      (config) => {
        if (this.config.enableLogging) {
          logger.debug('Perplexity API request', {
            method: config.method,
            url: config.url,
            data: config.data
          });
        }
        return config;
      },
      (error) => {
        logger.error('Perplexity API request error:', error);
        return Promise.reject(error);
      }
    );

    // Response interceptor for logging
    this.client.interceptors.response.use(
      (response: AxiosResponse) => {
        if (this.config.enableLogging) {
          logger.debug('Perplexity API response', {
            status: response.status,
            data: response.data
          });
        }
        return response;
      },
      (error) => {
        logger.error('Perplexity API response error:', error);
        return Promise.reject(error);
      }
    );
  }

  async shutdown(): Promise<void> {
    logger.info('Shutting down Perplexity API Integration...');
    
    // Clear cache
    this.cache.clear();
    
    // Clear pending queries
    this.pendingQueries.clear();
    
    logger.info('Perplexity API Integration shutdown complete');
  }

  getStatus(): any {
    return {
      isInitialized: this.isInitialized,
      cacheSize: this.cache.size,
      pendingQueriesCount: this.pendingQueries.size,
      rateLimitState: this.rateLimitState
    };
  }

  // Cache management methods
  clearCache(): void {
    this.cache.clear();
    logger.info('Perplexity API cache cleared');
  }

  getCacheStats(): any {
    const cacheEntries = Array.from(this.cache.values());
    const now = new Date();
    
    return {
      totalEntries: cacheEntries.length,
      expiredEntries: cacheEntries.filter(entry => 
        now.getTime() - entry.timestamp.getTime() > this.config.cacheTTL
      ).length,
      cacheSize: this.cache.size
    };
  }
} 