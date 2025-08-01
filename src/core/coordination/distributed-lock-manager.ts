/**
 * YieldSensei Distributed Lock Manager
 * Task 45.3: Distributed Coordination and Consensus Framework
 * 
 * Implements distributed locking for resource coordination and mutual exclusion
 */

import { EventEmitter } from 'events';
import Logger from '@/shared/logging/logger';
import { AgentId } from '@/types';

const logger = Logger.getLogger('distributed-lock');

/**
 * Lock Status
 */
export type LockStatus = 'pending' | 'acquired' | 'released' | 'expired' | 'denied';

/**
 * Lock Type
 */
export type LockType = 'exclusive' | 'shared' | 'upgradeable';

/**
 * Distributed Lock
 */
export interface DistributedLock {
  id: string;
  resourceId: string;
  type: LockType;
  ownerId: AgentId;
  status: LockStatus;
  priority: number;
  
  // Timing
  requestedAt: Date;
  acquiredAt?: Date;
  expiresAt: Date;
  lastRenewalAt?: Date;
  
  // Metadata
  metadata: Record<string, any>;
}

/**
 * Lock Request
 */
export interface LockRequest {
  id: string;
  resourceId: string;
  type: LockType;
  requesterId: AgentId;
  priority: number;
  timeout: number;
  autoRenew: boolean;
  renewalInterval?: number;
  metadata: Record<string, any>;
}

/**
 * Lock Grant Message
 */
export interface LockGrant {
  lockId: string;
  resourceId: string;
  grantedTo: AgentId;
  expiresAt: Date;
  timestamp: Date;
}

/**
 * Lock Release Message
 */
export interface LockRelease {
  lockId: string;
  resourceId: string;
  releasedBy: AgentId;
  timestamp: Date;
  reason: 'manual' | 'expired' | 'preempted' | 'error';
}

/**
 * Lock Manager Configuration
 */
export interface LockManagerConfig {
  nodeId: AgentId;
  defaultTimeout: number;
  maxTimeout: number;
  renewalGracePeriod: number;
  cleanupInterval: number;
  maxLocksPerNode: number;
  enableDeadlockDetection: boolean;
  deadlockCheckInterval: number;
  lockTableSize: number;
}

export const DEFAULT_LOCK_MANAGER_CONFIG: LockManagerConfig = {
  nodeId: 'unknown',
  defaultTimeout: 30000,      // 30 seconds
  maxTimeout: 300000,         // 5 minutes
  renewalGracePeriod: 5000,   // 5 seconds
  cleanupInterval: 10000,     // 10 seconds
  maxLocksPerNode: 100,
  enableDeadlockDetection: true,
  deadlockCheckInterval: 60000, // 1 minute
  lockTableSize: 1000,
};

/**
 * Lock Statistics
 */
export interface LockStats {
  totalLocks: number;
  activeLocks: number;
  pendingLocks: number;
  locksPerNode: Map<AgentId, number>;
  locksPerResource: Map<string, number>;
  averageLockDuration: number;
  lockContentionRate: number;
  deadlocksDetected: number;
  expiredLocks: number;
}

/**
 * Deadlock Detection Result
 */
interface DeadlockCycle {
  nodes: AgentId[];
  resources: string[];
  locks: string[];
  detectedAt: Date;
}

/**
 * Distributed Lock Manager
 * Manages distributed locks for resource coordination
 */
export class DistributedLockManager extends EventEmitter {
  private config: LockManagerConfig;
  
  // Lock state
  private locks: Map<string, DistributedLock> = new Map();
  private resourceLocks: Map<string, Set<string>> = new Map(); // resource -> lock IDs
  private nodeLocks: Map<AgentId, Set<string>> = new Map(); // node -> lock IDs
  private pendingRequests: Map<string, LockRequest> = new Map();
  
  // Lock queues (per resource)
  private lockQueues: Map<string, LockRequest[]> = new Map();
  
