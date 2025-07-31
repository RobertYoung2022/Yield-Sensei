/**
 * AI Service Integration Types
 * Common interfaces and types for AI service integrations
 */

export interface AIServiceConfig {
  apiKey: string;
  baseUrl?: string;
  timeout?: number;
  maxRetries?: number;
  retryDelay?: number;
  rateLimitRpm?: number;
}

export interface AIServiceResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
    cost?: number;
  };
  metadata?: {
    model?: string;
    provider?: string;
    requestId?: string;
    timestamp?: number;
  };
}

export interface TextGenerationRequest {
  prompt: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  systemPrompt?: string;
  stream?: boolean;
}

export interface TextGenerationResponse {
  text: string;
  finishReason?: 'stop' | 'length' | 'content_filter' | 'function_call';
  model?: string;
}

export interface ResearchRequest {
  query: string;
  domain?: string;
  sources?: string[];
  maxResults?: number;
  recency?: 'day' | 'week' | 'month' | 'year';
}

export interface ResearchResponse {
  answer: string;
  sources: Array<{
    title: string;
    url: string;
    snippet: string;
    publishedDate?: string;
    domain?: string;
  }>;
  citations: string[];
}

export interface AnalysisRequest {
  content: string;
  analysisType: 'sentiment' | 'summary' | 'classification' | 'extraction';
  context?: string;
  options?: Record<string, any>;
}

export interface AnalysisResponse {
  result: any;
  confidence?: number;
  explanation?: string;
}

export type AIProvider = 'openai' | 'anthropic' | 'perplexity';

export interface AIServiceClient {
  readonly provider: AIProvider;
  readonly config: AIServiceConfig;
  
  // Core capabilities
  generateText(request: TextGenerationRequest): Promise<AIServiceResponse<TextGenerationResponse>>;
  analyzeContent?(request: AnalysisRequest): Promise<AIServiceResponse<AnalysisResponse>>;
  research?(request: ResearchRequest): Promise<AIServiceResponse<ResearchResponse>>;
  
  // Service management
  healthCheck(): Promise<boolean>;
  getUsage(): Promise<{
    requestsToday: number;
    tokensUsed: number;
    costToday: number;
  }>;
}

export interface UnifiedAIClientConfig {
  defaultProvider: AIProvider;
  fallbackProviders: AIProvider[];
  providers: {
    openai?: AIServiceConfig;
    anthropic?: AIServiceConfig;
    perplexity?: AIServiceConfig;
  };
  loadBalancing?: {
    enabled: boolean;
    strategy: 'round-robin' | 'least-used' | 'fastest';
  };
}

export interface AIServiceError extends Error {
  provider: AIProvider;
  statusCode?: number;
  type: 'authentication' | 'rate_limit' | 'invalid_request' | 'server_error' | 'network_error';
  retryable: boolean;
}

// Model definitions for each provider
export const AI_MODELS = {
  openai: {
    'gpt-4o': { maxTokens: 128000, costPer1kTokens: { input: 0.005, output: 0.015 } },
    'gpt-4o-mini': { maxTokens: 128000, costPer1kTokens: { input: 0.00015, output: 0.0006 } },
    'gpt-4-turbo': { maxTokens: 128000, costPer1kTokens: { input: 0.01, output: 0.03 } },
    'gpt-3.5-turbo': { maxTokens: 16385, costPer1kTokens: { input: 0.0015, output: 0.002 } },
  },
  anthropic: {
    'claude-3-5-sonnet-20241022': { maxTokens: 200000, costPer1kTokens: { input: 0.003, output: 0.015 } },
    'claude-3-opus-20240229': { maxTokens: 200000, costPer1kTokens: { input: 0.015, output: 0.075 } },
    'claude-3-haiku-20240307': { maxTokens: 200000, costPer1kTokens: { input: 0.00025, output: 0.00125 } },
  },
  perplexity: {
    'llama-3.1-sonar-small-128k-online': { maxTokens: 127072, costPer1kTokens: { input: 0.0002, output: 0.0002 } },
    'llama-3.1-sonar-large-128k-online': { maxTokens: 127072, costPer1kTokens: { input: 0.001, output: 0.001 } },
    'llama-3.1-sonar-huge-128k-online': { maxTokens: 127072, costPer1kTokens: { input: 0.005, output: 0.005 } },
  },
} as const;

export type OpenAIModel = keyof typeof AI_MODELS.openai;
export type AnthropicModel = keyof typeof AI_MODELS.anthropic;
export type PerplexityModel = keyof typeof AI_MODELS.perplexity;