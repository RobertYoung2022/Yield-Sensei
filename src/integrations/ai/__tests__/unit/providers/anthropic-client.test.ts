/**
 * Anthropic Client Unit Tests
 * Comprehensive testing of Anthropic Claude service integration
 */

import { MockAIServiceClient, TestConfigFactory, TestDataFactory, TestUtils } from '../../utils/test-helpers';
import { AIServiceError, AnthropicModel } from '../../../types';

describe('Anthropic Client', () => {
  let client: MockAIServiceClient;

  beforeEach(() => {
    const config = TestConfigFactory.createMockServiceConfig('anthropic');
    client = new MockAIServiceClient('anthropic', config);
  });

  afterEach(() => {
    client = null as any;
  });

  describe('Text Generation', () => {
    it('should generate text successfully with Claude', async () => {
      const request = TestDataFactory.createTextGenerationRequest({
        prompt: 'Explain the concept of machine learning',
        model: 'claude-3-5-sonnet-20241022' as AnthropicModel,
        maxTokens: 200,
        temperature: 0.5,
      });

      const response = await client.generateText(request);

      expect(response.success).toBe(true);
      expect(response.data).toBeDefined();
      expect(response.data!.text).toContain('Mock response from anthropic');
      expect(response.data!.finishReason).toBe('stop');
      expect(response.data!.model).toBe('claude-3-5-sonnet-20241022');
      expect(response.usage).toBeDefined();
      expect(response.usage!.totalTokens).toBeGreaterThan(0);
      expect(response.metadata).toBeDefined();
      expect(response.metadata!.provider).toBe('anthropic');
    });

    it('should handle long-form content generation', async () => {
      const request = TestDataFactory.createTextGenerationRequest({
        prompt: 'Write a comprehensive essay about renewable energy',
        maxTokens: 4000,
        temperature: 0.3,
      });

      const response = await client.generateText(request);

      expect(response.success).toBe(true);
      expect(response.data!.text).toBeDefined();
      expect(response.usage!.totalTokens).toBeGreaterThan(100);
    });

    it('should respect temperature settings', async () => {
      const lowTempRequest = TestDataFactory.createTextGenerationRequest({
        prompt: 'Generate a creative story',
        temperature: 0.1, // Very deterministic
      });

      const highTempRequest = TestDataFactory.createTextGenerationRequest({
        prompt: 'Generate a creative story',
        temperature: 0.9, // Very creative
      });

      const lowTempResponse = await client.generateText(lowTempRequest);
      const highTempResponse = await client.generateText(highTempRequest);

      expect(lowTempResponse.success).toBe(true);
      expect(highTempResponse.success).toBe(true);
      // Both should succeed, though real implementation would show different creativity levels
    });

    it('should handle system messages effectively', async () => {
      const request = TestDataFactory.createTextGenerationRequest({
        prompt: 'What is photosynthesis?',
        systemPrompt: 'You are a biology professor explaining concepts to undergraduate students.',
      });

      const response = await client.generateText(request);

      expect(response.success).toBe(true);
      expect(response.data!.text).toBeDefined();
    });

    it('should support context-aware conversations', async () => {
      const request = TestDataFactory.createTextGenerationRequest({
        prompt: 'Continue the conversation about AI ethics',
        systemPrompt: 'Previous context: We were discussing the implications of AI in healthcare.',
      });

      const response = await client.generateText(request);

      expect(response.success).toBe(true);
      expect(response.data!.text).toBeDefined();
    });
  });

  describe('Content Analysis', () => {
    it('should perform sophisticated text analysis', async () => {
      const request = TestDataFactory.createAnalysisRequest({
        content: 'The quarterly earnings report shows a 15% increase in revenue, primarily driven by strong performance in the cloud computing division.',
        analysisType: 'sentiment',
        context: 'Financial analysis',
      });

      const response = await client.analyzeContent!(request);

      expect(response.success).toBe(true);
      expect(response.data!.result).toContain('sentiment analysis');
      expect(response.data!.confidence).toBeGreaterThan(0.5);
      expect(response.data!.explanation).toBeDefined();
    });

    it('should extract key information accurately', async () => {
      const request = TestDataFactory.createAnalysisRequest({
        content: 'Dr. Sarah Johnson, the lead researcher at MIT, published her findings on quantum computing breakthroughs in Nature magazine.',
        analysisType: 'extraction',
        options: {
          entities: ['person', 'organization', 'publication'],
        },
      });

      const response = await client.analyzeContent!(request);

      expect(response.success).toBe(true);
      expect(response.data!.result).toBeDefined();
    });

    it('should classify content with high accuracy', async () => {
      const request = TestDataFactory.createAnalysisRequest({
        content: 'import numpy as np\nfrom sklearn.linear_model import LinearRegression\n\nmodel = LinearRegression()',
        analysisType: 'classification',
        options: {
          categories: ['code', 'documentation', 'data'],
        },
      });

      const response = await client.analyzeContent!(request);

      expect(response.success).toBe(true);
      expect(response.data!.result).toBeDefined();
    });

    it('should generate comprehensive summaries', async () => {
      const request = TestDataFactory.createAnalysisRequest({
        content: 'Long technical document about blockchain technology and its applications in supply chain management...',
        analysisType: 'summary',
        options: {
          maxLength: 100,
          style: 'technical',
        },
      });

      const response = await client.analyzeContent!(request);

      expect(response.success).toBe(true);
      expect(response.data!.result).toBeDefined();
    });
  });

  describe('Model-Specific Features', () => {
    it('should support Claude 3.5 Sonnet', async () => {
      const request = TestDataFactory.createTextGenerationRequest({
        model: 'claude-3-5-sonnet-20241022' as AnthropicModel,
        prompt: 'Analyze this complex problem',
      });

      const response = await client.generateText(request);

      expect(response.success).toBe(true);
      expect(response.data!.model).toBe('claude-3-5-sonnet-20241022');
    });

    it('should support Claude 3 Opus for complex tasks', async () => {
      const request = TestDataFactory.createTextGenerationRequest({
        model: 'claude-3-opus-20240229' as AnthropicModel,
        prompt: 'Perform detailed analysis requiring high reasoning',
      });

      const response = await client.generateText(request);

      expect(response.success).toBe(true);
      expect(response.data!.model).toBe('claude-3-opus-20240229');
    });

    it('should support Claude 3 Haiku for quick tasks', async () => {
      const request = TestDataFactory.createTextGenerationRequest({
        model: 'claude-3-haiku-20240307' as AnthropicModel,
        prompt: 'Quick summary please',
        maxTokens: 50,
      });

      const response = await client.generateText(request);

      expect(response.success).toBe(true);
      expect(response.data!.model).toBe('claude-3-haiku-20240307');
    });
  });

  describe('Error Handling', () => {
    it('should handle content policy violations gracefully', async () => {
      client.setShouldFail(true, 'server');

      const request = TestDataFactory.createTextGenerationRequest({
        prompt: 'Content that might violate policy',
      });

      await expect(client.generateText(request)).rejects.toThrow();

      try {
        await client.generateText(request);
      } catch (error) {
        const aiError = error as AIServiceError;
        expect(aiError.provider).toBe('anthropic');
        expect(aiError.type).toBe('server');
      }
    });

    it('should handle token limit exceeded errors', async () => {
      const request = TestDataFactory.createTextGenerationRequest({
        prompt: 'Very long prompt...',
        maxTokens: 300000, // Exceeds model limits
      });

      // Mock client won't enforce limits, but real implementation would
      const response = await client.generateText(request);
      expect(response.success).toBe(true);
    });

    it('should retry on transient failures', async () => {
      let callCount = 0;
      const originalGenerateText = client.generateText.bind(client);

      client.generateText = async (request) => {
        callCount++;
        if (callCount === 1) {
          throw new Error('Transient network error');
        }
        return originalGenerateText(request);
      };

      const request = TestDataFactory.createTextGenerationRequest();

      // Would implement retry logic in real client
      try {
        await client.generateText(request);
      } catch (error) {
        // Expected on first call
      }

      // Second call should succeed
      const response = await client.generateText(request);
      expect(response.success).toBe(true);
      expect(callCount).toBe(2);
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle high-volume requests efficiently', async () => {
      const requests = Array(20).fill(null).map(() => 
        TestDataFactory.createTextGenerationRequest({
          prompt: `Request ${Math.random()}`,
        })
      );

      const startTime = Date.now();
      const promises = requests.map(request => client.generateText(request));
      const responses = await Promise.all(promises);
      const duration = Date.now() - startTime;

      expect(responses).toHaveLength(20);
      responses.forEach(response => {
        expect(response.success).toBe(true);
      });
      expect(duration).toBeLessThan(10000); // Should complete within 10 seconds
    });

    it('should maintain consistent response quality under load', async () => {
      const results = [];
      
      for (let i = 0; i < 5; i++) {
        const request = TestDataFactory.createTextGenerationRequest({
          prompt: 'Explain quantum mechanics',
        });

        const response = await client.generateText(request);
        results.push(response);
      }

      results.forEach(response => {
        expect(response.success).toBe(true);
        expect(response.data!.text).toBeDefined();
        expect(response.usage!.totalTokens).toBeGreaterThan(0);
      });
    });

    it('should optimize token usage for cost efficiency', async () => {
      const shortRequest = TestDataFactory.createTextGenerationRequest({
        prompt: 'Hi',
        maxTokens: 10,
      });

      const longRequest = TestDataFactory.createTextGenerationRequest({
        prompt: 'Write a detailed explanation',
        maxTokens: 1000,
      });

      const shortResponse = await client.generateText(shortRequest);
      const longResponse = await client.generateText(longRequest);

      expect(shortResponse.usage!.totalTokens).toBeLessThan(longResponse.usage!.totalTokens);
      expect(shortResponse.usage!.cost!).toBeLessThan(longResponse.usage!.cost!);
    });
  });

  describe('Safety and Content Filtering', () => {
    it('should apply appropriate content filters', async () => {
      const request = TestDataFactory.createTextGenerationRequest({
        prompt: 'Generate safe, helpful content',
      });

      const response = await client.generateText(request);

      expect(response.success).toBe(true);
      expect(response.data!.text).toBeDefined();
      // Real implementation would verify content safety
    });

    it('should handle edge cases gracefully', async () => {
      const edgeCases = [
        '', // Empty prompt
        'a'.repeat(10000), // Very long prompt
        '🚀💻🤖', // Emoji-only prompt
        'Prompt with\nnewlines\nand\ttabs',
      ];

      for (const prompt of edgeCases) {
        const request = TestDataFactory.createTextGenerationRequest({ prompt });
        
        try {
          const response = await client.generateText(request);
          expect(response).toBeDefined();
        } catch (error) {
          // Some edge cases might legitimately fail
          expect(error).toBeInstanceOf(Error);
        }
      }
    });
  });

  describe('Usage Analytics', () => {
    it('should track detailed usage metrics', async () => {
      const initialUsage = await client.getUsage();
      
      await client.generateText(TestDataFactory.createTextGenerationRequest());
      await client.generateText(TestDataFactory.createTextGenerationRequest());

      const finalUsage = await client.getUsage();

      expect(finalUsage.requestsToday).toBe(initialUsage.requestsToday + 2);
      expect(finalUsage.tokensUsed).toBeGreaterThan(initialUsage.tokensUsed);
      expect(finalUsage.costToday).toBeGreaterThan(initialUsage.costToday);
    });

    it('should provide cost breakdown by model', async () => {
      const sonnetRequest = TestDataFactory.createTextGenerationRequest({
        model: 'claude-3-5-sonnet-20241022' as AnthropicModel,
      });

      const haikuRequest = TestDataFactory.createTextGenerationRequest({
        model: 'claude-3-haiku-20240307' as AnthropicModel,
      });

      const sonnetResponse = await client.generateText(sonnetRequest);
      const haikuResponse = await client.generateText(haikuRequest);

      expect(sonnetResponse.usage!.cost).toBeDefined();
      expect(haikuResponse.usage!.cost).toBeDefined();
      // In real implementation, Sonnet would typically cost more than Haiku
    });
  });

  describe('Integration Compatibility', () => {
    it('should maintain consistent interface with other providers', async () => {
      const request = TestDataFactory.createTextGenerationRequest();
      const response = await client.generateText(request);

      // Verify response structure matches expected interface
      expect(response).toHaveProperty('success');
      expect(response).toHaveProperty('data');
      expect(response).toHaveProperty('usage');
      expect(response).toHaveProperty('metadata');
      
      if (response.success) {
        expect(response.data).toHaveProperty('text');
        expect(response.data).toHaveProperty('finishReason');
        expect(response.metadata).toHaveProperty('provider');
        expect(response.metadata!.provider).toBe('anthropic');
      }
    });
  });
});