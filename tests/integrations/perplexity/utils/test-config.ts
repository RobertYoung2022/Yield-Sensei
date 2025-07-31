/**
 * Test Configuration Utilities for Perplexity Integration Tests
 * Provides standardized test configurations for different scenarios
 */

export interface PerplexityTestConfig {
  coreClient: {
    apiKey: string;
    baseUrl: string;
    timeout: number;
    maxRetries: number;
    rateLimit: {
      maxRequestsPerMinute: number;
      maxRequestsPerHour: number;
      maxRequestsPerDay: number;
      queueSize: number;
      enableBurstMode?: boolean;
      burstLimit?: number;
    };
    cache: {
      enabled: boolean;
      ttl: number;
      maxSize: number;
      strategy: 'lru' | 'lfu' | 'fifo';
      persistToDisk?: boolean;
    };
    circuitBreaker: {
      failureThreshold: number;
      successThreshold: number;
      timeout: number;
      resetTimeout: number;
    };
    retry: {
      maxRetries: number;
      initialDelay: number;
      maxDelay: number;
      backoffFactor: number;
      jitter: boolean;
    };
  };
  sageIntegration: {
    apiKey: string;
    baseUrl: string;
    timeout: number;
    maxRetries: number;
    rateLimit: {
      requestsPerMinute: number;
      requestsPerHour: number;
    };
    enableCaching: boolean;
    cacheTTL: number;
    enableRateLimiting: boolean;
    enableLogging: boolean;
  };
  oracleClient: {
    apiKey: string;
    baseUrl: string;
    model: string;
    timeout: number;
    maxRetries: number;
    enableCaching: boolean;
    cacheTtl: number;
    dailyQuotaLimit: number;
    enableRateLimiting: boolean;
    requestsPerMinute: number;
    enableUsageTracking: boolean;
  };
}

/**
 * Default test configuration with mock values
 */
export const DEFAULT_TEST_CONFIG: PerplexityTestConfig = {
  coreClient: {
    apiKey: 'test-api-key-12345',
    baseUrl: 'http://localhost:3001',
    timeout: 30000,
    maxRetries: 3,
    rateLimit: {
      maxRequestsPerMinute: 60,
      maxRequestsPerHour: 1000,
      maxRequestsPerDay: 10000,
      queueSize: 100,
      enableBurstMode: false,
      burstLimit: 5
    },
    cache: {
      enabled: true,
      ttl: 300000, // 5 minutes for testing
      maxSize: 50,
      strategy: 'lru',
      persistToDisk: false
    },
    circuitBreaker: {
      failureThreshold: 5,
      successThreshold: 3,
      timeout: 10000,
      resetTimeout: 30000
    },
    retry: {
      maxRetries: 3,
      initialDelay: 1000,
      maxDelay: 10000,
      backoffFactor: 2,
      jitter: true
    }
  },
  sageIntegration: {
    apiKey: 'test-sage-api-key',
    baseUrl: 'http://localhost:3001',
    timeout: 30000,
    maxRetries: 3,
    rateLimit: {
      requestsPerMinute: 60,
      requestsPerHour: 1000
    },
    enableCaching: true,
    cacheTTL: 300000, // 5 minutes for testing
    enableRateLimiting: true,
    enableLogging: false // Reduce noise in tests
  },
  oracleClient: {
    apiKey: 'test-oracle-api-key',
    baseUrl: 'http://localhost:3001',
    model: 'llama-3.1-sonar-small-128k-online',
    timeout: 30000,
    maxRetries: 3,
    enableCaching: true,
    cacheTtl: 300000, // 5 minutes for testing
    dailyQuotaLimit: 1000,
    enableRateLimiting: true,
    requestsPerMinute: 60,
    enableUsageTracking: true
  }
};

/**
 * Create test configuration with overrides
 */
export function createTestConfig(overrides: Partial<PerplexityTestConfig> = {}): PerplexityTestConfig {
  return {
    coreClient: {
      ...DEFAULT_TEST_CONFIG.coreClient,
      ...overrides.coreClient
    },
    sageIntegration: {
      ...DEFAULT_TEST_CONFIG.sageIntegration,
      ...overrides.sageIntegration
    },
    oracleClient: {
      ...DEFAULT_TEST_CONFIG.oracleClient,
      ...overrides.oracleClient
    }
  };
}

/**
 * Performance test configuration with higher limits
 */
export function createPerformanceTestConfig(): PerplexityTestConfig {
  return createTestConfig({
    coreClient: {
      rateLimit: {
        maxRequestsPerMinute: 1000,
        maxRequestsPerHour: 10000,
        maxRequestsPerDay: 100000,
        queueSize: 1000,
        enableBurstMode: true,
        burstLimit: 50
      },
      cache: {
        enabled: true,
        ttl: 3600000, // 1 hour
        maxSize: 1000,
        strategy: 'lru',
        persistToDisk: false
      },
      timeout: 60000 // 1 minute for performance tests
    }
  });
}

/**
 * Rate limiting test configuration with low limits
 */
export function createRateLimitTestConfig(): PerplexityTestConfig {
  return createTestConfig({
    coreClient: {
      rateLimit: {
        maxRequestsPerMinute: 5,
        maxRequestsPerHour: 50,
        maxRequestsPerDay: 500,
        queueSize: 10,
        enableBurstMode: false
      }
    },
    sageIntegration: {
      rateLimit: {
        requestsPerMinute: 3,
        requestsPerHour: 30
      }
    },
    oracleClient: {
      requestsPerMinute: 2
    }
  });
}

