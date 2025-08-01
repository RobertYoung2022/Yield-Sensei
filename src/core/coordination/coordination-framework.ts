/**
 * YieldSensei Coordination Framework
 * Task 45.3: Distributed Coordination and Consensus Framework
 * 
 * Main coordination framework integrating consensus, task coordination, and distributed locking
 */

import { EventEmitter } from 'events';
import Logger from '@/shared/logging/logger';
import { AgentId } from '@/types';
import { ConsensusEngine, ConsensusConfig, DEFAULT_CONSENSUS_CONFIG } from './consensus-engine';
import { TaskCoordinator, CoordinationConfig, DEFAULT_COORDINATION_CONFIG, DistributedTask, TaskStatus } from './task-coordinator';
import { DistributedLockManager, LockManagerConfig, DEFAULT_LOCK_MANAGER_CONFIG, LockType } from './distributed-lock-manager';
import { SatelliteMessageBus } from '../communication/satellite-message-bus';

const logger = Logger.getLogger('coordination-framework');

/**
 * Coordination Framework Configuration
 */
export interface CoordinationFrameworkConfig {
  nodeId: AgentId;
  clusterNodes: AgentId[];
  consensus: ConsensusConfig;
  taskCoordination: CoordinationConfig;
  lockManager: LockManagerConfig;
  networking: {
    enableConsensus: boolean;
    enableTaskCoordination: boolean;
    enableDistributedLocking: boolean;
    messageTimeout: number;
    retryAttempts: number;
  };
  failover: {
    enabled: boolean;
    leaderElectionTimeout: number;
    nodeFailureThreshold: number;
    automaticRecovery: boolean;
  };
  monitoring: {
    healthCheckInterval: number;
    metricsCollectionInterval: number;
    alertThresholds: {
      taskFailureRate: number;
      lockContentionRate: number;
      consensusLatency: number;
    };
  };
}

export const DEFAULT_COORDINATION_FRAMEWORK_CONFIG: CoordinationFrameworkConfig = {
  nodeId: 'unknown',
  clusterNodes: [],
  consensus: DEFAULT_CONSENSUS_CONFIG,
  taskCoordination: DEFAULT_COORDINATION_CONFIG,
  lockManager: DEFAULT_LOCK_MANAGER_CONFIG,
  networking: {
    enableConsensus: true,
    enableTaskCoordination: true,
    enableDistributedLocking: true,
    messageTimeout: 10000, // 10 seconds
    retryAttempts: 3,
  },
  failover: {
    enabled: true,
    leaderElectionTimeout: 30000, // 30 seconds
    nodeFailureThreshold: 3,
    automaticRecovery: true,
  },
  monitoring: {
    healthCheckInterval: 30000, // 30 seconds
    metricsCollectionInterval: 60000, // 1 minute
    alertThresholds: {
      taskFailureRate: 0.1, // 10%
      lockContentionRate: 0.5, // 50%
      consensusLatency: 1000, // 1 second
    },
  },
};

/**
 * Coordination Event Types
 */
export type CoordinationEventType = 
  | 'leader_elected'
  | 'leader_lost'
  | 'node_joined'
  | 'node_left'
  | 'task_assigned'
  | 'task_completed'
  | 'task_failed'
  | 'lock_acquired'
  | 'lock_released'
  | 'consensus_reached'
  | 'failover_triggered'
  | 'recovery_completed';

/**
 * Coordination Health Status
 */
export interface CoordinationHealth {
  overall: 'healthy' | 'degraded' | 'unhealthy';
  components: {
    consensus: 'healthy' | 'degraded' | 'unhealthy';
    taskCoordination: 'healthy' | 'degraded' | 'unhealthy';
    lockManager: 'healthy' | 'degraded' | 'unhealthy';
  };
  leadership: {
    isLeader: boolean;
    leaderId: AgentId | null;
    lastElection?: Date;
  };
  cluster: {
    activeNodes: number;
    totalNodes: number;
    unreachableNodes: AgentId[];
  };
  performance: {
    consensusLatency: number;
    taskThroughput: number;
    lockContention: number;
  };
}

