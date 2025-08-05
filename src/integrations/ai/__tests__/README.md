# AI Service Integration Testing Suite

Comprehensive testing infrastructure for YieldSensei's AI service integration layer, covering unit tests, integration tests, performance testing, and security validation.

## Overview

This testing suite validates the AI service integration layer across multiple dimensions:

- **Unit Tests**: Individual provider clients and unified client functionality
- **Integration Tests**: Cross-provider connectivity and fallback mechanisms
- **Performance Tests**: Load testing, throughput analysis, and resource usage
- **Security Tests**: API key management, input sanitization, and audit logging

## Test Structure

```
src/integrations/ai/__tests__/
├── utils/
│   └── test-helpers.ts          # Common utilities, mocks, and test infrastructure
├── unit/
│   ├── providers/
│   │   ├── openai-client.test.ts      # OpenAI client unit tests
│   │   ├── anthropic-client.test.ts   # Anthropic client unit tests
│   │   └── perplexity-client.test.ts  # Perplexity client unit tests
│   └── unified-ai-client.test.ts      # Unified client tests
├── integration/
│   ├── provider-connectivity.test.ts  # Real API connection tests
│   ├── unified-client-integration.test.ts
│   └── cross-satellite-coordination.test.ts
├── performance/
│   ├── load-testing.test.ts           # Concurrent load and throughput
│   ├── rate-limiting.test.ts          # Rate limit handling
│   └── caching.test.ts                # Response caching tests
├── security/
│   ├── api-key-management.test.ts     # Credential security
│   ├── error-handling.test.ts         # Error sanitization
│   └── audit-logging.test.ts          # Security event logging
├── jest.config.js                     # Jest configuration
├── setup.ts                           # Global test setup
├── sequencer.js                       # Test execution order
└── README.md                          # This file
```

## Running Tests

### Prerequisites

Ensure you have the required dependencies installed:

```bash
npm install --save-dev jest ts-jest @types/jest
```

### Environment Setup

Create a `.env.test` file with test API keys (optional for mock tests):

```env
# Optional: Real API keys for integration tests
OPENAI_API_KEY=your_test_openai_key
ANTHROPIC_API_KEY=your_test_anthropic_key
PERPLEXITY_API_KEY=your_test_perplexity_key
```

**⚠️ Security Note**: Never commit real API keys. Use test keys or mock implementations.

### Running Tests

```bash
# Run all AI integration tests
npm test -- src/integrations/ai/__tests__

# Run specific test categories
npm test -- src/integrations/ai/__tests__/unit
npm test -- src/integrations/ai/__tests__/integration
npm test -- src/integrations/ai/__tests__/performance
npm test -- src/integrations/ai/__tests__/security

# Run with coverage
npm test -- --coverage src/integrations/ai/__tests__

# Run in watch mode during development
npm test -- --watch src/integrations/ai/__tests__

# Run performance tests with detailed output
npm test -- --verbose src/integrations/ai/__tests__/performance

# Run specific test file
npm test -- src/integrations/ai/__tests__/unit/providers/openai-client.test.ts
```

### Test Modes

#### Mock Mode (Default)
Uses mock implementations for fast, isolated testing:
```bash
NODE_ENV=test npm test -- src/integrations/ai/__tests__
```

#### Integration Mode
Uses real API calls with mock responses:
```bash
NODE_ENV=integration npm test -- src/integrations/ai/__tests__/integration
```

#### Load Testing Mode
Runs performance and stress tests:
```bash
NODE_ENV=performance npm test -- src/integrations/ai/__tests__/performance
```

## Test Categories

### Unit Tests

Test individual components in isolation:

- **Provider Clients**: OpenAI, Anthropic, Perplexity client functionality
- **Unified Client**: Intelligent routing, fallback mechanisms, health monitoring
- **Type Safety**: TypeScript interface validation and error handling

Coverage targets: 90%+ for all unit tests

### Integration Tests

Test component interactions and external dependencies:

- **Provider Connectivity**: Real API connection simulation
- **Cross-Provider Fallback**: Seamless provider switching
- **Network Resilience**: Timeout handling, retry logic, error recovery

Coverage targets: 80%+ for integration scenarios

### Performance Tests

Validate system performance under various conditions:

- **Load Testing**: Concurrent request handling (10, 50, 100, 200 requests)
- **Throughput Analysis**: Maximum requests per second capacity
- **Resource Usage**: Memory consumption and garbage collection
- **Response Time Distribution**: Latency percentiles (p50, p95, p99)

Performance targets:
- Average response time: < 1 second
- 95th percentile: < 2 seconds
- Success rate under load: > 90%
- Memory growth: < 50MB per 100 requests

### Security Tests

Ensure secure handling of sensitive data:

- **API Key Protection**: Credential sanitization in logs and errors
- **Input Validation**: Malicious prompt filtering and parameter validation
- **Network Security**: SSL/TLS verification and MITM prevention
- **Audit Logging**: Security event tracking and compliance

Security requirements:
- Zero API key exposure in logs/errors
- Input sanitization for all user data
- Secure transport (HTTPS only)
- Comprehensive audit trails

## Test Utilities

### MockAIServiceClient

Simulates AI provider behavior with configurable:
- Response latency
- Success/failure rates  
- Error types (auth, rate_limit, server, network)
- Usage tracking

