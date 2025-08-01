/**
 * Jest Configuration for Opportunity Evaluation Tests
 */

module.exports = {
  displayName: 'Bridge Opportunity Evaluation Tests',
  testMatch: [
    '<rootDir>/src/satellites/bridge/evaluation/__tests__/**/*.test.ts'
  ],
  collectCoverageFrom: [
    '<rootDir>/src/satellites/bridge/evaluation/**/*.ts',
    '!<rootDir>/src/satellites/bridge/evaluation/**/*.test.ts',
    '!<rootDir>/src/satellites/bridge/evaluation/__tests__/**/*'
  ],
  coverageThreshold: {
    global: {
      branches: 85,
      functions: 85,
      lines: 85,
      statements: 85
    }
  },
  setupFilesAfterEnv: [
    '<rootDir>/src/satellites/bridge/evaluation/__tests__/setup.ts'
  ],
  testTimeout: 45000, // 45 seconds for integration tests
  reporters: [
    'default',
    [
      'jest-html-reporters',
      {
        publicPath: './coverage/evaluation-tests',
        filename: 'evaluation-test-report.html',
        expand: true,
        hideIcon: false,
        pageTitle: 'Bridge Opportunity Evaluation Test Report'
      }
    ]
  ],
  // Test sequencing for integration tests
  testSequencer: '<rootDir>/src/satellites/bridge/evaluation/__tests__/test-sequencer.js'
};