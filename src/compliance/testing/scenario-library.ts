/**
 * Compliance Scenario Library
 * Pre-built test scenarios for common compliance situations
 */

import { 
  ComplianceScenario, 
  TestUser, 
  TestAccount,
  ScenarioStep,
  ExpectedOutcome,
  ValidationRule
} from './scenario-framework';

export class ComplianceScenarioLibrary {
  
  /**
   * Get all available scenarios
   */
  static getAllScenarios(): ComplianceScenario[] {
    return [
      // AML Detection Scenarios
      this.getStructuringScenario(),
      this.getLayeringScenario(),
      this.getRapidMovementScenario(),
      this.getHighRiskCounterpartyScenario(),
      this.getUnusualPatternScenario(),
      
      // KYC Scenarios
      this.getKYCEscalationScenario(),
      this.getDocumentVerificationScenario(),
      this.getPEPScreeningScenario(),
      
      // Transaction Monitoring
      this.getVelocityLimitScenario(),
      this.getCrossBorderScenario(),
      this.getLargeTransactionScenario(),
      
      // Sanctions Screening
      this.getSanctionsHitScenario(),
      this.getWatchlistMatchScenario(),
      
      // Regulatory Reporting
      this.getSARFilingScenario(),
      this.getCTRReportingScenario(),
      
      // System Stress Tests
      this.getHighVolumeStressScenario(),
      this.getConcurrentTransactionScenario(),
      
      // Adversarial Tests
      this.getEvasionAttemptScenario(),
      this.getFalsePositiveScenario(),
      this.getEdgeCaseScenario()
    ];
  }

  /**
   * Get scenarios by category
   */
  static getScenariosByCategory(category: string): ComplianceScenario[] {
    return this.getAllScenarios().filter(scenario => scenario.category === category);
  }

  // AML Detection Scenarios

  static getStructuringScenario(): ComplianceScenario {
    return {
      id: 'aml_001_structuring',
      name: 'Structuring Detection Test',
      description: 'Test detection of structuring (smurfing) patterns - multiple transactions below reporting thresholds',
      category: 'aml_detection',
      severity: 'high',
      jurisdiction: ['US', 'EU', 'UK'],
      tags: ['structuring', 'smurfing', 'aml', 'pattern_detection'],
      setup: {
        users: [
          {
            id: 'user_structuring',
            type: 'traditional',
            jurisdiction: 'US',
            riskProfile: { overallRisk: 'medium' },
            kycLevel: 'enhanced',
            attributes: { 
              businessType: 'import_export',
              accountAge: 365,
              avgMonthlyVolume: 50000
            }
          }
        ],
        accounts: [
          {
            id: 'account_primary',
            userId: 'user_structuring',
            type: 'checking',
            balance: 100000,
            currency: 'USD',
            metadata: {}
          }
        ],
        initialState: {
          reportingThreshold: 10000,
          structuringWindow: 24 * 60 * 60 * 1000 // 24 hours
        }
      },
      steps: [
        {
          id: 'step_1',
          action: {
            type: 'create_transaction',
            target: 'compliance_engine',
            method: 'processTransaction',
            params: []
          },
          data: {
            userId: 'user_structuring',
            fromAccount: 'account_primary',
            toAccount: 'external_account_1',
            amount: 9800,
            type: 'wire_transfer',
            currency: 'USD'
          }
        },
        {
          id: 'step_2',
          action: {
            type: 'create_transaction',
            target: 'compliance_engine',
            method: 'processTransaction',
            params: []
          },
          data: {
            userId: 'user_structuring',
            fromAccount: 'account_primary',
            toAccount: 'external_account_2',
            amount: 9750,
            type: 'wire_transfer',
            currency: 'USD'
          },
          delay: 3600000 // 1 hour later
        },
        {
          id: 'step_3',
          action: {
            type: 'create_transaction',
            target: 'compliance_engine',
            method: 'processTransaction',
            params: []
          },
          data: {
            userId: 'user_structuring',
            fromAccount: 'account_primary',
            toAccount: 'external_account_3',
            amount: 9900,
            type: 'wire_transfer',
            currency: 'USD'
          },
          delay: 3600000 // Another hour later
        }
      ],
      expectedOutcomes: [
        {
          type: 'compliance_violation',
          value: {
            type: 'structuring',
            severity: 'high',
            transactionCount: 3
          },
          timing: { maxDuration: 5000 }
        },
        {
          type: 'alert_generated',
          value: {
            type: 'suspicious_pattern',
            pattern: 'structuring'
          }
        },
        {
          type: 'case_created',
          value: {
            caseType: 'money_laundering',
            priority: 'high'
          }
        }
      ],
      validationRules: [
        {
          id: 'rule_1',
          type: 'exists',
          target: 'structuring_violation',
          condition: 'not_null',
          value: true,
          errorMessage: 'Structuring pattern should have been detected'
        },
        {
          id: 'rule_2',
          type: 'range',
          target: 'risk_score',
          condition: 'between',
          value: { min: 75, max: 100 },
          errorMessage: 'Risk score should be elevated for structuring pattern'
        }
      ],
      metadata: {
        createdBy: 'compliance_team',
        createdAt: new Date(),
        lastModified: new Date(),
        version: '1.0.0',
        regulatoryReferences: ['BSA', 'FinCEN', 'EU_4AML'],
        testFrequency: 'daily',
        priority: 'critical'
      }
    };
  }

