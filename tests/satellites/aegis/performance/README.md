# Aegis Satellite Performance Benchmarking Suite

This directory contains comprehensive performance benchmarking tests for the Aegis Satellite system, designed to validate speed, throughput, resource utilization, and system stability under various load conditions.

## Test Structure

### Core Test Files

- **`performance_benchmarking_comprehensive.test.rs`** - Comprehensive performance benchmarking tests
- **`load_testing_comprehensive.test.rs`** - Load testing with various concurrency levels and user patterns

## Test Categories

### 1. Response Time Benchmarking

Tests individual operation response times under normal conditions:

- **Health Calculation Response Time**: Measures latency for position health factor calculations
- **Price Feed Response Time**: Tests price data retrieval performance and caching efficiency
- **Alert Generation Response Time**: Validates alert system latency and responsiveness

#### Key Metrics:
- Average response time (ms)
- P50, P95, P99 latency percentiles
- Success rate percentage
- Throughput (operations per second)

#### Performance Requirements:
- Health calculations: < 100ms average, > 95% success rate
- Price feed: < 50ms average, > 99% success rate
- Alert generation: < 50ms average, > 95% success rate

### 2. Throughput and Concurrent Processing

Evaluates system performance under concurrent load:

- **Concurrent Health Calculations**: Tests parallel processing capabilities
- **Price Feed Batch Processing**: Validates batch request efficiency
- **Monitoring System Throughput**: Measures continuous monitoring performance

#### Test Scenarios:
```rust
// Concurrency levels tested
let concurrent_levels = vec![1, 5, 10, 20, 50];

// Batch sizes tested  
let batch_sizes = vec![1, 10, 50, 100];
```

#### Performance Requirements:
- Minimum 0.5 ops/sec per concurrent task
- Batch processing efficiency gains
- Sustained monitoring throughput > 1 request/sec

### 3. Resource Utilization Monitoring

Tracks system resource usage patterns:

- **Memory Usage Under Load**: Tests memory scaling with position count
- **CPU Utilization Under Stress**: Measures CPU usage during high-frequency operations
- **Network Request Efficiency**: Validates request batching and optimization

#### Memory Testing:
```rust
let position_counts = vec![10, 50, 100, 500, 1000];
// Tests memory usage scaling: < 1MB per position
```

#### CPU Stress Testing:
- High-frequency concurrent operations
- Sustained load over 3+ seconds
- Resource efficiency validation

### 4. Latency Testing for Critical Calculations

Microsecond-level precision testing for critical operations:

- **Health Factor Calculation Latency**: Critical risk calculation timing
- **Risk Assessment Latency**: Comprehensive risk evaluation performance
- **Price Update Propagation Latency**: Real-time price change detection speed

#### Critical Performance Requirements:
- Health calculations: < 100ms average (100,000 μs)
- Risk assessments: < 150ms average  
- Price propagation: < 500ms average

### 5. Scalability Testing

Tests performance degradation with increasing system scale:

- **Portfolio Size Scaling**: 10 to 1,000 positions
- **Creation Rate Testing**: Position addition performance
- **Monitoring System Scalability**: Performance with large position counts

#### Scalability Test Scenarios:
```rust
let portfolio_sizes = vec![10, 50, 100, 250, 500, 1000];

// Performance requirements per scale:
// - Creation rate: > 1 position/sec
// - Health success rate: > 95%
// - Monitoring setup: < 5 seconds
```

#### Scalability Analysis:
- Performance degradation should be < 80% at maximum scale
- Linear scaling validation
- Resource usage trends

### 6. Long-Running Stability

Validates system stability over extended periods:

- **30-Second Continuous Operation**: Extended stability testing
- **Error Rate Tracking**: Failure pattern analysis over time
- **Performance Degradation Detection**: Identifies performance drift
- **Memory Growth Monitoring**: Detects potential memory leaks

#### Stability Metrics:
- Overall success rate: > 90%
- Average operation duration: < 200ms
- Maximum operation duration: < 5 seconds
- Memory growth: < 100MB over test period
- Performance degradation: < 50%

### 7. Load Testing Scenarios

Comprehensive load testing with realistic user patterns:

