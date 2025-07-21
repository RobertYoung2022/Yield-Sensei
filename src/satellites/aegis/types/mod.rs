use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use uuid::Uuid;
use chrono::{DateTime, Utc};

pub type PositionId = Uuid;
pub type ProtocolId = String;
pub type TokenAddress = String;
pub type AssetPrice = Decimal;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Position {
    pub id: PositionId,
    pub protocol: ProtocolId,
    pub collateral_tokens: HashMap<TokenAddress, PositionToken>,
    pub debt_tokens: HashMap<TokenAddress, PositionToken>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PositionToken {
    pub token_address: TokenAddress,
    pub amount: Decimal,
    pub value_usd: Decimal,
    pub price_per_token: Decimal,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HealthFactor {
    pub value: Decimal,
    pub liquidation_threshold: Decimal,
    pub collateral_value: Decimal,
    pub debt_value: Decimal,
    pub calculated_at: DateTime<Utc>,
}

impl HealthFactor {
    pub fn is_at_risk(&self, risk_params: &RiskParameters) -> bool {
        self.value <= risk_params.critical_health_threshold
    }

    pub fn is_healthy(&self, risk_params: &RiskParameters) -> bool {
        self.value >= risk_params.safe_health_threshold
    }

    pub fn risk_level(&self, risk_params: &RiskParameters) -> RiskLevel {
        if self.value <= risk_params.critical_health_threshold {
            RiskLevel::Critical
        } else if self.value <= risk_params.warning_health_threshold {
            RiskLevel::Warning
        } else {
            RiskLevel::Safe
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RiskParameters {
    pub safe_health_threshold: Decimal,
    pub warning_health_threshold: Decimal,
    pub critical_health_threshold: Decimal,
    pub emergency_health_threshold: Decimal,
    pub max_position_size_usd: Decimal,
    pub max_protocol_exposure_percent: Decimal,
}

impl Default for RiskParameters {
    fn default() -> Self {
        Self {
            safe_health_threshold: Decimal::from(150) / Decimal::from(100), // 1.5
            warning_health_threshold: Decimal::from(130) / Decimal::from(100), // 1.3
            critical_health_threshold: Decimal::from(110) / Decimal::from(100), // 1.1
            emergency_health_threshold: Decimal::from(105) / Decimal::from(100), // 1.05
            max_position_size_usd: Decimal::from(1_000_000), // $1M
            max_protocol_exposure_percent: Decimal::from(25), // 25%
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum RiskLevel {
    Safe,
    Warning,
    Critical,
    Emergency,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RiskAlert {
    pub id: Uuid,
    pub position_id: PositionId,
    pub alert_type: AlertType,
    pub risk_level: RiskLevel,
    pub health_factor: HealthFactor,
    pub message: String,
    pub created_at: DateTime<Utc>,
    pub acknowledged: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AlertType {
    LiquidationRisk,
    PositionSizeExceeded,
    ProtocolExposureExceeded,
    PriceImpactHigh,
    ContractVulnerability,
    MevExposure,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Protocol {
    pub id: ProtocolId,
    pub name: String,
    pub liquidation_threshold: Decimal,
    pub loan_to_value_ratio: Decimal,
    pub supported_tokens: Vec<TokenAddress>,
    pub risk_score: Decimal, // 0-100
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PriceData {
    pub token_address: TokenAddress,
    pub price_usd: AssetPrice,
    pub timestamp: DateTime<Utc>,
    pub source: String,
    pub confidence: Decimal, // 0-1
}

pub trait HealthCalculator: Send + Sync {
    fn calculate_health(&self, position: &Position, prices: &HashMap<TokenAddress, PriceData>) -> Result<HealthFactor, CalculationError>;
    fn protocol(&self) -> &str;
}

#[derive(Debug, thiserror::Error)]
pub enum CalculationError {
    #[error("Missing price data for token: {token}")]
    MissingPriceData { token: TokenAddress },
    #[error("Invalid position data: {message}")]
    InvalidPosition { message: String },
    #[error("Protocol not supported: {protocol}")]
    UnsupportedProtocol { protocol: String },
    #[error("Calculation failed: {message}")]
    CalculationFailed { message: String },
}

#[derive(Debug, thiserror::Error)]
pub enum PositionError {
    #[error("Position not found: {id}")]
    NotFound { id: PositionId },
    #[error("Position already exists: {id}")]
    AlreadyExists { id: PositionId },
    #[error("Invalid position: {message}")]
    Invalid { message: String },
}