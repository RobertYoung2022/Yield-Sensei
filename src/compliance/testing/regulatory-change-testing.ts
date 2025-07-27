/**
 * Automated Testing for Regulatory Changes
 * Framework for testing compliance system responses to regulatory updates
 */

import { EventEmitter } from 'events';
import Logger from '../../shared/logging/logger';
import { ComplianceScenario, ScenarioExecutor, ScenarioResult } from './scenario-framework';
import { ComplianceScenarioLibrary } from './scenario-library';

const logger = Logger.getLogger('regulatory-change-testing');

// Regulatory Change Types
export interface RegulatoryChange {
  id: string;
  name: string;
  description: string;
  jurisdiction: string[];
  effectiveDate: Date;
  type: ChangeType;
  impact: ImpactLevel;
  categories: string[];
  changes: ConfigurationChange[];
  testingRequirements: TestingRequirement[];
  metadata: ChangeMetadata;
}

export interface ConfigurationChange {
  path: string;
  operation: 'add' | 'update' | 'remove';
  oldValue?: any;
  newValue?: any;
  validation?: ValidationRule;
}

export interface TestingRequirement {
  id: string;
  type: TestType;
  scenarios: string[];
  frequency: TestFrequency;
  threshold: SuccessThreshold;
  automated: boolean;
}

export interface ValidationRule {
  type: 'range' | 'enum' | 'pattern' | 'custom';
  constraint: any;
  errorMessage: string;
}

export interface ChangeMetadata {
  source: string;
  reference: string;
  implementationDeadline: Date;
  complianceOfficer: string;
  riskAssessment: RiskAssessment;
  implementationPlan: ImplementationStep[];
}

export interface RiskAssessment {
  overallRisk: 'low' | 'medium' | 'high' | 'critical';
  impactAreas: string[];
  mitigationStrategy: string;
  rollbackPlan: string;
}

export interface ImplementationStep {
  id: string;
  description: string;
  responsible: string;
  deadline: Date;
  dependencies: string[];
  status: 'pending' | 'in_progress' | 'completed' | 'blocked';
}

export interface SuccessThreshold {
  minPassRate: number;
  maxFailureRate: number;
  performanceThreshold?: number;
}

export interface ChangeTestResult {
  changeId: string;
  testId: string;
  executionDate: Date;
  status: 'passed' | 'failed' | 'inconclusive';
  scenarioResults: ScenarioResult[];
  impactAnalysis: ImpactAnalysis;
  recommendations: string[];
  riskAssessment: PostChangeRiskAssessment;
}

export interface ImpactAnalysis {
  functionalImpact: FunctionalImpact[];
  performanceImpact: PerformanceImpact;
  complianceImpact: ComplianceImpact;
  userImpact: UserImpact;
}

export interface FunctionalImpact {
  area: string;
  description: string;
  severity: 'none' | 'low' | 'medium' | 'high' | 'critical';
  affectedScenarios: string[];
}

export interface PerformanceImpact {
  throughputChange: number;
  latencyChange: number;
  resourceUtilizationChange: number;
  scalabilityImpact: string;
}

export interface ComplianceImpact {
  newViolationTypes: string[];
  modifiedThresholds: string[];
  reportingChanges: string[];
  auditTrailImpact: string;
}

export interface UserImpact {
  userExperienceChange: string;
  workflowModifications: string[];
  trainingRequired: boolean;
  communicationPlan: string;
}

export interface PostChangeRiskAssessment {
  residualRisk: 'low' | 'medium' | 'high' | 'critical';
  newRisks: string[];
  mitigatedRisks: string[];
  monitoringRecommendations: string[];
}

// Enums
export type ChangeType = 
  | 'threshold_update'
  | 'new_regulation'
  | 'process_change'
  | 'reporting_requirement'
  | 'sanction_list_update'
  | 'jurisdiction_change'
  | 'technology_update';

export type ImpactLevel = 'low' | 'medium' | 'high' | 'critical';

