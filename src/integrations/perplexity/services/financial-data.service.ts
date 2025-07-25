/**
 * Financial Data Service
 * Handles SEC filing analysis and financial data extraction
 */

import { EventEmitter } from 'events';
import { 
  SECFiling, 
  ExtractedFinancialData, 
  FinancialAnalysis,
  DateRange,
  PerplexityRequest,
  PerplexityResponse
} from '../types';
import { PerplexityClient } from '../client/perplexity-client';
import Logger from '@/shared/logging/logger';

const logger = Logger.getLogger('financial-data-service');

export interface FinancialDataQuery {
  company: string;
  ticker?: string;
  formTypes?: string[];
  dateRange?: DateRange;
  includeAnalysis?: boolean;
}

export class FinancialDataService extends EventEmitter {
  private client: PerplexityClient;

  constructor(client: PerplexityClient) {
    super();
    this.client = client;
  }

  async getSecFilings(query: FinancialDataQuery): Promise<SECFiling[]> {
    try {
      logger.info('Fetching SEC filings', query);

      const promptContext = this.buildSecFilingPrompt(query);
      const request: PerplexityRequest = {
        model: 'sonar-medium-chat',
        messages: [
          {
            role: 'system',
            content: 'You are a financial data analyst specializing in SEC filings. Provide accurate, structured data from SEC filings.'
          },
          {
            role: 'user',
            content: promptContext
          }
        ],
        max_tokens: 4000,
        temperature: 0.1,
        return_citations: true
      };

      const response = await this.client.chat(request);
      const filings = this.parseSecFilingResponse(response, query);

      // Optionally perform detailed analysis
      if (query.includeAnalysis) {
        for (const filing of filings) {
          filing.analysis = await this.analyzeFinancialData(filing);
        }
      }

      logger.info('SEC filings retrieved', { 
        company: query.company,
        count: filings.length 
      });

      return filings;
    } catch (error) {
      logger.error('Failed to fetch SEC filings:', error);
      throw error;
    }
  }

  async analyzeFinancialData(filing: SECFiling): Promise<FinancialAnalysis> {
    try {
      logger.info('Analyzing financial data', { 
        company: filing.companyName,
        formType: filing.formType 
      });

      const request: PerplexityRequest = {
        model: 'sonar-medium-chat',
        messages: [
          {
            role: 'system',
            content: 'You are a financial analyst. Calculate key financial metrics and provide insights.'
          },
          {
            role: 'user',
            content: this.buildAnalysisPrompt(filing)
          }
        ],
        max_tokens: 2000,
        temperature: 0.1
      };

      const response = await this.client.chat(request);
      return this.parseFinancialAnalysis(response, filing);
    } catch (error) {
      logger.error('Failed to analyze financial data:', error);
      throw error;
    }
  }

  async getEarningsData(company: string, periods: number = 4): Promise<any[]> {
    try {
      logger.info('Fetching earnings data', { company, periods });

      const request: PerplexityRequest = {
        model: 'sonar-medium-chat',
        messages: [
          {
            role: 'system',
            content: 'You are a financial data analyst. Provide accurate earnings data and trends.'
          },
          {
            role: 'user',
            content: `Provide the last ${periods} quarters of earnings data for ${company}, including:
              1. Revenue and year-over-year growth
              2. EPS (actual vs. estimated)
              3. Net income and margins
              4. Guidance updates
              5. Key earnings highlights
              Format as structured data.`
          }
        ],
        max_tokens: 2000,
        temperature: 0.1,
        return_citations: true
      };

      const response = await this.client.chat(request);
      return this.parseEarningsData(response);
    } catch (error) {
      logger.error('Failed to fetch earnings data:', error);
      throw error;
    }
  }

  async getFinancialMetrics(company: string): Promise<Record<string, any>> {
    try {
      logger.info('Fetching financial metrics', { company });

      const request: PerplexityRequest = {
        model: 'sonar-medium-chat',
        messages: [
          {
            role: 'system',
            content: 'You are a financial analyst. Provide comprehensive financial metrics.'
          },
          {
            role: 'user',
            content: `Analyze financial metrics for ${company}:
              1. Profitability: gross margin, operating margin, net margin, ROE, ROA
              2. Liquidity: current ratio, quick ratio, cash ratio
              3. Efficiency: asset turnover, inventory turnover, receivables turnover
              4. Leverage: debt-to-equity, interest coverage
              5. Valuation: P/E, P/B, P/S, EV/EBITDA
              6. Growth: revenue CAGR, earnings CAGR
              Provide current values and industry comparisons.`
          }
        ],
        max_tokens: 2000,
        temperature: 0.1,
        return_citations: true
      };

      const response = await this.client.chat(request);
      return this.parseFinancialMetrics(response);
    } catch (error) {
      logger.error('Failed to fetch financial metrics:', error);
      throw error;
    }
  }

