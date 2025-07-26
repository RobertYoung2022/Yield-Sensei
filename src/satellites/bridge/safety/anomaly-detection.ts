/**
 * Bridge Anomaly Detection Service
 * Real-time monitoring and detection of anomalous bridge behavior
 */

import Logger from '../../../shared/logging/logger';
import { BridgeID, BridgeMonitoringData, BridgeAlert } from '../types';

const logger = Logger.getLogger('bridge-anomaly');

interface AnomalyPattern {
  id: string;
  name: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  checkFunction: (current: BridgeMonitoringData, history: BridgeMonitoringData[]) => boolean;
  threshold: number;
  consecutiveOccurrences: number;
}

interface AnomalyDetectionConfig {
  historyWindow: number; // Number of data points to keep
  checkInterval: number; // Milliseconds between checks
  alertCooldown: number; // Milliseconds to wait before re-alerting
}

export class BridgeAnomalyDetection {
  private config: AnomalyDetectionConfig;
  private patterns: AnomalyPattern[];
  private monitoringHistory = new Map<BridgeID, BridgeMonitoringData[]>();
  private alertHistory = new Map<string, number>(); // alertId -> lastAlertTime
  private consecutiveDetections = new Map<string, number>(); // patternId:bridgeId -> count
  private isRunning = false;
  private detectionInterval?: NodeJS.Timeout;

  constructor(config: Partial<AnomalyDetectionConfig> = {}) {
    this.config = {
      historyWindow: 100,
      checkInterval: 30000, // 30 seconds
      alertCooldown: 300000, // 5 minutes
      ...config
    };

    this.patterns = this.initializeAnomalyPatterns();
    logger.info('Bridge Anomaly Detection initialized');
  }

  /**
   * Start anomaly detection monitoring
   */
  start(): void {
    if (this.isRunning) return;

    this.isRunning = true;
    this.detectionInterval = setInterval(
      () => this.performAnomalyCheck(),
      this.config.checkInterval
    );

    logger.info('Bridge anomaly detection started');
  }

  /**
   * Stop anomaly detection monitoring
   */
  stop(): void {
    this.isRunning = false;

    if (this.detectionInterval) {
      clearInterval(this.detectionInterval);
      this.detectionInterval = undefined;
    }

    logger.info('Bridge anomaly detection stopped');
  }

  /**
   * Process new monitoring data and check for anomalies
   */
  async processMonitoringData(data: BridgeMonitoringData): Promise<BridgeAlert[]> {
    // Store monitoring data
    const history = this.monitoringHistory.get(data.bridgeId) || [];
    history.push(data);

    // Keep only recent data within the window
    if (history.length > this.config.historyWindow) {
      history.splice(0, history.length - this.config.historyWindow);
    }

    this.monitoringHistory.set(data.bridgeId, history);

    // Check for anomalies
    const alerts = await this.checkAnomalies(data, history);

    if (alerts.length > 0) {
      logger.warn(`Detected ${alerts.length} anomalies for bridge ${data.bridgeId}`);
    }

    return alerts;
  }

  /**
   * Get current anomaly detection statistics
   */
  getDetectionStats(): {
    totalPatterns: number;
    activeMonitoring: number;
    totalAlerts: number;
    avgHistorySize: number;
  } {
    const historySize = Array.from(this.monitoringHistory.values())
      .reduce((sum, history) => sum + history.length, 0);

    return {
      totalPatterns: this.patterns.length,
      activeMonitoring: this.monitoringHistory.size,
      totalAlerts: this.alertHistory.size,
      avgHistorySize: this.monitoringHistory.size > 0 
        ? Math.round(historySize / this.monitoringHistory.size) 
        : 0
    };
  }

  /**
   * Add a custom anomaly pattern
   */
  addCustomPattern(pattern: AnomalyPattern): void {
    this.patterns.push(pattern);
    logger.info(`Added custom anomaly pattern: ${pattern.name}`);
  }

