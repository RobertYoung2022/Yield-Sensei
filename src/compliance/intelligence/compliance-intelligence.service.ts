/**
 * Enhanced Compliance Intelligence Service
 * Integrates Perplexity API for real-time regulatory monitoring and intelligent compliance recommendations
 */

import { EventEmitter } from 'events';
import Logger from '../../shared/logging/logger';
import { PerplexityClient } from '../../integrations/perplexity/client/perplexity-client';
import { AuditTrail } from '../reporting/audit-trail';
import {
  Jurisdiction,
  ComplianceRule,
  User,
  Transaction,
  ComplianceCategory,
  RiskLevel
} from '../types';

const logger = Logger.getLogger('compliance-intelligence');

// Enhanced Interfaces for Compliance Intelligence
export interface RegulatoryUpdate {
  id: string;
  title: string;
  jurisdiction: Jurisdiction;
  category: ComplianceCategory;
  severity: RiskLevel;
  effectiveDate: Date;
  description: string;
  impact: string[];
  actionItems: string[];
  source: string;
  documentUrl?: string;
  confidence: number;
  aiAnalysis: {
    summary: string;
    riskAssessment: string;
    recommendations: string[];
    affectedOperations: string[];
  };
  createdAt: Date;
  lastUpdated: Date;
}

export interface ComplianceIntelligence {
  id: string;
  type: 'regulatory-change' | 'risk-alert' | 'compliance-gap' | 'best-practice';
  jurisdiction: Jurisdiction;
  category: ComplianceCategory;
  priority: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  aiInsights: {
    analysis: string;
    recommendations: string[];
    implementationSteps: string[];
    timeline: string;
    resources: string[];
  };
  relatedRules: string[];
  affectedEntities: {
    users: string[];
    transactions: string[];
    protocols: string[];
  };
  confidence: number;
  sources: string[];
  createdAt: Date;
  validUntil?: Date;
}

export interface ComplianceRecommendation {
  id: string;
  type: 'immediate' | 'planned' | 'preventive' | 'corrective';
  urgency: RiskLevel;
  title: string;
  description: string;
  reasoning: string;
  implementation: {
    steps: string[];
    estimatedTime: string;
    resources: string[];
    dependencies: string[];
  };
  expectedOutcome: string;
  riskMitigation: string;
  cost: 'low' | 'medium' | 'high' | 'unknown';
  jurisdiction: Jurisdiction;
  category: ComplianceCategory;
  aiConfidence: number;
  createdAt: Date;
  implementedAt?: Date;
  status: 'pending' | 'in-progress' | 'completed' | 'rejected';
}

export interface IntelligenceQuery {
  type: 'regulatory-scan' | 'compliance-analysis' | 'risk-assessment' | 'gap-analysis';
  jurisdiction?: Jurisdiction[];
  category?: ComplianceCategory[];
  keywords?: string[];
  dateRange?: {
    startDate: Date;
    endDate: Date;
  };
  priority?: RiskLevel[];
  includeAIAnalysis?: boolean;
  maxResults?: number;
}

export interface ComplianceKnowledgeBase {
  lastUpdated: Date;
  entryCount: number;
  jurisdictionCoverage: Record<Jurisdiction, number>;
  categoryCoverage: Record<ComplianceCategory, number>;
  confidenceScore: number;
  sources: string[];
}

export class ComplianceIntelligenceService extends EventEmitter {
  private perplexityClient: PerplexityClient;
  private auditTrail: AuditTrail;
  private isInitialized = false;
  private knowledgeBase: Map<string, ComplianceIntelligence> = new Map();
  private regulatoryUpdates: Map<string, RegulatoryUpdate> = new Map();
  private recommendations: Map<string, ComplianceRecommendation> = new Map();
  private monitoringSchedule: NodeJS.Timeout | null = null;
  private rateLimitTracker = {
    requests: 0,
    resetTime: Date.now() + 60000
  };

  constructor(
    perplexityClient: PerplexityClient,
    auditTrail: AuditTrail
  ) {
    super();
    this.perplexityClient = perplexityClient;
    this.auditTrail = auditTrail;
    
    logger.info('ComplianceIntelligenceService initialized');
  }

