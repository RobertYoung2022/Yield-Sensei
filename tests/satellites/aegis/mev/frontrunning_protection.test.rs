use std::sync::Arc;
use tokio::sync::RwLock;
use chrono::{Utc, Duration};
use rust_decimal::Decimal;
use rust_decimal::prelude::FromPrimitive;
use std::collections::HashMap;

// Import the actual Aegis satellite MEV protection types
extern crate aegis_satellite;
use aegis_satellite::security::mev_protection::{
    MevProtectionConfig, MevProtectionSystem, MevThreat, MevThreatType, MevThreatSeverity,
    TransactionData, ProtectedExecutionRoute, ProtectionLevel, ExecutionStrategy,
    RiskAssessment, PrivateMempool, MevResistantRelayer, TimingAnalyzer
};

// Additional test-specific structures
#[derive(Debug, Clone)]
pub struct FrontrunningPattern {
    pub pattern_id: String,
    pub frontrunner_txs: Vec<TransactionData>,
    pub victim_tx: TransactionData,
    pub avg_gas_premium: f64,
    pub timing_advantage_ms: i64,
    pub estimated_mev_profit: f64,
    pub detection_confidence: f64,
    pub attack_vector: String,
}

#[derive(Debug, Clone)]
pub struct FrontrunProtectionMetrics {
    pub total_transactions_analyzed: u64,
    pub frontrunning_patterns_detected: u64,
    pub false_positives: u64,
    pub successful_preventions: u64,
    pub avg_detection_time_ms: f64,
    pub protection_success_rate: f64,
}

#[derive(Debug, Clone)]
pub struct TimingAnalysisResult {
    pub optimal_submission_time: chrono::DateTime<Utc>,
    pub recommended_gas_boost: f64,
    pub mempool_congestion_score: f64,
    pub frontrun_risk_score: f64,
}

// Mock frontrunning protection system for advanced testing
pub struct MockFrontrunProtection {
    system: MevProtectionSystem,
    detected_patterns: Arc<RwLock<HashMap<String, FrontrunningPattern>>>,
    protection_metrics: Arc<RwLock<FrontrunProtectionMetrics>>,
    pub patterns_prevented: u64,
    pub gas_costs_saved: f64,
    pub protection_success_rate: f64,
    pub average_detection_time_ms: f64,
    pub false_positive_rate: f64,
}

impl Default for ProtectionMetrics {
    fn default() -> Self {
        Self {
            patterns_detected: 0,
            patterns_prevented: 0,
            gas_costs_saved: 0.0,
            protection_success_rate: 0.0,
            average_detection_time_ms: 0.0,
            false_positive_rate: 0.0,
        }
    }
}

pub struct MockFrontrunningProtection {
    config: MevProtectionConfig,
    detected_patterns: Arc<RwLock<HashMap<String, FrontrunningPattern>>>,
    transaction_history: Arc<RwLock<Vec<TransactionData>>>,
    protection_metrics: Arc<RwLock<ProtectionMetrics>>,
    mempool_monitor: Arc<RwLock<HashMap<String, TransactionData>>>,
    gas_price_oracle: Arc<RwLock<f64>>,
}

impl MockFrontrunningProtection {
    pub fn new(config: MevProtectionConfig) -> Self {
        Self {
            config,
            detected_patterns: Arc::new(RwLock::new(HashMap::new())),
            transaction_history: Arc::new(RwLock::new(Vec::new())),
            protection_metrics: Arc::new(RwLock::new(ProtectionMetrics::default())),
            mempool_monitor: Arc::new(RwLock::new(HashMap::new())),
            gas_price_oracle: Arc::new(RwLock::new(25.0)),
        }
    }

