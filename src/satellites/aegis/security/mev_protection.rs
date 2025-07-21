use crate::security::{Vulnerability, VulnerabilitySeverity, VulnerabilityCategory};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use rust_decimal::prelude::{FromPrimitive, ToPrimitive};
use log::{info, warn, error, debug};

/// Configuration for MEV protection mechanisms
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MevProtectionConfig {
    /// Enable private mempool routing
    pub enable_private_mempool: bool,
    /// Enable flash loan attack protection
    pub enable_flashloan_protection: bool,
    /// Enable sandwich attack detection
    pub enable_sandwich_detection: bool,
    /// Maximum slippage tolerance (as percentage)
    pub max_slippage_tolerance: f64,
    /// Minimum gas price for MEV protection
    pub min_gas_price_gwei: u64,
    /// Maximum gas price for MEV protection
    pub max_gas_price_gwei: u64,
    /// Enable transaction timing optimization
    pub enable_timing_optimization: bool,
    /// Enable MEV-resistant relayers
    pub enable_mev_resistant_relayers: bool,
    /// Time window for MEV analysis (seconds)
    pub analysis_window_seconds: u64,
    /// Confidence threshold for MEV detection
    pub confidence_threshold: f64,
}

impl Default for MevProtectionConfig {
    fn default() -> Self {
        Self {
            enable_private_mempool: true,
            enable_flashloan_protection: true,
            enable_sandwich_detection: true,
            max_slippage_tolerance: 0.5, // 0.5%
            min_gas_price_gwei: 20,
            max_gas_price_gwei: 500,
            enable_timing_optimization: true,
            enable_mev_resistant_relayers: true,
            analysis_window_seconds: 300, // 5 minutes
            confidence_threshold: 0.8,
        }
    }
}

/// Types of MEV threats
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

/// Severity levels for MEV threats
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, PartialOrd, Ord)]
pub enum MevThreatSeverity {
    Low,
    Medium,
    High,
    Critical,
}

/// MEV threat information
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

/// Transaction data for MEV analysis
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

/// MEV protection execution route
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

/// Protection levels for execution routes
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ProtectionLevel {
    Basic,
    Enhanced,
    Maximum,
    Custom(u8),
}

/// Execution strategies for MEV protection
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ExecutionStrategy {
    PrivateMempool,
    FlashbotsBundle,
    TimeBoosted,
    GasOptimized,
    MultiPath,
    Custom(String),
}

/// Risk assessment for execution routes
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RiskAssessment {
    pub mev_risk_score: f64,
    pub estimated_slippage: f64,
    pub success_probability: f64,
    pub recommended_gas_price: u64,
    pub protection_confidence: f64,
}

/// MEV Protection System
pub struct MevProtectionSystem {
    config: MevProtectionConfig,
    threat_history: Arc<RwLock<HashMap<String, Vec<MevThreat>>>>,
    private_mempools: Arc<RwLock<Vec<PrivateMempool>>>,
    mev_relayers: Arc<RwLock<Vec<MevResistantRelayer>>>,
    gas_optimizer: Arc<GasOptimizer>,
    timing_analyzer: Arc<TimingAnalyzer>,
}

impl MevProtectionSystem {
    pub fn new(config: MevProtectionConfig) -> Self {
        Self {
            config,
            threat_history: Arc::new(RwLock::new(HashMap::new())),
            private_mempools: Arc::new(RwLock::new(Vec::new())),
            mev_relayers: Arc::new(RwLock::new(Vec::new())),
            gas_optimizer: Arc::new(GasOptimizer::new()),
            timing_analyzer: Arc::new(TimingAnalyzer::new()),
        }
    }

