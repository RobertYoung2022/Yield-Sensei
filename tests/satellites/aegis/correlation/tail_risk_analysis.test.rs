use tokio;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use chrono::{DateTime, Utc, Duration};

// Mock structures for testing (matching correlation_analysis.rs)
#[derive(Debug, Clone)]
pub struct PricePoint {
    pub timestamp: DateTime<Utc>,
    pub price: f64,
    pub volume: f64,
    pub market_cap: Option<f64>,
}

#[derive(Debug, Clone, PartialEq)]
pub enum AssetType {
    Cryptocurrency,
    Token,
    Stablecoin,
    DeFiProtocol,
    NFT,
    RealWorldAsset,
    Commodity,
    Stock,
    Bond,
    Custom(String),
}

#[derive(Debug, Clone)]
pub struct Asset {
    pub symbol: String,
    pub name: String,
    pub asset_type: AssetType,
    pub price_history: Vec<PricePoint>,
    pub volatility: f64,
    pub beta: f64,
    pub market_cap: Option<f64>,
}

#[derive(Debug, Clone)]
pub struct PortfolioPosition {
    pub asset_symbol: String,
    pub quantity: f64,
    pub value_usd: f64,
    pub allocation_percentage: f64,
    pub entry_price: f64,
    pub current_price: f64,
    pub unrealized_pnl: f64,
    pub risk_score: f64,
}

#[derive(Debug, Clone)]
pub struct CorrelationMatrix {
    pub assets: Vec<String>,
    pub matrix: Vec<Vec<f64>>,
    pub timestamp: DateTime<Utc>,
    pub time_window_days: u32,
    pub confidence_level: f64,
}

#[derive(Debug, Clone)]
pub struct TailRiskAnalysis {
    pub extreme_event_probability: f64,
    pub worst_case_loss: f64,
    pub expected_shortfall: f64,
    pub tail_dependence_matrix: Vec<Vec<f64>>,
    pub risk_mitigation_strategies: Vec<String>,
}

// Mock system for testing
pub struct MockCorrelationAnalysisSystem {
    assets: Arc<RwLock<HashMap<String, Asset>>>,
    portfolios: Arc<RwLock<HashMap<String, Vec<PortfolioPosition>>>>,
}