    pub async fn detect_frontrunning_threats(
        &self,
        target_transaction: &TransactionData,
        mempool_transactions: &[TransactionData],
    ) -> Vec<MevThreat> {
        if !self.config.enable_frontrunning_protection {
            return vec![];
        }

        let mut threats = Vec::new();
        let detection_window = Duration::seconds(self.config.frontrunning_detection_window_seconds as i64);
        let window_start = target_transaction.timestamp - detection_window;

        // Find potential frontrunning transactions
        let potential_frontrunners: Vec<&TransactionData> = mempool_transactions
            .iter()
            .filter(|tx| {
                tx.timestamp >= window_start
                    && tx.timestamp < target_transaction.timestamp
                    && tx.to_address == target_transaction.to_address
                    && tx.gas_price > target_transaction.gas_price
                    && self.has_similar_function(tx, target_transaction)
            })
            .collect();

        for frontrunner in potential_frontrunners {
            let gas_premium = self.calculate_gas_premium(frontrunner, target_transaction);
            let timing_advantage = self.calculate_timing_advantage(frontrunner, target_transaction);
            let potential_profit = self.estimate_frontrunning_profit(frontrunner, target_transaction);
            let confidence = self.calculate_frontrunning_confidence(frontrunner, target_transaction, gas_premium, timing_advantage);

            if confidence >= self.config.confidence_threshold {
                let severity = self.determine_frontrunning_severity(potential_profit, gas_premium);
                
                threats.push(MevThreat {
                    threat_type: MevThreatType::Frontrunning,
                    severity,
                    estimated_loss: potential_profit,
                    description: format!(
                        "Frontrunning detected: {} frontran {} with {}% gas premium and {}ms timing advantage",
                        frontrunner.hash, target_transaction.hash, (gas_premium * 100.0) as u32, timing_advantage
                    ),
                    confidence,
                    timestamp: Utc::now(),
                    transaction_hash: Some(target_transaction.hash.clone()),
                    affected_addresses: vec![
                        frontrunner.from_address.clone(),
                        target_transaction.from_address.clone(),
                    ],
                    mitigation_strategies: vec![
                        "Use private mempool".to_string(),
                        "Increase gas price".to_string(),
                        "Use MEV-protected relayer".to_string(),
                        "Implement commit-reveal scheme".to_string(),
                    ],
                });

                // Store detected pattern
                let pattern = FrontrunningPattern {
                    pattern_id: format!("frontrun_{}_{}", frontrunner.hash, target_transaction.hash),
                    frontrunner_tx: frontrunner.clone(),
                    victim_tx: target_transaction.clone(),
                    gas_premium,
                    timing_advantage_ms: timing_advantage,
                    potential_profit,
                    confidence,
                };

                self.detected_patterns.write().await.insert(pattern.pattern_id.clone(), pattern);
            }
        }

        // Update metrics
        let mut metrics = self.protection_metrics.write().await;
        metrics.patterns_detected += threats.len() as u64;

        threats
    }

    pub async fn generate_protection_route(
        &self,
        transaction: &TransactionData,
        threats: &[MevThreat],
    ) -> Option<ProtectionRoute> {
        if threats.is_empty() {
            return None;
        }

        let max_threat_severity = threats.iter()
            .map(|t| &t.severity)
            .max()
            .unwrap_or(&MevThreatSeverity::Low);

        let (strategy, protection_level, gas_multiplier) = match max_threat_severity {
            MevThreatSeverity::Critical => ("private_mempool", 10, 1.5),
            MevThreatSeverity::High => ("flashbots_bundle", 8, 1.3),
            MevThreatSeverity::Medium => ("gas_boost", 6, 1.2),
            MevThreatSeverity::Low => ("timing_delay", 4, 1.1),
        };

        let estimated_gas = (transaction.gas_used as f64 * gas_multiplier) as u64;
        let gas_price = self.gas_price_oracle.read().await;
        let estimated_cost = Decimal::from_f64(estimated_gas as f64 * gas_price).unwrap_or(Decimal::ZERO);

        Some(ProtectionRoute {
            route_id: format!("frontrun_protection_{}", transaction.hash),
            strategy: strategy.to_string(),
            estimated_gas,
            estimated_cost,
            protection_level,
            success_probability: self.calculate_protection_success_rate(threats).await,
        })
    }

