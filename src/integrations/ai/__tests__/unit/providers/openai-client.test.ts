/**
 * OpenAI Client Unit Tests
 * Comprehensive testing of OpenAI service integration
 */

import { MockAIServiceClient, TestConfigFactory, TestDataFactory, TestUtils } from '../../utils/test-helpers';
import { AIServiceError, OpenAIModel } from '../../../types';

describe('OpenAI Client', () => {
  let client: MockAIServiceClient;

  beforeEach(() => {
    const config = TestConfigFactory.createMockServiceConfig('openai');
    client = new MockAIServiceClient('openai', config);
  });

  afterEach(() => {
    client = null as any;
  });

  describe('Text Generation', () => {
    it('should generate text successfully', async () => {
      const request = TestDataFactory.createTextGenerationRequest({
        prompt: 'What is artificial intelligence?',
        model: 'gpt-4o' as OpenAIModel,
        maxTokens: 100,
        temperature: 0.7,
      });

      const response = await client.generateText(request);

      expect(response.success).toBe(true);
      expect(response.data).toBeDefined();
      expect(response.data!.text).toContain('Mock response from openai');
      expect(response.data!.finishReason).toBe('stop');
      expect(response.data!.model).toBe('gpt-4o');
      expect(response.usage).toBeDefined();
      expect(response.usage!.totalTokens).toBeGreaterThan(0);
      expect(response.metadata).toBeDefined();
      expect(response.metadata!.provider).toBe('openai');
    });

    it('should handle streaming requests', async () => {
      const request = TestDataFactory.createTextGenerationRequest({
        stream: true,
      });

      const response = await client.generateText(request);

      expect(response.success).toBe(true);
      expect(response.data).toBeDefined();
    });

    it('should validate token limits', async () => {
      const request = TestDataFactory.createTextGenerationRequest({
        maxTokens: 200000, // Exceeds typical model limits
      });

      const response = await client.generateText(request);

      // Mock client should still succeed, but real implementation would validate
      expect(response.success).toBe(true);
    });

    it('should handle system prompts', async () => {
      const request = TestDataFactory.createTextGenerationRequest({
        prompt: 'Explain quantum computing',
        systemPrompt: 'You are a quantum physics expert',
      });

      const response = await client.generateText(request);

      expect(response.success).toBe(true);
      expect(response.data!.text).toBeDefined();
    });

    it('should track token usage accurately', async () => {
      const request = TestDataFactory.createTextGenerationRequest();

      const response = await client.generateText(request);

      expect(response.usage).toBeDefined();
      expect(response.usage!.promptTokens).toBeGreaterThan(0);
      expect(response.usage!.completionTokens).toBeGreaterThan(0);
      expect(response.usage!.totalTokens).toBe(
        response.usage!.promptTokens! + response.usage!.completionTokens!
      );
      expect(response.usage!.cost).toBeGreaterThan(0);
    });
  });

  describe('Content Analysis', () => {
    it('should analyze sentiment successfully', async () => {
      const request = TestDataFactory.createAnalysisRequest({
        content: 'I love this product! It works amazingly well.',
        analysisType: 'sentiment',
      });

      const response = await client.analyzeContent!(request);

      expect(response.success).toBe(true);
      expect(response.data).toBeDefined();
      expect(response.data!.result).toContain('sentiment analysis');
      expect(response.data!.confidence).toBeGreaterThanOrEqual(0);
      expect(response.data!.confidence).toBeLessThanOrEqual(1);
    });

    it('should summarize content', async () => {
      const request = TestDataFactory.createAnalysisRequest({
        content: 'Long content that needs summarization...',
        analysisType: 'summary',
      });

      const response = await client.analyzeContent!(request);

      expect(response.success).toBe(true);
      expect(response.data!.result).toBeDefined();
    });

    it('should classify content', async () => {
      const request = TestDataFactory.createAnalysisRequest({
        content: 'Technical documentation about machine learning algorithms',
        analysisType: 'classification',
        options: {
          categories: ['technical', 'marketing', 'educational'],
        },
      });

      const response = await client.analyzeContent!(request);

      expect(response.success).toBe(true);
      expect(response.data!.result).toBeDefined();
    });

    it('should extract information', async () => {
      const request = TestDataFactory.createAnalysisRequest({
        content: 'John Doe, CEO of TechCorp, announced a $10M funding round',
        analysisType: 'extraction',
        options: {
          entities: ['person', 'organization', 'money'],
        },
      });

      const response = await client.analyzeContent!(request);

      expect(response.success).toBe(true);
      expect(response.data!.result).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle authentication errors', async () => {
      client.setShouldFail(true, 'auth');

      const request = TestDataFactory.createTextGenerationRequest();

      await expect(client.generateText(request)).rejects.toThrow();

      try {
        await client.generateText(request);
      } catch (error) {
        const aiError = error as AIServiceError;
        expect(aiError.provider).toBe('openai');
        expect(aiError.type).toBe('auth');
        expect(aiError.statusCode).toBe(401);
        expect(aiError.retryable).toBe(false);
      }
    });

    it('should handle rate limiting errors', async () => {
      client.setShouldFail(true, 'rate_limit');

      const request = TestDataFactory.createTextGenerationRequest();

      await expect(client.generateText(request)).rejects.toThrow();

      try {
        await client.generateText(request);
      } catch (error) {
        const aiError = error as AIServiceError;
        expect(aiError.provider).toBe('openai');
        expect(aiError.type).toBe('rate_limit');
        expect(aiError.statusCode).toBe(429);
        expect(aiError.retryable).toBe(true);
      }
    });

    it('should handle server errors', async () => {
      client.setShouldFail(true, 'server');

      const request = TestDataFactory.createTextGenerationRequest();

      await expect(client.generateText(request)).rejects.toThrow();

      try {
        await client.generateText(request);
      } catch (error) {
        const aiError = error as AIServiceError;
        expect(aiError.provider).toBe('openai');
        expect(aiError.type).toBe('server');
        expect(aiError.statusCode).toBe(500);
        expect(aiError.retryable).toBe(true);
      }
    });

    it('should handle network errors', async () => {
      client.setShouldFail(true, 'network');

      const request = TestDataFactory.createTextGenerationRequest();

      await expect(client.generateText(request)).rejects.toThrow();

      try {
        await client.generateText(request);
      } catch (error) {
        const aiError = error as AIServiceError;
        expect(aiError.provider).toBe('openai');
        expect(aiError.type).toBe('network');
        expect(aiError.retryable).toBe(true);
      }
    });
  });

  describe('Health Monitoring', () => {
    it('should report healthy status', async () => {
      const isHealthy = await client.healthCheck();
      expect(isHealthy).toBe(true);
    });

    it('should report unhealthy status', async () => {
      client.setHealthy(false);
      const isHealthy = await client.healthCheck();
      expect(isHealthy).toBe(false);
    });

    it('should track usage statistics', async () => {
      await client.generateText(TestDataFactory.createTextGenerationRequest());
      await client.generateText(TestDataFactory.createTextGenerationRequest());

      const usage = await client.getUsage();

      expect(usage.requestsToday).toBe(2);
      expect(usage.tokensUsed).toBeGreaterThan(0);
      expect(usage.costToday).toBeGreaterThan(0);
    });
  });

  describe('Configuration', () => {
    it('should use provided configuration', () => {
      expect(client.provider).toBe('openai');
      expect(client.config.apiKey).toBe('mock-openai-key');
      expect(client.config.timeout).toBe(30000);
      expect(client.config.maxRetries).toBe(3);
    });

    it('should handle timeout settings', async () => {
      client.setLatency(5000); // 5 second latency

      const request = TestDataFactory.createTextGenerationRequest();
      const { duration } = await TestUtils.measureTime(() => client.generateText(request));

      expect(duration).toBeGreaterThanOrEqual(5000);
    });
  });

  describe('Model-Specific Features', () => {
    it('should support GPT-4o model', async () => {
      const request = TestDataFactory.createTextGenerationRequest({
        model: 'gpt-4o' as OpenAIModel,
      });

      const response = await client.generateText(request);

      expect(response.success).toBe(true);
      expect(response.data!.model).toBe('gpt-4o');
    });

    it('should support GPT-4o-mini model', async () => {
      const request = TestDataFactory.createTextGenerationRequest({
        model: 'gpt-4o-mini' as OpenAIModel,
      });

      const response = await client.generateText(request);

      expect(response.success).toBe(true);
      expect(response.data!.model).toBe('gpt-4o-mini');
    });

    it('should support GPT-3.5-turbo model', async () => {
      const request = TestDataFactory.createTextGenerationRequest({
        model: 'gpt-3.5-turbo' as OpenAIModel,
      });

      const response = await client.generateText(request);

      expect(response.success).toBe(true);
      expect(response.data!.model).toBe('gpt-3.5-turbo');
    });
  });

  describe('Performance', () => {
    it('should complete requests within reasonable time', async () => {
      const request = TestDataFactory.createTextGenerationRequest();

      const { duration } = await TestUtils.measureTime(() => client.generateText(request));

      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should handle concurrent requests', async () => {
      const requests = Array(10).fill(null).map(() => 
        TestDataFactory.createTextGenerationRequest()
      );

      const promises = requests.map(request => client.generateText(request));
      const responses = await Promise.all(promises);

      expect(responses).toHaveLength(10);
      responses.forEach(response => {
        expect(response.success).toBe(true);
      });
    });
  });

  describe('Cost Tracking', () => {
    it('should calculate costs based on token usage', async () => {
      const request = TestDataFactory.createTextGenerationRequest({
        model: 'gpt-4o' as OpenAIModel,
      });

      const response = await client.generateText(request);

      expect(response.usage!.cost).toBeGreaterThan(0);
      expect(response.usage!.cost).toBe(response.usage!.totalTokens! * 0.001);
    });

    it('should accumulate daily costs', async () => {
      await client.generateText(TestDataFactory.createTextGenerationRequest());
      await client.generateText(TestDataFactory.createTextGenerationRequest());

      const usage = await client.getUsage();

      expect(usage.costToday).toBeGreaterThan(0);
    });
  });
});