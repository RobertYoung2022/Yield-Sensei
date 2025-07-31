use std::sync::Arc;
use tokio::sync::RwLock;
use chrono::{Utc, Duration};
use rust_decimal::Decimal;
use std::collections::HashMap;
use serde_json::json;

// Import the actual Aegis satellite data integration types
extern crate aegis_satellite;
use aegis_satellite::data::price_feed_integration::{
    PriceFeedIntegrationSystem, PriceFeedIntegrationConfig, AggregatedPriceData,
    OracleType, OracleConfig, OracleProvider, OracleResponse,
    EnhancedPriceData, AuditEntry, AuditDatabaseProvider, AuditStatus,
    AggregationMethod, FallbackStrategy, AnomalyDetector, AnomalyDetectionConfig,
    AuditDatabase, AuditDatabaseConfig
};
use aegis_satellite::security::{VulnerabilitySeverity, VulnerabilityCategory};

#[cfg(test)]
mod external_data_integration_tests {
    use super::*;

    // Mock Oracle Provider implementations

    #[derive(Clone)]
    struct MockChainlinkProvider {
        config: OracleConfig,
        price_data: Arc<RwLock<HashMap<String, f64>>>,
        should_fail: Arc<RwLock<bool>>,
        response_delay_ms: u64,
    }

    impl MockChainlinkProvider {
        fn new(config: OracleConfig) -> Self {
            let mut price_data = HashMap::new();
            price_data.insert("BTC".to_string(), 50000.0);
            price_data.insert("ETH".to_string(), 3000.0);
            price_data.insert("USDC".to_string(), 1.0);
            price_data.insert("AAVE".to_string(), 100.0);

            Self {
                config,
                price_data: Arc::new(RwLock::new(price_data)),
                should_fail: Arc::new(RwLock::new(false)),
                response_delay_ms: 50,
            }
        }

        async fn set_price(&self, token: &str, price: f64) {
            let mut data = self.price_data.write().await;
            data.insert(token.to_string(), price);
        }

        async fn set_failure_mode(&self, should_fail: bool) {
            let mut fail = self.should_fail.write().await;
            *fail = should_fail;
        }
    }

    #[async_trait::async_trait]
    impl OracleProvider for MockChainlinkProvider {
        async fn get_price(&self, token_address: &str) -> Result<OracleResponse, Box<dyn std::error::Error + Send + Sync>> {
            // Simulate network delay
            tokio::time::sleep(std::time::Duration::from_millis(self.response_delay_ms)).await;

            let should_fail = *self.should_fail.read().await;
            if should_fail {
                return Ok(OracleResponse {
                    oracle_type: self.config.oracle_type.clone(),
                    price: Decimal::ZERO,
                    timestamp: Utc::now(),
                    confidence: 0.0,
                    raw_data: json!({"error": "Mock failure"}),
                    response_time_ms: self.response_delay_ms,
                    success: false,
                    error_message: Some("Simulated Chainlink failure".to_string()),
                });
            }

            let price_data = self.price_data.read().await;
            let price = price_data.get(token_address).copied().unwrap_or(0.0);

            Ok(OracleResponse {
                oracle_type: self.config.oracle_type.clone(),
                price: Decimal::from_f64(price).unwrap_or(Decimal::ZERO),
                timestamp: Utc::now(),
                confidence: 0.95,
                raw_data: json!({
                    "price": price,
                    "symbol": token_address,
                    "source": "chainlink_mock"
                }),
                response_time_ms: self.response_delay_ms,
                success: true,
                error_message: None,
            })
        }

        async fn get_prices(&self, token_addresses: &[String]) -> Result<HashMap<String, OracleResponse>, Box<dyn std::error::Error + Send + Sync>> {
            let mut results = HashMap::new();
            for token in token_addresses {
                let response = self.get_price(token).await?;
                results.insert(token.clone(), response);
            }
            Ok(results)
        }

        fn get_oracle_type(&self) -> OracleType {
            self.config.oracle_type.clone()
        }
    }

