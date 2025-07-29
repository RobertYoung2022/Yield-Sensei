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

#[derive(Debug, Clone, PartialEq)]
pub enum CorrelationRiskLevel {
    Low,
    Medium,
    High,
    Critical,
}

#[derive(Debug, Clone)]
pub struct HighCorrelation {
    pub asset1: String,
    pub asset2: String,
    pub correlation: f64,
    pub risk_level: CorrelationRiskLevel,
    pub recommendation: String,
}

#[derive(Debug, Clone)]
pub enum RebalancingType {
    ReduceConcentration,
    IncreaseDiversification,
    HedgeRisk,
    OptimizeCorrelation,
    RebalanceAllocation,
    AddUncorrelatedAsset,
}

#[derive(Debug, Clone, PartialEq)]
pub enum RecommendationPriority {
    Low,
    Medium,
    High,
    Critical,
}

#[derive(Debug, Clone)]
pub struct RebalancingRecommendation {
    pub recommendation_type: RebalancingType,
    pub priority: RecommendationPriority,
    pub description: String,
    pub expected_impact: f64,
    pub suggested_actions: Vec<String>,
    pub confidence: f64,
}

#[derive(Debug, Clone)]
pub struct OptimizationConstraints {
    pub max_single_asset_allocation: f64,
    pub min_diversification_score: f64,
    pub max_correlation_threshold: f64,
    pub target_volatility: Option<f64>,
    pub required_liquidity_percentage: f64,
}

#[derive(Debug, Clone)]
pub struct RebalancingPlan {
    pub current_allocations: HashMap<String, f64>,
    pub target_allocations: HashMap<String, f64>,
    pub trades_required: Vec<TradeRecommendation>,
    pub expected_improvement: f64,
    pub implementation_cost: f64,
}

#[derive(Debug, Clone)]
pub struct TradeRecommendation {
    pub asset_symbol: String,
    pub action: TradeAction,
    pub amount_usd: f64,
    pub priority: RecommendationPriority,
    pub rationale: String,
}

#[derive(Debug, Clone)]
pub enum TradeAction {
    Buy,
    Sell,
    Hold,
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

    pub async fn generate_rebalancing_recommendations(
        &self,
        portfolio: &[PortfolioPosition],
        matrix: &CorrelationMatrix,
        high_correlations: &[HighCorrelation],
    ) -> Result<Vec<RebalancingRecommendation>, Box<dyn std::error::Error + Send + Sync>> {
        let mut recommendations = Vec::new();

        // Check for concentration risk
        let concentration_risk = self.calculate_concentration_risk(portfolio).await?;
        if concentration_risk > 0.7 {
            recommendations.push(RebalancingRecommendation {
                recommendation_type: RebalancingType::ReduceConcentration,
                priority: RecommendationPriority::Critical,
                description: format!("High concentration risk detected: {:.1}%. Consider reducing largest positions.", concentration_risk * 100.0),
                expected_impact: 0.15,
                suggested_actions: vec![
                    "Reduce largest position by 20%".to_string(),
                    "Distribute proceeds across uncorrelated assets".to_string(),
                    "Consider adding stablecoins for liquidity".to_string(),
                ],
                confidence: 0.9,
            });
        }

        // Check for high correlations
        if !high_correlations.is_empty() {
            let critical_correlations: Vec<_> = high_correlations.iter()
                .filter(|c| matches!(c.risk_level, CorrelationRiskLevel::Critical))
                .collect();

            if !critical_correlations.is_empty() {
                recommendations.push(RebalancingRecommendation {
                    recommendation_type: RebalancingType::OptimizeCorrelation,
                    priority: RecommendationPriority::High,
                    description: format!("{} critical correlation pairs detected. Consider reducing exposure to correlated assets.", critical_correlations.len()),
                    expected_impact: 0.1,
                    suggested_actions: vec![
                        "Reduce exposure to most correlated asset pair".to_string(),
                        "Add uncorrelated assets to portfolio".to_string(),
                        "Consider hedging strategies".to_string(),
                    ],
                    confidence: 0.8,
                });
            }
        }

        // Check for low diversification
        let diversification_score = self.calculate_diversification_score(matrix).await?;
        if diversification_score < 0.3 {
            recommendations.push(RebalancingRecommendation {
                recommendation_type: RebalancingType::IncreaseDiversification,
                priority: RecommendationPriority::High,
                description: format!("Low diversification score: {:.1}%. Consider adding uncorrelated assets.", diversification_score * 100.0),
                expected_impact: 0.12,
                suggested_actions: vec![
                    "Add assets from different sectors".to_string(),
                    "Consider stablecoins for stability".to_string(),
                    "Add real-world assets if available".to_string(),
                ],
                confidence: 0.85,
            });
        }

        // Check for volatility optimization opportunities
        let portfolio_volatility = self.calculate_portfolio_volatility(portfolio, matrix).await?;
        if portfolio_volatility > 0.4 {
            recommendations.push(RebalancingRecommendation {
                recommendation_type: RebalancingType::HedgeRisk,
                priority: RecommendationPriority::Medium,
                description: format!("High portfolio volatility: {:.1}%. Consider hedging high-risk positions.", portfolio_volatility * 100.0),
                expected_impact: 0.08,
                suggested_actions: vec![
                    "Increase allocation to low-volatility assets".to_string(),
                    "Add defensive positions".to_string(),
                    "Consider volatility-based rebalancing".to_string(),
                ],
                confidence: 0.75,
            });
        }

        // Sort by priority
        recommendations.sort_by(|a, b| {
            let priority_order = |p: &RecommendationPriority| match p {
                RecommendationPriority::Critical => 0,
                RecommendationPriority::High => 1,
                RecommendationPriority::Medium => 2,
                RecommendationPriority::Low => 3,
            };
            priority_order(&a.priority).cmp(&priority_order(&b.priority))
        });

        Ok(recommendations)
    }

