/**
 * Service Monitor
 * Real-time monitoring and health checking for all registered services
 */

import { EventEmitter } from 'events';
import Logger from '@/shared/logging/logger';
import { ServiceRegistry } from './service-registry';
import { ConfigManager } from './config-manager';
import {
  ServiceHealth,
  ServiceMetrics,
  ServiceError,
  ServiceMonitorConfig,
  ServiceEvent,
  ServiceRegistration
} from './types';

const logger = Logger.getLogger('service-monitor');

export class ServiceMonitor extends EventEmitter {
  private serviceRegistry: ServiceRegistry;
  private configManager: ConfigManager;
  private config: ServiceMonitorConfig;
  private metrics: Map<string, ServiceMetrics> = new Map();
  private healthCheckIntervals: Map<string, NodeJS.Timer> = new Map();
  private isRunning = false;
  private lastCleanup = Date.now();

  constructor(serviceRegistry: ServiceRegistry, configManager: ConfigManager) {
    super();
    this.serviceRegistry = serviceRegistry;
    this.configManager = configManager;
    this.config = configManager.getMonitoringConfig();

    // Listen for configuration changes
    this.configManager.on('monitoring_config_updated', (newConfig) => {
      this.updateConfig(newConfig);
    });

    // Listen for service registry events
    this.serviceRegistry.on('service_registered', (event: ServiceEvent) => {
      this.onServiceRegistered(event);
    });

    this.serviceRegistry.on('service_deregistered', (event: ServiceEvent) => {
      this.onServiceDeregistered(event);
    });
  }

  /**
   * Start monitoring services
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Service monitor is already running');
      return;
    }

    try {
      logger.info('Starting service monitor...');

      // Initialize metrics for existing services
      const services = this.serviceRegistry.getAllServices();
      for (const service of services) {
        this.initializeServiceMetrics(service.id);
        this.startHealthChecking(service.id);
      }

      // Start cleanup task
      this.startCleanupTask();

      this.isRunning = true;
      this.emit('monitor_started');

      logger.info(`Service monitor started - monitoring ${services.length} services`);
    } catch (error) {
      logger.error('Failed to start service monitor:', error);
      throw error;
    }
  }

  /**
   * Stop monitoring services
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    try {
      logger.info('Stopping service monitor...');

      // Stop all health check intervals
      for (const [serviceId, interval] of this.healthCheckIntervals) {
        clearInterval(interval);
      }
      this.healthCheckIntervals.clear();

      this.isRunning = false;
      this.emit('monitor_stopped');

      logger.info('Service monitor stopped');
    } catch (error) {
      logger.error('Failed to stop service monitor:', error);
      throw error;
    }
  }

  /**
   * Get service metrics
   */
  getServiceMetrics(serviceId: string): ServiceMetrics | undefined {
    return this.metrics.get(serviceId);
  }

  /**
   * Get all service metrics
   */
  getAllMetrics(): Map<string, ServiceMetrics> {
    return new Map(this.metrics);
  }

  /**
   * Record successful request
   */
  recordSuccess(serviceId: string, responseTime: number): void {
    const metrics = this.getOrCreateMetrics(serviceId);
    
    metrics.totalRequests++;
    metrics.successfulRequests++;
    metrics.lastRequestAt = new Date();
    
    // Update average response time
    metrics.averageResponseTime = 
      (metrics.averageResponseTime * (metrics.totalRequests - 1) + responseTime) / metrics.totalRequests;

    this.checkAlerts(serviceId, metrics);
  }

