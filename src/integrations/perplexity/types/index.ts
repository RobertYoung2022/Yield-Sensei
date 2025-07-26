/**
 * Perplexity API Integration Types
 * Core type definitions for the Perplexity API integration framework
 */

// API Configuration
export interface PerplexityConfig {
  apiKey: string;
  baseUrl?: string;
  timeout?: number;
  maxRetries?: number;
  rateLimit?: RateLimitConfig;
  cache?: CacheConfig;
  fallback?: FallbackConfig;
}

export interface RateLimitConfig {
  maxRequestsPerMinute: number;
  maxRequestsPerHour: number;
  maxRequestsPerDay: number;
  queueSize: number;
  enableBurstMode?: boolean;
  burstLimit?: number;
}

export interface CacheConfig {
  enabled: boolean;
  ttl: number; // milliseconds
  maxSize: number; // MB
  strategy: 'lru' | 'lfu' | 'fifo';
  persistToDisk?: boolean;
  diskPath?: string;
}

export interface FallbackConfig {
  enabled: boolean;
  providers: FallbackProvider[];
  strategy: 'sequential' | 'parallel' | 'load-balanced';
}

export interface FallbackProvider {
  name: string;
  type: 'cache' | 'alternative-api' | 'static-data';
  config: Record<string, any>;
}

// API Request/Response Types
export interface PerplexityRequest {
  model: string;
  messages: Message[];
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  return_citations?: boolean;
  return_related_questions?: boolean;
  search_domain_filter?: string[];
  search_recency_filter?: 'day' | 'week' | 'month' | 'year';
  stream?: boolean;
}

export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface PerplexityResponse {
  id: string;
  model: string;
  created: number;
  usage: Usage;
  choices: Choice[];
  citations?: Citation[];
  related_questions?: string[];
}

export interface Usage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

export interface Choice {
  index: number;
  finish_reason: string;
  message: Message;
  delta?: Message;
}

export interface Citation {
  url: string;
  title: string;
  snippet: string;
  index: number;
}

// Financial Data Types
export interface SECFiling {
  id: string;
  companyName: string;
  ticker: string;
  formType: string; // 10-K, 10-Q, 8-K, etc.
  filingDate: Date;
  periodEnd: Date;
  accessionNumber: string;
  documentUrl: string;
  extractedData: ExtractedFinancialData;
  analysis?: FinancialAnalysis;
}

export interface ExtractedFinancialData {
  revenue?: number;
  netIncome?: number;
  eps?: number;
  totalAssets?: number;
  totalLiabilities?: number;
  shareholderEquity?: number;
  cashFlow?: CashFlowData;
  segments?: SegmentData[];
  riskFactors?: string[];
  mdaHighlights?: string[]; // Management Discussion & Analysis
}

export interface CashFlowData {
  operating: number;
  investing: number;
  financing: number;
  freeCashFlow: number;
}

export interface SegmentData {
  name: string;
  revenue: number;
  operatingIncome: number;
  assets?: number;
}

export interface FinancialAnalysis {
  profitabilityMetrics: ProfitabilityMetrics;
  liquidityMetrics: LiquidityMetrics;
  efficiencyMetrics: EfficiencyMetrics;
  growthMetrics: GrowthMetrics;
  valuation?: ValuationMetrics;
}

export interface ProfitabilityMetrics {
  grossMargin: number;
  operatingMargin: number;
  netMargin: number;
  roe: number; // Return on Equity
  roa: number; // Return on Assets
}

export interface LiquidityMetrics {
  currentRatio: number;
  quickRatio: number;
  cashRatio: number;
  workingCapital: number;
}

export interface EfficiencyMetrics {
  assetTurnover: number;
  inventoryTurnover?: number;
  receivablesTurnover?: number;
  daysSalesOutstanding?: number;
}

export interface GrowthMetrics {
  revenueGrowthYoY: number;
  revenueGrowthQoQ: number;
  earningsGrowthYoY: number;
  earningsGrowthQoQ: number;
}

export interface ValuationMetrics {
  peRatio?: number;
  pegRatio?: number;
  priceToBook?: number;
  priceToSales?: number;
  evToEbitda?: number;
}

// Regulatory Monitoring Types
export interface RegulatoryAlert {
  id: string;
  type: 'new-regulation' | 'amendment' | 'enforcement' | 'guidance' | 'consultation';
  severity: 'low' | 'medium' | 'high' | 'critical';
  jurisdiction: string;
  agency: string;
  title: string;
  summary: string;
  effectiveDate?: Date;
  deadlineDate?: Date;
  impactedAreas: string[];
  requiredActions?: string[];
  sourceUrl: string;
  fullText?: string;
  analysis?: RegulatoryAnalysis;
}

export interface RegulatoryAnalysis {
  complianceRequirements: ComplianceRequirement[];
  impactAssessment: ImpactAssessment;
  recommendedActions: string[];
  estimatedComplianceCost?: number;
  implementationTimeline?: string;
}