/**
 * Coordination Framework
 * Integrates consensus, task coordination, and distributed locking
 */
export class CoordinationFramework extends EventEmitter {
  private config: CoordinationFrameworkConfig;
  
  // Core components
  private consensusEngine?: ConsensusEngine;
  private taskCoordinator?: TaskCoordinator;
  private lockManager?: DistributedLockManager;
  private messageBus?: SatelliteMessageBus;
  
  // State management
  private isRunning: boolean = false;
  private isLeader: boolean = false;
  private activeNodes: Set<AgentId> = new Set();
  private unreachableNodes: Set<AgentId> = new Set();
  
  // Timers
  private healthCheckTimer?: NodeJS.Timeout;
  private metricsTimer?: NodeJS.Timeout;
  
  // Performance tracking
  private performanceMetrics = {
    consensusLatencies: [] as number[],
    taskThroughput: 0,
    lockContentionRate: 0,
    lastMetricsUpdate: new Date(),
  };

  constructor(config: CoordinationFrameworkConfig = DEFAULT_COORDINATION_FRAMEWORK_CONFIG) {
    super();
    this.config = config;
    this.activeNodes.add(config.nodeId);
  }

  /**
   * Set message bus for network communication
   */
  setMessageBus(messageBus: SatelliteMessageBus): void {
    this.messageBus = messageBus;
    this.setupMessageBusHandlers();
  }

  /**
   * Start the coordination framework
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Coordination framework already running');
      return;
    }

    try {
      logger.info('Starting coordination framework...');

      // Initialize and start components
      await this.initializeComponents();
      await this.startComponents();

      // Start monitoring
      this.startHealthChecks();
      this.startMetricsCollection();

      this.isRunning = true;
      logger.info('Coordination framework started successfully');
      this.emit('started');

    } catch (error) {
      logger.error('Failed to start coordination framework:', error);
      throw error;
    }
  }

  /**
   * Stop the coordination framework
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    logger.info('Stopping coordination framework...');

    // Clear timers
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      delete this.healthCheckTimer;
    }

    if (this.metricsTimer) {
      clearInterval(this.metricsTimer);
      delete this.metricsTimer;
    }

    // Stop components
    await this.stopComponents();

    this.isRunning = false;
    logger.info('Coordination framework stopped');
    this.emit('stopped');
  }

  /**
   * Submit a distributed task
   */
  async submitTask(task: Omit<DistributedTask, 'id' | 'status' | 'createdAt' | 'assignedTo' | 'progress'>): Promise<string> {
    if (!this.taskCoordinator) {
      throw new Error('Task coordination not enabled');
    }

    return await this.taskCoordinator.submitTask(task);
  }

  /**
   * Request a distributed lock
   */
  async requestLock(
    resourceId: string,
    lockType: LockType = 'exclusive',
    options?: {
      priority?: number;
      timeout?: number;
      autoRenew?: boolean;
    }
  ): Promise<string> {
    if (!this.lockManager) {
      throw new Error('Distributed locking not enabled');
    }

    return await this.lockManager.requestLock(resourceId, lockType, options);
  }

  /**
   * Release a distributed lock
   */
  async releaseLock(lockId: string): Promise<boolean> {
    if (!this.lockManager) {
      throw new Error('Distributed locking not enabled');
    }

    return await this.lockManager.releaseLock(lockId);
  }

  /**
   * Submit consensus command
   */
  async submitConsensusCommand(command: any): Promise<boolean> {
    if (!this.consensusEngine) {
      throw new Error('Consensus not enabled');
    }

    return await this.consensusEngine.submitCommand(command);
  }

