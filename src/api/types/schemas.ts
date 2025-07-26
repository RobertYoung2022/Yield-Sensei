/**
 * API Request/Response Schemas
 * TypeScript interfaces for API data structures
 */

// Base API Response Structure
export interface ApiResponse<T = any> {
  data: T;
  meta?: {
    total?: number;
    page?: number;
    limit?: number;
    totalPages?: number;
    hasNext?: boolean;
    hasPrev?: boolean;
  };
  links?: {
    self: string;
    next?: string;
    prev?: string;
    first?: string;
    last?: string;
  };
}

// Pagination Query Parameters
export interface PaginationQuery {
  page?: number;
  limit?: number;
  sort?: string;
  order?: 'asc' | 'desc';
}

// Filter Query Parameters
export interface FilterQuery extends PaginationQuery {
  search?: string;
  status?: string;
  type?: string;
  dateFrom?: string;
  dateTo?: string;
}

// Portfolio Schemas
export interface Portfolio {
  id: string;
  name: string;
  description?: string;
  userId: string;
  type: 'personal' | 'institutional' | 'satellite';
  status: 'active' | 'inactive' | 'archived';
  riskProfile: 'conservative' | 'moderate' | 'aggressive';
  totalValue: number;
  currency: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePortfolioRequest {
  name: string;
  description?: string;
  type: 'personal' | 'institutional' | 'satellite';
  riskProfile: 'conservative' | 'moderate' | 'aggressive';
  currency?: string;
}

export interface UpdatePortfolioRequest {
  name?: string;
  description?: string;
  type?: 'personal' | 'institutional' | 'satellite';
  riskProfile?: 'conservative' | 'moderate' | 'aggressive';
  status?: 'active' | 'inactive' | 'archived';
}

// Satellite Schemas
export interface Satellite {
  id: string;
  name: string;
  type: 'aegis' | 'phoenix' | 'nova' | 'zenith';
  status: 'online' | 'offline' | 'maintenance' | 'error';
  version: string;
  lastHeartbeat: string;
  performance: {
    uptime: number;
    responseTime: number;
    errorRate: number;
    throughput: number;
  };
  configuration: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface SatelliteStatus {
  id: string;
  status: 'online' | 'offline' | 'maintenance' | 'error';
  lastHeartbeat: string;
  performance: {
    uptime: number;
    responseTime: number;
    errorRate: number;
    throughput: number;
  };
}

// Risk Assessment Schemas
export interface RiskAssessment {
  id: string;
  portfolioId: string;
  userId: string;
  type: 'portfolio' | 'position' | 'market';
  score: number;
  level: 'low' | 'medium' | 'high' | 'critical';
  factors: RiskFactor[];
  recommendations: RiskRecommendation[];
  createdAt: string;
  updatedAt: string;
}

export interface RiskFactor {
  name: string;
  weight: number;
  score: number;
  description: string;
}

export interface RiskRecommendation {
  type: 'action' | 'warning' | 'info';
  priority: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  action?: string;
}

// Market Data Schemas
export interface MarketData {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  marketCap?: number;
  timestamp: string;
  source: string;
}

export interface MarketDataRequest {
  symbols: string[];
  interval?: '1m' | '5m' | '15m' | '1h' | '1d';
  limit?: number;
}

// Transaction Schemas
export interface Transaction {
  id: string;
  portfolioId: string;
  userId: string;
  type: 'buy' | 'sell' | 'deposit' | 'withdrawal' | 'transfer';
  status: 'pending' | 'completed' | 'failed' | 'cancelled';
  symbol?: string;
  amount: number;
  quantity?: number;
  price?: number;
  fee?: number;
  currency: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

export interface CreateTransactionRequest {
  portfolioId: string;
  type: 'buy' | 'sell' | 'deposit' | 'withdrawal' | 'transfer';
  symbol?: string;
  amount: number;
  quantity?: number;
  price?: number;
  currency?: string;
  metadata?: Record<string, any>;
}

// User Schemas
export interface User {
  id: string;
  email: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  status: 'active' | 'inactive' | 'suspended';
  role: 'user' | 'admin' | 'institutional';
  subscription: {
    plan: 'free' | 'basic' | 'premium' | 'enterprise';
    status: 'active' | 'expired' | 'cancelled';
    expiresAt?: string;
  };
  preferences: UserPreferences;
  createdAt: string;
  updatedAt: string;
}

export interface UserPreferences {
  theme: 'light' | 'dark' | 'auto';
  timezone: string;
  currency: string;
  notifications: {
    email: boolean;
    push: boolean;
    sms: boolean;
  };
  riskTolerance: 'conservative' | 'moderate' | 'aggressive';
}

// Analytics Schemas
export interface Analytics {
  portfolioId: string;
  period: '1d' | '1w' | '1m' | '3m' | '6m' | '1y' | 'all';
  metrics: {
    totalReturn: number;
    annualizedReturn: number;
    volatility: number;
    sharpeRatio: number;
    maxDrawdown: number;
    beta: number;
    alpha: number;
  };
  performance: PerformanceDataPoint[];
  riskMetrics: RiskMetrics;
  timestamp: string;
}

export interface PerformanceDataPoint {
  date: string;
  value: number;
  change: number;
  changePercent: number;
}

export interface RiskMetrics {
  var95: number;
  var99: number;
  cvar95: number;
  cvar99: number;
  trackingError: number;
  informationRatio: number;
}

// Error Response Schema
export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: any;
    timestamp: string;
    path: string;
    method: string;
  };
}

// Health Check Schema
export interface HealthCheck {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  version: string;
  uptime: number;
  services: {
    database: ServiceHealth;
    redis: ServiceHealth;
    satellites: ServiceHealth;
  };
}

export interface ServiceHealth {
  status: 'healthy' | 'unhealthy' | 'degraded';
  responseTime?: number;
  error?: string;
  lastCheck: string;
} 