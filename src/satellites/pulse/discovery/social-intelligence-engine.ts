/**
 * Social Intelligence Engine
 * Discovers DeFi protocols through social media monitoring and sentiment analysis
 */

import { EventEmitter } from 'events';
import { Logger } from 'winston';
import { createLogger, format, transports } from 'winston';
import { ProtocolDiscovery, DiscoveryMethod, ProtocolStatus } from '../types';
import { getUnifiedAIClient } from '../../../integrations/ai/unified-ai-client';

export interface SocialIntelligenceConfig {
  enableTwitterMonitoring: boolean;
  enableDiscordMonitoring: boolean;
  enableTelegramMonitoring: boolean;
  enableRedditMonitoring: boolean;
  monitoringKeywords: string[];
  sentimentThreshold: number; // 0-1, minimum sentiment for consideration
  minimumMentions: number;
  timeWindow: number; // hours to look back
  influencerWeight: number; // multiplier for posts from influential accounts
}

export interface SocialSignal {
  platform: 'twitter' | 'discord' | 'telegram' | 'reddit' | 'youtube';
  content: string;
  author: string;
  authorFollowers?: number;
  authorInfluenceScore?: number;
  timestamp: Date;
  engagement: {
    likes?: number;
    retweets?: number;
    replies?: number;
    views?: number;
  };
  sentiment: {
    score: number; // -1 to 1
    confidence: number; // 0 to 1
    category: 'positive' | 'negative' | 'neutral';
  };
  extractedData: {
    mentionedProtocols: string[];
    mentionedTokens: string[];
    keywords: string[];
    urls: string[];
  };
}

export interface SocialProtocolData {
  protocolName: string;
  signals: SocialSignal[];
  aggregateMetrics: {
    totalMentions: number;
    averageSentiment: number;
    sentimentTrend: 'increasing' | 'decreasing' | 'stable';
    influencerMentions: number;
    totalEngagement: number;
    platformBreakdown: Record<string, number>;
  };
  keyInfluencers: Array<{
    username: string;
    platform: string;
    followers: number;
    mentionCount: number;
    influence: number;
  }>;
  emergingTopics: string[];
  riskSignals: string[];
}

export class SocialIntelligenceEngine extends EventEmitter {
  private logger: Logger;
  private config: SocialIntelligenceConfig;
  private aiClient = getUnifiedAIClient();
  private isMonitoring: boolean = false;
  private socialSignals: Map<string, SocialSignal[]> = new Map();
  private protocolMentions: Map<string, SocialProtocolData> = new Map();

  // Mock influential accounts for demonstration
  private influentialAccounts = new Map([
    ['twitter', [
      { username: 'defipulse', followers: 150000, influence: 0.9 },
      { username: 'defiprimes', followers: 80000, influence: 0.8 },
      { username: 'tokenterminal', followers: 120000, influence: 0.85 },
      { username: 'delphi_digital', followers: 200000, influence: 0.95 },
      { username: 'messaricrypto', followers: 180000, influence: 0.9 }
    ]],
    ['discord', [
      { username: 'DefiMod_Alpha', followers: 50000, influence: 0.7 },
      { username: 'YieldFarmer_Pro', followers: 30000, influence: 0.6 }
    ]],
    ['reddit', [
      { username: 'DeFi_Analyst', followers: 25000, influence: 0.65 },
      { username: 'CryptoYieldExpert', followers: 40000, influence: 0.75 }
    ]]
  ]);

  private monitoringKeywords = [
    // Protocol discovery keywords
    'new defi protocol', 'launch defi', 'defi platform', 'yield farming',
    'liquidity mining', 'staking rewards', 'defi token', 'tvl milestone',
    'defi integration', 'protocol upgrade', 'mainnet launch', 'testnet',
    
    // Risk-related keywords
    'exploit', 'hack', 'vulnerability', 'audit', 'security', 'rug pull',
    'exit scan', 'warning', 'suspicious', 'investigation',
    
    // Positive signals
    'airdrop', 'partnership', 'integration', 'funding', 'investment',
    'governance', 'community', 'growth', 'expansion', 'milestone'
  ];

