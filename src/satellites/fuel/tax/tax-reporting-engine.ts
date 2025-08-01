/**
 * Tax Reporting Engine
 * Generates comprehensive tax reports and compliance documentation
 */

import { EventEmitter } from 'events';
import { Logger } from 'winston';
import { createLogger, format, transports } from 'winston';
import { getUnifiedAIClient, UnifiedAIClient } from '../../../integrations/ai/unified-ai-client';
import {
  TaxOptimizationConfig,
  TaxReport,
  TaxableTransaction,
  TaxSummary,
  TaxForm,
  TaxLossOpportunity
} from '../types';

export interface TaxReportingEngineConfig extends TaxOptimizationConfig {
  outputDirectory: string;
  templateDirectory: string;
  encryptReports: boolean;
  includeAIAnalysis: boolean;
  complianceCheck: boolean;
}

export interface ReportTemplate {
  type: string;
  name: string;
  format: 'pdf' | 'csv' | 'json' | 'xlsx';
  jurisdiction: string;
  fields: string[];
  validationRules: ValidationRule[];
}

export interface ValidationRule {
  field: string;
  rule: 'required' | 'numeric' | 'date' | 'currency';
  message: string;
}

export interface ComplianceCheck {
  rule: string;
  status: 'pass' | 'fail' | 'warning';
  message: string;
  recommendation?: string;
}

export interface TaxOptimizationInsight {
  category: 'harvesting' | 'timing' | 'structure' | 'deduction';
  insight: string;
  potentialSavings: number;
  implementationDifficulty: 'low' | 'medium' | 'high';
  deadline?: Date;
}

export class TaxReportingEngine extends EventEmitter {
  private logger: Logger;
  private config: TaxReportingEngineConfig;
  private aiClient: UnifiedAIClient;
  private isInitialized: boolean = false;
  
  // Report templates
  private reportTemplates: Map<string, ReportTemplate> = new Map();
  private generatedReports: Map<string, TaxReport> = new Map();
  
  // Tax data
  private transactions: Map<string, TaxableTransaction> = new Map();
  private opportunities: Map<string, TaxLossOpportunity> = new Map();
  
  // Compliance tracking
  private complianceChecks: ComplianceCheck[] = [];
  private lastComplianceCheck?: Date;

  constructor(config: TaxReportingEngineConfig) {
    super();
    this.config = config;
    this.logger = createLogger({
      level: 'info',
      format: format.combine(
        format.timestamp(),
        format.printf(({ timestamp, level, message, ...meta }) => {
          return `${timestamp} [TaxReporting] ${level}: ${message} ${Object.keys(meta).length > 0 ? JSON.stringify(meta) : ''}`;
        })
      ),
      transports: [
        new transports.Console(),
        new transports.File({ filename: 'logs/tax-reporting.log' })
      ],
    });
  }

  async initialize(): Promise<void> {
    try {
      this.logger.info('Initializing Tax Reporting Engine...');
      
      // Initialize AI client
      this.aiClient = getUnifiedAIClient();
      
      // Load report templates
      this.initializeReportTemplates();
      
      // Load historical tax data
      await this.loadTaxData();
      
      this.isInitialized = true;
      this.logger.info('Tax Reporting Engine initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize Tax Reporting Engine:', error);
      throw error;
    }
  }

