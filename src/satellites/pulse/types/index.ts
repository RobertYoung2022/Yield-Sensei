/**
 * Pulse Satellite Types
 * Yield Optimization and Liquid Staking Strategy Types
 */

export interface YieldOpportunity {
  id: string;
  protocol: string;
  chain: string;
  asset: string;
  strategy: YieldStrategy;
  apy: {
    current: number;
    historical: number[];
    projected: number;
    confidence: number;
  };
  tvl: number;
  liquidity: {
    depth: number;
    withdrawalTime: number; // in seconds
    fees: number;
  };
  risk: {
    score: number; // 0-1, lower is safer
    factors: RiskFactor[];
    smartContractRisk: number;
    impermanentLoss: number;
    liquidationRisk: number;
  };
  sustainability: {
    score: number; // 0-1, higher is more sustainable
    analysis: SustainabilityAnalysis;
    category: SustainabilityCategory;
  };
  requirements: {
    minimumDeposit: number;
    lockupPeriod?: number;
    autoCompound: boolean;
    gasOptimized: boolean;
  };
  lastUpdated: Date;
  metadata: {
    discoveryMethod: 'manual' | 'automated' | 'research';
    verificationStatus: 'verified' | 'pending' | 'flagged';
    tags: string[];
  };
}

export interface YieldStrategy {
  type: StrategyType;
  name: string;
  description: string;
  complexity: 'simple' | 'intermediate' | 'advanced';
  components: StrategyComponent[];
  allocations: AllocationTarget[];
  rebalanceFrequency: number; // in seconds
  exitStrategy: ExitStrategy;
  gasEfficiency: number; // 0-1
}

export interface StrategyComponent {
  id: string;
  type: 'lending' | 'staking' | 'liquidity_providing' | 'farming' | 'vaulting';
  protocol: string;
  weight: number; // percentage allocation
  parameters: Record<string, any>;
  dependencies?: string[];
}

export interface AllocationTarget {
  asset: string;
  percentage: number;
  minAmount: number;
  maxAmount: number;
  rebalanceThreshold: number;
}

export interface ExitStrategy {
  triggers: ExitTrigger[];
  maxSlippage: number;
  timeoutDuration: number;
  emergencyWithdrawal: boolean;
  partialExitAllowed: boolean;
}

export interface ExitTrigger {
  type: 'apy_drop' | 'risk_increase' | 'liquidity_decrease' | 'time_based' | 'manual';
  threshold: number;
  enabled: boolean;
}

export interface LiquidStakingPosition {
  id: string;
  validator: ValidatorInfo;
  asset: string;
  amount: number;
  stakingToken: string; // e.g., stETH, rETH, etc.
  apy: number;
  commission: number;
  slashingRisk: number;
  withdrawalDelay: number; // in seconds
  rewards: {
    accrued: number;
    claimed: number;
    lastClaim: Date;
  };
  status: 'active' | 'unbonding' | 'withdrawn' | 'slashed';
  createdAt: Date;
  updatedAt: Date;
}

export interface ValidatorInfo {
  id: string;
  name: string;
  address: string;
  chain: string;
  commission: number;
  performance: {
    uptime: number;
    effectiveness: number;
    slashingHistory: SlashingEvent[];
  };
  delegation: {
    totalStaked: number;
    delegatorCount: number;
    maxDelegation: number;
  };
  reputation: {
    score: number;
    reviews: number;
    verified: boolean;
  };
}

export interface SlashingEvent {
  date: Date;
  amount: number;
  reason: string;
  severity: 'minor' | 'major' | 'critical';
}

export interface ProtocolDiscovery {
  id: string;
  name: string;
  description: string;
  website: string;
  documentation: string;
  github?: string;
  audit: AuditInfo[];
  tvl: number;
  yields: YieldMetrics;
  risk: ProtocolRisk;
  discovery: {
    discoveredAt: Date;
    method: DiscoveryMethod;
    confidence: number;
    verified: boolean;
  };
  integration: {
    difficulty: 'easy' | 'medium' | 'hard';
    timeEstimate: number; // hours
    dependencies: string[];
    apiAvailable: boolean;
  };
  status: ProtocolStatus;
}

