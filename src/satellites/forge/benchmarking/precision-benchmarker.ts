import { performance } from 'perf_hooks';
import { Worker } from 'worker_threads';

export interface BenchmarkMetrics {
  executionTime: number; // microseconds
  cpuUsage: number; // percentage
  memoryUsage: number; // bytes
  networkLatency: number; // microseconds
  gasEstimationTime: number; // microseconds
  transactionBuildTime: number; // microseconds
  signatureTime: number; // microseconds
  broadcastTime: number; // microseconds
  confirmationTime: number; // microseconds
  totalLatency: number; // microseconds
}

export interface BenchmarkResult {
  testName: string;
  iterations: number;
  metrics: BenchmarkMetrics;
  statistics: {
    min: number;
    max: number;
    mean: number;
    median: number;
    p95: number;
    p99: number;
    stdDev: number;
  };
  timestamp: number;
  environment: BenchmarkEnvironment;
}

export interface BenchmarkEnvironment {
  nodeVersion: string;
  platform: string;
  cpuModel: string;
  cpuCores: number;
  totalMemory: number;
  networkProvider: string;
  chainId: number;
  blockNumber: number;
}

export interface BenchmarkConfig {
  iterations: number;
  warmupIterations: number;
  timeoutMs: number;
  precisionLevel: 'nanosecond' | 'microsecond' | 'millisecond';
  enableCpuProfiling: boolean;
  enableMemoryProfiling: boolean;
  enableNetworkProfiling: boolean;
  parallelExecution: boolean;
  workerThreads: number;
}

export interface PerformanceProfiler {
  startProfile(name: string): void;
  endProfile(name: string): number;
  getMetrics(): Map<string, number[]>;
  reset(): void;
}

export class MicrosecondPrecisionBenchmarker {
  private config: BenchmarkConfig;
  private profiler: PerformanceProfiler;
  private environment: BenchmarkEnvironment;
  private results: Map<string, BenchmarkResult[]> = new Map();

  constructor(config: Partial<BenchmarkConfig> = {}) {
    this.config = {
      iterations: 1000,
      warmupIterations: 100,
      timeoutMs: 30000,
      precisionLevel: 'microsecond',
      enableCpuProfiling: true,
      enableMemoryProfiling: true,
      enableNetworkProfiling: true,
      parallelExecution: false,
      workerThreads: 4,
      ...config
    };

    this.profiler = new HighPrecisionProfiler(this.config.precisionLevel);
    this.environment = this.detectEnvironment();
  }

  /**
   * Benchmark gas estimation performance
   */
  async benchmarkGasEstimation(
    estimationFunction: () => Promise<any>,
    testName: string = 'gas-estimation'
  ): Promise<BenchmarkResult> {
    console.log(`🔬 Benchmarking ${testName} with ${this.config.iterations} iterations...`);

    const measurements: number[] = [];
    const metrics: BenchmarkMetrics[] = [];

    // Warmup
    await this.runWarmup(estimationFunction);

    // Main benchmark
    for (let i = 0; i < this.config.iterations; i++) {
      const startTime = this.getHighPrecisionTime();
      const startMemory = process.memoryUsage();
      const startCpu = process.cpuUsage();

      try {
        this.profiler.startProfile('gas-estimation');
        await estimationFunction();
        const executionTime = this.profiler.endProfile('gas-estimation');

        const endTime = this.getHighPrecisionTime();
        const endMemory = process.memoryUsage();
        const endCpu = process.cpuUsage(startCpu);

        const totalTime = endTime - startTime;
        measurements.push(totalTime);

        metrics.push({
          executionTime,
          cpuUsage: (endCpu.user + endCpu.system) / 1000, // Convert to percentage
          memoryUsage: endMemory.heapUsed - startMemory.heapUsed,
          networkLatency: await this.measureNetworkLatency(),
          gasEstimationTime: executionTime,
          transactionBuildTime: 0,
          signatureTime: 0,
          broadcastTime: 0,
          confirmationTime: 0,
          totalLatency: totalTime
        });
      } catch (error) {
        console.error(`Iteration ${i} failed:`, error);
      }
    }

    return this.generateBenchmarkResult(testName, measurements, metrics);
  }

