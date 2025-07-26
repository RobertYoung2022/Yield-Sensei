#[cfg(test)]
mod tests {
    use super::*;
    use chrono::{Utc, Duration};
    use std::collections::HashMap;

    #[tokio::test]
    async fn test_stress_testing_framework_creation() {
        let config = StressTestingConfig::default();
        let framework = StressTestingFramework::new(config);
        
        assert_eq!(framework.config.scenarios.len(), 5); // Default scenarios
        assert_eq!(framework.config.monte_carlo_config.iterations, 10000);
    }

    #[tokio::test]
    async fn test_simulation_position_creation() {
        let position = SimulationPosition {
            token_address: "0x1234567890abcdef".to_string(),
            quantity: 100.0,
            entry_price: 50.0,
            current_price: 55.0,
            collateral_value: 5500.0,
            debt_value: 3000.0,
            liquidation_threshold: 0.8,
            health_factor: 1.83,
        };

        assert_eq!(position.token_address, "0x1234567890abcdef");
        assert_eq!(position.quantity, 100.0);
        assert_eq!(position.health_factor, 1.83);
    }

    #[tokio::test]
    async fn test_historical_market_crash_scenario() {
        let config = StressTestingConfig::default();
        let framework = StressTestingFramework::new(config);
        
        let positions = vec![
            SimulationPosition {
                token_address: "BTC".to_string(),
                quantity: 1.0,
                entry_price: 50000.0,
                current_price: 50000.0,
                collateral_value: 50000.0,
                debt_value: 25000.0,
                liquidation_threshold: 0.8,
                health_factor: 2.0,
            }
        ];

        let scenario = SimulationScenario::HistoricalMarketCrash;
        let result = framework.run_stress_test(&positions, &scenario).await.unwrap();

        assert!(result.final_portfolio_value < result.initial_portfolio_value);
        assert!(result.max_drawdown > 0.0);
        assert!(!result.recommendations.is_empty());
    }

    #[tokio::test]
    async fn test_monte_carlo_simulation() {
        let config = StressTestingConfig::default();
        let framework = StressTestingFramework::new(config);
        
        let positions = vec![
            SimulationPosition {
                token_address: "ETH".to_string(),
                quantity: 10.0,
                entry_price: 3000.0,
                current_price: 3000.0,
                collateral_value: 30000.0,
                debt_value: 15000.0,
                liquidation_threshold: 0.8,
                health_factor: 2.0,
            }
        ];

        let monte_carlo_config = MonteCarloConfig {
            iterations: 100, // Reduced for testing
            time_horizon_days: 30,
            confidence_level: 0.95,
            price_volatility: 0.5,
            correlation_matrix: vec![vec![1.0]],
            drift_rates: HashMap::new(),
        };

        let results = framework.run_monte_carlo_simulation(&positions, &monte_carlo_config).await.unwrap();

        assert_eq!(results.len(), 100);
        assert!(results.iter().all(|r| r.var_95 > 0.0));
        assert!(results.iter().all(|r| r.cvar_95 > 0.0));
    }

    #[tokio::test]
    async fn test_backtesting() {
        let config = StressTestingConfig::default();
        let framework = StressTestingFramework::new(config);
        
        let positions = vec![
            SimulationPosition {
                token_address: "USDC".to_string(),
                quantity: 10000.0,
                entry_price: 1.0,
                current_price: 1.0,
                collateral_value: 10000.0,
                debt_value: 5000.0,
                liquidation_threshold: 0.8,
                health_factor: 2.0,
            }
        ];

        let start_date = Utc::now() - Duration::days(30);
        let end_date = Utc::now();

        let result = framework.run_backtesting(&positions, start_date, end_date).await.unwrap();

        assert!(result.simulation_duration_ms > 0);
        assert!(!result.recommendations.is_empty());
    }

    #[tokio::test]
    async fn test_custom_scenario() {
        let config = StressTestingConfig::default();
        let framework = StressTestingFramework::new(config);
        
        let mut price_shocks = HashMap::new();
        price_shocks.insert("BTC".to_string(), -0.30);
        price_shocks.insert("ETH".to_string(), -0.40);

        let custom_scenario = CustomScenario {
            name: "Custom Test Scenario".to_string(),
            description: "A custom test scenario for validation".to_string(),
            price_shocks,
            volume_shocks: HashMap::new(),
            volatility_multiplier: 2.0,
            correlation_breakdown: true,
            liquidity_crisis: false,
            duration_days: 7,
        };

        let scenario = SimulationScenario::Custom(custom_scenario);
        let positions = vec![
            SimulationPosition {
                token_address: "BTC".to_string(),
                quantity: 1.0,
                entry_price: 50000.0,
                current_price: 50000.0,
                collateral_value: 50000.0,
                debt_value: 25000.0,
                liquidation_threshold: 0.8,
                health_factor: 2.0,
            }
        ];

        let result = framework.run_stress_test(&positions, &scenario).await.unwrap();

        assert!(result.final_portfolio_value < result.initial_portfolio_value);
        assert!(result.max_drawdown > 0.0);
    }

    #[tokio::test]
    async fn test_cache_functionality() {
        let config = StressTestingConfig::default();
        let framework = StressTestingFramework::new(config);
        
        let positions = vec![
            SimulationPosition {
                token_address: "LINK".to_string(),
                quantity: 100.0,
                entry_price: 20.0,
                current_price: 20.0,
                collateral_value: 2000.0,
                debt_value: 1000.0,
                liquidation_threshold: 0.8,
                health_factor: 2.0,
            }
        ];

        let scenario = SimulationScenario::CryptoWinter;

        // First run
        let result1 = framework.run_stress_test(&positions, &scenario).await.unwrap();
        
        // Second run (should use cache)
        let result2 = framework.run_stress_test(&positions, &scenario).await.unwrap();

        // Results should be identical due to caching
        assert_eq!(result1.final_portfolio_value, result2.final_portfolio_value);
        assert_eq!(result1.max_drawdown, result2.max_drawdown);

        // Test cache stats
        let cache_stats = framework.get_cache_stats().await.unwrap();
        assert!(!cache_stats.is_empty());

        // Test cache clearing
        framework.clear_cache().await.unwrap();
        let cache_stats_after_clear = framework.get_cache_stats().await.unwrap();
        assert!(cache_stats_after_clear.is_empty());
    }

