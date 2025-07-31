/**
 * Configuration Manager
 * Centralized configuration management with environment-based loading and dynamic updates
 */

import { EventEmitter } from 'events';
import { readFileSync, writeFileSync, existsSync, watchFile } from 'fs';
import { join } from 'path';
import Logger from '@/shared/logging/logger';
import {
  EnvironmentConfig,
  ServiceConfig,
  ConfigurationSchema,
  ServiceMonitorConfig
} from './types';

const logger = Logger.getLogger('config-manager');

export class ConfigManager extends EventEmitter {
  private config: EnvironmentConfig;
  private configPath: string;
  private schema: ConfigurationSchema;
  private watchers: Map<string, NodeJS.Timer> = new Map();
  private initialized = false;

  constructor(configPath?: string) {
    super();
    this.configPath = configPath || this.getDefaultConfigPath();
    this.config = this.getDefaultConfig();
    this.schema = this.getConfigurationSchema();
  }

  /**
   * Initialize configuration manager
   */
  async initialize(): Promise<void> {
    try {
      logger.info('Initializing configuration manager...');

      // Load configuration from file if exists
      if (existsSync(this.configPath)) {
        await this.loadConfiguration();
      } else {
        logger.info(`Configuration file not found at ${this.configPath}, using defaults`);
        await this.saveConfiguration();
      }

      // Setup file watching for hot reload
      this.setupFileWatching();

      // Load environment variables
      this.loadEnvironmentVariables();

      this.initialized = true;
      this.emit('initialized', this.config);

      logger.info('Configuration manager initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize configuration manager:', error);
      throw error;
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): EnvironmentConfig {
    return { ...this.config };
  }

  /**
   * Get service configuration
   */
  getServiceConfig(serviceId: string): ServiceConfig | undefined {
    return this.config.services[serviceId];
  }

  /**
   * Set service configuration
   */
  async setServiceConfig(serviceId: string, config: ServiceConfig): Promise<void> {
    try {
      // Validate configuration
      this.validateServiceConfig(config);

      this.config.services[serviceId] = { ...config };
      
      await this.saveConfiguration();
      this.emit('service_config_updated', { serviceId, config });

      logger.info(`Service configuration updated: ${serviceId}`, config);
    } catch (error) {
      logger.error(`Failed to set service configuration for ${serviceId}:`, error);
      throw error;
    }
  }

  /**
   * Update service configuration partially
   */
  async updateServiceConfig(serviceId: string, updates: Partial<ServiceConfig>): Promise<void> {
    const existing = this.getServiceConfig(serviceId);
    if (!existing) {
      throw new Error(`Service configuration not found: ${serviceId}`);
    }

    const updated = { ...existing, ...updates };
    await this.setServiceConfig(serviceId, updated);
  }

  /**
   * Remove service configuration
   */
  async removeServiceConfig(serviceId: string): Promise<void> {
    if (this.config.services[serviceId]) {
      delete this.config.services[serviceId];
      await this.saveConfiguration();
      this.emit('service_config_removed', { serviceId });
      logger.info(`Service configuration removed: ${serviceId}`);
    }
  }

  /**
   * Get monitoring configuration
   */
  getMonitoringConfig(): ServiceMonitorConfig {
    return { ...this.config.monitoring };
  }

  /**
   * Set monitoring configuration
   */
  async setMonitoringConfig(config: ServiceMonitorConfig): Promise<void> {
    try {
      this.validateMonitoringConfig(config);
      
      this.config.monitoring = { ...config };
      
      await this.saveConfiguration();
      this.emit('monitoring_config_updated', config);

      logger.info('Monitoring configuration updated', config);
    } catch (error) {
      logger.error('Failed to set monitoring configuration:', error);
      throw error;
    }
  }

  /**
   * Get secret value
   */
  getSecret(key: string): string | undefined {
    return this.config.secrets[key];
  }

  /**
   * Set secret value
   */
  async setSecret(key: string, value: string): Promise<void> {
    this.config.secrets[key] = value;
    await this.saveConfiguration();
    this.emit('secret_updated', { key });
    logger.info(`Secret updated: ${key}`);
  }

  /**
   * Remove secret
   */
  async removeSecret(key: string): Promise<void> {
    if (this.config.secrets[key]) {
      delete this.config.secrets[key];
      await this.saveConfiguration();
      this.emit('secret_removed', { key });
      logger.info(`Secret removed: ${key}`);
    }
  }

  /**
   * Validate entire configuration
   */
  validateConfiguration(config: EnvironmentConfig): void {
    // Validate environment
    if (!['development', 'staging', 'production'].includes(config.environment)) {
      throw new Error(`Invalid environment: ${config.environment}`);
    }

    // Validate log level
    if (!['debug', 'info', 'warn', 'error'].includes(config.logLevel)) {
      throw new Error(`Invalid log level: ${config.logLevel}`);
    }

    // Validate services
    for (const [serviceId, serviceConfig] of Object.entries(config.services)) {
      try {
        this.validateServiceConfig(serviceConfig);
      } catch (error) {
        throw new Error(`Invalid service configuration for ${serviceId}: ${error.message}`);
      }
    }

    // Validate monitoring config
    this.validateMonitoringConfig(config.monitoring);
  }

  /**
   * Validate service configuration
   */
  validateServiceConfig(config: ServiceConfig): void {
    if (typeof config.enabled !== 'boolean') {
      throw new Error('enabled must be a boolean');
    }

    if (config.timeout !== undefined && (typeof config.timeout !== 'number' || config.timeout <= 0)) {
      throw new Error('timeout must be a positive number');
    }

    if (config.retries !== undefined && (typeof config.retries !== 'number' || config.retries < 0)) {
      throw new Error('retries must be a non-negative number');
    }

    if (config.rateLimitRpm !== undefined && (typeof config.rateLimitRpm !== 'number' || config.rateLimitRpm <= 0)) {
      throw new Error('rateLimitRpm must be a positive number');
    }

    if (config.cacheTTL !== undefined && (typeof config.cacheTTL !== 'number' || config.cacheTTL <= 0)) {
      throw new Error('cacheTTL must be a positive number');
    }

    if (config.enableCaching !== undefined && typeof config.enableCaching !== 'boolean') {
      throw new Error('enableCaching must be a boolean');
    }
  }

  /**
   * Validate monitoring configuration
   */
  validateMonitoringConfig(config: ServiceMonitorConfig): void {
    if (typeof config.healthCheckInterval !== 'number' || config.healthCheckInterval <= 0) {
      throw new Error('healthCheckInterval must be a positive number');
    }

    if (typeof config.healthCheckTimeout !== 'number' || config.healthCheckTimeout <= 0) {
      throw new Error('healthCheckTimeout must be a positive number');
    }

    if (typeof config.retentionPeriod !== 'number' || config.retentionPeriod <= 0) {
      throw new Error('retentionPeriod must be a positive number');
    }

    const { alertThresholds } = config;
    if (typeof alertThresholds.errorRate !== 'number' || alertThresholds.errorRate < 0 || alertThresholds.errorRate > 1) {
      throw new Error('alertThresholds.errorRate must be between 0 and 1');
    }

    if (typeof alertThresholds.responseTime !== 'number' || alertThresholds.responseTime <= 0) {
      throw new Error('alertThresholds.responseTime must be a positive number');
    }

    if (typeof alertThresholds.uptime !== 'number' || alertThresholds.uptime < 0 || alertThresholds.uptime > 1) {
      throw new Error('alertThresholds.uptime must be between 0 and 1');
    }
  }

  /**
   * Load configuration from file
   */
  private async loadConfiguration(): Promise<void> {
    try {
      const configData = readFileSync(this.configPath, 'utf-8');
      const parsedConfig = JSON.parse(configData);
      
      // Validate loaded configuration
      this.validateConfiguration(parsedConfig);
      
      this.config = parsedConfig;
      logger.info(`Configuration loaded from ${this.configPath}`);
    } catch (error) {
      logger.error(`Failed to load configuration from ${this.configPath}:`, error);
      throw error;
    }
  }

  /**
   * Save configuration to file
   */
  private async saveConfiguration(): Promise<void> {
    try {
      const configData = JSON.stringify(this.config, null, 2);
      writeFileSync(this.configPath, configData, 'utf-8');
      logger.debug(`Configuration saved to ${this.configPath}`);
    } catch (error) {
      logger.error(`Failed to save configuration to ${this.configPath}:`, error);
      throw error;
    }
  }

  /**
   * Setup file watching for hot reload
   */
  private setupFileWatching(): void {
    if (this.watchers.has(this.configPath)) {
      return;
    }

    watchFile(this.configPath, { interval: 1000 }, async (curr, prev) => {
      if (curr.mtime > prev.mtime) {
        try {
          logger.info('Configuration file changed, reloading...');
          await this.loadConfiguration();
          this.emit('config_reloaded', this.config);
          logger.info('Configuration reloaded successfully');
        } catch (error) {
          logger.error('Failed to reload configuration:', error);
          this.emit('config_reload_error', error);
        }
      }
    });

    this.watchers.set(this.configPath, process.hrtime() as any);
    logger.debug(`File watching setup for ${this.configPath}`);
  }

  /**
   * Load environment variables
   */
  private loadEnvironmentVariables(): void {
    // Override with environment variables if present
    if (process.env.NODE_ENV) {
      this.config.environment = process.env.NODE_ENV as any;
    }

    if (process.env.LOG_LEVEL) {
      this.config.logLevel = process.env.LOG_LEVEL as any;
    }

    // Load secrets from environment
    const envSecrets: Record<string, string> = {};
    for (const [key, value] of Object.entries(process.env)) {
      if (key.endsWith('_API_KEY') || key.endsWith('_SECRET') || key.endsWith('_TOKEN')) {
        envSecrets[key] = value!;
      }
    }

    this.config.secrets = { ...this.config.secrets, ...envSecrets };

    logger.debug('Environment variables loaded');
  }

  /**
   * Get default configuration path
   */
  private getDefaultConfigPath(): string {
    const env = process.env.NODE_ENV || 'development';
    return join(process.cwd(), 'config', `${env}.json`);
  }

  /**
   * Get default configuration
   */
  private getDefaultConfig(): EnvironmentConfig {
    return {
      environment: 'development',
      logLevel: 'info',
      services: {},
      monitoring: {
        healthCheckInterval: 30000, // 30 seconds
        healthCheckTimeout: 5000,   // 5 seconds
        alertThresholds: {
          errorRate: 0.1,           // 10%
          responseTime: 5000,       // 5 seconds
          uptime: 0.95              // 95%
        },
        retentionPeriod: 86400000   // 24 hours
      },
      secrets: {}
    };
  }

  /**
   * Get configuration schema
   */
  private getConfigurationSchema(): ConfigurationSchema {
    return {
      environment: {
        type: 'string',
        required: true,
        validation: (value) => ['development', 'staging', 'production'].includes(value)
      },
      logLevel: {
        type: 'string',
        required: true,
        validation: (value) => ['debug', 'info', 'warn', 'error'].includes(value)
      },
      services: {
        type: 'object',
        required: true
      },
      monitoring: {
        type: 'object',
        required: true
      },
      secrets: {
        type: 'object',
        required: false,
        default: {}
      }
    };
  }

  /**
   * Export configuration
   */
  exportConfiguration(): string {
    // Remove sensitive data from export
    const exportConfig = {
      ...this.config,
      secrets: Object.keys(this.config.secrets).reduce((acc, key) => {
        acc[key] = '[REDACTED]';
        return acc;
      }, {} as Record<string, string>)
    };

    return JSON.stringify(exportConfig, null, 2);
  }

  /**
   * Import configuration
   */
  async importConfiguration(configJson: string): Promise<void> {
    try {
      const imported = JSON.parse(configJson);
      
      // Don't import secrets
      delete imported.secrets;
      
      this.validateConfiguration({ ...this.config, ...imported });
      this.config = { ...this.config, ...imported };
      
      await this.saveConfiguration();
      this.emit('config_imported', this.config);
      
      logger.info('Configuration imported successfully');
    } catch (error) {
      logger.error('Failed to import configuration:', error);
      throw error;
    }
  }

  /**
   * Reset to defaults
   */
  async resetToDefaults(): Promise<void> {
    const secrets = { ...this.config.secrets };
    this.config = this.getDefaultConfig();
    this.config.secrets = secrets; // Preserve secrets
    
    await this.saveConfiguration();
    this.emit('config_reset', this.config);
    
    logger.info('Configuration reset to defaults');
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    // Stop file watchers
    this.watchers.clear();
    
    // Remove all listeners
    this.removeAllListeners();
    
    logger.info('Configuration manager cleanup complete');
  }
}