use tokio_test;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use rust_decimal::Decimal;
use chrono::{Utc, Duration};
use tokio::time::{sleep, Duration as TokioDuration};

// Import Aegis satellite types and components
// Note: These imports will need to be adjusted based on the actual module structure
#[allow(dead_code)]
mod aegis_types {
    use serde::{Deserialize, Serialize};
    use rust_decimal::Decimal;
    use std::collections::HashMap;
    use chrono::{DateTime, Utc};
    
    pub type TokenAddress = String;
    pub type PriceFeedId = String;
    
    #[derive(Debug, Clone, Serialize, Deserialize)]
    pub struct PriceData {
        pub token_address: TokenAddress,
        pub price_usd: Decimal,
        pub timestamp: DateTime<Utc>,
        pub source: String,
        pub confidence: f64,
        pub volume_24h: Option<Decimal>,
        pub price_change_24h: Option<Decimal>,
    }
    
    #[derive(Debug, Clone)]
    pub struct PriceFeedConfig {
        pub update_interval_seconds: u64,
        pub price_sources: Vec<PriceSource>,
        pub staleness_threshold_seconds: u64,
        pub min_confidence_threshold: f64,
        pub max_price_deviation_percent: f64,
        pub circuit_breaker_enabled: bool,
        pub fallback_sources: Vec<PriceSource>,
    }
    
    #[derive(Debug, Clone, Serialize, Deserialize)]
    pub struct PriceSource {
        pub id: String,
        pub name: String,
        pub url: String,
        pub weight: f64,
        pub enabled: bool,
        pub api_key_required: bool,
        pub rate_limit_per_minute: u32,
    }
    
    #[derive(Debug, Clone)]
    pub struct AggregatedPrice {
        pub token_address: TokenAddress,
        pub weighted_price: Decimal,
        pub individual_prices: Vec<PriceData>,
        pub confidence_score: f64,
        pub price_deviation_percent: f64,
        pub calculated_at: DateTime<Utc>,
        pub is_stale: bool,
        pub circuit_breaker_triggered: bool,
    }
    
    #[derive(Debug, Clone)]
    pub struct PriceFeedMetrics {
        pub total_price_updates: u64,
        pub successful_updates: u64,
        pub failed_updates: u64,
        pub average_update_latency_ms: f64,
        pub stale_prices_count: u64,
        pub circuit_breaker_triggers: u64,
        pub last_update: DateTime<Utc>,
        pub sources_status: HashMap<String, SourceStatus>,
    }
    
    #[derive(Debug, Clone)]
    pub struct SourceStatus {
        pub is_healthy: bool,
        pub last_successful_update: DateTime<Utc>,
        pub consecutive_failures: u32,
        pub success_rate_24h: f64,
    }
    
    #[derive(Debug, thiserror::Error)]
    pub enum PriceFeedError {
        #[error("Price source unavailable: {0}")]
        SourceUnavailable(String),
        #[error("Price data stale for token: {0}")]
        StalePriceData(TokenAddress),
        #[error("Price aggregation failed: {0}")]
        AggregationFailed(String),
        #[error("Circuit breaker triggered for token: {0}")]
        CircuitBreakerTriggered(TokenAddress),
        #[error("Invalid price data: {0}")]
        InvalidPriceData(String),
        #[error("Rate limit exceeded for source: {0}")]
        RateLimitExceeded(String),
        #[error("API error: {0}")]
        ApiError(String),
    }
    
    impl Default for PriceFeedConfig {
        fn default() -> Self {
            Self {
                update_interval_seconds: 10,
                price_sources: vec![
                    PriceSource {
                        id: "coinbase".to_string(),
                        name: "Coinbase Pro".to_string(),
                        url: "https://api.coinbase.com/v2/prices".to_string(),
                        weight: 0.3,
                        enabled: true,
                        api_key_required: false,
                        rate_limit_per_minute: 10,
                    },
                    PriceSource {
                        id: "binance".to_string(),
                        name: "Binance".to_string(),
                        url: "https://api.binance.com/api/v3/ticker/price".to_string(),
                        weight: 0.3,
                        enabled: true,
                        api_key_required: false,
                        rate_limit_per_minute: 20,
                    },
                    PriceSource {
                        id: "chainlink".to_string(),
                        name: "Chainlink".to_string(),
                        url: "https://api.chain.link/v1/prices".to_string(),
                        weight: 0.4,
                        enabled: true,
                        api_key_required: true,
                        rate_limit_per_minute: 100,
                    },
                ],
                staleness_threshold_seconds: 300, // 5 minutes
                min_confidence_threshold: 0.8,
                max_price_deviation_percent: 5.0,
                circuit_breaker_enabled: true,
                fallback_sources: vec![],
            }
        }
    }
}

