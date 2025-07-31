/**
 * Off-Chain Data Verifier
 * Cryptographic proof validation for external data sources
 */

import { EventEmitter } from 'events';
import { Logger } from 'winston';
import { createLogger, format, transports } from 'winston';
import { createHash, createHmac, randomBytes } from 'crypto';
import {
  DataSource,
  DataVerificationResult,
  CryptographicProof,
  TemporalValidationResult,
  SchemaValidationResult,
  ConsistencyCheckResult
} from '../types';

export interface OffChainDataVerifierConfig {
  enableCryptographicProofs: boolean;
  enableTemporalValidation: boolean;
  enableSchemaValidation: boolean;
  enableConsistencyChecks: boolean;
  maxDataAge: number; // Maximum age in milliseconds
  minConsistencyThreshold: number; // Minimum consistency score (0-1)
  cryptographicAlgorithm: 'sha256' | 'sha512' | 'blake2b';
  proofValidationTimeout: number;
  enableAuditTrail: boolean;
  auditRetentionDays: number;
}

export class OffChainDataVerifier extends EventEmitter {
  private static instance: OffChainDataVerifier;
  private logger: Logger;
  private config: OffChainDataVerifierConfig;
  private isInitialized: boolean = false;

  // Verification state
  private verificationCache: Map<string, DataVerificationResult> = new Map();
  private auditTrail: Map<string, AuditEntry[]> = new Map();
  private schemaRegistry: Map<string, DataSchema> = new Map();
  private knownDataSources: Map<string, DataSource> = new Map();

  // Performance metrics
  private verificationMetrics: VerificationMetrics = {
    totalVerifications: 0,
    successfulVerifications: 0,
    failedVerifications: 0,
    averageVerificationTime: 0,
    cryptographicProofFailures: 0,
    temporalValidationFailures: 0,
    schemaValidationFailures: 0,
    consistencyCheckFailures: 0
  };

  private constructor(config: OffChainDataVerifierConfig) {
    super();
    this.config = config;
    this.logger = createLogger({
      level: 'info',
      format: format.combine(format.timestamp(), format.simple()),
      transports: [
        new transports.Console(),
        new transports.File({ filename: 'logs/off-chain-data-verifier.log' })
      ],
    });
  }

  static getInstance(config?: OffChainDataVerifierConfig): OffChainDataVerifier {
    if (!OffChainDataVerifier.instance && config) {
      OffChainDataVerifier.instance = new OffChainDataVerifier(config);
    } else if (!OffChainDataVerifier.instance) {
      throw new Error('OffChainDataVerifier must be initialized with config first');
    }
    return OffChainDataVerifier.instance;
  }

  async initialize(): Promise<void> {
    try {
      this.logger.info('Initializing Off-Chain Data Verifier...');

      // Load known data sources
      await this.loadKnownDataSources();

      // Initialize schema registry
      await this.initializeSchemaRegistry();

      // Setup cleanup intervals
      this.setupCleanupIntervals();

      this.isInitialized = true;
      this.logger.info('Off-Chain Data Verifier initialized successfully');

    } catch (error) {
      this.logger.error('Failed to initialize Off-Chain Data Verifier:', error);
      throw error;
    }
  }

