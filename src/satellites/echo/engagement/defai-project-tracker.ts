/**
 * DeFAI Project Tracker
 * Tracks DeFi and AI project adoption signals and community engagement
 */

import { EventEmitter } from 'events';
import { Logger } from 'winston';
import { createLogger, format, transports } from 'winston';
import { 
  SentimentData, 
  SocialPlatform,
  DeFAIProject,
  AdoptionSignal,
  ProjectMetrics,
  TrendingProject
} from '../types';
import { getUnifiedAIClient } from '../../../integrations/ai/unified-ai-client';

export interface DeFAITrackingConfig {
  enableRealTimeTracking: boolean;
  trackingInterval: number; // milliseconds
  adoptionSignalThresholds: {
    mentionVelocity: number; // mentions per hour
    sentimentThreshold: number; // minimum positive sentiment
    influencerMentions: number; // minimum influencer mentions
    engagementGrowth: number; // minimum engagement growth rate
  };
  projectCategories: string[];
  platforms: SocialPlatform[];
  aiAnalysisEnabled: boolean;
  maxTrackedProjects: number;
}

export const DEFAULT_DEFAI_TRACKING_CONFIG: DeFAITrackingConfig = {
  enableRealTimeTracking: true,
  trackingInterval: 300000, // 5 minutes
  adoptionSignalThresholds: {
    mentionVelocity: 10,
    sentimentThreshold: 0.3,
    influencerMentions: 3,
    engagementGrowth: 0.5
  },
  projectCategories: [
    'defi', 'ai', 'defai', 'yield_farming', 'liquidity_mining',
    'staking', 'lending', 'dex', 'dao', 'nft', 'gamefi', 'socialfi'
  ],
  platforms: [
    SocialPlatform.TWITTER,
    SocialPlatform.DISCORD,
    SocialPlatform.TELEGRAM,
    SocialPlatform.REDDIT
  ],
  aiAnalysisEnabled: true,
  maxTrackedProjects: 100
};

export class DeFAIProjectTracker extends EventEmitter {
  private static instance: DeFAIProjectTracker;
  private logger: Logger;
  private config: DeFAITrackingConfig;
  private aiClient = getUnifiedAIClient();
  private isInitialized: boolean = false;
  private isRunning: boolean = false;

  // Project tracking data
  private trackedProjects: Map<string, DeFAIProject> = new Map();
  private adoptionSignals: Map<string, AdoptionSignal[]> = new Map();
  private projectMetrics: Map<string, ProjectMetrics> = new Map();
  private trendingProjects: TrendingProject[] = [];

  // Tracking intervals
  private trackingInterval?: NodeJS.Timeout;
  private analysisInterval?: NodeJS.Timeout;

  // Project detection patterns
  private projectPatterns = {
    defi: [
      /\b(uniswap|sushiswap|pancakeswap|compound|aave|maker|curve|yearn|convex|balancer|1inch|dydx)\b/gi,
      /\b\w+swap\b/gi,
      /\b\w+fi\b/gi
    ],
    ai: [
      /\b(chatgpt|gpt|claude|gemini|bard|copilot|midjourney|stable diffusion)\b/gi,
      /\b(artificial intelligence|machine learning|neural network|deep learning)\b/gi,
      /\b\w+ai\b/gi
    ],
    defai: [
      /\b(defai|defi.*ai|ai.*defi)\b/gi,
      /\b(automated.*yield|ai.*trading|intelligent.*farming)\b/gi
    ]
  };

