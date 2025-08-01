/**
 * Portfolio Rebalancing Module
 * Exports rebalancing and trade execution components
 */

export { PortfolioRebalancer, PortfolioRebalancerConfig } from './portfolio-rebalancer';
export { TradeExecutor, TradeExecutorConfig } from './trade-executor';

// Re-export types for convenience
export type {
  RebalancingConfig,
  RebalanceProposal,
  PortfolioAllocation,
  RebalanceTrade,
  RebalanceCosts,
  RebalanceImpact,
  TradeRoute,
  RebalanceStrategy
} from '../types';