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
  private registeredSatellites: Map<AgentId, SatelliteAgent> = new Map();
  
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
   * Register a satellite agent with the orchestration engine
   */
  async registerSatellite(agentId: AgentId, satelliteAgent: SatelliteAgent): Promise<void> {
    try {
      logger.info(`Registering satellite agent: ${agentId}`);

      // Validate input parameters
      if (!agentId || typeof agentId !== 'string') {
        throw new Error('Invalid agentId: must be a non-empty string');
      }
      
      if (!satelliteAgent || typeof satelliteAgent !== 'object') {
        throw new Error('Invalid satelliteAgent: must be a valid SatelliteAgent instance');
      }

      // Check if agent is already registered
      if (this.registeredSatellites.has(agentId)) {
        throw new Error(`Satellite agent ${agentId} is already registered`);
      }

      // Verify the satellite agent implements the required interface
      const requiredMethods = ['initialize', 'start', 'stop', 'restart', 'handleMessage', 'getStatus', 'updateConfig'];
      for (const method of requiredMethods) {
        if (typeof (satelliteAgent as any)[method] !== 'function') {
          throw new Error(`Satellite agent ${agentId} missing required method: ${method}`);
        }
      }

      // Register the satellite agent
      this.registeredSatellites.set(agentId, satelliteAgent);

      // Update agent configurations
      const agentConfig: AgentConfig = {
        id: agentId,
        type: satelliteAgent.type,
        name: satelliteAgent.config.name || `${satelliteAgent.type} Satellite`,
        version: satelliteAgent.config.version || '1.0.0',
        implementation: satelliteAgent.config.implementation || 'custom',
        config: satelliteAgent.config.config || {}
      };
      this.agentConfigs.set(agentId, agentConfig);

      // Initialize the satellite if the engine is already initialized
      if (this.isInitialized) {
        await satelliteAgent.initialize();
        logger.info(`Satellite agent ${agentId} initialized`);
        
        // Start the satellite if the engine is running
        if (this.isRunning) {
          await satelliteAgent.start();
          await this.messageBus.subscribeAgent(agentId);
          logger.info(`Satellite agent ${agentId} started and subscribed to message bus`);
        }
      }

      // Set up event forwarding from satellite to orchestration engine
      satelliteAgent.on('message', (message: Message) => {
        this.emit('agent_message', { agentId, message });
      });

      // Emit registration event
      this.emit('satellite_registered', { agentId, agent: satelliteAgent });
      logger.info(`Satellite agent ${agentId} registered successfully`);

    } catch (error) {
      logger.error(`Failed to register satellite agent ${agentId}:`, error);
      throw error;
    }
  }

  /**
   * Deregister a satellite agent from the orchestration engine
   */
  async deregisterSatellite(agentId: AgentId): Promise<void> {
    try {
      logger.info(`Deregistering satellite agent: ${agentId}`);

      // Check if agent is registered
      const satelliteAgent = this.registeredSatellites.get(agentId);
      if (!satelliteAgent) {
        throw new Error(`Satellite agent ${agentId} is not registered`);
      }

      // Stop the satellite if it's running
      if (this.isRunning) {
        try {
          await this.messageBus.unsubscribeAgent(agentId);
          await satelliteAgent.stop();
          logger.info(`Satellite agent ${agentId} stopped and unsubscribed from message bus`);
        } catch (error) {
          logger.warn(`Error stopping satellite agent ${agentId}:`, error);
        }
      }

      // Remove from registries
      this.registeredSatellites.delete(agentId);
      this.agentConfigs.delete(agentId);

      // Remove event listeners
      satelliteAgent.removeAllListeners();

      // Emit deregistration event
      this.emit('satellite_deregistered', { agentId });
      logger.info(`Satellite agent ${agentId} deregistered successfully`);

    } catch (error) {
      logger.error(`Failed to deregister satellite agent ${agentId}:`, error);
      throw error;
    }
  }

  /**
   * Process portfolio analysis request across multiple satellites
   */
  async processPortfolioAnalysis(request: any): Promise<any> {
    try {
      logger.info('Processing portfolio analysis request', { 
        userId: request.userId, 
        portfolioValue: request.portfolioValue 
      });

      if (!this.isRunning) {
        throw new Error('Orchestration engine is not running');
      }

      // Validate request
      if (!request || !request.userId) {
        throw new Error('Invalid portfolio analysis request: missing userId');
      }

      const results: any = {
        success: true,
        userId: request.userId,
        portfolioValue: request.portfolioValue,
        timestamp: new Date(),
        analysis: {},
        warnings: [],
        errors: []
      };

      // Get list of available satellites
      const availableSatellites = Array.from(this.registeredSatellites.keys());
      logger.debug('Available satellites for analysis:', availableSatellites);

      // Sage Satellite: Fundamental analysis and RWA scoring
      if (availableSatellites.includes('sage')) {
        try {
          const sageAgent = this.registeredSatellites.get('sage')!;
          const sageStatus = sageAgent.getStatus();
          
          if (sageStatus.status === 'running' && sageStatus.health === 'healthy') {
            // Perform fundamental analysis (placeholder - would be actual analysis)
            results.analysis.fundamentalAnalysis = {
              overallScore: 0.75,
              riskScore: 0.65,
              yieldScore: 0.80,
              recommendations: ['diversify', 'monitor_regulatory_changes']
            };
            logger.debug('Sage analysis completed');
          } else {
            results.warnings.push('sage_unavailable');
          }
        } catch (error) {
          logger.error('Sage analysis failed:', error);
          results.errors.push('sage_analysis_failed');
        }
      } else {
        results.warnings.push('sage_not_registered');
      }

      // Echo Satellite: Sentiment analysis (unless explicitly disabled)
      if (!request.withoutSentiment && availableSatellites.includes('echo')) {
        try {
          const echoAgent = this.registeredSatellites.get('echo')!;
          const echoStatus = echoAgent.getStatus();
          
          if (echoStatus.status === 'running' && echoStatus.health === 'healthy') {
            results.analysis.sentimentAnalysis = {
              overallSentiment: 0.65,
              marketMood: 'cautiously_optimistic',
              socialSignals: 'moderate_bullish'
            };
            logger.debug('Echo sentiment analysis completed');
          } else {
            results.warnings.push('echo_unavailable');
          }
        } catch (error) {
          logger.error('Echo sentiment analysis failed:', error);
          results.errors.push('echo_analysis_failed');
        }
      } else if (request.withoutSentiment) {
        results.warnings.push('sentiment_analysis_unavailable');
      } else {
        results.warnings.push('echo_not_registered');
      }

      // Bridge Satellite: Cross-chain analysis
      if (availableSatellites.includes('bridge')) {
        try {
          const bridgeAgent = this.registeredSatellites.get('bridge')!;
          const bridgeStatus = bridgeAgent.getStatus();
          
          if (bridgeStatus.status === 'running' && bridgeStatus.health === 'healthy') {
            results.analysis.crossChainAnalysis = {
              bridgeOpportunities: 3,
              estimatedSavings: 0.05,
              riskLevel: 'medium'
            };
            logger.debug('Bridge cross-chain analysis completed');
          } else {
            results.warnings.push('bridge_unavailable');
          }
        } catch (error) {
          logger.error('Bridge analysis failed:', error);
          results.errors.push('bridge_analysis_failed');
        }
      } else {
        results.warnings.push('bridge_not_registered');
      }

      // Pulse Satellite: Optimization analysis
      if (availableSatellites.includes('pulse')) {
        try {
          const pulseAgent = this.registeredSatellites.get('pulse')!;
          const pulseStatus = pulseAgent.getStatus();
          
          if (pulseStatus.status === 'running' && pulseStatus.health === 'healthy') {
            results.analysis.optimizationAnalysis = {
              suggestedAllocations: [
                { asset: 'USDC', percentage: 40 },
                { asset: 'ETH', percentage: 35 },
                { asset: 'BTC', percentage: 25 }
              ],
              expectedYield: 0.085,
              riskLevel: 'moderate'
            };
            logger.debug('Pulse optimization analysis completed');
          } else {
            results.warnings.push('pulse_unavailable');
          }
        } catch (error) {
          logger.error('Pulse analysis failed:', error);
          results.errors.push('pulse_analysis_failed');
        }
      } else {
        results.warnings.push('pulse_not_registered');
      }

      // Oracle Satellite: Data integrity validation
      if (availableSatellites.includes('oracle')) {
        try {
          const oracleAgent = this.registeredSatellites.get('oracle')!;
          const oracleStatus = oracleAgent.getStatus();
          
          if (oracleStatus.status === 'running' && oracleStatus.health === 'healthy') {
            results.analysis.dataIntegrity = {
              dataQuality: 0.95,
              lastUpdated: new Date(),
              sources: ['chainlink', 'uniswap', 'compound']
            };
            logger.debug('Oracle data integrity analysis completed');
          } else {
            results.warnings.push('oracle_unavailable');
          }
        } catch (error) {
          logger.error('Oracle analysis failed:', error);
          results.errors.push('oracle_analysis_failed');
        }
      } else {
        results.warnings.push('oracle_not_registered');
      }

      // Fuel Satellite: Capital efficiency analysis
      if (availableSatellites.includes('fuel')) {
        try {
          const fuelAgent = this.registeredSatellites.get('fuel')!;
          const fuelStatus = fuelAgent.getStatus();
          
          if (fuelStatus.status === 'running' && fuelStatus.health === 'healthy') {
            results.analysis.capitalEfficiency = {
              utilizationRate: 0.85,
              gasOptimization: 0.15,
              liquidityScore: 0.90
            };
            logger.debug('Fuel capital efficiency analysis completed');
          } else {
            results.warnings.push('fuel_unavailable');
          }
        } catch (error) {
          logger.error('Fuel analysis failed:', error);
          results.errors.push('fuel_analysis_failed');
        }
      } else {
        results.warnings.push('fuel_not_registered');
      }

      // Determine overall success
      const hasErrors = results.errors.length > 0;
      const hasCriticalWarnings = results.warnings.some(w => w.includes('_not_registered'));
      
      if (hasErrors || hasCriticalWarnings) {
        results.success = !hasErrors; // Still successful if only warnings
      }

      logger.info('Portfolio analysis completed', {
        userId: request.userId,
        success: results.success,
        warningsCount: results.warnings.length,
        errorsCount: results.errors.length
      });

      return results;

    } catch (error) {
      logger.error('Portfolio analysis failed:', error);
      throw error;
    }
  }

  /**
   * Get health status of the orchestration engine and all registered satellites
   */
  async getHealthStatus(): Promise<any> {
    try {
      const status = {
        status: 'healthy' as 'healthy' | 'degraded' | 'unhealthy',
        timestamp: new Date(),
        engine: {
          isInitialized: this.isInitialized,
          isRunning: this.isRunning,
          agentCount: this.registeredSatellites.size
        },
        satellites: {} as Record<string, any>,
        failedComponents: [] as string[],
        components: {
          messageBus: 'healthy' as 'healthy' | 'degraded' | 'unhealthy',
          database: 'healthy' as 'healthy' | 'degraded' | 'unhealthy',
          agents: 'healthy' as 'healthy' | 'degraded' | 'unhealthy'
        }
      };

      // Check core components
      try {
        const messageBusHealth = await this.messageBus.healthCheck();
        status.components.messageBus = messageBusHealth.healthy ? 'healthy' : 'unhealthy';
        if (!messageBusHealth.healthy) {
          status.failedComponents.push('messageBus');
        }
      } catch (error) {
        status.components.messageBus = 'unhealthy';
        status.failedComponents.push('messageBus');
      }

      try {
        const databaseHealth = await this.databaseManager.healthCheck();
        status.components.database = databaseHealth.status === 'healthy' ? 'healthy' : 'unhealthy';
        if (databaseHealth.status !== 'healthy') {
          status.failedComponents.push('database');
        }
      } catch (error) {
        status.components.database = 'unhealthy';
        status.failedComponents.push('database');
      }

      // Check registered satellites
      let healthySatellites = 0;
      let totalSatellites = this.registeredSatellites.size;

      for (const [agentId, agent] of this.registeredSatellites) {
        try {
          const agentStatus = agent.getStatus();
          status.satellites[agentId] = {
            status: agentStatus.status,
            health: agentStatus.health,
            uptime: agentStatus.uptime,
            lastHeartbeat: agentStatus.lastHeartbeat
          };

          if (agentStatus.status === 'running' && agentStatus.health === 'healthy') {
            healthySatellites++;
          } else {
            status.failedComponents.push(agentId);
          }
        } catch (error) {
          status.satellites[agentId] = {
            status: 'error',
            health: 'unhealthy',
            error: error instanceof Error ? error.message : 'Unknown error'
          };
          status.failedComponents.push(agentId);
        }
      }

      // Determine agents component health
      if (totalSatellites === 0) {
        status.components.agents = 'healthy'; // No agents to monitor
      } else if (healthySatellites === totalSatellites) {
        status.components.agents = 'healthy';
      } else if (healthySatellites >= totalSatellites / 2) {
        status.components.agents = 'degraded';
      } else {
        status.components.agents = 'unhealthy';
      }

      // Determine overall status
      const componentStatuses = Object.values(status.components);
      if (componentStatuses.every(s => s === 'healthy')) {
        status.status = 'healthy';
      } else if (componentStatuses.some(s => s === 'unhealthy')) {
        status.status = 'unhealthy';
      } else {
        status.status = 'degraded';
      }

      return status;

    } catch (error) {
      logger.error('Failed to get health status:', error);
      return {
        status: 'unhealthy',
        timestamp: new Date(),
        error: error instanceof Error ? error.message : 'Unknown error',
        failedComponents: ['orchestration_engine']
      };
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

      // Start registered satellites first
      const registeredPromises = Array.from(this.registeredSatellites.entries()).map(async ([agentId, agent]) => {
        try {
          logger.info(`Starting registered agent ${agentId}`);
          await agent.start();
          await this.messageBus.subscribeAgent(agentId);
          logger.info(`Registered agent ${agentId} started successfully`);
        } catch (error) {
          logger.error(`Failed to start registered agent ${agentId}:`, error);
          throw error;
        }
      });

      // Start configured agents (from loadAgentConfigurations)
      const configuredPromises = Array.from(this.agentConfigs.values())
        .filter(config => !this.registeredSatellites.has(config.id))
        .map(async (config) => {
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

      await Promise.all([...registeredPromises, ...configuredPromises]);
      
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

      // Stop registered satellites
      const registeredPromises = Array.from(this.registeredSatellites.entries()).map(async ([agentId, agent]) => {
        try {
          await this.messageBus.unsubscribeAgent(agentId);
          await agent.stop();
          logger.info(`Registered agent ${agentId} stopped`);
        } catch (error) {
          logger.error(`Error stopping registered agent ${agentId}:`, error);
        }
      });

      // Stop configured agents
      const configuredPromises = Array.from(this.agentConfigs.keys())
        .filter(agentId => !this.registeredSatellites.has(agentId))
        .map(async (agentId) => {
          try {
            await this.messageBus.unsubscribeAgent(agentId);
            await this.lifecycleManager.stopAgent(agentId);
            logger.info(`Agent ${agentId} stopped`);
          } catch (error) {
            logger.error(`Error stopping agent ${agentId}:`, error);
          }
        });

      await Promise.all([...registeredPromises, ...configuredPromises]);
      
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
      
      // Get agent statuses from both registered satellites and lifecycle manager
      const lifecycleStatuses = this.lifecycleManager.getAllAgentStatuses();
      const registeredStatuses = new Map<AgentId, AgentStatus>();
      
      // Add registered satellite statuses
      for (const [agentId, agent] of this.registeredSatellites) {
        try {
          registeredStatuses.set(agentId, agent.getStatus());
        } catch (error) {
          logger.warn(`Failed to get status for registered agent ${agentId}:`, error);
        }
      }
      
      // Combine statuses
      const allStatuses = new Map([...lifecycleStatuses, ...registeredStatuses]);
      
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
        agentStatus: allStatuses,
        metrics: {
          totalAgents: lifecycleStats.totalAgents + this.registeredSatellites.size,
          activeAgents: lifecycleStats.runningAgents + Array.from(this.registeredSatellites.values()).filter(agent => {
            try {
              const status = agent.getStatus();
              return status.status === 'running';
            } catch {
              return false;
            }
          }).length,
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
      registeredSatelliteCount: this.registeredSatellites.size,
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

      // Shutdown registered satellites
      for (const [agentId, agent] of this.registeredSatellites) {
        try {
          if (typeof (agent as any).shutdown === 'function') {
            await (agent as any).shutdown();
          }
          logger.info(`Satellite agent ${agentId} shut down`);
        } catch (error) {
          logger.warn(`Error shutting down satellite agent ${agentId}:`, error);
        }
      }

      // Clear registries
      this.registeredSatellites.clear();

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