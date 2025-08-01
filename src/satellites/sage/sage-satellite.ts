/**
 * Sage Satellite Agent
 * Market & Protocol Research + RWA Integration
 * Main satellite agent that coordinates all research and analysis components
 */

import { EventEmitter } from 'events';
import { 
  AgentId, 
  AgentType, 
  AgentConfig, 
  SatelliteAgent, 
  AgentStatus,
  Message 
} from '@/types';
import { 
  ProtocolData, 
  ProtocolAnalysis, 
  RWAData, 
  AnalysisRequest,
  AnalysisResponse
} from './types';
import { RWAOpportunityScore } from './rwa/opportunity-scoring-system';
import { FundamentalAnalysisEngine, FundamentalAnalysisConfig } from './research/fundamental-analysis-engine';
import { RWAOpportunityScoringSystem, RWAScoringConfig } from './rwa/opportunity-scoring-system';
import { ComplianceMonitoringFramework, ComplianceMonitoringConfig } from './compliance/compliance-monitoring-framework';
import { getUnifiedAIClient, UnifiedAIClient } from '@/integrations/ai/unified-ai-client';
import { UnifiedAIClientConfig } from '@/integrations/ai/types';
import Logger from '@/shared/logging/logger';

const logger = Logger.getLogger('sage-satellite');

/**
 * Sage Satellite Configuration
 */
export interface SageSatelliteConfig {
  id: AgentId;
  name: string;
  version: string;
  fundamentalAnalysis: FundamentalAnalysisConfig;
  rwaScoring: RWAScoringConfig;
  complianceMonitoring: ComplianceMonitoringConfig;
  unifiedAIClient?: Partial<UnifiedAIClientConfig>;
  enableRealTimeAnalysis: boolean;
  analysisInterval: number; // milliseconds
  maxConcurrentAnalyses: number;
  enableNotifications: boolean;
  enableAuditTrail: boolean;
}

export const DEFAULT_SAGE_CONFIG: SageSatelliteConfig = {
  id: 'sage',
  name: 'Sage Satellite',
  version: '1.0.0',
  fundamentalAnalysis: {
    enableRealTimeAnalysis: true,
    analysisInterval: 300000, // 5 minutes
    confidenceThreshold: 0.7,
    enableMLModels: true,
    modelUpdateInterval: 86400000, // 24 hours
    maxConcurrentAnalyses: 10,
    cacheResults: true,
    cacheTTL: 300000 // 5 minutes
  },
  rwaScoring: {
    enableInstitutionalFeeds: true,
    riskAdjustmentFactor: 1.5,
    volatilityNormalization: true,
    multiFactorWeights: {
      yield: 0.25,
      risk: 0.25,
      liquidity: 0.15,
      regulatory: 0.15,
      collateral: 0.1,
      market: 0.1
    },
    complianceVerification: true,
    updateInterval: 300000, // 5 minutes
    cacheResults: true,
    cacheTTL: 300000 // 5 minutes
  },
  complianceMonitoring: {
    enableRealTimeMonitoring: true,
    monitoringInterval: 60000, // 1 minute
    alertThresholds: {
      low: 0.3,
      medium: 0.5,
      high: 0.7,
      critical: 0.9
    },
    jurisdictions: ['US', 'EU', 'UK', 'Singapore', 'Switzerland'],
    enableAutoRemediation: false,
    complianceScoring: true,
    auditTrail: true,
    updateInterval: 300000 // 5 minutes
  },
  unifiedAIClient: {
    defaultProvider: 'perplexity',
    fallbackProviders: ['anthropic', 'openai'],
    loadBalancing: {
      enabled: true,
      strategy: 'least-used'
    }
  },
  enableRealTimeAnalysis: true,
  analysisInterval: 300000, // 5 minutes
  maxConcurrentAnalyses: 10,
  enableNotifications: true,
  enableAuditTrail: true
};

/**
 * Sage Satellite Agent
 */
export class SageSatelliteAgent extends EventEmitter implements SatelliteAgent {
  readonly id: AgentId;
  readonly type: AgentType = 'sage';
  readonly config: AgentConfig;

