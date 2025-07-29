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
    
    pub type PositionId = u64;
    pub type TokenAddress = String;
    pub type UserId = u64;
    
    #[derive(Debug, Clone, Serialize, Deserialize)]
    pub struct Position {
        pub id: PositionId,
        pub user_id: UserId,
        pub token_address: TokenAddress,
        pub collateral_amount: Decimal,
        pub debt_amount: Decimal,
        pub collateral_token: TokenAddress,
        pub debt_token: TokenAddress,
        pub protocol: String,
        pub created_at: DateTime<Utc>,
        pub last_updated: DateTime<Utc>,
    }
    
    #[derive(Debug, Clone)]
    pub struct HealthFactor {
        pub position_id: PositionId,
        pub health_factor: Decimal,
        pub collateral_value: Decimal,
        pub debt_value: Decimal,
        pub liquidation_threshold: Decimal,
        pub liquidation_price: Option<Decimal>,
        pub calculated_at: DateTime<Utc>,
    }
    
    #[derive(Debug, Clone, Serialize, Deserialize)]
    pub struct LiquidationAlert {
        pub id: String,
        pub position_id: PositionId,
        pub user_id: UserId,
        pub alert_level: AlertLevel,
        pub current_health_factor: Decimal,
        pub threshold_health_factor: Decimal,
        pub estimated_liquidation_price: Option<Decimal>,
        pub time_to_liquidation_estimate: Option<chrono::Duration>,
        pub recommended_actions: Vec<String>,
        pub created_at: DateTime<Utc>,
        pub acknowledged: bool,
        pub resolved: bool,
    }
    
    #[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
    pub enum AlertLevel {
        Info,      // Health factor > 1.5
        Warning,   // 1.2 < Health factor <= 1.5  
        Critical,  // 1.0 < Health factor <= 1.2
        Emergency, // Health factor <= 1.0
    }
    
    #[derive(Debug, Clone)]
    pub struct MonitoringMetrics {
        pub total_positions_monitored: u64,
        pub active_alerts: u64,
        pub positions_at_risk: u64,
        pub avg_health_factor: Decimal,
        pub last_update: DateTime<Utc>,
        pub alerts_generated_24h: u64,
        pub positions_liquidated_24h: u64,
    }
    
    #[derive(Debug, thiserror::Error)]
    pub enum MonitoringError {
        #[error("Position not found: {0}")]
        PositionNotFound(PositionId),
        #[error("Health calculation failed: {0}")]
        HealthCalculationFailed(String),
        #[error("Alert generation failed: {0}")]
        AlertGenerationFailed(String),
        #[error("Database error: {0}")]
        DatabaseError(String),
        #[error("Real-time monitoring error: {0}")]
        RealTimeMonitoringError(String),
    }
    
    #[derive(Debug, Clone)]
    pub struct MonitoringConfig {
        pub health_check_interval_seconds: u64,
        pub alert_thresholds: AlertThresholds,
        pub batch_size: usize,
        pub enable_real_time_monitoring: bool,
        pub max_concurrent_calculations: usize,
    }
    
    #[derive(Debug, Clone)]
    pub struct AlertThresholds {
        pub info_threshold: Decimal,
        pub warning_threshold: Decimal,
        pub critical_threshold: Decimal,
        pub emergency_threshold: Decimal,
    }
    
    impl Default for MonitoringConfig {
        fn default() -> Self {
            Self {
                health_check_interval_seconds: 30,
                alert_thresholds: AlertThresholds {
                    info_threshold: Decimal::from_str("1.5").unwrap(),
                    warning_threshold: Decimal::from_str("1.2").unwrap(),
                    critical_threshold: Decimal::from_str("1.0").unwrap(),
                    emergency_threshold: Decimal::from_str("0.8").unwrap(),
                },
                batch_size: 100,
                enable_real_time_monitoring: true,
                max_concurrent_calculations: 10,
            }
        }
    }
}

use aegis_types::*;

/// Mock liquidation monitor for testing
pub struct MockLiquidationMonitor {
    positions: Arc<RwLock<HashMap<PositionId, Position>>>,
    alerts: Arc<RwLock<HashMap<String, LiquidationAlert>>>,
    health_factors: Arc<RwLock<HashMap<PositionId, HealthFactor>>>,
    config: MonitoringConfig,
    metrics: Arc<RwLock<MonitoringMetrics>>,
    monitoring_active: Arc<RwLock<bool>>,
}

