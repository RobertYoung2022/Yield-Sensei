/**
 * Blockchain Analytics Integration
 * Integrates with Chainalysis and TRM Labs for on-chain transaction monitoring
 */

import { EventEmitter } from 'events';
import Logger from '../../shared/logging/logger';
import { Transaction, RiskLevel } from '../types';

const logger = Logger.getLogger('blockchain-analytics');

// Analytics Provider Types
export interface BlockchainAnalyticsProvider {
  name: string;
  analyze(address: string, transaction?: Transaction): Promise<AnalyticsResult>;
  getAddressRisk(address: string): Promise<AddressRiskProfile>;
  getTransactionFlow(txHash: string): Promise<TransactionFlow>;
  isAvailable(): boolean;
}

export interface AnalyticsResult {
  provider: string;
  address: string;
  riskScore: number;
  riskLevel: RiskLevel;
  categories: RiskCategory[];
  exposures: ExposureDetail[];
  cluster?: ClusterInfo;
  sanctions?: SanctionsInfo;
  timestamp: Date;
}

export interface AddressRiskProfile {
  address: string;
  overallRisk: RiskLevel;
  riskScore: number;
  firstSeen?: Date;
  lastActive?: Date;
  totalTransactions: number;
  totalVolume: number;
  directExposure: ExposureDetail[];
  indirectExposure: ExposureDetail[];
  tags: string[];
  cluster?: ClusterInfo;
}

export interface TransactionFlow {
  txHash: string;
  hops: TransactionHop[];
  totalHops: number;
  riskExposure: RiskLevel;
  suspiciousPatterns: string[];
  visualization?: FlowVisualization;
}

export interface TransactionHop {
  hopNumber: number;
  fromAddress: string;
  toAddress: string;
  amount: number;
  token: string;
  timestamp: Date;
  riskScore: number;
  tags: string[];
}

export interface ExposureDetail {
  category: string;
  severity: RiskLevel;
  amount: number;
  percentage: number;
  entityName?: string;
  entityType?: string;
  lastInteraction?: Date;
}

export interface ClusterInfo {
  clusterId: string;
  name?: string;
  category: string;
  size: number;
  totalVolume: number;
  riskLevel: RiskLevel;
  tags: string[];
}

export interface SanctionsInfo {
  sanctioned: boolean;
  lists: string[];
  listedDate?: Date;
  reason?: string;
  jurisdiction?: string;
}

export interface FlowVisualization {
  nodes: VisualizationNode[];
  edges: VisualizationEdge[];
  layout: 'hierarchical' | 'circular' | 'force-directed';
}

export interface VisualizationNode {
  id: string;
  address: string;
  label: string;
  riskLevel: RiskLevel;
  type: 'wallet' | 'exchange' | 'defi' | 'mixer' | 'unknown';
  metadata?: Record<string, any>;
}

export interface VisualizationEdge {
  source: string;
  target: string;
  amount: number;
  token: string;
  timestamp: Date;
  txHash: string;
}

export type RiskCategory = 
  | 'sanctions'
  | 'terrorism'
  | 'dark_market'
  | 'exchange_hack'
  | 'ransomware'
  | 'scam'
  | 'mixer'
  | 'gambling'
  | 'high_risk_exchange'
  | 'defi_protocol';

// Chainalysis Implementation
export class ChainalysisProvider implements BlockchainAnalyticsProvider {
  name = 'Chainalysis';
  private apiKey: string;
  private baseUrl: string;
  private isEnabled: boolean;

  constructor(apiKey: string, baseUrl: string = 'https://api.chainalysis.com/api/v2') {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
    this.isEnabled = !!apiKey;
  }

  isAvailable(): boolean {
    return this.isEnabled;
  }

  async analyze(address: string, transaction?: Transaction): Promise<AnalyticsResult> {
    if (!this.isEnabled) {
      throw new Error('Chainalysis provider is not enabled');
    }

    try {
      // In production, this would make actual API calls to Chainalysis
      // For now, return mock data for development
      logger.debug('Analyzing address with Chainalysis', { address });

      const mockResult: AnalyticsResult = {
        provider: this.name,
        address,
        riskScore: Math.random() * 100,
        riskLevel: this.calculateRiskLevel(Math.random() * 100),
        categories: [],
        exposures: [],
        timestamp: new Date()
      };

      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 100));

