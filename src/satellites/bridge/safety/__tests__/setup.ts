/**
 * Test Setup for Bridge Safety & Risk Assessment Tests
 */

import { jest } from '@jest/globals';

// Test configuration constants
export const SAFETY_TEST_CONFIG = {
  PERFORMANCE_THRESHOLDS: {
    RISK_ASSESSMENT_MS: 1000,       // 1 second max per risk assessment
    MONITORING_CYCLE_MS: 5000,      // 5 seconds max per monitoring cycle
    AI_ANALYSIS_MS: 5000,           // 5 seconds max per AI analysis
    ANOMALY_DETECTION_MS: 2000,     // 2 seconds max per anomaly detection
    ALERT_RESPONSE_MS: 500          // 500ms max alert response time
  },
  ACCURACY_THRESHOLDS: {
    RISK_SCORE_ACCURACY: 0.85,      // 85% accuracy in risk scoring
    THREAT_DETECTION_RATE: 0.90,    // 90% threat detection rate
    FALSE_POSITIVE_RATE: 0.05,      // 5% max false positive rate
    PREDICTION_ACCURACY: 0.75,      // 75% prediction accuracy
    ANOMALY_DETECTION_ACCURACY: 0.80 // 80% anomaly detection accuracy
  },
  COVERAGE_REQUIREMENTS: {
    BRIDGE_TYPES: 5,                // Test at least 5 different bridge types
    RISK_SCENARIOS: 8,              // Test at least 8 risk scenarios
    ATTACK_PATTERNS: 6,             // Test at least 6 attack patterns
    MARKET_CONDITIONS: 4,           // Test under 4 different market conditions
    TEMPORAL_PATTERNS: 7            // Test 7 different temporal patterns
  }
};

// Mock data generators for consistent testing
export class SafetyTestDataGenerator {
  static generateSecurityAudit(riskLevel: 'low' | 'medium' | 'high' = 'medium') {
    const baseScores = {
      low: { min: 85, max: 95 },
      medium: { min: 65, max: 84 },
      high: { min: 30, max: 64 }
    };

    const score = baseScores[riskLevel].min + 
      Math.random() * (baseScores[riskLevel].max - baseScores[riskLevel].min);

    return {
      auditorName: ['ConsenSys Diligence', 'Trail of Bits', 'OpenZeppelin', 'Quantstamp'][Math.floor(Math.random() * 4)],
      auditDate: Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000, // Within last year
      riskLevel,
      findings: this.generateFindings(riskLevel),
      score: Math.round(score),
      coverage: 0.8 + Math.random() * 0.15, // 80-95% coverage
      methodology: 'Comprehensive manual review + automated analysis',
      recommendations: this.generateRecommendations(riskLevel)
    };
  }

  static generateFindings(riskLevel: 'low' | 'medium' | 'high') {
    const findingsByRisk = {
      low: [
        'Minor gas optimization opportunities',
        'Documentation improvements needed',
        'Code style inconsistencies'
      ],
      medium: [
        'Access control improvements recommended',
        'Input validation enhancements needed',
        'Event emission gaps identified',
        'Centralization concerns in admin functions'
      ],
      high: [
        'Critical reentrancy vulnerability found',
        'Insufficient access controls on critical functions',
        'Price oracle manipulation risks',
        'Flash loan attack vectors identified',
        'Unprotected upgrade mechanisms'
      ]
    };

    const findings = findingsByRisk[riskLevel];
    const numFindings = Math.min(findings.length, Math.ceil(Math.random() * findings.length));
    return findings.slice(0, numFindings);
  }

  static generateRecommendations(riskLevel: 'low' | 'medium' | 'high') {
    const recommendationsByRisk = {
      low: [
        'Implement suggested optimizations',
        'Update documentation',
        'Standardize code formatting'
      ],
      medium: [
        'Implement multi-sig for admin functions',
        'Add input validation checks',
        'Improve event logging',
        'Consider decentralization roadmap'
      ],
      high: [
        'URGENT: Fix reentrancy vulnerability immediately',
        'Implement emergency pause mechanism',
        'Upgrade to secure oracle solution',
        'Add flash loan protection',
        'Implement timelock for upgrades'
      ]
    };

    return recommendationsByRisk[riskLevel];
  }

