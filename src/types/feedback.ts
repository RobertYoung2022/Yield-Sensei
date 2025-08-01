/**
 * YieldSensei User Feedback Collection System Types
 * TypeScript interfaces for comprehensive feedback functionality
 */

// =============================================================================
// ENUMS
// =============================================================================

export enum FeedbackCategory {
  AI_RECOMMENDATION = 'ai_recommendation',
  RISK_SETTING = 'risk_setting',
  EDUCATIONAL_CONTENT = 'educational_content',
  UI_EXPERIENCE = 'ui_experience',
  PORTFOLIO_SUGGESTION = 'portfolio_suggestion',
  YIELD_OPPORTUNITY = 'yield_opportunity',
  RISK_ASSESSMENT = 'risk_assessment',
  MARKET_INSIGHT = 'market_insight',
  STRATEGY_RECOMMENDATION = 'strategy_recommendation',
  GENERAL = 'general'
}

export enum FeedbackType {
  RATING = 'rating',
  THUMBS = 'thumbs',
  TEXT = 'text',
  STRUCTURED = 'structured',
  IMPLICIT = 'implicit'
}

export enum FeedbackSentiment {
  VERY_NEGATIVE = 'very_negative',
  NEGATIVE = 'negative',
  NEUTRAL = 'neutral',
  POSITIVE = 'positive',
  VERY_POSITIVE = 'very_positive',
  UNKNOWN = 'unknown'
}

export enum InteractionType {
  VIEW = 'view',
  CLICK = 'click',
  HOVER = 'hover',
  SCROLL = 'scroll',
  DISMISS = 'dismiss',
  ACCEPT = 'accept',
  REJECT = 'reject',
  SHARE = 'share',
  BOOKMARK = 'bookmark'
}

export enum FeedbackPrivacy {
  ANONYMOUS = 'anonymous',
  PSEUDONYMOUS = 'pseudonymous',
  IDENTIFIED = 'identified'
}

export enum TriggerType {
  TIME_BASED = 'time_based',
  EVENT_BASED = 'event_based',
  INTERACTION_BASED = 'interaction_based'
}

export enum TriggerResponseStatus {
  PENDING = 'pending',
  RESPONDED = 'responded',
  DISMISSED = 'dismissed',
  EXPIRED = 'expired'
}

export enum InsightType {
  TREND = 'trend',
  ANOMALY = 'anomaly',
  CORRELATION = 'correlation'
}

export enum InsightSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export enum InsightStatus {
  ACTIVE = 'active',
  ACKNOWLEDGED = 'acknowledged',
  RESOLVED = 'resolved',
  DISMISSED = 'dismissed'
}

// =============================================================================
// CORE INTERFACES
// =============================================================================

export interface UserFeedback {
  id: string;
  userId: string;
  sessionId?: string;
  
  // Classification
  category: FeedbackCategory;
  feedbackType: FeedbackType;
  privacyLevel: FeedbackPrivacy;
  
  // Content reference
  contentType: string;
  contentId?: string;
  contentContext?: Record<string, any>;
  
  // Feedback data
  rating?: number; // 1-5 for rating type
  thumbsRating?: boolean; // true/false for thumbs type
  textFeedback?: string;
  structuredData?: Record<string, any>;
  
  // Analysis
  sentiment: FeedbackSentiment;
  confidenceScore: number; // 0.0-1.0
  tags?: string[];
  
  // Context
  userAgent?: string;
  ipAddress?: string;
  referrerUrl?: string;
  pageContext?: Record<string, any>;
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

export interface FeedbackSession {
  id: string;
  userId: string;
  sessionToken: string;
  
  // Context
  sessionType: string;
  contextData?: Record<string, any>;
  
  // Metrics
  totalInteractions: number;
  positiveFeedbackCount: number;
  negativeFeedbackCount: number;
  completionPercentage: number;
  
  // Timing
  startedAt: Date;
  completedAt?: Date;
  expiresAt: Date;
}

export interface ContentInteraction {
  id: string;
  userId: string;
  feedbackSessionId?: string;
  
  // Content
  contentType: string;
  contentId: string;
  
  // Interaction
  interactionType: InteractionType;
  interactionValue?: number;
  interactionContext?: Record<string, any>;
  
  // Timing
  occurredAt: Date;
  durationMs?: number;
}

export interface FeedbackCategory {
  id: string;
  categoryName: FeedbackCategory;
  displayName: string;
  description?: string;
  
  // Configuration
  isActive: boolean;
  requiresRating: boolean;
  requiresText: boolean;
  maxTextLength: number;
  
  // UI
  iconName?: string;
  colorTheme?: string;
  displayOrder: number;
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
}

export interface FeedbackTag {
  id: string;
  tagName: string;
  category?: FeedbackCategory;
  
