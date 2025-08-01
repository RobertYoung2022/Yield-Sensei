/**
 * Test Setup for Arbitrage Detection Tests
 */

import { jest } from '@jest/globals';

// Global test setup
beforeAll(() => {
  // Mock console.log for cleaner test output
  jest.spyOn(console, 'log').mockImplementation(() => {});
  
  // Mock console.warn for cleaner test output  
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  
  // Enable garbage collection for memory tests if available
  if (global.gc) {
    global.gc();
  }
});

afterAll(() => {
  // Restore console methods
  jest.restoreAllMocks();
});

// Global test configuration
export const TEST_CONFIG = {
  PERFORMANCE_THRESHOLDS: {
    DETECTION_LATENCY_MS: 500,
    VALIDATION_LATENCY_MS: 100,
    THROUGHPUT_OPS_PER_SEC: 10,
    MAX_MEMORY_INCREASE_MB: 100,
    MAX_ERROR_RATE: 0.01
  },
  COVERAGE_REQUIREMENTS: {
    CHAINS_TESTED: 5,
    ASSETS_TESTED: 5,
    SCENARIOS_TESTED: 3,
    MIN_ACCURACY_PERCENT: 90
  },
  MOCK_DATA: {
    DEFAULT_LIQUIDITY_USD: 1000000,
    DEFAULT_GAS_COST_USD: 50,
    DEFAULT_BRIDGE_FEE_USD: 25,
    PRICE_VARIATION_PERCENT: 1.0
  }
};

// Test utilities
export class TestMetricsCollector {
  private metrics: {
    detectionTimes: number[];
    validationTimes: number[];
    memorySnapshots: number[];
    errorCount: number;
    successCount: number;
  } = {
    detectionTimes: [],
    validationTimes: [],
    memorySnapshots: [],
    errorCount: 0,
    successCount: 0
  };

  recordDetectionTime(timeMs: number): void {
    this.metrics.detectionTimes.push(timeMs);
  }

  recordValidationTime(timeMs: number): void {
    this.metrics.validationTimes.push(timeMs);
  }

  recordMemorySnapshot(): void {
    this.metrics.memorySnapshots.push(process.memoryUsage().heapUsed);
  }

  recordError(): void {
    this.metrics.errorCount++;
  }

  recordSuccess(): void {
    this.metrics.successCount++;
  }

  getReport(): {
    avgDetectionTime: number;
    maxDetectionTime: number;
    avgValidationTime: number;
    maxValidationTime: number;
    memoryGrowth: number;
    successRate: number;
    errorRate: number;
  } {
    const avgDetectionTime = this.metrics.detectionTimes.length > 0 
      ? this.metrics.detectionTimes.reduce((a, b) => a + b, 0) / this.metrics.detectionTimes.length 
      : 0;
    
    const maxDetectionTime = this.metrics.detectionTimes.length > 0 
      ? Math.max(...this.metrics.detectionTimes) 
      : 0;
    
    const avgValidationTime = this.metrics.validationTimes.length > 0 
      ? this.metrics.validationTimes.reduce((a, b) => a + b, 0) / this.metrics.validationTimes.length 
      : 0;
    
    const maxValidationTime = this.metrics.validationTimes.length > 0 
      ? Math.max(...this.metrics.validationTimes) 
      : 0;
    
    const memoryGrowth = this.metrics.memorySnapshots.length > 1 
      ? (this.metrics.memorySnapshots[this.metrics.memorySnapshots.length - 1] - this.metrics.memorySnapshots[0]) / 1024 / 1024
      : 0;
    
    const total = this.metrics.successCount + this.metrics.errorCount;
    const successRate = total > 0 ? this.metrics.successCount / total : 0;
    const errorRate = total > 0 ? this.metrics.errorCount / total : 0;

    return {
      avgDetectionTime,
      maxDetectionTime,
      avgValidationTime,
      maxValidationTime,
      memoryGrowth,
      successRate,
      errorRate
    };
  }

  reset(): void {
    this.metrics = {
      detectionTimes: [],
      validationTimes: [],
      memorySnapshots: [],
      errorCount: 0,
      successCount: 0
    };
  }
}

// Export singleton instance
export const testMetrics = new TestMetricsCollector();