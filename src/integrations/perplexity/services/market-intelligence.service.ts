/**
 * Market Intelligence Service
 * Handles market sentiment, analyst ratings, and trend analysis
 */

import { EventEmitter } from 'events';
import { 
  MarketIntelligence,
  MarketSentiment,
  AnalystRatings,
  NewsAnalysis,
  TrendAnalysis,
  CompetitiveAnalysis,
  PerplexityRequest,
  PerplexityResponse,
  SentimentSource,
  RatingChange,
  NewsStory,
  ImpactEvent,
  AssetCorrelation,
  PeerComparison
} from '../types';
import { PerplexityClient } from '../client/perplexity-client';
import Logger from '@/shared/logging/logger';

const logger = Logger.getLogger('market-intelligence-service');

export interface MarketIntelligenceQuery {
  assetId: string;
  assetType: 'stock' | 'crypto' | 'commodity' | 'rwa';
  assetName?: string;
  includeSentiment?: boolean;
  includeAnalystRatings?: boolean;
  includeNews?: boolean;
  includeTrends?: boolean;
  includeCompetitive?: boolean;
  competitors?: string[];
  timeframe?: 'day' | 'week' | 'month' | 'quarter' | 'year';
}

export interface SentimentAnalysisRequest {
  text: string;
  context?: string;
  assetType?: string;
}

export class MarketIntelligenceService extends EventEmitter {
  private client: PerplexityClient;

  constructor(client: PerplexityClient) {
    super();
    this.client = client;
  }

  async getMarketIntelligence(query: MarketIntelligenceQuery): Promise<MarketIntelligence> {
    try {
      logger.info('Fetching market intelligence', query);

      const intelligence: MarketIntelligence = {
        id: `mi-${query.assetId}-${Date.now()}`,
        timestamp: new Date(),
        assetId: query.assetId,
        assetType: query.assetType,
        sentiment: await this.getMarketSentiment(query),
        analystRatings: query.includeAnalystRatings ? 
          await this.getAnalystRatings(query) : undefined,
        newsAnalysis: query.includeNews ? 
          await this.getNewsAnalysis(query) : undefined,
        trendAnalysis: query.includeTrends ? 
          await this.getTrendAnalysis(query) : undefined,
        competitiveAnalysis: query.includeCompetitive && query.competitors ? 
          await this.getCompetitiveAnalysis(query) : undefined
      };

      logger.info('Market intelligence retrieved', { 
        assetId: query.assetId,
        components: {
          sentiment: true,
          analystRatings: !!intelligence.analystRatings,
          newsAnalysis: !!intelligence.newsAnalysis,
          trendAnalysis: !!intelligence.trendAnalysis,
          competitiveAnalysis: !!intelligence.competitiveAnalysis
        }
      });

      this.emit('intelligence-ready', intelligence);
      return intelligence;
    } catch (error) {
      logger.error('Failed to fetch market intelligence:', error);
      throw error;
    }
  }

  async getMarketSentiment(query: MarketIntelligenceQuery): Promise<MarketSentiment> {
    try {
      const request: PerplexityRequest = {
        model: 'sonar-medium-chat',
        messages: [
          {
            role: 'system',
            content: 'You are a market sentiment analyst. Provide accurate sentiment analysis based on current market data.'
          },
          {
            role: 'user',
            content: this.buildSentimentPrompt(query)
          }
        ],
        max_tokens: 2000,
        temperature: 0.1,
        return_citations: true,
        search_recency_filter: this.getRecencyFilter(query.timeframe)
      };

      const response = await this.client.chat(request);
      return this.parseSentimentResponse(response, query);
    } catch (error) {
      logger.error('Failed to analyze market sentiment:', error);
      throw error;
    }
  }

  private buildSentimentPrompt(query: MarketIntelligenceQuery): string {
    const assetIdentifier = query.assetName || query.assetId;
    const timeframeText = query.timeframe || 'recent';

    return `Analyze market sentiment for ${assetIdentifier} (${query.assetType}) over the ${timeframeText} period.
    
    Provide:
    1. Overall sentiment score (-1 to 1, where -1 is extremely bearish, 0 is neutral, 1 is extremely bullish)
    2. Breakdown of sentiment: % bullish, % bearish, % neutral
    3. Confidence level in the analysis (0 to 1)
    4. Key sentiment sources and their individual contributions:
       - News media sentiment
       - Social media sentiment
       - Analyst sentiment
       - Insider activity sentiment
    5. Notable events or factors driving current sentiment
    6. Sentiment trend (improving, deteriorating, stable)
    
    Base analysis on actual market data, news, and credible sources.`;
  }