    /// Analyze transaction for MEV vulnerabilities
    pub async fn analyze_transaction_mev_risk(
        &self,
        transaction_data: &TransactionData,
        recent_transactions: &[TransactionData],
    ) -> Result<Vec<MevThreat>, Box<dyn std::error::Error + Send + Sync>> {
        let mut threats = Vec::new();

        // Sandwich attack detection
        if self.config.enable_sandwich_detection {
            if let Some(sandwich_threat) = self.detect_sandwich_attack(transaction_data, recent_transactions).await? {
                threats.push(sandwich_threat);
            }
        }

        // Frontrunning detection
        if let Some(frontrun_threat) = self.detect_frontrunning(transaction_data, recent_transactions).await? {
            threats.push(frontrun_threat);
        }

        // Backrunning detection
        if let Some(backrun_threat) = self.detect_backrunning(transaction_data, recent_transactions).await? {
            threats.push(backrun_threat);
        }

        // Flash loan attack detection
        if self.config.enable_flashloan_protection {
            if let Some(flashloan_threat) = self.detect_flashloan_attack(transaction_data).await? {
                threats.push(flashloan_threat);
            }
        }

        // Gas optimization analysis
        if let Some(gas_threat) = self.analyze_gas_optimization(transaction_data).await? {
            threats.push(gas_threat);
        }

        // Store threats in history
        self.store_threats(&transaction_data.hash, &threats).await;

        Ok(threats)
    }

    /// Get protected execution route for transaction
    pub async fn get_protected_execution_route(
        &self,
        transaction_data: &TransactionData,
        threats: &[MevThreat],
    ) -> Result<ProtectedExecutionRoute, Box<dyn std::error::Error + Send + Sync>> {
        let risk_assessment = self.assess_execution_risk(transaction_data, threats).await?;
        let execution_strategy = self.determine_execution_strategy(threats, &risk_assessment).await?;
        let protection_level = self.determine_protection_level(threats).await?;

        let route = ProtectedExecutionRoute {
            route_id: format!("protected_route_{}", transaction_data.hash),
            description: format!("MEV-protected execution route for transaction {}", transaction_data.hash),
            estimated_gas: self.estimate_protected_gas(transaction_data, &execution_strategy).await?,
            estimated_cost: self.estimate_protected_cost(transaction_data, &execution_strategy).await?,
            protection_level,
            execution_strategy,
            risk_assessment,
        };

        Ok(route)
    }

    /// Detect sandwich attacks
    async fn detect_sandwich_attack(
        &self,
        transaction: &TransactionData,
        recent_transactions: &[TransactionData],
    ) -> Result<Option<MevThreat>, Box<dyn std::error::Error + Send + Sync>> {
        let window_start = transaction.timestamp - chrono::Duration::seconds(self.config.analysis_window_seconds as i64);
        
        // Filter transactions in the time window
        let window_transactions: Vec<&TransactionData> = recent_transactions
            .iter()
            .filter(|tx| tx.timestamp >= window_start && tx.timestamp <= transaction.timestamp)
            .collect();

        if window_transactions.len() < 3 {
            return Ok(None);
        }

        // Look for sandwich pattern: high gas -> normal gas -> high gas
        for i in 0..window_transactions.len() - 2 {
            let before = &window_transactions[i];
            let target = &window_transactions[i + 1];
            let after = &window_transactions[i + 2];

            // Check if target transaction is the one we're analyzing
            if target.hash != transaction.hash {
                continue;
            }

            // Check for sandwich pattern
            if self.is_sandwich_pattern(before, target, after).await? {
                let estimated_loss = self.estimate_sandwich_loss(before, target, after).await?;
                
                return Ok(Some(MevThreat {
                    threat_type: MevThreatType::Sandwich,
                    severity: self.determine_sandwich_severity(estimated_loss).await?,
                    estimated_loss,
                    description: format!(
                        "Sandwich attack detected: {} -> {} -> {}",
                        before.hash, target.hash, after.hash
                    ),
                    confidence: self.calculate_sandwich_confidence(before, target, after).await?,
                    timestamp: Utc::now(),
                    transaction_hash: Some(transaction.hash.clone()),
                    affected_addresses: vec![
                        before.from_address.clone(),
                        target.from_address.clone(),
                        after.from_address.clone(),
                    ],
                    mitigation_strategies: vec![
                        "Use private mempool".to_string(),
                        "Increase gas price".to_string(),
                        "Use MEV-resistant relayer".to_string(),
                    ],
                }));
            }
        }

        Ok(None)
    }

