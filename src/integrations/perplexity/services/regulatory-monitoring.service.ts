/**
 * Regulatory Monitoring Service
 * Handles regulatory compliance monitoring and alerts
 */

import { EventEmitter } from 'events';
import { 
  RegulatoryAlert,
  RegulatoryAnalysis,
  ComplianceRequirement,
  ImpactAssessment,
  PerplexityRequest,
  PerplexityResponse
} from '../types';
import { PerplexityClient } from '../client/perplexity-client';
import Logger from '@/shared/logging/logger';

const logger = Logger.getLogger('regulatory-monitoring-service');

export interface RegulatoryQuery {
  jurisdictions: string[];
  categories?: string[];
  severity?: ('low' | 'medium' | 'high' | 'critical')[];
  dateRange?: {
    start: Date;
    end: Date;
  };
  keywords?: string[];
  includeAnalysis?: boolean;
}

export interface ComplianceCheckRequest {
  entity: string;
  jurisdiction: string;
  activities: string[];
  assetTypes?: string[];
}

export class RegulatoryMonitoringService extends EventEmitter {
  private client: PerplexityClient;
  private monitoringIntervals: Map<string, NodeJS.Timeout> = new Map();

  constructor(client: PerplexityClient) {
    super();
    this.client = client;
  }

  async getRegulatoryAlerts(query: RegulatoryQuery): Promise<RegulatoryAlert[]> {
    try {
      logger.info('Fetching regulatory alerts', query);

      const alerts: RegulatoryAlert[] = [];

      // Query for each jurisdiction
      for (const jurisdiction of query.jurisdictions) {
        const jurisdictionAlerts = await this.queryJurisdictionAlerts(
          jurisdiction,
          query
        );
        alerts.push(...jurisdictionAlerts);
      }

      // Sort by severity and date
      alerts.sort((a, b) => {
        const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
        if (severityDiff !== 0) return severityDiff;
        
        return b.effectiveDate?.getTime() || 0 - (a.effectiveDate?.getTime() || 0);
      });

      // Optionally perform detailed analysis
      if (query.includeAnalysis) {
        for (const alert of alerts) {
          alert.analysis = await this.analyzeRegulatoryImpact(alert);
        }
      }

      logger.info('Regulatory alerts retrieved', { 
        count: alerts.length,
        jurisdictions: query.jurisdictions 
      });

      return alerts;
    } catch (error) {
      logger.error('Failed to fetch regulatory alerts:', error);
      throw error;
    }
  }

  private async queryJurisdictionAlerts(
    jurisdiction: string,
    query: RegulatoryQuery
  ): Promise<RegulatoryAlert[]> {
    const request: PerplexityRequest = {
      model: 'sonar-medium-chat',
      messages: [
        {
          role: 'system',
          content: 'You are a regulatory compliance expert. Provide accurate, up-to-date regulatory information.'
        },
        {
          role: 'user',
          content: this.buildRegulatoryPrompt(jurisdiction, query)
        }
      ],
      max_tokens: 4000,
      temperature: 0.1,
      return_citations: true,
      search_recency_filter: 'month'
    };

    const response = await this.client.chat(request);
    return this.parseRegulatoryResponse(response, jurisdiction);
  }

  private buildRegulatoryPrompt(jurisdiction: string, query: RegulatoryQuery): string {
    let prompt = `Provide recent regulatory updates for ${jurisdiction} financial markets`;

    if (query.categories && query.categories.length > 0) {
      prompt += ` focusing on: ${query.categories.join(', ')}`;
    }

    if (query.dateRange) {
      prompt += `. Date range: ${query.dateRange.start.toISOString().split('T')[0]} to ${query.dateRange.end.toISOString().split('T')[0]}`;
    }

    if (query.keywords && query.keywords.length > 0) {
      prompt += `. Keywords: ${query.keywords.join(', ')}`;
    }

    prompt += `
    For each regulatory update, provide:
    1. Type: new regulation, amendment, enforcement action, guidance, or consultation
    2. Severity: critical, high, medium, or low
    3. Issuing agency and official title
    4. Summary of the regulation/update
    5. Effective date and any deadlines
    6. Impacted areas (e.g., crypto, securities, derivatives, banking)
    7. Key compliance requirements
    8. Source URL and official documentation links
    
    Format the response as structured data that can be parsed.`;

    return prompt;
  }

