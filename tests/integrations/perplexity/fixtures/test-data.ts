/**
 * Test Data Fixtures for Perplexity Integration Tests
 * Provides mock data for various test scenarios
 */

/**
 * Mock Perplexity API Response Data
 */
export const PerplexityTestData = {
  /**
   * Standard successful response
   */
  mockSuccessResponse: {
    id: 'test-response-12345',
    object: 'chat.completion',
    created: 1703721600,
    model: 'llama-3.1-sonar-small-128k-online',
    choices: [{
      index: 0,
      finish_reason: 'stop',
      message: {
        role: 'assistant',
        content: 'This is a comprehensive analysis of the requested topic. The research indicates strong market fundamentals with positive growth trends across key metrics. Regulatory compliance remains robust with no significant issues identified.'
      }
    }],
    usage: {
      prompt_tokens: 150,
      completion_tokens: 200,
      total_tokens: 350
    },
    citations: [
      'https://example.com/financial-report-2024',
      'https://regulatory-body.gov/compliance-update',
      'https://market-research.com/industry-trends'
    ]
  },

  /**
   * Large response for performance testing
   */
  mockLargeResponse: {
    id: 'large-response-12345',
    object: 'chat.completion',
    created: 1703721600,
    model: 'llama-3.1-sonar-large-128k-online',
    choices: [{
      index: 0,
      finish_reason: 'stop',
      message: {
        role: 'assistant',
        content: `This is an extensive analysis covering multiple aspects of the research topic. ${' '.repeat(2000)}The comprehensive review includes market analysis, regulatory frameworks, competitive landscape, financial performance metrics, risk assessments, and future outlook projections. ${' '.repeat(3000)}Additional context and detailed findings support the primary conclusions.`
      }
    }],
    usage: {
      prompt_tokens: 500,
      completion_tokens: 1500,
      total_tokens: 2000
    },
    citations: Array.from({ length: 15 }, (_, i) => `https://source${i + 1}.com/research-data`)
  },

  /**
   * Streaming response chunks
   */
  mockStreamingChunks: [
    {
      id: 'stream-chunk-1',
      object: 'chat.completion.chunk',
      created: 1703721600,
      model: 'llama-3.1-sonar-small-128k-online',
      choices: [{
        index: 0,
        delta: { content: 'The analysis shows ' },
        finish_reason: null
      }]
    },
    {
      id: 'stream-chunk-2',
      object: 'chat.completion.chunk',
      created: 1703721601,
      model: 'llama-3.1-sonar-small-128k-online',
      choices: [{
        index: 0,
        delta: { content: 'strong market fundamentals ' },
        finish_reason: null
      }]
    },
    {
      id: 'stream-chunk-3',
      object: 'chat.completion.chunk',
      created: 1703721602,
      model: 'llama-3.1-sonar-small-128k-online',
      choices: [{
        index: 0,
        delta: { content: 'with positive growth trends.' },
        finish_reason: 'stop'
      }]
    }
  ],

  /**
   * Error responses for different HTTP status codes
   */
  mockErrorResponses: {
    400: {
      error: {
        type: 'invalid_request_error',
        message: 'Invalid request parameters',
        code: 'invalid_request'
      }
    },
    401: {
      error: {
        type: 'authentication_error',
        message: 'Invalid API key provided',
        code: 'invalid_api_key'
      }
    },
    403: {
      error: {
        type: 'permission_error',
        message: 'API key does not have required permissions',
        code: 'insufficient_permissions'
      }
    },
    429: {
      error: {
        type: 'rate_limit_error',
        message: 'Rate limit exceeded. Please try again later.',
        code: 'rate_limit_exceeded'
      }
    },
    500: {
      error: {
        type: 'server_error',
        message: 'Internal server error',
        code: 'internal_error'
      }
    },
    503: {
      error: {
        type: 'service_unavailable_error',
        message: 'Service temporarily unavailable',
        code: 'service_unavailable'
      }
    }
  },

  /**
   * Rate limit headers for testing
   */
  mockRateLimitHeaders: {
    'x-ratelimit-limit-requests': '60',
    'x-ratelimit-remaining-requests': '59',
    'x-ratelimit-reset-requests': '2024-01-01T00:01:00Z',
    'x-ratelimit-limit-tokens': '5000',
    'x-ratelimit-remaining-tokens': '4500',
    'x-ratelimit-reset-tokens': '2024-01-01T00:01:00Z'
  }
};

