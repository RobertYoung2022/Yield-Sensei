use std::sync::Arc;
use tokio::sync::RwLock;
use chrono::{Utc, Duration};
use rust_decimal::Decimal;
use std::collections::HashMap;
use serde_json::{json, Value};

// Import the actual Aegis satellite price feed integration
extern crate aegis_satellite;
use aegis_satellite::data::price_feed_integration::{
    PriceFeedIntegrationSystem, PriceFeedIntegrationConfig, OracleConfig, OracleType,
    AggregatedPriceData, OracleResponse, AggregationMethod, FallbackStrategy,
    AnomalyDetectionConfig, AuditDatabaseConfig, AuditDatabase, EnhancedPriceData,
    AuditEntry, AuditStatus, OracleProvider, AuditDatabaseProvider
};
use aegis_satellite::security::{VulnerabilitySeverity, VulnerabilityCategory};

#[cfg(test)]
mod price_feed_integration_tests {
    use super::*;

    // Mock HTTP server for testing oracle endpoints
    struct MockHttpServer {
        port: u16,
        responses: Arc<RwLock<HashMap<String, Value>>>,
        request_count: Arc<RwLock<HashMap<String, usize>>>,
        response_delay_ms: u64,
        failure_rate: f64,
    }

    impl MockHttpServer {
        pub fn new(port: u16) -> Self {
            Self {
                port,
                responses: Arc::new(RwLock::new(HashMap::new())),
                request_count: Arc::new(RwLock::new(HashMap::new())),
                response_delay_ms: 50,
                failure_rate: 0.0,
            }
        }

        pub async fn set_response(&self, path: &str, response: Value) {
            let mut responses = self.responses.write().await;
            responses.insert(path.to_string(), response);
        }

        pub async fn set_failure_rate(&mut self, rate: f64) {
            self.failure_rate = rate;
        }

        pub async fn get_request_count(&self, path: &str) -> usize {
            let counts = self.request_count.read().await;
            *counts.get(path).unwrap_or(&0)
        }

        pub fn get_base_url(&self) -> String {
            format!("http://localhost:{}", self.port)
        }

        // Simulate server responses for testing
        pub async fn simulate_chainlink_response(&self, token: &str, price: f64) {
            let response = json!({
                "price": price,
                "confidence": 0.95,
                "timestamp": Utc::now().timestamp(),
                "symbol": token
            });
            self.set_response(&format!("/v2/price/{}", token), response).await;
        }

        pub async fn simulate_pyth_response(&self, token: &str, price: f64) {
            let response = json!({
                "price": price,
                "confidence": 0.9,
                "timestamp": Utc::now().timestamp(),
                "asset": token
            });
            self.set_response(&format!("/api/price/{}", token), response).await;
        }

        pub async fn simulate_band_response(&self, token: &str, price: f64) {
            let response = json!({
                "price": price,
                "confidence": 0.85,
                "timestamp": Utc::now().timestamp(),
                "pair": format!("{}/USD", token)
            });
            self.set_response(&format!("/oracle/v1/price/{}", token), response).await;
        }

        pub async fn simulate_audit_response(&self, protocol: &str, audits: Vec<AuditEntry>) {
            let audit_data: Vec<Value> = audits.into_iter().map(|audit| {
                json!({
                    "id": audit.id,
                    "title": audit.title,
                    "description": audit.description,
                    "impact": audit.impact,
                    "severity": format!("{:?}", audit.severity),
                    "status": format!("{:?}", audit.status),
                    "remediation": audit.remediation,
                    "cve_id": audit.cve_id,
                    "references": audit.references
                })
            }).collect();

            self.set_response(&format!("/api/audits/{}", protocol), json!(audit_data)).await;
        }
    }

    // Create test configuration with mock endpoints
    fn create_test_config(base_urls: &[String]) -> PriceFeedIntegrationConfig {
        let mut config = PriceFeedIntegrationConfig::default();
        
        if base_urls.len() >= 1 {
            config.oracles[0].endpoint = base_urls[0].clone();
        }
        if base_urls.len() >= 2 {
            config.oracles[1].endpoint = base_urls[1].clone();
        }
        if base_urls.len() >= 3 {
            config.oracles[2].endpoint = base_urls[2].clone();
        }

        // Reduce cache duration for testing
        config.cache_duration_seconds = 5;

        // Configure audit databases with test endpoints
        if base_urls.len() >= 1 {
            config.audit_databases.databases[0].endpoint = base_urls[0].clone();
        }

        config
    }

