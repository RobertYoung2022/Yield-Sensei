/**
 * YieldSensei Orchestration Engine
 * Main orchestration system that coordinates all satellite agents
 */

import { EventEmitter } from 'events';
import { AgentLifecycleManager } from '@/core/lifecycle/manager';
import { MessageBus } from '@/core/messaging/bus';
import { DatabaseManager } from '@/shared/database/manager';
import { 
  AgentId, 
  AgentType, 
  AgentConfig, 
  SatelliteAgent, 
  AgentStatus,
  Message 
} from '@/types';
import Logger from '@/shared/logging/logger';

const logger = Logger.getLogger('orchestration-engine');

/**
 * Orchestration Engine Configuration
 */
export interface OrchestrationConfig {
  enableHealthMonitoring: boolean;
  healthCheckInterval: number;
  enableAutoRestart: boolean;
  enableLoadBalancing: boolean;
  maxConcurrentTasks: number;
}

export const DEFAULT_ORCHESTRATION_CONFIG: OrchestrationConfig = {
  enableHealthMonitoring: true,
  healthCheckInterval: 30000, // 30 seconds
  enableAutoRestart: true,
  enableLoadBalancing: false, // Disabled for now
  maxConcurrentTasks: 100,
};

/**
 * System Health Status
 */
export interface SystemHealth {
  overall: 'healthy' | 'degraded' | 'unhealthy';
  components: {
    messageBus: 'healthy' | 'degraded' | 'unhealthy';
    database: 'healthy' | 'degraded' | 'unhealthy';
    agents: 'healthy' | 'degraded' | 'unhealthy';
  };
  agentStatus: Map<AgentId, AgentStatus>;
  metrics: {
    totalAgents: number;
    activeAgents: number;
    messagesThroughput: number;
    averageResponseTime: number;
    errorRate: number;
  };
}

/**
 * Main Orchestration Engine
 * Coordinates all satellite agents and system components
 */
export class OrchestrationEngine extends EventEmitter {
  private static instance: OrchestrationEngine;
  private config: OrchestrationConfig;
  
  // Core components
  private lifecycleManager: AgentLifecycleManager;
  private messageBus: MessageBus;
  private databaseManager: DatabaseManager;
  
  // Runtime state
  private isInitialized: boolean = false;
  private isRunning: boolean = false;
  private healthCheckInterval?: NodeJS.Timeout;
  
  // Agent registry
  private agentConfigs: Map<AgentId, AgentConfig> = new Map();
  
  private constructor(config: OrchestrationConfig = DEFAULT_ORCHESTRATION_CONFIG) {
    super();
    this.config = config;
    
    // Initialize core components
    this.lifecycleManager = new AgentLifecycleManager();
    this.messageBus = new MessageBus();
    this.databaseManager = DatabaseManager.getInstance();
    
    this.setupEventHandlers();
  }

  /**
   * Get singleton instance
   */
  static getInstance(config?: OrchestrationConfig): OrchestrationEngine {
    if (!OrchestrationEngine.instance) {
      OrchestrationEngine.instance = new OrchestrationEngine(config);
    }
    return OrchestrationEngine.instance;
  }