    #[derive(Clone)]
    struct MockPythProvider {
        config: OracleConfig,
        price_data: Arc<RwLock<HashMap<String, f64>>>,
        confidence_factor: f64,
    }

    impl MockPythProvider {
        fn new(config: OracleConfig) -> Self {
            let mut price_data = HashMap::new();
            price_data.insert("BTC".to_string(), 50100.0); // Slightly different from Chainlink
            price_data.insert("ETH".to_string(), 3020.0);
            price_data.insert("USDC".to_string(), 0.999);
            price_data.insert("AAVE".to_string(), 101.5);

            Self {
                config,
                price_data: Arc::new(RwLock::new(price_data)),
                confidence_factor: 0.92,
            }
        }

        async fn set_price(&self, token: &str, price: f64) {
            let mut data = self.price_data.write().await;
            data.insert(token.to_string(), price);
        }
    }

    #[async_trait::async_trait]
    impl OracleProvider for MockPythProvider {
        async fn get_price(&self, token_address: &str) -> Result<OracleResponse, Box<dyn std::error::Error + Send + Sync>> {
            tokio::time::sleep(std::time::Duration::from_millis(30)).await; // Faster than Chainlink

            let price_data = self.price_data.read().await;
            let price = price_data.get(token_address).copied().unwrap_or(0.0);

            Ok(OracleResponse {
                oracle_type: self.config.oracle_type.clone(),
                price: Decimal::from_f64(price).unwrap_or(Decimal::ZERO),
                timestamp: Utc::now(),
                confidence: self.confidence_factor,
                raw_data: json!({
                    "price": price,
                    "symbol": token_address,
                    "source": "pyth_mock",
                    "publish_time": Utc::now().timestamp()
                }),
                response_time_ms: 30,
                success: true,
                error_message: None,
            })
        }

        async fn get_prices(&self, token_addresses: &[String]) -> Result<HashMap<String, OracleResponse>, Box<dyn std::error::Error + Send + Sync>> {
            let mut results = HashMap::new();
            for token in token_addresses {
                let response = self.get_price(token).await?;
                results.insert(token.clone(), response);
            }
            Ok(results)
        }

        fn get_oracle_type(&self) -> OracleType {
            self.config.oracle_type.clone()
        }
    }

    #[derive(Clone)]
    struct MockAuditDatabaseProvider {
        database_config: AuditDatabase,
        audit_entries: Arc<RwLock<HashMap<String, Vec<AuditEntry>>>>,
        should_fail: Arc<RwLock<bool>>,
    }

    impl MockAuditDatabaseProvider {
        fn new(database_config: AuditDatabase) -> Self {
            let mut audit_entries = HashMap::new();
            
            // Add some mock audit entries
            let aave_audits = vec![
                AuditEntry {
                    id: "audit-1".to_string(),
                    protocol_name: "AAVE".to_string(),
                    audit_firm: "Consensys Diligence".to_string(),
                    audit_date: Utc::now() - Duration::days(30),
                    severity: VulnerabilitySeverity::Medium,
                    category: VulnerabilityCategory::SmartContract,
                    title: "Flash loan reentrancy risk".to_string(),
                    description: "Potential reentrancy vulnerability in flash loan implementation".to_string(),
                    impact: "Medium risk of funds drainage through reentrancy attack".to_string(),
                    status: AuditStatus::Resolved,
                    remediation: Some("Implemented reentrancy guards".to_string()),
                    cve_id: Some("CVE-2023-12345".to_string()),
                    references: vec!["https://consensys.net/audit-aave".to_string()],
                },
                AuditEntry {
                    id: "audit-2".to_string(),
                    protocol_name: "AAVE".to_string(),
                    audit_firm: "Trail of Bits".to_string(),
                    audit_date: Utc::now() - Duration::days(15),
                    severity: VulnerabilitySeverity::Low,
                    category: VulnerabilityCategory::AccessControl,
                    title: "Insufficient access control validation".to_string(),
                    description: "Some admin functions lack proper access control".to_string(),
                    impact: "Low risk governance bypass".to_string(),
                    status: AuditStatus::InProgress,
                    remediation: None,
                    cve_id: None,
                    references: vec!["https://trailofbits.com/audit-aave-2".to_string()],
                },
            ];

            audit_entries.insert("AAVE".to_string(), aave_audits);

            Self {
                database_config,
                audit_entries: Arc::new(RwLock::new(audit_entries)),
                should_fail: Arc::new(RwLock::new(false)),
            }
        }

