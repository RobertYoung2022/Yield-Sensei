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
pub struct HistoricalCorrelationAnalysis {
    pub time_periods: Vec<TimePeriod>,
    pub correlation_trends: HashMap<String, Vec<f64>>, // Asset pair -> correlation values over time
    pub regime_changes: Vec<RegimeChange>,
    pub volatility_clustering: HashMap<String, Vec<VolatilityCluster>>,
    pub seasonal_patterns: HashMap<String, SeasonalPattern>,
    pub crisis_correlations: Vec<CrisisCorrelation>,
}

#[derive(Debug, Clone)]
pub struct TimePeriod {
    pub start_date: DateTime<Utc>,
    pub end_date: DateTime<Utc>,
    pub correlation_matrix: CorrelationMatrix,
    pub average_correlation: f64,
    pub volatility_regime: VolatilityRegime,
}

#[derive(Debug, Clone)]
pub struct RegimeChange {
    pub change_point: DateTime<Utc>,
    pub asset_pair: (String, String),
    pub correlation_before: f64,
    pub correlation_after: f64,
    pub significance: f64,
    pub regime_type: RegimeType,
}

#[derive(Debug, Clone, PartialEq)]
pub enum RegimeType {
    LowToHigh,      // Low correlation to high correlation
    HighToLow,      // High correlation to low correlation
    StableToVolatile, // Stable correlation to volatile correlation
    VolatileToStable, // Volatile correlation to stable correlation
}

#[derive(Debug, Clone, PartialEq)]
pub enum VolatilityRegime {
    Low,
    Medium,
    High,
    Crisis,
}

#[derive(Debug, Clone)]
pub struct VolatilityCluster {
    pub start_date: DateTime<Utc>,
    pub end_date: DateTime<Utc>,
    pub intensity: f64,
    pub affected_correlations: Vec<String>,
}

#[derive(Debug, Clone)]
pub struct SeasonalPattern {
    pub asset_pair: (String, String),
    pub monthly_correlations: [f64; 12], // January = 0, December = 11
    pub seasonal_significance: f64,
    pub peak_season: u8, // Month with highest correlation (0-11)
    pub trough_season: u8, // Month with lowest correlation (0-11)
}

#[derive(Debug, Clone)]
pub struct CrisisCorrelation {
    pub crisis_period: (DateTime<Utc>, DateTime<Utc>),
    pub crisis_name: String,
    pub normal_correlations: HashMap<String, f64>,
    pub crisis_correlations: HashMap<String, f64>,
    pub correlation_increase: HashMap<String, f64>,
    pub recovery_time_days: Option<u32>,
}

#[derive(Debug, Clone)]
pub struct RollingCorrelation {
    pub asset_pair: (String, String),
    pub window_days: u32,
    pub timestamps: Vec<DateTime<Utc>>,
    pub correlations: Vec<f64>,
    pub confidence_intervals: Vec<(f64, f64)>,
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

    pub async fn perform_historical_correlation_analysis(
        &self,
        asset_symbols: &[String],
        lookback_days: u32,
        window_days: u32,
    ) -> Result<HistoricalCorrelationAnalysis, Box<dyn std::error::Error + Send + Sync>> {
        let assets = self.assets.read().await;
        
        // Generate time periods for analysis
        let time_periods = self.generate_time_periods(lookback_days, window_days).await?;
        
        // Calculate correlation trends
        let correlation_trends = self.calculate_correlation_trends(asset_symbols, &time_periods).await?;
        
        // Detect regime changes
        let regime_changes = self.detect_regime_changes(&correlation_trends).await?;
        
        // Identify volatility clustering
        let volatility_clustering = self.identify_volatility_clustering(asset_symbols, &time_periods).await?;
        
        // Analyze seasonal patterns
        let seasonal_patterns = self.analyze_seasonal_patterns(asset_symbols).await?;
        
        // Identify crisis correlations
        let crisis_correlations = self.identify_crisis_correlations(asset_symbols, &time_periods).await?;

        Ok(HistoricalCorrelationAnalysis {
            time_periods,
            correlation_trends,
            regime_changes,
            volatility_clustering,
            seasonal_patterns,
            crisis_correlations,
        })
    }

    async fn generate_time_periods(
        &self,
        lookback_days: u32,
        window_days: u32,
    ) -> Result<Vec<TimePeriod>, Box<dyn std::error::Error + Send + Sync>> {
        let mut periods = Vec::new();
        let step_size = window_days / 4; // 25% overlap between periods
        
        for i in (0..lookback_days).step_by(step_size as usize) {
            if i + window_days > lookback_days {
                break;
            }
            
            let start_date = Utc::now() - Duration::days((lookback_days - i) as i64);
            let end_date = Utc::now() - Duration::days((lookback_days - i - window_days) as i64);
            
            // Create mock correlation matrix for this period
            let correlation_matrix = self.create_period_correlation_matrix(&start_date, &end_date).await?;
            let average_correlation = self.calculate_average_correlation(&correlation_matrix).await?;
            let volatility_regime = self.determine_volatility_regime(&start_date, &end_date).await?;
            
            periods.push(TimePeriod {
                start_date,
                end_date,
                correlation_matrix,
                average_correlation,
                volatility_regime,
            });
        }
        
        Ok(periods)
    }

