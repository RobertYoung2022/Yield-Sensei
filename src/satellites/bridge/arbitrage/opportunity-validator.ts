/**
 * Opportunity Validator
 * Validates arbitrage opportunities through simulation and risk assessment
 */

import { ethers } from 'ethers';
import Logger from '../../../shared/logging/logger';
import { 
  ArbitrageOpportunity,
  ExecutionPath,
  ExecutionStep,
  ChainID,
  AssetID,
  TransactionResult
} from '../types';
import { ChainConnectorService } from './chain-connector';
import { PriceFeedManager } from './price-feed-manager';

const logger = Logger.getLogger('opportunity-validator');

export interface ValidationResult {
  opportunityId: string;
  isValid: boolean;
  adjustedProfit: number;
  riskScore: number;
  confidence: number;
  issues: ValidationIssue[];
  simulationResults: SimulationResult[];
  mevRisk: MEVRiskAssessment;
}

export interface ValidationIssue {
  type: 'liquidity' | 'slippage' | 'gas' | 'mev' | 'price_stale' | 'bridge_delay';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  impact: number; // Estimated profit impact
}

export interface SimulationResult {
  stepIndex: number;
  chainId: ChainID;
  success: boolean;
  estimatedOutput: bigint;
  estimatedGas: bigint;
  slippage: number;
  error?: string;
}

export interface MEVRiskAssessment {
  frontrunningRisk: number; // 0-100
  sandwichRisk: number; // 0-100
  estimatedMEVLoss: number;
  recommendedStrategy: 'flashloan' | 'private_mempool' | 'split_order' | 'standard';
}

export interface ValidatorConfig {
  maxSlippageTolerance: number; // e.g., 0.02 for 2%
  minLiquidityUSD: number; // Minimum liquidity required
  maxPriceAge: number; // Maximum price age in seconds
  mevProtectionThreshold: number; // Profit threshold for MEV protection
  simulationGasBuffer: number; // Gas estimate buffer (e.g., 1.2 for 20% buffer)
}

export class OpportunityValidator {
  private chainConnector: ChainConnectorService;
  private priceFeedManager: PriceFeedManager;
  private config: ValidatorConfig;

  constructor(
    chainConnector: ChainConnectorService,
    priceFeedManager: PriceFeedManager,
    config: ValidatorConfig
  ) {
    this.chainConnector = chainConnector;
    this.priceFeedManager = priceFeedManager;
    this.config = config;
  }

