/**
 * Anthropic API Client
 * Handles Claude 3.5 Sonnet integration for advanced reasoning and analysis
 */

import Anthropic from '@anthropic-ai/sdk';
import Logger from '@/shared/logging/logger';
import { 
  AIServiceClient, 
  AIServiceConfig, 
  AIServiceResponse, 
  TextGenerationRequest, 
  TextGenerationResponse,
  AnalysisRequest,
  AnalysisResponse,
  AIServiceError,
  AnthropicModel,
  AI_MODELS
} from './types';

const logger = Logger.getLogger('anthropic-client');

export class AnthropicClient implements AIServiceClient {
  public readonly provider = 'anthropic' as const;
  public readonly config: AIServiceConfig;
  private client: Anthropic;
  private usageStats = {
    requestsToday: 0,
    tokensUsed: 0,
    costToday: 0,
    lastResetDate: new Date().toDateString(),
  };

  constructor(config: AIServiceConfig) {
    this.config = {
      timeout: 60000, // Claude can be slower
      maxRetries: 3,
      retryDelay: 2000,
      rateLimitRpm: 50, // More conservative rate limit
      ...config,
    };

    this.client = new Anthropic({
      apiKey: this.config.apiKey,
      timeout: this.config.timeout,
      maxRetries: this.config.maxRetries,
      baseURL: this.config.baseUrl,
    });

    this.resetUsageIfNewDay();
  }

  async generateText(request: TextGenerationRequest): Promise<AIServiceResponse<TextGenerationResponse>> {
    try {
      const model = request.model as AnthropicModel || 'claude-3-5-sonnet-20241022';
      const modelInfo = AI_MODELS.anthropic[model];

      if (!modelInfo) {
        throw new Error(`Unsupported Anthropic model: ${model}`);
      }

      logger.debug('Generating text with Anthropic', {
        model,
        promptLength: request.prompt.length,
        maxTokens: request.maxTokens,
      });

      const messages: Anthropic.MessageParam[] = [
        { role: 'user', content: request.prompt }
      ];

      const requestParams: Anthropic.MessageCreateParams = {
        model,
        messages,
        max_tokens: request.maxTokens || 4000,
        temperature: request.temperature || 0.7,
        top_p: request.topP || 1,
        stream: request.stream || false,
      };

      // Add system prompt if provided
      if (request.systemPrompt) {
        requestParams.system = request.systemPrompt;
      }

      const completion = await this.client.messages.create(requestParams);

      // Handle different content types
      let responseText = '';
      if (completion.content && completion.content.length > 0) {
        const content = completion.content[0];
        if (content.type === 'text') {
          responseText = content.text;
        }
      }

      // Update usage statistics
      if (completion.usage) {
        this.usageStats.tokensUsed += completion.usage.input_tokens + completion.usage.output_tokens;
        this.usageStats.costToday += this.calculateCost(completion.usage, modelInfo);
      }
      this.usageStats.requestsToday++;

      const response: TextGenerationResponse = {
        text: responseText,
        finishReason: completion.stop_reason as any,
        model,
      };

      logger.debug('Anthropic text generation completed', {
        model,
        tokensUsed: completion.usage ? completion.usage.input_tokens + completion.usage.output_tokens : 0,
        finishReason: completion.stop_reason,
      });

      return {
        success: true,
        data: response,
        usage: completion.usage ? {
          promptTokens: completion.usage.input_tokens,
          completionTokens: completion.usage.output_tokens,
          totalTokens: completion.usage.input_tokens + completion.usage.output_tokens,
          cost: this.calculateCost(completion.usage, modelInfo),
        } : undefined,
        metadata: {
          model,
          provider: 'anthropic',
          requestId: completion.id,
          timestamp: Date.now(),
        },
      };

    } catch (error) {
      const aiError = this.handleError(error);
      logger.error('Anthropic text generation failed', {
        error: aiError.message,
        type: aiError.type,
        retryable: aiError.retryable,
      });

      return {
        success: false,
        error: aiError.message,
        metadata: {
          provider: 'anthropic',
          timestamp: Date.now(),
        },
      };
    }
  }

