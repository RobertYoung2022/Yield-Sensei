/**
 * Test Setup for Opportunity Evaluation Tests
 */

import { jest } from '@jest/globals';

// Test configuration constants
export const EVALUATION_TEST_CONFIG = {
  PERFORMANCE_THRESHOLDS: {
    SINGLE_EVALUATION_MS: 2000,     // 2 seconds max per evaluation
    BATCH_EVALUATION_MS: 5000,      // 5 seconds max per batch
    INTEGRATION_TEST_MS: 10000,     // 10 seconds max for integration tests
    MEMORY_INCREASE_MB: 50          // 50MB max memory growth
  },
  QUALITY_THRESHOLDS: {
    MIN_SCORE_RANGE: 100,           // Score should span 0-100
    MIN_PRIORITY_DISTRIBUTION: 3,   // At least 3 different priorities
    MIN_ACTION_DISTRIBUTION: 2,     // At least 2 different actions
    CONSISTENCY_TOLERANCE: 5        // ±5% tolerance for repeated evaluations
  },
  COVERAGE_REQUIREMENTS: {
    EVALUATION_SCENARIOS: 10,       // Minimum evaluation scenarios
    MARKET_CONDITIONS: 4,           // Different market conditions
    OPPORTUNITY_TYPES: 5,           // Different opportunity types
    ERROR_SCENARIOS: 3              // Error/edge case scenarios
  }
};

// Mock market data generator
export class MockMarketDataGenerator {
  static generateNormalConditions() {
    return {
      gasPrice: {
        ethereum: 45e9,  // 45 gwei
        polygon: 30e9,   // 30 gwei
        arbitrum: 0.5e9, // 0.5 gwei
        optimism: 0.8e9, // 0.8 gwei
        avalanche: 25e9, // 25 gwei
        bsc: 5e9         // 5 gwei
      },
      volatility: {
        USDC: 0.005,     // 0.5%
        USDT: 0.008,     // 0.8%
        DAI: 0.006,      // 0.6%
        WETH: 0.08,      // 8%
        WBTC: 0.12       // 12%
      },
      liquidity: {
        ethereum: { uniswap: 100000000, sushiswap: 50000000 },
        polygon: { quickswap: 25000000, sushiswap: 15000000 },
        arbitrum: { camelot: 30000000, uniswap: 40000000 },
        optimism: { velodrome: 20000000, uniswap: 25000000 }
      },
      bridgeHealth: {
        stargate: 0.92,
        across: 0.88,
        hop: 0.85,
        synapse: 0.83
      },
      networkCongestion: {
        ethereum: 0.6,
        polygon: 0.3,
        arbitrum: 0.2,
        optimism: 0.25
      }
    };
  }

  static generateStressConditions() {
    return {
      gasPrice: {
        ethereum: 150e9, // Very high gas
        polygon: 80e9,
        arbitrum: 2e9,
        optimism: 3e9
      },
      volatility: {
        USDC: 0.025,     // High for stablecoin
        USDT: 0.03,
        DAI: 0.035,
        WETH: 0.25,      // Very high
        WBTC: 0.3
      },
      liquidity: {
        ethereum: { uniswap: 30000000, sushiswap: 15000000 }, // Reduced
        polygon: { quickswap: 8000000, sushiswap: 5000000 },
        arbitrum: { camelot: 10000000, uniswap: 12000000 },
        optimism: { velodrome: 6000000, uniswap: 8000000 }
      },
      bridgeHealth: {
        stargate: 0.65,  // Poor health
        across: 0.62,
        hop: 0.58,
        synapse: 0.55
      },
      networkCongestion: {
        ethereum: 0.95,  // Severe congestion
        polygon: 0.8,
        arbitrum: 0.6,
        optimism: 0.7
      }
    };
  }

  static generateOptimalConditions() {
    return {
      gasPrice: {
        ethereum: 15e9,  // Very low gas
        polygon: 20e9,
        arbitrum: 0.1e9,
        optimism: 0.2e9
      },
      volatility: {
        USDC: 0.002,     // Very stable
        USDT: 0.003,
        DAI: 0.002,
        WETH: 0.04,      // Low volatility
        WBTC: 0.06
      },
      liquidity: {
        ethereum: { uniswap: 200000000, sushiswap: 100000000 }, // High liquidity
        polygon: { quickswap: 50000000, sushiswap: 30000000 },
        arbitrum: { camelot: 60000000, uniswap: 80000000 },
        optimism: { velodrome: 40000000, uniswap: 50000000 }
      },
      bridgeHealth: {
        stargate: 0.98,  // Excellent health
        across: 0.96,
        hop: 0.94,
        synapse: 0.92
      },
      networkCongestion: {
        ethereum: 0.15,  // Very low congestion
        polygon: 0.1,
        arbitrum: 0.05,
        optimism: 0.08
      }
    };
  }
}

// Test opportunity generator
export class TestOpportunityGenerator {
  static generateHighQualityOpportunity() {
    return {
      id: 'high-quality-test',
      assetId: 'USDC',
      sourceChain: 'ethereum',
      targetChain: 'polygon',
      sourcePrice: 1.0000,
      targetPrice: 0.994,
      priceDifference: 0.006,
      percentageDifference: 0.6,
      expectedProfit: 1200,
      estimatedGasCost: 60,
      bridgeFee: 30,
      netProfit: 1110,
      profitMargin: 0.925,
      executionTime: 120,
      riskScore: 25,
      confidence: 0.92,
      timestamp: Date.now(),
      executionPaths: []
    };
  }

