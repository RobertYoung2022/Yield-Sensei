use std::sync::Arc;
use tokio::sync::RwLock;
use chrono::{Utc, Duration};
use rust_decimal::Decimal;
use std::collections::HashMap;
use rand::{Rng, SeedableRng};
use rand::rngs::StdRng;

// Import the actual Aegis satellite simulation types
extern crate aegis_satellite;
use aegis_satellite::simulation::stress_testing::{
    StressTestingFramework, StressTestingConfig, SimulationScenario, CustomScenario,
    SimulationPosition, SimulationResult, RiskMetrics, SimulationRecommendation,
    RecommendationType, RecommendationPriority, MonteCarloConfig, HistoricalPricePoint
};

#[cfg(test)]
mod comprehensive_stress_testing_tests {
    use super::*;

    // Helper function to create test positions
    fn create_test_positions() -> Vec<SimulationPosition> {
        vec![
            SimulationPosition {
                token_address: "BTC".to_string(),
                quantity: 10.0,
                entry_price: 45000.0,
                current_price: 50000.0,
                collateral_value: 500000.0,
                debt_value: 200000.0,
                liquidation_threshold: 1.2,
                health_factor: 2.5,
            },
            SimulationPosition {
                token_address: "ETH".to_string(),
                quantity: 200.0,
                entry_price: 1400.0,
                current_price: 1500.0,
                collateral_value: 300000.0,
                debt_value: 150000.0,
                liquidation_threshold: 1.3,
                health_factor: 2.0,
            },
            SimulationPosition {
                token_address: "USDC".to_string(),
                quantity: 100000.0,
                entry_price: 1.0,
                current_price: 1.0,
                collateral_value: 100000.0,
                debt_value: 0.0,
                liquidation_threshold: 1.0,
                health_factor: f64::INFINITY,
            },
            SimulationPosition {
                token_address: "AAVE".to_string(),
                quantity: 1000.0,
                entry_price: 90.0,
                current_price: 100.0,
                collateral_value: 100000.0,
                debt_value: 50000.0,
                liquidation_threshold: 1.5,
                health_factor: 2.0,
            },
        ]
    }

    // Helper function to create risky positions (close to liquidation)
    fn create_risky_positions() -> Vec<SimulationPosition> {
        vec![
            SimulationPosition {
                token_address: "BTC".to_string(),
                quantity: 5.0,
                entry_price: 50000.0,
                current_price: 50000.0,
                collateral_value: 250000.0,
                debt_value: 200000.0,
                liquidation_threshold: 1.2,
                health_factor: 1.25, // Very close to liquidation threshold
            },
            SimulationPosition {
                token_address: "ETH".to_string(),
                quantity: 100.0,
                entry_price: 1500.0,
                current_price: 1500.0,
                collateral_value: 150000.0,
                debt_value: 110000.0,
                liquidation_threshold: 1.3,
                health_factor: 1.36, // Close to liquidation
            },
        ]
    }

    // Helper function to create historical price data
    fn create_historical_data() -> HashMap<String, Vec<HistoricalPricePoint>> {
        let mut data = HashMap::new();
        
        let mut btc_prices = Vec::new();
        let mut current_price = 45000.0;
        
        for i in 0..365 {
            // Simulate price volatility
            let change = (i as f64 * 0.1).sin() * 0.02; // 2% volatility
            current_price = (current_price * (1.0 + change)).max(1000.0);
            
            btc_prices.push(HistoricalPricePoint {
                timestamp: Utc::now() - Duration::days(365 - i),
                price: current_price,
                volume: 1000000.0 + (i as f64 * 10000.0),
                market_cap: Some(current_price * 19000000.0),
            });
        }
        
        data.insert("BTC".to_string(), btc_prices);
        data
    }