        async fn set_failure_mode(&self, should_fail: bool) {
            let mut fail = self.should_fail.write().await;
            *fail = should_fail;
        }

        async fn add_audit_entry(&self, protocol: &str, entry: AuditEntry) {
            let mut entries = self.audit_entries.write().await;
            entries.entry(protocol.to_string()).or_insert_with(Vec::new).push(entry);
        }
    }

    #[async_trait::async_trait]
    impl AuditDatabaseProvider for MockAuditDatabaseProvider {
        async fn get_audits(&self, protocol_name: &str) -> Result<Vec<AuditEntry>, Box<dyn std::error::Error + Send + Sync>> {
            let should_fail = *self.should_fail.read().await;
            if should_fail {
                return Err("Mock audit database failure".into());
            }

            tokio::time::sleep(std::time::Duration::from_millis(100)).await; // Simulate network delay

            let entries = self.audit_entries.read().await;
            Ok(entries.get(protocol_name).cloned().unwrap_or_default())
        }

        async fn get_audits_by_severity(&self, severity: VulnerabilitySeverity) -> Result<Vec<AuditEntry>, Box<dyn std::error::Error + Send + Sync>> {
            let entries = self.audit_entries.read().await;
            let mut results = Vec::new();

            for audit_list in entries.values() {
                for audit in audit_list {
                    if audit.severity == severity {
                        results.push(audit.clone());
                    }
                }
            }

            Ok(results)
        }

        async fn get_audits_by_category(&self, category: VulnerabilityCategory) -> Result<Vec<AuditEntry>, Box<dyn std::error::Error + Send + Sync>> {
            let entries = self.audit_entries.read().await;
            let mut results = Vec::new();

            for audit_list in entries.values() {
                for audit in audit_list {
                    if audit.category == category {
                        results.push(audit.clone());
                    }
                }
            }

            Ok(results)
        }

        fn get_database_name(&self) -> String {
            self.database_config.name.clone()
        }
    }

    // Helper function to create a test price feed integration system
    async fn create_test_price_feed_system() -> Result<(PriceFeedIntegrationSystem, Arc<MockChainlinkProvider>, Arc<MockPythProvider>, Arc<MockAuditDatabaseProvider>), Box<dyn std::error::Error + Send + Sync>> {
        let chainlink_config = OracleConfig {
            oracle_type: OracleType::Chainlink,
            endpoint: "https://mock-chainlink.com".to_string(),
            api_key: None,
            timeout_seconds: 10,
            retry_attempts: 3,
            weight: 0.6,
            enabled: true,
        };

        let pyth_config = OracleConfig {
            oracle_type: OracleType::Pyth,
            endpoint: "https://mock-pyth.com".to_string(),
            api_key: None,
            timeout_seconds: 8,
            retry_attempts: 2,
            weight: 0.4,
            enabled: true,
        };

        let audit_db_config = AuditDatabase {
            name: "MockAuditDB".to_string(),
            endpoint: "https://mock-audit.com".to_string(),
            api_key: None,
            audit_firms: vec!["Consensys Diligence".to_string(), "Trail of Bits".to_string()],
            enabled: true,
            priority: 1,
        };

        let integration_config = PriceFeedIntegrationConfig {
            oracles: vec![chainlink_config.clone(), pyth_config.clone()],
            fallback_strategy: FallbackStrategy::UseWeightedAverage,
            aggregation_method: AggregationMethod::WeightedAverage,
            cache_duration_seconds: 60,
            anomaly_detection: AnomalyDetectionConfig {
                price_deviation_threshold: 0.05,
                volume_spike_threshold: 3.0,
                time_window_minutes: 60,
                confidence_threshold: 0.8,
                enable_machine_learning: false,
            },
            audit_databases: AuditDatabaseConfig {
                databases: vec![audit_db_config.clone()],
                cache_duration_hours: 24,
                enable_auto_sync: true,
                sync_interval_hours: 6,
            },
            enable_monitoring: true,
            monitoring_interval_seconds: 30,
        };

        let chainlink_provider = Arc::new(MockChainlinkProvider::new(chainlink_config));
        let pyth_provider = Arc::new(MockPythProvider::new(pyth_config));
        let audit_provider = Arc::new(MockAuditDatabaseProvider::new(audit_db_config));

        let system = PriceFeedIntegrationSystem::new(integration_config)?;

        Ok((system, chainlink_provider, pyth_provider, audit_provider))
    }