    /// Check if three transactions form a sandwich pattern
    async fn is_sandwich_pattern(
        &self,
        before: &TransactionData,
        target: &TransactionData,
        after: &TransactionData,
    ) -> Result<bool, Box<dyn std::error::Error + Send + Sync>> {
        // Check if transactions are in the same block or consecutive blocks
        let block_gap = after.block_number.saturating_sub(before.block_number);
        if block_gap > 2 {
            return Ok(false);
        }

        // Check if gas prices follow sandwich pattern (high -> low -> high)
        let before_gas = before.gas_price;
        let target_gas = target.gas_price;
        let after_gas = after.gas_price;

        let is_sandwich_gas = before_gas > target_gas && after_gas > target_gas;
        
        // Check if transactions involve the same token/contract
        let same_target = before.to_address == target.to_address && target.to_address == after.to_address;
        
        // Check if function selectors are similar (same operation)
        let similar_functions = self.are_functions_similar(before, target, after).await?;

        Ok(is_sandwich_gas && same_target && similar_functions)
    }

    /// Check if function selectors are similar (same operation type)
    async fn are_functions_similar(
        &self,
        before: &TransactionData,
        target: &TransactionData,
        after: &TransactionData,
    ) -> Result<bool, Box<dyn std::error::Error + Send + Sync>> {
        // Simple check: if all have function selectors, they should be the same
        if let (Some(before_sel), Some(target_sel), Some(after_sel)) = (
            &before.function_selector,
            &target.function_selector,
            &after.function_selector,
        ) {
            return Ok(before_sel == target_sel && target_sel == after_sel);
        }

        // If no function selectors, check if input data patterns are similar
        let before_pattern = self.extract_input_pattern(&before.input_data).await?;
        let target_pattern = self.extract_input_pattern(&target.input_data).await?;
        let after_pattern = self.extract_input_pattern(&after.input_data).await?;

        Ok(before_pattern == target_pattern && target_pattern == after_pattern)
    }

    /// Extract pattern from input data
    async fn extract_input_pattern(&self, input_data: &str) -> Result<String, Box<dyn std::error::Error + Send + Sync>> {
        // Simple pattern extraction: take first 8 characters (function selector)
        if input_data.len() >= 10 {
            Ok(input_data[..10].to_string())
        } else {
            Ok(input_data.to_string())
        }
    }

    /// Estimate loss from sandwich attack
    async fn estimate_sandwich_loss(
        &self,
        before: &TransactionData,
        target: &TransactionData,
        after: &TransactionData,
    ) -> Result<f64, Box<dyn std::error::Error + Send + Sync>> {
        // Calculate gas cost difference
        let before_cost = (before.gas_used as f64) * (before.gas_price.to_f64().unwrap_or(0.0));
        let target_cost = (target.gas_used as f64) * (target.gas_price.to_f64().unwrap_or(0.0));
        let after_cost = (after.gas_used as f64) * (after.gas_price.to_f64().unwrap_or(0.0));

        // Estimate MEV profit (simplified)
        let mev_profit = before_cost + after_cost - target_cost;
        
        // Add value-based estimation if available
        let value_impact = target.value.to_f64().unwrap_or(0.0) * 0.01; // Assume 1% slippage

        Ok(mev_profit + value_impact)
    }

    /// Determine severity of sandwich attack
    async fn determine_sandwich_severity(&self, estimated_loss: f64) -> Result<MevThreatSeverity, Box<dyn std::error::Error + Send + Sync>> {
        match estimated_loss {
            loss if loss < 0.1 => Ok(MevThreatSeverity::Low),
            loss if loss < 1.0 => Ok(MevThreatSeverity::Medium),
            loss if loss < 10.0 => Ok(MevThreatSeverity::High),
            _ => Ok(MevThreatSeverity::Critical),
        }
    }

    /// Calculate confidence in sandwich detection
    async fn calculate_sandwich_confidence(
        &self,
        before: &TransactionData,
        target: &TransactionData,
        after: &TransactionData,
    ) -> Result<f64, Box<dyn std::error::Error + Send + Sync>> {
        let mut confidence = 0.5; // Base confidence

        // Increase confidence based on gas price pattern
        let gas_pattern_confidence = if before.gas_price > target.gas_price && after.gas_price > target.gas_price {
            0.3
        } else {
            0.0
        };

        // Increase confidence based on timing
        let time_diff = (after.timestamp - before.timestamp).num_seconds() as f64;
        let timing_confidence = if time_diff < 60.0 { 0.2 } else { 0.0 };

        // Increase confidence based on same target address
        let target_confidence = if before.to_address == target.to_address && target.to_address == after.to_address {
            0.2
        } else {
            0.0
        };

        confidence += gas_pattern_confidence + timing_confidence + target_confidence;
        Ok(confidence.min(1.0))
    }