use aegis_types::*;

/// Mock price feed for testing
pub struct MockPriceFeed {
    config: PriceFeedConfig,
    cached_prices: Arc<RwLock<HashMap<TokenAddress, AggregatedPrice>>>,
    source_data: Arc<RwLock<HashMap<String, Vec<PriceData>>>>,
    metrics: Arc<RwLock<PriceFeedMetrics>>,
    circuit_breaker_status: Arc<RwLock<HashMap<TokenAddress, bool>>>,
    is_running: Arc<RwLock<bool>>,
}

impl MockPriceFeed {
    fn new(config: PriceFeedConfig) -> Self {
        let source_status: HashMap<String, SourceStatus> = config.price_sources.iter()
            .map(|source| (source.id.clone(), SourceStatus {
                is_healthy: true,
                last_successful_update: Utc::now(),
                consecutive_failures: 0,
                success_rate_24h: 100.0,
            }))
            .collect();
            
        Self {
            config,
            cached_prices: Arc::new(RwLock::new(HashMap::new())),
            source_data: Arc::new(RwLock::new(HashMap::new())),
            metrics: Arc::new(RwLock::new(PriceFeedMetrics {
                total_price_updates: 0,
                successful_updates: 0,
                failed_updates: 0,
                average_update_latency_ms: 0.0,
                stale_prices_count: 0,
                circuit_breaker_triggers: 0,
                last_update: Utc::now(),
                sources_status: source_status,
            })),
            circuit_breaker_status: Arc::new(RwLock::new(HashMap::new())),
            is_running: Arc::new(RwLock::new(false)),
        }
    }
    
    async fn start(&self) -> Result<(), PriceFeedError> {
        let mut is_running = self.is_running.write().await;
        *is_running = true;
        Ok(())
    }
    
    async fn stop(&self) -> Result<(), PriceFeedError> {
        let mut is_running = self.is_running.write().await;
        *is_running = false;
        Ok(())
    }
    
    async fn is_running(&self) -> bool {
        *self.is_running.read().await
    }
    
    // Mock method to add price data from a specific source
    async fn add_source_price(&self, source_id: &str, price_data: PriceData) {
        let mut source_data = self.source_data.write().await;
        source_data.entry(source_id.to_string())
            .or_insert_with(Vec::new)
            .push(price_data);
    }
    
    async fn get_price(&self, token_address: &str) -> Result<AggregatedPrice, PriceFeedError> {
        let cached_prices = self.cached_prices.read().await;
        
        if let Some(cached_price) = cached_prices.get(token_address) {
            // Check if price is stale
            let now = Utc::now();
            let age_seconds = (now - cached_price.calculated_at).num_seconds();
            
            if age_seconds > self.config.staleness_threshold_seconds as i64 {
                return Err(PriceFeedError::StalePriceData(token_address.to_string()));
            }
            
            // Check circuit breaker
            if cached_price.circuit_breaker_triggered {
                return Err(PriceFeedError::CircuitBreakerTriggered(token_address.to_string()));
            }
            
            Ok(cached_price.clone())
        } else {
            // Try to fetch fresh price
            self.fetch_and_aggregate_price(token_address).await
        }
    }
    
