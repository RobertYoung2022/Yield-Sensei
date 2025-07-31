/**
 * AI-Powered Sentiment Analyzer
 * Advanced sentiment analysis using multiple AI providers with consensus and specialized crypto analysis
 */

import { EventEmitter } from 'events';
import { Logger } from 'winston';
import { createLogger, format, transports } from 'winston';
import { 
  SentimentData, 
  SentimentAnalysis, 
  SentimentType, 
  EntityMention, 
  Theme, 
  EmotionScores,
  NarrativeAnalysis,
  NarrativeCategory,
  NarrativeLifecycle,
  TrendPrediction,
  TimeFrame
} from '../types';
import { getUnifiedAIClient } from '../../../integrations/ai/unified-ai-client';
import { AIProvider } from '../../../integrations/ai/types';

export interface AIPoweredSentimentConfig {
  enableMultiProviderConsensus: boolean;
  consensusProviders: AIProvider[];
  minimumConsensusScore: number;
  enableNarrativeDetection: boolean;
  enableTrendPrediction: boolean;
  enableCryptoSpecificPrompts: boolean;
  confidenceThreshold: number;
  cacheResults: boolean;
  cacheTTL: number;
}

export const DEFAULT_AI_SENTIMENT_CONFIG: AIPoweredSentimentConfig = {
  enableMultiProviderConsensus: true,
  consensusProviders: ['anthropic', 'openai', 'perplexity'],
  minimumConsensusScore: 0.7,
  enableNarrativeDetection: true,
  enableTrendPrediction: true,
  enableCryptoSpecificPrompts: true,
  confidenceThreshold: 0.6,
  cacheResults: true,
  cacheTTL: 900000 // 15 minutes
};

interface ConsensusResult {
  sentiment: SentimentType;
  score: number;
  confidence: number;
  emotions: EmotionScores;
  providerResults: Array<{
    provider: AIProvider;
    result: any;
    confidence: number;
  }>;
  consensusScore: number;
}

interface NarrativeDetectionResult {
  narratives: NarrativeAnalysis[];
  emergingThemes: string[];
  marketImpactScore: number;
  confidenceScore: number;
}

interface TrendPredictionResult {
  predictions: TrendPrediction[];
  confidenceScore: number;
  timeHorizon: TimeFrame;
  marketDirection: 'bullish' | 'bearish' | 'sideways';
  volatilityForecast: number;
}

export class AIPoweredSentimentAnalyzer extends EventEmitter {
  private static instance: AIPoweredSentimentAnalyzer;
  private logger: Logger;
  private config: AIPoweredSentimentConfig;
  private aiClient = getUnifiedAIClient();
  private resultCache: Map<string, any> = new Map();

