/**
 * Data Flow Orchestration Integration Test Suite
 * Tests data pipelines, event streams, and coordinated workflows
 */

import { describe, test, expect, beforeEach, afterEach, jest, beforeAll, afterAll } from '@jest/globals';
import { EventEmitter } from 'events';

// Core orchestration services
import { DataFlowOrchestrator } from '../../core/data-flow-orchestrator';
import { EventStreamManager } from '../../core/event-stream-manager';
import { WorkflowEngine } from '../../core/workflow-engine';
import { DataPipelineManager } from '../../core/data-pipeline-manager';

// Import all satellites for integration
import { OracleSatelliteAgent } from '../../satellites/oracle/oracle-satellite';
import { EchoSatelliteAgent } from '../../satellites/echo/echo-satellite';
import { PulseSatelliteAgent } from '../../satellites/pulse/pulse-satellite';
import { SageSatelliteAgent } from '../../satellites/sage/sage-satellite';
import { AegisSatelliteAgent } from '../../satellites/aegis/aegis-satellite';
import { ForgeSatelliteAgent } from '../../satellites/forge/forge-satellite';
import { BridgeSatelliteAgent } from '../../satellites/bridge/bridge-satellite';

// Types
import {
  DataFlowConfig,
  WorkflowDefinition,
  PipelineStage,
  EventStream,
  DataTransformation,
  FlowMetrics,
  WorkflowExecution,
  StreamProcessor
} from '../../core/types';

// Test data factories
const createMockDataFlowConfig = (): DataFlowConfig => ({
  pipelines: {
    marketDataFlow: {
      name: 'Market Data Flow',
      stages: [
        { name: 'oracle_ingestion', satellite: 'oracle', type: 'source' },
        { name: 'sentiment_analysis', satellite: 'echo', type: 'processor' },
        { name: 'risk_assessment', satellite: 'sage', type: 'processor' },
        { name: 'optimization', satellite: 'pulse', type: 'sink' }
      ],
      triggers: ['price_update', 'market_alert'],
      parallelProcessing: true,
      errorHandling: 'retry_with_fallback',
      maxRetries: 3
    },
    complianceFlow: {
      name: 'Compliance Monitoring Flow',
      stages: [
        { name: 'data_collection', satellite: 'oracle', type: 'source' },
        { name: 'compliance_check', satellite: 'sage', type: 'processor' },
        { name: 'security_scan', satellite: 'aegis', type: 'processor' },
        { name: 'alert_generation', satellite: 'aegis', type: 'sink' }
      ],
      triggers: ['transaction_event', 'regulatory_update'],
      parallelProcessing: false,
      errorHandling: 'fail_fast',
      maxRetries: 1
    },
    crossChainFlow: {
      name: 'Cross-Chain Operations Flow',
      stages: [
        { name: 'opportunity_detection', satellite: 'bridge', type: 'source' },
        { name: 'risk_validation', satellite: 'sage', type: 'processor' },
        { name: 'route_optimization', satellite: 'forge', type: 'processor' },
        { name: 'execution', satellite: 'bridge', type: 'sink' }
      ],
      triggers: ['cross_chain_opportunity', 'arbitrage_detected'],
      parallelProcessing: true,
      errorHandling: 'compensate',
      maxRetries: 2
    }
  },
  eventStreams: {
    marketEvents: {
      name: 'Market Events Stream',
      sources: ['oracle', 'echo'],
      processors: ['pulse', 'sage'],
      consumers: ['aegis', 'forge'],
      bufferSize: 1000,
      batchSize: 50,
      flushInterval: 5000
    },
    securityEvents: {
      name: 'Security Events Stream',
      sources: ['aegis'],
      processors: ['sage'],
      consumers: ['oracle', 'pulse', 'forge', 'bridge'],
      bufferSize: 500,
      batchSize: 25,
      flushInterval: 1000
    }
  },
  transformations: {
    priceNormalization: {
      name: 'Price Data Normalization',
      inputSchema: 'raw_price_data',
      outputSchema: 'normalized_price_data',
      rules: [
        { field: 'price', type: 'decimal_precision', precision: 8 },
        { field: 'timestamp', type: 'iso_datetime' },
        { field: 'volume', type: 'scientific_notation' }
      ]
    },
    sentimentAggregation: {
      name: 'Sentiment Data Aggregation',
      inputSchema: 'individual_sentiment',
      outputSchema: 'aggregated_sentiment',
      rules: [
        { field: 'sentiment_scores', type: 'weighted_average', weights: 'influence' },
        { field: 'confidence', type: 'harmonic_mean' },
        { field: 'timeframe', type: 'time_bucketing', interval: '5m' }
      ]
    }
  },
  monitoring: {
    enableMetrics: true,
    enableTracing: true,
    enableLogging: true,
    metricsInterval: 30000,
    alertThresholds: {
      latency: 5000,
      errorRate: 0.05,
      throughput: 100,
      backpressure: 0.8
    }
  }
});