    async fn fetch_and_aggregate_price(&self, token_address: &str) -> Result<AggregatedPrice, PriceFeedError> {
        let source_data = self.source_data.read().await;
        let mut individual_prices = Vec::new();
        let mut total_weighted_price = Decimal::ZERO;
        let mut total_weight = 0.0;
        
        // Collect prices from all enabled sources
        for source in &self.config.price_sources {
            if !source.enabled {
                continue;
            }
            
            if let Some(prices) = source_data.get(&source.id) {
                if let Some(latest_price) = prices.iter()
                    .filter(|p| p.token_address == token_address)
                    .max_by_key(|p| p.timestamp) {
                    
                    individual_prices.push(latest_price.clone());
                    total_weighted_price += latest_price.price_usd * Decimal::from_f64(source.weight).unwrap();
                    total_weight += source.weight;
                }
            }
        }
        
        if individual_prices.is_empty() {
            return Err(PriceFeedError::AggregationFailed("No price data available".to_string()));
        }
        
        let weighted_price = total_weighted_price / Decimal::from_f64(total_weight).unwrap();
        
        // Calculate price deviation
        let prices: Vec<Decimal> = individual_prices.iter().map(|p| p.price_usd).collect();
        let max_price = prices.iter().max().unwrap();
        let min_price = prices.iter().min().unwrap();
        let price_deviation_percent = if *max_price > Decimal::ZERO {
            ((*max_price - *min_price) / *max_price * Decimal::from(100)).to_f64().unwrap_or(0.0)
        } else {
            0.0
        };
        
        // Check circuit breaker
        let circuit_breaker_triggered = self.config.circuit_breaker_enabled && 
            price_deviation_percent > self.config.max_price_deviation_percent;
        
        // Calculate confidence score based on number of sources and price deviation
        let confidence_score = if individual_prices.len() >= 3 && price_deviation_percent < 2.0 {
            0.95
        } else if individual_prices.len() >= 2 && price_deviation_percent < 5.0 {
            0.8
        } else {
            0.6
        };
        
        let aggregated_price = AggregatedPrice {
            token_address: token_address.to_string(),
            weighted_price,
            individual_prices,
            confidence_score,
            price_deviation_percent,
            calculated_at: Utc::now(),
            is_stale: false,
            circuit_breaker_triggered,
        };
        
        // Cache the price
        let mut cached_prices = self.cached_prices.write().await;
        cached_prices.insert(token_address.to_string(), aggregated_price.clone());
        
        // Update metrics
        self.update_metrics(true).await;
        
        if circuit_breaker_triggered {
            Err(PriceFeedError::CircuitBreakerTriggered(token_address.to_string()))
        } else {
            Ok(aggregated_price)
        }
    }
    
    async fn get_multiple_prices(&self, token_addresses: &[&str]) -> HashMap<String, Result<AggregatedPrice, PriceFeedError>> {
        let mut results = HashMap::new();
        
        for &token_address in token_addresses {
            let result = self.get_price(token_address).await;
            results.insert(token_address.to_string(), result);
        }
        
        results
    }
    
    async fn update_metrics(&self, success: bool) {
        let mut metrics = self.metrics.write().await;
        metrics.total_price_updates += 1;
        metrics.last_update = Utc::now();
        
        if success {
            metrics.successful_updates += 1;
        } else {
            metrics.failed_updates += 1;
        }
        
        // Update average latency (mock calculation)
        metrics.average_update_latency_ms = (metrics.average_update_latency_ms * 0.9) + (50.0 * 0.1);
    }
    
    async fn get_metrics(&self) -> PriceFeedMetrics {
        self.metrics.read().await.clone()
    }
    
    async fn force_refresh(&self, token_address: &str) -> Result<AggregatedPrice, PriceFeedError> {
        // Clear cached price to force refresh
        let mut cached_prices = self.cached_prices.write().await;
        cached_prices.remove(token_address);
        drop(cached_prices);
        
        self.fetch_and_aggregate_price(token_address).await
    }
    
    async fn reset_circuit_breaker(&self, token_address: &str) -> Result<(), PriceFeedError> {
        let mut circuit_breaker_status = self.circuit_breaker_status.write().await;
        circuit_breaker_status.insert(token_address.to_string(), false);
        
        // Also update cached price
        let mut cached_prices = self.cached_prices.write().await;
        if let Some(cached_price) = cached_prices.get_mut(token_address) {
            cached_price.circuit_breaker_triggered = false;
        }
        
        Ok(())
    }
    
    async fn check_source_health(&self, source_id: &str) -> Result<SourceStatus, PriceFeedError> {
        let metrics = self.metrics.read().await;
        
        if let Some(status) = metrics.sources_status.get(source_id) {
            Ok(status.clone())
        } else {
            Err(PriceFeedError::SourceUnavailable(source_id.to_string()))
        }
    }
    