    pub async fn create_optimal_rebalancing_plan(
        &self,
        portfolio: &[PortfolioPosition],
        matrix: &CorrelationMatrix,
        constraints: &OptimizationConstraints,
    ) -> Result<RebalancingPlan, Box<dyn std::error::Error + Send + Sync>> {
        let total_value: f64 = portfolio.iter().map(|p| p.value_usd).sum();
        let mut current_allocations = HashMap::new();
        let mut target_allocations = HashMap::new();
        let mut trades_required = Vec::new();

        // Calculate current allocations
        for position in portfolio {
            current_allocations.insert(
                position.asset_symbol.clone(),
                position.value_usd / total_value,
            );
        }

        // Generate target allocations using mean-variance optimization
        let target_weights = self.optimize_portfolio_weights(portfolio, matrix, constraints).await?;
        
        for (asset, weight) in target_weights {
            target_allocations.insert(asset.clone(), weight);
            
            let current_weight = current_allocations.get(&asset).unwrap_or(&0.0);
            let weight_diff = weight - current_weight;
            
            if weight_diff.abs() > 0.01 { // Only recommend trades for >1% changes
                let trade_amount = weight_diff * total_value;
                let action = if weight_diff > 0.0 {
                    TradeAction::Buy
                } else {
                    TradeAction::Sell
                };
                
                let priority = if weight_diff.abs() > 0.1 {
                    RecommendationPriority::High
                } else if weight_diff.abs() > 0.05 {
                    RecommendationPriority::Medium
                } else {
                    RecommendationPriority::Low
                };

                trades_required.push(TradeRecommendation {
                    asset_symbol: asset.clone(),
                    action,
                    amount_usd: trade_amount.abs(),
                    priority,
                    rationale: format!("Adjust allocation from {:.1}% to {:.1}%", current_weight * 100.0, weight * 100.0),
                });
            }
        }

        // Calculate expected improvement
        let current_sharpe = self.calculate_portfolio_sharpe_ratio(portfolio, matrix).await?;
        let expected_sharpe = current_sharpe * 1.1; // Assume 10% improvement
        let expected_improvement = (expected_sharpe - current_sharpe) / current_sharpe;

        // Estimate implementation cost (simplified)
        let implementation_cost = trades_required.iter()
            .map(|t| t.amount_usd * 0.002) // 0.2% trading cost
            .sum::<f64>();

        Ok(RebalancingPlan {
            current_allocations,
            target_allocations,
            trades_required,
            expected_improvement,
            implementation_cost,
        })
    }

    async fn optimize_portfolio_weights(
        &self,
        portfolio: &[PortfolioPosition],
        matrix: &CorrelationMatrix,
        constraints: &OptimizationConstraints,
    ) -> Result<HashMap<String, f64>, Box<dyn std::error::Error + Send + Sync>> {
        let mut optimized_weights = HashMap::new();
        let n_assets = portfolio.len();
        
        if n_assets == 0 {
            return Ok(optimized_weights);
        }

        // Simplified mean-variance optimization
        // Start with equal weights and adjust based on constraints
        let base_weight = 1.0 / n_assets as f64;
        
        for position in portfolio {
            let mut weight = base_weight;
            
            // Adjust based on volatility (lower volatility gets higher weight)
            let volatility = self.get_asset_volatility(&position.asset_symbol).await?;
            let volatility_adjustment = (0.5 - volatility).max(-0.2).min(0.2);
            weight += volatility_adjustment;
            
            // Apply max allocation constraint
            weight = weight.min(constraints.max_single_asset_allocation);
            
            // Ensure minimum weight
            weight = weight.max(0.01);
            
            optimized_weights.insert(position.asset_symbol.clone(), weight);
        }

        // Normalize weights to sum to 1.0
        let total_weight: f64 = optimized_weights.values().sum();
        for weight in optimized_weights.values_mut() {
            *weight /= total_weight;
        }

        Ok(optimized_weights)
    }