  constructor(config: SocialIntelligenceConfig) {
    super();
    this.config = {
      ...config,
      monitoringKeywords: [...config.monitoringKeywords, ...this.monitoringKeywords]
    };
    
    this.logger = createLogger({
      level: 'info',
      format: format.combine(
        format.timestamp(),
        format.simple()
      ),
      transports: [
        new transports.Console(),
        new transports.File({ filename: 'logs/social-intelligence-engine.log' })
      ],
    });
  }

  async initialize(): Promise<void> {
    try {
      this.logger.info('Initializing Social Intelligence Engine...');

      // Initialize social media monitoring
      await this.initializeSocialMonitoring();

      this.logger.info('Social Intelligence Engine initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize Social Intelligence Engine:', error);
      throw error;
    }
  }

  async startMonitoring(): Promise<void> {
    try {
      if (this.isMonitoring) {
        this.logger.warn('Social monitoring is already running');
        return;
      }

      this.logger.info('Starting social media monitoring...');
      this.isMonitoring = true;

      // Start monitoring different platforms
      const monitoringPromises = [];

      if (this.config.enableTwitterMonitoring) {
        monitoringPromises.push(this.monitorTwitter());
      }
      if (this.config.enableDiscordMonitoring) {
        monitoringPromises.push(this.monitorDiscord());
      }
      if (this.config.enableTelegramMonitoring) {
        monitoringPromises.push(this.monitorTelegram());
      }
      if (this.config.enableRedditMonitoring) {
        monitoringPromises.push(this.monitorReddit());
      }

      // Run monitoring for the specified time window
      await Promise.race([
        Promise.all(monitoringPromises),
        this.delay(this.config.timeWindow * 60 * 60 * 1000) // Convert hours to ms
      ]);

      this.logger.info('Social media monitoring completed');
    } catch (error) {
      this.logger.error('Social media monitoring failed:', error);
      throw error;
    }
  }

  async discoverProtocols(): Promise<ProtocolDiscovery[]> {
    try {
      this.logger.info('Starting protocol discovery via social intelligence...');

      // Start monitoring
      await this.startMonitoring();

      // Analyze collected signals
      const protocolAnalyses = await this.analyzeCollectedSignals();

      // Convert to protocol discoveries
      const discoveries: ProtocolDiscovery[] = [];
      
      for (const analysis of protocolAnalyses) {
        const discovery = await this.convertToProtocolDiscovery(analysis);
        if (discovery) {
          discoveries.push(discovery);
        }
      }

      // Filter and rank by social metrics
      const rankedDiscoveries = this.rankBySocialMetrics(discoveries);

      this.logger.info('Social intelligence discovery completed', {
        discoveredCount: discoveries.length,
        rankedCount: rankedDiscoveries.length
      });

      return rankedDiscoveries;

    } catch (error) {
      this.logger.error('Social intelligence protocol discovery failed:', error);
      throw error;
    }
  }

  private async initializeSocialMonitoring(): Promise<void> {
    // Initialize monitoring connections and API clients
    // In production, would set up actual social media API connections
    this.logger.info('Social monitoring connections initialized');
  }

  private async monitorTwitter(): Promise<void> {
    try {
      this.logger.debug('Starting Twitter monitoring...');

      // Mock Twitter monitoring - in production would use Twitter API
      const twitterSignals = await this.generateMockTwitterSignals();
      
      for (const signal of twitterSignals) {
        await this.processSocialSignal(signal);
      }

      this.logger.debug('Twitter monitoring completed', {
        signalsProcessed: twitterSignals.length
      });
    } catch (error) {
      this.logger.error('Twitter monitoring failed:', error);
    }
  }

  private async monitorDiscord(): Promise<void> {
    try {
      this.logger.debug('Starting Discord monitoring...');

      // Mock Discord monitoring
      const discordSignals = await this.generateMockDiscordSignals();
      
      for (const signal of discordSignals) {
        await this.processSocialSignal(signal);
      }

      this.logger.debug('Discord monitoring completed', {
        signalsProcessed: discordSignals.length
      });
    } catch (error) {
      this.logger.error('Discord monitoring failed:', error);
    }
  }