  async compareFinancials(companies: string[]): Promise<any> {
    try {
      logger.info('Comparing financials', { companies });

      const request: PerplexityRequest = {
        model: 'sonar-medium-chat',
        messages: [
          {
            role: 'system',
            content: 'You are a financial analyst. Provide detailed comparative analysis.'
          },
          {
            role: 'user',
            content: `Compare financial performance of: ${companies.join(', ')}
              Include:
              1. Revenue and growth rates
              2. Profitability metrics
              3. Balance sheet strength
              4. Cash flow generation
              5. Valuation multiples
              6. Competitive positioning
              Highlight strengths and weaknesses of each company.`
          }
        ],
        max_tokens: 3000,
        temperature: 0.1,
        return_citations: true
      };

      const response = await this.client.chat(request);
      return this.parseComparativeAnalysis(response);
    } catch (error) {
      logger.error('Failed to compare financials:', error);
      throw error;
    }
  }

  private buildSecFilingPrompt(query: FinancialDataQuery): string {
    let prompt = `Retrieve SEC filing information for ${query.company}`;
    
    if (query.ticker) {
      prompt += ` (${query.ticker})`;
    }

    if (query.formTypes && query.formTypes.length > 0) {
      prompt += `. Focus on ${query.formTypes.join(', ')} forms`;
    }

    if (query.dateRange) {
      prompt += `. Date range: ${query.dateRange.start.toISOString().split('T')[0]} to ${query.dateRange.end.toISOString().split('T')[0]}`;
    }

    prompt += `
    For each filing, provide:
    1. Form type and filing date
    2. Period end date
    3. Key financial data: revenue, net income, EPS, total assets, total liabilities, shareholder equity
    4. Cash flow data: operating, investing, financing, free cash flow
    5. Segment performance (if applicable)
    6. Notable risk factors mentioned
    7. Management discussion highlights
    8. Direct links to SEC EDGAR filings
    
    Format the response as structured data that can be parsed.`;

    return prompt;
  }

  private buildAnalysisPrompt(filing: SECFiling): string {
    const data = filing.extractedData;
    
    return `Analyze the following financial data from ${filing.companyName}'s ${filing.formType}:
    
    Revenue: ${data.revenue}
    Net Income: ${data.netIncome}
    EPS: ${data.eps}
    Total Assets: ${data.totalAssets}
    Total Liabilities: ${data.totalLiabilities}
    Shareholder Equity: ${data.shareholderEquity}
    
    Calculate and provide:
    1. Profitability metrics: gross margin, operating margin, net margin, ROE, ROA
    2. Liquidity metrics: current ratio, quick ratio, working capital
    3. Efficiency metrics: asset turnover
    4. Growth metrics: YoY and QoQ growth rates
    5. Key insights and concerns
    
    Format as structured metrics data.`;
  }

  private parseSecFilingResponse(response: PerplexityResponse, query: FinancialDataQuery): SECFiling[] {
    const content = response.choices[0]?.message?.content || '';
    const filings: SECFiling[] = [];

    try {
      // Parse the structured response
      // This is a simplified parser - in production, you'd want more robust parsing
      const sections = content.split(/Filing \d+:|SEC Filing:/gi).filter(s => s.trim());
      
      for (const section of sections) {
        const filing = this.extractFilingData(section, query);
        if (filing) {
          filings.push(filing);
        }
      }

      // Add citations as metadata
      if (response.citations) {
        filings.forEach(filing => {
          filing.documentUrl = response.citations?.[0]?.url || '';
        });
      }
    } catch (error) {
      logger.error('Failed to parse SEC filing response:', error);
    }

    return filings;
  }

