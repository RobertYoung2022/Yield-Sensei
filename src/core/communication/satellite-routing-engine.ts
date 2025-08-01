/**
 * YieldSensei Satellite Routing Engine
 * Task 45.1: Inter-Satellite Message Bus Architecture
 * 
 * Intelligent message routing engine for satellite-to-satellite communication
 */

import { EventEmitter } from 'events';
import Logger from '@/shared/logging/logger';
import { AgentId, Message, MessageType } from '@/types';
import { SatelliteNetworkManager, NetworkLink, SatelliteNode } from './satellite-network-manager';

const logger = Logger.getLogger('satellite-routing');

/**
 * Routing Strategy Types
 */
export type RoutingStrategy = 
  | 'direct'        // Direct point-to-point
  | 'multi-hop'     // Multi-hop routing
  | 'broadcast'     // Network-wide broadcast
  | 'multicast'     // Group multicast
  | 'anycast'       // Any available node
  | 'geocast'       // Geographic region cast
  | 'adaptive';     // Adaptive based on conditions

/**
 * Quality of Service (QoS) Parameters
 */
export interface QoSRequirements {
  maxLatency?: number;      // Maximum acceptable latency (ms)
  minBandwidth?: number;    // Minimum bandwidth requirement (Mbps)
  reliability?: number;     // Required reliability (0-1)
  priority: 'low' | 'medium' | 'high' | 'critical';
  jitterTolerance?: number; // Maximum jitter tolerance (ms)
  lossTolerancePct?: number; // Acceptable packet loss percentage
}

/**
 * Routing Decision Context
 */
export interface RoutingContext {
  message: Message;
  source: AgentId;
  destination: AgentId | 'broadcast' | 'multicast';
  qos: QoSRequirements;
  constraints: {
    maxHops?: number;
    avoidNodes?: AgentId[];
    preferredNodes?: AgentId[];
    energyConstraints?: boolean;
    securityLevel?: 'low' | 'medium' | 'high';
  };
  networkConditions: {
    congestionLevel: number;
    availableBandwidth: number;
    averageLatency: number;
  };
}

/**
 * Routing Decision Result
 */
export interface RoutingDecision {
  strategy: RoutingStrategy;
  route: NetworkLink[];
  alternatives: NetworkLink[][];
  estimatedLatency: number;
  estimatedReliability: number;
  cost: number;
  explanation: string;
  metadata: Record<string, any>;
}

/**
 * Route Performance Metrics
 */
export interface RouteMetrics {
  routeId: string;
  messageCount: number;
  successRate: number;
  averageLatency: number;
  totalBandwidthUsed: number;
  lastUsed: Date;
  congestionEvents: number;
  failureReasons: string[];
}

/**
 * Routing Engine Configuration
 */
export interface RoutingEngineConfig {
  defaultStrategy: RoutingStrategy;
  adaptiveThresholds: {
    latencyThreshold: number;
    congestionThreshold: number;
    reliabilityThreshold: number;
  };
  loadBalancing: {
    enabled: boolean;
    algorithm: 'round-robin' | 'weighted' | 'least-connections' | 'adaptive';
    maxConnectionsPerNode: number;
  };
  failover: {
    enabled: boolean;
    maxRetries: number;
    retryDelay: number;
    backoffMultiplier: number;
  };
  caching: {
    enabled: boolean;
    routeCacheTtl: number;
    maxCacheSize: number;
  };
  optimization: {
    enabled: boolean;
    recalculationInterval: number;
    learningRate: number;
  };
}

export const DEFAULT_ROUTING_ENGINE_CONFIG: RoutingEngineConfig = {
  defaultStrategy: 'adaptive',
  adaptiveThresholds: {
    latencyThreshold: 100, // ms
    congestionThreshold: 0.8,
    reliabilityThreshold: 0.95,
  },
  loadBalancing: {
    enabled: true,
    algorithm: 'adaptive',
    maxConnectionsPerNode: 100,
  },
  failover: {
    enabled: true,
    maxRetries: 3,
    retryDelay: 1000, // ms
    backoffMultiplier: 2.0,
  },
  caching: {
    enabled: true,
    routeCacheTtl: 300000, // 5 minutes
    maxCacheSize: 1000,
  },
  optimization: {
    enabled: true,
    recalculationInterval: 60000, // 1 minute
    learningRate: 0.1,
  },
};