  private sageConfig: SageSatelliteConfig;
  private status: AgentStatus;
  private startTime: Date = new Date();

  // Core components
  private fundamentalAnalysisEngine: FundamentalAnalysisEngine;
  private rwaScoringSystem: RWAOpportunityScoringSystem;
  private complianceFramework: ComplianceMonitoringFramework;
  private unifiedAIClient: UnifiedAIClient;

  // Runtime state
  private isInitialized: boolean = false;
  private _isRunning: boolean = false;
  private analysisInterval?: NodeJS.Timeout;
  private pendingAnalyses: Map<string, AnalysisRequest> = new Map();
  private analysisResults: Map<string, AnalysisResponse> = new Map();

  constructor(config: SageSatelliteConfig = DEFAULT_SAGE_CONFIG) {
    super();
    this.sageConfig = config;
    this.id = config.id;
    this.config = {
      id: config.id,
      type: 'sage',
      name: config.name,
      version: config.version,
      implementation: 'custom',
      config: config as unknown as Record<string, unknown>
    };

    // Initialize status
    this.status = {
      id: this.id,
      status: 'initializing',
      health: 'unhealthy',
      lastHeartbeat: new Date(),
      uptime: 0,
      metrics: {
        messagesSent: 0,
        messagesReceived: 0,
        tasksProcessed: 0,
        errors: 0,
        avgResponseTime: 0,
        memoryUsage: 0,
        cpuUsage: 0
      }
    };

    // Initialize core components
    this.fundamentalAnalysisEngine = FundamentalAnalysisEngine.getInstance(config.fundamentalAnalysis);
    this.rwaScoringSystem = RWAOpportunityScoringSystem.getInstance(config.rwaScoring);
    this.complianceFramework = ComplianceMonitoringFramework.getInstance(config.complianceMonitoring);
    this.unifiedAIClient = getUnifiedAIClient(config.unifiedAIClient);

    this.setupEventHandlers();
  }

  async initialize(): Promise<void> {
    try {
      logger.info('Initializing Sage Satellite Agent...');

      // Initialize core components
      await this.fundamentalAnalysisEngine.initialize();
      await this.rwaScoringSystem.initialize();
      await this.complianceFramework.initialize();
      // UnifiedAIClient initializes automatically, just check health
      await this.unifiedAIClient.refreshHealthStatus();

      this.isInitialized = true;
      this.status.status = 'initializing';
      this.status.health = 'healthy';

      logger.info('Sage Satellite Agent initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Sage Satellite Agent:', error);
      this.status.status = 'error';
      this.status.health = 'unhealthy';
      throw error;
    }
  }

  async start(): Promise<void> {
    try {
      if (!this.isInitialized) {
        throw new Error('Sage Satellite Agent must be initialized before starting');
      }

      logger.info('Starting Sage Satellite Agent...');

      this._isRunning = true;
      this.status.status = 'running';
      this.startTime = new Date();

      // Start real-time analysis if enabled
      if (this.sageConfig.enableRealTimeAnalysis) {
        this.startRealTimeAnalysis();
      }

      logger.info('Sage Satellite Agent started successfully');
    } catch (error) {
      logger.error('Failed to start Sage Satellite Agent:', error);
      this.status.status = 'error';
      this.status.health = 'unhealthy';
      throw error;
    }
  }

  async stop(): Promise<void> {
    try {
      logger.info('Stopping Sage Satellite Agent...');

      this._isRunning = false;
      this.status.status = 'stopped';

      // Stop real-time analysis
      if (this.analysisInterval) {
        clearInterval(this.analysisInterval);
      }

      logger.info('Sage Satellite Agent stopped successfully');
    } catch (error) {
      logger.error('Failed to stop Sage Satellite Agent:', error);
      throw error;
    }
  }

  async restart(): Promise<void> {
    try {
      await this.stop();
      await this.start();
    } catch (error) {
      logger.error('Failed to restart Sage Satellite Agent:', error);
      throw error;
    }
  }

