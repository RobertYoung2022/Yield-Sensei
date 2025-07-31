/**
 * Core Integration Types
 * Shared types for service management and configuration
 */

export interface ServiceMetadata {
  name: string;
  version: string;
  type: 'blockchain' | 'social' | 'data' | 'ai' | 'other';
  provider: string;
  description?: string;
  tags?: string[];
}

export interface ServiceConfig {
  enabled: boolean;
  apiKey?: string;
  baseUrl?: string;
  timeout?: number;
  retries?: number;
  rateLimitRpm?: number;
  cacheTTL?: number;
  enableCaching?: boolean;
  customOptions?: Record<string, any>;
}

export interface ServiceHealth {
  status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  lastCheck: Date;
  responseTime?: number;
  errorRate?: number;
  uptime?: number;
  lastError?: string;
  metadata?: Record<string, any>;
}

export interface ServiceRegistration {
  id: string;
  metadata: ServiceMetadata;
  config: ServiceConfig;
  health: ServiceHealth;
  instance?: any;
  dependencies?: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ServiceFactory<T = any> {
  create(config: ServiceConfig): Promise<T>;
  validate(config: ServiceConfig): boolean;
  getDefaultConfig(): Partial<ServiceConfig>;
}

export interface ServiceMonitorConfig {
  healthCheckInterval: number;
  healthCheckTimeout: number;
  alertThresholds: {
    errorRate: number;
    responseTime: number;
    uptime: number;
  };
  retentionPeriod: number;
}

export interface ServiceMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  rateLimitHits: number;
  cacheHitRate: number;
  lastRequestAt?: Date;
  errorLog: ServiceError[];
}

export interface ServiceError {
  timestamp: Date;
  error: string;
  context?: Record<string, any>;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface ConfigurationSchema {
  [key: string]: {
    type: 'string' | 'number' | 'boolean' | 'object' | 'array';
    required?: boolean;
    default?: any;
    validation?: (value: any) => boolean;
    description?: string;
  };
}

export interface EnvironmentConfig {
  environment: 'development' | 'staging' | 'production';
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  services: Record<string, ServiceConfig>;
  monitoring: ServiceMonitorConfig;
  secrets: Record<string, string>;
}

export interface ServiceEvent {
  type: 'registered' | 'deregistered' | 'health_changed' | 'config_updated' | 'error';
  serviceId: string;
  timestamp: Date;
  data?: any;
}

export type ServiceEventHandler = (event: ServiceEvent) => void | Promise<void>;

export interface LoadBalancingStrategy {
  name: 'round_robin' | 'least_connections' | 'weighted' | 'random';
  select<T>(services: T[]): T | null;
}

export interface ServiceDiscoveryProvider {
  discover(): Promise<ServiceRegistration[]>;
  register(service: ServiceRegistration): Promise<void>;
  deregister(serviceId: string): Promise<void>;
  watch(callback: (services: ServiceRegistration[]) => void): void;
}

export interface IntegrationContext {
  requestId?: string;
  userId?: string;
  sessionId?: string;
  metadata?: Record<string, any>;
  timeout?: number;
}