use crate::types::{
    PositionId, Position, HealthFactor, RiskParameters, RiskAlert, RiskLevel, 
    AlertType, PriceData, TokenAddress, PositionError, CalculationError,
    HealthCalculator
};
use crate::liquidation::health_calculators::HealthCalculatorFactory;
use dashmap::DashMap;
use std::collections::HashMap;
use std::sync::Arc;
use std::time::Instant;
use tokio::sync::RwLock;
use uuid::Uuid;
use chrono::Utc;
use tracing::{info, warn, error, debug};

pub struct LiquidationMonitor {
    positions: DashMap<PositionId, Position>,
    price_feeds: Arc<dyn PriceFeedProvider>,
    risk_parameters: Arc<RwLock<RiskParameters>>,
    alert_system: Arc<dyn AlertSystem>,
    health_calculators: HashMap<String, Box<dyn HealthCalculator>>,
}

impl LiquidationMonitor {
    pub fn new(
        price_feeds: Arc<dyn PriceFeedProvider>,
        alert_system: Arc<dyn AlertSystem>,
    ) -> Self {
        let mut health_calculators: HashMap<String, Box<dyn HealthCalculator>> = HashMap::new();
        
        for protocol in HealthCalculatorFactory::supported_protocols() {
            if let Some(calculator) = HealthCalculatorFactory::create_calculator(protocol) {
                health_calculators.insert(protocol.to_string(), calculator);
            }
        }

        Self {
            positions: DashMap::new(),
            price_feeds,
            risk_parameters: Arc::new(RwLock::new(RiskParameters::default())),
            alert_system,
            health_calculators,
        }
    }

    pub async fn add_position(&self, position: Position) -> Result<PositionId, PositionError> {
        let position_id = position.id;
        
        if self.positions.contains_key(&position_id) {
            return Err(PositionError::AlreadyExists { id: position_id });
        }

        info!("Adding position {} for protocol {}", position_id, position.protocol);
        self.positions.insert(position_id, position);
        
        // Immediately check health after adding
        if let Err(e) = self.check_position_health(position_id).await {
            warn!("Failed to check health for newly added position {}: {}", position_id, e);
        }

        Ok(position_id)
    }

    pub async fn update_position(&self, position: Position) -> Result<(), PositionError> {
        let position_id = position.id;
        
        if !self.positions.contains_key(&position_id) {
            return Err(PositionError::NotFound { id: position_id });
        }

        info!("Updating position {} for protocol {}", position_id, position.protocol);
        self.positions.insert(position_id, position);
        
        // Check health after update
        if let Err(e) = self.check_position_health(position_id).await {
            warn!("Failed to check health for updated position {}: {}", position_id, e);
        }

        Ok(())
    }

    pub fn remove_position(&self, position_id: PositionId) -> Result<Position, PositionError> {
        self.positions.remove(&position_id)
            .map(|(_, position)| {
                info!("Removed position {}", position_id);
                position
            })
            .ok_or(PositionError::NotFound { id: position_id })
    }

    pub async fn calculate_health(&self, position_id: PositionId) -> Result<HealthFactor, CalculationError> {
        let start_time = Instant::now();
        
        let position = self.positions.get(&position_id)
            .ok_or(CalculationError::CalculationFailed { 
                message: format!("Position {} not found", position_id) 
            })?;

        let calculator = self.health_calculators.get(&position.protocol)
            .ok_or(CalculationError::UnsupportedProtocol { 
                protocol: position.protocol.clone() 
            })?;

        // Get required token addresses
        let mut required_tokens: Vec<TokenAddress> = Vec::new();
        required_tokens.extend(position.collateral_tokens.keys().cloned());
        required_tokens.extend(position.debt_tokens.keys().cloned());

        // Fetch price data
        let prices = self.price_feeds.get_prices(&required_tokens).await
            .map_err(|e| CalculationError::CalculationFailed { 
                message: format!("Failed to fetch prices: {}", e) 
            })?;

        let health_factor = calculator.calculate_health(&position, &prices)?;
        
        let calculation_time = start_time.elapsed();
        debug!("Health calculation for {} took {:?}", position_id, calculation_time);
        
        // Log warning if calculation takes too long (requirement: <100ms)
        if calculation_time.as_millis() > 100 {
            warn!("Health calculation for {} took {}ms (exceeds 100ms requirement)", 
                  position_id, calculation_time.as_millis());
        }

        Ok(health_factor)
    }