  // Metadata
  description?: string;
  isSystemTag: boolean;
  usageCount: number;
  
  // Timestamps
  createdAt: Date;
  lastUsedAt?: Date;
}

export interface FeedbackTagAssociation {
  feedbackId: string;
  tagId: string;
  confidence: number; // 0.0-1.0 for AI-generated tags
  createdAt: Date;
}

// =============================================================================
// ANALYTICS INTERFACES
// =============================================================================

export interface FeedbackAnalytics {
  id: string;
  
  // Dimensions
  contentType: string;
  contentId?: string;
  category: FeedbackCategory;
  timePeriod: string; // 'daily', 'weekly', 'monthly'
  periodStart: Date;
  periodEnd: Date;
  
  // Metrics
  totalFeedbackCount: number;
  ratingAverage?: number;
  ratingDistribution?: Record<string, number>;
  thumbsUpCount: number;
  thumbsDownCount: number;
  textFeedbackCount: number;
  
  // Sentiment
  sentimentDistribution?: Record<string, number>;
  avgSentimentScore?: number;
  
  // Engagement
  uniqueUsersCount: number;
  repeatFeedbackCount: number;
  
  // Metadata
  calculatedAt: Date;
}

export interface FeedbackInsight {
  id: string;
  
  // Classification
  insightType: InsightType;
  category: FeedbackCategory;
  severity: InsightSeverity;
  
  // Content
  title: string;
  description: string;
  dataPoints?: Record<string, any>;
  confidenceScore: number;
  
  // Recommendations
  recommendations?: Record<string, any>;
  priorityScore: number;
  
  // Status
  status: InsightStatus;
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
  
  // Timing
  detectedAt: Date;
  expiresAt?: Date;
}

export interface UserFeedbackSummary {
  userId: string;
  category: FeedbackCategory;
  totalFeedback: number;
  avgRating?: number;
  thumbsUp: number;
  thumbsDown: number;
  textFeedbackCount: number;
  positiveSentiment: number;
  negativeSentiment: number;
  firstFeedbackDate: Date;
  lastFeedbackDate: Date;
}

export interface ContentFeedbackPerformance {
  contentType: string;
  contentId?: string;
  category: FeedbackCategory;
  totalFeedback: number;
  avgRating?: number;
  medianRating?: number;
  uniqueUsers: number;
  thumbsUp: number;
  thumbsDown: number;
  positiveSentiment: number;
  negativeSentiment: number;
}

// =============================================================================
// PRIVACY AND COMPLIANCE
// =============================================================================

export interface FeedbackPrivacySettings {
  id: string;
  userId: string;
  
  // Consent
  feedbackCollectionConsent: boolean;
  analyticsConsent: boolean;
  improvementConsent: boolean;
  researchConsent: boolean;
  
  // Privacy preferences
  defaultPrivacyLevel: FeedbackPrivacy;
  allowSentimentAnalysis: boolean;
  allowContentPersonalization: boolean;
  
  // Data retention
  retentionPeriodDays: number;
  autoDeletionEnabled: boolean;
  
  // Metadata
  consentGivenAt: Date;
  lastUpdatedAt: Date;
  ipAddressAtConsent?: string;
}

export interface FeedbackDataRetention {
  id: string;
  userId: string;
  
  // Retention
  dataType: string;
  retentionPolicy: string;
  scheduledDeletionDate?: Date;
  
  // Deletion tracking
  deletionRequestedAt?: Date;
  deletionCompletedAt?: Date;
  deletionMethod?: string;
  
  // Compliance
  legalBasis?: string;
  processingPurposes?: string[];
  
  createdAt: Date;
}

// =============================================================================
// TRIGGERS AND AUTOMATION
// =============================================================================

export interface FeedbackTrigger {
  id: string;
  
  // Identification
  triggerName: string;
  triggerType: TriggerType;
  
  // Configuration
  conditions: Record<string, any>;
  targetCategories?: FeedbackCategory[];
  targetContentTypes?: string[];
  
  // Behavior
  feedbackTemplate?: Record<string, any>;
  maxTriggersPerUser: number;
  cooldownPeriod: string; // PostgreSQL interval format
  
  // Status
  isActive: boolean;
  totalTriggers: number;
  successfulCollections: number;
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

export interface UserFeedbackTrigger {
  id: string;
  userId: string;
  triggerId: string;
  
  // Execution
  triggeredAt: Date;
  responseStatus: TriggerResponseStatus;
  respondedAt?: Date;
  expiresAt?: Date;
  