/**
 * Error handling test configuration with circuit breaker tuned for failures
 */
export function createErrorHandlingTestConfig(): PerplexityTestConfig {
  return createTestConfig({
    coreClient: {
      circuitBreaker: {
        failureThreshold: 2, // Fail fast for testing
        successThreshold: 1,
        timeout: 5000,
        resetTimeout: 10000
      },
      retry: {
        maxRetries: 2,
        initialDelay: 100,
        maxDelay: 1000,
        backoffFactor: 2,
        jitter: false // Predictable timing for tests
      }
    }
  });
}

/**
 * Caching test configuration with different strategies
 */
export function createCachingTestConfig(strategy: 'lru' | 'lfu' | 'fifo' = 'lru'): PerplexityTestConfig {
  return createTestConfig({
    coreClient: {
      cache: {
        enabled: true,
        ttl: 60000, // 1 minute for cache tests
        maxSize: 10, // Small size to test eviction
        strategy,
        persistToDisk: false
      }
    }
  });
}

/**
 * Minimal configuration for basic functionality tests
 */
export function createMinimalTestConfig(): PerplexityTestConfig {
  return createTestConfig({
    coreClient: {
      rateLimit: {
        maxRequestsPerMinute: 1000,
        maxRequestsPerHour: 10000,
        maxRequestsPerDay: 100000,
        queueSize: 1000
      },
      cache: {
        enabled: false,
        ttl: 0,
        maxSize: 0,
        strategy: 'lru'
      },
      circuitBreaker: {
        failureThreshold: 100, // Effectively disabled
        successThreshold: 1,
        timeout: 60000,
        resetTimeout: 300000
      }
    },
    sageIntegration: {
      enableCaching: false,
      enableRateLimiting: false
    },
    oracleClient: {
      enableCaching: false,
      enableRateLimiting: false,
      enableUsageTracking: false
    }
  });
}

/**
 * Stress test configuration for load testing
 */
export function createStressTestConfig(): PerplexityTestConfig {
  return createTestConfig({
    coreClient: {
      timeout: 120000, // 2 minutes
      maxRetries: 5,
      rateLimit: {
        maxRequestsPerMinute: 5000,
        maxRequestsPerHour: 50000,
        maxRequestsPerDay: 500000,
        queueSize: 10000,
        enableBurstMode: true,
        burstLimit: 100
      },
      cache: {
        enabled: true,
        ttl: 7200000, // 2 hours
        maxSize: 5000,
        strategy: 'lru',
        persistToDisk: false
      }
    }
  });
}

/**
 * Development configuration that matches production settings
 */
export function createProductionLikeTestConfig(): PerplexityTestConfig {
  return createTestConfig({
    coreClient: {
      timeout: 45000,
      maxRetries: 3,
      rateLimit: {
        maxRequestsPerMinute: 100,
        maxRequestsPerHour: 2000,
        maxRequestsPerDay: 25000,
        queueSize: 200,
        enableBurstMode: true,
        burstLimit: 10
      },
      cache: {
        enabled: true,
        ttl: 1800000, // 30 minutes
        maxSize: 500,
        strategy: 'lru',
        persistToDisk: true
      },
      circuitBreaker: {
        failureThreshold: 10,
        successThreshold: 5,
        timeout: 30000,
        resetTimeout: 120000
      }
    },
    sageIntegration: {
      enableLogging: true,
      cacheTTL: 1800000 // 30 minutes
    }
  });
}

/**
 * Get environment-specific configuration
 */
export function getEnvironmentConfig(): PerplexityTestConfig {
  const env = process.env.NODE_ENV || 'test';
  
  switch (env) {
    case 'production':
      return createProductionLikeTestConfig();
    case 'development':
      return createPerformanceTestConfig();
    case 'test':
    default:
      return DEFAULT_TEST_CONFIG;
  }
}

/**
 * Validate test configuration
 */
export function validateTestConfig(config: PerplexityTestConfig): boolean {
  try {
    // Basic validation checks
    if (!config.coreClient.apiKey) return false;
    if (!config.coreClient.baseUrl) return false;
    if (config.coreClient.timeout <= 0) return false;
    if (config.coreClient.maxRetries < 0) return false;
    
    // Rate limit validation
    const rateLimit = config.coreClient.rateLimit;
    if (rateLimit.maxRequestsPerMinute <= 0) return false;
    if (rateLimit.maxRequestsPerHour < rateLimit.maxRequestsPerMinute) return false;
    if (rateLimit.maxRequestsPerDay < rateLimit.maxRequestsPerHour) return false;
    
    // Cache validation
    const cache = config.coreClient.cache;
    if (cache.enabled && cache.maxSize <= 0) return false;
    if (cache.enabled && cache.ttl <= 0) return false;
    
    // Circuit breaker validation
    const cb = config.coreClient.circuitBreaker;
    if (cb.failureThreshold <= 0) return false;
    if (cb.successThreshold <= 0) return false;
    if (cb.timeout <= 0) return false;
    if (cb.resetTimeout <= 0) return false;
    
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Configuration utilities for specific test scenarios
 */
export const TestConfigUtils = {
  createTestConfig,
  createPerformanceTestConfig,
  createRateLimitTestConfig,
  createErrorHandlingTestConfig,
  createCachingTestConfig,
  createMinimalTestConfig,
  createStressTestConfig,
  createProductionLikeTestConfig,
  getEnvironmentConfig,
  validateTestConfig
};