  static generateBridgeIncident(severity: 'low' | 'medium' | 'high' | 'critical' = 'medium') {
    const incidentTypes = ['exploit', 'bug', 'downtime', 'governance'];
    const amounts = {
      low: [0, 50000],
      medium: [50000, 1000000],
      high: [1000000, 10000000],
      critical: [10000000, 100000000]
    };

    const [minAmount, maxAmount] = amounts[severity];
    const amount = minAmount + Math.random() * (maxAmount - minAmount);

    return {
      bridgeId: `test-bridge-${Math.floor(Math.random() * 1000)}`,
      type: incidentTypes[Math.floor(Math.random() * incidentTypes.length)] as any,
      severity,
      amount: Math.round(amount),
      description: this.generateIncidentDescription(severity),
      timestamp: Date.now() - Math.random() * 180 * 24 * 60 * 60 * 1000, // Within last 6 months
      resolved: Math.random() > 0.2, // 80% resolved
      impact: this.generateIncidentImpact(severity)
    };
  }

  static generateIncidentDescription(severity: 'low' | 'medium' | 'high' | 'critical') {
    const descriptions = {
      low: [
        'Brief network connectivity issue',
        'Minor display bug in UI',
        'Temporary slow response times'
      ],
      medium: [
        'Smart contract logic error causing transaction delays',
        'Extended service outage due to infrastructure issues',
        'Incorrect fee calculation affecting small transactions'
      ],
      high: [
        'Contract vulnerability allowing unauthorized withdrawals',
        'Major service disruption affecting multiple chains',
        'Price oracle manipulation causing significant slippage'
      ],
      critical: [
        'Reentrancy exploit draining bridge funds',
        'Admin key compromise leading to unauthorized actions',
        'Flash loan attack causing massive fund loss'
      ]
    };

    const options = descriptions[severity];
    return options[Math.floor(Math.random() * options.length)];
  }

  static generateIncidentImpact(severity: 'low' | 'medium' | 'high' | 'critical') {
    const impacts = {
      low: [
        'Minimal user impact, quickly resolved',
        'Brief inconvenience for some users',
        'No financial losses reported'
      ],
      medium: [
        'Temporary service disruption affecting transactions',
        'Some users experienced delays',
        'Minor financial impact on affected users'
      ],
      high: [
        'Significant user funds temporarily locked',
        'Major service disruption for several hours',
        'Substantial financial losses for affected users'
      ],
      critical: [
        'Major financial losses across user base',
        'Complete service shutdown required',
        'Ecosystem-wide confidence impact'
      ]
    };

    const options = impacts[severity];
    return options[Math.floor(Math.random() * options.length)];
  }

  static generatePerformanceMetrics(quality: 'excellent' | 'good' | 'poor' = 'good') {
    const baseMetrics = {
      excellent: {
        tvl: [500000000, 2000000000],
        successRate: [0.9980, 0.9999],
        uptime: [99.9, 99.99],
        responseTime: [50, 150]
      },
      good: {
        tvl: [100000000, 500000000],
        successRate: [0.9900, 0.9980],
        uptime: [99.0, 99.5],
        responseTime: [150, 300]
      },
      poor: {
        tvl: [10000000, 100000000],
        successRate: [0.9500, 0.9900],
        uptime: [95.0, 99.0],
        responseTime: [300, 1000]
      }
    };

    const ranges = baseMetrics[quality];
    
    return {
      currentTVL: ranges.tvl[0] + Math.random() * (ranges.tvl[1] - ranges.tvl[0]),
      avgDailyVolume: (ranges.tvl[0] + Math.random() * (ranges.tvl[1] - ranges.tvl[0])) * 0.1,
      liquidityUtilization: 0.2 + Math.random() * 0.4, // 20-60%
      uptimePercentage: ranges.uptime[0] + Math.random() * (ranges.uptime[1] - ranges.uptime[0]),
      avgTransactionTime: ranges.responseTime[0] + Math.random() * (ranges.responseTime[1] - ranges.responseTime[0]),
      successRate: ranges.successRate[0] + Math.random() * (ranges.successRate[1] - ranges.successRate[0]),
      lastIncidentDate: Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000,
      totalTransactions: Math.floor(100000 + Math.random() * 900000),
      failedTransactions: function() { return Math.floor(this.totalTransactions * (1 - this.successRate)); }
    };
  }
}