  // Context
  triggerContext?: Record<string, any>;
  feedbackId?: string;
}

// =============================================================================
// REQUEST/RESPONSE TYPES
// =============================================================================

export interface SubmitFeedbackRequest {
  category: FeedbackCategory;
  feedbackType: FeedbackType;
  contentType: string;
  contentId?: string;
  rating?: number;
  thumbsRating?: boolean;
  textFeedback?: string;
  structuredData?: Record<string, any>;
  privacyLevel?: FeedbackPrivacy;
  tags?: string[];
  contentContext?: Record<string, any>;
  pageContext?: Record<string, any>;
}

export interface FeedbackResponse {
  id: string;
  status: 'success' | 'error';
  message?: string;
  feedback?: UserFeedback;
}

export interface FeedbackAnalyticsRequest {
  contentType?: string;
  contentId?: string;
  category?: FeedbackCategory;
  startDate?: Date;
  endDate?: Date;
  timePeriod?: 'daily' | 'weekly' | 'monthly';
  groupBy?: ('contentType' | 'category' | 'sentiment')[];
}

export interface FeedbackAnalyticsResponse {
  data: FeedbackAnalytics[];
  summary: {
    totalFeedback: number;
    avgRating?: number;
    sentimentBreakdown: Record<FeedbackSentiment, number>;
    periodCovered: {
      startDate: Date;
      endDate: Date;
    };
  };
}

export interface FeedbackInsightsRequest {
  category?: FeedbackCategory;
  severity?: InsightSeverity;
  status?: InsightStatus;
  limit?: number;
  offset?: number;
}

export interface FeedbackInsightsResponse {
  insights: FeedbackInsight[];
  totalCount: number;
  hasMore: boolean;
}

export interface UpdatePrivacySettingsRequest {
  feedbackCollectionConsent?: boolean;
  analyticsConsent?: boolean;
  improvementConsent?: boolean;
  researchConsent?: boolean;
  defaultPrivacyLevel?: FeedbackPrivacy;
  allowSentimentAnalysis?: boolean;
  allowContentPersonalization?: boolean;
  retentionPeriodDays?: number;
  autoDeletionEnabled?: boolean;
}

// =============================================================================
// UTILITY TYPES
// =============================================================================

export interface FeedbackMetrics {
  totalResponses: number;
  responseRate: number;
  averageRating: number;
  sentimentScore: number;
  engagementScore: number;
  satisfactionIndex: number;
}

export interface FeedbackTrend {
  date: Date;
  category: FeedbackCategory;
  dailyFeedbackCount: number;
  avgDailyRating: number;
  positiveCount: number;
  negativeCount: number;
  uniqueUsersDaily: number;
}

export interface FeedbackFilter {
  userId?: string;
  category?: FeedbackCategory;
  feedbackType?: FeedbackType;
  contentType?: string;
  sentiment?: FeedbackSentiment;
  rating?: number;
  startDate?: Date;
  endDate?: Date;
  tags?: string[];
  hasText?: boolean;
}

export interface PaginatedFeedbackResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

// =============================================================================
// VALIDATION SCHEMAS
// =============================================================================

export interface FeedbackValidationRules {
  rating?: {
    min: number;
    max: number;
    required: boolean;
  };
  textFeedback?: {
    minLength: number;
    maxLength: number;
    required: boolean;
  };
  categories?: FeedbackCategory[];
  privacyLevels?: FeedbackPrivacy[];
}

export interface FeedbackFormConfig {
  category: FeedbackCategory;
  title: string;
  description?: string;
  fields: {
    rating?: boolean;
    thumbs?: boolean;
    text?: boolean;
    structured?: Record<string, any>;
  };
  validation: FeedbackValidationRules;
  ui: {
    theme?: string;
    layout?: 'modal' | 'inline' | 'sidebar';
    position?: 'top' | 'bottom' | 'center';
    showProgress?: boolean;
  };
}

// =============================================================================
// ERROR TYPES
// =============================================================================

export interface FeedbackError {
  code: string;
  message: string;
  details?: Record<string, any>;
  field?: string;
}

export class FeedbackValidationError extends Error {
  public errors: FeedbackError[];
  
  constructor(errors: FeedbackError[]) {
    super('Feedback validation failed');
    this.errors = errors;
    this.name = 'FeedbackValidationError';
  }
}

export class FeedbackPrivacyError extends Error {
  public code: string;
  
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = 'FeedbackPrivacyError';
  }
}

// =============================================================================
// EXPORT TYPES
// =============================================================================

export type FeedbackSubmission = Omit<UserFeedback, 'id' | 'sentiment' | 'confidenceScore' | 'createdAt' | 'updatedAt'>;
export type FeedbackUpdate = Partial<Pick<UserFeedback, 'rating' | 'thumbsRating' | 'textFeedback' | 'tags' | 'privacyLevel'>>;
export type AnalyticsTimeframe = 'hour' | 'day' | 'week' | 'month' | 'quarter' | 'year';
export type SentimentValue = -1 | -0.5 | 0 | 0.5 | 1; // Numeric sentiment values