impl MockLiquidationMonitor {
    fn new(config: MonitoringConfig) -> Self {
        Self {
            positions: Arc::new(RwLock::new(HashMap::new())),
            alerts: Arc::new(RwLock::new(HashMap::new())),
            health_factors: Arc::new(RwLock::new(HashMap::new())),
            config,
            metrics: Arc::new(RwLock::new(MonitoringMetrics {
                total_positions_monitored: 0,
                active_alerts: 0,
                positions_at_risk: 0,
                avg_health_factor: Decimal::ZERO,
                last_update: Utc::now(),
                alerts_generated_24h: 0,
                positions_liquidated_24h: 0,
            })),
            monitoring_active: Arc::new(RwLock::new(false)),
        }
    }
    
    async fn add_position(&self, position: Position) {
        let mut positions = self.positions.write().await;
        positions.insert(position.id, position);
    }
    
    async fn update_health_factor(&self, health_factor: HealthFactor) {
        let mut health_factors = self.health_factors.write().await;
        health_factors.insert(health_factor.position_id, health_factor);
    }
    
    async fn start_monitoring(&self) -> Result<(), MonitoringError> {
        let mut monitoring_active = self.monitoring_active.write().await;
        *monitoring_active = true;
        Ok(())
    }
    
    async fn stop_monitoring(&self) -> Result<(), MonitoringError> {
        let mut monitoring_active = self.monitoring_active.write().await;
        *monitoring_active = false;
        Ok(())
    }
    
    async fn is_monitoring_active(&self) -> bool {
        *self.monitoring_active.read().await
    }
    
    async fn check_position_health(&self, position_id: PositionId) -> Result<Option<LiquidationAlert>, MonitoringError> {
        let positions = self.positions.read().await;
        let health_factors = self.health_factors.read().await;
        
        let position = positions.get(&position_id)
            .ok_or(MonitoringError::PositionNotFound(position_id))?;
        
        let health_factor = health_factors.get(&position_id)
            .ok_or(MonitoringError::HealthCalculationFailed("Health factor not available".to_string()))?;
        
        let alert_level = self.determine_alert_level(health_factor.health_factor);
        
        if alert_level != AlertLevel::Info {
            let alert = self.generate_alert(position, health_factor, alert_level).await?;
            Ok(Some(alert))
        } else {
            Ok(None)
        }
    }
    
    async fn check_all_positions(&self) -> Result<Vec<LiquidationAlert>, MonitoringError> {
        let positions = self.positions.read().await;
        let mut alerts = Vec::new();
        
        for position_id in positions.keys() {
            if let Some(alert) = self.check_position_health(*position_id).await? {
                alerts.push(alert);
            }
        }
        
        Ok(alerts)
    }
    
    async fn get_active_alerts(&self) -> Vec<LiquidationAlert> {
        let alerts = self.alerts.read().await;
        alerts.values()
            .filter(|alert| !alert.resolved)
            .cloned()
            .collect()
    }
    
    async fn acknowledge_alert(&self, alert_id: &str) -> Result<(), MonitoringError> {
        let mut alerts = self.alerts.write().await;
        if let Some(alert) = alerts.get_mut(alert_id) {
            alert.acknowledged = true;
            Ok(())
        } else {
            Err(MonitoringError::AlertGenerationFailed(format!("Alert not found: {}", alert_id)))
        }
    }
    
    async fn resolve_alert(&self, alert_id: &str) -> Result<(), MonitoringError> {
        let mut alerts = self.alerts.write().await;
        if let Some(alert) = alerts.get_mut(alert_id) {
            alert.resolved = true;
            Ok(())
        } else {
            Err(MonitoringError::AlertGenerationFailed(format!("Alert not found: {}", alert_id)))
        }
    }
    