  private async monitorTelegram(): Promise<void> {
    try {
      this.logger.debug('Starting Telegram monitoring...');

      // Mock Telegram monitoring
      const telegramSignals = await this.generateMockTelegramSignals();
      
      for (const signal of telegramSignals) {
        await this.processSocialSignal(signal);
      }

      this.logger.debug('Telegram monitoring completed', {
        signalsProcessed: telegramSignals.length
      });
    } catch (error) {
      this.logger.error('Telegram monitoring failed:', error);
    }
  }

  private async monitorReddit(): Promise<void> {
    try {
      this.logger.debug('Starting Reddit monitoring...');

      // Mock Reddit monitoring
      const redditSignals = await this.generateMockRedditSignals();
      
      for (const signal of redditSignals) {
        await this.processSocialSignal(signal);
      }

      this.logger.debug('Reddit monitoring completed', {
        signalsProcessed: redditSignals.length
      });
    } catch (error) {
      this.logger.error('Reddit monitoring failed:', error);
    }
  }

  private async generateMockTwitterSignals(): Promise<SocialSignal[]> {
    const signals: SocialSignal[] = [];
    const twitterAccounts = this.influentialAccounts.get('twitter') || [];
    
    const protocols = [
      'YieldVault Protocol', 'LiquidFarm DAO', 'StakeMax Finance', 
      'DefiYield Pro', 'AutoStake Protocol', 'RewardsFarm Plus'
    ];

    for (let i = 0; i < 15; i++) {
      const account = twitterAccounts[Math.floor(Math.random() * twitterAccounts.length)];
      const protocol = protocols[Math.floor(Math.random() * protocols.length)];
      
      const contents = [
        `Just discovered ${protocol} - their yield optimization looks promising! 🚀 #DeFi #YieldFarming`,
        `${protocol} launched on mainnet today with 45% APY on stablecoin pairs. DYOR but looking interesting 👀`,
        `New audit results for ${protocol} look solid. No critical findings, launching next week #DeFiSafety`,
        `${protocol} TVL just hit $10M milestone! Community growth has been incredible 📈`,
        `Interesting tokenomics model from ${protocol}. Sustainable yield through real revenue streams`,
        `Warning: Some concerning activity around ${protocol}. Wait for more info before aping in ⚠️`
      ];

      const content = contents[Math.floor(Math.random() * contents.length)];
      const sentiment = await this.analyzeSentiment(content);

      signals.push({
        platform: 'twitter',
        content,
        author: account.username,
        authorFollowers: account.followers,
        authorInfluenceScore: account.influence,
        timestamp: new Date(Date.now() - Math.random() * this.config.timeWindow * 60 * 60 * 1000),
        engagement: {
          likes: Math.floor(Math.random() * 100) + 10,
          retweets: Math.floor(Math.random() * 50) + 5,
          replies: Math.floor(Math.random() * 30) + 2,
          views: Math.floor(Math.random() * 1000) + 100
        },
        sentiment,
        extractedData: {
          mentionedProtocols: [protocol],
          mentionedTokens: this.extractTokens(content),
          keywords: this.extractKeywords(content),
          urls: []
        }
      });
    }

    return signals;
  }

  private async generateMockDiscordSignals(): Promise<SocialSignal[]> {
    const signals: SocialSignal[] = [];
    const discordAccounts = this.influentialAccounts.get('discord') || [];
    
    const protocols = [
      'AlphaYield Protocol', 'BetaStake DAO', 'GammaFarm Finance', 
      'DeltaLiquidity Pro', 'EpsilonRewards Protocol'
    ];

    for (let i = 0; i < 10; i++) {
      const account = discordAccounts[Math.floor(Math.random() * discordAccounts.length)];
      const protocol = protocols[Math.floor(Math.random() * protocols.length)];
      
      const contents = [
        `Has anyone looked into ${protocol}? Their docs mention some innovative yield strategies`,
        `${protocol} team is very active in their Discord. Good sign for long-term commitment`,
        `Be careful with ${protocol} - their tokenomics seem unsustainable to me`,
        `${protocol} airdrop confirmed for early users! 🪂`,
        `${protocol} integrating with major DEX aggregators next month`
      ];

      const content = contents[Math.floor(Math.random() * contents.length)];
      const sentiment = await this.analyzeSentiment(content);

      signals.push({
        platform: 'discord',
        content,
        author: account.username,
        authorFollowers: account.followers,
        authorInfluenceScore: account.influence,
        timestamp: new Date(Date.now() - Math.random() * this.config.timeWindow * 60 * 60 * 1000),
        engagement: {
          replies: Math.floor(Math.random() * 15) + 2,
          views: Math.floor(Math.random() * 200) + 50
        },
        sentiment,
        extractedData: {
          mentionedProtocols: [protocol],
          mentionedTokens: this.extractTokens(content),
          keywords: this.extractKeywords(content),
          urls: []
        }
      });
    }

    return signals;
  }

