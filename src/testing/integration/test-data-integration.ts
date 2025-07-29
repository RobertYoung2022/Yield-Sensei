/**
 * Test Data Integration
 * Integration layer between test data management system and existing testing infrastructure
 */

import { TestDataFactory } from '../data';
import { UnitTestFramework } from '../unit/unit-test-framework';
import { TestFixtures, CommonFixtureSets } from '../unit/test-fixtures';
import { CoreTestingInfrastructure } from '../infrastructure/core-testing-infrastructure';
import { PerformanceTestingFramework } from '../performance/performance-testing-framework';
import { Logger } from 'winston';
import { createLogger, format, transports } from 'winston';

export interface TestDataIntegrationConfig {
  testDataConfig: {
    outputDir: string;
    dataFormats: ('json' | 'csv' | 'sql')[];
    versioning: {
      enabled: boolean;
      maxVersions: number;
      strategy: 'timestamp' | 'semantic' | 'hash';
    };
    anonymization: {
      enabled: boolean;
      fields: string[];
      strategy: 'mask' | 'hash' | 'fake';
    };
    validation: {
      enabled: boolean;
      schemas: Record<string, any>;
    };
  };
  catalogPath: string;
  integrationMode: 'unit' | 'integration' | 'performance' | 'all';
  autoCleanup: boolean;
  cacheDatasets: boolean;
  maxCacheSize: number; // MB
}

export interface TestDataContext {
  datasetId: string;
  dataType: string;
  recordCount: number;
  tags: string[];
  metadata: Record<string, any>;
  validationResult?: any;
  anonymizationApplied: boolean;
}

export class TestDataIntegration {
  private logger: Logger;
  private config: TestDataIntegrationConfig;
  private dataFactory: TestDataFactory;
  private unitFramework: UnitTestFramework;
  private coreInfrastructure: CoreTestingInfrastructure;
  private performanceFramework: PerformanceTestingFramework;
  
  // Test data cache
  private datasetCache: Map<string, { data: any[]; timestamp: number; size: number }> = new Map();
  private currentCacheSize = 0; // in bytes
  
  // Active test contexts
  private activeContexts: Map<string, TestDataContext> = new Map();

  constructor(config: TestDataIntegrationConfig) {
    this.config = config;
    this.logger = createLogger({
      level: 'info',
      format: format.combine(
        format.timestamp(),
        format.simple()
      ),
      transports: [
        new transports.Console(),
        new transports.File({ filename: 'logs/test-data-integration.log' })
      ],
    });
  }

  async initialize(): Promise<void> {
    this.logger.info('Initializing Test Data Integration');

    // Initialize data factory
    this.dataFactory = new TestDataFactory(
      this.config.testDataConfig,
      this.config.catalogPath
    );
    await this.dataFactory.initialize();

    // Initialize testing frameworks based on mode
    if (this.config.integrationMode === 'unit' || this.config.integrationMode === 'all') {
      this.unitFramework = new UnitTestFramework({
        isolationLevel: 'complete',
        autoMock: true,
        mockExternal: true,
        coverageThreshold: 80,
      });
    }

    if (this.config.integrationMode === 'integration' || this.config.integrationMode === 'all') {
      this.coreInfrastructure = new CoreTestingInfrastructure({
        timeout: 30000,
        retries: 2,
        parallel: true,
        coverage: true,
        environment: 'integration',
      });
    }

    if (this.config.integrationMode === 'performance' || this.config.integrationMode === 'all') {
      this.performanceFramework = new PerformanceTestingFramework();
    }

    this.logger.info('Test Data Integration initialized successfully');
  }

