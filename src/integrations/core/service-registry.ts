/**
 * Service Registry
 * Central registry for managing all external service integrations
 */

import { EventEmitter } from 'events';
import Logger from '@/shared/logging/logger';
import {
  ServiceRegistration,
  ServiceHealth,
  ServiceConfig,
  ServiceMetadata,
  ServiceEvent,
  ServiceEventHandler,
  LoadBalancingStrategy,
  ServiceDiscoveryProvider
} from './types';

const logger = Logger.getLogger('service-registry');

export class ServiceRegistry extends EventEmitter {
  private services: Map<string, ServiceRegistration> = new Map();
  private eventHandlers: Map<string, ServiceEventHandler[]> = new Map();
  private loadBalancer: LoadBalancingStrategy;
  private discoveryProvider?: ServiceDiscoveryProvider;

  constructor(
    loadBalancer: LoadBalancingStrategy = new RoundRobinStrategy(),
    discoveryProvider?: ServiceDiscoveryProvider
  ) {
    super();
    this.loadBalancer = loadBalancer;
    this.discoveryProvider = discoveryProvider;

    if (this.discoveryProvider) {
      this.setupDiscovery();
    }
  }

  /**
   * Register a new service
   */
  async register(
    id: string,
    metadata: ServiceMetadata,
    config: ServiceConfig,
    instance?: any
  ): Promise<void> {
    try {
      const now = new Date();
      const registration: ServiceRegistration = {
        id,
        metadata,
        config,
        health: {
          status: 'unknown',
          lastCheck: now
        },
        instance,
        createdAt: now,
        updatedAt: now
      };

      this.services.set(id, registration);

      // Register with discovery provider if available
      if (this.discoveryProvider) {
        await this.discoveryProvider.register(registration);
      }

      const event: ServiceEvent = {
        type: 'registered',
        serviceId: id,
        timestamp: now,
        data: { metadata, config }
      };

      this.emit('service_registered', event);
      await this.notifyEventHandlers('registered', event);

      logger.info(`Service registered: ${id}`, { metadata, config });
    } catch (error) {
      logger.error(`Failed to register service ${id}:`, error);
      throw error;
    }
  }

  /**
   * Deregister a service
   */
  async deregister(id: string): Promise<void> {
    try {
      const service = this.services.get(id);
      if (!service) {
        logger.warn(`Attempted to deregister unknown service: ${id}`);
        return;
      }

      this.services.delete(id);

      // Deregister from discovery provider if available
      if (this.discoveryProvider) {
        await this.discoveryProvider.deregister(id);
      }

      const event: ServiceEvent = {
        type: 'deregistered',
        serviceId: id,
        timestamp: new Date()
      };

      this.emit('service_deregistered', event);
      await this.notifyEventHandlers('deregistered', event);

      logger.info(`Service deregistered: ${id}`);
    } catch (error) {
      logger.error(`Failed to deregister service ${id}:`, error);
      throw error;
    }
  }

  /**
   * Get a service by ID
   */
  getService(id: string): ServiceRegistration | undefined {
    return this.services.get(id);
  }

  /**
   * Get all services
   */
  getAllServices(): ServiceRegistration[] {
    return Array.from(this.services.values());
  }

  /**
   * Get services by type
   */
  getServicesByType(type: ServiceMetadata['type']): ServiceRegistration[] {
    return this.getAllServices().filter(service => service.metadata.type === type);
  }

  /**
   * Get services by provider
   */
  getServicesByProvider(provider: string): ServiceRegistration[] {
    return this.getAllServices().filter(service => service.metadata.provider === provider);
  }

  /**
   * Get healthy services
   */
  getHealthyServices(): ServiceRegistration[] {
    return this.getAllServices().filter(service => 
      service.config.enabled && service.health.status === 'healthy'
    );
  }

  /**
   * Get services by tags
   */
  getServicesByTags(tags: string[]): ServiceRegistration[] {
    return this.getAllServices().filter(service => {
      if (!service.metadata.tags) return false;
      return tags.some(tag => service.metadata.tags!.includes(tag));
    });
  }

  /**
   * Select a service using load balancing strategy
   */
  selectService(serviceIds: string[]): ServiceRegistration | null {
    const services = serviceIds
      .map(id => this.getService(id))
      .filter((service): service is ServiceRegistration => 
        service !== undefined && 
        service.config.enabled && 
        service.health.status === 'healthy'
      );

    return this.loadBalancer.select(services);
  }

  /**
   * Update service configuration
   */
  async updateConfig(id: string, config: Partial<ServiceConfig>): Promise<void> {
    try {
      const service = this.services.get(id);
      if (!service) {
        throw new Error(`Service not found: ${id}`);
      }

      service.config = { ...service.config, ...config };
      service.updatedAt = new Date();

      const event: ServiceEvent = {
        type: 'config_updated',
        serviceId: id,
        timestamp: new Date(),
        data: { config }
      };

      this.emit('config_updated', event);
      await this.notifyEventHandlers('config_updated', event);

      logger.info(`Service configuration updated: ${id}`, { config });
    } catch (error) {
      logger.error(`Failed to update service config ${id}:`, error);
      throw error;
    }
  }