    #[tokio::test]
    async fn test_single_oracle_integration() {
        let mock_server = MockHttpServer::new(8081);
        let base_url = mock_server.get_base_url();
        
        // Set up mock responses
        mock_server.simulate_chainlink_response("BTC", 50000.0).await;
        mock_server.simulate_chainlink_response("ETH", 3000.0).await;

        let config = create_test_config(&[base_url]);
        let integration_system = PriceFeedIntegrationSystem::new(config)
            .expect("Failed to create integration system");

        // Test single price retrieval
        let btc_price_result = integration_system.get_aggregated_price("BTC").await;
        assert!(btc_price_result.is_ok());
        
        let btc_price = btc_price_result.unwrap();
        assert_eq!(btc_price.price, Decimal::from_f64(50000.0).unwrap());
        assert_eq!(btc_price.oracle_count, 1);
        assert!(btc_price.confidence > 0.9);
        assert!(!btc_price.fallback_used);

        // Test ETH price
        let eth_price_result = integration_system.get_aggregated_price("ETH").await;
        assert!(eth_price_result.is_ok());
        
        let eth_price = eth_price_result.unwrap();
        assert_eq!(eth_price.price, Decimal::from_f64(3000.0).unwrap());
    }

    #[tokio::test]
    async fn test_multi_oracle_aggregation() {
        let mock_server1 = MockHttpServer::new(8082);
        let mock_server2 = MockHttpServer::new(8083);
        let mock_server3 = MockHttpServer::new(8084);

        let base_urls = vec![
            mock_server1.get_base_url(),
            mock_server2.get_base_url(),
            mock_server3.get_base_url(),
        ];

        // Set up different responses from each oracle
        mock_server1.simulate_chainlink_response("BTC", 50000.0).await;
        mock_server2.simulate_pyth_response("BTC", 50200.0).await;
        mock_server3.simulate_band_response("BTC", 49800.0).await;

        let mut config = create_test_config(&base_urls);
        config.aggregation_method = AggregationMethod::WeightedAverage;

        let integration_system = PriceFeedIntegrationSystem::new(config)
            .expect("Failed to create integration system");

        let aggregated_result = integration_system.get_aggregated_price("BTC").await;
        assert!(aggregated_result.is_ok());
        
        let aggregated = aggregated_result.unwrap();
        
        // Should aggregate 3 oracles
        assert_eq!(aggregated.oracle_count, 3);
        assert!(aggregated.confidence > 0.8);
        
        // Price should be weighted average (roughly around 50000)
        let price_f64 = aggregated.price.to_f64().unwrap();
        assert!(price_f64 > 49500.0 && price_f64 < 50500.0);
        
        // Should detect consensus with small deviation
        assert!(aggregated.is_consensus);
        assert!(aggregated.price_deviation < 0.02); // Less than 2%
    }

    #[tokio::test]
    async fn test_median_aggregation() {
        let mock_server1 = MockHttpServer::new(8085);
        let mock_server2 = MockHttpServer::new(8086);
        let mock_server3 = MockHttpServer::new(8087);

        let base_urls = vec![
            mock_server1.get_base_url(),
            mock_server2.get_base_url(),
            mock_server3.get_base_url(),
        ];

        // Set up responses with different values for median calculation
        mock_server1.simulate_chainlink_response("ETH", 2800.0).await;
        mock_server2.simulate_pyth_response("ETH", 3000.0).await; // This should be median
        mock_server3.simulate_band_response("ETH", 3200.0).await;

        let mut config = create_test_config(&base_urls);
        config.aggregation_method = AggregationMethod::Median;

        let integration_system = PriceFeedIntegrationSystem::new(config)
            .expect("Failed to create integration system");

        let median_result = integration_system.get_aggregated_price("ETH").await;
        assert!(median_result.is_ok());
        
        let median_price = median_result.unwrap();
        assert_eq!(median_price.price, Decimal::from_f64(3000.0).unwrap());
        assert_eq!(median_price.oracle_count, 3);
    }