  // Dataset management with caching
  async getOrCreateDataset(
    name: string,
    type: 'financial' | 'user' | 'portfolio' | 'market' | 'transaction',
    options?: {
      recordCount?: number;
      useCache?: boolean;
      parameters?: Record<string, any>;
      tags?: string[];
    }
  ): Promise<{ datasetId: string; data: any[]; context: TestDataContext }> {
    const cacheKey = `${name}_${type}_${options?.recordCount || 1000}`;
    
    // Check cache first
    if (options?.useCache !== false && this.datasetCache.has(cacheKey)) {
      const cached = this.datasetCache.get(cacheKey)!;
      this.logger.info(`Using cached dataset: ${cacheKey}`);
      
      // Create context for cached data
      const context: TestDataContext = {
        datasetId: `cached_${cacheKey}`,
        dataType: type,
        recordCount: cached.data.length,
        tags: options?.tags || ['cached', type],
        metadata: { cached: true, cacheTimestamp: cached.timestamp },
        anonymizationApplied: false,
      };
      
      return { datasetId: context.datasetId, data: cached.data, context };
    }

    // Create new dataset
    const datasetId = await this.createDatasetByType(type, name, options);
    const dataset = await this.dataFactory.getTestDataManager().getDataset(datasetId);
    
    if (!dataset) {
      throw new Error(`Failed to retrieve created dataset: ${datasetId}`);
    }

    // Cache if enabled
    if (this.config.cacheDatasets && options?.useCache !== false) {
      await this.cacheDataset(cacheKey, dataset.data);
    }

    // Create context
    const context: TestDataContext = {
      datasetId,
      dataType: type,
      recordCount: dataset.data.length,
      tags: options?.tags || [type, 'generated'],
      metadata: dataset.metadata,
      anonymizationApplied: false,
    };

    this.activeContexts.set(datasetId, context);
    
    return { datasetId, data: dataset.data, context };
  }

  // Integration with unit testing framework
  async setupUnitTestData(
    testSuiteName: string,
    dataRequirements: Array<{
      name: string;
      type: 'financial' | 'user' | 'portfolio' | 'market' | 'transaction';
      count?: number;
      options?: Record<string, any>;
    }>
  ): Promise<Record<string, any[]>> {
    if (!this.unitFramework) {
      throw new Error('Unit testing framework not initialized');
    }

    this.logger.info(`Setting up unit test data for: ${testSuiteName}`);
    const testData: Record<string, any[]> = {};

    for (const requirement of dataRequirements) {
      const { datasetId, data } = await this.getOrCreateDataset(
        `${testSuiteName}_${requirement.name}`,
        requirement.type,
        {
          recordCount: requirement.count || 100,
          useCache: true,
          parameters: requirement.options,
          tags: ['unit-test', testSuiteName, requirement.type],
        }
      );

      testData[requirement.name] = data;
      
      // Create mocks for external data dependencies
      this.setupMocksForDataType(requirement.type);
    }

    return testData;
  }

  // Integration with performance testing
  async setupPerformanceTestData(
    testName: string,
    loadProfile: {
      baseLoad: number;
      peakLoad: number;
      dataTypes: Array<{
        type: 'financial' | 'user' | 'portfolio' | 'market' | 'transaction';
        ratio: number; // Percentage of total load
      }>;
    }
  ): Promise<{
    datasets: Record<string, string>; // datasetId by type
    loadData: any[];
  }> {
    if (!this.performanceFramework) {
      throw new Error('Performance testing framework not initialized');
    }

    this.logger.info(`Setting up performance test data for: ${testName}`);
    const datasets: Record<string, string> = {};
    const allLoadData: any[] = [];

    for (const dataType of loadProfile.dataTypes) {
      const recordCount = Math.ceil(loadProfile.peakLoad * (dataType.ratio / 100));
      
      const { datasetId, data } = await this.getOrCreateDataset(
        `${testName}_${dataType.type}_load`,
        dataType.type,
        {
          recordCount,
          useCache: false, // Don't cache large performance datasets
          tags: ['performance-test', testName, dataType.type],
        }
      );

      datasets[dataType.type] = datasetId;
      allLoadData.push(...data);
    }

    return { datasets, loadData: allLoadData };
  }

  // Data anonymization for testing
  async anonymizeTestData(
    datasetId: string,
    ruleName?: string
  ): Promise<{ anonymizedDatasetId: string; context: TestDataContext }> {
    const anonymizer = this.dataFactory.getDataAnonymizer();
    const originalDataset = await this.dataFactory.getTestDataManager().getDataset(datasetId);
    
    if (!originalDataset) {
      throw new Error(`Dataset not found: ${datasetId}`);
    }

    // Use predefined rule or default
    const predefinedRules = await import('../data/data-anonymizer').then(m => m.DataAnonymizer.getPredefinedRules());
    const rule = ruleName ? predefinedRules[ruleName] : predefinedRules.testingOptimized;
    
    if (!rule) {
      throw new Error(`Anonymization rule not found: ${ruleName}`);
    }

    const { data: anonymizedData, result } = await anonymizer.anonymizeData(originalDataset.data, rule);
    
    // Create new dataset with anonymized data
    const anonymizedDatasetId = `${datasetId}_anonymized`;
    await this.dataFactory.getTestDataManager().updateDataset(
      originalDataset.id,
      { 
        name: `${originalDataset.metadata.name}_anonymized`,
        tags: [...originalDataset.metadata.tags, 'anonymized'],
      },
      anonymizedData
    );

    // Update context
    const context = this.activeContexts.get(datasetId);
    if (context) {
      context.anonymizationApplied = true;
      context.metadata.anonymizationResult = result;
      this.activeContexts.set(anonymizedDatasetId, context);
    }

    this.logger.info(`Anonymized dataset ${datasetId} -> ${anonymizedDatasetId}`);
    
    return { 
      anonymizedDatasetId, 
      context: context || {
        datasetId: anonymizedDatasetId,
        dataType: 'unknown',
        recordCount: anonymizedData.length,
        tags: ['anonymized'],
        metadata: { anonymizationResult: result },
        anonymizationApplied: true,
      }
    };
  }