  async analyzeContent(request: AnalysisRequest): Promise<AIServiceResponse<AnalysisResponse>> {
    try {
      let systemPrompt = '';
      let analysisPrompt = '';

      switch (request.analysisType) {
        case 'sentiment':
          systemPrompt = 'You are Claude, an AI assistant specializing in sentiment analysis for cryptocurrency and DeFi content. You provide accurate, nuanced sentiment analysis with detailed explanations.';
          analysisPrompt = `Please analyze the sentiment of the following content and provide your analysis in JSON format:

Content: ${request.content}

Please return a JSON object with:
- sentiment: "positive", "negative", or "neutral"
- confidence: number between 0-1 representing your confidence
- explanation: detailed explanation of the sentiment analysis
- key_phrases: array of phrases that most influenced the sentiment
- nuance: any important nuances or mixed sentiments detected

Focus on crypto/DeFi specific context and terminology.`;
          break;

        case 'summary':
          systemPrompt = 'You are Claude, an AI assistant expert at creating comprehensive yet concise summaries, particularly for complex cryptocurrency and DeFi content.';
          analysisPrompt = `Please create a comprehensive summary of the following content:

${request.content}

Return a JSON object with:
- summary: main summary (2-3 sentences)
- key_points: array of 5-7 most important points
- implications: potential implications or consequences
- confidence: your confidence in the summary accuracy (0-1)
- complexity_level: "beginner", "intermediate", or "advanced"`;
          break;

        case 'classification':
          systemPrompt = 'You are Claude, an AI assistant specialized in content classification for cryptocurrency, DeFi, and blockchain topics.';
          analysisPrompt = `Please classify the following content into relevant categories:

${request.content}

Return a JSON object with:
- primary_category: main category (e.g., "DeFi", "NFT", "Layer1", "Trading", etc.)
- secondary_categories: array of additional relevant categories
- topics: specific topics, protocols, or technologies mentioned
- confidence: confidence score (0-1)
- technical_level: "beginner", "intermediate", or "advanced"
- sentiment_bias: any detected bias in the content`;
          break;

        case 'extraction':
          systemPrompt = 'You are Claude, an AI assistant expert at extracting structured information from unstructured content, especially in the cryptocurrency and DeFi space.';
          analysisPrompt = `Please extract key structured information from the following content:

${request.content}

${request.context ? `Context: ${request.context}` : ''}

Please identify and extract:
- entities: people, projects, protocols, tokens mentioned
- numbers: prices, percentages, volumes, dates
- relationships: connections between entities
- claims: assertions or predictions made
- sources: any sources or references mentioned
- confidence: your confidence in the extraction accuracy (0-1)

Return as a structured JSON object.`;
          break;

        default:
          throw new Error(`Unsupported analysis type: ${request.analysisType}`);
      }

      const textResponse = await this.generateText({
        prompt: analysisPrompt,
        systemPrompt,
        model: 'claude-3-haiku-20240307', // Use efficient model for analysis
        maxTokens: 3000,
        temperature: 0.3, // Lower temperature for consistent analysis
      });

      if (!textResponse.success || !textResponse.data) {
        throw new Error('Failed to get analysis from Anthropic');
      }

      // Try to parse JSON response
      let result: any;
      try {
        result = JSON.parse(textResponse.data.text);
      } catch {
        // If JSON parsing fails, try to extract JSON from the response
        const jsonMatch = textResponse.data.text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            result = JSON.parse(jsonMatch[0]);
          } catch {
            result = { analysis: textResponse.data.text };
          }
        } else {
          result = { analysis: textResponse.data.text };
        }
      }

      const analysisResponse: AnalysisResponse = {
        result,
        confidence: result.confidence || 0.85,
        explanation: result.explanation || 'Analysis completed with Claude',
      };

      return {
        success: true,
        data: analysisResponse,
        usage: textResponse.usage,
        metadata: textResponse.metadata,
      };

    } catch (error) {
      const aiError = this.handleError(error);
      logger.error('Anthropic content analysis failed', {
        error: aiError.message,
        analysisType: request.analysisType,
      });

      return {
        success: false,
        error: aiError.message,
        metadata: {
          provider: 'anthropic',
          timestamp: Date.now(),
        },
      };
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      // Simple test with minimal token usage
      const response = await this.client.messages.create({
        model: 'claude-3-haiku-20240307',
        messages: [{ role: 'user', content: 'Hello' }],
        max_tokens: 10,
      });
      return response.content.length > 0;
    } catch (error) {
      logger.warn('Anthropic health check failed', { error });
      return false;
    }
  }

  async getUsage() {
    this.resetUsageIfNewDay();
    return { ...this.usageStats };
  }

  private calculateCost(usage: { input_tokens: number; output_tokens: number }, modelInfo: typeof AI_MODELS.anthropic[AnthropicModel]): number {
    const inputCost = (usage.input_tokens / 1000) * modelInfo.costPer1kTokens.input;
    const outputCost = (usage.output_tokens / 1000) * modelInfo.costPer1kTokens.output;
    return inputCost + outputCost;
  }

  private handleError(error: any): AIServiceError {
    let type: AIServiceError['type'] = 'server_error';
    let retryable = true;
    let statusCode: number | undefined;

    if (error instanceof Anthropic.APIError) {
      statusCode = error.status;
      
      if (error.status === 401) {
        type = 'authentication';
        retryable = false;
      } else if (error.status === 429) {
        type = 'rate_limit';
        retryable = true;
      } else if (error.status >= 400 && error.status < 500) {
        type = 'invalid_request';
        retryable = false;
      } else if (error.status >= 500) {
        type = 'server_error';
        retryable = true;
      }
    } else if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      type = 'network_error';
      retryable = true;
    }

    const aiError = new Error(error.message || 'Anthropic API error') as AIServiceError;
    aiError.provider = 'anthropic';
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