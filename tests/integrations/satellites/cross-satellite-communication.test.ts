import { IntegrationTestBase, IntegrationTestConfig } from '../framework/integration-test-base';
import { TestDataBuilder, RWADataFactory, YieldStrategyDataFactory } from '../framework/test-data-builder';

export interface SatelliteMessage {
  id: string;
  source: string;
  target: string;
  type: string;
  payload: any;
  timestamp: number;
  correlationId?: string;
}

export interface CommunicationFlow {
  name: string;
  description: string;
  steps: CommunicationStep[];
  expectedResult: any;
}

export interface CommunicationStep {
  satellite: string;
  action: 'send' | 'receive' | 'process' | 'validate';
  endpoint?: string;
  data?: any;
  expectedResponse?: any;
  timeout?: number;
}

export class CrossSatelliteCommunicationTest extends IntegrationTestBase {
  private testDataBuilder: TestDataBuilder;
  private messageQueue: SatelliteMessage[] = [];
  private communicationFlows: CommunicationFlow[] = [];

  constructor() {
    const config: IntegrationTestConfig = {
      name: 'cross-satellite-communication',
      description: 'Tests communication patterns between YieldSensei satellites',
      environment: {
        type: 'local',
        baseUrl: 'http://localhost:3000',
        variables: {
          MESSAGE_TIMEOUT: '30000',
          RETRY_ATTEMPTS: '3'
        }
      },
      services: [
        {
          name: 'sage-satellite',
          type: 'satellite',
          url: process.env.SAGE_URL || 'http://localhost:3001',
          healthCheck: {
            endpoint: '/health',
            method: 'GET',
            expectedStatus: 200,
            timeout: 5000,
            retries: 3
          }
        },
        {
          name: 'echo-satellite',
          type: 'satellite',
          url: process.env.ECHO_URL || 'http://localhost:3002',
          healthCheck: {
            endpoint: '/health',
            method: 'GET',
            expectedStatus: 200,
            timeout: 5000,
            retries: 3
          }
        },
        {
          name: 'forge-satellite',
          type: 'satellite',
          url: process.env.FORGE_URL || 'http://localhost:3003',
          healthCheck: {
            endpoint: '/health',
            method: 'GET',
            expectedStatus: 200,
            timeout: 5000,
            retries: 3
          }
        },
        {
          name: 'pulse-satellite',
          type: 'satellite',
          url: process.env.PULSE_URL || 'http://localhost:3004',
          healthCheck: {
            endpoint: '/health',
            method: 'GET',
            expectedStatus: 200,
            timeout: 5000,
            retries: 3
          }
        },
        {
          name: 'bridge-satellite',
          type: 'satellite',
          url: process.env.BRIDGE_URL || 'http://localhost:3005',
          healthCheck: {
            endpoint: '/health',
            method: 'GET',
            expectedStatus: 200,
            timeout: 5000,
            retries: 3
          }
        },
        {
          name: 'oracle-satellite',
          type: 'satellite',
          url: process.env.ORACLE_URL || 'http://localhost:3006',
          healthCheck: {
            endpoint: '/health',
            method: 'GET',
            expectedStatus: 200,
            timeout: 5000,
            retries: 3
          }
        }
      ],
      database: {
        type: 'postgres',
        connection: {
          host: process.env.DB_HOST || 'localhost',
          port: parseInt(process.env.DB_PORT || '5432'),
          database: process.env.DB_NAME || 'yieldsensei_test',
          user: process.env.DB_USER || 'postgres',
          password: process.env.DB_PASSWORD || 'postgres'
        }
      },
      timeout: 180000, // 3 minutes
      retries: 2,
      cleanup: {
        database: true,
        cache: true,
        files: false,
        services: false
      }
    };

    super(config);
    this.testDataBuilder = new TestDataBuilder();
    this.testDataBuilder.registerFactory('rwa', new RWADataFactory());
    this.testDataBuilder.registerFactory('yieldStrategy', new YieldStrategyDataFactory());
    this.setupCommunicationFlows();
  }

