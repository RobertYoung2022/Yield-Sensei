/**
 * Export Service
 * Handles data export and report generation
 */

import { EventEmitter } from 'events';
import * as fs from 'fs/promises';
import * as path from 'path';
import { 
  ExportRequest,
  ExportResult,
  SECFiling,
  RegulatoryAlert,
  MarketIntelligence
} from '../types';
import Logger from '@/shared/logging/logger';

const logger = Logger.getLogger('export-service');

// Import statements for libraries (these would be installed separately)
// import * as XLSX from 'xlsx';
// import * as PDFDocument from 'pdfkit';
// import { Parser } from 'json2csv';

export interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  format: 'csv' | 'excel' | 'json' | 'pdf';
  sections: ReportSection[];
  metadata?: Record<string, any>;
}

export interface ReportSection {
  title: string;
  type: 'data-table' | 'chart' | 'summary' | 'narrative';
  dataSource: string;
  columns?: string[];
  formatting?: Record<string, any>;
}

export interface ScheduledExport {
  id: string;
  name: string;
  exportRequest: ExportRequest;
  schedule: {
    frequency: 'daily' | 'weekly' | 'monthly';
    time?: string; // HH:MM format
    dayOfWeek?: number; // 0-6 for weekly
    dayOfMonth?: number; // 1-31 for monthly
  };
  recipients?: string[];
  enabled: boolean;
}

export class ExportService extends EventEmitter {
  private templates: Map<string, ReportTemplate> = new Map();
  private scheduledExports: Map<string, ScheduledExport> = new Map();
  private exportQueue: ExportRequest[] = [];
  private processing: boolean = false;

  constructor(private outputDir: string = './exports') {
    super();
    this.initializeDefaultTemplates();
  }

  private initializeDefaultTemplates(): void {
    // Financial Report Template
    this.templates.set('financial-report', {
      id: 'financial-report',
      name: 'Financial Analysis Report',
      description: 'Comprehensive financial data and analysis',
      format: 'excel',
      sections: [
        {
          title: 'Executive Summary',
          type: 'summary',
          dataSource: 'financial-summary'
        },
        {
          title: 'SEC Filings Data',
          type: 'data-table',
          dataSource: 'sec-filings',
          columns: ['formType', 'filingDate', 'revenue', 'netIncome', 'eps']
        },
        {
          title: 'Financial Metrics',
          type: 'data-table',
          dataSource: 'financial-metrics',
          columns: ['metric', 'value', 'industryAverage', 'percentile']
        },
        {
          title: 'Trend Analysis',
          type: 'chart',
          dataSource: 'financial-trends'
        }
      ]
    });

    // Regulatory Compliance Template
    this.templates.set('regulatory-compliance', {
      id: 'regulatory-compliance',
      name: 'Regulatory Compliance Report',
      description: 'Regulatory alerts and compliance status',
      format: 'pdf',
      sections: [
        {
          title: 'Compliance Overview',
          type: 'summary',
          dataSource: 'compliance-summary'
        },
        {
          title: 'Active Alerts',
          type: 'data-table',
          dataSource: 'regulatory-alerts',
          columns: ['severity', 'jurisdiction', 'title', 'effectiveDate', 'status']
        },
        {
          title: 'Required Actions',
          type: 'narrative',
          dataSource: 'compliance-actions'
        }
      ]
    });

    // Market Intelligence Template
    this.templates.set('market-intelligence', {
      id: 'market-intelligence',
      name: 'Market Intelligence Report',
      description: 'Market sentiment and competitive analysis',
      format: 'excel',
      sections: [
        {
          title: 'Market Sentiment',
          type: 'summary',
          dataSource: 'sentiment-overview'
        },
        {
          title: 'News Analysis',
          type: 'data-table',
          dataSource: 'news-stories',
          columns: ['headline', 'source', 'sentiment', 'relevance', 'publishedAt']
        },
        {
          title: 'Competitive Positioning',
          type: 'chart',
          dataSource: 'competitive-analysis'
        },
        {
          title: 'Analyst Ratings',
          type: 'data-table',
          dataSource: 'analyst-ratings',
          columns: ['analyst', 'rating', 'priceTarget', 'date']
        }
      ]
    });
  }