  // Data validation for test datasets
  async validateTestData(
    datasetId: string,
    schemaName?: string
  ): Promise<{ valid: boolean; result: any }> {
    const validator = this.dataFactory.getDataValidator();
    const dataset = await this.dataFactory.getTestDataManager().getDataset(datasetId);
    
    if (!dataset) {
      throw new Error(`Dataset not found: ${datasetId}`);
    }

    // Use predefined schema or infer from data type
    const predefinedSchemas = await import('../data/data-validator').then(m => m.DataValidator.getPredefinedSchemas());
    const context = this.activeContexts.get(datasetId);
    const dataType = context?.dataType || 'unknown';
    
    let schema = predefinedSchemas[schemaName || `${dataType}Schema`];
    if (!schema) {
      // Use a generic schema
      schema = predefinedSchemas.userSchema; // Fallback
    }

    const result = await validator.validateData(dataset.data, schema);
    
    // Update context with validation result
    if (context) {
      context.validationResult = result;
      this.activeContexts.set(datasetId, context);
    }

    this.logger.info(`Validated dataset ${datasetId}: ${result.valid ? 'PASSED' : 'FAILED'}`);
    
    return { valid: result.valid, result };
  }

  // Test fixture integration
  createTestFixtures(
    type: 'user' | 'portfolio' | 'transaction' | 'market' | 'risk' | 'opportunity',
    count: number = 1,
    overrides: Record<string, any> = {}
  ): any[] {
    this.logger.info(`Creating ${count} ${type} test fixtures`);

    switch (type) {
      case 'user':
        return count === 1 
          ? [TestFixtures.createUser(overrides)]
          : TestFixtures.createMultipleUsers(count, overrides);
      
      case 'portfolio':
        return Array.from({ length: count }, () => 
          overrides.withPositions 
            ? TestFixtures.createPortfolioWithPositions(overrides.positionCount || 3, overrides)
            : TestFixtures.createPortfolio(overrides)
        );
      
      case 'transaction':
        return Array.from({ length: count }, () => TestFixtures.createTransaction(overrides));
      
      case 'market':
        return Array.from({ length: count }, () => TestFixtures.createMarketData(overrides));
      
      case 'risk':
        return Array.from({ length: count }, () => TestFixtures.createRiskAssessment(overrides));
      
      case 'opportunity':
        return Array.from({ length: count }, () => TestFixtures.createOpportunity(overrides));
      
      default:
        throw new Error(`Unknown fixture type: ${type}`);
    }
  }

  // Pre-configured test scenarios
  async getTestScenario(
    scenarioName: 'basicUserWithPortfolio' | 'multiChainPortfolio' | 'yieldFarmingScenario' | 'riskAnalysisScenario'
  ): Promise<any> {
    this.logger.info(`Loading test scenario: ${scenarioName}`);
    
    switch (scenarioName) {
      case 'basicUserWithPortfolio':
        return CommonFixtureSets.basicUserWithPortfolio();
      case 'multiChainPortfolio':
        return CommonFixtureSets.multiChainPortfolio();
      case 'yieldFarmingScenario':
        return CommonFixtureSets.yieldFarmingScenario();
      case 'riskAnalysisScenario':
        return CommonFixtureSets.riskAnalysisScenario();
      default:
        throw new Error(`Unknown test scenario: ${scenarioName}`);
    }
  }

