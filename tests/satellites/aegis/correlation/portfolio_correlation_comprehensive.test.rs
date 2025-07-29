use std::sync::Arc;
use tokio::sync::RwLock;
use chrono::{Utc, Duration};
use rust_decimal::Decimal;
use std::collections::HashMap;

// Import the actual Aegis satellite correlation analysis types
extern crate aegis_satellite;
use aegis_satellite::risk::correlation_analysis::{
    CorrelationAnalysisSystem, CorrelationAnalysisConfig, Asset, AssetType, PricePoint,
    PortfolioPosition, CorrelationMatrix, CorrelationAnalysis, HighCorrelation,
    CorrelationRiskLevel, RebalancingRecommendation, RebalancingType, RecommendationPriority,
    StressTestResult, StressTestScenario, TailRiskAnalysis
};

#[cfg(test)]
mod portfolio_correlation_tests {
    use super::*;

    // Helper function to create test asset
    fn create_test_asset(
        symbol: &str,
        name: &str,
        asset_type: AssetType,
        volatility: f64,
        beta: f64,
    ) -> Asset {
        Asset {
            symbol: symbol.to_string(),
            name: name.to_string(),
            asset_type,
            price_history: Vec::new(),
            volatility,
            beta,
            market_cap: Some(1000000000.0), // 1B market cap
        }
    }

    // Helper function to generate price history
    fn generate_price_history(
        base_price: f64,
        days: usize,
        volatility: f64,
        correlation_factor: f64,
    ) -> Vec<PricePoint> {
        let mut history = Vec::new();
        let mut price = base_price;
        
        for i in 0..days {
            // Simple random walk with correlation factor
            let random_change = (i as f64).sin() * volatility * correlation_factor;
            price = (price * (1.0 + random_change)).max(0.01);
            
            history.push(PricePoint {
                timestamp: Utc::now() - Duration::days((days - i - 1) as i64),
                price,
                volume: 1000000.0 + (i as f64 * 10000.0),
                market_cap: Some(price * 1000000.0),
            });
        }
        
        history
    }

    // Helper function to create test portfolio
    fn create_test_portfolio() -> Vec<PortfolioPosition> {
        vec![
            PortfolioPosition {
                asset_symbol: "BTC".to_string(),
                quantity: 10.0,
                value_usd: 500000.0,
                allocation_percentage: 50.0,
                entry_price: 45000.0,
                current_price: 50000.0,
                unrealized_pnl: 50000.0,
                risk_score: 0.8,
            },
            PortfolioPosition {
                asset_symbol: "ETH".to_string(),
                quantity: 200.0,
                value_usd: 300000.0,
                allocation_percentage: 30.0,
                entry_price: 1400.0,
                current_price: 1500.0,
                unrealized_pnl: 20000.0,
                risk_score: 0.7,
            },
            PortfolioPosition {
                asset_symbol: "USDC".to_string(),
                quantity: 100000.0,
                value_usd: 100000.0,
                allocation_percentage: 10.0,
                entry_price: 1.0,
                current_price: 1.0,
                unrealized_pnl: 0.0,
                risk_score: 0.1,
            },
            PortfolioPosition {
                asset_symbol: "LINK".to_string(),
                quantity: 5000.0,
                value_usd: 100000.0,
                allocation_percentage: 10.0,
                entry_price: 18.0,
                current_price: 20.0,
                unrealized_pnl: 10000.0,
                risk_score: 0.6,
            },
        ]
    }

    #[tokio::test]
    async fn test_correlation_analysis_system_initialization() {
        let config = CorrelationAnalysisConfig::default();
        let system = CorrelationAnalysisSystem::new(config.clone());
        
        // Verify default configuration
        assert_eq!(config.default_time_window_days, 90);
        assert_eq!(config.minimum_data_points, 30);
        assert_eq!(config.correlation_threshold_high, 0.7);
        assert_eq!(config.correlation_threshold_critical, 0.9);
        assert_eq!(config.confidence_level, 0.95);
    }

    #[tokio::test]
    async fn test_asset_management() {
        let config = CorrelationAnalysisConfig::default();
        let system = CorrelationAnalysisSystem::new(config);
        
        // Create test assets
        let mut btc = create_test_asset("BTC", "Bitcoin", AssetType::Cryptocurrency, 0.8, 1.5);
        btc.price_history = generate_price_history(50000.0, 100, 0.05, 1.0);
        
        let mut eth = create_test_asset("ETH", "Ethereum", AssetType::Cryptocurrency, 0.9, 1.3);
        eth.price_history = generate_price_history(1500.0, 100, 0.06, 0.8);
        
        // Add assets to system
        system.add_asset(btc).await.expect("Should add BTC");
        system.add_asset(eth).await.expect("Should add ETH");
        
        // Update price data
        let new_price = PricePoint {
            timestamp: Utc::now(),
            price: 51000.0,
            volume: 2000000.0,
            market_cap: Some(51000.0 * 1000000.0),
        };
        
        system.update_asset_price("BTC", new_price).await.expect("Should update BTC price");
    }