  async handleMessage(message: Message): Promise<void> {
    try {
      this.status.metrics.messagesReceived++;
      const startTime = Date.now();

      logger.debug('Handling message', { messageId: message.id, type: message.type });

      switch (message.type) {
        case 'command':
          await this.handleCommand(message);
          break;
        case 'query':
          await this.handleQuery(message);
          break;
        case 'data':
          await this.handleData(message);
          break;
        default:
          logger.warn('Unknown message type', { type: message.type });
      }

      // Update metrics
      const responseTime = Date.now() - startTime;
      this.status.metrics.avgResponseTime = 
        (this.status.metrics.avgResponseTime + responseTime) / 2;
      this.status.metrics.tasksProcessed++;

      this.status.lastHeartbeat = new Date();
      this.status.uptime = Date.now() - this.startTime.getTime();

    } catch (error) {
      logger.error('Failed to handle message:', error);
      this.status.metrics.errors++;
      this.status.health = 'degraded';
    }
  }

  getStatus(): AgentStatus {
    return { ...this.status };
  }

  async updateConfig(config: Partial<AgentConfig>): Promise<void> {
    try {
      // Update configuration
      Object.assign(this.config, config);
      
      // Update Sage-specific config if provided
      if (config.config) {
        Object.assign(this.sageConfig, config.config);
      }

      logger.info('Sage Satellite Agent configuration updated');
    } catch (error) {
      logger.error('Failed to update configuration:', error);
      throw error;
    }
  }

  // Public API methods
  async analyzeProtocol(protocolData: ProtocolData): Promise<ProtocolAnalysis> {
    try {
      logger.info('Starting protocol analysis', { protocolId: protocolData.id });

      // Perform fundamental analysis
      const fundamentalAnalysis = await this.fundamentalAnalysisEngine.analyzeProtocol(protocolData);

      // Perform compliance assessment
      const complianceAssessment = await this.complianceFramework.assessCompliance(
        protocolData.id,
        'protocol',
        protocolData
      );

      // Perform market research using UnifiedAIClient
      const marketResearch = await this.researchProtocolWithAI(protocolData);

      // Combine results
      const enhancedAnalysis: ProtocolAnalysis = {
        ...fundamentalAnalysis,
        recommendations: [
          ...fundamentalAnalysis.recommendations,
          ...complianceAssessment.recommendations.map(rec => ({
            type: (rec.priority === 'critical' ? 'sell' : 
                  rec.priority === 'high' ? 'monitor' : 'hold') as 'sell' | 'monitor' | 'hold',
            confidence: complianceAssessment.overallScore,
            reasoning: rec.description,
            timeframe: 'short' as const,
            riskLevel: (rec.priority === 'critical' ? 'high' : 
                      rec.priority === 'high' ? 'medium' : 'low') as 'low' | 'medium' | 'high'
          }))
        ],
        confidence: (fundamentalAnalysis.confidence + complianceAssessment.overallScore + marketResearch.confidence) / 3
      };

      // Emit analysis completed event
      this.emit('protocol_analysis_completed', {
        protocolId: protocolData.id,
        analysis: enhancedAnalysis,
        timestamp: new Date()
      });

      logger.info('Protocol analysis completed', { 
        protocolId: protocolData.id,
        overallScore: enhancedAnalysis.overallScore 
      });

      return enhancedAnalysis;
    } catch (error) {
      logger.error('Protocol analysis failed', { 
        protocolId: protocolData.id, 
        error 
      });
      throw error;
    }
  }