  /**
   * Get coordination health status
   */
  async getHealth(): Promise<CoordinationHealth> {
    const health: CoordinationHealth = {
      overall: 'healthy',
      components: {
        consensus: 'healthy',
        taskCoordination: 'healthy',
        lockManager: 'healthy',
      },
      leadership: {
        isLeader: this.isLeader,
        leaderId: null,
      },
      cluster: {
        activeNodes: this.activeNodes.size,
        totalNodes: this.config.clusterNodes.length,
        unreachableNodes: Array.from(this.unreachableNodes),
      },
      performance: {
        consensusLatency: this.getAverageConsensusLatency(),
        taskThroughput: this.performanceMetrics.taskThroughput,
        lockContention: this.performanceMetrics.lockContentionRate,
      },
    };

    // Check component health
    if (this.consensusEngine) {
      const consensusState = this.consensusEngine.getState();
      health.leadership.leaderId = consensusState.leaderId;
      
      if (consensusState.state === 'leader' || consensusState.state === 'follower') {
        health.components.consensus = 'healthy';
      } else {
        health.components.consensus = 'degraded';
      }
    }

    if (this.taskCoordinator) {
      const taskStats = this.taskCoordinator.getStats();
      if (taskStats.successRate < this.config.monitoring.alertThresholds.taskFailureRate) {
        health.components.taskCoordination = 'degraded';
      }
    }

    if (this.lockManager) {
      const lockStats = this.lockManager.getStats();
      if (lockStats.lockContentionRate > this.config.monitoring.alertThresholds.lockContentionRate) {
        health.components.lockManager = 'degraded';
      }
    }

    // Determine overall health
    const componentHealths = Object.values(health.components);
    if (componentHealths.some(h => h === 'unhealthy')) {
      health.overall = 'unhealthy';
    } else if (componentHealths.some(h => h === 'degraded')) {
      health.overall = 'degraded';
    }

    return health;
  }

  /**
   * Get coordination statistics
   */
  getStats() {
    return {
      isRunning: this.isRunning,
      isLeader: this.isLeader,
      nodeId: this.config.nodeId,
      clusterSize: this.config.clusterNodes.length,
      activeNodes: this.activeNodes.size,
      unreachableNodes: this.unreachableNodes.size,
      consensus: this.consensusEngine?.getStats(),
      taskCoordination: this.taskCoordinator?.getStats(),
      lockManager: this.lockManager?.getStats(),
      performance: this.performanceMetrics,
    };
  }

  /**
   * Initialize components based on configuration
   */
  private async initializeComponents(): Promise<void> {
    // Initialize consensus engine
    if (this.config.networking.enableConsensus) {
      this.consensusEngine = new ConsensusEngine({
        ...this.config.consensus,
        nodeId: this.config.nodeId,
        clusterNodes: this.config.clusterNodes,
      });
      this.setupConsensusHandlers();
    }

    // Initialize task coordinator
    if (this.config.networking.enableTaskCoordination) {
      this.taskCoordinator = new TaskCoordinator({
        ...this.config.taskCoordination,
        nodeId: this.config.nodeId,
      });
      
      if (this.consensusEngine) {
        this.taskCoordinator.setConsensusEngine(this.consensusEngine);
      }
      
      this.setupTaskCoordinatorHandlers();
    }

    // Initialize distributed lock manager
    if (this.config.networking.enableDistributedLocking) {
      this.lockManager = new DistributedLockManager({
        ...this.config.lockManager,
        nodeId: this.config.nodeId,
      });
      this.setupLockManagerHandlers();
    }
  }

  /**
   * Start all enabled components
   */
  private async startComponents(): Promise<void> {
    const startPromises: Promise<void>[] = [];

    if (this.consensusEngine) {
      startPromises.push(this.consensusEngine.start());
    }

    if (this.taskCoordinator) {
      startPromises.push(this.taskCoordinator.start());
    }

    if (this.lockManager) {
      startPromises.push(this.lockManager.start());
    }

    await Promise.all(startPromises);
  }

  /**
   * Stop all components
   */
  private async stopComponents(): Promise<void> {
    const stopPromises: Promise<void>[] = [];

    if (this.consensusEngine) {
      stopPromises.push(this.consensusEngine.stop());
    }

    if (this.taskCoordinator) {
      stopPromises.push(this.taskCoordinator.stop());
    }

    if (this.lockManager) {
      stopPromises.push(this.lockManager.stop());
    }

    await Promise.all(stopPromises);
  }

