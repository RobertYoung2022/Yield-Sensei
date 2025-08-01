/**
 * Protocol Discovery Service
 * Automatically discovers and analyzes new DeFi protocols for yield opportunities
 */

import { EventEmitter } from 'events';
import { Logger } from 'winston';
import { createLogger, format, transports } from 'winston';
import { ProtocolDiscovery, YieldOpportunity, DiscoveryMethod, ProtocolStatus } from '../types';
import { ElizaOSPluginIntegration, ProtocolDiscoveryResult } from './elizaos-plugin-integration';
import { WebScraperEngine } from './web-scraper-engine';
import { SocialIntelligenceEngine } from './social-intelligence-engine';

export interface ProtocolDiscoveryServiceConfig {
  enableAutoDiscovery: boolean;
  discoveryInterval: number;
  sources: DiscoveryMethod[];
  verificationRequired: boolean;
  minTvlThreshold: number;
  minApyThreshold: number;
  maxRiskThreshold: number;
  autoIntegration: boolean;
  communitySubmissions: boolean;
  researchDepth: 'basic' | 'comprehensive';
  
  // ElizaOS integration
  enableElizaOS?: boolean;
  elizaosApiKey?: string;
  elizaosWebhookSecret?: string;
  elizaosPlugins?: string[];
  discoveryThreshold?: number;
  
  // Web scraping
  enableWebScraping?: boolean;
  
  // Social intelligence
  enableSocialIntelligence?: boolean;
  twitterApiKey?: string;
  discordBotToken?: string;
}

export class ProtocolDiscoveryService extends EventEmitter {
  private static instance: ProtocolDiscoveryService;
  private logger: Logger;
  private config: ProtocolDiscoveryServiceConfig;
  private isInitialized: boolean = false;
  private isDiscovering: boolean = false;
  private discoveryInterval?: NodeJS.Timeout;
  private elizaosIntegration?: ElizaOSPluginIntegration;
  private webScraper?: WebScraperEngine;
  private socialIntelligence?: SocialIntelligenceEngine;
  private discoveredProtocols: Map<string, ProtocolDiscovery> = new Map();
  private verifiedOpportunities: YieldOpportunity[] = [];

  private constructor(config: ProtocolDiscoveryServiceConfig) {
    super();
    this.config = config;
    this.logger = createLogger({
      level: 'info',
      format: format.combine(format.timestamp(), format.simple()),
      transports: [
        new transports.Console(),
        new transports.File({ filename: 'logs/protocol-discovery.log' })
      ],
    });
  }

  static getInstance(config?: ProtocolDiscoveryServiceConfig): ProtocolDiscoveryService {
    if (!ProtocolDiscoveryService.instance && config) {
      ProtocolDiscoveryService.instance = new ProtocolDiscoveryService(config);
    } else if (!ProtocolDiscoveryService.instance) {
      throw new Error('ProtocolDiscoveryService must be initialized with config first');
    }
    return ProtocolDiscoveryService.instance;
  }

  async initialize(): Promise<void> {
    this.logger.info('Initializing Protocol Discovery Service...');
    
    try {
      // Initialize ElizaOS plugin integration
      if (this.config.enableElizaOS) {
        this.elizaosIntegration = new ElizaOSPluginIntegration({
          apiKey: this.config.elizaosApiKey,
          webhookSecret: this.config.elizaosWebhookSecret,
          enabledPlugins: this.config.elizaosPlugins || [
            'defi-llama-monitor',
            'twitter-defi-scanner',
            'github-defi-tracker',
            'discord-community-monitor',
            'institutional-flow-detector'
          ],
          discoveryThreshold: this.config.discoveryThreshold || 0.7
        });
        
        await this.elizaosIntegration.initialize();
        
        // Set up event listeners
        this.elizaosIntegration.on('protocol-discovered', (discovery) => {
          this.handleProtocolDiscovery(discovery);
        });
      }

      // Initialize web scraper
      if (this.config.enableWebScraping) {
        this.webScraper = new WebScraperEngine({
          userAgent: 'YieldSensei/1.0',
          requestDelay: 1000,
          maxConcurrency: 5
        });
        await this.webScraper.initialize();
      }

      // Initialize social intelligence
      if (this.config.enableSocialIntelligence) {
        this.socialIntelligence = new SocialIntelligenceEngine({
          twitterApiKey: this.config.twitterApiKey,
          discordBotToken: this.config.discordBotToken
        });
        await this.socialIntelligence.initialize();
      }

      this.isInitialized = true;
      this.logger.info('Protocol Discovery Service initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize Protocol Discovery Service:', error);
      throw error;
    }
  }