    #[tokio::test]
    async fn test_stress_testing_framework_initialization() {
        let config = StressTestingConfig::default();
        let framework = StressTestingFramework::new(config.clone());
        
        // Verify default configuration
        assert_eq!(config.scenarios.len(), 5);
        assert!(config.scenarios.contains(&SimulationScenario::HistoricalMarketCrash));
        assert!(config.scenarios.contains(&SimulationScenario::CryptoWinter));
        assert!(config.scenarios.contains(&SimulationScenario::DeFiContagion));
        assert!(config.scenarios.contains(&SimulationScenario::RegulatoryShock));
        assert!(config.scenarios.contains(&SimulationScenario::BlackSwan));
        
        assert_eq!(config.monte_carlo_config.iterations, 10000);
        assert_eq!(config.monte_carlo_config.time_horizon_days, 30);
        assert_eq!(config.monte_carlo_config.confidence_level, 0.95);
        assert!(config.backtesting_enabled);
        assert!(config.auto_recommendations);
    }

    #[tokio::test]
    async fn test_historical_market_crash_simulation() {
        let config = StressTestingConfig::default();
        let framework = StressTestingFramework::new(config);
        
        let positions = create_test_positions();
        let initial_value = 1000000.0; // 500k + 300k + 100k + 100k
        
        let result = framework.run_stress_test(&positions, &SimulationScenario::HistoricalMarketCrash)
            .await
            .expect("Should run stress test");
        
        // Verify simulation results
        assert_eq!(result.scenario, SimulationScenario::HistoricalMarketCrash);
        assert!(result.initial_portfolio_value > 0.0);
        assert!(result.final_portfolio_value < result.initial_portfolio_value); // Should show losses
        assert!(result.max_drawdown < 0.0); // Should be negative
        assert!(result.var_95 < 0.0); // VaR should be negative
        assert!(result.cvar_95 < 0.0); // CVaR should be negative
        assert!(result.simulation_duration_ms > 0);
        
        // Market crash should significantly impact BTC and ETH
        // USDC should be relatively stable
        // AAVE might be affected depending on scenario template
        
        // Should generate recommendations if auto_recommendations is enabled
        if !result.recommendations.is_empty() {
            assert!(result.recommendations.iter().any(|r| 
                matches!(r.recommendation_type, RecommendationType::IncreaseCollateral | 
                        RecommendationType::ReduceExposure | 
                        RecommendationType::HedgeRisk)
            ));
        }
    }

    #[tokio::test]
    async fn test_crypto_winter_simulation() {
        let config = StressTestingConfig::default();
        let framework = StressTestingFramework::new(config);
        
        let positions = create_test_positions();
        
        let result = framework.run_stress_test(&positions, &SimulationScenario::CryptoWinter)
            .await
            .expect("Should run crypto winter simulation");
        
        assert_eq!(result.scenario, SimulationScenario::CryptoWinter);
        
        // Crypto winter should have severe impact on crypto assets
        // BTC should drop -80%, ETH should drop -85%
        // This should result in significant portfolio loss
        assert!(result.max_drawdown < -0.5); // At least 50% drawdown expected
        
        // Should have severe risk metrics
        assert!(result.var_95 < result.initial_portfolio_value * -0.3);
        assert!(result.cvar_95 < result.var_95);
    }

    #[tokio::test]
    async fn test_defi_contagion_simulation() {
        let config = StressTestingConfig::default();
        let framework = StressTestingFramework::new(config);
        
        let positions = create_test_positions();
        
        let result = framework.run_stress_test(&positions, &SimulationScenario::DeFiContagion)
            .await
            .expect("Should run DeFi contagion simulation");
        
        assert_eq!(result.scenario, SimulationScenario::DeFiContagion);
        
        // DeFi contagion should particularly affect AAVE and other DeFi tokens
        // BTC and ETH might be less affected, USDC should be somewhat stable
        
        // Verify that DeFi-related positions are identified in the analysis
        // (This would depend on the scenario template configuration)
    }