  getName(): string {
    return 'Cross-Satellite Communication Test';
  }

  getDescription(): string {
    return 'Tests message passing, data consistency, and error handling between satellite services';
  }

  async runTests(): Promise<void> {
    await this.runTest('Sage-Oracle RWA Validation Flow', async () => {
      await this.testSageOracleRWAValidation();
    });

    await this.runTest('Pulse-Forge Strategy Execution Flow', async () => {
      await this.testPulseForgeStrategyExecution();
    });

    await this.runTest('Echo-Bridge Cross-Chain Sentiment Flow', async () => {
      await this.testEchoBridgeCrossChainSentiment();
    });

    await this.runTest('Multi-Satellite Data Synchronization', async () => {
      await this.testMultiSatelliteDataSync();
    });

    await this.runTest('Error Propagation and Recovery', async () => {
      await this.testErrorPropagationAndRecovery();
    });

    await this.runTest('Service Discovery and Health Monitoring', async () => {
      await this.testServiceDiscoveryAndHealth();
    });

    await this.runTest('Message Ordering and Idempotency', async () => {
      await this.testMessageOrderingAndIdempotency();
    });

    await this.runTest('Load Balancing and Circuit Breaking', async () => {
      await this.testLoadBalancingAndCircuitBreaking();
    });
  }

  private setupCommunicationFlows(): void {
    this.communicationFlows = [
      {
        name: 'RWA Validation Flow',
        description: 'Sage requests Oracle validation for RWA assets',
        steps: [
          {
            satellite: 'sage-satellite',
            action: 'send',
            endpoint: '/api/v1/oracle/validate-rwa',
            data: { rwaId: 'rwa-123', validationType: 'comprehensive' }
          },
          {
            satellite: 'oracle-satellite',
            action: 'receive',
            endpoint: '/api/v1/validate/rwa'
          },
          {
            satellite: 'oracle-satellite',
            action: 'process',
            expectedResponse: { validated: true, score: 85 }
          },
          {
            satellite: 'sage-satellite',
            action: 'receive',
            expectedResponse: { oracleValidation: true }
          }
        ],
        expectedResult: { validated: true, communicationSuccess: true }
      },
      {
        name: 'Strategy Execution Flow',
        description: 'Pulse discovers strategies, Forge executes them',
        steps: [
          {
            satellite: 'pulse-satellite',
            action: 'send',
            endpoint: '/api/v1/strategies/discover'
          },
          {
            satellite: 'forge-satellite',
            action: 'receive',
            endpoint: '/api/v1/strategies/execute'
          },
          {
            satellite: 'forge-satellite',
            action: 'process',
            expectedResponse: { executed: true, txHash: 'string' }
          }
        ],
        expectedResult: { strategiesExecuted: true }
      }
    ];
  }

  private async testSageOracleRWAValidation(): Promise<void> {
    // Create test RWA
    const rwaData = await this.testDataBuilder.create('rwa', {
      name: 'Cross-Satellite Test RWA',
      type: 'real-estate',
      requiresOracleValidation: true
    });

    // Step 1: Sage initiates Oracle validation
    const validationRequest = await this.makeRequest('sage-satellite', {
      method: 'POST',
      path: '/api/v1/oracle/validate-rwa',
      body: {
        rwaId: rwaData.data.id,
        validationType: 'comprehensive',
        requestId: `req-${Date.now()}`,
        callbackUrl: 'http://localhost:3001/api/v1/callbacks/oracle'
      }
    });

    this.assert(validationRequest.status === 200, 'Oracle validation request failed');
    this.assert(validationRequest.body.requestId, 'No request ID returned');

    // Step 2: Verify Oracle received the request
    await this.wait(2000); // Wait for async processing

    const oracleStatus = await this.makeRequest('oracle-satellite', {
      method: 'GET',
      path: `/api/v1/validation/status/${validationRequest.body.requestId}`
    });

    this.assert(oracleStatus.status === 200, 'Oracle did not receive validation request');
    this.assert(oracleStatus.body.status === 'processing', 'Oracle not processing request');

    // Step 3: Wait for Oracle to complete validation and callback to Sage
    await this.waitForCondition(async () => {
      const sageCallback = await this.makeRequest('sage-satellite', {
        method: 'GET',
        path: `/api/v1/validation/results/${validationRequest.body.requestId}`
      });
      
      return sageCallback.status === 200 && sageCallback.body.completed;
    }, 30000);

    // Step 4: Verify final validation result
    const finalResult = await this.makeRequest('sage-satellite', {
      method: 'GET',
      path: `/api/v1/validation/results/${validationRequest.body.requestId}`
    });

    this.assert(finalResult.body.oracleValidation, 'Oracle validation failed');
    this.assert(finalResult.body.score !== undefined, 'No validation score provided');
    this.assert(finalResult.body.communicationMetrics, 'No communication metrics tracked');
  }