  async validateOpportunity(opportunity: ArbitrageOpportunity): Promise<ValidationResult> {
    logger.info(`Validating opportunity ${opportunity.id}`);

    const issues: ValidationIssue[] = [];
    const simulationResults: SimulationResult[] = [];

    // Check price freshness
    const priceAge = (Date.now() - opportunity.timestamp) / 1000;
    if (priceAge > this.config.maxPriceAge) {
      issues.push({
        type: 'price_stale',
        severity: 'high',
        description: `Price data is ${priceAge}s old (max: ${this.config.maxPriceAge}s)`,
        impact: opportunity.expectedProfit * 0.3, // 30% potential impact
      });
    }

    // Validate execution path
    const path = opportunity.executionPaths[0];
    if (!path) {
      return {
        opportunityId: opportunity.id,
        isValid: false,
        adjustedProfit: 0,
        riskScore: 100,
        confidence: 0,
        issues: [{
          type: 'gas',
          severity: 'critical',
          description: 'No execution path found',
          impact: opportunity.expectedProfit,
        }],
        simulationResults: [],
        mevRisk: this.assessMEVRisk(opportunity, []),
      };
    }

    // Simulate each step
    let currentAmount = ethers.parseEther('1'); // Start with 1 unit
    for (let i = 0; i < path.steps.length; i++) {
      const step = path.steps[i];
      const result = await this.simulateStep(step, currentAmount, opportunity.assetId);
      
      simulationResults.push(result);

      if (!result.success) {
        issues.push({
          type: 'liquidity',
          severity: 'critical',
          description: `Step ${i} simulation failed: ${result.error}`,
          impact: opportunity.expectedProfit,
        });
        break;
      }

      // Check slippage
      if (result.slippage > this.config.maxSlippageTolerance) {
        issues.push({
          type: 'slippage',
          severity: result.slippage > this.config.maxSlippageTolerance * 2 ? 'high' : 'medium',
          description: `High slippage on step ${i}: ${(result.slippage * 100).toFixed(2)}%`,
          impact: opportunity.expectedProfit * result.slippage,
        });
      }

      currentAmount = result.estimatedOutput;
    }

    // Validate liquidity depth
    const liquidityIssues = await this.validateLiquidity(opportunity, path);
    issues.push(...liquidityIssues);

    // Assess MEV risks
    const mevRisk = this.assessMEVRisk(opportunity, simulationResults);
    if (mevRisk.frontrunningRisk > 50 || mevRisk.sandwichRisk > 50) {
      issues.push({
        type: 'mev',
        severity: 'high',
        description: `High MEV risk: Frontrun ${mevRisk.frontrunningRisk}%, Sandwich ${mevRisk.sandwichRisk}%`,
        impact: mevRisk.estimatedMEVLoss,
      });
    }

    // Check gas costs across chains
    const gasIssues = await this.validateGasCosts(opportunity, path);
    issues.push(...gasIssues);

    // Calculate adjusted profit
    const totalImpact = issues.reduce((sum, issue) => sum + issue.impact, 0);
    const adjustedProfit = Math.max(0, opportunity.expectedProfit - totalImpact);

    // Calculate final scores
    const criticalIssues = issues.filter(i => i.severity === 'critical').length;
    const highIssues = issues.filter(i => i.severity === 'high').length;
    
    const riskScore = Math.min(100, 
      criticalIssues * 50 + 
      highIssues * 20 + 
      mevRisk.frontrunningRisk * 0.3 + 
      mevRisk.sandwichRisk * 0.2
    );

    const confidence = Math.max(0, 100 - riskScore) * 
      (simulationResults.filter(r => r.success).length / path.steps.length);

    const isValid = criticalIssues === 0 && 
      adjustedProfit > 0 && 
      confidence > 50;

    return {
      opportunityId: opportunity.id,
      isValid,
      adjustedProfit,
      riskScore,
      confidence,
      issues,
      simulationResults,
      mevRisk,
    };
  }

