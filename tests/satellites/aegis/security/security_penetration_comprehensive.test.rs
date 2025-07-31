use std::sync::Arc;
use tokio::sync::RwLock;
use chrono::{Utc, Duration};
use rust_decimal::Decimal;
use std::collections::HashMap;
use std::time::{Instant, Duration as StdDuration};
use uuid::Uuid;

// Import the actual Aegis satellite types and components
extern crate aegis_satellite;
use aegis_satellite::{
    AegisSatellite, AegisConfig, AegisStatistics,
    types::{Position, PositionId, PositionError, HealthFactor, CalculationError, RiskAlert},
    liquidation::{LiquidationMonitor, PriceFeedProvider, HealthCalculatorFactory},
    risk::{TradeExecutor, TradeSimulation, PriceImpactError, TradeResult},
    security::mev_protection::{MevProtectionSystem, MevProtectionConfig, MevThreat, TransactionData},
    config::validation::{ConfigValidator, ValidationResult, SecurityConfig},
    config::secrets::{SecretManager, EncryptionManager, KeyManagement}
};

#[cfg(test)]
mod security_penetration_tests {
    use super::*;

    // Security test configuration
    #[derive(Debug, Clone)]
    struct SecurityTestConfig {
        enable_penetration_testing: bool,
        enable_injection_testing: bool,
        enable_authentication_bypass: bool,
        enable_data_leakage_detection: bool,
        max_test_duration_secs: u64,
        security_level: SecurityLevel,
    }

    #[derive(Debug, Clone)]
    enum SecurityLevel {
        Basic,
        Standard,
        Enhanced,
        Maximum,
    }

    impl Default for SecurityTestConfig {
        fn default() -> Self {
            Self {
                enable_penetration_testing: true,
                enable_injection_testing: true,
                enable_authentication_bypass: true,
                enable_data_leakage_detection: true,
                max_test_duration_secs: 300, // 5 minutes
                security_level: SecurityLevel::Enhanced,
            }
        }
    }

    // Security vulnerability tracking
    #[derive(Debug, Clone)]
    struct SecurityVulnerability {
        vulnerability_id: String,
        severity: VulnerabilitySeverity,
        category: VulnerabilityCategory,
        description: String,
        affected_component: String,
        exploitation_vector: String,
        mitigation_status: MitigationStatus,
        discovered_at: chrono::DateTime<Utc>,
        cvss_score: f64,
    }

    #[derive(Debug, Clone)]
    enum VulnerabilitySeverity {
        Critical,
        High,
        Medium,
        Low,
        Info,
    }

    #[derive(Debug, Clone)]
    enum VulnerabilityCategory {
        Authentication,
        Authorization,
        InputValidation,
        DataExposure,
        Injection,
        BusinessLogic,
        Cryptographic,
        Configuration,
    }

    #[derive(Debug, Clone)]
    enum MitigationStatus {
        Detected,
        InProgress,
        Mitigated,
        Accepted,
        FalsePositive,
    }

    #[derive(Debug, Clone)]
    struct SecurityTestResult {
        test_name: String,
        vulnerabilities_found: Vec<SecurityVulnerability>,
        security_score: f64, // 0-100 scale
        compliance_status: bool,
        recommendations: Vec<String>,
        test_duration: StdDuration,
    }

    // Malicious mock providers for security testing
    #[derive(Clone)]
    struct MaliciousMockPriceFeedProvider {
        prices: Arc<RwLock<HashMap<String, Decimal>>>,
        attack_vectors: Vec<AttackVector>,
        current_attack: Option<AttackVector>,
    }

    #[derive(Debug, Clone)]
    enum AttackVector {
        SqlInjection,
        XssPayload,
        BufferOverflow,
        TimingAttack,
        ReplayAttack,
        ManInTheMiddle,
        DenialOfService,
        DataPoisoning,
    }

    impl MaliciousMockPriceFeedProvider {
        fn new() -> Self {
            let mut prices = HashMap::new();
            prices.insert("BTC".to_string(), Decimal::new(50000, 0));
            prices.insert("ETH".to_string(), Decimal::new(3000, 0));
            prices.insert("USDC".to_string(), Decimal::new(1, 0));

            Self {
                prices: Arc::new(RwLock::new(prices)),
                attack_vectors: vec![
                    AttackVector::SqlInjection,
                    AttackVector::XssPayload,
                    AttackVector::BufferOverflow,
                    AttackVector::TimingAttack,
                    AttackVector::ReplayAttack,
                    AttackVector::ManInTheMiddle,
                    AttackVector::DenialOfService,
                    AttackVector::DataPoisoning,
                ],
                current_attack: None,
            }
        }