      return mockResult;
    } catch (error) {
      logger.error('Chainalysis analysis failed', { error, address });
      throw error;
    }
  }

  async getAddressRisk(address: string): Promise<AddressRiskProfile> {
    if (!this.isEnabled) {
      throw new Error('Chainalysis provider is not enabled');
    }

    // Mock implementation
    const riskScore = Math.random() * 100;
    
    return {
      address,
      overallRisk: this.calculateRiskLevel(riskScore),
      riskScore,
      totalTransactions: Math.floor(Math.random() * 1000),
      totalVolume: Math.random() * 1000000,
      directExposure: [],
      indirectExposure: [],
      tags: []
    };
  }

  async getTransactionFlow(txHash: string): Promise<TransactionFlow> {
    if (!this.isEnabled) {
      throw new Error('Chainalysis provider is not enabled');
    }

    // Mock implementation
    return {
      txHash,
      hops: [],
      totalHops: 0,
      riskExposure: 'low',
      suspiciousPatterns: []
    };
  }

  private calculateRiskLevel(score: number): RiskLevel {
    if (score >= 75) return 'critical';
    if (score >= 50) return 'high';
    if (score >= 25) return 'medium';
    return 'low';
  }
}

// TRM Labs Implementation
export class TRMLabsProvider implements BlockchainAnalyticsProvider {
  name = 'TRM Labs';
  private apiKey: string;
  private baseUrl: string;
  private isEnabled: boolean;

  constructor(apiKey: string, baseUrl: string = 'https://api.trmlabs.com/v1') {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
    this.isEnabled = !!apiKey;
  }

  isAvailable(): boolean {
    return this.isEnabled;
  }

  async analyze(address: string, transaction?: Transaction): Promise<AnalyticsResult> {
    if (!this.isEnabled) {
      throw new Error('TRM Labs provider is not enabled');
    }

    try {
      // In production, this would make actual API calls to TRM Labs
      // For now, return mock data for development
      logger.debug('Analyzing address with TRM Labs', { address });

      const mockResult: AnalyticsResult = {
        provider: this.name,
        address,
        riskScore: Math.random() * 100,
        riskLevel: this.calculateRiskLevel(Math.random() * 100),
        categories: [],
        exposures: [],
        timestamp: new Date()
      };

      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 100));

      return mockResult;
    } catch (error) {
      logger.error('TRM Labs analysis failed', { error, address });
      throw error;
    }
  }

  async getAddressRisk(address: string): Promise<AddressRiskProfile> {
    if (!this.isEnabled) {
      throw new Error('TRM Labs provider is not enabled');
    }

    // Mock implementation
    const riskScore = Math.random() * 100;
    
    return {
      address,
      overallRisk: this.calculateRiskLevel(riskScore),
      riskScore,
      totalTransactions: Math.floor(Math.random() * 1000),
      totalVolume: Math.random() * 1000000,
      directExposure: [],
      indirectExposure: [],
      tags: []
    };
  }

  async getTransactionFlow(txHash: string): Promise<TransactionFlow> {
    if (!this.isEnabled) {
      throw new Error('TRM Labs provider is not enabled');
    }

    // Mock implementation
    return {
      txHash,
      hops: [],
      totalHops: 0,
      riskExposure: 'low',
      suspiciousPatterns: []
    };
  }

  private calculateRiskLevel(score: number): RiskLevel {
    if (score >= 75) return 'critical';
    if (score >= 50) return 'high';
    if (score >= 25) return 'medium';
    return 'low';
  }
}

// Main Blockchain Analytics Service
export class BlockchainAnalyticsService extends EventEmitter {
  private providers: Map<string, BlockchainAnalyticsProvider> = new Map();
  private cache: Map<string, AnalyticsResult> = new Map();
  private cacheExpiry = 60 * 60 * 1000; // 1 hour
  private isInitialized = false;

  constructor() {
    super();
    logger.info('BlockchainAnalyticsService initialized');
  }

  /**
   * Initialize blockchain analytics service
   */
  async initialize(config: {
    chainalysis?: { apiKey: string; baseUrl?: string };
    trmLabs?: { apiKey: string; baseUrl?: string };
  }): Promise<void> {
    try {
      logger.info('Initializing blockchain analytics providers');

      // Initialize Chainalysis if configured
      if (config.chainalysis?.apiKey) {
        const chainalysis = new ChainalysisProvider(
          config.chainalysis.apiKey,
          config.chainalysis.baseUrl
        );
        this.providers.set('chainalysis', chainalysis);
        logger.info('Chainalysis provider initialized');
      }

      // Initialize TRM Labs if configured
      if (config.trmLabs?.apiKey) {
        const trmLabs = new TRMLabsProvider(
          config.trmLabs.apiKey,
          config.trmLabs.baseUrl
        );
        this.providers.set('trmlabs', trmLabs);
        logger.info('TRM Labs provider initialized');
      }

      // Start cache cleanup interval
      setInterval(() => this.cleanupCache(), this.cacheExpiry);

      this.isInitialized = true;
      logger.info('Blockchain analytics service initialization completed');
      
      this.emit('initialized');
    } catch (error) {
      logger.error('Failed to initialize blockchain analytics', { error });
      throw error;
    }
  }

