/**
 * YieldSensei Task Coordinator
 * Task 45.3: Distributed Coordination and Consensus Framework
 * 
 * Manages distributed task assignment, scheduling, and coordination among satellites
 */

import { EventEmitter } from 'events';
import Logger from '@/shared/logging/logger';
import { AgentId } from '@/types';
import { ConsensusEngine } from './consensus-engine';

const logger = Logger.getLogger('task-coordinator');

/**
 * Task Status
 */
export type TaskStatus = 
  | 'pending'     // Task created but not assigned
  | 'assigned'    // Task assigned to a satellite
  | 'running'     // Task is being executed
  | 'completed'   // Task completed successfully
  | 'failed'      // Task failed
  | 'cancelled'   // Task was cancelled
  | 'timeout';    // Task timed out

/**
 * Task Priority
 */
export type TaskPriority = 'low' | 'medium' | 'high' | 'critical';

/**
 * Task Type
 */
export type TaskType = 
  | 'analysis'          // Data analysis task
  | 'computation'       // Computational task
  | 'coordination'      // Coordination task
  | 'monitoring'        // Monitoring task
  | 'maintenance'       // Maintenance task
  | 'communication'     // Communication task
  | 'consensus';        // Consensus-related task

/**
 * Distributed Task Definition
 */
export interface DistributedTask {
  id: string;
  type: TaskType;
  priority: TaskPriority;
  status: TaskStatus;
  
  // Task details
  payload: any;
  requirements: {
    minNodes?: number;
    maxNodes?: number;
    requiredCapabilities?: string[];
    resourceRequirements?: {
      cpu?: number;
      memory?: number;
      storage?: number;
    };
    constraints?: {
      excludeNodes?: AgentId[];
      affinity?: AgentId[];
      region?: string;
    };
  };
  
  // Scheduling
  createdAt: Date;
  assignedAt?: Date;
  startedAt?: Date;
  completedAt?: Date;
  timeoutAt?: Date;
  
  // Assignment
  assignedTo: AgentId[];
  coordinator?: AgentId;
  
  // Results and progress
  progress: number;
  result?: any;
  error?: string;
  
  // Metadata
  metadata: Record<string, any>;
}

/**
 * Node Capability Information
 */
export interface NodeCapability {
  nodeId: AgentId;
  capabilities: string[];
  resources: {
    availableCpu: number;
    availableMemory: number;
    availableStorage: number;
  };
  load: {
    currentTasks: number;
    cpuUsage: number;
    memoryUsage: number;
  };
  status: 'available' | 'busy' | 'maintenance' | 'offline';
  lastHeartbeat: Date;
  region?: string;
  metadata: Record<string, any>;
}

/**
 * Task Assignment Strategy
 */
export type AssignmentStrategy = 
  | 'round-robin'        // Simple round-robin assignment
  | 'least-loaded'       // Assign to least loaded node
  | 'capability-match'   // Match based on capabilities
  | 'affinity-based'     // Use node affinity rules
  | 'resource-aware'     // Consider resource requirements
  | 'consensus-based';   // Use consensus for assignment

/**
 * Coordination Configuration
 */
export interface CoordinationConfig {
  nodeId: AgentId;
  assignmentStrategy: AssignmentStrategy;
  maxConcurrentTasks: number;
  taskTimeout: number;
  heartbeatInterval: number;
  nodeTimeout: number;
  enableLoadBalancing: boolean;
  enableFailover: boolean;
  retryAttempts: number;
  retryDelay: number;
}

export const DEFAULT_COORDINATION_CONFIG: CoordinationConfig = {
  nodeId: 'unknown',
  assignmentStrategy: 'resource-aware',
  maxConcurrentTasks: 10,
  taskTimeout: 300000, // 5 minutes
  heartbeatInterval: 30000, // 30 seconds
  nodeTimeout: 90000, // 90 seconds
  enableLoadBalancing: true,
  enableFailover: true,
  retryAttempts: 3,
  retryDelay: 5000, // 5 seconds
};

/**
 * Task Assignment Result
 */
export interface TaskAssignment {
  taskId: string;
  assignedNodes: AgentId[];
  coordinator: AgentId;
  strategy: AssignmentStrategy;
  timestamp: Date;
  expectedDuration?: number;
  metadata: Record<string, any>;
}