  private extractFilingData(section: string, query: FinancialDataQuery): SECFiling | null {
    try {
      // Extract data using regex patterns
      const formTypeMatch = section.match(/Form Type:\s*(\S+)/i);
      const filingDateMatch = section.match(/Filing Date:\s*(\d{4}-\d{2}-\d{2})/i);
      const periodEndMatch = section.match(/Period End:\s*(\d{4}-\d{2}-\d{2})/i);
      const revenueMatch = section.match(/Revenue:\s*\$?([\d,]+\.?\d*)\s*(million|billion)?/i);
      const netIncomeMatch = section.match(/Net Income:\s*\$?([\d,]+\.?\d*)\s*(million|billion)?/i);
      const epsMatch = section.match(/EPS:\s*\$?([\d,]+\.?\d*)/i);

      if (!formTypeMatch || !filingDateMatch) {
        return null;
      }

      const filing: SECFiling = {
        id: `${query.company}-${formTypeMatch[1]}-${filingDateMatch[1]}`,
        companyName: query.company,
        ticker: query.ticker || '',
        formType: formTypeMatch[1],
        filingDate: new Date(filingDateMatch[1]),
        periodEnd: periodEndMatch ? new Date(periodEndMatch[1]) : new Date(filingDateMatch[1]),
        accessionNumber: '', // Would be extracted from actual SEC data
        documentUrl: '', // Will be set from citations
        extractedData: {
          revenue: this.parseFinancialValue(revenueMatch),
          netIncome: this.parseFinancialValue(netIncomeMatch),
          eps: epsMatch ? parseFloat(epsMatch[1].replace(/,/g, '')) : undefined,
          totalAssets: this.extractFinancialValue(section, /Total Assets:\s*\$?([\d,]+\.?\d*)\s*(million|billion)?/i),
          totalLiabilities: this.extractFinancialValue(section, /Total Liabilities:\s*\$?([\d,]+\.?\d*)\s*(million|billion)?/i),
          shareholderEquity: this.extractFinancialValue(section, /Shareholder Equity:\s*\$?([\d,]+\.?\d*)\s*(million|billion)?/i),
          cashFlow: this.extractCashFlowData(section),
          segments: this.extractSegmentData(section),
          riskFactors: this.extractListData(section, /Risk Factors?:(.*?)(?=\n\n|\n[A-Z])/is),
          mdaHighlights: this.extractListData(section, /Management Discussion.*?:(.*?)(?=\n\n|\n[A-Z])/is)
        }
      };

      return filing;
    } catch (error) {
      logger.error('Failed to extract filing data:', error);
      return null;
    }
  }

  private parseFinancialValue(match: RegExpMatchArray | null): number | undefined {
    if (!match) return undefined;
    
    let value = parseFloat(match[1].replace(/,/g, ''));
    
    if (match[2]) {
      if (match[2].toLowerCase() === 'million') {
        value *= 1000000;
      } else if (match[2].toLowerCase() === 'billion') {
        value *= 1000000000;
      }
    }
    
    return value;
  }

  private extractFinancialValue(text: string, pattern: RegExp): number | undefined {
    const match = text.match(pattern);
    return this.parseFinancialValue(match);
  }

  private extractCashFlowData(section: string): any {
    return {
      operating: this.extractFinancialValue(section, /Operating Cash Flow:\s*\$?([\d,]+\.?\d*)\s*(million|billion)?/i),
      investing: this.extractFinancialValue(section, /Investing Cash Flow:\s*\$?([\d,]+\.?\d*)\s*(million|billion)?/i),
      financing: this.extractFinancialValue(section, /Financing Cash Flow:\s*\$?([\d,]+\.?\d*)\s*(million|billion)?/i),
      freeCashFlow: this.extractFinancialValue(section, /Free Cash Flow:\s*\$?([\d,]+\.?\d*)\s*(million|billion)?/i)
    };
  }

  private extractSegmentData(section: string): any[] {
    // Simplified segment extraction
    const segments: any[] = [];
    const segmentPattern = /Segment:\s*([^,\n]+),?\s*Revenue:\s*\$?([\d,]+\.?\d*)\s*(million|billion)?/gi;
    
    let match;
    while ((match = segmentPattern.exec(section)) !== null) {
      segments.push({
        name: match[1].trim(),
        revenue: this.parseFinancialValue([match[0], match[2], match[3]]),
        operatingIncome: undefined // Would need more complex parsing
      });
    }
    
    return segments;
  }

  private extractListData(section: string, pattern: RegExp): string[] {
    const match = section.match(pattern);
    if (!match || !match[1]) return [];
    
    return match[1]
      .split(/[•\-\n]/)
      .map(item => item.trim())
      .filter(item => item.length > 10);
  }

