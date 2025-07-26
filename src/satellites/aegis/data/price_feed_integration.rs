use crate::security::{Vulnerability, VulnerabilitySeverity, VulnerabilityCategory};
use crate::types::PriceData;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use chrono::{DateTime, Utc, Duration};
use rust_decimal::Decimal;
use rust_decimal::prelude::{FromPrimitive, ToPrimitive};
use log::{info, warn, error, debug};
use async_trait::async_trait;
use uuid::Uuid;

/// Oracle types
#[derive(Debug, Clone, Serialize, Deserialize, Eq, Hash, PartialEq)]
pub enum OracleType {
    Chainlink,
    Pyth,
    Band,
    Custom(String),
}

/// Oracle configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OracleConfig {
    pub oracle_type: OracleType,
    pub endpoint: String,
    pub api_key: Option<String>,
    pub timeout_seconds: u64,
    pub retry_attempts: u32,
    pub weight: f64, // Weight for weighted average
    pub enabled: bool,
}

/// Price feed data with metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EnhancedPriceData {
    pub price: Decimal,
    pub timestamp: DateTime<Utc>,
    pub oracle_type: OracleType,
    pub confidence: f64,
    pub volume_24h: Option<Decimal>,
    pub market_cap: Option<Decimal>,
    pub price_change_24h: Option<f64>,
    pub is_anomalous: bool,
    pub anomaly_score: f64,
}

/// Oracle response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OracleResponse {
    pub oracle_type: OracleType,
    pub price: Decimal,
    pub timestamp: DateTime<Utc>,
    pub confidence: f64,
    pub raw_data: serde_json::Value,
    pub response_time_ms: u64,
    pub success: bool,
    pub error_message: Option<String>,
}

/// Price feed aggregation result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AggregatedPriceData {
    pub price: Decimal,
    pub timestamp: DateTime<Utc>,
    pub confidence: f64,
    pub oracle_count: usize,
    pub price_deviation: f64,
    pub is_consensus: bool,
    pub fallback_used: bool,
    pub oracle_responses: Vec<OracleResponse>,
}

/// Audit database entry
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuditEntry {
    pub id: String,
    pub protocol_name: String,
    pub audit_firm: String,
    pub audit_date: DateTime<Utc>,
    pub severity: VulnerabilitySeverity,
    pub category: VulnerabilityCategory,
    pub title: String,
    pub description: String,
    pub impact: String,
    pub status: AuditStatus,
    pub remediation: Option<String>,
    pub cve_id: Option<String>,
    pub references: Vec<String>,
}

/// Audit status
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AuditStatus {
    Open,
    InProgress,
    Resolved,
    FalsePositive,
    Accepted,
}

/// Audit database configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuditDatabaseConfig {
    pub databases: Vec<AuditDatabase>,
    pub cache_duration_hours: u32,
    pub enable_auto_sync: bool,
    pub sync_interval_hours: u32,
}

/// Audit database source
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuditDatabase {
    pub name: String,
    pub endpoint: String,
    pub api_key: Option<String>,
    pub audit_firms: Vec<String>,
    pub enabled: bool,
    pub priority: u32,
}

/// Anomaly detection configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnomalyDetectionConfig {
    pub price_deviation_threshold: f64,
    pub volume_spike_threshold: f64,
    pub time_window_minutes: u32,
    pub confidence_threshold: f64,
    pub enable_machine_learning: bool,
}

/// Price feed integration configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PriceFeedIntegrationConfig {
    pub oracles: Vec<OracleConfig>,
    pub fallback_strategy: FallbackStrategy,
    pub aggregation_method: AggregationMethod,
    pub cache_duration_seconds: u64,
    pub anomaly_detection: AnomalyDetectionConfig,
    pub audit_databases: AuditDatabaseConfig,
    pub enable_monitoring: bool,
    pub monitoring_interval_seconds: u64,
}

/// Fallback strategies
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum FallbackStrategy {
    UseLastKnownPrice,
    UseMedianPrice,
    UseWeightedAverage,
    UseMostReliableOracle,
    DisableTrading,
}

/// Aggregation methods
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AggregationMethod {
    WeightedAverage,
    Median,
    TrimmedMean,
    Consensus,
    Custom(String),
}