  private constructor(config: DeFAITrackingConfig) {
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
        new transports.File({ filename: 'logs/defai-project-tracker.log' })
      ],
    });
  }

  static getInstance(config?: DeFAITrackingConfig): DeFAIProjectTracker {
    if (!DeFAIProjectTracker.instance && config) {
      DeFAIProjectTracker.instance = new DeFAIProjectTracker(config);
    } else if (!DeFAIProjectTracker.instance) {
      throw new Error('DeFAIProjectTracker must be initialized with config first');
    }
    return DeFAIProjectTracker.instance;
  }

  async initialize(): Promise<void> {
    try {
      this.logger.info('Initializing DeFAI Project Tracker...');

      // Load known projects database
      await this.loadKnownProjects();

      // Initialize project metrics
      await this.initializeProjectMetrics();

      this.isInitialized = true;
      this.logger.info('DeFAI Project Tracker initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize DeFAI Project Tracker:', error);
      throw error;
    }
  }

  async start(): Promise<void> {
    try {
      if (!this.isInitialized) {
        throw new Error('DeFAI Project Tracker must be initialized before starting');
      }

      this.logger.info('Starting DeFAI Project Tracker...');
      this.isRunning = true;

      // Start real-time tracking
      if (this.config.enableRealTimeTracking) {
        this.startRealTimeTracking();
      }

      // Start periodic analysis
      this.startPeriodicAnalysis();

      this.logger.info('DeFAI Project Tracker started successfully');
    } catch (error) {
      this.logger.error('Failed to start DeFAI Project Tracker:', error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    try {
      this.logger.info('Stopping DeFAI Project Tracker...');
      this.isRunning = false;

      if (this.trackingInterval) {
        clearInterval(this.trackingInterval);
      }
      if (this.analysisInterval) {
        clearInterval(this.analysisInterval);
      }

      this.logger.info('DeFAI Project Tracker stopped successfully');
    } catch (error) {
      this.logger.error('Failed to stop DeFAI Project Tracker:', error);
      throw error;
    }
  }

  // Public API methods
  async processSentimentData(sentimentData: SentimentData[]): Promise<void> {
    try {
      for (const data of sentimentData) {
        await this.analyzeProjectMentions(data);
        await this.detectAdoptionSignals(data);
        await this.updateProjectMetrics(data);
      }
    } catch (error) {
      this.logger.error('Failed to process sentiment data:', error);
      throw error;
    }
  }

  async getTrackedProjects(): Promise<DeFAIProject[]> {
    return Array.from(this.trackedProjects.values());
  }

  async getProjectMetrics(projectId: string): Promise<ProjectMetrics | null> {
    return this.projectMetrics.get(projectId) || null;
  }

  async getTrendingProjects(limit: number = 10): Promise<TrendingProject[]> {
    return this.trendingProjects.slice(0, limit);
  }

  async getAdoptionSignals(projectId: string): Promise<AdoptionSignal[]> {
    return this.adoptionSignals.get(projectId) || [];
  }

  async analyzeProjectWithAI(projectName: string): Promise<any> {
    try {
      if (!this.config.aiAnalysisEnabled) {
        return null;
      }

      const prompt = `Analyze this DeFi/AI project for adoption potential and community sentiment:

Project: ${projectName}

Provide analysis on:
1. Project category (DeFi, AI, DeFAI hybrid)
2. Innovation level (1-10)
3. Market potential (1-10)
4. Community strength (1-10)
5. Adoption signals (list key indicators)
6. Risk factors (list main concerns)
7. Overall assessment (bullish/neutral/bearish)

Return JSON format: {"category": "", "innovation": 0, "market_potential": 0, "community_strength": 0, "adoption_signals": [], "risk_factors": [], "assessment": "", "confidence": 0}`;

      const result = await this.aiClient.chat({
        messages: [{ role: 'user', content: prompt }],
        provider: 'anthropic',
        responseFormat: 'json'
      });

      if (result.success && result.data?.content) {
        return JSON.parse(result.data.content);
      }

      return null;
    } catch (error) {
      this.logger.error('Failed to analyze project with AI:', error);
      return null;
    }
  }

  // Private methods
  private async loadKnownProjects(): Promise<void> {
    // Initialize with known DeFi and AI projects
    const knownProjects = [
      // Major DeFi projects
      { name: 'Uniswap', category: 'defi', type: 'dex', launched: new Date('2018-11-02') },
      { name: 'Aave', category: 'defi', type: 'lending', launched: new Date('2017-05-01') },
      { name: 'Compound', category: 'defi', type: 'lending', launched: new Date('2018-09-01') },
      { name: 'MakerDAO', category: 'defi', type: 'dao', launched: new Date('2017-12-01') },
      { name: 'Curve', category: 'defi', type: 'dex', launched: new Date('2020-01-19') },
      { name: 'Yearn Finance', category: 'defi', type: 'yield_farming', launched: new Date('2020-02-01') },
      
      // AI projects
      { name: 'SingularityNET', category: 'ai', type: 'marketplace', launched: new Date('2017-12-01') },
      { name: 'Fetch.ai', category: 'ai', type: 'autonomous_agents', launched: new Date('2017-01-01') },
      { name: 'Ocean Protocol', category: 'ai', type: 'data_marketplace', launched: new Date('2017-04-01') },
      
      // Emerging DeFAI projects
      { name: 'Numeraire', category: 'defai', type: 'prediction_market', launched: new Date('2017-06-01') },
      { name: 'Cortex', category: 'defai', type: 'ai_contracts', launched: new Date('2018-02-01') }
    ];

    for (const project of knownProjects) {
      const defaiProject: DeFAIProject = {
        id: project.name.toLowerCase().replace(/\s+/g, '_'),
        name: project.name,
        category: project.category as any,
        type: project.type,
        description: `${project.name} - ${project.type} project in ${project.category}`,
        launchDate: project.launched,
        discoveredDate: new Date(),
        platforms: this.config.platforms,
        tags: [project.category, project.type],
        status: 'active',
        confidence: 0.9, // High confidence for known projects
        website: `https://${project.name.toLowerCase().replace(/\s+/g, '')}.com`,
        social: {
          twitter: `@${project.name.replace(/\s+/g, '')}`,
          discord: null,
          telegram: null
        },
        metrics: {
          mentionCount: 0,
          sentimentScore: 0,
          influencerMentions: 0,
          communitySize: 0,
          adoptionScore: 0
        },
        lastUpdated: new Date()
      };

      this.trackedProjects.set(defaiProject.id, defaiProject);
    }

    this.logger.info(`Loaded ${knownProjects.length} known projects`);
  }

  private async initializeProjectMetrics(): Promise<void> {
    for (const [projectId, project] of this.trackedProjects) {
      const metrics: ProjectMetrics = {
        projectId,
        totalMentions: 0,
        mentionVelocity: 0,
        sentimentDistribution: {
          positive: 0,
          negative: 0,
          neutral: 0
        },
        platformDistribution: new Map(),
        influencerMentions: 0,
        communityGrowth: 0,
        adoptionSignals: [],
        viralityScore: 0,
        momentumScore: 0,
        riskScore: 0.5, // Default neutral risk
        lastUpdated: new Date()
      };

      this.projectMetrics.set(projectId, metrics);
    }

    this.logger.info(`Initialized metrics for ${this.trackedProjects.size} projects`);
  }

  private startRealTimeTracking(): void {
    this.trackingInterval = setInterval(async () => {
      try {
        await this.performRealTimeTracking();
      } catch (error) {
        this.logger.error('Real-time tracking cycle failed:', error);
      }
    }, this.config.trackingInterval);

    this.logger.info('Real-time tracking started');
  }

  private startPeriodicAnalysis(): void {
    this.analysisInterval = setInterval(async () => {
      try {
        await this.performPeriodicAnalysis();
      } catch (error) {
        this.logger.error('Periodic analysis cycle failed:', error);
      }
    }, this.config.trackingInterval * 2); // Run less frequently than tracking

    this.logger.info('Periodic analysis started');
  }

  private async analyzeProjectMentions(data: SentimentData): Promise<void> {
    const content = data.content.toLowerCase();
    const detectedProjects: string[] = [];

    // Check against known projects
    for (const [projectId, project] of this.trackedProjects) {
      if (content.includes(project.name.toLowerCase()) || 
          project.tags.some(tag => content.includes(tag))) {
        detectedProjects.push(projectId);
      }
    }

    // Use pattern matching for unknown projects
    const newProjects = await this.detectNewProjects(content);
    
    // Update metrics for detected projects
    for (const projectId of detectedProjects) {
      await this.updateProjectFromMention(projectId, data);
    }

    // Add new projects if any
    for (const newProject of newProjects) {
      await this.addNewProject(newProject, data);
    }
  }

  private async detectNewProjects(content: string): Promise<any[]> {
    const newProjects: any[] = [];

    // Pattern-based detection
    for (const [category, patterns] of Object.entries(this.projectPatterns)) {
      for (const pattern of patterns) {
        const matches = content.match(pattern);
        if (matches) {
          for (const match of matches) {
            const projectName = match.trim();
            if (projectName.length >= 3 && !this.isKnownProject(projectName)) {
              newProjects.push({
                name: projectName,
                category,
                confidence: 0.6,
                source: 'pattern_detection'
              });
            }
          }
        }
      }
    }

    // AI-based detection for more sophisticated analysis
    if (this.config.aiAnalysisEnabled && content.length > 50) {
      try {
        const aiProjects = await this.detectProjectsWithAI(content);
        newProjects.push(...aiProjects);
      } catch (error) {
        this.logger.debug('AI project detection failed:', error);
      }
    }

    return newProjects;
  }

  private async detectProjectsWithAI(content: string): Promise<any[]> {
    try {
      const prompt = `Identify any DeFi, AI, or DeFAI projects mentioned in this social media content:

Content: "${content}"

Look for:
- Project names (e.g., Uniswap, Aave, SingularityNET)
- Protocol mentions
- New or emerging projects
- AI/ML platforms used in DeFi

Return JSON array: [{"name": "project_name", "category": "defi|ai|defai", "confidence": 0.8, "context": "relevant_text"}]`;

      const result = await this.aiClient.chat({
        messages: [{ role: 'user', content: prompt }],
        provider: 'anthropic',
        responseFormat: 'json'
      });

      if (result.success && result.data?.content) {
        const projects = JSON.parse(result.data.content);
        return projects.filter((p: any) => p.confidence >= 0.7);
      }
    } catch (error) {
      this.logger.debug('AI project detection parsing failed:', error);
    }

    return [];
  }

  private async detectAdoptionSignals(data: SentimentData): Promise<void> {
    // Look for adoption signals in the content
    const content = data.content.toLowerCase();
    const adoptionKeywords = [
      'just launched', 'new release', 'mainnet', 'beta launch',
      'partnership', 'integration', 'adoption', 'users joined',
      'tvl increased', 'volume spike', 'listed on', 'audit complete'
    ];

    const detectedSignals = adoptionKeywords.filter(keyword => 
      content.includes(keyword)
    );

    if (detectedSignals.length > 0) {
      // Find associated projects
      for (const [projectId, project] of this.trackedProjects) {
        if (content.includes(project.name.toLowerCase())) {
          const signal: AdoptionSignal = {
            id: `signal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            projectId,
            type: this.categorizeSignal(detectedSignals[0]),
            description: detectedSignals.join(', '),
            strength: this.calculateSignalStrength(detectedSignals, data),
            source: data.source,
            timestamp: data.timestamp,
            originalContent: data.content,
            author: {
              id: data.author.id,
              username: data.author.username,
              influence: data.author.influence || 0
            },
            metadata: {
              engagement: data.engagement,
              sentiment: 0.5, // Would calculate from sentiment analysis
              keywords: detectedSignals
            }
          };

          const projectSignals = this.adoptionSignals.get(projectId) || [];
          projectSignals.push(signal);
          this.adoptionSignals.set(projectId, projectSignals);

          this.emit('adoption_signal_detected', {
            projectId,
            signal,
            timestamp: new Date()
          });
        }
      }
    }
  }

  private async updateProjectMetrics(data: SentimentData): Promise<void> {
    const content = data.content.toLowerCase();

    for (const [projectId, project] of this.trackedProjects) {
      if (content.includes(project.name.toLowerCase())) {
        const metrics = this.projectMetrics.get(projectId);
        if (metrics) {
          // Update mention count and velocity
          metrics.totalMentions++;
          metrics.mentionVelocity = this.calculateMentionVelocity(projectId);

          // Update platform distribution
          const platformCount = metrics.platformDistribution.get(data.source) || 0;
          metrics.platformDistribution.set(data.source, platformCount + 1);

          // Update influencer mentions
          if (data.author.influence && data.author.influence > 0.5) {
            metrics.influencerMentions++;
          }

          // Update momentum and virality scores
          metrics.momentumScore = this.calculateMomentumScore(projectId);
          metrics.viralityScore = this.calculateViralityScore(data);

          metrics.lastUpdated = new Date();
          this.projectMetrics.set(projectId, metrics);
        }
      }
    }
  }

  private async performRealTimeTracking(): Promise<void> {
    this.logger.debug('Performing real-time tracking cycle...');

    // Update trending projects
    await this.updateTrendingProjects();

    // Check for viral adoption signals
    await this.checkViralAdoptionSignals();

    this.logger.debug('Real-time tracking cycle completed');
  }

  private async performPeriodicAnalysis(): Promise<void> {
    this.logger.debug('Performing periodic analysis cycle...');

    // Analyze project momentum
    await this.analyzeProjectMomentum();

    // Update risk scores
    await this.updateRiskScores();

    // Clean up old data
    await this.cleanupOldData();

    this.logger.debug('Periodic analysis cycle completed');
  }

  private async updateProjectFromMention(projectId: string, data: SentimentData): Promise<void> {
    const project = this.trackedProjects.get(projectId);
    if (project) {
      project.metrics.mentionCount++;
      project.lastUpdated = new Date();
      
      // Update sentiment score
      const engagementScore = this.calculateEngagementScore(data.engagement);
      project.metrics.sentimentScore = this.updateRunningAverage(
        project.metrics.sentimentScore,
        engagementScore,
        0.1
      );

      this.trackedProjects.set(projectId, project);
    }
  }

  private async addNewProject(projectData: any, sourceData: SentimentData): Promise<void> {
    if (this.trackedProjects.size >= this.config.maxTrackedProjects) {
      this.logger.warn('Maximum tracked projects reached, skipping new project');
      return;
    }

    const projectId = projectData.name.toLowerCase().replace(/\s+/g, '_');
    
    const newProject: DeFAIProject = {
      id: projectId,
      name: projectData.name,
      category: projectData.category,
      type: 'unknown',
      description: `Detected project: ${projectData.name}`,
      launchDate: sourceData.timestamp, // Approximate
      discoveredDate: new Date(),
      platforms: [sourceData.source],
      tags: [projectData.category],
      status: 'discovered',
      confidence: projectData.confidence,
      website: null,
      social: {
        twitter: null,
        discord: null,
        telegram: null
      },
      metrics: {
        mentionCount: 1,
        sentimentScore: 0.5,
        influencerMentions: sourceData.author.influence > 0.5 ? 1 : 0,
        communitySize: 0,
        adoptionScore: 0.1
      },
      lastUpdated: new Date()
    };

    this.trackedProjects.set(projectId, newProject);
    this.initializeProjectMetrics(); // Update metrics

    this.emit('new_project_discovered', {
      project: newProject,
      source: sourceData,
      timestamp: new Date()
    });

    this.logger.info(`Discovered new project: ${projectData.name} (${projectData.category})`);
  }

  private isKnownProject(name: string): boolean {
    const normalizedName = name.toLowerCase();
    return Array.from(this.trackedProjects.values()).some(project => 
      project.name.toLowerCase() === normalizedName
    );
  }

  private categorizeSignal(keyword: string): 'launch' | 'partnership' | 'growth' | 'technical' | 'market' {
    const categories = {
      'launch': ['launched', 'release', 'mainnet', 'beta'],
      'partnership': ['partnership', 'integration', 'collaboration'],
      'growth': ['adoption', 'users', 'tvl', 'volume'],
      'technical': ['audit', 'upgrade', 'feature'],
      'market': ['listed', 'trading', 'price']
    };

    for (const [category, keywords] of Object.entries(categories)) {
      if (keywords.some(k => keyword.includes(k))) {
        return category as any;
      }
    }

    return 'growth';
  }

  private calculateSignalStrength(signals: string[], data: SentimentData): number {
    let strength = signals.length * 0.2; // Base strength from keyword count
    
    // Add influence bonus
    strength += (data.author.influence || 0) * 0.3;
    
    // Add engagement bonus
    const totalEngagement = (data.engagement.likes || 0) + 
                           (data.engagement.retweets || 0) + 
                           (data.engagement.replies || 0);
    strength += Math.min(totalEngagement / 1000, 0.3);
    
    return Math.min(strength, 1);
  }

  private calculateMentionVelocity(projectId: string): number {
    // Calculate mentions per hour for the last 24 hours
    const project = this.trackedProjects.get(projectId);
    if (!project) return 0;

    const oneDayAgo = new Date(Date.now() - 24 * 3600000);
    // This would require historical mention data - placeholder implementation
    return project.metrics.mentionCount / 24; // Average per hour
  }

  private calculateMomentumScore(projectId: string): number {
    const metrics = this.projectMetrics.get(projectId);
    if (!metrics) return 0;

    // Combine mention velocity, sentiment, and influencer mentions
    const velocityScore = Math.min(metrics.mentionVelocity / 10, 1);
    const sentimentScore = (metrics.sentimentDistribution.positive - metrics.sentimentDistribution.negative) / 
                          (metrics.totalMentions || 1);
    const influencerScore = Math.min(metrics.influencerMentions / 10, 1);

    return (velocityScore * 0.4 + sentimentScore * 0.3 + influencerScore * 0.3);
  }

  private calculateViralityScore(data: SentimentData): number {
    const totalEngagement = (data.engagement.likes || 0) + 
                           (data.engagement.retweets || 0) + 
                           (data.engagement.replies || 0) +
                           (data.engagement.views || 0) * 0.01;
    
    const timeBonus = 1 / Math.max((Date.now() - data.timestamp.getTime()) / 3600000, 1);
    
    return Math.min((totalEngagement / 1000) * timeBonus, 1);
  }

  private calculateEngagementScore(engagement: any): number {
    const totalEngagement = (engagement.likes || 0) + 
                           (engagement.retweets || 0) + 
                           (engagement.replies || 0);
    return Math.min(totalEngagement / 100, 1);
  }

  private updateRunningAverage(current: number, newValue: number, weight: number): number {
    return current * (1 - weight) + newValue * weight;
  }

  private async updateTrendingProjects(): Promise<void> {
    const projectScores = new Map<string, number>();

    // Calculate trending scores for all projects
    for (const [projectId, project] of this.trackedProjects) {
      const metrics = this.projectMetrics.get(projectId);
      if (metrics) {
        const trendingScore = this.calculateTrendingScore(metrics);
        projectScores.set(projectId, trendingScore);
      }
    }

    // Sort and update trending projects
    const sortedProjects = Array.from(projectScores.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20);

    this.trendingProjects = sortedProjects.map(([projectId, score]) => {
      const project = this.trackedProjects.get(projectId)!;
      return {
        projectId,
        name: project.name,
        category: project.category,
        trendingScore: score,
        mentionVelocity: this.projectMetrics.get(projectId)?.mentionVelocity || 0,
        sentimentScore: project.metrics.sentimentScore,
        timestamp: new Date(),
        rank: sortedProjects.findIndex(p => p[0] === projectId) + 1,
        change: 0 // Would calculate from previous rankings
      };
    });
  }

  private calculateTrendingScore(metrics: ProjectMetrics): number {
    const velocityScore = Math.min(metrics.mentionVelocity / 20, 1) * 0.4;
    const momentumScore = metrics.momentumScore * 0.3;
    const viralityScore = metrics.viralityScore * 0.2;
    const influencerScore = Math.min(metrics.influencerMentions / 5, 1) * 0.1;

    return velocityScore + momentumScore + viralityScore + influencerScore;
  }

  private async checkViralAdoptionSignals(): Promise<void> {
    const thresholds = this.config.adoptionSignalThresholds;

    for (const [projectId, signals] of this.adoptionSignals) {
      const recentSignals = signals.filter(s => 
        Date.now() - s.timestamp.getTime() < 3600000 // Last hour
      );

      if (recentSignals.length >= 3) { // Multiple signals in short time
        const avgStrength = recentSignals.reduce((sum, s) => sum + s.strength, 0) / recentSignals.length;
        
        if (avgStrength > 0.7) {
          this.emit('viral_adoption_detected', {
            projectId,
            signals: recentSignals,
            strength: avgStrength,
            timestamp: new Date()
          });
        }
      }
    }
  }

  private async analyzeProjectMomentum(): Promise<void> {
    for (const [projectId, metrics] of this.projectMetrics) {
      const momentumScore = this.calculateMomentumScore(projectId);
      metrics.momentumScore = momentumScore;

      if (momentumScore > 0.8) {
        this.emit('high_momentum_detected', {
          projectId,
          momentumScore,
          timestamp: new Date()
        });
      }
    }
  }

  private async updateRiskScores(): Promise<void> {
    // Simple risk scoring based on available data
    for (const [projectId, metrics] of this.projectMetrics) {
      let riskScore = 0.5; // Neutral baseline

      // Lower risk for established projects with consistent mentions
      if (metrics.totalMentions > 100) {
        riskScore -= 0.1;
      }

      // Lower risk for positive sentiment
      const sentimentRatio = metrics.sentimentDistribution.positive / 
                            (metrics.totalMentions || 1);
      riskScore -= sentimentRatio * 0.2;

      // Higher risk for very high volatility in mentions
      if (metrics.mentionVelocity > 50) {
        riskScore += 0.1;
      }

      // Lower risk for influencer validation
      if (metrics.influencerMentions > 5) {
        riskScore -= 0.1;
      }

      metrics.riskScore = Math.max(0, Math.min(1, riskScore));
    }
  }

  private async cleanupOldData(): Promise<void> {
    const cutoff = new Date(Date.now() - 30 * 24 * 3600000); // 30 days

    // Clean up old adoption signals
    for (const [projectId, signals] of this.adoptionSignals) {
      const filteredSignals = signals.filter(s => s.timestamp >= cutoff);
      this.adoptionSignals.set(projectId, filteredSignals);
    }

    this.logger.debug('Cleaned up old tracking data');
  }

  getStatus(): any {
    return {
      isInitialized: this.isInitialized,
      isRunning: this.isRunning,
      trackedProjectsCount: this.trackedProjects.size,
      trendingProjectsCount: this.trendingProjects.length,
      totalAdoptionSignals: Array.from(this.adoptionSignals.values())
        .reduce((sum, signals) => sum + signals.length, 0),
      config: this.config
    };
  }

  async shutdown(): Promise<void> {
    try {
      this.logger.info('Shutting down DeFAI Project Tracker...');
      
      await this.stop();
      
      // Clear data structures
      this.trackedProjects.clear();
      this.adoptionSignals.clear();
      this.projectMetrics.clear();
      this.trendingProjects.length = 0;
      
      this.removeAllListeners();
      
      this.logger.info('DeFAI Project Tracker shutdown complete');
    } catch (error) {
      this.logger.error('Failed to shutdown DeFAI Project Tracker:', error);
      throw error;
    }
  }
}