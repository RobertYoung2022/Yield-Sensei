/**
 * YieldSensei CRDT Manager
 * Task 45.2: Distributed Data Synchronization Protocols
 * 
 * Implements Conflict-free Replicated Data Types for distributed satellite state management
 */

import { EventEmitter } from 'events';
import Logger from '@/shared/logging/logger';
import { AgentId } from '@/types';

const logger = Logger.getLogger('crdt-manager');

/**
 * CRDT Operation Types
 */
export type CRDTOperationType = 
  | 'set'         // G-Set / LWW-Set operations
  | 'increment'   // G-Counter / PN-Counter operations
  | 'assign'      // LWW-Register operations
  | 'insert'      // Sequence CRDT operations
  | 'delete'      // Sequence CRDT operations
  | 'merge';      // Merge operations

/**
 * Vector Clock for ordering operations
 */
export interface VectorClock {
  [nodeId: string]: number;
}

/**
 * CRDT Operation
 */
export interface CRDTOperation {
  id: string;
  type: CRDTOperationType;
  crdtId: string;
  nodeId: AgentId;
  timestamp: Date;
  vectorClock: VectorClock;
  payload: any;
  metadata: Record<string, any>;
}

/**
 * CRDT State
 */
export interface CRDTState {
  id: string;
  type: CRDTType;
  nodeId: AgentId;
  vectorClock: VectorClock;
  value: any;
  lastModified: Date;
  version: number;
}

/**
 * CRDT Types
 */
export type CRDTType = 
  | 'g-set'         // Grow-only Set
  | 'lww-set'       // Last-Writer-Wins Set
  | 'g-counter'     // Grow-only Counter
  | 'pn-counter'    // Increment/Decrement Counter
  | 'lww-register'  // Last-Writer-Wins Register
  | 'mv-register'   // Multi-Value Register
  | 'sequence'      // Sequence CRDT (for ordered lists)
  | 'map';          // Map CRDT (for nested structures)

/**
 * Conflict Resolution Strategies
 */
export type ConflictResolutionStrategy = 
  | 'last-writer-wins'
  | 'multi-value'
  | 'timestamp-priority'
  | 'node-priority'
  | 'semantic-merge'
  | 'user-defined';

/**
 * CRDT Configuration
 */
export interface CRDTConfig {
  nodeId: AgentId;
  conflictResolution: ConflictResolutionStrategy;
  persistenceEnabled: boolean;
  syncInterval: number;
  maxOperationHistory: number;
  compressionEnabled: boolean;
  validationEnabled: boolean;
}

export const DEFAULT_CRDT_CONFIG: CRDTConfig = {
  nodeId: 'unknown',
  conflictResolution: 'last-writer-wins',
  persistenceEnabled: true,
  syncInterval: 30000, // 30 seconds
  maxOperationHistory: 1000,
  compressionEnabled: true,
  validationEnabled: true,
};

/**
 * G-Set (Grow-only Set) Implementation
 */
export class GSet {
  private elements: Set<any> = new Set();
  private operations: CRDTOperation[] = [];

  constructor(private id: string, private nodeId: AgentId) {}

  add(element: any): CRDTOperation {
    const operation: CRDTOperation = {
      id: `${this.id}-${Date.now()}-${Math.random()}`,
      type: 'set',
      crdtId: this.id,
      nodeId: this.nodeId,
      timestamp: new Date(),
      vectorClock: { [this.nodeId]: this.operations.length + 1 },
      payload: { action: 'add', element },
      metadata: {},
    };

    this.elements.add(element);
    this.operations.push(operation);
    
    return operation;
  }

  has(element: any): boolean {
    return this.elements.has(element);
  }

  values(): any[] {
    return Array.from(this.elements);
  }

  merge(other: GSet): void {
    for (const element of other.values()) {
      this.elements.add(element);
    }

    // Merge operations
    this.operations.push(...other.operations);
  }

  applyOperation(operation: CRDTOperation): void {
    if (operation.payload.action === 'add') {
      this.elements.add(operation.payload.element);
    }
    this.operations.push(operation);
  }

  getState(): CRDTState {
    return {
      id: this.id,
      type: 'g-set',
      nodeId: this.nodeId,
      vectorClock: this.getVectorClock(),
      value: this.values(),
      lastModified: new Date(),
      version: this.operations.length,
    };
  }

