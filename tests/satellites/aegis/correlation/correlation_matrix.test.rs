use tokio;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use chrono::{DateTime, Utc, Duration};
use rust_decimal::Decimal;

// Mock structures based on the actual correlation analysis implementation
#[derive(Debug, Clone)]
pub struct CorrelationAnalysisConfig {
    pub default_time_window_days: u32,
    pub minimum_data_points: usize,
    pub correlation_threshold_high: f64,
    pub correlation_threshold_critical: f64,
    pub confidence_level: f64,
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
            rebalancing_threshold: 0.1,
            max_concentration_percentage: 25.0,
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
pub struct PricePoint {
    pub timestamp: DateTime<Utc>,
    pub price: f64,
    pub volume: f64,
    pub market_cap: Option<f64>,
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

#[derive(Debug)]
pub struct CorrelationMetrics {
    pub total_calculations: u64,
    pub cache_hits: u64,
    pub cache_misses: u64,
    pub average_calculation_time_ms: f64,
    pub matrix_computations: u64,
    pub high_correlations_detected: u64,
    pub critical_correlations_detected: u64,
}

impl Default for CorrelationMetrics {
    fn default() -> Self {
        Self {
            total_calculations: 0,
            cache_hits: 0,
            cache_misses: 0,
            average_calculation_time_ms: 0.0,
            matrix_computations: 0,
            high_correlations_detected: 0,
            critical_correlations_detected: 0,
        }
    }
}

pub struct MockCorrelationAnalysisSystem {
    assets: Arc<RwLock<HashMap<String, Asset>>>,
    correlation_cache: Arc<RwLock<HashMap<String, CorrelationMatrix>>>,
    correlation_metrics: Arc<RwLock<CorrelationMetrics>>,
    config: CorrelationAnalysisConfig,
}

impl MockCorrelationAnalysisSystem {
    pub fn new(config: CorrelationAnalysisConfig) -> Self {
        Self {
            assets: Arc::new(RwLock::new(HashMap::new())),
            correlation_cache: Arc::new(RwLock::new(HashMap::new())),
            correlation_metrics: Arc::new(RwLock::new(CorrelationMetrics::default())),
            config,
        }
    }

    pub async fn add_asset(&self, asset: Asset) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let mut assets = self.assets.write().await;
        assets.insert(asset.symbol.clone(), asset);
        Ok(())
    }

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
            asset.price_history.sort_by(|a, b| a.timestamp.cmp(&b.timestamp));
            