  // Specialized crypto prompts
  private cryptoSentimentPrompts = {
    consensus: `You are an expert cryptocurrency and DeFi sentiment analyst. Analyze this social media content for sentiment with deep crypto market understanding.

Content: "{content}"
Author influence: {influence}
Platform: {platform}
Engagement: {engagement}

Provide detailed analysis:
1. Overall sentiment (very_positive, positive, neutral, negative, very_negative)
2. Sentiment score (-1.0 to +1.0)
3. Confidence level (0.0 to 1.0)
4. Market implications (bullish/bearish/neutral signals)
5. Emotional analysis for each: joy, fear, anger, sadness, surprise, trust, anticipation, disgust (0.0 to 1.0)
6. Crypto-specific factors: FOMO level, FUD level, adoption signals, technical analysis mentions

Consider:
- Crypto slang and terminology (moon, diamond hands, HODL, rug pull, etc.)
- Market cycle psychology (fear, greed, euphoria, despair)
- Project-specific sentiment vs general market sentiment
- Influencer credibility and following impact
- Technical vs fundamental analysis content

Respond in JSON: {
  "sentiment": "...",
  "score": 0.0,
  "confidence": 0.0,
  "market_implications": {
    "direction": "bullish|bearish|neutral",
    "strength": 0.0,
    "timeframe": "short|medium|long"
  },
  "emotions": {
    "joy": 0.0, "fear": 0.0, "anger": 0.0, "sadness": 0.0,
    "surprise": 0.0, "trust": 0.0, "anticipation": 0.0, "disgust": 0.0
  },
  "crypto_factors": {
    "fomo_level": 0.0,
    "fud_level": 0.0,
    "adoption_signals": 0.0,
    "technical_mentions": 0.0,
    "price_focus": 0.0
  }
}`,

    narrative: `You are a cryptocurrency narrative detection expert. Identify and analyze emerging narratives in this content.

Content: "{content}"
Historical context: {context}

Analyze for:
1. Narrative themes (technical innovation, adoption, regulation, market cycles, etc.)
2. Narrative lifecycle stage (emerging, growing, mainstream, declining, dormant)  
3. Key narrative drivers and influential voices
4. Counter-narratives and opposing viewpoints
5. Market impact potential and correlation strength
6. Spread velocity and retention likelihood

Focus on crypto-specific narratives:
- DeFi innovation (yield farming, liquidity mining, new protocols)
- NFT and gaming trends (GameFi, metaverse, digital ownership)
- Layer 2 scaling solutions and interoperability
- Regulatory developments and institutional adoption
- Sustainability and environmental concerns
- Community-driven movements and memes

Respond in JSON: {
  "narratives": [{
    "theme": "narrative theme",
    "category": "technical|fundamental|regulatory|adoption|partnership|competitive|market|social",
    "lifecycle": "emerging|growing|mainstream|declining|dormant",
    "strength": 0.0,
    "market_impact": 0.0,
    "key_drivers": ["driver1", "driver2"],
    "influential_voices": ["voice1", "voice2"],
    "counter_narratives": ["counter1", "counter2"]
  }],
  "emerging_themes": ["theme1", "theme2"],
  "market_impact_score": 0.0,
  "confidence": 0.0
}`,

    prediction: `You are a cryptocurrency trend prediction specialist. Analyze this content for trend prediction insights.

Content: "{content}"
Market context: {context}
Historical data: {history}

Generate predictions for:
1. Short-term sentiment evolution (1-7 days)
2. Medium-term narrative development (1-4 weeks)  
3. Long-term market implications (1-6 months)
4. Key risk factors and catalysts
5. Probability scenarios and outcomes

Consider:
- Market cycle position and historical patterns
- Technology adoption curves and network effects
- Regulatory environment and policy changes
- Institutional interest and capital flows
- Community sentiment and social media trends
- Technical indicators and on-chain metrics alignment

Respond in JSON: {
  "predictions": [{
    "timeframe": "1h|4h|1d|1w|1m|3m",
    "confidence": 0.0,
    "predicted_sentiment": "very_positive|positive|neutral|negative|very_negative",
    "predicted_volume": 0.0,
    "factors": [{
      "factor": "factor description",
      "weight": 0.0,
      "confidence": 0.0,
      "type": "technical|social|fundamental|external"
    }],
    "scenarios": [{
      "name": "scenario name",
      "probability": 0.0,
      "outcome": "outcome description",
      "timeline": "timeline description"
    }]
  }],
  "market_direction": "bullish|bearish|sideways",
  "volatility_forecast": 0.0,
  "confidence": 0.0
}`
  };

