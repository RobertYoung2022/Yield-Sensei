/**
 * Satellite Factory
 * Task 43.4: Replace mock agents with real satellite instances
 * 
 * Factory for creating and managing real satellite agent instances
 */

import { AgentId, AgentType, AgentConfig, SatelliteAgent } from '@/types';
import { getLogger } from "../../shared/utils/logger";

// Satellite agent imports - handled gracefully if not available
let SageSatelliteAgent: any, DEFAULT_SAGE_CONFIG: any;
let EchoSatelliteAgent: any, DEFAULT_ECHO_CONFIG: any;
let PulseSatelliteAgent: any, DEFAULT_PULSE_CONFIG: any;
let OracleSatelliteAgent: any, DEFAULT_ORACLE_CONFIG: any;
let BridgeSatelliteAgent: any, DEFAULT_BRIDGE_CONFIG: any;
let FuelSatelliteAgent: any, DEFAULT_FUEL_CONFIG: any;
let AegisSatelliteAgent: any, DEFAULT_AEGIS_CONFIG: any;

// Try to import all satellite agents, but handle missing ones gracefully
try {
  const sageImport = require('@/satellites/sage/sage-satellite');
  SageSatelliteAgent = sageImport.SageSatelliteAgent;
  DEFAULT_SAGE_CONFIG = sageImport.DEFAULT_SAGE_CONFIG || {};
} catch (error) {
  logger.warn('Sage satellite not available:', error);
}

try {
  const echoImport = require('@/satellites/echo/echo-satellite');
  EchoSatelliteAgent = echoImport.EchoSatelliteAgent;
  DEFAULT_ECHO_CONFIG = echoImport.DEFAULT_ECHO_CONFIG || {};
} catch (error) {
  logger.warn('Echo satellite not available:', error);
}

try {
  const pulseImport = require('@/satellites/pulse/pulse-satellite');
  PulseSatelliteAgent = pulseImport.PulseSatelliteAgent;
  DEFAULT_PULSE_CONFIG = pulseImport.DEFAULT_PULSE_CONFIG || {};
} catch (error) {
  logger.warn('Pulse satellite not available:', error);
}

try {
  const oracleImport = require('@/satellites/oracle/oracle-satellite');
  OracleSatelliteAgent = oracleImport.OracleSatelliteAgent;
  DEFAULT_ORACLE_CONFIG = oracleImport.DEFAULT_ORACLE_CONFIG || {};
} catch (error) {
  logger.warn('Oracle satellite not available:', error);
}

try {
  const bridgeImport = require('@/satellites/bridge/bridge-satellite');
  BridgeSatelliteAgent = bridgeImport.BridgeSatelliteAgent;
  DEFAULT_BRIDGE_CONFIG = bridgeImport.DEFAULT_BRIDGE_CONFIG || {};
} catch (error) {
  logger.warn('Bridge satellite not available:', error);
}

try {
  const fuelImport = require('@/satellites/fuel/fuel-satellite');
  FuelSatelliteAgent = fuelImport.FuelSatelliteAgent;
  DEFAULT_FUEL_CONFIG = fuelImport.DEFAULT_FUEL_CONFIG || {};
} catch (error) {
  logger.warn('Fuel satellite not available:', error);
}

try {
  const aegisImport = require('@/satellites/aegis/aegis-satellite');
  AegisSatelliteAgent = aegisImport.AegisSatelliteAgent;
  DEFAULT_AEGIS_CONFIG = aegisImport.DEFAULT_AEGIS_CONFIG || {};
} catch (error) {
  logger.warn('Aegis satellite not available:', error);
}

const logger = getLogger('satellite-factory');

/**
 * Satellite Factory Configuration
 */
export interface SatelliteFactoryConfig {
  enableSecureCommunication: boolean;
  enableHealthMonitoring: boolean;
  enablePerformanceTracking: boolean;
  maxConcurrentTasks: number;
  defaultTimeout: number;
}

export const DEFAULT_SATELLITE_FACTORY_CONFIG: SatelliteFactoryConfig = {
  enableSecureCommunication: true,
  enableHealthMonitoring: true,
  enablePerformanceTracking: true,
  maxConcurrentTasks: 50,
  defaultTimeout: 30000,
};

/**
 * Satellite Factory Type
 */
export type SatelliteFactory = (config: AgentConfig) => Promise<SatelliteAgent>;

/**
 * Satellite Factory Manager
 * Creates and manages instances of satellite agents
 */
export class SatelliteFactoryManager {
  private config: SatelliteFactoryConfig;
  private factories: Map<AgentType, SatelliteFactory> = new Map();
  private instances: Map<AgentId, SatelliteAgent> = new Map();

  constructor(config: SatelliteFactoryConfig = DEFAULT_SATELLITE_FACTORY_CONFIG) {
    this.config = config;
    this.registerFactories();
  }

  /**
   * Create a satellite agent instance
   */
  async createSatellite(agentConfig: AgentConfig): Promise<SatelliteAgent> {
    try {
      logger.info(`Creating satellite agent: ${agentConfig.id} (${agentConfig.type})`);

      // Check if instance already exists
      if (this.instances.has(agentConfig.id)) {
        throw new Error(`Satellite agent ${agentConfig.id} already exists`);
      }

      // Get factory for agent type
      const factory = this.factories.get(agentConfig.type);
      if (!factory) {
        throw new Error(`No factory registered for agent type: ${agentConfig.type}`);
      }

      // Create satellite instance
      const satellite = await factory(agentConfig);
      
      // Store instance
      this.instances.set(agentConfig.id, satellite);

      logger.info(`Satellite agent ${agentConfig.id} created successfully`);
      return satellite;

    } catch (error) {
      logger.error(`Failed to create satellite agent ${agentConfig.id}:`, error);
      throw error;
    }
  }