export type TestType = 
  | 'regression'
  | 'integration'
  | 'performance'
  | 'compliance_validation'
  | 'user_acceptance'
  | 'security';

export type TestFrequency = 
  | 'immediate'
  | 'daily'
  | 'weekly'
  | 'monthly'
  | 'on_change';

// Regulatory Change Test Manager
export class RegulatoryChangeTestManager extends EventEmitter {
  private scenarioExecutor: ScenarioExecutor;
  private activeChanges: Map<string, RegulatoryChange> = new Map();
  private testHistory: Map<string, ChangeTestResult[]> = new Map();
  private isTestingInProgress = false;
  private testQueue: RegulatoryChange[] = [];

  constructor(scenarioExecutor: ScenarioExecutor) {
    super();
    this.scenarioExecutor = scenarioExecutor;
    
    // Start automated testing scheduler
    this.startAutomatedTesting();
    
    logger.info('RegulatoryChangeTestManager initialized');
  }

  /**
   * Register a new regulatory change for testing
   */
  async registerRegulatoryChange(change: RegulatoryChange): Promise<void> {
    try {
      logger.info('Registering regulatory change', {
        changeId: change.id,
        name: change.name,
        effectiveDate: change.effectiveDate
      });

      // Validate change
      this.validateRegulatoryChange(change);

      // Store change
      this.activeChanges.set(change.id, change);

      // Create test plan
      const testPlan = await this.createTestPlan(change);

      // Schedule immediate testing if required
      if (this.requiresImmediateTesting(change)) {
        this.testQueue.push(change);
        await this.processTestQueue();
      }

      // Emit event
      this.emit('changeRegistered', { change, testPlan });

      logger.info('Regulatory change registered successfully', {
        changeId: change.id,
        testsScheduled: testPlan.length
      });

    } catch (error) {
      logger.error('Failed to register regulatory change', {
        error,
        changeId: change.id
      });
      throw error;
    }
  }

  /**
   * Execute tests for a specific regulatory change
   */
  async testRegulatoryChange(changeId: string): Promise<ChangeTestResult> {
    const change = this.activeChanges.get(changeId);
    if (!change) {
      throw new Error(`Regulatory change not found: ${changeId}`);
    }

    try {
      logger.info('Starting regulatory change testing', {
        changeId,
        changeName: change.name
      });

      const testId = this.generateTestId();
      const startTime = new Date();

      // Apply configuration changes temporarily
      await this.applyConfigurationChanges(change.changes);

      // Execute test scenarios
      const scenarioResults = await this.executeTestScenarios(change);

      // Analyze impact
      const impactAnalysis = await this.analyzeImpact(change, scenarioResults);

      // Generate recommendations
      const recommendations = this.generateRecommendations(change, scenarioResults, impactAnalysis);

      // Assess post-change risk
      const riskAssessment = this.assessPostChangeRisk(change, scenarioResults, impactAnalysis);

      // Determine overall status
      const status = this.determineTestStatus(change, scenarioResults);

      // Revert configuration changes
      await this.revertConfigurationChanges(change.changes);

      const result: ChangeTestResult = {
        changeId,
        testId,
        executionDate: startTime,
        status,
        scenarioResults,
        impactAnalysis,
        recommendations,
        riskAssessment
      };

      // Store result
      const history = this.testHistory.get(changeId) || [];
      history.push(result);
      this.testHistory.set(changeId, history);

      logger.info('Regulatory change testing completed', {
        changeId,
        testId,
        status,
        scenariosExecuted: scenarioResults.length
      });

      this.emit('testCompleted', result);

      return result;

    } catch (error) {
      logger.error('Regulatory change testing failed', {
        error,
        changeId
      });
      
      // Ensure configuration is reverted
      await this.revertConfigurationChanges(change.changes);
      
      throw error;
    }
  }