  static generateMediumQualityOpportunity() {
    return {
      id: 'medium-quality-test',
      assetId: 'USDC',
      sourceChain: 'ethereum',
      targetChain: 'arbitrum',
      sourcePrice: 1.0000,
      targetPrice: 0.996,
      priceDifference: 0.004,
      percentageDifference: 0.4,
      expectedProfit: 400,
      estimatedGasCost: 80,
      bridgeFee: 40,
      netProfit: 280,
      profitMargin: 0.7,
      executionTime: 180,
      riskScore: 50,
      confidence: 0.75,
      timestamp: Date.now(),
      executionPaths: []
    };
  }

  static generateLowQualityOpportunity() {
    return {
      id: 'low-quality-test',
      assetId: 'USDC',
      sourceChain: 'ethereum',
      targetChain: 'bsc',
      sourcePrice: 1.0000,
      targetPrice: 0.9985,
      priceDifference: 0.0015,
      percentageDifference: 0.15,
      expectedProfit: 150,
      estimatedGasCost: 120,
      bridgeFee: 60,
      netProfit: -30,
      profitMargin: -0.2,
      executionTime: 300,
      riskScore: 80,
      confidence: 0.4,
      timestamp: Date.now(),
      executionPaths: []
    };
  }
}

// Performance tracking utility
export class PerformanceTracker {
  private startTime: number = 0;
  private memoryStart: number = 0;
  private metrics: {
    evaluationTimes: number[];
    memoryUsage: number[];
    scoreDistribution: number[];
    priorityDistribution: Record<string, number>;
    actionDistribution: Record<string, number>;
  } = {
    evaluationTimes: [],
    memoryUsage: [],
    scoreDistribution: [],
    priorityDistribution: {},
    actionDistribution: {}
  };

  startTracking(): void {
    this.startTime = performance.now();
    this.memoryStart = process.memoryUsage().heapUsed;
  }

  recordEvaluation(evaluation: any): void {
    const endTime = performance.now();
    const evaluationTime = endTime - this.startTime;
    const memoryUsed = process.memoryUsage().heapUsed;

    this.metrics.evaluationTimes.push(evaluationTime);
    this.metrics.memoryUsage.push(memoryUsed);
    this.metrics.scoreDistribution.push(evaluation.finalScore);
    
    this.metrics.priorityDistribution[evaluation.priority] = 
      (this.metrics.priorityDistribution[evaluation.priority] || 0) + 1;
    
    this.metrics.actionDistribution[evaluation.recommendation.action] = 
      (this.metrics.actionDistribution[evaluation.recommendation.action] || 0) + 1;
  }

  getReport(): {
    performance: {
      avgEvaluationTime: number;
      maxEvaluationTime: number;
      avgMemoryUsage: number;
      memoryGrowth: number;
    };
    quality: {
      avgScore: number;
      scoreRange: number;
      priorityDistribution: Record<string, number>;
      actionDistribution: Record<string, number>;
    };
    compliance: {
      performanceCompliant: boolean;
      qualityCompliant: boolean;
      coverageCompliant: boolean;
    };
  } {
    const avgEvaluationTime = this.metrics.evaluationTimes.reduce((a, b) => a + b, 0) / this.metrics.evaluationTimes.length;
    const maxEvaluationTime = Math.max(...this.metrics.evaluationTimes);
    const avgScore = this.metrics.scoreDistribution.reduce((a, b) => a + b, 0) / this.metrics.scoreDistribution.length;
    const scoreRange = Math.max(...this.metrics.scoreDistribution) - Math.min(...this.metrics.scoreDistribution);
    const memoryGrowth = (process.memoryUsage().heapUsed - this.memoryStart) / 1024 / 1024; // MB

    return {
      performance: {
        avgEvaluationTime,
        maxEvaluationTime,
        avgMemoryUsage: this.metrics.memoryUsage.reduce((a, b) => a + b, 0) / this.metrics.memoryUsage.length,
        memoryGrowth
      },
      quality: {
        avgScore,
        scoreRange,
        priorityDistribution: this.metrics.priorityDistribution,
        actionDistribution: this.metrics.actionDistribution
      },
      compliance: {
        performanceCompliant: avgEvaluationTime < EVALUATION_TEST_CONFIG.PERFORMANCE_THRESHOLDS.SINGLE_EVALUATION_MS,
        qualityCompliant: scoreRange > EVALUATION_TEST_CONFIG.QUALITY_THRESHOLDS.MIN_SCORE_RANGE / 2,
        coverageCompliant: Object.keys(this.metrics.priorityDistribution).length >= EVALUATION_TEST_CONFIG.QUALITY_THRESHOLDS.MIN_PRIORITY_DISTRIBUTION
      }
    };
  }

  reset(): void {
    this.startTime = 0;
    this.memoryStart = 0;
    this.metrics = {
      evaluationTimes: [],
      memoryUsage: [],
      scoreDistribution: [],
      priorityDistribution: {},
      actionDistribution: {}
    };
  }
}

// Global test setup
beforeAll(() => {
  // Suppress console logs during testing
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'info').mockImplementation(() => {});
});

afterAll(() => {
  // Restore console methods
  jest.restoreAllMocks();
});

// Export singleton instances
export const performanceTracker = new PerformanceTracker();
export const mockMarketData = MockMarketDataGenerator;
export const testOpportunityGenerator = TestOpportunityGenerator;