  /**
   * Record failed request
   */
  recordFailure(serviceId: string, error: string, context?: Record<string, any>): void {
    const metrics = this.getOrCreateMetrics(serviceId);
    
    metrics.totalRequests++;
    metrics.failedRequests++;
    metrics.lastRequestAt = new Date();

    // Add error to log
    const serviceError: ServiceError = {
      timestamp: new Date(),
      error,
      context,
      severity: this.determineSeverity(error)
    };

    metrics.errorLog.push(serviceError);

    // Keep only recent errors
    const cutoffTime = Date.now() - this.config.retentionPeriod;
    metrics.errorLog = metrics.errorLog.filter(err => err.timestamp.getTime() > cutoffTime);

    this.checkAlerts(serviceId, metrics);
    this.emit('service_error', { serviceId, error: serviceError });
  }

  /**
   * Record rate limit hit
   */
  recordRateLimit(serviceId: string): void {
    const metrics = this.getOrCreateMetrics(serviceId);
    metrics.rateLimitHits++;
    
    logger.warn(`Rate limit hit for service: ${serviceId}`, {
      totalHits: metrics.rateLimitHits
    });
  }

  /**
   * Record cache hit/miss
   */
  recordCacheEvent(serviceId: string, hit: boolean): void {
    const metrics = this.getOrCreateMetrics(serviceId);
    
    if (hit) {
      metrics.cacheHitRate = (metrics.cacheHitRate * metrics.totalRequests + 1) / (metrics.totalRequests + 1);
    } else {
      metrics.cacheHitRate = (metrics.cacheHitRate * metrics.totalRequests) / (metrics.totalRequests + 1);
    }
  }

  /**
   * Force health check for a service
   */
  async checkServiceHealth(serviceId: string): Promise<ServiceHealth> {
    const service = this.serviceRegistry.getService(serviceId);
    if (!service) {
      throw new Error(`Service not found: ${serviceId}`);
    }

    const startTime = Date.now();
    let health: ServiceHealth = {
      status: 'unknown',
      lastCheck: new Date()
    };

    try {
      // Check if service has health check method
      if (service.instance && typeof service.instance.healthCheck === 'function') {
        const isHealthy = await Promise.race([
          service.instance.healthCheck(),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Health check timeout')), this.config.healthCheckTimeout)
          )
        ]);

        health = {
          status: isHealthy ? 'healthy' : 'unhealthy',
          lastCheck: new Date(),
          responseTime: Date.now() - startTime
        };
      } else {
        // Basic health check - service exists and is enabled
        health = {
          status: service.config.enabled ? 'healthy' : 'unhealthy',
          lastCheck: new Date(),
          responseTime: Date.now() - startTime
        };
      }

      // Calculate uptime
      const metrics = this.metrics.get(serviceId);
      if (metrics) {
        const totalChecks = metrics.totalRequests || 1;
        const successfulChecks = metrics.successfulRequests || (health.status === 'healthy' ? 1 : 0);
        health.uptime = successfulChecks / totalChecks;
        health.errorRate = metrics.failedRequests / totalChecks;
      }

    } catch (error) {
      logger.warn(`Health check failed for service ${serviceId}:`, error);
      
      health = {
        status: 'unhealthy',
        lastCheck: new Date(),
        responseTime: Date.now() - startTime,
        lastError: error instanceof Error ? error.message : String(error)
      };
    }

    // Update service health in registry
    await this.serviceRegistry.updateHealth(serviceId, health);

