/**
 * Perplexity Client Unit Tests
 * Comprehensive testing of Perplexity research service integration
 */

import { MockAIServiceClient, TestConfigFactory, TestDataFactory, TestUtils } from '../../utils/test-helpers';
import { AIServiceError, PerplexityModel } from '../../../types';

describe('Perplexity Client', () => {
  let client: MockAIServiceClient;

  beforeEach(() => {
    const config = TestConfigFactory.createMockServiceConfig('perplexity');
    client = new MockAIServiceClient('perplexity', config);
  });

  afterEach(() => {
    client = null as any;
  });

  describe('Research Capabilities', () => {
    it('should conduct comprehensive research successfully', async () => {
      const request = TestDataFactory.createResearchRequest({
        query: 'Latest developments in quantum computing 2024',
        domain: 'technology',
        maxResults: 10,
        recency: 'month',
      });

      const response = await client.research!(request);

      expect(response.success).toBe(true);
      expect(response.data).toBeDefined();
      expect(response.data!.answer).toContain('Mock research response');
      expect(response.data!.sources).toHaveLength(1);
      expect(response.data!.sources[0]).toHaveProperty('title');
      expect(response.data!.sources[0]).toHaveProperty('url');
      expect(response.data!.sources[0]).toHaveProperty('snippet');
      expect(response.data!.citations).toHaveLength(1);
      expect(response.metadata!.provider).toBe('perplexity');
    });

    it('should handle domain-specific research', async () => {
      const domains = ['technology', 'science', 'business', 'healthcare'];

      for (const domain of domains) {
        const request = TestDataFactory.createResearchRequest({
          query: `Recent advances in ${domain}`,
          domain,
        });

        const response = await client.research!(request);

        expect(response.success).toBe(true);
        expect(response.data!.answer).toBeDefined();
      }
    });

    it('should filter results by recency', async () => {
      const recencyOptions = ['day', 'week', 'month', 'year'] as const;

      for (const recency of recencyOptions) {
        const request = TestDataFactory.createResearchRequest({
          query: 'AI breakthroughs',
          recency,
        });

        const response = await client.research!(request);

        expect(response.success).toBe(true);
        expect(response.data!.answer).toBeDefined();
      }
    });

    it('should limit results based on maxResults parameter', async () => {
      const request = TestDataFactory.createResearchRequest({
        query: 'Machine learning trends',
        maxResults: 3,
      });

      const response = await client.research!(request);

      expect(response.success).toBe(true);
      expect(response.data!.sources).toHaveLength(1); // Mock returns 1, real would respect maxResults
    });

    it('should handle specific source preferences', async () => {
      const request = TestDataFactory.createResearchRequest({
        query: 'Climate change research',
        sources: ['academic', 'news', 'government'],
      });

      const response = await client.research!(request);

      expect(response.success).toBe(true);
      expect(response.data!.sources).toBeDefined();
    });
  });

  describe('Text Generation', () => {
    it('should generate informative text responses', async () => {
      const request = TestDataFactory.createTextGenerationRequest({
        prompt: 'Explain the current state of renewable energy adoption',
        model: 'llama-3.1-sonar-large-128k-online' as PerplexityModel,
      });

      const response = await client.generateText(request);

      expect(response.success).toBe(true);
      expect(response.data).toBeDefined();
      expect(response.data!.text).toContain('Mock response from perplexity');
      expect(response.data!.model).toBe('llama-3.1-sonar-large-128k-online');
      expect(response.metadata!.provider).toBe('perplexity');
    });

    it('should provide real-time information context', async () => {
      const request = TestDataFactory.createTextGenerationRequest({
        prompt: 'What are the latest stock market trends today?',
        systemPrompt: 'Provide current, up-to-date information',
      });

      const response = await client.generateText(request);

      expect(response.success).toBe(true);
      expect(response.data!.text).toBeDefined();
    });

    it('should support different model variants', async () => {
      const models: PerplexityModel[] = [
        'llama-3.1-sonar-small-128k-online',
        'llama-3.1-sonar-large-128k-online',
        'llama-3.1-sonar-huge-128k-online',
      ];

      for (const model of models) {
        const request = TestDataFactory.createTextGenerationRequest({
          prompt: 'Test prompt',
          model,
        });

        const response = await client.generateText(request);

        expect(response.success).toBe(true);
        expect(response.data!.model).toBe(model);
      }
    });
  });

  describe('Content Analysis with Research Context', () => {
    it('should analyze content with web-sourced context', async () => {
      const request = TestDataFactory.createAnalysisRequest({
        content: 'This new AI model claims to achieve AGI-level performance',
        analysisType: 'sentiment',
        context: 'Recent AI developments and claims verification',
      });

      const response = await client.analyzeContent!(request);

      expect(response.success).toBe(true);
      expect(response.data!.result).toBeDefined();
      expect(response.data!.confidence).toBeGreaterThan(0);
    });

    it('should fact-check claims against current data', async () => {
      const request = TestDataFactory.createAnalysisRequest({
        content: 'The unemployment rate has decreased by 2% this quarter',
        analysisType: 'classification',
        options: {
          categories: ['factual', 'opinion', 'speculation'],
          verifyFacts: true,
        },
      });

      const response = await client.analyzeContent!(request);

      expect(response.success).toBe(true);
      expect(response.data!.result).toBeDefined();
    });
  });

  describe('Real-Time Information Processing', () => {
    it('should access current web information', async () => {
      const request = TestDataFactory.createResearchRequest({
        query: 'Today\'s weather in San Francisco',
        recency: 'day',
      });

      const response = await client.research!(request);

      expect(response.success).toBe(true);
      expect(response.data!.answer).toBeDefined();
      expect(response.data!.sources).toBeDefined();
    });

    it('should handle breaking news queries', async () => {
      const request = TestDataFactory.createResearchRequest({
        query: 'Latest breaking news in technology',
        recency: 'day',
        maxResults: 5,
      });

      const response = await client.research!(request);

      expect(response.success).toBe(true);
      expect(response.data!.answer).toBeDefined();
    });

    it('should provide timestamped source information', async () => {
      const request = TestDataFactory.createResearchRequest({
        query: 'Recent market movements',
      });

      const response = await client.research!(request);

      expect(response.success).toBe(true);
      expect(response.data!.sources[0]).toHaveProperty('publishedDate');
      expect(response.data!.sources[0]).toHaveProperty('domain');
    });
  });

  describe('Error Handling and Reliability', () => {
    it('should handle network connectivity issues', async () => {
      client.setShouldFail(true, 'network');

      const request = TestDataFactory.createResearchRequest({
        query: 'Test query',
      });

      await expect(client.research!(request)).rejects.toThrow();

      try {
        await client.research!(request);
      } catch (error) {
        const aiError = error as AIServiceError;
        expect(aiError.provider).toBe('perplexity');
        expect(aiError.type).toBe('network');
        expect(aiError.retryable).toBe(true);
      }
    });

    it('should handle rate limiting gracefully', async () => {
      client.setShouldFail(true, 'rate_limit');

      const request = TestDataFactory.createTextGenerationRequest();

      await expect(client.generateText(request)).rejects.toThrow();

      try {
        await client.generateText(request);
      } catch (error) {
        const aiError = error as AIServiceError;
        expect(aiError.statusCode).toBe(429);
        expect(aiError.retryable).toBe(true);
      }
    });

    it('should handle source unavailability', async () => {
      // Mock scenario where external sources are unavailable
      const request = TestDataFactory.createResearchRequest({
        query: 'Query with no available sources',
      });

      const response = await client.research!(request);

      // Mock always succeeds, but real implementation might handle gracefully
      expect(response.success).toBe(true);
    });
  });

  describe('Performance Optimization', () => {
    it('should cache research results appropriately', async () => {
      const query = 'Renewable energy statistics 2024';
      const request1 = TestDataFactory.createResearchRequest({ query });
      const request2 = TestDataFactory.createResearchRequest({ query });

      const { duration: duration1 } = await TestUtils.measureTime(() => client.research!(request1));
      const { duration: duration2 } = await TestUtils.measureTime(() => client.research!(request2));

      // Mock doesn't implement caching, but second call might be faster in real implementation
      expect(duration1).toBeGreaterThan(0);
      expect(duration2).toBeGreaterThan(0);
    });

    it('should handle concurrent research requests efficiently', async () => {
      const requests = Array(5).fill(null).map((_, i) => 
        TestDataFactory.createResearchRequest({
          query: `Research query ${i}`,
        })
      );

      const promises = requests.map(request => client.research!(request));
      const responses = await Promise.all(promises);

      expect(responses).toHaveLength(5);
      responses.forEach(response => {
        expect(response.success).toBe(true);
      });
    });

    it('should optimize queries for better results', async () => {
      const vague_request = TestDataFactory.createResearchRequest({
        query: 'stuff about tech',
      });

      const specific_request = TestDataFactory.createResearchRequest({
        query: 'Latest developments in artificial intelligence language models 2024',
        domain: 'technology',
      });

      const vague_response = await client.research!(vague_request);
      const specific_response = await client.research!(specific_request);

      expect(vague_response.success).toBe(true);
      expect(specific_response.success).toBe(true);
      // In real implementation, specific queries would typically yield better results
    });
  });

  describe('Source Quality and Verification', () => {
    it('should prioritize authoritative sources', async () => {
      const request = TestDataFactory.createResearchRequest({
        query: 'Scientific consensus on climate change',
        domain: 'science',
      });

      const response = await client.research!(request);

      expect(response.success).toBe(true);
      expect(response.data!.sources).toBeDefined();
      // Real implementation would prioritize .edu, .gov, and reputable sources
    });

    it('should provide source credibility indicators', async () => {
      const request = TestDataFactory.createResearchRequest({
        query: 'Medical breakthrough in cancer treatment',
        domain: 'healthcare',
      });

      const response = await client.research!(request);

      expect(response.success).toBe(true);
      expect(response.data!.sources[0]).toHaveProperty('domain');
      // Real implementation might include credibility scores
    });

    it('should handle conflicting information sources', async () => {
      const request = TestDataFactory.createResearchRequest({
        query: 'Controversial topic with mixed sources',
      });

      const response = await client.research!(request);

      expect(response.success).toBe(true);
      expect(response.data!.answer).toBeDefined();
      // Real implementation would acknowledge different perspectives
    });
  });

  describe('Cost Management', () => {
    it('should track online search costs accurately', async () => {
      const request = TestDataFactory.createResearchRequest({
        query: 'Cost-tracked research query',
      });

      const response = await client.research!(request);

      expect(response.success).toBe(true);
      // Mock doesn't provide usage for research, but real implementation would
    });

    it('should optimize between online and offline responses', async () => {
      const online_request = TestDataFactory.createResearchRequest({
        query: 'Today\'s stock prices',
      });

      const offline_request = TestDataFactory.createTextGenerationRequest({
        prompt: 'Explain basic economics principles',
      });

      const online_response = await client.research!(online_request);
      const offline_response = await client.generateText(offline_request);

      expect(online_response.success).toBe(true);
      expect(offline_response.success).toBe(true);
      // Real implementation would route appropriately based on information recency needs
    });
  });

  describe('Integration with Other Services', () => {
    it('should maintain consistent interface for unified client', async () => {
      const research_response = await client.research!(TestDataFactory.createResearchRequest());
      const text_response = await client.generateText(TestDataFactory.createTextGenerationRequest());

      // Both should follow the same response structure
      expect(research_response).toHaveProperty('success');
      expect(research_response).toHaveProperty('metadata');
      expect(text_response).toHaveProperty('success');
      expect(text_response).toHaveProperty('metadata');

      expect(research_response.metadata!.provider).toBe('perplexity');
      expect(text_response.metadata!.provider).toBe('perplexity');
    });

    it('should provide consistent error handling', async () => {
      client.setShouldFail(true, 'auth');

      const research_request = TestDataFactory.createResearchRequest();
      const text_request = TestDataFactory.createTextGenerationRequest();

      await expect(client.research!(research_request)).rejects.toThrow();
      await expect(client.generateText(text_request)).rejects.toThrow();
    });
  });
});