export interface AuditInfo {
  auditor: string;
  date: Date;
  report: string;
  score: number;
  findings: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
}

export interface YieldMetrics {
  current: number;
  average30d: number;
  max30d: number;
  min30d: number;
  volatility: number;
  consistency: number; // 0-1
}

export interface ProtocolRisk {
  overall: number; // 0-1
  smartContract: number;
  economic: number;
  governance: number;
  liquidity: number;
  centralization: number;
  factors: string[];
}

export interface SustainabilityAnalysis {
  tokenomics: {
    inflationRate: number;
    emissionSchedule: string;
    distribution: TokenDistribution;
    utility: string[];
  };
  revenue: {
    sources: RevenueSource[];
    sustainability: number; // 0-1
    growth: number;
  };
  adoption: {
    userGrowth: number;
    tvlGrowth: number;
    transactionVolume: number;
    retentionRate: number;
  };
  competitive: {
    advantages: string[];
    threats: string[];
    moatStrength: number; // 0-1
  };
}

export interface TokenDistribution {
  team: number;
  advisors: number;
  community: number;
  treasury: number;
  investors: number;
  liquidity: number;
}

export interface RevenueSource {
  type: 'fees' | 'inflation' | 'lending' | 'trading' | 'other';
  amount: number;
  percentage: number;
  sustainability: number; // 0-1
}

export interface OptimizationResult {
  id: string;
  strategy: YieldStrategy;
  allocation: PortfolioAllocation;
  expected: {
    apy: number;
    risk: number;
    sharpeRatio: number;
    maxDrawdown: number;
  };
  actual?: {
    apy: number;
    risk: number;
    returns: number;
    fees: number;
  };
  performance: PerformanceMetrics;
  timestamp: Date;
}

export interface PortfolioAllocation {
  totalValue: number;
  positions: AllocationPosition[];
  diversification: {
    protocolCount: number;
    chainCount: number;
    assetCount: number;
    strategyTypes: StrategyType[];
  };
  risk: {
    concentration: number; // 0-1, lower is better
    correlation: number; // -1 to 1
    volatility: number;
  };
}

export interface AllocationPosition {
  opportunity: YieldOpportunity;
  allocation: number; // percentage
  amount: number; // absolute amount
  weight: number; // portfolio weight
  performance: PositionPerformance;
}

export interface PositionPerformance {
  returns: number;
  fees: number;
  gas: number;
  netReturn: number;
  duration: number; // in seconds
  roi: number;
}

export interface PerformanceMetrics {
  totalReturn: number;
  annualizedReturn: number;
  sharpeRatio: number;
  sortinoRatio: number;
  maxDrawdown: number;
  winRate: number;
  profitFactor: number;
  volatility: number;
  alpha: number;
  beta: number;
  calmarRatio: number;
  informationRatio: number;
}

export interface BacktestResult {
  id: string;
  strategy: YieldStrategy;
  period: {
    start: Date;
    end: Date;
    duration: number; // in seconds
  };
  initialCapital: number;
  finalValue: number;
  performance: PerformanceMetrics;
  trades: TradeExecution[];
  drawdowns: DrawdownPeriod[];
  monthlySummary: MonthlySummary[];
  riskMetrics: RiskMetrics;
  benchmark: BenchmarkComparison;
}

export interface TradeExecution {
  id: string;
  timestamp: Date;
  type: 'enter' | 'exit' | 'rebalance';
  opportunity: string;
  amount: number;
  price: number;
  fees: number;
  gas: number;
  slippage: number;
  success: boolean;
  reason?: string;
}

export interface DrawdownPeriod {
  start: Date;
  end: Date;
  duration: number;
  maxDrawdown: number;
  recovery: boolean;
  recoveryTime?: number;
}

export interface MonthlySummary {
  month: string;
  return: number;
  fees: number;
  gas: number;
  netReturn: number;
  sharpeRatio: number;
  maxDrawdown: number;
  positions: number;
}