impl Default for PriceFeedIntegrationConfig {
    fn default() -> Self {
        Self {
            oracles: vec![
                OracleConfig {
                    oracle_type: OracleType::Chainlink,
                    endpoint: "https://api.chainlink.com".to_string(),
                    api_key: None,
                    timeout_seconds: 10,
                    retry_attempts: 3,
                    weight: 0.4,
                    enabled: true,
                },
                OracleConfig {
                    oracle_type: OracleType::Pyth,
                    endpoint: "https://api.pyth.network".to_string(),
                    api_key: None,
                    timeout_seconds: 10,
                    retry_attempts: 3,
                    weight: 0.35,
                    enabled: true,
                },
                OracleConfig {
                    oracle_type: OracleType::Band,
                    endpoint: "https://api.bandprotocol.com".to_string(),
                    api_key: None,
                    timeout_seconds: 10,
                    retry_attempts: 3,
                    weight: 0.25,
                    enabled: true,
                },
            ],
            fallback_strategy: FallbackStrategy::UseWeightedAverage,
            aggregation_method: AggregationMethod::WeightedAverage,
            cache_duration_seconds: 300, // 5 minutes
            anomaly_detection: AnomalyDetectionConfig {
                price_deviation_threshold: 0.05, // 5%
                volume_spike_threshold: 3.0, // 3x normal volume
                time_window_minutes: 60,
                confidence_threshold: 0.8,
                enable_machine_learning: false,
            },
            audit_databases: AuditDatabaseConfig {
                databases: vec![
                    AuditDatabase {
                        name: "Consensys Diligence".to_string(),
                        endpoint: "https://diligence.consensys.net".to_string(),
                        api_key: None,
                        audit_firms: vec!["Consensys Diligence".to_string()],
                        enabled: true,
                        priority: 1,
                    },
                    AuditDatabase {
                        name: "Trail of Bits".to_string(),
                        endpoint: "https://www.trailofbits.com".to_string(),
                        api_key: None,
                        audit_firms: vec!["Trail of Bits".to_string()],
                        enabled: true,
                        priority: 2,
                    },
                    AuditDatabase {
                        name: "OpenZeppelin".to_string(),
                        endpoint: "https://openzeppelin.com".to_string(),
                        api_key: None,
                        audit_firms: vec!["OpenZeppelin".to_string()],
                        enabled: true,
                        priority: 3,
                    },
                ],
                cache_duration_hours: 24,
                enable_auto_sync: true,
                sync_interval_hours: 6,
            },
            enable_monitoring: true,
            monitoring_interval_seconds: 30,
        }
    }
}

/// Price Feed Integration System
pub struct PriceFeedIntegrationSystem {
    config: PriceFeedIntegrationConfig,
    cache: Arc<RwLock<HashMap<String, CachedPriceData>>>,
    audit_cache: Arc<RwLock<HashMap<String, CachedAuditData>>>,
    http_client: reqwest::Client,
    anomaly_detector: Arc<AnomalyDetector>,
    oracle_providers: HashMap<OracleType, Box<dyn OracleProvider>>,
    audit_providers: HashMap<String, Box<dyn AuditDatabaseProvider>>,
}

/// Cached price data
#[derive(Debug, Clone)]
pub struct CachedPriceData {
    pub data: AggregatedPriceData,
    pub cached_at: DateTime<Utc>,
    pub expires_at: DateTime<Utc>,
}

/// Cached audit data
#[derive(Debug, Clone)]
pub struct CachedAuditData {
    pub entries: Vec<AuditEntry>,
    pub cached_at: DateTime<Utc>,
    pub expires_at: DateTime<Utc>,
}

/// Oracle provider trait
#[async_trait]
pub trait OracleProvider: Send + Sync {
    async fn get_price(&self, token_address: &str) -> Result<OracleResponse, Box<dyn std::error::Error + Send + Sync>>;
    async fn get_prices(&self, token_addresses: &[String]) -> Result<HashMap<String, OracleResponse>, Box<dyn std::error::Error + Send + Sync>>;
    fn get_oracle_type(&self) -> OracleType;
}

/// Audit database provider trait
#[async_trait]
pub trait AuditDatabaseProvider: Send + Sync {
    async fn get_audits(&self, protocol_name: &str) -> Result<Vec<AuditEntry>, Box<dyn std::error::Error + Send + Sync>>;
    async fn get_audits_by_severity(&self, severity: VulnerabilitySeverity) -> Result<Vec<AuditEntry>, Box<dyn std::error::Error + Send + Sync>>;
    async fn get_audits_by_category(&self, category: VulnerabilityCategory) -> Result<Vec<AuditEntry>, Box<dyn std::error::Error + Send + Sync>>;
    fn get_database_name(&self) -> String;
}

/// Anomaly detector
#[derive(Debug, Clone)]
pub struct AnomalyDetector {
    config: AnomalyDetectionConfig,
    price_history: Arc<RwLock<HashMap<String, Vec<EnhancedPriceData>>>>,
}

