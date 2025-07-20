/**
 * YieldSensei Agent Lifecycle Manager
 * Subtask 1.2: Agent Lifecycle Management
 * 
 * Manages the creation, monitoring, and termination of satellite agent instances
 */

import { 
  AgentId, 
  AgentType, 
  AgentConfig, 
  AgentStatus, 
  SatelliteAgent, 
  LifecycleEvent, 
  AgentError,
  AgentMetrics 
} from '@/types';
import Logger from '@/shared/logging/logger';
import { EventEmitter } from 'events';
import { createCircuitBreaker } from './fault-tolerance/circuit-breaker';
import { Retryable } from './fault-tolerance/retry';

const logger = Logger.getLogger('lifecycle');

/**
 * Agent registry entry
 */
interface AgentRegistryEntry {
  agent: SatelliteAgent;
  config: AgentConfig;
  status: AgentStatus;
  process?: any; // For external processes
  restartCount: number;
  lastRestart: Date | null;
  healthCheckInterval?: NodeJS.Timeout | undefined;
}

/**
 * Lifecycle configuration
 */
export interface LifecycleConfig {
  heartbeatInterval: number;
  healthCheckTimeout: number;
  maxRestartAttempts: number;
  restartDelay: number;
  gracefulShutdownTimeout: number;
  monitoringEnabled: boolean;
}

export const DEFAULT_LIFECYCLE_CONFIG: LifecycleConfig = {
  heartbeatInterval: 30000,     // 30 seconds
  healthCheckTimeout: 10000,    // 10 seconds
  maxRestartAttempts: 3,        // Max restart attempts
  restartDelay: 5000,          // 5 seconds between restarts
  gracefulShutdownTimeout: 30000, // 30 seconds for graceful shutdown
  monitoringEnabled: true,
};

/**
 * Agent Lifecycle Manager
 * Handles the complete lifecycle of satellite agents
 */
export class AgentLifecycleManager extends EventEmitter {
  private config: LifecycleConfig;
  private registry: Map<AgentId, AgentRegistryEntry> = new Map();
  private agentFactories: Map<AgentType, (config: AgentConfig) => Promise<SatelliteAgent>> = new Map();
  private isShuttingDown: boolean = false;
  private globalHealthInterval?: NodeJS.Timeout;

  constructor(config: LifecycleConfig = DEFAULT_LIFECYCLE_CONFIG) {
    super();
    this.config = config;
    this.setupGlobalMonitoring();
  }

  /**
   * Register an agent factory for a specific agent type
   */
  registerAgentFactory(type: AgentType, factory: (config: AgentConfig) => Promise<SatelliteAgent>): void {
    this.agentFactories.set(type, factory);
    logger.info(`Registered agent factory for type: ${type}`);
  }

  /**
   * Create and register a new agent
   */
  async createAgent(config: AgentConfig): Promise<AgentId> {
    try {
      logger.info(`Creating agent ${config.id} of type ${config.type}`);

      // Check if agent already exists
      if (this.registry.has(config.id)) {
        throw new AgentError(`Agent ${config.id} already exists`, config.id, 'AGENT_EXISTS', false);
      }

      // Get factory for agent type
      const factory = this.agentFactories.get(config.type);
      if (!factory) {
        throw new AgentError(`No factory registered for agent type ${config.type}`, config.id, 'NO_FACTORY', false);
      }

      // Create agent instance
      const agent = await factory(config);

      // Initialize agent
      await agent.initialize();

      // Create registry entry
      const registryEntry: AgentRegistryEntry = {
        agent,
        config,
        status: {
          id: config.id,
          status: 'initializing',
          health: 'healthy',
          lastHeartbeat: new Date(),
          uptime: 0,
          metrics: this.createInitialMetrics(),
        },
        restartCount: 0,
        lastRestart: null,
      };

      // Register agent
      this.registry.set(config.id, registryEntry);

      // Set up health monitoring
      if (this.config.monitoringEnabled) {
        this.setupAgentMonitoring(config.id);
      }

      // Emit lifecycle event
      this.emitLifecycleEvent('created', config.id, { config });

      logger.info(`Agent ${config.id} created successfully`);
      return config.id;
    } catch (error) {
      logger.error(`Failed to create agent ${config.id}:`, error);
      throw error;
    }
  }

  /**
   * Start an agent
   */
  async startAgent(agentId: AgentId): Promise<void> {
    try {
      const entry = this.registry.get(agentId);
      if (!entry) {
        throw new AgentError(`Agent ${agentId} not found`, agentId, 'AGENT_NOT_FOUND', false);
      }

      if (entry.status.status === 'running') {
        logger.warn(`Agent ${agentId} is already running`);
        return;
      }

      logger.info(`Starting agent ${agentId}`);

      // Update status
      entry.status.status = 'initializing';
      entry.status.lastHeartbeat = new Date();

      // Start the agent
      await entry.agent.start();

      // Update status to running
      entry.status.status = 'running';
      entry.status.health = 'healthy';

      // Emit lifecycle event
      this.emitLifecycleEvent('started', agentId);

      logger.info(`Agent ${agentId} started successfully`);
    } catch (error) {
      logger.error(`Failed to start agent ${agentId}:`, error);
      
      // Update status to error
      const entry = this.registry.get(agentId);
      if (entry) {
        entry.status.status = 'error';
        entry.status.health = 'unhealthy';
      }

      // Emit lifecycle event
      this.emitLifecycleEvent('error', agentId, { error });
      throw error;
    }
  }