  /**
   * Initialize the compliance intelligence service
   */
  async initialize(): Promise<void> {
    try {
      logger.info('Initializing Compliance Intelligence Service');

      // Initialize Perplexity client
      await this.perplexityClient.initialize();

      // Load existing knowledge base
      await this.loadKnowledgeBase();

      // Start regulatory monitoring
      await this.startRegulatoryMonitoring();

      this.isInitialized = true;
      logger.info('✅ Compliance Intelligence Service initialized successfully');
      
      this.emit('initialized');
    } catch (error) {
      logger.error('Failed to initialize Compliance Intelligence Service', { error });
      throw error;
    }
  }

  /**
   * Perform real-time regulatory scan using Perplexity API
   */
  async performRegulatoryScan(
    jurisdictions: Jurisdiction[] = ['US', 'EU', 'UK'],
    categories: ComplianceCategory[] = ['kyc-aml', 'securities', 'banking']
  ): Promise<RegulatoryUpdate[]> {
    try {
      logger.info('Performing regulatory scan', { jurisdictions, categories });

      const updates: RegulatoryUpdate[] = [];

      for (const jurisdiction of jurisdictions) {
        for (const category of categories) {
          const query = this.buildRegulatoryQuery(jurisdiction, category);
          const response = await this.queryPerplexity(query);
          const parsedUpdates = await this.parseRegulatoryResponse(response, jurisdiction, category);
          updates.push(...parsedUpdates);
        }
      }

      // Store updates in knowledge base
      for (const update of updates) {
        this.regulatoryUpdates.set(update.id, update);
        
        // Record in audit trail
        await this.auditTrail.recordAction({
          entityType: 'regulatory_update',
          entityId: update.id,
          action: 'REGULATORY_UPDATE_DETECTED',
          userId: 'system',
          jurisdiction: update.jurisdiction,
          compliance: true,
          after: { update }
        });
      }

      logger.info('Regulatory scan completed', { 
        updatesFound: updates.length,
        jurisdictions,
        categories
      });

      this.emit('regulatoryScanCompleted', { updates, jurisdictions, categories });

      return updates;
    } catch (error) {
      logger.error('Error performing regulatory scan', { error });
      throw error;
    }
  }

  /**
   * Analyze compliance gaps and generate recommendations
   */
  async analyzeComplianceGaps(
    user?: User,
    transaction?: Transaction,
    context?: Record<string, any>
  ): Promise<ComplianceRecommendation[]> {
    try {
      logger.info('Analyzing compliance gaps', { 
        userId: user?.id,
        transactionId: transaction?.id
      });

      const analysisContext = this.buildAnalysisContext(user, transaction, context);
      const query = this.buildGapAnalysisQuery(analysisContext);
      
      const response = await this.queryPerplexity(query);
      const recommendations = await this.parseRecommendations(response, analysisContext);

      // Store recommendations
      for (const recommendation of recommendations) {
        this.recommendations.set(recommendation.id, recommendation);
        
        // Record in audit trail
        await this.auditTrail.recordAction({
          entityType: 'compliance_recommendation',
          entityId: recommendation.id,
          action: 'RECOMMENDATION_GENERATED',
          userId: user?.id || 'system',
          jurisdiction: recommendation.jurisdiction,
          compliance: true,
          after: { recommendation }
        });
      }

      logger.info('Compliance gap analysis completed', { 
        recommendationsCount: recommendations.length
      });

      this.emit('complianceGapsAnalyzed', { recommendations, context: analysisContext });

      return recommendations;
    } catch (error) {
      logger.error('Error analyzing compliance gaps', { error });
      throw error;
    }
  }

  /**
   * Get compliance intelligence based on query
   */
  async getComplianceIntelligence(query: IntelligenceQuery): Promise<ComplianceIntelligence[]> {
    try {
      logger.info('Retrieving compliance intelligence', { query });

      let results = Array.from(this.knowledgeBase.values());

      // Apply filters
      if (query.jurisdiction?.length) {
        results = results.filter(intel => query.jurisdiction!.includes(intel.jurisdiction));
      }

      if (query.category?.length) {
        results = results.filter(intel => query.category!.includes(intel.category));
      }

      if (query.priority?.length) {
        results = results.filter(intel => query.priority!.includes(intel.priority as RiskLevel));
      }

      if (query.dateRange) {
        results = results.filter(intel => 
          intel.createdAt >= query.dateRange!.startDate &&
          intel.createdAt <= query.dateRange!.endDate
        );
      }

      if (query.keywords?.length) {
        const keywords = query.keywords.map(k => k.toLowerCase());
        results = results.filter(intel =>
          keywords.some(keyword =>
            intel.title.toLowerCase().includes(keyword) ||
            intel.description.toLowerCase().includes(keyword)
          )
        );
      }

      // Sort by priority and confidence
      results.sort((a, b) => {
        const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
        const aPriority = priorityOrder[a.priority as keyof typeof priorityOrder] || 0;
        const bPriority = priorityOrder[b.priority as keyof typeof priorityOrder] || 0;
        
        if (aPriority !== bPriority) {
          return bPriority - aPriority;
        }
        
        return b.confidence - a.confidence;
      });

      // Apply limit
      if (query.maxResults) {
        results = results.slice(0, query.maxResults);
      }

      logger.info('Compliance intelligence retrieved', { 
        resultsCount: results.length,
        totalAvailable: this.knowledgeBase.size
      });

      return results;
    } catch (error) {
      logger.error('Error retrieving compliance intelligence', { error });
      throw error;
    }
  }

