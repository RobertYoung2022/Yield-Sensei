/**
 * OpenAI API Client
 * Handles GPT-4, GPT-3.5-turbo integration for text generation and analysis
 */

import OpenAI from 'openai';
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
  OpenAIModel,
  AI_MODELS
} from './types';

const logger = Logger.getLogger('openai-client');

export class OpenAIClient implements AIServiceClient {
  public readonly provider = 'openai' as const;
  public readonly config: AIServiceConfig;
  private client: OpenAI;
  private usageStats = {
    requestsToday: 0,
    tokensUsed: 0,
    costToday: 0,
    lastResetDate: new Date().toDateString(),
  };

  constructor(config: AIServiceConfig) {
    this.config = {
      timeout: 30000,
      maxRetries: 3,
      retryDelay: 1000,
      rateLimitRpm: 3500, // Default for GPT-4
      ...config,
    };

    this.client = new OpenAI({
      apiKey: this.config.apiKey,
      timeout: this.config.timeout,
      maxRetries: this.config.maxRetries,
      baseURL: this.config.baseUrl,
    });

    this.resetUsageIfNewDay();
  }

  async generateText(request: TextGenerationRequest): Promise<AIServiceResponse<TextGenerationResponse>> {
    try {
      const model = request.model as OpenAIModel || 'gpt-4o-mini';
      const modelInfo = AI_MODELS.openai[model];

      if (!modelInfo) {
        throw new Error(`Unsupported OpenAI model: ${model}`);
      }

      logger.debug('Generating text with OpenAI', {
        model,
        promptLength: request.prompt.length,
        maxTokens: request.maxTokens,
      });

      const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];
      
      if (request.systemPrompt) {
        messages.push({ role: 'system', content: request.systemPrompt });
      }
      
      messages.push({ role: 'user', content: request.prompt });

      const completion = await this.client.chat.completions.create({
        model,
        messages,
        max_tokens: request.maxTokens || 4000,
        temperature: request.temperature || 0.7,
        top_p: request.topP || 1,
        stream: request.stream || false,
      });

      const choice = completion.choices[0];
      const usage = completion.usage;

      // Update usage statistics
      if (usage) {
        this.usageStats.tokensUsed += usage.total_tokens;
        this.usageStats.costToday += this.calculateCost(usage, modelInfo);
      }
      this.usageStats.requestsToday++;

      const response: TextGenerationResponse = {
        text: choice.message?.content || '',
        finishReason: choice.finish_reason as any,
        model,
      };

      logger.debug('OpenAI text generation completed', {
        model,
        tokensUsed: usage?.total_tokens,
        finishReason: choice.finish_reason,
      });

      return {
        success: true,
        data: response,
        usage: usage ? {
          promptTokens: usage.prompt_tokens,
          completionTokens: usage.completion_tokens,
          totalTokens: usage.total_tokens,
          cost: this.calculateCost(usage, modelInfo),
        } : undefined,
        metadata: {
          model,
          provider: 'openai',
          requestId: completion.id,
          timestamp: Date.now(),
        },
      };

    } catch (error) {
      const aiError = this.handleError(error);
      logger.error('OpenAI text generation failed', {
        error: aiError.message,
        type: aiError.type,
        retryable: aiError.retryable,
      });

      return {
        success: false,
        error: aiError.message,
        metadata: {
          provider: 'openai',
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
          systemPrompt = 'You are a sentiment analysis expert specializing in cryptocurrency and DeFi content. Analyze the sentiment and provide a confidence score.';
          analysisPrompt = `Analyze the sentiment of the following content and return a JSON object with:
- sentiment: "positive", "negative", or "neutral"
- confidence: number between 0-1
- explanation: brief explanation of the sentiment
- key_phrases: array of important phrases that influenced the sentiment

Content: ${request.content}`;
          break;

        case 'summary':
          systemPrompt = 'You are an expert at creating concise, accurate summaries of complex content, especially in cryptocurrency and DeFi domains.';
          analysisPrompt = `Create a concise summary of the following content:

${request.content}

Return a JSON object with:
- summary: the main summary
- key_points: array of 3-5 key points
- confidence: your confidence in the summary accuracy (0-1)`;
          break;

        case 'classification':
          systemPrompt = 'You are a content classifier specializing in cryptocurrency and DeFi topics.';
          analysisPrompt = `Classify the following content into relevant categories:

${request.content}

Return a JSON object with:
- primary_category: main category
- secondary_categories: array of additional relevant categories
- confidence: confidence score (0-1)
- topics: array of specific topics mentioned`;
          break;

        case 'extraction':
          systemPrompt = 'You are an expert at extracting structured information from unstructured content.';
          analysisPrompt = `Extract key information from the following content:

${request.content}

${request.context ? `Context: ${request.context}` : ''}

Return a JSON object with extracted information relevant to the context.`;
          break;

        default:
          throw new Error(`Unsupported analysis type: ${request.analysisType}`);
      }

      const textResponse = await this.generateText({
        prompt: analysisPrompt,
        systemPrompt,
        model: 'gpt-4o-mini', // Use efficient model for analysis
        maxTokens: 2000,
        temperature: 0.3, // Lower temperature for more consistent analysis
      });

      if (!textResponse.success || !textResponse.data) {
        throw new Error('Failed to get analysis from OpenAI');
      }

      // Try to parse JSON response
      let result: any;
      try {
        result = JSON.parse(textResponse.data.text);
      } catch {
        // If JSON parsing fails, return raw text
        result = { analysis: textResponse.data.text };
      }

      const analysisResponse: AnalysisResponse = {
        result,
        confidence: result.confidence || 0.8,
        explanation: result.explanation || 'Analysis completed successfully',
      };

      return {
        success: true,
        data: analysisResponse,
        usage: textResponse.usage,
        metadata: textResponse.metadata,
      };

    } catch (error) {
      const aiError = this.handleError(error);
      logger.error('OpenAI content analysis failed', {
        error: aiError.message,
        analysisType: request.analysisType,
      });

      return {
        success: false,
        error: aiError.message,
        metadata: {
          provider: 'openai',
          timestamp: Date.now(),
        },
      };
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.client.models.list();
      return response.data.length > 0;
    } catch (error) {
      logger.warn('OpenAI health check failed', { error });
      return false;
    }
  }

  async getUsage() {
    this.resetUsageIfNewDay();
    return { ...this.usageStats };
  }

  private calculateCost(usage: OpenAI.CompletionUsage, modelInfo: typeof AI_MODELS.openai[OpenAIModel]): number {
    const inputCost = (usage.prompt_tokens / 1000) * modelInfo.costPer1kTokens.input;
    const outputCost = (usage.completion_tokens / 1000) * modelInfo.costPer1kTokens.output;
    return inputCost + outputCost;
  }

  private handleError(error: any): AIServiceError {
    let type: AIServiceError['type'] = 'server_error';
    let retryable = true;
    let statusCode: number | undefined;

    if (error instanceof OpenAI.APIError) {
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

    const aiError = new Error(error.message || 'OpenAI API error') as AIServiceError;
    aiError.provider = 'openai';
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