    #[tokio::test]
    async fn test_oracle_failure_handling() {
        let mock_server1 = MockHttpServer::new(8088);
        let mock_server2 = MockHttpServer::new(8089);
        let base_urls = vec![
            mock_server1.get_base_url(),
            mock_server2.get_base_url(),
            "http://invalid-endpoint:9999".to_string(), // This will fail
        ];

        // Set up responses for working oracles
        mock_server1.simulate_chainlink_response("BTC", 50000.0).await;
        mock_server2.simulate_pyth_response("BTC", 50100.0).await;

        let config = create_test_config(&base_urls);
        let integration_system = PriceFeedIntegrationSystem::new(config)
            .expect("Failed to create integration system");

        let result = integration_system.get_aggregated_price("BTC").await;
        assert!(result.is_ok());
        
        let aggregated = result.unwrap();
        
        // Should work with 2 out of 3 oracles
        assert_eq!(aggregated.oracle_count, 2);
        assert!(aggregated.confidence > 0.8);
        
        // Should use fallback strategy but not mark as fallback_used for partial failures
        assert!(!aggregated.fallback_used);
    }

    #[tokio::test]
    async fn test_all_oracles_failure() {
        let base_urls = vec![
            "http://invalid1:9998".to_string(),
            "http://invalid2:9997".to_string(),
            "http://invalid3:9996".to_string(),
        ];

        let config = create_test_config(&base_urls);
        let integration_system = PriceFeedIntegrationSystem::new(config)
            .expect("Failed to create integration system");

        let result = integration_system.get_aggregated_price("BTC").await;
        assert!(result.is_err());
        
        let error_msg = result.unwrap_err().to_string();
        assert!(error_msg.contains("All oracles failed"));
    }

    #[tokio::test]
    async fn test_price_caching() {
        let mock_server = MockHttpServer::new(8090);
        let base_url = mock_server.get_base_url();
        
        mock_server.simulate_chainlink_response("BTC", 50000.0).await;

        let mut config = create_test_config(&[base_url]);
        config.cache_duration_seconds = 10; // 10 second cache

        let integration_system = PriceFeedIntegrationSystem::new(config)
            .expect("Failed to create integration system");

        // First request - should hit oracle
        let first_result = integration_system.get_aggregated_price("BTC").await;
        assert!(first_result.is_ok());
        let first_timestamp = first_result.unwrap().timestamp;

        // Second request immediately - should use cache
        let second_result = integration_system.get_aggregated_price("BTC").await;
        assert!(second_result.is_ok());
        let second_timestamp = second_result.unwrap().timestamp;

        // Timestamps should be identical (from cache)
        assert_eq!(first_timestamp, second_timestamp);

        // Wait for cache to expire and update mock response
        tokio::time::sleep(tokio::time::Duration::from_secs(11)).await;
        mock_server.simulate_chainlink_response("BTC", 51000.0).await;

        // Third request - should hit oracle again
        let third_result = integration_system.get_aggregated_price("BTC").await;
        assert!(third_result.is_ok());
        let third_price = third_result.unwrap();
        
        // Should have updated price and timestamp
        assert_eq!(third_price.price, Decimal::from_f64(51000.0).unwrap());
        assert!(third_price.timestamp > second_timestamp);
    }

    #[tokio::test]
    async fn test_anomaly_detection() {
        let mock_server = MockHttpServer::new(8091);
        let base_url = mock_server.get_base_url();

        let mut config = create_test_config(&[base_url]);
        config.anomaly_detection.price_deviation_threshold = 0.1; // 10% threshold
        config.cache_duration_seconds = 1; // Short cache for testing

        let integration_system = PriceFeedIntegrationSystem::new(config)
            .expect("Failed to create integration system");

        // Establish baseline price
        mock_server.simulate_chainlink_response("ETH", 3000.0).await;
        let _baseline = integration_system.get_aggregated_price("ETH").await.unwrap();

        tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;

        // Set normal price variation (5% change)
        mock_server.simulate_chainlink_response("ETH", 3150.0).await;
        let normal_result = integration_system.get_aggregated_price("ETH").await;
        assert!(normal_result.is_ok());

        tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;

        // Set anomalous price (20% spike)
        mock_server.simulate_chainlink_response("ETH", 3600.0).await;
        let anomaly_result = integration_system.get_aggregated_price("ETH").await;
        assert!(anomaly_result.is_ok());
        
        // Should still return the price but potentially flag as anomalous
        let anomaly_price = anomaly_result.unwrap();
        assert_eq!(anomaly_price.price, Decimal::from_f64(3600.0).unwrap());
    }