  private async generateMockTelegramSignals(): Promise<SocialSignal[]> {
    const signals: SocialSignal[] = [];
    
    const protocols = [
      'ZetaYield Protocol', 'EtaFarm DAO', 'ThetaStake Finance', 
      'IotaLiquidity Pro', 'KappaRewards Protocol'
    ];

    for (let i = 0; i < 8; i++) {
      const protocol = protocols[Math.floor(Math.random() * protocols.length)];
      
      const contents = [
        `🔥 ${protocol} going live tomorrow with 60% APY on ETH-USDC LP`,
        `${protocol} team AMA happening now in their channel`,
        `Major partnership announcement for ${protocol} coming this week`,
        `⚠️ Developers dumping ${protocol} tokens, be careful`,
        `${protocol} audit report published - looking good so far`
      ];

      const content = contents[Math.floor(Math.random() * contents.length)];
      const sentiment = await this.analyzeSentiment(content);

      signals.push({
        platform: 'telegram',
        content,
        author: `user_${Math.floor(Math.random() * 1000)}`,
        timestamp: new Date(Date.now() - Math.random() * this.config.timeWindow * 60 * 60 * 1000),
        engagement: {
          views: Math.floor(Math.random() * 500) + 100
        },
        sentiment,
        extractedData: {
          mentionedProtocols: [protocol],
          mentionedTokens: this.extractTokens(content),
          keywords: this.extractKeywords(content),
          urls: []
        }
      });
    }

    return signals;
  }

  private async generateMockRedditSignals(): Promise<SocialSignal[]> {
    const signals: SocialSignal[] = [];
    const redditAccounts = this.influentialAccounts.get('reddit') || [];
    
    const protocols = [
      'LambdaYield Protocol', 'MuFarm DAO', 'NuStake Finance', 
      'XiLiquidity Pro', 'OmicronRewards Protocol'
    ];

    for (let i = 0; i < 12; i++) {
      const account = redditAccounts[Math.floor(Math.random() * redditAccounts.length)];
      const protocol = protocols[Math.floor(Math.random() * protocols.length)];
      
      const contents = [
        `Deep dive analysis of ${protocol} - comprehensive review of tokenomics and yield mechanisms`,
        `${protocol} seems too good to be true. Anyone else getting Ponzi vibes?`,
        `${protocol} team delivered on roadmap promises. Bullish on long-term potential`,
        `PSA: ${protocol} contract has been exploited. Do not interact until further notice`,
        `${protocol} governance proposal to increase yield caps passed with 87% approval`
      ];

      const content = contents[Math.floor(Math.random() * contents.length)];
      const sentiment = await this.analyzeSentiment(content);

      signals.push({
        platform: 'reddit',
        content,
        author: account.username,
        authorFollowers: account.followers,
        authorInfluenceScore: account.influence,
        timestamp: new Date(Date.now() - Math.random() * this.config.timeWindow * 60 * 60 * 1000),
        engagement: {
          likes: Math.floor(Math.random() * 50) + 5,
          replies: Math.floor(Math.random() * 25) + 3,
          views: Math.floor(Math.random() * 300) + 100
        },
        sentiment,
        extractedData: {
          mentionedProtocols: [protocol],
          mentionedTokens: this.extractTokens(content),
          keywords: this.extractKeywords(content),
          urls: []
        }
      });
    }

    return signals;
  }

  private async processSocialSignal(signal: SocialSignal): Promise<void> {
    try {
      // Store signal
      const platformSignals = this.socialSignals.get(signal.platform) || [];
      platformSignals.push(signal);
      this.socialSignals.set(signal.platform, platformSignals);

      // Process mentioned protocols
      for (const protocolName of signal.extractedData.mentionedProtocols) {
        await this.updateProtocolMentions(protocolName, signal);
      }

      // Emit signal processed event
      this.emit('social_signal_processed', {
        type: 'social_signal',
        data: signal,
        timestamp: new Date()
      });

    } catch (error) {
      this.logger.error('Failed to process social signal:', error);
    }
  }