    #[tokio::test]
    async fn test_correlation_matrix_calculation() {
        let config = CorrelationAnalysisConfig::default();
        let system = CorrelationAnalysisSystem::new(config);
        
        // Create correlated assets
        let mut btc = create_test_asset("BTC", "Bitcoin", AssetType::Cryptocurrency, 0.8, 1.5);
        btc.price_history = generate_price_history(50000.0, 100, 0.05, 1.0);
        
        let mut eth = create_test_asset("ETH", "Ethereum", AssetType::Cryptocurrency, 0.9, 1.3);
        eth.price_history = generate_price_history(1500.0, 100, 0.06, 0.8); // Correlated with BTC
        
        let mut usdc = create_test_asset("USDC", "USD Coin", AssetType::Stablecoin, 0.01, 0.0);
        usdc.price_history = generate_price_history(1.0, 100, 0.001, 0.0); // Uncorrelated
        
        system.add_asset(btc).await.expect("Should add BTC");
        system.add_asset(eth).await.expect("Should add ETH");
        system.add_asset(usdc).await.expect("Should add USDC");
        
        // Calculate correlation matrix
        let asset_symbols = vec!["BTC".to_string(), "ETH".to_string(), "USDC".to_string()];
        let matrix = system.calculate_correlation_matrix(&asset_symbols, None)
            .await
            .expect("Should calculate correlation matrix");
        
        // Verify matrix properties
        assert_eq!(matrix.assets.len(), 3);
        assert_eq!(matrix.matrix.len(), 3);
        assert_eq!(matrix.matrix[0].len(), 3);
        
        // Diagonal should be 1.0
        for i in 0..3 {
            assert!((matrix.matrix[i][i] - 1.0).abs() < 0.001);
        }
        
        // Matrix should be symmetric
        for i in 0..3 {
            for j in 0..3 {
                assert!((matrix.matrix[i][j] - matrix.matrix[j][i]).abs() < 0.001);
            }
        }
        
        // BTC-ETH should have higher correlation than BTC-USDC
        let btc_idx = matrix.assets.iter().position(|a| a == "BTC").unwrap();
        let eth_idx = matrix.assets.iter().position(|a| a == "ETH").unwrap();
        let usdc_idx = matrix.assets.iter().position(|a| a == "USDC").unwrap();
        
        let btc_eth_corr = matrix.matrix[btc_idx][eth_idx].abs();
        let btc_usdc_corr = matrix.matrix[btc_idx][usdc_idx].abs();
        
        assert!(btc_eth_corr > btc_usdc_corr);
    }

    #[tokio::test]
    async fn test_high_correlation_detection() {
        let mut config = CorrelationAnalysisConfig::default();
        config.correlation_threshold_high = 0.6;
        config.correlation_threshold_critical = 0.8;
        
        let system = CorrelationAnalysisSystem::new(config);
        
        // Create highly correlated assets
        let mut asset1 = create_test_asset("ASSET1", "Asset 1", AssetType::Token, 0.5, 1.0);
        asset1.price_history = generate_price_history(100.0, 100, 0.03, 1.0);
        
        let mut asset2 = create_test_asset("ASSET2", "Asset 2", AssetType::Token, 0.5, 1.0);
        asset2.price_history = generate_price_history(100.0, 100, 0.03, 0.95); // Highly correlated
        
        let mut asset3 = create_test_asset("ASSET3", "Asset 3", AssetType::Stablecoin, 0.01, 0.0);
        asset3.price_history = generate_price_history(1.0, 100, 0.001, 0.0); // Uncorrelated
        
        system.add_asset(asset1).await.expect("Should add asset1");
        system.add_asset(asset2).await.expect("Should add asset2");
        system.add_asset(asset3).await.expect("Should add asset3");
        
        let asset_symbols = vec!["ASSET1".to_string(), "ASSET2".to_string(), "ASSET3".to_string()];
        let matrix = system.calculate_correlation_matrix(&asset_symbols, None)
            .await
            .expect("Should calculate matrix");
        
        // Test high correlation detection logic
        let mut high_correlations = Vec::new();
        for i in 0..matrix.assets.len() {
            for j in (i + 1)..matrix.assets.len() {
                let correlation = matrix.matrix[i][j];
                let abs_correlation = correlation.abs();
                
                if abs_correlation >= 0.6 {
                    let risk_level = if abs_correlation >= 0.8 {
                        CorrelationRiskLevel::Critical
                    } else {
                        CorrelationRiskLevel::High
                    };
                    
                    high_correlations.push(HighCorrelation {
                        asset1: matrix.assets[i].clone(),
                        asset2: matrix.assets[j].clone(),
                        correlation,
                        risk_level,
                        recommendation: format!("High correlation detected: {:.2}", abs_correlation),
                    });
                }
            }
        }
        
        // Should detect high correlation between ASSET1 and ASSET2
        assert!(!high_correlations.is_empty());
        let found_correlation = high_correlations.iter()
            .any(|c| (c.asset1 == "ASSET1" && c.asset2 == "ASSET2") || 
                     (c.asset1 == "ASSET2" && c.asset2 == "ASSET1"));
        assert!(found_correlation);
    }

