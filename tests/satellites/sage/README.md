# Sage Satellite Testing Suite

Comprehensive testing framework for the Sage Satellite - YieldSensei's RWA (Real World Asset) analysis and compliance monitoring system.

## 🏗️ Architecture

The Sage satellite testing suite provides complete coverage for:

- **RWA Opportunity Scoring System** - ML-powered asset evaluation
- **Fundamental Analysis Engine** - Protocol health assessment  
- **Perplexity AI Integration** - Market research capabilities
- **Compliance Monitoring Framework** - Regulatory compliance tracking
- **Performance & Load Testing** - Scalability validation
- **Data Validation & Accuracy** - Result consistency verification

## 🚀 Quick Start

### Run All Tests
```bash
npm run test:sage:all
```

### Run Specific Test Categories
```bash
# Unit tests only
npm run test:sage:unit

# Integration tests
npm run test:sage:integration

# Performance tests
npm run test:sage:performance

# Validation tests
npm run test:sage:validation
```

### Generate Test Report
```bash
npm run test:sage:report
```

### Watch Mode
```bash
npm run test:sage:watch
```

## 📋 Test Categories

### Unit Tests
- **RWA Scoring System** (`rwa-opportunity-scoring.test.ts`)
- **Fundamental Analysis Engine** (`fundamental-analysis-engine.test.ts`)
- **Compliance Monitoring** (`compliance-monitoring-framework.test.ts`)
- **Perplexity Integration** (`perplexity-api-integration.test.ts`)

### Integration Tests
- **Comprehensive Suite** (`comprehensive-sage-testing-suite.test.ts`)
- **Cross-component validation**
- **End-to-end workflows**

### Performance Tests
- **Load Testing** (`performance-load-testing.test.ts`)
- **Throughput benchmarks**
- **Memory usage validation**
- **Concurrency testing**

### Validation Tests
- **Data Accuracy** (`data-validation-accuracy.test.ts`)
- **Score consistency**
- **Edge case handling**
- **Benchmark validation**

## 🔧 Configuration

### Jest Configuration
- **Config File**: `config/jest.sage.config.js`
- **Setup**: `config/jest.setup.js`
- **Custom Matchers**: `config/custom-matchers.js`
- **Test Sequencer**: `config/test-sequencer.js`
- **Results Processor**: `config/results-processor.js`

### Coverage Thresholds
- **Global**: 85% (statements, lines, functions), 80% (branches)
- **Core Components**: 90-95% coverage required
- **Critical Paths**: 95%+ coverage enforced

### Performance Thresholds
- **RWA Scoring**: < 2 seconds (single), < 10 seconds (batch of 10)
- **Protocol Analysis**: < 3 seconds
- **Compliance Assessment**: < 1 second
- **Memory Limit**: 100MB per test suite

## 📊 Reports & Monitoring

### Generated Reports
- **HTML Report**: `coverage/sage/html-report/sage-test-report.html`
- **JSON Summary**: `coverage/sage/sage-test-summary.json`
- **Dashboard Data**: `coverage/sage/sage-dashboard-data.json`
- **Component Reports**: `coverage/sage/sage-component-reports.json`
- **Trend Analysis**: `coverage/sage/sage-trends.json`

### CI/CD Integration
- **GitHub Actions**: `.github/workflows/sage-tests.yml`
- **Automated PR Comments**: Test results posted on pull requests
- **Coverage Tracking**: Codecov integration
- **Performance Monitoring**: Trend analysis across builds

## 🎯 Custom Matchers

Domain-specific Jest matchers for improved test readability:

```typescript
// RWA score validation
expect(score).toBeValidRWAScore();

// Protocol analysis validation
expect(analysis).toBeValidProtocolAnalysis();

// Compliance assessment validation
expect(assessment).toBeValidComplianceAssessment();

// Performance validation
expect(duration).toMeetPerformanceThreshold(2000);

// Score consistency
expect(score1).toBeConsistentWith(score2, 0.05);

// Recommendation validation
expect(recommendations).toHaveValidRecommendations();

// Factor validation
expect(factors).toHaveValidFactors();

// Memory validation
expect(memoryUsage).toBeWithinMemoryLimit(100);

// Statistical validation
expect(value1).toHaveStatisticallySignificantDifference(value2, 0.1);

// Data completeness
expect(data).toBeCompleteData(['id', 'name', 'score']);

// Score range validation
expect(score).toBeInScoreRange(0, 1);

// Timeout validation
expect(operationTime).toCompleteWithinTimeout(5000);
```

## 🧪 Test Data

### Mock Data Generators
- **Mock RWA Data**: Real estate, commodity, infrastructure assets
- **Mock Protocol Data**: DeFi protocols with realistic metrics
- **Performance Benchmarks**: Known scoring baselines
- **Edge Cases**: Boundary conditions and error scenarios

### Environment Variables
```bash
# Enable specific test categories
ENABLE_ML_TESTS=true
ENABLE_PERFORMANCE_TESTS=true
ENABLE_INTEGRATION_TESTS=true
ENABLE_LOAD_TESTS=true

# API keys for integration tests
PERPLEXITY_API_KEY=your_key_here

# Performance monitoring
LOG_TEST_METRICS=true
NODE_OPTIONS=--max-old-space-size=4096
```

## 📈 Performance Monitoring

### Key Metrics Tracked
- **Test Execution Time**: Per test and per suite
- **Memory Usage**: Heap usage and memory leaks
- **API Response Times**: External service integration
- **Throughput**: Concurrent request handling
- **Resource Utilization**: CPU and memory under load

### Performance Scores
- **Performance Score**: 0-100 based on execution time
- **Memory Score**: Based on memory efficiency
- **Reliability Score**: Based on test stability
- **Overall Health**: Composite score

## 🔍 Debugging

### Enable Console Output
```typescript
// In tests
global.enableConsole();
```

### Test Utilities
```typescript
// Performance measurement
const { result, duration } = await global.testUtils.measurePerformance(
  () => sageAgent.scoreRWA(asset),
  'RWA Scoring'
);

// Memory tracking
const memoryUsage = global.testUtils.getMemoryUsage();

// Test data generation
const mockRWA = global.testUtils.createMockRWAData({ yield: 0.08 });
const mockProtocol = global.testUtils.createMockProtocolData({ tvl: 1000000000 });
```

### Common Issues
1. **Memory Leaks**: Check for unclosed connections or retained references
2. **Flaky Tests**: Enable retry logic and check for race conditions
3. **Slow Tests**: Profile with `LOG_TEST_METRICS=true`
4. **API Timeouts**: Verify network connectivity and rate limits

## 🤝 Contributing

### Adding New Tests
1. Follow naming convention: `component-name.test.ts`
2. Use appropriate test categories (unit/integration/performance)
3. Add custom matchers for domain-specific validation
4. Update coverage thresholds if needed
5. Document test purpose and expected behavior

### Best Practices
- **Test Isolation**: Each test should be independent
- **Mock External Dependencies**: Use nock for API mocking
- **Performance Awareness**: Monitor test execution time
- **Clear Assertions**: Use descriptive custom matchers
- **Documentation**: Comment complex test logic

## 📝 Changelog

### v1.0.0 (Current)
- ✅ Complete RWA scoring system testing
- ✅ Fundamental analysis engine coverage
- ✅ Perplexity AI integration tests
- ✅ Compliance monitoring framework tests
- ✅ Performance and load testing suite
- ✅ Data validation and accuracy tests
- ✅ Automated testing pipeline
- ✅ Comprehensive reporting system
- ✅ Custom Jest matchers
- ✅ CI/CD integration

### Planned Enhancements
- 🔄 Regression testing framework
- 🔄 Cross-component integration tests
- 🔄 Chaos engineering tests
- 🔄 Visual regression testing
- 🔄 A/B testing framework