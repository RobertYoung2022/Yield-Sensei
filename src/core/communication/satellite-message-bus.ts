/**
 * YieldSensei Satellite Message Bus
 * Task 45.1: Inter-Satellite Message Bus Architecture
 * 
 * Enhanced message bus for inter-satellite communication with intelligent routing
 */

import { EventEmitter } from 'events';
import Logger from '@/shared/logging/logger';
import { AgentId, Message, MessageType } from '@/types';
import { MessageBus, MessageBusConfig, DEFAULT_MESSAGE_BUS_CONFIG } from '../messaging/bus';
import { SatelliteNetworkManager, SatelliteNetworkConfig, DEFAULT_SATELLITE_NETWORK_CONFIG } from './satellite-network-manager';
import { SatelliteRoutingEngine, RoutingEngineConfig, DEFAULT_ROUTING_ENGINE_CONFIG, RoutingContext, QoSRequirements } from './satellite-routing-engine';

const logger = Logger.getLogger('satellite-message-bus');

/**
 * Satellite-specific message types
 */
export type SatelliteMessageType = MessageType | 
  | 'satellite_discovery'
  | 'satellite_handshake' 
  | 'satellite_topology_update'
  | 'satellite_route_request'
  | 'satellite_route_response'
  | 'satellite_health_check'
  | 'satellite_coordination'
  | 'satellite_consensus';

/**
 * Enhanced message interface for satellite communication
 */
export interface SatelliteMessage extends Message {
  type: SatelliteMessageType;
  routing?: {
    strategy?: 'direct' | 'multi-hop' | 'broadcast' | 'adaptive';
    qos?: QoSRequirements;
    constraints?: {
      maxHops?: number;
      avoidNodes?: AgentId[];
      preferredNodes?: AgentId[];
    };
  };
  satellite?: {
    nodeType?: string;
    capabilities?: string[];
    region?: string;
    coordinates?: { lat: number; lon: number; alt: number };
  };
}

/**
 * Satellite Message Bus Configuration
 */
export interface SatelliteMessageBusConfig {
  messageBus: MessageBusConfig;
  network: SatelliteNetworkConfig;
  routing: RoutingEngineConfig;
  satellite: {
    nodeId: AgentId;
    nodeType: 'primary' | 'secondary' | 'relay' | 'edge' | 'gateway';
    region?: string;
    capabilities: string[];
    autoDiscovery: boolean;
    meshNetworking: boolean;
  };
  protocols: {
    handshakeTimeout: number;
    discoveryInterval: number;
    topologyUpdateInterval: number;
    consensusTimeout: number;
  };
}

export const DEFAULT_SATELLITE_MESSAGE_BUS_CONFIG: SatelliteMessageBusConfig = {
  messageBus: DEFAULT_MESSAGE_BUS_CONFIG,
  network: DEFAULT_SATELLITE_NETWORK_CONFIG,
  routing: DEFAULT_ROUTING_ENGINE_CONFIG,
  satellite: {
    nodeId: 'satellite-unknown',
    nodeType: 'secondary',
    capabilities: ['messaging', 'routing'],
    autoDiscovery: true,
    meshNetworking: true,
  },
  protocols: {
    handshakeTimeout: 30000, // 30 seconds
    discoveryInterval: 60000, // 1 minute
    topologyUpdateInterval: 300000, // 5 minutes
    consensusTimeout: 10000, // 10 seconds
  },
};

/**
 * Satellite Network Statistics
 */
export interface SatelliteNetworkStats {
  networkStats: any;
  routingStats: any;
  messageBusStats: any;
  satelliteStats: {
    connectedSatellites: number;
    discoveredSatellites: number;
    activeRoutes: number;
    messagesThroughput: number;
    averageHopCount: number;
    networkLatency: number;
  };
}

/**
 * Enhanced Message Bus for Satellite Communication
 * Integrates network discovery, intelligent routing, and traditional messaging
 */
export class SatelliteMessageBus extends EventEmitter {
  private config: SatelliteMessageBusConfig;
  
  // Core components
  private messageBus: MessageBus;
  private networkManager: SatelliteNetworkManager;
  private routingEngine: SatelliteRoutingEngine;
  
  // Protocol handlers
  private discoveryInterval?: NodeJS.Timeout;
  private topologyUpdateInterval?: NodeJS.Timeout;
  
  // State management
  private isInitialized: boolean = false;
  private isRunning: boolean = false;
  private connectedSatellites: Set<AgentId> = new Set();
  private pendingHandshakes: Map<AgentId, NodeJS.Timeout> = new Map();
  
