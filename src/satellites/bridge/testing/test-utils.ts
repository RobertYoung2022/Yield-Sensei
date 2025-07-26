/**
 * Test Utilities
 * Helper functions and factory methods for testing framework
 */

import { 
  TestEnvironment, 
  IntegrationTestConfig,
  NetworkEnvironment,
  ServiceEnvironment,
  MonitoringConfig,
  TestScenario 
} from './types';

/**
 * Creates a default test environment for development and testing
 */
export function createTestEnvironment(overrides?: Partial<TestEnvironment>): TestEnvironment {
  const defaultEnvironment: TestEnvironment = {
    name: 'Test Environment',
    description: 'Default testing environment for Bridge Satellite',
    networks: [
      {
        chainId: 'ethereum',
        rpcUrl: 'http://localhost:8545',
        wsUrl: 'ws://localhost:8546',
        blockTime: 12000,
        gasPrice: 20,
        liquidityPools: [
          {
            dexName: 'uniswap_v3',
            pairAddress: '0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640',
            token0: 'USDC',
            token1: 'WETH',
            reserve0: '50000000',
            reserve1: '25000',
            fee: 0.3,
          },
        ],
      },
      {
        chainId: 'polygon',
        rpcUrl: 'http://localhost:8547',
        blockTime: 2000,
        gasPrice: 30,
        liquidityPools: [
          {
            dexName: 'quickswap',
            pairAddress: '0x853Ee4b2A13f8a742d64C8F088bE7bA2131f670d',
            token0: 'USDC',
            token1: 'WMATIC',
            reserve0: '25000000',
            reserve1: '30000000',
            fee: 0.3,
          },
        ],
      },
    ],
    services: [
      {
        name: 'arbitrage-engine',
        type: 'arbitrage_engine',
        config: {
          maxSlippage: 0.01,
          minProfitThreshold: 50,
        },
        healthEndpoint: '/health',
      },
      {
        name: 'price-feed-manager',
        type: 'price_feed',
        config: {
          updateInterval: 1000,
          priceSources: ['chainlink', 'uniswap'],
        },
        healthEndpoint: '/health',
      },
    ],
    monitoring: {
      enabled: true,
      interval: 5000,
      metrics: ['cpu_usage', 'memory_usage', 'network_latency'],
      alertThresholds: [
        {
          metric: 'cpu_usage',
          condition: '>',
          value: 80,
          action: 'alert',
        },
      ],
    },
  };

  return { ...defaultEnvironment, ...overrides };
}

/**
 * Creates a default integration test configuration
 */
export function createDefaultTestConfig(overrides?: Partial<IntegrationTestConfig>): IntegrationTestConfig {
  const defaultConfig: IntegrationTestConfig = {
    name: 'Default Integration Test',
    description: 'Standard integration test configuration',
    includePerformance: true,
    includeSecurity: true,
    includeReliability: false,
    parallelExecution: true,
    timeoutMinutes: 30,
  };

  return { ...defaultConfig, ...overrides };
}

/**
 * Creates a minimal test environment for unit testing
 */
export function createMinimalTestEnvironment(): TestEnvironment {
  return {
    name: 'Minimal Test Environment',
    description: 'Minimal environment for unit testing',
    networks: [
      {
        chainId: 'localhost',
        rpcUrl: 'http://localhost:8545',
        blockTime: 1000,
        gasPrice: 1,
        liquidityPools: [],
      },
    ],
    services: [
      {
        name: 'mock-service',
        type: 'arbitrage_engine',
        config: {},
      },
    ],
    monitoring: {
      enabled: false,
      interval: 10000,
      metrics: [],
      alertThresholds: [],
    },
  };
}

/**
 * Creates a production-like test environment
 */
export function createProductionLikeEnvironment(): TestEnvironment {
  return createTestEnvironment({
    name: 'Production-like Environment',
    description: 'Production-like environment for comprehensive testing',
    networks: [
      {
        chainId: 'ethereum',
        rpcUrl: 'https://eth-mainnet.alchemyapi.io/v2/demo',
        wsUrl: 'wss://eth-mainnet.alchemyapi.io/v2/demo',
        blockTime: 12000,
        gasPrice: 20,
        liquidityPools: [
          {
            dexName: 'uniswap_v3',
            pairAddress: '0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640',
            token0: 'USDC',
            token1: 'WETH',
            reserve0: '100000000',
            reserve1: '50000',
            fee: 0.3,
          },
          {
            dexName: 'sushiswap',
            pairAddress: '0x397FF1542f962076d0BFE58eA045FfA2d347ACa0',
            token0: 'USDC',
            token1: 'WETH',
            reserve0: '80000000',
            reserve1: '40000',
            fee: 0.3,
          },
        ],
      },
      {
        chainId: 'polygon',
        rpcUrl: 'https://polygon-rpc.com',
        blockTime: 2000,
        gasPrice: 30,
        liquidityPools: [
          {
            dexName: 'quickswap',
            pairAddress: '0x853Ee4b2A13f8a742d64C8F088bE7bA2131f670d',
            token0: 'USDC',
            token1: 'WMATIC',
            reserve0: '50000000',
            reserve1: '60000000',
            fee: 0.3,
          },
        ],
      },
      {
        chainId: 'arbitrum',
        rpcUrl: 'https://arb1.arbitrum.io/rpc',
        blockTime: 1000,
        gasPrice: 1,
        liquidityPools: [
          {
            dexName: 'uniswap_v3',
            pairAddress: '0xC31E54c7a869B9FcBEcc14363CF510d1c41fa443',
            token0: 'USDC',
            token1: 'WETH',
            reserve0: '40000000',
            reserve1: '20000',
            fee: 0.05,
          },
        ],
      },
    ],
    monitoring: {
      enabled: true,
      interval: 1000,
      metrics: [
        'cpu_usage',
        'memory_usage',
        'network_latency',
        'transaction_throughput',
        'error_rate',
        'arbitrage_opportunities',
        'profit_margins',
        'gas_costs',
        'bridge_confirmations',
      ],
      alertThresholds: [
        {
          metric: 'cpu_usage',
          condition: '>',
          value: 75,
          action: 'alert',
        },
        {
          metric: 'memory_usage',
          condition: '>',
          value: 80,
          action: 'alert',
        },
        {
          metric: 'error_rate',
          condition: '>',
          value: 3,
          action: 'stop_test',
        },
        {
          metric: 'network_latency',
          condition: '>',
          value: 2000,
          action: 'log',
        },
      ],
    },
  });
}

