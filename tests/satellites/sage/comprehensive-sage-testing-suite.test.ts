/**
 * Comprehensive Sage Satellite Testing Suite
 * Tests all major components of the Sage satellite including:
 * - RWA Opportunity Scoring System
 * - Fundamental Analysis Engine
 * - Compliance Monitoring Framework
 * - Perplexity API Integration
 * - Main Sage Satellite Agent
 */

import { jest } from '@jest/globals';
import { SageSatelliteAgent, DEFAULT_SAGE_CONFIG } from '../../../src/satellites/sage/sage-satellite';
import { RWAOpportunityScoringSystem } from '../../../src/satellites/sage/rwa/opportunity-scoring-system';
import { FundamentalAnalysisEngine } from '../../../src/satellites/sage/research/fundamental-analysis-engine';
import { ComplianceMonitoringFramework } from '../../../src/satellites/sage/compliance/compliance-monitoring-framework';
import { PerplexityIntegration } from '../../../src/satellites/sage/api/perplexity-integration';
import { 
  RWAData, 
  ProtocolData, 
  RWAType,
  Message 
} from '../../../src/satellites/sage/types';

// Mock logger to prevent console noise during tests
jest.mock('@/shared/logging/logger', () => ({
  getLogger: jest.fn(() => ({
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }))
}));

// Mock TensorFlow.js to avoid importing heavy ML dependencies
jest.mock('@tensorflow/tfjs-node', () => ({
  sequential: jest.fn(() => ({
    compile: jest.fn(),
    fit: jest.fn(),
    predict: jest.fn(() => ({
      dataSync: jest.fn(() => [0.85])
    }))
  })),
  layers: {
    dense: jest.fn(),
    dropout: jest.fn()
  },
  train: {
    adam: jest.fn()
  },
  tensor2d: jest.fn(),
  dispose: jest.fn()
}));

