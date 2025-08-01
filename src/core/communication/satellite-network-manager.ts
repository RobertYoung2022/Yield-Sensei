/**
 * YieldSensei Satellite Network Manager
 * Task 45.1: Inter-Satellite Message Bus Architecture
 * 
 * Manages satellite network discovery, topology, and mesh networking capabilities
 */

import { EventEmitter } from 'events';
import Logger from '@/shared/logging/logger';
import { AgentId, Message, MessageType } from '@/types';

const logger = Logger.getLogger('satellite-network');

/**
 * Satellite Network Node Types
 */
export type SatelliteNodeType = 
  | 'primary'     // Core processing satellite
  | 'secondary'   // Supporting satellite
  | 'relay'       // Message relay satellite
  | 'edge'        // Edge/client satellite
  | 'gateway';    // Gateway to external networks

/**
 * Network Topology Types
 */
export type NetworkTopology = 
  | 'mesh'        // Full mesh connectivity
  | 'star'        // Hub and spoke
  | 'ring'        // Ring topology
  | 'hybrid'      // Mixed topology
  | 'tree';       // Hierarchical tree

/**
 * Satellite Network Node Information
 */
export interface SatelliteNode {
  id: AgentId;
  nodeType: SatelliteNodeType;
  address: string;
  port: number;
  capabilities: string[];
  status: 'active' | 'inactive' | 'degraded' | 'unreachable';
  lastSeen: Date;
  latency: number;
  bandwidth: number;
  priority: number;
  metadata: Record<string, any>;
}

/**
 * Network Link Information
 */
export interface NetworkLink {
  from: AgentId;
  to: AgentId;
  linkType: 'direct' | 'relay' | 'virtual';
  quality: number;
  latency: number;
  bandwidth: number;
  reliability: number;
  cost: number;
  lastUpdated: Date;
}

/**
 * Network Topology State
 */
export interface NetworkTopology {
  nodes: Map<AgentId, SatelliteNode>;
  links: Map<string, NetworkLink>;
  topology: NetworkTopology;
  lastUpdated: Date;
  version: number;
}

/**
 * Discovery Protocol Configuration
 */
export interface DiscoveryConfig {
  enabled: boolean;
  interval: number;
  timeout: number;
  maxHops: number;
  protocol: 'broadcast' | 'multicast' | 'gossip' | 'centralized';
  heartbeatInterval: number;
  nodeTimeout: number;
}

/**
 * SDN Control Configuration
 */
export interface SDNConfig {
  enabled: boolean;
  controllerEndpoint?: string;
  routingAlgorithm: 'shortest-path' | 'load-balance' | 'qos-aware' | 'adaptive';
  recalculationInterval: number;
  congestionThreshold: number;
  failoverEnabled: boolean;
}

/**
 * Satellite Network Manager Configuration
 */
export interface SatelliteNetworkConfig {
  nodeId: AgentId;
  nodeType: SatelliteNodeType;
  discovery: DiscoveryConfig;
  sdn: SDNConfig;
  mesh: {
    enabled: boolean;
    maxConnections: number;
    redundancy: number;
  };
  routing: {
    algorithm: 'dijkstra' | 'astar' | 'flood' | 'adaptive';
    maxHops: number;
    ttl: number;
  };
}

export const DEFAULT_SATELLITE_NETWORK_CONFIG: SatelliteNetworkConfig = {
  nodeId: 'unknown',
  nodeType: 'secondary',
  discovery: {
    enabled: true,
    interval: 30000, // 30 seconds
    timeout: 5000,
    maxHops: 3,
    protocol: 'gossip',
    heartbeatInterval: 10000, // 10 seconds  
    nodeTimeout: 60000, // 1 minute
  },
  sdn: {
    enabled: true,
    routingAlgorithm: 'adaptive',
    recalculationInterval: 60000, // 1 minute
    congestionThreshold: 0.8,
    failoverEnabled: true,
  },
  mesh: {
    enabled: true,
    maxConnections: 10,
    redundancy: 2,
  },
  routing: {
    algorithm: 'adaptive',
    maxHops: 5,
    ttl: 300000, // 5 minutes
  },
};

/**
 * Satellite Network Manager
 * Manages satellite constellation network topology and discovery
 */
