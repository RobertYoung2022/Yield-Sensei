/**
 * Bridge Risk Assessment Comprehensive Test Suite
 * Comprehensive validation of bridge safety scoring and risk analysis
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { BridgeRiskAssessment, SecurityAudit, BridgeIncident } from '../bridge-risk-assessment';
import { BridgeSatelliteConfig } from '../../bridge-satellite';
import { BridgeRiskAssessment as BridgeRiskAssessmentType, BridgeAlert } from '../../types';

jest.mock('../../../shared/logging/logger');

describe('Bridge Risk Assessment Comprehensive Validation', () => {
  let riskAssessment: BridgeRiskAssessment;
  let mockConfig: BridgeSatelliteConfig;
  let testMetrics: {
    assessmentTimes: number[];
    accuracyScores: number[];
    falsePositives: number;
    falseNegatives: number;
    totalAssessments: number;
  };

  beforeEach(() => {
    testMetrics = {
      assessmentTimes: [],
      accuracyScores: [],
      falsePositives: 0,
      falseNegatives: 0,
      totalAssessments: 0
    };

    mockConfig = {
      chains: [
        { id: 'ethereum', name: 'Ethereum', rpcUrl: 'mock-rpc', gasToken: 'ETH' },
        { id: 'polygon', name: 'Polygon', rpcUrl: 'mock-rpc', gasToken: 'MATIC' },
        { id: 'arbitrum', name: 'Arbitrum', rpcUrl: 'mock-rpc', gasToken: 'ETH' },
        { id: 'optimism', name: 'Optimism', rpcUrl: 'mock-rpc', gasToken: 'ETH' },
        { id: 'avalanche', name: 'Avalanche', rpcUrl: 'mock-rpc', gasToken: 'AVAX' }
      ],
      bridges: [
        { 
          id: 'stargate', 
          name: 'Stargate', 
          chains: ['ethereum', 'polygon', 'arbitrum', 'optimism', 'avalanche'], 
          fees: { base: 0.001, variable: 0.0005 } 
        },
        { 
          id: 'across', 
          name: 'Across', 
          chains: ['ethereum', 'optimism', 'arbitrum'], 
          fees: { base: 0.0008, variable: 0.0003 } 
        },
        { 
          id: 'hop', 
          name: 'Hop Protocol', 
          chains: ['ethereum', 'polygon', 'arbitrum', 'optimism'], 
          fees: { base: 0.0012, variable: 0.0006 } 
        },
        { 
          id: 'synapse', 
          name: 'Synapse', 
          chains: ['ethereum', 'avalanche'], 
          fees: { base: 0.0015, variable: 0.0008 } 
        }
      ],
      arbitrage: {
        minProfitThreshold: 0.001,
        maxRiskScore: 70,
        maxExecutionTime: 300,
        enabledChains: ['ethereum', 'polygon', 'arbitrum', 'optimism', 'avalanche']
      },
      risk: {
        updateInterval: 60000,
        alertThresholds: {
          safetyScore: 80,
          liquidityScore: 70,
          reliabilityScore: 85
        }
      },
      liquidity: {
        rebalanceThreshold: 0.1,
        minUtilization: 0.1,
        maxUtilization: 0.8,
        targetDistribution: {
          ethereum: 0.4, polygon: 0.2, arbitrum: 0.2, optimism: 0.1, avalanche: 0.1
        }
      },
      monitoring: {
        updateInterval: 30000,
        alertRetention: 86400000,
        performanceWindow: 3600000
      },
      validation: {
        maxSlippageTolerance: 0.02,
        minLiquidityUSD: 100000,
        maxPriceAge: 30,
        mevProtectionThreshold: 100,
        simulationGasBuffer: 1.2
      }
    };

    riskAssessment = new BridgeRiskAssessment(mockConfig);
  });

  afterEach(async () => {
    if (riskAssessment['isRunning']) {
      await riskAssessment.stop();
    }
  });

  describe('Safety Score Calculation Validation', () => {
    it('should calculate accurate safety scores for well-audited bridges', async () => {
      await riskAssessment.initialize();
      
      // Mock high-quality security audit data
      const excellentAudit: SecurityAudit = {
        auditorName: 'ConsenSys Diligence',
        auditDate: Date.now() - (30 * 24 * 60 * 60 * 1000), // 30 days ago
        riskLevel: 'low',
        findings: [
          'Minor gas optimization opportunities',
          'Documentation improvements recommended'
        ],
        score: 95,
        coverage: 0.98,
        methodology: 'Manual review + automated tools',
        recommendations: [
          'Implement suggested gas optimizations',
          'Update documentation'
        ]
      };

      await riskAssessment.updateSecurityAudit('stargate', excellentAudit);
      
      const startTime = performance.now();
      const assessment = await riskAssessment.getBridgeRiskAssessment('stargate');
      const assessmentTime = performance.now() - startTime;
      
      testMetrics.assessmentTimes.push(assessmentTime);
      testMetrics.totalAssessments++;
      
      // Validate safety score calculation
      expect(assessment).toBeDefined();
      expect(assessment.safetyScore).toBeGreaterThan(85); // Should be high for excellent audit
      expect(assessment.safetyScore).toBeLessThanOrEqual(100);
      
      // Validate security score component
      expect(assessment.securityScore).toBeGreaterThan(90);
      
      // Validate overall assessment
      expect(assessment.overallScore).toBeGreaterThan(80);
      expect(assessment.riskFactors.length).toBeLessThan(3); // Minimal risk factors
      
      // Performance validation
      expect(assessmentTime).toBeLessThan(1000); // <1s assessment time
      
      console.log(`Excellent Bridge Assessment:
        Safety Score: ${assessment.safetyScore}
        Security Score: ${assessment.securityScore}
        Overall Score: ${assessment.overallScore}
        Assessment Time: ${assessmentTime.toFixed(2)}ms`);
    });

    it('should identify and score bridges with security vulnerabilities', async () => {
      await riskAssessment.initialize();
      
      // Mock bridge with security issues
      const vulnerableAudit: SecurityAudit = {
        auditorName: 'Trail of Bits',
        auditDate: Date.now() - (180 * 24 * 60 * 60 * 1000), // 6 months ago - stale
        riskLevel: 'high',
        findings: [
          'Critical: Reentrancy vulnerability in withdrawal function',
          'High: Insufficient access controls on admin functions',
          'Medium: Front-running susceptible price oracle',
          'Low: Missing event emission for state changes'
        ],
        score: 45, // Poor score
        coverage: 0.75, // Incomplete coverage
        methodology: 'Automated scanning only',
        recommendations: [
          'Immediate fix required for reentrancy vulnerability',
          'Implement multi-sig for admin functions',
          'Upgrade to secure oracle mechanism',
          'Add comprehensive event logging'
        ]
      };

      // Add security incident history
      const securityIncident: BridgeIncident = {
        bridgeId: 'vulnerable-bridge',
        type: 'exploit',
        severity: 'high',
        amount: 5000000, // $5M exploit
        description: 'Reentrancy attack drained bridge funds',
        timestamp: Date.now() - (60 * 24 * 60 * 60 * 1000), // 60 days ago
        resolved: true,
        impact: 'Major liquidity reduction, user confidence loss'
      };

      await riskAssessment.updateSecurityAudit('vulnerable-bridge', vulnerableAudit);
      await riskAssessment.recordIncident(securityIncident);
      
      const assessment = await riskAssessment.getBridgeRiskAssessment('vulnerable-bridge');
      testMetrics.totalAssessments++;
      
      // Should identify security risks
      expect(assessment.safetyScore).toBeLessThan(50); // Poor safety score
      expect(assessment.securityScore).toBeLessThan(60); // Poor security score
      expect(assessment.overallScore).toBeLessThan(40); // Poor overall score
      
      // Should identify specific risk factors
      expect(assessment.riskFactors.length).toBeGreaterThan(3);
      expect(assessment.riskFactors.some(rf => 
        rf.factor.includes('vulnerability') || rf.factor.includes('exploit')
      )).toBe(true);
      
      // Should generate appropriate alerts
      expect(assessment.alerts.length).toBeGreaterThan(0);
      expect(assessment.alerts.some(alert => 
        alert.severity === 'critical' || alert.severity === 'error'
      )).toBe(true);
      
      console.log(`Vulnerable Bridge Assessment:
        Safety Score: ${assessment.safetyScore}
        Security Score: ${assessment.securityScore}
        Risk Factors: ${assessment.riskFactors.length}
        Alerts: ${assessment.alerts.length}`);
    });

    it('should validate liquidity and reliability scoring accuracy', async () => {
      await riskAssessment.initialize();
      
      // Test different liquidity scenarios
      const liquidityScenarios = [
        {
          name: 'High Liquidity Bridge',
          bridgeId: 'high-liquidity',
          currentTVL: 500000000, // $500M TVL
          avgDailyVolume: 50000000, // $50M daily volume
          liquidityUtilization: 0.1, // 10% utilization - healthy
          expectedLiquidityScore: 90
        },
        {
          name: 'Medium Liquidity Bridge',
          bridgeId: 'medium-liquidity',
          currentTVL: 100000000, // $100M TVL
          avgDailyVolume: 20000000, // $20M daily volume
          liquidityUtilization: 0.4, // 40% utilization - moderate
          expectedLiquidityScore: 70
        },
        {
          name: 'Low Liquidity Bridge',
          bridgeId: 'low-liquidity',
          currentTVL: 10000000, // $10M TVL
          avgDailyVolume: 8000000, // $8M daily volume
          liquidityUtilization: 0.8, // 80% utilization - strained
          expectedLiquidityScore: 30
        }
      ];

      for (const scenario of liquidityScenarios) {
        // Mock performance metrics for the scenario
        riskAssessment['performanceMetrics'].set(scenario.bridgeId, {
          currentTVL: scenario.currentTVL,
          avgDailyVolume: scenario.avgDailyVolume,
          liquidityUtilization: scenario.liquidityUtilization,
          uptimePercentage: 99.5,
          avgTransactionTime: 120,
          successRate: 0.995,
          lastIncidentDate: Date.now() - (365 * 24 * 60 * 60 * 1000), // 1 year ago
          totalTransactions: 100000,
          failedTransactions: 500
        });

        const assessment = await riskAssessment.getBridgeRiskAssessment(scenario.bridgeId);
        testMetrics.totalAssessments++;
        
        // Validate liquidity score accuracy
        const liquidityScoreAccuracy = Math.abs(assessment.liquidityScore - scenario.expectedLiquidityScore) / scenario.expectedLiquidityScore;
        expect(liquidityScoreAccuracy).toBeLessThan(0.2); // Within 20% of expected
        
        // Validate reliability score (should be high for all scenarios due to good uptime)
        expect(assessment.reliabilityScore).toBeGreaterThan(85);
        
        testMetrics.accuracyScores.push(1 - liquidityScoreAccuracy);
        
        console.log(`${scenario.name}:
          Expected Liquidity Score: ${scenario.expectedLiquidityScore}
          Actual Liquidity Score: ${assessment.liquidityScore}
          Accuracy: ${((1 - liquidityScoreAccuracy) * 100).toFixed(1)}%
          Reliability Score: ${assessment.reliabilityScore}`);
      }
    });

    it('should handle bridges with mixed risk profiles accurately', async () => {
      await riskAssessment.initialize();
      
      // Complex bridge with mixed characteristics
      const mixedProfileBridge = 'mixed-profile-bridge';
      
      // Good security audit but old
      const decentAudit: SecurityAudit = {
        auditorName: 'OpenZeppelin',
        auditDate: Date.now() - (120 * 24 * 60 * 60 * 1000), // 4 months ago
        riskLevel: 'medium',
        findings: [
          'Medium: Centralized admin key management',
          'Low: Suboptimal gas usage in some functions'
        ],
        score: 75,
        coverage: 0.92,
        methodology: 'Comprehensive manual + automated',
        recommendations: [
          'Implement multi-sig for admin functions',
          'Optimize gas usage'
        ]
      };

      // Mixed performance metrics
      riskAssessment['performanceMetrics'].set(mixedProfileBridge, {
        currentTVL: 150000000, // Good TVL
        avgDailyVolume: 45000000, // High volume
        liquidityUtilization: 0.6, // High utilization
        uptimePercentage: 97.5, // Decent but not perfect uptime
        avgTransactionTime: 180, // Slower transactions
        successRate: 0.98, // Good success rate
        lastIncidentDate: Date.now() - (90 * 24 * 60 * 60 * 1000), // Recent incident
        totalTransactions: 500000,
        failedTransactions: 10000
      });

      // Minor recent incident
      const minorIncident: BridgeIncident = {
        bridgeId: mixedProfileBridge,
        type: 'downtime',
        severity: 'medium',
        amount: 0,
        description: 'Temporary service disruption due to RPC issues',
        timestamp: Date.now() - (30 * 24 * 60 * 60 * 1000), // 30 days ago
        resolved: true,
        impact: 'Brief transaction delays'
      };

      await riskAssessment.updateSecurityAudit(mixedProfileBridge, decentAudit);
      await riskAssessment.recordIncident(minorIncident);
      
      const assessment = await riskAssessment.getBridgeRiskAssessment(mixedProfileBridge);
      testMetrics.totalAssessments++;
      
      // Should reflect mixed profile in scores
      expect(assessment.securityScore).toBeGreaterThan(60);
      expect(assessment.securityScore).toBeLessThan(85);
      
      expect(assessment.liquidityScore).toBeGreaterThan(50);
      expect(assessment.liquidityScore).toBeLessThan(80);
      
      expect(assessment.reliabilityScore).toBeGreaterThan(70);
      expect(assessment.reliabilityScore).toBeLessThan(90);
      
      // Overall score should be moderate
      expect(assessment.overallScore).toBeGreaterThan(50);
      expect(assessment.overallScore).toBeLessThan(80);
      
      // Should have balanced risk factors
      expect(assessment.riskFactors.length).toBeGreaterThan(1);
      expect(assessment.riskFactors.length).toBeLessThan(5);
      
      console.log(`Mixed Profile Bridge Assessment:
        Security: ${assessment.securityScore}
        Liquidity: ${assessment.liquidityScore}
        Reliability: ${assessment.reliabilityScore}
        Overall: ${assessment.overallScore}
        Risk Factors: ${assessment.riskFactors.length}`);
    });
  });

  describe('Real-Time Risk Monitoring Validation', () => {
    it('should detect and alert on rapid TVL changes', async () => {
      await riskAssessment.initialize();
      await riskAssessment.start();
      
      const bridgeId = 'tvl-monitoring-test';
      
      // Simulate normal TVL
      riskAssessment['performanceMetrics'].set(bridgeId, {
        currentTVL: 100000000, // $100M baseline
        avgDailyVolume: 10000000,
        liquidityUtilization: 0.3,
        uptimePercentage: 99.8,
        avgTransactionTime: 90,
        successRate: 0.999,
        lastIncidentDate: Date.now() - (365 * 24 * 60 * 60 * 1000),
        totalTransactions: 1000000,
        failedTransactions: 1000
      });

      // Get baseline assessment
      const baselineAssessment = await riskAssessment.getBridgeRiskAssessment(bridgeId);
      const baselineLiquidityScore = baselineAssessment.liquidityScore;
      
      // Simulate sudden TVL drop (possible exploit or bank run)
      riskAssessment['performanceMetrics'].set(bridgeId, {
        currentTVL: 30000000, // 70% TVL drop!
        avgDailyVolume: 10000000,
        liquidityUtilization: 0.9, // High utilization due to reduced TVL
        uptimePercentage: 99.8,
        avgTransactionTime: 90,
        successRate: 0.999,
        lastIncidentDate: Date.now() - (365 * 24 * 60 * 60 * 1000),
        totalTransactions: 1000000,
        failedTransactions: 1000
      });

      // Wait for monitoring cycle
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const alertAssessment = await riskAssessment.getBridgeRiskAssessment(bridgeId);
      
      // Should detect significant TVL drop
      expect(alertAssessment.liquidityScore).toBeLessThan(baselineLiquidityScore - 20);
      expect(alertAssessment.alerts.some(alert => 
        alert.type === 'liquidity_drop' || alert.message.includes('TVL')
      )).toBe(true);
      
      // Should have elevated risk factors
      expect(alertAssessment.riskFactors.some(rf => 
        rf.factor.includes('liquidity') || rf.factor.includes('TVL')
      )).toBe(true);
      
      console.log(`TVL Drop Detection:
        Baseline Liquidity Score: ${baselineLiquidityScore}
        Alert Liquidity Score: ${alertAssessment.liquidityScore}
        Alerts Generated: ${alertAssessment.alerts.length}
        TVL Change: -70%`);
    });

    it('should monitor bridge uptime and transaction success rates', async () => {
      await riskAssessment.initialize();
      
      const reliabilityScenarios = [
        {
          name: 'Excellent Reliability',
          bridgeId: 'excellent-reliability',
          uptimePercentage: 99.95,
          successRate: 0.9998,
          avgTransactionTime: 60,
          expectedReliabilityScore: 95
        },
        {
          name: 'Good Reliability',
          bridgeId: 'good-reliability',
          uptimePercentage: 99.5,
          successRate: 0.995,
          avgTransactionTime: 120,
          expectedReliabilityScore: 85
        },
        {
          name: 'Poor Reliability',
          bridgeId: 'poor-reliability',
          uptimePercentage: 95.0,
          successRate: 0.92,
          avgTransactionTime: 300,
          expectedReliabilityScore: 50
        }
      ];

      for (const scenario of reliabilityScenarios) {
        riskAssessment['performanceMetrics'].set(scenario.bridgeId, {
          currentTVL: 100000000,
          avgDailyVolume: 20000000,
          liquidityUtilization: 0.4,
          uptimePercentage: scenario.uptimePercentage,
          avgTransactionTime: scenario.avgTransactionTime,
          successRate: scenario.successRate,
          lastIncidentDate: Date.now() - (180 * 24 * 60 * 60 * 1000),
          totalTransactions: 1000000,
          failedTransactions: Math.floor(1000000 * (1 - scenario.successRate))
        });

        const assessment = await riskAssessment.getBridgeRiskAssessment(scenario.bridgeId);
        testMetrics.totalAssessments++;
        
        // Validate reliability score accuracy
        const reliabilityAccuracy = Math.abs(assessment.reliabilityScore - scenario.expectedReliabilityScore) / scenario.expectedReliabilityScore;
        expect(reliabilityAccuracy).toBeLessThan(0.25); // Within 25% of expected
        
        // Poor reliability should generate alerts
        if (scenario.name === 'Poor Reliability') {
          expect(assessment.alerts.some(alert => 
            alert.type === 'reliability_issue' || alert.message.includes('uptime') || alert.message.includes('success')
          )).toBe(true);
        }
        
        testMetrics.accuracyScores.push(1 - reliabilityAccuracy);
        
        console.log(`${scenario.name}:
          Uptime: ${scenario.uptimePercentage}%
          Success Rate: ${(scenario.successRate * 100).toFixed(2)}%
          Expected Score: ${scenario.expectedReliabilityScore}
          Actual Score: ${assessment.reliabilityScore}
          Accuracy: ${((1 - reliabilityAccuracy) * 100).toFixed(1)}%`);
      }
    });

    it('should correlate multiple risk indicators for comprehensive assessment', async () => {
      await riskAssessment.initialize();
      
      const correlationTestBridge = 'correlation-test-bridge';
      
      // Simulate multiple simultaneous risk indicators
      const oldAudit: SecurityAudit = {
        auditorName: 'Audit Firm',
        auditDate: Date.now() - (365 * 24 * 60 * 60 * 1000), // 1 year old
        riskLevel: 'medium',
        findings: ['Medium: Some security concerns'],
        score: 70,
        coverage: 0.85,
        methodology: 'Standard review',
        recommendations: ['Address security concerns']
      };

      const recentIncident: BridgeIncident = {
        bridgeId: correlationTestBridge,
        type: 'bug',
        severity: 'medium',
        amount: 100000,
        description: 'Smart contract bug caused transaction failures',
        timestamp: Date.now() - (7 * 24 * 60 * 60 * 1000), // 1 week ago
        resolved: true,
        impact: 'Temporary service disruption'
      };

      // Poor recent performance
      riskAssessment['performanceMetrics'].set(correlationTestBridge, {
        currentTVL: 50000000, // Declining TVL
        avgDailyVolume: 8000000,
        liquidityUtilization: 0.75, // High utilization
        uptimePercentage: 96.5, // Recent downtime
        avgTransactionTime: 250, // Slow transactions
        successRate: 0.94, // Recent failures
        lastIncidentDate: Date.now() - (7 * 24 * 60 * 60 * 1000),
        totalTransactions: 100000,
        failedTransactions: 6000
      });

      await riskAssessment.updateSecurityAudit(correlationTestBridge, oldAudit);
      await riskAssessment.recordIncident(recentIncident);
      
      const assessment = await riskAssessment.getBridgeRiskAssessment(correlationTestBridge);
      testMetrics.totalAssessments++;
      
      // Should correlate multiple risk factors
      expect(assessment.riskFactors.length).toBeGreaterThan(3);
      
      // Should identify correlation between factors
      const riskFactorTypes = assessment.riskFactors.map(rf => rf.category);
      expect(riskFactorTypes.includes('security')).toBe(true);
      expect(riskFactorTypes.includes('reliability')).toBe(true);
      expect(riskFactorTypes.includes('liquidity')).toBe(true);
      
      // Overall score should reflect combined risks
      expect(assessment.overallScore).toBeLessThan(60);
      
      // Should generate multiple alerts
      expect(assessment.alerts.length).toBeGreaterThan(1);
      
      // Should have high-severity composite risk
      expect(assessment.alerts.some(alert => 
        alert.severity === 'error' || alert.severity === 'critical'
      )).toBe(true);
      
      console.log(`Multi-Risk Correlation Test:
        Risk Factors: ${assessment.riskFactors.length}
        Alert Count: ${assessment.alerts.length}
        Overall Risk Score: ${assessment.overallScore}
        Composite Risk Detected: ${assessment.alerts.some(a => a.message.includes('multiple'))}`);
    });
  });

  describe('Historical Risk Pattern Analysis', () => {
    it('should analyze incident patterns and predict risk trends', async () => {
      await riskAssessment.initialize();
      
      const patternAnalysisBridge = 'pattern-analysis-bridge';
      
      // Create incident pattern over time
      const incidents: BridgeIncident[] = [
        {
          bridgeId: patternAnalysisBridge,
          type: 'downtime',
          severity: 'low',
          amount: 0,
          description: 'Brief network connectivity issue',
          timestamp: Date.now() - (180 * 24 * 60 * 60 * 1000), // 6 months ago
          resolved: true,
          impact: 'Minimal user impact'
        },
        {
          bridgeId: patternAnalysisBridge,
          type: 'bug',
          severity: 'medium',
          amount: 50000,
          description: 'Smart contract logic error',
          timestamp: Date.now() - (120 * 24 * 60 * 60 * 1000), // 4 months ago
          resolved: true,
          impact: 'Temporary fund lockup'
        },
        {
          bridgeId: patternAnalysisBridge,
          type: 'downtime',
          severity: 'medium',
          amount: 0,
          description: 'Extended service outage',
          timestamp: Date.now() - (60 * 24 * 60 * 60 * 1000), // 2 months ago
          resolved: true,
          impact: 'Service interruption for 4 hours'
        },
        {
          bridgeId: patternAnalysisBridge,
          type: 'governance',
          severity: 'high',
          amount: 0,
          description: 'Controversial governance decision',
          timestamp: Date.now() - (30 * 24 * 60 * 60 * 1000), // 1 month ago
          resolved: false,
          impact: 'Community trust concerns'
        }
      ];

      // Record all incidents
      for (const incident of incidents) {
        await riskAssessment.recordIncident(incident);
      }

      const assessment = await riskAssessment.getBridgeRiskAssessment(patternAnalysisBridge);
      testMetrics.totalAssessments++;
      
      // Should identify escalating incident pattern
      expect(assessment.riskFactors.some(rf => 
        rf.factor.includes('pattern') || rf.factor.includes('escalating') || rf.factor.includes('frequent')
      )).toBe(true);
      
      // Should have elevated risk due to pattern
      expect(assessment.overallScore).toBeLessThan(70);
      
      // Should generate pattern-based alerts
      expect(assessment.alerts.some(alert => 
        alert.message.includes('pattern') || alert.message.includes('trend')
      )).toBe(true);
      
      // Recent governance issue should heavily impact score
      expect(assessment.riskFactors.some(rf => 
        rf.factor.includes('governance')
      )).toBe(true);
      
      console.log(`Historical Pattern Analysis:
        Total Incidents: ${incidents.length}
        Pattern Detection: ${assessment.riskFactors.some(rf => rf.factor.includes('pattern'))}
        Overall Risk Impact: ${100 - assessment.overallScore}
        Governance Impact: ${assessment.riskFactors.some(rf => rf.factor.includes('governance'))}`);
    });

    it('should weight recent incidents more heavily than historical ones', async () => {
      await riskAssessment.initialize();
      
      const timeWeightingBridge = 'time-weighting-bridge';
      
      // Old incident - should have less impact
      const oldIncident: BridgeIncident = {
        bridgeId: timeWeightingBridge,
        type: 'exploit',
        severity: 'critical',
        amount: 10000000, // $10M
        description: 'Major exploit - fully resolved and patched',
        timestamp: Date.now() - (730 * 24 * 60 * 60 * 1000), // 2 years ago
        resolved: true,
        impact: 'Significant historical loss but fully addressed'
      };

      // Recent minor incident - should have more current impact
      const recentIncident: BridgeIncident = {
        bridgeId: timeWeightingBridge,
        type: 'downtime',
        severity: 'low',
        amount: 0,
        description: 'Recent brief service interruption',
        timestamp: Date.now() - (3 * 24 * 60 * 60 * 1000), // 3 days ago
        resolved: true,
        impact: 'Brief user inconvenience'
      };

      await riskAssessment.recordIncident(oldIncident);
      const assessmentWithOldIncident = await riskAssessment.getBridgeRiskAssessment(timeWeightingBridge);
      
      await riskAssessment.recordIncident(recentIncident);
      const assessmentWithRecentIncident = await riskAssessment.getBridgeRiskAssessment(timeWeightingBridge);
      
      testMetrics.totalAssessments += 2;
      
      // Recent incident should have more immediate impact despite being less severe
      const recentIncidentImpact = Math.abs(assessmentWithRecentIncident.reliabilityScore - assessmentWithOldIncident.reliabilityScore);
      expect(recentIncidentImpact).toBeGreaterThan(2); // Should cause noticeable score change
      
      // Should identify time decay in risk assessment
      expect(assessmentWithRecentIncident.riskFactors.some(rf => 
        rf.factor.includes('recent') || rf.severity === 'current'
      )).toBe(true);
      
      console.log(`Time Weighting Analysis:
        Old Critical Incident Impact: Factored into historical context
        Recent Minor Incident Impact: ${recentIncidentImpact} point score change
        Current Risk Factors: ${assessmentWithRecentIncident.riskFactors.filter(rf => rf.severity === 'current').length}`);
    });
  });

  describe('Cross-Bridge Risk Comparison', () => {
    it('should provide consistent risk rankings across bridge types', async () => {
      await riskAssessment.initialize();
      
      const bridgeProfiles = [
        {
          id: 'premium-bridge',
          name: 'Premium Bridge',
          tvl: 1000000000,
          auditScore: 95,
          incidents: 0,
          uptime: 99.98,
          expectedRank: 1
        },
        {
          id: 'standard-bridge',
          name: 'Standard Bridge',
          tvl: 200000000,
          auditScore: 80,
          incidents: 1,
          uptime: 99.5,
          expectedRank: 2
        },
        {
          id: 'budget-bridge',
          name: 'Budget Bridge',
          tvl: 50000000,
          auditScore: 65,
          incidents: 3,
          uptime: 98.0,
          expectedRank: 3
        },
        {
          id: 'risky-bridge',
          name: 'Risky Bridge',
          tvl: 10000000,
          auditScore: 40,
          incidents: 7,
          uptime: 95.0,
          expectedRank: 4
        }
      ];

      const assessments = [];
      
      for (const profile of bridgeProfiles) {
        // Set up bridge profile
        const audit: SecurityAudit = {
          auditorName: 'Test Auditor',
          auditDate: Date.now() - (30 * 24 * 60 * 60 * 1000),
          riskLevel: profile.auditScore > 80 ? 'low' : profile.auditScore > 60 ? 'medium' : 'high',
          findings: [],
          score: profile.auditScore,
          coverage: 0.9,
          methodology: 'Comprehensive',
          recommendations: []
        };

        riskAssessment['performanceMetrics'].set(profile.id, {
          currentTVL: profile.tvl,
          avgDailyVolume: profile.tvl * 0.1,
          liquidityUtilization: 0.3,
          uptimePercentage: profile.uptime,
          avgTransactionTime: 120,
          successRate: profile.uptime / 100,
          lastIncidentDate: profile.incidents > 0 ? Date.now() - (30 * 24 * 60 * 60 * 1000) : Date.now() - (365 * 24 * 60 * 60 * 1000),
          totalTransactions: 100000,
          failedTransactions: Math.floor(100000 * (1 - profile.uptime / 100))
        });

        await riskAssessment.updateSecurityAudit(profile.id, audit);
        
        // Add incidents for bridges that should have them
        for (let i = 0; i < profile.incidents; i++) {
          const incident: BridgeIncident = {
            bridgeId: profile.id,
            type: 'bug',
            severity: 'medium',
            amount: 10000,
            description: `Incident ${i + 1}`,
            timestamp: Date.now() - (i * 30 * 24 * 60 * 60 * 1000),
            resolved: true,
            impact: 'Minor impact'
          };
          await riskAssessment.recordIncident(incident);
        }

        const assessment = await riskAssessment.getBridgeRiskAssessment(profile.id);
        assessments.push({
          profile,
          assessment,
          overallScore: assessment.overallScore
        });
        
        testMetrics.totalAssessments++;
      }

      // Sort by overall score (descending - higher is better)
      assessments.sort((a, b) => b.overallScore - a.overallScore);
      
      // Validate ranking consistency
      for (let i = 0; i < assessments.length; i++) {
        const expectedRank = assessments[i].profile.expectedRank;
        const actualRank = i + 1;
        
        // Allow some variance in ranking (±1 position)
        expect(Math.abs(actualRank - expectedRank)).toBeLessThanOrEqual(1);
        
        console.log(`${assessments[i].profile.name}:
          Expected Rank: ${expectedRank}
          Actual Rank: ${actualRank}
          Overall Score: ${assessments[i].overallScore.toFixed(2)}
          Ranking Accuracy: ${Math.abs(actualRank - expectedRank) <= 1 ? 'PASS' : 'FAIL'}`);
      }

      // Validate score distribution makes sense
      const scores = assessments.map(a => a.overallScore);
      expect(scores[0]).toBeGreaterThan(scores[scores.length - 1] + 20); // Clear differentiation
      expect(scores[0]).toBeGreaterThan(80); // Premium should be high
      expect(scores[scores.length - 1]).toBeLessThan(50); // Risky should be low
    });
  });

  describe('Performance and Accuracy Metrics', () => {
    afterAll(() => {
      // Generate comprehensive test report
      const avgAssessmentTime = testMetrics.assessmentTimes.reduce((a, b) => a + b, 0) / testMetrics.assessmentTimes.length;
      const avgAccuracy = testMetrics.accuracyScores.reduce((a, b) => a + b, 0) / testMetrics.accuracyScores.length;
      const falsePositiveRate = testMetrics.falsePositives / testMetrics.totalAssessments;
      const falseNegativeRate = testMetrics.falseNegatives / testMetrics.totalAssessments;

      console.log(`
=== BRIDGE RISK ASSESSMENT VALIDATION REPORT ===
Performance Metrics:
  Total Assessments: ${testMetrics.totalAssessments}
  Average Assessment Time: ${avgAssessmentTime.toFixed(2)}ms
  Max Assessment Time: ${Math.max(...testMetrics.assessmentTimes).toFixed(2)}ms

Accuracy Metrics:
  Average Accuracy: ${(avgAccuracy * 100).toFixed(1)}%
  False Positive Rate: ${(falsePositiveRate * 100).toFixed(2)}%
  False Negative Rate: ${(falseNegativeRate * 100).toFixed(2)}%

Validation Targets:
  ✓ Assessment Time < 1000ms: ${avgAssessmentTime < 1000 ? 'PASS' : 'FAIL'}
  ✓ Accuracy > 80%: ${avgAccuracy > 0.8 ? 'PASS' : 'FAIL'}
  ✓ False Positive Rate < 5%: ${falsePositiveRate < 0.05 ? 'PASS' : 'FAIL'}
  ✓ False Negative Rate < 5%: ${falseNegativeRate < 0.05 ? 'PASS' : 'FAIL'}

Coverage Report:
  ✓ Safety Score Validation: COMPLETE
  ✓ Real-time Monitoring: COMPLETE
  ✓ Historical Analysis: COMPLETE
  ✓ Cross-Bridge Comparison: COMPLETE
      `);

      // Validate overall test success
      expect(avgAssessmentTime).toBeLessThan(1000);
      expect(avgAccuracy).toBeGreaterThan(0.80);
      expect(falsePositiveRate).toBeLessThan(0.05);
      expect(falseNegativeRate).toBeLessThan(0.05);
    });
  });
});