  /**
   * Benchmark transaction building performance
   */
  async benchmarkTransactionBuilding(
    buildFunction: () => Promise<any>,
    testName: string = 'transaction-building'
  ): Promise<BenchmarkResult> {
    console.log(`🏗️ Benchmarking ${testName}...`);

    const measurements: number[] = [];
    const metrics: BenchmarkMetrics[] = [];

    await this.runWarmup(buildFunction);

    for (let i = 0; i < this.config.iterations; i++) {
      const startTime = this.getHighPrecisionTime();
      
      this.profiler.startProfile('transaction-build');
      await buildFunction();
      const buildTime = this.profiler.endProfile('transaction-build');
      
      const endTime = this.getHighPrecisionTime();
      const totalTime = endTime - startTime;
      measurements.push(totalTime);

      metrics.push({
        executionTime: totalTime,
        cpuUsage: 0,
        memoryUsage: 0,
        networkLatency: 0,
        gasEstimationTime: 0,
        transactionBuildTime: buildTime,
        signatureTime: 0,
        broadcastTime: 0,
        confirmationTime: 0,
        totalLatency: totalTime
      });
    }

    return this.generateBenchmarkResult(testName, measurements, metrics);
  }

  /**
   * Benchmark signing performance
   */
  async benchmarkSigning(
    signFunction: () => Promise<any>,
    testName: string = 'transaction-signing'
  ): Promise<BenchmarkResult> {
    console.log(`✍️ Benchmarking ${testName}...`);

    const measurements: number[] = [];
    const metrics: BenchmarkMetrics[] = [];

    await this.runWarmup(signFunction);

    for (let i = 0; i < this.config.iterations; i++) {
      const startTime = this.getHighPrecisionTime();
      
      this.profiler.startProfile('signing');
      await signFunction();
      const signingTime = this.profiler.endProfile('signing');
      
      const endTime = this.getHighPrecisionTime();
      const totalTime = endTime - startTime;
      measurements.push(totalTime);

      metrics.push({
        executionTime: totalTime,
        cpuUsage: 0,
        memoryUsage: 0,
        networkLatency: 0,
        gasEstimationTime: 0,
        transactionBuildTime: 0,
        signatureTime: signingTime,
        broadcastTime: 0,
        confirmationTime: 0,
        totalLatency: totalTime
      });
    }

    return this.generateBenchmarkResult(testName, measurements, metrics);
  }

  /**
   * Benchmark end-to-end transaction performance
   */
  async benchmarkEndToEnd(
    e2eFunction: () => Promise<{
      gasEstimation: number;
      building: number;
      signing: number;
      broadcast: number;
      confirmation: number;
    }>,
    testName: string = 'e2e-transaction'
  ): Promise<BenchmarkResult> {
    console.log(`🔄 Benchmarking ${testName} end-to-end...`);

    const measurements: number[] = [];
    const metrics: BenchmarkMetrics[] = [];

    await this.runWarmup(async () => {
      try {
        await e2eFunction();
      } catch {
        // Ignore warmup failures
      }
    });

    for (let i = 0; i < this.config.iterations; i++) {
      const startTime = this.getHighPrecisionTime();
      const startMemory = process.memoryUsage();
      const startCpu = process.cpuUsage();

      try {
        const timings = await e2eFunction();
        
        const endTime = this.getHighPrecisionTime();
        const endMemory = process.memoryUsage();
        const endCpu = process.cpuUsage(startCpu);

        const totalTime = endTime - startTime;
        measurements.push(totalTime);

        metrics.push({
          executionTime: totalTime,
          cpuUsage: (endCpu.user + endCpu.system) / 1000,
          memoryUsage: endMemory.heapUsed - startMemory.heapUsed,
          networkLatency: await this.measureNetworkLatency(),
          gasEstimationTime: timings.gasEstimation,
          transactionBuildTime: timings.building,
          signatureTime: timings.signing,
          broadcastTime: timings.broadcast,
          confirmationTime: timings.confirmation,
          totalLatency: totalTime
        });
      } catch (error) {
        console.error(`E2E iteration ${i} failed:`, error);
      }

      // Add delay between iterations to avoid rate limiting
      if (i < this.config.iterations - 1) {
        await this.sleep(10); // 10ms delay
      }
    }

    return this.generateBenchmarkResult(testName, measurements, metrics);
  }

