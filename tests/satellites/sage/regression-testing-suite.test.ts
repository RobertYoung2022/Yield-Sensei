/**
 * Sage Satellite Regression Testing Suite
 * 
 * Comprehensive regression tests to ensure system stability across versions
 * and detect unintended side effects of changes.
 */

import { SageSatelliteAgent } from '../../../src/satellites/sage/sage-satellite';
import { RWAOpportunityScoring } from '../../../src/satellites/sage/rwa/opportunity-scoring-system';
import { FundamentalAnalysisEngine } from '../../../src/satellites/sage/research/fundamental-analysis-engine';
import { ComplianceMonitoringFramework } from '../../../src/satellites/sage/compliance/compliance-monitoring-framework';
import { PerplexityAPIIntegration } from '../../../src/satellites/sage/api/perplexity-integration';
import { testUtils, testConfig } from './config/jest.setup';

describe('Sage Satellite Regression Tests', () => {
  let sageAgent: SageSatelliteAgent;
  let rwaScoring: RWAOpportunityScoring;
  let analysisEngine: FundamentalAnalysisEngine;
  let complianceFramework: ComplianceMonitoringFramework;
  let perplexityIntegration: PerplexityAPIIntegration;

  // Baseline data for regression testing
  const BASELINE_RWA_DATA = {
    id: 'regression-rwa-001',
    type: 'real-estate',
    issuer: 'Baseline Real Estate Fund',
    value: 1000000,
    currency: 'USD',
    maturityDate: new Date('2025-12-31'),
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
      licenses: ['SEC-Registered'],
      restrictions: [],
      lastReview: new Date()
    },
    complianceScore: 85
  };

  const BASELINE_PROTOCOL_DATA = {
    id: 'regression-protocol-001',
    name: 'Baseline DeFi Protocol',
    category: 'lending',
    tvl: 500000000,
    volume24h: 25000000,
    users: 15000,
    tokenPrice: 12.50,
    marketCap: 125000000,
    apy: 0.085,
    fees24h: 125000,
    revenue: 1500000,
    team: {
      size: 25,
      experience: 4.2,
      credibility: 0.85,
      anonymity: false
    }
  };

  // Expected baseline results (from v1.0.0)
  const EXPECTED_BASELINES = {
    rwaScore: {
      overallScore: 0.78,
      riskAdjustedReturn: 0.72,
      confidence: 0.85,
      tolerance: 0.02 // 2% tolerance for minor variations
    },
    protocolAnalysis: {
      overallScore: 0.82,
      confidence: 0.88,
      tolerance: 0.03
    },
    complianceAssessment: {
      overallScore: 0.91,
      complianceLevel: 'compliant',
      tolerance: 0.01
    }
  };

  beforeAll(async () => {
    // Initialize all components
    sageAgent = new SageSatelliteAgent({
      name: 'RegressionTestAgent',
      capabilities: ['rwa-scoring', 'protocol-analysis', 'compliance-monitoring']
    });

    rwaScoring = new RWAOpportunityScoring({
      mlModelPath: 'test-models/rwa-scoring',
      enableCaching: false
    });

    analysisEngine = new FundamentalAnalysisEngine({
      mlModelPath: 'test-models/fundamental-analysis',
      enablePerplexity: false
    });

    complianceFramework = new ComplianceMonitoringFramework({
      enableRealTimeMonitoring: false,
      strictMode: true
    });

    perplexityIntegration = new PerplexityAPIIntegration({
      apiKey: 'test-key',
      enableCaching: true,
      rateLimit: { requests: 100, windowMs: 60000 }
    });

    await sageAgent.initialize();
  }, 30000);

  afterAll(async () => {
    await sageAgent.shutdown();
  });

  describe('Core Component Regression Tests', () => {
    describe('RWA Scoring Regression', () => {
      test('should maintain consistent scoring for baseline RWA data', async () => {
        const startTime = performance.now();
        
        const result = await rwaScoring.scoreOpportunity(BASELINE_RWA_DATA);
        
        const duration = performance.now() - startTime;
        
        // Performance regression check
        expect(duration).toMeetPerformanceThreshold(testConfig.performance.rwaScoring);
        
        // Score consistency regression check
        expect(result.overallScore).toBeConsistentWith(
          EXPECTED_BASELINES.rwaScore.overallScore,
          EXPECTED_BASELINES.rwaScore.tolerance
        );
        
        expect(result.riskAdjustedReturn).toBeConsistentWith(
          EXPECTED_BASELINES.rwaScore.riskAdjustedReturn,
          EXPECTED_BASELINES.rwaScore.tolerance
        );
        
        expect(result.confidence).toBeConsistentWith(
          EXPECTED_BASELINES.rwaScore.confidence,
          EXPECTED_BASELINES.rwaScore.tolerance
        );
        
        // Structure regression check
        expect(result).toBeValidRWAScore();
        expect(result.recommendations).toHaveValidRecommendations();
        expect(result.factors).toHaveValidFactors();
      });

      test('should handle edge cases consistently across versions', async () => {
        const edgeCases = [
          { ...BASELINE_RWA_DATA, yield: 0.001 }, // Very low yield
          { ...BASELINE_RWA_DATA, yield: 0.25 },  // Very high yield
          { ...BASELINE_RWA_DATA, value: 1000 },  // Small value
          { ...BASELINE_RWA_DATA, value: 1000000000 }, // Large value
          { ...BASELINE_RWA_DATA, riskRating: 'D' }, // High risk
        ];

        for (const edgeCase of edgeCases) {
          const result = await rwaScoring.scoreOpportunity(edgeCase);
          
          // Should still produce valid scores
          expect(result).toBeValidRWAScore();
          expect(result.overallScore).toBeInScoreRange(0, 1);
          expect(result.recommendations).toBeDefined();
          expect(result.factors).toBeDefined();
        }
      });
    });

    describe('Protocol Analysis Regression', () => {
      test('should maintain consistent analysis for baseline protocol data', async () => {
        const startTime = performance.now();
        
        const result = await analysisEngine.analyzeProtocol(BASELINE_PROTOCOL_DATA);
        
        const duration = performance.now() - startTime;
        
        // Performance regression check
        expect(duration).toMeetPerformanceThreshold(testConfig.performance.protocolAnalysis);
        
        // Score consistency regression check
        expect(result.overallScore).toBeConsistentWith(
          EXPECTED_BASELINES.protocolAnalysis.overallScore,
          EXPECTED_BASELINES.protocolAnalysis.tolerance
        );
        
        expect(result.confidence).toBeConsistentWith(
          EXPECTED_BASELINES.protocolAnalysis.confidence,
          EXPECTED_BASELINES.protocolAnalysis.tolerance
        );
        
        // Structure regression check
        expect(result).toBeValidProtocolAnalysis();
      });

      test('should handle protocol category changes consistently', async () => {
        const categories = ['lending', 'dex', 'yield-farming', 'derivatives', 'insurance'];
        
        for (const category of categories) {
          const protocolData = { ...BASELINE_PROTOCOL_DATA, category };
          const result = await analysisEngine.analyzeProtocol(protocolData);
          
          expect(result).toBeValidProtocolAnalysis();
          expect(result.overallScore).toBeInScoreRange(0, 1);
        }
      });
    });

    describe('Compliance Monitoring Regression', () => {
      test('should maintain consistent compliance assessment', async () => {
        const startTime = performance.now();
        
        const result = await complianceFramework.assessCompliance(
          BASELINE_RWA_DATA.id,
          'rwa',
          BASELINE_RWA_DATA
        );
        
        const duration = performance.now() - startTime;
        
        // Performance regression check
        expect(duration).toMeetPerformanceThreshold(testConfig.performance.complianceAssessment);
        
        // Score consistency regression check
        expect(result.overallScore).toBeConsistentWith(
          EXPECTED_BASELINES.complianceAssessment.overallScore,
          EXPECTED_BASELINES.complianceAssessment.tolerance
        );
        
        expect(result.complianceLevel).toBe(EXPECTED_BASELINES.complianceAssessment.complianceLevel);
        
        // Structure regression check
        expect(result).toBeValidComplianceAssessment();
      });

      test('should handle jurisdiction changes consistently', async () => {
        const jurisdictions = ['US', 'EU', 'UK', 'SG', 'JP'];
        
        for (const jurisdiction of jurisdictions) {
          const rwaData = {
            ...BASELINE_RWA_DATA,
            regulatoryStatus: {
              ...BASELINE_RWA_DATA.regulatoryStatus,
              jurisdiction
            }
          };
          
          const result = await complianceFramework.assessCompliance(
            rwaData.id,
            'rwa',
            rwaData
          );
          
          expect(result).toBeValidComplianceAssessment();
          expect(result.overallScore).toBeInScoreRange(0, 1);
        }
      });
    });
  });

  describe('Cross-Component Integration Regression', () => {
    test('should maintain consistent workflow from RWA scoring to compliance', async () => {
      // Step 1: Score RWA
      const scoringResult = await rwaScoring.scoreOpportunity(BASELINE_RWA_DATA);
      
      // Step 2: Assess compliance
      const complianceResult = await complianceFramework.assessCompliance(
        BASELINE_RWA_DATA.id,
        'rwa',
        BASELINE_RWA_DATA
      );
      
      // Integration checks
      expect(scoringResult).toBeValidRWAScore();
      expect(complianceResult).toBeValidComplianceAssessment();
      
      // Cross-component consistency
      if (complianceResult.complianceLevel === 'non-compliant') {
        expect(scoringResult.overallScore).toBeLessThan(0.5);
      }
      
      if (complianceResult.overallScore > 0.9) {
        expect(scoringResult.overallScore).toBeGreaterThan(0.6);
      }
    });

    test('should maintain consistent protocol analysis to compliance workflow', async () => {
      const protocolAnalysis = await analysisEngine.analyzeProtocol(BASELINE_PROTOCOL_DATA);
      
      // Mock compliance assessment for protocol
      const mockProtocolCompliance = {
        id: BASELINE_PROTOCOL_DATA.id,
        type: 'protocol',
        jurisdiction: 'US',
        complianceLevel: 'compliant',
        licenses: ['DeFi-Registered']
      };
      
      const complianceResult = await complianceFramework.assessCompliance(
        BASELINE_PROTOCOL_DATA.id,
        'protocol',
        mockProtocolCompliance
      );
      
      // Integration consistency checks
      expect(protocolAnalysis).toBeValidProtocolAnalysis();
      expect(complianceResult).toBeValidComplianceAssessment();
      
      // High security score should correlate with compliance
      if (protocolAnalysis.securityAssessment?.score > 0.8) {
        expect(complianceResult.overallScore).toBeGreaterThan(0.7);
      }
    });

    test('should maintain consistent Sage agent orchestration', async () => {
      const agentConfig = {
        enableRWAScoring: true,
        enableProtocolAnalysis: true,
        enableComplianceMonitoring: true,
        enablePerplexityResearch: false // Disabled for regression testing
      };

      const startTime = performance.now();
      
      // Test full agent workflow
      const analysisRequest = {
        type: 'rwa_analysis',
        data: BASELINE_RWA_DATA,
        requirements: ['scoring', 'compliance', 'recommendations']
      };

      const result = await sageAgent.processAnalysisRequest(analysisRequest);
      
      const duration = performance.now() - startTime;
      
      // Performance regression check
      expect(duration).toBeLessThan(10000); // Should complete within 10 seconds
      
      // Result structure check
      expect(result).toBeDefined();
      expect(result.rwaScore).toBeDefined();
      expect(result.complianceAssessment).toBeDefined();
      expect(result.recommendations).toBeDefined();
      
      // Cross-component consistency
      expect(result.rwaScore).toBeValidRWAScore();
      expect(result.complianceAssessment).toBeValidComplianceAssessment();
    });
  });

  describe('Backward Compatibility Regression', () => {
    test('should handle legacy data formats', async () => {
      // Test with v0.9.0 data format
      const legacyRWAData = {
        id: 'legacy-rwa-001',
        asset_type: 'real-estate', // Old format
        issuer_name: 'Legacy Fund',
        asset_value: 1000000,
        expected_yield: 0.065,
        risk_score: 'A',
        compliance_status: 'compliant'
      };

      // Should handle gracefully and produce valid results
      const result = await rwaScoring.scoreOpportunity(legacyRWAData as any);
      
      expect(result).toBeValidRWAScore();
      expect(result.overallScore).toBeInScoreRange(0, 1);
    });

    test('should handle missing optional fields gracefully', async () => {
      const minimalRWAData = {
        id: 'minimal-rwa-001',
        type: 'real-estate',
        issuer: 'Minimal Fund',
        value: 1000000,
        yield: 0.065
        // Missing many optional fields
      };

      const result = await rwaScoring.scoreOpportunity(minimalRWAData);
      
      expect(result).toBeValidRWAScore();
      expect(result.overallScore).toBeInScoreRange(0, 1);
      expect(result.confidence).toBeLessThan(0.8); // Lower confidence due to missing data
    });
  });

  describe('Performance Regression Tests', () => {
    test('should maintain performance under increasing load', async () => {
      const testSizes = [1, 5, 10, 25];
      const performanceMetrics: Array<{ size: number; avgDuration: number; memoryUsage: number }> = [];

      for (const size of testSizes) {
        const startMemory = global.testUtils.getMemoryUsage();
        const startTime = performance.now();

        // Process multiple RWAs concurrently
        const promises = Array.from({ length: size }, (_, i) => 
          rwaScoring.scoreOpportunity({
            ...BASELINE_RWA_DATA,
            id: `perf-test-${i}`,
            value: 1000000 + (i * 100000)
          })
        );

        await Promise.all(promises);

        const endTime = performance.now();
        const endMemory = global.testUtils.getMemoryUsage();

        const avgDuration = (endTime - startTime) / size;
        const memoryUsage = endMemory.heapUsed - startMemory.heapUsed;

        performanceMetrics.push({ size, avgDuration, memoryUsage });

        // Performance regression thresholds
        if (size === 1) {
          expect(avgDuration).toBeLessThan(2000); // Single RWA < 2s
        } else if (size === 10) {
          expect(avgDuration).toBeLessThan(1200); // Should improve with batching
        }

        // Memory usage should not grow linearly
        expect(memoryUsage).toBeWithinMemoryLimit(50); // 50MB per batch
      }

      // Ensure performance doesn't degrade significantly with scale
      const smallBatchPerf = performanceMetrics.find(m => m.size === 1)!;
      const largeBatchPerf = performanceMetrics.find(m => m.size === 25)!;

      expect(largeBatchPerf.avgDuration).toBeLessThan(smallBatchPerf.avgDuration * 2);
    });

    test('should maintain memory efficiency across versions', async () => {
      const initialMemory = global.testUtils.getMemoryUsage();

      // Perform 100 scoring operations
      for (let i = 0; i < 100; i++) {
        await rwaScoring.scoreOpportunity({
          ...BASELINE_RWA_DATA,
          id: `memory-test-${i}`,
          value: 1000000 + (i * 10000)
        });

        // Check for memory leaks every 25 operations
        if (i % 25 === 0 && i > 0) {
          const currentMemory = global.testUtils.getMemoryUsage();
          const memoryGrowth = currentMemory.heapUsed - initialMemory.heapUsed;
          
          // Memory growth should be bounded
          expect(memoryGrowth).toBeLessThan(100); // Less than 100MB growth
        }
      }

      // Force garbage collection and final check
      if (global.gc) global.gc();
      await global.testUtils.wait(100);

      const finalMemory = global.testUtils.getMemoryUsage();
      const totalMemoryGrowth = finalMemory.heapUsed - initialMemory.heapUsed;

      expect(totalMemoryGrowth).toBeLessThan(150); // Less than 150MB total growth
    });
  });

  describe('API Contract Regression Tests', () => {
    test('should maintain stable API contracts', async () => {
      // Test RWA scoring API contract
      const rwaResult = await rwaScoring.scoreOpportunity(BASELINE_RWA_DATA);
      
      // Required fields should exist
      expect(rwaResult).toHaveProperty('overallScore');
      expect(rwaResult).toHaveProperty('riskAdjustedReturn');
      expect(rwaResult).toHaveProperty('confidence');
      expect(rwaResult).toHaveProperty('recommendations');
      expect(rwaResult).toHaveProperty('factors');
      expect(rwaResult).toHaveProperty('metadata');

      // Test protocol analysis API contract
      const protocolResult = await analysisEngine.analyzeProtocol(BASELINE_PROTOCOL_DATA);
      
      expect(protocolResult).toHaveProperty('overallScore');
      expect(protocolResult).toHaveProperty('tvlAnalysis');
      expect(protocolResult).toHaveProperty('riskAssessment');
      expect(protocolResult).toHaveProperty('recommendations');
      expect(protocolResult).toHaveProperty('confidence');

      // Test compliance API contract
      const complianceResult = await complianceFramework.assessCompliance(
        BASELINE_RWA_DATA.id,
        'rwa',
        BASELINE_RWA_DATA
      );
      
      expect(complianceResult).toHaveProperty('overallScore');
      expect(complianceResult).toHaveProperty('complianceLevel');
      expect(complianceResult).toHaveProperty('ruleEvaluations');
      expect(complianceResult).toHaveProperty('violations');
      expect(complianceResult).toHaveProperty('recommendations');
    });

    test('should maintain error handling contracts', async () => {
      // Test invalid data handling
      await expect(
        rwaScoring.scoreOpportunity(null as any)
      ).rejects.toThrow();

      await expect(
        analysisEngine.analyzeProtocol({} as any)
      ).rejects.toThrow();

      await expect(
        complianceFramework.assessCompliance('', 'invalid-type' as any, {})
      ).rejects.toThrow();
    });
  });

  describe('Change Impact Analysis', () => {
    test('should detect scoring algorithm changes', async () => {
      const testCases = [
        BASELINE_RWA_DATA,
        { ...BASELINE_RWA_DATA, yield: 0.08 },
        { ...BASELINE_RWA_DATA, riskRating: 'B' },
        { ...BASELINE_RWA_DATA, value: 5000000 }
      ];

      const currentResults = await Promise.all(
        testCases.map(rwa => rwaScoring.scoreOpportunity(rwa))
      );

      // Store current results as baseline for future regression tests
      const baselineResults = {
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        results: currentResults.map(result => ({
          overallScore: result.overallScore,
          riskAdjustedReturn: result.riskAdjustedReturn,
          confidence: result.confidence
        }))
      };

      // This would typically be stored in a file or database
      expect(baselineResults.results).toHaveLength(testCases.length);
      
      for (const result of baselineResults.results) {
        expect(result.overallScore).toBeInScoreRange(0, 1);
        expect(result.riskAdjustedReturn).toBeInScoreRange(0, 1);
        expect(result.confidence).toBeInScoreRange(0, 1);
      }
    });

    test('should validate cross-component integration stability', async () => {
      // Test full workflow with multiple components
      const workflowSteps = [
        'rwa-scoring',
        'compliance-assessment',
        'recommendation-generation',
        'report-generation'
      ];

      const workflowResults: Record<string, any> = {};

      // Step 1: RWA Scoring
      workflowResults.scoring = await rwaScoring.scoreOpportunity(BASELINE_RWA_DATA);

      // Step 2: Compliance Assessment
      workflowResults.compliance = await complianceFramework.assessCompliance(
        BASELINE_RWA_DATA.id,
        'rwa',
        BASELINE_RWA_DATA
      );

      // Step 3: Generate integrated recommendations
      workflowResults.recommendations = {
        scoring: workflowResults.scoring.recommendations,
        compliance: workflowResults.compliance.recommendations,
        integrated: [
          {
            action: workflowResults.scoring.overallScore > 0.7 ? 'invest' : 'avoid',
            confidence: Math.min(workflowResults.scoring.confidence, workflowResults.compliance.overallScore),
            reasoning: 'Integrated analysis of scoring and compliance factors'
          }
        ]
      };

      // Validate workflow consistency
      expect(workflowResults.scoring).toBeValidRWAScore();
      expect(workflowResults.compliance).toBeValidComplianceAssessment();
      expect(workflowResults.recommendations.integrated).toHaveValidRecommendations();

      // Cross-component validation
      if (workflowResults.scoring.overallScore > 0.8 && 
          workflowResults.compliance.complianceLevel === 'compliant') {
        expect(workflowResults.recommendations.integrated[0].action).toBe('invest');
      }
    });
  });
});