    async fn create_period_correlation_matrix(
        &self,
        start_date: &DateTime<Utc>,
        end_date: &DateTime<Utc>,
    ) -> Result<CorrelationMatrix, Box<dyn std::error::Error + Send + Sync>> {
        // Simulate correlation matrix that varies over time
        let time_factor = (end_date.timestamp() - start_date.timestamp()) as f64 / 86400.0; // Days
        let base_correlation = 0.6 + 0.2 * (time_factor * 0.1).sin(); // Varying correlation over time
        
        Ok(CorrelationMatrix {
            assets: vec!["BTC".to_string(), "ETH".to_string(), "UNI".to_string(), "USDC".to_string()],
            matrix: vec![
                vec![1.0, base_correlation, base_correlation * 0.8, 0.1],
                vec![base_correlation, 1.0, base_correlation * 0.9, 0.1],
                vec![base_correlation * 0.8, base_correlation * 0.9, 1.0, 0.1],
                vec![0.1, 0.1, 0.1, 1.0],
            ],
            timestamp: *end_date,
            time_window_days: (end_date.signed_duration_since(*start_date).num_days()) as u32,
            confidence_level: 0.95,
        })
    }

    async fn calculate_average_correlation(
        &self,
        matrix: &CorrelationMatrix,
    ) -> Result<f64, Box<dyn std::error::Error + Send + Sync>> {
        let n = matrix.assets.len();
        let mut total = 0.0;
        let mut count = 0;
        
        for i in 0..n {
            for j in (i + 1)..n {
                total += matrix.matrix[i][j].abs();
                count += 1;
            }
        }
        
        Ok(if count > 0 { total / count as f64 } else { 0.0 })
    }

    async fn determine_volatility_regime(
        &self,
        start_date: &DateTime<Utc>,
        _end_date: &DateTime<Utc>,
    ) -> Result<VolatilityRegime, Box<dyn std::error::Error + Send + Sync>> {
        // Simulate different volatility regimes based on time
        let days_from_now = Utc::now().signed_duration_since(*start_date).num_days();
        
        match days_from_now {
            0..=30 => Ok(VolatilityRegime::Low),
            31..=90 => Ok(VolatilityRegime::Medium),
            91..=180 => Ok(VolatilityRegime::High),
            _ => Ok(VolatilityRegime::Crisis),
        }
    }

    async fn calculate_correlation_trends(
        &self,
        asset_symbols: &[String],
        time_periods: &[TimePeriod],
    ) -> Result<HashMap<String, Vec<f64>>, Box<dyn std::error::Error + Send + Sync>> {
        let mut trends = HashMap::new();
        
        // Generate trends for each asset pair
        for i in 0..asset_symbols.len() {
            for j in (i + 1)..asset_symbols.len() {
                let pair_key = format!("{}-{}", asset_symbols[i], asset_symbols[j]);
                let mut correlations = Vec::new();
                
                for period in time_periods {
                    if let (Some(idx_i), Some(idx_j)) = (
                        period.correlation_matrix.assets.iter().position(|a| a == &asset_symbols[i]),
                        period.correlation_matrix.assets.iter().position(|a| a == &asset_symbols[j]),
                    ) {
                        correlations.push(period.correlation_matrix.matrix[idx_i][idx_j]);
                    }
                }
                
                trends.insert(pair_key, correlations);
            }
        }
        
        Ok(trends)
    }

    async fn detect_regime_changes(
        &self,
        correlation_trends: &HashMap<String, Vec<f64>>,
    ) -> Result<Vec<RegimeChange>, Box<dyn std::error::Error + Send + Sync>> {
        let mut regime_changes = Vec::new();
        
        for (pair_key, correlations) in correlation_trends {
            if correlations.len() < 10 {
                continue; // Need sufficient data points
            }
            
            // Simple regime change detection: look for significant changes
            for i in 5..correlations.len() - 5 {
                let before_avg = correlations[i-5..i].iter().sum::<f64>() / 5.0;
                let after_avg = correlations[i..i+5].iter().sum::<f64>() / 5.0;
                let change = (after_avg - before_avg).abs();
                
                if change > 0.3 { // Significant change threshold
                    let parts: Vec<&str> = pair_key.split('-').collect();
                    if parts.len() == 2 {
                        let regime_type = if before_avg < after_avg {
                            RegimeType::LowToHigh
                        } else {
                            RegimeType::HighToLow
                        };
                        
                        regime_changes.push(RegimeChange {
                            change_point: Utc::now() - Duration::days((correlations.len() - i) as i64 * 7),
                            asset_pair: (parts[0].to_string(), parts[1].to_string()),
                            correlation_before: before_avg,
                            correlation_after: after_avg,
                            significance: change,
                            regime_type,
                        });
                    }
                }
            }
        }
        
        Ok(regime_changes)
    }

