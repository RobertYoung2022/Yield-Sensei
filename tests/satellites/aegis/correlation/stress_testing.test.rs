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
pub enum StressTestScenario {
    MarketCrash,
    CryptoWinter,
    DeFiContagion,
    RegulatoryShock,
    BlackSwan,
    Custom(String),
}

#[derive(Debug, Clone)]
pub struct StressTestResult {
    pub scenario_name: String,
    pub portfolio_value_change: f64,
    pub max_drawdown: f64,
    pub var_95: f64,
    pub cvar_95: f64,
    pub affected_assets: Vec<String>,
    pub recovery_time_days: Option<u32>,
}

#[derive(Debug, Clone)]
pub struct MultiScenarioStressTest {
    pub scenarios: Vec<StressTestResult>,
    pub worst_case_scenario: String,
    pub best_case_scenario: String,
    pub average_impact: f64,
    pub recovery_probability: f64,
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

    pub async fn perform_stress_testing(
        &self,
        portfolio: &[PortfolioPosition],
        matrix: &CorrelationMatrix,
        scenario: StressTestScenario,
    ) -> Result<StressTestResult, Box<dyn std::error::Error + Send + Sync>> {
        let scenario_name = match &scenario {
            StressTestScenario::MarketCrash => "Market Crash (-50% across all assets)",
            StressTestScenario::CryptoWinter => "Crypto Winter (-80% crypto assets)",
            StressTestScenario::DeFiContagion => "DeFi Contagion (-70% DeFi protocols)",
            StressTestScenario::RegulatoryShock => "Regulatory Shock (-30% across board)",
            StressTestScenario::BlackSwan => "Black Swan Event (-90% extreme scenario)",
            StressTestScenario::Custom(name) => name.as_str(),
        };

        // Calculate portfolio value change based on scenario
        let portfolio_value_change = self.calculate_scenario_impact(portfolio, &scenario).await?;
        
        // Calculate Value at Risk (VaR) and Conditional VaR (CVaR)
        let (var_95, cvar_95) = self.calculate_risk_metrics(portfolio, matrix).await?;

        // Identify most affected assets
        let affected_assets = self.identify_affected_assets(portfolio, &scenario).await?;

        // Estimate recovery time
        let recovery_time_days = self.estimate_recovery_time(&scenario).await?;

        Ok(StressTestResult {
            scenario_name: scenario_name.to_string(),
            portfolio_value_change,
            max_drawdown: portfolio_value_change.abs(),
            var_95,
            cvar_95,
            affected_assets,
            recovery_time_days,
        })
    }

    pub async fn perform_multi_scenario_stress_test(
        &self,
        portfolio: &[PortfolioPosition],
        matrix: &CorrelationMatrix,
    ) -> Result<MultiScenarioStressTest, Box<dyn std::error::Error + Send + Sync>> {
        let scenarios_to_test = vec![
            StressTestScenario::MarketCrash,
            StressTestScenario::CryptoWinter,
            StressTestScenario::DeFiContagion,
            StressTestScenario::RegulatoryShock,
            StressTestScenario::BlackSwan,
        ];

        let mut scenario_results = Vec::new();
        let mut total_impact = 0.0;

        for scenario in scenarios_to_test {
            let result = self.perform_stress_testing(portfolio, matrix, scenario).await?;
            total_impact += result.portfolio_value_change;
            scenario_results.push(result);
        }

        // Find worst and best case scenarios
        let worst_case = scenario_results.iter()
            .min_by(|a, b| a.portfolio_value_change.partial_cmp(&b.portfolio_value_change).unwrap())
            .unwrap();
        
        let best_case = scenario_results.iter()
            .max_by(|a, b| a.portfolio_value_change.partial_cmp(&b.portfolio_value_change).unwrap())
            .unwrap();

        let average_impact = total_impact / scenario_results.len() as f64;
        let recovery_probability = scenario_results.iter()
            .filter(|r| r.recovery_time_days.is_some() && r.recovery_time_days.unwrap() < 365)
            .count() as f64 / scenario_results.len() as f64;

        Ok(MultiScenarioStressTest {
            scenarios: scenario_results,
            worst_case_scenario: worst_case.scenario_name.clone(),
            best_case_scenario: best_case.scenario_name.clone(),
            average_impact,
            recovery_probability,
        })
    }

