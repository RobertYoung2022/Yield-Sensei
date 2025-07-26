/**
 * Real-Time Compliance Monitor
 * Continuous monitoring of compliance events and violations
 */

import { EventEmitter } from 'events';
import Logger from '../../shared/logging/logger';
import {
  MonitoringConfig,
  ComplianceEvent,
  ComplianceViolation,
  ComplianceAlert,
  User,
  Transaction,
  RiskLevel,
  Jurisdiction
} from '../types';

const logger = Logger.getLogger('real-time-monitor');

interface MonitoringMetrics {
  eventsProcessed: number;
  violationsDetected: number;
  alertsTriggered: number;
  averageProcessingTime: number;
  errorRate: number;
}

interface ThresholdWatch {
  id: string;
  name: string;
  threshold: number;
  current: number;
  timeframe: string;
  entityType: string;
  entityId: string;
  jurisdiction: Jurisdiction;
  lastReset: Date;
}

export class RealTimeMonitor extends EventEmitter {
  private config: MonitoringConfig;
  private isInitialized = false;
  private isRunning = false;
  private monitoringInterval?: NodeJS.Timeout;
  private metrics: MonitoringMetrics;
  private thresholdWatches: Map<string, ThresholdWatch> = new Map();
  private eventQueue: ComplianceEvent[] = [];
  private processingEvents = false;

  constructor(config: MonitoringConfig) {
    super();
    this.config = config;
    this.metrics = {
      eventsProcessed: 0,
      violationsDetected: 0,
      alertsTriggered: 0,
      averageProcessingTime: 0,
      errorRate: 0
    };
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.warn('Real-Time Monitor already initialized');
      return;
    }