  private parseSentimentResponse(
    response: PerplexityResponse,
    query: MarketIntelligenceQuery
  ): MarketSentiment {
    const content = response.choices[0]?.message?.content || '';

    // Extract sentiment scores
    const overallMatch = content.match(/Overall sentiment.*?(-?\d*\.?\d+)/i);
    const bullishMatch = content.match(/Bullish.*?(\d+\.?\d*)%/i);
    const bearishMatch = content.match(/Bearish.*?(\d+\.?\d*)%/i);
    const neutralMatch = content.match(/Neutral.*?(\d+\.?\d*)%/i);
    const confidenceMatch = content.match(/Confidence.*?(\d*\.?\d+)/i);

    const overall = overallMatch ? parseFloat(overallMatch[1]) : 0;
    const bullish = bullishMatch ? parseFloat(bullishMatch[1]) / 100 : 0.33;
    const bearish = bearishMatch ? parseFloat(bearishMatch[1]) / 100 : 0.33;
    const neutral = neutralMatch ? parseFloat(neutralMatch[1]) / 100 : 0.34;
    const confidence = confidenceMatch ? parseFloat(confidenceMatch[1]) : 0.7;

    // Extract sentiment sources
    const sources = this.extractSentimentSources(content);

    return {
      overall: Math.max(-1, Math.min(1, overall)),
      bullish: Math.max(0, Math.min(1, bullish)),
      bearish: Math.max(0, Math.min(1, bearish)),
      neutral: Math.max(0, Math.min(1, neutral)),
      confidence: Math.max(0, Math.min(1, confidence)),
      sources
    };
  }

  private extractSentimentSources(content: string): SentimentSource[] {
    const sources: SentimentSource[] = [];
    
    // Extract news sentiment
    const newsMatch = content.match(/News.*?sentiment.*?(-?\d*\.?\d+)/i);
    if (newsMatch) {
      sources.push({
        type: 'news',
        name: 'News Media',
        sentiment: parseFloat(newsMatch[1]),
        weight: 0.3,
        timestamp: new Date()
      });
    }

    // Extract social sentiment
    const socialMatch = content.match(/Social.*?sentiment.*?(-?\d*\.?\d+)/i);
    if (socialMatch) {
      sources.push({
        type: 'social',
        name: 'Social Media',
        sentiment: parseFloat(socialMatch[1]),
        weight: 0.2,
        timestamp: new Date()
      });
    }

    // Extract analyst sentiment
    const analystMatch = content.match(/Analyst.*?sentiment.*?(-?\d*\.?\d+)/i);
    if (analystMatch) {
      sources.push({
        type: 'analyst',
        name: 'Analyst Reports',
        sentiment: parseFloat(analystMatch[1]),
        weight: 0.4,
        timestamp: new Date()
      });
    }

    // Extract insider sentiment
    const insiderMatch = content.match(/Insider.*?sentiment.*?(-?\d*\.?\d+)/i);
    if (insiderMatch) {
      sources.push({
        type: 'insider',
        name: 'Insider Activity',
        sentiment: parseFloat(insiderMatch[1]),
        weight: 0.1,
        timestamp: new Date()
      });
    }

    // If no sources found, create default
    if (sources.length === 0) {
      sources.push({
        type: 'news',
        name: 'Market Consensus',
        sentiment: 0,
        weight: 1,
        timestamp: new Date()
      });
    }

    return sources;
  }

  async getAnalystRatings(query: MarketIntelligenceQuery): Promise<AnalystRatings> {
    try {
      const request: PerplexityRequest = {
        model: 'sonar-medium-chat',
        messages: [
          {
            role: 'system',
            content: 'You are a financial analyst aggregator. Provide accurate analyst ratings and price targets.'
          },
          {
            role: 'user',
            content: this.buildAnalystRatingsPrompt(query)
          }
        ],
        max_tokens: 2000,
        temperature: 0.1,
        return_citations: true,
        search_recency_filter: 'month'
      };

      const response = await this.client.chat(request);
      return this.parseAnalystRatings(response);
    } catch (error) {
      logger.error('Failed to fetch analyst ratings:', error);
      throw error;
    }
  }