  // Message tracking
  private messageSequence: number = 0;
  private messageHistory: Map<string, SatelliteMessage> = new Map();

  constructor(config: SatelliteMessageBusConfig = DEFAULT_SATELLITE_MESSAGE_BUS_CONFIG) {
    super();
    this.config = config;

    // Initialize core components
    this.messageBus = new MessageBus(config.messageBus);
    this.networkManager = new SatelliteNetworkManager(config.network);
    this.routingEngine = new SatelliteRoutingEngine(this.networkManager, config.routing);

    this.setupEventHandlers();
  }

  /**
   * Initialize the satellite message bus
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.warn('Satellite message bus already initialized');
      return;
    }

    try {
      logger.info('Initializing satellite message bus...');

      // Initialize components in sequence
      await this.messageBus.initialize();
      await this.networkManager.start();
      await this.routingEngine.start();

      // Setup satellite-specific protocols
      await this.setupSatelliteProtocols();

      this.isInitialized = true;
      logger.info('Satellite message bus initialized successfully');
      this.emit('initialized');

    } catch (error) {
      logger.error('Failed to initialize satellite message bus:', error);
      throw error;
    }
  }

  /**
   * Start the satellite message bus
   */
  async start(): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('Satellite message bus not initialized');
    }

    if (this.isRunning) {
      logger.warn('Satellite message bus already running');
      return;
    }

    try {
      logger.info('Starting satellite message bus...');

      // Start discovery if enabled
      if (this.config.satellite.autoDiscovery) {
        this.startDiscovery();
      }

      // Start topology updates
      this.startTopologyUpdates();

      this.isRunning = true;
      logger.info('Satellite message bus started successfully');
      this.emit('started');

    } catch (error) {
      logger.error('Failed to start satellite message bus:', error);
      throw error;
    }
  }

  /**
   * Stop the satellite message bus
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    logger.info('Stopping satellite message bus...');

    // Clear intervals
    if (this.discoveryInterval) {
      clearInterval(this.discoveryInterval);
      delete this.discoveryInterval;
    }

    if (this.topologyUpdateInterval) {
      clearInterval(this.topologyUpdateInterval);
      delete this.topologyUpdateInterval;
    }

    // Clear pending handshakes
    for (const timeout of this.pendingHandshakes.values()) {
      clearTimeout(timeout);
    }
    this.pendingHandshakes.clear();

    // Stop components
    await this.routingEngine.stop();
    await this.networkManager.stop();
    await this.messageBus.shutdown();

    this.isRunning = false;
    logger.info('Satellite message bus stopped');
    this.emit('stopped');
  }

  /**
   * Send a satellite message with intelligent routing
   */
  async sendSatelliteMessage(
    message: SatelliteMessage,
    options: {
      priority?: 'low' | 'medium' | 'high' | 'critical';
      qos?: QoSRequirements;
      routing?: {
        strategy?: 'direct' | 'multi-hop' | 'broadcast' | 'adaptive';
        constraints?: {
          maxHops?: number;
          avoidNodes?: AgentId[];
          preferredNodes?: AgentId[];
        };
      };
    } = {}
  ): Promise<void> {
    if (!this.isRunning) {
      throw new Error('Satellite message bus not running');
    }

    try {
      // Assign sequence number
      message.metadata = {
        ...message.metadata,
        sequence: ++this.messageSequence,
        satelliteNodeId: this.config.satellite.nodeId,
      };

      // Store in history
      this.messageHistory.set(message.id, message);

      // Create routing context
      const context: RoutingContext = {
        message,
        source: message.from,
        destination: message.to,
        qos: options.qos || {
          priority: options.priority || 'medium',
        },
        constraints: options.routing?.constraints || {},
        networkConditions: {
          congestionLevel: 0.1, // TODO: Get from network manager
          availableBandwidth: 1000,
          averageLatency: 50,
        },
      };

      // Get routing decision
      const routingDecision = await this.routingEngine.routeMessage(context);

      // Apply routing metadata to message
      message.routing = {
        strategy: routingDecision.strategy,
        qos: context.qos,
        constraints: context.constraints,
      };

      // Send via appropriate method based on routing decision
      if (routingDecision.strategy === 'broadcast') {
        await this.broadcastMessage(message);
      } else if (routingDecision.route.length === 1) {
        // Direct message
        await this.messageBus.sendMessage(message);
      } else {
        // Multi-hop message
        await this.sendMultiHopMessage(message, routingDecision.route);
      }

      logger.debug(
        `Sent satellite message ${message.id} using ${routingDecision.strategy} routing ` +
        `(${routingDecision.route.length} hops)`
      );

      this.emit('message_sent', { message, routingDecision });

    } catch (error) {
      logger.error(`Failed to send satellite message ${message.id}:`, error);
      this.emit('message_failed', { message, error });
      throw error;
    }
  }

  /**
   * Subscribe to satellite messages
   */
  async subscribeSatellite(agentId: AgentId, messageTypes: SatelliteMessageType[] = []): Promise<void> {
    try {
      // Subscribe to message bus
      await this.messageBus.subscribeAgent(agentId);

      // Add to connected satellites
      this.connectedSatellites.add(agentId);

      // Initiate handshake if not already connected
      if (!this.networkManager.getNodes().has(agentId)) {
        await this.initiateHandshake(agentId);
      }

      logger.info(`Satellite ${agentId} subscribed to message bus`);
      this.emit('satellite_subscribed', { agentId, messageTypes });

    } catch (error) {
      logger.error(`Failed to subscribe satellite ${agentId}:`, error);
      throw error;
    }
  }

  /**
   * Unsubscribe satellite from messages
   */
  async unsubscribeSatellite(agentId: AgentId): Promise<void> {
    try {
      // Unsubscribe from message bus
      await this.messageBus.unsubscribeAgent(agentId);

      // Remove from connected satellites
      this.connectedSatellites.delete(agentId);

      // Cancel any pending handshake
      const pendingTimeout = this.pendingHandshakes.get(agentId);
      if (pendingTimeout) {
        clearTimeout(pendingTimeout);
        this.pendingHandshakes.delete(agentId);
      }

      // Remove from network topology
      this.networkManager.removeNode(agentId);

      logger.info(`Satellite ${agentId} unsubscribed from message bus`);
      this.emit('satellite_unsubscribed', { agentId });

    } catch (error) {
      logger.error(`Failed to unsubscribe satellite ${agentId}:`, error);
      throw error;
    }
  }

  /**
   * Get network topology
   */
  getNetworkTopology() {
    return this.networkManager.getTopology();
  }

  /**
   * Get satellite network statistics
   */
  getStats(): SatelliteNetworkStats {
    const networkStats = this.networkManager.getStats();
    const routingStats = this.routingEngine.getStats();
    const messageBusStats = this.messageBus.getStats();

    return {
      networkStats,
      routingStats,
      messageBusStats,
      satelliteStats: {
        connectedSatellites: this.connectedSatellites.size,
        discoveredSatellites: networkStats.nodeCount,
        activeRoutes: routingStats.routeMetrics,
        messagesThroughput: messageBusStats.messagesSent + messageBusStats.messagesReceived,
        averageHopCount: 2.1, // TODO: Calculate from routing decisions
        networkLatency: routingStats.networkConditions.averageLatency,
      },
    };
  }

  /**
   * Health check for satellite message bus
   */
  async healthCheck(): Promise<{ healthy: boolean; details: any }> {
    try {
      const messageBusHealth = await this.messageBus.healthCheck();
      const networkStats = this.networkManager.getStats();
      const routingStats = this.routingEngine.getStats();

      const healthy = messageBusHealth.healthy && 
                     networkStats.isRunning && 
                     this.isRunning;

      return {
        healthy,
        details: {
          messageBus: messageBusHealth.healthy,
          networkManager: networkStats.isRunning,
          routingEngine: routingStats.cacheSize >= 0, // Simple check
          connectedSatellites: this.connectedSatellites.size,
          stats: this.getStats(),
        },
      };
    } catch (error) {
      return {
        healthy: false,
        details: { error: error instanceof Error ? error.message : 'Unknown error' },
      };
    }
  }

  /**
   * Setup satellite-specific protocols
   */
  private async setupSatelliteProtocols(): Promise<void> {
    // Add satellite-specific message handlers
    this.messageBus.on('message_received', (message: Message) => {
      if (this.isSatelliteMessage(message)) {
        this.handleSatelliteMessage(message as SatelliteMessage);
      }
    });

    // Setup network discovery handlers
    this.networkManager.on('discovery_broadcast', (data) => {
      this.handleDiscoveryBroadcast(data);
    });

    this.networkManager.on('discovery_gossip', (data) => {
      this.handleDiscoveryGossip(data);
    });

    logger.debug('Satellite protocols setup completed');
  }

  /**
   * Setup event handlers for component integration
   */
  private setupEventHandlers(): void {
    // Network manager events
    this.networkManager.on('node_added', (node) => {
      this.emit('satellite_discovered', node);
    });

    this.networkManager.on('node_removed', (event) => {
      this.emit('satellite_disconnected', event);
    });

    // Routing engine events
    this.routingEngine.on('message_routed', (event) => {
      this.emit('message_routed', event);
    });

    this.routingEngine.on('routing_error', (event) => {
      this.emit('routing_error', event);
    });

    // Message bus events
    this.messageBus.on('message_sent', (event) => {
      this.emit('message_transmitted', event);
    });

    this.messageBus.on('message_failed', (event) => {
      this.emit('message_transmission_failed', event);
    });
  }

  /**
   * Start discovery protocol
   */
  private startDiscovery(): void {
    this.discoveryInterval = setInterval(async () => {
      try {
        await this.performDiscovery();
      } catch (error) {
        logger.error('Discovery error:', error);
      }
    }, this.config.protocols.discoveryInterval);

    // Perform initial discovery
    this.performDiscovery();
  }

  /**
   * Start topology update broadcasts
   */
  private startTopologyUpdates(): void {
    this.topologyUpdateInterval = setInterval(async () => {
      try {
        await this.broadcastTopologyUpdate();
      } catch (error) {
        logger.error('Topology update error:', error);
      }
    }, this.config.protocols.topologyUpdateInterval);
  }

  /**
   * Perform network discovery
   */
  private async performDiscovery(): Promise<void> {
    const discoveryMessage: SatelliteMessage = {
      id: `discovery-${Date.now()}`,
      type: 'satellite_discovery',
      from: this.config.satellite.nodeId,
      to: 'broadcast',
      timestamp: new Date(),
      priority: 'low',
      payload: {
        nodeId: this.config.satellite.nodeId,
        nodeType: this.config.satellite.nodeType,
        capabilities: this.config.satellite.capabilities,
        region: this.config.satellite.region,
      },
      metadata: {},
    };

    await this.broadcastMessage(discoveryMessage);
    logger.debug('Discovery broadcast sent');
  }

  /**
   * Broadcast topology update
   */
  private async broadcastTopologyUpdate(): Promise<void> {
    const topology = this.networkManager.getTopology();
    
    const updateMessage: SatelliteMessage = {
      id: `topology-${Date.now()}`,
      type: 'satellite_topology_update',
      from: this.config.satellite.nodeId,
      to: 'broadcast',
      timestamp: new Date(),
      priority: 'low',
      payload: {
        version: topology.version,
        nodeCount: topology.nodes.size,
        linkCount: topology.links.size,
        lastUpdated: topology.lastUpdated,
      },
      metadata: {},
    };

    await this.broadcastMessage(updateMessage);
    logger.debug('Topology update broadcast sent');
  }

  /**
   * Handle satellite-specific messages
   */
  private async handleSatelliteMessage(message: SatelliteMessage): Promise<void> {
    try {
      switch (message.type) {
        case 'satellite_discovery':
          await this.handleDiscoveryMessage(message);
          break;
        case 'satellite_handshake':
          await this.handleHandshakeMessage(message);
          break;
        case 'satellite_topology_update':
          await this.handleTopologyUpdateMessage(message);
          break;
        case 'satellite_health_check':
          await this.handleHealthCheckMessage(message);
          break;
        default:
          // Forward other satellite messages to subscribers
          this.emit('satellite_message', message);
      }
    } catch (error) {
      logger.error(`Failed to handle satellite message ${message.id}:`, error);
    }
  }

  /**
   * Handle discovery messages
   */
  private async handleDiscoveryMessage(message: SatelliteMessage): Promise<void> {
    if (message.from === this.config.satellite.nodeId) {
      return; // Ignore own discovery messages
    }

    const { nodeId, nodeType, capabilities, region } = message.payload;

    // Add discovered node to network topology
    this.networkManager.addNode({
      id: nodeId,
      nodeType,
      address: 'unknown', // TODO: Extract from message metadata
      port: 0,
      capabilities,
      status: 'active',
      lastSeen: new Date(),
      latency: 0,
      bandwidth: 0,
      priority: 1,
      metadata: { region },
    });

    // Initiate handshake if not already connected
    if (!this.connectedSatellites.has(nodeId)) {
      await this.initiateHandshake(nodeId);
    }

    logger.debug(`Discovered satellite: ${nodeId} (${nodeType})`);
  }

  /**
   * Handle handshake messages
   */
  private async handleHandshakeMessage(message: SatelliteMessage): Promise<void> {
    const { nodeId } = message.payload;
    
    if (message.payload.type === 'request') {
      // Respond to handshake request
      const responseMessage: SatelliteMessage = {
        id: `handshake-response-${Date.now()}`,
        type: 'satellite_handshake',
        from: this.config.satellite.nodeId,
        to: nodeId,
        timestamp: new Date(),
        priority: 'high',
        payload: {
          type: 'response',
          nodeId: this.config.satellite.nodeId,
          nodeType: this.config.satellite.nodeType,
          capabilities: this.config.satellite.capabilities,
        },
        metadata: {},
      };

      await this.messageBus.sendMessage(responseMessage);
      logger.debug(`Sent handshake response to ${nodeId}`);
    } else if (message.payload.type === 'response') {
      // Handle handshake response
      const timeout = this.pendingHandshakes.get(nodeId);
      if (timeout) {
        clearTimeout(timeout);
        this.pendingHandshakes.delete(nodeId);
      }

      this.connectedSatellites.add(nodeId);
      logger.info(`Handshake completed with satellite ${nodeId}`);
      this.emit('satellite_connected', { nodeId, message });
    }
  }

  /**
   * Handle topology update messages
   */
  private async handleTopologyUpdateMessage(message: SatelliteMessage): Promise<void> {
    const { version, nodeCount, linkCount, lastUpdated } = message.payload;
    const currentTopology = this.networkManager.getTopology();

    if (version > currentTopology.version) {
      logger.debug(`Received topology update: v${version} (${nodeCount} nodes, ${linkCount} links)`);
      // TODO: Request full topology if significantly different
    }
  }

  /**
   * Handle health check messages
   */
  private async handleHealthCheckMessage(message: SatelliteMessage): Promise<void> {
    // Update node last seen time
    const node = this.networkManager.getNodes().get(message.from);
    if (node) {
      node.lastSeen = new Date();
      node.status = 'active';
    }
  }

  /**
   * Initiate handshake with a satellite
   */
  private async initiateHandshake(nodeId: AgentId): Promise<void> {
    const handshakeMessage: SatelliteMessage = {
      id: `handshake-${Date.now()}`,
      type: 'satellite_handshake',
      from: this.config.satellite.nodeId,
      to: nodeId,
      timestamp: new Date(),
      priority: 'high',
      payload: {
        type: 'request',
        nodeId: this.config.satellite.nodeId,
        nodeType: this.config.satellite.nodeType,
        capabilities: this.config.satellite.capabilities,
      },
      metadata: {},
    };

    // Set timeout for handshake response
    const timeout = setTimeout(() => {
      this.pendingHandshakes.delete(nodeId);
      logger.warn(`Handshake timeout with satellite ${nodeId}`);
      this.emit('handshake_timeout', { nodeId });
    }, this.config.protocols.handshakeTimeout);

    this.pendingHandshakes.set(nodeId, timeout);

    await this.messageBus.sendMessage(handshakeMessage);
    logger.debug(`Initiated handshake with satellite ${nodeId}`);
  }

  /**
   * Broadcast message to all connected satellites  
   */
  private async broadcastMessage(message: SatelliteMessage): Promise<void> {
    // Use underlying message bus broadcast capability
    await this.messageBus.sendMessage(message);
  }

  /**
   * Send multi-hop message through routing path
   */
  private async sendMultiHopMessage(message: SatelliteMessage, route: any[]): Promise<void> {
    // For now, use direct messaging through message bus
    // In a full implementation, this would handle hop-by-hop forwarding
    await this.messageBus.sendMessage(message);
  }

  /**
   * Handle discovery broadcast events
   */
  private handleDiscoveryBroadcast(data: any): void {
    // Implementation handled by performDiscovery
  }

  /**
   * Handle discovery gossip events
   */
  private handleDiscoveryGossip(data: any): void {
    // TODO: Implement gossip protocol handling
  }

  /**
   * Check if message is a satellite message
   */
  private isSatelliteMessage(message: Message): boolean {
    const satelliteTypes: SatelliteMessageType[] = [
      'satellite_discovery',
      'satellite_handshake',
      'satellite_topology_update',
      'satellite_route_request',
      'satellite_route_response',
      'satellite_health_check',
      'satellite_coordination',
      'satellite_consensus',
    ];

    return satelliteTypes.includes(message.type as SatelliteMessageType);
  }
}