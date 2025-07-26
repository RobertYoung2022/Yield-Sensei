/**
 * Regulatory Change Detection System
 * Monitors and detects regulatory changes across jurisdictions
 */

import { EventEmitter } from 'events';
import Logger from '../../shared/logging/logger';
import {
  Jurisdiction,
  ComplianceCategory,
  ComplianceRule,
  RiskLevel
} from '../types';

const logger = Logger.getLogger('regulatory-change-detector');

export interface RegulatoryChange {
  id: string;
  jurisdiction: Jurisdiction;
  category: ComplianceCategory;
  type: 'new_rule' | 'rule_update' | 'rule_removal' | 'threshold_change' | 'requirement_change';
  title: string;
  description: string;
  summary: string;
  effectiveDate: Date;
  announcementDate: Date;
  source: string;
  sourceUrl?: string;
  impact: RegulatoryImpact;
  affectedEntities: string[];
  newRequirements: string[];
  modifiedRules: string[];
  removedRules: string[];
  metadata: Record<string, any>;
  processed: boolean;
  implementationDeadline?: Date;
}

export interface RegulatoryImpact {
  severity: RiskLevel;
  scope: 'platform-wide' | 'user-specific' | 'transaction-specific' | 'product-specific';
  estimatedComplianceCost: number;
  implementationComplexity: 'low' | 'medium' | 'high' | 'critical';
  urgency: 'immediate' | 'urgent' | 'normal' | 'low';
  affectedUserCount: number;
  requiredActions: RegulatoryAction[];
  technicalChangesRequired: boolean;
  operationalChangesRequired: boolean;
  policyChangesRequired: boolean;
}

export interface RegulatoryAction {
  id: string;
  type: 'system_update' | 'policy_change' | 'user_notification' | 'compliance_review' | 'implementation';
  description: string;
  priority: RiskLevel;
  deadline: Date;
  responsible: string;
  status: 'pending' | 'in-progress' | 'completed' | 'overdue';
  dependencies: string[];
  estimatedEffort: number; // hours
}

export interface RegulatorySource {
  id: string;
  name: string;
  jurisdiction: Jurisdiction;
  type: 'government' | 'regulator' | 'industry' | 'news' | 'legal';
  url: string;
  enabled: boolean;
  lastChecked: Date;
  checkInterval: number; // minutes
  credibility: number; // 0-100
  categories: ComplianceCategory[];
}

export interface ChangeDetectionConfig {
  sources: RegulatorySource[];
  monitoring: {
    enabled: boolean;
    checkInterval: number;
    batchSize: number;
    maxRetries: number;
  };
  analysis: {
    enableAIAnalysis: boolean;
    confidenceThreshold: number;
    autoProcessing: boolean;
  };
  alerts: {
    immediate: RiskLevel[];
    daily: RiskLevel[];
    weekly: RiskLevel[];
  };
}

export class RegulatoryChangeDetector extends EventEmitter {
  private config: ChangeDetectionConfig;
  private sources: Map<string, RegulatorySource> = new Map();
  private changes: Map<string, RegulatoryChange> = new Map();
  private actions: Map<string, RegulatoryAction> = new Map();
  private isInitialized = false;
  private isRunning = false;
  private monitoringInterval?: NodeJS.Timeout;
  private processingQueue: string[] = [];

  private stats = {
    totalChangesDetected: 0,
    changesProcessed: 0,
    actionsGenerated: 0,
    actionsCompleted: 0,
    sourcesMonitored: 0,
    lastSuccessfulCheck: new Date(),
    averageProcessingTime: 0
  };

  constructor(config: ChangeDetectionConfig) {
    super();
    this.config = config;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.warn('Regulatory Change Detector already initialized');
      return;
    }