    async fn calculate_scenario_impact(
        &self,
        portfolio: &[PortfolioPosition],
        scenario: &StressTestScenario,
    ) -> Result<f64, Box<dyn std::error::Error + Send + Sync>> {
        let mut total_impact = 0.0;
        let total_value: f64 = portfolio.iter().map(|p| p.value_usd).sum();

        for position in portfolio {
            let impact_factor = match scenario {
                StressTestScenario::MarketCrash => -0.5, // -50%
                StressTestScenario::CryptoWinter => {
                    if self.is_crypto_asset(&position.asset_symbol).await? {
                        -0.8 // -80%
                    } else {
                        -0.2 // -20%
                    }
                },
                StressTestScenario::DeFiContagion => {
                    if self.is_defi_asset(&position.asset_symbol).await? {
                        -0.7 // -70%
                    } else {
                        -0.1 // -10%
                    }
                },
                StressTestScenario::RegulatoryShock => -0.3, // -30%
                StressTestScenario::BlackSwan => -0.9, // -90%
                StressTestScenario::Custom(_) => -0.4, // Default -40%
            };

            let position_impact = position.value_usd * impact_factor;
            total_impact += position_impact;
        }

        Ok(total_impact / total_value) // Return as percentage
    }

    async fn is_crypto_asset(&self, symbol: &str) -> Result<bool, Box<dyn std::error::Error + Send + Sync>> {
        let assets = self.assets.read().await;
        if let Some(asset) = assets.get(symbol) {
            Ok(matches!(asset.asset_type, AssetType::Cryptocurrency | AssetType::Token))
        } else {
            Ok(false)
        }
    }

    async fn is_defi_asset(&self, symbol: &str) -> Result<bool, Box<dyn std::error::Error + Send + Sync>> {
        let assets = self.assets.read().await;
        if let Some(asset) = assets.get(symbol) {
            Ok(matches!(asset.asset_type, AssetType::DeFiProtocol))
        } else {
            Ok(false)
        }
    }

