use crate::security::{Vulnerability, VulnerabilitySeverity, VulnerabilityCategory};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use chrono::{DateTime, Utc, Duration};
use rust_decimal::Decimal;
use log::{info, warn, error, debug};

/// Asset price data point
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PricePoint {
    pub timestamp: DateTime<Utc>,
    pub price: f64,
    pub volume: f64,
    pub market_cap: Option<f64>,
}

/// Asset information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Asset {
    pub symbol: String,
    pub name: String,
    pub asset_type: AssetType,
    pub price_history: Vec<PricePoint>,
    pub volatility: f64,
    pub beta: f64,
    pub market_cap: Option<f64>,
}

/// Types of assets
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
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

/// Portfolio position
#[derive(Debug, Clone, Serialize, Deserialize)]
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

/// Portfolio correlation matrix
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CorrelationMatrix {
    pub assets: Vec<String>,
    pub matrix: Vec<Vec<f64>>,
    pub timestamp: DateTime<Utc>,
    pub time_window_days: u32,
    pub confidence_level: f64,
}

/// Correlation analysis result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CorrelationAnalysis {
    pub matrix: CorrelationMatrix,
    pub high_correlations: Vec<HighCorrelation>,
    pub diversification_score: f64,
    pub concentration_risk: f64,
    pub recommendations: Vec<RebalancingRecommendation>,
    pub stress_test_results: StressTestResult,
}

/// High correlation pair
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HighCorrelation {
    pub asset1: String,
    pub asset2: String,
    pub correlation: f64,
    pub risk_level: CorrelationRiskLevel,
    pub recommendation: String,
}

/// Correlation risk levels
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum CorrelationRiskLevel {
    Low,
    Medium,
    High,
    Critical,
}

/// Rebalancing recommendation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RebalancingRecommendation {
    pub recommendation_type: RebalancingType,
    pub priority: RecommendationPriority,
    pub description: String,
    pub expected_impact: f64,
    pub suggested_actions: Vec<String>,
    pub confidence: f64,
}

/// Types of rebalancing recommendations
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum RebalancingType {
    ReduceConcentration,
    IncreaseDiversification,
    HedgeRisk,
    OptimizeCorrelation,
    RebalanceAllocation,
    AddUncorrelatedAsset,
}

/// Recommendation priority levels
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum RecommendationPriority {
    Low,
    Medium,
    High,
    Critical,
}

/// Stress test result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StressTestResult {
    pub scenario_name: String,
    pub portfolio_value_change: f64,
    pub max_drawdown: f64,
    pub var_95: f64, // Value at Risk at 95% confidence
    pub cvar_95: f64, // Conditional Value at Risk at 95% confidence
    pub affected_assets: Vec<String>,
    pub recovery_time_days: Option<u32>,
}

/// Tail risk analysis result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TailRiskAnalysis {
    pub extreme_event_probability: f64,
    pub worst_case_loss: f64,
    pub expected_shortfall: f64,
    pub tail_dependence_matrix: Vec<Vec<f64>>,
    pub risk_mitigation_strategies: Vec<String>,
}

/// Portfolio Correlation Analysis System
pub struct CorrelationAnalysisSystem {
    assets: Arc<RwLock<HashMap<String, Asset>>>,
    portfolios: Arc<RwLock<HashMap<String, Vec<PortfolioPosition>>>>,
    correlation_cache: Arc<RwLock<HashMap<String, CorrelationMatrix>>>,
    config: CorrelationAnalysisConfig,
}

/// Configuration for correlation analysis
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CorrelationAnalysisConfig {
    pub default_time_window_days: u32,
    pub minimum_data_points: usize,
    pub correlation_threshold_high: f64,
    pub correlation_threshold_critical: f64,
    pub confidence_level: f64,
    pub stress_test_scenarios: Vec<StressTestScenario>,
    pub rebalancing_threshold: f64,
    pub max_concentration_percentage: f64,
}

impl Default for CorrelationAnalysisConfig {
    fn default() -> Self {
        Self {
            default_time_window_days: 90,
            minimum_data_points: 30,
            correlation_threshold_high: 0.7,
            correlation_threshold_critical: 0.9,
            confidence_level: 0.95,
            stress_test_scenarios: vec![
                StressTestScenario::MarketCrash,
                StressTestScenario::CryptoWinter,
                StressTestScenario::DeFiContagion,
                StressTestScenario::RegulatoryShock,
                StressTestScenario::BlackSwan,
            ],
            rebalancing_threshold: 0.1,
            max_concentration_percentage: 25.0,
        }
    }
}