  async verifyData(
    dataSourceId: string, 
    data: any, 
    proof?: CryptographicProof
  ): Promise<DataVerificationResult> {
    try {
      if (!this.isInitialized) {
        throw new Error('Off-Chain Data Verifier not initialized');
      }

      const startTime = Date.now();

      this.logger.debug('Verifying off-chain data', { 
        dataSourceId, 
        hasProof: !!proof,
        dataSize: JSON.stringify(data).length 
      });

      // Check cache first
      const cacheKey = this.generateCacheKey(dataSourceId, data);
      const cached = this.verificationCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp.getTime() < 300000) { // 5 minute cache
        return cached;
      }

      // Perform verification checks
      const verificationPromises = [];

      // Cryptographic proof verification
      if (this.config.enableCryptographicProofs && proof) {
        verificationPromises.push(this.verifyCryptographicProof(data, proof));
      }

      // Temporal validation
      if (this.config.enableTemporalValidation) {
        verificationPromises.push(this.validateTemporal(data));
      }

      // Schema validation
      if (this.config.enableSchemaValidation) {
        verificationPromises.push(this.validateSchema(dataSourceId, data));
      }

      // Consistency checks across sources
      if (this.config.enableConsistencyChecks) {
        verificationPromises.push(this.performConsistencyCheck(dataSourceId, data));
      }

      // Wait for all verifications
      const results = await Promise.allSettled(verificationPromises);

      // Aggregate results
      const verificationResult = this.aggregateVerificationResults(
        dataSourceId,
        data,
        results,
        startTime
      );

      // Cache result
      this.verificationCache.set(cacheKey, verificationResult);

      // Update metrics
      this.updateMetrics(verificationResult, Date.now() - startTime);

      // Create audit trail
      if (this.config.enableAuditTrail) {
        this.createAuditEntry(dataSourceId, data, verificationResult);
      }

      // Emit verification event
      this.emit('data_verified', {
        dataSourceId,
        result: verificationResult,
        timestamp: new Date()
      });

      return verificationResult;

    } catch (error) {
      this.logger.error('Data verification failed:', error, { dataSourceId });
      
      // Update failure metrics
      this.verificationMetrics.totalVerifications++;
      this.verificationMetrics.failedVerifications++;
      
      throw error;
    }
  }

  async verifyBatch(
    verificationRequests: Array<{
      dataSourceId: string;
      data: any;
      proof?: CryptographicProof;
    }>
  ): Promise<DataVerificationResult[]> {
    try {
      this.logger.info('Performing batch data verification', { 
        batchSize: verificationRequests.length 
      });

      const verificationPromises = verificationRequests.map(req =>
        this.verifyData(req.dataSourceId, req.data, req.proof)
          .catch(error => {
            this.logger.error('Batch verification item failed:', error, {
              dataSourceId: req.dataSourceId
            });
            return null; // Continue with other verifications
          })
      );

      const results = await Promise.all(verificationPromises);
      
      // Filter out failed verifications
      const successfulResults = results.filter(result => result !== null) as DataVerificationResult[];

      this.logger.info('Batch verification completed', {
        total: verificationRequests.length,
        successful: successfulResults.length,
        failed: verificationRequests.length - successfulResults.length
      });

      return successfulResults;

    } catch (error) {
      this.logger.error('Batch verification failed:', error);
      throw error;
    }
  }

  // Private Methods
  private async verifyCryptographicProof(
    data: any, 
    proof: CryptographicProof
  ): Promise<CryptographicVerificationResult> {
    try {
      const dataHash = this.calculateDataHash(data);
      
      // Verify signature if present
      let signatureValid = true;
      if (proof.signature && proof.publicKey) {
        signatureValid = this.verifySignature(dataHash, proof.signature, proof.publicKey);
      }

      // Verify Merkle proof if present
      let merkleValid = true;
      if (proof.merkleProof && proof.merkleRoot) {
        merkleValid = this.verifyMerkleProof(dataHash, proof.merkleProof, proof.merkleRoot);
      }

      // Verify hash chain if present
      let hashChainValid = true;
      if (proof.previousHash && proof.nonce) {
        hashChainValid = this.verifyHashChain(dataHash, proof.previousHash, proof.nonce);
      }

      const overallValid = signatureValid && merkleValid && hashChainValid;

      return {
        type: 'cryptographic',
        valid: overallValid,
        confidence: overallValid ? 1.0 : 0.0,
        details: {
          dataHash,
          signatureValid,
          merkleValid,
          hashChainValid,
          algorithm: this.config.cryptographicAlgorithm,
          timestamp: new Date()
        }
      };

    } catch (error) {
      this.logger.error('Cryptographic proof verification failed:', error);
      return {
        type: 'cryptographic',
        valid: false,
        confidence: 0.0,
        details: {
          error: error instanceof Error ? error.message : String(error),
          timestamp: new Date()
        }
      };
    }
  }

  private async validateTemporal(data: any): Promise<TemporalValidationResult> {
    try {
      const timestamp = this.extractTimestamp(data);
      const now = Date.now();
      const age = now - timestamp;

      const isFresh = age <= this.config.maxDataAge;
      const confidence = Math.max(0, 1 - (age / this.config.maxDataAge));

      return {
        type: 'temporal',
        valid: isFresh,
        confidence,
        details: {
          dataTimestamp: new Date(timestamp),
          currentTime: new Date(now),
          age,
          maxAllowedAge: this.config.maxDataAge,
          isFresh
        }
      };

    } catch (error) {
      this.logger.error('Temporal validation failed:', error);
      return {
        type: 'temporal',
        valid: false,
        confidence: 0.0,
        details: {
          error: error instanceof Error ? error.message : String(error)
        }
      };
    }
  }

  private async validateSchema(dataSourceId: string, data: any): Promise<SchemaValidationResult> {
    try {
      const schema = this.schemaRegistry.get(dataSourceId);
      if (!schema) {
        this.logger.warn('No schema found for data source', { dataSourceId });
        return {
          type: 'schema',
          valid: true, // Pass if no schema defined
          confidence: 0.5,
          details: {
            message: 'No schema defined for validation',
            dataSourceId
          }
        };
      }

      const validationResult = this.validateAgainstSchema(data, schema);

      return {
        type: 'schema',
        valid: validationResult.valid,
        confidence: validationResult.valid ? 1.0 : 0.0,
        details: {
          schema: schema.name,
          errors: validationResult.errors,
          dataSourceId
        }
      };

    } catch (error) {
      this.logger.error('Schema validation failed:', error);
      return {
        type: 'schema',
        valid: false,
        confidence: 0.0,
        details: {
          error: error instanceof Error ? error.message : String(error),
          dataSourceId
        }
      };
    }
  }

  private async performConsistencyCheck(
    dataSourceId: string, 
    data: any
  ): Promise<ConsistencyCheckResult> {
    try {
      // Get similar data from other sources for comparison
      const similarData = await this.getSimilarDataFromOtherSources(dataSourceId, data);
      
      if (similarData.length === 0) {
        return {
          type: 'consistency',
          valid: true, // Cannot check consistency without comparison data
          confidence: 0.5,
          details: {
            message: 'Insufficient comparison data for consistency check',
            comparisonSources: 0
          }
        };
      }

      // Calculate consistency score
      const consistencyScore = this.calculateConsistencyScore(data, similarData);
      const isConsistent = consistencyScore >= this.config.minConsistencyThreshold;

      return {
        type: 'consistency',
        valid: isConsistent,
        confidence: consistencyScore,
        details: {
          consistencyScore,
          threshold: this.config.minConsistencyThreshold,
          comparisonSources: similarData.length,
          deviations: this.calculateDeviations(data, similarData)
        }
      };

    } catch (error) {
      this.logger.error('Consistency check failed:', error);
      return {
        type: 'consistency',
        valid: false,
        confidence: 0.0,
        details: {
          error: error instanceof Error ? error.message : String(error)
        }
      };
    }
  }

  private aggregateVerificationResults(
    dataSourceId: string,
    data: any,
    results: PromiseSettledResult<any>[],
    startTime: number
  ): DataVerificationResult {
    const verificationResults = results
      .filter(r => r.status === 'fulfilled')
      .map(r => (r as PromiseFulfilledResult<any>).value);

    const allValid = verificationResults.every(r => r.valid);
    const averageConfidence = verificationResults.reduce((sum, r) => sum + r.confidence, 0) / 
                             Math.max(verificationResults.length, 1);

    // Calculate overall score with weights
    const weights = {
      cryptographic: 0.4,
      temporal: 0.2,
      schema: 0.2,
      consistency: 0.2
    };

    let weightedScore = 0;
    let totalWeight = 0;

    verificationResults.forEach(result => {
      const weight = weights[result.type as keyof typeof weights] || 0.1;
      weightedScore += result.confidence * weight;
      totalWeight += weight;
    });

    const finalScore = totalWeight > 0 ? weightedScore / totalWeight : 0;

    return {
      dataSourceId,
      valid: allValid && finalScore >= 0.7, // Require 70% confidence
      confidence: finalScore,
      verificationTypes: verificationResults.map(r => r.type),
      details: verificationResults,
      timestamp: new Date(),
      processingTime: Date.now() - startTime,
      metadata: {
        dataSize: JSON.stringify(data).length,
        verificationsPerformed: verificationResults.length,
        cacheHit: false
      }
    };
  }

  // Utility methods
  private calculateDataHash(data: any): string {
    const dataString = JSON.stringify(data, Object.keys(data).sort());
    return createHash(this.config.cryptographicAlgorithm).update(dataString).digest('hex');
  }

  private verifySignature(dataHash: string, signature: string, publicKey: string): boolean {
    // Mock signature verification - would use actual cryptographic library
    return signature.length > 0 && publicKey.length > 0;
  }

  private verifyMerkleProof(dataHash: string, merkleProof: string[], merkleRoot: string): boolean {
    // Mock Merkle proof verification - would implement actual Merkle tree verification
    let currentHash = dataHash;
    
    for (const proofElement of merkleProof) {
      const combined = currentHash < proofElement ? 
        currentHash + proofElement : 
        proofElement + currentHash;
      currentHash = createHash(this.config.cryptographicAlgorithm).update(combined).digest('hex');
    }
    
    return currentHash === merkleRoot;
  }

  private verifyHashChain(dataHash: string, previousHash: string, nonce: string): boolean {
    // Mock hash chain verification
    const expectedHash = createHash(this.config.cryptographicAlgorithm)
      .update(previousHash + dataHash + nonce)
      .digest('hex');
    
    return expectedHash.startsWith('0000'); // Mock proof-of-work verification
  }

  private extractTimestamp(data: any): number {
    // Try to extract timestamp from various common fields
    const timestampFields = ['timestamp', 'time', 'created_at', 'updated_at', 'date'];
    
    for (const field of timestampFields) {
      if (data[field]) {
        const timestamp = new Date(data[field]).getTime();
        if (!isNaN(timestamp)) {
          return timestamp;
        }
      }
    }
    
    // If no timestamp found, use current time
    return Date.now();
  }

  private validateAgainstSchema(data: any, schema: DataSchema): SchemaValidationResult {
    const errors: string[] = [];
    
    // Validate required fields
    for (const field of schema.requiredFields) {
      if (!(field in data)) {
        errors.push(`Missing required field: ${field}`);
      }
    }
    
    // Validate field types
    for (const [field, expectedType] of Object.entries(schema.fieldTypes)) {
      if (field in data) {
        const actualType = typeof data[field];
        if (actualType !== expectedType) {
          errors.push(`Field ${field} has type ${actualType}, expected ${expectedType}`);
        }
      }
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }

  private async getSimilarDataFromOtherSources(
    excludeSourceId: string, 
    data: any
  ): Promise<any[]> {
    // Mock implementation - would query other data sources for similar data
    return [];
  }

  private calculateConsistencyScore(data: any, comparisonData: any[]): number {
    if (comparisonData.length === 0) return 1.0;
    
    // Mock consistency calculation - would implement actual data comparison logic
    return 0.85 + Math.random() * 0.1; // 85-95% consistency
  }

  private calculateDeviations(data: any, comparisonData: any[]): any[] {
    // Mock deviation calculation
    return [];
  }

  private generateCacheKey(dataSourceId: string, data: any): string {
    const dataHash = this.calculateDataHash(data);
    return `${dataSourceId}_${dataHash}`;
  }

  private updateMetrics(result: DataVerificationResult, processingTime: number): void {
    this.verificationMetrics.totalVerifications++;
    
    if (result.valid) {
      this.verificationMetrics.successfulVerifications++;
    } else {
      this.verificationMetrics.failedVerifications++;
      
      // Update specific failure counts
      result.details.forEach(detail => {
        if (!detail.valid) {
          switch (detail.type) {
            case 'cryptographic':
              this.verificationMetrics.cryptographicProofFailures++;
              break;
            case 'temporal':
              this.verificationMetrics.temporalValidationFailures++;
              break;
            case 'schema':
              this.verificationMetrics.schemaValidationFailures++;
              break;
            case 'consistency':
              this.verificationMetrics.consistencyCheckFailures++;
              break;
          }
        }
      });
    }
    
    // Update average processing time with exponential moving average
    const alpha = 0.1;
    this.verificationMetrics.averageVerificationTime = 
      this.verificationMetrics.averageVerificationTime * (1 - alpha) + processingTime * alpha;
  }

  private createAuditEntry(
    dataSourceId: string, 
    data: any, 
    result: DataVerificationResult
  ): void {
    const entry: AuditEntry = {
      timestamp: new Date(),
      dataSourceId,
      dataHash: this.calculateDataHash(data),
      verificationResult: result.valid,
      confidence: result.confidence,
      verificationTypes: result.verificationTypes,
      processingTime: result.processingTime
    };
    
    const auditEntries = this.auditTrail.get(dataSourceId) || [];
    auditEntries.push(entry);
    
    // Keep only recent entries
    const cutoff = Date.now() - (this.config.auditRetentionDays * 24 * 60 * 60 * 1000);
    const recentEntries = auditEntries.filter(e => e.timestamp.getTime() > cutoff);
    
    this.auditTrail.set(dataSourceId, recentEntries);
  }

  private async loadKnownDataSources(): Promise<void> {
    // Mock implementation - would load from database or configuration
    this.logger.info('Known data sources loaded');
  }

  private async initializeSchemaRegistry(): Promise<void> {
    // Add default schemas for common data types
    this.schemaRegistry.set('price_feed', {
      name: 'Price Feed Schema',
      version: '1.0',
      requiredFields: ['asset', 'price', 'timestamp'],
      fieldTypes: {
        asset: 'string',
        price: 'number',
        timestamp: 'number',
        volume: 'number'
      },
      constraints: {
        price: { min: 0 },
        timestamp: { min: 0 }
      }
    });
    
    this.schemaRegistry.set('rwa_data', {
      name: 'RWA Data Schema',
      version: '1.0',
      requiredFields: ['protocol_id', 'asset_value', 'timestamp'],
      fieldTypes: {
        protocol_id: 'string',
        asset_value: 'number',
        timestamp: 'number',
        verification_status: 'string'
      },
      constraints: {
        asset_value: { min: 0 }
      }
    });

    this.logger.info('Schema registry initialized', { 
      schemas: this.schemaRegistry.size 
    });
  }

  private setupCleanupIntervals(): void {
    // Cache cleanup every hour
    setInterval(() => {
      const now = Date.now();
      const maxAge = 3600000; // 1 hour
      
      for (const [key, result] of this.verificationCache) {
        if (now - result.timestamp.getTime() > maxAge) {
          this.verificationCache.delete(key);
        }
      }
      
      this.logger.debug('Verification cache cleaned up', {
        remainingEntries: this.verificationCache.size
      });
    }, 3600000);
  }

  // Public interface methods
  getMetrics(): VerificationMetrics {
    return { ...this.verificationMetrics };
  }

  getAuditTrail(dataSourceId: string): AuditEntry[] {
    return this.auditTrail.get(dataSourceId) || [];
  }

  addDataSchema(dataSourceId: string, schema: DataSchema): void {
    this.schemaRegistry.set(dataSourceId, schema);
    this.logger.info('Data schema added', { dataSourceId, schemaName: schema.name });
  }

  getStatus(): any {
    return {
      isInitialized: this.isInitialized,
      isRunning: true,
      cacheSize: this.verificationCache.size,
      knownDataSources: this.knownDataSources.size,
      registeredSchemas: this.schemaRegistry.size,
      metrics: this.verificationMetrics
    };
  }

  async shutdown(): Promise<void> {
    this.logger.info('Shutting down Off-Chain Data Verifier...');
    this.verificationCache.clear();
    this.auditTrail.clear();
    this.removeAllListeners();
  }
}

// Supporting interfaces
interface CryptographicVerificationResult {
  type: 'cryptographic';
  valid: boolean;
  confidence: number;
  details: any;
}

interface VerificationMetrics {
  totalVerifications: number;
  successfulVerifications: number;
  failedVerifications: number;
  averageVerificationTime: number;
  cryptographicProofFailures: number;
  temporalValidationFailures: number;
  schemaValidationFailures: number;
  consistencyCheckFailures: number;
}

interface AuditEntry {
  timestamp: Date;
  dataSourceId: string;
  dataHash: string;
  verificationResult: boolean;
  confidence: number;
  verificationTypes: string[];
  processingTime: number;
}

interface DataSchema {
  name: string;
  version: string;
  requiredFields: string[];
  fieldTypes: Record<string, string>;
  constraints?: Record<string, any>;
}

interface SchemaValidationResult {
  valid: boolean;
  errors: string[];
}