  private async testPulseForgeStrategyExecution(): Promise<void> {
    // Create test strategy
    const strategyData = await this.testDataBuilder.create('yieldStrategy', {
      name: 'Cross-Satellite Strategy Test',
      requiresExecution: true
    });

    // Step 1: Pulse discovers and optimizes strategy
    const optimizationRequest = await this.makeRequest('pulse-satellite', {
      method: 'POST',
      path: '/api/v1/strategies/optimize',
      body: {
        portfolioId: 'test-portfolio',
        targetAmount: 10000,
        riskTolerance: 'medium',
        forgeExecutionRequired: true
      }
    });

    this.assert(optimizationRequest.status === 200, 'Strategy optimization failed');
    this.assert(optimizationRequest.body.optimizedStrategy, 'No optimized strategy returned');

    // Step 2: Pulse sends strategy to Forge for execution
    const executionRequest = await this.makeRequest('pulse-satellite', {
      method: 'POST',
      path: '/api/v1/forge/execute-strategy',
      body: {
        strategyConfig: optimizationRequest.body.optimizedStrategy,
        executionId: `exec-${Date.now()}`,
        callbackUrl: 'http://localhost:3004/api/v1/callbacks/forge'
      }
    });

    this.assert(executionRequest.status === 202, 'Strategy execution request failed');

    // Step 3: Verify Forge received and is processing
    const forgeStatus = await this.makeRequest('forge-satellite', {
      method: 'GET',
      path: `/api/v1/execution/status/${executionRequest.body.executionId}`
    });

    this.assert(forgeStatus.status === 200, 'Forge did not receive execution request');
    this.assert(['pending', 'processing'].includes(forgeStatus.body.status), 'Forge not processing request');

    // Step 4: Wait for execution completion and callback
    await this.waitForCondition(async () => {
      const pulseCallback = await this.makeRequest('pulse-satellite', {
        method: 'GET',
        path: `/api/v1/execution/results/${executionRequest.body.executionId}`
      });
      
      return pulseCallback.status === 200 && pulseCallback.body.completed;
    }, 60000);

    // Step 5: Verify execution results
    const executionResult = await this.makeRequest('pulse-satellite', {
      method: 'GET',
      path: `/api/v1/execution/results/${executionRequest.body.executionId}`
    });

    this.assert(executionResult.body.executed, 'Strategy execution failed');
    this.assert(executionResult.body.txHash, 'No transaction hash provided');
    this.assert(executionResult.body.gasUsed > 0, 'No gas usage reported');
  }

