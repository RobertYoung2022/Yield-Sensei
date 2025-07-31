/**
 * Jest Configuration for Sage Satellite Testing Suite
 * Optimized configuration for comprehensive testing of all Sage components
 */

module.exports = {
  // Test environment
  testEnvironment: 'node',
  
  // Root directory for tests
  rootDir: '../../../..',
  
  // Test file patterns
  testMatch: [
    '<rootDir>/tests/satellites/sage/**/*.test.ts',
    '<rootDir>/tests/satellites/sage/**/*.spec.ts'
  ],
  
  // Transform configuration
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: '<rootDir>/tsconfig.json'
    }]
  },
  
  // Module resolution
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@/shared/(.*)$': '<rootDir>/src/shared/$1',
    '^@/types/(.*)$': '<rootDir>/src/types/$1',
    '^@/satellites/(.*)$': '<rootDir>/src/satellites/$1'
  },
  
  // Setup files
  setupFilesAfterEnv: [
    '<rootDir>/tests/satellites/sage/config/jest.setup.js'
  ],
  
  // Coverage configuration
  collectCoverage: true,
  coverageDirectory: '<rootDir>/coverage/sage',
  coverageReporters: [
    'text',
    'lcov',
    'html',
    'json',
    'clover'
  ],
  
  // Coverage thresholds
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 85,
      lines: 85,
      statements: 85
    },
    // Specific thresholds for critical components
    '<rootDir>/src/satellites/sage/sage-satellite.ts': {
      branches: 90,
      functions: 95,
      lines: 95,
      statements: 95
    },
    '<rootDir>/src/satellites/sage/rwa/opportunity-scoring-system.ts': {
      branches: 85,
      functions: 90,
      lines: 90,
      statements: 90
    },
    '<rootDir>/src/satellites/sage/research/fundamental-analysis-engine.ts': {
      branches: 85,
      functions: 90,
      lines: 90,
      statements: 90
    }
  },
  
  // Files to collect coverage from
  collectCoverageFrom: [
    'src/satellites/sage/**/*.ts',
    '!src/satellites/sage/**/*.d.ts',
    '!src/satellites/sage/**/types/**',
    '!src/satellites/sage/**/*.interface.ts',
    '!src/satellites/sage/**/index.ts'
  ],
  
  // Test timeout
  testTimeout: 30000, // 30 seconds for integration tests
  
  // Globals
  globals: {
    'ts-jest': {
      useESM: false
    }
  },
  
  // Module file extensions
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  
  // Clear mocks between tests
  clearMocks: true,
  restoreMocks: true,
  
  // Verbose output
  verbose: true,
  
  // Test results processor
  testResultsProcessor: '<rootDir>/tests/satellites/sage/config/results-processor.js',
  
  // Reporter configuration
  reporters: [
    'default',
    ['jest-html-reporters', {
      publicPath: '<rootDir>/coverage/sage/html-report',
      filename: 'sage-test-report.html',
      pageTitle: 'Sage Satellite Test Report',
      logoImgPath: undefined,
      hideIcon: false,
      expand: true,
      inlineSource: true,
      urlForTestFiles: ''
    }],
    ['jest-junit', {
      outputDirectory: '<rootDir>/coverage/sage',
      outputName: 'sage-junit-report.xml',
      suiteName: 'Sage Satellite Tests',
      classNameTemplate: '{classname}',
      titleTemplate: '{title}',
      ancestorSeparator: ' › ',
      usePathForSuiteName: true
    }]
  ],
  
  // Max workers for parallel execution
  maxWorkers: '50%',
  
  // Cache directory
  cacheDirectory: '<rootDir>/node_modules/.cache/jest/sage',
  
  // Watch plugins
  watchPlugins: [
    'jest-watch-typeahead/filename',
    'jest-watch-typeahead/testname'
  ],
  
  // Error handling
  errorOnDeprecated: true,
  
  // Test sequencer for consistent ordering
  testSequencer: '<rootDir>/tests/satellites/sage/config/test-sequencer.js',
  
  // Performance monitoring
  detectOpenHandles: true,
  detectLeaks: true,
  
  // Custom matchers
  setupFilesAfterEnv: [
    '<rootDir>/tests/satellites/sage/config/jest.setup.js',
    '<rootDir>/tests/satellites/sage/config/custom-matchers.js'
  ]
};