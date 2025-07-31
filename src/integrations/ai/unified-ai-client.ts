/**
 * Unified AI Client
 * Provides a single interface to all AI service providers with intelligent routing and fallback
 */

import { EventEmitter } from 'events';
import Logger from '@/shared/logging/logger';
import { config } from '@/config/environment';
import { OpenAIClient } from './openai-client';
import { AnthropicClient } from './anthropic-client';
import { PerplexityClient } from './perplexity-client';
import {
  AIServiceClient,
  AIServiceResponse,
  TextGenerationRequest,
  TextGenerationResponse,
  AnalysisRequest,
  AnalysisResponse,
  ResearchRequest,
  ResearchResponse,
  UnifiedAIClientConfig,
  AIProvider,
  AIServiceError,
} from './types';

const logger = Logger.getLogger('unified-ai-client');

export class UnifiedAIClient extends EventEmitter {
  private config: UnifiedAIClientConfig;
  private clients: Map<AIProvider, AIServiceClient> = new Map();
  private healthStatus: Map<AIProvider, boolean> = new Map();
  private lastUsedProvider: AIProvider | null = null;
  private roundRobinIndex = 0;

  constructor(config?: Partial<UnifiedAIClientConfig>) {
    super();
    
    this.config = {
      defaultProvider: 'anthropic',
      fallbackProviders: ['openai', 'perplexity'],
      providers: {
        openai: config?.providers?.openai,
        anthropic: config?.providers?.anthropic,
        perplexity: config?.providers?.perplexity,
      },
      loadBalancing: {
        enabled: true,
        strategy: 'least-used',
        ...config?.loadBalancing,
      },
      ...config,
    };

    this.initializeClients();
    this.startHealthChecking();
  }

  /**
   * Generate text using the best available provider
   */
  async generateText(request: TextGenerationRequest): Promise<AIServiceResponse<TextGenerationResponse>> {
    const provider = this.selectProvider('generateText', request);
    
    if (!provider) {
      return {
        success: false,
        error: 'No available AI providers',
        metadata: { timestamp: Date.now() },
      };
    }

    logger.debug('Generating text', { provider, model: request.model });

    try {
      const client = this.clients.get(provider);
      if (!client) {
        throw new Error(`Client not available for provider: ${provider}`);
      }

      const response = await client.generateText(request);
      
      if (response.success) {
        this.recordSuccess(provider);
        this.emit('generation_success', { provider, request, response });
      } else if (this.shouldFallback(response.error)) {
        return this.fallbackGenerateText(request, [provider]);
      }

      return response;

    } catch (error) {
      logger.error('Text generation error', { provider, error });
      this.recordFailure(provider);
      
      const aiError = error as AIServiceError;
      if (aiError.retryable) {
        return this.fallbackGenerateText(request, [provider]);
      }

      return {
        success: false,
        error: aiError.message || 'Text generation failed',
        metadata: { provider, timestamp: Date.now() },
      };
    }
  }

  /**
   * Analyze content using the best available provider
   */
  async analyzeContent(request: AnalysisRequest): Promise<AIServiceResponse<AnalysisResponse>> {
    const provider = this.selectProvider('analyzeContent', request);
    
    if (!provider) {
      return {
        success: false,
        error: 'No available AI providers for analysis',
        metadata: { timestamp: Date.now() },
      };
    }

    logger.debug('Analyzing content', { provider, analysisType: request.analysisType });

    try {
      const client = this.clients.get(provider);
      if (!client?.analyzeContent) {
        throw new Error(`Analysis not supported by provider: ${provider}`);
      }

      const response = await client.analyzeContent(request);
      
      if (response.success) {
        this.recordSuccess(provider);
        this.emit('analysis_success', { provider, request, response });
      } else if (this.shouldFallback(response.error)) {
        return this.fallbackAnalyzeContent(request, [provider]);
      }

      return response;

    } catch (error) {
      logger.error('Content analysis error', { provider, error });
      this.recordFailure(provider);
      
      const aiError = error as AIServiceError;
      if (aiError.retryable) {
        return this.fallbackAnalyzeContent(request, [provider]);
      }

      return {
        success: false,
        error: aiError.message || 'Content analysis failed',
        metadata: { provider, timestamp: Date.now() },
      };
    }
  }

