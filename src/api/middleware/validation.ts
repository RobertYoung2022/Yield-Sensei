/**
 * Request Validation Middleware
 * Uses Zod for runtime validation of request data
 */

import { Request, Response, NextFunction } from 'express';
import { z, ZodError } from 'zod';
import { ValidationError } from './error-handler';

// Common validation schemas
export const paginationSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(10),
  sort: z.string().optional(),
  order: z.enum(['asc', 'desc']).default('desc'),
});

export const filterSchema = paginationSchema.extend({
  search: z.string().optional(),
  status: z.string().optional(),
  type: z.string().optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
});

// Portfolio validation schemas
export const createPortfolioSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  type: z.enum(['personal', 'institutional', 'satellite']),
  riskProfile: z.enum(['conservative', 'moderate', 'aggressive']),
  currency: z.string().length(3).default('USD'),
});

export const updatePortfolioSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  type: z.enum(['personal', 'institutional', 'satellite']).optional(),
  riskProfile: z.enum(['conservative', 'moderate', 'aggressive']).optional(),
  status: z.enum(['active', 'inactive', 'archived']).optional(),
});

export const portfolioIdSchema = z.object({
  id: z.string().uuid(),
});

// Transaction validation schemas
export const createTransactionSchema = z.object({
  portfolioId: z.string().uuid(),
  type: z.enum(['buy', 'sell', 'deposit', 'withdrawal', 'transfer']),
  symbol: z.string().optional(),
  amount: z.number().positive(),
  quantity: z.number().positive().optional(),
  price: z.number().positive().optional(),
  currency: z.string().length(3).default('USD'),
  metadata: z.record(z.any()).optional(),
});

export const transactionIdSchema = z.object({
  id: z.string().uuid(),
});

// Market data validation schemas
export const marketDataRequestSchema = z.object({
  symbols: z.array(z.string()).min(1).max(50),
  interval: z.enum(['1m', '5m', '15m', '1h', '1d']).default('1d'),
  limit: z.coerce.number().min(1).max(1000).default(100),
});

// Risk assessment validation schemas
export const riskAssessmentRequestSchema = z.object({
  portfolioId: z.string().uuid(),
  type: z.enum(['portfolio', 'position', 'market']).default('portfolio'),
});

// User validation schemas
export const updateUserPreferencesSchema = z.object({
  theme: z.enum(['light', 'dark', 'auto']).optional(),
  timezone: z.string().optional(),
  currency: z.string().length(3).optional(),
  notifications: z.object({
    email: z.boolean().optional(),
    push: z.boolean().optional(),
    sms: z.boolean().optional(),
  }).optional(),
  riskTolerance: z.enum(['conservative', 'moderate', 'aggressive']).optional(),
});

// Analytics validation schemas
export const analyticsRequestSchema = z.object({
  portfolioId: z.string().uuid(),
  period: z.enum(['1d', '1w', '1m', '3m', '6m', '1y', 'all']).default('1m'),
});

// Feedback validation schemas
export const submitFeedbackSchema = z.object({
  category: z.enum([
    'ai_recommendation',
    'risk_setting',
    'educational_content',
    'ui_experience',
    'portfolio_suggestion',
    'yield_opportunity',
    'risk_assessment',
    'market_insight',
    'strategy_recommendation',
    'general'
  ]),
  feedbackType: z.enum(['rating', 'thumbs', 'text', 'structured', 'implicit']),
  contentType: z.string().min(1).max(100),
  contentId: z.string().max(255).optional(),
  rating: z.number().min(1).max(5).optional(),
  thumbsRating: z.boolean().optional(),
  textFeedback: z.string().max(2000).optional(),
  structuredData: z.record(z.any()).optional(),
  privacyLevel: z.enum(['anonymous', 'pseudonymous', 'identified']).optional(),
  tags: z.array(z.string()).max(10).optional(),
  contentContext: z.record(z.any()).optional(),
  pageContext: z.record(z.any()).optional(),
}).refine((data) => {
  // Ensure required feedback data is provided based on type
  if (data.feedbackType === 'rating' && !data.rating) return false;
  if (data.feedbackType === 'thumbs' && data.thumbsRating === undefined) return false;
  if (data.feedbackType === 'text' && !data.textFeedback) return false;
  if (data.feedbackType === 'structured' && (!data.structuredData || Object.keys(data.structuredData).length === 0)) return false;
  return true;
}, {
  message: "Required feedback data must be provided based on feedback type"
});