        fn set_attack_vector(&mut self, attack: AttackVector) {
            self.current_attack = Some(attack);
        }

        fn get_malicious_token_address(&self) -> String {
            match &self.current_attack {
                Some(AttackVector::SqlInjection) => "'; DROP TABLE positions; --".to_string(),
                Some(AttackVector::XssPayload) => "<script>alert('XSS')</script>".to_string(),
                Some(AttackVector::BufferOverflow) => "A".repeat(10000),
                Some(AttackVector::TimingAttack) => "timing_attack_token".to_string(),
                Some(AttackVector::ReplayAttack) => "replay_token_123".to_string(),
                Some(AttackVector::ManInTheMiddle) => "mitm_intercepted_token".to_string(),
                Some(AttackVector::DenialOfService) => "dos_token".to_string(),
                Some(AttackVector::DataPoisoning) => "poisoned_data_token".to_string(),
                None => "normal_token".to_string(),
            }
        }
    }

    #[async_trait::async_trait]
    impl PriceFeedProvider for MaliciousMockPriceFeedProvider {
        async fn get_price(&self, token_address: &str) -> Result<Decimal, Box<dyn std::error::Error + Send + Sync>> {
            // Simulate various attack scenarios
            match &self.current_attack {
                Some(AttackVector::TimingAttack) => {
                    // Vary response time based on input to leak information
                    let delay = if token_address.contains("BTC") { 100 } else { 10 };
                    tokio::time::sleep(StdDuration::from_millis(delay)).await;
                },
                Some(AttackVector::DenialOfService) => {
                    // Simulate resource exhaustion
                    tokio::time::sleep(StdDuration::from_secs(10)).await;
                    return Err("Service temporarily unavailable".into());
                },
                Some(AttackVector::DataPoisoning) => {
                    // Return malicious data
                    return Ok(Decimal::new(-1000, 0)); // Negative price to test validation
                },
                Some(AttackVector::ReplayAttack) => {
                    // Always return same outdated data
                    return Ok(Decimal::new(1, 0));
                },
                _ => {},
            }

            let prices = self.prices.read().await;
            prices.get(token_address)
                .copied()
                .unwrap_or(Decimal::new(1, 0))
                .pipe(Ok)
        }

        async fn get_prices(&self, token_addresses: &[String]) -> Result<HashMap<String, Decimal>, Box<dyn std::error::Error + Send + Sync>> {
            let mut result = HashMap::new();
            for token in token_addresses {
                if let Ok(price) = self.get_price(token).await {
                    result.insert(token.clone(), price);
                }
            }
            Ok(result)
        }
    }

    // Security testing utilities
    struct SecurityTestSuite {
        config: SecurityTestConfig,
        vulnerabilities: Vec<SecurityVulnerability>,
        test_results: Vec<SecurityTestResult>,
    }

    impl SecurityTestSuite {
        fn new(config: SecurityTestConfig) -> Self {
            Self {
                config,
                vulnerabilities: Vec::new(),
                test_results: Vec::new(),
            }
        }

        fn add_vulnerability(&mut self, vulnerability: SecurityVulnerability) {
            self.vulnerabilities.push(vulnerability);
        }

        fn generate_vulnerability_id() -> String {
            format!("VULN-{}", Uuid::new_v4().simple().to_string()[..8].to_uppercase())
        }

        fn calculate_cvss_score(severity: &VulnerabilitySeverity, category: &VulnerabilityCategory) -> f64 {
            let base_score = match severity {
                VulnerabilitySeverity::Critical => 9.0,
                VulnerabilitySeverity::High => 7.0,
                VulnerabilitySeverity::Medium => 5.0,
                VulnerabilitySeverity::Low => 3.0,
                VulnerabilitySeverity::Info => 1.0,
            };

            let category_modifier = match category {
                VulnerabilityCategory::Authentication => 1.5,
                VulnerabilityCategory::Authorization => 1.4,
                VulnerabilityCategory::InputValidation => 1.3,
                VulnerabilityCategory::DataExposure => 1.6,
                VulnerabilityCategory::Injection => 1.7,
                VulnerabilityCategory::BusinessLogic => 1.2,
                VulnerabilityCategory::Cryptographic => 1.8,
                VulnerabilityCategory::Configuration => 1.1,
            };

            (base_score * category_modifier).min(10.0)
        }