/**
 * Mock Protocol Data for Testing
 */
export const MockProtocolData = {
  /**
   * Standard DeFi protocol
   */
  standardProtocol: {
    id: 'compound-v3',
    name: 'Compound Finance V3',
    category: 'lending',
    tvl: 1250000000, // $1.25B
    chain: 'ethereum',
    tokens: ['COMP', 'USDC', 'WETH'],
    riskScore: 7.5,
    securityScore: 8.2,
    complianceScore: 9.1,
    metadata: {
      launchDate: '2022-08-01',
      auditFirms: ['OpenZeppelin', 'Trail of Bits'],
      governanceToken: 'COMP',
      lastAudit: '2024-01-15'
    }
  },

  /**
   * RWA protocol
   */
  rwaProtocol: {
    id: 'goldfinch-v2',
    name: 'Goldfinch Protocol',
    category: 'rwa',
    tvl: 85000000, // $85M
    chain: 'ethereum',
    tokens: ['GFI', 'FIDU'],
    riskScore: 6.8,
    securityScore: 7.9,
    complianceScore: 8.7,
    assetType: 'credit',
    regulatoryStatus: {
      jurisdiction: 'US',
      licenses: ['SEC Registration'],
      compliance: 'KYC/AML'
    },
    metadata: {
      launchDate: '2021-01-15',
      auditFirms: ['Consensys Diligence'],
      realWorldAssets: ['SME Loans', 'Trade Finance'],
      lastCompliance: '2024-02-01'
    }
  }
};

/**
 * Mock RWA Data for Testing
 */
export const MockRWAData = {
  /**
   * Real estate RWA
   */
  realEstate: {
    id: 'rwa-real-estate-001',
    type: 'real-estate',
    issuer: 'RealT Holdings',
    value: 2500000, // $2.5M
    currency: 'USD',
    location: 'Miami, FL',
    regulatoryStatus: {
      jurisdiction: 'US',
      licenses: ['SEC Regulation D'],
      compliance: 'Accredited Investors Only'
    },
    metrics: {
      occupancyRate: 0.95,
      annualYield: 0.078,
      lastAppraisal: '2024-01-15',
      propertyType: 'Multi-family Residential'
    }
  },

  /**
   * Treasury bills RWA
   */
  treasuryBills: {
    id: 'rwa-treasury-001',
    type: 'treasury-bills',
    issuer: 'US Treasury',
    value: 10000000, // $10M
    currency: 'USD',
    maturity: '2024-12-31',
    regulatoryStatus: {
      jurisdiction: 'US',
      licenses: ['Government Securities'],
      compliance: 'Full Regulatory Compliance'
    },
    metrics: {
      yieldRate: 0.0525,
      creditRating: 'AAA',
      duration: 0.75,
      liquidity: 'High'
    }
  },

  /**
   * Commodities RWA
   */
  commodities: {
    id: 'rwa-gold-001',
    type: 'precious-metals',
    issuer: 'Perth Mint',
    value: 5000000, // $5M
    currency: 'USD',
    commodity: 'Gold',
    regulatoryStatus: {
      jurisdiction: 'Australia',
      licenses: ['LBMA Certified'],
      compliance: 'International Standards'
    },
    metrics: {
      purity: 0.9999,
      weight: '2500 oz',
      storage: 'Segregated Vault',
      insurance: 'Full Coverage'
    }
  }
};

/**
 * Mock Request Data for Testing
 */
