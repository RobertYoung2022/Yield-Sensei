/**
 * Community Engagement Manager
 * Manages automated responses, engagement tracking, and community growth analytics
 */

import { EventEmitter } from 'events';
import { Logger } from 'winston';
import { createLogger, format, transports } from 'winston';
import { 
  SentimentData, 
  SocialPlatform, 
  EngagementMetrics, 
  CommunityGrowthMetrics,
  EngagementResponse,
  EngagementRule,
  CommunityMember,
  EngagementAnalytics
} from '../types';
import { getUnifiedAIClient } from '../../../integrations/ai/unified-ai-client';

export interface CommunityEngagementConfig {
  enableAutomatedResponses: boolean;
  enableEngagementTracking: boolean;
  enableCommunityGrowthMetrics: boolean;
  enableDeFAIProjectTracking: boolean;
  responseGenerationProvider: string;
  maxResponsesPerHour: number;
  minEngagementThreshold: number;
  trackingInterval: number; // milliseconds
  growthAnalysisInterval: number; // milliseconds
  autoResponseTriggers: {
    sentimentThreshold: number;
    influenceThreshold: number;
    engagementThreshold: number;
  };
  platforms: SocialPlatform[];
  communityDetectionRules: {
    minFollowers: number;
    minEngagementRate: number;
    cryptoKeywordThreshold: number;
  };
}

export const DEFAULT_COMMUNITY_ENGAGEMENT_CONFIG: CommunityEngagementConfig = {
  enableAutomatedResponses: true,
  enableEngagementTracking: true,
  enableCommunityGrowthMetrics: true,
  enableDeFAIProjectTracking: true,
  responseGenerationProvider: 'anthropic',
  maxResponsesPerHour: 10,
  minEngagementThreshold: 0.3,
  trackingInterval: 300000, // 5 minutes
  growthAnalysisInterval: 3600000, // 1 hour
  autoResponseTriggers: {
    sentimentThreshold: 0.7,
    influenceThreshold: 0.5,
    engagementThreshold: 100
  },
  platforms: [
    SocialPlatform.TWITTER,
    SocialPlatform.DISCORD,
    SocialPlatform.TELEGRAM,
    SocialPlatform.REDDIT
  ],
  communityDetectionRules: {
    minFollowers: 1000,
    minEngagementRate: 0.02,
    cryptoKeywordThreshold: 3
  }
};

export class CommunityEngagementManager extends EventEmitter {
  private static instance: CommunityEngagementManager;
  private logger: Logger;
  private config: CommunityEngagementConfig;
  private aiClient = getUnifiedAIClient();
  private isInitialized: boolean = false;
  private isRunning: boolean = false;

  // Tracking and analytics
  private engagementTracker: Map<string, EngagementMetrics> = new Map();
  private communityMembers: Map<string, CommunityMember> = new Map();
  private growthMetrics: CommunityGrowthMetrics[] = [];
  private engagementRules: EngagementRule[] = [];
  
  // Response management
  private responseQueue: EngagementResponse[] = [];
  private responseHistory: Map<string, EngagementResponse[]> = new Map();
  private responsesThisHour: number = 0;
  private lastResponseReset: Date = new Date();

  // Intervals
  private trackingInterval?: NodeJS.Timeout;
  private growthAnalysisInterval?: NodeJS.Timeout;
  private responseProcessingInterval?: NodeJS.Timeout;

  private constructor(config: CommunityEngagementConfig) {
    super();
    this.config = config;
    this.logger = createLogger({
      level: 'info',
      format: format.combine(
        format.timestamp(),
        format.simple()
      ),
      transports: [
        new transports.Console(),
        new transports.File({ filename: 'logs/community-engagement.log' })
      ],
    });
  }

