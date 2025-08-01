/**
 * Fuel Satellite Type Definitions
 * Types for capital deployment, gas optimization, and logistics management
 */

import { AgentId } from '../../../types';

// Core Types
export interface FuelSatelliteConfig {
  id: AgentId;
  name: string;
  version: string;
  capitalDeployment: CapitalDeploymentConfig;
  gasOptimization: GasOptimizationConfig;
  walletManagement: WalletManagementConfig;
  taxOptimization: TaxOptimizationConfig;
  rebalancing: RebalancingConfig;
  integration: IntegrationConfig;
}

// Capital Deployment Types
export interface CapitalDeploymentConfig {
  enableAutoDeployment: boolean;
  riskAdjustedDeployment: boolean;
  deploymentInterval: number; // milliseconds
  minDeploymentAmount: number;
  maxDeploymentPerProtocol: number;
  maxDeploymentPerChain: number;
  emergencyWithdrawalThreshold: number;
  taxAwareDeployment: boolean;
}

export interface DeploymentStrategy {
  id: string;
  name: string;
  type: DeploymentType;
  targetAllocations: AllocationTarget[];
  constraints: DeploymentConstraints;
  riskParameters: RiskParameters;
  active: boolean;
}

export enum DeploymentType {
  AGGRESSIVE = 'aggressive',
  BALANCED = 'balanced',
  CONSERVATIVE = 'conservative',
  CUSTOM = 'custom'
}

export interface AllocationTarget {
  protocol: string;
  chain: string;
  percentage: number;
  minAmount: number;
  maxAmount: number;
}

export interface DeploymentConstraints {
  maxSlippage: number;
  maxGasCost: number;
  minLiquidity: number;
  requiredApprovals: number;
}

export interface RiskParameters {
  maxDrawdown: number;
  volatilityThreshold: number;
  correlationLimit: number;
  stressTestRequired: boolean;
}

// Gas Optimization Types
export interface GasOptimizationConfig {
  enableDynamicPricing: boolean;
  enableBatching: boolean;
  enableTiming: boolean;
  predictionModel: 'ml' | 'statistical' | 'hybrid';
  batchingThreshold: number; // Number of transactions
  maxBatchDelay: number; // milliseconds
  crossChainOptimization: boolean;
  priorityFeeStrategy: PriorityFeeStrategy;
}

export enum PriorityFeeStrategy {
  AGGRESSIVE = 'aggressive', // Always use high priority
  BALANCED = 'balanced', // Balance cost and speed
  ECONOMICAL = 'economical', // Minimize costs
  ADAPTIVE = 'adaptive' // ML-based adaptation
}

export interface GasEstimate {
  chainId: string;
  baseFee: bigint;
  priorityFee: bigint;
  maxFeePerGas: bigint;
  estimatedCost: bigint;
  executionTime: number; // estimated milliseconds
  confidence: number; // 0-1
}

export interface GasPrediction {
  timestamp: Date;
  predictions: {
    immediate: GasEstimate;
    in5Minutes: GasEstimate;
    in15Minutes: GasEstimate;
    in1Hour: GasEstimate;
  };
  recommendedTiming: Date;
  potentialSavings: bigint;
}

export interface TransactionBatch {
  id: string;
  transactions: PendingTransaction[];
  estimatedGas: GasEstimate;
  scheduledTime: Date;
  status: BatchStatus;
  savings: bigint;
}

export enum BatchStatus {
  PENDING = 'pending',
  SCHEDULED = 'scheduled',
  EXECUTING = 'executing',
  COMPLETED = 'completed',
  FAILED = 'failed'
}

export interface PendingTransaction {
  id: string;
  type: TransactionType;
  from: string;
  to: string;
  value: bigint;
  data: string;
  chainId: string;
  priority: TransactionPriority;
  deadline?: Date;
}