  private async updateProtocolMentions(protocolName: string, signal: SocialSignal): Promise<void> {
    let protocolData = this.protocolMentions.get(protocolName);
    
    if (!protocolData) {
      protocolData = {
        protocolName,
        signals: [],
        aggregateMetrics: {
          totalMentions: 0,
          averageSentiment: 0,
          sentimentTrend: 'stable',
          influencerMentions: 0,
          totalEngagement: 0,
          platformBreakdown: {}
        },
        keyInfluencers: [],
        emergingTopics: [],
        riskSignals: []
      };
    }

    // Add signal
    protocolData.signals.push(signal);

    // Update aggregate metrics
    protocolData.aggregateMetrics.totalMentions++;
    
    if (signal.authorInfluenceScore && signal.authorInfluenceScore > 0.7) {
      protocolData.aggregateMetrics.influencerMentions++;
    }

    const engagement = Object.values(signal.engagement).reduce((sum, val) => sum + (val || 0), 0);
    protocolData.aggregateMetrics.totalEngagement += engagement;

    protocolData.aggregateMetrics.platformBreakdown[signal.platform] = 
      (protocolData.aggregateMetrics.platformBreakdown[signal.platform] || 0) + 1;

    // Recalculate average sentiment
    const totalSentiment = protocolData.signals.reduce((sum, s) => sum + s.sentiment.score, 0);
    protocolData.aggregateMetrics.averageSentiment = totalSentiment / protocolData.signals.length;

    // Update risk signals
    if (signal.sentiment.score < -0.5 || this.containsRiskKeywords(signal.content)) {
      protocolData.riskSignals.push(signal.content.substring(0, 100));
    }

    this.protocolMentions.set(protocolName, protocolData);
  }

  private async analyzeCollectedSignals(): Promise<SocialProtocolData[]> {
    const analyses: SocialProtocolData[] = [];

    for (const [protocolName, data] of this.protocolMentions) {
      // Filter by minimum mentions threshold
      if (data.aggregateMetrics.totalMentions < this.config.minimumMentions) {
        continue;
      }

      // Filter by sentiment threshold
      if (data.aggregateMetrics.averageSentiment < this.config.sentimentThreshold) {
        continue;
      }

      // Calculate sentiment trend
      data.aggregateMetrics.sentimentTrend = this.calculateSentimentTrend(data.signals);

      // Identify key influencers
      data.keyInfluencers = this.identifyKeyInfluencers(data.signals);

      // Extract emerging topics
      data.emergingTopics = await this.extractEmergingTopics(data.signals);

      analyses.push(data);
    }

    return analyses.sort((a, b) => 
      b.aggregateMetrics.totalMentions - a.aggregateMetrics.totalMentions
    );
  }

  private async convertToProtocolDiscovery(data: SocialProtocolData): Promise<ProtocolDiscovery | null> {
    try {
      // Use AI to analyze social data and create protocol discovery
      const aiAnalysis = await this.performSocialAIAnalysis(data);

      const discovery: ProtocolDiscovery = {
        id: `social-${data.protocolName.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`,
        name: data.protocolName,
        description: aiAnalysis?.description || `DeFi protocol discovered through social intelligence`,
        website: aiAnalysis?.website || `https://${data.protocolName.toLowerCase().replace(/\s+/g, '')}.finance`,
        documentation: '',
        github: '',
        audit: [],
        tvl: aiAnalysis?.estimatedTvl || 0,
        yields: {
          current: aiAnalysis?.estimatedApy || 0,
          average30d: (aiAnalysis?.estimatedApy || 0) * 0.9,
          max30d: (aiAnalysis?.estimatedApy || 0) * 1.2,
          min30d: (aiAnalysis?.estimatedApy || 0) * 0.8,
          volatility: 0.3,
          consistency: Math.max(0.3, data.aggregateMetrics.averageSentiment)
        },
        risk: {
          overall: Math.max(0.1, 1 - data.aggregateMetrics.averageSentiment),
          smartContract: 0.5,
          economic: 0.4,
          governance: 0.3,
          liquidity: 0.4,
          centralization: 0.5,
          factors: data.riskSignals.length > 0 ? 
            ['Social media warnings', 'Community concerns'] : 
            ['Early stage protocol', 'Limited social validation']
        },
        discovery: {
          discoveredAt: new Date(),
          method: DiscoveryMethod.SOCIAL_LISTENING,
          confidence: this.calculateSocialConfidence(data),
          verified: false
        },
        integration: {
          difficulty: 'medium',
          timeEstimate: 20,
          dependencies: [],
          apiAvailable: false
        },
        status: ProtocolStatus.DISCOVERED
      };

      return discovery;

    } catch (error) {
      this.logger.error('Failed to convert social data to protocol discovery:', error);
      return null;
    }
  }

