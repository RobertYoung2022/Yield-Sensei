/**
 * Custom Test Sequencer for Sage Satellite Tests
 * Ensures tests run in optimal order for performance and reliability
 */

const Sequencer = require('@jest/test-sequencer').default;

class SageTestSequencer extends Sequencer {
  /**
   * Sort test files to optimize execution order
   * @param {Array} tests - Array of test objects
   * @returns {Array} Sorted array of tests
   */
  sort(tests) {
    // Define test priority order (higher priority runs first)
    const testPriorities = {
      // Unit tests run first (fastest)
      'rwa-opportunity-scoring.test.ts': 1,
      'fundamental-analysis-engine.test.ts': 2,
      'compliance-monitoring-framework.test.ts': 3,
      'perplexity-api-integration.test.ts': 4,
      'data-validation-accuracy.test.ts': 5,
      
      // Integration tests run next
      'comprehensive-sage-testing-suite.test.ts': 6,
      'perplexity-integration.test.ts': 7,
      
      // Performance tests run last (slowest)
      'performance-load-testing.test.ts': 10
    };

    // Sort tests by priority, then by file size (smaller first)
    return tests
      .slice()
      .sort((testA, testB) => {
        // Extract test names from paths
        const nameA = this.getTestName(testA.path);
        const nameB = this.getTestName(testB.path);
        
        // Get priorities (default to 8 if not found)
        const priorityA = testPriorities[nameA] || 8;
        const priorityB = testPriorities[nameB] || 8;
        
        // First sort by priority (lower number = higher priority)
        if (priorityA !== priorityB) {
          return priorityA - priorityB;
        }
        
        // Then sort by file size (smaller files first)
        const sizeA = testA.context?.config?.rootDir ? 
          this.getFileSize(testA.path) : 0;
        const sizeB = testB.context?.config?.rootDir ? 
          this.getFileSize(testB.path) : 0;
        
        if (sizeA !== sizeB) {
          return sizeA - sizeB;
        }
        
        // Finally sort alphabetically for consistency
        return testA.path.localeCompare(testB.path);
      });
  }

  /**
   * Extract test name from file path
   * @param {string} path - Full file path
   * @returns {string} Test file name
   */
  getTestName(path) {
    const parts = path.split('/');
    return parts[parts.length - 1];
  }

  /**
   * Get file size for sorting (stub implementation)
   * @param {string} path - File path
   * @returns {number} File size estimate
   */
  getFileSize(path) {
    try {
      const fs = require('fs');
      const stats = fs.statSync(path);
      return stats.size;
    } catch (error) {
      // Return estimated size based on test type
      if (path.includes('performance')) return 10000;
      if (path.includes('comprehensive')) return 8000;
      if (path.includes('integration')) return 5000;
      return 3000; // Default size for unit tests
    }
  }
}

module.exports = SageTestSequencer;