  /**
   * Stop an agent
   */
  async stopAgent(agentId: AgentId, graceful: boolean = true): Promise<void> {
    try {
      const entry = this.registry.get(agentId);
      if (!entry) {
        throw new AgentError(`Agent ${agentId} not found`, agentId, 'AGENT_NOT_FOUND', false);
      }

      if (entry.status.status === 'stopped') {
        logger.warn(`Agent ${agentId} is already stopped`);
        return;
      }

      logger.info(`Stopping agent ${agentId} (graceful: ${graceful})`);

      // Clear health check interval
      if (entry.healthCheckInterval) {
        clearInterval(entry.healthCheckInterval);
        entry.healthCheckInterval = undefined;
      }

      // Stop the agent
      if (graceful) {
        // Attempt graceful shutdown with timeout
        const shutdownPromise = entry.agent.stop();
        const timeoutPromise = new Promise<void>((_, reject) => {
          setTimeout(() => reject(new Error('Graceful shutdown timeout')), this.config.gracefulShutdownTimeout);
        });

        try {
          await Promise.race([shutdownPromise, timeoutPromise]);
        } catch (error) {
          logger.warn(`Graceful shutdown failed for agent ${agentId}, forcing stop`);
          // Force stop if graceful fails
          await entry.agent.stop();
        }
      } else {
        await entry.agent.stop();
      }

      // Update status
      entry.status.status = 'stopped';
      entry.status.health = 'healthy';

      // Emit lifecycle event
      this.emitLifecycleEvent('stopped', agentId);

      logger.info(`Agent ${agentId} stopped successfully`);
    } catch (error) {
      logger.error(`Failed to stop agent ${agentId}:`, error);
      throw error;
    }
  }

  /**
   * Restart an agent
   */
  async restartAgent(agentId: AgentId): Promise<void> {
    try {
      const entry = this.registry.get(agentId);
      if (!entry) {
        throw new AgentError(`Agent ${agentId} not found`, agentId, 'AGENT_NOT_FOUND', false);
      }

      // Check restart limits
      if (entry.restartCount >= this.config.maxRestartAttempts) {
        throw new AgentError(
          `Agent ${agentId} has exceeded maximum restart attempts (${this.config.maxRestartAttempts})`,
          agentId,
          'MAX_RESTARTS_EXCEEDED',
          false
        );
      }

      logger.info(`Restarting agent ${agentId} (attempt ${entry.restartCount + 1})`);

      // Stop agent
      await this.stopAgent(agentId, true);

      // Wait restart delay
      await new Promise(resolve => setTimeout(resolve, this.config.restartDelay));

      // Update restart tracking
      entry.restartCount++;
      entry.lastRestart = new Date();
      entry.status.status = 'restarting';

      // Start agent
      await this.startAgent(agentId);

      logger.info(`Agent ${agentId} restarted successfully`);
    } catch (error) {
      logger.error(`Failed to restart agent ${agentId}:`, error);
      throw error;
    }
  }

  /**
   * Remove an agent from the registry
   */
  async removeAgent(agentId: AgentId): Promise<void> {
    try {
      const entry = this.registry.get(agentId);
      if (!entry) {
        logger.warn(`Agent ${agentId} not found for removal`);
        return;
      }

      logger.info(`Removing agent ${agentId}`);

      // Stop agent if running
      if (entry.status.status === 'running') {
        await this.stopAgent(agentId);
      }

      // Clear monitoring
      if (entry.healthCheckInterval) {
        clearInterval(entry.healthCheckInterval);
      }

      // Remove from registry
      this.registry.delete(agentId);

      logger.info(`Agent ${agentId} removed successfully`);
    } catch (error) {
      logger.error(`Failed to remove agent ${agentId}:`, error);
      throw error;
    }
  }

  /**
   * Get agent status
   */
  getAgentStatus(agentId: AgentId): AgentStatus | null {
    const entry = this.registry.get(agentId);
    return entry ? { ...entry.status } : null;
  }

  /**
   * Get all agent statuses
   */
  getAllAgentStatuses(): Map<AgentId, AgentStatus> {
    const statuses = new Map<AgentId, AgentStatus>();
    for (const [id, entry] of this.registry) {
      statuses.set(id, { ...entry.status });
    }
    return statuses;
  }