  private buildAnalystRatingsPrompt(query: MarketIntelligenceQuery): string {
    const assetIdentifier = query.assetName || query.assetId;

    return `Provide current analyst ratings and price targets for ${assetIdentifier} (${query.assetType}).
    
    Include:
    1. Consensus rating (strong buy, buy, hold, sell, strong sell)
    2. Average price target
    3. Highest price target
    4. Lowest price target
    5. Number of analysts covering
    6. Recent rating changes (last 30 days):
       - Analyst name and firm
       - Previous vs new rating
       - Previous vs new price target
       - Date of change
       - Key rationale
    7. Distribution of current ratings
    
    Only include data from reputable financial analysts and institutions.`;
  }

  private parseAnalystRatings(response: PerplexityResponse): AnalystRatings {
    const content = response.choices[0]?.message?.content || '';

    // Extract consensus and targets
    const consensusMatch = content.match(/Consensus.*?(strong.?buy|buy|hold|sell|strong.?sell)/i);
    const avgTargetMatch = content.match(/Average.*?target.*?\$?([\d,]+\.?\d*)/i);
    const highTargetMatch = content.match(/High(?:est)?.*?target.*?\$?([\d,]+\.?\d*)/i);
    const lowTargetMatch = content.match(/Low(?:est)?.*?target.*?\$?([\d,]+\.?\d*)/i);
    const analystCountMatch = content.match(/(\d+)\s*analysts?/i);

    const ratings: AnalystRatings = {
      consensus: this.normalizeConsensusRating(consensusMatch ? consensusMatch[1] : 'hold'),
      averageTarget: avgTargetMatch ? parseFloat(avgTargetMatch[1].replace(/,/g, '')) : 0,
      highTarget: highTargetMatch ? parseFloat(highTargetMatch[1].replace(/,/g, '')) : 0,
      lowTarget: lowTargetMatch ? parseFloat(lowTargetMatch[1].replace(/,/g, '')) : 0,
      numberOfAnalysts: analystCountMatch ? parseInt(analystCountMatch[1]) : 0,
      recentChanges: this.extractRatingChanges(content)
    };

    return ratings;
  }

  private normalizeConsensusRating(rating: string): AnalystRatings['consensus'] {
    const normalized = rating.toLowerCase().replace(/[\s-]/g, '');
    if (normalized.includes('strongbuy')) return 'strong-buy';
    if (normalized.includes('strongsell')) return 'strong-sell';
    if (normalized.includes('buy')) return 'buy';
    if (normalized.includes('sell')) return 'sell';
    return 'hold';
  }

  private extractRatingChanges(content: string): RatingChange[] {
    const changes: RatingChange[] = [];
    
    // Pattern to match rating changes
    const changePattern = /(?:Analyst|Firm):\s*([^,\n]+).*?(?:from|previous):\s*(\w+).*?(?:to|new):\s*(\w+).*?(?:target|price).*?\$?([\d,]+\.?\d*).*?(?:date|on):\s*([^\n]+)/gi;
    
    let match;
    while ((match = changePattern.exec(content)) !== null) {
      changes.push({
        analyst: match[1].trim(),
        firm: '', // Would need more complex parsing
        previousRating: match[2],
        newRating: match[3],
        newTarget: parseFloat(match[4].replace(/,/g, '')),
        date: new Date(match[5]),
        rationale: '' // Would need additional parsing
      });
    }

    return changes;
  }

  async getNewsAnalysis(query: MarketIntelligenceQuery): Promise<NewsAnalysis> {
    try {
      const request: PerplexityRequest = {
        model: 'sonar-medium-chat',
        messages: [
          {
            role: 'system',
            content: 'You are a financial news analyst. Provide comprehensive news analysis.'
          },
          {
            role: 'user',
            content: this.buildNewsAnalysisPrompt(query)
          }
        ],
        max_tokens: 3000,
        temperature: 0.1,
        return_citations: true,
        search_recency_filter: this.getRecencyFilter(query.timeframe)
      };

      const response = await this.client.chat(request);
      return this.parseNewsAnalysis(response, query);
    } catch (error) {
      logger.error('Failed to analyze news:', error);
      throw error;
    }
  }

  private buildNewsAnalysisPrompt(query: MarketIntelligenceQuery): string {
    const assetIdentifier = query.assetName || query.assetId;
    const timeframe = query.timeframe || 'week';

    return `Analyze news coverage for ${assetIdentifier} (${query.assetType}) over the past ${timeframe}.
    
    Provide:
    1. Top 5 most impactful news stories:
       - Headline
       - Summary (2-3 sentences)
       - Source and publication date
       - Sentiment impact (-1 to 1)
       - Relevance score (0 to 1)
    2. Key themes in news coverage
    3. Potential market impact events:
       - Event description
       - Expected impact (positive/negative/neutral)
       - Probability of occurrence (0 to 1)
       - Timeframe
    4. Overall media attention level (0 to 1)
    
    Focus on credible financial news sources and verified information.`;
  }