    #[tokio::test]
    async fn test_audit_database_integration() {
        let mock_server = MockHttpServer::new(8092);
        let base_url = mock_server.get_base_url();

        // Create mock audit entries
        let mock_audits = vec![
            AuditEntry {
                id: "audit_1".to_string(),
                protocol_name: "TestProtocol".to_string(),
                audit_firm: "Test Auditors".to_string(),
                audit_date: Utc::now(),
                severity: VulnerabilitySeverity::High,
                category: VulnerabilityCategory::SmartContract,
                title: "Reentrancy Vulnerability".to_string(),
                description: "Potential reentrancy attack vector".to_string(),
                impact: "Could lead to fund drainage".to_string(),
                status: AuditStatus::Open,
                remediation: Some("Implement reentrancy guard".to_string()),
                cve_id: Some("CVE-2023-12345".to_string()),
                references: vec!["https://example.com/audit".to_string()],
            },
            AuditEntry {
                id: "audit_2".to_string(),
                protocol_name: "TestProtocol".to_string(),
                audit_firm: "Test Auditors".to_string(),
                audit_date: Utc::now(),
                severity: VulnerabilitySeverity::Medium,
                category: VulnerabilityCategory::AccessControl,
                title: "Missing Access Control".to_string(),
                description: "Some functions lack proper access control".to_string(),
                impact: "Unauthorized access to admin functions".to_string(),
                status: AuditStatus::Resolved,
                remediation: Some("Add onlyOwner modifier".to_string()),
                cve_id: None,
                references: vec![],
            },
        ];

        mock_server.simulate_audit_response("TestProtocol", mock_audits.clone()).await;

        let config = create_test_config(&[base_url]);
        let integration_system = PriceFeedIntegrationSystem::new(config)
            .expect("Failed to create integration system");

        let audit_result = integration_system.get_audit_data("TestProtocol").await;
        assert!(audit_result.is_ok());
        
        let audits = audit_result.unwrap();
        assert_eq!(audits.len(), 2);
        
        // Verify first audit
        assert_eq!(audits[0].id, "audit_1");
        assert_eq!(audits[0].title, "Reentrancy Vulnerability");
        assert_eq!(audits[0].severity, VulnerabilitySeverity::High);
        assert_eq!(audits[0].status, AuditStatus::Open);
        
        // Verify second audit
        assert_eq!(audits[1].id, "audit_2");
        assert_eq!(audits[1].severity, VulnerabilitySeverity::Medium);
        assert_eq!(audits[1].status, AuditStatus::Resolved);
    }

    #[tokio::test]
    async fn test_cache_management() {
        let mock_server = MockHttpServer::new(8093);
        let base_url = mock_server.get_base_url();
        
        mock_server.simulate_chainlink_response("BTC", 50000.0).await;
        mock_server.simulate_audit_response("TestProtocol", vec![]).await;

        let config = create_test_config(&[base_url]);
        let integration_system = PriceFeedIntegrationSystem::new(config)
            .expect("Failed to create integration system");

        // Populate caches
        let _price = integration_system.get_aggregated_price("BTC").await.unwrap();
        let _audits = integration_system.get_audit_data("TestProtocol").await.unwrap();

        // Check cache stats
        let stats_result = integration_system.get_cache_stats().await;
        assert!(stats_result.is_ok());
        
        let stats = stats_result.unwrap();
        assert!(stats.get("price_cache_entries").unwrap_or(&0) > &0);
        assert!(stats.get("audit_cache_entries").unwrap_or(&0) > &0);

        // Clear caches
        let clear_result = integration_system.clear_caches().await;
        assert!(clear_result.is_ok());

        // Verify caches are empty
        let stats_after_clear = integration_system.get_cache_stats().await.unwrap();
        assert_eq!(stats_after_clear.get("price_cache_entries").unwrap_or(&0), &0);
        assert_eq!(stats_after_clear.get("audit_cache_entries").unwrap_or(&0), &0);
    }