  async exportData(request: ExportRequest): Promise<ExportResult> {
    try {
      logger.info('Starting data export', {
        type: request.type,
        format: request.format
      });

      this.emit('export-started', request);

      // Generate filename
      const filename = this.generateFilename(request);
      const filePath = path.join(this.outputDir, filename);

      // Ensure output directory exists
      await fs.mkdir(this.outputDir, { recursive: true });

      let result: ExportResult;

      switch (request.format) {
        case 'csv':
          result = await this.exportToCSV(request, filePath);
          break;
        case 'excel':
          result = await this.exportToExcel(request, filePath);
          break;
        case 'json':
          result = await this.exportToJSON(request, filePath);
          break;
        case 'pdf':
          result = await this.exportToPDF(request, filePath);
          break;
        default:
          throw new Error(`Unsupported export format: ${request.format}`);
      }

      this.emit('export-completed', result);
      logger.info('Export completed', { filename: result.filename });

      return result;
    } catch (error) {
      logger.error('Export failed:', error);
      this.emit('export-failed', { request, error });
      throw error;
    }
  }

  private generateFilename(request: ExportRequest): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const type = request.type.replace(/\s+/g, '_');
    return `${type}_export_${timestamp}.${request.format}`;
  }

  private async exportToCSV(
    request: ExportRequest,
    filePath: string
  ): Promise<ExportResult> {
    // Simplified CSV export - in production, use a proper CSV library
    const data = await this.gatherExportData(request);
    const csvContent = this.convertToCSV(data);
    
    await fs.writeFile(filePath, csvContent, 'utf8');

    return {
      id: `export-${Date.now()}`,
      filename: path.basename(filePath),
      format: 'csv',
      size: Buffer.byteLength(csvContent),
      url: filePath,
      generatedAt: new Date(),
      expiresAt: new Date(Date.now() + 86400000) // 24 hours
    };
  }

  private async exportToExcel(
    request: ExportRequest,
    filePath: string
  ): Promise<ExportResult> {
    // Simplified Excel export - in production, use XLSX library
    const data = await this.gatherExportData(request);
    
    // Mock Excel generation
    const excelData = {
      sheets: this.organizeDataIntoSheets(data, request),
      metadata: {
        created: new Date(),
        type: request.type,
        filters: request.filters
      }
    };

    const jsonContent = JSON.stringify(excelData, null, 2);
    await fs.writeFile(filePath + '.json', jsonContent, 'utf8');

    return {
      id: `export-${Date.now()}`,
      filename: path.basename(filePath),
      format: 'excel',
      size: Buffer.byteLength(jsonContent),
      url: filePath,
      generatedAt: new Date(),
      data: excelData
    };
  }

  private async exportToJSON(
    request: ExportRequest,
    filePath: string
  ): Promise<ExportResult> {
    const data = await this.gatherExportData(request);
    const jsonContent = JSON.stringify(data, null, 2);
    
    await fs.writeFile(filePath, jsonContent, 'utf8');

    return {
      id: `export-${Date.now()}`,
      filename: path.basename(filePath),
      format: 'json',
      size: Buffer.byteLength(jsonContent),
      url: filePath,
      generatedAt: new Date(),
      data
    };
  }

  private async exportToPDF(
    request: ExportRequest,
    filePath: string
  ): Promise<ExportResult> {
    // Simplified PDF export - in production, use PDFKit or similar
    const data = await this.gatherExportData(request);
    const pdfContent = this.generatePDFContent(data, request);
    
    // Mock PDF generation - save as text file
    await fs.writeFile(filePath + '.txt', pdfContent, 'utf8');

    return {
      id: `export-${Date.now()}`,
      filename: path.basename(filePath),
      format: 'pdf',
      size: Buffer.byteLength(pdfContent),
      url: filePath,
      generatedAt: new Date()
    };
  }

  private async gatherExportData(request: ExportRequest): Promise<any> {
    const data: any = {
      metadata: {
        exportType: request.type,
        exportDate: new Date(),
        filters: request.filters
      }
    };

    switch (request.type) {
      case 'financial':
        data.financialData = await this.gatherFinancialData(request.filters);
        break;
      case 'regulatory':
        data.regulatoryData = await this.gatherRegulatoryData(request.filters);
        break;
      case 'market':
        data.marketData = await this.gatherMarketData(request.filters);
        break;
      case 'comprehensive':
        data.financialData = await this.gatherFinancialData(request.filters);
        data.regulatoryData = await this.gatherRegulatoryData(request.filters);
        data.marketData = await this.gatherMarketData(request.filters);
        break;
    }

    return data;
  }

  private async gatherFinancialData(filters?: any): Promise<any> {
    // In production, this would fetch data from services
    return {
      secFilings: [],
      financialMetrics: {},
      earningsData: [],
      comparativeAnalysis: {}
    };
  }

  private async gatherRegulatoryData(filters?: any): Promise<any> {
    // In production, this would fetch data from services
    return {
      alerts: [],
      complianceRequirements: [],
      jurisdictionSummaries: {}
    };
  }

  private async gatherMarketData(filters?: any): Promise<any> {
    // In production, this would fetch data from services
    return {
      sentiment: {},
      analystRatings: {},
      newsAnalysis: {},
      trendAnalysis: {},
      competitiveAnalysis: {}
    };
  }

  private convertToCSV(data: any): string {
    // Simplified CSV conversion
    const lines: string[] = [];
    
    // Add headers
    lines.push('Export Type,Export Date,Data Category,Value');
    
    // Add data rows
    const addRows = (obj: any, prefix: string = '') => {
      for (const [key, value] of Object.entries(obj)) {
        if (typeof value === 'object' && value !== null) {
          addRows(value, `${prefix}${key}.`);
        } else {
          lines.push(`${data.metadata.exportType},${data.metadata.exportDate},${prefix}${key},"${value}"`);
        }
      }
    };

    addRows(data);
    return lines.join('\n');
  }

  private organizeDataIntoSheets(data: any, request: ExportRequest): any {
    const sheets: any = {};

    // Overview sheet
    sheets['Overview'] = {
      data: [
        ['Export Type', request.type],
        ['Generated Date', new Date().toISOString()],
        ['Filters Applied', JSON.stringify(request.filters || {})]
      ]
    };

    // Data-specific sheets
    if (data.financialData) {
      sheets['Financial Data'] = this.formatFinancialSheet(data.financialData);
    }

    if (data.regulatoryData) {
      sheets['Regulatory Data'] = this.formatRegulatorySheet(data.regulatoryData);
    }

    if (data.marketData) {
      sheets['Market Intelligence'] = this.formatMarketSheet(data.marketData);
    }

    return sheets;
  }

  private formatFinancialSheet(data: any): any {
    return {
      headers: ['Metric', 'Value', 'Date', 'Source'],
      data: [] // Would be populated with actual data
    };
  }

  private formatRegulatorySheet(data: any): any {
    return {
      headers: ['Alert ID', 'Severity', 'Jurisdiction', 'Title', 'Effective Date'],
      data: [] // Would be populated with actual data
    };
  }

  private formatMarketSheet(data: any): any {
    return {
      headers: ['Metric', 'Value', 'Confidence', 'Source', 'Timestamp'],
      data: [] // Would be populated with actual data
    };
  }

  private generatePDFContent(data: any, request: ExportRequest): string {
    let content = `${request.type.toUpperCase()} REPORT\n`;
    content += `Generated: ${new Date().toISOString()}\n\n`;

    // Add summary
    content += 'EXECUTIVE SUMMARY\n';
    content += '================\n\n';
    content += this.generateSummary(data, request.type);

    // Add detailed sections
    if (data.financialData) {
      content += '\n\nFINANCIAL ANALYSIS\n';
      content += '==================\n';
      content += this.formatDataSection(data.financialData);
    }

    if (data.regulatoryData) {
      content += '\n\nREGULATORY COMPLIANCE\n';
      content += '====================\n';
      content += this.formatDataSection(data.regulatoryData);
    }

    if (data.marketData) {
      content += '\n\nMARKET INTELLIGENCE\n';
      content += '==================\n';
      content += this.formatDataSection(data.marketData);
    }

    return content;
  }

  private generateSummary(data: any, type: string): string {
    const summaries: Record<string, string> = {
      financial: 'This report provides comprehensive financial analysis including SEC filings, key metrics, and comparative analysis.',
      regulatory: 'This report covers regulatory compliance status, active alerts, and required actions across jurisdictions.',
      market: 'This report analyzes market sentiment, news coverage, analyst ratings, and competitive positioning.',
      comprehensive: 'This comprehensive report combines financial, regulatory, and market intelligence data.'
    };

    return summaries[type] || 'Data export summary.';
  }

  private formatDataSection(data: any): string {
    let content = '';
    
    for (const [key, value] of Object.entries(data)) {
      content += `\n${key.toUpperCase()}:\n`;
      
      if (Array.isArray(value)) {
        content += `- ${value.length} items\n`;
      } else if (typeof value === 'object' && value !== null) {
        content += JSON.stringify(value, null, 2) + '\n';
      } else {
        content += `${value}\n`;
      }
    }

    return content;
  }

  async createScheduledExport(scheduled: ScheduledExport): Promise<string> {
    this.scheduledExports.set(scheduled.id, scheduled);
    
    logger.info('Created scheduled export', {
      id: scheduled.id,
      name: scheduled.name,
      frequency: scheduled.schedule.frequency
    });

    // In production, would set up actual scheduling
    this.emit('scheduled-export-created', scheduled);
    
    return scheduled.id;
  }

  async updateScheduledExport(
    id: string,
    updates: Partial<ScheduledExport>
  ): Promise<void> {
    const existing = this.scheduledExports.get(id);
    if (!existing) {
      throw new Error(`Scheduled export ${id} not found`);
    }

    const updated = { ...existing, ...updates };
    this.scheduledExports.set(id, updated);
    
    logger.info('Updated scheduled export', { id });
    this.emit('scheduled-export-updated', updated);
  }

  async deleteScheduledExport(id: string): Promise<void> {
    const deleted = this.scheduledExports.delete(id);
    if (!deleted) {
      throw new Error(`Scheduled export ${id} not found`);
    }

    logger.info('Deleted scheduled export', { id });
    this.emit('scheduled-export-deleted', { id });
  }

  getScheduledExports(): ScheduledExport[] {
    return Array.from(this.scheduledExports.values());
  }

  async createTemplate(template: ReportTemplate): Promise<void> {
    this.templates.set(template.id, template);
    logger.info('Created report template', {
      id: template.id,
      name: template.name
    });
  }

  getTemplates(): ReportTemplate[] {
    return Array.from(this.templates.values());
  }

  getTemplate(id: string): ReportTemplate | undefined {
    return this.templates.get(id);
  }

  async generateFromTemplate(
    templateId: string,
    data: any,
    format?: ExportRequest['format']
  ): Promise<ExportResult> {
    const template = this.templates.get(templateId);
    if (!template) {
      throw new Error(`Template ${templateId} not found`);
    }

    const request: ExportRequest = {
      type: 'comprehensive',
      format: format || template.format,
      template: templateId
    };

    // Override data gathering with provided data
    const originalGather = this.gatherExportData;
    this.gatherExportData = async () => data;

    try {
      const result = await this.exportData(request);
      return result;
    } finally {
      this.gatherExportData = originalGather;
    }
  }
}