    async fn identify_volatility_clustering(
        &self,
        asset_symbols: &[String],
        time_periods: &[TimePeriod],
    ) -> Result<HashMap<String, Vec<VolatilityCluster>>, Box<dyn std::error::Error + Send + Sync>> {
        let mut clustering = HashMap::new();
        
        for symbol in asset_symbols {
            let mut clusters = Vec::new();
            let mut current_cluster: Option<VolatilityCluster> = None;
            
            for period in time_periods {
                let is_high_volatility = matches!(period.volatility_regime, VolatilityRegime::High | VolatilityRegime::Crisis);
                
                if is_high_volatility {
                    if let Some(ref mut cluster) = current_cluster {
                        // Extend existing cluster
                        cluster.end_date = period.end_date;
                        cluster.intensity = (cluster.intensity + 1.0) / 2.0; // Average intensity
                        cluster.affected_correlations.push(format!("{}-correlation-spike", symbol));
                    } else {
                        // Start new cluster
                        current_cluster = Some(VolatilityCluster {
                            start_date: period.start_date,
                            end_date: period.end_date,
                            intensity: 1.0,
                            affected_correlations: vec![format!("{}-high-vol", symbol)],
                        });
                    }
                } else if let Some(cluster) = current_cluster.take() {
                    // End of cluster
                    clusters.push(cluster);
                }
            }
            
            // Don't forget the last cluster if it's still active
            if let Some(cluster) = current_cluster {
                clusters.push(cluster);
            }
            
            clustering.insert(symbol.clone(), clusters);
        }
        
        Ok(clustering)
    }

    async fn analyze_seasonal_patterns(
        &self,
        asset_symbols: &[String],
    ) -> Result<HashMap<String, SeasonalPattern>, Box<dyn std::error::Error + Send + Sync>> {
        let mut patterns = HashMap::new();
        
        // Generate mock seasonal patterns for asset pairs
        for i in 0..asset_symbols.len() {
            for j in (i + 1)..asset_symbols.len() {
                let pair_key = format!("{}-{}", asset_symbols[i], asset_symbols[j]);
                
                // Create mock seasonal correlation data
                let mut monthly_correlations = [0.0; 12];
                for month in 0..12 {
                    // Simulate seasonal variation
                    let base_correlation = 0.6;
                    let seasonal_effect = 0.2 * ((month as f64 * 2.0 * std::f64::consts::PI / 12.0).sin());
                    monthly_correlations[month] = base_correlation + seasonal_effect;
                }
                
                // Find peak and trough
                let peak_season = monthly_correlations.iter()
                    .enumerate()
                    .max_by(|(_, a), (_, b)| a.partial_cmp(b).unwrap())
                    .map(|(i, _)| i as u8)
                    .unwrap_or(0);
                
                let trough_season = monthly_correlations.iter()
                    .enumerate()
                    .min_by(|(_, a), (_, b)| a.partial_cmp(b).unwrap())
                    .map(|(i, _)| i as u8)
                    .unwrap_or(0);
                
                let seasonal_significance = monthly_correlations[peak_season as usize] - monthly_correlations[trough_season as usize];
                
                patterns.insert(pair_key, SeasonalPattern {
                    asset_pair: (asset_symbols[i].clone(), asset_symbols[j].clone()),
                    monthly_correlations,
                    seasonal_significance,
                    peak_season,
                    trough_season,
                });
            }
        }
        
        Ok(patterns)
    }

    async fn identify_crisis_correlations(
        &self,
        asset_symbols: &[String],
        time_periods: &[TimePeriod],
    ) -> Result<Vec<CrisisCorrelation>, Box<dyn std::error::Error + Send + Sync>> {
        let mut crisis_correlations = Vec::new();
        
        // Find crisis periods (high volatility regimes)
        let mut crisis_start: Option<DateTime<Utc>> = None;
        
        for period in time_periods {
            match period.volatility_regime {
                VolatilityRegime::Crisis => {
                    if crisis_start.is_none() {
                        crisis_start = Some(period.start_date);
                    }
                },
                _ => {
                    if let Some(start) = crisis_start.take() {
                        // End of crisis period
                        let crisis_end = period.start_date;
                        
                        // Generate mock crisis correlation data
                        let mut normal_correlations = HashMap::new();
                        let mut crisis_correlations_map = HashMap::new();
                        let mut correlation_increase = HashMap::new();
                        
                        for i in 0..asset_symbols.len() {
                            for j in (i + 1)..asset_symbols.len() {
                                let pair_key = format!("{}-{}", asset_symbols[i], asset_symbols[j]);
                                let normal_corr = 0.6; // Normal correlation
                                let crisis_corr = 0.85; // Increased during crisis
                                let increase = crisis_corr - normal_corr;
                                
                                normal_correlations.insert(pair_key.clone(), normal_corr);
                                crisis_correlations_map.insert(pair_key.clone(), crisis_corr);
                                correlation_increase.insert(pair_key, increase);
                            }
                        }
                        
                        let recovery_time = Some(90); // Assume 90 days recovery
                        
                        crisis_correlations.push(CrisisCorrelation {
                            crisis_period: (start, crisis_end),
                            crisis_name: "Market Stress Event".to_string(),
                            normal_correlations,
                            crisis_correlations: crisis_correlations_map,
                            correlation_increase,
                            recovery_time_days: recovery_time,
                        });
                    }
                }
            }
        }
        
        Ok(crisis_correlations)
    }