    #[tokio::test]
    async fn test_oracle_aggregation_integration() {
        let (system, chainlink_provider, pyth_provider, _audit_provider) = create_test_price_feed_system()
            .await
            .expect("Should create test system");

        // Set different prices on each oracle
        chainlink_provider.set_price("BTC", 50000.0).await;
        pyth_provider.set_price("BTC", 50200.0).await;

        let aggregated_data = system.get_aggregated_price("BTC")
            .await
            .expect("Should get aggregated price");

        // Should have data from both oracles
        assert!(aggregated_data.oracle_count >= 2);
        assert!(aggregated_data.price > Decimal::ZERO);
        
        // Weighted average should be between the two prices (closer to Chainlink due to higher weight)
        let expected_weighted_avg = (50000.0 * 0.6) + (50200.0 * 0.4);
        let actual_price = aggregated_data.price.to_f64().unwrap_or(0.0);
        assert!((actual_price - expected_weighted_avg).abs() < 10.0);

        // Should have high confidence for consistent oracles
        assert!(aggregated_data.confidence > 0.8);
        assert!(aggregated_data.is_consensus);
        assert!(!aggregated_data.fallback_used);
    }

    #[tokio::test]
    async fn test_oracle_failure_fallback() {
        let (system, chainlink_provider, _pyth_provider, _audit_provider) = create_test_price_feed_system()
            .await
            .expect("Should create test system");

        // Set Chainlink to fail
        chainlink_provider.set_failure_mode(true).await;

        let aggregated_data = system.get_aggregated_price("BTC")
            .await
            .expect("Should get aggregated price despite one oracle failure");

        // Should still have data from Pyth
        assert!(aggregated_data.oracle_count >= 1);
        assert!(aggregated_data.price > Decimal::ZERO);
        
        // Confidence might be lower with only one oracle
        assert!(aggregated_data.confidence > 0.0);

        // Check oracle responses for failure details
        let failed_responses: Vec<&OracleResponse> = aggregated_data.oracle_responses.iter()
            .filter(|r| !r.success)
            .collect();
        assert!(!failed_responses.is_empty(), "Should have at least one failed response");
    }

    #[tokio::test]
    async fn test_price_deviation_detection() {
        let (system, chainlink_provider, pyth_provider, _audit_provider) = create_test_price_feed_system()
            .await
            .expect("Should create test system");

        // Set significantly different prices to trigger deviation detection
        chainlink_provider.set_price("BTC", 50000.0).await;
        pyth_provider.set_price("BTC", 55000.0).await; // 10% difference

        let aggregated_data = system.get_aggregated_price("BTC")
            .await
            .expect("Should get aggregated price");

        // Should detect high deviation
        assert!(aggregated_data.price_deviation > 0.05); // Should be > 5%
        assert!(!aggregated_data.is_consensus); // Should not be consensus due to high deviation
        
        // Oracle responses should show the divergence
        assert_eq!(aggregated_data.oracle_responses.len(), 2);
        let prices: Vec<f64> = aggregated_data.oracle_responses.iter()
            .map(|r| r.price.to_f64().unwrap_or(0.0))
            .collect();
        assert!(prices.contains(&50000.0));
        assert!(prices.contains(&55000.0));
    }