    pub async fn simulate_protection_effectiveness(
        &self,
        original_tx: &TransactionData,
        protection_route: &ProtectionRoute,
    ) -> bool {
        // Simulate whether protection would be effective
        let base_success_rate = protection_route.success_probability;
        let random_factor = (original_tx.block_number % 100) as f64 / 100.0;
        
        random_factor < base_success_rate
    }

    fn has_similar_function(&self, tx1: &TransactionData, tx2: &TransactionData) -> bool {
        // Check if transactions have similar function selectors or input patterns
        match (&tx1.function_selector, &tx2.function_selector) {
            (Some(sel1), Some(sel2)) => sel1 == sel2,
            _ => {
                // Fallback to input data pattern matching
                if tx1.input_data.len() >= 10 && tx2.input_data.len() >= 10 {
                    tx1.input_data[..10] == tx2.input_data[..10]
                } else {
                    false
                }
            }
        }
    }

    fn calculate_gas_premium(&self, frontrunner: &TransactionData, victim: &TransactionData) -> f64 {
        let frontrunner_gas = frontrunner.gas_price.to_f64().unwrap_or(0.0);
        let victim_gas = victim.gas_price.to_f64().unwrap_or(1.0);
        
        (frontrunner_gas - victim_gas) / victim_gas
    }

    fn calculate_timing_advantage(&self, frontrunner: &TransactionData, victim: &TransactionData) -> i64 {
        (victim.timestamp - frontrunner.timestamp).num_milliseconds()
    }

    fn estimate_frontrunning_profit(&self, frontrunner: &TransactionData, victim: &TransactionData) -> f64 {
        // Simplified profit estimation based on gas costs and transaction value
        let gas_cost_diff = (frontrunner.gas_price.to_f64().unwrap_or(0.0) - victim.gas_price.to_f64().unwrap_or(0.0))
            * frontrunner.gas_used as f64;
        
        let value_based_profit = victim.value.to_f64().unwrap_or(0.0) * 0.005; // Assume 0.5% profit opportunity
        
        gas_cost_diff + value_based_profit
    }

    fn calculate_frontrunning_confidence(
        &self,
        frontrunner: &TransactionData,
        victim: &TransactionData,
        gas_premium: f64,
        timing_advantage: i64,
    ) -> f64 {
        let mut confidence = 0.3; // Base confidence

        // Gas premium confidence
        if gas_premium > 0.1 { confidence += 0.2; }
        if gas_premium > 0.5 { confidence += 0.2; }

        // Timing confidence
        if timing_advantage > 0 && timing_advantage < 30000 { confidence += 0.2; } // Within 30 seconds

        // Function similarity confidence
        if self.has_similar_function(frontrunner, victim) { confidence += 0.3; }

        // Same target contract confidence
        if frontrunner.to_address == victim.to_address { confidence += 0.1; }

        confidence.min(1.0)
    }

    fn determine_frontrunning_severity(&self, profit: f64, gas_premium: f64) -> MevThreatSeverity {
        if profit > 10.0 || gas_premium > 2.0 {
            MevThreatSeverity::Critical
        } else if profit > 1.0 || gas_premium > 0.5 {
            MevThreatSeverity::High
        } else if profit > 0.1 || gas_premium > 0.2 {
            MevThreatSeverity::Medium
        } else {
            MevThreatSeverity::Low
        }
    }

    async fn calculate_protection_success_rate(&self, threats: &[MevThreat]) -> f64 {
        let avg_confidence: f64 = threats.iter().map(|t| t.confidence).sum::<f64>() / threats.len() as f64;
        0.95 - (avg_confidence * 0.1) // Higher threat confidence = lower protection success rate
    }

    pub async fn get_protection_metrics(&self) -> ProtectionMetrics {
        self.protection_metrics.read().await.clone()
    }

    pub async fn update_mempool(&self, transactions: Vec<TransactionData>) {
        let mut mempool = self.mempool_monitor.write().await;
        for tx in transactions {
            mempool.insert(tx.hash.clone(), tx);
        }
    }

    pub async fn get_detected_patterns(&self) -> HashMap<String, FrontrunningPattern> {
        self.detected_patterns.read().await.clone()
    }
}

