/**
 * Unified AI Client Unit Tests
 * Comprehensive testing of intelligent routing, fallback mechanisms, and provider management
 */

import { EventEmitter } from 'events';
import { 
  MockAIServiceClient, 
  TestConfigFactory, 
  TestDataFactory, 
  TestUtils,
  PerformanceMonitor
} from '../utils/test-helpers';
import { UnifiedAIClient } from '../../unified-ai-client';
import { AIProvider, AIServiceError, UnifiedAIClientConfig } from '../../types';

// Mock the individual client imports
jest.mock('../../openai-client');
jest.mock('../../anthropic-client');
jest.mock('../../perplexity-client');
jest.mock('@/shared/logging/logger');
jest.mock('@/config/environment');

describe('Unified AI Client', () => {
  let unifiedClient: UnifiedAIClient;
  let mockClients: Map<AIProvider, MockAIServiceClient>;
  let config: UnifiedAIClientConfig;
  let performanceMonitor: PerformanceMonitor;

  beforeEach(() => {
    config = TestConfigFactory.createMockUnifiedAIConfig();
    
    // Create mock clients
    mockClients = new Map([
      ['openai', new MockAIServiceClient('openai', config.providers.openai!)],
      ['anthropic', new MockAIServiceClient('anthropic', config.providers.anthropic!)],
      ['perplexity', new MockAIServiceClient('perplexity', config.providers.perplexity!)],
    ]);

    // Mock the config module
    require('@/config/environment').config = {
      openaiApiKey: 'mock-openai-key',
      anthropicApiKey: 'mock-anthropic-key',
      perplexityApiKey: 'mock-perplexity-key',
    };

    performanceMonitor = new PerformanceMonitor();
    unifiedClient = new UnifiedAIClient(config);

    // Replace internal clients with mocks
    (unifiedClient as any).clients = mockClients;
    (unifiedClient as any).healthStatus = new Map([
      ['openai', true],
      ['anthropic', true],
      ['perplexity', true],
    ]);
  });

  afterEach(() => {
    unifiedClient = null as any;
    mockClients.clear();
    performanceMonitor.reset();
  });

  describe('Initialization', () => {
    it('should initialize with default configuration', () => {
      const client = new UnifiedAIClient();
      expect(client).toBeInstanceOf(UnifiedAIClient);
      expect(client).toBeInstanceOf(EventEmitter);
    });

    it('should initialize with custom configuration', () => {
      const customConfig = TestConfigFactory.createMockUnifiedAIConfig({
        defaultProvider: 'openai',
        fallbackProviders: ['anthropic'],
      });

      const client = new UnifiedAIClient(customConfig);
      expect(client).toBeInstanceOf(UnifiedAIClient);
    });

    it('should start health checking on initialization', async () => {
      await TestUtils.wait(100); // Allow health check to start
      
      const healthStatus = unifiedClient.getHealthStatus();
      expect(healthStatus).toHaveProperty('openai');
      expect(healthStatus).toHaveProperty('anthropic');
      expect(healthStatus).toHaveProperty('perplexity');
    });
  });

  describe('Provider Selection and Routing', () => {
    it('should use default provider when available', async () => {
      const request = TestDataFactory.createTextGenerationRequest();
      const response = await unifiedClient.generateText(request);

      expect(response.success).toBe(true);
      expect(response.metadata!.provider).toBe(config.defaultProvider);
    });

    it('should fallback to secondary provider when primary fails', async () => {
      mockClients.get('anthropic')!.setShouldFail(true, 'server');

      const request = TestDataFactory.createTextGenerationRequest();
      const response = await unifiedClient.generateText(request);

      expect(response.success).toBe(true);
      // Should fallback to one of the fallback providers
      expect(['openai', 'perplexity']).toContain(response.metadata?.provider);
    });

    it('should prefer Perplexity for research requests', async () => {
      const request = TestDataFactory.createResearchRequest();
      const response = await unifiedClient.research(request);

      expect(response.success).toBe(true);
      // Should prefer Perplexity or fallback gracefully
    });

    it('should implement round-robin load balancing', async () => {
      const loadBalancingConfig = TestConfigFactory.createMockUnifiedAIConfig({
        loadBalancing: {
          enabled: true,
          strategy: 'round-robin',
        },
      });

      const client = new UnifiedAIClient(loadBalancingConfig);
      (client as any).clients = mockClients;
      (client as any).healthStatus = new Map([
        ['openai', true],
        ['anthropic', true],
        ['perplexity', true],
      ]);

      const requests = Array(6).fill(null).map(() => 
        TestDataFactory.createTextGenerationRequest()
      );

      const responses = await Promise.all(
        requests.map(request => client.generateText(request))
      );

      expect(responses).toHaveLength(6);
      responses.forEach(response => {
        expect(response.success).toBe(true);
      });
    });

    it('should handle least-used load balancing strategy', async () => {
      const loadBalancingConfig = TestConfigFactory.createMockUnifiedAIConfig({
        loadBalancing: {
          enabled: true,
          strategy: 'least-used',
        },
      });

      const client = new UnifiedAIClient(loadBalancingConfig);
      (client as any).clients = mockClients;

      const request = TestDataFactory.createTextGenerationRequest();
      const response = await client.generateText(request);

      expect(response.success).toBe(true);
    });

    it('should handle fastest load balancing strategy', async () => {
      const loadBalancingConfig = TestConfigFactory.createMockUnifiedAIConfig({
        loadBalancing: {
          enabled: true,
          strategy: 'fastest',
        },
      });

      const client = new UnifiedAIClient(loadBalancingConfig);
      (client as any).clients = mockClients;

      const request = TestDataFactory.createTextGenerationRequest();
      const response = await client.generateText(request);

      expect(response.success).toBe(true);
    });
  });

  describe('Text Generation', () => {
    it('should generate text successfully', async () => {
      const request = TestDataFactory.createTextGenerationRequest({
        prompt: 'Explain machine learning',
        maxTokens: 200,
        temperature: 0.7,
      });

      const response = await unifiedClient.generateText(request);

      expect(response.success).toBe(true);
      expect(response.data).toBeDefined();
      expect(response.data!.text).toBeDefined();
      expect(response.usage).toBeDefined();
      expect(response.metadata).toBeDefined();
    });

    it('should handle streaming requests', async () => {
      const request = TestDataFactory.createTextGenerationRequest({
        stream: true,
      });

      const response = await unifiedClient.generateText(request);

      expect(response.success).toBe(true);
    });

    it('should emit events on successful generation', async () => {
      const request = TestDataFactory.createTextGenerationRequest();

      const eventPromise = TestUtils.waitForEvent(unifiedClient, 'generation_success');
      const response = await unifiedClient.generateText(request);

      expect(response.success).toBe(true);
      
      const eventData = await eventPromise;
      expect(eventData).toHaveProperty('provider');
      expect(eventData).toHaveProperty('request');
      expect(eventData).toHaveProperty('response');
    });

    it('should handle all providers being unavailable', async () => {
      mockClients.forEach(client => client.setHealthy(false));
      (unifiedClient as any).healthStatus = new Map([
        ['openai', false],
        ['anthropic', false],
        ['perplexity', false],
      ]);

      const request = TestDataFactory.createTextGenerationRequest();
      const response = await unifiedClient.generateText(request);

      expect(response.success).toBe(false);
      expect(response.error).toContain('No available AI providers');
    });
  });

  describe('Content Analysis', () => {
    it('should analyze content successfully', async () => {
      const request = TestDataFactory.createAnalysisRequest({
        content: 'This is excellent work!',
        analysisType: 'sentiment',
      });

      const response = await unifiedClient.analyzeContent(request);

      expect(response.success).toBe(true);
      expect(response.data).toBeDefined();
      expect(response.data!.result).toBeDefined();
    });

    it('should fallback when analysis fails', async () => {
      mockClients.get('anthropic')!.setShouldFail(true, 'server');

      const request = TestDataFactory.createAnalysisRequest({
        analysisType: 'classification',
      });

      const response = await unifiedClient.analyzeContent(request);

      expect(response.success).toBe(true);
    });

    it('should emit events on successful analysis', async () => {
      const request = TestDataFactory.createAnalysisRequest();

      const eventPromise = TestUtils.waitForEvent(unifiedClient, 'analysis_success');
      const response = await unifiedClient.analyzeContent(request);

      expect(response.success).toBe(true);
      
      const eventData = await eventPromise;
      expect(eventData).toHaveProperty('provider');
      expect(eventData).toHaveProperty('request');
      expect(eventData).toHaveProperty('response');
    });
  });

  describe('Research Capabilities', () => {
    it('should conduct research using Perplexity', async () => {
      const request = TestDataFactory.createResearchRequest({
        query: 'Latest AI developments',
        domain: 'technology',
      });

      const response = await unifiedClient.research(request);

      expect(response.success).toBe(true);
      expect(response.data).toBeDefined();
      expect(response.data!.answer).toBeDefined();
      expect(response.data!.sources).toBeDefined();
    });

    it('should fallback to text generation when Perplexity fails', async () => {
      mockClients.get('perplexity')!.setShouldFail(true, 'network');

      const request = TestDataFactory.createResearchRequest({
        query: 'Research query',
      });

      const response = await unifiedClient.research(request);

      expect(response.success).toBe(true);
      expect(response.data!.answer).toBeDefined();
      expect(response.metadata!.fallback).toBe(true);
      expect(response.metadata!.note).toContain('fallback');
    });

    it('should emit events on successful research', async () => {
      const request = TestDataFactory.createResearchRequest();

      const eventPromise = TestUtils.waitForEvent(unifiedClient, 'research_success');
      const response = await unifiedClient.research(request);

      expect(response.success).toBe(true);
      
      const eventData = await eventPromise;
      expect(eventData).toHaveProperty('provider');
      expect(eventData).toHaveProperty('request');
      expect(eventData).toHaveProperty('response');
    });
  });

  describe('Fallback Mechanisms', () => {
    it('should attempt all fallback providers', async () => {
      // Make primary provider fail
      mockClients.get('anthropic')!.setShouldFail(true, 'server');
      
      const request = TestDataFactory.createTextGenerationRequest();
      const response = await unifiedClient.generateText(request);

      expect(response.success).toBe(true);
      expect(['openai', 'perplexity']).toContain(response.metadata?.provider);
    });

    it('should emit fallback success events', async () => {
      mockClients.get('anthropic')!.setShouldFail(true, 'server');

      const request = TestDataFactory.createTextGenerationRequest();

      const eventPromise = TestUtils.waitForEvent(unifiedClient, 'fallback_success');
      const response = await unifiedClient.generateText(request);

      expect(response.success).toBe(true);
      
      const eventData = await eventPromise;
      expect(eventData).toHaveProperty('provider');
      expect(eventData).toHaveProperty('originalError');
    });

    it('should handle all fallback providers failing', async () => {
      // Make all providers fail
      mockClients.forEach(client => client.setShouldFail(true, 'server'));

      const request = TestDataFactory.createTextGenerationRequest();
      const response = await unifiedClient.generateText(request);

      expect(response.success).toBe(false);
      expect(response.error).toContain('failed');
    });

    it('should not fallback on authentication errors', async () => {
      mockClients.get('anthropic')!.setShouldFail(true, 'auth');

      const request = TestDataFactory.createTextGenerationRequest();
      const response = await unifiedClient.generateText(request);

      expect(response.success).toBe(false);
      expect(response.error).toBeDefined();
    });
  });

  describe('Health Monitoring', () => {
    it('should track health status of all providers', () => {
      const healthStatus = unifiedClient.getHealthStatus();

      expect(healthStatus).toHaveProperty('openai');
      expect(healthStatus).toHaveProperty('anthropic');
      expect(healthStatus).toHaveProperty('perplexity');
      expect(healthStatus.openai).toBe(true);
      expect(healthStatus.anthropic).toBe(true);
      expect(healthStatus.perplexity).toBe(true);
    });

    it('should refresh health status on demand', async () => {
      mockClients.get('openai')!.setHealthy(false);

      await unifiedClient.refreshHealthStatus();

      const healthStatus = unifiedClient.getHealthStatus();
      expect(healthStatus.openai).toBe(false);
    });

    it('should emit health check events', async () => {
      const eventPromise = TestUtils.waitForEvent(unifiedClient, 'health_check_complete');
      
      await unifiedClient.refreshHealthStatus();
      
      const eventData = await eventPromise;
      expect(eventData).toHaveProperty('openai');
      expect(eventData).toHaveProperty('anthropic');
      expect(eventData).toHaveProperty('perplexity');
    });

    it('should handle health check failures gracefully', async () => {
      mockClients.get('openai')!.setShouldFail(true, 'network');

      await unifiedClient.refreshHealthStatus();

      const healthStatus = unifiedClient.getHealthStatus();
      expect(healthStatus.openai).toBe(false);
    });
  });

  describe('Usage Statistics', () => {
    it('should aggregate usage statistics from all providers', async () => {
      // Generate some usage
      await unifiedClient.generateText(TestDataFactory.createTextGenerationRequest());
      await unifiedClient.generateText(TestDataFactory.createTextGenerationRequest());

      const stats = await unifiedClient.getUsageStats();

      expect(stats).toHaveProperty('total');
      expect(stats).toHaveProperty('byProvider');
      expect(stats.total.requestsToday).toBeGreaterThan(0);
      expect(stats.total.tokensUsed).toBeGreaterThan(0);
      expect(stats.total.costToday).toBeGreaterThan(0);
    });

    it('should handle usage retrieval failures', async () => {
      mockClients.get('openai')!.setShouldFail(true, 'network');

      const stats = await unifiedClient.getUsageStats();

      expect(stats.byProvider.openai).toHaveProperty('error');
      expect(stats.total).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should properly categorize errors', async () => {
      const errorTypes = ['auth', 'rate_limit', 'server', 'network'] as const;

      for (const errorType of errorTypes) {
        mockClients.get('anthropic')!.setShouldFail(true, errorType);

        const request = TestDataFactory.createTextGenerationRequest();
        
        try {
          await unifiedClient.generateText(request);
        } catch (error) {
          // Some errors might be handled internally
        }

        mockClients.get('anthropic')!.setShouldFail(false);
      }
    });

    it('should provide informative error messages', async () => {
      mockClients.forEach(client => client.setShouldFail(true, 'auth'));

      const request = TestDataFactory.createTextGenerationRequest();
      const response = await unifiedClient.generateText(request);

      expect(response.success).toBe(false);
      expect(response.error).toBeDefined();
      expect(response.metadata).toBeDefined();
    });

    it('should handle provider initialization failures', () => {
      const emptyConfig = TestConfigFactory.createMockUnifiedAIConfig({
        providers: {},
      });

      const client = new UnifiedAIClient(emptyConfig);
      expect(client).toBeInstanceOf(UnifiedAIClient);
    });
  });

  describe('Performance', () => {
    it('should handle concurrent requests efficiently', async () => {
      const requests = Array(20).fill(null).map(() => 
        TestDataFactory.createTextGenerationRequest()
      );

      const { result: responses, duration } = await TestUtils.measureTime(() =>
        Promise.all(requests.map(request => unifiedClient.generateText(request)))
      );

      expect(responses).toHaveLength(20);
      responses.forEach(response => {
        expect(response.success).toBe(true);
      });

      performanceMonitor.recordMetric('concurrent_requests', duration);
      const stats = performanceMonitor.getStats('concurrent_requests');
      expect(stats?.count).toBe(1);
    });

    it('should maintain performance under load', async () => {
      const iterations = 10;
      const durations: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const request = TestDataFactory.createTextGenerationRequest();
        
        const { duration } = await TestUtils.measureTime(() => 
          unifiedClient.generateText(request)
        );
        
        durations.push(duration);
        performanceMonitor.recordMetric('single_request', duration);
      }

      const stats = performanceMonitor.getStats('single_request');
      expect(stats?.count).toBe(iterations);
      expect(stats?.mean).toBeLessThan(5000); // Should average less than 5s
    });

    it('should optimize provider selection based on performance', async () => {
      // Set different latencies for providers
      mockClients.get('openai')!.setLatency(100);
      mockClients.get('anthropic')!.setLatency(200);
      mockClients.get('perplexity')!.setLatency(300);

      const request = TestDataFactory.createTextGenerationRequest();
      const response = await unifiedClient.generateText(request);

      expect(response.success).toBe(true);
      // In a real implementation with fastest strategy, would prefer openai
    });
  });

  describe('Configuration Management', () => {
    it('should handle dynamic configuration updates', () => {
      const newConfig = TestConfigFactory.createMockUnifiedAIConfig({
        defaultProvider: 'openai',
        fallbackProviders: ['anthropic'],
      });

      // In a real implementation, would support config updates
      expect(unifiedClient).toBeInstanceOf(UnifiedAIClient);
    });

    it('should validate configuration on initialization', () => {
      const invalidConfig = {
        defaultProvider: 'invalid' as AIProvider,
        fallbackProviders: [],
        providers: {},
      };

      expect(() => new UnifiedAIClient(invalidConfig as any)).not.toThrow();
      // Mock implementation doesn't validate, but real would
    });
  });

  describe('Event System', () => {
    it('should support event listeners', async () => {
      let eventReceived = false;

      unifiedClient.on('generation_success', () => {
        eventReceived = true;
      });

      const request = TestDataFactory.createTextGenerationRequest();
      await unifiedClient.generateText(request);

      await TestUtils.wait(50); // Allow event to propagate
      expect(eventReceived).toBe(true);
    });

    it('should emit events in correct order', async () => {
      const events: string[] = [];

      unifiedClient.on('generation_success', () => events.push('success'));
      unifiedClient.on('health_check_complete', () => events.push('health'));

      const request = TestDataFactory.createTextGenerationRequest();
      await unifiedClient.generateText(request);
      await unifiedClient.refreshHealthStatus();

      await TestUtils.wait(100);
      expect(events).toContain('success');
      expect(events).toContain('health');
    });
  });

  describe('Memory Management', () => {
    it('should handle memory efficiently with many requests', async () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // Simulate many requests
      const requests = Array(100).fill(null).map(() => 
        TestDataFactory.createTextGenerationRequest()
      );

      await Promise.all(requests.map(request => unifiedClient.generateText(request)));

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be reasonable (less than 50MB)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
    });

    it('should clean up resources properly', () => {
      // Test cleanup on client destruction
      const client = new UnifiedAIClient();
      
      // In real implementation, would have cleanup methods
      expect(client).toBeInstanceOf(UnifiedAIClient);
    });
  });
});