    // Mock method to simulate source failure
    async fn simulate_source_failure(&self, source_id: &str) {
        let mut metrics = self.metrics.write().await;
        if let Some(status) = metrics.sources_status.get_mut(source_id) {
            status.is_healthy = false;
            status.consecutive_failures += 1;
            status.success_rate_24h = std::cmp::max(0.0, status.success_rate_24h - 10.0);
        }
    }
    
    // Mock method to simulate source recovery
    async fn simulate_source_recovery(&self, source_id: &str) {
        let mut metrics = self.metrics.write().await;
        if let Some(status) = metrics.sources_status.get_mut(source_id) {
            status.is_healthy = true;
            status.consecutive_failures = 0;
            status.last_successful_update = Utc::now();
            status.success_rate_24h = std::cmp::min(100.0, status.success_rate_24h + 20.0);
        }
    }
}

#[cfg(test)]
mod price_feed_tests {
    use super::*;
    use tokio_test;
    
    #[tokio::test]
    async fn test_price_feed_creation() {
        let config = PriceFeedConfig::default();
        let price_feed = MockPriceFeed::new(config);
        
        assert!(!price_feed.is_running().await);
        
        let metrics = price_feed.get_metrics().await;
        assert_eq!(metrics.total_price_updates, 0);
        assert_eq!(metrics.successful_updates, 0);
        assert_eq!(metrics.failed_updates, 0);
        assert_eq!(metrics.sources_status.len(), 3); // Default has 3 sources
    }
    
    #[tokio::test]
    async fn test_start_stop_price_feed() {
        let config = PriceFeedConfig::default();
        let price_feed = MockPriceFeed::new(config);
        
        // Start price feed
        price_feed.start().await.unwrap();
        assert!(price_feed.is_running().await);
        
        // Stop price feed
        price_feed.stop().await.unwrap();
        assert!(!price_feed.is_running().await);
    }
    
    #[tokio::test]
    async fn test_single_source_price_aggregation() {
        let config = PriceFeedConfig::default();
        let price_feed = MockPriceFeed::new(config);
        
        // Add price data from single source
        let price_data = PriceData {
            token_address: "ETH".to_string(),
            price_usd: Decimal::from(2000),
            timestamp: Utc::now(),
            source: "coinbase".to_string(),
            confidence: 0.95,
            volume_24h: Some(Decimal::from(1000000)),
            price_change_24h: Some(Decimal::from_str("2.5").unwrap()),
        };
        
        price_feed.add_source_price("coinbase", price_data).await;
        
        let aggregated_price = price_feed.get_price("ETH").await.unwrap();
        
        assert_eq!(aggregated_price.token_address, "ETH");
        assert_eq!(aggregated_price.weighted_price, Decimal::from(2000));
        assert_eq!(aggregated_price.individual_prices.len(), 1);
        assert!(!aggregated_price.is_stale);
        assert!(!aggregated_price.circuit_breaker_triggered);
    }
    
    #[tokio::test]
    async fn test_multiple_source_price_aggregation() {
        let config = PriceFeedConfig::default();
        let price_feed = MockPriceFeed::new(config);
        
        // Add price data from multiple sources
        let coinbase_price = PriceData {
            token_address: "ETH".to_string(),
            price_usd: Decimal::from(2000),
            timestamp: Utc::now(),
            source: "coinbase".to_string(),
            confidence: 0.95,
            volume_24h: Some(Decimal::from(1000000)),
            price_change_24h: Some(Decimal::from_str("2.5").unwrap()),
        };
        
        let binance_price = PriceData {
            token_address: "ETH".to_string(),
            price_usd: Decimal::from(1995),
            timestamp: Utc::now(),
            source: "binance".to_string(),
            confidence: 0.92,
            volume_24h: Some(Decimal::from(800000)),
            price_change_24h: Some(Decimal::from_str("2.3").unwrap()),
        };
        
        let chainlink_price = PriceData {
            token_address: "ETH".to_string(),
            price_usd: Decimal::from(2005),
            timestamp: Utc::now(),
            source: "chainlink".to_string(),
            confidence: 0.98,
            volume_24h: None,
            price_change_24h: Some(Decimal::from_str("2.7").unwrap()),
        };
        
        price_feed.add_source_price("coinbase", coinbase_price).await;
        price_feed.add_source_price("binance", binance_price).await;
        price_feed.add_source_price("chainlink", chainlink_price).await;
        
        let aggregated_price = price_feed.get_price("ETH").await.unwrap();
        
        assert_eq!(aggregated_price.token_address, "ETH");
        assert_eq!(aggregated_price.individual_prices.len(), 3);
        
        // Weighted average: (2000*0.3 + 1995*0.3 + 2005*0.4) = 2000.5
        let expected_price = Decimal::from_str("2000.5").unwrap();
        assert_eq!(aggregated_price.weighted_price, expected_price);
        
        assert!(aggregated_price.confidence_score > 0.9); // High confidence with 3 sources
        assert!(aggregated_price.price_deviation_percent < 1.0); // Low deviation
    }
    
