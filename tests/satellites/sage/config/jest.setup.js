/**
 * Jest Setup Configuration for Sage Satellite Tests
 * Global test environment setup and configuration
 */

const { performance } = require('perf_hooks');

// Global test timeout
jest.setTimeout(30000);

// Mock console methods to reduce noise during tests
const originalConsole = global.console;
global.console = {
  ...originalConsole,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
};

// Restore console for specific test debugging
global.enableConsole = () => {
  global.console = originalConsole;
};

// Global test utilities
global.testUtils = {
  // Performance measurement utility
  measurePerformance: async (fn, name = 'operation') => {
    const start = performance.now();
    const result = await fn();
    const end = performance.now();
    const duration = end - start;
    
    console.log(`${name} took ${duration.toFixed(2)}ms`);
    return { result, duration };
  },
  
  // Memory usage tracking
  getMemoryUsage: () => {
    const usage = process.memoryUsage();
    return {
      heapUsed: Math.round(usage.heapUsed / 1024 / 1024 * 100) / 100, // MB
      heapTotal: Math.round(usage.heapTotal / 1024 / 1024 * 100) / 100, // MB
      external: Math.round(usage.external / 1024 / 1024 * 100) / 100, // MB
      rss: Math.round(usage.rss / 1024 / 1024 * 100) / 100 // MB
    };
  },
  
  // Wait utility
  wait: (ms) => new Promise(resolve => setTimeout(resolve, ms)),
  
  // Random test data generators
  generateId: () => `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  
  generateEmail: () => `test${Date.now()}@example.com`,
  
  generateDateRange: (daysAgo = 30) => ({
    start: new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000),
    end: new Date()
  }),
  
  // Test data validation
  validateSchema: (data, schema) => {
    // Simple schema validation utility
    for (const [key, type] of Object.entries(schema)) {
      if (!(key in data)) {
        throw new Error(`Missing required field: ${key}`);
      }
      
      if (typeof data[key] !== type) {
        throw new Error(`Field ${key} should be of type ${type}, got ${typeof data[key]}`);
      }
    }
    return true;
  },
  
  // Mock data generators for consistent testing
  createMockRWAData: (overrides = {}) => ({
    id: `mock-rwa-${Date.now()}`,
    type: 'real-estate',
    issuer: 'Mock Real Estate Fund',
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
      licenses: ['SEC-Registered'],
      restrictions: [],
      lastReview: new Date()
    },
    complianceScore: 85,
    ...overrides
  }),
  
  createMockProtocolData: (overrides = {}) => ({
    id: `mock-protocol-${Date.now()}`,
    name: 'Mock DeFi Protocol',
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
    codeAudits: [{
      auditor: 'Mock Auditor',
      date: new Date(),
      status: 'passed',
      criticalIssues: 0,
      highIssues: 1,
      mediumIssues: 3,
      lowIssues: 5
    }],
    team: {
      size: 25,
      experience: 4.2,
      credibility: 0.85,
      anonymity: false
    },
    governance: {
      tokenHolders: 8500,
      votingPower: 0.65,
      proposalCount: 45,
      participationRate: 0.35
    },
    riskMetrics: {
      volatility: 0.45,
      correlation: 0.23,
      maxDrawdown: 0.67,
      sharpeRatio: 1.25,
      beta: 1.1
    },
    tokenDistribution: [
      { category: 'Team', percentage: 20, vesting: true },
      { category: 'Public', percentage: 45, vesting: false },
      { category: 'Treasury', percentage: 25, vesting: true },
      { category: 'Advisors', percentage: 10, vesting: true }
    ],
    partnerships: ['Chainlink', 'Compound'],
    ...overrides
  })
};

// Global test configuration
global.testConfig = {
  // Performance thresholds
  performance: {
    rwaScoring: 2000, // 2 seconds
    protocolAnalysis: 3000, // 3 seconds
    complianceAssessment: 1000, // 1 second
    memoryLimit: 100 * 1024 * 1024 // 100MB
  },
  
  // Test data limits
  limits: {
    maxBatchSize: 50,
    maxConcurrent: 10,
    timeout: 30000
  },
  
  // Feature flags for conditional testing
  features: {
    enableMLTests: process.env.ENABLE_ML_TESTS === 'true',
    enablePerformanceTests: process.env.ENABLE_PERFORMANCE_TESTS !== 'false',
    enableIntegrationTests: process.env.ENABLE_INTEGRATION_TESTS !== 'false',
    enableLoadTests: process.env.ENABLE_LOAD_TESTS === 'true'
  }
};

// Setup global error handling
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

// Global beforeEach and afterEach
beforeEach(() => {
  // Clear all mocks before each test
  jest.clearAllMocks();
  
  // Reset any global state
  global.testStartTime = performance.now();
  global.testStartMemory = global.testUtils.getMemoryUsage();
});

afterEach(() => {
  // Log test performance metrics
  const testDuration = performance.now() - global.testStartTime;
  const testEndMemory = global.testUtils.getMemoryUsage();
  const memoryDelta = testEndMemory.heapUsed - global.testStartMemory.heapUsed;
  
  if (process.env.LOG_TEST_METRICS === 'true') {
    console.log(`Test completed in ${testDuration.toFixed(2)}ms, memory delta: ${memoryDelta.toFixed(2)}MB`);
  }
  
  // Check for memory leaks in development
  if (process.env.NODE_ENV === 'development' && memoryDelta > 50) {
    console.warn(`Potential memory leak detected: ${memoryDelta.toFixed(2)}MB increase`);
  }
});

// Global afterAll cleanup
afterAll(async () => {
  // Force garbage collection if available
  if (global.gc) {
    global.gc();
  }
  
  // Wait for any pending operations
  await new Promise(resolve => setTimeout(resolve, 100));
  
  // Restore console
  global.console = originalConsole;
});

// Environment-specific setup
if (process.env.NODE_ENV === 'test') {
  // Silence deprecation warnings in test environment
  process.env.NODE_NO_WARNINGS = '1';
  
  // Increase Node.js memory limit for tests
  if (!process.env.NODE_OPTIONS) {
    process.env.NODE_OPTIONS = '--max-old-space-size=4096';
  }
}

// Mock external dependencies that might not be available in test environment
jest.mock('nock', () => ({
  cleanAll: jest.fn(),
  isDone: jest.fn(() => true),
  default: jest.fn(() => ({
    post: jest.fn().mockReturnThis(),
    reply: jest.fn().mockReturnThis(),
    times: jest.fn().mockReturnThis(),
    once: jest.fn().mockReturnThis(),
    delay: jest.fn().mockReturnThis(),
    replyWithError: jest.fn().mockReturnThis()
  }))
}), { virtual: true });

// Export utilities for use in tests
module.exports = {
  testUtils: global.testUtils,
  testConfig: global.testConfig
};