  private parseNewsAnalysis(
    response: PerplexityResponse,
    query: MarketIntelligenceQuery
  ): NewsAnalysis {
    const content = response.choices[0]?.message?.content || '';

    return {
      topStories: this.extractNewsStories(content, response.citations),
      keyThemes: this.extractKeyThemes(content),
      impactEvents: this.extractImpactEvents(content),
      mediaAttention: this.extractMediaAttention(content)
    };
  }

  private extractNewsStories(content: string, citations?: any[]): NewsStory[] {
    const stories: NewsStory[] = [];
    
    // Extract story sections
    const storyPattern = /Story \d+:|News \d+:|(?:^|\n)(\d+)\./gm;
    const sections = content.split(storyPattern).filter(s => s.trim());

    sections.forEach((section, index) => {
      const headlineMatch = section.match(/Headline:\s*([^\n]+)/i);
      const summaryMatch = section.match(/Summary:\s*([^\n]+(?:\n(?!^\w+:).*)*)/im);
      const sourceMatch = section.match(/Source:\s*([^\n]+)/i);
      const sentimentMatch = section.match(/Sentiment.*?(-?\d*\.?\d+)/i);
      const relevanceMatch = section.match(/Relevance.*?(\d*\.?\d+)/i);

      if (headlineMatch) {
        stories.push({
          id: `news-${Date.now()}-${index}`,
          headline: headlineMatch[1].trim(),
          summary: summaryMatch ? summaryMatch[1].trim() : '',
          source: sourceMatch ? sourceMatch[1].trim() : 'Unknown',
          url: citations && citations[index] ? citations[index].url : '',
          publishedAt: new Date(), // Would need date parsing
          sentiment: sentimentMatch ? parseFloat(sentimentMatch[1]) : 0,
          relevance: relevanceMatch ? parseFloat(relevanceMatch[1]) : 0.5,
          entities: [query.assetId]
        });
      }
    });

    return stories.slice(0, 5); // Top 5 stories
  }

  private extractKeyThemes(content: string): string[] {
    const themesMatch = content.match(/Key themes?:?\s*([^\n]+(?:\n(?!^\w+:).*)*)/im);
    if (!themesMatch) return [];

    return themesMatch[1]
      .split(/[•\-\n]/)
      .map(theme => theme.trim())
      .filter(theme => theme.length > 5);
  }

  private extractImpactEvents(content: string): ImpactEvent[] {
    const events: ImpactEvent[] = [];
    
    const eventSections = content.match(/Impact Event.*?(?=Impact Event|$)/gis) || [];
    
    eventSections.forEach(section => {
      const descMatch = section.match(/Description:\s*([^\n]+)/i);
      const impactMatch = section.match(/Impact:\s*(positive|negative|neutral)/i);
      const probMatch = section.match(/Probability.*?(\d*\.?\d+)/i);
      const timeframeMatch = section.match(/Timeframe:\s*([^\n]+)/i);

      if (descMatch) {
        events.push({
          type: 'market-event',
          description: descMatch[1].trim(),
          expectedImpact: (impactMatch ? impactMatch[1] : 'neutral') as any,
          probability: probMatch ? parseFloat(probMatch[1]) : 0.5,
          timeframe: timeframeMatch ? timeframeMatch[1].trim() : 'unknown'
        });
      }
    });

    return events;
  }

  private extractMediaAttention(content: string): number {
    const attentionMatch = content.match(/Media attention.*?(\d*\.?\d+)/i);
    return attentionMatch ? parseFloat(attentionMatch[1]) : 0.5;
  }

  async getTrendAnalysis(query: MarketIntelligenceQuery): Promise<TrendAnalysis> {
    try {
      const request: PerplexityRequest = {
        model: 'sonar-medium-chat',
        messages: [
          {
            role: 'system',
            content: 'You are a market trend analyst. Provide comprehensive trend analysis.'
          },
          {
            role: 'user',
            content: this.buildTrendAnalysisPrompt(query)
          }
        ],
        max_tokens: 2000,
        temperature: 0.1,
        return_citations: true
      };

      const response = await this.client.chat(request);
      return this.parseTrendAnalysis(response);
    } catch (error) {
      logger.error('Failed to analyze trends:', error);
      throw error;
    }
  }