  /**
   * Setup consensus engine event handlers
   */
  private setupConsensusHandlers(): void {
    if (!this.consensusEngine) {
      return;
    }

    this.consensusEngine.on('state_changed', ({ state, term }) => {
      const wasLeader = this.isLeader;
      this.isLeader = state === 'leader';

      if (this.isLeader && !wasLeader) {
        logger.info(`Became cluster leader for term ${term}`);
        this.emit('leader_elected', { nodeId: this.config.nodeId, term });
      } else if (!this.isLeader && wasLeader) {
        logger.info(`Lost leadership for term ${term}`);
        this.emit('leader_lost', { nodeId: this.config.nodeId, term });
      }
    });

    this.consensusEngine.on('vote_request', ({ nodeId, request }) => {
      this.sendVoteRequest(nodeId, request);
    });

    this.consensusEngine.on('append_entries_request', ({ nodeId, request }) => {
      this.sendAppendEntries(nodeId, request);
    });
  }

  /**
   * Setup task coordinator event handlers
   */
  private setupTaskCoordinatorHandlers(): void {
    if (!this.taskCoordinator) {
      return;
    }

    this.taskCoordinator.on('task_assigned', ({ task, assignment }) => {
      this.emit('task_assigned', { task, assignment });
    });

    this.taskCoordinator.on('task_completed', ({ task, result, nodeId }) => {
      this.emit('task_completed', { task, result, nodeId });
      this.performanceMetrics.taskThroughput++;
    });

    this.taskCoordinator.on('task_failed', ({ task, error, nodeId }) => {
      this.emit('task_failed', { task, error, nodeId });
    });

    this.taskCoordinator.on('task_dispatch', ({ task, nodeId }) => {
      this.sendTaskDispatch(task, nodeId);
    });

    this.taskCoordinator.on('node_failed', ({ nodeId }) => {
      this.handleNodeFailure(nodeId);
    });
  }

  /**
   * Setup lock manager event handlers
   */
  private setupLockManagerHandlers(): void {
    if (!this.lockManager) {
      return;
    }

    this.lockManager.on('lock_granted', ({ lock, request }) => {
      this.emit('lock_acquired', { lock, request });
    });

    this.lockManager.on('lock_released', ({ lock, release }) => {
      this.emit('lock_released', { lock, release });
    });

    this.lockManager.on('deadlock_detected', (deadlock) => {
      logger.warn('Deadlock detected:', deadlock);
      this.emit('deadlock_detected', deadlock);
    });
  }

  /**
   * Setup message bus event handlers
   */
  private setupMessageBusHandlers(): void {
    if (!this.messageBus) {
      return;
    }

    this.messageBus.on('satellite_message', (message) => {
      this.handleIncomingMessage(message);
    });

    this.messageBus.on('satellite_connected', ({ nodeId }) => {
      this.handleNodeJoined(nodeId);
    });

    this.messageBus.on('satellite_disconnected', ({ nodeId }) => {
      this.handleNodeLeft(nodeId);
    });
  }

  /**
   * Handle incoming coordination messages
   */
  private async handleIncomingMessage(message: any): Promise<void> {
    try {
      switch (message.type) {
        case 'consensus_vote_request':
          if (this.consensusEngine) {
            const response = await this.consensusEngine.handleVoteRequest(message.payload);
            await this.sendVoteResponse(message.from, response);
          }
          break;

        case 'consensus_vote_response':
          if (this.consensusEngine) {
            this.consensusEngine.processVoteResponse(message.payload);
          }
          break;

        case 'consensus_append_entries':
          if (this.consensusEngine) {
            const response = await this.consensusEngine.handleAppendEntries(message.payload);
            await this.sendAppendEntriesResponse(message.from, response);
          }
          break;

        case 'consensus_append_entries_response':
          if (this.consensusEngine) {
            this.consensusEngine.processAppendEntriesResponse(message.from, message.payload);
          }
          break;

        case 'task_dispatch':
          if (this.taskCoordinator) {
            await this.handleTaskDispatch(message.payload);
          }
          break;

        case 'task_progress_update':
          if (this.taskCoordinator) {
            this.taskCoordinator.updateTaskProgress(
              message.payload.taskId,
              message.payload.progress,
              message.from
            );
          }
          break;

        case 'task_completion':
          if (this.taskCoordinator) {
            this.taskCoordinator.completeTask(
              message.payload.taskId,
              message.payload.result,
              message.from
            );
          }
          break;

        case 'task_failure':
          if (this.taskCoordinator) {
            this.taskCoordinator.failTask(
              message.payload.taskId,
              message.payload.error,
              message.from
            );
          }
          break;

        default:
          logger.debug(`Unknown coordination message type: ${message.type}`);
      }
    } catch (error) {
      logger.error(`Failed to handle coordination message ${message.id}:`, error);
    }
  }