    #[tokio::test]
    async fn test_black_swan_simulation() {
        let config = StressTestingConfig::default();
        let framework = StressTestingFramework::new(config);
        
        let positions = create_test_positions();
        
        let result = framework.run_stress_test(&positions, &SimulationScenario::BlackSwan)
            .await
            .expect("Should run black swan simulation");
        
        assert_eq!(result.scenario, SimulationScenario::BlackSwan);
        
        // Black swan should have extreme impact
        // BTC -90%, ETH -95%, even USDC -50%
        assert!(result.max_drawdown < -0.8); // At least 80% drawdown
        
        // Should generate critical recommendations
        assert!(!result.recommendations.is_empty());
        let has_critical_rec = result.recommendations.iter()
            .any(|r| matches!(r.priority, RecommendationPriority::Critical));
        assert!(has_critical_rec);
    }

    #[tokio::test]
    async fn test_liquidation_detection() {
        let config = StressTestingConfig::default();
        let framework = StressTestingFramework::new(config);
        
        // Use risky positions that are close to liquidation
        let risky_positions = create_risky_positions();
        
        let result = framework.run_stress_test(&risky_positions, &SimulationScenario::HistoricalMarketCrash)
            .await
            .expect("Should run stress test on risky positions");
        
        // With risky positions and market crash, some should be liquidated
        assert!(!result.liquidated_positions.is_empty());
        assert!(result.surviving_positions.len() < risky_positions.len());
        
        // Should generate critical recommendations about liquidation risk
        let has_liquidation_rec = result.recommendations.iter()
            .any(|r| matches!(r.recommendation_type, RecommendationType::IncreaseCollateral));
        assert!(has_liquidation_rec);
    }

    #[tokio::test]
    async fn test_monte_carlo_simulation() {
        let config = StressTestingConfig::default();
        let framework = StressTestingFramework::new(config);
        
        let positions = create_test_positions();
        
        // Configure Monte Carlo with fewer iterations for testing
        let mc_config = MonteCarloConfig {
            iterations: 100, // Reduced for testing speed
            time_horizon_days: 30,
            confidence_level: 0.95,
            price_volatility: 0.2, // 20% volatility
            correlation_matrix: vec![vec![1.0]],
            drift_rates: HashMap::new(),
        };
        
        let results = framework.run_monte_carlo_simulation(&positions, &mc_config)
            .await
            .expect("Should run Monte Carlo simulation");
        
        // Verify Monte Carlo results
        assert_eq!(results.len(), 100);
        
        // All results should have the same VaR and CVaR (calculated from all iterations)
        let first_var = results[0].var_95;
        let first_cvar = results[0].cvar_95;
        
        for result in &results {
            assert!((result.var_95 - first_var).abs() < 0.001);
            assert!((result.cvar_95 - first_cvar).abs() < 0.001);
        }
        
        // CVaR should be more extreme than VaR
        assert!(first_cvar < first_var);
        
        // Results should show variety in portfolio values
        let portfolio_values: Vec<f64> = results.iter()
            .map(|r| r.final_portfolio_value)
            .collect();
        
        let min_value = portfolio_values.iter().fold(f64::INFINITY, |a, &b| a.min(b));
        let max_value = portfolio_values.iter().fold(f64::NEG_INFINITY, |a, &b| a.max(b));
        
        assert!(max_value > min_value); // Should have variety in outcomes
    }

    #[tokio::test]
    async fn test_backtesting_simulation() {
        let config = StressTestingConfig::default();
        let mut framework = StressTestingFramework::new(config);
        
        // Add historical data to the framework
        let historical_data = create_historical_data();
        {
            let mut data = framework.historical_data.write().await;
            for (token, prices) in historical_data {
                data.insert(token, prices);
            }
        }
        
        let positions = vec![
            SimulationPosition {
                token_address: "BTC".to_string(),
                quantity: 1.0,
                entry_price: 45000.0,
                current_price: 45000.0,
                collateral_value: 45000.0,
                debt_value: 0.0,
                liquidation_threshold: 1.0,
                health_factor: f64::INFINITY,
            }
        ];
        
        let start_date = Utc::now() - Duration::days(90);
        let end_date = Utc::now() - Duration::days(30);
        
        let result = framework.run_backtesting(&positions, start_date, end_date)
            .await
            .expect("Should run backtesting");
        
        // Verify backtesting results
        assert!(result.initial_portfolio_value > 0.0);
        assert!(result.final_portfolio_value > 0.0);
        
        // Should have some performance metrics
        // The actual values depend on the simulated historical data
    }