export enum TransactionType {
  DEPLOYMENT = 'deployment',
  WITHDRAWAL = 'withdrawal',
  REBALANCE = 'rebalance',
  HARVEST = 'harvest',
  COMPOUND = 'compound',
  APPROVAL = 'approval'
}

export enum TransactionPriority {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low'
}

// Wallet Management Types
export interface WalletManagementConfig {
  enableMultiWallet: boolean;
  enableRotation: boolean;
  rotationInterval: number; // milliseconds
  maxWalletsPerChain: number;
  roleBasedAccess: boolean;
  anomalyDetection: boolean;
  backupStrategy: BackupStrategy;
  elizaosPlugins?: string[];
}

export enum BackupStrategy {
  ENCRYPTED_CLOUD = 'encrypted_cloud',
  HARDWARE_WALLET = 'hardware_wallet',
  MULTI_SIG = 'multi_sig',
  SHAMIR_SHARES = 'shamir_shares'
}

export interface ManagedWallet {
  id: string;
  address: string;
  name: string;
  chain: string;
  type: WalletType;
  role: WalletRole;
  balance: Record<string, bigint>; // token -> amount
  nonce: number;
  health: WalletHealth;
  lastActivity: Date;
  metadata: Record<string, any>;
}

export enum WalletType {
  HOT = 'hot',
  WARM = 'warm',
  COLD = 'cold',
  HARDWARE = 'hardware',
  MULTI_SIG = 'multi_sig'
}

export enum WalletRole {
  TREASURY = 'treasury',
  OPERATIONS = 'operations',
  YIELD_FARMING = 'yield_farming',
  LIQUIDITY = 'liquidity',
  EMERGENCY = 'emergency'
}

export interface WalletHealth {
  status: 'healthy' | 'warning' | 'critical';
  issues: string[];
  lastCheck: Date;
  securityScore: number; // 0-100
}

// Tax Optimization Types
export interface TaxOptimizationConfig {
  enableHarvesting: boolean;
  enableReporting: boolean;
  jurisdiction: string;
  taxYear: number;
  washSalePeriod: number; // days
  minimumLoss: number; // USD
  reportingFormat: 'csv' | 'json' | 'pdf';
  automatedExecution: boolean;
}

export interface TaxLossOpportunity {
  id: string;
  asset: string;
  currentPrice: number;
  costBasis: number;
  unrealizedLoss: number;
  holdingPeriod: number; // days
  taxImpact: TaxImpact;
  recommendedAction: HarvestAction;
  deadline?: Date;
}

export interface TaxImpact {
  shortTermLoss: number;
  longTermLoss: number;
  taxSavings: number;
  effectiveRate: number;
}

export interface HarvestAction {
  type: 'sell' | 'swap' | 'hold';
  targetAsset?: string;
  estimatedProceeds: number;
  gasEstimate: GasEstimate;
  washSaleRisk: boolean;
}

export interface TaxReport {
  id: string;
  taxYear: number;
  generatedAt: Date;
  transactions: TaxableTransaction[];
  summary: TaxSummary;
  forms: TaxForm[];
}

export interface TaxableTransaction {
  id: string;
  date: Date;
  type: 'buy' | 'sell' | 'swap' | 'income' | 'gift';
  asset: string;
  amount: number;
  proceeds: number;
  costBasis: number;
  gainLoss: number;
  termType: 'short' | 'long';
}

export interface TaxSummary {
  totalProceeds: number;
  totalCostBasis: number;
  shortTermGains: number;
  shortTermLosses: number;
  longTermGains: number;
  longTermLosses: number;
  netGainLoss: number;
  estimatedTax: number;
}

export interface TaxForm {
  type: 'Form8949' | 'Schedule D' | '1099-B';
  data: Record<string, any>;
  status: 'draft' | 'final';
}

// Rebalancing Types
export interface RebalancingConfig {
  enableAutoRebalancing: boolean;
  rebalanceThreshold: number; // percentage drift
  rebalanceInterval: number; // milliseconds
  strategy: RebalanceStrategy;
  taxAware: boolean;
  minTradeSize: number;
  maxSlippage: number;
  prioritizeGasEfficiency: boolean;
}