    pub async fn calculate_rolling_correlation(
        &self,
        asset1: &str,
        asset2: &str,
        window_days: u32,
        lookback_days: u32,
    ) -> Result<RollingCorrelation, Box<dyn std::error::Error + Send + Sync>> {
        let mut timestamps = Vec::new();
        let mut correlations = Vec::new();
        let mut confidence_intervals = Vec::new();
        
        // Generate rolling correlation data
        for i in (window_days..=lookback_days).step_by(7) { // Weekly intervals
            let timestamp = Utc::now() - Duration::days((lookback_days - i) as i64);
            
            // Simulate correlation that varies over time
            let time_factor = i as f64 / lookback_days as f64;
            let base_correlation = 0.7;
            let trend = -0.2 * time_factor; // Decreasing trend over time
            let noise = 0.15 * (i as f64 * 0.2).sin(); // Cyclical noise
            let correlation = (base_correlation + trend + noise).max(-0.99).min(0.99);
            
            // Calculate confidence interval (simplified)
            let stderr = 0.05; // Standard error
            let ci_lower = correlation - 1.96 * stderr;
            let ci_upper = correlation + 1.96 * stderr;
            
            timestamps.push(timestamp);
            correlations.push(correlation);
            confidence_intervals.push((ci_lower, ci_upper));
        }
        
        Ok(RollingCorrelation {
            asset_pair: (asset1.to_string(), asset2.to_string()),
            window_days,
            timestamps,
            correlations,
            confidence_intervals,
        })
    }

    pub async fn detect_correlation_breakpoints(
        &self,
        rolling_correlation: &RollingCorrelation,
        min_segment_length: usize,
    ) -> Result<Vec<DateTime<Utc>>, Box<dyn std::error::Error + Send + Sync>> {
        let mut breakpoints = Vec::new();
        
        if rolling_correlation.correlations.len() < min_segment_length * 2 {
            return Ok(breakpoints);
        }
        
        // Simple breakpoint detection using change in variance
        let window_size = min_segment_length;
        
        for i in window_size..rolling_correlation.correlations.len() - window_size {
            let before_segment = &rolling_correlation.correlations[i-window_size..i];
            let after_segment = &rolling_correlation.correlations[i..i+window_size];
            
            let before_var = self.calculate_variance(before_segment).await?;
            let after_var = self.calculate_variance(after_segment).await?;
            
            // Detect significant change in variance
            let var_ratio = if before_var > 0.0 {
                after_var / before_var
            } else {
                1.0
            };
            
            if var_ratio > 2.0 || var_ratio < 0.5 {
                breakpoints.push(rolling_correlation.timestamps[i]);
            }
        }
        
        Ok(breakpoints)
    }

    async fn calculate_variance(&self, data: &[f64]) -> Result<f64, Box<dyn std::error::Error + Send + Sync>> {
        if data.is_empty() {
            return Ok(0.0);
        }
        
        let mean = data.iter().sum::<f64>() / data.len() as f64;
        let variance = data.iter()
            .map(|x| (x - mean).powi(2))
            .sum::<f64>() / data.len() as f64;
        
        Ok(variance)
    }

    pub async fn analyze_correlation_persistence(
        &self,
        rolling_correlation: &RollingCorrelation,
        threshold: f64,
    ) -> Result<(f64, Vec<(DateTime<Utc>, DateTime<Utc>)>), Box<dyn std::error::Error + Send + Sync>> {
        let mut persistent_periods = Vec::new();
        let mut current_period_start: Option<DateTime<Utc>> = None;
        let mut persistent_count = 0;
        
        for (i, &correlation) in rolling_correlation.correlations.iter().enumerate() {
            let is_high_correlation = correlation.abs() >= threshold;
            
            if is_high_correlation {
                if current_period_start.is_none() {
                    current_period_start = Some(rolling_correlation.timestamps[i]);
                }
                persistent_count += 1;
            } else if let Some(start) = current_period_start.take() {
                // End of persistent period
                persistent_periods.push((start, rolling_correlation.timestamps[i-1]));
            }
        }
        
        // Don't forget the last period if it's still active
        if let Some(start) = current_period_start {
            if let Some(&last_timestamp) = rolling_correlation.timestamps.last() {
                persistent_periods.push((start, last_timestamp));
            }
        }
        
        let persistence_ratio = persistent_count as f64 / rolling_correlation.correlations.len() as f64;
        
        Ok((persistence_ratio, persistent_periods))
    }
}

