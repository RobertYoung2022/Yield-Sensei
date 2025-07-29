/**
 * Sage Satellite Performance and Load Testing Framework
 * Comprehensive performance benchmarks and load testing for all Sage components
 */

import { jest } from '@jest/globals';
import { performance } from 'perf_hooks';
import { SageSatelliteAgent, DEFAULT_SAGE_CONFIG } from '../../../src/satellites/sage/sage-satellite';
import { RWAOpportunityScoringSystem } from '../../../src/satellites/sage/rwa/opportunity-scoring-system';
import { FundamentalAnalysisEngine } from '../../../src/satellites/sage/research/fundamental-analysis-engine';
import { ComplianceMonitoringFramework } from '../../../src/satellites/sage/compliance/compliance-monitoring-framework';
import { PerplexityIntegration } from '../../../src/satellites/sage/api/perplexity-integration';
import { RWAData, ProtocolData } from '../../../src/satellites/sage/types';

// Mock dependencies
jest.mock('@/shared/logging/logger', () => ({
  getLogger: jest.fn(() => ({
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }))
}));

jest.mock('@tensorflow/tfjs-node', () => ({
  sequential: jest.fn(() => ({
    compile: jest.fn(),
    fit: jest.fn().mockResolvedValue({ history: { loss: [0.1] } }),
    predict: jest.fn(() => ({
      dataSync: jest.fn(() => [0.85]),
      dispose: jest.fn()
    })),
    dispose: jest.fn()
  })),
  layers: { dense: jest.fn(), dropout: jest.fn() },
  train: { adam: jest.fn() },
  tensor2d: jest.fn(() => ({ dispose: jest.fn() }))
}));