  /**
   * Clear monitoring history for a bridge
   */
  clearHistory(bridgeId: BridgeID): void {
    this.monitoringHistory.delete(bridgeId);
    
    // Clear consecutive detection counters
    for (const key of this.consecutiveDetections.keys()) {
      if (key.endsWith(`:${bridgeId}`)) {
        this.consecutiveDetections.delete(key);
      }
    }

    logger.info(`Cleared monitoring history for bridge ${bridgeId}`);
  }

  private initializeAnomalyPatterns(): AnomalyPattern[] {
    return [
      // TVL Drop Pattern
      {
        id: 'tvl_sudden_drop',
        name: 'Sudden TVL Drop',
        description: 'Total Value Locked dropped significantly',
        severity: 'critical',
        threshold: 0.2, // 20% drop
        consecutiveOccurrences: 1,
        checkFunction: (current, history) => {
          if (history.length < 2) return false;
          const previous = history[history.length - 2];
          const dropRatio = (previous.currentTVL - current.currentTVL) / previous.currentTVL;
          return dropRatio > 0.2;
        }
      },

      // Volume Spike Pattern
      {
        id: 'volume_unusual_spike',
        name: 'Unusual Volume Spike',
        description: 'Daily volume increased dramatically',
        severity: 'medium',
        threshold: 5.0, // 5x increase
        consecutiveOccurrences: 1,
        checkFunction: (current, history) => {
          if (history.length < 10) return false;
          
          // Calculate average of last 10 data points (excluding current)
          const recentHistory = history.slice(-10);
          const avgVolume = recentHistory.reduce((sum, data) => sum + data.dailyVolume, 0) / recentHistory.length;
          
          return current.dailyVolume > avgVolume * 5;
        }
      },

      // Processing Time Degradation
      {
        id: 'processing_time_degradation',
        name: 'Processing Time Degradation',
        description: 'Average processing time increased significantly',
        severity: 'high',
        threshold: 2.0, // 2x slower
        consecutiveOccurrences: 3,
        checkFunction: (current, history) => {
          if (history.length < 20) return false;
          
          // Compare current with baseline from 20 data points ago
          const baseline = history.slice(-20, -10);
          const avgBaseline = baseline.reduce((sum, data) => sum + data.avgProcessingTime, 0) / baseline.length;
          
          return current.avgProcessingTime > avgBaseline * 2;
        }
      },

      // Queue Congestion
      {
        id: 'queue_congestion',
        name: 'Queue Congestion',
        description: 'Transaction queue length is unusually high',
        severity: 'medium',
        threshold: 50, // 50 transactions in queue
        consecutiveOccurrences: 2,
        checkFunction: (current, _history) => {
          return current.queueLength > 50;
        }
      },

      // Fee Rate Anomaly
      {
        id: 'fee_rate_spike',
        name: 'Fee Rate Spike',
        description: 'Bridge fee rate increased significantly',
        severity: 'medium',
        threshold: 3.0, // 3x increase
        consecutiveOccurrences: 2,
        checkFunction: (current, history) => {
          if (history.length < 5) return false;
          
          const recentAvg = history.slice(-5).reduce((sum, data) => sum + data.feeRate, 0) / 5;
          return current.feeRate > recentAvg * 3;
        }
      },

      // Bridge Offline Detection
      {
        id: 'bridge_offline',
        name: 'Bridge Offline',
        description: 'Bridge appears to be non-operational',
        severity: 'critical',
        threshold: 1,
        consecutiveOccurrences: 1,
        checkFunction: (current, _history) => {
          return !current.isOperational;
        }
      },

      // Transaction Activity Halt
      {
        id: 'transaction_halt',
        name: 'Transaction Activity Halt',
        description: 'No recent transactions detected',
        severity: 'high',
        threshold: 3600000, // 1 hour
        consecutiveOccurrences: 2,
        checkFunction: (current, _history) => {
          const timeSinceLastTx = Date.now() - current.lastTransaction;
          return timeSinceLastTx > 3600000; // 1 hour
        }
      },

      // Liquidity Drain Pattern
      {
        id: 'liquidity_drain',
        name: 'Liquidity Drain Pattern',
        description: 'Consistent decrease in TVL over time',
        severity: 'high',
        threshold: 0.1, // 10% decrease over period
        consecutiveOccurrences: 5,
        checkFunction: (current, history) => {
          if (history.length < 10) return false;
          
          const startTVL = history[history.length - 10].currentTVL;
          const decreaseRatio = (startTVL - current.currentTVL) / startTVL;
          
          return decreaseRatio > 0.1;
        }
      },

      // Critical Alert Accumulation
      {
        id: 'critical_alert_accumulation',
        name: 'Critical Alert Accumulation',
        description: 'Multiple critical alerts detected',
        severity: 'critical',
        threshold: 3, // 3 critical alerts
        consecutiveOccurrences: 1,
        checkFunction: (current, _history) => {
          const criticalAlerts = current.alerts.filter(alert => alert.severity === 'critical');
          return criticalAlerts.length >= 3;
        }
      }
    ];
  }