  /**
   * Execute all pending regulatory change tests
   */
  async executeAllPendingTests(): Promise<ChangeTestResult[]> {
    const results: ChangeTestResult[] = [];

    for (const [changeId, change] of this.activeChanges) {
      if (this.shouldExecuteTest(change)) {
        try {
          const result = await this.testRegulatoryChange(changeId);
          results.push(result);
        } catch (error) {
          logger.error('Failed to test regulatory change', {
            error,
            changeId
          });
        }
      }
    }

    return results;
  }

  /**
   * Get test history for a regulatory change
   */
  getTestHistory(changeId: string): ChangeTestResult[] {
    return this.testHistory.get(changeId) || [];
  }

  /**
   * Get all active regulatory changes
   */
  getActiveChanges(): RegulatoryChange[] {
    return Array.from(this.activeChanges.values());
  }

  // Private methods

  private validateRegulatoryChange(change: RegulatoryChange): void {
    if (!change.id || !change.name || !change.effectiveDate) {
      throw new Error('Invalid regulatory change: missing required fields');
    }

    if (change.effectiveDate < new Date()) {
      logger.warn('Regulatory change effective date is in the past', {
        changeId: change.id,
        effectiveDate: change.effectiveDate
      });
    }

    // Validate configuration changes
    for (const configChange of change.changes) {
      if (!configChange.path || !configChange.operation) {
        throw new Error('Invalid configuration change: missing path or operation');
      }
    }
  }

  private async createTestPlan(change: RegulatoryChange): Promise<TestingRequirement[]> {
    const testPlan: TestingRequirement[] = [];

    // Create testing requirements based on change type
    switch (change.type) {
      case 'threshold_update':
        testPlan.push({
          id: `${change.id}_threshold_test`,
          type: 'compliance_validation',
          scenarios: ['velocity_limits', 'transaction_monitoring'],
          frequency: 'immediate',
          threshold: { minPassRate: 95, maxFailureRate: 5 },
          automated: true
        });
        break;

      case 'new_regulation':
        testPlan.push({
          id: `${change.id}_full_regression`,
          type: 'regression',
          scenarios: ['all_aml_scenarios', 'kyc_scenarios'],
          frequency: 'immediate',
          threshold: { minPassRate: 90, maxFailureRate: 10 },
          automated: true
        });
        break;

      case 'sanction_list_update':
        testPlan.push({
          id: `${change.id}_sanctions_test`,
          type: 'compliance_validation',
          scenarios: ['sanctions_screening', 'watchlist_matching'],
          frequency: 'immediate',
          threshold: { minPassRate: 100, maxFailureRate: 0 },
          automated: true
        });
        break;

      default:
        testPlan.push({
          id: `${change.id}_basic_test`,
          type: 'integration',
          scenarios: ['basic_compliance_check'],
          frequency: 'immediate',
          threshold: { minPassRate: 95, maxFailureRate: 5 },
          automated: true
        });
    }

    // Add performance testing for high-impact changes
    if (change.impact === 'high' || change.impact === 'critical') {
      testPlan.push({
        id: `${change.id}_performance_test`,
        type: 'performance',
        scenarios: ['high_volume_stress'],
        frequency: 'immediate',
        threshold: { minPassRate: 95, maxFailureRate: 5, performanceThreshold: 100 },
        automated: true
      });
    }

    return testPlan;
  }

  private requiresImmediateTesting(change: RegulatoryChange): boolean {
    return change.impact === 'critical' || 
           change.type === 'sanction_list_update' ||
           change.effectiveDate <= new Date(Date.now() + 24 * 60 * 60 * 1000); // Within 24 hours
  }

  private async processTestQueue(): Promise<void> {
    if (this.isTestingInProgress || this.testQueue.length === 0) {
      return;
    }

    this.isTestingInProgress = true;

    try {
      while (this.testQueue.length > 0) {
        const change = this.testQueue.shift()!;
        await this.testRegulatoryChange(change.id);
        
        // Add delay between tests
        await this.delay(5000);
      }
    } finally {
      this.isTestingInProgress = false;
    }
  }

