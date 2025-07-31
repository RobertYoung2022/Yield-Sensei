/**
 * Sage Satellite Type Definitions
 * Market & Protocol Research + RWA Integration
 */

// Protocol Data Types
export interface ProtocolData {
  id: string;
  name: string;
  category: ProtocolCategory;
  chain: string;
  tvl: number;
  tvlHistory: TVLDataPoint[];
  revenue: RevenueData;
  userMetrics: UserMetrics;
  securityMetrics: SecurityMetrics;
  governanceMetrics: GovernanceMetrics;
  teamInfo: TeamInfo;
  auditHistory: AuditRecord[];
  createdAt: Date;
  updatedAt: Date;
}

export type ProtocolCategory = 
  | 'lending'
  | 'dex'
  | 'yield-aggregator'
  | 'derivatives'
  | 'insurance'
  | 'gaming'
  | 'nft'
  | 'rwa'
  | 'other';

export interface TVLDataPoint {
  timestamp: Date;
  value: number;
  change24h: number;
  change7d: number;
  change30d: number;
}

export interface RevenueData {
  daily: number;
  weekly: number;
  monthly: number;
  annualized: number;
  sources: RevenueSource[];
}

export interface RevenueSource {
  name: string;
  amount: number;
  percentage: number;
}

export interface UserMetrics {
  activeUsers: number;
  totalUsers: number;
  userGrowth: number;
  retentionRate: number;
  averageSessionDuration: number;
}

export interface SecurityMetrics {
  auditScore: number;
  bugBountyProgram: boolean;
  insuranceCoverage: number;
  vulnerabilityCount: number;
  lastAuditDate: Date;
}

export interface GovernanceMetrics {
  decentralizationScore: number;
  governanceToken: string;
  votingPower: number;
  proposalCount: number;
  voterParticipation: number;
}

export interface TeamInfo {
  size: number;
  experience: number;
  transparency: number;
  socialPresence: number;
  githubActivity: number;
}

export interface AuditRecord {
  auditor: string;
  date: Date;
  score: number;
  findings: AuditFinding[];
  status: 'passed' | 'failed' | 'pending';
}

export interface AuditFinding {
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  status: 'open' | 'resolved' | 'mitigated';
}

// Analysis Result Types
export interface ProtocolAnalysis {
  protocolId: string;
  timestamp: Date;
  overallScore: number;
  riskAssessment: RiskAssessment;
  tvlHealth: TVLHealthAnalysis;
  teamAssessment: TeamAssessment;
  securityAssessment: SecurityAssessment;
  governanceAssessment: GovernanceAssessment;
  revenueAnalysis: RevenueAnalysis;
  recommendations: Recommendation[];
  confidence: number;
}

export interface RiskAssessment {
  overallRisk: 'low' | 'medium' | 'high' | 'critical';
  riskScore: number;
  riskFactors: RiskFactor[];
  volatilityScore: number;
  liquidityRisk: number;
  smartContractRisk: number;
  regulatoryRisk: number;
}

export interface RiskFactor {
  category: string;
  description: string;
  impact: 'low' | 'medium' | 'high' | 'critical';
  probability: number;
  mitigation: string;
}

export interface TVLHealthAnalysis {
  trend: 'increasing' | 'decreasing' | 'stable';
  healthScore: number;
  volatility: number;
  sustainability: number;
  growthRate: number;
  marketShare: number;
}

export interface TeamAssessment {
  overallScore: number;
  experience: number;
  transparency: number;
  credibility: number;
  githubActivity: number;
  socialPresence: number;
  redFlags: string[];
}

export interface SecurityAssessment {
  overallScore: number;
  auditQuality: number;
  bugBountyProgram: number;
  insuranceCoverage: number;
  vulnerabilityRisk: number;
  recentIncidents: SecurityIncident[];
}

export interface SecurityIncident {
  date: Date;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  resolved: boolean;
}

export interface GovernanceAssessment {
  decentralizationScore: number;
  voterParticipation: number;
  proposalQuality: number;
  transparency: number;
  communityEngagement: number;
}

export interface RevenueAnalysis {
  sustainability: number;
  growthRate: number;
  diversification: number;
  profitability: number;
  revenueQuality: number;
}