export enum RebalanceStrategy {
  THRESHOLD = 'threshold',
  CALENDAR = 'calendar',
  VOLATILITY = 'volatility',
  CORRELATION = 'correlation',
  HYBRID = 'hybrid'
}

export interface RebalanceProposal {
  id: string;
  timestamp: Date;
  currentAllocations: PortfolioAllocation[];
  targetAllocations: PortfolioAllocation[];
  trades: RebalanceTrade[];
  estimatedCosts: RebalanceCosts;
  impact: RebalanceImpact;
  approved: boolean;
}

export interface PortfolioAllocation {
  asset: string;
  chain: string;
  protocol: string;
  currentValue: number;
  currentPercentage: number;
  targetPercentage: number;
  drift: number;
}

export interface RebalanceTrade {
  id: string;
  type: 'buy' | 'sell' | 'swap';
  fromAsset: string;
  toAsset: string;
  amount: number;
  estimatedPrice: number;
  route: TradeRoute[];
}

export interface TradeRoute {
  protocol: string;
  chain: string;
  pool: string;
  estimatedSlippage: number;
}

export interface RebalanceCosts {
  gasCosts: Record<string, bigint>; // chain -> cost
  slippage: number;
  protocolFees: number;
  taxImpact: number;
  totalCost: number;
}

export interface RebalanceImpact {
  expectedReturn: number;
  riskReduction: number;
  diversificationScore: number;
  taxEfficiency: number;
}

// Integration Types
export interface IntegrationConfig {
  sageIntegration: boolean;
  bridgeIntegration: boolean;
  aegisIntegration: boolean;
  forgeIntegration: boolean;
  elizaosIntegration: boolean;
  webhookUrl?: string;
  apiKey?: string;
}

// Events
export interface FuelEvent {
  type: FuelEventType;
  data: any;
  timestamp: Date;
  severity: 'info' | 'warning' | 'error' | 'critical';
}

export enum FuelEventType {
  // Capital Deployment
  CAPITAL_DEPLOYED = 'capital_deployed',
  CAPITAL_WITHDRAWN = 'capital_withdrawn',
  DEPLOYMENT_FAILED = 'deployment_failed',
  
  // Gas Optimization
  GAS_PREDICTION_UPDATED = 'gas_prediction_updated',
  BATCH_EXECUTED = 'batch_executed',
  GAS_SPIKE_DETECTED = 'gas_spike_detected',
  
  // Wallet Management
  WALLET_ADDED = 'wallet_added',
  WALLET_ROTATED = 'wallet_rotated',
  WALLET_ANOMALY = 'wallet_anomaly',
  
  // Tax Events
  HARVEST_OPPORTUNITY = 'harvest_opportunity',
  HARVEST_EXECUTED = 'harvest_executed',
  TAX_REPORT_GENERATED = 'tax_report_generated',
  
  // Rebalancing
  REBALANCE_TRIGGERED = 'rebalance_triggered',
  REBALANCE_EXECUTED = 'rebalance_executed',
  REBALANCE_FAILED = 'rebalance_failed'
}

// Status Types
export interface FuelStatus {
  operational: boolean;
  capitalDeployed: number;
  activeWallets: number;
  pendingTransactions: number;
  lastRebalance: Date;
  taxHarvestingActive: boolean;
  gasOptimizationSavings: number;
  health: SystemHealth;
}

export interface SystemHealth {
  overall: 'healthy' | 'degraded' | 'critical';
  components: {
    capitalDeployment: ComponentHealth;
    gasOptimization: ComponentHealth;
    walletManagement: ComponentHealth;
    taxOptimization: ComponentHealth;
    rebalancing: ComponentHealth;
  };
}

export interface ComponentHealth {
  status: 'healthy' | 'warning' | 'error';
  message?: string;
  lastCheck: Date;
  metrics: Record<string, number>;
}