  private async performSocialAIAnalysis(data: SocialProtocolData): Promise<any> {
    try {
      const recentSignals = data.signals.slice(-5); // Last 5 signals
      const signalTexts = recentSignals.map(s => s.content).join('\n');

      const prompt = `Analyze this DeFi protocol based on social media signals:

Protocol: ${data.protocolName}
Total Mentions: ${data.aggregateMetrics.totalMentions}
Average Sentiment: ${data.aggregateMetrics.averageSentiment.toFixed(2)}
Influencer Mentions: ${data.aggregateMetrics.influencerMentions}

Recent Social Signals:
${signalTexts}

Risk Signals: ${data.riskSignals.join('; ')}

Provide analysis in JSON:
{
  "description": "brief protocol description",
  "estimatedTvl": 1000000,
  "estimatedApy": 0.XX,
  "website": "https://protocol.com",
  "socialRisk": 0.XX,
  "legitimacyScore": 0.XX,
  "analysis": "social sentiment analysis"
}`;

      const result = await this.aiClient.generateText({
        prompt,
        maxTokens: 600,
        temperature: 0.3,
        systemPrompt: 'You are a social media analyst specializing in DeFi protocol discovery and sentiment analysis.'
      });

      if (result.success && result.data?.text) {
        try {
          return JSON.parse(result.data.text);
        } catch (parseError) {
          this.logger.debug('Failed to parse social AI analysis:', parseError);
        }
      }
    } catch (error) {
      this.logger.debug('Social AI analysis failed:', error);
    }

    return null;
  }

  private async analyzeSentiment(content: string): Promise<{ score: number; confidence: number; category: 'positive' | 'negative' | 'neutral' }> {
    // Mock sentiment analysis - in production would use actual NLP
    const positiveKeywords = ['good', 'great', 'excellent', 'promising', 'bullish', '🚀', '📈', 'solid', 'strong'];
    const negativeKeywords = ['bad', 'terrible', 'scam', 'rug', 'warning', '⚠️', 'careful', 'suspicious', 'dump'];
    
    const lowerContent = content.toLowerCase();
    let score = 0;
    
    for (const keyword of positiveKeywords) {
      if (lowerContent.includes(keyword)) score += 0.2;
    }
    
    for (const keyword of negativeKeywords) {
      if (lowerContent.includes(keyword)) score -= 0.3;
    }
    
    score = Math.max(-1, Math.min(1, score));
    const confidence = 0.6 + Math.random() * 0.3;
    
    let category: 'positive' | 'negative' | 'neutral' = 'neutral';
    if (score > 0.2) category = 'positive';
    else if (score < -0.2) category = 'negative';
    
    return { score, confidence, category };
  }

  private extractTokens(content: string): string[] {
    const tokenPattern = /\$[A-Z]{2,10}/g;
    const matches = content.match(tokenPattern) || [];
    return matches.map(token => token.substring(1));
  }

  private extractKeywords(content: string): string[] {
    const keywords = [];
    const lowerContent = content.toLowerCase();
    
    for (const keyword of this.config.monitoringKeywords) {
      if (lowerContent.includes(keyword.toLowerCase())) {
        keywords.push(keyword);
      }
    }
    
    return keywords;
  }

  private containsRiskKeywords(content: string): boolean {
    const riskKeywords = ['exploit', 'hack', 'vulnerability', 'rug pull', 'scam', 'warning', 'careful', 'suspicious'];
    const lowerContent = content.toLowerCase();
    return riskKeywords.some(keyword => lowerContent.includes(keyword));
  }

