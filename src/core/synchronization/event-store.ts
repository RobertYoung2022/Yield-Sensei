/**
 * YieldSensei Event Store
 * Task 45.2: Distributed Data Synchronization Protocols
 * 
 * Event sourcing implementation for satellite state management and synchronization
 */

import { EventEmitter } from 'events';
import Logger from '@/shared/logging/logger';
import { AgentId } from '@/types';

const logger = Logger.getLogger('event-store');

/**
 * Domain Event Types
 */
export type DomainEventType = 
  | 'satellite_state_changed'
  | 'satellite_data_updated'
  | 'satellite_configuration_changed'
  | 'satellite_task_assigned'
  | 'satellite_task_completed'
  | 'satellite_error_occurred'
  | 'satellite_connection_established'
  | 'satellite_connection_lost'
  | 'satellite_consensus_started'
  | 'satellite_consensus_reached'
  | 'satellite_snapshot_created'
  | 'satellite_recovery_started'
  | 'satellite_recovery_completed';

/**
 * Domain Event
 */
export interface DomainEvent {
  id: string;
  type: DomainEventType;
  aggregateId: string;
  aggregateType: string;
  aggregateVersion: number;
  eventVersion: number;
  timestamp: Date;
  nodeId: AgentId;
  causationId?: string;    // ID of event that caused this event
  correlationId?: string;  // ID linking related events
  payload: Record<string, any>;
  metadata: {
    userId?: string;
    sessionId?: string;
    requestId?: string;
    source: string;
    [key: string]: any;
  };
}

/**
 * Event Stream
 */
export interface EventStream {
  aggregateId: string;
  aggregateType: string;
  version: number;
  events: DomainEvent[];
  lastModified: Date;
  snapshot?: Snapshot;
}

/**
 * Aggregate Snapshot
 */
export interface Snapshot {
  id: string;
  aggregateId: string;
  aggregateType: string;
  version: number;
  timestamp: Date;
  state: Record<string, any>;
  metadata: Record<string, any>;
}

/**
 * Event Store Configuration
 */
export interface EventStoreConfig {
  nodeId: AgentId;
  batchSize: number;
  snapshotFrequency: number;
  maxEventAge: number;
  compressionEnabled: boolean;
  encryptionEnabled: boolean;
  persistence: {
    enabled: boolean;
    backend: 'memory' | 'file' | 'database';
    path?: string;
    connectionString?: string;
  };
  replication: {
    enabled: boolean;
    replicas: AgentId[];
    syncInterval: number;
    conflictResolution: 'timestamp' | 'node-priority' | 'causal-ordering';
  };
}

export const DEFAULT_EVENT_STORE_CONFIG: EventStoreConfig = {
  nodeId: 'unknown',
  batchSize: 100,
  snapshotFrequency: 1000, // Create snapshot every 1000 events
  maxEventAge: 30 * 24 * 60 * 60 * 1000, // 30 days
  compressionEnabled: true,
  encryptionEnabled: false,
  persistence: {
    enabled: true,
    backend: 'memory',
  },
  replication: {
    enabled: true,
    replicas: [],
    syncInterval: 60000, // 1 minute
    conflictResolution: 'causal-ordering',
  },
};

/**
 * Event Store Query Options
 */
export interface EventQueryOptions {
  aggregateId?: string;
  aggregateType?: string;
  eventTypes?: DomainEventType[];
  fromVersion?: number;
  toVersion?: number;
  fromTimestamp?: Date;
  toTimestamp?: Date;
  limit?: number;
  offset?: number;
  orderBy?: 'timestamp' | 'version';
  orderDirection?: 'asc' | 'desc';
}

/**
 * Event Store Statistics
 */
export interface EventStoreStats {
  totalEvents: number;
  totalStreams: number;
  totalSnapshots: number;
  eventsByType: Record<DomainEventType, number>;
  averageEventsPerStream: number;
  oldestEvent?: Date;
  newestEvent?: Date;
  storageSize: number;
  replicationLag?: number;
}

/**
 * Event Store Implementation
 * Manages domain events for satellite state synchronization
 */
