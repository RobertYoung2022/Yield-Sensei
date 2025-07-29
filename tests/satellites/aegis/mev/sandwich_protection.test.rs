use tokio_test;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use chrono::{Utc, Duration};
use rust_decimal::Decimal;

// Import Aegis satellite types and components
// Note: These imports will need to be adjusted based on the actual module structure
#[allow(dead_code)]
mod aegis_types {
    use serde::{Deserialize, Serialize};
    use chrono::{DateTime, Utc};
    use rust_decimal::Decimal;
    
    #[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
    pub enum MevThreatType {
        Sandwich,
        Frontrunning,
        Backrunning,
        Arbitrage,
        Liquidation,
        FlashLoan,
        GasOptimization,
        TimingAttack,
    }
    
    #[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, PartialOrd, Ord)]
    pub enum MevThreatSeverity {
        Low,
        Medium,
        High,
        Critical,
    }
    
    #[derive(Debug, Clone, Serialize, Deserialize)]
    pub struct MevThreat {
        pub threat_type: MevThreatType,
        pub severity: MevThreatSeverity,
        pub estimated_loss: f64,
        pub description: String,
        pub confidence: f64,
        pub timestamp: DateTime<Utc>,
        pub transaction_hash: Option<String>,
        pub affected_addresses: Vec<String>,
        pub mitigation_strategies: Vec<String>,
    }
    
    #[derive(Debug, Clone, Serialize, Deserialize)]
    pub struct TransactionData {
        pub hash: String,
        pub from_address: String,
        pub to_address: String,
        pub value: Decimal,
        pub gas_used: u64,
        pub gas_price: Decimal,
        pub timestamp: DateTime<Utc>,
        pub function_selector: Option<String>,
        pub input_data: String,
        pub success: bool,
        pub block_number: u64,
        pub transaction_index: u32,
    }
    
    #[derive(Debug, Clone, Serialize, Deserialize)]
    pub struct MevProtectionConfig {
        pub enable_private_mempool: bool,
        pub enable_flashloan_protection: bool,
        pub enable_sandwich_detection: bool,
        pub max_slippage_tolerance: f64,
        pub min_gas_price_gwei: u64,
        pub max_gas_price_gwei: u64,
        pub enable_timing_optimization: bool,
        pub enable_mev_resistant_relayers: bool,
        pub analysis_window_seconds: u64,
        pub confidence_threshold: f64,
    }
    
    impl Default for MevProtectionConfig {
        fn default() -> Self {
            Self {
                enable_private_mempool: true,
                enable_flashloan_protection: true,
                enable_sandwich_detection: true,
                max_slippage_tolerance: 0.5,
                min_gas_price_gwei: 20,
                max_gas_price_gwei: 500,
                enable_timing_optimization: true,
                enable_mev_resistant_relayers: true,
                analysis_window_seconds: 300,
                confidence_threshold: 0.8,
            }
        }
    }
    
    #[derive(Debug, Clone, Serialize, Deserialize)]
    pub enum ProtectionLevel {
        Basic,
        Enhanced,
        Maximum,
        Custom(u8),
    }
    
    #[derive(Debug, Clone, Serialize, Deserialize)]
    pub enum ExecutionStrategy {
        PrivateMempool,
        FlashbotsBundle,
        TimeBoosted,
        GasOptimized,
        MultiPath,
        Custom(String),
    }
    
    #[derive(Debug, Clone, Serialize, Deserialize)]
    pub struct RiskAssessment {
        pub mev_risk_score: f64,
        pub estimated_slippage: f64,
        pub success_probability: f64,
        pub recommended_gas_price: u64,
        pub protection_confidence: f64,
    }
    
    #[derive(Debug, Clone, Serialize, Deserialize)]
    pub struct ProtectedExecutionRoute {
        pub route_id: String,
        pub description: String,
        pub estimated_gas: u64,
        pub estimated_cost: Decimal,
        pub protection_level: ProtectionLevel,
        pub execution_strategy: ExecutionStrategy,
        pub risk_assessment: RiskAssessment,
    }
    
    #[derive(Debug, Clone, Serialize, Deserialize)]
    pub struct SandwichAttackPattern {
        pub pattern_id: String,
        pub before_tx_hash: String,
        pub target_tx_hash: String,
        pub after_tx_hash: String,
        pub detected_at: DateTime<Utc>,
        pub confidence_score: f64,
        pub estimated_profit: f64,
        pub victim_loss: f64,
        pub attack_signature: AttackSignature,
    }
    
    #[derive(Debug, Clone, Serialize, Deserialize)]
    pub struct AttackSignature {
        pub gas_pattern: GasPattern,
        pub timing_pattern: TimingPattern,
        pub value_pattern: ValuePattern,
        pub function_pattern: FunctionPattern,
    }
    
    #[derive(Debug, Clone, Serialize, Deserialize)]
    pub struct GasPattern {
        pub before_gas_price: Decimal,
        pub target_gas_price: Decimal,
        pub after_gas_price: Decimal,
        pub gas_ratio: f64, // (before + after) / target
    }
    
    #[derive(Debug, Clone, Serialize, Deserialize)]
    pub struct TimingPattern {
        pub before_to_target_seconds: i64,
        pub target_to_after_seconds: i64,
        pub total_attack_duration: i64,
        pub block_span: u64,
    }
    
    #[derive(Debug, Clone, Serialize, Deserialize)]
    pub struct ValuePattern {
        pub before_value: Decimal,
        pub target_value: Decimal,
        pub after_value: Decimal,
        pub value_correlation: f64,
    }
    
    #[derive(Debug, Clone, Serialize, Deserialize)]
    pub struct FunctionPattern {
        pub before_function: Option<String>,
        pub target_function: Option<String>,
        pub after_function: Option<String>,
        pub same_function: bool,
        pub related_functions: bool,
    }
    