// Test implementations

#[tokio::test]
async fn test_classic_frontrunning_detection() {
    let config = MevProtectionConfig::default();
    let protection = MockFrontrunningProtection::new(config);

    let victim_tx = TransactionData {
        hash: "0xvictim123".to_string(),
        from_address: "0xvictim".to_string(),
        to_address: "0xcontract".to_string(),
        value: Decimal::from(1000),
        gas_used: 21000,
        gas_price: Decimal::from(25),
        timestamp: Utc::now(),
        function_selector: Some("0xa9059cbb".to_string()), // transfer
        input_data: "0xa9059cbb000000000000000000000000".to_string(),
        success: true,
        block_number: 100,
        transaction_index: 1,
    };

    let frontrunner_tx = TransactionData {
        hash: "0xfrontrunner123".to_string(),
        from_address: "0xfrontrunner".to_string(),
        to_address: "0xcontract".to_string(),
        value: Decimal::from(1000),
        gas_used: 21000,
        gas_price: Decimal::from(50), // 100% gas premium
        timestamp: victim_tx.timestamp - Duration::seconds(5),
        function_selector: Some("0xa9059cbb".to_string()), // Same function
        input_data: "0xa9059cbb000000000000000000000000".to_string(),
        success: true,
        block_number: 100,
        transaction_index: 0,
    };

    let mempool_txs = vec![frontrunner_tx];
    let threats = protection.detect_frontrunning_threats(&victim_tx, &mempool_txs).await;

    assert_eq!(threats.len(), 1);
    assert_eq!(threats[0].threat_type, MevThreatType::Frontrunning);
    assert!(threats[0].confidence >= 0.7);
    assert!(threats[0].estimated_loss > 0.0);
}

#[tokio::test]
async fn test_gas_premium_severity_classification() {
    let config = MevProtectionConfig::default();
    let protection = MockFrontrunningProtection::new(config);

    let base_tx = TransactionData {
        hash: "0xbase123".to_string(),
        from_address: "0xuser".to_string(),
        to_address: "0xcontract".to_string(),
        value: Decimal::from(100),
        gas_used: 21000,
        gas_price: Decimal::from(20),
        timestamp: Utc::now(),
        function_selector: Some("0xa9059cbb".to_string()),
        input_data: "0xa9059cbb000000000000000000000000".to_string(),
        success: true,
        block_number: 100,
        transaction_index: 1,
    };

    // Test different gas premiums for severity classification
    let test_cases = vec![
        (25, MevThreatSeverity::Low),     // 25% premium
        (30, MevThreatSeverity::Medium),  // 50% premium  
        (40, MevThreatSeverity::High),    // 100% premium
        (60, MevThreatSeverity::Critical), // 200% premium
    ];

    for (gas_price, expected_severity) in test_cases {
        let frontrunner_tx = TransactionData {
            gas_price: Decimal::from(gas_price),
            timestamp: base_tx.timestamp - Duration::seconds(3),
            ..base_tx.clone()
        };

        let threats = protection.detect_frontrunning_threats(&base_tx, &vec![frontrunner_tx]).await;
        
        if !threats.is_empty() {
            assert_eq!(threats[0].severity, expected_severity);
        }
    }
}

