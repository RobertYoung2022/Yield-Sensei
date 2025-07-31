/**
 * Test Data Management System - Main Export
 * Comprehensive test data management with generation, validation, and anonymization
 */

// Core test data management
export { TestDataManager, type TestDataConfig, type DatasetMetadata, type DatasetRecord, type GeneratorConfig } from './test-data-manager';

// Data catalog and discovery
export { 
  DataCatalog, 
  type CatalogEntry, 
  type SearchQuery, 
  type SearchResult, 
  type CatalogStats 
} from './data-catalog';

// Synthetic data generators
export { 
  generatorRegistry,
  GeneratorRegistry,
  FinancialDataGenerator,
  UserDataGenerator,
  PortfolioDataGenerator,
  MarketDataGenerator,
  TransactionDataGenerator,
  type DataGeneratorBase
} from './synthetic-data-generators';

// Data anonymization
export { 
  DataAnonymizer,
  type AnonymizationConfig,
  type FieldConfig,
  type AnonymizationRule,
  type AnonymizationResult
} from './data-anonymizer';

// Data validation
export { 
  DataValidator,
  type ValidationRule,
  type ValidationSchema,
  type ValidationError,
  type ValidationResult
} from './data-validator';

// Convenience factory functions
export class TestDataFactory {
  private testDataManager: TestDataManager;
  private dataCatalog: DataCatalog;
  private dataAnonymizer: DataAnonymizer;
  private dataValidator: DataValidator;

  constructor(config: TestDataConfig, catalogPath: string) {
    this.testDataManager = new TestDataManager(config);
    this.dataCatalog = new DataCatalog(catalogPath);
    this.dataAnonymizer = new DataAnonymizer();
    this.dataValidator = new DataValidator();
  }

  async initialize(): Promise<void> {
    await this.testDataManager.initialize();
    await this.dataCatalog.initialize();
    
    // Register all available generators
    this.testDataManager.registerGenerator('financial', generatorRegistry.get('financial')!);
    this.testDataManager.registerGenerator('user', generatorRegistry.get('user')!);
    this.testDataManager.registerGenerator('portfolio', generatorRegistry.get('portfolio')!);
    this.testDataManager.registerGenerator('market', generatorRegistry.get('market')!);
    this.testDataManager.registerGenerator('transaction', generatorRegistry.get('transaction')!);
  }

  getTestDataManager(): TestDataManager {
    return this.testDataManager;
  }

  getDataCatalog(): DataCatalog {
    return this.dataCatalog;
  }

  getDataAnonymizer(): DataAnonymizer {
    return this.dataAnonymizer;
  }

  getDataValidator(): DataValidator {
    return this.dataValidator;
  }

  // Convenience methods for common operations

  async generateAndValidateDataset(
    name: string,
    generatorConfig: GeneratorConfig,
    validationSchema?: ValidationSchema,
    options?: {
      description?: string;
      tags?: string[];
      anonymize?: boolean;
      anonymizationRule?: AnonymizationRule;
    }
  ): Promise<{
    datasetId: string;
    validationResult?: ValidationResult;
    anonymizationResult?: AnonymizationResult;
  }> {
    // Generate dataset
    const datasetId = await this.testDataManager.generateDataset(name, generatorConfig, {
      description: options?.description,
      tags: options?.tags,
    });

    const result: any = { datasetId };

    // Get the generated data for validation/anonymization
    const dataset = await this.testDataManager.getDataset(datasetId);
    if (!dataset) {
      throw new Error(`Failed to retrieve generated dataset: ${datasetId}`);
    }

    let currentData = dataset.data;

    // Validate if schema provided
    if (validationSchema) {
      result.validationResult = await this.dataValidator.validateData(currentData, validationSchema);
    }

    // Anonymize if requested
    if (options?.anonymize && options?.anonymizationRule) {
      const anonymized = await this.dataAnonymizer.anonymizeData(currentData, options.anonymizationRule);
      result.anonymizationResult = anonymized.result;
      
      // Update dataset with anonymized data
      await this.testDataManager.updateDataset(datasetId, {}, anonymized.data);
    }

    return result;
  }

  async searchAndLoadDataset(query: SearchQuery): Promise<DatasetRecord | null> {
    const searchResults = await this.dataCatalog.search(query);
    
    if (searchResults.length === 0) {
      return null;
    }

    // Get the best match
    const bestMatch = searchResults[0];
    if (!bestMatch) {
      return null;
    }

    // Load the dataset
    return await this.testDataManager.getDataset(bestMatch.entry.id);
  }