/// Stress test scenarios
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum StressTestScenario {
    MarketCrash,
    CryptoWinter,
    DeFiContagion,
    RegulatoryShock,
    BlackSwan,
    Custom(String),
}

impl CorrelationAnalysisSystem {
    pub fn new(config: CorrelationAnalysisConfig) -> Self {
        Self {
            assets: Arc::new(RwLock::new(HashMap::new())),
            portfolios: Arc::new(RwLock::new(HashMap::new())),
            correlation_cache: Arc::new(RwLock::new(HashMap::new())),
            config,
        }
    }

    /// Add asset to the system
    pub async fn add_asset(&self, asset: Asset) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let mut assets = self.assets.write().await;
        assets.insert(asset.symbol.clone(), asset);
        Ok(())
    }

    /// Update asset price data
    pub async fn update_asset_price(
        &self,
        symbol: &str,
        price_point: PricePoint,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let mut assets = self.assets.write().await;
        if let Some(asset) = assets.get_mut(symbol) {
            asset.price_history.push(price_point);
            
            // Keep only recent data points
            let cutoff_time = Utc::now() - Duration::days(self.config.default_time_window_days as i64);
            asset.price_history.retain(|p| p.timestamp >= cutoff_time);
            
            // Update volatility
            asset.volatility = self.calculate_volatility(&asset.price_history).await?;
        }
        Ok(())
    }

    /// Calculate correlation matrix for assets
    pub async fn calculate_correlation_matrix(
        &self,
        asset_symbols: &[String],
        time_window_days: Option<u32>,
    ) -> Result<CorrelationMatrix, Box<dyn std::error::Error + Send + Sync>> {
        let window_days = time_window_days.unwrap_or(self.config.default_time_window_days);
        let cache_key = format!("{}_days", window_days);
        
        // Check cache first
        let cache = self.correlation_cache.read().await;
        if let Some(cached_matrix) = cache.get(&cache_key) {
            if cached_matrix.timestamp >= Utc::now() - Duration::hours(1) {
                return Ok(cached_matrix.clone());
            }
        }
        drop(cache);

        let assets = self.assets.read().await;
        let mut matrix_data = Vec::new();
        let mut valid_assets = Vec::new();

        for symbol in asset_symbols {
            if let Some(asset) = assets.get(symbol) {
                if asset.price_history.len() >= self.config.minimum_data_points {
                    valid_assets.push(symbol.clone());
                    let returns = self.calculate_returns(&asset.price_history).await?;
                    matrix_data.push(returns);
                }
            }
        }

        if matrix_data.len() < 2 {
            return Err("Insufficient data for correlation analysis".into());
        }

        let correlation_matrix = self.compute_correlation_matrix(&matrix_data).await?;

        let matrix = CorrelationMatrix {
            assets: valid_assets,
            matrix: correlation_matrix,
            timestamp: Utc::now(),
            time_window_days: window_days,
            confidence_level: self.config.confidence_level,
        };

        // Cache the result
        let mut cache = self.correlation_cache.write().await;
        cache.insert(cache_key, matrix.clone());

        Ok(matrix)
    }

    /// Perform comprehensive correlation analysis
    pub async fn analyze_portfolio_correlation(
        &self,
        portfolio_id: &str,
    ) -> Result<CorrelationAnalysis, Box<dyn std::error::Error + Send + Sync>> {
        let portfolios = self.portfolios.read().await;
        let portfolio = portfolios.get(portfolio_id)
            .ok_or("Portfolio not found")?;

        let asset_symbols: Vec<String> = portfolio.iter()
            .map(|p| p.asset_symbol.clone())
            .collect();

        // Calculate correlation matrix
        let matrix = self.calculate_correlation_matrix(&asset_symbols, None).await?;

        // Find high correlations
        let high_correlations = self.find_high_correlations(&matrix).await?;

        // Calculate diversification score
        let diversification_score = self.calculate_diversification_score(&matrix).await?;

        // Calculate concentration risk
        let concentration_risk = self.calculate_concentration_risk(portfolio).await?;

        // Generate rebalancing recommendations
        let recommendations = self.generate_rebalancing_recommendations(
            portfolio,
            &matrix,
            &high_correlations,
        ).await?;

        // Perform stress testing
        let stress_test_results = self.perform_stress_testing(
            portfolio,
            &matrix,
        ).await?;

        Ok(CorrelationAnalysis {
            matrix,
            high_correlations,
            diversification_score,
            concentration_risk,
            recommendations,
            stress_test_results,
        })
    }

    /// Calculate asset returns from price history
    async fn calculate_returns(&self, price_history: &[PricePoint]) -> Result<Vec<f64>, Box<dyn std::error::Error + Send + Sync>> {
        if price_history.len() < 2 {
            return Err("Insufficient price data for returns calculation".into());
        }

        let mut returns = Vec::new();
        for i in 1..price_history.len() {
            let current_price = price_history[i].price;
            let previous_price = price_history[i - 1].price;
            let return_rate = (current_price - previous_price) / previous_price;
            returns.push(return_rate);
        }

        Ok(returns)
    }

    /// Calculate asset volatility
    async fn calculate_volatility(&self, price_history: &[PricePoint]) -> Result<f64, Box<dyn std::error::Error + Send + Sync>> {
        let returns = self.calculate_returns(price_history).await?;
        if returns.is_empty() {
            return Ok(0.0);
        }

        let mean = returns.iter().sum::<f64>() / returns.len() as f64;
        let variance = returns.iter()
            .map(|r| (r - mean).powi(2))
            .sum::<f64>() / returns.len() as f64;
        
        Ok(variance.sqrt())
    }

    /// Compute correlation matrix from returns data
    async fn compute_correlation_matrix(&self, returns_data: &[Vec<f64>]) -> Result<Vec<Vec<f64>>, Box<dyn std::error::Error + Send + Sync>> {
        let n_assets = returns_data.len();
        let mut matrix = vec![vec![0.0; n_assets]; n_assets];

        for i in 0..n_assets {
            for j in 0..n_assets {
                if i == j {
                    matrix[i][j] = 1.0;
                } else {
                    matrix[i][j] = self.calculate_correlation(&returns_data[i], &returns_data[j]).await?;
                }
            }
        }

        Ok(matrix)
    }

    /// Calculate correlation between two return series
    async fn calculate_correlation(&self, returns1: &[f64], returns2: &[f64]) -> Result<f64, Box<dyn std::error::Error + Send + Sync>> {
        if returns1.len() != returns2.len() || returns1.is_empty() {
            return Err("Invalid return series for correlation calculation".into());
        }

        let n = returns1.len() as f64;
        let mean1 = returns1.iter().sum::<f64>() / n;
        let mean2 = returns2.iter().sum::<f64>() / n;

        let covariance = returns1.iter().zip(returns2.iter())
            .map(|(r1, r2)| (r1 - mean1) * (r2 - mean2))
            .sum::<f64>() / n;

        let variance1 = returns1.iter()
            .map(|r| (r - mean1).powi(2))
            .sum::<f64>() / n;

        let variance2 = returns2.iter()
            .map(|r| (r - mean2).powi(2))
            .sum::<f64>() / n;

        let correlation = covariance / (variance1.sqrt() * variance2.sqrt());
        Ok(correlation.max(-1.0).min(1.0)) // Clamp between -1 and 1
    }

    /// Find high correlations in the matrix
    async fn find_high_correlations(&self, matrix: &CorrelationMatrix) -> Result<Vec<HighCorrelation>, Box<dyn std::error::Error + Send + Sync>> {
        let mut high_correlations = Vec::new();

        for i in 0..matrix.assets.len() {
            for j in (i + 1)..matrix.assets.len() {
                let correlation = matrix.matrix[i][j];
                let abs_correlation = correlation.abs();

                if abs_correlation >= self.config.correlation_threshold_high {
                    let risk_level = if abs_correlation >= self.config.correlation_threshold_critical {
                        CorrelationRiskLevel::Critical
                    } else {
                        CorrelationRiskLevel::High
                    };

                    let recommendation = self.generate_correlation_recommendation(
                        &matrix.assets[i],
                        &matrix.assets[j],
                        correlation,
                        risk_level,
                    ).await?;

                    high_correlations.push(HighCorrelation {
                        asset1: matrix.assets[i].clone(),
                        asset2: matrix.assets[j].clone(),
                        correlation,
                        risk_level,
                        recommendation,
                    });
                }
            }
        }

        // Sort by absolute correlation value (highest first)
        high_correlations.sort_by(|a, b| b.correlation.abs().partial_cmp(&a.correlation.abs()).unwrap());

        Ok(high_correlations)
    }

    /// Generate recommendation for high correlation pair
    async fn generate_correlation_recommendation(
        &self,
        asset1: &str,
        asset2: &str,
        correlation: f64,
        risk_level: CorrelationRiskLevel,
    ) -> Result<String, Box<dyn std::error::Error + Send + Sync>> {
        let abs_correlation = correlation.abs();
        let direction = if correlation > 0.0 { "positive" } else { "negative" };

        match risk_level {
            CorrelationRiskLevel::Critical => {
                Ok(format!(
                    "CRITICAL: {} and {} have {} correlation of {:.2}. Consider reducing exposure to one or both assets to minimize concentration risk.",
                    asset1, asset2, direction, abs_correlation
                ))
            },
            CorrelationRiskLevel::High => {
                Ok(format!(
                    "HIGH: {} and {} have {} correlation of {:.2}. Monitor closely and consider diversification.",
                    asset1, asset2, direction, abs_correlation
                ))
            },
            _ => {
                Ok(format!(
                    "MEDIUM: {} and {} have {} correlation of {:.2}. Consider monitoring for changes.",
                    asset1, asset2, direction, abs_correlation
                ))
            }
        }
    }

    /// Calculate diversification score
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

    /// Calculate concentration risk
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

    /// Generate rebalancing recommendations
    async fn generate_rebalancing_recommendations(
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

    /// Perform stress testing
    async fn perform_stress_testing(
        &self,
        portfolio: &[PortfolioPosition],
        matrix: &CorrelationMatrix,
    ) -> Result<StressTestResult, Box<dyn std::error::Error + Send + Sync>> {
        // Simulate market crash scenario
        let scenario = StressTestScenario::MarketCrash;
        let scenario_name = match scenario {
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

    /// Calculate scenario impact on portfolio
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

    /// Check if asset is crypto
    async fn is_crypto_asset(&self, symbol: &str) -> Result<bool, Box<dyn std::error::Error + Send + Sync>> {
        let assets = self.assets.read().await;
        if let Some(asset) = assets.get(symbol) {
            Ok(matches!(asset.asset_type, AssetType::Cryptocurrency | AssetType::Token))
        } else {
            Ok(false)
        }
    }

    /// Check if asset is DeFi
    async fn is_defi_asset(&self, symbol: &str) -> Result<bool, Box<dyn std::error::Error + Send + Sync>> {
        let assets = self.assets.read().await;
        if let Some(asset) = assets.get(symbol) {
            Ok(matches!(asset.asset_type, AssetType::DeFiProtocol))
        } else {
            Ok(false)
        }
    }

    /// Calculate risk metrics (VaR and CVaR)
    async fn calculate_risk_metrics(
        &self,
        portfolio: &[PortfolioPosition],
        matrix: &CorrelationMatrix,
    ) -> Result<(f64, f64), Box<dyn std::error::Error + Send + Sync>> {
        // Simplified VaR calculation using historical simulation
        let total_value: f64 = portfolio.iter().map(|p| p.value_usd).sum();
        
        // Calculate portfolio volatility using correlation matrix
        let portfolio_volatility = self.calculate_portfolio_volatility(portfolio, matrix).await?;
        
        // VaR at 95% confidence (1.645 standard deviations)
        let var_95 = -1.645 * portfolio_volatility * total_value;
        
        // CVaR at 95% confidence (expected loss beyond VaR)
        let cvar_95 = -2.063 * portfolio_volatility * total_value;
        
        Ok((var_95, cvar_95))
    }

    /// Calculate portfolio volatility
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
                    // Find correlation in matrix
                    let asset_i = &portfolio[i].asset_symbol;
                    let asset_j = &portfolio[j].asset_symbol;
                    
                    if let (Some(idx_i), Some(idx_j)) = (
                        matrix.assets.iter().position(|a| a == asset_i),
                        matrix.assets.iter().position(|a| a == asset_j),
                    ) {
                        matrix.matrix[idx_i][idx_j]
                    } else {
                        0.0 // Assume no correlation if not in matrix
                    }
                };

                let volatility_i = self.get_asset_volatility(&portfolio[i].asset_symbol).await?;
                let volatility_j = self.get_asset_volatility(&portfolio[j].asset_symbol).await?;
                
                portfolio_variance += weight_i * weight_j * correlation * volatility_i * volatility_j;
            }
        }

        Ok(portfolio_variance.sqrt())
    }

    /// Get asset volatility
    async fn get_asset_volatility(&self, symbol: &str) -> Result<f64, Box<dyn std::error::Error + Send + Sync>> {
        let assets = self.assets.read().await;
        if let Some(asset) = assets.get(symbol) {
            Ok(asset.volatility)
        } else {
            Ok(0.5) // Default volatility if asset not found
        }
    }

    /// Identify assets most affected by scenario
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

    /// Estimate recovery time for scenario
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

    /// Perform tail risk analysis
    pub async fn perform_tail_risk_analysis(
        &self,
        portfolio: &[PortfolioPosition],
        matrix: &CorrelationMatrix,
    ) -> Result<TailRiskAnalysis, Box<dyn std::error::Error + Send + Sync>> {
        // Calculate extreme event probability (simplified)
        let portfolio_volatility = self.calculate_portfolio_volatility(portfolio, matrix).await?;
        let extreme_event_probability = (1.0 - portfolio_volatility).max(0.01); // At least 1%

        // Calculate worst case loss (3 standard deviations)
        let total_value: f64 = portfolio.iter().map(|p| p.value_usd).sum();
        let worst_case_loss = -3.0 * portfolio_volatility * total_value;

        // Calculate expected shortfall
        let expected_shortfall = -2.5 * portfolio_volatility * total_value;

        // Calculate tail dependence matrix (simplified)
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

    /// Calculate tail dependence matrix
    async fn calculate_tail_dependence_matrix(&self, matrix: &CorrelationMatrix) -> Result<Vec<Vec<f64>>, Box<dyn std::error::Error + Send + Sync>> {
        let n_assets = matrix.assets.len();
        let mut tail_matrix = vec![vec![0.0; n_assets]; n_assets];

        for i in 0..n_assets {
            for j in 0..n_assets {
                if i == j {
                    tail_matrix[i][j] = 1.0;
                } else {
                    let correlation = matrix.matrix[i][j];
                    // Simplified tail dependence calculation
                    tail_matrix[i][j] = (correlation + 1.0) / 2.0; // Convert to [0,1] range
                }
            }
        }

        Ok(tail_matrix)
    }

    /// Add portfolio to the system
    pub async fn add_portfolio(
        &self,
        portfolio_id: &str,
        positions: Vec<PortfolioPosition>,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let mut portfolios = self.portfolios.write().await;
        portfolios.insert(portfolio_id.to_string(), positions);
        Ok(())
    }

    /// Update portfolio position
    pub async fn update_portfolio_position(
        &self,
        portfolio_id: &str,
        asset_symbol: &str,
        new_position: PortfolioPosition,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let mut portfolios = self.portfolios.write().await;
        if let Some(portfolio) = portfolios.get_mut(portfolio_id) {
            if let Some(pos) = portfolio.iter_mut().find(|p| p.asset_symbol == asset_symbol) {
                *pos = new_position;
            } else {
                portfolio.push(new_position);
            }
        }
        Ok(())
    }

    /// Get portfolio analysis summary
    pub async fn get_portfolio_summary(&self, portfolio_id: &str) -> Result<String, Box<dyn std::error::Error + Send + Sync>> {
        let analysis = self.analyze_portfolio_correlation(portfolio_id).await?;
        
        let summary = format!(
            "Portfolio Analysis Summary:\n\
            - Diversification Score: {:.1}%\n\
            - Concentration Risk: {:.1}%\n\
            - High Correlations: {}\n\
            - Recommendations: {}\n\
            - Stress Test Impact: {:.1}%\n\
            - VaR (95%): ${:.2}\n\
            - CVaR (95%): ${:.2}",
            analysis.diversification_score * 100.0,
            analysis.concentration_risk * 100.0,
            analysis.high_correlations.len(),
            analysis.recommendations.len(),
            analysis.stress_test_results.portfolio_value_change * 100.0,
            analysis.stress_test_results.var_95,
            analysis.stress_test_results.cvar_95,
        );

        Ok(summary)
    }
}

impl Default for CorrelationAnalysisSystem {
    fn default() -> Self {
        Self::new(CorrelationAnalysisConfig::default())
    }
} 