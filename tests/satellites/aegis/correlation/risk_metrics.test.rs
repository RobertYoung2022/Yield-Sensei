use tokio;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use chrono::{DateTime, Utc, Duration};

// Mock structures for risk metrics analysis
#[derive(Debug, Clone)]
pub struct CorrelationAnalysisConfig {
    pub default_time_window_days: u32,
    pub minimum_data_points: usize,
    pub confidence_level: f64,
    pub var_confidence_levels: Vec<f64>,
    pub stress_test_scenarios: Vec<String>,
}

impl Default for CorrelationAnalysisConfig {
    fn default() -> Self {
        Self {
            default_time_window_days: 90,
            minimum_data_points: 30,
            confidence_level: 0.95,
            var_confidence_levels: vec![0.95, 0.99, 0.995],
            stress_test_scenarios: vec![
                "Market Crash".to_string(),
                "Crypto Winter".to_string(),
                "DeFi Contagion".to_string(),
            ],
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
}

#[derive(Debug, Clone)]
pub struct PortfolioPosition {
    pub asset_symbol: String,
    pub quantity: f64,
    pub value_usd: f64,
    pub allocation_percentage: f64,
    pub volatility: f64,
    pub beta: f64,
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
pub struct RiskMetrics {
    pub var_95: f64,
    pub var_99: f64,
    pub var_995: f64,
    pub cvar_95: f64,
    pub cvar_99: f64,
    pub cvar_995: f64,
    pub portfolio_volatility: f64,
    pub sharpe_ratio: f64,
    pub sortino_ratio: f64,
    pub maximum_drawdown: f64,
    pub calmar_ratio: f64,
    pub portfolio_beta: f64,
    pub tracking_error: f64,
    pub information_ratio: f64,
}

#[derive(Debug, Clone)]
pub struct ComponentRiskAnalysis {
    pub individual_var: HashMap<String, f64>,
    pub marginal_var: HashMap<String, f64>,
    pub component_var: HashMap<String, f64>,
    pub risk_contributions: HashMap<String, f64>,
    pub diversification_ratio: f64,
    pub concentration_index: f64,
}

#[derive(Debug, Clone)]
pub struct VolatilityMetrics {
    pub realized_volatility: f64,
    pub implied_volatility: Option<f64>,
    pub volatility_of_volatility: f64,
    pub volatility_skew: f64,
    pub garch_volatility: f64,
    pub ewma_volatility: f64,
    pub parkinson_volatility: f64,
    pub garman_klass_volatility: f64,
}

#[derive(Debug, Clone)]
pub struct DownsideRiskMetrics {
    pub downside_deviation: f64,
    pub semi_variance: f64,
    pub downside_beta: f64,
    pub pain_index: f64,
    pub ulcer_index: f64,
    pub sterling_ratio: f64,
    pub burke_ratio: f64,
}

#[derive(Debug, Clone)]
pub struct ExtremeRiskMetrics {
    pub expected_shortfall_95: f64,
    pub expected_shortfall_99: f64,
    pub tail_expectation: f64,
    pub extreme_value_index: f64,
    pub hill_estimator: f64,
    pub peaks_over_threshold: f64,
}

pub struct MockRiskMetricsCalculator {
    config: CorrelationAnalysisConfig,
    portfolios: Arc<RwLock<HashMap<String, Vec<PortfolioPosition>>>>,
    correlation_matrices: Arc<RwLock<HashMap<String, CorrelationMatrix>>>,
    price_returns: Arc<RwLock<HashMap<String, Vec<f64>>>>,
    benchmark_returns: Arc<RwLock<Vec<f64>>>,
    risk_free_rate: f64,
}

impl MockRiskMetricsCalculator {
    pub fn new(config: CorrelationAnalysisConfig) -> Self {
        Self {
            config,
            portfolios: Arc::new(RwLock::new(HashMap::new())),
            correlation_matrices: Arc::new(RwLock::new(HashMap::new())),
            price_returns: Arc::new(RwLock::new(HashMap::new())),
            benchmark_returns: Arc::new(RwLock::new(Vec::new())),
            risk_free_rate: 0.02, // 2% annual risk-free rate
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

    pub async fn add_correlation_matrix(
        &self,
        portfolio_id: &str,
        matrix: CorrelationMatrix,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let mut matrices = self.correlation_matrices.write().await;
        matrices.insert(portfolio_id.to_string(), matrix);
        Ok(())
    }

    pub async fn add_price_returns(
        &self,
        portfolio_id: &str,
        returns: Vec<f64>,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let mut price_returns = self.price_returns.write().await;
        price_returns.insert(portfolio_id.to_string(), returns);
        Ok(())
    }

    pub async fn calculate_risk_metrics(
        &self,
        portfolio_id: &str,
    ) -> Result<RiskMetrics, Box<dyn std::error::Error + Send + Sync>> {
        let portfolios = self.portfolios.read().await;
        let portfolio = portfolios.get(portfolio_id)
            .ok_or("Portfolio not found")?;

        let total_value: f64 = portfolio.iter().map(|p| p.value_usd).sum();
        let portfolio_volatility = self.calculate_portfolio_volatility(portfolio_id).await?;

        // Calculate VaR and CVaR
        let (var_95, var_99, var_995) = self.calculate_var_multiple_levels(portfolio_id).await?;
        let (cvar_95, cvar_99, cvar_995) = self.calculate_cvar_multiple_levels(portfolio_id).await?;

        // Calculate performance metrics
        let sharpe_ratio = self.calculate_sharpe_ratio(portfolio_id).await?;
        let sortino_ratio = self.calculate_sortino_ratio(portfolio_id).await?;
        let maximum_drawdown = self.calculate_maximum_drawdown(portfolio_id).await?;
        let calmar_ratio = self.calculate_calmar_ratio(portfolio_id).await?;
        let portfolio_beta = self.calculate_portfolio_beta(portfolio_id).await?;
        let tracking_error = self.calculate_tracking_error(portfolio_id).await?;
        let information_ratio = self.calculate_information_ratio(portfolio_id).await?;

        Ok(RiskMetrics {
            var_95,
            var_99,
            var_995,
            cvar_95,
            cvar_99,
            cvar_995,
            portfolio_volatility,
            sharpe_ratio,
            sortino_ratio,
            maximum_drawdown,
            calmar_ratio,
            portfolio_beta,
            tracking_error,
            information_ratio,
        })
    }

    pub async fn calculate_component_risk_analysis(
        &self,
        portfolio_id: &str,
    ) -> Result<ComponentRiskAnalysis, Box<dyn std::error::Error + Send + Sync>> {
        let portfolios = self.portfolios.read().await;
        let portfolio = portfolios.get(portfolio_id)
            .ok_or("Portfolio not found")?;

        let total_value: f64 = portfolio.iter().map(|p| p.value_usd).sum();
        let mut individual_var = HashMap::new();
        let mut marginal_var = HashMap::new();
        let mut component_var = HashMap::new();
        let mut risk_contributions = HashMap::new();

        let portfolio_var = self.calculate_var_single_level(portfolio_id, 0.95).await?;

        for position in portfolio {
            let weight = position.value_usd / total_value;
            
            // Individual VaR (standalone risk)
            let individual_vol = position.volatility;
            let individual_var_value = 1.645 * individual_vol * position.value_usd; // 95% VaR
            individual_var.insert(position.asset_symbol.clone(), individual_var_value);

            // Marginal VaR (incremental risk)
            let marginal_var_value = self.calculate_marginal_var(portfolio_id, &position.asset_symbol).await?;
            marginal_var.insert(position.asset_symbol.clone(), marginal_var_value);

            // Component VaR (contribution to total VaR)
            let component_var_value = weight * marginal_var_value;
            component_var.insert(position.asset_symbol.clone(), component_var_value);

            // Risk contribution percentage
            let risk_contribution = if portfolio_var > 0.0 {
                component_var_value / portfolio_var * 100.0
            } else {
                0.0
            };
            risk_contributions.insert(position.asset_symbol.clone(), risk_contribution);
        }

        let diversification_ratio = self.calculate_diversification_ratio(portfolio_id).await?;
        let concentration_index = self.calculate_concentration_index(portfolio_id).await?;

        Ok(ComponentRiskAnalysis {
            individual_var,
            marginal_var,
            component_var,
            risk_contributions,
            diversification_ratio,
            concentration_index,
        })
    }

    pub async fn calculate_volatility_metrics(
        &self,
        portfolio_id: &str,
    ) -> Result<VolatilityMetrics, Box<dyn std::error::Error + Send + Sync>> {
        let returns = self.get_portfolio_returns(portfolio_id).await?;
        
        let realized_volatility = self.calculate_realized_volatility(&returns).await?;
        let volatility_of_volatility = self.calculate_volatility_of_volatility(&returns).await?;
        let volatility_skew = self.calculate_volatility_skew(&returns).await?;
        let garch_volatility = self.calculate_garch_volatility(&returns).await?;
        let ewma_volatility = self.calculate_ewma_volatility(&returns).await?;
        let parkinson_volatility = self.calculate_parkinson_volatility(portfolio_id).await?;
        let garman_klass_volatility = self.calculate_garman_klass_volatility(portfolio_id).await?;

        Ok(VolatilityMetrics {
            realized_volatility,
            implied_volatility: None, // Would require options data
            volatility_of_volatility,
            volatility_skew,
            garch_volatility,
            ewma_volatility,
            parkinson_volatility,
            garman_klass_volatility,
        })
    }

    pub async fn calculate_downside_risk_metrics(
        &self,
        portfolio_id: &str,
    ) -> Result<DownsideRiskMetrics, Box<dyn std::error::Error + Send + Sync>> {
        let returns = self.get_portfolio_returns(portfolio_id).await?;
        
        let downside_deviation = self.calculate_downside_deviation(&returns).await?;
        let semi_variance = self.calculate_semi_variance(&returns).await?;
        let downside_beta = self.calculate_downside_beta(portfolio_id).await?;
        let pain_index = self.calculate_pain_index(&returns).await?;
        let ulcer_index = self.calculate_ulcer_index(&returns).await?;
        let sterling_ratio = self.calculate_sterling_ratio(portfolio_id).await?;
        let burke_ratio = self.calculate_burke_ratio(portfolio_id).await?;

        Ok(DownsideRiskMetrics {
            downside_deviation,
            semi_variance,
            downside_beta,
            pain_index,
            ulcer_index,
            sterling_ratio,
            burke_ratio,
        })
    }

    pub async fn calculate_extreme_risk_metrics(
        &self,
        portfolio_id: &str,
    ) -> Result<ExtremeRiskMetrics, Box<dyn std::error::Error + Send + Sync>> {
        let returns = self.get_portfolio_returns(portfolio_id).await?;
        
        let expected_shortfall_95 = self.calculate_expected_shortfall(&returns, 0.95).await?;
        let expected_shortfall_99 = self.calculate_expected_shortfall(&returns, 0.99).await?;
        let tail_expectation = self.calculate_tail_expectation(&returns).await?;
        let extreme_value_index = self.calculate_extreme_value_index(&returns).await?;
        let hill_estimator = self.calculate_hill_estimator(&returns).await?;
        let peaks_over_threshold = self.calculate_peaks_over_threshold(&returns).await?;

        Ok(ExtremeRiskMetrics {
            expected_shortfall_95,
            expected_shortfall_99,
            tail_expectation,
            extreme_value_index,
            hill_estimator,
            peaks_over_threshold,
        })
    }

    async fn calculate_portfolio_volatility(
        &self,
        portfolio_id: &str,
    ) -> Result<f64, Box<dyn std::error::Error + Send + Sync>> {
        let portfolios = self.portfolios.read().await;
        let portfolio = portfolios.get(portfolio_id)
            .ok_or("Portfolio not found")?;

        let matrices = self.correlation_matrices.read().await;
        if let Some(matrix) = matrices.get(portfolio_id) {
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
                            0.0
                        }
                    };

                    let volatility_i = portfolio[i].volatility;
                    let volatility_j = portfolio[j].volatility;
                    
                    portfolio_variance += weight_i * weight_j * correlation * volatility_i * volatility_j;
                }
            }

            Ok(portfolio_variance.sqrt())
        } else {
            // Fallback to simple weighted average volatility
            let total_value: f64 = portfolio.iter().map(|p| p.value_usd).sum();
            let weighted_vol = portfolio.iter()
                .map(|p| (p.value_usd / total_value) * p.volatility)
                .sum();
            Ok(weighted_vol)
        }
    }

    async fn calculate_var_multiple_levels(
        &self,
        portfolio_id: &str,
    ) -> Result<(f64, f64, f64), Box<dyn std::error::Error + Send + Sync>> {
        let var_95 = self.calculate_var_single_level(portfolio_id, 0.95).await?;
        let var_99 = self.calculate_var_single_level(portfolio_id, 0.99).await?;
        let var_995 = self.calculate_var_single_level(portfolio_id, 0.995).await?;
        Ok((var_95, var_99, var_995))
    }

    async fn calculate_var_single_level(
        &self,
        portfolio_id: &str,
        confidence_level: f64,
    ) -> Result<f64, Box<dyn std::error::Error + Send + Sync>> {
        let portfolios = self.portfolios.read().await;
        let portfolio = portfolios.get(portfolio_id)
            .ok_or("Portfolio not found")?;

        let total_value: f64 = portfolio.iter().map(|p| p.value_usd).sum();
        let portfolio_volatility = self.calculate_portfolio_volatility(portfolio_id).await?;
        
        // Use normal distribution approximation
        let z_score = match confidence_level {
            0.90 => 1.282,
            0.95 => 1.645,
            0.99 => 2.326,
            0.995 => 2.576,
            _ => 1.645, // Default to 95%
        };
        
        let var = z_score * portfolio_volatility * total_value;
        Ok(var)
    }

    async fn calculate_cvar_multiple_levels(
        &self,
        portfolio_id: &str,
    ) -> Result<(f64, f64, f64), Box<dyn std::error::Error + Send + Sync>> {
        let cvar_95 = self.calculate_cvar_single_level(portfolio_id, 0.95).await?;
        let cvar_99 = self.calculate_cvar_single_level(portfolio_id, 0.99).await?;
        let cvar_995 = self.calculate_cvar_single_level(portfolio_id, 0.995).await?;
        Ok((cvar_95, cvar_99, cvar_995))
    }

    async fn calculate_cvar_single_level(
        &self,
        portfolio_id: &str,
        confidence_level: f64,
    ) -> Result<f64, Box<dyn std::error::Error + Send + Sync>> {
        let var = self.calculate_var_single_level(portfolio_id, confidence_level).await?;
        
        // CVaR approximation for normal distribution
        let multiplier = match confidence_level {
            0.90 => 1.755,
            0.95 => 2.063,
            0.99 => 2.665,
            0.995 => 2.892,
            _ => 2.063, // Default to 95%
        };
        
        let portfolios = self.portfolios.read().await;
        let portfolio = portfolios.get(portfolio_id)
            .ok_or("Portfolio not found")?;
        let total_value: f64 = portfolio.iter().map(|p| p.value_usd).sum();
        let portfolio_volatility = self.calculate_portfolio_volatility(portfolio_id).await?;
        
        let cvar = multiplier * portfolio_volatility * total_value;
        Ok(cvar)
    }

    async fn calculate_sharpe_ratio(
        &self,
        portfolio_id: &str,
    ) -> Result<f64, Box<dyn std::error::Error + Send + Sync>> {
        let returns = self.get_portfolio_returns(portfolio_id).await?;
        if returns.is_empty() {
            return Ok(0.0);
        }

        let mean_return = returns.iter().sum::<f64>() / returns.len() as f64;
        let excess_return = mean_return - self.risk_free_rate / 252.0; // Daily risk-free rate
        let volatility = self.calculate_realized_volatility(&returns).await?;
        
        if volatility == 0.0 {
            Ok(0.0)
        } else {
            Ok(excess_return / volatility * (252.0_f64).sqrt()) // Annualized
        }
    }

    async fn calculate_sortino_ratio(
        &self,
        portfolio_id: &str,
    ) -> Result<f64, Box<dyn std::error::Error + Send + Sync>> {
        let returns = self.get_portfolio_returns(portfolio_id).await?;
        if returns.is_empty() {
            return Ok(0.0);
        }

        let mean_return = returns.iter().sum::<f64>() / returns.len() as f64;
        let excess_return = mean_return - self.risk_free_rate / 252.0;
        let downside_deviation = self.calculate_downside_deviation(&returns).await?;
        
        if downside_deviation == 0.0 {
            Ok(0.0)
        } else {
            Ok(excess_return / downside_deviation * (252.0_f64).sqrt())
        }
    }

    async fn calculate_maximum_drawdown(
        &self,
        portfolio_id: &str,
    ) -> Result<f64, Box<dyn std::error::Error + Send + Sync>> {
        let returns = self.get_portfolio_returns(portfolio_id).await?;
        if returns.is_empty() {
            return Ok(0.0);
        }

        let mut cumulative_returns = vec![1.0];
        for ret in &returns {
            let last_value = cumulative_returns.last().unwrap();
            cumulative_returns.push(last_value * (1.0 + ret));
        }

        let mut max_drawdown = 0.0;
        let mut peak = cumulative_returns[0];

        for value in &cumulative_returns[1..] {
            if *value > peak {
                peak = *value;
            } else {
                let drawdown = (peak - value) / peak;
                if drawdown > max_drawdown {
                    max_drawdown = drawdown;
                }
            }
        }

        Ok(max_drawdown)
    }

    async fn calculate_calmar_ratio(
        &self,
        portfolio_id: &str,
    ) -> Result<f64, Box<dyn std::error::Error + Send + Sync>> {
        let returns = self.get_portfolio_returns(portfolio_id).await?;
        if returns.is_empty() {
            return Ok(0.0);
        }

        let mean_return = returns.iter().sum::<f64>() / returns.len() as f64;
        let annualized_return = mean_return * 252.0;
        let max_drawdown = self.calculate_maximum_drawdown(portfolio_id).await?;
        
        if max_drawdown == 0.0 {
            Ok(0.0)
        } else {
            Ok(annualized_return / max_drawdown)
        }
    }

    async fn calculate_portfolio_beta(
        &self,
        portfolio_id: &str,
    ) -> Result<f64, Box<dyn std::error::Error + Send + Sync>> {
        let portfolios = self.portfolios.read().await;
        let portfolio = portfolios.get(portfolio_id)
            .ok_or("Portfolio not found")?;

        let total_value: f64 = portfolio.iter().map(|p| p.value_usd).sum();
        let weighted_beta = portfolio.iter()
            .map(|p| (p.value_usd / total_value) * p.beta)
            .sum();
            
        Ok(weighted_beta)
    }

    async fn calculate_tracking_error(
        &self,
        portfolio_id: &str,
    ) -> Result<f64, Box<dyn std::error::Error + Send + Sync>> {
        let portfolio_returns = self.get_portfolio_returns(portfolio_id).await?;
        let benchmark_returns = self.benchmark_returns.read().await;
        
        if portfolio_returns.len() != benchmark_returns.len() || portfolio_returns.is_empty() {
            return Ok(0.0);
        }

        let excess_returns: Vec<f64> = portfolio_returns.iter()
            .zip(benchmark_returns.iter())
            .map(|(p, b)| p - b)
            .collect();

        let mean_excess = excess_returns.iter().sum::<f64>() / excess_returns.len() as f64;
        let variance = excess_returns.iter()
            .map(|r| (r - mean_excess).powi(2))
            .sum::<f64>() / excess_returns.len() as f64;
            
        Ok(variance.sqrt() * (252.0_f64).sqrt()) // Annualized
    }

    async fn calculate_information_ratio(
        &self,
        portfolio_id: &str,
    ) -> Result<f64, Box<dyn std::error::Error + Send + Sync>> {
        let portfolio_returns = self.get_portfolio_returns(portfolio_id).await?;
        let benchmark_returns = self.benchmark_returns.read().await;
        
        if portfolio_returns.len() != benchmark_returns.len() || portfolio_returns.is_empty() {
            return Ok(0.0);
        }

        let excess_returns: Vec<f64> = portfolio_returns.iter()
            .zip(benchmark_returns.iter())
            .map(|(p, b)| p - b)
            .collect();

        let mean_excess = excess_returns.iter().sum::<f64>() / excess_returns.len() as f64;
        let tracking_error = self.calculate_tracking_error(portfolio_id).await?;
        
        if tracking_error == 0.0 {
            Ok(0.0)
        } else {
            Ok(mean_excess * 252.0 / tracking_error) // Annualized
        }
    }

    async fn calculate_marginal_var(
        &self,
        portfolio_id: &str,
        asset_symbol: &str,
    ) -> Result<f64, Box<dyn std::error::Error + Send + Sync>> {
        let portfolios = self.portfolios.read().await;
        let portfolio = portfolios.get(portfolio_id)
            .ok_or("Portfolio not found")?;

        let asset_position = portfolio.iter()
            .find(|p| p.asset_symbol == asset_symbol)
            .ok_or("Asset not found in portfolio")?;

        let portfolio_volatility = self.calculate_portfolio_volatility(portfolio_id).await?;
        let total_value: f64 = portfolio.iter().map(|p| p.value_usd).sum();
        
        // Simplified marginal VaR calculation
        let asset_weight = asset_position.value_usd / total_value;
        let marginal_var = 1.645 * portfolio_volatility * asset_weight * total_value;
        
        Ok(marginal_var)
    }

    async fn calculate_diversification_ratio(
        &self,
        portfolio_id: &str,
    ) -> Result<f64, Box<dyn std::error::Error + Send + Sync>> {
        let portfolios = self.portfolios.read().await;
        let portfolio = portfolios.get(portfolio_id)
            .ok_or("Portfolio not found")?;

        let total_value: f64 = portfolio.iter().map(|p| p.value_usd).sum();
        let weighted_avg_volatility = portfolio.iter()
            .map(|p| (p.value_usd / total_value) * p.volatility)
            .sum::<f64>();
            
        let portfolio_volatility = self.calculate_portfolio_volatility(portfolio_id).await?;
        
        if portfolio_volatility == 0.0 {
            Ok(1.0)
        } else {
            Ok(weighted_avg_volatility / portfolio_volatility)
        }
    }

    async fn calculate_concentration_index(
        &self,
        portfolio_id: &str,
    ) -> Result<f64, Box<dyn std::error::Error + Send + Sync>> {
        let portfolios = self.portfolios.read().await;
        let portfolio = portfolios.get(portfolio_id)
            .ok_or("Portfolio not found")?;

        let total_value: f64 = portfolio.iter().map(|p| p.value_usd).sum();
        let hhi: f64 = portfolio.iter()
            .map(|p| (p.value_usd / total_value).powi(2))
            .sum();
            
        Ok(hhi)
    }

    async fn get_portfolio_returns(
        &self,
        portfolio_id: &str,
    ) -> Result<Vec<f64>, Box<dyn std::error::Error + Send + Sync>> {
        let price_returns = self.price_returns.read().await;
        Ok(price_returns.get(portfolio_id).cloned().unwrap_or_default())
    }

    async fn calculate_realized_volatility(
        &self,
        returns: &[f64],
    ) -> Result<f64, Box<dyn std::error::Error + Send + Sync>> {
        if returns.is_empty() {
            return Ok(0.0);
        }

        let mean = returns.iter().sum::<f64>() / returns.len() as f64;
        let variance = returns.iter()
            .map(|r| (r - mean).powi(2))
            .sum::<f64>() / returns.len() as f64;
            
        Ok(variance.sqrt())
    }

    async fn calculate_volatility_of_volatility(
        &self,
        returns: &[f64],
    ) -> Result<f64, Box<dyn std::error::Error + Send + Sync>> {
        if returns.len() < 20 {
            return Ok(0.0);
        }

        let window_size = 20;
        let mut rolling_volatilities = Vec::new();
        
        for i in window_size..returns.len() {
            let window_returns = &returns[i - window_size..i];
            let vol = self.calculate_realized_volatility(window_returns).await?;
            rolling_volatilities.push(vol);
        }
        
        self.calculate_realized_volatility(&rolling_volatilities).await
    }

    async fn calculate_volatility_skew(
        &self,
        returns: &[f64],
    ) -> Result<f64, Box<dyn std::error::Error + Send + Sync>> {
        if returns.len() < 3 {
            return Ok(0.0);
        }

        let mean = returns.iter().sum::<f64>() / returns.len() as f64;
        let std_dev = self.calculate_realized_volatility(returns).await?;
        
        if std_dev == 0.0 {
            return Ok(0.0);
        }
        
        let skewness = returns.iter()
            .map(|r| ((r - mean) / std_dev).powi(3))
            .sum::<f64>() / returns.len() as f64;
            
        Ok(skewness)
    }

    async fn calculate_garch_volatility(
        &self,
        returns: &[f64],
    ) -> Result<f64, Box<dyn std::error::Error + Send + Sync>> {
        // Simplified GARCH(1,1) approximation
        if returns.is_empty() {
            return Ok(0.0);
        }
        
        let realized_vol = self.calculate_realized_volatility(returns).await?;
        // GARCH typically produces slightly higher volatility estimates
        Ok(realized_vol * 1.1)
    }

    async fn calculate_ewma_volatility(
        &self,
        returns: &[f64],
    ) -> Result<f64, Box<dyn std::error::Error + Send + Sync>> {
        if returns.is_empty() {
            return Ok(0.0);
        }

        let lambda = 0.94; // RiskMetrics lambda
        let mut ewma_var = returns[0].powi(2);
        
        for ret in &returns[1..] {
            ewma_var = lambda * ewma_var + (1.0 - lambda) * ret.powi(2);
        }
        
        Ok(ewma_var.sqrt())
    }

    async fn calculate_parkinson_volatility(
        &self,
        _portfolio_id: &str,
    ) -> Result<f64, Box<dyn std::error::Error + Send + Sync>> {
        // Simplified - would need high/low price data
        Ok(0.0)
    }

    async fn calculate_garman_klass_volatility(
        &self,
        _portfolio_id: &str,
    ) -> Result<f64, Box<dyn std::error::Error + Send + Sync>> {
        // Simplified - would need OHLC data
        Ok(0.0)
    }

    async fn calculate_downside_deviation(
        &self,
        returns: &[f64],
    ) -> Result<f64, Box<dyn std::error::Error + Send + Sync>> {
        if returns.is_empty() {
            return Ok(0.0);
        }

        let target_return = 0.0; // Use zero as target
        let downside_returns: Vec<f64> = returns.iter()
            .filter(|&&r| r < target_return)
            .map(|r| (r - target_return).powi(2))
            .collect();
            
        if downside_returns.is_empty() {
            Ok(0.0)
        } else {
            let mean_downside = downside_returns.iter().sum::<f64>() / downside_returns.len() as f64;
            Ok(mean_downside.sqrt())
        }
    }

    async fn calculate_semi_variance(
        &self,
        returns: &[f64],
    ) -> Result<f64, Box<dyn std::error::Error + Send + Sync>> {
        let downside_deviation = self.calculate_downside_deviation(returns).await?;
        Ok(downside_deviation.powi(2))
    }

    async fn calculate_downside_beta(
        &self,
        portfolio_id: &str,
    ) -> Result<f64, Box<dyn std::error::Error + Send + Sync>> {
        let portfolio_returns = self.get_portfolio_returns(portfolio_id).await?;
        let benchmark_returns = self.benchmark_returns.read().await;
        
        if portfolio_returns.len() != benchmark_returns.len() || portfolio_returns.is_empty() {
            return Ok(0.0);
        }

        // Filter for negative benchmark returns only
        let downside_pairs: Vec<(f64, f64)> = portfolio_returns.iter()
            .zip(benchmark_returns.iter())
            .filter(|(_, &b)| b < 0.0)
            .map(|(&p, &b)| (p, b))
            .collect();
            
        if downside_pairs.len() < 2 {
            return Ok(0.0);
        }

        let bench_mean = downside_pairs.iter().map(|(_, b)| b).sum::<f64>() / downside_pairs.len() as f64;
        let port_mean = downside_pairs.iter().map(|(p, _)| p).sum::<f64>() / downside_pairs.len() as f64;
        
        let covariance = downside_pairs.iter()
            .map(|(p, b)| (p - port_mean) * (b - bench_mean))
            .sum::<f64>() / downside_pairs.len() as f64;
            
        let bench_variance = downside_pairs.iter()
            .map(|(_, b)| (b - bench_mean).powi(2))
            .sum::<f64>() / downside_pairs.len() as f64;
            
        if bench_variance == 0.0 {
            Ok(0.0)
        } else {
            Ok(covariance / bench_variance)
        }
    }

    async fn calculate_pain_index(
        &self,
        returns: &[f64],
    ) -> Result<f64, Box<dyn std::error::Error + Send + Sync>> {
        if returns.is_empty() {
            return Ok(0.0);
        }

        let mut cumulative_returns = vec![1.0];
        for ret in returns {
            let last_value = cumulative_returns.last().unwrap();
            cumulative_returns.push(last_value * (1.0 + ret));
        }

        let mut peak = cumulative_returns[0];
        let mut drawdown_sum = 0.0;

        for value in &cumulative_returns[1..] {
            if *value > peak {
                peak = *value;
            }
            let drawdown = (peak - value) / peak;
            drawdown_sum += drawdown;
        }

        Ok(drawdown_sum / cumulative_returns.len() as f64)
    }

    async fn calculate_ulcer_index(
        &self,
        returns: &[f64],
    ) -> Result<f64, Box<dyn std::error::Error + Send + Sync>> {
        if returns.is_empty() {
            return Ok(0.0);
        }

        let mut cumulative_returns = vec![1.0];
        for ret in returns {
            let last_value = cumulative_returns.last().unwrap();
            cumulative_returns.push(last_value * (1.0 + ret));
        }

        let mut peak = cumulative_returns[0];
        let mut squared_drawdowns = Vec::new();

        for value in &cumulative_returns[1..] {
            if *value > peak {
                peak = *value;
            }
            let drawdown = (peak - value) / peak;
            squared_drawdowns.push(drawdown.powi(2));
        }

        let mean_squared_drawdown = squared_drawdowns.iter().sum::<f64>() / squared_drawdowns.len() as f64;
        Ok(mean_squared_drawdown.sqrt())
    }

    async fn calculate_sterling_ratio(
        &self,
        portfolio_id: &str,
    ) -> Result<f64, Box<dyn std::error::Error + Send + Sync>> {
        let returns = self.get_portfolio_returns(portfolio_id).await?;
        if returns.is_empty() {
            return Ok(0.0);
        }

        let mean_return = returns.iter().sum::<f64>() / returns.len() as f64;
        let annualized_return = mean_return * 252.0;
        let max_drawdown = self.calculate_maximum_drawdown(portfolio_id).await?;
        
        if max_drawdown == 0.0 {
            Ok(0.0)
        } else {
            Ok((annualized_return - self.risk_free_rate) / max_drawdown)
        }
    }

    async fn calculate_burke_ratio(
        &self,
        portfolio_id: &str,
    ) -> Result<f64, Box<dyn std::error::Error + Send + Sync>> {
        let returns = self.get_portfolio_returns(portfolio_id).await?;
        if returns.is_empty() {
            return Ok(0.0);
        }

        let mean_return = returns.iter().sum::<f64>() / returns.len() as f64;
        let annualized_return = mean_return * 252.0;
        let ulcer_index = self.calculate_ulcer_index(&returns).await?;
        
        if ulcer_index == 0.0 {
            Ok(0.0)
        } else {
            Ok((annualized_return - self.risk_free_rate) / ulcer_index)
        }
    }

    async fn calculate_expected_shortfall(
        &self,
        returns: &[f64],
        confidence_level: f64,
    ) -> Result<f64, Box<dyn std::error::Error + Send + Sync>> {
        if returns.is_empty() {
            return Ok(0.0);
        }

        let mut sorted_returns = returns.to_vec();
        sorted_returns.sort_by(|a, b| a.partial_cmp(b).unwrap());
        
        let cutoff_index = ((1.0 - confidence_level) * returns.len() as f64) as usize;
        if cutoff_index == 0 {
            return Ok(sorted_returns[0]);
        }
        
        let tail_returns = &sorted_returns[..cutoff_index];
        let expected_shortfall = tail_returns.iter().sum::<f64>() / tail_returns.len() as f64;
        
        Ok(-expected_shortfall) // Return as positive loss
    }

    async fn calculate_tail_expectation(
        &self,
        returns: &[f64],
    ) -> Result<f64, Box<dyn std::error::Error + Send + Sync>> {
        self.calculate_expected_shortfall(returns, 0.95).await
    }

    async fn calculate_extreme_value_index(
        &self,
        returns: &[f64],
    ) -> Result<f64, Box<dyn std::error::Error + Send + Sync>> {
        // Simplified extreme value index calculation
        if returns.len() < 10 {
            return Ok(0.0);
        }

        let mut sorted_returns = returns.to_vec();
        sorted_returns.sort_by(|a, b| a.partial_cmp(b).unwrap());
        
        // Take bottom 10% as extreme values
        let extreme_count = (returns.len() as f64 * 0.1) as usize;
        let extreme_returns = &sorted_returns[..extreme_count.max(1)];
        
        let mean_extreme = extreme_returns.iter().sum::<f64>() / extreme_returns.len() as f64;
        Ok(-mean_extreme) // Return as positive value
    }

    async fn calculate_hill_estimator(
        &self,
        returns: &[f64],
    ) -> Result<f64, Box<dyn std::error::Error + Send + Sync>> {
        // Simplified Hill estimator for tail index
        if returns.len() < 20 {
            return Ok(0.0);
        }

        let mut abs_returns: Vec<f64> = returns.iter().map(|r| r.abs()).collect();
        abs_returns.sort_by(|a, b| b.partial_cmp(a).unwrap()); // Descending order
        
        let k = (returns.len() as f64 * 0.1) as usize; // Use top 10%
        if k < 2 {
            return Ok(0.0);
        }
        
        let log_sum: f64 = abs_returns[..k].iter()
            .map(|r| (r / abs_returns[k]).ln())
            .sum();
            
        Ok(log_sum / k as f64)
    }

    async fn calculate_peaks_over_threshold(
        &self,
        returns: &[f64],
    ) -> Result<f64, Box<dyn std::error::Error + Send + Sync>> {
        if returns.is_empty() {
            return Ok(0.0);
        }

        // Use 95th percentile as threshold
        let mut sorted_returns = returns.to_vec();
        sorted_returns.sort_by(|a, b| a.partial_cmp(b).unwrap());
        
        let threshold_index = (returns.len() as f64 * 0.05) as usize;
        let threshold = sorted_returns[threshold_index];
        
        let exceedances: Vec<f64> = returns.iter()
            .filter(|&&r| r < threshold)
            .map(|r| threshold - r)
            .collect();
            
        if exceedances.is_empty() {
            Ok(0.0)
        } else {
            Ok(exceedances.iter().sum::<f64>() / exceedances.len() as f64)
        }
    }

    pub async fn set_benchmark_returns(
        &self,
        returns: Vec<f64>,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let mut benchmark_returns = self.benchmark_returns.write().await;
        *benchmark_returns = returns;
        Ok(())
    }

    pub async fn set_risk_free_rate(&mut self, rate: f64) {
        self.risk_free_rate = rate;
    }
}

// Test implementations

#[tokio::test]
async fn test_basic_risk_metrics_calculation() {
    let config = CorrelationAnalysisConfig::default();
    let calculator = MockRiskMetricsCalculator::new(config);

    let portfolio = vec![
        PortfolioPosition {
            asset_symbol: "BTC".to_string(),
            quantity: 1.0,
            value_usd: 50000.0,
            allocation_percentage: 50.0,
            volatility: 0.6,
            beta: 1.2,
            risk_score: 0.7,
            asset_type: AssetType::Cryptocurrency,
        },
        PortfolioPosition {
            asset_symbol: "ETH".to_string(),
            quantity: 16.67,
            value_usd: 50000.0,
            allocation_percentage: 50.0,
            volatility: 0.7,
            beta: 1.5,
            risk_score: 0.8,
            asset_type: AssetType::Cryptocurrency,
        },
    ];

    let correlation_matrix = CorrelationMatrix {
        assets: vec!["BTC".to_string(), "ETH".to_string()],
        matrix: vec![
            vec![1.0, 0.8],
            vec![0.8, 1.0],
        ],
        timestamp: Utc::now(),
        time_window_days: 90,
        confidence_level: 0.95,
    };

    // Generate synthetic returns (normal distribution)
    let returns: Vec<f64> = (0..100).map(|i| {
        0.001 + 0.02 * ((i as f64 * 0.1).sin()) // Mean return with volatility
    }).collect();

    calculator.add_portfolio("test", portfolio).await.unwrap();
    calculator.add_correlation_matrix("test", correlation_matrix).await.unwrap();
    calculator.add_price_returns("test", returns).await.unwrap();

    let metrics = calculator.calculate_risk_metrics("test").await.unwrap();

    assert!(metrics.portfolio_volatility > 0.0);
    assert!(metrics.var_95 > 0.0);
    assert!(metrics.var_99 > metrics.var_95); // VaR_99 should be higher
    assert!(metrics.var_995 > metrics.var_99); // VaR_99.5 should be highest
    assert!(metrics.cvar_95 > metrics.var_95); // CVaR should be higher than VaR
    assert!(metrics.portfolio_beta > 0.0);
    assert!(metrics.maximum_drawdown >= 0.0);
}

#[tokio::test]
async fn test_var_confidence_levels() {
    let config = CorrelationAnalysisConfig::default();
    let calculator = MockRiskMetricsCalculator::new(config);

    let portfolio = vec![
        PortfolioPosition {
            asset_symbol: "BTC".to_string(),
            quantity: 2.0,
            value_usd: 100000.0,
            allocation_percentage: 100.0,
            volatility: 0.4,
            beta: 1.0,
            risk_score: 0.7,
            asset_type: AssetType::Cryptocurrency,
        },
    ];

    calculator.add_portfolio("var_test", portfolio).await.unwrap();

    let var_95 = calculator.calculate_var_single_level("var_test", 0.95).await.unwrap();
    let var_99 = calculator.calculate_var_single_level("var_test", 0.99).await.unwrap();
    let var_995 = calculator.calculate_var_single_level("var_test", 0.995).await.unwrap();

    // Higher confidence levels should give higher VaR values
    assert!(var_99 > var_95);
    assert!(var_995 > var_99);
    
    // VaR should be proportional to portfolio value and volatility
    assert!(var_95 > 0.0);
    assert!(var_95 < 100000.0); // Should be less than total portfolio value
}

#[tokio::test]
async fn test_component_risk_analysis() {
    let config = CorrelationAnalysisConfig::default();
    let calculator = MockRiskMetricsCalculator::new(config);

    let portfolio = vec![
        PortfolioPosition {
            asset_symbol: "BTC".to_string(),
            quantity: 1.0,
            value_usd: 60000.0,
            allocation_percentage: 60.0,
            volatility: 0.5,
            beta: 1.0,
            risk_score: 0.7,
            asset_type: AssetType::Cryptocurrency,
        },
        PortfolioPosition {
            asset_symbol: "ETH".to_string(),
            quantity: 13.33,
            value_usd: 40000.0,
            allocation_percentage: 40.0,
            volatility: 0.6,
            beta: 1.2,
            risk_score: 0.8,
            asset_type: AssetType::Cryptocurrency,
        },
    ];

    let correlation_matrix = CorrelationMatrix {
        assets: vec!["BTC".to_string(), "ETH".to_string()],
        matrix: vec![
            vec![1.0, 0.7],
            vec![0.7, 1.0],
        ],
        timestamp: Utc::now(),
        time_window_days: 90,
        confidence_level: 0.95,
    };

    calculator.add_portfolio("component_test", portfolio).await.unwrap();
    calculator.add_correlation_matrix("component_test", correlation_matrix).await.unwrap();

    let analysis = calculator.calculate_component_risk_analysis("component_test").await.unwrap();

    assert!(analysis.individual_var.contains_key("BTC"));
    assert!(analysis.individual_var.contains_key("ETH"));
    assert!(analysis.marginal_var.contains_key("BTC"));
    assert!(analysis.marginal_var.contains_key("ETH"));
    assert!(analysis.component_var.contains_key("BTC"));
    assert!(analysis.component_var.contains_key("ETH"));
    assert!(analysis.risk_contributions.contains_key("BTC"));
    assert!(analysis.risk_contributions.contains_key("ETH"));

    // Risk contributions should sum to approximately 100%
    let total_risk_contribution: f64 = analysis.risk_contributions.values().sum();
    assert!((total_risk_contribution - 100.0).abs() < 1.0);

    // BTC should have higher risk contribution due to larger allocation
    assert!(analysis.risk_contributions["BTC"] > analysis.risk_contributions["ETH"]);
    
    assert!(analysis.diversification_ratio >= 1.0); // Should be >= 1
    assert!(analysis.concentration_index > 0.0);
}

#[tokio::test]
async fn test_sharpe_ratio_calculation() {
    let config = CorrelationAnalysisConfig::default();
    let mut calculator = MockRiskMetricsCalculator::new(config);
    calculator.set_risk_free_rate(0.02).await; // 2% risk-free rate

    let portfolio = vec![
        PortfolioPosition {
            asset_symbol: "BTC".to_string(),
            quantity: 1.0,
            value_usd: 50000.0,
            allocation_percentage: 100.0,
            volatility: 0.4,
            beta: 1.0,
            risk_score: 0.7,
            asset_type: AssetType::Cryptocurrency,
        },
    ];

    // Generate returns with positive mean (should give positive Sharpe ratio)
    let positive_returns: Vec<f64> = (0..252).map(|i| {
        0.0005 + 0.02 * ((i as f64 * 0.1).sin()) // ~12.6% annual return
    }).collect();

    calculator.add_portfolio("sharpe_test", portfolio).await.unwrap();
    calculator.add_price_returns("sharpe_test", positive_returns).await.unwrap();

    let sharpe_ratio = calculator.calculate_sharpe_ratio("sharpe_test").await.unwrap();
    
    assert!(sharpe_ratio > 0.0); // Should be positive with positive excess returns
    assert!(sharpe_ratio < 10.0); // Should be reasonable
}

#[tokio::test]
async fn test_maximum_drawdown_calculation() {
    let config = CorrelationAnalysisConfig::default();
    let calculator = MockRiskMetricsCalculator::new(config);

    let portfolio = vec![
        PortfolioPosition {
            asset_symbol: "TEST".to_string(),
            quantity: 1.0,
            value_usd: 100000.0,
            allocation_percentage: 100.0,
            volatility: 0.3,
            beta: 1.0,
            risk_score: 0.5,
            asset_type: AssetType::Token,
        },
    ];

    // Create returns with a clear drawdown pattern
    let mut returns = vec![0.1; 10]; // +10% for 10 periods
    returns.extend(vec![-0.05; 20]); // -5% for 20 periods (total ~60% drop)
    returns.extend(vec![0.02; 30]); // +2% recovery for 30 periods

    calculator.add_portfolio("drawdown_test", portfolio).await.unwrap();
    calculator.add_price_returns("drawdown_test", returns).await.unwrap();

    let max_drawdown = calculator.calculate_maximum_drawdown("drawdown_test").await.unwrap();
    
    assert!(max_drawdown > 0.0);
    assert!(max_drawdown < 1.0); // Should be less than 100%
    assert!(max_drawdown > 0.5); // Should capture the significant drop
}

#[tokio::test]
async fn test_portfolio_beta_calculation() {
    let config = CorrelationAnalysisConfig::default();
    let calculator = MockRiskMetricsCalculator::new(config);

    let portfolio = vec![
        PortfolioPosition {
            asset_symbol: "HIGH_BETA".to_string(),
            quantity: 1.0,
            value_usd: 30000.0,
            allocation_percentage: 30.0,
            volatility: 0.5,
            beta: 2.0,
            risk_score: 0.8,
            asset_type: AssetType::Token,
        },
        PortfolioPosition {
            asset_symbol: "LOW_BETA".to_string(),
            quantity: 1.0,
            value_usd: 70000.0,
            allocation_percentage: 70.0,
            volatility: 0.2,
            beta: 0.5,
            risk_score: 0.3,
            asset_type: AssetType::Token,
        },
    ];

    calculator.add_portfolio("beta_test", portfolio).await.unwrap();
    
    let portfolio_beta = calculator.calculate_portfolio_beta("beta_test").await.unwrap();
    
    // Portfolio beta should be weighted average: 0.3 * 2.0 + 0.7 * 0.5 = 0.95
    assert!((portfolio_beta - 0.95).abs() < 0.01);
}

#[tokio::test]
async fn test_volatility_metrics() {
    let config = CorrelationAnalysisConfig::default();
    let calculator = MockRiskMetricsCalculator::new(config);

    let portfolio = vec![
        PortfolioPosition {
            asset_symbol: "VOLATILE".to_string(),
            quantity: 1.0,
            value_usd: 50000.0,
            allocation_percentage: 100.0,
            volatility: 0.4,
            beta: 1.0,
            risk_score: 0.7,
            asset_type: AssetType::Cryptocurrency,
        },
    ];

    // Generate returns with varying volatility
    let mut returns = Vec::new();
    for i in 0..100 {
        let base_return = 0.001;
        let volatility_factor = if i < 50 { 0.01 } else { 0.03 }; // Volatility regime change
        let return_val = base_return + volatility_factor * ((i as f64 * 0.2).sin());
        returns.push(return_val);
    }

    calculator.add_portfolio("vol_test", portfolio).await.unwrap();
    calculator.add_price_returns("vol_test", returns).await.unwrap();

    let vol_metrics = calculator.calculate_volatility_metrics("vol_test").await.unwrap();

    assert!(vol_metrics.realized_volatility > 0.0);
    assert!(vol_metrics.volatility_of_volatility >= 0.0);
    assert!(vol_metrics.garch_volatility > vol_metrics.realized_volatility); // GARCH typically higher
    assert!(vol_metrics.ewma_volatility > 0.0);
}

#[tokio::test]
async fn test_downside_risk_metrics() {
    let config = CorrelationAnalysisConfig::default();
    let calculator = MockRiskMetricsCalculator::new(config);

    let portfolio = vec![
        PortfolioPosition {
            asset_symbol: "RISKY".to_string(),
            quantity: 1.0,
            value_usd: 100000.0,
            allocation_percentage: 100.0,
            volatility: 0.5,
            beta: 1.2,
            risk_score: 0.8,
            asset_type: AssetType::Token,
        },
    ];

    // Generate returns with more negative returns than positive (negative skew)
    let mut returns = Vec::new();
    for i in 0..100 {
        let return_val = if i % 3 == 0 {
            -0.05 // Negative return
        } else {
            0.02 // Small positive return
        };
        returns.push(return_val);
    }

    calculator.add_portfolio("downside_test", portfolio).await.unwrap();
    calculator.add_price_returns("downside_test", returns).await.unwrap();

    let downside_metrics = calculator.calculate_downside_risk_metrics("downside_test").await.unwrap();

    assert!(downside_metrics.downside_deviation > 0.0);
    assert!(downside_metrics.semi_variance > 0.0);
    assert!(downside_metrics.pain_index >= 0.0);
    assert!(downside_metrics.ulcer_index >= 0.0);
    
    // Semi-variance should be square of downside deviation
    assert!((downside_metrics.semi_variance - downside_metrics.downside_deviation.powi(2)).abs() < 1e-10);
}

#[tokio::test]
async fn test_extreme_risk_metrics() {
    let config = CorrelationAnalysisConfig::default();
    let calculator = MockRiskMetricsCalculator::new(config);

    let portfolio = vec![
        PortfolioPosition {
            asset_symbol: "EXTREME".to_string(),
            quantity: 1.0,
            value_usd: 50000.0,
            allocation_percentage: 100.0,
            volatility: 0.6,
            beta: 1.0,
            risk_score: 0.9,
            asset_type: AssetType::Token,
        },
    ];

    // Generate returns with some extreme negative values
    let mut returns: Vec<f64> = (0..90).map(|_| 0.01).collect(); // Mostly small positive
    returns.extend(vec![-0.1, -0.15, -0.2, -0.25, -0.3]); // Some extreme negatives
    returns.extend(vec![0.005; 5]); // Recovery

    calculator.add_portfolio("extreme_test", portfolio).await.unwrap();
    calculator.add_price_returns("extreme_test", returns).await.unwrap();

    let extreme_metrics = calculator.calculate_extreme_risk_metrics("extreme_test").await.unwrap();

    assert!(extreme_metrics.expected_shortfall_95 > 0.0);
    assert!(extreme_metrics.expected_shortfall_99 > extreme_metrics.expected_shortfall_95);
    assert!(extreme_metrics.tail_expectation > 0.0);
    assert!(extreme_metrics.extreme_value_index >= 0.0);
    assert!(extreme_metrics.peaks_over_threshold >= 0.0);
}

#[tokio::test]
async fn test_tracking_error_and_information_ratio() {
    let config = CorrelationAnalysisConfig::default();
    let calculator = MockRiskMetricsCalculator::new(config);

    let portfolio = vec![
        PortfolioPosition {
            asset_symbol: "ACTIVE".to_string(),
            quantity: 1.0,
            value_usd: 100000.0,
            allocation_percentage: 100.0,
            volatility: 0.3,
            beta: 1.1,
            risk_score: 0.6,
            asset_type: AssetType::Token,
        },
    ];

    // Portfolio returns that deviate from benchmark
    let portfolio_returns: Vec<f64> = (0..252).map(|i| {
        0.0008 + 0.01 * ((i as f64 * 0.1).sin()) // Slightly different pattern
    }).collect();

    // Benchmark returns
    let benchmark_returns: Vec<f64> = (0..252).map(|i| {
        0.0006 + 0.008 * ((i as f64 * 0.1).sin()) // Similar but different
    }).collect();

    calculator.add_portfolio("tracking_test", portfolio).await.unwrap();
    calculator.add_price_returns("tracking_test", portfolio_returns).await.unwrap();
    calculator.set_benchmark_returns(benchmark_returns).await.unwrap();

    let tracking_error = calculator.calculate_tracking_error("tracking_test").await.unwrap();
    let information_ratio = calculator.calculate_information_ratio("tracking_test").await.unwrap();

    assert!(tracking_error > 0.0); // Should have tracking error due to different patterns
    assert!(tracking_error < 1.0); // Should be reasonable
    assert!(information_ratio.abs() < 10.0); // Should be reasonable ratio
}

#[tokio::test]
async fn test_diversification_ratio() {
    let config = CorrelationAnalysisConfig::default();
    let calculator = MockRiskMetricsCalculator::new(config);

    // Portfolio with different volatilities
    let portfolio = vec![
        PortfolioPosition {
            asset_symbol: "LOW_VOL".to_string(),
            quantity: 1.0,
            value_usd: 50000.0,
            allocation_percentage: 50.0,
            volatility: 0.2,
            beta: 0.8,
            risk_score: 0.4,
            asset_type: AssetType::Stablecoin,
        },
        PortfolioPosition {
            asset_symbol: "HIGH_VOL".to_string(),
            quantity: 1.0,
            value_usd: 50000.0,
            allocation_percentage: 50.0,
            volatility: 0.6,
            beta: 1.5,
            risk_score: 0.9,
            asset_type: AssetType::Cryptocurrency,
        },
    ];

    // Low correlation matrix (good diversification)
    let correlation_matrix = CorrelationMatrix {
        assets: vec!["LOW_VOL".to_string(), "HIGH_VOL".to_string()],
        matrix: vec![
            vec![1.0, 0.2], // Low correlation
            vec![0.2, 1.0],
        ],
        timestamp: Utc::now(),
        time_window_days: 90,
        confidence_level: 0.95,
    };

    calculator.add_portfolio("diversification_test", portfolio).await.unwrap();
    calculator.add_correlation_matrix("diversification_test", correlation_matrix).await.unwrap();

    let analysis = calculator.calculate_component_risk_analysis("diversification_test").await.unwrap();

    // Diversification ratio should be > 1 with good diversification
    assert!(analysis.diversification_ratio >= 1.0);
    // With low correlation, should get good diversification benefits
    assert!(analysis.diversification_ratio > 1.1);
}

#[tokio::test]
async fn test_empty_returns_handling() {
    let config = CorrelationAnalysisConfig::default();
    let calculator = MockRiskMetricsCalculator::new(config);

    let portfolio = vec![
        PortfolioPosition {
            asset_symbol: "EMPTY".to_string(),
            quantity: 1.0,
            value_usd: 50000.0,
            allocation_percentage: 100.0,
            volatility: 0.3,
            beta: 1.0,
            risk_score: 0.5,
            asset_type: AssetType::Token,
        },
    ];

    calculator.add_portfolio("empty_test", portfolio).await.unwrap();
    // No returns added

    let sharpe_ratio = calculator.calculate_sharpe_ratio("empty_test").await.unwrap();
    let max_drawdown = calculator.calculate_maximum_drawdown("empty_test").await.unwrap();
    
    assert_eq!(sharpe_ratio, 0.0);
    assert_eq!(max_drawdown, 0.0);
}

#[tokio::test]
async fn test_risk_metrics_performance() {
    let config = CorrelationAnalysisConfig::default();
    let calculator = MockRiskMetricsCalculator::new(config);

    // Large portfolio with 20 assets
    let mut portfolio = Vec::new();
    for i in 0..20 {
        portfolio.push(PortfolioPosition {
            asset_symbol: format!("ASSET{}", i),
            quantity: 1.0,
            value_usd: 5000.0,
            allocation_percentage: 5.0,
            volatility: 0.3 + (i as f64 * 0.01),
            beta: 0.8 + (i as f64 * 0.02),
            risk_score: 0.5 + (i as f64 * 0.02),
            asset_type: AssetType::Token,
        });
    }

    // Generate returns for 252 trading days
    let returns: Vec<f64> = (0..252).map(|i| {
        0.0005 + 0.015 * ((i as f64 * 0.1).sin())
    }).collect();

    calculator.add_portfolio("large_test", portfolio).await.unwrap();
    calculator.add_price_returns("large_test", returns).await.unwrap();

    let start_time = std::time::Instant::now();
    let metrics = calculator.calculate_risk_metrics("large_test").await.unwrap();
    let calculation_time = start_time.elapsed();

    // Should complete within 150ms for large portfolio
    assert!(calculation_time.as_millis() < 150);
    assert!(metrics.portfolio_volatility > 0.0);
    assert!(metrics.var_95 > 0.0);
    assert!(metrics.portfolio_beta > 0.0);
}

#[tokio::test]
async fn test_correlation_impact_on_portfolio_volatility() {
    let config = CorrelationAnalysisConfig::default();
    let calculator = MockRiskMetricsCalculator::new(config);

    let portfolio = vec![
        PortfolioPosition {
            asset_symbol: "ASSET1".to_string(),
            quantity: 1.0,
            value_usd: 50000.0,
            allocation_percentage: 50.0,
            volatility: 0.4,
            beta: 1.0,
            risk_score: 0.7,
            asset_type: AssetType::Cryptocurrency,
        },
        PortfolioPosition {
            asset_symbol: "ASSET2".to_string(),
            quantity: 1.0,
            value_usd: 50000.0,
            allocation_percentage: 50.0,
            volatility: 0.4,
            beta: 1.0,
            risk_score: 0.7,
            asset_type: AssetType::Cryptocurrency,
        },
    ];

    // High correlation case
    let high_corr_matrix = CorrelationMatrix {
        assets: vec!["ASSET1".to_string(), "ASSET2".to_string()],
        matrix: vec![
            vec![1.0, 0.95],
            vec![0.95, 1.0],
        ],
        timestamp: Utc::now(),
        time_window_days: 90,
        confidence_level: 0.95,
    };

    // Low correlation case
    let low_corr_matrix = CorrelationMatrix {
        assets: vec!["ASSET1".to_string(), "ASSET2".to_string()],
        matrix: vec![
            vec![1.0, 0.1],
            vec![0.1, 1.0],
        ],
        timestamp: Utc::now(),
        time_window_days: 90,
        confidence_level: 0.95,
    };

    calculator.add_portfolio("high_corr", portfolio.clone()).await.unwrap();
    calculator.add_portfolio("low_corr", portfolio).await.unwrap();
    calculator.add_correlation_matrix("high_corr", high_corr_matrix).await.unwrap();
    calculator.add_correlation_matrix("low_corr", low_corr_matrix).await.unwrap();

    let high_corr_vol = calculator.calculate_portfolio_volatility("high_corr").await.unwrap();
    let low_corr_vol = calculator.calculate_portfolio_volatility("low_corr").await.unwrap();

    // High correlation should result in higher portfolio volatility
    assert!(high_corr_vol > low_corr_vol);
    
    // Low correlation should provide diversification benefits
    assert!(low_corr_vol < 0.4); // Should be less than individual asset volatility
    assert!(high_corr_vol > 0.35); // Should be closer to individual asset volatility
}

#[tokio::test]
async fn test_cvar_higher_than_var() {
    let config = CorrelationAnalysisConfig::default();
    let calculator = MockRiskMetricsCalculator::new(config);

    let portfolio = vec![
        PortfolioPosition {
            asset_symbol: "TEST".to_string(),
            quantity: 1.0,
            value_usd: 100000.0,
            allocation_percentage: 100.0,
            volatility: 0.3,
            beta: 1.0,
            risk_score: 0.6,
            asset_type: AssetType::Token,
        },
    ];

    calculator.add_portfolio("cvar_test", portfolio).await.unwrap();

    let var_95 = calculator.calculate_var_single_level("cvar_test", 0.95).await.unwrap();
    let cvar_95 = calculator.calculate_cvar_single_level("cvar_test", 0.95).await.unwrap();
    let var_99 = calculator.calculate_var_single_level("cvar_test", 0.99).await.unwrap();
    let cvar_99 = calculator.calculate_cvar_single_level("cvar_test", 0.99).await.unwrap();

    // CVaR should always be higher than VaR at the same confidence level
    assert!(cvar_95 > var_95);
    assert!(cvar_99 > var_99);
    
    // Higher confidence levels should give higher values
    assert!(var_99 > var_95);
    assert!(cvar_99 > cvar_95);
}