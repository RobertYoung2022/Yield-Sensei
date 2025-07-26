/**
 * Bridge Monitoring Service
 * Comprehensive monitoring orchestrator for bridge safety and performance
 */

import Logger from '../../../shared/logging/logger';
import { BridgeRiskAssessment } from './bridge-risk-assessment';
import { BridgeAnomalyDetection } from './anomaly-detection';
import { 
  BridgeSatelliteConfig, 
  BridgeMonitoringData, 
  BridgeAlert, 
  BridgeID,
  BridgeRiskAssessment as BridgeRiskAssessmentType
} from '../types';

const logger = Logger.getLogger('bridge-monitoring');

interface MonitoringMetrics {
  bridgeId: BridgeID;
  uptime: number;
  responseTime: number;
  errorRate: number;
  lastHealthCheck: number;
  consecutiveFailures: number;
}

interface BridgeEndpoint {
  bridgeId: BridgeID;
  name: string;
  url: string;
  type: 'api' | 'rpc' | 'graphql';
  timeout: number;
  retryAttempts: number;
}

export class BridgeMonitoringService {
  private config: BridgeSatelliteConfig;
  private riskAssessment: BridgeRiskAssessment;
  private anomalyDetection: BridgeAnomalyDetection;
  private isRunning = false;
  private monitoringInterval?: NodeJS.Timeout;
  private bridgeEndpoints = new Map<BridgeID, BridgeEndpoint[]>();
  private monitoringMetrics = new Map<BridgeID, MonitoringMetrics>();
  private alertSubscribers: ((alert: BridgeAlert) => void)[] = [];

  constructor(config: BridgeSatelliteConfig) {
    this.config = config;
    this.riskAssessment = new BridgeRiskAssessment(config);
    this.anomalyDetection = new BridgeAnomalyDetection({
      historyWindow: 100,
      checkInterval: 30000,
      alertCooldown: 300000
    });

    this.initializeBridgeEndpoints();
    logger.info('Bridge Monitoring Service created');
  }

  /**
   * Initialize the monitoring service
   */
  async initialize(): Promise<void> {
    logger.info('Initializing Bridge Monitoring Service...');
    
    await this.riskAssessment.initialize();
    this.anomalyDetection.start();
    
    // Initialize monitoring metrics for all bridges
    for (const bridge of this.config.bridges) {
      this.monitoringMetrics.set(bridge.id, {
        bridgeId: bridge.id,
        uptime: 100,
        responseTime: 0,
        errorRate: 0,
        lastHealthCheck: 0,
        consecutiveFailures: 0
      });
    }

    logger.info('Bridge Monitoring Service initialized successfully');
  }

  /**
   * Start monitoring all configured bridges
   */
  async start(): Promise<void> {
    if (this.isRunning) return;

    this.isRunning = true;
    
    await this.riskAssessment.start();
    
    // Start continuous monitoring
    this.monitoringInterval = setInterval(
      () => this.performMonitoringCycle(),
      this.config.monitoring.updateInterval
    );

    logger.info('Bridge Monitoring Service started');
  }

  /**
   * Stop the monitoring service
   */
  async stop(): Promise<void> {
    this.isRunning = false;

    await this.riskAssessment.stop();
    this.anomalyDetection.stop();

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }

