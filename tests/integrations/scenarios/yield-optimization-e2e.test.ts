import { IntegrationTestBase, IntegrationTestConfig } from '../framework/integration-test-base';
import { TestDataBuilder, TestScenarioBuilder } from '../framework/test-data-builder';

export class YieldOptimizationE2ETest extends IntegrationTestBase {
  private testDataBuilder: TestDataBuilder;
  private scenarioBuilder: TestScenarioBuilder;

  constructor() {
    const config: IntegrationTestConfig = {
      name: 'yield-optimization-e2e',
      description: 'End-to-end test for complete yield optimization flow',
      environment: {
        type: 'local',
        baseUrl: process.env.API_BASE_URL || 'http://localhost:3000',
        variables: {
          API_VERSION: 'v1',
          TEST_MODE: 'true'
        }
      },
      services: [
        {
          name: 'api-gateway',
          type: 'api',
          url: process.env.API_GATEWAY_URL || 'http://localhost:3000',
          healthCheck: {
            endpoint: '/health',
            method: 'GET',
            expectedStatus: 200,
            timeout: 5000,
            retries: 3
          }
        },
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
          },
          dependencies: ['api-gateway']
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
          },
          dependencies: ['api-gateway']
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
          },
          dependencies: ['api-gateway']
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
      cache: {
        type: 'redis',
        connection: {
          host: process.env.REDIS_HOST || 'localhost',
          port: parseInt(process.env.REDIS_PORT || '6379'),
          password: process.env.REDIS_PASSWORD
        }
      },
      timeout: 300000, // 5 minutes
      retries: 3,
      cleanup: {
        database: true,
        cache: true,
        files: true,
        services: false
      }
    };

    super(config);
    this.testDataBuilder = new TestDataBuilder();
    this.scenarioBuilder = new TestScenarioBuilder(this.testDataBuilder);
  }

  getName(): string {
    return 'Yield Optimization E2E Test';
  }

  getDescription(): string {
    return 'Tests the complete yield optimization flow from user registration to yield generation';
  }

  async runTests(): Promise<void> {
    await this.runTest('Complete Yield Optimization Flow', async () => {
      // Step 1: User Registration and Authentication
      const userAuth = await this.testUserRegistrationAndAuth();
      
      // Step 2: Portfolio Creation
      const portfolio = await this.testPortfolioCreation(userAuth);
      
      // Step 3: Asset Deposit
      await this.testAssetDeposit(userAuth, portfolio);
      
      // Step 4: Yield Strategy Discovery
      const strategies = await this.testYieldStrategyDiscovery(userAuth);
      
      // Step 5: Risk Assessment
      const riskProfile = await this.testRiskAssessment(userAuth, portfolio);
      
      // Step 6: Strategy Optimization
      const optimizedStrategy = await this.testStrategyOptimization(
        userAuth,
        portfolio,
        strategies,
        riskProfile
      );
      
      // Step 7: Strategy Execution
      const position = await this.testStrategyExecution(
        userAuth,
        portfolio,
        optimizedStrategy
      );
      
      // Step 8: Yield Monitoring
      await this.testYieldMonitoring(userAuth, position);
      
      // Step 9: Auto-Compounding
      await this.testAutoCompounding(userAuth, position);
      
      // Step 10: Performance Reporting
      await this.testPerformanceReporting(userAuth, portfolio);
    });

    await this.runTest('Multi-Chain Yield Optimization', async () => {
      const { user, portfolio } = await this.scenarioBuilder.createCompleteUserScenario();
      const auth = await this.authenticateUser(user.data.email, user.data.password);

      // Test cross-chain yield optimization
      await this.testCrossChainYieldOptimization(auth, portfolio);
    });

    await this.runTest('Yield Strategy Rebalancing', async () => {
      const scenario = await this.scenarioBuilder.createYieldOptimizationScenario();
      const auth = await this.authenticateUser(
        scenario.user.data.email,
        scenario.user.data.password
      );

      // Test automatic rebalancing
      await this.testYieldRebalancing(auth, scenario.portfolio, scenario.positions);
    });
  }

  private async testUserRegistrationAndAuth(): Promise<{ token: string; userId: string }> {
    // Register new user
    const registrationResponse = await this.makeRequest('api-gateway', {
      method: 'POST',
      path: '/api/v1/auth/register',
      body: {
        email: `test-${Date.now()}@yieldsensei.com`,
        password: 'SecurePassword123!',
        username: `testuser${Date.now()}`
      }
    });

    this.assert(registrationResponse.status === 201, 'User registration failed');
    
    // Login
    const loginResponse = await this.makeRequest('api-gateway', {
      method: 'POST',
      path: '/api/v1/auth/login',
      body: {
        email: registrationResponse.body.user.email,
        password: 'SecurePassword123!'
      }
    });

    this.assert(loginResponse.status === 200, 'User login failed');
    this.assert(loginResponse.body.token, 'No auth token received');

    return {
      token: loginResponse.body.token,
      userId: registrationResponse.body.user.id
    };
  }

  private async testPortfolioCreation(
    auth: { token: string; userId: string }
  ): Promise<any> {
    const response = await this.makeRequest('api-gateway', {
      method: 'POST',
      path: '/api/v1/portfolios',
      headers: {
        'Authorization': `Bearer ${auth.token}`
      },
      body: {
        name: 'Test Yield Portfolio',
        description: 'Integration test portfolio for yield optimization',
        currency: 'USD',
        type: 'yield-focused'
      }
    });

    this.assert(response.status === 201, 'Portfolio creation failed');
    this.assert(response.body.portfolio.id, 'No portfolio ID returned');

    return response.body.portfolio;
  }

  private async testAssetDeposit(
    auth: { token: string; userId: string },
    portfolio: any
  ): Promise<void> {
    // Simulate USDC deposit
    const depositResponse = await this.makeRequest('api-gateway', {
      method: 'POST',
      path: `/api/v1/portfolios/${portfolio.id}/deposits`,
      headers: {
        'Authorization': `Bearer ${auth.token}`
      },
      body: {
        asset: 'USDC',
        amount: 10000,
        chain: 'ethereum',
        txHash: `0x${Math.random().toString(16).substr(2, 64)}`
      }
    });

    this.assert(depositResponse.status === 201, 'Asset deposit failed');

    // Wait for deposit confirmation
    await this.waitForCondition(async () => {
      const txStatus = await this.makeRequest('api-gateway', {
        method: 'GET',
        path: `/api/v1/transactions/${depositResponse.body.transactionId}`,
        headers: {
          'Authorization': `Bearer ${auth.token}`
        }
      });
      
      return txStatus.body.status === 'confirmed';
    }, 60000); // 60 seconds timeout
  }

  private async testYieldStrategyDiscovery(
    auth: { token: string; userId: string }
  ): Promise<any[]> {
    // Discover available yield strategies
    const response = await this.makeRequest('pulse-satellite', {
      method: 'GET',
      path: '/api/v1/strategies/discover',
      headers: {
        'Authorization': `Bearer ${auth.token}`
      },
      query: {
        minApy: '5',
        maxRisk: 'medium',
        chains: 'ethereum,polygon,arbitrum'
      }
    });

    this.assert(response.status === 200, 'Strategy discovery failed');
    this.assert(response.body.strategies.length > 0, 'No strategies found');

    return response.body.strategies;
  }

  private async testRiskAssessment(
    auth: { token: string; userId: string },
    portfolio: any
  ): Promise<any> {
    const response = await this.makeRequest('sage-satellite', {
      method: 'POST',
      path: '/api/v1/risk/assess',
      headers: {
        'Authorization': `Bearer ${auth.token}`
      },
      body: {
        portfolioId: portfolio.id,
        includeRWA: true,
        timeHorizon: '1y'
      }
    });

    this.assert(response.status === 200, 'Risk assessment failed');
    this.assert(response.body.riskProfile, 'No risk profile returned');

    return response.body.riskProfile;
  }

  private async testStrategyOptimization(
    auth: { token: string; userId: string },
    portfolio: any,
    strategies: any[],
    riskProfile: any
  ): Promise<any> {
    const response = await this.makeRequest('pulse-satellite', {
      method: 'POST',
      path: '/api/v1/strategies/optimize',
      headers: {
        'Authorization': `Bearer ${auth.token}`
      },
      body: {
        portfolioId: portfolio.id,
        availableStrategies: strategies.map(s => s.id),
        riskProfile: riskProfile,
        optimizationGoal: 'maximize-yield',
        constraints: {
          maxSingleStrategy: 0.4, // Max 40% in single strategy
          minLiquidity: 0.2, // Keep 20% liquid
          maxGasCost: 100 // Max $100 in gas fees
        }
      }
    });

    this.assert(response.status === 200, 'Strategy optimization failed');
    this.assert(response.body.optimizedAllocation, 'No optimized allocation returned');

    return response.body.optimizedAllocation;
  }

  private async testStrategyExecution(
    auth: { token: string; userId: string },
    portfolio: any,
    optimizedStrategy: any
  ): Promise<any> {
    // Execute the optimized strategy
    const response = await this.makeRequest('forge-satellite', {
      method: 'POST',
      path: '/api/v1/strategies/execute',
      headers: {
        'Authorization': `Bearer ${auth.token}`
      },
      body: {
        portfolioId: portfolio.id,
        allocation: optimizedStrategy,
        slippage: 0.5, // 0.5% slippage tolerance
        deadline: Date.now() + 300000 // 5 minutes deadline
      }
    });

    this.assert(response.status === 201, 'Strategy execution failed');
    this.assert(response.body.positions, 'No positions created');

    // Wait for execution confirmation
    await this.waitForCondition(async () => {
      const status = await this.makeRequest('api-gateway', {
        method: 'GET',
        path: `/api/v1/positions/${response.body.positions[0].id}`,
        headers: {
          'Authorization': `Bearer ${auth.token}`
        }
      });
      
      return status.body.status === 'active';
    }, 120000); // 2 minutes timeout

    return response.body.positions[0];
  }

  private async testYieldMonitoring(
    auth: { token: string; userId: string },
    position: any
  ): Promise<void> {
    // Set up yield monitoring
    const monitoringResponse = await this.makeRequest('pulse-satellite', {
      method: 'POST',
      path: '/api/v1/monitoring/create',
      headers: {
        'Authorization': `Bearer ${auth.token}`
      },
      body: {
        positionId: position.id,
        alerts: [
          {
            type: 'apy-drop',
            threshold: 2, // Alert if APY drops by 2%
            notification: 'email'
          },
          {
            type: 'impermanent-loss',
            threshold: 5, // Alert if IL exceeds 5%
            notification: 'push'
          }
        ]
      }
    });

    this.assert(monitoringResponse.status === 201, 'Monitoring setup failed');

    // Simulate time passing and check yield accrual
    await this.wait(5000); // Wait 5 seconds

    const yieldResponse = await this.makeRequest('api-gateway', {
      method: 'GET',
      path: `/api/v1/positions/${position.id}/yield`,
      headers: {
        'Authorization': `Bearer ${auth.token}`
      }
    });

    this.assert(yieldResponse.status === 200, 'Yield check failed');
    this.assert(yieldResponse.body.accruedYield >= 0, 'Invalid yield amount');
  }

  private async testAutoCompounding(
    auth: { token: string; userId: string },
    position: any
  ): Promise<void> {
    // Enable auto-compounding
    const compoundingResponse = await this.makeRequest('pulse-satellite', {
      method: 'POST',
      path: '/api/v1/strategies/auto-compound',
      headers: {
        'Authorization': `Bearer ${auth.token}`
      },
      body: {
        positionId: position.id,
        frequency: 'daily',
        minYield: 10, // Min $10 yield before compounding
        reinvestRatio: 0.9 // Reinvest 90% of yield
      }
    });

    this.assert(compoundingResponse.status === 200, 'Auto-compounding setup failed');

    // Trigger manual compound to test
    const manualCompoundResponse = await this.makeRequest('forge-satellite', {
      method: 'POST',
      path: `/api/v1/positions/${position.id}/compound`,
      headers: {
        'Authorization': `Bearer ${auth.token}`
      }
    });

    this.assert(
      manualCompoundResponse.status === 200,
      'Manual compounding failed'
    );
  }

  private async testPerformanceReporting(
    auth: { token: string; userId: string },
    portfolio: any
  ): Promise<void> {
    // Get performance report
    const reportResponse = await this.makeRequest('api-gateway', {
      method: 'GET',
      path: `/api/v1/portfolios/${portfolio.id}/performance`,
      headers: {
        'Authorization': `Bearer ${auth.token}`
      },
      query: {
        period: '1d',
        includeYield: 'true',
        includeGas: 'true'
      }
    });

    this.assert(reportResponse.status === 200, 'Performance report failed');
    this.assert(reportResponse.body.totalReturn !== undefined, 'No return data');
    this.assert(reportResponse.body.yieldGenerated >= 0, 'Invalid yield data');
    this.assert(reportResponse.body.gasSpent >= 0, 'Invalid gas data');

    // Verify data consistency
    const portfolioValue = reportResponse.body.currentValue;
    const initialValue = reportResponse.body.initialValue;
    const totalReturn = reportResponse.body.totalReturn;
    
    const calculatedReturn = ((portfolioValue - initialValue) / initialValue) * 100;
    this.assert(
      Math.abs(calculatedReturn - totalReturn) < 0.01,
      'Return calculation mismatch'
    );
  }

  private async testCrossChainYieldOptimization(
    auth: { token: string; userId: string },
    portfolio: any
  ): Promise<void> {
    // Test yield optimization across multiple chains
    const crossChainResponse = await this.makeRequest('bridge-satellite', {
      method: 'POST',
      path: '/api/v1/yield/cross-chain-optimize',
      headers: {
        'Authorization': `Bearer ${auth.token}`
      },
      body: {
        portfolioId: portfolio.data.id,
        sourceChain: 'ethereum',
        targetChains: ['polygon', 'arbitrum', 'optimism'],
        amount: 5000,
        asset: 'USDC',
        optimizeFor: 'net-yield' // Optimize for yield after bridge costs
      }
    });

    this.assert(crossChainResponse.status === 200, 'Cross-chain optimization failed');
    this.assert(
      crossChainResponse.body.recommendations.length > 0,
      'No cross-chain recommendations'
    );

    // Execute best cross-chain strategy
    const bestStrategy = crossChainResponse.body.recommendations[0];
    const bridgeResponse = await this.makeRequest('bridge-satellite', {
      method: 'POST',
      path: '/api/v1/bridge/execute',
      headers: {
        'Authorization': `Bearer ${auth.token}`
      },
      body: {
        portfolioId: portfolio.data.id,
        sourceChain: bestStrategy.sourceChain,
        targetChain: bestStrategy.targetChain,
        amount: bestStrategy.amount,
        asset: bestStrategy.asset,
        strategy: bestStrategy.strategyId
      }
    });

    this.assert(bridgeResponse.status === 201, 'Bridge execution failed');
  }

  private async testYieldRebalancing(
    auth: { token: string; userId: string },
    portfolio: any,
    positions: any[]
  ): Promise<void> {
    // Simulate market conditions change
    await this.wait(10000); // Wait 10 seconds

    // Check rebalancing recommendations
    const rebalanceResponse = await this.makeRequest('pulse-satellite', {
      method: 'POST',
      path: '/api/v1/strategies/rebalance/check',
      headers: {
        'Authorization': `Bearer ${auth.token}`
      },
      body: {
        portfolioId: portfolio.data.id,
        positions: positions.map(p => p.strategyId),
        threshold: 5 // Rebalance if allocation drifts by 5%
      }
    });

    this.assert(rebalanceResponse.status === 200, 'Rebalance check failed');

    if (rebalanceResponse.body.rebalanceNeeded) {
      // Execute rebalancing
      const executeRebalanceResponse = await this.makeRequest('forge-satellite', {
        method: 'POST',
        path: '/api/v1/strategies/rebalance/execute',
        headers: {
          'Authorization': `Bearer ${auth.token}`
        },
        body: {
          portfolioId: portfolio.data.id,
          rebalancePlan: rebalanceResponse.body.plan,
          maxGas: 200 // Max $200 in gas fees
        }
      });

      this.assert(
        executeRebalanceResponse.status === 200,
        'Rebalance execution failed'
      );
    }
  }

  private async authenticateUser(email: string, password: string): Promise<any> {
    const response = await this.makeRequest('api-gateway', {
      method: 'POST',
      path: '/api/v1/auth/login',
      body: { email, password }
    });

    return {
      token: response.body.token,
      userId: response.body.user.id
    };
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