/**
 * Cached Route Entry
 */
interface CachedRoute {
  decision: RoutingDecision;
  timestamp: Date;
  hitCount: number;
  metrics: RouteMetrics;
}

/**
 * Satellite Routing Engine
 * Intelligent routing engine for inter-satellite communication
 */
export class SatelliteRoutingEngine extends EventEmitter {
  private config: RoutingEngineConfig;
  private networkManager: SatelliteNetworkManager;
  
  // Route caching and metrics
  private routeCache: Map<string, CachedRoute> = new Map();
  private routeMetrics: Map<string, RouteMetrics> = new Map();
  private connectionCounts: Map<AgentId, number> = new Map();
  
  // Optimization and learning
  private optimizationInterval?: NodeJS.Timeout;
  private performanceHistory: Map<string, number[]> = new Map();
  
  // Current network state
  private networkConditions: RoutingContext['networkConditions'] = {
    congestionLevel: 0,
    availableBandwidth: 1000, // Mbps
    averageLatency: 50, // ms
  };

  constructor(
    networkManager: SatelliteNetworkManager,
    config: RoutingEngineConfig = DEFAULT_ROUTING_ENGINE_CONFIG
  ) {
    super();
    this.networkManager = networkManager;
    this.config = config;

    this.setupNetworkManagerEvents();
  }

  /**
   * Start the routing engine
   */
  async start(): Promise<void> {
    logger.info('Starting satellite routing engine...');

    // Start optimization if enabled
    if (this.config.optimization.enabled) {
      this.startOptimization();
    }

    logger.info('Satellite routing engine started successfully');
    this.emit('started');
  }

  /**
   * Stop the routing engine
   */
  async stop(): Promise<void> {
    logger.info('Stopping satellite routing engine...');

    // Clear optimization interval
    if (this.optimizationInterval) {
      clearInterval(this.optimizationInterval);
      delete this.optimizationInterval;
    }

    logger.info('Satellite routing engine stopped');
    this.emit('stopped');
  }

  /**
   * Route a message to its destination
   */
  async routeMessage(context: RoutingContext): Promise<RoutingDecision> {
    const startTime = Date.now();

    try {
      // Check cache first
      if (this.config.caching.enabled) {
        const cachedRoute = this.getCachedRoute(context);
        if (cachedRoute) {
          cachedRoute.hitCount++;
          logger.debug(`Using cached route for message ${context.message.id}`);
          return cachedRoute.decision;
        }
      }

      // Make routing decision
      const decision = await this.makeRoutingDecision(context);

      // Cache the decision
      if (this.config.caching.enabled) {
        this.cacheRoute(context, decision);
      }

      // Update metrics
      this.updateRoutingMetrics(decision, Date.now() - startTime);

      logger.debug(
        `Routed message ${context.message.id} using ${decision.strategy} strategy ` +
        `(${decision.route.length} hops, ${decision.estimatedLatency}ms latency)`
      );

      this.emit('message_routed', { context, decision });
      return decision;

    } catch (error) {
      logger.error(`Failed to route message ${context.message.id}:`, error);
      this.emit('routing_error', { context, error });
      throw error;
    }
  }

  /**
   * Make routing decision based on context
   */
  private async makeRoutingDecision(context: RoutingContext): Promise<RoutingDecision> {
    const { message, source, destination, qos, constraints } = context;

    // Handle broadcast messages
    if (destination === 'broadcast') {
      return this.createBroadcastDecision(context);
    }

    // Handle multicast messages
    if (destination === 'multicast') {
      return this.createMulticastDecision(context);
    }

    // Handle point-to-point messages
    const destinationId = destination as AgentId;

    // Check if destination exists
    const topology = this.networkManager.getTopology();
    if (!topology.nodes.has(destinationId)) {
      throw new Error(`Destination node ${destinationId} not found in network topology`);
    }

    // Determine routing strategy
    const strategy = this.selectRoutingStrategy(context);

    switch (strategy) {
      case 'direct':
        return this.createDirectDecision(context, destinationId);
      case 'multi-hop':
        return this.createMultiHopDecision(context, destinationId);
      case 'adaptive':
        return this.createAdaptiveDecision(context, destinationId);
      default:
        throw new Error(`Unsupported routing strategy: ${strategy}`);
    }
  }

