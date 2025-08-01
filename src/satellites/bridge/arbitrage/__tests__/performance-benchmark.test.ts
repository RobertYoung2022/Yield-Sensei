/**
 * Arbitrage Detection Performance Benchmark Suite
 * Comprehensive performance testing and benchmarking
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { CrossChainArbitrageEngine } from '../cross-chain-arbitrage-engine';
import { OpportunityValidator } from '../opportunity-validator';
import { HistoricalAnalyzer } from '../historical-analyzer';
import { AssetMapperService } from '../asset-mapper';
import { BridgeSatelliteConfig } from '../../bridge-satellite';
import { ArbitrageOpportunity, ChainID, AssetID } from '../../types';

// Performance tracking
interface PerformanceMetrics {
  detectionLatency: number[];
  validationLatency: number[];
  throughputOpsPerSecond: number[];
  memoryUsage: number[];
  cpuUtilization: number[];
  errorRate: number;
  successRate: number;
  totalOperations: number;
}

describe('Arbitrage Detection Performance Benchmarks', () => {
  let engine: CrossChainArbitrageEngine;
  let validator: OpportunityValidator;
  let historicalAnalyzer: HistoricalAnalyzer;
  let assetMapper: AssetMapperService;
  let mockConfig: BridgeSatelliteConfig;
  let performanceMetrics: PerformanceMetrics;

  beforeEach(() => {
    performanceMetrics = {
      detectionLatency: [],
      validationLatency: [],
      throughputOpsPerSecond: [],
      memoryUsage: [],
      cpuUtilization: [],
      errorRate: 0,
      successRate: 0,
      totalOperations: 0
    };

    mockConfig = {
      chains: [
        { id: 'ethereum' as ChainID, name: 'Ethereum', rpcUrl: 'mock-rpc', gasToken: 'ETH' },
        { id: 'polygon' as ChainID, name: 'Polygon', rpcUrl: 'mock-rpc', gasToken: 'MATIC' },
        { id: 'arbitrum' as ChainID, name: 'Arbitrum', rpcUrl: 'mock-rpc', gasToken: 'ETH' },
        { id: 'optimism' as ChainID, name: 'Optimism', rpcUrl: 'mock-rpc', gasToken: 'ETH' },
        { id: 'avalanche' as ChainID, name: 'Avalanche', rpcUrl: 'mock-rpc', gasToken: 'AVAX' },
        { id: 'bsc' as ChainID, name: 'BNB Chain', rpcUrl: 'mock-rpc', gasToken: 'BNB' },
        { id: 'fantom' as ChainID, name: 'Fantom', rpcUrl: 'mock-rpc', gasToken: 'FTM' },
        { id: 'base' as ChainID, name: 'Base', rpcUrl: 'mock-rpc', gasToken: 'ETH' }
      ],
      bridges: [
        { id: 'stargate', name: 'Stargate', chains: ['ethereum', 'polygon', 'arbitrum', 'optimism', 'avalanche'], fees: { base: 0.001, variable: 0.0005 } },
        { id: 'across', name: 'Across', chains: ['ethereum', 'optimism', 'arbitrum', 'base'], fees: { base: 0.0008, variable: 0.0003 } },
        { id: 'hop', name: 'Hop Protocol', chains: ['ethereum', 'polygon', 'arbitrum', 'optimism'], fees: { base: 0.0012, variable: 0.0006 } },
        { id: 'synapse', name: 'Synapse', chains: ['ethereum', 'avalanche', 'bsc', 'fantom'], fees: { base: 0.0015, variable: 0.0008 } }
      ],
      arbitrage: {
        minProfitThreshold: 0.001,
        maxRiskScore: 70,
        maxExecutionTime: 300,
        enabledChains: ['ethereum', 'polygon', 'arbitrum', 'optimism', 'avalanche', 'bsc', 'fantom', 'base']
      },
      risk: {
        updateInterval: 60000,
        alertThresholds: { safetyScore: 80, liquidityScore: 70, reliabilityScore: 85 }
      },
      liquidity: {
        rebalanceThreshold: 0.1,
        minUtilization: 0.1,
        maxUtilization: 0.8,
        targetDistribution: {
          ethereum: 0.3, polygon: 0.15, arbitrum: 0.15, optimism: 0.1,
          avalanche: 0.1, bsc: 0.1, fantom: 0.05, base: 0.05
        }
      },
      monitoring: {
        updateInterval: 30000,
        alertRetention: 86400000,
        performanceWindow: 3600000
      },
      validation: {
        maxSlippageTolerance: 0.02,
        minLiquidityUSD: 100000,
        maxPriceAge: 30,
        mevProtectionThreshold: 100,
        simulationGasBuffer: 1.2
      }
    };

    engine = new CrossChainArbitrageEngine(mockConfig);
    validator = new OpportunityValidator(
      engine['chainConnector'],
      engine['priceFeedManager'],
      mockConfig.validation
    );
    historicalAnalyzer = new HistoricalAnalyzer();
    assetMapper = new AssetMapperService();
  });

  describe('Latency Benchmarks', () => {
    it('should maintain <1s latency for opportunity detection across 8 chains', async () => {
      const testAssets = ['USDC', 'USDT', 'DAI', 'WETH', 'WBTC'];
      const chains = mockConfig.chains;
      
      for (let iteration = 0; iteration < 50; iteration++) {
        const mockPriceData: Record<string, number> = {};
        
        // Generate realistic price data with variations
        for (const asset of testAssets) {
          const basePrice = asset === 'WETH' ? 2000 : asset === 'WBTC' ? 40000 : 1;
          
          for (const chain of chains) {
            const variation = (Math.random() - 0.5) * 0.02; // ±1% variation
            mockPriceData[`${asset}-${chain.id}`] = basePrice * (1 + variation);
          }
        }

        engine['priceFeedManager'].getPrices = jest.fn().mockResolvedValue(mockPriceData);
        engine['chainConnector'].getAssetBalance = jest.fn().mockResolvedValue(1000000);

        const startTime = performance.now();
        const opportunities = await engine.detectOpportunities();
        const endTime = performance.now();
        
        const latency = endTime - startTime;
        performanceMetrics.detectionLatency.push(latency);
        performanceMetrics.totalOperations++;

        expect(latency).toBeLessThan(1000); // <1s requirement
      }

      const avgLatency = performanceMetrics.detectionLatency.reduce((a, b) => a + b, 0) / performanceMetrics.detectionLatency.length;
      const maxLatency = Math.max(...performanceMetrics.detectionLatency);
      const p95Latency = performanceMetrics.detectionLatency.sort((a, b) => a - b)[Math.floor(performanceMetrics.detectionLatency.length * 0.95)];

      console.log(`Detection Latency Metrics (8 chains, 5 assets):
        Average: ${avgLatency.toFixed(2)}ms
        Maximum: ${maxLatency.toFixed(2)}ms
        95th percentile: ${p95Latency.toFixed(2)}ms`);

      expect(avgLatency).toBeLessThan(500); // Target: <500ms average
      expect(p95Latency).toBeLessThan(800); // Target: <800ms 95th percentile
    });

    it('should maintain <100ms validation latency per opportunity', async () => {
      const opportunities: ArbitrageOpportunity[] = Array.from({ length: 100 }, (_, i) => ({
        id: `perf-test-${i}`,
        assetId: 'USDC' as AssetID,
        sourceChain: 'ethereum' as ChainID,
        targetChain: 'polygon' as ChainID,
        sourcePrice: 1.0000,
        targetPrice: 0.995 - (i * 0.0001),
        priceDifference: 0.005 + (i * 0.0001),
        percentageDifference: 0.5 + (i * 0.01),
        expectedProfit: 500 + (i * 10),
        estimatedGasCost: 50,
        bridgeFee: 25,
        netProfit: 425 + (i * 10),
        profitMargin: 0.85,
        executionTime: 120,
        riskScore: 30 + (i % 40),
        confidence: 0.9 - (i * 0.005),
        timestamp: Date.now(),
        executionPaths: []
      }));

      validator['chainConnector'].getAssetBalance = jest.fn().mockResolvedValue(1000000);
      validator['chainConnector'].estimateGasCost = jest.fn().mockResolvedValue(50);
      validator['priceFeedManager'].getPriceAge = jest.fn().mapResolvedValue(15);

      for (const opportunity of opportunities) {
        const startTime = performance.now();
        await validator.validateOpportunity(opportunity);
        const endTime = performance.now();
        
        const latency = endTime - startTime;
        performanceMetrics.validationLatency.push(latency);
      }

      const avgValidationLatency = performanceMetrics.validationLatency.reduce((a, b) => a + b, 0) / performanceMetrics.validationLatency.length;
      const maxValidationLatency = Math.max(...performanceMetrics.validationLatency);

      console.log(`Validation Latency Metrics:
        Average: ${avgValidationLatency.toFixed(2)}ms
        Maximum: ${maxValidationLatency.toFixed(2)}ms`);

      expect(avgValidationLatency).toBeLessThan(100); // <100ms per validation
      expect(maxValidationLatency).toBeLessThan(200); // <200ms max
    });
  });

  describe('Throughput Benchmarks', () => {
    it('should process >10 opportunities per second under sustained load', async () => {
      const testDuration = 30000; // 30 seconds
      const startTime = Date.now();
      let processedOpportunities = 0;
      let errors = 0;

      const opportunities: ArbitrageOpportunity[] = Array.from({ length: 500 }, (_, i) => ({
        id: `throughput-test-${i}`,
        assetId: (['USDC', 'USDT', 'DAI', 'WETH', 'WBTC'][i % 5]) as AssetID,
        sourceChain: 'ethereum' as ChainID,
        targetChain: (['polygon', 'arbitrum', 'optimism', 'avalanche'][i % 4]) as ChainID,
        sourcePrice: 1.0000,
        targetPrice: 0.995 - (Math.random() * 0.01),
        priceDifference: 0.005 + (Math.random() * 0.01),
        percentageDifference: 0.5 + (Math.random() * 0.5),
        expectedProfit: 500 + (Math.random() * 1000),
        estimatedGasCost: 40 + (Math.random() * 40),
        bridgeFee: 20 + (Math.random() * 20),
        netProfit: 400 + (Math.random() * 900),
        profitMargin: 0.8 + (Math.random() * 0.15),
        executionTime: 100 + (Math.random() * 100),
        riskScore: 20 + (Math.random() * 50),
        confidence: 0.7 + (Math.random() * 0.25),
        timestamp: Date.now(),
        executionPaths: []
      }));

      validator['chainConnector'].getAssetBalance = jest.fn().mockResolvedValue(1000000);
      validator['chainConnector'].estimateGasCost = jest.fn().mockResolvedValue(50);
      validator['priceFeedManager'].getPriceAge = jest.fn().mockResolvedValue(15);

      // Process opportunities in batches
      const batchSize = 20;
      while (Date.now() - startTime < testDuration && processedOpportunities < opportunities.length) {
        const batch = opportunities.slice(processedOpportunities, processedOpportunities + batchSize);
        
        try {
          const batchStartTime = performance.now();
          await validator.validateBatch(batch);
          const batchEndTime = performance.now();
          
          const batchThroughput = batch.length / ((batchEndTime - batchStartTime) / 1000);
          performanceMetrics.throughputOpsPerSecond.push(batchThroughput);
          
          processedOpportunities += batch.length;
        } catch (error) {
          errors++;
        }
      }

      const totalTime = (Date.now() - startTime) / 1000;
      const overallThroughput = processedOpportunities / totalTime;
      const avgBatchThroughput = performanceMetrics.throughputOpsPerSecond.reduce((a, b) => a + b, 0) / performanceMetrics.throughputOpsPerSecond.length;

      console.log(`Throughput Metrics:
        Overall throughput: ${overallThroughput.toFixed(2)} ops/sec
        Average batch throughput: ${avgBatchThroughput.toFixed(2)} ops/sec
        Total processed: ${processedOpportunities}
        Errors: ${errors}
        Duration: ${totalTime.toFixed(2)}s`);

      expect(overallThroughput).toBeGreaterThan(10); // >10 ops/sec requirement
      expect(avgBatchThroughput).toBeGreaterThan(15); // >15 ops/sec in batches
      expect(errors / processedOpportunities).toBeLessThan(0.01); // <1% error rate
    });

    it('should scale efficiently with increasing chain count', async () => {
      const scalingTests = [
        { chains: 3, expectedThroughput: 20 },
        { chains: 5, expectedThroughput: 15 },
        { chains: 8, expectedThroughput: 10 }
      ];

      for (const test of scalingTests) {
        const testChains = mockConfig.chains.slice(0, test.chains);
        const testOpportunities: ArbitrageOpportunity[] = [];

        // Generate opportunities for chain pairs
        for (let i = 0; i < testChains.length; i++) {
          for (let j = i + 1; j < testChains.length; j++) {
            testOpportunities.push({
              id: `scale-test-${i}-${j}`,
              assetId: 'USDC' as AssetID,
              sourceChain: testChains[i].id,
              targetChain: testChains[j].id,
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
            });
          }
        }

        validator['chainConnector'].getAssetBalance = jest.fn().mockResolvedValue(1000000);
        validator['chainConnector'].estimateGasCost = jest.fn().mockResolvedValue(50);
        validator['priceFeedManager'].getPriceAge = jest.fn().mockResolvedValue(15);

        const startTime = performance.now();
        await validator.validateBatch(testOpportunities);
        const endTime = performance.now();

        const processingTime = (endTime - startTime) / 1000;
        const throughput = testOpportunities.length / processingTime;

        console.log(`Scaling Test (${test.chains} chains):
          Opportunities: ${testOpportunities.length}
          Processing time: ${processingTime.toFixed(2)}s
          Throughput: ${throughput.toFixed(2)} ops/sec`);

        expect(throughput).toBeGreaterThan(test.expectedThroughput);
      }
    });
  });

  describe('Resource Utilization', () => {
    it('should maintain reasonable memory usage under load', async () => {
      const initialMemory = process.memoryUsage();
      
      // Simulate sustained load
      for (let i = 0; i < 100; i++) {
        const opportunities: ArbitrageOpportunity[] = Array.from({ length: 50 }, (_, j) => ({
          id: `memory-test-${i}-${j}`,
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
        }));

        validator['chainConnector'].getAssetBalance = jest.fn().mockResolvedValue(1000000);
        validator['chainConnector'].estimateGasCost = jest.fn().mockResolvedValue(50);
        validator['priceFeedManager'].getPriceAge = jest.fn().mockResolvedValue(15);

        await validator.validateBatch(opportunities);

        const currentMemory = process.memoryUsage();
        performanceMetrics.memoryUsage.push(currentMemory.heapUsed);

        // Force garbage collection every 10 iterations
        if (i % 10 === 0 && global.gc) {
          global.gc();
        }
      }

      const finalMemory = process.memoryUsage();
      const memoryIncrease = (finalMemory.heapUsed - initialMemory.heapUsed) / 1024 / 1024; // MB

      console.log(`Memory Usage:
        Initial: ${(initialMemory.heapUsed / 1024 / 1024).toFixed(2)} MB
        Final: ${(finalMemory.heapUsed / 1024 / 1024).toFixed(2)} MB
        Increase: ${memoryIncrease.toFixed(2)} MB`);

      // Memory increase should be reasonable (<100MB for sustained load)
      expect(memoryIncrease).toBeLessThan(100);
    });

    it('should handle concurrent operations efficiently', async () => {
      const concurrentOperations = 20;
      const operationsPerBatch = 25;

      const promises = Array.from({ length: concurrentOperations }, async (_, i) => {
        const opportunities: ArbitrageOpportunity[] = Array.from({ length: operationsPerBatch }, (_, j) => ({
          id: `concurrent-test-${i}-${j}`,
          assetId: 'USDC' as AssetID,
          sourceChain: 'ethereum' as ChainID,
          targetChain: 'polygon' as ChainID,
          sourcePrice: 1.0000,
          targetPrice: 0.995 - (Math.random() * 0.005),
          priceDifference: 0.005 + (Math.random() * 0.005),
          percentageDifference: 0.5 + (Math.random() * 0.3),
          expectedProfit: 500 + (Math.random() * 300),
          estimatedGasCost: 50,
          bridgeFee: 25,
          netProfit: 425 + (Math.random() * 250),
          profitMargin: 0.85,
          executionTime: 120,
          riskScore: 30 + (Math.random() * 20),
          confidence: 0.8 + (Math.random() * 0.15),
          timestamp: Date.now(),
          executionPaths: []
        }));

        validator['chainConnector'].getAssetBalance = jest.fn().mockResolvedValue(1000000);
        validator['chainConnector'].estimateGasCost = jest.fn().mockResolvedValue(50);
        validator['priceFeedManager'].getPriceAge = jest.fn().mockResolvedValue(15);

        const startTime = performance.now();
        const results = await validator.validateBatch(opportunities);
        const endTime = performance.now();

        return {
          batchId: i,
          processingTime: endTime - startTime,
          opportunityCount: opportunities.length,
          validCount: results.filter(r => r.isValid).length
        };
      });

      const startTime = performance.now();
      const results = await Promise.all(promises);
      const totalTime = performance.now() - startTime;

      const totalOpportunities = results.reduce((sum, r) => sum + r.opportunityCount, 0);
      const totalValid = results.reduce((sum, r) => sum + r.validCount, 0);
      const concurrentThroughput = totalOpportunities / (totalTime / 1000);

      console.log(`Concurrent Processing Metrics:
        Total opportunities: ${totalOpportunities}
        Total valid: ${totalValid}
        Concurrent batches: ${concurrentOperations}
        Total time: ${totalTime.toFixed(2)}ms
        Throughput: ${concurrentThroughput.toFixed(2)} ops/sec`);

      expect(concurrentThroughput).toBeGreaterThan(50); // Should be faster due to concurrency
      expect(totalValid / totalOpportunities).toBeGreaterThan(0.3); // Reasonable validation rate
    });
  });

  describe('Historical Performance Analysis', () => {
    it('should maintain performance consistency over time', async () => {
      const iterations = 20;
      const performanceHistory: Array<{
        iteration: number;
        detectionTime: number;
        validationTime: number;
        throughput: number;
        memoryUsage: number;
      }> = [];

      for (let i = 0; i < iterations; i++) {
        // Generate test data
        const opportunities: ArbitrageOpportunity[] = Array.from({ length: 30 }, (_, j) => ({
          id: `history-test-${i}-${j}`,
          assetId: (['USDC', 'USDT', 'DAI'][j % 3]) as AssetID,
          sourceChain: 'ethereum' as ChainID,
          targetChain: (['polygon', 'arbitrum', 'optimism'][j % 3]) as ChainID,
          sourcePrice: 1.0000,
          targetPrice: 0.995 - (Math.random() * 0.01),
          priceDifference: 0.005 + (Math.random() * 0.01),
          percentageDifference: 0.5 + (Math.random() * 0.5),
          expectedProfit: 500 + (Math.random() * 500),
          estimatedGasCost: 50,
          bridgeFee: 25,
          netProfit: 425 + (Math.random() * 450),
          profitMargin: 0.85,
          executionTime: 120,
          riskScore: 30 + (Math.random() * 30),
          confidence: 0.8 + (Math.random() * 0.1),
          timestamp: Date.now(),
          executionPaths: []
        }));

        // Detection performance
        engine['priceFeedManager'].getPrices = jest.fn().mockResolvedValue({
          'USDC-ethereum': 1.0000,
          'USDC-polygon': 0.995,
          'USDT-ethereum': 1.0000,
          'USDT-arbitrum': 0.993,
          'DAI-ethereum': 1.0000,
          'DAI-optimism': 0.997
        });
        engine['chainConnector'].getAssetBalance = jest.fn().mockResolvedValue(1000000);

        const detectionStart = performance.now();
        await engine.detectOpportunities();
        const detectionTime = performance.now() - detectionStart;

        // Validation performance
        validator['chainConnector'].getAssetBalance = jest.fn().mockResolvedValue(1000000);
        validator['chainConnector'].estimateGasCost = jest.fn().mockResolvedValue(50);
        validator['priceFeedManager'].getPriceAge = jest.fn().mockResolvedValue(15);

        const validationStart = performance.now();
        await validator.validateBatch(opportunities);
        const validationTime = performance.now() - validationStart;

        const throughput = opportunities.length / (validationTime / 1000);
        const memoryUsage = process.memoryUsage().heapUsed / 1024 / 1024;

        performanceHistory.push({
          iteration: i,
          detectionTime,
          validationTime,
          throughput,
          memoryUsage
        });

        // Small delay to simulate real-world conditions
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Analyze performance trends
      const avgDetectionTime = performanceHistory.reduce((sum, p) => sum + p.detectionTime, 0) / iterations;
      const avgValidationTime = performanceHistory.reduce((sum, p) => sum + p.validationTime, 0) / iterations;
      const avgThroughput = performanceHistory.reduce((sum, p) => sum + p.throughput, 0) / iterations;

      // Check for performance degradation
      const firstHalf = performanceHistory.slice(0, iterations / 2);
      const secondHalf = performanceHistory.slice(iterations / 2);

      const firstHalfAvgDetection = firstHalf.reduce((sum, p) => sum + p.detectionTime, 0) / firstHalf.length;
      const secondHalfAvgDetection = secondHalf.reduce((sum, p) => sum + p.detectionTime, 0) / secondHalf.length;

      const performanceDegradation = (secondHalfAvgDetection - firstHalfAvgDetection) / firstHalfAvgDetection;

      console.log(`Historical Performance Analysis:
        Average detection time: ${avgDetectionTime.toFixed(2)}ms
        Average validation time: ${avgValidationTime.toFixed(2)}ms
        Average throughput: ${avgThroughput.toFixed(2)} ops/sec
        Performance degradation: ${(performanceDegradation * 100).toFixed(2)}%`);

      // Performance should remain consistent (degradation <10%)
      expect(Math.abs(performanceDegradation)).toBeLessThan(0.1);
      expect(avgDetectionTime).toBeLessThan(500);
      expect(avgThroughput).toBeGreaterThan(10);
    });
  });

  afterAll(() => {
    // Generate comprehensive performance report
    const report = {
      timestamp: new Date().toISOString(),
      testDuration: Date.now() - performanceMetrics.totalOperations,
      metrics: {
        detection: {
          avgLatency: performanceMetrics.detectionLatency.length > 0 ? 
            performanceMetrics.detectionLatency.reduce((a, b) => a + b, 0) / performanceMetrics.detectionLatency.length : 0,
          maxLatency: performanceMetrics.detectionLatency.length > 0 ? 
            Math.max(...performanceMetrics.detectionLatency) : 0,
          p95Latency: performanceMetrics.detectionLatency.length > 0 ? 
            performanceMetrics.detectionLatency.sort((a, b) => a - b)[Math.floor(performanceMetrics.detectionLatency.length * 0.95)] : 0
        },
        validation: {
          avgLatency: performanceMetrics.validationLatency.length > 0 ? 
            performanceMetrics.validationLatency.reduce((a, b) => a + b, 0) / performanceMetrics.validationLatency.length : 0,
          maxLatency: performanceMetrics.validationLatency.length > 0 ? 
            Math.max(...performanceMetrics.validationLatency) : 0
        },
        throughput: {
          avgOpsPerSecond: performanceMetrics.throughputOpsPerSecond.length > 0 ? 
            performanceMetrics.throughputOpsPerSecond.reduce((a, b) => a + b, 0) / performanceMetrics.throughputOpsPerSecond.length : 0,
          maxOpsPerSecond: performanceMetrics.throughputOpsPerSecond.length > 0 ? 
            Math.max(...performanceMetrics.throughputOpsPerSecond) : 0
        },
        reliability: {
          successRate: performanceMetrics.successRate,
          errorRate: performanceMetrics.errorRate,
          totalOperations: performanceMetrics.totalOperations
        }
      },
      compliance: {
        detectionLatency: report.metrics.detection.avgLatency < 500 ? 'PASS' : 'FAIL',
        validationLatency: report.metrics.validation.avgLatency < 100 ? 'PASS' : 'FAIL',
        throughput: report.metrics.throughput.avgOpsPerSecond > 10 ? 'PASS' : 'FAIL',
        reliability: report.metrics.reliability.errorRate < 0.01 ? 'PASS' : 'FAIL'
      }
    };

    console.log(`
=== ARBITRAGE DETECTION PERFORMANCE REPORT ===
${JSON.stringify(report, null, 2)}
    `);
  });
});