export interface RiskMetrics {
  var95: number; // Value at Risk 95%
  var99: number; // Value at Risk 99%
  cvar95: number; // Conditional VaR 95%
  maxDrawdown: number;
  consecutiveLosses: number;
  downside: number;
  beta: number;
  correlation: number;
}

export interface BenchmarkComparison {
  benchmark: string;
  benchmarkReturn: number;
  alpha: number;
  beta: number;
  correlation: number;
  informationRatio: number;
  trackingError: number;
  upCapture: number;
  downCapture: number;
}

export interface OptimizationRequest {
  capital: number;
  riskTolerance: number; // 0-1
  timeHorizon: number; // in seconds
  preferences: {
    minApy: number;
    maxRisk: number;
    preferredChains: string[];
    excludedProtocols: string[];
    autoCompound: boolean;
    gasOptimization: boolean;
  };
  constraints: {
    maxPositions: number;
    maxAllocationPerProtocol: number;
    maxAllocationPerChain: number;
    rebalanceFrequency: number;
  };
}

export interface StakingOptimizationRequest {
  asset: string;
  amount: number;
  duration: number; // in seconds
  preferences: {
    minApy: number;
    maxCommission: number;
    preferredValidators: string[];
    diversification: boolean;
    liquidStaking: boolean;
  };
  constraints: {
    maxValidators: number;
    minStakePerValidator: number;
    slashingTolerance: number;
  };
}

// Enums and constants
export enum StrategyType {
  SINGLE_ASSET_STAKING = 'single_asset_staking',
  LIQUID_STAKING = 'liquid_staking',
  YIELD_FARMING = 'yield_farming',
  LENDING = 'lending',
  LIQUIDITY_PROVISION = 'liquidity_provision',
  VAULT_STRATEGY = 'vault_strategy',
  MULTI_PROTOCOL = 'multi_protocol',
  ARBITRAGE = 'arbitrage',
  DELTA_NEUTRAL = 'delta_neutral',
  LEVERAGED_STAKING = 'leveraged_staking'
}

export enum RiskFactor {
  SMART_CONTRACT = 'smart_contract',
  LIQUIDITY = 'liquidity',
  IMPERMANENT_LOSS = 'impermanent_loss',
  SLASHING = 'slashing',
  GOVERNANCE = 'governance',
  CENTRALIZATION = 'centralization',
  REGULATORY = 'regulatory',
  ECONOMIC = 'economic',
  TECHNICAL = 'technical',
  OPERATIONAL = 'operational'
}

export enum SustainabilityCategory {
  HIGHLY_SUSTAINABLE = 'highly_sustainable',
  SUSTAINABLE = 'sustainable',
  MODERATELY_SUSTAINABLE = 'moderately_sustainable',
  LOW_SUSTAINABILITY = 'low_sustainability',
  UNSUSTAINABLE = 'unsustainable',
  PONZI_LIKE = 'ponzi_like'
}

export enum DiscoveryMethod {
  WEB_SCRAPING = 'web_scraping',
  API_MONITORING = 'api_monitoring',
  SOCIAL_LISTENING = 'social_listening',
  PARTNERSHIP = 'partnership',
  MANUAL_RESEARCH = 'manual_research',
  AI_ANALYSIS = 'ai_analysis',
  COMMUNITY_SUBMISSION = 'community_submission'
}

export enum ProtocolStatus {
  DISCOVERED = 'discovered',
  ANALYZING = 'analyzing',
  VERIFIED = 'verified',
  INTEGRATED = 'integrated',
  LIVE = 'live',
  DEPRECATED = 'deprecated',
  FLAGGED = 'flagged',
  BLOCKED = 'blocked'
}

export enum OptimizationObjective {
  MAXIMIZE_YIELD = 'maximize_yield',
  MINIMIZE_RISK = 'minimize_risk',
  MAXIMIZE_SHARPE = 'maximize_sharpe',
  MAXIMIZE_SORTINO = 'maximize_sortino',
  TARGET_RETURN = 'target_return',
  TARGET_RISK = 'target_risk',
  BALANCED = 'balanced'
}