#[tokio::test]
async fn test_timing_window_detection() {
    let config = MevProtectionConfig {
        frontrunning_detection_window_seconds: 30,
        ..MevProtectionConfig::default()
    };
    let protection = MockFrontrunningProtection::new(config);

    let victim_tx = TransactionData {
        hash: "0xvictim123".to_string(),
        from_address: "0xvictim".to_string(),
        to_address: "0xcontract".to_string(),
        value: Decimal::from(1000),
        gas_used: 21000,
        gas_price: Decimal::from(25),
        timestamp: Utc::now(),
        function_selector: Some("0xa9059cbb".to_string()),
        input_data: "0xa9059cbb000000000000000000000000".to_string(),
        success: true,
        block_number: 100,
        transaction_index: 1,
    };

    // Transaction within window (should be detected)
    let within_window_tx = TransactionData {
        hash: "0xwithin123".to_string(),
        gas_price: Decimal::from(40),
        timestamp: victim_tx.timestamp - Duration::seconds(15),
        ..victim_tx.clone()
    };

    // Transaction outside window (should not be detected)
    let outside_window_tx = TransactionData {
        hash: "0xoutside123".to_string(),
        gas_price: Decimal::from(40),
        timestamp: victim_tx.timestamp - Duration::seconds(45),
        ..victim_tx.clone()
    };

    let within_threats = protection.detect_frontrunning_threats(&victim_tx, &vec![within_window_tx]).await;
    let outside_threats = protection.detect_frontrunning_threats(&victim_tx, &vec![outside_window_tx]).await;

    assert!(!within_threats.is_empty());
    assert!(outside_threats.is_empty());
}

#[tokio::test]
async fn test_function_selector_matching() {
    let config = MevProtectionConfig::default();
    let protection = MockFrontrunningProtection::new(config);

    let victim_tx = TransactionData {
        hash: "0xvictim123".to_string(),
        from_address: "0xvictim".to_string(),
        to_address: "0xcontract".to_string(),
        value: Decimal::from(1000),
        gas_used: 21000,
        gas_price: Decimal::from(25),
        timestamp: Utc::now(),
        function_selector: Some("0xa9059cbb".to_string()), // transfer
        input_data: "0xa9059cbb000000000000000000000000".to_string(),
        success: true,
        block_number: 100,
        transaction_index: 1,
    };

    // Same function selector (should be detected)
    let same_function_tx = TransactionData {
        hash: "0xsame123".to_string(),
        gas_price: Decimal::from(40),
        timestamp: victim_tx.timestamp - Duration::seconds(5),
        function_selector: Some("0xa9059cbb".to_string()),
        ..victim_tx.clone()
    };

    // Different function selector (should not be detected)
    let diff_function_tx = TransactionData {
        hash: "0xdiff123".to_string(),
        gas_price: Decimal::from(40),
        timestamp: victim_tx.timestamp - Duration::seconds(5),
        function_selector: Some("0x095ea7b3".to_string()), // approve
        input_data: "0x095ea7b3000000000000000000000000".to_string(),
        ..victim_tx.clone()
    };

    let same_threats = protection.detect_frontrunning_threats(&victim_tx, &vec![same_function_tx]).await;
    let diff_threats = protection.detect_frontrunning_threats(&victim_tx, &vec![diff_function_tx]).await;

    assert!(!same_threats.is_empty());
    assert!(diff_threats.is_empty());
}

#[tokio::test]
async fn test_confidence_threshold_filtering() {
    let config = MevProtectionConfig {
        confidence_threshold: 0.8, // High threshold
        ..MevProtectionConfig::default()
    };
    let protection = MockFrontrunningProtection::new(config);

    let victim_tx = TransactionData {
        hash: "0xvictim123".to_string(),
        from_address: "0xvictim".to_string(),
        to_address: "0xcontract".to_string(),
        value: Decimal::from(1000),
        gas_used: 21000,
        gas_price: Decimal::from(25),
        timestamp: Utc::now(),
        function_selector: Some("0xa9059cbb".to_string()),
        input_data: "0xa9059cbb000000000000000000000000".to_string(),
        success: true,
        block_number: 100,
        transaction_index: 1,
    };

    // High confidence frontrunning (should pass threshold)
    let high_confidence_tx = TransactionData {
        hash: "0xhigh123".to_string(),
        gas_price: Decimal::from(50), // High gas premium
        timestamp: victim_tx.timestamp - Duration::seconds(3), // Short timing
        to_address: victim_tx.to_address.clone(), // Same target
        function_selector: victim_tx.function_selector.clone(), // Same function
        ..victim_tx.clone()
    };

    // Low confidence frontrunning (should not pass threshold)
    let low_confidence_tx = TransactionData {
        hash: "0xlow123".to_string(),
        gas_price: Decimal::from(26), // Low gas premium
        timestamp: victim_tx.timestamp - Duration::seconds(25), // Long timing
        to_address: "0xdifferent".to_string(), // Different target
        function_selector: None, // No function selector
        ..victim_tx.clone()
    };

    let high_threats = protection.detect_frontrunning_threats(&victim_tx, &vec![high_confidence_tx]).await;
    let low_threats = protection.detect_frontrunning_threats(&victim_tx, &vec![low_confidence_tx]).await;

    assert!(!high_threats.is_empty());
    assert!(high_threats[0].confidence >= 0.8);
    assert!(low_threats.is_empty());
}