    #[tokio::test]
    async fn test_risk_metrics_calculation() {
        let config = StressTestingConfig::default();
        let framework = StressTestingFramework::new(config);
        
        let initial_positions = vec![
            SimulationPosition {
                token_address: "UNI".to_string(),
                quantity: 100.0,
                entry_price: 10.0,
                current_price: 10.0,
                collateral_value: 1000.0,
                debt_value: 500.0,
                liquidation_threshold: 0.8,
                health_factor: 2.0,
            }
        ];

        let final_positions = vec![
            SimulationPosition {
                token_address: "UNI".to_string(),
                quantity: 100.0,
                entry_price: 10.0,
                current_price: 8.0, // 20% drop
                collateral_value: 800.0,
                debt_value: 500.0,
                liquidation_threshold: 0.8,
                health_factor: 1.6,
            }
        ];

        let risk_metrics = framework.calculate_risk_metrics(&initial_positions, &final_positions).await.unwrap();

        assert!(risk_metrics.volatility > 0.0);
        assert!(risk_metrics.max_drawdown_duration > 0);
        assert!(!risk_metrics.correlation_matrix.is_empty());
    }

    #[tokio::test]
    async fn test_recommendation_generation() {
        let config = StressTestingConfig::default();
        let framework = StressTestingFramework::new(config);
        
        let positions = vec![
            SimulationPosition {
                token_address: "AAVE".to_string(),
                quantity: 50.0,
                entry_price: 100.0,
                current_price: 80.0, // 20% drop
                collateral_value: 4000.0,
                debt_value: 3000.0,
                liquidation_threshold: 0.8,
                health_factor: 1.33, // Close to liquidation
            }
        ];

        let risk_metrics = RiskMetrics {
            sharpe_ratio: -0.5,
            sortino_ratio: -0.6,
            calmar_ratio: -0.3,
            max_drawdown_duration: 5,
            recovery_time_days: Some(10),
            volatility: 0.4,
            beta: 1.2,
            correlation_matrix: vec![vec![1.0]],
        };

        let liquidated_positions = vec![];

        let recommendations = framework.generate_recommendations(&positions, &risk_metrics, &liquidated_positions).await.unwrap();

        assert!(!recommendations.is_empty());
        
        // Should have high priority recommendations for positions close to liquidation
        let high_priority_recommendations: Vec<_> = recommendations
            .iter()
            .filter(|r| matches!(r.priority, RecommendationPriority::High | RecommendationPriority::Critical))
            .collect();
        
        assert!(!high_priority_recommendations.is_empty());
    }

    #[tokio::test]
    async fn test_var_cvar_calculation() {
        let config = StressTestingConfig::default();
        let framework = StressTestingFramework::new(config);
        
        let positions = vec![
            SimulationPosition {
                token_address: "COMP".to_string(),
                quantity: 20.0,
                entry_price: 200.0,
                current_price: 200.0,
                collateral_value: 4000.0,
                debt_value: 2000.0,
                liquidation_threshold: 0.8,
                health_factor: 2.0,
            }
        ];

        let scenario = SimulationScenario::DeFiContagion;
        
        let var_95 = framework.calculate_var_95(&positions, &scenario).await.unwrap();
        let cvar_95 = framework.calculate_cvar_95(&positions, &scenario).await.unwrap();

        assert!(var_95 > 0.0);
        assert!(cvar_95 > var_95); // CVaR should be greater than VaR
    }

    #[tokio::test]
    async fn test_max_drawdown_calculation() {
        let config = StressTestingConfig::default();
        let framework = StressTestingFramework::new(config);
        
        let portfolio_values = vec![10000.0, 9500.0, 8000.0, 8500.0, 9000.0, 9500.0, 10000.0];
        
        let max_drawdown = framework.calculate_max_drawdown(&portfolio_values).await.unwrap();
        
        // Max drawdown should be 20% (from 10000 to 8000)
        assert!((max_drawdown - 0.20).abs() < 0.01);
    }

    #[tokio::test]
    async fn test_price_movement_simulation() {
        let config = StressTestingConfig::default();
        let framework = StressTestingFramework::new(config);
        
        let positions = vec![
            SimulationPosition {
                token_address: "SNX".to_string(),
                quantity: 100.0,
                entry_price: 5.0,
                current_price: 5.0,
                collateral_value: 500.0,
                debt_value: 250.0,
                liquidation_threshold: 0.8,
                health_factor: 2.0,
            }
        ];

        let monte_carlo_config = MonteCarloConfig {
            iterations: 1000,
            time_horizon_days: 30,
            confidence_level: 0.95,
            price_volatility: 0.3,
            correlation_matrix: vec![vec![1.0]],
            drift_rates: HashMap::new(),
        };

        let mut rng = rand::thread_rng();
        let simulated_positions = framework.simulate_price_movements(&positions, &monte_carlo_config, &mut rng).await.unwrap();

        assert_eq!(simulated_positions.len(), positions.len());
        
        // Prices should have changed due to simulation
        for (original, simulated) in positions.iter().zip(simulated_positions.iter()) {
            assert_ne!(original.current_price, simulated.current_price);
        }
    }
} 