export class SatelliteNetworkManager extends EventEmitter {
  private config: SatelliteNetworkConfig;
  private topology: NetworkTopology;
  private discoveryInterval?: NodeJS.Timeout;
  private heartbeatInterval?: NodeJS.Timeout;
  private routingTable: Map<AgentId, NetworkLink[]> = new Map();
  private isRunning: boolean = false;

  constructor(config: SatelliteNetworkConfig = DEFAULT_SATELLITE_NETWORK_CONFIG) {
    super();
    this.config = config;
    this.topology = {
      nodes: new Map(),
      links: new Map(),
      topology: 'hybrid',
      lastUpdated: new Date(),
      version: 1,
    };

    // Add self to topology
    this.addNode({
      id: config.nodeId,
      nodeType: config.nodeType,
      address: 'localhost',
      port: 0,
      capabilities: [],
      status: 'active',
      lastSeen: new Date(),
      latency: 0,
      bandwidth: 0,
      priority: 1,
      metadata: {},
    });
  }

  /**
   * Start the satellite network manager
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Satellite network manager already running');
      return;
    }

    try {
      logger.info('Starting satellite network manager...');
      
      // Start discovery if enabled
      if (this.config.discovery.enabled) {
        await this.startDiscovery();
      }

      // Start heartbeat monitoring
      this.startHeartbeat();

      // Initialize routing table
      this.calculateRoutingTable();

      this.isRunning = true;
      logger.info('Satellite network manager started successfully');
      this.emit('started');
    } catch (error) {
      logger.error('Failed to start satellite network manager:', error);
      throw error;
    }
  }

  /**
   * Stop the satellite network manager
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    logger.info('Stopping satellite network manager...');

    // Clear intervals
    if (this.discoveryInterval) {
      clearInterval(this.discoveryInterval);
      delete this.discoveryInterval;
    }

    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      delete this.heartbeatInterval;
    }

    this.isRunning = false;
    logger.info('Satellite network manager stopped');
    this.emit('stopped');
  }

  /**
   * Add a satellite node to the network topology
   */
  addNode(node: SatelliteNode): void {
    const existingNode = this.topology.nodes.get(node.id);
    
    if (existingNode) {
      // Update existing node
      Object.assign(existingNode, node, { lastSeen: new Date() });
      logger.debug(`Updated satellite node: ${node.id}`);
    } else {
      // Add new node
      this.topology.nodes.set(node.id, { ...node, lastSeen: new Date() });
      logger.info(`Added new satellite node: ${node.id} (${node.nodeType})`);
    }

    this.topology.lastUpdated = new Date();
    this.topology.version++;
    this.emit('node_added', node);
  }

  /**
   * Remove a satellite node from the network topology
   */
  removeNode(nodeId: AgentId): void {
    const node = this.topology.nodes.get(nodeId);
    if (!node) {
      logger.warn(`Attempted to remove non-existent node: ${nodeId}`);
      return;
    }

    // Remove node
    this.topology.nodes.delete(nodeId);

    // Remove all links involving this node
    const linksToRemove = Array.from(this.topology.links.entries())
      .filter(([, link]) => link.from === nodeId || link.to === nodeId)
      .map(([linkId]) => linkId);

    linksToRemove.forEach(linkId => this.topology.links.delete(linkId));

    // Update routing table
    this.routingTable.delete(nodeId);
    this.calculateRoutingTable();

    this.topology.lastUpdated = new Date();
    this.topology.version++;
    
    logger.info(`Removed satellite node: ${nodeId}`);
    this.emit('node_removed', { nodeId, node });
  }

  /**
   * Add a network link between satellites
   */
  addLink(link: NetworkLink): void {
    const linkId = `${link.from}-${link.to}`;
    
    // Validate nodes exist
    if (!this.topology.nodes.has(link.from) || !this.topology.nodes.has(link.to)) {
      logger.warn(`Cannot add link ${linkId}: one or both nodes don't exist`);
      return;
    }

    this.topology.links.set(linkId, { ...link, lastUpdated: new Date() });
    
    // Recalculate routing table
    this.calculateRoutingTable();
    
    this.topology.lastUpdated = new Date();
    this.topology.version++;
    
    logger.debug(`Added network link: ${linkId}`);
    this.emit('link_added', link);
  }