    try {
      logger.info('Initializing Regulatory Change Detector...');

      // Load regulatory sources
      await this.loadRegulatorySources();

      // Set up monitoring
      this.setupMonitoring();

      this.isInitialized = true;
      logger.info('✅ Regulatory Change Detector initialized successfully');

      this.emit('detector_initialized', {
        sourcesCount: this.sources.size,
        timestamp: new Date()
      });

    } catch (error) {
      logger.error('Failed to initialize Regulatory Change Detector:', error);
      throw error;
    }
  }

  async start(): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('Regulatory Change Detector must be initialized before starting');
    }

    if (this.isRunning) {
      logger.warn('Regulatory Change Detector already running');
      return;
    }

    try {
      logger.info('Starting Regulatory Change Detector...');

      if (this.config.monitoring.enabled) {
        // Start periodic monitoring
        this.monitoringInterval = setInterval(
          () => this.performMonitoringCycle(),
          this.config.monitoring.checkInterval * 60 * 1000 // Convert minutes to milliseconds
        );

        // Perform initial check
        await this.performMonitoringCycle();
      }

      this.isRunning = true;
      logger.info('🚀 Regulatory Change Detector started successfully');

      this.emit('detector_started', {
        monitoringEnabled: this.config.monitoring.enabled,
        timestamp: new Date()
      });

    } catch (error) {
      logger.error('Failed to start Regulatory Change Detector:', error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      logger.warn('Regulatory Change Detector is not running');
      return;
    }

    try {
      logger.info('Stopping Regulatory Change Detector...');

      if (this.monitoringInterval) {
        clearInterval(this.monitoringInterval);
        this.monitoringInterval = undefined;
      }

      this.isRunning = false;
      logger.info('🛑 Regulatory Change Detector stopped successfully');

      this.emit('detector_stopped', {
        stats: this.getStats(),
        timestamp: new Date()
      });

    } catch (error) {
      logger.error('Failed to stop Regulatory Change Detector:', error);
      throw error;
    }
  }

  /**
   * Manually trigger change detection for specific jurisdiction
   */
  async detectChanges(jurisdiction?: Jurisdiction): Promise<RegulatoryChange[]> {
    const detectedChanges: RegulatoryChange[] = [];

    try {
      const sourcesToCheck = jurisdiction 
        ? Array.from(this.sources.values()).filter(source => source.jurisdiction === jurisdiction)
        : Array.from(this.sources.values());

      for (const source of sourcesToCheck) {
        if (!source.enabled) continue;

        const changes = await this.checkSourceForChanges(source);
        detectedChanges.push(...changes);
      }

      // Process detected changes
      for (const change of detectedChanges) {
        await this.processRegulatoryChange(change);
      }

      logger.info('Manual change detection completed', {
        jurisdiction,
        changesDetected: detectedChanges.length
      });

      return detectedChanges;

    } catch (error) {
      logger.error('Error in manual change detection:', error);
      throw error;
    }
  }

  /**
   * Process a regulatory change and generate actions
   */
  async processRegulatoryChange(change: RegulatoryChange): Promise<void> {
    try {
      logger.info('Processing regulatory change', {
        changeId: change.id,
        jurisdiction: change.jurisdiction,
        type: change.type,
        severity: change.impact.severity
      });

      // Store the change
      this.changes.set(change.id, change);
      this.stats.totalChangesDetected++;

      // Analyze impact if AI analysis is enabled
      if (this.config.analysis.enableAIAnalysis) {
        await this.analyzeChangeImpact(change);
      }

      // Generate required actions
      const actions = this.generateRequiredActions(change);
      for (const action of actions) {
        this.actions.set(action.id, action);
        this.stats.actionsGenerated++;
      }

      // Trigger alerts based on severity
      await this.triggerChangeAlert(change);

      // Auto-process if configured
      if (this.config.analysis.autoProcessing && 
          change.impact.severity !== 'critical' && 
          change.impact.urgency !== 'immediate') {
        await this.autoProcessChange(change);
      }

      change.processed = true;
      this.stats.changesProcessed++;

      this.emit('change_processed', {
        change,
        actionsGenerated: actions.length,
        timestamp: new Date()
      });

    } catch (error) {
      logger.error('Error processing regulatory change:', error);
      throw error;
    }
  }

  /**
   * Get pending regulatory actions
   */
  getPendingActions(jurisdiction?: Jurisdiction): RegulatoryAction[] {
    const actions = Array.from(this.actions.values())
      .filter(action => action.status === 'pending' || action.status === 'in-progress');

    if (jurisdiction) {
      // Filter by jurisdiction through associated changes
      return actions.filter(action => {
        const change = Array.from(this.changes.values())
          .find(c => c.impact.requiredActions.some(a => a.id === action.id));
        return change?.jurisdiction === jurisdiction;
      });
    }

    return actions;
  }

  /**
   * Mark action as completed
   */
  async completeAction(actionId: string, notes?: string): Promise<void> {
    const action = this.actions.get(actionId);
    if (!action) {
      throw new Error(`Action not found: ${actionId}`);
    }

    action.status = 'completed';
    if (notes) {
      action.dependencies.push(`Completion notes: ${notes}`);
    }

    this.stats.actionsCompleted++;

    logger.info('Regulatory action completed', {
      actionId,
      type: action.type,
      description: action.description
    });

    this.emit('action_completed', {
      action,
      notes,
      timestamp: new Date()
    });
  }

  /**
   * Get regulatory changes by criteria
   */
  getChanges(criteria: {
    jurisdiction?: Jurisdiction;
    category?: ComplianceCategory;
    type?: string;
    severity?: RiskLevel;
    processed?: boolean;
    dateRange?: { start: Date; end: Date };
  }): RegulatoryChange[] {
    return Array.from(this.changes.values()).filter(change => {
      if (criteria.jurisdiction && change.jurisdiction !== criteria.jurisdiction) return false;
      if (criteria.category && change.category !== criteria.category) return false;
      if (criteria.type && change.type !== criteria.type) return false;
      if (criteria.severity && change.impact.severity !== criteria.severity) return false;
      if (criteria.processed !== undefined && change.processed !== criteria.processed) return false;
      if (criteria.dateRange) {
        const changeDate = change.announcementDate;
        if (changeDate < criteria.dateRange.start || changeDate > criteria.dateRange.end) return false;
      }
      return true;
    });
  }

  /**
   * Get detector statistics
   */
  getStats(): any {
    return {
      ...this.stats,
      initialized: this.isInitialized,
      running: this.isRunning,
      sourcesActive: Array.from(this.sources.values()).filter(s => s.enabled).length,
      changesUnprocessed: Array.from(this.changes.values()).filter(c => !c.processed).length,
      actionsOverdue: Array.from(this.actions.values()).filter(a => 
        a.status !== 'completed' && a.deadline < new Date()
      ).length
    };
  }

  /**
   * Update configuration
   */
  async updateConfiguration(newConfig: ChangeDetectionConfig): Promise<void> {
    const wasRunning = this.isRunning;
    
    if (wasRunning) {
      await this.stop();
    }

    this.config = newConfig;
    await this.loadRegulatorySources();

    if (wasRunning) {
      await this.start();
    }

    logger.info('Regulatory Change Detector configuration updated');
  }

  // Private methods

  private async loadRegulatorySources(): Promise<void> {
    this.sources.clear();

    for (const source of this.config.sources) {
      if (source.enabled) {
        this.sources.set(source.id, source);
      }
    }

    this.stats.sourcesMonitored = this.sources.size;
    logger.info(`Loaded ${this.sources.size} regulatory sources`);
  }

  private setupMonitoring(): void {
    // Set up event handlers for monitoring
    this.on('change_detected', this.handleChangeDetected.bind(this));
    this.on('source_error', this.handleSourceError.bind(this));
  }

  private async performMonitoringCycle(): Promise<void> {
    const startTime = Date.now();

    try {
      logger.debug('Starting regulatory monitoring cycle');

      const sources = Array.from(this.sources.values()).filter(source => {
        const timeSinceLastCheck = Date.now() - source.lastChecked.getTime();
        const checkIntervalMs = source.checkInterval * 60 * 1000;
        return timeSinceLastCheck >= checkIntervalMs;
      });

      if (sources.length === 0) {
        logger.debug('No sources due for checking');
        return;
      }

      // Process sources in batches
      const batchSize = this.config.monitoring.batchSize;
      for (let i = 0; i < sources.length; i += batchSize) {
        const batch = sources.slice(i, i + batchSize);
        await Promise.all(batch.map(source => this.checkSourceSafely(source)));
      }

      this.stats.lastSuccessfulCheck = new Date();
      this.stats.averageProcessingTime = Date.now() - startTime;

      logger.debug('Regulatory monitoring cycle completed', {
        sourcesChecked: sources.length,
        processingTime: this.stats.averageProcessingTime
      });

    } catch (error) {
      logger.error('Error in regulatory monitoring cycle:', error);
    }
  }

  private async checkSourceSafely(source: RegulatorySource): Promise<void> {
    let retries = 0;
    const maxRetries = this.config.monitoring.maxRetries;

    while (retries <= maxRetries) {
      try {
        const changes = await this.checkSourceForChanges(source);
        
        source.lastChecked = new Date();

        for (const change of changes) {
          this.emit('change_detected', { change, source });
        }

        return; // Success, exit retry loop

      } catch (error) {
        retries++;
        logger.warn(`Error checking source ${source.id}, attempt ${retries}/${maxRetries + 1}:`, error);

        if (retries > maxRetries) {
          this.emit('source_error', { source, error, retries });
          source.lastChecked = new Date(); // Update to prevent immediate retry
        } else {
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, 1000 * retries));
        }
      }
    }
  }

  private async checkSourceForChanges(source: RegulatorySource): Promise<RegulatoryChange[]> {
    // This would integrate with actual regulatory data sources
    // For now, return mock data for demonstration
    logger.debug(`Checking source: ${source.name} (${source.jurisdiction})`);

    // Mock implementation - in reality, this would:
    // 1. Fetch data from the source URL
    // 2. Parse the content for regulatory changes
    // 3. Use AI/NLP to analyze significance
    // 4. Return structured change objects

    const mockChanges: RegulatoryChange[] = [];

    // Simulate occasional change detection
    if (Math.random() < 0.1) { // 10% chance of detecting a change
      const change: RegulatoryChange = {
        id: this.generateChangeId(),
        jurisdiction: source.jurisdiction,
        category: source.categories[0] || 'kyc-aml',
        type: 'rule_update',
        title: `Mock Regulatory Update - ${source.jurisdiction}`,
        description: `Simulated regulatory change detected from ${source.name}`,
        summary: 'This is a mock regulatory change for testing purposes',
        effectiveDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        announcementDate: new Date(),
        source: source.name,
        sourceUrl: source.url,
        impact: {
          severity: 'medium',
          scope: 'platform-wide',
          estimatedComplianceCost: 5000,
          implementationComplexity: 'medium',
          urgency: 'normal',
          affectedUserCount: 100,
          requiredActions: [],
          technicalChangesRequired: true,
          operationalChangesRequired: false,
          policyChangesRequired: true
        },
        affectedEntities: ['all_users'],
        newRequirements: ['Enhanced documentation'],
        modifiedRules: [],
        removedRules: [],
        metadata: {
          sourceCredibility: source.credibility,
          detectionMethod: 'automated'
        },
        processed: false
      };

      mockChanges.push(change);
    }

    return mockChanges;
  }

  private async analyzeChangeImpact(change: RegulatoryChange): Promise<void> {
    // This would use AI/ML to analyze the impact of regulatory changes
    // For now, apply basic heuristics

    // Adjust severity based on content analysis
    if (change.description.toLowerCase().includes('immediate') || 
        change.description.toLowerCase().includes('urgent')) {
      change.impact.urgency = 'immediate';
      change.impact.severity = 'high';
    }

    if (change.newRequirements.length > 3) {
      change.impact.implementationComplexity = 'high';
    }

    logger.debug('Analyzed regulatory change impact', {
      changeId: change.id,
      severity: change.impact.severity,
      urgency: change.impact.urgency,
      complexity: change.impact.implementationComplexity
    });
  }

  private generateRequiredActions(change: RegulatoryChange): RegulatoryAction[] {
    const actions: RegulatoryAction[] = [];
    const baseDeadline = change.effectiveDate || new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);

    // Policy review action
    if (change.impact.policyChangesRequired) {
      actions.push({
        id: this.generateActionId(),
        type: 'policy_change',
        description: `Review and update policies for: ${change.title}`,
        priority: change.impact.severity,
        deadline: new Date(baseDeadline.getTime() - 14 * 24 * 60 * 60 * 1000), // 2 weeks before
        responsible: 'compliance-team',
        status: 'pending',
        dependencies: [],
        estimatedEffort: 8
      });
    }

    // Technical implementation action
    if (change.impact.technicalChangesRequired) {
      actions.push({
        id: this.generateActionId(),
        type: 'system_update',
        description: `Implement technical changes for: ${change.title}`,
        priority: change.impact.severity,
        deadline: new Date(baseDeadline.getTime() - 7 * 24 * 60 * 60 * 1000), // 1 week before
        responsible: 'engineering-team',
        status: 'pending',
        dependencies: [],
        estimatedEffort: change.impact.implementationComplexity === 'high' ? 40 : 16
      });
    }

    // User notification action
    if (change.impact.affectedUserCount > 0) {
      actions.push({
        id: this.generateActionId(),
        type: 'user_notification',
        description: `Notify users about: ${change.title}`,
        priority: 'medium',
        deadline: new Date(baseDeadline.getTime() - 3 * 24 * 60 * 60 * 1000), // 3 days before
        responsible: 'product-team',
        status: 'pending',
        dependencies: [],
        estimatedEffort: 4
      });
    }

    // Update change with generated actions
    change.impact.requiredActions = actions;

    return actions;
  }

  private async triggerChangeAlert(change: RegulatoryChange): Promise<void> {
    const alertConfig = this.config.alerts;
    let shouldAlert = false;
    let alertType = 'daily';

    if (alertConfig.immediate.includes(change.impact.severity) || 
        change.impact.urgency === 'immediate') {
      shouldAlert = true;
      alertType = 'immediate';
    } else if (alertConfig.daily.includes(change.impact.severity)) {
      shouldAlert = true;
      alertType = 'daily';
    } else if (alertConfig.weekly.includes(change.impact.severity)) {
      shouldAlert = true;
      alertType = 'weekly';
    }

    if (shouldAlert) {
      logger.info(`Triggering ${alertType} alert for regulatory change`, {
        changeId: change.id,
        severity: change.impact.severity,
        urgency: change.impact.urgency
      });

      this.emit('regulatory_alert', {
        change,
        alertType,
        timestamp: new Date()
      });
    }
  }

  private async autoProcessChange(change: RegulatoryChange): Promise<void> {
    // Auto-process low-risk changes
    if (change.impact.severity === 'low' && 
        change.impact.implementationComplexity === 'low') {
      
      logger.info('Auto-processing regulatory change', {
        changeId: change.id,
        reason: 'Low risk and complexity'
      });

      // Mark change as processed
      change.processed = true;
      
      // Auto-complete simple actions
      for (const action of change.impact.requiredActions) {
        if (action.type === 'compliance_review' && action.estimatedEffort <= 2) {
          action.status = 'completed';
          this.stats.actionsCompleted++;
        }
      }

      this.emit('change_auto_processed', {
        change,
        timestamp: new Date()
      });
    }
  }

  private generateChangeId(): string {
    return `reg_change_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateActionId(): string {
    return `reg_action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Event handlers

  private async handleChangeDetected(event: { change: RegulatoryChange; source: RegulatorySource }): Promise<void> {
    logger.info('Regulatory change detected', {
      changeId: event.change.id,
      source: event.source.name,
      jurisdiction: event.change.jurisdiction,
      severity: event.change.impact.severity
    });

    await this.processRegulatoryChange(event.change);
  }

  private async handleSourceError(event: { source: RegulatorySource; error: any; retries: number }): Promise<void> {
    logger.error('Regulatory source check failed', {
      sourceId: event.source.id,
      sourceName: event.source.name,
      error: event.error.message,
      retries: event.retries
    });

    // Disable source temporarily if too many failures
    if (event.retries >= this.config.monitoring.maxRetries) {
      event.source.enabled = false;
      logger.warn(`Temporarily disabling source: ${event.source.name}`);
    }
  }
}