use crate::types::{
    PositionId, Position, HealthFactor, RiskParameters, RiskLevel, RiskAlert, AlertType
};
use crate::liquidation::{LiquidationMonitor, AlertSystem};
use crate::risk::price_impact::{PriceImpactSimulator, TradeSimulation, RecommendedAction};
use async_trait::async_trait;
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::{RwLock, Mutex};
use tokio::time::{interval, Instant};
use tracing::{info, warn, error, debug};
use uuid::Uuid;
use chrono::{DateTime, Utc};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AutomationConfig {
    pub enabled: bool,
    pub safety_thresholds: SafetyThresholds,
    pub intervention_rules: Vec<InterventionRule>,
    pub execution_limits: ExecutionLimits,
    pub approval_requirements: ApprovalRequirements,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SafetyThresholds {
    pub auto_reduce_threshold: Decimal,     // Health factor below which to reduce position
    pub emergency_exit_threshold: Decimal,  // Health factor below which to exit entirely
    pub max_price_impact_percent: Decimal,  // Maximum acceptable price impact for auto trades
    pub max_position_reduction_percent: Decimal, // Maximum % of position to reduce in one action
    pub cooldown_period: Duration,          // Minimum time between automated actions
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InterventionRule {
    pub id: String,
    pub name: String,
    pub conditions: Vec<InterventionCondition>,
    pub actions: Vec<AutomatedAction>,
    pub priority: u8, // 1-10, higher is more urgent
    pub enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum InterventionCondition {
    HealthFactorBelow(Decimal),
    HealthFactorAbove(Decimal),
    PriceImpactAbove(Decimal),
    VolatilityAbove(Decimal),
    LiquidityBelow(Decimal),
    TimeBasedCondition {
        after_hours: bool,
        market_conditions: MarketCondition,
    },
    ProtocolSpecific {
        protocol: String,
        condition_type: String,
        threshold: Decimal,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum MarketCondition {
    High,
    Medium,
    Low,
    Extreme,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AutomatedAction {
    ReducePosition {
        percentage: Decimal,
        max_price_impact: Decimal,
    },
    AddCollateral {
        target_health_factor: Decimal,
        max_amount_usd: Decimal,
    },
    RepayDebt {
        percentage: Decimal,
        max_price_impact: Decimal,
    },
    EmergencyExit {
        accept_high_slippage: bool,
    },
    SendAlert {
        escalation_level: RiskLevel,
        require_acknowledgment: bool,
    },
    PauseTrading {
        duration: Duration,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionLimits {
    pub max_trades_per_hour: u32,
    pub max_trades_per_day: u32,
    pub max_value_per_trade_usd: Decimal,
    pub max_total_value_per_day_usd: Decimal,
    pub require_multiple_confirmations: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApprovalRequirements {
    pub require_human_approval_above_usd: Decimal,
    pub auto_approve_emergency_exits: bool,
    pub approval_timeout: Duration,
    pub escalation_contacts: Vec<String>,
}

impl Default for AutomationConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            safety_thresholds: SafetyThresholds {
                auto_reduce_threshold: Decimal::from(130) / Decimal::from(100), // 1.3
                emergency_exit_threshold: Decimal::from(110) / Decimal::from(100), // 1.1
                max_price_impact_percent: Decimal::from(5), // 5%
                max_position_reduction_percent: Decimal::from(25), // 25%
                cooldown_period: Duration::from_secs(300), // 5 minutes
            },
            intervention_rules: vec![
                InterventionRule {
                    id: "critical_health_reduction".to_string(),
                    name: "Critical Health Factor Position Reduction".to_string(),
                    conditions: vec![InterventionCondition::HealthFactorBelow(Decimal::from(125) / Decimal::from(100))],
                    actions: vec![
                        AutomatedAction::SendAlert {
                            escalation_level: RiskLevel::Critical,
                            require_acknowledgment: true,
                        },
                        AutomatedAction::ReducePosition {
                            percentage: Decimal::from(20),
                            max_price_impact: Decimal::from(3),
                        }
                    ],
                    priority: 8,
                    enabled: true,
                },
                InterventionRule {
                    id: "emergency_exit".to_string(),
                    name: "Emergency Position Exit".to_string(),
                    conditions: vec![InterventionCondition::HealthFactorBelow(Decimal::from(110) / Decimal::from(100))],
                    actions: vec![
                        AutomatedAction::SendAlert {
                            escalation_level: RiskLevel::Emergency,
                            require_acknowledgment: false,
                        },
                        AutomatedAction::EmergencyExit {
                            accept_high_slippage: true,
                        }
                    ],
                    priority: 10,
                    enabled: true,
                },
            ],
            execution_limits: ExecutionLimits {
                max_trades_per_hour: 10,
                max_trades_per_day: 50,
                max_value_per_trade_usd: Decimal::from(100_000),
                max_total_value_per_day_usd: Decimal::from(1_000_000),
                require_multiple_confirmations: true,
            },
            approval_requirements: ApprovalRequirements {
                require_human_approval_above_usd: Decimal::from(50_000),
                auto_approve_emergency_exits: true,
                approval_timeout: Duration::from_secs(300), // 5 minutes
                escalation_contacts: vec!["risk-manager@yieldsensei.com".to_string()],
            },
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AutomatedActionExecution {
    pub id: Uuid,
    pub position_id: PositionId,
    pub action: AutomatedAction,
    pub triggered_by_rule: String,
    pub status: ExecutionStatus,
    pub simulation_result: Option<TradeSimulation>,
    pub executed_at: DateTime<Utc>,
    pub completed_at: Option<DateTime<Utc>>,
    pub result: Option<ExecutionResult>,
    pub approval_required: bool,
    pub approved_by: Option<String>,
    pub approved_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ExecutionStatus {
    Pending,
    AwaitingApproval,
    Approved,
    Executing,
    Completed,
    Failed,
    Cancelled,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionResult {
    pub success: bool,
    pub transaction_hash: Option<String>,
    pub amount_executed: Option<Decimal>,
    pub actual_price_impact: Option<Decimal>,
    pub gas_used: Option<u64>,
    pub error_message: Option<String>,
}

pub struct AutomatedPositionManager {
    config: Arc<RwLock<AutomationConfig>>,
    liquidation_monitor: Arc<LiquidationMonitor>,
    price_impact_simulator: Arc<PriceImpactSimulator>,
    alert_system: Arc<dyn AlertSystem>,
    execution_history: Arc<Mutex<Vec<AutomatedActionExecution>>>,
    trade_executor: Arc<dyn TradeExecutor>,
    last_action_time: Arc<RwLock<HashMap<PositionId, Instant>>>,
    daily_execution_stats: Arc<RwLock<DailyExecutionStats>>,
}

#[derive(Debug, Default)]
struct DailyExecutionStats {
    trades_today: u32,
    value_traded_today: Decimal,
    last_reset_date: DateTime<Utc>,
}

impl AutomatedPositionManager {
    pub fn new(
        liquidation_monitor: Arc<LiquidationMonitor>,
        price_impact_simulator: Arc<PriceImpactSimulator>,
        alert_system: Arc<dyn AlertSystem>,
        trade_executor: Arc<dyn TradeExecutor>,
    ) -> Self {
        Self {
            config: Arc::new(RwLock::new(AutomationConfig::default())),
            liquidation_monitor,
            price_impact_simulator,
            alert_system,
            execution_history: Arc::new(Mutex::new(Vec::new())),
            trade_executor,
            last_action_time: Arc::new(RwLock::new(HashMap::new())),
            daily_execution_stats: Arc::new(RwLock::new(DailyExecutionStats::default())),
        }
    }

    pub async fn start_monitoring(&self) {
        let mut interval = interval(Duration::from_secs(30)); // Check every 30 seconds
        
        loop {
            interval.tick().await;
            
            if let Err(e) = self.evaluate_all_positions().await {
                error!("Error during position evaluation: {}", e);
            }
        }
    }

    async fn evaluate_all_positions(&self) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let config = self.config.read().await;
        
        if !config.enabled {
            return Ok(());
        }

        let positions = self.liquidation_monitor.list_positions();
        debug!("Evaluating {} positions for automated interventions", positions.len());

        for position in positions {
            if let Err(e) = self.evaluate_position(&position, &config).await {
                error!("Failed to evaluate position {}: {}", position.id, e);
            }
        }

        Ok(())
    }

    async fn evaluate_position(
        &self,
        position: &Position,
        config: &AutomationConfig,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        // Check cooldown period
        let last_action_times = self.last_action_time.read().await;
        if let Some(last_time) = last_action_times.get(&position.id) {
            if last_time.elapsed() < config.safety_thresholds.cooldown_period {
                debug!("Position {} is in cooldown period", position.id);
                return Ok(());
            }
        }
        drop(last_action_times);

        // Calculate current health factor
        let health_factor = self.liquidation_monitor.calculate_health(position.id).await?;
        
        // Evaluate intervention rules
        let mut applicable_rules: Vec<&InterventionRule> = config.intervention_rules
            .iter()
            .filter(|rule| rule.enabled && self.check_rule_conditions(rule, position, &health_factor).await)
            .collect();

        // Sort by priority (highest first)
        applicable_rules.sort_by(|a, b| b.priority.cmp(&a.priority));

        // Execute the highest priority rule
        if let Some(rule) = applicable_rules.first() {
            info!("Applying intervention rule '{}' to position {}", rule.name, position.id);
            self.execute_intervention_rule(position, rule, &health_factor).await?;
        }

        Ok(())
    }

    async fn check_rule_conditions(
        &self,
        rule: &InterventionRule,
        position: &Position,
        health_factor: &HealthFactor,
    ) -> bool {
        for condition in &rule.conditions {
            if !self.evaluate_condition(condition, position, health_factor).await {
                return false;
            }
        }
        true
    }

    async fn evaluate_condition(
        &self,
        condition: &InterventionCondition,
        _position: &Position,
        health_factor: &HealthFactor,
    ) -> bool {
        match condition {
            InterventionCondition::HealthFactorBelow(threshold) => {
                health_factor.value < *threshold
            }
            InterventionCondition::HealthFactorAbove(threshold) => {
                health_factor.value > *threshold
            }
            InterventionCondition::PriceImpactAbove(_threshold) => {
                // Would need to simulate trade to check this
                // For now, return false as placeholder
                false
            }
            InterventionCondition::VolatilityAbove(_threshold) => {
                // Would need volatility data
                false
            }
            InterventionCondition::LiquidityBelow(_threshold) => {
                // Would need liquidity data
                false
            }
            InterventionCondition::TimeBasedCondition { .. } => {
                // Would check current time and market conditions
                false
            }
            InterventionCondition::ProtocolSpecific { .. } => {
                // Would check protocol-specific conditions
                false
            }
        }
    }

    async fn execute_intervention_rule(
        &self,
        position: &Position,
        rule: &InterventionRule,
        health_factor: &HealthFactor,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        for action in &rule.actions {
            let execution = AutomatedActionExecution {
                id: Uuid::new_v4(),
                position_id: position.id,
                action: action.clone(),
                triggered_by_rule: rule.id.clone(),
                status: ExecutionStatus::Pending,
                simulation_result: None,
                executed_at: Utc::now(),
                completed_at: None,
                result: None,
                approval_required: false,
                approved_by: None,
                approved_at: None,
            };

            self.execute_automated_action(execution, position, health_factor).await?;
        }

        // Update last action time
        let mut last_action_times = self.last_action_time.write().await;
        last_action_times.insert(position.id, Instant::now());

        Ok(())
    }

    async fn execute_automated_action(
        &self,
        mut execution: AutomatedActionExecution,
        position: &Position,
        health_factor: &HealthFactor,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        match &execution.action {
            AutomatedAction::SendAlert { escalation_level, require_acknowledgment } => {
                let alert = RiskAlert {
                    id: Uuid::new_v4(),
                    position_id: position.id,
                    alert_type: AlertType::LiquidationRisk,
                    risk_level: escalation_level.clone(),
                    health_factor: health_factor.clone(),
                    message: format!("Automated intervention triggered: {}", execution.triggered_by_rule),
                    created_at: Utc::now(),
                    acknowledged: !require_acknowledgment,
                };

                self.alert_system.send_alert(alert).await?;
                execution.status = ExecutionStatus::Completed;
                execution.completed_at = Some(Utc::now());
                execution.result = Some(ExecutionResult {
                    success: true,
                    transaction_hash: None,
                    amount_executed: None,
                    actual_price_impact: None,
                    gas_used: None,
                    error_message: None,
                });
            }
            
            AutomatedAction::ReducePosition { percentage, max_price_impact } => {
                self.execute_position_reduction(&mut execution, position, *percentage, *max_price_impact).await?;
            }
            
            AutomatedAction::EmergencyExit { accept_high_slippage: _ } => {
                self.execute_emergency_exit(&mut execution, position).await?;
            }
            
            AutomatedAction::AddCollateral { target_health_factor: _, max_amount_usd: _ } => {
                // Placeholder for collateral addition
                warn!("Add collateral action not yet implemented");
                execution.status = ExecutionStatus::Failed;
                execution.result = Some(ExecutionResult {
                    success: false,
                    transaction_hash: None,
                    amount_executed: None,
                    actual_price_impact: None,
                    gas_used: None,
                    error_message: Some("Add collateral not implemented".to_string()),
                });
            }
            
            AutomatedAction::RepayDebt { percentage: _, max_price_impact: _ } => {
                // Placeholder for debt repayment
                warn!("Repay debt action not yet implemented");
                execution.status = ExecutionStatus::Failed;
            }
            
            AutomatedAction::PauseTrading { duration: _ } => {
                // Placeholder for trading pause
                info!("Trading pause requested for position {}", position.id);
                execution.status = ExecutionStatus::Completed;
            }
        }

        // Store execution record
        let mut history = self.execution_history.lock().await;
        history.push(execution);

        Ok(())
    }

    async fn execute_position_reduction(
        &self,
        execution: &mut AutomatedActionExecution,
        position: &Position,
        percentage: Decimal,
        max_price_impact: Decimal,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        // Check execution limits
        if !self.check_execution_limits().await? {
            execution.status = ExecutionStatus::Failed;
            execution.result = Some(ExecutionResult {
                success: false,
                transaction_hash: None,
                amount_executed: None,
                actual_price_impact: None,
                gas_used: None,
                error_message: Some("Execution limits exceeded".to_string()),
            });
            return Ok(());
        }

        // Simulate the trade first
        let collateral_token = position.collateral_tokens.iter().next();
        if let Some((token_address, token_position)) = collateral_token {
            let reduction_amount = token_position.amount * percentage / Decimal::from(100);
            
            let simulation = self.price_impact_simulator
                .simulate_liquidation_trade(position.id, token_address, reduction_amount)
                .await?;

            execution.simulation_result = Some(simulation.clone());

            // Check if price impact is acceptable
            if simulation.expected_outcome.total_price_impact > max_price_impact {
                warn!("Price impact {:.2}% exceeds maximum {:.2}% for position {}", 
                      simulation.expected_outcome.total_price_impact, max_price_impact, position.id);
                execution.status = ExecutionStatus::Failed;
                execution.result = Some(ExecutionResult {
                    success: false,
                    transaction_hash: None,
                    amount_executed: None,
                    actual_price_impact: Some(simulation.expected_outcome.total_price_impact),
                    gas_used: None,
                    error_message: Some("Price impact too high".to_string()),
                });
                return Ok(());
            }

            // Check if approval is required
            let config = self.config.read().await;
            let trade_value = reduction_amount * token_position.price_per_token;
            if trade_value > config.approval_requirements.require_human_approval_above_usd {
                execution.approval_required = true;
                execution.status = ExecutionStatus::AwaitingApproval;
                // In a real implementation, this would trigger approval workflow
                warn!("Trade value ${:.2} requires human approval for position {}", 
                      trade_value, position.id);
                return Ok(());
            }

            // Execute the trade
            execution.status = ExecutionStatus::Executing;
            match self.trade_executor.execute_position_reduction(position.id, token_address, reduction_amount).await {
                Ok(result) => {
                    execution.status = ExecutionStatus::Completed;
                    execution.completed_at = Some(Utc::now());
                    execution.result = Some(result);
                    
                    // Update daily stats
                    self.update_daily_stats(trade_value).await;
                    
                    info!("Successfully reduced position {} by {:.2}%", position.id, percentage);
                }
                Err(e) => {
                    execution.status = ExecutionStatus::Failed;
                    execution.result = Some(ExecutionResult {
                        success: false,
                        transaction_hash: None,
                        amount_executed: None,
                        actual_price_impact: None,
                        gas_used: None,
                        error_message: Some(e.to_string()),
                    });
                    error!("Failed to reduce position {}: {}", position.id, e);
                }
            }
        }

        Ok(())
    }

    async fn execute_emergency_exit(
        &self,
        execution: &mut AutomatedActionExecution,
        position: &Position,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        info!("Executing emergency exit for position {}", position.id);
        
        execution.status = ExecutionStatus::Executing;
        match self.trade_executor.emergency_exit_position(position.id).await {
            Ok(result) => {
                execution.status = ExecutionStatus::Completed;
                execution.completed_at = Some(Utc::now());
                execution.result = Some(result);
                info!("Emergency exit completed for position {}", position.id);
            }
            Err(e) => {
                execution.status = ExecutionStatus::Failed;
                execution.result = Some(ExecutionResult {
                    success: false,
                    transaction_hash: None,
                    amount_executed: None,
                    actual_price_impact: None,
                    gas_used: None,
                    error_message: Some(e.to_string()),
                });
                error!("Emergency exit failed for position {}: {}", position.id, e);
            }
        }

        Ok(())
    }

    async fn check_execution_limits(&self) -> Result<bool, Box<dyn std::error::Error + Send + Sync>> {
        let config = self.config.read().await;
        let mut stats = self.daily_execution_stats.write().await;
        
        // Reset daily stats if it's a new day
        let now = Utc::now();
        if now.date_naive() != stats.last_reset_date.date_naive() {
            stats.trades_today = 0;
            stats.value_traded_today = Decimal::ZERO;
            stats.last_reset_date = now;
        }

        // Check daily limits
        if stats.trades_today >= config.execution_limits.max_trades_per_day {
            warn!("Daily trade limit exceeded: {}/{}", stats.trades_today, config.execution_limits.max_trades_per_day);
            return Ok(false);
        }

        if stats.value_traded_today >= config.execution_limits.max_total_value_per_day_usd {
            warn!("Daily value limit exceeded: ${:.2}/${:.2}", 
                  stats.value_traded_today, config.execution_limits.max_total_value_per_day_usd);
            return Ok(false);
        }

        Ok(true)
    }

    async fn update_daily_stats(&self, trade_value: Decimal) {
        let mut stats = self.daily_execution_stats.write().await;
        stats.trades_today += 1;
        stats.value_traded_today += trade_value;
    }

    pub async fn get_execution_history(&self) -> Vec<AutomatedActionExecution> {
        let history = self.execution_history.lock().await;
        history.clone()
    }

    pub async fn update_config(&self, new_config: AutomationConfig) {
        let mut config = self.config.write().await;
        *config = new_config;
        info!("Updated automated position manager configuration");
    }
}

#[async_trait]
pub trait TradeExecutor: Send + Sync {
    async fn execute_position_reduction(
        &self,
        position_id: PositionId,
        token_address: &str,
        amount: Decimal,
    ) -> Result<ExecutionResult, Box<dyn std::error::Error + Send + Sync>>;

    async fn emergency_exit_position(
        &self,
        position_id: PositionId,
    ) -> Result<ExecutionResult, Box<dyn std::error::Error + Send + Sync>>;

    async fn add_collateral(
        &self,
        position_id: PositionId,
        token_address: &str,
        amount: Decimal,
    ) -> Result<ExecutionResult, Box<dyn std::error::Error + Send + Sync>>;

    async fn repay_debt(
        &self,
        position_id: PositionId,
        token_address: &str,
        amount: Decimal,
    ) -> Result<ExecutionResult, Box<dyn std::error::Error + Send + Sync>>;
}