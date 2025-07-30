import { IntegrationTestBase, IntegrationTestConfig } from '../framework/integration-test-base';
import { TestDataBuilder, RWADataFactory } from '../framework/test-data-builder';

export class SageSatelliteIntegrationTest extends IntegrationTestBase {
  private testDataBuilder: TestDataBuilder;

  constructor() {
    const config: IntegrationTestConfig = {
      name: 'sage-satellite-integration',
      description: 'Integration tests for Sage Satellite RWA and compliance features',
      environment: {
        type: 'local',
        baseUrl: process.env.SAGE_URL || 'http://localhost:3001',
        variables: {
          PERPLEXITY_API_KEY: process.env.PERPLEXITY_API_KEY || '',
          TEST_MODE: 'true'
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
          },
          authentication: {
            type: 'bearer',
            credentials: {
              token: process.env.SAGE_API_TOKEN || 'test-token'
            }
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
          },
          dependencies: ['sage-satellite']
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
      timeout: 120000, // 2 minutes
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
    this.testDataBuilder.registerFactory('rwa', new RWADataFactory());
  }

  getName(): string {
    return 'Sage Satellite Integration Test';
  }

  getDescription(): string {
    return 'Tests RWA scoring, fundamental analysis, and compliance monitoring';
  }

  async runTests(): Promise<void> {
    await this.runTest('RWA Opportunity Scoring', async () => {
      await this.testRWAScoring();
    });

    await this.runTest('Fundamental Analysis Engine', async () => {
      await this.testFundamentalAnalysis();
    });

    await this.runTest('Compliance Monitoring', async () => {
      await this.testComplianceMonitoring();
    });

    await this.runTest('Perplexity AI Integration', async () => {
      await this.testPerplexityIntegration();
    });

    await this.runTest('Sage-Oracle Integration', async () => {
      await this.testSageOracleIntegration();
    });

    await this.runTest('Batch RWA Processing', async () => {
      await this.testBatchRWAProcessing();
    });

    await this.runTest('Real-time Compliance Alerts', async () => {
      await this.testRealTimeComplianceAlerts();
    });
  }

  private async testRWAScoring(): Promise<void> {
    // Create test RWA asset
    const rwaData = await this.testDataBuilder.create('rwa', {
      type: 'real-estate',
      name: 'Commercial Property Fund A',
      issuer: 'Test RWA Issuer Inc',
      totalValue: 50000000,
      tokenSupply: 50000,
      yield: 8.5,
      rating: 'A'
    });

    // Submit for scoring
    const scoringResponse = await this.makeRequest('sage-satellite', {
      method: 'POST',
      path: '/api/v1/rwa/score',
      body: {
        asset: rwaData.data,
        includeCompliance: true,
        includeRiskAnalysis: true
      }
    });

    this.assert(scoringResponse.status === 200, 'RWA scoring failed');
    this.assert(scoringResponse.body.score >= 0 && scoringResponse.body.score <= 100, 
      'Invalid score range');
    this.assert(scoringResponse.body.breakdown, 'No score breakdown provided');

    // Validate score components
    const breakdown = scoringResponse.body.breakdown;
    this.assert(breakdown.yieldScore !== undefined, 'Missing yield score');
    this.assert(breakdown.riskScore !== undefined, 'Missing risk score');
    this.assert(breakdown.liquidityScore !== undefined, 'Missing liquidity score');
    this.assert(breakdown.complianceScore !== undefined, 'Missing compliance score');

    // Test score updates with changed parameters
    const updatedRWA = { ...rwaData.data, yield: 12.5, rating: 'BBB' };
    const updatedScoreResponse = await this.makeRequest('sage-satellite', {
      method: 'POST',
      path: '/api/v1/rwa/score',
      body: { asset: updatedRWA }
    });

    this.assert(
      updatedScoreResponse.body.score !== scoringResponse.body.score,
      'Score should change with different parameters'
    );
  }

  private async testFundamentalAnalysis(): Promise<void> {
    const rwaData = await this.testDataBuilder.create('rwa', {
      type: 'private-credit',
      name: 'Corporate Debt Fund B',
      issuer: 'Credit Partners LLC',
      totalValue: 100000000,
      documents: [
        { type: 'prospectus', url: 'https://example.com/prospectus.pdf' },
        { type: 'financial-statement', url: 'https://example.com/financials.pdf' }
      ]
    });

    // Request fundamental analysis
    const analysisResponse = await this.makeRequest('sage-satellite', {
      method: 'POST',
      path: '/api/v1/analysis/fundamental',
      body: {
        assetId: rwaData.data.id,
        analysisType: 'comprehensive',
        includeMarketComparison: true,
        includeProjections: true
      }
    });

    this.assert(analysisResponse.status === 200, 'Fundamental analysis failed');
    
    const analysis = analysisResponse.body;
    this.assert(analysis.financialMetrics, 'Missing financial metrics');
    this.assert(analysis.riskFactors, 'Missing risk factors');
    this.assert(analysis.marketPosition, 'Missing market position');
    this.assert(analysis.projections, 'Missing projections');

    // Validate financial metrics
    const metrics = analysis.financialMetrics;
    this.assert(metrics.roi !== undefined, 'Missing ROI');
    this.assert(metrics.irr !== undefined, 'Missing IRR');
    this.assert(metrics.paybackPeriod !== undefined, 'Missing payback period');

    // Test ML model predictions
    this.assert(analysis.mlPredictions, 'Missing ML predictions');
    this.assert(
      analysis.mlPredictions.defaultProbability >= 0 && 
      analysis.mlPredictions.defaultProbability <= 1,
      'Invalid default probability'
    );
  }

  private async testComplianceMonitoring(): Promise<void> {
    // Create compliant RWA
    const compliantRWA = await this.testDataBuilder.create('rwa', {
      compliance: {
        kyc: true,
        aml: true,
        accreditation: true,
        jurisdiction: 'US'
      }
    });

    // Submit for compliance check
    const complianceResponse = await this.makeRequest('sage-satellite', {
      method: 'POST',
      path: '/api/v1/compliance/check',
      body: {
        assetId: compliantRWA.data.id,
        userId: 'test-user-123',
        userJurisdiction: 'US',
        investmentAmount: 50000
      }
    });

    this.assert(complianceResponse.status === 200, 'Compliance check failed');
    this.assert(complianceResponse.body.compliant === true, 'Should be compliant');
    this.assert(complianceResponse.body.requirements.length === 0, 
      'Should have no additional requirements');

    // Test non-compliant scenario
    const nonCompliantResponse = await this.makeRequest('sage-satellite', {
      method: 'POST',
      path: '/api/v1/compliance/check',
      body: {
        assetId: compliantRWA.data.id,
        userId: 'test-user-456',
        userJurisdiction: 'CN', // Different jurisdiction
        investmentAmount: 1000000 // Large amount
      }
    });

    this.assert(
      nonCompliantResponse.body.compliant === false,
      'Should not be compliant for restricted jurisdiction'
    );
    this.assert(
      nonCompliantResponse.body.restrictions.length > 0,
      'Should have restrictions'
    );
  }

  private async testPerplexityIntegration(): Promise<void> {
    // Skip if no API key
    if (!this.context.config.environment.variables.PERPLEXITY_API_KEY) {
      console.log('Skipping Perplexity test - no API key provided');
      return;
    }

    const rwaData = await this.testDataBuilder.create('rwa', {
      name: 'Tokenized Gold Fund',
      type: 'commodity',
      issuer: 'Gold Vault International'
    });

    // Request AI-powered research
    const researchResponse = await this.makeRequest('sage-satellite', {
      method: 'POST',
      path: '/api/v1/research/rwa',
      body: {
        assetId: rwaData.data.id,
        researchQueries: [
          'Market trends for tokenized gold investments',
          'Regulatory landscape for commodity-backed tokens',
          'Competitive analysis of similar RWA offerings'
        ],
        depth: 'detailed'
      }
    });

    this.assert(researchResponse.status === 200, 'Research request failed');
    this.assert(researchResponse.body.insights, 'No insights provided');
    this.assert(researchResponse.body.insights.length > 0, 'Empty insights');

    // Validate research quality
    const insights = researchResponse.body.insights;
    insights.forEach((insight: any) => {
      this.assert(insight.query, 'Missing query in insight');
      this.assert(insight.findings, 'Missing findings');
      this.assert(insight.confidence >= 0 && insight.confidence <= 1, 
        'Invalid confidence score');
      this.assert(insight.sources && insight.sources.length > 0, 
        'Missing sources');
    });
  }

  private async testSageOracleIntegration(): Promise<void> {
    // Test data validation flow between Sage and Oracle
    const rwaData = await this.testDataBuilder.create('rwa', {
      name: 'Infrastructure Bond Token',
      oracleFeeds: ['chainlink-price', 'dia-data'],
      requiresOffChainValidation: true
    });

    // Request Oracle validation through Sage
    const validationResponse = await this.makeRequest('sage-satellite', {
      method: 'POST',
      path: '/api/v1/oracle/validate',
      body: {
        assetId: rwaData.data.id,
        validationType: 'comprehensive',
        oracleEndpoints: [
          'oracle-satellite/api/v1/validate/rwa'
        ]
      }
    });

    this.assert(validationResponse.status === 200, 'Oracle validation failed');
    this.assert(validationResponse.body.validated, 'Asset not validated');
    this.assert(validationResponse.body.oracleData, 'Missing oracle data');

    // Verify Oracle satellite was called
    const oracleCallLog = await this.makeRequest('oracle-satellite', {
      method: 'GET',
      path: `/api/v1/logs/asset/${rwaData.data.id}`
    });

    this.assert(
      oracleCallLog.body.calls.length > 0,
      'Oracle should have been called'
    );
  }

  private async testBatchRWAProcessing(): Promise<void> {
    // Create multiple RWAs
    const rwas = await this.testDataBuilder.createMany('rwa', 10, 
      Array(10).fill(null).map((_, i) => ({
        name: `Batch RWA ${i}`,
        type: i % 2 === 0 ? 'real-estate' : 'private-credit',
        yield: 5 + (i * 0.5),
        rating: ['AAA', 'AA', 'A', 'BBB'][i % 4]
      }))
    );

    // Submit batch for processing
    const batchResponse = await this.makeRequest('sage-satellite', {
      method: 'POST',
      path: '/api/v1/rwa/batch/process',
      body: {
        assets: rwas.map(r => r.data),
        operations: ['score', 'analyze', 'compliance'],
        parallel: true
      }
    });

    this.assert(batchResponse.status === 200, 'Batch processing failed');
    this.assert(
      batchResponse.body.results.length === rwas.length,
      'Result count mismatch'
    );

    // Verify all assets were processed
    batchResponse.body.results.forEach((result: any, index: number) => {
      this.assert(result.assetId === rwas[index].data.id, 'Asset ID mismatch');
      this.assert(result.score !== undefined, 'Missing score');
      this.assert(result.analysis !== undefined, 'Missing analysis');
      this.assert(result.compliance !== undefined, 'Missing compliance');
    });

    // Check processing time
    this.assert(
      batchResponse.body.processingTime < 30000, // Should complete in 30s
      'Batch processing too slow'
    );
  }

  private async testRealTimeComplianceAlerts(): Promise<void> {
    const rwaData = await this.testDataBuilder.create('rwa', {
      name: 'Dynamic Compliance Test Asset',
      compliance: {
        kyc: true,
        aml: true,
        accreditation: true
      }
    });

    // Subscribe to compliance alerts
    const subscriptionResponse = await this.makeRequest('sage-satellite', {
      method: 'POST',
      path: '/api/v1/compliance/alerts/subscribe',
      body: {
        assetId: rwaData.data.id,
        alertTypes: ['regulatory-change', 'compliance-breach', 'document-expiry'],
        webhookUrl: 'http://localhost:3000/webhooks/compliance'
      }
    });

    this.assert(subscriptionResponse.status === 201, 'Alert subscription failed');
    const subscriptionId = subscriptionResponse.body.subscriptionId;

    // Simulate compliance change
    const updateResponse = await this.makeRequest('sage-satellite', {
      method: 'PUT',
      path: `/api/v1/rwa/${rwaData.data.id}/compliance`,
      body: {
        update: {
          jurisdiction: 'EU', // Change jurisdiction
          newRequirements: ['MiFID II']
        }
      }
    });

    this.assert(updateResponse.status === 200, 'Compliance update failed');

    // Check if alert was generated
    await this.wait(2000); // Wait for alert processing

    const alertsResponse = await this.makeRequest('sage-satellite', {
      method: 'GET',
      path: `/api/v1/compliance/alerts/${subscriptionId}`
    });

    this.assert(alertsResponse.body.alerts.length > 0, 'No alerts generated');
    this.assert(
      alertsResponse.body.alerts[0].type === 'regulatory-change',
      'Wrong alert type'
    );
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