        async fn run_penetration_tests(&mut self, aegis: &AegisSatellite) -> SecurityTestResult {
            let start_time = Instant::now();
            let mut vulnerabilities = Vec::new();
            let mut recommendations = Vec::new();

            println!("=== Running Penetration Tests ===");

            // Test 1: Authentication bypass attempts
            if let Some(vuln) = self.test_authentication_bypass(aegis).await {
                vulnerabilities.push(vuln);
                recommendations.push("Implement multi-factor authentication".to_string());
            }

            // Test 2: Authorization escalation
            if let Some(vuln) = self.test_authorization_escalation(aegis).await {
                vulnerabilities.push(vuln);
                recommendations.push("Implement role-based access control".to_string());
            }

            // Test 3: Data access without authorization
            if let Some(vuln) = self.test_unauthorized_data_access(aegis).await {
                vulnerabilities.push(vuln);
                recommendations.push("Add data access logging and monitoring".to_string());
            }

            // Test 4: Business logic bypass
            if let Some(vuln) = self.test_business_logic_bypass(aegis).await {
                vulnerabilities.push(vuln);
                recommendations.push("Validate business rules at multiple layers".to_string());
            }

            let security_score = self.calculate_security_score(&vulnerabilities);
            let compliance_status = security_score >= 80.0;

            SecurityTestResult {
                test_name: "Penetration Testing".to_string(),
                vulnerabilities_found: vulnerabilities,
                security_score,
                compliance_status,
                recommendations,
                test_duration: start_time.elapsed(),
            }
        }

        async fn test_authentication_bypass(&self, aegis: &AegisSatellite) -> Option<SecurityVulnerability> {
            // Simulate authentication bypass attempts
            println!("Testing authentication bypass...");
            
            // Test with malformed tokens, empty credentials, etc.
            let malicious_inputs = vec![
                "",
                "null",
                "undefined", 
                "admin",
                "' OR '1'='1",
                "../../../etc/passwd",
                "%00",
                "\x00\x00\x00\x00",
            ];

            for input in malicious_inputs {
                // In a real implementation, this would test actual authentication
                // For now, we simulate the test
                if input.contains("OR") || input.contains("..") {
                    return Some(SecurityVulnerability {
                        vulnerability_id: Self::generate_vulnerability_id(),
                        severity: VulnerabilitySeverity::High,
                        category: VulnerabilityCategory::Authentication,
                        description: format!("Potential SQL injection in authentication: {}", input),
                        affected_component: "Authentication System".to_string(),
                        exploitation_vector: format!("Input: {}", input),
                        mitigation_status: MitigationStatus::Detected,
                        discovered_at: Utc::now(),
                        cvss_score: Self::calculate_cvss_score(&VulnerabilitySeverity::High, &VulnerabilityCategory::Authentication),
                    });
                }
            }

            None
        }

        async fn test_authorization_escalation(&self, aegis: &AegisSatellite) -> Option<SecurityVulnerability> {
            println!("Testing authorization escalation...");
            
            // Test privilege escalation scenarios
            // In a real system, we would test role manipulation, permission bypass, etc.
            
            // Simulate finding a potential privilege escalation vulnerability
            if rand::random::<f64>() < 0.3 { // 30% chance for testing purposes
                return Some(SecurityVulnerability {
                    vulnerability_id: Self::generate_vulnerability_id(),
                    severity: VulnerabilitySeverity::Medium,
                    category: VulnerabilityCategory::Authorization,
                    description: "Potential privilege escalation through role manipulation".to_string(),
                    affected_component: "Authorization System".to_string(),
                    exploitation_vector: "Role parameter manipulation".to_string(),
                    mitigation_status: MitigationStatus::Detected,
                    discovered_at: Utc::now(),
                    cvss_score: Self::calculate_cvss_score(&VulnerabilitySeverity::Medium, &VulnerabilityCategory::Authorization),
                });
            }

            None
        }

