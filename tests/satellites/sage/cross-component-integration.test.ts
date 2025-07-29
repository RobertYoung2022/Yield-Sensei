/**
 * Cross-Component Integration Tests
 * 
 * Tests integration between Sage satellite and other system components,
 * ensuring proper communication and data flow across satellite boundaries.
 */

import { SageSatelliteAgent } from '../../../src/satellites/sage/sage-satellite';
import { AegisSatelliteAgent } from '../../../src/satellites/aegis/aegis-satellite';
import { testUtils, testConfig } from './config/jest.setup';

// Mock other satellites until they're fully implemented
jest.mock('../../../src/satellites/echo/echo-satellite', () => ({
  EchoSatelliteAgent: jest.fn().mockImplementation(() => ({
    initialize: jest.fn().mockResolvedValue(undefined),
    getMarketSentiment: jest.fn().mockResolvedValue({
      sentiment: 'bullish',
      confidence: 0.75,
      factors: [
        { category: 'social', score: 0.8, impact: 'positive' },
        { category: 'news', score: 0.7, impact: 'positive' }
      ]
    }),
    getTrendAnalysis: jest.fn().mockResolvedValue({
      trend: 'upward',
      strength: 0.65,
      duration: '7d',
      indicators: ['volume', 'social', 'technical']
    }),
    shutdown: jest.fn().mockResolvedValue(undefined)
  }))
}));

jest.mock('../../../src/satellites/pulse/pulse-satellite', () => ({
  PulseSatelliteAgent: jest.fn().mockImplementation(() => ({
    initialize: jest.fn().mockResolvedValue(undefined),
    getYieldOpportunities: jest.fn().mockResolvedValue([
      {
        protocol: 'Mock Yield Protocol',
        apy: 0.125,
        tvl: 150000000,
        riskScore: 0.25,
        category: 'lending'
      }
    ]),
    optimizePortfolio: jest.fn().mockResolvedValue({
      allocation: [
        { asset: 'USDC', percentage: 40, yield: 0.05 },
        { asset: 'ETH', percentage: 35, yield: 0.08 },
        { asset: 'BTC', percentage: 25, yield: 0.06 }
      ],
      expectedReturn: 0.063,
      riskScore: 0.35
    }),
    shutdown: jest.fn().mockResolvedValue(undefined)
  }))
}));

jest.mock('../../../src/satellites/bridge/bridge-satellite', () => ({
  BridgeSatelliteAgent: jest.fn().mockImplementation(() => ({
    initialize: jest.fn().mockResolvedValue(undefined),
    findBestRoute: jest.fn().mockResolvedValue({
      route: ['ethereum', 'arbitrum'],
      estimatedTime: 300, // 5 minutes
      estimatedCost: 0.001,
      bridges: ['Arbitrum Bridge']
    }),
    executeCrossChainTransaction: jest.fn().mockResolvedValue({
      txHash: '0xmocktransactionhash',
      status: 'pending',
      estimatedCompletion: Date.now() + 300000
    }),
    shutdown: jest.fn().mockResolvedValue(undefined)
  }))
}));