  /**
   * Select optimal routing strategy
   */
  private selectRoutingStrategy(context: RoutingContext): RoutingStrategy {
    const { qos, constraints, networkConditions } = context;

    // Override with explicit strategy if specified
    if (constraints.securityLevel === 'high') {
      return 'direct'; // Prefer direct routes for high security
    }

    // High priority messages prefer direct routing
    if (qos.priority === 'critical') {
      return 'direct';
    }

    // Check network conditions for adaptive selection
    if (networkConditions.congestionLevel > this.config.adaptiveThresholds.congestionThreshold) {
      return 'multi-hop'; // Use multi-hop to avoid congestion
    }

    if (qos.maxLatency && qos.maxLatency < this.config.adaptiveThresholds.latencyThreshold) {
      return 'direct'; // Use direct for low-latency requirements
    }

    // Default to adaptive strategy
    return this.config.defaultStrategy;
  }

  /**
   * Create direct routing decision
   */
  private createDirectDecision(context: RoutingContext, destination: AgentId): RoutingDecision {
    const topology = this.networkManager.getTopology();
    const directLinks = Array.from(topology.links.values())
      .filter(link => link.from === context.source && link.to === destination);

    if (directLinks.length === 0) {
      throw new Error(`No direct link available to ${destination}`);
    }

    // Select best direct link
    const bestLink = this.selectBestLink(directLinks, context.qos);

    return {
      strategy: 'direct',
      route: [bestLink],
      alternatives: directLinks.slice(1).map(link => [link]),
      estimatedLatency: bestLink.latency,
      estimatedReliability: bestLink.reliability,
      cost: bestLink.cost,
      explanation: `Direct route to ${destination} via best available link`,
      metadata: {
        linkQuality: bestLink.quality,
        bandwidth: bestLink.bandwidth,
      },
    };
  }

  /**
   * Create multi-hop routing decision
   */
  private createMultiHopDecision(context: RoutingContext, destination: AgentId): RoutingDecision {
    const route = this.networkManager.getRoute(destination);
    
    if (!route || route.length === 0) {
      throw new Error(`No route available to ${destination}`);
    }

    // Calculate route metrics
    const estimatedLatency = route.reduce((sum, link) => sum + link.latency, 0);
    const estimatedReliability = route.reduce((prod, link) => prod * link.reliability, 1);
    const totalCost = route.reduce((sum, link) => sum + link.cost, 0);

    // Find alternative routes
    const alternatives = this.findAlternativeRoutes(context.source, destination, route);

    return {
      strategy: 'multi-hop',
      route,
      alternatives,
      estimatedLatency,
      estimatedReliability,
      cost: totalCost,
      explanation: `Multi-hop route to ${destination} via ${route.length} hops`,
      metadata: {
        hopCount: route.length,
        intermediateNodes: route.slice(0, -1).map(link => link.to),
      },
    };
  }

  /**
   * Create adaptive routing decision
   */
  private createAdaptiveDecision(context: RoutingContext, destination: AgentId): RoutingDecision {
    // Try direct first, fallback to multi-hop based on conditions
    try {
      const directDecision = this.createDirectDecision(context, destination);
      
      // Check if direct route meets QoS requirements
      if (this.meetsQoSRequirements(directDecision, context.qos)) {
        directDecision.strategy = 'adaptive';
        directDecision.explanation = 'Adaptive strategy selected direct route based on QoS requirements';
        return directDecision;
      }
    } catch {
      // Direct route not available, continue to multi-hop
    }

    // Try multi-hop
    const multiHopDecision = this.createMultiHopDecision(context, destination);
    multiHopDecision.strategy = 'adaptive';
    multiHopDecision.explanation = 'Adaptive strategy selected multi-hop route due to QoS constraints';
    
    return multiHopDecision;
  }

  /**
   * Create broadcast routing decision
   */
  private createBroadcastDecision(context: RoutingContext): RoutingDecision {
    const topology = this.networkManager.getTopology();
    const allNodes = Array.from(topology.nodes.keys())
      .filter(nodeId => nodeId !== context.source);

    // Create routes to all nodes
    const routes: NetworkLink[] = [];
    for (const nodeId of allNodes) {
      try {
        const route = this.networkManager.getRoute(nodeId);
        if (route && route.length > 0) {
          routes.push(...route);
        }
      } catch {
        // Skip nodes that are unreachable
        continue;
      }
    }

    return {
      strategy: 'broadcast',
      route: routes,
      alternatives: [],
      estimatedLatency: Math.max(...routes.map(link => link.latency), 0),
      estimatedReliability: Math.min(...routes.map(link => link.reliability), 1),
      cost: routes.reduce((sum, link) => sum + link.cost, 0),
      explanation: `Broadcast to ${allNodes.length} nodes in network`,
      metadata: {
        targetNodes: allNodes,
        totalHops: routes.length,
      },
    };
  }

