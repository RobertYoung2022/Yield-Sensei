/**
 * Perplexity API Client
 * Enhanced research and data verification using Perplexity AI
 */

import { EventEmitter } from 'events';
import { Logger } from 'winston';
import { createLogger, format, transports } from 'winston';
import {
  PerplexityQuery,
  PerplexityResponse,
  PerplexitySource,
  TokenUsage,
  RWAProtocol
} from '../types';

export interface PerplexityClientConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
  timeout: number;
  maxRetries: number;
  enableCaching: boolean;
  cacheTtl: number;
  dailyQuotaLimit: number;
  enableRateLimiting: boolean;
  requestsPerMinute: number;
  enableUsageTracking: boolean;
}

export class PerplexityClient extends EventEmitter {
  private static instance: PerplexityClient;
  private logger: Logger;
  private config: PerplexityClientConfig;
  private isInitialized: boolean = false;

  // Usage tracking
  private dailyUsage: TokenUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0, cost: 0 };
  private usageResetTime: Date = new Date();

  // Caching
  private queryCache: Map<string, CachedResponse> = new Map();

  // Rate limiting
  private requestTimes: number[] = [];

  // Request metrics
  private requestMetrics: RequestMetrics = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    cachedRequests: 0,
    averageLatency: 0,
    lastRequest: new Date()
  };

  private constructor(config: PerplexityClientConfig) {
    super();
    this.config = config;
    this.logger = createLogger({
      level: 'info',
      format: format.combine(format.timestamp(), format.simple()),
      transports: [
        new transports.Console(),
        new transports.File({ filename: 'logs/perplexity-client.log' })
      ],
    });

    this.resetDailyUsageIfNeeded();
  }

  static getInstance(config?: PerplexityClientConfig): PerplexityClient {
    if (!PerplexityClient.instance && config) {
      PerplexityClient.instance = new PerplexityClient(config);
    } else if (!PerplexityClient.instance) {
      throw new Error('PerplexityClient must be initialized with config first');
    }
    return PerplexityClient.instance;
  }

  async initialize(): Promise<void> {
    try {
      this.logger.info('Initializing Perplexity Client...');

      // Test API connection
      await this.testConnection();

      // Setup cleanup intervals
      this.setupCleanupIntervals();

      this.isInitialized = true;
      this.logger.info('Perplexity Client initialized successfully');

    } catch (error) {
      this.logger.error('Failed to initialize Perplexity Client:', error);
      throw error;
    }
  }

  async query(query: PerplexityQuery): Promise<PerplexityResponse> {
    try {
      if (!this.isInitialized) {
        throw new Error('Perplexity Client not initialized');
      }

      const startTime = Date.now();

      this.logger.info('Executing Perplexity query', { 
        queryId: query.id,
        model: query.model,
        temperature: query.temperature 
      });

      // Check daily quota
      this.checkDailyQuota();

      // Check rate limits
      if (this.config.enableRateLimiting) {
        await this.checkRateLimit();
      }

      // Check cache
      if (this.config.enableCaching) {
        const cachedResponse = this.getCachedResponse(query);
        if (cachedResponse) {
          this.updateMetrics(Date.now() - startTime, true, false);
          return cachedResponse;
        }
      }

      // Execute query
      const response = await this.executeQuery(query);

      // Cache response
      if (this.config.enableCaching) {
        this.cacheResponse(query, response);
      }

      // Update usage tracking
      if (this.config.enableUsageTracking) {
        this.updateUsageTracking(response.usage);
      }

      // Update metrics
      this.updateMetrics(Date.now() - startTime, false, false);

      this.emit('query_completed', {
        queryId: query.id,
        response,
        timestamp: new Date()
      });

      return response;

    } catch (error) {
      const duration = Date.now() - Date.now();
      this.updateMetrics(duration, false, true);
      
      this.logger.error('Perplexity query failed:', error, { queryId: query.id });
      throw error;
    }
  }

  // Specialized RWA Research Methods
  async researchRWAProtocol(protocol: RWAProtocol): Promise<RWAResearchResult> {
    try {
      this.logger.info('Researching RWA protocol', { 
        protocolId: protocol.id, 
        name: protocol.name 
      });

      // Parallel research queries for comprehensive analysis
      const researchPromises = [
        this.researchAssetBacking(protocol),
        this.researchTeamBackground(protocol),
        this.researchRegulatoryCompliance(protocol),
        this.researchFinancialHealth(protocol),
        this.researchMarketPresence(protocol)
      ];

      const [
        assetResearch,
        teamResearch,
        regulatoryResearch,
        financialResearch,
        marketResearch
      ] = await Promise.allSettled(researchPromises);

      // Compile comprehensive research result
      const result: RWAResearchResult = {
        protocolId: protocol.id,
        assetBacking: this.extractResearchResult(assetResearch),
        teamBackground: this.extractResearchResult(teamResearch),
        regulatoryCompliance: this.extractResearchResult(regulatoryResearch),
        financialHealth: this.extractResearchResult(financialResearch),
        marketPresence: this.extractResearchResult(marketResearch),
        overallConfidence: 0,
        keyFindings: [],
        redFlags: [],
        verificationSources: [],
        timestamp: new Date()
      };

      // Calculate overall confidence and extract insights
      result.overallConfidence = this.calculateOverallConfidence(result);
      result.keyFindings = this.extractKeyFindings(result);
      result.redFlags = this.extractRedFlags(result);
      result.verificationSources = this.extractVerificationSources(result);

      this.logger.info('RWA protocol research completed', {
        protocolId: protocol.id,
        confidence: result.overallConfidence,
        findings: result.keyFindings.length,
        redFlags: result.redFlags.length
      });

      return result;

    } catch (error) {
      this.logger.error('RWA protocol research failed:', error, { protocolId: protocol.id });
      throw error;
    }
  }

  async researchAssetBacking(protocol: RWAProtocol): Promise<PerplexityResponse> {
    const query: PerplexityQuery = {
      id: `asset_backing_${protocol.id}_${Date.now()}`,
      query: this.buildAssetBackingQuery(protocol),
      context: `Asset backing verification for ${protocol.name}`,
      model: this.config.model,
      temperature: 0.1, // Low temperature for factual research
      maxTokens: 2000,
      timestamp: new Date()
    };

    return await this.query(query);
  }

  async researchTeamBackground(protocol: RWAProtocol): Promise<PerplexityResponse> {
    const query: PerplexityQuery = {
      id: `team_background_${protocol.id}_${Date.now()}`,
      query: this.buildTeamBackgroundQuery(protocol),
      context: `Team background verification for ${protocol.name}`,
      model: this.config.model,
      temperature: 0.1,
      maxTokens: 2000,
      timestamp: new Date()
    };

    return await this.query(query);
  }

  async researchRegulatoryCompliance(protocol: RWAProtocol): Promise<PerplexityResponse> {
    const query: PerplexityQuery = {
      id: `regulatory_compliance_${protocol.id}_${Date.now()}`,
      query: this.buildRegulatoryComplianceQuery(protocol),
      context: `Regulatory compliance research for ${protocol.name}`,
      model: this.config.model,
      temperature: 0.1,
      maxTokens: 2000,
      timestamp: new Date()
    };

    return await this.query(query);
  }

  async researchFinancialHealth(protocol: RWAProtocol): Promise<PerplexityResponse> {
    const query: PerplexityQuery = {
      id: `financial_health_${protocol.id}_${Date.now()}`,
      query: this.buildFinancialHealthQuery(protocol),
      context: `Financial health research for ${protocol.name}`,
      model: this.config.model,
      temperature: 0.1,
      maxTokens: 2000,
      timestamp: new Date()
    };

    return await this.query(query);
  }

  async researchMarketPresence(protocol: RWAProtocol): Promise<PerplexityResponse> {
    const query: PerplexityQuery = {
      id: `market_presence_${protocol.id}_${Date.now()}`,
      query: this.buildMarketPresenceQuery(protocol),
      context: `Market presence research for ${protocol.name}`,
      model: this.config.model,
      temperature: 0.2, // Slightly higher temperature for market sentiment
      maxTokens: 1500,
      timestamp: new Date()
    };

    return await this.query(query);
  }

  // Query builders
  private buildAssetBackingQuery(protocol: RWAProtocol): string {
    const assetDetails = protocol.assetClaims.map(claim => 
      `${claim.description}: $${claim.value.toLocaleString()} ${claim.currency}`
    ).join(', ');

    return `Research the asset backing and custody arrangements for ${protocol.name}, a ${protocol.assetType} RWA protocol. 
            
            Specific asset claims to verify: ${assetDetails}
            Asset issuer: ${protocol.assetIssuer}
            
            Please investigate:
            1. SEC filings or regulatory documents showing these specific assets
            2. Third-party custody arrangements and attestations
            3. Independent audits or appraisals of the claimed assets
            4. Any discrepancies between claimed and verified asset values
            5. Historical track record of asset backing claims
            
            Focus on finding concrete evidence from official sources like SEC EDGAR, custodian reports, 
            audit firms, and regulatory filings. Flag any potential red flags or inconsistencies.`;
  }

  private buildTeamBackgroundQuery(protocol: RWAProtocol): string {
    const teamMembers = protocol.team.members.map(member => 
      `${member.name} (${member.role})`
    ).join(', ');

    return `Research the background and credibility of the team behind ${protocol.name} RWA protocol.
            
            Key team members: ${teamMembers}
            Organization: ${protocol.team.organization}
            Headquarters: ${protocol.team.headquarters}
            
            Please investigate:
            1. Professional backgrounds and previous experience of key team members
            2. Track record in traditional finance, real estate, or relevant industries  
            3. Educational credentials and professional certifications
            4. Previous projects or companies founded/managed
            5. Any regulatory issues, legal problems, or negative publicity
            6. LinkedIn profiles, published works, speaking engagements
            7. Industry reputation and references
            
            Focus on verifying credentials through official sources and identifying any red flags 
            in their professional history.`;
  }

  private buildRegulatoryComplianceQuery(protocol: RWAProtocol): string {
    const jurisdictions = protocol.regulatory.jurisdiction.join(', ');
    const licenses = protocol.regulatory.licenses.map(license => 
      `${license.type} (${license.number})`
    ).join(', ');

    return `Research the regulatory compliance status of ${protocol.name} RWA protocol.
            
            Operating jurisdictions: ${jurisdictions}
            Claimed licenses: ${licenses}
            Asset type: ${protocol.assetType}
            
            Please investigate:
            1. Required licenses and registrations for ${protocol.assetType} assets in ${jurisdictions}
            2. Verification of claimed licenses through regulatory databases
            3. Required filings with SEC, FINRA, or other relevant regulators
            4. Compliance with securities laws and regulations
            5. Any enforcement actions, fines, or regulatory violations
            6. Required disclosures and investor protections
            7. Anti-money laundering (AML) and know-your-customer (KYC) compliance
            
            Check official regulatory websites and databases to verify all claims.`;
  }

  private buildFinancialHealthQuery(protocol: RWAProtocol): string {
    const totalTvl = protocol.totalValueLocked.toLocaleString();

    return `Research the financial health and sustainability of ${protocol.name} RWA protocol.
            
            Total Value Locked: $${totalTvl}
            Asset type: ${protocol.assetType}
            
            Please investigate:
            1. Audited financial statements and accounting practices
            2. Revenue sources and business model sustainability  
            3. Debt levels, liquidity, and capital structure
            4. Historical financial performance and growth trends
            5. Independent auditor opinions and any accounting issues
            6. Cash flow patterns and working capital management
            7. Risk management practices and stress testing
            8. Comparison to industry benchmarks and competitors
            
            Look for official financial filings, audit reports, and third-party analysis 
            from credit rating agencies or financial institutions.`;
  }

  private buildMarketPresenceQuery(protocol: RWAProtocol): string {
    return `Research the market presence and reputation of ${protocol.name} RWA protocol.
            
            Protocol type: ${protocol.assetType}
            
            Please investigate:
            1. Media coverage and press releases about the protocol
            2. Industry reports and analyst coverage
            3. User reviews and community sentiment
            4. Partnerships with established financial institutions
            5. Market share and competitive positioning
            6. Technology partnerships and integrations
            7. Awards, recognition, or industry endorsements
            8. Social media presence and engagement
            
            Focus on recent news, industry publications, and credible financial media sources.`;
  }

  // Private methods
  private async testConnection(): Promise<void> {
    const testQuery: PerplexityQuery = {
      id: `test_${Date.now()}`,
      query: 'What is the current date?',
      context: 'Connection test',
      model: this.config.model,
      temperature: 0.1,
      maxTokens: 50,
      timestamp: new Date()
    };

    await this.executeQuery(testQuery);
    this.logger.info('Perplexity API connection test successful');
  }

  private async executeQuery(query: PerplexityQuery): Promise<PerplexityResponse> {
    // Mock implementation - would make actual API call to Perplexity
    this.logger.debug('Executing Perplexity query', { queryId: query.id });

    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, Math.random() * 1000 + 500));

    // Generate mock response based on query content
    const mockResponse: PerplexityResponse = {
      id: query.id,
      content: this.generateMockContent(query),
      sources: this.generateMockSources(query),
      confidence: 0.85 + Math.random() * 0.1, // 85-95% confidence
      processingTime: Math.random() * 1000 + 500,
      usage: {
        promptTokens: Math.floor(query.query.length / 4),
        completionTokens: Math.floor(Math.random() * 500 + 200),
        totalTokens: 0,
        cost: 0
      },
      timestamp: new Date()
    };

    mockResponse.usage.totalTokens = mockResponse.usage.promptTokens + mockResponse.usage.completionTokens;
    mockResponse.usage.cost = mockResponse.usage.totalTokens * 0.001; // $0.001 per token

    return mockResponse;
  }

  private generateMockContent(query: PerplexityQuery): string {
    if (query.query.includes('asset backing')) {
      return `Based on research into the asset backing claims, I found the following:

1. SEC Filings: The protocol has filed Form D with the SEC indicating a private placement offering. However, specific asset details are limited in public filings.

2. Custody Arrangements: The assets appear to be held by a qualified custodian, with monthly attestation reports mentioned in their documentation.

3. Third-party Audits: An independent audit was conducted by [Audit Firm], confirming the existence of approximately 95% of claimed assets.

4. Valuation Methodology: Assets are valued using a combination of market prices and independent appraisals, updated quarterly.

Key concerns: Some asset claims lack recent independent verification, and there's a 5% discrepancy between claimed and verified asset values.`;
    }

    if (query.query.includes('team background')) {
      return `Research into the team background reveals:

1. Leadership Team: The CEO has 15+ years experience in traditional finance, previously serving as VP at a major investment bank.

2. CTO Background: Strong technical background with previous blockchain and fintech experience at established companies.

3. Advisory Board: Includes former regulators and industry veterans with relevant expertise.

4. Track Record: Team members have successfully launched 2 previous financial products, both operating successfully for 3+ years.

5. Credentials: All key team members have verified LinkedIn profiles with consistent career histories.

No significant red flags found in background checks, though the team is relatively new to the RWA space specifically.`;
    }

    return `Mock research findings for the query: "${query.query.substring(0, 100)}..."

This would contain detailed analysis based on the specific research request, including verified facts, sources, and any identified concerns or red flags.`;
  }

  private generateMockSources(query: PerplexityQuery): PerplexitySource[] {
    const sources: PerplexitySource[] = [];

    if (query.query.includes('SEC') || query.query.includes('regulatory')) {
      sources.push({
        title: 'SEC EDGAR Database - Form D Filing',
        url: 'https://www.sec.gov/edgar/browse/?CIK=1234567',
        domain: 'sec.gov',
        relevance: 0.95,
        reliability: 0.98
      });
    }

    if (query.query.includes('audit')) {
      sources.push({
        title: 'Independent Audit Report - Asset Verification',
        url: 'https://auditfirm.com/reports/asset-verification-2024',
        domain: 'auditfirm.com',
        relevance: 0.92,
        reliability: 0.90
      });
    }

    if (query.query.includes('team') || query.query.includes('background')) {
      sources.push({
        title: 'LinkedIn Professional Profile',
        url: 'https://linkedin.com/in/ceo-profile',
        domain: 'linkedin.com',
        relevance: 0.88,
        reliability: 0.85
      });
    }

    // Add default financial news source
    sources.push({
      title: 'Financial Times - RWA Market Analysis',
      url: 'https://ft.com/content/rwa-market-analysis',
      domain: 'ft.com',
      relevance: 0.80,
      reliability: 0.92
    });

    return sources;
  }

  private getCachedResponse(query: PerplexityQuery): PerplexityResponse | null {
    const cacheKey = this.generateCacheKey(query);
    const cached = this.queryCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < this.config.cacheTtl) {
      this.logger.debug('Cache hit for Perplexity query', { queryId: query.id });
      return cached.response;
    }

    if (cached) {
      this.queryCache.delete(cacheKey);
    }

    return null;
  }

  private cacheResponse(query: PerplexityQuery, response: PerplexityResponse): void {
    const cacheKey = this.generateCacheKey(query);
    
    this.queryCache.set(cacheKey, {
      response,
      timestamp: Date.now()
    });

    this.logger.debug('Cached Perplexity response', { queryId: query.id });
  }

  private generateCacheKey(query: PerplexityQuery): string {
    const queryHash = Buffer.from(query.query).toString('base64');
    return `${query.model}_${query.temperature}_${queryHash}`;
  }

  private checkDailyQuota(): void {
    this.resetDailyUsageIfNeeded();

    if (this.dailyUsage.totalTokens >= this.config.dailyQuotaLimit) {
      throw new Error(`Daily quota limit exceeded: ${this.dailyUsage.totalTokens}/${this.config.dailyQuotaLimit} tokens`);
    }
  }

  private async checkRateLimit(): Promise<void> {
    const now = Date.now();
    const minute = 60000;

    // Remove requests older than 1 minute
    this.requestTimes = this.requestTimes.filter(time => now - time < minute);

    if (this.requestTimes.length >= this.config.requestsPerMinute) {
      const waitTime = minute - (now - this.requestTimes[0]);
      this.logger.warn('Rate limit reached, waiting', { waitTime });
      await new Promise(resolve => setTimeout(resolve, waitTime));
      return this.checkRateLimit(); // Recursive check after waiting
    }

    this.requestTimes.push(now);
  }

  private updateUsageTracking(usage: TokenUsage): void {
    this.dailyUsage.promptTokens += usage.promptTokens;
    this.dailyUsage.completionTokens += usage.completionTokens;
    this.dailyUsage.totalTokens += usage.totalTokens;
    this.dailyUsage.cost += usage.cost;

    this.logger.debug('Updated usage tracking', {
      dailyTokens: this.dailyUsage.totalTokens,
      dailyCost: this.dailyUsage.cost
    });
  }

  private updateMetrics(duration: number, cached: boolean, error: boolean): void {
    this.requestMetrics.totalRequests++;
    if (!error) this.requestMetrics.successfulRequests++;
    if (error) this.requestMetrics.failedRequests++;
    if (cached) this.requestMetrics.cachedRequests++;

    // Update average latency with exponential moving average
    const alpha = 0.1;
    this.requestMetrics.averageLatency = 
      this.requestMetrics.averageLatency * (1 - alpha) + duration * alpha;

    this.requestMetrics.lastRequest = new Date();
  }

  private resetDailyUsageIfNeeded(): void {
    const now = new Date();
    if (now.toDateString() !== this.usageResetTime.toDateString()) {
      this.dailyUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0, cost: 0 };
      this.usageResetTime = now;
      this.logger.info('Daily usage reset');
    }
  }

  private setupCleanupIntervals(): void {
    // Cache cleanup every hour
    setInterval(() => {
      const now = Date.now();
      let removedCount = 0;

      for (const [key, cached] of this.queryCache) {
        if (now - cached.timestamp > this.config.cacheTtl) {
          this.queryCache.delete(key);
          removedCount++;
        }
      }

      this.logger.debug('Cache cleanup completed', { 
        removedEntries: removedCount,
        remainingEntries: this.queryCache.size 
      });
    }, 3600000);

    // Metrics reporting every 5 minutes
    setInterval(() => {
      this.logger.info('Perplexity Client metrics', {
        totalRequests: this.requestMetrics.totalRequests,
        successRate: this.requestMetrics.successfulRequests / Math.max(this.requestMetrics.totalRequests, 1),
        cacheHitRate: this.requestMetrics.cachedRequests / Math.max(this.requestMetrics.totalRequests, 1),
        averageLatency: this.requestMetrics.averageLatency,
        dailyUsage: this.dailyUsage
      });
    }, 300000);
  }

  // Research result processing
  private extractResearchResult(promiseResult: PromiseSettledResult<PerplexityResponse>): ResearchSection {
    if (promiseResult.status === 'fulfilled') {
      return {
        content: promiseResult.value.content,
        confidence: promiseResult.value.confidence,
        sources: promiseResult.value.sources,
        findings: this.extractFindings(promiseResult.value.content),
        redFlags: this.extractRedFlagsFromContent(promiseResult.value.content)
      };
    } else {
      return {
        content: 'Research failed',
        confidence: 0,
        sources: [],
        findings: [],
        redFlags: ['Research query failed']
      };
    }
  }

  private calculateOverallConfidence(result: RWAResearchResult): number {
    const sections = [
      result.assetBacking,
      result.teamBackground,
      result.regulatoryCompliance,
      result.financialHealth,
      result.marketPresence
    ];

    const totalConfidence = sections.reduce((sum, section) => sum + section.confidence, 0);
    return totalConfidence / sections.length;
  }

  private extractKeyFindings(result: RWAResearchResult): string[] {
    const allFindings = [
      ...result.assetBacking.findings,
      ...result.teamBackground.findings,
      ...result.regulatoryCompliance.findings,
      ...result.financialHealth.findings,
      ...result.marketPresence.findings
    ];

    // Return top 10 most significant findings
    return allFindings.slice(0, 10);
  }

  private extractRedFlags(result: RWAResearchResult): string[] {
    return [
      ...result.assetBacking.redFlags,
      ...result.teamBackground.redFlags,
      ...result.regulatoryCompliance.redFlags,
      ...result.financialHealth.redFlags,
      ...result.marketPresence.redFlags
    ];
  }

  private extractVerificationSources(result: RWAResearchResult): PerplexitySource[] {
    return [
      ...result.assetBacking.sources,
      ...result.teamBackground.sources,
      ...result.regulatoryCompliance.sources,
      ...result.financialHealth.sources,
      ...result.marketPresence.sources
    ];
  }

  private extractFindings(content: string): string[] {
    const findings: string[] = [];
    
    // Extract numbered points
    const numberedMatches = content.match(/\d+\.\s+([^\n]+)/g);
    if (numberedMatches) {
      findings.push(...numberedMatches);
    }

    // Extract bullet points
    const bulletMatches = content.match(/[•\-\*]\s+([^\n]+)/g);
    if (bulletMatches) {
      findings.push(...bulletMatches);
    }

    return findings.slice(0, 5); // Return top 5 findings
  }

  private extractRedFlagsFromContent(content: string): string[] {
    const redFlags: string[] = [];
    
    // Look for red flag indicators
    const redFlagIndicators = [
      'concern', 'discrepancy', 'missing', 'unclear', 'unverified',
      'red flag', 'warning', 'issue', 'problem', 'risk'
    ];

    for (const indicator of redFlagIndicators) {
      const regex = new RegExp(`[^.]*${indicator}[^.]*\\.`, 'gi');
      const matches = content.match(regex);
      if (matches) {
        redFlags.push(...matches);
      }
    }

    return redFlags.slice(0, 3); // Return top 3 red flags
  }

  // Public interface
  getUsageMetrics(): any {
    return {
      dailyUsage: this.dailyUsage,
      requestMetrics: this.requestMetrics,
      quotaRemaining: this.config.dailyQuotaLimit - this.dailyUsage.totalTokens,
      cacheSize: this.queryCache.size
    };
  }

  getStatus(): any {
    return {
      isInitialized: this.isInitialized,
      isRunning: true,
      dailyQuotaUsed: this.dailyUsage.totalTokens,
      dailyQuotaRemaining: this.config.dailyQuotaLimit - this.dailyUsage.totalTokens,
      cacheSize: this.queryCache.size,
      requestMetrics: this.requestMetrics
    };
  }

  async shutdown(): Promise<void> {
    this.logger.info('Shutting down Perplexity Client...');
    this.queryCache.clear();
    this.removeAllListeners();
  }
}

// Supporting interfaces
interface CachedResponse {
  response: PerplexityResponse;
  timestamp: number;
}

interface RequestMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  cachedRequests: number;
  averageLatency: number;
  lastRequest: Date;
}

interface RWAResearchResult {
  protocolId: string;
  assetBacking: ResearchSection;
  teamBackground: ResearchSection;
  regulatoryCompliance: ResearchSection;
  financialHealth: ResearchSection;
  marketPresence: ResearchSection;
  overallConfidence: number;
  keyFindings: string[];
  redFlags: string[];
  verificationSources: PerplexitySource[];
  timestamp: Date;
}

interface ResearchSection {
  content: string;
  confidence: number;
  sources: PerplexitySource[];
  findings: string[];
  redFlags: string[];
}