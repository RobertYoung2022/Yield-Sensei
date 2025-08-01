/**
 * Opportunity Validator Test Suite
 * Testing validation logic and accuracy metrics
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { OpportunityValidator, ValidatorConfig } from '../opportunity-validator';
import { ArbitrageOpportunity, ChainID, AssetID } from '../../types';

jest.mock('../chain-connector');
jest.mock('../price-feed-manager');

describe('OpportunityValidator', () => {
  let validator: OpportunityValidator;
  let mockConfig: ValidatorConfig;
  let mockChainConnector: any;
  let mockPriceFeedManager: any;

  beforeEach(() => {
    mockConfig = {
      maxSlippageTolerance: 0.02, // 2%
      minLiquidityUSD: 100000, // $100k
      maxPriceAge: 30, // 30 seconds
      mevProtectionThreshold: 100, // $100
      simulationGasBuffer: 1.2 // 20% buffer
    };

    mockChainConnector = {
      getAssetBalance: jest.fn(),
      estimateGasCost: jest.fn(),
      simulateTransaction: jest.fn()
    };

    mockPriceFeedManager = {
      getPrice: jest.fn(),
      getPriceAge: jest.fn()
    };

    validator = new OpportunityValidator(mockChainConnector, mockPriceFeedManager, mockConfig);
  });

  describe('Validation Logic', () => {
    it('should validate profitable opportunities correctly', async () => {
      const opportunity: ArbitrageOpportunity = {
        id: 'test-opp-1',
        assetId: 'USDC' as AssetID,
        sourceChain: 'ethereum' as ChainID,
        targetChain: 'polygon' as ChainID,
        sourcePrice: 1.0000,
        targetPrice: 0.995,
        priceDifference: 0.005,
        percentageDifference: 0.5,
        expectedProfit: 500,
        estimatedGasCost: 50,
        bridgeFee: 25,
        netProfit: 425,
        profitMargin: 0.85,
        executionTime: 120,
        riskScore: 30,
        confidence: 0.9,
        timestamp: Date.now(),
        executionPaths: []
      };

      // Mock successful validation conditions
      mockChainConnector.getAssetBalance.mockResolvedValue(1000000); // $1M liquidity
      mockChainConnector.estimateGasCost.mockResolvedValue(45); // Lower than expected
      mockChainConnector.simulateTransaction.mockResolvedValue({ success: true, gasUsed: 150000 });
      mockPriceFeedManager.getPriceAge.mockResolvedValue(15); // Fresh price

      const result = await validator.validateOpportunity(opportunity);

      expect(result.isValid).toBe(true);
      expect(result.adjustedProfit).toBeGreaterThan(400);
      expect(result.riskScore).toBeLessThan(50);
      expect(result.confidence).toBeGreaterThan(0.8);
    });

    it('should reject opportunities with insufficient liquidity', async () => {
      const opportunity: ArbitrageOpportunity = {
        id: 'test-opp-2',
        assetId: 'USDC' as AssetID,
        sourceChain: 'ethereum' as ChainID,
        targetChain: 'polygon' as ChainID,
        sourcePrice: 1.0000,
        targetPrice: 0.990,
        priceDifference: 0.01,
        percentageDifference: 1.0,
        expectedProfit: 1000,
        estimatedGasCost: 50,
        bridgeFee: 25,
        netProfit: 925,
        profitMargin: 0.925,
        executionTime: 120,
        riskScore: 25,
        confidence: 0.95,
        timestamp: Date.now(),
        executionPaths: []
      };

      // Mock insufficient liquidity
      mockChainConnector.getAssetBalance.mockResolvedValue(50000); // Only $50k liquidity
      mockPriceFeedManager.getPriceAge.mockResolvedValue(10);

      const result = await validator.validateOpportunity(opportunity);

      expect(result.isValid).toBe(false);
      expect(result.rejectionReasons).toContain('Insufficient liquidity');
      expect(result.riskScore).toBeGreaterThan(70);
    });

    it('should handle stale price data correctly', async () => {
      const opportunity: ArbitrageOpportunity = {
        id: 'test-opp-3',
        assetId: 'USDC' as AssetID,
        sourceChain: 'ethereum' as ChainID,
        targetChain: 'arbitrum' as ChainID,
        sourcePrice: 1.0000,
        targetPrice: 0.992,
        priceDifference: 0.008,
        percentageDifference: 0.8,
        expectedProfit: 800,
        estimatedGasCost: 60,
        bridgeFee: 30,
        netProfit: 710,
        profitMargin: 0.8875,
        executionTime: 180,
        riskScore: 35,
        confidence: 0.85,
        timestamp: Date.now(),
        executionPaths: []
      };

      // Mock stale price data
      mockChainConnector.getAssetBalance.mockResolvedValue(500000);
      mockPriceFeedManager.getPriceAge.mockResolvedValue(45); // 45 seconds old

      const result = await validator.validateOpportunity(opportunity);

      expect(result.isValid).toBe(false);
      expect(result.rejectionReasons).toContain('Price data too old');
      expect(result.confidence).toBeLessThan(0.5);
    });
  });

  describe('Batch Validation', () => {
    it('should validate multiple opportunities efficiently', async () => {
      const opportunities: ArbitrageOpportunity[] = Array.from({ length: 20 }, (_, i) => ({
        id: `batch-opp-${i}`,
        assetId: 'USDC' as AssetID,
        sourceChain: 'ethereum' as ChainID,
        targetChain: 'polygon' as ChainID,
        sourcePrice: 1.0000,
        targetPrice: 0.995 - (i * 0.001), // Varying profitability
        priceDifference: 0.005 + (i * 0.001),
        percentageDifference: 0.5 + (i * 0.1),
        expectedProfit: 500 + (i * 50),
        estimatedGasCost: 50,
        bridgeFee: 25,
        netProfit: 425 + (i * 50),
        profitMargin: 0.85,
        executionTime: 120,
        riskScore: 30 + (i * 2),
        confidence: 0.9 - (i * 0.02),
        timestamp: Date.now(),
        executionPaths: []
      }));

      // Mock validation conditions
      mockChainConnector.getAssetBalance.mockResolvedValue(1000000);
      mockChainConnector.estimateGasCost.mockResolvedValue(45);
      mockPriceFeedManager.getPriceAge.mockResolvedValue(15);

      const startTime = Date.now();
      const results = await validator.validateBatch(opportunities);
      const processingTime = Date.now() - startTime;

      expect(results.length).toBe(20);
      expect(processingTime).toBeLessThan(2000); // Should process in under 2 seconds

      // Verify results vary based on input parameters
      const validResults = results.filter(r => r.isValid);
      const invalidResults = results.filter(r => !r.isValid);

      expect(validResults.length).toBeGreaterThan(0);
      expect(invalidResults.length).toBeGreaterThan(0);
    });

    it('should maintain accuracy metrics across batch validation', async () => {
      const opportunities: ArbitrageOpportunity[] = [
        // High-quality opportunity
        {
          id: 'high-quality',
          assetId: 'USDC' as AssetID,
          sourceChain: 'ethereum' as ChainID,
          targetChain: 'polygon' as ChainID,
          sourcePrice: 1.0000,
          targetPrice: 0.992,
          priceDifference: 0.008,
          percentageDifference: 0.8,
          expectedProfit: 800,
          estimatedGasCost: 40,
          bridgeFee: 20,
          netProfit: 740,
          profitMargin: 0.925,
          executionTime: 100,
          riskScore: 20,
          confidence: 0.95,
          timestamp: Date.now(),
          executionPaths: []
        },
        // Medium-quality opportunity
        {
          id: 'medium-quality',
          assetId: 'USDC' as AssetID,
          sourceChain: 'ethereum' as ChainID,
          targetChain: 'arbitrum' as ChainID,
          sourcePrice: 1.0000,
          targetPrice: 0.996,
          priceDifference: 0.004,
          percentageDifference: 0.4,
          expectedProfit: 400,
          estimatedGasCost: 60,
          bridgeFee: 30,
          netProfit: 310,
          profitMargin: 0.775,
          executionTime: 150,
          riskScore: 45,
          confidence: 0.75,
          timestamp: Date.now() - 20000, // 20 seconds old
          executionPaths: []
        },
        // Low-quality opportunity (should be rejected)
        {
          id: 'low-quality',
          assetId: 'USDC' as AssetID,
          sourceChain: 'ethereum' as ChainID,
          targetChain: 'optimism' as ChainID,
          sourcePrice: 1.0000,
          targetPrice: 0.999,
          priceDifference: 0.001,
          percentageDifference: 0.1,
          expectedProfit: 100,
          estimatedGasCost: 80,
          bridgeFee: 40,
          netProfit: -20, // Negative profit
          profitMargin: -0.2,
          executionTime: 300,
          riskScore: 80,
          confidence: 0.3,
          timestamp: Date.now(),
          executionPaths: []
        }
      ];

      mockChainConnector.getAssetBalance
        .mockResolvedValueOnce(1000000) // High liquidity for first
        .mockResolvedValueOnce(200000)  // Medium liquidity for second
        .mockResolvedValueOnce(50000);  // Low liquidity for third

      mockChainConnector.estimateGasCost.mockResolvedValue(50);
      mockPriceFeedManager.getPriceAge.mockResolvedValue(15);

      const results = await validator.validateBatch(opportunities);
      const stats = validator.getValidationStats(results);

      expect(stats.totalValidated).toBe(3);
      expect(stats.validOpportunities).toBeLessThanOrEqual(2); // At most 2 should be valid
      expect(stats.rejectedOpportunities).toBeGreaterThanOrEqual(1);
      expect(stats.averageRiskScore).toBeGreaterThan(0);
      expect(stats.averageConfidence).toBeGreaterThan(0);
    });
  });

  describe('MEV Protection', () => {
    it('should identify MEV-vulnerable opportunities', async () => {
      const highValueOpportunity: ArbitrageOpportunity = {
        id: 'high-value-mev',
        assetId: 'WETH' as AssetID,
        sourceChain: 'ethereum' as ChainID,
        targetChain: 'arbitrum' as ChainID,
        sourcePrice: 2000.00,
        targetPrice: 1980.00, // $20 difference = 1% profit
        priceDifference: 20.00,
        percentageDifference: 1.0,
        expectedProfit: 5000, // $5k profit - high MEV risk
        estimatedGasCost: 100,
        bridgeFee: 50,
        netProfit: 4850,
        profitMargin: 0.97,
        executionTime: 180,
        riskScore: 40,
        confidence: 0.9,
        timestamp: Date.now(),
        executionPaths: []
      };

      mockChainConnector.getAssetBalance.mockResolvedValue(10000000); // $10M liquidity
      mockChainConnector.estimateGasCost.mockResolvedValue(120);
      mockPriceFeedManager.getPriceAge.mockResolvedValue(10);

      const result = await validator.validateOpportunity(highValueOpportunity);

      // High-value opportunities should have increased risk score due to MEV
      expect(result.riskScore).toBeGreaterThan(60);
      expect(result.mevRisk).toBeDefined();
      expect(result.mevRisk).toBeGreaterThan(0.5);
    });

    it('should apply appropriate MEV protection measures', async () => {
      const opportunity: ArbitrageOpportunity = {
        id: 'mev-protected',
        assetId: 'USDC' as AssetID,
        sourceChain: 'ethereum' as ChainID,
        targetChain: 'polygon' as ChainID,
        sourcePrice: 1.0000,
        targetPrice: 0.988,
        priceDifference: 0.012,
        percentageDifference: 1.2,
        expectedProfit: 1200,
        estimatedGasCost: 75,
        bridgeFee: 35,
        netProfit: 1090,
        profitMargin: 0.908,
        executionTime: 120,
        riskScore: 35,
        confidence: 0.85,
        timestamp: Date.now(),
        executionPaths: []
      };

      mockChainConnector.getAssetBalance.mockResolvedValue(2000000);
      mockChainConnector.estimateGasCost.mockResolvedValue(75);
      mockPriceFeedManager.getPriceAge.mockResolvedValue(8);

      const result = await validator.validateOpportunity(opportunity);

      if (result.mevRisk && result.mevRisk > 0.3) {
        expect(result.recommendedDelayMs).toBeGreaterThan(0);
        expect(result.adjustedProfit).toBeLessThan(opportunity.expectedProfit);
        expect(result.protectionMeasures).toBeDefined();
        expect(result.protectionMeasures.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Gas Estimation Accuracy', () => {
    it('should provide accurate gas estimates with buffer', async () => {
      const opportunity: ArbitrageOpportunity = {
        id: 'gas-test',
        assetId: 'USDC' as AssetID,
        sourceChain: 'ethereum' as ChainID,
        targetChain: 'polygon' as ChainID,
        sourcePrice: 1.0000,
        targetPrice: 0.994,
        priceDifference: 0.006,
        percentageDifference: 0.6,
        expectedProfit: 600,
        estimatedGasCost: 80,
        bridgeFee: 30,
        netProfit: 490,
        profitMargin: 0.817,
        executionTime: 140,
        riskScore: 40,
        confidence: 0.8,
        timestamp: Date.now(),
        executionPaths: []
      };

      // Mock gas estimation with simulation
      mockChainConnector.getAssetBalance.mockResolvedValue(1000000);
      mockChainConnector.estimateGasCost.mockResolvedValue(70); // Base estimate
      mockChainConnector.simulateTransaction.mockResolvedValue({
        success: true,
        gasUsed: 180000,
        gasPrice: 20e9 // 20 gwei
      });
      mockPriceFeedManager.getPriceAge.mockResolvedValue(12);

      const result = await validator.validateOpportunity(opportunity);

      // Verify gas estimation includes buffer
      expect(result.adjustedGasCost).toBeGreaterThan(70); // Should include buffer
      expect(result.adjustedGasCost).toBeLessThan(70 * mockConfig.simulationGasBuffer * 1.1); // But not excessive
      expect(result.gasEstimationAccuracy).toBeGreaterThan(0.8);
    });
  });

  describe('Performance and Stress Testing', () => {
    it('should handle validation under high load', async () => {
      const opportunities: ArbitrageOpportunity[] = Array.from({ length: 100 }, (_, i) => ({
        id: `stress-test-${i}`,
        assetId: 'USDC' as AssetID,
        sourceChain: 'ethereum' as ChainID,
        targetChain: 'polygon' as ChainID,
        sourcePrice: 1.0000,
        targetPrice: 0.995 - (i * 0.0001),
        priceDifference: 0.005 + (i * 0.0001),
        percentageDifference: 0.5 + (i * 0.01),
        expectedProfit: 500 + (i * 10),
        estimatedGasCost: 50 + (i % 20),
        bridgeFee: 25 + (i % 10),
        netProfit: 425 + (i * 8),
        profitMargin: 0.85,
        executionTime: 120 + (i % 60),
        riskScore: 30 + (i % 40),
        confidence: 0.9 - (i * 0.005),
        timestamp: Date.now() - (i * 1000),
        executionPaths: []
      }));

      mockChainConnector.getAssetBalance.mockResolvedValue(1000000);
      mockChainConnector.estimateGasCost.mockResolvedValue(50);
      mockPriceFeedManager.getPriceAge.mockResolvedValue(15);

      const startTime = Date.now();
      const results = await validator.validateBatch(opportunities);
      const processingTime = Date.now() - startTime;

      expect(results.length).toBe(100);
      expect(processingTime).toBeLessThan(5000); // Under 5 seconds for 100 opportunities

      const stats = validator.getValidationStats(results);
      expect(stats.averageProcessingTimeMs).toBeLessThan(100); // Under 100ms per opportunity
    });

    it('should maintain consistency across repeated validations', async () => {
      const opportunity: ArbitrageOpportunity = {
        id: 'consistency-test',
        assetId: 'USDC' as AssetID,
        sourceChain: 'ethereum' as ChainID,
        targetChain: 'polygon' as ChainID,
        sourcePrice: 1.0000,
        targetPrice: 0.995,
        priceDifference: 0.005,
        percentageDifference: 0.5,
        expectedProfit: 500,
        estimatedGasCost: 50,
        bridgeFee: 25,
        netProfit: 425,
        profitMargin: 0.85,
        executionTime: 120,
        riskScore: 30,
        confidence: 0.9,
        timestamp: Date.now(),
        executionPaths: []
      };

      // Mock consistent conditions
      mockChainConnector.getAssetBalance.mockResolvedValue(1000000);
      mockChainConnector.estimateGasCost.mockResolvedValue(50);
      mockPriceFeedManager.getPriceAge.mockResolvedValue(15);

      const results = [];
      for (let i = 0; i < 10; i++) {
        const result = await validator.validateOpportunity(opportunity);
        results.push(result);
      }

      // All results should be consistent
      const validResults = results.filter(r => r.isValid);
      expect(validResults.length).toBe(results.length); // All should be valid or all invalid

      // Verify consistency in calculated values
      const adjustedProfits = results.map(r => r.adjustedProfit);
      const avgAdjustedProfit = adjustedProfits.reduce((a, b) => a + b, 0) / adjustedProfits.length;
      
      for (const profit of adjustedProfits) {
        expect(Math.abs(profit - avgAdjustedProfit)).toBeLessThan(10); // Within $10 variance
      }
    });
  });
});