// Mock AI/ML responses for consistent testing
export class MockAIResponseGenerator {
  static generateThreatIntelligence(threatLevel: 'low' | 'medium' | 'high' = 'medium') {
    const threatsByLevel = {
      low: [
        { type: 'social_chatter', severity: 'info', confidence: 0.6 },
        { type: 'minor_news', severity: 'low', confidence: 0.7 }
      ],
      medium: [
        { type: 'security_concern', severity: 'medium', confidence: 0.8 },
        { type: 'performance_degradation', severity: 'medium', confidence: 0.75 },
        { type: 'user_complaints', severity: 'medium', confidence: 0.7 }
      ],
      high: [
        { type: 'potential_exploit', severity: 'high', confidence: 0.9 },
        { type: 'critical_vulnerability', severity: 'critical', confidence: 0.85 },
        { type: 'coordinated_attack', severity: 'critical', confidence: 0.95 }
      ]
    };

    return threatsByLevel[threatLevel];
  }

  static generateSentimentAnalysis(overall: 'positive' | 'neutral' | 'negative' = 'neutral') {
    const sentimentRanges = {
      positive: [0.3, 0.8],
      neutral: [-0.2, 0.2],
      negative: [-0.8, -0.3]
    };

    const [min, max] = sentimentRanges[overall];
    
    return {
      overallSentiment: min + Math.random() * (max - min),
      sentimentTrend: (Math.random() - 0.5) * 0.4, // ±0.2 trend
      sourceBreakdown: {
        news: min + Math.random() * (max - min),
        social: min + Math.random() * (max - min),
        expert: min + Math.random() * (max - min)
      },
      confidenceScore: 0.7 + Math.random() * 0.25 // 70-95% confidence
    };
  }

  static generatePredictionModel(riskLevel: 'low' | 'medium' | 'high' = 'medium') {
    const predictionsByRisk = {
      low: {
        failureProbability: [0.05, 0.15],
        timeToFailure: [180, 365],
        confidence: [0.6, 0.8]
      },
      medium: {
        failureProbability: [0.15, 0.45],
        timeToFailure: [30, 180],
        confidence: [0.7, 0.85]
      },
      high: {
        failureProbability: [0.45, 0.85],
        timeToFailure: [1, 30],
        confidence: [0.8, 0.95]
      }
    };

    const ranges = predictionsByRisk[riskLevel];
    
    return {
      failureProbability: ranges.failureProbability[0] + 
        Math.random() * (ranges.failureProbability[1] - ranges.failureProbability[0]),
      timeToFailure: Math.floor(ranges.timeToFailure[0] + 
        Math.random() * (ranges.timeToFailure[1] - ranges.timeToFailure[0])),
      confidence: ranges.confidence[0] + 
        Math.random() * (ranges.confidence[1] - ranges.confidence[0]),
      keyRiskFactors: this.generateRiskFactors(riskLevel),
      recommendations: this.generatePredictionRecommendations(riskLevel)
    };
  }

  static generateRiskFactors(riskLevel: 'low' | 'medium' | 'high') {
    const factorsByRisk = {
      low: [
        'Minor performance fluctuations',
        'Slightly elevated user complaints',
        'Normal market volatility'
      ],
      medium: [
        'Declining TVL trend',
        'Increased transaction failures',
        'Competitive pressure from alternatives',
        'Moderate security audit findings'
      ],
      high: [
        'Critical security vulnerabilities',
        'Major TVL outflows',
        'Significant performance degradation',
        'Regulatory concerns',
        'Technical debt accumulation'
      ]
    };

    const factors = factorsByRisk[riskLevel];
    const numFactors = Math.min(factors.length, 2 + Math.floor(Math.random() * (factors.length - 1)));
    return factors.slice(0, numFactors);
  }

  static generatePredictionRecommendations(riskLevel: 'low' | 'medium' | 'high') {
    const recommendationsByRisk = {
      low: [
        'Continue monitoring performance metrics',
        'Maintain current security posture',
        'Consider minor optimizations'
      ],
      medium: [
        'Increase monitoring frequency',
        'Address identified security issues',
        'Implement performance improvements',
        'Prepare contingency plans'
      ],
      high: [
        'Immediate security audit required',
        'Implement emergency procedures',
        'Consider temporary service restrictions',
        'Urgent technical debt resolution',
        'Stakeholder communication plan activation'
      ]
    };

    return recommendationsByRisk[riskLevel];
  }
}

// Performance tracking utility for safety tests
export class SafetyPerformanceTracker {
  private metrics = {
    riskAssessmentTimes: [] as number[],
    monitoringCycleTimes: [] as number[],
    aiAnalysisTimes: [] as number[],
    anomalyDetectionTimes: [] as number[],
    alertResponseTimes: [] as number[],
    accuracyScores: [] as number[],
    falsePositiveCount: 0,
    falseNegativeCount: 0,
    totalAssessments: 0
  };

  recordRiskAssessment(timeMs: number): void {
    this.metrics.riskAssessmentTimes.push(timeMs);
    this.metrics.totalAssessments++;
  }