impl AnomalyDetector {
    pub fn new(config: AnomalyDetectionConfig) -> Self {
        Self {
            config,
            price_history: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    pub async fn detect_anomalies(&self, price_data: &EnhancedPriceData) -> Result<bool, Box<dyn std::error::Error + Send + Sync>> {
        let mut history = self.price_history.write().await;
        let token_history = history.entry(price_data.oracle_type.clone()).or_insert_with(Vec::new);
        
        // Add current price to history
        token_history.push(price_data.clone());
        
        // Keep only recent history
        let cutoff_time = Utc::now() - Duration::minutes(self.config.time_window_minutes as i64);
        token_history.retain(|p| p.timestamp >= cutoff_time);
        
        if token_history.len() < 2 {
            return Ok(false);
        }
        
        // Calculate price deviation
        let recent_prices: Vec<f64> = token_history.iter()
            .map(|p| p.price.to_f64().unwrap_or(0.0))
            .collect();
        
        let mean_price = recent_prices.iter().sum::<f64>() / recent_prices.len() as f64;
        let current_price = price_data.price.to_f64().unwrap_or(0.0);
        let deviation = (current_price - mean_price).abs() / mean_price;
        
        let is_anomalous = deviation > self.config.price_deviation_threshold;
        
        Ok(is_anomalous)
    }

    pub async fn calculate_anomaly_score(&self, price_data: &EnhancedPriceData) -> Result<f64, Box<dyn std::error::Error + Send + Sync>> {
        let mut history = self.price_history.read().await;
        if let Some(token_history) = history.get(&price_data.oracle_type) {
            if token_history.len() < 2 {
                return Ok(0.0);
            }
            
            let recent_prices: Vec<f64> = token_history.iter()
                .map(|p| p.price.to_f64().unwrap_or(0.0))
                .collect();
            
            let mean_price = recent_prices.iter().sum::<f64>() / recent_prices.len() as f64;
            let current_price = price_data.price.to_f64().unwrap_or(0.0);
            let deviation = (current_price - mean_price).abs() / mean_price;
            
            // Normalize to 0-1 range
            let score = (deviation / self.config.price_deviation_threshold).min(1.0);
            Ok(score)
        } else {
            Ok(0.0)
        }
    }
}

impl PriceFeedIntegrationSystem {
    pub fn new(config: PriceFeedIntegrationConfig) -> Result<Self, Box<dyn std::error::Error + Send + Sync>> {
        let http_client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(30))
            .build()?;

        let anomaly_detector = Arc::new(AnomalyDetector::new(config.anomaly_detection.clone()));
        
        let mut oracle_providers: HashMap<OracleType, Box<dyn OracleProvider>> = HashMap::new();
        let mut audit_providers: HashMap<String, Box<dyn AuditDatabaseProvider>> = HashMap::new();

        // Initialize oracle providers
        for oracle_config in &config.oracles {
            if oracle_config.enabled {
                let provider: Box<dyn OracleProvider> = match oracle_config.oracle_type {
                    OracleType::Chainlink => Box::new(ChainlinkProvider::new(oracle_config.clone())),
                    OracleType::Pyth => Box::new(PythProvider::new(oracle_config.clone())),
                    OracleType::Band => Box::new(BandProvider::new(oracle_config.clone())),
                    OracleType::Custom(_) => Box::new(CustomOracleProvider::new(oracle_config.clone())),
                };
                oracle_providers.insert(oracle_config.oracle_type.clone(), provider);
            }
        }

        // Initialize audit database providers
        for db_config in &config.audit_databases.databases {
            if db_config.enabled {
                let provider: Box<dyn AuditDatabaseProvider> = Box::new(GenericAuditProvider::new(db_config.clone()));
                audit_providers.insert(db_config.name.clone(), provider);
            }
        }

        Ok(Self {
            config,
            cache: Arc::new(RwLock::new(HashMap::new())),
            audit_cache: Arc::new(RwLock::new(HashMap::new())),
            http_client,
            anomaly_detector,
            oracle_providers,
            audit_providers,
        })
    }

    /// Get aggregated price data for a token
    pub async fn get_aggregated_price(&self, token_address: &str) -> Result<AggregatedPriceData, Box<dyn std::error::Error + Send + Sync>> {
        // Check cache first
        let cache_key = format!("price_{}", token_address);
        if let Some(cached_data) = self.get_cached_price(&cache_key).await? {
            return Ok(cached_data);
        }

        // Query all enabled oracles
        let mut oracle_responses = Vec::new();
        let mut successful_responses = Vec::new();

        for (oracle_type, provider) in &self.oracle_providers {
            match provider.get_price(token_address).await {
                Ok(response) => {
                    oracle_responses.push(response.clone());
                    if response.success {
                        successful_responses.push(response);
                    }
                }
                Err(e) => {
                    warn!("Oracle {} failed for token {}: {}", oracle_type, token_address, e);
                }
            }
        }

        if successful_responses.is_empty() {
            return Err("All oracles failed to provide price data".into());
        }

        // Aggregate prices
        let aggregated_data = self.aggregate_prices(&successful_responses).await?;
        
        // Cache the result
        self.cache_price(&cache_key, &aggregated_data).await?;
        
        Ok(aggregated_data)
    }

    /// Get audit data for a protocol
    pub async fn get_audit_data(&self, protocol_name: &str) -> Result<Vec<AuditEntry>, Box<dyn std::error::Error + Send + Sync>> {
        // Check cache first
        let cache_key = format!("audit_{}", protocol_name);
        if let Some(cached_data) = self.get_cached_audit(&cache_key).await? {
            return Ok(cached_data);
        }

        let mut all_audits = Vec::new();

        // Query all audit databases
        for (db_name, provider) in &self.audit_providers {
            match provider.get_audits(protocol_name).await {
                Ok(audits) => {
                    all_audits.extend(audits);
                }
                Err(e) => {
                    warn!("Audit database {} failed for protocol {}: {}", db_name, protocol_name, e);
                }
            }
        }

        // Cache the result
        self.cache_audit(&cache_key, &all_audits).await?;
        
        Ok(all_audits)
    }

    /// Aggregate prices from multiple oracles
    async fn aggregate_prices(&self, responses: &[OracleResponse]) -> Result<AggregatedPriceData, Box<dyn std::error::Error + Send + Sync>> {
        match self.config.aggregation_method {
            AggregationMethod::WeightedAverage => self.weighted_average_aggregation(responses).await,
            AggregationMethod::Median => self.median_aggregation(responses).await,
            AggregationMethod::TrimmedMean => self.trimmed_mean_aggregation(responses).await,
            AggregationMethod::Consensus => self.consensus_aggregation(responses).await,
            AggregationMethod::Custom(_) => self.weighted_average_aggregation(responses).await, // Default to weighted average
        }
    }

    /// Weighted average aggregation
    async fn weighted_average_aggregation(&self, responses: &[OracleResponse]) -> Result<AggregatedPriceData, Box<dyn std::error::Error + Send + Sync>> {
        let mut total_weighted_price = Decimal::ZERO;
        let mut total_weight = Decimal::ZERO;
        let mut total_confidence = 0.0;

        for response in responses {
            let weight = self.get_oracle_weight(&response.oracle_type).await?;
            let weighted_price = response.price * Decimal::from_f64(weight).unwrap_or(Decimal::ONE);
            total_weighted_price += weighted_price;
            total_weight += Decimal::from_f64(weight).unwrap_or(Decimal::ONE);
            total_confidence += response.confidence;
        }

        let aggregated_price = if total_weight > Decimal::ZERO {
            total_weighted_price / total_weight
        } else {
            Decimal::ZERO
        };

        let avg_confidence = total_confidence / responses.len() as f64;
        let price_deviation = self.calculate_price_deviation(responses, aggregated_price).await?;

        Ok(AggregatedPriceData {
            price: aggregated_price,
            timestamp: Utc::now(),
            confidence: avg_confidence,
            oracle_count: responses.len(),
            price_deviation,
            is_consensus: price_deviation < 0.02, // 2% deviation threshold for consensus
            fallback_used: false,
            oracle_responses: responses.to_vec(),
        })
    }

    /// Median aggregation
    async fn median_aggregation(&self, responses: &[OracleResponse]) -> Result<AggregatedPriceData, Box<dyn std::error::Error + Send + Sync>> {
        let mut prices: Vec<f64> = responses.iter()
            .map(|r| r.price.to_f64().unwrap_or(0.0))
            .collect();
        prices.sort_by(|a, b| a.partial_cmp(b).unwrap());

        let median_price = if prices.len() % 2 == 0 {
            let mid = prices.len() / 2;
            (prices[mid - 1] + prices[mid]) / 2.0
        } else {
            prices[prices.len() / 2]
        };

        let total_confidence: f64 = responses.iter().map(|r| r.confidence).sum();
        let avg_confidence = total_confidence / responses.len() as f64;
        let price_deviation = self.calculate_price_deviation(responses, Decimal::from_f64(median_price).unwrap_or(Decimal::ZERO)).await?;

        Ok(AggregatedPriceData {
            price: Decimal::from_f64(median_price).unwrap_or(Decimal::ZERO),
            timestamp: Utc::now(),
            confidence: avg_confidence,
            oracle_count: responses.len(),
            price_deviation,
            is_consensus: price_deviation < 0.02,
            fallback_used: false,
            oracle_responses: responses.to_vec(),
        })
    }

    /// Trimmed mean aggregation
    async fn trimmed_mean_aggregation(&self, responses: &[OracleResponse]) -> Result<AggregatedPriceData, Box<dyn std::error::Error + Send + Sync>> {
        let mut prices: Vec<f64> = responses.iter()
            .map(|r| r.price.to_f64().unwrap_or(0.0))
            .collect();
        prices.sort_by(|a, b| a.partial_cmp(b).unwrap());

        // Remove 10% from each end
        let trim_count = (prices.len() as f64 * 0.1) as usize;
        let trimmed_prices = &prices[trim_count..prices.len() - trim_count];

        let mean_price = if !trimmed_prices.is_empty() {
            trimmed_prices.iter().sum::<f64>() / trimmed_prices.len() as f64
        } else {
            0.0
        };

        let total_confidence: f64 = responses.iter().map(|r| r.confidence).sum();
        let avg_confidence = total_confidence / responses.len() as f64;
        let price_deviation = self.calculate_price_deviation(responses, Decimal::from_f64(mean_price).unwrap_or(Decimal::ZERO)).await?;

        Ok(AggregatedPriceData {
            price: Decimal::from_f64(mean_price).unwrap_or(Decimal::ZERO),
            timestamp: Utc::now(),
            confidence: avg_confidence,
            oracle_count: responses.len(),
            price_deviation,
            is_consensus: price_deviation < 0.02,
            fallback_used: false,
            oracle_responses: responses.to_vec(),
        })
    }

    /// Consensus aggregation
    async fn consensus_aggregation(&self, responses: &[OracleResponse]) -> Result<AggregatedPriceData, Box<dyn std::error::Error + Send + Sync>> {
        let prices: Vec<f64> = responses.iter()
            .map(|r| r.price.to_f64().unwrap_or(0.0))
            .collect();

        let mean_price = prices.iter().sum::<f64>() / prices.len() as f64;
        let price_deviation = self.calculate_price_deviation(responses, Decimal::from_f64(mean_price).unwrap_or(Decimal::ZERO)).await?;

        // Check if prices are within consensus threshold
        let consensus_threshold = 0.01; // 1%
        let is_consensus = price_deviation < consensus_threshold;

        let total_confidence: f64 = responses.iter().map(|r| r.confidence).sum();
        let avg_confidence = total_confidence / responses.len() as f64;

        Ok(AggregatedPriceData {
            price: Decimal::from_f64(mean_price).unwrap_or(Decimal::ZERO),
            timestamp: Utc::now(),
            confidence: avg_confidence,
            oracle_count: responses.len(),
            price_deviation,
            is_consensus,
            fallback_used: !is_consensus,
            oracle_responses: responses.to_vec(),
        })
    }

    /// Calculate price deviation
    async fn calculate_price_deviation(&self, responses: &[OracleResponse], aggregated_price: Decimal) -> Result<f64, Box<dyn std::error::Error + Send + Sync>> {
        let aggregated_f64 = aggregated_price.to_f64().unwrap_or(0.0);
        if aggregated_f64 == 0.0 {
            return Ok(0.0);
        }

        let deviations: Vec<f64> = responses.iter()
            .map(|r| {
                let price_f64 = r.price.to_f64().unwrap_or(0.0);
                (price_f64 - aggregated_f64).abs() / aggregated_f64
            })
            .collect();

        let avg_deviation = deviations.iter().sum::<f64>() / deviations.len() as f64;
        Ok(avg_deviation)
    }

    /// Get oracle weight
    async fn get_oracle_weight(&self, oracle_type: &OracleType) -> Result<f64, Box<dyn std::error::Error + Send + Sync>> {
        for oracle_config in &self.config.oracles {
            if oracle_config.oracle_type == *oracle_type {
                return Ok(oracle_config.weight);
            }
        }
        Ok(1.0) // Default weight
    }

    /// Get cached price data
    async fn get_cached_price(&self, cache_key: &str) -> Result<Option<AggregatedPriceData>, Box<dyn std::error::Error + Send + Sync>> {
        let cache = self.cache.read().await;
        if let Some(cached) = cache.get(cache_key) {
            if Utc::now() < cached.expires_at {
                return Ok(Some(cached.data.clone()));
            }
        }
        Ok(None)
    }

    /// Cache price data
    async fn cache_price(&self, cache_key: &str, data: &AggregatedPriceData) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let expires_at = Utc::now() + Duration::seconds(self.config.cache_duration_seconds as i64);
        let cached_data = CachedPriceData {
            data: data.clone(),
            cached_at: Utc::now(),
            expires_at,
        };
        
        let mut cache = self.cache.write().await;
        cache.insert(cache_key.to_string(), cached_data);
        Ok(())
    }

