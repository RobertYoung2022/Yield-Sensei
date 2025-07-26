/**
 * Regulatory Compliance Framework Configuration
 * Default configurations for multi-jurisdictional compliance
 */

import { 
  ComplianceConfig, 
  Jurisdiction, 
  ComplianceCategory, 
  ActivityLevel, 
  KYCLevel, 
  DocumentType,
  ReportType,
  RiskLevel
} from '../types';

export const DEFAULT_COMPLIANCE_CONFIG: ComplianceConfig = {
  jurisdictions: [
    // United States
    {
      jurisdiction: 'US',
      enabled: true,
      requirements: [
        {
          category: 'kyc-aml',
          required: true,
          level: 'enhanced',
          description: 'BSA/AML compliance with FinCEN requirements'
        },
        {
          category: 'securities',
          required: true,
          level: 'institutional',
          description: 'SEC registration and compliance for digital assets'
        },
        {
          category: 'consumer-protection',
          required: true,
          level: 'basic',
          description: 'CFPB consumer protection requirements'
        }
      ],
      thresholds: [
        {
          name: 'CTR_threshold',
          value: 10000,
          currency: 'USD',
          timeframe: 'daily',
          action: 'file_CTR'
        },
        {
          name: 'SAR_threshold',
          value: 5000,
          currency: 'USD',
          timeframe: 'single_transaction',
          action: 'evaluate_SAR'
        }
      ],
      reporting: [
        {
          type: 'suspicious-activity-report',
          frequency: 'as_needed',
          required: true,
          dueDate: '30_days'
        },
        {
          type: 'large-cash-transaction',
          frequency: 'as_needed',
          threshold: 10000,
          required: true,
          dueDate: '15_days'
        }
      ]
    },

    // European Union
    {
      jurisdiction: 'EU',
      enabled: true,
      requirements: [
        {
          category: 'kyc-aml',
          required: true,
          level: 'enhanced',
          description: '5th Anti-Money Laundering Directive compliance'
        },
        {
          category: 'data-privacy',
          required: true,
          level: 'institutional',
          description: 'GDPR data protection compliance'
        },
        {
          category: 'securities',
          required: true,
          level: 'enhanced',
          description: 'MiFID II and MiCA compliance'
        }
      ],
      thresholds: [
        {
          name: 'EU_AML_threshold',
          value: 15000,
          currency: 'EUR',
          timeframe: 'daily',
          action: 'enhanced_due_diligence'
        }
      ],
      reporting: [
        {
          type: 'suspicious-activity-report',
          frequency: 'as_needed',
          required: true,
          dueDate: 'immediately'
        }
      ]
    },

    // United Kingdom
    {
      jurisdiction: 'UK',
      enabled: true,
      requirements: [
        {
          category: 'kyc-aml',
          required: true,
          level: 'enhanced',
          description: 'FCA and MLR 2017 compliance'
        },
        {
          category: 'securities',
          required: true,
          level: 'institutional',
          description: 'FCA authorization and conduct rules'
        }
      ],
      thresholds: [
        {
          name: 'UK_SAR_threshold',
          value: 10000,
          currency: 'GBP',
          timeframe: 'daily',
          action: 'file_SAR'
        }
      ],
      reporting: [
        {
          type: 'suspicious-activity-report',
          frequency: 'as_needed',
          required: true,
          dueDate: 'immediately'
        }
      ]
    },

    // Singapore
    {
      jurisdiction: 'Singapore',
      enabled: true,
      requirements: [
        {
          category: 'kyc-aml',
          required: true,
          level: 'enhanced',
          description: 'MAS AML/CFT requirements'
        },
        {
          category: 'securities',
          required: true,
          level: 'institutional',
          description: 'MAS licensing and conduct requirements'
        }
      ],
      thresholds: [
        {
          name: 'SG_STR_threshold',
          value: 20000,
          currency: 'SGD',
          timeframe: 'daily',
          action: 'file_STR'
        }
      ],
      reporting: [
        {
          type: 'suspicious-activity-report',
          frequency: 'as_needed',
          required: true,
          dueDate: '5_days'
        }
      ]
    }
  ],

  monitoring: {
    realTime: true,
    intervals: {
      transactionScreening: 1000, // 1 second
      userReview: 3600000, // 1 hour
      riskAssessment: 86400000, // 24 hours
      reportGeneration: 86400000 // 24 hours
    },
    thresholds: {
      transactionAmount: {
        'USD': 10000,
        'EUR': 8500,
        'GBP': 7500,
        'SGD': 13500,
        'CHF': 9000
      },
      velocityLimits: {
        'daily_transaction_count': 50,
        'daily_transaction_volume': 100000,
        'weekly_transaction_volume': 500000,
        'monthly_transaction_volume': 2000000
      },
      riskScores: {
        'low': 25,
        'medium': 50,
        'high': 75,
        'critical': 90
      }
    }
  },

  kyc: {
    providers: [
      {
        name: 'jumio',
        enabled: true,
        primary: true,
        apiKey: '${JUMIO_API_KEY}',
        endpoint: 'https://api.jumio.com',
        supportedDocuments: ['passport', 'drivers-license', 'national-id'],
        supportedCountries: ['US', 'EU', 'UK', 'SG', 'CH', 'CA', 'AU']
      },
      {
        name: 'onfido',
        enabled: true,
        primary: false,
        apiKey: '${ONFIDO_API_KEY}',
        endpoint: 'https://api.onfido.com',
        supportedDocuments: ['passport', 'drivers-license', 'national-id', 'proof-of-address'],
        supportedCountries: ['US', 'EU', 'UK', 'SG', 'CH']
      }
    ],
    requirements: [
      {
        activityLevel: 'retail',
        requiredLevel: 'basic',
        documents: ['national-id', 'proof-of-address'],
        renewalPeriod: 365,
        enhancedDueDiligence: false
      },
      {
        activityLevel: 'professional',
        requiredLevel: 'enhanced',
        documents: ['passport', 'proof-of-address', 'bank-statement'],
        renewalPeriod: 365,
        enhancedDueDiligence: true
      },
      {
        activityLevel: 'institutional',
        requiredLevel: 'institutional',
        documents: ['corporate-documents', 'beneficial-ownership', 'financial-statements'],
        renewalPeriod: 365,
        enhancedDueDiligence: true
      },
      {
        activityLevel: 'high-net-worth',
        requiredLevel: 'enhanced',
        documents: ['passport', 'proof-of-address', 'bank-statement', 'tax-document'],
        renewalPeriod: 180,
        enhancedDueDiligence: true
      }
    ],
    automation: {
      autoApprove: true,
      confidenceThreshold: 0.95,
      manualReviewTriggers: [
        'low_confidence_score',
        'sanctions_hit',
        'pep_match',
        'high_risk_country',
        'document_quality_issues'
      ],
      escalationRules: [
        'repeated_failures',
        'suspicious_documents',
        'identity_verification_failure'
      ]
    }
  },

  screening: {
    providers: [
      {
        name: 'chainalysis',
        type: 'sanctions',
        enabled: true,
        apiKey: '${CHAINALYSIS_API_KEY}',
        endpoint: 'https://api.chainalysis.com',
        updateFrequency: 3600000 // 1 hour
      },
      {
        name: 'trm-labs',
        type: 'aml',
        enabled: true,
        apiKey: '${TRM_LABS_API_KEY}',
        endpoint: 'https://api.trmlabs.com',
        updateFrequency: 3600000 // 1 hour
      },
      {
        name: 'refinitiv',
        type: 'sanctions',
        enabled: true,
        apiKey: '${REFINITIV_API_KEY}',
        endpoint: 'https://api.refinitiv.com',
        updateFrequency: 86400000 // 24 hours
      }
    ],
    lists: [
      {
        name: 'OFAC_SDN',
        source: 'US Treasury OFAC',
        enabled: true,
        jurisdiction: 'US',
        type: 'sanctions',
        lastUpdated: new Date()
      },
      {
        name: 'EU_Sanctions',
        source: 'European Union',
        enabled: true,
        jurisdiction: 'EU',
        type: 'sanctions',
        lastUpdated: new Date()
      },
      {
        name: 'UN_Sanctions',
        source: 'United Nations',
        enabled: true,
        jurisdiction: 'US', // Global but processed in US context
        type: 'sanctions',
        lastUpdated: new Date()
      }
    ],
    matching: {
      exactMatch: true,
      fuzzyMatch: true,
      fuzzyThreshold: 0.85,
      aliasMatch: true,
      phoneticMatch: false
    }
  },

  reporting: {
    automated: true,
    schedules: [
      {
        type: 'periodic-compliance',
        frequency: 'daily',
        timezone: 'UTC',
        enabled: true,
        recipients: ['compliance@yieldsensei.com']
      },
      {
        type: 'audit-report',
        frequency: 'weekly',
        timezone: 'UTC',
        enabled: true,
        recipients: ['audit@yieldsensei.com', 'compliance@yieldsensei.com']
      },
      {
        type: 'regulatory-capital',
        frequency: 'monthly',
        timezone: 'UTC',
        enabled: true,
        recipients: ['finance@yieldsensei.com', 'compliance@yieldsensei.com']
      }
    ],
    storage: {
      retention: 2555, // 7 years in days
      encryption: true,
      backup: true,
      archival: true
    },
    distribution: {
      email: true,
      secure: true,
      api: true,
      regulatoryPortal: false
    }
  },

  alerts: {
    channels: [
      {
        type: 'email',
        enabled: true,
        endpoint: 'smtp://mail.yieldsensei.com',
        credentials: {
          username: '${SMTP_USERNAME}',
          password: '${SMTP_PASSWORD}'
        },
        filters: [
          {
            severity: ['medium', 'high', 'critical'],
            categories: ['kyc-aml', 'securities', 'sanctions'],
            jurisdictions: ['US', 'EU', 'UK', 'Singapore'],
            entityTypes: ['user', 'transaction']
          }
        ]
      },
      {
        type: 'slack',
        enabled: true,
        endpoint: '${SLACK_WEBHOOK_URL}',
        filters: [
          {
            severity: ['high', 'critical'],
            categories: ['kyc-aml', 'securities', 'sanctions'],
            jurisdictions: ['US', 'EU', 'UK', 'Singapore'],
            entityTypes: ['user', 'transaction', 'system']
          }
        ]
      },
      {
        type: 'webhook',
        enabled: true,
        endpoint: 'https://api.yieldsensei.com/compliance/alerts',
        filters: [
          {
            severity: ['critical'],
            categories: ['kyc-aml', 'securities', 'sanctions'],
            jurisdictions: ['US', 'EU', 'UK', 'Singapore'],
            entityTypes: ['user', 'transaction', 'protocol', 'system']
          }
        ]
      }
    ],
    escalation: {
      enabled: true,
      levels: [
        {
          level: 1,
          delay: 300000, // 5 minutes
          recipients: ['compliance-l1@yieldsensei.com'],
          channels: ['email', 'slack']
        },
        {
          level: 2,
          delay: 900000, // 15 minutes
          recipients: ['compliance-l2@yieldsensei.com', 'compliance-manager@yieldsensei.com'],
          channels: ['email', 'slack', 'webhook']
        },
        {
          level: 3,
          delay: 1800000, // 30 minutes
          recipients: ['cco@yieldsensei.com', 'ceo@yieldsensei.com'],
          channels: ['email', 'slack', 'sms']
        }
      ],
      timeout: 3600000 // 1 hour
    },
    suppression: {
      enabled: true,
      rules: [
        {
          condition: 'duplicate_alert_same_entity_1h',
          duration: 3600000,
          reason: 'Prevent duplicate alerts for same entity within 1 hour'
        },
        {
          condition: 'maintenance_mode',
          duration: 0,
          reason: 'Suppress non-critical alerts during maintenance'
        }
      ]
    }
  }
};