describe('Cross-Component Integration Tests', () => {
  let sageAgent: SageSatelliteAgent;
  let aegisAgent: AegisSatelliteAgent;
  let mockEchoAgent: any;
  let mockPulseAgent: any;
  let mockBridgeAgent: any;

  const INTEGRATION_RWA_DATA = {
    id: 'integration-rwa-001',
    type: 'tokenized-real-estate',
    issuer: 'Cross-Chain Real Estate Fund',
    value: 2500000,
    currency: 'USDC',
    maturityDate: new Date('2026-06-30'),
    yield: 0.078,
    riskRating: 'A-',
    collateral: {
      type: 'commercial-real-estate',
      value: 3000000,
      ltv: 0.83,
      liquidationThreshold: 0.85
    },
    crossChainData: {
      sourceChain: 'ethereum',
      targetChain: 'arbitrum',
      bridgeProtocol: 'Arbitrum Bridge',
      tokenContract: '0xmocktokencontract'
    },
    regulatoryStatus: {
      jurisdiction: 'US',
      complianceLevel: 'compliant',
      licenses: ['SEC-Registered', 'RWA-Tokenization'],
      restrictions: [],
      lastReview: new Date()
    }
  };

  beforeAll(async () => {
    // Initialize core satellites
    sageAgent = new SageSatelliteAgent({
      name: 'IntegrationTestSage',
      capabilities: ['rwa-scoring', 'protocol-analysis', 'compliance-monitoring']
    });

    aegisAgent = new AegisSatelliteAgent({
      name: 'IntegrationTestAegis',
      riskThresholds: {
        maxPositionSize: 0.1,
        maxLeverage: 3.0,
        maxDrawdown: 0.15
      }
    });

    // Import and initialize mock satellites
    const { EchoSatelliteAgent } = await import('../../../src/satellites/echo/echo-satellite');
    const { PulseSatelliteAgent } = await import('../../../src/satellites/pulse/pulse-satellite');
    const { BridgeSatelliteAgent } = await import('../../../src/satellites/bridge/bridge-satellite');

    mockEchoAgent = new EchoSatelliteAgent({});
    mockPulseAgent = new PulseSatelliteAgent({});
    mockBridgeAgent = new BridgeSatelliteAgent({});

    // Initialize all agents
    await Promise.all([
      sageAgent.initialize(),
      aegisAgent.initialize(),
      mockEchoAgent.initialize(),
      mockPulseAgent.initialize(),
      mockBridgeAgent.initialize()
    ]);
  }, 45000);

  afterAll(async () => {
    await Promise.all([
      sageAgent.shutdown(),
      aegisAgent.shutdown(),
      mockEchoAgent.shutdown(),
      mockPulseAgent.shutdown(),
      mockBridgeAgent.shutdown()
    ]);
  });

  describe('Sage-Aegis Integration', () => {
    test('should integrate RWA scoring with risk management', async () => {
      // Step 1: Sage analyzes RWA opportunity
      const sageAnalysis = await sageAgent.processAnalysisRequest({
        type: 'rwa_analysis',
        data: INTEGRATION_RWA_DATA,
        requirements: ['scoring', 'compliance', 'risk-assessment']
      });

      expect(sageAnalysis).toBeDefined();
      expect(sageAnalysis.rwaScore).toBeValidRWAScore();
      expect(sageAnalysis.complianceAssessment).toBeValidComplianceAssessment();

      // Step 2: Aegis evaluates position risk
      const positionData = {
        id: INTEGRATION_RWA_DATA.id,
        type: 'rwa',
        value: INTEGRATION_RWA_DATA.value,
        expectedReturn: sageAnalysis.rwaScore.riskAdjustedReturn,
        riskScore: 1 - sageAnalysis.rwaScore.overallScore, // Convert to risk (inverse of score)
        metadata: {
          sageAnalysis: sageAnalysis,
          assetType: INTEGRATION_RWA_DATA.type
        }
      };

      const aegisRiskAssessment = await aegisAgent.assessPositionRisk(positionData);

      expect(aegisRiskAssessment).toBeDefined();
      expect(aegisRiskAssessment.riskLevel).toMatch(/^(low|medium|high|critical)$/);
      expect(aegisRiskAssessment.recommendation).toMatch(/^(approve|caution|reject)$/);

      // Integration validation
      if (sageAnalysis.rwaScore.overallScore > 0.8 && 
          sageAnalysis.complianceAssessment.complianceLevel === 'compliant') {
        expect(aegisRiskAssessment.recommendation).not.toBe('reject');
      }

      if (sageAnalysis.rwaScore.overallScore < 0.3) {
        expect(aegisRiskAssessment.recommendation).toBe('reject');
      }
    });

    test('should coordinate risk limits with investment analysis', async () => {
      const portfolioPositions = [
        { id: 'pos-1', value: 500000, riskScore: 0.2 },
        { id: 'pos-2', value: 750000, riskScore: 0.3 },
        { id: 'pos-3', value: 1000000, riskScore: 0.25 }
      ];

      // Current portfolio risk
      const portfolioRisk = await aegisAgent.calculatePortfolioRisk(portfolioPositions);
      
      // Proposed new position (from Sage analysis)
      const proposedPosition = {
        id: INTEGRATION_RWA_DATA.id,
        value: INTEGRATION_RWA_DATA.value,
        riskScore: 0.22 // Based on Sage analysis
      };

      // Check if new position fits within risk limits
      const positionSizeLimit = await aegisAgent.getPositionSizeLimit(proposedPosition);
      const newPortfolioRisk = await aegisAgent.calculatePortfolioRisk([
        ...portfolioPositions,
        proposedPosition
      ]);

      expect(positionSizeLimit).toBeGreaterThan(0);
      expect(newPortfolioRisk.overallRisk).toBeLessThan(0.8); // Risk tolerance threshold

      // Risk-adjusted recommendation
      if (newPortfolioRisk.overallRisk > portfolioRisk.overallRisk * 1.2) {
        expect(positionSizeLimit).toBeLessThan(proposedPosition.value);
      }
    });
  });

  describe('Sage-Echo Integration', () => {
    test('should incorporate market sentiment into RWA analysis', async () => {
      // Step 1: Get market sentiment from Echo
      const marketSentiment = await mockEchoAgent.getMarketSentiment({
        asset: INTEGRATION_RWA_DATA.type,
        timeframe: '7d'
      });

      expect(marketSentiment).toBeDefined();
      expect(marketSentiment.sentiment).toMatch(/^(bullish|bearish|neutral)$/);
      expect(marketSentiment.confidence).toBeInScoreRange(0, 1);

      // Step 2: Sage incorporates sentiment into analysis
      const enhancedAnalysisRequest = {
        type: 'enhanced_rwa_analysis',
        data: INTEGRATION_RWA_DATA,
        marketData: {
          sentiment: marketSentiment,
          timestamp: new Date()
        },
        requirements: ['scoring', 'sentiment-adjusted-scoring']
      };

      const enhancedAnalysis = await sageAgent.processAnalysisRequest(enhancedAnalysisRequest);

      expect(enhancedAnalysis).toBeDefined();
      expect(enhancedAnalysis.rwaScore).toBeValidRWAScore();

      // Sentiment should influence recommendations
      if (marketSentiment.sentiment === 'bullish' && marketSentiment.confidence > 0.7) {
        expect(enhancedAnalysis.rwaScore.recommendations).toHaveElementsMatching(
          rec => rec.action === 'invest' || rec.action === 'buy'
        );
      }

      if (marketSentiment.sentiment === 'bearish' && marketSentiment.confidence > 0.7) {
        expect(enhancedAnalysis.rwaScore.recommendations).toHaveElementsMatching(
          rec => rec.action === 'hold' || rec.action === 'avoid'
        );
      }
    });

    test('should correlate trend analysis with fundamental analysis', async () => {
      const trendAnalysis = await mockEchoAgent.getTrendAnalysis({
        asset: INTEGRATION_RWA_DATA.type,
        timeframe: '30d'
      });

      const fundamentalAnalysis = await sageAgent.processAnalysisRequest({
        type: 'fundamental_analysis',
        data: INTEGRATION_RWA_DATA,
        requirements: ['technical-factors', 'market-trends']
      });

      expect(trendAnalysis).toBeDefined();
      expect(fundamentalAnalysis).toBeDefined();

      // Correlate trend strength with fundamental score
      const correlation = Math.abs(
        trendAnalysis.strength - fundamentalAnalysis.rwaScore.overallScore
      );

      // Strong correlation should result in higher confidence
      if (correlation < 0.2) {
        expect(fundamentalAnalysis.rwaScore.confidence).toBeGreaterThan(0.75);
      }
    });
  });

  describe('Sage-Pulse Integration', () => {
    test('should integrate RWA opportunities with yield optimization', async () => {
      // Step 1: Get yield opportunities from Pulse
      const yieldOpportunities = await mockPulseAgent.getYieldOpportunities({
        riskTolerance: 0.3,
        minimumYield: 0.05,
        categories: ['lending', 'staking', 'rwa']
      });

      expect(yieldOpportunities).toBeDefined();
      expect(yieldOpportunities).toHaveLength(1);

      // Step 2: Sage evaluates RWA within yield context
      const yieldContextAnalysis = await sageAgent.processAnalysisRequest({
        type: 'yield_optimized_analysis',
        data: INTEGRATION_RWA_DATA,
        yieldContext: {
          alternatives: yieldOpportunities,
          targetYield: 0.08,
          riskBudget: 0.25
        },
        requirements: ['comparative-analysis', 'yield-optimization']
      });

      expect(yieldContextAnalysis).toBeDefined();
      expect(yieldContextAnalysis.rwaScore).toBeValidRWAScore();

      // Should provide comparative recommendations
      expect(yieldContextAnalysis.comparativeAnalysis).toBeDefined();
      expect(yieldContextAnalysis.comparativeAnalysis.alternatives).toHaveLength(yieldOpportunities.length);

      // RWA should be ranked relative to alternatives
      const rwaRanking = yieldContextAnalysis.comparativeAnalysis.ranking;
      expect(rwaRanking).toBeGreaterThanOrEqual(1);
      expect(rwaRanking).toBeLessThanOrEqual(yieldOpportunities.length + 1);
    });

    test('should optimize portfolio allocation including RWA', async () => {
      const currentPortfolio = {
        assets: [
          { symbol: 'USDC', allocation: 0.4, yield: 0.05 },
          { symbol: 'ETH', allocation: 0.35, yield: 0.08 },
          { symbol: 'BTC', allocation: 0.25, yield: 0.06 }
        ],
        totalValue: 10000000,
        targetYield: 0.07,
        riskTolerance: 0.3
      };

      // Pulse optimizes portfolio
      const optimizedPortfolio = await mockPulseAgent.optimizePortfolio({
        currentPortfolio,
        newAssets: [{
          symbol: 'RWA-001',
          yield: INTEGRATION_RWA_DATA.yield,
          riskScore: 0.22,
          liquidity: 'low'
        }]
      });

      // Sage validates RWA integration
      const portfolioAnalysis = await sageAgent.processAnalysisRequest({
        type: 'portfolio_rwa_analysis',
        data: INTEGRATION_RWA_DATA,
        portfolioContext: {
          current: currentPortfolio,
          optimized: optimizedPortfolio
        },
        requirements: ['risk-return-analysis', 'diversification-impact']
      });

      expect(optimizedPortfolio).toBeDefined();
      expect(portfolioAnalysis).toBeDefined();

      // Optimization should improve risk-adjusted return
      expect(optimizedPortfolio.expectedReturn).toBeGreaterThanOrEqual(currentPortfolio.targetYield);
      expect(optimizedPortfolio.riskScore).toBeLessThanOrEqual(currentPortfolio.riskTolerance);

      // Sage should validate diversification benefits
      expect(portfolioAnalysis.diversificationScore).toBeInScoreRange(0, 1);
      if (portfolioAnalysis.diversificationScore > 0.7) {
        expect(portfolioAnalysis.recommendation.action).toBe('invest');
      }
    });
  });

  describe('Sage-Bridge Integration', () => {
    test('should analyze cross-chain RWA opportunities', async () => {
      // Step 1: Bridge finds optimal route for cross-chain RWA
      const bridgeRoute = await mockBridgeAgent.findBestRoute({
        fromChain: INTEGRATION_RWA_DATA.crossChainData.sourceChain,
        toChain: INTEGRATION_RWA_DATA.crossChainData.targetChain,
        asset: 'USDC',
        amount: INTEGRATION_RWA_DATA.value
      });

      expect(bridgeRoute).toBeDefined();
      expect(bridgeRoute.estimatedCost).toBeGreaterThan(0);
      expect(bridgeRoute.estimatedTime).toBeGreaterThan(0);

      // Step 2: Sage incorporates bridge costs into RWA analysis
      const crossChainAnalysis = await sageAgent.processAnalysisRequest({
        type: 'cross_chain_rwa_analysis',
        data: INTEGRATION_RWA_DATA,
        bridgeData: {
          route: bridgeRoute,
          fees: bridgeRoute.estimatedCost,
          timeToComplete: bridgeRoute.estimatedTime
        },
        requirements: ['net-yield-calculation', 'cross-chain-risk-assessment']
      });

      expect(crossChainAnalysis).toBeDefined();
      expect(crossChainAnalysis.rwaScore).toBeValidRWAScore();

      // Bridge costs should be factored into net yield
      expect(crossChainAnalysis.netYield).toBeLessThan(INTEGRATION_RWA_DATA.yield);
      expect(crossChainAnalysis.crossChainRisks).toBeDefined();

      // Time factor should influence liquidity score
      if (bridgeRoute.estimatedTime > 3600) { // > 1 hour
        expect(crossChainAnalysis.liquidityScore).toBeLessThan(0.7);
      }
    });

    test('should coordinate cross-chain execution with analysis', async () => {
      // Sage confirms investment decision
      const investmentDecision = await sageAgent.processAnalysisRequest({
        type: 'investment_decision',
        data: INTEGRATION_RWA_DATA,
        requirements: ['final-recommendation', 'execution-readiness']
      });

      expect(investmentDecision.recommendation.action).toMatch(/^(invest|hold|avoid)$/);

      if (investmentDecision.recommendation.action === 'invest') {
        // Bridge executes the cross-chain transaction
        const execution = await mockBridgeAgent.executeCrossChainTransaction({
          fromChain: INTEGRATION_RWA_DATA.crossChainData.sourceChain,
          toChain: INTEGRATION_RWA_DATA.crossChainData.targetChain,
          asset: 'USDC',
          amount: INTEGRATION_RWA_DATA.value,
          recipient: INTEGRATION_RWA_DATA.crossChainData.tokenContract
        });

        expect(execution).toBeDefined();
        expect(execution.txHash).toBeTruthy();
        expect(execution.status).toBe('pending');

        // Sage should track execution status
        const executionTracking = await sageAgent.trackInvestmentExecution({
          investmentId: INTEGRATION_RWA_DATA.id,
          transactionHash: execution.txHash,
          status: execution.status
        });

        expect(executionTracking).toBeDefined();
        expect(executionTracking.status).toBe('pending');
        expect(executionTracking.estimatedCompletion).toBeDefined();
      }
    });
  });

  describe('Multi-Satellite Orchestration', () => {
    test('should orchestrate comprehensive investment workflow', async () => {
      const workflowSteps: Record<string, any> = {};

      // Step 1: Market sentiment and trend analysis (Echo)
      workflowSteps.sentiment = await mockEchoAgent.getMarketSentiment({
        asset: INTEGRATION_RWA_DATA.type
      });
      
      workflowSteps.trends = await mockEchoAgent.getTrendAnalysis({
        asset: INTEGRATION_RWA_DATA.type
      });

      // Step 2: Yield optimization context (Pulse)
      workflowSteps.yieldContext = await mockPulseAgent.getYieldOpportunities({
        riskTolerance: 0.3
      });

      // Step 3: Cross-chain analysis (Bridge)
      workflowSteps.bridgeRoute = await mockBridgeAgent.findBestRoute({
        fromChain: INTEGRATION_RWA_DATA.crossChainData.sourceChain,
        toChain: INTEGRATION_RWA_DATA.crossChainData.targetChain,
        asset: 'USDC',
        amount: INTEGRATION_RWA_DATA.value
      });

      // Step 4: Comprehensive RWA analysis (Sage)
      workflowSteps.sageAnalysis = await sageAgent.processAnalysisRequest({
        type: 'comprehensive_analysis',
        data: INTEGRATION_RWA_DATA,
        context: {
          sentiment: workflowSteps.sentiment,
          trends: workflowSteps.trends,
          yieldAlternatives: workflowSteps.yieldContext,
          bridgeData: workflowSteps.bridgeRoute
        },
        requirements: ['full-analysis', 'integrated-recommendation']
      });

      // Step 5: Risk assessment and position sizing (Aegis)
      workflowSteps.riskAssessment = await aegisAgent.assessPositionRisk({
        id: INTEGRATION_RWA_DATA.id,
        value: INTEGRATION_RWA_DATA.value,
        riskScore: 1 - workflowSteps.sageAnalysis.rwaScore.overallScore,
        metadata: {
          sageAnalysis: workflowSteps.sageAnalysis,
          marketContext: workflowSteps.sentiment
        }
      });

      // Validate workflow completion
      expect(workflowSteps.sentiment).toBeDefined();
      expect(workflowSteps.trends).toBeDefined();
      expect(workflowSteps.yieldContext).toBeDefined();
      expect(workflowSteps.bridgeRoute).toBeDefined();
      expect(workflowSteps.sageAnalysis).toBeDefined();
      expect(workflowSteps.riskAssessment).toBeDefined();

      // Validate integrated decision making
      const finalRecommendation = workflowSteps.sageAnalysis.recommendation;
      const riskApproval = workflowSteps.riskAssessment.recommendation;

      expect(finalRecommendation.action).toMatch(/^(invest|hold|avoid)$/);
      expect(riskApproval).toMatch(/^(approve|caution|reject)$/);

      // Risk management should override positive analysis if risk is too high
      if (riskApproval === 'reject') {
        expect(finalRecommendation.action).not.toBe('invest');
      }

      // Strong positive signals across satellites should align
      if (workflowSteps.sentiment.sentiment === 'bullish' &&
          workflowSteps.trends.trend === 'upward' &&
          workflowSteps.sageAnalysis.rwaScore.overallScore > 0.8 &&
          riskApproval === 'approve') {
        expect(finalRecommendation.action).toBe('invest');
      }
    });

    test('should handle satellite communication failures gracefully', async () => {
      // Simulate Echo satellite failure
      mockEchoAgent.getMarketSentiment.mockRejectedValueOnce(new Error('Echo satellite unavailable'));

      const analysisWithFailure = await sageAgent.processAnalysisRequest({
        type: 'resilient_analysis',
        data: INTEGRATION_RWA_DATA,
        fallbackOptions: {
          skipSentiment: true,
          useCachedData: true,
          degradedMode: true
        },
        requirements: ['scoring', 'compliance']
      });

      expect(analysisWithFailure).toBeDefined();
      expect(analysisWithFailure.rwaScore).toBeValidRWAScore();
      
      // Should indicate degraded analysis
      expect(analysisWithFailure.metadata.degradedMode).toBe(true);
      expect(analysisWithFailure.metadata.missingComponents).toContain('sentiment');
      
      // Confidence should be lower due to missing data
      expect(analysisWithFailure.rwaScore.confidence).toBeLessThan(0.8);
    });

    test('should maintain performance under multi-satellite load', async () => {
      const startTime = performance.now();
      const startMemory = global.testUtils.getMemoryUsage();

      // Simulate high-load scenario with concurrent requests
      const concurrentAnalyses = Array.from({ length: 5 }, (_, i) => 
        sageAgent.processAnalysisRequest({
          type: 'concurrent_analysis',
          data: {
            ...INTEGRATION_RWA_DATA,
            id: `concurrent-rwa-${i}`
          },
          requirements: ['scoring', 'compliance']
        })
      );

      const results = await Promise.all(concurrentAnalyses);
      
      const endTime = performance.now();
      const endMemory = global.testUtils.getMemoryUsage();

      // Performance validation
      const totalDuration = endTime - startTime;
      const avgDuration = totalDuration / results.length;
      const memoryUsage = endMemory.heapUsed - startMemory.heapUsed;

      expect(avgDuration).toBeLessThan(5000); // Average < 5 seconds
      expect(memoryUsage).toBeWithinMemoryLimit(200); // Memory growth < 200MB
      
      // All results should be valid
      for (const result of results) {
        expect(result).toBeDefined();
        expect(result.rwaScore).toBeValidRWAScore();
      }
    });
  });

  describe('Data Flow and State Management', () => {
    test('should maintain consistent state across satellite interactions', async () => {
      const sessionId = `integration-session-${Date.now()}`;
      
      // Initialize session state
      const sessionState = {
        sessionId,
        userId: 'test-user-001',
        preferences: {
          riskTolerance: 0.3,
          targetYield: 0.08,
          preferredChains: ['ethereum', 'arbitrum']
        },
        portfolio: {
          totalValue: 5000000,
          positions: 3,
          riskScore: 0.25
        }
      };

      // Each satellite should maintain session context
      await sageAgent.initializeSession(sessionState);
      await aegisAgent.initializeSession(sessionState);

      // Sage analysis with session context
      const contextualAnalysis = await sageAgent.processAnalysisRequest({
        type: 'contextual_analysis',
        sessionId,
        data: INTEGRATION_RWA_DATA,
        requirements: ['personalized-scoring', 'portfolio-fit']
      });

      // Aegis risk assessment with same session
      const contextualRisk = await aegisAgent.assessPositionRisk({
        sessionId,
        id: INTEGRATION_RWA_DATA.id,
        value: INTEGRATION_RWA_DATA.value,
        riskScore: 1 - contextualAnalysis.rwaScore.overallScore
      });

      // Validate state consistency
      expect(contextualAnalysis.sessionContext).toBeDefined();
      expect(contextualAnalysis.sessionContext.userId).toBe(sessionState.userId);
      expect(contextualRisk.sessionContext).toBeDefined();
      expect(contextualRisk.sessionContext.userId).toBe(sessionState.userId);

      // Personalization should be applied
      if (sessionState.preferences.riskTolerance < 0.4) {
        expect(contextualAnalysis.rwaScore.overallScore).toBeLessThanOrEqual(
          contextualAnalysis.baseScore * 1.1 // Should not be boosted much for low risk tolerance
        );
      }
    });

    test('should handle data validation across satellite boundaries', async () => {
      // Invalid data that should be caught by cross-satellite validation
      const invalidRWAData = {
        ...INTEGRATION_RWA_DATA,
        yield: 2.5, // Unrealistic 250% yield
        value: -1000000, // Negative value
        riskRating: 'INVALID' // Invalid rating
      };

      // Sage should validate and sanitize data
      await expect(
        sageAgent.processAnalysisRequest({
          type: 'validation_test',
          data: invalidRWAData,
          requirements: ['strict-validation']
        })
      ).rejects.toThrow(/validation|invalid/i);

      // Aegis should also reject invalid data
      await expect(
        aegisAgent.assessPositionRisk({
          id: invalidRWAData.id,
          value: invalidRWAData.value,
          riskScore: 0.5
        })
      ).rejects.toThrow(/validation|invalid/i);
    });
  });
});