  private async checkAnomalies(current: BridgeMonitoringData, history: BridgeMonitoringData[]): Promise<BridgeAlert[]> {
    const alerts: BridgeAlert[] = [];

    for (const pattern of this.patterns) {
      const detectionKey = `${pattern.id}:${current.bridgeId}`;
      
      try {
        const isAnomalous = pattern.checkFunction(current, history);
        
        if (isAnomalous) {
          // Increment consecutive detection counter
          const currentCount = this.consecutiveDetections.get(detectionKey) || 0;
          this.consecutiveDetections.set(detectionKey, currentCount + 1);
          
          // Check if we've reached the required consecutive occurrences
          if (currentCount + 1 >= pattern.consecutiveOccurrences) {
            const alertId = `anomaly_${pattern.id}_${current.bridgeId}`;
            const lastAlertTime = this.alertHistory.get(alertId) || 0;
            
            // Check cooldown period
            if (Date.now() - lastAlertTime > this.config.alertCooldown) {
              const alert: BridgeAlert = {
                id: alertId,
                bridgeId: current.bridgeId,
                type: this.getAlertType(pattern.id),
                severity: pattern.severity,
                message: `Anomaly detected: ${pattern.description}`,
                timestamp: Date.now(),
                acknowledged: false
              };
              
              alerts.push(alert);
              this.alertHistory.set(alertId, Date.now());
              
              logger.warn(`Anomaly detected for bridge ${current.bridgeId}:`, {
                pattern: pattern.name,
                severity: pattern.severity,
                consecutiveCount: currentCount + 1
              });
            }
          }
        } else {
          // Reset consecutive counter if pattern not detected
          this.consecutiveDetections.set(detectionKey, 0);
        }
      } catch (error) {
        logger.error(`Error checking anomaly pattern ${pattern.id}:`, error);
      }
    }

    return alerts;
  }

  private getAlertType(patternId: string): BridgeAlert['type'] {
    const typeMap: Record<string, BridgeAlert['type']> = {
      'tvl_sudden_drop': 'low_liquidity',
      'volume_unusual_spike': 'security_incident',
      'processing_time_degradation': 'long_delays',
      'queue_congestion': 'long_delays',
      'fee_rate_spike': 'high_fees',
      'bridge_offline': 'maintenance',
      'transaction_halt': 'security_incident',
      'liquidity_drain': 'low_liquidity',
      'critical_alert_accumulation': 'security_incident'
    };
    
    return typeMap[patternId] || 'security_incident';
  }

  private async performAnomalyCheck(): Promise<void> {
    if (!this.isRunning) return;

    try {
      // This would be called by the main monitoring system
      // For now, it's a placeholder for periodic maintenance
      
      // Clean up old alert history (older than 24 hours)
      const cutoffTime = Date.now() - (24 * 60 * 60 * 1000);
      for (const [alertId, timestamp] of this.alertHistory.entries()) {
        if (timestamp < cutoffTime) {
          this.alertHistory.delete(alertId);
        }
      }
      
      logger.debug('Anomaly detection periodic check completed');
    } catch (error) {
      logger.error('Error during periodic anomaly check:', error);
    }
  }
}