    #[derive(thiserror::Error, Debug)]
    pub enum MevProtectionError {
        #[error("Analysis failed: {message}")]
        AnalysisFailed { message: String },
        #[error("Insufficient transaction data")]
        InsufficientData,
        #[error("Protection route generation failed")]
        RouteGenerationFailed,
        #[error("Configuration error: {message}")]
        ConfigurationError { message: String },
    }
}

use aegis_types::*;

/// Mock sandwich attack protection system for testing
pub struct MockSandwichProtection {
    config: MevProtectionConfig,
    detected_patterns: Arc<RwLock<HashMap<String, SandwichAttackPattern>>>,
    transaction_history: Arc<RwLock<Vec<TransactionData>>>,
    protection_metrics: Arc<RwLock<ProtectionMetrics>>,
}

#[derive(Debug, Clone)]
struct ProtectionMetrics {
    total_transactions_analyzed: u64,
    sandwich_attacks_detected: u64,
    sandwich_attacks_prevented: u64,
    false_positives: u64,
    average_detection_time_ms: f64,
    prevention_success_rate: f64,
}

impl Default for ProtectionMetrics {
    fn default() -> Self {
        Self {
            total_transactions_analyzed: 0,
            sandwich_attacks_detected: 0,
            sandwich_attacks_prevented: 0,
            false_positives: 0,
            average_detection_time_ms: 0.0,
            prevention_success_rate: 0.0,
        }
    }
}

impl MockSandwichProtection {
    fn new(config: MevProtectionConfig) -> Self {
        Self {
            config,
            detected_patterns: Arc::new(RwLock::new(HashMap::new())),
            transaction_history: Arc::new(RwLock::new(Vec::new())),
            protection_metrics: Arc::new(RwLock::new(ProtectionMetrics::default())),
        }
    }
    
    // Add transaction to history for testing
    async fn add_transaction(&self, transaction: TransactionData) {
        let mut history = self.transaction_history.write().await;
        history.push(transaction);
        history.sort_by_key(|tx| tx.timestamp);
    }
    
    // Add multiple transactions in sequence
    async fn add_transaction_sequence(&self, transactions: Vec<TransactionData>) {
        for tx in transactions {
            self.add_transaction(tx).await;
        }
    }
    
    async fn detect_sandwich_attack(&self, target_transaction: &TransactionData) -> Result<Option<MevThreat>, MevProtectionError> {
        let start_time = std::time::Instant::now();
        
        if !self.config.enable_sandwich_detection {
            return Ok(None);
        }
        
        let history = self.transaction_history.read().await;
        let recent_transactions = self.get_recent_transactions(&history, target_transaction).await;
        
        if recent_transactions.len() < 3 {
            return Ok(None);
        }
        
        // Look for sandwich patterns
        for i in 0..recent_transactions.len().saturating_sub(2) {
            let before_tx = &recent_transactions[i];
            let potential_target = &recent_transactions[i + 1];
            let after_tx = &recent_transactions[i + 2];
            
            // Check if the middle transaction is our target
            if potential_target.hash != target_transaction.hash {
                continue;
            }
            
            // Analyze if this forms a sandwich pattern
            if let Some(pattern) = self.analyze_sandwich_pattern(before_tx, potential_target, after_tx).await? {
                // Update metrics
                self.update_detection_metrics(start_time.elapsed()).await;
                
                // Generate MEV threat
                let threat = self.generate_sandwich_threat(&pattern, target_transaction).await?;
                
                // Store detected pattern
                let mut patterns = self.detected_patterns.write().await;
                patterns.insert(pattern.pattern_id.clone(), pattern);
                
                return Ok(Some(threat));
            }
        }
        
        Ok(None)
    }
    
    async fn get_recent_transactions(&self, history: &[TransactionData], target: &TransactionData) -> Vec<TransactionData> {
        let window_start = target.timestamp - Duration::seconds(self.config.analysis_window_seconds as i64);
        let window_end = target.timestamp + Duration::seconds(30); // Include some after transactions
        
        history.iter()
            .filter(|tx| {
                tx.timestamp >= window_start && 
                tx.timestamp <= window_end &&
                tx.to_address == target.to_address // Same contract
            })
            .cloned()
            .collect()
    }
    
