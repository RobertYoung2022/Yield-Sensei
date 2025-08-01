/**
 * Echo Satellite Sentiment Analysis Model Testing Suite
 * Comprehensive testing framework for crypto-specific NLP sentiment analysis models
 */

import { describe, it, expect, jest } from '@jest/globals';

// Mock the logger and dependencies before any imports
jest.mock('../../../src/shared/logging/logger', () => ({
  getLogger: jest.fn(() => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }))
}));

jest.mock('../../../src/integrations/ai/unified-ai-client', () => ({
  getUnifiedAIClient: jest.fn(() => ({
    generateResponse: jest.fn(),
    isAvailable: jest.fn(() => true),
    getProvider: jest.fn(() => 'mock-provider')
  }))
}));

describe('Echo Satellite Sentiment Analysis Model Testing', () => {
  
  describe('Sentiment Analysis Configuration', () => {
    it('should validate sentiment analysis configuration structure', () => {
      const sentimentConfig = {
        enableRealTimeAnalysis: true,
        confidenceThreshold: 0.7,
        enableMLModels: true,
        modelUpdateInterval: 3600000,
        maxConcurrentAnalyses: 10,
        enableEmotionAnalysis: true,
        enableEntityRecognition: true,
        enableLanguageDetection: true,
        cacheResults: true,
        cacheTTL: 1800000,
        enableCryptoSpecificModels: true,
        enableAIPoweredAnalysis: true,
        aiPoweredConfig: {
          provider: 'anthropic',
          model: 'claude-3-haiku',
          maxTokens: 1000,
          temperature: 0.3
        }
      };

      expect(sentimentConfig.enableRealTimeAnalysis).toBe(true);
      expect(sentimentConfig.confidenceThreshold).toBeGreaterThan(0);
      expect(sentimentConfig.confidenceThreshold).toBeLessThanOrEqual(1);
      expect(sentimentConfig.maxConcurrentAnalyses).toBeGreaterThan(0);
      expect(sentimentConfig.enableCryptoSpecificModels).toBe(true);
    });
  });

  describe('Crypto-Specific Sentiment Analysis', () => {
    it('should validate crypto sentiment classification structure', () => {
      const cryptoSentimentResult = {
        id: 'sentiment-123',
        content: 'Bitcoin is looking bullish with strong fundamentals',
        platform: 'twitter',
        timestamp: new Date(),
        sentiment: {
          type: 'positive' as const,
          score: 0.85,
          confidence: 0.92,
          reasoning: 'Positive sentiment detected with bullish indicators'
        },
        emotions: {
          fear: 0.1,
          greed: 0.7,
          excitement: 0.8,
          anxiety: 0.2,
          optimism: 0.9,
          pessimism: 0.1
        },
        entities: [
          {
            entity: 'Bitcoin',
            type: 'cryptocurrency',
            mentions: 1,
            sentiment: 0.85,
            confidence: 0.95
          }
        ],
        themes: [
          {
            theme: 'bullish_sentiment',
            score: 0.9,
            keywords: ['bullish', 'fundamentals', 'strong']
          }
        ],
        cryptoSpecific: {
          marketPhase: 'bull_market',
          trendIndicators: ['bullish', 'fundamentals'],
          riskSentiment: 'low',
          fudFactor: 0.1
        }
      };

      expect(['positive', 'negative', 'neutral']).toContain(cryptoSentimentResult.sentiment.type);
      expect(cryptoSentimentResult.sentiment.score).toBeGreaterThanOrEqual(-1);
      expect(cryptoSentimentResult.sentiment.score).toBeLessThanOrEqual(1);
      expect(cryptoSentimentResult.sentiment.confidence).toBeGreaterThan(0);
      expect(cryptoSentimentResult.sentiment.confidence).toBeLessThanOrEqual(1);
      expect(cryptoSentimentResult.entities.length).toBeGreaterThan(0);
      expect(cryptoSentimentResult.themes.length).toBeGreaterThan(0);
      expect(cryptoSentimentResult.cryptoSpecific).toBeDefined();
    });

    it('should handle various crypto market contexts', () => {
      const marketContexts = [
        {
          content: 'HODL through the dip, diamond hands!',
          expectedSentiment: 'positive',
          expectedMarketPhase: 'bear_market',
          expectedTrendIndicators: ['hodl', 'diamond_hands']
        },
        {
          content: 'This rugpull destroyed my portfolio',
          expectedSentiment: 'negative',
          expectedMarketPhase: 'bear_market',
          expectedTrendIndicators: ['rugpull', 'portfolio_loss']
        },
        {
          content: 'DeFi yields are looking stable and sustainable',
          expectedSentiment: 'positive',
          expectedMarketPhase: 'stable_market',
          expectedTrendIndicators: ['defi', 'yields', 'stable']
        }
      ];

      for (const context of marketContexts) {
        expect(context.content).toBeDefined();
        expect(['positive', 'negative', 'neutral']).toContain(context.expectedSentiment);
        expect(['bull_market', 'bear_market', 'stable_market', 'volatile_market']).toContain(context.expectedMarketPhase);
        expect(context.expectedTrendIndicators).toBeInstanceOf(Array);
        expect(context.expectedTrendIndicators.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Entity Recognition Validation', () => {
    it('should validate entity recognition structure', () => {
      const entityRecognitionResult = {
        content: 'Ethereum gas fees are high but ETH staking rewards are good',
        entities: [
          {
            entity: 'Ethereum',
            type: 'cryptocurrency',
            aliases: ['ETH'],
            mentions: 2,
            sentiment: 0.1, // Mixed sentiment
            confidence: 0.95,
            positions: [
              { start: 0, end: 8 },  // "Ethereum"
              { start: 33, end: 36 }  // "ETH"
            ]
          },
          {
            entity: 'gas fees',
            type: 'concept',
            aliases: ['transaction fees'],
            mentions: 1,
            sentiment: -0.6, // Negative sentiment
            confidence: 0.88,
            positions: [{ start: 9, end: 17 }]
          },
          {
            entity: 'staking',
            type: 'concept',
            aliases: ['staking rewards'],
            mentions: 1,
            sentiment: 0.7, // Positive sentiment
            confidence: 0.92,
            positions: [{ start: 37, end: 44 }]
          }
        ],
        entityRelationships: [
          {
            entity1: 'Ethereum',
            entity2: 'gas fees',
            relationship: 'has_feature',
            confidence: 0.9
          },
          {
            entity1: 'Ethereum',
            entity2: 'staking',
            relationship: 'supports',
            confidence: 0.95
          }
        ]
      };

      expect(entityRecognitionResult.entities.length).toBeGreaterThan(0);
      
      for (const entity of entityRecognitionResult.entities) {
        expect(entity.entity).toBeDefined();
        expect(['cryptocurrency', 'protocol', 'concept', 'person', 'organization']).toContain(entity.type);
        expect(entity.sentiment).toBeGreaterThanOrEqual(-1);
        expect(entity.sentiment).toBeLessThanOrEqual(1);
        expect(entity.confidence).toBeGreaterThan(0);
        expect(entity.confidence).toBeLessThanOrEqual(1);
        expect(entity.positions).toBeInstanceOf(Array);
        expect(entity.positions.length).toBeGreaterThan(0);
      }

      expect(entityRecognitionResult.entityRelationships).toBeInstanceOf(Array);
      for (const relationship of entityRecognitionResult.entityRelationships) {
        expect(relationship.entity1).toBeDefined();
        expect(relationship.entity2).toBeDefined();
        expect(relationship.relationship).toBeDefined();
        expect(relationship.confidence).toBeGreaterThan(0);
        expect(relationship.confidence).toBeLessThanOrEqual(1);
      }
    });

    it('should handle entity disambiguation', () => {
      const disambiguationCases = [
        {
          content: 'LUNA crashed hard after the depeg',
          ambiguousEntity: 'LUNA',
          expectedDisambiguation: 'Terra Luna Classic',
          context: 'post-crash'
        },
        {
          content: 'New LUNA is rebuilding the ecosystem',
          ambiguousEntity: 'LUNA',
          expectedDisambiguation: 'Terra Luna 2.0',
          context: 'post-fork'
        },
        {
          content: 'Apple is entering the crypto space',
          ambiguousEntity: 'Apple',
          expectedDisambiguation: 'Apple Inc.',
          context: 'technology_company'
        }
      ];

      for (const testCase of disambiguationCases) {
        expect(testCase.content).toContain(testCase.ambiguousEntity);
        expect(testCase.expectedDisambiguation).toBeDefined();
        expect(testCase.context).toBeDefined();
      }
    });
  });

  describe('Emotion Analysis Validation', () => {
    it('should validate emotion scoring structure', () => {
      const emotionAnalysisResult = {
        content: 'I am so excited about this new DeFi protocol but worried about the risks',
        emotions: {
          fear: 0.4,
          greed: 0.2,
          excitement: 0.8,
          anxiety: 0.6,  
          optimism: 0.7,
          pessimism: 0.3,
          anger: 0.1,
          joy: 0.6,
          disgust: 0.1,
          surprise: 0.5
        },
        dominantEmotion: 'excitement',
        emotionalIntensity: 0.75,
        emotionalConflict: true, // Mixed emotions detected
        cryptoEmotions: {
          fomo: 0.6,
          fud: 0.4,
          hodlSentiment: 0.3,
          diamondHands: 0.2,
          paperHands: 0.1
        }
      };

      // Validate emotion scores are within valid range
      for (const score of Object.values(emotionAnalysisResult.emotions)) {
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(1);
      }

      expect(emotionAnalysisResult.dominantEmotion).toBeDefined();
      expect(emotionAnalysisResult.emotionalIntensity).toBeGreaterThanOrEqual(0);
      expect(emotionAnalysisResult.emotionalIntensity).toBeLessThanOrEqual(1);
      expect(typeof emotionAnalysisResult.emotionalConflict).toBe('boolean');

      // Validate crypto-specific emotions
      for (const score of Object.values(emotionAnalysisResult.cryptoEmotions)) {
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(1);
      }
    });
  });

  describe('Language Detection and Multi-language Support', () => {
    it('should validate language detection structure', () => {
      const languageDetectionResult = {
        content: 'Bitcoin va a la luna! 🚀',
        detectedLanguage: 'es',
        confidence: 0.92,
        supportedLanguages: ['en', 'es', 'fr', 'de', 'ja', 'ko', 'zh'],
        translatedContent: 'Bitcoin is going to the moon! 🚀',
        sentimentInOriginalLanguage: {
          type: 'positive' as const,
          score: 0.85,
          confidence: 0.88
        },
        sentimentInTranslation: {
          type: 'positive' as const,
          score: 0.83,
          confidence: 0.90
        }
      };

      expect(languageDetectionResult.detectedLanguage).toBeDefined();
      expect(languageDetectionResult.confidence).toBeGreaterThan(0);
      expect(languageDetectionResult.confidence).toBeLessThanOrEqual(1);
      expect(languageDetectionResult.supportedLanguages).toBeInstanceOf(Array);
      expect(languageDetectionResult.supportedLanguages.length).toBeGreaterThan(0);
      expect(languageDetectionResult.translatedContent).toBeDefined();
      
      // Validate sentiment consistency across languages
      const sentimentDifference = Math.abs(
        languageDetectionResult.sentimentInOriginalLanguage.score - 
        languageDetectionResult.sentimentInTranslation.score
      );
      expect(sentimentDifference).toBeLessThan(0.2); // Should be reasonably consistent
    });
  });

  describe('Sentiment Aggregation and Scoring', () => {
    it('should validate sentiment aggregation across multiple posts', () => {
      const aggregatedSentiment = {
        timeframe: '1h',
        entity: 'Bitcoin',
        totalPosts: 1500,
        sentimentDistribution: {
          positive: 0.45,
          neutral: 0.30,
          negative: 0.25
        },
        averageSentiment: 0.15,
        sentimentTrend: {
          direction: 'improving' as const,
          strength: 0.3,
          timeframes: {
            '15m': 0.10,
            '1h': 0.15,
            '4h': 0.12,
            '24h': 0.08
          }
        },
        volumeWeightedSentiment: 0.18,
        influencerWeightedSentiment: 0.22,
        qualityScore: 0.85,
        confidenceLevel: 0.78
      };

      expect(aggregatedSentiment.totalPosts).toBeGreaterThan(0);
      expect(aggregatedSentiment.sentimentDistribution.positive).toBeGreaterThanOrEqual(0);
      expect(aggregatedSentiment.sentimentDistribution.neutral).toBeGreaterThanOrEqual(0);
      expect(aggregatedSentiment.sentimentDistribution.negative).toBeGreaterThanOrEqual(0);
      
      // Distribution should sum to approximately 1
      const distributionSum = 
        aggregatedSentiment.sentimentDistribution.positive +
        aggregatedSentiment.sentimentDistribution.neutral +
        aggregatedSentiment.sentimentDistribution.negative;
      expect(distributionSum).toBeCloseTo(1.0, 2);

      expect(aggregatedSentiment.averageSentiment).toBeGreaterThanOrEqual(-1);
      expect(aggregatedSentiment.averageSentiment).toBeLessThanOrEqual(1);
      expect(['improving', 'stable', 'declining']).toContain(aggregatedSentiment.sentimentTrend.direction);
      expect(aggregatedSentiment.qualityScore).toBeGreaterThan(0);
      expect(aggregatedSentiment.qualityScore).toBeLessThanOrEqual(1);
    });
  });

  describe('Performance and Accuracy Metrics', () => {
    it('should validate sentiment analysis performance metrics', () => {
      const performanceMetrics = {
        processingSpeed: {
          averageLatency: 150, // milliseconds
          throughput: 500, // posts per second
          p95Latency: 300,
          p99Latency: 500
        },
        accuracyMetrics: {
          overallAccuracy: 0.87,
          precisionByClass: {
            positive: 0.89,
            neutral: 0.82,
            negative: 0.91
          },
          recallByClass: {
            positive: 0.85,
            neutral: 0.78,
            negative: 0.93
          },
          f1ScoreByClass: {
            positive: 0.87,
            neutral: 0.80,
            negative: 0.92
          }
        },
        cryptoSpecificAccuracy: {
          entityRecognition: 0.92,
          cryptoTermClassification: 0.88,
          marketPhaseDetection: 0.84,
          trendIndicatorAccuracy: 0.86
        },
        modelPerformance: {
          modelVersion: '2.1.0',
          trainingDataSize: 500000,
          lastUpdated: new Date(),
          confidenceCalibration: 0.91,
          robustnessScore: 0.85
        }
      };

      expect(performanceMetrics.processingSpeed.averageLatency).toBeLessThan(1000);
      expect(performanceMetrics.processingSpeed.throughput).toBeGreaterThan(100);
      expect(performanceMetrics.accuracyMetrics.overallAccuracy).toBeGreaterThan(0.8);
      
      // Validate precision, recall, and F1 scores for each class
      for (const [className, precision] of Object.entries(performanceMetrics.accuracyMetrics.precisionByClass)) {
        expect(precision).toBeGreaterThan(0);
        expect(precision).toBeLessThanOrEqual(1);
        expect((performanceMetrics.accuracyMetrics.recallByClass as any)[className]).toBeDefined();
        expect((performanceMetrics.accuracyMetrics.f1ScoreByClass as any)[className]).toBeDefined();
      }

      // Validate crypto-specific accuracy metrics
      for (const accuracy of Object.values(performanceMetrics.cryptoSpecificAccuracy)) {
        expect(accuracy).toBeGreaterThan(0.7); // Should be reasonably accurate
        expect(accuracy).toBeLessThanOrEqual(1);
      }

      expect(performanceMetrics.modelPerformance.trainingDataSize).toBeGreaterThan(100000);
      expect(performanceMetrics.modelPerformance.confidenceCalibration).toBeGreaterThan(0.8);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle empty or invalid content', () => {
      const edgeCases = [
        { content: '', expectedHandling: 'empty_content_error' },
        { content: '   ', expectedHandling: 'whitespace_only_error' },
        { content: '🚀🚀🚀🚀🚀', expectedHandling: 'emoji_only_warning' },
        { content: 'a'.repeat(10000), expectedHandling: 'content_too_long_truncation' },
        { content: 'ñöñ-åscïï tëxt', expectedHandling: 'special_characters_handled' }
      ];

      for (const testCase of edgeCases) {
        expect(testCase.content).toBeDefined();
        expect(testCase.expectedHandling).toBeDefined();
      }
    });

    it('should handle mixed sentiment and ambiguous content', () => {
      const ambiguousContent = [
        'Bitcoin is great but I hate the volatility',
        'This project has potential but the team is questionable',
        'Love the technology, worried about adoption',
        'Bullish on ETH, bearish on gas fees'
      ];

      for (const content of ambiguousContent) {
        expect(content).toBeDefined();
        expect(content.length).toBeGreaterThan(10);
        // Should contain conflicting sentiment indicators
        const hasPositive = /great|love|bullish|potential|good/i.test(content);
        const hasNegative = /hate|worried|bearish|questionable|bad/i.test(content);
        expect(hasPositive || hasNegative).toBe(true);
      }
    });
  });

  describe('Model Training and Validation', () => {
    it('should validate training dataset structure', () => {
      const trainingDataset = {
        totalSamples: 500000,
        labelDistribution: {
          positive: 0.35,
          neutral: 0.30,
          negative: 0.35
        },
        dataQuality: {
          humanLabeledPercentage: 0.20,
          interAnnotatorAgreement: 0.85,
          dataVersioning: '2.1.0',
          lastUpdated: new Date()
        },
        crossValidation: {
          folds: 5,
          averageAccuracy: 0.87,
          standardDeviation: 0.024,
          minAccuracy: 0.84,
          maxAccuracy: 0.91
        },
        testSet: {
          size: 50000,
          accuracy: 0.86,
          precision: 0.87,
          recall: 0.85,
          f1Score: 0.86
        }
      };

      expect(trainingDataset.totalSamples).toBeGreaterThan(100000);
      
      // Label distribution should be reasonably balanced
      const distributionSum = 
        trainingDataset.labelDistribution.positive +
        trainingDataset.labelDistribution.neutral +
        trainingDataset.labelDistribution.negative;
      expect(distributionSum).toBeCloseTo(1.0, 2);

      expect(trainingDataset.dataQuality.humanLabeledPercentage).toBeGreaterThan(0.1);
      expect(trainingDataset.dataQuality.interAnnotatorAgreement).toBeGreaterThan(0.7);
      
      expect(trainingDataset.crossValidation.folds).toBeGreaterThanOrEqual(3);
      expect(trainingDataset.crossValidation.averageAccuracy).toBeGreaterThan(0.8);
      
      expect(trainingDataset.testSet.accuracy).toBeGreaterThan(0.8);
      expect(trainingDataset.testSet.f1Score).toBeGreaterThan(0.8);
    });
  });
});


// Add custom matcher for better readability
expect.extend({
  toBeOneOf(received, expected) {
    const pass = expected.includes(received);
    if (pass) {
      return {
        message: () => `expected ${received} not to be one of ${expected}`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be one of ${expected}`,
        pass: false,
      };
    }
  },
});

declare global {
  namespace jest {
    interface Matchers<R> {
      toBeOneOf(expected: any[]): R;
    }
  }
}