    pub async fn monitor_positions(&self) -> Vec<RiskAlert> {
        let mut alerts = Vec::new();
        let risk_params = self.risk_parameters.read().await;

        for position_ref in self.positions.iter() {
            let position_id = *position_ref.key();
            
            match self.calculate_health(position_id).await {
                Ok(health_factor) => {
                    if health_factor.is_at_risk(&risk_params) {
                        let risk_level = health_factor.risk_level(&risk_params);
                        let alert = self.create_liquidation_alert(
                            position_id,
                            &health_factor,
                            risk_level,
                        );
                        alerts.push(alert);
                    }
                }
                Err(e) => {
                    error!("Failed to calculate health for position {}: {}", position_id, e);
                    // Create an error alert
                    let alert = RiskAlert {
                        id: Uuid::new_v4(),
                        position_id,
                        alert_type: AlertType::LiquidationRisk,
                        risk_level: RiskLevel::Critical,
                        health_factor: HealthFactor {
                            value: rust_decimal::Decimal::ZERO,
                            liquidation_threshold: rust_decimal::Decimal::ZERO,
                            collateral_value: rust_decimal::Decimal::ZERO,
                            debt_value: rust_decimal::Decimal::ZERO,
                            calculated_at: Utc::now(),
                        },
                        message: format!("Health calculation failed: {}", e),
                        created_at: Utc::now(),
                        acknowledged: false,
                    };
                    alerts.push(alert);
                }
            }
        }

        // Send alerts through alert system
        for alert in &alerts {
            if let Err(e) = self.alert_system.send_alert(alert.clone()).await {
                error!("Failed to send alert {}: {}", alert.id, e);
            }
        }

        alerts
    }

    async fn check_position_health(&self, position_id: PositionId) -> Result<(), CalculationError> {
        let health_factor = self.calculate_health(position_id).await?;
        let risk_params = self.risk_parameters.read().await;
        
        if health_factor.is_at_risk(&risk_params) {
            let risk_level = health_factor.risk_level(&risk_params);
            let alert = self.create_liquidation_alert(position_id, &health_factor, risk_level);
            
            if let Err(e) = self.alert_system.send_alert(alert).await {
                error!("Failed to send immediate alert for position {}: {}", position_id, e);
            }
        }

        Ok(())
    }

    fn create_liquidation_alert(
        &self,
        position_id: PositionId,
        health_factor: &HealthFactor,
        risk_level: RiskLevel,
    ) -> RiskAlert {
        let message = match risk_level {
            RiskLevel::Emergency => format!(
                "EMERGENCY: Position {} is at immediate liquidation risk! Health factor: {:.4}",
                position_id, health_factor.value
            ),
            RiskLevel::Critical => format!(
                "CRITICAL: Position {} approaching liquidation. Health factor: {:.4}",
                position_id, health_factor.value
            ),
            RiskLevel::Warning => format!(
                "WARNING: Position {} health declining. Health factor: {:.4}",
                position_id, health_factor.value
            ),
            RiskLevel::Safe => format!(
                "Position {} is healthy. Health factor: {:.4}",
                position_id, health_factor.value
            ),
        };

        RiskAlert {
            id: Uuid::new_v4(),
            position_id,
            alert_type: AlertType::LiquidationRisk,
            risk_level,
            health_factor: health_factor.clone(),
            message,
            created_at: Utc::now(),
            acknowledged: false,
        }
    }

    pub async fn update_risk_parameters(&self, new_params: RiskParameters) {
        let mut params = self.risk_parameters.write().await;
        *params = new_params;
        info!("Updated risk parameters");
    }

    pub async fn get_risk_parameters(&self) -> RiskParameters {
        self.risk_parameters.read().await.clone()
    }

    pub fn get_position(&self, position_id: PositionId) -> Option<Position> {
        self.positions.get(&position_id).map(|p| p.clone())
    }

    pub fn list_positions(&self) -> Vec<Position> {
        self.positions.iter().map(|p| p.value().clone()).collect()
    }

    pub fn position_count(&self) -> usize {
        self.positions.len()
    }
}

#[async_trait::async_trait]
pub trait PriceFeedProvider: Send + Sync {
    async fn get_prices(&self, token_addresses: &[TokenAddress]) -> Result<HashMap<TokenAddress, PriceData>, Box<dyn std::error::Error + Send + Sync>>;
    async fn get_price(&self, token_address: &TokenAddress) -> Result<PriceData, Box<dyn std::error::Error + Send + Sync>>;
}

#[async_trait::async_trait]
pub trait AlertSystem: Send + Sync {
    async fn send_alert(&self, alert: RiskAlert) -> Result<(), Box<dyn std::error::Error + Send + Sync>>;
    async fn get_alerts(&self, position_id: Option<PositionId>) -> Result<Vec<RiskAlert>, Box<dyn std::error::Error + Send + Sync>>;
    async fn acknowledge_alert(&self, alert_id: Uuid) -> Result<(), Box<dyn std::error::Error + Send + Sync>>;
}