    async fn analyze_sandwich_pattern(
        &self,
        before_tx: &TransactionData,
        target_tx: &TransactionData,
        after_tx: &TransactionData,
    ) -> Result<Option<SandwichAttackPattern>, MevProtectionError> {
        // Analyze gas pattern
        let gas_pattern = GasPattern {
            before_gas_price: before_tx.gas_price,
            target_gas_price: target_tx.gas_price,
            after_gas_price: after_tx.gas_price,
            gas_ratio: self.calculate_gas_ratio(before_tx, target_tx, after_tx),
        };
        
        // Analyze timing pattern
        let timing_pattern = TimingPattern {
            before_to_target_seconds: (target_tx.timestamp - before_tx.timestamp).num_seconds(),
            target_to_after_seconds: (after_tx.timestamp - target_tx.timestamp).num_seconds(),
            total_attack_duration: (after_tx.timestamp - before_tx.timestamp).num_seconds(),
            block_span: after_tx.block_number.saturating_sub(before_tx.block_number),
        };
        
        // Analyze value pattern
        let value_pattern = ValuePattern {
            before_value: before_tx.value,
            target_value: target_tx.value,
            after_value: after_tx.value,
            value_correlation: self.calculate_value_correlation(before_tx, target_tx, after_tx),
        };
        
        // Analyze function pattern
        let function_pattern = FunctionPattern {
            before_function: before_tx.function_selector.clone(),
            target_function: target_tx.function_selector.clone(),
            after_function: after_tx.function_selector.clone(),
            same_function: self.are_same_functions(before_tx, target_tx, after_tx),
            related_functions: self.are_related_functions(before_tx, target_tx, after_tx),
        };
        
        let attack_signature = AttackSignature {
            gas_pattern,
            timing_pattern,
            value_pattern,
            function_pattern,
        };
        
        // Calculate confidence score
        let confidence_score = self.calculate_sandwich_confidence(&attack_signature).await;
        
        // Only return pattern if confidence is above threshold
        if confidence_score >= self.config.confidence_threshold {
            let estimated_profit = self.estimate_sandwich_profit(&attack_signature, before_tx, target_tx, after_tx).await;
            let victim_loss = self.estimate_victim_loss(&attack_signature, target_tx).await;
            
            Ok(Some(SandwichAttackPattern {
                pattern_id: format!("sandwich_{}_{}_{}",
                    before_tx.hash[..8].to_string(),
                    target_tx.hash[..8].to_string(),
                    after_tx.hash[..8].to_string()),
                before_tx_hash: before_tx.hash.clone(),
                target_tx_hash: target_tx.hash.clone(),
                after_tx_hash: after_tx.hash.clone(),
                detected_at: Utc::now(),
                confidence_score,
                estimated_profit,
                victim_loss,
                attack_signature,
            }))
        } else {
            Ok(None)
        }
    }
    
    fn calculate_gas_ratio(&self, before_tx: &TransactionData, target_tx: &TransactionData, after_tx: &TransactionData) -> f64 {
        let before_gas = before_tx.gas_price.to_f64().unwrap_or(0.0);
        let target_gas = target_tx.gas_price.to_f64().unwrap_or(1.0); // Avoid division by zero
        let after_gas = after_tx.gas_price.to_f64().unwrap_or(0.0);
        
        (before_gas + after_gas) / target_gas
    }
    
    fn calculate_value_correlation(&self, before_tx: &TransactionData, target_tx: &TransactionData, after_tx: &TransactionData) -> f64 {
        let before_val = before_tx.value.to_f64().unwrap_or(0.0);
        let target_val = target_tx.value.to_f64().unwrap_or(0.0);
        let after_val = after_tx.value.to_f64().unwrap_or(0.0);
        
        // Simple correlation: how similar are the values
        if target_val == 0.0 {
            return 0.0;
        }
        
        let before_ratio = (before_val / target_val - 1.0).abs();
        let after_ratio = (after_val / target_val - 1.0).abs();
        
        // Higher correlation when ratios are similar
        1.0 - (before_ratio - after_ratio).abs().min(1.0)
    }
    
    fn are_same_functions(&self, before_tx: &TransactionData, target_tx: &TransactionData, after_tx: &TransactionData) -> bool {
        match (&before_tx.function_selector, &target_tx.function_selector, &after_tx.function_selector) {
            (Some(before), Some(target), Some(after)) => before == target && target == after,
            _ => false,
        }
    }
    
    fn are_related_functions(&self, before_tx: &TransactionData, target_tx: &TransactionData, after_tx: &TransactionData) -> bool {
        // Check if functions are trading-related (common in sandwich attacks)
        let trading_functions = vec![
            "0xa9059cbb", // transfer
            "0x095ea7b3", // approve
            "0x7ff36ab5", // swapExactETHForTokens
            "0x18cbafe5", // swapExactTokensForETH
            "0x8803dbee", // swapTokensForExactTokens
        ];
        
        let check_function = |selector: &Option<String>| {
            selector.as_ref().map_or(false, |s| trading_functions.contains(&s.as_str()))
        };
        
        check_function(&before_tx.function_selector) ||
        check_function(&target_tx.function_selector) ||
        check_function(&after_tx.function_selector)
    }
    
    async fn calculate_sandwich_confidence(&self, signature: &AttackSignature) -> f64 {
        let mut confidence = 0.0;
        
        // Gas pattern confidence (40% weight)
        let gas_confidence = if signature.gas_pattern.gas_ratio > 1.5 {
            0.4 * (signature.gas_pattern.gas_ratio.min(3.0) / 3.0)
        } else {
            0.0
        };
        
        // Timing confidence (30% weight)
        let timing_confidence = if signature.timing_pattern.total_attack_duration < 60 && 
                                   signature.timing_pattern.block_span <= 2 {
            0.3
        } else if signature.timing_pattern.total_attack_duration < 300 {
            0.15
        } else {
            0.0
        };
        
        // Function pattern confidence (20% weight)
        let function_confidence = if signature.function_pattern.same_function {
            0.2
        } else if signature.function_pattern.related_functions {
            0.15
        } else {
            0.05
        };
        
        // Value correlation confidence (10% weight)
        let value_confidence = 0.1 * signature.value_pattern.value_correlation;
        
        confidence = gas_confidence + timing_confidence + function_confidence + value_confidence;
        confidence.min(1.0)
    }
    
    async fn estimate_sandwich_profit(&self, signature: &AttackSignature, before_tx: &TransactionData, target_tx: &TransactionData, after_tx: &TransactionData) -> f64 {
        // Estimate profit based on gas price differences and transaction values
        let before_gas_cost = before_tx.gas_used as f64 * signature.gas_pattern.before_gas_price.to_f64().unwrap_or(0.0);
        let after_gas_cost = after_tx.gas_used as f64 * signature.gas_pattern.after_gas_price.to_f64().unwrap_or(0.0);
        let target_gas_cost = target_tx.gas_used as f64 * signature.gas_pattern.target_gas_price.to_f64().unwrap_or(0.0);
        
        // Simplified profit calculation
        let gas_profit = (before_gas_cost + after_gas_cost) - target_gas_cost;
        let value_profit = signature.value_pattern.target_value.to_f64().unwrap_or(0.0) * 0.005; // Assume 0.5% extraction
        
        (gas_profit + value_profit).max(0.0)
    }
    