  private getVectorClock(): VectorClock {
    const clock: VectorClock = {};
    for (const op of this.operations) {
      clock[op.nodeId] = Math.max(clock[op.nodeId] || 0, op.vectorClock[op.nodeId] || 0);
    }
    return clock;
  }
}

/**
 * LWW-Register (Last-Writer-Wins Register) Implementation
 */
export class LWWRegister {
  private value: any = null;
  private timestamp: Date = new Date(0);
  private operations: CRDTOperation[] = [];

  constructor(private id: string, private nodeId: AgentId) {}

  set(value: any): CRDTOperation {
    const now = new Date();
    const operation: CRDTOperation = {
      id: `${this.id}-${now.getTime()}-${Math.random()}`,
      type: 'assign',
      crdtId: this.id,
      nodeId: this.nodeId,
      timestamp: now,
      vectorClock: { [this.nodeId]: this.operations.length + 1 },
      payload: { value, timestamp: now.getTime() },
      metadata: {},
    };

    this.value = value;
    this.timestamp = now;
    this.operations.push(operation);
    
    return operation;
  }

  get(): any {
    return this.value;
  }

  merge(other: LWWRegister): void {
    if (other.timestamp > this.timestamp) {
      this.value = other.value;
      this.timestamp = other.timestamp;
    }

    // Merge operations
    this.operations.push(...other.operations);
  }

  applyOperation(operation: CRDTOperation): void {
    const opTimestamp = new Date(operation.payload.timestamp);
    if (opTimestamp > this.timestamp) {
      this.value = operation.payload.value;
      this.timestamp = opTimestamp;
    }
    this.operations.push(operation);
  }

  getState(): CRDTState {
    return {
      id: this.id,
      type: 'lww-register',
      nodeId: this.nodeId,
      vectorClock: this.getVectorClock(),
      value: this.value,
      lastModified: this.timestamp,
      version: this.operations.length,
    };
  }

  private getVectorClock(): VectorClock {
    const clock: VectorClock = {};
    for (const op of this.operations) {
      clock[op.nodeId] = Math.max(clock[op.nodeId] || 0, op.vectorClock[op.nodeId] || 0);
    }
    return clock;
  }
}

/**
 * PN-Counter (Increment/Decrement Counter) Implementation
 */
export class PNCounter {
  private increments: Map<AgentId, number> = new Map();
  private decrements: Map<AgentId, number> = new Map();
  private operations: CRDTOperation[] = [];

  constructor(private id: string, private nodeId: AgentId) {}

  increment(amount: number = 1): CRDTOperation {
    const operation: CRDTOperation = {
      id: `${this.id}-inc-${Date.now()}-${Math.random()}`,
      type: 'increment',
      crdtId: this.id,
      nodeId: this.nodeId,
      timestamp: new Date(),
      vectorClock: { [this.nodeId]: this.operations.length + 1 },
      payload: { action: 'increment', amount },
      metadata: {},
    };

    const current = this.increments.get(this.nodeId) || 0;
    this.increments.set(this.nodeId, current + amount);
    this.operations.push(operation);
    
    return operation;
  }

  decrement(amount: number = 1): CRDTOperation {
    const operation: CRDTOperation = {
      id: `${this.id}-dec-${Date.now()}-${Math.random()}`,
      type: 'increment',
      crdtId: this.id,
      nodeId: this.nodeId,
      timestamp: new Date(),
      vectorClock: { [this.nodeId]: this.operations.length + 1 },
      payload: { action: 'decrement', amount },
      metadata: {},
    };

    const current = this.decrements.get(this.nodeId) || 0;
    this.decrements.set(this.nodeId, current + amount);
    this.operations.push(operation);
    
    return operation;
  }

  value(): number {
    const totalIncrements = Array.from(this.increments.values()).reduce((sum, val) => sum + val, 0);
    const totalDecrements = Array.from(this.decrements.values()).reduce((sum, val) => sum + val, 0);
    return totalIncrements - totalDecrements;
  }