  /**
   * Get knowledge base statistics
   */
  getKnowledgeBaseStats(): ComplianceKnowledgeBase {
    const jurisdictionCoverage: Record<Jurisdiction, number> = {} as Record<Jurisdiction, number>;
    const categoryCoverage: Record<ComplianceCategory, number> = {} as Record<ComplianceCategory, number>;
    
    // Initialize counters
    const jurisdictions: Jurisdiction[] = ['US', 'EU', 'UK', 'Singapore', 'Switzerland', 'Japan', 'Canada', 'Australia', 'Dubai', 'Hong Kong', 'Cayman Islands', 'BVI'];
    const categories: ComplianceCategory[] = ['kyc-aml', 'securities', 'banking', 'insurance', 'data-privacy', 'consumer-protection', 'market-conduct', 'operational', 'tax-reporting', 'sanctions'];
    
    jurisdictions.forEach(j => jurisdictionCoverage[j] = 0);
    categories.forEach(c => categoryCoverage[c] = 0);

    // Count entries
    let totalConfidence = 0;
    const sources = new Set<string>();

    for (const intel of this.knowledgeBase.values()) {
      jurisdictionCoverage[intel.jurisdiction]++;
      categoryCoverage[intel.category]++;
      totalConfidence += intel.confidence;
      intel.sources.forEach(source => sources.add(source));
    }

    return {
      lastUpdated: new Date(),
      entryCount: this.knowledgeBase.size,
      jurisdictionCoverage,
      categoryCoverage,
      confidenceScore: this.knowledgeBase.size > 0 ? totalConfidence / this.knowledgeBase.size : 0,
      sources: Array.from(sources)
    };
  }

  // Private helper methods

  private async startRegulatoryMonitoring(): Promise<void> {
    // Schedule regular regulatory scans (every 6 hours)
    this.monitoringSchedule = setInterval(async () => {
      try {
        await this.performRegulatoryScan();
      } catch (error) {
        logger.error('Error in scheduled regulatory monitoring', { error });
      }
    }, 6 * 60 * 60 * 1000);

    logger.info('Regulatory monitoring scheduled every 6 hours');
  }

  private buildRegulatoryQuery(jurisdiction: Jurisdiction, category: ComplianceCategory): string {
    const currentDate = new Date().toISOString().split('T')[0];
    
    return `
      Search for recent regulatory updates and changes in ${jurisdiction} related to ${category} 
      that occurred in the last 30 days (since ${new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}).
      
      Focus on:
      - New regulations, rules, or guidelines
      - Changes to existing compliance requirements
      - Regulatory announcements and guidance
      - Enforcement actions and their implications
      - Industry best practices and recommendations
      
      For each finding, provide:
      1. Title and brief description
      2. Effective date and implementation timeline
      3. Impact on financial services and DeFi operations
      4. Required compliance actions
      5. Risk assessment and severity level
      
      Source credibility is important - prioritize official regulatory bodies, 
      established legal firms, and reputable financial news sources.
    `;
  }

  private buildGapAnalysisQuery(context: Record<string, any>): string {
    return `
      Analyze potential compliance gaps and provide recommendations for the following context:
      
      ${JSON.stringify(context, null, 2)}
      
      Consider:
      1. Current regulatory requirements vs. implemented controls
      2. Industry best practices and standards
      3. Cross-jurisdictional compliance requirements
      4. Emerging regulatory trends and future requirements
      5. Risk-based approach to compliance
      
      Provide specific, actionable recommendations including:
      - Implementation steps and timeline
      - Resource requirements
      - Risk mitigation strategies
      - Cost-benefit analysis
      - Dependencies and prerequisites
    `;
  }