  private parseFinancialAnalysis(response: PerplexityResponse, filing: SECFiling): FinancialAnalysis {
    const content = response.choices[0]?.message?.content || '';
    
    // Parse the analysis response
    return {
      profitabilityMetrics: {
        grossMargin: this.extractMetricValue(content, /Gross Margin:\s*([\d.]+)%/i),
        operatingMargin: this.extractMetricValue(content, /Operating Margin:\s*([\d.]+)%/i),
        netMargin: this.extractMetricValue(content, /Net Margin:\s*([\d.]+)%/i),
        roe: this.extractMetricValue(content, /ROE:\s*([\d.]+)%/i),
        roa: this.extractMetricValue(content, /ROA:\s*([\d.]+)%/i)
      },
      liquidityMetrics: {
        currentRatio: this.extractMetricValue(content, /Current Ratio:\s*([\d.]+)/i),
        quickRatio: this.extractMetricValue(content, /Quick Ratio:\s*([\d.]+)/i),
        cashRatio: this.extractMetricValue(content, /Cash Ratio:\s*([\d.]+)/i),
        workingCapital: this.extractFinancialValue(content, /Working Capital:\s*\$?([\d,]+\.?\d*)\s*(million|billion)?/i) || 0
      },
      efficiencyMetrics: {
        assetTurnover: this.extractMetricValue(content, /Asset Turnover:\s*([\d.]+)/i),
        inventoryTurnover: this.extractMetricValue(content, /Inventory Turnover:\s*([\d.]+)/i),
        receivablesTurnover: this.extractMetricValue(content, /Receivables Turnover:\s*([\d.]+)/i),
        daysSalesOutstanding: this.extractMetricValue(content, /Days Sales Outstanding:\s*([\d.]+)/i)
      },
      growthMetrics: {
        revenueGrowthYoY: this.extractMetricValue(content, /Revenue Growth YoY:\s*([\d.\-]+)%/i),
        revenueGrowthQoQ: this.extractMetricValue(content, /Revenue Growth QoQ:\s*([\d.\-]+)%/i),
        earningsGrowthYoY: this.extractMetricValue(content, /Earnings Growth YoY:\s*([\d.\-]+)%/i),
        earningsGrowthQoQ: this.extractMetricValue(content, /Earnings Growth QoQ:\s*([\d.\-]+)%/i)
      },
      valuation: {
        peRatio: this.extractMetricValue(content, /P\/E Ratio:\s*([\d.]+)/i),
        pegRatio: this.extractMetricValue(content, /PEG Ratio:\s*([\d.]+)/i),
        priceToBook: this.extractMetricValue(content, /Price to Book:\s*([\d.]+)/i),
        priceToSales: this.extractMetricValue(content, /Price to Sales:\s*([\d.]+)/i),
        evToEbitda: this.extractMetricValue(content, /EV\/EBITDA:\s*([\d.]+)/i)
      }
    };
  }

  private extractMetricValue(text: string, pattern: RegExp): number {
    const match = text.match(pattern);
    return match ? parseFloat(match[1]) : 0;
  }

  private parseEarningsData(response: PerplexityResponse): any[] {
    const content = response.choices[0]?.message?.content || '';
    const earnings: any[] = [];
    
    // Parse quarterly earnings data
    const quarterPattern = /Q\d \d{4}:(.*?)(?=Q\d \d{4}:|$)/gs;
    let match;
    
    while ((match = quarterPattern.exec(content)) !== null) {
      const quarterData = this.extractQuarterlyEarnings(match[0]);
      if (quarterData) {
        earnings.push(quarterData);
      }
    }
    
    return earnings;
  }

  private extractQuarterlyEarnings(section: string): any {
    const quarterMatch = section.match(/(Q\d) (\d{4})/);
    if (!quarterMatch) return null;
    
    return {
      quarter: quarterMatch[1],
      year: parseInt(quarterMatch[2]),
      revenue: this.extractFinancialValue(section, /Revenue:\s*\$?([\d,]+\.?\d*)\s*(million|billion)?/i),
      revenueGrowthYoY: this.extractMetricValue(section, /Revenue Growth.*?:\s*([\d.\-]+)%/i),
      eps: this.extractMetricValue(section, /EPS.*?:\s*\$?([\d.\-]+)/i),
      epsEstimate: this.extractMetricValue(section, /EPS Estimate.*?:\s*\$?([\d.\-]+)/i),
      netIncome: this.extractFinancialValue(section, /Net Income:\s*\$?([\d,]+\.?\d*)\s*(million|billion)?/i),
      highlights: this.extractListData(section, /Highlights?:(.*?)(?=\n\n|\n[A-Z])/is)
    };
  }