/**
 * Coordination Statistics
 */
export interface CoordinationStats {
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  pendingTasks: number;
  runningTasks: number;
  averageExecutionTime: number;
  nodeUtilization: Map<AgentId, number>;
  successRate: number;
  lastAssignmentTime?: Date;
}

/**
 * Task Coordinator
 * Manages distributed task assignment and execution coordination
 */
export class TaskCoordinator extends EventEmitter {
  private config: CoordinationConfig;
  private consensusEngine?: ConsensusEngine;
  
  // Task management
  private tasks: Map<string, DistributedTask> = new Map();
  private nodeCapabilities: Map<AgentId, NodeCapability> = new Map();
  private assignments: Map<string, TaskAssignment> = new Map();
  
  // Timers
  private heartbeatTimer?: NodeJS.Timeout;
  private cleanupTimer?: NodeJS.Timeout;
  
  // State
  private isRunning: boolean = false;
  private isLeader: boolean = false;
  private taskSequence: number = 0;
  
  // Statistics
  private stats: CoordinationStats = {
    totalTasks: 0,
    completedTasks: 0,
    failedTasks: 0,
    pendingTasks: 0,
    runningTasks: 0,
    averageExecutionTime: 0,
    nodeUtilization: new Map(),
    successRate: 0,
  };

  constructor(config: CoordinationConfig = DEFAULT_COORDINATION_CONFIG) {
    super();
    this.config = config;
  }

  /**
   * Set consensus engine for leader-based coordination
   */
  setConsensusEngine(consensusEngine: ConsensusEngine): void {
    this.consensusEngine = consensusEngine;
    this.setupConsensusHandlers();
  }

  /**
   * Start the task coordinator
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Task coordinator already running');
      return;
    }

    logger.info('Starting task coordinator...');

    // Start heartbeat monitoring
    this.startHeartbeat();
    
    // Start cleanup timer
    this.startCleanup();

    this.isRunning = true;
    logger.info('Task coordinator started successfully');
    this.emit('started');
  }

  /**
   * Stop the task coordinator
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    logger.info('Stopping task coordinator...');

    // Clear timers
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      delete this.heartbeatTimer;
    }

    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      delete this.cleanupTimer;
    }

    this.isRunning = false;
    logger.info('Task coordinator stopped');
    this.emit('stopped');
  }

  /**
   * Submit a new distributed task
   */
  async submitTask(taskDefinition: Omit<DistributedTask, 'id' | 'status' | 'createdAt' | 'assignedTo' | 'progress'>): Promise<string> {
    const taskId = `task-${this.config.nodeId}-${++this.taskSequence}-${Date.now()}`;

    const task: DistributedTask = {
      ...taskDefinition,
      id: taskId,
      status: 'pending',
      createdAt: new Date(),
      assignedTo: [],
      progress: 0,
      timeoutAt: new Date(Date.now() + this.config.taskTimeout),
    };

    this.tasks.set(taskId, task);
    this.stats.totalTasks++;
    this.stats.pendingTasks++;

    logger.info(`Submitted task ${taskId} (${task.type}, priority: ${task.priority})`);
    this.emit('task_submitted', task);

    // If we're the leader or not using consensus, assign immediately
    if (!this.consensusEngine || this.isLeader) {
      await this.assignTask(taskId);
    }

    return taskId;
  }

  /**
   * Assign task to appropriate satellites
   */
  async assignTask(taskId: string): Promise<TaskAssignment | null> {
    const task = this.tasks.get(taskId);
    if (!task || task.status !== 'pending') {
      logger.warn(`Cannot assign task ${taskId}: task not found or not pending`);
      return null;
    }

    try {
      const availableNodes = this.getAvailableNodes();
      const selectedNodes = await this.selectNodes(task, availableNodes);

      if (selectedNodes.length === 0) {
        logger.warn(`No suitable nodes available for task ${taskId}`);
        return null;
      }

      // Create assignment
      const assignment: TaskAssignment = {
        taskId,
        assignedNodes: selectedNodes,
        coordinator: this.config.nodeId,
        strategy: this.config.assignmentStrategy,
        timestamp: new Date(),
        metadata: {},
      };

      // Update task status
      task.status = 'assigned';
      task.assignedTo = selectedNodes;
      task.assignedAt = new Date();
      task.coordinator = this.config.nodeId;

      this.assignments.set(taskId, assignment);
      this.stats.pendingTasks--;

      logger.info(`Assigned task ${taskId} to nodes: ${selectedNodes.join(', ')}`);
      this.emit('task_assigned', { task, assignment });

      // Send task to assigned nodes
      await this.sendTaskToNodes(task, selectedNodes);

      return assignment;

    } catch (error) {
      logger.error(`Failed to assign task ${taskId}:`, error);
      task.status = 'failed';
      task.error = error instanceof Error ? error.message : 'Assignment failed';
      this.stats.failedTasks++;
      this.emit('task_failed', { task, error });
      return null;
    }
  }