  async scoreRWAOpportunity(rwaData: RWAData): Promise<RWAOpportunityScore> {
    try {
      logger.info('Starting RWA opportunity scoring', { rwaId: rwaData.id });

      // Perform RWA scoring
      const rwaScore = await this.rwaScoringSystem.scoreOpportunity(rwaData);

      // Perform compliance assessment
      const complianceAssessment = await this.complianceFramework.assessCompliance(
        rwaData.id,
        'rwa',
        rwaData
      );

      // Perform market research
      const marketResearch = await this.researchRWAWithAI(rwaData);

      // Enhance RWA score with compliance and market data
      const enhancedScore: RWAOpportunityScore = {
        ...rwaScore,
        complianceScore: complianceAssessment.overallScore,
        recommendations: [
          ...rwaScore.recommendations,
          ...complianceAssessment.recommendations.map(rec => ({
            action: (rec.priority === 'critical' ? 'avoid' : 
                    rec.priority === 'high' ? 'monitor' : 'hold') as 'avoid' | 'monitor' | 'hold',
            confidence: complianceAssessment.overallScore,
            reasoning: rec.description,
            timeframe: 'short' as const,
            riskLevel: (rec.priority === 'critical' ? 'high' : 
                      rec.priority === 'high' ? 'medium' : 'low') as 'low' | 'medium' | 'high',
            expectedReturn: rwaData.yield * (complianceAssessment.overallScore),
            maxExposure: 0 // No exposure if compliance issues
          }))
        ],
        confidence: (rwaScore.confidence + complianceAssessment.overallScore + marketResearch.confidence) / 3
      };

      // Emit scoring completed event
      this.emit('rwa_scoring_completed', {
        rwaId: rwaData.id,
        score: enhancedScore,
        timestamp: new Date()
      });

      logger.info('RWA opportunity scoring completed', { 
        rwaId: rwaData.id,
        overallScore: enhancedScore.overallScore 
      });

      return enhancedScore;
    } catch (error) {
      logger.error('RWA opportunity scoring failed', { 
        rwaId: rwaData.id, 
        error 
      });
      throw error;
    }
  }

  async researchMarket(topic: string, jurisdiction?: string): Promise<any> {
    try {
      logger.info('Starting market research', { topic, jurisdiction });

      const result = await this.unifiedAIClient.research({
        query: `Research the ${topic} market${jurisdiction ? ` in ${jurisdiction}` : ''}: 1) Current market size and growth trends, 2) Key players and competitive landscape, 3) Regulatory environment and compliance requirements, 4) Risk factors and market dynamics, 5) Future outlook and opportunities.`,
        domain: 'finance',
        recency: 'month'
      });

      // Emit research completed event
      this.emit('market_research_completed', {
        topic,
        jurisdiction,
        result,
        timestamp: new Date()
      });

      logger.info('Market research completed', { topic, jurisdiction });

      return result;
    } catch (error) {
      logger.error('Market research failed', { topic, jurisdiction, error });
      throw error;
    }
  }

  async researchRegulatory(jurisdiction: string, topic?: string): Promise<any> {
    try {
      logger.info('Starting regulatory research', { jurisdiction, topic });

      const result = await this.unifiedAIClient.research({
        query: `Research regulatory requirements in ${jurisdiction}${topic ? ` related to ${topic}` : ''}: 1) Current regulatory framework, 2) Recent regulatory changes and updates, 3) Compliance requirements and obligations, 4) Enforcement actions and penalties, 5) Best practices for regulatory compliance.`,
        domain: 'legal',
        recency: 'week'
      });

      // Emit research completed event
      this.emit('regulatory_research_completed', {
        jurisdiction,
        topic,
        result,
        timestamp: new Date()
      });

      logger.info('Regulatory research completed', { jurisdiction, topic });

      return result;
    } catch (error) {
      logger.error('Regulatory research failed', { jurisdiction, topic, error });
      throw error;
    }
  }

  async getComplianceReport(
    entityIds?: string[], 
    jurisdiction?: string, 
    timeRange?: { start: Date; end: Date }
  ): Promise<any> {
    try {
      logger.info('Generating compliance report', { entityIds, jurisdiction });

      const report = await this.complianceFramework.getComplianceReport(entityIds, jurisdiction, timeRange);

      logger.info('Compliance report generated', { 
        entityIds, 
        jurisdiction,
        summary: report.summary 
      });

      return report;
    } catch (error) {
      logger.error('Failed to generate compliance report:', error);
      throw error;
    }
  }