    logger.info('Bridge Monitoring Service stopped');
  }

  /**
   * Get current monitoring status for all bridges
   */
  async getMonitoringStatus(): Promise<{
    isRunning: boolean;
    bridgeCount: number;
    totalAlerts: number;
    bridgeStatuses: Record<BridgeID, BridgeMonitoringData>;
    riskAssessments: Record<BridgeID, BridgeRiskAssessmentType>;
  }> {
    const bridgeStatuses: Record<BridgeID, BridgeMonitoringData> = {};
    const riskAssessments: Record<BridgeID, BridgeRiskAssessmentType> = {};
    let totalAlerts = 0;

    for (const bridge of this.config.bridges) {
      try {
        const status = await this.riskAssessment.getBridgeStatus(bridge.id);
        const assessment = await this.riskAssessment.getBridgeRiskAssessment(bridge.id);
        
        bridgeStatuses[bridge.id] = status;
        riskAssessments[bridge.id] = assessment;
        totalAlerts += status.alerts.length;
      } catch (error) {
        logger.error(`Error getting status for bridge ${bridge.id}:`, error);
      }
    }

    return {
      isRunning: this.isRunning,
      bridgeCount: this.config.bridges.length,
      totalAlerts,
      bridgeStatuses,
      riskAssessments
    };
  }

  /**
   * Get detailed monitoring data for a specific bridge
   */
  async getBridgeDetails(bridgeId: BridgeID): Promise<{
    monitoring: BridgeMonitoringData;
    riskAssessment: BridgeRiskAssessmentType;
    metrics: MonitoringMetrics;
    endpoints: BridgeEndpoint[];
  }> {
    const monitoring = await this.riskAssessment.getBridgeStatus(bridgeId);
    const riskAssessment = await this.riskAssessment.getBridgeRiskAssessment(bridgeId);
    const metrics = this.monitoringMetrics.get(bridgeId);
    const endpoints = this.bridgeEndpoints.get(bridgeId) || [];

    if (!metrics) {
      throw new Error(`Monitoring metrics not found for bridge ${bridgeId}`);
    }

    return {
      monitoring,
      riskAssessment,
      metrics,
      endpoints
    };
  }

  /**
   * Subscribe to bridge alerts
   */
  subscribeToAlerts(callback: (alert: BridgeAlert) => void): void {
    this.alertSubscribers.push(callback);
  }

  /**
   * Unsubscribe from bridge alerts
   */
  unsubscribeFromAlerts(callback: (alert: BridgeAlert) => void): void {
    const index = this.alertSubscribers.indexOf(callback);
    if (index !== -1) {
      this.alertSubscribers.splice(index, 1);
    }
  }

  /**
   * Manually trigger a health check for a specific bridge
   */
  async performHealthCheck(bridgeId: BridgeID): Promise<{
    success: boolean;
    responseTime: number;
    errors: string[];
  }> {
    const startTime = Date.now();
    const errors: string[] = [];
    let success = true;

    try {
      const endpoints = this.bridgeEndpoints.get(bridgeId) || [];
      
      for (const endpoint of endpoints) {
        try {
          await this.checkEndpoint(endpoint);
        } catch (error) {
          success = false;
          errors.push(`${endpoint.name}: ${error}`);
        }
      }

      const responseTime = Date.now() - startTime;
      
      // Update metrics
      const metrics = this.monitoringMetrics.get(bridgeId);
      if (metrics) {
        metrics.lastHealthCheck = Date.now();
        metrics.responseTime = responseTime;
        metrics.consecutiveFailures = success ? 0 : metrics.consecutiveFailures + 1;
        metrics.errorRate = (metrics.errorRate * 0.9) + (success ? 0 : 0.1); // Exponential moving average
        
        // Update uptime (simple exponential moving average)
        const uptimeWeight = success ? 1 : 0;
        metrics.uptime = (metrics.uptime * 0.99) + (uptimeWeight * 0.01);
      }

      logger.debug(`Health check completed for bridge ${bridgeId}:`, {
        success,
        responseTime,
        errors: errors.length
      });

      return { success, responseTime, errors };
    } catch (error) {
      logger.error(`Health check failed for bridge ${bridgeId}:`, error);
      return {
        success: false,
        responseTime: Date.now() - startTime,
        errors: [`Health check error: ${error}`]
      };
    }
  }

  /**
   * Record a bridge incident manually
   */
  async recordIncident(incident: {
    bridgeId: BridgeID;
    type: 'exploit' | 'bug' | 'downtime' | 'governance';
    severity: 'low' | 'medium' | 'high' | 'critical';
    amount: number;
    description: string;
  }): Promise<void> {
    await this.riskAssessment.recordIncident({
      ...incident,
      timestamp: Date.now(),
      resolved: false
    });

    // Create immediate alert
    const alert: BridgeAlert = {
      id: `incident_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      bridgeId: incident.bridgeId,
      type: 'security_incident',
      severity: incident.severity,
      message: `Bridge incident recorded: ${incident.description}`,
      timestamp: Date.now(),
      acknowledged: false
    };

    this.notifySubscribers(alert);
  }

  /**
   * Update security audit information
   */
  async updateSecurityAudit(bridgeId: BridgeID, audit: {
    auditorName: string;
    auditDate: number;
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    findings: string[];
    score: number;
  }): Promise<void> {
    await this.riskAssessment.updateSecurityAudit(bridgeId, audit);
  }

  /**
   * Get anomaly detection statistics
   */
  getAnomalyStats(): {
    totalPatterns: number;
    activeMonitoring: number;
    totalAlerts: number;
    avgHistorySize: number;
  } {
    return this.anomalyDetection.getDetectionStats();
  }

  private async performMonitoringCycle(): Promise<void> {
    if (!this.isRunning) return;

    try {
      const promises = this.config.bridges.map(bridge => 
        this.monitorBridge(bridge.id)
      );

      await Promise.allSettled(promises);
      
      logger.debug('Monitoring cycle completed');
    } catch (error) {
      logger.error('Error during monitoring cycle:', error);
    }
  }

  private async monitorBridge(bridgeId: BridgeID): Promise<void> {
    try {
      // Perform health check
      const healthCheck = await this.performHealthCheck(bridgeId);
      
      // Get current monitoring data
      const monitoringData = await this.riskAssessment.getBridgeStatus(bridgeId);
      
      // Check for anomalies
      const anomalies = await this.anomalyDetection.processMonitoringData(monitoringData);
      
      // Notify subscribers of any new alerts
      for (const alert of [...monitoringData.alerts, ...anomalies]) {
        this.notifySubscribers(alert);
      }

      // Log critical issues
      if (!healthCheck.success || anomalies.some(a => a.severity === 'critical')) {
        logger.warn(`Critical issues detected for bridge ${bridgeId}:`, {
          healthCheckPassed: healthCheck.success,
          criticalAnomalies: anomalies.filter(a => a.severity === 'critical').length,
          totalAlerts: monitoringData.alerts.length
        });
      }
    } catch (error) {
      logger.error(`Error monitoring bridge ${bridgeId}:`, error);
    }
  }

  private async checkEndpoint(endpoint: BridgeEndpoint): Promise<void> {
    // Simulate endpoint check - in production, this would make actual HTTP requests
    const delay = Math.random() * 1000; // 0-1 second simulated response time
    
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        // Simulate occasional failures
        if (Math.random() < 0.05) { // 5% failure rate
          reject(new Error(`Endpoint ${endpoint.name} unreachable`));
        } else {
          resolve();
        }
      }, delay);
    });
  }

  private initializeBridgeEndpoints(): void {
    // Initialize with example endpoints for known bridges
    const endpointConfigs: Record<string, BridgeEndpoint[]> = {
      'polygon-pos': [
        {
          bridgeId: 'polygon-pos',
          name: 'Polygon PoS API',
          url: 'https://api.polygon.technology/bridge',
          type: 'api',
          timeout: 10000,
          retryAttempts: 3
        }
      ],
      'arbitrum-one': [
        {
          bridgeId: 'arbitrum-one',
          name: 'Arbitrum Bridge API',
          url: 'https://api.arbitrum.io/bridge',
          type: 'api',
          timeout: 10000,
          retryAttempts: 3
        }
      ]
    };

    for (const [bridgeId, endpoints] of Object.entries(endpointConfigs)) {
      if (this.config.bridges.find(b => b.id === bridgeId)) {
        this.bridgeEndpoints.set(bridgeId, endpoints);
      }
    }
  }

  private notifySubscribers(alert: BridgeAlert): void {
    for (const subscriber of this.alertSubscribers) {
      try {
        subscriber(alert);
      } catch (error) {
        logger.error('Error notifying alert subscriber:', error);
      }
    }
  }

  /**
   * Update configuration
   */
  updateConfig(config: BridgeSatelliteConfig): void {
    this.config = config;
    this.riskAssessment.updateConfig(config);
    
    // Re-initialize endpoints and metrics for new bridges
    this.initializeBridgeEndpoints();
    
    for (const bridge of config.bridges) {
      if (!this.monitoringMetrics.has(bridge.id)) {
        this.monitoringMetrics.set(bridge.id, {
          bridgeId: bridge.id,
          uptime: 100,
          responseTime: 0,
          errorRate: 0,
          lastHealthCheck: 0,
          consecutiveFailures: 0
        });
      }
    }

    logger.info('Bridge monitoring configuration updated');
  }
}