    /// Get cached audit data
    async fn get_cached_audit(&self, cache_key: &str) -> Result<Option<Vec<AuditEntry>>, Box<dyn std::error::Error + Send + Sync>> {
        let cache = self.audit_cache.read().await;
        if let Some(cached) = cache.get(cache_key) {
            if Utc::now() < cached.expires_at {
                return Ok(Some(cached.entries.clone()));
            }
        }
        Ok(None)
    }

    /// Cache audit data
    async fn cache_audit(&self, cache_key: &str, entries: &[AuditEntry]) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let expires_at = Utc::now() + Duration::hours(self.config.audit_databases.cache_duration_hours as i64);
        let cached_data = CachedAuditData {
            entries: entries.to_vec(),
            cached_at: Utc::now(),
            expires_at,
        };
        
        let mut cache = self.audit_cache.write().await;
        cache.insert(cache_key.to_string(), cached_data);
        Ok(())
    }

    /// Clear all caches
    pub async fn clear_caches(&self) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let mut price_cache = self.cache.write().await;
        price_cache.clear();
        
        let mut audit_cache = self.audit_cache.write().await;
        audit_cache.clear();
        
        info!("Price feed and audit caches cleared");
        Ok(())
    }

    /// Get cache statistics
    pub async fn get_cache_stats(&self) -> Result<HashMap<String, usize>, Box<dyn std::error::Error + Send + Sync>> {
        let price_cache = self.cache.read().await;
        let audit_cache = self.audit_cache.read().await;
        
        Ok(HashMap::from([
            ("price_cache_entries".to_string(), price_cache.len()),
            ("audit_cache_entries".to_string(), audit_cache.len()),
        ]))
    }
}

