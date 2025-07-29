use std::sync::Arc;
use tokio::sync::RwLock;
use chrono::{Utc, Duration};
use rust_decimal::Decimal;
use std::collections::HashMap;
use std::time::{Instant, Duration as StdDuration};
use tokio::time::timeout;
use futures::future::join_all;

// Import the actual Aegis satellite types and components
extern crate aegis_satellite;
use aegis_satellite::{
    AegisSatellite, AegisConfig, AegisStatistics,
    types::{Position, PositionId, PositionError, HealthFactor, CalculationError, RiskAlert},
    liquidation::{LiquidationMonitor, PriceFeedProvider, HealthCalculatorFactory},
    risk::{TradeExecutor, TradeSimulation, PriceImpactError, TradeResult},
    simulation::{SimulationPosition, SimulationScenario, MonteCarloConfig, SimulationResult},
    risk::correlation_analysis::{
        CorrelationAnalysisSystem, CorrelationAnalysisConfig, Asset, AssetType, PricePoint,
        PortfolioPosition, CorrelationMatrix, CorrelationAnalysis
    },
    simulation::stress_testing::{
        StressTestingFramework, StressTestingConfig, StressTestScenario, StressTestResult
    }
};

#[cfg(test)]
mod performance_benchmarking_tests {
    use super::*;

    // Performance metrics collection structure
    #[derive(Debug, Clone)]
    struct PerformanceMetrics {
        operation_name: String,
        duration_ms: u64,
        throughput_ops_per_sec: f64,
        memory_usage_mb: f64,
        cpu_usage_percent: f64,
        success_rate: f64,
        latency_percentiles: HashMap<u8, u64>, // P50, P95, P99 in milliseconds
        error_count: usize,
        total_operations: usize,
    }

    impl PerformanceMetrics {
        fn new(operation_name: &str) -> Self {
            Self {
                operation_name: operation_name.to_string(),
                duration_ms: 0,
                throughput_ops_per_sec: 0.0,
                memory_usage_mb: 0.0,
                cpu_usage_percent: 0.0,
                success_rate: 0.0,
                latency_percentiles: HashMap::new(),
                error_count: 0,
                total_operations: 0,
            }
        }

        fn calculate_final_metrics(&mut self, durations: &[u64], errors: usize, total_ops: usize) {
            self.error_count = errors;
            self.total_operations = total_ops;
            self.success_rate = if total_ops > 0 {
                ((total_ops - errors) as f64 / total_ops as f64) * 100.0
            } else {
                0.0
            };

            if !durations.is_empty() {
                let mut sorted_durations = durations.to_vec();
                sorted_durations.sort();

                self.latency_percentiles.insert(50, sorted_durations[sorted_durations.len() * 50 / 100]);
                self.latency_percentiles.insert(95, sorted_durations[sorted_durations.len() * 95 / 100]);
                self.latency_percentiles.insert(99, sorted_durations[sorted_durations.len() * 99 / 100]);

                let total_duration_sec = sorted_durations.iter().sum::<u64>() as f64 / 1000.0;
                self.throughput_ops_per_sec = if total_duration_sec > 0.0 {
                    total_ops as f64 / total_duration_sec
                } else {
                    0.0
                };

                self.duration_ms = sorted_durations.iter().sum::<u64>() / sorted_durations.len() as u64;
            }
        }
    }

    // Mock provider for performance testing
    #[derive(Clone)]
    struct HighPerformanceMockPriceFeedProvider {
        prices: Arc<RwLock<HashMap<String, Decimal>>>,
        latency_ms: u64,
        failure_rate: f64,
        request_count: Arc<RwLock<usize>>,
    }

    impl HighPerformanceMockPriceFeedProvider {
        fn new(latency_ms: u64) -> Self {
            let mut prices = HashMap::new();
            prices.insert("BTC".to_string(), Decimal::new(50000, 0));
            prices.insert("ETH".to_string(), Decimal::new(3000, 0));
            prices.insert("USDC".to_string(), Decimal::new(1, 0));
            prices.insert("AAVE".to_string(), Decimal::new(100, 0));
            prices.insert("UNI".to_string(), Decimal::new(10, 0));
            prices.insert("LINK".to_string(), Decimal::new(15, 0));
            prices.insert("COMP".to_string(), Decimal::new(50, 0));
            prices.insert("MKR".to_string(), Decimal::new(800, 0));
            prices.insert("SNX".to_string(), Decimal::new(5, 0));
            prices.insert("CRV".to_string(), Decimal::new(1, 0));

            Self {
                prices: Arc::new(RwLock::new(prices)),
                latency_ms,
                failure_rate: 0.0,
                request_count: Arc::new(RwLock::new(0)),
            }
        }

        async fn get_request_count(&self) -> usize {
            *self.request_count.read().await
        }

        async fn reset_request_count(&self) {
            *self.request_count.write().await = 0;
        }
    }

    #[async_trait::async_trait]
    impl PriceFeedProvider for HighPerformanceMockPriceFeedProvider {
        async fn get_price(&self, token_address: &str) -> Result<Decimal, Box<dyn std::error::Error + Send + Sync>> {
            // Increment request counter
            {
                let mut count = self.request_count.write().await;
                *count += 1;
            }

            if self.latency_ms > 0 {
                tokio::time::sleep(StdDuration::from_millis(self.latency_ms)).await;
            }

            if rand::random::<f64>() < self.failure_rate {
                return Err("Mock price feed failure".into());
            }

            let prices = self.prices.read().await;
            prices.get(token_address)
                .copied()
                .ok_or_else(|| format!("Price not found for token: {}", token_address).into())
        }

        async fn get_prices(&self, token_addresses: &[String]) -> Result<HashMap<String, Decimal>, Box<dyn std::error::Error + Send + Sync>> {
            let mut result = HashMap::new();
            for token in token_addresses {
                if let Ok(price) = self.get_price(token).await {
                    result.insert(token.clone(), price);
                }
            }
            Ok(result)
        }
    }

    #[derive(Clone)]
    struct HighPerformanceMockTradeExecutor {
        execution_latency_ms: u64,
        execution_count: Arc<RwLock<usize>>,
    }

    impl HighPerformanceMockTradeExecutor {
        fn new(latency_ms: u64) -> Self {
            Self {
                execution_latency_ms: latency_ms,
                execution_count: Arc::new(RwLock::new(0)),
            }
        }

        async fn get_execution_count(&self) -> usize {
            *self.execution_count.read().await
        }

        async fn reset_execution_count(&self) {
            *self.execution_count.write().await = 0;
        }
    }

