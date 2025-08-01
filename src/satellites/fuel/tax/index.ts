/**
 * Tax Optimization Module
 * Exports tax-loss harvesting and reporting components
 */

export { TaxLossHarvester, TaxLossHarvesterConfig } from './tax-loss-harvester';
export { TaxReportingEngine, TaxReportingEngineConfig } from './tax-reporting-engine';

// Re-export types for convenience
export type {
  TaxOptimizationConfig,
  TaxLossOpportunity,
  TaxImpact,
  HarvestAction,
  TaxReport,
  TaxableTransaction,
  TaxSummary,
  TaxForm
} from '../types';