  /**
   * Handle node joining the cluster
   */
  private handleNodeJoined(nodeId: AgentId): void {
    if (!this.activeNodes.has(nodeId)) {
      this.activeNodes.add(nodeId);
      this.unreachableNodes.delete(nodeId);
      
      logger.info(`Node ${nodeId} joined the cluster`);
      this.emit('node_joined', { nodeId });
    }
  }

  /**
   * Handle node leaving the cluster
   */
  private handleNodeLeft(nodeId: AgentId): void {
    if (this.activeNodes.has(nodeId)) {
      this.activeNodes.delete(nodeId);
      this.unreachableNodes.add(nodeId);
      
      logger.info(`Node ${nodeId} left the cluster`);
      this.emit('node_left', { nodeId });
      
      // Trigger failover if enabled
      if (this.config.failover.enabled) {
        this.handleNodeFailure(nodeId);
      }
    }
  }

  /**
   * Handle node failure
   */
  private handleNodeFailure(nodeId: AgentId): void {
    logger.warn(`Handling failure of node ${nodeId}`);
    
    if (this.config.failover.automaticRecovery) {
      this.triggerFailover(nodeId);
    }
    
    this.emit('node_failure', { nodeId });
  }

  /**
   * Trigger failover procedures
   */
  private async triggerFailover(failedNodeId: AgentId): Promise<void> {
    logger.info(`Triggering failover for node ${failedNodeId}`);
    this.emit('failover_triggered', { failedNodeId });

    try {
      // If the failed node was the leader, trigger leader election
      if (this.consensusEngine) {
        const state = this.consensusEngine.getState();
        if (state.leaderId === failedNodeId) {
          logger.info('Failed node was leader, triggering new election');
          // Leader election will happen automatically in Raft
        }
      }

      // Reassign tasks from failed node
      if (this.taskCoordinator && this.isLeader) {
        const failedNodeTasks = this.taskCoordinator.getTasks({ assignedTo: failedNodeId });
        for (const task of failedNodeTasks) {
          if (task.status === 'running' || task.status === 'assigned') {
            logger.info(`Reassigning task ${task.id} from failed node ${failedNodeId}`);
            // TaskCoordinator will handle reassignment automatically
          }
        }
      }

      this.emit('recovery_completed', { failedNodeId });

    } catch (error) {
      logger.error(`Failover failed for node ${failedNodeId}:`, error);
    }
  }

  /**
   * Start health check monitoring
   */
  private startHealthChecks(): void {
    this.healthCheckTimer = setInterval(async () => {
      try {
        const health = await this.getHealth();
        
        // Check for alerts
        if (health.overall !== 'healthy') {
          logger.warn('Coordination health degraded:', health);
          this.emit('health_alert', health);
        }
      } catch (error) {
        logger.error('Health check failed:', error);
      }
    }, this.config.monitoring.healthCheckInterval);
  }

  /**
   * Start metrics collection
   */
  private startMetricsCollection(): void {
    this.metricsTimer = setInterval(() => {
      this.collectMetrics();
    }, this.config.monitoring.metricsCollectionInterval);
  }

