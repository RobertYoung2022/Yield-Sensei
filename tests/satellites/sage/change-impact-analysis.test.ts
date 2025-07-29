/**
 * Change Impact Analysis Testing Suite
 * 
 * Automated testing framework to detect and analyze the impact of changes
 * on system behavior, performance, and integration points.
 */

import { SageSatelliteAgent } from '../../../src/satellites/sage/sage-satellite';
import { RWAOpportunityScoring } from '../../../src/satellites/sage/rwa/opportunity-scoring-system';
import { FundamentalAnalysisEngine } from '../../../src/satellites/sage/research/fundamental-analysis-engine';
import { ComplianceMonitoringFramework } from '../../../src/satellites/sage/compliance/compliance-monitoring-framework';
import { testUtils, testConfig } from './config/jest.setup';
import * as fs from 'fs';
import * as path from 'path';

describe('Change Impact Analysis Tests', () => {
  let sageAgent: SageSatelliteAgent;
  let rwaScoring: RWAOpportunityScoring;
  let analysisEngine: FundamentalAnalysisEngine;
  let complianceFramework: ComplianceMonitoringFramework;

  // Baseline test cases for impact analysis
  const IMPACT_TEST_CASES = [
    {
      id: 'impact-test-001',
      name: 'Standard Real Estate RWA',
      data: {
        id: 'std-re-001',
        type: 'real-estate',
        issuer: 'Standard RE Fund',
        value: 1000000,
        yield: 0.065,
        riskRating: 'A',
        collateral: { type: 'real-estate', value: 1200000, ltv: 0.83 }
      }
    },
    {
      id: 'impact-test-002', 
      name: 'High-Yield Infrastructure RWA',
      data: {
        id: 'hyi-inf-001',
        type: 'infrastructure',
        issuer: 'Infrastructure Growth Fund',
        value: 5000000,
        yield: 0.095,
        riskRating: 'B+',
        collateral: { type: 'infrastructure', value: 6000000, ltv: 0.83 }
      }
    },
    {
      id: 'impact-test-003',
      name: 'Low-Risk Treasury-Backed RWA',
      data: {
        id: 'lr-tb-001',
        type: 'treasury-backed',
        issuer: 'Treasury Securities Fund',
        value: 10000000,
        yield: 0.045,
        riskRating: 'AAA',
        collateral: { type: 'treasury-securities', value: 10500000, ltv: 0.95 }
      }
    },
    {
      id: 'impact-test-004',
      name: 'Commodity-Backed High-Risk RWA',
      data: {
        id: 'cb-hr-001',
        type: 'commodity',
        issuer: 'Commodity Trading Fund',
        value: 2500000,
        yield: 0.125,
        riskRating: 'C',
        collateral: { type: 'commodity-futures', value: 2750000, ltv: 0.91 }
      }
    },
    {
      id: 'impact-test-005',
      name: 'Cross-Chain Tokenized Asset',
      data: {
        id: 'cc-ta-001',
        type: 'tokenized-asset',
        issuer: 'Cross-Chain Asset Fund',
        value: 1500000,
        yield: 0.078,
        riskRating: 'A-',
        crossChainData: {
          sourceChain: 'ethereum',
          targetChain: 'polygon'
        }
      }
    }
  ];

  // Baseline results storage
  const BASELINES_FILE = path.join(__dirname, 'baselines', 'impact-analysis-baselines.json');
  let storedBaselines: any = {};

  beforeAll(async () => {
    // Initialize components
    sageAgent = new SageSatelliteAgent({
      name: 'ImpactAnalysisAgent',
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

    await sageAgent.initialize();

    // Load existing baselines if available
    try {
      if (fs.existsSync(BASELINES_FILE)) {
        storedBaselines = JSON.parse(fs.readFileSync(BASELINES_FILE, 'utf8'));
      }
    } catch (error) {
      console.warn('Could not load existing baselines:', error);
      storedBaselines = {};
    }
  }, 30000);

  afterAll(async () => {
    await sageAgent.shutdown();
  });

  describe('Baseline Establishment and Comparison', () => {
    test('should establish or validate performance baselines', async () => {
      const currentResults: any = {};
      const currentVersion = process.env.CI_COMMIT_SHA || 'local-development';

      for (const testCase of IMPACT_TEST_CASES) {
        const startTime = performance.now();
        
        // Run comprehensive analysis
        const result = await rwaScoring.scoreOpportunity(testCase.data);
        const complianceResult = await complianceFramework.assessCompliance(
          testCase.data.id,
          'rwa',
          testCase.data
        );
        
        const endTime = performance.now();
        const duration = endTime - startTime;

        currentResults[testCase.id] = {
          rwaScore: {
            overallScore: result.overallScore,
            riskAdjustedReturn: result.riskAdjustedReturn,
            confidence: result.confidence
          },
          compliance: {
            overallScore: complianceResult.overallScore,
            complianceLevel: complianceResult.complianceLevel
          },
          performance: {
            duration,
            testCase: testCase.name
          },
          metadata: {
            timestamp: new Date().toISOString(),
            version: currentVersion,
            testEnvironment: process.env.NODE_ENV || 'test'
          }
        };
      }

      // Compare with stored baselines
      if (Object.keys(storedBaselines).length > 0) {
        await compareWithBaselines(currentResults, storedBaselines);
      } else {
        // First run - establish baselines
        await establishBaselines(currentResults);
      }

      // Store current results as new baseline
      const baselinesDir = path.dirname(BASELINES_FILE);
      if (!fs.existsSync(baselinesDir)) {
        fs.mkdirSync(baselinesDir, { recursive: true });
      }
      
      fs.writeFileSync(BASELINES_FILE, JSON.stringify(currentResults, null, 2));
    });

    async function compareWithBaselines(current: any, baseline: any) {
      const tolerance = 0.03; // 3% tolerance for score changes
      const performanceTolerance = 1.5; // 50% increase in duration is concerning

      for (const testCaseId of Object.keys(current)) {
        if (!baseline[testCaseId]) {
          console.warn(`No baseline found for test case: ${testCaseId}`);
          continue;
        }

        const currentResult = current[testCaseId];
        const baselineResult = baseline[testCaseId];

        // Score impact analysis
        const scoreDiff = Math.abs(
          currentResult.rwaScore.overallScore - baselineResult.rwaScore.overallScore
        );
        const confidenceDiff = Math.abs(
          currentResult.rwaScore.confidence - baselineResult.rwaScore.confidence
        );
        const complianceDiff = Math.abs(
          currentResult.compliance.overallScore - baselineResult.compliance.overallScore
        );

        // Performance impact analysis
        const performanceRatio = currentResult.performance.duration / baselineResult.performance.duration;

        // Assertions with detailed error messages
        expect(scoreDiff).toBeLessThan(tolerance);
        if (scoreDiff >= tolerance) {
          console.error(`Significant score change detected for ${testCaseId}:
            Baseline: ${baselineResult.rwaScore.overallScore}
            Current: ${currentResult.rwaScore.overallScore}
            Difference: ${scoreDiff} (tolerance: ${tolerance})`);
        }

        expect(confidenceDiff).toBeLessThan(tolerance);
        expect(complianceDiff).toBeLessThan(tolerance);
        
        expect(performanceRatio).toBeLessThan(performanceTolerance);
        if (performanceRatio >= performanceTolerance) {
          console.error(`Performance regression detected for ${testCaseId}:
            Baseline: ${baselineResult.performance.duration}ms
            Current: ${currentResult.performance.duration}ms
            Ratio: ${performanceRatio}x (tolerance: ${performanceTolerance}x)`);
        }
      }
    }

    async function establishBaselines(results: any) {
      console.log('Establishing new baselines for impact analysis...');
      
      // Validate that baseline results are reasonable
      for (const [testCaseId, result] of Object.entries(results) as Array<[string, any]>) {
        expect(result.rwaScore.overallScore).toBeInScoreRange(0, 1);
        expect(result.rwaScore.confidence).toBeInScoreRange(0, 1);
        expect(result.compliance.overallScore).toBeInScoreRange(0, 1);
        expect(result.performance.duration).toBeGreaterThan(0);
        expect(result.performance.duration).toBeLessThan(10000); // Should complete within 10s
      }
      
      console.log(`Baselines established for ${Object.keys(results).length} test cases`);
    }
  });

  describe('Algorithm Change Impact Detection', () => {
    test('should detect scoring algorithm changes', async () => {
      const algorithmVersions = [
        { name: 'conservative', riskMultiplier: 1.2, yieldWeight: 0.7 },
        { name: 'balanced', riskMultiplier: 1.0, yieldWeight: 0.8 },
        { name: 'aggressive', riskMultiplier: 0.8, yieldWeight: 0.9 }
      ];

      const algorithmResults: Record<string, any> = {};

      for (const algorithm of algorithmVersions) {
        algorithmResults[algorithm.name] = {};

        // Temporarily modify scoring parameters (this would be real configuration in practice)
        const modifiedScoring = new RWAOpportunityScoring({
          mlModelPath: 'test-models/rwa-scoring',
          parameters: {
            riskMultiplier: algorithm.riskMultiplier,
            yieldWeight: algorithm.yieldWeight
          },
          enableCaching: false
        });

        for (const testCase of IMPACT_TEST_CASES.slice(0, 3)) { // Test with subset for performance
          const result = await modifiedScoring.scoreOpportunity(testCase.data);
          
          algorithmResults[algorithm.name][testCase.id] = {
            overallScore: result.overallScore,
            riskAdjustedReturn: result.riskAdjustedReturn,
            confidence: result.confidence
          };
        }
      }

      // Analyze impact of algorithm changes
      const baselineAlgorithm = 'balanced';
      
      for (const algorithmName of Object.keys(algorithmResults)) {
        if (algorithmName === baselineAlgorithm) continue;

        for (const testCaseId of Object.keys(algorithmResults[algorithmName])) {
          const baselineResult = algorithmResults[baselineAlgorithm][testCaseId];
          const currentResult = algorithmResults[algorithmName][testCaseId];

          const scoreDifference = currentResult.overallScore - baselineResult.overallScore;
          const confidenceImpact = currentResult.confidence - baselineResult.confidence;

          // Conservative algorithm should produce lower scores for high-risk assets
          if (algorithmName === 'conservative' && testCaseId.includes('high-risk')) {
            expect(scoreDifference).toBeLessThan(0);
          }

          // Aggressive algorithm should produce higher scores for high-yield assets
          if (algorithmName === 'aggressive' && testCaseId.includes('high-yield')) {
            expect(scoreDifference).toBeGreaterThan(0);
          }

          // Confidence should remain stable across algorithm variations
          expect(Math.abs(confidenceImpact)).toBeLessThan(0.15);
        }
      }
    });

    test('should detect compliance rule changes', async () => {
      const complianceConfigurations = [
        { name: 'strict', toleranceLevel: 0.1, requireAllLicenses: true },
        { name: 'standard', toleranceLevel: 0.2, requireAllLicenses: false },
        { name: 'relaxed', toleranceLevel: 0.3, requireAllLicenses: false }
      ];

      const complianceResults: Record<string, any> = {};

      for (const config of complianceConfigurations) {
        complianceResults[config.name] = {};

        const modifiedCompliance = new ComplianceMonitoringFramework({
          toleranceLevel: config.toleranceLevel,
          requireAllLicenses: config.requireAllLicenses,
          enableRealTimeMonitoring: false,
          strictMode: config.name === 'strict'
        });

        for (const testCase of IMPACT_TEST_CASES.slice(0, 3)) {
          const result = await modifiedCompliance.assessCompliance(
            testCase.data.id,
            'rwa',
            testCase.data
          );
          
          complianceResults[config.name][testCase.id] = {
            overallScore: result.overallScore,
            complianceLevel: result.complianceLevel,
            violationsCount: result.violations.length
          };
        }
      }

      // Analyze compliance configuration impact
      const configurations = Object.keys(complianceResults);
      
      for (let i = 0; i < configurations.length - 1; i++) {
        const stricterConfig = configurations[i];
        const relaxedConfig = configurations[i + 1];

        for (const testCaseId of Object.keys(complianceResults[stricterConfig])) {
          const stricterResult = complianceResults[stricterConfig][testCaseId];
          const relaxedResult = complianceResults[relaxedConfig][testCaseId];

          // Stricter configuration should generally result in lower compliance scores
          expect(stricterResult.overallScore).toBeLessThanOrEqual(relaxedResult.overallScore);
          
          // Stricter configuration should find more violations
          expect(stricterResult.violationsCount).toBeGreaterThanOrEqual(relaxedResult.violationsCount);
        }
      }
    });
  });

  describe('Performance Impact Analysis', () => {
    test('should track performance impact of feature additions', async () => {
      const featureConfigurations = [
        { name: 'minimal', enableMLAnalysis: false, enableCaching: false, enablePerplexity: false },
        { name: 'standard', enableMLAnalysis: true, enableCaching: false, enablePerplexity: false },
        { name: 'enhanced', enableMLAnalysis: true, enableCaching: true, enablePerplexity: false },
        { name: 'full', enableMLAnalysis: true, enableCaching: true, enablePerplexity: true }
      ];

      const performanceResults: Record<string, any> = {};

      for (const config of featureConfigurations) {
        const startMemory = global.testUtils.getMemoryUsage();
        const durations: number[] = [];

        for (const testCase of IMPACT_TEST_CASES) {
          const startTime = performance.now();

          // Configure scoring with specific features
          const configuredAgent = new SageSatelliteAgent({
            name: `PerformanceTest-${config.name}`,
            capabilities: config.enableMLAnalysis ? ['rwa-scoring', 'ml-analysis'] : ['rwa-scoring'],
            enableCaching: config.enableCaching,
            enablePerplexity: config.enablePerplexity
          });

          await configuredAgent.initialize();
          
          const result = await configuredAgent.processAnalysisRequest({
            type: 'performance_test',
            data: testCase.data,
            requirements: ['scoring']
          });

          const endTime = performance.now();
          durations.push(endTime - startTime);

          await configuredAgent.shutdown();
        }

        const endMemory = global.testUtils.getMemoryUsage();
        const memoryUsage = endMemory.heapUsed - startMemory.heapUsed;

        performanceResults[config.name] = {
          avgDuration: durations.reduce((a, b) => a + b, 0) / durations.length,
          maxDuration: Math.max(...durations),
          minDuration: Math.min(...durations),
          memoryUsage,
          testCases: durations.length
        };
      }

      // Analyze performance impact
      const baselineConfig = 'minimal';
      const baseline = performanceResults[baselineConfig];

      for (const [configName, results] of Object.entries(performanceResults)) {
        if (configName === baselineConfig) continue;

        const performanceRatio = (results as any).avgDuration / baseline.avgDuration;
        const memoryRatio = (results as any).memoryUsage / baseline.memoryUsage;

        // Performance degradation should be reasonable
        expect(performanceRatio).toBeLessThan(3.0); // No more than 3x slower
        expect(memoryRatio).toBeLessThan(5.0); // No more than 5x memory usage

        // Enhanced features should provide value for the performance cost
        if (configName === 'enhanced' || configName === 'full') {
          expect(performanceRatio).toBeLessThan(2.0); // More stringent for enhanced features
        }

        console.log(`Performance impact of ${configName} vs ${baselineConfig}:
          Duration: ${performanceRatio.toFixed(2)}x
          Memory: ${memoryRatio.toFixed(2)}x`);
      }
    });

    test('should analyze scalability impact', async () => {
      const scalabilityTestSizes = [1, 5, 10, 20];
      const scalabilityResults: Record<number, any> = {};

      for (const size of scalabilityTestSizes) {
        const startTime = performance.now();
        const startMemory = global.testUtils.getMemoryUsage();

        // Process multiple RWAs concurrently
        const testPromises = Array.from({ length: size }, (_, i) => 
          rwaScoring.scoreOpportunity({
            ...IMPACT_TEST_CASES[i % IMPACT_TEST_CASES.length].data,
            id: `scalability-test-${size}-${i}`
          })
        );

        await Promise.all(testPromises);

        const endTime = performance.now();
        const endMemory = global.testUtils.getMemoryUsage();

        scalabilityResults[size] = {
          totalDuration: endTime - startTime,
          avgDurationPerItem: (endTime - startTime) / size,
          memoryUsage: endMemory.heapUsed - startMemory.heapUsed,
          memoryPerItem: (endMemory.heapUsed - startMemory.heapUsed) / size
        };
      }

      // Analyze scalability characteristics
      const baseSize = 1;
      const baseline = scalabilityResults[baseSize];

      for (const [size, results] of Object.entries(scalabilityResults)) {
        const sizeNum = parseInt(size);
        if (sizeNum === baseSize) continue;

        const durationEfficiency = (results as any).avgDurationPerItem / baseline.avgDurationPerItem;
        const memoryEfficiency = (results as any).memoryPerItem / baseline.memoryPerItem;

        // Scalability should show some efficiency gains or at least linear scaling
        expect(durationEfficiency).toBeLessThan(2.0); // Should not get much worse per item
        expect(memoryEfficiency).toBeLessThan(3.0); // Memory usage should scale reasonably

        console.log(`Scalability impact at size ${size}:
          Duration efficiency: ${durationEfficiency.toFixed(2)}x
          Memory efficiency: ${memoryEfficiency.toFixed(2)}x`);
      }
    });
  });

  describe('Integration Impact Analysis', () => {
    test('should detect cross-component integration changes', async () => {
      const integrationScenarios = [
        {
          name: 'sage-only',
          components: ['sage'],
          workflow: async (data: any) => {
            return await rwaScoring.scoreOpportunity(data);
          }
        },
        {
          name: 'sage-compliance',
          components: ['sage', 'compliance'],
          workflow: async (data: any) => {
            const score = await rwaScoring.scoreOpportunity(data);
            const compliance = await complianceFramework.assessCompliance(data.id, 'rwa', data);
            return { score, compliance };
          }
        },
        {
          name: 'full-integration',
          components: ['sage', 'compliance', 'analysis'],
          workflow: async (data: any) => {
            const score = await rwaScoring.scoreOpportunity(data);
            const compliance = await complianceFramework.assessCompliance(data.id, 'rwa', data);
            const analysis = await sageAgent.processAnalysisRequest({
              type: 'integration_test',
              data,
              requirements: ['scoring', 'compliance']
            });
            return { score, compliance, analysis };
          }
        }
      ];

      const integrationResults: Record<string, any> = {};

      for (const scenario of integrationScenarios) {
        integrationResults[scenario.name] = {};

        for (const testCase of IMPACT_TEST_CASES.slice(0, 2)) { // Use subset for performance
          const startTime = performance.now();
          
          try {
            const result = await scenario.workflow(testCase.data);
            const endTime = performance.now();

            integrationResults[scenario.name][testCase.id] = {
              success: true,
              duration: endTime - startTime,
              result: result,
              components: scenario.components.length
            };
          } catch (error) {
            integrationResults[scenario.name][testCase.id] = {
              success: false,
              error: (error as Error).message,
              components: scenario.components.length
            };
          }
        }
      }

      // Analyze integration impact
      for (const [scenarioName, results] of Object.entries(integrationResults)) {
        for (const [testCaseId, result] of Object.entries(results) as Array<[string, any]>) {
          // All integration scenarios should succeed
          expect(result.success).toBe(true);
          
          // Duration should scale reasonably with component count
          expect(result.duration).toBeLessThan(result.components * 5000); // 5s per component max
        }
      }

      // Compare integration scenarios
      const scenarios = Object.keys(integrationResults);
      for (let i = 1; i < scenarios.length; i++) {
        const simpleScenario = scenarios[i - 1];
        const complexScenario = scenarios[i];

        for (const testCaseId of Object.keys(integrationResults[simpleScenario])) {
          const simpleResult = integrationResults[simpleScenario][testCaseId];
          const complexResult = integrationResults[complexScenario][testCaseId];

          // More complex integrations should take longer but not excessively
          const durationRatio = complexResult.duration / simpleResult.duration;
          expect(durationRatio).toBeLessThan(3.0);
        }
      }
    });

    test('should analyze API contract stability', async () => {
      const contractTests = [
        {
          name: 'RWA Scoring API',
          test: async () => {
            const result = await rwaScoring.scoreOpportunity(IMPACT_TEST_CASES[0].data);
            return {
              hasOverallScore: 'overallScore' in result,
              hasRiskAdjustedReturn: 'riskAdjustedReturn' in result,
              hasConfidence: 'confidence' in result,
              hasRecommendations: 'recommendations' in result,
              hasFactors: 'factors' in result,
              overallScoreType: typeof result.overallScore,
              recommendationsIsArray: Array.isArray(result.recommendations),
              factorsIsArray: Array.isArray(result.factors)
            };
          }
        },
        {
          name: 'Compliance Assessment API',
          test: async () => {
            const result = await complianceFramework.assessCompliance(
              IMPACT_TEST_CASES[0].data.id,
              'rwa',
              IMPACT_TEST_CASES[0].data
            );
            return {
              hasOverallScore: 'overallScore' in result,
              hasComplianceLevel: 'complianceLevel' in result,
              hasViolations: 'violations' in result,
              hasRecommendations: 'recommendations' in result,
              complianceLevelValid: ['compliant', 'partial', 'non-compliant'].includes(result.complianceLevel),
              violationsIsArray: Array.isArray(result.violations),
              recommendationsIsArray: Array.isArray(result.recommendations)
            };
          }
        },
        {
          name: 'Sage Agent API',
          test: async () => {
            const result = await sageAgent.processAnalysisRequest({
              type: 'contract_test',
              data: IMPACT_TEST_CASES[0].data,
              requirements: ['scoring', 'compliance']
            });
            return {
              hasRwaScore: 'rwaScore' in result,
              hasComplianceAssessment: 'complianceAssessment' in result,
              hasRecommendations: 'recommendations' in result,
              hasMetadata: 'metadata' in result
            };
          }
        }
      ];

      const contractResults: Record<string, any> = {};

      for (const contractTest of contractTests) {
        try {
          contractResults[contractTest.name] = await contractTest.test();
        } catch (error) {
          contractResults[contractTest.name] = {
            error: (error as Error).message,
            failed: true
          };
        }
      }

      // Validate API contracts
      for (const [contractName, result] of Object.entries(contractResults)) {
        expect(result.failed).not.toBe(true);
        
        // All APIs should have consistent structure
        if (contractName === 'RWA Scoring API') {
          expect(result.hasOverallScore).toBe(true);
          expect(result.hasRiskAdjustedReturn).toBe(true);
          expect(result.hasConfidence).toBe(true);
          expect(result.hasRecommendations).toBe(true);
          expect(result.hasFactors).toBe(true);
          expect(result.overallScoreType).toBe('number');
          expect(result.recommendationsIsArray).toBe(true);
          expect(result.factorsIsArray).toBe(true);
        }

        if (contractName === 'Compliance Assessment API') {
          expect(result.hasOverallScore).toBe(true);
          expect(result.hasComplianceLevel).toBe(true);
          expect(result.hasViolations).toBe(true);
          expect(result.hasRecommendations).toBe(true);
          expect(result.complianceLevelValid).toBe(true);
          expect(result.violationsIsArray).toBe(true);
          expect(result.recommendationsIsArray).toBe(true);
        }

        if (contractName === 'Sage Agent API') {
          expect(result.hasRwaScore).toBe(true);
          expect(result.hasComplianceAssessment).toBe(true);
          expect(result.hasRecommendations).toBe(true);
          expect(result.hasMetadata).toBe(true);
        }
      }
    });
  });

  describe('Backward Compatibility Impact', () => {
    test('should validate backward compatibility with legacy data formats', async () => {
      const legacyFormats = [
        {
          version: 'v0.9.0',
          data: {
            id: 'legacy-v090-001',
            asset_type: 'real-estate', // Old snake_case format
            issuer_name: 'Legacy Fund',
            asset_value: 1000000,
            expected_yield: 0.065,
            risk_score: 'A'
          }
        },
        {
          version: 'v0.8.0',
          data: {
            id: 'legacy-v080-001',
            type: 'realestate', // No hyphen
            issuer: 'Old Fund',
            value: 1000000,
            yield: 6.5, // Percentage instead of decimal
            risk: 'A'
          }
        },
        {
          version: 'v0.7.0',
          data: {
            id: 'legacy-v070-001',
            category: 'real_estate',
            provider: 'Ancient Fund',
            amount: 1000000,
            return_rate: 0.065,
            safety_rating: 1 // Numeric instead of letter
          }
        }
      ];

      const compatibilityResults: Record<string, any> = {};

      for (const legacy of legacyFormats) {
        try {
          const result = await rwaScoring.scoreOpportunity(legacy.data as any);
          
          compatibilityResults[legacy.version] = {
            success: true,
            score: result.overallScore,
            confidence: result.confidence,
            hasRecommendations: Array.isArray(result.recommendations),
            hasFactors: Array.isArray(result.factors)
          };
        } catch (error) {
          compatibilityResults[legacy.version] = {
            success: false,
            error: (error as Error).message,
            errorType: (error as Error).constructor.name
          };
        }
      }

      // Validate backward compatibility
      for (const [version, result] of Object.entries(compatibilityResults)) {
        // Should handle gracefully - either succeed or fail with clear error
        if (result.success) {
          expect(result.score).toBeInScoreRange(0, 1);
          expect(result.confidence).toBeInScoreRange(0, 1);
          expect(result.hasRecommendations).toBe(true);
          expect(result.hasFactors).toBe(true);
        } else {
          // If it fails, should be a validation error, not a crash
          expect(result.errorType).toMatch(/validation|format|schema/i);
        }
      }
    });
  });
});