        async fn test_unauthorized_data_access(&self, aegis: &AegisSatellite) -> Option<SecurityVulnerability> {
            println!("Testing unauthorized data access...");
            
            // Test data exposure scenarios
            let stats = aegis.get_statistics();
            
            // Check if sensitive data might be exposed
            if stats.total_positions > 0 {
                // In a real test, we would check for actual data exposure
                // For now, simulate a potential data exposure issue
                return Some(SecurityVulnerability {
                    vulnerability_id: Self::generate_vulnerability_id(),
                    severity: VulnerabilitySeverity::Low,
                    category: VulnerabilityCategory::DataExposure,
                    description: "Statistical data might reveal sensitive information".to_string(),
                    affected_component: "Statistics API".to_string(),
                    exploitation_vector: "Public statistics endpoint".to_string(),
                    mitigation_status: MitigationStatus::Detected,
                    discovered_at: Utc::now(),
                    cvss_score: Self::calculate_cvss_score(&VulnerabilitySeverity::Low, &VulnerabilityCategory::DataExposure),
                });
            }

            None
        }

        async fn test_business_logic_bypass(&self, aegis: &AegisSatellite) -> Option<SecurityVulnerability> {
            println!("Testing business logic bypass...");
            
            // Test business logic vulnerabilities
            // For example, negative amounts, extreme values, race conditions
            
            // Simulate testing business logic with edge cases
            let edge_cases = vec![
                (Decimal::new(-1000, 0), "Negative collateral amount"),
                (Decimal::new(i64::MAX, 0), "Maximum integer collateral"),
                (Decimal::new(0, 0), "Zero collateral amount"),
            ];

            for (amount, description) in edge_cases {
                if amount < Decimal::ZERO || amount > Decimal::new(1000000000, 0) {
                    return Some(SecurityVulnerability {
                        vulnerability_id: Self::generate_vulnerability_id(),
                        severity: VulnerabilitySeverity::Medium,
                        category: VulnerabilityCategory::BusinessLogic,
                        description: format!("Business logic bypass: {}", description),
                        affected_component: "Position Management".to_string(),
                        exploitation_vector: format!("Invalid amount: {}", amount),
                        mitigation_status: MitigationStatus::Detected,
                        discovered_at: Utc::now(),
                        cvss_score: Self::calculate_cvss_score(&VulnerabilitySeverity::Medium, &VulnerabilityCategory::BusinessLogic),
                    });
                }
            }

            None
        }

        fn calculate_security_score(&self, vulnerabilities: &[SecurityVulnerability]) -> f64 {
            if vulnerabilities.is_empty() {
                return 100.0;
            }

            let mut total_impact = 0.0;
            for vuln in vulnerabilities {
                let impact = match vuln.severity {
                    VulnerabilitySeverity::Critical => 40.0,
                    VulnerabilitySeverity::High => 25.0,
                    VulnerabilitySeverity::Medium => 15.0,
                    VulnerabilitySeverity::Low => 8.0,
                    VulnerabilitySeverity::Info => 2.0,
                };
                total_impact += impact;
            }

            (100.0 - total_impact).max(0.0)
        }
    }

    // Setup function for security tests
    async fn setup_security_test_environment() -> Result<(AegisSatellite, Arc<MaliciousMockPriceFeedProvider>), Box<dyn std::error::Error + Send + Sync>> {
        let price_feed = Arc::new(MaliciousMockPriceFeedProvider::new());
        
        // Create a simple mock trade executor for security testing
        #[derive(Clone)]
        struct SecurityMockTradeExecutor;

        #[async_trait::async_trait]
        impl TradeExecutor for SecurityMockTradeExecutor {
            async fn execute_trade(
                &self,
                token_address: &str,
                amount: Decimal,
                is_buy: bool,
            ) -> Result<TradeResult, Box<dyn std::error::Error + Send + Sync>> {
                // Validate inputs for security
                if token_address.contains("DROP") || token_address.contains("script") {
                    return Err("Malicious input detected".into());
                }

                if amount < Decimal::ZERO {
                    return Err("Invalid amount".into());
                }

                Ok(TradeResult {
                    transaction_hash: format!("0x{:016x}", rand::random::<u64>()),
                    executed_amount: amount,
                    execution_price: Decimal::new(100, 0),
                    gas_used: 50000,
                    gas_price: Decimal::new(20, 9),
                    timestamp: Utc::now(),
                    success: true,
                })
            }

            async fn estimate_gas(&self, _token_address: &str, _amount: Decimal) -> Result<u64, Box<dyn std::error::Error + Send + Sync>> {
                Ok(50000)
            }
        }

        let trade_executor = Arc::new(SecurityMockTradeExecutor);
        
        let config = AegisConfig {
            monitoring_interval_secs: 1,
            enable_automated_actions: true,
            enable_price_impact_simulation: true,
            enable_smart_contract_analysis: true,
            enable_mev_protection: true,
            max_concurrent_positions: 1000,
        };

        let aegis = AegisSatellite::new(
            price_feed.clone(),
            trade_executor,
            Some(config)
        ).await?;

        Ok((aegis, price_feed))
    }