  merge(other: PNCounter): void {
    // Merge increments
    for (const [nodeId, value] of other.increments) {
      const current = this.increments.get(nodeId) || 0;
      this.increments.set(nodeId, Math.max(current, value));
    }

    // Merge decrements
    for (const [nodeId, value] of other.decrements) {
      const current = this.decrements.get(nodeId) || 0;
      this.decrements.set(nodeId, Math.max(current, value));
    }

    // Merge operations
    this.operations.push(...other.operations);
  }

  applyOperation(operation: CRDTOperation): void {
    if (operation.payload.action === 'increment') {
      const current = this.increments.get(operation.nodeId) || 0;
      this.increments.set(operation.nodeId, current + operation.payload.amount);
    } else if (operation.payload.action === 'decrement') {
      const current = this.decrements.get(operation.nodeId) || 0;
      this.decrements.set(operation.nodeId, current + operation.payload.amount);
    }
    this.operations.push(operation);
  }

  getState(): CRDTState {
    return {
      id: this.id,
      type: 'pn-counter',
      nodeId: this.nodeId,
      vectorClock: this.getVectorClock(),
      value: this.value(),
      lastModified: new Date(),
      version: this.operations.length,
    };
  }

  private getVectorClock(): VectorClock {
    const clock: VectorClock = {};
    for (const op of this.operations) {
      clock[op.nodeId] = Math.max(clock[op.nodeId] || 0, op.vectorClock[op.nodeId] || 0);
    }
    return clock;
  }
}

/**
 * CRDT Manager
 * Central manager for all CRDT instances in a satellite node
 */
export class CRDTManager extends EventEmitter {
  private config: CRDTConfig;
  private crdts: Map<string, any> = new Map(); // CRDT instances
  private operationLog: CRDTOperation[] = [];
  private syncInterval?: NodeJS.Timeout;
  private vectorClock: VectorClock = {};

  constructor(config: CRDTConfig = DEFAULT_CRDT_CONFIG) {
    super();
    this.config = config;
    this.vectorClock[config.nodeId] = 0;
  }

  /**
   * Start the CRDT manager
   */
  async start(): Promise<void> {
    logger.info('Starting CRDT manager...');

    // Start periodic sync if configured
    if (this.config.syncInterval > 0) {
      this.syncInterval = setInterval(() => {
        this.performSync();
      }, this.config.syncInterval);
    }

    logger.info('CRDT manager started successfully');
    this.emit('started');
  }

  /**
   * Stop the CRDT manager
   */
  async stop(): Promise<void> {
    logger.info('Stopping CRDT manager...');

    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      delete this.syncInterval;
    }