```typescript
const client = new MockAIServiceClient('openai', config);
client.setLatency(200); // 200ms response time
client.setShouldFail(true, 'rate_limit'); // Simulate rate limiting
```

### TestDataFactory

Generates consistent test data:

```typescript
const request = TestDataFactory.createTextGenerationRequest({
  prompt: 'Test prompt',
  maxTokens: 100,
});

const analysisRequest = TestDataFactory.createAnalysisRequest({
  content: 'Content to analyze',
  analysisType: 'sentiment',
});
```

### PerformanceMonitor

Tracks performance metrics:

```typescript
performanceMonitor.recordMetric('response_time', duration);
const stats = performanceMonitor.getStats('response_time');
// Returns: { count, min, max, mean, median, p95, p99 }
```

### TestUtils

Common testing utilities:

```typescript
// Measure execution time
const { result, duration } = await TestUtils.measureTime(() => 
  client.generateText(request)
);

// Wait for events
const eventData = await TestUtils.waitForEvent(emitter, 'success');

// Retry with backoff
const result = await TestUtils.retry(() => apiCall(), 3);
```

## Custom Jest Matchers

Extended matchers for AI-specific testing:

```typescript
// Validate AI response structure
expect(response).toHaveValidAIResponse();

// Check response time
expect(duration).toHaveReasonableLatency(5000);

// Validate numeric ranges
expect(successRate).toBeWithinRange(0.9, 1.0);
```

## Configuration

### Jest Configuration

Key settings in `jest.config.js`:
- **Timeout**: 30 seconds for integration tests
- **Coverage**: 80% threshold for branches/functions/lines
- **Workers**: 50% of CPU cores for parallel execution
- **Sequencer**: Custom test ordering for optimal performance

### Test Environment

Global configuration in `setup.ts`:
- Mock implementations for external services
- Security pattern detection
- Performance thresholds
- Sensitive data sanitization

## Best Practices

### Writing Tests

1. **Isolation**: Each test should be independent and deterministic
2. **Mocking**: Use mocks for external dependencies in unit tests
3. **Assertions**: Make specific, meaningful assertions
4. **Cleanup**: Properly clean up resources and reset state
5. **Security**: Never commit real API keys or sensitive data

### Performance Testing

1. **Realistic Load**: Use representative request patterns
2. **Resource Monitoring**: Track memory and CPU usage
3. **Baseline Metrics**: Establish performance baselines
4. **Gradual Load**: Test with increasing concurrency levels
5. **Environment Consistency**: Use consistent test environments

### Security Testing

1. **Sensitive Data**: Verify no credentials in logs/errors
2. **Input Validation**: Test with malicious/malformed inputs
3. **Error Handling**: Ensure secure error responses
4. **Audit Trails**: Validate security event logging
5. **Compliance**: Test data retention and privacy controls

## Troubleshooting

### Common Issues

#### Tests Timeout
```bash
# Increase timeout for slow tests
npm test -- --testTimeout=60000
```

#### Memory Issues
```bash
# Run with more memory
node --max-old-space-size=4096 $(npm bin)/jest
```

#### API Rate Limits
```bash
# Use longer delays between requests
TEST_DELAY=1000 npm test
```

#### Mock Issues
```bash
# Clear Jest cache
npm test -- --clearCache
```

### Debugging

Enable verbose logging:
```bash
DEBUG=ai:* npm test -- --verbose
```

Run specific test with debugging:
```bash
node --inspect-brk $(npm bin)/jest --runInBand specific.test.ts
```

## CI/CD Integration

### GitHub Actions

```yaml
name: AI Integration Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm test -- --coverage src/integrations/ai/__tests__
      - uses: codecov/codecov-action@v3
```

### Test Reports

Generate comprehensive test reports:

```bash
# Coverage report
npm test -- --coverage --coverageReporters=html

# Performance report
npm test -- --verbose --outputFile=test-results.json
```

## Contributing

### Adding New Tests

1. **Location**: Place tests in appropriate category directory
2. **Naming**: Use descriptive test file names ending in `.test.ts`
3. **Structure**: Follow existing test patterns and utilities
4. **Documentation**: Add comments for complex test logic
5. **Coverage**: Ensure new code has corresponding tests

### Test Review Checklist

- [ ] Tests are isolated and deterministic
- [ ] Appropriate use of mocks and fixtures
- [ ] Performance thresholds are realistic
- [ ] Security considerations are addressed
- [ ] Error cases are thoroughly tested
- [ ] Documentation is updated

## Monitoring and Alerts

### Key Metrics

Monitor these test metrics in CI/CD:

- **Test Success Rate**: Should be > 95%
- **Test Duration**: Should remain stable over time  
- **Coverage**: Should maintain > 80%
- **Performance Regressions**: Response time increases > 20%

### Alerts

Set up alerts for:
- Test failure rates > 5%
- Performance degradation > 50%
- Security test failures
- Coverage drops below threshold

## Support

For questions or issues with the testing suite:

1. Check this README for common solutions
2. Review existing test patterns for examples
3. Consult the test utilities documentation
4. Open an issue with detailed error information

---

**Note**: This testing suite is designed to be comprehensive yet maintainable. Regular updates ensure it stays aligned with the evolving AI integration requirements of YieldSensei.