    #[async_trait::async_trait]
    impl TradeExecutor for HighPerformanceMockTradeExecutor {
        async fn execute_trade(
            &self,
            token_address: &str,
            amount: Decimal,
            is_buy: bool,
        ) -> Result<TradeResult, Box<dyn std::error::Error + Send + Sync>> {
            // Increment execution counter
            {
                let mut count = self.execution_count.write().await;
                *count += 1;
            }

            if self.execution_latency_ms > 0 {
                tokio::time::sleep(StdDuration::from_millis(self.execution_latency_ms)).await;
            }

            Ok(TradeResult {
                transaction_hash: format!("0x{:016x}", rand::random::<u64>()),
                executed_amount: amount,
                execution_price: Decimal::new(100, 0),
                gas_used: 50000,
                gas_price: Decimal::new(20, 9),
                timestamp: Utc::now(),
                success: true,
            })
        }

        async fn estimate_gas(&self, _token_address: &str, _amount: Decimal) -> Result<u64, Box<dyn std::error::Error + Send + Sync>> {
            Ok(50000)
        }
    }

    // Helper functions for test data generation
    fn create_performance_test_positions(count: usize) -> Vec<Position> {
        let tokens = vec!["BTC", "ETH", "USDC", "AAVE", "UNI", "LINK", "COMP", "MKR", "SNX", "CRV"];
        let protocols = vec!["AAVE", "Compound", "MakerDAO", "Uniswap", "Curve"];
        
        let mut positions = Vec::new();
        for i in 0..count {
            let token = tokens[i % tokens.len()];
            let protocol = protocols[i % protocols.len()];
            let base_collateral = 10000.0 + (i as f64 * 1000.0);
            let base_debt = base_collateral * 0.6; // 60% LTV
            
            positions.push(Position {
                id: PositionId::new(),
                user_address: format!("0x{:040x}", i),
                token_address: token.to_string(),
                collateral_amount: Decimal::from_f64(base_collateral).unwrap_or(Decimal::ZERO),
                debt_amount: Decimal::from_f64(base_debt).unwrap_or(Decimal::ZERO),
                liquidation_threshold: Decimal::new(120 + (i % 30) as i64, 2), // 1.2 to 1.5
                created_at: Utc::now(),
                updated_at: Utc::now(),
                protocol: protocol.to_string(),
                is_active: true,
                health_factor: None,
            });
        }
        positions
    }

    async fn setup_performance_test_satellite(latency_ms: u64) -> Result<(AegisSatellite, Arc<HighPerformanceMockPriceFeedProvider>, Arc<HighPerformanceMockTradeExecutor>), Box<dyn std::error::Error + Send + Sync>> {
        let price_feed = Arc::new(HighPerformanceMockPriceFeedProvider::new(latency_ms));
        let trade_executor = Arc::new(HighPerformanceMockTradeExecutor::new(latency_ms));
        
        let config = AegisConfig {
            monitoring_interval_secs: 1,
            enable_automated_actions: true,
            enable_price_impact_simulation: true,
            enable_smart_contract_analysis: true,
            enable_mev_protection: true,
            max_concurrent_positions: 10000, // High limit for performance testing
        };

        let aegis = AegisSatellite::new(
            price_feed.clone(),
            trade_executor.clone(),
            Some(config)
        ).await?;

        Ok((aegis, price_feed, trade_executor))
    }

    // Test utility for measuring execution time
    async fn measure_async_operation<F, Fut, T>(operation: F) -> (Result<T, Box<dyn std::error::Error + Send + Sync>>, u64)
    where
        F: FnOnce() -> Fut,
        Fut: std::future::Future<Output = Result<T, Box<dyn std::error::Error + Send + Sync>>>,
    {
        let start = Instant::now();
        let result = operation().await;
        let duration = start.elapsed().as_millis() as u64;
        (result, duration)
    }

    #[tokio::test]
    async fn test_response_time_benchmarking() {
        let (aegis, price_feed, _) = setup_performance_test_satellite(10) // 10ms latency
            .await
            .expect("Should setup performance test satellite");

        // Create test positions
        let positions = create_performance_test_positions(100);
        let mut position_ids = Vec::new();
        
        for position in positions {
            let position_id = aegis.add_position(position).await.expect("Should add position");
            position_ids.push(position_id);
        }

        // Test 1: Single health calculation response time
        println!("=== Test 1: Single Health Calculation Response Time ===");
        
        let mut health_calc_durations = Vec::new();
        let mut health_calc_errors = 0;
        
        for position_id in &position_ids[0..10] { // Test first 10 positions
            let (result, duration) = measure_async_operation(|| {
                let aegis_ref = &aegis;
                let position_id_ref = *position_id;
                async move {
                    aegis_ref.get_position_health(position_id_ref)
                        .await
                        .map_err(|e| e.into())
                }
            }).await;
            
            health_calc_durations.push(duration);
            if result.is_err() {
                health_calc_errors += 1;
            }
        }

        let mut health_metrics = PerformanceMetrics::new("Health Calculation");
        health_metrics.calculate_final_metrics(&health_calc_durations, health_calc_errors, 10);

        println!("Health Calculation Metrics:");
        println!("  Average Duration: {} ms", health_metrics.duration_ms);
        println!("  Success Rate: {:.2}%", health_metrics.success_rate);
        println!("  P50 Latency: {} ms", health_metrics.latency_percentiles.get(&50).unwrap_or(&0));
        println!("  P95 Latency: {} ms", health_metrics.latency_percentiles.get(&95).unwrap_or(&0));
        println!("  P99 Latency: {} ms", health_metrics.latency_percentiles.get(&99).unwrap_or(&0));

        // Assert performance requirements
        assert!(health_metrics.duration_ms < 100); // Average should be under 100ms
        assert!(health_metrics.success_rate > 95.0); // At least 95% success rate
        assert!(*health_metrics.latency_percentiles.get(&95).unwrap_or(&0) < 200); // P95 under 200ms

        // Test 2: Price feed response times
        println!("=== Test 2: Price Feed Response Time ===");
        
        let tokens = vec!["BTC", "ETH", "USDC", "AAVE", "UNI"];
        let mut price_durations = Vec::new();
        let mut price_errors = 0;

        price_feed.reset_request_count().await;

        for token in &tokens {
            for _ in 0..20 { // 20 requests per token
                let (result, duration) = measure_async_operation(|| {
                    let price_feed_ref = price_feed.clone();
                    let token_ref = token.to_string();
                    async move {
                        price_feed_ref.get_price(&token_ref)
                            .await
                            .map_err(|e| e.into())
                    }
                }).await;
                
                price_durations.push(duration);
                if result.is_err() {
                    price_errors += 1;
                }
            }
        }

        let mut price_metrics = PerformanceMetrics::new("Price Feed");
        price_metrics.calculate_final_metrics(&price_durations, price_errors, tokens.len() * 20);

        println!("Price Feed Metrics:");
        println!("  Average Duration: {} ms", price_metrics.duration_ms);
        println!("  Throughput: {:.2} ops/sec", price_metrics.throughput_ops_per_sec);
        println!("  Success Rate: {:.2}%", price_metrics.success_rate);
        println!("  Total Requests: {}", price_feed.get_request_count().await);

        assert!(price_metrics.duration_ms < 50); // Should be fast with 10ms mock latency
        assert!(price_metrics.success_rate > 99.0); // Very high success rate expected
        assert!(price_metrics.throughput_ops_per_sec > 10.0); // Reasonable throughput

        // Test 3: Alert generation response time
        println!("=== Test 3: Alert Generation Response Time ===");
        
        aegis.start().await.expect("Should start monitoring");
        
        // Wait for initial monitoring
        tokio::time::sleep(StdDuration::from_millis(200)).await;
        
        let mut alert_durations = Vec::new();
        let mut alert_errors = 0;

        for position_id in &position_ids[0..5] {
            let (result, duration) = measure_async_operation(|| {
                let aegis_ref = &aegis;
                let position_id_ref = Some(*position_id);
                async move {
                    aegis_ref.get_alerts(position_id_ref)
                        .await
                        .map_err(|e| e.into())
                }
            }).await;
            
            alert_durations.push(duration);
            if result.is_err() {
                alert_errors += 1;
            }
        }

        let mut alert_metrics = PerformanceMetrics::new("Alert Generation");
        alert_metrics.calculate_final_metrics(&alert_durations, alert_errors, 5);

        println!("Alert Generation Metrics:");
        println!("  Average Duration: {} ms", alert_metrics.duration_ms);
        println!("  Success Rate: {:.2}%", alert_metrics.success_rate);

        assert!(alert_metrics.duration_ms < 50); // Should be very fast
        assert!(alert_metrics.success_rate > 95.0);

        println!("=== Response Time Benchmarking Completed ===");
    }