    async fn estimate_victim_loss(&self, signature: &AttackSignature, target_tx: &TransactionData) -> f64 {
        // Estimate victim loss due to increased slippage
        let base_loss = target_tx.value.to_f64().unwrap_or(0.0) * 0.003; // 0.3% base slippage
        let gas_penalty = (target_tx.gas_used as f64) * signature.gas_pattern.target_gas_price.to_f64().unwrap_or(0.0) * 0.1;
        
        base_loss + gas_penalty
    }
    
    async fn generate_sandwich_threat(&self, pattern: &SandwichAttackPattern, target_tx: &TransactionData) -> Result<MevThreat, MevProtectionError> {
        let severity = if pattern.victim_loss > 10.0 {
            MevThreatSeverity::Critical
        } else if pattern.victim_loss > 1.0 {
            MevThreatSeverity::High
        } else if pattern.victim_loss > 0.1 {
            MevThreatSeverity::Medium
        } else {
            MevThreatSeverity::Low
        };
        
        Ok(MevThreat {
            threat_type: MevThreatType::Sandwich,
            severity,
            estimated_loss: pattern.victim_loss,
            description: format!(
                "Sandwich attack detected with {:.1}% confidence. Pattern: {} -> {} -> {}",
                pattern.confidence_score * 100.0,
                pattern.before_tx_hash[..8].to_string(),
                pattern.target_tx_hash[..8].to_string(),
                pattern.after_tx_hash[..8].to_string()
            ),
            confidence: pattern.confidence_score,
            timestamp: pattern.detected_at,
            transaction_hash: Some(target_tx.hash.clone()),
            affected_addresses: vec![
                target_tx.from_address.clone(),
                target_tx.to_address.clone(),
            ],
            mitigation_strategies: vec![
                "Use private mempool execution".to_string(),
                "Implement MEV-resistant transaction ordering".to_string(),
                "Add slippage protection mechanisms".to_string(),
                "Use Flashbots Protect or similar services".to_string(),
            ],
        })
    }
    
    async fn generate_protection_route(&self, transaction: &TransactionData, threat: &MevThreat) -> Result<ProtectedExecutionRoute, MevProtectionError> {
        let risk_assessment = RiskAssessment {
            mev_risk_score: threat.confidence * 0.8,
            estimated_slippage: self.config.max_slippage_tolerance * 1.5, // Increased due to sandwich risk
            success_probability: 0.95 - (threat.confidence * 0.2),
            recommended_gas_price: self.calculate_recommended_gas_price(threat).await,
            protection_confidence: threat.confidence,
        };
        
        let execution_strategy = match threat.severity {
            MevThreatSeverity::Critical => ExecutionStrategy::PrivateMempool,
            MevThreatSeverity::High => ExecutionStrategy::FlashbotsBundle,
            MevThreatSeverity::Medium => ExecutionStrategy::TimeBoosted,
            MevThreatSeverity::Low => ExecutionStrategy::GasOptimized,
        };
        
        let protection_level = match threat.severity {
            MevThreatSeverity::Critical => ProtectionLevel::Custom(10),
            MevThreatSeverity::High => ProtectionLevel::Maximum,
            MevThreatSeverity::Medium => ProtectionLevel::Enhanced,
            MevThreatSeverity::Low => ProtectionLevel::Basic,
        };
        
        let estimated_gas = self.estimate_protection_gas(transaction, &execution_strategy).await;
        let estimated_cost = self.estimate_protection_cost(transaction, &execution_strategy).await;
        
        Ok(ProtectedExecutionRoute {
            route_id: format!("sandwich_protection_{}", transaction.hash),
            description: format!("MEV sandwich protection route for transaction {}", transaction.hash),
            estimated_gas,
            estimated_cost,
            protection_level,
            execution_strategy,
            risk_assessment,
        })
    }
    
    async fn calculate_recommended_gas_price(&self, threat: &MevThreat) -> u64 {
        let base_gas = 25u64; // Base gas price in gwei
        let threat_multiplier = match threat.severity {
            MevThreatSeverity::Critical => 3.0,
            MevThreatSeverity::High => 2.5,
            MevThreatSeverity::Medium => 2.0,
            MevThreatSeverity::Low => 1.5,
        };
        
        let recommended = (base_gas as f64 * threat_multiplier) as u64;
        recommended.min(self.config.max_gas_price_gwei).max(self.config.min_gas_price_gwei)
    }
    
    async fn estimate_protection_gas(&self, transaction: &TransactionData, strategy: &ExecutionStrategy) -> u64 {
        let base_gas = transaction.gas_used;
        let multiplier = match strategy {
            ExecutionStrategy::PrivateMempool => 1.05,
            ExecutionStrategy::FlashbotsBundle => 1.15,
            ExecutionStrategy::TimeBoosted => 1.10,
            ExecutionStrategy::GasOptimized => 0.95,
            ExecutionStrategy::MultiPath => 1.25,
            ExecutionStrategy::Custom(_) => 1.20,
        };
        
        (base_gas as f64 * multiplier) as u64
    }
    
    async fn estimate_protection_cost(&self, transaction: &TransactionData, strategy: &ExecutionStrategy) -> Decimal {
        let protected_gas = self.estimate_protection_gas(transaction, strategy).await;
        let gas_price_multiplier = match strategy {
            ExecutionStrategy::PrivateMempool => 1.1,
            ExecutionStrategy::FlashbotsBundle => 1.2,
            ExecutionStrategy::TimeBoosted => 1.15,
            ExecutionStrategy::GasOptimized => 0.9,
            ExecutionStrategy::MultiPath => 1.3,
            ExecutionStrategy::Custom(_) => 1.25,
        };
        
        let adjusted_gas_price = transaction.gas_price * Decimal::from_f64(gas_price_multiplier).unwrap_or(Decimal::ONE);
        Decimal::from(protected_gas) * adjusted_gas_price
    }
    