  private buildTrendAnalysisPrompt(query: MarketIntelligenceQuery): string {
    const assetIdentifier = query.assetName || query.assetId;

    return `Analyze market trends for ${assetIdentifier} (${query.assetType}).
    
    Provide:
    1. Short-term trend (1-4 weeks): bullish, bearish, or neutral
    2. Medium-term trend (1-3 months): bullish, bearish, or neutral
    3. Long-term trend (3-12 months): bullish, bearish, or neutral
    4. Momentum indicator (-1 to 1, where -1 is strong negative momentum)
    5. Volatility level (0 to 1, where 1 is extremely volatile)
    6. Key correlations with other assets:
       - Asset name and correlation coefficient (-1 to 1)
       - Time period for correlation
    7. Technical indicators summary
    8. Support and resistance levels
    
    Base analysis on price action, volume, and market structure.`;
  }

  private parseTrendAnalysis(response: PerplexityResponse): TrendAnalysis {
    const content = response.choices[0]?.message?.content || '';

    return {
      shortTermTrend: this.extractTrend(content, 'short.?term'),
      mediumTermTrend: this.extractTrend(content, 'medium.?term'),
      longTermTrend: this.extractTrend(content, 'long.?term'),
      momentum: this.extractMomentum(content),
      volatility: this.extractVolatility(content),
      correlations: this.extractCorrelations(content)
    };
  }

  private extractTrend(content: string, term: string): 'bullish' | 'bearish' | 'neutral' {
    const pattern = new RegExp(`${term}.*?(bullish|bearish|neutral)`, 'i');
    const match = content.match(pattern);
    if (!match) return 'neutral';
    return match[1].toLowerCase() as any;
  }

  private extractMomentum(content: string): number {
    const match = content.match(/Momentum.*?(-?\d*\.?\d+)/i);
    return match ? Math.max(-1, Math.min(1, parseFloat(match[1]))) : 0;
  }

  private extractVolatility(content: string): number {
    const match = content.match(/Volatility.*?(\d*\.?\d+)/i);
    return match ? Math.max(0, Math.min(1, parseFloat(match[1]))) : 0.5;
  }

  private extractCorrelations(content: string): AssetCorrelation[] {
    const correlations: AssetCorrelation[] = [];
    
    const corrPattern = /([A-Z][A-Za-z\s]+?):\s*(-?\d*\.?\d+)/g;
    let match;
    
    while ((match = corrPattern.exec(content)) !== null) {
      if (match[1].length < 20) { // Avoid long text matches
        correlations.push({
          assetId: match[1].trim().replace(/\s+/g, '-'),
          assetName: match[1].trim(),
          correlation: parseFloat(match[2]),
          period: '3-month' // Default, would need more parsing
        });
      }
    }

    return correlations;
  }

  async getCompetitiveAnalysis(query: MarketIntelligenceQuery): Promise<CompetitiveAnalysis> {
    if (!query.competitors || query.competitors.length === 0) {
      throw new Error('Competitors list is required for competitive analysis');
    }

    try {
      const request: PerplexityRequest = {
        model: 'sonar-medium-chat',
        messages: [
          {
            role: 'system',
            content: 'You are a competitive intelligence analyst. Provide detailed competitive analysis.'
          },
          {
            role: 'user',
            content: this.buildCompetitiveAnalysisPrompt(query)
          }
        ],
        max_tokens: 3000,
        temperature: 0.1,
        return_citations: true
      };

      const response = await this.client.chat(request);
      return this.parseCompetitiveAnalysis(response, query);
    } catch (error) {
      logger.error('Failed to analyze competition:', error);
      throw error;
    }
  }

  private buildCompetitiveAnalysisPrompt(query: MarketIntelligenceQuery): string {
    const assetIdentifier = query.assetName || query.assetId;
    const competitors = query.competitors?.join(', ') || '';

    return `Analyze competitive positioning of ${assetIdentifier} against: ${competitors}.
    
    Provide:
    1. Market position ranking (1 to n)
    2. Estimated market share (0 to 1)
    3. Key competitive advantages (list)
    4. Main competitive threats (list)
    5. Peer comparison for each competitor:
       - Key performance metrics comparison
       - Relative performance score (-1 to 1)
       - Strengths and weaknesses
    6. Market dynamics and competitive trends
    7. Strategic recommendations
    
    Base analysis on financial performance, market position, and strategic factors.`;
  }

