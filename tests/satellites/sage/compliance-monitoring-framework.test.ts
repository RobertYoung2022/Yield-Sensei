/**
 * Compliance Monitoring Framework Tests
 * Comprehensive test suite for regulatory compliance monitoring and assessment
 */

import { jest } from '@jest/globals';
import { 
  ComplianceMonitoringFramework,
  DEFAULT_COMPLIANCE_MONITORING_CONFIG
} from '../../../src/satellites/sage/compliance/compliance-monitoring-framework';
import { RWAData, ProtocolData } from '../../../src/satellites/sage/types';

// Mock logger
jest.mock('@/shared/logging/logger', () => ({
  getLogger: jest.fn(() => ({
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }))
}));

describe('Compliance Monitoring Framework', () => {
  let complianceFramework: ComplianceMonitoringFramework;

  const sampleRWAData: RWAData = {
    id: 'rwa-compliance-001',
    type: 'real-estate',
    issuer: 'Compliant Real Estate Fund',
    value: 1000000,
    currency: 'USD',
    maturityDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    yield: 0.065,
    riskRating: 'A',
    collateral: {
      type: 'real-estate',
      value: 1200000,
      ltv: 0.83,
      liquidationThreshold: 0.9
    },
    regulatoryStatus: {
      jurisdiction: 'US',
      complianceLevel: 'compliant',
      licenses: ['SEC-Registered', 'State-Licensed', 'FINRA-Member'],
      restrictions: [],
      lastReview: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // 30 days ago
    },
    complianceScore: 95
  };

  const nonCompliantRWAData: RWAData = {
    ...sampleRWAData,
    id: 'rwa-non-compliant-001',
    regulatoryStatus: {
      jurisdiction: 'US',
      complianceLevel: 'non-compliant',
      licenses: [],
      restrictions: ['No-Transfer', 'Limited-Jurisdiction', 'High-Risk-Warning'],
      lastReview: new Date(Date.now() - 730 * 24 * 60 * 60 * 1000) // 2 years ago
    },
    complianceScore: 25
  };

  const sampleProtocolData: ProtocolData = {
    id: 'protocol-compliance-001',
    name: 'Compliant DeFi Protocol',
    category: 'lending',
    tvl: 500000000,
    volume24h: 25000000,
    users: 15000,
    tokenPrice: 12.50,
    marketCap: 125000000,
    circulatingSupply: 10000000,
    totalSupply: 15000000,
    apy: 0.085,
    fees24h: 125000,
    revenue: 1500000,
    codeAudits: [
      {
        auditor: 'OpenZeppelin',
        date: new Date('2024-01-15'),
        status: 'passed',
        criticalIssues: 0,
        highIssues: 0,
        mediumIssues: 2,
        lowIssues: 5
      }
    ],
    team: {
      size: 25,
      experience: 4.2,
      credibility: 0.95,
      anonymity: false
    },
    governance: {
      tokenHolders: 8500,
      votingPower: 0.75,
      proposalCount: 45,
      participationRate: 0.65
    },
    riskMetrics: {
      volatility: 0.25,
      correlation: 0.15,
      maxDrawdown: 0.35,
      sharpeRatio: 2.1,
      beta: 0.8
    },
    tokenDistribution: [
      { category: 'Team', percentage: 15, vesting: true },
      { category: 'Public', percentage: 60, vesting: false },
      { category: 'Treasury', percentage: 20, vesting: true },
      { category: 'Advisors', percentage: 5, vesting: true }
    ],
    partnerships: ['Chainlink', 'Compound', 'Circle']
  };

  beforeEach(() => {
    // Reset singleton instance
    (ComplianceMonitoringFramework as any).instance = null;
    complianceFramework = ComplianceMonitoringFramework.getInstance();
  });

  afterEach(async () => {
    try {
      await complianceFramework.shutdown();
    } catch (error) {
      // Ignore shutdown errors
    }
  });

  describe('Initialization and Configuration', () => {
    test('should create singleton instance', () => {
      const instance1 = ComplianceMonitoringFramework.getInstance();
      const instance2 = ComplianceMonitoringFramework.getInstance();
      
      expect(instance1).toBe(instance2);
      expect(instance1).toBeInstanceOf(ComplianceMonitoringFramework);
    });

    test('should initialize with custom configuration', async () => {
      const customConfig = {
        ...DEFAULT_COMPLIANCE_MONITORING_CONFIG,
        enableRealTimeMonitoring: true,
        monitoringInterval: 30000, // 30 seconds
        jurisdictions: ['US', 'EU', 'UK'],
        alertThresholds: {
          low: 0.2,
          medium: 0.4,
          high: 0.6,
          critical: 0.8
        }
      };

      const customFramework = ComplianceMonitoringFramework.getInstance(customConfig);
      await expect(customFramework.initialize()).resolves.not.toThrow();
      
      const status = customFramework.getStatus();
      expect(status.isRunning).toBe(true);
    });

    test('should initialize regulatory rules for supported jurisdictions', async () => {
      await complianceFramework.initialize();
      
      const status = complianceFramework.getStatus();
      expect(status.supportedJurisdictions).toContain('US');
      expect(status.supportedJurisdictions).toContain('EU');
      expect(status.activeRuleCount).toBeGreaterThan(0);
    });
  });

  describe('RWA Compliance Assessment', () => {
    beforeEach(async () => {
      await complianceFramework.initialize();
    });

    test('should assess compliant RWA correctly', async () => {
      const assessment = await complianceFramework.assessCompliance(
        sampleRWAData.id,
        'rwa',
        sampleRWAData
      );

      expect(assessment.entityId).toBe(sampleRWAData.id);
      expect(assessment.entityType).toBe('rwa');
      expect(assessment.jurisdiction).toBe(sampleRWAData.regulatoryStatus.jurisdiction);
      expect(assessment.overallScore).toBeGreaterThan(0.7);
      expect(assessment.complianceLevel).toBe('compliant');
      expect(assessment.recommendations).toBeInstanceOf(Array);
      expect(assessment.violations).toBeInstanceOf(Array);
      expect(assessment.violations.length).toBe(0); // Should have no violations
    });

    test('should assess non-compliant RWA correctly', async () => {
      const assessment = await complianceFramework.assessCompliance(
        nonCompliantRWAData.id,
        'rwa',
        nonCompliantRWAData
      );

      expect(assessment.overallScore).toBeLessThan(0.5);
      expect(assessment.complianceLevel).toBe('non-compliant');
      expect(assessment.violations.length).toBeGreaterThan(0);
      expect(assessment.recommendations.length).toBeGreaterThan(0);
      
      // Should have critical recommendations
      const criticalRecs = assessment.recommendations.filter(r => r.priority === 'critical');
      expect(criticalRecs.length).toBeGreaterThan(0);
    });

    test('should evaluate license requirements', async () => {
      const assessment = await complianceFramework.assessCompliance(
        sampleRWAData.id,
        'rwa',
        sampleRWAData
      );

      const licenseEvaluations = assessment.ruleEvaluations.filter(
        rule => rule.category === 'licensing'
      );
      
      expect(licenseEvaluations.length).toBeGreaterThan(0);
      licenseEvaluations.forEach(evaluation => {
        expect(evaluation.passed).toBe(true); // Should pass with proper licenses
        expect(evaluation.score).toBeGreaterThan(0.8);
      });
    });

    test('should detect restriction violations', async () => {
      const restrictedRWA = {
        ...sampleRWAData,
        regulatoryStatus: {
          ...sampleRWAData.regulatoryStatus,
          restrictions: ['Transfer-Prohibited', 'Jurisdiction-Limited']
        }
      };

      const assessment = await complianceFramework.assessCompliance(
        restrictedRWA.id,
        'rwa',
        restrictedRWA
      );

      const restrictionViolations = assessment.violations.filter(
        v => v.category === 'restrictions'
      );
      
      expect(restrictionViolations.length).toBeGreaterThan(0);
      expect(assessment.overallScore).toBeLessThan(0.7);
    });

    test('should consider review recency', async () => {
      const staleReviewRWA = {
        ...sampleRWAData,
        regulatoryStatus: {
          ...sampleRWAData.regulatoryStatus,
          lastReview: new Date(Date.now() - 1095 * 24 * 60 * 60 * 1000) // 3 years ago
        }
      };

      const assessment = await complianceFramework.assessCompliance(
        staleReviewRWA.id,
        'rwa',
        staleReviewRWA
      );

      const reviewViolations = assessment.violations.filter(
        v => v.description.toLowerCase().includes('review')
      );
      
      expect(reviewViolations.length).toBeGreaterThan(0);
    });
  });

  describe('Protocol Compliance Assessment', () => {
    beforeEach(async () => {
      await complianceFramework.initialize();
    });

    test('should assess protocol compliance comprehensively', async () => {
      const assessment = await complianceFramework.assessCompliance(
        sampleProtocolData.id,
        'protocol',
        sampleProtocolData
      );

      expect(assessment.entityId).toBe(sampleProtocolData.id);
      expect(assessment.entityType).toBe('protocol');
      expect(assessment.overallScore).toBeGreaterThan(0);
      expect(assessment.ruleEvaluations).toBeInstanceOf(Array);
      expect(assessment.ruleEvaluations.length).toBeGreaterThan(0);
      
      // Should evaluate multiple compliance categories
      const categories = assessment.ruleEvaluations.map(rule => rule.category);
      expect(categories).toContain('governance');
      expect(categories).toContain('security');
      expect(categories).toContain('transparency');
    });

    test('should evaluate governance compliance', async () => {
      const assessment = await complianceFramework.assessCompliance(
        sampleProtocolData.id,
        'protocol',
        sampleProtocolData
      );

      const governanceRules = assessment.ruleEvaluations.filter(
        rule => rule.category === 'governance'
      );
      
      expect(governanceRules.length).toBeGreaterThan(0);
      governanceRules.forEach(rule => {
        expect(rule.score).toBeGreaterThanOrEqual(0);
        expect(rule.score).toBeLessThanOrEqual(1);
        expect(rule.passed).toBeDefined();
      });
    });

    test('should evaluate team anonymity compliance', async () => {
      const anonymousProtocol = {
        ...sampleProtocolData,
        team: {
          ...sampleProtocolData.team,
          anonymity: true,
          credibility: 0.3
        }
      };

      const assessment = await complianceFramework.assessCompliance(
        anonymousProtocol.id,
        'protocol',
        anonymousProtocol
      );

      const transparencyViolations = assessment.violations.filter(
        v => v.category === 'transparency'
      );
      
      expect(transparencyViolations.length).toBeGreaterThan(0);
      expect(assessment.overallScore).toBeLessThan(0.6);
    });

    test('should evaluate security audit compliance', async () => {
      const unauditedProtocol = {
        ...sampleProtocolData,
        codeAudits: []
      };

      const assessment = await complianceFramework.assessCompliance(
        unauditedProtocol.id,
        'protocol',
        unauditedProtocol
      );

      const securityViolations = assessment.violations.filter(
        v => v.category === 'security'
      );
      
      expect(securityViolations.length).toBeGreaterThan(0);
      
      const criticalRecs = assessment.recommendations.filter(
        r => r.priority === 'critical' && r.category === 'security'
      );
      expect(criticalRecs.length).toBeGreaterThan(0);
    });
  });

  describe('Jurisdiction-Specific Rules', () => {
    beforeEach(async () => {
      await complianceFramework.initialize();
    });

    test('should apply US-specific compliance rules', async () => {
      const usRWA = {
        ...sampleRWAData,
        regulatoryStatus: {
          ...sampleRWAData.regulatoryStatus,
          jurisdiction: 'US'
        }
      };

      const assessment = await complianceFramework.assessCompliance(
        usRWA.id,
        'rwa',
        usRWA
      );

      const usRules = assessment.ruleEvaluations.filter(
        rule => rule.jurisdiction === 'US'
      );
      
      expect(usRules.length).toBeGreaterThan(0);
      
      // Should check for SEC compliance
      const secRules = usRules.filter(rule => 
        rule.description.toLowerCase().includes('sec')
      );
      expect(secRules.length).toBeGreaterThan(0);
    });

    test('should apply EU-specific compliance rules', async () => {
      const euRWA = {
        ...sampleRWAData,
        regulatoryStatus: {
          ...sampleRWAData.regulatoryStatus,
          jurisdiction: 'EU'
        }
      };

      const assessment = await complianceFramework.assessCompliance(
        euRWA.id,
        'rwa',
        euRWA
      );

      const euRules = assessment.ruleEvaluations.filter(
        rule => rule.jurisdiction === 'EU'
      );
      
      expect(euRules.length).toBeGreaterThan(0);
      
      // Should check for MiCA compliance
      const micaRules = euRules.filter(rule => 
        rule.description.toLowerCase().includes('mica') ||
        rule.description.toLowerCase().includes('mifid')
      );
      expect(micaRules.length).toBeGreaterThan(0);
    });

    test('should handle unsupported jurisdictions gracefully', async () => {
      const unsupportedRWA = {
        ...sampleRWAData,
        regulatoryStatus: {
          ...sampleRWAData.regulatoryStatus,
          jurisdiction: 'UNSUPPORTED'
        }
      };

      const assessment = await complianceFramework.assessCompliance(
        unsupportedRWA.id,
        'rwa',
        unsupportedRWA
      );

      // Should still provide assessment with generic rules
      expect(assessment.overallScore).toBeGreaterThan(0);
      expect(assessment.ruleEvaluations.length).toBeGreaterThan(0);
      
      const warnings = assessment.recommendations.filter(
        r => r.description.toLowerCase().includes('jurisdiction')
      );
      expect(warnings.length).toBeGreaterThan(0);
    });
  });

  describe('Real-time Monitoring', () => {
    beforeEach(async () => {
      const monitoringConfig = {
        ...DEFAULT_COMPLIANCE_MONITORING_CONFIG,
        enableRealTimeMonitoring: true,
        monitoringInterval: 100 // Very short interval for testing
      };
      
      complianceFramework = ComplianceMonitoringFramework.getInstance(monitoringConfig);
      await complianceFramework.initialize();
    });

    test('should start real-time monitoring', async () => {
      await complianceFramework.startMonitoring();
      
      const status = complianceFramework.getStatus();
      expect(status.monitoringActive).toBe(true);
      
      await complianceFramework.stopMonitoring();
    });

    test('should detect regulatory changes', (done) => {
      const changeHandler = jest.fn((event: any) => {
        expect(event.type).toBe('regulatory_change');
        expect(event.jurisdiction).toBeDefined();
        expect(event.description).toBeDefined();
        expect(event.impact).toBeDefined();
        expect(event.timestamp).toBeInstanceOf(Date);
        done();
      });

      complianceFramework.on('regulatory_change_detected', changeHandler);
      
      // Simulate regulatory change detection
      complianceFramework.startMonitoring().then(() => {
        // Trigger a mock regulatory change after short delay
        setTimeout(() => {
          complianceFramework.emit('regulatory_change_detected', {
            type: 'regulatory_change',
            jurisdiction: 'US',
            description: 'New SEC guidance on digital assets',
            impact: 'medium',
            timestamp: new Date()
          });
        }, 50);
      });
    });

    test('should trigger compliance alerts', (done) => {
      const alertHandler = jest.fn((event: any) => {
        expect(event.entityId).toBeDefined();
        expect(event.alertLevel).toBeDefined();
        expect(['low', 'medium', 'high', 'critical']).toContain(event.alertLevel);
        expect(event.violations).toBeInstanceOf(Array);
        expect(event.timestamp).toBeInstanceOf(Date);
        done();
      });

      complianceFramework.on('compliance_alert', alertHandler);
      
      // Add a non-compliant entity to trigger alert
      complianceFramework.assessCompliance(
        nonCompliantRWAData.id,
        'rwa',
        nonCompliantRWAData
      ).then(() => {
        // Alert should be triggered automatically
      }).catch(done);
    });
  });

  describe('Compliance Reporting', () => {
    beforeEach(async () => {
      await complianceFramework.initialize();
      
      // Add some assessment data
      await complianceFramework.assessCompliance(
        sampleRWAData.id,
        'rwa',
        sampleRWAData
      );
      await complianceFramework.assessCompliance(
        nonCompliantRWAData.id,
        'rwa',
        nonCompliantRWAData
      );
      await complianceFramework.assessCompliance(
        sampleProtocolData.id,
        'protocol',
        sampleProtocolData
      );
    });

    test('should generate comprehensive compliance report', async () => {
      const report = await complianceFramework.getComplianceReport();

      expect(report).toBeDefined();
      expect(report.summary).toBeDefined();
      expect(report.summary.totalEntities).toBeGreaterThanOrEqual(3);
      expect(report.summary.compliantEntities).toBeGreaterThanOrEqual(1);
      expect(report.summary.nonCompliantEntities).toBeGreaterThanOrEqual(1);
      expect(report.summary.averageScore).toBeGreaterThan(0);
      
      expect(report.assessments).toBeInstanceOf(Array);
      expect(report.assessments.length).toBeGreaterThanOrEqual(3);
      
      expect(report.violations).toBeInstanceOf(Array);
      expect(report.recommendations).toBeInstanceOf(Array);
      expect(report.generatedAt).toBeInstanceOf(Date);
    });

    test('should generate jurisdiction-specific report', async () => {
      const report = await complianceFramework.getComplianceReport(
        undefined,
        'US'
      );

      expect(report.summary.jurisdiction).toBe('US');
      
      // All assessments should be for US jurisdiction
      report.assessments.forEach(assessment => {
        expect(assessment.jurisdiction).toBe('US');
      });
    });

    test('should generate entity-specific report', async () => {
      const report = await complianceFramework.getComplianceReport(
        [sampleRWAData.id, sampleProtocolData.id]
      );

      expect(report.assessments).toHaveLength(2);
      expect(report.assessments.map(a => a.entityId)).toContain(sampleRWAData.id);
      expect(report.assessments.map(a => a.entityId)).toContain(sampleProtocolData.id);
    });

    test('should generate time-range specific report', async () => {
      const timeRange = {
        start: new Date(Date.now() - 24 * 60 * 60 * 1000), // 24 hours ago
        end: new Date()
      };

      const report = await complianceFramework.getComplianceReport(
        undefined,
        undefined,
        timeRange
      );

      expect(report.timeRange).toEqual(timeRange);
      
      report.assessments.forEach(assessment => {
        expect(assessment.timestamp.getTime()).toBeGreaterThanOrEqual(timeRange.start.getTime());
        expect(assessment.timestamp.getTime()).toBeLessThanOrEqual(timeRange.end.getTime());
      });
    });
  });

  describe('Auto-remediation', () => {
    beforeEach(async () => {
      const autoRemediationConfig = {
        ...DEFAULT_COMPLIANCE_MONITORING_CONFIG,
        enableAutoRemediation: true
      };
      
      complianceFramework = ComplianceMonitoringFramework.getInstance(autoRemediationConfig);
      await complianceFramework.initialize();
    });

    test('should trigger auto-remediation for specific violations', async () => {
      const remediationHandler = jest.fn();
      complianceFramework.on('auto_remediation_triggered', remediationHandler);

      await complianceFramework.assessCompliance(
        nonCompliantRWAData.id,
        'rwa',
        nonCompliantRWAData
      );

      // Wait for auto-remediation to be triggered
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(remediationHandler).toHaveBeenCalled();
      
      const remediationEvent = remediationHandler.mock.calls[0][0];
      expect(remediationEvent.entityId).toBe(nonCompliantRWAData.id);
      expect(remediationEvent.actions).toBeInstanceOf(Array);
      expect(remediationEvent.actions.length).toBeGreaterThan(0);
    });

    test('should not trigger auto-remediation for compliant entities', async () => {
      const remediationHandler = jest.fn();
      complianceFramework.on('auto_remediation_triggered', remediationHandler);

      await complianceFramework.assessCompliance(
        sampleRWAData.id,
        'rwa',
        sampleRWAData
      );

      // Wait to ensure no auto-remediation is triggered
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(remediationHandler).not.toHaveBeenCalled();
    });
  });

  describe('Performance and Scalability', () => {
    beforeEach(async () => {
      await complianceFramework.initialize();
    });

    test('should handle multiple concurrent assessments', async () => {
      const entities = Array.from({ length: 10 }, (_, i) => ({
        ...sampleRWAData,
        id: `concurrent-rwa-${i}`,
        complianceScore: 70 + (i * 2)
      }));

      const startTime = Date.now();
      
      const assessments = await Promise.all(
        entities.map(entity => 
          complianceFramework.assessCompliance(entity.id, 'rwa', entity)
        )
      );
      
      const totalTime = Date.now() - startTime;
      
      expect(totalTime).toBeLessThan(10000); // Should complete within 10 seconds
      expect(assessments).toHaveLength(10);
      
      assessments.forEach(assessment => {
        expect(assessment.overallScore).toBeGreaterThan(0);
      });
    });

    test('should maintain performance with large rule sets', async () => {
      // Simulate assessment with many rules
      const startTime = Date.now();
      
      await complianceFramework.assessCompliance(
        sampleRWAData.id,
        'rwa',
        sampleRWAData
      );
      
      const assessmentTime = Date.now() - startTime;
      
      expect(assessmentTime).toBeLessThan(5000); // Should complete within 5 seconds
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      await complianceFramework.initialize();
    });

    test('should handle invalid entity data', async () => {
      const invalidEntity = {
        id: 'invalid-001',
        // Missing required fields
      };

      await expect(
        complianceFramework.assessCompliance(
          invalidEntity.id,
          'rwa',
          invalidEntity as any
        )
      ).rejects.toThrow();
    });

    test('should handle unsupported entity types', async () => {
      await expect(
        complianceFramework.assessCompliance(
          'test-001',
          'unsupported-type' as any,
          sampleRWAData
        )
      ).rejects.toThrow();
    });

    test('should recover from assessment errors', async () => {
      // Cause an error
      try {
        await complianceFramework.assessCompliance(
          'invalid',
          'rwa',
          null as any
        );
      } catch (error) {
        // Expected error
      }

      // Should still work for valid data
      const assessment = await complianceFramework.assessCompliance(
        sampleRWAData.id,
        'rwa',
        sampleRWAData
      );
      
      expect(assessment.overallScore).toBeGreaterThan(0);
    });
  });

  describe('Configuration and Status', () => {
    test('should provide accurate status information', async () => {
      await complianceFramework.initialize();
      
      const status = complianceFramework.getStatus();
      
      expect(status.isRunning).toBe(true);
      expect(status.supportedJurisdictions).toBeInstanceOf(Array);
      expect(status.supportedJurisdictions.length).toBeGreaterThan(0);
      expect(status.activeRuleCount).toBeGreaterThan(0);
      expect(status.assessmentCount).toBeDefined();
      expect(status.lastAssessmentTime).toBeInstanceOf(Date);
    });

    test('should handle configuration updates', async () => {
      await complianceFramework.initialize();
      
      const newConfig = {
        ...DEFAULT_COMPLIANCE_MONITORING_CONFIG,
        alertThresholds: {
          low: 0.1,
          medium: 0.3,
          high: 0.5,
          critical: 0.7
        }
      };

      await expect(complianceFramework.updateConfig(newConfig))
        .resolves.not.toThrow();
    });

    test('should shutdown gracefully', async () => {
      await complianceFramework.initialize();
      await complianceFramework.startMonitoring();
      
      await expect(complianceFramework.shutdown()).resolves.not.toThrow();
      
      const status = complianceFramework.getStatus();
      expect(status.isRunning).toBe(false);
      expect(status.monitoringActive).toBe(false);
    });
  });
});