  static getLayeringScenario(): ComplianceScenario {
    return {
      id: 'aml_002_layering',
      name: 'Layering Detection Test',
      description: 'Test detection of layering patterns - complex chains of transactions to obscure origin',
      category: 'aml_detection',
      severity: 'high',
      jurisdiction: ['US', 'EU', 'UK', 'Singapore'],
      tags: ['layering', 'money_laundering', 'complex_patterns'],
      setup: {
        users: [
          {
            id: 'user_layer_1',
            type: 'traditional',
            jurisdiction: 'US',
            riskProfile: { overallRisk: 'low' },
            kycLevel: 'basic',
            attributes: {}
          },
          {
            id: 'user_layer_2',
            type: 'traditional',
            jurisdiction: 'EU',
            riskProfile: { overallRisk: 'low' },
            kycLevel: 'basic',
            attributes: {}
          },
          {
            id: 'user_layer_3',
            type: 'traditional',
            jurisdiction: 'Singapore',
            riskProfile: { overallRisk: 'low' },
            kycLevel: 'basic',
            attributes: {}
          }
        ],
        accounts: [
          {
            id: 'account_layer_1',
            userId: 'user_layer_1',
            type: 'checking',
            balance: 50000,
            currency: 'USD',
            metadata: {}
          },
          {
            id: 'account_layer_2',
            userId: 'user_layer_2',
            type: 'savings',
            balance: 50000,
            currency: 'EUR',
            metadata: {}
          },
          {
            id: 'account_layer_3',
            userId: 'user_layer_3',
            type: 'investment',
            balance: 50000,
            currency: 'SGD',
            metadata: {}
          }
        ],
        initialState: {
          layeringThreshold: 3,
          timeWindow: 48 * 60 * 60 * 1000 // 48 hours
        }
      },
      steps: [
        // Create a chain of transactions through multiple accounts
        {
          id: 'layer_1_to_2',
          action: {
            type: 'create_transaction',
            target: 'compliance_engine',
            method: 'processTransaction',
            params: []
          },
          data: {
            userId: 'user_layer_1',
            fromAccount: 'account_layer_1',
            toAccount: 'account_layer_2',
            amount: 25000,
            type: 'international_wire',
            currency: 'USD'
          }
        },
        {
          id: 'layer_2_to_3',
          action: {
            type: 'create_transaction',
            target: 'compliance_engine',
            method: 'processTransaction',
            params: []
          },
          data: {
            userId: 'user_layer_2',
            fromAccount: 'account_layer_2',
            toAccount: 'account_layer_3',
            amount: 24500, // Slightly less due to fees
            type: 'international_wire',
            currency: 'EUR'
          },
          delay: 7200000 // 2 hours later
        },
        {
          id: 'layer_3_split',
          action: {
            type: 'create_transaction',
            target: 'compliance_engine',
            method: 'processTransaction',
            params: []
          },
          data: {
            userId: 'user_layer_3',
            fromAccount: 'account_layer_3',
            toAccount: 'external_account_final',
            amount: 12000,
            type: 'domestic_transfer',
            currency: 'SGD'
          },
          delay: 10800000 // 3 hours later
        }
      ],
      expectedOutcomes: [
        {
          type: 'compliance_violation',
          value: {
            type: 'layering',
            severity: 'high',
            chainLength: 3
          }
        },
        {
          type: 'risk_score',
          value: 85,
          tolerance: 10
        }
      ],
      validationRules: [
        {
          id: 'layering_detected',
          type: 'exists',
          target: 'layering_pattern',
          condition: 'exists',
          value: true,
          errorMessage: 'Layering pattern should be detected in transaction chain'
        }
      ],
      metadata: {
        createdBy: 'compliance_team',
        createdAt: new Date(),
        lastModified: new Date(),
        version: '1.0.0',
        regulatoryReferences: ['FATF_Recommendations', 'BSA', 'EU_4AML'],
        testFrequency: 'weekly',
        priority: 'high'
      }
    };
  }