export interface Recommendation {
  type: 'buy' | 'hold' | 'sell' | 'monitor';
  confidence: number;
  reasoning: string;
  timeframe: 'short' | 'medium' | 'long';
  riskLevel: 'low' | 'medium' | 'high';
}

// ML Model Types
export interface MLModelConfig {
  modelType: 'regression' | 'classification' | 'clustering';
  features: string[];
  target: string;
  hyperparameters: Record<string, any>;
  trainingConfig: TrainingConfig;
}

export interface TrainingConfig {
  epochs: number;
  batchSize: number;
  learningRate: number;
  validationSplit: number;
  earlyStopping: boolean;
  callbacks: string[];
}

export interface ModelPerformance {
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  auc: number;
  mse: number;
  mae: number;
}

export interface ModelPrediction {
  input: Record<string, any>;
  output: any;
  confidence: number;
  features: FeatureImportance[];
  timestamp: Date;
}

export interface FeatureImportance {
  feature: string;
  importance: number;
  direction: 'positive' | 'negative' | 'neutral';
}

// RWA Types
export interface RWAData {
  id: string;
  type: RWAType;
  issuer: string;
  value: number;
  currency: string;
  maturityDate?: Date;
  yield: number;
  riskRating: 'AAA' | 'AA' | 'A' | 'BBB' | 'BB' | 'B' | 'CCC' | 'CC' | 'C' | 'D';
  collateral: CollateralInfo;
  regulatoryStatus: RegulatoryStatus;
  complianceScore: number;
}

export type RWAType = 
  | 'real-estate'
  | 'commodities'
  | 'bonds'
  | 'equity'
  | 'invoices'
  | 'loans'
  | 'art'
  | 'other';

export interface CollateralInfo {
  type: string;
  value: number;
  ltv: number;
  liquidationThreshold: number;
}

export interface RegulatoryStatus {
  jurisdiction: string;
  complianceLevel: 'compliant' | 'partial' | 'non-compliant';
  licenses: string[];
  restrictions: string[];
  lastReview: Date;
}

// Compliance Types
export interface ComplianceRule {
  id: string;
  jurisdiction: string;
  category: string;
  rule: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  requirements: string[];
  lastUpdated: Date;
}

export interface ComplianceViolation {
  ruleId: string;
  protocolId: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  detectedAt: Date;
  status: 'open' | 'resolved' | 'mitigated';
  remediation: string;
}

// API Types
export interface AnalysisRequest {
  protocolId: string;
  analysisType: 'full' | 'quick' | 'risk' | 'revenue' | 'security';
  includeRecommendations: boolean;
  confidenceThreshold: number;
}

export interface AnalysisResponse {
  requestId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  analysis?: ProtocolAnalysis;
  error?: string;
  processingTime: number;
  timestamp: Date;
}

// Event Types
export interface AnalysisEvent {
  type: 'analysis_started' | 'analysis_completed' | 'analysis_failed';
  protocolId: string;
  timestamp: Date;
  data?: any;
}

export interface AlertEvent {
  type: 'risk_alert' | 'compliance_violation' | 'anomaly_detected';
  severity: 'low' | 'medium' | 'high' | 'critical';
  protocolId?: string;
  message: string;
  timestamp: Date;
  data?: any;
}

// Extended types for full Sage implementation

// Enhanced RWA Score types
export interface RWAScore {
  overallScore: number;
  riskAdjustedReturn: number;
  confidence: number;
  recommendations: Recommendation[];
  factors: ScoringFactor[];
  metadata: {
    calculatedAt: Date;
    version: string;
    model: string;
  };
}

export interface ScoringFactor {
  category: string;
  score: number;
  weight: number;
  description: string;
  impact: 'positive' | 'negative' | 'neutral';
  confidence?: number;
  sourceData?: any;
}

