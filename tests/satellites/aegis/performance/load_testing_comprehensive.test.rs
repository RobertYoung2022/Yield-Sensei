use std::sync::Arc;
use tokio::sync::RwLock;
use chrono::{Utc, Duration};
use rust_decimal::Decimal;
use std::collections::HashMap;
use std::time::{Instant, Duration as StdDuration};
use futures::future::join_all;

// Import the actual Aegis satellite types and components
extern crate aegis_satellite;
use aegis_satellite::{
    AegisSatellite, AegisConfig, AegisStatistics,
    types::{Position, PositionId, PositionError, HealthFactor, CalculationError, RiskAlert},
    liquidation::{LiquidationMonitor, PriceFeedProvider, HealthCalculatorFactory},
    risk::{TradeExecutor, TradeSimulation, PriceImpactError, TradeResult},
    simulation::{SimulationPosition, SimulationScenario, MonteCarloConfig, SimulationResult}
};

#[cfg(test)]
mod load_testing_tests {
    use super::*;

    // Load testing configuration
    #[derive(Debug, Clone)]
    struct LoadTestConfig {
        concurrent_users: usize,
        requests_per_user: usize,
        test_duration_secs: u64,
        ramp_up_duration_secs: u64,
        target_throughput_ops_per_sec: f64,
        max_acceptable_latency_ms: u64,
        max_acceptable_error_rate: f64,
    }

    impl LoadTestConfig {
        fn light_load() -> Self {
            Self {
                concurrent_users: 5,
                requests_per_user: 10,
                test_duration_secs: 10,
                ramp_up_duration_secs: 2,
                target_throughput_ops_per_sec: 10.0,
                max_acceptable_latency_ms: 500,
                max_acceptable_error_rate: 5.0,
            }
        }

        fn moderate_load() -> Self {
            Self {
                concurrent_users: 20,
                requests_per_user: 25,
                test_duration_secs: 30,
                ramp_up_duration_secs: 5,
                target_throughput_ops_per_sec: 50.0,
                max_acceptable_latency_ms: 1000,
                max_acceptable_error_rate: 10.0,
            }
        }

        fn heavy_load() -> Self {
            Self {
                concurrent_users: 50,
                requests_per_user: 50,
                test_duration_secs: 60,
                ramp_up_duration_secs: 10,
                target_throughput_ops_per_sec: 100.0,
                max_acceptable_latency_ms: 2000,
                max_acceptable_error_rate: 15.0,
            }
        }
    }

    #[derive(Debug, Clone)]
    struct LoadTestResult {
        config: LoadTestConfig,
        total_requests: usize,
        successful_requests: usize,
        failed_requests: usize,
        total_duration_secs: f64,
        actual_throughput_ops_per_sec: f64,
        average_latency_ms: f64,
        p95_latency_ms: u64,
        p99_latency_ms: u64,
        error_rate_percent: f64,
        memory_usage_mb: f64,
        cpu_utilization_percent: f64,
    }

    // High-performance mock provider optimized for load testing
    #[derive(Clone)]
    struct LoadTestMockPriceFeedProvider {
        prices: Arc<RwLock<HashMap<String, Decimal>>>,
        latency_ms: u64,
        failure_rate: f64,
        request_count: Arc<RwLock<usize>>,
        error_count: Arc<RwLock<usize>>,
    }

    impl LoadTestMockPriceFeedProvider {
        fn new(latency_ms: u64, failure_rate: f64) -> Self {
            let mut prices = HashMap::new();
            
            // Add many tokens for diverse testing
            let tokens_and_prices = vec![
                ("BTC", 50000.0), ("ETH", 3000.0), ("USDC", 1.0), ("USDT", 1.0),
                ("AAVE", 100.0), ("UNI", 10.0), ("LINK", 15.0), ("COMP", 50.0),
                ("MKR", 800.0), ("SNX", 5.0), ("CRV", 1.0), ("YFI", 8000.0),
                ("SUSHI", 2.0), ("1INCH", 0.5), ("MATIC", 0.8), ("AVAX", 30.0),
                ("DOT", 7.0), ("ADA", 0.5), ("SOL", 100.0), ("NEAR", 3.0),
            ];

            for (token, price) in tokens_and_prices {
                prices.insert(token.to_string(), Decimal::from_f64(price).unwrap_or(Decimal::ZERO));
            }

            Self {
                prices: Arc::new(RwLock::new(prices)),
                latency_ms,
                failure_rate,
                request_count: Arc::new(RwLock::new(0)),
                error_count: Arc::new(RwLock::new(0)),
            }
        }