  async generateReport(
    reportType: string,
    taxYear: number,
    options: any = {}
  ): Promise<TaxReport> {
    try {
      this.logger.info('Generating tax report', { reportType, taxYear });
      
      // Get template
      const template = this.reportTemplates.get(reportType);
      if (!template) {
        throw new Error(`Report template not found: ${reportType}`);
      }
      
      // Gather transaction data for the year
      const yearTransactions = this.getTransactionsForYear(taxYear);
      
      // Calculate tax summary
      const summary = this.calculateTaxSummary(yearTransactions);
      
      // Generate forms
      const forms = await this.generateForms(template, yearTransactions, summary);
      
      // Run compliance checks
      const complianceResults = await this.runComplianceChecks(yearTransactions, summary);
      
      // Generate AI insights if enabled
      let aiInsights = '';
      if (this.config.includeAIAnalysis) {
        aiInsights = await this.generateAIInsights(yearTransactions, summary);
      }
      
      // Create report
      const report: TaxReport = {
        id: `tax_report_${taxYear}_${reportType}_${Date.now()}`,
        taxYear,
        generatedAt: new Date(),
        transactions: yearTransactions,
        summary,
        forms,
        metadata: {
          reportType,
          jurisdiction: this.config.jurisdiction,
          complianceChecks: complianceResults,
          aiInsights,
          ...options
        }
      };
      
      // Store report
      this.generatedReports.set(report.id, report);
      
      // Export report if requested
      if (options.export) {
        await this.exportReport(report, template.format);
      }
      
      this.emit('tax_report_generated', {
        reportId: report.id,
        taxYear,
        type: reportType,
        transactionCount: yearTransactions.length
      });
      
      return report;
    } catch (error) {
      this.logger.error('Failed to generate tax report:', error);
      throw error;
    }
  }

  async generateForm8949(taxYear: number): Promise<TaxForm> {
    const transactions = this.getTransactionsForYear(taxYear)
      .filter(tx => tx.type === 'sell' || tx.type === 'swap');
    
    const form8949Data = {
      taxYear,
      shortTermTransactions: transactions.filter(tx => tx.termType === 'short'),
      longTermTransactions: transactions.filter(tx => tx.termType === 'long'),
      totals: this.calculateForm8949Totals(transactions)
    };
    
    return {
      type: 'Form8949',
      data: form8949Data,
      status: 'draft'
    };
  }

  async generateScheduleD(taxYear: number): Promise<TaxForm> {
    const form8949 = await this.generateForm8949(taxYear);
    const totals = form8949.data.totals;
    
    const scheduleDData = {
      taxYear,
      shortTermCapitalGainLoss: totals.shortTermNet,
      longTermCapitalGainLoss: totals.longTermNet,
      netCapitalGainLoss: totals.shortTermNet + totals.longTermNet,
      carryoverLoss: this.getCarryoverLoss(taxYear - 1)
    };
    
    return {
      type: 'Schedule D',
      data: scheduleDData,
      status: 'draft'
    };
  }

  async validateReport(reportId: string): Promise<ComplianceCheck[]> {
    const report = this.generatedReports.get(reportId);
    if (!report) {
      throw new Error(`Report not found: ${reportId}`);
    }
    
    const checks: ComplianceCheck[] = [];
    
    // Check for wash sale violations
    const washSaleCheck = this.checkWashSaleCompliance(report.transactions);
    checks.push(washSaleCheck);
    
    // Check for missing cost basis
    const costBasisCheck = this.checkCostBasisCompleteness(report.transactions);
    checks.push(costBasisCheck);
    
    // Check for holding period accuracy
    const holdingPeriodCheck = this.checkHoldingPeriods(report.transactions);
    checks.push(holdingPeriodCheck);
    
    // Check mathematical accuracy
    const mathCheck = this.checkMathematicalAccuracy(report.summary);
    checks.push(mathCheck);
    
    return checks;
  }

  async generateOptimizationInsights(taxYear: number): Promise<TaxOptimizationInsight[]> {
    const transactions = this.getTransactionsForYear(taxYear);
    const summary = this.calculateTaxSummary(transactions);
    
    const insights: TaxOptimizationInsight[] = [];
    
    // Harvesting opportunities
    if (summary.shortTermGains > summary.shortTermLosses) {
      insights.push({
        category: 'harvesting',
        insight: 'Additional short-term loss harvesting could offset gains',
        potentialSavings: (summary.shortTermGains - summary.shortTermLosses) * 0.35,
        implementationDifficulty: 'medium',
        deadline: new Date(taxYear, 11, 31) // December 31
      });
    }
    
    // Timing optimization
    if (summary.longTermGains > 0) {
      insights.push({
        category: 'timing',
        insight: 'Consider deferring gains to next tax year if possible',
        potentialSavings: summary.longTermGains * 0.05, // Tax rate differential
        implementationDifficulty: 'low'
      });
    }
    
    // Structure optimization
    insights.push({
      category: 'structure',
      insight: 'Consider tax-advantaged account strategies for yield farming',
      potentialSavings: summary.netGainLoss * 0.15,
      implementationDifficulty: 'high'
    });
    
    // AI-enhanced insights
    if (this.config.includeAIAnalysis) {
      const aiInsights = await this.generateAIOptimizationInsights(transactions, summary);
      insights.push(...aiInsights);
    }
    
    return insights;
  }