    try {
      logger.info('Initializing Real-Time Monitor...');

      // Set up threshold watches
      this.setupThresholdWatches();

      // Set up event processing
      this.setupEventProcessing();

      this.isInitialized = true;
      logger.info('✅ Real-Time Monitor initialized successfully');

    } catch (error) {
      logger.error('Failed to initialize Real-Time Monitor:', error);
      throw error;
    }
  }

  async start(): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('Real-Time Monitor must be initialized before starting');
    }

    if (this.isRunning) {
      logger.warn('Real-Time Monitor already running');
      return;
    }

    try {
      logger.info('Starting Real-Time Monitor...');

      if (this.config.realTime) {
        // Start continuous monitoring
        this.monitoringInterval = setInterval(
          () => this.performMonitoringCycle(),
          this.config.intervals.transactionScreening
        );
      }

      // Start event queue processing
      this.startEventProcessing();

      this.isRunning = true;
      logger.info('🚀 Real-Time Monitor started successfully');

      this.emit('monitor_started', {
        timestamp: new Date(),
        config: this.config.realTime
      });

    } catch (error) {
      logger.error('Failed to start Real-Time Monitor:', error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      logger.warn('Real-Time Monitor is not running');
      return;
    }

    try {
      logger.info('Stopping Real-Time Monitor...');

      // Stop monitoring interval
      if (this.monitoringInterval) {
        clearInterval(this.monitoringInterval);
        this.monitoringInterval = undefined;
      }

      // Stop event processing
      this.processingEvents = false;

      this.isRunning = false;
      logger.info('🛑 Real-Time Monitor stopped successfully');

      this.emit('monitor_stopped', {
        timestamp: new Date(),
        metrics: this.getMetrics()
      });

    } catch (error) {
      logger.error('Failed to stop Real-Time Monitor:', error);
      throw error;
    }
  }

  async updateConfiguration(newConfig: MonitoringConfig): Promise<void> {
    const wasRunning = this.isRunning;
    
    if (wasRunning) {
      await this.stop();
    }

    this.config = newConfig;
    this.setupThresholdWatches();

    if (wasRunning) {
      await this.start();
    }

    logger.info('Real-Time Monitor configuration updated');
  }

  /**
   * Add event to monitoring queue
   */
  addEvent(event: ComplianceEvent): void {
    this.eventQueue.push(event);
    
    if (this.config.realTime && this.isRunning) {
      // Process immediately for real-time monitoring
      this.processEvent(event).catch(error => {
        logger.error('Error processing real-time event:', error);
      });
    }
  }

  /**
   * Monitor user activity in real-time
   */
  async monitorUserActivity(user: User, activity: any): Promise<void> {
    const startTime = Date.now();

    try {
      // Check velocity limits
      await this.checkUserVelocityLimits(user, activity);

      // Check risk thresholds
      await this.checkUserRiskThresholds(user);

      // Check jurisdiction-specific rules
      await this.checkJurisdictionRules(user, activity);

      // Update metrics
      this.updateProcessingMetrics(Date.now() - startTime, false);

    } catch (error) {
      logger.error('Error monitoring user activity:', error);
      this.updateProcessingMetrics(Date.now() - startTime, true);
      throw error;
    }
  }

  /**
   * Monitor transaction in real-time
   */
  async monitorTransaction(transaction: Transaction, user: User): Promise<void> {
    const startTime = Date.now();

    try {
      // Check transaction amount thresholds
      await this.checkTransactionThresholds(transaction, user);

      // Check velocity patterns
      await this.checkTransactionVelocity(transaction, user);

      // Check suspicious patterns
      await this.detectSuspiciousPatterns(transaction, user);

      // Update threshold watches
      this.updateThresholdWatches(transaction, user);

      // Update metrics
      this.updateProcessingMetrics(Date.now() - startTime, false);

    } catch (error) {
      logger.error('Error monitoring transaction:', error);
      this.updateProcessingMetrics(Date.now() - startTime, true);
      throw error;
    }
  }

  /**
   * Detect compliance violations
   */
  async detectViolation(violation: ComplianceViolation): Promise<void> {
    this.metrics.violationsDetected++;

    logger.warn('Compliance violation detected', {
      violationId: violation.id,
      entityType: violation.entityType,
      entityId: violation.entityId,
      severity: violation.severity,
      category: violation.category
    });

    this.emit('violation_detected', {
      violation,
      timestamp: new Date()
    });

    // Trigger alert if severe enough
    if (violation.severity === 'high' || violation.severity === 'critical') {
      await this.triggerAlert({
        type: 'compliance-violation',
        severity: violation.severity,
        title: `${violation.severity.toUpperCase()} Compliance Violation`,
        description: violation.description,
        entityType: violation.entityType,
        entityId: violation.entityId,
        jurisdiction: violation.jurisdiction,
        triggeredAt: new Date(),
        status: 'open',
        escalationLevel: 0,
        metadata: {
          violationId: violation.id,
          ruleId: violation.ruleId,
          category: violation.category
        }
      });
    }
  }

  /**
   * Check threshold breach
   */
  async checkThresholdBreach(
    entityType: string,
    entityId: string,
    metric: string,
    value: number,
    threshold: number,
    jurisdiction: Jurisdiction
  ): Promise<void> {
    if (value > threshold) {
      logger.warn('Threshold breached', {
        entityType,
        entityId,
        metric,
        value,
        threshold,
        jurisdiction
      });

      this.emit('threshold_exceeded', {
        entityType,
        entityId,
        metric,
        value,
        threshold,
        jurisdiction,
        timestamp: new Date()
      });

      // Trigger alert for significant breaches
      if (value > threshold * 1.5) {
        await this.triggerAlert({
          type: 'large-transaction',
          severity: value > threshold * 2 ? 'high' : 'medium',
          title: 'Threshold Breach Detected',
          description: `${metric} threshold exceeded: ${value} > ${threshold}`,
          entityType: entityType as any,
          entityId,
          jurisdiction,
          triggeredAt: new Date(),
          status: 'open',
          escalationLevel: 0,
          metadata: {
            metric,
            value,
            threshold,
            breachRatio: value / threshold
          }
        });
      }
    }
  }

  /**
   * Get monitoring metrics
   */
  getMetrics(): MonitoringMetrics {
    return { ...this.metrics };
  }

  /**
   * Get threshold watches status
   */
  getThresholdWatches(): ThresholdWatch[] {
    return Array.from(this.thresholdWatches.values());
  }

  /**
   * Get monitor status
   */
  getStatus(): any {
    return {
      initialized: this.isInitialized,
      running: this.isRunning,
      realTimeEnabled: this.config.realTime,
      eventQueueSize: this.eventQueue.length,
      thresholdWatchesCount: this.thresholdWatches.size,
      metrics: this.metrics,
      configuration: {
        intervals: this.config.intervals,
        thresholds: Object.keys(this.config.thresholds)
      }
    };
  }

  // Private methods

  private setupThresholdWatches(): void {
    this.thresholdWatches.clear();

    // Set up watches for transaction amount thresholds
    for (const [currency, threshold] of Object.entries(this.config.thresholds.transactionAmount)) {
      const watchId = `transaction_amount_${currency}`;
      this.thresholdWatches.set(watchId, {
        id: watchId,
        name: `Transaction Amount ${currency}`,
        threshold,
        current: 0,
        timeframe: 'single_transaction',
        entityType: 'transaction',
        entityId: '',
        jurisdiction: 'US', // Default
        lastReset: new Date()
      });
    }

    // Set up watches for velocity limits
    for (const [metric, limit] of Object.entries(this.config.thresholds.velocityLimits)) {
      const watchId = `velocity_${metric}`;
      this.thresholdWatches.set(watchId, {
        id: watchId,
        name: `Velocity ${metric}`,
        threshold: limit,
        current: 0,
        timeframe: metric.includes('daily') ? 'daily' : 
                   metric.includes('weekly') ? 'weekly' : 'monthly',
        entityType: 'user',
        entityId: '',
        jurisdiction: 'US', // Default
        lastReset: new Date()
      });
    }

    logger.debug(`Set up ${this.thresholdWatches.size} threshold watches`);
  }

  private setupEventProcessing(): void {
    // Set up event processing handlers
    this.on('user_activity', this.handleUserActivity.bind(this));
    this.on('transaction_submitted', this.handleTransactionSubmitted.bind(this));
    this.on('violation_detected', this.handleViolationDetected.bind(this));
    this.on('threshold_exceeded', this.handleThresholdExceeded.bind(this));
  }

  private startEventProcessing(): void {
    this.processingEvents = true;
    this.processEventQueue();
  }

  private async processEventQueue(): Promise<void> {
    while (this.processingEvents && this.eventQueue.length > 0) {
      const event = this.eventQueue.shift();
      if (event) {
        await this.processEvent(event);
      }
    }

    if (this.processingEvents) {
      // Schedule next processing cycle
      setTimeout(() => this.processEventQueue(), 100);
    }
  }

  private async processEvent(event: ComplianceEvent): Promise<void> {
    const startTime = Date.now();

    try {
      logger.debug('Processing compliance event', {
        eventId: event.id,
        type: event.type,
        entityType: event.entityType,
        entityId: event.entityId
      });

      // Route event to appropriate handler
      switch (event.type) {
        case 'user-registered':
        case 'kyc-submitted':
          this.emit('user_activity', event);
          break;
        case 'transaction-submitted':
        case 'transaction-screened':
          this.emit('transaction_submitted', event);
          break;
        case 'violation-detected':
          this.emit('violation_detected', event);
          break;
        default:
          logger.debug('Unhandled event type', { type: event.type });
      }

      this.metrics.eventsProcessed++;
      this.updateProcessingMetrics(Date.now() - startTime, false);

    } catch (error) {
      logger.error('Error processing event:', error);
      this.updateProcessingMetrics(Date.now() - startTime, true);
    }
  }

  private async performMonitoringCycle(): Promise<void> {
    try {
      // Reset daily thresholds if needed
      this.resetThresholdWatches();

      // Perform health checks
      await this.performHealthChecks();

    } catch (error) {
      logger.error('Error in monitoring cycle:', error);
    }
  }

  private resetThresholdWatches(): void {
    const now = new Date();
    
    for (const watch of this.thresholdWatches.values()) {
      const hoursSinceReset = (now.getTime() - watch.lastReset.getTime()) / (1000 * 60 * 60);
      
      let shouldReset = false;
      switch (watch.timeframe) {
        case 'daily':
          shouldReset = hoursSinceReset >= 24;
          break;
        case 'weekly':
          shouldReset = hoursSinceReset >= 168; // 24 * 7
          break;
        case 'monthly':
          shouldReset = hoursSinceReset >= 720; // 24 * 30
          break;
      }

      if (shouldReset) {
        watch.current = 0;
        watch.lastReset = now;
        logger.debug(`Reset threshold watch: ${watch.id}`);
      }
    }
  }

  private async performHealthChecks(): Promise<void> {
    // Check if error rate is too high
    if (this.metrics.errorRate > 0.1) { // 10% error rate
      logger.warn('High error rate detected in real-time monitoring', {
        errorRate: this.metrics.errorRate
      });
    }

    // Check if processing time is too slow
    if (this.metrics.averageProcessingTime > 5000) { // 5 seconds
      logger.warn('Slow processing time detected in real-time monitoring', {
        averageProcessingTime: this.metrics.averageProcessingTime
      });
    }
  }

  private async checkUserVelocityLimits(user: User, activity: any): Promise<void> {
    // Implementation would check user activity velocity
    // This is a placeholder for velocity limit checking
  }

  private async checkUserRiskThresholds(user: User): Promise<void> {
    const riskScore = user.riskProfile?.overallRisk;
    const riskThresholds = this.config.thresholds.riskScores;

    if (riskScore === 'critical' && riskThresholds.critical) {
      await this.checkThresholdBreach(
        'user',
        user.id,
        'risk_score',
        100,
        riskThresholds.critical,
        user.jurisdiction
      );
    }
  }

  private async checkJurisdictionRules(user: User, activity: any): Promise<void> {
    // Implementation would check jurisdiction-specific rules
    // This is a placeholder for jurisdiction rule checking
  }

  private async checkTransactionThresholds(transaction: Transaction, user: User): Promise<void> {
    const thresholds = this.config.thresholds.transactionAmount;
    const threshold = thresholds[transaction.currency];

    if (threshold && transaction.amount > threshold) {
      await this.checkThresholdBreach(
        'transaction',
        transaction.id,
        'amount',
        transaction.amount,
        threshold,
        user.jurisdiction
      );
    }
  }

  private async checkTransactionVelocity(transaction: Transaction, user: User): Promise<void> {
    // Implementation would check transaction velocity patterns
    // This is a placeholder for velocity pattern checking
  }

  private async detectSuspiciousPatterns(transaction: Transaction, user: User): Promise<void> {
    // Implementation would detect suspicious transaction patterns
    // This is a placeholder for pattern detection
  }

  private updateThresholdWatches(transaction: Transaction, user: User): void {
    // Update transaction amount watches
    const amountWatchId = `transaction_amount_${transaction.currency}`;
    const amountWatch = this.thresholdWatches.get(amountWatchId);
    if (amountWatch) {
      amountWatch.current = transaction.amount;
      amountWatch.entityId = transaction.id;
      amountWatch.jurisdiction = user.jurisdiction;
    }

    // Update velocity watches
    const velocityWatchId = `velocity_daily_transaction_count`;
    const velocityWatch = this.thresholdWatches.get(velocityWatchId);
    if (velocityWatch) {
      velocityWatch.current += 1;
      velocityWatch.entityId = user.id;
      velocityWatch.jurisdiction = user.jurisdiction;
    }
  }

  private async triggerAlert(alert: Omit<ComplianceAlert, 'id'>): Promise<void> {
    const fullAlert: ComplianceAlert = {
      id: this.generateAlertId(),
      ...alert
    };

    this.metrics.alertsTriggered++;

    logger.info('Triggering compliance alert', {
      alertId: fullAlert.id,
      type: fullAlert.type,
      severity: fullAlert.severity,
      entityType: fullAlert.entityType,
      entityId: fullAlert.entityId
    });

    this.emit('alert_triggered', {
      alert: fullAlert,
      timestamp: new Date()
    });
  }

  private updateProcessingMetrics(processingTime: number, isError: boolean): void {
    // Update average processing time
    const totalProcessed = this.metrics.eventsProcessed + 1;
    this.metrics.averageProcessingTime = 
      (this.metrics.averageProcessingTime * (totalProcessed - 1) + processingTime) / totalProcessed;

    // Update error rate
    if (isError) {
      this.metrics.errorRate = 
        (this.metrics.errorRate * (totalProcessed - 1) + 1) / totalProcessed;
    } else {
      this.metrics.errorRate = 
        (this.metrics.errorRate * (totalProcessed - 1)) / totalProcessed;
    }
  }

  private generateAlertId(): string {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Event handlers

  private async handleUserActivity(event: ComplianceEvent): Promise<void> {
    logger.debug('Handling user activity event', { eventId: event.id });
  }

  private async handleTransactionSubmitted(event: ComplianceEvent): Promise<void> {
    logger.debug('Handling transaction submitted event', { eventId: event.id });
  }

  private async handleViolationDetected(event: any): Promise<void> {
    logger.warn('Violation detected in real-time monitoring', event);
  }

  private async handleThresholdExceeded(event: any): Promise<void> {
    logger.warn('Threshold exceeded in real-time monitoring', event);
  }
}