    #[tokio::test]
    async fn test_risk_metrics_calculation() {
        let config = StressTestingConfig::default();
        let framework = StressTestingFramework::new(config);
        
        let positions = create_test_positions();
        
        let result = framework.run_stress_test(&positions, &SimulationScenario::RegulatoryShock)
            .await
            .expect("Should run regulatory shock simulation");
        
        // Verify risk metrics are calculated
        let metrics = &result.risk_metrics;
        
        // Sharpe ratio should be calculated
        assert!(metrics.sharpe_ratio.is_finite());
        
        // Sortino ratio should be calculated
        assert!(metrics.sortino_ratio.is_finite());
        
        // Volatility should be positive
        assert!(metrics.volatility > 0.0);
        
        // Beta should be calculated
        assert!(metrics.beta.is_finite());
        
        // Correlation matrix should exist
        assert!(!metrics.correlation_matrix.is_empty());
    }

    #[tokio::test]
    async fn test_recommendation_generation() {
        let config = StressTestingConfig::default();
        let framework = StressTestingFramework::new(config);
        
        let risky_positions = create_risky_positions();
        
        let result = framework.run_stress_test(&risky_positions, &SimulationScenario::CryptoWinter)
            .await
            .expect("Should run stress test");
        
        // Should generate recommendations for risky portfolio under severe stress
        assert!(!result.recommendations.is_empty());
        
        // Verify recommendation structure
        for rec in &result.recommendations {
            assert!(!rec.description.is_empty());
            assert!(rec.expected_impact >= 0.0 && rec.expected_impact <= 1.0);
            assert!(rec.implementation_cost >= 0.0);
            assert!(rec.time_to_implement > 0);
            assert!(rec.confidence >= 0.0 && rec.confidence <= 1.0);
        }
        
        // Should have critical or high priority recommendations
        let has_high_priority = result.recommendations.iter()
            .any(|r| matches!(r.priority, RecommendationPriority::Critical | RecommendationPriority::High));
        assert!(has_high_priority);
        
        // Should include relevant recommendation types
        let rec_types: Vec<&RecommendationType> = result.recommendations.iter()
            .map(|r| &r.recommendation_type)
            .collect();
        
        assert!(rec_types.iter().any(|t| matches!(t, 
            RecommendationType::IncreaseCollateral | 
            RecommendationType::ReduceExposure |
            RecommendationType::HedgeRisk |
            RecommendationType::RebalanceAllocation
        )));
    }

    #[tokio::test]
    async fn test_simulation_caching() {
        let config = StressTestingConfig::default();
        let framework = StressTestingFramework::new(config);
        
        let positions = create_test_positions();
        
        // First simulation (should be cached)
        let start1 = std::time::Instant::now();
        let result1 = framework.run_stress_test(&positions, &SimulationScenario::RegulatoryShock)
            .await
            .expect("Should run first simulation");
        let duration1 = start1.elapsed();
        
        // Second simulation with same parameters (should use cache)
        let start2 = std::time::Instant::now();
        let result2 = framework.run_stress_test(&positions, &SimulationScenario::RegulatoryShock)
            .await
            .expect("Should run second simulation");
        let duration2 = start2.elapsed();
        
        // Results should be identical
        assert_eq!(result1.scenario, result2.scenario);
        assert!((result1.initial_portfolio_value - result2.initial_portfolio_value).abs() < 0.01);
        assert!((result1.final_portfolio_value - result2.final_portfolio_value).abs() < 0.01);
        
        // Second call should be faster (cached)
        assert!(duration2 <= duration1 * 2); // Allow some variance for test stability
    }

