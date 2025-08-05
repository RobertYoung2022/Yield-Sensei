/**
 * Unified Satellite Type System
 * Central re-export hub for all satellite type definitions
 */

// Re-export satellite types - MVP focus on Sage + Aegis only
export * from '../satellites/sage/types';
export * from '../satellites/aegis/types';
// Other satellites removed for MVP

// Shared interfaces used across multiple satellites
export interface SatelliteBase {
  id: string;
  name: string;
  version: string;
  status: SatelliteStatus;
  lastUpdate: Date;
  health: SatelliteHealth;
  capabilities: string[];
  dependencies: string[];
  configuration: Record<string, any>;
}

export enum SatelliteStatus {
  INITIALIZING = 'initializing',
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  ERROR = 'error',
  DEGRADED = 'degraded',
  MAINTENANCE = 'maintenance'
}

export interface SatelliteHealth {
  overall: HealthLevel;
  components: ComponentHealth[];
  metrics: HealthMetrics;
  issues: HealthIssue[];
  lastCheck: Date;
}

export enum HealthLevel {
  HEALTHY = 'healthy',
  WARNING = 'warning',
  DEGRADED = 'degraded',
  CRITICAL = 'critical',
  OFFLINE = 'offline'
}

export interface ComponentHealth {
  component: string;
  status: HealthLevel;
  uptime: number; // percentage
  errorRate: number; // percentage
  responseTime: number; // milliseconds
  lastCheck: Date;
  details?: string;
}

export interface HealthMetrics {
  uptime: number; // percentage
  availability: number; // percentage
  responseTime: number; // milliseconds
  throughput: number; // requests/second
  errorRate: number; // percentage
  resourceUsage: ResourceUsage;
}

export interface ResourceUsage {
  cpu: number; // percentage
  memory: number; // percentage
  disk: number; // percentage
  network: number; // bytes/second
}

export interface HealthIssue {
  severity: IssueSeverity;
  component: string;
  description: string;
  impact: string;
  since: Date;
  actionRequired: boolean;
  recommendation?: string;
}

export enum IssueSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

// Cross-satellite messaging types
export interface SatelliteMessage {
  id: string;
  source: string;
  destination: string;
  type: MessageType;
  payload: any;
  timestamp: Date;
  priority: MessagePriority;
  correlationId?: string;
  ttl?: number; // milliseconds
  metadata?: Record<string, any>;
}

export enum MessageType {
  REQUEST = 'request',
  RESPONSE = 'response',
  EVENT = 'event',
  NOTIFICATION = 'notification',
  BROADCAST = 'broadcast',
  COMMAND = 'command',
  QUERY = 'query',
  ERROR = 'error'
}

export enum MessagePriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

// Unified analysis request/response types
export interface UnifiedAnalysisRequest {
  requestId: string;
  requester: string;
  type: AnalysisType;
  target: AnalysisTarget;
  parameters: Record<string, any>;
  requirements: AnalysisRequirement[];
  context?: AnalysisContext;
  priority: MessagePriority;
  timeout?: number; // milliseconds
}

export enum AnalysisType {
  SENTIMENT_ANALYSIS = 'sentiment_analysis',
  RISK_ASSESSMENT = 'risk_assessment',
  YIELD_OPTIMIZATION = 'yield_optimization',
  SECURITY_AUDIT = 'security_audit',
  PROTOCOL_ANALYSIS = 'protocol_analysis',
  BRIDGE_OPTIMIZATION = 'bridge_optimization',
  ORACLE_VALIDATION = 'oracle_validation',
  MEV_PROTECTION = 'mev_protection',
  TRADING_ALGORITHM = 'trading_algorithm',
  COMPLIANCE_CHECK = 'compliance_check',
  PERFORMANCE_ANALYSIS = 'performance_analysis',
  LIQUIDITY_ANALYSIS = 'liquidity_analysis'
}

export interface AnalysisTarget {
  type: TargetType;
  identifier: string;
  chain?: string;
  protocol?: string;
  metadata?: Record<string, any>;
}

export enum TargetType {
  PROTOCOL = 'protocol',
  ASSET = 'asset',
  TRANSACTION = 'transaction',
  ADDRESS = 'address',
  CONTRACT = 'contract',
  POOL = 'pool',
  BRIDGE = 'bridge',
  ALGORITHM = 'algorithm',
  STRATEGY = 'strategy',
  PORTFOLIO = 'portfolio'
}