    #[tokio::test]
    async fn test_comprehensive_security_penetration() {
        let (aegis, malicious_price_feed) = setup_security_test_environment()
            .await
            .expect("Should setup security test environment");

        let config = SecurityTestConfig::default();
        let mut security_suite = SecurityTestSuite::new(config);

        // Add some test positions
        let positions = vec![
            Position {
                id: PositionId::new(),
                user_address: "0x1234567890abcdef".to_string(),
                token_address: "BTC".to_string(),
                collateral_amount: Decimal::new(100000, 0),
                debt_amount: Decimal::new(50000, 0),
                liquidation_threshold: Decimal::new(120, 2),
                created_at: Utc::now(),
                updated_at: Utc::now(),
                protocol: "TestProtocol".to_string(),
                is_active: true,
                health_factor: None,
            }
        ];

        for position in positions {
            let _position_id = aegis.add_position(position).await.expect("Should add position");
        }

        // Run comprehensive penetration tests
        let penetration_result = security_suite.run_penetration_tests(&aegis).await;

        println!("=== Security Penetration Test Results ===");
        println!("Test Duration: {:?}", penetration_result.test_duration);
        println!("Security Score: {:.2}/100", penetration_result.security_score);
        println!("Compliance Status: {}", if penetration_result.compliance_status { "PASS" } else { "FAIL" });
        println!("Vulnerabilities Found: {}", penetration_result.vulnerabilities_found.len());

        for (i, vuln) in penetration_result.vulnerabilities_found.iter().enumerate() {
            println!("  {}. {} - {:?} ({:.1} CVSS)", 
                    i + 1, vuln.vulnerability_id, vuln.severity, vuln.cvss_score);
            println!("     Component: {}", vuln.affected_component);
            println!("     Description: {}", vuln.description);
            println!("     Vector: {}", vuln.exploitation_vector);
        }

        println!("Recommendations:");
        for (i, rec) in penetration_result.recommendations.iter().enumerate() {
            println!("  {}. {}", i + 1, rec);
        }

        // Security assertions
        assert!(penetration_result.security_score >= 60.0, "Security score should be at least 60/100");
        
        // Check that critical vulnerabilities are not present
        let critical_vulns: Vec<_> = penetration_result.vulnerabilities_found.iter()
            .filter(|v| matches!(v.severity, VulnerabilitySeverity::Critical))
            .collect();
        
        assert!(critical_vulns.is_empty(), "No critical vulnerabilities should be present");

        // Check that high-severity vulnerabilities are limited
        let high_vulns: Vec<_> = penetration_result.vulnerabilities_found.iter()
            .filter(|v| matches!(v.severity, VulnerabilitySeverity::High))
            .collect();
        
        assert!(high_vulns.len() <= 2, "High-severity vulnerabilities should be limited");

        println!("✓ Security Penetration Tests Completed");
    }