  // Cleanup and resource management
  async cleanup(datasetIds?: string[]): Promise<void> {
    if (!this.config.autoCleanup && !datasetIds) {
      return;
    }

    const idsToCleanup = datasetIds || Array.from(this.activeContexts.keys());
    
    this.logger.info(`Cleaning up ${idsToCleanup.length} test datasets`);

    for (const datasetId of idsToCleanup) {
      try {
        // Remove from active contexts
        this.activeContexts.delete(datasetId);
        
        // Remove from cache if present
        for (const [cacheKey, cached] of this.datasetCache) {
          if (cacheKey.includes(datasetId)) {
            this.currentCacheSize -= cached.size;
            this.datasetCache.delete(cacheKey);
          }
        }
        
        // Delete dataset if it's not a fixture
        if (!datasetId.startsWith('cached_') && !datasetId.startsWith('fixture_')) {
          await this.dataFactory.getTestDataManager().deleteDataset(datasetId, true);
        }
      } catch (error) {
        this.logger.warn(`Failed to cleanup dataset ${datasetId}:`, error);
      }
    }
  }

  // Statistics and monitoring
  getStatistics(): {
    activeDatasets: number;
    cachedDatasets: number;
    cacheSize: number;
    totalDatasetsCreated: number;
  } {
    return {
      activeDatasets: this.activeContexts.size,
      cachedDatasets: this.datasetCache.size,
      cacheSize: this.currentCacheSize,
      totalDatasetsCreated: this.activeContexts.size, // Simplified
    };
  }

  // Private helper methods

  private async createDatasetByType(
    type: 'financial' | 'user' | 'portfolio' | 'market' | 'transaction',
    name: string,
    options?: {
      recordCount?: number;
      parameters?: Record<string, any>;
      tags?: string[];
    }
  ): Promise<string> {
    const count = options?.recordCount || 1000;
    const parameters = options?.parameters || {};
    
    switch (type) {
      case 'financial':
        return await this.dataFactory.createFinancialTestDataset({
          recordCount: count,
          assetType: parameters.assetType || 'crypto',
          priceRange: parameters.priceRange,
          includeValidation: parameters.includeValidation !== false,
          includeAnonymization: parameters.includeAnonymization === true,
        });
      
      case 'user':
        return await this.dataFactory.createUserTestDataset({
          recordCount: count,
          domain: parameters.domain || 'example.com',
          includeValidation: parameters.includeValidation !== false,
          includeAnonymization: parameters.includeAnonymization === true,
        });
      
      case 'portfolio':
        return await this.dataFactory.createPortfolioTestDataset({
          recordCount: count,
          maxPositions: parameters.maxPositions || 10,
          includeValidation: parameters.includeValidation !== false,
        });
      
      default:
        // Use generic generator
        const generatorConfig = {
          type,
          count,
          parameters,
        };
        
        return await this.dataFactory.getTestDataManager().generateDataset(name, generatorConfig, {
          tags: options?.tags || [type],
        });
    }
  }

  private setupMocksForDataType(dataType: string): void {
    if (!this.unitFramework) return;

    switch (dataType) {
      case 'financial':
        this.unitFramework.createMock('priceService', {
          mockType: 'class',
          implementation: () => ({
            getPrice: () => Promise.resolve(1000.50),
            getPriceHistory: () => Promise.resolve([]),
          }),
        });
        break;
      
      case 'user':
        this.unitFramework.createMock('userService', {
          mockType: 'class',
          implementation: () => ({
            authenticate: () => Promise.resolve(true),
            getProfile: () => Promise.resolve({}),
          }),
        });
        break;
      
      case 'portfolio':
        this.unitFramework.createMock('portfolioService', {
          mockType: 'class',
          implementation: () => ({
            calculateValue: () => Promise.resolve(10000),
            rebalance: () => Promise.resolve(),
          }),
        });
        break;
    }
  }

  private async cacheDataset(key: string, data: any[]): Promise<void> {
    const size = JSON.stringify(data).length;
    const maxSizeBytes = this.config.maxCacheSize * 1024 * 1024; // Convert MB to bytes
    
    // Check if we need to evict old entries
    while (this.currentCacheSize + size > maxSizeBytes && this.datasetCache.size > 0) {
      const oldestKey = Array.from(this.datasetCache.keys())[0];
      if (oldestKey) {
        const oldCached = this.datasetCache.get(oldestKey)!;
        this.currentCacheSize -= oldCached.size;
        this.datasetCache.delete(oldestKey);
      }
    }
    
    // Add to cache if it fits
    if (size <= maxSizeBytes) {
      this.datasetCache.set(key, {
        data,
        timestamp: Date.now(),
        size,
      });
      this.currentCacheSize += size;
    }
  }
}