export interface AnalysisRequirement {
  name: string;
  type: RequirementType;
  value?: any;
  optional: boolean;
  description: string;
}

export enum RequirementType {
  MINIMUM_CONFIDENCE = 'minimum_confidence',
  MAXIMUM_TIME = 'maximum_time',
  INCLUDE_PREDICTIONS = 'include_predictions',
  INCLUDE_HISTORICAL = 'include_historical',
  INCLUDE_BENCHMARKS = 'include_benchmarks',
  RISK_TOLERANCE = 'risk_tolerance',
  DATA_FRESHNESS = 'data_freshness',
  ANALYSIS_DEPTH = 'analysis_depth'
}

export interface AnalysisContext {
  market: MarketContext;
  user: UserContext;
  portfolio: PortfolioContext;
  risk: RiskContext;
  timing: TimingContext;
}

export interface MarketContext {
  conditions: MarketConditions;
  sentiment: number; // -1 to 1
  volatility: number; // 0 to 1
  liquidity: number; // 0 to 1
  trends: string[];
}

export enum MarketConditions {
  BULL = 'bull',
  BEAR = 'bear',
  SIDEWAYS = 'sideways',
  VOLATILE = 'volatile',
  STABLE = 'stable'
}

export interface UserContext {
  riskTolerance: number; // 0 to 1
  timeHorizon: number; // seconds
  objectives: string[];
  constraints: string[];
  preferences: Record<string, any>;
}

export interface PortfolioContext {
  totalValue: number;
  assets: AssetHolding[];
  diversification: number; // 0 to 1
  performance: PerformanceSnapshot;
  riskMetrics: RiskSnapshot;
}

export interface AssetHolding {
  asset: string;
  amount: number;
  value: number;
  allocation: number; // percentage
  chain?: string;
  protocol?: string;
}

export interface PerformanceSnapshot {
  return1d: number;
  return7d: number;
  return30d: number;
  returnYtd: number;
  sharpeRatio: number;
  maxDrawdown: number;
}

export interface RiskSnapshot {
  overallRisk: number; // 0 to 1
  volatility: number;
  var95: number;
  beta: number;
  concentration: number; // 0 to 1
}

export interface RiskContext {
  tolerance: number; // 0 to 1
  limits: RiskLimit[];
  monitors: RiskMonitor[];
  preferences: RiskPreference[];
}

export interface RiskLimit {
  type: string;
  value: number;
  enforced: boolean;
}

export interface RiskMonitor {
  metric: string;
  threshold: number;
  action: string;
}

export interface RiskPreference {
  category: string;
  preference: string;
  weight: number; // 0 to 1
}

export interface TimingContext {
  deadline?: Date;
  marketHours: boolean;
  gasPrice: number;
  networkCongestion: number; // 0 to 1
  urgency: UrgencyLevel;
}

export enum UrgencyLevel {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export interface UnifiedAnalysisResponse {
  requestId: string;
  respondent: string;
  status: ResponseStatus;
  results: AnalysisResult[];
  metadata: AnalysisMetadata;
  errors?: AnalysisError[];
}

export enum ResponseStatus {
  SUCCESS = 'success',
  PARTIAL_SUCCESS = 'partial_success',
  FAILURE = 'failure',
  TIMEOUT = 'timeout',
  CANCELLED = 'cancelled'
}

export interface AnalysisResult {
  type: AnalysisType;
  data: any;
  confidence: number; // 0 to 1
  reliability: number; // 0 to 1
  freshness: Date;
  source: string;
  methodology?: string;
  limitations?: string[];
}

export interface AnalysisMetadata {
  processingTime: number; // milliseconds
  dataPoints: number;
  sources: string[];
  timestamp: Date;
  version: string;
  degradedMode?: boolean;
  fallbacksUsed?: string[];
}

export interface AnalysisError {
  code: string;
  message: string;
  severity: IssueSeverity;
  component?: string;
  recoverable: boolean;
  suggestion?: string;
}

// Cross-satellite events
export interface SatelliteEvent {
  id: string;
  type: SatelliteEventType;
  source: string;
  timestamp: Date;
  data: any;
  severity: EventSeverity;
  category: EventCategory;
  correlationId?: string;
  tags?: string[];
}

export enum SatelliteEventType {
  // Lifecycle Events
  SATELLITE_STARTED = 'satellite_started',
  SATELLITE_STOPPED = 'satellite_stopped',
  SATELLITE_ERROR = 'satellite_error',
  SATELLITE_DEGRADED = 'satellite_degraded',
  SATELLITE_RECOVERED = 'satellite_recovered',
  