  private parseFinancialMetrics(response: PerplexityResponse): Record<string, any> {
    const content = response.choices[0]?.message?.content || '';
    
    return {
      profitability: {
        grossMargin: this.extractMetricValue(content, /Gross Margin:\s*([\d.]+)%/i),
        operatingMargin: this.extractMetricValue(content, /Operating Margin:\s*([\d.]+)%/i),
        netMargin: this.extractMetricValue(content, /Net Margin:\s*([\d.]+)%/i),
        roe: this.extractMetricValue(content, /ROE:\s*([\d.]+)%/i),
        roa: this.extractMetricValue(content, /ROA:\s*([\d.]+)%/i)
      },
      liquidity: {
        currentRatio: this.extractMetricValue(content, /Current Ratio:\s*([\d.]+)/i),
        quickRatio: this.extractMetricValue(content, /Quick Ratio:\s*([\d.]+)/i),
        cashRatio: this.extractMetricValue(content, /Cash Ratio:\s*([\d.]+)/i)
      },
      efficiency: {
        assetTurnover: this.extractMetricValue(content, /Asset Turnover:\s*([\d.]+)/i),
        inventoryTurnover: this.extractMetricValue(content, /Inventory Turnover:\s*([\d.]+)/i),
        receivablesTurnover: this.extractMetricValue(content, /Receivables Turnover:\s*([\d.]+)/i)
      },
      leverage: {
        debtToEquity: this.extractMetricValue(content, /Debt.to.Equity:\s*([\d.]+)/i),
        interestCoverage: this.extractMetricValue(content, /Interest Coverage:\s*([\d.]+)/i)
      },
      valuation: {
        peRatio: this.extractMetricValue(content, /P\/E:\s*([\d.]+)/i),
        priceToBook: this.extractMetricValue(content, /P\/B:\s*([\d.]+)/i),
        priceToSales: this.extractMetricValue(content, /P\/S:\s*([\d.]+)/i),
        evToEbitda: this.extractMetricValue(content, /EV\/EBITDA:\s*([\d.]+)/i)
      },
      growth: {
        revenueCAGR: this.extractMetricValue(content, /Revenue CAGR:\s*([\d.\-]+)%/i),
        earningsCAGR: this.extractMetricValue(content, /Earnings CAGR:\s*([\d.\-]+)%/i)
      },
      industryComparison: this.extractIndustryComparison(content)
    };
  }

  private extractIndustryComparison(content: string): any {
    // Extract industry comparison data
    const comparison: any = {};
    
    const industrySection = content.match(/Industry Comparison:(.*?)(?=\n\n|$)/is);
    if (industrySection) {
      comparison.position = industrySection[1].includes('above average') ? 'above-average' : 
                          industrySection[1].includes('below average') ? 'below-average' : 'average';
      comparison.strengths = this.extractListData(industrySection[1], /Strengths?:(.*?)(?=Weakness|$)/is);
      comparison.weaknesses = this.extractListData(industrySection[1], /Weakness(?:es)?:(.*?)$/is);
    }
    
    return comparison;
  }

  private parseComparativeAnalysis(response: PerplexityResponse): any {
    const content = response.choices[0]?.message?.content || '';
    
    // Parse comparative data for each company
    const companies: any = {};
    const companyPattern = /Company:\s*([^\n]+)(.*?)(?=Company:|$)/gs;
    let match;
    
    while ((match = companyPattern.exec(content)) !== null) {
      const companyName = match[1].trim();
      companies[companyName] = this.extractCompanyComparison(match[2]);
    }
    
    return {
      companies,
      summary: this.extractComparativeSummary(content),
      recommendations: this.extractListData(content, /Recommendations?:(.*?)$/is)
    };
  }

  private extractCompanyComparison(section: string): any {
    return {
      revenue: this.extractFinancialValue(section, /Revenue:\s*\$?([\d,]+\.?\d*)\s*(million|billion)?/i),
      revenueGrowth: this.extractMetricValue(section, /Revenue Growth:\s*([\d.\-]+)%/i),
      netMargin: this.extractMetricValue(section, /Net Margin:\s*([\d.]+)%/i),
      roe: this.extractMetricValue(section, /ROE:\s*([\d.]+)%/i),
      debtToEquity: this.extractMetricValue(section, /Debt.to.Equity:\s*([\d.]+)/i),
      peRatio: this.extractMetricValue(section, /P\/E:\s*([\d.]+)/i),
      strengths: this.extractListData(section, /Strengths?:(.*?)(?=Weakness|$)/is),
      weaknesses: this.extractListData(section, /Weakness(?:es)?:(.*?)(?=\n\n|$)/is)
    };
  }

  private extractComparativeSummary(content: string): string {
    const summaryMatch = content.match(/Summary:(.*?)(?=Company:|Recommendations|$)/is);
    return summaryMatch ? summaryMatch[1].trim() : '';
  }
}