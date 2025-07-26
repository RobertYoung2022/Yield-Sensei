use crate::types::{
    HealthCalculator, HealthFactor, Position, PriceData, TokenAddress, CalculationError
};
use async_trait::async_trait;
use rust_decimal::Decimal;
use std::collections::HashMap;
use chrono::Utc;

pub struct AaveHealthCalculator {
    liquidation_threshold: Decimal,
}

impl AaveHealthCalculator {
    pub fn new() -> Self {
        Self {
            liquidation_threshold: Decimal::from(80) / Decimal::from(100), // 80%
        }
    }
}

impl HealthCalculator for AaveHealthCalculator {
    fn calculate_health(&self, position: &Position, prices: &HashMap<TokenAddress, PriceData>) -> Result<HealthFactor, CalculationError> {
        let mut total_collateral_value = Decimal::ZERO;
        let mut weighted_collateral_value = Decimal::ZERO;
        let mut total_debt_value = Decimal::ZERO;

        // Calculate weighted collateral value
        for (token_address, token_position) in &position.collateral_tokens {
            let price_data = prices.get(token_address)
                .ok_or_else(|| CalculationError::MissingPriceData { 
                    token: token_address.clone() 
                })?;
            
            let token_value = token_position.amount * price_data.price_usd;
            total_collateral_value += token_value;
            
            // Apply liquidation threshold weight (different for each token in Aave)
            let liquidation_threshold = self.get_token_liquidation_threshold(token_address);
            weighted_collateral_value += token_value * liquidation_threshold;
        }

        // Calculate total debt value
        for (token_address, token_position) in &position.debt_tokens {
            let price_data = prices.get(token_address)
                .ok_or_else(|| CalculationError::MissingPriceData { 
                    token: token_address.clone() 
                })?;
            
            total_debt_value += token_position.amount * price_data.price_usd;
        }

        // Aave health factor = weighted collateral / total debt
        let health_factor_value = if total_debt_value > Decimal::ZERO {
            weighted_collateral_value / total_debt_value
        } else {
            Decimal::MAX // No debt means infinite health factor
        };

        Ok(HealthFactor {
            value: health_factor_value,
            liquidation_threshold: self.liquidation_threshold,
            collateral_value: total_collateral_value,
            debt_value: total_debt_value,
            calculated_at: Utc::now(),
        })
    }

    fn protocol(&self) -> &str {
        "aave"
    }
}

impl AaveHealthCalculator {
    fn get_token_liquidation_threshold(&self, _token_address: &str) -> Decimal {
        // In a real implementation, this would fetch token-specific thresholds
        // For now, using default threshold
        self.liquidation_threshold
    }
}

pub struct CompoundHealthCalculator {
    liquidation_incentive: Decimal,
}

impl CompoundHealthCalculator {
    pub fn new() -> Self {
        Self {
            liquidation_incentive: Decimal::from(108) / Decimal::from(100), // 8% incentive
        }
    }
}

impl HealthCalculator for CompoundHealthCalculator {
    fn calculate_health(&self, position: &Position, prices: &HashMap<TokenAddress, PriceData>) -> Result<HealthFactor, CalculationError> {
        let mut total_collateral_value = Decimal::ZERO;
        let mut total_borrow_limit = Decimal::ZERO;
        let mut total_debt_value = Decimal::ZERO;

        // Calculate collateral and borrow limit
        for (token_address, token_position) in &position.collateral_tokens {
            let price_data = prices.get(token_address)
                .ok_or_else(|| CalculationError::MissingPriceData { 
                    token: token_address.clone() 
                })?;
            
            let token_value = token_position.amount * price_data.price_usd;
            total_collateral_value += token_value;
            
            // Apply collateral factor (different for each cToken in Compound)
            let collateral_factor = self.get_token_collateral_factor(token_address);
            total_borrow_limit += token_value * collateral_factor;
        }

        // Calculate total debt value
        for (token_address, token_position) in &position.debt_tokens {
            let price_data = prices.get(token_address)
                .ok_or_else(|| CalculationError::MissingPriceData { 
                    token: token_address.clone() 
                })?;
            
            total_debt_value += token_position.amount * price_data.price_usd;
        }

        // Compound health factor = borrow limit / total debt
        let health_factor_value = if total_debt_value > Decimal::ZERO {
            total_borrow_limit / total_debt_value
        } else {
            Decimal::MAX
        };

        Ok(HealthFactor {
            value: health_factor_value,
            liquidation_threshold: Decimal::ONE / self.liquidation_incentive, // ~92.6%
            collateral_value: total_collateral_value,
            debt_value: total_debt_value,
            calculated_at: Utc::now(),
        })
    }

    fn protocol(&self) -> &str {
        "compound"
    }
}

impl CompoundHealthCalculator {
    fn get_token_collateral_factor(&self, _token_address: &str) -> Decimal {
        // In a real implementation, this would fetch token-specific collateral factors
        // For now, using default factor of 75%
        Decimal::from(75) / Decimal::from(100)
    }
}

pub struct MakerDaoHealthCalculator {
    liquidation_ratio: Decimal,
}

impl MakerDaoHealthCalculator {
    pub fn new() -> Self {
        Self {
            liquidation_ratio: Decimal::from(150) / Decimal::from(100), // 150%
        }
    }
}

impl HealthCalculator for MakerDaoHealthCalculator {
    fn calculate_health(&self, position: &Position, prices: &HashMap<TokenAddress, PriceData>) -> Result<HealthFactor, CalculationError> {
        let mut total_collateral_value = Decimal::ZERO;
        let mut total_debt_value = Decimal::ZERO;

        // Calculate collateral value
        for (token_address, token_position) in &position.collateral_tokens {
            let price_data = prices.get(token_address)
                .ok_or_else(|| CalculationError::MissingPriceData { 
                    token: token_address.clone() 
                })?;
            
            total_collateral_value += token_position.amount * price_data.price_usd;
        }

        // Calculate debt value (DAI in most cases)
        for (token_address, token_position) in &position.debt_tokens {
            let price_data = prices.get(token_address)
                .ok_or_else(|| CalculationError::MissingPriceData { 
                    token: token_address.clone() 
                })?;
            
            total_debt_value += token_position.amount * price_data.price_usd;
        }

        // MakerDAO health factor = (collateral value / debt value) / liquidation ratio
        let collateralization_ratio = if total_debt_value > Decimal::ZERO {
            total_collateral_value / total_debt_value
        } else {
            Decimal::MAX
        };

        let health_factor_value = collateralization_ratio / self.liquidation_ratio;

        Ok(HealthFactor {
            value: health_factor_value,
            liquidation_threshold: Decimal::ONE / self.liquidation_ratio, // ~66.7%
            collateral_value: total_collateral_value,
            debt_value: total_debt_value,
            calculated_at: Utc::now(),
        })
    }

    fn protocol(&self) -> &str {
        "makerdao"
    }
}

pub struct HealthCalculatorFactory;

impl HealthCalculatorFactory {
    pub fn create_calculator(protocol: &str) -> Option<Box<dyn HealthCalculator>> {
        match protocol.to_lowercase().as_str() {
            "aave" => Some(Box::new(AaveHealthCalculator::new())),
            "compound" => Some(Box::new(CompoundHealthCalculator::new())),
            "makerdao" | "maker" => Some(Box::new(MakerDaoHealthCalculator::new())),
            _ => None,
        }
    }

    pub fn supported_protocols() -> Vec<&'static str> {
        vec!["aave", "compound", "makerdao"]
    }
}