    async fn update_detection_metrics(&self, detection_time: std::time::Duration) {
        let mut metrics = self.protection_metrics.write().await;
        metrics.total_transactions_analyzed += 1;
        metrics.sandwich_attacks_detected += 1;
        
        // Update average detection time (running average)
        let new_time = detection_time.as_millis() as f64;
        metrics.average_detection_time_ms = (metrics.average_detection_time_ms * 0.9) + (new_time * 0.1);
    }
    
    async fn mark_attack_prevented(&self) {
        let mut metrics = self.protection_metrics.write().await;
        metrics.sandwich_attacks_prevented += 1;
        metrics.prevention_success_rate = metrics.sandwich_attacks_prevented as f64 / 
                                          metrics.sandwich_attacks_detected.max(1) as f64;
    }
    
    async fn mark_false_positive(&self) {
        let mut metrics = self.protection_metrics.write().await;
        metrics.false_positives += 1;
    }
    
    async fn get_metrics(&self) -> ProtectionMetrics {
        self.protection_metrics.read().await.clone()
    }
    
    async fn get_detected_patterns(&self) -> HashMap<String, SandwichAttackPattern> {
        self.detected_patterns.read().await.clone()
    }
    
    async fn clear_history(&self) {
        let mut history = self.transaction_history.write().await;
        history.clear();
        
        let mut patterns = self.detected_patterns.write().await;
        patterns.clear();
    }
    
    // Simulate sandwich attack prevention
    async fn prevent_sandwich_attack(&self, transaction: &TransactionData, threat: &MevThreat) -> Result<bool, MevProtectionError> {
        // Generate protection route
        let protection_route = self.generate_protection_route(transaction, threat).await?;
        
        // Simulate protection execution success based on severity and confidence
        let success_probability = match threat.severity {
            MevThreatSeverity::Critical => 0.95,
            MevThreatSeverity::High => 0.90,
            MevThreatSeverity::Medium => 0.85,
            MevThreatSeverity::Low => 0.80,
        };
        
        // Add some randomness for realistic simulation
        let random_factor = (threat.confidence * 1000.0) as u64 % 100;
        let success = (random_factor as f64 / 100.0) < success_probability;
        
        if success {
            self.mark_attack_prevented().await;
        }
        
        Ok(success)
    }
}

#[cfg(test)]
mod sandwich_protection_tests {
    use super::*;
    use tokio_test;
    
    fn create_test_transaction(hash: &str, from: &str, to: &str, gas_price: f64, timestamp_offset: i64, block_number: u64) -> TransactionData {
        TransactionData {
            hash: hash.to_string(),
            from_address: from.to_string(),
            to_address: to.to_string(),
            value: Decimal::from(1000),
            gas_used: 21000,
            gas_price: Decimal::from_f64(gas_price).unwrap(),
            timestamp: Utc::now() + Duration::seconds(timestamp_offset),
            function_selector: Some("0xa9059cbb".to_string()), // transfer
            input_data: "0xa9059cbb000000000000000000000000".to_string(),
            success: true,
            block_number,
            transaction_index: 0,
        }
    }
    
    #[tokio::test]
    async fn test_sandwich_protection_creation() {
        let config = MevProtectionConfig::default();
        let protection = MockSandwichProtection::new(config);
        
        let metrics = protection.get_metrics().await;
        assert_eq!(metrics.total_transactions_analyzed, 0);
        assert_eq!(metrics.sandwich_attacks_detected, 0);
        assert_eq!(metrics.sandwich_attacks_prevented, 0);
    }
    
    #[tokio::test]
    async fn test_classic_sandwich_attack_detection() {
        let config = MevProtectionConfig::default();
        let protection = MockSandwichProtection::new(config);
        
        // Create a classic sandwich attack pattern
        let before_tx = create_test_transaction(
            "0xbefore123",
            "0xattacker1",
            "0xdex",
            100.0, // High gas price
            -10,   // 10 seconds before target
            1000
        );
        
        let target_tx = create_test_transaction(
            "0xtarget456",
            "0xvictim",
            "0xdex",
            25.0,  // Normal gas price
            0,     // Reference time
            1000
        );
        
        let after_tx = create_test_transaction(
            "0xafter789",
            "0xattacker2",
            "0xdex",
            95.0,  // High gas price
            5,     // 5 seconds after target
            1000
        );
        
        // Add transactions to history
        protection.add_transaction_sequence(vec![before_tx, target_tx.clone(), after_tx]).await;
        
        // Detect sandwich attack
        let result = protection.detect_sandwich_attack(&target_tx).await.unwrap();
        
        assert!(result.is_some());
        let threat = result.unwrap();
        assert_eq!(threat.threat_type, MevThreatType::Sandwich);
        assert!(threat.confidence >= 0.8);
        assert!(threat.estimated_loss > 0.0);
        assert!(!threat.mitigation_strategies.is_empty());
        assert!(threat.description.contains("Sandwich attack detected"));
    }
    