export const MockRequestData = {
  /**
   * Standard chat completion request
   */
  standardChatRequest: {
    model: 'llama-3.1-sonar-small-128k-online',
    messages: [
      {
        role: 'system',
        content: 'You are a financial research assistant specializing in DeFi and RWA analysis.'
      },
      {
        role: 'user',
        content: 'Analyze the current market conditions for lending protocols in DeFi.'
      }
    ],
    max_tokens: 1000,
    temperature: 0.7,
    return_citations: true,
    return_related_questions: false
  },

  /**
   * Research query request
   */
  researchRequest: {
    model: 'llama-3.1-sonar-large-128k-online',
    messages: [
      {
        role: 'user',
        content: 'Research the regulatory compliance status of real-world asset tokenization in the United States. Focus on SEC requirements, licensing needs, and recent regulatory updates.'
      }
    ],
    max_tokens: 2000,
    temperature: 0.3,
    return_citations: true,
    return_related_questions: true,
    search_domain: 'regulatory'
  },

  /**
   * Protocol analysis request
   */
  protocolAnalysisRequest: {
    model: 'llama-3.1-sonar-medium-128k-online',
    messages: [
      {
        role: 'user',
        content: 'Provide a comprehensive analysis of Compound Finance protocol including security audits, TVL trends, token economics, and competitive positioning.'
      }
    ],
    max_tokens: 1500,
    temperature: 0.5,
    return_citations: true,
    include_domains: ['compound.finance', 'defipulse.com', 'tokenterminal.com']
  },

  /**
   * Invalid request examples
   */
  invalidRequests: {
    emptyMessages: {
      model: 'llama-3.1-sonar-small-128k-online',
      messages: [],
      max_tokens: 100
    },
    invalidModel: {
      model: 'invalid-model-name',
      messages: [{ role: 'user', content: 'Test' }],
      max_tokens: 100
    },
    negativeTokens: {
      model: 'llama-3.1-sonar-small-128k-online',
      messages: [{ role: 'user', content: 'Test' }],
      max_tokens: -100
    },
    invalidTemperature: {
      model: 'llama-3.1-sonar-small-128k-online',
      messages: [{ role: 'user', content: 'Test' }],
      temperature: 2.5,
      max_tokens: 100
    }
  }
};

/**
 * Mock Cache Data for Testing
 */
export const MockCacheData = {
  /**
   * Cache entries for different strategies
   */
  lruCacheEntries: [
    { key: 'query-1', data: { result: 'cached result 1' }, timestamp: Date.now() - 30000 },
    { key: 'query-2', data: { result: 'cached result 2' }, timestamp: Date.now() - 60000 },
    { key: 'query-3', data: { result: 'cached result 3' }, timestamp: Date.now() - 90000 }
  ],

  /**
   * Expired cache entries
   */
  expiredCacheEntries: [
    { key: 'old-query-1', data: { result: 'expired result 1' }, timestamp: Date.now() - 3700000 }, // 1 hour+ old
    { key: 'old-query-2', data: { result: 'expired result 2' }, timestamp: Date.now() - 7200000 }  // 2 hours old
  ]
};

/**
 * Mock Metrics Data for Testing
 */
export const MockMetricsData = {
  /**
   * Request metrics
   */
  requestMetrics: {
    totalRequests: 150,
    successfulRequests: 142,
    failedRequests: 8,
    averageLatency: 1250, // ms
    tokensUsed: 125000,
    costEstimate: 15.75, // USD
    cacheHits: 45,
    cacheMisses: 105,
    rateLimitHits: 3
  },

  /**
   * Performance metrics
   */
  performanceMetrics: {
    p50ResponseTime: 800,  // ms
    p90ResponseTime: 1800, // ms
    p95ResponseTime: 2500, // ms
    p99ResponseTime: 4200, // ms
    throughputRps: 12.5,   // requests per second
    errorRate: 0.053       // 5.3%
  }
};

/**
 * Utility functions for generating test data
 */
export const TestDataUtils = {
  /**
   * Generate mock response with custom content
   */
  createMockResponse: (content: string, tokenCount: number = 100) => ({
    id: `mock-${Date.now()}`,
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model: 'llama-3.1-sonar-small-128k-online',
    choices: [{
      index: 0,
      finish_reason: 'stop',
      message: {
        role: 'assistant',
        content
      }
    }],
    usage: {
      prompt_tokens: Math.floor(tokenCount * 0.3),
      completion_tokens: Math.floor(tokenCount * 0.7),
      total_tokens: tokenCount
    }
  }),

  /**
   * Generate mock error response
   */
  createMockError: (statusCode: number, message: string) => ({
    response: {
      status: statusCode,
      data: {
        error: {
          type: 'test_error',
          message,
          code: `error_${statusCode}`
        }
      }
    }
  }),

  /**
   * Generate rate limit headers
   */
  createRateLimitHeaders: (remaining: number, reset: Date) => ({
    'x-ratelimit-limit-requests': '60',
    'x-ratelimit-remaining-requests': remaining.toString(),
    'x-ratelimit-reset-requests': reset.toISOString()
  }),

  /**
   * Generate large content for performance testing
   */
  generateLargeContent: (sizeKB: number) => {
    const targetSize = sizeKB * 1024;
    const baseText = 'This is test content for performance analysis. ';
    const repetitions = Math.ceil(targetSize / baseText.length);
    return baseText.repeat(repetitions).substring(0, targetSize);
  }
};