  private buildAnalysisContext(
    user?: User,
    transaction?: Transaction,
    context?: Record<string, any>
  ): Record<string, any> {
    return {
      user: user ? {
        jurisdiction: user.jurisdiction,
        activityLevel: user.activityLevel,
        riskProfile: user.riskProfile,
        kycStatus: user.kycStatus
      } : null,
      transaction: transaction ? {
        type: transaction.type,
        amount: transaction.amount,
        currency: transaction.currency,
        blockchain: transaction.blockchain,
        compliance: transaction.compliance
      } : null,
      additionalContext: context || {},
      timestamp: new Date().toISOString()
    };
  }

  private async queryPerplexity(prompt: string): Promise<any> {
    try {
      // Check rate limits
      await this.checkRateLimit();

      logger.debug('Querying Perplexity API', { promptLength: prompt.length });

      const response = await this.perplexityClient.chat({
        model: 'sonar-medium-chat',
        messages: [
          {
            role: 'system',
            content: 'You are a regulatory compliance expert with deep knowledge of financial services regulations across multiple jurisdictions. Provide accurate, actionable compliance intelligence.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 4000,
        temperature: 0.1,
        return_citations: true
      });

      this.rateLimitTracker.requests++;

      return response;
    } catch (error) {
      logger.error('Error querying Perplexity API', { error });
      throw error;
    }
  }

  private async checkRateLimit(): Promise<void> {
    if (Date.now() > this.rateLimitTracker.resetTime) {
      this.rateLimitTracker.requests = 0;
      this.rateLimitTracker.resetTime = Date.now() + 60000;
    }

    if (this.rateLimitTracker.requests >= 50) { // Conservative rate limit
      const waitTime = this.rateLimitTracker.resetTime - Date.now();
      logger.warn('Rate limit reached, waiting', { waitTime });
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }

  private async parseRegulatoryResponse(
    response: any,
    jurisdiction: Jurisdiction,
    category: ComplianceCategory
  ): Promise<RegulatoryUpdate[]> {
    // Implementation would parse the Perplexity response and extract regulatory updates
    // For now, return a mock structure
    const mockUpdate: RegulatoryUpdate = {
      id: `reg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      title: `Mock Regulatory Update for ${jurisdiction} ${category}`,
      jurisdiction,
      category,
      severity: 'medium' as RiskLevel,
      effectiveDate: new Date(),
      description: 'Mock regulatory update description',
      impact: ['Updated compliance requirements'],
      actionItems: ['Review current procedures'],
      source: 'Perplexity API',
      confidence: 0.85,
      aiAnalysis: {
        summary: 'AI-generated summary',
        riskAssessment: 'Medium risk impact',
        recommendations: ['Implement new procedures'],
        affectedOperations: ['Transaction monitoring']
      },
      createdAt: new Date(),
      lastUpdated: new Date()
    };

    return [mockUpdate];
  }

  private async parseRecommendations(
    response: any,
    context: Record<string, any>
  ): Promise<ComplianceRecommendation[]> {
    // Implementation would parse the Perplexity response and extract recommendations
    // For now, return a mock structure
    const mockRecommendation: ComplianceRecommendation = {
      id: `rec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'preventive',
      urgency: 'medium' as RiskLevel,
      title: 'Mock Compliance Recommendation',
      description: 'Mock recommendation description',
      reasoning: 'AI analysis indicates potential gap',
      implementation: {
        steps: ['Step 1', 'Step 2'],
        estimatedTime: '2-4 weeks',
        resources: ['Compliance team'],
        dependencies: []
      },
      expectedOutcome: 'Improved compliance posture',
      riskMitigation: 'Reduces regulatory risk',
      cost: 'medium',
      jurisdiction: context['user']?.jurisdiction || 'US',
      category: 'kyc-aml',
      aiConfidence: 0.8,
      createdAt: new Date(),
      status: 'pending'
    };

    return [mockRecommendation];
  }

  private async loadKnowledgeBase(): Promise<void> {
    // Implementation would load existing knowledge base from storage
    logger.debug('Loading compliance knowledge base');
  }

  private generateId(): string {
    return `intel_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

export default ComplianceIntelligenceService; 