  // Timers
  private cleanupTimer?: NodeJS.Timeout;
  private deadlockTimer?: NodeJS.Timeout;
  private renewalTimers: Map<string, NodeJS.Timeout> = new Map();
  
  // State
  private isRunning: boolean = false;
  private lockSequence: number = 0;
  
  // Statistics
  private stats: LockStats = {
    totalLocks: 0,
    activeLocks: 0,
    pendingLocks: 0,
    locksPerNode: new Map(),
    locksPerResource: new Map(),
    averageLockDuration: 0,
    lockContentionRate: 0,
    deadlocksDetected: 0,
    expiredLocks: 0,
  };

  constructor(config: LockManagerConfig = DEFAULT_LOCK_MANAGER_CONFIG) {
    super();
    this.config = config;
  }

  /**
   * Start the distributed lock manager
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Distributed lock manager already running');
      return;
    }

    logger.info('Starting distributed lock manager...');

    // Start cleanup timer
    this.cleanupTimer = setInterval(() => {
      this.cleanupExpiredLocks();
    }, this.config.cleanupInterval);

    // Start deadlock detection if enabled
    if (this.config.enableDeadlockDetection) {
      this.deadlockTimer = setInterval(() => {
        this.detectDeadlocks();
      }, this.config.deadlockCheckInterval);
    }

    this.isRunning = true;
    logger.info('Distributed lock manager started successfully');
    this.emit('started');
  }

  /**
   * Stop the distributed lock manager
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    logger.info('Stopping distributed lock manager...');

    // Clear timers
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      delete this.cleanupTimer;
    }

    if (this.deadlockTimer) {
      clearInterval(this.deadlockTimer);
      delete this.deadlockTimer;
    }

    // Clear renewal timers
    for (const timer of this.renewalTimers.values()) {
      clearTimeout(timer);
    }
    this.renewalTimers.clear();

    // Release all locks owned by this node
    await this.releaseAllNodeLocks(this.config.nodeId);

    this.isRunning = false;
    logger.info('Distributed lock manager stopped');
    this.emit('stopped');
  }

  /**
   * Request a distributed lock
   */
  async requestLock(
    resourceId: string,
    type: LockType = 'exclusive',
    options: {
      priority?: number;
      timeout?: number;
      autoRenew?: boolean;
      renewalInterval?: number;
      metadata?: Record<string, any>;
    } = {}
  ): Promise<string> {
    const lockId = `lock-${this.config.nodeId}-${++this.lockSequence}-${Date.now()}`;
    
    const request: LockRequest = {
      id: lockId,
      resourceId,
      type,
      requesterId: this.config.nodeId,
      priority: options.priority || 0,
      timeout: Math.min(options.timeout || this.config.defaultTimeout, this.config.maxTimeout),
      autoRenew: options.autoRenew || false,
      renewalInterval: options.renewalInterval,
      metadata: options.metadata || {},
    };

    // Check node lock limit
    const nodeLockCount = this.nodeLocks.get(this.config.nodeId)?.size || 0;
    if (nodeLockCount >= this.config.maxLocksPerNode) {
      throw new Error(`Node ${this.config.nodeId} has reached maximum lock limit`);
    }

    this.pendingRequests.set(lockId, request);
    this.stats.pendingLocks++;

    logger.debug(`Requesting ${type} lock ${lockId} for resource ${resourceId}`);
    this.emit('lock_requested', request);

    // Process the lock request
    await this.processLockRequest(request);

    return lockId;
  }

  /**
   * Release a distributed lock
   */
  async releaseLock(lockId: string, reason: 'manual' | 'expired' | 'preempted' | 'error' = 'manual'): Promise<boolean> {
    const lock = this.locks.get(lockId);
    if (!lock) {
      logger.warn(`Cannot release lock ${lockId}: not found`);
      return false;
    }

    if (lock.ownerId !== this.config.nodeId && reason === 'manual') {
      logger.warn(`Cannot release lock ${lockId}: not owned by this node`);
      return false;
    }

    return await this.performLockRelease(lock, reason);
  }