impl MockCorrelationAnalysisSystem {
    pub fn new() -> Self {
        Self {
            assets: Arc::new(RwLock::new(HashMap::new())),
            portfolios: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    pub async fn add_asset(&self, asset: Asset) {
        let mut assets = self.assets.write().await;
        assets.insert(asset.symbol.clone(), asset);
    }

    pub async fn add_portfolio(&self, portfolio_id: &str, positions: Vec<PortfolioPosition>) {
        let mut portfolios = self.portfolios.write().await;
        portfolios.insert(portfolio_id.to_string(), positions);
    }

    pub async fn perform_tail_risk_analysis(
        &self,
        portfolio: &[PortfolioPosition],
        matrix: &CorrelationMatrix,
    ) -> Result<TailRiskAnalysis, Box<dyn std::error::Error + Send + Sync>> {
        // Calculate portfolio volatility
        let portfolio_volatility = self.calculate_portfolio_volatility(portfolio, matrix).await?;
        
        // Calculate extreme event probability (simplified)
        let extreme_event_probability = (1.0 - portfolio_volatility).max(0.01);
        
        // Calculate worst case loss (3 standard deviations)
        let total_value: f64 = portfolio.iter().map(|p| p.value_usd).sum();
        let worst_case_loss = -3.0 * portfolio_volatility * total_value;
        
        // Calculate expected shortfall
        let expected_shortfall = -2.5 * portfolio_volatility * total_value;
        
        // Calculate tail dependence matrix
        let tail_dependence_matrix = self.calculate_tail_dependence_matrix(matrix).await?;
        
        // Generate risk mitigation strategies
        let risk_mitigation_strategies = vec![
            "Implement stop-loss orders".to_string(),
            "Add uncorrelated assets".to_string(),
            "Consider hedging with options".to_string(),
            "Maintain cash reserves".to_string(),
            "Diversify across asset classes".to_string(),
        ];

        Ok(TailRiskAnalysis {
            extreme_event_probability,
            worst_case_loss,
            expected_shortfall,
            tail_dependence_matrix,
            risk_mitigation_strategies,
        })
    }

    async fn calculate_portfolio_volatility(
        &self,
        portfolio: &[PortfolioPosition],
        matrix: &CorrelationMatrix,
    ) -> Result<f64, Box<dyn std::error::Error + Send + Sync>> {
        let total_value: f64 = portfolio.iter().map(|p| p.value_usd).sum();
        let mut portfolio_variance = 0.0;

        for i in 0..portfolio.len() {
            for j in 0..portfolio.len() {
                let weight_i = portfolio[i].value_usd / total_value;
                let weight_j = portfolio[j].value_usd / total_value;
                
                let correlation = if i == j {
                    1.0
                } else {
                    let asset_i = &portfolio[i].asset_symbol;
                    let asset_j = &portfolio[j].asset_symbol;
                    
                    if let (Some(idx_i), Some(idx_j)) = (
                        matrix.assets.iter().position(|a| a == asset_i),
                        matrix.assets.iter().position(|a| a == asset_j),
                    ) {
                        matrix.matrix[idx_i][idx_j]
                    } else {
                        0.0
                    }
                };

                let volatility_i = self.get_asset_volatility(&portfolio[i].asset_symbol).await?;
                let volatility_j = self.get_asset_volatility(&portfolio[j].asset_symbol).await?;
                
                portfolio_variance += weight_i * weight_j * correlation * volatility_i * volatility_j;
            }
        }

        Ok(portfolio_variance.sqrt())
    }

    async fn get_asset_volatility(&self, symbol: &str) -> Result<f64, Box<dyn std::error::Error + Send + Sync>> {
        let assets = self.assets.read().await;
        if let Some(asset) = assets.get(symbol) {
            Ok(asset.volatility)
        } else {
            Ok(0.2) // Default volatility
        }
    }

    async fn calculate_tail_dependence_matrix(&self, matrix: &CorrelationMatrix) -> Result<Vec<Vec<f64>>, Box<dyn std::error::Error + Send + Sync>> {
        let n_assets = matrix.assets.len();
        let mut tail_matrix = vec![vec![0.0; n_assets]; n_assets];

        for i in 0..n_assets {
            for j in 0..n_assets {
                if i == j {
                    tail_matrix[i][j] = 1.0;
                } else {
                    let correlation = matrix.matrix[i][j];
                    // Tail dependence calculation (Clayton copula approximation)
                    tail_matrix[i][j] = if correlation > 0.0 {
                        2.0_f64.powf(-1.0/(correlation + 1.0))
                    } else {
                        0.0
                    };
                }
            }
        }

        Ok(tail_matrix)
    }

    pub async fn calculate_hill_estimator(
        &self,
        portfolio: &[PortfolioPosition],
        k: usize,
    ) -> Result<f64, Box<dyn std::error::Error + Send + Sync>> {
        // Mock Hill estimator calculation for tail index
        let total_value: f64 = portfolio.iter().map(|p| p.value_usd).sum();
        let avg_volatility: f64 = portfolio.iter()
            .map(|p| self.get_asset_volatility(&p.asset_symbol))
            .collect::<Vec<_>>()
            .into_iter()
            .map(|f| f.unwrap_or(0.2))
            .sum::<f64>() / portfolio.len() as f64;
        
        // Hill estimator approximation
        let hill_estimate = (k as f64).ln() / avg_volatility.ln();
        Ok(hill_estimate.max(1.0).min(10.0))
    }

    pub async fn calculate_extreme_value_index(
        &self,
        portfolio: &[PortfolioPosition],
    ) -> Result<f64, Box<dyn std::error::Error + Send + Sync>> {
        // Mock extreme value index calculation
        let avg_volatility: f64 = portfolio.iter()
            .map(|p| self.get_asset_volatility(&p.asset_symbol))
            .collect::<Vec<_>>()
            .into_iter()
            .map(|f| f.unwrap_or(0.2))
            .sum::<f64>() / portfolio.len() as f64;
        
        // Extreme value index (gamma parameter)
        Ok(1.0 / avg_volatility - 1.0)
    }

    pub async fn calculate_exceedance_correlation(
        &self,
        matrix: &CorrelationMatrix,
        threshold: f64,
    ) -> Result<Vec<Vec<f64>>, Box<dyn std::error::Error + Send + Sync>> {
        let n_assets = matrix.assets.len();
        let mut exceedance_matrix = vec![vec![0.0; n_assets]; n_assets];

        for i in 0..n_assets {
            for j in 0..n_assets {
                if i == j {
                    exceedance_matrix[i][j] = 1.0;
                } else {
                    let correlation = matrix.matrix[i][j];
                    // Exceedance correlation increases with regular correlation
                    exceedance_matrix[i][j] = correlation * (1.0 + threshold).min(1.0);
                }
            }
        }

        Ok(exceedance_matrix)
    }
}

// Helper functions for test data generation
fn create_test_asset(symbol: &str, asset_type: AssetType, volatility: f64) -> Asset {
    let mut price_history = Vec::new();
    let base_price = 100.0;
    
    for i in 0..90 {
        let timestamp = Utc::now() - Duration::days(89 - i);
        let price_change = (i as f64 * 0.1).sin() * volatility * base_price;
        let price = base_price + price_change;
        
        price_history.push(PricePoint {
            timestamp,
            price,
            volume: 1000000.0,
            market_cap: Some(price * 1000000.0),
        });
    }

    Asset {
        symbol: symbol.to_string(),
        name: format!("{} Asset", symbol),
        asset_type,
        price_history,
        volatility,
        beta: 1.0,
        market_cap: Some(100000000.0),
    }
}

fn create_test_portfolio() -> Vec<PortfolioPosition> {
    vec![
        PortfolioPosition {
            asset_symbol: "BTC".to_string(),
            quantity: 1.0,
            value_usd: 50000.0,
            allocation_percentage: 40.0,
            entry_price: 45000.0,
            current_price: 50000.0,
            unrealized_pnl: 5000.0,
            risk_score: 0.7,
        },
        PortfolioPosition {
            asset_symbol: "ETH".to_string(),
            quantity: 10.0,
            value_usd: 30000.0,
            allocation_percentage: 24.0,
            entry_price: 2800.0,
            current_price: 3000.0,
            unrealized_pnl: 2000.0,
            risk_score: 0.6,
        },
        PortfolioPosition {
            asset_symbol: "UNI".to_string(),
            quantity: 1000.0,
            value_usd: 20000.0,
            allocation_percentage: 16.0,
            entry_price: 18.0,
            current_price: 20.0,
            unrealized_pnl: 2000.0,
            risk_score: 0.8,
        },
        PortfolioPosition {
            asset_symbol: "USDC".to_string(),
            quantity: 25000.0,
            value_usd: 25000.0,
            allocation_percentage: 20.0,
            entry_price: 1.0,
            current_price: 1.0,
            unrealized_pnl: 0.0,
            risk_score: 0.1,
        },
    ]
}

fn create_test_correlation_matrix() -> CorrelationMatrix {
    CorrelationMatrix {
        assets: vec!["BTC".to_string(), "ETH".to_string(), "UNI".to_string(), "USDC".to_string()],
        matrix: vec![
            vec![1.0, 0.8, 0.6, 0.1],  // BTC correlations
            vec![0.8, 1.0, 0.7, 0.1],  // ETH correlations
            vec![0.6, 0.7, 1.0, 0.1],  // UNI correlations
            vec![0.1, 0.1, 0.1, 1.0],  // USDC correlations
        ],
        timestamp: Utc::now(),
        time_window_days: 90,
        confidence_level: 0.95,
    }
}

// Test Cases

#[tokio::test]
async fn test_basic_tail_risk_analysis() {
    let system = MockCorrelationAnalysisSystem::new();
    let portfolio = create_test_portfolio();
    let matrix = create_test_correlation_matrix();

    // Add test assets
    system.add_asset(create_test_asset("BTC", AssetType::Cryptocurrency, 0.6)).await;
    system.add_asset(create_test_asset("ETH", AssetType::Cryptocurrency, 0.7)).await;
    system.add_asset(create_test_asset("UNI", AssetType::DeFiProtocol, 0.9)).await;
    system.add_asset(create_test_asset("USDC", AssetType::Stablecoin, 0.02)).await;

    let result = system.perform_tail_risk_analysis(&portfolio, &matrix).await;
    assert!(result.is_ok());

    let analysis = result.unwrap();
    
    // Verify extreme event probability is reasonable
    assert!(analysis.extreme_event_probability > 0.0);
    assert!(analysis.extreme_event_probability <= 1.0);
    
    // Verify worst case loss is negative (loss)
    assert!(analysis.worst_case_loss < 0.0);
    
    // Verify expected shortfall is between worst case and zero
    assert!(analysis.expected_shortfall < 0.0);
    assert!(analysis.expected_shortfall > analysis.worst_case_loss);
    
    // Verify tail dependence matrix dimensions
    assert_eq!(analysis.tail_dependence_matrix.len(), 4);
    assert_eq!(analysis.tail_dependence_matrix[0].len(), 4);
    
    // Verify mitigation strategies are provided
    assert!(!analysis.risk_mitigation_strategies.is_empty());
    assert!(analysis.risk_mitigation_strategies.len() >= 3);
}

#[tokio::test]
async fn test_tail_dependence_matrix_properties() {
    let system = MockCorrelationAnalysisSystem::new();
    let matrix = create_test_correlation_matrix();

    let tail_matrix = system.calculate_tail_dependence_matrix(&matrix).await.unwrap();

    // Verify matrix is square
    assert_eq!(tail_matrix.len(), 4);
    for row in &tail_matrix {
        assert_eq!(row.len(), 4);
    }

    // Verify diagonal elements are 1.0
    for i in 0..4 {
        assert_eq!(tail_matrix[i][i], 1.0);
    }

    // Verify tail dependence values are non-negative
    for i in 0..4 {
        for j in 0..4 {
            assert!(tail_matrix[i][j] >= 0.0);
            assert!(tail_matrix[i][j] <= 1.0);
        }
    }

    // Verify symmetry
    for i in 0..4 {
        for j in 0..4 {
            assert!((tail_matrix[i][j] - tail_matrix[j][i]).abs() < 1e-10);
        }
    }
}

#[tokio::test]
async fn test_extreme_value_analysis() {
    let system = MockCorrelationAnalysisSystem::new();
    let portfolio = create_test_portfolio();

    // Add test assets with different volatilities
    system.add_asset(create_test_asset("BTC", AssetType::Cryptocurrency, 0.6)).await;
    system.add_asset(create_test_asset("ETH", AssetType::Cryptocurrency, 0.7)).await;
    system.add_asset(create_test_asset("UNI", AssetType::DeFiProtocol, 0.9)).await;
    system.add_asset(create_test_asset("USDC", AssetType::Stablecoin, 0.02)).await;

    let hill_estimate = system.calculate_hill_estimator(&portfolio, 10).await.unwrap();
    assert!(hill_estimate > 0.0);
    assert!(hill_estimate <= 10.0);

    let evi = system.calculate_extreme_value_index(&portfolio).await.unwrap();
    assert!(evi > -1.0); // Theoretical lower bound for extreme value index
}

#[tokio::test]
async fn test_exceedance_correlation() {
    let system = MockCorrelationAnalysisSystem::new();
    let matrix = create_test_correlation_matrix();

    let exceedance_matrix = system.calculate_exceedance_correlation(&matrix, 0.1).await.unwrap();

    // Verify matrix dimensions
    assert_eq!(exceedance_matrix.len(), 4);
    assert_eq!(exceedance_matrix[0].len(), 4);

    // Verify diagonal elements are 1.0
    for i in 0..4 {
        assert_eq!(exceedance_matrix[i][i], 1.0);
    }

    // Verify exceedance correlations are typically higher than regular correlations
    for i in 0..4 {
        for j in 0..4 {
            if i != j && matrix.matrix[i][j] > 0.0 {
                assert!(exceedance_matrix[i][j] >= matrix.matrix[i][j]);
            }
        }
    }
}

#[tokio::test]
async fn test_high_volatility_portfolio_tail_risk() {
    let system = MockCorrelationAnalysisSystem::new();
    
    // Create high volatility portfolio
    let high_vol_portfolio = vec![
        PortfolioPosition {
            asset_symbol: "VOLATILE1".to_string(),
            quantity: 100.0,
            value_usd: 50000.0,
            allocation_percentage: 50.0,
            entry_price: 450.0,
            current_price: 500.0,
            unrealized_pnl: 5000.0,
            risk_score: 0.9,
        },
        PortfolioPosition {
            asset_symbol: "VOLATILE2".to_string(),
            quantity: 200.0,
            value_usd: 50000.0,
            allocation_percentage: 50.0,
            entry_price: 225.0,
            current_price: 250.0,
            unrealized_pnl: 5000.0,
            risk_score: 0.95,
        },
    ];

    let high_vol_matrix = CorrelationMatrix {
        assets: vec!["VOLATILE1".to_string(), "VOLATILE2".to_string()],
        matrix: vec![
            vec![1.0, 0.9],  // High correlation
            vec![0.9, 1.0],
        ],
        timestamp: Utc::now(),
        time_window_days: 90,
        confidence_level: 0.95,
    };

    // Add high volatility assets
    system.add_asset(create_test_asset("VOLATILE1", AssetType::Cryptocurrency, 1.2)).await;
    system.add_asset(create_test_asset("VOLATILE2", AssetType::Token, 1.5)).await;

    let analysis = system.perform_tail_risk_analysis(&high_vol_portfolio, &high_vol_matrix).await.unwrap();

    // High volatility portfolio should have higher tail risks
    assert!(analysis.worst_case_loss.abs() > 50000.0); // Should lose more than half in worst case
    assert!(analysis.expected_shortfall.abs() > 40000.0);
    assert!(analysis.extreme_event_probability < 0.8); // Lower probability of extreme events
    
    // Should have strong tail dependence due to high correlation
    assert!(analysis.tail_dependence_matrix[0][1] > 0.5);
    assert!(analysis.tail_dependence_matrix[1][0] > 0.5);
}

#[tokio::test]
async fn test_diversified_portfolio_tail_risk() {
    let system = MockCorrelationAnalysisSystem::new();
    
    // Create well-diversified portfolio
    let diversified_portfolio = vec![
        PortfolioPosition {
            asset_symbol: "STOCK".to_string(),
            quantity: 100.0,
            value_usd: 25000.0,
            allocation_percentage: 25.0,
            entry_price: 225.0,
            current_price: 250.0,
            unrealized_pnl: 2500.0,
            risk_score: 0.3,
        },
        PortfolioPosition {
            asset_symbol: "BOND".to_string(),
            quantity: 200.0,
            value_usd: 25000.0,
            allocation_percentage: 25.0,
            entry_price: 112.5,
            current_price: 125.0,
            unrealized_pnl: 2500.0,
            risk_score: 0.1,
        },
        PortfolioPosition {
            asset_symbol: "COMMODITY".to_string(),
            quantity: 50.0,
            value_usd: 25000.0,
            allocation_percentage: 25.0,
            entry_price: 450.0,
            current_price: 500.0,
            unrealized_pnl: 2500.0,
            risk_score: 0.4,
        },
        PortfolioPosition {
            asset_symbol: "CRYPTO".to_string(),
            quantity: 10.0,
            value_usd: 25000.0,
            allocation_percentage: 25.0,
            entry_price: 2250.0,
            current_price: 2500.0,
            unrealized_pnl: 2500.0,
            risk_score: 0.7,
        },
    ];

    let diversified_matrix = CorrelationMatrix {
        assets: vec!["STOCK".to_string(), "BOND".to_string(), "COMMODITY".to_string(), "CRYPTO".to_string()],
        matrix: vec![
            vec![1.0, -0.2, 0.3, 0.4],  // Stock correlations
            vec![-0.2, 1.0, 0.1, -0.1], // Bond correlations  
            vec![0.3, 0.1, 1.0, 0.2],   // Commodity correlations
            vec![0.4, -0.1, 0.2, 1.0],  // Crypto correlations
        ],
        timestamp: Utc::now(),
        time_window_days: 90,
        confidence_level: 0.95,
    };

    // Add diversified assets
    system.add_asset(create_test_asset("STOCK", AssetType::Stock, 0.2)).await;
    system.add_asset(create_test_asset("BOND", AssetType::Bond, 0.05)).await;
    system.add_asset(create_test_asset("COMMODITY", AssetType::Commodity, 0.3)).await;
    system.add_asset(create_test_asset("CRYPTO", AssetType::Cryptocurrency, 0.8)).await;

    let analysis = system.perform_tail_risk_analysis(&diversified_portfolio, &diversified_matrix).await.unwrap();

    // Diversified portfolio should have lower tail risks
    assert!(analysis.worst_case_loss.abs() < 80000.0); // Should lose less due to diversification
    assert!(analysis.extreme_event_probability > 0.3); // Higher probability of moderate events
    
    // Tail dependence should be lower due to diversification
    let avg_tail_dependence = analysis.tail_dependence_matrix.iter()
        .enumerate()
        .flat_map(|(i, row)| row.iter().enumerate().filter(|(j, _)| *j != i).map(|(_, &val)| val))
        .sum::<f64>() / 12.0; // 4x3 off-diagonal elements
    assert!(avg_tail_dependence < 0.6);
}

#[tokio::test]
async fn test_single_asset_tail_risk() {
    let system = MockCorrelationAnalysisSystem::new();
    
    let single_asset_portfolio = vec![
        PortfolioPosition {
            asset_symbol: "BTC".to_string(),
            quantity: 2.0,
            value_usd: 100000.0,
            allocation_percentage: 100.0,
            entry_price: 45000.0,
            current_price: 50000.0,
            unrealized_pnl: 10000.0,
            risk_score: 1.0,
        },
    ];

    let single_asset_matrix = CorrelationMatrix {
        assets: vec!["BTC".to_string()],
        matrix: vec![vec![1.0]],
        timestamp: Utc::now(),
        time_window_days: 90,
        confidence_level: 0.95,
    };

    system.add_asset(create_test_asset("BTC", AssetType::Cryptocurrency, 0.6)).await;

    let analysis = system.perform_tail_risk_analysis(&single_asset_portfolio, &single_asset_matrix).await.unwrap();

    // Single asset should have high concentration risk
    assert_eq!(analysis.tail_dependence_matrix.len(), 1);
    assert_eq!(analysis.tail_dependence_matrix[0][0], 1.0);
    
    // Should recommend diversification
    assert!(analysis.risk_mitigation_strategies.iter()
        .any(|s| s.contains("uncorrelated") || s.contains("diversify")));
}

#[tokio::test]
async fn test_negative_correlation_tail_effects() {
    let system = MockCorrelationAnalysisSystem::new();
    
    let portfolio = vec![
        PortfolioPosition {
            asset_symbol: "GOLD".to_string(),
            quantity: 100.0,
            value_usd: 50000.0,
            allocation_percentage: 50.0,
            entry_price: 450.0,
            current_price: 500.0,
            unrealized_pnl: 5000.0,
            risk_score: 0.3,
        },
        PortfolioPosition {
            asset_symbol: "BONDS".to_string(),
            quantity: 400.0,
            value_usd: 50000.0,
            allocation_percentage: 50.0,
            entry_price: 112.5,
            current_price: 125.0,
            unrealized_pnl: 5000.0,
            risk_score: 0.1,
        },
    ];

    let negative_corr_matrix = CorrelationMatrix {
        assets: vec!["GOLD".to_string(), "BONDS".to_string()],
        matrix: vec![
            vec![1.0, -0.7],  // Strong negative correlation
            vec![-0.7, 1.0],
        ],
        timestamp: Utc::now(),
        time_window_days: 90,
        confidence_level: 0.95,
    };

    system.add_asset(create_test_asset("GOLD", AssetType::Commodity, 0.2)).await;
    system.add_asset(create_test_asset("BONDS", AssetType::Bond, 0.05)).await;

    let analysis = system.perform_tail_risk_analysis(&portfolio, &negative_corr_matrix).await.unwrap();

    // Negative correlation should reduce tail dependence
    assert!(analysis.tail_dependence_matrix[0][1] < 0.3);
    assert!(analysis.tail_dependence_matrix[1][0] < 0.3);
    
    // Should have lower tail risks due to negative correlation
    assert!(analysis.worst_case_loss.abs() < 60000.0); // Should be protected by hedge
}

#[tokio::test]
async fn test_tail_risk_performance_benchmark() {
    let system = MockCorrelationAnalysisSystem::new();
    let portfolio = create_test_portfolio();
    let matrix = create_test_correlation_matrix();

    // Add test assets
    system.add_asset(create_test_asset("BTC", AssetType::Cryptocurrency, 0.6)).await;
    system.add_asset(create_test_asset("ETH", AssetType::Cryptocurrency, 0.7)).await;
    system.add_asset(create_test_asset("UNI", AssetType::DeFiProtocol, 0.9)).await;
    system.add_asset(create_test_asset("USDC", AssetType::Stablecoin, 0.02)).await;

    let start_time = std::time::Instant::now();
    let _analysis = system.perform_tail_risk_analysis(&portfolio, &matrix).await.unwrap();
    let duration = start_time.elapsed();

    // Should complete tail risk analysis in under 100ms for small portfolio
    assert!(duration.as_millis() < 100);
    println!("Tail risk analysis completed in {}ms", duration.as_millis());
}

#[tokio::test]
async fn test_empty_portfolio_tail_risk() {
    let system = MockCorrelationAnalysisSystem::new();
    let empty_portfolio = vec![];
    let empty_matrix = CorrelationMatrix {
        assets: vec![],
        matrix: vec![],
        timestamp: Utc::now(),
        time_window_days: 90,
        confidence_level: 0.95,
    };

    let result = system.perform_tail_risk_analysis(&empty_portfolio, &empty_matrix).await;
    
    // Should handle empty portfolio gracefully
    if result.is_ok() {
        let analysis = result.unwrap();
        assert_eq!(analysis.worst_case_loss, 0.0);
        assert_eq!(analysis.expected_shortfall, 0.0);
        assert!(analysis.tail_dependence_matrix.is_empty());
    }
}

#[tokio::test]
async fn test_large_portfolio_tail_risk_scaling() {
    let system = MockCorrelationAnalysisSystem::new();
    
    // Create large portfolio with 20 assets
    let mut large_portfolio = Vec::new();
    let mut large_matrix_assets = Vec::new();
    let mut large_matrix_data = Vec::new();
    
    for i in 0..20 {
        let symbol = format!("ASSET{}", i);
        large_portfolio.push(PortfolioPosition {
            asset_symbol: symbol.clone(),
            quantity: 100.0,
            value_usd: 5000.0,
            allocation_percentage: 5.0,
            entry_price: 45.0,
            current_price: 50.0,
            unrealized_pnl: 500.0,
            risk_score: 0.5,
        });
        
        large_matrix_assets.push(symbol.clone());
        system.add_asset(create_test_asset(&symbol, AssetType::Token, 0.3 + (i as f64 * 0.01))).await;
        
        // Create correlation row
        let mut row = Vec::new();
        for j in 0..20 {
            if i == j {
                row.push(1.0);
            } else {
                // Decreasing correlation with distance
                row.push((0.8 - (i as f64 - j as f64).abs() * 0.05).max(0.1));
            }
        }
        large_matrix_data.push(row);
    }

    let large_matrix = CorrelationMatrix {
        assets: large_matrix_assets,
        matrix: large_matrix_data,
        timestamp: Utc::now(),
        time_window_days: 90,
        confidence_level: 0.95,
    };

    let start_time = std::time::Instant::now();
    let analysis = system.perform_tail_risk_analysis(&large_portfolio, &large_matrix).await.unwrap();
    let duration = start_time.elapsed();

    // Should complete large portfolio analysis in reasonable time
    assert!(duration.as_millis() < 500);
    
    // Verify tail dependence matrix dimensions
    assert_eq!(analysis.tail_dependence_matrix.len(), 20);
    assert_eq!(analysis.tail_dependence_matrix[0].len(), 20);
    
    // Large diversified portfolio should have manageable tail risk
    assert!(analysis.worst_case_loss.abs() < 120000.0); // Less than 120% loss due to diversification
    
    println!("Large portfolio tail risk analysis completed in {}ms", duration.as_millis());
}