#[tokio::test]
async fn test_protection_route_generation() {
    let config = MevProtectionConfig::default();
    let protection = MockFrontrunningProtection::new(config);

    let transaction = TransactionData {
        hash: "0xtx123".to_string(),
        from_address: "0xuser".to_string(),
        to_address: "0xcontract".to_string(),
        value: Decimal::from(1000),
        gas_used: 50000,
        gas_price: Decimal::from(25),
        timestamp: Utc::now(),
        function_selector: Some("0xa9059cbb".to_string()),
        input_data: "0xa9059cbb000000000000000000000000".to_string(),
        success: true,
        block_number: 100,
        transaction_index: 1,
    };

    let critical_threat = MevThreat {
        threat_type: MevThreatType::Frontrunning,
        severity: MevThreatSeverity::Critical,
        estimated_loss: 15.0,
        description: "Critical frontrunning threat".to_string(),
        confidence: 0.95,
        timestamp: Utc::now(),
        transaction_hash: Some(transaction.hash.clone()),
        affected_addresses: vec!["0xuser".to_string()],
        mitigation_strategies: vec!["private_mempool".to_string()],
    };

    let route = protection.generate_protection_route(&transaction, &vec![critical_threat]).await;

    assert!(route.is_some());
    let route = route.unwrap();
    assert_eq!(route.strategy, "private_mempool");
    assert_eq!(route.protection_level, 10);
    assert!(route.estimated_gas > transaction.gas_used);
    assert!(route.success_probability > 0.0);
}

#[tokio::test]
async fn test_protection_effectiveness_simulation() {
    let config = MevProtectionConfig::default();
    let protection = MockFrontrunningProtection::new(config);

    let transaction = TransactionData {
        hash: "0xtx123".to_string(),
        from_address: "0xuser".to_string(),
        to_address: "0xcontract".to_string(),
        value: Decimal::from(1000),
        gas_used: 50000,
        gas_price: Decimal::from(25),
        timestamp: Utc::now(),
        function_selector: Some("0xa9059cbb".to_string()),
        input_data: "0xa9059cbb000000000000000000000000".to_string(),
        success: true,
        block_number: 100,
        transaction_index: 1,
    };

    let high_success_route = ProtectionRoute {
        route_id: "route1".to_string(),
        strategy: "private_mempool".to_string(),
        estimated_gas: 60000,
        estimated_cost: Decimal::from(1500),
        protection_level: 10,
        success_probability: 0.95,
    };

    let low_success_route = ProtectionRoute {
        route_id: "route2".to_string(),
        strategy: "gas_boost".to_string(),
        estimated_gas: 55000,
        estimated_cost: Decimal::from(1200),
        protection_level: 5,
        success_probability: 0.3,
    };

    // Run simulation multiple times to test probabilistic outcomes
    let mut high_success_count = 0;
    let mut low_success_count = 0;
    let iterations = 100;

    for i in 0..iterations {
        let mut test_tx = transaction.clone();
        test_tx.block_number = 100 + i;

        if protection.simulate_protection_effectiveness(&test_tx, &high_success_route).await {
            high_success_count += 1;
        }

        if protection.simulate_protection_effectiveness(&test_tx, &low_success_route).await {
            low_success_count += 1;
        }
    }

    // High success route should have more successes than low success route
    assert!(high_success_count > low_success_count);
    assert!(high_success_count as f64 / iterations as f64 > 0.8); // Should be around 95% but with some variance
}

