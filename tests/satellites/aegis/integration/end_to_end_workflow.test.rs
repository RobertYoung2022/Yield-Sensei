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
    simulation::{SimulationPosition, SimulationScenario, MonteCarloConfig, SimulationResult},
    data::price_feed_integration::{
        PriceFeedIntegrationSystem, PriceFeedIntegrationConfig, AggregatedPriceData,
        OracleType, OracleConfig, EnhancedPriceData, AuditEntry
    },
    monitoring::{EscalatingAlertSystem, AlertConfiguration},
    security::mev_protection::{MevProtectionSystem, MevProtectionConfig, MevThreat, TransactionData}
};

#[cfg(test)]
mod end_to_end_workflow_tests {
    use super::*;

    // Comprehensive integration test scenario
    struct IntegrationTestScenario {
        aegis: AegisSatellite,
        price_feed: Arc<MockPriceFeedProvider>,
        trade_executor: Arc<MockTradeExecutor>,
        positions: Vec<(PositionId, Position)>,
        scenario_name: String,
    }

    #[derive(Clone)]
    struct MockPriceFeedProvider {
        prices: Arc<RwLock<HashMap<String, Decimal>>>,
        historical_prices: Arc<RwLock<HashMap<String, Vec<(chrono::DateTime<Utc>, Decimal)>>>>,
        latency_ms: u64,
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
            prices.insert("LINK".to_string(), Decimal::new(15, 0));

            let mut historical_prices = HashMap::new();
            for (token, &price) in &prices {
                let mut history = Vec::new();
                let base_price = price.to_f64().unwrap_or(0.0);
                
                // Generate 30 days of historical data
                for i in 0..30 {
                    let days_ago = 30 - i;
                    let timestamp = Utc::now() - Duration::days(days_ago);
                    let volatility = (i as f64 * 0.1).sin() * 0.1; // 10% volatility
                    let historical_price = base_price * (1.0 + volatility);
                    history.push((timestamp, Decimal::from_f64(historical_price).unwrap_or(price)));
                }
                
                historical_prices.insert(token.clone(), history);
            }

            Self {
                prices: Arc::new(RwLock::new(prices)),
                historical_prices: Arc::new(RwLock::new(historical_prices)),
                latency_ms: 50,
                failure_rate: 0.0,
            }
        }

        async fn update_price(&self, token: &str, price: Decimal) {
            let mut prices = self.prices.write().await;
            prices.insert(token.to_string(), price);

            // Add to historical data
            let mut historical = self.historical_prices.write().await;
            if let Some(history) = historical.get_mut(token) {
                history.push((Utc::now(), price));
                // Keep only last 30 days
                history.retain(|(timestamp, _)| *timestamp > Utc::now() - Duration::days(30));
            }
        }

        async fn simulate_market_crash(&self, severity: f64) {
            let mut prices = self.prices.write().await;
            for (token, price) in prices.iter_mut() {
                if token == "USDC" || token == "USDT" {
                    // Stablecoins are less affected
                    *price = *price * Decimal::from_f64(1.0 - severity * 0.1).unwrap_or(Decimal::ONE);
                } else {
                    // Other tokens drop significantly
                    *price = *price * Decimal::from_f64(1.0 - severity).unwrap_or(Decimal::ONE);
                }
            }
        }