  static getRapidMovementScenario(): ComplianceScenario {
    return {
      id: 'aml_003_rapid_movement',
      name: 'Rapid Fund Movement Test',
      description: 'Test detection of unusually rapid movement of funds through multiple accounts',
      category: 'aml_detection',
      severity: 'medium',
      jurisdiction: ['US', 'UK'],
      tags: ['rapid_movement', 'velocity', 'suspicious_pattern'],
      setup: {
        users: [
          {
            id: 'user_rapid',
            type: 'traditional',
            jurisdiction: 'US',
            riskProfile: { overallRisk: 'medium' },
            kycLevel: 'enhanced',
            attributes: { 
              normalVelocity: 2, // transactions per day
              avgAmount: 5000
            }
          }
        ],
        accounts: [
          {
            id: 'account_rapid_1',
            userId: 'user_rapid',
            type: 'checking',
            balance: 100000,
            currency: 'USD',
            metadata: {}
          },
          {
            id: 'account_rapid_2',
            userId: 'user_rapid',
            type: 'savings',
            balance: 50000,
            currency: 'USD',
            metadata: {}
          }
        ],
        initialState: {
          rapidThreshold: 5, // transactions per hour
          timeWindow: 60 * 60 * 1000 // 1 hour
        }
      },
      steps: [
        // Execute multiple rapid transactions
        {
          id: 'rapid_1',
          action: {
            type: 'create_transaction',
            target: 'compliance_engine',
            method: 'processTransaction',
            params: []
          },
          data: {
            userId: 'user_rapid',
            fromAccount: 'account_rapid_1',
            toAccount: 'account_rapid_2',
            amount: 15000,
            type: 'internal_transfer'
          }
        },
        {
          id: 'rapid_2',
          action: {
            type: 'create_transaction',
            target: 'compliance_engine',
            method: 'processTransaction',
            params: []
          },
          data: {
            userId: 'user_rapid',
            fromAccount: 'account_rapid_2',
            toAccount: 'external_account_1',
            amount: 7500,
            type: 'wire_transfer'
          },
          delay: 600000 // 10 minutes
        },
        {
          id: 'rapid_3',
          action: {
            type: 'create_transaction',
            target: 'compliance_engine',
            method: 'processTransaction',
            params: []
          },
          data: {
            userId: 'user_rapid',
            fromAccount: 'account_rapid_2',
            toAccount: 'external_account_2',
            amount: 7500,
            type: 'wire_transfer'
          },
          delay: 600000 // Another 10 minutes
        }
      ],
      expectedOutcomes: [
        {
          type: 'compliance_violation',
          value: {
            type: 'rapid_movement',
            severity: 'medium'
          }
        },
        {
          type: 'alert_generated',
          value: {
            type: 'velocity_anomaly'
          }
        }
      ],
      validationRules: [
        {
          id: 'velocity_exceeded',
          type: 'exists',
          target: 'velocity_violation',
          condition: 'exists',
          value: true,
          errorMessage: 'Velocity limits should be exceeded'
        }
      ],
      metadata: {
        createdBy: 'compliance_team',
        createdAt: new Date(),
        lastModified: new Date(),
        version: '1.0.0',
        regulatoryReferences: ['BSA', 'FinCEN_Guidelines'],
        testFrequency: 'daily',
        priority: 'high'
      }
    };
  }