  /**
   * Conduct research using Perplexity (preferred) or fallback to other providers
   */
  async research(request: ResearchRequest): Promise<AIServiceResponse<ResearchResponse>> {
    // Prefer Perplexity for research due to real-time web access
    const perplexityClient = this.clients.get('perplexity') as PerplexityClient;
    
    if (perplexityClient && this.healthStatus.get('perplexity') && perplexityClient.research) {
      logger.debug('Conducting research with Perplexity', { query: request.query });
      
      try {
        const response = await perplexityClient.research(request);
        
        if (response.success) {
          this.recordSuccess('perplexity');
          this.emit('research_success', { provider: 'perplexity', request, response });
          return response;
        }
      } catch (error) {
        logger.warn('Perplexity research failed, falling back to text generation', { error });
        this.recordFailure('perplexity');
      }
    }

    // Fallback to text generation with research prompt
    const researchPrompt = `Research and provide comprehensive information about: ${request.query}

Please provide:
1. A detailed answer based on your knowledge
2. Key facts and figures where available
3. Important considerations or context
4. Potential implications or consequences

${request.domain ? `Focus specifically on the ${request.domain} domain.` : ''}
${request.recency ? `Emphasize recent developments if known.` : ''}`;

    const textResponse = await this.generateText({
      prompt: researchPrompt,
      maxTokens: 4000,
      temperature: 0.3,
      systemPrompt: 'You are a knowledgeable research assistant. Provide accurate, comprehensive information and clearly indicate when information might be outdated or when you\'re uncertain.',
    });

    if (!textResponse.success) {
      return {
        success: false,
        error: 'Research failed with all available providers',
        metadata: { timestamp: Date.now() },
      };
    }

    // Convert text response to research format
    const researchResponse: ResearchResponse = {
      answer: textResponse.data?.text || '',
      sources: [], // No sources available from text generation
      citations: [],
    };

    return {
      success: true,
      data: researchResponse,
      usage: textResponse.usage,
      metadata: {
        ...textResponse.metadata,
        fallback: true,
        note: 'Research conducted via text generation fallback',
      },
    };
  }

  /**
   * Get overall usage statistics across all providers
   */
  async getUsageStats() {
    const stats = {
      total: { requestsToday: 0, tokensUsed: 0, costToday: 0 },
      byProvider: {} as Record<AIProvider, any>,
    };

    for (const [provider, client] of this.clients) {
      try {
        const usage = await client.getUsage();
        stats.byProvider[provider] = usage;
        stats.total.requestsToday += usage.requestsToday;
        stats.total.tokensUsed += usage.tokensUsed;
        stats.total.costToday += usage.costToday;
      } catch (error) {
        logger.warn(`Failed to get usage for ${provider}`, { error });
        stats.byProvider[provider] = { error: 'Failed to retrieve usage' };
      }
    }

    return stats;
  }

  /**
   * Get health status of all providers
   */
  getHealthStatus() {
    return Object.fromEntries(this.healthStatus);
  }

  /**
   * Force refresh health status for all providers
   */
  async refreshHealthStatus() {
    const healthChecks = Array.from(this.clients.entries()).map(async ([provider, client]) => {
      try {
        const isHealthy = await client.healthCheck();
        this.healthStatus.set(provider, isHealthy);
        logger.debug(`Health check for ${provider}:`, isHealthy ? 'healthy' : 'unhealthy');
      } catch (error) {
        logger.warn(`Health check failed for ${provider}`, { error });
        this.healthStatus.set(provider, false);
      }
    });

    await Promise.all(healthChecks);
    this.emit('health_check_complete', this.getHealthStatus());
  }

  private initializeClients(): void {
    // Initialize OpenAI client
    if (this.config.providers.openai && config.openaiApiKey) {
      try {
        this.clients.set('openai', new OpenAIClient({
          apiKey: config.openaiApiKey,
          ...this.config.providers.openai,
        }));
        logger.info('OpenAI client initialized');
      } catch (error) {
        logger.error('Failed to initialize OpenAI client', { error });
      }
    }

    // Initialize Anthropic client
    if (this.config.providers.anthropic && config.anthropicApiKey) {
      try {
        this.clients.set('anthropic', new AnthropicClient({
          apiKey: config.anthropicApiKey,
          ...this.config.providers.anthropic,
        }));
        logger.info('Anthropic client initialized');
      } catch (error) {
        logger.error('Failed to initialize Anthropic client', { error });
      }
    }

    // Initialize Perplexity client
    if (this.config.providers.perplexity && config.perplexityApiKey) {
      try {
        this.clients.set('perplexity', new PerplexityClient({
          apiKey: config.perplexityApiKey,
          ...this.config.providers.perplexity,
        }));
        logger.info('Perplexity client initialized');
      } catch (error) {
        logger.error('Failed to initialize Perplexity client', { error });
      }
    }

    if (this.clients.size === 0) {
      logger.warn('No AI clients initialized - check API key configuration');
    }
  }

