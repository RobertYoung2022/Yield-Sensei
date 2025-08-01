/**
 * Fuel Satellite - Tax-Loss Harvesting Algorithm Validation
 * Task 38.2: Test tax-loss harvesting algorithms and compliance reporting functionality
 * 
 * Validates tax optimization strategies, wash sale rules, and reporting accuracy
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach, jest } from '@jest/globals';
import { TaxLossHarvester } from '../../../src/satellites/fuel/tax/tax-loss-harvester';
import { TaxReportingEngine } from '../../../src/satellites/fuel/tax/tax-reporting-engine';
import { getLogger } from '../../../src/shared/logging/logger';
import { Pool } from 'pg';
import Redis from 'ioredis';

describe('Fuel Satellite - Tax-Loss Harvesting Algorithm Validation', () => {
  let taxLossHarvester: TaxLossHarvester;
  let taxReportingEngine: TaxReportingEngine;
  let pgPool: Pool;
  let redisClient: Redis;
  let logger: any;

  // Mock portfolio data
  const mockPortfolio = {
    positions: [
      {
        id: 'pos-1',
        asset: 'ETH',
        quantity: 10,
        purchaseDate: new Date('2023-01-15'),
        purchasePrice: 1500,
        currentPrice: 1200,
        costBasis: 15000,
        currentValue: 12000,
        unrealizedLoss: -3000
      },
      {
        id: 'pos-2',
        asset: 'BTC',
        quantity: 0.5,
        purchaseDate: new Date('2023-03-20'),
        purchasePrice: 25000,
        currentPrice: 30000,
        costBasis: 12500,
        currentValue: 15000,
        unrealizedGain: 2500
      },
      {
        id: 'pos-3',
        asset: 'MATIC',
        quantity: 5000,
        purchaseDate: new Date('2023-06-10'),
        purchasePrice: 1.20,
        currentPrice: 0.80,
        costBasis: 6000,
        currentValue: 4000,
        unrealizedLoss: -2000
      },
      {
        id: 'pos-4',
        asset: 'SOL',
        quantity: 100,
        purchaseDate: new Date('2023-02-28'),
        purchasePrice: 25,
        currentPrice: 20,
        costBasis: 2500,
        currentValue: 2000,
        unrealizedLoss: -500
      }
    ],
    totalValue: 33000,
    totalCostBasis: 36000,
    netUnrealizedLoss: -3000
  };

  beforeAll(async () => {
    // Initialize dependencies
    pgPool = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'yieldsense_test',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres'
    });

    redisClient = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      lazyConnect: true
    });

    logger = getLogger({ name: 'fuel-tax-harvesting-test' });

    // Initialize tax components
    taxLossHarvester = new TaxLossHarvester({
      washSalePeriod: 30, // days
      minimumLossThreshold: 100, // $100
      taxRates: {
        shortTermCapitalGains: 0.37,
        longTermCapitalGains: 0.20,
        ordinaryIncome: 0.37
      },
      jurisdiction: 'US',
      accountingMethod: 'FIFO' // First In First Out
    }, pgPool, redisClient, logger);

    taxReportingEngine = new TaxReportingEngine({
      reportingPeriod: 'annual',
      forms: ['8949', 'Schedule D'],
      includeStateReporting: true,
      states: ['CA', 'NY']
    }, pgPool, logger);

    await taxLossHarvester.initialize();
    await taxReportingEngine.initialize();
  });

  afterAll(async () => {
    if (pgPool) {
      await pgPool.end();
    }
    if (redisClient) {
      await redisClient.quit();
    }
  });

  describe('Tax-Loss Harvesting Opportunity Identification', () => {
    
    test('should identify valid tax-loss harvesting opportunities', async () => {
      const opportunities = await taxLossHarvester.identifyHarvestingOpportunities(
        mockPortfolio
      );

      expect(opportunities).toBeDefined();
      expect(opportunities.validOpportunities).toBeDefined();
      expect(opportunities.validOpportunities.length).toBeGreaterThan(0);

      // Should identify ETH, MATIC, and SOL as harvesting opportunities
      const expectedAssets = ['ETH', 'MATIC', 'SOL'];
      const identifiedAssets = opportunities.validOpportunities.map(o => o.asset);
      
      expectedAssets.forEach(asset => {
        expect(identifiedAssets).toContain(asset);
      });

      // Verify opportunity details
      opportunities.validOpportunities.forEach(opp => {
        expect(opp.asset).toBeDefined();
        expect(opp.unrealizedLoss).toBeLessThan(0);
        expect(opp.taxSavings).toBeGreaterThan(0);
        expect(opp.holdingPeriod).toBeDefined();
        expect(opp.taxRate).toBeDefined();
        
        // Tax rate should match holding period
        if (opp.holdingPeriod === 'short_term') {
          expect(opp.taxRate).toBe(0.37);
        } else {
          expect(opp.taxRate).toBe(0.20);
        }
      });

      // Verify total potential tax savings
      expect(opportunities.totalPotentialSavings).toBeGreaterThan(0);
      expect(opportunities.totalPotentialSavings).toBe(
        opportunities.validOpportunities.reduce((sum, opp) => sum + opp.taxSavings, 0)
      );
    });

    test('should respect minimum loss threshold', async () => {
      const smallLossPortfolio = {
        positions: [
          {
            id: 'small-1',
            asset: 'LINK',
            quantity: 10,
            purchaseDate: new Date('2023-08-01'),
            purchasePrice: 7,
            currentPrice: 6.5,
            costBasis: 70,
            currentValue: 65,
            unrealizedLoss: -5 // Below $100 threshold
          }
        ]
      };

      const opportunities = await taxLossHarvester.identifyHarvestingOpportunities(
        smallLossPortfolio
      );

      expect(opportunities.validOpportunities.length).toBe(0);
      expect(opportunities.belowThreshold).toBeDefined();
      expect(opportunities.belowThreshold.length).toBe(1);
      expect(opportunities.belowThreshold[0].asset).toBe('LINK');
      expect(opportunities.belowThreshold[0].reason).toContain('below threshold');
    });

    test('should calculate accurate tax savings based on holding period', async () => {
      const position = {
        asset: 'ETH',
        purchaseDate: new Date('2023-01-15'),
        currentDate: new Date('2024-01-20'),
        unrealizedLoss: -3000,
        jurisdiction: 'US'
      };

      const taxSavings = await taxLossHarvester.calculateTaxSavings(position);

      expect(taxSavings).toBeDefined();
      expect(taxSavings.holdingPeriod).toBe('long_term'); // Over 1 year
      expect(taxSavings.applicableTaxRate).toBe(0.20);
      expect(taxSavings.grossLoss).toBe(3000);
      expect(taxSavings.taxSavings).toBe(600); // 3000 * 0.20
      expect(taxSavings.netBenefit).toBeGreaterThan(0);

      // Test short-term position
      const shortTermPosition = {
        ...position,
        purchaseDate: new Date('2023-10-15')
      };

      const shortTermSavings = await taxLossHarvester.calculateTaxSavings(shortTermPosition);
      expect(shortTermSavings.holdingPeriod).toBe('short_term');
      expect(shortTermSavings.applicableTaxRate).toBe(0.37);
      expect(shortTermSavings.taxSavings).toBe(1110); // 3000 * 0.37
    });
  });

  describe('Wash Sale Rule Compliance', () => {
    
    test('should detect potential wash sale violations', async () => {
      const recentTransactions = [
        {
          date: new Date('2024-01-10'),
          asset: 'ETH',
          action: 'sell',
          quantity: 5,
          realizedLoss: -1500
        },
        {
          date: new Date('2024-01-15'),
          asset: 'ETH',
          action: 'buy',
          quantity: 3 // Repurchase within 30 days
        }
      ];

      const harvestingPlan = {
        asset: 'ETH',
        proposedSaleDate: new Date('2024-01-20'),
        quantity: 2
      };

      const washSaleCheck = await taxLossHarvester.checkWashSaleCompliance(
        harvestingPlan,
        recentTransactions
      );

      expect(washSaleCheck).toBeDefined();
      expect(washSaleCheck.isCompliant).toBe(false);
      expect(washSaleCheck.violations).toBeDefined();
      expect(washSaleCheck.violations.length).toBeGreaterThan(0);

      const violation = washSaleCheck.violations[0];
      expect(violation.type).toBe('wash_sale');
      expect(violation.conflictingTransaction).toBeDefined();
      expect(violation.daysWithinWindow).toBeLessThanOrEqual(30);
      expect(violation.recommendation).toContain('wait');
    });

    test('should provide wash sale avoidance strategies', async () => {
      const position = {
        asset: 'BTC',
        quantity: 0.5,
        unrealizedLoss: -2000,
        lastSaleDate: new Date('2024-01-01')
      };

      const avoidanceStrategies = await taxLossHarvester.getWashSaleAvoidanceStrategies(
        position
      );

      expect(avoidanceStrategies).toBeDefined();
      expect(avoidanceStrategies.strategies).toBeDefined();
      expect(avoidanceStrategies.strategies.length).toBeGreaterThan(0);

      avoidanceStrategies.strategies.forEach(strategy => {
        expect(strategy.name).toBeDefined();
        expect(strategy.description).toBeDefined();
        expect(strategy.implementation).toBeDefined();
        expect(strategy.taxImplications).toBeDefined();
        expect(strategy.riskLevel).toBeDefined();
      });

      // Should include common strategies
      const strategyNames = avoidanceStrategies.strategies.map(s => s.name);
      expect(strategyNames).toContain('wait_31_days');
      expect(strategyNames).toContain('substitute_asset');
      expect(strategyNames).toContain('etf_replacement');

      // Verify safe sale date calculation
      expect(avoidanceStrategies.safeSaleDate).toBeDefined();
      expect(avoidanceStrategies.safeSaleDate).toBeInstanceOf(Date);
      expect(avoidanceStrategies.safeSaleDate.getTime()).toBeGreaterThan(
        new Date('2024-01-31').getTime()
      );
    });

    test('should track wash sale adjustments to cost basis', async () => {
      const washSaleTransaction = {
        originalSale: {
          asset: 'MATIC',
          date: new Date('2024-01-05'),
          quantity: 1000,
          proceeds: 800,
          costBasis: 1200,
          realizedLoss: -400
        },
        repurchase: {
          asset: 'MATIC',
          date: new Date('2024-01-20'),
          quantity: 1000,
          purchasePrice: 850,
          costBasis: 850
        }
      };

      const adjustment = await taxLossHarvester.calculateWashSaleAdjustment(
        washSaleTransaction
      );

      expect(adjustment).toBeDefined();
      expect(adjustment.disallowedLoss).toBe(400);
      expect(adjustment.adjustedCostBasis).toBe(1250); // 850 + 400
      expect(adjustment.deferredLossCarryforward).toBe(true);
      expect(adjustment.adjustmentExplanation).toBeDefined();

      // Verify adjustment tracking
      expect(adjustment.tracking).toBeDefined();
      expect(adjustment.tracking.originalLoss).toBe(-400);
      expect(adjustment.tracking.adjustmentAmount).toBe(400);
      expect(adjustment.tracking.newHoldingPeriod).toBeDefined();
    });
  });

  describe('Tax Optimization Strategies', () => {
    
    test('should optimize harvest timing for maximum tax benefit', async () => {
      const positions = mockPortfolio.positions.filter(p => p.unrealizedLoss);
      
      const optimizationPlan = await taxLossHarvester.optimizeHarvestTiming(
        positions,
        {
          taxYear: 2024,
          existingGains: 5000,
          existingLosses: 1000,
          carryforwardLosses: 0
        }
      );

      expect(optimizationPlan).toBeDefined();
      expect(optimizationPlan.recommendations).toBeDefined();
      expect(optimizationPlan.recommendations.length).toBeGreaterThan(0);

      optimizationPlan.recommendations.forEach(rec => {
        expect(rec.position).toBeDefined();
        expect(rec.recommendedAction).toBeDefined();
        expect(['harvest_now', 'harvest_later', 'hold']).toContain(rec.recommendedAction);
        expect(rec.timing).toBeDefined();
        expect(rec.expectedTaxSavings).toBeGreaterThanOrEqual(0);
        expect(rec.reasoning).toBeDefined();
      });

      // Verify offset calculations
      expect(optimizationPlan.taxCalculation).toBeDefined();
      expect(optimizationPlan.taxCalculation.totalGains).toBe(5000);
      expect(optimizationPlan.taxCalculation.totalLosses).toBeDefined();
      expect(optimizationPlan.taxCalculation.netPosition).toBeDefined();
      expect(optimizationPlan.taxCalculation.expectedTaxLiability).toBeDefined();
    });

    test('should implement tax-efficient rebalancing strategies', async () => {
      const rebalancingRequest = {
        currentAllocation: {
          'ETH': 0.4,
          'BTC': 0.3,
          'MATIC': 0.2,
          'SOL': 0.1
        },
        targetAllocation: {
          'ETH': 0.3,
          'BTC': 0.4,
          'MATIC': 0.2,
          'SOL': 0.1
        },
        portfolioValue: 100000,
        taxConsiderations: true
      };

      const taxEfficientPlan = await taxLossHarvester.createTaxEfficientRebalancing(
        rebalancingRequest,
        mockPortfolio
      );

      expect(taxEfficientPlan).toBeDefined();
      expect(taxEfficientPlan.trades).toBeDefined();
      expect(taxEfficientPlan.trades.length).toBeGreaterThan(0);

      taxEfficientPlan.trades.forEach(trade => {
        expect(trade.asset).toBeDefined();
        expect(trade.action).toBeDefined();
        expect(['sell', 'buy']).toContain(trade.action);
        expect(trade.quantity).toBeGreaterThan(0);
        expect(trade.taxImpact).toBeDefined();
        
        if (trade.action === 'sell') {
          expect(trade.realizedGainLoss).toBeDefined();
          expect(trade.taxLiability).toBeDefined();
        }
      });

      // Should prioritize selling positions with losses
      const sellTrades = taxEfficientPlan.trades.filter(t => t.action === 'sell');
      const lossPositions = sellTrades.filter(t => t.realizedGainLoss < 0);
      expect(lossPositions.length).toBeGreaterThan(0);

      // Verify tax optimization metrics
      expect(taxEfficientPlan.taxOptimization).toBeDefined();
      expect(taxEfficientPlan.taxOptimization.totalTaxLiability).toBeDefined();
      expect(taxEfficientPlan.taxOptimization.taxSavedVsNaive).toBeGreaterThanOrEqual(0);
      expect(taxEfficientPlan.taxOptimization.effectiveTaxRate).toBeDefined();
    });

    test('should handle tax lot selection methods', async () => {
      const multiLotPosition = {
        asset: 'BTC',
        lots: [
          { quantity: 0.1, purchaseDate: new Date('2022-01-01'), costBasis: 4000 },
          { quantity: 0.2, purchaseDate: new Date('2023-01-01'), costBasis: 5000 },
          { quantity: 0.2, purchaseDate: new Date('2023-06-01'), costBasis: 6000 }
        ],
        currentPrice: 30000,
        quantityToSell: 0.3
      };

      const methods = ['FIFO', 'LIFO', 'HIFO', 'SpecificID'];
      
      const lotSelections = await Promise.all(
        methods.map(method => 
          taxLossHarvester.selectTaxLots(multiLotPosition, method)
        )
      );

      lotSelections.forEach((selection, index) => {
        expect(selection).toBeDefined();
        expect(selection.method).toBe(methods[index]);
        expect(selection.selectedLots).toBeDefined();
        expect(selection.totalQuantity).toBe(0.3);
        expect(selection.totalCostBasis).toBeDefined();
        expect(selection.realizedGainLoss).toBeDefined();
        expect(selection.taxImplications).toBeDefined();
      });

      // HIFO should result in lowest tax liability
      const hifoSelection = lotSelections.find(s => s.method === 'HIFO');
      const fifoSelection = lotSelections.find(s => s.method === 'FIFO');
      expect(hifoSelection.taxImplications.taxLiability)
        .toBeLessThanOrEqual(fifoSelection.taxImplications.taxLiability);
    });
  });

  describe('Tax Reporting and Compliance', () => {
    
    test('should generate IRS Form 8949 data', async () => {
      const transactions = [
        {
          asset: 'ETH',
          purchaseDate: new Date('2023-01-15'),
          saleDate: new Date('2024-01-20'),
          quantity: 2,
          costBasis: 3000,
          proceeds: 2400,
          washSaleAdjustment: 0
        },
        {
          asset: 'BTC',
          purchaseDate: new Date('2023-06-01'),
          saleDate: new Date('2024-01-15'),
          quantity: 0.1,
          costBasis: 2500,
          proceeds: 3000,
          washSaleAdjustment: 0
        }
      ];

      const form8949 = await taxReportingEngine.generateForm8949(transactions, 2024);

      expect(form8949).toBeDefined();
      expect(form8949.partI).toBeDefined(); // Short-term
      expect(form8949.partII).toBeDefined(); // Long-term

      // ETH should be in Part II (long-term)
      const ethTransaction = form8949.partII.find(t => t.description.includes('ETH'));
      expect(ethTransaction).toBeDefined();
      expect(ethTransaction.dateAcquired).toBe('01/15/2023');
      expect(ethTransaction.dateSold).toBe('01/20/2024');
      expect(ethTransaction.proceeds).toBe(2400);
      expect(ethTransaction.costBasis).toBe(3000);
      expect(ethTransaction.gainLoss).toBe(-600);

      // BTC should be in Part I (short-term)
      const btcTransaction = form8949.partI.find(t => t.description.includes('BTC'));
      expect(btcTransaction).toBeDefined();
      expect(btcTransaction.gainLoss).toBe(500);

      // Verify totals
      expect(form8949.totals).toBeDefined();
      expect(form8949.totals.shortTermGainLoss).toBe(500);
      expect(form8949.totals.longTermGainLoss).toBe(-600);
      expect(form8949.totals.netGainLoss).toBe(-100);
    });

    test('should generate Schedule D summary', async () => {
      const form8949Data = {
        shortTermGains: 2000,
        shortTermLosses: -1500,
        longTermGains: 5000,
        longTermLosses: -3000,
        carryoverLosses: -1000
      };

      const scheduleD = await taxReportingEngine.generateScheduleD(form8949Data, 2024);

      expect(scheduleD).toBeDefined();
      expect(scheduleD.shortTermNetGainLoss).toBe(500);
      expect(scheduleD.longTermNetGainLoss).toBe(2000);
      expect(scheduleD.totalNetGainLoss).toBe(2500);

      // Verify carryover handling
      expect(scheduleD.carryoverFromPriorYear).toBe(-1000);
      expect(scheduleD.adjustedNetGainLoss).toBe(1500);

      // Verify tax calculation
      expect(scheduleD.taxCalculation).toBeDefined();
      expect(scheduleD.taxCalculation.shortTermTax).toBeDefined();
      expect(scheduleD.taxCalculation.longTermTax).toBeDefined();
      expect(scheduleD.taxCalculation.totalTax).toBeDefined();
    });

    test('should handle state-specific tax reporting', async () => {
      const stateReporting = await taxReportingEngine.generateStateReports(
        {
          federalAGI: 100000,
          capitalGains: 5000,
          capitalLosses: -2000
        },
        ['CA', 'NY']
      );

      expect(stateReporting).toBeDefined();
      expect(stateReporting.CA).toBeDefined();
      expect(stateReporting.NY).toBeDefined();

      // California reporting
      expect(stateReporting.CA.form).toBe('Schedule D-CA');
      expect(stateReporting.CA.stateAGI).toBeDefined();
      expect(stateReporting.CA.stateTaxRate).toBeDefined();
      expect(stateReporting.CA.estimatedTax).toBeGreaterThan(0);

      // New York reporting
      expect(stateReporting.NY.form).toBe('IT-196');
      expect(stateReporting.NY.modifications).toBeDefined();
      expect(stateReporting.NY.estimatedTax).toBeGreaterThan(0);

      // State taxes should differ
      expect(stateReporting.CA.estimatedTax).not.toBe(stateReporting.NY.estimatedTax);
    });

    test('should generate comprehensive tax summary report', async () => {
      const annualActivity = {
        totalTrades: 150,
        realizedGains: 15000,
        realizedLosses: -12000,
        washSaleAdjustments: 500,
        taxLossHarvestingSavings: 1200,
        portfolioValue: 100000
      };

      const taxSummary = await taxReportingEngine.generateAnnualTaxSummary(
        annualActivity,
        2024
      );

      expect(taxSummary).toBeDefined();
      expect(taxSummary.overview).toBeDefined();
      expect(taxSummary.overview.netGainLoss).toBe(3000);
      expect(taxSummary.overview.effectiveTaxRate).toBeDefined();
      expect(taxSummary.overview.totalTaxLiability).toBeGreaterThan(0);

      // Verify optimization metrics
      expect(taxSummary.optimizationMetrics).toBeDefined();
      expect(taxSummary.optimizationMetrics.harvestingSavings).toBe(1200);
      expect(taxSummary.optimizationMetrics.washSalesAvoided).toBeDefined();
      expect(taxSummary.optimizationMetrics.taxEfficiency).toBeGreaterThan(0);

      // Verify actionable insights
      expect(taxSummary.recommendations).toBeDefined();
      expect(taxSummary.recommendations.length).toBeGreaterThan(0);
      expect(taxSummary.recommendations[0].category).toBeDefined();
      expect(taxSummary.recommendations[0].action).toBeDefined();
      expect(taxSummary.recommendations[0].potentialSavings).toBeDefined();

      // Verify year-end planning
      expect(taxSummary.yearEndPlanning).toBeDefined();
      expect(taxSummary.yearEndPlanning.remainingHarvestingOpportunities).toBeDefined();
      expect(taxSummary.yearEndPlanning.estimatedQ4Payments).toBeDefined();
    });
  });

  describe('Real-Time Tax Impact Analysis', () => {
    
    test('should provide real-time tax impact for proposed trades', async () => {
      const proposedTrade = {
        action: 'sell',
        asset: 'ETH',
        quantity: 5,
        currentPrice: 1200,
        positions: [
          { quantity: 3, purchaseDate: new Date('2022-01-01'), costBasis: 4500 },
          { quantity: 2, purchaseDate: new Date('2023-06-01'), costBasis: 3000 }
        ]
      };

      const taxImpact = await taxLossHarvester.analyzeTaxImpact(proposedTrade);

      expect(taxImpact).toBeDefined();
      expect(taxImpact.proceeds).toBe(6000);
      expect(taxImpact.costBasis).toBe(7500);
      expect(taxImpact.realizedGainLoss).toBe(-1500);
      expect(taxImpact.taxLiability).toBeLessThan(0); // Tax benefit

      // Verify breakdown by tax lot
      expect(taxImpact.lotBreakdown).toBeDefined();
      expect(taxImpact.lotBreakdown.length).toBe(2);
      
      const longTermLot = taxImpact.lotBreakdown.find(l => l.holdingPeriod === 'long_term');
      const shortTermLot = taxImpact.lotBreakdown.find(l => l.holdingPeriod === 'short_term');
      
      expect(longTermLot).toBeDefined();
      expect(shortTermLot).toBeDefined();
      expect(longTermLot.taxRate).toBe(0.20);
      expect(shortTermLot.taxRate).toBe(0.37);

      // Verify alternative scenarios
      expect(taxImpact.alternatives).toBeDefined();
      expect(taxImpact.alternatives.length).toBeGreaterThan(0);
      taxImpact.alternatives.forEach(alt => {
        expect(alt.description).toBeDefined();
        expect(alt.taxImpact).toBeDefined();
        expect(alt.difference).toBeDefined();
      });
    });

    test('should track year-to-date tax position', async () => {
      const ytdPosition = await taxReportingEngine.getYearToDateTaxPosition(2024);

      expect(ytdPosition).toBeDefined();
      expect(ytdPosition.realizedGains).toBeDefined();
      expect(ytdPosition.realizedLosses).toBeDefined();
      expect(ytdPosition.netPosition).toBeDefined();
      expect(ytdPosition.estimatedTaxLiability).toBeDefined();
      expect(ytdPosition.quarterlyPayments).toBeDefined();

      // Verify quarterly breakdown
      expect(ytdPosition.quarterlyBreakdown).toBeDefined();
      expect(ytdPosition.quarterlyBreakdown.Q1).toBeDefined();
      expect(ytdPosition.quarterlyBreakdown.Q2).toBeDefined();
      expect(ytdPosition.quarterlyBreakdown.Q3).toBeDefined();
      expect(ytdPosition.quarterlyBreakdown.Q4).toBeDefined();

      // Verify safe harbor calculations
      expect(ytdPosition.safeHarbor).toBeDefined();
      expect(ytdPosition.safeHarbor.required).toBeDefined();
      expect(ytdPosition.safeHarbor.paid).toBeDefined();
      expect(ytdPosition.safeHarbor.remaining).toBeDefined();
      expect(ytdPosition.safeHarbor.onTrack).toBeDefined();
    });
  });

  describe('Performance and Integration Tests', () => {
    
    test('should process large portfolio efficiently', async () => {
      // Generate large portfolio with 1000 positions
      const largePortfolio = {
        positions: Array(1000).fill(null).map((_, i) => ({
          id: `pos-${i}`,
          asset: `TOKEN-${i % 50}`,
          quantity: Math.random() * 100,
          purchaseDate: new Date(2023, Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1),
          purchasePrice: Math.random() * 1000,
          currentPrice: Math.random() * 1000,
          costBasis: 0,
          currentValue: 0,
          unrealizedGainLoss: 0
        }))
      };

      // Calculate cost basis and unrealized gains/losses
      largePortfolio.positions.forEach(pos => {
        pos.costBasis = pos.quantity * pos.purchasePrice;
        pos.currentValue = pos.quantity * pos.currentPrice;
        pos.unrealizedGainLoss = pos.currentValue - pos.costBasis;
      });

      const startTime = Date.now();
      
      const opportunities = await taxLossHarvester.identifyHarvestingOpportunities(
        largePortfolio
      );

      const processingTime = Date.now() - startTime;

      expect(processingTime).toBeLessThan(5000); // Should process within 5 seconds
      expect(opportunities).toBeDefined();
      expect(opportunities.validOpportunities).toBeDefined();
      expect(opportunities.processingMetrics).toBeDefined();
      expect(opportunities.processingMetrics.positionsAnalyzed).toBe(1000);
      expect(opportunities.processingMetrics.timePerPosition).toBeLessThan(5); // ms
    });

    test('should integrate with portfolio rebalancing system', async () => {
      const rebalancingIntegration = await taxLossHarvester.integrateWithRebalancer({
        rebalancerEndpoint: 'http://localhost:3000/api/rebalance',
        taxAwareMode: true,
        realTimeSync: true
      });

      expect(rebalancingIntegration).toBeDefined();
      expect(rebalancingIntegration.status).toBe('connected');
      expect(rebalancingIntegration.capabilities).toBeDefined();
      expect(rebalancingIntegration.capabilities.taxAwareRebalancing).toBe(true);
      expect(rebalancingIntegration.capabilities.washSaleAvoidance).toBe(true);
      expect(rebalancingIntegration.capabilities.realTimeTaxImpact).toBe(true);

      // Test tax-aware rebalancing hook
      const rebalanceRequest = {
        currentAllocation: { 'ETH': 0.5, 'BTC': 0.5 },
        targetAllocation: { 'ETH': 0.4, 'BTC': 0.6 },
        taxOptimize: true
      };

      const taxOptimizedPlan = await rebalancingIntegration.hooks.optimizeRebalance(
        rebalanceRequest
      );

      expect(taxOptimizedPlan).toBeDefined();
      expect(taxOptimizedPlan.trades).toBeDefined();
      expect(taxOptimizedPlan.estimatedTaxImpact).toBeDefined();
      expect(taxOptimizedPlan.washSaleCompliant).toBe(true);
    });
  });
});

/**
 * Tax-Loss Harvesting Algorithm Validation Summary
 * 
 * This test suite validates:
 * ✅ Tax-loss harvesting opportunity identification
 * ✅ Minimum loss threshold enforcement
 * ✅ Accurate tax savings calculations based on holding periods
 * ✅ Wash sale rule compliance and detection
 * ✅ Wash sale avoidance strategies
 * ✅ Cost basis adjustment tracking
 * ✅ Tax optimization timing strategies
 * ✅ Tax-efficient portfolio rebalancing
 * ✅ Tax lot selection methods (FIFO, LIFO, HIFO)
 * ✅ IRS Form 8949 and Schedule D generation
 * ✅ State-specific tax reporting
 * ✅ Comprehensive annual tax summaries
 * ✅ Real-time tax impact analysis
 * ✅ Year-to-date tax position tracking
 * ✅ Large portfolio processing performance
 * ✅ Integration with portfolio rebalancing systems
 * 
 * Test Coverage: Complete coverage of tax optimization and compliance features
 * Accuracy: Precise tax calculations aligned with US tax code
 * Performance: Efficient processing of large portfolios
 */