    #[tokio::test]
    async fn test_concurrent_price_requests() {
        let mock_server = MockHttpServer::new(8094);
        let base_url = mock_server.get_base_url();
        
        // Set up multiple token responses
        mock_server.simulate_chainlink_response("BTC", 50000.0).await;
        mock_server.simulate_chainlink_response("ETH", 3000.0).await;
        mock_server.simulate_chainlink_response("USDC", 1.0).await;
        mock_server.simulate_chainlink_response("AAVE", 100.0).await;

        let config = create_test_config(&[base_url]);
        let integration_system = Arc::new(PriceFeedIntegrationSystem::new(config)
            .expect("Failed to create integration system"));

        let tokens = ["BTC", "ETH", "USDC", "AAVE"];
        let mut handles = Vec::new();

        // Spawn concurrent requests
        for &token in &tokens {
            let system_clone = integration_system.clone();
            let token_str = token.to_string();
            let handle = tokio::spawn(async move {
                system_clone.get_aggregated_price(&token_str).await
            });
            handles.push(handle);
        }

        // Wait for all requests to complete
        let mut results = Vec::new();
        for handle in handles {
            let result = handle.await.expect("Task should complete");
            assert!(result.is_ok());
            results.push(result.unwrap());
        }

        // Verify all results
        assert_eq!(results.len(), 4);
        
        // Check specific prices
        let btc_price = results.iter().find(|r| {
            r.oracle_responses.iter().any(|resp| 
                resp.raw_data.get("symbol").and_then(|v| v.as_str()) == Some("BTC")
            )
        }).unwrap();
        assert_eq!(btc_price.price, Decimal::from_f64(50000.0).unwrap());
    }

    #[tokio::test]
    async fn test_different_aggregation_methods() {
        let mock_server1 = MockHttpServer::new(8095);
        let mock_server2 = MockHttpServer::new(8096);
        let mock_server3 = MockHttpServer::new(8097);

        let base_urls = vec![
            mock_server1.get_base_url(),
            mock_server2.get_base_url(),
            mock_server3.get_base_url(),
        ];

        // Set up responses with known values for testing
        // Values: 1000, 1100, 1200 (should give median 1100)
        mock_server1.simulate_chainlink_response("TEST", 1000.0).await;
        mock_server2.simulate_pyth_response("TEST", 1100.0).await;
        mock_server3.simulate_band_response("TEST", 1200.0).await;

        // Test Median aggregation
        let mut median_config = create_test_config(&base_urls);
        median_config.aggregation_method = AggregationMethod::Median;
        let median_system = PriceFeedIntegrationSystem::new(median_config).unwrap();
        
        let median_result = median_system.get_aggregated_price("TEST").await.unwrap();
        assert_eq!(median_result.price, Decimal::from_f64(1100.0).unwrap());

        // Test Trimmed Mean (should exclude extremes)
        let mut trimmed_config = create_test_config(&base_urls);
        trimmed_config.aggregation_method = AggregationMethod::TrimmedMean;
        let trimmed_system = PriceFeedIntegrationSystem::new(trimmed_config).unwrap();
        
        let trimmed_result = trimmed_system.get_aggregated_price("TEST").await.unwrap();
        // With 10% trim and 3 values, should use middle value (1100)
        assert_eq!(trimmed_result.price, Decimal::from_f64(1100.0).unwrap());

        // Test Consensus (should check for agreement)
        let mut consensus_config = create_test_config(&base_urls);
        consensus_config.aggregation_method = AggregationMethod::Consensus;
        let consensus_system = PriceFeedIntegrationSystem::new(consensus_config).unwrap();
        
        let consensus_result = consensus_system.get_aggregated_price("TEST").await.unwrap();
        // Should be mean of all values: (1000 + 1100 + 1200) / 3 = 1100
        assert_eq!(consensus_result.price, Decimal::from_f64(1100.0).unwrap());
        
        // Check if consensus was achieved (should be false due to 20% spread)
        assert!(!consensus_result.is_consensus);
    }

    #[tokio::test]
    async fn test_fallback_strategies() {
        let mock_server = MockHttpServer::new(8098);
        let base_url = mock_server.get_base_url();
        
        mock_server.simulate_chainlink_response("BTC", 50000.0).await;

        let mut config = create_test_config(&[base_url]);
        config.fallback_strategy = FallbackStrategy::UseWeightedAverage;

        let integration_system = PriceFeedIntegrationSystem::new(config)
            .expect("Failed to create integration system");

        // First, get a normal price to establish baseline
        let baseline_result = integration_system.get_aggregated_price("BTC").await;
        assert!(baseline_result.is_ok());
        
        let baseline = baseline_result.unwrap();
        assert_eq!(baseline.price, Decimal::from_f64(50000.0).unwrap());
        assert!(!baseline.fallback_used);

        // Test with failed oracles (simulate by requesting non-existent token)
        let fallback_result = integration_system.get_aggregated_price("NONEXISTENT").await;
        // This should fail since no oracles have data for this token
        assert!(fallback_result.is_err());
    }