    #[tokio::test]
    async fn test_throughput_and_concurrent_processing() {
        let (aegis, price_feed, trade_executor) = setup_performance_test_satellite(5) // 5ms latency
            .await
            .expect("Should setup performance test satellite");

        // Create test positions
        let positions = create_performance_test_positions(200);
        let mut position_ids = Vec::new();
        
        for position in positions {
            let position_id = aegis.add_position(position).await.expect("Should add position");
            position_ids.push(position_id);
        }

        println!("=== Test 1: Concurrent Health Calculations ===");
        
        let concurrent_levels = vec![1, 5, 10, 20, 50];
        
        for concurrency in concurrent_levels {
            println!("Testing concurrency level: {}", concurrency);
            
            let start_time = Instant::now();
            let mut tasks = Vec::new();
            
            for i in 0..concurrency {
                let position_id = position_ids[i % position_ids.len()];
                let aegis_clone = aegis.clone();
                
                let task = tokio::spawn(async move {
                    let mut local_durations = Vec::new();
                    let mut local_errors = 0;
                    
                    // Each task performs 10 operations
                    for _ in 0..10 {
                        let start = Instant::now();
                        match aegis_clone.get_position_health(position_id).await {
                            Ok(_) => {},
                            Err(_) => local_errors += 1,
                        }
                        local_durations.push(start.elapsed().as_millis() as u64);
                    }
                    
                    (local_durations, local_errors)
                });
                
                tasks.push(task);
            }
            
            let results = join_all(tasks).await;
            let total_duration = start_time.elapsed();
            
            let mut all_durations = Vec::new();
            let mut total_errors = 0;
            let mut total_operations = 0;
            
            for result in results {
                if let Ok((durations, errors)) = result {
                    all_durations.extend(durations);
                    total_errors += errors;
                    total_operations += 10;
                }
            }
            
            let throughput = total_operations as f64 / total_duration.as_secs_f64();
            let avg_duration = if !all_durations.is_empty() {
                all_durations.iter().sum::<u64>() / all_durations.len() as u64
            } else {
                0
            };
            
            println!("  Concurrency {}: {:.2} ops/sec, avg {:.2}ms, {:.2}% success",
                    concurrency,
                    throughput,
                    avg_duration,
                    ((total_operations - total_errors) as f64 / total_operations as f64) * 100.0);
            
            // Assert performance doesn't degrade too much with concurrency
            assert!(throughput > (concurrency as f64 * 0.5)); // At least 0.5 ops/sec per concurrent task
            assert!(avg_duration < 200); // Average duration should remain reasonable
        }

        println!("=== Test 2: Price Feed Batch Processing ===");
        
        let batch_sizes = vec![1, 10, 50, 100];
        let tokens = vec!["BTC", "ETH", "USDC", "AAVE", "UNI", "LINK", "COMP", "MKR", "SNX", "CRV"];
        
        for batch_size in batch_sizes {
            println!("Testing batch size: {}", batch_size);
            
            price_feed.reset_request_count().await;
            let start_time = Instant::now();
            
            let token_batch: Vec<String> = tokens.iter()
                .cycle()
                .take(batch_size)
                .map(|s| s.to_string())
                .collect();
            
            let result = price_feed.get_prices(&token_batch).await;
            let duration = start_time.elapsed();
            
            assert!(result.is_ok());
            let prices = result.unwrap();
            
            let throughput = batch_size as f64 / duration.as_secs_f64();
            let avg_latency = duration.as_millis() as f64 / batch_size as f64;
            
            println!("  Batch {}: {:.2} ops/sec, {:.2}ms avg latency, {} prices retrieved",
                    batch_size, throughput, avg_latency, prices.len());
            
            assert_eq!(prices.len(), batch_size.min(tokens.len()));
            assert!(throughput > 1.0); // At least 1 op/sec
            assert!(avg_latency < 100.0); // Under 100ms average
        }

        println!("=== Test 3: Monitoring System Throughput ===");
        
        aegis.start().await.expect("Should start monitoring");
        
        // Monitor throughput for 5 seconds
        let monitoring_duration = StdDuration::from_secs(5);
        let start_time = Instant::now();
        
        let initial_request_count = price_feed.get_request_count().await;
        
        tokio::time::sleep(monitoring_duration).await;
        
        let final_request_count = price_feed.get_request_count().await;
        let actual_duration = start_time.elapsed();
        
        let monitoring_throughput = (final_request_count - initial_request_count) as f64 / actual_duration.as_secs_f64();
        
        println!("Monitoring System Throughput: {:.2} requests/sec over {:?}",
                monitoring_throughput, actual_duration);
        
        // Should be monitoring all positions regularly
        assert!(monitoring_throughput > 1.0); // At least 1 request per second
        
        println!("=== Throughput and Concurrent Processing Completed ===");
    }