  private async executeTestScenarios(change: RegulatoryChange): Promise<ScenarioResult[]> {
    const results: ScenarioResult[] = [];
    
    // Get relevant scenarios based on change type
    const scenarios = this.getRelevantScenarios(change);
    
    for (const scenario of scenarios) {
      try {
        const result = await this.scenarioExecutor.executeScenario(scenario);
        results.push(result);
      } catch (error) {
        logger.error('Scenario execution failed during regulatory change testing', {
          error,
          scenarioId: scenario.id,
          changeId: change.id
        });
      }
    }

    return results;
  }

  private getRelevantScenarios(change: RegulatoryChange): ComplianceScenario[] {
    const allScenarios = ComplianceScenarioLibrary.getAllScenarios();
    
    // Filter scenarios based on change type and categories
    return allScenarios.filter(scenario => {
      // Match by jurisdiction
      const jurisdictionMatch = scenario.jurisdiction.some(j => 
        change.jurisdiction.includes(j)
      );
      
      // Match by category
      const categoryMatch = change.categories.some(cat => 
        scenario.tags.includes(cat) || scenario.category === cat
      );
      
      return jurisdictionMatch && categoryMatch;
    });
  }

  private async applyConfigurationChanges(changes: ConfigurationChange[]): Promise<void> {
    logger.debug('Applying configuration changes for testing');
    
    for (const change of changes) {
      try {
        await this.applyConfigurationChange(change);
      } catch (error) {
        logger.error('Failed to apply configuration change', {
          error,
          change
        });
        throw error;
      }
    }
  }

  private async revertConfigurationChanges(changes: ConfigurationChange[]): Promise<void> {
    logger.debug('Reverting configuration changes after testing');
    
    // Revert in reverse order
    for (let i = changes.length - 1; i >= 0; i--) {
      const change = changes[i];
      try {
        await this.revertConfigurationChange(change);
      } catch (error) {
        logger.error('Failed to revert configuration change', {
          error,
          change
        });
      }
    }
  }

  private async applyConfigurationChange(change: ConfigurationChange): Promise<void> {
    // Implementation would interact with the actual configuration system
    logger.debug('Applying configuration change', {
      path: change.path,
      operation: change.operation,
      newValue: change.newValue
    });
  }

  private async revertConfigurationChange(change: ConfigurationChange): Promise<void> {
    // Implementation would revert the configuration change
    logger.debug('Reverting configuration change', {
      path: change.path,
      operation: change.operation,
      oldValue: change.oldValue
    });
  }

  private async analyzeImpact(
    change: RegulatoryChange, 
    scenarioResults: ScenarioResult[]
  ): Promise<ImpactAnalysis> {
    const functionalImpact = this.analyzeFunctionalImpact(scenarioResults);
    const performanceImpact = this.analyzePerformanceImpact(scenarioResults);
    const complianceImpact = this.analyzeComplianceImpact(change, scenarioResults);
    const userImpact = this.analyzeUserImpact(change, scenarioResults);

    return {
      functionalImpact,
      performanceImpact,
      complianceImpact,
      userImpact
    };
  }

  private analyzeFunctionalImpact(scenarioResults: ScenarioResult[]): FunctionalImpact[] {
    const impacts: FunctionalImpact[] = [];
    
    // Analyze failed scenarios to identify functional impacts
    const failedScenarios = scenarioResults.filter(r => r.status === 'failed');
    
    for (const result of failedScenarios) {
      impacts.push({
        area: 'compliance_detection',
        description: `Scenario ${result.scenarioId} failed after configuration change`,
        severity: 'high',
        affectedScenarios: [result.scenarioId]
      });
    }

    return impacts;
  }

  private analyzePerformanceImpact(scenarioResults: ScenarioResult[]): PerformanceImpact {
    const totalDuration = scenarioResults.reduce((sum, r) => sum + r.duration, 0);
    const avgDuration = totalDuration / scenarioResults.length;
    
    // Compare with baseline (would come from historical data)
    const baselineDuration = 5000; // ms
    const latencyChange = ((avgDuration - baselineDuration) / baselineDuration) * 100;

    return {
      throughputChange: 0,
      latencyChange,
      resourceUtilizationChange: 0,
      scalabilityImpact: latencyChange > 20 ? 'negative' : 'neutral'
    };
  }