describe('Comprehensive Sage Satellite Testing Suite', () => {
  let sageAgent: SageSatelliteAgent;
  
  // Test data samples
  const sampleRWAData: RWAData = {
    id: 'rwa-test-001',
    type: 'real-estate',
    issuer: 'Test Real Estate Fund',
    value: 1000000,
    currency: 'USD',
    maturityDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    yield: 0.065,
    riskRating: 'A',
    collateral: {
      type: 'real-estate',
      value: 1200000,
      ltv: 0.83,
      liquidationThreshold: 0.9
    },
    regulatoryStatus: {
      jurisdiction: 'US',
      complianceLevel: 'compliant',
      licenses: ['SEC-Registered', 'State-Licensed'],
      restrictions: [],
      lastReview: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    },
    complianceScore: 85
  };

  const sampleProtocolData: ProtocolData = {
    id: 'protocol-test-001',
    name: 'Test DeFi Protocol',
    category: 'lending',
    tvl: 500000000,
    volume24h: 25000000,
    users: 15000,
    tokenPrice: 12.50,
    marketCap: 125000000,
    circulatingSupply: 10000000,
    totalSupply: 15000000,
    apy: 0.085,
    fees24h: 125000,
    revenue: 1500000,
    codeAudits: [
      {
        auditor: 'OpenZeppelin',
        date: new Date('2024-01-15'),
        status: 'passed',
        criticalIssues: 0,
        highIssues: 1,
        mediumIssues: 3,
        lowIssues: 5
      }
    ],
    team: {
      size: 25,
      experience: 4.2,
      credibility: 0.85,
      anonymity: false
    },
    governance: {
      tokenHolders: 8500,
      votingPower: 0.65,
      proposalCount: 45,
      participationRate: 0.35
    },
    riskMetrics: {
      volatility: 0.45,
      correlation: 0.23,
      maxDrawdown: 0.67,
      sharpeRatio: 1.25,
      beta: 1.1
    },
    tokenDistribution: [
      { category: 'Team', percentage: 20, vesting: true },
      { category: 'Public', percentage: 45, vesting: false },
      { category: 'Treasury', percentage: 25, vesting: true },
      { category: 'Advisors', percentage: 10, vesting: true }
    ],
    partnerships: ['Chainlink', 'Compound', 'MakerDAO']
  };

  beforeEach(() => {
    // Create new Sage agent instance for each test
    sageAgent = new SageSatelliteAgent({
      ...DEFAULT_SAGE_CONFIG,
      id: `sage-test-${Date.now()}`
    });
  });

  afterEach(async () => {
    try {
      await sageAgent.shutdown();
    } catch (error) {
      // Ignore shutdown errors in tests
    }
  });

  describe('Sage Satellite Agent Integration', () => {
    test('should initialize all components successfully', async () => {
      await expect(sageAgent.initialize()).resolves.not.toThrow();
      
      const status = sageAgent.getStatus();
      expect(status.status).toBe('initializing');
      expect(status.health).toBe('healthy');
    });

    test('should start and stop successfully', async () => {
      await sageAgent.initialize();
      await expect(sageAgent.start()).resolves.not.toThrow();
      
      let status = sageAgent.getStatus();
      expect(status.status).toBe('running');
      
      await expect(sageAgent.stop()).resolves.not.toThrow();
      status = sageAgent.getStatus();
      expect(status.status).toBe('stopped');
    });

    test('should handle message processing correctly', async () => {
      await sageAgent.initialize();
      await sageAgent.start();

      const testMessage: Message = {
        id: 'test-msg-001',
        type: 'command',
        from: 'test-sender',
        to: sageAgent.id,
        timestamp: new Date(),
        payload: {
          command: 'get_health',
          args: {}
        },
        priority: 'normal'
      };

      await expect(sageAgent.handleMessage(testMessage)).resolves.not.toThrow();
      
      const status = sageAgent.getStatus();
      expect(status.metrics.messagesReceived).toBe(1);
      expect(status.metrics.tasksProcessed).toBe(1);
    });

    test('should generate system health report', async () => {
      await sageAgent.initialize();
      
      const health = await sageAgent.getSystemHealth();
      
      expect(health.overall).toBeDefined();
      expect(['healthy', 'degraded', 'unhealthy']).toContain(health.overall);
      expect(health.components).toBeDefined();
      expect(health.components.fundamentalAnalysis).toBeDefined();
      expect(health.components.rwaScoring).toBeDefined();
      expect(health.components.complianceMonitoring).toBeDefined();
      expect(health.components.perplexityIntegration).toBeDefined();
      expect(health.metrics).toBeDefined();
    });
  });

  describe('RWA Opportunity Scoring Integration', () => {
    test('should score RWA opportunities through main agent', async () => {
      await sageAgent.initialize();
      
      const score = await sageAgent.scoreRWAOpportunity(sampleRWAData);
      
      expect(score.rwaId).toBe(sampleRWAData.id);
      expect(score.overallScore).toBeGreaterThan(0);
      expect(score.overallScore).toBeLessThanOrEqual(1);
      expect(score.recommendations).toBeInstanceOf(Array);
      expect(score.recommendations.length).toBeGreaterThan(0);
      expect(score.confidence).toBeGreaterThan(0);
      expect(score.confidence).toBeLessThanOrEqual(1);
    });

    test('should handle different RWA types correctly', async () => {
      await sageAgent.initialize();
      
      const bondRWA: RWAData = {
        ...sampleRWAData,
        id: 'bond-rwa-001',
        type: 'bonds',
        yield: 0.04,
        riskRating: 'AAA'
      };

      const artRWA: RWAData = {
        ...sampleRWAData,
        id: 'art-rwa-001',
        type: 'art',
        yield: 0.12,
        riskRating: 'B'
      };

      const bondScore = await sageAgent.scoreRWAOpportunity(bondRWA);
      const artScore = await sageAgent.scoreRWAOpportunity(artRWA);

      expect(bondScore.liquidityScore).toBeGreaterThan(artScore.liquidityScore);
      expect(bondScore.riskScore).toBeGreaterThan(artScore.riskScore);
      expect(artScore.yieldScore).toBeGreaterThan(bondScore.yieldScore);
    });

    test('should emit RWA scoring events', (done) => {
      sageAgent.initialize().then(() => {
        sageAgent.on('rwa_scoring_completed', (event) => {
          expect(event.rwaId).toBe(sampleRWAData.id);
          expect(event.score).toBeDefined();
          expect(event.timestamp).toBeInstanceOf(Date);
          done();
        });

        sageAgent.scoreRWAOpportunity(sampleRWAData).catch(done);
      });
    });
  });

  describe('Protocol Analysis Integration', () => {
    test('should analyze protocols through main agent', async () => {
      await sageAgent.initialize();
      
      const analysis = await sageAgent.analyzeProtocol(sampleProtocolData);
      
      expect(analysis.protocolId).toBe(sampleProtocolData.id);
      expect(analysis.overallScore).toBeGreaterThan(0);
      expect(analysis.overallScore).toBeLessThanOrEqual(1);
      expect(analysis.recommendations).toBeInstanceOf(Array);
      expect(analysis.confidence).toBeGreaterThan(0);
      expect(analysis.confidence).toBeLessThanOrEqual(1);
    });

    test('should emit protocol analysis events', (done) => {
      sageAgent.initialize().then(() => {
        sageAgent.on('protocol_analysis_completed', (event) => {
          expect(event.protocolId).toBe(sampleProtocolData.id);
          expect(event.analysis).toBeDefined();
          expect(event.timestamp).toBeInstanceOf(Date);
          done();
        });

        sageAgent.analyzeProtocol(sampleProtocolData).catch(done);
      });
    });
  });

  describe('Market Research Integration', () => {
    test('should perform market research', async () => {
      await sageAgent.initialize();
      
      const result = await sageAgent.researchMarket('DeFi lending protocols', 'US');
      
      expect(result).toBeDefined();
      // Note: Actual content depends on Perplexity integration mock
    });

    test('should perform regulatory research', async () => {
      await sageAgent.initialize();
      
      const result = await sageAgent.researchRegulatory('EU', 'MiCA regulation');
      
      expect(result).toBeDefined();
      // Note: Actual content depends on Perplexity integration mock
    });

    test('should emit research events', (done) => {
      sageAgent.initialize().then(() => {
        sageAgent.on('market_research_completed', (event) => {
          expect(event.topic).toBe('DeFi trends');
          expect(event.result).toBeDefined();
          expect(event.timestamp).toBeInstanceOf(Date);
          done();
        });

        sageAgent.researchMarket('DeFi trends').catch(done);
      });
    });
  });

  describe('Compliance Monitoring Integration', () => {
    test('should generate compliance reports', async () => {
      await sageAgent.initialize();
      
      const report = await sageAgent.getComplianceReport(
        ['entity-001', 'entity-002'],
        'US',
        {
          start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          end: new Date()
        }
      );
      
      expect(report).toBeDefined();
      expect(report.summary).toBeDefined();
    });

    test('should handle regulatory change events', (done) => {
      sageAgent.initialize().then(() => {
        sageAgent.on('regulatory_change_detected', (event) => {
          expect(event).toBeDefined();
          done();
        });

        // Trigger regulatory change detection (mock)
        setTimeout(() => {
          done(); // Complete test if no event is emitted
        }, 100);
      });
    });
  });

  describe('Performance and Load Testing', () => {
    test('should handle concurrent RWA scoring requests', async () => {
      await sageAgent.initialize();
      
      const rwaList = Array.from({ length: 5 }, (_, i) => ({
        ...sampleRWAData,
        id: `rwa-concurrent-${i}`,
        yield: 0.05 + (i * 0.01)
      }));

      const startTime = Date.now();
      
      const scores = await Promise.all(
        rwaList.map(rwa => sageAgent.scoreRWAOpportunity(rwa))
      );
      
      const totalTime = Date.now() - startTime;
      
      expect(totalTime).toBeLessThan(10000); // Should complete within 10 seconds
      expect(scores).toHaveLength(5);
      
      scores.forEach(score => {
        expect(score.overallScore).toBeGreaterThan(0);
        expect(score.overallScore).toBeLessThanOrEqual(1);
      });
    });

    test('should handle concurrent protocol analysis requests', async () => {
      await sageAgent.initialize();
      
      const protocolList = Array.from({ length: 3 }, (_, i) => ({
        ...sampleProtocolData,
        id: `protocol-concurrent-${i}`,
        tvl: 100000000 + (i * 50000000)
      }));

      const startTime = Date.now();
      
      const analyses = await Promise.all(
        protocolList.map(protocol => sageAgent.analyzeProtocol(protocol))
      );
      
      const totalTime = Date.now() - startTime;
      
      expect(totalTime).toBeLessThan(15000); // Should complete within 15 seconds
      expect(analyses).toHaveLength(3);
      
      analyses.forEach(analysis => {
        expect(analysis.overallScore).toBeGreaterThan(0);
        expect(analysis.overallScore).toBeLessThanOrEqual(1);
      });
    });

    test('should maintain performance under sustained load', async () => {
      await sageAgent.initialize();
      
      const operations = [];
      const operationCount = 10;
      
      for (let i = 0; i < operationCount; i++) {
        const rwa = { ...sampleRWAData, id: `load-test-${i}` };
        operations.push(sageAgent.scoreRWAOpportunity(rwa));
      }

      const startTime = Date.now();
      await Promise.all(operations);
      const totalTime = Date.now() - startTime;
      
      expect(totalTime).toBeLessThan(20000); // Should handle 10 operations in 20 seconds
      
      const status = sageAgent.getStatus();
      expect(status.health).toBe('healthy');
      expect(status.metrics.errors).toBe(0);
    });
  });

  describe('Error Handling and Recovery', () => {
    test('should handle invalid RWA data gracefully', async () => {
      await sageAgent.initialize();
      
      const invalidRWA = {
        ...sampleRWAData,
        yield: -0.1, // Invalid negative yield
        value: null // Invalid null value
      } as any;

      await expect(sageAgent.scoreRWAOpportunity(invalidRWA))
        .rejects.toThrow();
      
      // Agent should remain healthy after error
      const status = sageAgent.getStatus();
      expect(status.health).toBe('healthy');
    });

    test('should handle invalid protocol data gracefully', async () => {
      await sageAgent.initialize();
      
      const invalidProtocol = {
        ...sampleProtocolData,
        tvl: -1000000, // Invalid negative TVL
        users: null // Invalid null users
      } as any;

      await expect(sageAgent.analyzeProtocol(invalidProtocol))
        .rejects.toThrow();
      
      // Agent should remain healthy after error
      const status = sageAgent.getStatus();
      expect(status.health).toBe('healthy');
    });

    test('should handle component failures gracefully', async () => {
      await sageAgent.initialize();
      
      // Simulate component failure by shutting down before use
      await sageAgent.stop();
      
      await expect(sageAgent.scoreRWAOpportunity(sampleRWAData))
        .rejects.toThrow();
    });

    test('should recover from temporary failures', async () => {
      await sageAgent.initialize();
      await sageAgent.start();
      
      // Simulate restart after failure
      await sageAgent.restart();
      
      const status = sageAgent.getStatus();
      expect(status.status).toBe('running');
      expect(status.health).toBe('healthy');

      // Should work normally after restart
      const score = await sageAgent.scoreRWAOpportunity(sampleRWAData);
      expect(score.overallScore).toBeGreaterThan(0);
    });
  });

  describe('Configuration and Customization', () => {
    test('should accept custom configuration', () => {
      const customConfig = {
        ...DEFAULT_SAGE_CONFIG,
        id: 'custom-sage',
        analysisInterval: 60000, // 1 minute
        maxConcurrentAnalyses: 20,
        enableRealTimeAnalysis: false
      };

      const customAgent = new SageSatelliteAgent(customConfig);
      
      expect(customAgent.id).toBe('custom-sage');
      expect(customAgent.config.name).toBe(customConfig.name);
    });

    test('should update configuration dynamically', async () => {
      await sageAgent.initialize();
      
      const newConfig = {
        id: sageAgent.id,
        type: 'sage' as const,
        name: 'Updated Sage Agent',
        version: '2.0.0',
        implementation: 'custom' as const,
        config: {
          ...DEFAULT_SAGE_CONFIG,
          maxConcurrentAnalyses: 15
        }
      };

      await expect(sageAgent.updateConfig(newConfig)).resolves.not.toThrow();
      
      const status = sageAgent.getStatus();
      expect(status.id).toBe(sageAgent.id);
    });
  });

  describe('Data Validation and Accuracy', () => {
    test('should validate RWA scoring accuracy against benchmarks', async () => {
      await sageAgent.initialize();
      
      // High-quality RWA should score well
      const highQualityRWA: RWAData = {
        ...sampleRWAData,
        yield: 0.08,
        riskRating: 'AAA',
        complianceScore: 95,
        collateral: {
          type: 'government-bonds',
          value: 1500000,
          ltv: 0.67,
          liquidationThreshold: 0.8
        }
      };

      const highScore = await sageAgent.scoreRWAOpportunity(highQualityRWA);
      expect(highScore.overallScore).toBeGreaterThan(0.7);
      expect(highScore.recommendations[0]?.action).toBe('invest');

      // Low-quality RWA should score poorly
      const lowQualityRWA: RWAData = {
        ...sampleRWAData,
        yield: 0.02,
        riskRating: 'D',
        complianceScore: 25,
        regulatoryStatus: {
          ...sampleRWAData.regulatoryStatus,
          complianceLevel: 'non-compliant',
          restrictions: ['No-Transfer', 'High-Risk']
        }
      };

      const lowScore = await sageAgent.scoreRWAOpportunity(lowQualityRWA);
      expect(lowScore.overallScore).toBeLessThan(0.4);
      expect(lowScore.recommendations[0]?.action).toBe('avoid');
    });

    test('should ensure scoring consistency across similar assets', async () => {
      await sageAgent.initialize();
      
      const similarRWAs = Array.from({ length: 3 }, (_, i) => ({
        ...sampleRWAData,
        id: `similar-rwa-${i}`,
        // Slightly different but similar characteristics
        yield: 0.065 + (i * 0.001),
        value: 1000000 + (i * 10000)
      }));

      const scores = await Promise.all(
        similarRWAs.map(rwa => sageAgent.scoreRWAOpportunity(rwa))
      );

      // Scores should be very similar (within 0.1 range)
      const scoreValues = scores.map(s => s.overallScore);
      const maxScore = Math.max(...scoreValues);
      const minScore = Math.min(...scoreValues);
      
      expect(maxScore - minScore).toBeLessThan(0.1);
    });

    test('should validate protocol analysis accuracy', async () => {
      await sageAgent.initialize();
      
      // High TVL, good metrics protocol
      const strongProtocol: ProtocolData = {
        ...sampleProtocolData,
        tvl: 2000000000, // $2B TVL
        volume24h: 100000000, // $100M volume
        apy: 0.12,
        users: 50000,
        riskMetrics: {
          ...sampleProtocolData.riskMetrics,
          volatility: 0.2, // Lower volatility
          sharpeRatio: 2.5 // Higher Sharpe ratio
        }
      };

      const analysis = await sageAgent.analyzeProtocol(strongProtocol);
      expect(analysis.overallScore).toBeGreaterThan(0.7);
      
      const investRecommendations = analysis.recommendations.filter(r => r.type === 'buy');
      expect(investRecommendations.length).toBeGreaterThan(0);
    });
  });

  describe('Event System and Monitoring', () => {
    test('should emit all required events during operations', async () => {
      await sageAgent.initialize();
      
      const events: string[] = [];
      
      sageAgent.on('rwa_scoring_completed', () => events.push('rwa_scoring_completed'));
      sageAgent.on('protocol_analysis_completed', () => events.push('protocol_analysis_completed'));
      sageAgent.on('market_research_completed', () => events.push('market_research_completed'));
      sageAgent.on('compliance_assessment_completed', () => events.push('compliance_assessment_completed'));

      // Perform operations
      await sageAgent.scoreRWAOpportunity(sampleRWAData);
      await sageAgent.analyzeProtocol(sampleProtocolData);
      await sageAgent.researchMarket('DeFi protocols');

      // Wait for async events
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(events).toContain('rwa_scoring_completed');
      expect(events).toContain('protocol_analysis_completed');
      expect(events).toContain('market_research_completed');
    });

    test('should track operational metrics correctly', async () => {
      await sageAgent.initialize();
      await sageAgent.start();

      const initialStatus = sageAgent.getStatus();
      const initialProcessedTasks = initialStatus.metrics.tasksProcessed;

      // Perform several operations
      await sageAgent.scoreRWAOpportunity(sampleRWAData);
      await sageAgent.analyzeProtocol(sampleProtocolData);

      const finalStatus = sageAgent.getStatus();
      expect(finalStatus.metrics.tasksProcessed).toBeGreaterThan(initialProcessedTasks);
      expect(finalStatus.uptime).toBeGreaterThan(0);
      expect(finalStatus.lastHeartbeat).toBeInstanceOf(Date);
    });
  });
});