/**
 * YieldSensei Synchronization Manager
 * Task 45.2: Distributed Data Synchronization Protocols
 * 
 * Orchestrates CRDT-based state synchronization and event sourcing for satellite coordination
 */

import { EventEmitter } from 'events';
import Logger from '@/shared/logging/logger';
import { AgentId, Message } from '@/types';
import { CRDTManager, CRDTConfig, DEFAULT_CRDT_CONFIG, CRDTOperation } from './crdt-manager';
import { EventStore, EventStoreConfig, DEFAULT_EVENT_STORE_CONFIG, DomainEvent } from './event-store';
import { SatelliteMessageBus } from '../communication/satellite-message-bus';

const logger = Logger.getLogger('sync-manager');

/**
 * Synchronization Strategy
 */
export type SyncStrategy = 
  | 'eventual-consistency'  // CRDT-based eventual consistency
  | 'event-sourcing'        // Event sourcing with replay
  | 'hybrid'                // Combined CRDT + Event sourcing
  | 'snapshot-based'        // Snapshot synchronization
  | 'delta-sync';           // Delta synchronization

/**
 * Conflict Resolution Policy
 */
export type ConflictResolutionPolicy = 
  | 'last-writer-wins'
  | 'first-writer-wins'
  | 'merge-conflicts'
  | 'manual-resolution'
  | 'timestamp-priority'
  | 'node-priority';

/**
 * Synchronization Request
 */
export interface SyncRequest {
  id: string;
  sourceNodeId: AgentId;
  targetNodeId: AgentId | 'broadcast';
  strategy: SyncStrategy;
  priority: 'low' | 'medium' | 'high' | 'critical';
  dataTypes: string[];
  filters?: {
    aggregateIds?: string[];
    eventTypes?: string[];
    timestampRange?: { from: Date; to: Date };
  };
  metadata: Record<string, any>;
}

/**
 * Synchronization Response
 */
export interface SyncResponse {
  requestId: string;
  success: boolean;
  nodeId: AgentId;
  strategy: SyncStrategy;
  appliedOperations: number;
  appliedEvents: number;
  conflicts: ConflictInfo[];
  metadata: Record<string, any>;
  error?: string;
}

/**
 * Conflict Information
 */
export interface ConflictInfo {
  id: string;
  type: 'crdt-operation' | 'domain-event' | 'state-conflict';
  description: string;
  resolution: 'auto-resolved' | 'manual-required' | 'deferred';
  involvedNodes: AgentId[];
  timestamp: Date;
  data: any;
}

/**
 * Synchronization Manager Configuration
 */
export interface SyncManagerConfig {
  nodeId: AgentId;
  strategy: SyncStrategy;
  conflictResolution: ConflictResolutionPolicy;
  crdt: CRDTConfig;
  eventStore: EventStoreConfig;
  networking: {
    syncInterval: number;
    batchSize: number;
    maxRetries: number;
    timeout: number;
    compressionEnabled: boolean;
  };
  resilience: {
    partitionTolerance: boolean;
    offlineSupport: boolean;
    maxOfflineTime: number;
    reconciliationStrategy: 'immediate' | 'deferred' | 'manual';
  };
  monitoring: {
    metricsEnabled: boolean;
    conflictLogging: boolean;
    performanceTracking: boolean;
  };
}

export const DEFAULT_SYNC_MANAGER_CONFIG: SyncManagerConfig = {
  nodeId: 'unknown',
  strategy: 'hybrid',
  conflictResolution: 'last-writer-wins',
  crdt: DEFAULT_CRDT_CONFIG,
  eventStore: DEFAULT_EVENT_STORE_CONFIG,
  networking: {
    syncInterval: 30000, // 30 seconds
    batchSize: 100,
    maxRetries: 3,
    timeout: 10000, // 10 seconds
    compressionEnabled: true,
  },
  resilience: {
    partitionTolerance: true,
    offlineSupport: true,
    maxOfflineTime: 24 * 60 * 60 * 1000, // 24 hours
    reconciliationStrategy: 'immediate',
  },
  monitoring: {
    metricsEnabled: true,
    conflictLogging: true,
    performanceTracking: true,
  },
};