  private analyzeComplianceImpact(
    change: RegulatoryChange, 
    scenarioResults: ScenarioResult[]
  ): ComplianceImpact {
    return {
      newViolationTypes: change.categories,
      modifiedThresholds: change.changes.map(c => c.path),
      reportingChanges: [],
      auditTrailImpact: 'Configuration changes logged in audit trail'
    };
  }

  private analyzeUserImpact(
    change: RegulatoryChange, 
    scenarioResults: ScenarioResult[]
  ): UserImpact {
    return {
      userExperienceChange: 'Minimal impact expected',
      workflowModifications: [],
      trainingRequired: change.impact === 'high' || change.impact === 'critical',
      communicationPlan: 'Standard regulatory change communication'
    };
  }

  private generateRecommendations(
    change: RegulatoryChange,
    scenarioResults: ScenarioResult[],
    impactAnalysis: ImpactAnalysis
  ): string[] {
    const recommendations: string[] = [];
    
    const failureRate = scenarioResults.filter(r => r.status === 'failed').length / scenarioResults.length;
    
    if (failureRate > 0.1) {
      recommendations.push('High failure rate detected. Review configuration changes before implementation.');
    }
    
    if (impactAnalysis.performanceImpact.latencyChange > 20) {
      recommendations.push('Significant performance impact detected. Consider performance optimization.');
    }
    
    if (change.impact === 'critical') {
      recommendations.push('Critical change detected. Implement gradual rollout with monitoring.');
    }
    
    return recommendations;
  }

  private assessPostChangeRisk(
    change: RegulatoryChange,
    scenarioResults: ScenarioResult[],
    impactAnalysis: ImpactAnalysis
  ): PostChangeRiskAssessment {
    const failureRate = scenarioResults.filter(r => r.status === 'failed').length / scenarioResults.length;
    
    let residualRisk: 'low' | 'medium' | 'high' | 'critical' = 'low';
    
    if (failureRate > 0.2) {
      residualRisk = 'critical';
    } else if (failureRate > 0.1) {
      residualRisk = 'high';
    } else if (failureRate > 0.05) {
      residualRisk = 'medium';
    }

    return {
      residualRisk,
      newRisks: impactAnalysis.functionalImpact.map(fi => fi.description),
      mitigatedRisks: [],
      monitoringRecommendations: [
        'Monitor compliance detection rates',
        'Track system performance metrics',
        'Review audit logs regularly'
      ]
    };
  }

  private determineTestStatus(
    change: RegulatoryChange,
    scenarioResults: ScenarioResult[]
  ): 'passed' | 'failed' | 'inconclusive' {
    const failureRate = scenarioResults.filter(r => r.status === 'failed').length / scenarioResults.length;
    const errorRate = scenarioResults.filter(r => r.status === 'error').length / scenarioResults.length;
    
    if (errorRate > 0.1) {
      return 'inconclusive';
    }
    
    if (failureRate > 0.1) {
      return 'failed';
    }
    
    return 'passed';
  }

  private shouldExecuteTest(change: RegulatoryChange): boolean {
    const now = new Date();
    const daysSinceEffective = (now.getTime() - change.effectiveDate.getTime()) / (1000 * 60 * 60 * 24);
    
    // Test if change is effective and hasn't been tested recently
    return daysSinceEffective >= 0 && daysSinceEffective <= 30;
  }

  private startAutomatedTesting(): void {
    // Run automated testing every hour
    setInterval(async () => {
      try {
        await this.processTestQueue();
      } catch (error) {
        logger.error('Automated testing failed', { error });
      }
    }, 60 * 60 * 1000);
  }

  private generateTestId(): string {
    return `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export default RegulatoryChangeTestManager;