  private parseCompetitiveAnalysis(
    response: PerplexityResponse,
    query: MarketIntelligenceQuery
  ): CompetitiveAnalysis {
    const content = response.choices[0]?.message?.content || '';

    return {
      marketPosition: this.extractMarketPosition(content),
      marketShare: this.extractMarketShare(content),
      competitiveAdvantages: this.extractListItems(content, 'advantages'),
      competitiveThreats: this.extractListItems(content, 'threats'),
      peerComparison: this.extractPeerComparisons(content, query.competitors || [])
    };
  }

  private extractMarketPosition(content: string): number {
    const match = content.match(/Market position.*?#?(\d+)/i);
    return match ? parseInt(match[1]) : 0;
  }

  private extractMarketShare(content: string): number {
    const match = content.match(/Market share.*?(\d+\.?\d*)%/i);
    return match ? parseFloat(match[1]) / 100 : 0;
  }

  private extractListItems(content: string, type: string): string[] {
    const pattern = new RegExp(`${type}:?\\s*([^\\n]+(?:\\n(?!^\\w+:).*)*))`, 'im');
    const match = content.match(pattern);
    if (!match) return [];

    return match[1]
      .split(/[•\-\n]/)
      .map(item => item.trim())
      .filter(item => item.length > 10);
  }

  private extractPeerComparisons(content: string, competitors: string[]): PeerComparison[] {
    const comparisons: PeerComparison[] = [];

    competitors.forEach((competitor, index) => {
      const section = this.extractCompetitorSection(content, competitor);
      if (section) {
        comparisons.push({
          peerId: `peer-${index}`,
          peerName: competitor,
          metrics: this.extractPeerMetrics(section),
          relativePerformance: this.extractRelativePerformance(section)
        });
      }
    });

    return comparisons;
  }

  private extractCompetitorSection(content: string, competitor: string): string {
    const pattern = new RegExp(`${competitor}.*?(?=\\n[A-Z]|$)`, 'is');
    const match = content.match(pattern);
    return match ? match[0] : '';
  }

  private extractPeerMetrics(section: string): Record<string, number> {
    const metrics: Record<string, number> = {};
    
    // Common metrics patterns
    const patterns = {
      revenue: /Revenue.*?\$?([\d,]+\.?\d*)\s*(B|M)?/i,
      growth: /Growth.*?(\d+\.?\d*)%/i,
      margin: /Margin.*?(\d+\.?\d*)%/i,
      marketCap: /Market Cap.*?\$?([\d,]+\.?\d*)\s*(B|M)?/i
    };

    for (const [key, pattern] of Object.entries(patterns)) {
      const match = section.match(pattern);
      if (match) {
        let value = parseFloat(match[1].replace(/,/g, ''));
        if (match[2] === 'B') value *= 1000000000;
        else if (match[2] === 'M') value *= 1000000;
        metrics[key] = value;
      }
    }

    return metrics;
  }

  private extractRelativePerformance(section: string): number {
    const match = section.match(/Performance.*?(-?\d*\.?\d+)/i);
    return match ? parseFloat(match[1]) : 0;
  }

  async analyzeSentiment(request: SentimentAnalysisRequest): Promise<number> {
    try {
      const perplexityRequest: PerplexityRequest = {
        model: 'sonar-small-chat',
        messages: [
          {
            role: 'system',
            content: 'You are a sentiment analysis expert. Analyze text sentiment accurately.'
          },
          {
            role: 'user',
            content: `Analyze the sentiment of this text:
              "${request.text}"
              ${request.context ? `Context: ${request.context}` : ''}
              ${request.assetType ? `Asset type: ${request.assetType}` : ''}
              
              Return a sentiment score from -1 (very negative) to 1 (very positive).`
          }
        ],
        max_tokens: 100,
        temperature: 0.1
      };

      const response = await this.client.chat(perplexityRequest);
      const content = response.choices[0]?.message?.content || '0';
      
      const match = content.match(/-?\d*\.?\d+/);
      return match ? Math.max(-1, Math.min(1, parseFloat(match[0]))) : 0;
    } catch (error) {
      logger.error('Failed to analyze sentiment:', error);
      return 0;
    }
  }

  private getRecencyFilter(
    timeframe?: string
  ): 'day' | 'week' | 'month' | 'year' | undefined {
    switch (timeframe) {
      case 'day':
        return 'day';
      case 'week':
        return 'week';
      case 'month':
      case 'quarter':
        return 'month';
      case 'year':
        return 'year';
      default:
        return 'week';
    }
  }
}