export class EventStore extends EventEmitter {
  private config: EventStoreConfig;
  private streams: Map<string, EventStream> = new Map();
  private snapshots: Map<string, Snapshot> = new Map();
  private eventSequence: number = 0;
  private replicationInterval?: NodeJS.Timeout;

  constructor(config: EventStoreConfig = DEFAULT_EVENT_STORE_CONFIG) {
    super();
    this.config = config;
  }

  /**
   * Start the event store
   */
  async start(): Promise<void> {
    logger.info('Starting event store...');

    // Load existing events if persistence is enabled
    if (this.config.persistence.enabled) {
      await this.loadFromPersistence();
    }

    // Start replication if enabled
    if (this.config.replication.enabled && this.config.replication.replicas.length > 0) {
      this.startReplication();
    }

    logger.info('Event store started successfully');
    this.emit('started');
  }

  /**
   * Stop the event store
   */
  async stop(): Promise<void> {
    logger.info('Stopping event store...');

    // Stop replication
    if (this.replicationInterval) {
      clearInterval(this.replicationInterval);
      delete this.replicationInterval;
    }

    // Persist final state if enabled
    if (this.config.persistence.enabled) {
      await this.persistToDisk();
    }

    logger.info('Event store stopped');
    this.emit('stopped');
  }

  /**
   * Append event to stream
   */
  async appendEvent(event: Omit<DomainEvent, 'id' | 'eventVersion' | 'timestamp'>): Promise<DomainEvent> {
    try {
      // Generate event ID and metadata
      const fullEvent: DomainEvent = {
        ...event,
        id: `${this.config.nodeId}-${++this.eventSequence}-${Date.now()}`,
        eventVersion: 1,
        timestamp: new Date(),
      };

      // Validate event
      this.validateEvent(fullEvent);

      // Get or create stream
      let stream = this.streams.get(fullEvent.aggregateId);
      if (!stream) {
        stream = {
          aggregateId: fullEvent.aggregateId,
          aggregateType: fullEvent.aggregateType,
          version: 0,
          events: [],
          lastModified: new Date(),
        };
        this.streams.set(fullEvent.aggregateId, stream);
      }

      // Check version consistency
      if (fullEvent.aggregateVersion !== stream.version + 1) {
        throw new Error(
          `Version mismatch: expected ${stream.version + 1}, got ${fullEvent.aggregateVersion}`
        );
      }

      // Append event to stream
      stream.events.push(fullEvent);
      stream.version = fullEvent.aggregateVersion;
      stream.lastModified = new Date();

      // Create snapshot if needed
      if (stream.events.length % this.config.snapshotFrequency === 0) {
        await this.createSnapshot(stream);
      }

      // Emit event
      this.emit('event_appended', fullEvent);
      
      logger.debug(`Appended event ${fullEvent.id} to stream ${fullEvent.aggregateId}`);
      return fullEvent;

    } catch (error) {
      logger.error(`Failed to append event to stream ${event.aggregateId}:`, error);
      this.emit('append_error', { event, error });
      throw error;
    }
  }

  /**
   * Append multiple events atomically
   */
  async appendEvents(events: Omit<DomainEvent, 'id' | 'eventVersion' | 'timestamp'>[]): Promise<DomainEvent[]> {
    try {
      const appendedEvents: DomainEvent[] = [];
      
      // Validate all events first
      for (const event of events) {
        const fullEvent: DomainEvent = {
          ...event,
          id: `${this.config.nodeId}-${++this.eventSequence}-${Date.now()}`,
          eventVersion: 1,
          timestamp: new Date(),
        };
        this.validateEvent(fullEvent);
        appendedEvents.push(fullEvent);
      }

      // Append all events
      for (const event of appendedEvents) {
        await this.appendEvent(event);
      }

      logger.debug(`Appended ${appendedEvents.length} events atomically`);
      return appendedEvents;

    } catch (error) {
      logger.error('Failed to append events atomically:', error);
      throw error;
    }
  }

  /**
   * Get events from stream
   */
  async getEvents(aggregateId: string, fromVersion?: number): Promise<DomainEvent[]> {
    const stream = this.streams.get(aggregateId);
    if (!stream) {
      return [];
    }

    let events = stream.events;
    
    if (fromVersion !== undefined) {
      events = events.filter(event => event.aggregateVersion >= fromVersion);
    }

    return [...events]; // Return copy to prevent mutation
  }

