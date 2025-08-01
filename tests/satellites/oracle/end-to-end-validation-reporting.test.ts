/**
 * Oracle Satellite - End-to-End Validation and Reporting System
 * Task 26.5: Test complete oracle validation workflows and comprehensive reporting
 * 
 * Tests full oracle data pipeline validation, comprehensive reporting, and end-to-end system integration
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach, jest } from '@jest/globals';
import { OracleValidationPipeline } from '../../../src/satellites/oracle/validation/oracle-validation-pipeline';
import { ComprehensiveReportGenerator } from '../../../src/satellites/oracle/reporting/comprehensive-report-generator';
import { ValidationWorkflowOrchestrator } from '../../../src/satellites/oracle/orchestration/validation-workflow-orchestrator';
import { OracleMetricsCollector } from '../../../src/satellites/oracle/metrics/oracle-metrics-collector';
import { ValidationResultsAggregator } from '../../../src/satellites/oracle/reporting/validation-results-aggregator';
import { AlertingSystem } from '../../../src/satellites/oracle/alerting/alerting-system';
import { getUnifiedAIClient } from '../../../src/integrations/ai/unified-ai-client';
import { getLogger } from '../../../src/shared/logging/logger';
import Redis from 'ioredis';
import { Pool } from 'pg';

describe('Oracle Satellite - End-to-End Validation and Reporting System', () => {
  let validationPipeline: OracleValidationPipeline;
  let reportGenerator: ComprehensiveReportGenerator;
  let workflowOrchestrator: ValidationWorkflowOrchestrator;
  let metricsCollector: OracleMetricsCollector;
  let resultsAggregator: ValidationResultsAggregator;
  let alertingSystem: AlertingSystem;
  let redisClient: Redis;
  let pgPool: Pool;
  let aiClient: any;
  let logger: any;

  beforeAll(async () => {
    // Initialize dependencies
    redisClient = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      lazyConnect: true,
      connectTimeout: 5000,
      commandTimeout: 10000,
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3
    });

    pgPool = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'yieldsense_test',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 30000,
      max: 10
    });

    aiClient = getUnifiedAIClient();
    logger = getLogger({ name: 'end-to-end-validation-test' });

    // Initialize Oracle Validation Pipeline
    validationPipeline = new OracleValidationPipeline({
      enabledValidations: [
        'feed_accuracy',
        'cross_oracle_consensus',
        'anomaly_detection',
        'data_integrity',
        'source_authentication',
        'timestamp_validation'
      ],
      parallelProcessing: true,
      maxConcurrentValidations: 10,
      validationTimeout: 30000,
      retryFailedValidations: true,
      generateDetailedReports: true
    }, redisClient, pgPool, aiClient, logger);

    // Initialize Comprehensive Report Generator
    reportGenerator = new ComprehensiveReportGenerator({
      reportFormats: ['json', 'html', 'pdf', 'csv'],
      includeVisualizations: true,
      includeRecommendations: true,
      enableExecutiveSummary: true,
      customBranding: {
        companyName: 'YieldSensei',
        logoPath: '/assets/logo.png'
      },
      reportRetentionDays: 90
    }, pgPool, aiClient, logger);

    // Initialize Validation Workflow Orchestrator
    workflowOrchestrator = new ValidationWorkflowOrchestrator({
      maxConcurrentWorkflows: 5,
      workflowTimeout: 300000, // 5 minutes
      enableWorkflowChaining: true,
      enableConditionalBranching: true,
      enableErrorRecovery: true,
      workflowPersistence: true
    }, redisClient, pgPool, aiClient, logger);

    // Initialize Oracle Metrics Collector
    metricsCollector = new OracleMetricsCollector({
      metricsRetentionDays: 365,
      realTimeMetrics: true,
      aggregationIntervals: ['1m', '5m', '15m', '1h', '1d'],
      enableCustomMetrics: true,
      exportFormats: ['prometheus', 'influxdb', 'elasticsearch']
    }, redisClient, pgPool, logger);

    // Initialize Validation Results Aggregator
    resultsAggregator = new ValidationResultsAggregator({
      aggregationStrategies: ['temporal', 'source_based', 'validation_type'],
      enableTrendAnalysis: true,
      enableComparative analysis: true,
      historicalDepth: 90, // days
      confidenceIntervals: [0.95, 0.99]
    }, pgPool, aiClient, logger);

    // Initialize Alerting System
    alertingSystem = new AlertingSystem({
      alertChannels: ['email', 'slack', 'webhook', 'sms'],
      alertSeverityLevels: ['info', 'warning', 'critical', 'emergency'],
      enableAlertAggregation: true,
      enableSmartThrottling: true,
      escalationRules: true
    }, redisClient, pgPool, logger);

    await validationPipeline.initialize();
    await reportGenerator.initialize();
    await workflowOrchestrator.initialize();
    await metricsCollector.initialize();
    await resultsAggregator.initialize();
    await alertingSystem.initialize();
  });

  afterAll(async () => {
    if (validationPipeline) {
      await validationPipeline.shutdown();
    }
    if (reportGenerator) {
      await reportGenerator.shutdown();
    }
    if (workflowOrchestrator) {
      await workflowOrchestrator.shutdown();
    }
    if (metricsCollector) {
      await metricsCollector.shutdown();
    }
    if (resultsAggregator) {
      await resultsAggregator.shutdown();
    }
    if (alertingSystem) {
      await alertingSystem.shutdown();
    }
    if (redisClient) {
      await redisClient.quit();
    }
    if (pgPool) {
      await pgPool.end();
    }
  });

  describe('Complete Oracle Validation Pipeline', () => {
    
    test('should execute comprehensive oracle data validation workflow', async () => {
      const comprehensiveValidationInput = {
        workflowId: 'comprehensive-validation-001',
        oracleDataSources: [
          {
            id: 'chainlink-eth-usd',
            type: 'blockchain_oracle',
            blockchain: 'ethereum',
            contractAddress: '0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419',
            asset: 'ETH/USD',
            expectedRange: { min: 1500, max: 5000 },
            confidenceThreshold: 0.95
          },
          {
            id: 'coinbase-eth-usd',
            type: 'centralized_exchange',
            endpoint: 'https://api.pro.coinbase.com/products/ETH-USD/ticker',
            asset: 'ETH/USD',
            authentication: { type: 'public' },
            rateLimit: { requestsPerMinute: 60 }
          },
          {
            id: 'binance-eth-usdt',
            type: 'centralized_exchange', 
            endpoint: 'https://api.binance.com/api/v3/ticker/price?symbol=ETHUSDT',
            asset: 'ETH/USDT',
            authentication: { type: 'public' },
            rateLimit: { requestsPerMinute: 1200 }
          },
          {
            id: 'uniswap-v3-eth-usdc',
            type: 'dex_oracle',
            blockchain: 'ethereum',
            poolAddress: '0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8',
            asset: 'ETH/USDC',
            timeWindow: 3600 // 1 hour TWAP
          }
        ],
        validationParameters: {
          maxDeviationPercent: 5.0,
          minConsensusThreshold: 0.75,
          anomalyDetectionSensitivity: 'medium',
          dataIntegrityChecks: ['hash_verification', 'signature_validation'],
          temporalConsistencyWindow: 300, // 5 minutes
          crossValidationRequired: true
        },
        reportingRequirements: {
          formats: ['json', 'html'],
          includeVisualizations: true,
          includeExecutiveSummary: true,
          detailLevel: 'comprehensive',
          distributionList: ['admin@yieldsensei.com']
        }
      };

      const startTime = Date.now();
      
      const validationResult = await validationPipeline.executeComprehensiveValidation(
        comprehensiveValidationInput
      );

      const endTime = Date.now();
      const executionTime = endTime - startTime;

      expect(validationResult).toBeDefined();
      expect(validationResult.workflowId).toBe(comprehensiveValidationInput.workflowId);
      expect(validationResult.success).toBe(true);
      expect(executionTime).toBeLessThan(45000); // Should complete within 45 seconds

      // Verify all data sources were validated
      expect(validationResult.sourceResults).toBeDefined();
      expect(validationResult.sourceResults.length).toBe(comprehensiveValidationInput.oracleDataSources.length);

      // Verify validation components were executed
      const validationComponents = [
        'feed_accuracy',
        'cross_oracle_consensus', 
        'anomaly_detection',
        'data_integrity',
        'timestamp_validation'
      ];

      validationComponents.forEach(component => {
        expect(validationResult.componentResults[component]).toBeDefined();
        expect(validationResult.componentResults[component].executed).toBe(true);
      });

      // Verify cross-oracle consensus
      expect(validationResult.consensusAnalysis).toBeDefined();
      expect(validationResult.consensusAnalysis.consensusValue).toBeDefined();
      expect(validationResult.consensusAnalysis.confidence).toBeGreaterThan(0.7);
      expect(validationResult.consensusAnalysis.participatingOracles).toBe(4);

      // Verify anomaly detection results
      expect(validationResult.anomalyDetection).toBeDefined();
      expect(validationResult.anomalyDetection.anomaliesDetected).toBeDefined();
      expect(validationResult.anomalyDetection.analysisMethod).toBeDefined();

      // Verify data integrity checks
      expect(validationResult.integrityChecks).toBeDefined();
      expect(validationResult.integrityChecks.hashVerification).toBeDefined();
      expect(validationResult.integrityChecks.signatureValidation).toBeDefined();

      // Verify performance metrics
      expect(validationResult.performanceMetrics).toBeDefined();
      expect(validationResult.performanceMetrics.totalExecutionTime).toBeLessThan(45000);
      expect(validationResult.performanceMetrics.averageResponseTime).toBeLessThan(2000);
      expect(validationResult.performanceMetrics.successRate).toBeGreaterThan(0.8);
    });

    test('should handle validation failures gracefully with comprehensive error reporting', async () => {
      const failureScenarioInput = {
        workflowId: 'failure-scenario-001',
        oracleDataSources: [
          {
            id: 'timeout-source',
            type: 'rest_api',
            endpoint: 'https://timeout-api.example.com/price',
            asset: 'BTC/USD',
            timeout: 1000, // Very short timeout to force failure
            expectedBehavior: 'timeout'
          },
          {
            id: 'corrupted-data-source',
            type: 'rest_api',
            endpoint: 'https://corrupted-api.example.com/price',
            asset: 'BTC/USD',
            expectedBehavior: 'data_corruption'
          },
          {
            id: 'malicious-source',
            type: 'rest_api',
            endpoint: 'https://malicious-api.example.com/price',
            asset: 'BTC/USD',
            expectedBehavior: 'malicious_data'
          },
          {
            id: 'healthy-source',
            type: 'rest_api',
            endpoint: 'https://healthy-api.example.com/price',
            asset: 'BTC/USD',
            expectedBehavior: 'success'
          }
        ],
        validationParameters: {
          maxDeviationPercent: 2.0, // Strict threshold
          minConsensusThreshold: 0.9, // High consensus requirement
          failureHandling: 'comprehensive_analysis',
          generateFailureReport: true
        }
      };

      const failureValidationResult = await validationPipeline.executeComprehensiveValidation(
        failureScenarioInput
      );

      expect(failureValidationResult).toBeDefined();
      expect(failureValidationResult.workflowId).toBe(failureScenarioInput.workflowId);
      
      // Should complete but with failures detected
      expect(failureValidationResult.overallSuccess).toBe(false);
      expect(failureValidationResult.partialSuccess).toBe(true);

      // Verify failure analysis
      expect(failureValidationResult.failureAnalysis).toBeDefined();
      expect(failureValidationResult.failureAnalysis.failedSources).toBeDefined();
      expect(failureValidationResult.failureAnalysis.failedSources.length).toBe(3);

      // Verify specific failure types were identified
      const failureTypes = failureValidationResult.failureAnalysis.failureTypes;
      expect(failureTypes).toContain('timeout');
      expect(failureTypes).toContain('data_corruption');
      expect(failureTypes).toContain('malicious_data');

      // Verify recovery strategies were suggested
      expect(failureValidationResult.recoveryStrategies).toBeDefined();
      expect(failureValidationResult.recoveryStrategies.length).toBeGreaterThan(0);

      // Verify healthy source still provided valid data
      const healthySourceResult = failureValidationResult.sourceResults.find(
        r => r.sourceId === 'healthy-source'
      );
      expect(healthySourceResult.success).toBe(true);
      expect(healthySourceResult.validationPassed).toBe(true);

      // Verify comprehensive error reporting
      expect(failureValidationResult.errorReport).toBeDefined();
      expect(failureValidationResult.errorReport.detailedErrors).toBeDefined();
      expect(failureValidationResult.errorReport.impactAssessment).toBeDefined();
      expect(failureValidationResult.errorReport.mitigation recommendations).toBeDefined();
    });

    test('should validate complex multi-asset oracle scenarios', async () => {
      const multiAssetValidationInput = {
        workflowId: 'multi-asset-validation-001',
        assetValidationGroups: [
          {
            groupId: 'major-cryptos',
            assets: ['BTC/USD', 'ETH/USD', 'BNB/USD'],
            validationStrategy: 'cross_asset_correlation',
            expectedCorrelations: {
              'BTC/USD-ETH/USD': { min: 0.6, max: 0.9 },
              'BTC/USD-BNB/USD': { min: 0.4, max: 0.8 },
              'ETH/USD-BNB/USD': { min: 0.5, max: 0.85 }
            }
          },
          {
            groupId: 'defi-tokens',
            assets: ['UNI/USD', 'AAVE/USD', 'COMP/USD'],
            validationStrategy: 'sector_consistency',
            sectorBenchmarks: {
              volatilityRange: { min: 0.03, max: 0.15 },
              correlationWithETH: { min: 0.4, max: 0.8 }
            }
          },
          {
            groupId: 'stablecoins',
            assets: ['USDC/USD', 'USDT/USD', 'DAI/USD'],
            validationStrategy: 'peg_maintenance',
            pegValidation: {
              maxDeviationFromPeg: 0.005, // 0.5%
              recoveryTimeThreshold: 3600 // 1 hour
            }
          }
        ],
        crossGroupValidations: [
          {
            type: 'market_regime_consistency',
            description: 'Ensure all asset groups behave consistently with current market regime'
          },
          {
            type: 'systemic_risk_assessment',
            description: 'Detect potential systemic risks across asset groups'
          }
        ],
        temporalValidations: {
          timeWindows: ['5m', '15m', '1h', '4h', '1d'],
          consistencyChecks: true,
          trendAnalysis: true
        }
      };

      const multiAssetResult = await validationPipeline.executeMultiAssetValidation(
        multiAssetValidationInput
      );

      expect(multiAssetResult).toBeDefined();
      expect(multiAssetResult.success).toBe(true);

      // Verify group validations
      expect(multiAssetResult.groupResults).toBeDefined();
      expect(multiAssetResult.groupResults.length).toBe(3);

      // Verify major crypto correlations
      const majorCryptosResult = multiAssetResult.groupResults.find(
        g => g.groupId === 'major-cryptos'
      );
      expect(majorCryptosResult.correlationAnalysis).toBeDefined();
      expect(majorCryptosResult.correlationAnalysis.correlations).toBeDefined();

      // Verify DeFi token sector consistency
      const defiTokensResult = multiAssetResult.groupResults.find(
        g => g.groupId === 'defi-tokens'
      );
      expect(defiTokensResult.sectorConsistency).toBeDefined();
      expect(defiTokensResult.sectorConsistency.benchmarkCompliance).toBe(true);

      // Verify stablecoin peg maintenance
      const stablecoinsResult = multiAssetResult.groupResults.find(
        g => g.groupId === 'stablecoins'
      );
      expect(stablecoinsResult.pegMaintenance).toBeDefined();
      expect(stablecoinsResult.pegMaintenance.allPegsHealthy).toBe(true);

      // Verify cross-group validations
      expect(multiAssetResult.crossGroupValidations).toBeDefined();
      expect(multiAssetResult.crossGroupValidations.marketRegimeConsistency).toBeDefined();
      expect(multiAssetResult.crossGroupValidations.systemicRiskAssessment).toBeDefined();

      // Verify temporal validations
      expect(multiAssetResult.temporalValidations).toBeDefined();
      multiAssetValidationInput.temporalValidations.timeWindows.forEach(window => {
        expect(multiAssetResult.temporalValidations[window]).toBeDefined();
      });
    });
  });

  describe('Comprehensive Reporting System', () => {
    
    test('should generate detailed validation reports in multiple formats', async () => {
      const reportGenerationInput = {
        reportId: 'comprehensive-report-001',
        reportType: 'oracle_validation_summary',
        timeRange: {
          start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
          end: new Date()
        },
        includedComponents: [
          'validation_results',
          'performance_metrics',
          'anomaly_analysis',
          'source_reliability',
          'trend_analysis',
          'recommendations'
        ],
        outputFormats: ['json', 'html', 'pdf'],
        customizations: {
          includeExecutiveSummary: true,
          includeVisualizations: true,
          includeTechnicalDetails: true,
          includeActionItems: true,
          branding: {
            companyName: 'YieldSensei',
            reportTitle: 'Oracle Validation Comprehensive Report'
          }
        }
      };

      const reportResults = await reportGenerator.generateComprehensiveReport(
        reportGenerationInput
      );

      expect(reportResults).toBeDefined();
      expect(reportResults.success).toBe(true);
      expect(reportResults.reportId).toBe(reportGenerationInput.reportId);

      // Verify all requested formats were generated
      expect(reportResults.generatedFormats).toBeDefined();
      expect(reportResults.generatedFormats.length).toBe(3);
      expect(reportResults.generatedFormats).toContain('json');
      expect(reportResults.generatedFormats).toContain('html');
      expect(reportResults.generatedFormats).toContain('pdf');

      // Verify report content structure
      const jsonReport = reportResults.reports['json'];
      expect(jsonReport).toBeDefined();

      // Executive Summary
      expect(jsonReport.executiveSummary).toBeDefined();
      expect(jsonReport.executiveSummary.overallHealth).toBeDefined();
      expect(jsonReport.executiveSummary.keyFindings).toBeDefined();
      expect(jsonReport.executiveSummary.criticalIssues).toBeDefined();
      expect(jsonReport.executiveSummary.recommendations).toBeDefined();

      // Validation Results Section
      expect(jsonReport.validationResults).toBeDefined();
      expect(jsonReport.validationResults.summary).toBeDefined();
      expect(jsonReport.validationResults.detailedResults).toBeDefined();
      expect(jsonReport.validationResults.successRate).toBeGreaterThan(0);

      // Performance Metrics Section
      expect(jsonReport.performanceMetrics).toBeDefined();
      expect(jsonReport.performanceMetrics.averageResponseTime).toBeDefined();
      expect(jsonReport.performanceMetrics.throughput).toBeDefined();
      expect(jsonReport.performanceMetrics.errorRates).toBeDefined();

      // Anomaly Analysis Section
      expect(jsonReport.anomalyAnalysis).toBeDefined();
      expect(jsonReport.anomalyAnalysis.detectedAnomalies).toBeDefined();
      expect(jsonReport.anomalyAnalysis.anomalyTrends).toBeDefined();

      // Source Reliability Section
      expect(jsonReport.sourceReliability).toBeDefined();
      expect(jsonReport.sourceReliability.reliabilityScores).toBeDefined();
      expect(jsonReport.sourceReliability.performanceRankings).toBeDefined();

      // Visualizations
      if (reportGenerationInput.customizations.includeVisualizations) {
        expect(jsonReport.visualizations).toBeDefined();
        expect(jsonReport.visualizations.charts).toBeDefined();
        expect(jsonReport.visualizations.charts.length).toBeGreaterThan(0);
      }

      // Verify HTML report structure
      const htmlReport = reportResults.reports['html'];
      expect(htmlReport).toBeDefined();
      expect(htmlReport).toContain('<!DOCTYPE html>');
      expect(htmlReport).toContain('YieldSensei');
      expect(htmlReport).toContain('Oracle Validation Comprehensive Report');

      // Verify PDF was generated (check metadata)
      const pdfMetadata = reportResults.reportMetadata['pdf'];
      expect(pdfMetadata).toBeDefined();
      expect(pdfMetadata.pages).toBeGreaterThan(0);
      expect(pdfMetadata.fileSize).toBeGreaterThan(0);
    });

    test('should generate real-time dashboard reports', async () => {
      const dashboardConfig = {
        dashboardId: 'oracle-realtime-dashboard',
        refreshInterval: 30000, // 30 seconds
        widgets: [
          {
            type: 'oracle_health_overview',
            title: 'Oracle Health Overview',
            position: { row: 1, col: 1, width: 6, height: 4 },
            dataSource: 'real_time_health_metrics'
          },
          {
            type: 'price_feed_accuracy',
            title: 'Price Feed Accuracy',
            position: { row: 1, col: 7, width: 6, height: 4 },
            dataSource: 'accuracy_metrics',
            timeWindow: '1h'
          },
          {
            type: 'anomaly_alerts',
            title: 'Recent Anomalies',
            position: { row: 5, col: 1, width: 12, height: 3 },
            dataSource: 'anomaly_detection_results',
            limit: 10
          },
          {
            type: 'performance_trends',
            title: 'Performance Trends',
            position: { row: 8, col: 1, width: 12, height: 5 },
            dataSource: 'performance_metrics',
            timeWindow: '24h'
          }
        ],
        alertIntegration: true,
        exportOptions: ['png', 'pdf', 'json']
      };

      const dashboardResult = await reportGenerator.generateRealtimeDashboard(dashboardConfig);

      expect(dashboardResult).toBeDefined();
      expect(dashboardResult.success).toBe(true);
      expect(dashboardResult.dashboardId).toBe(dashboardConfig.dashboardId);

      // Verify widget data was populated
      expect(dashboardResult.widgets).toBeDefined();
      expect(dashboardResult.widgets.length).toBe(dashboardConfig.widgets.length);

      // Verify oracle health overview widget
      const healthWidget = dashboardResult.widgets.find(w => w.type === 'oracle_health_overview');
      expect(healthWidget).toBeDefined();
      expect(healthWidget.data).toBeDefined();
      expect(healthWidget.data.totalOracles).toBeGreaterThan(0);
      expect(healthWidget.data.healthyOracles).toBeDefined();
      expect(healthWidget.data.degradedOracles).toBeDefined();
      expect(healthWidget.data.failedOracles).toBeDefined();

      // Verify price feed accuracy widget
      const accuracyWidget = dashboardResult.widgets.find(w => w.type === 'price_feed_accuracy');
      expect(accuracyWidget).toBeDefined();
      expect(accuracyWidget.data).toBeDefined();
      expect(accuracyWidget.data.averageAccuracy).toBeGreaterThan(0);
      expect(accuracyWidget.data.accuracyBySource).toBeDefined();

      // Verify anomaly alerts widget
      const anomalyWidget = dashboardResult.widgets.find(w => w.type === 'anomaly_alerts');
      expect(anomalyWidget).toBeDefined();
      expect(anomalyWidget.data).toBeDefined();
      expect(anomalyWidget.data.recentAnomalies).toBeDefined();

      // Verify performance trends widget
      const performanceWidget = dashboardResult.widgets.find(w => w.type === 'performance_trends');
      expect(performanceWidget).toBeDefined();
      expect(performanceWidget.data).toBeDefined();
      expect(performanceWidget.data.trends).toBeDefined();

      // Verify dashboard metadata
      expect(dashboardResult.metadata).toBeDefined();
      expect(dashboardResult.metadata.lastUpdated).toBeDefined();
      expect(dashboardResult.metadata.nextRefresh).toBeDefined();
      expect(dashboardResult.metadata.dataFreshness).toBeLessThan(60000); // Less than 1 minute old
    });

    test('should generate comparative analysis reports', async () => {
      const comparativeAnalysisConfig = {
        analysisId: 'oracle-comparative-analysis-001',
        analysisType: 'oracle_performance_comparison',
        comparisonPeriods: [
          {
            name: 'Current Week',
            start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
            end: new Date()
          },
          {
            name: 'Previous Week',
            start: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
            end: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
          },
          {
            name: 'Previous Month',
            start: new Date(Date.now() - 37 * 24 * 60 * 60 * 1000),
            end: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
          }
        ],
        comparisonMetrics: [
          'accuracy_scores',
          'response_times',
          'availability',
          'error_rates',
          'consensus_agreement',
          'anomaly_rates'
        ],
        oracleSources: [
          'chainlink-eth-usd',
          'coinbase-eth-usd',
          'binance-eth-usdt',
          'uniswap-v3-eth-usdc'
        ],
        statisticalTests: [
          'significance_testing',
          'trend_analysis',
          'variance_analysis',
          'correlation_analysis'
        ],
        visualizations: [
          'time_series_comparison',
          'performance_heatmap',
          'ranking_changes',
          'distribution_plots'
        ]
      };

      const comparativeResult = await reportGenerator.generateComparativeAnalysis(
        comparativeAnalysisConfig
      );

      expect(comparativeResult).toBeDefined();
      expect(comparativeResult.success).toBe(true);
      expect(comparativeResult.analysisId).toBe(comparativeAnalysisConfig.analysisId);

      // Verify period comparisons
      expect(comparativeResult.periodComparisons).toBeDefined();
      expect(comparativeResult.periodComparisons.length).toBe(comparativeAnalysisConfig.comparisonPeriods.length);

      // Verify metric comparisons
      expect(comparativeResult.metricComparisons).toBeDefined();
      comparativeAnalysisConfig.comparisonMetrics.forEach(metric => {
        expect(comparativeResult.metricComparisons[metric]).toBeDefined();
        expect(comparativeResult.metricComparisons[metric].currentPeriod).toBeDefined();
        expect(comparativeResult.metricComparisons[metric].previousPeriods).toBeDefined();
        expect(comparativeResult.metricComparisons[metric].change).toBeDefined();
        expect(comparativeResult.metricComparisons[metric].changeDirection).toBeDefined();
      });

      // Verify oracle source comparisons
      expect(comparativeResult.sourceComparisons).toBeDefined();
      comparativeAnalysisConfig.oracleSources.forEach(source => {
        expect(comparativeResult.sourceComparisons[source]).toBeDefined();
        expect(comparativeResult.sourceComparisons[source].performanceChange).toBeDefined();
        expect(comparativeResult.sourceComparisons[source].rankingChange).toBeDefined();
      });

      // Verify statistical analysis
      expect(comparativeResult.statisticalAnalysis).toBeDefined();
      comparativeAnalysisConfig.statisticalTests.forEach(test => {
        expect(comparativeResult.statisticalAnalysis[test]).toBeDefined();
      });

      // Verify significance testing results
      const significanceResults = comparativeResult.statisticalAnalysis.significance_testing;
      expect(significanceResults.significantChanges).toBeDefined();
      expect(significanceResults.confidenceLevel).toBe(0.95);
      expect(significanceResults.pValues).toBeDefined();

      // Verify trend analysis
      const trendAnalysis = comparativeResult.statisticalAnalysis.trend_analysis;
      expect(trendAnalysis.trends).toBeDefined();
      expect(trendAnalysis.trendStrength).toBeDefined();
      expect(trendAnalysis.projections).toBeDefined();

      // Verify visualizations were generated
      expect(comparativeResult.visualizations).toBeDefined();
      comparativeAnalysisConfig.visualizations.forEach(viz => {
        expect(comparativeResult.visualizations[viz]).toBeDefined();
        expect(comparativeResult.visualizations[viz].data).toBeDefined();
        expect(comparativeResult.visualizations[viz].config).toBeDefined();
      });

      // Verify insights and recommendations
      expect(comparativeResult.insights).toBeDefined();
      expect(comparativeResult.insights.keyFindings).toBeDefined();
      expect(comparativeResult.insights.performanceChanges).toBeDefined();
      expect(comparativeResult.insights.recommendations).toBeDefined();
    });
  });

  describe('Workflow Orchestration and Automation', () => {
    
    test('should orchestrate complex validation workflows with conditional branching', async () => {
      const complexWorkflowDefinition = {
        workflowId: 'complex-oracle-validation-workflow',
        name: 'Advanced Oracle Validation with Conditional Logic',
        steps: [
          {
            id: 'initial-health-check',
            type: 'health_assessment',
            parameters: {
              sources: ['chainlink-eth-usd', 'coinbase-eth-usd', 'binance-eth-usdt'],
              healthThreshold: 0.9
            },
            nextSteps: {
              onSuccess: 'parallel-validation',
              onFailure: 'degraded-mode-validation'
            }
          },
          {
            id: 'parallel-validation',
            type: 'parallel_execution',
            condition: 'initial-health-check.healthScore >= 0.9',
            parallelSteps: [
              {
                id: 'accuracy-validation',
                type: 'accuracy_assessment',
                parameters: {
                  accuracyThreshold: 0.95,
                  crossValidation: true
                }
              },
              {
                id: 'consensus-validation',
                type: 'consensus_analysis',
                parameters: {
                  consensusThreshold: 0.8,
                  outlierDetection: true
                }
              },
              {
                id: 'anomaly-detection',
                type: 'anomaly_analysis',
                parameters: {
                  detectionMethods: ['statistical', 'ml_based'],
                  sensitivityLevel: 'medium'
                }
              }
            ],
            nextSteps: {
              onSuccess: 'comprehensive-reporting',
              onPartialSuccess: 'detailed-analysis',
              onFailure: 'error-analysis'
            }
          },
          {
            id: 'degraded-mode-validation',
            type: 'degraded_validation',
            condition: 'initial-health-check.healthScore < 0.9',
            parameters: {
              fallbackSources: ['historical-data', 'backup-oracles'],
              reducedAccuracyThreshold: 0.85,
              emergencyProtocols: true
            },
            nextSteps: {
              onSuccess: 'emergency-reporting',
              onFailure: 'critical-alert'
            }
          },
          {
            id: 'comprehensive-reporting',
            type: 'report_generation',
            condition: 'parallel-validation.allStepsSuccessful',
            parameters: {
              reportType: 'comprehensive',
              includeRecommendations: true,
              distributionList: ['admin@yieldsensei.com']
            }
          },
          {
            id: 'detailed-analysis',
            type: 'detailed_investigation',
            condition: 'parallel-validation.partialSuccess',
            parameters: {
              investigationDepth: 'deep',
              focusAreas: 'failedComponents',
              generateActionPlan: true
            },
            nextSteps: {
              onComplete: 'comprehensive-reporting'
            }
          },
          {
            id: 'error-analysis',
            type: 'error_investigation',
            condition: 'parallel-validation.failed',
            parameters: {
              errorClassification: true,
              rootCauseAnalysis: true,
              recoveryStrategies: true
            },
            nextSteps: {
              onComplete: 'emergency-reporting'
            }
          }
        ],
        globalParameters: {
          maxExecutionTime: 300000, // 5 minutes
          enableLogging: true,
          enableRetry: true,
          maxRetries: 2
        },
        errorHandling: {
          strategy: 'graceful_degradation',
          notificationChannels: ['email', 'slack'],
          escalationRules: true
        }
      };

      const workflowExecution = await workflowOrchestrator.executeWorkflow(
        complexWorkflowDefinition
      );

      expect(workflowExecution).toBeDefined();
      expect(workflowExecution.workflowId).toBe(complexWorkflowDefinition.workflowId);
      expect(workflowExecution.success).toBe(true);

      // Verify workflow execution path
      expect(workflowExecution.executionPath).toBeDefined();
      expect(workflowExecution.executionPath.length).toBeGreaterThan(0);
      expect(workflowExecution.executionPath[0].stepId).toBe('initial-health-check');

      // Verify conditional branching worked
      const initialHealthResult = workflowExecution.stepResults['initial-health-check'];
      expect(initialHealthResult).toBeDefined();
      expect(initialHealthResult.healthScore).toBeDefined();

      if (initialHealthResult.healthScore >= 0.9) {
        // Should have executed parallel validation
        expect(workflowExecution.stepResults['parallel-validation']).toBeDefined();
        expect(workflowExecution.stepResults['accuracy-validation']).toBeDefined();
        expect(workflowExecution.stepResults['consensus-validation']).toBeDefined();
        expect(workflowExecution.stepResults['anomaly-detection']).toBeDefined();
      } else {
        // Should have executed degraded mode validation
        expect(workflowExecution.stepResults['degraded-mode-validation']).toBeDefined();
      }

      // Verify final reporting step was executed
      const reportingStepExecuted = workflowExecution.stepResults['comprehensive-reporting'] || 
                                  workflowExecution.stepResults['emergency-reporting'];
      expect(reportingStepExecuted).toBeDefined();

      // Verify workflow metadata
      expect(workflowExecution.metadata).toBeDefined();
      expect(workflowExecution.metadata.startTime).toBeDefined();
      expect(workflowExecution.metadata.endTime).toBeDefined();
      expect(workflowExecution.metadata.totalExecutionTime).toBeLessThan(300000);
      expect(workflowExecution.metadata.stepsExecuted).toBeGreaterThan(0);
    });

    test('should handle workflow chaining and dependencies', async () => {
      const chainedWorkflows = [
        {
          workflowId: 'data-collection-workflow',
          name: 'Oracle Data Collection',
          steps: [
            {
              id: 'collect-chainlink-data',
              type: 'data_collection',
              parameters: {
                source: 'chainlink',
                assets: ['ETH/USD', 'BTC/USD'],
                timeWindow: 3600
              }
            },
            {
              id: 'collect-exchange-data',
              type: 'data_collection',
              parameters: {
                sources: ['coinbase', 'binance'],
                assets: ['ETH/USD', 'BTC/USD'],
                aggregation: 'weighted_average'
              }
            }
          ],
          outputs: {
            collectedData: 'data_aggregation.result',
            dataQuality: 'validation.qualityScore'
          }
        },
        {
          workflowId: 'data-validation-workflow',
          name: 'Oracle Data Validation',
          dependencies: ['data-collection-workflow'],
          inputs: {
            inputData: 'data-collection-workflow.collectedData',
            qualityThreshold: 'data-collection-workflow.dataQuality'
          },
          steps: [
            {
              id: 'validate-data-integrity',
              type: 'integrity_validation',
              parameters: {
                checksumValidation: true,
                signatureVerification: true
              }
            },
            {
              id: 'cross-validate-sources',
              type: 'cross_validation',
              parameters: {
                consensusThreshold: 0.8,
                outlierDetection: true
              }
            }
          ],
          outputs: {
            validationResults: 'cross_validation.results',
            consensusData: 'cross_validation.consensusValue'
          }
        },
        {
          workflowId: 'reporting-workflow',
          name: 'Comprehensive Reporting',
          dependencies: ['data-collection-workflow', 'data-validation-workflow'],
          inputs: {
            rawData: 'data-collection-workflow.collectedData',
            validationResults: 'data-validation-workflow.validationResults',
            consensusData: 'data-validation-workflow.consensusData'
          },
          steps: [
            {
              id: 'generate-analysis-report',
              type: 'report_generation',
              parameters: {
                reportType: 'analysis',
                includeVisualizations: true
              }
            },
            {
              id: 'distribute-reports',
              type: 'report_distribution',
              parameters: {
                channels: ['email', 'dashboard'],
                recipients: ['admin@yieldsensei.com']
              }
            }
          ]
        }
      ];

      const chainExecution = await workflowOrchestrator.executeWorkflowChain(chainedWorkflows);

      expect(chainExecution).toBeDefined();
      expect(chainExecution.success).toBe(true);
      expect(chainExecution.chainId).toBeDefined();

      // Verify execution order respected dependencies
      expect(chainExecution.executionOrder).toBeDefined();
      expect(chainExecution.executionOrder[0]).toBe('data-collection-workflow');
      expect(chainExecution.executionOrder[1]).toBe('data-validation-workflow');
      expect(chainExecution.executionOrder[2]).toBe('reporting-workflow');

      // Verify data flow between workflows
      expect(chainExecution.dataFlow).toBeDefined();
      
      const dataValidationInputs = chainExecution.dataFlow['data-validation-workflow'];
      expect(dataValidationInputs.inputData).toBeDefined();
      expect(dataValidationInputs.qualityThreshold).toBeDefined();

      const reportingInputs = chainExecution.dataFlow['reporting-workflow'];
      expect(reportingInputs.rawData).toBeDefined();
      expect(reportingInputs.validationResults).toBeDefined();
      expect(reportingInputs.consensusData).toBeDefined();

      // Verify all workflows completed successfully
      chainedWorkflows.forEach(workflow => {
        const workflowResult = chainExecution.workflowResults[workflow.workflowId];
        expect(workflowResult).toBeDefined();
        expect(workflowResult.success).toBe(true);
      });

      // Verify final outputs are available
      expect(chainExecution.finalOutputs).toBeDefined();
      expect(chainExecution.finalOutputs.reportGenerated).toBe(true);
      expect(chainExecution.finalOutputs.reportDistributed).toBe(true);
    });

    test('should handle workflow recovery and error resilience', async () => {
      const resilientWorkflowDefinition = {
        workflowId: 'resilient-oracle-workflow',
        name: 'Error-Resilient Oracle Validation',
        errorRecoveryConfig: {
          maxRetries: 3,
          retryDelayMs: 5000,
          exponentialBackoff: true,
          circuitBreakerEnabled: true,
          fallbackStrategies: true
        },
        steps: [
          {
            id: 'unreliable-data-fetch',
            type: 'data_collection',
            parameters: {
              source: 'unreliable-api',
              timeout: 2000,
              expectedFailureRate: 0.7 // 70% failure rate for testing
            },
            errorHandling: {
              retryStrategy: 'exponential_backoff',
              maxRetries: 3,
              fallbackAction: 'use_cached_data'
            }
          },
          {
            id: 'validation-with-fallback',
            type: 'validation',
            parameters: {
              primaryValidator: 'advanced_ml_validator',
              fallbackValidator: 'rule_based_validator'
            },
            errorHandling: {
              fallbackOnError: true,
              degradeGracefully: true
            }
          },
          {
            id: 'critical-consensus-check',
            type: 'consensus_validation',
            parameters: {
              minSources: 3,
              consensusThreshold: 0.8
            },
            errorHandling: {
              strategy: 'best_effort',
              minimumSuccessThreshold: 0.5
            }
          }
        ],
        checkpoints: [
          {
            afterStep: 'unreliable-data-fetch',
            condition: 'step.success || step.fallbackUsed',
            action: 'continue'
          },
          {
            afterStep: 'validation-with-fallback',
            condition: 'step.success',
            action: 'continue'
          }
        ]
      };

      const resilientExecution = await workflowOrchestrator.executeResilientWorkflow(
        resilientWorkflowDefinition
      );

      expect(resilientExecution).toBeDefined();
      expect(resilientExecution.workflowId).toBe(resilientWorkflowDefinition.workflowId);

      // Should complete despite individual step failures
      expect(resilientExecution.completed).toBe(true);

      // Verify error recovery was attempted
      expect(resilientExecution.errorRecoveryAttempts).toBeDefined();
      expect(resilientExecution.errorRecoveryAttempts.totalAttempts).toBeGreaterThan(0);

      // Verify fallback mechanisms were used
      const unreliableStepResult = resilientExecution.stepResults['unreliable-data-fetch'];
      if (unreliableStepResult.failed) {
        expect(unreliableStepResult.fallbackUsed).toBe(true);
        expect(unreliableStepResult.fallbackData).toBeDefined();
      }

      // Verify graceful degradation
      const validationResult = resilientExecution.stepResults['validation-with-fallback'];
      if (validationResult.primaryValidatorFailed) {
        expect(validationResult.fallbackValidatorUsed).toBe(true);
        expect(validationResult.degradedMode).toBe(true);
      }

      // Verify checkpoint evaluations
      expect(resilientExecution.checkpointEvaluations).toBeDefined();
      expect(resilientExecution.checkpointEvaluations.length).toBeGreaterThan(0);

      // Verify recovery strategies effectiveness
      expect(resilientExecution.recoveryStrategiesUsed).toBeDefined();
      if (resilientExecution.recoveryStrategiesUsed.length > 0) {
        resilientExecution.recoveryStrategiesUsed.forEach(strategy => {
          expect(strategy.strategy).toBeDefined();
          expect(strategy.effectiveness).toBeDefined();
          expect(strategy.outcome).toBeDefined();
        });
      }

      // Verify overall workflow resilience
      expect(resilientExecution.resilienceMetrics).toBeDefined();
      expect(resilientExecution.resilienceMetrics.adaptabilityScore).toBeGreaterThan(0);
      expect(resilientExecution.resilienceMetrics.recoverySuccessRate).toBeGreaterThan(0.5);
    });
  });

  describe('Metrics Collection and Analysis', () => {
    
    test('should collect comprehensive oracle metrics across multiple dimensions', async () => {
      const metricsCollectionConfig = {
        collectionId: 'comprehensive-metrics-001',
        metricsCategories: [
          'performance_metrics',
          'accuracy_metrics',
          'reliability_metrics',
          'availability_metrics',
          'security_metrics',
          'cost_metrics'
        ],
        oracleSources: [
          'chainlink-eth-usd',
          'coinbase-eth-usd',
          'binance-eth-usdt',
          'uniswap-v3-eth-usdc'
        ],
        timeWindows: [
          { name: '1min', duration: 60000 },
          { name: '5min', duration: 300000 },
          { name: '1hour', duration: 3600000 },
          { name: '1day', duration: 86400000 }
        ],
        aggregationMethods: [
          'average',
          'median',
          'percentile_95',
          'percentile_99',
          'min',
          'max'
        ],
        customMetrics: [
          {
            name: 'price_deviation_severity',
            formula: 'abs(oracle_price - consensus_price) / consensus_price',
            unit: 'percentage'
          },
          {
            name: 'consensus_stability_index',
            formula: 'standard_deviation(oracle_prices) / mean(oracle_prices)',
            unit: 'ratio'
          }
        ]
      };

      const metricsResult = await metricsCollector.collectComprehensiveMetrics(
        metricsCollectionConfig
      );

      expect(metricsResult).toBeDefined();
      expect(metricsResult.success).toBe(true);
      expect(metricsResult.collectionId).toBe(metricsCollectionConfig.collectionId);

      // Verify metrics categories were collected
      expect(metricsResult.collectedMetrics).toBeDefined();
      metricsCollectionConfig.metricsCategories.forEach(category => {
        expect(metricsResult.collectedMetrics[category]).toBeDefined();
      });

      // Verify performance metrics
      const performanceMetrics = metricsResult.collectedMetrics.performance_metrics;
      expect(performanceMetrics.responseTime).toBeDefined();
      expect(performanceMetrics.throughput).toBeDefined();
      expect(performanceMetrics.latency).toBeDefined();
      expect(performanceMetrics.errorRate).toBeDefined();

      // Verify accuracy metrics
      const accuracyMetrics = metricsResult.collectedMetrics.accuracy_metrics;
      expect(accuracyMetrics.accuracyScore).toBeDefined();
      expect(accuracyMetrics.deviationFromConsensus).toBeDefined();
      expect(accuracyMetrics.consensusAgreement).toBeDefined();

      // Verify reliability metrics
      const reliabilityMetrics = metricsResult.collectedMetrics.reliability_metrics;
      expect(reliabilityMetrics.uptimePercentage).toBeDefined();
      expect(reliabilityMetrics.mtbf).toBeDefined(); // Mean Time Between Failures
      expect(reliabilityMetrics.mttr).toBeDefined(); // Mean Time To Recovery

      // Verify security metrics
      const securityMetrics = metricsResult.collectedMetrics.security_metrics;
      expect(securityMetrics.signatureValidationRate).toBeDefined();
      expect(securityMetrics.dataIntegrityScore).toBeDefined();
      expect(securityMetrics.anomalyDetectionRate).toBeDefined();

      // Verify custom metrics were calculated
      expect(metricsResult.customMetrics).toBeDefined();
      expect(metricsResult.customMetrics.price_deviation_severity).toBeDefined();
      expect(metricsResult.customMetrics.consensus_stability_index).toBeDefined();

      // Verify time window aggregations
      expect(metricsResult.timeWindowAggregations).toBeDefined();
      metricsCollectionConfig.timeWindows.forEach(window => {
        expect(metricsResult.timeWindowAggregations[window.name]).toBeDefined();
      });

      // Verify aggregation methods were applied
      expect(metricsResult.aggregations).toBeDefined();
      metricsCollectionConfig.aggregationMethods.forEach(method => {
        expect(metricsResult.aggregations[method]).toBeDefined();
      });
    });

    test('should perform advanced metrics analysis and correlation detection', async () => {
      const analysisConfig = {
        analysisId: 'advanced-metrics-analysis-001',
        analysisTypes: [
          'correlation_analysis',
          'trend_analysis',
          'anomaly_detection',
          'performance_regression',
          'predictive_modeling'
        ],
        timeRange: {
          start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days
          end: new Date()
        },
        metricsToAnalyze: [
          'response_time',
          'accuracy_score',
          'error_rate',
          'consensus_agreement',
          'availability'
        ],
        correlationThreshold: 0.7,
        anomalyDetectionSensitivity: 'medium',
        trendAnalysisWindow: 7 // days
      };

      const analysisResult = await metricsCollector.performAdvancedAnalysis(analysisConfig);

      expect(analysisResult).toBeDefined();
      expect(analysisResult.success).toBe(true);
      expect(analysisResult.analysisId).toBe(analysisConfig.analysisId);

      // Verify correlation analysis
      expect(analysisResult.correlationAnalysis).toBeDefined();
      expect(analysisResult.correlationAnalysis.correlationMatrix).toBeDefined();
      expect(analysisResult.correlationAnalysis.significantCorrelations).toBeDefined();

      // Check for expected correlations
      const correlations = analysisResult.correlationAnalysis.significantCorrelations;
      const responseTimeErrorCorr = correlations.find(
        c => (c.metric1 === 'response_time' && c.metric2 === 'error_rate') ||
             (c.metric1 === 'error_rate' && c.metric2 === 'response_time')
      );
      
      if (responseTimeErrorCorr) {
        expect(Math.abs(responseTimeErrorCorr.correlation)).toBeGreaterThan(0.3);
      }

      // Verify trend analysis
      expect(analysisResult.trendAnalysis).toBeDefined();
      analysisConfig.metricsToAnalyze.forEach(metric => {
        expect(analysisResult.trendAnalysis[metric]).toBeDefined();
        expect(analysisResult.trendAnalysis[metric].trend).toBeDefined();
        expect(analysisResult.trendAnalysis[metric].trendStrength).toBeDefined();
        expect(analysisResult.trendAnalysis[metric].confidence).toBeDefined();
      });

      // Verify anomaly detection results
      expect(analysisResult.anomalyDetection).toBeDefined();
      expect(analysisResult.anomalyDetection.detectedAnomalies).toBeDefined();
      expect(analysisResult.anomalyDetection.anomalyScore).toBeDefined();
      expect(analysisResult.anomalyDetection.timeSeriesAnomalies).toBeDefined();

      // Verify performance regression analysis
      expect(analysisResult.performanceRegression).toBeDefined();
      expect(analysisResult.performanceRegression.regressionDetected).toBeDefined();
      expect(analysisResult.performanceRegression.affectedMetrics).toBeDefined();
      expect(analysisResult.performanceRegression.severity).toBeDefined();

      // Verify predictive modeling
      expect(analysisResult.predictiveModeling).toBeDefined();
      expect(analysisResult.predictiveModeling.predictions).toBeDefined();
      expect(analysisResult.predictiveModeling.confidenceIntervals).toBeDefined();
      expect(analysisResult.predictiveModeling.modelAccuracy).toBeDefined();

      // Verify insights and recommendations
      expect(analysisResult.insights).toBeDefined();
      expect(analysisResult.insights.keyFindings).toBeDefined();
      expect(analysisResult.insights.actionableRecommendations).toBeDefined();
      expect(analysisResult.insights.riskAssessment).toBeDefined();
    });

    test('should export metrics in multiple formats for external systems', async () => {
      const exportConfig = {
        exportId: 'metrics-export-001',
        exportFormats: [
          {
            format: 'prometheus',
            endpoint: 'http://prometheus:9090/api/v1/write',
            authentication: { type: 'bearer_token', token: 'prometheus-token' }
          },
          {
            format: 'influxdb',
            endpoint: 'http://influxdb:8086/write',
            database: 'oracle_metrics',
            authentication: { type: 'basic', username: 'admin', password: 'secret' }
          },
          {
            format: 'elasticsearch',
            endpoint: 'http://elasticsearch:9200/oracle-metrics/_doc',
            index: 'oracle-metrics-{YYYY.MM.DD}',
            authentication: { type: 'api_key', key: 'elasticsearch-key' }
          },
          {
            format: 'csv',
            filePath: '/exports/oracle-metrics.csv',
            includeHeaders: true
          },
          {
            format: 'json',
            filePath: '/exports/oracle-metrics.json',
            prettify: true
          }
        ],
        metricsFilter: {
          categories: ['performance_metrics', 'accuracy_metrics'],
          timeRange: {
            start: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
            end: new Date()
          },
          sources: ['chainlink-eth-usd', 'coinbase-eth-usd']
        },
        exportSchedule: {
          frequency: 'hourly',
          startTime: new Date(),
          enabled: true
        }
      };

      const exportResult = await metricsCollector.exportMetrics(exportConfig);

      expect(exportResult).toBeDefined();
      expect(exportResult.success).toBe(true);
      expect(exportResult.exportId).toBe(exportConfig.exportId);

      // Verify all formats were exported
      expect(exportResult.exportResults).toBeDefined();
      expect(exportResult.exportResults.length).toBe(exportConfig.exportFormats.length);

      // Verify Prometheus export
      const prometheusResult = exportResult.exportResults.find(r => r.format === 'prometheus');
      expect(prometheusResult).toBeDefined();
      expect(prometheusResult.success).toBe(true);
      expect(prometheusResult.metricsCount).toBeGreaterThan(0);
      expect(prometheusResult.exportedAt).toBeDefined();

      // Verify InfluxDB export
      const influxResult = exportResult.exportResults.find(r => r.format === 'influxdb');
      expect(influxResult).toBeDefined();
      expect(influxResult.success).toBe(true);
      expect(influxResult.dataPoints).toBeGreaterThan(0);

      // Verify Elasticsearch export
      const elasticResult = exportResult.exportResults.find(r => r.format === 'elasticsearch');
      expect(elasticResult).toBeDefined();
      expect(elasticResult.success).toBe(true);
      expect(elasticResult.documentsIndexed).toBeGreaterThan(0);

      // Verify CSV export
      const csvResult = exportResult.exportResults.find(r => r.format === 'csv');
      expect(csvResult).toBeDefined();
      expect(csvResult.success).toBe(true);
      expect(csvResult.filePath).toBe('/exports/oracle-metrics.csv');
      expect(csvResult.rowCount).toBeGreaterThan(0);

      // Verify JSON export
      const jsonResult = exportResult.exportResults.find(r => r.format === 'json');
      expect(jsonResult).toBeDefined();
      expect(jsonResult.success).toBe(true);
      expect(jsonResult.filePath).toBe('/exports/oracle-metrics.json');
      expect(jsonResult.objectCount).toBeGreaterThan(0);

      // Verify export scheduling was configured
      expect(exportResult.schedulingConfigured).toBe(true);
      expect(exportResult.nextScheduledExport).toBeDefined();
    });
  });

  describe('Alerting and Notification System', () => {
    
    test('should generate and distribute alerts based on validation results', async () => {
      const alertingConfig = {
        alertingRules: [
          {
            name: 'oracle_accuracy_degradation',
            condition: 'accuracy_score < 0.95',
            severity: 'warning',
            cooldownPeriod: 300000, // 5 minutes
            channels: ['email', 'slack']
          },
          {
            name: 'oracle_consensus_failure',
            condition: 'consensus_agreement < 0.8',
            severity: 'critical',
            cooldownPeriod: 60000, // 1 minute
            channels: ['email', 'slack', 'sms', 'webhook']
          },
          {
            name: 'oracle_source_unavailable',
            condition: 'availability < 0.9',
            severity: 'critical',
            cooldownPeriod: 120000, // 2 minutes
            channels: ['email', 'webhook']
          },
          {
            name: 'anomaly_detection_spike',
            condition: 'anomaly_score > 0.8',
            severity: 'warning',
            cooldownPeriod: 900000, // 15 minutes
            channels: ['slack']
          }
        ],
        notificationChannels: {
          email: {
            enabled: true,
            recipients: ['admin@yieldsensei.com', 'alerts@yieldsensei.com'],
            template: 'oracle_alert_template'
          },
          slack: {
            enabled: true,
            webhook: 'https://hooks.slack.com/services/XXX/YYY/ZZZ',
            channel: '#oracle-alerts'
          },
          sms: {
            enabled: true,
            recipients: ['+1234567890'],
            provider: 'twilio'
          },
          webhook: {
            enabled: true,
            url: 'https://api.yieldsensei.com/webhooks/oracle-alerts',
            authentication: { type: 'bearer_token', token: 'webhook-token' }
          }
        },
        alertAggregation: {
          enabled: true,
          timeWindow: 300000, // 5 minutes
          maxAlertsPerWindow: 10,
          groupByFields: ['severity', 'source']
        }
      };

      // Simulate validation results that trigger alerts
      const simulatedValidationResults = [
        {
          sourceId: 'chainlink-eth-usd',
          accuracy_score: 0.92, // Below 0.95 threshold
          consensus_agreement: 0.85,
          availability: 0.98,
          anomaly_score: 0.3
        },
        {
          sourceId: 'coinbase-eth-usd',
          accuracy_score: 0.97,
          consensus_agreement: 0.75, // Below 0.8 threshold
          availability: 0.99,
          anomaly_score: 0.2
        },
        {
          sourceId: 'binance-eth-usdt',
          accuracy_score: 0.96,
          consensus_agreement: 0.82,
          availability: 0.87, // Below 0.9 threshold
          anomaly_score: 0.85 // Above 0.8 threshold
        }
      ];

      const alertingResult = await alertingSystem.processValidationResults(
        simulatedValidationResults,
        alertingConfig
      );

      expect(alertingResult).toBeDefined();
      expect(alertingResult.success).toBe(true);

      // Verify alerts were generated
      expect(alertingResult.generatedAlerts).toBeDefined();
      expect(alertingResult.generatedAlerts.length).toBeGreaterThan(0);

      // Verify specific alerts
      const accuracyAlert = alertingResult.generatedAlerts.find(
        alert => alert.rule === 'oracle_accuracy_degradation'
      );
      expect(accuracyAlert).toBeDefined();
      expect(accuracyAlert.severity).toBe('warning');
      expect(accuracyAlert.sourceId).toBe('chainlink-eth-usd');

      const consensusAlert = alertingResult.generatedAlerts.find(
        alert => alert.rule === 'oracle_consensus_failure'
      );
      expect(consensusAlert).toBeDefined();
      expect(consensusAlert.severity).toBe('critical');

      const availabilityAlert = alertingResult.generatedAlerts.find(
        alert => alert.rule === 'oracle_source_unavailable'
      );
      expect(availabilityAlert).toBeDefined();
      expect(availabilityAlert.severity).toBe('critical');

      const anomalyAlert = alertingResult.generatedAlerts.find(
        alert => alert.rule === 'anomaly_detection_spike'
      );
      expect(anomalyAlert).toBeDefined();
      expect(anomalyAlert.severity).toBe('warning');

      // Verify notifications were sent
      expect(alertingResult.notificationResults).toBeDefined();
      expect(alertingResult.notificationResults.length).toBeGreaterThan(0);

      // Verify email notifications
      const emailNotifications = alertingResult.notificationResults.filter(
        n => n.channel === 'email'
      );
      expect(emailNotifications.length).toBeGreaterThan(0);
      emailNotifications.forEach(notification => {
        expect(notification.success).toBe(true);
        expect(notification.recipients).toBeDefined();
      });

      // Verify Slack notifications
      const slackNotifications = alertingResult.notificationResults.filter(
        n => n.channel === 'slack'
      );
      expect(slackNotifications.length).toBeGreaterThan(0);

      // Verify webhook notifications
      const webhookNotifications = alertingResult.notificationResults.filter(
        n => n.channel === 'webhook'
      );
      expect(webhookNotifications.length).toBeGreaterThan(0);

      // Verify alert aggregation
      if (alertingConfig.alertAggregation.enabled) {
        expect(alertingResult.aggregationApplied).toBe(true);
        expect(alertingResult.aggregatedAlerts).toBeDefined();
      }
    });

    test('should implement smart throttling and escalation rules', async () => {
      const escalationConfig = {
        escalationRules: [
          {
            name: 'critical_alert_escalation',
            trigger: {
              severity: 'critical',
              duration: 300000, // 5 minutes unresolved
              occurrences: 3
            },
            escalationLevels: [
              {
                level: 1,
                delay: 300000, // 5 minutes
                channels: ['email'],
                recipients: ['admin@yieldsensei.com']
              },
              {
                level: 2,
                delay: 600000, // 10 minutes
                channels: ['email', 'sms'],
                recipients: ['admin@yieldsensei.com', 'manager@yieldsensei.com']
              },
              {
                level: 3,
                delay: 1200000, // 20 minutes
                channels: ['email', 'sms', 'phone'],
                recipients: ['admin@yieldsensei.com', 'manager@yieldsensei.com', 'cto@yieldsensei.com']
              }
            ]
          }
        ],
        throttlingRules: [
          {
            name: 'similar_alert_throttling',
            condition: 'same_rule_and_source',
            throttlePeriod: 1800000, // 30 minutes
            maxAlertsPerPeriod: 5
          },
          {
            name: 'severity_based_throttling',
            condition: 'severity == warning',
            throttlePeriod: 3600000, // 1 hour
            maxAlertsPerPeriod: 10
          }
        ]
      };

      // Simulate repeated critical alerts
      const repeatedAlerts = Array(5).fill(null).map((_, i) => ({
        id: `critical-alert-${i}`,
        rule: 'oracle_consensus_failure',
        sourceId: 'chainlink-eth-usd',
        severity: 'critical',
        timestamp: new Date(Date.now() + i * 60000), // 1 minute apart
        resolved: false
      }));

      const escalationResult = await alertingSystem.processEscalationAndThrottling(
        repeatedAlerts,
        escalationConfig
      );

      expect(escalationResult).toBeDefined();
      expect(escalationResult.success).toBe(true);

      // Verify throttling was applied
      expect(escalationResult.throttlingApplied).toBe(true);
      expect(escalationResult.throttledAlerts).toBeDefined();
      expect(escalationResult.throttledAlerts.length).toBeGreaterThan(0);

      // Verify escalation was triggered
      expect(escalationResult.escalationsTriggered).toBeDefined();
      expect(escalationResult.escalationsTriggered.length).toBeGreaterThan(0);

      const criticalEscalation = escalationResult.escalationsTriggered.find(
        e => e.rule === 'critical_alert_escalation'
      );
      expect(criticalEscalation).toBeDefined();
      expect(criticalEscalation.currentLevel).toBeGreaterThan(0);
      expect(criticalEscalation.nextEscalationTime).toBeDefined();

      // Verify escalation levels were processed
      expect(escalationResult.escalationLevelsProcessed).toBeDefined();
      escalationResult.escalationLevelsProcessed.forEach(level => {
        expect(level.level).toBeDefined();
        expect(level.notificationsSent).toBeDefined();
        expect(level.success).toBe(true);
      });

      // Verify smart throttling logic
      expect(escalationResult.throttlingStats).toBeDefined();
      expect(escalationResult.throttlingStats.totalAlertsProcessed).toBe(repeatedAlerts.length);
      expect(escalationResult.throttlingStats.alertsThrottled).toBeGreaterThan(0);
      expect(escalationResult.throttlingStats.alertsSent).toBeLessThan(repeatedAlerts.length);
    });

    test('should support alert acknowledgment and resolution workflows', async () => {
      const alertWorkflowConfig = {
        acknowledgeWorkflow: {
          requireAuthentication: true,
          allowedUsers: ['admin@yieldsensei.com', 'ops@yieldsensei.com'],
          acknowledgmentTimeout: 3600000, // 1 hour
          autoAcknowledgeRules: [
            {
              condition: 'source_recovered',
              delay: 600000 // 10 minutes after recovery
            }
          ]
        },
        resolutionWorkflow: {
          requireRootCauseAnalysis: true,
          mandatoryFields: ['resolution_summary', 'root_cause', 'prevention_measures'],
          approvalRequired: {
            forSeverity: ['critical', 'emergency'],
            approvers: ['manager@yieldsensei.com']
          },
          followupTasks: true
        },
        alertLifecycle: {
          states: ['new', 'acknowledged', 'investigating', 'resolved', 'closed'],
          allowedTransitions: {
            'new': ['acknowledged', 'resolved'],
            'acknowledged': ['investigating', 'resolved'],
            'investigating': ['resolved'],
            'resolved': ['closed']
          },
          stateTimeout: {
            'new': 1800000, // 30 minutes
            'acknowledged': 3600000, // 1 hour
            'investigating': 7200000 // 2 hours
          }
        }
      };

      // Create test alerts
      const testAlerts = [
        {
          id: 'alert-workflow-001',
          rule: 'oracle_consensus_failure',
          severity: 'critical',
          sourceId: 'chainlink-eth-usd',
          state: 'new',
          createdAt: new Date(),
          description: 'Consensus failure detected in Chainlink ETH/USD feed'
        },
        {
          id: 'alert-workflow-002',
          rule: 'oracle_accuracy_degradation',
          severity: 'warning',
          sourceId: 'coinbase-eth-usd',
          state: 'new',
          createdAt: new Date(),
          description: 'Accuracy degradation in Coinbase ETH/USD feed'
        }
      ];

      // Test alert acknowledgment
      const acknowledgeResult = await alertingSystem.acknowledgeAlert(
        'alert-workflow-001',
        {
          acknowledgedBy: 'admin@yieldsensei.com',
          acknowledgmentNote: 'Investigating consensus issue',
          estimatedResolutionTime: new Date(Date.now() + 3600000)
        },
        alertWorkflowConfig
      );

      expect(acknowledgeResult).toBeDefined();
      expect(acknowledgeResult.success).toBe(true);
      expect(acknowledgeResult.alertId).toBe('alert-workflow-001');
      expect(acknowledgeResult.newState).toBe('acknowledged');
      expect(acknowledgeResult.acknowledgedBy).toBe('admin@yieldsensei.com');

      // Test state transition to investigating
      const investigateResult = await alertingSystem.updateAlertState(
        'alert-workflow-001',
        'investigating',
        {
          updatedBy: 'admin@yieldsensei.com',
          updateNote: 'Root cause analysis in progress',
          investigationAssignee: 'ops@yieldsensei.com'
        },
        alertWorkflowConfig
      );

      expect(investigateResult).toBeDefined();
      expect(investigateResult.success).toBe(true);
      expect(investigateResult.newState).toBe('investigating');

      // Test alert resolution
      const resolutionData = {
        resolvedBy: 'ops@yieldsensei.com',
        resolutionSummary: 'Chainlink node was temporarily unavailable. Issue resolved after node restart.',
        rootCause: 'Infrastructure failure - network connectivity issue',
        preventionMeasures: [
          'Implement redundant network connections',
          'Add monitoring for node connectivity',
          'Create automated failover procedures'
        ],
        resolutionTime: new Date(),
        verificationSteps: [
          'Confirmed node is back online',
          'Verified price feed accuracy',
          'Checked consensus with other oracles'
        ]
      };

      const resolutionResult = await alertingSystem.resolveAlert(
        'alert-workflow-001',
        resolutionData,
        alertWorkflowConfig
      );

      expect(resolutionResult).toBeDefined();
      expect(resolutionResult.success).toBe(true);
      expect(resolutionResult.alertId).toBe('alert-workflow-001');
      expect(resolutionResult.newState).toBe('resolved');
      expect(resolutionResult.requiresApproval).toBe(true); // Critical severity

      // Test approval workflow for critical alert
      const approvalResult = await alertingSystem.approveAlertResolution(
        'alert-workflow-001',
        {
          approvedBy: 'manager@yieldsensei.com',
          approvalNote: 'Resolution approved. Prevention measures are adequate.',
          approvalTime: new Date()
        },
        alertWorkflowConfig
      );

      expect(approvalResult).toBeDefined();
      expect(approvalResult.success).toBe(true);
      expect(approvalResult.approved).toBe(true);

      // Test alert closure
      const closureResult = await alertingSystem.closeAlert(
        'alert-workflow-001',
        {
          closedBy: 'admin@yieldsensei.com',
          closureNote: 'Alert resolved and approved. Prevention measures implemented.',
          followupTasksCreated: true
        },
        alertWorkflowConfig
      );

      expect(closureResult).toBeDefined();
      expect(closureResult.success).toBe(true);
      expect(closureResult.newState).toBe('closed');
      expect(closureResult.followupTasks).toBeDefined();

      // Verify complete workflow tracking
      const workflowHistory = await alertingSystem.getAlertWorkflowHistory('alert-workflow-001');
      expect(workflowHistory).toBeDefined();
      expect(workflowHistory.states).toContain('new');
      expect(workflowHistory.states).toContain('acknowledged');
      expect(workflowHistory.states).toContain('investigating');
      expect(workflowHistory.states).toContain('resolved');
      expect(workflowHistory.states).toContain('closed');
      expect(workflowHistory.totalResolutionTime).toBeDefined();
    });
  });

  describe('System Integration and Performance', () => {
    
    test('should demonstrate complete end-to-end system performance', async () => {
      const performanceTestConfig = {
        testId: 'end-to-end-performance-001',
        duration: 60000, // 1 minute
        concurrentWorkflows: 5,
        oracleDataSources: 10,
        validationFrequency: 10000, // 10 seconds
        reportingFrequency: 30000, // 30 seconds
        alertingEnabled: true,
        metricsCollection: true,
        performanceTargets: {
          maxValidationTime: 5000, // 5 seconds
          maxReportGenerationTime: 10000, // 10 seconds
          minThroughput: 100, // validations per minute
          maxMemoryUsage: 512 * 1024 * 1024, // 512MB
          maxCpuUsage: 0.8 // 80%
        }
      };

      const startTime = Date.now();
      
      const performanceResult = await workflowOrchestrator.executePerformanceTest(
        performanceTestConfig
      );

      const endTime = Date.now();
      const actualDuration = endTime - startTime;

      expect(performanceResult).toBeDefined();
      expect(performanceResult.success).toBe(true);
      expect(actualDuration).toBeLessThan(performanceTestConfig.duration + 10000); // Allow 10s buffer

      // Verify performance targets were met
      expect(performanceResult.performanceMetrics).toBeDefined();
      
      const metrics = performanceResult.performanceMetrics;
      expect(metrics.averageValidationTime).toBeLessThan(performanceTestConfig.performanceTargets.maxValidationTime);
      expect(metrics.averageReportGenerationTime).toBeLessThan(performanceTestConfig.performanceTargets.maxReportGenerationTime);
      expect(metrics.throughput).toBeGreaterThan(performanceTestConfig.performanceTargets.minThroughput);
      expect(metrics.peakMemoryUsage).toBeLessThan(performanceTestConfig.performanceTargets.maxMemoryUsage);
      expect(metrics.averageCpuUsage).toBeLessThan(performanceTestConfig.performanceTargets.maxCpuUsage);

      // Verify concurrent workflows were handled
      expect(performanceResult.workflowResults).toBeDefined();
      expect(performanceResult.workflowResults.length).toBe(performanceTestConfig.concurrentWorkflows);
      
      performanceResult.workflowResults.forEach(workflow => {
        expect(workflow.success).toBe(true);
        expect(workflow.executionTime).toBeLessThan(performanceTestConfig.performanceTargets.maxValidationTime);
      });

      // Verify system stability
      expect(performanceResult.systemStability).toBeDefined();
      expect(performanceResult.systemStability.errorRate).toBeLessThan(0.05); // Less than 5% errors
      expect(performanceResult.systemStability.memoryLeaks).toBe(false);
      expect(performanceResult.systemStability.resourceExhaustion).toBe(false);

      // Verify scalability metrics
      expect(performanceResult.scalabilityMetrics).toBeDefined();
      expect(performanceResult.scalabilityMetrics.throughputScaling).toBeGreaterThan(0.8);
      expect(performanceResult.scalabilityMetrics.resourceEfficiency).toBeGreaterThan(0.7);
    });

    test('should validate complete system integration', async () => {
      const integrationTestConfig = {
        testId: 'complete-system-integration-001',
        components: [
          'validation_pipeline',
          'report_generator',
          'workflow_orchestrator',
          'metrics_collector',
          'results_aggregator',
          'alerting_system'
        ],
        integrationScenarios: [
          {
            name: 'normal_operation',
            description: 'Test all components working together under normal conditions'
          },
          {
            name: 'high_load',
            description: 'Test system behavior under high load conditions'
          },
          {
            name: 'partial_failure',
            description: 'Test system resilience when some components fail'
          },
          {
            name: 'recovery',
            description: 'Test system recovery after failures'
          }
        ],
        dataFlow: {
          validateDataConsistency: true,
          validateMessagePassing: true,
          validateStateConsistency: true
        }
      };

      const integrationResult = await workflowOrchestrator.executeSystemIntegrationTest(
        integrationTestConfig
      );

      expect(integrationResult).toBeDefined();
      expect(integrationResult.success).toBe(true);
      expect(integrationResult.testId).toBe(integrationTestConfig.testId);

      // Verify all components were tested
      expect(integrationResult.componentResults).toBeDefined();
      integrationTestConfig.components.forEach(component => {
        expect(integrationResult.componentResults[component]).toBeDefined();
        expect(integrationResult.componentResults[component].operational).toBe(true);
      });

      // Verify integration scenarios
      expect(integrationResult.scenarioResults).toBeDefined();
      integrationTestConfig.integrationScenarios.forEach(scenario => {
        const scenarioResult = integrationResult.scenarioResults[scenario.name];
        expect(scenarioResult).toBeDefined();
        expect(scenarioResult.success).toBe(true);
      });

      // Verify data flow integrity
      expect(integrationResult.dataFlowValidation).toBeDefined();
      expect(integrationResult.dataFlowValidation.dataConsistency).toBe(true);
      expect(integrationResult.dataFlowValidation.messagePassing).toBe(true);
      expect(integrationResult.dataFlowValidation.stateConsistency).toBe(true);

      // Verify component interactions
      expect(integrationResult.componentInteractions).toBeDefined();
      expect(integrationResult.componentInteractions.validationToReporting).toBe(true);
      expect(integrationResult.componentInteractions.metricsToAlerting).toBe(true);
      expect(integrationResult.componentInteractions.orchestrationToAll).toBe(true);

      // Verify end-to-end data processing
      expect(integrationResult.endToEndProcessing).toBeDefined();
      expect(integrationResult.endToEndProcessing.dataIngestion).toBe(true);
      expect(integrationResult.endToEndProcessing.validation).toBe(true);
      expect(integrationResult.endToEndProcessing.analysis).toBe(true);
      expect(integrationResult.endToEndProcessing.reporting).toBe(true);
      expect(integrationResult.endToEndProcessing.alerting).toBe(true);

      // Verify system health after integration test
      const finalSystemHealth = await workflowOrchestrator.getSystemHealth();
      expect(finalSystemHealth.healthy).toBe(true);
      expect(finalSystemHealth.componentsOperational).toBe(integrationTestConfig.components.length);
      expect(finalSystemHealth.systemLoad).toBeLessThan(0.9);
      expect(finalSystemHealth.memoryUtilization).toBeLessThan(0.8);
    });
  });
});

/**
 * End-to-End Validation and Reporting System Summary
 * 
 * This test suite validates:
 * ✅ Comprehensive oracle validation pipeline execution
 * ✅ Failure handling with detailed error reporting  
 * ✅ Multi-asset oracle scenario validation
 * ✅ Detailed validation reports in multiple formats
 * ✅ Real-time dashboard report generation
 * ✅ Comparative analysis reporting capabilities
 * ✅ Complex workflow orchestration with conditional branching
 * ✅ Workflow chaining and dependency management
 * ✅ Workflow recovery and error resilience
 * ✅ Comprehensive metrics collection and analysis
 * ✅ Advanced metrics analysis and correlation detection
 * ✅ Multi-format metrics export for external systems
 * ✅ Alert generation and distribution system
 * ✅ Smart throttling and escalation rules
 * ✅ Alert acknowledgment and resolution workflows
 * ✅ End-to-end system performance validation
 * ✅ Complete system integration testing
 * 
 * Task 26.5 completion status: ✅ READY FOR VALIDATION
 */