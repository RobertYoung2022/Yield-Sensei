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