    #[tokio::test]
    async fn test_performance_under_load() {
        let mock_server = MockHttpServer::new(8099);
        let base_url = mock_server.get_base_url();
        
        // Set up responses for many tokens
        for i in 0..100 {
            let token = format!("TOKEN{}", i);
            let price = 100.0 + (i as f64);
            mock_server.simulate_chainlink_response(&token, price).await;
        }

        let config = create_test_config(&[base_url]);
        let integration_system = Arc::new(PriceFeedIntegrationSystem::new(config)
            .expect("Failed to create integration system"));

        let start_time = std::time::Instant::now();
        let mut handles = Vec::new();

        // Spawn 100 concurrent requests
        for i in 0..100 {
            let system_clone = integration_system.clone();
            let token = format!("TOKEN{}", i);
            let handle = tokio::spawn(async move {
                system_clone.get_aggregated_price(&token).await
            });
            handles.push(handle);
        }

        // Wait for all requests
        let mut success_count = 0;
        for handle in handles {
            let result = handle.await.expect("Task should complete");
            if result.is_ok() {
                success_count += 1;
            }
        }

        let elapsed = start_time.elapsed();
        
        // Performance assertions
        assert!(elapsed.as_millis() < 5000, "100 concurrent requests took too long: {}ms", elapsed.as_millis());
        assert_eq!(success_count, 100, "Not all requests succeeded");

        // Check cache performance
        let cache_stats = integration_system.get_cache_stats().await.unwrap();
        assert_eq!(cache_stats.get("price_cache_entries").unwrap_or(&0), &100);
    }

    #[tokio::test]
    async fn test_oracle_response_time_monitoring() {
        let mock_server = MockHttpServer::new(8100);
        let base_url = mock_server.get_base_url();
        
        mock_server.simulate_chainlink_response("BTC", 50000.0).await;

        let config = create_test_config(&[base_url]);
        let integration_system = PriceFeedIntegrationSystem::new(config)
            .expect("Failed to create integration system");

        let start_time = std::time::Instant::now();
        let result = integration_system.get_aggregated_price("BTC").await;
        let elapsed = start_time.elapsed();

        assert!(result.is_ok());
        let aggregated = result.unwrap();
        
        // Check that response time was recorded in oracle response
        assert!(!aggregated.oracle_responses.is_empty());
        let oracle_response = &aggregated.oracle_responses[0];
        assert!(oracle_response.response_time_ms > 0);
        assert!(oracle_response.response_time_ms < elapsed.as_millis() as u64 + 100); // Allow some margin
    }