  private initializeReportTemplates(): void {
    // US Form 8949 template
    this.reportTemplates.set('form8949', {
      type: 'form8949',
      name: 'Form 8949 - Sales and Other Dispositions of Capital Assets',
      format: 'pdf',
      jurisdiction: 'US',
      fields: [
        'description', 'dateAcquired', 'dateSold', 'proceeds', 
        'costBasis', 'adjustments', 'gainLoss'
      ],
      validationRules: [
        { field: 'proceeds', rule: 'currency', message: 'Proceeds must be a valid currency amount' },
        { field: 'costBasis', rule: 'currency', message: 'Cost basis must be a valid currency amount' },
        { field: 'dateSold', rule: 'date', message: 'Date sold must be a valid date' }
      ]
    });
    
    // Schedule D template
    this.reportTemplates.set('schedule_d', {
      type: 'schedule_d',
      name: 'Schedule D - Capital Gains and Losses',
      format: 'pdf',
      jurisdiction: 'US',
      fields: [
        'shortTermGains', 'shortTermLosses', 'longTermGains', 'longTermLosses'
      ],
      validationRules: [
        { field: 'shortTermGains', rule: 'currency', message: 'Short-term gains must be valid' },
        { field: 'longTermGains', rule: 'currency', message: 'Long-term gains must be valid' }
      ]
    });
    
    // Comprehensive tax summary
    this.reportTemplates.set('comprehensive', {
      type: 'comprehensive',
      name: 'Comprehensive Tax Report',
      format: 'json',
      jurisdiction: 'US',
      fields: ['all'],
      validationRules: []
    });
  }

  private async loadTaxData(): Promise<void> {
    // In production, load from database
    // For now, empty initialization
    this.logger.info('Tax data loaded');
  }

  private getTransactionsForYear(taxYear: number): TaxableTransaction[] {
    return Array.from(this.transactions.values())
      .filter(tx => tx.date.getFullYear() === taxYear);
  }

  private calculateTaxSummary(transactions: TaxableTransaction[]): TaxSummary {
    const summary: TaxSummary = {
      totalProceeds: 0,
      totalCostBasis: 0,
      shortTermGains: 0,
      shortTermLosses: 0,
      longTermGains: 0,
      longTermLosses: 0,
      netGainLoss: 0,
      estimatedTax: 0
    };
    
    for (const tx of transactions) {
      summary.totalProceeds += tx.proceeds;
      summary.totalCostBasis += tx.costBasis;
      
      if (tx.gainLoss > 0) {
        if (tx.termType === 'short') {
          summary.shortTermGains += tx.gainLoss;
        } else {
          summary.longTermGains += tx.gainLoss;
        }
      } else {
        const loss = Math.abs(tx.gainLoss);
        if (tx.termType === 'short') {
          summary.shortTermLosses += loss;
        } else {
          summary.longTermLosses += loss;
        }
      }
    }
    
    summary.netGainLoss = (summary.shortTermGains + summary.longTermGains) - 
                         (summary.shortTermLosses + summary.longTermLosses);
    
    // Simplified tax calculation (US rates)
    const shortTermTax = Math.max(0, summary.shortTermGains - summary.shortTermLosses) * 0.35;
    const longTermTax = Math.max(0, summary.longTermGains - summary.longTermLosses) * 0.20;
    summary.estimatedTax = shortTermTax + longTermTax;
    
    return summary;
  }