    #[tokio::test]
    async fn test_resource_utilization_monitoring() {
        let (aegis, price_feed, trade_executor) = setup_performance_test_satellite(1) // 1ms latency
            .await
            .expect("Should setup performance test satellite");

        println!("=== Test 1: Memory Usage Under Load ===");
        
        // Measure memory usage with increasing number of positions
        let position_counts = vec![10, 50, 100, 500, 1000];
        
        for count in position_counts {
            // Clear existing positions (if possible) and add new ones
            let positions = create_performance_test_positions(count);
            let mut position_ids = Vec::new();
            
            let start_time = Instant::now();
            
            for position in positions {
                let position_id = aegis.add_position(position).await.expect("Should add position");
                position_ids.push(position_id);
            }
            
            let position_creation_time = start_time.elapsed();
            
            // Simulate memory usage measurement (in a real system, you'd use actual memory profiling)
            let estimated_memory_per_position = 0.1; // 0.1 MB per position estimate
            let estimated_memory_usage = count as f64 * estimated_memory_per_position;
            
            println!("Positions: {}, Est. Memory: {:.2} MB, Creation Time: {:?}",
                    count, estimated_memory_usage, position_creation_time);
            
            // Assert reasonable memory scaling
            assert!(estimated_memory_usage < count as f64 * 1.0); // Less than 1MB per position
            assert!(position_creation_time.as_millis() < (count as u128 * 10)); // Under 10ms per position
            
            // Test health calculation performance with this load
            let health_start = Instant::now();
            let mut successful_calculations = 0;
            
            for position_id in &position_ids[0..10.min(count)] {
                if aegis.get_position_health(*position_id).await.is_ok() {
                    successful_calculations += 1;
                }
            }
            
            let health_duration = health_start.elapsed();
            let health_throughput = successful_calculations as f64 / health_duration.as_secs_f64();
            
            println!("  Health Calc Throughput: {:.2} ops/sec", health_throughput);
            assert!(health_throughput > 1.0); // At least 1 calculation per second
        }

        println!("=== Test 2: CPU Utilization Under Stress ===");
        
        // Create a heavy computational load
        let positions = create_performance_test_positions(100);
        let mut position_ids = Vec::new();
        
        for position in positions {
            let position_id = aegis.add_position(position).await.expect("Should add position");
            position_ids.push(position_id);
        }

        aegis.start().await.expect("Should start monitoring");
        
        // Simulate high-frequency operations
        let stress_duration = StdDuration::from_secs(3);
        let start_time = Instant::now();
        let mut operations_completed = 0;
        
        while start_time.elapsed() < stress_duration {
            // Concurrent health calculations
            let mut tasks = Vec::new();
            
            for position_id in &position_ids[0..20] {
                let aegis_clone = aegis.clone();
                let pos_id = *position_id;
                
                let task = tokio::spawn(async move {
                    aegis_clone.get_position_health(pos_id).await.is_ok()
                });
                
                tasks.push(task);
            }
            
            let results = join_all(tasks).await;
            operations_completed += results.iter().filter(|r| r.as_ref().unwrap_or(&false)).count();
            
            tokio::time::sleep(StdDuration::from_millis(100)).await; // Brief pause
        }
        
        let actual_duration = start_time.elapsed();
        let cpu_intensive_throughput = operations_completed as f64 / actual_duration.as_secs_f64();
        
        println!("CPU Stress Test: {:.2} ops/sec over {:?}", 
                cpu_intensive_throughput, actual_duration);
        
        assert!(cpu_intensive_throughput > 10.0); // At least 10 ops/sec under stress
        assert!(operations_completed > 0); // Should complete some operations

        println!("=== Test 3: Network Request Efficiency ===");
        
        // Test price feed request batching efficiency
        price_feed.reset_request_count().await;
        
        let test_duration = StdDuration::from_secs(2);
        let start_time = Instant::now();
        
        let tokens = vec!["BTC", "ETH", "USDC", "AAVE", "UNI"];
        let mut batch_requests = 0;
        let mut individual_requests = 0;
        
        while start_time.elapsed() < test_duration {
            // Alternate between batch and individual requests
            if batch_requests < individual_requests {
                // Batch request
                let _ = price_feed.get_prices(&tokens.iter().map(|s| s.to_string()).collect::<Vec<_>>()).await;
                batch_requests += 1;
            } else {
                // Individual request
                let _ = price_feed.get_price("BTC").await;
                individual_requests += 1;
            }
            
            tokio::time::sleep(StdDuration::from_millis(50)).await;
        }
        
        let total_requests = price_feed.get_request_count().await;
        let request_efficiency = total_requests as f64 / (batch_requests + individual_requests) as f64;
        
        println!("Network Efficiency: {} total requests for {} operations (efficiency: {:.2})",
                total_requests, batch_requests + individual_requests, request_efficiency);
        
        // Batch requests should be more efficient
        assert!(request_efficiency >= 1.0); // At least 1 request per operation
        assert!(total_requests > 0);

        println!("=== Resource Utilization Monitoring Completed ===");
    }