  /**
   * Renew a distributed lock
   */
  async renewLock(lockId: string, extensionTime?: number): Promise<boolean> {
    const lock = this.locks.get(lockId);
    if (!lock || lock.status !== 'acquired' || lock.ownerId !== this.config.nodeId) {
      logger.warn(`Cannot renew lock ${lockId}: not found or not owned`);
      return false;
    }

    const extension = extensionTime || this.config.defaultTimeout;
    const newExpiry = new Date(Date.now() + extension);

    lock.expiresAt = newExpiry;
    lock.lastRenewalAt = new Date();

    logger.debug(`Renewed lock ${lockId} until ${newExpiry.toISOString()}`);
    this.emit('lock_renewed', { lock, newExpiry });

    // Reset auto-renewal timer if enabled
    if (this.pendingRequests.get(lockId)?.autoRenew) {
      this.scheduleAutoRenewal(lock);
    }

    return true;
  }

  /**
   * Get lock information
   */
  getLock(lockId: string): DistributedLock | null {
    return this.locks.get(lockId) || null;
  }

  /**
   * Get all locks for a resource
   */
  getResourceLocks(resourceId: string): DistributedLock[] {
    const lockIds = this.resourceLocks.get(resourceId) || new Set();
    return Array.from(lockIds).map(id => this.locks.get(id)).filter(Boolean) as DistributedLock[];
  }

  /**
   * Get all locks owned by a node
   */
  getNodeLocks(nodeId: AgentId): DistributedLock[] {
    const lockIds = this.nodeLocks.get(nodeId) || new Set();
    return Array.from(lockIds).map(id => this.locks.get(id)).filter(Boolean) as DistributedLock[];
  }

  /**
   * Check if resource is locked
   */
  isResourceLocked(resourceId: string, lockType?: LockType): boolean {
    const locks = this.getResourceLocks(resourceId);
    const activeLocks = locks.filter(lock => lock.status === 'acquired');

    if (activeLocks.length === 0) {
      return false;
    }

    if (!lockType) {
      return true;
    }

    return activeLocks.some(lock => lock.type === lockType);
  }

  /**
   * Get lock statistics
   */
  getStats(): LockStats {
    // Update statistics
    this.updateStatistics();
    return { 
      ...this.stats,
      locksPerNode: new Map(this.stats.locksPerNode),
      locksPerResource: new Map(this.stats.locksPerResource),
    };
  }

  /**
   * Process a lock request
   */
  private async processLockRequest(request: LockRequest): Promise<void> {
    const { resourceId, type, requesterId } = request;

    // Add to queue
    if (!this.lockQueues.has(resourceId)) {
      this.lockQueues.set(resourceId, []);
    }
    
    const queue = this.lockQueues.get(resourceId)!;
    
    // Insert based on priority (higher priority first)
    let insertIndex = queue.length;
    for (let i = 0; i < queue.length; i++) {
      if (request.priority > queue[i].priority) {
        insertIndex = i;
        break;
      }
    }
    queue.splice(insertIndex, 0, request);

    // Try to grant the lock
    await this.tryGrantLocks(resourceId);
  }

  /**
   * Try to grant pending locks for a resource
   */
  private async tryGrantLocks(resourceId: string): Promise<void> {
    const queue = this.lockQueues.get(resourceId);
    if (!queue || queue.length === 0) {
      return;
    }

    const currentLocks = this.getResourceLocks(resourceId);
    const activeLocks = currentLocks.filter(lock => lock.status === 'acquired');

    // Process queue in priority order
    for (let i = 0; i < queue.length; i++) {
      const request = queue[i];
      
      if (this.canGrantLock(request, activeLocks)) {
        // Grant the lock
        queue.splice(i, 1);
        await this.grantLock(request);
        i--; // Adjust index after removal
        
        // Update active locks for next iteration
        const newLock = this.locks.get(request.id);
        if (newLock) {
          activeLocks.push(newLock);
        }
      }
    }
  }