  /**
   * Get the best route to a destination satellite
   */
  getRoute(destination: AgentId): NetworkLink[] | null {
    return this.routingTable.get(destination) || null;
  }

  /**
   * Get all satellite nodes in the network
   */
  getNodes(): Map<AgentId, SatelliteNode> {
    return new Map(this.topology.nodes);
  }

  /**
   * Get network topology information
   */
  getTopology(): NetworkTopology {
    return {
      ...this.topology,
      nodes: new Map(this.topology.nodes),
      links: new Map(this.topology.links),
    };
  }

  /**
   * Start network discovery protocol
   */
  private async startDiscovery(): Promise<void> {
    logger.info(`Starting ${this.config.discovery.protocol} discovery protocol`);

    this.discoveryInterval = setInterval(async () => {
      try {
        await this.performDiscovery();
      } catch (error) {
        logger.error('Discovery protocol error:', error);
      }
    }, this.config.discovery.interval);

    // Perform initial discovery
    await this.performDiscovery();
  }

  /**
   * Perform network discovery
   */
  private async performDiscovery(): Promise<void> {
    switch (this.config.discovery.protocol) {
      case 'broadcast':
        await this.broadcastDiscovery();
        break;
      case 'gossip':
        await this.gossipDiscovery();
        break;
      case 'centralized':
        await this.centralizedDiscovery();
        break;
      default:
        logger.warn(`Unknown discovery protocol: ${this.config.discovery.protocol}`);
    }
  }

  /**
   * Broadcast-based discovery
   */
  private async broadcastDiscovery(): Promise<void> {
    // Emit discovery broadcast message
    this.emit('discovery_broadcast', {
      nodeId: this.config.nodeId,
      nodeType: this.config.nodeType,
      timestamp: new Date(),
    });
  }

  /**
   * Gossip-based discovery
   */
  private async gossipDiscovery(): Promise<void> {
    // Select random subset of known nodes for gossip
    const nodes = Array.from(this.topology.nodes.keys())
      .filter(id => id !== this.config.nodeId);
    
    const gossipTargets = nodes.slice(0, Math.min(3, nodes.length));
    
    for (const target of gossipTargets) {
      this.emit('discovery_gossip', {
        target,
        topology: this.getCompactTopology(),
      });
    }
  }

  /**
   * Centralized discovery via controller
   */
  private async centralizedDiscovery(): Promise<void> {
    if (this.config.sdn.controllerEndpoint) {
      this.emit('discovery_centralized', {
        controller: this.config.sdn.controllerEndpoint,
        nodeInfo: this.topology.nodes.get(this.config.nodeId),
      });
    }
  }

