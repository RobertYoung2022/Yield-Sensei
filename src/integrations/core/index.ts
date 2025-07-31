/**
 * Integration Core Index
 * Exports all core integration management components
 */

// Core types
export * from './types';

// Service Registry
export { ServiceRegistry, RoundRobinStrategy, RandomStrategy, LeastConnectionsStrategy } from './service-registry';

// Configuration Manager
export { ConfigManager } from './config-manager';

// Integration Factory
export { IntegrationFactory } from './integration-factory';

// Service Monitor
export { ServiceMonitor } from './service-monitor';

// Re-export common types for convenience
export type {
  ServiceMetadata,
  ServiceConfig,
  ServiceHealth,
  ServiceRegistration,
  ServiceFactory,
  ServiceMonitorConfig,
  ServiceMetrics,
  ServiceError,
  ConfigurationSchema,
  EnvironmentConfig,
  ServiceEvent,
  ServiceEventHandler,
  LoadBalancingStrategy,
  ServiceDiscoveryProvider,
  IntegrationContext
} from './types';