  static getHighRiskCounterpartyScenario(): ComplianceScenario {
    return {
      id: 'aml_004_high_risk_counterparty',
      name: 'High-Risk Counterparty Detection',
      description: 'Test detection of transactions with high-risk counterparties',
      category: 'aml_detection',
      severity: 'high',
      jurisdiction: ['US', 'EU', 'UK'],
      tags: ['high_risk', 'counterparty', 'sanctions', 'pep'],
      setup: {
        users: [
          {
            id: 'user_normal',
            type: 'traditional',
            jurisdiction: 'US',
            riskProfile: { overallRisk: 'low' },
            kycLevel: 'basic',
            attributes: {}
          }
        ],
        accounts: [
          {
            id: 'account_normal',
            userId: 'user_normal',
            type: 'checking',
            balance: 50000,
            currency: 'USD',
            metadata: {}
          }
        ],
        initialState: {
          highRiskCounterparties: [
            'sanctioned_entity_1',
            'pep_account_1',
            'high_risk_jurisdiction_account'
          ]
        },
        mockData: {
          counterpartyRisk: {
            'sanctioned_entity_1': { riskLevel: 'critical', category: 'sanctions' },
            'pep_account_1': { riskLevel: 'high', category: 'pep' },
            'high_risk_jurisdiction_account': { riskLevel: 'high', category: 'jurisdiction' }
          }
        }
      },
      steps: [
        {
          id: 'transaction_to_sanctioned',
          action: {
            type: 'create_transaction',
            target: 'compliance_engine',
            method: 'processTransaction',
            params: []
          },
          data: {
            userId: 'user_normal',
            fromAccount: 'account_normal',
            toAccount: 'sanctioned_entity_1',
            amount: 5000,
            type: 'wire_transfer',
            currency: 'USD'
          }
        }
      ],
      expectedOutcomes: [
        {
          type: 'compliance_violation',
          value: {
            type: 'sanctions_violation',
            severity: 'critical'
          }
        },
        {
          type: 'transaction_blocked',
          value: true
        },
        {
          type: 'alert_generated',
          value: {
            type: 'sanctions_hit',
            severity: 'critical'
          }
        }
      ],
      validationRules: [
        {
          id: 'transaction_blocked',
          type: 'exact_match',
          target: 'transaction_status',
          condition: 'equals',
          value: 'blocked',
          errorMessage: 'Transaction to sanctioned entity should be blocked'
        },
        {
          id: 'sanctions_alert',
          type: 'exists',
          target: 'sanctions_alert',
          condition: 'exists',
          value: true,
          errorMessage: 'Sanctions alert should be generated'
        }
      ],
      metadata: {
        createdBy: 'compliance_team',
        createdAt: new Date(),
        lastModified: new Date(),
        version: '1.0.0',
        regulatoryReferences: ['OFAC', 'EU_Sanctions', 'UN_Security_Council'],
        testFrequency: 'daily',
        priority: 'critical'
      }
    };
  }

  static getVelocityLimitScenario(): ComplianceScenario {
    return {
      id: 'txn_001_velocity_limits',
      name: 'Transaction Velocity Limits Test',
      description: 'Test velocity limit enforcement and detection',
      category: 'transaction_monitoring',
      severity: 'medium',
      jurisdiction: ['US'],
      tags: ['velocity', 'limits', 'monitoring'],
      setup: {
        users: [
          {
            id: 'user_velocity',
            type: 'traditional',
            jurisdiction: 'US',
            riskProfile: { overallRisk: 'low' },
            kycLevel: 'basic',
            attributes: {
              dailyLimit: 10000,
              weeklyLimit: 50000,
              monthlyLimit: 200000
            }
          }
        ],
        accounts: [
          {
            id: 'account_velocity',
            userId: 'user_velocity',
            type: 'checking',
            balance: 100000,
            currency: 'USD',
            metadata: {}
          }
        ],
        initialState: {
          velocityLimits: {
            daily_transaction_volume: 10000,
            weekly_transaction_volume: 50000,
            monthly_transaction_volume: 200000
          }
        }
      },
      steps: [
        // Exceed daily limit
        {
          id: 'exceed_daily_1',
          action: {
            type: 'create_transaction',
            target: 'transaction_monitor',
            method: 'checkVelocityLimits',
            params: []
          },
          data: {
            userId: 'user_velocity',
            fromAccount: 'account_velocity',
            toAccount: 'external_account',
            amount: 7000,
            type: 'wire_transfer'
          }
        },
        {
          id: 'exceed_daily_2',
          action: {
            type: 'create_transaction',
            target: 'transaction_monitor',
            method: 'checkVelocityLimits',
            params: []
          },
          data: {
            userId: 'user_velocity',
            fromAccount: 'account_velocity',
            toAccount: 'external_account_2',
            amount: 5000,
            type: 'wire_transfer'
          },
          delay: 3600000 // 1 hour later
        }
      ],
      expectedOutcomes: [
        {
          type: 'compliance_violation',
          value: {
            type: 'velocity_violation',
            limit: 'daily',
            exceeded: true
          }
        },
        {
          type: 'alert_generated',
          value: {
            type: 'velocity_limit_exceeded'
          }
        }
      ],
      validationRules: [
        {
          id: 'velocity_alert',
          type: 'exists',
          target: 'velocity_alert',
          condition: 'exists',
          value: true,
          errorMessage: 'Velocity limit alert should be generated'
        }
      ],
      metadata: {
        createdBy: 'compliance_team',
        createdAt: new Date(),
        lastModified: new Date(),
        version: '1.0.0',
        regulatoryReferences: ['Internal_Risk_Policy'],
        testFrequency: 'daily',
        priority: 'medium'
      }
    };
  }