  /**
   * Update task progress
   */
  updateTaskProgress(taskId: string, progress: number, nodeId: AgentId): void {
    const task = this.tasks.get(taskId);
    if (!task) {
      logger.warn(`Task ${taskId} not found for progress update`);
      return;
    }

    const oldProgress = task.progress;
    task.progress = Math.max(progress, task.progress);

    if (task.progress !== oldProgress) {
      logger.debug(`Task ${taskId} progress updated: ${task.progress}% (from ${nodeId})`);
      this.emit('task_progress', { task, progress: task.progress, nodeId });
    }
  }

  /**
   * Complete a task
   */
  completeTask(taskId: string, result: any, nodeId: AgentId): void {
    const task = this.tasks.get(taskId);
    if (!task) {
      logger.warn(`Task ${taskId} not found for completion`);
      return;
    }

    task.status = 'completed';
    task.progress = 100;
    task.result = result;
    task.completedAt = new Date();

    // Update statistics
    this.stats.completedTasks++;
    this.stats.runningTasks--;
    
    const executionTime = task.completedAt.getTime() - (task.startedAt?.getTime() || task.assignedAt?.getTime() || 0);
    this.updateAverageExecutionTime(executionTime);

    logger.info(`Task ${taskId} completed by ${nodeId}`);
    this.emit('task_completed', { task, result, nodeId });

    // Notify all assigned nodes about completion
    this.notifyTaskCompletion(task);
  }

  /**
   * Fail a task
   */
  failTask(taskId: string, error: string, nodeId: AgentId): void {
    const task = this.tasks.get(taskId);
    if (!task) {
      logger.warn(`Task ${taskId} not found for failure`);
      return;
    }

    task.status = 'failed';
    task.error = error;
    task.completedAt = new Date();

    this.stats.failedTasks++;
    this.stats.runningTasks--;

    logger.warn(`Task ${taskId} failed on ${nodeId}: ${error}`);
    this.emit('task_failed', { task, error, nodeId });

    // Attempt retry if configured
    if (this.config.enableFailover && task.metadata.retryCount < this.config.retryAttempts) {
      setTimeout(() => {
        this.retryTask(taskId);
      }, this.config.retryDelay);
    }
  }

  /**
   * Register node capabilities
   */
  registerNode(nodeCapability: NodeCapability): void {
    const existingNode = this.nodeCapabilities.get(nodeCapability.nodeId);
    
    this.nodeCapabilities.set(nodeCapability.nodeId, {
      ...nodeCapability,
      lastHeartbeat: new Date(),
    });

    if (!existingNode) {
      logger.info(`Registered node ${nodeCapability.nodeId} with capabilities: ${nodeCapability.capabilities.join(', ')}`);
      this.emit('node_registered', nodeCapability);
    } else {
      logger.debug(`Updated capabilities for node ${nodeCapability.nodeId}`);
      this.emit('node_updated', nodeCapability);
    }
  }

  /**
   * Update node heartbeat
   */
  updateNodeHeartbeat(nodeId: AgentId, status?: 'available' | 'busy' | 'maintenance' | 'offline'): void {
    const node = this.nodeCapabilities.get(nodeId);
    if (node) {
      node.lastHeartbeat = new Date();
      if (status) {
        node.status = status;
      }
      this.emit('node_heartbeat', { nodeId, timestamp: node.lastHeartbeat });
    }
  }