    #[tokio::test]
    async fn test_price_staleness_detection() {
        let config = PriceFeedConfig {
            staleness_threshold_seconds: 1, // Very short threshold for testing
            ..PriceFeedConfig::default()
        };
        let price_feed = MockPriceFeed::new(config);
        
        // Add old price data
        let old_price = PriceData {
            token_address: "BTC".to_string(),
            price_usd: Decimal::from(50000),
            timestamp: Utc::now() - Duration::seconds(2), // 2 seconds old
            source: "coinbase".to_string(),
            confidence: 0.95,
            volume_24h: Some(Decimal::from(500000)),
            price_change_24h: Some(Decimal::from_str("-1.2").unwrap()),
        };
        
        price_feed.add_source_price("coinbase", old_price).await;
        
        // First call should work (caches the price)
        let result1 = price_feed.get_price("BTC").await;
        assert!(result1.is_ok());
        
        // Wait for price to become stale
        sleep(TokioDuration::from_secs(2)).await;
        
        // Second call should fail due to staleness
        let result2 = price_feed.get_price("BTC").await;
        assert!(result2.is_err());
        assert!(matches!(result2.unwrap_err(), PriceFeedError::StalePriceData(_)));
    }
    
    #[tokio::test]
    async fn test_circuit_breaker_triggering() {
        let config = PriceFeedConfig {
            max_price_deviation_percent: 2.0, // Low threshold for testing
            circuit_breaker_enabled: true,
            ..PriceFeedConfig::default()
        };
        let price_feed = MockPriceFeed::new(config);
        
        // Add price data with high deviation
        let coinbase_price = PriceData {
            token_address: "VOLATILE".to_string(),
            price_usd: Decimal::from(100),
            timestamp: Utc::now(),
            source: "coinbase".to_string(),
            confidence: 0.95,
            volume_24h: Some(Decimal::from(10000)),
            price_change_24h: Some(Decimal::from_str("5.0").unwrap()),
        };
        
        let binance_price = PriceData {
            token_address: "VOLATILE".to_string(),
            price_usd: Decimal::from(110), // 10% higher - should trigger circuit breaker
            timestamp: Utc::now(),
            source: "binance".to_string(),
            confidence: 0.92,
            volume_24h: Some(Decimal::from(8000)),
            price_change_24h: Some(Decimal::from_str("5.5").unwrap()),
        };
        
        price_feed.add_source_price("coinbase", coinbase_price).await;
        price_feed.add_source_price("binance", binance_price).await;
        
        let result = price_feed.get_price("VOLATILE").await;
        
        assert!(result.is_err());
        assert!(matches!(result.unwrap_err(), PriceFeedError::CircuitBreakerTriggered(_)));
    }
    
    #[tokio::test]
    async fn test_circuit_breaker_reset() {
        let config = PriceFeedConfig {
            max_price_deviation_percent: 2.0,
            circuit_breaker_enabled: true,
            ..PriceFeedConfig::default()
        };
        let price_feed = MockPriceFeed::new(config);
        
        // Add price data that triggers circuit breaker
        let price1 = PriceData {
            token_address: "TEST".to_string(),
            price_usd: Decimal::from(100),
            timestamp: Utc::now(),
            source: "coinbase".to_string(),
            confidence: 0.95,
            volume_24h: Some(Decimal::from(10000)),
            price_change_24h: Some(Decimal::from_str("0.0").unwrap()),
        };
        
        let price2 = PriceData {
            token_address: "TEST".to_string(),
            price_usd: Decimal::from(110),
            timestamp: Utc::now(),
            source: "binance".to_string(),
            confidence: 0.92,
            volume_24h: Some(Decimal::from(8000)),
            price_change_24h: Some(Decimal::from_str("0.0").unwrap()),
        };
        
        price_feed.add_source_price("coinbase", price1).await;
        price_feed.add_source_price("binance", price2).await;
        
        // Should trigger circuit breaker
        let result1 = price_feed.get_price("TEST").await;
        assert!(result1.is_err());
        
        // Reset circuit breaker
        price_feed.reset_circuit_breaker("TEST").await.unwrap();
        
        // Should work now (but still return the aggregated price with circuit breaker flag)
        let result2 = price_feed.get_price("TEST").await;
        assert!(result2.is_ok());
        let price = result2.unwrap();
        assert!(!price.circuit_breaker_triggered);
    }
    
