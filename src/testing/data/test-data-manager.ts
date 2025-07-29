/**
 * Test Data Manager
 * Comprehensive test data management system for generating, storing, and versioning test datasets
 */

import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { Logger } from 'winston';
import { createLogger, format, transports } from 'winston';

export interface TestDataConfig {
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
}

export interface DatasetMetadata {
  id: string;
  name: string;
  description: string;
  version: string;
  created: Date;
  updated: Date;
  schema: any;
  size: number;
  recordCount: number;
  tags: string[];
  dependencies: string[];
  generator: string;
  parameters: Record<string, any>;
  checksum: string;
}

export interface DatasetRecord {
  id: string;
  metadata: DatasetMetadata;
  data: any[];
  filePaths: string[];
}

export interface GeneratorConfig {
  type: string;
  count: number;
  parameters: Record<string, any>;
  constraints?: Record<string, any>;
  relationships?: Array<{
    field: string;
    referencedDataset: string;
    referencedField: string;
    cardinality: 'one-to-one' | 'one-to-many' | 'many-to-many';
  }>;
}

export class TestDataManager {
  private logger: Logger;
  private config: TestDataConfig;
  private datasets: Map<string, DatasetRecord> = new Map();
  private generators: Map<string, any> = new Map();

  constructor(config: TestDataConfig) {
    this.config = config;
    this.logger = createLogger({
      level: 'info',
      format: format.combine(
        format.timestamp(),
        format.simple()
      ),
      transports: [
        new transports.Console(),
        new transports.File({ filename: 'logs/test-data-manager.log' })
      ],
    });
  }

  async initialize(): Promise<void> {
    this.logger.info('Initializing Test Data Manager');
    
    // Ensure output directory exists
    await this.ensureDirectoryExists(this.config.outputDir);
    await this.ensureDirectoryExists(path.join(this.config.outputDir, 'datasets'));
    await this.ensureDirectoryExists(path.join(this.config.outputDir, 'metadata'));
    await this.ensureDirectoryExists(path.join(this.config.outputDir, 'schemas'));
    
    // Load existing datasets
    await this.loadExistingDatasets();
    
    this.logger.info(`Test Data Manager initialized with ${this.datasets.size} existing datasets`);
  }

  async generateDataset(
    name: string,
    generatorConfig: GeneratorConfig,
    options: {
      description?: string;
      tags?: string[];
      overwrite?: boolean;
    } = {}
  ): Promise<string> {
    this.logger.info(`Generating dataset: ${name}`);

    // Check if dataset exists
    const existingId = this.findDatasetByName(name);
    if (existingId && !options.overwrite) {
      throw new Error(`Dataset ${name} already exists. Use overwrite option to replace.`);
    }

    // Generate unique ID
    const datasetId = this.generateDatasetId(name);
    
    // Get generator
    const generator = this.getGenerator(generatorConfig.type);
    if (!generator) {
      throw new Error(`Unknown generator type: ${generatorConfig.type}`);
    }

    // Generate data
    const data = await generator.generate(generatorConfig);
    
    // Create metadata
    const metadata: DatasetMetadata = {
      id: datasetId,
      name,
      description: options.description || `Generated dataset: ${name}`,
      version: this.generateVersion(),
      created: new Date(),
      updated: new Date(),
      schema: generator.getSchema(generatorConfig),
      size: this.calculateDataSize(data),
      recordCount: Array.isArray(data) ? data.length : 1,
      tags: options.tags || [],
      dependencies: this.extractDependencies(generatorConfig),
      generator: generatorConfig.type,
      parameters: generatorConfig.parameters,
      checksum: this.calculateChecksum(data),
    };

    // Apply anonymization if enabled
    const processedData = this.config.anonymization.enabled 
      ? await this.anonymizeData(data, metadata) 
      : data;

    // Validate data if enabled
    if (this.config.validation.enabled) {
      await this.validateData(processedData, metadata);
    }

    // Save dataset
    const filePaths = await this.saveDataset(datasetId, processedData, metadata);

    // Store in memory
    const record: DatasetRecord = {
      id: datasetId,
      metadata,
      data: processedData,
      filePaths,
    };
    this.datasets.set(datasetId, record);

    this.logger.info(`Dataset ${name} generated successfully with ID: ${datasetId}`);
    return datasetId;
  }

  async getDataset(identifier: string): Promise<DatasetRecord | null> {
    // Try by ID first
    let record = this.datasets.get(identifier);
    
    // Try by name if not found by ID
    if (!record) {
      const id = this.findDatasetByName(identifier);
      if (id) {
        record = this.datasets.get(id);
      }
    }

    // Load from disk if not in memory
    if (!record) {
      record = await this.loadDatasetFromDisk(identifier);
    }

    return record || null;
  }