#### Light Load Testing:
- 5 concurrent users × 10 requests each
- Target: 10 ops/sec throughput
- Max acceptable latency: 500ms
- Max acceptable error rate: 5%

#### Moderate Load Testing:
- 20 concurrent users × 25 requests each  
- Target: 50 ops/sec throughput
- Max acceptable latency: 1000ms
- Max acceptable error rate: 10%

#### Heavy Load Testing:
- 50 concurrent users × 50 requests each
- Target: 100 ops/sec throughput
- Max acceptable latency: 2000ms
- Max acceptable error rate: 15%

#### Spike Load Testing:
- Sudden burst: 100 users × 5 requests simultaneously
- Tests system resilience during traffic spikes
- Validates recovery performance after spike

#### Sustained Load with Gradual Increase:
- Progressive load levels: 5→10→15→20→25 concurrent users
- Tests performance trends under increasing load
- Validates scalability patterns

## Performance Metrics Collection

### Comprehensive Performance Report

The benchmarking suite generates detailed performance reports including:

```rust
struct PerformanceMetrics {
    operation_name: String,
    duration_ms: u64,
    throughput_ops_per_sec: f64,
    memory_usage_mb: f64,
    cpu_usage_percent: f64,
    success_rate: f64,
    latency_percentiles: HashMap<u8, u64>, // P50, P95, P99
    error_count: usize,
    total_operations: usize,
}
```

### Metrics Collected:
- **Execution Time**: Per-operation timing in microseconds
- **Memory Usage**: Estimated memory consumption patterns
- **Throughput**: Operations per second under various conditions
- **Error Rates**: Failure percentages and error patterns
- **Latency Percentiles**: P50, P95, P99 response time distributions

## Running the Tests

### Prerequisites
```bash
# Ensure Rust toolchain is installed
rustup install stable

# Install test dependencies
cargo build --tests
```

### Running All Performance Tests
```bash
# Run all performance benchmarking tests
cargo test --test performance_benchmarking_comprehensive -- --nocapture

# Run all load testing tests
cargo test --test load_testing_comprehensive -- --nocapture
```

### Running Specific Test Categories
```bash
# Response time benchmarking
cargo test test_response_time_benchmarking -- --nocapture

# Throughput and concurrency tests
cargo test test_throughput_and_concurrent_processing -- --nocapture

# Resource utilization tests
cargo test test_resource_utilization_monitoring -- --nocapture

# Critical calculation latency tests
cargo test test_latency_testing_for_critical_calculations -- --nocapture

# Scalability tests
cargo test test_scalability_with_increasing_portfolio_sizes -- --nocapture

# Stability tests
cargo test test_long_running_stability -- --nocapture

# Load testing scenarios
cargo test test_light_load_performance -- --nocapture
cargo test test_moderate_load_performance -- --nocapture
cargo test test_heavy_load_performance -- --nocapture
cargo test test_spike_load_performance -- --nocapture
cargo test test_sustained_load_with_gradual_increase -- --nocapture
```

### Performance Benchmarking Only
```bash
# Run performance metrics collection test
cargo test test_performance_metrics_collection_and_reporting -- --nocapture
```

## Test Configuration

### Environment Variables
```bash
# Test configuration
export AEGIS_TEST_MODE=performance
export AEGIS_TEST_TIMEOUT=600  # 10 minutes for long tests
export AEGIS_LOG_LEVEL=info

# Performance test parameters
export PERF_TEST_POSITION_COUNT=1000
export PERF_TEST_CONCURRENT_USERS=50
export PERF_TEST_DURATION_SECS=60
```

### Mock Provider Configuration
The performance tests use optimized mock providers with configurable parameters:

```rust
// Price feed provider settings
let price_feed = HighPerformanceMockPriceFeedProvider::new(
    latency_ms: 5,     // Simulated network latency
    failure_rate: 0.01 // 1% failure rate
);

// Trade executor settings  
let trade_executor = HighPerformanceMockTradeExecutor::new(
    latency_ms: 10,    // Simulated execution latency
    failure_rate: 0.02 // 2% failure rate
);
```

## Performance Analysis and Reporting

### Automated Performance Analysis

The test suite automatically analyzes performance and provides recommendations:

```
PERFORMANCE ANALYSIS:
✓ Health calculations are EXCELLENT (avg 45,234 μs)
✓ Price feed throughput is GOOD (67.8 ops/sec)
⚠ Alert system reliability needs attention (89.5%)

RECOMMENDATIONS:
- Consider optimizing health factor calculation algorithms
- Implement price feed request batching or caching
- Review alert system error handling and retry logic
```

### Performance Grades:
- **EXCELLENT**: Exceeds performance targets significantly
- **GOOD**: Meets performance requirements with margin
- **NEEDS ATTENTION**: Below target, requires optimization

### Key Performance Indicators:

1. **Health Calculation Performance**:
   - Excellent: < 50ms average
   - Good: < 100ms average
   - Needs optimization: > 100ms average

2. **Price Feed Throughput**:
   - Excellent: > 100 ops/sec
   - Good: > 50 ops/sec  
   - Needs improvement: < 50 ops/sec

3. **System Reliability**:
   - Excellent: > 99% success rate
   - Good: > 95% success rate
   - Needs attention: < 95% success rate

## Continuous Integration Integration

### CI Test Pipeline Configuration
```yaml
test_performance:
  script:
    - cargo test --test performance_benchmarking_comprehensive --release
    - cargo test --test load_testing_comprehensive --release
  timeout: 15m
  artifacts:
    reports:
      - performance_report.json
    paths:
      - target/criterion/
```

### Performance Regression Detection
- Baseline performance metrics storage
- Automated performance trend analysis
- Alert generation for performance regressions

## Troubleshooting

### Common Performance Issues

1. **High Latency**:
   - Check mock provider latency settings
   - Verify async operation efficiency
   - Review concurrent operation limits

2. **Low Throughput**:
   - Increase concurrent operation limits
   - Optimize batch processing
   - Check for synchronous bottlenecks

3. **Memory Growth**:
   - Check for resource leaks in long-running tests
   - Verify proper cleanup procedures
   - Monitor position creation/deletion balance

4. **High Error Rates**:
   - Reduce mock failure rates for baseline testing
   - Check timeout configurations
   - Verify proper error handling

### Debug Configuration
```bash
# Enable detailed performance logging
AEGIS_LOG_LEVEL=debug cargo test test_performance_metrics_collection_and_reporting -- --nocapture

# Run single performance test with full output
cargo test test_response_time_benchmarking -- --exact --nocapture

# Extended timeout for debugging
cargo test --test performance_benchmarking_comprehensive -- --nocapture --test-threads=1
```

## Best Practices

### Test Design Principles

1. **Realistic Scenarios**: Use data patterns that reflect real-world usage
2. **Comprehensive Coverage**: Test both happy paths and edge cases
3. **Performance Baselines**: Establish clear performance expectations
4. **Resource Monitoring**: Track memory, CPU, and network usage
5. **Regression Prevention**: Detect performance degradation over time

### Mock Implementation Guidelines

1. **Configurable Parameters**: Allow adjustment of latency and failure rates
2. **Realistic Behavior**: Simulate actual service characteristics
3. **Performance Simulation**: Include realistic timing patterns
4. **Resource Tracking**: Monitor mock service usage patterns
5. **Statistical Accuracy**: Provide consistent, reproducible results

### Performance Testing Strategy

1. **Baseline Establishment**: Create performance baselines for comparison
2. **Load Progression**: Test increasing load levels systematically
3. **Stability Validation**: Verify performance consistency over time
4. **Resource Efficiency**: Monitor and optimize resource utilization
5. **Scalability Planning**: Test performance at expected production scales

## Contributing

### Adding New Performance Tests

1. Follow existing test structure and naming conventions
2. Use provided mock infrastructure and utilities
3. Include comprehensive performance assertions
4. Add proper performance metric collection
5. Document expected performance characteristics

### Performance Test Guidelines

1. **Clear Objectives**: Define specific performance goals
2. **Realistic Conditions**: Use production-like test conditions
3. **Comprehensive Metrics**: Collect relevant performance data
4. **Threshold Validation**: Include performance requirement assertions
5. **Trend Analysis**: Track performance changes over time

---

_This performance benchmarking suite ensures the Aegis Satellite maintains optimal performance characteristics under various operational conditions, providing confidence in system scalability and reliability._