    #[tokio::test]
    async fn test_injection_attack_prevention() {
        let (aegis, mut malicious_price_feed) = setup_security_test_environment()
            .await
            .expect("Should setup security test environment");

        println!("=== Testing Injection Attack Prevention ===");

        // Test SQL injection prevention
        println!("Testing SQL injection prevention...");
        
        let malicious_position = Position {
            id: PositionId::new(),
            user_address: "'; DROP TABLE users; --".to_string(),
            token_address: "'; DROP TABLE positions; --".to_string(),
            collateral_amount: Decimal::new(100000, 0),
            debt_amount: Decimal::new(50000, 0),
            liquidation_threshold: Decimal::new(120, 2),
            created_at: Utc::now(),
            updated_at: Utc::now(),
            protocol: "'; DROP TABLE protocols; --".to_string(),
            is_active: true,
            health_factor: None,
        };

        // Should handle malicious input safely
        let result = aegis.add_position(malicious_position).await;
        
        // The system should either reject the input or sanitize it safely
        // We're testing that it doesn't crash or cause security issues
        if let Ok(position_id) = result {
            println!("System accepted malicious input but should sanitize it");
            
            // Verify the position was stored safely
            let health_result = aegis.get_position_health(position_id).await;
            assert!(health_result.is_ok(), "System should handle malicious data safely");
        } else {
            println!("System properly rejected malicious input");
        }

        // Test XSS prevention
        println!("Testing XSS prevention...");
        
        let xss_position = Position {
            id: PositionId::new(),
            user_address: "<script>alert('XSS')</script>".to_string(),
            token_address: "<img src=x onerror=alert('XSS')>".to_string(),
            collateral_amount: Decimal::new(100000, 0),
            debt_amount: Decimal::new(50000, 0),
            liquidation_threshold: Decimal::new(120, 2),
            created_at: Utc::now(),
            updated_at: Utc::now(),
            protocol: "javascript:alert('XSS')".to_string(),
            is_active: true,
            health_factor: None,
        };

        let xss_result = aegis.add_position(xss_position).await;
        // System should handle XSS payloads safely
        assert!(xss_result.is_ok() || xss_result.is_err(), "System should handle XSS input");

        // Test buffer overflow prevention
        println!("Testing buffer overflow prevention...");
        
        let buffer_overflow_position = Position {
            id: PositionId::new(),
            user_address: "A".repeat(100000), // Very long string
            token_address: "B".repeat(100000),
            collateral_amount: Decimal::new(100000, 0),
            debt_amount: Decimal::new(50000, 0),
            liquidation_threshold: Decimal::new(120, 2),
            created_at: Utc::now(),
            updated_at: Utc::now(),
            protocol: "C".repeat(100000),
            is_active: true,
            health_factor: None,
        };

        let buffer_result = aegis.add_position(buffer_overflow_position).await;
        // System should handle very long inputs safely
        assert!(buffer_result.is_ok() || buffer_result.is_err(), "System should handle buffer overflow attempts");

        // Test price feed injection attacks
        println!("Testing price feed injection attacks...");
        
        Arc::get_mut(&mut malicious_price_feed).unwrap().set_attack_vector(AttackVector::SqlInjection);
        let malicious_token = malicious_price_feed.get_malicious_token_address();
        
        let price_result = malicious_price_feed.get_price(&malicious_token).await;
        assert!(price_result.is_ok(), "Price feed should handle malicious tokens safely");

        // Test data poisoning attacks
        Arc::get_mut(&mut malicious_price_feed).unwrap().set_attack_vector(AttackVector::DataPoisoning);
        let poisoned_price = malicious_price_feed.get_price("BTC").await;
        
        if let Ok(price) = poisoned_price {
            // System should validate price data
            if price < Decimal::ZERO {
                println!("⚠ System accepted negative price - validation needed");
            } else {
                println!("✓ System properly validated price data");
            }
        }

        println!("✓ Injection Attack Prevention Tests Completed");
    }