    #[tokio::test]
    async fn test_multiple_token_price_fetching() {
        let config = PriceFeedConfig::default();
        let price_feed = MockPriceFeed::new(config);
        
        // Add price data for multiple tokens
        let tokens = ["ETH", "BTC", "USDC"];
        let base_prices = [2000, 50000, 1];
        
        for (i, &token) in tokens.iter().enumerate() {
            let price_data = PriceData {
                token_address: token.to_string(),
                price_usd: Decimal::from(base_prices[i]),
                timestamp: Utc::now(),
                source: "coinbase".to_string(),
                confidence: 0.95,
                volume_24h: Some(Decimal::from(100000)),
                price_change_24h: Some(Decimal::from_str("1.0").unwrap()),
            };
            
            price_feed.add_source_price("coinbase", price_data).await;
        }
        
        let results = price_feed.get_multiple_prices(&tokens).await;
        
        assert_eq!(results.len(), 3);
        
        for &token in &tokens {
            assert!(results.contains_key(token));
            assert!(results[token].is_ok());
        }
        
        // Verify specific prices
        assert_eq!(results["ETH"].as_ref().unwrap().weighted_price, Decimal::from(2000));
        assert_eq!(results["BTC"].as_ref().unwrap().weighted_price, Decimal::from(50000));
        assert_eq!(results["USDC"].as_ref().unwrap().weighted_price, Decimal::from(1));
    }
    
    #[tokio::test]
    async fn test_force_refresh() {
        let config = PriceFeedConfig::default();
        let price_feed = MockPriceFeed::new(config);
        
        // Add initial price data
        let initial_price = PriceData {
            token_address: "ETH".to_string(),
            price_usd: Decimal::from(2000),
            timestamp: Utc::now(),
            source: "coinbase".to_string(),
            confidence: 0.95,
            volume_24h: Some(Decimal::from(100000)),
            price_change_24h: Some(Decimal::from_str("1.0").unwrap()),
        };
        
        price_feed.add_source_price("coinbase", initial_price).await;
        
        // Get price (this caches it)
        let cached_price = price_feed.get_price("ETH").await.unwrap();
        assert_eq!(cached_price.weighted_price, Decimal::from(2000));
        
        // Add updated price data
        let updated_price = PriceData {
            token_address: "ETH".to_string(),
            price_usd: Decimal::from(2100),
            timestamp: Utc::now(),
            source: "coinbase".to_string(),
            confidence: 0.95,
            volume_24h: Some(Decimal::from(110000)),
            price_change_24h: Some(Decimal::from_str("5.0").unwrap()),
        };
        
        price_feed.add_source_price("coinbase", updated_price).await;
        
        // Force refresh should get the new price
        let refreshed_price = price_feed.force_refresh("ETH").await.unwrap();
        assert_eq!(refreshed_price.weighted_price, Decimal::from(2100));
    }
    
    #[tokio::test]
    async fn test_source_health_monitoring() {
        let config = PriceFeedConfig::default();
        let price_feed = MockPriceFeed::new(config);
        
        // Initially all sources should be healthy
        let initial_status = price_feed.check_source_health("coinbase").await.unwrap();
        assert!(initial_status.is_healthy);
        assert_eq!(initial_status.consecutive_failures, 0);
        assert_eq!(initial_status.success_rate_24h, 100.0);
        
        // Simulate source failure
        price_feed.simulate_source_failure("coinbase").await;
        
        let failed_status = price_feed.check_source_health("coinbase").await.unwrap();
        assert!(!failed_status.is_healthy);
        assert_eq!(failed_status.consecutive_failures, 1);
        assert!(failed_status.success_rate_24h < 100.0);
        
        // Simulate source recovery
        price_feed.simulate_source_recovery("coinbase").await;
        
        let recovered_status = price_feed.check_source_health("coinbase").await.unwrap();
        assert!(recovered_status.is_healthy);
        assert_eq!(recovered_status.consecutive_failures, 0);
    }
    