  /**
   * Collect performance metrics
   */
  private collectMetrics(): void {
    const now = new Date();
    const timeDiff = now.getTime() - this.performanceMetrics.lastMetricsUpdate.getTime();

    // Update lock contention rate
    if (this.lockManager) {
      const lockStats = this.lockManager.getStats();
      this.performanceMetrics.lockContentionRate = lockStats.lockContentionRate;
    }

    // Calculate task throughput (tasks per minute)
    const tasksPerMs = this.performanceMetrics.taskThroughput / timeDiff;
    this.performanceMetrics.taskThroughput = tasksPerMs * 60000; // Convert to per minute

    this.performanceMetrics.lastMetricsUpdate = now;

    this.emit('metrics_collected', this.performanceMetrics);
  }

  /**
   * Send vote request to node
   */
  private async sendVoteRequest(nodeId: AgentId, request: any): Promise<void> {
    if (!this.messageBus) {
      return;
    }

    const message = {
      id: `vote-req-${Date.now()}`,
      type: 'consensus_vote_request' as any,
      from: this.config.nodeId,
      to: nodeId,
      timestamp: new Date(),
      priority: 'high' as any,
      payload: request,
      metadata: {},
    };

    await this.messageBus.sendSatelliteMessage(message);
  }

  /**
   * Send vote response to node
   */
  private async sendVoteResponse(nodeId: AgentId, response: any): Promise<void> {
    if (!this.messageBus) {
      return;
    }

    const message = {
      id: `vote-resp-${Date.now()}`,
      type: 'consensus_vote_response' as any,
      from: this.config.nodeId,
      to: nodeId,
      timestamp: new Date(),
      priority: 'high' as any,
      payload: response,
      metadata: {},
    };

    await this.messageBus.sendSatelliteMessage(message);
  }

  /**
   * Send append entries to node
   */
  private async sendAppendEntries(nodeId: AgentId, request: any): Promise<void> {
    if (!this.messageBus) {
      return;
    }

    const message = {
      id: `append-req-${Date.now()}`,
      type: 'consensus_append_entries' as any,
      from: this.config.nodeId,
      to: nodeId,
      timestamp: new Date(),
      priority: 'high' as any,
      payload: request,
      metadata: {},
    };

    await this.messageBus.sendSatelliteMessage(message);
  }

  /**
   * Send append entries response to node
   */
  private async sendAppendEntriesResponse(nodeId: AgentId, response: any): Promise<void> {
    if (!this.messageBus) {
      return;
    }

    const message = {
      id: `append-resp-${Date.now()}`,
      type: 'consensus_append_entries_response' as any,
      from: this.config.nodeId,
      to: nodeId,
      timestamp: new Date(),
      priority: 'high' as any,
      payload: response,
      metadata: {},
    };

    await this.messageBus.sendSatelliteMessage(message);
  }

  /**
   * Send task dispatch to node
   */
  private async sendTaskDispatch(task: DistributedTask, nodeId: AgentId): Promise<void> {
    if (!this.messageBus) {
      return;
    }

    const message = {
      id: `task-dispatch-${Date.now()}`,
      type: 'task_dispatch' as any,
      from: this.config.nodeId,
      to: nodeId,
      timestamp: new Date(),
      priority: task.priority as any,
      payload: task,
      metadata: {},
    };

    await this.messageBus.sendSatelliteMessage(message);
  }

  /**
   * Handle incoming task dispatch
   */
  private async handleTaskDispatch(task: DistributedTask): Promise<void> {
    logger.info(`Received task dispatch: ${task.id} (${task.type})`);
    
    // Execute task (this would be implemented by specific satellite agents)
    this.emit('task_received', task);
    
    // Simulate task execution for now
    setTimeout(() => {
      this.emit('task_execution_completed', {
        taskId: task.id,
        result: { status: 'completed', data: {} },
      });
    }, 5000);
  }

  /**
   * Get average consensus latency
   */
  private getAverageConsensusLatency(): number {
    const latencies = this.performanceMetrics.consensusLatencies;
    if (latencies.length === 0) {
      return 0;
    }
    
    const sum = latencies.reduce((acc, lat) => acc + lat, 0);
    return sum / latencies.length;
  }
}