/**
 * Synchronization Metrics
 */
export interface SyncMetrics {
  totalSyncRequests: number;
  successfulSyncs: number;
  failedSyncs: number;
  conflictsDetected: number;
  conflictsResolved: number;
  averageSyncLatency: number;
  totalDataSynced: number;
  lastSyncTimestamp?: Date;
  nodeStatuses: Map<AgentId, 'online' | 'offline' | 'degraded'>;
}

/**
 * Synchronization Manager
 * Central coordinator for distributed data synchronization across satellites
 */
export class SynchronizationManager extends EventEmitter {
  private config: SyncManagerConfig;
  private crdtManager: CRDTManager;
  private eventStore: EventStore;
  private messageBus?: SatelliteMessageBus;
  
  // State management
  private isRunning: boolean = false;
  private syncInterval?: NodeJS.Timeout;
  private pendingRequests: Map<string, SyncRequest> = new Map();
  private nodeStatuses: Map<AgentId, 'online' | 'offline' | 'degraded'> = new Map();
  
  // Metrics and monitoring
  private metrics: SyncMetrics = {
    totalSyncRequests: 0,
    successfulSyncs: 0,
    failedSyncs: 0,
    conflictsDetected: 0,
    conflictsResolved: 0,
    averageSyncLatency: 0,
    totalDataSynced: 0,
    nodeStatuses: new Map(),
  };

  constructor(config: SyncManagerConfig = DEFAULT_SYNC_MANAGER_CONFIG) {
    super();
    this.config = config;
    
    // Initialize CRDT manager
    this.crdtManager = new CRDTManager(config.crdt);
    
    // Initialize Event Store
    this.eventStore = new EventStore(config.eventStore);
    
    this.setupEventHandlers();
  }

  /**
   * Set message bus for network communication
   */
  setMessageBus(messageBus: SatelliteMessageBus): void {
    this.messageBus = messageBus;
    this.setupMessageBusHandlers();
  }