  private parseRegulatoryResponse(
    response: PerplexityResponse,
    jurisdiction: string
  ): RegulatoryAlert[] {
    const content = response.choices[0]?.message?.content || '';
    const alerts: RegulatoryAlert[] = [];

    try {
      // Parse structured response
      const sections = content.split(/Update \d+:|Regulatory Update:/gi).filter(s => s.trim());
      
      for (const section of sections) {
        const alert = this.extractAlertData(section, jurisdiction);
        if (alert) {
          // Add citations
          if (response.citations && response.citations.length > 0) {
            alert.sourceUrl = response.citations[0].url;
          }
          alerts.push(alert);
        }
      }
    } catch (error) {
      logger.error('Failed to parse regulatory response:', error);
    }

    return alerts;
  }

  private extractAlertData(section: string, jurisdiction: string): RegulatoryAlert | null {
    try {
      const typeMatch = section.match(/Type:\s*([^\n]+)/i);
      const severityMatch = section.match(/Severity:\s*(low|medium|high|critical)/i);
      const agencyMatch = section.match(/Agency:\s*([^\n]+)/i);
      const titleMatch = section.match(/Title:\s*([^\n]+)/i);
      const summaryMatch = section.match(/Summary:\s*([^\n]+(?:\n(?!^\w+:).*)*)/im);
      const effectiveDateMatch = section.match(/Effective Date:\s*(\d{4}-\d{2}-\d{2})/i);
      const deadlineMatch = section.match(/Deadline:\s*(\d{4}-\d{2}-\d{2})/i);

      if (!typeMatch || !severityMatch || !titleMatch) {
        return null;
      }

      const alert: RegulatoryAlert = {
        id: `${jurisdiction}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: this.normalizeAlertType(typeMatch[1]),
        severity: severityMatch[1].toLowerCase() as any,
        jurisdiction,
        agency: agencyMatch ? agencyMatch[1].trim() : 'Unknown',
        title: titleMatch[1].trim(),
        summary: summaryMatch ? summaryMatch[1].trim() : '',
        effectiveDate: effectiveDateMatch ? new Date(effectiveDateMatch[1]) : undefined,
        deadlineDate: deadlineMatch ? new Date(deadlineMatch[1]) : undefined,
        impactedAreas: this.extractImpactedAreas(section),
        requiredActions: this.extractRequiredActions(section),
        sourceUrl: '',
        fullText: undefined
      };

      return alert;
    } catch (error) {
      logger.error('Failed to extract alert data:', error);
      return null;
    }
  }

  private normalizeAlertType(type: string): RegulatoryAlert['type'] {
    const normalized = type.toLowerCase().trim();
    if (normalized.includes('new')) return 'new-regulation';
    if (normalized.includes('amendment')) return 'amendment';
    if (normalized.includes('enforcement')) return 'enforcement';
    if (normalized.includes('guidance')) return 'guidance';
    if (normalized.includes('consultation')) return 'consultation';
    return 'guidance';
  }

  private extractImpactedAreas(section: string): string[] {
    const areasMatch = section.match(/Impacted Areas?:\s*([^\n]+(?:\n(?!^\w+:).*)*)/im);
    if (!areasMatch) return [];

    return areasMatch[1]
      .split(/[,;\n]/)
      .map(area => area.trim())
      .filter(area => area.length > 0);
  }

  private extractRequiredActions(section: string): string[] {
    const actionsMatch = section.match(/Required Actions?:\s*([^\n]+(?:\n(?!^\w+:).*)*)/im);
    if (!actionsMatch) return [];

    return actionsMatch[1]
      .split(/[•\-\n]/)
      .map(action => action.trim())
      .filter(action => action.length > 10);
  }

  async analyzeRegulatoryImpact(alert: RegulatoryAlert): Promise<RegulatoryAnalysis> {
    try {
      logger.info('Analyzing regulatory impact', { 
        alertId: alert.id,
        jurisdiction: alert.jurisdiction 
      });

      const request: PerplexityRequest = {
        model: 'sonar-medium-chat',
        messages: [
          {
            role: 'system',
            content: 'You are a regulatory compliance analyst. Provide detailed impact analysis.'
          },
          {
            role: 'user',
            content: this.buildImpactAnalysisPrompt(alert)
          }
        ],
        max_tokens: 2000,
        temperature: 0.1
      };

      const response = await this.client.chat(request);
      return this.parseImpactAnalysis(response, alert);
    } catch (error) {
      logger.error('Failed to analyze regulatory impact:', error);
      throw error;
    }
  }

  private buildImpactAnalysisPrompt(alert: RegulatoryAlert): string {
    return `Analyze the regulatory impact of: ${alert.title}
    
    Jurisdiction: ${alert.jurisdiction}
    Type: ${alert.type}
    Summary: ${alert.summary}
    Impacted Areas: ${alert.impactedAreas.join(', ')}
    
    Provide:
    1. Detailed compliance requirements with priorities
    2. Business impact assessment (minimal/moderate/significant/severe)
    3. Operational changes required
    4. Estimated financial impact and compliance costs
    5. Implementation timeline recommendations
    6. Specific action items for compliance
    7. Risk assessment if non-compliant
    
    Format as structured analysis data.`;
  }

  private parseImpactAnalysis(
    response: PerplexityResponse,
    alert: RegulatoryAlert
  ): RegulatoryAnalysis {
    const content = response.choices[0]?.message?.content || '';

    return {
      complianceRequirements: this.extractComplianceRequirements(content, alert),
      impactAssessment: this.extractImpactAssessment(content),
      recommendedActions: this.extractRecommendedActions(content),
      estimatedComplianceCost: this.extractComplianceCost(content),
      implementationTimeline: this.extractTimeline(content)
    };
  }

  private extractComplianceRequirements(
    content: string,
    alert: RegulatoryAlert
  ): ComplianceRequirement[] {
    const requirements: ComplianceRequirement[] = [];
    const reqPattern = /Requirement \d+:|Compliance Requirement:/gi;
    const sections = content.split(reqPattern).filter(s => s.trim());

    sections.forEach((section, index) => {
      const descMatch = section.match(/Description:\s*([^\n]+)/i);
      const priorityMatch = section.match(/Priority:\s*(low|medium|high|critical)/i);
      const deadlineMatch = section.match(/Deadline:\s*(\d{4}-\d{2}-\d{2})/i);

      if (descMatch) {
        requirements.push({
          id: `${alert.id}-req-${index + 1}`,
          description: descMatch[1].trim(),
          category: alert.impactedAreas[0] || 'general',
          priority: (priorityMatch ? priorityMatch[1] : 'medium') as any,
          deadline: deadlineMatch ? new Date(deadlineMatch[1]) : alert.deadlineDate,
          status: 'pending'
        });
      }
    });

    // If no structured requirements found, extract from lists
    if (requirements.length === 0) {
      const listMatch = content.match(/Requirements?:?\s*([^\n]+(?:\n(?!^\w+:).*)*)/im);
      if (listMatch) {
        const items = listMatch[1].split(/[•\-\n]/).filter(item => item.trim().length > 10);
        items.forEach((item, index) => {
          requirements.push({
            id: `${alert.id}-req-${index + 1}`,
            description: item.trim(),
            category: alert.impactedAreas[0] || 'general',
            priority: 'medium',
            deadline: alert.deadlineDate,
            status: 'pending'
          });
        });
      }
    }

    return requirements;
  }

  private extractImpactAssessment(content: string): ImpactAssessment {
    const businessImpactMatch = content.match(/Business Impact:\s*(minimal|moderate|significant|severe)/i);
    const riskLevelMatch = content.match(/Risk Level:\s*(low|medium|high|critical)/i);
    const financialImpactMatch = content.match(/Financial Impact:\s*\$?([\d,]+\.?\d*)\s*(thousand|million)?/i);

    const operationalChanges = this.extractListData(
      content,
      /Operational Changes?:\s*([^\n]+(?:\n(?!^\w+:).*)*)/im
    );

    return {
      businessImpact: (businessImpactMatch ? businessImpactMatch[1] : 'moderate') as any,
      operationalChanges,
      financialImpact: this.parseFinancialValue(financialImpactMatch),
      riskLevel: (riskLevelMatch ? riskLevelMatch[1] : 'medium') as any
    };
  }

  private extractRecommendedActions(content: string): string[] {
    return this.extractListData(
      content,
      /Recommended Actions?:\s*([^\n]+(?:\n(?!^\w+:).*)*)/im
    );
  }

  private extractComplianceCost(content: string): number | undefined {
    const costMatch = content.match(/Compliance Cost:\s*\$?([\d,]+\.?\d*)\s*(thousand|million)?/i);
    return this.parseFinancialValue(costMatch);
  }

  private extractTimeline(content: string): string | undefined {
    const timelineMatch = content.match(/Implementation Timeline:\s*([^\n]+)/i);
    return timelineMatch ? timelineMatch[1].trim() : undefined;
  }

  private extractListData(text: string, pattern: RegExp): string[] {
    const match = text.match(pattern);
    if (!match || !match[1]) return [];

    return match[1]
      .split(/[•\-\n]/)
      .map(item => item.trim())
      .filter(item => item.length > 10);
  }

  private parseFinancialValue(match: RegExpMatchArray | null): number | undefined {
    if (!match) return undefined;

    let value = parseFloat(match[1].replace(/,/g, ''));

    if (match[2]) {
      if (match[2].toLowerCase() === 'thousand') {
        value *= 1000;
      } else if (match[2].toLowerCase() === 'million') {
        value *= 1000000;
      }
    }

    return value;
  }

  async checkCompliance(request: ComplianceCheckRequest): Promise<any> {
    try {
      logger.info('Checking compliance requirements', request);

      const perplexityRequest: PerplexityRequest = {
        model: 'sonar-medium-chat',
        messages: [
          {
            role: 'system',
            content: 'You are a regulatory compliance expert. Provide comprehensive compliance analysis.'
          },
          {
            role: 'user',
            content: this.buildComplianceCheckPrompt(request)
          }
        ],
        max_tokens: 3000,
        temperature: 0.1,
        return_citations: true
      };

      const response = await this.client.chat(perplexityRequest);
      return this.parseComplianceCheck(response);
    } catch (error) {
      logger.error('Failed to check compliance:', error);
      throw error;
    }
  }

  private buildComplianceCheckPrompt(request: ComplianceCheckRequest): string {
    return `Analyze compliance requirements for:
    Entity: ${request.entity}
    Jurisdiction: ${request.jurisdiction}
    Activities: ${request.activities.join(', ')}
    ${request.assetTypes ? `Asset Types: ${request.assetTypes.join(', ')}` : ''}
    
    Provide:
    1. Required licenses and registrations
    2. Ongoing compliance obligations
    3. Reporting requirements
    4. Capital and operational requirements
    5. Prohibited activities or restrictions
    6. Recent regulatory changes affecting these activities
    7. Penalties for non-compliance
    8. Best practices for maintaining compliance
    
    Include specific regulatory references and official sources.`;
  }

  private parseComplianceCheck(response: PerplexityResponse): any {
    const content = response.choices[0]?.message?.content || '';

    return {
      licenses: this.extractListData(content, /Licenses?.*?:\s*([^\n]+(?:\n(?!^\w+:).*)*)/im),
      obligations: this.extractListData(content, /Obligations?.*?:\s*([^\n]+(?:\n(?!^\w+:).*)*)/im),
      reporting: this.extractListData(content, /Reporting.*?:\s*([^\n]+(?:\n(?!^\w+:).*)*)/im),
      requirements: this.extractListData(content, /Requirements?.*?:\s*([^\n]+(?:\n(?!^\w+:).*)*)/im),
      restrictions: this.extractListData(content, /Restrictions?.*?:\s*([^\n]+(?:\n(?!^\w+:).*)*)/im),
      penalties: this.extractListData(content, /Penalties?.*?:\s*([^\n]+(?:\n(?!^\w+:).*)*)/im),
      bestPractices: this.extractListData(content, /Best Practices?.*?:\s*([^\n]+(?:\n(?!^\w+:).*)*)/im),
      sources: response.citations || []
    };
  }

  async startMonitoring(
    jurisdictions: string[],
    interval: number = 3600000, // 1 hour default
    callback: (alerts: RegulatoryAlert[]) => void
  ): Promise<string> {
    const monitoringId = `monitor-${Date.now()}`;
    
    const checkForAlerts = async () => {
      try {
        const alerts = await this.getRegulatoryAlerts({
          jurisdictions,
          severity: ['high', 'critical'],
          dateRange: {
            start: new Date(Date.now() - interval),
            end: new Date()
          }
        });

        if (alerts.length > 0) {
          callback(alerts);
          this.emit('new-alerts', { monitoringId, alerts });
        }
      } catch (error) {
        logger.error('Monitoring check failed:', error);
        this.emit('monitoring-error', { monitoringId, error });
      }
    };

    // Initial check
    await checkForAlerts();

    // Set up recurring check
    const intervalId = setInterval(checkForAlerts, interval);
    this.monitoringIntervals.set(monitoringId, intervalId);

    logger.info('Started regulatory monitoring', { 
      monitoringId,
      jurisdictions,
      interval 
    });

    return monitoringId;
  }

  stopMonitoring(monitoringId: string): void {
    const intervalId = this.monitoringIntervals.get(monitoringId);
    if (intervalId) {
      clearInterval(intervalId);
      this.monitoringIntervals.delete(monitoringId);
      logger.info('Stopped regulatory monitoring', { monitoringId });
    }
  }

  stopAllMonitoring(): void {
    for (const [id, interval] of this.monitoringIntervals.entries()) {
      clearInterval(interval);
    }
    this.monitoringIntervals.clear();
    logger.info('Stopped all regulatory monitoring');
  }

  async getJurisdictionSummary(jurisdiction: string): Promise<any> {
    try {
      const request: PerplexityRequest = {
        model: 'sonar-medium-chat',
        messages: [
          {
            role: 'system',
            content: 'You are a regulatory expert. Provide comprehensive jurisdiction summaries.'
          },
          {
            role: 'user',
            content: `Provide a comprehensive regulatory summary for ${jurisdiction} covering:
              1. Key regulatory bodies and their roles
              2. Main financial regulations and frameworks
              3. Licensing requirements for different activities
              4. Recent regulatory trends and changes
              5. Upcoming regulatory initiatives
              6. Comparison with other major jurisdictions
              7. Regulatory stance on crypto and digital assets`
          }
        ],
        max_tokens: 3000,
        temperature: 0.1,
        return_citations: true
      };

      const response = await this.client.chat(request);
      return this.parseJurisdictionSummary(response, jurisdiction);
    } catch (error) {
      logger.error('Failed to get jurisdiction summary:', error);
      throw error;
    }
  }

  private parseJurisdictionSummary(response: PerplexityResponse, jurisdiction: string): any {
    const content = response.choices[0]?.message?.content || '';

    return {
      jurisdiction,
      regulatoryBodies: this.extractListData(
        content,
        /Regulatory Bodies?.*?:\s*([^\n]+(?:\n(?!^\w+:).*)*)/im
      ),
      mainRegulations: this.extractListData(
        content,
        /Main Regulations?.*?:\s*([^\n]+(?:\n(?!^\w+:).*)*)/im
      ),
      licensingRequirements: this.extractListData(
        content,
        /Licensing.*?:\s*([^\n]+(?:\n(?!^\w+:).*)*)/im
      ),
      recentTrends: this.extractListData(
        content,
        /Recent Trends?.*?:\s*([^\n]+(?:\n(?!^\w+:).*)*)/im
      ),
      upcomingInitiatives: this.extractListData(
        content,
        /Upcoming.*?:\s*([^\n]+(?:\n(?!^\w+:).*)*)/im
      ),
      cryptoStance: this.extractCryptoStance(content),
      sources: response.citations || []
    };
  }

  private extractCryptoStance(content: string): string {
    const cryptoMatch = content.match(/Crypto.*?Stance.*?:\s*([^\n]+(?:\n(?!^\w+:).*)*)/im);
    return cryptoMatch ? cryptoMatch[1].trim() : 'Not specified';
  }
}