  async updateDataset(
    identifier: string,
    updates: Partial<DatasetMetadata>,
    newData?: any[]
  ): Promise<void> {
    const record = await this.getDataset(identifier);
    if (!record) {
      throw new Error(`Dataset not found: ${identifier}`);
    }

    // Update metadata
    const updatedMetadata: DatasetMetadata = {
      ...record.metadata,
      ...updates,
      updated: new Date(),
      version: this.incrementVersion(record.metadata.version),
    };

    // Update data if provided
    const updatedData = newData || record.data;
    
    // Recalculate derived fields
    updatedMetadata.size = this.calculateDataSize(updatedData);
    updatedMetadata.recordCount = Array.isArray(updatedData) ? updatedData.length : 1;
    updatedMetadata.checksum = this.calculateChecksum(updatedData);

    // Apply anonymization if enabled
    const processedData = this.config.anonymization.enabled 
      ? await this.anonymizeData(updatedData, updatedMetadata) 
      : updatedData;

    // Save updated dataset
    const filePaths = await this.saveDataset(record.id, processedData, updatedMetadata);

    // Update in memory
    this.datasets.set(record.id, {
      id: record.id,
      metadata: updatedMetadata,
      data: processedData,
      filePaths,
    });

    this.logger.info(`Dataset ${identifier} updated successfully`);
  }

  async deleteDataset(identifier: string, removeFiles: boolean = true): Promise<void> {
    const record = await this.getDataset(identifier);
    if (!record) {
      throw new Error(`Dataset not found: ${identifier}`);
    }

    // Remove from memory
    this.datasets.delete(record.id);

    // Remove files if requested
    if (removeFiles) {
      for (const filePath of record.filePaths) {
        try {
          await fs.unlink(filePath);
        } catch (error) {
          this.logger.warn(`Failed to delete file: ${filePath}`, error);
        }
      }
    }

    this.logger.info(`Dataset ${identifier} deleted successfully`);
  }

  async listDatasets(filters?: {
    tags?: string[];
    generator?: string;
    namePattern?: RegExp;
  }): Promise<DatasetMetadata[]> {
    let datasets = Array.from(this.datasets.values()).map(r => r.metadata);

    if (filters) {
      if (filters.tags) {
        datasets = datasets.filter(d => 
          filters.tags!.some(tag => d.tags.includes(tag))
        );
      }

      if (filters.generator) {
        datasets = datasets.filter(d => d.generator === filters.generator);
      }

      if (filters.namePattern) {
        datasets = datasets.filter(d => filters.namePattern!.test(d.name));
      }
    }

    return datasets.sort((a, b) => b.updated.getTime() - a.updated.getTime());
  }

  async cloneDataset(
    sourceIdentifier: string,
    newName: string,
    transformations?: Array<{
      operation: 'filter' | 'map' | 'sort' | 'sample';
      parameters: any;
    }>
  ): Promise<string> {
    const sourceRecord = await this.getDataset(sourceIdentifier);
    if (!sourceRecord) {
      throw new Error(`Source dataset not found: ${sourceIdentifier}`);
    }

    let clonedData = JSON.parse(JSON.stringify(sourceRecord.data));

    // Apply transformations if provided
    if (transformations) {
      for (const transformation of transformations) {
        clonedData = await this.applyTransformation(clonedData, transformation);
      }
    }

    // Generate new dataset
    const newId = this.generateDatasetId(newName);
    const metadata: DatasetMetadata = {
      ...sourceRecord.metadata,
      id: newId,
      name: newName,
      version: '1.0.0',
      created: new Date(),
      updated: new Date(),
      size: this.calculateDataSize(clonedData),
      recordCount: Array.isArray(clonedData) ? clonedData.length : 1,
      checksum: this.calculateChecksum(clonedData),
      dependencies: [...sourceRecord.metadata.dependencies, sourceRecord.id],
    };

    // Save cloned dataset
    const filePaths = await this.saveDataset(newId, clonedData, metadata);

    // Store in memory
    this.datasets.set(newId, {
      id: newId,
      metadata,
      data: clonedData,
      filePaths,
    });

    this.logger.info(`Dataset cloned from ${sourceIdentifier} to ${newName} with ID: ${newId}`);
    return newId;
  }

  async validateDatasetIntegrity(identifier: string): Promise<{
    valid: boolean;
    issues: string[];
  }> {
    const record = await this.getDataset(identifier);
    if (!record) {
      throw new Error(`Dataset not found: ${identifier}`);
    }

    const issues: string[] = [];

    // Check checksum
    const currentChecksum = this.calculateChecksum(record.data);
    if (currentChecksum !== record.metadata.checksum) {
      issues.push('Data checksum mismatch - data may have been corrupted');
    }

    // Check file existence
    for (const filePath of record.filePaths) {
      try {
        await fs.access(filePath);
      } catch {
        issues.push(`File not found: ${filePath}`);
      }
    }

    // Validate against schema if available
    if (this.config.validation.enabled && record.metadata.schema) {
      try {
        await this.validateData(record.data, record.metadata);
      } catch (error) {
        issues.push(`Schema validation failed: ${(error as Error).message}`);
      }
    }

    // Check dependencies
    for (const depId of record.metadata.dependencies) {
      const dep = await this.getDataset(depId);
      if (!dep) {
        issues.push(`Missing dependency: ${depId}`);
      }
    }

    return {
      valid: issues.length === 0,
      issues,
    };
  }

