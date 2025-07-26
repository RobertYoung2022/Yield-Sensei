/**
 * Test setup for execution path optimization tests
 */

import { jest } from '@jest/globals';

// Mock external dependencies
jest.mock('../../../shared/logging/logger', () => ({
  getLogger: jest.fn(() => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  })),
}));

jest.mock('../../../shared/database/redis-manager', () => ({
  RedisManager: jest.fn().mockImplementation(() => ({
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined),
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  })),
}));

// Mock price feed manager
jest.mock('../../arbitrage/price-feed-manager', () => ({
  PriceFeedManager: jest.fn().mockImplementation(() => ({
    initialize: jest.fn().mockResolvedValue(undefined),
    start: jest.fn().mockResolvedValue(undefined),
    stop: jest.fn().mockResolvedValue(undefined),
    on: jest.fn(),
    once: jest.fn(),
    emit: jest.fn(),
    getPrices: jest.fn().mockResolvedValue([]),
    getMultiChainPrices: jest.fn().mockResolvedValue([]),
  })),
}));

// Mock chain connector
jest.mock('../../arbitrage/chain-connector', () => ({
  ChainConnectorService: jest.fn().mockImplementation(() => ({
    initialize: jest.fn().mockResolvedValue(undefined),
    start: jest.fn().mockResolvedValue(undefined),
    stop: jest.fn().mockResolvedValue(undefined),
    getSupportedDEXs: jest.fn().mockReturnValue([
      {
        name: 'uniswap-v3',
        routerAddress: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
      },
    ]),
    getGasEstimate: jest.fn().mockResolvedValue({
      estimatedCost: '50000000000000000', // 0.05 ETH
      gasLimit: '200000',
      gasPrice: '50000000000', // 50 gwei
    }),
  })),
}));

// Global test configuration
beforeAll(() => {
  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.REDIS_HOST = 'localhost';
  process.env.REDIS_PORT = '6379';
});

beforeEach(() => {
  // Clear all mocks before each test
  jest.clearAllMocks();
});

afterAll(() => {
  // Cleanup after all tests
  jest.restoreAllMocks();
});

// Global test utilities
global.createMockExecutionStep = (overrides = {}) => ({
  type: 'swap',
  chainId: 'ethereum',
  protocol: 'uniswap-v3',
  contractAddress: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
  estimatedGas: BigInt(150000),
  estimatedTime: 15,
  dependencies: [],
  ...overrides,
});

global.createMockExecutionPath = (overrides = {}) => ({
  id: 'test-path',
  steps: [
    global.createMockExecutionStep(),
    global.createMockExecutionStep({
      type: 'bridge',
      protocol: 'hop-protocol',
      contractAddress: '0x3666f603Cc164936C1b87e207F36BEBa4AC5f18a',
      estimatedGas: BigInt(300000),
      estimatedTime: 180,
      dependencies: ['step-0'],
    }),
    global.createMockExecutionStep({
      chainId: 'arbitrum',
      estimatedGas: BigInt(120000),
      estimatedTime: 10,
      dependencies: ['step-1'],
    }),
  ],
  totalGasCost: 570000,
  totalFees: 684000,
  estimatedTime: 205,
  successProbability: 0.9,
  riskLevel: 'medium',
  ...overrides,
});

global.createMockArbitrageOpportunity = (overrides = {}) => ({
  id: 'test-opportunity',
  assetId: 'USDC',
  sourceChain: 'ethereum',
  targetChain: 'arbitrum',
  sourcePrice: 1.0,
  targetPrice: 1.002,
  priceDifference: 0.002,
  percentageDifference: 0.2,
  expectedProfit: 200,
  estimatedGasCost: 50,
  bridgeFee: 10,
  netProfit: 140,
  profitMargin: 0.002,
  executionTime: 205,
  riskScore: 25,
  confidence: 0.9,
  timestamp: Date.now(),
  executionPaths: [global.createMockExecutionPath()],
  ...overrides,
});

// Add custom matchers for better test assertions
expect.extend({
  toBeWithinRange(received, floor, ceiling) {
    const pass = received >= floor && received <= ceiling;
    if (pass) {
      return {
        message: () =>
          `expected ${received} not to be within range ${floor} - ${ceiling}`,
        pass: true,
      };
    } else {
      return {
        message: () =>
          `expected ${received} to be within range ${floor} - ${ceiling}`,
        pass: false,
      };
    }
  },

  toHaveValidOptimizationStructure(received) {
    const pass = 
      received &&
      typeof received.optimizationScore === 'number' &&
      received.optimizationScore >= 0 &&
      received.costBreakdown &&
      received.performanceMetrics &&
      received.alternativeRoutes &&
      received.optimizationStrategy;

    if (pass) {
      return {
        message: () =>
          `expected ${received} not to have valid optimization structure`,
        pass: true,
      };
    } else {
      return {
        message: () =>
          `expected ${received} to have valid optimization structure`,
        pass: false,
      };
    }
  },

  toBeOptimizationStrategy(received) {
    const validTypes = [
      'order_splitting',
      'route_optimization', 
      'timing_optimization',
      'liquidity_sourcing',
      'mev_protection',
      'batching',
      'routing',
      'timing',
      'layer2',
      'contract_optimization',
      'parallel_execution',
      'preemptive_bridging',
      'gas_acceleration',
      'route_shortening',
      'batch_processing'
    ];

    const pass = 
      received &&
      typeof received.type === 'string' &&
      validTypes.includes(received.type) &&
      typeof received.description === 'string' &&
      typeof received.slippageReduction === 'number' &&
      received.slippageReduction >= 0;

    if (pass) {
      return {
        message: () =>
          `expected ${received} not to be a valid optimization strategy`,
        pass: true,
      };
    } else {
      return {
        message: () =>
          `expected ${received} to be a valid optimization strategy`,
        pass: false,
      };
    }
  },
});

// Type declarations for global utilities
declare global {
  function createMockExecutionStep(overrides?: any): any;
  function createMockExecutionPath(overrides?: any): any;
  function createMockArbitrageOpportunity(overrides?: any): any;

  namespace jest {
    interface Matchers<R> {
      toBeWithinRange(floor: number, ceiling: number): R;
      toHaveValidOptimizationStructure(): R;
      toBeOptimizationStrategy(): R;
    }
  }
}