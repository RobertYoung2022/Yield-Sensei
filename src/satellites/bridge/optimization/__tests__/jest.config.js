/**
 * Jest configuration for execution path optimization tests
 */

module.exports = {
  displayName: 'Bridge Optimization Tests',
  testMatch: [
    '<rootDir>/src/satellites/bridge/optimization/**/*.test.ts'
  ],
  transform: {
    '^.+\\.ts$': 'ts-jest'
  },
  testEnvironment: 'node',
  collectCoverageFrom: [
    'src/satellites/bridge/optimization/**/*.ts',
    '!src/satellites/bridge/optimization/**/*.test.ts',
    '!src/satellites/bridge/optimization/**/*.d.ts'
  ],
  coverageDirectory: 'coverage/bridge-optimization',
  coverageReporters: ['text', 'lcov', 'html'],
  setupFilesAfterEnv: ['<rootDir>/src/satellites/bridge/optimization/__tests__/setup.ts'],
  testTimeout: 30000, // 30 seconds for integration tests
  maxWorkers: 4,
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/src/$1'
  },
  globals: {
    'ts-jest': {
      tsconfig: 'tsconfig.json'
    }
  }
};