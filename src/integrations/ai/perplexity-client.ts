/**
 * Perplexity API Client
 * Handles real-time research and web search capabilities
 */

import Logger from '@/shared/logging/logger';
import { 
  AIServiceClient, 
  AIServiceConfig, 
  AIServiceResponse, 
  TextGenerationRequest, 
  TextGenerationResponse,
  ResearchRequest,
  ResearchResponse,
  AIServiceError,
  PerplexityModel,
  AI_MODELS
} from './types';

const logger = Logger.getLogger('perplexity-client');

interface PerplexityAPIResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
    delta?: any;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export class PerplexityClient implements AIServiceClient {
  public readonly provider = 'perplexity' as const;
  public readonly config: AIServiceConfig;
  private usageStats = {
    requestsToday: 0,
    tokensUsed: 0,
    costToday: 0,
    lastResetDate: new Date().toDateString(),
  };

  constructor(config: AIServiceConfig) {
    this.config = {
      baseUrl: 'https://api.perplexity.ai',
      timeout: 45000, // Research can take longer
      maxRetries: 3,
      retryDelay: 2000,
      rateLimitRpm: 20, // Conservative rate limit for research queries
      ...config,
    };

    this.resetUsageIfNewDay();
  }

  async generateText(request: TextGenerationRequest): Promise<AIServiceResponse<TextGenerationResponse>> {
    try {
      const model = request.model as PerplexityModel || 'llama-3.1-sonar-small-128k-online';
      const modelInfo = AI_MODELS.perplexity[model];

      if (!modelInfo) {
        throw new Error(`Unsupported Perplexity model: ${model}`);
      }

      logger.debug('Generating text with Perplexity', {
        model,
        promptLength: request.prompt.length,
        maxTokens: request.maxTokens,
      });

      const messages = [];
      
      if (request.systemPrompt) {
        messages.push({ role: 'system', content: request.systemPrompt });
      }
      
      messages.push({ role: 'user', content: request.prompt });

      const requestBody = {
        model,
        messages,
        max_tokens: request.maxTokens || 4000,
        temperature: request.temperature || 0.7,
        top_p: request.topP || 1,
        stream: request.stream || false,
      };

      const response = await this.makeRequest('/chat/completions', requestBody);

      const choice = response.choices[0];
      const usage = response.usage;

      // Update usage statistics
      if (usage) {
        this.usageStats.tokensUsed += usage.total_tokens;
        this.usageStats.costToday += this.calculateCost(usage, modelInfo);
      }
      this.usageStats.requestsToday++;

      const textResponse: TextGenerationResponse = {
        text: choice.message?.content || '',
        finishReason: choice.finish_reason as any,
        model,
      };

      logger.debug('Perplexity text generation completed', {
        model,
        tokensUsed: usage?.total_tokens,
        finishReason: choice.finish_reason,
      });

      return {
        success: true,
        data: textResponse,
        usage: usage ? {
          promptTokens: usage.prompt_tokens,
          completionTokens: usage.completion_tokens,
          totalTokens: usage.total_tokens,
          cost: this.calculateCost(usage, modelInfo),
        } : undefined,
        metadata: {
          model,
          provider: 'perplexity',
          requestId: response.id,
          timestamp: Date.now(),
        },
      };

    } catch (error) {
      const aiError = this.handleError(error);
      logger.error('Perplexity text generation failed', {
        error: aiError.message,
        type: aiError.type,
        retryable: aiError.retryable,
      });

      return {
        success: false,
        error: aiError.message,
        metadata: {
          provider: 'perplexity',
          timestamp: Date.now(),
        },
      };
    }
  }

  async research(request: ResearchRequest): Promise<AIServiceResponse<ResearchResponse>> {
    try {
      logger.debug('Conducting research with Perplexity', {
        query: request.query,
        domain: request.domain,
        maxResults: request.maxResults,
      });

      // Construct research prompt
      let researchPrompt = `Research the following query and provide a comprehensive answer with sources:\n\n${request.query}`;
      
      if (request.domain) {
        researchPrompt += `\n\nFocus on the ${request.domain} domain specifically.`;
      }
      
      if (request.recency) {
        researchPrompt += `\n\nPrioritize recent information from the last ${request.recency}.`;
      }
      
      researchPrompt += `\n\nPlease structure your response as:
1. A clear, comprehensive answer
2. List of sources with titles, URLs, and brief descriptions
3. Key citations that support your answer

Format sources as JSON at the end: {"sources": [...]}`;

      // Use online model for research
      const model = 'llama-3.1-sonar-large-128k-online';
      
      const textResponse = await this.generateText({
        prompt: researchPrompt,
        model,
        maxTokens: 6000,
        temperature: 0.3, // Lower temperature for factual research
        systemPrompt: 'You are a research assistant that provides accurate, well-sourced information. Always cite your sources and focus on recent, credible information.',
      });

      if (!textResponse.success || !textResponse.data) {
        throw new Error('Failed to get research results from Perplexity');
      }

      // Parse the response to extract sources
      const responseText = textResponse.data.text;
      let sources: ResearchResponse['sources'] = [];
      let answer = responseText;
      let citations: string[] = [];

      // Try to extract JSON sources from the response
      try {
        const jsonMatch = responseText.match(/\{"sources":\s*\[[\s\S]*?\]\}/);
        if (jsonMatch) {
          const sourcesData = JSON.parse(jsonMatch[0]);
          sources = sourcesData.sources || [];
          answer = responseText.replace(jsonMatch[0], '').trim();
        }
      } catch (parseError) {
        logger.warn('Could not parse sources from Perplexity response', { parseError });
        
        // Fallback: extract URLs from the text
        const urlRegex = /https?:\/\/[^\s\)]+/g;
        const urls = responseText.match(urlRegex) || [];
        sources = urls.slice(0, request.maxResults || 5).map((url, index) => ({
          title: `Source ${index + 1}`,
          url,
          snippet: 'Referenced in research response',
          domain: new URL(url).hostname,
        }));
      }

      // Extract citations (sentences with specific claims)
      const sentences = answer.split(/[.!?]+/).filter(s => s.trim().length > 20);
      citations = sentences.slice(0, 3).map(s => s.trim());

      const researchResponse: ResearchResponse = {
        answer: answer.trim(),
        sources: sources.slice(0, request.maxResults || 10),
        citations,
      };

      logger.debug('Perplexity research completed', {
        answerLength: answer.length,
        sourcesCount: sources.length,
        citationsCount: citations.length,
      });

      return {
        success: true,
        data: researchResponse,
        usage: textResponse.usage,
        metadata: textResponse.metadata,
      };

    } catch (error) {
      const aiError = this.handleError(error);
      logger.error('Perplexity research failed', {
        error: aiError.message,
        query: request.query,
      });

      return {
        success: false,
        error: aiError.message,
        metadata: {
          provider: 'perplexity',
          timestamp: Date.now(),
        },
      };
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.generateText({
        prompt: 'Hello',
        model: 'llama-3.1-sonar-small-128k-online',
        maxTokens: 10,
      });
      return response.success;
    } catch (error) {
      logger.warn('Perplexity health check failed', { error });
      return false;
    }
  }

  async getUsage() {
    this.resetUsageIfNewDay();
    return { ...this.usageStats };
  }

  private async makeRequest(endpoint: string, body: any): Promise<PerplexityAPIResponse> {
    const url = `${this.config.baseUrl}${endpoint}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Perplexity API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    return response.json();
  }

  private calculateCost(usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number }, modelInfo: typeof AI_MODELS.perplexity[PerplexityModel]): number {
    return (usage.total_tokens / 1000) * modelInfo.costPer1kTokens.input;
  }

  private handleError(error: any): AIServiceError {
    let type: AIServiceError['type'] = 'server_error';
    let retryable = true;
    let statusCode: number | undefined;

    if (error.message?.includes('401')) {
      type = 'authentication';
      retryable = false;
      statusCode = 401;
    } else if (error.message?.includes('429')) {
      type = 'rate_limit';
      retryable = true;
      statusCode = 429;
    } else if (error.message?.includes('400')) {
      type = 'invalid_request';
      retryable = false;
      statusCode = 400;
    } else if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      type = 'network_error';
      retryable = true;
    }

    const aiError = new Error(error.message || 'Perplexity API error') as AIServiceError;
    aiError.provider = 'perplexity';
    aiError.type = type;
    aiError.retryable = retryable;
    aiError.statusCode = statusCode;

    return aiError;
  }

  private resetUsageIfNewDay(): void {
    const today = new Date().toDateString();
    if (this.usageStats.lastResetDate !== today) {
      this.usageStats = {
        requestsToday: 0,
        tokensUsed: 0,
        costToday: 0,
        lastResetDate: today,
      };
    }
  }
}