    logger.info('CRDT manager stopped');
    this.emit('stopped');
  }

  /**
   * Create a new CRDT instance
   */
  createCRDT<T>(id: string, type: CRDTType): T {
    if (this.crdts.has(id)) {
      throw new Error(`CRDT with id ${id} already exists`);
    }

    let crdt: any;

    switch (type) {
      case 'g-set':
        crdt = new GSet(id, this.config.nodeId);
        break;
      case 'lww-register':
        crdt = new LWWRegister(id, this.config.nodeId);
        break;
      case 'pn-counter':
        crdt = new PNCounter(id, this.config.nodeId);
        break;
      default:
        throw new Error(`Unsupported CRDT type: ${type}`);
    }

    this.crdts.set(id, crdt);
    logger.debug(`Created CRDT: ${id} (${type})`);
    this.emit('crdt_created', { id, type, crdt });

    return crdt as T;
  }

  /**
   * Get an existing CRDT instance
   */
  getCRDT<T>(id: string): T | null {
    return this.crdts.get(id) as T || null;
  }

  /**
   * Remove a CRDT instance
   */
  removeCRDT(id: string): void {
    const crdt = this.crdts.get(id);
    if (crdt) {
      this.crdts.delete(id);
      logger.debug(`Removed CRDT: ${id}`);
      this.emit('crdt_removed', { id, crdt });
    }
  }

  /**
   * Apply operation to appropriate CRDT
   */
  applyOperation(operation: CRDTOperation): void {
    const crdt = this.crdts.get(operation.crdtId);
    if (!crdt) {
      logger.warn(`CRDT not found for operation: ${operation.crdtId}`);
      return;
    }

    // Update vector clock
    this.updateVectorClock(operation.vectorClock);

    // Apply operation to CRDT
    if (typeof crdt.applyOperation === 'function') {
      crdt.applyOperation(operation);
    } else {
      logger.error(`CRDT ${operation.crdtId} does not support applyOperation`);
      return;
    }

    // Add to operation log
    this.operationLog.push(operation);

    // Trim operation log if necessary
    if (this.operationLog.length > this.config.maxOperationHistory) {
      this.operationLog = this.operationLog.slice(-this.config.maxOperationHistory);
    }

    logger.debug(`Applied operation ${operation.id} to CRDT ${operation.crdtId}`);
    this.emit('operation_applied', operation);
  }

  /**
   * Get all pending operations since a vector clock
   */
  getOperationsSince(vectorClock: VectorClock): CRDTOperation[] {
    return this.operationLog.filter(op => {
      for (const [nodeId, timestamp] of Object.entries(op.vectorClock)) {
        const knownTimestamp = vectorClock[nodeId] || 0;
        if (timestamp > knownTimestamp) {
          return true;
        }
      }
      return false;
    });
  }

  /**
   * Merge state from another CRDT manager
   */
  async mergeState(otherState: {
    vectorClock: VectorClock;
    operations: CRDTOperation[];
    crdtStates: CRDTState[];
  }): Promise<void> {
    try {
      logger.debug('Starting state merge...');

      // Update vector clock
      this.updateVectorClock(otherState.vectorClock);

      // Apply missing operations
      for (const operation of otherState.operations) {
        if (!this.hasOperation(operation)) {
          this.applyOperation(operation);
        }
      }

      // Merge CRDT states
      for (const state of otherState.crdtStates) {
        await this.mergeCRDTState(state);
      }

      logger.debug('State merge completed successfully');
      this.emit('state_merged', otherState);

    } catch (error) {
      logger.error('Failed to merge state:', error);
      this.emit('merge_error', { error, otherState });
      throw error;
    }
  }

  /**
   * Get current synchronization state
   */
  getSyncState(): {
    vectorClock: VectorClock;
    operations: CRDTOperation[];
    crdtStates: CRDTState[];
  } {
    const crdtStates: CRDTState[] = [];
    
    for (const crdt of this.crdts.values()) {
      if (typeof crdt.getState === 'function') {
        crdtStates.push(crdt.getState());
      }
    }

    return {
      vectorClock: { ...this.vectorClock },
      operations: [...this.operationLog],
      crdtStates,
    };
  }

  /**
   * Perform periodic synchronization
   */
  private performSync(): void {
    const syncState = this.getSyncState();
    this.emit('sync_requested', syncState);
    logger.debug('Periodic sync performed');
  }

  /**
   * Update vector clock with incoming clock
   */
  private updateVectorClock(incomingClock: VectorClock): void {
    for (const [nodeId, timestamp] of Object.entries(incomingClock)) {
      this.vectorClock[nodeId] = Math.max(this.vectorClock[nodeId] || 0, timestamp);
    }
    
    // Increment own timestamp
    this.vectorClock[this.config.nodeId] = (this.vectorClock[this.config.nodeId] || 0) + 1;
  }

  /**
   * Check if operation is already applied
   */
  private hasOperation(operation: CRDTOperation): boolean {
    return this.operationLog.some(op => op.id === operation.id);
  }

  /**
   * Merge individual CRDT state
   */
  private async mergeCRDTState(state: CRDTState): Promise<void> {
    let crdt = this.crdts.get(state.id);
    
    if (!crdt) {
      // Create CRDT if it doesn't exist
      crdt = this.createCRDT(state.id, state.type);
    }

    // Apply merge based on CRDT type
    if (typeof crdt.merge === 'function') {
      // For direct merging, we'd need to reconstruct the CRDT from state
      // This is simplified - in practice would need more sophisticated state reconstruction
      logger.debug(`Merged CRDT state: ${state.id}`);
    }
  }

  /**
   * Get CRDT manager statistics
   */
  getStats() {
    return {
      crdtCount: this.crdts.size,
      operationCount: this.operationLog.length,
      vectorClock: this.vectorClock,
      config: this.config,
      crdtTypes: Array.from(this.crdts.entries()).map(([id, crdt]) => ({
        id,
        type: crdt.constructor.name,
      })),
    };
  }
}