// Helper functions for test data generation
fn create_test_asset_with_history(symbol: &str, asset_type: AssetType, volatility: f64, days: u32) -> Asset {
    let mut price_history = Vec::new();
    let base_price = 100.0;
    
    for i in 0..days {
        let timestamp = Utc::now() - Duration::days((days - 1 - i) as i64);
        let time_factor = i as f64 * 0.1;
        let trend = 0.001 * i as f64; // Small upward trend
        let noise = volatility * (time_factor.sin() + 0.5 * time_factor.cos());
        let price = base_price * (1.0 + trend + noise);
        
        price_history.push(PricePoint {
            timestamp,
            price,
            volume: 1000000.0 * (1.0 + 0.2 * noise),
            market_cap: Some(price * 21000000.0), // Simulate market cap
        });
    }

    Asset {
        symbol: symbol.to_string(),
        name: format!("{} Asset", symbol),
        asset_type,
        price_history,
        volatility,
        beta: 1.0 + volatility * 0.5,
        market_cap: Some(price_history.last().unwrap().market_cap.unwrap_or(100000000.0)),
    }
}

// Test Cases

#[tokio::test]
async fn test_historical_correlation_analysis() {
    let system = MockCorrelationAnalysisSystem::new();
    let asset_symbols = vec!["BTC".to_string(), "ETH".to_string(), "UNI".to_string(), "USDC".to_string()];

    // Add test assets with extended history
    system.add_asset(create_test_asset_with_history("BTC", AssetType::Cryptocurrency, 0.6, 730)).await;
    system.add_asset(create_test_asset_with_history("ETH", AssetType::Cryptocurrency, 0.7, 730)).await;
    system.add_asset(create_test_asset_with_history("UNI", AssetType::DeFiProtocol, 0.9, 730)).await;
    system.add_asset(create_test_asset_with_history("USDC", AssetType::Stablecoin, 0.02, 730)).await;

    let analysis = system.perform_historical_correlation_analysis(&asset_symbols, 730, 90).await;
    assert!(analysis.is_ok());

    let result = analysis.unwrap();
    
    // Should have multiple time periods
    assert!(result.time_periods.len() > 5);
    
    // Should have correlation trends for each asset pair
    assert!(!result.correlation_trends.is_empty());
    let expected_pairs = (asset_symbols.len() * (asset_symbols.len() - 1)) / 2;
    assert_eq!(result.correlation_trends.len(), expected_pairs);
    
    // Should detect some regime changes
    assert!(!result.regime_changes.is_empty());
    
    // Should identify volatility clustering
    assert!(!result.volatility_clustering.is_empty());
    
    // Should have seasonal patterns
    assert!(!result.seasonal_patterns.is_empty());
    
    println!("Time periods analyzed: {}", result.time_periods.len());
    println!("Regime changes detected: {}", result.regime_changes.len());
    println!("Crisis periods identified: {}", result.crisis_correlations.len());
}

#[tokio::test]
async fn test_regime_change_detection() {
    let system = MockCorrelationAnalysisSystem::new();
    let asset_symbols = vec!["BTC".to_string(), "ETH".to_string()];

    // Add test assets
    system.add_asset(create_test_asset_with_history("BTC", AssetType::Cryptocurrency, 0.6, 365)).await;
    system.add_asset(create_test_asset_with_history("ETH", AssetType::Cryptocurrency, 0.7, 365)).await;

    let analysis = system.perform_historical_correlation_analysis(&asset_symbols, 365, 60).await.unwrap();

    // Should detect regime changes
    assert!(!analysis.regime_changes.is_empty());
    
    for regime_change in &analysis.regime_changes {
        // Verify regime change properties
        assert!(regime_change.significance > 0.0);
        assert!(regime_change.correlation_before != regime_change.correlation_after);
        assert!(regime_change.correlation_before >= -1.0 && regime_change.correlation_before <= 1.0);
        assert!(regime_change.correlation_after >= -1.0 && regime_change.correlation_after <= 1.0);
        
        // Verify regime type consistency
        match regime_change.regime_type {
            RegimeType::LowToHigh => assert!(regime_change.correlation_after > regime_change.correlation_before),
            RegimeType::HighToLow => assert!(regime_change.correlation_before > regime_change.correlation_after),
            _ => {} // Other types are valid
        }
        
        println!("Regime change: {} -> {} at {:?} (significance: {:.3})", 
                regime_change.correlation_before, 
                regime_change.correlation_after,
                regime_change.change_point,
                regime_change.significance);
    }
}