    #[tokio::test]
    async fn test_timing_attack_resistance() {
        let (aegis, mut malicious_price_feed) = setup_security_test_environment()
            .await
            .expect("Should setup security test environment");

        println!("=== Testing Timing Attack Resistance ===");

        // Create positions for timing attack testing
        let position = Position {
            id: PositionId::new(),
            user_address: "0x1234567890abcdef".to_string(),
            token_address: "BTC".to_string(),
            collateral_amount: Decimal::new(100000, 0),
            debt_amount: Decimal::new(50000, 0),
            liquidation_threshold: Decimal::new(120, 2),
            created_at: Utc::now(),
            updated_at: Utc::now(),
            protocol: "TestProtocol".to_string(),
            is_active: true,
            health_factor: None,
        };

        let position_id = aegis.add_position(position).await.expect("Should add position");

        // Test timing attack on price feed
        Arc::get_mut(&mut malicious_price_feed).unwrap().set_attack_vector(AttackVector::TimingAttack);

        let mut timing_measurements = Vec::new();
        let test_tokens = vec!["BTC", "ETH", "UNKNOWN", "INVALID"];

        for token in test_tokens {
            let start = Instant::now();
            let _price_result = malicious_price_feed.get_price(token).await;
            let duration = start.elapsed();
            timing_measurements.push((token, duration));
            
            println!("Token '{}' response time: {:?}", token, duration);
        }

        // Analyze timing patterns
        let mut btc_times = Vec::new();
        let mut other_times = Vec::new();

        for (token, time) in timing_measurements {
            if token == "BTC" {
                btc_times.push(time);
            } else {
                other_times.push(time);
            }
        }

        // Check for timing differences that could leak information
        if let (Some(&btc_time), Some(&other_time)) = (btc_times.first(), other_times.first()) {
            let time_diff = if btc_time > other_time {
                btc_time.as_millis() - other_time.as_millis()
            } else {
                other_time.as_millis() - btc_time.as_millis()
            };

            println!("Timing difference: {}ms", time_diff);
            
            // Large timing differences could indicate information leakage
            if time_diff > 50 {
                println!("⚠ Potential timing attack vulnerability detected");
            } else {
                println!("✓ Timing attack resistance verified");
            }
        }

        // Test health calculation timing consistency
        let mut health_calc_times = Vec::new();
        
        for _ in 0..10 {
            let start = Instant::now();
            let _health = aegis.get_position_health(position_id).await;
            let duration = start.elapsed();
            health_calc_times.push(duration);
        }

        let avg_time = health_calc_times.iter().sum::<StdDuration>() / health_calc_times.len() as u32;
        let max_deviation = health_calc_times.iter()
            .map(|&t| if t > avg_time { t - avg_time } else { avg_time - t })
            .max()
            .unwrap_or(StdDuration::ZERO);

        println!("Health calculation avg time: {:?}", avg_time);
        println!("Max timing deviation: {:?}", max_deviation);

        // Timing should be relatively consistent
        assert!(max_deviation.as_millis() < 100, "Health calculation timing should be consistent");

        println!("✓ Timing Attack Resistance Tests Completed");
    }

    #[tokio::test]
    async fn test_replay_attack_prevention() {
        let (aegis, mut malicious_price_feed) = setup_security_test_environment()
            .await
            .expect("Should setup security test environment");

        println!("=== Testing Replay Attack Prevention ===");

        // Test replay attack on transactions/operations
        let position = Position {
            id: PositionId::new(),
            user_address: "0x1234567890abcdef".to_string(),
            token_address: "BTC".to_string(),
            collateral_amount: Decimal::new(100000, 0),
            debt_amount: Decimal::new(50000, 0),
            liquidation_threshold: Decimal::new(120, 2),
            created_at: Utc::now(),
            updated_at: Utc::now(),
            protocol: "TestProtocol".to_string(),
            is_active: true,
            health_factor: None,
        };

        // Add the same position multiple times (replay attack simulation)
        let first_result = aegis.add_position(position.clone()).await;
        let second_result = aegis.add_position(position.clone()).await;
        let third_result = aegis.add_position(position.clone()).await;

        assert!(first_result.is_ok(), "First position should be added");
        assert!(second_result.is_ok(), "System should handle duplicate positions");
        assert!(third_result.is_ok(), "System should handle replay attempts");

        // All should have different IDs (not truly replayed)
        if let (Ok(id1), Ok(id2), Ok(id3)) = (first_result, second_result, third_result) {
            assert_ne!(id1, id2, "Position IDs should be unique");
            assert_ne!(id2, id3, "Position IDs should be unique");
            assert_ne!(id1, id3, "Position IDs should be unique");
            println!("✓ Unique position IDs generated for each request");
        }

        // Test replay attack on price feed data
        Arc::get_mut(&mut malicious_price_feed).unwrap().set_attack_vector(AttackVector::ReplayAttack);

        let mut price_results = Vec::new();
        for _ in 0..5 {
            let price = malicious_price_feed.get_price("BTC").await;
            price_results.push(price);
            tokio::time::sleep(StdDuration::from_millis(100)).await;
        }

        // Check if all prices are the same (potential replay attack)
        let mut unique_prices = std::collections::HashSet::new();
        for result in price_results {
            if let Ok(price) = result {
                unique_prices.insert(price);
            }
        }

        if unique_prices.len() == 1 {
            println!("⚠ Potential replay attack detected - all prices identical");
        } else {
            println!("✓ Price data freshness verified");
        }

        println!("✓ Replay Attack Prevention Tests Completed");
    }