    #[tokio::test]
    async fn test_metrics_tracking() {
        let config = PriceFeedConfig::default();
        let price_feed = MockPriceFeed::new(config);
        
        // Add some price data and fetch prices
        let price_data = PriceData {
            token_address: "ETH".to_string(),
            price_usd: Decimal::from(2000),
            timestamp: Utc::now(),
            source: "coinbase".to_string(),
            confidence: 0.95,
            volume_24h: Some(Decimal::from(100000)),
            price_change_24h: Some(Decimal::from_str("1.0").unwrap()),
        };
        
        price_feed.add_source_price("coinbase", price_data).await;
        
        // Fetch price multiple times
        for _ in 0..5 {
            let _ = price_feed.get_price("ETH").await;
        }
        
        let metrics = price_feed.get_metrics().await;
        
        assert!(metrics.total_price_updates > 0);
        assert!(metrics.successful_updates > 0);
        assert!(metrics.average_update_latency_ms > 0.0);
        assert!(metrics.last_update <= Utc::now());
    }
    
    #[tokio::test]
    async fn test_price_not_found() {
        let config = PriceFeedConfig::default();
        let price_feed = MockPriceFeed::new(config);
        
        let result = price_feed.get_price("NONEXISTENT").await;
        
        assert!(result.is_err());
        assert!(matches!(result.unwrap_err(), PriceFeedError::AggregationFailed(_)));
    }
    
    #[tokio::test]
    async fn test_confidence_scoring() {
        let config = PriceFeedConfig::default();
        let price_feed = MockPriceFeed::new(config);
        
        // Test high confidence with 3 sources and low deviation
        let prices = vec![
            ("coinbase", 2000.0),
            ("binance", 2001.0),
            ("chainlink", 1999.0),
        ];
        
        for (source, price) in prices {
            let price_data = PriceData {
                token_address: "ETH".to_string(),
                price_usd: Decimal::from_f64(price).unwrap(),
                timestamp: Utc::now(),
                source: source.to_string(),
                confidence: 0.95,
                volume_24h: Some(Decimal::from(100000)),
                price_change_24h: Some(Decimal::from_str("1.0").unwrap()),
            };
            
            price_feed.add_source_price(source, price_data).await;
        }
        
        let aggregated_price = price_feed.get_price("ETH").await.unwrap();
        
        // Should have high confidence due to 3 sources with low deviation
        assert!(aggregated_price.confidence_score > 0.9);
        assert!(aggregated_price.price_deviation_percent < 1.0);
    }
    
    #[tokio::test]
    async fn test_performance_multiple_concurrent_requests() {
        let config = PriceFeedConfig::default();
        let price_feed = Arc::new(MockPriceFeed::new(config));
        
        // Add price data for multiple tokens
        for i in 1..=100 {
            let token = format!("TOKEN{}", i);
            let price_data = PriceData {
                token_address: token.clone(),
                price_usd: Decimal::from(100 + i),
                timestamp: Utc::now(),
                source: "coinbase".to_string(),
                confidence: 0.95,
                volume_24h: Some(Decimal::from(10000)),
                price_change_24h: Some(Decimal::from_str("1.0").unwrap()),
            };
            
            price_feed.add_source_price("coinbase", price_data).await;
        }
        
        let start_time = std::time::Instant::now();
        
        // Create concurrent requests
        let mut handles = Vec::new();
        for i in 1..=100 {
            let price_feed_clone = Arc::clone(&price_feed);
            let token = format!("TOKEN{}", i);
            
            let handle = tokio::spawn(async move {
                price_feed_clone.get_price(&token).await
            });
            
            handles.push(handle);
        }
        
        // Wait for all requests to complete
        let results = futures::future::join_all(handles).await;
        
        let duration = start_time.elapsed();
        
        // Should complete 100 concurrent requests in under 1 second
        assert!(duration.as_millis() < 1000, "Concurrent requests took {}ms, should be <1000ms", duration.as_millis());
        
        // All requests should succeed
        for result in results {
            assert!(result.is_ok());
            assert!(result.unwrap().is_ok());
        }
    }
}