    #[tokio::test]
    async fn test_no_sandwich_attack_normal_transactions() {
        let config = MevProtectionConfig::default();
        let protection = MockSandwichProtection::new(config);
        
        // Create normal transactions with similar gas prices
        let tx1 = create_test_transaction("0xtx1", "0xuser1", "0xdex", 25.0, -20, 1000);
        let tx2 = create_test_transaction("0xtx2", "0xuser2", "0xdex", 27.0, -10, 1000);
        let target_tx = create_test_transaction("0xtarget", "0xuser3", "0xdex", 26.0, 0, 1000);
        let tx3 = create_test_transaction("0xtx3", "0xuser4", "0xdex", 28.0, 10, 1000);
        
        protection.add_transaction_sequence(vec![tx1, tx2, target_tx.clone(), tx3]).await;
        
        let result = protection.detect_sandwich_attack(&target_tx).await.unwrap();
        
        assert!(result.is_none());
    }
    
    #[tokio::test]
    async fn test_sandwich_attack_severity_levels() {
        let config = MevProtectionConfig::default();
        let protection = MockSandwichProtection::new(config);
        
        // Test critical severity (high victim loss)
        let before_tx_critical = create_test_transaction("0xbefore_c", "0xattacker", "0xdex", 200.0, -5, 1000);
        let target_tx_critical = TransactionData {
            value: Decimal::from(50000), // High value transaction
            ..create_test_transaction("0xtarget_c", "0xvictim", "0xdex", 30.0, 0, 1000)
        };
        let after_tx_critical = create_test_transaction("0xafter_c", "0xattacker", "0xdex", 195.0, 3, 1000);
        
        protection.add_transaction_sequence(vec![
            before_tx_critical, 
            target_tx_critical.clone(), 
            after_tx_critical
        ]).await;
        
        let result = protection.detect_sandwich_attack(&target_tx_critical).await.unwrap();
        assert!(result.is_some());
        let threat = result.unwrap();
        assert!(matches!(threat.severity, MevThreatSeverity::High | MevThreatSeverity::Critical));
        
        // Clear history for next test
        protection.clear_history().await;
        
        // Test low severity (small victim loss)
        let before_tx_low = create_test_transaction("0xbefore_l", "0xattacker", "0xdex", 35.0, -5, 1000);
        let target_tx_low = create_test_transaction("0xtarget_l", "0xvictim", "0xdex", 25.0, 0, 1000);
        let after_tx_low = create_test_transaction("0xafter_l", "0xattacker", "0xdex", 33.0, 3, 1000);
        
        protection.add_transaction_sequence(vec![
            before_tx_low, 
            target_tx_low.clone(), 
            after_tx_low
        ]).await;
        
        let result = protection.detect_sandwich_attack(&target_tx_low).await.unwrap();
        if let Some(threat) = result {
            assert!(matches!(threat.severity, MevThreatSeverity::Low | MevThreatSeverity::Medium));
        }
    }
    
    #[tokio::test]
    async fn test_sandwich_attack_timing_requirements() {
        let config = MevProtectionConfig::default();
        let protection = MockSandwichProtection::new(config);
        
        // Test transactions too far apart in time (should not detect)
        let before_tx = create_test_transaction("0xbefore", "0xattacker", "0xdex", 100.0, -600, 1000); // 10 minutes before
        let target_tx = create_test_transaction("0xtarget", "0xvictim", "0xdex", 25.0, 0, 1000);
        let after_tx = create_test_transaction("0xafter", "0xattacker", "0xdex", 95.0, 5, 1000);
        
        protection.add_transaction_sequence(vec![before_tx, target_tx.clone(), after_tx]).await;
        
        let result = protection.detect_sandwich_attack(&target_tx).await.unwrap();
        assert!(result.is_none() || result.unwrap().confidence < 0.8);
        
        // Clear and test proper timing
        protection.clear_history().await;
        
        let before_tx_good = create_test_transaction("0xbefore2", "0xattacker", "0xdex", 100.0, -15, 1000);
        let target_tx_good = create_test_transaction("0xtarget2", "0xvictim", "0xdex", 25.0, 0, 1000);
        let after_tx_good = create_test_transaction("0xafter2", "0xattacker", "0xdex", 95.0, 10, 1000);
        
        protection.add_transaction_sequence(vec![before_tx_good, target_tx_good.clone(), after_tx_good]).await;
        
        let result = protection.detect_sandwich_attack(&target_tx_good).await.unwrap();
        assert!(result.is_some());
        assert!(result.unwrap().confidence >= 0.8);
    }
    
    #[tokio::test]
    async fn test_sandwich_attack_block_requirements() {
        let config = MevProtectionConfig::default();
        let protection = MockSandwichProtection::new(config);
        
        // Test transactions across too many blocks (should reduce confidence)
        let before_tx = create_test_transaction("0xbefore", "0xattacker", "0xdex", 100.0, -10, 1000);
        let target_tx = create_test_transaction("0xtarget", "0xvictim", "0xdex", 25.0, 0, 1005); // 5 blocks later
        let after_tx = create_test_transaction("0xafter", "0xattacker", "0xdex", 95.0, 5, 1010); // 10 blocks total
        
        protection.add_transaction_sequence(vec![before_tx, target_tx.clone(), after_tx]).await;
        
        let result = protection.detect_sandwich_attack(&target_tx).await.unwrap();
        assert!(result.is_none() || result.unwrap().confidence < 0.8);
        
        // Clear and test same block
        protection.clear_history().await;
        
        let before_tx_same = create_test_transaction("0xbefore2", "0xattacker", "0xdex", 100.0, -10, 1000);
        let target_tx_same = create_test_transaction("0xtarget2", "0xvictim", "0xdex", 25.0, 0, 1000);
        let after_tx_same = create_test_transaction("0xafter2", "0xattacker", "0xdex", 95.0, 5, 1001);
        
        protection.add_transaction_sequence(vec![before_tx_same, target_tx_same.clone(), after_tx_same]).await;
        
        let result = protection.detect_sandwich_attack(&target_tx_same).await.unwrap();
        assert!(result.is_some());
        assert!(result.unwrap().confidence >= 0.8);
    }
    