    /// Detect frontrunning attacks
    async fn detect_frontrunning(
        &self,
        transaction: &TransactionData,
        recent_transactions: &[TransactionData],
    ) -> Result<Option<MevThreat>, Box<dyn std::error::Error + Send + Sync>> {
        // Look for transactions with higher gas price that arrived just before
        let window_start = transaction.timestamp - chrono::Duration::seconds(30); // 30 second window
        
        let potential_frontrunners: Vec<&TransactionData> = recent_transactions
            .iter()
            .filter(|tx| {
                tx.timestamp >= window_start 
                && tx.timestamp < transaction.timestamp
                && tx.gas_price > transaction.gas_price
                && tx.to_address == transaction.to_address
            })
            .collect();

        if potential_frontrunners.is_empty() {
            return Ok(None);
        }

        // Calculate frontrunning risk
        let max_gas_diff = potential_frontrunners
            .iter()
            .map(|tx| tx.gas_price.to_f64().unwrap_or(0.0) - transaction.gas_price.to_f64().unwrap_or(0.0))
            .fold(0.0, f64::max);

        let estimated_loss = max_gas_diff * transaction.gas_used as f64;

        Ok(Some(MevThreat {
            threat_type: MevThreatType::Frontrunning,
            severity: self.determine_frontrunning_severity(estimated_loss).await?,
            estimated_loss,
            description: format!("Frontrunning detected: {} potential frontrunners", potential_frontrunners.len()),
            confidence: 0.7,
            timestamp: Utc::now(),
            transaction_hash: Some(transaction.hash.clone()),
            affected_addresses: potential_frontrunners.iter().map(|tx| tx.from_address.clone()).collect(),
            mitigation_strategies: vec![
                "Use private mempool".to_string(),
                "Increase gas price".to_string(),
                "Use time-boosted execution".to_string(),
            ],
        }))
    }

    /// Determine severity of frontrunning attack
    async fn determine_frontrunning_severity(&self, estimated_loss: f64) -> Result<MevThreatSeverity, Box<dyn std::error::Error + Send + Sync>> {
        match estimated_loss {
            loss if loss < 0.05 => Ok(MevThreatSeverity::Low),
            loss if loss < 0.5 => Ok(MevThreatSeverity::Medium),
            loss if loss < 5.0 => Ok(MevThreatSeverity::High),
            _ => Ok(MevThreatSeverity::Critical),
        }
    }

    /// Detect backrunning attacks
    async fn detect_backrunning(
        &self,
        transaction: &TransactionData,
        recent_transactions: &[TransactionData],
    ) -> Result<Option<MevThreat>, Box<dyn std::error::Error + Send + Sync>> {
        // Look for transactions with higher gas price that arrived just after
        let window_end = transaction.timestamp + chrono::Duration::seconds(30); // 30 second window
        
        let potential_backrunners: Vec<&TransactionData> = recent_transactions
            .iter()
            .filter(|tx| {
                tx.timestamp > transaction.timestamp
                && tx.timestamp <= window_end
                && tx.gas_price > transaction.gas_price
                && tx.to_address == transaction.to_address
            })
            .collect();

        if potential_backrunners.is_empty() {
            return Ok(None);
        }

        let estimated_loss = 0.1; // Base backrunning loss estimation

        Ok(Some(MevThreat {
            threat_type: MevThreatType::Backrunning,
            severity: MevThreatSeverity::Medium,
            estimated_loss,
            description: format!("Backrunning detected: {} potential backrunners", potential_backrunners.len()),
            confidence: 0.6,
            timestamp: Utc::now(),
            transaction_hash: Some(transaction.hash.clone()),
            affected_addresses: potential_backrunners.iter().map(|tx| tx.from_address.clone()).collect(),
            mitigation_strategies: vec![
                "Use private mempool".to_string(),
                "Optimize gas strategy".to_string(),
            ],
        }))
    }

