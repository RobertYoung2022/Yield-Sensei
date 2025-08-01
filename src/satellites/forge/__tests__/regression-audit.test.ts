/**
 * Forge Satellite Regression and Audit Testing Suite
 * Tests the regression testing framework and audit trail functionality
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { RegressionAuditTester, RegressionAuditConfig } from '../testing/regression-audit-tester';
import { ForgeSatellite } from '../forge-satellite';
import { MockFileSystem } from '../../shared/testing/mock-filesystem';

jest.mock('../../shared/logging/logger');

describe('Forge Satellite Regression and Audit Testing', () => {
  let regressionTester: RegressionAuditTester;
  let forgeSatellite: ForgeSatellite;
  let mockFileSystem: MockFileSystem;
  let testConfig: RegressionAuditConfig;

  beforeEach(async () => {
    // Setup mock filesystem
    mockFileSystem = new MockFileSystem();
    await mockFileSystem.initialize();

    // Configure regression testing
    testConfig = {
      enableRegressionTesting: true,
      enablePerformanceRegression: true,
      enableFunctionalRegression: true,
      enableSecurityRegression: true,
      enableCodeQualityAuditing: true,
      enableComplianceAuditing: true,
      enableDataIntegrityAuditing: true,
      enableAccessAuditing: true,
      baselineStoragePath: mockFileSystem.getTempPath('baselines'),
      auditLogPath: mockFileSystem.getTempPath('audit-logs'),
      regressionThresholds: {
        performance: 10, // 10% degradation allowed
        errorRate: 5, // 5% increase allowed
        codeQuality: 80, // Minimum 80% quality score
        testCoverage: 85 // Minimum 85% coverage
      },
      auditRetentionDays: 90,
      continuousMonitoring: false, // Disabled for unit tests
      alertingEnabled: false
    };

    regressionTester = new RegressionAuditTester(testConfig);
    await regressionTester.initialize();

    // Setup forge satellite in test mode
    forgeSatellite = new ForgeSatellite({
      mode: 'test',
      enableRegressionTesting: true,
      regressionTester: regressionTester
    });
    await forgeSatellite.initialize();
  });

  afterEach(async () => {
    await regressionTester.shutdown();
    await forgeSatellite.shutdown();
    await mockFileSystem.cleanup();
  });

  describe('Baseline Management', () => {
    it('should create performance baseline', async () => {
      await regressionTester.updateBaseline('forge', 'performance');
      
      const baselines = regressionTester.getBaselines();
      const performanceBaseline = baselines.get('performance-forge');
      
      expect(performanceBaseline).toBeDefined();
      expect(performanceBaseline?.testType).toBe('performance');
      expect(performanceBaseline?.component).toBe('forge');
      expect(performanceBaseline?.metrics.performance).toBeDefined();
      expect(performanceBaseline?.metrics.performance.latency).toBeGreaterThan(0);
      expect(performanceBaseline?.metrics.performance.throughput).toBeGreaterThan(0);
      expect(performanceBaseline?.version).toBeDefined();
      expect(performanceBaseline?.timestamp).toBeInstanceOf(Date);
    });

    it('should create functional baseline', async () => {
      await regressionTester.updateBaseline('forge', 'functional');
      
      const baselines = regressionTester.getBaselines();
      const functionalBaseline = baselines.get('functional-forge');
      
      expect(functionalBaseline).toBeDefined();
      expect(functionalBaseline?.metrics.functionality).toBeDefined();
      expect(functionalBaseline?.metrics.functionality.testsPassed).toBeGreaterThan(0);
      expect(functionalBaseline?.metrics.functionality.coverage).toBeGreaterThanOrEqual(0);
      expect(functionalBaseline?.metrics.functionality.coverage).toBeLessThanOrEqual(100);
    });

    it('should create security baseline', async () => {
      await regressionTester.updateBaseline('forge', 'security');
      
      const baselines = regressionTester.getBaselines();
      const securityBaseline = baselines.get('security-forge');
      
      expect(securityBaseline).toBeDefined();
      expect(securityBaseline?.metrics.security).toBeDefined();
      expect(securityBaseline?.metrics.security.vulnerabilities).toBeGreaterThanOrEqual(0);
      expect(securityBaseline?.metrics.security.securityScore).toBeGreaterThanOrEqual(0);
      expect(securityBaseline?.metrics.security.complianceLevel).toBeGreaterThanOrEqual(0);
    });

    it('should update existing baseline', async () => {
      // Create initial baseline
      await regressionTester.updateBaseline('forge', 'performance');
      const initialBaselines = regressionTester.getBaselines();
      const initialBaseline = initialBaselines.get('performance-forge');
      const initialTimestamp = initialBaseline?.timestamp;
      
      // Wait a moment to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Update baseline
      await regressionTester.updateBaseline('forge', 'performance');
      const updatedBaselines = regressionTester.getBaselines();
      const updatedBaseline = updatedBaselines.get('performance-forge');
      
      expect(updatedBaseline?.timestamp.getTime()).toBeGreaterThan(initialTimestamp?.getTime() || 0);
    });
  });

  describe('Regression Testing', () => {
    beforeEach(async () => {
      // Create baselines for all test types
      await regressionTester.updateBaseline('forge', 'performance');
      await regressionTester.updateBaseline('forge', 'functional');
      await regressionTester.updateBaseline('forge', 'security');
      await regressionTester.updateBaseline('forge', 'integration');
    });

    it('should run comprehensive regression tests', async () => {
      const testReport = await regressionTester.runComprehensiveRegressionAuditTests();
      
      expect(testReport).toBeDefined();
      expect(testReport.summary.totalTests).toBeGreaterThan(0);
      expect(testReport.regressionTests.length).toBeGreaterThan(0);
      expect(testReport.timestamp).toBeInstanceOf(Date);
    });

    it('should detect performance regression', async () => {
      const testReport = await regressionTester.runComprehensiveRegressionAuditTests();
      
      const performanceRegressions = testReport.regressionTests.filter(
        test => test.testType === 'performance' && test.regressionDetected
      );

      // Performance regressions should be properly detected and categorized
      for (const regression of performanceRegressions) {
        expect(regression.severity).toBeOneOf(['critical', 'high', 'medium', 'low']);
        expect(regression.comparison.percentageChange).toBeGreaterThan(testConfig.regressionThresholds.performance);
        expect(regression.recommendations.length).toBeGreaterThan(0);
        expect(regression.rootCauseAnalysis).toBeDefined();
      }
    });

    it('should detect functional regression', async () => {
      const testReport = await regressionTester.runComprehensiveRegressionAuditTests();
      
      const functionalRegressions = testReport.regressionTests.filter(
        test => test.testType === 'functional' && test.regressionDetected
      );

      for (const regression of functionalRegressions) {
        expect(regression.impactedAreas).toBeInstanceOf(Array);
        expect(regression.rootCauseAnalysis.possibleCauses.length).toBeGreaterThan(0);
        expect(regression.comparison.baseline).toBeDefined();
        expect(regression.comparison.current).toBeDefined();
        expect(regression.comparison.delta).toBeDefined();
      }
    });

    it('should detect security regression', async () => {
      const testReport = await regressionTester.runComprehensiveRegressionAuditTests();
      
      const securityRegressions = testReport.regressionTests.filter(
        test => test.testType === 'security' && test.regressionDetected
      );

      for (const regression of securityRegressions) {
        expect(regression.severity).toBeOneOf(['critical', 'high', 'medium', 'low']);
        
        // Security regressions should be treated seriously
        if (regression.comparison.current.vulnerabilities > regression.comparison.baseline.vulnerabilities) {
          expect(regression.severity).toBeOneOf(['critical', 'high']);
        }
      }
    });

    it('should provide root cause analysis', async () => {
      const testReport = await regressionTester.runComprehensiveRegressionAuditTests();
      
      for (const regressionTest of testReport.regressionTests.filter(t => t.regressionDetected)) {
        expect(regressionTest.rootCauseAnalysis).toBeDefined();
        expect(regressionTest.rootCauseAnalysis.possibleCauses).toBeInstanceOf(Array);
        expect(regressionTest.rootCauseAnalysis.codeChanges).toBeInstanceOf(Array);
        expect(regressionTest.rootCauseAnalysis.configurationChanges).toBeInstanceOf(Array);
        expect(regressionTest.rootCauseAnalysis.dependencyChanges).toBeInstanceOf(Array);
      }
    });

    it('should generate actionable recommendations', async () => {
      const testReport = await regressionTester.runComprehensiveRegressionAuditTests();
      
      for (const regressionTest of testReport.regressionTests.filter(t => t.regressionDetected)) {
        expect(regressionTest.recommendations).toBeInstanceOf(Array);
        expect(regressionTest.recommendations.length).toBeGreaterThan(0);
        
        // Recommendations should be specific and actionable
        for (const recommendation of regressionTest.recommendations) {
          expect(typeof recommendation).toBe('string');
          expect(recommendation.length).toBeGreaterThan(10);
        }
      }
    });
  });

  describe('Audit Trail Management', () => {
    it('should create audit trail entries', async () => {
      await regressionTester.updateBaseline('forge', 'performance');
      
      const auditChain = regressionTester.getAuditChain();
      expect(auditChain.length).toBeGreaterThan(0);
      
      const lastEntry = auditChain[auditChain.length - 1];
      expect(lastEntry).toBeDefined();
      expect(lastEntry.eventType).toBe('baseline_update');
      expect(lastEntry.component).toBe('forge');
      expect(lastEntry.action).toBe('update');
      expect(lastEntry.hash).toBeDefined();
      expect(lastEntry.timestamp).toBeInstanceOf(Date);
    });

    it('should maintain audit chain integrity', async () => {
      // Perform several operations to create audit chain
      await regressionTester.updateBaseline('forge', 'performance');
      await regressionTester.updateBaseline('forge', 'functional');
      await regressionTester.runComprehensiveRegressionAuditTests();
      
      const isIntegrityValid = regressionTester.verifyAuditChainIntegrity();
      expect(isIntegrityValid).toBe(true);
      
      const auditChain = regressionTester.getAuditChain();
      expect(auditChain.length).toBeGreaterThan(2);
      
      // Verify hash chain
      for (let i = 1; i < auditChain.length; i++) {
        expect(auditChain[i].previousHash).toBe(auditChain[i - 1].hash);
      }
    });

    it('should detect audit chain tampering', async () => {
      // Create some audit entries
      await regressionTester.updateBaseline('forge', 'performance');
      await regressionTester.updateBaseline('forge', 'functional');
      
      // Get audit chain and tamper with it
      const auditChain = regressionTester.getAuditChain();
      if (auditChain.length > 1) {
        // Tamper with a hash
        auditChain[1].hash = 'tampered-hash';
        
        const isIntegrityValid = regressionTester.verifyAuditChainIntegrity();
        expect(isIntegrityValid).toBe(false);
      }
    });

    it('should include compliance information in audit entries', async () => {
      await regressionTester.updateBaseline('forge', 'security');
      
      const auditChain = regressionTester.getAuditChain();
      const lastEntry = auditChain[auditChain.length - 1];
      
      expect(lastEntry.compliance).toBeDefined();
      expect(lastEntry.compliance.frameworks).toBeInstanceOf(Array);
      expect(lastEntry.compliance.requirements).toBeInstanceOf(Array);
      expect(lastEntry.compliance.violations).toBeInstanceOf(Array);
    });
  });

  describe('Code Quality Auditing', () => {
    it('should perform code quality audit', async () => {
      const testReport = await regressionTester.runComprehensiveRegressionAuditTests();
      
      expect(testReport.codeQualityAudits.length).toBeGreaterThan(0);
      
      for (const audit of testReport.codeQualityAudits) {
        expect(audit.component).toBeDefined();
        expect(audit.metrics).toBeDefined();
        expect(audit.metrics.cyclomaticComplexity).toBeGreaterThanOrEqual(0);
        expect(audit.metrics.maintainabilityIndex).toBeGreaterThanOrEqual(0);
        expect(audit.metrics.testCoverage).toBeGreaterThanOrEqual(0);
        expect(audit.metrics.testCoverage).toBeLessThanOrEqual(100);
        expect(audit.violations).toBeInstanceOf(Array);
        expect(audit.trends).toBeDefined();
        expect(audit.recommendations).toBeInstanceOf(Array);
      }
    });

    it('should detect code quality regressions', async () => {
      const testReport = await regressionTester.runComprehensiveRegressionAuditTests();
      
      for (const audit of testReport.codeQualityAudits) {
        // If test coverage is below threshold, should be flagged
        if (audit.metrics.testCoverage < testConfig.regressionThresholds.testCoverage) {
          expect(audit.violations.some(v => v.rule.includes('coverage'))).toBe(true);
        }
        
        // Trends should be properly categorized
        expect(audit.trends.complexityTrend).toBeOneOf(['improving', 'stable', 'degrading']);
        expect(audit.trends.coverageTrend).toBeOneOf(['improving', 'stable', 'degrading']);
        expect(audit.trends.debtTrend).toBeOneOf(['improving', 'stable', 'degrading']);
      }
    });

    it('should provide quality improvement recommendations', async () => {
      const testReport = await regressionTester.runComprehensiveRegressionAuditTests();
      
      for (const audit of testReport.codeQualityAudits) {
        expect(audit.recommendations).toBeInstanceOf(Array);
        
        // Should have recommendations if quality issues exist
        if (audit.violations.length > 0 || audit.metrics.testCoverage < 90) {
          expect(audit.recommendations.length).toBeGreaterThan(0);
        }
      }
    });
  });

  describe('Compliance Auditing', () => {
    it('should perform compliance audit', async () => {
      const testReport = await regressionTester.runComprehensiveRegressionAuditTests();
      
      expect(testReport.complianceAudits.length).toBeGreaterThan(0);
      
      for (const audit of testReport.complianceAudits) {
        expect(audit.framework).toBeDefined();
        expect(audit.component).toBeDefined();
        expect(audit.requirements).toBeInstanceOf(Array);
        expect(audit.overallCompliance).toBeGreaterThanOrEqual(0);
        expect(audit.overallCompliance).toBeLessThanOrEqual(100);
        expect(audit.certificationStatus).toBeDefined();
        expect(audit.certificationStatus.readinessScore).toBeGreaterThanOrEqual(0);
        expect(audit.certificationStatus.readinessScore).toBeLessThanOrEqual(100);
      }
    });

    it('should identify compliance gaps', async () => {
      const testReport = await regressionTester.runComprehensiveRegressionAuditTests();
      
      for (const audit of testReport.complianceAudits) {
        for (const requirement of audit.requirements) {
          expect(requirement.requirementId).toBeDefined();
          expect(requirement.description).toBeDefined();
          expect(requirement.status).toBeOneOf(['compliant', 'non-compliant', 'partial', 'not-applicable']);
          expect(requirement.evidence).toBeInstanceOf(Array);
          expect(requirement.gaps).toBeInstanceOf(Array);
          
          // Non-compliant requirements should have gaps identified
          if (requirement.status === 'non-compliant') {
            expect(requirement.gaps.length).toBeGreaterThan(0);
          }
        }
      }
    });

    it('should assess certification readiness', async () => {
      const testReport = await regressionTester.runComprehensiveRegressionAuditTests();
      
      for (const audit of testReport.complianceAudits) {
        expect(audit.certificationStatus.eligible).toBeDefined();
        expect(audit.certificationStatus.blockers).toBeInstanceOf(Array);
        
        // If not eligible, should have blockers identified
        if (!audit.certificationStatus.eligible) {
          expect(audit.certificationStatus.blockers.length).toBeGreaterThan(0);
        }
        
        // Readiness score should correlate with overall compliance
        expect(audit.certificationStatus.readinessScore).toBeLessThanOrEqual(audit.overallCompliance + 10);
      }
    });
  });

  describe('Data Integrity Auditing', () => {
    it('should perform data integrity audit', async () => {
      const testReport = await regressionTester.runComprehensiveRegressionAuditTests();
      
      expect(testReport.dataIntegrityAudits.length).toBeGreaterThan(0);
      
      for (const audit of testReport.dataIntegrityAudits) {
        expect(audit.dataScope).toBeDefined();
        expect(audit.checksPerformed).toBeInstanceOf(Array);
        expect(audit.integrityScore).toBeGreaterThanOrEqual(0);
        expect(audit.integrityScore).toBeLessThanOrEqual(100);
        expect(audit.anomalies).toBeInstanceOf(Array);
        expect(audit.dataLineage).toBeDefined();
      }
    });

    it('should detect data anomalies', async () => {
      const testReport = await regressionTester.runComprehensiveRegressionAuditTests();
      
      for (const audit of testReport.dataIntegrityAudits) {
        for (const anomaly of audit.anomalies) {
          expect(anomaly.type).toBeDefined();
          expect(anomaly.location).toBeDefined();
          expect(anomaly.description).toBeDefined();
          expect(anomaly.severity).toBeOneOf(['critical', 'high', 'medium', 'low']);
          expect(anomaly.dataAffected).toBeGreaterThanOrEqual(0);
        }
        
        // Critical anomalies should impact integrity score significantly
        const criticalAnomalies = audit.anomalies.filter(a => a.severity === 'critical');
        if (criticalAnomalies.length > 0) {
          expect(audit.integrityScore).toBeLessThan(90);
        }
      }
    });

    it('should validate data lineage', async () => {
      const testReport = await regressionTester.runComprehensiveRegressionAuditTests();
      
      for (const audit of testReport.dataIntegrityAudits) {
        expect(audit.dataLineage.source).toBeDefined();
        expect(audit.dataLineage.transformations).toBeInstanceOf(Array);
        
        // Should have comprehensive data lineage tracking
        expect(audit.dataLineage.transformations.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Performance and Scalability', () => {
    it('should complete regression tests within time limits', async () => {
      const startTime = Date.now();
      const testReport = await regressionTester.runComprehensiveRegressionAuditTests();
      const duration = Date.now() - startTime;
      
      expect(duration).toBeLessThan(120000); // < 2 minutes
      expect(testReport.summary.totalTests).toBeGreaterThan(10);
      expect(testReport.summary.testDuration).toBeLessThan(120000);
    });

    it('should handle multiple concurrent regression tests', async () => {
      const promises = [
        regressionTester.updateBaseline('forge', 'performance'),
        regressionTester.updateBaseline('forge', 'functional'),
        regressionTester.updateBaseline('forge', 'security')
      ];
      
      await Promise.all(promises);
      
      const baselines = regressionTester.getBaselines();
      expect(baselines.size).toBe(3);
      expect(baselines.has('performance-forge')).toBe(true);
      expect(baselines.has('functional-forge')).toBe(true);
      expect(baselines.has('security-forge')).toBe(true);
    });

    it('should maintain audit chain integrity under load', async () => {
      // Perform many operations concurrently
      const operations = [];
      for (let i = 0; i < 10; i++) {
        operations.push(regressionTester.updateBaseline('forge', 'performance'));
      }
      
      await Promise.allSettled(operations);
      
      const isIntegrityValid = regressionTester.verifyAuditChainIntegrity();
      expect(isIntegrityValid).toBe(true);
      
      const auditChain = regressionTester.getAuditChain();
      expect(auditChain.length).toBeGreaterThan(5);
    });
  });

  describe('Test Report Generation', () => {
    it('should generate comprehensive test report', async () => {
      const testReport = await regressionTester.runComprehensiveRegressionAuditTests();
      
      expect(testReport).toBeDefined();
      expect(testReport.summary).toBeDefined();
      expect(testReport.summary.totalTests).toBeGreaterThan(0);
      expect(testReport.summary.testDuration).toBeGreaterThan(0);
      expect(testReport.regressionTests).toBeInstanceOf(Array);
      expect(testReport.codeQualityAudits).toBeInstanceOf(Array);
      expect(testReport.complianceAudits).toBeInstanceOf(Array);
      expect(testReport.dataIntegrityAudits).toBeInstanceOf(Array);
      expect(testReport.timestamp).toBeInstanceOf(Date);
    });

    it('should include regression summary statistics', async () => {
      const testReport = await regressionTester.runComprehensiveRegressionAuditTests();
      
      expect(testReport.summary.regressionsDetected).toBeGreaterThanOrEqual(0);
      expect(testReport.summary.criticalRegressions).toBeGreaterThanOrEqual(0);
      expect(testReport.summary.overallQualityScore).toBeGreaterThanOrEqual(0);
      expect(testReport.summary.overallQualityScore).toBeLessThanOrEqual(100);
      expect(testReport.summary.recommendations).toBeInstanceOf(Array);
    });

    it('should provide actionable insights', async () => {
      const testReport = await regressionTester.runComprehensiveRegressionAuditTests();
      
      expect(testReport.insights).toBeDefined();
      expect(testReport.insights.qualityTrends).toBeInstanceOf(Array);
      expect(testReport.insights.riskAreas).toBeInstanceOf(Array);
      expect(testReport.insights.improvementOpportunities).toBeInstanceOf(Array);
      
      if (testReport.summary.regressionsDetected > 0) {
        expect(testReport.insights.riskAreas.length).toBeGreaterThan(0);
        expect(testReport.insights.improvementOpportunities.length).toBeGreaterThan(0);
      }
    });
  });
});