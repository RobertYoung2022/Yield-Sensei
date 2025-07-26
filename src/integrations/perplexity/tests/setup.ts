/**
 * Test setup file for Perplexity integration tests
 */

// Mock external dependencies that are not directly testable
jest.mock('axios');
jest.mock('fs/promises');

// Global test timeout
jest.setTimeout(30000);

// Setup global mocks
const mockLogger = {
  getLogger: jest.fn(() => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }))
};

jest.mock('@/shared/logging/logger', () => mockLogger);

// Mock file system operations
const mockFs = {
  mkdir: jest.fn().mockResolvedValue(undefined),
  writeFile: jest.fn().mockResolvedValue(undefined),
  readFile: jest.fn().mockResolvedValue('{}'),
  access: jest.fn().mockResolvedValue(undefined)
};

jest.mock('fs/promises', () => mockFs);

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks();
});

// Global error handler for unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Suppress console.log during tests unless explicitly testing logging
const originalConsoleLog = console.log;
beforeAll(() => {
  console.log = jest.fn();
});

afterAll(() => {
  console.log = originalConsoleLog;
});

export {};