  /**
   * Initialize the orchestration engine
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.warn('Orchestration engine already initialized');
      return;
    }

    try {
      logger.info('Initializing orchestration engine...');

      // Initialize core components in sequence
      logger.info('Initializing database connections...');
      await this.databaseManager.initialize();

      logger.info('Initializing message bus...');
      await this.messageBus.initialize();

      // Register satellite agent factories
      await this.registerAgentFactories();

      // Load agent configurations
      await this.loadAgentConfigurations();

      // Set up health monitoring
      if (this.config.enableHealthMonitoring) {
        this.startHealthMonitoring();
      }

      this.isInitialized = true;
      logger.info('Orchestration engine initialized successfully');
      this.emit('initialized');
    } catch (error) {
      logger.error('Failed to initialize orchestration engine:', error);
      throw error;
    }
  }

  /**
   * Start all satellite agents
   */
  async startAllAgents(): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('Orchestration engine not initialized');
    }

    try {
      logger.info('Starting all satellite agents...');
      this.isRunning = true;

      // Create and start all agents
      const startPromises = Array.from(this.agentConfigs.values()).map(async (config) => {
        try {
          logger.info(`Creating agent ${config.id} (${config.type})`);
          await this.lifecycleManager.createAgent(config);
          
          logger.info(`Starting agent ${config.id}`);
          await this.lifecycleManager.startAgent(config.id);
          
          // Subscribe agent to message bus
          await this.messageBus.subscribeAgent(config.id);
          
          logger.info(`Agent ${config.id} started successfully`);
        } catch (error) {
          logger.error(`Failed to start agent ${config.id}:`, error);
          throw error;
        }
      });

      await Promise.all(startPromises);
      
      logger.info('All satellite agents started successfully');
      this.emit('agents_started');
    } catch (error) {
      logger.error('Failed to start agents:', error);
      throw error;
    }
  }

  /**
   * Stop all satellite agents
   */
  async stopAllAgents(): Promise<void> {
    try {
      logger.info('Stopping all satellite agents...');

      const agentIds = Array.from(this.agentConfigs.keys());
      const stopPromises = agentIds.map(async (agentId) => {
        try {
          await this.messageBus.unsubscribeAgent(agentId);
          await this.lifecycleManager.stopAgent(agentId);
          logger.info(`Agent ${agentId} stopped`);
        } catch (error) {
          logger.error(`Error stopping agent ${agentId}:`, error);
        }
      });

      await Promise.all(stopPromises);
      
      this.isRunning = false;
      logger.info('All agents stopped');
      this.emit('agents_stopped');
    } catch (error) {
      logger.error('Error stopping agents:', error);
      throw error;
    }
  }

  /**
   * Send a message to a specific agent or broadcast
   */
  async sendMessage(message: Message): Promise<void> {
    if (!this.isRunning) {
      throw new Error('Orchestration engine not running');
    }

    try {
      await this.messageBus.sendMessage(message);
      logger.debug(`Message ${message.id} sent from ${message.from} to ${message.to}`);
    } catch (error) {
      logger.error(`Failed to send message ${message.id}:`, error);
      throw error;
    }
  }

  /**
   * Get system health status
   */
  async getSystemHealth(): Promise<SystemHealth> {
    try {
      // Check message bus health
      const messageBusHealth = await this.messageBus.healthCheck();
      
      // Check database health
      const databaseHealth = await this.databaseManager.healthCheck();
      
      // Get agent statuses
      const agentStatuses = this.lifecycleManager.getAllAgentStatuses();
      const lifecycleStats = this.lifecycleManager.getLifecycleStats();
      
      // Get message bus stats
      const messageBusStats = this.messageBus.getStats();
      
      // Determine component health
      const components = {
        messageBus: messageBusHealth.healthy ? 'healthy' as const : 'unhealthy' as const,
        database: databaseHealth.status === 'healthy' ? 'healthy' as const : 'unhealthy' as const,
        agents: lifecycleStats.errorAgents === 0 ? 'healthy' as const : 
                lifecycleStats.errorAgents < lifecycleStats.totalAgents / 2 ? 'degraded' as const : 'unhealthy' as const,
      };

      // Determine overall health
      const overall = Object.values(components).every(status => status === 'healthy') ? 'healthy' as const :
                     Object.values(components).some(status => status === 'unhealthy') ? 'unhealthy' as const : 'degraded' as const;

      return {
        overall,
        components,
        agentStatus: agentStatuses,
        metrics: {
          totalAgents: lifecycleStats.totalAgents,
          activeAgents: lifecycleStats.runningAgents,
          messagesThroughput: messageBusStats.messagesSent + messageBusStats.messagesReceived,
          averageResponseTime: messageBusStats.averageLatency,
          errorRate: lifecycleStats.totalAgents > 0 ? lifecycleStats.errorAgents / lifecycleStats.totalAgents : 0,
        },
      };
    } catch (error) {
      logger.error('Failed to get system health:', error);
      throw error;
    }
  }

  /**
   * Get orchestration statistics
   */
  getStatistics() {
    return {
      isInitialized: this.isInitialized,
      isRunning: this.isRunning,
      agentCount: this.agentConfigs.size,
      config: this.config,
      lifecycle: this.lifecycleManager.getLifecycleStats(),
      messageBus: this.messageBus.getStats(),
    };
  }

  /**
   * Shutdown the orchestration engine
   */
  async shutdown(): Promise<void> {
    if (!this.isInitialized && !this.isRunning) {
      return; // Already shut down
    }

    logger.info('Shutting down orchestration engine...');

    try {
      // Stop health monitoring FIRST
      if (this.healthCheckInterval) {
        clearInterval(this.healthCheckInterval);
        delete this.healthCheckInterval; // Prevent double-clear
      }

      // Stop all agents
      if (this.isRunning) {
        await this.stopAllAgents();
      }

      // Shutdown lifecycle manager
      await this.lifecycleManager.shutdown();

      // Shutdown message bus
      await this.messageBus.shutdown();

      // Disconnect database
      await this.databaseManager.disconnect();

      this.isInitialized = false;
      this.isRunning = false;

      logger.info('Orchestration engine shut down successfully');
      this.emit('shutdown');
    } catch (error) {
      logger.error('Error during orchestration engine shutdown:', error);
      throw error;
    }
  }

  /**
   * Register agent factories for each satellite type
   */
  private async registerAgentFactories(): Promise<void> {
    // For now, we'll register placeholder factories
    // In the next phase, we'll implement actual satellite agents
    
    const agentTypes: AgentType[] = ['sage', 'forge', 'pulse', 'aegis', 'echo', 'fuel', 'bridge', 'oracle'];
    
    for (const type of agentTypes) {
      this.lifecycleManager.registerAgentFactory(type, async (config: AgentConfig) => {
        // Return a mock agent for now
        return new MockSatelliteAgent(config);
      });
    }
    
    logger.info('Agent factories registered for all satellite types');
  }

  /**
   * Load agent configurations from database or config
   */
  private async loadAgentConfigurations(): Promise<void> {
    // For now, we'll create default configurations for all 8 satellites
    const satelliteConfigs: AgentConfig[] = [
      { id: 'sage', type: 'sage', name: 'Sage - Logic & Research', version: '1.0.0', implementation: 'custom', config: {} },
      { id: 'forge', type: 'forge', name: 'Forge - Builder & Engineering', version: '1.0.0', implementation: 'custom', config: {} },
      { id: 'pulse', type: 'pulse', name: 'Pulse - Growth & Optimization', version: '1.0.0', implementation: 'hybrid', config: {} },
      { id: 'aegis', type: 'aegis', name: 'Aegis - Security & Risk', version: '1.0.0', implementation: 'custom', config: {} },
      { id: 'echo', type: 'echo', name: 'Echo - Sentiment & Community', version: '1.0.0', implementation: 'elizaos', config: {} },
      { id: 'fuel', type: 'fuel', name: 'Fuel - Logistics & Capital', version: '1.0.0', implementation: 'hybrid', config: {} },
      { id: 'bridge', type: 'bridge', name: 'Bridge - Cross-Chain Operations', version: '1.0.0', implementation: 'custom', config: {} },
      { id: 'oracle', type: 'oracle', name: 'Oracle - Data Integrity', version: '1.0.0', implementation: 'hybrid', config: {} },
    ];

    for (const config of satelliteConfigs) {
      this.agentConfigs.set(config.id, config);
    }

    logger.info(`Loaded configurations for ${satelliteConfigs.length} satellite agents`);
  }

  /**
   * Set up event handlers for core components
   */
  private setupEventHandlers(): void {
    // Lifecycle manager events
    this.lifecycleManager.on('lifecycle_event', (event) => {
      logger.debug(`Lifecycle event: ${event.type} for agent ${event.agentId}`);
      this.emit('agent_lifecycle_event', event);
    });

    // Message bus events
    this.messageBus.on('agent_message', (message: Message) => {
      logger.debug(`Message received: ${message.id} from ${message.from} to ${message.to}`);
      this.emit('agent_message', message);
    });

    this.messageBus.on('message_failed', (event) => {
      logger.error(`Message failed: ${event.message.id}`, event.error);
      this.emit('message_failed', event);
    });

    // Database events
    this.databaseManager.on('postgres_error', (error) => {
      logger.error('PostgreSQL error:', error);
      this.emit('database_error', { type: 'postgres', error });
    });

    this.databaseManager.on('redis_error', (error) => {
      logger.error('Redis error:', error);
      this.emit('database_error', { type: 'redis', error });
    });
  }

  /**
   * Start health monitoring
   */
  private startHealthMonitoring(): void {
    this.healthCheckInterval = setInterval(async () => {
      try {
        const health = await this.getSystemHealth();
        logger.debug('System health check:', {
          overall: health.overall,
          agents: health.metrics.totalAgents,
          active: health.metrics.activeAgents,
          throughput: health.metrics.messagesThroughput,
        });

        this.emit('health_check', health);
        
        // Emit warnings for degraded/unhealthy components
        if (health.overall !== 'healthy') {
          logger.warn(`System health degraded: ${health.overall}`, health.components);
          this.emit('health_warning', health);
        }
      } catch (error) {
        logger.error('Health check failed:', error);
      }
    }, this.config.healthCheckInterval);

    logger.info(`Health monitoring started (interval: ${this.config.healthCheckInterval}ms)`);
  }
}

