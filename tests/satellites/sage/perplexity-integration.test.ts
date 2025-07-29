/**
 * Perplexity Integration Tests for Sage Satellite
 * Tests the Perplexity API integration with mocked responses
 */

import { jest } from '@jest/globals';
import { PerplexityIntegration, DEFAULT_PERPLEXITY_CONFIG } from '../../../src/satellites/sage/api/perplexity-integration';

// Mock logger to prevent console noise during tests
jest.mock('@/shared/logging/logger', () => ({
  getLogger: jest.fn(() => ({
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }))
}));

// Mock axios for API calls
jest.mock('axios', () => ({
  create: jest.fn(() => ({
    interceptors: {
      request: { use: jest.fn() },
      response: { use: jest.fn() }
    },
    get: jest.fn(),
    post: jest.fn()
  })),
  default: {
    create: jest.fn(() => ({
      interceptors: {
        request: { use: jest.fn() },
        response: { use: jest.fn() }
      },
      get: jest.fn(),
      post: jest.fn()
    }))
  }
}));

describe('Perplexity Integration for Sage Satellite', () => {
  let perplexityIntegration: PerplexityIntegration;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Create new instance with mock config using singleton pattern
    const mockConfig = {
      ...DEFAULT_PERPLEXITY_CONFIG,
      apiKey: 'mock_perplexity_api_key_for_testing'
    };
    
    perplexityIntegration = PerplexityIntegration.getInstance(mockConfig);
  });

  afterEach(async () => {
    // Clean up
    if (perplexityIntegration) {
      await perplexityIntegration.shutdown();
    }
  });

  describe('Initialization and Configuration', () => {
    test('should initialize with default configuration', () => {
      expect(perplexityIntegration).toBeDefined();
      const status = perplexityIntegration.getStatus();
      expect(status.isInitialized).toBe(false); // Not initialized until initialize() is called
    });

    test('should initialize successfully with API key', async () => {
      await perplexityIntegration.initialize();
      const status = perplexityIntegration.getStatus();
      expect(status.isInitialized).toBe(true);
    });

    test('should handle missing API key gracefully', async () => {
      const noKeyConfig = {
        ...DEFAULT_PERPLEXITY_CONFIG,
        apiKey: ''
      };
      
      const noKeyIntegration = PerplexityIntegration.getInstance(noKeyConfig);
      await expect(noKeyIntegration.initialize()).rejects.toThrow();
      await noKeyIntegration.shutdown();
    });
  });

  describe('Market Research Queries', () => {
    beforeEach(async () => {
      await perplexityIntegration.initialize();
    });

    test('should handle protocol research queries with mocked responses', async () => {
      // Check if MOCK_EXTERNAL_APIS is enabled
      const mockEnabled = process.env['MOCK_EXTERNAL_APIS'] === 'true';
      
      if (mockEnabled) {
        const mockProtocol = 'Compound Finance';
        const query = `Analyze the fundamental health of ${mockProtocol} protocol`;
        
        const result = await perplexityIntegration.researchMarket(query, 'US');
        
        expect(result).toBeDefined();
        expect(result.summary).toBeDefined();
        expect(result.keyFindings).toBeDefined();
        expect(result.confidence).toBeGreaterThan(0);
        expect(result.sources).toBeDefined();
      } else {
        // Skip test if not in mock mode
        console.log('Skipping Perplexity test - MOCK_EXTERNAL_APIS not enabled');
      }
    });

    test('should handle RWA market analysis with mocked responses', async () => {
      const mockEnabled = process.env['MOCK_EXTERNAL_APIS'] === 'true';
      
      if (mockEnabled) {
        const mockRWAType = 'real-estate';
        const query = `What are the current market conditions for ${mockRWAType} tokenized assets?`;
        
        const result = await perplexityIntegration.researchMarket(query, 'US');
        
        expect(result).toBeDefined();
        expect(result.summary).toBeDefined();
        expect(result.keyFindings).toBeDefined();
        expect(result.sources).toBeDefined();
      } else {
        console.log('Skipping Perplexity test - MOCK_EXTERNAL_APIS not enabled');
      }
    });
  });

  describe('Caching and Rate Limiting', () => {
    beforeEach(async () => {
      await perplexityIntegration.initialize();
    });

    test('should cache responses when enabled', async () => {
      const mockEnabled = process.env['MOCK_EXTERNAL_APIS'] === 'true';
      
      if (mockEnabled) {
        const query = 'Test query for caching';
        
        // First call
        const result1 = await perplexityIntegration.researchMarket(query);
        
        // Second call should be cached
        const result2 = await perplexityIntegration.researchMarket(query);
        
        expect(result1.summary).toBe(result2.summary);
        expect(result1.confidence).toBe(result2.confidence);
        
        const status = perplexityIntegration.getStatus();
        expect(status.cacheSize).toBeGreaterThan(0);
      } else {
        console.log('Skipping caching test - MOCK_EXTERNAL_APIS not enabled');
      }
    });

    test('should respect rate limiting configuration', async () => {
      const status = perplexityIntegration.getStatus();
      expect(status.rateLimitState).toBeDefined();
      expect(status.rateLimitState.requestsThisMinute).toBe(0);
      expect(status.rateLimitState.requestsThisHour).toBe(0);
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      await perplexityIntegration.initialize();
    });

    test('should handle empty queries gracefully', async () => {
      await expect(perplexityIntegration.researchMarket('')).rejects.toThrow();
    });

    test('should handle invalid query parameters', async () => {
      const invalidQuery = null as any;
      await expect(perplexityIntegration.researchMarket(invalidQuery)).rejects.toThrow();
    });
  });

  describe('Integration Status and Metrics', () => {
    test('should provide accurate status information', async () => {
      await perplexityIntegration.initialize();
      
      const status = perplexityIntegration.getStatus();
      expect(status.isInitialized).toBe(true);
      expect(status.cacheSize).toBe(0); // Initially empty
      expect(status.pendingQueriesCount).toBe(0);
      expect(status.rateLimitState).toBeDefined();
    });

    test('should track query metrics', async () => {
      await perplexityIntegration.initialize();
      
      const mockEnabled = process.env['MOCK_EXTERNAL_APIS'] === 'true';
      
      if (mockEnabled) {
        await perplexityIntegration.researchMarket('Test query for metrics');
        
        const status = perplexityIntegration.getStatus();
        expect(status.rateLimitState.requestsThisMinute).toBeGreaterThan(0);
      } else {
        console.log('Skipping metrics test - MOCK_EXTERNAL_APIS not enabled');
      }
    });
  });

  describe('Shutdown and Cleanup', () => {
    test('should shutdown cleanly', async () => {
      await perplexityIntegration.initialize();
      await perplexityIntegration.shutdown();
      
      // After shutdown, status should reflect the change
      const status = perplexityIntegration.getStatus();
      expect(status.cacheSize).toBe(0);
    });
  });
});