    /// Detect flash loan attacks
    async fn detect_flashloan_attack(
        &self,
        transaction: &TransactionData,
    ) -> Result<Option<MevThreat>, Box<dyn std::error::Error + Send + Sync>> {
        // Check for flash loan patterns in input data
        let flash_loan_indicators = [
            "flash",
            "loan",
            "borrow",
            "repay",
            "flashloan",
            "flashLoan",
        ];

        let input_lower = transaction.input_data.to_lowercase();
        let has_flash_loan_pattern = flash_loan_indicators.iter().any(|indicator| {
            input_lower.contains(indicator)
        });

        if !has_flash_loan_pattern {
            return Ok(None);
        }

        // Check for large value transactions
        let is_large_value = transaction.value > Decimal::from(1000000); // 1M threshold

        if is_large_value {
            Ok(Some(MevThreat {
                threat_type: MevThreatType::FlashLoan,
                severity: MevThreatSeverity::High,
                estimated_loss: 0.0, // Flash loans themselves don't cause direct loss
                description: "Flash loan attack pattern detected".to_string(),
                confidence: 0.8,
                timestamp: Utc::now(),
                transaction_hash: Some(transaction.hash.clone()),
                affected_addresses: vec![transaction.from_address.clone()],
                mitigation_strategies: vec![
                    "Implement flash loan protection".to_string(),
                    "Add reentrancy guards".to_string(),
                    "Validate token balances".to_string(),
                ],
            }))
        } else {
            Ok(None)
        }
    }

    /// Analyze gas optimization opportunities
    async fn analyze_gas_optimization(
        &self,
        transaction: &TransactionData,
    ) -> Result<Option<MevThreat>, Box<dyn std::error::Error + Send + Sync>> {
        let current_gas_price = transaction.gas_price.to_f64().unwrap_or(0.0);
        
        // Check if gas price is outside optimal range
        let min_gas = self.config.min_gas_price_gwei as f64;
        let max_gas = self.config.max_gas_price_gwei as f64;

        if current_gas_price < min_gas || current_gas_price > max_gas {
            let optimal_gas = self.gas_optimizer.get_optimal_gas_price().await?;
            let gas_diff = (current_gas_price - optimal_gas).abs();

            Ok(Some(MevThreat {
                threat_type: MevThreatType::GasOptimization,
                severity: if gas_diff > 100.0 { MevThreatSeverity::High } else { MevThreatSeverity::Medium },
                estimated_loss: gas_diff * transaction.gas_used as f64 / 1e9, // Convert to ETH
                description: format!("Gas price optimization opportunity: current={}, optimal={}", current_gas_price, optimal_gas),
                confidence: 0.9,
                timestamp: Utc::now(),
                transaction_hash: Some(transaction.hash.clone()),
                affected_addresses: vec![transaction.from_address.clone()],
                mitigation_strategies: vec![
                    "Use gas optimization service".to_string(),
                    "Implement dynamic gas pricing".to_string(),
                ],
            }))
        } else {
            Ok(None)
        }
    }

    /// Assess execution risk for transaction
    async fn assess_execution_risk(
        &self,
        transaction: &TransactionData,
        threats: &[MevThreat],
    ) -> Result<RiskAssessment, Box<dyn std::error::Error + Send + Sync>> {
        let mev_risk_score = self.calculate_mev_risk_score(threats).await?;
        let estimated_slippage = self.estimate_slippage(transaction).await?;
        let success_probability = self.calculate_success_probability(threats).await?;
        let recommended_gas_price = self.gas_optimizer.get_optimal_gas_price().await?;
        let protection_confidence = self.calculate_protection_confidence(threats).await?;

        Ok(RiskAssessment {
            mev_risk_score,
            estimated_slippage,
            success_probability,
            recommended_gas_price: recommended_gas_price as u64,
            protection_confidence,
        })
    }

    /// Calculate MEV risk score
    async fn calculate_mev_risk_score(&self, threats: &[MevThreat]) -> Result<f64, Box<dyn std::error::Error + Send + Sync>> {
        if threats.is_empty() {
            return Ok(0.0);
        }

        let total_risk: f64 = threats.iter().map(|threat| {
            let severity_multiplier = match threat.severity {
                MevThreatSeverity::Low => 0.25,
                MevThreatSeverity::Medium => 0.5,
                MevThreatSeverity::High => 0.75,
                MevThreatSeverity::Critical => 1.0,
            };
            threat.confidence * severity_multiplier * threat.estimated_loss
        }).sum();

        Ok(total_risk.min(1.0))
    }