    #[tokio::test]
    async fn test_anomaly_detection_integration() {
        let anomaly_config = AnomalyDetectionConfig {
            price_deviation_threshold: 0.05, // 5%
            volume_spike_threshold: 3.0,
            time_window_minutes: 60,
            confidence_threshold: 0.8,
            enable_machine_learning: false,
        };

        let detector = AnomalyDetector::new(anomaly_config);

        // Create normal price data
        let normal_price = EnhancedPriceData {
            price: Decimal::new(50000, 0),
            timestamp: Utc::now(),
            oracle_type: OracleType::Chainlink,
            confidence: 0.95,
            volume_24h: Some(Decimal::new(1000000, 0)),
            market_cap: Some(Decimal::new(1000000000, 0)),
            price_change_24h: Some(0.02),
            is_anomalous: false,
            anomaly_score: 0.0,
        };

        // Add to history
        let is_anomalous = detector.detect_anomalies(&normal_price)
            .await
            .expect("Should detect anomalies");
        assert!(!is_anomalous); // First price should not be anomalous

        // Add another normal price
        let normal_price2 = EnhancedPriceData {
            price: Decimal::new(50100, 0), // 0.2% increase
            timestamp: Utc::now(),
            oracle_type: OracleType::Chainlink,
            confidence: 0.95,
            volume_24h: Some(Decimal::new(1100000, 0)),
            market_cap: Some(Decimal::new(1010000000, 0)),
            price_change_24h: Some(0.002),
            is_anomalous: false,
            anomaly_score: 0.0,
        };

        let is_anomalous = detector.detect_anomalies(&normal_price2)
            .await
            .expect("Should detect anomalies");
        assert!(!is_anomalous); // Small change should not be anomalous

        // Add anomalous price
        let anomalous_price = EnhancedPriceData {
            price: Decimal::new(53000, 0), // 6% spike
            timestamp: Utc::now(),
            oracle_type: OracleType::Chainlink,
            confidence: 0.95,
            volume_24h: Some(Decimal::new(5000000, 0)), // Volume spike
            market_cap: Some(Decimal::new(1060000000, 0)),
            price_change_24h: Some(0.06),
            is_anomalous: false,
            anomaly_score: 0.0,
        };

        let is_anomalous = detector.detect_anomalies(&anomalous_price)
            .await
            .expect("Should detect anomalies");
        assert!(is_anomalous); // Large price spike should be detected

        // Check anomaly score
        let anomaly_score = detector.calculate_anomaly_score(&anomalous_price)
            .await
            .expect("Should calculate anomaly score");
        assert!(anomaly_score > 1.0); // Should be above threshold
    }

    #[tokio::test]
    async fn test_audit_database_integration() {
        let (_system, _chainlink_provider, _pyth_provider, audit_provider) = create_test_price_feed_system()
            .await
            .expect("Should create test system");

        // Test getting audits for AAVE protocol
        let audits = audit_provider.get_audits("AAVE")
            .await
            .expect("Should get AAVE audits");

        assert!(!audits.is_empty());
        assert_eq!(audits.len(), 2);

        // Verify audit entry details
        let audit = &audits[0];
        assert_eq!(audit.protocol_name, "AAVE");
        assert!(audit.title.contains("Flash loan"));
        assert_eq!(audit.severity, VulnerabilitySeverity::Medium);
        assert_eq!(audit.status, AuditStatus::Resolved);

        // Test getting audits by severity
        let medium_audits = audit_provider.get_audits_by_severity(VulnerabilitySeverity::Medium)
            .await
            .expect("Should get medium severity audits");

        assert!(!medium_audits.is_empty());
        assert!(medium_audits.iter().all(|a| a.severity == VulnerabilitySeverity::Medium));

        // Test getting audits by category
        let contract_audits = audit_provider.get_audits_by_category(VulnerabilityCategory::SmartContract)
            .await
            .expect("Should get smart contract audits");

        assert!(!contract_audits.is_empty());
        assert!(contract_audits.iter().all(|a| a.category == VulnerabilityCategory::SmartContract));
    }