export interface ComplianceRequirement {
  id: string;
  description: string;
  category: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  deadline?: Date;
  status?: 'pending' | 'in-progress' | 'completed' | 'overdue';
}

export interface ImpactAssessment {
  businessImpact: 'minimal' | 'moderate' | 'significant' | 'severe';
  operationalChanges: string[];
  financialImpact?: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

// Market Intelligence Types
export interface MarketIntelligence {
  id: string;
  timestamp: Date;
  assetId: string;
  assetType: 'stock' | 'crypto' | 'commodity' | 'rwa';
  sentiment: MarketSentiment;
  analystRatings?: AnalystRatings;
  newsAnalysis?: NewsAnalysis;
  trendAnalysis?: TrendAnalysis;
  competitiveAnalysis?: CompetitiveAnalysis;
}

export interface MarketSentiment {
  overall: number; // -1 to 1
  bullish: number; // 0 to 1
  bearish: number; // 0 to 1
  neutral: number; // 0 to 1
  confidence: number; // 0 to 1
  sources: SentimentSource[];
}

export interface SentimentSource {
  type: 'news' | 'social' | 'analyst' | 'insider';
  name: string;
  sentiment: number;
  weight: number;
  timestamp: Date;
}

export interface AnalystRatings {
  consensus: 'strong-buy' | 'buy' | 'hold' | 'sell' | 'strong-sell';
  averageTarget: number;
  highTarget: number;
  lowTarget: number;
  numberOfAnalysts: number;
  recentChanges: RatingChange[];
}

export interface RatingChange {
  analyst: string;
  firm: string;
  previousRating: string;
  newRating: string;
  previousTarget?: number;
  newTarget?: number;
  date: Date;
  rationale?: string;
}

export interface NewsAnalysis {
  topStories: NewsStory[];
  keyThemes: string[];
  impactEvents: ImpactEvent[];
  mediaAttention: number; // 0 to 1
}

export interface NewsStory {
  id: string;
  headline: string;
  summary: string;
  source: string;
  url: string;
  publishedAt: Date;
  sentiment: number;
  relevance: number;
  entities: string[];
}

export interface ImpactEvent {
  type: string;
  description: string;
  expectedImpact: 'positive' | 'negative' | 'neutral';
  probability: number;
  timeframe: string;
}

export interface TrendAnalysis {
  shortTermTrend: 'bullish' | 'bearish' | 'neutral';
  mediumTermTrend: 'bullish' | 'bearish' | 'neutral';
  longTermTrend: 'bullish' | 'bearish' | 'neutral';
  momentum: number; // -1 to 1
  volatility: number; // 0 to 1
  correlations: AssetCorrelation[];
}

export interface AssetCorrelation {
  assetId: string;
  assetName: string;
  correlation: number; // -1 to 1
  period: string;
}

export interface CompetitiveAnalysis {
  marketPosition: number; // 1 to n
  marketShare: number; // 0 to 1
  competitiveAdvantages: string[];
  competitiveThreats: string[];
  peerComparison: PeerComparison[];
}

export interface PeerComparison {
  peerId: string;
  peerName: string;
  metrics: Record<string, number>;
  relativePerformance: number; // -1 to 1
}

// Export Types
export interface ExportRequest {
  type: 'financial' | 'regulatory' | 'market' | 'comprehensive';
  format: 'csv' | 'excel' | 'json' | 'pdf';
  filters?: ExportFilters;
  template?: string;
  includeCharts?: boolean;
  includeAnalysis?: boolean;
}

export interface ExportFilters {
  dateRange?: DateRange;
  entities?: string[];
  categories?: string[];
  minConfidence?: number;
  customFilters?: Record<string, any>;
}

export interface DateRange {
  start: Date;
  end: Date;
}

export interface ExportResult {
  id: string;
  filename: string;
  format: string;
  size: number;
  url?: string;
  data?: any;
  generatedAt: Date;
  expiresAt?: Date;
}

// Error Types
export interface PerplexityError extends Error {
  code: string;
  statusCode?: number;
  details?: any;
  retryable?: boolean;
  retryAfter?: number;
}

// Event Types
export interface PerplexityEvent {
  type: 'request' | 'response' | 'error' | 'rate-limit' | 'cache-hit' | 'cache-miss';
  timestamp: Date;
  data: any;
}

// Metrics Types
export interface PerplexityMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  cacheHits: number;
  cacheMisses: number;
  averageLatency: number;
  tokensUsed: number;
  costEstimate: number;
  rateLimitStatus: RateLimitStatus;
}

export interface RateLimitStatus {
  requestsThisMinute: number;
  requestsThisHour: number;
  requestsThisDay: number;
  remainingMinute: number;
  remainingHour: number;
  remainingDay: number;
  nextResetMinute: Date;
  nextResetHour: Date;
  nextResetDay: Date;
}