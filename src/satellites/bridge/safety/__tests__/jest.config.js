/**
 * Jest Configuration for Bridge Safety Tests
 */

module.exports = {
  displayName: 'Bridge Safety & Risk Assessment Tests',
  testMatch: [
    '<rootDir>/src/satellites/bridge/safety/__tests__/**/*.test.ts'
  ],
  collectCoverageFrom: [
    '<rootDir>/src/satellites/bridge/safety/**/*.ts',
    '!<rootDir>/src/satellites/bridge/safety/**/*.test.ts',
    '!<rootDir>/src/satellites/bridge/safety/__tests__/**/*'
  ],
  coverageThreshold: {
    global: {
      branches: 88,
      functions: 88,
      lines: 88,
      statements: 88
    }
  },
  setupFilesAfterEnv: [
    '<rootDir>/src/satellites/bridge/safety/__tests__/setup.ts'
  ],
  testTimeout: 60000, // 60 seconds for AI analysis tests
  reporters: [
    'default',
    [
      'jest-html-reporters',
      {
        publicPath: './coverage/safety-tests',
        filename: 'safety-test-report.html',
        expand: true,
        hideIcon: false,
        pageTitle: 'Bridge Safety & Risk Assessment Test Report'
      }
    ]
  ],
  // Custom test environment for AI/ML testing
  testEnvironment: 'node',
  globals: {
    'ts-jest': {
      tsconfig: {
        experimentalDecorators: true,
        emitDecoratorMetadata: true
      }
    }
  }
};