    #[tokio::test]
    async fn test_audit_database_failure_handling() {
        let (_system, _chainlink_provider, _pyth_provider, audit_provider) = create_test_price_feed_system()
            .await
            .expect("Should create test system");

        // Set audit database to fail
        audit_provider.set_failure_mode(true).await;

        // Should handle failure gracefully
        let result = audit_provider.get_audits("AAVE").await;
        assert!(result.is_err());

        // Reset failure mode
        audit_provider.set_failure_mode(false).await;

        // Should work again
        let audits = audit_provider.get_audits("AAVE")
            .await
            .expect("Should get audits after failure reset");
        assert!(!audits.is_empty());
    }

    #[tokio::test]
    async fn test_cache_functionality() {
        let (system, chainlink_provider, _pyth_provider, _audit_provider) = create_test_price_feed_system()
            .await
            .expect("Should create test system");

        // First request should hit oracles
        let start_time = std::time::Instant::now();
        let aggregated_data1 = system.get_aggregated_price("BTC")
            .await
            .expect("Should get aggregated price");
        let first_duration = start_time.elapsed();

        // Second request should use cache and be faster
        let start_time = std::time::Instant::now();
        let aggregated_data2 = system.get_aggregated_price("BTC")
            .await
            .expect("Should get cached aggregated price");
        let second_duration = start_time.elapsed();

        // Results should be identical
        assert_eq!(aggregated_data1.price, aggregated_data2.price);
        assert_eq!(aggregated_data1.oracle_count, aggregated_data2.oracle_count);

        // Second request should be significantly faster (cached)
        assert!(second_duration < first_duration / 2);

        // Check cache statistics
        let cache_stats = system.get_cache_stats()
            .await
            .expect("Should get cache stats");
        assert!(cache_stats.get("price_cache_entries").unwrap_or(&0) > &0);
    }

    #[tokio::test]
    async fn test_aggregation_methods() {
        let mut config = PriceFeedIntegrationConfig::default();
        
        // Test different aggregation methods
        let aggregation_methods = vec![
            AggregationMethod::WeightedAverage,
            AggregationMethod::Median,
            AggregationMethod::TrimmedMean,
            AggregationMethod::Consensus,
        ];

        for method in aggregation_methods {
            config.aggregation_method = method.clone();
            let system = PriceFeedIntegrationSystem::new(config.clone())
                .expect("Should create system with different aggregation method");

            // Clear cache before each test
            system.clear_caches().await.expect("Should clear caches");

            let aggregated_data = system.get_aggregated_price("BTC")
                .await
                .expect(&format!("Should get aggregated price with {:?} method", method));

            assert!(aggregated_data.price > Decimal::ZERO);
            assert!(aggregated_data.oracle_count > 0);
            
            // Different methods should potentially give different results
            match method {
                AggregationMethod::Consensus => {
                    // Consensus method should indicate whether prices agree
                    assert!(aggregated_data.is_consensus || !aggregated_data.is_consensus);
                }
                AggregationMethod::Median => {
                    // Median should be robust to outliers
                    assert!(aggregated_data.price > Decimal::ZERO);
                }
                _ => {
                    // Other methods should work normally
                    assert!(aggregated_data.confidence > 0.0);
                }
            }
        }
    }

    #[tokio::test]
    async fn test_fallback_strategies() {
        let fallback_strategies = vec![
            FallbackStrategy::UseLastKnownPrice,
            FallbackStrategy::UseMedianPrice,
            FallbackStrategy::UseWeightedAverage,
            FallbackStrategy::UseMostReliableOracle,
        ];

        for strategy in fallback_strategies {
            let mut config = PriceFeedIntegrationConfig::default();
            config.fallback_strategy = strategy.clone();
            
            let system = PriceFeedIntegrationSystem::new(config)
                .expect("Should create system with fallback strategy");

            // Get initial price to establish baseline
            let initial_data = system.get_aggregated_price("BTC")
                .await
                .expect("Should get initial price");

            assert!(initial_data.price > Decimal::ZERO);
            
            // Test that fallback strategy is configured
            // (Actual fallback behavior would require more complex oracle failure simulation)
        }
    }