  /**
   * Update agent configuration
   */
  async updateAgentConfig(agentId: AgentId, configUpdate: Partial<AgentConfig>): Promise<void> {
    try {
      const entry = this.registry.get(agentId);
      if (!entry) {
        throw new AgentError(`Agent ${agentId} not found`, agentId, 'AGENT_NOT_FOUND', false);
      }

      logger.info(`Updating configuration for agent ${agentId}`);

      // Update stored config
      entry.config = { ...entry.config, ...configUpdate };

      // Update agent config
      await entry.agent.updateConfig(configUpdate);

      // Emit lifecycle event
      this.emitLifecycleEvent('config_updated', agentId, { configUpdate });

      logger.info(`Configuration updated for agent ${agentId}`);
    } catch (error) {
      logger.error(`Failed to update config for agent ${agentId}:`, error);
      throw error;
    }
  }

  /**
   * Get lifecycle statistics
   */
  getLifecycleStats() {
    const stats = {
      totalAgents: this.registry.size,
      runningAgents: 0,
      stoppedAgents: 0,
      errorAgents: 0,
      restartingAgents: 0,
      healthyAgents: 0,
      degradedAgents: 0,
      unhealthyAgents: 0,
      totalRestarts: 0,
    };

    for (const entry of this.registry.values()) {
      // Status counts
      switch (entry.status.status) {
        case 'running': stats.runningAgents++; break;
        case 'stopped': stats.stoppedAgents++; break;
        case 'error': stats.errorAgents++; break;
        case 'restarting': stats.restartingAgents++; break;
      }

      // Health counts
      switch (entry.status.health) {
        case 'healthy': stats.healthyAgents++; break;
        case 'degraded': stats.degradedAgents++; break;
        case 'unhealthy': stats.unhealthyAgents++; break;
      }

      stats.totalRestarts += entry.restartCount;
    }

    return stats;
  }

  /**
   * Shutdown all agents
   */
  async shutdown(): Promise<void> {
    if (this.isShuttingDown) {
      return;
    }

    this.isShuttingDown = true;
    logger.info('Shutting down all agents...');

    // Clear global monitoring
    if (this.globalHealthInterval) {
      clearInterval(this.globalHealthInterval);
    }

    // Stop all agents
    const shutdownPromises = Array.from(this.registry.keys()).map(agentId => 
      this.stopAgent(agentId, true).catch(error => {
        logger.error(`Error stopping agent ${agentId} during shutdown:`, error);
      })
    );

    await Promise.all(shutdownPromises);
    
    // Clear registry
    this.registry.clear();

    logger.info('All agents shut down successfully');
  }

  /**
   * Set up monitoring for a specific agent
   */
  private setupAgentMonitoring(agentId: AgentId): void {
    const entry = this.registry.get(agentId);
    if (!entry) return;

    entry.healthCheckInterval = setInterval(async () => {
      try {
        const currentStatus = entry.agent.getStatus();
        
        // Update metrics
        entry.status = {
          ...currentStatus,
          uptime: Date.now() - (entry.lastRestart?.getTime() || Date.now()),
        };

        // Check health timeout
        const timeSinceHeartbeat = Date.now() - entry.status.lastHeartbeat.getTime();
        if (timeSinceHeartbeat > this.config.healthCheckTimeout) {
          logger.warn(`Agent ${agentId} health check timeout`);
          entry.status.health = 'unhealthy';
          
          // Attempt restart if agent appears dead
          if (entry.status.status === 'running') {
            logger.warn(`Attempting to restart unresponsive agent ${agentId}`);
            this.restartAgent(agentId).catch(error => {
              logger.error(`Failed to restart unresponsive agent ${agentId}:`, error);
            });
          }
        }

        // Emit heartbeat event
        this.emitLifecycleEvent('heartbeat', agentId, { status: entry.status });
      } catch (error) {
        logger.error(`Health check failed for agent ${agentId}:`, error);
        entry.status.health = 'unhealthy';
      }
    }, this.config.heartbeatInterval);
  }

  /**
   * Set up global monitoring
   */
  private setupGlobalMonitoring(): void {
    if (!this.config.monitoringEnabled) return;

    this.globalHealthInterval = setInterval(() => {
      const stats = this.getLifecycleStats();
      logger.debug('Global agent status:', stats);
      
      // Emit global stats
      this.emit('global_stats', stats);
    }, this.config.heartbeatInterval * 2); // Less frequent than individual checks
  }

  /**
   * Create initial metrics for a new agent
   */
  private createInitialMetrics(): AgentMetrics {
    return {
      messagesSent: 0,
      messagesReceived: 0,
      tasksProcessed: 0,
      errors: 0,
      avgResponseTime: 0,
      memoryUsage: 0,
      cpuUsage: 0,
    };
  }

  /**
   * Emit a lifecycle event
   */
  private emitLifecycleEvent(type: LifecycleEvent['type'], agentId: AgentId, data?: any): void {
    const event: LifecycleEvent = {
      type,
      agentId,
      timestamp: new Date(),
      data,
    };

    this.emit('lifecycle_event', event);
    this.emit(type, event); // Also emit specific event type
  }

  @Retryable(3, 1000)
  async performHealthCheck(_agentId: string): Promise<void> {
    // Existing health check logic
  }

  async executeAction<T>(_agentId: string, action: () => Promise<T>): Promise<T> {
    const circuitBreaker = createCircuitBreaker(action);
    return circuitBreaker.fire();
  }
}