    #[tokio::test]
    async fn test_cache_management() {
        let config = StressTestingConfig::default();
        let framework = StressTestingFramework::new(config);
        
        // Run simulation to populate cache
        let positions = create_test_positions();
        let _result = framework.run_stress_test(&positions, &SimulationScenario::RegulatoryShock)
            .await
            .expect("Should run simulation");
        
        // Check cache stats
        let stats = framework.get_cache_stats().await.expect("Should get cache stats");
        assert!(stats.get("simulation_cache_entries").unwrap_or(&0) > &0);
        
        // Clear cache
        framework.clear_cache().await.expect("Should clear cache");
        
        // Check cache is empty
        let stats_after = framework.get_cache_stats().await.expect("Should get cache stats");
        assert_eq!(stats_after.get("simulation_cache_entries").unwrap_or(&0), &0);
    }

    #[tokio::test]
    async fn test_portfolio_value_calculation() {
        let config = StressTestingConfig::default();
        let framework = StressTestingFramework::new(config);
        
        let positions = vec![
            SimulationPosition {
                token_address: "TEST1".to_string(),
                quantity: 10.0,
                entry_price: 100.0,
                current_price: 110.0,
                collateral_value: 1100.0,
                debt_value: 500.0,
                liquidation_threshold: 1.2,
                health_factor: 2.2,
            },
            SimulationPosition {
                token_address: "TEST2".to_string(),
                quantity: 5.0,
                entry_price: 200.0,
                current_price: 180.0,
                collateral_value: 900.0,
                debt_value: 300.0,
                liquidation_threshold: 1.3,
                health_factor: 3.0,
            },
        ];
        
        let portfolio_value = framework.calculate_portfolio_value(&positions).await.expect("Should calculate value");
        
        // Expected: (1100 - 500) + (900 - 300) = 600 + 600 = 1200
        assert!((portfolio_value - 1200.0).abs() < 0.01);
    }

    #[tokio::test]
    async fn test_var_and_cvar_calculation() {
        let config = StressTestingConfig::default();
        let framework = StressTestingFramework::new(config);
        
        // Test with known return distribution
        let returns = vec![-0.10, -0.08, -0.05, -0.03, -0.01, 0.01, 0.03, 0.05, 0.08, 0.10];
        
        let var_95 = framework.calculate_var_from_returns(&returns, 0.95).await.expect("Should calculate VaR");
        let cvar_95 = framework.calculate_cvar_from_returns(&returns, 0.95).await.expect("Should calculate CVaR");
        
        // VaR at 95% should be around the 5th percentile
        assert!(var_95 < 0.0); // Should be negative (loss)
        assert!(cvar_95 <= var_95); // CVaR should be more extreme than VaR
        
        // With 10 data points, 95% confidence means 5% tail (0.5 data points)
        // So VaR should be around -0.10 (worst case)
        assert!((var_95 - (-0.10)).abs() < 0.02);
    }

    #[tokio::test]
    async fn test_max_drawdown_calculation() {
        let config = StressTestingConfig::default();
        let framework = StressTestingFramework::new(config);
        
        // Portfolio values showing a drawdown scenario
        let portfolio_values = vec![100.0, 110.0, 120.0, 100.0, 80.0, 90.0, 105.0, 115.0];
        
        let max_drawdown = framework.calculate_max_drawdown(&portfolio_values).await.expect("Should calculate drawdown");
        
        // Peak was 120.0, trough was 80.0
        // Max drawdown = (80 - 120) / 120 = -40/120 = -0.333
        assert!((max_drawdown - (-1.0/3.0)).abs() < 0.01);
        assert!(max_drawdown < 0.0); // Should be negative
    }

    #[tokio::test]
    async fn test_scenario_template_coverage() {
        let config = StressTestingConfig::default();
        let framework = StressTestingFramework::new(config);
        
        // Test that all default scenarios have templates
        let scenarios = vec![
            SimulationScenario::HistoricalMarketCrash,
            SimulationScenario::CryptoWinter,
            SimulationScenario::DeFiContagion,
            SimulationScenario::RegulatoryShock,
            SimulationScenario::BlackSwan,
        ];
        
        for scenario in scenarios {
            // This tests that the scenario templates are properly initialized
            // by running a stress test for each scenario
            let positions = create_test_positions();
            let result = framework.run_stress_test(&positions, &scenario)
                .await
                .expect(&format!("Should run stress test for {:?}", scenario));
            
            assert_eq!(result.scenario, scenario);
            assert!(result.simulation_duration_ms > 0);
        }
    }

