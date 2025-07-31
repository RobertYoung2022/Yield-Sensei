/**
 * Custom Jest Matchers for Sage Satellite Testing
 * Domain-specific matchers for improved test readability and accuracy
 */

// Custom matchers for Sage satellite testing
expect.extend({
  // Matcher for RWA score validation
  toBeValidRWAScore(received) {
    const pass = received && 
                 typeof received === 'object' &&
                 typeof received.overallScore === 'number' &&
                 received.overallScore >= 0 &&
                 received.overallScore <= 1 &&
                 typeof received.riskAdjustedReturn === 'number' &&
                 received.riskAdjustedReturn >= 0 &&
                 Array.isArray(received.recommendations) &&
                 Array.isArray(received.factors) &&
                 typeof received.confidence === 'number' &&
                 received.confidence >= 0 &&
                 received.confidence <= 1;

    return {
      message: () => pass 
        ? `Expected ${JSON.stringify(received)} not to be a valid RWA score`
        : `Expected ${JSON.stringify(received)} to be a valid RWA score with proper structure and value ranges`,
      pass
    };
  },

  // Matcher for protocol analysis validation
  toBeValidProtocolAnalysis(received) {
    const pass = received &&
                 typeof received === 'object' &&
                 typeof received.overallScore === 'number' &&
                 received.overallScore >= 0 &&
                 received.overallScore <= 1 &&
                 received.tvlAnalysis &&
                 received.riskAssessment &&
                 received.teamAssessment &&
                 received.securityAssessment &&
                 received.governanceAssessment &&
                 received.revenueAnalysis &&
                 Array.isArray(received.recommendations) &&
                 typeof received.confidence === 'number';

    return {
      message: () => pass
        ? `Expected ${JSON.stringify(received)} not to be a valid protocol analysis`
        : `Expected ${JSON.stringify(received)} to be a valid protocol analysis with all required components`,
      pass
    };
  },

  // Matcher for compliance assessment validation
  toBeValidComplianceAssessment(received) {
    const pass = received &&
                 typeof received === 'object' &&
                 typeof received.overallScore === 'number' &&
                 received.overallScore >= 0 &&
                 received.overallScore <= 1 &&
                 ['compliant', 'partial', 'non-compliant'].includes(received.complianceLevel) &&
                 Array.isArray(received.ruleEvaluations) &&
                 Array.isArray(received.violations) &&
                 Array.isArray(received.recommendations);

    return {
      message: () => pass
        ? `Expected ${JSON.stringify(received)} not to be a valid compliance assessment`
        : `Expected ${JSON.stringify(received)} to be a valid compliance assessment with proper structure`,
      pass
    };
  },

  // Matcher for performance threshold validation
  toMeetPerformanceThreshold(received, threshold) {
    const pass = typeof received === 'number' && received <= threshold;

    return {
      message: () => pass
        ? `Expected ${received}ms not to meet performance threshold of ${threshold}ms`
        : `Expected ${received}ms to meet performance threshold of ${threshold}ms`,
      pass
    };
  },

  // Matcher for score consistency validation
  toBeConsistentWith(received, other, tolerance = 0.05) {
    const pass = typeof received === 'number' &&
                 typeof other === 'number' &&
                 Math.abs(received - other) <= tolerance;

    return {
      message: () => pass
        ? `Expected ${received} not to be consistent with ${other} (tolerance: ${tolerance})`
        : `Expected ${received} to be consistent with ${other} (tolerance: ${tolerance}), difference: ${Math.abs(received - other)}`,
      pass
    };
  },

  // Matcher for recommendation validation
  toHaveValidRecommendations(received) {
    if (!Array.isArray(received)) {
      return {
        message: () => `Expected ${received} to be an array of recommendations`,
        pass: false
      };
    }

    const validActions = ['invest', 'hold', 'avoid', 'monitor', 'buy', 'sell'];
    const validTimeframes = ['short', 'medium', 'long'];
    const validRiskLevels = ['low', 'medium', 'high'];

    const pass = received.every(rec => 
      rec &&
      typeof rec === 'object' &&
      validActions.includes(rec.action || rec.type) &&
      typeof rec.confidence === 'number' &&
      rec.confidence >= 0 &&
      rec.confidence <= 1 &&
      typeof rec.reasoning === 'string' &&
      rec.reasoning.length > 0 &&
      validTimeframes.includes(rec.timeframe) &&
      validRiskLevels.includes(rec.riskLevel)
    );

    return {
      message: () => pass
        ? `Expected recommendations not to be valid`
        : `Expected all recommendations to have valid structure with proper action, confidence, reasoning, timeframe, and risk level`,
      pass
    };
  },

  // Matcher for factor validation
  toHaveValidFactors(received) {
    if (!Array.isArray(received)) {
      return {
        message: () => `Expected ${received} to be an array of factors`,
        pass: false
      };
    }

    const validImpacts = ['positive', 'negative', 'neutral'];

    const pass = received.every(factor =>
      factor &&
      typeof factor === 'object' &&
      typeof factor.category === 'string' &&
      factor.category.length > 0 &&
      typeof factor.score === 'number' &&
      factor.score >= 0 &&
      factor.score <= 1 &&
      typeof factor.weight === 'number' &&
      factor.weight > 0 &&
      typeof factor.description === 'string' &&
      factor.description.length > 0 &&
      validImpacts.includes(factor.impact)
    );

    return {
      message: () => pass
        ? `Expected factors not to be valid`
        : `Expected all factors to have valid structure with category, score, weight, description, and impact`,
      pass
    };
  },

  // Matcher for date validation
  toBeRecentDate(received, maxAgeMs = 24 * 60 * 60 * 1000) { // Default 24 hours
    const pass = received instanceof Date &&
                 !isNaN(received.getTime()) &&
                 (Date.now() - received.getTime()) <= maxAgeMs;

    return {
      message: () => pass
        ? `Expected ${received} not to be a recent date (within ${maxAgeMs}ms)`
        : `Expected ${received} to be a recent date (within ${maxAgeMs}ms)`,
      pass
    };
  },

  // Matcher for memory usage validation
  toBeWithinMemoryLimit(received, limitMB) {
    const limitBytes = limitMB * 1024 * 1024;
    const pass = typeof received === 'number' && received <= limitBytes;

    return {
      message: () => pass
        ? `Expected memory usage ${(received / 1024 / 1024).toFixed(2)}MB not to be within limit of ${limitMB}MB`
        : `Expected memory usage ${(received / 1024 / 1024).toFixed(2)}MB to be within limit of ${limitMB}MB`,
      pass
    };
  },

  // Matcher for statistical validation
  toHaveStatisticallySignificantDifference(received, other, threshold = 0.1) {
    const difference = Math.abs(received - other);
    const average = (received + other) / 2;
    const relativeChange = difference / average;
    
    const pass = relativeChange >= threshold;

    return {
      message: () => pass
        ? `Expected difference between ${received} and ${other} not to be statistically significant (>= ${threshold * 100}%)`
        : `Expected difference between ${received} and ${other} to be statistically significant (>= ${threshold * 100}%), got ${(relativeChange * 100).toFixed(2)}%`,
      pass
    };
  },

  // Matcher for data completeness validation
  toBeCompleteData(received, requiredFields) {
    if (!received || typeof received !== 'object') {
      return {
        message: () => `Expected ${received} to be an object`,
        pass: false
      };
    }

    const missingFields = requiredFields.filter(field => !(field in received));
    const pass = missingFields.length === 0;

    return {
      message: () => pass
        ? `Expected data not to be complete`
        : `Expected data to be complete, missing fields: ${missingFields.join(', ')}`,
      pass
    };
  },

  // Matcher for score range validation
  toBeInScoreRange(received, min = 0, max = 1) {
    const pass = typeof received === 'number' &&
                 received >= min &&
                 received <= max &&
                 !isNaN(received);

    return {
      message: () => pass
        ? `Expected ${received} not to be in score range [${min}, ${max}]`
        : `Expected ${received} to be in score range [${min}, ${max}]`,
      pass
    };
  },

  // Matcher for array element validation
  toHaveElementsMatching(received, predicate) {
    if (!Array.isArray(received)) {
      return {
        message: () => `Expected ${received} to be an array`,
        pass: false
      };
    }

    const pass = received.length > 0 && received.every(predicate);

    return {
      message: () => pass
        ? `Expected array elements not to match predicate`
        : `Expected all array elements to match predicate`,
      pass
    };
  },

  // Matcher for timeout validation
  toCompleteWithinTimeout(received, timeoutMs) {
    const pass = typeof received === 'number' && received <= timeoutMs;

    return {
      message: () => pass
        ? `Expected operation (${received}ms) not to complete within timeout of ${timeoutMs}ms`
        : `Expected operation to complete within timeout of ${timeoutMs}ms, took ${received}ms`,
      pass
    };
  }
});

// Export matchers for TypeScript support
module.exports = {
  toBeValidRWAScore: expect.toBeValidRWAScore,
  toBeValidProtocolAnalysis: expect.toBeValidProtocolAnalysis,
  toBeValidComplianceAssessment: expect.toBeValidComplianceAssessment,
  toMeetPerformanceThreshold: expect.toMeetPerformanceThreshold,
  toBeConsistentWith: expect.toBeConsistentWith,
  toHaveValidRecommendations: expect.toHaveValidRecommendations,
  toHaveValidFactors: expect.toHaveValidFactors,
  toBeRecentDate: expect.toBeRecentDate,
  toBeWithinMemoryLimit: expect.toBeWithinMemoryLimit,
  toHaveStatisticallySignificantDifference: expect.toHaveStatisticallySignificantDifference,
  toBeCompleteData: expect.toBeCompleteData,
  toBeInScoreRange: expect.toBeInScoreRange,
  toHaveElementsMatching: expect.toHaveElementsMatching,
  toCompleteWithinTimeout: expect.toCompleteWithinTimeout
};