  async getSystemHealth(): Promise<any> {
    try {
      const health = {
        overall: 'healthy' as 'healthy' | 'degraded',
        components: {
          fundamentalAnalysis: this.fundamentalAnalysisEngine.getStatus(),
          rwaScoring: this.rwaScoringSystem.getStatus(),
          complianceMonitoring: this.complianceFramework.getStatus(),
          unifiedAIClient: this.unifiedAIClient.getHealthStatus()
        },
        metrics: {
          pendingAnalyses: this.pendingAnalyses.size,
          completedAnalyses: this.analysisResults.size,
          uptime: this.status.uptime,
          memoryUsage: this.status.metrics.memoryUsage,
          cpuUsage: this.status.metrics.cpuUsage
        }
      };

      // Determine overall health
      const componentStatuses = Object.values(health.components);
      if (componentStatuses.some(status => status.isRunning === false)) {
        health.overall = 'degraded';
      }

      return health;
    } catch (error) {
      logger.error('Failed to get system health:', error);
      throw error;
    }
  }

  // Private methods
  private async handleCommand(message: Message): Promise<void> {
    const payload = message.payload as any;
    const command = payload.command;
    const args = payload.args || {};

    try {
      switch (command) {
        case 'analyze_protocol':
          const protocolData = args.protocolData as ProtocolData;
          const analysis = await this.analyzeProtocol(protocolData);
          await this.sendResponse(message, { analysis });
          break;

        case 'score_rwa':
          const rwaData = args.rwaData as RWAData;
          const score = await this.scoreRWAOpportunity(rwaData);
          await this.sendResponse(message, { score });
          break;

        case 'research_market':
          const { topic, jurisdiction } = args;
          const marketResult = await this.researchMarket(topic, jurisdiction);
          await this.sendResponse(message, { result: marketResult });
          break;

        case 'research_regulatory':
          const { jurisdiction: regJurisdiction, topic: regTopic } = args;
          const regulatoryResult = await this.researchRegulatory(regJurisdiction, regTopic);
          await this.sendResponse(message, { result: regulatoryResult });
          break;

        case 'get_compliance_report':
          const report = await this.getComplianceReport(args.entityIds, args.jurisdiction, args.timeRange);
          await this.sendResponse(message, { report });
          break;

        case 'get_health':
          const health = await this.getSystemHealth();
          await this.sendResponse(message, { health });
          break;

        default:
          logger.warn('Unknown command', { command });
          await this.sendError(message, `Unknown command: ${command}`);
      }
    } catch (error) {
      logger.error('Command execution failed', { command, error });
      await this.sendError(message, error instanceof Error ? error.message : 'Unknown error');
    }
  }

  private async handleQuery(message: Message): Promise<void> {
    const payload = message.payload as any;
    const query = payload.query;
    const args = payload.args || {};

    try {
      switch (query) {
        case 'protocol_analysis':
          const protocolData = args.protocolData as ProtocolData;
          const analysis = await this.analyzeProtocol(protocolData);
          await this.sendResponse(message, { analysis });
          break;

        case 'rwa_scoring':
          const rwaData = args.rwaData as RWAData;
          const score = await this.scoreRWAOpportunity(rwaData);
          await this.sendResponse(message, { score });
          break;

        case 'system_status':
          const status = this.getStatus();
          await this.sendResponse(message, { status });
          break;

        default:
          logger.warn('Unknown query', { query });
          await this.sendError(message, `Unknown query: ${query}`);
      }
    } catch (error) {
      logger.error('Query execution failed', { query, error });
      await this.sendError(message, error instanceof Error ? error.message : 'Unknown error');
    }
  }

  private async handleData(message: Message): Promise<void> {
    const payload = message.payload as any;
    const dataType = payload.type;
    const data = payload.data;

    try {
      switch (dataType) {
        case 'protocol_data':
          // Store protocol data for analysis
          logger.debug('Received protocol data', { protocolId: data?.id });
          break;

        case 'rwa_data':
          // Store RWA data for scoring
          logger.debug('Received RWA data', { rwaId: data?.id });
          break;

        default:
          logger.warn('Unknown data type', { dataType });
      }
    } catch (error) {
      logger.error('Data handling failed', { dataType, error });
    }
  }

  private async sendResponse(originalMessage: Message, payload: any): Promise<void> {
    const response: Message = {
      id: `response-${Date.now()}`,
      type: 'response',
      from: this.id,
      to: originalMessage.from,
      timestamp: new Date(),
      payload,
      ...(originalMessage.correlationId && { correlationId: originalMessage.correlationId }),
      priority: originalMessage.priority
    };

    this.status.metrics.messagesSent++;
    this.emit('message', response);
  }

