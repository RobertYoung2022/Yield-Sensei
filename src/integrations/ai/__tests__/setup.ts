/**
 * Jest Test Setup
 * Global test configuration and utilities
 */

import { jest } from '@jest/globals';

// Extend Jest matchers
expect.extend({
  toBeWithinRange(received: number, floor: number, ceiling: number) {
    const pass = received >= floor && received <= ceiling;
    if (pass) {
      return {
        message: () => `expected ${received} not to be within range ${floor} - ${ceiling}`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be within range ${floor} - ${ceiling}`,
        pass: false,
      };
    }
  },

  toHaveValidAIResponse(received: any) {
    const hasRequiredFields = received &&
      typeof received.success === 'boolean' &&
      received.metadata &&
      typeof received.metadata === 'object';

    if (received.success) {
      const hasData = received.data && typeof received.data === 'object';
      const hasUsage = received.usage && typeof received.usage === 'object';
      
      if (hasRequiredFields && hasData && hasUsage) {
        return {
          message: () => `expected response not to be a valid AI response`,
          pass: true,
        };
      }
    } else {
      const hasError = received.error && typeof received.error === 'string';
      
      if (hasRequiredFields && hasError) {
        return {
          message: () => `expected response not to be a valid AI error response`,
          pass: true,
        };
      }
    }

    return {
      message: () => `expected response to be a valid AI response with required fields`,
      pass: false,
    };
  },

  toHaveReasonableLatency(received: number, maxLatency: number = 5000) {
    const pass = received > 0 && received <= maxLatency;
    if (pass) {
      return {
        message: () => `expected ${received}ms not to be reasonable latency (≤${maxLatency}ms)`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received}ms to be reasonable latency (≤${maxLatency}ms)`,
        pass: false,
      };
    }
  },
});

// Global test configuration
global.testConfig = {
  defaultTimeout: 30000,
  performanceThresholds: {
    maxResponseTime: 5000,
    maxConcurrentRequests: 100,
    minSuccessRate: 0.95,
  },
  security: {
    sensitiveDataPatterns: [
      /sk-[a-zA-Z0-9]{32,}/g, // OpenAI API keys
      /claude-[a-zA-Z0-9-]{32,}/g, // Anthropic API keys
      /pplx-[a-zA-Z0-9]{32,}/g, // Perplexity API keys
      /Bearer\s+[a-zA-Z0-9-._~+/]+=*/g, // JWT tokens
      /password\s*[:=]\s*[^\s]+/gi, // Passwords
      /secret\s*[:=]\s*[^\s]+/gi, // Secrets
    ],
  },
};

// Mock console methods to reduce noise in tests
const originalConsole = { ...console };

beforeAll(() => {
  // Reduce console output during tests
  global.console = {
    ...console,
    log: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
});

afterAll(() => {
  // Restore original console
  global.console = originalConsole;
});

// Global test utilities
global.testUtils = {
  /**
   * Check if string contains sensitive data
   */
  containsSensitiveData(text: string): boolean {
    return global.testConfig.security.sensitiveDataPatterns.some(pattern =>
      pattern.test(text)
    );
  },

  /**
   * Sanitize object for safe logging
   */
  sanitizeForLogging(obj: any): any {
    const sanitized = JSON.parse(JSON.stringify(obj));
    
    const sanitizeValue = (value: any): any => {
      if (typeof value === 'string') {
        // Replace potential API keys with redacted versions
        return value
          .replace(/sk-[a-zA-Z0-9]{32,}/g, 'sk-***REDACTED***')
          .replace(/claude-[a-zA-Z0-9-]{32,}/g, 'claude-***REDACTED***')
          .replace(/pplx-[a-zA-Z0-9]{32,}/g, 'pplx-***REDACTED***');
      }
      return value;
    };

    const sanitizeObject = (obj: any): any => {
      if (Array.isArray(obj)) {
        return obj.map(sanitizeObject);
      }
      
      if (obj && typeof obj === 'object') {
        const result: any = {};
        for (const [key, value] of Object.entries(obj)) {
          if (key.toLowerCase().includes('key') || 
              key.toLowerCase().includes('secret') || 
              key.toLowerCase().includes('token')) {
            result[key] = '***REDACTED***';
          } else {
            result[key] = sanitizeObject(value);
          }
        }
        return result;
      }
      
      return sanitizeValue(obj);
    };

    return sanitizeObject(sanitized);
  },

  /**
   * Generate test performance report
   */
  generatePerformanceReport(metrics: Record<string, any>): string {
    const report = ['=== Performance Test Report ==='];
    
    Object.entries(metrics).forEach(([name, stats]) => {
      if (stats && typeof stats === 'object') {
        report.push(`\n${name}:`);
        report.push(`  Count: ${stats.count || 0}`);
        report.push(`  Mean: ${(stats.mean || 0).toFixed(2)}ms`);
        report.push(`  Median: ${(stats.median || 0).toFixed(2)}ms`);
        report.push(`  P95: ${(stats.p95 || 0).toFixed(2)}ms`);
        report.push(`  Min: ${(stats.min || 0).toFixed(2)}ms`);
        report.push(`  Max: ${(stats.max || 0).toFixed(2)}ms`);
      }
    });
    
    return report.join('\n');
  },
};

// Environment setup
process.env.NODE_ENV = 'test';
process.env.TZ = 'UTC';

// Prevent unhandled promise rejections from failing tests
process.on('unhandledRejection', (reason, promise) => {
  console.warn('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Set up global error handling
global.addEventListener?.('error', (event) => {
  console.error('Global error:', event.error);
});

global.addEventListener?.('unhandledrejection', (event) => {
  console.warn('Unhandled promise rejection:', event.reason);
});

// Increase timeout for CI environments
if (process.env.CI) {
  jest.setTimeout(60000); // 60 seconds in CI
} else {
  jest.setTimeout(30000); // 30 seconds locally
}

// Mock external services by default
jest.mock('https', () => ({
  request: jest.fn(),
  get: jest.fn(),
}));

jest.mock('http', () => ({
  request: jest.fn(),
  get: jest.fn(),
}));

// Set up fake timers for deterministic testing
beforeEach(() => {
  jest.clearAllTimers();
});

afterEach(() => {
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
});

// Global type extensions
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeWithinRange(floor: number, ceiling: number): R;
      toHaveValidAIResponse(): R;
      toHaveReasonableLatency(maxLatency?: number): R;
    }
  }

  var testConfig: {
    defaultTimeout: number;
    performanceThresholds: {
      maxResponseTime: number;
      maxConcurrentRequests: number;
      minSuccessRate: number;
    };
    security: {
      sensitiveDataPatterns: RegExp[];
    };
  };

  var testUtils: {
    containsSensitiveData(text: string): boolean;
    sanitizeForLogging(obj: any): any;
    generatePerformanceReport(metrics: Record<string, any>): string;
  };
}

export {};