  async cloneAndModifyDataset(
    sourceDatasetId: string,
    newName: string,
    modifications?: {
      anonymizationRule?: AnonymizationRule;
      validationSchema?: ValidationSchema;
      transformations?: Array<{
        operation: 'filter' | 'map' | 'sort' | 'sample';
        parameters: any;
      }>;
    }
  ): Promise<{
    datasetId: string;
    validationResult?: ValidationResult;
    anonymizationResult?: AnonymizationResult;
  }> {
    // Clone the dataset
    const datasetId = await this.testDataManager.cloneDataset(
      sourceDatasetId,
      newName,
      modifications?.transformations
    );

    const result: any = { datasetId };

    // Apply modifications if requested
    if (modifications?.anonymizationRule || modifications?.validationSchema) {
      const dataset = await this.testDataManager.getDataset(datasetId);
      if (!dataset) {
        throw new Error(`Failed to retrieve cloned dataset: ${datasetId}`);
      }

      let currentData = dataset.data;

      // Anonymize if requested
      if (modifications.anonymizationRule) {
        const anonymized = await this.dataAnonymizer.anonymizeData(currentData, modifications.anonymizationRule);
        result.anonymizationResult = anonymized.result;
        currentData = anonymized.data;
        
        // Update dataset with anonymized data
        await this.testDataManager.updateDataset(datasetId, {}, currentData);
      }

      // Validate if schema provided
      if (modifications.validationSchema) {
        result.validationResult = await this.dataValidator.validateData(currentData, modifications.validationSchema);
      }
    }

    return result;
  }

  async getDatasetStats(): Promise<{
    totalDatasets: number;
    catalogStats: CatalogStats;
    generatorStats: Record<string, number>;
  }> {
    const catalogStats = await this.dataCatalog.getStats();
    const availableGenerators = this.testDataManager.getGenerators();
    
    return {
      totalDatasets: catalogStats.totalDatasets,
      catalogStats,
      generatorStats: Object.fromEntries(
        availableGenerators.map(gen => [gen, 0]) // Would need tracking to get actual usage stats
      ),
    };
  }

  // Predefined dataset creation helpers

  async createFinancialTestDataset(options?: {
    recordCount?: number;
    assetType?: string;
    priceRange?: { min: number; max: number };
    includeValidation?: boolean;
    includeAnonymization?: boolean;
  }): Promise<string> {
    const config: GeneratorConfig = {
      type: 'financial',
      count: options?.recordCount || 1000,
      parameters: {
        assetType: options?.assetType || 'crypto',
        priceRange: options?.priceRange || { min: 0.01, max: 100000 },
      },
    };

    const validationSchema = options?.includeValidation 
      ? DataValidator.getPredefinedSchemas().financialSchema 
      : undefined;

    const anonymizationRule = options?.includeAnonymization 
      ? DataAnonymizer.getPredefinedRules().financialData 
      : undefined;

    const result = await this.generateAndValidateDataset(
      `financial_data_${Date.now()}`,
      config,
      validationSchema,
      {
        description: 'Generated financial test data',
        tags: ['financial', 'test', options?.assetType || 'crypto'],
        anonymize: !!anonymizationRule,
        anonymizationRule,
      }
    );

    return result.datasetId;
  }

  async createUserTestDataset(options?: {
    recordCount?: number;
    domain?: string;
    includeValidation?: boolean;
    includeAnonymization?: boolean;
  }): Promise<string> {
    const config: GeneratorConfig = {
      type: 'user',
      count: options?.recordCount || 500,
      parameters: {
        domain: options?.domain || 'example.com',
      },
    };

    const validationSchema = options?.includeValidation 
      ? DataValidator.getPredefinedSchemas().userSchema 
      : undefined;

    const anonymizationRule = options?.includeAnonymization 
      ? DataAnonymizer.getPredefinedRules().gdprCompliant 
      : undefined;

    const result = await this.generateAndValidateDataset(
      `user_data_${Date.now()}`,
      config,
      validationSchema,
      {
        description: 'Generated user test data',
        tags: ['user', 'test', 'personal'],
        anonymize: !!anonymizationRule,
        anonymizationRule,
      }
    );

    return result.datasetId;
  }

  async createPortfolioTestDataset(options?: {
    recordCount?: number;
    maxPositions?: number;
    includeValidation?: boolean;
  }): Promise<string> {
    const config: GeneratorConfig = {
      type: 'portfolio',
      count: options?.recordCount || 100,
      parameters: {
        maxPositions: options?.maxPositions || 10,
      },
    };

    const validationSchema = options?.includeValidation 
      ? DataValidator.getPredefinedSchemas().portfolioSchema 
      : undefined;

    const result = await this.generateAndValidateDataset(
      `portfolio_data_${Date.now()}`,
      config,
      validationSchema,
      {
        description: 'Generated portfolio test data',
        tags: ['portfolio', 'test', 'investment'],
      }
    );

    return result.datasetId;
  }
}