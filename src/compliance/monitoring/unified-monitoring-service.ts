/**
 * Unified Monitoring Service
 * Orchestrates all compliance monitoring components for real-time oversight
 */

import { EventEmitter } from 'events';
import Logger from '../../shared/logging/logger';

// Core monitoring components
import { RealTimeMonitor } from './real-time-monitor';
import { TransactionMonitor } from './transaction-monitor';
import { AlertManager } from './alert-manager';
import { RegulatoryChangeDetector } from './regulatory-change-detector';
import { EnhancedAlertSystem } from './enhanced-alert-system';

// Compliance engines
import { RuleEngine } from '../core/rule-engine';
import { UnifiedComplianceEngine } from '../core/unified-compliance-engine';

// Types
import {
  MonitoringConfig,
  Transaction,
  User,
  ComplianceEvent,
  ComplianceViolation,
  Jurisdiction
} from '../types';
import {
  DecentralizedUser,
  DecentralizedTransaction
} from '../types/decentralized-types';

const logger = Logger.getLogger('unified-monitoring-service');

export interface MonitoringServiceConfig {
  realTimeMonitoring: MonitoringConfig;
  regulatoryChangeDetection: any;
  enhancedAlerting: any;
  integration: {
    enableCrossComponentAnalysis: boolean;
    enablePredictiveAlerting: boolean;
    enableAutoRemediation: boolean;
    batchProcessingSize: number;
    processingInterval: number;
  };
}

export interface MonitoringServiceStatus {
  initialized: boolean;
  running: boolean;
  components: {
    realTimeMonitor: any;
    transactionMonitor: any;
    alertManager: any;
    regulatoryDetector: any;
    enhancedAlerts: any;
    ruleEngine: any;
    complianceEngine: any;
  };
  statistics: {
    eventsProcessed: number;
    alertsTriggered: number;
    violationsDetected: number;
    autoRemediations: number;
    averageProcessingTime: number;
  };
  health: {
    overall: 'healthy' | 'degraded' | 'critical';
    componentHealth: Record<string, 'healthy' | 'degraded' | 'critical'>;
    lastHealthCheck: Date;
  };
}

export interface CrossComponentAnalysis {
  correlationId: string;
  analysisType: 'pattern_detection' | 'risk_assessment' | 'trend_analysis';
  confidence: number;
  findings: AnalysisFinding[];
  recommendations: string[];
  timestamp: Date;
}

export interface AnalysisFinding {
  component: string;
  type: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  data: Record<string, any>;
}

export class UnifiedMonitoringService extends EventEmitter {
  private config: MonitoringServiceConfig;
  private isInitialized = false;
  private isRunning = false;

  // Core monitoring components
  private realTimeMonitor: RealTimeMonitor;
  private transactionMonitor: TransactionMonitor;
  private alertManager: AlertManager;
  private regulatoryDetector: RegulatoryChangeDetector;
  private enhancedAlerts: EnhancedAlertSystem;

  // Compliance engines
  private ruleEngine: RuleEngine;
  private complianceEngine: UnifiedComplianceEngine;

  // Service state
  private eventQueue: ComplianceEvent[] = [];
  private processingEvents = false;
  private processingInterval?: NodeJS.Timeout;

  private statistics = {
    eventsProcessed: 0,
    alertsTriggered: 0,
    violationsDetected: 0,
    autoRemediations: 0,
    averageProcessingTime: 0
  };

  private componentHealth: Record<string, 'healthy' | 'degraded' | 'critical'> = {};

  constructor(
    config: MonitoringServiceConfig,
    complianceEngine: UnifiedComplianceEngine,
    ruleEngine: RuleEngine
  ) {
    super();
    this.config = config;
    this.complianceEngine = complianceEngine;
    this.ruleEngine = ruleEngine;

    // Initialize monitoring components
    this.realTimeMonitor = new RealTimeMonitor(config.realTimeMonitoring);
    this.transactionMonitor = new TransactionMonitor(config.realTimeMonitoring);
    this.alertManager = new AlertManager(config.realTimeMonitoring.alerts);
    this.regulatoryDetector = new RegulatoryChangeDetector(config.regulatoryChangeDetection);
    this.enhancedAlerts = new EnhancedAlertSystem(config.enhancedAlerting);
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.warn('Unified Monitoring Service already initialized');
      return;
    }