#[tokio::test]
async fn test_volatility_clustering_identification() {
    let system = MockCorrelationAnalysisSystem::new();
    let asset_symbols = vec!["BTC".to_string(), "ETH".to_string()];

    // Add test assets
    system.add_asset(create_test_asset_with_history("BTC", AssetType::Cryptocurrency, 0.8, 365)).await;
    system.add_asset(create_test_asset_with_history("ETH", AssetType::Cryptocurrency, 0.9, 365)).await;

    let analysis = system.perform_historical_correlation_analysis(&asset_symbols, 365, 30).await.unwrap();

    // Should identify volatility clustering
    assert!(!analysis.volatility_clustering.is_empty());
    
    for (asset, clusters) in &analysis.volatility_clustering {
        assert!(asset_symbols.contains(asset));
        
        for cluster in clusters {
            // Verify cluster properties
            assert!(cluster.start_date <= cluster.end_date);
            assert!(cluster.intensity > 0.0);
            assert!(!cluster.affected_correlations.is_empty());
            
            let duration_days = cluster.end_date.signed_duration_since(cluster.start_date).num_days();
            println!("Volatility cluster for {}: {} days (intensity: {:.2})", 
                    asset, duration_days, cluster.intensity);
        }
    }
}

#[tokio::test]
async fn test_seasonal_pattern_analysis() {
    let system = MockCorrelationAnalysisSystem::new();
    let asset_symbols = vec!["BTC".to_string(), "ETH".to_string(), "GOLD".to_string()];

    // Add test assets
    system.add_asset(create_test_asset_with_history("BTC", AssetType::Cryptocurrency, 0.6, 730)).await;
    system.add_asset(create_test_asset_with_history("ETH", AssetType::Cryptocurrency, 0.7, 730)).await;
    system.add_asset(create_test_asset_with_history("GOLD", AssetType::Commodity, 0.2, 730)).await;

    let analysis = system.perform_historical_correlation_analysis(&asset_symbols, 730, 90).await.unwrap();

    // Should detect seasonal patterns
    assert!(!analysis.seasonal_patterns.is_empty());
    
    for (pair_key, pattern) in &analysis.seasonal_patterns {
        // Verify pattern properties
        assert_eq!(pattern.monthly_correlations.len(), 12);
        assert!(pattern.peak_season < 12);
        assert!(pattern.trough_season < 12);
        assert!(pattern.seasonal_significance >= 0.0);
        
        // Peak correlation should be higher than trough
        let peak_corr = pattern.monthly_correlations[pattern.peak_season as usize];
        let trough_corr = pattern.monthly_correlations[pattern.trough_season as usize];
        assert!(peak_corr >= trough_corr);
        
        println!("Seasonal pattern for {}: Peak month {} ({:.3}), Trough month {} ({:.3})", 
                pair_key, 
                pattern.peak_season + 1, peak_corr,
                pattern.trough_season + 1, trough_corr);
    }
}

#[tokio::test]
async fn test_crisis_correlation_identification() {
    let system = MockCorrelationAnalysisSystem::new();
    let asset_symbols = vec!["BTC".to_string(), "ETH".to_string(), "STOCKS".to_string()];

    // Add test assets
    system.add_asset(create_test_asset_with_history("BTC", AssetType::Cryptocurrency, 0.7, 730)).await;
    system.add_asset(create_test_asset_with_history("ETH", AssetType::Cryptocurrency, 0.8, 730)).await;
    system.add_asset(create_test_asset_with_history("STOCKS", AssetType::Stock, 0.3, 730)).await;

    let analysis = system.perform_historical_correlation_analysis(&asset_symbols, 730, 60).await.unwrap();

    // Should identify crisis periods
    if !analysis.crisis_correlations.is_empty() {
        for crisis in &analysis.crisis_correlations {
            // Verify crisis properties
            assert!(crisis.crisis_period.0 <= crisis.crisis_period.1);
            assert!(!crisis.crisis_name.is_empty());
            assert!(!crisis.normal_correlations.is_empty());
            assert!(!crisis.crisis_correlations.is_empty());
            assert!(!crisis.correlation_increase.is_empty());
            
            // Crisis correlations should generally be higher than normal
            for (pair, &normal_corr) in &crisis.normal_correlations {
                if let Some(&crisis_corr) = crisis.crisis_correlations.get(pair) {
                    let increase = crisis.correlation_increase.get(pair).unwrap_or(&0.0);
                    assert_eq!(*increase, crisis_corr - normal_corr);
                    
                    println!("Crisis correlation for {}: {:.3} -> {:.3} (increase: {:.3})",
                            pair, normal_corr, crisis_corr, increase);
                }
            }
            
            if let Some(recovery_days) = crisis.recovery_time_days {
                assert!(recovery_days > 0);
                println!("Recovery time: {} days", recovery_days);
            }
        }
    }
}

