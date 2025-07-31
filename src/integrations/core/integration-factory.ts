/**
 * Integration Factory
 * Factory for creating and managing service integrations with dependency injection
 */

import Logger from '@/shared/logging/logger';
import { ServiceRegistry } from './service-registry';
import { ConfigManager } from './config-manager';
import {
  ServiceFactory,
  ServiceConfig,
  ServiceMetadata,
  IntegrationContext,
  ServiceRegistration
} from './types';

// Import data provider clients
import { CoinGeckoClient } from '../data/coingecko-client';
import { DefiLlamaClient } from '../data/defillama-client';
import { DuneClient } from '../data/dune-client';
import { MoralisClient } from '../data/moralis-client';
import { DataNormalizer } from '../data/data-normalizer';

// Import blockchain clients
import { EthereumProvider } from '../blockchain/ethereum-provider';
import { PolygonProvider } from '../blockchain/polygon-provider';
import { BinanceSmartChainProvider } from '../blockchain/bsc-provider';
import { AvalancheProvider } from '../blockchain/avalanche-provider';

// Import social media clients
import { TwitterClient } from '../social/twitter-client';
import { DiscordClient } from '../social/discord-client';
import { TelegramClient } from '../social/telegram-client';

// Import AI clients
import { PerplexityClient } from '../ai/perplexity-client';
import { OpenAIClient } from '../ai/openai-client';

const logger = Logger.getLogger('integration-factory');

export class IntegrationFactory {
  private serviceRegistry: ServiceRegistry;
  private configManager: ConfigManager;
  private factories: Map<string, ServiceFactory> = new Map();
  private instances: Map<string, any> = new Map();
  private mockMode = false;

  constructor(serviceRegistry: ServiceRegistry, configManager: ConfigManager) {
    this.serviceRegistry = serviceRegistry;
    this.configManager = configManager;
    this.registerFactories();
  }