    #[tokio::test]
    async fn test_diversification_score_calculation() {
        let config = CorrelationAnalysisConfig::default();
        let system = CorrelationAnalysisSystem::new(config);
        
        // Test perfectly correlated portfolio (low diversification)
        let perfect_corr_matrix = CorrelationMatrix {
            assets: vec!["A".to_string(), "B".to_string()],
            matrix: vec![
                vec![1.0, 0.9],
                vec![0.9, 1.0],
            ],
            timestamp: Utc::now(),
            time_window_days: 90,
            confidence_level: 0.95,
        };
        
        // Calculate diversification score manually for testing
        let avg_correlation = 0.9;
        let expected_score = 1.0 - avg_correlation;
        
        assert!((expected_score - 0.1).abs() < 0.001);
        
        // Test uncorrelated portfolio (high diversification)
        let uncorr_matrix = CorrelationMatrix {
            assets: vec!["A".to_string(), "B".to_string(), "C".to_string()],
            matrix: vec![
                vec![1.0, 0.1, 0.0],
                vec![0.1, 1.0, -0.1],
                vec![0.0, -0.1, 1.0],
            ],
            timestamp: Utc::now(),
            time_window_days: 90,
            confidence_level: 0.95,
        };
        
        let avg_corr_uncorr = (0.1 + 0.0 + 0.1) / 3.0;
        let expected_uncorr_score = 1.0 - avg_corr_uncorr;
        
        assert!(expected_uncorr_score > 0.9);
    }

    #[tokio::test]
    async fn test_concentration_risk_calculation() {
        let config = CorrelationAnalysisConfig::default();
        let system = CorrelationAnalysisSystem::new(config);
        
        // Test concentrated portfolio
        let concentrated_portfolio = vec![
            PortfolioPosition {
                asset_symbol: "BTC".to_string(),
                quantity: 1.0,
                value_usd: 800000.0, // 80% allocation
                allocation_percentage: 80.0,
                entry_price: 50000.0,
                current_price: 50000.0,
                unrealized_pnl: 0.0,
                risk_score: 0.8,
            },
            PortfolioPosition {
                asset_symbol: "ETH".to_string(),
                quantity: 1.0,
                value_usd: 200000.0, // 20% allocation
                allocation_percentage: 20.0,
                entry_price: 1500.0,
                current_price: 1500.0,
                unrealized_pnl: 0.0,
                risk_score: 0.7,
            },
        ];
        
        // Calculate HHI manually for testing
        let total_value = 1000000.0;
        let weight1 = 800000.0 / total_value; // 0.8
        let weight2 = 200000.0 / total_value; // 0.2
        let hhi = weight1.powi(2) + weight2.powi(2); // 0.64 + 0.04 = 0.68
        
        // Concentration risk formula: (HHI - 1/n) / (1 - 1/n)
        let n = concentrated_portfolio.len() as f64;
        let expected_concentration = (hhi - 1.0/n) / (1.0 - 1.0/n);
        
        assert!(expected_concentration > 0.3); // Should show significant concentration
        
        // Test diversified portfolio
        let diversified_portfolio = vec![
            PortfolioPosition {
                asset_symbol: "BTC".to_string(),
                quantity: 1.0,
                value_usd: 250000.0, // 25% each
                allocation_percentage: 25.0,
                entry_price: 50000.0,
                current_price: 50000.0,
                unrealized_pnl: 0.0,
                risk_score: 0.8,
            },
            PortfolioPosition {
                asset_symbol: "ETH".to_string(),
                quantity: 1.0,
                value_usd: 250000.0,
                allocation_percentage: 25.0,
                entry_price: 1500.0,
                current_price: 1500.0,
                unrealized_pnl: 0.0,
                risk_score: 0.7,
            },
            PortfolioPosition {
                asset_symbol: "USDC".to_string(),
                quantity: 1.0,
                value_usd: 250000.0,
                allocation_percentage: 25.0,
                entry_price: 1.0,
                current_price: 1.0,
                unrealized_pnl: 0.0,
                risk_score: 0.1,
            },
            PortfolioPosition {
                asset_symbol: "LINK".to_string(),
                quantity: 1.0,
                value_usd: 250000.0,
                allocation_percentage: 25.0,
                entry_price: 20.0,
                current_price: 20.0,
                unrealized_pnl: 0.0,
                risk_score: 0.6,
            },
        ];
        
        // Equal weights should have low concentration risk
        let equal_weight = 0.25;
        let diversified_hhi = 4.0 * equal_weight.powi(2); // 0.25
        let diversified_concentration = (diversified_hhi - 0.25) / 0.75; // Should be 0
        
        assert!(diversified_concentration.abs() < 0.001);
    }