  /**
   * Get task by ID
   */
  getTask(taskId: string): DistributedTask | null {
    return this.tasks.get(taskId) || null;
  }

  /**
   * Get all tasks with optional filter
   */
  getTasks(filter?: {
    status?: TaskStatus;
    type?: TaskType;
    assignedTo?: AgentId;
    priority?: TaskPriority;
  }): DistributedTask[] {
    let tasks = Array.from(this.tasks.values());

    if (filter) {
      if (filter.status) {
        tasks = tasks.filter(task => task.status === filter.status);
      }
      if (filter.type) {
        tasks = tasks.filter(task => task.type === filter.type);
      }
      if (filter.assignedTo) {
        tasks = tasks.filter(task => task.assignedTo.includes(filter.assignedTo!));
      }
      if (filter.priority) {
        tasks = tasks.filter(task => task.priority === filter.priority);
      }
    }

    return tasks;
  }

  /**
   * Get coordination statistics
   */
  getStats(): CoordinationStats {
    // Update node utilization
    this.stats.nodeUtilization.clear();
    for (const [nodeId, capability] of this.nodeCapabilities) {
      const utilization = capability.load.currentTasks / this.config.maxConcurrentTasks;
      this.stats.nodeUtilization.set(nodeId, utilization);
    }

    // Update success rate
    const totalCompleted = this.stats.completedTasks + this.stats.failedTasks;
    this.stats.successRate = totalCompleted > 0 ? this.stats.completedTasks / totalCompleted : 0;

    return { ...this.stats, nodeUtilization: new Map(this.stats.nodeUtilization) };
  }

  /**
   * Setup consensus engine event handlers
   */
  private setupConsensusHandlers(): void {
    if (!this.consensusEngine) {
      return;
    }

    this.consensusEngine.on('state_changed', ({ state }) => {
      this.isLeader = state === 'leader';
      
      if (this.isLeader) {
        logger.info('Became coordination leader');
        this.onBecomeLeader();
      } else {
        logger.info('No longer coordination leader');
        this.onLoseLeadership();
      }
    });

    this.consensusEngine.on('command_applied', ({ command }) => {
      this.handleConsensusCommand(command);
    });
  }

  /**
   * Handle becoming leader
   */
  private onBecomeLeader(): void {
    // Reassign pending tasks
    const pendingTasks = this.getTasks({ status: 'pending' });
    for (const task of pendingTasks) {
      this.assignTask(task.id);
    }

    this.emit('leadership_gained');
  }

  /**
   * Handle losing leadership
   */
  private onLoseLeadership(): void {
    // Stop assigning new tasks
    this.emit('leadership_lost');
  }

  /**
   * Get available nodes for task assignment
   */
  private getAvailableNodes(): NodeCapability[] {
    const now = new Date();
    const nodeTimeout = this.config.nodeTimeout;

    return Array.from(this.nodeCapabilities.values()).filter(node => {
      const timeSinceHeartbeat = now.getTime() - node.lastHeartbeat.getTime();
      return node.status === 'available' && 
             timeSinceHeartbeat < nodeTimeout &&
             node.load.currentTasks < this.config.maxConcurrentTasks;
    });
  }

  /**
   * Select nodes for task assignment based on strategy
   */
  private async selectNodes(task: DistributedTask, availableNodes: NodeCapability[]): Promise<AgentId[]> {
    // Filter nodes based on requirements
    let candidateNodes = availableNodes.filter(node => {
      // Check capabilities
      if (task.requirements.requiredCapabilities) {
        const hasAllCapabilities = task.requirements.requiredCapabilities.every(
          cap => node.capabilities.includes(cap)
        );
        if (!hasAllCapabilities) {
          return false;
        }
      }

      // Check resource requirements
      if (task.requirements.resourceRequirements) {
        const req = task.requirements.resourceRequirements;
        if (req.cpu && node.resources.availableCpu < req.cpu) return false;
        if (req.memory && node.resources.availableMemory < req.memory) return false;
        if (req.storage && node.resources.availableStorage < req.storage) return false;
      }

      // Check constraints
      if (task.requirements.constraints) {
        const constraints = task.requirements.constraints;
        if (constraints.excludeNodes && constraints.excludeNodes.includes(node.nodeId)) {
          return false;
        }
        if (constraints.region && node.region !== constraints.region) {
          return false;
        }
      }

      return true;
    });

    // Apply selection strategy
    const minNodes = task.requirements.minNodes || 1;
    const maxNodes = task.requirements.maxNodes || candidateNodes.length;

    switch (this.config.assignmentStrategy) {
      case 'round-robin':
        return this.selectRoundRobin(candidateNodes, minNodes, maxNodes);
      case 'least-loaded':
        return this.selectLeastLoaded(candidateNodes, minNodes, maxNodes);
      case 'capability-match':
        return this.selectBestCapabilityMatch(candidateNodes, task, minNodes, maxNodes);
      case 'resource-aware':
        return this.selectResourceAware(candidateNodes, task, minNodes, maxNodes);
      case 'affinity-based':
        return this.selectAffinityBased(candidateNodes, task, minNodes, maxNodes);
      default:
        return this.selectLeastLoaded(candidateNodes, minNodes, maxNodes);
    }
  }