  /**
   * Query events with filters
   */
  async queryEvents(options: EventQueryOptions = {}): Promise<DomainEvent[]> {
    let events: DomainEvent[] = [];

    // Collect events from relevant streams
    if (options.aggregateId) {
      const stream = this.streams.get(options.aggregateId);
      if (stream) {
        events = [...stream.events];
      }
    } else {
      // Collect from all streams
      for (const stream of this.streams.values()) {
        if (!options.aggregateType || stream.aggregateType === options.aggregateType) {
          events.push(...stream.events);
        }
      }
    }

    // Apply filters
    events = this.applyFilters(events, options);

    // Apply sorting
    events = this.applySorting(events, options);

    // Apply pagination
    if (options.offset) {
      events = events.slice(options.offset);
    }
    if (options.limit) {
      events = events.slice(0, options.limit);
    }

    return events;
  }

  /**
   * Create snapshot of aggregate state
   */
  async createSnapshot(stream: EventStream): Promise<Snapshot> {
    try {
      // Calculate aggregate state from events
      const state = this.calculateAggregateState(stream.events);

      const snapshot: Snapshot = {
        id: `${stream.aggregateId}-snapshot-${Date.now()}`,
        aggregateId: stream.aggregateId,
        aggregateType: stream.aggregateType,
        version: stream.version,
        timestamp: new Date(),
        state,
        metadata: {
          eventCount: stream.events.length,
          nodeId: this.config.nodeId,
        },
      };

      this.snapshots.set(stream.aggregateId, snapshot);
      stream.snapshot = snapshot;

      logger.debug(`Created snapshot for aggregate ${stream.aggregateId} at version ${stream.version}`);
      this.emit('snapshot_created', snapshot);

      return snapshot;

    } catch (error) {
      logger.error(`Failed to create snapshot for aggregate ${stream.aggregateId}:`, error);
      throw error;
    }
  }

  /**
   * Get snapshot for aggregate
   */
  async getSnapshot(aggregateId: string): Promise<Snapshot | null> {
    return this.snapshots.get(aggregateId) || null;
  }

  /**
   * Replay events to rebuild aggregate state
   */
  async replayEvents(
    aggregateId: string, 
    fromSnapshot?: Snapshot
  ): Promise<{ state: any; version: number }> {
    try {
      let state: any = {};
      let version = 0;

      // Start from snapshot if available
      if (fromSnapshot) {
        state = { ...fromSnapshot.state };
        version = fromSnapshot.version;
      }

      // Get events to replay
      const events = await this.getEvents(aggregateId, version + 1);

      // Apply events to rebuild state
      for (const event of events) {
        state = this.applyEventToState(state, event);
        version = event.aggregateVersion;
      }

      logger.debug(`Replayed ${events.length} events for aggregate ${aggregateId}`);
      return { state, version };

    } catch (error) {
      logger.error(`Failed to replay events for aggregate ${aggregateId}:`, error);
      throw error;
    }
  }

  /**
   * Synchronize with remote event store
   */
  async synchronizeWith(remoteStore: {
    nodeId: AgentId;
    getEventsSince: (timestamp: Date) => Promise<DomainEvent[]>;
    getSnapshots: () => Promise<Snapshot[]>;
  }): Promise<void> {
    try {
      logger.info(`Starting synchronization with remote store ${remoteStore.nodeId}`);

      // Get our latest timestamp
      const latestTimestamp = this.getLatestEventTimestamp();

      // Get events from remote store since our latest
      const remoteEvents = await remoteStore.getEventsSince(latestTimestamp);

      // Apply remote events
      for (const event of remoteEvents) {
        await this.mergeRemoteEvent(event);
      }

      // Get remote snapshots and merge if newer
      const remoteSnapshots = await remoteStore.getSnapshots();
      for (const snapshot of remoteSnapshots) {
        await this.mergeRemoteSnapshot(snapshot);
      }

      logger.info(`Synchronized ${remoteEvents.length} events with remote store ${remoteStore.nodeId}`);
      this.emit('synchronized', { remoteNodeId: remoteStore.nodeId, eventCount: remoteEvents.length });

    } catch (error) {
      logger.error(`Failed to synchronize with remote store ${remoteStore.nodeId}:`, error);
      this.emit('synchronization_error', { remoteNodeId: remoteStore.nodeId, error });
      throw error;
    }
  }