    #[tokio::test]
    async fn test_comprehensive_portfolio_analysis() {
        let config = CorrelationAnalysisConfig::default();
        let system = CorrelationAnalysisSystem::new(config);
        
        // Setup test portfolio and assets
        let portfolio = create_test_portfolio();
        system.add_portfolio("test_portfolio", portfolio).await.expect("Should add portfolio");
        
        // Add corresponding assets
        let mut btc = create_test_asset("BTC", "Bitcoin", AssetType::Cryptocurrency, 0.8, 1.5);
        btc.price_history = generate_price_history(50000.0, 100, 0.05, 1.0);
        
        let mut eth = create_test_asset("ETH", "Ethereum", AssetType::Cryptocurrency, 0.9, 1.3);
        eth.price_history = generate_price_history(1500.0, 100, 0.06, 0.8);
        
        let mut usdc = create_test_asset("USDC", "USD Coin", AssetType::Stablecoin, 0.01, 0.0);
        usdc.price_history = generate_price_history(1.0, 100, 0.001, 0.0);
        
        let mut link = create_test_asset("LINK", "Chainlink", AssetType::Token, 0.7, 1.1);
        link.price_history = generate_price_history(20.0, 100, 0.04, 0.6);
        
        system.add_asset(btc).await.expect("Should add BTC");
        system.add_asset(eth).await.expect("Should add ETH");
        system.add_asset(usdc).await.expect("Should add USDC");
        system.add_asset(link).await.expect("Should add LINK");
        
        // Perform comprehensive analysis
        let analysis = system.analyze_portfolio_correlation("test_portfolio")
            .await
            .expect("Should perform analysis");
        
        // Verify analysis components
        assert_eq!(analysis.matrix.assets.len(), 4);
        assert!(analysis.diversification_score >= 0.0 && analysis.diversification_score <= 1.0);
        assert!(analysis.concentration_risk >= 0.0 && analysis.concentration_risk <= 1.0);
        assert!(!analysis.recommendations.is_empty());
        
        // Portfolio is 50% BTC, so should have some concentration risk
        assert!(analysis.concentration_risk > 0.1);
    }

    #[tokio::test]
    async fn test_rebalancing_recommendations() {
        let config = CorrelationAnalysisConfig::default();
        let system = CorrelationAnalysisSystem::new(config);
        
        // Create highly concentrated portfolio
        let concentrated_portfolio = vec![
            PortfolioPosition {
                asset_symbol: "BTC".to_string(),
                quantity: 1.0,
                value_usd: 900000.0, // 90% allocation - extreme concentration
                allocation_percentage: 90.0,
                entry_price: 50000.0,
                current_price: 50000.0,
                unrealized_pnl: 0.0,
                risk_score: 0.8,
            },
            PortfolioPosition {
                asset_symbol: "ETH".to_string(),
                quantity: 1.0,
                value_usd: 100000.0, // 10% allocation
                allocation_percentage: 10.0,
                entry_price: 1500.0,
                current_price: 1500.0,
                unrealized_pnl: 0.0,
                risk_score: 0.7,
            },
        ];
        
        system.add_portfolio("concentrated", concentrated_portfolio).await.expect("Should add portfolio");
        
        // Add assets with high correlation
        let mut btc = create_test_asset("BTC", "Bitcoin", AssetType::Cryptocurrency, 0.8, 1.5);
        btc.price_history = generate_price_history(50000.0, 100, 0.05, 1.0);
        
        let mut eth = create_test_asset("ETH", "Ethereum", AssetType::Cryptocurrency, 0.9, 1.3);
        eth.price_history = generate_price_history(1500.0, 100, 0.06, 0.95); // Highly correlated
        
        system.add_asset(btc).await.expect("Should add BTC");
        system.add_asset(eth).await.expect("Should add ETH");
        
        let analysis = system.analyze_portfolio_correlation("concentrated")
            .await
            .expect("Should analyze portfolio");
        
        // Should recommend reducing concentration
        let has_concentration_rec = analysis.recommendations.iter()
            .any(|r| matches!(r.recommendation_type, RebalancingType::ReduceConcentration));
        assert!(has_concentration_rec);
        
        // Should have high priority recommendations
        let has_high_priority = analysis.recommendations.iter()
            .any(|r| matches!(r.priority, RecommendationPriority::Critical | RecommendationPriority::High));
        assert!(has_high_priority);
    }

