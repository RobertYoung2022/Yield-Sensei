/**
 * Compliance Rule Engine
 * Dynamic rule evaluation and management for regulatory compliance
 */

import { EventEmitter } from 'events';
import Logger from '../../shared/logging/logger';
import {
  ComplianceRule,
  ComplianceConfig,
  Jurisdiction,
  ComplianceCategory,
  RuleCondition,
  RuleAction,
  ComplianceViolation,
  User,
  Transaction,
  RiskLevel
} from '../types';

const logger = Logger.getLogger('rule-engine');

export class RuleEngine extends EventEmitter {
  private rules: Map<string, ComplianceRule> = new Map();
  private jurisdictionRules: Map<Jurisdiction, ComplianceRule[]> = new Map();
  private categoryRules: Map<ComplianceCategory, ComplianceRule[]> = new Map();
  private config: ComplianceConfig;
  private isInitialized = false;

  constructor(config: ComplianceConfig) {
    super();
    this.config = config;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.warn('Rule Engine already initialized');
      return;
    }

    try {
      logger.info('Initializing Rule Engine...');

      // Load default rules from configuration
      await this.loadDefaultRules();

      // Build lookup indices
      this.buildRuleIndices();

      this.isInitialized = true;
      logger.info('✅ Rule Engine initialized successfully');

    } catch (error) {
      logger.error('Failed to initialize Rule Engine:', error);
      throw error;
    }
  }

  async updateConfiguration(newConfig: ComplianceConfig): Promise<void> {
    this.config = newConfig;
    
    // Clear existing rules and reload
    this.rules.clear();
    this.jurisdictionRules.clear();
    this.categoryRules.clear();
    
    await this.loadDefaultRules();
    this.buildRuleIndices();

    logger.info('Rule Engine configuration updated');
  }

  /**
   * Get applicable rules for a specific jurisdiction and category
   */
  async getApplicableRules(
    jurisdiction: Jurisdiction,
    category: ComplianceCategory,
    context: Record<string, any> = {}
  ): Promise<ComplianceRule[]> {
    const jurisdictionRules = this.jurisdictionRules.get(jurisdiction) || [];
    const categoryRules = this.categoryRules.get(category) || [];
    
    // Find intersection of jurisdiction and category rules
    const applicableRules = jurisdictionRules.filter(rule => 
      categoryRules.some(catRule => catRule.id === rule.id)
    );

    // Filter by context conditions
    const contextFilteredRules = applicableRules.filter(rule => 
      this.evaluateRuleConditions(rule, context)
    );

    logger.debug('Found applicable rules', {
      jurisdiction,
      category,
      contextRulesCount: contextFilteredRules.length,
      totalRulesCount: applicableRules.length
    });

    return contextFilteredRules;
  }

  /**
   * Evaluate a user against compliance rules
   */
  async evaluateUserCompliance(user: User): Promise<ComplianceViolation[]> {
    const violations: ComplianceViolation[] = [];

    try {
      const applicableRules = await this.getApplicableRules(
        user.jurisdiction,
        'kyc-aml',
        { 
          activityLevel: user.activityLevel,
          riskLevel: user.riskProfile.overallRisk 
        }
      );

      for (const rule of applicableRules) {
        const violation = await this.evaluateUserAgainstRule(user, rule);
        if (violation) {
          violations.push(violation);
        }
      }

      if (violations.length > 0) {
        this.emit('violations_detected', {
          entityType: 'user',
          entityId: user.id,
          violations,
          timestamp: new Date()
        });
      }

    } catch (error) {
      logger.error('Error evaluating user compliance:', error);
      throw error;
    }

    return violations;
  }

  /**
   * Evaluate a transaction against compliance rules
   */
  async evaluateTransactionCompliance(
    transaction: Transaction,
    user: User
  ): Promise<ComplianceViolation[]> {
    const violations: ComplianceViolation[] = [];

    try {
      const applicableRules = await this.getApplicableRules(
        user.jurisdiction,
        'kyc-aml',
        {
          transactionType: transaction.type,
          amount: transaction.amount,
          currency: transaction.currency,
          activityLevel: user.activityLevel
        }
      );

      for (const rule of applicableRules) {
        const violation = await this.evaluateTransactionAgainstRule(transaction, user, rule);
        if (violation) {
          violations.push(violation);
        }
      }

      if (violations.length > 0) {
        this.emit('violations_detected', {
          entityType: 'transaction',
          entityId: transaction.id,
          violations,
          timestamp: new Date()
        });
      }

    } catch (error) {
      logger.error('Error evaluating transaction compliance:', error);
      throw error;
    }

    return violations;
  }

  /**
   * Add a new rule dynamically
   */
  async addRule(rule: ComplianceRule): Promise<void> {
    this.rules.set(rule.id, rule);
    this.addRuleToIndices(rule);

    logger.info('Rule added', { ruleId: rule.id, jurisdiction: rule.jurisdiction, category: rule.category });

    this.emit('rule_added', {
      rule,
      timestamp: new Date()
    });
  }

  /**
   * Update an existing rule
   */
  async updateRule(ruleId: string, updates: Partial<ComplianceRule>): Promise<void> {
    const existingRule = this.rules.get(ruleId);
    if (!existingRule) {
      throw new Error(`Rule not found: ${ruleId}`);
    }

    const updatedRule = { ...existingRule, ...updates, lastUpdated: new Date() };
    this.rules.set(ruleId, updatedRule);

    // Rebuild indices
    this.buildRuleIndices();

    logger.info('Rule updated', { ruleId, changes: Object.keys(updates) });

    this.emit('rule_updated', {
      ruleId,
      rule: updatedRule,
      changes: updates,
      timestamp: new Date()
    });
  }

  /**
   * Remove a rule
   */
  async removeRule(ruleId: string): Promise<void> {
    const rule = this.rules.get(ruleId);
    if (!rule) {
      throw new Error(`Rule not found: ${ruleId}`);
    }

    this.rules.delete(ruleId);
    this.buildRuleIndices();

    logger.info('Rule removed', { ruleId });

    this.emit('rule_removed', {
      ruleId,
      rule,
      timestamp: new Date()
    });
  }

  /**
   * Get rule by ID
   */
  getRule(ruleId: string): ComplianceRule | undefined {
    return this.rules.get(ruleId);
  }

  /**
   * Get all rules for a jurisdiction
   */
  getRulesByJurisdiction(jurisdiction: Jurisdiction): ComplianceRule[] {
    return this.jurisdictionRules.get(jurisdiction) || [];
  }

  /**
   * Get all rules for a category
   */
  getRulesByCategory(category: ComplianceCategory): ComplianceRule[] {
    return this.categoryRules.get(category) || [];
  }

  /**
   * Get engine status
   */
  getStatus(): any {
    return {
      initialized: this.isInitialized,
      totalRules: this.rules.size,
      jurisdictionBreakdown: Array.from(this.jurisdictionRules.entries()).map(([jurisdiction, rules]) => ({
        jurisdiction,
        count: rules.length
      })),
      categoryBreakdown: Array.from(this.categoryRules.entries()).map(([category, rules]) => ({
        category,
        count: rules.length
      }))
    };
  }

  // Private methods

  private async loadDefaultRules(): Promise<void> {
    // Load jurisdiction-specific rules
    for (const jurisdictionConfig of this.config.jurisdictions) {
      if (!jurisdictionConfig.enabled) continue;

      for (const requirement of jurisdictionConfig.requirements) {
        const rule = this.createRuleFromRequirement(jurisdictionConfig.jurisdiction, requirement);
        this.rules.set(rule.id, rule);
      }

      // Load threshold-based rules
      for (const threshold of jurisdictionConfig.thresholds) {
        const rule = this.createRuleFromThreshold(jurisdictionConfig.jurisdiction, threshold);
        this.rules.set(rule.id, rule);
      }
    }

    // Load KYC rules
    for (const kycRequirement of this.config.kyc.requirements) {
      const rule = this.createKYCRule(kycRequirement);
      this.rules.set(rule.id, rule);
    }

    logger.info(`Loaded ${this.rules.size} default rules`);
  }

  private createRuleFromRequirement(jurisdiction: Jurisdiction, requirement: any): ComplianceRule {
    return {
      id: `${jurisdiction.toLowerCase()}_${requirement.category}_${Date.now()}`,
      jurisdiction,
      category: requirement.category,
      name: `${jurisdiction} ${requirement.category} Requirement`,
      description: requirement.description,
      severity: this.mapLevelToSeverity(requirement.level),
      requirements: [requirement.description],
      conditions: [
        {
          field: 'jurisdiction',
          operator: 'equals',
          value: jurisdiction,
          description: `Must be in ${jurisdiction} jurisdiction`
        }
      ],
      actions: [
        {
          type: requirement.required ? 'require_review' : 'flag',
          parameters: { category: requirement.category },
          description: `${requirement.required ? 'Require manual review' : 'Flag for attention'}`
        }
      ],
      effectiveDate: new Date(),
      lastUpdated: new Date(),
      source: 'configuration',
      version: '1.0.0'
    };
  }

  private createRuleFromThreshold(jurisdiction: Jurisdiction, threshold: any): ComplianceRule {
    return {
      id: `${jurisdiction.toLowerCase()}_threshold_${threshold.name}`,
      jurisdiction,
      category: 'kyc-aml',
      name: `${jurisdiction} ${threshold.name} Threshold`,
      description: `${threshold.name} threshold monitoring for ${jurisdiction}`,
      severity: 'medium',
      requirements: [`Monitor ${threshold.name} threshold of ${threshold.value} ${threshold.currency}`],
      conditions: [
        {
          field: 'amount',
          operator: 'greater_than',
          value: threshold.value,
          description: `Amount exceeds ${threshold.value} ${threshold.currency}`
        },
        {
          field: 'currency',
          operator: 'equals',
          value: threshold.currency,
          description: `Currency is ${threshold.currency}`
        }
      ],
      actions: [
        {
          type: threshold.action.includes('file') ? 'report' : 'flag',
          parameters: { 
            action: threshold.action,
            threshold: threshold.value,
            timeframe: threshold.timeframe
          },
          description: `Execute ${threshold.action} when threshold exceeded`
        }
      ],
      effectiveDate: new Date(),
      lastUpdated: new Date(),
      source: 'configuration',
      version: '1.0.0'
    };
  }

  private createKYCRule(kycRequirement: any): ComplianceRule {
    return {
      id: `kyc_${kycRequirement.activityLevel}_${kycRequirement.requiredLevel}`,
      jurisdiction: 'US', // Default jurisdiction for global KYC rules
      category: 'kyc-aml',
      name: `KYC ${kycRequirement.requiredLevel} for ${kycRequirement.activityLevel}`,
      description: `KYC verification requirements for ${kycRequirement.activityLevel} users`,
      severity: kycRequirement.enhancedDueDiligence ? 'high' : 'medium',
      requirements: kycRequirement.documents,
      conditions: [
        {
          field: 'activityLevel',
          operator: 'equals',
          value: kycRequirement.activityLevel,
          description: `User activity level is ${kycRequirement.activityLevel}`
        }
      ],
      actions: [
        {
          type: 'require_review',
          parameters: {
            kycLevel: kycRequirement.requiredLevel,
            documents: kycRequirement.documents,
            enhancedDueDiligence: kycRequirement.enhancedDueDiligence
          },
          description: `Require ${kycRequirement.requiredLevel} KYC verification`
        }
      ],
      effectiveDate: new Date(),
      lastUpdated: new Date(),
      source: 'configuration',
      version: '1.0.0'
    };
  }

  private buildRuleIndices(): void {
    this.jurisdictionRules.clear();
    this.categoryRules.clear();

    for (const rule of this.rules.values()) {
      // Index by jurisdiction
      if (!this.jurisdictionRules.has(rule.jurisdiction)) {
        this.jurisdictionRules.set(rule.jurisdiction, []);
      }
      this.jurisdictionRules.get(rule.jurisdiction)!.push(rule);

      // Index by category
      if (!this.categoryRules.has(rule.category)) {
        this.categoryRules.set(rule.category, []);
      }
      this.categoryRules.get(rule.category)!.push(rule);
    }
  }

  private addRuleToIndices(rule: ComplianceRule): void {
    // Add to jurisdiction index
    if (!this.jurisdictionRules.has(rule.jurisdiction)) {
      this.jurisdictionRules.set(rule.jurisdiction, []);
    }
    this.jurisdictionRules.get(rule.jurisdiction)!.push(rule);

    // Add to category index
    if (!this.categoryRules.has(rule.category)) {
      this.categoryRules.set(rule.category, []);
    }
    this.categoryRules.get(rule.category)!.push(rule);
  }

  private evaluateRuleConditions(rule: ComplianceRule, context: Record<string, any>): boolean {
    return rule.conditions.every(condition => 
      this.evaluateCondition(condition, context)
    );
  }

  private evaluateCondition(condition: RuleCondition, context: Record<string, any>): boolean {
    const fieldValue = context[condition.field];
    
    switch (condition.operator) {
      case 'equals':
        return fieldValue === condition.value;
      case 'greater_than':
        return typeof fieldValue === 'number' && fieldValue > condition.value;
      case 'less_than':
        return typeof fieldValue === 'number' && fieldValue < condition.value;
      case 'contains':
        return typeof fieldValue === 'string' && fieldValue.includes(condition.value);
      case 'in_list':
        return Array.isArray(condition.value) && condition.value.includes(fieldValue);
      case 'regex':
        return typeof fieldValue === 'string' && new RegExp(condition.value).test(fieldValue);
      default:
        logger.warn('Unknown condition operator', { operator: condition.operator });
        return false;
    }
  }

  private async evaluateUserAgainstRule(user: User, rule: ComplianceRule): Promise<ComplianceViolation | null> {
    const context = {
      jurisdiction: user.jurisdiction,
      activityLevel: user.activityLevel,
      riskLevel: user.riskProfile.overallRisk,
      kycStatus: user.kycStatus.status,
      kycLevel: user.kycStatus.level
    };

    if (!this.evaluateRuleConditions(rule, context)) {
      return null; // Rule doesn't apply
    }

    // Check if user violates the rule
    const violation = this.checkUserViolation(user, rule);
    
    if (violation) {
      logger.warn('User compliance violation detected', {
        userId: user.id,
        ruleId: rule.id,
        violation: violation.description
      });
    }

    return violation;
  }

  private async evaluateTransactionAgainstRule(
    transaction: Transaction,
    user: User,
    rule: ComplianceRule
  ): Promise<ComplianceViolation | null> {
    const context = {
      jurisdiction: user.jurisdiction,
      transactionType: transaction.type,
      amount: transaction.amount,
      currency: transaction.currency,
      activityLevel: user.activityLevel
    };

    if (!this.evaluateRuleConditions(rule, context)) {
      return null; // Rule doesn't apply
    }

    // Check if transaction violates the rule
    const violation = this.checkTransactionViolation(transaction, user, rule);
    
    if (violation) {
      logger.warn('Transaction compliance violation detected', {
        transactionId: transaction.id,
        userId: user.id,
        ruleId: rule.id,
        violation: violation.description
      });
    }

    return violation;
  }

  private checkUserViolation(user: User, rule: ComplianceRule): ComplianceViolation | null {
    // Example: Check KYC compliance
    if (rule.category === 'kyc-aml' && rule.name.includes('KYC')) {
      const requiredLevel = rule.actions[0]?.parameters?.['kycLevel'];
      const userLevel = user.kycStatus.level;
      
      const levelHierarchy = { 'basic': 1, 'enhanced': 2, 'professional': 3, 'institutional': 4 };
      const requiredLevelValue = levelHierarchy[requiredLevel] || 0;
      const userLevelValue = levelHierarchy[userLevel] || 0;
      
      if (userLevelValue < requiredLevelValue || user.kycStatus.status !== 'approved') {
        return {
          id: this.generateViolationId(),
          ruleId: rule.id,
          entityType: 'user',
          entityId: user.id,
          jurisdiction: user.jurisdiction,
          category: rule.category,
          severity: rule.severity,
          description: `User does not meet KYC requirements: requires ${requiredLevel}, has ${userLevel}`,
          details: {
            requiredLevel,
            currentLevel: userLevel,
            kycStatus: user.kycStatus.status
          },
          detectedAt: new Date(),
          status: 'open',
          escalated: false
        };
      }
    }

    return null;
  }

  private checkTransactionViolation(
    transaction: Transaction,
    user: User,
    rule: ComplianceRule
  ): ComplianceViolation | null {
    // Example: Check transaction amount thresholds
    if (rule.name.includes('threshold')) {
      const thresholdCondition = rule.conditions.find(c => c.field === 'amount');
      if (thresholdCondition && transaction.amount > thresholdCondition.value) {
        return {
          id: this.generateViolationId(),
          ruleId: rule.id,
          entityType: 'transaction',
          entityId: transaction.id,
          jurisdiction: user.jurisdiction,
          category: rule.category,
          severity: rule.severity,
          description: `Transaction amount exceeds threshold: ${transaction.amount} > ${thresholdCondition.value}`,
          details: {
            amount: transaction.amount,
            threshold: thresholdCondition.value,
            currency: transaction.currency,
            type: transaction.type
          },
          detectedAt: new Date(),
          status: 'open',
          escalated: false
        };
      }
    }

    return null;
  }

  private mapLevelToSeverity(level: string): RiskLevel {
    const mapping: Record<string, RiskLevel> = {
      'basic': 'low',
      'enhanced': 'medium',
      'institutional': 'high'
    };
    return mapping[level] || 'medium';
  }

  private generateViolationId(): string {
    return `viol_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}