  /**
   * Get event store statistics
   */
  getStats(): EventStoreStats {
    const eventsByType: Record<DomainEventType, number> = {} as any;
    let totalEvents = 0;
    let oldestEvent: Date | undefined;
    let newestEvent: Date | undefined;

    for (const stream of this.streams.values()) {
      totalEvents += stream.events.length;
      
      for (const event of stream.events) {
        eventsByType[event.type] = (eventsByType[event.type] || 0) + 1;
        
        if (!oldestEvent || event.timestamp < oldestEvent) {
          oldestEvent = event.timestamp;
        }
        if (!newestEvent || event.timestamp > newestEvent) {
          newestEvent = event.timestamp;
        }
      }
    }

    return {
      totalEvents,
      totalStreams: this.streams.size,
      totalSnapshots: this.snapshots.size,
      eventsByType,
      averageEventsPerStream: this.streams.size > 0 ? totalEvents / this.streams.size : 0,
      oldestEvent,
      newestEvent,
      storageSize: this.calculateStorageSize(),
    };
  }

  /**
   * Clean up old events based on age
   */
  async cleanup(): Promise<void> {
    const cutoffDate = new Date(Date.now() - this.config.maxEventAge);
    let removedEvents = 0;

    for (const stream of this.streams.values()) {
      const originalLength = stream.events.length;
      stream.events = stream.events.filter(event => event.timestamp > cutoffDate);
      removedEvents += originalLength - stream.events.length;
    }

    if (removedEvents > 0) {
      logger.info(`Cleaned up ${removedEvents} old events`);
      this.emit('cleanup_completed', { removedEvents });
    }
  }

  /**
   * Validate event structure and content
   */
  private validateEvent(event: DomainEvent): void {
    if (!event.id || !event.type || !event.aggregateId || !event.aggregateType) {
      throw new Error('Event missing required fields');
    }

    if (event.aggregateVersion < 1) {
      throw new Error('Aggregate version must be positive');
    }

    if (!event.payload || typeof event.payload !== 'object') {
      throw new Error('Event payload must be an object');
    }
  }

  /**
   * Apply filters to event collection
   */
  private applyFilters(events: DomainEvent[], options: EventQueryOptions): DomainEvent[] {
    let filtered = events;

    if (options.eventTypes && options.eventTypes.length > 0) {
      filtered = filtered.filter(event => options.eventTypes!.includes(event.type));
    }

    if (options.fromVersion !== undefined) {
      filtered = filtered.filter(event => event.aggregateVersion >= options.fromVersion!);
    }

    if (options.toVersion !== undefined) {
      filtered = filtered.filter(event => event.aggregateVersion <= options.toVersion!);
    }

    if (options.fromTimestamp) {
      filtered = filtered.filter(event => event.timestamp >= options.fromTimestamp!);
    }

    if (options.toTimestamp) {
      filtered = filtered.filter(event => event.timestamp <= options.toTimestamp!);
    }

    return filtered;
  }

  /**
   * Apply sorting to event collection
   */
  private applySorting(events: DomainEvent[], options: EventQueryOptions): DomainEvent[] {
    const orderBy = options.orderBy || 'timestamp';
    const direction = options.orderDirection || 'asc';

    return events.sort((a, b) => {
      let valueA: any, valueB: any;

      if (orderBy === 'timestamp') {
        valueA = a.timestamp.getTime();
        valueB = b.timestamp.getTime();
      } else if (orderBy === 'version') {
        valueA = a.aggregateVersion;
        valueB = b.aggregateVersion;
      } else {
        return 0;
      }

      if (direction === 'asc') {
        return valueA - valueB;
      } else {
        return valueB - valueA;
      }
    });
  }