const createMockWorkflowDefinition = (): WorkflowDefinition => ({
  id: 'yield_optimization_workflow',
  name: 'Yield Optimization Workflow',
  version: '1.0.0',
  steps: [
    {
      id: 'collect_market_data',
      name: 'Collect Market Data',
      satellite: 'oracle',
      action: 'getMarketData',
      inputs: { assets: ['BTC', 'ETH', 'USDC'] },
      outputs: ['marketData'],
      timeout: 30000,
      retries: 3
    },
    {
      id: 'analyze_sentiment',
      name: 'Analyze Market Sentiment',
      satellite: 'echo',
      action: 'analyzeSentiment',
      inputs: { assets: '${collect_market_data.outputs.marketData.assets}' },
      outputs: ['sentimentData'],
      dependsOn: ['collect_market_data'],
      timeout: 45000,
      retries: 2
    },
    {
      id: 'assess_compliance',
      name: 'Assess Regulatory Compliance',
      satellite: 'sage',
      action: 'assessCompliance',
      inputs: { 
        assets: '${collect_market_data.outputs.marketData.assets}',
        jurisdiction: 'US'
      },
      outputs: ['complianceStatus'],
      dependsOn: ['collect_market_data'],
      timeout: 60000,
      retries: 1,
      parallel: true
    },
    {
      id: 'optimize_portfolio',
      name: 'Optimize Portfolio Allocation',
      satellite: 'pulse',
      action: 'optimizePortfolio',
      inputs: {
        marketData: '${collect_market_data.outputs.marketData}',
        sentimentData: '${analyze_sentiment.outputs.sentimentData}',
        complianceStatus: '${assess_compliance.outputs.complianceStatus}'
      },
      outputs: ['optimizationResult'],
      dependsOn: ['analyze_sentiment', 'assess_compliance'],
      timeout: 120000,
      retries: 2
    },
    {
      id: 'execute_rebalance',
      name: 'Execute Portfolio Rebalance',
      satellite: 'forge',
      action: 'executeRebalance',
      inputs: {
        optimization: '${optimize_portfolio.outputs.optimizationResult}'
      },
      outputs: ['executionResult'],
      dependsOn: ['optimize_portfolio'],
      timeout: 300000,
      retries: 3,
      compensation: 'rollback_trades'
    }
  ],
  errorHandling: {
    strategy: 'compensate',
    rollbackOrder: ['execute_rebalance', 'optimize_portfolio'],
    notification: {
      channels: ['email', 'webhook'],
      severity: 'high'
    }
  },
  scheduling: {
    type: 'cron',
    expression: '0 */4 * * *', // Every 4 hours
    timezone: 'UTC'
  }
});