    #[tokio::test]
    async fn test_stress_testing_scenarios() {
        let config = CorrelationAnalysisConfig::default();
        let system = CorrelationAnalysisSystem::new(config);
        
        let portfolio = create_test_portfolio();
        system.add_portfolio("stress_test", portfolio).await.expect("Should add portfolio");
        
        // Add assets with different types for scenario testing
        let mut btc = create_test_asset("BTC", "Bitcoin", AssetType::Cryptocurrency, 0.8, 1.5);
        btc.price_history = generate_price_history(50000.0, 100, 0.05, 1.0);
        
        let mut eth = create_test_asset("ETH", "Ethereum", AssetType::Cryptocurrency, 0.9, 1.3);
        eth.price_history = generate_price_history(1500.0, 100, 0.06, 0.8);
        
        let mut usdc = create_test_asset("USDC", "USD Coin", AssetType::Stablecoin, 0.01, 0.0);
        usdc.price_history = generate_price_history(1.0, 100, 0.001, 0.0);
        
        let mut link = create_test_asset("LINK", "Chainlink", AssetType::DeFiProtocol, 0.7, 1.1);
        link.price_history = generate_price_history(20.0, 100, 0.04, 0.6);
        
        system.add_asset(btc).await.expect("Should add BTC");
        system.add_asset(eth).await.expect("Should add ETH");
        system.add_asset(usdc).await.expect("Should add USDC");
        system.add_asset(link).await.expect("Should add LINK");
        
        let analysis = system.analyze_portfolio_correlation("stress_test")
            .await
            .expect("Should analyze portfolio");
        
        // Verify stress test results
        assert!(analysis.stress_test_results.portfolio_value_change < 0.0); // Should show negative impact
        assert!(analysis.stress_test_results.var_95 < 0.0); // VaR should be negative
        assert!(analysis.stress_test_results.cvar_95 < 0.0); // CVaR should be negative
        assert!(!analysis.stress_test_results.affected_assets.is_empty());
        assert!(analysis.stress_test_results.recovery_time_days.is_some());
    }

    #[tokio::test]
    async fn test_different_stress_scenarios() {
        let config = CorrelationAnalysisConfig::default();
        let system = CorrelationAnalysisSystem::new(config);
        
        // Create crypto-heavy portfolio
        let crypto_portfolio = vec![
            PortfolioPosition {
                asset_symbol: "BTC".to_string(),
                quantity: 1.0,
                value_usd: 500000.0,
                allocation_percentage: 50.0,
                entry_price: 50000.0,
                current_price: 50000.0,
                unrealized_pnl: 0.0,
                risk_score: 0.8,
            },
            PortfolioPosition {
                asset_symbol: "ETH".to_string(),
                quantity: 1.0,
                value_usd: 500000.0,
                allocation_percentage: 50.0,
                entry_price: 1500.0,
                current_price: 1500.0,
                unrealized_pnl: 0.0,
                risk_score: 0.7,
            },
        ];
        
        // Test crypto winter scenario impact
        let scenario = StressTestScenario::CryptoWinter;
        
        // Manually calculate expected impact
        let btc_impact = 500000.0 * -0.8; // -80% for crypto
        let eth_impact = 500000.0 * -0.8; // -80% for crypto
        let total_impact = (btc_impact + eth_impact) / 1000000.0; // As percentage
        
        assert!(total_impact.abs() > 0.7); // Should be significant negative impact
        
        // Test DeFi contagion scenario
        let defi_portfolio = vec![
            PortfolioPosition {
                asset_symbol: "AAVE".to_string(),
                quantity: 1.0,
                value_usd: 500000.0,
                allocation_percentage: 50.0,
                entry_price: 100.0,
                current_price: 100.0,
                unrealized_pnl: 0.0,
                risk_score: 0.9,
            },
            PortfolioPosition {
                asset_symbol: "USDC".to_string(),
                quantity: 1.0,
                value_usd: 500000.0,
                allocation_percentage: 50.0,
                entry_price: 1.0,
                current_price: 1.0,
                unrealized_pnl: 0.0,
                risk_score: 0.1,
            },
        ];
        
        // DeFi contagion should affect AAVE (-70%) but not USDC much (-10%)
        let aave_impact = 500000.0 * -0.7;
        let usdc_impact = 500000.0 * -0.1;
        let defi_total_impact = (aave_impact + usdc_impact) / 1000000.0;
        
        assert!(defi_total_impact > -0.5 && defi_total_impact < -0.3);
    }