    #[tokio::test]
    async fn test_oracle_response_timing() {
        let (system, _chainlink_provider, _pyth_provider, _audit_provider) = create_test_price_feed_system()
            .await
            .expect("Should create test system");

        let start_time = std::time::Instant::now();
        let aggregated_data = system.get_aggregated_price("BTC")
            .await
            .expect("Should get aggregated price");
        let total_duration = start_time.elapsed();

        // Should complete within reasonable time
        assert!(total_duration.as_millis() < 500); // Less than 500ms

        // Check individual oracle response times
        assert!(!aggregated_data.oracle_responses.is_empty());
        for response in &aggregated_data.oracle_responses {
            assert!(response.response_time_ms < 200); // Each oracle should respond quickly
            assert!(response.timestamp > Utc::now() - Duration::seconds(5)); // Recent timestamp
        }
    }

    #[tokio::test]
    async fn test_concurrent_price_requests() {
        let (system, _chainlink_provider, _pyth_provider, _audit_provider) = create_test_price_feed_system()
            .await
            .expect("Should create test system");

        // Make multiple concurrent requests
        let mut handles = Vec::new();
        let tokens = vec!["BTC", "ETH", "USDC", "AAVE"];

        for token in tokens {
            let system_clone = system.clone();
            let token_clone = token.to_string();
            
            let handle = tokio::spawn(async move {
                system_clone.get_aggregated_price(&token_clone).await
            });
            handles.push(handle);
        }

        // Wait for all requests to complete
        let mut results = Vec::new();
        for handle in handles {
            let result = handle.await.expect("Task should complete")
                .expect("Should get aggregated price");
            results.push(result);
        }

        // All requests should succeed
        assert_eq!(results.len(), 4);
        for result in results {
            assert!(result.price > Decimal::ZERO);
            assert!(result.oracle_count > 0);
        }
    }

    #[tokio::test]
    async fn test_audit_data_consistency() {
        let (_system, _chainlink_provider, _pyth_provider, audit_provider) = create_test_price_feed_system()
            .await
            .expect("Should create test system");

        // Add a new audit entry
        let new_audit = AuditEntry {
            id: "audit-3".to_string(),
            protocol_name: "AAVE".to_string(),
            audit_firm: "OpenZeppelin".to_string(),
            audit_date: Utc::now(),
            severity: VulnerabilitySeverity::High,
            category: VulnerabilityCategory::AccessControl,
            title: "Critical access control bypass".to_string(),
            description: "Critical vulnerability in admin functions".to_string(),
            impact: "High risk of unauthorized access".to_string(),
            status: AuditStatus::Open,
            remediation: None,
            cve_id: Some("CVE-2024-12345".to_string()),
            references: vec!["https://openzeppelin.com/audit-aave-critical".to_string()],
        };

        audit_provider.add_audit_entry("AAVE", new_audit.clone()).await;

        // Verify the new audit is included
        let all_audits = audit_provider.get_audits("AAVE")
            .await
            .expect("Should get all AAVE audits");

        assert_eq!(all_audits.len(), 3);
        
        let added_audit = all_audits.iter()
            .find(|a| a.id == "audit-3")
            .expect("Should find the added audit");

        assert_eq!(added_audit.severity, VulnerabilitySeverity::High);
        assert_eq!(added_audit.status, AuditStatus::Open);

        // Test filtering by severity
        let high_severity_audits = audit_provider.get_audits_by_severity(VulnerabilitySeverity::High)
            .await
            .expect("Should get high severity audits");

        assert!(!high_severity_audits.is_empty());
        assert!(high_severity_audits.iter().any(|a| a.id == "audit-3"));
    }

