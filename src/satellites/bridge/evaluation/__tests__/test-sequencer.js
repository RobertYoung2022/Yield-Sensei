/**
 * Custom Test Sequencer for Evaluation Tests
 * Ensures tests run in optimal order for performance and reliability
 */

const Sequencer = require('@jest/test-sequencer').default;

class EvaluationTestSequencer extends Sequencer {
  sort(tests) {
    // Define test priority order
    const testOrder = [
      'opportunity-evaluator.test.ts',      // Core evaluation logic first
      'execution-feasibility-analyzer.test.ts', // Component tests
      'evaluation-integration.test.ts'      // Integration tests last (most expensive)
    ];

    return tests.sort((testA, testB) => {
      const nameA = testA.path.split('/').pop();
      const nameB = testB.path.split('/').pop();
      
      const indexA = testOrder.indexOf(nameA);
      const indexB = testOrder.indexOf(nameB);
      
      // If both tests are in our ordered list, use that order
      if (indexA !== -1 && indexB !== -1) {
        return indexA - indexB;
      }
      
      // If only one is in the list, prioritize it
      if (indexA !== -1) return -1;
      if (indexB !== -1) return 1;
      
      // For tests not in our list, use alphabetical order
      return nameA.localeCompare(nameB);
    });
  }
}

module.exports = EvaluationTestSequencer;