export const feedbackIdSchema = z.object({
  id: z.string().uuid(),
});

export const feedbackAnalyticsRequestSchema = z.object({
  contentType: z.string().optional(),
  contentId: z.string().optional(),
  category: z.enum([
    'ai_recommendation',
    'risk_setting',
    'educational_content',
    'ui_experience',
    'portfolio_suggestion',
    'yield_opportunity',
    'risk_assessment',
    'market_insight',
    'strategy_recommendation',
    'general'
  ]).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  timePeriod: z.enum(['daily', 'weekly', 'monthly']).default('daily'),
  groupBy: z.array(z.enum(['contentType', 'category', 'sentiment'])).default([]),
});

export const feedbackFilterSchema = z.object({
  category: z.enum([
    'ai_recommendation',
    'risk_setting',
    'educational_content',
    'ui_experience',
    'portfolio_suggestion',
    'yield_opportunity',
    'risk_assessment',
    'market_insight',
    'strategy_recommendation',
    'general'
  ]).optional(),
  feedbackType: z.enum(['rating', 'thumbs', 'text', 'structured', 'implicit']).optional(),
  sentiment: z.enum(['very_negative', 'negative', 'neutral', 'positive', 'very_positive', 'unknown']).optional(),
  hasText: z.boolean().optional(),
  rating: z.number().min(1).max(5).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

export const updatePrivacySettingsSchema = z.object({
  feedbackCollectionConsent: z.boolean().optional(),
  analyticsConsent: z.boolean().optional(),
  improvementConsent: z.boolean().optional(),
  researchConsent: z.boolean().optional(),
  defaultPrivacyLevel: z.enum(['anonymous', 'pseudonymous', 'identified']).optional(),
  allowSentimentAnalysis: z.boolean().optional(),
  allowContentPersonalization: z.boolean().optional(),
  retentionPeriodDays: z.number().min(1).max(3650).optional(),
  autoDeletionEnabled: z.boolean().optional(),
});

// Generic validation middleware factory
export function validateRequest(schema: z.ZodSchema, location: 'body' | 'query' | 'params' = 'body') {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      const data = req[location];
      const validatedData = schema.parse(data);
      
      // Replace the original data with validated data
      req[location] = validatedData;
      
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const details = error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
          code: err.code,
        }));
        
        throw new ValidationError('Validation failed', details);
      }
      next(error);
    }
  };
}

// Specific validation middlewares
export const validateCreatePortfolio = validateRequest(createPortfolioSchema);
export const validateUpdatePortfolio = validateRequest(updatePortfolioSchema);
export const validatePortfolioId = validateRequest(portfolioIdSchema, 'params');
export const validateCreateTransaction = validateRequest(createTransactionSchema);
export const validateTransactionId = validateRequest(transactionIdSchema, 'params');
export const validateMarketDataRequest = validateRequest(marketDataRequestSchema, 'query');
export const validateRiskAssessmentRequest = validateRequest(riskAssessmentRequestSchema, 'query');
export const validateUpdateUserPreferences = validateRequest(updateUserPreferencesSchema);
export const validateAnalyticsRequest = validateRequest(analyticsRequestSchema, 'query');
export const validatePagination = validateRequest(paginationSchema, 'query');
export const validateFilter = validateRequest(filterSchema, 'query');

// Feedback validation middlewares
export const validateSubmitFeedback = validateRequest(submitFeedbackSchema);
export const validateFeedbackId = validateRequest(feedbackIdSchema, 'params');
export const validateFeedbackAnalyticsRequest = validateRequest(feedbackAnalyticsRequestSchema, 'query');
export const validateFeedbackFilter = validateRequest(feedbackFilterSchema, 'query');
export const validateUpdatePrivacySettings = validateRequest(updatePrivacySettingsSchema); 