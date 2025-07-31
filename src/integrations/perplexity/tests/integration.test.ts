/**
 * Integration Tests
 * End-to-end tests for the complete Perplexity integration
 */

import { PerplexityClient } from '../client/perplexity-client';
import { FinancialDataService } from '../services/financial-data.service';
import { RegulatoryMonitoringService } from '../services/regulatory-monitoring.service';
import { MarketIntelligenceService } from '../services/market-intelligence.service';
import { ExportService } from '../services/export.service';
import { DEFAULT_PERPLEXITY_CONFIG } from '../config/default.config';

// Integration tests require actual API configuration
const isIntegrationTest = process.env['PERPLEXITY_API_KEY'] && process.env['RUN_INTEGRATION_TESTS'];

describe('Perplexity Integration Tests', () => {
  let client: PerplexityClient;
  let financialService: FinancialDataService;
  let regulatoryService: RegulatoryMonitoringService;
  let marketService: MarketIntelligenceService;
  let exportService: ExportService;

  beforeAll(async () => {
    if (!isIntegrationTest) {
      console.log('Skipping integration tests - Set PERPLEXITY_API_KEY and RUN_INTEGRATION_TESTS to run');
      return;
    }

    // Initialize with actual configuration
    const config = {
      ...DEFAULT_PERPLEXITY_CONFIG,
      apiKey: process.env['PERPLEXITY_API_KEY']!,
      rateLimit: {
        ...DEFAULT_PERPLEXITY_CONFIG.rateLimit!,
        maxRequestsPerMinute: 10, // Lower rate for integration tests
      }
    };

    client = new PerplexityClient(config);
    await client.initialize();

    financialService = new FinancialDataService(client);
    regulatoryService = new RegulatoryMonitoringService(client);
    marketService = new MarketIntelligenceService(client);
    exportService = new ExportService('./test-exports');
  });

  afterAll(async () => {
    if (client) {
      await client.shutdown();
    }
  });

  describe('Financial Data Integration', () => {
    it('should fetch real SEC filings data', async () => {
      if (!isIntegrationTest) return;

      const query = {
        company: 'Apple Inc',
        ticker: 'AAPL',
        formTypes: ['10-K'],
        includeAnalysis: false
      };

      const filings = await financialService.getSecFilings(query);

      expect(filings).toBeDefined();
      expect(Array.isArray(filings)).toBe(true);
      
      if (filings.length > 0) {
        expect(filings[0]).toHaveProperty('companyName');
        expect(filings[0]).toHaveProperty('formType');
        expect(filings[0]).toHaveProperty('extractedData');
      }
    }, 60000);

    it('should analyze financial metrics', async () => {
      if (!isIntegrationTest) return;

      const metrics = await financialService.getFinancialMetrics('Microsoft Corporation');

      expect(metrics).toBeDefined();
      expect(typeof metrics).toBe('object');
      expect(metrics).toHaveProperty('profitability');
      expect(metrics).toHaveProperty('liquidity');
      expect(metrics).toHaveProperty('valuation');
    }, 60000);
  });

  describe('Regulatory Monitoring Integration', () => {
    it('should fetch real regulatory alerts', async () => {
      if (!isIntegrationTest) return;

      const query = {
        jurisdictions: ['US'],
        categories: ['securities'],
        severity: ['high', 'critical'] as const
      };

      const alerts = await regulatoryService.getRegulatoryAlerts(query);

      expect(alerts).toBeDefined();
      expect(Array.isArray(alerts)).toBe(true);
      
      if (alerts.length > 0) {
        expect(alerts[0]).toHaveProperty('type');
        expect(alerts[0]).toHaveProperty('severity');
        expect(alerts[0]).toHaveProperty('jurisdiction');
        expect(alerts[0]).toHaveProperty('title');
      }
    }, 60000);

    it('should check compliance requirements', async () => {
      if (!isIntegrationTest) return;

      const request = {
        entity: 'Crypto Exchange',
        jurisdiction: 'US',
        activities: ['cryptocurrency trading', 'custody services']
      };

      const compliance = await regulatoryService.checkCompliance(request);

      expect(compliance).toBeDefined();
      expect(typeof compliance).toBe('object');
      expect(compliance).toHaveProperty('licenses');
      expect(compliance).toHaveProperty('obligations');
    }, 60000);
  });

  describe('Market Intelligence Integration', () => {
    it('should analyze market sentiment', async () => {
      if (!isIntegrationTest) return;

      const query = {
        assetId: 'BTC',
        assetType: 'crypto' as const,
        assetName: 'Bitcoin',
        timeframe: 'week' as const
      };

      const sentiment = await marketService.getMarketSentiment(query);

      expect(sentiment).toBeDefined();
      expect(typeof sentiment.overall).toBe('number');
      expect(sentiment.overall).toBeGreaterThanOrEqual(-1);
      expect(sentiment.overall).toBeLessThanOrEqual(1);
      expect(sentiment.confidence).toBeGreaterThan(0);
      expect(sentiment.confidence).toBeLessThanOrEqual(1);
    }, 60000);

    it('should get comprehensive market intelligence', async () => {
      if (!isIntegrationTest) return;

      const query = {
        assetId: 'TSLA',
        assetType: 'stock' as const,
        assetName: 'Tesla Inc',
        includeSentiment: true,
        includeAnalystRatings: true,
        includeNews: true,
        timeframe: 'month' as const
      };

      const intelligence = await marketService.getMarketIntelligence(query);

      expect(intelligence).toBeDefined();
      expect(intelligence).toHaveProperty('assetId', 'TSLA');
      expect(intelligence).toHaveProperty('sentiment');
      expect(intelligence).toHaveProperty('analystRatings');
      expect(intelligence).toHaveProperty('newsAnalysis');
      expect(intelligence.timestamp).toBeInstanceOf(Date);
    }, 90000);
  });

  describe('Export Service Integration', () => {
    it('should export financial data to JSON', async () => {
      if (!isIntegrationTest) return;

      const request = {
        type: 'financial' as const,
        format: 'json' as const,
        filters: {
          entities: ['Apple Inc'],
          dateRange: {
            start: new Date('2024-01-01'),
            end: new Date('2024-12-31')
          }
        }
      };

      const result = await exportService.exportData(request);

      expect(result).toBeDefined();
      expect(result).toHaveProperty('filename');
      expect(result).toHaveProperty('format', 'json');
      expect(result).toHaveProperty('size');
      expect(result.size).toBeGreaterThan(0);
    }, 30000);

    it('should create and use custom template', async () => {
      if (!isIntegrationTest) return;

      const template = {
        id: 'integration-test-template',
        name: 'Integration Test Report',
        description: 'Test template for integration',
        format: 'json' as const,
        sections: [
          {
            title: 'Test Section',
            type: 'summary' as const,
            dataSource: 'test-data'
          }
        ]
      };

      await exportService.createTemplate(template);

      const testData = {
        metadata: { test: true },
        financialData: { revenue: 1000000 }
      };

      const result = await exportService.generateFromTemplate(
        'integration-test-template',
        testData
      );

      expect(result).toBeDefined();
      expect(result.format).toBe('json');
    }, 30000);
  });

  describe('End-to-End Workflow', () => {
    it('should complete full analysis workflow', async () => {
      if (!isIntegrationTest) return;

      // 1. Get financial data
      const financialQuery = {
        company: 'Microsoft Corporation',
        ticker: 'MSFT'
      };

      const filings = await financialService.getSecFilings(financialQuery);
      expect(filings).toBeDefined();

      // 2. Check regulatory status
      const regulatoryQuery = {
        jurisdictions: ['US'],
        categories: ['technology']
      };

      const alerts = await regulatoryService.getRegulatoryAlerts(regulatoryQuery);
      expect(alerts).toBeDefined();

      // 3. Analyze market sentiment
      const marketQuery = {
        assetId: 'MSFT',
        assetType: 'stock' as const,
        assetName: 'Microsoft Corporation'
      };

      const intelligence = await marketService.getMarketIntelligence(marketQuery);
      expect(intelligence).toBeDefined();

      // 4. Export comprehensive report
      const exportRequest = {
        type: 'comprehensive' as const,
        format: 'json' as const,
        includeCharts: true,
        includeAnalysis: true
      };

      const exportResult = await exportService.exportData(exportRequest);
      expect(exportResult).toBeDefined();
      expect(exportResult.format).toBe('json');

      // Verify the complete workflow produced valid results
      expect(filings.length).toBeGreaterThanOrEqual(0);
      expect(alerts.length).toBeGreaterThanOrEqual(0);
      expect(intelligence.sentiment).toBeDefined();
      expect(exportResult.size).toBeGreaterThan(0);
    }, 180000); // 3 minutes timeout for full workflow
  });

  describe('Performance and Reliability', () => {
    it('should handle concurrent requests', async () => {
      if (!isIntegrationTest) return;

      const companies = ['Apple Inc', 'Microsoft Corporation', 'Amazon.com Inc'];
      
      const promises = companies.map(company =>
        financialService.getFinancialMetrics(company)
      );

      const results = await Promise.all(promises);

      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result).toBeDefined();
        expect(typeof result).toBe('object');
      });
    }, 120000);

    it('should respect rate limits', async () => {
      if (!isIntegrationTest) return;

      const startTime = Date.now();
      
      // Make requests that should trigger rate limiting
      const promises = Array(15).fill(null).map((_, index) =>
        marketService.analyzeSentiment({
          text: `Test sentiment analysis ${index}`,
          context: 'rate limit test'
        })
      );

      const results = await Promise.all(promises);
      const duration = Date.now() - startTime;

      expect(results).toHaveLength(15);
      expect(duration).toBeGreaterThan(5000); // Should take time due to rate limiting
    }, 180000);

    it('should handle API errors gracefully', async () => {
      if (!isIntegrationTest) return;

      // Test with invalid request that should cause API error
      const invalidQuery = {
        company: '', // Empty company name should cause error
        formTypes: ['INVALID_FORM']
      };

      await expect(
        financialService.getSecFilings(invalidQuery)
      ).rejects.toThrow();
    }, 30000);
  });

  describe('Cache and Performance', () => {
    it('should use cache for repeated requests', async () => {
      if (!isIntegrationTest) return;

      const query = {
        assetId: 'AAPL',
        assetType: 'stock' as const
      };

      // First request
      const start1 = Date.now();
      const result1 = await marketService.getMarketSentiment(query);
      const duration1 = Date.now() - start1;

      // Second request (should be cached)
      const start2 = Date.now();
      const result2 = await marketService.getMarketSentiment(query);
      const duration2 = Date.now() - start2;

      expect(result1).toBeDefined();
      expect(result2).toBeDefined();
      
      // Second request should be significantly faster due to caching
      expect(duration2).toBeLessThan(duration1 * 0.5);
    }, 60000);

    it('should provide accurate metrics', async () => {
      if (!isIntegrationTest) return;

      const initialMetrics = client.getMetrics();
      
      await marketService.analyzeSentiment({
        text: 'Test sentiment for metrics',
        context: 'metrics test'
      });

      const finalMetrics = client.getMetrics();

      expect(finalMetrics.totalRequests).toBeGreaterThan(initialMetrics.totalRequests);
      expect(finalMetrics.tokensUsed).toBeGreaterThan(initialMetrics.tokensUsed);
    }, 30000);
  });
});