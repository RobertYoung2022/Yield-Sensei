use tokio;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use chrono::{DateTime, Utc, Duration};

// Mock structures for diversification analysis
#[derive(Debug, Clone)]
pub struct CorrelationAnalysisConfig {
    pub default_time_window_days: u32,
    pub minimum_data_points: usize,
    pub correlation_threshold_high: f64,
    pub correlation_threshold_critical: f64,
    pub confidence_level: f64,
    pub max_concentration_percentage: f64,
    pub rebalancing_threshold: f64,
}

impl Default for CorrelationAnalysisConfig {
    fn default() -> Self {
        Self {
            default_time_window_days: 90,
            minimum_data_points: 30,
            correlation_threshold_high: 0.7,
            correlation_threshold_critical: 0.9,
            confidence_level: 0.95,
            max_concentration_percentage: 25.0,
            rebalancing_threshold: 0.1,
        }
    }
}

#[derive(Debug, Clone, PartialEq)]
pub enum AssetType {
    Cryptocurrency,
    Token,
    Stablecoin,
    DeFiProtocol,
    RealWorldAsset,
    Stock,
    Bond,
    Commodity,
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
    pub asset_type: AssetType,
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
pub struct DiversificationMetrics {
    pub diversification_score: f64,
    pub effective_number_assets: f64,
    pub concentration_risk: f64,
    pub herfindahl_index: f64,
    pub gini_coefficient: f64,
    pub max_weight: f64,
    pub sector_concentration: HashMap<AssetType, f64>,
    pub correlation_based_diversification: f64,
}

#[derive(Debug, Clone)]
pub struct ConcentrationAnalysis {
    pub total_portfolio_value: f64,
    pub largest_position_percentage: f64,
    pub top_5_concentration: f64,
    pub top_10_concentration: f64,
    pub single_asset_limit_violations: Vec<String>,
    pub sector_concentration_violations: Vec<(AssetType, f64)>,
    pub risk_contribution_analysis: HashMap<String, f64>,
}

#[derive(Debug, Clone, PartialEq)]
pub enum DiversificationLevel {
    Poor,       // 0-30%
    Moderate,   // 30-60%
    Good,       // 60-80%
    Excellent,  // 80-100%
}

#[derive(Debug, Clone)]
pub struct DiversificationRecommendation {
    pub recommendation_type: DiversificationAction,
    pub priority: u8, // 1-10 scale
    pub description: String,
    pub expected_improvement: f64,
    pub suggested_allocations: HashMap<String, f64>,
    pub risk_reduction_estimate: f64,
}

#[derive(Debug, Clone)]
pub enum DiversificationAction {
    ReduceLargestPosition,
    AddAssetClass,
    RebalanceAllocations,
    HedgeCorrelatedRisk,
    IncreaseStablecoinAllocation,
    DiversifyAcrossSectors,
    OptimizeRiskParity,
}

pub struct MockDiversificationAnalyzer {
    config: CorrelationAnalysisConfig,
    portfolios: Arc<RwLock<HashMap<String, Vec<PortfolioPosition>>>>,
    correlation_matrices: Arc<RwLock<HashMap<String, CorrelationMatrix>>>,
    diversification_history: Arc<RwLock<HashMap<String, Vec<DiversificationMetrics>>>>,
    benchmark_portfolios: Arc<RwLock<HashMap<String, Vec<PortfolioPosition>>>>,
}

impl MockDiversificationAnalyzer {
    pub fn new(config: CorrelationAnalysisConfig) -> Self {
        Self {
            config,
            portfolios: Arc::new(RwLock::new(HashMap::new())),
            correlation_matrices: Arc::new(RwLock::new(HashMap::new())),
            diversification_history: Arc::new(RwLock::new(HashMap::new())),
            benchmark_portfolios: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    pub async fn add_portfolio(
        &self,
        portfolio_id: &str,
        positions: Vec<PortfolioPosition>,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let mut portfolios = self.portfolios.write().await;
        portfolios.insert(portfolio_id.to_string(), positions);
        Ok(())
    }

    pub async fn calculate_diversification_metrics(
        &self,
        portfolio_id: &str,
    ) -> Result<DiversificationMetrics, Box<dyn std::error::Error + Send + Sync>> {
        let portfolios = self.portfolios.read().await;
        let portfolio = portfolios.get(portfolio_id)
            .ok_or("Portfolio not found")?;

        let total_value: f64 = portfolio.iter().map(|p| p.value_usd).sum();
        if total_value <= 0.0 {
            return Err("Portfolio has no value".into());
        }

        // Calculate basic diversification score
        let diversification_score = self.calculate_basic_diversification_score(portfolio).await?;

        // Calculate effective number of assets (inverse of Herfindahl index)
        let herfindahl_index = self.calculate_herfindahl_index(portfolio).await?;
        let effective_number_assets = if herfindahl_index > 0.0 { 1.0 / herfindahl_index } else { 0.0 };

        // Calculate concentration risk
        let concentration_risk = self.calculate_concentration_risk(portfolio).await?;

        // Calculate Gini coefficient for inequality measurement
        let gini_coefficient = self.calculate_gini_coefficient(portfolio).await?;

        // Find maximum weight
        let max_weight = portfolio.iter()
            .map(|p| p.value_usd / total_value)
            .fold(0.0, f64::max);

        // Calculate sector concentration
        let sector_concentration = self.calculate_sector_concentration(portfolio).await?;

        // Calculate correlation-based diversification if correlation matrix available
        let correlation_based_diversification = self.calculate_correlation_based_diversification(
            portfolio_id, portfolio
        ).await?;

        Ok(DiversificationMetrics {
            diversification_score,
            effective_number_assets,
            concentration_risk,
            herfindahl_index,
            gini_coefficient,
            max_weight,
            sector_concentration,
            correlation_based_diversification,
        })
    }

    pub async fn analyze_concentration_risk(
        &self,
        portfolio_id: &str,
    ) -> Result<ConcentrationAnalysis, Box<dyn std::error::Error + Send + Sync>> {
        let portfolios = self.portfolios.read().await;
        let portfolio = portfolios.get(portfolio_id)
            .ok_or("Portfolio not found")?;

        let total_value: f64 = portfolio.iter().map(|p| p.value_usd).sum();
        
        // Sort positions by value (descending)
        let mut sorted_positions = portfolio.clone();
        sorted_positions.sort_by(|a, b| b.value_usd.partial_cmp(&a.value_usd).unwrap());

        // Calculate largest position percentage
        let largest_position_percentage = if !sorted_positions.is_empty() {
            sorted_positions[0].value_usd / total_value * 100.0
        } else {
            0.0
        };

        // Calculate top 5 concentration
        let top_5_value: f64 = sorted_positions.iter()
            .take(5)
            .map(|p| p.value_usd)
            .sum();
        let top_5_concentration = (top_5_value / total_value) * 100.0;

        // Calculate top 10 concentration
        let top_10_value: f64 = sorted_positions.iter()
            .take(10)
            .map(|p| p.value_usd)
            .sum();
        let top_10_concentration = (top_10_value / total_value) * 100.0;

        // Find single asset limit violations
        let single_asset_limit_violations: Vec<String> = portfolio.iter()
            .filter(|p| (p.value_usd / total_value * 100.0) > self.config.max_concentration_percentage)
            .map(|p| p.asset_symbol.clone())
            .collect();

        // Find sector concentration violations
        let sector_concentrations = self.calculate_sector_concentration(portfolio).await?;
        let sector_concentration_violations: Vec<(AssetType, f64)> = sector_concentrations.iter()
            .filter(|(_, concentration)| **concentration > 50.0) // 50% sector limit
            .map(|(asset_type, concentration)| (asset_type.clone(), *concentration))
            .collect();

        // Calculate risk contribution analysis
        let risk_contribution_analysis = self.calculate_risk_contributions(portfolio).await?;

        Ok(ConcentrationAnalysis {
            total_portfolio_value: total_value,
            largest_position_percentage,
            top_5_concentration,
            top_10_concentration,
            single_asset_limit_violations,
            sector_concentration_violations,
            risk_contribution_analysis,
        })
    }

    pub async fn classify_diversification_level(
        &self,
        diversification_score: f64,
    ) -> DiversificationLevel {
        match diversification_score {
            score if score >= 0.8 => DiversificationLevel::Excellent,
            score if score >= 0.6 => DiversificationLevel::Good,
            score if score >= 0.3 => DiversificationLevel::Moderate,
            _ => DiversificationLevel::Poor,
        }
    }

    pub async fn generate_diversification_recommendations(
        &self,
        portfolio_id: &str,
    ) -> Result<Vec<DiversificationRecommendation>, Box<dyn std::error::Error + Send + Sync>> {
        let metrics = self.calculate_diversification_metrics(portfolio_id).await?;
        let concentration_analysis = self.analyze_concentration_risk(portfolio_id).await?;
        let mut recommendations = Vec::new();

        // Check for largest position concentration
        if concentration_analysis.largest_position_percentage > self.config.max_concentration_percentage {
            recommendations.push(DiversificationRecommendation {
                recommendation_type: DiversificationAction::ReduceLargestPosition,
                priority: 9,
                description: format!(
                    "Largest position represents {:.1}% of portfolio, exceeding {:.1}% limit. Recommend reducing to below {:.1}%.",
                    concentration_analysis.largest_position_percentage,
                    self.config.max_concentration_percentage,
                    self.config.max_concentration_percentage
                ),
                expected_improvement: 0.15,
                suggested_allocations: HashMap::new(),
                risk_reduction_estimate: 0.2,
            });
        }

        // Check for sector concentration
        for (asset_type, concentration) in &concentration_analysis.sector_concentration_violations {
            recommendations.push(DiversificationRecommendation {
                recommendation_type: DiversificationAction::DiversifyAcrossSectors,
                priority: 8,
                description: format!(
                    "{:?} sector represents {:.1}% of portfolio. Consider diversifying across other asset classes.",
                    asset_type, concentration
                ),
                expected_improvement: 0.12,
                suggested_allocations: HashMap::new(),
                risk_reduction_estimate: 0.15,
            });
        }

        // Check for low overall diversification
        if metrics.diversification_score < 0.5 {
            recommendations.push(DiversificationRecommendation {
                recommendation_type: DiversificationAction::AddAssetClass,
                priority: 7,
                description: format!(
                    "Portfolio diversification score is {:.1}%. Consider adding uncorrelated asset classes.",
                    metrics.diversification_score * 100.0
                ),
                expected_improvement: 0.2,
                suggested_allocations: self.suggest_asset_class_allocations().await?,
                risk_reduction_estimate: 0.25,
            });
        }

        // Check for high correlation-based concentration
        if metrics.correlation_based_diversification < 0.4 {
            recommendations.push(DiversificationRecommendation {
                recommendation_type: DiversificationAction::HedgeCorrelatedRisk,
                priority: 6,
                description: "High correlation between major positions detected. Consider hedging strategies or adding negatively correlated assets.".to_string(),
                expected_improvement: 0.1,
                suggested_allocations: HashMap::new(),
                risk_reduction_estimate: 0.18,
            });
        }

        // Check effective number of assets
        if metrics.effective_number_assets < 5.0 {
            recommendations.push(DiversificationRecommendation {
                recommendation_type: DiversificationAction::RebalanceAllocations,
                priority: 5,
                description: format!(
                    "Effective number of assets is {:.1}. Consider more balanced allocations across positions.",
                    metrics.effective_number_assets
                ),
                expected_improvement: 0.08,
                suggested_allocations: HashMap::new(),
                risk_reduction_estimate: 0.12,
            });
        }

        // Sort by priority (highest first)
        recommendations.sort_by(|a, b| b.priority.cmp(&a.priority));

        Ok(recommendations)
    }

    pub async fn compare_to_benchmark(
        &self,
        portfolio_id: &str,
        benchmark_id: &str,
    ) -> Result<f64, Box<dyn std::error::Error + Send + Sync>> {
        let portfolio_metrics = self.calculate_diversification_metrics(portfolio_id).await?;
        
        let benchmarks = self.benchmark_portfolios.read().await;
        let benchmark_portfolio = benchmarks.get(benchmark_id)
            .ok_or("Benchmark portfolio not found")?;

        let benchmark_metrics = self.calculate_portfolio_diversification_metrics(benchmark_portfolio).await?;
        
        // Calculate relative diversification score
        let relative_score = portfolio_metrics.diversification_score / benchmark_metrics.diversification_score;
        Ok(relative_score)
    }

    pub async fn track_diversification_over_time(
        &self,
        portfolio_id: &str,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let metrics = self.calculate_diversification_metrics(portfolio_id).await?;
        
        let mut history = self.diversification_history.write().await;
        history.entry(portfolio_id.to_string())
            .or_insert_with(Vec::new)
            .push(metrics);
        
        // Keep only last 100 measurements
        if let Some(portfolio_history) = history.get_mut(portfolio_id) {
            if portfolio_history.len() > 100 {
                portfolio_history.drain(0..portfolio_history.len() - 100);
            }
        }
        
        Ok(())
    }

    pub async fn calculate_diversification_trend(
        &self,
        portfolio_id: &str,
    ) -> Result<f64, Box<dyn std::error::Error + Send + Sync>> {
        let history = self.diversification_history.read().await;
        let portfolio_history = history.get(portfolio_id)
            .ok_or("No historical data found")?;

        if portfolio_history.len() < 2 {
            return Ok(0.0);
        }

        let recent_score = portfolio_history.last().unwrap().diversification_score;
        let older_score = portfolio_history[portfolio_history.len() - 2].diversification_score;
        
        Ok(recent_score - older_score)
    }

    async fn calculate_basic_diversification_score(
        &self,
        portfolio: &[PortfolioPosition],
    ) -> Result<f64, Box<dyn std::error::Error + Send + Sync>> {
        if portfolio.is_empty() {
            return Ok(0.0);
        }

        let total_value: f64 = portfolio.iter().map(|p| p.value_usd).sum();
        let n_assets = portfolio.len() as f64;

        // Calculate weight-based diversification using entropy
        let mut entropy = 0.0;
        for position in portfolio {
            let weight = position.value_usd / total_value;
            if weight > 0.0 {
                entropy -= weight * weight.ln();
            }
        }

        // Normalize entropy to [0, 1] scale
        let max_entropy = n_assets.ln();
        let diversification_score = if max_entropy > 0.0 {
            entropy / max_entropy
        } else {
            0.0
        };

        Ok(diversification_score.max(0.0).min(1.0))
    }

    async fn calculate_herfindahl_index(
        &self,
        portfolio: &[PortfolioPosition],
    ) -> Result<f64, Box<dyn std::error::Error + Send + Sync>> {
        let total_value: f64 = portfolio.iter().map(|p| p.value_usd).sum();
        if total_value <= 0.0 {
            return Ok(1.0);
        }

        let hhi: f64 = portfolio.iter()
            .map(|p| (p.value_usd / total_value).powi(2))
            .sum();

        Ok(hhi)
    }

    async fn calculate_concentration_risk(
        &self,
        portfolio: &[PortfolioPosition],
    ) -> Result<f64, Box<dyn std::error::Error + Send + Sync>> {
        if portfolio.is_empty() {
            return Ok(1.0);
        }

        let hhi = self.calculate_herfindahl_index(portfolio).await?;
        let n_assets = portfolio.len() as f64;
        
        // Normalize HHI to concentration risk score
        let min_hhi = 1.0 / n_assets; // Perfect equal weighting
        let concentration_risk = (hhi - min_hhi) / (1.0 - min_hhi);
        
        Ok(concentration_risk.max(0.0).min(1.0))
    }

    async fn calculate_gini_coefficient(
        &self,
        portfolio: &[PortfolioPosition],
    ) -> Result<f64, Box<dyn std::error::Error + Send + Sync>> {
        if portfolio.is_empty() {
            return Ok(0.0);
        }

        let total_value: f64 = portfolio.iter().map(|p| p.value_usd).sum();
        let mut weights: Vec<f64> = portfolio.iter()
            .map(|p| p.value_usd / total_value)
            .collect();
        
        weights.sort_by(|a, b| a.partial_cmp(b).unwrap());
        
        let n = weights.len() as f64;
        let mut gini = 0.0;
        
        for (i, weight) in weights.iter().enumerate() {
            gini += (2.0 * (i as f64 + 1.0) - n - 1.0) * weight;
        }
        
        gini /= n;
        Ok(gini.max(0.0).min(1.0))
    }

    async fn calculate_sector_concentration(
        &self,
        portfolio: &[PortfolioPosition],
    ) -> Result<HashMap<AssetType, f64>, Box<dyn std::error::Error + Send + Sync>> {
        let total_value: f64 = portfolio.iter().map(|p| p.value_usd).sum();
        let mut sector_values: HashMap<AssetType, f64> = HashMap::new();

        for position in portfolio {
            *sector_values.entry(position.asset_type.clone()).or_insert(0.0) += position.value_usd;
        }

        let sector_percentages: HashMap<AssetType, f64> = sector_values.iter()
            .map(|(asset_type, value)| (asset_type.clone(), (value / total_value) * 100.0))
            .collect();

        Ok(sector_percentages)
    }

    async fn calculate_correlation_based_diversification(
        &self,
        portfolio_id: &str,
        portfolio: &[PortfolioPosition],
    ) -> Result<f64, Box<dyn std::error::Error + Send + Sync>> {
        let matrices = self.correlation_matrices.read().await;
        if let Some(matrix) = matrices.get(portfolio_id) {
            // Calculate portfolio-weighted average correlation
            let total_value: f64 = portfolio.iter().map(|p| p.value_usd).sum();
            let mut weighted_correlation = 0.0;
            let mut total_weight = 0.0;

            for i in 0..portfolio.len() {
                for j in (i + 1)..portfolio.len() {
                    let weight_i = portfolio[i].value_usd / total_value;
                    let weight_j = portfolio[j].value_usd / total_value;
                    let combined_weight = weight_i * weight_j;

                    // Find correlation in matrix
                    if let (Some(idx_i), Some(idx_j)) = (
                        matrix.assets.iter().position(|a| a == &portfolio[i].asset_symbol),
                        matrix.assets.iter().position(|a| a == &portfolio[j].asset_symbol),
                    ) {
                        let correlation = matrix.matrix[idx_i][idx_j].abs(); // Use absolute correlation
                        weighted_correlation += correlation * combined_weight;
                        total_weight += combined_weight;
                    }
                }
            }

            let avg_correlation = if total_weight > 0.0 {
                weighted_correlation / total_weight
            } else {
                0.0
            };

            // Convert to diversification score (1 - average correlation)
            Ok(1.0 - avg_correlation)
        } else {
            // Default to basic diversification if no correlation matrix
            Ok(0.5)
        }
    }

    async fn calculate_risk_contributions(
        &self,
        portfolio: &[PortfolioPosition],
    ) -> Result<HashMap<String, f64>, Box<dyn std::error::Error + Send + Sync>> {
        let total_value: f64 = portfolio.iter().map(|p| p.value_usd).sum();
        let mut risk_contributions = HashMap::new();

        for position in portfolio {
            let weight = position.value_usd / total_value;
            // Simplified risk contribution: weight * risk_score
            let risk_contribution = weight * position.risk_score;
            risk_contributions.insert(position.asset_symbol.clone(), risk_contribution);
        }

        Ok(risk_contributions)
    }

    async fn suggest_asset_class_allocations(
        &self,
    ) -> Result<HashMap<String, f64>, Box<dyn std::error::Error + Send + Sync>> {
        let mut suggestions = HashMap::new();
        suggestions.insert("Stablecoins".to_string(), 15.0);
        suggestions.insert("Blue-chip Crypto".to_string(), 30.0);
        suggestions.insert("DeFi Protocols".to_string(), 20.0);
        suggestions.insert("Real World Assets".to_string(), 10.0);
        suggestions.insert("Commodities".to_string(), 5.0);
        suggestions.insert("Alternative Assets".to_string(), 20.0);
        Ok(suggestions)
    }

    async fn calculate_portfolio_diversification_metrics(
        &self,
        portfolio: &[PortfolioPosition],
    ) -> Result<DiversificationMetrics, Box<dyn std::error::Error + Send + Sync>> {
        let total_value: f64 = portfolio.iter().map(|p| p.value_usd).sum();
        
        let diversification_score = self.calculate_basic_diversification_score(portfolio).await?;
        let herfindahl_index = self.calculate_herfindahl_index(portfolio).await?;
        let effective_number_assets = if herfindahl_index > 0.0 { 1.0 / herfindahl_index } else { 0.0 };
        let concentration_risk = self.calculate_concentration_risk(portfolio).await?;
        let gini_coefficient = self.calculate_gini_coefficient(portfolio).await?;
        let max_weight = portfolio.iter()
            .map(|p| p.value_usd / total_value)
            .fold(0.0, f64::max);
        let sector_concentration = self.calculate_sector_concentration(portfolio).await?;

        Ok(DiversificationMetrics {
            diversification_score,
            effective_number_assets,
            concentration_risk,
            herfindahl_index,
            gini_coefficient,
            max_weight,
            sector_concentration,
            correlation_based_diversification: 0.5, // Default value
        })
    }

    pub async fn add_correlation_matrix(
        &self,
        portfolio_id: &str,
        matrix: CorrelationMatrix,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let mut matrices = self.correlation_matrices.write().await;
        matrices.insert(portfolio_id.to_string(), matrix);
        Ok(())
    }

    pub async fn add_benchmark_portfolio(
        &self,
        benchmark_id: &str,
        positions: Vec<PortfolioPosition>,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let mut benchmarks = self.benchmark_portfolios.write().await;
        benchmarks.insert(benchmark_id.to_string(), positions);
        Ok(())
    }

    pub async fn get_diversification_history(
        &self,
        portfolio_id: &str,
    ) -> Result<Vec<DiversificationMetrics>, Box<dyn std::error::Error + Send + Sync>> {
        let history = self.diversification_history.read().await;
        Ok(history.get(portfolio_id).cloned().unwrap_or_default())
    }
}

// Test implementations

#[tokio::test]
async fn test_basic_diversification_calculation() {
    let config = CorrelationAnalysisConfig::default();
    let analyzer = MockDiversificationAnalyzer::new(config);

    // Create a well-diversified portfolio
    let diversified_portfolio = vec![
        PortfolioPosition {
            asset_symbol: "BTC".to_string(),
            quantity: 0.5,
            value_usd: 25000.0,
            allocation_percentage: 25.0,
            entry_price: 45000.0,
            current_price: 50000.0,
            unrealized_pnl: 2500.0,
            risk_score: 0.7,
            asset_type: AssetType::Cryptocurrency,
        },
        PortfolioPosition {
            asset_symbol: "ETH".to_string(),
            quantity: 8.0,
            value_usd: 24000.0,
            allocation_percentage: 24.0,
            entry_price: 2800.0,
            current_price: 3000.0,
            unrealized_pnl: 1600.0,
            risk_score: 0.8,
            asset_type: AssetType::Cryptocurrency,
        },
        PortfolioPosition {
            asset_symbol: "USDC".to_string(),
            quantity: 25000.0,
            value_usd: 25000.0,
            allocation_percentage: 25.0,
            entry_price: 1.0,
            current_price: 1.0,
            unrealized_pnl: 0.0,
            risk_score: 0.1,
            asset_type: AssetType::Stablecoin,
        },
        PortfolioPosition {
            asset_symbol: "AAVE".to_string(),
            quantity: 200.0,
            value_usd: 26000.0,
            allocation_percentage: 26.0,
            entry_price: 120.0,
            current_price: 130.0,
            unrealized_pnl: 2000.0,
            risk_score: 0.9,
            asset_type: AssetType::DeFiProtocol,
        },
    ];

    analyzer.add_portfolio("diversified", diversified_portfolio).await.unwrap();
    let metrics = analyzer.calculate_diversification_metrics("diversified").await.unwrap();

    assert!(metrics.diversification_score > 0.7); // Should be well diversified
    assert!(metrics.effective_number_assets > 3.5); // Close to 4 with equal weights
    assert!(metrics.concentration_risk < 0.3); // Low concentration risk
    assert!(metrics.herfindahl_index < 0.3); // Low HHI indicates good diversification
    assert!(metrics.gini_coefficient < 0.1); // Low inequality
    assert!(metrics.max_weight < 0.3); // No single position dominates
}

#[tokio::test]
async fn test_concentrated_portfolio_analysis() {
    let config = CorrelationAnalysisConfig::default();
    let analyzer = MockDiversificationAnalyzer::new(config);

    // Create a concentrated portfolio
    let concentrated_portfolio = vec![
        PortfolioPosition {
            asset_symbol: "BTC".to_string(),
            quantity: 1.8,
            value_usd: 90000.0,
            allocation_percentage: 90.0,
            entry_price: 45000.0,
            current_price: 50000.0,
            unrealized_pnl: 9000.0,
            risk_score: 0.7,
            asset_type: AssetType::Cryptocurrency,
        },
        PortfolioPosition {
            asset_symbol: "ETH".to_string(),
            quantity: 3.3,
            value_usd: 10000.0,
            allocation_percentage: 10.0,
            entry_price: 2800.0,
            current_price: 3000.0,
            unrealized_pnl: 666.0,
            risk_score: 0.8,
            asset_type: AssetType::Cryptocurrency,
        },
    ];

    analyzer.add_portfolio("concentrated", concentrated_portfolio).await.unwrap();
    let metrics = analyzer.calculate_diversification_metrics("concentrated").await.unwrap();

    assert!(metrics.diversification_score < 0.4); // Poor diversification
    assert!(metrics.effective_number_assets < 1.5); // Heavily weighted toward one asset
    assert!(metrics.concentration_risk > 0.7); // High concentration risk
    assert!(metrics.herfindahl_index > 0.8); // High HHI indicates concentration
    assert!(metrics.gini_coefficient > 0.6); // High inequality
    assert!(metrics.max_weight > 0.8); // One position dominates
}

#[tokio::test]
async fn test_concentration_risk_analysis() {
    let config = CorrelationAnalysisConfig {
        max_concentration_percentage: 20.0,
        ..CorrelationAnalysisConfig::default()
    };
    let analyzer = MockDiversificationAnalyzer::new(config);

    let portfolio = vec![
        PortfolioPosition {
            asset_symbol: "BTC".to_string(),
            quantity: 1.0,
            value_usd: 50000.0,
            allocation_percentage: 45.45,
            entry_price: 45000.0,
            current_price: 50000.0,
            unrealized_pnl: 5000.0,
            risk_score: 0.7,
            asset_type: AssetType::Cryptocurrency,
        },
        PortfolioPosition {
            asset_symbol: "ETH".to_string(),
            quantity: 10.0,
            value_usd: 30000.0,
            allocation_percentage: 27.27,
            entry_price: 2800.0,
            current_price: 3000.0,
            unrealized_pnl: 2000.0,
            risk_score: 0.8,
            asset_type: AssetType::Cryptocurrency,
        },
        PortfolioPosition {
            asset_symbol: "USDC".to_string(),
            quantity: 20000.0,
            value_usd: 20000.0,
            allocation_percentage: 18.18,
            entry_price: 1.0,
            current_price: 1.0,
            unrealized_pnl: 0.0,
            risk_score: 0.1,
            asset_type: AssetType::Stablecoin,
        },
        PortfolioPosition {
            asset_symbol: "LINK".to_string(),
            quantity: 500.0,
            value_usd: 10000.0,
            allocation_percentage: 9.09,
            entry_price: 18.0,
            current_price: 20.0,
            unrealized_pnl: 1000.0,
            risk_score: 0.9,
            asset_type: AssetType::Token,
        },
    ];

    analyzer.add_portfolio("test", portfolio).await.unwrap();
    let analysis = analyzer.analyze_concentration_risk("test").await.unwrap();

    assert_eq!(analysis.total_portfolio_value, 110000.0);
    assert!((analysis.largest_position_percentage - 45.45).abs() < 0.1);
    assert!((analysis.top_5_concentration - 100.0).abs() < 0.1); // All 4 positions
    assert_eq!(analysis.single_asset_limit_violations.len(), 2); // BTC and ETH exceed 20%
    assert!(analysis.single_asset_limit_violations.contains(&"BTC".to_string()));
    assert!(analysis.single_asset_limit_violations.contains(&"ETH".to_string()));
}

#[tokio::test]
async fn test_diversification_level_classification() {
    let config = CorrelationAnalysisConfig::default();
    let analyzer = MockDiversificationAnalyzer::new(config);

    assert_eq!(analyzer.classify_diversification_level(0.9).await, DiversificationLevel::Excellent);
    assert_eq!(analyzer.classify_diversification_level(0.7).await, DiversificationLevel::Good);
    assert_eq!(analyzer.classify_diversification_level(0.5).await, DiversificationLevel::Moderate);
    assert_eq!(analyzer.classify_diversification_level(0.2).await, DiversificationLevel::Poor);
}

#[tokio::test]
async fn test_sector_concentration_analysis() {
    let config = CorrelationAnalysisConfig::default();
    let analyzer = MockDiversificationAnalyzer::new(config);

    let portfolio = vec![
        PortfolioPosition {
            asset_symbol: "BTC".to_string(),
            quantity: 1.0,
            value_usd: 40000.0,
            allocation_percentage: 40.0,
            entry_price: 45000.0,
            current_price: 50000.0,
            unrealized_pnl: 5000.0,
            risk_score: 0.7,
            asset_type: AssetType::Cryptocurrency,
        },
        PortfolioPosition {
            asset_symbol: "ETH".to_string(),
            quantity: 10.0,
            value_usd: 30000.0,
            allocation_percentage: 30.0,
            entry_price: 2800.0,
            current_price: 3000.0,
            unrealized_pnl: 2000.0,
            risk_score: 0.8,
            asset_type: AssetType::Cryptocurrency,
        },
        PortfolioPosition {
            asset_symbol: "AAVE".to_string(),
            quantity: 200.0,
            value_usd: 20000.0,
            allocation_percentage: 20.0,
            entry_price: 90.0,
            current_price: 100.0,
            unrealized_pnl: 2000.0,
            risk_score: 0.9,
            asset_type: AssetType::DeFiProtocol,
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
            asset_type: AssetType::Stablecoin,
        },
    ];

    analyzer.add_portfolio("sector_test", portfolio).await.unwrap();
    let metrics = analyzer.calculate_diversification_metrics("sector_test").await.unwrap();

    // Check sector concentration
    let crypto_concentration = metrics.sector_concentration.get(&AssetType::Cryptocurrency).unwrap_or(&0.0);
    let defi_concentration = metrics.sector_concentration.get(&AssetType::DeFiProtocol).unwrap_or(&0.0);
    let stable_concentration = metrics.sector_concentration.get(&AssetType::Stablecoin).unwrap_or(&0.0);

    assert!((crypto_concentration - 70.0).abs() < 1.0); // 70% in crypto
    assert!((defi_concentration - 20.0).abs() < 1.0); // 20% in DeFi
    assert!((stable_concentration - 10.0).abs() < 1.0); // 10% in stablecoins
}

#[tokio::test]
async fn test_diversification_recommendations() {
    let config = CorrelationAnalysisConfig {
        max_concentration_percentage: 25.0,
        ..CorrelationAnalysisConfig::default()
    };
    let analyzer = MockDiversificationAnalyzer::new(config);

    // Create portfolio with concentration issues
    let portfolio = vec![
        PortfolioPosition {
            asset_symbol: "BTC".to_string(),
            quantity: 1.0,
            value_usd: 60000.0,
            allocation_percentage: 60.0,
            entry_price: 50000.0,
            current_price: 50000.0,
            unrealized_pnl: 0.0,
            risk_score: 0.7,
            asset_type: AssetType::Cryptocurrency,
        },
        PortfolioPosition {
            asset_symbol: "ETH".to_string(),
            quantity: 13.33,
            value_usd: 40000.0,
            allocation_percentage: 40.0,
            entry_price: 3000.0,
            current_price: 3000.0,
            unrealized_pnl: 0.0,
            risk_score: 0.8,
            asset_type: AssetType::Cryptocurrency,
        },
    ];

    analyzer.add_portfolio("concentrated", portfolio).await.unwrap();
    let recommendations = analyzer.generate_diversification_recommendations("concentrated").await.unwrap();

    assert!(!recommendations.is_empty());
    
    // Should recommend reducing largest position
    let reduce_position_rec = recommendations.iter()
        .find(|r| matches!(r.recommendation_type, DiversificationAction::ReduceLargestPosition));
    assert!(reduce_position_rec.is_some());
    assert!(reduce_position_rec.unwrap().priority >= 8);

    // Should recommend adding asset classes
    let add_asset_rec = recommendations.iter()
        .find(|r| matches!(r.recommendation_type, DiversificationAction::AddAssetClass));
    assert!(add_asset_rec.is_some());

    // Should recommend sector diversification (100% crypto)
    let sector_rec = recommendations.iter()
        .find(|r| matches!(r.recommendation_type, DiversificationAction::DiversifyAcrossSectors));
    assert!(sector_rec.is_some());
}

#[tokio::test]
async fn test_correlation_based_diversification() {
    let config = CorrelationAnalysisConfig::default();
    let analyzer = MockDiversificationAnalyzer::new(config);

    let portfolio = vec![
        PortfolioPosition {
            asset_symbol: "BTC".to_string(),
            quantity: 1.0,
            value_usd: 50000.0,
            allocation_percentage: 50.0,
            entry_price: 50000.0,
            current_price: 50000.0,
            unrealized_pnl: 0.0,
            risk_score: 0.7,
            asset_type: AssetType::Cryptocurrency,
        },
        PortfolioPosition {
            asset_symbol: "ETH".to_string(),
            quantity: 16.67,
            value_usd: 50000.0,
            allocation_percentage: 50.0,
            entry_price: 3000.0,
            current_price: 3000.0,
            unrealized_pnl: 0.0,
            risk_score: 0.8,
            asset_type: AssetType::Cryptocurrency,
        },
    ];

    // Add correlation matrix with high correlation between BTC and ETH
    let correlation_matrix = CorrelationMatrix {
        assets: vec!["BTC".to_string(), "ETH".to_string()],
        matrix: vec![
            vec![1.0, 0.9], // High correlation
            vec![0.9, 1.0],
        ],
        timestamp: Utc::now(),
        time_window_days: 90,
        confidence_level: 0.95,
    };

    analyzer.add_portfolio("corr_test", portfolio).await.unwrap();
    analyzer.add_correlation_matrix("corr_test", correlation_matrix).await.unwrap();
    
    let metrics = analyzer.calculate_diversification_metrics("corr_test").await.unwrap();

    // Should show poor correlation-based diversification due to high correlation
    assert!(metrics.correlation_based_diversification < 0.2);
}

#[tokio::test]
async fn test_benchmark_comparison() {
    let config = CorrelationAnalysisConfig::default();
    let analyzer = MockDiversificationAnalyzer::new(config);

    // Create test portfolio
    let portfolio = vec![
        PortfolioPosition {
            asset_symbol: "BTC".to_string(),
            quantity: 1.0,
            value_usd: 33333.0,
            allocation_percentage: 33.33,
            entry_price: 50000.0,
            current_price: 50000.0,
            unrealized_pnl: 0.0,
            risk_score: 0.7,
            asset_type: AssetType::Cryptocurrency,
        },
        PortfolioPosition {
            asset_symbol: "ETH".to_string(),
            quantity: 11.11,
            value_usd: 33333.0,
            allocation_percentage: 33.33,
            entry_price: 3000.0,
            current_price: 3000.0,
            unrealized_pnl: 0.0,
            risk_score: 0.8,
            asset_type: AssetType::Cryptocurrency,
        },
        PortfolioPosition {
            asset_symbol: "USDC".to_string(),
            quantity: 33334.0,
            value_usd: 33334.0,
            allocation_percentage: 33.34,
            entry_price: 1.0,
            current_price: 1.0,
            unrealized_pnl: 0.0,
            risk_score: 0.1,
            asset_type: AssetType::Stablecoin,
        },
    ];

    // Create benchmark portfolio (more diversified)
    let benchmark = vec![
        PortfolioPosition {
            asset_symbol: "BTC".to_string(),
            quantity: 0.5,
            value_usd: 20000.0,
            allocation_percentage: 20.0,
            entry_price: 50000.0,
            current_price: 50000.0,
            unrealized_pnl: 0.0,
            risk_score: 0.7,
            asset_type: AssetType::Cryptocurrency,
        },
        PortfolioPosition {
            asset_symbol: "ETH".to_string(),
            quantity: 6.67,
            value_usd: 20000.0,
            allocation_percentage: 20.0,
            entry_price: 3000.0,
            current_price: 3000.0,
            unrealized_pnl: 0.0,
            risk_score: 0.8,
            asset_type: AssetType::Cryptocurrency,
        },
        PortfolioPosition {
            asset_symbol: "USDC".to_string(),
            quantity: 20000.0,
            value_usd: 20000.0,
            allocation_percentage: 20.0,
            entry_price: 1.0,
            current_price: 1.0,
            unrealized_pnl: 0.0,
            risk_score: 0.1,
            asset_type: AssetType::Stablecoin,
        },
        PortfolioPosition {
            asset_symbol: "AAVE".to_string(),
            quantity: 200.0,
            value_usd: 20000.0,
            allocation_percentage: 20.0,
            entry_price: 100.0,
            current_price: 100.0,
            unrealized_pnl: 0.0,
            risk_score: 0.9,
            asset_type: AssetType::DeFiProtocol,
        },
        PortfolioPosition {
            asset_symbol: "LINK".to_string(),
            quantity: 1000.0,
            value_usd: 20000.0,
            allocation_percentage: 20.0,
            entry_price: 20.0,
            current_price: 20.0,
            unrealized_pnl: 0.0,
            risk_score: 0.8,
            asset_type: AssetType::Token,
        },
    ];

    analyzer.add_portfolio("test", portfolio).await.unwrap();
    analyzer.add_benchmark_portfolio("benchmark", benchmark).await.unwrap();

    let relative_score = analyzer.compare_to_benchmark("test", "benchmark").await.unwrap();
    
    // Test portfolio should have lower diversification than benchmark
    assert!(relative_score < 1.0);
}

#[tokio::test]
async fn test_diversification_tracking_over_time() {
    let config = CorrelationAnalysisConfig::default();
    let analyzer = MockDiversificationAnalyzer::new(config);

    let portfolio = vec![
        PortfolioPosition {
            asset_symbol: "BTC".to_string(),
            quantity: 1.0,
            value_usd: 50000.0,
            allocation_percentage: 50.0,
            entry_price: 50000.0,
            current_price: 50000.0,
            unrealized_pnl: 0.0,
            risk_score: 0.7,
            asset_type: AssetType::Cryptocurrency,
        },
        PortfolioPosition {
            asset_symbol: "ETH".to_string(),
            quantity: 16.67,
            value_usd: 50000.0,
            allocation_percentage: 50.0,
            entry_price: 3000.0,
            current_price: 3000.0,
            unrealized_pnl: 0.0,
            risk_score: 0.8,
            asset_type: AssetType::Cryptocurrency,
        },
    ];

    analyzer.add_portfolio("tracking", portfolio).await.unwrap();

    // Track diversification multiple times
    for _ in 0..5 {
        analyzer.track_diversification_over_time("tracking").await.unwrap();
    }

    let history = analyzer.get_diversification_history("tracking").await.unwrap();
    assert_eq!(history.len(), 5);

    // All entries should have the same diversification score for this static portfolio
    let first_score = history[0].diversification_score;
    for metrics in &history {
        assert!((metrics.diversification_score - first_score).abs() < 1e-10);
    }
}

#[tokio::test]
async fn test_diversification_trend_calculation() {
    let config = CorrelationAnalysisConfig::default();
    let analyzer = MockDiversificationAnalyzer::new(config);

    let portfolio = vec![
        PortfolioPosition {
            asset_symbol: "BTC".to_string(),
            quantity: 1.0,
            value_usd: 50000.0,
            allocation_percentage: 50.0,
            entry_price: 50000.0,
            current_price: 50000.0,
            unrealized_pnl: 0.0,
            risk_score: 0.7,
            asset_type: AssetType::Cryptocurrency,
        },
        PortfolioPosition {
            asset_symbol: "ETH".to_string(),
            quantity: 16.67,
            value_usd: 50000.0,
            allocation_percentage: 50.0,
            entry_price: 3000.0,
            current_price: 3000.0,
            unrealized_pnl: 0.0,
            risk_score: 0.8,
            asset_type: AssetType::Cryptocurrency,
        },
    ];

    analyzer.add_portfolio("trend", portfolio).await.unwrap();

    // Track initial state
    analyzer.track_diversification_over_time("trend").await.unwrap();

    // Simulate improved diversification by adding more assets
    let improved_portfolio = vec![
        PortfolioPosition {
            asset_symbol: "BTC".to_string(),
            quantity: 0.67,
            value_usd: 33500.0,
            allocation_percentage: 33.5,
            entry_price: 50000.0,
            current_price: 50000.0,
            unrealized_pnl: 0.0,
            risk_score: 0.7,
            asset_type: AssetType::Cryptocurrency,
        },
        PortfolioPosition {
            asset_symbol: "ETH".to_string(),
            quantity: 11.17,
            value_usd: 33500.0,
            allocation_percentage: 33.5,
            entry_price: 3000.0,
            current_price: 3000.0,
            unrealized_pnl: 0.0,
            risk_score: 0.8,
            asset_type: AssetType::Cryptocurrency,
        },
        PortfolioPosition {
            asset_symbol: "USDC".to_string(),
            quantity: 33000.0,
            value_usd: 33000.0,
            allocation_percentage: 33.0,
            entry_price: 1.0,
            current_price: 1.0,
            unrealized_pnl: 0.0,
            risk_score: 0.1,
            asset_type: AssetType::Stablecoin,
        },
    ];

    analyzer.add_portfolio("trend", improved_portfolio).await.unwrap();
    analyzer.track_diversification_over_time("trend").await.unwrap();

    let trend = analyzer.calculate_diversification_trend("trend").await.unwrap();
    
    // Should show positive trend (improved diversification)
    assert!(trend > 0.0);
}

#[tokio::test]
async fn test_herfindahl_index_calculation() {
    let config = CorrelationAnalysisConfig::default();
    let analyzer = MockDiversificationAnalyzer::new(config);

    // Perfect equal weighting (4 assets, 25% each)
    let equal_portfolio = vec![
        create_position("BTC", 25000.0, AssetType::Cryptocurrency),
        create_position("ETH", 25000.0, AssetType::Cryptocurrency),
        create_position("USDC", 25000.0, AssetType::Stablecoin),
        create_position("AAVE", 25000.0, AssetType::DeFiProtocol),
    ];

    analyzer.add_portfolio("equal", equal_portfolio).await.unwrap();
    let equal_metrics = analyzer.calculate_diversification_metrics("equal").await.unwrap();

    // HHI for equal weights should be 1/n = 0.25
    assert!((equal_metrics.herfindahl_index - 0.25).abs() < 0.01);
    assert!((equal_metrics.effective_number_assets - 4.0).abs() < 0.1);

    // Highly concentrated portfolio (90% in one asset)
    let concentrated_portfolio = vec![
        create_position("BTC", 90000.0, AssetType::Cryptocurrency),
        create_position("ETH", 10000.0, AssetType::Cryptocurrency),
    ];

    analyzer.add_portfolio("concentrated", concentrated_portfolio).await.unwrap();
    let concentrated_metrics = analyzer.calculate_diversification_metrics("concentrated").await.unwrap();

    // HHI should be close to (0.9)^2 + (0.1)^2 = 0.82
    assert!(concentrated_metrics.herfindahl_index > 0.8);
    assert!(concentrated_metrics.effective_number_assets < 1.3);
}

#[tokio::test]
async fn test_gini_coefficient_calculation() {
    let config = CorrelationAnalysisConfig::default();
    let analyzer = MockDiversificationAnalyzer::new(config);

    // Perfect equality
    let equal_portfolio = vec![
        create_position("A", 25000.0, AssetType::Token),
        create_position("B", 25000.0, AssetType::Token),
        create_position("C", 25000.0, AssetType::Token),
        create_position("D", 25000.0, AssetType::Token),
    ];

    analyzer.add_portfolio("equal", equal_portfolio).await.unwrap();
    let equal_metrics = analyzer.calculate_diversification_metrics("equal").await.unwrap();

    // Gini coefficient should be close to 0 for perfect equality
    assert!(equal_metrics.gini_coefficient < 0.05);

    // Perfect inequality (one asset has everything)
    let unequal_portfolio = vec![
        create_position("A", 99900.0, AssetType::Token),
        create_position("B", 100.0, AssetType::Token),
    ];

    analyzer.add_portfolio("unequal", unequal_portfolio).await.unwrap();
    let unequal_metrics = analyzer.calculate_diversification_metrics("unequal").await.unwrap();

    // Gini coefficient should be close to 1 for perfect inequality
    assert!(unequal_metrics.gini_coefficient > 0.9);
}

#[tokio::test]
async fn test_empty_portfolio_handling() {
    let config = CorrelationAnalysisConfig::default();
    let analyzer = MockDiversificationAnalyzer::new(config);

    let empty_portfolio: Vec<PortfolioPosition> = vec![];
    analyzer.add_portfolio("empty", empty_portfolio).await.unwrap();

    let result = analyzer.calculate_diversification_metrics("empty").await;
    assert!(result.is_err());
}

#[tokio::test]
async fn test_single_asset_portfolio() {
    let config = CorrelationAnalysisConfig::default();
    let analyzer = MockDiversificationAnalyzer::new(config);

    let single_asset_portfolio = vec![
        create_position("BTC", 100000.0, AssetType::Cryptocurrency),
    ];

    analyzer.add_portfolio("single", single_asset_portfolio).await.unwrap();
    let metrics = analyzer.calculate_diversification_metrics("single").await.unwrap();

    assert_eq!(metrics.diversification_score, 0.0); // No diversification possible
    assert_eq!(metrics.effective_number_assets, 1.0); // Only one asset
    assert_eq!(metrics.concentration_risk, 1.0); // Maximum concentration
    assert_eq!(metrics.herfindahl_index, 1.0); // Maximum HHI
    assert_eq!(metrics.max_weight, 1.0); // 100% weight
}

#[tokio::test]
async fn test_performance_with_large_portfolio() {
    let config = CorrelationAnalysisConfig::default();
    let analyzer = MockDiversificationAnalyzer::new(config);

    // Create portfolio with 50 assets
    let mut large_portfolio = Vec::new();
    for i in 0..50 {
        large_portfolio.push(create_position(
            &format!("ASSET{}", i),
            1000.0 + (i as f64 * 100.0),
            if i % 3 == 0 { AssetType::Cryptocurrency } 
            else if i % 3 == 1 { AssetType::Token } 
            else { AssetType::DeFiProtocol }
        ));
    }

    analyzer.add_portfolio("large", large_portfolio).await.unwrap();

    let start_time = std::time::Instant::now();
    let metrics = analyzer.calculate_diversification_metrics("large").await.unwrap();
    let calculation_time = start_time.elapsed();

    // Should complete within 100ms for 50 assets
    assert!(calculation_time.as_millis() < 100);
    assert!(metrics.effective_number_assets > 30.0); // Should be well-diversified
    assert!(metrics.diversification_score > 0.8); // Good diversification
}

// Helper function to create test positions
fn create_position(symbol: &str, value: f64, asset_type: AssetType) -> PortfolioPosition {
    PortfolioPosition {
        asset_symbol: symbol.to_string(),
        quantity: value / 100.0, // Arbitrary price of 100
        value_usd: value,
        allocation_percentage: 0.0, // Will be calculated
        entry_price: 100.0,
        current_price: 100.0,
        unrealized_pnl: 0.0,
        risk_score: match asset_type {
            AssetType::Stablecoin => 0.1,
            AssetType::Cryptocurrency => 0.7,
            AssetType::DeFiProtocol => 0.9,
            _ => 0.5,
        },
        asset_type,
    }
}