  private calculateSentimentTrend(signals: SocialSignal[]): 'increasing' | 'decreasing' | 'stable' {
    if (signals.length < 5) return 'stable';
    
    const recent = signals.slice(-5).map(s => s.sentiment.score);
    const older = signals.slice(-10, -5).map(s => s.sentiment.score);
    
    const recentAvg = recent.reduce((sum, score) => sum + score, 0) / recent.length;
    const olderAvg = older.reduce((sum, score) => sum + score, 0) / older.length;
    
    const difference = recentAvg - olderAvg;
    
    if (difference > 0.1) return 'increasing';
    if (difference < -0.1) return 'decreasing';
    return 'stable';
  }

  private identifyKeyInfluencers(signals: SocialSignal[]): Array<{ username: string; platform: string; followers: number; mentionCount: number; influence: number }> {
    const influencerMap = new Map();
    
    for (const signal of signals) {
      if (!signal.authorInfluenceScore || signal.authorInfluenceScore < 0.5) continue;
      
      const key = `${signal.platform}-${signal.author}`;
      if (influencerMap.has(key)) {
        influencerMap.get(key).mentionCount++;
      } else {
        influencerMap.set(key, {
          username: signal.author,
          platform: signal.platform,
          followers: signal.authorFollowers || 0,
          mentionCount: 1,
          influence: signal.authorInfluenceScore
        });
      }
    }
    
    return Array.from(influencerMap.values())
      .sort((a, b) => b.influence - a.influence)
      .slice(0, 5);
  }

  private async extractEmergingTopics(signals: SocialSignal[]): Promise<string[]> {
    const keywordCounts = new Map();
    
    for (const signal of signals) {
      for (const keyword of signal.extractedData.keywords) {
        keywordCounts.set(keyword, (keywordCounts.get(keyword) || 0) + 1);
      }
    }
    
    return Array.from(keywordCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([keyword]) => keyword);
  }

  private calculateSocialConfidence(data: SocialProtocolData): number {
    let confidence = 0.3; // Base confidence
    
    // More mentions = higher confidence
    confidence += Math.min(data.aggregateMetrics.totalMentions / 50, 0.3);
    
    // Positive sentiment = higher confidence
    confidence += Math.max(0, data.aggregateMetrics.averageSentiment * 0.2);
    
    // Influencer mentions boost confidence
    confidence += Math.min(data.aggregateMetrics.influencerMentions / 10, 0.2);
    
    // Multiple platforms = higher confidence
    const platformCount = Object.keys(data.aggregateMetrics.platformBreakdown).length;
    confidence += Math.min(platformCount / 4, 0.1);
    
    // Risk signals reduce confidence
    confidence -= Math.min(data.riskSignals.length / 10, 0.2);
    
    return Math.max(0.1, Math.min(0.9, confidence));
  }

  private rankBySocialMetrics(discoveries: ProtocolDiscovery[]): ProtocolDiscovery[] {
    return discoveries.sort((a, b) => {
      // Primary: Social confidence
      const confidenceScore = b.discovery.confidence - a.discovery.confidence;
      
      // Secondary: Risk-adjusted sentiment
      const aRiskAdjusted = (1 - a.risk.overall) * a.discovery.confidence;
      const bRiskAdjusted = (1 - b.risk.overall) * b.discovery.confidence;
      const riskScore = bRiskAdjusted - aRiskAdjusted;
      
      return (confidenceScore * 0.6) + (riskScore * 0.4);
    });
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getStatus(): any {
    return {
      isMonitoring: this.isMonitoring,
      totalSignals: Array.from(this.socialSignals.values()).reduce((sum, signals) => sum + signals.length, 0),
      protocolMentions: this.protocolMentions.size,
      platformBreakdown: Object.fromEntries(
        Array.from(this.socialSignals.entries()).map(([platform, signals]) => [platform, signals.length])
      )
    };
  }

  async shutdown(): Promise<void> {
    this.logger.info('Shutting down Social Intelligence Engine...');
    this.isMonitoring = false;
    this.socialSignals.clear();
    this.protocolMentions.clear();
    this.logger.info('Social Intelligence Engine shutdown complete');
  }
}