  private async sendError(originalMessage: Message, error: string): Promise<void> {
    const errorMessage: Message = {
      id: `error-${Date.now()}`,
      type: 'error',
      from: this.id,
      to: originalMessage.from,
      timestamp: new Date(),
      payload: { error },
      ...(originalMessage.correlationId && { correlationId: originalMessage.correlationId }),
      priority: originalMessage.priority
    };

    this.status.metrics.messagesSent++;
    this.emit('message', errorMessage);
  }

  private async researchProtocolWithAI(protocolData: ProtocolData): Promise<any> {
    try {
      const queries = [
        // Protocol fundamentals query
        {
          query: `Analyze the fundamentals of ${protocolData.name} (${protocolData.category} protocol). Focus on: 1) Recent performance and TVL trends, 2) Revenue generation and sustainability, 3) Security audits and vulnerabilities, 4) Team background and credibility, 5) Competitive positioning. Provide specific data and insights.`,
          domain: 'crypto',
          recency: 'week' as const
        },
        // Security analysis query
        {
          query: `Research security aspects of ${protocolData.name}: 1) Recent security audits and their findings, 2) Known vulnerabilities or exploits, 3) Insurance coverage and risk management, 4) Bug bounty programs, 5) Security best practices implementation.`,
          domain: 'security',
          recency: 'month' as const
        },
        // Market analysis query
        {
          query: `Analyze the market position of ${protocolData.name} in the ${protocolData.category} sector: 1) Market share and competitive landscape, 2) User growth and adoption trends, 3) Regulatory considerations, 4) Future outlook and roadmap, 5) Investment thesis.`,
          domain: 'finance',
          recency: 'week' as const
        }
      ];

      const results = await Promise.all(
        queries.map(q => this.unifiedAIClient.research(q))
      );

      // Combine and format results
      const combinedResult = {
        summary: results.map(r => r.data?.answer || '').join('\n\n'),
        keyFindings: results.flatMap(r => {
          const answer = r.data?.answer || '';
          return answer.split(/[.!?]+/)
            .filter(s => s.trim().length > 20)
            .slice(0, 3);
        }),
        sources: results.flatMap(r => r.data?.sources || []),
        confidence: results.every(r => r.success) ? 0.8 : 0.6,
        recommendations: this.generateProtocolRecommendations(protocolData, results),
        metadata: {
          protocolId: protocolData.id,
          timestamp: new Date(),
          provider: results[0]?.metadata?.provider || 'unknown'
        }
      };

      return combinedResult;
    } catch (error) {
      logger.error('Protocol research failed', { protocolId: protocolData.id, error });
      throw error;
    }
  }

  private async researchRWAWithAI(rwaData: RWAData): Promise<any> {
    try {
      const queries = [
        // RWA fundamentals query
        {
          query: `Research the fundamentals of ${rwaData.type} real-world assets: 1) Market size and growth trends, 2) Risk factors and volatility, 3) Regulatory environment, 4) Liquidity characteristics, 5) Yield expectations and sustainability.`,
          domain: 'finance',
          recency: 'month' as const
        },
        // Issuer research query
        {
          query: `Research the issuer ${rwaData.issuer}: 1) Company background and financial health, 2) Credit rating and risk profile, 3) Regulatory compliance history, 4) Market reputation and track record, 5) Recent news and developments.`,
          domain: 'business',
          recency: 'week' as const
        },
        // Regulatory compliance query
        {
          query: `Research regulatory requirements for ${rwaData.type} assets in ${rwaData.regulatoryStatus.jurisdiction}: 1) Licensing requirements, 2) Compliance obligations, 3) Recent regulatory changes, 4) Enforcement actions, 5) Best practices for compliance.`,
          domain: 'legal',
          recency: 'week' as const
        }
      ];

      const results = await Promise.all(
        queries.map(q => this.unifiedAIClient.research(q))
      );

      // Combine and format results
      const combinedResult = {
        summary: results.map(r => r.data?.answer || '').join('\n\n'),
        keyFindings: results.flatMap(r => {
          const answer = r.data?.answer || '';
          return answer.split(/[.!?]+/)
            .filter(s => s.trim().length > 20)
            .slice(0, 3);
        }),
        sources: results.flatMap(r => r.data?.sources || []),
        confidence: results.every(r => r.success) ? 0.8 : 0.6,
        recommendations: this.generateRWARecommendations(rwaData, results),
        metadata: {
          rwaId: rwaData.id,
          timestamp: new Date(),
          provider: results[0]?.metadata?.provider || 'unknown'
        }
      };

      return combinedResult;
    } catch (error) {
      logger.error('RWA research failed', { rwaId: rwaData.id, error });
      throw error;
    }
  }