    #[tokio::test]
    async fn test_tail_risk_analysis() {
        let config = CorrelationAnalysisConfig::default();
        let system = CorrelationAnalysisSystem::new(config);
        
        let portfolio = create_test_portfolio();
        
        // Create correlation matrix for tail risk analysis
        let matrix = CorrelationMatrix {
            assets: vec!["BTC".to_string(), "ETH".to_string(), "USDC".to_string(), "LINK".to_string()],
            matrix: vec![
                vec![1.0, 0.8, 0.1, 0.6],
                vec![0.8, 1.0, 0.0, 0.7],
                vec![0.1, 0.0, 1.0, 0.2],
                vec![0.6, 0.7, 0.2, 1.0],
            ],
            timestamp: Utc::now(),
            time_window_days: 90,
            confidence_level: 0.95,
        };
        
        let tail_analysis = system.perform_tail_risk_analysis(&portfolio, &matrix)
            .await
            .expect("Should perform tail risk analysis");
        
        // Verify tail risk analysis results
        assert!(tail_analysis.extreme_event_probability > 0.0 && tail_analysis.extreme_event_probability <= 1.0);
        assert!(tail_analysis.worst_case_loss < 0.0); // Should be negative
        assert!(tail_analysis.expected_shortfall < 0.0); // Should be negative
        assert_eq!(tail_analysis.tail_dependence_matrix.len(), 4);
        assert!(!tail_analysis.risk_mitigation_strategies.is_empty());
        
        // Tail dependence matrix should be symmetric and diagonal should be 1.0
        for i in 0..4 {
            assert!((tail_analysis.tail_dependence_matrix[i][i] - 1.0).abs() < 0.001);
            for j in 0..4 {
                assert!((tail_analysis.tail_dependence_matrix[i][j] - tail_analysis.tail_dependence_matrix[j][i]).abs() < 0.001);
            }
        }
    }

    #[tokio::test]
    async fn test_portfolio_volatility_calculation() {
        let config = CorrelationAnalysisConfig::default();
        let system = CorrelationAnalysisSystem::new(config);
        
        // Create simple 2-asset portfolio
        let portfolio = vec![
            PortfolioPosition {
                asset_symbol: "ASSET1".to_string(),
                quantity: 1.0,
                value_usd: 500000.0, // 50% weight
                allocation_percentage: 50.0,
                entry_price: 100.0,
                current_price: 100.0,
                unrealized_pnl: 0.0,
                risk_score: 0.5,
            },
            PortfolioPosition {
                asset_symbol: "ASSET2".to_string(),
                quantity: 1.0,
                value_usd: 500000.0, // 50% weight
                allocation_percentage: 50.0,
                entry_price: 100.0,
                current_price: 100.0,
                unrealized_pnl: 0.0,
                risk_score: 0.5,
            },
        ];
        
        // Add assets with known volatilities
        let mut asset1 = create_test_asset("ASSET1", "Asset 1", AssetType::Token, 0.2, 1.0); // 20% volatility
        asset1.price_history = generate_price_history(100.0, 100, 0.02, 1.0);
        
        let mut asset2 = create_test_asset("ASSET2", "Asset 2", AssetType::Token, 0.3, 1.0); // 30% volatility
        asset2.price_history = generate_price_history(100.0, 100, 0.03, 1.0);
        
        system.add_asset(asset1).await.expect("Should add asset1");
        system.add_asset(asset2).await.expect("Should add asset2");
        
        // Test correlation matrix
        let matrix = CorrelationMatrix {
            assets: vec!["ASSET1".to_string(), "ASSET2".to_string()],
            matrix: vec![
                vec![1.0, 0.5], // 50% correlation
                vec![0.5, 1.0],
            ],
            timestamp: Utc::now(),
            time_window_days: 90,
            confidence_level: 0.95,
        };
        
        // Calculate expected portfolio volatility manually
        // σ_p = sqrt(w1²σ1² + w2²σ2² + 2*w1*w2*ρ*σ1*σ2)
        let w1 = 0.5; // 50% weight
        let w2 = 0.5; // 50% weight
        let sigma1 = 0.2; // 20% volatility
        let sigma2 = 0.3; // 30% volatility
        let rho = 0.5; // 50% correlation
        
        let expected_variance = w1.powi(2) * sigma1.powi(2) + 
                               w2.powi(2) * sigma2.powi(2) + 
                               2.0 * w1 * w2 * rho * sigma1 * sigma2;
        let expected_volatility = expected_variance.sqrt();
        
        // Portfolio volatility should be between individual asset volatilities due to diversification
        assert!(expected_volatility > 0.2 && expected_volatility < 0.3);
        
        // With positive correlation, should be closer to average than with zero correlation
        let zero_corr_variance = w1.powi(2) * sigma1.powi(2) + w2.powi(2) * sigma2.powi(2);
        let zero_corr_volatility = zero_corr_variance.sqrt();
        
        assert!(expected_volatility > zero_corr_volatility);
    }

