/**
 * Load Generator Infrastructure
 * Generates realistic load patterns and traffic for performance testing
 */

import { EventEmitter } from 'events';
import { testDataFactory, TestDataFactory } from '../data/test-data-factory';

export interface LoadPattern {
  name: string;
  frequency: number; // requests per second
  duration: number; // milliseconds
  rampUp: number; // milliseconds
  rampDown: number; // milliseconds
  distribution: 'constant' | 'poisson' | 'burst' | 'realistic';
}

export interface LoadResult {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageLatency: number;
  p95Latency: number;
  p99Latency: number;
  throughput: number;
  errorRate: number;
  startTime: Date;
  endTime: Date;
  duration: number;
}

export interface TrafficGenerationConfig {
  userBehavior: {
    sessionDuration: { min: number; max: number };
    operationsPerSession: { min: number; max: number };
    thinkTime: { min: number; max: number };
    abandonmentRate: number;
  };
  dataVariation: {
    marketVolatility: 'low' | 'medium' | 'high';
    sentimentVolatility: 'low' | 'medium' | 'high';
    userDistribution: 'global' | 'regional' | 'local';
    assetDistribution: 'realistic' | 'uniform' | 'concentrated';
  };
  timePatterns: {
    enablePeakHours: boolean;
    peakMultiplier: number;
    peakHours: number[]; // UTC hours
    seasonality: boolean;
    weekendReduction: number;
  };
}

export class LoadGenerator extends EventEmitter {
  private dataFactory: TestDataFactory;
  private activeGenerators: Map<string, NodeJS.Timeout>;
  private metrics: Map<string, any[]>;

  constructor() {
    super();
    this.dataFactory = testDataFactory;
    this.activeGenerators = new Map();
    this.metrics = new Map();
  }

  // ========================================
  // CORE LOAD GENERATION
  // ========================================

  async executeLoad<T>(
    pattern: LoadPattern,
    operation: (data: T) => Promise<any>,
    testData: T[]
  ): Promise<LoadResult> {
    const startTime = Date.now();
    const results: { success: boolean; latency: number; timestamp: number }[] = [];
    
    this.emit('load_started', { pattern: pattern.name, startTime: new Date() });

    // Ramp up phase
    if (pattern.rampUp > 0) {
      await this.executeRampUp(pattern, operation, testData, results);
    }

    // Main load phase
    await this.executeMainLoad(pattern, operation, testData, results);

    // Ramp down phase
    if (pattern.rampDown > 0) {
      await this.executeRampDown(pattern, operation, testData, results);
    }

    const endTime = Date.now();
    const loadResult = this.calculateLoadResult(results, startTime, endTime);

    this.emit('load_completed', { pattern: pattern.name, result: loadResult });
    return loadResult;
  }

  private async executeRampUp<T>(
    pattern: LoadPattern,
    operation: (data: T) => Promise<any>,
    testData: T[],
    results: { success: boolean; latency: number; timestamp: number }[]
  ): Promise<void> {
    const steps = 10;
    const stepDuration = pattern.rampUp / steps;
    
    for (let step = 1; step <= steps; step++) {
      const currentFrequency = (pattern.frequency * step) / steps;
      const stepResults: { success: boolean; latency: number; timestamp: number }[] = [];
      
      await this.executeConstantLoad(
        currentFrequency,
        stepDuration,
        operation,
        testData,
        stepResults
      );
      
      results.push(...stepResults);
    }
  }

  private async executeMainLoad<T>(
    pattern: LoadPattern,
    operation: (data: T) => Promise<any>,
    testData: T[],
    results: { success: boolean; latency: number; timestamp: number }[]
  ): Promise<void> {
    const mainResults: { success: boolean; latency: number; timestamp: number }[] = [];
    
    switch (pattern.distribution) {
      case 'constant':
        await this.executeConstantLoad(pattern.frequency, pattern.duration, operation, testData, mainResults);
        break;
      case 'poisson':
        await this.executePoissonLoad(pattern.frequency, pattern.duration, operation, testData, mainResults);
        break;
      case 'burst':
        await this.executeBurstLoad(pattern.frequency, pattern.duration, operation, testData, mainResults);
        break;
      case 'realistic':
        await this.executeRealisticLoad(pattern.frequency, pattern.duration, operation, testData, mainResults);
        break;
    }
    
    results.push(...mainResults);
  }

