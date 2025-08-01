/**
 * AI Service Load Testing Suite
 * Performance testing under various load conditions
 */

import { 
  MockAIServiceClient, 
  TestConfigFactory, 
  TestDataFactory, 
  TestUtils, 
  PerformanceMonitor,
  AITestSuite
} from '../utils/test-helpers';
import { UnifiedAIClient } from '../../unified-ai-client';
import { AIProvider } from '../../types';

// Mock external dependencies
jest.mock('@/shared/logging/logger');
jest.mock('@/config/environment');

describe('AI Service Load Testing', () => {
  let testSuite: AITestSuite;
  let unifiedClient: UnifiedAIClient;
  let performanceMonitor: PerformanceMonitor;
  let mockClients: Map<AIProvider, MockAIServiceClient>;

  beforeEach(async () => {
    testSuite = new (class extends AITestSuite {})();
    await testSuite['setUp']();
    
    performanceMonitor = testSuite['performanceMonitor'];

    // Mock environment configuration
    require('@/config/environment').config = {
      openaiApiKey: 'mock-openai-key',
      anthropicApiKey: 'mock-anthropic-key',
      perplexityApiKey: 'mock-perplexity-key',
    };

    const config = TestConfigFactory.createMockUnifiedAIConfig();
    unifiedClient = new UnifiedAIClient(config);

    // Create mock clients with realistic latencies
    mockClients = new Map([
      ['openai', new MockAIServiceClient('openai', config.providers.openai!)],
      ['anthropic', new MockAIServiceClient('anthropic', config.providers.anthropic!)],
      ['perplexity', new MockAIServiceClient('perplexity', config.providers.perplexity!)],
    ]);

    // Set realistic latencies
    mockClients.get('openai')!.setLatency(150);
    mockClients.get('anthropic')!.setLatency(200);
    mockClients.get('perplexity')!.setLatency(300);

    // Replace client internals with mocks
    (unifiedClient as any).clients = mockClients;
    (unifiedClient as any).healthStatus = new Map([
      ['openai', true],
      ['anthropic', true],
      ['perplexity', true],
    ]);
  });

  afterEach(async () => {
    await testSuite['tearDown']();
    
    // Log performance summary
    const stats = performanceMonitor.getAllStats();
    if (Object.keys(stats).length > 0) {
      console.log('\n=== Performance Test Results ===');
      Object.entries(stats).forEach(([metric, data]) => {
        if (data) {
          console.log(`${metric}:`, {
            count: data.count,
            mean: `${data.mean.toFixed(2)}ms`,
            median: `${data.median.toFixed(2)}ms`,
            p95: `${data.p95.toFixed(2)}ms`,
            min: `${data.min.toFixed(2)}ms`,
            max: `${data.max.toFixed(2)}ms`,
          });
        }
      });
    }
  });

  describe('Concurrent Request Handling', () => {
    it('should handle low concurrent load (10 requests)', async () => {
      const concurrency = 10;
      const requests = Array(concurrency).fill(null).map((_, i) => 
        TestDataFactory.createTextGenerationRequest({
          prompt: `Concurrent request ${i}`,
        })
      );

      const { result: responses, duration } = await TestUtils.measureTime(() =>
        Promise.all(requests.map(request => unifiedClient.generateText(request)))
      );

      expect(responses).toHaveLength(concurrency);
      
      const successCount = responses.filter(r => r.success).length;
      const successRate = successCount / concurrency;
      
      expect(successRate).toBeGreaterThan(0.95); // 95% success rate
      expect(duration).toBeLessThan(5000); // Complete within 5 seconds
      
      performanceMonitor.recordMetric('low_concurrent_duration', duration);
      performanceMonitor.recordMetric('low_concurrent_success_rate', successRate * 100);
    });

    it('should handle medium concurrent load (50 requests)', async () => {
      const concurrency = 50;
      const requests = Array(concurrency).fill(null).map((_, i) => 
        TestDataFactory.createTextGenerationRequest({
          prompt: `Medium load request ${i}`,
          maxTokens: 100,
        })
      );

      const { result: responses, duration } = await TestUtils.measureTime(() =>
        Promise.all(requests.map(request => unifiedClient.generateText(request)))
      );

      expect(responses).toHaveLength(concurrency);
      
      const successCount = responses.filter(r => r.success).length;
      const successRate = successCount / concurrency;
      
      expect(successRate).toBeGreaterThan(0.90); // 90% success rate
      expect(duration).toBeLessThan(15000); // Complete within 15 seconds
      
      performanceMonitor.recordMetric('medium_concurrent_duration', duration);
      performanceMonitor.recordMetric('medium_concurrent_success_rate', successRate * 100);
    });

    it('should handle high concurrent load (100 requests)', async () => {
      const concurrency = 100;
      const requests = Array(concurrency).fill(null).map((_, i) => 
        TestDataFactory.createTextGenerationRequest({
          prompt: `High load request ${i}`,
          maxTokens: 50, // Smaller responses for load testing
        })
      );

      const { result: responses, duration } = await TestUtils.measureTime(() =>
        Promise.all(requests.map(request => unifiedClient.generateText(request)))
      );

      expect(responses).toHaveLength(concurrency);
      
      const successCount = responses.filter(r => r.success).length;
      const successRate = successCount / concurrency;
      
      expect(successRate).toBeGreaterThan(0.80); // 80% success rate under high load
      expect(duration).toBeLessThan(30000); // Complete within 30 seconds
      
      performanceMonitor.recordMetric('high_concurrent_duration', duration);
      performanceMonitor.recordMetric('high_concurrent_success_rate', successRate * 100);
    });

    it('should handle extreme concurrent load (200 requests)', async () => {
      const concurrency = 200;
      const requests = Array(concurrency).fill(null).map((_, i) => 
        TestDataFactory.createTextGenerationRequest({
          prompt: `Extreme load ${i}`,
          maxTokens: 25,
        })
      );

      // Simulate some failures under extreme load
      if (Math.random() > 0.8) {
        mockClients.get('openai')!.setShouldFail(true, 'rate_limit');
      }

      const { result: responses, duration } = await TestUtils.measureTime(() =>
        Promise.all(requests.map(request => unifiedClient.generateText(request)))
      );

      expect(responses).toHaveLength(concurrency);
      
      const successCount = responses.filter(r => r.success).length;
      const successRate = successCount / concurrency;
      
      expect(successRate).toBeGreaterThan(0.70); // 70% success rate under extreme load
      expect(duration).toBeLessThan(60000); // Complete within 60 seconds
      
      performanceMonitor.recordMetric('extreme_concurrent_duration', duration);
      performanceMonitor.recordMetric('extreme_concurrent_success_rate', successRate * 100);
    });
  });

  describe('Sustained Load Testing', () => {
    it('should handle sustained moderate load over time', async () => {
      const testDuration = 10000; // 10 seconds
      const requestInterval = 200; // Request every 200ms
      const startTime = Date.now();
      const requests: Promise<any>[] = [];
      let requestCount = 0;

      while (Date.now() - startTime < testDuration) {
        const request = TestDataFactory.createTextGenerationRequest({
          prompt: `Sustained load request ${requestCount++}`,
        });
        
        requests.push(unifiedClient.generateText(request));
        await TestUtils.wait(requestInterval);
      }

      const responses = await Promise.all(requests);
      const successCount = responses.filter(r => r.success).length;
      const successRate = successCount / responses.length;
      const throughput = successCount / (testDuration / 1000); // requests per second

      expect(successRate).toBeGreaterThan(0.85);
      expect(throughput).toBeGreaterThan(2); // At least 2 RPS
      
      performanceMonitor.recordMetric('sustained_load_success_rate', successRate * 100);
      performanceMonitor.recordMetric('sustained_load_throughput', throughput);
    });

    it('should maintain performance consistency over extended period', async () => {
      const batchSize = 10;
      const batchCount = 5;
      const batchResults: number[] = [];

      for (let batch = 0; batch < batchCount; batch++) {
        const requests = Array(batchSize).fill(null).map((_, i) => 
          TestDataFactory.createTextGenerationRequest({
            prompt: `Batch ${batch} request ${i}`,
          })
        );

        const { result: responses, duration } = await TestUtils.measureTime(() =>
          Promise.all(requests.map(request => unifiedClient.generateText(request)))
        );

        const successCount = responses.filter(r => r.success).length;
        const batchSuccessRate = successCount / batchSize;
        
        batchResults.push(batchSuccessRate);
        performanceMonitor.recordMetric('batch_duration', duration);
        performanceMonitor.recordMetric('batch_success_rate', batchSuccessRate * 100);

        // Brief pause between batches
        await TestUtils.wait(1000);
      }

      // Check consistency across batches
      const avgSuccessRate = batchResults.reduce((a, b) => a + b, 0) / batchResults.length;
      const variability = Math.max(...batchResults) - Math.min(...batchResults);

      expect(avgSuccessRate).toBeGreaterThan(0.90);
      expect(variability).toBeLessThan(0.15); // Less than 15% variation
    });
  });

  describe('Memory and Resource Usage', () => {
    it('should maintain reasonable memory usage under load', async () => {
      const initialMemory = process.memoryUsage();
      
      // Generate significant load
      const requests = Array(100).fill(null).map((_, i) => 
        TestDataFactory.createTextGenerationRequest({
          prompt: `Memory test request ${i}`,
        })
      );

      await Promise.all(requests.map(request => unifiedClient.generateText(request)));
      
      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      const memoryIncreaseMB = memoryIncrease / (1024 * 1024);
      
      expect(memoryIncreaseMB).toBeLessThan(100); // Less than 100MB increase
      
      performanceMonitor.recordMetric('memory_increase_mb', memoryIncreaseMB);
    });

    it('should handle garbage collection efficiently', async () => {
      const iterations = 10;
      const memoryReadings: number[] = [];

      for (let i = 0; i < iterations; i++) {
        // Generate some load
        const requests = Array(20).fill(null).map(() => 
          TestDataFactory.createTextGenerationRequest()
        );
        
        await Promise.all(requests.map(request => unifiedClient.generateText(request)));
        
        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }
        
        memoryReadings.push(process.memoryUsage().heapUsed);
        await TestUtils.wait(100);
      }

      // Memory should not grow excessively over iterations
      const initialMemory = memoryReadings[0];
      const finalMemory = memoryReadings[memoryReadings.length - 1];
      const memoryGrowth = (finalMemory - initialMemory) / (1024 * 1024);
      
      expect(memoryGrowth).toBeLessThan(50); // Less than 50MB growth
    });
  });

  describe('Provider Load Distribution', () => {
    it('should distribute load across providers with round-robin', async () => {
      const config = TestConfigFactory.createMockUnifiedAIConfig({
        loadBalancing: {
          enabled: true,
          strategy: 'round-robin',
        },
      });

      const client = new UnifiedAIClient(config);
      (client as any).clients = mockClients;
      (client as any).healthStatus = new Map([
        ['openai', true],
        ['anthropic', true],
        ['perplexity', true],
      ]);

      const requests = Array(30).fill(null).map(() => 
        TestDataFactory.createTextGenerationRequest()
      );

      const responses = await Promise.all(
        requests.map(request => client.generateText(request))
      );

      // Count provider usage
      const providerCounts = new Map<string, number>();
      responses.forEach(response => {
        if (response.success && response.metadata?.provider) {
          const count = providerCounts.get(response.metadata.provider) || 0;
          providerCounts.set(response.metadata.provider, count + 1);
        }
      });

      // Should have relatively even distribution
      const counts = Array.from(providerCounts.values());
      const maxCount = Math.max(...counts);
      const minCount = Math.min(...counts);
      const imbalance = maxCount - minCount;
      
      expect(imbalance).toBeLessThan(10); // Less than 10 request difference
    });

    it('should handle provider failures gracefully under load', async () => {
      // Make one provider fail
      mockClients.get('openai')!.setShouldFail(true, 'rate_limit');

      const requests = Array(50).fill(null).map((_, i) => 
        TestDataFactory.createTextGenerationRequest({
          prompt: `Failure test ${i}`,
        })
      );

      const responses = await Promise.all(
        requests.map(request => unifiedClient.generateText(request))
      );

      const successCount = responses.filter(r => r.success).length;
      const successRate = successCount / requests.length;
      
      // Should still maintain reasonable success rate through fallbacks
      expect(successRate).toBeGreaterThan(0.80);
      
      // Should not use the failed provider
      const successfulResponses = responses.filter(r => r.success);
      const usedProviders = new Set(
        successfulResponses.map(r => r.metadata?.provider).filter(Boolean)
      );
      
      expect(usedProviders.has('openai')).toBe(false);
      expect(usedProviders.has('anthropic')).toBe(true);
      expect(usedProviders.has('perplexity')).toBe(true);
    });
  });

  describe('Response Time Analysis', () => {
    it('should measure response time distribution', async () => {
      const requests = Array(50).fill(null).map(() => 
        TestDataFactory.createTextGenerationRequest()
      );

      const responseTimes: number[] = [];

      for (const request of requests) {
        const { duration } = await TestUtils.measureTime(() => 
          unifiedClient.generateText(request)
        );
        responseTimes.push(duration);
        performanceMonitor.recordMetric('response_time', duration);
      }

      const stats = performanceMonitor.getStats('response_time');
      
      expect(stats?.mean).toBeLessThan(1000); // Average under 1 second
      expect(stats?.p95).toBeLessThan(2000); // 95th percentile under 2 seconds
      expect(stats?.max).toBeLessThan(5000); // Maximum under 5 seconds
    });

    it('should identify performance bottlenecks', async () => {
      // Test different request types
      const requestTypes = [
        { name: 'short', prompt: 'Hi', maxTokens: 10 },
        { name: 'medium', prompt: 'Explain AI', maxTokens: 100 },
        { name: 'long', prompt: 'Write detailed analysis', maxTokens: 500 },
      ];

      for (const type of requestTypes) {
        const requests = Array(10).fill(null).map(() => 
          TestDataFactory.createTextGenerationRequest(type)
        );

        for (const request of requests) {
          const { duration } = await TestUtils.measureTime(() => 
            unifiedClient.generateText(request)
          );
          performanceMonitor.recordMetric(`${type.name}_request_time`, duration);
        }
      }

      // Analyze performance by request type
      requestTypes.forEach(type => {
        const stats = performanceMonitor.getStats(`${type.name}_request_time`);
        expect(stats?.mean).toBeLessThan(3000); // All types under 3 seconds
      });
    });

    it('should track performance degradation under increasing load', async () => {
      const loadLevels = [5, 10, 20, 40];
      const performanceResults: Array<{ load: number; avgTime: number }> = [];

      for (const load of loadLevels) {
        const requests = Array(load).fill(null).map(() => 
          TestDataFactory.createTextGenerationRequest()
        );

        const { duration } = await TestUtils.measureTime(() =>
          Promise.all(requests.map(request => unifiedClient.generateText(request)))
        );

        const avgTime = duration / load;
        performanceResults.push({ load, avgTime });
        performanceMonitor.recordMetric(`load_${load}_avg_time`, avgTime);
      }

      // Performance should degrade gracefully, not exponentially
      const initialAvgTime = performanceResults[0].avgTime;
      const finalAvgTime = performanceResults[performanceResults.length - 1].avgTime;
      const degradationRatio = finalAvgTime / initialAvgTime;
      
      expect(degradationRatio).toBeLessThan(3); // Less than 3x slower at max load
    });
  });

  describe('Throughput Testing', () => {
    it('should measure maximum throughput capacity', async () => {
      const testDuration = 5000; // 5 seconds
      const startTime = Date.now();
      const completedRequests: any[] = [];

      // Fire requests as fast as possible
      const fireRequests = async () => {
        while (Date.now() - startTime < testDuration) {
          const request = TestDataFactory.createTextGenerationRequest({
            maxTokens: 20, // Small responses for throughput testing
          });
          
          try {
            const response = await unifiedClient.generateText(request);
            completedRequests.push(response);
          } catch (error) {
            // Track errors but continue
          }
        }
      };

      // Run multiple concurrent request streams
      await Promise.all([
        fireRequests(),
        fireRequests(),
        fireRequests(),
      ]);

      const actualDuration = Date.now() - startTime;
      const successCount = completedRequests.filter(r => r.success).length;
      const throughput = successCount / (actualDuration / 1000);

      expect(throughput).toBeGreaterThan(5); // At least 5 RPS
      performanceMonitor.recordMetric('max_throughput_rps', throughput);
    });

    it('should maintain quality at high throughput', async () => {
      const requests = Array(30).fill(null).map(() => 
        TestDataFactory.createTextGenerationRequest({
          prompt: 'Quality test prompt',
          maxTokens: 50,
        })
      );

      const { result: responses, duration } = await TestUtils.measureTime(() =>
        Promise.all(requests.map(request => unifiedClient.generateText(request)))
      );

      const successfulResponses = responses.filter(r => r.success);
      const throughput = successfulResponses.length / (duration / 1000);
      
      // Check response quality metrics
      const avgResponseLength = successfulResponses.reduce((sum, r) => 
        sum + (r.data?.text?.length || 0), 0) / successfulResponses.length;
      
      const avgTokens = successfulResponses.reduce((sum, r) => 
        sum + (r.usage?.totalTokens || 0), 0) / successfulResponses.length;

      expect(throughput).toBeGreaterThan(3);
      expect(avgResponseLength).toBeGreaterThan(20); // Reasonable response length
      expect(avgTokens).toBeGreaterThan(10); // Reasonable token usage
      
      performanceMonitor.recordMetric('quality_throughput_rps', throughput);
      performanceMonitor.recordMetric('avg_response_length', avgResponseLength);
      performanceMonitor.recordMetric('avg_tokens', avgTokens);
    });
  });
});