  private selectProvider(operation: string, request: any): AIProvider | null {
    const availableProviders = Array.from(this.clients.keys()).filter(provider => 
      this.healthStatus.get(provider) !== false
    );

    if (availableProviders.length === 0) {
      return null;
    }

    // Special case for research - prefer Perplexity
    if (operation === 'research' && availableProviders.includes('perplexity')) {
      return 'perplexity';
    }

    // Use default provider if available and healthy
    if (availableProviders.includes(this.config.defaultProvider)) {
      return this.config.defaultProvider;
    }

    // Load balancing strategy
    if (this.config.loadBalancing?.enabled) {
      switch (this.config.loadBalancing.strategy) {
        case 'round-robin':
          const provider = availableProviders[this.roundRobinIndex % availableProviders.length];
          this.roundRobinIndex++;
          return provider;

        case 'least-used':
          // For now, use round-robin (would need usage tracking for proper implementation)
          return availableProviders[this.roundRobinIndex++ % availableProviders.length];

        case 'fastest':
          // For now, use first available (would need response time tracking)
          return availableProviders[0];
      }
    }

    // Fallback to first available provider
    return availableProviders[0];
  }

  private async fallbackGenerateText(request: TextGenerationRequest, excludeProviders: AIProvider[]): Promise<AIServiceResponse<TextGenerationResponse>> {
    const availableProviders = this.config.fallbackProviders.filter(provider => 
      !excludeProviders.includes(provider) && this.clients.has(provider) && this.healthStatus.get(provider)
    );

    for (const provider of availableProviders) {
      try {
        const client = this.clients.get(provider);
        if (!client) continue;

        logger.debug('Falling back to provider', { provider });
        const response = await client.generateText(request);
        
        if (response.success) {
          this.emit('fallback_success', { provider, originalError: excludeProviders });
          return response;
        }
      } catch (error) {
        logger.warn(`Fallback provider ${provider} also failed`, { error });
      }
    }

    return {
      success: false,
      error: 'All fallback providers failed',
      metadata: { timestamp: Date.now() },
    };
  }

  private async fallbackAnalyzeContent(request: AnalysisRequest, excludeProviders: AIProvider[]): Promise<AIServiceResponse<AnalysisResponse>> {
    const availableProviders = this.config.fallbackProviders.filter(provider => 
      !excludeProviders.includes(provider) && this.clients.has(provider) && this.healthStatus.get(provider)
    );

    for (const provider of availableProviders) {
      try {
        const client = this.clients.get(provider);
        if (!client?.analyzeContent) continue;

        logger.debug('Falling back to provider for analysis', { provider });
        const response = await client.analyzeContent(request);
        
        if (response.success) {
          this.emit('fallback_success', { provider, originalError: excludeProviders, operation: 'analysis' });
          return response;
        }
      } catch (error) {
        logger.warn(`Fallback provider ${provider} also failed for analysis`, { error });
      }
    }

    return {
      success: false,
      error: 'All fallback providers failed for analysis',
      metadata: { timestamp: Date.now() },
    };
  }

  private shouldFallback(error?: string): boolean {
    if (!error) return false;
    
    // Don't fallback on authentication errors
    if (error.includes('401') || error.includes('authentication')) {
      return false;
    }
    
    // Fallback on rate limits, server errors, network errors
    return error.includes('429') || error.includes('500') || error.includes('network');
  }

  private recordSuccess(provider: AIProvider): void {
    this.healthStatus.set(provider, true);
    this.lastUsedProvider = provider;
  }

  private recordFailure(provider: AIProvider): void {
    // Don't immediately mark as unhealthy, wait for health check
    logger.warn(`Provider ${provider} request failed`);
  }

  private startHealthChecking(): void {
    // Initial health check
    this.refreshHealthStatus();

    // Periodic health checks every 5 minutes
    setInterval(() => {
      this.refreshHealthStatus();
    }, 5 * 60 * 1000);
  }
}

// Singleton instance
let unifiedAIClient: UnifiedAIClient | null = null;

export function getUnifiedAIClient(config?: Partial<UnifiedAIClientConfig>): UnifiedAIClient {
  if (!unifiedAIClient) {
    unifiedAIClient = new UnifiedAIClient(config);
  }
  return unifiedAIClient;
}

export function resetUnifiedAIClient(): void {
  unifiedAIClient = null;
}