// Enhanced Compliance types
export interface ComplianceAssessment {
  entityId: string;
  entityType: 'protocol' | 'rwa';
  overallScore: number;
  complianceLevel: 'compliant' | 'partial' | 'non-compliant';
  ruleEvaluations: Array<{
    ruleId: string;
    ruleName: string;
    status: 'compliant' | 'partial' | 'violation';
    score: number;
    details: string;
    recommendations?: string[];
  }>;
  violations: Array<{
    ruleId: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    description: string;
    remediation: string;
    deadline?: Date;
  }>;
  recommendations: Recommendation[];
  assessedAt: Date;
  nextReviewDate: Date;
  jurisdiction: string;
}

// Enhanced TVL Analysis
export interface TVLAnalysis {
  health: 'healthy' | 'declining' | 'volatile' | 'growing';
  trend: 'upward' | 'downward' | 'stable' | 'volatile';
  score: number;
  growthRate: number;
  volatilityScore: number;
}

// Perplexity API Integration types
export interface PerplexityResponse {
  content: string;
  sources?: string[];
  timestamp: Date;
  model: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface ResearchQuery {
  query: string;
  context?: Record<string, any>;
  sources?: string[];
  depth?: 'shallow' | 'medium' | 'deep';
  language?: string;
}

export interface ResearchResult {
  summary: string;
  keyFindings: string[];
  sources: ResearchSource[];
  confidence: number;
  recommendations: string[];
  metadata: Record<string, any>;
}

export interface ResearchSource {
  title: string;
  url: string;
  domain: string;
  snippet: string;
  relevance: number;
}

// Sage Agent Configuration
export interface SageAgentConfig {
  name: string;
  capabilities: string[];
  enableCaching?: boolean;
  enablePerplexity?: boolean;
  enableMLAnalysis?: boolean;
  riskTolerance?: number;
  performanceThresholds?: {
    rwaScoring: number;
    protocolAnalysis: number;
    complianceAssessment: number;
  };
  apiKeys?: {
    perplexity?: string;
    other?: Record<string, string>;
  };
}

// Analysis Request and Result types
export interface SageAnalysisRequest {
  type: 'rwa_analysis' | 'protocol_analysis' | 'compliance_assessment' | 'comprehensive_analysis' | 'yield_optimized_analysis' | 'cross_chain_rwa_analysis' | 'fundamental_analysis' | 'investment_decision' | 'enhanced_rwa_analysis' | 'validation_workflow' | 'consistency_validation' | 'performance_test' | 'resilient_analysis' | 'contextual_analysis' | 'integration_test' | 'contract_test';
  data: RWAData | ProtocolData;
  requirements: string[];
  context?: Record<string, any>;
  marketData?: any;
  yieldContext?: any;
  bridgeData?: any;
  portfolioContext?: any;
  sessionId?: string;
  fallbackOptions?: {
    skipSentiment?: boolean;
    useCachedData?: boolean;
    degradedMode?: boolean;
  };
}

export interface SageAnalysisResult {
  requestId?: string;
  rwaScore?: RWAScore;
  protocolAnalysis?: ProtocolAnalysis;
  complianceAssessment?: ComplianceAssessment;
  recommendations: Recommendation[];
  metadata: {
    processedAt: Date;
    duration: number;
    version: string;
    degradedMode?: boolean;
    missingComponents?: string[];
  };
  // Additional fields for specific analysis types
  netYield?: number;
  crossChainRisks?: any;
  liquidityScore?: number;
  comparativeAnalysis?: any;
  diversificationScore?: number;
  recommendation?: Recommendation;
  baseScore?: number;
  sessionContext?: any;
}

// Health and Status types
export interface ComponentHealth {
  component: string;
  status: 'healthy' | 'degraded' | 'unhealthy' | 'offline';
  lastCheck: Date;
  uptime: number;
  errorRate: number;
  responseTime: number;
  issues?: string[];
}

export interface SageAgentStatus {
  status: 'initializing' | 'ready' | 'processing' | 'degraded' | 'offline';
  health: 'healthy' | 'degraded' | 'unhealthy';
  components: ComponentHealth[];
  startedAt: Date;
  lastActivity: Date;
  processedRequests: number;
  errorCount: number;
  averageResponseTime: number;
}

// Position and Portfolio types
export interface Position {
  id: string;
  type: 'rwa' | 'protocol' | 'token';
  value: number;
  expectedReturn: number;
  riskScore: number;
  metadata?: Record<string, any>;
}