  private constructor(config: AIPoweredSentimentConfig) {
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
        new transports.File({ filename: 'logs/ai-powered-sentiment.log' })
      ],
    });
  }

  static getInstance(config?: AIPoweredSentimentConfig): AIPoweredSentimentAnalyzer {
    if (!AIPoweredSentimentAnalyzer.instance && config) {
      AIPoweredSentimentAnalyzer.instance = new AIPoweredSentimentAnalyzer(config);
    } else if (!AIPoweredSentimentAnalyzer.instance) {
      throw new Error('AIPoweredSentimentAnalyzer must be initialized with config first');
    }
    return AIPoweredSentimentAnalyzer.instance;
  }

  async analyzeSentimentWithConsensus(data: SentimentData): Promise<SentimentAnalysis> {
    try {
      this.logger.info('Starting AI-powered sentiment analysis with consensus', { contentId: data.id });

      // Check cache first
      const cacheKey = this.generateCacheKey(data);
      if (this.config.cacheResults && this.resultCache.has(cacheKey)) {
        const cached = this.resultCache.get(cacheKey);
        this.logger.debug('Returning cached AI sentiment analysis', { contentId: data.id });
        return cached;
      }

      // Perform multi-provider consensus analysis
      const consensusResult = await this.performConsensusAnalysis(data);
      
      // Enhanced entity extraction with AI
      const entities = await this.extractEntitiesWithAI(data.content);
      
      // Enhanced theme extraction with AI
      const themes = await this.extractThemesWithAI(data.content);

      // Build the analysis result
      const analysis: SentimentAnalysis = {
        id: `ai_sentiment_${data.id}_${Date.now()}`,
        content: data.content,
        sentiment: {
          overall: consensusResult.sentiment,
          score: consensusResult.score,
          confidence: consensusResult.confidence,
          emotions: consensusResult.emotions
        },
        entities,
        themes,
        influence: this.calculateInfluence(data),
        market: await this.analyzeMarketSentimentWithAI(data.content, consensusResult),
        timestamp: data.timestamp,
        processed: new Date()
      };

      // Cache the result
      if (this.config.cacheResults) {
        this.resultCache.set(cacheKey, analysis);
        setTimeout(() => {
          this.resultCache.delete(cacheKey);
        }, this.config.cacheTTL);
      }

      // Emit enhanced analysis events
      this.emit('ai_sentiment_analyzed', {
        type: 'ai_sentiment_analysis_completed',
        data: analysis,
        consensusData: consensusResult,
        timestamp: new Date()
      });

      this.logger.info('AI-powered sentiment analysis completed', {
        contentId: data.id,
        sentiment: analysis.sentiment.overall,
        confidence: analysis.sentiment.confidence,
        consensusScore: consensusResult.consensusScore
      });

      return analysis;

    } catch (error) {
      this.logger.error('AI-powered sentiment analysis failed:', error);
      throw error;
    }
  }

  async detectNarratives(data: SentimentData[], context?: string): Promise<NarrativeDetectionResult> {
    try {
      if (!this.config.enableNarrativeDetection) {
        return {
          narratives: [],
          emergingThemes: [],
          marketImpactScore: 0,
          confidenceScore: 0
        };
      }

      this.logger.info('Starting AI-powered narrative detection', { dataPoints: data.length });

      // Aggregate content for narrative analysis
      const aggregatedContent = data.map(d => d.content).join('\n\n---\n\n');
      const prompt = this.cryptoSentimentPrompts.narrative
        .replace('{content}', aggregatedContent)
        .replace('{context}', context || 'No additional context provided');

      const result = await this.aiClient.generateText({
        prompt,
        maxTokens: 4000,
        temperature: 0.3,
        systemPrompt: 'You are an expert in cryptocurrency market psychology and narrative analysis.'
      });

      if (result.success && result.data?.text) {
        try {
          const analysis = JSON.parse(result.data.text);
          
          const narratives: NarrativeAnalysis[] = analysis.narratives.map((n: any) => ({
            id: `narrative_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            narrative: n.theme,
            category: n.category as NarrativeCategory,
            lifecycle: n.lifecycle as NarrativeLifecycle,
            metrics: {
              adoption_rate: n.strength * 0.8,
              spread_velocity: n.market_impact * 0.7,
              retention_rate: n.strength * 0.6,
              sentiment_evolution: {
                current: SentimentType.NEUTRAL,
                previous: SentimentType.NEUTRAL,
                change: 0,
                direction: 'stable' as const,
                momentum: 'steady' as const,
                volatility: 0.3,
                timeline: []
              }
            },
            key_drivers: n.key_drivers || [],
            influential_voices: n.influential_voices || [],
            counter_narratives: n.counter_narratives || [],
            market_impact: {
              correlation: n.market_impact,
              lag_time: 24,
              amplitude: n.strength
            }
          }));

          const narrativeResult: NarrativeDetectionResult = {
            narratives,
            emergingThemes: analysis.emerging_themes || [],
            marketImpactScore: analysis.market_impact_score || 0,
            confidenceScore: analysis.confidence || 0
          };

          this.emit('narratives_detected', {
            type: 'narratives_detected',
            data: narrativeResult,
            timestamp: new Date()
          });

          return narrativeResult;

        } catch (parseError) {
          this.logger.warn('Failed to parse narrative analysis JSON:', parseError);
        }
      }

      return {
        narratives: [],
        emergingThemes: [],
        marketImpactScore: 0,
        confidenceScore: 0
      };

    } catch (error) {
      this.logger.error('Narrative detection failed:', error);
      throw error;
    }
  }

  async predictTrends(data: SentimentData[], context?: string, history?: any): Promise<TrendPredictionResult> {
    try {
      if (!this.config.enableTrendPrediction) {
        return {
          predictions: [],
          confidenceScore: 0,
          timeHorizon: TimeFrame.DAY,
          marketDirection: 'sideways',
          volatilityForecast: 0.5
        };
      }

      this.logger.info('Starting AI-powered trend prediction', { dataPoints: data.length });

      const aggregatedContent = data.map(d => d.content).join('\n\n---\n\n');
      const prompt = this.cryptoSentimentPrompts.prediction
        .replace('{content}', aggregatedContent)
        .replace('{context}', context || 'Current market conditions')
        .replace('{history}', JSON.stringify(history || {}));

      const result = await this.aiClient.generateText({
        prompt,
        maxTokens: 4000,
        temperature: 0.2, // Lower temperature for more consistent predictions
        systemPrompt: 'You are a cryptocurrency market analyst specializing in trend prediction and risk assessment.'
      });

      if (result.success && result.data?.text) {
        try {
          const analysis = JSON.parse(result.data.text);
          
          const predictions: TrendPrediction[] = analysis.predictions.map((p: any) => ({
            timeframe: p.timeframe as TimeFrame,
            confidence: p.confidence,
            predicted_sentiment: p.predicted_sentiment as SentimentType,
            predicted_volume: p.predicted_volume,
            factors: p.factors || [],
            scenarios: p.scenarios || []
          }));

          const predictionResult: TrendPredictionResult = {
            predictions,
            confidenceScore: analysis.confidence || 0,
            timeHorizon: TimeFrame.WEEK,
            marketDirection: analysis.market_direction || 'sideways',
            volatilityForecast: analysis.volatility_forecast || 0.5
          };

          this.emit('trends_predicted', {
            type: 'trends_predicted',
            data: predictionResult,
            timestamp: new Date()
          });

          return predictionResult;

        } catch (parseError) {
          this.logger.warn('Failed to parse trend prediction JSON:', parseError);
        }
      }

      return {
        predictions: [],
        confidenceScore: 0,
        timeHorizon: TimeFrame.DAY,
        marketDirection: 'sideways',
        volatilityForecast: 0.5
      };

    } catch (error) {
      this.logger.error('Trend prediction failed:', error);
      throw error;
    }
  }

  private async performConsensusAnalysis(data: SentimentData): Promise<ConsensusResult> {
    if (!this.config.enableMultiProviderConsensus) {
      // Fallback to single provider analysis
      return await this.performSingleProviderAnalysis(data, this.config.consensusProviders[0]);
    }

    const results: Array<{ provider: AIProvider; result: any; confidence: number }> = [];
    
    // Get analysis from each provider
    for (const provider of this.config.consensusProviders) {
      try {
        const result = await this.performSingleProviderAnalysis(data, provider);
        results.push({
          provider,
          result,
          confidence: result.confidence
        });
      } catch (error) {
        this.logger.warn(`Provider ${provider} failed in consensus analysis:`, error);
      }
    }

    if (results.length === 0) {
      throw new Error('All providers failed in consensus analysis');
    }

    // Calculate consensus
    return this.calculateConsensus(results);
  }

  private async performSingleProviderAnalysis(data: SentimentData, provider: AIProvider): Promise<ConsensusResult> {
    const prompt = this.config.enableCryptoSpecificPrompts 
      ? this.cryptoSentimentPrompts.consensus
          .replace('{content}', data.content)
          .replace('{influence}', (data.author.influence || 0).toString())
          .replace('{platform}', data.source)
          .replace('{engagement}', JSON.stringify(data.engagement))
      : `Analyze the sentiment of this content: "${data.content}"`;

    // Force the specific provider by temporarily configuring the client
    const result = await this.aiClient.generateText({
      prompt,
      maxTokens: 2000,
      temperature: 0.1,
      systemPrompt: 'You are an expert cryptocurrency sentiment analyst. Provide accurate, consistent analysis in the requested JSON format.'
    });

    if (!result.success || !result.data?.text) {
      throw new Error(`Provider ${provider} failed to generate analysis`);
    }

    try {
      const analysis = JSON.parse(result.data.text);
      
      const sentimentMap: { [key: string]: SentimentType } = {
        'very_positive': SentimentType.VERY_POSITIVE,
        'positive': SentimentType.POSITIVE,
        'neutral': SentimentType.NEUTRAL,
        'negative': SentimentType.NEGATIVE,
        'very_negative': SentimentType.VERY_NEGATIVE
      };

      return {
        sentiment: sentimentMap[analysis.sentiment] || SentimentType.NEUTRAL,
        score: Math.max(-1, Math.min(1, analysis.score || 0)),
        confidence: Math.max(0, Math.min(1, analysis.confidence || 0)),
        emotions: {
          joy: Math.max(0, Math.min(1, analysis.emotions?.joy || 0)),
          fear: Math.max(0, Math.min(1, analysis.emotions?.fear || 0)),
          anger: Math.max(0, Math.min(1, analysis.emotions?.anger || 0)),
          sadness: Math.max(0, Math.min(1, analysis.emotions?.sadness || 0)),
          surprise: Math.max(0, Math.min(1, analysis.emotions?.surprise || 0)),
          trust: Math.max(0, Math.min(1, analysis.emotions?.trust || 0)),
          anticipation: Math.max(0, Math.min(1, analysis.emotions?.anticipation || 0)),
          disgust: Math.max(0, Math.min(1, analysis.emotions?.disgust || 0))
        },
        providerResults: [{
          provider,
          result: analysis,
          confidence: analysis.confidence || 0
        }],
        consensusScore: analysis.confidence || 0
      };

    } catch (parseError) {
      this.logger.warn(`Failed to parse analysis from ${provider}:`, parseError);
      throw new Error(`Invalid response format from ${provider}`);
    }
  }

  private calculateConsensus(results: Array<{ provider: AIProvider; result: any; confidence: number }>): ConsensusResult {
    if (results.length === 1) {
      return results[0].result;
    }

    // Weighted average based on confidence scores
    const totalWeight = results.reduce((sum, r) => sum + r.confidence, 0);
    
    // Calculate weighted sentiment score
    const weightedScore = results.reduce((sum, r) => {
      const weight = r.confidence / totalWeight;
      return sum + (r.result.score * weight);
    }, 0);

    // Calculate consensus confidence (how much providers agree)
    const sentimentValues = results.map(r => this.sentimentToNumeric(r.result.sentiment));
    const sentimentVariance = this.calculateVariance(sentimentValues);
    const consensusScore = Math.max(0, 1 - sentimentVariance);

    // Determine final sentiment from weighted score
    const finalSentiment = this.numericToSentiment(weightedScore);

    // Average emotions across providers
    const avgEmotions: EmotionScores = {
      joy: this.averageEmotion(results, 'joy'),
      fear: this.averageEmotion(results, 'fear'),
      anger: this.averageEmotion(results, 'anger'),
      sadness: this.averageEmotion(results, 'sadness'),
      surprise: this.averageEmotion(results, 'surprise'),
      trust: this.averageEmotion(results, 'trust'),
      anticipation: this.averageEmotion(results, 'anticipation'),
      disgust: this.averageEmotion(results, 'disgust')
    };

    return {
      sentiment: finalSentiment,
      score: weightedScore,
      confidence: Math.min(consensusScore, results.reduce((sum, r) => sum + r.confidence, 0) / results.length),
      emotions: avgEmotions,
      providerResults: results,
      consensusScore
    };
  }

  private async extractEntitiesWithAI(content: string): Promise<EntityMention[]> {
    try {
      const prompt = `Extract cryptocurrency/DeFi entities from this content. Focus on:
- Tokens/cryptocurrencies (e.g., Bitcoin, ETH, $DOGE)
- Protocols/projects (e.g., Uniswap, Aave, PancakeSwap)
- Exchanges (e.g., Binance, Coinbase)
- People/influencers
- Companies

Content: "${content}"

Return JSON array: [{"entity": "name", "type": "token|protocol|exchange|person|company", "confidence": 0.9, "context": "surrounding text"}]`;

      const result = await this.aiClient.generateText({
        prompt,
        maxTokens: 1500,
        temperature: 0.1,
        systemPrompt: 'You are an expert in cryptocurrency entity recognition. Return only valid JSON.'
      });

      if (result.success && result.data?.text) {
        try {
          const entities = JSON.parse(result.data.text);
          return entities.map((e: any, index: number) => ({
            entity: e.entity || '',
            type: e.type || 'unknown',
            confidence: Math.max(0, Math.min(1, e.confidence || 0.7)),
            sentiment: SentimentType.NEUTRAL,
            context: e.context || content.substring(0, 100),
            position: { start: 0, end: 0 }, // Would need NLP processing for exact positions
            normalized: e.entity?.toUpperCase() || ''
          }));
        } catch (parseError) {
          this.logger.warn('Failed to parse AI entity extraction:', parseError);
        }
      }
    } catch (error) {
      this.logger.debug('AI entity extraction failed:', error);
    }

    return [];
  }

  private async extractThemesWithAI(content: string): Promise<Theme[]> {
    try {
      const prompt = `Identify cryptocurrency/DeFi themes in this content:

Content: "${content}"

Look for themes like:
- Price action and trading
- Technology and innovation
- Adoption and mainstream acceptance
- Regulation and compliance
- Community and culture
- Market analysis
- DeFi protocols and yield farming
- NFTs and gaming

Return JSON: [{"theme": "theme_name", "keywords": ["keyword1", "keyword2"], "confidence": 0.9, "sentiment": "positive|negative|neutral", "impact": "high|medium|low"}]`;

      const result = await this.aiClient.generateText({
        prompt,
        maxTokens: 1000,
        temperature: 0.2,
        systemPrompt: 'You are an expert in cryptocurrency theme analysis. Return only valid JSON.'
      });

      if (result.success && result.data?.text) {
        try {
          const themes = JSON.parse(result.data.text);
          return themes.map((t: any) => ({
            id: `ai_theme_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            name: t.theme,
            keywords: t.keywords || [],
            sentiment: t.sentiment === 'positive' ? SentimentType.POSITIVE : 
                     t.sentiment === 'negative' ? SentimentType.NEGATIVE : SentimentType.NEUTRAL,
            confidence: Math.max(0, Math.min(1, t.confidence || 0.7)),
            frequency: t.keywords?.length || 1,
            trending: t.impact === 'high',
            impact: t.impact === 'high' ? 'high' as const : 
                   t.impact === 'low' ? 'low' as const : 'medium' as const
          }));
        } catch (parseError) {
          this.logger.warn('Failed to parse AI theme extraction:', parseError);
        }
      }
    } catch (error) {
      this.logger.debug('AI theme extraction failed:', error);
    }

    return [];
  }

  private async analyzeMarketSentimentWithAI(content: string, consensusResult: ConsensusResult): Promise<{
    bullish: number;
    bearish: number;
    neutral: number;
    fomo: number;
    fud: number;
  }> {
    // Use consensus result to inform market sentiment
    const cryptoFactors = consensusResult.providerResults[0]?.result?.crypto_factors;
    
    if (cryptoFactors) {
      return {
        bullish: Math.max(0, consensusResult.score > 0 ? consensusResult.score : 0),
        bearish: Math.max(0, consensusResult.score < 0 ? Math.abs(consensusResult.score) : 0),
        neutral: Math.max(0, 1 - Math.abs(consensusResult.score)),
        fomo: cryptoFactors.fomo_level || 0,
        fud: cryptoFactors.fud_level || 0
      };
    }

    // Fallback to basic analysis
    return {
      bullish: consensusResult.score > 0 ? consensusResult.score : 0,
      bearish: consensusResult.score < 0 ? Math.abs(consensusResult.score) : 0,
      neutral: 1 - Math.abs(consensusResult.score),
      fomo: consensusResult.emotions.anticipation || 0,
      fud: consensusResult.emotions.fear || 0
    };
  }

  // Helper methods
  private calculateInfluence(data: SentimentData): { reach: number; amplification: number; credibility: number } {
    const authorInfluence = data.author.influence || 0;
    const followerBoost = Math.log10((data.author.followersCount || 0) + 1) / 7;
    const engagementScore = this.calculateEngagementScore(data.engagement);

    return {
      reach: Math.min(followerBoost + authorInfluence, 1),
      amplification: engagementScore,
      credibility: data.author.verified ? 0.8 : 0.5
    };
  }

  private calculateEngagementScore(engagement: any): number {
    const likes = engagement.likes || 0;
    const retweets = engagement.retweets || 0;
    const replies = engagement.replies || 0;
    const views = engagement.views || 0;
    const shares = engagement.shares || 0;

    const score = (likes * 1) + (retweets * 2) + (replies * 1.5) + (views * 0.1) + (shares * 3);
    return Math.min(Math.log10(score + 1) / 5, 1);
  }

  private sentimentToNumeric(sentiment: SentimentType): number {
    const map = {
      [SentimentType.VERY_POSITIVE]: 1,
      [SentimentType.POSITIVE]: 0.5,
      [SentimentType.NEUTRAL]: 0,
      [SentimentType.NEGATIVE]: -0.5,
      [SentimentType.VERY_NEGATIVE]: -1
    };
    return map[sentiment] || 0;
  }

  private numericToSentiment(score: number): SentimentType {
    if (score >= 0.6) return SentimentType.VERY_POSITIVE;
    if (score >= 0.2) return SentimentType.POSITIVE;
    if (score <= -0.6) return SentimentType.VERY_NEGATIVE;
    if (score <= -0.2) return SentimentType.NEGATIVE;
    return SentimentType.NEUTRAL;
  }

  private calculateVariance(values: number[]): number {
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
    return squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;
  }

  private averageEmotion(results: Array<{ result: any }>, emotion: keyof EmotionScores): number {
    const values = results
      .map(r => r.result.emotions?.[emotion] || 0)
      .filter(v => typeof v === 'number');
    
    return values.length > 0 ? values.reduce((sum, val) => sum + val, 0) / values.length : 0;
  }

  private generateCacheKey(data: SentimentData): string {
    return `ai_${data.id}_${data.content.length}_${data.timestamp.getTime()}`;
  }

  getStatus(): any {
    return {
      isInitialized: true,
      cacheSize: this.resultCache.size,
      config: this.config,
      aiClientStatus: this.aiClient.getHealthStatus()
    };
  }

  async shutdown(): Promise<void> {
    try {
      this.logger.info('Shutting down AI-Powered Sentiment Analyzer...');
      
      this.resultCache.clear();
      this.removeAllListeners();
      
      this.logger.info('AI-Powered Sentiment Analyzer shutdown complete');
    } catch (error) {
      this.logger.error('Failed to shutdown AI-Powered Sentiment Analyzer:', error);
      throw error;
    }
  }
}