  /**
   * Update service health
   */
  async updateHealth(id: string, health: Partial<ServiceHealth>): Promise<void> {
    try {
      const service = this.services.get(id);
      if (!service) {
        logger.warn(`Attempted to update health for unknown service: ${id}`);
        return;
      }

      const oldStatus = service.health.status;
      service.health = { ...service.health, ...health, lastCheck: new Date() };
      service.updatedAt = new Date();

      // Emit health change event if status changed
      if (oldStatus !== service.health.status) {
        const event: ServiceEvent = {
          type: 'health_changed',
          serviceId: id,
          timestamp: new Date(),
          data: { oldStatus, newStatus: service.health.status, health }
        };

        this.emit('health_changed', event);
        await this.notifyEventHandlers('health_changed', event);

        logger.info(`Service health changed: ${id}`, { 
          from: oldStatus, 
          to: service.health.status,
          health 
        });
      }
    } catch (error) {
      logger.error(`Failed to update service health ${id}:`, error);
      throw error;
    }
  }

  /**
   * Add event handler
   */
  addEventHandler(eventType: string, handler: ServiceEventHandler): void {
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, []);
    }
    this.eventHandlers.get(eventType)!.push(handler);
  }

  /**
   * Remove event handler
   */
  removeEventHandler(eventType: string, handler: ServiceEventHandler): void {
    const handlers = this.eventHandlers.get(eventType);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  /**
   * Get service statistics
   */
  getStatistics(): {
    total: number;
    byType: Record<string, number>;
    byStatus: Record<string, number>;
    enabled: number;
    disabled: number;
  } {
    const services = this.getAllServices();
    const byType: Record<string, number> = {};
    const byStatus: Record<string, number> = {};
    let enabled = 0;
    let disabled = 0;

    for (const service of services) {
      // Count by type
      byType[service.metadata.type] = (byType[service.metadata.type] || 0) + 1;
      
      // Count by health status
      byStatus[service.health.status] = (byStatus[service.health.status] || 0) + 1;
      
      // Count enabled/disabled
      if (service.config.enabled) {
        enabled++;
      } else {
        disabled++;
      }
    }

    return {
      total: services.length,
      byType,
      byStatus,
      enabled,
      disabled
    };
  }

  /**
   * Bulk enable/disable services
   */
  async bulkUpdateEnabled(serviceIds: string[], enabled: boolean): Promise<void> {
    const updates = serviceIds.map(id => this.updateConfig(id, { enabled }));
    await Promise.all(updates);
  }

  /**
   * Setup service discovery
   */
  private async setupDiscovery(): Promise<void> {
    if (!this.discoveryProvider) return;

    try {
      // Watch for service changes
      this.discoveryProvider.watch((services) => {
        this.syncWithDiscovery(services);
      });

      // Initial discovery
      const discoveredServices = await this.discoveryProvider.discover();
      await this.syncWithDiscovery(discoveredServices);

      logger.info('Service discovery setup complete');
    } catch (error) {
      logger.error('Failed to setup service discovery:', error);
    }
  }

  /**
   * Sync with discovery provider
   */
  private async syncWithDiscovery(discoveredServices: ServiceRegistration[]): Promise<void> {
    try {
      const discoveredIds = new Set(discoveredServices.map(s => s.id));
      const currentIds = new Set(this.services.keys());

      // Add new services
      for (const service of discoveredServices) {
        if (!currentIds.has(service.id)) {
          this.services.set(service.id, service);
          logger.info(`Service discovered: ${service.id}`);
        }
      }

      // Remove services that are no longer discovered
      for (const id of currentIds) {
        if (!discoveredIds.has(id)) {
          await this.deregister(id);
        }
      }
    } catch (error) {
      logger.error('Failed to sync with service discovery:', error);
    }
  }

  /**
   * Notify event handlers
   */
  private async notifyEventHandlers(eventType: string, event: ServiceEvent): Promise<void> {
    const handlers = this.eventHandlers.get(eventType) || [];
    
    for (const handler of handlers) {
      try {
        await handler(event);
      } catch (error) {
        logger.error(`Event handler failed for ${eventType}:`, error);
      }
    }
  }
}

/**
 * Round Robin Load Balancing Strategy
 */
export class RoundRobinStrategy implements LoadBalancingStrategy {
  name = 'round_robin' as const;
  private currentIndex = 0;

  select<T>(services: T[]): T | null {
    if (services.length === 0) return null;
    
    const selected = services[this.currentIndex % services.length];
    this.currentIndex = (this.currentIndex + 1) % services.length;
    
    return selected;
  }
}

/**
 * Random Load Balancing Strategy
 */
export class RandomStrategy implements LoadBalancingStrategy {
  name = 'random' as const;

  select<T>(services: T[]): T | null {
    if (services.length === 0) return null;
    
    const randomIndex = Math.floor(Math.random() * services.length);
    return services[randomIndex];
  }
}

/**
 * Least Connections Load Balancing Strategy
 */
export class LeastConnectionsStrategy implements LoadBalancingStrategy {
  name = 'least_connections' as const;
  private connections: Map<string, number> = new Map();

  select<T extends { id: string }>(services: T[]): T | null {
    if (services.length === 0) return null;
    
    let leastConnections = Infinity;
    let selected: T | null = null;
    
    for (const service of services) {
      const connections = this.connections.get(service.id) || 0;
      if (connections < leastConnections) {
        leastConnections = connections;
        selected = service;
      }
    }
    
    if (selected) {
      this.connections.set(selected.id, leastConnections + 1);
    }
    
    return selected;
  }

  releaseConnection(serviceId: string): void {
    const current = this.connections.get(serviceId) || 0;
    this.connections.set(serviceId, Math.max(0, current - 1));
  }
}