    async fn calculate_risk_metrics(
        &self,
        portfolio: &[PortfolioPosition],
        matrix: &CorrelationMatrix,
    ) -> Result<(f64, f64), Box<dyn std::error::Error + Send + Sync>> {
        let total_value: f64 = portfolio.iter().map(|p| p.value_usd).sum();
        let portfolio_volatility = self.calculate_portfolio_volatility(portfolio, matrix).await?;
        
        // VaR at 95% confidence (1.645 standard deviations)
        let var_95 = -1.645 * portfolio_volatility * total_value;
        
        // CVaR at 95% confidence (expected loss beyond VaR)
        let cvar_95 = -2.063 * portfolio_volatility * total_value;
        
        Ok((var_95, cvar_95))
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
            Ok(0.5) // Default volatility
        }
    }

    async fn identify_affected_assets(
        &self,
        portfolio: &[PortfolioPosition],
        scenario: &StressTestScenario,
    ) -> Result<Vec<String>, Box<dyn std::error::Error + Send + Sync>> {
        let mut affected_assets = Vec::new();

        for position in portfolio {
            let is_affected = match scenario {
                StressTestScenario::CryptoWinter => self.is_crypto_asset(&position.asset_symbol).await?,
                StressTestScenario::DeFiContagion => self.is_defi_asset(&position.asset_symbol).await?,
                _ => true, // All assets affected in other scenarios
            };

            if is_affected {
                affected_assets.push(position.asset_symbol.clone());
            }
        }

        Ok(affected_assets)
    }

    async fn estimate_recovery_time(&self, scenario: &StressTestScenario) -> Result<Option<u32>, Box<dyn std::error::Error + Send + Sync>> {
        let recovery_days = match scenario {
            StressTestScenario::MarketCrash => Some(180), // 6 months
            StressTestScenario::CryptoWinter => Some(365), // 1 year
            StressTestScenario::DeFiContagion => Some(90), // 3 months
            StressTestScenario::RegulatoryShock => Some(120), // 4 months
            StressTestScenario::BlackSwan => Some(730), // 2 years
            StressTestScenario::Custom(_) => Some(180), // Default 6 months
        };

        Ok(recovery_days)
    }

    pub async fn calculate_correlation_breakdown_under_stress(
        &self,
        matrix: &CorrelationMatrix,
        scenario: &StressTestScenario,
    ) -> Result<CorrelationMatrix, Box<dyn std::error::Error + Send + Sync>> {
        let stress_multiplier = match scenario {
            StressTestScenario::MarketCrash => 1.5,   // Correlations increase 50%
            StressTestScenario::CryptoWinter => 1.8,  // Crypto correlations spike
            StressTestScenario::DeFiContagion => 1.6, // DeFi correlations increase
            StressTestScenario::RegulatoryShock => 1.3, // Moderate increase
            StressTestScenario::BlackSwan => 2.0,    // Maximum correlation increase
            StressTestScenario::Custom(_) => 1.4,    // Default increase
        };

        let mut stressed_matrix = matrix.matrix.clone();
        for i in 0..stressed_matrix.len() {
            for j in 0..stressed_matrix[i].len() {
                if i != j {
                    let stressed_corr = stressed_matrix[i][j] * stress_multiplier;
                    stressed_matrix[i][j] = stressed_corr.min(0.99).max(-0.99); // Cap at ±0.99
                }
            }
        }

        Ok(CorrelationMatrix {
            assets: matrix.assets.clone(),
            matrix: stressed_matrix,
            timestamp: Utc::now(),
            time_window_days: matrix.time_window_days,
            confidence_level: matrix.confidence_level,
        })
    }

    pub async fn simulate_liquidity_stress(
        &self,
        portfolio: &[PortfolioPosition],
        liquidity_shock_percentage: f64,
    ) -> Result<f64, Box<dyn std::error::Error + Send + Sync>> {
        let mut liquidity_adjusted_loss = 0.0;
        let total_value: f64 = portfolio.iter().map(|p| p.value_usd).sum();

        for position in portfolio {
            // Simulate liquidity multiplier based on asset type
            let liquidity_multiplier = match self.get_asset_type(&position.asset_symbol).await? {
                AssetType::Stablecoin => 1.0,           // High liquidity
                AssetType::Cryptocurrency => 1.2,      // Medium liquidity
                AssetType::Stock => 1.1,                // Medium-high liquidity
                AssetType::Bond => 1.05,                // High liquidity
                AssetType::DeFiProtocol => 1.5,         // Lower liquidity
                AssetType::NFT => 2.0,                  // Very low liquidity
                AssetType::RealWorldAsset => 2.5,       // Extremely low liquidity
                _ => 1.3,                               // Default moderate liquidity
            };

            let base_loss = position.value_usd * liquidity_shock_percentage;
            let liquidity_adjusted_position_loss = base_loss * liquidity_multiplier;
            liquidity_adjusted_loss += liquidity_adjusted_position_loss;
        }

        Ok(liquidity_adjusted_loss / total_value)
    }

    async fn get_asset_type(&self, symbol: &str) -> Result<AssetType, Box<dyn std::error::Error + Send + Sync>> {
        let assets = self.assets.read().await;
        if let Some(asset) = assets.get(symbol) {
            Ok(asset.asset_type.clone())
        } else {
            Ok(AssetType::Custom("Unknown".to_string()))
        }
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
async fn test_market_crash_stress_test() {
    let system = MockCorrelationAnalysisSystem::new();
    let portfolio = create_test_portfolio();
    let matrix = create_test_correlation_matrix();

    // Add test assets
    system.add_asset(create_test_asset("BTC", AssetType::Cryptocurrency, 0.6)).await;
    system.add_asset(create_test_asset("ETH", AssetType::Cryptocurrency, 0.7)).await;
    system.add_asset(create_test_asset("UNI", AssetType::DeFiProtocol, 0.9)).await;
    system.add_asset(create_test_asset("USDC", AssetType::Stablecoin, 0.02)).await;

    let result = system.perform_stress_testing(&portfolio, &matrix, StressTestScenario::MarketCrash).await;
    assert!(result.is_ok());

    let stress_result = result.unwrap();
    
    // Market crash should cause significant negative impact
    assert!(stress_result.portfolio_value_change < -0.4); // At least 40% decline
    assert!(stress_result.portfolio_value_change > -0.6); // Not more than 60% decline
    
    // Should affect all assets
    assert_eq!(stress_result.affected_assets.len(), 4);
    
    // Recovery time should be reasonable (6 months)
    assert_eq!(stress_result.recovery_time_days, Some(180));
    
    // VaR and CVaR should be significant
    assert!(stress_result.var_95 < 0.0);
    assert!(stress_result.cvar_95 < stress_result.var_95);
    
    println!("Market Crash Impact: {:.1}%", stress_result.portfolio_value_change * 100.0);
}

#[tokio::test]
async fn test_crypto_winter_stress_test() {
    let system = MockCorrelationAnalysisSystem::new();
    let portfolio = create_test_portfolio();
    let matrix = create_test_correlation_matrix();

    // Add test assets
    system.add_asset(create_test_asset("BTC", AssetType::Cryptocurrency, 0.6)).await;
    system.add_asset(create_test_asset("ETH", AssetType::Cryptocurrency, 0.7)).await;
    system.add_asset(create_test_asset("UNI", AssetType::DeFiProtocol, 0.9)).await;
    system.add_asset(create_test_asset("USDC", AssetType::Stablecoin, 0.02)).await;

    let result = system.perform_stress_testing(&portfolio, &matrix, StressTestScenario::CryptoWinter).await;
    assert!(result.is_ok());

    let stress_result = result.unwrap();
    
    // Crypto winter should heavily impact crypto assets but spare stablecoins
    assert!(stress_result.portfolio_value_change < -0.4); // Significant impact due to high crypto allocation
    
    // Should primarily affect crypto assets (BTC, ETH) but not USDC
    assert!(stress_result.affected_assets.contains(&"BTC".to_string()));
    assert!(stress_result.affected_assets.contains(&"ETH".to_string()));
    
    // Recovery time should be longer (1 year)
    assert_eq!(stress_result.recovery_time_days, Some(365));
    
    println!("Crypto Winter Impact: {:.1}%", stress_result.portfolio_value_change * 100.0);
}

#[tokio::test]
async fn test_defi_contagion_stress_test() {
    let system = MockCorrelationAnalysisSystem::new();
    let portfolio = create_test_portfolio();
    let matrix = create_test_correlation_matrix();

    // Add test assets
    system.add_asset(create_test_asset("BTC", AssetType::Cryptocurrency, 0.6)).await;
    system.add_asset(create_test_asset("ETH", AssetType::Cryptocurrency, 0.7)).await;
    system.add_asset(create_test_asset("UNI", AssetType::DeFiProtocol, 0.9)).await;
    system.add_asset(create_test_asset("USDC", AssetType::Stablecoin, 0.02)).await;

    let result = system.perform_stress_testing(&portfolio, &matrix, StressTestScenario::DeFiContagion).await;
    assert!(result.is_ok());

    let stress_result = result.unwrap();
    
    // DeFi contagion should primarily impact UNI
    assert!(stress_result.affected_assets.contains(&"UNI".to_string()));
    
    // Impact should be moderate since UNI is only 16% of portfolio
    assert!(stress_result.portfolio_value_change > -0.3);
    assert!(stress_result.portfolio_value_change < 0.0);
    
    // Recovery time should be shorter (3 months)
    assert_eq!(stress_result.recovery_time_days, Some(90));
    
    println!("DeFi Contagion Impact: {:.1}%", stress_result.portfolio_value_change * 100.0);
}

#[tokio::test]
async fn test_regulatory_shock_stress_test() {
    let system = MockCorrelationAnalysisSystem::new();
    let portfolio = create_test_portfolio();
    let matrix = create_test_correlation_matrix();

    // Add test assets
    system.add_asset(create_test_asset("BTC", AssetType::Cryptocurrency, 0.6)).await;
    system.add_asset(create_test_asset("ETH", AssetType::Cryptocurrency, 0.7)).await;
    system.add_asset(create_test_asset("UNI", AssetType::DeFiProtocol, 0.9)).await;
    system.add_asset(create_test_asset("USDC", AssetType::Stablecoin, 0.02)).await;

    let result = system.perform_stress_testing(&portfolio, &matrix, StressTestScenario::RegulatoryShock).await;
    assert!(result.is_ok());

    let stress_result = result.unwrap();
    
    // Regulatory shock should affect all assets uniformly (-30%)
    assert!((stress_result.portfolio_value_change + 0.3).abs() < 0.05); // Close to -30%
    
    // Should affect all assets
    assert_eq!(stress_result.affected_assets.len(), 4);
    
    // Recovery time should be moderate (4 months)
    assert_eq!(stress_result.recovery_time_days, Some(120));
    
    println!("Regulatory Shock Impact: {:.1}%", stress_result.portfolio_value_change * 100.0);
}

#[tokio::test]
async fn test_black_swan_stress_test() {
    let system = MockCorrelationAnalysisSystem::new();
    let portfolio = create_test_portfolio();
    let matrix = create_test_correlation_matrix();

    // Add test assets
    system.add_asset(create_test_asset("BTC", AssetType::Cryptocurrency, 0.6)).await;
    system.add_asset(create_test_asset("ETH", AssetType::Cryptocurrency, 0.7)).await;
    system.add_asset(create_test_asset("UNI", AssetType::DeFiProtocol, 0.9)).await;
    system.add_asset(create_test_asset("USDC", AssetType::Stablecoin, 0.02)).await;

    let result = system.perform_stress_testing(&portfolio, &matrix, StressTestScenario::BlackSwan).await;
    assert!(result.is_ok());

    let stress_result = result.unwrap();
    
    // Black swan should cause catastrophic losses (-90%)
    assert!(stress_result.portfolio_value_change < -0.8); // At least 80% decline
    
    // Should affect all assets
    assert_eq!(stress_result.affected_assets.len(), 4);
    
    // Recovery time should be very long (2 years)
    assert_eq!(stress_result.recovery_time_days, Some(730));
    
    // Max drawdown should equal the portfolio value change magnitude
    assert_eq!(stress_result.max_drawdown, stress_result.portfolio_value_change.abs());
    
    println!("Black Swan Impact: {:.1}%", stress_result.portfolio_value_change * 100.0);
}

#[tokio::test]
async fn test_multi_scenario_stress_test() {
    let system = MockCorrelationAnalysisSystem::new();
    let portfolio = create_test_portfolio();
    let matrix = create_test_correlation_matrix();

    // Add test assets
    system.add_asset(create_test_asset("BTC", AssetType::Cryptocurrency, 0.6)).await;
    system.add_asset(create_test_asset("ETH", AssetType::Cryptocurrency, 0.7)).await;
    system.add_asset(create_test_asset("UNI", AssetType::DeFiProtocol, 0.9)).await;
    system.add_asset(create_test_asset("USDC", AssetType::Stablecoin, 0.02)).await;

    let result = system.perform_multi_scenario_stress_test(&portfolio, &matrix).await;
    assert!(result.is_ok());

    let multi_stress = result.unwrap();
    
    // Should test all 5 scenarios
    assert_eq!(multi_stress.scenarios.len(), 5);
    
    // Black Swan should be the worst case
    assert_eq!(multi_stress.worst_case_scenario, "Black Swan Event (-90% extreme scenario)");
    
    // Regulatory shock should be the best case (least negative)
    assert_eq!(multi_stress.best_case_scenario, "Regulatory Shock (-30% across board)");
    
    // Average impact should be significantly negative
    assert!(multi_stress.average_impact < -0.3);
    
    // Recovery probability should be reasonable (scenarios with <1 year recovery)
    assert!(multi_stress.recovery_probability >= 0.6); // At least 60% of scenarios recover within a year
    
    println!("Multi-scenario average impact: {:.1}%", multi_stress.average_impact * 100.0);
    println!("Recovery probability: {:.1}%", multi_stress.recovery_probability * 100.0);
}

#[tokio::test]
async fn test_correlation_breakdown_under_stress() {
    let system = MockCorrelationAnalysisSystem::new();
    let matrix = create_test_correlation_matrix();

    let stressed_matrix = system.calculate_correlation_breakdown_under_stress(&matrix, &StressTestScenario::MarketCrash).await.unwrap();

    // Correlations should increase under stress
    for i in 0..matrix.assets.len() {
        for j in 0..matrix.assets.len() {
            if i != j && matrix.matrix[i][j] > 0.0 {
                assert!(stressed_matrix.matrix[i][j] >= matrix.matrix[i][j]);
                assert!(stressed_matrix.matrix[i][j] <= 0.99); // Should be capped
            }
        }
    }

    // Verify that BTC-ETH correlation increases significantly
    let original_btc_eth_corr = matrix.matrix[0][1];
    let stressed_btc_eth_corr = stressed_matrix.matrix[0][1];
    let increase_ratio = stressed_btc_eth_corr / original_btc_eth_corr;
    assert!(increase_ratio >= 1.4); // At least 40% increase for market crash
    
    println!("Original BTC-ETH correlation: {:.2}", original_btc_eth_corr);
    println!("Stressed BTC-ETH correlation: {:.2}", stressed_btc_eth_corr);
}

#[tokio::test]
async fn test_liquidity_stress_simulation() {
    let system = MockCorrelationAnalysisSystem::new();
    let portfolio = create_test_portfolio();

    // Add test assets with different liquidity characteristics
    system.add_asset(create_test_asset("BTC", AssetType::Cryptocurrency, 0.6)).await;
    system.add_asset(create_test_asset("ETH", AssetType::Cryptocurrency, 0.7)).await;
    system.add_asset(create_test_asset("UNI", AssetType::DeFiProtocol, 0.9)).await;
    system.add_asset(create_test_asset("USDC", AssetType::Stablecoin, 0.02)).await;

    let liquidity_shock = 0.2; // 20% base shock
    let result = system.simulate_liquidity_stress(&portfolio, liquidity_shock).await;
    assert!(result.is_ok());

    let liquidity_adjusted_loss = result.unwrap();
    
    // Liquidity stress should amplify losses beyond the base shock
    assert!(liquidity_adjusted_loss > liquidity_shock); // Should be worse than base 20%
    assert!(liquidity_adjusted_loss < 0.5); // But not catastrophic with this portfolio mix
    
    println!("Base liquidity shock: {:.1}%", liquidity_shock * 100.0);
    println!("Liquidity-adjusted loss: {:.1}%", liquidity_adjusted_loss * 100.0);
}

#[tokio::test]
async fn test_custom_stress_scenario() {
    let system = MockCorrelationAnalysisSystem::new();
    let portfolio = create_test_portfolio();
    let matrix = create_test_correlation_matrix();

    // Add test assets
    system.add_asset(create_test_asset("BTC", AssetType::Cryptocurrency, 0.6)).await;
    system.add_asset(create_test_asset("ETH", AssetType::Cryptocurrency, 0.7)).await;
    system.add_asset(create_test_asset("UNI", AssetType::DeFiProtocol, 0.9)).await;
    system.add_asset(create_test_asset("USDC", AssetType::Stablecoin, 0.02)).await;

    let custom_scenario = StressTestScenario::Custom("Exchange Hack Contagion".to_string());
    let result = system.perform_stress_testing(&portfolio, &matrix, custom_scenario).await;
    assert!(result.is_ok());

    let stress_result = result.unwrap();
    
    // Custom scenario should use default parameters
    assert_eq!(stress_result.scenario_name, "Exchange Hack Contagion");
    assert!(stress_result.portfolio_value_change < 0.0);
    assert_eq!(stress_result.recovery_time_days, Some(180)); // Default 6 months
    
    println!("Custom scenario impact: {:.1}%", stress_result.portfolio_value_change * 100.0);
}

#[tokio::test]
async fn test_diversified_portfolio_stress_resilience() {
    let system = MockCorrelationAnalysisSystem::new();
    
    // Create highly diversified portfolio
    let diversified_portfolio = vec![
        PortfolioPosition {
            asset_symbol: "BTC".to_string(),
            quantity: 0.5,
            value_usd: 25000.0,
            allocation_percentage: 20.0,
            entry_price: 45000.0,
            current_price: 50000.0,
            unrealized_pnl: 2500.0,
            risk_score: 0.7,
        },
        PortfolioPosition {
            asset_symbol: "BONDS".to_string(),
            quantity: 200.0,
            value_usd: 25000.0,
            allocation_percentage: 20.0,
            entry_price: 112.5,
            current_price: 125.0,
            unrealized_pnl: 2500.0,
            risk_score: 0.1,
        },
        PortfolioPosition {
            asset_symbol: "GOLD".to_string(),
            quantity: 50.0,
            value_usd: 25000.0,
            allocation_percentage: 20.0,
            entry_price: 450.0,
            current_price: 500.0,
            unrealized_pnl: 2500.0,
            risk_score: 0.3,
        },
        PortfolioPosition {
            asset_symbol: "STOCKS".to_string(),
            quantity: 100.0,
            value_usd: 25000.0,
            allocation_percentage: 20.0,
            entry_price: 225.0,
            current_price: 250.0,
            unrealized_pnl: 2500.0,
            risk_score: 0.4,
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
    ];

    let diversified_matrix = CorrelationMatrix {
        assets: vec!["BTC".to_string(), "BONDS".to_string(), "GOLD".to_string(), "STOCKS".to_string(), "USDC".to_string()],
        matrix: vec![
            vec![1.0, -0.3, 0.2, 0.4, 0.1],   // BTC correlations
            vec![-0.3, 1.0, -0.1, -0.2, 0.0], // BONDS correlations
            vec![0.2, -0.1, 1.0, 0.3, 0.0],   // GOLD correlations
            vec![0.4, -0.2, 0.3, 1.0, 0.1],   // STOCKS correlations
            vec![0.1, 0.0, 0.0, 0.1, 1.0],    // USDC correlations
        ],
        timestamp: Utc::now(),
        time_window_days: 90,
        confidence_level: 0.95,
    };

    // Add diversified assets
    system.add_asset(create_test_asset("BTC", AssetType::Cryptocurrency, 0.6)).await;
    system.add_asset(create_test_asset("BONDS", AssetType::Bond, 0.05)).await;
    system.add_asset(create_test_asset("GOLD", AssetType::Commodity, 0.2)).await;
    system.add_asset(create_test_asset("STOCKS", AssetType::Stock, 0.18)).await;
    system.add_asset(create_test_asset("USDC", AssetType::Stablecoin, 0.02)).await;

    let market_crash_result = system.perform_stress_testing(&diversified_portfolio, &diversified_matrix, StressTestScenario::MarketCrash).await.unwrap();
    let crypto_winter_result = system.perform_stress_testing(&diversified_portfolio, &diversified_matrix, StressTestScenario::CryptoWinter).await.unwrap();

    // Diversified portfolio should be more resilient
    assert!(market_crash_result.portfolio_value_change > -0.4); // Better than -40%
    assert!(crypto_winter_result.portfolio_value_change > -0.25); // Much better in crypto winter due to low crypto allocation
    
    println!("Diversified portfolio market crash impact: {:.1}%", market_crash_result.portfolio_value_change * 100.0);
    println!("Diversified portfolio crypto winter impact: {:.1}%", crypto_winter_result.portfolio_value_change * 100.0);
}

#[tokio::test]
async fn test_stress_test_performance_benchmark() {
    let system = MockCorrelationAnalysisSystem::new();
    let portfolio = create_test_portfolio();
    let matrix = create_test_correlation_matrix();

    // Add test assets
    system.add_asset(create_test_asset("BTC", AssetType::Cryptocurrency, 0.6)).await;
    system.add_asset(create_test_asset("ETH", AssetType::Cryptocurrency, 0.7)).await;
    system.add_asset(create_test_asset("UNI", AssetType::DeFiProtocol, 0.9)).await;
    system.add_asset(create_test_asset("USDC", AssetType::Stablecoin, 0.02)).await;

    let start_time = std::time::Instant::now();
    let _result = system.perform_stress_testing(&portfolio, &matrix, StressTestScenario::MarketCrash).await.unwrap();
    let single_duration = start_time.elapsed();

    // Single stress test should complete quickly
    assert!(single_duration.as_millis() < 50);

    let start_time = std::time::Instant::now();
    let _multi_result = system.perform_multi_scenario_stress_test(&portfolio, &matrix).await.unwrap();
    let multi_duration = start_time.elapsed();

    // Multi-scenario stress test should complete within target (500ms)
    assert!(multi_duration.as_millis() < 500);

    println!("Single stress test: {}ms", single_duration.as_millis());
    println!("Multi-scenario stress test: {}ms", multi_duration.as_millis());
}

#[tokio::test]
async fn test_empty_portfolio_stress_handling() {
    let system = MockCorrelationAnalysisSystem::new();
    let empty_portfolio = vec![];
    let empty_matrix = CorrelationMatrix {
        assets: vec![],
        matrix: vec![],
        timestamp: Utc::now(),
        time_window_days: 90,
        confidence_level: 0.95,
    };

    let result = system.perform_stress_testing(&empty_portfolio, &empty_matrix, StressTestScenario::MarketCrash).await;
    
    // Should handle empty portfolio gracefully
    if result.is_ok() {
        let stress_result = result.unwrap();
        assert_eq!(stress_result.portfolio_value_change, 0.0);
        assert!(stress_result.affected_assets.is_empty());
    }
}

#[tokio::test]
async fn test_large_portfolio_stress_scaling() {
    let system = MockCorrelationAnalysisSystem::new();
    
    // Create large portfolio with 50 assets
    let mut large_portfolio = Vec::new();
    let mut large_matrix_assets = Vec::new();
    let mut large_matrix_data = Vec::new();
    
    for i in 0..50 {
        let symbol = format!("ASSET{}", i);
        large_portfolio.push(PortfolioPosition {
            asset_symbol: symbol.clone(),
            quantity: 100.0,
            value_usd: 2000.0,
            allocation_percentage: 2.0,
            entry_price: 18.0,
            current_price: 20.0,
            unrealized_pnl: 200.0,
            risk_score: 0.5,
        });
        
        large_matrix_assets.push(symbol.clone());
        let asset_type = match i % 5 {
            0 => AssetType::Cryptocurrency,
            1 => AssetType::DeFiProtocol,
            2 => AssetType::Stock,
            3 => AssetType::Bond,
            _ => AssetType::Stablecoin,
        };
        system.add_asset(create_test_asset(&symbol, asset_type, 0.2 + (i as f64 * 0.01))).await;
        
        // Create correlation row
        let mut row = Vec::new();
        for j in 0..50 {
            if i == j {
                row.push(1.0);
            } else {
                row.push((0.3 - (i as f64 - j as f64).abs() * 0.01).max(0.05));
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
    let result = system.perform_stress_testing(&large_portfolio, &large_matrix, StressTestScenario::MarketCrash).await.unwrap();
    let duration = start_time.elapsed();

    // Should handle large portfolio efficiently
    assert!(duration.as_millis() < 200);
    assert!(result.portfolio_value_change < 0.0);
    assert_eq!(result.affected_assets.len(), 50);
    
    println!("Large portfolio stress test completed in {}ms", duration.as_millis());
}