    try {
      logger.info('Initializing Unified Monitoring Service...');

      // Initialize all components in parallel
      await Promise.all([
        this.realTimeMonitor.initialize(),
        this.transactionMonitor.initialize(),
        this.alertManager.initialize(),
        this.regulatoryDetector.initialize(),
        this.enhancedAlerts.initialize()
      ]);

      // Set up cross-component event handling
      this.setupCrossComponentEvents();

      // Set up event processing
      this.setupEventProcessing();

      // Perform initial health check
      await this.performHealthCheck();

      this.isInitialized = true;
      logger.info('✅ Unified Monitoring Service initialized successfully');

      this.emit('service_initialized', {
        components: Object.keys(this.componentHealth),
        timestamp: new Date()
      });

    } catch (error) {
      logger.error('Failed to initialize Unified Monitoring Service:', error);
      throw error;
    }
  }

  async start(): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('Unified Monitoring Service must be initialized before starting');
    }

    if (this.isRunning) {
      logger.warn('Unified Monitoring Service already running');
      return;
    }

    try {
      logger.info('Starting Unified Monitoring Service...');

      // Start all monitoring components
      await Promise.all([
        this.realTimeMonitor.start(),
        this.transactionMonitor.start(),
        this.alertManager.start(),
        this.regulatoryDetector.start(),
        this.enhancedAlerts.start()
      ]);

      // Start event processing
      this.startEventProcessing();

      // Start periodic health checks
      this.processingInterval = setInterval(
        () => this.performHealthCheck(),
        this.config.integration.processingInterval * 1000
      );

      this.isRunning = true;
      logger.info('🚀 Unified Monitoring Service started successfully');

      this.emit('service_started', {
        timestamp: new Date()
      });

    } catch (error) {
      logger.error('Failed to start Unified Monitoring Service:', error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      logger.warn('Unified Monitoring Service is not running');
      return;
    }

    try {
      logger.info('Stopping Unified Monitoring Service...');

      // Stop periodic processing
      if (this.processingInterval) {
        clearInterval(this.processingInterval);
        this.processingInterval = undefined;
      }

      // Stop event processing
      this.processingEvents = false;

      // Stop all monitoring components
      await Promise.all([
        this.realTimeMonitor.stop(),
        this.transactionMonitor.stop(),
        this.alertManager.stop(),
        this.regulatoryDetector.stop(),
        this.enhancedAlerts.stop()
      ]);

      this.isRunning = false;
      logger.info('🛑 Unified Monitoring Service stopped successfully');

      this.emit('service_stopped', {
        statistics: this.getStatistics(),
        timestamp: new Date()
      });

    } catch (error) {
      logger.error('Failed to stop Unified Monitoring Service:', error);
      throw error;
    }
  }

  /**
   * Monitor user activity with unified compliance checking
   */
  async monitorUserActivity(
    user: User | DecentralizedUser,
    activity: any
  ): Promise<void> {
    const startTime = Date.now();

    try {
      // Route to appropriate monitoring based on user type
      if (this.isDecentralizedUser(user)) {
        await this.monitorDecentralizedUserActivity(user, activity);
      } else {
        await this.realTimeMonitor.monitorUserActivity(user as User, activity);
      }

      // Perform compliance assessment
      const complianceResult = await this.complianceEngine.assessCompliance(user);

      // Create compliance event
      const event: ComplianceEvent = {
        id: this.generateEventId(),
        type: 'user-activity',
        entityType: 'user',
        entityId: this.getUserId(user),
        jurisdiction: this.getUserJurisdiction(user),
        timestamp: new Date(),
        data: {
          activity,
          complianceResult,
          userType: this.isDecentralizedUser(user) ? 'decentralized' : 'traditional'
        },
        processed: false
      };

      this.addEvent(event);

      // Update statistics
      this.updateProcessingMetrics(Date.now() - startTime);

    } catch (error) {
      logger.error('Error monitoring user activity:', error);
      throw error;
    }
  }

  /**
   * Monitor transaction with unified screening
   */
  async monitorTransaction(
    transaction: Transaction | DecentralizedTransaction,
    user: User | DecentralizedUser
  ): Promise<void> {
    const startTime = Date.now();

    try {
      // Perform transaction screening
      const amlResult = await this.transactionMonitor.screenTransaction(transaction, user);

      // Screen through unified compliance engine
      const complianceResult = await this.complianceEngine.screenTransaction(transaction, user);

      // Check velocity limits
      const velocityResult = await this.transactionMonitor.checkVelocityLimits(
        this.getUserId(user),
        transaction as Transaction
      );

      // Detect suspicious patterns
      const patternResult = await this.transactionMonitor.detectSuspiciousPatterns(
        transaction as Transaction,
        user as User
      );

      // Create comprehensive event
      const event: ComplianceEvent = {
        id: this.generateEventId(),
        type: 'transaction-screened',
        entityType: 'transaction',
        entityId: transaction.id,
        jurisdiction: this.getUserJurisdiction(user),
        timestamp: new Date(),
        data: {
          transaction,
          user: this.getUserId(user),
          amlResult,
          complianceResult,
          velocityResult,
          patternResult,
          userType: this.isDecentralizedUser(user) ? 'decentralized' : 'traditional'
        },
        processed: false
      };

      this.addEvent(event);

      // Trigger alerts if necessary
      if (!complianceResult.success || velocityResult.limitExceeded || patternResult.suspicious) {
        await this.triggerTransactionAlert(transaction, user, {
          amlResult,
          complianceResult,
          velocityResult,
          patternResult
        });
      }

      this.updateProcessingMetrics(Date.now() - startTime);

    } catch (error) {
      logger.error('Error monitoring transaction:', error);
      throw error;
    }
  }

  /**
   * Perform cross-component analysis
   */
  async performCrossComponentAnalysis(
    analysisType: 'pattern_detection' | 'risk_assessment' | 'trend_analysis',
    timeframe?: { start: Date; end: Date }
  ): Promise<CrossComponentAnalysis> {
    try {
      const correlationId = this.generateCorrelationId();
      
      logger.info('Performing cross-component analysis', {
        correlationId,
        analysisType,
        timeframe
      });

      const findings: AnalysisFinding[] = [];

      // Gather data from all components
      const realTimeStatus = this.realTimeMonitor.getStatus();
      const transactionStats = this.transactionMonitor.getStatistics();
      const alertSummary = this.enhancedAlerts.getAlertSummary(timeframe);
      const regulatoryStats = this.regulatoryDetector.getStats();

      // Pattern detection analysis
      if (analysisType === 'pattern_detection') {
        // Analyze transaction patterns
        if (transactionStats.patternsDetected > 10) {
          findings.push({
            component: 'transaction-monitor',
            type: 'suspicious_pattern_increase',
            description: `Unusual increase in suspicious patterns: ${transactionStats.patternsDetected}`,
            severity: 'medium',
            data: { patterns: transactionStats.patternsDetected }
          });
        }

        // Analyze alert patterns
        if (alertSummary.total > 50) {
          findings.push({
            component: 'enhanced-alerts',
            type: 'alert_volume_spike',
            description: `High alert volume detected: ${alertSummary.total}`,
            severity: 'high',
            data: { alertCount: alertSummary.total, bySeverity: alertSummary.bySeverity }
          });
        }
      }

      // Risk assessment analysis
      if (analysisType === 'risk_assessment') {
        const criticalAlerts = alertSummary.bySeverity.critical;
        const highAlerts = alertSummary.bySeverity.high;
        
        if (criticalAlerts > 5 || highAlerts > 20) {
          findings.push({
            component: 'enhanced-alerts',
            type: 'elevated_risk_level',
            description: `High risk alert levels: ${criticalAlerts} critical, ${highAlerts} high`,
            severity: 'critical',
            data: { critical: criticalAlerts, high: highAlerts }
          });
        }
      }

      // Trend analysis
      if (analysisType === 'trend_analysis') {
        const velocityViolations = transactionStats.velocityViolations;
        const regulatoryChanges = regulatoryStats.totalChangesDetected;

        if (regulatoryChanges > 5) {
          findings.push({
            component: 'regulatory-detector',
            type: 'regulatory_change_trend',
            description: `Increased regulatory activity: ${regulatoryChanges} changes detected`,
            severity: 'medium',
            data: { changes: regulatoryChanges }
          });
        }
      }

      // Generate recommendations
      const recommendations = this.generateRecommendations(findings);

      const analysis: CrossComponentAnalysis = {
        correlationId,
        analysisType,
        confidence: this.calculateAnalysisConfidence(findings),
        findings,
        recommendations,
        timestamp: new Date()
      };

      logger.info('Cross-component analysis completed', {
        correlationId,
        findingsCount: findings.length,
        confidence: analysis.confidence
      });

      this.emit('analysis_completed', {
        analysis,
        timestamp: new Date()
      });

      return analysis;

    } catch (error) {
      logger.error('Error performing cross-component analysis:', error);
      throw error;
    }
  }

  /**
   * Get unified monitoring service status
   */
  getStatus(): MonitoringServiceStatus {
    return {
      initialized: this.isInitialized,
      running: this.isRunning,
      components: {
        realTimeMonitor: this.realTimeMonitor.getStatus(),
        transactionMonitor: this.transactionMonitor.getStatus(),
        alertManager: this.alertManager.getStatus(),
        regulatoryDetector: this.regulatoryDetector.getStats(),
        enhancedAlerts: this.enhancedAlerts.getStatistics(),
        ruleEngine: this.ruleEngine.getStatus(),
        complianceEngine: this.complianceEngine.getEngineStatus()
      },
      statistics: this.statistics,
      health: {
        overall: this.calculateOverallHealth(),
        componentHealth: { ...this.componentHealth },
        lastHealthCheck: new Date()
      }
    };
  }

  /**
   * Get service statistics
   */
  getStatistics(): any {
    return {
      ...this.statistics,
      eventQueueSize: this.eventQueue.length,
      componentStatistics: {
        realTimeMonitor: this.realTimeMonitor.getMetrics(),
        transactionMonitor: this.transactionMonitor.getStatistics(),
        enhancedAlerts: this.enhancedAlerts.getStatistics(),
        regulatoryDetector: this.regulatoryDetector.getStats()
      }
    };
  }

  // Private methods

  private setupCrossComponentEvents(): void {
    // Real-time monitor events
    this.realTimeMonitor.on('violation_detected', (event) => {
      this.handleViolationDetected(event, 'real-time-monitor');
    });

    this.realTimeMonitor.on('threshold_exceeded', (event) => {
      this.handleThresholdExceeded(event, 'real-time-monitor');
    });

    // Transaction monitor events
    this.transactionMonitor.on('suspicious_pattern', (event) => {
      this.handleSuspiciousPattern(event, 'transaction-monitor');
    });

    this.transactionMonitor.on('velocity_limit_exceeded', (event) => {
      this.handleVelocityLimitExceeded(event, 'transaction-monitor');
    });

    // Regulatory detector events
    this.regulatoryDetector.on('change_detected', (event) => {
      this.handleRegulatoryChange(event, 'regulatory-detector');
    });

    this.regulatoryDetector.on('regulatory_alert', (event) => {
      this.handleRegulatoryAlert(event, 'regulatory-detector');
    });

    // Enhanced alerts events
    this.enhancedAlerts.on('alert_created', (event) => {
      this.handleEnhancedAlert(event, 'enhanced-alerts');
    });

    // Rule engine events
    this.ruleEngine.on('violations_detected', (event) => {
      this.handleRuleViolations(event, 'rule-engine');
    });
  }

  private setupEventProcessing(): void {
    // Set up periodic event processing
    this.processingEvents = true;
  }

  private startEventProcessing(): void {
    this.processEventQueue();
  }

  private async processEventQueue(): Promise<void> {
    while (this.processingEvents && this.eventQueue.length > 0) {
      const batch = this.eventQueue.splice(0, this.config.integration.batchProcessingSize);
      
      for (const event of batch) {
        await this.processEvent(event);
      }
    }

    if (this.processingEvents) {
      setTimeout(() => this.processEventQueue(), 1000);
    }
  }

  private async processEvent(event: ComplianceEvent): Promise<void> {
    try {
      // Process event based on type
      switch (event.type) {
        case 'user-activity':
          await this.processUserActivityEvent(event);
          break;
        case 'transaction-screened':
          await this.processTransactionEvent(event);
          break;
        case 'violation-detected':
          await this.processViolationEvent(event);
          break;
        default:
          logger.debug('Unhandled event type', { type: event.type });
      }

      event.processed = true;
      this.statistics.eventsProcessed++;

    } catch (error) {
      logger.error('Error processing event:', error);
    }
  }

  private addEvent(event: ComplianceEvent): void {
    this.eventQueue.push(event);
  }

  private async performHealthCheck(): Promise<void> {
    // Check health of all components
    this.componentHealth['real-time-monitor'] = this.checkComponentHealth(this.realTimeMonitor.getStatus());
    this.componentHealth['transaction-monitor'] = this.checkComponentHealth(this.transactionMonitor.getStatus());
    this.componentHealth['alert-manager'] = this.checkComponentHealth(this.alertManager.getStatus());
    this.componentHealth['regulatory-detector'] = this.checkComponentHealth(this.regulatoryDetector.getStats());
    this.componentHealth['enhanced-alerts'] = this.checkComponentHealth(this.enhancedAlerts.getStatistics());

    const overallHealth = this.calculateOverallHealth();
    
    if (overallHealth === 'critical') {
      logger.error('Critical health status detected', {
        componentHealth: this.componentHealth
      });
      
      this.emit('health_critical', {
        componentHealth: this.componentHealth,
        timestamp: new Date()
      });
    }
  }

  private checkComponentHealth(status: any): 'healthy' | 'degraded' | 'critical' {
    if (!status || !status.initialized || !status.running) {
      return 'critical';
    }
    
    // Add component-specific health checks here
    return 'healthy';
  }

  private calculateOverallHealth(): 'healthy' | 'degraded' | 'critical' {
    const healthValues = Object.values(this.componentHealth);
    
    if (healthValues.includes('critical')) return 'critical';
    if (healthValues.includes('degraded')) return 'degraded';
    return 'healthy';
  }

  private isDecentralizedUser(user: User | DecentralizedUser): user is DecentralizedUser {
    return 'did' in user;
  }

  private getUserId(user: User | DecentralizedUser): string {
    return this.isDecentralizedUser(user) ? user.did : user.id;
  }

  private getUserJurisdiction(user: User | DecentralizedUser): Jurisdiction {
    if (this.isDecentralizedUser(user)) {
      // For decentralized users, jurisdiction might be determined from ZK proofs
      return 'US'; // Default fallback
    }
    return (user as User).jurisdiction;
  }

  private async monitorDecentralizedUserActivity(user: DecentralizedUser, activity: any): Promise<void> {
    // Specialized monitoring for decentralized users
    logger.debug('Monitoring decentralized user activity', {
      userDID: user.did,
      privacyLevel: user.decentralizedIdentity.privacySettings.anonymousMode ? 'anonymous' : 'identified'
    });

    // Check reputation score changes
    if (user.reputation.overallScore < 500) {
      await this.enhancedAlerts.createDecentralizedAlert({
        type: 'low-reputation',
        severity: 'medium',
        title: 'Low User Reputation Score',
        description: `User reputation score below threshold: ${user.reputation.overallScore}`,
        userDID: user.did,
        privacyLevel: 'balanced',
        zkProofRelated: false,
        reputationScore: user.reputation.overallScore
      });
    }
  }

  private async triggerTransactionAlert(
    transaction: Transaction | DecentralizedTransaction,
    user: User | DecentralizedUser,
    results: any
  ): Promise<void> {
    const alertType = this.isDecentralizedUser(user) ? 'decentralized' : 'traditional';
    
    if (alertType === 'decentralized') {
      await this.enhancedAlerts.createDecentralizedAlert({
        type: 'suspicious-transaction',
        severity: results.patternResult.suspicious ? 'high' : 'medium',
        title: 'Suspicious Transaction Pattern',
        description: `Transaction flagged for suspicious activity`,
        userDID: this.getUserId(user),
        privacyLevel: (transaction as DecentralizedTransaction).privacyLevel || 'balanced',
        zkProofRelated: !!(transaction as DecentralizedTransaction).zkProofs,
        metadata: {
          transactionId: transaction.id,
          patterns: results.patternResult.patterns,
          riskScore: results.amlResult.riskScore
        }
      });
    } else {
      // Traditional alert handling
      this.statistics.alertsTriggered++;
    }
  }

  private generateRecommendations(findings: AnalysisFinding[]): string[] {
    const recommendations: string[] = [];

    if (findings.some(f => f.type === 'suspicious_pattern_increase')) {
      recommendations.push('Consider tightening transaction monitoring thresholds');
      recommendations.push('Review and update pattern detection algorithms');
    }

    if (findings.some(f => f.type === 'alert_volume_spike')) {
      recommendations.push('Investigate root causes of increased alert volume');
      recommendations.push('Consider adjusting alert sensitivity settings');
    }

    if (findings.some(f => f.type === 'elevated_risk_level')) {
      recommendations.push('Implement additional risk mitigation measures');
      recommendations.push('Consider temporary increase in manual review processes');
    }

    if (findings.some(f => f.type === 'regulatory_change_trend')) {
      recommendations.push('Review upcoming regulatory deadlines');
      recommendations.push('Prepare compliance implementation plans');
    }

    return recommendations;
  }

  private calculateAnalysisConfidence(findings: AnalysisFinding[]): number {
    if (findings.length === 0) return 0;
    
    const severityWeights = { low: 0.25, medium: 0.5, high: 0.75, critical: 1.0 };
    const totalWeight = findings.reduce((sum, finding) => 
      sum + severityWeights[finding.severity], 0
    );
    
    return Math.min(100, (totalWeight / findings.length) * 100);
  }

  private updateProcessingMetrics(processingTime: number): void {
    const totalProcessed = this.statistics.eventsProcessed + 1;
    this.statistics.averageProcessingTime = 
      (this.statistics.averageProcessingTime * (totalProcessed - 1) + processingTime) / totalProcessed;
  }

  private generateEventId(): string {
    return `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateCorrelationId(): string {
    return `corr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Event handlers

  private async handleViolationDetected(event: any, source: string): Promise<void> {
    this.statistics.violationsDetected++;
    logger.warn('Violation detected', { source, event });
  }

  private async handleThresholdExceeded(event: any, source: string): Promise<void> {
    logger.warn('Threshold exceeded', { source, event });
  }

  private async handleSuspiciousPattern(event: any, source: string): Promise<void> {
    logger.warn('Suspicious pattern detected', { source, event });
  }

  private async handleVelocityLimitExceeded(event: any, source: string): Promise<void> {
    logger.warn('Velocity limit exceeded', { source, event });
  }

  private async handleRegulatoryChange(event: any, source: string): Promise<void> {
    await this.enhancedAlerts.createRegulatoryAlert(event.change);
    logger.info('Regulatory change processed', { source, changeId: event.change.id });
  }

  private async handleRegulatoryAlert(event: any, source: string): Promise<void> {
    this.statistics.alertsTriggered++;
    logger.info('Regulatory alert triggered', { source, event });
  }

  private async handleEnhancedAlert(event: any, source: string): Promise<void> {
    this.statistics.alertsTriggered++;
    logger.info('Enhanced alert created', { source, alertId: event.alert.id });
  }

  private async handleRuleViolations(event: any, source: string): Promise<void> {
    this.statistics.violationsDetected += event.violations.length;
    logger.warn('Rule violations detected', { source, count: event.violations.length });
  }

  private async processUserActivityEvent(event: ComplianceEvent): Promise<void> {
    logger.debug('Processing user activity event', { eventId: event.id });
  }

  private async processTransactionEvent(event: ComplianceEvent): Promise<void> {
    logger.debug('Processing transaction event', { eventId: event.id });
  }

  private async processViolationEvent(event: ComplianceEvent): Promise<void> {
    logger.debug('Processing violation event', { eventId: event.id });
  }
}