  /**
   * Analyze address using all available providers
   */
  async analyzeAddress(
    address: string,
    transaction?: Transaction,
    preferredProvider?: string
  ): Promise<AnalyticsResult[]> {
    const results: AnalyticsResult[] = [];

    // Check cache first
    const cacheKey = `${address}_${transaction?.id || 'no-tx'}`;
    const cached = this.cache.get(cacheKey);
    if (cached && this.isCacheValid(cached)) {
      return [cached];
    }

    // Use preferred provider if specified and available
    if (preferredProvider && this.providers.has(preferredProvider)) {
      const provider = this.providers.get(preferredProvider)!;
      if (provider.isAvailable()) {
        try {
          const result = await provider.analyze(address, transaction);
          results.push(result);
          this.cache.set(cacheKey, result);
        } catch (error) {
          logger.error(`${preferredProvider} analysis failed`, { error, address });
        }
      }
    } else {
      // Use all available providers
      const analysisPromises = Array.from(this.providers.values())
        .filter(provider => provider.isAvailable())
        .map(async provider => {
          try {
            const result = await provider.analyze(address, transaction);
            return result;
          } catch (error) {
            logger.error(`${provider.name} analysis failed`, { error, address });
            return null;
          }
        });

      const providerResults = await Promise.all(analysisPromises);
      results.push(...providerResults.filter(r => r !== null) as AnalyticsResult[]);
    }

    // Emit analysis completed event
    this.emit('analysisCompleted', { address, results });

    return results;
  }

  /**
   * Get comprehensive address risk profile
   */
  async getAddressRiskProfile(
    address: string,
    includeAllProviders: boolean = false
  ): Promise<AddressRiskProfile> {
    const profiles: AddressRiskProfile[] = [];

    for (const [name, provider] of this.providers) {
      if (provider.isAvailable()) {
        try {
          const profile = await provider.getAddressRisk(address);
          profiles.push(profile);
          
          if (!includeAllProviders) break;
        } catch (error) {
          logger.error(`Failed to get risk profile from ${name}`, { error, address });
        }
      }
    }

    if (profiles.length === 0) {
      throw new Error('No blockchain analytics providers available');
    }

    // Aggregate results if multiple providers
    if (profiles.length === 1) {
      return profiles[0];
    }

    return this.aggregateRiskProfiles(profiles);
  }

  /**
   * Analyze transaction flow
   */
  async analyzeTransactionFlow(
    txHash: string,
    depth: number = 3
  ): Promise<TransactionFlow> {
    for (const [name, provider] of this.providers) {
      if (provider.isAvailable()) {
        try {
          const flow = await provider.getTransactionFlow(txHash);
          
          // Emit flow analysis event
          this.emit('flowAnalyzed', { txHash, flow });
          
          return flow;
        } catch (error) {
          logger.error(`Failed to analyze flow with ${name}`, { error, txHash });
        }
      }
    }

    throw new Error('No blockchain analytics providers available');
  }

  /**
   * Get available providers
   */
  getAvailableProviders(): string[] {
    return Array.from(this.providers.entries())
      .filter(([_, provider]) => provider.isAvailable())
      .map(([name, _]) => name);
  }

  // Private helper methods

  private isCacheValid(result: AnalyticsResult): boolean {
    return Date.now() - result.timestamp.getTime() < this.cacheExpiry;
  }

  private cleanupCache(): void {
    const now = Date.now();
    const expired: string[] = [];

    this.cache.forEach((result, key) => {
      if (now - result.timestamp.getTime() > this.cacheExpiry) {
        expired.push(key);
      }
    });

    expired.forEach(key => this.cache.delete(key));
    
    if (expired.length > 0) {
      logger.debug('Cleaned up expired cache entries', { count: expired.length });
    }
  }

  private aggregateRiskProfiles(profiles: AddressRiskProfile[]): AddressRiskProfile {
    // Take the highest risk score and level
    const maxRiskScore = Math.max(...profiles.map(p => p.riskScore));
    const maxRiskLevel = profiles.reduce((max, p) => {
      const levels: RiskLevel[] = ['low', 'medium', 'high', 'critical'];
      return levels.indexOf(p.overallRisk) > levels.indexOf(max) ? p.overallRisk : max;
    }, 'low' as RiskLevel);

    // Aggregate other metrics
    const totalTransactions = Math.max(...profiles.map(p => p.totalTransactions));
    const totalVolume = Math.max(...profiles.map(p => p.totalVolume));
    const allTags = new Set<string>();
    profiles.forEach(p => p.tags.forEach(tag => allTags.add(tag)));

    return {
      address: profiles[0].address,
      overallRisk: maxRiskLevel,
      riskScore: maxRiskScore,
      totalTransactions,
      totalVolume,
      directExposure: [],
      indirectExposure: [],
      tags: Array.from(allTags),
      firstSeen: profiles[0].firstSeen,
      lastActive: profiles[0].lastActive
    };
  }
}

export default BlockchainAnalyticsService;