// Oracle provider implementations

/// Chainlink oracle provider
pub struct ChainlinkProvider {
    config: OracleConfig,
    http_client: reqwest::Client,
}

impl ChainlinkProvider {
    pub fn new(config: OracleConfig) -> Self {
        let http_client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(config.timeout_seconds))
            .build()
            .unwrap();

        Self { config, http_client }
    }
}

#[async_trait]
impl OracleProvider for ChainlinkProvider {
    async fn get_price(&self, token_address: &str) -> Result<OracleResponse, Box<dyn std::error::Error + Send + Sync>> {
        let start_time = std::time::Instant::now();
        
        // Simulate Chainlink API call
        let response = self.http_client
            .get(&format!("{}/v2/price/{}", self.config.endpoint, token_address))
            .send()
            .await;

        let response_time = start_time.elapsed().as_millis() as u64;

        match response {
            Ok(resp) => {
                if resp.status().is_success() {
                    let data: serde_json::Value = resp.json().await?;
                    
                    Ok(OracleResponse {
                        oracle_type: self.config.oracle_type.clone(),
                        price: Decimal::from_f64(data["price"].as_f64().unwrap_or(0.0)).unwrap_or(Decimal::ZERO),
                        timestamp: Utc::now(),
                        confidence: data["confidence"].as_f64().unwrap_or(0.8),
                        raw_data: data,
                        response_time_ms: response_time,
                        success: true,
                        error_message: None,
                    })
                } else {
                    Ok(OracleResponse {
                        oracle_type: self.config.oracle_type.clone(),
                        price: Decimal::ZERO,
                        timestamp: Utc::now(),
                        confidence: 0.0,
                        raw_data: serde_json::Value::Null,
                        response_time_ms: response_time,
                        success: false,
                        error_message: Some(format!("HTTP {}", resp.status())),
                    })
                }
            }
            Err(e) => Ok(OracleResponse {
                oracle_type: self.config.oracle_type.clone(),
                price: Decimal::ZERO,
                timestamp: Utc::now(),
                confidence: 0.0,
                raw_data: serde_json::Value::Null,
                response_time_ms: response_time,
                success: false,
                error_message: Some(e.to_string()),
            }),
        }
    }

