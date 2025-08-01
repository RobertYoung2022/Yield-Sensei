/**
 * Jest Configuration for Arbitrage Detection Tests
 */

module.exports = {
  displayName: 'Bridge Arbitrage Detection Tests',
  testMatch: [
    '<rootDir>/src/satellites/bridge/arbitrage/__tests__/**/*.test.ts'
  ],
  collectCoverageFrom: [
    '<rootDir>/src/satellites/bridge/arbitrage/**/*.ts',
    '!<rootDir>/src/satellites/bridge/arbitrage/**/*.test.ts',
    '!<rootDir>/src/satellites/bridge/arbitrage/__tests__/**/*'
  ],
  coverageThreshold: {
    global: {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90
    }
  },
  setupFilesAfterEnv: [
    '<rootDir>/src/satellites/bridge/arbitrage/__tests__/setup.ts'
  ],
  testTimeout: 30000, // 30 seconds for performance tests
  reporters: [
    'default',
    [
      'jest-html-reporters',
      {
        publicPath: './coverage/arbitrage-tests',
        filename: 'arbitrage-test-report.html',
        expand: true,
        hideIcon: false,
        pageTitle: 'Bridge Arbitrage Detection Test Report'
      }
    ]
  ]
};