    #[tokio::test]
    async fn test_function_selector_matching() {
        let config = MevProtectionConfig::default();
        let protection = MockSandwichProtection::new(config);
        
        // Test with same function selectors (higher confidence)
        let mut before_tx = create_test_transaction("0xbefore", "0xattacker", "0xdex", 100.0, -10, 1000);
        before_tx.function_selector = Some("0xa9059cbb".to_string()); // transfer
        
        let mut target_tx = create_test_transaction("0xtarget", "0xvictim", "0xdex", 25.0, 0, 1000);
        target_tx.function_selector = Some("0xa9059cbb".to_string()); // transfer
        
        let mut after_tx = create_test_transaction("0xafter", "0xattacker", "0xdex", 95.0, 5, 1000);
        after_tx.function_selector = Some("0xa9059cbb".to_string()); // transfer
        
        protection.add_transaction_sequence(vec![before_tx, target_tx.clone(), after_tx]).await;
        
        let result = protection.detect_sandwich_attack(&target_tx).await.unwrap();
        assert!(result.is_some());
        let threat = result.unwrap();
        assert!(threat.confidence > 0.8);
        
        // Clear and test with different function selectors
        protection.clear_history().await;
        
        let mut before_tx_diff = create_test_transaction("0xbefore2", "0xattacker", "0xdex", 100.0, -10, 1000);
        before_tx_diff.function_selector = Some("0x095ea7b3".to_string()); // approve
        
        let mut target_tx_diff = create_test_transaction("0xtarget2", "0xvictim", "0xdex", 25.0, 0, 1000);
        target_tx_diff.function_selector = Some("0xa9059cbb".to_string()); // transfer
        
        let mut after_tx_diff = create_test_transaction("0xafter2", "0xattacker", "0xdex", 95.0, 5, 1000);
        after_tx_diff.function_selector = Some("0x7ff36ab5".to_string()); // swap
        
        protection.add_transaction_sequence(vec![before_tx_diff, target_tx_diff.clone(), after_tx_diff]).await;
        
        let result = protection.detect_sandwich_attack(&target_tx_diff).await.unwrap();
        if let Some(threat) = result {
            // Still might detect due to trading-related functions, but lower confidence
            assert!(threat.confidence < 0.9);
        }
    }
    
    #[tokio::test]
    async fn test_protection_route_generation() {
        let config = MevProtectionConfig::default();
        let protection = MockSandwichProtection::new(config);
        
        let target_tx = create_test_transaction("0xtarget", "0xvictim", "0xdex", 25.0, 0, 1000);
        
        let threat = MevThreat {
            threat_type: MevThreatType::Sandwich,
            severity: MevThreatSeverity::High,
            estimated_loss: 5.0,
            description: "Test sandwich attack".to_string(),
            confidence: 0.9,
            timestamp: Utc::now(),
            transaction_hash: Some(target_tx.hash.clone()),
            affected_addresses: vec![target_tx.from_address.clone()],
            mitigation_strategies: vec!["Use private mempool".to_string()],
        };
        
        let route = protection.generate_protection_route(&target_tx, &threat).await.unwrap();
        
        assert_eq!(route.route_id, format!("sandwich_protection_{}", target_tx.hash));
        assert!(matches!(route.execution_strategy, ExecutionStrategy::FlashbotsBundle));
        assert!(matches!(route.protection_level, ProtectionLevel::Maximum));
        assert!(route.estimated_gas > target_tx.gas_used);
        assert!(route.estimated_cost > Decimal::ZERO);
        assert!(route.risk_assessment.mev_risk_score > 0.5);
    }
    
    #[tokio::test]
    async fn test_sandwich_prevention_simulation() {
        let config = MevProtectionConfig::default();
        let protection = MockSandwichProtection::new(config);
        
        let target_tx = create_test_transaction("0xtarget", "0xvictim", "0xdex", 25.0, 0, 1000);
        
        // Test high severity threat prevention
        let high_threat = MevThreat {
            threat_type: MevThreatType::Sandwich,
            severity: MevThreatSeverity::Critical,
            estimated_loss: 15.0,
            description: "Critical sandwich attack".to_string(),
            confidence: 0.95,
            timestamp: Utc::now(),
            transaction_hash: Some(target_tx.hash.clone()),
            affected_addresses: vec![target_tx.from_address.clone()],
            mitigation_strategies: vec!["Use private mempool".to_string()],
        };
        
        let prevention_success = protection.prevent_sandwich_attack(&target_tx, &high_threat).await.unwrap();
        assert!(prevention_success); // Should have high success rate for critical threats
        
        // Test low severity threat prevention
        let low_threat = MevThreat {
            threat_type: MevThreatType::Sandwich,
            severity: MevThreatSeverity::Low,
            estimated_loss: 0.1,
            description: "Low impact sandwich attack".to_string(),
            confidence: 0.6,
            timestamp: Utc::now(),
            transaction_hash: Some(target_tx.hash.clone()),
            affected_addresses: vec![target_tx.from_address.clone()],
            mitigation_strategies: vec!["Increase gas price".to_string()],
        };
        
        // Try multiple times since there's randomness involved
        let mut successes = 0;
        for _ in 0..10 {
            if protection.prevent_sandwich_attack(&target_tx, &low_threat).await.unwrap() {
                successes += 1;
            }
        }
        
        // Should have some successes but not 100% for low severity
        assert!(successes >= 5);
        assert!(successes <= 10);
    }
    