  /**
   * Create multicast routing decision
   */
  private createMulticastDecision(context: RoutingContext): RoutingDecision {
    // For now, treat multicast as broadcast
    // In a full implementation, this would handle specific multicast groups
    const broadcastDecision = this.createBroadcastDecision(context);
    broadcastDecision.strategy = 'multicast';
    broadcastDecision.explanation = 'Multicast routing (currently implemented as broadcast)';
    
    return broadcastDecision;
  }

  /**
   * Select the best link from available options
   */
  private selectBestLink(links: NetworkLink[], qos: QoSRequirements): NetworkLink {
    // Score links based on QoS requirements
    const scoredLinks = links.map(link => {
      let score = 0;

      // Latency scoring (lower is better)
      if (qos.maxLatency) {
        score += link.latency <= qos.maxLatency ? 10 : -10;
        score += Math.max(0, 10 - link.latency / qos.maxLatency * 10);
      }

      // Bandwidth scoring (higher is better)
      if (qos.minBandwidth) {
        score += link.bandwidth >= qos.minBandwidth ? 10 : -10;
        score += Math.min(10, link.bandwidth / qos.minBandwidth * 5);
      }

      // Reliability scoring (higher is better)
      if (qos.reliability) {
        score += link.reliability >= qos.reliability ? 10 : -10;
        score += link.reliability * 10;
      }

      // Quality scoring (higher is better)
      score += link.quality * 5;

      // Cost scoring (lower is better)
      score -= link.cost;

      return { link, score };
    });

    // Sort by score and return best link
    scoredLinks.sort((a, b) => b.score - a.score);
    return scoredLinks[0].link;
  }

  /**
   * Find alternative routes to destination
   */
  private findAlternativeRoutes(
    source: AgentId, 
    destination: AgentId, 
    primaryRoute: NetworkLink[]
  ): NetworkLink[][] {
    // Simplified alternative route finding
    // In a full implementation, this would use k-shortest paths algorithms
    const alternatives: NetworkLink[][] = [];
    
    // For now, just return the primary route as the only alternative
    // This is a placeholder for more sophisticated route discovery
    
    return alternatives;
  }

  /**
   * Check if routing decision meets QoS requirements
   */
  private meetsQoSRequirements(decision: RoutingDecision, qos: QoSRequirements): boolean {
    if (qos.maxLatency && decision.estimatedLatency > qos.maxLatency) {
      return false;
    }

    if (qos.reliability && decision.estimatedReliability < qos.reliability) {
      return false;
    }

    return true;
  }

  /**
   * Get cached route if available and valid
   */
  private getCachedRoute(context: RoutingContext): CachedRoute | null {
    const cacheKey = this.generateCacheKey(context);
    const cached = this.routeCache.get(cacheKey);

    if (!cached) {
      return null;
    }

    // Check TTL
    const age = Date.now() - cached.timestamp.getTime();
    if (age > this.config.caching.routeCacheTtl) {
      this.routeCache.delete(cacheKey);
      return null;
    }

    return cached;
  }

  /**
   * Cache routing decision
   */
  private cacheRoute(context: RoutingContext, decision: RoutingDecision): void {
    const cacheKey = this.generateCacheKey(context);
    
    const cached: CachedRoute = {
      decision,
      timestamp: new Date(),
      hitCount: 0,
      metrics: {
        routeId: cacheKey,
        messageCount: 0,
        successRate: 1.0,
        averageLatency: decision.estimatedLatency,
        totalBandwidthUsed: 0,
        lastUsed: new Date(),
        congestionEvents: 0,
        failureReasons: [],
      },
    };

    this.routeCache.set(cacheKey, cached);

    // Manage cache size
    if (this.routeCache.size > this.config.caching.maxCacheSize) {
      // Remove oldest entries
      const entries = Array.from(this.routeCache.entries())
        .sort((a, b) => a[1].timestamp.getTime() - b[1].timestamp.getTime());
      
      const toRemove = entries.slice(0, entries.length - this.config.caching.maxCacheSize);
      toRemove.forEach(([key]) => this.routeCache.delete(key));
    }
  }

