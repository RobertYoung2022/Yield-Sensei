/**
 * Bridge Satellite Types
 * Cross-chain operations and arbitrage types
 */

export type ChainID = string;
export type BridgeID = string;
export type AssetID = string;
export type TransactionHash = string;

export interface ChainConfig {
  id: ChainID;
  name: string;
  rpcUrl: string;
  nativeCurrency: string;
  blockTime: number;
  gasTokenSymbol: string;
  maxGasPrice: string;
  confirmationBlocks: number;
}

export interface BridgeConfig {
  id: BridgeID;
  name: string;
  type: 'canonical' | 'third_party' | 'optimistic' | 'zk';
  supportedChains: ChainID[];
  trustLevel: number; // 0-100
  avgProcessingTime: number; // seconds
  feeStructure: FeeStructure;
  contractAddresses: Record<ChainID, string>;
}

export interface FeeStructure {
  baseFee: number;
  percentageFee: number;
  minFee: number;
  maxFee: number;
}

export interface AssetPrice {
  assetId: AssetID;
  chainId: ChainID;
  price: number;
  timestamp: number;
  source: string;
  liquidity: number;
  slippage: number;
}

export interface ArbitrageOpportunity {
  id: string;
  assetId: AssetID;
  sourceChain: ChainID;
  targetChain: ChainID;
  sourcePrice: number;
  targetPrice: number;
  priceDifference: number;
  percentageDifference: number;
  expectedProfit: number;
  estimatedGasCost: number;
  bridgeFee: number;
  netProfit: number;
  profitMargin: number;
  executionTime: number;
  riskScore: number;
  confidence: number;
  timestamp: number;
  executionPaths: ExecutionPath[];
}

export interface ExecutionPath {
  id: string;
  steps: ExecutionStep[];
  totalGasCost: number;
  totalFees: number;
  estimatedTime: number;
  successProbability: number;
  riskLevel: 'low' | 'medium' | 'high';
}

export interface ExecutionStep {
  type: 'swap' | 'bridge' | 'transfer';
  chainId: ChainID;
  protocol: string;
  contractAddress: string;
  estimatedGas: number;
  estimatedTime: number;
  dependencies: string[];
}

export interface BridgeRiskAssessment {
  bridgeId: BridgeID;
  safetyScore: number; // 0-100
  liquidityScore: number; // 0-100
  reliabilityScore: number; // 0-100
  securityScore: number; // 0-100
  overallScore: number; // 0-100
  riskFactors: RiskFactor[];
  historicalPerformance: HistoricalPerformance;
  lastUpdated: number;
}

export interface RiskFactor {
  type: 'security' | 'liquidity' | 'governance' | 'technical';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  impact: number; // 0-100
  likelihood: number; // 0-100
}

export interface HistoricalPerformance {
  totalTransactions: number;
  successRate: number;
  avgProcessingTime: number;
  uptimePercentage: number;
  incidentCount: number;
  lastIncident: number;
  totalValueLocked: number;
  dailyVolume: number;
}

export interface LiquidityPosition {
  chainId: ChainID;
  assetId: AssetID;
  amount: number;
  value: number;
  utilizationRate: number;
  targetAllocation: number;
  currentAllocation: number;
  rebalanceThreshold: number;
}

export interface CrossChainPortfolio {
  id: string;
  totalValue: number;
  positions: LiquidityPosition[];
  rebalanceNeeded: boolean;
  lastRebalance: number;
  targetDistribution: Record<ChainID, number>;
  actualDistribution: Record<ChainID, number>;
  efficiency: number; // 0-100
}

export interface TransactionResult {
  id: string;
  status: 'pending' | 'confirmed' | 'failed' | 'reverted';
  transactionHash?: TransactionHash;
  chainId: ChainID;
  gasUsed?: number;
  gasCost?: number;
  blockNumber?: number;
  timestamp: number;
  error?: string;
}

export interface ArbitrageExecution {
  opportunityId: string;
  executionPathId: string;
  status: 'initiated' | 'in_progress' | 'completed' | 'failed';
  transactions: TransactionResult[];
  actualProfit?: number;
  actualCost?: number;
  netReturn?: number;
  executionTime?: number;
  startTime: number;
  endTime?: number;
  failureReason?: string;
}

export interface BridgeMonitoringData {
  bridgeId: BridgeID;
  isOperational: boolean;
  currentTVL: number;
  dailyVolume: number;
  feeRate: number;
  avgProcessingTime: number;
  queueLength: number;
  lastTransaction: number;
  alerts: BridgeAlert[];
}

export interface BridgeAlert {
  id: string;
  bridgeId: BridgeID;
  type: 'high_fees' | 'long_delays' | 'low_liquidity' | 'security_incident' | 'maintenance';
  severity: 'info' | 'warning' | 'error' | 'critical';
  message: string;
  timestamp: number;
  acknowledged: boolean;
}

export interface CrossChainAnalytics {
  totalArbitrageOpportunities: number;
  totalArbitrageVolume: number;
  totalProfit: number;
  avgProfitMargin: number;
  successRate: number;
  avgExecutionTime: number;
  topPerformingChains: ChainID[];
  topAssets: AssetID[];
  bridgePerformance: Record<BridgeID, BridgePerformanceMetrics>;
}

export interface BridgePerformanceMetrics {
  bridgeId: BridgeID;
  usageCount: number;
  totalVolume: number;
  avgFee: number;
  successRate: number;
  avgProcessingTime: number;
  reliability: number;
}

export interface OptimizationResult {
  currentScore: number;
  optimizedScore: number;
  improvement: number;
  recommendations: OptimizationRecommendation[];
  estimatedSavings: number;
  implementationEffort: 'low' | 'medium' | 'high';
}

export interface OptimizationRecommendation {
  type: 'rebalance' | 'route_change' | 'bridge_switch' | 'timing_optimization';
  description: string;
  impact: number; // 0-100
  effort: number; // 0-100
  priority: 'low' | 'medium' | 'high';
  estimatedSavings: number;
}