  static getSARFilingScenario(): ComplianceScenario {
    return {
      id: 'rep_001_sar_filing',
      name: 'SAR Filing Automation Test',
      description: 'Test automatic SAR filing for suspicious activities',
      category: 'regulatory_reporting',
      severity: 'high',
      jurisdiction: ['US'],
      tags: ['sar', 'filing', 'reporting', 'automation'],
      setup: {
        users: [
          {
            id: 'user_suspicious',
            type: 'traditional',
            jurisdiction: 'US',
            riskProfile: { overallRisk: 'high' },
            kycLevel: 'enhanced',
            attributes: {
              previousSARs: 1,
              suspiciousActivityFlags: ['structuring', 'unusual_patterns']
            }
          }
        ],
        accounts: [
          {
            id: 'account_suspicious',
            userId: 'user_suspicious',
            type: 'checking',
            balance: 200000,
            currency: 'USD',
            metadata: {}
          }
        ],
        initialState: {
          sarThreshold: 75, // Risk score threshold
          autoFilingEnabled: true
        }
      },
      steps: [
        // Create highly suspicious transaction
        {
          id: 'suspicious_transaction',
          action: {
            type: 'create_transaction',
            target: 'case_manager',
            method: 'createCase',
            params: []
          },
          data: {
            userId: 'user_suspicious',
            fromAccount: 'account_suspicious',
            toAccount: 'high_risk_entity',
            amount: 95000,
            type: 'wire_transfer',
            currency: 'USD',
            flags: ['structuring', 'high_risk_counterparty']
          }
        },
        // Trigger case escalation
        {
          id: 'escalate_case',
          action: {
            type: 'trigger_alert',
            target: 'case_manager',
            method: 'escalateCase',
            params: []
          },
          data: {
            reason: 'multiple_red_flags',
            escalatedBy: 'system'
          },
          delay: 1000
        },
        // Initiate SAR filing
        {
          id: 'file_sar',
          action: {
            type: 'api_call',
            target: 'case_manager',
            method: 'initiateSARFiling',
            params: []
          },
          data: {
            filedBy: 'compliance_officer',
            additionalInfo: {
              suspicious_activity: 'Potential structuring with high-risk counterparty'
            }
          },
          delay: 2000
        }
      ],
      expectedOutcomes: [
        {
          type: 'case_created',
          value: {
            caseType: 'money_laundering',
            priority: 'critical'
          }
        },
        {
          type: 'report_filed',
          value: {
            type: 'SAR',
            status: 'filed'
          }
        }
      ],
      validationRules: [
        {
          id: 'sar_filed',
          type: 'exists',
          target: 'sar_number',
          condition: 'exists',
          value: true,
          errorMessage: 'SAR should be automatically filed for high-risk case'
        },
        {
          id: 'case_escalated',
          type: 'exact_match',
          target: 'case_status',
          condition: 'equals',
          value: 'escalated',
          errorMessage: 'Case should be escalated before SAR filing'
        }
      ],
      metadata: {
        createdBy: 'compliance_team',
        createdAt: new Date(),
        lastModified: new Date(),
        version: '1.0.0',
        regulatoryReferences: ['BSA_Section_314', 'FinCEN_SAR_Rules'],
        testFrequency: 'weekly',
        priority: 'critical'
      }
    };
  }