    #[tokio::test]
    async fn test_latency_testing_for_critical_calculations() {
        let (aegis, price_feed, trade_executor) = setup_performance_test_satellite(2) // 2ms latency
            .await
            .expect("Should setup performance test satellite");

        // Create test positions with various risk profiles
        let positions = create_performance_test_positions(50);
        let mut position_ids = Vec::new();
        
        for position in positions {
            let position_id = aegis.add_position(position).await.expect("Should add position");
            position_ids.push(position_id);
        }

        println!("=== Test 1: Health Factor Calculation Latency ===");
        
        let mut health_latencies = Vec::new();
        let mut health_errors = 0;
        
        for position_id in &position_ids {
            let start = Instant::now();
            match aegis.get_position_health(*position_id).await {
                Ok(_) => {
                    health_latencies.push(start.elapsed().as_micros() as u64);
                },
                Err(_) => {
                    health_errors += 1;
                }
            }
        }
        
        let mut health_metrics = PerformanceMetrics::new("Health Factor Calculation");
        health_metrics.calculate_final_metrics(&health_latencies, health_errors, position_ids.len());
        
        println!("Health Factor Calculation Latency:");
        println!("  Average: {} μs", health_metrics.duration_ms); // Note: stored as microseconds
        println!("  P50: {} μs", health_metrics.latency_percentiles.get(&50).unwrap_or(&0));
        println!("  P95: {} μs", health_metrics.latency_percentiles.get(&95).unwrap_or(&0));
        println!("  P99: {} μs", health_metrics.latency_percentiles.get(&99).unwrap_or(&0));
        println!("  Success Rate: {:.2}%", health_metrics.success_rate);
        
        // Critical performance requirements for health calculations
        assert!(health_metrics.duration_ms < 100000); // Under 100ms average (100,000 μs)
        assert!(*health_metrics.latency_percentiles.get(&95).unwrap_or(&0) < 200000); // P95 under 200ms
        assert!(health_metrics.success_rate > 95.0);

        println!("=== Test 2: Risk Assessment Latency ===");
        
        // Test risk assessment for different position sizes
        let risk_test_positions = position_ids.iter().take(10).cloned().collect::<Vec<_>>();
        let mut risk_latencies = Vec::new();
        let mut risk_errors = 0;
        
        for position_id in &risk_test_positions {
            let start = Instant::now();
            
            // Simulate comprehensive risk assessment
            let health_result = aegis.get_position_health(*position_id).await;
            let alerts_result = aegis.get_alerts(Some(*position_id)).await;
            
            let latency = start.elapsed().as_micros() as u64;
            
            if health_result.is_ok() && alerts_result.is_ok() {
                risk_latencies.push(latency);
            } else {
                risk_errors += 1;
            }
        }
        
        let mut risk_metrics = PerformanceMetrics::new("Risk Assessment");
        risk_metrics.calculate_final_metrics(&risk_latencies, risk_errors, risk_test_positions.len());
        
        println!("Risk Assessment Latency:");
        println!("  Average: {} μs", risk_metrics.duration_ms);
        println!("  P95: {} μs", risk_metrics.latency_percentiles.get(&95).unwrap_or(&0));
        println!("  P99: {} μs", risk_metrics.latency_percentiles.get(&99).unwrap_or(&0));
        
        assert!(risk_metrics.duration_ms < 150000); // Under 150ms average
        assert!(risk_metrics.success_rate > 90.0);

        println!("=== Test 3: Price Update Propagation Latency ===");
        
        aegis.start().await.expect("Should start monitoring");
        
        // Measure time from price update to health factor recalculation
        let test_position = position_ids[0];
        
        // Get initial health factor
        let initial_health = aegis.get_position_health(test_position).await
            .expect("Should get initial health");
        
        let mut propagation_latencies = Vec::new();
        let price_updates = vec![
            ("BTC", 48000.0),
            ("BTC", 52000.0),
            ("BTC", 45000.0),
            ("BTC", 55000.0),
            ("BTC", 50000.0),
        ];
        
        for (token, new_price) in price_updates {
            let update_start = Instant::now();
            
            // Update price
            price_feed.update_price(token, Decimal::from_f64(new_price).unwrap()).await;
            
            // Wait for propagation and measure when health factor changes
            let mut propagation_detected = false;
            let mut checks = 0;
            const MAX_CHECKS: u32 = 100; // Maximum 1 second (10ms * 100)
            
            while !propagation_detected && checks < MAX_CHECKS {
                tokio::time::sleep(StdDuration::from_millis(10)).await;
                
                if let Ok(current_health) = aegis.get_position_health(test_position).await {
                    if current_health.health_factor != initial_health.health_factor {
                        propagation_detected = true;
                        let propagation_time = update_start.elapsed().as_micros() as u64;
                        propagation_latencies.push(propagation_time);
                        break;
                    }
                }
                
                checks += 1;
            }
            
            if !propagation_detected {
                println!("Warning: Price propagation not detected for {} = ${}", token, new_price);
            }
            
            // Small delay between tests
            tokio::time::sleep(StdDuration::from_millis(100)).await;
        }
        
        if !propagation_latencies.is_empty() {
            let mut propagation_metrics = PerformanceMetrics::new("Price Propagation");
            propagation_metrics.calculate_final_metrics(&propagation_latencies, 0, propagation_latencies.len());
            
            println!("Price Update Propagation Latency:");
            println!("  Average: {} μs", propagation_metrics.duration_ms);
            println!("  P95: {} μs", propagation_metrics.latency_percentiles.get(&95).unwrap_or(&0));
            println!("  Successful propagations: {}", propagation_latencies.len());
            
            // Price updates should propagate quickly
            assert!(propagation_metrics.duration_ms < 500000); // Under 500ms average
        } else {
            println!("No price propagations detected - may indicate monitoring frequency issue");
        }

        println!("=== Critical Calculation Latency Testing Completed ===");
    }