#[tokio::test]
async fn test_rolling_correlation_calculation() {
    let system = MockCorrelationAnalysisSystem::new();

    // Add test assets
    system.add_asset(create_test_asset_with_history("BTC", AssetType::Cryptocurrency, 0.6, 365)).await;
    system.add_asset(create_test_asset_with_history("ETH", AssetType::Cryptocurrency, 0.7, 365)).await;

    let rolling_corr = system.calculate_rolling_correlation("BTC", "ETH", 30, 365).await;
    assert!(rolling_corr.is_ok());

    let result = rolling_corr.unwrap();
    
    // Verify rolling correlation properties
    assert_eq!(result.asset_pair, ("BTC".to_string(), "ETH".to_string()));
    assert_eq!(result.window_days, 30);
    assert!(!result.timestamps.is_empty());
    assert_eq!(result.timestamps.len(), result.correlations.len());
    assert_eq!(result.correlations.len(), result.confidence_intervals.len());
    
    // Correlations should be in valid range
    for &correlation in &result.correlations {
        assert!(correlation >= -1.0 && correlation <= 1.0);
    }
    
    // Confidence intervals should be valid
    for (lower, upper) in &result.confidence_intervals {
        assert!(lower <= upper);
        assert!(*lower >= -1.0 && *upper <= 1.0);
    }
    
    // Timestamps should be in chronological order
    for i in 1..result.timestamps.len() {
        assert!(result.timestamps[i-1] <= result.timestamps[i]);
    }
    
    println!("Rolling correlation data points: {}", result.correlations.len());
    println!("Correlation range: {:.3} to {:.3}", 
            result.correlations.iter().cloned().fold(f64::INFINITY, f64::min),
            result.correlations.iter().cloned().fold(f64::NEG_INFINITY, f64::max));
}

#[tokio::test]
async fn test_correlation_breakpoint_detection() {
    let system = MockCorrelationAnalysisSystem::new();

    // Add test assets
    system.add_asset(create_test_asset_with_history("BTC", AssetType::Cryptocurrency, 0.6, 365)).await;
    system.add_asset(create_test_asset_with_history("ETH", AssetType::Cryptocurrency, 0.7, 365)).await;

    let rolling_corr = system.calculate_rolling_correlation("BTC", "ETH", 30, 365).await.unwrap();
    let breakpoints = system.detect_correlation_breakpoints(&rolling_corr, 5).await;
    assert!(breakpoints.is_ok());

    let result = breakpoints.unwrap();
    
    // Breakpoints should be within the time range
    for breakpoint in &result {
        assert!(*breakpoint >= rolling_corr.timestamps[0]);
        assert!(*breakpoint <= *rolling_corr.timestamps.last().unwrap());
    }
    
    // Breakpoints should be in chronological order
    for i in 1..result.len() {
        assert!(result[i-1] <= result[i]);
    }
    
    println!("Correlation breakpoints detected: {}", result.len());
    for (i, breakpoint) in result.iter().enumerate() {
        println!("Breakpoint {}: {:?}", i+1, breakpoint);
    }
}

#[tokio::test]
async fn test_correlation_persistence_analysis() {
    let system = MockCorrelationAnalysisSystem::new();

    // Add test assets
    system.add_asset(create_test_asset_with_history("BTC", AssetType::Cryptocurrency, 0.6, 365)).await;
    system.add_asset(create_test_asset_with_history("ETH", AssetType::Cryptocurrency, 0.7, 365)).await;

    let rolling_corr = system.calculate_rolling_correlation("BTC", "ETH", 30, 365).await.unwrap();
    let persistence = system.analyze_correlation_persistence(&rolling_corr, 0.7).await;
    assert!(persistence.is_ok());

    let (persistence_ratio, persistent_periods) = persistence.unwrap();
    
    // Persistence ratio should be valid
    assert!(persistence_ratio >= 0.0 && persistence_ratio <= 1.0);
    
    // Persistent periods should have valid date ranges
    for (start, end) in &persistent_periods {
        assert!(start <= end);
        assert!(*start >= rolling_corr.timestamps[0]);
        assert!(*end <= *rolling_corr.timestamps.last().unwrap());
    }
    
    // Periods should not overlap
    for i in 1..persistent_periods.len() {
        assert!(persistent_periods[i-1].1 <= persistent_periods[i].0);
    }
    
    println!("Correlation persistence ratio: {:.3}", persistence_ratio);
    println!("Number of persistent periods: {}", persistent_periods.len());
    
    for (i, (start, end)) in persistent_periods.iter().enumerate() {
        let duration = end.signed_duration_since(*start).num_days();
        println!("Persistent period {}: {} days", i+1, duration);
    }
}

#[tokio::test]
async fn test_time_period_generation() {
    let system = MockCorrelationAnalysisSystem::new();

    let periods = system.generate_time_periods(365, 90).await.unwrap();
    
    // Should generate multiple overlapping periods
    assert!(!periods.is_empty());
    
    // Verify period properties
    for period in &periods {
        assert!(period.start_date <= period.end_date);
        assert!(period.average_correlation >= 0.0 && period.average_correlation <= 1.0);
        assert!(!period.correlation_matrix.assets.is_empty());
        
        let duration = period.end_date.signed_duration_since(period.start_date).num_days();
        assert!(duration >= 80 && duration <= 100); // Should be close to window_days
    }
    
    // Verify chronological order
    for i in 1..periods.len() {
        assert!(periods[i-1].start_date <= periods[i].start_date);
    }
    
    println!("Generated {} time periods", periods.len());
    println!("Period duration range: {} to {} days", 
            periods.iter().map(|p| p.end_date.signed_duration_since(p.start_date).num_days()).min().unwrap(),
            periods.iter().map(|p| p.end_date.signed_duration_since(p.start_date).num_days()).max().unwrap());
}