  recordMonitoringCycle(timeMs: number): void {
    this.metrics.monitoringCycleTimes.push(timeMs);
  }

  recordAIAnalysis(timeMs: number): void {
    this.metrics.aiAnalysisTimes.push(timeMs);
  }

  recordAnomalyDetection(timeMs: number): void {
    this.metrics.anomalyDetectionTimes.push(timeMs);
  }

  recordAlertResponse(timeMs: number): void {
    this.metrics.alertResponseTimes.push(timeMs);
  }

  recordAccuracy(accuracyScore: number): void {
    this.metrics.accuracyScores.push(accuracyScore);
  }

  recordFalsePositive(): void {
    this.metrics.falsePositiveCount++;
  }

  recordFalseNegative(): void {
    this.metrics.falseNegativeCount++;
  }

  generateReport(): {
    performance: Record<string, number>;
    accuracy: Record<string, number>;
    compliance: Record<string, boolean>;
  } {
    const avgRiskAssessment = this.average(this.metrics.riskAssessmentTimes);
    const avgMonitoring = this.average(this.metrics.monitoringCycleTimes);
    const avgAIAnalysis = this.average(this.metrics.aiAnalysisTimes);
    const avgAnomalyDetection = this.average(this.metrics.anomalyDetectionTimes);
    const avgAlertResponse = this.average(this.metrics.alertResponseTimes);
    const avgAccuracy = this.average(this.metrics.accuracyScores);
    const falsePositiveRate = this.metrics.falsePositiveCount / this.metrics.totalAssessments;
    const falseNegativeRate = this.metrics.falseNegativeCount / this.metrics.totalAssessments;

    return {
      performance: {
        avgRiskAssessmentMs: avgRiskAssessment,
        avgMonitoringCycleMs: avgMonitoring,
        avgAIAnalysisMs: avgAIAnalysis,
        avgAnomalyDetectionMs: avgAnomalyDetection,
        avgAlertResponseMs: avgAlertResponse
      },
      accuracy: {
        averageAccuracy: avgAccuracy,
        falsePositiveRate,
        falseNegativeRate,
        totalAssessments: this.metrics.totalAssessments
      },
      compliance: {
        riskAssessmentPerformance: avgRiskAssessment < SAFETY_TEST_CONFIG.PERFORMANCE_THRESHOLDS.RISK_ASSESSMENT_MS,
        monitoringPerformance: avgMonitoring < SAFETY_TEST_CONFIG.PERFORMANCE_THRESHOLDS.MONITORING_CYCLE_MS,
        aiAnalysisPerformance: avgAIAnalysis < SAFETY_TEST_CONFIG.PERFORMANCE_THRESHOLDS.AI_ANALYSIS_MS,
        anomalyDetectionPerformance: avgAnomalyDetection < SAFETY_TEST_CONFIG.PERFORMANCE_THRESHOLDS.ANOMALY_DETECTION_MS,
        alertResponsePerformance: avgAlertResponse < SAFETY_TEST_CONFIG.PERFORMANCE_THRESHOLDS.ALERT_RESPONSE_MS,
        accuracyCompliance: avgAccuracy > SAFETY_TEST_CONFIG.ACCURACY_THRESHOLDS.RISK_SCORE_ACCURACY,
        falsePositiveCompliance: falsePositiveRate < SAFETY_TEST_CONFIG.ACCURACY_THRESHOLDS.FALSE_POSITIVE_RATE
      }
    };
  }

  private average(numbers: number[]): number {
    return numbers.length > 0 ? numbers.reduce((a, b) => a + b, 0) / numbers.length : 0;
  }

  reset(): void {
    this.metrics = {
      riskAssessmentTimes: [],
      monitoringCycleTimes: [],
      aiAnalysisTimes: [],
      anomalyDetectionTimes: [],
      alertResponseTimes: [],
      accuracyScores: [],
      falsePositiveCount: 0,
      falseNegativeCount: 0,
      totalAssessments: 0
    };
  }
}

// Global test setup
beforeAll(() => {
  // Suppress console output during tests
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'info').mockImplementation(() => {});
  jest.spyOn(console, 'debug').mockImplementation(() => {});
});

afterAll(() => {
  // Restore console methods
  jest.restoreAllMocks();
});

// Export singleton instances
export const safetyTestDataGenerator = SafetyTestDataGenerator;
export const mockAIResponseGenerator = MockAIResponseGenerator;
export const safetyPerformanceTracker = new SafetyPerformanceTracker();