    async fn get_metrics(&self) -> MonitoringMetrics {
        let positions = self.positions.read().await;
        let alerts = self.alerts.read().await;
        let health_factors = self.health_factors.read().await;
        
        let active_alerts = alerts.values().filter(|a| !a.resolved).count() as u64;
        let positions_at_risk = health_factors.values()
            .filter(|hf| hf.health_factor < self.config.alert_thresholds.warning_threshold)
            .count() as u64;
        
        let avg_health_factor = if !health_factors.is_empty() {
            health_factors.values()
                .map(|hf| hf.health_factor)
                .sum::<Decimal>() / Decimal::from(health_factors.len())
        } else {
            Decimal::ZERO
        };
        
        MonitoringMetrics {
            total_positions_monitored: positions.len() as u64,
            active_alerts,
            positions_at_risk,
            avg_health_factor,
            last_update: Utc::now(),
            alerts_generated_24h: alerts.len() as u64,
            positions_liquidated_24h: 0, // Would be calculated from historical data
        }
    }
    
    async fn batch_health_check(&self, position_ids: &[PositionId]) -> Result<Vec<Option<LiquidationAlert>>, MonitoringError> {
        let mut alerts = Vec::new();
        
        for &position_id in position_ids {
            let alert = self.check_position_health(position_id).await?;
            alerts.push(alert);
        }
        
        Ok(alerts)
    }
    
    fn determine_alert_level(&self, health_factor: Decimal) -> AlertLevel {
        let thresholds = &self.config.alert_thresholds;
        
        if health_factor <= thresholds.emergency_threshold {
            AlertLevel::Emergency
        } else if health_factor <= thresholds.critical_threshold {
            AlertLevel::Critical
        } else if health_factor <= thresholds.warning_threshold {
            AlertLevel::Warning
        } else {
            AlertLevel::Info
        }
    }
    
    async fn generate_alert(&self, position: &Position, health_factor: &HealthFactor, alert_level: AlertLevel) -> Result<LiquidationAlert, MonitoringError> {
        let alert_id = format!("alert_{}_{}", position.id, Utc::now().timestamp_millis());
        
        let recommended_actions = match alert_level {
            AlertLevel::Emergency => vec![
                "IMMEDIATE ACTION REQUIRED: Add collateral or repay debt immediately".to_string(),
                "Position may be liquidated within minutes".to_string(),
                "Consider closing position to avoid liquidation penalty".to_string(),
            ],
            AlertLevel::Critical => vec![
                "URGENT: Add collateral or repay debt within 1 hour".to_string(),
                "Monitor position closely for price movements".to_string(),
                "Prepare for potential liquidation".to_string(),
            ],
            AlertLevel::Warning => vec![
                "Consider adding collateral or reducing debt".to_string(),
                "Monitor market conditions closely".to_string(),
                "Review position risk parameters".to_string(),
            ],
            AlertLevel::Info => vec![
                "Position is healthy but worth monitoring".to_string(),
            ],
        };
        
        let time_to_liquidation_estimate = match alert_level {
            AlertLevel::Emergency => Some(Duration::minutes(15)),
            AlertLevel::Critical => Some(Duration::hours(1)),
            AlertLevel::Warning => Some(Duration::hours(6)),
            AlertLevel::Info => None,
        };
        
        let alert = LiquidationAlert {
            id: alert_id.clone(),
            position_id: position.id,
            user_id: position.user_id,
            alert_level,
            current_health_factor: health_factor.health_factor,
            threshold_health_factor: self.config.alert_thresholds.critical_threshold,
            estimated_liquidation_price: health_factor.liquidation_price,
            time_to_liquidation_estimate,
            recommended_actions,
            created_at: Utc::now(),
            acknowledged: false,
            resolved: false,
        };
        
        let mut alerts = self.alerts.write().await;
        alerts.insert(alert_id, alert.clone());
        
        Ok(alert)
    }
}

#[cfg(test)]
mod liquidation_monitor_tests {
    use super::*;
    use tokio_test;
    
    #[tokio::test]
    async fn test_monitor_creation() {
        let config = MonitoringConfig::default();
        let monitor = MockLiquidationMonitor::new(config);
        
        assert!(!monitor.is_monitoring_active().await);
        
        let metrics = monitor.get_metrics().await;
        assert_eq!(metrics.total_positions_monitored, 0);
        assert_eq!(metrics.active_alerts, 0);
    }
    