    #[tokio::test]
    async fn test_extreme_position_scenarios() {
        let config = StressTestingConfig::default();
        let framework = StressTestingFramework::new(config);
        
        // Test with position that should definitely be liquidated
        let extreme_positions = vec![
            SimulationPosition {
                token_address: "BTC".to_string(),
                quantity: 1.0,
                entry_price: 50000.0,
                current_price: 50000.0,
                collateral_value: 50000.0,
                debt_value: 48000.0,
                liquidation_threshold: 1.2,
                health_factor: 1.04, // Below liquidation threshold of 1.2
            },
        ];
        
        let result = framework.run_stress_test(&extreme_positions, &SimulationScenario::HistoricalMarketCrash)
            .await
            .expect("Should run stress test");
        
        // Position should be liquidated even before applying shocks
        // Or definitely liquidated after market crash shocks
        assert!(!result.liquidated_positions.is_empty());
        assert!(result.liquidated_positions.contains(&"BTC".to_string()));
    }

    #[tokio::test]
    async fn test_performance_with_large_portfolio() {
        let config = StressTestingConfig::default();
        let framework = StressTestingFramework::new(config);
        
        // Create large portfolio with many positions
        let mut large_portfolio = Vec::new();
        for i in 0..100 {
            large_portfolio.push(SimulationPosition {
                token_address: format!("TOKEN{}", i),
                quantity: 1000.0,
                entry_price: 10.0,
                current_price: 10.0 + (i as f64 % 5.0),
                collateral_value: 10000.0 + (i as f64 * 100.0),
                debt_value: 5000.0,
                liquidation_threshold: 1.2,
                health_factor: 2.0,
            });
        }
        
        let start = std::time::Instant::now();
        let result = framework.run_stress_test(&large_portfolio, &SimulationScenario::RegulatoryShock)
            .await
            .expect("Should run stress test on large portfolio");
        let duration = start.elapsed();
        
        // Should complete within reasonable time
        assert!(duration.as_millis() < 2000, "Large portfolio stress test took {}ms, should be <2000ms", duration.as_millis());
        
        // Should handle all positions
        let total_positions = result.liquidated_positions.len() + result.surviving_positions.len();
        assert_eq!(total_positions, 100);
        
        // Should generate recommendations for large portfolio
        assert!(!result.recommendations.is_empty());
    }

    #[tokio::test]
    async fn test_monte_carlo_statistical_properties() {
        let config = StressTestingConfig::default();
        let framework = StressTestingFramework::new(config);
        
        let positions = vec![
            SimulationPosition {
                token_address: "TEST".to_string(),
                quantity: 1000.0,
                entry_price: 10.0,
                current_price: 10.0,
                collateral_value: 10000.0,
                debt_value: 0.0,
                liquidation_threshold: 1.0,
                health_factor: f64::INFINITY,
            },
        ];
        
        let mc_config = MonteCarloConfig {
            iterations: 1000,
            time_horizon_days: 30,
            confidence_level: 0.95,
            price_volatility: 0.1, // 10% volatility
            correlation_matrix: vec![vec![1.0]],
            drift_rates: HashMap::new(),
        };
        
        let results = framework.run_monte_carlo_simulation(&positions, &mc_config)
            .await
            .expect("Should run Monte Carlo simulation");
        
        assert_eq!(results.len(), 1000);
        
        // Calculate returns distribution
        let returns: Vec<f64> = results.iter()
            .map(|r| (r.final_portfolio_value - r.initial_portfolio_value) / r.initial_portfolio_value)
            .collect();
        
        // Calculate mean and standard deviation
        let mean = returns.iter().sum::<f64>() / returns.len() as f64;
        let variance = returns.iter()
            .map(|r| (r - mean).powi(2))
            .sum::<f64>() / returns.len() as f64;
        let std_dev = variance.sqrt();
        
        // With no drift and 10% volatility, mean should be close to 0
        assert!(mean.abs() < 0.05, "Mean return {} should be close to 0", mean);
        
        // Standard deviation should be roughly similar to input volatility
        assert!(std_dev > 0.05 && std_dev < 0.15, "Std dev {} should be around 0.1", std_dev);
        
        // Distribution should be roughly normal (check that extreme values are rare)
        let extreme_positive = returns.iter().filter(|&&r| r > 0.3).count();
        let extreme_negative = returns.iter().filter(|&&r| r < -0.3).count();
        
        assert!(extreme_positive < 50, "Too many extreme positive returns: {}", extreme_positive);
        assert!(extreme_negative < 50, "Too many extreme negative returns: {}", extreme_negative);
    }