/**
 * Factory methods for common test configurations
 */
export const TestConfigs = {
  // Quick development tests
  development: (): IntegrationTestConfig => ({
    name: 'Development Tests',
    description: 'Quick tests for development workflow',
    includePerformance: true,
    includeSecurity: false,
    includeReliability: false,
    performanceTests: ['opportunity_capture'],
    parallelExecution: true,
    timeoutMinutes: 5,
  }),

  // Continuous integration tests
  ci: (): IntegrationTestConfig => ({
    name: 'CI Pipeline Tests',
    description: 'Tests for continuous integration pipeline',
    includePerformance: true,
    includeSecurity: true,
    includeReliability: false,
    performanceTests: ['opportunity_capture', 'throughput'],
    securityTests: ['front_running', 'access_control'],
    parallelExecution: true,
    timeoutMinutes: 10,
  }),

  // Nightly comprehensive tests
  nightly: (): IntegrationTestConfig => ({
    name: 'Nightly Test Suite',
    description: 'Comprehensive nightly testing',
    includePerformance: true,
    includeSecurity: true,
    includeReliability: true,
    parallelExecution: true,
    timeoutMinutes: 120,
  }),

  // Pre-deployment validation
  preDeployment: (): IntegrationTestConfig => ({
    name: 'Pre-Deployment Validation',
    description: 'Full validation before production deployment',
    includePerformance: true,
    includeSecurity: true,
    includeReliability: true,
    parallelExecution: false,
    timeoutMinutes: 180,
  }),

  // Security-focused testing
  security: (): IntegrationTestConfig => ({
    name: 'Security Test Suite',
    description: 'Comprehensive security testing',
    includePerformance: false,
    includeSecurity: true,
    includeReliability: false,
    securityTests: [
      'front_running',
      'mev_attack',
      'flash_loan',
      'bridge_exploit',
      'oracle_manipulation',
      'slippage_attack',
      'reentrancy',
      'access_control',
      'denial_of_service',
      'data_exposure',
    ],
    parallelExecution: true,
    timeoutMinutes: 60,
  }),

  // Performance-focused testing
  performance: (): IntegrationTestConfig => ({
    name: 'Performance Test Suite',
    description: 'Comprehensive performance testing',
    includePerformance: true,
    includeSecurity: false,
    includeReliability: false,
    performanceTests: [
      'opportunity_capture',
      'throughput',
      'stress',
    ],
    parallelExecution: true,
    timeoutMinutes: 45,
  }),
};

/**
 * Utility function to create a custom test scenario
 */
export function createTestScenario(
  id: string,
  name: string,
  description: string,
  type: 'performance' | 'security' | 'reliability' | 'integration',
  priority: 'low' | 'medium' | 'high' | 'critical',
  estimatedDuration: number,
  overrides?: Partial<TestScenario>
): TestScenario {
  const baseScenario: TestScenario = {
    id,
    name,
    description,
    type,
    priority,
    estimatedDuration,
    requirements: [],
    parameters: {
      duration: estimatedDuration,
    },
  };

  return { ...baseScenario, ...overrides };
}

/**
 * Utility function to validate test environment configuration
 */
export function validateTestEnvironment(environment: TestEnvironment): string[] {
  const errors: string[] = [];

  if (!environment.name) {
    errors.push('Environment name is required');
  }

  if (!environment.networks || environment.networks.length === 0) {
    errors.push('At least one network is required');
  }

  for (const network of environment.networks || []) {
    if (!network.chainId) {
      errors.push(`Network missing chainId`);
    }
    if (!network.rpcUrl) {
      errors.push(`Network ${network.chainId} missing rpcUrl`);
    }
    if (network.blockTime <= 0) {
      errors.push(`Network ${network.chainId} has invalid blockTime`);
    }
  }

  if (!environment.services || environment.services.length === 0) {
    errors.push('At least one service is required');
  }

  for (const service of environment.services || []) {
    if (!service.name) {
      errors.push('Service missing name');
    }
    if (!service.type) {
      errors.push(`Service ${service.name} missing type`);
    }
  }

  return errors;
}

/**
 * Utility function to validate integration test configuration
 */
export function validateTestConfig(config: IntegrationTestConfig): string[] {
  const errors: string[] = [];

  if (!config.name) {
    errors.push('Test configuration name is required');
  }

  if (!config.includePerformance && !config.includeSecurity && !config.includeReliability) {
    errors.push('At least one test category must be included');
  }

  if (config.timeoutMinutes && config.timeoutMinutes <= 0) {
    errors.push('Timeout must be positive');
  }

  if (config.performanceTests && config.performanceTests.length > 0 && !config.includePerformance) {
    errors.push('Performance tests specified but performance testing not included');
  }

  if (config.securityTests && config.securityTests.length > 0 && !config.includeSecurity) {
    errors.push('Security tests specified but security testing not included');
  }

  return errors;
}