    async fn get_prices(&self, token_addresses: &[String]) -> Result<HashMap<String, OracleResponse>, Box<dyn std::error::Error + Send + Sync>> {
        let mut results = HashMap::new();
        
        for token_address in token_addresses {
            let response = self.get_price(token_address).await?;
            results.insert(token_address.clone(), response);
        }
        
        Ok(results)
    }

    fn get_oracle_type(&self) -> OracleType {
        self.config.oracle_type.clone()
    }
}

/// Pyth oracle provider
pub struct PythProvider {
    config: OracleConfig,
    http_client: reqwest::Client,
}

impl PythProvider {
    pub fn new(config: OracleConfig) -> Self {
        let http_client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(config.timeout_seconds))
            .build()
            .unwrap();

        Self { config, http_client }
    }
}

#[async_trait]
impl OracleProvider for PythProvider {
    async fn get_price(&self, token_address: &str) -> Result<OracleResponse, Box<dyn std::error::Error + Send + Sync>> {
        let start_time = std::time::Instant::now();
        
        // Simulate Pyth API call
        let response = self.http_client
            .get(&format!("{}/api/price/{}", self.config.endpoint, token_address))
            .send()
            .await;

        let response_time = start_time.elapsed().as_millis() as u64;

        match response {
            Ok(resp) => {
                if resp.status().is_success() {
                    let data: serde_json::Value = resp.json().await?;
                    
                    Ok(OracleResponse {
                        oracle_type: self.config.oracle_type.clone(),
                        price: Decimal::from_f64(data["price"].as_f64().unwrap_or(0.0)).unwrap_or(Decimal::ZERO),
                        timestamp: Utc::now(),
                        confidence: data["confidence"].as_f64().unwrap_or(0.85),
                        raw_data: data,
                        response_time_ms: response_time,
                        success: true,
                        error_message: None,
                    })
                } else {
                    Ok(OracleResponse {
                        oracle_type: self.config.oracle_type.clone(),
                        price: Decimal::ZERO,
                        timestamp: Utc::now(),
                        confidence: 0.0,
                        raw_data: serde_json::Value::Null,
                        response_time_ms: response_time,
                        success: false,
                        error_message: Some(format!("HTTP {}", resp.status())),
                    })
                }
            }
            Err(e) => Ok(OracleResponse {
                oracle_type: self.config.oracle_type.clone(),
                price: Decimal::ZERO,
                timestamp: Utc::now(),
                confidence: 0.0,
                raw_data: serde_json::Value::Null,
                response_time_ms: response_time,
                success: false,
                error_message: Some(e.to_string()),
            }),
        }
    }