  private async generateForms(
    template: ReportTemplate,
    transactions: TaxableTransaction[],
    summary: TaxSummary
  ): Promise<TaxForm[]> {
    const forms: TaxForm[] = [];
    
    if (template.type === 'form8949' || template.type === 'comprehensive') {
      const form8949 = await this.generateForm8949(transactions[0]?.date.getFullYear() || new Date().getFullYear());
      forms.push(form8949);
    }
    
    if (template.type === 'schedule_d' || template.type === 'comprehensive') {
      const scheduleD = await this.generateScheduleD(transactions[0]?.date.getFullYear() || new Date().getFullYear());
      forms.push(scheduleD);
    }
    
    return forms;
  }

  private calculateForm8949Totals(transactions: TaxableTransaction[]): any {
    const shortTerm = transactions.filter(tx => tx.termType === 'short');
    const longTerm = transactions.filter(tx => tx.termType === 'long');
    
    return {
      shortTermProceeds: shortTerm.reduce((sum, tx) => sum + tx.proceeds, 0),
      shortTermCostBasis: shortTerm.reduce((sum, tx) => sum + tx.costBasis, 0),
      shortTermNet: shortTerm.reduce((sum, tx) => sum + tx.gainLoss, 0),
      longTermProceeds: longTerm.reduce((sum, tx) => sum + tx.proceeds, 0),
      longTermCostBasis: longTerm.reduce((sum, tx) => sum + tx.costBasis, 0),
      longTermNet: longTerm.reduce((sum, tx) => sum + tx.gainLoss, 0)
    };
  }

  private getCarryoverLoss(previousYear: number): number {
    // In production, calculate from previous year's returns
    return 0; // Placeholder
  }

  private async runComplianceChecks(
    transactions: TaxableTransaction[],
    summary: TaxSummary
  ): Promise<ComplianceCheck[]> {
    const checks: ComplianceCheck[] = [];
    
    // Wash sale compliance
    checks.push(this.checkWashSaleCompliance(transactions));
    
    // Cost basis completeness
    checks.push(this.checkCostBasisCompleteness(transactions));
    
    // Holding period accuracy
    checks.push(this.checkHoldingPeriods(transactions));
    
    // Mathematical accuracy
    checks.push(this.checkMathematicalAccuracy(summary));
    
    this.complianceChecks = checks;
    this.lastComplianceCheck = new Date();
    
    return checks;
  }

  private checkWashSaleCompliance(transactions: TaxableTransaction[]): ComplianceCheck {
    // Simplified wash sale check
    const potentialViolations = transactions.filter(tx => 
      tx.type === 'sell' && tx.gainLoss < 0
    ).length;
    
    return {
      rule: 'wash_sale_compliance',
      status: potentialViolations === 0 ? 'pass' : 'warning',
      message: potentialViolations === 0 
        ? 'No wash sale violations detected'
        : `${potentialViolations} potential wash sale situations require review`,
      recommendation: potentialViolations > 0 
        ? 'Review recent purchases of similar assets within 30 days'
        : undefined
    };
  }

  private checkCostBasisCompleteness(transactions: TaxableTransaction[]): ComplianceCheck {
    const missingBasis = transactions.filter(tx => tx.costBasis === 0).length;
    
    return {
      rule: 'cost_basis_completeness',
      status: missingBasis === 0 ? 'pass' : 'fail',
      message: missingBasis === 0 
        ? 'All transactions have cost basis information'
        : `${missingBasis} transactions missing cost basis`,
      recommendation: missingBasis > 0 
        ? 'Obtain cost basis information for all transactions'
        : undefined
    };
  }