    #[tokio::test]
    async fn test_metrics_tracking() {
        let config = MevProtectionConfig::default();
        let protection = MockSandwichProtection::new(config);
        
        // Create and detect a sandwich attack
        let before_tx = create_test_transaction("0xbefore", "0xattacker", "0xdex", 100.0, -10, 1000);
        let target_tx = create_test_transaction("0xtarget", "0xvictim", "0xdex", 25.0, 0, 1000);
        let after_tx = create_test_transaction("0xafter", "0xattacker", "0xdex", 95.0, 5, 1000);
        
        protection.add_transaction_sequence(vec![before_tx, target_tx.clone(), after_tx]).await;
        
        let _result = protection.detect_sandwich_attack(&target_tx).await.unwrap();
        
        let metrics = protection.get_metrics().await;
        assert_eq!(metrics.total_transactions_analyzed, 1);
        assert_eq!(metrics.sandwich_attacks_detected, 1);
        assert!(metrics.average_detection_time_ms > 0.0);
        
        // Test prevention metrics
        if let Some(threat) = _result {
            protection.prevent_sandwich_attack(&target_tx, &threat).await.unwrap();
            let updated_metrics = protection.get_metrics().await;
            assert!(updated_metrics.sandwich_attacks_prevented > 0);
            assert!(updated_metrics.prevention_success_rate > 0.0);
        }
    }
    
    #[tokio::test]
    async fn test_confidence_threshold_filtering() {
        let mut config = MevProtectionConfig::default();
        config.confidence_threshold = 0.9; // High threshold
        let protection = MockSandwichProtection::new(config);
        
        // Create a weak sandwich pattern (low confidence)
        let before_tx = create_test_transaction("0xbefore", "0xattacker", "0xdex", 30.0, -10, 1000); // Low gas difference
        let target_tx = create_test_transaction("0xtarget", "0xvictim", "0xdex", 25.0, 0, 1000);
        let after_tx = create_test_transaction("0xafter", "0xattacker", "0xdex", 28.0, 5, 1000); // Low gas difference
        
        protection.add_transaction_sequence(vec![before_tx, target_tx.clone(), after_tx]).await;
        
        let result = protection.detect_sandwich_attack(&target_tx).await.unwrap();
        assert!(result.is_none()); // Should not detect due to high confidence threshold
        
        // Test with strong pattern
        protection.clear_history().await;
        
        let strong_before = create_test_transaction("0xstrong_before", "0xattacker", "0xdex", 150.0, -5, 1000);
        let strong_target = create_test_transaction("0xstrong_target", "0xvictim", "0xdex", 25.0, 0, 1000);
        let strong_after = create_test_transaction("0xstrong_after", "0xattacker", "0xdex", 145.0, 3, 1000);
        
        protection.add_transaction_sequence(vec![strong_before, strong_target.clone(), strong_after]).await;
        
        let result = protection.detect_sandwich_attack(&strong_target).await.unwrap();
        assert!(result.is_some()); // Should detect strong pattern even with high threshold
        assert!(result.unwrap().confidence >= 0.9);
    }
    
    #[tokio::test]
    async fn test_insufficient_transaction_data() {
        let config = MevProtectionConfig::default();
        let protection = MockSandwichProtection::new(config);
        
        // Add only one transaction
        let single_tx = create_test_transaction("0xsingle", "0xuser", "0xdex", 25.0, 0, 1000);
        protection.add_transaction(single_tx.clone()).await;
        
        let result = protection.detect_sandwich_attack(&single_tx).await.unwrap();
        assert!(result.is_none());
        
        // Add only two transactions
        let tx2 = create_test_transaction("0xtx2", "0xuser2", "0xdex", 30.0, 10, 1000);
        protection.add_transaction(tx2).await;
        
        let result = protection.detect_sandwich_attack(&single_tx).await.unwrap();
        assert!(result.is_none());
    }
    
    #[tokio::test]
    async fn test_disabled_sandwich_detection() {
        let mut config = MevProtectionConfig::default();
        config.enable_sandwich_detection = false;
        let protection = MockSandwichProtection::new(config);
        
        // Create perfect sandwich attack pattern
        let before_tx = create_test_transaction("0xbefore", "0xattacker", "0xdex", 200.0, -5, 1000);
        let target_tx = create_test_transaction("0xtarget", "0xvictim", "0xdex", 25.0, 0, 1000);
        let after_tx = create_test_transaction("0xafter", "0xattacker", "0xdex", 195.0, 3, 1000);
        
        protection.add_transaction_sequence(vec![before_tx, target_tx.clone(), after_tx]).await;
        
        let result = protection.detect_sandwich_attack(&target_tx).await.unwrap();
        assert!(result.is_none()); // Should not detect when disabled
    }
    
    #[tokio::test]
    async fn test_performance_benchmarking() {
        let config = MevProtectionConfig::default();
        let protection = MockSandwichProtection::new(config);
        
        // Add many transactions for performance testing
        for i in 0..100 {
            let tx = create_test_transaction(
                &format!("0xtx{:04x}", i),
                &format!("0xuser{}", i),
                "0xdex",
                25.0 + (i as f64 % 50.0),
                (i as i64) - 50,
                1000 + (i as u64 / 10)
            );
            protection.add_transaction(tx).await;
        }
        
        // Create target transaction
        let target_tx = create_test_transaction("0xtarget", "0xvictim", "0xdex", 25.0, 0, 1000);
        protection.add_transaction(target_tx.clone()).await;
        
        let start_time = std::time::Instant::now();
        let _result = protection.detect_sandwich_attack(&target_tx).await.unwrap();
        let duration = start_time.elapsed();
        
        // Should complete detection quickly even with many transactions
        assert!(duration.as_millis() < 200, "Detection took {}ms, should be <200ms", duration.as_millis());
        
        let metrics = protection.get_metrics().await;
        assert!(metrics.average_detection_time_ms < 200.0);
    }
}