  static getHighVolumeStressScenario(): ComplianceScenario {
    return {
      id: 'stress_001_high_volume',
      name: 'High Volume Stress Test',
      description: 'Test system performance under high transaction volume',
      category: 'system_stress',
      severity: 'medium',
      jurisdiction: ['US', 'EU'],
      tags: ['stress_test', 'performance', 'volume'],
      setup: {
        users: Array.from({ length: 100 }, (_, i) => ({
          id: `stress_user_${i}`,
          type: 'traditional' as const,
          jurisdiction: 'US' as const,
          riskProfile: { overallRisk: 'low' as const },
          kycLevel: 'basic',
          attributes: {}
        })),
        accounts: Array.from({ length: 100 }, (_, i) => ({
          id: `stress_account_${i}`,
          userId: `stress_user_${i}`,
          type: 'checking',
          balance: 10000,
          currency: 'USD',
          metadata: {}
        })),
        initialState: {
          targetTPS: 100, // Transactions per second
          duration: 60000, // 1 minute
          expectedViolations: 5
        }
      },
      steps: [
        {
          id: 'stress_transactions',
          action: {
            type: 'create_transaction',
            target: 'compliance_engine',
            method: 'processTransaction',
            params: []
          },
          data: {
            amount: 1000,
            type: 'transfer',
            currency: 'USD'
          },
          repeat: 6000 // 6000 transactions over 1 minute
        }
      ],
      expectedOutcomes: [
        {
          type: 'performance_metric',
          value: {
            throughput: 100,
            avgResponseTime: 50,
            p95ResponseTime: 100
          },
          tolerance: 20
        }
      ],
      validationRules: [
        {
          id: 'throughput_maintained',
          type: 'range',
          target: 'throughput',
          condition: 'between',
          value: { min: 80, max: 120 },
          errorMessage: 'Throughput should be maintained under load'
        },
        {
          id: 'response_time',
          type: 'range',
          target: 'avg_response_time',
          condition: 'less_than',
          value: 100,
          errorMessage: 'Average response time should remain acceptable'
        }
      ],
      metadata: {
        createdBy: 'engineering_team',
        createdAt: new Date(),
        lastModified: new Date(),
        version: '1.0.0',
        regulatoryReferences: [],
        testFrequency: 'weekly',
        priority: 'medium'
      }
    };
  }

