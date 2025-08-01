/**
 * Jest Configuration for AI Integration Testing
 */

module.exports = {
  displayName: 'AI Integration Tests',
  testEnvironment: 'node',
  roots: ['<rootDir>'],
  testMatch: [
    '**/__tests__/**/*.test.ts',
    '**/?(*.)+(spec|test).ts',
  ],
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  collectCoverageFrom: [
    '../**/*.ts',
    '!../**/*.d.ts',
    '!../**/__tests__/**',
    '!../node_modules/**',
  ],
  coverageDirectory: './coverage',
  coverageReporters: [
    'text',
    'lcov',
    'html',
    'json-summary',
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  setupFilesAfterEnv: ['<rootDir>/setup.ts'],
  testTimeout: 30000, // 30 seconds for integration tests
  maxWorkers: '50%', // Use half of available CPU cores
  verbose: true,
  detectOpenHandles: true,
  forceExit: true,
  clearMocks: true,
  restoreMocks: true,
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/../../../$1',
  },
  globals: {
    'ts-jest': {
      tsconfig: {
        target: 'es2020',
        module: 'commonjs',
        moduleResolution: 'node',
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
        experimentalDecorators: true,
        emitDecoratorMetadata: true,
        skipLibCheck: true,
        forceConsistentCasingInFileNames: true,
        resolveJsonModule: true,
      },
    },
  },
  testSequencer: '<rootDir>/sequencer.js',
};