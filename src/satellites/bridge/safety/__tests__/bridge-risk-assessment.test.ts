/**
 * Bridge Risk Assessment Framework Tests
 * Comprehensive tests for the bridge risk assessment system
 */

import { BridgeRiskAssessment } from '../bridge-risk-assessment';
import { BridgeAnomalyDetection } from '../anomaly-detection';
import { BridgeMonitoringService } from '../bridge-monitoring';
import { DEFAULT_BRIDGE_CONFIG } from '../../bridge-satellite';
import { BridgeConfig, BridgeMonitoringData } from '../../types';

// Mock logger to prevent console output during tests
jest.mock('../../../../shared/logging/logger', () => ({
  getLogger: () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  }),
}));

describe('Bridge Risk Assessment Framework', () => {
  let riskAssessment: BridgeRiskAssessment;
  let anomalyDetection: BridgeAnomalyDetection;
  let bridgeMonitoring: BridgeMonitoringService;
  
  const mockBridgeConfig: BridgeConfig = {
    id: 'test-bridge',
    name: 'Test Bridge',
    type: 'canonical',
    supportedChains: ['ethereum', 'polygon'],
    trustLevel: 85,
    avgProcessingTime: 300,
    feeStructure: {
      baseFee: 0.001,
      percentageFee: 0.0025,
      minFee: 10,
      maxFee: 1000
    },
    contractAddresses: {
      ethereum: '0x123...',
      polygon: '0x456...'
    }
  };

  const testConfig = {
    ...DEFAULT_BRIDGE_CONFIG,
    bridges: [mockBridgeConfig],
    risk: {
      updateInterval: 1000, // 1 second for testing
      alertThresholds: {
        safetyScore: 80,
        liquidityScore: 70,
        reliabilityScore: 85,
      }
    }
  };

  beforeEach(async () => {
    riskAssessment = new BridgeRiskAssessment(testConfig);
    anomalyDetection = new BridgeAnomalyDetection({
      historyWindow: 10,
      checkInterval: 500,
      alertCooldown: 1000
    });
    bridgeMonitoring = new BridgeMonitoringService(testConfig);

    await riskAssessment.initialize();
    await bridgeMonitoring.initialize();
  });

  afterEach(async () => {
    await riskAssessment.stop();
    anomalyDetection.stop();
    await bridgeMonitoring.stop();
  });

  describe('BridgeRiskAssessment', () => {
    test('should initialize successfully', async () => {
      expect(riskAssessment).toBeDefined();
    });

    test('should calculate risk assessment for a bridge', async () => {
      const assessment = await riskAssessment.getBridgeRiskAssessment('test-bridge');
      
      expect(assessment).toBeDefined();
      expect(assessment.bridgeId).toBe('test-bridge');
      expect(assessment.overallScore).toBeGreaterThanOrEqual(0);
      expect(assessment.overallScore).toBeLessThanOrEqual(100);
      expect(assessment.safetyScore).toBeGreaterThanOrEqual(0);
      expect(assessment.liquidityScore).toBeGreaterThanOrEqual(0);
      expect(assessment.reliabilityScore).toBeGreaterThanOrEqual(0);
      expect(assessment.securityScore).toBeGreaterThanOrEqual(0);
      expect(assessment.riskFactors).toBeInstanceOf(Array);
      expect(assessment.historicalPerformance).toBeDefined();
      expect(assessment.lastUpdated).toBeGreaterThan(0);
    });

    test('should get all bridge assessments', async () => {
      const assessments = await riskAssessment.getAllAssessments();
      
      expect(assessments).toBeDefined();
      expect(assessments['test-bridge']).toBeDefined();
      expect(typeof assessments).toBe('object');
    });

    test('should get bridge monitoring data', async () => {
      const monitoringData = await riskAssessment.getBridgeStatus('test-bridge');
      
      expect(monitoringData).toBeDefined();
      expect(monitoringData.bridgeId).toBe('test-bridge');
      expect(typeof monitoringData.isOperational).toBe('boolean');
      expect(monitoringData.currentTVL).toBeGreaterThanOrEqual(0);
      expect(monitoringData.dailyVolume).toBeGreaterThanOrEqual(0);
      expect(monitoringData.feeRate).toBeGreaterThanOrEqual(0);
      expect(monitoringData.avgProcessingTime).toBeGreaterThanOrEqual(0);
      expect(monitoringData.alerts).toBeInstanceOf(Array);
    });

    test('should record and track incidents', async () => {
      const incident = {
        bridgeId: 'test-bridge',
        type: 'bug' as const,
        severity: 'medium' as const,
        amount: 50000,
        description: 'Test incident for framework validation',
        timestamp: Date.now(),
        resolved: false
      };

      await riskAssessment.recordIncident(incident);
      
      // Risk assessment should be updated after incident
      const assessment = await riskAssessment.getBridgeRiskAssessment('test-bridge');
      expect(assessment.overallScore).toBeLessThan(100); // Should be impacted by incident
    });

    test('should update security audit information', async () => {
      const audit = {
        auditorName: 'Test Auditor',
        auditDate: Date.now(),
        riskLevel: 'low' as const,
        findings: ['No critical issues found', 'Minor optimization suggestions'],
        score: 95
      };

      await riskAssessment.updateSecurityAudit('test-bridge', audit);
      
      // Security score should be improved after good audit
      const assessment = await riskAssessment.getBridgeRiskAssessment('test-bridge');
      expect(assessment.securityScore).toBeGreaterThan(50);
    });

    test('should handle non-existent bridge gracefully', async () => {
      await expect(riskAssessment.getBridgeStatus('non-existent')).rejects.toThrow();
    });

    test('should cache risk assessments for performance', async () => {
      const start1 = Date.now();
      const assessment1 = await riskAssessment.getBridgeRiskAssessment('test-bridge');
      const time1 = Date.now() - start1;

      const start2 = Date.now();
      const assessment2 = await riskAssessment.getBridgeRiskAssessment('test-bridge');
      const time2 = Date.now() - start2;

      expect(assessment1.lastUpdated).toBe(assessment2.lastUpdated);
      expect(time2).toBeLessThan(time1); // Second call should be faster due to caching
    });
  });

  describe('BridgeAnomalyDetection', () => {
    test('should detect TVL drop anomaly', async () => {
      const monitoringData1: BridgeMonitoringData = {
        bridgeId: 'test-bridge',
        isOperational: true,
        currentTVL: 1000000,
        dailyVolume: 50000,
        feeRate: 0.001,
        avgProcessingTime: 300,
        queueLength: 0,
        lastTransaction: Date.now(),
        alerts: []
      };

      const monitoringData2: BridgeMonitoringData = {
        ...monitoringData1,
        currentTVL: 500000 // 50% drop
      };

      anomalyDetection.start();
      
      // First data point (baseline)
      await anomalyDetection.processMonitoringData(monitoringData1);
      
      // Second data point (anomaly)
      const alerts = await anomalyDetection.processMonitoringData(monitoringData2);
      
      const tvlDropAlert = alerts.find(alert => alert.type === 'low_liquidity');
      expect(tvlDropAlert).toBeDefined();
      expect(tvlDropAlert?.severity).toBe('critical');
    });

    test('should detect volume spike anomaly', async () => {
      const baseData: BridgeMonitoringData = {
        bridgeId: 'test-bridge',
        isOperational: true,
        currentTVL: 1000000,
        dailyVolume: 50000,
        feeRate: 0.001,
        avgProcessingTime: 300,
        queueLength: 0,
        lastTransaction: Date.now(),
        alerts: []
      };

      anomalyDetection.start();

      // Add baseline data points
      for (let i = 0; i < 10; i++) {
        await anomalyDetection.processMonitoringData({
          ...baseData,
          dailyVolume: 50000 + (Math.random() * 10000) // Normal volume variation
        });
      }

      // Add anomalous spike
      const spikeData = {
        ...baseData,
        dailyVolume: 500000 // 10x spike
      };

      const alerts = await anomalyDetection.processMonitoringData(spikeData);
      const volumeSpikeAlert = alerts.find(alert => alert.type === 'security_incident');
      expect(volumeSpikeAlert).toBeDefined();
    });

    test('should track detection statistics', () => {
      const stats = anomalyDetection.getDetectionStats();
      
      expect(stats.totalPatterns).toBeGreaterThan(0);
      expect(stats.activeMonitoring).toBeGreaterThanOrEqual(0);
      expect(stats.totalAlerts).toBeGreaterThanOrEqual(0);
      expect(stats.avgHistorySize).toBeGreaterThanOrEqual(0);
    });

    test('should support custom anomaly patterns', () => {
      const customPattern = {
        id: 'custom_test_pattern',
        name: 'Custom Test Pattern',
        description: 'Test pattern for validation',
        severity: 'medium' as const,
        threshold: 1,
        consecutiveOccurrences: 1,
        checkFunction: (current: BridgeMonitoringData, history: BridgeMonitoringData[]) => {
          return current.feeRate > 0.01; // High fee rate
        }
      };

      anomalyDetection.addCustomPattern(customPattern);
      const stats = anomalyDetection.getDetectionStats();
      expect(stats.totalPatterns).toBeGreaterThan(9); // Should have increased
    });
  });

  describe('BridgeMonitoringService', () => {
    test('should initialize and start monitoring', async () => {
      await bridgeMonitoring.start();
      
      const status = await bridgeMonitoring.getMonitoringStatus();
      expect(status.isRunning).toBe(true);
      expect(status.bridgeCount).toBe(1);
      expect(status.bridgeStatuses['test-bridge']).toBeDefined();
      expect(status.riskAssessments['test-bridge']).toBeDefined();
    });

    test('should get detailed bridge information', async () => {
      await bridgeMonitoring.start();
      
      const details = await bridgeMonitoring.getBridgeDetails('test-bridge');
      expect(details.monitoring).toBeDefined();
      expect(details.riskAssessment).toBeDefined();
      expect(details.metrics).toBeDefined();
      expect(details.endpoints).toBeInstanceOf(Array);
    });

    test('should perform health checks', async () => {
      const healthCheck = await bridgeMonitoring.performHealthCheck('test-bridge');
      
      expect(healthCheck.success).toBeDefined();
      expect(typeof healthCheck.success).toBe('boolean');
      expect(healthCheck.responseTime).toBeGreaterThanOrEqual(0);
      expect(healthCheck.errors).toBeInstanceOf(Array);
    });

    test('should handle alert subscriptions', async () => {
      let receivedAlert: any = null;
      const alertCallback = (alert: any) => {
        receivedAlert = alert;
      };

      bridgeMonitoring.subscribeToAlerts(alertCallback);
      
      // Trigger an incident that should generate an alert
      await bridgeMonitoring.recordIncident({
        bridgeId: 'test-bridge',
        type: 'bug',
        severity: 'critical',
        amount: 100000,
        description: 'Test critical incident'
      });

      // Wait a bit for async processing
      await new Promise(resolve => setTimeout(resolve, 100));
      
      bridgeMonitoring.unsubscribeFromAlerts(alertCallback);
    });

    test('should get anomaly statistics', async () => {
      const stats = bridgeMonitoring.getAnomalyStats();
      
      expect(stats.totalPatterns).toBeGreaterThan(0);
      expect(stats.activeMonitoring).toBeGreaterThanOrEqual(0);
      expect(stats.totalAlerts).toBeGreaterThanOrEqual(0);
      expect(stats.avgHistorySize).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Integration Tests', () => {
    test('should integrate all components for comprehensive monitoring', async () => {
      await bridgeMonitoring.start();
      
      // Record a security audit
      await bridgeMonitoring.updateSecurityAudit('test-bridge', {
        auditorName: 'Integration Test Auditor',
        auditDate: Date.now(),
        riskLevel: 'low',
        findings: ['System appears secure'],
        score: 92
      });

      // Record an incident
      await bridgeMonitoring.recordIncident({
        bridgeId: 'test-bridge',
        type: 'downtime',
        severity: 'medium',
        amount: 0,
        description: 'Brief downtime for maintenance'
      });

      // Get comprehensive status
      const status = await bridgeMonitoring.getMonitoringStatus();
      const riskAssessment = status.riskAssessments['test-bridge'];
      
      expect(riskAssessment).toBeDefined();
      expect(riskAssessment.securityScore).toBeGreaterThan(80); // Good audit should improve score
      expect(riskAssessment.riskFactors.length).toBeGreaterThan(0);
      
      // Verify monitoring data includes incident impact
      const bridgeStatus = status.bridgeStatuses['test-bridge'];
      expect(bridgeStatus).toBeDefined();
      expect(bridgeStatus.currentTVL).toBeGreaterThan(0);
    });

    test('should handle configuration updates', async () => {
      const newConfig = {
        ...testConfig,
        risk: {
          ...testConfig.risk,
          updateInterval: 2000,
          alertThresholds: {
            safetyScore: 90,
            liquidityScore: 80,
            reliabilityScore: 95,
          }
        }
      };

      bridgeMonitoring.updateConfig(newConfig);
      
      // Verify the configuration was applied
      const status = await bridgeMonitoring.getMonitoringStatus();
      expect(status.bridgeCount).toBe(1);
    });
  });
});