    #[tokio::test]
    async fn test_start_stop_monitoring() {
        let config = MonitoringConfig::default();
        let monitor = MockLiquidationMonitor::new(config);
        
        // Start monitoring
        monitor.start_monitoring().await.unwrap();
        assert!(monitor.is_monitoring_active().await);
        
        // Stop monitoring
        monitor.stop_monitoring().await.unwrap();
        assert!(!monitor.is_monitoring_active().await);
    }
    
    #[tokio::test]
    async fn test_healthy_position_monitoring() {
        let config = MonitoringConfig::default();
        let monitor = MockLiquidationMonitor::new(config);
        
        // Add a healthy position
        let position = Position {
            id: 1,
            user_id: 100,
            token_address: "0x1234".to_string(),
            collateral_amount: Decimal::from(100),
            debt_amount: Decimal::from(30000),
            collateral_token: "ETH".to_string(),
            debt_token: "USDC".to_string(),
            protocol: "Aave".to_string(),
            created_at: Utc::now(),
            last_updated: Utc::now(),
        };
        
        let health_factor = HealthFactor {
            position_id: 1,
            health_factor: Decimal::from_str("2.5").unwrap(), // Healthy
            collateral_value: Decimal::from(200000),
            debt_value: Decimal::from(30000),
            liquidation_threshold: Decimal::from_str("0.8").unwrap(),
            liquidation_price: Some(Decimal::from(468)), // 30000 / (100 * 0.8)
            calculated_at: Utc::now(),
        };
        
        monitor.add_position(position).await;
        monitor.update_health_factor(health_factor).await;
        
        // Check position health - should not generate alert for healthy position
        let alert = monitor.check_position_health(1).await.unwrap();
        assert!(alert.is_none());
        
        let metrics = monitor.get_metrics().await;
        assert_eq!(metrics.total_positions_monitored, 1);
        assert_eq!(metrics.positions_at_risk, 0);
    }
    
    #[tokio::test]
    async fn test_warning_level_alert_generation() {
        let config = MonitoringConfig::default();
        let monitor = MockLiquidationMonitor::new(config);
        
        let position = Position {
            id: 2,
            user_id: 101,
            token_address: "0x5678".to_string(),
            collateral_amount: Decimal::from(50),
            debt_amount: Decimal::from(65000),
            collateral_token: "ETH".to_string(),
            debt_token: "USDC".to_string(),
            protocol: "Aave".to_string(),
            created_at: Utc::now(),
            last_updated: Utc::now(),
        };
        
        let health_factor = HealthFactor {
            position_id: 2,
            health_factor: Decimal::from_str("1.23").unwrap(), // Warning level
            collateral_value: Decimal::from(100000),
            debt_value: Decimal::from(65000),
            liquidation_threshold: Decimal::from_str("0.8").unwrap(),
            liquidation_price: Some(Decimal::from(1625)), // 65000 / (50 * 0.8)
            calculated_at: Utc::now(),
        };
        
        monitor.add_position(position).await;
        monitor.update_health_factor(health_factor).await;
        
        let alert = monitor.check_position_health(2).await.unwrap();
        assert!(alert.is_some());
        
        let alert = alert.unwrap();
        assert_eq!(alert.position_id, 2);
        assert_eq!(alert.alert_level, AlertLevel::Warning);
        assert_eq!(alert.current_health_factor, Decimal::from_str("1.23").unwrap());
        assert!(!alert.recommended_actions.is_empty());
        assert!(!alert.acknowledged);
        assert!(!alert.resolved);
    }
    