#[tokio::test]
async fn test_mempool_monitoring() {
    let config = MevProtectionConfig::default();
    let protection = MockFrontrunningProtection::new(config);

    let tx1 = TransactionData {
        hash: "0xtx1".to_string(),
        from_address: "0xuser1".to_string(),
        to_address: "0xcontract".to_string(),
        value: Decimal::from(1000),
        gas_used: 21000,
        gas_price: Decimal::from(25),
        timestamp: Utc::now(),
        function_selector: Some("0xa9059cbb".to_string()),
        input_data: "0xa9059cbb000000000000000000000000".to_string(),
        success: true,
        block_number: 100,
        transaction_index: 1,
    };

    let tx2 = TransactionData {
        hash: "0xtx2".to_string(),
        from_address: "0xuser2".to_string(),
        ..tx1.clone()
    };

    protection.update_mempool(vec![tx1.clone(), tx2.clone()]).await;

    let mempool = protection.mempool_monitor.read().await;
    assert_eq!(mempool.len(), 2);
    assert!(mempool.contains_key("0xtx1"));
    assert!(mempool.contains_key("0xtx2"));
}

#[tokio::test]
async fn test_metrics_tracking() {
    let config = MevProtectionConfig::default();
    let protection = MockFrontrunningProtection::new(config);

    let victim_tx = TransactionData {
        hash: "0xvictim123".to_string(),
        from_address: "0xvictim".to_string(),
        to_address: "0xcontract".to_string(),
        value: Decimal::from(1000),
        gas_used: 21000,
        gas_price: Decimal::from(25),
        timestamp: Utc::now(),
        function_selector: Some("0xa9059cbb".to_string()),
        input_data: "0xa9059cbb000000000000000000000000".to_string(),
        success: true,
        block_number: 100,
        transaction_index: 1,
    };

    let frontrunner_tx = TransactionData {
        hash: "0xfrontrunner123".to_string(),
        gas_price: Decimal::from(50),
        timestamp: victim_tx.timestamp - Duration::seconds(5),
        ..victim_tx.clone()
    };

    // Detect threats to update metrics
    let threats = protection.detect_frontrunning_threats(&victim_tx, &vec![frontrunner_tx]).await;
    
    let metrics = protection.get_protection_metrics().await;
    assert_eq!(metrics.patterns_detected, threats.len() as u64);
}

#[tokio::test]
async fn test_pattern_storage_and_retrieval() {
    let config = MevProtectionConfig::default();
    let protection = MockFrontrunningProtection::new(config);

    let victim_tx = TransactionData {
        hash: "0xvictim123".to_string(),
        from_address: "0xvictim".to_string(),
        to_address: "0xcontract".to_string(),
        value: Decimal::from(1000),
        gas_used: 21000,
        gas_price: Decimal::from(25),
        timestamp: Utc::now(),
        function_selector: Some("0xa9059cbb".to_string()),
        input_data: "0xa9059cbb000000000000000000000000".to_string(),
        success: true,
        block_number: 100,
        transaction_index: 1,
    };

    let frontrunner_tx = TransactionData {
        hash: "0xfrontrunner123".to_string(),
        gas_price: Decimal::from(50),
        timestamp: victim_tx.timestamp - Duration::seconds(5),
        ..victim_tx.clone()
    };

    protection.detect_frontrunning_threats(&victim_tx, &vec![frontrunner_tx]).await;
    
    let patterns = protection.get_detected_patterns().await;
    assert!(!patterns.is_empty());
    
    let pattern = patterns.values().next().unwrap();
    assert_eq!(pattern.frontrunner_tx.hash, "0xfrontrunner123");
    assert_eq!(pattern.victim_tx.hash, "0xvictim123");
    assert!(pattern.gas_premium > 0.0);
    assert!(pattern.confidence >= 0.7);
}