  /**
   * Benchmark MEV protection overhead
   */
  async benchmarkMEVProtection(
    normalFunction: () => Promise<any>,
    protectedFunction: () => Promise<any>,
    testName: string = 'mev-protection-overhead'
  ): Promise<{
    normal: BenchmarkResult;
    protected: BenchmarkResult;
    overhead: {
      timeOverhead: number; // microseconds
      percentageOverhead: number; // percentage
    };
  }> {
    console.log(`🛡️ Benchmarking MEV protection overhead...`);

    const normalResult = await this.benchmarkGasEstimation(normalFunction, `${testName}-normal`);
    const protectedResult = await this.benchmarkGasEstimation(protectedFunction, `${testName}-protected`);

    const timeOverhead = protectedResult.statistics.mean - normalResult.statistics.mean;
    const percentageOverhead = (timeOverhead / normalResult.statistics.mean) * 100;

    return {
      normal: normalResult,
      protected: protectedResult,
      overhead: {
        timeOverhead,
        percentageOverhead
      }
    };
  }

  /**
   * Benchmark cross-chain bridge performance
   */
  async benchmarkCrossChainBridge(
    bridgeFunction: () => Promise<{
      routeCalculation: number;
      bridgeExecution: number;
      confirmation: number;
    }>,
    testName: string = 'cross-chain-bridge'
  ): Promise<BenchmarkResult> {
    console.log(`🌉 Benchmarking cross-chain bridge performance...`);

    const measurements: number[] = [];
    const metrics: BenchmarkMetrics[] = [];

    // Fewer iterations for cross-chain due to time constraints
    const iterations = Math.min(this.config.iterations, 50);

    for (let i = 0; i < iterations; i++) {
      const startTime = this.getHighPrecisionTime();

      try {
        const timings = await bridgeFunction();
        
        const endTime = this.getHighPrecisionTime();
        const totalTime = endTime - startTime;
        measurements.push(totalTime);

        metrics.push({
          executionTime: totalTime,
          cpuUsage: 0,
          memoryUsage: 0,
          networkLatency: await this.measureNetworkLatency(),
          gasEstimationTime: timings.routeCalculation,
          transactionBuildTime: 0,
          signatureTime: 0,
          broadcastTime: timings.bridgeExecution,
          confirmationTime: timings.confirmation,
          totalLatency: totalTime
        });
      } catch (error) {
        console.error(`Bridge iteration ${i} failed:`, error);
      }

      // Longer delay for cross-chain operations
      if (i < iterations - 1) {
        await this.sleep(1000); // 1 second delay
      }
    }

    return this.generateBenchmarkResult(testName, measurements, metrics);
  }

  /**
   * Generate comprehensive performance report
   */
  async generatePerformanceReport(): Promise<{
    summary: {
      totalTests: number;
      fastestOperation: { name: string; time: number };
      slowestOperation: { name: string; time: number };
      averageLatency: number;
      performanceGrade: string;
    };
    results: BenchmarkResult[];
    recommendations: string[];
  }> {
    const allResults = Array.from(this.results.values()).flat();
    
    if (allResults.length === 0) {
      throw new Error('No benchmark results available');
    }

    let fastest = allResults[0];
    let slowest = allResults[0];
    let totalLatency = 0;

    for (const result of allResults) {
      if (result.statistics.mean < fastest.statistics.mean) {
        fastest = result;
      }
      if (result.statistics.mean > slowest.statistics.mean) {
        slowest = result;
      }
      totalLatency += result.statistics.mean;
    }

    const averageLatency = totalLatency / allResults.length;
    const performanceGrade = this.calculatePerformanceGrade(averageLatency);
    const recommendations = this.generateRecommendations(allResults);

    return {
      summary: {
        totalTests: allResults.length,
        fastestOperation: { name: fastest.testName, time: fastest.statistics.mean },
        slowestOperation: { name: slowest.testName, time: slowest.statistics.mean },
        averageLatency,
        performanceGrade
      },
      results: allResults,
      recommendations
    };
  }