    #[tokio::test]
    async fn test_critical_level_alert_generation() {
        let config = MonitoringConfig::default();
        let monitor = MockLiquidationMonitor::new(config);
        
        let position = Position {
            id: 3,
            user_id: 102,
            token_address: "0x9abc".to_string(),
            collateral_amount: Decimal::from(40),
            debt_amount: Decimal::from(75000),
            collateral_token: "ETH".to_string(),
            debt_token: "USDC".to_string(),
            protocol: "Aave".to_string(),
            created_at: Utc::now(),
            last_updated: Utc::now(),
        };
        
        let health_factor = HealthFactor {
            position_id: 3,
            health_factor: Decimal::from_str("1.07").unwrap(), // Critical level
            collateral_value: Decimal::from(80000),
            debt_value: Decimal::from(75000),
            liquidation_threshold: Decimal::from_str("0.8").unwrap(),
            liquidation_price: Some(Decimal::from(2343)), // 75000 / (40 * 0.8)
            calculated_at: Utc::now(),
        };
        
        monitor.add_position(position).await;
        monitor.update_health_factor(health_factor).await;
        
        let alert = monitor.check_position_health(3).await.unwrap();
        assert!(alert.is_some());
        
        let alert = alert.unwrap();
        assert_eq!(alert.alert_level, AlertLevel::Critical);
        assert!(alert.time_to_liquidation_estimate.is_some());
        assert!(alert.recommended_actions.iter().any(|action| action.contains("URGENT")));
    }
    
    #[tokio::test]
    async fn test_emergency_level_alert_generation() {
        let config = MonitoringConfig::default();
        let monitor = MockLiquidationMonitor::new(config);
        
        let position = Position {
            id: 4,
            user_id: 103,
            token_address: "0xdef0".to_string(),
            collateral_amount: Decimal::from(30),
            debt_amount: Decimal::from(80000),
            collateral_token: "ETH".to_string(),
            debt_token: "USDC".to_string(),
            protocol: "Aave".to_string(),
            created_at: Utc::now(),
            last_updated: Utc::now(),
        };
        
        let health_factor = HealthFactor {
            position_id: 4,
            health_factor: Decimal::from_str("0.75").unwrap(), // Emergency level
            collateral_value: Decimal::from(60000),
            debt_value: Decimal::from(80000),
            liquidation_threshold: Decimal::from_str("0.8").unwrap(),
            liquidation_price: Some(Decimal::from(3333)), // 80000 / (30 * 0.8)
            calculated_at: Utc::now(),
        };
        
        monitor.add_position(position).await;
        monitor.update_health_factor(health_factor).await;
        
        let alert = monitor.check_position_health(4).await.unwrap();
        assert!(alert.is_some());
        
        let alert = alert.unwrap();
        assert_eq!(alert.alert_level, AlertLevel::Emergency);
        assert!(alert.recommended_actions.iter().any(|action| action.contains("IMMEDIATE ACTION REQUIRED")));
        
        // Check that time to liquidation is very short for emergency alerts
        if let Some(duration) = alert.time_to_liquidation_estimate {
            assert!(duration.num_minutes() <= 15);
        }
    }
    
    #[tokio::test]
    async fn test_batch_health_check() {
        let config = MonitoringConfig::default();
        let monitor = MockLiquidationMonitor::new(config);
        
        // Add multiple positions with different health levels
        for i in 1..=5 {
            let position = Position {
                id: i,
                user_id: 100 + i,
                token_address: format!("0x{:04x}", i),
                collateral_amount: Decimal::from(100),
                debt_amount: Decimal::from(30000 + (i * 10000)), // Increasing debt
                collateral_token: "ETH".to_string(),
                debt_token: "USDC".to_string(),
                protocol: "Aave".to_string(),
                created_at: Utc::now(),
                last_updated: Utc::now(),
            };
            
            let health_factor = HealthFactor {
                position_id: i,
                health_factor: Decimal::from_str(&format!("{}", 3.0 - (i as f64 * 0.4))).unwrap(),
                collateral_value: Decimal::from(200000),
                debt_value: Decimal::from(30000 + (i * 10000)),
                liquidation_threshold: Decimal::from_str("0.8").unwrap(),
                liquidation_price: Some(Decimal::from(1000)),
                calculated_at: Utc::now(),
            };
            
            monitor.add_position(position).await;
            monitor.update_health_factor(health_factor).await;
        }
        
        let position_ids: Vec<PositionId> = (1..=5).collect();
        let alerts = monitor.batch_health_check(&position_ids).await.unwrap();
        
        assert_eq!(alerts.len(), 5);
        
        // First position should be healthy (no alert)
        assert!(alerts[0].is_none());
        
        // Later positions should have alerts due to lower health factors
        let alerts_generated = alerts.iter().filter(|a| a.is_some()).count();
        assert!(alerts_generated > 0);
    }
    