// Jurisdiction-specific configurations
export const JURISDICTION_CONFIGS = {
  US: {
    regulators: ['FinCEN', 'SEC', 'CFPB', 'CFTC'],
    languages: ['en'],
    currency: 'USD',
    timezone: 'America/New_York',
    businessHours: {
      start: '09:00',
      end: '17:00',
      days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
    },
    reportingRequirements: {
      'SAR': { threshold: 5000, timeframe: '30_days' },
      'CTR': { threshold: 10000, timeframe: '15_days' }
    }
  },
  EU: {
    regulators: ['EBA', 'ESMA', 'ECB'],
    languages: ['en', 'de', 'fr', 'es', 'it'],
    currency: 'EUR',
    timezone: 'Europe/Brussels',
    businessHours: {
      start: '09:00',
      end: '17:00',
      days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
    },
    reportingRequirements: {
      'SAR': { threshold: 15000, timeframe: 'immediately' }
    }
  },
  UK: {
    regulators: ['FCA', 'PRA', 'NCA'],
    languages: ['en'],
    currency: 'GBP',
    timezone: 'Europe/London',
    businessHours: {
      start: '09:00',
      end: '17:00',
      days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
    },
    reportingRequirements: {
      'SAR': { threshold: 10000, timeframe: 'immediately' }
    }
  },
  Singapore: {
    regulators: ['MAS'],
    languages: ['en'],
    currency: 'SGD',
    timezone: 'Asia/Singapore',
    businessHours: {
      start: '09:00',
      end: '17:00',
      days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
    },
    reportingRequirements: {
      'STR': { threshold: 20000, timeframe: '5_days' }
    }
  }
};

// Risk scoring matrices
export const RISK_SCORING_MATRICES = {
  country: {
    'US': 10,
    'UK': 10,
    'EU': 10,
    'Singapore': 15,
    'Switzerland': 15,
    'Japan': 15,
    'Canada': 15,
    'Australia': 15,
    // High-risk countries
    'Afghanistan': 95,
    'Iran': 95,
    'North Korea': 95,
    'Syria': 95,
    'Myanmar': 90,
    'Belarus': 85,
    'Russia': 80,
    'China': 60
  },
  activityLevel: {
    'retail': 10,
    'professional': 25,
    'high-net-worth': 40,
    'institutional': 60
  },
  transactionType: {
    'deposit': 10,
    'withdrawal': 25,
    'trade': 15,
    'yield-deposit': 20,
    'yield-withdrawal': 30,
    'bridge': 40,
    'staking': 15,
    'unstaking': 20,
    'lending': 25,
    'borrowing': 35
  }
};

export default DEFAULT_COMPLIANCE_CONFIG;