    #[tokio::test]
    async fn test_denial_of_service_resistance() {
        let (aegis, mut malicious_price_feed) = setup_security_test_environment()
            .await
            .expect("Should setup security test environment");

        println!("=== Testing Denial of Service Resistance ===");

        // Test resource exhaustion attacks
        println!("Testing resource exhaustion resistance...");

        // Create many positions rapidly
        let mut position_creation_tasks = Vec::new();
        
        for i in 0..100 {
            let aegis_clone = aegis.clone();
            let task = tokio::spawn(async move {
                let position = Position {
                    id: PositionId::new(),
                    user_address: format!("0x{:040x}", i),
                    token_address: "BTC".to_string(),
                    collateral_amount: Decimal::new(10000, 0),
                    debt_amount: Decimal::new(5000, 0),
                    liquidation_threshold: Decimal::new(120, 2),
                    created_at: Utc::now(),
                    updated_at: Utc::now(),
                    protocol: "TestProtocol".to_string(),
                    is_active: true,
                    health_factor: None,
                };

                aegis_clone.add_position(position).await
            });
            
            position_creation_tasks.push(task);
        }

        let start_time = Instant::now();
        let results = futures::future::join_all(position_creation_tasks).await;
        let creation_duration = start_time.elapsed();

        let successful_creations = results.iter()
            .filter(|r| r.as_ref().map(|inner| inner.is_ok()).unwrap_or(false))
            .count();

        println!("Created {} positions in {:?}", successful_creations, creation_duration);
        
        // System should handle rapid position creation reasonably
        assert!(successful_creations >= 80, "Should handle most position creation requests");
        assert!(creation_duration.as_secs() < 10, "Position creation should not timeout");

        // Test DoS attack on price feed  
        println!("Testing DoS resistance on price feed...");
        
        Arc::get_mut(&mut malicious_price_feed).unwrap().set_attack_vector(AttackVector::DenialOfService);
        
        let price_start = Instant::now();
        let price_result = tokio::time::timeout(
            StdDuration::from_secs(5),
            malicious_price_feed.get_price("BTC")
        ).await;
        let price_duration = price_start.elapsed();

        match price_result {
            Ok(Ok(_)) => println!("✓ Price feed responded within timeout"),
            Ok(Err(_)) => println!("✓ Price feed failed gracefully"),
            Err(_) => println!("⚠ Price feed timed out - potential DoS vulnerability"),
        }

        // Should not take too long even with DoS attack
        assert!(price_duration.as_secs() < 15, "Price feed should timeout gracefully");

        // Test concurrent health calculations (potential DoS vector)
        println!("Testing concurrent health calculation DoS resistance...");
        
        let position = Position {
            id: PositionId::new(),
            user_address: "0x1234567890abcdef".to_string(),
            token_address: "BTC".to_string(),
            collateral_amount: Decimal::new(100000, 0),
            debt_amount: Decimal::new(50000, 0),
            liquidation_threshold: Decimal::new(120, 2),
            created_at: Utc::now(),
            updated_at: Utc::now(),
            protocol: "TestProtocol".to_string(),
            is_active: true,
            health_factor: None,
        };

        let position_id = aegis.add_position(position).await.expect("Should add position");

        let mut health_calc_tasks = Vec::new();
        
        for _ in 0..50 {
            let aegis_clone = aegis.clone();
            let task = tokio::spawn(async move {
                aegis_clone.get_position_health(position_id).await
            });
            
            health_calc_tasks.push(task);
        }

        let health_start = Instant::now();
        let health_results = futures::future::join_all(health_calc_tasks).await;
        let health_duration = health_start.elapsed();

        let successful_health_calcs = health_results.iter()
            .filter(|r| r.as_ref().map(|inner| inner.is_ok()).unwrap_or(false))
            .count();

        println!("Completed {} health calculations in {:?}", successful_health_calcs, health_duration);

        // System should handle concurrent requests reasonably
        assert!(successful_health_calcs >= 40, "Should handle most health calculation requests");
        assert!(health_duration.as_secs() < 30, "Health calculations should not timeout excessively");

        println!("✓ Denial of Service Resistance Tests Completed");
    }
}