    /// Estimate slippage for transaction
    async fn estimate_slippage(&self, transaction: &TransactionData) -> Result<f64, Box<dyn std::error::Error + Send + Sync>> {
        // Simple slippage estimation based on gas price
        let gas_price = transaction.gas_price.to_f64().unwrap_or(0.0);
        let base_slippage = 0.1; // 0.1% base slippage
        
        // Increase slippage for high gas prices
        let gas_multiplier = if gas_price > 100.0 { 2.0 } else { 1.0 };
        
        Ok(base_slippage * gas_multiplier)
    }

    /// Calculate success probability
    async fn calculate_success_probability(&self, threats: &[MevThreat]) -> Result<f64, Box<dyn std::error::Error + Send + Sync>> {
        let base_probability = 0.95; // 95% base success rate
        
        // Reduce probability based on threats
        let threat_penalty: f64 = threats.iter().map(|threat| {
            match threat.severity {
                MevThreatSeverity::Low => 0.01,
                MevThreatSeverity::Medium => 0.03,
                MevThreatSeverity::High => 0.08,
                MevThreatSeverity::Critical => 0.15,
            }
        }).sum();

        Ok((base_probability - threat_penalty).max(0.1))
    }

    /// Calculate protection confidence
    async fn calculate_protection_confidence(&self, threats: &[MevThreat]) -> Result<f64, Box<dyn std::error::Error + Send + Sync>> {
        if threats.is_empty() {
            return Ok(1.0);
        }

        let avg_confidence: f64 = threats.iter().map(|t| t.confidence).sum::<f64>() / threats.len() as f64;
        Ok(avg_confidence)
    }

    /// Determine execution strategy
    async fn determine_execution_strategy(
        &self,
        threats: &[MevThreat],
        risk_assessment: &RiskAssessment,
    ) -> Result<ExecutionStrategy, Box<dyn std::error::Error + Send + Sync>> {
        if threats.is_empty() {
            return Ok(ExecutionStrategy::GasOptimized);
        }

        // Check for critical threats
        let has_critical = threats.iter().any(|t| matches!(t.severity, MevThreatSeverity::Critical));
        if has_critical {
            return Ok(ExecutionStrategy::PrivateMempool);
        }

        // Check for sandwich attacks
        let has_sandwich = threats.iter().any(|t| matches!(t.threat_type, MevThreatType::Sandwich));
        if has_sandwich {
            return Ok(ExecutionStrategy::FlashbotsBundle);
        }

        // Check for high MEV risk
        if risk_assessment.mev_risk_score > 0.7 {
            return Ok(ExecutionStrategy::TimeBoosted);
        }

        // Default to gas optimization
        Ok(ExecutionStrategy::GasOptimized)
    }

    /// Determine protection level
    async fn determine_protection_level(&self, threats: &[MevThreat]) -> Result<ProtectionLevel, Box<dyn std::error::Error + Send + Sync>> {
        if threats.is_empty() {
            return Ok(ProtectionLevel::Basic);
        }

        let max_severity = threats.iter().map(|t| &t.severity).max().unwrap_or(&MevThreatSeverity::Low);
        
        match max_severity {
            MevThreatSeverity::Low => Ok(ProtectionLevel::Basic),
            MevThreatSeverity::Medium => Ok(ProtectionLevel::Enhanced),
            MevThreatSeverity::High => Ok(ProtectionLevel::Maximum),
            MevThreatSeverity::Critical => Ok(ProtectionLevel::Custom(10)),
        }
    }

    /// Estimate gas for protected execution
    async fn estimate_protected_gas(
        &self,
        transaction: &TransactionData,
        strategy: &ExecutionStrategy,
    ) -> Result<u64, Box<dyn std::error::Error + Send + Sync>> {
        let base_gas = transaction.gas_used;
        
        let multiplier = match strategy {
            ExecutionStrategy::PrivateMempool => 1.1,
            ExecutionStrategy::FlashbotsBundle => 1.2,
            ExecutionStrategy::TimeBoosted => 1.15,
            ExecutionStrategy::GasOptimized => 0.95,
            ExecutionStrategy::MultiPath => 1.3,
            ExecutionStrategy::Custom(_) => 1.1,
        };

        Ok((base_gas as f64 * multiplier) as u64)
    }