  /**
   * Compare benchmark results
   */
  compareResults(
    baseline: BenchmarkResult,
    current: BenchmarkResult
  ): {
    improvement: number; // percentage
    regression: boolean;
    significantChange: boolean;
    details: {
      meanChange: number;
      p95Change: number;
      p99Change: number;
    };
  } {
    const meanChange = ((current.statistics.mean - baseline.statistics.mean) / baseline.statistics.mean) * 100;
    const p95Change = ((current.statistics.p95 - baseline.statistics.p95) / baseline.statistics.p95) * 100;
    const p99Change = ((current.statistics.p99 - baseline.statistics.p99) / baseline.statistics.p99) * 100;

    const improvement = -meanChange; // Negative change is improvement (lower latency)
    const regression = meanChange > 5; // > 5% increase is regression
    const significantChange = Math.abs(meanChange) > 2; // > 2% change is significant

    return {
      improvement,
      regression,
      significantChange,
      details: {
        meanChange,
        p95Change,
        p99Change
      }
    };
  }

  /**
   * Export results to JSON
   */
  exportResults(): string {
    const allResults = Array.from(this.results.entries()).reduce((acc, [key, results]) => {
      acc[key] = results;
      return acc;
    }, {} as Record<string, BenchmarkResult[]>);

    return JSON.stringify({
      timestamp: Date.now(),
      environment: this.environment,
      config: this.config,
      results: allResults
    }, null, 2);
  }

  private async runWarmup(func: () => Promise<any>): Promise<void> {
    console.log(`🔥 Running ${this.config.warmupIterations} warmup iterations...`);
    
    for (let i = 0; i < this.config.warmupIterations; i++) {
      try {
        await func();
      } catch {
        // Ignore warmup failures
      }
    }
  }

  private getHighPrecisionTime(): number {
    switch (this.config.precisionLevel) {
      case 'nanosecond':
        const hrTime = process.hrtime.bigint();
        return Number(hrTime) / 1000; // Convert to microseconds
      case 'microsecond':
        return performance.now() * 1000; // Convert to microseconds
      case 'millisecond':
        return performance.now();
      default:
        return performance.now() * 1000;
    }
  }

  private async measureNetworkLatency(): Promise<number> {
    if (!this.config.enableNetworkProfiling) return 0;

    const start = this.getHighPrecisionTime();
    
    try {
      // Simple network ping (would be replaced with actual RPC call)
      await new Promise(resolve => setTimeout(resolve, 1));
      const end = this.getHighPrecisionTime();
      return end - start;
    } catch {
      return 0;
    }
  }

  private generateBenchmarkResult(
    testName: string,
    measurements: number[],
    metrics: BenchmarkMetrics[]
  ): BenchmarkResult {
    if (measurements.length === 0) {
      throw new Error(`No valid measurements for test: ${testName}`);
    }

    const sorted = [...measurements].sort((a, b) => a - b);
    const sum = measurements.reduce((a, b) => a + b, 0);
    const mean = sum / measurements.length;
    const variance = measurements.reduce((sum, x) => sum + Math.pow(x - mean, 2), 0) / measurements.length;
    const stdDev = Math.sqrt(variance);

    const statistics = {
      min: sorted[0],
      max: sorted[sorted.length - 1],
      mean,
      median: sorted[Math.floor(sorted.length / 2)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)],
      stdDev
    };

    // Average metrics
    const avgMetrics: BenchmarkMetrics = {
      executionTime: mean,
      cpuUsage: metrics.reduce((sum, m) => sum + m.cpuUsage, 0) / metrics.length,
      memoryUsage: metrics.reduce((sum, m) => sum + m.memoryUsage, 0) / metrics.length,
      networkLatency: metrics.reduce((sum, m) => sum + m.networkLatency, 0) / metrics.length,
      gasEstimationTime: metrics.reduce((sum, m) => sum + m.gasEstimationTime, 0) / metrics.length,
      transactionBuildTime: metrics.reduce((sum, m) => sum + m.transactionBuildTime, 0) / metrics.length,
      signatureTime: metrics.reduce((sum, m) => sum + m.signatureTime, 0) / metrics.length,
      broadcastTime: metrics.reduce((sum, m) => sum + m.broadcastTime, 0) / metrics.length,
      confirmationTime: metrics.reduce((sum, m) => sum + m.confirmationTime, 0) / metrics.length,
      totalLatency: mean
    };

