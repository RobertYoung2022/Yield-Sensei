# RWA Opportunity Scoring System Testing Guide

This guide explains how to test and verify that your RWA (Real-World Asset) Opportunity Scoring System works as described in the implementation.

## Overview

The RWA Opportunity Scoring System is a comprehensive evaluation engine that analyzes real-world asset opportunities using multiple factors including yield, risk, liquidity, regulatory compliance, collateral quality, and market conditions. This guide provides multiple ways to test and validate the system.

## What the System Does

Based on the implementation, your RWA Opportunity Scoring System:

1. **Evaluates RWA Opportunities** - Analyzes real-world assets like real estate, bonds, commodities, art, etc.
2. **Multi-Factor Scoring** - Uses weighted scoring across 6 key dimensions:
   - Yield (25% weight)
   - Risk (25% weight) 
   - Liquidity (15% weight)
   - Regulatory (15% weight)
   - Collateral (10% weight)
   - Market (10% weight)
3. **Risk-Adjusted Returns** - Calculates Sharpe ratio-like metrics
4. **Generates Recommendations** - Provides invest/hold/avoid/monitor advice
5. **Institutional Data Integration** - Connects to market data feeds
6. **Caching & Performance** - Optimizes for high-throughput scoring
7. **Event-Driven Architecture** - Emits events for integration

## Testing Options

### Option 1: Quick Demo (Recommended First Step)

Run the integration demo to see the system in action:

```bash
npm run test:rwa:demo
```

This will:
- Initialize the scoring system
- Score 3 different RWA opportunities (real estate, bonds, art)
- Show detailed scoring breakdowns
- Display recommendations and key factors
- Run performance benchmarks
- Test caching functionality

**Expected Output:**
```
🏗️  RWA Opportunity Scoring System Demo
==================================================
📊 Initializing RWA Opportunity Scoring System...
✅ System initialized successfully
📈 System Status: { isRunning: true, cacheSize: 0, ... }

🎯 Scoring RWA Opportunities...
--------------------------------------------------
📋 Analyzing: Premium Real Estate Fund (real-estate)
   Value: $2,500,000
   Yield: 7.5%
   Risk Rating: AA

📊 Scoring Results:
   Overall Score: 78.5%
   Risk-Adjusted Return: 3.2%
   Confidence: 85.2%

📈 Component Scores:
   Yield: 82.3%
   Risk: 85.1%
   Liquidity: 45.2%
   Regulatory: 92.1%
   Collateral: 78.9%
   Market: 76.4%

💡 Top Recommendations:
   1. INVEST: Excellent fundamentals with strong risk-adjusted returns
      Confidence: 78.5% | Risk: low | Timeframe: long
      Max Exposure: $250,000
```

### Option 2: Comprehensive Unit Tests

Run the full test suite to validate all functionality:

```bash
npm run test:rwa:unit
```

This runs 50+ test cases covering:
- ✅ Initialization and configuration
- ✅ Scoring calculations for different RWA types
- ✅ Risk assessment and adjustments
- ✅ Caching and performance
- ✅ Event emission
- ✅ Error handling
- ✅ Configuration validation
- ✅ Market data integration
- ✅ Compliance scoring
- ✅ Performance benchmarks

### Option 3: Full Test Suite with Demo

Run both tests and demo together:

```bash
npm run test:rwa
```

This comprehensive test runner will:
1. Execute all unit tests
2. Run the integration demo
3. Provide a summary of results
4. Give next steps for any issues found

## Understanding Test Results

### ✅ Passing Tests
If tests pass, your system is working correctly and you can be confident that:
- All scoring algorithms work as designed
- Multi-factor weights are applied correctly
- Risk adjustments are calculated properly
- Caching improves performance
- Events are emitted correctly
- Error handling is robust

### ❌ Failing Tests
If tests fail, the error messages will tell you exactly what needs to be fixed:

**Common Issues and Solutions:**

1. **Import/Module Errors**
   ```
   Cannot find module '@/satellites/sage/rwa/opportunity-scoring-system'
   ```
   **Solution:** Check that the file path is correct and the module exports are properly defined.

2. **Type Errors**
   ```
   Property 'type' is required in type 'RWAData'
   ```
   **Solution:** Ensure all required properties are provided in test data.