  /**
   * Get existing satellite instance
   */
  getSatellite(agentId: AgentId): SatelliteAgent | undefined {
    return this.instances.get(agentId);
  }

  /**
   * Remove satellite instance
   */
  async removeSatellite(agentId: AgentId): Promise<void> {
    try {
      const satellite = this.instances.get(agentId);
      if (!satellite) {
        logger.warn(`Satellite agent ${agentId} not found for removal`);
        return;
      }

      // Stop satellite if running
      const status = satellite.getStatus();
      if (status.status === 'running') {
        await satellite.stop();
      }

      // Remove from instances
      this.instances.delete(agentId);
      
      logger.info(`Satellite agent ${agentId} removed successfully`);
    } catch (error) {
      logger.error(`Failed to remove satellite agent ${agentId}:`, error);
      throw error;
    }
  }

  /**
   * Get all satellite instances
   */
  getAllSatellites(): Map<AgentId, SatelliteAgent> {
    return new Map(this.instances);
  }

  /**
   * Get factory statistics
   */
  getStatistics() {
    return {
      totalFactories: this.factories.size,
      activeInstances: this.instances.size,
      registeredTypes: Array.from(this.factories.keys()),
      instanceIds: Array.from(this.instances.keys()),
      config: this.config,
    };
  }

  /**
   * Register all satellite factories
   */
  private registerFactories(): void {
    // Sage Satellite Factory
    this.factories.set('sage', async (config: AgentConfig) => {
      if (!SageSatelliteAgent) {
        throw new Error('Sage satellite agent not available');
      }
      const sageConfig = {
        ...DEFAULT_SAGE_CONFIG,
        id: config.id,
        name: config.name,
        version: config.version,
        enableSecureCommunication: this.config.enableSecureCommunication,
        enableHealthMonitoring: this.config.enableHealthMonitoring,
        enablePerformanceTracking: this.config.enablePerformanceTracking,
        maxConcurrentTasks: this.config.maxConcurrentTasks,
        defaultTimeout: this.config.defaultTimeout,
        ...config.config
      };
      return new SageSatelliteAgent(sageConfig);
    });

    // Helper function to create satellite config
    const createSatelliteConfig = (baseConfig: any, config: AgentConfig) => ({
      ...baseConfig,
      id: config.id,
      name: config.name,
      version: config.version,
      enableSecureCommunication: this.config.enableSecureCommunication,
      enableHealthMonitoring: this.config.enableHealthMonitoring,
      enablePerformanceTracking: this.config.enablePerformanceTracking,
      maxConcurrentTasks: this.config.maxConcurrentTasks,
      defaultTimeout: this.config.defaultTimeout,
      ...config.config
    });

    // Echo Satellite Factory
    this.factories.set('echo', async (config: AgentConfig) => {
      if (!EchoSatelliteAgent) {
        throw new Error('Echo satellite agent not available');
      }
      return new EchoSatelliteAgent(createSatelliteConfig(DEFAULT_ECHO_CONFIG, config));
    });

    // Pulse Satellite Factory
    this.factories.set('pulse', async (config: AgentConfig) => {
      if (!PulseSatelliteAgent) {
        throw new Error('Pulse satellite agent not available');
      }
      return new PulseSatelliteAgent(createSatelliteConfig(DEFAULT_PULSE_CONFIG, config));
    });

    // Oracle Satellite Factory
    this.factories.set('oracle', async (config: AgentConfig) => {
      if (!OracleSatelliteAgent) {
        throw new Error('Oracle satellite agent not available');
      }
      return new OracleSatelliteAgent(createSatelliteConfig(DEFAULT_ORACLE_CONFIG, config));
    });

    // Bridge Satellite Factory
    this.factories.set('bridge', async (config: AgentConfig) => {
      if (!BridgeSatelliteAgent) {
        throw new Error('Bridge satellite agent not available');
      }
      return new BridgeSatelliteAgent(createSatelliteConfig(DEFAULT_BRIDGE_CONFIG, config));
    });

    // Fuel Satellite Factory
    this.factories.set('fuel', async (config: AgentConfig) => {
      if (!FuelSatelliteAgent) {
        throw new Error('Fuel satellite agent not available');
      }
      return new FuelSatelliteAgent(createSatelliteConfig(DEFAULT_FUEL_CONFIG, config));
    });

    // Aegis Satellite Factory
    this.factories.set('aegis', async (config: AgentConfig) => {
      if (!AegisSatelliteAgent) {
        throw new Error('Aegis satellite agent not available');
      }
      return new AegisSatelliteAgent(createSatelliteConfig(DEFAULT_AEGIS_CONFIG, config));
    });

    // Note: Forge satellite implementation is different, using a factory function from index.ts
    this.factories.set('forge', async (config: AgentConfig) => {
      // Import the Forge factory dynamically
      const { createForgeSatellite } = await import('@/satellites/forge');
      return await createForgeSatellite(config);
    });

    logger.info(`Registered ${this.factories.size} satellite factories:`, Array.from(this.factories.keys()));
  }
}

/**
 * Global satellite factory instance
 */
let globalSatelliteFactory: SatelliteFactoryManager | null = null;

/**
 * Get or create global satellite factory
 */
export function getSatelliteFactory(config?: SatelliteFactoryConfig): SatelliteFactoryManager {
  if (!globalSatelliteFactory) {
    globalSatelliteFactory = new SatelliteFactoryManager(config);
  }
  return globalSatelliteFactory;
}

/**
 * Create satellite agent using global factory
 */
export async function createSatelliteAgent(config: AgentConfig): Promise<SatelliteAgent> {
  const factory = getSatelliteFactory();
  return await factory.createSatellite(config);
}