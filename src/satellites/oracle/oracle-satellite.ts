/**
 * Oracle Satellite Agent
 * Data integrity and Real-World Asset validation coordination
 */

import { EventEmitter } from 'events';
import { Logger } from 'winston';
import { createLogger, format, transports } from 'winston';
import {
  OracleSatelliteConfig,
  OracleEvent,
  RWAEvent,
  SystemHealth,
  OracleStatus,
  RWAStatus,
  OracleFeed,
  RWAProtocol,
  OracleValidationResult,
  RWAValidationResult
} from './types';
import { OracleFeedValidator, OracleValidatorConfig } from './validation/oracle-feed-validator';
import { RWAValidator, RWAValidatorConfig } from './validation/rwa-validator';
import { OffChainDataVerifier, OffChainDataVerifierConfig } from './verification/off-chain-data-verifier';
import { DataSourceManager, DataSourceManagerConfig } from './sources/data-source-manager';
import { PerplexityClient, PerplexityClientConfig } from './sources/perplexity-client';
import { getUnifiedAIClient, UnifiedAIClient } from '../../integrations/ai/unified-ai-client';

export class OracleSatelliteAgent extends EventEmitter {
  private static instance: OracleSatelliteAgent;
  private logger: Logger;
  private config: OracleSatelliteConfig;
  private isInitialized: boolean = false;
  private isRunning: boolean = false;

  // Component managers
  private oracleValidator?: OracleFeedValidator;
  private rwaValidator?: RWAValidator;
  private offChainDataVerifier?: OffChainDataVerifier;
  private dataSourceManager?: DataSourceManager;
  private perplexityClient?: PerplexityClient;
  private unifiedAIClient?: UnifiedAIClient;
  private anomalyDetector?: any; // AnomalyDetector

  // State management
  private oracleFeeds: Map<string, OracleFeed> = new Map();
  private rwaProtocols: Map<string, RWAProtocol> = new Map();
  private validationCache: Map<string, any> = new Map();
  private healthMetrics: SystemHealth;

  // Processing intervals
  private validationInterval?: NodeJS.Timeout;
  private healthCheckInterval?: NodeJS.Timeout;
  private cacheCleanupInterval?: NodeJS.Timeout;

  private constructor(config: OracleSatelliteConfig) {
    super();
    this.config = config;
    this.logger = createLogger({
      level: this.config.monitoring.logLevel,
      format: format.combine(
        format.timestamp(),
        format.errors({ stack: true }),
        format.json()
      ),
      transports: [
        new transports.Console({
          format: format.combine(
            format.colorize(),
            format.simple()
          )
        }),
        new transports.File({ 
          filename: 'logs/oracle-satellite.log',
          maxsize: 10485760, // 10MB
          maxFiles: 5
        })
      ],
    });

    this.healthMetrics = this.initializeHealthMetrics();
  }

  static getInstance(config?: OracleSatelliteConfig): OracleSatelliteAgent {
    if (!OracleSatelliteAgent.instance && config) {
      OracleSatelliteAgent.instance = new OracleSatelliteAgent(config);
    } else if (!OracleSatelliteAgent.instance) {
      throw new Error('OracleSatelliteAgent must be initialized with config first');
    }
    return OracleSatelliteAgent.instance;
  }

  async initialize(): Promise<void> {
    try {
      this.logger.info('Initializing Oracle Satellite Agent...');

      // Initialize core components
      await this.initializeOracleValidator();
      await this.initializeRWAValidator();
      await this.initializeOffChainDataVerifier();
      await this.initializeDataSourceManager();
      await this.initializePerplexityClient();
      await this.initializeUnifiedAIClient();
      await this.initializeAnomalyDetector();

      // Load initial data
      await this.loadOracleFeeds();
      await this.loadRWAProtocols();

      // Setup event handlers
      this.setupEventHandlers();

      this.isInitialized = true;
      this.logger.info('Oracle Satellite Agent initialized successfully', {
        oracleFeeds: this.oracleFeeds.size,
        rwaProtocols: this.rwaProtocols.size
      });

      this.emit('satellite_initialized', {
        type: 'initialization_completed',
        timestamp: new Date(),
        metrics: this.getHealthMetrics()
      });

    } catch (error) {
      this.logger.error('Failed to initialize Oracle Satellite Agent:', error);
      throw error;
    }
  }