  registerGenerator(name: string, generator: any): void {
    this.generators.set(name, generator);
    this.logger.info(`Registered data generator: ${name}`);
  }

  getGenerators(): string[] {
    return Array.from(this.generators.keys());
  }

  // Private helper methods

  private async loadExistingDatasets(): Promise<void> {
    try {
      const metadataDir = path.join(this.config.outputDir, 'metadata');
      const files = await fs.readdir(metadataDir);
      
      for (const file of files) {
        if (file.endsWith('.json')) {
          try {
            const metadataPath = path.join(metadataDir, file);
            const metadataContent = await fs.readFile(metadataPath, 'utf-8');
            const metadata: DatasetMetadata = JSON.parse(metadataContent);
            
            // Load data files
            const datasetDir = path.join(this.config.outputDir, 'datasets', metadata.id);
            const dataFiles = await fs.readdir(datasetDir);
            const filePaths = dataFiles.map(f => path.join(datasetDir, f));
            
            // Load data (lazy loading can be implemented later)
            const data = await this.loadDataFromFiles(filePaths);
            
            this.datasets.set(metadata.id, {
              id: metadata.id,
              metadata,
              data,
              filePaths,
            });
          } catch (error) {
            this.logger.warn(`Failed to load dataset from ${file}:`, error);
          }
        }
      }
    } catch (error) {
      this.logger.warn('No existing datasets found or error loading them:', error);
    }
  }

  private async loadDatasetFromDisk(identifier: string): Promise<DatasetRecord | null> {
    // Implementation for loading specific dataset from disk
    // This would be used for lazy loading or when dataset is not in memory
    return null;
  }

  private async loadDataFromFiles(filePaths: string[]): Promise<any[]> {
    // Load data from the first JSON file found
    for (const filePath of filePaths) {
      if (filePath.endsWith('.json')) {
        try {
          const content = await fs.readFile(filePath, 'utf-8');
          return JSON.parse(content);
        } catch (error) {
          this.logger.warn(`Failed to load data from ${filePath}:`, error);
        }
      }
    }
    return [];
  }

