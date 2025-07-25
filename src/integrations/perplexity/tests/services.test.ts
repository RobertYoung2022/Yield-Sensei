/**
 * Services Tests
 * Comprehensive test suite for all Perplexity services
 */

import { FinancialDataService } from '../services/financial-data.service';
import { RegulatoryMonitoringService } from '../services/regulatory-monitoring.service';
import { MarketIntelligenceService } from '../services/market-intelligence.service';
import { ExportService } from '../services/export.service';
import { PerplexityClient } from '../client/perplexity-client';

// Mock dependencies
jest.mock('../client/perplexity-client');
jest.mock('@/shared/logging/logger');

describe('Perplexity Services', () => {
  let mockClient: jest.Mocked<PerplexityClient>;

  beforeEach(() => {
    mockClient = new PerplexityClient({
      apiKey: 'test-key'
    }) as jest.Mocked<PerplexityClient>;

    // Mock the chat method
    mockClient.chat = jest.fn();
  });

  describe('FinancialDataService', () => {
    let service: FinancialDataService;

    beforeEach(() => {
      service = new FinancialDataService(mockClient);
    });

    describe('getSecFilings', () => {
      it('should fetch SEC filings successfully', async () => {
        const mockResponse = {
          choices: [{
            message: {
              content: `Filing 1:
                Form Type: 10-K
                Filing Date: 2024-01-15
                Revenue: $1,000 million
                Net Income: $100 million`
            }
          }],
          citations: [{ url: 'https://sec.gov/filing1' }]
        };

        mockClient.chat.mockResolvedValue(mockResponse);

        const query = {
          company: 'Test Corp',
          ticker: 'TEST',
          formTypes: ['10-K'],
          includeAnalysis: false
        };

        const result = await service.getSecFilings(query);

        expect(result).toHaveLength(1);
        expect(result[0]).toHaveProperty('companyName', 'Test Corp');
        expect(result[0]).toHaveProperty('formType', '10-K');
        expect(mockClient.chat).toHaveBeenCalledWith(
          expect.objectContaining({
            model: 'sonar-medium-chat',
            messages: expect.arrayContaining([
              expect.objectContaining({
                role: 'user',
                content: expect.stringContaining('Test Corp')
              })
            ])
          })
        );
      });

      it('should include analysis when requested', async () => {
        const mockFilingResponse = {
          choices: [{
            message: {
              content: `Filing 1:
                Form Type: 10-K
                Filing Date: 2024-01-15
                Revenue: $1,000 million
                Net Income: $100 million`
            }
          }]
        };

        const mockAnalysisResponse = {
          choices: [{
            message: {
              content: `Gross Margin: 25%
                Operating Margin: 15%
                Net Margin: 10%
                ROE: 12%`
            }
          }]
        };

        mockClient.chat
          .mockResolvedValueOnce(mockFilingResponse)
          .mockResolvedValueOnce(mockAnalysisResponse);

        const query = {
          company: 'Test Corp',
          includeAnalysis: true
        };

        const result = await service.getSecFilings(query);

        expect(result[0]).toHaveProperty('analysis');
        expect(result[0].analysis?.profitabilityMetrics.grossMargin).toBe(25);
        expect(mockClient.chat).toHaveBeenCalledTimes(2);
      });

      it('should handle errors gracefully', async () => {
        mockClient.chat.mockRejectedValue(new Error('API Error'));

        const query = { company: 'Test Corp' };

        await expect(service.getSecFilings(query)).rejects.toThrow('API Error');
      });
    });

    describe('getEarningsData', () => {
      it('should fetch earnings data successfully', async () => {
        const mockResponse = {
          choices: [{
            message: {
              content: `Q1 2024:
                Revenue: $500 million
                Revenue Growth YoY: 10%
                EPS: $1.25
                EPS Estimate: $1.20`
            }
          }]
        };

        mockClient.chat.mockResolvedValue(mockResponse);

        const result = await service.getEarningsData('Test Corp', 4);

        expect(result).toHaveLength(1);
        expect(result[0]).toHaveProperty('quarter', 'Q1');
        expect(result[0]).toHaveProperty('year', 2024);
        expect(mockClient.chat).toHaveBeenCalledWith(
          expect.objectContaining({
            messages: expect.arrayContaining([
              expect.objectContaining({
                content: expect.stringContaining('last 4 quarters')
              })
            ])
          })
        );
      });
    });

    describe('compareFinancials', () => {
      it('should compare multiple companies', async () => {
        const mockResponse = {
          choices: [{
            message: {
              content: `Company: Apple Inc
                Revenue: $394.3 billion
                Revenue Growth: 7.8%
                Net Margin: 26.3%
                
                Company: Microsoft Corp
                Revenue: $211.9 billion
                Revenue Growth: 12.1%
                Net Margin: 34.1%`
            }
          }]
        };

        mockClient.chat.mockResolvedValue(mockResponse);

        const companies = ['Apple Inc', 'Microsoft Corp'];
        const result = await service.compareFinancials(companies);

        expect(result).toHaveProperty('companies');
        expect(result.companies).toHaveProperty('Apple Inc');
        expect(result.companies).toHaveProperty('Microsoft Corp');
      });
    });
  });

  describe('RegulatoryMonitoringService', () => {
    let service: RegulatoryMonitoringService;

    beforeEach(() => {
      service = new RegulatoryMonitoringService(mockClient);
    });

    describe('getRegulatoryAlerts', () => {
      it('should fetch regulatory alerts successfully', async () => {
        const mockResponse = {
          choices: [{
            message: {
              content: `Update 1:
                Type: New Regulation
                Severity: High
                Agency: SEC
                Title: New Crypto Disclosure Rules
                Summary: Enhanced disclosure requirements for crypto assets
                Effective Date: 2024-06-01
                Impacted Areas: Cryptocurrency, Securities`
            }
          }],
          citations: [{ url: 'https://sec.gov/rules/new-crypto-rules' }]
        };

        mockClient.chat.mockResolvedValue(mockResponse);

        const query = {
          jurisdictions: ['US'],
          categories: ['crypto'],
          includeAnalysis: false
        };

        const result = await service.getRegulatoryAlerts(query);

        expect(result).toHaveLength(1);
        expect(result[0]).toHaveProperty('type', 'new-regulation');
        expect(result[0]).toHaveProperty('severity', 'high');
        expect(result[0]).toHaveProperty('jurisdiction', 'US');
        expect(result[0].impactedAreas).toContain('Cryptocurrency');
      });

      it('should include analysis when requested', async () => {
        const mockAlertResponse = {
          choices: [{
            message: {
              content: `Update 1:
                Type: New Regulation
                Severity: High
                Title: Test Regulation`
            }
          }]
        };

        const mockAnalysisResponse = {
          choices: [{
            message: {
              content: `Business Impact: Significant
                Required Actions:
                - Update compliance procedures
                - Train staff on new requirements
                Compliance Cost: $50,000`
            }
          }]
        };

        mockClient.chat
          .mockResolvedValueOnce(mockAlertResponse)
          .mockResolvedValueOnce(mockAnalysisResponse);

        const query = {
          jurisdictions: ['US'],
          includeAnalysis: true
        };

        const result = await service.getRegulatoryAlerts(query);

        expect(result[0]).toHaveProperty('analysis');
        expect(result[0].analysis?.impactAssessment.businessImpact).toBe('significant');
        expect(mockClient.chat).toHaveBeenCalledTimes(2);
      });
    });

    describe('checkCompliance', () => {
      it('should check compliance requirements', async () => {
        const mockResponse = {
          choices: [{
            message: {
              content: `Required Licenses:
                - Money Services Business License
                - State Money Transmitter License
                
                Reporting Requirements:
                - Monthly transaction reports
                - Annual compliance reports`
            }
          }],
          citations: [{ url: 'https://treasury.gov/compliance' }]
        };

        mockClient.chat.mockResolvedValue(mockResponse);

        const request = {
          entity: 'Test Exchange',
          jurisdiction: 'US',
          activities: ['crypto-trading', 'custody']
        };

        const result = await service.checkCompliance(request);

        expect(result).toHaveProperty('licenses');
        expect(result).toHaveProperty('reporting');
        expect(result.licenses).toContain('Money Services Business License');
      });
    });

    describe('Monitoring', () => {
      it('should start monitoring successfully', async () => {
        const mockResponse = {
          choices: [{ message: { content: 'No new alerts' } }]
        };

        mockClient.chat.mockResolvedValue(mockResponse);

        const callback = jest.fn();
        const monitoringId = await service.startMonitoring(['US'], 1000, callback);

        expect(monitoringId).toMatch(/^monitor-/);
        expect(typeof monitoringId).toBe('string');

        // Clean up
        service.stopMonitoring(monitoringId);
      });

      it('should stop monitoring', async () => {
        mockClient.chat.mockResolvedValue({
          choices: [{ message: { content: 'No alerts' } }]
        });

        const callback = jest.fn();
        const monitoringId = await service.startMonitoring(['US'], 1000, callback);
        
        // Should not throw
        expect(() => service.stopMonitoring(monitoringId)).not.toThrow();
      });
    });
  });

  describe('MarketIntelligenceService', () => {
    let service: MarketIntelligenceService;

    beforeEach(() => {
      service = new MarketIntelligenceService(mockClient);
    });

    describe('getMarketIntelligence', () => {
      it('should fetch comprehensive market intelligence', async () => {
        const mockSentimentResponse = {
          choices: [{
            message: {
              content: `Overall sentiment: 0.6
                Bullish: 65%
                Bearish: 25%
                Neutral: 10%
                Confidence: 0.8`
            }
          }]
        };

        mockClient.chat.mockResolvedValue(mockSentimentResponse);

        const query = {
          assetId: 'AAPL',
          assetType: 'stock' as const,
          includeSentiment: true,
          includeAnalystRatings: false,
          includeNews: false,
          includeTrends: false
        };

        const result = await service.getMarketIntelligence(query);

        expect(result).toHaveProperty('assetId', 'AAPL');
        expect(result).toHaveProperty('sentiment');
        expect(result.sentiment.overall).toBe(0.6);
        expect(result.sentiment.bullish).toBe(0.65);
        expect(result.sentiment.confidence).toBe(0.8);
      });

      it('should include analyst ratings when requested', async () => {
        const mockSentimentResponse = {
          choices: [{ message: { content: 'Overall sentiment: 0.5' } }]
        };

        const mockRatingsResponse = {
          choices: [{
            message: {
              content: `Consensus: Buy
                Average target: $180
                High target: $200
                Low target: $160
                15 analysts`
            }
          }]
        };

        mockClient.chat
          .mockResolvedValueOnce(mockSentimentResponse)
          .mockResolvedValueOnce(mockRatingsResponse);

        const query = {
          assetId: 'AAPL',
          assetType: 'stock' as const,
          includeAnalystRatings: true
        };

        const result = await service.getMarketIntelligence(query);

        expect(result).toHaveProperty('analystRatings');
        expect(result.analystRatings?.consensus).toBe('buy');
        expect(result.analystRatings?.averageTarget).toBe(180);
        expect(result.analystRatings?.numberOfAnalysts).toBe(15);
      });
    });

    describe('analyzeSentiment', () => {
      it('should analyze text sentiment', async () => {
        const mockResponse = {
          choices: [{
            message: {
              content: 'Sentiment score: 0.75'
            }
          }]
        };

        mockClient.chat.mockResolvedValue(mockResponse);

        const request = {
          text: 'This stock is performing excellently with strong fundamentals',
          context: 'financial analysis'
        };

        const result = await service.analyzeSentiment(request);

        expect(result).toBe(0.75);
        expect(mockClient.chat).toHaveBeenCalledWith(
          expect.objectContaining({
            model: 'sonar-small-chat',
            messages: expect.arrayContaining([
              expect.objectContaining({
                content: expect.stringContaining(request.text)
              })
            ])
          })
        );
      });

      it('should return 0 on analysis failure', async () => {
        mockClient.chat.mockRejectedValue(new Error('API Error'));

        const request = { text: 'Test text' };
        const result = await service.analyzeSentiment(request);

        expect(result).toBe(0);
      });
    });
  });

  describe('ExportService', () => {
    let service: ExportService;
    const mockOutputDir = './test-exports';

    beforeEach(() => {
      service = new ExportService(mockOutputDir);
    });

    describe('exportData', () => {
      it('should export data to JSON successfully', async () => {
        // Mock file system operations
        const fs = require('fs/promises');
        jest.spyOn(fs, 'mkdir').mockResolvedValue(undefined);
        jest.spyOn(fs, 'writeFile').mockResolvedValue(undefined);

        const request = {
          type: 'financial' as const,
          format: 'json' as const
        };

        const result = await service.exportData(request);

        expect(result).toHaveProperty('filename');
        expect(result).toHaveProperty('format', 'json');
        expect(result).toHaveProperty('size');
        expect(result).toHaveProperty('generatedAt');
        expect(fs.writeFile).toHaveBeenCalled();
      });

      it('should export data to CSV successfully', async () => {
        const fs = require('fs/promises');
        jest.spyOn(fs, 'mkdir').mockResolvedValue(undefined);
        jest.spyOn(fs, 'writeFile').mockResolvedValue(undefined);

        const request = {
          type: 'regulatory' as const,
          format: 'csv' as const
        };

        const result = await service.exportData(request);

        expect(result.format).toBe('csv');
        expect(fs.writeFile).toHaveBeenCalled();
      });

      it('should handle unsupported formats', async () => {
        const request = {
          type: 'financial' as const,
          format: 'unsupported' as any
        };

        await expect(service.exportData(request)).rejects.toThrow(
          'Unsupported export format: unsupported'
        );
      });
    });

    describe('Templates', () => {
      it('should get default templates', () => {
        const templates = service.getTemplates();

        expect(templates.length).toBeGreaterThan(0);
        expect(templates.some(t => t.id === 'financial-report')).toBe(true);
        expect(templates.some(t => t.id === 'regulatory-compliance')).toBe(true);
        expect(templates.some(t => t.id === 'market-intelligence')).toBe(true);
      });

      it('should get specific template', () => {
        const template = service.getTemplate('financial-report');

        expect(template).toBeDefined();
        expect(template?.name).toBe('Financial Analysis Report');
        expect(template?.sections.length).toBeGreaterThan(0);
      });

      it('should create custom template', async () => {
        const customTemplate = {
          id: 'custom-report',
          name: 'Custom Report',
          description: 'Custom analysis report',
          format: 'excel' as const,
          sections: [
            {
              title: 'Custom Section',
              type: 'data-table' as const,
              dataSource: 'custom-data'
            }
          ]
        };

        await service.createTemplate(customTemplate);

        const retrieved = service.getTemplate('custom-report');
        expect(retrieved).toEqual(customTemplate);
      });
    });

    describe('Scheduled Exports', () => {
      it('should create scheduled export', async () => {
        const scheduledExport = {
          id: 'daily-report',
          name: 'Daily Financial Report',
          exportRequest: {
            type: 'financial' as const,
            format: 'pdf' as const
          },
          schedule: {
            frequency: 'daily' as const,
            time: '09:00'
          },
          enabled: true
        };

        const id = await service.createScheduledExport(scheduledExport);

        expect(id).toBe('daily-report');

        const scheduled = service.getScheduledExports();
        expect(scheduled.some(s => s.id === 'daily-report')).toBe(true);
      });

      it('should update scheduled export', async () => {
        const scheduledExport = {
          id: 'weekly-report',
          name: 'Weekly Report',
          exportRequest: {
            type: 'market' as const,
            format: 'excel' as const
          },
          schedule: {
            frequency: 'weekly' as const,
            dayOfWeek: 1
          },
          enabled: true
        };

        await service.createScheduledExport(scheduledExport);

        const updates = {
          enabled: false,
          schedule: {
            frequency: 'weekly' as const,
            dayOfWeek: 2
          }
        };

        await service.updateScheduledExport('weekly-report', updates);

        const scheduled = service.getScheduledExports();
        const updated = scheduled.find(s => s.id === 'weekly-report');

        expect(updated?.enabled).toBe(false);
        expect(updated?.schedule.dayOfWeek).toBe(2);
      });

      it('should delete scheduled export', async () => {
        const scheduledExport = {
          id: 'temp-report',
          name: 'Temporary Report',
          exportRequest: {
            type: 'comprehensive' as const,
            format: 'json' as const
          },
          schedule: {
            frequency: 'daily' as const
          },
          enabled: true
        };

        await service.createScheduledExport(scheduledExport);
        await service.deleteScheduledExport('temp-report');

        const scheduled = service.getScheduledExports();
        expect(scheduled.some(s => s.id === 'temp-report')).toBe(false);
      });

      it('should handle non-existent scheduled export', async () => {
        await expect(service.updateScheduledExport('non-existent', {}))
          .rejects.toThrow('Scheduled export non-existent not found');

        await expect(service.deleteScheduledExport('non-existent'))
          .rejects.toThrow('Scheduled export non-existent not found');
      });
    });
  });
});