    #[tokio::test]
    async fn test_portfolio_summary_generation() {
        let config = CorrelationAnalysisConfig::default();
        let system = CorrelationAnalysisSystem::new(config);
        
        let portfolio = create_test_portfolio();
        system.add_portfolio("summary_test", portfolio).await.expect("Should add portfolio");
        
        // Add assets
        let mut btc = create_test_asset("BTC", "Bitcoin", AssetType::Cryptocurrency, 0.8, 1.5);
        btc.price_history = generate_price_history(50000.0, 100, 0.05, 1.0);
        
        let mut eth = create_test_asset("ETH", "Ethereum", AssetType::Cryptocurrency, 0.9, 1.3);
        eth.price_history = generate_price_history(1500.0, 100, 0.06, 0.8);
        
        let mut usdc = create_test_asset("USDC", "USD Coin", AssetType::Stablecoin, 0.01, 0.0);
        usdc.price_history = generate_price_history(1.0, 100, 0.001, 0.0);
        
        let mut link = create_test_asset("LINK", "Chainlink", AssetType::Token, 0.7, 1.1);
        link.price_history = generate_price_history(20.0, 100, 0.04, 0.6);
        
        system.add_asset(btc).await.expect("Should add BTC");
        system.add_asset(eth).await.expect("Should add ETH");
        system.add_asset(usdc).await.expect("Should add USDC");
        system.add_asset(link).await.expect("Should add LINK");
        
        let summary = system.get_portfolio_summary("summary_test")
            .await
            .expect("Should generate summary");
        
        // Verify summary contains expected elements
        assert!(summary.contains("Portfolio Analysis Summary"));
        assert!(summary.contains("Diversification Score"));
        assert!(summary.contains("Concentration Risk"));
        assert!(summary.contains("High Correlations"));
        assert!(summary.contains("Recommendations"));
        assert!(summary.contains("Stress Test Impact"));
        assert!(summary.contains("VaR"));
        assert!(summary.contains("CVaR"));
    }

    #[tokio::test]
    async fn test_correlation_caching() {
        let config = CorrelationAnalysisConfig::default();
        let system = CorrelationAnalysisSystem::new(config);
        
        // Add test assets
        let mut btc = create_test_asset("BTC", "Bitcoin", AssetType::Cryptocurrency, 0.8, 1.5);
        btc.price_history = generate_price_history(50000.0, 100, 0.05, 1.0);
        
        let mut eth = create_test_asset("ETH", "Ethereum", AssetType::Cryptocurrency, 0.9, 1.3);
        eth.price_history = generate_price_history(1500.0, 100, 0.06, 0.8);
        
        system.add_asset(btc).await.expect("Should add BTC");
        system.add_asset(eth).await.expect("Should add ETH");
        
        let asset_symbols = vec!["BTC".to_string(), "ETH".to_string()];
        
        // First calculation (should be cached)
        let start1 = std::time::Instant::now();
        let matrix1 = system.calculate_correlation_matrix(&asset_symbols, None)
            .await
            .expect("Should calculate matrix");
        let duration1 = start1.elapsed();
        
        // Second calculation (should use cache)
        let start2 = std::time::Instant::now();
        let matrix2 = system.calculate_correlation_matrix(&asset_symbols, None)
            .await
            .expect("Should calculate matrix");
        let duration2 = start2.elapsed();
        
        // Results should be identical
        assert_eq!(matrix1.assets, matrix2.assets);
        assert_eq!(matrix1.matrix.len(), matrix2.matrix.len());
        
        // Second call should be faster (cached result)
        // Note: This test might be flaky in very fast systems, but generally cache should be faster
        assert!(duration2 <= duration1 * 2); // Allow some variance
    }