#[tokio::test]
async fn test_volatility_regime_classification() {
    let system = MockCorrelationAnalysisSystem::new();

    // Test different time points for regime classification
    let test_dates = vec![
        Utc::now() - Duration::days(15),  // Recent (Low volatility)
        Utc::now() - Duration::days(60),  // Medium term (Medium volatility)
        Utc::now() - Duration::days(120), // Long term (High volatility)
        Utc::now() - Duration::days(300), // Very long term (Crisis)
    ];

    let expected_regimes = vec![
        VolatilityRegime::Low,
        VolatilityRegime::Medium,
        VolatilityRegime::High,
        VolatilityRegime::Crisis,
    ];

    for (date, expected_regime) in test_dates.iter().zip(expected_regimes.iter()) {
        let end_date = *date + Duration::days(30);
        let regime = system.determine_volatility_regime(date, &end_date).await.unwrap();
        assert_eq!(regime, *expected_regime);
        
        println!("Date: {:?}, Regime: {:?}", date, regime);
    }
}

#[tokio::test]
async fn test_historical_analysis_performance_benchmark() {
    let system = MockCorrelationAnalysisSystem::new();
    let asset_symbols = vec!["BTC".to_string(), "ETH".to_string(), "UNI".to_string(), "USDC".to_string()];

    // Add test assets
    for symbol in &asset_symbols {
        let asset_type = match symbol.as_str() {
            "BTC" | "ETH" => AssetType::Cryptocurrency,
            "UNI" => AssetType::DeFiProtocol,
            "USDC" => AssetType::Stablecoin,
            _ => AssetType::Token,
        };
        system.add_asset(create_test_asset_with_history(symbol, asset_type, 0.5, 730)).await;
    }

    let start_time = std::time::Instant::now();
    let _analysis = system.perform_historical_correlation_analysis(&asset_symbols, 730, 90).await.unwrap();
    let duration = start_time.elapsed();

    // Should complete 2-year historical analysis within target time (1000ms)
    assert!(duration.as_millis() < 1000);
    
    println!("Historical analysis completed in {}ms", duration.as_millis());
}

#[tokio::test]
async fn test_empty_data_handling() {
    let system = MockCorrelationAnalysisSystem::new();
    let empty_symbols: Vec<String> = vec![];

    let result = system.perform_historical_correlation_analysis(&empty_symbols, 365, 90).await;
    
    // Should handle empty input gracefully
    if result.is_ok() {
        let analysis = result.unwrap();
        assert!(analysis.correlation_trends.is_empty());
        assert!(analysis.seasonal_patterns.is_empty());
    }
    
    // Test with single asset (no correlations possible)
    let single_asset = vec!["BTC".to_string()];
    system.add_asset(create_test_asset_with_history("BTC", AssetType::Cryptocurrency, 0.6, 365)).await;
    
    let single_result = system.perform_historical_correlation_analysis(&single_asset, 365, 90).await;
    if single_result.is_ok() {
        let analysis = single_result.unwrap();
        assert!(analysis.correlation_trends.is_empty()); // No pairs to correlate
    }
}

#[tokio::test]
async fn test_large_dataset_handling() {
    let system = MockCorrelationAnalysisSystem::new();
    
    // Create large dataset with 10 assets
    let mut asset_symbols = Vec::new();
    for i in 0..10 {
        let symbol = format!("ASSET{}", i);
        asset_symbols.push(symbol.clone());
        
        let asset_type = match i % 4 {
            0 => AssetType::Cryptocurrency,
            1 => AssetType::DeFiProtocol,
            2 => AssetType::Stock,
            _ => AssetType::Bond,
        };
        
        system.add_asset(create_test_asset_with_history(&symbol, asset_type, 0.3 + (i as f64 * 0.02), 730)).await;
    }

    let start_time = std::time::Instant::now();
    let analysis = system.perform_historical_correlation_analysis(&asset_symbols, 730, 60).await.unwrap();
    let duration = start_time.elapsed();

    // Should handle large dataset efficiently
    assert!(duration.as_millis() < 2000); // Within 2 seconds
    
    // Should have correlation trends for all pairs
    let expected_pairs = (asset_symbols.len() * (asset_symbols.len() - 1)) / 2;
    assert_eq!(analysis.correlation_trends.len(), expected_pairs);
    
    // Should have seasonal patterns for all pairs
    assert_eq!(analysis.seasonal_patterns.len(), expected_pairs);
    
    println!("Large dataset analysis ({} assets, {} pairs) completed in {}ms", 
            asset_symbols.len(), expected_pairs, duration.as_millis());
}