3. **Scoring Logic Errors**
   ```
   Expected score to be greater than 0.7, but received 0.3
   ```
   **Solution:** Review the scoring algorithms in the implementation.

4. **Performance Issues**
   ```
   Expected time to be less than 3000ms, but received 5000ms
   ```
   **Solution:** Optimize the scoring calculations or caching logic.

## Manual Testing

You can also test the system manually by creating your own test scenarios:

```typescript
import { RWAOpportunityScoringSystem } from '@/satellites/sage/rwa/opportunity-scoring-system';
import { RWAData } from '@/satellites/sage/types';

async function testMyRWA() {
  const scoringSystem = RWAOpportunityScoringSystem.getInstance();
  await scoringSystem.initialize();
  
  const myRWA: RWAData = {
    id: 'my-test-rwa',
    type: 'real-estate',
    issuer: 'My Investment Fund',
    value: 1000000,
    currency: 'USD',
    yield: 0.08, // 8%
    riskRating: 'A',
    collateral: {
      type: 'real-estate',
      value: 1200000,
      ltv: 0.83,
      liquidationThreshold: 0.9
    },
    regulatoryStatus: {
      jurisdiction: 'US',
      complianceLevel: 'compliant',
      licenses: ['SEC-Registered'],
      restrictions: [],
      lastReview: new Date()
    },
    complianceScore: 90
  };
  
  const score = await scoringSystem.scoreOpportunity(myRWA);
  console.log('My RWA Score:', score);
  
  await scoringSystem.shutdown();
}
```

## Integration Testing

To test the system as part of your larger application:

1. **Initialize in your main application:**
   ```typescript
   import { RWAOpportunityScoringSystem } from '@/satellites/sage/rwa/opportunity-scoring-system';
   
   // In your app startup
   const rwaScoring = RWAOpportunityScoringSystem.getInstance();
   await rwaScoring.initialize();
   ```

2. **Use in your business logic:**
   ```typescript
   // Score an opportunity
   const score = await rwaScoring.scoreOpportunity(rwaData);
   
   // Make investment decisions based on score
   if (score.overallScore > 0.7 && score.recommendations.some(r => r.action === 'invest')) {
     // Proceed with investment
   }
   ```

3. **Listen for events:**
   ```typescript
   rwaScoring.on('scoring_completed', (data) => {
     console.log('RWA scored:', data.rwaId, data.score.overallScore);
     // Update UI, send notifications, etc.
   });
   ```

## Performance Testing

The system includes built-in performance benchmarks:

```bash
# Run performance tests
npm run test:rwa:unit -- --testNamePattern="Performance"
```

This will test:
- Scoring 10 RWAs efficiently (< 5 seconds)
- Concurrent scoring operations
- Cache performance improvements
- Memory usage under load

## Troubleshooting

### System Won't Initialize
- Check that all dependencies are installed
- Verify TypeScript compilation is successful
- Ensure no port conflicts with other services

### Scoring Results Seem Wrong
- Verify input data is valid (yield > 0, value > 0, etc.)
- Check that risk ratings are valid (AAA, AA, A, BBB, etc.)
- Ensure compliance scores are between 0-100

### Performance Issues
- Enable caching in configuration
- Check that market data is loading correctly
- Monitor memory usage during high-volume scoring

### Integration Issues
- Verify event listeners are properly attached
- Check that the singleton pattern is working correctly
- Ensure proper shutdown to clean up resources

## Next Steps

Once your tests are passing:

1. **Integrate with your main application**
2. **Add real market data feeds** (replace mock data)
3. **Connect to institutional data providers**
4. **Add more RWA types and scoring factors**
5. **Implement machine learning improvements**
6. **Add real-time market data updates**
7. **Create a web dashboard for scoring results**

## Support

If you encounter issues:

1. **Check the test output** for specific error messages
2. **Review the implementation** in `src/satellites/sage/rwa/opportunity-scoring-system.ts`
3. **Examine the type definitions** in `src/satellites/sage/types/index.ts`
4. **Run individual tests** to isolate issues
5. **Use the demo** to see expected behavior

The comprehensive test suite will help you identify and fix any issues with your RWA Opportunity Scoring System, ensuring it works exactly as described in the implementation. 