    async fn get_prices(&self, token_addresses: &[String]) -> Result<HashMap<String, OracleResponse>, Box<dyn std::error::Error + Send + Sync>> {
        let mut results = HashMap::new();
        
        for token_address in token_addresses {
            let response = self.get_price(token_address).await?;
            results.insert(token_address.clone(), response);
        }
        
        Ok(results)
    }

    fn get_oracle_type(&self) -> OracleType {
        self.config.oracle_type.clone()
    }
}

/// Band oracle provider
pub struct BandProvider {
    config: OracleConfig,
    http_client: reqwest::Client,
}

impl BandProvider {
    pub fn new(config: OracleConfig) -> Self {
        let http_client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(config.timeout_seconds))
            .build()
            .unwrap();

        Self { config, http_client }
    }
}

#[async_trait]
impl OracleProvider for BandProvider {
    async fn get_price(&self, token_address: &str) -> Result<OracleResponse, Box<dyn std::error::Error + Send + Sync>> {
        let start_time = std::time::Instant::now();
        
        // Simulate Band API call
        let response = self.http_client
            .get(&format!("{}/oracle/v1/price/{}", self.config.endpoint, token_address))
            .send()
            .await;

        let response_time = start_time.elapsed().as_millis() as u64;

        match response {
            Ok(resp) => {
                if resp.status().is_success() {
                    let data: serde_json::Value = resp.json().await?;
                    
                    Ok(OracleResponse {
                        oracle_type: self.config.oracle_type.clone(),
                        price: Decimal::from_f64(data["price"].as_f64().unwrap_or(0.0)).unwrap_or(Decimal::ZERO),
                        timestamp: Utc::now(),
                        confidence: data["confidence"].as_f64().unwrap_or(0.75),
                        raw_data: data,
                        response_time_ms: response_time,
                        success: true,
                        error_message: None,
                    })
                } else {
                    Ok(OracleResponse {
                        oracle_type: self.config.oracle_type.clone(),
                        price: Decimal::ZERO,
                        timestamp: Utc::now(),
                        confidence: 0.0,
                        raw_data: serde_json::Value::Null,
                        response_time_ms: response_time,
                        success: false,
                        error_message: Some(format!("HTTP {}", resp.status())),
                    })
                }
            }
            Err(e) => Ok(OracleResponse {
                oracle_type: self.config.oracle_type.clone(),
                price: Decimal::ZERO,
                timestamp: Utc::now(),
                confidence: 0.0,
                raw_data: serde_json::Value::Null,
                response_time_ms: response_time,
                success: false,
                error_message: Some(e.to_string()),
            }),
        }
    }

    async fn get_prices(&self, token_addresses: &[String]) -> Result<HashMap<String, OracleResponse>, Box<dyn std::error::Error + Send + Sync>> {
        let mut results = HashMap::new();
        
        for token_address in token_addresses {
            let response = self.get_price(token_address).await?;
            results.insert(token_address.clone(), response);
        }
        
        Ok(results)
    }

    fn get_oracle_type(&self) -> OracleType {
        self.config.oracle_type.clone()
    }
}

/// Custom oracle provider
pub struct CustomOracleProvider {
    config: OracleConfig,
    http_client: reqwest::Client,
}

impl CustomOracleProvider {
    pub fn new(config: OracleConfig) -> Self {
        let http_client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(config.timeout_seconds))
            .build()
            .unwrap();

        Self { config, http_client }
    }
}