  private generateProtocolRecommendations(_protocolData: ProtocolData, results: any[]): string[] {
    const recommendations: string[] = [];
    
    // Generate recommendations based on research results
    const combinedContent = results.map(r => r.data?.answer || '').join(' ').toLowerCase();
    
    if (combinedContent.includes('security')) {
      recommendations.push('Conduct additional security audits');
    }
    if (combinedContent.includes('regulatory')) {
      recommendations.push('Review regulatory compliance status');
    }
    if (combinedContent.includes('growth')) {
      recommendations.push('Monitor market growth trends');
    }
    if (combinedContent.includes('competition')) {
      recommendations.push('Analyze competitive landscape');
    }
    
    return recommendations;
  }

  private generateRWARecommendations(_rwaData: RWAData, results: any[]): string[] {
    const recommendations: string[] = [];
    
    // Generate recommendations based on research results
    const combinedContent = results.map(r => r.data?.answer || '').join(' ').toLowerCase();
    
    if (combinedContent.includes('regulatory')) {
      recommendations.push('Ensure full regulatory compliance');
    }
    if (combinedContent.includes('liquidity')) {
      recommendations.push('Monitor liquidity conditions');
    }
    if (combinedContent.includes('risk')) {
      recommendations.push('Implement risk management strategies');
    }
    if (combinedContent.includes('yield')) {
      recommendations.push('Optimize yield generation');
    }
    
    return recommendations;
  }

  private setupEventHandlers(): void {
    // Forward events from components
    this.fundamentalAnalysisEngine.on('analysis_completed', (event) => {
      this.emit('fundamental_analysis_completed', event);
    });

    this.rwaScoringSystem.on('scoring_completed', (event) => {
      this.emit('rwa_scoring_completed', event);
    });

    this.complianceFramework.on('assessment_completed', (event) => {
      this.emit('compliance_assessment_completed', event);
    });

    this.complianceFramework.on('regulatory_change_detected', (event) => {
      this.emit('regulatory_change_detected', event);
    });

    // Forward events from UnifiedAIClient
    this.unifiedAIClient.on('research_success', (event) => {
      this.emit('ai_research_completed', {
        ...event,
        timestamp: new Date()
      });
    });

    this.unifiedAIClient.on('fallback_success', (event) => {
      logger.warn('AI provider fallback occurred', event);
      this.emit('ai_provider_fallback', event);
    });

    this.unifiedAIClient.on('health_check_complete', (status) => {
      this.emit('ai_health_status_changed', status);
    });
  }

  private startRealTimeAnalysis(): void {
    this.analysisInterval = setInterval(async () => {
      try {
        logger.debug('Running real-time analysis cycle...');
        // This would trigger analysis for monitored entities
        logger.debug('Real-time analysis cycle completed');
      } catch (error) {
        logger.error('Real-time analysis cycle failed:', error);
      }
    }, this.sageConfig.analysisInterval);
  }

  async shutdown(): Promise<void> {
    try {
      logger.info('Shutting down Sage Satellite Agent...');

      // Stop the agent
      await this.stop();

      // Shutdown components
      await this.fundamentalAnalysisEngine.shutdown();
      await this.rwaScoringSystem.shutdown();
      await this.complianceFramework.shutdown();
      // UnifiedAIClient doesn't need explicit shutdown, it's a singleton

      logger.info('Sage Satellite Agent shutdown complete');
    } catch (error) {
      logger.error('Failed to shutdown Sage Satellite Agent:', error);
      throw error;
    }
  }
} 