    #[tokio::test]
    async fn test_alert_acknowledgment_and_resolution() {
        let config = MonitoringConfig::default();
        let monitor = MockLiquidationMonitor::new(config);
        
        let position = Position {
            id: 5,
            user_id: 105,
            token_address: "0x1111".to_string(),
            collateral_amount: Decimal::from(50),
            debt_amount: Decimal::from(70000),
            collateral_token: "ETH".to_string(),
            debt_token: "USDC".to_string(),
            protocol: "Aave".to_string(),
            created_at: Utc::now(),
            last_updated: Utc::now(),
        };
        
        let health_factor = HealthFactor {
            position_id: 5,
            health_factor: Decimal::from_str("1.14").unwrap(),
            collateral_value: Decimal::from(100000),
            debt_value: Decimal::from(70000),
            liquidation_threshold: Decimal::from_str("0.8").unwrap(),
            liquidation_price: Some(Decimal::from(1750)),
            calculated_at: Utc::now(),
        };
        
        monitor.add_position(position).await;
        monitor.update_health_factor(health_factor).await;
        
        // Generate alert
        let alert = monitor.check_position_health(5).await.unwrap().unwrap();
        let alert_id = alert.id.clone();
        
        // Initially not acknowledged or resolved
        assert!(!alert.acknowledged);
        assert!(!alert.resolved);
        
        // Acknowledge alert
        monitor.acknowledge_alert(&alert_id).await.unwrap();
        
        // Resolve alert
        monitor.resolve_alert(&alert_id).await.unwrap();
        
        // Check that active alerts count is updated
        let active_alerts = monitor.get_active_alerts().await;
        assert!(active_alerts.is_empty());
    }
    
    #[tokio::test]
    async fn test_check_all_positions() {
        let config = MonitoringConfig::default();
        let monitor = MockLiquidationMonitor::new(config);
        
        // Add positions with mixed health levels
        let positions_data = vec![
            (1, 101, Decimal::from_str("2.5").unwrap()), // Healthy
            (2, 102, Decimal::from_str("1.3").unwrap()), // Warning
            (3, 103, Decimal::from_str("1.05").unwrap()), // Critical
            (4, 104, Decimal::from_str("0.9").unwrap()), // Emergency
        ];
        
        for (id, user_id, health_factor_value) in positions_data {
            let position = Position {
                id,
                user_id,
                token_address: format!("0x{:04x}", id),
                collateral_amount: Decimal::from(100),
                debt_amount: Decimal::from(50000),
                collateral_token: "ETH".to_string(),
                debt_token: "USDC".to_string(),
                protocol: "Aave".to_string(),
                created_at: Utc::now(),
                last_updated: Utc::now(),
            };
            
            let health_factor = HealthFactor {
                position_id: id,
                health_factor: health_factor_value,
                collateral_value: Decimal::from(200000),
                debt_value: Decimal::from(50000),
                liquidation_threshold: Decimal::from_str("0.8").unwrap(),
                liquidation_price: Some(Decimal::from(781)),
                calculated_at: Utc::now(),
            };
            
            monitor.add_position(position).await;
            monitor.update_health_factor(health_factor).await;
        }
        
        let all_alerts = monitor.check_all_positions().await.unwrap();
        
        // Should generate 3 alerts (warning, critical, emergency - but not for healthy position)
        assert_eq!(all_alerts.len(), 3);
        
        // Check alert levels
        let alert_levels: Vec<AlertLevel> = all_alerts.iter().map(|a| a.alert_level.clone()).collect();
        assert!(alert_levels.contains(&AlertLevel::Warning));
        assert!(alert_levels.contains(&AlertLevel::Critical));
        assert!(alert_levels.contains(&AlertLevel::Emergency));
    }
    