  private async saveDataset(
    id: string,
    data: any[],
    metadata: DatasetMetadata
  ): Promise<string[]> {
    const filePaths: string[] = [];
    const datasetDir = path.join(this.config.outputDir, 'datasets', id);
    await this.ensureDirectoryExists(datasetDir);

    // Save in requested formats
    for (const format of this.config.dataFormats) {
      const filePath = await this.saveDataInFormat(datasetDir, data, format, id);
      filePaths.push(filePath);
    }

    // Save metadata
    const metadataPath = path.join(this.config.outputDir, 'metadata', `${id}.json`);
    await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2), 'utf-8');
    filePaths.push(metadataPath);

    return filePaths;
  }

  private async saveDataInFormat(
    dir: string,
    data: any[],
    format: 'json' | 'csv' | 'sql',
    id: string
  ): Promise<string> {
    const filePath = path.join(dir, `${id}.${format}`);

    switch (format) {
      case 'json':
        await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
        break;
      case 'csv':
        const csv = this.convertToCSV(data);
        await fs.writeFile(filePath, csv, 'utf-8');
        break;
      case 'sql':
        const sql = this.convertToSQL(data, id);
        await fs.writeFile(filePath, sql, 'utf-8');
        break;
    }

    return filePath;
  }

  private convertToCSV(data: any[]): string {
    if (!Array.isArray(data) || data.length === 0) return '';
    
    const headers = Object.keys(data[0] || {});
    const csvHeaders = headers.join(',');
    const csvRows = data.map(row => 
      headers.map(header => {
        const value = row[header];
        // Escape quotes and wrap in quotes if contains comma or quote
        if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      }).join(',')
    );
    
    return [csvHeaders, ...csvRows].join('\n');
  }

  private convertToSQL(data: any[], tableName: string): string {
    if (!Array.isArray(data) || data.length === 0) return '';
    
    const headers = Object.keys(data[0] || {});
    const createTable = `CREATE TABLE IF NOT EXISTS ${tableName} (\n${headers.map(h => `  ${h} TEXT`).join(',\n')}\n);\n\n`;
    
    const insertStatements = data.map(row => {
      const values = headers.map(header => {
        const value = row[header];
        if (value === null || value === undefined) return 'NULL';
        if (typeof value === 'string') return `'${value.replace(/'/g, "''")}'`;
        return value;
      }).join(', ');
      return `INSERT INTO ${tableName} (${headers.join(', ')}) VALUES (${values});`;
    }).join('\n');
    
    return createTable + insertStatements;
  }

  private async anonymizeData(data: any[], metadata: DatasetMetadata): Promise<any[]> {
    // Simple anonymization implementation
    // In a real system, this would be more sophisticated
    const fieldsToAnonymize = this.config.anonymization.fields;
    
    return data.map(record => {
      const anonymized = { ...record };
      
      for (const field of fieldsToAnonymize) {
        if (field in anonymized) {
          switch (this.config.anonymization.strategy) {
            case 'mask':
              anonymized[field] = this.maskValue(anonymized[field]);
              break;
            case 'hash':
              anonymized[field] = this.hashValue(anonymized[field]);
              break;
            case 'fake':
              anonymized[field] = this.generateFakeValue(field);
              break;
          }
        }
      }
      
      return anonymized;
    });
  }

  private async validateData(data: any[], metadata: DatasetMetadata): Promise<void> {
    // Simple validation implementation
    // In a real system, this would use JSON Schema or similar
    if (!Array.isArray(data)) {
      throw new Error('Data must be an array');
    }
    
    // Validate each record against schema if available
    if (metadata.schema && metadata.schema.properties) {
      for (const record of data) {
        for (const [field, schema] of Object.entries(metadata.schema.properties)) {
          if ((schema as any).required && !(field in record)) {
            throw new Error(`Required field missing: ${field}`);
          }
        }
      }
    }
  }

  private async applyTransformation(
    data: any[],
    transformation: { operation: string; parameters: any }
  ): Promise<any[]> {
    switch (transformation.operation) {
      case 'filter':
        return data.filter(transformation.parameters);
      case 'map':
        return data.map(transformation.parameters);
      case 'sort':
        return data.sort(transformation.parameters);
      case 'sample':
        const sampleSize = Math.min(transformation.parameters.size || 100, data.length);
        const shuffled = [...data].sort(() => 0.5 - Math.random());
        return shuffled.slice(0, sampleSize);
      default:
        return data;
    }
  }

  private generateDatasetId(name: string): string {
    const timestamp = Date.now();
    const hash = crypto.createHash('md5').update(name + timestamp).digest('hex').substring(0, 8);
    return `${name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${hash}`;
  }

  private generateVersion(): string {
    if (this.config.versioning.strategy === 'timestamp') {
      return new Date().toISOString();
    }
    return '1.0.0'; // Default semantic version
  }

  private incrementVersion(currentVersion: string): string {
    if (this.config.versioning.strategy === 'timestamp') {
      return new Date().toISOString();
    }
    
    // Simple semantic version increment
    const parts = currentVersion.split('.');
    const patch = parseInt(parts[2] || '0') + 1;
    return `${parts[0] || '1'}.${parts[1] || '0'}.${patch}`;
  }

  private findDatasetByName(name: string): string | null {
    for (const [id, record] of this.datasets) {
      if (record.metadata.name === name) {
        return id;
      }
    }
    return null;
  }

  private getGenerator(type: string): any {
    return this.generators.get(type);
  }

  private extractDependencies(config: GeneratorConfig): string[] {
    const dependencies: string[] = [];
    
    if (config.relationships) {
      for (const rel of config.relationships) {
        dependencies.push(rel.referencedDataset);
      }
    }
    
    return dependencies;
  }

  private calculateDataSize(data: any): number {
    return JSON.stringify(data).length;
  }

  private calculateChecksum(data: any): string {
    return crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');
  }

  private maskValue(value: any): string {
    if (typeof value === 'string') {
      return value.replace(/./g, '*');
    }
    return '***';
  }

  private hashValue(value: any): string {
    return crypto.createHash('sha256').update(String(value)).digest('hex').substring(0, 16);
  }

  private generateFakeValue(fieldName: string): string {
    // Simple fake data generation based on field name
    const lowerField = fieldName.toLowerCase();
    
    if (lowerField.includes('email')) {
      return `fake_${Math.random().toString(36).substring(7)}@example.com`;
    }
    if (lowerField.includes('name')) {
      return `Fake Name ${Math.floor(Math.random() * 1000)}`;
    }
    if (lowerField.includes('phone')) {
      return `555-${Math.floor(Math.random() * 900) + 100}-${Math.floor(Math.random() * 9000) + 1000}`;
    }
    
    return `fake_${Math.random().toString(36).substring(7)}`;
  }

  private async ensureDirectoryExists(dir: string): Promise<void> {
    try {
      await fs.access(dir);
    } catch {
      await fs.mkdir(dir, { recursive: true });
    }
  }
}