  // Analysis Events
  ANALYSIS_REQUESTED = 'analysis_requested',
  ANALYSIS_COMPLETED = 'analysis_completed',
  ANALYSIS_FAILED = 'analysis_failed',
  
  // Data Events
  DATA_UPDATED = 'data_updated',
  DATA_INCONSISTENCY = 'data_inconsistency',
  DATA_QUALITY_ISSUE = 'data_quality_issue',
  
  // Performance Events
  PERFORMANCE_DEGRADED = 'performance_degraded',
  RESOURCE_EXHAUSTED = 'resource_exhausted',
  THRESHOLD_EXCEEDED = 'threshold_exceeded',
  
  // Security Events
  SECURITY_ALERT = 'security_alert',
  ANOMALY_DETECTED = 'anomaly_detected',
  THREAT_DETECTED = 'threat_detected',
  
  // Integration Events
  INTEGRATION_SUCCESS = 'integration_success',
  INTEGRATION_FAILURE = 'integration_failure',
  DEPENDENCY_UNAVAILABLE = 'dependency_unavailable'
}

export enum EventSeverity {
  DEBUG = 'debug',
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical'
}

export enum EventCategory {
  SYSTEM = 'system',
  BUSINESS = 'business',
  SECURITY = 'security',
  PERFORMANCE = 'performance',
  INTEGRATION = 'integration',
  USER = 'user'
}

// Satellite capabilities and features
export interface SatelliteCapability {
  name: string;
  version: string;
  description: string;
  inputTypes: string[];
  outputTypes: string[];
  requirements: string[];
  limitations: string[];
  performance: CapabilityPerformance;
}

export interface CapabilityPerformance {
  avgResponseTime: number; // milliseconds
  maxThroughput: number; // requests/second
  accuracy: number; // 0 to 1
  reliability: number; // 0 to 1
  resourceUsage: ResourceRequirement;
}

export interface ResourceRequirement {
  cpu: number; // percentage
  memory: number; // bytes
  disk: number; // bytes
  network: number; // bytes/second
}

// Configuration management
export interface SatelliteConfiguration {
  satellite: string;
  version: string;
  settings: ConfigurationSection[];
  dependencies: DependencyConfig[];
  integrations: IntegrationConfig[];
  security: SecurityConfig;
  monitoring: MonitoringConfig;
}

export interface ConfigurationSection {
  name: string;
  settings: ConfigurationSetting[];
  validation: ValidationRule[];
}

export interface ConfigurationSetting {
  key: string;
  value: any;
  type: SettingType;
  description: string;
  required: boolean;
  sensitive: boolean;
  defaultValue?: any;
  constraints?: SettingConstraint[];
}

export enum SettingType {
  STRING = 'string',
  NUMBER = 'number',
  BOOLEAN = 'boolean',
  ARRAY = 'array',
  OBJECT = 'object',
  SECRET = 'secret',
  URL = 'url',
  DURATION = 'duration',
  PERCENTAGE = 'percentage'
}

export interface SettingConstraint {
  type: 'min' | 'max' | 'range' | 'enum' | 'pattern' | 'custom';
  value: any;
  message: string;
}

export interface ValidationRule {
  field: string;
  rules: string[];
  severity: 'error' | 'warning' | 'info';
}

export interface DependencyConfig {
  name: string;
  type: 'satellite' | 'service' | 'database' | 'api';
  required: boolean;
  timeout: number; // milliseconds
  retries: number;
  healthCheck: HealthCheckConfig;
}

export interface HealthCheckConfig {
  enabled: boolean;
  interval: number; // milliseconds
  timeout: number; // milliseconds
  endpoint?: string;
  method?: string;
  expectedStatus?: number;
}

export interface IntegrationConfig {
  name: string;
  type: 'webhook' | 'api' | 'message_queue' | 'database';
  enabled: boolean;
  configuration: Record<string, any>;
  authentication?: AuthenticationConfig;
  rateLimiting?: RateLimitConfig;
}

export interface AuthenticationConfig {
  type: 'none' | 'api_key' | 'bearer_token' | 'basic' | 'oauth2' | 'jwt';
  credentials: Record<string, any>;
  refreshConfig?: RefreshConfig;
}

export interface RefreshConfig {
  enabled: boolean;
  interval: number; // milliseconds
  endpoint: string;
  method: string;
}

export interface RateLimitConfig {
  enabled: boolean;
  requests: number;
  window: number; // milliseconds
  burstAllowance: number;
}

export interface SecurityConfig {
  encryption: EncryptionConfig;
  authentication: AuthenticationConfig;
  authorization: AuthorizationConfig;
  audit: AuditConfig;
}

export interface EncryptionConfig {
  enabled: boolean;
  algorithm: string;
  keyRotation: boolean;
  keyRotationInterval: number; // milliseconds
}

export interface AuthorizationConfig {
  enabled: boolean;
  rules: AuthorizationRule[];
  defaultAction: 'allow' | 'deny';
}

export interface AuthorizationRule {
  resource: string;
  action: string;
  condition: string;
  effect: 'allow' | 'deny';
}

export interface AuditConfig {
  enabled: boolean;
  events: string[];
  retention: number; // days
  format: 'json' | 'csv' | 'syslog';
  destination: string;
}

export interface MonitoringConfig {
  enabled: boolean;
  metrics: MetricConfig[];
  alerts: AlertConfig[];
  healthChecks: HealthCheckConfig[];
  logging: LoggingConfig;
}

export interface MetricConfig {
  name: string;
  type: 'counter' | 'gauge' | 'histogram' | 'timer';
  labels: string[];
  sampleRate: number; // 0 to 1
}

export interface AlertConfig {
  name: string;
  condition: string;
  severity: EventSeverity;
  channels: string[];
  cooldown: number; // milliseconds
}

export interface LoggingConfig {
  level: 'debug' | 'info' | 'warn' | 'error' | 'fatal';
  format: 'json' | 'text';
  destination: 'console' | 'file' | 'syslog' | 'elastic';
  rotation: LogRotationConfig;
}

export interface LogRotationConfig {
  enabled: boolean;
  maxSize: number; // bytes
  maxFiles: number;
  interval: 'daily' | 'weekly' | 'monthly';
}

// Common utility types shared across satellites
export interface TimeRange {
  start: Date;
  end: Date;
  timezone?: string;
}

export interface PaginationParams {
  limit: number;
  offset: number;
  orderBy?: string;
  orderDirection?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

export interface Filter {
  field: string;
  operator: FilterOperator;
  value: any;
}

export enum FilterOperator {
  EQUALS = 'equals',
  NOT_EQUALS = 'not_equals',
  GREATER_THAN = 'greater_than',
  LESS_THAN = 'less_than',
  GREATER_EQUAL = 'greater_equal',
  LESS_EQUAL = 'less_equal',
  CONTAINS = 'contains',
  NOT_CONTAINS = 'not_contains',
  STARTS_WITH = 'starts_with',
  ENDS_WITH = 'ends_with',
  IN = 'in',
  NOT_IN = 'not_in',
  IS_NULL = 'is_null',
  IS_NOT_NULL = 'is_not_null'
}

export interface SearchParams {
  query?: string;
  filters?: Filter[];
  pagination?: PaginationParams;
  includeMetadata?: boolean;
}

export interface Timestamp {
  seconds: number;
  nanoseconds: number;
}

export interface Currency {
  code: string;
  symbol: string;
  decimals: number;
}

export interface MonetaryAmount {
  value: number;
  currency: Currency;
}

// Type guards and utility functions
export function isSatelliteMessage(obj: any): obj is SatelliteMessage {
  return obj && typeof obj.id === 'string' && typeof obj.source === 'string' && typeof obj.destination === 'string';
}

export function isAnalysisRequest(obj: any): obj is UnifiedAnalysisRequest {
  return obj && typeof obj.requestId === 'string' && typeof obj.type === 'string' && obj.target;
}

export function isAnalysisResponse(obj: any): obj is UnifiedAnalysisResponse {
  return obj && typeof obj.requestId === 'string' && typeof obj.status === 'string';
}

export function isSatelliteEvent(obj: any): obj is SatelliteEvent {
  return obj && typeof obj.id === 'string' && typeof obj.type === 'string' && typeof obj.source === 'string';
}

// Namespace exports removed for MVP - Echo and Perplexity integrations not included