  private async simulateStep(
    step: ExecutionStep,
    inputAmount: bigint,
    assetId: AssetID
  ): Promise<SimulationResult> {
    try {
      const provider = await this.chainConnector.getProvider(step.chainId);
      if (!provider) {
        return {
          stepIndex: 0,
          chainId: step.chainId,
          success: false,
          estimatedOutput: BigInt(0),
          estimatedGas: BigInt(0),
          slippage: 0,
          error: 'Provider not available',
        };
      }

      if (step.type === 'swap') {
        return await this.simulateSwap(step, inputAmount, assetId, provider);
      } else if (step.type === 'bridge') {
        return await this.simulateBridge(step, inputAmount, assetId, provider);
      } else {
        return await this.simulateTransfer(step, inputAmount, assetId, provider);
      }
    } catch (error) {
      logger.error(`Simulation error for step on ${step.chainId}:`, error);
      return {
        stepIndex: 0,
        chainId: step.chainId,
        success: false,
        estimatedOutput: BigInt(0),
        estimatedGas: BigInt(0),
        slippage: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async simulateSwap(
    step: ExecutionStep,
    inputAmount: bigint,
    assetId: AssetID,
    provider: ethers.Provider
  ): Promise<SimulationResult> {
    try {
      // Get current price for slippage calculation
      const currentPrice = await this.priceFeedManager.getPrice(step.chainId, assetId);
      if (!currentPrice) {
        throw new Error('Current price not available');
      }

      // Create router contract instance
      const routerAbi = [
        'function getAmountsOut(uint amountIn, address[] memory path) public view returns (uint[] memory amounts)',
      ];
      const router = new ethers.Contract(step.contractAddress, routerAbi, provider);

      // Simulate the swap (simplified - would need actual token addresses)
      const path = ['0x...', '0x...']; // Would need actual token addresses
      const amounts = await router.getAmountsOut(inputAmount, path);
      const outputAmount = amounts[amounts.length - 1];

      // Calculate slippage
      const expectedOutput = inputAmount * BigInt(Math.floor(currentPrice.price * 1e18)) / BigInt(1e18);
      const slippage = Number(expectedOutput - outputAmount) / Number(expectedOutput);

      // Estimate gas
      const gasEstimate = await provider.estimateGas({
        to: step.contractAddress,
        data: router.interface.encodeFunctionData('getAmountsOut', [inputAmount, path]),
      });

      return {
        stepIndex: 0,
        chainId: step.chainId,
        success: true,
        estimatedOutput: outputAmount,
        estimatedGas: gasEstimate * BigInt(Math.floor(this.config.simulationGasBuffer * 100)) / BigInt(100),
        slippage: Math.max(0, slippage),
      };
    } catch (error) {
      return {
        stepIndex: 0,
        chainId: step.chainId,
        success: false,
        estimatedOutput: BigInt(0),
        estimatedGas: step.estimatedGas,
        slippage: 0,
        error: error instanceof Error ? error.message : 'Swap simulation failed',
      };
    }
  }

  private async simulateBridge(
    step: ExecutionStep,
    inputAmount: bigint,
    assetId: AssetID,
    provider: ethers.Provider
  ): Promise<SimulationResult> {
    try {
      // Bridge simulation is more complex and would require specific bridge ABIs
      // For now, we'll use a simplified estimation
      
      // Assume 0.1% bridge fee
      const bridgeFee = inputAmount * BigInt(10) / BigInt(10000);
      const outputAmount = inputAmount - bridgeFee;

      // Estimate gas for bridge transaction
      const gasEstimate = BigInt(150000); // Typical bridge gas usage

      return {
        stepIndex: 0,
        chainId: step.chainId,
        success: true,
        estimatedOutput: outputAmount,
        estimatedGas: gasEstimate * BigInt(Math.floor(this.config.simulationGasBuffer * 100)) / BigInt(100),
        slippage: 0.001, // 0.1% fee as slippage
      };
    } catch (error) {
      return {
        stepIndex: 0,
        chainId: step.chainId,
        success: false,
        estimatedOutput: BigInt(0),
        estimatedGas: step.estimatedGas,
        slippage: 0,
        error: error instanceof Error ? error.message : 'Bridge simulation failed',
      };
    }
  }

  private async simulateTransfer(
    step: ExecutionStep,
    inputAmount: bigint,
    assetId: AssetID,
    provider: ethers.Provider
  ): Promise<SimulationResult> {
    try {
      // Simple transfer simulation
      const gasEstimate = BigInt(21000); // Standard transfer gas

      return {
        stepIndex: 0,
        chainId: step.chainId,
        success: true,
        estimatedOutput: inputAmount, // No loss in transfer
        estimatedGas: gasEstimate,
        slippage: 0,
      };
    } catch (error) {
      return {
        stepIndex: 0,
        chainId: step.chainId,
        success: false,
        estimatedOutput: BigInt(0),
        estimatedGas: step.estimatedGas,
        slippage: 0,
        error: error instanceof Error ? error.message : 'Transfer simulation failed',
      };
    }
  }

  private async validateLiquidity(
    opportunity: ArbitrageOpportunity,
    path: ExecutionPath
  ): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];

    // Check liquidity for each swap step
    for (let i = 0; i < path.steps.length; i++) {
      const step = path.steps[i];
      if (step.type !== 'swap') continue;

      // Get liquidity data from chain connector
      const dexName = step.protocol;
      const liquidity = await this.chainConnector.getTokenPairLiquidity(
        step.chainId,
        dexName,
        '0x...', // Would need actual token addresses
        '0x...'
      );

      if (!liquidity) {
        issues.push({
          type: 'liquidity',
          severity: 'high',
          description: `No liquidity data for ${dexName} on ${step.chainId}`,
          impact: opportunity.expectedProfit * 0.5,
        });
        continue;
      }

      // Convert reserves to USD value (simplified)
      const liquidityUSD = Number(liquidity.reserve0) / 1e18 * 1000; // Assume $1000 per token

      if (liquidityUSD < this.config.minLiquidityUSD) {
        issues.push({
          type: 'liquidity',
          severity: liquidityUSD < this.config.minLiquidityUSD / 2 ? 'high' : 'medium',
          description: `Low liquidity on ${dexName}: $${liquidityUSD.toFixed(0)}`,
          impact: opportunity.expectedProfit * 0.2,
        });
      }
    }

    return issues;
  }

  private assessMEVRisk(
    opportunity: ArbitrageOpportunity,
    simulationResults: SimulationResult[]
  ): MEVRiskAssessment {
    // Calculate frontrunning risk based on profit margin
    const profitMargin = opportunity.profitMargin;
    const frontrunningRisk = Math.min(100, profitMargin * 1000); // Higher profit = higher risk

    // Calculate sandwich risk based on liquidity impact
    const totalSlippage = simulationResults.reduce((sum, r) => sum + r.slippage, 0);
    const sandwichRisk = Math.min(100, totalSlippage * 500); // Higher slippage = higher sandwich risk

    // Estimate MEV loss
    const estimatedMEVLoss = opportunity.expectedProfit * 
      (frontrunningRisk * 0.5 + sandwichRisk * 0.3) / 100;

    // Recommend strategy
    let recommendedStrategy: MEVRiskAssessment['recommendedStrategy'] = 'standard';
    
    if (opportunity.expectedProfit > this.config.mevProtectionThreshold) {
      if (frontrunningRisk > 70 || sandwichRisk > 70) {
        recommendedStrategy = 'flashloan';
      } else if (frontrunningRisk > 50 || sandwichRisk > 50) {
        recommendedStrategy = 'private_mempool';
      } else if (frontrunningRisk > 30 || sandwichRisk > 30) {
        recommendedStrategy = 'split_order';
      }
    }

    return {
      frontrunningRisk,
      sandwichRisk,
      estimatedMEVLoss,
      recommendedStrategy,
    };
  }

  private async validateGasCosts(
    opportunity: ArbitrageOpportunity,
    path: ExecutionPath
  ): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];

