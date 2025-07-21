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

// Generic validation middleware factory
export function validateRequest(schema: z.ZodSchema, location: 'body' | 'query' | 'params' = 'body') {
  return (req: Request, res: Response, next: NextFunction) => {
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