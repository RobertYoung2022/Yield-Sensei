/**
 * Provider Connectivity Integration Tests
 * Tests real API connections with mock responses and network simulation
 */

import { 
  MockAIServer, 
  TestConfigFactory, 
  TestDataFactory, 
  TestUtils, 
  AITestSuite,
  PerformanceMonitor
} from '../utils/test-helpers';
import { UnifiedAIClient } from '../../unified-ai-client';
import { AIProvider, AIServiceError } from '../../types';

// Mock external dependencies
jest.mock('@/shared/logging/logger');
jest.mock('@/config/environment');

describe('Provider Connectivity Integration', () => {
  let testSuite: AITestSuite;
  let unifiedClient: UnifiedAIClient;
  let mockServer: MockAIServer;
  let performanceMonitor: PerformanceMonitor;

  beforeEach(async () => {
    testSuite = new (class extends AITestSuite {})();
    await testSuite['setUp']();
    
    mockServer = testSuite['mockServer'];
    performanceMonitor = testSuite['performanceMonitor'];

    // Mock environment configuration
    require('@/config/environment').config = {
      openaiApiKey: process.env.OPENAI_API_KEY || 'mock-openai-key',
      anthropicApiKey: process.env.ANTHROPIC_API_KEY || 'mock-anthropic-key',
      perplexityApiKey: process.env.PERPLEXITY_API_KEY || 'mock-perplexity-key',
    };

    const config = TestConfigFactory.createMockUnifiedAIConfig();
    unifiedClient = new UnifiedAIClient(config);
  });

  afterEach(async () => {
    await testSuite['tearDown']();
    unifiedClient = null as any;
  });

  describe('OpenAI Connectivity', () => {
    beforeEach(() => {
      // Mock OpenAI API responses
      mockServer.addResponse('/v1/chat/completions', {
        id: 'chatcmpl-123',
        object: 'chat.completion',
        created: Date.now(),
        model: 'gpt-4o',
        choices: [{
          index: 0,
          message: {
            role: 'assistant',
            content: 'Mock response from OpenAI API'
          },
          finish_reason: 'stop'
        }],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 20,
          total_tokens: 30
        }
      });
    });

    it('should establish connection to OpenAI API', async () => {
      const request = TestDataFactory.createTextGenerationRequest({
        prompt: 'Test connection to OpenAI',
        model: 'gpt-4o',
      });

      const response = await testSuite['runWithPerformanceTracking'](
        'openai_connection',
        () => unifiedClient.generateText(request)
      );

      expect(response.success).toBe(true);
      expect(response.data?.text).toBeDefined();
      expect(response.metadata?.provider).toBe('openai');
    });

    it('should handle OpenAI rate limiting', async () => {
      mockServer.setFailure('/v1/chat/completions', true);
      mockServer.addResponse('/v1/chat/completions', {
        error: {
          type: 'rate_limit_exceeded',
          message: 'Rate limit exceeded'
        }
      });

      const request = TestDataFactory.createTextGenerationRequest();

      const response = await unifiedClient.generateText(request);

      // Should either fail gracefully or use fallback
      expect(response).toHaveProperty('success');
      if (!response.success) {
        expect(response.error).toBeDefined();
      }
    });

    it('should handle OpenAI authentication errors', async () => {
      mockServer.setFailure('/v1/chat/completions', true);
      mockServer.addResponse('/v1/chat/completions', {
        error: {
          type: 'invalid_api_key',
          message: 'Invalid API key'
        }
      });

      const request = TestDataFactory.createTextGenerationRequest();

      const response = await unifiedClient.generateText(request);

      expect(response.success).toBe(false);
      expect(response.error).toContain('authentication');
    });

    it('should measure OpenAI response times', async () => {
      mockServer.addResponse('/v1/chat/completions', {
        choices: [{ message: { content: 'Fast response' } }]
      }, 100); // 100ms delay

      const request = TestDataFactory.createTextGenerationRequest();

      const { duration } = await TestUtils.measureTime(() => 
        unifiedClient.generateText(request)
      );

      expect(duration).toBeGreaterThanOrEqual(100);
      performanceMonitor.recordMetric('openai_response_time', duration);
    });

    it('should handle OpenAI streaming responses', async () => {
      mockServer.addResponse('/v1/chat/completions', {
        id: 'chatcmpl-stream',
        object: 'chat.completion.chunk',
        choices: [{
          delta: { content: 'Streaming response...' },
          finish_reason: null
        }]
      });

      const request = TestDataFactory.createTextGenerationRequest({
        stream: true,
      });

      const response = await unifiedClient.generateText(request);

      expect(response.success).toBe(true);
      expect(response.data?.text).toBeDefined();
    });
  });

  describe('Anthropic Connectivity', () => {
    beforeEach(() => {
      // Mock Anthropic API responses
      mockServer.addResponse('/v1/messages', {
        id: 'msg_123',
        type: 'message',
        role: 'assistant',
        content: [{
          type: 'text',
          text: 'Mock response from Anthropic API'
        }],
        model: 'claude-3-5-sonnet-20241022',
        stop_reason: 'end_turn',
        usage: {
          input_tokens: 15,
          output_tokens: 25
        }
      });
    });

    it('should establish connection to Anthropic API', async () => {
      const request = TestDataFactory.createTextGenerationRequest({
        prompt: 'Test connection to Anthropic',
        model: 'claude-3-5-sonnet-20241022',
      });

      const response = await testSuite['runWithPerformanceTracking'](
        'anthropic_connection',
        () => unifiedClient.generateText(request)
      );

      expect(response.success).toBe(true);
      expect(response.data?.text).toBeDefined();
      expect(response.metadata?.provider).toBe('anthropic');
    });

    it('should handle Anthropic content policy violations', async () => {
      mockServer.setFailure('/v1/messages', true);
      mockServer.addResponse('/v1/messages', {
        error: {
          type: 'invalid_request_error',
          message: 'Content violates usage policies'
        }
      });

      const request = TestDataFactory.createTextGenerationRequest({
        prompt: 'Potentially problematic content',
      });

      const response = await unifiedClient.generateText(request);

      expect(response.success).toBe(false);
      expect(response.error).toBeDefined();
    });

    it('should handle large context windows', async () => {
      const largePrompt = 'word '.repeat(50000); // ~200k characters

      mockServer.addResponse('/v1/messages', {
        content: [{ text: 'Response to large context' }],
        usage: { input_tokens: 40000, output_tokens: 100 }
      });

      const request = TestDataFactory.createTextGenerationRequest({
        prompt: largePrompt,
        maxTokens: 1000,
      });

      const { duration } = await TestUtils.measureTime(() => 
        unifiedClient.generateText(request)
      );

      performanceMonitor.recordMetric('anthropic_large_context', duration);
      expect(duration).toBeLessThan(30000); // Should complete within 30s
    });

    it('should measure Anthropic response quality', async () => {
      mockServer.addResponse('/v1/messages', {
        content: [{
          text: 'High-quality detailed response with comprehensive analysis and reasoning'
        }],
        usage: { input_tokens: 20, output_tokens: 80 }
      });

      const request = TestDataFactory.createTextGenerationRequest({
        prompt: 'Provide a detailed analysis of machine learning',
      });

      const response = await unifiedClient.generateText(request);

      expect(response.success).toBe(true);
      expect(response.data?.text?.length).toBeGreaterThan(50);
      expect(response.usage?.completionTokens).toBeGreaterThan(10);
    });
  });

  describe('Perplexity Connectivity', () => {
    beforeEach(() => {
      // Mock Perplexity API responses
      mockServer.addResponse('/chat/completions', {
        id: 'pplx_123',
        model: 'llama-3.1-sonar-large-128k-online',
        choices: [{
          message: {
            role: 'assistant',
            content: 'Mock research response from Perplexity with current information'
          },
          finish_reason: 'stop'
        }],
        usage: {
          prompt_tokens: 25,
          completion_tokens: 40,
          total_tokens: 65
        }
      });
    });

    it('should establish connection to Perplexity API', async () => {
      const request = TestDataFactory.createResearchRequest({
        query: 'Latest developments in AI',
        recency: 'week',
      });

      const response = await testSuite['runWithPerformanceTracking'](
        'perplexity_connection',
        () => unifiedClient.research(request)
      );

      expect(response.success).toBe(true);
      expect(response.data?.answer).toBeDefined();
    });

    it('should handle Perplexity web search failures', async () => {
      mockServer.setFailure('/chat/completions', true);
      mockServer.addResponse('/chat/completions', {
        error: {
          type: 'service_unavailable',
          message: 'Web search temporarily unavailable'
        }
      });

      const request = TestDataFactory.createResearchRequest({
        query: 'Current news',
      });

      const response = await unifiedClient.research(request);

      // Should fallback to text generation
      expect(response.success).toBe(true);
      expect(response.metadata?.fallback).toBe(true);
    });

    it('should provide real-time information capabilities', async () => {
      mockServer.addResponse('/chat/completions', {
        choices: [{
          message: {
            content: `Current information as of ${new Date().toISOString()}: Latest AI research findings...`,
          }
        }],
        citations: [
          { url: 'https://example.com/recent-ai-research', title: 'Recent AI Research' }
        ]
      });

      const request = TestDataFactory.createResearchRequest({
        query: 'Today\'s AI research developments',
        recency: 'day',
      });

      const response = await unifiedClient.research(request);

      expect(response.success).toBe(true);
      expect(response.data?.answer).toContain('Current information');
      expect(response.data?.sources?.length).toBeGreaterThan(0);
    });

    it('should measure research response relevance', async () => {
      mockServer.addResponse('/chat/completions', {
        choices: [{
          message: {
            content: 'Highly relevant research response with specific citations and current data'
          }
        }],
        citations: [
          { url: 'https://arxiv.org/paper1', title: 'Relevant Research Paper' },
          { url: 'https://news.com/article', title: 'Recent News Article' }
        ]
      });

      const request = TestDataFactory.createResearchRequest({
        query: 'Machine learning breakthrough 2024',
      });

      const response = await unifiedClient.research(request);

      expect(response.success).toBe(true);
      expect(response.data?.sources?.length).toBeGreaterThan(0);
      expect(response.data?.citations?.length).toBeGreaterThan(0);
    });
  });

  describe('Cross-Provider Fallback Integration', () => {
    it('should seamlessly fallback between providers', async () => {
      // Make OpenAI fail
      mockServer.setFailure('/v1/chat/completions', true);
      
      // Ensure Anthropic succeeds
      mockServer.addResponse('/v1/messages', {
        content: [{ text: 'Fallback response from Anthropic' }]
      });

      const request = TestDataFactory.createTextGenerationRequest();

      const response = await unifiedClient.generateText(request);

      expect(response.success).toBe(true);
      expect(response.data?.text).toContain('Fallback');
    });

    it('should maintain consistent response format across providers', async () => {
      const request = TestDataFactory.createTextGenerationRequest();

      // Test OpenAI format
      mockServer.addResponse('/v1/chat/completions', {
        choices: [{ message: { content: 'OpenAI response' } }],
        usage: { total_tokens: 50 }
      });

      const openaiResponse = await unifiedClient.generateText(request);

      // Test Anthropic format
      mockServer.addResponse('/v1/messages', {
        content: [{ text: 'Anthropic response' }],
        usage: { input_tokens: 20, output_tokens: 30 }
      });

      const anthropicResponse = await unifiedClient.generateText(request);

      // Both should have consistent structure
      expect(openaiResponse).toHaveProperty('success');
      expect(openaiResponse).toHaveProperty('data');
      expect(openaiResponse).toHaveProperty('usage');
      expect(openaiResponse).toHaveProperty('metadata');

      expect(anthropicResponse).toHaveProperty('success');
      expect(anthropicResponse).toHaveProperty('data');
      expect(anthropicResponse).toHaveProperty('usage');
      expect(anthropicResponse).toHaveProperty('metadata');
    });

    it('should handle partial provider outages', async () => {
      const requests = Array(10).fill(null).map(() => 
        TestDataFactory.createTextGenerationRequest()
      );

      // Simulate 50% OpenAI failure rate
      let callCount = 0;
      mockServer.addResponse('/v1/chat/completions', () => {
        callCount++;
        if (callCount % 2 === 0) {
          throw new Error('Intermittent failure');
        }
        return { choices: [{ message: { content: 'Success' } }] };
      });

      const responses = await Promise.all(
        requests.map(request => unifiedClient.generateText(request))
      );

      // All should eventually succeed through fallback
      const successCount = responses.filter(r => r.success).length;
      expect(successCount).toBeGreaterThan(5); // At least half should succeed
    });
  });

  describe('Network Resilience', () => {
    it('should handle network timeouts gracefully', async () => {
      mockServer.addResponse('/v1/chat/completions', 
        { choices: [{ message: { content: 'Delayed response' } }] },
        5000 // 5 second delay
      );

      const request = TestDataFactory.createTextGenerationRequest();

      const { duration } = await TestUtils.measureTime(() => 
        unifiedClient.generateText(request)
      );

      expect(duration).toBeGreaterThanOrEqual(5000);
      performanceMonitor.recordMetric('timeout_handling', duration);
    });

    it('should retry on transient network errors', async () => {
      let attemptCount = 0;
      mockServer.addResponse('/v1/chat/completions', () => {
        attemptCount++;
        if (attemptCount < 3) {
          throw new Error('Network error');
        }
        return { choices: [{ message: { content: 'Success after retry' } }] };
      });

      const request = TestDataFactory.createTextGenerationRequest();

      const response = await TestUtils.retry(() => 
        unifiedClient.generateText(request), 3
      );

      expect(response.success).toBe(true);
      expect(attemptCount).toBe(3);
    });

    it('should handle DNS resolution failures', async () => {
      mockServer.setFailure('/v1/chat/completions', true);
      
      const request = TestDataFactory.createTextGenerationRequest();

      const response = await unifiedClient.generateText(request);

      // Should either fail gracefully or use fallback
      expect(response).toHaveProperty('success');
    });

    it('should monitor connection quality', async () => {
      const latencies = [100, 200, 150, 300, 250];
      
      for (const latency of latencies) {
        mockServer.addResponse('/v1/chat/completions', 
          { choices: [{ message: { content: 'Test' } }] },
          latency
        );

        const request = TestDataFactory.createTextGenerationRequest();

        const { duration } = await TestUtils.measureTime(() => 
          unifiedClient.generateText(request)
        );

        performanceMonitor.recordMetric('connection_quality', duration);
      }

      const stats = performanceMonitor.getStats('connection_quality');
      expect(stats?.count).toBe(latencies.length);
      expect(stats?.mean).toBeGreaterThan(0);
    });

    it('should adapt to network conditions', async () => {
      // Simulate poor network conditions
      const poorNetworkLatency = 2000;
      mockServer.addResponse('/v1/chat/completions', 
        { choices: [{ message: { content: 'Slow response' } }] },
        poorNetworkLatency
      );

      const request = TestDataFactory.createTextGenerationRequest();

      const response = await unifiedClient.generateText(request);

      expect(response.success).toBe(true);
      // In a real implementation, might adjust timeouts or prefer faster providers
    });
  });

  describe('Load Testing', () => {
    it('should handle high concurrent request load', async () => {
      const concurrentRequests = 50;
      const requests = Array(concurrentRequests).fill(null).map((_, i) => 
        TestDataFactory.createTextGenerationRequest({
          prompt: `Load test request ${i}`,
        })
      );

      mockServer.addResponse('/v1/chat/completions', 
        { choices: [{ message: { content: 'Load test response' } }] },
        Math.random() * 200 // Random 0-200ms latency
      );

      const { result: responses, duration } = await TestUtils.measureTime(() =>
        Promise.all(requests.map(request => unifiedClient.generateText(request)))
      );

      expect(responses).toHaveLength(concurrentRequests);
      
      const successCount = responses.filter(r => r.success).length;
      const successRate = successCount / concurrentRequests;
      
      expect(successRate).toBeGreaterThan(0.8); // At least 80% success rate
      
      performanceMonitor.recordMetric('load_test_duration', duration);
      performanceMonitor.recordMetric('load_test_success_rate', successRate);
    });

    it('should maintain response quality under load', async () => {
      const requests = Array(20).fill(null).map(() => 
        TestDataFactory.createTextGenerationRequest({
          prompt: 'Generate a comprehensive analysis',
        })
      );

      mockServer.addResponse('/v1/chat/completions', {
        choices: [{ 
          message: { 
            content: 'Comprehensive analysis response with detailed information' 
          } 
        }],
        usage: { total_tokens: 100 }
      });

      const responses = await Promise.all(
        requests.map(request => unifiedClient.generateText(request))
      );

      responses.forEach(response => {
        if (response.success) {
          expect(response.data?.text?.length).toBeGreaterThan(20);
          expect(response.usage?.totalTokens).toBeGreaterThan(0);
        }
      });
    });
  });

  describe('Performance Benchmarking', () => {
    afterEach(() => {
      // Log performance statistics
      const allStats = performanceMonitor.getAllStats();
      console.log('Performance Stats:', JSON.stringify(allStats, null, 2));
    });

    it('should benchmark provider response times', async () => {
      const providers = ['openai', 'anthropic', 'perplexity'];
      const request = TestDataFactory.createTextGenerationRequest();

      for (const provider of providers) {
        const endpoint = provider === 'openai' ? '/v1/chat/completions' : 
                        provider === 'anthropic' ? '/v1/messages' : '/chat/completions';
        
        mockServer.addResponse(endpoint, {
          choices: [{ message: { content: `${provider} response` } }]
        }, Math.random() * 500); // Random latency

        const { duration } = await TestUtils.measureTime(() => 
          unifiedClient.generateText(request)
        );

        performanceMonitor.recordMetric(`${provider}_response_time`, duration);
      }

      // Analyze relative performance
      providers.forEach(provider => {
        const stats = performanceMonitor.getStats(`${provider}_response_time`);
        expect(stats?.mean).toBeLessThan(1000); // Should be under 1 second
      });
    });

    it('should measure throughput capacity', async () => {
      const testDuration = 5000; // 5 seconds
      const startTime = Date.now();
      const requests: Promise<any>[] = [];
      let requestCount = 0;

      mockServer.addResponse('/v1/chat/completions', {
        choices: [{ message: { content: 'Throughput test' } }]
      }, 50); // Fast responses

      while (Date.now() - startTime < testDuration) {
        const request = TestDataFactory.createTextGenerationRequest();
        requests.push(unifiedClient.generateText(request));
        requestCount++;
        
        await TestUtils.wait(100); // Throttle to prevent overwhelming
      }

      const responses = await Promise.all(requests);
      const successCount = responses.filter(r => r.success).length;
      const throughput = successCount / (testDuration / 1000); // requests per second

      performanceMonitor.recordMetric('throughput_rps', throughput);
      expect(throughput).toBeGreaterThan(0);
    });
  });
});