    // Get current gas prices for all chains
    const gasEstimates = await this.chainConnector.getMultiChainGasEstimates();

    let totalGasCostUSD = 0;
    for (const step of path.steps) {
      const gasEstimate = gasEstimates.get(step.chainId);
      if (!gasEstimate) {
        issues.push({
          type: 'gas',
          severity: 'medium',
          description: `No gas estimate for ${step.chainId}`,
          impact: 50, // $50 impact assumption
        });
        continue;
      }

      // Convert gas cost to USD (simplified)
      const gasCostETH = Number(gasEstimate.estimatedCost) / 1e18;
      const gasCostUSD = gasCostETH * 2000; // Assume $2000/ETH
      totalGasCostUSD += gasCostUSD;
    }

    // Check if gas costs are too high relative to profit
    const gasToProfit = totalGasCostUSD / opportunity.expectedProfit;
    if (gasToProfit > 0.5) {
      issues.push({
        type: 'gas',
        severity: gasToProfit > 0.8 ? 'high' : 'medium',
        description: `High gas costs: $${totalGasCostUSD.toFixed(2)} (${(gasToProfit * 100).toFixed(1)}% of profit)`,
        impact: totalGasCostUSD - opportunity.estimatedGasCost,
      });
    }

    return issues;
  }

  async validateBatch(opportunities: ArbitrageOpportunity[]): Promise<ValidationResult[]> {
    const results = await Promise.all(
      opportunities.map(opp => this.validateOpportunity(opp))
    );

    // Sort by adjusted profit
    return results.sort((a, b) => b.adjustedProfit - a.adjustedProfit);
  }

  getValidationStats(results: ValidationResult[]): {
    totalValidated: number;
    validCount: number;
    avgRiskScore: number;
    avgConfidence: number;
    commonIssues: Record<string, number>;
    mevStrategies: Record<string, number>;
  } {
    const validResults = results.filter(r => r.isValid);
    
    const commonIssues: Record<string, number> = {};
    const mevStrategies: Record<string, number> = {};

    for (const result of results) {
      for (const issue of result.issues) {
        commonIssues[issue.type] = (commonIssues[issue.type] || 0) + 1;
      }
      
      mevStrategies[result.mevRisk.recommendedStrategy] = 
        (mevStrategies[result.mevRisk.recommendedStrategy] || 0) + 1;
    }

    return {
      totalValidated: results.length,
      validCount: validResults.length,
      avgRiskScore: results.reduce((sum, r) => sum + r.riskScore, 0) / results.length,
      avgConfidence: results.reduce((sum, r) => sum + r.confidence, 0) / results.length,
      commonIssues,
      mevStrategies,
    };
  }
}