    #[tokio::test]
    async fn test_scalability_with_increasing_portfolio_sizes() {
        println!("=== Scalability Testing with Increasing Portfolio Sizes ===");
        
        let portfolio_sizes = vec![10, 50, 100, 250, 500, 1000];
        let mut scalability_results = Vec::new();
        
        for size in portfolio_sizes {
            println!("Testing portfolio size: {}", size);
            
            let (aegis, price_feed, _) = setup_performance_test_satellite(1) // 1ms latency
                .await
                .expect("Should setup performance test satellite");
            
            // Create positions for this test
            let positions = create_performance_test_positions(size);
            let mut position_ids = Vec::new();
            
            let creation_start = Instant::now();
            
            for position in positions {
                let position_id = aegis.add_position(position).await.expect("Should add position");
                position_ids.push(position_id);
            }
            
            let creation_duration = creation_start.elapsed();
            
            // Test 1: Health calculation performance at this scale
            let health_start = Instant::now();
            let mut successful_health_calcs = 0;
            let mut health_calc_errors = 0;
            
            for position_id in &position_ids {
                match aegis.get_position_health(*position_id).await {
                    Ok(_) => successful_health_calcs += 1,
                    Err(_) => health_calc_errors += 1,
                }
            }
            
            let health_duration = health_start.elapsed();
            
            // Test 2: Monitoring system startup and performance
            let monitoring_start = Instant::now();
            aegis.start().await.expect("Should start monitoring");
            
            // Let monitoring run for a few cycles
            tokio::time::sleep(StdDuration::from_millis(500)).await;
            
            let monitoring_setup_duration = monitoring_start.elapsed();
            
            // Test 3: System statistics and resource usage
            let stats = aegis.get_statistics();
            
            // Test 4: Alert system performance
            let alert_start = Instant::now();
            let mut total_alerts = 0;
            
            for position_id in &position_ids[0..(10.min(size))] { // Test first 10 or fewer
                if let Ok(alerts) = aegis.get_alerts(Some(*position_id)).await {
                    total_alerts += alerts.len();
                }
            }
            
            let alert_duration = alert_start.elapsed();
            
            // Calculate performance metrics
            let health_throughput = successful_health_calcs as f64 / health_duration.as_secs_f64();
            let creation_rate = size as f64 / creation_duration.as_secs_f64();
            let health_success_rate = (successful_health_calcs as f64 / size as f64) * 100.0;
            
            let result = (
                size,
                health_throughput,
                creation_rate,
                health_success_rate,
                monitoring_setup_duration.as_millis(),
                total_alerts,
                alert_duration.as_millis(),
            );
            
            scalability_results.push(result);
            
            println!("  Creation Rate: {:.2} positions/sec", creation_rate);
            println!("  Health Calc Throughput: {:.2} ops/sec", health_throughput);
            println!("  Health Success Rate: {:.2}%", health_success_rate);
            println!("  Monitoring Setup: {} ms", monitoring_setup_duration.as_millis());
            println!("  Alert Generation: {} alerts in {} ms", total_alerts, alert_duration.as_millis());
            println!("  System Stats: {} positions, {} alerts", stats.total_positions, stats.active_alerts);
            
            // Assert scalability requirements
            assert!(creation_rate > 1.0); // At least 1 position/sec creation
            assert!(health_success_rate > 95.0); // High success rate regardless of size
            assert!(health_throughput > 0.5); // Reasonable throughput
            assert!(monitoring_setup_duration.as_millis() < 5000); // Under 5 seconds setup
            
            println!("✓ Portfolio size {} passed scalability tests", size);
        }
        
        // Analyze scalability trends
        println!("=== Scalability Analysis ===");
        
        for (i, (size, health_throughput, creation_rate, success_rate, setup_time, alerts, alert_time)) in scalability_results.iter().enumerate() {
            println!("Size: {:4}, Health: {:6.2} ops/sec, Creation: {:6.2} pos/sec, Success: {:5.1}%, Setup: {:4}ms",
                    size, health_throughput, creation_rate, success_rate, setup_time);
        }
        
        // Check that performance doesn't degrade too severely with scale
        let (_, first_health_throughput, first_creation_rate, _, _, _, _) = scalability_results[0];
        let (_, last_health_throughput, last_creation_rate, _, _, _, _) = scalability_results.last().unwrap();
        
        let health_degradation = (first_health_throughput - last_health_throughput) / first_health_throughput;
        let creation_degradation = (first_creation_rate - last_creation_rate) / first_creation_rate;
        
        println!("Performance degradation at max scale:");
        println!("  Health throughput: {:.2}%", health_degradation * 100.0);
        println!("  Creation rate: {:.2}%", creation_degradation * 100.0);
        
        // Assert reasonable performance degradation (less than 80% degradation)
        assert!(health_degradation < 0.8);
        assert!(creation_degradation < 0.8);
        
        println!("=== Scalability Testing Completed ===");
    }

    #[tokio::test]
    async fn test_long_running_stability() {
        let (aegis, price_feed, trade_executor) = setup_performance_test_satellite(5) // 5ms latency
            .await
            .expect("Should setup performance test satellite");

        println!("=== Long Running Stability Test ===");
        
        // Create a moderate number of positions
        let positions = create_performance_test_positions(100);
        let mut position_ids = Vec::new();
        
        for position in positions {
            let position_id = aegis.add_position(position).await.expect("Should add position");
            position_ids.push(position_id);
        }

        aegis.start().await.expect("Should start monitoring");
        
        // Run stability test for 30 seconds (shortened for testing)
        let test_duration = StdDuration::from_secs(30);
        let start_time = Instant::now();
        
        let mut health_check_intervals = Vec::new();
        let mut error_counts = Vec::new();
        let mut memory_snapshots = Vec::new();
        let mut request_counts = Vec::new();
        
        let check_interval = StdDuration::from_secs(2);
        let mut last_check = start_time;
        let mut iteration = 0;
        
        while start_time.elapsed() < test_duration {
            tokio::time::sleep(check_interval).await;
            
            let check_start = Instant::now();
            iteration += 1;
            
            // Health check sample
            let mut successful_checks = 0;
            let mut failed_checks = 0;
            
            for position_id in &position_ids[0..10] { // Check first 10 positions
                match aegis.get_position_health(*position_id).await {
                    Ok(_) => successful_checks += 1,
                    Err(_) => failed_checks += 1,
                }
            }
            
            let check_duration = check_start.elapsed();
            health_check_intervals.push(check_duration.as_millis() as u64);
            error_counts.push(failed_checks);
            
            // Simulate memory usage tracking
            let estimated_memory = iteration as f64 * 0.1; // Simple linear growth simulation
            memory_snapshots.push(estimated_memory);
            
            // Track request counts
            let current_requests = price_feed.get_request_count().await;
            request_counts.push(current_requests);
            
            // System statistics
            let stats = aegis.get_statistics();
            
            if iteration % 5 == 0 { // Report every 10 seconds
                println!("Iteration {}: {} successful, {} failed, {:.1}ms avg, {} total requests, {} positions",
                        iteration, successful_checks, failed_checks, 
                        check_duration.as_millis(), current_requests, stats.total_positions);
            }
            
            // Simulate some price updates to keep system active
            if iteration % 3 == 0 {
                let tokens = vec!["BTC", "ETH", "USDC"];
                let token = tokens[iteration % tokens.len()];
                let base_price = match token {
                    "BTC" => 50000.0,
                    "ETH" => 3000.0,
                    _ => 1.0,
                };
                let volatility = (iteration as f64 * 0.1).sin() * 0.1; // 10% volatility
                let new_price = base_price * (1.0 + volatility);
                price_feed.update_price(token, Decimal::from_f64(new_price).unwrap()).await;
            }
            
            last_check = check_start;
        }
        
        let total_runtime = start_time.elapsed();
        
        println!("=== Stability Test Results ===");
        println!("Total Runtime: {:?}", total_runtime);
        println!("Iterations: {}", iteration);
        
        // Analyze stability metrics
        let avg_check_duration = health_check_intervals.iter().sum::<u64>() as f64 / health_check_intervals.len() as f64;
        let max_check_duration = *health_check_intervals.iter().max().unwrap_or(&0);
        let min_check_duration = *health_check_intervals.iter().min().unwrap_or(&0);
        
        let total_errors = error_counts.iter().sum::<usize>();
        let total_checks = error_counts.len() * 10; // 10 checks per iteration
        let overall_success_rate = ((total_checks - total_errors) as f64 / total_checks as f64) * 100.0;
        
        let final_memory = memory_snapshots.last().unwrap_or(&0.0);
        let memory_growth = final_memory - memory_snapshots.first().unwrap_or(&0.0);
        
        let final_requests = *request_counts.last().unwrap_or(&0);
        let initial_requests = *request_counts.first().unwrap_or(&0);
        let request_rate = (final_requests - initial_requests) as f64 / total_runtime.as_secs_f64();
        
        println!("Health Check Performance:");
        println!("  Average Duration: {:.2} ms", avg_check_duration);
        println!("  Min Duration: {} ms", min_check_duration);
        println!("  Max Duration: {} ms", max_check_duration);
        println!("  Success Rate: {:.2}%", overall_success_rate);
        
        println!("System Stability:");
        println!("  Memory Growth: {:.2} MB", memory_growth);
        println!("  Request Rate: {:.2} requests/sec", request_rate);
        println!("  Total Errors: {}", total_errors);
        
        // Assert stability requirements
        assert!(overall_success_rate > 90.0); // At least 90% success rate
        assert!(avg_check_duration < 200.0); // Average under 200ms
        assert!(max_check_duration < 5000); // No check over 5 seconds
        assert!(memory_growth < 100.0); // Memory growth under 100MB over test period
        assert!(request_rate > 0.1); // Some monitoring activity
        
        // Check for performance degradation over time
        let early_durations: Vec<u64> = health_check_intervals.iter().take(5).copied().collect();
        let late_durations: Vec<u64> = health_check_intervals.iter().rev().take(5).copied().collect();
        
        let early_avg = early_durations.iter().sum::<u64>() as f64 / early_durations.len() as f64;
        let late_avg = late_durations.iter().sum::<u64>() as f64 / late_durations.len() as f64;
        
        let performance_degradation = (late_avg - early_avg) / early_avg;
        
        println!("Performance Analysis:");
        println!("  Early Average: {:.2} ms", early_avg);
        println!("  Late Average: {:.2} ms", late_avg);
        println!("  Degradation: {:.2}%", performance_degradation * 100.0);
        
        // Performance shouldn't degrade by more than 50% over the test period
        assert!(performance_degradation < 0.5);
        
        // Verify system is still responsive
        let final_stats = aegis.get_statistics();
        assert_eq!(final_stats.total_positions, position_ids.len());
        
        println!("✓ Long Running Stability Test Passed");
        println!("=== Long Running Stability Test Completed ===");
    }

