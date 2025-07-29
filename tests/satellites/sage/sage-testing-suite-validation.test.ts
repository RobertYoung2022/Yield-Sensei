/**
 * Sage Testing Suite Validation
 * 
 * Comprehensive validation test to ensure the entire Sage satellite testing
 * framework is functioning correctly and all test components are properly integrated.
 */

import { SageSatelliteAgent } from '../../../src/satellites/sage/sage-satellite';
import { RWAOpportunityScoring } from '../../../src/satellites/sage/rwa/opportunity-scoring-system';
import { FundamentalAnalysisEngine } from '../../../src/satellites/sage/research/fundamental-analysis-engine';
import { ComplianceMonitoringFramework } from '../../../src/satellites/sage/compliance/compliance-monitoring-framework';
import { PerplexityAPIIntegration } from '../../../src/satellites/sage/api/perplexity-integration';
import { testUtils, testConfig } from './config/jest.setup';
import * as fs from 'fs';
import * as path from 'path';

describe('Sage Testing Suite Validation', () => {
  let sageAgent: SageSatelliteAgent;
  let rwaScoring: RWAOpportunityScoring;
  let analysisEngine: FundamentalAnalysisEngine;
  let complianceFramework: ComplianceMonitoringFramework;
  let perplexityIntegration: PerplexityAPIIntegration;

  // Validation test data
  const VALIDATION_RWA_DATA = {
    id: 'validation-rwa-001',
    type: 'real-estate',
    issuer: 'Validation Real Estate Fund',
    value: 1500000,
    currency: 'USD',
    maturityDate: new Date('2025-12-31'),
    yield: 0.072,
    riskRating: 'A-',
    collateral: {
      type: 'commercial-real-estate',
      value: 1800000,
      ltv: 0.83,
      liquidationThreshold: 0.88
    },
    regulatoryStatus: {
      jurisdiction: 'US',
      complianceLevel: 'compliant',
      licenses: ['SEC-Registered', 'REIT-Qualified'],
      restrictions: [],
      lastReview: new Date()
    },
    complianceScore: 88
  };

  const VALIDATION_PROTOCOL_DATA = {
    id: 'validation-protocol-001',
    name: 'Validation DeFi Protocol',
    category: 'lending',
    tvl: 750000000,
    volume24h: 35000000,
    users: 22000,
    tokenPrice: 15.75,
    marketCap: 157500000,
    circulatingSupply: 10000000,
    totalSupply: 15000000,
    apy: 0.092,
    fees24h: 175000,
    revenue: 2100000,
    codeAudits: [{
      auditor: 'Validation Security',
      date: new Date(),
      status: 'passed',
      criticalIssues: 0,
      highIssues: 1,
      mediumIssues: 2,
      lowIssues: 3
    }],
    team: {
      size: 28,
      experience: 4.5,
      credibility: 0.88,
      anonymity: false
    },
    governance: {
      tokenHolders: 9500,
      votingPower: 0.68,
      proposalCount: 52,
      participationRate: 0.38
    }
  };

  // Test result storage
  const validationResults: any = {
    timestamp: new Date().toISOString(),
    testResults: {},
    performanceMetrics: {},
    coverageMetrics: {},
    integrationTests: {},
    errors: []
  };

  beforeAll(async () => {
    console.log('🚀 Starting Sage Testing Suite Validation...');
    
    // Initialize all components
    sageAgent = new SageSatelliteAgent({
      name: 'ValidationTestAgent',
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
      apiKey: 'test-validation-key',
      enableCaching: true,
      rateLimit: { requests: 100, windowMs: 60000 }
    });

    await sageAgent.initialize();
    
    console.log('✅ Components initialized successfully');
  }, 45000);

  afterAll(async () => {
    await sageAgent.shutdown();
    
    // Generate validation report
    await generateValidationReport(validationResults);
    
    console.log('📊 Sage Testing Suite Validation completed');
  });

  describe('Core Component Validation', () => {
    test('should validate RWA Scoring System functionality', async () => {
      console.log('🔍 Validating RWA Scoring System...');
      
      const startTime = performance.now();
      const startMemory = global.testUtils.getMemoryUsage();

      try {
        // Test basic scoring
        const scoringResult = await rwaScoring.scoreOpportunity(VALIDATION_RWA_DATA);
        
        const endTime = performance.now();
        const endMemory = global.testUtils.getMemoryUsage();
        
        // Validate result structure
        expect(scoringResult).toBeValidRWAScore();
        expect(scoringResult.overallScore).toBeInScoreRange(0, 1);
        expect(scoringResult.riskAdjustedReturn).toBeInScoreRange(0, 1);
        expect(scoringResult.confidence).toBeInScoreRange(0, 1);
        expect(scoringResult.recommendations).toHaveValidRecommendations();
        expect(scoringResult.factors).toHaveValidFactors();

        // Validate performance
        const duration = endTime - startTime;
        expect(duration).toMeetPerformanceThreshold(testConfig.performance.rwaScoring);

        // Store results
        validationResults.testResults.rwaScoring = {
          success: true,
          score: scoringResult.overallScore,
          confidence: scoringResult.confidence,
          recommendationCount: scoringResult.recommendations.length,
          factorCount: scoringResult.factors.length,
          duration,
          memoryUsage: endMemory.heapUsed - startMemory.heapUsed
        };

        console.log('✅ RWA Scoring System validation passed');

      } catch (error) {
        validationResults.errors.push({
          component: 'RWAScoring',
          error: (error as Error).message,
          timestamp: new Date().toISOString()
        });
        throw error;
      }
    });

    test('should validate Fundamental Analysis Engine functionality', async () => {
      console.log('🔍 Validating Fundamental Analysis Engine...');
      
      const startTime = performance.now();
      const startMemory = global.testUtils.getMemoryUsage();

      try {
        const analysisResult = await analysisEngine.analyzeProtocol(VALIDATION_PROTOCOL_DATA);
        
        const endTime = performance.now();
        const endMemory = global.testUtils.getMemoryUsage();

        // Validate result structure
        expect(analysisResult).toBeValidProtocolAnalysis();
        expect(analysisResult.overallScore).toBeInScoreRange(0, 1);
        expect(analysisResult.confidence).toBeInScoreRange(0, 1);
        expect(analysisResult.recommendations).toHaveValidRecommendations();

        // Validate required analysis components
        expect(analysisResult.tvlAnalysis).toBeDefined();
        expect(analysisResult.riskAssessment).toBeDefined();
        expect(analysisResult.teamAssessment).toBeDefined();
        expect(analysisResult.securityAssessment).toBeDefined();
        expect(analysisResult.governanceAssessment).toBeDefined();

        // Validate performance
        const duration = endTime - startTime;
        expect(duration).toMeetPerformanceThreshold(testConfig.performance.protocolAnalysis);

        // Store results
        validationResults.testResults.fundamentalAnalysis = {
          success: true,
          score: analysisResult.overallScore,
          confidence: analysisResult.confidence,
          recommendationCount: analysisResult.recommendations.length,
          duration,
          memoryUsage: endMemory.heapUsed - startMemory.heapUsed
        };

        console.log('✅ Fundamental Analysis Engine validation passed');

      } catch (error) {
        validationResults.errors.push({
          component: 'FundamentalAnalysis',
          error: (error as Error).message,
          timestamp: new Date().toISOString()
        });
        throw error;
      }
    });

    test('should validate Compliance Monitoring Framework functionality', async () => {
      console.log('🔍 Validating Compliance Monitoring Framework...');
      
      const startTime = performance.now();
      const startMemory = global.testUtils.getMemoryUsage();

      try {
        const complianceResult = await complianceFramework.assessCompliance(
          VALIDATION_RWA_DATA.id,
          'rwa',
          VALIDATION_RWA_DATA
        );
        
        const endTime = performance.now();
        const endMemory = global.testUtils.getMemoryUsage();

        // Validate result structure
        expect(complianceResult).toBeValidComplianceAssessment();
        expect(complianceResult.overallScore).toBeInScoreRange(0, 1);
        expect(complianceResult.complianceLevel).toMatch(/^(compliant|partial|non-compliant)$/);
        expect(complianceResult.ruleEvaluations).toBeDefined();
        expect(complianceResult.violations).toBeDefined();
        expect(complianceResult.recommendations).toHaveValidRecommendations();

        // Validate performance
        const duration = endTime - startTime;
        expect(duration).toMeetPerformanceThreshold(testConfig.performance.complianceAssessment);

        // Store results
        validationResults.testResults.complianceMonitoring = {
          success: true,
          score: complianceResult.overallScore,
          complianceLevel: complianceResult.complianceLevel,
          violationCount: complianceResult.violations.length,
          recommendationCount: complianceResult.recommendations.length,
          duration,
          memoryUsage: endMemory.heapUsed - startMemory.heapUsed
        };

        console.log('✅ Compliance Monitoring Framework validation passed');

      } catch (error) {
        validationResults.errors.push({
          component: 'ComplianceMonitoring',
          error: (error as Error).message,
          timestamp: new Date().toISOString()
        });
        throw error;
      }
    });

    test('should validate Perplexity API Integration functionality', async () => {
      console.log('🔍 Validating Perplexity API Integration...');
      
      const startTime = performance.now();
      const startMemory = global.testUtils.getMemoryUsage();

      try {
        // Test with mock data (since we don't have real API key in tests)
        const mockPerplexityResponse = {
          choices: [{
            message: {
              content: 'Mock Perplexity research response for validation testing'
            }
          }]
        };

        // Mock the API call
        jest.spyOn(perplexityIntegration as any, 'makeAPIRequest')
          .mockResolvedValueOnce(mockPerplexityResponse);

        const researchResult = await perplexityIntegration.researchProtocol(VALIDATION_PROTOCOL_DATA);
        
        const endTime = performance.now();
        const endMemory = global.testUtils.getMemoryUsage();

        // Validate result structure
        expect(researchResult).toBeDefined();
        expect(researchResult.content).toBeTruthy();
        expect(researchResult.timestamp).toBeRecentDate();

        // Validate performance
        const duration = endTime - startTime;
        expect(duration).toBeLessThan(5000); // API calls should be fast in test mode

        // Store results
        validationResults.testResults.perplexityIntegration = {
          success: true,
          responseLength: researchResult.content.length,
          duration,
          memoryUsage: endMemory.heapUsed - startMemory.heapUsed
        };

        console.log('✅ Perplexity API Integration validation passed');

      } catch (error) {
        validationResults.errors.push({
          component: 'PerplexityIntegration',
          error: (error as Error).message,
          timestamp: new Date().toISOString()
        });
        throw error;
      }
    });
  });

  describe('Integration Validation', () => {
    test('should validate end-to-end Sage agent workflow', async () => {
      console.log('🔍 Validating end-to-end Sage workflow...');
      
      const startTime = performance.now();
      const startMemory = global.testUtils.getMemoryUsage();

      try {
        const workflowResult = await sageAgent.processAnalysisRequest({
          type: 'validation_workflow',
          data: VALIDATION_RWA_DATA,
          requirements: ['scoring', 'compliance', 'recommendations']
        });
        
        const endTime = performance.now();
        const endMemory = global.testUtils.getMemoryUsage();

        // Validate workflow result
        expect(workflowResult).toBeDefined();
        expect(workflowResult.rwaScore).toBeValidRWAScore();
        expect(workflowResult.complianceAssessment).toBeValidComplianceAssessment();
        expect(workflowResult.recommendations).toBeDefined();

        // Validate cross-component consistency
        if (workflowResult.complianceAssessment.complianceLevel === 'compliant') {
          expect(workflowResult.rwaScore.overallScore).toBeGreaterThan(0.4);
        }

        // Validate performance
        const duration = endTime - startTime;
        expect(duration).toBeLessThan(15000); // End-to-end should complete within 15 seconds

        // Store results
        validationResults.integrationTests.endToEndWorkflow = {
          success: true,
          rwaScore: workflowResult.rwaScore.overallScore,
          complianceScore: workflowResult.complianceAssessment.overallScore,
          recommendationCount: workflowResult.recommendations.length,
          duration,
          memoryUsage: endMemory.heapUsed - startMemory.heapUsed
        };

        console.log('✅ End-to-end workflow validation passed');

      } catch (error) {
        validationResults.errors.push({
          component: 'EndToEndWorkflow',
          error: (error as Error).message,
          timestamp: new Date().toISOString()
        });
        throw error;
      }
    });

    test('should validate component integration consistency', async () => {
      console.log('🔍 Validating component integration consistency...');

      try {
        // Run components separately
        const individualRWAScore = await rwaScoring.scoreOpportunity(VALIDATION_RWA_DATA);
        const individualCompliance = await complianceFramework.assessCompliance(
          VALIDATION_RWA_DATA.id,
          'rwa',
          VALIDATION_RWA_DATA
        );

        // Run through Sage agent
        const integratedResult = await sageAgent.processAnalysisRequest({
          type: 'consistency_validation',
          data: VALIDATION_RWA_DATA,
          requirements: ['scoring', 'compliance']
        });

        // Validate consistency
        expect(integratedResult.rwaScore.overallScore).toBeConsistentWith(
          individualRWAScore.overallScore,
          0.05 // 5% tolerance for integration differences
        );

        expect(integratedResult.complianceAssessment.overallScore).toBeConsistentWith(
          individualCompliance.overallScore,
          0.05
        );

        // Store results
        validationResults.integrationTests.componentConsistency = {
          success: true,
          scoreDifference: Math.abs(
            integratedResult.rwaScore.overallScore - individualRWAScore.overallScore
          ),
          complianceDifference: Math.abs(
            integratedResult.complianceAssessment.overallScore - individualCompliance.overallScore
          )
        };

        console.log('✅ Component integration consistency validation passed');

      } catch (error) {
        validationResults.errors.push({
          component: 'ComponentConsistency',
          error: (error as Error).message,
          timestamp: new Date().toISOString()
        });
        throw error;
      }
    });
  });

  describe('Performance Validation', () => {
    test('should validate overall testing suite performance', async () => {
      console.log('🔍 Validating testing suite performance...');

      const performanceTests = [
        {
          name: 'Single RWA Scoring',
          test: () => rwaScoring.scoreOpportunity(VALIDATION_RWA_DATA),
          threshold: testConfig.performance.rwaScoring
        },
        {
          name: 'Protocol Analysis',
          test: () => analysisEngine.analyzeProtocol(VALIDATION_PROTOCOL_DATA),
          threshold: testConfig.performance.protocolAnalysis
        },
        {
          name: 'Compliance Assessment',
          test: () => complianceFramework.assessCompliance(
            VALIDATION_RWA_DATA.id,
            'rwa',
            VALIDATION_RWA_DATA
          ),
          threshold: testConfig.performance.complianceAssessment
        }
      ];

      const performanceResults: any = {};

      for (const perfTest of performanceTests) {
        const startTime = performance.now();
        const startMemory = global.testUtils.getMemoryUsage();

        try {
          await perfTest.test();
          
          const endTime = performance.now();
          const endMemory = global.testUtils.getMemoryUsage();
          const duration = endTime - startTime;
          const memoryUsage = endMemory.heapUsed - startMemory.heapUsed;

          expect(duration).toMeetPerformanceThreshold(perfTest.threshold);
          expect(memoryUsage).toBeWithinMemoryLimit(testConfig.performance.memoryLimit / 1024 / 1024);

          performanceResults[perfTest.name] = {
            success: true,
            duration,
            memoryUsage,
            threshold: perfTest.threshold,
            withinThreshold: duration <= perfTest.threshold
          };

        } catch (error) {
          performanceResults[perfTest.name] = {
            success: false,
            error: (error as Error).message
          };
        }
      }

      // Store performance metrics
      validationResults.performanceMetrics = performanceResults;

      // Validate all performance tests passed
      for (const [testName, result] of Object.entries(performanceResults)) {
        expect((result as any).success).toBe(true);
        if ((result as any).success) {
          expect((result as any).withinThreshold).toBe(true);
        }
      }

      console.log('✅ Performance validation passed');
    });

    test('should validate memory efficiency and leak detection', async () => {
      console.log('🔍 Validating memory efficiency...');

      const initialMemory = global.testUtils.getMemoryUsage();
      
      // Run multiple operations to test for memory leaks
      for (let i = 0; i < 10; i++) {
        await rwaScoring.scoreOpportunity({
          ...VALIDATION_RWA_DATA,
          id: `memory-test-${i}`
        });

        await complianceFramework.assessCompliance(
          `memory-test-${i}`,
          'rwa',
          { ...VALIDATION_RWA_DATA, id: `memory-test-${i}` }
        );
      }

      // Force garbage collection
      if (global.gc) global.gc();
      await global.testUtils.wait(100);

      const finalMemory = global.testUtils.getMemoryUsage();
      const memoryGrowth = finalMemory.heapUsed - initialMemory.heapUsed;

      // Memory growth should be reasonable
      expect(memoryGrowth).toBeWithinMemoryLimit(50); // Less than 50MB growth

      validationResults.performanceMetrics.memoryEfficiency = {
        initialMemory: initialMemory.heapUsed,
        finalMemory: finalMemory.heapUsed,
        memoryGrowth,
        iterations: 10,
        growthPerIteration: memoryGrowth / 10
      };

      console.log('✅ Memory efficiency validation passed');
    });
  });

  describe('Configuration Validation', () => {
    test('should validate Jest configuration and custom matchers', async () => {
      console.log('🔍 Validating Jest configuration...');

      try {
        // Test custom matchers
        const testScore = 0.75;
        expect(testScore).toBeInScoreRange(0, 1);
        expect(testScore).toBeConsistentWith(0.76, 0.05);

        const testRecommendations = [
          {
            action: 'invest',
            confidence: 0.8,
            reasoning: 'Test reasoning',
            timeframe: 'medium',
            riskLevel: 'low'
          }
        ];
        expect(testRecommendations).toHaveValidRecommendations();

        const testFactors = [
          {
            category: 'yield',
            score: 0.75,
            weight: 0.3,
            description: 'Test factor',
            impact: 'positive'
          }
        ];
        expect(testFactors).toHaveValidFactors();

        // Test performance matcher
        const testDuration = 1500;
        expect(testDuration).toMeetPerformanceThreshold(2000);

        validationResults.testResults.jestConfiguration = {
          success: true,
          customMatchersWorking: true,
          performanceMatchersWorking: true
        };

        console.log('✅ Jest configuration validation passed');

      } catch (error) {
        validationResults.errors.push({
          component: 'JestConfiguration',
          error: (error as Error).message,
          timestamp: new Date().toISOString()
        });
        throw error;
      }
    });

    test('should validate test utilities and setup', async () => {
      console.log('🔍 Validating test utilities...');

      try {
        // Test global utilities
        expect(global.testUtils).toBeDefined();
        expect(global.testConfig).toBeDefined();

        // Test utility functions
        const { duration } = await global.testUtils.measurePerformance(
          async () => {
            await global.testUtils.wait(100);
            return 'test result';
          },
          'test operation'
        );

        expect(duration).toBeGreaterThan(90); // Should take at least 90ms
        expect(duration).toBeLessThan(200); // Should not take more than 200ms

        const memoryUsage = global.testUtils.getMemoryUsage();
        expect(memoryUsage.heapUsed).toBeGreaterThan(0);
        expect(memoryUsage.heapTotal).toBeGreaterThan(0);

        // Test mock data generators
        const mockRWA = global.testUtils.createMockRWAData({ yield: 0.08 });
        expect(mockRWA.yield).toBe(0.08);
        expect(mockRWA.id).toBeTruthy();

        const mockProtocol = global.testUtils.createMockProtocolData({ tvl: 1000000000 });
        expect(mockProtocol.tvl).toBe(1000000000);
        expect(mockProtocol.name).toBeTruthy();

        validationResults.testResults.testUtilities = {
          success: true,
          performanceMeasurementWorking: true,
          memoryTrackingWorking: true,
          mockDataGeneratorsWorking: true
        };

        console.log('✅ Test utilities validation passed');

      } catch (error) {
        validationResults.errors.push({
          component: 'TestUtilities',
          error: (error as Error).message,
          timestamp: new Date().toISOString()
        });
        throw error;
      }
    });
  });

  describe('Error Handling Validation', () => {
    test('should validate error handling across components', async () => {
      console.log('🔍 Validating error handling...');

      const errorTests = [
        {
          name: 'RWA Scoring with null data',
          test: () => rwaScoring.scoreOpportunity(null as any),
          expectError: true
        },
        {
          name: 'Compliance with invalid type',
          test: () => complianceFramework.assessCompliance('test', 'invalid-type' as any, {}),
          expectError: true
        },
        {
          name: 'Protocol Analysis with empty data',
          test: () => analysisEngine.analyzeProtocol({} as any),
          expectError: true
        }
      ];

      const errorResults: any = {};

      for (const errorTest of errorTests) {
        try {
          await errorTest.test();
          
          // If we get here and expected an error, test failed
          if (errorTest.expectError) {
            errorResults[errorTest.name] = {
              success: false,
              reason: 'Expected error but none was thrown'
            };
          } else {
            errorResults[errorTest.name] = {
              success: true,
              reason: 'Completed without error as expected'
            };
          }
        } catch (error) {
          if (errorTest.expectError) {
            errorResults[errorTest.name] = {
              success: true,
              reason: 'Error thrown as expected',
              errorType: (error as Error).constructor.name,
              errorMessage: (error as Error).message
            };
          } else {
            errorResults[errorTest.name] = {
              success: false,
              reason: 'Unexpected error thrown',
              errorType: (error as Error).constructor.name,
              errorMessage: (error as Error).message
            };
          }
        }
      }

      // Validate all error tests passed
      for (const [testName, result] of Object.entries(errorResults)) {
        expect((result as any).success).toBe(true);
      }

      validationResults.testResults.errorHandling = errorResults;

      console.log('✅ Error handling validation passed');
    });
  });

  // Helper function to generate validation report
  async function generateValidationReport(results: any) {
    const reportPath = path.join(__dirname, '..', '..', '..', 'coverage', 'sage', 'validation-report.json');
    const reportDir = path.dirname(reportPath);

    // Ensure directory exists
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
    }

    // Calculate summary metrics
    const summary = {
      totalTests: Object.keys(results.testResults).length,
      successfulTests: Object.values(results.testResults).filter((r: any) => r.success).length,
      errorCount: results.errors.length,
      overallSuccess: results.errors.length === 0,
      performanceTestsPassed: Object.values(results.performanceMetrics || {})
        .filter((r: any) => r.success && r.withinThreshold).length,
      integrationTestsPassed: Object.values(results.integrationTests || {})
        .filter((r: any) => r.success).length
    };

    const report = {
      ...results,
      summary,
      generatedAt: new Date().toISOString(),
      validationStatus: summary.overallSuccess ? 'PASSED' : 'FAILED'
    };

    // Write report
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    // Generate console summary
    console.log('\n📊 Sage Testing Suite Validation Summary:');
    console.log(`✅ Successful Tests: ${summary.successfulTests}/${summary.totalTests}`);
    console.log(`⚡ Performance Tests Passed: ${summary.performanceTestsPassed}`);
    console.log(`🔗 Integration Tests Passed: ${summary.integrationTestsPassed}`);
    console.log(`❌ Errors: ${summary.errorCount}`);
    console.log(`🎯 Overall Status: ${report.validationStatus}`);
    
    if (summary.errorCount > 0) {
      console.log('\n❌ Errors encountered:');
      results.errors.forEach((error: any, index: number) => {
        console.log(`  ${index + 1}. ${error.component}: ${error.error}`);
      });
    }

    console.log(`\n📄 Detailed report saved to: ${reportPath}`);
  }
});