  /**
   * Round-robin node selection
   */
  private selectRoundRobin(nodes: NodeCapability[], minNodes: number, maxNodes: number): AgentId[] {
    const selected = nodes.slice(0, Math.min(maxNodes, nodes.length));
    return selected.length >= minNodes ? selected.map(n => n.nodeId) : [];
  }

  /**
   * Select least loaded nodes
   */
  private selectLeastLoaded(nodes: NodeCapability[], minNodes: number, maxNodes: number): AgentId[] {
    const sorted = nodes.sort((a, b) => a.load.currentTasks - b.load.currentTasks);
    const selected = sorted.slice(0, Math.min(maxNodes, sorted.length));
    return selected.length >= minNodes ? selected.map(n => n.nodeId) : [];
  }

  /**
   * Select based on capability match
   */
  private selectBestCapabilityMatch(nodes: NodeCapability[], task: DistributedTask, minNodes: number, maxNodes: number): AgentId[] {
    // Score nodes based on capability match
    const scored = nodes.map(node => {
      let score = 0;
      if (task.requirements.requiredCapabilities) {
        const matchingCaps = task.requirements.requiredCapabilities.filter(
          cap => node.capabilities.includes(cap)
        );
        score = matchingCaps.length / task.requirements.requiredCapabilities.length;
      }
      return { node, score };
    });

    const sorted = scored.sort((a, b) => b.score - a.score);
    const selected = sorted.slice(0, Math.min(maxNodes, sorted.length));
    return selected.length >= minNodes ? selected.map(item => item.node.nodeId) : [];
  }

  /**
   * Select based on resource availability
   */
  private selectResourceAware(nodes: NodeCapability[], task: DistributedTask, minNodes: number, maxNodes: number): AgentId[] {
    // Score nodes based on available resources
    const scored = nodes.map(node => {
      let score = 0;
      score += node.resources.availableCpu / 100;
      score += node.resources.availableMemory / 1000;
      score += node.resources.availableStorage / 1000;
      score -= node.load.currentTasks / this.config.maxConcurrentTasks;
      return { node, score };
    });

    const sorted = scored.sort((a, b) => b.score - a.score);
    const selected = sorted.slice(0, Math.min(maxNodes, sorted.length));
    return selected.length >= minNodes ? selected.map(item => item.node.nodeId) : [];
  }

  /**
   * Select based on affinity rules
   */
  private selectAffinityBased(nodes: NodeCapability[], task: DistributedTask, minNodes: number, maxNodes: number): AgentId[] {
    const constraints = task.requirements.constraints;
    
    if (constraints?.affinity) {
      // Prefer affinity nodes
      const affinityNodes = nodes.filter(node => constraints.affinity!.includes(node.nodeId));
      if (affinityNodes.length >= minNodes) {
        return affinityNodes.slice(0, Math.min(maxNodes, affinityNodes.length)).map(n => n.nodeId);
      }
    }

    // Fallback to least loaded
    return this.selectLeastLoaded(nodes, minNodes, maxNodes);
  }