describe('Sage Satellite Performance and Load Testing', () => {
  let sageAgent: SageSatelliteAgent;

  // Performance thresholds (in milliseconds)
  const PERFORMANCE_THRESHOLDS = {
    RWA_SCORING: {
      SINGLE: 2000,      // Single RWA scoring should complete within 2s
      BATCH_10: 10000,   // 10 RWAs should complete within 10s
      BATCH_50: 30000,   // 50 RWAs should complete within 30s
      CONCURRENT_5: 8000 // 5 concurrent scorings within 8s
    },
    PROTOCOL_ANALYSIS: {
      SINGLE: 3000,      // Single protocol analysis within 3s
      BATCH_10: 15000,   // 10 protocols within 15s
      CONCURRENT_3: 10000 // 3 concurrent analyses within 10s
    },
    COMPLIANCE_ASSESSMENT: {
      SINGLE: 1000,      // Single assessment within 1s
      BATCH_20: 8000,    // 20 assessments within 8s
      CONCURRENT_10: 5000 // 10 concurrent assessments within 5s
    },
    MEMORY_LIMIT: 512 * 1024 * 1024, // 512MB memory limit
    CPU_THRESHOLD: 80 // Max 80% CPU usage
  };

  // Test data generators
  const generateRWAData = (count: number): RWAData[] => {
    return Array.from({ length: count }, (_, i) => ({
      id: `perf-rwa-${i}`,
      type: ['real-estate', 'bonds', 'commodities', 'art'][i % 4] as any,
      issuer: `Test Issuer ${i}`,
      value: 100000 + (i * 50000),
      currency: 'USD',
      maturityDate: new Date(Date.now() + (365 + i * 30) * 24 * 60 * 60 * 1000),
      yield: 0.04 + (i * 0.01),
      riskRating: ['AAA', 'AA', 'A', 'BBB', 'BB'][i % 5],
      collateral: {
        type: ['real-estate', 'government-bonds', 'corporate-bonds'][i % 3],
        value: 120000 + (i * 60000),
        ltv: 0.7 + (i * 0.02),
        liquidationThreshold: 0.8 + (i * 0.02)
      },
      regulatoryStatus: {
        jurisdiction: ['US', 'EU', 'UK'][i % 3],
        complianceLevel: ['compliant', 'partial', 'non-compliant'][i % 3] as any,
        licenses: [`License-${i}`, `Permit-${i}`],
        restrictions: i % 3 === 2 ? [`Restriction-${i}`] : [],
        lastReview: new Date(Date.now() - (i * 30) * 24 * 60 * 60 * 1000)
      },
      complianceScore: 60 + (i * 5) % 40
    }));
  };

  const generateProtocolData = (count: number): ProtocolData[] => {
    return Array.from({ length: count }, (_, i) => ({
      id: `perf-protocol-${i}`,
      name: `Test Protocol ${i}`,
      category: ['lending', 'dex', 'derivatives', 'yield'][i % 4] as any,
      tvl: 10000000 + (i * 50000000),
      volume24h: 1000000 + (i * 5000000),
      users: 1000 + (i * 5000),
      tokenPrice: 1 + (i * 5),
      marketCap: 50000000 + (i * 25000000),
      circulatingSupply: 5000000 + (i * 2000000),
      totalSupply: 10000000 + (i * 3000000),
      apy: 0.05 + (i * 0.02),
      fees24h: 10000 + (i * 50000),
      revenue: 100000 + (i * 500000),
      codeAudits: [{
        auditor: `Auditor ${i}`,
        date: new Date(Date.now() - (i * 30) * 24 * 60 * 60 * 1000),
        status: i % 2 === 0 ? 'passed' : 'failed' as any,
        criticalIssues: i % 5,
        highIssues: i % 10,
        mediumIssues: i % 15,
        lowIssues: i % 20
      }],
      team: {
        size: 5 + (i * 5),
        experience: 1 + (i * 0.5),
        credibility: 0.5 + (i * 0.05),
        anonymity: i % 3 === 0
      },
      governance: {
        tokenHolders: 1000 + (i * 2000),
        votingPower: 0.3 + (i * 0.05),
        proposalCount: 10 + (i * 5),
        participationRate: 0.2 + (i * 0.05)
      },
      riskMetrics: {
        volatility: 0.2 + (i * 0.05),
        correlation: 0.1 + (i * 0.02),
        maxDrawdown: 0.3 + (i * 0.05),
        sharpeRatio: 0.5 + (i * 0.1),
        beta: 0.8 + (i * 0.1)
      },
      tokenDistribution: [
        { category: 'Team', percentage: 20, vesting: true },
        { category: 'Public', percentage: 60, vesting: false },
        { category: 'Treasury', percentage: 20, vesting: true }
      ],
      partnerships: [`Partner-${i}-1`, `Partner-${i}-2`]
    }));
  };

  beforeEach(() => {
    sageAgent = new SageSatelliteAgent({
      ...DEFAULT_SAGE_CONFIG,
      id: `sage-perf-${Date.now()}`
    });
  });

  afterEach(async () => {
    try {
      await sageAgent.shutdown();
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('RWA Scoring Performance Tests', () => {
    beforeEach(async () => {
      await sageAgent.initialize();
    });

    test('should score single RWA within performance threshold', async () => {
      const rwaData = generateRWAData(1)[0];
      
      const startTime = performance.now();
      const score = await sageAgent.scoreRWAOpportunity(rwaData);
      const endTime = performance.now();
      
      const duration = endTime - startTime;
      
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.RWA_SCORING.SINGLE);
      expect(score.overallScore).toBeGreaterThan(0);
      
      console.log(`Single RWA scoring: ${duration.toFixed(2)}ms`);
    });

    test('should score batch of 10 RWAs within threshold', async () => {
      const rwaList = generateRWAData(10);
      
      const startTime = performance.now();
      const scores = await Promise.all(
        rwaList.map(rwa => sageAgent.scoreRWAOpportunity(rwa))
      );
      const endTime = performance.now();
      
      const duration = endTime - startTime;
      
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.RWA_SCORING.BATCH_10);
      expect(scores).toHaveLength(10);
      expect(scores.every(s => s.overallScore > 0)).toBe(true);
      
      console.log(`Batch 10 RWA scoring: ${duration.toFixed(2)}ms (${(duration/10).toFixed(2)}ms avg)`);
    });

    test('should handle large batch of 50 RWAs efficiently', async () => {
      const rwaList = generateRWAData(50);
      
      const startTime = performance.now();
      const scores = await Promise.all(
        rwaList.map(rwa => sageAgent.scoreRWAOpportunity(rwa))
      );
      const endTime = performance.now();
      
      const duration = endTime - startTime;
      
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.RWA_SCORING.BATCH_50);
      expect(scores).toHaveLength(50);
      
      console.log(`Batch 50 RWA scoring: ${duration.toFixed(2)}ms (${(duration/50).toFixed(2)}ms avg)`);
    });

    test('should handle concurrent RWA scoring efficiently', async () => {
      const rwaData = generateRWAData(1)[0];
      const concurrentRequests = Array.from({ length: 5 }, () => 
        sageAgent.scoreRWAOpportunity(rwaData)
      );
      
      const startTime = performance.now();
      const scores = await Promise.all(concurrentRequests);
      const endTime = performance.now();
      
      const duration = endTime - startTime;
      
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.RWA_SCORING.CONCURRENT_5);
      expect(scores).toHaveLength(5);
      
      console.log(`Concurrent 5 RWA scoring: ${duration.toFixed(2)}ms`);
    });

    test('should maintain throughput under sustained load', async () => {
      const rwaList = generateRWAData(20);
      const results: number[] = [];
      
      // Process in waves to simulate sustained load
      for (let wave = 0; wave < 4; wave++) {
        const waveData = rwaList.slice(wave * 5, (wave + 1) * 5);
        
        const startTime = performance.now();
        await Promise.all(waveData.map(rwa => sageAgent.scoreRWAOpportunity(rwa)));
        const endTime = performance.now();
        
        results.push(endTime - startTime);
        
        // Small delay between waves
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      // Performance should not degrade significantly
      const firstWave = results[0];
      const lastWave = results[results.length - 1];
      const degradation = (lastWave - firstWave) / firstWave;
      
      expect(degradation).toBeLessThan(0.5); // Less than 50% degradation
      
      console.log(`Sustained load performance:`, results.map(r => `${r.toFixed(2)}ms`).join(', '));
    });
  });

  describe('Protocol Analysis Performance Tests', () => {
    beforeEach(async () => {
      await sageAgent.initialize();
    });

    test('should analyze single protocol within threshold', async () => {
      const protocolData = generateProtocolData(1)[0];
      
      const startTime = performance.now();
      const analysis = await sageAgent.analyzeProtocol(protocolData);
      const endTime = performance.now();
      
      const duration = endTime - startTime;
      
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.PROTOCOL_ANALYSIS.SINGLE);
      expect(analysis.overallScore).toBeGreaterThan(0);
      
      console.log(`Single protocol analysis: ${duration.toFixed(2)}ms`);
    });

    test('should analyze batch of 10 protocols within threshold', async () => {
      const protocolList = generateProtocolData(10);
      
      const startTime = performance.now();
      const analyses = await Promise.all(
        protocolList.map(protocol => sageAgent.analyzeProtocol(protocol))
      );
      const endTime = performance.now();
      
      const duration = endTime - startTime;
      
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.PROTOCOL_ANALYSIS.BATCH_10);
      expect(analyses).toHaveLength(10);
      
      console.log(`Batch 10 protocol analysis: ${duration.toFixed(2)}ms (${(duration/10).toFixed(2)}ms avg)`);
    });

    test('should handle concurrent protocol analysis', async () => {
      const protocolData = generateProtocolData(1)[0];
      const concurrentRequests = Array.from({ length: 3 }, () => 
        sageAgent.analyzeProtocol(protocolData)
      );
      
      const startTime = performance.now();
      const analyses = await Promise.all(concurrentRequests);
      const endTime = performance.now();
      
      const duration = endTime - startTime;
      
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.PROTOCOL_ANALYSIS.CONCURRENT_3);
      expect(analyses).toHaveLength(3);
      
      console.log(`Concurrent 3 protocol analysis: ${duration.toFixed(2)}ms`);
    });
  });

  describe('Mixed Workload Performance Tests', () => {
    beforeEach(async () => {
      await sageAgent.initialize();
    });

    test('should handle mixed RWA and protocol operations', async () => {
      const rwaList = generateRWAData(5);
      const protocolList = generateProtocolData(3);
      
      const startTime = performance.now();
      
      const [rwaScores, protocolAnalyses] = await Promise.all([
        Promise.all(rwaList.map(rwa => sageAgent.scoreRWAOpportunity(rwa))),
        Promise.all(protocolList.map(protocol => sageAgent.analyzeProtocol(protocol)))
      ]);
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      expect(duration).toBeLessThan(15000); // Should complete within 15s
      expect(rwaScores).toHaveLength(5);
      expect(protocolAnalyses).toHaveLength(3);
      
      console.log(`Mixed workload (5 RWA + 3 Protocol): ${duration.toFixed(2)}ms`);
    });

    test('should maintain performance across different entity types', async () => {
      const rwaData = generateRWAData(1)[0];
      const protocolData = generateProtocolData(1)[0];
      
      // Test multiple rounds
      const rwaTimings: number[] = [];
      const protocolTimings: number[] = [];
      
      for (let i = 0; i < 5; i++) {
        // RWA scoring
        let startTime = performance.now();
        await sageAgent.scoreRWAOpportunity(rwaData);
        rwaTimings.push(performance.now() - startTime);
        
        // Protocol analysis
        startTime = performance.now();
        await sageAgent.analyzeProtocol(protocolData);
        protocolTimings.push(performance.now() - startTime);
      }
      
      // Check consistency
      const rwaAvg = rwaTimings.reduce((a, b) => a + b, 0) / rwaTimings.length;
      const protocolAvg = protocolTimings.reduce((a, b) => a + b, 0) / protocolTimings.length;
      
      expect(rwaAvg).toBeLessThan(PERFORMANCE_THRESHOLDS.RWA_SCORING.SINGLE);
      expect(protocolAvg).toBeLessThan(PERFORMANCE_THRESHOLDS.PROTOCOL_ANALYSIS.SINGLE);
      
      console.log(`RWA avg: ${rwaAvg.toFixed(2)}ms, Protocol avg: ${protocolAvg.toFixed(2)}ms`);
    });
  });

  describe('System Resource Monitoring', () => {
    beforeEach(async () => {
      await sageAgent.initialize();
    });

    test('should monitor memory usage during operations', async () => {
      const initialMemory = process.memoryUsage().heapUsed;
      
      // Perform memory-intensive operations
      const rwaList = generateRWAData(100);
      await Promise.all(rwaList.map(rwa => sageAgent.scoreRWAOpportunity(rwa)));
      
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryDelta = finalMemory - initialMemory;
      
      expect(memoryDelta).toBeLessThan(PERFORMANCE_THRESHOLDS.MEMORY_LIMIT);
      
      console.log(`Memory usage: ${(memoryDelta / 1024 / 1024).toFixed(2)}MB increase`);
    });

    test('should handle memory cleanup after operations', async () => {
      const rwaList = generateRWAData(50);
      
      const beforeMemory = process.memoryUsage().heapUsed;
      
      // Perform operations
      await Promise.all(rwaList.map(rwa => sageAgent.scoreRWAOpportunity(rwa)));
      
      const afterMemory = process.memoryUsage().heapUsed;
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      const cleanupMemory = process.memoryUsage().heapUsed;
      
      const memoryRecovered = afterMemory - cleanupMemory;
      const memoryUsed = afterMemory - beforeMemory;
      
      // Should recover at least 30% of used memory
      expect(memoryRecovered / memoryUsed).toBeGreaterThan(0.3);
      
      console.log(`Memory cleanup: ${(memoryRecovered / 1024 / 1024).toFixed(2)}MB recovered`);
    });
  });

  describe('Scalability and Stress Tests', () => {
    beforeEach(async () => {
      await sageAgent.initialize();
    });

    test('should handle increasing load gracefully', async () => {
      const loadSizes = [1, 5, 10, 20, 50];
      const results: Array<{ size: number; duration: number; avgPerItem: number }> = [];
      
      for (const size of loadSizes) {
        const rwaList = generateRWAData(size);
        
        const startTime = performance.now();
        await Promise.all(rwaList.map(rwa => sageAgent.scoreRWAOpportunity(rwa)));
        const endTime = performance.now();
        
        const duration = endTime - startTime;
        const avgPerItem = duration / size;
        
        results.push({ size, duration, avgPerItem });
        
        console.log(`Load ${size}: ${duration.toFixed(2)}ms total, ${avgPerItem.toFixed(2)}ms avg`);
      }
      
      // Performance should scale reasonably (not exponentially)
      const firstAvg = results[0].avgPerItem;
      const lastAvg = results[results.length - 1].avgPerItem;
      const scalingFactor = lastAvg / firstAvg;
      
      expect(scalingFactor).toBeLessThan(5); // Should not be more than 5x slower per item
    });

    test('should recover from overload conditions', async () => {
      // Create overload condition
      const overloadTasks = Array.from({ length: 100 }, (_, i) => 
        sageAgent.scoreRWAOpportunity(generateRWAData(1)[0])
      );
      
      // Start all tasks but don't wait for completion
      const overloadPromise = Promise.all(overloadTasks);
      
      // Wait a bit then try normal operation
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const normalData = generateRWAData(1)[0];
      const startTime = performance.now();
      const normalResult = await sageAgent.scoreRWAOpportunity(normalData);
      const endTime = performance.now();
      
      // Normal operation should still work reasonably well
      const normalDuration = endTime - startTime;
      expect(normalDuration).toBeLessThan(10000); // Within 10s even under load
      expect(normalResult.overallScore).toBeGreaterThan(0);
      
      // Wait for overload tasks to complete
      await overloadPromise;
      
      console.log(`Normal operation under load: ${normalDuration.toFixed(2)}ms`);
    });
  });

  describe('Caching Performance Tests', () => {
    beforeEach(async () => {
      await sageAgent.initialize();
    });

    test('should demonstrate cache performance benefits', async () => {
      const rwaData = generateRWAData(1)[0];
      
      // First call (no cache)
      const startTime1 = performance.now();
      await sageAgent.scoreRWAOpportunity(rwaData);
      const firstCallTime = performance.now() - startTime1;
      
      // Second call (cached)
      const startTime2 = performance.now();
      await sageAgent.scoreRWAOpportunity(rwaData);
      const secondCallTime = performance.now() - startTime2;
      
      // Cached call should be significantly faster
      expect(secondCallTime).toBeLessThan(firstCallTime * 0.5); // At least 50% faster
      
      console.log(`Cache performance: First ${firstCallTime.toFixed(2)}ms, Cached ${secondCallTime.toFixed(2)}ms`);
    });

    test('should handle cache invalidation performance', async () => {
      const rwaList = generateRWAData(10);
      
      // Fill cache
      await Promise.all(rwaList.map(rwa => sageAgent.scoreRWAOpportunity(rwa)));
      
      // Measure cache hit performance
      const startTime = performance.now();
      await Promise.all(rwaList.map(rwa => sageAgent.scoreRWAOpportunity(rwa)));
      const cachedTime = performance.now() - startTime;
      
      expect(cachedTime).toBeLessThan(1000); // Should be very fast
      
      console.log(`Cache hit performance for 10 items: ${cachedTime.toFixed(2)}ms`);
    });
  });

  describe('Component-Specific Performance Tests', () => {
    let scoringSystem: RWAOpportunityScoringSystem;
    let analysisEngine: FundamentalAnalysisEngine;
    let complianceFramework: ComplianceMonitoringFramework;

    beforeEach(async () => {
      scoringSystem = RWAOpportunityScoringSystem.getInstance();
      analysisEngine = FundamentalAnalysisEngine.getInstance();
      complianceFramework = ComplianceMonitoringFramework.getInstance();
      
      await Promise.all([
        scoringSystem.initialize(),
        analysisEngine.initialize(),
        complianceFramework.initialize()
      ]);
    });

    afterEach(async () => {
      try {
        await Promise.all([
          scoringSystem.shutdown(),
          analysisEngine.shutdown(),
          complianceFramework.shutdown()
        ]);
      } catch (error) {
        // Ignore cleanup errors
      }
    });

    test('should benchmark individual component performance', async () => {
      const rwaData = generateRWAData(1)[0];
      const protocolData = generateProtocolData(1)[0];
      
      // RWA Scoring System
      const scoringStart = performance.now();
      await scoringSystem.scoreOpportunity(rwaData);
      const scoringTime = performance.now() - scoringStart;
      
      // Fundamental Analysis Engine  
      const analysisStart = performance.now();
      await analysisEngine.analyzeProtocol(protocolData);
      const analysisTime = performance.now() - analysisStart;
      
      // Compliance Framework
      const complianceStart = performance.now();
      await complianceFramework.assessCompliance(rwaData.id, 'rwa', rwaData);
      const complianceTime = performance.now() - complianceStart;
      
      expect(scoringTime).toBeLessThan(2000);
      expect(analysisTime).toBeLessThan(3000);
      expect(complianceTime).toBeLessThan(1000);
      
      console.log(`Component benchmarks:`);
      console.log(`  RWA Scoring: ${scoringTime.toFixed(2)}ms`);
      console.log(`  Protocol Analysis: ${analysisTime.toFixed(2)}ms`);
      console.log(`  Compliance Assessment: ${complianceTime.toFixed(2)}ms`);
    });

    test('should measure component integration overhead', async () => {
      const rwaData = generateRWAData(1)[0];
      
      // Direct component call
      const directStart = performance.now();
      await scoringSystem.scoreOpportunity(rwaData);
      const directTime = performance.now() - directStart;
      
      // Integrated call through Sage agent
      const integratedStart = performance.now();
      await sageAgent.scoreRWAOpportunity(rwaData);
      const integratedTime = performance.now() - integratedStart;
      
      const overhead = integratedTime - directTime;
      const overheadPercent = (overhead / directTime) * 100;
      
      // Integration overhead should be reasonable
      expect(overheadPercent).toBeLessThan(100); // Less than 100% overhead
      
      console.log(`Integration overhead: ${overhead.toFixed(2)}ms (${overheadPercent.toFixed(1)}%)`);
    });
  });

  describe('Real-world Simulation Tests', () => {
    beforeEach(async () => {
      await sageAgent.initialize();
    });

    test('should simulate typical daily workload', async () => {
      // Simulate a typical day: 20 RWA scorings, 10 protocol analyses, mixed timing
      const rwaList = generateRWAData(20);
      const protocolList = generateProtocolData(10);
      
      const startTime = performance.now();
      
      // Stagger requests to simulate real usage
      const operations: Promise<any>[] = [];
      
      // Add RWA scorings with delays
      rwaList.forEach((rwa, i) => {
        operations.push(
          new Promise(resolve => setTimeout(resolve, i * 100))
            .then(() => sageAgent.scoreRWAOpportunity(rwa))
        );
      });
      
      // Add protocol analyses with delays
      protocolList.forEach((protocol, i) => {
        operations.push(
          new Promise(resolve => setTimeout(resolve, i * 200))
            .then(() => sageAgent.analyzeProtocol(protocol))
        );
      });
      
      const results = await Promise.all(operations);
      const totalTime = performance.now() - startTime;
      
      expect(results).toHaveLength(30);
      expect(totalTime).toBeLessThan(60000); // Should complete within 1 minute
      
      console.log(`Daily workload simulation: ${totalTime.toFixed(2)}ms for 30 operations`);
    });

    test('should handle burst traffic patterns', async () => {
      // Simulate burst: many requests in short time, then quiet period
      const burstSize = 15;
      const rwaList = generateRWAData(burstSize);
      
      // Burst phase
      const burstStart = performance.now();
      const burstResults = await Promise.all(
        rwaList.map(rwa => sageAgent.scoreRWAOpportunity(rwa))
      );
      const burstTime = performance.now() - burstStart;
      
      // Quiet period
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Normal operation after burst
      const normalData = generateRWAData(1)[0];
      const normalStart = performance.now();
      await sageAgent.scoreRWAOpportunity(normalData);
      const normalTime = performance.now() - normalStart;
      
      expect(burstResults).toHaveLength(burstSize);
      expect(burstTime).toBeLessThan(20000); // Burst within 20s
      expect(normalTime).toBeLessThan(3000); // Normal operation recovers quickly
      
      console.log(`Burst handling: ${burstTime.toFixed(2)}ms for ${burstSize} items, recovery: ${normalTime.toFixed(2)}ms`);
    });
  });
});