/**
 * Mock Satellite Agent (temporary implementation)
 * This will be replaced with actual satellite implementations
 */
class MockSatelliteAgent implements SatelliteAgent {
  readonly id: AgentId;
  readonly type: AgentType;
  readonly config: AgentConfig;
  
  private status: AgentStatus;
  private startTime: Date = new Date();

  constructor(config: AgentConfig) {
    this.id = config.id;
    this.type = config.type;
    this.config = config;
    
    this.status = {
      id: config.id,
      status: 'stopped',
      health: 'healthy',
      lastHeartbeat: new Date(),
      uptime: 0,
      metrics: {
        messagesSent: 0,
        messagesReceived: 0,
        tasksProcessed: 0,
        errors: 0,
        avgResponseTime: 0,
        memoryUsage: 0,
        cpuUsage: 0,
      },
    };
  }

  async initialize(): Promise<void> {
    logger.debug(`Initializing mock agent ${this.id}`);
    this.status.status = 'initializing';
  }

  async start(): Promise<void> {
    logger.debug(`Starting mock agent ${this.id}`);
    this.status.status = 'running';
    this.startTime = new Date();
  }

  async stop(): Promise<void> {
    logger.debug(`Stopping mock agent ${this.id}`);
    this.status.status = 'stopped';
  }

  async restart(): Promise<void> {
    await this.stop();
    await this.start();
  }

  async handleMessage(message: Message): Promise<void> {
    logger.debug(`Mock agent ${this.id} handling message ${message.id}`);
    this.status.metrics.messagesReceived++;
  }

  getStatus(): AgentStatus {
    if (this.status.status === 'running') {
      this.status.uptime = Date.now() - this.startTime.getTime();
      this.status.lastHeartbeat = new Date();
    }
    return { ...this.status };
  }

  async updateConfig(config: Partial<AgentConfig>): Promise<void> {
    Object.assign(this.config, config);
    logger.debug(`Mock agent ${this.id} config updated`);
  }
}