  /**
   * Start the synchronization manager
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Synchronization manager already running');
      return;
    }

    try {
      logger.info('Starting synchronization manager...');

      // Start core components
      await this.crdtManager.start();
      await this.eventStore.start();

      // Start periodic synchronization
      this.startPeriodicSync();

      this.isRunning = true;
      logger.info('Synchronization manager started successfully');
      this.emit('started');

    } catch (error) {
      logger.error('Failed to start synchronization manager:', error);
      throw error;
    }
  }

  /**
   * Stop the synchronization manager
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    logger.info('Stopping synchronization manager...');

    // Stop periodic sync
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      delete this.syncInterval;
    }

    // Stop core components
    await this.crdtManager.stop();
    await this.eventStore.stop();

    this.isRunning = false;
    logger.info('Synchronization manager stopped');
    this.emit('stopped');
  }

  /**
   * Request synchronization with target node(s)
   */
  async requestSync(request: Omit<SyncRequest, 'id' | 'sourceNodeId'>): Promise<string> {
    const syncRequest: SyncRequest = {
      ...request,
      id: `sync-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      sourceNodeId: this.config.nodeId,
    };

    try {
      logger.info(`Initiating sync request ${syncRequest.id} to ${syncRequest.targetNodeId}`);
      
      this.pendingRequests.set(syncRequest.id, syncRequest);
      this.metrics.totalSyncRequests++;

      // Send sync request via message bus
      if (this.messageBus) {
        await this.sendSyncRequest(syncRequest);
      } else {
        throw new Error('Message bus not configured');
      }

      this.emit('sync_requested', syncRequest);
      return syncRequest.id;

    } catch (error) {
      logger.error(`Failed to request sync ${syncRequest.id}:`, error);
      this.metrics.failedSyncs++;
      this.emit('sync_failed', { request: syncRequest, error });
      throw error;
    }
  }

  /**
   * Handle incoming synchronization request
   */
  async handleSyncRequest(request: SyncRequest): Promise<SyncResponse> {
    const startTime = Date.now();
    
    try {
      logger.info(`Handling sync request ${request.id} from ${request.sourceNodeId}`);

      const response: SyncResponse = {
        requestId: request.id,
        success: false,
        nodeId: this.config.nodeId,
        strategy: request.strategy,
        appliedOperations: 0,
        appliedEvents: 0,
        conflicts: [],
        metadata: {},
      };

      // Apply synchronization based on strategy
      switch (request.strategy) {
        case 'eventual-consistency':
          await this.handleCRDTSync(request, response);
          break;
        case 'event-sourcing':
          await this.handleEventSourceSync(request, response);
          break;
        case 'hybrid':
          await this.handleHybridSync(request, response);
          break;
        default:
          throw new Error(`Unsupported sync strategy: ${request.strategy}`);
      }

      response.success = true;
      this.metrics.successfulSyncs++;
      
      // Update metrics
      const latency = Date.now() - startTime;
      this.updateLatencyMetrics(latency);

      logger.info(`Completed sync request ${request.id} in ${latency}ms`);
      this.emit('sync_completed', { request, response });

      return response;

    } catch (error) {
      logger.error(`Failed to handle sync request ${request.id}:`, error);
      this.metrics.failedSyncs++;
      
      const errorResponse: SyncResponse = {
        requestId: request.id,
        success: false,
        nodeId: this.config.nodeId,
        strategy: request.strategy,
        appliedOperations: 0,
        appliedEvents: 0,
        conflicts: [],
        metadata: {},
        error: error instanceof Error ? error.message : 'Unknown error',
      };

      this.emit('sync_failed', { request, error });
      return errorResponse;
    }
  }

  /**
   * Update CRDT state
   */
  async updateCRDTState(crdtId: string, operation: any): Promise<void> {
    try {
      const crdt = this.crdtManager.getCRDT(crdtId);
      if (!crdt) {
        throw new Error(`CRDT ${crdtId} not found`);
      }

      // Generate CRDT operation
      let crdtOperation: CRDTOperation;
      if (typeof crdt.set === 'function') {
        crdtOperation = crdt.set(operation.value);
      } else if (typeof crdt.increment === 'function') {
        crdtOperation = crdt.increment(operation.amount);
      } else {
        throw new Error(`Unsupported operation for CRDT ${crdtId}`);
      }

      // Broadcast operation to other nodes
      if (this.messageBus) {
        await this.broadcastCRDTOperation(crdtOperation);
      }

      this.emit('crdt_updated', { crdtId, operation: crdtOperation });

    } catch (error) {
      logger.error(`Failed to update CRDT state ${crdtId}:`, error);
      throw error;
    }
  }

  /**
   * Append domain event
   */
  async appendEvent(event: Omit<DomainEvent, 'id' | 'eventVersion' | 'timestamp'>): Promise<DomainEvent> {
    try {
      const domainEvent = await this.eventStore.appendEvent(event);

      // Broadcast event to other nodes
      if (this.messageBus) {
        await this.broadcastDomainEvent(domainEvent);
      }

      this.emit('event_appended', domainEvent);
      return domainEvent;

    } catch (error) {
      logger.error(`Failed to append event:`, error);
      throw error;
    }
  }

  /**
   * Get current synchronization status
   */
  getSyncStatus(): {
    isRunning: boolean;
    nodeStatuses: Map<AgentId, string>;
    pendingRequests: number;
    metrics: SyncMetrics;
    lastSync?: Date;
  } {
    return {
      isRunning: this.isRunning,
      nodeStatuses: new Map(this.nodeStatuses),
      pendingRequests: this.pendingRequests.size,
      metrics: { ...this.metrics, nodeStatuses: new Map(this.nodeStatuses) },
      lastSync: this.metrics.lastSyncTimestamp,
    };
  }

  /**
   * Force synchronization with all known nodes
   */
  async forceSyncAll(): Promise<void> {
    logger.info('Forcing synchronization with all nodes...');
    
    const nodes = Array.from(this.nodeStatuses.keys()).filter(nodeId => nodeId !== this.config.nodeId);
    
    for (const nodeId of nodes) {
      try {
        await this.requestSync({
          targetNodeId: nodeId,
          strategy: this.config.strategy,
          priority: 'high',
          dataTypes: ['*'],
          metadata: { forcedSync: true },
        });
      } catch (error) {
        logger.error(`Failed to force sync with node ${nodeId}:`, error);
      }
    }
  }

  /**
   * Setup event handlers for core components
   */
  private setupEventHandlers(): void {
    // CRDT Manager events
    this.crdtManager.on('sync_requested', (syncState) => {
      this.handleCRDTSyncRequest(syncState);
    });

    this.crdtManager.on('operation_applied', (operation) => {
      this.emit('operation_applied', operation);
    });

    // Event Store events
    this.eventStore.on('event_appended', (event) => {
      this.emit('event_appended', event);
    });

    this.eventStore.on('replication_requested', ({ targetNodeId }) => {
      this.handleEventStoreReplication(targetNodeId);
    });
  }

  /**
   * Setup message bus handlers
   */
  private setupMessageBusHandlers(): void {
    if (!this.messageBus) {
      return;
    }

    this.messageBus.on('satellite_message', (message) => {
      this.handleIncomingMessage(message);
    });
  }

  /**
   * Start periodic synchronization
   */
  private startPeriodicSync(): void {
    this.syncInterval = setInterval(async () => {
      try {
        await this.performPeriodicSync();
      } catch (error) {
        logger.error('Periodic sync failed:', error);
      }
    }, this.config.networking.syncInterval);
  }

  /**
   * Perform periodic synchronization
   */
  private async performPeriodicSync(): Promise<void> {
    const nodes = Array.from(this.nodeStatuses.keys())
      .filter(nodeId => nodeId !== this.config.nodeId && this.nodeStatuses.get(nodeId) === 'online');

    for (const nodeId of nodes) {
      try {
        await this.requestSync({
          targetNodeId: nodeId,
          strategy: this.config.strategy,
          priority: 'low',
          dataTypes: ['*'],
          metadata: { periodicSync: true },
        });
      } catch (error) {
        logger.debug(`Periodic sync failed with node ${nodeId}:`, error);
      }
    }

    this.metrics.lastSyncTimestamp = new Date();
  }

  /**
   * Handle CRDT synchronization
   */
  private async handleCRDTSync(request: SyncRequest, response: SyncResponse): Promise<void> {
    const syncState = this.crdtManager.getSyncState();
    
    // Apply operations from remote state (would come from request payload)
    // This is simplified - actual implementation would exchange and merge states
    response.appliedOperations = syncState.operations.length;
    response.metadata.crdtStates = syncState.crdtStates.length;
  }

  /**
   * Handle event sourcing synchronization
   */
  private async handleEventSourceSync(request: SyncRequest, response: SyncResponse): Promise<void> {
    // Get events since last sync (would come from request filters)
    const events = await this.eventStore.queryEvents(request.filters || {});
    
    response.appliedEvents = events.length;
    response.metadata.eventStreams = this.eventStore.getStats().totalStreams;
  }

  /**
   * Handle hybrid synchronization
   */
  private async handleHybridSync(request: SyncRequest, response: SyncResponse): Promise<void> {
    // Combine CRDT and event sourcing sync
    await this.handleCRDTSync(request, response);
    await this.handleEventSourceSync(request, response);
  }

  /**
   * Send sync request via message bus
   */
  private async sendSyncRequest(request: SyncRequest): Promise<void> {
    if (!this.messageBus) {
      throw new Error('Message bus not available');
    }

    const message = {
      id: `sync-req-${Date.now()}`,
      type: 'satellite_synchronization_request' as any,
      from: this.config.nodeId,
      to: request.targetNodeId,
      timestamp: new Date(),
      priority: request.priority,
      payload: request,
      metadata: {},
    };

    await this.messageBus.sendSatelliteMessage(message);
  }

  /**
   * Broadcast CRDT operation to other nodes
   */
  private async broadcastCRDTOperation(operation: CRDTOperation): Promise<void> {
    if (!this.messageBus) {
      return;
    }

    const message = {
      id: `crdt-op-${Date.now()}`,
      type: 'satellite_crdt_operation' as any,
      from: this.config.nodeId,
      to: 'broadcast' as any,
      timestamp: new Date(),
      priority: 'medium' as any,
      payload: operation,
      metadata: {},
    };

    await this.messageBus.sendSatelliteMessage(message);
  }

  /**
   * Broadcast domain event to other nodes
   */
  private async broadcastDomainEvent(event: DomainEvent): Promise<void> {
    if (!this.messageBus) {
      return;
    }

    const message = {
      id: `event-${Date.now()}`,
      type: 'satellite_domain_event' as any,
      from: this.config.nodeId,
      to: 'broadcast' as any,
      timestamp: new Date(),
      priority: 'medium' as any,
      payload: event,
      metadata: {},
    };

    await this.messageBus.sendSatelliteMessage(message);
  }

  /**
   * Handle incoming synchronization messages
   */
  private async handleIncomingMessage(message: any): Promise<void> {
    try {
      switch (message.type) {
        case 'satellite_synchronization_request':
          const response = await this.handleSyncRequest(message.payload);
          await this.sendSyncResponse(message.from, response);
          break;
        case 'satellite_crdt_operation':
          this.crdtManager.applyOperation(message.payload);
          break;
        case 'satellite_domain_event':
          await this.eventStore.appendEvent(message.payload);
          break;
      }
    } catch (error) {
      logger.error(`Failed to handle incoming message ${message.id}:`, error);
    }
  }

  /**
   * Send sync response
   */
  private async sendSyncResponse(targetNodeId: AgentId, response: SyncResponse): Promise<void> {
    if (!this.messageBus) {
      return;
    }

    const message = {
      id: `sync-resp-${Date.now()}`,
      type: 'satellite_synchronization_response' as any,
      from: this.config.nodeId,
      to: targetNodeId,
      timestamp: new Date(),
      priority: 'medium' as any,
      payload: response,
      metadata: {},
    };

    await this.messageBus.sendSatelliteMessage(message);
  }

  /**
   * Handle CRDT sync requests
   */
  private async handleCRDTSyncRequest(syncState: any): Promise<void> {
    // Emit sync request for external handling
    this.emit('crdt_sync_requested', syncState);
  }

  /**
   * Handle event store replication
   */
  private async handleEventStoreReplication(targetNodeId: AgentId): Promise<void> {
    try {
      await this.requestSync({
        targetNodeId,
        strategy: 'event-sourcing',
        priority: 'medium',
        dataTypes: ['events'],
        metadata: { replicationSync: true },
      });
    } catch (error) {
      logger.error(`Failed to handle event store replication to ${targetNodeId}:`, error);
    }
  }

  /**
   * Update latency metrics
   */
  private updateLatencyMetrics(latency: number): void {
    const currentAvg = this.metrics.averageSyncLatency;
    const totalSyncs = this.metrics.successfulSyncs;
    
    this.metrics.averageSyncLatency = ((currentAvg * (totalSyncs - 1)) + latency) / totalSyncs;
  }

  /**
   * Get synchronization manager statistics
   */
  getStats() {
    return {
      config: this.config,
      metrics: this.metrics,
      isRunning: this.isRunning,
      crdtStats: this.crdtManager.getStats(),
      eventStoreStats: this.eventStore.getStats(),
      pendingRequests: this.pendingRequests.size,
    };
  }
}