  /**
   * Start heartbeat monitoring
   */
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      this.processHeartbeats();
    }, this.config.discovery.heartbeatInterval);
  }

  /**
   * Process heartbeat timeouts and node health
   */
  private processHeartbeats(): void {
    const now = new Date();
    const timeout = this.config.discovery.nodeTimeout;
    
    for (const [nodeId, node] of this.topology.nodes) {
      if (nodeId === this.config.nodeId) continue; // Skip self
      
      const timeSinceLastSeen = now.getTime() - node.lastSeen.getTime();
      
      if (timeSinceLastSeen > timeout) {
        if (node.status !== 'unreachable') {
          node.status = 'unreachable';
          logger.warn(`Node ${nodeId} marked as unreachable (last seen ${timeSinceLastSeen}ms ago)`);
          this.emit('node_unreachable', { nodeId, node });
        }
      } else if (timeSinceLastSeen > timeout / 2) {
        if (node.status === 'active') {
          node.status = 'degraded';
          logger.warn(`Node ${nodeId} marked as degraded`);
          this.emit('node_degraded', { nodeId, node });
        }
      }
    }
  }

  /**
   * Calculate routing table using configured algorithm
   */
  private calculateRoutingTable(): void {
    this.routingTable.clear();

    switch (this.config.routing.algorithm) {
      case 'dijkstra':
        this.calculateDijkstraRoutes();
        break;
      case 'adaptive':
        this.calculateAdaptiveRoutes();
        break;
      default:
        this.calculateSimpleRoutes();
    }

    logger.debug(`Routing table calculated with ${this.routingTable.size} destinations`);
    this.emit('routing_updated', this.routingTable);
  }

  /**
   * Dijkstra's shortest path algorithm
   */
  private calculateDijkstraRoutes(): void {
    const sourceId = this.config.nodeId;
    const distances: Map<AgentId, number> = new Map();
    const previous: Map<AgentId, NetworkLink | null> = new Map();
    const unvisited: Set<AgentId> = new Set();

    // Initialize
    for (const nodeId of this.topology.nodes.keys()) {
      distances.set(nodeId, nodeId === sourceId ? 0 : Infinity);
      previous.set(nodeId, null);
      unvisited.add(nodeId);
    }

    while (unvisited.size > 0) {
      // Find unvisited node with minimum distance
      let currentNode: AgentId | null = null;
      let minDistance = Infinity;
      
      for (const nodeId of unvisited) {
        const distance = distances.get(nodeId) || Infinity;
        if (distance < minDistance) {
          minDistance = distance;
          currentNode = nodeId;
        }
      }

      if (!currentNode || minDistance === Infinity) break;
      
      unvisited.delete(currentNode);

      // Check neighbors
      for (const [, link] of this.topology.links) {
        if (link.from === currentNode && unvisited.has(link.to)) {
          const alt = minDistance + link.cost;
          const currentDistance = distances.get(link.to) || Infinity;
          
          if (alt < currentDistance) {
            distances.set(link.to, alt);
            previous.set(link.to, link);
          }
        }
      }
    }

    // Build routing table
    for (const [nodeId, prevLink] of previous) {
      if (nodeId !== sourceId && prevLink) {
        const route: NetworkLink[] = [];
        let currentLink = prevLink;
        
        while (currentLink) {
          route.unshift(currentLink);
          const prevNode = previous.get(currentLink.from);
          currentLink = prevNode || null;
        }
        
        this.routingTable.set(nodeId, route);
      }
    }
  }

  /**
   * Adaptive routing based on network conditions
   */
  private calculateAdaptiveRoutes(): void {
    // Start with Dijkstra as base, then adapt based on conditions
    this.calculateDijkstraRoutes();
    
    // Apply adaptive modifications based on:
    // - Link quality and congestion
    // - Node health status
    // - Historical performance
    for (const [destination, route] of this.routingTable) {
      const adaptedRoute = this.adaptRoute(route);
      this.routingTable.set(destination, adaptedRoute);
    }
  }

  /**
   * Simple direct routing
   */
  private calculateSimpleRoutes(): void {
    for (const [, link] of this.topology.links) {
      if (link.from === this.config.nodeId) {
        this.routingTable.set(link.to, [link]);
      }
    }
  }

  /**
   * Adapt route based on current network conditions
   */
  private adaptRoute(route: NetworkLink[]): NetworkLink[] {
    // Check if any links in the route are degraded
    const hasIssues = route.some(link => {
      const fromNode = this.topology.nodes.get(link.from);
      const toNode = this.topology.nodes.get(link.to);
      return fromNode?.status !== 'active' || 
             toNode?.status !== 'active' || 
             link.quality < 0.5;
    });

    if (hasIssues) {
      // Try to find alternative route
      // This is a simplified version - in practice would implement more sophisticated logic
      logger.debug(`Route to ${route[route.length - 1]?.to} needs adaptation due to network conditions`);
    }

    return route;
  }

  /**
   * Get compact topology for gossip protocol
   */
  private getCompactTopology(): any {
    return {
      version: this.topology.version,
      nodeCount: this.topology.nodes.size,
      linkCount: this.topology.links.size,
      lastUpdated: this.topology.lastUpdated,
    };
  }

  /**
   * Get network statistics
   */
  getStats() {
    return {
      nodeCount: this.topology.nodes.size,
      linkCount: this.topology.links.size,
      routingTableSize: this.routingTable.size,
      topologyVersion: this.topology.version,
      isRunning: this.isRunning,
      config: this.config,
      activeNodes: Array.from(this.topology.nodes.values())
        .filter(node => node.status === 'active').length,
      degradedNodes: Array.from(this.topology.nodes.values())
        .filter(node => node.status === 'degraded').length,
      unreachableNodes: Array.from(this.topology.nodes.values())
        .filter(node => node.status === 'unreachable').length,
    };
  }
}