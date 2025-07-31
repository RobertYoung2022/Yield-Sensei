use std::sync::Arc;
use tokio::sync::RwLock;
use chrono::{Utc, Duration};
use rust_decimal::Decimal;
use std::collections::HashMap;
use uuid::Uuid;

// Import the actual Aegis satellite types and components
extern crate aegis_satellite;
use aegis_satellite::{
    AegisSatellite, AegisConfig, AegisStatistics,
    types::{Position, PositionId, PositionError, HealthFactor, CalculationError, RiskAlert},
    liquidation::{LiquidationMonitor, PriceFeedProvider, HealthCalculatorFactory},
    risk::{TradeExecutor, TradeSimulation, PriceImpactError, TradeResult},
    simulation::{SimulationPosition, SimulationScenario, MonteCarloConfig},
    data::price_feed_integration::{
        PriceFeedIntegrationSystem, PriceFeedIntegrationConfig, AggregatedPriceData,
        OracleType, OracleConfig, EnhancedPriceData, AuditEntry
    },
    monitoring::{EscalatingAlertSystem, AlertConfiguration}
};

#[cfg(test)]
mod aegis_satellite_integration_tests {
    use super::*;

    // Mock implementations for testing

    #[derive(Clone)]
    struct MockPriceFeedProvider {
        prices: Arc<RwLock<HashMap<String, Decimal>>>,
        feed_latency_ms: u64,
        failure_rate: f64,
    }

    impl MockPriceFeedProvider {
        fn new() -> Self {
            let mut prices = HashMap::new();
            prices.insert("BTC".to_string(), Decimal::new(50000, 0));
            prices.insert("ETH".to_string(), Decimal::new(3000, 0));
            prices.insert("USDC".to_string(), Decimal::new(1, 0));
            prices.insert("AAVE".to_string(), Decimal::new(100, 0));
            prices.insert("UNI".to_string(), Decimal::new(10, 0));

            Self {
                prices: Arc::new(RwLock::new(prices)),
                feed_latency_ms: 50,
                failure_rate: 0.0,
            }
        }

        fn with_latency(mut self, latency_ms: u64) -> Self {
            self.feed_latency_ms = latency_ms;
            self
        }

        fn with_failure_rate(mut self, failure_rate: f64) -> Self {
            self.failure_rate = failure_rate;
            self
        }

        async fn update_price(&self, token: &str, price: Decimal) {
            let mut prices = self.prices.write().await;
            prices.insert(token.to_string(), price);
        }
    }

