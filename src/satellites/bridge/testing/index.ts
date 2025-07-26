/**
 * Bridge Testing Framework - Main Export
 * Comprehensive testing framework for cross-chain arbitrage systems
 */

// Main framework exports
export { BridgeTestFramework } from './bridge-test-framework';
export { TestRunner } from './test-runner';
export { IntegrationTester } from './integration-tester';

// Specialized testers
export { PerformanceTester } from './performance-tester';
export { SecurityTester } from './security-tester';

// Type definitions
export * from './types';

// Convenience factory methods
export { createTestEnvironment, createDefaultTestConfig } from './test-utils';