  /**
   * Enable mock mode for testing
   */
  enableMockMode(enabled: boolean = true): void {
    this.mockMode = enabled;
    logger.info(`Mock mode ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Create a service instance
   */
  async createService<T = any>(
    serviceId: string,
    factoryKey: string,
    metadata: ServiceMetadata,
    context?: IntegrationContext
  ): Promise<T> {
    try {
      logger.info(`Creating service: ${serviceId} (${factoryKey})`);

      // Get factory
      const factory = this.factories.get(factoryKey);
      if (!factory) {
        throw new Error(`Factory not found: ${factoryKey}`);
      }

      // Get configuration
      const config = this.configManager.getServiceConfig(serviceId);
      if (!config) {
        throw new Error(`Configuration not found for service: ${serviceId}`);
      }

      // Validate configuration
      if (!factory.validate(config)) {
        throw new Error(`Invalid configuration for service: ${serviceId}`);
      }

      // Create instance (mock or real)
      let instance: T;
      if (this.mockMode) {
        instance = this.createMockInstance<T>(factoryKey, config);
      } else {
        instance = await factory.create(config);
      }

      // Initialize if possible
      if (instance && typeof (instance as any).initialize === 'function') {
        await (instance as any).initialize();
      }

      // Register service
      await this.serviceRegistry.register(serviceId, metadata, config, instance);

      // Cache instance
      this.instances.set(serviceId, instance);

      logger.info(`Service created successfully: ${serviceId}`);
      return instance;
    } catch (error) {
      logger.error(`Failed to create service ${serviceId}:`, error);
      throw error;
    }
  }

  /**
   * Get existing service instance
   */
  getService<T = any>(serviceId: string): T | null {
    const instance = this.instances.get(serviceId);
    return instance || null;
  }

  /**
   * Destroy service instance
   */
  async destroyService(serviceId: string): Promise<void> {
    try {
      const instance = this.instances.get(serviceId);
      if (instance) {
        // Cleanup if possible
        if (typeof instance.cleanup === 'function') {
          await instance.cleanup();
        }

        this.instances.delete(serviceId);
      }

      // Deregister from service registry
      await this.serviceRegistry.deregister(serviceId);

      logger.info(`Service destroyed: ${serviceId}`);
    } catch (error) {
      logger.error(`Failed to destroy service ${serviceId}:`, error);
      throw error;
    }
  }

  /**
   * Create data provider service
   */
  async createDataProvider(
    providerId: string,
    provider: 'coingecko' | 'defillama' | 'dune' | 'moralis',
    context?: IntegrationContext
  ): Promise<any> {
    const metadata: ServiceMetadata = {
      name: `${provider}-client`,
      version: '1.0.0',
      type: 'data',
      provider,
      description: `${provider} data provider client`
    };

    return this.createService(providerId, provider, metadata, context);
  }

  /**
   * Create blockchain provider service
   */
  async createBlockchainProvider(
    providerId: string,
    chain: 'ethereum' | 'polygon' | 'bsc' | 'avalanche',
    context?: IntegrationContext
  ): Promise<any> {
    const metadata: ServiceMetadata = {
      name: `${chain}-provider`,
      version: '1.0.0',
      type: 'blockchain',
      provider: chain,
      description: `${chain} blockchain provider`
    };

    return this.createService(providerId, chain, metadata, context);
  }

  /**
   * Create social media service
   */
  async createSocialService(
    serviceId: string,
    platform: 'twitter' | 'discord' | 'telegram',
    context?: IntegrationContext
  ): Promise<any> {
    const metadata: ServiceMetadata = {
      name: `${platform}-client`,
      version: '1.0.0',
      type: 'social',
      provider: platform,
      description: `${platform} social media client`
    };

    return this.createService(serviceId, platform, metadata, context);
  }

  /**
   * Create AI service
   */
  async createAIService(
    serviceId: string,
    provider: 'perplexity' | 'openai',
    context?: IntegrationContext
  ): Promise<any> {
    const metadata: ServiceMetadata = {
      name: `${provider}-client`,
      version: '1.0.0',
      type: 'ai',
      provider,
      description: `${provider} AI service client`
    };

    return this.createService(serviceId, provider, metadata, context);
  }

  /**
   * Create data normalizer
   */
  async createDataNormalizer(
    serviceId: string = 'data-normalizer',
    context?: IntegrationContext
  ): Promise<DataNormalizer> {
    const metadata: ServiceMetadata = {
      name: 'data-normalizer',
      version: '1.0.0',
      type: 'data',
      provider: 'internal',
      description: 'Data normalization service'
    };

    return this.createService<DataNormalizer>(serviceId, 'data-normalizer', metadata, context);
  }

  /**
   * Create service with dependencies
   */
  async createServiceWithDependencies<T = any>(
    serviceId: string,
    factoryKey: string,
    metadata: ServiceMetadata,
    dependencies: string[],
    context?: IntegrationContext
  ): Promise<T> {
    // Ensure dependencies are created first
    for (const depId of dependencies) {
      if (!this.instances.has(depId)) {
        throw new Error(`Dependency not found: ${depId}`);
      }
    }

    // Create service with dependency injection
    const service = await this.createService<T>(serviceId, factoryKey, metadata, context);

    // Inject dependencies if service supports it
    if (service && typeof (service as any).injectDependencies === 'function') {
      const deps = dependencies.reduce((acc, depId) => {
        acc[depId] = this.instances.get(depId);
        return acc;
      }, {} as Record<string, any>);

      await (service as any).injectDependencies(deps);
    }

    return service;
  }

  /**
   * Register all service factories
   */
  private registerFactories(): void {
    // Data provider factories
    this.factories.set('coingecko', new CoinGeckoFactory());
    this.factories.set('defillama', new DefiLlamaFactory());
    this.factories.set('dune', new DuneFactory());
    this.factories.set('moralis', new MoralisFactory());
    this.factories.set('data-normalizer', new DataNormalizerFactory());

    // Blockchain provider factories
    this.factories.set('ethereum', new EthereumFactory());
    this.factories.set('polygon', new PolygonFactory());
    this.factories.set('bsc', new BSCFactory());
    this.factories.set('avalanche', new AvalancheFactory());

    // Social media factories
    this.factories.set('twitter', new TwitterFactory());
    this.factories.set('discord', new DiscordFactory());
    this.factories.set('telegram', new TelegramFactory());

    // AI service factories
    this.factories.set('perplexity', new PerplexityFactory());
    this.factories.set('openai', new OpenAIFactory());

    logger.info(`Registered ${this.factories.size} service factories`);
  }

  /**
   * Create mock instance for testing
   */
  private createMockInstance<T>(factoryKey: string, config: ServiceConfig): T {
    const mockInstance = {
      provider: factoryKey,
      config,
      initialize: async () => Promise.resolve(),
      healthCheck: async () => Promise.resolve(true),
      cleanup: async () => Promise.resolve()
    };

    logger.debug(`Created mock instance for ${factoryKey}`);
    return mockInstance as T;
  }

  /**
   * Get available factories
   */
  getAvailableFactories(): string[] {
    return Array.from(this.factories.keys());
  }

  /**
   * Check if factory exists
   */
  hasFactory(factoryKey: string): boolean {
    return this.factories.has(factoryKey);
  }

  /**
   * Get default configuration for factory
   */
  getDefaultConfig(factoryKey: string): Partial<ServiceConfig> | null {
    const factory = this.factories.get(factoryKey);
    return factory ? factory.getDefaultConfig() : null;
  }

  /**
   * Cleanup all instances
   */
  async cleanup(): Promise<void> {
    logger.info('Cleaning up integration factory...');

    const cleanupPromises = Array.from(this.instances.keys()).map(
      serviceId => this.destroyService(serviceId)
    );

    await Promise.allSettled(cleanupPromises);
    this.instances.clear();

    logger.info('Integration factory cleanup complete');
  }
}

// Service Factory Implementations

class CoinGeckoFactory implements ServiceFactory<CoinGeckoClient> {
  async create(config: ServiceConfig): Promise<CoinGeckoClient> {
    return new CoinGeckoClient({
      apiKey: config.apiKey,
      baseUrl: config.baseUrl,
      timeout: config.timeout,
      retries: config.retries,
      rateLimitRpm: config.rateLimitRpm,
      cacheTTL: config.cacheTTL,
      enableCaching: config.enableCaching
    });
  }

  validate(config: ServiceConfig): boolean {
    return Boolean(config.apiKey);
  }

  getDefaultConfig(): Partial<ServiceConfig> {
    return {
      enabled: true,
      baseUrl: 'https://pro-api.coingecko.com/api/v3',
      timeout: 10000,
      retries: 3,
      rateLimitRpm: 500,
      cacheTTL: 60000,
      enableCaching: true
    };
  }
}

class DefiLlamaFactory implements ServiceFactory<DefiLlamaClient> {
  async create(config: ServiceConfig): Promise<DefiLlamaClient> {
    return new DefiLlamaClient({
      baseUrl: config.baseUrl,
      timeout: config.timeout,
      retries: config.retries,
      rateLimitRpm: config.rateLimitRpm,
      cacheTTL: config.cacheTTL,
      enableCaching: config.enableCaching
    });
  }

  validate(config: ServiceConfig): boolean {
    return true; // DefiLlama is a public API
  }

  getDefaultConfig(): Partial<ServiceConfig> {
    return {
      enabled: true,
      baseUrl: 'https://api.llama.fi',
      timeout: 15000,
      retries: 3,
      rateLimitRpm: 300,
      cacheTTL: 300000,
      enableCaching: true
    };
  }
}

class DuneFactory implements ServiceFactory<DuneClient> {
  async create(config: ServiceConfig): Promise<DuneClient> {
    return new DuneClient({
      apiKey: config.apiKey,
      baseUrl: config.baseUrl,
      timeout: config.timeout,
      retries: config.retries,
      rateLimitRpm: config.rateLimitRpm,
      cacheTTL: config.cacheTTL,
      enableCaching: config.enableCaching
    });
  }

  validate(config: ServiceConfig): boolean {
    return Boolean(config.apiKey);
  }

  getDefaultConfig(): Partial<ServiceConfig> {
    return {
      enabled: true,
      baseUrl: 'https://api.dune.com/api/v1',
      timeout: 30000,
      retries: 3,
      rateLimitRpm: 200,
      cacheTTL: 300000,
      enableCaching: true
    };
  }
}

class MoralisFactory implements ServiceFactory<MoralisClient> {
  async create(config: ServiceConfig): Promise<MoralisClient> {
    return new MoralisClient({
      apiKey: config.apiKey,
      baseUrl: config.baseUrl,
      timeout: config.timeout,
      retries: config.retries,
      rateLimitRpm: config.rateLimitRpm,
      cacheTTL: config.cacheTTL,
      enableCaching: config.enableCaching
    });
  }

  validate(config: ServiceConfig): boolean {
    return Boolean(config.apiKey);
  }

  getDefaultConfig(): Partial<ServiceConfig> {
    return {
      enabled: true,
      baseUrl: 'https://deep-index.moralis.io/api/v2.2',
      timeout: 15000,
      retries: 3,
      rateLimitRpm: 1500,
      cacheTTL: 300000,
      enableCaching: true
    };
  }
}

class DataNormalizerFactory implements ServiceFactory<DataNormalizer> {
  async create(config: ServiceConfig): Promise<DataNormalizer> {
    return new DataNormalizer({
      enableNormalization: true,
      outputFormat: 'json',
      timestampFormat: 'unix',
      numberPrecision: 8,
      currencyConversion: {
        enabled: false,
        baseCurrency: 'USD',
        exchangeRates: {}
      },
      fieldMapping: {},
      dataValidation: {
        enabled: true,
        strictMode: false,
        requiredFields: []
      }
    });
  }

  validate(config: ServiceConfig): boolean {
    return true;
  }

  getDefaultConfig(): Partial<ServiceConfig> {
    return {
      enabled: true,
      enableCaching: false
    };
  }
}

// Blockchain provider factories (simplified - would need actual implementations)
class EthereumFactory implements ServiceFactory {
  async create(config: ServiceConfig): Promise<any> {
    return new EthereumProvider(config);
  }
  validate(config: ServiceConfig): boolean { return Boolean(config.apiKey); }
  getDefaultConfig(): Partial<ServiceConfig> {
    return { enabled: true, timeout: 10000, retries: 3 };
  }
}

class PolygonFactory implements ServiceFactory {
  async create(config: ServiceConfig): Promise<any> {
    return new PolygonProvider(config);
  }
  validate(config: ServiceConfig): boolean { return Boolean(config.apiKey); }
  getDefaultConfig(): Partial<ServiceConfig> {
    return { enabled: true, timeout: 10000, retries: 3 };
  }
}

class BSCFactory implements ServiceFactory {
  async create(config: ServiceConfig): Promise<any> {
    return new BinanceSmartChainProvider(config);
  }
  validate(config: ServiceConfig): boolean { return Boolean(config.apiKey); }
  getDefaultConfig(): Partial<ServiceConfig> {
    return { enabled: true, timeout: 10000, retries: 3 };
  }
}

class AvalancheFactory implements ServiceFactory {
  async create(config: ServiceConfig): Promise<any> {
    return new AvalancheProvider(config);
  }
  validate(config: ServiceConfig): boolean { return Boolean(config.apiKey); }
  getDefaultConfig(): Partial<ServiceConfig> {
    return { enabled: true, timeout: 10000, retries: 3 };
  }
}

// Social media factories (simplified - would need actual implementations)
class TwitterFactory implements ServiceFactory {
  async create(config: ServiceConfig): Promise<any> {
    return new TwitterClient(config);
  }
  validate(config: ServiceConfig): boolean { return Boolean(config.apiKey); }
  getDefaultConfig(): Partial<ServiceConfig> {
    return { enabled: true, timeout: 10000, retries: 3 };
  }
}

class DiscordFactory implements ServiceFactory {
  async create(config: ServiceConfig): Promise<any> {
    return new DiscordClient(config);
  }
  validate(config: ServiceConfig): boolean { return Boolean(config.apiKey); }
  getDefaultConfig(): Partial<ServiceConfig> {
    return { enabled: true, timeout: 10000, retries: 3 };
  }
}

class TelegramFactory implements ServiceFactory {
  async create(config: ServiceConfig): Promise<any> {
    return new TelegramClient(config);
  }
  validate(config: ServiceConfig): boolean { return Boolean(config.apiKey); }
  getDefaultConfig(): Partial<ServiceConfig> {
    return { enabled: true, timeout: 10000, retries: 3 };
  }
}

// AI service factories (simplified - would need actual implementations)
class PerplexityFactory implements ServiceFactory {
  async create(config: ServiceConfig): Promise<any> {
    return new PerplexityClient(config);
  }
  validate(config: ServiceConfig): boolean { return Boolean(config.apiKey); }
  getDefaultConfig(): Partial<ServiceConfig> {
    return { enabled: true, timeout: 30000, retries: 3 };
  }
}

class OpenAIFactory implements ServiceFactory {
  async create(config: ServiceConfig): Promise<any> {
    return new OpenAIClient(config);
  }
  validate(config: ServiceConfig): boolean { return Boolean(config.apiKey); }
  getDefaultConfig(): Partial<ServiceConfig> {
    return { enabled: true, timeout: 30000, retries: 3 };
  }
}