    #[tokio::test]
    async fn test_monitoring_metrics() {
        let config = MonitoringConfig::default();
        let monitor = MockLiquidationMonitor::new(config);
        
        // Add multiple positions
        for i in 1..=10 {
            let position = Position {
                id: i,
                user_id: 100 + i,
                token_address: format!("0x{:04x}", i),
                collateral_amount: Decimal::from(100),
                debt_amount: Decimal::from(40000 + (i * 5000)),
                collateral_token: "ETH".to_string(),
                debt_token: "USDC".to_string(),
                protocol: "Aave".to_string(),
                created_at: Utc::now(),
                last_updated: Utc::now(),
            };
            
            // Health factors decrease as debt increases
            let health_factor_value = 3.0 - (i as f64 * 0.2);
            let health_factor = HealthFactor {
                position_id: i,
                health_factor: Decimal::from_str(&format!("{:.2}", health_factor_value)).unwrap(),
                collateral_value: Decimal::from(200000),
                debt_value: Decimal::from(40000 + (i * 5000)),
                liquidation_threshold: Decimal::from_str("0.8").unwrap(),
                liquidation_price: Some(Decimal::from(1000)),
                calculated_at: Utc::now(),
            };
            
            monitor.add_position(position).await;
            monitor.update_health_factor(health_factor).await;
        }
        
        // Generate some alerts
        monitor.check_all_positions().await.unwrap();
        
        let metrics = monitor.get_metrics().await;
        
        assert_eq!(metrics.total_positions_monitored, 10);
        assert!(metrics.positions_at_risk > 0);
        assert!(metrics.avg_health_factor > Decimal::ZERO);
        assert!(metrics.last_update <= Utc::now());
    }
    
    #[tokio::test]
    async fn test_position_not_found_error() {
        let config = MonitoringConfig::default();
        let monitor = MockLiquidationMonitor::new(config);
        
        let result = monitor.check_position_health(999).await;
        
        assert!(result.is_err());
        assert!(matches!(result.unwrap_err(), MonitoringError::PositionNotFound(999)));
    }
    
    #[tokio::test]
    async fn test_health_calculation_missing_error() {
        let config = MonitoringConfig::default();
        let monitor = MockLiquidationMonitor::new(config);
        
        let position = Position {
            id: 1,
            user_id: 100,
            token_address: "0x1234".to_string(),
            collateral_amount: Decimal::from(100),
            debt_amount: Decimal::from(50000),
            collateral_token: "ETH".to_string(),
            debt_token: "USDC".to_string(),
            protocol: "Aave".to_string(),
            created_at: Utc::now(),
            last_updated: Utc::now(),
        };
        
        monitor.add_position(position).await;
        // Don't add health factor - this should cause an error
        
        let result = monitor.check_position_health(1).await;
        
        assert!(result.is_err());
        assert!(matches!(result.unwrap_err(), MonitoringError::HealthCalculationFailed(_)));
    }
    
    #[tokio::test]
    async fn test_performance_batch_monitoring() {
        let config = MonitoringConfig::default();
        let monitor = MockLiquidationMonitor::new(config);
        
        // Add 1000 positions for performance testing
        for i in 1..=1000 {
            let position = Position {
                id: i,
                user_id: 100 + i,
                token_address: format!("0x{:04x}", i),
                collateral_amount: Decimal::from(100),
                debt_amount: Decimal::from(50000),
                collateral_token: "ETH".to_string(),
                debt_token: "USDC".to_string(),
                protocol: "Aave".to_string(),
                created_at: Utc::now(),
                last_updated: Utc::now(),
            };
            
            let health_factor = HealthFactor {
                position_id: i,
                health_factor: Decimal::from_str("2.0").unwrap(),
                collateral_value: Decimal::from(200000),
                debt_value: Decimal::from(50000),
                liquidation_threshold: Decimal::from_str("0.8").unwrap(),
                liquidation_price: Some(Decimal::from(781)),
                calculated_at: Utc::now(),
            };
            
            monitor.add_position(position).await;
            monitor.update_health_factor(health_factor).await;
        }
        
        let start_time = std::time::Instant::now();
        
        let position_ids: Vec<PositionId> = (1..=1000).collect();
        let alerts = monitor.batch_health_check(&position_ids).await.unwrap();
        
        let duration = start_time.elapsed();
        
        // Should complete batch monitoring in under 1 second for 1000 positions
        assert!(duration.as_millis() < 1000, "Batch monitoring took {}ms, should be <1000ms", duration.as_millis());
        
        assert_eq!(alerts.len(), 1000);
    }
}