export enum RebalanceStrategy {
  NONE = 'none',
  THRESHOLD = 'threshold',
  TIME_BASED = 'time_based',
  VOLATILITY_BASED = 'volatility_based',
  MOMENTUM = 'momentum',
  MEAN_REVERSION = 'mean_reversion',
  CALENDAR = 'calendar'
}

// Event types
export interface YieldOptimizationEvent {
  type: 'yield_optimization_completed';
  data: OptimizationResult;
  timestamp: Date;
}

export interface ProtocolDiscoveryEvent {
  type: 'protocol_discovered';
  data: ProtocolDiscovery;
  timestamp: Date;
}

export interface StakingOptimizationEvent {
  type: 'staking_optimization_completed';
  data: {
    request: StakingOptimizationRequest;
    result: LiquidStakingPosition[];
    optimization: OptimizationResult;
  };
  timestamp: Date;
}

export interface RebalanceEvent {
  type: 'rebalance_executed';
  data: {
    portfolioId: string;
    changes: AllocationPosition[];
    reason: string;
    performance: PerformanceMetrics;
  };
  timestamp: Date;
}

export interface SustainabilityAlertEvent {
  type: 'sustainability_alert';
  data: {
    opportunityId: string;
    previousCategory: SustainabilityCategory;
    newCategory: SustainabilityCategory;
    reasons: string[];
    recommendation: 'hold' | 'reduce' | 'exit';
  };
  timestamp: Date;
}

export type PulseEvent = 
  | YieldOptimizationEvent
  | ProtocolDiscoveryEvent
  | StakingOptimizationEvent
  | RebalanceEvent
  | SustainabilityAlertEvent;

// Request/Response types
export interface PulseAnalysisRequest {
  type: 'optimization' | 'discovery' | 'staking' | 'sustainability';
  parameters: OptimizationRequest | StakingOptimizationRequest | Record<string, any>;
  includeBacktest?: boolean;
  includePredictions?: boolean;
  timeframe?: number; // in seconds
}

export interface PulseAnalysisResponse {
  optimization?: OptimizationResult;
  discovery?: ProtocolDiscovery[];
  staking?: LiquidStakingPosition[];
  sustainability?: SustainabilityAnalysis;
  backtest?: BacktestResult;
  predictions?: YieldPrediction[];
  metadata: {
    requestId: string;
    processingTime: number;
    dataPoints: number;
    confidence: number;
    timestamp: Date;
  };
}

export interface YieldPrediction {
  opportunityId: string;
  timeframe: number; // in seconds
  predictions: {
    apy: number;
    risk: number;
    tvl: number;
    liquidity: number;
  };
  confidence: number;
  factors: PredictionFactor[];
  scenarios: PredictionScenario[];
}

export interface PredictionFactor {
  factor: string;
  impact: number; // -1 to 1
  confidence: number;
  category: 'market' | 'protocol' | 'macro' | 'technical';
}

export interface PredictionScenario {
  name: string;
  probability: number;
  outcome: {
    apy: number;
    risk: number;
    description: string;
  };
  timeline: string;
}

// Configuration types
export interface YieldOptimizationConfig {
  enableRealTimeOptimization: boolean;
  optimizationInterval: number;
  riskModel: 'conservative' | 'moderate' | 'aggressive' | 'custom';
  rebalanceThreshold: number;
  gasOptimization: boolean;
  maxSlippage: number;
  enableAutoCompound: boolean;
  minPositionSize: number;
  maxPositions: number;
  diversificationRequirement: number;
}

export interface ProtocolDiscoveryConfig {
  enableAutoDiscovery: boolean;
  discoveryInterval: number;
  sources: DiscoveryMethod[];
  verificationRequired: boolean;
  minTvlThreshold: number;
  minApyThreshold: number;
  maxRiskThreshold: number;
  autoIntegration: boolean;
  communitySubmissions: boolean;
}

export interface LiquidStakingConfig {
  enableAutoStaking: boolean;
  defaultValidatorSelection: 'performance' | 'diversification' | 'commission' | 'random';
  maxValidatorsPerAsset: number;
  rebalanceFrequency: number;
  slashingProtection: boolean;
  enableLiquidityTokens: boolean;
  autoClaimRewards: boolean;
  reinvestRewards: boolean;
}