  static getInstance(config?: CommunityEngagementConfig): CommunityEngagementManager {
    if (!CommunityEngagementManager.instance && config) {
      CommunityEngagementManager.instance = new CommunityEngagementManager(config);
    } else if (!CommunityEngagementManager.instance) {
      throw new Error('CommunityEngagementManager must be initialized with config first');
    }
    return CommunityEngagementManager.instance;
  }

  async initialize(): Promise<void> {
    try {
      this.logger.info('Initializing Community Engagement Manager...');

      // Initialize default engagement rules
      await this.initializeEngagementRules();

      // Load historical community data if available
      await this.loadCommunityData();

      this.isInitialized = true;
      this.logger.info('Community Engagement Manager initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize Community Engagement Manager:', error);
      throw error;
    }
  }

  async start(): Promise<void> {
    try {
      if (!this.isInitialized) {
        throw new Error('Community Engagement Manager must be initialized before starting');
      }

      this.logger.info('Starting Community Engagement Manager...');
      this.isRunning = true;

      // Start engagement tracking
      if (this.config.enableEngagementTracking) {
        this.startEngagementTracking();
      }

      // Start community growth analysis
      if (this.config.enableCommunityGrowthMetrics) {
        this.startGrowthAnalysis();
      }

      // Start automated response processing
      if (this.config.enableAutomatedResponses) {
        this.startResponseProcessing();
      }

      this.logger.info('Community Engagement Manager started successfully');
    } catch (error) {
      this.logger.error('Failed to start Community Engagement Manager:', error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    try {
      this.logger.info('Stopping Community Engagement Manager...');
      this.isRunning = false;

      // Clear intervals
      if (this.trackingInterval) {
        clearInterval(this.trackingInterval);
      }
      if (this.growthAnalysisInterval) {
        clearInterval(this.growthAnalysisInterval);
      }
      if (this.responseProcessingInterval) {
        clearInterval(this.responseProcessingInterval);
      }

      this.logger.info('Community Engagement Manager stopped successfully');
    } catch (error) {
      this.logger.error('Failed to stop Community Engagement Manager:', error);
      throw error;
    }
  }

  // Public API methods
  async processEngagementData(sentimentData: SentimentData[]): Promise<void> {
    try {
      for (const data of sentimentData) {
        await this.analyzeEngagement(data);
        
        // Check if this triggers an automated response
        if (this.config.enableAutomatedResponses) {
          const shouldRespond = await this.shouldGenerateResponse(data);
          if (shouldRespond) {
            await this.queueAutomatedResponse(data);
          }
        }

        // Update community member data
        await this.updateCommunityMember(data);
        
        // Track engagement metrics
        await this.trackEngagement(data);
      }
    } catch (error) {
      this.logger.error('Failed to process engagement data:', error);
      throw error;
    }
  }

  async generateEngagementResponse(data: SentimentData, context?: string): Promise<EngagementResponse | null> {
    try {
      if (!this.canGenerateResponse()) {
        this.logger.debug('Response generation rate limited');
        return null;
      }

      const prompt = this.buildResponsePrompt(data, context);
      
      const result = await this.aiClient.chat({
        messages: [{ role: 'user', content: prompt }],
        provider: this.config.responseGenerationProvider as any,
        maxTokens: 280 // Twitter-like limit
      });

      if (result.success && result.data?.content) {
        const response: EngagementResponse = {
          id: `response_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          originalContentId: data.id,
          platform: data.source,
          responseText: result.data.content.trim(),
          responseType: this.determineResponseType(data),
          confidence: 0.8, // AI-generated responses have high confidence
          timestamp: new Date(),
          status: 'pending',
          targetAudience: this.identifyTargetAudience(data),
          engagementGoal: this.determineEngagementGoal(data),
          metadata: {
            generatedBy: 'ai',
            provider: this.config.responseGenerationProvider,
            originalSentiment: data.content,
            triggerRules: this.getTriggeredRules(data)
          }
        };

        this.responsesThisHour++;
        return response;
      }

      return null;
    } catch (error) {
      this.logger.error('Failed to generate engagement response:', error);
      return null;
    }
  }

  async getCommunityGrowthMetrics(timeframe: 'hour' | 'day' | 'week' | 'month' = 'day'): Promise<CommunityGrowthMetrics> {
    try {
      const cutoffTime = this.getTimeframeCutoff(timeframe);
      const relevantMetrics = this.growthMetrics.filter(m => m.timestamp >= cutoffTime);

      if (relevantMetrics.length === 0) {
        return this.generateEmptyGrowthMetrics();
      }

      // Aggregate metrics
      const totalNewMembers = relevantMetrics.reduce((sum, m) => sum + m.newMembers, 0);
      const totalEngagement = relevantMetrics.reduce((sum, m) => sum + m.totalEngagement, 0);
      const avgSentiment = relevantMetrics.reduce((sum, m) => sum + m.averageSentiment, 0) / relevantMetrics.length;

      return {
        id: `growth_${timeframe}_${Date.now()}`,
        timestamp: new Date(),
        timeframe,
        newMembers: totalNewMembers,
        activeMembers: this.getActiveMembersCount(cutoffTime),
        totalEngagement,
        averageSentiment: avgSentiment,
        growthRate: this.calculateGrowthRate(relevantMetrics),
        engagementRate: this.calculateEngagementRate(relevantMetrics),
        topPlatforms: this.getTopPlatformsByGrowth(relevantMetrics),
        topInfluencers: this.getTopInfluencers(cutoffTime),
        viralContent: this.getViralContent(cutoffTime),
        trends: this.detectGrowthTrends(relevantMetrics)
      };
    } catch (error) {
      this.logger.error('Failed to get community growth metrics:', error);
      throw error;
    }
  }

  async getEngagementAnalytics(platform?: SocialPlatform): Promise<EngagementAnalytics> {
    try {
      const analytics: EngagementAnalytics = {
        totalEngagements: 0,
        averageEngagementRate: 0,
        responseRate: 0,
        topEngagedContent: [],
        engagementByPlatform: new Map(),
        engagementByTime: [],
        sentimentDistribution: {
          positive: 0,
          negative: 0,
          neutral: 0
        },
        responseEffectiveness: 0,
        communityHealthScore: 0
      };

      // Calculate analytics from engagement tracker
      let totalEngagements = 0;
      let totalEngagementRate = 0;
      let count = 0;

      for (const [contentId, metrics] of this.engagementTracker) {
        if (!platform || metrics.platform === platform) {
          totalEngagements += metrics.totalEngagements;
          totalEngagementRate += metrics.engagementRate;
          count++;

          // Update platform statistics
          const platformCount = analytics.engagementByPlatform.get(metrics.platform) || 0;
          analytics.engagementByPlatform.set(metrics.platform, platformCount + metrics.totalEngagements);
        }
      }

      analytics.totalEngagements = totalEngagements;
      analytics.averageEngagementRate = count > 0 ? totalEngagementRate / count : 0;
      analytics.responseRate = this.calculateResponseRate();
      analytics.responseEffectiveness = this.calculateResponseEffectiveness();
      analytics.communityHealthScore = this.calculateCommunityHealthScore();

      return analytics;
    } catch (error) {
      this.logger.error('Failed to get engagement analytics:', error);
      throw error;
    }
  }

  // Private methods
  private async initializeEngagementRules(): Promise<void> {
    // Default engagement rules for crypto content
    this.engagementRules = [
      {
        id: 'high_influence_positive',
        name: 'High Influence Positive Sentiment',
        conditions: {
          minInfluence: 0.7,
          minSentimentScore: 0.5,
          platforms: [SocialPlatform.TWITTER, SocialPlatform.DISCORD]
        },
        actions: {
          autoRespond: true,
          responseType: 'supportive',
          priority: 'high'
        },
        enabled: true
      },
      {
        id: 'viral_content',
        name: 'Viral Content Detection',
        conditions: {
          minEngagement: 1000,
          minSentimentScore: 0.3,
          platforms: this.config.platforms
        },
        actions: {
          autoRespond: true,
          responseType: 'engaging',
          priority: 'medium'
        },
        enabled: true
      },
      {
        id: 'negative_sentiment_mitigation',
        name: 'Negative Sentiment Mitigation',
        conditions: {
          maxSentimentScore: -0.5,
          minInfluence: 0.3,
          platforms: this.config.platforms
        },
        actions: {
          autoRespond: true,
          responseType: 'educational',
          priority: 'high'
        },
        enabled: true
      },
      {
        id: 'defi_adoption_signal',
        name: 'DeFi Adoption Signal',
        conditions: {
          keywordMatch: ['defi', 'yield farming', 'liquidity mining', 'staking'],
          minInfluence: 0.4,
          platforms: this.config.platforms
        },
        actions: {
          autoRespond: true,
          responseType: 'informative',
          priority: 'medium'
        },
        enabled: true
      }
    ];

    this.logger.info(`Initialized ${this.engagementRules.length} engagement rules`);
  }

  private async loadCommunityData(): Promise<void> {
    // TODO: Load historical community data from database/storage
    // For now, initialize empty state
    this.logger.info('Community data initialized (no historical data loaded)');
  }

  private startEngagementTracking(): void {
    this.trackingInterval = setInterval(async () => {
      try {
        await this.performEngagementTracking();
      } catch (error) {
        this.logger.error('Engagement tracking cycle failed:', error);
      }
    }, this.config.trackingInterval);

    this.logger.info('Engagement tracking started');
  }

  private startGrowthAnalysis(): void {
    this.growthAnalysisInterval = setInterval(async () => {
      try {
        await this.performGrowthAnalysis();
      } catch (error) {
        this.logger.error('Growth analysis cycle failed:', error);
      }
    }, this.config.growthAnalysisInterval);

    this.logger.info('Growth analysis started');
  }

  private startResponseProcessing(): void {
    this.responseProcessingInterval = setInterval(async () => {
      try {
        await this.processResponseQueue();
      } catch (error) {
        this.logger.error('Response processing cycle failed:', error);
      }
    }, 30000); // Process every 30 seconds

    this.logger.info('Response processing started');
  }

  private async analyzeEngagement(data: SentimentData): Promise<void> {
    const engagement = data.engagement;
    if (!engagement) return;

    const totalEngagements = (engagement.likes || 0) + 
                           (engagement.retweets || 0) + 
                           (engagement.replies || 0) + 
                           (engagement.shares || 0);

    const engagementMetrics: EngagementMetrics = {
      contentId: data.id,
      platform: data.source,
      totalEngagements,
      engagementRate: this.calculateEngagementRate([{ totalEngagement: totalEngagements }] as any),
      likes: engagement.likes || 0,
      shares: engagement.retweets || engagement.shares || 0,
      comments: engagement.replies || 0,
      views: engagement.views || 0,
      sentiment: data.content, // Store original content for reference
      timestamp: data.timestamp,
      authorInfluence: data.author.influence || 0,
      viralityScore: this.calculateViralityScore(totalEngagements, data.timestamp),
      reachEstimate: this.estimateReach(data)
    };

    this.engagementTracker.set(data.id, engagementMetrics);
  }

  private async shouldGenerateResponse(data: SentimentData): Promise<boolean> {
    // Check rate limits
    if (!this.canGenerateResponse()) {
      return false;
    }

    // Check if already responded to this user recently
    if (this.hasRecentResponse(data.author.id)) {
      return false;
    }

    // Check engagement rules
    return this.evaluateEngagementRules(data);
  }

  private canGenerateResponse(): boolean {
    // Reset counter if hour has passed
    const now = new Date();
    if (now.getTime() - this.lastResponseReset.getTime() >= 3600000) {
      this.responsesThisHour = 0;
      this.lastResponseReset = now;
    }

    return this.responsesThisHour < this.config.maxResponsesPerHour;
  }

  private hasRecentResponse(authorId: string): boolean {
    const recentResponses = this.responseHistory.get(authorId) || [];
    const oneHourAgo = new Date(Date.now() - 3600000);
    
    return recentResponses.some(response => response.timestamp >= oneHourAgo);
  }

  private evaluateEngagementRules(data: SentimentData): boolean {
    return this.engagementRules.some(rule => {
      if (!rule.enabled) return false;

      const conditions = rule.conditions;
      
      // Check platform
      if (conditions.platforms && !conditions.platforms.includes(data.source)) {
        return false;
      }

      // Check influence threshold
      if (conditions.minInfluence && (data.author.influence || 0) < conditions.minInfluence) {
        return false;
      }

      // Check engagement threshold
      if (conditions.minEngagement) {
        const totalEngagement = (data.engagement.likes || 0) + 
                               (data.engagement.retweets || 0) + 
                               (data.engagement.replies || 0);
        if (totalEngagement < conditions.minEngagement) {
          return false;
        }
      }

      // Check keyword matching
      if (conditions.keywordMatch) {
        const content = data.content.toLowerCase();
        const hasKeyword = conditions.keywordMatch.some(keyword => 
          content.includes(keyword.toLowerCase())
        );
        if (!hasKeyword) {
          return false;
        }
      }

      return true;
    });
  }

  private buildResponsePrompt(data: SentimentData, context?: string): string {
    return `Generate a helpful, engaging response to this cryptocurrency/DeFi social media post. 

Original post: "${data.content}"
Author influence: ${data.author.influence || 0}
Platform: ${data.source}
${context ? `Additional context: ${context}` : ''}

Guidelines:
- Be helpful and informative
- Stay positive and constructive
- Keep it under 280 characters
- Use appropriate crypto/DeFi terminology
- Don't give financial advice
- Encourage learning and community engagement

Response:`;
  }

  private determineResponseType(data: SentimentData): 'supportive' | 'educational' | 'engaging' | 'informative' {
    const content = data.content.toLowerCase();
    
    if (content.includes('help') || content.includes('question') || content.includes('how')) {
      return 'educational';
    }
    
    if (content.includes('fud') || content.includes('scam') || content.includes('crash')) {
      return 'supportive';
    }
    
    if (content.includes('defi') || content.includes('yield') || content.includes('protocol')) {
      return 'informative';
    }
    
    return 'engaging';
  }

  private identifyTargetAudience(data: SentimentData): string {
    if (data.author.followersCount && data.author.followersCount > 10000) {
      return 'influencer';
    }
    
    if (data.author.verified) {
      return 'verified_user';
    }
    
    return 'general_community';
  }

  private determineEngagementGoal(data: SentimentData): string {
    const content = data.content.toLowerCase();
    
    if (content.includes('learn') || content.includes('understand')) {
      return 'education';
    }
    
    if (content.includes('join') || content.includes('community')) {
      return 'community_building';
    }
    
    return 'general_engagement';
  }

  private getTriggeredRules(data: SentimentData): string[] {
    return this.engagementRules
      .filter(rule => this.evaluateEngagementRules(data))
      .map(rule => rule.id);
  }

  private async queueAutomatedResponse(data: SentimentData): Promise<void> {
    const response = await this.generateEngagementResponse(data);
    if (response) {
      this.responseQueue.push(response);
      
      // Update response history
      const authorResponses = this.responseHistory.get(data.author.id) || [];
      authorResponses.push(response);
      this.responseHistory.set(data.author.id, authorResponses);
      
      this.logger.info(`Queued automated response for content ${data.id}`);
    }
  }

  private async updateCommunityMember(data: SentimentData): Promise<void> {
    const memberId = data.author.id;
    const existingMember = this.communityMembers.get(memberId);

    const member: CommunityMember = {
      id: memberId,
      username: data.author.username,
      platform: data.source,
      joinDate: existingMember?.joinDate || data.timestamp,
      lastActivity: data.timestamp,
      totalPosts: (existingMember?.totalPosts || 0) + 1,
      totalEngagement: (existingMember?.totalEngagement || 0) + this.calculateTotalEngagement(data.engagement),
      averageSentiment: this.updateAverageSentiment(existingMember?.averageSentiment || 0, 0.5), // Placeholder sentiment
      influence: data.author.influence || 0.1,
      verified: data.author.verified || false,
      followerCount: data.author.followersCount || 0,
      engagementRate: this.calculateMemberEngagementRate(data),
      interests: this.extractInterests(data.content),
      activityScore: this.calculateActivityScore(existingMember, data),
      communityRank: existingMember?.communityRank || 'member',
      badges: existingMember?.badges || []
    };

    this.communityMembers.set(memberId, member);
  }

  private async trackEngagement(data: SentimentData): Promise<void> {
    // Already handled in analyzeEngagement, but could add additional tracking here
    this.emit('engagement_tracked', {
      contentId: data.id,
      platform: data.source,
      timestamp: new Date(),
      metrics: this.engagementTracker.get(data.id)
    });
  }

  private async performEngagementTracking(): Promise<void> {
    this.logger.debug('Performing engagement tracking cycle...');
    
    // Update viral content detection
    const viralThreshold = 1000;
    for (const [contentId, metrics] of this.engagementTracker) {
      if (metrics.totalEngagements > viralThreshold && metrics.viralityScore > 0.8) {
        this.emit('viral_content_detected', {
          contentId,
          metrics,
          timestamp: new Date()
        });
      }
    }

    this.logger.debug('Engagement tracking cycle completed');
  }

  private async performGrowthAnalysis(): Promise<void> {
    this.logger.debug('Performing growth analysis cycle...');
    
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 3600000);
    
    // Count new members in the last hour
    const newMembers = Array.from(this.communityMembers.values())
      .filter(member => member.joinDate >= oneHourAgo).length;
    
    // Calculate total engagement
    const totalEngagement = Array.from(this.engagementTracker.values())
      .filter(metrics => metrics.timestamp >= oneHourAgo)
      .reduce((sum, metrics) => sum + metrics.totalEngagements, 0);
    
    // Calculate average sentiment (placeholder)
    const averageSentiment = 0.3; // Would calculate from recent sentiment data
    
    const growthMetric: CommunityGrowthMetrics = {
      id: `growth_${now.getTime()}`,
      timestamp: now,
      timeframe: 'hour',
      newMembers,
      activeMembers: this.getActiveMembersCount(oneHourAgo),
      totalEngagement,
      averageSentiment,
      growthRate: this.calculateGrowthRate([{ newMembers }] as any),
      engagementRate: this.calculateEngagementRate([{ totalEngagement }] as any),
      topPlatforms: this.getTopPlatformsByGrowth([]),
      topInfluencers: this.getTopInfluencers(oneHourAgo),
      viralContent: this.getViralContent(oneHourAgo),
      trends: []
    };
    
    this.growthMetrics.push(growthMetric);
    
    // Keep only recent metrics (last 30 days)
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 3600000);
    this.growthMetrics = this.growthMetrics.filter(metric => metric.timestamp >= thirtyDaysAgo);
    
    this.emit('growth_analysis_completed', growthMetric);
    this.logger.debug('Growth analysis cycle completed');
  }

  private async processResponseQueue(): Promise<void> {
    if (this.responseQueue.length === 0) return;

    this.logger.debug(`Processing ${this.responseQueue.length} queued responses...`);
    
    // Process pending responses (in a real implementation, this would post to social media)
    const processedResponses = this.responseQueue.splice(0, Math.min(5, this.responseQueue.length));
    
    for (const response of processedResponses) {
      response.status = 'posted';
      response.postedAt = new Date();
      
      this.emit('response_posted', response);
      this.logger.info(`Posted automated response ${response.id}`);
    }
  }

  // Helper methods
  private calculateTotalEngagement(engagement: any): number {
    return (engagement.likes || 0) + 
           (engagement.retweets || 0) + 
           (engagement.replies || 0) + 
           (engagement.shares || 0) +
           (engagement.views || 0) * 0.1; // Weight views less
  }

  private updateAverageSentiment(current: number, newSentiment: number, weight: number = 0.1): number {
    return current * (1 - weight) + newSentiment * weight;
  }

  private extractInterests(content: string): string[] {
    const interests: string[] = [];
    const lowerContent = content.toLowerCase();
    
    const interestKeywords = {
      'defi': ['defi', 'yield farming', 'liquidity mining', 'staking'],
      'nft': ['nft', 'non-fungible', 'opensea', 'collectibles'],
      'trading': ['trading', 'buy', 'sell', 'leverage', 'futures'],
      'btc': ['bitcoin', 'btc'],
      'eth': ['ethereum', 'eth'],
      'altcoins': ['altcoin', 'alt', 'gem']
    };
    
    Object.entries(interestKeywords).forEach(([interest, keywords]) => {
      if (keywords.some(keyword => lowerContent.includes(keyword))) {
        interests.push(interest);
      }
    });
    
    return interests;
  }

  private calculateMemberEngagementRate(data: SentimentData): number {
    const totalEngagement = this.calculateTotalEngagement(data.engagement);
    const followerCount = data.author.followersCount || 1;
    return Math.min(totalEngagement / followerCount, 1);
  }

  private calculateActivityScore(existingMember: CommunityMember | undefined, data: SentimentData): number {
    const baseScore = existingMember?.activityScore || 0;
    const engagementBonus = this.calculateTotalEngagement(data.engagement) / 1000;
    const timeDecay = existingMember ? 
      Math.exp(-(Date.now() - existingMember.lastActivity.getTime()) / (7 * 24 * 3600000)) : 1;
    
    return Math.min((baseScore * timeDecay) + engagementBonus + 0.1, 10);
  }

  private calculateViralityScore(totalEngagements: number, timestamp: Date): number {
    const ageInHours = (Date.now() - timestamp.getTime()) / 3600000;
    const engagementRate = totalEngagements / Math.max(ageInHours, 1);
    
    // Normalize to 0-1 scale
    return Math.min(engagementRate / 1000, 1);
  }

  private estimateReach(data: SentimentData): number {
    const baseReach = data.author.followersCount || 0;
    const engagementMultiplier = 1 + (this.calculateTotalEngagement(data.engagement) / 1000);
    const influenceMultiplier = 1 + (data.author.influence || 0);
    
    return Math.floor(baseReach * engagementMultiplier * influenceMultiplier);
  }

  private getTimeframeCutoff(timeframe: 'hour' | 'day' | 'week' | 'month'): Date {
    const now = Date.now();
    const multipliers = {
      hour: 3600000,
      day: 24 * 3600000,
      week: 7 * 24 * 3600000,
      month: 30 * 24 * 3600000
    };
    
    return new Date(now - multipliers[timeframe]);
  }

  private generateEmptyGrowthMetrics(): CommunityGrowthMetrics {
    return {
      id: `empty_${Date.now()}`,
      timestamp: new Date(),
      timeframe: 'day',
      newMembers: 0,
      activeMembers: 0,
      totalEngagement: 0,
      averageSentiment: 0,
      growthRate: 0,
      engagementRate: 0,
      topPlatforms: [],
      topInfluencers: [],
      viralContent: [],
      trends: []
    };
  }

  private getActiveMembersCount(since: Date): number {
    return Array.from(this.communityMembers.values())
      .filter(member => member.lastActivity >= since).length;
  }

  private calculateGrowthRate(metrics: any[]): number {
    if (metrics.length < 2) return 0;
    
    const latest = metrics[metrics.length - 1];
    const previous = metrics[metrics.length - 2];
    
    return previous.newMembers > 0 ? 
      (latest.newMembers - previous.newMembers) / previous.newMembers : 0;
  }

  private calculateEngagementRate(metrics: any[]): number {
    if (metrics.length === 0) return 0;
    
    const totalEngagement = metrics.reduce((sum, m) => sum + (m.totalEngagement || 0), 0);
    return totalEngagement / (this.communityMembers.size || 1);
  }

  private getTopPlatformsByGrowth(metrics: any[]): SocialPlatform[] {
    // Placeholder implementation
    return [SocialPlatform.TWITTER, SocialPlatform.DISCORD];
  }

  private getTopInfluencers(since: Date): string[] {
    return Array.from(this.communityMembers.values())
      .filter(member => member.lastActivity >= since)
      .sort((a, b) => b.influence - a.influence)
      .slice(0, 10)
      .map(member => member.username);
  }

  private getViralContent(since: Date): string[] {
    return Array.from(this.engagementTracker.values())
      .filter(metrics => metrics.timestamp >= since && metrics.viralityScore > 0.7)
      .sort((a, b) => b.viralityScore - a.viralityScore)
      .slice(0, 5)
      .map(metrics => metrics.contentId);
  }

  private detectGrowthTrends(metrics: any[]): string[] {
    // Simple trend detection - could be enhanced with more sophisticated analysis
    const trends: string[] = [];
    
    if (metrics.length >= 3) {
      const recent = metrics.slice(-3);
      const avgGrowth = recent.reduce((sum, m) => sum + (m.newMembers || 0), 0) / 3;
      
      if (avgGrowth > 10) trends.push('rapid_growth');
      if (avgGrowth < 1) trends.push('slow_growth');
    }
    
    return trends;
  }

  private calculateResponseRate(): number {
    const totalResponses = Array.from(this.responseHistory.values())
      .reduce((sum, responses) => sum + responses.length, 0);
    const totalContent = this.engagementTracker.size;
    
    return totalContent > 0 ? totalResponses / totalContent : 0;
  }

  private calculateResponseEffectiveness(): number {
    // Placeholder - would analyze engagement on responded content vs non-responded
    return 0.7;
  }

  private calculateCommunityHealthScore(): number {
    const activeMemberRatio = this.getActiveMembersCount(new Date(Date.now() - 24 * 3600000)) / 
                             (this.communityMembers.size || 1);
    const avgEngagementRate = this.calculateEngagementRate(Array.from(this.engagementTracker.values()));
    const responseRate = this.calculateResponseRate();
    
    return (activeMemberRatio * 0.4 + avgEngagementRate * 0.4 + responseRate * 0.2);
  }

  getStatus(): any {
    return {
      isInitialized: this.isInitialized,
      isRunning: this.isRunning,
      communityMembersCount: this.communityMembers.size,
      trackedContentCount: this.engagementTracker.size,
      queuedResponsesCount: this.responseQueue.length,
      responsesThisHour: this.responsesThisHour,
      engagementRulesCount: this.engagementRules.length,
      growthMetricsCount: this.growthMetrics.length,
      config: this.config
    };
  }

  async shutdown(): Promise<void> {
    try {
      this.logger.info('Shutting down Community Engagement Manager...');
      
      await this.stop();
      
      // Clear data structures
      this.engagementTracker.clear();
      this.communityMembers.clear();
      this.responseQueue.length = 0;
      this.responseHistory.clear();
      
      this.removeAllListeners();
      
      this.logger.info('Community Engagement Manager shutdown complete');
    } catch (error) {
      this.logger.error('Failed to shutdown Community Engagement Manager:', error);
      throw error;
    }
  }
}