  private async executeRampDown<T>(
    pattern: LoadPattern,
    operation: (data: T) => Promise<any>,
    testData: T[],
    results: { success: boolean; latency: number; timestamp: number }[]
  ): Promise<void> {
    const steps = 10;
    const stepDuration = pattern.rampDown / steps;
    
    for (let step = steps; step >= 1; step--) {
      const currentFrequency = (pattern.frequency * step) / steps;
      const stepResults: { success: boolean; latency: number; timestamp: number }[] = [];
      
      await this.executeConstantLoad(
        currentFrequency,
        stepDuration,
        operation,
        testData,
        stepResults
      );
      
      results.push(...stepResults);
    }
  }

  // ========================================
  // LOAD DISTRIBUTION PATTERNS
  // ========================================

  private async executeConstantLoad<T>(
    frequency: number,
    duration: number,
    operation: (data: T) => Promise<any>,
    testData: T[],
    results: { success: boolean; latency: number; timestamp: number }[]
  ): Promise<void> {
    const interval = 1000 / frequency; // milliseconds between requests
    const endTime = Date.now() + duration;
    let dataIndex = 0;

    while (Date.now() < endTime) {
      const requestStartTime = Date.now();
      const data = testData[dataIndex % testData.length];
      dataIndex++;

      try {
        await operation(data);
        const latency = Date.now() - requestStartTime;
        results.push({ success: true, latency, timestamp: requestStartTime });
      } catch (error) {
        const latency = Date.now() - requestStartTime;
        results.push({ success: false, latency, timestamp: requestStartTime });
      }

      // Wait for next request
      const nextRequestTime = requestStartTime + interval;
      const waitTime = Math.max(0, nextRequestTime - Date.now());
      if (waitTime > 0) {
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }

  private async executePoissonLoad<T>(
    averageFrequency: number,
    duration: number,
    operation: (data: T) => Promise<any>,
    testData: T[],
    results: { success: boolean; latency: number; timestamp: number }[]
  ): Promise<void> {
    const endTime = Date.now() + duration;
    let dataIndex = 0;

    while (Date.now() < endTime) {
      // Generate Poisson-distributed interval
      const lambda = 1 / (1000 / averageFrequency); // Convert to per-millisecond rate
      const interval = -Math.log(Math.random()) / lambda;

      const requestStartTime = Date.now();
      const data = testData[dataIndex % testData.length];
      dataIndex++;

      try {
        await operation(data);
        const latency = Date.now() - requestStartTime;
        results.push({ success: true, latency, timestamp: requestStartTime });
      } catch (error) {
        const latency = Date.now() - requestStartTime;
        results.push({ success: false, latency, timestamp: requestStartTime });
      }

      // Wait for next request
      await new Promise(resolve => setTimeout(resolve, interval));
    }
  }

  private async executeBurstLoad<T>(
    frequency: number,
    duration: number,
    operation: (data: T) => Promise<any>,
    testData: T[],
    results: { success: boolean; latency: number; timestamp: number }[]
  ): Promise<void> {
    const burstDuration = 1000; // 1 second bursts
    const quietDuration = 4000; // 4 seconds quiet
    const endTime = Date.now() + duration;
    let dataIndex = 0;

    while (Date.now() < endTime) {
      // Burst phase
      const burstEndTime = Math.min(Date.now() + burstDuration, endTime);
      while (Date.now() < burstEndTime) {
        const requestStartTime = Date.now();
        const data = testData[dataIndex % testData.length];
        dataIndex++;

        try {
          await operation(data);
          const latency = Date.now() - requestStartTime;
          results.push({ success: true, latency, timestamp: requestStartTime });
        } catch (error) {
          const latency = Date.now() - requestStartTime;
          results.push({ success: false, latency, timestamp: requestStartTime });
        }

        // High frequency during burst
        await new Promise(resolve => setTimeout(resolve, 1000 / (frequency * 5)));
      }

      // Quiet phase
      if (Date.now() < endTime) {
        await new Promise(resolve => setTimeout(resolve, Math.min(quietDuration, endTime - Date.now())));
      }
    }
  }

  private async executeRealisticLoad<T>(
    baseFrequency: number,
    duration: number,
    operation: (data: T) => Promise<any>,
    testData: T[],
    results: { success: boolean; latency: number; timestamp: number }[]
  ): Promise<void> {
    const endTime = Date.now() + duration;
    let dataIndex = 0;

    while (Date.now() < endTime) {
      // Apply realistic variations
      const currentHour = new Date().getUTCHours();
      const peakMultiplier = this.getPeakHourMultiplier(currentHour);
      const randomVariation = 0.8 + Math.random() * 0.4; // ±20% random variation
      
      const currentFrequency = baseFrequency * peakMultiplier * randomVariation;
      const interval = Math.max(10, 1000 / currentFrequency); // Minimum 10ms between requests

      const requestStartTime = Date.now();
      const data = testData[dataIndex % testData.length];
      dataIndex++;

      try {
        await operation(data);
        const latency = Date.now() - requestStartTime;
        results.push({ success: true, latency, timestamp: requestStartTime });
      } catch (error) {
        const latency = Date.now() - requestStartTime;
        results.push({ success: false, latency, timestamp: requestStartTime });
      }

      // Wait for next request
      await new Promise(resolve => setTimeout(resolve, interval));
    }
  }

  // ========================================
  // SPECIALIZED DATA GENERATORS
  // ========================================

  generatePriceUpdates(count: number, options: any = {}): any[] {
    return this.dataFactory.generateBatchData(
      (opts) => this.dataFactory.createPriceData(opts),
      count,
      options
    );
  }

  generateSocialMediaPosts(count: number, options: any = {}): any[] {
    return this.dataFactory.generateBatchData(
      (opts) => this.dataFactory.createSocialMediaPost(opts),
      count,
      options
    );
  }

  generatePortfolio(assetCount: number, options: any = {}): any {
    const assets = this.dataFactory.generateBatchData(
      () => ({
        symbol: Math.random() > 0.5 ? 'BTC' : 'ETH',
        allocation: Math.random() * 0.3,
        ...options
      }),
      assetCount
    );

    return {
      assets,
      totalValue: options.totalValue || 100000,
      riskProfile: options.riskProfile || 'moderate',
      ...options
    };
  }

  generateTradingStrategies(count: number, options: any = {}): any[] {
    return Array(count).fill(null).map((_, index) => ({
      id: `strategy_${index}`,
      name: `Strategy ${index + 1}`,
      type: ['momentum', 'mean_reversion', 'arbitrage'][index % 3],
      parameters: {
        lookback: 20 + Math.random() * 40,
        threshold: 0.05 + Math.random() * 0.1,
        ...options.parameters
      },
      ...options
    }));
  }

  generateRWAAssets(count: number, options: any = {}): any[] {
    return this.dataFactory.generateBatchData(
      (opts) => this.dataFactory.createRWAAsset(opts),
      count,
      options
    );
  }

  generateAuditEvents(count: number, options: any = {}): any[] {
    return this.dataFactory.generateBatchData(
      (opts) => this.dataFactory.createAuditEvent(opts),
      count,
      options
    );
  }

  generateSecurityAlerts(count: number, options: any = {}): any[] {
    return this.dataFactory.generateBatchData(
      (opts) => this.dataFactory.createSecurityThreat(opts),
      count,
      options
    );
  }

  generateThreatStream(config: any): any[] {
    const totalThreats = (config.threatsPerSecond * config.streamDuration) / 1000;
    return this.dataFactory.generateTimeSeriesData(
      (opts) => this.dataFactory.createSecurityThreat(opts),
      totalThreats,
      new Date(),
      new Date(Date.now() + config.streamDuration)
    );
  }

  generateTradeOrders(count: number, options: any = {}): any[] {
    return this.dataFactory.generateBatchData(
      (opts) => this.dataFactory.createTradeOrder(opts),
      count,
      options
    );
  }

  generateBlockchainTransactions(count: number, options: any = {}): any[] {
    return Array(count).fill(null).map(() => ({
      id: `tx_${Math.random().toString(36).substr(2, 9)}`,
      chain: options.chains ? options.chains[Math.floor(Math.random() * options.chains.length)] : 'ethereum',
      type: options.transactionTypes ? options.transactionTypes[Math.floor(Math.random() * options.transactionTypes.length)] : 'transfer',
      complexity: options.complexityLevels ? options.complexityLevels[Math.floor(Math.random() * options.complexityLevels.length)] : 'simple',
      gasEstimate: 21000 + Math.random() * 200000,
      ...options
    }));
  }

  generateLiquidityOperations(count: number, options: any = {}): any[] {
    return Array(count).fill(null).map(() => ({
      id: `liq_op_${Math.random().toString(36).substr(2, 9)}`,
      type: options.operationTypes ? options.operationTypes[Math.floor(Math.random() * options.operationTypes.length)] : 'add',
      pool: options.poolTypes ? options.poolTypes[Math.floor(Math.random() * options.poolTypes.length)] : 'uniswap_v3',
      size: options.sizeRange ? options.sizeRange[0] + Math.random() * (options.sizeRange[1] - options.sizeRange[0]) : 10000,
      ...options
    }));
  }

  generateCrossChainTransactions(count: number, options: any = {}): any[] {
    return this.dataFactory.generateBatchData(
      (opts) => this.dataFactory.createCrossChainTransaction(opts),
      count,
      options
    );
  }

  generateRoutingRequests(count: number, options: any = {}): any[] {
    return Array(count).fill(null).map(() => ({
      id: `route_req_${Math.random().toString(36).substr(2, 9)}`,
      sourceChain: options.sourceChains ? options.sourceChains[Math.floor(Math.random() * options.sourceChains.length)] : 'ethereum',
      destinationChain: options.destinationChains ? options.destinationChains[Math.floor(Math.random() * options.destinationChains.length)] : 'polygon',
      optimizationCriteria: options.optimizationCriteria ? options.optimizationCriteria[Math.floor(Math.random() * options.optimizationCriteria.length)] : 'cost',
      amount: 1 + Math.random() * 1000,
      ...options
    }));
  }

  generateCoordinatedOperations(count: number, options: any = {}): any[] {
    return Array(count).fill(null).map((_, index) => ({
      id: `coord_op_${index}`,
      type: options.operationTypes ? options.operationTypes[Math.floor(Math.random() * options.operationTypes.length)] : 'yield_optimization',
      satellites: options.satelliteChains ? options.satelliteChains[Math.floor(Math.random() * options.satelliteChains.length)] : ['oracle', 'echo', 'pulse'],
      priority: ['low', 'medium', 'high'][Math.floor(Math.random() * 3)],
      complexity: ['simple', 'moderate', 'complex'][Math.floor(Math.random() * 3)],
      ...options
    }));
  }

  generateInterSatelliteMessages(count: number, options: any = {}): any[] {
    return Array(count).fill(null).map((_, index) => ({
      id: `msg_${index}`,
      type: options.messageTypes ? options.messageTypes[Math.floor(Math.random() * options.messageTypes.length)] : 'data_update',
      priority: options.priorityDistribution ? this.sampleFromDistribution(options.priorityDistribution) : 'medium',
      size: options.sizeDistribution === 'realistic' ? this.getRealisticMessageSize() : 1024,
      source: `satellite_${Math.floor(Math.random() * 7)}`,
      target: `satellite_${Math.floor(Math.random() * 7)}`,
      timestamp: new Date(),
      ...options
    }));
  }

  generateCryptoTexts(count: number, options: any = {}): string[] {
    const entityDensities = {
      low: 2,
      medium: 5,
      high: 10
    };

    const textLengths = {
      short: 50,
      medium: 150,
      long: 300
    };

    const entityCount = entityDensities[options.entityDensity as keyof typeof entityDensities] || 5;
    const textLength = textLengths[options.textLength as keyof typeof textLengths] || 150;

    return Array(count).fill(null).map(() => {
      let text = this.dataFactory['generateCryptoSentimentText']();
      
      // Extend text to desired length
      while (text.length < textLength) {
        text += ' ' + this.dataFactory['generateCryptoSentimentText']();
      }

      // Add entities
      for (let i = 0; i < entityCount; i++) {
        const symbols = ['BTC', 'ETH', 'USDC', 'LINK', 'UNI'];
        const symbol = symbols[Math.floor(Math.random() * symbols.length)];
        text = text.replace(/\b(crypto|token|coin)\b/i, symbol);
      }

      return text.substring(0, textLength);
    });
  }

  // ========================================
  // STREAMING AND REAL-TIME GENERATORS
  // ========================================

  async simulateRealTimeStream(config: any, processor: (batch: any[]) => Promise<void>): Promise<any> {
    const results = {
      processedMessages: 0,
      bufferOverflows: 0,
      averageBatchLatency: 0,
      totalLatency: 0,
      batchCount: 0
    };

    const buffer: any[] = [];
    const endTime = Date.now() + config.streamDuration;

    // Message generation
    const messageInterval = 1000 / config.postsPerSecond;
    const messageGenerator = setInterval(() => {
      if (Date.now() >= endTime) {
        clearInterval(messageGenerator);
        return;
      }

      const platforms = config.platforms || ['twitter', 'discord'];
      const platform = platforms[Math.floor(Math.random() * platforms.length)];
      
      const message = this.dataFactory.createSocialMediaPost({ platform });
      
      if (buffer.length >= config.bufferSize) {
        results.bufferOverflows++;
      } else {
        buffer.push(message);
      }
    }, messageInterval);

    // Batch processing
    const batchProcessor = setInterval(async () => {
      if (buffer.length === 0) return;

      const batch = buffer.splice(0, config.bufferSize);
      const batchStartTime = Date.now();

      try {
        await processor(batch);
        const batchLatency = Date.now() - batchStartTime;
        
        results.processedMessages += batch.length;
        results.totalLatency += batchLatency;
        results.batchCount++;
      } catch (error) {
        // Handle batch processing errors
      }
    }, 1000); // Process batches every second

    // Wait for stream to complete
    await new Promise(resolve => setTimeout(resolve, config.streamDuration + 1000));

    clearInterval(messageGenerator);
    clearInterval(batchProcessor);

    // Process remaining messages
    if (buffer.length > 0) {
      await processor(buffer);
      results.processedMessages += buffer.length;
    }

    results.averageBatchLatency = results.batchCount > 0 ? results.totalLatency / results.batchCount : 0;

    return results;
  }

  async processStream(
    stream: any[],
    processor: (items: any[]) => Promise<void>,
    config: { batchSize: number; maxLatency: number }
  ): Promise<any> {
    const results = {
      totalProcessed: 0,
      averageLatency: 0,
      throughput: 0,
      errors: 0
    };

    const startTime = Date.now();
    const latencies: number[] = [];

    // Process stream in batches
    for (let i = 0; i < stream.length; i += config.batchSize) {
      const batch = stream.slice(i, i + config.batchSize);
      const batchStartTime = Date.now();

      try {
        await processor(batch);
        const latency = Date.now() - batchStartTime;
        latencies.push(latency);
        results.totalProcessed += batch.length;
      } catch (error) {
        results.errors++;
      }
    }

    const totalTime = Date.now() - startTime;
    results.averageLatency = latencies.reduce((sum, l) => sum + l, 0) / latencies.length;
    results.throughput = (results.totalProcessed / totalTime) * 1000; // per second

    return results;
  }

  // ========================================
  // UTILITY METHODS
  // ========================================

  private calculateLoadResult(
    results: { success: boolean; latency: number; timestamp: number }[],
    startTime: number,
    endTime: number
  ): LoadResult {
    const totalRequests = results.length;
    const successfulRequests = results.filter(r => r.success).length;
    const failedRequests = totalRequests - successfulRequests;

    const latencies = results.map(r => r.latency).sort((a, b) => a - b);
    const averageLatency = latencies.reduce((sum, l) => sum + l, 0) / latencies.length;
    const p95Index = Math.floor(latencies.length * 0.95);
    const p99Index = Math.floor(latencies.length * 0.99);
    const p95Latency = latencies[p95Index] || 0;
    const p99Latency = latencies[p99Index] || 0;

    const duration = endTime - startTime;
    const throughput = (totalRequests / duration) * 1000; // requests per second
    const errorRate = failedRequests / totalRequests;

    return {
      totalRequests,
      successfulRequests,
      failedRequests,
      averageLatency,
      p95Latency,
      p99Latency,
      throughput,
      errorRate,
      startTime: new Date(startTime),
      endTime: new Date(endTime),
      duration
    };
  }

  private getPeakHourMultiplier(hour: number): number {
    // Typical DeFi/crypto peak hours (UTC)
    const peakHours = [9, 10, 14, 15, 20, 21]; // Market open/close times
    const isPeakHour = peakHours.includes(hour);
    return isPeakHour ? 2.5 : 1.0;
  }

  private sampleFromDistribution(distribution: Record<string, number>): string {
    const random = Math.random();
    let cumulative = 0;

    for (const [key, probability] of Object.entries(distribution)) {
      cumulative += probability;
      if (random <= cumulative) {
        return key;
      }
    }

    return Object.keys(distribution)[0]; // fallback
  }

  private getRealisticMessageSize(): number {
    // Realistic message size distribution for satellite communication
    const sizes = [
      { size: 512, probability: 0.4 },    // Small messages
      { size: 2048, probability: 0.3 },   // Medium messages
      { size: 8192, probability: 0.2 },   // Large messages
      { size: 32768, probability: 0.1 }   // Very large messages
    ];

    const random = Math.random();
    let cumulative = 0;

    for (const { size, probability } of sizes) {
      cumulative += probability;
      if (random <= cumulative) {
        return size;
      }
    }

    return 1024; // fallback
  }

  // ========================================
  // ARRAY UTILITIES
  // ========================================

  chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  // ========================================
  // CLEANUP
  // ========================================

  stopAllGenerators(): void {
    for (const [name, timer] of this.activeGenerators.entries()) {
      clearInterval(timer);
      this.activeGenerators.delete(name);
    }
  }

  getMetrics(): Map<string, any[]> {
    return new Map(this.metrics);
  }

  clearMetrics(): void {
    this.metrics.clear();
  }
}

export const loadGenerator = new LoadGenerator();