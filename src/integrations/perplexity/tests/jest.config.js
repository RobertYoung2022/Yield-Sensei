/**
 * Jest configuration for Perplexity integration tests
 */

module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  displayName: 'Perplexity Integration',
  testMatch: [
    '<rootDir>/src/integrations/perplexity/tests/**/*.test.ts'
  ],
  collectCoverageFrom: [
    '<rootDir>/src/integrations/perplexity/**/*.ts',
    '!<rootDir>/src/integrations/perplexity/tests/**',
    '!<rootDir>/src/integrations/perplexity/**/*.d.ts',
    '!<rootDir>/src/integrations/perplexity/**/index.ts'
  ],
  coverageDirectory: '<rootDir>/coverage/perplexity',
  coverageReporters: ['text', 'lcov', 'html'],
  setupFilesAfterEnv: ['<rootDir>/src/integrations/perplexity/tests/setup.ts'],
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/src/$1'
  },
  transform: {
    '^.+\\.ts$': 'ts-jest'
  },
  testTimeout: 30000,
  verbose: true,
  collectCoverage: true,
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  }
};