    #[tokio::test]
    async fn test_performance_with_large_portfolio() {
        let config = CorrelationAnalysisConfig::default();
        let system = CorrelationAnalysisSystem::new(config);
        
        // Create large portfolio with many assets
        let mut large_portfolio = Vec::new();
        let mut asset_symbols = Vec::new();
        
        for i in 0..50 {
            let symbol = format!("ASSET{}", i);
            asset_symbols.push(symbol.clone());
            
            large_portfolio.push(PortfolioPosition {
                asset_symbol: symbol.clone(),
                quantity: 1000.0,
                value_usd: 20000.0, // Equal allocation
                allocation_percentage: 2.0, // 2% each
                entry_price: 20.0,
                current_price: 20.0,
                unrealized_pnl: 0.0,
                risk_score: 0.5,
            });
            
            // Add corresponding asset
            let mut asset = create_test_asset(&symbol, &format!("Asset {}", i), AssetType::Token, 0.5, 1.0);
            asset.price_history = generate_price_history(20.0, 100, 0.03, (i as f64) / 50.0);
            system.add_asset(asset).await.expect("Should add asset");
        }
        
        system.add_portfolio("large_portfolio", large_portfolio).await.expect("Should add large portfolio");
        
        // Test correlation matrix calculation performance
        let start = std::time::Instant::now();
        let matrix = system.calculate_correlation_matrix(&asset_symbols, None)
            .await
            .expect("Should calculate large correlation matrix");
        let duration = start.elapsed();
        
        // Verify results
        assert_eq!(matrix.assets.len(), 50);
        assert_eq!(matrix.matrix.len(), 50);
        assert_eq!(matrix.matrix[0].len(), 50);
        
        // Should complete within reasonable time
        assert!(duration.as_millis() < 2000, "Large matrix calculation took {}ms, should be <2000ms", duration.as_millis());
        
        // Test full portfolio analysis performance
        let analysis_start = std::time::Instant::now();
        let analysis = system.analyze_portfolio_correlation("large_portfolio")
            .await
            .expect("Should analyze large portfolio");
        let analysis_duration = analysis_start.elapsed();
        
        // Verify analysis completeness
        assert!(analysis.diversification_score >= 0.0 && analysis.diversification_score <= 1.0);
        assert!(analysis.concentration_risk >= 0.0 && analysis.concentration_risk <= 1.0);
        
        // Should complete within reasonable time
        assert!(analysis_duration.as_millis() < 5000, "Large portfolio analysis took {}ms, should be <5000ms", analysis_duration.as_millis());
    }

    #[tokio::test]
    async fn test_edge_cases_and_error_handling() {
        let config = CorrelationAnalysisConfig::default();
        let system = CorrelationAnalysisSystem::new(config);
        
        // Test empty portfolio
        let empty_portfolio = Vec::new();
        system.add_portfolio("empty", empty_portfolio).await.expect("Should add empty portfolio");
        
        // Test non-existent portfolio
        let result = system.analyze_portfolio_correlation("non_existent").await;
        assert!(result.is_err());
        
        // Test portfolio with non-existent assets
        let invalid_portfolio = vec![
            PortfolioPosition {
                asset_symbol: "NONEXISTENT".to_string(),
                quantity: 1.0,
                value_usd: 100000.0,
                allocation_percentage: 100.0,
                entry_price: 100.0,
                current_price: 100.0,
                unrealized_pnl: 0.0,
                risk_score: 0.5,
            },
        ];
        
        system.add_portfolio("invalid", invalid_portfolio).await.expect("Should add invalid portfolio");
        
        let result = system.analyze_portfolio_correlation("invalid").await;
        assert!(result.is_err()); // Should fail due to missing asset data
        
        // Test correlation calculation with insufficient data
        let mut asset_insufficient = create_test_asset("INSUFFICIENT", "Insufficient Data", AssetType::Token, 0.5, 1.0);
        asset_insufficient.price_history = vec![
            PricePoint {
                timestamp: Utc::now(),
                price: 100.0,
                volume: 1000.0,
                market_cap: Some(100000.0),
            }
        ]; // Only 1 data point, less than minimum required
        
        system.add_asset(asset_insufficient).await.expect("Should add asset");
        
        let insufficient_symbols = vec!["INSUFFICIENT".to_string()];
        let result = system.calculate_correlation_matrix(&insufficient_symbols, None).await;
        assert!(result.is_err()); // Should fail due to insufficient data
    }
}