#[async_trait]
impl OracleProvider for CustomOracleProvider {
    async fn get_price(&self, token_address: &str) -> Result<OracleResponse, Box<dyn std::error::Error + Send + Sync>> {
        let start_time = std::time::Instant::now();
        
        // Simulate custom API call
        let response = self.http_client
            .get(&format!("{}/price/{}", self.config.endpoint, token_address))
            .send()
            .await;

        let response_time = start_time.elapsed().as_millis() as u64;

        match response {
            Ok(resp) => {
                if resp.status().is_success() {
                    let data: serde_json::Value = resp.json().await?;
                    
                    Ok(OracleResponse {
                        oracle_type: self.config.oracle_type.clone(),
                        price: Decimal::from_f64(data["price"].as_f64().unwrap_or(0.0)).unwrap_or(Decimal::ZERO),
                        timestamp: Utc::now(),
                        confidence: data["confidence"].as_f64().unwrap_or(0.7),
                        raw_data: data,
                        response_time_ms: response_time,
                        success: true,
                        error_message: None,
                    })
                } else {
                    Ok(OracleResponse {
                        oracle_type: self.config.oracle_type.clone(),
                        price: Decimal::ZERO,
                        timestamp: Utc::now(),
                        confidence: 0.0,
                        raw_data: serde_json::Value::Null,
                        response_time_ms: response_time,
                        success: false,
                        error_message: Some(format!("HTTP {}", resp.status())),
                    })
                }
            }
            Err(e) => Ok(OracleResponse {
                oracle_type: self.config.oracle_type.clone(),
                price: Decimal::ZERO,
                timestamp: Utc::now(),
                confidence: 0.0,
                raw_data: serde_json::Value::Null,
                response_time_ms: response_time,
                success: false,
                error_message: Some(e.to_string()),
            }),
        }
    }

    async fn get_prices(&self, token_addresses: &[String]) -> Result<HashMap<String, OracleResponse>, Box<dyn std::error::Error + Send + Sync>> {
        let mut results = HashMap::new();
        
        for token_address in token_addresses {
            let response = self.get_price(token_address).await?;
            results.insert(token_address.clone(), response);
        }
        
        Ok(results)
    }

    fn get_oracle_type(&self) -> OracleType {
        self.config.oracle_type.clone()
    }
}

/// Generic audit database provider
pub struct GenericAuditProvider {
    config: AuditDatabase,
    http_client: reqwest::Client,
}

impl GenericAuditProvider {
    pub fn new(config: AuditDatabase) -> Self {
        let http_client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(30))
            .build()
            .unwrap();

        Self { config, http_client }
    }
}

#[async_trait]
impl AuditDatabaseProvider for GenericAuditProvider {
    async fn get_audits(&self, protocol_name: &str) -> Result<Vec<AuditEntry>, Box<dyn std::error::Error + Send + Sync>> {
        // Simulate audit database query
        let response = self.http_client
            .get(&format!("{}/api/audits/{}", self.config.endpoint, protocol_name))
            .send()
            .await;

        match response {
            Ok(resp) => {
                if resp.status().is_success() {
                    let data: Vec<serde_json::Value> = resp.json().await?;
                    
                    let mut audits = Vec::new();
                    for item in data {
                        audits.push(AuditEntry {
                            id: item["id"].as_str().unwrap_or("").to_string(),
                            protocol_name: protocol_name.to_string(),
                            audit_firm: self.config.name.clone(),
                            audit_date: Utc::now(), // Parse from item if available
                            severity: VulnerabilitySeverity::Medium, // Parse from item
                            category: VulnerabilityCategory::SmartContract, // Parse from item
                            title: item["title"].as_str().unwrap_or("").to_string(),
                            description: item["description"].as_str().unwrap_or("").to_string(),
                            impact: item["impact"].as_str().unwrap_or("").to_string(),
                            status: AuditStatus::Open, // Parse from item
                            remediation: item["remediation"].as_str().map(|s| s.to_string()),
                            cve_id: item["cve_id"].as_str().map(|s| s.to_string()),
                            references: Vec::new(), // Parse from item
                        });
                    }
                    
                    Ok(audits)
                } else {
                    Ok(Vec::new())
                }
            }
            Err(_) => Ok(Vec::new()),
        }
    }

    async fn get_audits_by_severity(&self, severity: VulnerabilitySeverity) -> Result<Vec<AuditEntry>, Box<dyn std::error::Error + Send + Sync>> {
        // Simulate severity-based query
        Ok(Vec::new())
    }

    async fn get_audits_by_category(&self, category: VulnerabilityCategory) -> Result<Vec<AuditEntry>, Box<dyn std::error::Error + Send + Sync>> {
        // Simulate category-based query
        Ok(Vec::new())
    }

    fn get_database_name(&self) -> String {
        self.config.name.clone()
    }
}

impl Default for PriceFeedIntegrationSystem {
    fn default() -> Self {
        Self::new(PriceFeedIntegrationConfig::default()).unwrap()
    }
}

impl Default for AnomalyDetector {
    fn default() -> Self {
        Self::new(AnomalyDetectionConfig {
            price_deviation_threshold: 0.05,
            volume_spike_threshold: 3.0,
            time_window_minutes: 60,
            confidence_threshold: 0.8,
            enable_machine_learning: false,
        })
    }
} 