  static getEvasionAttemptScenario(): ComplianceScenario {
    return {
      id: 'adv_001_evasion',
      name: 'Evasion Attempt Detection',
      description: 'Test detection of sophisticated evasion attempts',
      category: 'adversarial',
      severity: 'critical',
      jurisdiction: ['US', 'EU', 'UK'],
      tags: ['evasion', 'adversarial', 'sophisticated'],
      setup: {
        users: [
          {
            id: 'user_evader',
            type: 'traditional',
            jurisdiction: 'US',
            riskProfile: { overallRisk: 'low' }, // Appears low risk
            kycLevel: 'enhanced',
            attributes: {
              sophisticatedUser: true,
              previousCleanHistory: 365 // Days of clean history
            }
          }
        ],
        accounts: [
          {
            id: 'account_evader_1',
            userId: 'user_evader',
            type: 'checking',
            balance: 500000,
            currency: 'USD',
            metadata: {}
          },
          {
            id: 'account_evader_2',
            userId: 'user_evader',
            type: 'investment',
            balance: 300000,
            currency: 'USD',
            metadata: {}
          }
        ],
        initialState: {
          evasionPatterns: [
            'timing_manipulation',
            'amount_randomization',
            'account_rotation',
            'jurisdictional_arbitrage'
          ]
        }
      },
      steps: [
        // Sophisticated evasion: random amounts, timing, multiple accounts
        {
          id: 'evasion_tx_1',
          action: {
            type: 'create_transaction',
            target: 'compliance_engine',
            method: 'processTransaction',
            params: []
          },
          data: {
            userId: 'user_evader',
            fromAccount: 'account_evader_1',
            toAccount: 'intermediate_account_1',
            amount: 9873, // Randomized amount below threshold
            type: 'wire_transfer',
            currency: 'USD'
          }
        },
        {
          id: 'evasion_tx_2',
          action: {
            type: 'create_transaction',
            target: 'compliance_engine',
            method: 'processTransaction',
            params: []
          },
          data: {
            userId: 'user_evader',
            fromAccount: 'account_evader_2',
            toAccount: 'intermediate_account_2',
            amount: 8247, // Different randomized amount
            type: 'domestic_transfer',
            currency: 'USD'
          },
          delay: 14400000 // 4 hours later (randomized timing)
        },
        {
          id: 'evasion_tx_3',
          action: {
            type: 'create_transaction',
            target: 'compliance_engine',
            method: 'processTransaction',
            params: []
          },
          data: {
            userId: 'user_evader',
            fromAccount: 'account_evader_1',
            toAccount: 'intermediate_account_3',
            amount: 9156,
            type: 'check_deposit',
            currency: 'USD'
          },
          delay: 25200000 // 7 hours later
        }
      ],
      expectedOutcomes: [
        {
          type: 'compliance_violation',
          value: {
            type: 'sophisticated_evasion',
            severity: 'critical',
            confidence: 0.8
          }
        },
        {
          type: 'risk_score',
          value: 90,
          tolerance: 10
        },
        {
          type: 'alert_generated',
          value: {
            type: 'evasion_pattern',
            sophistication: 'high'
          }
        }
      ],
      validationRules: [
        {
          id: 'evasion_detected',
          type: 'exists',
          target: 'evasion_pattern',
          condition: 'exists',
          value: true,
          errorMessage: 'Sophisticated evasion pattern should be detected'
        },
        {
          id: 'high_risk_score',
          type: 'range',
          target: 'risk_score',
          condition: 'greater_than',
          value: 85,
          errorMessage: 'Risk score should be elevated for evasion attempt'
        }
      ],
      metadata: {
        createdBy: 'red_team',
        createdAt: new Date(),
        lastModified: new Date(),
        version: '1.0.0',
        regulatoryReferences: ['FATF_Evasion_Typologies'],
        testFrequency: 'monthly',
        priority: 'critical'
      }
    };
  }

  // Additional helper methods for incomplete scenarios
  static getUnusualPatternScenario(): ComplianceScenario {
    // Implementation for unusual pattern detection
    return this.getStructuringScenario(); // Placeholder
  }

  static getKYCEscalationScenario(): ComplianceScenario {
    // Implementation for KYC escalation testing
    return this.getStructuringScenario(); // Placeholder
  }

  static getDocumentVerificationScenario(): ComplianceScenario {
    // Implementation for document verification testing
    return this.getStructuringScenario(); // Placeholder
  }

  static getPEPScreeningScenario(): ComplianceScenario {
    // Implementation for PEP screening testing
    return this.getStructuringScenario(); // Placeholder
  }

  static getCrossBorderScenario(): ComplianceScenario {
    // Implementation for cross-border transaction testing
    return this.getStructuringScenario(); // Placeholder
  }

  static getLargeTransactionScenario(): ComplianceScenario {
    // Implementation for large transaction testing
    return this.getStructuringScenario(); // Placeholder
  }

  static getSanctionsHitScenario(): ComplianceScenario {
    // Implementation for sanctions hit testing
    return this.getHighRiskCounterpartyScenario(); // Similar logic
  }

  static getWatchlistMatchScenario(): ComplianceScenario {
    // Implementation for watchlist matching
    return this.getHighRiskCounterpartyScenario(); // Similar logic
  }

  static getCTRReportingScenario(): ComplianceScenario {
    // Implementation for CTR reporting testing
    return this.getSARFilingScenario(); // Similar logic
  }

  static getConcurrentTransactionScenario(): ComplianceScenario {
    // Implementation for concurrent transaction testing
    return this.getHighVolumeStressScenario(); // Similar logic
  }

  static getFalsePositiveScenario(): ComplianceScenario {
    // Implementation for false positive testing
    return this.getStructuringScenario(); // Placeholder
  }

  static getEdgeCaseScenario(): ComplianceScenario {
    // Implementation for edge case testing
    return this.getStructuringScenario(); // Placeholder
  }
}

export default ComplianceScenarioLibrary;