    #[tokio::test]
    async fn test_error_handling_edge_cases() {
        let config = StressTestingConfig::default();
        let framework = StressTestingFramework::new(config);
        
        // Test with empty positions
        let empty_positions = Vec::new();
        let result = framework.run_stress_test(&empty_positions, &SimulationScenario::RegulatoryShock)
            .await;
        
        // Should handle empty portfolio gracefully
        assert!(result.is_ok());
        let result = result.unwrap();
        assert_eq!(result.initial_portfolio_value, 0.0);
        assert_eq!(result.final_portfolio_value, 0.0);
        
        // Test with positions having zero values
        let zero_positions = vec![
            SimulationPosition {
                token_address: "ZERO".to_string(),
                quantity: 0.0,
                entry_price: 0.0,
                current_price: 0.0,
                collateral_value: 0.0,
                debt_value: 0.0,
                liquidation_threshold: 1.0,
                health_factor: 1.0,
            },
        ];
        
        let result = framework.run_stress_test(&zero_positions, &SimulationScenario::RegulatoryShock)
            .await;
        
        assert!(result.is_ok());
        
        // Test Monte Carlo with zero iterations
        let mc_config = MonteCarloConfig {
            iterations: 0,
            time_horizon_days: 30,
            confidence_level: 0.95,
            price_volatility: 0.1,
            correlation_matrix: vec![vec![1.0]],
            drift_rates: HashMap::new(),
        };
        
        let positions = create_test_positions();
        let mc_result = framework.run_monte_carlo_simulation(&positions, &mc_config).await;
        
        assert!(mc_result.is_ok());
        let mc_result = mc_result.unwrap();
        assert_eq!(mc_result.len(), 0);
    }

    #[tokio::test]
    async fn test_comprehensive_simulation_coverage() {
        let config = StressTestingConfig::default();
        let framework = StressTestingFramework::new(config);
        
        let positions = create_test_positions();
        let mut all_results = Vec::new();
        
        // Run all default scenarios
        for scenario in &[
            SimulationScenario::HistoricalMarketCrash,
            SimulationScenario::CryptoWinter,
            SimulationScenario::DeFiContagion,
            SimulationScenario::RegulatoryShock,
            SimulationScenario::BlackSwan,
        ] {
            let result = framework.run_stress_test(&positions, scenario)
                .await
                .expect(&format!("Should run {:?} scenario", scenario));
            
            all_results.push(result);
        }
        
        // Verify that different scenarios produce different results
        let drawdowns: Vec<f64> = all_results.iter().map(|r| r.max_drawdown).collect();
        
        // Black swan should have the worst drawdown
        let black_swan_result = all_results.iter()
            .find(|r| matches!(r.scenario, SimulationScenario::BlackSwan))
            .expect("Should have black swan result");
        
        // Regulatory shock should have the mildest impact
        let regulatory_result = all_results.iter()
            .find(|r| matches!(r.scenario, SimulationScenario::RegulatoryShock))
            .expect("Should have regulatory result");
        
        assert!(black_swan_result.max_drawdown < regulatory_result.max_drawdown);
        
        // All scenarios should have generated some analysis
        for result in &all_results {
            assert!(result.simulation_duration_ms > 0);
            assert!(result.var_95 != 0.0 || result.cvar_95 != 0.0);
        }
    }
}