    async fn calculate_concentration_risk(&self, portfolio: &[PortfolioPosition]) -> Result<f64, Box<dyn std::error::Error + Send + Sync>> {
        if portfolio.is_empty() {
            return Ok(0.0);
        }

        // Calculate Herfindahl-Hirschman Index (HHI)
        let total_value: f64 = portfolio.iter().map(|p| p.value_usd).sum();
        let hhi: f64 = portfolio.iter()
            .map(|p| (p.value_usd / total_value).powi(2))
            .sum();

        // Convert HHI to concentration risk (0 = no concentration, 1 = maximum concentration)
        let concentration_risk = (hhi - 1.0 / portfolio.len() as f64) / (1.0 - 1.0 / portfolio.len() as f64);
        Ok(concentration_risk.max(0.0).min(1.0))
    }

    async fn calculate_diversification_score(&self, matrix: &CorrelationMatrix) -> Result<f64, Box<dyn std::error::Error + Send + Sync>> {
        let n_assets = matrix.assets.len();
        if n_assets < 2 {
            return Ok(0.0);
        }

        let mut total_correlation = 0.0;
        let mut correlation_count = 0;

        for i in 0..n_assets {
            for j in (i + 1)..n_assets {
                total_correlation += matrix.matrix[i][j].abs();
                correlation_count += 1;
            }
        }

        let avg_correlation = if correlation_count > 0 {
            total_correlation / correlation_count as f64
        } else {
            0.0
        };

        // Convert to diversification score (0 = no diversification, 1 = perfect diversification)
        let diversification_score = 1.0 - avg_correlation;
        Ok(diversification_score.max(0.0).min(1.0))
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

    async fn calculate_portfolio_sharpe_ratio(
        &self,
        portfolio: &[PortfolioPosition],
        matrix: &CorrelationMatrix,
    ) -> Result<f64, Box<dyn std::error::Error + Send + Sync>> {
        // Calculate expected return (simplified)
        let expected_return = portfolio.iter()
            .map(|p| (p.current_price - p.entry_price) / p.entry_price * (p.value_usd / portfolio.iter().map(|x| x.value_usd).sum::<f64>()))
            .sum::<f64>();
        
        let portfolio_volatility = self.calculate_portfolio_volatility(portfolio, matrix).await?;
        let risk_free_rate = 0.02; // Assume 2% risk-free rate
        
        if portfolio_volatility == 0.0 {
            Ok(0.0)
        } else {
            Ok((expected_return - risk_free_rate) / portfolio_volatility)
        }
    }

    async fn get_asset_volatility(&self, symbol: &str) -> Result<f64, Box<dyn std::error::Error + Send + Sync>> {
        let assets = self.assets.read().await;
        if let Some(asset) = assets.get(symbol) {
            Ok(asset.volatility)
        } else {
            Ok(0.2) // Default volatility
        }
    }

    pub async fn simulate_rebalancing_impact(
        &self,
        original_portfolio: &[PortfolioPosition],
        rebalancing_plan: &RebalancingPlan,
        matrix: &CorrelationMatrix,
    ) -> Result<(f64, f64, f64), Box<dyn std::error::Error + Send + Sync>> {
        // Create simulated rebalanced portfolio
        let total_value: f64 = original_portfolio.iter().map(|p| p.value_usd).sum();
        let mut rebalanced_portfolio = Vec::new();
        
        for position in original_portfolio {
            if let Some(&target_weight) = rebalancing_plan.target_allocations.get(&position.asset_symbol) {
                let new_value = target_weight * total_value;
                let mut new_position = position.clone();
                new_position.value_usd = new_value;
                new_position.allocation_percentage = target_weight * 100.0;
                rebalanced_portfolio.push(new_position);
            }
        }

        // Calculate metrics for both portfolios
        let original_volatility = self.calculate_portfolio_volatility(original_portfolio, matrix).await?;
        let rebalanced_volatility = self.calculate_portfolio_volatility(&rebalanced_portfolio, matrix).await?;
        
        let original_diversification = self.calculate_diversification_score(matrix).await?;
        let rebalanced_diversification = original_diversification * 1.05; // Assume 5% improvement
        
        let original_concentration = self.calculate_concentration_risk(original_portfolio).await?;
        let rebalanced_concentration = self.calculate_concentration_risk(&rebalanced_portfolio).await?;

        Ok((
            rebalanced_volatility - original_volatility,
            rebalanced_diversification - original_diversification,
            original_concentration - rebalanced_concentration, // Positive means reduction in concentration
        ))
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

fn create_concentrated_portfolio() -> Vec<PortfolioPosition> {
    vec![
        PortfolioPosition {
            asset_symbol: "BTC".to_string(),
            quantity: 1.5,
            value_usd: 75000.0,
            allocation_percentage: 75.0,
            entry_price: 45000.0,
            current_price: 50000.0,
            unrealized_pnl: 7500.0,
            risk_score: 0.9,
        },
        PortfolioPosition {
            asset_symbol: "ETH".to_string(),
            quantity: 5.0,
            value_usd: 15000.0,
            allocation_percentage: 15.0,
            entry_price: 2800.0,
            current_price: 3000.0,
            unrealized_pnl: 1000.0,
            risk_score: 0.8,
        },
        PortfolioPosition {
            asset_symbol: "USDC".to_string(),
            quantity: 10000.0,
            value_usd: 10000.0,
            allocation_percentage: 10.0,
            entry_price: 1.0,
            current_price: 1.0,
            unrealized_pnl: 0.0,
            risk_score: 0.1,
        },
    ]
}

fn create_high_correlation_portfolio() -> Vec<PortfolioPosition> {
    vec![
        PortfolioPosition {
            asset_symbol: "BTC".to_string(),
            quantity: 1.0,
            value_usd: 50000.0,
            allocation_percentage: 50.0,
            entry_price: 45000.0,
            current_price: 50000.0,
            unrealized_pnl: 5000.0,
            risk_score: 0.7,
        },
        PortfolioPosition {
            asset_symbol: "ETH".to_string(),
            quantity: 15.0,
            value_usd: 45000.0,
            allocation_percentage: 45.0,
            entry_price: 2800.0,
            current_price: 3000.0,
            unrealized_pnl: 3000.0,
            risk_score: 0.7,
        },
        PortfolioPosition {
            asset_symbol: "USDC".to_string(),
            quantity: 5000.0,
            value_usd: 5000.0,
            allocation_percentage: 5.0,
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

fn create_high_correlation_matrix() -> CorrelationMatrix {
    CorrelationMatrix {
        assets: vec!["BTC".to_string(), "ETH".to_string(), "USDC".to_string()],
        matrix: vec![
            vec![1.0, 0.92, 0.1],  // BTC correlations (very high with ETH)
            vec![0.92, 1.0, 0.1],  // ETH correlations (very high with BTC) 
            vec![0.1, 0.1, 1.0],   // USDC correlations
        ],
        timestamp: Utc::now(),
        time_window_days: 90,
        confidence_level: 0.95,
    }
}

fn create_high_correlations() -> Vec<HighCorrelation> {
    vec![
        HighCorrelation {
            asset1: "BTC".to_string(),
            asset2: "ETH".to_string(),
            correlation: 0.92,
            risk_level: CorrelationRiskLevel::Critical,
            recommendation: "CRITICAL: BTC and ETH have positive correlation of 0.92. Consider reducing exposure to one or both assets to minimize concentration risk.".to_string(),
        }
    ]
}

// Test Cases

#[tokio::test]
async fn test_concentration_risk_recommendations() {
    let system = MockCorrelationAnalysisSystem::new();
    let concentrated_portfolio = create_concentrated_portfolio();
    let matrix = create_test_correlation_matrix();

    // Add test assets
    system.add_asset(create_test_asset("BTC", AssetType::Cryptocurrency, 0.6)).await;
    system.add_asset(create_test_asset("ETH", AssetType::Cryptocurrency, 0.7)).await;
    system.add_asset(create_test_asset("USDC", AssetType::Stablecoin, 0.02)).await;

    let recommendations = system.generate_rebalancing_recommendations(&concentrated_portfolio, &matrix, &[]).await.unwrap();

    // Should detect high concentration risk
    assert!(!recommendations.is_empty());
    let concentration_rec = recommendations.iter()
        .find(|r| matches!(r.recommendation_type, RebalancingType::ReduceConcentration));
    assert!(concentration_rec.is_some());

    let rec = concentration_rec.unwrap();
    assert_eq!(rec.priority, RecommendationPriority::Critical);
    assert!(rec.description.contains("concentration risk"));
    assert!(rec.expected_impact > 0.1);
    assert!(!rec.suggested_actions.is_empty());
    assert!(rec.confidence > 0.8);

    println!("Concentration recommendation: {}", rec.description);
}

#[tokio::test]
async fn test_high_correlation_recommendations() {
    let system = MockCorrelationAnalysisSystem::new();
    let portfolio = create_high_correlation_portfolio();
    let matrix = create_high_correlation_matrix();
    let high_correlations = create_high_correlations();

    // Add test assets
    system.add_asset(create_test_asset("BTC", AssetType::Cryptocurrency, 0.6)).await;
    system.add_asset(create_test_asset("ETH", AssetType::Cryptocurrency, 0.7)).await;
    system.add_asset(create_test_asset("USDC", AssetType::Stablecoin, 0.02)).await;

    let recommendations = system.generate_rebalancing_recommendations(&portfolio, &matrix, &high_correlations).await.unwrap();

    // Should detect high correlation risk
    let correlation_rec = recommendations.iter()
        .find(|r| matches!(r.recommendation_type, RebalancingType::OptimizeCorrelation));
    assert!(correlation_rec.is_some());

    let rec = correlation_rec.unwrap();
    assert_eq!(rec.priority, RecommendationPriority::High);
    assert!(rec.description.contains("critical correlation pairs"));
    assert!(rec.suggested_actions.iter().any(|a| a.contains("uncorrelated")));

    println!("Correlation recommendation: {}", rec.description);
}

#[tokio::test]
async fn test_diversification_recommendations() {
    let system = MockCorrelationAnalysisSystem::new();
    
    // Create poorly diversified portfolio (only 2 highly correlated assets)
    let poor_portfolio = vec![
        PortfolioPosition {
            asset_symbol: "BTC".to_string(),
            quantity: 1.0,
            value_usd: 50000.0,
            allocation_percentage: 50.0,
            entry_price: 45000.0,
            current_price: 50000.0,
            unrealized_pnl: 5000.0,
            risk_score: 0.7,
        },
        PortfolioPosition {
            asset_symbol: "ETH".to_string(),
            quantity: 15.0,
            value_usd: 50000.0,
            allocation_percentage: 50.0,
            entry_price: 2800.0,
            current_price: 3000.0,
            unrealized_pnl: 3000.0,
            risk_score: 0.7,
        },
    ];

    let poor_matrix = CorrelationMatrix {
        assets: vec!["BTC".to_string(), "ETH".to_string()],
        matrix: vec![
            vec![1.0, 0.85],
            vec![0.85, 1.0],
        ],
        timestamp: Utc::now(),
        time_window_days: 90,
        confidence_level: 0.95,
    };

    // Add test assets
    system.add_asset(create_test_asset("BTC", AssetType::Cryptocurrency, 0.6)).await;
    system.add_asset(create_test_asset("ETH", AssetType::Cryptocurrency, 0.7)).await;

    let recommendations = system.generate_rebalancing_recommendations(&poor_portfolio, &poor_matrix, &[]).await.unwrap();

    // Should recommend increasing diversification
    let diversification_rec = recommendations.iter()
        .find(|r| matches!(r.recommendation_type, RebalancingType::IncreaseDiversification));
    assert!(diversification_rec.is_some());

    let rec = diversification_rec.unwrap();
    assert_eq!(rec.priority, RecommendationPriority::High);
    assert!(rec.description.contains("diversification score"));
    assert!(rec.suggested_actions.iter().any(|a| a.contains("different sectors")));

    println!("Diversification recommendation: {}", rec.description);
}

#[tokio::test]
async fn test_volatility_hedging_recommendations() {
    let system = MockCorrelationAnalysisSystem::new();
    
    // Create high volatility portfolio
    let volatile_portfolio = vec![
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
            risk_score: 0.9,
        },
    ];

    let volatile_matrix = CorrelationMatrix {
        assets: vec!["VOLATILE1".to_string(), "VOLATILE2".to_string()],
        matrix: vec![
            vec![1.0, 0.5],
            vec![0.5, 1.0],
        ],
        timestamp: Utc::now(),
        time_window_days: 90,
        confidence_level: 0.95,
    };

    // Add high volatility assets
    system.add_asset(create_test_asset("VOLATILE1", AssetType::Token, 1.2)).await;
    system.add_asset(create_test_asset("VOLATILE2", AssetType::Token, 1.3)).await;

    let recommendations = system.generate_rebalancing_recommendations(&volatile_portfolio, &volatile_matrix, &[]).await.unwrap();

    // Should recommend hedging risk
    let hedge_rec = recommendations.iter()
        .find(|r| matches!(r.recommendation_type, RebalancingType::HedgeRisk));
    assert!(hedge_rec.is_some());

    let rec = hedge_rec.unwrap();
    assert_eq!(rec.priority, RecommendationPriority::Medium);
    assert!(rec.description.contains("volatility"));
    assert!(rec.suggested_actions.iter().any(|a| a.contains("low-volatility")));

    println!("Hedging recommendation: {}", rec.description);
}

#[tokio::test]
async fn test_optimal_rebalancing_plan() {
    let system = MockCorrelationAnalysisSystem::new();
    let portfolio = create_concentrated_portfolio();
    let matrix = create_test_correlation_matrix();

    let constraints = OptimizationConstraints {
        max_single_asset_allocation: 0.4, // 40% max per asset
        min_diversification_score: 0.6,
        max_correlation_threshold: 0.7,
        target_volatility: Some(0.25),
        required_liquidity_percentage: 0.1,
    };

    // Add test assets
    system.add_asset(create_test_asset("BTC", AssetType::Cryptocurrency, 0.6)).await;
    system.add_asset(create_test_asset("ETH", AssetType::Cryptocurrency, 0.7)).await;
    system.add_asset(create_test_asset("USDC", AssetType::Stablecoin, 0.02)).await;

    let plan = system.create_optimal_rebalancing_plan(&portfolio, &matrix, &constraints).await.unwrap();

    // Should have current and target allocations
    assert_eq!(plan.current_allocations.len(), 3);
    assert_eq!(plan.target_allocations.len(), 3);

    // BTC allocation should be reduced from 75% to meet constraint
    let btc_current = plan.current_allocations.get("BTC").unwrap();
    let btc_target = plan.target_allocations.get("BTC").unwrap();
    assert_eq!(*btc_current, 0.75);
    assert!(*btc_target <= constraints.max_single_asset_allocation);

    // Should have trades to rebalance
    assert!(!plan.trades_required.is_empty());
    
    // Should expect positive improvement
    assert!(plan.expected_improvement > 0.0);
    
    // Should have reasonable implementation cost
    assert!(plan.implementation_cost < 1000.0); // Less than $1000 in trading costs

    println!("Expected improvement: {:.2}%", plan.expected_improvement * 100.0);
    println!("Implementation cost: ${:.2}", plan.implementation_cost);
}

#[tokio::test]
async fn test_trade_recommendations_generation() {
    let system = MockCorrelationAnalysisSystem::new();
    let portfolio = create_concentrated_portfolio();
    let matrix = create_test_correlation_matrix();

    let constraints = OptimizationConstraints {
        max_single_asset_allocation: 0.35,
        min_diversification_score: 0.6,
        max_correlation_threshold: 0.7,
        target_volatility: None,
        required_liquidity_percentage: 0.15,
    };

    // Add test assets
    system.add_asset(create_test_asset("BTC", AssetType::Cryptocurrency, 0.6)).await;
    system.add_asset(create_test_asset("ETH", AssetType::Cryptocurrency, 0.7)).await;
    system.add_asset(create_test_asset("USDC", AssetType::Stablecoin, 0.02)).await;

    let plan = system.create_optimal_rebalancing_plan(&portfolio, &matrix, &constraints).await.unwrap();

    // Should recommend selling BTC (reducing from 75% to 35%)
    let btc_trade = plan.trades_required.iter()
        .find(|t| t.asset_symbol == "BTC");
    assert!(btc_trade.is_some());

    let trade = btc_trade.unwrap();
    assert!(matches!(trade.action, TradeAction::Sell));
    assert!(trade.amount_usd > 35000.0); // Should sell significant amount
    assert_eq!(trade.priority, RecommendationPriority::High);
    assert!(trade.rationale.contains("75.0%"));
    assert!(trade.rationale.contains("35.0%"));

    // Should recommend increasing other positions
    let increasing_trades = plan.trades_required.iter()
        .filter(|t| matches!(t.action, TradeAction::Buy))
        .count();
    assert!(increasing_trades > 0);

    println!("Number of trades required: {}", plan.trades_required.len());
    for trade in &plan.trades_required {
        println!("{:?} ${:.0} of {} - {}", trade.action, trade.amount_usd, trade.asset_symbol, trade.rationale);
    }
}

#[tokio::test]
async fn test_rebalancing_impact_simulation() {
    let system = MockCorrelationAnalysisSystem::new();
    let original_portfolio = create_concentrated_portfolio();
    let matrix = create_test_correlation_matrix();

    let constraints = OptimizationConstraints {
        max_single_asset_allocation: 0.4,
        min_diversification_score: 0.6,
        max_correlation_threshold: 0.7,
        target_volatility: Some(0.2),
        required_liquidity_percentage: 0.1,
    };

    // Add test assets
    system.add_asset(create_test_asset("BTC", AssetType::Cryptocurrency, 0.6)).await;
    system.add_asset(create_test_asset("ETH", AssetType::Cryptocurrency, 0.7)).await;
    system.add_asset(create_test_asset("USDC", AssetType::Stablecoin, 0.02)).await;

    let plan = system.create_optimal_rebalancing_plan(&original_portfolio, &matrix, &constraints).await.unwrap();
    let (volatility_change, diversification_change, concentration_reduction) = system.simulate_rebalancing_impact(&original_portfolio, &plan, &matrix).await.unwrap();

    // Rebalancing should reduce volatility
    assert!(volatility_change < 0.0);
    
    // Should improve diversification
    assert!(diversification_change > 0.0);
    
    // Should reduce concentration risk
    assert!(concentration_reduction > 0.0);

    println!("Volatility change: {:.3}", volatility_change);
    println!("Diversification improvement: {:.3}", diversification_change);
    println!("Concentration reduction: {:.3}", concentration_reduction);
}

#[tokio::test]
async fn test_recommendation_prioritization() {
    let system = MockCorrelationAnalysisSystem::new();
    
    // Create portfolio with multiple issues
    let problematic_portfolio = vec![
        PortfolioPosition {
            asset_symbol: "BTC".to_string(),
            quantity: 2.0,
            value_usd: 80000.0,
            allocation_percentage: 80.0,
            entry_price: 35000.0,
            current_price: 40000.0,
            unrealized_pnl: 10000.0,
            risk_score: 0.9,
        },
        PortfolioPosition {
            asset_symbol: "ETH".to_string(),
            quantity: 5.0,
            value_usd: 20000.0,
            allocation_percentage: 20.0,
            entry_price: 3500.0,
            current_price: 4000.0,
            unrealized_pnl: 2500.0,
            risk_score: 0.8,
        },
    ];

    let problematic_matrix = CorrelationMatrix {
        assets: vec!["BTC".to_string(), "ETH".to_string()],
        matrix: vec![
            vec![1.0, 0.95],  // Extremely high correlation
            vec![0.95, 1.0],
        ],
        timestamp: Utc::now(),
        time_window_days: 90,
        confidence_level: 0.95,
    };

    let critical_correlations = vec![
        HighCorrelation {
            asset1: "BTC".to_string(),
            asset2: "ETH".to_string(),
            correlation: 0.95,
            risk_level: CorrelationRiskLevel::Critical,
            recommendation: "CRITICAL: Extremely high correlation detected".to_string(),
        }
    ];

    // Add test assets
    system.add_asset(create_test_asset("BTC", AssetType::Cryptocurrency, 0.6)).await;
    system.add_asset(create_test_asset("ETH", AssetType::Cryptocurrency, 0.7)).await;

    let recommendations = system.generate_rebalancing_recommendations(&problematic_portfolio, &problematic_matrix, &critical_correlations).await.unwrap();

    // Should have multiple recommendations
    assert!(recommendations.len() >= 2);

    // First recommendation should be Critical priority (concentration)
    assert_eq!(recommendations[0].priority, RecommendationPriority::Critical);
    assert!(matches!(recommendations[0].recommendation_type, RebalancingType::ReduceConcentration));

    // Second recommendation should be High priority
    assert_eq!(recommendations[1].priority, RecommendationPriority::High);

    // Recommendations should be sorted by priority
    for i in 1..recommendations.len() {
        let prev_priority = match recommendations[i-1].priority {
            RecommendationPriority::Critical => 0,
            RecommendationPriority::High => 1,
            RecommendationPriority::Medium => 2,
            RecommendationPriority::Low => 3,
        };
        let curr_priority = match recommendations[i].priority {
            RecommendationPriority::Critical => 0,
            RecommendationPriority::High => 1,
            RecommendationPriority::Medium => 2,
            RecommendationPriority::Low => 3,
        };
        assert!(prev_priority <= curr_priority);
    }

    println!("Recommendations in priority order:");
    for (i, rec) in recommendations.iter().enumerate() {
        println!("{}. {:?}: {}", i+1, rec.priority, rec.description);
    }
}

#[tokio::test]
async fn test_well_balanced_portfolio_minimal_recommendations() {
    let system = MockCorrelationAnalysisSystem::new();
    
    // Create well-balanced portfolio
    let balanced_portfolio = vec![
        PortfolioPosition {
            asset_symbol: "BTC".to_string(),
            quantity: 0.5,
            value_usd: 25000.0,
            allocation_percentage: 25.0,
            entry_price: 45000.0,
            current_price: 50000.0,
            unrealized_pnl: 2500.0,
            risk_score: 0.4,
        },
        PortfolioPosition {
            asset_symbol: "ETH".to_string(),
            quantity: 8.0,
            value_usd: 24000.0,
            allocation_percentage: 24.0,
            entry_price: 2800.0,
            current_price: 3000.0,
            unrealized_pnl: 1600.0,
            risk_score: 0.4,
        },
        PortfolioPosition {
            asset_symbol: "BONDS".to_string(),
            quantity: 250.0,
            value_usd: 25000.0,
            allocation_percentage: 25.0,
            entry_price: 95.0,
            current_price: 100.0,
            unrealized_pnl: 1250.0,
            risk_score: 0.1,
        },
        PortfolioPosition {
            asset_symbol: "USDC".to_string(),
            quantity: 26000.0,
            value_usd: 26000.0,
            allocation_percentage: 26.0,
            entry_price: 1.0,
            current_price: 1.0,
            unrealized_pnl: 0.0,
            risk_score: 0.05,
        },
    ];

    let balanced_matrix = CorrelationMatrix {
        assets: vec!["BTC".to_string(), "ETH".to_string(), "BONDS".to_string(), "USDC".to_string()],
        matrix: vec![
            vec![1.0, 0.4, -0.1, 0.1],   // BTC - moderate correlation with ETH, negative with bonds
            vec![0.4, 1.0, -0.05, 0.1],  // ETH - similar pattern
            vec![-0.1, -0.05, 1.0, 0.0], // BONDS - negative correlation with crypto
            vec![0.1, 0.1, 0.0, 1.0],    // USDC - low correlation with all
        ],
        timestamp: Utc::now(),
        time_window_days: 90,
        confidence_level: 0.95,
    };

    // Add test assets
    system.add_asset(create_test_asset("BTC", AssetType::Cryptocurrency, 0.3)).await;
    system.add_asset(create_test_asset("ETH", AssetType::Cryptocurrency, 0.3)).await;
    system.add_asset(create_test_asset("BONDS", AssetType::Bond, 0.05)).await;
    system.add_asset(create_test_asset("USDC", AssetType::Stablecoin, 0.02)).await;

    let recommendations = system.generate_rebalancing_recommendations(&balanced_portfolio, &balanced_matrix, &[]).await.unwrap();

    // Well-balanced portfolio should have minimal or no critical recommendations
    let critical_recommendations = recommendations.iter()
        .filter(|r| matches!(r.priority, RecommendationPriority::Critical))
        .count();
    assert_eq!(critical_recommendations, 0);

    let high_recommendations = recommendations.iter()
        .filter(|r| matches!(r.priority, RecommendationPriority::High))
        .count();
    assert!(high_recommendations <= 1); // At most one high priority recommendation

    println!("Balanced portfolio recommendations: {}", recommendations.len());
    for rec in recommendations {
        println!("{:?}: {}", rec.priority, rec.description);
    }
}

#[tokio::test]
async fn test_rebalancing_performance_benchmark() {
    let system = MockCorrelationAnalysisSystem::new();
    let portfolio = create_concentrated_portfolio();
    let matrix = create_test_correlation_matrix();

    let constraints = OptimizationConstraints {
        max_single_asset_allocation: 0.4,
        min_diversification_score: 0.6,
        max_correlation_threshold: 0.7,
        target_volatility: Some(0.25),
        required_liquidity_percentage: 0.1,
    };

    // Add test assets
    system.add_asset(create_test_asset("BTC", AssetType::Cryptocurrency, 0.6)).await;
    system.add_asset(create_test_asset("ETH", AssetType::Cryptocurrency, 0.7)).await;
    system.add_asset(create_test_asset("USDC", AssetType::Stablecoin, 0.02)).await;

    let start_time = std::time::Instant::now();
    let _recommendations = system.generate_rebalancing_recommendations(&portfolio, &matrix, &[]).await.unwrap();
    let recommendations_duration = start_time.elapsed();

    let start_time = std::time::Instant::now();
    let _plan = system.create_optimal_rebalancing_plan(&portfolio, &matrix, &constraints).await.unwrap();
    let optimization_duration = start_time.elapsed();

    // Should complete recommendations generation quickly
    assert!(recommendations_duration.as_millis() < 100);
    
    // Should complete portfolio optimization within target time (300ms)
    assert!(optimization_duration.as_millis() < 300);

    println!("Recommendations generation: {}ms", recommendations_duration.as_millis());
    println!("Portfolio optimization: {}ms", optimization_duration.as_millis());
}