  /**
   * Generate cache key for routing context
   */
  private generateCacheKey(context: RoutingContext): string {
    return `${context.source}-${context.destination}-${context.qos.priority}`;
  }

  /**
   * Update routing metrics
   */
  private updateRoutingMetrics(decision: RoutingDecision, processingTime: number): void {
    const routeId = decision.route.map(link => `${link.from}-${link.to}`).join('|');
    
    let metrics = this.routeMetrics.get(routeId);
    if (!metrics) {
      metrics = {
        routeId,
        messageCount: 0,
        successRate: 1.0,
        averageLatency: decision.estimatedLatency,
        totalBandwidthUsed: 0,
        lastUsed: new Date(),
        congestionEvents: 0,
        failureReasons: [],
      };
      this.routeMetrics.set(routeId, metrics);
    }

    metrics.messageCount++;
    metrics.lastUsed = new Date();
    metrics.averageLatency = (metrics.averageLatency + processingTime) / 2;
  }

  /**
   * Setup network manager event handlers
   */
  private setupNetworkManagerEvents(): void {
    this.networkManager.on('topology_updated', () => {
      // Clear route cache when topology changes
      this.routeCache.clear();
      logger.debug('Route cache cleared due to topology update');
    });

    this.networkManager.on('node_unreachable', (event) => {
      // Remove routes involving unreachable nodes
      this.invalidateRoutesForNode(event.nodeId);
    });
  }

  /**
   * Invalidate cached routes involving a specific node
   */
  private invalidateRoutesForNode(nodeId: AgentId): void {
    const toRemove: string[] = [];
    
    for (const [key, cached] of this.routeCache) {
      const hasInvolvedNode = cached.decision.route.some(
        link => link.from === nodeId || link.to === nodeId
      );
      
      if (hasInvolvedNode) {
        toRemove.push(key);
      }
    }

    toRemove.forEach(key => this.routeCache.delete(key));
    
    if (toRemove.length > 0) {
      logger.debug(`Invalidated ${toRemove.length} cached routes involving unreachable node ${nodeId}`);
    }
  }

  /**
   * Start optimization processes
   */
  private startOptimization(): void {
    this.optimizationInterval = setInterval(() => {
      this.optimizeRoutes();
    }, this.config.optimization.recalculationInterval);
  }

  /**
   * Optimize routes based on performance history
   */
  private optimizeRoutes(): void {
    // Analyze route performance and adjust routing decisions
    logger.debug('Performing route optimization...');
    
    // Update network conditions based on recent metrics
    this.updateNetworkConditions();
    
    // Clear poorly performing routes from cache
    this.evictPoorPerformingRoutes();
    
    this.emit('routes_optimized', {
      cacheSize: this.routeCache.size,
      metricsCount: this.routeMetrics.size,
    });
  }

  /**
   * Update network conditions based on metrics
   */
  private updateNetworkConditions(): void {
    const metrics = Array.from(this.routeMetrics.values());
    
    if (metrics.length > 0) {
      this.networkConditions.averageLatency = 
        metrics.reduce((sum, m) => sum + m.averageLatency, 0) / metrics.length;
      
      this.networkConditions.congestionLevel = 
        metrics.reduce((sum, m) => sum + m.congestionEvents, 0) / metrics.length / 10;
    }
  }

  /**
   * Evict poorly performing routes from cache
   */
  private evictPoorPerformingRoutes(): void {
    const threshold = 0.8; // 80% success rate threshold
    const toRemove: string[] = [];

    for (const [key, cached] of this.routeCache) {
      const metrics = this.routeMetrics.get(cached.metrics.routeId);
      if (metrics && metrics.successRate < threshold) {
        toRemove.push(key);
      }
    }

    toRemove.forEach(key => this.routeCache.delete(key));
    
    if (toRemove.length > 0) {
      logger.debug(`Evicted ${toRemove.length} poorly performing routes from cache`);
    }
  }

  /**
   * Get routing engine statistics
   */
  getStats() {
    return {
      cacheSize: this.routeCache.size,
      cacheHits: Array.from(this.routeCache.values()).reduce((sum, r) => sum + r.hitCount, 0),
      routeMetrics: this.routeMetrics.size,
      networkConditions: this.networkConditions,
      config: this.config,
    };
  }
}