    const result: BenchmarkResult = {
      testName,
      iterations: measurements.length,
      metrics: avgMetrics,
      statistics,
      timestamp: Date.now(),
      environment: this.environment
    };

    // Store result
    if (!this.results.has(testName)) {
      this.results.set(testName, []);
    }
    this.results.get(testName)!.push(result);

    console.log(`✅ ${testName}: ${mean.toFixed(2)}μs avg, ${statistics.p95.toFixed(2)}μs p95`);

    return result;
  }

  private detectEnvironment(): BenchmarkEnvironment {
    const os = require('os');
    
    return {
      nodeVersion: process.version,
      platform: os.platform(),
      cpuModel: os.cpus()[0]?.model || 'Unknown',
      cpuCores: os.cpus().length,
      totalMemory: os.totalmem(),
      networkProvider: 'localhost', // Would be detected
      chainId: 1, // Would be detected
      blockNumber: 0 // Would be fetched
    };
  }

  private calculatePerformanceGrade(averageLatency: number): string {
    // Grading based on microsecond latency
    if (averageLatency < 100) return 'A+'; // < 0.1ms
    if (averageLatency < 500) return 'A';  // < 0.5ms
    if (averageLatency < 1000) return 'B'; // < 1ms
    if (averageLatency < 5000) return 'C'; // < 5ms
    if (averageLatency < 10000) return 'D'; // < 10ms
    return 'F'; // > 10ms
  }

  private generateRecommendations(results: BenchmarkResult[]): string[] {
    const recommendations: string[] = [];
    
    const avgLatency = results.reduce((sum, r) => sum + r.statistics.mean, 0) / results.length;
    
    if (avgLatency > 5000) {
      recommendations.push('Consider optimizing transaction building process - high latency detected');
    }
    
    const highVariability = results.filter(r => r.statistics.stdDev / r.statistics.mean > 0.5);
    if (highVariability.length > 0) {
      recommendations.push('High variability in performance - investigate network conditions');
    }
    
    const highMemoryUsage = results.filter(r => r.metrics.memoryUsage > 50 * 1024 * 1024); // > 50MB
    if (highMemoryUsage.length > 0) {
      recommendations.push('High memory usage detected - consider memory optimizations');
    }
    
    const slowNetworkLatency = results.filter(r => r.metrics.networkLatency > 1000); // > 1ms
    if (slowNetworkLatency.length > 0) {
      recommendations.push('High network latency - consider using faster RPC providers');
    }
    
    return recommendations;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

class HighPrecisionProfiler implements PerformanceProfiler {
  private profiles: Map<string, number> = new Map();
  private metrics: Map<string, number[]> = new Map();
  private precisionLevel: BenchmarkConfig['precisionLevel'];

  constructor(precisionLevel: BenchmarkConfig['precisionLevel']) {
    this.precisionLevel = precisionLevel;
  }

  startProfile(name: string): void {
    this.profiles.set(name, this.getCurrentTime());
  }

  endProfile(name: string): number {
    const startTime = this.profiles.get(name);
    if (!startTime) {
      throw new Error(`Profile '${name}' not started`);
    }

    const endTime = this.getCurrentTime();
    const duration = endTime - startTime;
    
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    this.metrics.get(name)!.push(duration);
    
    this.profiles.delete(name);
    return duration;
  }

  getMetrics(): Map<string, number[]> {
    return new Map(this.metrics);
  }

  reset(): void {
    this.profiles.clear();
    this.metrics.clear();
  }

  private getCurrentTime(): number {
    switch (this.precisionLevel) {
      case 'nanosecond':
        const hrTime = process.hrtime.bigint();
        return Number(hrTime) / 1000; // Convert to microseconds
      case 'microsecond':
        return performance.now() * 1000; // Convert to microseconds
      case 'millisecond':
        return performance.now();
      default:
        return performance.now() * 1000;
    }
  }
}