  /**
   * Calculate aggregate state from events (simplified)
   */
  private calculateAggregateState(events: DomainEvent[]): any {
    // This is a simplified state calculation
    // In practice, would use proper event handlers for each aggregate type
    const state: any = {
      id: events[0]?.aggregateId,
      type: events[0]?.aggregateType,
      version: events[events.length - 1]?.aggregateVersion || 0,
      properties: {},
    };

    for (const event of events) {
      // Apply event to state based on event type
      switch (event.type) {
        case 'satellite_state_changed':
          Object.assign(state.properties, event.payload);
          break;
        case 'satellite_configuration_changed':
          state.properties.configuration = { ...state.properties.configuration, ...event.payload };
          break;
        default:
          // Generic property merge
          if (event.payload.properties) {
            Object.assign(state.properties, event.payload.properties);
          }
      }
    }

    return state;
  }

  /**
   * Apply single event to state
   */
  private applyEventToState(state: any, event: DomainEvent): any {
    const newState = { ...state };

    // Apply event based on type
    switch (event.type) {
      case 'satellite_state_changed':
        newState.properties = { ...newState.properties, ...event.payload };
        break;
      case 'satellite_configuration_changed':
        newState.configuration = { ...newState.configuration, ...event.payload };
        break;
      default:
        // Generic merge
        if (event.payload.properties) {
          newState.properties = { ...newState.properties, ...event.payload.properties };
        }
    }

    return newState;
  }

  /**
   * Get latest event timestamp across all streams
   */
  private getLatestEventTimestamp(): Date {
    let latest = new Date(0);
    
    for (const stream of this.streams.values()) {
      for (const event of stream.events) {
        if (event.timestamp > latest) {
          latest = event.timestamp;
        }
      }
    }

    return latest;
  }

  /**
   * Merge remote event with conflict resolution
   */
  private async mergeRemoteEvent(remoteEvent: DomainEvent): Promise<void> {
    // Check if we already have this event
    const existingStream = this.streams.get(remoteEvent.aggregateId);
    if (existingStream && existingStream.events.some(e => e.id === remoteEvent.id)) {
      return; // Already have this event
    }

    // Apply conflict resolution strategy
    const shouldApply = await this.resolveConflict(remoteEvent);
    if (shouldApply) {
      await this.appendEvent(remoteEvent);
    }
  }

  /**
   * Merge remote snapshot
   */
  private async mergeRemoteSnapshot(remoteSnapshot: Snapshot): Promise<void> {
    const existingSnapshot = this.snapshots.get(remoteSnapshot.aggregateId);
    
    if (!existingSnapshot || remoteSnapshot.version > existingSnapshot.version) {
      this.snapshots.set(remoteSnapshot.aggregateId, remoteSnapshot);
      logger.debug(`Merged remote snapshot for aggregate ${remoteSnapshot.aggregateId}`);
    }
  }

  /**
   * Resolve conflicts for remote events
   */
  private async resolveConflict(remoteEvent: DomainEvent): Promise<boolean> {
    switch (this.config.replication.conflictResolution) {
      case 'timestamp':
        // Always accept (timestamp-based ordering handled elsewhere)
        return true;
      case 'node-priority':
        // Could implement node priority logic
        return true;
      case 'causal-ordering':
        // Could implement vector clock comparison
        return true;
      default:
        return true;
    }
  }

  /**
   * Load events from persistence
   */
  private async loadFromPersistence(): Promise<void> {
    // Placeholder for persistence loading
    // Would implement based on configured backend
    logger.debug('Loading events from persistence...');
  }

  /**
   * Persist events to disk
   */
  private async persistToDisk(): Promise<void> {
    // Placeholder for persistence saving
    // Would implement based on configured backend
    logger.debug('Persisting events to disk...');
  }

  /**
   * Start replication with remote nodes
   */
  private startReplication(): void {
    this.replicationInterval = setInterval(async () => {
      for (const replicaId of this.config.replication.replicas) {
        try {
          // Emit replication request for external handling
          this.emit('replication_requested', { targetNodeId: replicaId });
        } catch (error) {
          logger.error(`Replication failed with node ${replicaId}:`, error);
        }
      }
    }, this.config.replication.syncInterval);
  }

  /**
   * Calculate approximate storage size
   */
  private calculateStorageSize(): number {
    // Simplified calculation
    let size = 0;
    
    for (const stream of this.streams.values()) {
      size += JSON.stringify(stream).length;
    }
    
    for (const snapshot of this.snapshots.values()) {
      size += JSON.stringify(snapshot).length;
    }

    return size;
  }
}