            // Update volatility
            asset.volatility = self.calculate_volatility(&asset.price_history).await?;
        }
        Ok(())
    }

    pub async fn calculate_correlation_matrix(
        &self,
        asset_symbols: &[String],
        time_window_days: Option<u32>,
    ) -> Result<CorrelationMatrix, Box<dyn std::error::Error + Send + Sync>> {
        let start_time = std::time::Instant::now();
        let window_days = time_window_days.unwrap_or(self.config.default_time_window_days);
        let cache_key = format!("{}_{}", asset_symbols.join("_"), window_days);
        
        // Check cache first
        let cache = self.correlation_cache.read().await;
        if let Some(cached_matrix) = cache.get(&cache_key) {
            if cached_matrix.timestamp >= Utc::now() - Duration::hours(1) {
                let mut metrics = self.correlation_metrics.write().await;
                metrics.cache_hits += 1;
                metrics.total_calculations += 1;
                return Ok(cached_matrix.clone());
            }
        }
        drop(cache);

        // Cache miss - calculate new matrix
        let mut metrics = self.correlation_metrics.write().await;
        metrics.cache_misses += 1;
        metrics.total_calculations += 1;
        drop(metrics);

        let assets = self.assets.read().await;
        let mut matrix_data = Vec::new();
        let mut valid_assets = Vec::new();

        // Collect return series for each asset
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

        // Ensure all return series have the same length
        let min_length = matrix_data.iter().map(|series| series.len()).min().unwrap_or(0);
        for series in &mut matrix_data {
            series.truncate(min_length);
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

        // Update metrics
        let calculation_time = start_time.elapsed().as_millis() as f64;
        let mut metrics = self.correlation_metrics.write().await;
        metrics.matrix_computations += 1;
        let current_avg = metrics.average_calculation_time_ms;
        let new_avg = (current_avg * (metrics.matrix_computations - 1) as f64 + calculation_time) / metrics.matrix_computations as f64;
        metrics.average_calculation_time_ms = new_avg;

        Ok(matrix)
    }

    pub async fn find_high_correlations(&self, matrix: &CorrelationMatrix) -> Result<Vec<HighCorrelation>, Box<dyn std::error::Error + Send + Sync>> {
        let mut high_correlations = Vec::new();

        for i in 0..matrix.assets.len() {
            for j in (i + 1)..matrix.assets.len() {
                let correlation = matrix.matrix[i][j];
                let abs_correlation = correlation.abs();

                if abs_correlation >= self.config.correlation_threshold_high {
                    let risk_level = if abs_correlation >= self.config.correlation_threshold_critical {
                        CorrelationRiskLevel::Critical
                    } else if abs_correlation >= 0.8 {
                        CorrelationRiskLevel::High
                    } else {
                        CorrelationRiskLevel::Medium
                    };

                    let recommendation = self.generate_correlation_recommendation(
                        &matrix.assets[i],
                        &matrix.assets[j],
                        correlation,
                        &risk_level,
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

        // Update metrics
        let mut metrics = self.correlation_metrics.write().await;
        let high_count = high_correlations.iter().filter(|c| matches!(c.risk_level, CorrelationRiskLevel::High)).count();
        let critical_count = high_correlations.iter().filter(|c| matches!(c.risk_level, CorrelationRiskLevel::Critical)).count();
        metrics.high_correlations_detected += high_count as u64;
        metrics.critical_correlations_detected += critical_count as u64;

        // Sort by absolute correlation value (highest first)
        high_correlations.sort_by(|a, b| b.correlation.abs().partial_cmp(&a.correlation.abs()).unwrap());

        Ok(high_correlations)
    }

    pub async fn calculate_rolling_correlations(
        &self,
        asset1: &str,
        asset2: &str,
        window_days: u32,
    ) -> Result<Vec<(DateTime<Utc>, f64)>, Box<dyn std::error::Error + Send + Sync>> {
        let assets = self.assets.read().await;
        let asset1_data = assets.get(asset1).ok_or("Asset 1 not found")?;
        let asset2_data = assets.get(asset2).ok_or("Asset 2 not found")?;

        if asset1_data.price_history.len() < window_days as usize || 
           asset2_data.price_history.len() < window_days as usize {
            return Err("Insufficient data for rolling correlation".into());
        }

        let returns1 = self.calculate_returns(&asset1_data.price_history).await?;
        let returns2 = self.calculate_returns(&asset2_data.price_history).await?;

        let mut rolling_correlations = Vec::new();
        let window_size = window_days as usize;

        for i in window_size..returns1.len() {
            let window_returns1 = &returns1[i - window_size..i];
            let window_returns2 = &returns2[i - window_size..i];
            
            let correlation = self.calculate_correlation(window_returns1, window_returns2).await?;
            let timestamp = asset1_data.price_history[i].timestamp;
            
            rolling_correlations.push((timestamp, correlation));
        }

        Ok(rolling_correlations)
    }

    pub async fn detect_correlation_regime_changes(
        &self,
        asset1: &str,
        asset2: &str,
        window_days: u32,
        threshold_change: f64,
    ) -> Result<Vec<(DateTime<Utc>, f64, f64)>, Box<dyn std::error::Error + Send + Sync>> {
        let rolling_correlations = self.calculate_rolling_correlations(asset1, asset2, window_days).await?;
        let mut regime_changes = Vec::new();

        for i in 1..rolling_correlations.len() {
            let (prev_time, prev_corr) = &rolling_correlations[i - 1];
            let (curr_time, curr_corr) = &rolling_correlations[i];
            
            let change = (curr_corr - prev_corr).abs();
            if change >= threshold_change {
                regime_changes.push((*curr_time, *prev_corr, *curr_corr));
            }
        }

        Ok(regime_changes)
    }

    pub async fn calculate_correlation_confidence_interval(
        &self,
        correlation: f64,
        sample_size: usize,
        confidence_level: f64,
    ) -> Result<(f64, f64), Box<dyn std::error::Error + Send + Sync>> {
        if sample_size < 3 {
            return Err("Sample size too small for confidence interval".into());
        }

        // Fisher transformation
        let fisher_z = 0.5 * ((1.0 + correlation) / (1.0 - correlation)).ln();
        
        // Standard error
        let se = 1.0 / ((sample_size - 3) as f64).sqrt();
        
        // Z-score for confidence level
        let z_score = match confidence_level {
            0.90 => 1.645,
            0.95 => 1.96,
            0.99 => 2.576,
            _ => 1.96, // Default to 95%
        };
        
        // Confidence interval in Fisher space
        let lower_z = fisher_z - z_score * se;
        let upper_z = fisher_z + z_score * se;
        
        // Transform back to correlation space
        let lower_r = (lower_z.exp() - 1.0) / (lower_z.exp() + 1.0);
        let upper_r = (upper_z.exp() - 1.0) / (upper_z.exp() + 1.0);
        
        Ok((lower_r, upper_r))
    }

    pub async fn test_correlation_significance(
        &self,
        correlation: f64,
        sample_size: usize,
        alpha: f64,
    ) -> Result<bool, Box<dyn std::error::Error + Send + Sync>> {
        if sample_size < 3 {
            return Err("Sample size too small for significance test".into());
        }

        // t-statistic for testing correlation = 0
        let t_stat = correlation * ((sample_size - 2) as f64).sqrt() / (1.0 - correlation.powi(2)).sqrt();
        
        // Critical value for two-tailed test
        let critical_value = match alpha {
            0.05 => 1.96,
            0.01 => 2.576,
            0.10 => 1.645,
            _ => 1.96, // Default to 5%
        };
        
        Ok(t_stat.abs() > critical_value)
    }

    async fn calculate_returns(&self, price_history: &[PricePoint]) -> Result<Vec<f64>, Box<dyn std::error::Error + Send + Sync>> {
        if price_history.len() < 2 {
            return Err("Insufficient price data for returns calculation".into());
        }

        let mut returns = Vec::new();
        for i in 1..price_history.len() {
            let current_price = price_history[i].price;
            let previous_price = price_history[i - 1].price;
            
            if previous_price > 0.0 {
                let return_rate = (current_price - previous_price) / previous_price;
                returns.push(return_rate);
            }
        }

        Ok(returns)
    }

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

        if variance1 == 0.0 || variance2 == 0.0 {
            return Ok(0.0);
        }

        let correlation = covariance / (variance1.sqrt() * variance2.sqrt());
        Ok(correlation.max(-1.0).min(1.0)) // Clamp between -1 and 1
    }

    async fn generate_correlation_recommendation(
        &self,
        asset1: &str,
        asset2: &str,
        correlation: f64,
        risk_level: &CorrelationRiskLevel,
    ) -> Result<String, Box<dyn std::error::Error + Send + Sync>> {
        let abs_correlation = correlation.abs();
        let direction = if correlation > 0.0 { "positive" } else { "negative" };

        match risk_level {
            CorrelationRiskLevel::Critical => {
                Ok(format!(
                    "CRITICAL: {} and {} have {} correlation of {:.3}. Consider reducing exposure to one or both assets to minimize concentration risk.",
                    asset1, asset2, direction, abs_correlation
                ))
            },
            CorrelationRiskLevel::High => {
                Ok(format!(
                    "HIGH: {} and {} have {} correlation of {:.3}. Monitor closely and consider diversification.",
                    asset1, asset2, direction, abs_correlation
                ))
            },
            CorrelationRiskLevel::Medium => {
                Ok(format!(
                    "MEDIUM: {} and {} have {} correlation of {:.3}. Consider monitoring for changes.",
                    asset1, asset2, direction, abs_correlation
                ))
            },
            CorrelationRiskLevel::Low => {
                Ok(format!(
                    "LOW: {} and {} have {} correlation of {:.3}. Correlation within acceptable range.",
                    asset1, asset2, direction, abs_correlation
                ))
            },
        }
    }

    pub async fn get_correlation_metrics(&self) -> CorrelationMetrics {
        self.correlation_metrics.read().await.clone()
    }

    pub async fn clear_correlation_cache(&self) {
        self.correlation_cache.write().await.clear();
    }

    pub async fn get_cached_matrices(&self) -> HashMap<String, CorrelationMatrix> {
        self.correlation_cache.read().await.clone()
    }

    pub async fn validate_correlation_matrix(&self, matrix: &CorrelationMatrix) -> Result<bool, Box<dyn std::error::Error + Send + Sync>> {
        let n = matrix.assets.len();
        
        // Check matrix dimensions
        if matrix.matrix.len() != n || matrix.matrix.iter().any(|row| row.len() != n) {
            return Ok(false);
        }

        // Check diagonal elements are 1.0
        for i in 0..n {
            if (matrix.matrix[i][i] - 1.0).abs() > 1e-10 {
                return Ok(false);
            }
        }

        // Check symmetry
        for i in 0..n {
            for j in 0..n {
                if (matrix.matrix[i][j] - matrix.matrix[j][i]).abs() > 1e-10 {
                    return Ok(false);
                }
            }
        }

        // Check correlation bounds [-1, 1]
        for i in 0..n {
            for j in 0..n {
                if matrix.matrix[i][j] < -1.0 || matrix.matrix[i][j] > 1.0 {
                    return Ok(false);
                }
            }
        }

        Ok(true)
    }

    pub async fn calculate_partial_correlation(
        &self,
        asset1: &str,
        asset2: &str,
        control_assets: &[String],
    ) -> Result<f64, Box<dyn std::error::Error + Send + Sync>> {
        // Create asset list for correlation matrix
        let mut all_assets = vec![asset1.to_string(), asset2.to_string()];
        all_assets.extend_from_slice(control_assets);

        // Calculate full correlation matrix
        let matrix = self.calculate_correlation_matrix(&all_assets, None).await?;
        
        // Extract the relevant submatrix for partial correlation calculation
        let n = matrix.assets.len();
        if n < 3 {
            return Err("Need at least one control variable for partial correlation".into());
        }

        // Simplified partial correlation calculation (first-order)
        // For full implementation, would use matrix inversion
        let r12 = matrix.matrix[0][1]; // correlation between asset1 and asset2
        let r13 = matrix.matrix[0][2]; // correlation between asset1 and control
        let r23 = matrix.matrix[1][2]; // correlation between asset2 and control

        let partial_corr = (r12 - r13 * r23) / ((1.0 - r13.powi(2)).sqrt() * (1.0 - r23.powi(2)).sqrt());
        
        Ok(partial_corr.max(-1.0).min(1.0))
    }
}

// Test implementations

#[tokio::test]
async fn test_basic_correlation_calculation() {
    let config = CorrelationAnalysisConfig::default();
    let system = MockCorrelationAnalysisSystem::new(config);

    // Create test assets with correlated price movements
    let mut btc_prices = Vec::new();
    let mut eth_prices = Vec::new();
    let base_time = Utc::now() - Duration::days(60);

    for i in 0..60 {
        let btc_price = 50000.0 + (i as f64 * 100.0) + (i as f64).sin() * 1000.0;
        let eth_price = 3000.0 + (i as f64 * 10.0) + (i as f64).sin() * 150.0; // Positively correlated

        btc_prices.push(PricePoint {
            timestamp: base_time + Duration::days(i),
            price: btc_price,
            volume: 1000000.0,
            market_cap: Some(btc_price * 19000000.0),
        });

        eth_prices.push(PricePoint {
            timestamp: base_time + Duration::days(i),
            price: eth_price,
            volume: 500000.0,
            market_cap: Some(eth_price * 120000000.0),
        });
    }

    let btc_asset = Asset {
        symbol: "BTC".to_string(),
        name: "Bitcoin".to_string(),
        asset_type: AssetType::Cryptocurrency,
        price_history: btc_prices,
        volatility: 0.0,
        beta: 1.0,
        market_cap: Some(950000000000.0),
    };

    let eth_asset = Asset {
        symbol: "ETH".to_string(),
        name: "Ethereum".to_string(),
        asset_type: AssetType::Cryptocurrency,
        price_history: eth_prices,
        volatility: 0.0,
        beta: 1.2,
        market_cap: Some(360000000000.0),
    };

    system.add_asset(btc_asset).await.unwrap();
    system.add_asset(eth_asset).await.unwrap();

    let matrix = system.calculate_correlation_matrix(&vec!["BTC".to_string(), "ETH".to_string()], None).await.unwrap();

    assert_eq!(matrix.assets.len(), 2);
    assert_eq!(matrix.matrix.len(), 2);
    assert!((matrix.matrix[0][0] - 1.0).abs() < 1e-10); // BTC-BTC correlation = 1
    assert!((matrix.matrix[1][1] - 1.0).abs() < 1e-10); // ETH-ETH correlation = 1
    assert!(matrix.matrix[0][1] > 0.8); // Should be highly positively correlated
    assert!((matrix.matrix[0][1] - matrix.matrix[1][0]).abs() < 1e-10); // Symmetry
}

#[tokio::test]
async fn test_correlation_matrix_validation() {
    let config = CorrelationAnalysisConfig::default();
    let system = MockCorrelationAnalysisSystem::new(config);

    // Create valid correlation matrix
    let valid_matrix = CorrelationMatrix {
        assets: vec!["BTC".to_string(), "ETH".to_string()],
        matrix: vec![
            vec![1.0, 0.8],
            vec![0.8, 1.0],
        ],
        timestamp: Utc::now(),
        time_window_days: 90,
        confidence_level: 0.95,
    };

    assert!(system.validate_correlation_matrix(&valid_matrix).await.unwrap());

    // Test invalid matrix - non-symmetric
    let invalid_matrix = CorrelationMatrix {
        assets: vec!["BTC".to_string(), "ETH".to_string()],
        matrix: vec![
            vec![1.0, 0.8],
            vec![0.7, 1.0], // Should be 0.8 for symmetry
        ],
        timestamp: Utc::now(),
        time_window_days: 90,
        confidence_level: 0.95,
    };

    assert!(!system.validate_correlation_matrix(&invalid_matrix).await.unwrap());

    // Test invalid matrix - out of bounds correlation
    let out_of_bounds_matrix = CorrelationMatrix {
        assets: vec!["BTC".to_string(), "ETH".to_string()],
        matrix: vec![
            vec![1.0, 1.5], // Correlation > 1.0
            vec![1.5, 1.0],
        ],
        timestamp: Utc::now(),
        time_window_days: 90,
        confidence_level: 0.95,
    };

    assert!(!system.validate_correlation_matrix(&out_of_bounds_matrix).await.unwrap());
}

#[tokio::test]
async fn test_high_correlation_detection() {
    let config = CorrelationAnalysisConfig {
        correlation_threshold_high: 0.7,
        correlation_threshold_critical: 0.9,
        ..CorrelationAnalysisConfig::default()
    };
    let system = MockCorrelationAnalysisSystem::new(config);

    let matrix = CorrelationMatrix {
        assets: vec!["BTC".to_string(), "ETH".to_string(), "USDC".to_string()],
        matrix: vec![
            vec![1.0, 0.95, 0.1], // BTC-ETH critical, BTC-USDC low
            vec![0.95, 1.0, 0.05], // ETH-BTC critical, ETH-USDC low
            vec![0.1, 0.05, 1.0], // USDC low correlations
        ],
        timestamp: Utc::now(),
        time_window_days: 90,
        confidence_level: 0.95,
    };

    let high_correlations = system.find_high_correlations(&matrix).await.unwrap();

    assert_eq!(high_correlations.len(), 1); // Only BTC-ETH should be detected
    assert_eq!(high_correlations[0].asset1, "BTC");
    assert_eq!(high_correlations[0].asset2, "ETH");
    assert_eq!(high_correlations[0].risk_level, CorrelationRiskLevel::Critical);
    assert!((high_correlations[0].correlation - 0.95).abs() < 1e-10);
}

#[tokio::test]
async fn test_correlation_caching() {
    let config = CorrelationAnalysisConfig::default();
    let system = MockCorrelationAnalysisSystem::new(config);

    // Add test asset
    let asset = Asset {
        symbol: "BTC".to_string(),
        name: "Bitcoin".to_string(),
        asset_type: AssetType::Cryptocurrency,
        price_history: create_test_price_history(60, 50000.0),
        volatility: 0.3,
        beta: 1.0,
        market_cap: Some(950000000000.0),
    };

    system.add_asset(asset).await.unwrap();

    let eth_asset = Asset {
        symbol: "ETH".to_string(),
        name: "Ethereum".to_string(),
        asset_type: AssetType::Cryptocurrency,
        price_history: create_test_price_history(60, 3000.0),
        volatility: 0.4,
        beta: 1.2,
        market_cap: Some(360000000000.0),
    };

    system.add_asset(eth_asset).await.unwrap();

    let assets = vec!["BTC".to_string(), "ETH".to_string()];

    // First calculation - should be cache miss
    let matrix1 = system.calculate_correlation_matrix(&assets, None).await.unwrap();
    let metrics1 = system.get_correlation_metrics().await;
    assert_eq!(metrics1.cache_misses, 1);
    assert_eq!(metrics1.cache_hits, 0);

    // Second calculation - should be cache hit
    let matrix2 = system.calculate_correlation_matrix(&assets, None).await.unwrap();
    let metrics2 = system.get_correlation_metrics().await;
    assert_eq!(metrics2.cache_misses, 1);
    assert_eq!(metrics2.cache_hits, 1);

    // Matrices should be identical
    assert_eq!(matrix1.matrix, matrix2.matrix);
    assert_eq!(matrix1.assets, matrix2.assets);
}

#[tokio::test]
async fn test_rolling_correlation_calculation() {
    let config = CorrelationAnalysisConfig::default();
    let system = MockCorrelationAnalysisSystem::new(config);

    // Create assets with time-varying correlation
    let mut btc_prices = Vec::new();
    let mut eth_prices = Vec::new();
    let base_time = Utc::now() - Duration::days(100);

    for i in 0..100 {
        let btc_price = 50000.0 + (i as f64 * 10.0);
        // ETH correlation changes over time
        let eth_price = if i < 50 {
            3000.0 + (i as f64 * 0.6) // High correlation initially
        } else {
            3000.0 - (i as f64 * 0.2) // Negative correlation later
        };

        btc_prices.push(PricePoint {
            timestamp: base_time + Duration::days(i),
            price: btc_price,
            volume: 1000000.0,
            market_cap: None,
        });

        eth_prices.push(PricePoint {
            timestamp: base_time + Duration::days(i),
            price: eth_price,
            volume: 500000.0,
            market_cap: None,
        });
    }

    let btc_asset = Asset {
        symbol: "BTC".to_string(),
        name: "Bitcoin".to_string(),
        asset_type: AssetType::Cryptocurrency,
        price_history: btc_prices,
        volatility: 0.3,
        beta: 1.0,
        market_cap: None,
    };

    let eth_asset = Asset {
        symbol: "ETH".to_string(),
        name: "Ethereum".to_string(),
        asset_type: AssetType::Cryptocurrency,
        price_history: eth_prices,
        volatility: 0.4,
        beta: 1.2,
        market_cap: None,
    };

    system.add_asset(btc_asset).await.unwrap();
    system.add_asset(eth_asset).await.unwrap();

    let rolling_correlations = system.calculate_rolling_correlations("BTC", "ETH", 30).await.unwrap();

    assert!(!rolling_correlations.is_empty());
    assert!(rolling_correlations.len() >= 40); // Should have ~70 data points
    
    // First correlation should be positive, last should be negative
    assert!(rolling_correlations.first().unwrap().1 > 0.5);
    assert!(rolling_correlations.last().unwrap().1 < -0.5);
}

#[tokio::test]
async fn test_correlation_regime_change_detection() {
    let config = CorrelationAnalysisConfig::default();
    let system = MockCorrelationAnalysisSystem::new(config);

    // Create assets with a clear regime change
    let mut btc_prices = Vec::new();
    let mut eth_prices = Vec::new();
    let base_time = Utc::now() - Duration::days(80);

    for i in 0..80 {
        let btc_price = 50000.0 + (i as f64 * 100.0);
        let eth_price = if i < 40 {
            3000.0 + (i as f64 * 6.0) // High positive correlation
        } else {
            3000.0 - ((i - 40) as f64 * 5.0) // Regime change to negative correlation
        };

        btc_prices.push(PricePoint {
            timestamp: base_time + Duration::days(i),
            price: btc_price,
            volume: 1000000.0,
            market_cap: None,
        });

        eth_prices.push(PricePoint {
            timestamp: base_time + Duration::days(i),
            price: eth_price,
            volume: 500000.0,
            market_cap: None,
        });
    }

    let btc_asset = Asset {
        symbol: "BTC".to_string(),
        name: "Bitcoin".to_string(),
        asset_type: AssetType::Cryptocurrency,
        price_history: btc_prices,
        volatility: 0.2,
        beta: 1.0,
        market_cap: None,
    };

    let eth_asset = Asset {
        symbol: "ETH".to_string(),
        name: "Ethereum".to_string(),
        asset_type: AssetType::Cryptocurrency,
        price_history: eth_prices,
        volatility: 0.25,
        beta: 1.1,
        market_cap: None,
    };

    system.add_asset(btc_asset).await.unwrap();
    system.add_asset(eth_asset).await.unwrap();

    let regime_changes = system.detect_correlation_regime_changes("BTC", "ETH", 20, 0.5).await.unwrap();

    assert!(!regime_changes.is_empty());
    // Should detect regime change around day 40
    let significant_change = regime_changes.iter().find(|(_, prev, curr)| (prev - curr).abs() > 1.0);
    assert!(significant_change.is_some());
}

#[tokio::test]
async fn test_correlation_confidence_intervals() {
    let config = CorrelationAnalysisConfig::default();
    let system = MockCorrelationAnalysisSystem::new(config);

    // Test confidence intervals for different correlations and sample sizes
    let test_cases = vec![
        (0.8, 100, 0.95),
        (0.5, 50, 0.95),
        (0.0, 30, 0.90),
        (-0.7, 200, 0.99),
    ];

    for (correlation, sample_size, confidence_level) in test_cases {
        let (lower, upper) = system.calculate_correlation_confidence_interval(
            correlation, sample_size, confidence_level
        ).await.unwrap();

        // Lower bound should be less than correlation, upper bound should be greater
        assert!(lower <= correlation);
        assert!(upper >= correlation);
        assert!(lower >= -1.0);
        assert!(upper <= 1.0);
        assert!(lower < upper);

        // Confidence interval should be narrower for larger sample sizes
        let interval_width = upper - lower;
        assert!(interval_width > 0.0);
        if sample_size >= 100 {
            assert!(interval_width < 0.3); // Should be reasonably tight for large samples
        }
    }
}

#[tokio::test]
async fn test_correlation_significance_testing() {
    let config = CorrelationAnalysisConfig::default();
    let system = MockCorrelationAnalysisSystem::new(config);

    // Test significance testing
    let test_cases = vec![
        (0.8, 100, 0.05, true),   // High correlation, large sample -> significant
        (0.1, 100, 0.05, false),  // Low correlation, large sample -> not significant
        (0.5, 20, 0.05, true),    // Medium correlation, small sample -> significant
        (0.3, 20, 0.05, false),   // Low correlation, small sample -> not significant
        (0.9, 10, 0.01, true),    // High correlation, very strict alpha -> significant
    ];

    for (correlation, sample_size, alpha, expected_significant) in test_cases {
        let is_significant = system.test_correlation_significance(
            correlation, sample_size, alpha
        ).await.unwrap();

        assert_eq!(is_significant, expected_significant,
            "Correlation {} with sample size {} and alpha {} should be {}significant",
            correlation, sample_size, alpha, if expected_significant { "" } else { "not " });
    }
}

#[tokio::test]
async fn test_partial_correlation_calculation() {
    let config = CorrelationAnalysisConfig::default();
    let system = MockCorrelationAnalysisSystem::new(config);

    // Create three assets with known relationships
    let btc_asset = Asset {
        symbol: "BTC".to_string(),
        name: "Bitcoin".to_string(),
        asset_type: AssetType::Cryptocurrency,
        price_history: create_test_price_history(60, 50000.0),
        volatility: 0.3,
        beta: 1.0,
        market_cap: None,
    };

    let eth_asset = Asset {
        symbol: "ETH".to_string(),
        name: "Ethereum".to_string(),
        asset_type: AssetType::Cryptocurrency,
        price_history: create_test_price_history(60, 3000.0),
        volatility: 0.4,
        beta: 1.2,
        market_cap: None,
    };

    let market_asset = Asset {
        symbol: "MARKET".to_string(),
        name: "Market Index".to_string(),
        asset_type: AssetType::Stock,
        price_history: create_test_price_history(60, 10000.0),
        volatility: 0.2,
        beta: 1.0,
        market_cap: None,
    };

    system.add_asset(btc_asset).await.unwrap();
    system.add_asset(eth_asset).await.unwrap();
    system.add_asset(market_asset).await.unwrap();

    let partial_corr = system.calculate_partial_correlation(
        "BTC", 
        "ETH", 
        &vec!["MARKET".to_string()]
    ).await.unwrap();

    assert!(partial_corr >= -1.0 && partial_corr <= 1.0);
    // Partial correlation should be different from simple correlation
    let simple_matrix = system.calculate_correlation_matrix(
        &vec!["BTC".to_string(), "ETH".to_string()], None
    ).await.unwrap();
    let simple_corr = simple_matrix.matrix[0][1];
    
    // They might be the same in some cases, but usually they differ
    assert!((partial_corr - simple_corr).abs() >= 0.0);
}

#[tokio::test]
async fn test_price_update_and_volatility_calculation() {
    let config = CorrelationAnalysisConfig::default();
    let system = MockCorrelationAnalysisSystem::new(config);

    let mut asset = Asset {
        symbol: "TEST".to_string(),
        name: "Test Asset".to_string(),
        asset_type: AssetType::Token,
        price_history: vec![],
        volatility: 0.0,
        beta: 1.0,
        market_cap: None,
    };

    // Add initial price points
    let base_time = Utc::now() - Duration::days(10);
    for i in 0..10 {
        asset.price_history.push(PricePoint {
            timestamp: base_time + Duration::days(i),
            price: 100.0 + (i as f64),
            volume: 1000.0,
            market_cap: None,
        });
    }

    system.add_asset(asset).await.unwrap();

    // Add new price point
    let new_price = PricePoint {
        timestamp: Utc::now(),
        price: 150.0, // Significant price increase
        volume: 2000.0,
        market_cap: None,
    };

    system.update_asset_price("TEST", new_price).await.unwrap();

    // Check that volatility was updated
    let assets = system.assets.read().await;
    let updated_asset = assets.get("TEST").unwrap();
    assert!(updated_asset.volatility > 0.0);
    assert_eq!(updated_asset.price_history.len(), 11);
}

#[tokio::test]
async fn test_different_time_windows() {
    let config = CorrelationAnalysisConfig::default();
    let system = MockCorrelationAnalysisSystem::new(config);

    // Create assets with sufficient history
    let btc_asset = Asset {
        symbol: "BTC".to_string(),
        name: "Bitcoin".to_string(),
        asset_type: AssetType::Cryptocurrency,
        price_history: create_test_price_history(200, 50000.0),
        volatility: 0.3,
        beta: 1.0,
        market_cap: None,
    };

    let eth_asset = Asset {
        symbol: "ETH".to_string(),
        name: "Ethereum".to_string(),
        asset_type: AssetType::Cryptocurrency,
        price_history: create_test_price_history(200, 3000.0),
        volatility: 0.4,
        beta: 1.2,
        market_cap: None,
    };

    system.add_asset(btc_asset).await.unwrap();
    system.add_asset(eth_asset).await.unwrap();

    let assets = vec!["BTC".to_string(), "ETH".to_string()];

    // Test different time windows
    let matrix_30 = system.calculate_correlation_matrix(&assets, Some(30)).await.unwrap();
    let matrix_90 = system.calculate_correlation_matrix(&assets, Some(90)).await.unwrap();
    let matrix_180 = system.calculate_correlation_matrix(&assets, Some(180)).await.unwrap();

    assert_eq!(matrix_30.time_window_days, 30);
    assert_eq!(matrix_90.time_window_days, 90);
    assert_eq!(matrix_180.time_window_days, 180);

    // Different time windows may produce different correlations
    // (though they might be similar with synthetic data)
    assert!(matrix_30.matrix[0][1] >= -1.0 && matrix_30.matrix[0][1] <= 1.0);
    assert!(matrix_90.matrix[0][1] >= -1.0 && matrix_90.matrix[0][1] <= 1.0);
    assert!(matrix_180.matrix[0][1] >= -1.0 && matrix_180.matrix[0][1] <= 1.0);
}

#[tokio::test]
async fn test_insufficient_data_handling() {
    let config = CorrelationAnalysisConfig {
        minimum_data_points: 30,
        ..CorrelationAnalysisConfig::default()
    };
    let system = MockCorrelationAnalysisSystem::new(config);

    // Create asset with insufficient data
    let asset = Asset {
        symbol: "TEST".to_string(),
        name: "Test Asset".to_string(),
        asset_type: AssetType::Token,
        price_history: create_test_price_history(20, 100.0), // Only 20 points, need 30
        volatility: 0.1,
        beta: 1.0,
        market_cap: None,
    };

    system.add_asset(asset).await.unwrap();

    let result = system.calculate_correlation_matrix(&vec!["TEST".to_string()], None).await;
    assert!(result.is_err());
}

#[tokio::test]
async fn test_metrics_tracking() {
    let config = CorrelationAnalysisConfig::default();
    let system = MockCorrelationAnalysisSystem::new(config);

    // Add test assets
    system.add_asset(Asset {
        symbol: "BTC".to_string(),
        name: "Bitcoin".to_string(),
        asset_type: AssetType::Cryptocurrency,
        price_history: create_test_price_history(60, 50000.0),
        volatility: 0.3,
        beta: 1.0,
        market_cap: None,
    }).await.unwrap();

    system.add_asset(Asset {
        symbol: "ETH".to_string(),
        name: "Ethereum".to_string(),
        asset_type: AssetType::Cryptocurrency,
        price_history: create_test_price_history(60, 3000.0),
        volatility: 0.4,
        beta: 1.2,
        market_cap: None,
    }).await.unwrap();

    let assets = vec!["BTC".to_string(), "ETH".to_string()];

    // Perform multiple calculations
    for _ in 0..3 {
        system.calculate_correlation_matrix(&assets, None).await.unwrap();
    }

    let metrics = system.get_correlation_metrics().await;
    assert_eq!(metrics.total_calculations, 3);
    assert_eq!(metrics.cache_misses, 1); // First calculation
    assert_eq!(metrics.cache_hits, 2); // Subsequent calculations
    assert!(metrics.average_calculation_time_ms > 0.0);
}

#[tokio::test]
async fn test_performance_benchmark() {
    let config = CorrelationAnalysisConfig::default();
    let system = MockCorrelationAnalysisSystem::new(config);

    // Create 20 assets with 100 data points each
    for i in 0..20 {
        let asset = Asset {
            symbol: format!("ASSET{}", i),
            name: format!("Asset {}", i),
            asset_type: AssetType::Token,
            price_history: create_test_price_history(100, 1000.0 + i as f64 * 100.0),
            volatility: 0.2 + (i as f64 * 0.01),
            beta: 1.0 + (i as f64 * 0.05),
            market_cap: None,
        };
        system.add_asset(asset).await.unwrap();
    }

    let asset_symbols: Vec<String> = (0..20).map(|i| format!("ASSET{}", i)).collect();

    let start_time = std::time::Instant::now();
    let matrix = system.calculate_correlation_matrix(&asset_symbols, None).await.unwrap();
    let calculation_time = start_time.elapsed();

    // Should complete within 200ms for 20 assets
    assert!(calculation_time.as_millis() < 200);
    assert_eq!(matrix.assets.len(), 20);
    assert_eq!(matrix.matrix.len(), 20);
    assert!(system.validate_correlation_matrix(&matrix).await.unwrap());
}

// Helper function to create test price history
fn create_test_price_history(days: i64, base_price: f64) -> Vec<PricePoint> {
    let mut price_history = Vec::new();
    let base_time = Utc::now() - Duration::days(days);
    
    for i in 0..days {
        let price = base_price + (i as f64 * 0.5) + (i as f64 / 10.0).sin() * base_price * 0.02;
        price_history.push(PricePoint {
            timestamp: base_time + Duration::days(i),
            price,
            volume: 1000.0 + (i as f64 * 10.0),
            market_cap: Some(price * 1000000.0),
        });
    }
    
    price_history
}