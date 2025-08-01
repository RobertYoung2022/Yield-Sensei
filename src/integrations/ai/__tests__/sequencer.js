/**
 * Jest Test Sequencer
 * Controls the order of test execution for optimal performance
 */

const TestSequencer = require('@jest/test-sequencer').default;

class AITestSequencer extends TestSequencer {
  sort(tests) {
    // Define test execution order for optimal performance
    const testOrder = [
      // 1. Fast unit tests first
      'unit/providers/',
      'unit/unified-ai-client',
      'utils/test-helpers',
      
      // 2. Integration tests
      'integration/provider-connectivity',
      'integration/unified-client-integration',
      'integration/cross-satellite-coordination',
      
      // 3. Performance tests (may be resource intensive)
      'performance/load-testing',
      'performance/rate-limiting',
      'performance/caching',
      
      // 4. Security tests last (may involve cleanup)
      'security/api-key-management',
      'security/error-handling',
      'security/audit-logging',
    ];

    return tests.sort((testA, testB) => {
      const pathA = testA.path;
      const pathB = testB.path;

      // Find the order index for each test
      const getOrderIndex = (path) => {
        for (let i = 0; i < testOrder.length; i++) {
          if (path.includes(testOrder[i])) {
            return i;
          }
        }
        return testOrder.length; // Unknown tests go last
      };

      const indexA = getOrderIndex(pathA);
      const indexB = getOrderIndex(pathB);

      if (indexA !== indexB) {
        return indexA - indexB;
      }

      // If same category, sort alphabetically
      return pathA.localeCompare(pathB);
    });
  }
}

module.exports = AITestSequencer;