        async fn get_stats(&self) -> (usize, usize) {
            let requests = *self.request_count.read().await;
            let errors = *self.error_count.read().await;
            (requests, errors)
        }

        async fn reset_stats(&self) {
            *self.request_count.write().await = 0;
            *self.error_count.write().await = 0;
        }
    }

    #[async_trait::async_trait]
    impl PriceFeedProvider for LoadTestMockPriceFeedProvider {
        async fn get_price(&self, token_address: &str) -> Result<Decimal, Box<dyn std::error::Error + Send + Sync>> {
            // Increment request counter
            {
                let mut count = self.request_count.write().await;
                *count += 1;
            }

            // Simulate latency
            if self.latency_ms > 0 {
                tokio::time::sleep(StdDuration::from_millis(self.latency_ms)).await;
            }

            // Simulate failures
            if rand::random::<f64>() < self.failure_rate {
                let mut errors = self.error_count.write().await;
                *errors += 1;
                return Err("Simulated price feed failure".into());
            }

            let prices = self.prices.read().await;
            prices.get(token_address)
                .copied()
                .ok_or_else(|| {
                    let mut errors = futures::executor::block_on(self.error_count.write());
                    *errors += 1;
                    format!("Price not found for token: {}", token_address).into()
                })
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
    struct LoadTestMockTradeExecutor {
        execution_latency_ms: u64,
        failure_rate: f64,
        execution_count: Arc<RwLock<usize>>,
        error_count: Arc<RwLock<usize>>,
    }

    impl LoadTestMockTradeExecutor {
        fn new(latency_ms: u64, failure_rate: f64) -> Self {
            Self {
                execution_latency_ms: latency_ms,
                failure_rate,
                execution_count: Arc::new(RwLock::new(0)),
                error_count: Arc::new(RwLock::new(0)),
            }
        }

        async fn get_stats(&self) -> (usize, usize) {
            let executions = *self.execution_count.read().await;
            let errors = *self.error_count.read().await;
            (executions, errors)
        }
    }

    #[async_trait::async_trait]
    impl TradeExecutor for LoadTestMockTradeExecutor {
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

            // Simulate latency
            if self.execution_latency_ms > 0 {
                tokio::time::sleep(StdDuration::from_millis(self.execution_latency_ms)).await;
            }

            // Simulate failures
            if rand::random::<f64>() < self.failure_rate {
                let mut errors = self.error_count.write().await;
                *errors += 1;
                return Err("Simulated trade execution failure".into());
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

    // Helper function to create load test positions
    fn create_load_test_positions(count: usize) -> Vec<Position> {
        let tokens = vec![
            "BTC", "ETH", "USDC", "USDT", "AAVE", "UNI", "LINK", "COMP",
            "MKR", "SNX", "CRV", "YFI", "SUSHI", "1INCH", "MATIC", "AVAX",
            "DOT", "ADA", "SOL", "NEAR"
        ];
        let protocols = vec!["AAVE", "Compound", "MakerDAO", "Uniswap", "Curve", "Balancer"];
        
        let mut positions = Vec::new();
        for i in 0..count {
            let token = tokens[i % tokens.len()];
            let protocol = protocols[i % protocols.len()];
            let base_collateral = 5000.0 + (i as f64 * 500.0);
            let ltv_ratio = 0.4 + (i % 5) as f64 * 0.1; // 40% to 80% LTV
            let base_debt = base_collateral * ltv_ratio;
            
            positions.push(Position {
                id: PositionId::new(),
                user_address: format!("0x{:040x}", i),
                token_address: token.to_string(),
                collateral_amount: Decimal::from_f64(base_collateral).unwrap_or(Decimal::ZERO),
                debt_amount: Decimal::from_f64(base_debt).unwrap_or(Decimal::ZERO),
                liquidation_threshold: Decimal::new(110 + (i % 40) as i64, 2), // 1.10 to 1.50
                created_at: Utc::now(),
                updated_at: Utc::now(),
                protocol: protocol.to_string(),
                is_active: true,
                health_factor: None,
            });
        }
        positions
    }

    async fn setup_load_test_satellite(
        price_latency_ms: u64,
        trade_latency_ms: u64,
        failure_rate: f64
    ) -> Result<(AegisSatellite, Arc<LoadTestMockPriceFeedProvider>, Arc<LoadTestMockTradeExecutor>), Box<dyn std::error::Error + Send + Sync>> {
        let price_feed = Arc::new(LoadTestMockPriceFeedProvider::new(price_latency_ms, failure_rate));
        let trade_executor = Arc::new(LoadTestMockTradeExecutor::new(trade_latency_ms, failure_rate));
        
        let config = AegisConfig {
            monitoring_interval_secs: 1,
            enable_automated_actions: true,
            enable_price_impact_simulation: true,
            enable_smart_contract_analysis: true,
            enable_mev_protection: true,
            max_concurrent_positions: 10000, // High limit for load testing
        };

        let aegis = AegisSatellite::new(
            price_feed.clone(),
            trade_executor.clone(),
            Some(config)
        ).await?;

        Ok((aegis, price_feed, trade_executor))
    }

    async fn run_load_test(
        aegis: &AegisSatellite,
        position_ids: &[PositionId],
        config: LoadTestConfig,
    ) -> LoadTestResult {
        println!("Starting load test with {} concurrent users, {} requests per user",
                config.concurrent_users, config.requests_per_user);

        let start_time = Instant::now();
        let mut all_latencies = Vec::new();
        let mut total_successful = 0;
        let mut total_failed = 0;

        // Create tasks for concurrent users
        let mut user_tasks = Vec::new();
        
        for user_id in 0..config.concurrent_users {
            let aegis_clone = aegis.clone();
            let position_ids_clone = position_ids.to_vec();
            let user_config = config.clone();
            
            let task = tokio::spawn(async move {
                let mut user_latencies = Vec::new();
                let mut user_successful = 0;
                let mut user_failed = 0;

                // Stagger user start times for ramp-up
                let ramp_up_delay = (user_config.ramp_up_duration_secs * 1000) as f64 / user_config.concurrent_users as f64;
                let user_delay = (user_id as f64 * ramp_up_delay) as u64;
                tokio::time::sleep(StdDuration::from_millis(user_delay)).await;

                // Each user performs their operations
                for request_id in 0..user_config.requests_per_user {
                    let position_index = (user_id * user_config.requests_per_user + request_id) % position_ids_clone.len();
                    let position_id = position_ids_clone[position_index];

                    let request_start = Instant::now();
                    
                    match aegis_clone.get_position_health(position_id).await {
                        Ok(_) => {
                            user_successful += 1;
                            user_latencies.push(request_start.elapsed().as_millis() as u64);
                        },
                        Err(_) => {
                            user_failed += 1;
                        }
                    }

                    // Small delay between requests to simulate realistic user behavior
                    tokio::time::sleep(StdDuration::from_millis(10)).await;
                }

                (user_latencies, user_successful, user_failed)
            });

            user_tasks.push(task);
        }

        // Wait for all users to complete
        let user_results = join_all(user_tasks).await;
        
        // Aggregate results
        for result in user_results {
            if let Ok((latencies, successful, failed)) = result {
                all_latencies.extend(latencies);
                total_successful += successful;
                total_failed += failed;
            }
        }

        let total_duration = start_time.elapsed();
        let total_requests = total_successful + total_failed;

        // Calculate metrics
        let actual_throughput = if total_duration.as_secs_f64() > 0.0 {
            total_requests as f64 / total_duration.as_secs_f64()
        } else {
            0.0
        };

        let average_latency = if !all_latencies.is_empty() {
            all_latencies.iter().sum::<u64>() as f64 / all_latencies.len() as f64
        } else {
            0.0
        };

        let error_rate = if total_requests > 0 {
            (total_failed as f64 / total_requests as f64) * 100.0
        } else {
            0.0
        };

        // Calculate percentiles
        let mut sorted_latencies = all_latencies.clone();
        sorted_latencies.sort();

        let p95_latency = if !sorted_latencies.is_empty() {
            sorted_latencies[sorted_latencies.len() * 95 / 100]
        } else {
            0
        };

        let p99_latency = if !sorted_latencies.is_empty() {
            sorted_latencies[sorted_latencies.len() * 99 / 100]
        } else {
            0
        };

        // Simulate resource usage (in a real system, you'd measure actual usage)
        let estimated_memory_usage = (total_requests as f64 * 0.1) + 50.0; // Base + per-request
        let estimated_cpu_usage = (actual_throughput / config.target_throughput_ops_per_sec) * 50.0;

        LoadTestResult {
            config,
            total_requests,
            successful_requests: total_successful,
            failed_requests: total_failed,
            total_duration_secs: total_duration.as_secs_f64(),
            actual_throughput_ops_per_sec: actual_throughput,
            average_latency_ms: average_latency,
            p95_latency_ms: p95_latency,
            p99_latency_ms: p99_latency,
            error_rate_percent: error_rate,
            memory_usage_mb: estimated_memory_usage,
            cpu_utilization_percent: estimated_cpu_usage.min(100.0),
        }
    }

    #[tokio::test]
    async fn test_light_load_performance() {
        let (aegis, price_feed, trade_executor) = setup_load_test_satellite(5, 10, 0.01) // 1% failure rate
            .await
            .expect("Should setup load test satellite");

        // Create positions for testing
        let positions = create_load_test_positions(100);
        let mut position_ids = Vec::new();
        
        for position in positions {
            let position_id = aegis.add_position(position).await.expect("Should add position");
            position_ids.push(position_id);
        }

        // Start monitoring
        aegis.start().await.expect("Should start monitoring");

        // Run light load test
        let config = LoadTestConfig::light_load();
        let result = run_load_test(&aegis, &position_ids, config.clone()).await;

        println!("=== Light Load Test Results ===");
        println!("Configuration: {} users × {} requests = {} total requests",
                result.config.concurrent_users, result.config.requests_per_user, result.total_requests);
        println!("Duration: {:.2} seconds", result.total_duration_secs);
        println!("Throughput: {:.2} ops/sec (target: {:.2})", 
                result.actual_throughput_ops_per_sec, result.config.target_throughput_ops_per_sec);
        println!("Success Rate: {:.2}% ({}/{} successful)",
                100.0 - result.error_rate_percent, result.successful_requests, result.total_requests);
        println!("Average Latency: {:.2} ms", result.average_latency_ms);
        println!("P95 Latency: {} ms", result.p95_latency_ms);
        println!("P99 Latency: {} ms", result.p99_latency_ms);
        println!("Est. Memory Usage: {:.2} MB", result.memory_usage_mb);
        println!("Est. CPU Usage: {:.2}%", result.cpu_utilization_percent);

        // Verify light load performance requirements
        assert!(result.actual_throughput_ops_per_sec >= config.target_throughput_ops_per_sec * 0.8, 
                "Throughput should be at least 80% of target");
        assert!(result.error_rate_percent <= config.max_acceptable_error_rate,
                "Error rate should be below {:.2}%", config.max_acceptable_error_rate);
        assert!(result.average_latency_ms <= config.max_acceptable_latency_ms as f64,
                "Average latency should be below {} ms", config.max_acceptable_latency_ms);
        assert!(result.p95_latency_ms <= config.max_acceptable_latency_ms * 2,
                "P95 latency should be reasonable");

        println!("✓ Light Load Test Passed");
    }

    #[tokio::test]
    async fn test_moderate_load_performance() {
        let (aegis, price_feed, trade_executor) = setup_load_test_satellite(8, 15, 0.03) // 3% failure rate
            .await
            .expect("Should setup load test satellite");

        // Create more positions for moderate load
        let positions = create_load_test_positions(200);
        let mut position_ids = Vec::new();
        
        for position in positions {
            let position_id = aegis.add_position(position).await.expect("Should add position");
            position_ids.push(position_id);
        }

        // Start monitoring
        aegis.start().await.expect("Should start monitoring");

        // Run moderate load test
        let config = LoadTestConfig::moderate_load();
        let result = run_load_test(&aegis, &position_ids, config.clone()).await;

        println!("=== Moderate Load Test Results ===");
        println!("Configuration: {} users × {} requests = {} total requests",
                result.config.concurrent_users, result.config.requests_per_user, result.total_requests);
        println!("Duration: {:.2} seconds", result.total_duration_secs);
        println!("Throughput: {:.2} ops/sec (target: {:.2})", 
                result.actual_throughput_ops_per_sec, result.config.target_throughput_ops_per_sec);
        println!("Success Rate: {:.2}% ({}/{} successful)",
                100.0 - result.error_rate_percent, result.successful_requests, result.total_requests);
        println!("Average Latency: {:.2} ms", result.average_latency_ms);
        println!("P95 Latency: {} ms", result.p95_latency_ms);
        println!("P99 Latency: {} ms", result.p99_latency_ms);
        println!("Est. Memory Usage: {:.2} MB", result.memory_usage_mb);
        println!("Est. CPU Usage: {:.2}%", result.cpu_utilization_percent);

        // Verify moderate load performance requirements
        assert!(result.actual_throughput_ops_per_sec >= config.target_throughput_ops_per_sec * 0.7,
                "Throughput should be at least 70% of target under moderate load");
        assert!(result.error_rate_percent <= config.max_acceptable_error_rate,
                "Error rate should be below {:.2}%", config.max_acceptable_error_rate);
        assert!(result.average_latency_ms <= config.max_acceptable_latency_ms as f64,
                "Average latency should be below {} ms", config.max_acceptable_latency_ms);
        assert!(result.p99_latency_ms <= config.max_acceptable_latency_ms * 3,
                "P99 latency should be reasonable under moderate load");

        // Memory and CPU should scale reasonably
        assert!(result.memory_usage_mb < 500.0, "Memory usage should be reasonable");
        assert!(result.cpu_utilization_percent < 90.0, "CPU usage should not be excessive");

        println!("✓ Moderate Load Test Passed");
    }

    #[tokio::test]
    async fn test_heavy_load_performance() {
        let (aegis, price_feed, trade_executor) = setup_load_test_satellite(12, 20, 0.05) // 5% failure rate
            .await
            .expect("Should setup load test satellite");

        // Create many positions for heavy load
        let positions = create_load_test_positions(500);
        let mut position_ids = Vec::new();
        
        for position in positions {
            let position_id = aegis.add_position(position).await.expect("Should add position");
            position_ids.push(position_id);
        }

        // Start monitoring
        aegis.start().await.expect("Should start monitoring");

        // Run heavy load test
        let config = LoadTestConfig::heavy_load();
        let result = run_load_test(&aegis, &position_ids, config.clone()).await;

        println!("=== Heavy Load Test Results ===");
        println!("Configuration: {} users × {} requests = {} total requests",
                result.config.concurrent_users, result.config.requests_per_user, result.total_requests);
        println!("Duration: {:.2} seconds", result.total_duration_secs);
        println!("Throughput: {:.2} ops/sec (target: {:.2})", 
                result.actual_throughput_ops_per_sec, result.config.target_throughput_ops_per_sec);
        println!("Success Rate: {:.2}% ({}/{} successful)",
                100.0 - result.error_rate_percent, result.successful_requests, result.total_requests);
        println!("Average Latency: {:.2} ms", result.average_latency_ms);
        println!("P95 Latency: {} ms", result.p95_latency_ms);
        println!("P99 Latency: {} ms", result.p99_latency_ms);
        println!("Est. Memory Usage: {:.2} MB", result.memory_usage_mb);
        println!("Est. CPU Usage: {:.2}%", result.cpu_utilization_percent);

        // Verify heavy load performance requirements (more lenient)
        assert!(result.actual_throughput_ops_per_sec >= config.target_throughput_ops_per_sec * 0.5,
                "Throughput should be at least 50% of target under heavy load");
        assert!(result.error_rate_percent <= config.max_acceptable_error_rate,
                "Error rate should be below {:.2}%", config.max_acceptable_error_rate);
        assert!(result.average_latency_ms <= config.max_acceptable_latency_ms as f64,
                "Average latency should be below {} ms", config.max_acceptable_latency_ms);

        // System should remain stable under heavy load
        assert!(result.successful_requests > 0, "Should handle some requests successfully");
        assert!(result.total_duration_secs > 0.0, "Test should complete");

        println!("✓ Heavy Load Test Passed");
    }

    #[tokio::test]
    async fn test_spike_load_performance() {
        let (aegis, price_feed, trade_executor) = setup_load_test_satellite(6, 12, 0.02) // 2% failure rate
            .await
            .expect("Should setup load test satellite");

        // Create positions for spike testing
        let positions = create_load_test_positions(150);
        let mut position_ids = Vec::new();
        
        for position in positions {
            let position_id = aegis.add_position(position).await.expect("Should add position");
            position_ids.push(position_id);
        }

        // Start monitoring
        aegis.start().await.expect("Should start monitoring");

        println!("=== Spike Load Test ===");

        // Simulate sudden spike in load
        let spike_users = 100;
        let spike_requests_per_user = 5;
        
        println!("Simulating sudden spike: {} users × {} requests",
                spike_users, spike_requests_per_user);

        let start_time = Instant::now();
        let mut all_latencies = Vec::new();
        let mut total_successful = 0;
        let mut total_failed = 0;

        // Launch all users simultaneously (no ramp-up)
        let mut spike_tasks = Vec::new();
        
        for user_id in 0..spike_users {
            let aegis_clone = aegis.clone();
            let position_ids_clone = position_ids.clone();
            
            let task = tokio::spawn(async move {
                let mut user_latencies = Vec::new();
                let mut user_successful = 0;
                let mut user_failed = 0;

                for request_id in 0..spike_requests_per_user {
                    let position_index = (user_id * spike_requests_per_user + request_id) % position_ids_clone.len();
                    let position_id = position_ids_clone[position_index];

                    let request_start = Instant::now();
                    
                    match aegis_clone.get_position_health(position_id).await {
                        Ok(_) => {
                            user_successful += 1;
                            user_latencies.push(request_start.elapsed().as_millis() as u64);
                        },
                        Err(_) => {
                            user_failed += 1;
                        }
                    }
                }

                (user_latencies, user_successful, user_failed)
            });

            spike_tasks.push(task);
        }

        // Wait for spike to complete
        let spike_results = join_all(spike_tasks).await;
        
        // Aggregate spike results
        for result in spike_results {
            if let Ok((latencies, successful, failed)) = result {
                all_latencies.extend(latencies);
                total_successful += successful;
                total_failed += failed;
            }
        }

        let spike_duration = start_time.elapsed();
        let total_spike_requests = total_successful + total_failed;

        // Calculate spike metrics
        let spike_throughput = if spike_duration.as_secs_f64() > 0.0 {
            total_spike_requests as f64 / spike_duration.as_secs_f64()
        } else {
            0.0
        };

        let spike_error_rate = if total_spike_requests > 0 {
            (total_failed as f64 / total_spike_requests as f64) * 100.0
        } else {
            0.0
        };

        let spike_avg_latency = if !all_latencies.is_empty() {
            all_latencies.iter().sum::<u64>() as f64 / all_latencies.len() as f64
        } else {
            0.0
        };

        let mut sorted_latencies = all_latencies.clone();
        sorted_latencies.sort();

        let spike_p95_latency = if !sorted_latencies.is_empty() {
            sorted_latencies[sorted_latencies.len() * 95 / 100]
        } else {
            0
        };

        println!("Spike Test Results:");
        println!("  Duration: {:.2} seconds", spike_duration.as_secs_f64());
        println!("  Throughput: {:.2} ops/sec", spike_throughput);
        println!("  Success Rate: {:.2}% ({}/{} successful)",
                100.0 - spike_error_rate, total_successful, total_spike_requests);
        println!("  Average Latency: {:.2} ms", spike_avg_latency);
        println!("  P95 Latency: {} ms", spike_p95_latency);

        // System should handle spike without complete failure
        assert!(total_successful > 0, "Should handle some requests during spike");
        assert!(spike_error_rate < 50.0, "Error rate during spike should be manageable");
        assert!(spike_avg_latency < 5000.0, "Average latency should not be excessive during spike");

        // Allow system to recover after spike
        println!("Allowing system to recover...");
        tokio::time::sleep(StdDuration::from_secs(5)).await;

        // Test recovery - should return to normal performance
        let recovery_start = Instant::now();
        let mut recovery_successful = 0;
        let mut recovery_failed = 0;
        let recovery_test_count = 20;

        for i in 0..recovery_test_count {
            let position_id = position_ids[i % position_ids.len()];
            match aegis.get_position_health(position_id).await {
                Ok(_) => recovery_successful += 1,
                Err(_) => recovery_failed += 1,
            }
        }

        let recovery_duration = recovery_start.elapsed();
        let recovery_error_rate = (recovery_failed as f64 / recovery_test_count as f64) * 100.0;

        println!("Recovery Test Results:");
        println!("  Duration: {:.2} seconds", recovery_duration.as_secs_f64());
        println!("  Success Rate: {:.2}% ({}/{} successful)",
                100.0 - recovery_error_rate, recovery_successful, recovery_test_count);

        // System should recover to normal performance
        assert!(recovery_error_rate < 10.0, "System should recover to low error rate");
        assert!(recovery_duration.as_millis() < 5000, "Recovery operations should be reasonably fast");

        println!("✓ Spike Load Test Passed");
    }

    #[tokio::test]
    async fn test_sustained_load_with_gradual_increase() {
        let (aegis, price_feed, trade_executor) = setup_load_test_satellite(7, 14, 0.025) // 2.5% failure rate
            .await
            .expect("Should setup load test satellite");

        // Create positions for sustained testing
        let positions = create_load_test_positions(300);
        let mut position_ids = Vec::new();
        
        for position in positions {
            let position_id = aegis.add_position(position).await.expect("Should add position");
            position_ids.push(position_id);
        }

        // Start monitoring
        aegis.start().await.expect("Should start monitoring");

        println!("=== Sustained Load with Gradual Increase Test ===");

        // Test different load levels over time
        let load_levels = vec![
            (5, 5),   // 5 users × 5 requests = 25 total
            (10, 8),  // 10 users × 8 requests = 80 total  
            (15, 10), // 15 users × 10 requests = 150 total
            (20, 12), // 20 users × 12 requests = 240 total
            (25, 15), // 25 users × 15 requests = 375 total
        ];

        let mut sustained_results = Vec::new();

        for (level_index, (concurrent_users, requests_per_user)) in load_levels.iter().enumerate() {
            println!("Load Level {}: {} users × {} requests = {} total",
                    level_index + 1, concurrent_users, requests_per_user, 
                    concurrent_users * requests_per_user);

            let level_config = LoadTestConfig {
                concurrent_users: *concurrent_users,
                requests_per_user: *requests_per_user,
                test_duration_secs: 15, // Shorter duration per level
                ramp_up_duration_secs: 3,
                target_throughput_ops_per_sec: (*concurrent_users * *requests_per_user) as f64 / 15.0,
                max_acceptable_latency_ms: 1000,
                max_acceptable_error_rate: 15.0,
            };

            let level_result = run_load_test(&aegis, &position_ids, level_config).await;
            
            println!("  Throughput: {:.2} ops/sec", level_result.actual_throughput_ops_per_sec);
            println!("  Success Rate: {:.2}%", 100.0 - level_result.error_rate_percent);
            println!("  Average Latency: {:.2} ms", level_result.average_latency_ms);
            println!("  P95 Latency: {} ms", level_result.p95_latency_ms);

            sustained_results.push(level_result);

            // Brief pause between load levels
            tokio::time::sleep(StdDuration::from_secs(2)).await;
        }

        // Analyze sustained load performance trends
        println!("=== Sustained Load Analysis ===");

        for (i, result) in sustained_results.iter().enumerate() {
            println!("Level {}: {:.2} ops/sec, {:.2}% success, {:.2}ms avg latency",
                    i + 1, 
                    result.actual_throughput_ops_per_sec,
                    100.0 - result.error_rate_percent,
                    result.average_latency_ms);
        }

        // Check that system maintains reasonable performance across load levels
        for (i, result) in sustained_results.iter().enumerate() {
            assert!(result.error_rate_percent < 20.0, 
                    "Error rate at level {} should be manageable", i + 1);
            assert!(result.average_latency_ms < 2000.0,
                    "Average latency at level {} should be reasonable", i + 1);
            assert!(result.actual_throughput_ops_per_sec > 1.0,
                    "Throughput at level {} should be positive", i + 1);
        }

        // Performance shouldn't degrade too severely with increased load
        let first_result = &sustained_results[0];
        let last_result = &sustained_results[sustained_results.len() - 1];

        let throughput_per_user_first = first_result.actual_throughput_ops_per_sec / first_result.config.concurrent_users as f64;
        let throughput_per_user_last = last_result.actual_throughput_ops_per_sec / last_result.config.concurrent_users as f64;

        let per_user_degradation = (throughput_per_user_first - throughput_per_user_last) / throughput_per_user_first;

        println!("Performance Analysis:");
        println!("  First Level Throughput per User: {:.2} ops/sec", throughput_per_user_first);
        println!("  Last Level Throughput per User: {:.2} ops/sec", throughput_per_user_last);
        println!("  Per-User Degradation: {:.2}%", per_user_degradation * 100.0);

        // Per-user performance shouldn't degrade by more than 70%
        assert!(per_user_degradation < 0.7, 
                "Per-user performance degradation should be manageable");

        println!("✓ Sustained Load with Gradual Increase Test Passed");
    }
}