  private async testEchoBridgeCrossChainSentiment(): Promise<void> {
    // Step 1: Echo analyzes sentiment for cross-chain opportunities
    const sentimentRequest = await this.makeRequest('echo-satellite', {
      method: 'POST',
      path: '/api/v1/sentiment/cross-chain-analysis',
      body: {
        assets: ['ETH', 'MATIC', 'ARB'],
        chains: ['ethereum', 'polygon', 'arbitrum'],
        analysisType: 'yield-opportunity'
      }
    });

    this.assert(sentimentRequest.status === 200, 'Cross-chain sentiment analysis failed');
    this.assert(sentimentRequest.body.crossChainOpportunities, 'No cross-chain opportunities found');

    // Step 2: Echo sends recommendations to Bridge for execution
    const bridgeRequest = await this.makeRequest('echo-satellite', {
      method: 'POST',
      path: '/api/v1/bridge/recommend-cross-chain',
      body: {
        opportunities: sentimentRequest.body.crossChainOpportunities,
        requestId: `bridge-${Date.now()}`,
        priorityLevel: 'high'
      }
    });

    this.assert(bridgeRequest.status === 202, 'Bridge recommendation failed');

    // Step 3: Verify Bridge processes recommendations
    const bridgeStatus = await this.makeRequest('bridge-satellite', {
      method: 'GET',
      path: `/api/v1/recommendations/status/${bridgeRequest.body.requestId}`
    });

    this.assert(bridgeStatus.status === 200, 'Bridge did not receive recommendations');
    this.assert(bridgeStatus.body.processed, 'Bridge not processing recommendations');

    // Step 4: Check cross-chain execution feasibility
    const feasibilityResult = await this.makeRequest('bridge-satellite', {
      method: 'GET',
      path: `/api/v1/recommendations/feasibility/${bridgeRequest.body.requestId}`
    });

    this.assert(feasibilityResult.body.feasible !== undefined, 'No feasibility assessment');
    this.assert(feasibilityResult.body.estimatedCosts, 'No cost estimates provided');
  }

  private async testMultiSatelliteDataSync(): Promise<void> {
    // Create shared data that multiple satellites need to access
    const sharedData = {
      portfolioId: `portfolio-${Date.now()}`,
      userId: `user-${Date.now()}`,
      assets: [
        { symbol: 'ETH', amount: 10, value: 20000 },
        { symbol: 'USDC', amount: 15000, value: 15000 }
      ]
    };

    // Step 1: Update data in Sage (primary data store)
    const sageUpdate = await this.makeRequest('sage-satellite', {
      method: 'POST',
      path: '/api/v1/data/sync/update',
      body: {
        dataId: sharedData.portfolioId,
        data: sharedData,
        syncTargets: ['pulse-satellite', 'forge-satellite', 'echo-satellite']
      }
    });

    this.assert(sageUpdate.status === 200, 'Sage data update failed');

    // Step 2: Wait for synchronization
    await this.wait(5000);

    // Step 3: Verify data consistency across satellites
    const satellites = ['pulse-satellite', 'forge-satellite', 'echo-satellite'];
    const syncResults = await Promise.all(
      satellites.map(async (satellite) => {
        const response = await this.makeRequest(satellite, {
          method: 'GET',
          path: `/api/v1/data/sync/get/${sharedData.portfolioId}`
        });
        return { satellite, data: response.body, status: response.status };
      })
    );

    // Verify all satellites have the same data
    syncResults.forEach(result => {
      this.assert(result.status === 200, `${result.satellite} sync failed`);
      this.assert(
        result.data.portfolioId === sharedData.portfolioId,
        `${result.satellite} has incorrect portfolio ID`
      );
      this.assert(
        result.data.assets.length === sharedData.assets.length,
        `${result.satellite} has incorrect asset count`
      );
    });

    // Step 4: Test conflict resolution
    const conflictUpdate = await this.makeRequest('pulse-satellite', {
      method: 'POST',
      path: '/api/v1/data/sync/update',
      body: {
        dataId: sharedData.portfolioId,
        data: { ...sharedData, conflictField: 'pulse-value' },
        version: 1
      }
    });

    // Simultaneous update from another satellite
    const conflictUpdate2 = await this.makeRequest('forge-satellite', {
      method: 'POST',
      path: '/api/v1/data/sync/update',
      body: {
        dataId: sharedData.portfolioId,
        data: { ...sharedData, conflictField: 'forge-value' },
        version: 1
      }
    });

    // Verify conflict resolution mechanism worked
    await this.wait(3000);
    const resolvedData = await this.makeRequest('sage-satellite', {
      method: 'GET',
      path: `/api/v1/data/sync/get/${sharedData.portfolioId}`
    });

    this.assert(resolvedData.body.conflictResolved, 'Conflict not resolved');
    this.assert(resolvedData.body.version > 1, 'Version not incremented after conflict');
  }