  async start(): Promise<void> {
    try {
      if (!this.isInitialized) {
        throw new Error('Oracle Satellite Agent not initialized');
      }

      this.logger.info('Starting Oracle Satellite Agent...');

      // Start validation processes
      if (this.config.oracle.enableValidation) {
        await this.startOracleValidation();
      }

      if (this.config.rwa.enableValidation) {
        await this.startRWAValidation();
      }

      // Start monitoring and health checks
      await this.startSystemMonitoring();

      this.isRunning = true;
      this.logger.info('Oracle Satellite Agent started successfully');

      this.emit('satellite_started', {
        type: 'satellite_operational',
        timestamp: new Date(),
        config: {
          oracleValidation: this.config.oracle.enableValidation,
          rwaValidation: this.config.rwa.enableValidation,
          dataSources: this.config.dataSources.maxConcurrent
        }
      });

    } catch (error) {
      this.logger.error('Failed to start Oracle Satellite Agent:', error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    try {
      this.logger.info('Stopping Oracle Satellite Agent...');

      // Stop all intervals
      if (this.validationInterval) {
        clearInterval(this.validationInterval);
      }
      if (this.healthCheckInterval) {
        clearInterval(this.healthCheckInterval);
      }
      if (this.cacheCleanupInterval) {
        clearInterval(this.cacheCleanupInterval);
      }

      // Stop components
      if (this.oracleValidator) {
        await this.oracleValidator.shutdown();
      }
      if (this.rwaValidator) {
        await this.rwaValidator.shutdown();
      }
      if (this.offChainDataVerifier) {
        await this.offChainDataVerifier.shutdown();
      }
      if (this.dataSourceManager) {
        await this.dataSourceManager.shutdown();
      }
      if (this.perplexityClient) {
        await this.perplexityClient.shutdown();
      }

      this.isRunning = false;
      this.logger.info('Oracle Satellite Agent stopped successfully');

    } catch (error) {
      this.logger.error('Failed to stop Oracle Satellite Agent:', error);
      throw error;
    }
  }

  // Oracle Feed Management
  async validateOracleFeed(feedId: string): Promise<OracleValidationResult> {
    try {
      const feed = this.oracleFeeds.get(feedId);
      if (!feed) {
        throw new Error(`Oracle feed not found: ${feedId}`);
      }

      this.logger.debug('Validating oracle feed', { feedId, provider: feed.provider });

      // Check cache first
      const cacheKey = `oracle_${feedId}_${Date.now() - (Date.now() % 60000)}`; // 1-minute cache
      if (this.validationCache.has(cacheKey)) {
        return this.validationCache.get(cacheKey);
      }

      // Perform validation
      const result = await this.oracleValidator.validateFeed(feed);

      // Update feed reliability based on result
      await this.updateFeedReliability(feed, result);

      // Cache result
      this.validationCache.set(cacheKey, result);

      // Emit validation event
      this.emit('oracle_validated', {
        type: 'oracle_feed_validated',
        feedId,
        result,
        timestamp: new Date()
      } as OracleEvent);

      // Check for anomalies
      if (this.config.oracle.anomalyDetection.enabled) {
        await this.detectOracleAnomalies(feed, result);
      }

      return result;

    } catch (error) {
      this.logger.error('Oracle feed validation failed:', error, { feedId });
      throw error;
    }
  }

  async validateAllOracleFeeds(): Promise<Map<string, OracleValidationResult>> {
    const results = new Map<string, OracleValidationResult>();
    const validationPromises: Promise<void>[] = [];

    for (const [feedId] of this.oracleFeeds) {
      const promise = this.validateOracleFeed(feedId)
        .then(result => results.set(feedId, result))
        .catch(error => {
          this.logger.error('Failed to validate oracle feed:', error, { feedId });
          // Continue with other validations
        });
      
      validationPromises.push(promise);
    }

    await Promise.all(validationPromises);
    
    this.logger.info('Completed oracle feed validation batch', {
      total: this.oracleFeeds.size,
      successful: results.size,
      failed: this.oracleFeeds.size - results.size
    });

    return results;
  }

  // RWA Protocol Management
  async validateRWAProtocol(protocolId: string): Promise<RWAValidationResult> {
    try {
      const protocol = this.rwaProtocols.get(protocolId);
      if (!protocol) {
        throw new Error(`RWA protocol not found: ${protocolId}`);
      }

      this.logger.info('Validating RWA protocol', { 
        protocolId, 
        name: protocol.name,
        assetType: protocol.assetType 
      });

      // Check cache first
      const cacheKey = `rwa_${protocolId}_${Date.now() - (Date.now() % 3600000)}`; // 1-hour cache
      if (this.validationCache.has(cacheKey)) {
        return this.validationCache.get(cacheKey);
      }

      // Perform comprehensive validation
      const result = await this.rwaValidator.validateProtocol(protocol);

      // Update protocol status based on validation
      await this.updateProtocolStatus(protocol, result);

      // Cache result
      this.validationCache.set(cacheKey, result);

      // Emit validation event
      this.emit('rwa_validated', {
        type: 'rwa_protocol_validated',
        protocol: protocolId,
        data: result,
        severity: this.calculateEventSeverity(result),
        timestamp: new Date(),
        impact: this.calculateValidationImpact(result)
      } as RWAEvent);

      // Generate alerts if necessary
      await this.processRWAAlerts(protocol, result);

      return result;

    } catch (error) {
      this.logger.error('RWA protocol validation failed:', error, { protocolId });
      throw error;
    }
  }

  async validateAllRWAProtocols(): Promise<Map<string, RWAValidationResult>> {
    const results = new Map<string, RWAValidationResult>();
    const validationPromises: Promise<void>[] = [];

    for (const [protocolId] of this.rwaProtocols) {
      const promise = this.validateRWAProtocol(protocolId)
        .then(result => results.set(protocolId, result))
        .catch(error => {
          this.logger.error('Failed to validate RWA protocol:', error, { protocolId });
          // Continue with other validations
        });
      
      validationPromises.push(promise);
    }

    await Promise.all(validationPromises);
    
    this.logger.info('Completed RWA protocol validation batch', {
      total: this.rwaProtocols.size,
      successful: results.size,
      failed: this.rwaProtocols.size - results.size
    });

    return results;
  }

  // Off-Chain Data Verification
  async verifyOffChainData(
    dataSourceId: string, 
    data: any, 
    proof?: any
  ): Promise<any> {
    try {
      if (!this.offChainDataVerifier) {
        throw new Error('Off-chain data verifier not initialized');
      }

      this.logger.info('Verifying off-chain data', { 
        dataSourceId, 
        hasProof: !!proof 
      });

      const verificationResult = await this.offChainDataVerifier.verifyData(
        dataSourceId, 
        data, 
        proof
      );

      // Emit verification event
      this.emit('off_chain_data_verified', {
        type: 'off_chain_data_verified',
        dataSourceId,
        result: verificationResult,
        timestamp: new Date()
      });

      return verificationResult;

    } catch (error) {
      this.logger.error('Off-chain data verification failed:', error, { dataSourceId });
      throw error;
    }
  }

  async verifyOffChainDataBatch(
    verificationRequests: Array<{
      dataSourceId: string;
      data: any;
      proof?: any;
    }>
  ): Promise<any[]> {
    try {
      if (!this.offChainDataVerifier) {
        throw new Error('Off-chain data verifier not initialized');
      }

      this.logger.info('Performing batch off-chain data verification', { 
        batchSize: verificationRequests.length 
      });

      const results = await this.offChainDataVerifier.verifyBatch(verificationRequests);

      this.emit('off_chain_batch_verified', {
        type: 'off_chain_batch_verified',
        batchSize: verificationRequests.length,
        successfulVerifications: results.length,
        timestamp: new Date()
      });

      return results;

    } catch (error) {
      this.logger.error('Batch off-chain data verification failed:', error);
      throw error;
    }
  }

  // AI-Powered Data Validation
  async validateDataWithAI(
    dataType: 'oracle' | 'rwa', 
    data: any,
    context?: string
  ): Promise<any> {
    try {
      if (!this.unifiedAIClient) {
        throw new Error('Unified AI Client not initialized');
      }

      this.logger.info('Performing AI-powered data validation', { 
        dataType, 
        context 
      });

      const analysisRequest = {
        content: JSON.stringify(data, null, 2),
        analysisType: 'data_validation',
        context: `Validate ${dataType} data for accuracy and legitimacy. ${context || ''}`,
        systemPrompt: this.buildValidationSystemPrompt(dataType)
      };

      const response = await this.unifiedAIClient.analyzeContent(analysisRequest);

      if (!response.success) {
        throw new Error(`AI validation failed: ${response.error}`);
      }

      // Emit validation event
      this.emit('ai_data_validated', {
        type: 'ai_data_validated',
        dataType,
        result: response.data,
        provider: response.metadata?.provider,
        timestamp: new Date()
      });

      return response.data;

    } catch (error) {
      this.logger.error('AI data validation failed:', error, { dataType });
      throw error;
    }
  }

  async performCrossProviderConsensus(
    dataType: 'oracle' | 'rwa',
    data: any,
    context?: string
  ): Promise<any> {
    try {
      if (!this.unifiedAIClient) {
        throw new Error('Unified AI Client not initialized');
      }

      this.logger.info('Performing cross-provider consensus validation', { 
        dataType, 
        context 
      });

      const validationPrompt = this.buildConsensusValidationPrompt(dataType, data, context);

      // Get responses from multiple providers for consensus
      const providers = ['anthropic', 'openai', 'perplexity'];
      const consensusResults = [];

      for (const provider of providers) {
        try {
          const request = {
            prompt: validationPrompt,
            maxTokens: 2000,
            temperature: 0.1,
            systemPrompt: this.buildValidationSystemPrompt(dataType)
          };

          // Force specific provider by temporarily modifying config
          const originalDefault = this.unifiedAIClient['config'].defaultProvider;
          this.unifiedAIClient['config'].defaultProvider = provider as any;

          const response = await this.unifiedAIClient.generateText(request);

          // Restore original default
          this.unifiedAIClient['config'].defaultProvider = originalDefault;

          if (response.success) {
            consensusResults.push({
              provider,
              result: response.data?.text,
              confidence: this.extractConfidenceScore(response.data?.text)
            });
          }
        } catch (error) {
          this.logger.warn(`Provider ${provider} failed in consensus validation:`, error);
        }
      }

      // Calculate consensus
      const consensus = this.calculateValidationConsensus(consensusResults);

      this.emit('ai_consensus_completed', {
        type: 'ai_consensus_completed',
        dataType,
        consensus,
        participatingProviders: consensusResults.length,
        timestamp: new Date()
      });

      return consensus;

    } catch (error) {
      this.logger.error('Cross-provider consensus failed:', error, { dataType });
      throw error;
    }
  }

  async detectAnomaliesWithAI(data: any, context?: string): Promise<any> {
    try {
      if (!this.unifiedAIClient) {
        throw new Error('Unified AI Client not initialized');
      }

      this.logger.info('Performing AI-powered anomaly detection', { context });

      const analysisRequest = {
        content: JSON.stringify(data, null, 2),
        analysisType: 'anomaly_detection',
        context: `Detect anomalies and unusual patterns in this data. ${context || ''}`,
        systemPrompt: `You are an expert data analyst specializing in financial and blockchain data anomaly detection.
        Analyze the provided data for:
        1. Statistical outliers and unusual patterns
        2. Potential data corruption or manipulation
        3. Inconsistencies with expected behavior
        4. Signs of fraudulent activity or market manipulation
        5. Technical indicators of system failures
        
        Provide your analysis in JSON format with:
        - isAnomaly: boolean
        - confidence: number (0-1)
        - anomalies: array of detected anomalies
        - explanation: detailed explanation
        - recommendations: suggested actions`
      };

      const response = await this.unifiedAIClient.analyzeContent(analysisRequest);

      if (!response.success) {
        throw new Error(`AI anomaly detection failed: ${response.error}`);
      }

      let anomalyResult;
      try {
        anomalyResult = JSON.parse(response.data?.analysis || response.data?.result || '{}');
      } catch {
        // Fallback to text analysis if JSON parsing fails
        anomalyResult = {
          isAnomaly: response.data?.analysis?.includes('anomaly') || false,
          confidence: 0.5,
          explanation: response.data?.analysis || response.data?.result,
          anomalies: []
        };
      }

      this.emit('ai_anomaly_detected', {
        type: 'ai_anomaly_detected',
        result: anomalyResult,
        provider: response.metadata?.provider,
        timestamp: new Date()
      });

      return anomalyResult;

    } catch (error) {
      this.logger.error('AI anomaly detection failed:', error);
      throw error;
    }
  }

  // Real-time Analysis
  async performRealTimeAnalysis(): Promise<void> {
    try {
      this.logger.debug('Performing real-time analysis...');

      // Parallel execution of analysis tasks (now enhanced with AI)
      const analysisPromises = [
        this.analyzeOracleTrends(),
        this.analyzeRWAMarket(),
        this.detectSystemAnomalies(),
        this.updateHealthMetrics(),
        this.performAIEnhancedAnalysis() // New AI-powered analysis
      ];

      await Promise.allSettled(analysisPromises);

      this.emit('analysis_completed', {
        type: 'real_time_analysis_completed',
        timestamp: new Date(),
        metrics: this.healthMetrics
      });

    } catch (error) {
      this.logger.error('Real-time analysis failed:', error);
    }
  }

  // Data Source Management
  async refreshDataSources(): Promise<void> {
    try {
      this.logger.info('Refreshing data sources...');
      
      if (this.dataSourceManager) {
        await this.dataSourceManager.refreshAll();
        await this.updateDataSourceHealth();
        
        this.emit('data_sources_refreshed', {
          type: 'data_sources_refreshed',
          timestamp: new Date(),
          healthMetrics: this.dataSourceManager.getHealthMetrics()
        });
      }

    } catch (error) {
      this.logger.error('Failed to refresh data sources:', error);
    }
  }

  // Private Methods
  private async initializeOracleValidator(): Promise<void> {
    this.logger.debug('Initializing oracle validator...');
    
    const validatorConfig: OracleValidatorConfig = {
      enableCrossValidation: this.config.oracle.enableCrossValidation || true,
      enableHistoricalValidation: this.config.oracle.enableHistoricalValidation || true,
      enableAnomalyDetection: this.config.oracle.anomalyDetection?.enabled || true,
      accuracyThreshold: this.config.oracle.accuracyThreshold || 0.8,
      consensusThreshold: this.config.oracle.consensusThreshold || 0.75,
      maxDeviationPercent: this.config.oracle.maxDeviationPercent || 5.0,
      historicalWindowDays: this.config.oracle.historicalWindowDays || 30,
      minConsensusSize: this.config.oracle.minConsensusSize || 3,
      validationTimeout: this.config.oracle.validationTimeout || 30000,
      enableCaching: this.config.oracle.enableCaching || true,
      cacheTtl: this.config.oracle.cacheTtl || 300000 // 5 minutes
    };

    this.oracleValidator = OracleFeedValidator.getInstance(validatorConfig);
    await this.oracleValidator.initialize();

    this.logger.info('Oracle validator initialized successfully');
  }

  private async initializeRWAValidator(): Promise<void> {
    this.logger.debug('Initializing RWA validator...');
    
    const validatorConfig: RWAValidatorConfig = {
      enablePerplexityResearch: this.config.rwa.enablePerplexityResearch || true,
      enableSECFilingAnalysis: this.config.rwa.enableSECFilingAnalysis || false,
      enableTeamVerification: this.config.rwa.enableTeamVerification || true,
      enableFinancialAnalysis: this.config.rwa.enableFinancialAnalysis || true,
      validationDepth: this.config.rwa.validationDepth || 'standard',
      legitimacyThreshold: this.config.rwa.legitimacyThreshold || 0.6,
      riskThresholds: this.config.rwa.riskThresholds || {
        low: 0.3,
        medium: 0.6,
        high: 0.8
      },
      perplexityApiKey: this.config.rwa.perplexityApiKey || process.env.PERPLEXITY_API_KEY || '',
      secApiKey: this.config.rwa.secApiKey,
      maxConcurrentValidations: this.config.rwa.maxConcurrentValidations || 5,
      validationTimeout: this.config.rwa.validationTimeout || 60000
    };

    this.rwaValidator = RWAValidator.getInstance(validatorConfig);
    await this.rwaValidator.initialize();

    this.logger.info('RWA validator initialized successfully');
  }

  private async initializeOffChainDataVerifier(): Promise<void> {
    this.logger.debug('Initializing off-chain data verifier...');
    
    const verifierConfig: OffChainDataVerifierConfig = {
      enableCryptographicProofs: this.config.offChainVerification?.enableCryptographicProofs || true,
      enableTemporalValidation: this.config.offChainVerification?.enableTemporalValidation || true,
      enableSchemaValidation: this.config.offChainVerification?.enableSchemaValidation || true,
      enableConsistencyChecks: this.config.offChainVerification?.enableConsistencyChecks || true,
      maxDataAge: this.config.offChainVerification?.maxDataAge || 3600000, // 1 hour
      minConsistencyThreshold: this.config.offChainVerification?.minConsistencyThreshold || 0.8,
      cryptographicAlgorithm: this.config.offChainVerification?.cryptographicAlgorithm || 'sha256',
      proofValidationTimeout: this.config.offChainVerification?.proofValidationTimeout || 30000,
      enableAuditTrail: this.config.offChainVerification?.enableAuditTrail || true,
      auditRetentionDays: this.config.offChainVerification?.auditRetentionDays || 30
    };

    this.offChainDataVerifier = OffChainDataVerifier.getInstance(verifierConfig);
    await this.offChainDataVerifier.initialize();

    this.logger.info('Off-chain data verifier initialized successfully');
  }

  private async initializeDataSourceManager(): Promise<void> {
    this.logger.debug('Initializing data source manager...');
    
    const managerConfig: DataSourceManagerConfig = {
      maxConcurrentConnections: this.config.dataSources.maxConcurrent || 10,
      defaultTimeout: this.config.dataSources.timeout || 30000,
      retryAttempts: this.config.dataSources.retries || 3,
      healthCheckInterval: this.config.dataSources.healthCheckInterval || 30000,
      cachingEnabled: this.config.dataSources.enableCaching || true,
      loadBalancing: this.config.dataSources.loadBalancing || false,
      failoverEnabled: this.config.dataSources.failoverEnabled || true,
      circuitBreakerThreshold: this.config.dataSources.circuitBreakerThreshold || 5,
      rateLimitingEnabled: this.config.dataSources.rateLimitingEnabled || true,
      enableMetrics: this.config.monitoring.enableMetrics || true
    };

    this.dataSourceManager = DataSourceManager.getInstance(managerConfig);
    await this.dataSourceManager.initialize();
    await this.dataSourceManager.start();

    this.logger.info('Data source manager initialized successfully');
  }

  private async initializePerplexityClient(): Promise<void> {
    this.logger.debug('Initializing Perplexity client...');
    
    const clientConfig: PerplexityClientConfig = {
      apiKey: this.config.perplexity.apiKey || process.env.PERPLEXITY_API_KEY || '',
      baseUrl: this.config.perplexity.baseUrl || 'https://api.perplexity.ai',
      model: this.config.perplexity.model || 'llama-3.1-sonar-large-128k-online',
      timeout: this.config.perplexity.timeout || 30000,
      maxRetries: this.config.perplexity.maxRetries || 3,
      enableCaching: this.config.perplexity.enableCaching || true,
      cacheTtl: this.config.perplexity.cacheTtl || 3600000, // 1 hour
      dailyQuotaLimit: this.config.perplexity.dailyQuotaLimit || 10000,
      enableRateLimiting: this.config.perplexity.enableRateLimiting || true,
      requestsPerMinute: this.config.perplexity.requestsPerMinute || 60,
      enableUsageTracking: this.config.perplexity.enableUsageTracking || true
    };

    this.perplexityClient = PerplexityClient.getInstance(clientConfig);
    await this.perplexityClient.initialize();

    this.logger.info('Perplexity client initialized successfully');
  }

  private async initializeUnifiedAIClient(): Promise<void> {
    this.logger.debug('Initializing Unified AI Client...');
    
    const unifiedAIConfig = {
      defaultProvider: this.config.ai?.defaultProvider || 'anthropic',
      fallbackProviders: this.config.ai?.fallbackProviders || ['openai', 'perplexity'],
      providers: {
        openai: {
          model: this.config.ai?.openai?.model || 'gpt-4o-mini',
          maxTokens: this.config.ai?.openai?.maxTokens || 4000,
          temperature: this.config.ai?.openai?.temperature || 0.3
        },
        anthropic: {
          model: this.config.ai?.anthropic?.model || 'claude-3-5-sonnet-20241022',
          maxTokens: this.config.ai?.anthropic?.maxTokens || 4000,
          temperature: this.config.ai?.anthropic?.temperature || 0.3
        },
        perplexity: {
          model: this.config.ai?.perplexity?.model || 'llama-3.1-sonar-large-128k-online',
          maxTokens: this.config.ai?.perplexity?.maxTokens || 4000,
          temperature: this.config.ai?.perplexity?.temperature || 0.1
        }
      },
      loadBalancing: {
        enabled: this.config.ai?.loadBalancing?.enabled || true,
        strategy: this.config.ai?.loadBalancing?.strategy || 'least-used'
      }
    };

    this.unifiedAIClient = getUnifiedAIClient(unifiedAIConfig);
    
    // Wait for initial health check
    await this.unifiedAIClient.refreshHealthStatus();

    this.logger.info('Unified AI Client initialized successfully', {
      healthStatus: this.unifiedAIClient.getHealthStatus()
    });
  }

  private async initializeAnomalyDetector(): Promise<void> {
    this.logger.debug('Initializing anomaly detector...');
    
    this.anomalyDetector = {
      detect: async (data: any) => ({ isAnomaly: false, score: 0, features: [], timestamp: new Date(), explanation: '' })
    };
  }

  private setupEventHandlers(): void {
    this.on('oracle_validated', this.handleOracleValidation.bind(this));
    this.on('rwa_validated', this.handleRWAValidation.bind(this));
    this.on('anomaly_detected', this.handleAnomalyDetection.bind(this));
    this.on('error', this.handleError.bind(this));
  }

  private async loadOracleFeeds(): Promise<void> {
    // Load default oracle feeds for testing
    const defaultFeeds: OracleFeed[] = [
      {
        id: 'chainlink_eth_usd',
        name: 'ETH/USD',
        provider: 'Chainlink',
        type: 'price',
        endpoint: 'https://api.chainlinkfeeds.network/price/ETH-USD',
        updateFrequency: 60000, // 1 minute
        reliability: 0.95,
        lastUpdate: new Date(),
        isActive: true,
        metadata: {
          decimals: 8,
          heartbeat: 3600,
          threshold: 0.5
        }
      },
      {
        id: 'pyth_btc_usd',
        name: 'BTC/USD',
        provider: 'Pyth Network',
        type: 'price',
        endpoint: 'https://hermes.pyth.network/api/latest_price_feeds',
        updateFrequency: 30000, // 30 seconds
        reliability: 0.93,
        lastUpdate: new Date(),
        isActive: true,
        metadata: {
          decimals: 8,
          heartbeat: 60,
          threshold: 1.0
        }
      },
      {
        id: 'uma_defi_pulse_index',
        name: 'DeFi Pulse Index',
        provider: 'UMA Protocol',
        type: 'rwa',
        endpoint: 'https://api.umaproject.org/price/DPI',
        updateFrequency: 300000, // 5 minutes
        reliability: 0.88,
        lastUpdate: new Date(),
        isActive: true,
        metadata: {
          decimals: 18,
          heartbeat: 86400,
          threshold: 2.0
        }
      }
    ];

    for (const feed of defaultFeeds) {
      this.oracleFeeds.set(feed.id, feed);
    }

    this.logger.info('Oracle feeds loaded', { count: this.oracleFeeds.size });
  }

  private async loadRWAProtocols(): Promise<void> {
    // TODO: Load RWA protocols from database or external sources
    this.logger.info('RWA protocols loaded', { count: this.rwaProtocols.size });
  }

  private async startOracleValidation(): Promise<void> {
    if (this.config.oracle.validationInterval > 0) {
      this.validationInterval = setInterval(
        () => this.validateAllOracleFeeds(),
        this.config.oracle.validationInterval
      );
      this.logger.info('Oracle validation scheduled', { 
        interval: this.config.oracle.validationInterval 
      });
    }
  }

  private async startRWAValidation(): Promise<void> {
    if (this.config.rwa.updateInterval > 0) {
      setInterval(
        () => this.validateAllRWAProtocols(),
        this.config.rwa.updateInterval
      );
      this.logger.info('RWA validation scheduled', { 
        interval: this.config.rwa.updateInterval 
      });
    }
  }

  private async startSystemMonitoring(): Promise<void> {
    // Health checks every 30 seconds
    this.healthCheckInterval = setInterval(
      () => this.updateHealthMetrics(),
      30000
    );

    // Cache cleanup every hour
    this.cacheCleanupInterval = setInterval(
      () => this.cleanupValidationCache(),
      3600000
    );

    this.logger.info('System monitoring started');
  }

  private async analyzeOracleTrends(): Promise<void> {
    // TODO: Implement oracle trend analysis
  }

  private async analyzeRWAMarket(): Promise<void> {
    // TODO: Implement RWA market analysis
  }

  private async detectSystemAnomalies(): Promise<void> {
    // TODO: Implement system-wide anomaly detection
  }

  private async performAIEnhancedAnalysis(): Promise<void> {
    try {
      if (!this.unifiedAIClient) return;

      // Perform AI-enhanced analysis on recent oracle and RWA data
      const recentOracleData = Array.from(this.oracleFeeds.values()).slice(0, 5);
      const recentRWAData = Array.from(this.rwaProtocols.values()).slice(0, 3);

      if (recentOracleData.length > 0) {
        await this.detectAnomaliesWithAI(recentOracleData, 'Oracle feed analysis');
      }

      if (recentRWAData.length > 0) {
        await this.detectAnomaliesWithAI(recentRWAData, 'RWA protocol analysis');
      }
    } catch (error) {
      this.logger.error('AI-enhanced analysis failed:', error);
    }
  }

  private buildValidationSystemPrompt(dataType: 'oracle' | 'rwa'): string {
    if (dataType === 'oracle') {
      return `You are an expert blockchain oracle data validator with deep knowledge of:
      - Price feed accuracy and manipulation detection
      - Cross-oracle consensus mechanisms
      - Temporal data consistency patterns
      - Market data anomaly detection
      - Oracle attack vectors (MEV, sandwich attacks, etc.)
      
      Analyze oracle data for accuracy, legitimacy, and potential manipulation.
      Focus on price deviation analysis, update frequency consistency, and cross-validation opportunities.`;
    } else {
      return `You are an expert Real-World Asset (RWA) protocol analyst with expertise in:
      - Asset backing verification and legitimacy assessment
      - Regulatory compliance evaluation
      - Financial health analysis of protocols
      - Team and organization credibility assessment
      - Market presence and reputation analysis
      
      Analyze RWA protocol data for legitimacy, compliance, and investment viability.
      Focus on asset verification, regulatory status, and protocol sustainability.`;
    }
  }

  private buildConsensusValidationPrompt(
    dataType: 'oracle' | 'rwa',
    data: any,
    context?: string
  ): string {
    const basePrompt = `Analyze the following ${dataType} data and provide a validation assessment:

${JSON.stringify(data, null, 2)}

${context ? `Additional context: ${context}` : ''}

Please provide:
1. Overall legitimacy assessment (score 0-100)
2. Key findings (both positive and concerning)
3. Specific red flags or validation issues
4. Confidence level in your assessment (0-100)
5. Recommendations for further validation

Format your response as JSON with the structure:
{
  "legitimacyScore": number,
  "confidence": number,
  "findings": {
    "positive": ["list", "of", "positive", "findings"],
    "concerns": ["list", "of", "concerns"]
  },
  "redFlags": ["list", "of", "red", "flags"],
  "recommendations": ["list", "of", "recommendations"]
}`;

    return basePrompt;
  }

  private extractConfidenceScore(text?: string): number {
    if (!text) return 0.5;
    
    // Try to extract confidence from JSON response
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.confidence) {
          return parsed.confidence / 100; // Convert to 0-1 scale
        }
      }
    } catch {
      // Fallback to text parsing
    }
    