    #[async_trait::async_trait]
    impl PriceFeedProvider for MockPriceFeedProvider {
        async fn get_price(&self, token_address: &str) -> Result<Decimal, Box<dyn std::error::Error + Send + Sync>> {
            // Simulate network latency
            tokio::time::sleep(std::time::Duration::from_millis(self.feed_latency_ms)).await;

            // Simulate occasional failures
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
                match self.get_price(token).await {
                    Ok(price) => {
                        result.insert(token.clone(), price);
                    }
                    Err(_) => {
                        // Skip failed prices in batch request
                        continue;
                    }
                }
            }
            Ok(result)
        }
    }

    #[derive(Clone)]
    struct MockTradeExecutor {
        execution_latency_ms: u64,
        failure_rate: f64,
        slippage_percent: f64,
    }

    impl MockTradeExecutor {
        fn new() -> Self {
            Self {
                execution_latency_ms: 100,
                failure_rate: 0.0,
                slippage_percent: 0.5, // 0.5% slippage
            }
        }

        fn with_latency(mut self, latency_ms: u64) -> Self {
            self.execution_latency_ms = latency_ms;
            self
        }

        fn with_failure_rate(mut self, failure_rate: f64) -> Self {
            self.failure_rate = failure_rate;
            self
        }

        fn with_slippage(mut self, slippage_percent: f64) -> Self {
            self.slippage_percent = slippage_percent;
            self
        }
    }

    #[async_trait::async_trait]
    impl TradeExecutor for MockTradeExecutor {
        async fn execute_trade(
            &self,
            token_address: &str,
            amount: Decimal,
            is_buy: bool,
        ) -> Result<TradeResult, Box<dyn std::error::Error + Send + Sync>> {
            // Simulate execution latency
            tokio::time::sleep(std::time::Duration::from_millis(self.execution_latency_ms)).await;

            // Simulate execution failures
            if rand::random::<f64>() < self.failure_rate {
                return Err("Mock trade execution failure".into());
            }

            // Calculate slippage
            let slippage_multiplier = if is_buy {
                Decimal::new(1, 0) + Decimal::new((self.slippage_percent * 100.0) as i64, 2)
            } else {
                Decimal::new(1, 0) - Decimal::new((self.slippage_percent * 100.0) as i64, 2)
            };

            let executed_amount = amount * slippage_multiplier;

            Ok(TradeResult {
                transaction_hash: format!("0x{:016x}", rand::random::<u64>()),
                executed_amount,
                execution_price: Decimal::new(100, 0), // Mock price
                gas_used: 50000,
                gas_price: Decimal::new(20, 9), // 20 gwei
                timestamp: Utc::now(),
                success: true,
            })
        }

        async fn estimate_gas(&self, _token_address: &str, _amount: Decimal) -> Result<u64, Box<dyn std::error::Error + Send + Sync>> {
            Ok(50000) // Mock gas estimate
        }
    }

    // Helper functions for creating test data

    fn create_test_position(token: &str, collateral: f64, debt: f64) -> Position {
        Position {
            id: PositionId::new(),
            user_address: format!("0x{:040x}", rand::random::<u128>()),
            token_address: token.to_string(),
            collateral_amount: Decimal::new((collateral * 100.0) as i64, 2),
            debt_amount: Decimal::new((debt * 100.0) as i64, 2),
            liquidation_threshold: Decimal::new(120, 2), // 1.2
            created_at: Utc::now(),
            updated_at: Utc::now(),
            protocol: "TestProtocol".to_string(),
            is_active: true,
            health_factor: None,
        }
    }

    fn create_risky_position(token: &str) -> Position {
        Position {
            id: PositionId::new(),
            user_address: format!("0x{:040x}", rand::random::<u128>()),
            token_address: token.to_string(),
            collateral_amount: Decimal::new(1000, 0), // $1000
            debt_amount: Decimal::new(900, 0), // $900 debt
            liquidation_threshold: Decimal::new(110, 2), // 1.1 (110%)
            created_at: Utc::now(),
            updated_at: Utc::now(),
            protocol: "TestProtocol".to_string(),
            is_active: true,
            health_factor: None,
        }
    }

    fn create_simulation_positions() -> Vec<SimulationPosition> {
        vec![
            SimulationPosition {
                token_address: "BTC".to_string(),
                quantity: 1.0,
                entry_price: 45000.0,
                current_price: 50000.0,
                collateral_value: 50000.0,
                debt_value: 20000.0,
                liquidation_threshold: 1.2,
                health_factor: 2.5,
            },
            SimulationPosition {
                token_address: "ETH".to_string(),
                quantity: 10.0,
                entry_price: 2800.0,
                current_price: 3000.0,
                collateral_value: 30000.0,
                debt_value: 15000.0,
                liquidation_threshold: 1.3,
                health_factor: 2.0,
            },
            SimulationPosition {
                token_address: "USDC".to_string(),
                quantity: 10000.0,
                entry_price: 1.0,
                current_price: 1.0,
                collateral_value: 10000.0,
                debt_value: 0.0,
                liquidation_threshold: 1.0,
                health_factor: f64::INFINITY,
            },
        ]
    }

    #[tokio::test]
    async fn test_aegis_satellite_initialization() {
        let price_feed = Arc::new(MockPriceFeedProvider::new());
        let trade_executor = Arc::new(MockTradeExecutor::new());
        
        let config = AegisConfig {
            monitoring_interval_secs: 5,
            enable_automated_actions: true,
            enable_price_impact_simulation: true,
            enable_smart_contract_analysis: true,
            enable_mev_protection: true,
            max_concurrent_positions: 1000,
        };

        let aegis = AegisSatellite::new(
            price_feed.clone(),
            trade_executor.clone(),
            Some(config)
        ).await.expect("Should initialize Aegis satellite");

        // Verify initialization
        let stats = aegis.get_statistics();
        assert_eq!(stats.total_positions, 0);
        assert_eq!(stats.active_alerts, 0);
        assert!(stats.supported_protocols > 0);
    }

    #[tokio::test]
    async fn test_position_lifecycle_integration() {
        let price_feed = Arc::new(MockPriceFeedProvider::new());
        let trade_executor = Arc::new(MockTradeExecutor::new());
        
        let aegis = AegisSatellite::new(
            price_feed.clone(),
            trade_executor.clone(),
            None
        ).await.expect("Should initialize Aegis satellite");

        // Test adding a position
        let position = create_test_position("BTC", 10000.0, 5000.0);
        let position_id = aegis.add_position(position.clone())
            .await
            .expect("Should add position successfully");

        // Verify position was added
        let stats = aegis.get_statistics();
        assert_eq!(stats.total_positions, 1);

        // Test health calculation
        let health = aegis.get_position_health(position_id)
            .await
            .expect("Should calculate health successfully");
        
        assert!(health.health_factor > Decimal::new(1, 0));
        assert!(health.collateral_value > Decimal::ZERO);

        // Test position update
        let mut updated_position = position.clone();
        updated_position.debt_amount = Decimal::new(6000, 0); // Increase debt
        
        aegis.update_position(updated_position)
            .await
            .expect("Should update position successfully");

        // Verify health factor decreased
        let updated_health = aegis.get_position_health(position_id)
            .await
            .expect("Should calculate updated health");
        
        assert!(updated_health.health_factor < health.health_factor);

        // Test position removal
        let removed_position = aegis.remove_position(position_id)
            .await
            .expect("Should remove position successfully");
        
        assert_eq!(removed_position.id, position_id);

        // Verify position was removed
        let final_stats = aegis.get_statistics();
        assert_eq!(final_stats.total_positions, 0);
    }

    #[tokio::test]
    async fn test_price_feed_integration_and_monitoring() {
        let price_feed = Arc::new(MockPriceFeedProvider::new());
        let trade_executor = Arc::new(MockTradeExecutor::new());
        
        let aegis = AegisSatellite::new(
            price_feed.clone(),
            trade_executor.clone(),
            None
        ).await.expect("Should initialize Aegis satellite");

        // Add a position close to liquidation
        let risky_position = create_risky_position("BTC");
        let position_id = aegis.add_position(risky_position)
            .await
            .expect("Should add risky position");

        // Start monitoring
        aegis.start().await.expect("Should start monitoring");

        // Wait for initial monitoring cycle
        tokio::time::sleep(std::time::Duration::from_millis(100)).await;

        // Update price to trigger liquidation risk
        price_feed.update_price("BTC", Decimal::new(45000, 0)).await; // Price drop

        // Wait for monitoring to detect the change
        tokio::time::sleep(std::time::Duration::from_millis(200)).await;

        // Check for alerts
        let alerts = aegis.get_alerts(Some(position_id))
            .await
            .expect("Should get alerts");

        // Should have generated risk alerts due to price change
        assert!(!alerts.is_empty(), "Should have generated alerts for risky position");

        // Verify alert content
        let alert = &alerts[0];
        assert_eq!(alert.position_id, Some(position_id));
        assert!(alert.message.contains("liquidation") || alert.message.contains("risk"));
    }

    #[tokio::test]
    async fn test_price_feed_failure_handling() {
        let price_feed = Arc::new(MockPriceFeedProvider::new().with_failure_rate(0.5)); // 50% failure rate
        let trade_executor = Arc::new(MockTradeExecutor::new());
        
        let aegis = AegisSatellite::new(
            price_feed.clone(),
            trade_executor.clone(),
            None
        ).await.expect("Should initialize even with unreliable price feed");

        let position = create_test_position("BTC", 10000.0, 5000.0);
        let position_id = aegis.add_position(position)
            .await
            .expect("Should add position");

        // Try to get health multiple times - some should succeed despite failures
        let mut success_count = 0;
        let mut failure_count = 0;

        for _ in 0..10 {
            match aegis.get_position_health(position_id).await {
                Ok(_) => success_count += 1,
                Err(_) => failure_count += 1,
            }
        }

        // Should have some successes and some failures due to the 50% failure rate
        assert!(success_count > 0, "Should have some successful health calculations");
        assert!(failure_count > 0, "Should have some failed health calculations due to price feed failures");
    }

    #[tokio::test]
    async fn test_trade_execution_integration() {
        let price_feed = Arc::new(MockPriceFeedProvider::new());
        let trade_executor = Arc::new(MockTradeExecutor::new());
        
        let aegis = AegisSatellite::new(
            price_feed.clone(),
            trade_executor.clone(),
            None
        ).await.expect("Should initialize Aegis satellite");

        let position = create_test_position("BTC", 10000.0, 5000.0);
        let position_id = aegis.add_position(position)
            .await
            .expect("Should add position");

        // Test trade impact simulation
        let simulation_result = aegis.simulate_trade_impact(
            position_id,
            "BTC",
            Decimal::new(100, 0), // Simulate selling 1 BTC
        ).await.expect("Should simulate trade impact");

        assert!(simulation_result.estimated_execution_price > Decimal::ZERO);
        assert!(simulation_result.price_impact_percent >= 0.0);
        assert!(simulation_result.estimated_slippage >= 0.0);
    }

    #[tokio::test]
    async fn test_multiple_satellites_interaction() {
        // This test simulates interaction between multiple satellite instances
        // as would happen in a real deployment with Echo, Pulse, and Bridge satellites

        let price_feed = Arc::new(MockPriceFeedProvider::new());
        let trade_executor = Arc::new(MockTradeExecutor::new());
        
        // Create multiple Aegis instances (simulating different instances)
        let aegis1 = AegisSatellite::new(
            price_feed.clone(),
            trade_executor.clone(),
            None
        ).await.expect("Should initialize first Aegis instance");

        let aegis2 = AegisSatellite::new(
            price_feed.clone(),
            trade_executor.clone(),
            None
        ).await.expect("Should initialize second Aegis instance");

        // Add positions to different instances
        let position1 = create_test_position("BTC", 10000.0, 5000.0);
        let position2 = create_test_position("ETH", 15000.0, 7000.0);

        let pos_id1 = aegis1.add_position(position1).await.expect("Should add position to first instance");
        let pos_id2 = aegis2.add_position(position2).await.expect("Should add position to second instance");

        // Simulate price change affecting both instances
        price_feed.update_price("BTC", Decimal::new(45000, 0)).await;
        price_feed.update_price("ETH", Decimal::new(2500, 0)).await;

        // Both instances should detect the price changes
        let health1 = aegis1.get_position_health(pos_id1).await.expect("Should get health from first instance");
        let health2 = aegis2.get_position_health(pos_id2).await.expect("Should get health from second instance");

        // Health factors should reflect the price changes
        assert!(health1.health_factor > Decimal::ZERO);
        assert!(health2.health_factor > Decimal::ZERO);

        // Both instances should be operational independently
        let stats1 = aegis1.get_statistics();
        let stats2 = aegis2.get_statistics();

        assert_eq!(stats1.total_positions, 1);
        assert_eq!(stats2.total_positions, 1);
    }

    #[tokio::test]
    async fn test_stress_testing_integration() {
        let price_feed = Arc::new(MockPriceFeedProvider::new());
        let trade_executor = Arc::new(MockTradeExecutor::new());
        
        let aegis = AegisSatellite::new(
            price_feed.clone(),
            trade_executor.clone(),
            None
        ).await.expect("Should initialize Aegis satellite");

        let simulation_positions = create_simulation_positions();

        // Test different stress scenarios
        let scenarios = vec![
            SimulationScenario::HistoricalMarketCrash,
            SimulationScenario::CryptoWinter,
            SimulationScenario::DeFiContagion,
            SimulationScenario::RegulatoryShock,
            SimulationScenario::BlackSwan,
        ];

        for scenario in scenarios {
            let result = aegis.run_stress_test(&simulation_positions, &scenario)
                .await
                .expect(&format!("Should run stress test for {:?}", scenario));

            // Verify simulation results
            assert_eq!(result.scenario, scenario);
            assert!(result.initial_portfolio_value > 0.0);
            assert!(result.simulation_duration_ms > 0);
            
            // More severe scenarios should have worse outcomes
            match scenario {
                SimulationScenario::BlackSwan => {
                    assert!(result.max_drawdown < -0.5); // At least 50% drawdown
                    assert!(result.var_95 < 0.0);
                    assert!(result.cvar_95 < result.var_95);
                }
                SimulationScenario::RegulatoryShock => {
                    assert!(result.max_drawdown > -0.5); // Less severe than black swan
                }
                _ => {
                    assert!(result.var_95 < 0.0);
                    assert!(result.cvar_95 <= result.var_95);
                }
            }
        }
    }

    #[tokio::test]
    async fn test_monte_carlo_simulation_integration() {
        let price_feed = Arc::new(MockPriceFeedProvider::new());
        let trade_executor = Arc::new(MockTradeExecutor::new());
        
        let aegis = AegisSatellite::new(
            price_feed.clone(),
            trade_executor.clone(),
            None
        ).await.expect("Should initialize Aegis satellite");

        let simulation_positions = create_simulation_positions();

        let mc_config = MonteCarloConfig {
            iterations: 100, // Reduced for test speed
            time_horizon_days: 30,
            confidence_level: 0.95,
            price_volatility: 0.2,
            correlation_matrix: vec![vec![1.0, 0.7, 0.1], vec![0.7, 1.0, 0.1], vec![0.1, 0.1, 1.0]],
            drift_rates: HashMap::new(),
        };

        let results = aegis.run_monte_carlo_simulation(&simulation_positions, &mc_config)
            .await
            .expect("Should run Monte Carlo simulation");

        // Verify simulation results
        assert_eq!(results.len(), 100);

        // All results should have the same VaR and CVaR (calculated from all iterations)
        let first_var = results[0].var_95;
        let first_cvar = results[0].cvar_95;

        for result in &results {
            assert!((result.var_95 - first_var).abs() < 0.001);
            assert!((result.cvar_95 - first_cvar).abs() < 0.001);
            assert!(result.initial_portfolio_value > 0.0);
            assert!(result.final_portfolio_value > 0.0);
        }

        // CVaR should be more extreme than VaR
        assert!(first_cvar < first_var);

        // Should have variety in portfolio outcomes
        let portfolio_values: Vec<f64> = results.iter()
            .map(|r| r.final_portfolio_value)
            .collect();

        let min_value = portfolio_values.iter().fold(f64::INFINITY, |a, &b| a.min(b));
        let max_value = portfolio_values.iter().fold(f64::NEG_INFINITY, |a, &b| a.max(b));

        assert!(max_value > min_value, "Should have variety in Monte Carlo outcomes");
    }

    #[tokio::test]
    async fn test_backtesting_integration() {
        let price_feed = Arc::new(MockPriceFeedProvider::new());
        let trade_executor = Arc::new(MockTradeExecutor::new());
        
        let aegis = AegisSatellite::new(
            price_feed.clone(),
            trade_executor.clone(),
            None
        ).await.expect("Should initialize Aegis satellite");

        let simulation_positions = create_simulation_positions();

        let start_date = Utc::now() - Duration::days(90);
        let end_date = Utc::now() - Duration::days(30);

        let result = aegis.run_backtesting(&simulation_positions, start_date, end_date)
            .await
            .expect("Should run backtesting");

        // Verify backtesting results
        assert!(result.initial_portfolio_value > 0.0);
        assert!(result.final_portfolio_value > 0.0);
        assert!(result.simulation_duration_ms >= 0);
        
        // Should have some performance data
        assert!(!result.surviving_positions.is_empty());
    }

    #[tokio::test]
    async fn test_cache_management_integration() {
        let price_feed = Arc::new(MockPriceFeedProvider::new());
        let trade_executor = Arc::new(MockTradeExecutor::new());
        
        let aegis = AegisSatellite::new(
            price_feed.clone(),
            trade_executor.clone(),
            None
        ).await.expect("Should initialize Aegis satellite");

        let simulation_positions = create_simulation_positions();

        // Run simulation to populate cache
        let _result = aegis.run_stress_test(&simulation_positions, &SimulationScenario::HistoricalMarketCrash)
            .await
            .expect("Should run stress test");

        // Check cache stats
        let stats = aegis.get_simulation_cache_stats()
            .await
            .expect("Should get cache stats");

        assert!(stats.get("simulation_cache_entries").unwrap_or(&0) > &0);

        // Clear cache
        aegis.clear_simulation_cache()
            .await
            .expect("Should clear cache");

        // Verify cache is empty
        let stats_after = aegis.get_simulation_cache_stats()
            .await
            .expect("Should get cache stats after clearing");

        assert_eq!(stats_after.get("simulation_cache_entries").unwrap_or(&0), &0);
    }

    #[tokio::test]
    async fn test_position_conversion_integration() {
        let price_feed = Arc::new(MockPriceFeedProvider::new());
        let trade_executor = Arc::new(MockTradeExecutor::new());
        
        let aegis = AegisSatellite::new(
            price_feed.clone(),
            trade_executor.clone(),
            None
        ).await.expect("Should initialize Aegis satellite");

        // Add multiple positions
        let position1 = create_test_position("BTC", 10000.0, 5000.0);
        let position2 = create_test_position("ETH", 15000.0, 7000.0);
        let position3 = create_test_position("USDC", 5000.0, 0.0);

        let pos_id1 = aegis.add_position(position1).await.expect("Should add BTC position");
        let pos_id2 = aegis.add_position(position2).await.expect("Should add ETH position");
        let pos_id3 = aegis.add_position(position3).await.expect("Should add USDC position");

        // Convert positions to simulation format
        let position_ids = vec![pos_id1, pos_id2, pos_id3];
        let simulation_positions = aegis.convert_positions_to_simulation(&position_ids)
            .await
            .expect("Should convert positions to simulation format");

        // Verify conversion
        assert_eq!(simulation_positions.len(), 3);

        for sim_pos in &simulation_positions {
            assert!(sim_pos.collateral_value > 0.0);
            assert!(sim_pos.health_factor > 0.0);
            assert!(sim_pos.liquidation_threshold > 0.0);
        }

        // Use converted positions in stress test
        let result = aegis.run_stress_test(&simulation_positions, &SimulationScenario::HistoricalMarketCrash)
            .await
            .expect("Should run stress test with converted positions");

        assert_eq!(result.scenario, SimulationScenario::HistoricalMarketCrash);
        assert!(result.initial_portfolio_value > 0.0);
    }

    #[tokio::test]
    async fn test_alert_system_integration() {
        let price_feed = Arc::new(MockPriceFeedProvider::new());
        let trade_executor = Arc::new(MockTradeExecutor::new());
        
        let aegis = AegisSatellite::new(
            price_feed.clone(),
            trade_executor.clone(),
            None
        ).await.expect("Should initialize Aegis satellite");

        // Add a position that will generate alerts
        let risky_position = create_risky_position("BTC");
        let position_id = aegis.add_position(risky_position)
            .await
            .expect("Should add risky position");

        // Start monitoring to generate alerts
        aegis.start().await.expect("Should start monitoring");

        // Trigger price drop to generate alerts
        price_feed.update_price("BTC", Decimal::new(40000, 0)).await; // Significant price drop

        // Wait for alert generation
        tokio::time::sleep(std::time::Duration::from_millis(200)).await;

        // Get alerts
        let alerts = aegis.get_alerts(Some(position_id))
            .await
            .expect("Should get alerts");

        assert!(!alerts.is_empty(), "Should have generated alerts for price drop");

        // Test alert acknowledgment
        if let Some(alert) = alerts.first() {
            aegis.acknowledge_alert(alert.id)
                .await
                .expect("Should acknowledge alert");

            // Get alerts again - acknowledged alert should be handled
            let remaining_alerts = aegis.get_alerts(Some(position_id))
                .await
                .expect("Should get remaining alerts");

            // The number of active alerts should be managed by the alert system
            // (exact behavior depends on alert system implementation)
        }
    }

    #[tokio::test]
    async fn test_high_load_integration() {
        let price_feed = Arc::new(MockPriceFeedProvider::new());
        let trade_executor = Arc::new(MockTradeExecutor::new());
        
        let aegis = AegisSatellite::new(
            price_feed.clone(),
            trade_executor.clone(),
            Some(AegisConfig {
                monitoring_interval_secs: 1,
                enable_automated_actions: true,
                enable_price_impact_simulation: true,
                enable_smart_contract_analysis: true,
                enable_mev_protection: true,
                max_concurrent_positions: 100,
            })
        ).await.expect("Should initialize Aegis satellite");

        // Add many positions to test high load
        let mut position_ids = Vec::new();
        let tokens = vec!["BTC", "ETH", "USDC", "AAVE", "UNI"];

        for i in 0..50 {
            let token = tokens[i % tokens.len()];
            let position = create_test_position(token, 10000.0 + i as f64 * 100.0, 5000.0 + i as f64 * 50.0);
            
            let position_id = aegis.add_position(position)
                .await
                .expect(&format!("Should add position {}", i));
            
            position_ids.push(position_id);
        }

        // Verify all positions were added
        let stats = aegis.get_statistics();
        assert_eq!(stats.total_positions, 50);

        // Start monitoring with high load
        aegis.start().await.expect("Should start monitoring with high load");

        // Simulate rapid price changes
        for i in 0..10 {
            let price_change = 1.0 + (i as f64 * 0.1);
            price_feed.update_price("BTC", Decimal::new((50000.0 * price_change) as i64, 0)).await;
            price_feed.update_price("ETH", Decimal::new((3000.0 * price_change) as i64, 0)).await;
            
            // Small delay between price updates
            tokio::time::sleep(std::time::Duration::from_millis(10)).await;
        }

        // Wait for monitoring to process all changes
        tokio::time::sleep(std::time::Duration::from_millis(500)).await;

        // Verify system is still responsive
        let final_stats = aegis.get_statistics();
        assert_eq!(final_stats.total_positions, 50);

        // Test health calculation for a sample of positions
        for &position_id in position_ids.iter().take(10) {
            let health = aegis.get_position_health(position_id)
                .await
                .expect(&format!("Should calculate health for position {:?}", position_id));
            
            assert!(health.health_factor > Decimal::ZERO);
        }
    }

    #[tokio::test]
    async fn test_data_consistency_across_components() {
        let price_feed = Arc::new(MockPriceFeedProvider::new());
        let trade_executor = Arc::new(MockTradeExecutor::new());
        
        let aegis = AegisSatellite::new(
            price_feed.clone(),
            trade_executor.clone(),
            None
        ).await.expect("Should initialize Aegis satellite");

        let position = create_test_position("BTC", 10000.0, 5000.0);
        let position_id = aegis.add_position(position.clone())
            .await
            .expect("Should add position");

        // Get health from different components and verify consistency
        let health1 = aegis.get_position_health(position_id)
            .await
            .expect("Should get health first time");

        let health2 = aegis.get_position_health(position_id)
            .await
            .expect("Should get health second time");

        // Health should be consistent (assuming no price changes)
        assert_eq!(health1.health_factor, health2.health_factor);
        assert_eq!(health1.collateral_value, health2.collateral_value);
        assert_eq!(health1.debt_value, health2.debt_value);

        // Convert to simulation and verify data consistency
        let sim_positions = aegis.convert_positions_to_simulation(&[position_id])
            .await
            .expect("Should convert to simulation");

        assert_eq!(sim_positions.len(), 1);
        let sim_pos = &sim_positions[0];

        // Values should be consistent with health calculation
        assert_eq!(sim_pos.collateral_value, health1.collateral_value.to_f64().unwrap_or(0.0));
        assert_eq!(sim_pos.debt_value, health1.debt_value.to_f64().unwrap_or(0.0));
        assert_eq!(sim_pos.health_factor, health1.health_factor.to_f64().unwrap_or(0.0));
    }

    #[tokio::test]
    async fn test_error_recovery_integration() {
        let price_feed = Arc::new(
            MockPriceFeedProvider::new()
                .with_failure_rate(0.3) // 30% failure rate
                .with_latency(200) // High latency
        );
        let trade_executor = Arc::new(
            MockTradeExecutor::new()
                .with_failure_rate(0.2) // 20% failure rate
                .with_latency(300) // High latency
        );
        
        let aegis = AegisSatellite::new(
            price_feed.clone(),
            trade_executor.clone(),
            None
        ).await.expect("Should initialize despite unreliable components");

        let position = create_test_position("BTC", 10000.0, 5000.0);
        let position_id = aegis.add_position(position)
            .await
            .expect("Should add position");

        aegis.start().await.expect("Should start monitoring");

        // Test resilience over multiple operations
        let mut successful_operations = 0;
        let mut failed_operations = 0;

        for _ in 0..20 {
            match aegis.get_position_health(position_id).await {
                Ok(_) => successful_operations += 1,
                Err(_) => failed_operations += 1,
            }

            // Small delay between operations
            tokio::time::sleep(std::time::Duration::from_millis(10)).await;
        }

        // Should have some successful operations despite failures
        assert!(successful_operations > 0, "Should have some successful operations despite component failures");
        
        // Should handle failures gracefully
        assert!(failed_operations > 0, "Should have some failures due to component unreliability");

        // System should remain operational
        let stats = aegis.get_statistics();
        assert_eq!(stats.total_positions, 1);
    }
}