    return health;
  }

  /**
   * Get monitoring dashboard data
   */
  getDashboardData(): {
    summary: {
      totalServices: number;
      healthyServices: number;
      unhealthyServices: number;
      averageResponseTime: number;
      totalRequests: number;
      errorRate: number;
    };
    services: Array<{
      id: string;
      name: string;
      type: string;
      status: string;
      uptime: number;
      responseTime: number;
      requests: number;
      errors: number;
    }>;
    alerts: ServiceError[];
  } {
    const services = this.serviceRegistry.getAllServices();
    const allMetrics = Array.from(this.metrics.values());

    // Calculate summary
    const totalRequests = allMetrics.reduce((sum, m) => sum + m.totalRequests, 0);
    const totalErrors = allMetrics.reduce((sum, m) => sum + m.failedRequests, 0);
    const averageResponseTime = allMetrics.reduce((sum, m) => sum + m.averageResponseTime, 0) / allMetrics.length || 0;

    const summary = {
      totalServices: services.length,
      healthyServices: services.filter(s => s.health.status === 'healthy').length,
      unhealthyServices: services.filter(s => s.health.status === 'unhealthy').length,
      averageResponseTime,
      totalRequests,
      errorRate: totalRequests > 0 ? totalErrors / totalRequests : 0
    };

    // Prepare service data
    const serviceData = services.map(service => {
      const metrics = this.metrics.get(service.id);
      return {
        id: service.id,
        name: service.metadata.name,
        type: service.metadata.type,
        status: service.health.status,
        uptime: service.health.uptime || 0,
        responseTime: service.health.responseTime || 0,
        requests: metrics?.totalRequests || 0,
        errors: metrics?.failedRequests || 0
      };
    });

    // Collect recent critical alerts
    const alerts: ServiceError[] = [];
    for (const metrics of allMetrics) {
      alerts.push(...metrics.errorLog.filter(err => 
        err.severity === 'critical' && 
        Date.now() - err.timestamp.getTime() < 3600000 // Last hour
      ));
    }

    return {
      summary,
      services: serviceData,
      alerts: alerts.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()).slice(0, 10)
    };
  }

  /**
   * Update monitoring configuration
   */
  private updateConfig(newConfig: ServiceMonitorConfig): void {
    logger.info('Updating service monitor configuration', newConfig);
    
    this.config = newConfig;

    // Restart health checks with new intervals
    if (this.isRunning) {
      this.restartHealthChecks();
    }
  }

  /**
   * Handle service registration
   */
  private onServiceRegistered(event: ServiceEvent): void {
    const serviceId = event.serviceId;
    logger.debug(`Initializing monitoring for service: ${serviceId}`);
    
    this.initializeServiceMetrics(serviceId);
    
    if (this.isRunning) {
      this.startHealthChecking(serviceId);
    }
  }

  /**
   * Handle service deregistration
   */
  private onServiceDeregistered(event: ServiceEvent): void {
    const serviceId = event.serviceId;
    logger.debug(`Stopping monitoring for service: ${serviceId}`);
    
    // Stop health checking
    const interval = this.healthCheckIntervals.get(serviceId);
    if (interval) {
      clearInterval(interval);
      this.healthCheckIntervals.delete(serviceId);
    }

    // Keep metrics for a while (cleanup task will remove them later)
  }

  /**
   * Initialize metrics for a service
   */
  private initializeServiceMetrics(serviceId: string): void {
    if (!this.metrics.has(serviceId)) {
      this.metrics.set(serviceId, {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        averageResponseTime: 0,
        rateLimitHits: 0,
        cacheHitRate: 0,
        errorLog: []
      });
    }
  }

  /**
   * Start health checking for a service
   */
  private startHealthChecking(serviceId: string): void {
    if (this.healthCheckIntervals.has(serviceId)) {
      return;
    }

    const interval = setInterval(async () => {
      try {
        await this.checkServiceHealth(serviceId);
      } catch (error) {
        logger.error(`Failed to check health for service ${serviceId}:`, error);
      }
    }, this.config.healthCheckInterval);

    this.healthCheckIntervals.set(serviceId, interval);
    
    // Perform initial health check
    setImmediate(() => this.checkServiceHealth(serviceId));
  }

  /**
   * Restart all health checks
   */
  private restartHealthChecks(): void {
    // Stop all existing intervals
    for (const [serviceId, interval] of this.healthCheckIntervals) {
      clearInterval(interval);
    }
    this.healthCheckIntervals.clear();

    // Start new intervals
    const services = this.serviceRegistry.getAllServices();
    for (const service of services) {
      this.startHealthChecking(service.id);
    }
  }

  /**
   * Get or create metrics for a service
   */
  private getOrCreateMetrics(serviceId: string): ServiceMetrics {
    let metrics = this.metrics.get(serviceId);
    if (!metrics) {
      this.initializeServiceMetrics(serviceId);
      metrics = this.metrics.get(serviceId)!;
    }
    return metrics;
  }

  /**
   * Check alert thresholds
   */
  private checkAlerts(serviceId: string, metrics: ServiceMetrics): void {
    const service = this.serviceRegistry.getService(serviceId);
    if (!service) return;

    const errorRate = metrics.totalRequests > 0 ? metrics.failedRequests / metrics.totalRequests : 0;
    const uptime = service.health.uptime || 0;
    const responseTime = metrics.averageResponseTime;

    // Check error rate threshold
    if (errorRate > this.config.alertThresholds.errorRate) {
      this.emit('alert', {
        type: 'high_error_rate',
        serviceId,
        value: errorRate,
        threshold: this.config.alertThresholds.errorRate,
        timestamp: new Date()
      });
    }

    // Check response time threshold
    if (responseTime > this.config.alertThresholds.responseTime) {
      this.emit('alert', {
        type: 'slow_response',
        serviceId,
        value: responseTime,
        threshold: this.config.alertThresholds.responseTime,
        timestamp: new Date()
      });
    }

    // Check uptime threshold
    if (uptime < this.config.alertThresholds.uptime) {
      this.emit('alert', {
        type: 'low_uptime',
        serviceId,
        value: uptime,
        threshold: this.config.alertThresholds.uptime,
        timestamp: new Date()
      });
    }
  }

  /**
   * Determine error severity
   */
  private determineSeverity(error: string): ServiceError['severity'] {
    const lowerError = error.toLowerCase();
    
    if (lowerError.includes('timeout') || lowerError.includes('network')) {
      return 'medium';
    }
    
    if (lowerError.includes('unauthorized') || lowerError.includes('forbidden')) {
      return 'high';
    }
    
    if (lowerError.includes('rate limit')) {
      return 'low';
    }
    
    if (lowerError.includes('server error') || lowerError.includes('internal error')) {
      return 'critical';
    }
    
    return 'medium';
  }

  /**
   * Start cleanup task
   */
  private startCleanupTask(): void {
    const cleanupInterval = setInterval(() => {
      this.performCleanup();
    }, 3600000); // Run every hour

    // Store the interval so we can clear it when stopping
    (this as any).cleanupInterval = cleanupInterval;
  }

  /**
   * Perform cleanup of old data
   */
  private performCleanup(): void {
    const now = Date.now();
    const cutoffTime = now - this.config.retentionPeriod;

    logger.debug('Performing service monitor cleanup');

    // Clean up metrics for deregistered services
    const activeServiceIds = new Set(this.serviceRegistry.getAllServices().map(s => s.id));
    
    for (const [serviceId, metrics] of this.metrics) {
      if (!activeServiceIds.has(serviceId)) {
        // Service was deregistered - check if enough time has passed
        if (now - this.lastCleanup > this.config.retentionPeriod) {
          this.metrics.delete(serviceId);
          logger.debug(`Cleaned up metrics for deregistered service: ${serviceId}`);
        }
      } else {
        // Clean up old error logs
        const originalLength = metrics.errorLog.length;
        metrics.errorLog = metrics.errorLog.filter(err => err.timestamp.getTime() > cutoffTime);
        
        if (metrics.errorLog.length < originalLength) {
          logger.debug(`Cleaned up ${originalLength - metrics.errorLog.length} old errors for service: ${serviceId}`);
        }
      }
    }

    this.lastCleanup = now;
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    await this.stop();
    
    // Clear cleanup interval
    if ((this as any).cleanupInterval) {
      clearInterval((this as any).cleanupInterval);
    }
    
    this.metrics.clear();
    this.removeAllListeners();
    
    logger.info('Service monitor cleanup complete');
  }
}