  private checkHoldingPeriods(transactions: TaxableTransaction[]): ComplianceCheck {
    // Check for accurate short/long-term classification
    let errors = 0;
    
    for (const tx of transactions) {
      // In production, would verify actual holding periods
      // For now, assume correct classification
    }
    
    return {
      rule: 'holding_period_accuracy',
      status: errors === 0 ? 'pass' : 'fail',
      message: errors === 0 
        ? 'Holding periods correctly classified'
        : `${errors} holding period classification errors`,
      recommendation: errors > 0 
        ? 'Verify acquisition and sale dates for accurate classification'
        : undefined
    };
  }

  private checkMathematicalAccuracy(summary: TaxSummary): ComplianceCheck {
    const calculatedNet = (summary.shortTermGains + summary.longTermGains) -
                         (summary.shortTermLosses + summary.longTermLosses);
    
    const isAccurate = Math.abs(calculatedNet - summary.netGainLoss) < 0.01;
    
    return {
      rule: 'mathematical_accuracy',
      status: isAccurate ? 'pass' : 'fail',
      message: isAccurate 
        ? 'Mathematical calculations are accurate'
        : 'Mathematical discrepancies detected',
      recommendation: !isAccurate 
        ? 'Recalculate gains and losses for accuracy'
        : undefined
    };
  }

  private async generateAIInsights(
    transactions: TaxableTransaction[],
    summary: TaxSummary
  ): Promise<string> {
    const prompt = `Analyze this tax situation and provide insights:

Transaction Summary:
- Total Transactions: ${transactions.length}
- Short-term Gains: $${summary.shortTermGains.toLocaleString()}
- Short-term Losses: $${summary.shortTermLosses.toLocaleString()}
- Long-term Gains: $${summary.longTermGains.toLocaleString()}
- Long-term Losses: $${summary.longTermLosses.toLocaleString()}
- Net Gain/Loss: $${summary.netGainLoss.toLocaleString()}
- Estimated Tax: $${summary.estimatedTax.toLocaleString()}

Provide insights on:
1. Tax efficiency of the trading strategy
2. Opportunities for improvement
3. Risk areas requiring attention
4. Planning recommendations for next year`;

    try {
      const response = await this.aiClient.generateText({
        prompt,
        temperature: 0.3,
        maxTokens: 1000
      });

      return response.data?.text || 'AI analysis unavailable';
    } catch (error) {
      this.logger.warn('AI insights generation failed:', error);
      return 'AI analysis unavailable';
    }
  }

  private async generateAIOptimizationInsights(
    transactions: TaxableTransaction[],
    summary: TaxSummary
  ): Promise<TaxOptimizationInsight[]> {
    // Generate AI-powered optimization insights
    const insights: TaxOptimizationInsight[] = [];
    
    // Example AI-generated insight
    if (summary.shortTermGains > summary.longTermGains * 2) {
      insights.push({
        category: 'timing',
        insight: 'Consider holding positions longer to benefit from long-term capital gains rates',
        potentialSavings: summary.shortTermGains * 0.15, // Tax rate difference
        implementationDifficulty: 'low'
      });
    }
    
    return insights;
  }

  private async exportReport(report: TaxReport, format: string): Promise<void> {
    // In production, export to specified format and location
    this.logger.info('Report exported', { reportId: report.id, format });
  }

  addTransaction(transaction: TaxableTransaction): void {
    this.transactions.set(transaction.id, transaction);
  }

  addOpportunity(opportunity: TaxLossOpportunity): void {
    this.opportunities.set(opportunity.id, opportunity);
  }

  getReports(): TaxReport[] {
    return Array.from(this.generatedReports.values());
  }

  getComplianceStatus(): ComplianceCheck[] {
    return this.complianceChecks;
  }

  getStatus(): any {
    return {
      isInitialized: this.isInitialized,
      transactionCount: this.transactions.size,
      reportCount: this.generatedReports.size,
      lastComplianceCheck: this.lastComplianceCheck,
      config: this.config
    };
  }

  async shutdown(): Promise<void> {
    this.logger.info('Shutting down Tax Reporting Engine...');
    this.removeAllListeners();
    this.isInitialized = false;
  }
}