  private async testErrorPropagationAndRecovery(): Promise<void> {
    // Step 1: Simulate error in Oracle satellite
    const errorSimulation = await this.makeRequest('oracle-satellite', {
      method: 'POST',
      path: '/api/v1/test/simulate-error',
      body: {
        errorType: 'temporary-failure',
        duration: 10000 // 10 seconds
      }
    });

    this.assert(errorSimulation.status === 200, 'Error simulation setup failed');

    // Step 2: Make request from Sage that should fail
    const failingRequest = await this.makeRequest('sage-satellite', {
      method: 'POST',
      path: '/api/v1/oracle/validate-rwa',
      body: {
        rwaId: 'test-rwa-error',
        validationType: 'basic',
        retryPolicy: 'exponential-backoff'
      }
    });

    // Should receive error response
    this.assert(failingRequest.status >= 400, 'Request should have failed');
    this.assert(failingRequest.body.error, 'No error details provided');
    this.assert(failingRequest.body.retryAfter, 'No retry information provided');

    // Step 3: Verify error is propagated to dependent services
    const errorStatus = await this.makeRequest('sage-satellite', {
      method: 'GET',
      path: '/api/v1/system/error-status'
    });

    this.assert(errorStatus.body.dependencyErrors, 'Dependency errors not tracked');
    this.assert(
      errorStatus.body.dependencyErrors['oracle-satellite'],
      'Oracle error not tracked'
    );

    // Step 4: Wait for error recovery
    await this.wait(12000);

    // Step 5: Verify automatic recovery
    const recoveryRequest = await this.makeRequest('sage-satellite', {
      method: 'POST',
      path: '/api/v1/oracle/validate-rwa',
      body: {
        rwaId: 'test-rwa-recovery',
        validationType: 'basic'
      }
    });

    this.assert(recoveryRequest.status === 200, 'Service did not recover');
    this.assert(!recoveryRequest.body.error, 'Error still present after recovery');
  }

  private async testServiceDiscoveryAndHealth(): Promise<void> {
    // Step 1: Test service discovery
    const discoveryResponse = await this.makeRequest('sage-satellite', {
      method: 'GET',
      path: '/api/v1/system/discover-services'
    });

    this.assert(discoveryResponse.status === 200, 'Service discovery failed');
    this.assert(discoveryResponse.body.services, 'No services discovered');

    const discoveredServices = discoveryResponse.body.services;
    const expectedServices = ['oracle-satellite', 'pulse-satellite', 'forge-satellite', 'bridge-satellite', 'echo-satellite'];
    
    expectedServices.forEach(service => {
      this.assert(
        discoveredServices.some((s: any) => s.name === service),
        `${service} not discovered`
      );
    });

    // Step 2: Test health monitoring
    const healthResponse = await this.makeRequest('sage-satellite', {
      method: 'GET',
      path: '/api/v1/system/health-check-all'
    });

    this.assert(healthResponse.status === 200, 'Health check failed');
    this.assert(healthResponse.body.healthStatus, 'No health status provided');

    // Step 3: Test load balancing decision making
    const loadBalanceResponse = await this.makeRequest('pulse-satellite', {
      method: 'POST',
      path: '/api/v1/system/select-service',
      body: {
        serviceType: 'execution',
        criteria: 'lowest-latency',
        payload: { estimatedLoad: 'medium' }
      }
    });

    this.assert(loadBalanceResponse.status === 200, 'Load balancing failed');
    this.assert(loadBalanceResponse.body.selectedService, 'No service selected');
    this.assert(loadBalanceResponse.body.reason, 'No selection reason provided');
  }