        async fn simulate_market_recovery(&self, recovery_factor: f64) {
            let mut prices = self.prices.write().await;
            for (token, price) in prices.iter_mut() {
                if token != "USDC" && token != "USDT" {
                    *price = *price * Decimal::from_f64(1.0 + recovery_factor).unwrap_or(Decimal::ONE);
                }
            }
        }
    }

    #[async_trait::async_trait]
    impl PriceFeedProvider for MockPriceFeedProvider {
        async fn get_price(&self, token_address: &str) -> Result<Decimal, Box<dyn std::error::Error + Send + Sync>> {
            tokio::time::sleep(std::time::Duration::from_millis(self.latency_ms)).await;

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
    struct MockTradeExecutor {
        execution_latency_ms: u64,
        failure_rate: f64,
        slippage_percent: f64,
        executed_trades: Arc<RwLock<Vec<TradeResult>>>,
    }

    impl MockTradeExecutor {
        fn new() -> Self {
            Self {
                execution_latency_ms: 100,
                failure_rate: 0.0,
                slippage_percent: 0.5,
                executed_trades: Arc::new(RwLock::new(Vec::new())),
            }
        }

        async fn get_executed_trades(&self) -> Vec<TradeResult> {
            self.executed_trades.read().await.clone()
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
            tokio::time::sleep(std::time::Duration::from_millis(self.execution_latency_ms)).await;

            if rand::random::<f64>() < self.failure_rate {
                return Err("Mock trade execution failure".into());
            }

            let slippage_multiplier = if is_buy {
                Decimal::new(1, 0) + Decimal::new((self.slippage_percent * 100.0) as i64, 2)
            } else {
                Decimal::new(1, 0) - Decimal::new((self.slippage_percent * 100.0) as i64, 2)
            };

            let executed_amount = amount * slippage_multiplier;

            let result = TradeResult {
                transaction_hash: format!("0x{:016x}", rand::random::<u64>()),
                executed_amount,
                execution_price: Decimal::new(100, 0),
                gas_used: 50000,
                gas_price: Decimal::new(20, 9),
                timestamp: Utc::now(),
                success: true,
            };

            // Store executed trade
            let mut trades = self.executed_trades.write().await;
            trades.push(result.clone());

            Ok(result)
        }

        async fn estimate_gas(&self, _token_address: &str, _amount: Decimal) -> Result<u64, Box<dyn std::error::Error + Send + Sync>> {
            Ok(50000)
        }
    }

    // Helper functions
    fn create_diversified_portfolio() -> Vec<Position> {
        vec![
            Position {
                id: PositionId::new(),
                user_address: "0x123456789abcdef".to_string(),
                token_address: "BTC".to_string(),
                collateral_amount: Decimal::new(100000, 0), // $100k
                debt_amount: Decimal::new(50000, 0), // $50k debt
                liquidation_threshold: Decimal::new(120, 2), // 1.2
                created_at: Utc::now(),
                updated_at: Utc::now(),
                protocol: "AAVE".to_string(),
                is_active: true,
                health_factor: None,
            },
            Position {
                id: PositionId::new(),
                user_address: "0x123456789abcdef".to_string(),
                token_address: "ETH".to_string(),
                collateral_amount: Decimal::new(75000, 0), // $75k
                debt_amount: Decimal::new(40000, 0), // $40k debt
                liquidation_threshold: Decimal::new(125, 2), // 1.25
                created_at: Utc::now(),
                updated_at: Utc::now(),
                protocol: "Compound".to_string(),
                is_active: true,
                health_factor: None,
            },
            Position {
                id: PositionId::new(),
                user_address: "0x123456789abcdef".to_string(),
                token_address: "AAVE".to_string(),
                collateral_amount: Decimal::new(25000, 0), // $25k
                debt_amount: Decimal::new(10000, 0), // $10k debt
                liquidation_threshold: Decimal::new(150, 2), // 1.5
                created_at: Utc::now(),
                updated_at: Utc::now(),
                protocol: "AAVE".to_string(),
                is_active: true,
                health_factor: None,
            },
            Position {
                id: PositionId::new(),
                user_address: "0x123456789abcdef".to_string(),
                token_address: "USDC".to_string(),
                collateral_amount: Decimal::new(50000, 0), // $50k
                debt_amount: Decimal::new(0, 0), // No debt
                liquidation_threshold: Decimal::new(100, 2), // 1.0
                created_at: Utc::now(),
                updated_at: Utc::now(),
                protocol: "AAVE".to_string(),
                is_active: true,
                health_factor: None,
            },
        ]
    }

    fn create_risky_portfolio() -> Vec<Position> {
        vec![
            Position {
                id: PositionId::new(),
                user_address: "0xrisky123456789".to_string(),
                token_address: "BTC".to_string(),
                collateral_amount: Decimal::new(50000, 0), // $50k
                debt_amount: Decimal::new(45000, 0), // $45k debt - very high leverage
                liquidation_threshold: Decimal::new(110, 2), // 1.1
                created_at: Utc::now(),
                updated_at: Utc::now(),
                protocol: "HighRiskProtocol".to_string(),
                is_active: true,
                health_factor: None,
            },
            Position {
                id: PositionId::new(),
                user_address: "0xrisky123456789".to_string(),
                token_address: "ETH".to_string(),
                collateral_amount: Decimal::new(30000, 0), // $30k
                debt_amount: Decimal::new(27000, 0), // $27k debt
                liquidation_threshold: Decimal::new(115, 2), // 1.15
                created_at: Utc::now(),
                updated_at: Utc::now(),
                protocol: "HighRiskProtocol".to_string(),
                is_active: true,
                health_factor: None,
            },
        ]
    }

    async fn setup_integration_scenario(scenario_name: &str) -> Result<IntegrationTestScenario, Box<dyn std::error::Error + Send + Sync>> {
        let price_feed = Arc::new(MockPriceFeedProvider::new());
        let trade_executor = Arc::new(MockTradeExecutor::new());
        
        let config = AegisConfig {
            monitoring_interval_secs: 1, // Fast monitoring for tests
            enable_automated_actions: true,
            enable_price_impact_simulation: true,
            enable_smart_contract_analysis: true,
            enable_mev_protection: true,
            max_concurrent_positions: 100,
        };

        let aegis = AegisSatellite::new(
            price_feed.clone(),
            trade_executor.clone(),
            Some(config)
        ).await?;

        // Add positions based on scenario
        let positions_data = match scenario_name {
            "diversified" => create_diversified_portfolio(),
            "risky" => create_risky_portfolio(),
            _ => create_diversified_portfolio(),
        };

        let mut positions = Vec::new();
        for position in positions_data {
            let position_id = aegis.add_position(position.clone()).await?;
            positions.push((position_id, position));
        }

        Ok(IntegrationTestScenario {
            aegis,
            price_feed,
            trade_executor,
            positions,
            scenario_name: scenario_name.to_string(),
        })
    }

    #[tokio::test]
    async fn test_complete_risk_management_workflow() {
        let scenario = setup_integration_scenario("diversified")
            .await
            .expect("Should set up integration scenario");

        // Step 1: Initial health assessment
        println!("=== Step 1: Initial Health Assessment ===");
        
        let mut initial_health_factors = Vec::new();
        for (position_id, _) in &scenario.positions {
            let health = scenario.aegis.get_position_health(*position_id)
                .await
                .expect("Should calculate initial health");
            
            initial_health_factors.push((position_id, health.health_factor));
            println!("Position {:?}: Health Factor = {:.2}", position_id, health.health_factor);
        }

        // All positions should be healthy initially
        for (_, health_factor) in &initial_health_factors {
            assert!(*health_factor > Decimal::new(110, 2)); // Above 1.1
        }

        // Step 2: Start monitoring system
        println!("=== Step 2: Starting Monitoring System ===");
        scenario.aegis.start().await.expect("Should start monitoring");

        // Wait for initial monitoring cycle
        tokio::time::sleep(std::time::Duration::from_millis(100)).await;

        // Step 3: Simulate market stress event
        println!("=== Step 3: Market Stress Event Simulation ===");
        scenario.price_feed.simulate_market_crash(0.3).await; // 30% crash

        // Wait for monitoring to detect changes
        tokio::time::sleep(std::time::Duration::from_millis(200)).await;

        // Step 4: Assess health after market stress
        println!("=== Step 4: Post-Stress Health Assessment ===");
        
        let mut stressed_health_factors = Vec::new();
        for (position_id, _) in &scenario.positions {
            let health = scenario.aegis.get_position_health(*position_id)
                .await
                .expect("Should calculate stressed health");
            
            stressed_health_factors.push((position_id, health.health_factor));
            println!("Position {:?}: Stressed Health Factor = {:.2}", position_id, health.health_factor);
        }

        // Health factors should have decreased
        for (i, (_, stressed_health)) in stressed_health_factors.iter().enumerate() {
            let (_, initial_health) = &initial_health_factors[i];
            assert!(*stressed_health < *initial_health, "Health factor should decrease under stress");
        }

        // Step 5: Check for generated alerts
        println!("=== Step 5: Alert System Verification ===");
        
        let mut total_alerts = 0;
        for (position_id, _) in &scenario.positions {
            let alerts = scenario.aegis.get_alerts(Some(*position_id))
                .await
                .expect("Should get alerts");
            
            total_alerts += alerts.len();
            println!("Position {:?}: {} alerts generated", position_id, alerts.len());
            
            for alert in &alerts {
                println!("  Alert: {}", alert.message);
            }
        }

        assert!(total_alerts > 0, "Should have generated alerts during market stress");

        // Step 6: Risk simulation and stress testing
        println!("=== Step 6: Comprehensive Risk Simulation ===");
        
        let simulation_positions: Vec<SimulationPosition> = scenario.positions.iter()
            .map(|(position_id, position)| SimulationPosition {
                token_address: position.token_address.clone(),
                quantity: 1.0,
                entry_price: 100.0,
                current_price: 100.0,
                collateral_value: position.collateral_amount.to_f64().unwrap_or(0.0),
                debt_value: position.debt_amount.to_f64().unwrap_or(0.0),
                liquidation_threshold: position.liquidation_threshold.to_f64().unwrap_or(1.2),
                health_factor: stressed_health_factors.iter()
                    .find(|(pid, _)| **pid == *position_id)
                    .map(|(_, hf)| hf.to_f64().unwrap_or(0.0))
                    .unwrap_or(1.0),
            })
            .collect();

        // Run different stress scenarios
        let stress_scenarios = vec![
            SimulationScenario::HistoricalMarketCrash,
            SimulationScenario::CryptoWinter,
            SimulationScenario::DeFiContagion,
            SimulationScenario::RegulatoryShock,
            SimulationScenario::BlackSwan,
        ];

        let mut scenario_results = Vec::new();
        for stress_scenario in stress_scenarios {
            let result = scenario.aegis.run_stress_test(&simulation_positions, &stress_scenario)
                .await
                .expect(&format!("Should run stress test for {:?}", stress_scenario));
            
            println!("Scenario {:?}: Portfolio Loss = {:.2}%, VaR = ${:.2}, CVaR = ${:.2}", 
                    stress_scenario, 
                    result.max_drawdown * 100.0,
                    result.var_95,
                    result.cvar_95);
            
            scenario_results.push((stress_scenario, result));
        }

        // Black Swan should have the worst outcome
        let black_swan_result = scenario_results.iter()
            .find(|(scenario, _)| matches!(scenario, SimulationScenario::BlackSwan))
            .expect("Should have Black Swan result");

        assert!(black_swan_result.1.max_drawdown < -0.7, "Black Swan should cause severe losses");

        // Step 7: Monte Carlo simulation for risk assessment
        println!("=== Step 7: Monte Carlo Risk Assessment ===");
        
        let mc_config = MonteCarloConfig {
            iterations: 500, // Reasonable number for testing
            time_horizon_days: 30,
            confidence_level: 0.95,
            price_volatility: 0.3, // 30% volatility
            correlation_matrix: vec![
                vec![1.0, 0.8, 0.6, 0.1], // BTC correlations
                vec![0.8, 1.0, 0.7, 0.1], // ETH correlations
                vec![0.6, 0.7, 1.0, 0.2], // AAVE correlations
                vec![0.1, 0.1, 0.2, 1.0], // USDC correlations
            ],
            drift_rates: HashMap::new(),
        };

        let mc_results = scenario.aegis.run_monte_carlo_simulation(&simulation_positions, &mc_config)
            .await
            .expect("Should run Monte Carlo simulation");

        assert_eq!(mc_results.len(), 500);
        
        // Calculate statistics from Monte Carlo results
        let portfolio_values: Vec<f64> = mc_results.iter()
            .map(|r| r.final_portfolio_value)
            .collect();
        
        let min_value = portfolio_values.iter().fold(f64::INFINITY, |a, &b| a.min(b));
        let max_value = portfolio_values.iter().fold(f64::NEG_INFINITY, |a, &b| a.max(b));
        let avg_value = portfolio_values.iter().sum::<f64>() / portfolio_values.len() as f64;

        println!("Monte Carlo Results: Min = ${:.2}, Max = ${:.2}, Avg = ${:.2}", 
                min_value, max_value, avg_value);

        assert!(max_value > min_value, "Should have variety in Monte Carlo outcomes");
        assert!(avg_value > 0.0, "Average portfolio value should be positive");

        // Step 8: Market recovery simulation
        println!("=== Step 8: Market Recovery Simulation ===");
        
        scenario.price_feed.simulate_market_recovery(0.4).await; // 40% recovery

        // Wait for price updates to propagate
        tokio::time::sleep(std::time::Duration::from_millis(200)).await;

        let mut recovery_health_factors = Vec::new();
        for (position_id, _) in &scenario.positions {
            let health = scenario.aegis.get_position_health(*position_id)
                .await
                .expect("Should calculate recovery health");
            
            recovery_health_factors.push((position_id, health.health_factor));
            println!("Position {:?}: Recovery Health Factor = {:.2}", position_id, health.health_factor);
        }

        // Health factors should improve during recovery
        for (i, (_, recovery_health)) in recovery_health_factors.iter().enumerate() {
            let (_, stressed_health) = &stressed_health_factors[i];
            assert!(*recovery_health > *stressed_health, "Health factor should improve during recovery");
        }

        // Step 9: Final system statistics
        println!("=== Step 9: Final System Statistics ===");
        
        let final_stats = scenario.aegis.get_statistics();
        println!("Final Stats: {} positions, {} active alerts, {} supported protocols",
                final_stats.total_positions,
                final_stats.active_alerts,
                final_stats.supported_protocols);

        assert_eq!(final_stats.total_positions, scenario.positions.len());

        // Step 10: Trade execution validation
        println!("=== Step 10: Trade Execution Validation ===");
        
        // Simulate a trade impact analysis
        let (first_position_id, _) = &scenario.positions[0];
        let trade_simulation = scenario.aegis.simulate_trade_impact(
            *first_position_id,
            "BTC",
            Decimal::new(1000, 0), // $1000 trade
        ).await.expect("Should simulate trade impact");

        println!("Trade Impact: Price Impact = {:.2}%, Slippage = {:.2}%",
                trade_simulation.price_impact_percent * 100.0,
                trade_simulation.estimated_slippage * 100.0);

        assert!(trade_simulation.estimated_execution_price > Decimal::ZERO);
        assert!(trade_simulation.price_impact_percent >= 0.0);

        println!("=== End-to-End Workflow Test Completed Successfully ===");
    }

    #[tokio::test]
    async fn test_high_risk_position_management() {
        let scenario = setup_integration_scenario("risky")
            .await
            .expect("Should set up risky scenario");

        // Start with risky positions
        scenario.aegis.start().await.expect("Should start monitoring");

        // Simulate moderate market stress
        scenario.price_feed.simulate_market_crash(0.15).await; // 15% drop

        tokio::time::sleep(std::time::Duration::from_millis(200)).await;

        // Check if any positions are approaching liquidation
        let mut at_risk_positions = Vec::new();
        for (position_id, _) in &scenario.positions {
            let health = scenario.aegis.get_position_health(*position_id)
                .await
                .expect("Should calculate health");

            if health.health_factor < Decimal::new(120, 2) { // Below 1.2
                at_risk_positions.push(*position_id);
            }
        }

        assert!(!at_risk_positions.is_empty(), "Should have positions at risk with high leverage");

        // Get alerts for at-risk positions
        let mut critical_alerts = 0;
        for position_id in &at_risk_positions {
            let alerts = scenario.aegis.get_alerts(Some(*position_id))
                .await
                .expect("Should get alerts");

            critical_alerts += alerts.len();
        }

        assert!(critical_alerts > 0, "Should have critical alerts for at-risk positions");

        // Simulate attempted liquidation protection trades
        let executed_trades = scenario.trade_executor.get_executed_trades().await;
        println!("Executed {} protective trades", executed_trades.len());

        // Even if no automated trades executed, the system should have detected the risk
    }

    #[tokio::test]
    async fn test_multi_protocol_integration() {
        let scenario = setup_integration_scenario("diversified")
            .await
            .expect("Should set up diversified scenario");

        // Verify positions span multiple protocols
        let protocols: std::collections::HashSet<String> = scenario.positions.iter()
            .map(|(_, position)| position.protocol.clone())
            .collect();

        assert!(protocols.len() >= 2, "Should have positions across multiple protocols");
        println!("Integrated protocols: {:?}", protocols);

        // Test health calculation across different protocols
        for (position_id, position) in &scenario.positions {
            let health = scenario.aegis.get_position_health(*position_id)
                .await
                .expect(&format!("Should calculate health for {} protocol", position.protocol));

            println!("Protocol {}: Position {:?} has health factor {:.2}",
                    position.protocol, position_id, health.health_factor);

            assert!(health.health_factor > Decimal::ZERO);
        }

        // Start monitoring to ensure cross-protocol monitoring works
        scenario.aegis.start().await.expect("Should start cross-protocol monitoring");

        // Simulate protocol-specific events
        scenario.price_feed.update_price("AAVE", Decimal::new(80, 0)).await; // AAVE price drop

        tokio::time::sleep(std::time::Duration::from_millis(200)).await;

        // Should detect impact on AAVE positions specifically
        let aave_positions: Vec<_> = scenario.positions.iter()
            .filter(|(_, pos)| pos.token_address == "AAVE")
            .collect();

        if !aave_positions.is_empty() {
            for (position_id, _) in aave_positions {
                let alerts = scenario.aegis.get_alerts(Some(*position_id))
                    .await
                    .expect("Should get AAVE position alerts");

                // AAVE positions should have alerts due to price drop
                println!("AAVE position {:?} has {} alerts", position_id, alerts.len());
            }
        }
    }

    #[tokio::test]
    async fn test_system_recovery_after_failures() {
        let scenario = setup_integration_scenario("diversified")
            .await
            .expect("Should set up scenario");

        // Start normal operations
        scenario.aegis.start().await.expect("Should start monitoring");

        // Verify normal operation
        let initial_stats = scenario.aegis.get_statistics();
        assert_eq!(initial_stats.total_positions, scenario.positions.len());

        // Simulate price feed failures
        scenario.price_feed.failure_rate = 0.7; // 70% failure rate

        // System should continue operating despite failures
        tokio::time::sleep(std::time::Duration::from_millis(300)).await;

        // Try to get health factors - some might fail but system should remain stable
        let mut successful_health_checks = 0;
        let mut failed_health_checks = 0;

        for (position_id, _) in &scenario.positions {
            match scenario.aegis.get_position_health(*position_id).await {
                Ok(_) => successful_health_checks += 1,
                Err(_) => failed_health_checks += 1,
            }
        }

        println!("Health checks during failures: {} succeeded, {} failed", 
                successful_health_checks, failed_health_checks);

        // Should have some failures due to price feed issues
        assert!(failed_health_checks > 0, "Should have some failures during price feed issues");

        // But system should still be operational
        let stats_during_failure = scenario.aegis.get_statistics();
        assert_eq!(stats_during_failure.total_positions, scenario.positions.len());

        // Recovery: restore price feed reliability
        scenario.price_feed.failure_rate = 0.0;

        tokio::time::sleep(std::time::Duration::from_millis(200)).await;

        // System should recover
        let mut recovered_health_checks = 0;
        for (position_id, _) in &scenario.positions {
            if scenario.aegis.get_position_health(*position_id).await.is_ok() {
                recovered_health_checks += 1;
            }
        }

        assert_eq!(recovered_health_checks, scenario.positions.len(), 
                  "All health checks should succeed after recovery");

        let final_stats = scenario.aegis.get_statistics();
        assert_eq!(final_stats.total_positions, scenario.positions.len());
    }

    #[tokio::test]
    async fn test_comprehensive_backtesting_workflow() {
        let scenario = setup_integration_scenario("diversified")
            .await
            .expect("Should set up scenario");

        // Convert positions to simulation format
        let position_ids: Vec<PositionId> = scenario.positions.iter()
            .map(|(id, _)| *id)
            .collect();

        let simulation_positions = scenario.aegis.convert_positions_to_simulation(&position_ids)
            .await
            .expect("Should convert positions to simulation format");

        // Run backtesting over different periods
        let periods = vec![
            (Duration::days(90), Duration::days(60)),  // 30-day backtest
            (Duration::days(60), Duration::days(30)),  // 30-day backtest
            (Duration::days(30), Duration::days(7)),   // 23-day backtest
        ];

        let mut backtest_results = Vec::new();
        for (start_offset, end_offset) in periods {
            let start_date = Utc::now() - start_offset;
            let end_date = Utc::now() - end_offset;

            let backtest_result = scenario.aegis.run_backtesting(&simulation_positions, start_date, end_date)
                .await
                .expect("Should run backtesting");

            println!("Backtest ({} to {}): Initial = ${:.2}, Final = ${:.2}, Drawdown = {:.2}%",
                    start_date.format("%Y-%m-%d"),
                    end_date.format("%Y-%m-%d"),
                    backtest_result.initial_portfolio_value,
                    backtest_result.final_portfolio_value,
                    backtest_result.max_drawdown * 100.0);

            backtest_results.push(backtest_result);
        }

        // All backtests should complete successfully
        assert_eq!(backtest_results.len(), 3);

        for result in &backtest_results {
            assert!(result.initial_portfolio_value > 0.0);
            assert!(result.final_portfolio_value > 0.0);
            assert!(!result.surviving_positions.is_empty());
        }

        // Generate comprehensive report
        if let Some(latest_result) = backtest_results.first() {
            let report = scenario.aegis.generate_simulation_report(latest_result, "comprehensive")
                .await
                .expect("Should generate simulation report");

            // Export report in different formats
            let json_report = scenario.aegis.export_report_json(&report)
                .await
                .expect("Should export JSON report");

            let csv_report = scenario.aegis.export_report_csv(&report)
                .await
                .expect("Should export CSV report");

            assert!(!json_report.is_empty());
            assert!(!csv_report.is_empty());
            
            println!("Generated comprehensive report: {} bytes JSON, {} bytes CSV",
                    json_report.len(), csv_report.len());
        }
    }

    #[tokio::test]
    async fn test_real_time_monitoring_workflow() {
        let scenario = setup_integration_scenario("diversified")
            .await
            .expect("Should set up scenario");

        // Start real-time monitoring
        scenario.aegis.start().await.expect("Should start monitoring");

        // Simulate real-time price updates
        let price_updates = vec![
            ("BTC", 51000.0),
            ("ETH", 3100.0),
            ("BTC", 49000.0), // Price drop
            ("ETH", 2900.0),  // Price drop
            ("AAVE", 95.0),   // Price drop
            ("BTC", 52000.0), // Recovery
            ("ETH", 3200.0),  // Recovery
        ];

        let mut monitoring_results = Vec::new();

        for (token, price) in price_updates {
            scenario.price_feed.update_price(token, Decimal::from_f64(price).unwrap()).await;
            
            // Wait for monitoring cycle
            tokio::time::sleep(std::time::Duration::from_millis(150)).await;

            // Capture system state
            let mut position_states = Vec::new();
            let mut alert_counts = Vec::new();

            for (position_id, position) in &scenario.positions {
                if position.token_address == token {
                    if let Ok(health) = scenario.aegis.get_position_health(*position_id).await {
                        position_states.push((*position_id, health.health_factor));
                    }

                    if let Ok(alerts) = scenario.aegis.get_alerts(Some(*position_id)).await {
                        alert_counts.push((*position_id, alerts.len()));
                    }
                }
            }

            monitoring_results.push((token.to_string(), price, position_states, alert_counts));
        }

        // Analyze monitoring results
        println!("=== Real-time Monitoring Results ===");
        for (token, price, positions, alerts) in &monitoring_results {
            println!("Token: {}, Price: ${:.2}", token, price);
            for (position_id, health_factor) in positions {
                println!("  Position {:?}: Health Factor = {:.2}", position_id, health_factor);
            }
            for (position_id, alert_count) in alerts {
                println!("  Position {:?}: {} alerts", position_id, alert_count);
            }
        }

        // Verify that monitoring detected price changes and health impacts
        assert!(!monitoring_results.is_empty());
        
        // Should have detected some health factor changes
        let health_changes: Vec<_> = monitoring_results.iter()
            .flat_map(|(_, _, positions, _)| positions)
            .collect();
        
        assert!(!health_changes.is_empty(), "Should have detected health factor changes");
    }
}