describe('Data Flow Orchestration Integration Tests', () => {
  let dataFlowOrchestrator: DataFlowOrchestrator;
  let eventStreamManager: EventStreamManager;
  let workflowEngine: WorkflowEngine;
  let pipelineManager: DataPipelineManager;
  let satellites: Record<string, any>;
  let config: DataFlowConfig;

  beforeAll(async () => {
    config = createMockDataFlowConfig();
    
    // Initialize orchestration services
    dataFlowOrchestrator = DataFlowOrchestrator.getInstance(config);
    eventStreamManager = EventStreamManager.getInstance();
    workflowEngine = WorkflowEngine.getInstance();
    pipelineManager = DataPipelineManager.getInstance();

    // Initialize satellites
    satellites = {
      oracle: OracleSatelliteAgent.getInstance({
        dataFeeds: { enableRealTime: true, sources: ['binance', 'coinbase'] }
      }),
      echo: EchoSatelliteAgent.getInstance({
        sentimentAnalysis: { enableRealTimeAnalysis: true, models: ['crypto-bert'] }
      }),
      pulse: PulseSatelliteAgent.getInstance({
        optimization: { enableRealTimeOptimization: true, algorithm: 'modern_portfolio_theory' }
      }),
      sage: SageSatelliteAgent.getInstance({
        compliance: { frameworks: ['SEC', 'FINRA'], enableAutomation: true }
      }),
      aegis: AegisSatelliteAgent.getInstance({
        security: { enableRealTimeMonitoring: true, threatIntelligence: true }
      }),
      forge: ForgeSatelliteAgent.getInstance({
        execution: { enableAutomatedTrading: true, riskLimits: true }
      }),
      bridge: BridgeSatelliteAgent.getInstance({
        bridge: { enableCrossChain: true, supportedChains: ['ethereum', 'polygon'] }
      })
    };

    // Initialize all satellites
    await Promise.all(Object.values(satellites).map(satellite => satellite.initialize()));
    
    // Initialize orchestration services
    await dataFlowOrchestrator.initialize(satellites);
    await eventStreamManager.initialize();
    await workflowEngine.initialize();
    await pipelineManager.initialize();
  });

  afterAll(async () => {
    await dataFlowOrchestrator.shutdown();
    await eventStreamManager.shutdown();
    await workflowEngine.shutdown();
    await pipelineManager.shutdown();
    await Promise.all(Object.values(satellites).map(satellite => satellite.shutdown?.()));
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Data Pipeline Orchestration', () => {
    test('should execute market data flow pipeline', async () => {
      const pipelineExecutionListener = jest.fn();
      dataFlowOrchestrator.on('pipeline_executed', pipelineExecutionListener);

      // Trigger market data flow
      const triggerData = {
        type: 'price_update',
        payload: {
          symbol: 'BTC',
          price: 45000,
          change: 0.025,
          timestamp: new Date()
        }
      };

      const execution = await dataFlowOrchestrator.executePipeline('marketDataFlow', triggerData);

      expect(execution).toMatchObject({
        pipelineId: 'marketDataFlow',
        executionId: expect.any(String),
        status: 'completed',
        stages: expect.arrayContaining([
          expect.objectContaining({
            name: 'oracle_ingestion',
            status: 'completed',
            duration: expect.any(Number)
          }),
          expect.objectContaining({
            name: 'sentiment_analysis',
            status: 'completed',
            duration: expect.any(Number)
          }),
          expect.objectContaining({
            name: 'risk_assessment',
            status: 'completed',
            duration: expect.any(Number)
          }),
          expect.objectContaining({
            name: 'optimization',
            status: 'completed',
            duration: expect.any(Number)
          })
        ]),
        totalDuration: expect.any(Number),
        throughput: expect.any(Number)
      });

      expect(pipelineExecutionListener).toHaveBeenCalled();
    });

    test('should handle pipeline stage failures with retry logic', async () => {
      // Simulate a stage failure
      jest.spyOn(satellites.echo, 'analyzeSentiment').mockRejectedValueOnce(new Error('Temporary failure'));

      const triggerData = {
        type: 'price_update',
        payload: { symbol: 'ETH', price: 3200 }
      };

      const execution = await dataFlowOrchestrator.executePipeline('marketDataFlow', triggerData);

      expect(execution.stages.find(s => s.name === 'sentiment_analysis')).toMatchObject({
        status: 'completed',
        retries: 1,
        errors: expect.arrayContaining([
          expect.objectContaining({
            message: 'Temporary failure',
            retry: 1
          })
        ])
      });
    });

    test('should execute parallel stages concurrently', async () => {
      const startTime = Date.now();

      const triggerData = {
        type: 'price_update',
        payload: { symbol: 'BTC', price: 46000 }
      };

      const execution = await dataFlowOrchestrator.executePipeline('marketDataFlow', triggerData);
      const duration = Date.now() - startTime;

      // With parallel processing, should be faster than sequential
      expect(duration).toBeLessThan(10000); // Should complete within 10 seconds
      expect(execution.parallelStages).toBeGreaterThan(0);
    });

    test('should handle pipeline backpressure', async () => {
      // Generate high volume of pipeline triggers
      const triggerCount = 20;
      const triggers = Array(triggerCount).fill(null).map((_, i) => ({
        type: 'price_update',
        payload: { symbol: `TOKEN${i}`, price: 100 + i }
      }));

      const executionPromises = triggers.map(trigger =>
        dataFlowOrchestrator.executePipeline('marketDataFlow', trigger)
      );

      const executions = await Promise.allSettled(executionPromises);

      // Should handle backpressure gracefully
      const successful = executions.filter(e => e.status === 'fulfilled').length;
      const throttled = executions.filter(e => 
        e.status === 'rejected' && e.reason.message.includes('throttled')
      ).length;

      expect(successful + throttled).toBe(triggerCount);
      expect(successful).toBeGreaterThan(triggerCount * 0.7); // At least 70% should succeed
    });
  });

  describe('Event Stream Processing', () => {
    test('should process market events stream', async () => {
      await eventStreamManager.startStream('marketEvents');

      const streamProcessor = jest.fn();
      eventStreamManager.onStreamData('marketEvents', streamProcessor);

      // Generate market events
      const events = Array(10).fill(null).map((_, i) => ({
        type: 'price_change',
        symbol: 'BTC',
        price: 45000 + i * 100,
        timestamp: new Date(Date.now() + i * 1000)
      }));

      // Send events to stream
      for (const event of events) {
        await eventStreamManager.publishToStream('marketEvents', event);
      }

      // Allow time for processing
      await new Promise(resolve => setTimeout(resolve, 2000));

      expect(streamProcessor).toHaveBeenCalledTimes(1); // Should be batched
      
      const processedBatch = streamProcessor.mock.calls[0][0];
      expect(processedBatch).toHaveLength(10);
      expect(processedBatch[0]).toMatchObject({
        type: 'price_change',
        symbol: 'BTC'
      });
    });

    test('should handle stream buffering and batching', async () => {
      const batchListener = jest.fn();
      eventStreamManager.on('batch_processed', batchListener);

      await eventStreamManager.startStream('securityEvents');

      // Generate more events than batch size
      const eventCount = 60; // Batch size is 25
      const events = Array(eventCount).fill(null).map((_, i) => ({
        type: 'security_alert',
        severity: i % 2 === 0 ? 'high' : 'medium',
        timestamp: new Date()
      }));

      // Send events rapidly
      await Promise.all(events.map(event =>
        eventStreamManager.publishToStream('securityEvents', event)
      ));

      // Allow time for batch processing
      await new Promise(resolve => setTimeout(resolve, 3000));

      expect(batchListener).toHaveBeenCalledWith(
        expect.objectContaining({
          streamName: 'securityEvents',
          batchCount: expect.any(Number),
          processedEvents: eventCount
        })
      );
    });

    test('should handle stream failures and recovery', async () => {
      await eventStreamManager.startStream('marketEvents');

      // Simulate stream processor failure
      const failingProcessor = jest.fn().mockRejectedValue(new Error('Processing failed'));
      eventStreamManager.onStreamData('marketEvents', failingProcessor);

      const event = { type: 'test_event', data: 'test' };
      
      // Should handle failure gracefully
      await expect(
        eventStreamManager.publishToStream('marketEvents', event)
      ).resolves.not.toThrow();

      // Should attempt recovery
      const streamStatus = await eventStreamManager.getStreamStatus('marketEvents');
      expect(streamStatus.errorCount).toBeGreaterThan(0);
      expect(streamStatus.status).toMatch(/recovering|healthy/);
    });
  });

  describe('Workflow Engine Integration', () => {
    test('should execute complete yield optimization workflow', async () => {
      const workflowDef = createMockWorkflowDefinition();
      
      const execution = await workflowEngine.executeWorkflow(workflowDef);

      expect(execution).toMatchObject({
        workflowId: workflowDef.id,
        executionId: expect.any(String),
        status: 'completed',
        steps: expect.arrayContaining([
          expect.objectContaining({
            id: 'collect_market_data',
            status: 'completed',
            outputs: expect.any(Object)
          }),
          expect.objectContaining({
            id: 'analyze_sentiment',
            status: 'completed',
            outputs: expect.any(Object)
          }),
          expect.objectContaining({
            id: 'assess_compliance',
            status: 'completed',
            outputs: expect.any(Object)
          }),
          expect.objectContaining({
            id: 'optimize_portfolio',
            status: 'completed',
            outputs: expect.any(Object)
          }),
          expect.objectContaining({
            id: 'execute_rebalance',
            status: 'completed',
            outputs: expect.any(Object)
          })
        ]),
        totalDuration: expect.any(Number),
        result: expect.any(Object)
      });
    });

    test('should handle workflow step dependencies', async () => {
      const workflowDef = createMockWorkflowDefinition();
      
      const executionListener = jest.fn();
      workflowEngine.on('step_executed', executionListener);

      await workflowEngine.executeWorkflow(workflowDef);

      const executedSteps = executionListener.mock.calls.map(call => call[0]);

      // Verify dependency order
      const stepOrder = executedSteps.map(step => step.stepId);
      const collectIndex = stepOrder.indexOf('collect_market_data');
      const sentimentIndex = stepOrder.indexOf('analyze_sentiment');
      const complianceIndex = stepOrder.indexOf('assess_compliance');
      const optimizeIndex = stepOrder.indexOf('optimize_portfolio');
      const executeIndex = stepOrder.indexOf('execute_rebalance');

      // Dependencies should be respected
      expect(collectIndex).toBeLessThan(sentimentIndex);
      expect(collectIndex).toBeLessThan(complianceIndex);
      expect(sentimentIndex).toBeLessThan(optimizeIndex);
      expect(complianceIndex).toBeLessThan(optimizeIndex);
      expect(optimizeIndex).toBeLessThan(executeIndex);
    });

    test('should handle workflow compensation on failure', async () => {
      const workflowDef = createMockWorkflowDefinition();
      
      // Mock failure in execution step
      jest.spyOn(satellites.forge, 'executeRebalance').mockRejectedValueOnce(new Error('Execution failed'));

      const compensationListener = jest.fn();
      workflowEngine.on('compensation_executed', compensationListener);

      const execution = await workflowEngine.executeWorkflow(workflowDef);

      expect(execution.status).toBe('compensated');
      expect(compensationListener).toHaveBeenCalled();

      const compensation = compensationListener.mock.calls[0][0];
      expect(compensation.compensatedSteps).toContain('execute_rebalance');
      expect(compensation.rollbackActions).toContain('rollback_trades');
    });

    test('should execute parallel workflow steps', async () => {
      const workflowDef = createMockWorkflowDefinition();
      
      const startTime = Date.now();
      const execution = await workflowEngine.executeWorkflow(workflowDef);
      const duration = Date.now() - startTime;

      // Parallel steps should reduce execution time
      expect(duration).toBeLessThan(30000); // Should complete within 30 seconds
      
      const parallelSteps = execution.steps.filter(step => step.parallel);
      expect(parallelSteps.length).toBeGreaterThan(0);
    });
  });

  describe('Data Transformations', () => {
    test('should apply price normalization transformation', async () => {
      const rawData = {
        price: '45123.456789123',
        timestamp: '2024-01-15T10:30:00Z',
        volume: 2500000.789
      };

      const transformation = config.transformations.priceNormalization;
      const transformedData = await pipelineManager.applyTransformation(transformation, rawData);

      expect(transformedData).toMatchObject({
        price: expect.stringMatching(/^\d+\.\d{8}$/), // 8 decimal places
        timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/), // ISO format
        volume: expect.stringMatching(/^\d+(\.\d+)?e\+?\d+$/) // Scientific notation
      });
    });

    test('should apply sentiment aggregation transformation', async () => {
      const sentimentData = [
        { sentiment: 0.8, confidence: 0.9, influence: 0.7 },
        { sentiment: 0.6, confidence: 0.8, influence: 0.5 },
        { sentiment: 0.9, confidence: 0.7, influence: 0.9 }
      ];

      const transformation = config.transformations.sentimentAggregation;
      const aggregatedData = await pipelineManager.applyTransformation(transformation, sentimentData);

      expect(aggregatedData).toMatchObject({
        sentiment_scores: expect.any(Number), // Weighted average
        confidence: expect.any(Number), // Harmonic mean
        timeframe: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/) // Time bucket
      });

      // Weighted average should be between min and max
      expect(aggregatedData.sentiment_scores).toBeGreaterThanOrEqual(0.6);
      expect(aggregatedData.sentiment_scores).toBeLessThanOrEqual(0.9);
    });

    test('should chain multiple transformations', async () => {
      const rawMarketData = {
        btc: { price: '45123.456789', volume: 1000000, sentiment: [0.8, 0.7, 0.9] },
        eth: { price: '3245.123456', volume: 800000, sentiment: [0.6, 0.7, 0.8] }
      };

      const transformationChain = [
        config.transformations.priceNormalization,
        config.transformations.sentimentAggregation
      ];

      const result = await pipelineManager.applyTransformationChain(transformationChain, rawMarketData);

      expect(result.btc).toMatchObject({
        price: expect.stringMatching(/^\d+\.\d{8}$/),
        volume: expect.any(String),
        sentiment_scores: expect.any(Number)
      });
    });
  });

  describe('Flow Monitoring and Metrics', () => {
    test('should collect pipeline execution metrics', async () => {
      await dataFlowOrchestrator.enableMetrics();

      // Execute multiple pipelines
      const executions = await Promise.all([
        dataFlowOrchestrator.executePipeline('marketDataFlow', { type: 'price_update', payload: { symbol: 'BTC' } }),
        dataFlowOrchestrator.executePipeline('marketDataFlow', { type: 'price_update', payload: { symbol: 'ETH' } }),
        dataFlowOrchestrator.executePipeline('complianceFlow', { type: 'transaction_event', payload: { id: 'tx1' } })
      ]);

      const metrics = await dataFlowOrchestrator.getMetrics();

      expect(metrics).toMatchObject({
        totalExecutions: 3,
        successfulExecutions: 3,
        failedExecutions: 0,
        averageLatency: expect.any(Number),
        throughput: expect.any(Number),
        pipelineMetrics: expect.objectContaining({
          marketDataFlow: expect.objectContaining({
            executions: 2,
            averageLatency: expect.any(Number),
            successRate: 1.0
          }),
          complianceFlow: expect.objectContaining({
            executions: 1,
            averageLatency: expect.any(Number),
            successRate: 1.0
          })
        }),
        timestamp: expect.any(Date)
      });
    });

    test('should detect and alert on performance degradation', async () => {
      const alertListener = jest.fn();
      dataFlowOrchestrator.on('performance_alert', alertListener);

      // Simulate slow pipeline execution
      jest.spyOn(satellites.pulse, 'optimizePortfolio').mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve({}), 8000)) // 8 seconds
      );

      await dataFlowOrchestrator.executePipeline('marketDataFlow', { 
        type: 'price_update', 
        payload: { symbol: 'BTC' } 
      });

      expect(alertListener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'latency_threshold_exceeded',
          pipeline: 'marketDataFlow',
          stage: 'optimization',
          actualLatency: expect.any(Number),
          threshold: 5000
        })
      );
    });

    test('should track data flow lineage', async () => {
      const lineageTracker = jest.fn();
      dataFlowOrchestrator.on('data_lineage', lineageTracker);

      await dataFlowOrchestrator.executePipeline('marketDataFlow', {
        type: 'price_update',
        payload: { symbol: 'BTC', source: 'binance' }
      });

      expect(lineageTracker).toHaveBeenCalledWith(
        expect.objectContaining({
          executionId: expect.any(String),
          dataPath: expect.arrayContaining([
            expect.objectContaining({
              stage: 'oracle_ingestion',
              input: expect.any(Object),
              output: expect.any(Object),
              transformation: expect.any(String)
            }),
            expect.objectContaining({
              stage: 'sentiment_analysis',
              input: expect.any(Object),
              output: expect.any(Object),
              transformation: expect.any(String)
            })
          ]),
          timestamp: expect.any(Date)
        })
      );
    });
  });

  describe('Error Handling and Recovery', () => {
    test('should handle cascade failures gracefully', async () => {
      // Simulate Oracle failure
      jest.spyOn(satellites.oracle, 'getMarketData').mockRejectedValue(new Error('Oracle service down'));

      const execution = await dataFlowOrchestrator.executePipeline('marketDataFlow', {
        type: 'price_update',
        payload: { symbol: 'BTC' }
      });

      expect(execution.status).toBe('failed');
      expect(execution.failureReason).toMatch(/Oracle service down/);
      
      // Should not execute dependent stages
      const failedStages = execution.stages.filter(s => s.status === 'failed' || s.status === 'skipped');
      expect(failedStages.length).toBeGreaterThan(1);
    });

    test('should implement circuit breaker for failing satellites', async () => {
      // Simulate repeated failures
      const failureCount = 5;
      for (let i = 0; i < failureCount; i++) {
        try {
          await dataFlowOrchestrator.executePipeline('marketDataFlow', {
            type: 'price_update',
            payload: { symbol: `TEST${i}` }
          });
        } catch (error) {
          // Expected failures
        }
      }

      const circuitState = await dataFlowOrchestrator.getCircuitBreakerState('oracle');
      expect(circuitState.state).toBe('open');

      // Further requests should be rejected immediately
      const rejectedExecution = await dataFlowOrchestrator.executePipeline('marketDataFlow', {
        type: 'price_update',
        payload: { symbol: 'BTC' }
      });

      expect(rejectedExecution.status).toBe('circuit_open');
    });

    test('should recover from failures automatically', async () => {
      const recoveryListener = jest.fn();
      dataFlowOrchestrator.on('pipeline_recovered', recoveryListener);

      // Simulate temporary failure then recovery
      let failureCount = 0;
      jest.spyOn(satellites.echo, 'analyzeSentiment').mockImplementation(() => {
        failureCount++;
        if (failureCount <= 2) {
          return Promise.reject(new Error('Temporary failure'));
        }
        return Promise.resolve({ sentiment: 'neutral', confidence: 0.5 });
      });

      await dataFlowOrchestrator.executePipeline('marketDataFlow', {
        type: 'price_update',
        payload: { symbol: 'BTC' }
      });

      expect(recoveryListener).toHaveBeenCalledWith(
        expect.objectContaining({
          pipeline: 'marketDataFlow',
          stage: 'sentiment_analysis',
          recoveredAfter: 2,
          timestamp: expect.any(Date)
        })
      );
    });
  });
});