  private async testMessageOrderingAndIdempotency(): Promise<void> {
    const correlationId = `correlation-${Date.now()}`;
    const messages = [
      { id: 1, data: 'first-message', order: 1 },
      { id: 2, data: 'second-message', order: 2 },
      { id: 3, data: 'third-message', order: 3 }
    ];

    // Step 1: Send messages out of order
    const sendPromises = [
      this.sendMessage('sage-satellite', 'pulse-satellite', messages[2], correlationId),
      this.sendMessage('sage-satellite', 'pulse-satellite', messages[0], correlationId),
      this.sendMessage('sage-satellite', 'pulse-satellite', messages[1], correlationId)
    ];

    await Promise.all(sendPromises);

    // Step 2: Verify messages are processed in correct order
    await this.wait(3000);

    const orderingResult = await this.makeRequest('pulse-satellite', {
      method: 'GET',
      path: `/api/v1/messages/correlation/${correlationId}`
    });

    this.assert(orderingResult.status === 200, 'Message ordering check failed');
    this.assert(orderingResult.body.messagesProcessed === 3, 'Not all messages processed');
    this.assert(orderingResult.body.correctOrder, 'Messages not processed in correct order');

    // Step 3: Test idempotency by sending duplicate message
    await this.sendMessage('sage-satellite', 'pulse-satellite', messages[1], correlationId);
    
    await this.wait(2000);

    const idempotencyResult = await this.makeRequest('pulse-satellite', {
      method: 'GET',
      path: `/api/v1/messages/correlation/${correlationId}`
    });

    this.assert(
      idempotencyResult.body.messagesProcessed === 3,
      'Duplicate message was processed'
    );
    this.assert(idempotencyResult.body.duplicatesRejected === 1, 'Duplicate not rejected');
  }

  private async testLoadBalancingAndCircuitBreaking(): Promise<void> {
    // Step 1: Generate high load to trigger load balancing
    const loadRequests = Array.from({ length: 20 }, (_, i) =>
      this.makeRequest('pulse-satellite', {
        method: 'POST',
        path: '/api/v1/strategies/discover',
        body: {
          portfolioId: `load-test-${i}`,
          loadTest: true
        }
      })
    );

    const loadResults = await Promise.allSettled(loadRequests);
    const successCount = loadResults.filter(r => r.status === 'fulfilled').length;

    this.assert(successCount > 15, 'Load balancing not handling load effectively');

    // Step 2: Simulate service overload to trigger circuit breaker
    const overloadRequests = Array.from({ length: 50 }, (_, i) =>
      this.makeRequest('forge-satellite', {
        method: 'POST',
        path: '/api/v1/strategies/execute',
        body: {
          executionId: `overload-test-${i}`,
          overloadTest: true
        }
      }).catch(e => ({ error: true, status: e.status }))
    );

    const overloadResults = await Promise.all(overloadRequests);
    const errorCount = overloadResults.filter((r: any) => r.error || r.status >= 500).length;

    // Should have some circuit breaker responses (503 Service Unavailable)
    this.assert(errorCount > 0, 'Circuit breaker not triggered under overload');

    // Step 3: Wait for circuit breaker recovery
    await this.wait(10000);

    const recoveryRequest = await this.makeRequest('forge-satellite', {
      method: 'POST',
      path: '/api/v1/strategies/execute',
      body: {
        executionId: 'recovery-test',
        simple: true
      }
    });

    this.assert(recoveryRequest.status === 200, 'Circuit breaker did not recover');
  }

  private async sendMessage(
    source: string,
    target: string,
    message: any,
    correlationId: string
  ): Promise<any> {
    return this.makeRequest(source, {
      method: 'POST',
      path: '/api/v1/messages/send',
      body: {
        target,
        message,
        correlationId,
        timestamp: Date.now()
      }
    });
  }

  private assert(condition: boolean, message: string): void {
    if (!condition) {
      throw new Error(`Assertion failed: ${message}`);
    }
  }

  private async wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}