    #[tokio::test]
    async fn test_end_to_end_price_feed_workflow() {
        let mock_server1 = MockHttpServer::new(8101);
        let mock_server2 = MockHttpServer::new(8102);
        let mock_server3 = MockHttpServer::new(8103);

        let base_urls = vec![
            mock_server1.get_base_url(),
            mock_server2.get_base_url(),
            mock_server3.get_base_url(),
        ];

        // 1. Set up initial oracle responses
        mock_server1.simulate_chainlink_response("BTC", 50000.0).await;
        mock_server2.simulate_pyth_response("BTC", 50100.0).await;
        mock_server3.simulate_band_response("BTC", 49900.0).await;

        mock_server1.simulate_chainlink_response("ETH", 3000.0).await;
        mock_server2.simulate_pyth_response("ETH", 3050.0).await;
        mock_server3.simulate_band_response("ETH", 2950.0).await;

        // Set up audit data
        let audit_entries = vec![
            AuditEntry {
                id: "audit_btc_1".to_string(),
                protocol_name: "Bitcoin Bridge".to_string(),
                audit_firm: "Security Firm".to_string(),
                audit_date: Utc::now(),
                severity: VulnerabilitySeverity::Low,
                category: VulnerabilityCategory::SmartContract,
                title: "Minor Issue".to_string(),
                description: "Low risk issue found".to_string(),
                impact: "Minimal impact".to_string(),
                status: AuditStatus::Resolved,
                remediation: Some("Fixed in v1.1".to_string()),
                cve_id: None,
                references: vec![],
            },
        ];

        mock_server1.simulate_audit_response("Bitcoin Bridge", audit_entries).await;

        let mut config = create_test_config(&base_urls);
        config.aggregation_method = AggregationMethod::WeightedAverage;
        config.cache_duration_seconds = 3;

        let integration_system = PriceFeedIntegrationSystem::new(config)
            .expect("Failed to create integration system");

        // 2. Test initial price aggregation
        let btc_result = integration_system.get_aggregated_price("BTC").await;
        assert!(btc_result.is_ok());
        
        let btc_price = btc_result.unwrap();
        assert_eq!(btc_price.oracle_count, 3);
        assert!(btc_price.is_consensus);
        assert!(btc_price.confidence > 0.8);

        let eth_result = integration_system.get_aggregated_price("ETH").await;
        assert!(eth_result.is_ok());
        
        let eth_price = eth_result.unwrap();
        assert_eq!(eth_price.oracle_count, 3);

        // 3. Test audit data retrieval
        let audit_result = integration_system.get_audit_data("Bitcoin Bridge").await;
        assert!(audit_result.is_ok());
        
        let audits = audit_result.unwrap();
        assert_eq!(audits.len(), 1);
        assert_eq!(audits[0].status, AuditStatus::Resolved);

        // 4. Test cache effectiveness (second request should be faster)
        let cache_start = std::time::Instant::now();
        let cached_btc = integration_system.get_aggregated_price("BTC").await.unwrap();
        let cache_time = cache_start.elapsed();

        // Should be from cache (faster and same timestamp)
        assert_eq!(cached_btc.timestamp, btc_price.timestamp);
        assert!(cache_time.as_millis() < 50); // Should be very fast from cache

        // 5. Wait for cache expiry and test refresh
        tokio::time::sleep(tokio::time::Duration::from_secs(4)).await;

        // Update oracle responses
        mock_server1.simulate_chainlink_response("BTC", 51000.0).await;
        mock_server2.simulate_pyth_response("BTC", 51100.0).await;
        mock_server3.simulate_band_response("BTC", 50900.0).await;

        let refreshed_btc = integration_system.get_aggregated_price("BTC").await.unwrap();
        
        // Should have updated price and timestamp
        assert!(refreshed_btc.timestamp > btc_price.timestamp);
        let refreshed_price_f64 = refreshed_btc.price.to_f64().unwrap();
        assert!(refreshed_price_f64 > 50500.0 && refreshed_price_f64 < 51500.0);

        // 6. Test oracle failure scenario
        // Make one oracle fail by using invalid endpoint
        mock_server2.set_failure_rate(1.0).await; // Make server 2 always fail

        let partial_result = integration_system.get_aggregated_price("ETH").await;
        assert!(partial_result.is_ok());
        
        let partial_price = partial_result.unwrap();
        assert_eq!(partial_price.oracle_count, 2); // Should work with 2 out of 3

        // 7. Test performance with multiple concurrent requests
        let concurrent_start = std::time::Instant::now();
        let mut concurrent_handles = Vec::new();

        for _ in 0..20 {
            let system_clone = Arc::new(integration_system.clone());
            let handle = tokio::spawn(async move {
                let btc = system_clone.get_aggregated_price("BTC").await;
                let eth = system_clone.get_aggregated_price("ETH").await;
                (btc, eth)
            });
            concurrent_handles.push(handle);
        }

        let mut concurrent_success = 0;
        for handle in concurrent_handles {
            let (btc_result, eth_result) = handle.await.expect("Task should complete");
            if btc_result.is_ok() && eth_result.is_ok() {
                concurrent_success += 1;
            }
        }

        let concurrent_time = concurrent_start.elapsed();
        assert_eq!(concurrent_success, 20);
        assert!(concurrent_time.as_millis() < 2000, "Concurrent requests took too long: {}ms", concurrent_time.as_millis());

        // 8. Verify final cache state
        let final_stats = integration_system.get_cache_stats().await.unwrap();
        assert!(final_stats.get("price_cache_entries").unwrap_or(&0) > &0);
        assert!(final_stats.get("audit_cache_entries").unwrap_or(&0) > &0);

        // 9. Test cleanup
        let clear_result = integration_system.clear_caches().await;
        assert!(clear_result.is_ok());

        let cleared_stats = integration_system.get_cache_stats().await.unwrap();
        assert_eq!(cleared_stats.get("price_cache_entries").unwrap_or(&0), &0);
        assert_eq!(cleared_stats.get("audit_cache_entries").unwrap_or(&0), &0);
    }
}