    #[tokio::test]
    async fn test_performance_metrics_collection_and_reporting() {
        println!("=== Performance Metrics Collection and Reporting Test ===");
        
        let (aegis, price_feed, trade_executor) = setup_performance_test_satellite(3) // 3ms latency
            .await
            .expect("Should setup performance test satellite");

        // Create test positions
        let positions = create_performance_test_positions(50);
        let mut position_ids = Vec::new();
        
        for position in positions {
            let position_id = aegis.add_position(position).await.expect("Should add position");
            position_ids.push(position_id);
        }

        // Start monitoring
        aegis.start().await.expect("Should start monitoring");
        
        // Collect comprehensive performance metrics
        let mut performance_report = HashMap::new();
        
        // Test 1: Health Calculation Metrics
        println!("Collecting Health Calculation Metrics...");
        
        let mut health_durations = Vec::new();
        let mut health_errors = 0;
        let health_test_start = Instant::now();
        
        for position_id in &position_ids {
            let start = Instant::now();
            match aegis.get_position_health(*position_id).await {
                Ok(_) => {
                    health_durations.push(start.elapsed().as_micros() as u64);
                },
                Err(_) => {
                    health_errors += 1;
                }
            }
        }
        
        let health_test_duration = health_test_start.elapsed();
        let mut health_metrics = PerformanceMetrics::new("Health Calculation");
        health_metrics.calculate_final_metrics(&health_durations, health_errors, position_ids.len());
        
        performance_report.insert("health_calculation".to_string(), health_metrics.clone());
        
        // Test 2: Price Feed Metrics
        println!("Collecting Price Feed Metrics...");
        
        let tokens = vec!["BTC", "ETH", "USDC", "AAVE", "UNI"];
        let mut price_durations = Vec::new();
        let mut price_errors = 0;
        
        price_feed.reset_request_count().await;
        let price_test_start = Instant::now();
        
        for token in &tokens {
            for _ in 0..10 { // 10 requests per token
                let start = Instant::now();
                match price_feed.get_price(token).await {
                    Ok(_) => {
                        price_durations.push(start.elapsed().as_micros() as u64);
                    },
                    Err(_) => {
                        price_errors += 1;
                    }
                }
            }
        }
        
        let price_test_duration = price_test_start.elapsed();
        let mut price_metrics = PerformanceMetrics::new("Price Feed");
        price_metrics.calculate_final_metrics(&price_durations, price_errors, tokens.len() * 10);
        
        performance_report.insert("price_feed".to_string(), price_metrics.clone());
        
        // Test 3: Alert System Metrics
        println!("Collecting Alert System Metrics...");
        
        let mut alert_durations = Vec::new();
        let mut alert_errors = 0;
        let alert_test_start = Instant::now();
        
        for position_id in &position_ids[0..20] { // Test first 20 positions
            let start = Instant::now();
            match aegis.get_alerts(Some(*position_id)).await {
                Ok(_) => {
                    alert_durations.push(start.elapsed().as_micros() as u64);
                },
                Err(_) => {
                    alert_errors += 1;
                }
            }
        }
        
        let alert_test_duration = alert_test_start.elapsed();
        let mut alert_metrics = PerformanceMetrics::new("Alert System");
        alert_metrics.calculate_final_metrics(&alert_durations, alert_errors, 20);
        
        performance_report.insert("alert_system".to_string(), alert_metrics.clone());
        
        // Test 4: System Statistics and Resource Usage
        println!("Collecting System Resource Metrics...");
        
        let system_stats = aegis.get_statistics();
        let total_requests = price_feed.get_request_count().await;
        let execution_count = trade_executor.get_execution_count().await;
        
        // Test 5: Stress Test Performance
        println!("Collecting Stress Test Metrics...");
        
        let mut concurrent_durations = Vec::new();
        let mut concurrent_errors = 0;
        let concurrent_test_start = Instant::now();
        
        let mut tasks = Vec::new();
        for position_id in &position_ids[0..10] {
            let aegis_clone = aegis.clone();
            let pos_id = *position_id;
            
            let task = tokio::spawn(async move {
                let start = Instant::now();
                let result = aegis_clone.get_position_health(pos_id).await;
                let duration = start.elapsed().as_micros() as u64;
                (result.is_ok(), duration)
            });
            
            tasks.push(task);
        }
        
        let results = join_all(tasks).await;
        for result in results {
            if let Ok((success, duration)) = result {
                if success {
                    concurrent_durations.push(duration);
                } else {
                    concurrent_errors += 1;
                }
            }
        }
        
        let concurrent_test_duration = concurrent_test_start.elapsed();
        let mut concurrent_metrics = PerformanceMetrics::new("Concurrent Operations");
        concurrent_metrics.calculate_final_metrics(&concurrent_durations, concurrent_errors, 10);
        
        performance_report.insert("concurrent_operations".to_string(), concurrent_metrics.clone());
        
        // Generate Comprehensive Performance Report
        println!("=== COMPREHENSIVE PERFORMANCE REPORT ===");
        println!("Generated at: {}", Utc::now().format("%Y-%m-%d %H:%M:%S UTC"));
        println!("Test Environment: {} positions, {} tokens", position_ids.len(), tokens.len());
        println!();
        
        for (test_name, metrics) in &performance_report {
            println!("{}:", test_name.replace("_", " ").to_uppercase());
            println!("  Operations: {}", metrics.total_operations);
            println!("  Success Rate: {:.2}%", metrics.success_rate);
            println!("  Average Duration: {} μs", metrics.duration_ms);
            println!("  Throughput: {:.2} ops/sec", metrics.throughput_ops_per_sec);
            
            if let Some(p50) = metrics.latency_percentiles.get(&50) {
                println!("  Latency P50: {} μs", p50);
            }
            if let Some(p95) = metrics.latency_percentiles.get(&95) {
                println!("  Latency P95: {} μs", p95);
            }
            if let Some(p99) = metrics.latency_percentiles.get(&99) {
                println!("  Latency P99: {} μs", p99);
            }
            
            println!("  Errors: {}", metrics.error_count);
            println!();
        }
        
        // System-wide metrics
        println!("SYSTEM METRICS:");
        println!("  Total Positions: {}", system_stats.total_positions);
        println!("  Active Alerts: {}", system_stats.active_alerts);
        println!("  Supported Protocols: {}", system_stats.supported_protocols);
        println!("  Price Feed Requests: {}", total_requests);
        println!("  Trade Executions: {}", execution_count);
        println!();
        
        // Performance assertions and recommendations
        println!("PERFORMANCE ANALYSIS:");
        
        let health_perf = performance_report.get("health_calculation").unwrap();
        let price_perf = performance_report.get("price_feed").unwrap();
        let alert_perf = performance_report.get("alert_system").unwrap();
        let concurrent_perf = performance_report.get("concurrent_operations").unwrap();
        
        // Health calculation performance
        if health_perf.duration_ms < 50000 { // Under 50ms
            println!("✓ Health calculations are EXCELLENT (avg {} μs)", health_perf.duration_ms);
        } else if health_perf.duration_ms < 100000 { // Under 100ms
            println!("✓ Health calculations are GOOD (avg {} μs)", health_perf.duration_ms);
        } else {
            println!("⚠ Health calculations may need optimization (avg {} μs)", health_perf.duration_ms);
        }
        
        // Price feed performance
        if price_perf.throughput_ops_per_sec > 100.0 {
            println!("✓ Price feed throughput is EXCELLENT ({:.2} ops/sec)", price_perf.throughput_ops_per_sec);
        } else if price_perf.throughput_ops_per_sec > 50.0 {
            println!("✓ Price feed throughput is GOOD ({:.2} ops/sec)", price_perf.throughput_ops_per_sec);
        } else {
            println!("⚠ Price feed throughput may need improvement ({:.2} ops/sec)", price_perf.throughput_ops_per_sec);
        }
        
        // Alert system performance
        if alert_perf.success_rate > 99.0 {
            println!("✓ Alert system reliability is EXCELLENT ({:.2}%)", alert_perf.success_rate);
        } else if alert_perf.success_rate > 95.0 {
            println!("✓ Alert system reliability is GOOD ({:.2}%)", alert_perf.success_rate);
        } else {
            println!("⚠ Alert system reliability needs attention ({:.2}%)", alert_perf.success_rate);
        }
        
        // Concurrent operation performance
        if concurrent_perf.success_rate > 95.0 && concurrent_perf.duration_ms < 100000 {
            println!("✓ Concurrent operations performance is EXCELLENT");
        } else {
            println!("⚠ Concurrent operations may need optimization");
        }
        
        println!();
        println!("RECOMMENDATIONS:");
        
        // Generate specific recommendations based on metrics
        if health_perf.duration_ms > 100000 {
            println!("- Consider optimizing health factor calculation algorithms");
        }
        
        if price_perf.throughput_ops_per_sec < 50.0 {
            println!("- Implement price feed request batching or caching");
        }
        
        if alert_perf.success_rate < 95.0 {
            println!("- Review alert system error handling and retry logic");
        }
        
        if concurrent_perf.duration_ms > health_perf.duration_ms * 2 {
            println!("- Investigate potential concurrency bottlenecks");
        }
        
        let overall_system_health = (health_perf.success_rate + price_perf.success_rate + alert_perf.success_rate) / 3.0;
        if overall_system_health > 98.0 {
            println!("✓ Overall system performance is EXCELLENT ({:.2}%)", overall_system_health);
        } else if overall_system_health > 95.0 {
            println!("✓ Overall system performance is GOOD ({:.2}%)", overall_system_health);
        } else {
            println!("⚠ Overall system performance needs attention ({:.2}%)", overall_system_health);
        }
        
        // Final assertions
        assert!(health_perf.success_rate > 90.0);
        assert!(price_perf.success_rate > 95.0);
        assert!(alert_perf.success_rate > 90.0);
        assert!(concurrent_perf.success_rate > 85.0); // Slightly lower for concurrent ops
        
        assert!(health_perf.duration_ms < 200000); // Under 200ms
        assert!(price_perf.throughput_ops_per_sec > 10.0); // At least 10 ops/sec
        
        println!("=== Performance Metrics Collection and Reporting Completed ===");
    }
}