    /// Estimate cost for protected execution
    async fn estimate_protected_cost(
        &self,
        transaction: &TransactionData,
        strategy: &ExecutionStrategy,
    ) -> Result<Decimal, Box<dyn std::error::Error + Send + Sync>> {
        let protected_gas = self.estimate_protected_gas(transaction, strategy).await?;
        let optimal_gas_price = self.gas_optimizer.get_optimal_gas_price().await?;
        
        let cost = Decimal::from(protected_gas) * Decimal::from_f64(optimal_gas_price).unwrap_or(Decimal::ZERO);
        Ok(cost)
    }

    /// Store threats in history
    async fn store_threats(&self, transaction_hash: &str, threats: &[MevThreat]) {
        let mut history = self.threat_history.write().await;
        history.insert(transaction_hash.to_string(), threats.to_vec());
    }

    /// Get threat history for transaction
    pub async fn get_threat_history(&self, transaction_hash: &str) -> Vec<MevThreat> {
        let history = self.threat_history.read().await;
        history.get(transaction_hash).cloned().unwrap_or_default()
    }

    /// Get all threats for address
    pub async fn get_address_threats(&self, address: &str) -> Vec<MevThreat> {
        let history = self.threat_history.read().await;
        let mut all_threats = Vec::new();
        
        for threats in history.values() {
            for threat in threats {
                if threat.affected_addresses.contains(&address.to_string()) {
                    all_threats.push(threat.clone());
                }
            }
        }
        
        all_threats
    }
}

// Supporting components

/// Private mempool for MEV protection
#[derive(Debug, Clone)]
pub struct PrivateMempool {
    pub name: String,
    pub endpoint: String,
    pub reliability: f64,
    pub cost_multiplier: f64,
}

/// MEV-resistant relayer
#[derive(Debug, Clone)]
pub struct MevResistantRelayer {
    pub name: String,
    pub endpoint: String,
    pub protection_level: ProtectionLevel,
    pub success_rate: f64,
}

/// Gas optimization service
#[derive(Debug, Clone)]
pub struct GasOptimizer {
    pub current_network_conditions: Arc<RwLock<NetworkConditions>>,
}

impl GasOptimizer {
    pub fn new() -> Self {
        Self {
            current_network_conditions: Arc::new(RwLock::new(NetworkConditions::default())),
        }
    }

    pub async fn get_optimal_gas_price(&self) -> Result<f64, Box<dyn std::error::Error + Send + Sync>> {
        let conditions = self.current_network_conditions.read().await;
        Ok(conditions.optimal_gas_price_gwei)
    }

    pub async fn update_network_conditions(&self, conditions: NetworkConditions) {
        let mut current = self.current_network_conditions.write().await;
        *current = conditions;
    }
}

/// Network conditions for gas optimization
#[derive(Debug, Clone)]
pub struct NetworkConditions {
    pub optimal_gas_price_gwei: f64,
    pub network_congestion: f64,
    pub block_time_seconds: f64,
    pub pending_transactions: u64,
}

impl Default for NetworkConditions {
    fn default() -> Self {
        Self {
            optimal_gas_price_gwei: 25.0,
            network_congestion: 0.5,
            block_time_seconds: 12.0,
            pending_transactions: 1000,
        }
    }
}

/// Timing analyzer for MEV protection
#[derive(Debug, Clone)]
pub struct TimingAnalyzer {
    pub historical_patterns: Arc<RwLock<HashMap<String, TimingPattern>>>,
}

impl TimingAnalyzer {
    pub fn new() -> Self {
        Self {
            historical_patterns: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    pub async fn analyze_optimal_timing(&self, transaction_type: &str) -> Result<DateTime<Utc>, Box<dyn std::error::Error + Send + Sync>> {
        // Simple timing analysis - return current time + small offset
        Ok(Utc::now() + chrono::Duration::seconds(30))
    }
}

/// Timing pattern for analysis
#[derive(Debug, Clone)]
pub struct TimingPattern {
    pub transaction_type: String,
    pub optimal_hour: u8,
    pub optimal_day_of_week: u8,
    pub success_rate: f64,
}

impl Default for TimingAnalyzer {
    fn default() -> Self {
        Self::new()
    }
}

impl Default for GasOptimizer {
    fn default() -> Self {
        Self::new()
    }
}