  /**
   * Send task to assigned nodes
   */
  private async sendTaskToNodes(task: DistributedTask, nodeIds: AgentId[]): Promise<void> {
    for (const nodeId of nodeIds) {
      this.emit('task_dispatch', { task, nodeId });
    }
    
    task.status = 'running';
    task.startedAt = new Date();
    this.stats.runningTasks++;
    
    logger.debug(`Dispatched task ${task.id} to ${nodeIds.length} nodes`);
  }

  /**
   * Retry failed task
   */
  private async retryTask(taskId: string): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task || task.status !== 'failed') {
      return;
    }

    task.metadata.retryCount = (task.metadata.retryCount || 0) + 1;
    task.status = 'pending';
    task.error = undefined;
    task.assignedTo = [];
    task.assignedAt = undefined;
    task.startedAt = undefined;
    
    this.stats.failedTasks--;
    this.stats.pendingTasks++;

    logger.info(`Retrying task ${taskId} (attempt ${task.metadata.retryCount})`);
    this.emit('task_retry', { task, attempt: task.metadata.retryCount });

    await this.assignTask(taskId);
  }

  /**
   * Notify all nodes about task completion
   */
  private notifyTaskCompletion(task: DistributedTask): void {
    for (const nodeId of task.assignedTo) {
      this.emit('task_completion_notification', { task, nodeId });
    }
  }

  /**
   * Start heartbeat monitoring
   */
  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      this.checkNodeHealth();
    }, this.config.heartbeatInterval);
  }

  /**
   * Check node health and remove stale nodes
   */
  private checkNodeHealth(): void {
    const now = new Date();
    const timeout = this.config.nodeTimeout;
    const staleNodes: AgentId[] = [];

    for (const [nodeId, capability] of this.nodeCapabilities) {
      const timeSinceHeartbeat = now.getTime() - capability.lastHeartbeat.getTime();
      
      if (timeSinceHeartbeat > timeout) {
        capability.status = 'offline';
        staleNodes.push(nodeId);
      }
    }

    // Handle stale nodes
    for (const nodeId of staleNodes) {
      this.handleNodeFailure(nodeId);
    }
  }

  /**
   * Handle node failure
   */
  private handleNodeFailure(nodeId: AgentId): void {
    logger.warn(`Node ${nodeId} is unresponsive`);
    this.emit('node_failed', { nodeId });

    // Find tasks assigned to failed node and reassign if possible
    if (this.config.enableFailover && this.isLeader) {
      const affectedTasks = this.getTasks({ assignedTo: nodeId }).filter(
        task => task.status === 'running' || task.status === 'assigned'
      );

      for (const task of affectedTasks) {
        logger.info(`Reassigning task ${task.id} due to node ${nodeId} failure`);
        task.assignedTo = task.assignedTo.filter(id => id !== nodeId);
        
        if (task.assignedTo.length === 0) {
          task.status = 'pending';
          task.assignedAt = undefined;
          task.startedAt = undefined;
          this.assignTask(task.id);
        }
      }
    }
  }

  /**
   * Start cleanup timer for completed/failed tasks
   */
  private startCleanup(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanupOldTasks();
    }, 300000); // 5 minutes
  }

  /**
   * Clean up old completed/failed tasks
   */
  private cleanupOldTasks(): void {
    const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
    let cleanedCount = 0;

    for (const [taskId, task] of this.tasks.entries()) {
      if ((task.status === 'completed' || task.status === 'failed') &&
          task.completedAt && task.completedAt < cutoffTime) {
        
        this.tasks.delete(taskId);
        this.assignments.delete(taskId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      logger.debug(`Cleaned up ${cleanedCount} old tasks`);
    }
  }

  /**
   * Handle consensus commands
   */
  private handleConsensusCommand(command: any): void {
    // Handle distributed commands submitted through consensus
    switch (command.type) {
      case 'assign_task':
        this.assignTask(command.taskId);
        break;
      case 'update_node_capability':
        this.registerNode(command.capability);
        break;
      default:
        logger.debug(`Unknown consensus command: ${command.type}`);
    }
  }

  /**
   * Update average execution time
   */
  private updateAverageExecutionTime(executionTime: number): void {
    const currentAvg = this.stats.averageExecutionTime;
    const completedTasks = this.stats.completedTasks;
    
    this.stats.averageExecutionTime = ((currentAvg * (completedTasks - 1)) + executionTime) / completedTasks;
  }
}