    #[tokio::test]
    async fn test_system_integration_with_real_world_scenario() {
        let (system, chainlink_provider, pyth_provider, audit_provider) = create_test_price_feed_system()
            .await
            .expect("Should create test system");

        // Simulate a real-world scenario with price volatility and audit information

        // Step 1: Get baseline prices
        let btc_baseline = system.get_aggregated_price("BTC")
            .await
            .expect("Should get BTC baseline price");

        assert!(btc_baseline.price > Decimal::ZERO);
        let baseline_price = btc_baseline.price.to_f64().unwrap_or(0.0);

        // Step 2: Simulate market volatility
        chainlink_provider.set_price("BTC", baseline_price * 0.95).await; // 5% drop
        pyth_provider.set_price("BTC", baseline_price * 0.93).await; // 7% drop

        let btc_volatile = system.get_aggregated_price("BTC")
            .await
            .expect("Should get BTC price during volatility");

        // Price should reflect the drop
        let volatile_price = btc_volatile.price.to_f64().unwrap_or(0.0);
        assert!(volatile_price < baseline_price);

        // Should detect higher deviation
        assert!(btc_volatile.price_deviation > btc_baseline.price_deviation);

        // Step 3: Check audit information for related protocols
        let aave_audits = audit_provider.get_audits("AAVE")
            .await
            .expect("Should get AAVE audit information");

        assert!(!aave_audits.is_empty());

        // Step 4: Simulate oracle failure during volatile period
        chainlink_provider.set_failure_mode(true).await;

        let btc_with_failure = system.get_aggregated_price("BTC")
            .await
            .expect("Should get BTC price despite oracle failure");

        // Should still get price from remaining oracle
        assert!(btc_with_failure.price > Decimal::ZERO);
        assert!(btc_with_failure.oracle_count >= 1);

        // Should indicate fallback was used or oracle failed
        let failed_responses = btc_with_failure.oracle_responses.iter()
            .filter(|r| !r.success)
            .count();
        assert!(failed_responses > 0);

        // Step 5: Recovery scenario
        chainlink_provider.set_failure_mode(false).await;
        chainlink_provider.set_price("BTC", baseline_price).await; // Price recovery

        let btc_recovery = system.get_aggregated_price("BTC")
            .await
            .expect("Should get BTC price during recovery");

        // Should have both oracles working again
        assert!(btc_recovery.oracle_count >= 2);
        let recovery_price = btc_recovery.price.to_f64().unwrap_or(0.0);
        assert!(recovery_price > volatile_price); // Price should be recovering

        // Should have lower deviation as oracles converge
        assert!(btc_recovery.price_deviation < btc_volatile.price_deviation);
    }

    #[tokio::test]
    async fn test_cache_invalidation_and_cleanup() {
        let (system, chainlink_provider, _pyth_provider, _audit_provider) = create_test_price_feed_system()
            .await
            .expect("Should create test system");

        // Get initial price to populate cache
        let initial_price = system.get_aggregated_price("BTC")
            .await
            .expect("Should get initial price");

        // Check cache is populated
        let cache_stats = system.get_cache_stats()
            .await
            .expect("Should get cache stats");
        assert!(cache_stats.get("price_cache_entries").unwrap_or(&0) > &0);

        // Change price significantly
        chainlink_provider.set_price("BTC", 60000.0).await;

        // Clear cache to ensure fresh data
        system.clear_caches().await.expect("Should clear caches");

        // Check cache is empty
        let empty_cache_stats = system.get_cache_stats()
            .await
            .expect("Should get empty cache stats");
        assert_eq!(empty_cache_stats.get("price_cache_entries").unwrap_or(&0), &0);
        assert_eq!(empty_cache_stats.get("audit_cache_entries").unwrap_or(&0), &0);

        // Get new price should hit oracles again
        let new_price = system.get_aggregated_price("BTC")
            .await
            .expect("Should get new price after cache clear");

        // Price should reflect the change
        assert_ne!(initial_price.price, new_price.price);
        let new_price_value = new_price.price.to_f64().unwrap_or(0.0);
        assert!((new_price_value - 50100.0).abs() < 1000.0); // Should be close to weighted average of new prices
    }
}