    // Fallback: look for confidence indicators in text
    const confidenceIndicators = [
      { pattern: /very confident|highly confident|extremely confident/i, score: 0.9 },
      { pattern: /confident|likely|probable/i, score: 0.8 },
      { pattern: /moderately confident|somewhat confident/i, score: 0.7 },
      { pattern: /uncertain|unclear|mixed/i, score: 0.5 },
      { pattern: /doubtful|unlikely|suspicious/i, score: 0.3 },
      { pattern: /very doubtful|highly suspicious|definitely not/i, score: 0.1 }
    ];
    
    for (const indicator of confidenceIndicators) {
      if (indicator.pattern.test(text)) {
        return indicator.score;
      }
    }
    
    return 0.6; // Default moderate confidence
  }

  private calculateValidationConsensus(results: Array<{
    provider: string;
    result: string;
    confidence: number;
  }>): any {
    if (results.length === 0) {
      return {
        consensus: 'no_data',
        confidence: 0,
        agreement: 0,
        results: []
      };
    }

    // Extract legitimacy scores from results
    const scores = results.map(result => {
      try {
        const jsonMatch = result.result.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          return parsed.legitimacyScore || 50;
        }
      } catch {
        // Fallback scoring based on text sentiment
        const text = result.result.toLowerCase();
        if (text.includes('legitimate') || text.includes('valid')) return 80;
        if (text.includes('suspicious') || text.includes('concerning')) return 30;
        return 50;
      }
      return 50;
    });

    const averageScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    const averageConfidence = results.reduce((sum, r) => sum + r.confidence, 0) / results.length;
    
    // Calculate agreement (how close scores are to each other)
    const maxScore = Math.max(...scores);
    const minScore = Math.min(...scores);
    const agreement = 1 - ((maxScore - minScore) / 100);

    return {
      consensus: averageScore >= 70 ? 'legitimate' : averageScore <= 40 ? 'suspicious' : 'mixed',
      averageScore,
      confidence: averageConfidence,
      agreement,
      participatingProviders: results.length,
      results: results.map(r => ({
        provider: r.provider,
        confidence: r.confidence,
        summary: r.result.substring(0, 200) + '...'
      }))
    };
  }

  private async detectOracleAnomalies(feed: OracleFeed, result: OracleValidationResult): Promise<void> {
    if (this.anomalyDetector) {
      const anomaly = await this.anomalyDetector.detect({
        feed,
        result,
        timestamp: new Date()
      });

      if (anomaly.isAnomaly) {
        this.emit('anomaly_detected', {
          type: 'anomaly_detected',
          source: feed.id,
          data: anomaly,
          severity: 'warning',
          timestamp: new Date(),
          metadata: { feedProvider: feed.provider }
        } as OracleEvent);
      }
    }
  }

  private async updateFeedReliability(feed: OracleFeed, result: OracleValidationResult): Promise<void> {
    // Update feed reliability based on validation result
    const weight = 0.1; // 10% weight for new result
    feed.reliability = feed.reliability * (1 - weight) + result.score * weight;
    feed.lastUpdate = new Date();
    
    this.oracleFeeds.set(feed.id, feed);
  }

  private async updateProtocolStatus(protocol: RWAProtocol, result: RWAValidationResult): Promise<void> {
    // Update protocol based on validation result
    protocol.updatedAt = new Date();
    this.rwaProtocols.set(protocol.id, protocol);
  }

  private calculateEventSeverity(result: RWAValidationResult): 'info' | 'warning' | 'error' | 'critical' {
    if (result.legitimacyScore < 0.3) return 'critical';
    if (result.legitimacyScore < 0.5) return 'error';
    if (result.legitimacyScore < 0.7) return 'warning';
    return 'info';
  }

  private calculateValidationImpact(result: RWAValidationResult): string[] {
    const impacts: string[] = [];
    
    if (result.legitimacyScore < 0.5) {
      impacts.push('high_risk_protocol');
    }
    if (!result.assetVerification.verified) {
      impacts.push('unverified_assets');
    }
    if (!result.regulatoryCheck.compliant) {
      impacts.push('regulatory_non_compliance');
    }
    
    return impacts;
  }

  private async processRWAAlerts(protocol: RWAProtocol, result: RWAValidationResult): Promise<void> {
    // Generate alerts based on validation results
    if (result.legitimacyScore < this.config.rwa.riskThresholds.high) {
      this.logger.warn('High-risk RWA protocol detected', {
        protocol: protocol.id,
        legitimacyScore: result.legitimacyScore
      });
    }
  }

  private initializeHealthMetrics(): SystemHealth {
    return {
      oracle: {
        isInitialized: false,
        isRunning: false,
        activeFeeds: 0,
        validationsPassed: 0,
        validationsFailed: 0,
        averageAccuracy: 0,
        lastValidation: new Date(),
        errors: []
      },
      rwa: {
        isInitialized: false,
        isRunning: false,
        protocolsTracked: 0,
        validationsCompleted: 0,
        averageLegitimacy: 0,
        lastValidation: new Date(),
        criticalIssues: 0
      },
      dataSources: [],
      perplexity: {
        connected: false,
        quotaUsed: 0,
        quotaRemaining: 1000,
        averageLatency: 0,
        errorRate: 0,
        lastQuery: new Date()
      },
      overall: 'healthy'
    };
  }

  private async updateHealthMetrics(): Promise<void> {
    this.healthMetrics.oracle.isInitialized = this.isInitialized;
    this.healthMetrics.oracle.isRunning = this.isRunning;
    this.healthMetrics.oracle.activeFeeds = this.oracleFeeds.size;
    
    this.healthMetrics.rwa.isInitialized = this.isInitialized;
    this.healthMetrics.rwa.isRunning = this.isRunning;
    this.healthMetrics.rwa.protocolsTracked = this.rwaProtocols.size;
    
    // Update Perplexity client health
    if (this.perplexityClient) {
      const perplexityStatus = this.perplexityClient.getStatus();
      this.healthMetrics.perplexity.connected = perplexityStatus.isInitialized;
      this.healthMetrics.perplexity.quotaUsed = perplexityStatus.dailyQuotaUsed || 0;
      this.healthMetrics.perplexity.quotaRemaining = perplexityStatus.dailyQuotaRemaining || 1000;
      this.healthMetrics.perplexity.averageLatency = perplexityStatus.requestMetrics?.averageLatency || 0;
      this.healthMetrics.perplexity.errorRate = perplexityStatus.requestMetrics ? 
        (perplexityStatus.requestMetrics.failedRequests / Math.max(perplexityStatus.requestMetrics.totalRequests, 1)) : 0;
      this.healthMetrics.perplexity.lastQuery = perplexityStatus.requestMetrics?.lastRequest || new Date();
    }

    // Update Unified AI Client health
    if (this.unifiedAIClient) {
      const aiHealthStatus = this.unifiedAIClient.getHealthStatus();
      const healthyProviders = Object.values(aiHealthStatus).filter(status => status === true).length;
      const totalProviders = Object.keys(aiHealthStatus).length;
      
      // Update system health with AI client status
      if (totalProviders > 0) {
        const aiHealthScore = healthyProviders / totalProviders;
        
        // Log AI health status
        this.logger.debug('Unified AI Client health status', {
          healthyProviders,
          totalProviders,
          healthScore: aiHealthScore,
          providerStatus: aiHealthStatus
        });
        
        // Factor AI health into overall system health
        if (aiHealthScore < 0.5 && this.healthMetrics.overall === 'healthy') {
          this.healthMetrics.overall = 'degraded';
          this.logger.warn('System health degraded due to AI client issues');
        }
      }
    }
    
    // Calculate overall health
    this.healthMetrics.overall = this.calculateOverallHealth();
  }

  private async updateDataSourceHealth(): Promise<void> {
    if (!this.dataSourceManager) return;
    
    const healthMetrics = this.dataSourceManager.getHealthMetrics();
    
    // Update system health metrics with data source information
    this.healthMetrics.dataSources = healthMetrics.map(health => ({
      id: health.id,
      name: health.name,
      status: health.status,
      latency: health.latency,
      uptime: health.uptime,
      errorRate: health.errorRate,
      lastCheck: health.lastCheck
    }));
    
    // Calculate overall data source health impact
    const healthyCount = healthMetrics.filter(h => h.status === 'online').length;
    const totalCount = healthMetrics.length;
    const overallDataSourceHealth = totalCount > 0 ? healthyCount / totalCount : 1.0;
    
    // Update overall system health considering data sources
    if (overallDataSourceHealth < 0.5) {
      if (this.healthMetrics.overall !== 'critical') {
        this.healthMetrics.overall = 'critical';
        this.logger.warn('System health degraded to critical due to data source issues');
      }
    } else if (overallDataSourceHealth < 0.8) {
      if (this.healthMetrics.overall === 'healthy') {
        this.healthMetrics.overall = 'degraded';
        this.logger.warn('System health degraded due to data source issues');
      }
    }
    
    this.logger.debug('Data source health updated', {
      totalSources: totalCount,
      healthySources: healthyCount,
      overallHealth: overallDataSourceHealth
    });
  }

  private calculateOverallHealth(): 'healthy' | 'degraded' | 'critical' | 'offline' {
    if (!this.isRunning) return 'offline';
    
    const oracleHealth = this.healthMetrics.oracle.averageAccuracy;
    const rwaHealth = this.healthMetrics.rwa.averageLegitimacy;
    
    if (oracleHealth < 0.5 || rwaHealth < 0.5) return 'critical';
    if (oracleHealth < 0.7 || rwaHealth < 0.7) return 'degraded';
    
    return 'healthy';
  }

  private cleanupValidationCache(): void {
    const now = Date.now();
    const maxAge = 3600000; // 1 hour
    
    for (const [key, entry] of this.validationCache) {
      if (now - entry.timestamp > maxAge) {
        this.validationCache.delete(key);
      }
    }
    
    this.logger.debug('Validation cache cleaned up', { 
      remaining: this.validationCache.size 
    });
  }

  // Event Handlers
  private handleOracleValidation(event: OracleEvent): void {
    this.logger.debug('Oracle validation event received', { 
      type: event.type,
      source: event.source 
    });
  }

  private handleRWAValidation(event: RWAEvent): void {
    this.logger.debug('RWA validation event received', { 
      type: event.type,
      protocol: event.protocol 
    });
  }

  private handleAnomalyDetection(event: OracleEvent): void {
    this.logger.warn('Anomaly detected', { 
      source: event.source,
      severity: event.severity 
    });
  }

  private handleError(error: Error): void {
    this.logger.error('Oracle Satellite error:', error);
  }

  // Public Interface
  getHealthMetrics(): SystemHealth {
    return { ...this.healthMetrics };
  }

  getOracleStatus(): OracleStatus {
    return { ...this.healthMetrics.oracle };
  }

  getRWAStatus(): RWAStatus {
    return { ...this.healthMetrics.rwa };
  }

  async shutdown(): Promise<void> {
    try {
      this.logger.info('Shutting down Oracle Satellite Agent...');

      await this.stop();
      
      // Clear state
      this.oracleFeeds.clear();
      this.rwaProtocols.clear();
      this.validationCache.clear();
      this.removeAllListeners();

      this.isInitialized = false;
      this.logger.info('Oracle Satellite Agent shutdown complete');

    } catch (error) {
      this.logger.error('Failed to shutdown Oracle Satellite Agent:', error);
      throw error;
    }
  }
}