  async startDiscovery(): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('Protocol Discovery Service not initialized');
    }

    this.logger.info('Starting protocol discovery...');
    this.isDiscovering = true;
    
    // Run initial discovery
    await this.runDiscoveryPipeline();
    
    // Set up periodic discovery
    if (this.config.discoveryInterval > 0) {
      this.discoveryInterval = setInterval(
        () => this.runDiscoveryPipeline(),
        this.config.discoveryInterval
      );
    }
  }

  async stopDiscovery(): Promise<void> {
    this.logger.info('Stopping protocol discovery...');
    this.isDiscovering = false;
    
    if (this.discoveryInterval) {
      clearInterval(this.discoveryInterval);
      this.discoveryInterval = undefined;
    }
  }

  async discoverNew(): Promise<ProtocolDiscovery[]> {
    const discoveries: ProtocolDiscovery[] = [];

    try {
      // 1. ElizaOS plugin discovery
      if (this.elizaosIntegration) {
        const elizaDiscoveries = await this.elizaosIntegration.scanForNewProtocols();
        for (const result of elizaDiscoveries) {
          discoveries.push(result.protocol);
          this.discoveredProtocols.set(result.protocol.id, result.protocol);
        }
      }

      // 2. Web scraping discovery
      if (this.webScraper) {
        const scrapedProtocols = await this.discoverViaWebScraping();
        discoveries.push(...scrapedProtocols);
      }

      // 3. Social intelligence discovery
      if (this.socialIntelligence) {
        const socialProtocols = await this.discoverViaSocialIntelligence();
        discoveries.push(...socialProtocols);
      }

      // Deduplicate discoveries
      const uniqueDiscoveries = this.deduplicateDiscoveries(discoveries);
      
      this.logger.info(`Discovered ${uniqueDiscoveries.length} new protocols`);
      return uniqueDiscoveries;
    } catch (error) {
      this.logger.error('Protocol discovery failed:', error);
      return [];
    }
  }

  async getVerifiedOpportunities(): Promise<YieldOpportunity[]> {
    return [...this.verifiedOpportunities];
  }

  async processDiscovery(discovery: ProtocolDiscoveryResult): Promise<void> {
    try {
      this.logger.debug('Processing protocol discovery:', discovery.protocol.id);

      // Track adoption signals
      if (this.elizaosIntegration) {
        const adoptionSignals = await this.elizaosIntegration.trackAdoptionSignals(
          discovery.protocol.id
        );
        
        // Update discovery metadata with adoption info
        discovery.protocol.metadata = {
          ...discovery.protocol.metadata,
          adoptionSignals: adoptionSignals.length,
          adoptionScore: adoptionSignals.reduce((sum, s) => sum + s.strength, 0) / adoptionSignals.length
        };
      }

      // Check for institutional interest
      if (this.elizaosIntegration) {
        const hasInstitutionalInterest = await this.elizaosIntegration.detectInstitutionalInterest(
          discovery.protocol.id
        );
        
        if (hasInstitutionalInterest) {
          discovery.protocol.metadata.institutionalInterest = true;
          this.emit('institutional-interest', discovery.protocol);
        }
      }

      // Verify and create yield opportunity if appropriate
      if (discovery.recommendedAction === 'integrate' || discovery.recommendedAction === 'analyze') {
        const opportunity = await this.createYieldOpportunity(discovery.protocol);
        if (opportunity) {
          this.verifiedOpportunities.push(opportunity);
          this.emit('opportunity-verified', opportunity);
        }
      }

      // Mark as processed
      if (this.elizaosIntegration) {
        this.elizaosIntegration.markProtocolAsProcessed(discovery.protocol.id);
      }
    } catch (error) {
      this.logger.error('Failed to process discovery:', error);
    }
  }

  private async runDiscoveryPipeline(): Promise<void> {
    if (!this.isDiscovering) return;

    try {
      this.logger.debug('Running discovery pipeline...');
      
      // Discover new protocols
      const discoveries = await this.discoverNew();
      
      // Process ElizaOS discovery queue
      if (this.elizaosIntegration) {
        const queue = this.elizaosIntegration.getDiscoveryQueue();
        for (const discovery of queue) {
          await this.processDiscovery(discovery);
        }
        this.elizaosIntegration.clearDiscoveryQueue();
      }

      // Emit discovery complete event
      this.emit('discovery-complete', {
        discovered: discoveries.length,
        verified: this.verifiedOpportunities.length
      });
    } catch (error) {
      this.logger.error('Discovery pipeline failed:', error);
      this.emit('discovery-error', error);
    }
  }

  private handleProtocolDiscovery(discovery: ProtocolDiscoveryResult): void {
    this.logger.info(`New protocol discovered: ${discovery.protocol.name} (Score: ${discovery.aggregateScore})`);
    this.emit('protocol-discovered', discovery.protocol);
  }

  private async discoverViaWebScraping(): Promise<ProtocolDiscovery[]> {
    if (!this.webScraper) return [];

    try {
      const protocols = await this.webScraper.scanProtocols();
      return protocols.map(data => ({
        id: data.id,
        name: data.name,
        category: data.category || 'defi',
        chain: data.chain || 'ethereum',
        discoveredAt: new Date(),
        method: DiscoveryMethod.WEB_SCRAPING,
        status: ProtocolStatus.DISCOVERED,
        metadata: data
      }));
    } catch (error) {
      this.logger.error('Web scraping failed:', error);
      return [];
    }
  }

  private async discoverViaSocialIntelligence(): Promise<ProtocolDiscovery[]> {
    if (!this.socialIntelligence) return [];

    try {
      const protocols = await this.socialIntelligence.scanTrending();
      return protocols.map(data => ({
        id: data.id,
        name: data.name,
        category: 'defi',
        chain: data.chain || 'ethereum',
        discoveredAt: new Date(),
        method: DiscoveryMethod.SOCIAL_MONITORING,
        status: ProtocolStatus.DISCOVERED,
        metadata: data
      }));
    } catch (error) {
      this.logger.error('Social intelligence scan failed:', error);
      return [];
    }
  }

  private deduplicateDiscoveries(discoveries: ProtocolDiscovery[]): ProtocolDiscovery[] {
    const seen = new Set<string>();
    return discoveries.filter(discovery => {
      if (seen.has(discovery.id)) {
        return false;
      }
      seen.add(discovery.id);
      return true;
    });
  }

  private async createYieldOpportunity(protocol: ProtocolDiscovery): Promise<YieldOpportunity | null> {
    try {
      // This would integrate with yield optimization engine
      // For now, create a basic opportunity
      return {
        id: `opp-${protocol.id}`,
        protocol: protocol.name,
        asset: 'USDC', // Would be determined by protocol analysis
        apy: 0, // Would be calculated
        tvl: 0, // Would be fetched
        risk: {
          score: 0.5,
          factors: []
        },
        chain: protocol.chain,
        metadata: protocol.metadata
      };
    } catch (error) {
      this.logger.error('Failed to create yield opportunity:', error);
      return null;
    }
  }

  getStatus(): any {
    return { 
      isInitialized: this.isInitialized, 
      isRunning: this.isDiscovering,
      discoveredProtocols: this.discoveredProtocols.size,
      verifiedOpportunities: this.verifiedOpportunities.length,
      engines: {
        elizaos: !!this.elizaosIntegration,
        webScraper: !!this.webScraper,
        socialIntelligence: !!this.socialIntelligence
      }
    };
  }

  async shutdown(): Promise<void> {
    await this.stopDiscovery();
    
    if (this.elizaosIntegration) {
      await this.elizaosIntegration.shutdown();
    }
    
    if (this.webScraper) {
      await this.webScraper.shutdown();
    }
    
    if (this.socialIntelligence) {
      await this.socialIntelligence.shutdown();
    }
    
    this.discoveredProtocols.clear();
    this.verifiedOpportunities = [];
    
    this.logger.info('Protocol Discovery Service shutdown complete');
  }
}