#[tokio::test]
async fn test_multiple_frontrunners_detection() {
    let config = MevProtectionConfig::default();
    let protection = MockFrontrunningProtection::new(config);

    let victim_tx = TransactionData {
        hash: "0xvictim123".to_string(),
        from_address: "0xvictim".to_string(),
        to_address: "0xcontract".to_string(),
        value: Decimal::from(1000),
        gas_used: 21000,
        gas_price: Decimal::from(25),
        timestamp: Utc::now(),
        function_selector: Some("0xa9059cbb".to_string()),
        input_data: "0xa9059cbb000000000000000000000000".to_string(),
        success: true,
        block_number: 100,
        transaction_index: 2,
    };

    let frontrunner1 = TransactionData {
        hash: "0xfrontrunner1".to_string(),
        gas_price: Decimal::from(40),
        timestamp: victim_tx.timestamp - Duration::seconds(10),
        transaction_index: 0,
        ..victim_tx.clone()
    };

    let frontrunner2 = TransactionData {
        hash: "0xfrontrunner2".to_string(),
        gas_price: Decimal::from(50),
        timestamp: victim_tx.timestamp - Duration::seconds(5),
        transaction_index: 1,
        ..victim_tx.clone()
    };

    let mempool_txs = vec![frontrunner1, frontrunner2];
    let threats = protection.detect_frontrunning_threats(&victim_tx, &mempool_txs).await;

    assert_eq!(threats.len(), 2);
    assert!(threats.iter().all(|t| t.threat_type == MevThreatType::Frontrunning));
    assert!(threats.iter().all(|t| t.confidence >= 0.7));
}

#[tokio::test]
async fn test_edge_case_same_gas_price() {
    let config = MevProtectionConfig::default();
    let protection = MockFrontrunningProtection::new(config);

    let victim_tx = TransactionData {
        hash: "0xvictim123".to_string(),
        from_address: "0xvictim".to_string(),
        to_address: "0xcontract".to_string(),
        value: Decimal::from(1000),
        gas_used: 21000,
        gas_price: Decimal::from(25),
        timestamp: Utc::now(),
        function_selector: Some("0xa9059cbb".to_string()),
        input_data: "0xa9059cbb000000000000000000000000".to_string(),
        success: true,
        block_number: 100,
        transaction_index: 1,
    };

    // Same gas price (should not be detected as frontrunning)
    let same_gas_tx = TransactionData {
        hash: "0xsame123".to_string(),
        gas_price: Decimal::from(25), // Same gas price
        timestamp: victim_tx.timestamp - Duration::seconds(5),
        ..victim_tx.clone()
    };

    let threats = protection.detect_frontrunning_threats(&victim_tx, &vec![same_gas_tx]).await;
    assert!(threats.is_empty());
}

#[tokio::test]
async fn test_performance_benchmark() {
    let config = MevProtectionConfig::default();
    let protection = MockFrontrunningProtection::new(config);

    let victim_tx = TransactionData {
        hash: "0xvictim123".to_string(),
        from_address: "0xvictim".to_string(),
        to_address: "0xcontract".to_string(),
        value: Decimal::from(1000),
        gas_used: 21000,
        gas_price: Decimal::from(25),
        timestamp: Utc::now(),
        function_selector: Some("0xa9059cbb".to_string()),
        input_data: "0xa9059cbb000000000000000000000000".to_string(),
        success: true,
        block_number: 100,
        transaction_index: 100,
    };

    // Create large mempool
    let mut mempool_txs = Vec::new();
    for i in 0..1000 {
        mempool_txs.push(TransactionData {
            hash: format!("0xtx{}", i),
            gas_price: Decimal::from(20 + (i % 50)),
            timestamp: victim_tx.timestamp - Duration::seconds((i % 60) as i64),
            transaction_index: i as u32,
            ..victim_tx.clone()
        });
    }

    let start_time = std::time::Instant::now();
    let threats = protection.detect_frontrunning_threats(&victim_tx, &mempool_txs).await;
    let detection_time = start_time.elapsed();

    // Should complete within reasonable time (< 100ms for 1000 transactions)
    assert!(detection_time.as_millis() < 100);
    assert!(!threats.is_empty()); // Should detect some patterns
}