  /**
   * Check if a lock can be granted
   */
  private canGrantLock(request: LockRequest, activeLocks: DistributedLock[]): boolean {
    const { type } = request;

    if (activeLocks.length === 0) {
      return true; // No conflicts
    }

    // Exclusive lock conflicts with any other lock
    if (type === 'exclusive') {
      return false;
    }

    // Shared lock can coexist with other shared locks
    if (type === 'shared') {
      return activeLocks.every(lock => lock.type === 'shared' || lock.type === 'upgradeable');
    }

    // Upgradeable lock can coexist with shared locks but not exclusive or other upgradeable
    if (type === 'upgradeable') {
      return activeLocks.every(lock => lock.type === 'shared');
    }

    return false;
  }

  /**
   * Grant a lock
   */
  private async grantLock(request: LockRequest): Promise<void> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + request.timeout);

    const lock: DistributedLock = {
      id: request.id,
      resourceId: request.resourceId,
      type: request.type,
      ownerId: request.requesterId,
      status: 'acquired',
      priority: request.priority,
      requestedAt: now,
      acquiredAt: now,
      expiresAt,
      metadata: request.metadata,
    };

    // Store the lock
    this.locks.set(lock.id, lock);
    
    // Update indices
    if (!this.resourceLocks.has(lock.resourceId)) {
      this.resourceLocks.set(lock.resourceId, new Set());
    }
    this.resourceLocks.get(lock.resourceId)!.add(lock.id);
    
    if (!this.nodeLocks.has(lock.ownerId)) {
      this.nodeLocks.set(lock.ownerId, new Set());
    }
    this.nodeLocks.get(lock.ownerId)!.add(lock.id);

    // Remove from pending
    this.pendingRequests.delete(lock.id);
    this.stats.pendingLocks--;
    this.stats.activeLocks++;

    // Schedule auto-renewal if enabled
    if (request.autoRenew) {
      this.scheduleAutoRenewal(lock);
    }

    // Schedule expiration
    this.scheduleExpiration(lock);

    logger.info(`Granted ${lock.type} lock ${lock.id} for resource ${lock.resourceId} to ${lock.ownerId}`);
    this.emit('lock_granted', { lock, request });
  }

  /**
   * Perform lock release
   */
  private async performLockRelease(lock: DistributedLock, reason: string): Promise<boolean> {
    const now = new Date();

    // Update lock status
    lock.status = 'released';

    // Remove from indices
    const resourceLocks = this.resourceLocks.get(lock.resourceId);
    if (resourceLocks) {
      resourceLocks.delete(lock.id);
      if (resourceLocks.size === 0) {
        this.resourceLocks.delete(lock.resourceId);
      }
    }

    const nodeLocks = this.nodeLocks.get(lock.ownerId);
    if (nodeLocks) {
      nodeLocks.delete(lock.id);
      if (nodeLocks.size === 0) {
        this.nodeLocks.delete(lock.ownerId);
      }
    }

    // Clear timers
    const renewalTimer = this.renewalTimers.get(lock.id);
    if (renewalTimer) {
      clearTimeout(renewalTimer);
      this.renewalTimers.delete(lock.id);
    }

    // Update statistics
    this.stats.activeLocks--;
    const duration = now.getTime() - (lock.acquiredAt?.getTime() || lock.requestedAt.getTime());
    this.updateAverageLockDuration(duration);

    logger.info(`Released lock ${lock.id} for resource ${lock.resourceId} (reason: ${reason})`);
    
    const releaseInfo: LockRelease = {
      lockId: lock.id,
      resourceId: lock.resourceId,
      releasedBy: lock.ownerId,
      timestamp: now,
      reason: reason as any,
    };
    
    this.emit('lock_released', { lock, release: releaseInfo });

    // Try to grant pending locks for this resource
    await this.tryGrantLocks(lock.resourceId);

    // Remove lock from storage (keep for a while for debugging)
    setTimeout(() => {
      this.locks.delete(lock.id);
    }, 60000); // Keep for 1 minute

    return true;
  }

  /**
   * Schedule auto-renewal for a lock
   */
  private scheduleAutoRenewal(lock: DistributedLock): void {
    const request = this.pendingRequests.get(lock.id);
    if (!request || !request.autoRenew) {
      return;
    }

    const renewalInterval = request.renewalInterval || Math.floor(request.timeout * 0.7);
    const renewalTime = lock.acquiredAt!.getTime() + renewalInterval;
    const delay = renewalTime - Date.now();

    if (delay > 0) {
      const timer = setTimeout(async () => {
        await this.renewLock(lock.id);
      }, delay);

      this.renewalTimers.set(lock.id, timer);
    }
  }

  /**
   * Schedule lock expiration
   */
  private scheduleExpiration(lock: DistributedLock): void {
    const delay = lock.expiresAt.getTime() - Date.now();
    
    if (delay > 0) {
      setTimeout(async () => {
        const currentLock = this.locks.get(lock.id);
        if (currentLock && currentLock.status === 'acquired') {
          logger.warn(`Lock ${lock.id} expired for resource ${lock.resourceId}`);
          this.stats.expiredLocks++;
          await this.performLockRelease(currentLock, 'expired');
        }
      }, delay);
    }
  }

  /**
   * Cleanup expired locks
   */
  private cleanupExpiredLocks(): void {
    const now = new Date();
    const expiredLocks: DistributedLock[] = [];

    for (const lock of this.locks.values()) {
      if (lock.status === 'acquired' && lock.expiresAt < now) {
        expiredLocks.push(lock);
      }
    }

    for (const lock of expiredLocks) {
      logger.warn(`Cleaning up expired lock ${lock.id} for resource ${lock.resourceId}`);
      this.stats.expiredLocks++;
      this.performLockRelease(lock, 'expired');
    }

    if (expiredLocks.length > 0) {
      logger.debug(`Cleaned up ${expiredLocks.length} expired locks`);
    }
  }

  /**
   * Detect deadlocks using cycle detection
   */
  private detectDeadlocks(): void {
    if (!this.config.enableDeadlockDetection) {
      return;
    }

    // Build wait-for graph
    const waitForGraph: Map<AgentId, Set<AgentId>> = new Map();
    
    for (const [resourceId, queue] of this.lockQueues) {
      const activeLocks = this.getResourceLocks(resourceId).filter(lock => lock.status === 'acquired');
      const lockOwners = activeLocks.map(lock => lock.ownerId);
      
      // Each waiting node waits for all current lock owners
      for (const request of queue) {
        if (!waitForGraph.has(request.requesterId)) {
          waitForGraph.set(request.requesterId, new Set());
        }
        
        for (const owner of lockOwners) {
          if (owner !== request.requesterId) {
            waitForGraph.get(request.requesterId)!.add(owner);
          }
        }
      }
    }

    // Detect cycles using DFS
    const cycles = this.findCycles(waitForGraph);
    
    if (cycles.length > 0) {
      this.stats.deadlocksDetected += cycles.length;
      logger.warn(`Detected ${cycles.length} deadlock cycles`);
      
      for (const cycle of cycles) {
        this.emit('deadlock_detected', cycle);
        await this.resolveDeadlock(cycle);
      }
    }
  }

  /**
   * Find cycles in wait-for graph
   */
  private findCycles(graph: Map<AgentId, Set<AgentId>>): DeadlockCycle[] {
    const cycles: DeadlockCycle[] = [];
    const visited = new Set<AgentId>();
    const recursionStack = new Set<AgentId>();
    const path: AgentId[] = [];

    const dfs = (node: AgentId): boolean => {
      if (recursionStack.has(node)) {
        // Found cycle
        const cycleStart = path.indexOf(node);
        const cycleNodes = path.slice(cycleStart);
        
        cycles.push({
          nodes: [...cycleNodes, node],
          resources: [], // Would need to track resources in real implementation
          locks: [], // Would need to track specific locks
          detectedAt: new Date(),
        });
        
        return true;
      }

      if (visited.has(node)) {
        return false;
      }

      visited.add(node);
      recursionStack.add(node);
      path.push(node);

      const neighbors = graph.get(node) || new Set();
      for (const neighbor of neighbors) {
        if (dfs(neighbor)) {
          return true;
        }
      }

      recursionStack.delete(node);
      path.pop();
      return false;
    };

    for (const node of graph.keys()) {
      if (!visited.has(node)) {
        dfs(node);
      }
    }

    return cycles;
  }

  /**
   * Resolve deadlock by releasing locks
   */
  private async resolveDeadlock(cycle: DeadlockCycle): Promise<void> {
    // Simple resolution: release locks from the node with lowest priority
    // In practice, would use more sophisticated algorithms
    
    const nodeLocks = new Map<AgentId, DistributedLock[]>();
    for (const nodeId of cycle.nodes) {
      nodeLocks.set(nodeId, this.getNodeLocks(nodeId));
    }

    // Find node with lowest priority locks
    let victimNode: AgentId | null = null;
    let lowestPriority = Infinity;

    for (const [nodeId, locks] of nodeLocks) {
      const avgPriority = locks.reduce((sum, lock) => sum + lock.priority, 0) / locks.length;
      if (avgPriority < lowestPriority) {
        lowestPriority = avgPriority;
        victimNode = nodeId;
      }
    }

    if (victimNode) {
      const victimsLocks = nodeLocks.get(victimNode) || [];
      logger.warn(`Resolving deadlock by releasing ${victimsLocks.length} locks from ${victimNode}`);
      
      for (const lock of victimsLocks) {
        await this.performLockRelease(lock, 'preempted');
      }
    }
  }

  /**
   * Release all locks owned by a node
   */
  private async releaseAllNodeLocks(nodeId: AgentId): Promise<void> {
    const locks = this.getNodeLocks(nodeId);
    
    for (const lock of locks) {
      await this.performLockRelease(lock, 'manual');
    }

    logger.info(`Released ${locks.length} locks for node ${nodeId}`);
  }

  /**
   * Update statistics
   */
  private updateStatistics(): void {
    // Update locks per node
    this.stats.locksPerNode.clear();
    for (const [nodeId, lockIds] of this.nodeLocks) {
      this.stats.locksPerNode.set(nodeId, lockIds.size);
    }

    // Update locks per resource
    this.stats.locksPerResource.clear();
    for (const [resourceId, lockIds] of this.resourceLocks) {
      this.stats.locksPerResource.set(resourceId, lockIds.size);
    }

    // Update counts
    this.stats.totalLocks = this.locks.size;
    this.stats.activeLocks = Array.from(this.locks.values()).filter(lock => lock.status === 'acquired').length;

    // Calculate contention rate
    const totalQueued = Array.from(this.lockQueues.values()).reduce((sum, queue) => sum + queue.length, 0);
    this.stats.lockContentionRate = this.stats.activeLocks > 0 ? totalQueued / this.stats.activeLocks : 0;
  }

  /**
   * Update average lock duration
   */
  private updateAverageLockDuration(duration: number): void {
    const currentAvg = this.stats.averageLockDuration;
    const completedLocks = this.stats.totalLocks - this.stats.activeLocks - this.stats.pendingLocks;
    
    if (completedLocks > 0) {
      this.stats.averageLockDuration = ((currentAvg * (completedLocks - 1)) + duration) / completedLocks;
    }
  }
}