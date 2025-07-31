use tokio_test;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use rust_decimal::Decimal;
use chrono::{Utc, Duration};
use rand::Rng;

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
    pub struct MarketConditions {
        pub volatility_multiplier: f64,
        pub correlation_breakdown: bool,
        pub liquidity_crisis: bool,
        pub flash_crash_probability: f64,
        pub contagion_factor: f64,
        pub market_sentiment: MarketSentiment,
    }
    
    #[derive(Debug, Clone, PartialEq)]
    pub enum MarketSentiment {
        Bullish,
        Neutral,
        Bearish,
        Panic,
    }
    
    #[derive(Debug, Clone)]
    pub struct StressScenario {
        pub name: String,
        pub description: String,
        pub duration_days: u32,
        pub price_shocks: HashMap<TokenAddress, f64>, // Percentage change
        pub volume_shocks: HashMap<TokenAddress, f64>,
        pub market_conditions: MarketConditions,
        pub correlation_changes: HashMap<(TokenAddress, TokenAddress), f64>,
        pub liquidity_impacts: HashMap<TokenAddress, f64>,
    }
    
    #[derive(Debug, Clone)]
    pub struct SimulationResult {
        pub scenario_name: String,
        pub initial_portfolio_value: Decimal,
        pub final_portfolio_value: Decimal,
        pub max_drawdown: f64,
        pub liquidated_positions: Vec<PositionId>,
        pub surviving_positions: Vec<PositionId>,
        pub total_liquidation_losses: Decimal,
        pub time_to_first_liquidation: Option<chrono::Duration>,
        pub cascade_liquidations: u32,
        pub portfolio_recovery_time: Option<chrono::Duration>,
        pub risk_metrics: StressTestRiskMetrics,
        pub recommendations: Vec<String>,
    }
    
    #[derive(Debug, Clone)]
    pub struct StressTestRiskMetrics {
        pub var_95: Decimal,
        pub cvar_95: Decimal,
        pub maximum_loss: Decimal,
        pub survival_probability: f64,
        pub expected_shortfall: Decimal,
        pub tail_expectation: Decimal,
        pub concentration_risk: f64,
        pub correlation_risk: f64,
    }
    
    #[derive(Debug, thiserror::Error)]
    pub enum StressTestError {
        #[error("Invalid scenario configuration: {0}")]
        InvalidScenario(String),
        #[error("Simulation failed: {0}")]
        SimulationFailed(String),
        #[error("Position data invalid: {0}")]
        InvalidPositionData(String),
        #[error("Market data unavailable: {0}")]
        MarketDataUnavailable(String),
    }
    
    impl Default for MarketConditions {
        fn default() -> Self {
            Self {
                volatility_multiplier: 1.0,
                correlation_breakdown: false,
                liquidity_crisis: false,
                flash_crash_probability: 0.0,
                contagion_factor: 0.0,
                market_sentiment: MarketSentiment::Neutral,
            }
        }
    }
}

use aegis_types::*;

/// Mock stress testing framework for liquidation scenarios
pub struct MockStressTester {
    positions: Arc<RwLock<HashMap<PositionId, Position>>>,
    scenarios: Arc<RwLock<HashMap<String, StressScenario>>>,
    simulation_cache: Arc<RwLock<HashMap<String, SimulationResult>>>,
    market_data: Arc<RwLock<HashMap<TokenAddress, Decimal>>>, // Current prices
}

impl MockStressTester {
    fn new() -> Self {
        let mut tester = Self {
            positions: Arc::new(RwLock::new(HashMap::new())),
            scenarios: Arc::new(RwLock::new(HashMap::new())),
            simulation_cache: Arc::new(RwLock::new(HashMap::new())),
            market_data: Arc::new(RwLock::new(HashMap::new())),
        };
        
        // Initialize with standard stress scenarios
        tokio::task::block_in_place(|| {
            tokio::runtime::Handle::current().block_on(async {
                tester.initialize_standard_scenarios().await;
            })
        });
        
        tester
    }
    
    async fn initialize_standard_scenarios(&self) {
        let scenarios = vec![
            self.create_market_crash_scenario(),
            self.create_defi_contagion_scenario(),
            self.create_flash_crash_scenario(),
            self.create_crypto_winter_scenario(),
            self.create_correlation_breakdown_scenario(),
            self.create_liquidity_crisis_scenario(),
        ];
        
        let mut scenario_map = self.scenarios.write().await;
        for scenario in scenarios {
            scenario_map.insert(scenario.name.clone(), scenario);
        }
    }
    
    fn create_market_crash_scenario(&self) -> StressScenario {
        let mut price_shocks = HashMap::new();
        price_shocks.insert("ETH".to_string(), -0.40); // 40% drop
        price_shocks.insert("BTC".to_string(), -0.35); // 35% drop
        price_shocks.insert("USDC".to_string(), 0.02); // 2% depeg
        price_shocks.insert("DAI".to_string(), 0.03); // 3% depeg
        
        let mut volume_shocks = HashMap::new();
        volume_shocks.insert("ETH".to_string(), 3.0); // 3x volume increase
        volume_shocks.insert("BTC".to_string(), 2.5); // 2.5x volume increase
        
        StressScenario {
            name: "Market Crash".to_string(),
            description: "Major market crash similar to March 2020 or May 2022".to_string(),
            duration_days: 7,
            price_shocks,
            volume_shocks,
            market_conditions: MarketConditions {
                volatility_multiplier: 3.0,
                correlation_breakdown: false,
                liquidity_crisis: true,
                flash_crash_probability: 0.3,
                contagion_factor: 0.8,
                market_sentiment: MarketSentiment::Panic,
            },
            correlation_changes: HashMap::new(),
            liquidity_impacts: HashMap::new(),
        }
    }
    
    fn create_defi_contagion_scenario(&self) -> StressScenario {
        let mut price_shocks = HashMap::new();
        price_shocks.insert("ETH".to_string(), -0.25);
        price_shocks.insert("USDC".to_string(), -0.05); // 5% depeg
        price_shocks.insert("DAI".to_string(), -0.08); // 8% depeg
        price_shocks.insert("COMP".to_string(), -0.60); // DeFi tokens hit harder
        price_shocks.insert("AAVE".to_string(), -0.55);
        
        StressScenario {
            name: "DeFi Contagion".to_string(),
            description: "Contagion event spreading across DeFi protocols".to_string(),
            duration_days: 14,
            price_shocks,
            volume_shocks: HashMap::new(),
            market_conditions: MarketConditions {
                volatility_multiplier: 2.5,
                correlation_breakdown: true,
                liquidity_crisis: true,
                flash_crash_probability: 0.2,
                contagion_factor: 0.9,
                market_sentiment: MarketSentiment::Panic,
            },
            correlation_changes: HashMap::new(),
            liquidity_impacts: HashMap::new(),
        }
    }
    
    fn create_flash_crash_scenario(&self) -> StressScenario {
        let mut price_shocks = HashMap::new();
        price_shocks.insert("ETH".to_string(), -0.20); // Quick 20% drop
        price_shocks.insert("BTC".to_string(), -0.15); // Quick 15% drop
        
        StressScenario {
            name: "Flash Crash".to_string(),
            description: "Sudden price crash within minutes followed by partial recovery".to_string(),
            duration_days: 1,
            price_shocks,
            volume_shocks: HashMap::new(),
            market_conditions: MarketConditions {
                volatility_multiplier: 5.0,
                correlation_breakdown: false,
                liquidity_crisis: false,
                flash_crash_probability: 1.0,
                contagion_factor: 0.3,
                market_sentiment: MarketSentiment::Panic,
            },
            correlation_changes: HashMap::new(),
            liquidity_impacts: HashMap::new(),
        }
    }
    
    fn create_crypto_winter_scenario(&self) -> StressScenario {
        let mut price_shocks = HashMap::new();
        price_shocks.insert("ETH".to_string(), -0.70); // 70% drop over time
        price_shocks.insert("BTC".to_string(), -0.65); // 65% drop over time
        price_shocks.insert("COMP".to_string(), -0.85); // 85% drop
        price_shocks.insert("AAVE".to_string(), -0.80); // 80% drop
        
        StressScenario {
            name: "Crypto Winter".to_string(),
            description: "Extended bear market with gradual decline over months".to_string(),
            duration_days: 180,
            price_shocks,
            volume_shocks: HashMap::new(),
            market_conditions: MarketConditions {
                volatility_multiplier: 1.5,
                correlation_breakdown: false,
                liquidity_crisis: false,
                flash_crash_probability: 0.1,
                contagion_factor: 0.4,
                market_sentiment: MarketSentiment::Bearish,
            },
            correlation_changes: HashMap::new(),
            liquidity_impacts: HashMap::new(),
        }
    }
    
    fn create_correlation_breakdown_scenario(&self) -> StressScenario {
        StressScenario {
            name: "Correlation Breakdown".to_string(),
            description: "Normal correlations break down, assets move independently".to_string(),
            duration_days: 30,
            price_shocks: HashMap::new(),
            volume_shocks: HashMap::new(),
            market_conditions: MarketConditions {
                volatility_multiplier: 2.0,
                correlation_breakdown: true,
                liquidity_crisis: false,
                flash_crash_probability: 0.15,
                contagion_factor: 0.1,
                market_sentiment: MarketSentiment::Bearish,
            },
            correlation_changes: HashMap::new(),
            liquidity_impacts: HashMap::new(),
        }
    }
    
    fn create_liquidity_crisis_scenario(&self) -> StressScenario {
        let mut liquidity_impacts = HashMap::new();
        liquidity_impacts.insert("ETH".to_string(), 0.5); // 50% liquidity reduction
        liquidity_impacts.insert("BTC".to_string(), 0.3); // 30% liquidity reduction
        liquidity_impacts.insert("COMP".to_string(), 0.8); // 80% liquidity reduction
        
        StressScenario {
            name: "Liquidity Crisis".to_string(),
            description: "Severe liquidity drought across markets".to_string(),
            duration_days: 21,
            price_shocks: HashMap::new(),
            volume_shocks: HashMap::new(),
            market_conditions: MarketConditions {
                volatility_multiplier: 2.5,
                correlation_breakdown: false,
                liquidity_crisis: true,
                flash_crash_probability: 0.25,
                contagion_factor: 0.7,
                market_sentiment: MarketSentiment::Bearish,
            },
            correlation_changes: HashMap::new(),
            liquidity_impacts,
        }
    }
    
    async fn add_position(&self, position: Position) {
        let mut positions = self.positions.write().await;
        positions.insert(position.id, position);
    }
    
    async fn update_market_price(&self, token: &str, price: Decimal) {
        let mut market_data = self.market_data.write().await;
        market_data.insert(token.to_string(), price);
    }
    
    async fn run_stress_test(&self, scenario_name: &str) -> Result<SimulationResult, StressTestError> {
        let scenarios = self.scenarios.read().await;
        let scenario = scenarios.get(scenario_name)
            .ok_or_else(|| StressTestError::InvalidScenario(format!("Scenario not found: {}", scenario_name)))?;
        
        let positions = self.positions.read().await;
        let market_data = self.market_data.read().await;
        
        if positions.is_empty() {
            return Err(StressTestError::InvalidPositionData("No positions to test".to_string()));
        }
        
        drop(scenarios);
        drop(market_data);
        
        let result = self.simulate_scenario(scenario, &positions).await?;
        
        // Cache result
        let mut cache = self.simulation_cache.write().await;
        cache.insert(scenario_name.to_string(), result.clone());
        
        Ok(result)
    }
    
    async fn simulate_scenario(&self, scenario: &StressScenario, positions: &HashMap<PositionId, Position>) -> Result<SimulationResult, StressTestError> {
        let market_data = self.market_data.read().await;
        
        // Calculate initial portfolio value
        let mut initial_portfolio_value = Decimal::ZERO;
        for position in positions.values() {
            if let Some(collateral_price) = market_data.get(&position.collateral_token) {
                initial_portfolio_value += position.collateral_amount * collateral_price;
            }
        }
        
        drop(market_data);
        
        // Apply price shocks and simulate
        let mut simulated_positions = positions.clone();
        let mut liquidated_positions = Vec::new();
        let mut cascade_liquidations = 0;
        let mut time_to_first_liquidation = None;
        let mut max_drawdown = 0.0;
        let mut portfolio_values = Vec::new();
        
        // Simulate over time steps
        let time_steps = std::cmp::max(1, scenario.duration_days as usize);
        let start_time = Utc::now();
        
        for step in 0..time_steps {
            // Apply gradual price changes
            let progress = (step + 1) as f64 / time_steps as f64;
            
            // Update market prices based on scenario
            let mut current_market_data = self.market_data.read().await.clone();
            drop(self.market_data.read().await);
            
            for (token, shock) in &scenario.price_shocks {
                if let Some(current_price) = current_market_data.get_mut(token) {
                    let shock_amount = *shock * progress;
                    *current_price = *current_price * (Decimal::from_f64(1.0 + shock_amount).unwrap_or(Decimal::ONE));
                }
            }
            
            // Calculate current portfolio value and check for liquidations
            let mut current_portfolio_value = Decimal::ZERO;
            let mut positions_to_liquidate = Vec::new();
            
            for (position_id, position) in &simulated_positions {
                if liquidated_positions.contains(position_id) {
                    continue;
                }
                
                if let Some(collateral_price) = current_market_data.get(&position.collateral_token) {
                    let collateral_value = position.collateral_amount * collateral_price;
                    current_portfolio_value += collateral_value;
                    
                    // Check for liquidation
                    if let Some(debt_price) = current_market_data.get(&position.debt_token) {
                        let debt_value = position.debt_amount * debt_price;
                        let health_factor = if debt_value > Decimal::ZERO {
                            (collateral_value * Decimal::from_str("0.8").unwrap()) / debt_value
                        } else {
                            Decimal::MAX
                        };
                        
                        if health_factor < Decimal::ONE {
                            positions_to_liquidate.push(*position_id);
                            
                            if time_to_first_liquidation.is_none() {
                                time_to_first_liquidation = Some(Duration::hours(step as i64 * 24 / time_steps as i64));
                            }
                        }
                    }
                }
            }
            
            // Process liquidations
            for position_id in positions_to_liquidate {
                liquidated_positions.push(position_id);
                cascade_liquidations += 1;
            }
            
            portfolio_values.push(current_portfolio_value);
            
            // Calculate drawdown
            if let Some(peak_value) = portfolio_values.iter().max() {
                if *peak_value > Decimal::ZERO {
                    let current_drawdown = ((*peak_value - current_portfolio_value) / *peak_value).to_f64().unwrap_or(0.0);
                    max_drawdown = max_drawdown.max(current_drawdown);
                }
            }
        }
        
        let final_portfolio_value = portfolio_values.last().cloned().unwrap_or(Decimal::ZERO);
        let surviving_positions: Vec<PositionId> = simulated_positions.keys()
            .filter(|id| !liquidated_positions.contains(id))
            .cloned()
            .collect();
        
        // Calculate total liquidation losses (simplified)
        let total_liquidation_losses = initial_portfolio_value - final_portfolio_value;
        
        // Calculate risk metrics
        let risk_metrics = self.calculate_risk_metrics(&portfolio_values, initial_portfolio_value).await;
        
        // Generate recommendations
        let recommendations = self.generate_stress_test_recommendations(scenario, &liquidated_positions, max_drawdown).await;
        
        Ok(SimulationResult {
            scenario_name: scenario.name.clone(),
            initial_portfolio_value,
            final_portfolio_value,
            max_drawdown,
            liquidated_positions,
            surviving_positions,
            total_liquidation_losses,
            time_to_first_liquidation,
            cascade_liquidations,
            portfolio_recovery_time: None, // Would require more complex simulation
            risk_metrics,
            recommendations,
        })
    }
    
    async fn calculate_risk_metrics(&self, portfolio_values: &[Decimal], initial_value: Decimal) -> StressTestRiskMetrics {
        if portfolio_values.is_empty() || initial_value == Decimal::ZERO {
            return StressTestRiskMetrics {
                var_95: Decimal::ZERO,
                cvar_95: Decimal::ZERO,
                maximum_loss: Decimal::ZERO,
                survival_probability: 1.0,
                expected_shortfall: Decimal::ZERO,
                tail_expectation: Decimal::ZERO,
                concentration_risk: 0.0,
                correlation_risk: 0.0,
            };
        }
        
        // Calculate returns
        let mut returns = Vec::new();
        for i in 1..portfolio_values.len() {
            if portfolio_values[i-1] > Decimal::ZERO {
                let return_pct = (portfolio_values[i] - portfolio_values[i-1]) / portfolio_values[i-1];
                returns.push(return_pct);
            }
        }
        
        if returns.is_empty() {
            returns.push(Decimal::ZERO);
        }
        
        // Sort returns for VaR calculation
        let mut sorted_returns = returns.clone();
        sorted_returns.sort();
        
        // Calculate VaR (95th percentile)
        let var_index = (sorted_returns.len() as f64 * 0.05) as usize;
        let var_95 = if var_index < sorted_returns.len() {
            sorted_returns[var_index].abs()
        } else {
            Decimal::ZERO
        };
        
        // Calculate CVaR (expected value of losses beyond VaR)
        let cvar_losses: Vec<Decimal> = sorted_returns.iter()
            .take(var_index + 1)
            .map(|r| r.abs())
            .collect();
        
        let cvar_95 = if !cvar_losses.is_empty() {
            cvar_losses.iter().sum::<Decimal>() / Decimal::from(cvar_losses.len())
        } else {
            Decimal::ZERO
        };
        
        // Maximum loss
        let maximum_loss = sorted_returns.iter().map(|r| r.abs()).max().unwrap_or(Decimal::ZERO);
        
        // Survival probability (simplified)
        let final_value = portfolio_values.last().unwrap();
        let survival_probability = if *final_value > initial_value * Decimal::from_str("0.1").unwrap() {
            0.9
        } else if *final_value > Decimal::ZERO {
            0.5
        } else {
            0.0
        };
        
        StressTestRiskMetrics {
            var_95,
            cvar_95,
            maximum_loss,
            survival_probability,
            expected_shortfall: cvar_95,
            tail_expectation: maximum_loss,
            concentration_risk: 0.6, // Simplified calculation
            correlation_risk: 0.4,   // Simplified calculation
        }
    }
    
    async fn generate_stress_test_recommendations(&self, scenario: &StressScenario, liquidated_positions: &[PositionId], max_drawdown: f64) -> Vec<String> {
        let mut recommendations = Vec::new();
        
        if !liquidated_positions.is_empty() {
            recommendations.push(format!("CRITICAL: {} positions were liquidated in {} scenario", 
                liquidated_positions.len(), scenario.name));
            recommendations.push("Consider reducing leverage across all positions".to_string());
            recommendations.push("Implement stricter health factor thresholds".to_string());
        }
        
        if max_drawdown > 0.5 {
            recommendations.push("Severe drawdown detected - consider position size limits".to_string());
            recommendations.push("Implement dynamic hedging strategies".to_string());
        } else if max_drawdown > 0.2 {
            recommendations.push("Moderate drawdown - review risk management parameters".to_string());
        }
        
        match scenario.market_conditions.market_sentiment {
            MarketSentiment::Panic => {
                recommendations.push("Prepare for panic selling - increase cash reserves".to_string());
                recommendations.push("Monitor correlation breakdowns closely".to_string());
            },
            MarketSentiment::Bearish => {
                recommendations.push("Bearish conditions - consider defensive positioning".to_string());
            },
            _ => {}
        }
        
        if scenario.market_conditions.liquidity_crisis {
            recommendations.push("Liquidity crisis scenario - ensure access to emergency funding".to_string());
            recommendations.push("Avoid concentrated positions in illiquid assets".to_string());
        }
        
        if scenario.market_conditions.correlation_breakdown {
            recommendations.push("Correlation breakdown detected - review diversification strategy".to_string());
        }
        
        recommendations
    }
    
    async fn get_scenario_names(&self) -> Vec<String> {
        let scenarios = self.scenarios.read().await;
        scenarios.keys().cloned().collect()
    }
    
    async fn get_cached_result(&self, scenario_name: &str) -> Option<SimulationResult> {
        let cache = self.simulation_cache.read().await;
        cache.get(scenario_name).cloned()
    }
    
    async fn clear_cache(&self) {
        let mut cache = self.simulation_cache.write().await;
        cache.clear();
    }
    
    async fn add_custom_scenario(&self, scenario: StressScenario) {
        let mut scenarios = self.scenarios.write().await;
        scenarios.insert(scenario.name.clone(), scenario);
    }
}

#[cfg(test)]
mod stress_scenarios_tests {
    use super::*;
    use tokio_test;
    
    #[tokio::test]
    async fn test_stress_tester_creation() {
        let tester = MockStressTester::new();
        
        let scenario_names = tester.get_scenario_names().await;
        assert!(scenario_names.len() >= 6); // Should have at least 6 standard scenarios
        assert!(scenario_names.contains(&"Market Crash".to_string()));
        assert!(scenario_names.contains(&"DeFi Contagion".to_string()));
        assert!(scenario_names.contains(&"Flash Crash".to_string()));
    }
    
    #[tokio::test]
    async fn test_market_crash_scenario() {
        let tester = MockStressTester::new();
        
        // Add test positions
        let position1 = Position {
            id: 1,
            user_id: 100,
            token_address: "0x1234".to_string(),
            collateral_amount: Decimal::from(100), // 100 ETH
            debt_amount: Decimal::from(120000), // 120,000 USDC (high leverage)
            collateral_token: "ETH".to_string(),
            debt_token: "USDC".to_string(),
            protocol: "Aave".to_string(),
            created_at: Utc::now(),
            last_updated: Utc::now(),
        };
        
        let position2 = Position {
            id: 2,
            user_id: 101,
            token_address: "0x5678".to_string(),
            collateral_amount: Decimal::from(50), // 50 ETH
            debt_amount: Decimal::from(40000), // 40,000 USDC (safer leverage)
            collateral_token: "ETH".to_string(),
            debt_token: "USDC".to_string(),
            protocol: "Compound".to_string(),
            created_at: Utc::now(),
            last_updated: Utc::now(),
        };
        
        tester.add_position(position1).await;
        tester.add_position(position2).await;
        
        // Set initial market prices
        tester.update_market_price("ETH", Decimal::from(2000)).await;
        tester.update_market_price("USDC", Decimal::from(1)).await;
        
        // Run market crash scenario
        let result = tester.run_stress_test("Market Crash").await.unwrap();
        
        assert_eq!(result.scenario_name, "Market Crash");
        assert!(result.final_portfolio_value < result.initial_portfolio_value);
        assert!(result.max_drawdown > 0.0);
        assert!(!result.liquidated_positions.is_empty()); // High leverage position should be liquidated
        assert!(!result.recommendations.is_empty());
        
        // The highly leveraged position (position 1) should be liquidated
        assert!(result.liquidated_positions.contains(&1));
        
        // Risk metrics should show high risk
        assert!(result.risk_metrics.var_95 > Decimal::ZERO);
        assert!(result.risk_metrics.survival_probability < 1.0);
    }
    
    #[tokio::test]
    async fn test_flash_crash_scenario() {
        let tester = MockStressTester::new();
        
        // Add a moderately leveraged position
        let position = Position {
            id: 1,
            user_id: 100,
            token_address: "0x1234".to_string(),
            collateral_amount: Decimal::from(100),
            debt_amount: Decimal::from(80000), // Moderate leverage
            collateral_token: "ETH".to_string(),
            debt_token: "USDC".to_string(),
            protocol: "Aave".to_string(),
            created_at: Utc::now(),
            last_updated: Utc::now(),
        };
        
        tester.add_position(position).await;
        tester.update_market_price("ETH", Decimal::from(2000)).await;
        tester.update_market_price("USDC", Decimal::from(1)).await;
        
        let result = tester.run_stress_test("Flash Crash").await.unwrap();
        
        assert_eq!(result.scenario_name, "Flash Crash");
        assert!(result.max_drawdown > 0.15); // Should see significant drawdown
        
        // Flash crash is quick, so time to first liquidation should be short if any
        if let Some(time_to_liquidation) = result.time_to_first_liquidation {
            assert!(time_to_liquidation.num_hours() <= 24);
        }
    }
    
    #[tokio::test]
    async fn test_defi_contagion_scenario() {
        let tester = MockStressTester::new();
        
        // Add positions in DeFi tokens
        let position1 = Position {
            id: 1,
            user_id: 100,
            token_address: "0x1234".to_string(),
            collateral_amount: Decimal::from(1000), // 1000 COMP
            debt_amount: Decimal::from(80000),
            collateral_token: "COMP".to_string(),
            debt_token: "USDC".to_string(),
            protocol: "Compound".to_string(),
            created_at: Utc::now(),
            last_updated: Utc::now(),
        };
        
        let position2 = Position {
            id: 2,
            user_id: 101,
            token_address: "0x5678".to_string(),
            collateral_amount: Decimal::from(500), // 500 AAVE
            debt_amount: Decimal::from(40000),
            collateral_token: "AAVE".to_string(),
            debt_token: "USDC".to_string(),
            protocol: "Aave".to_string(),
            created_at: Utc::now(),
            last_updated: Utc::now(),
        };
        
        tester.add_position(position1).await;
        tester.add_position(position2).await;
        
        // Set initial prices for DeFi tokens
        tester.update_market_price("COMP", Decimal::from(100)).await;
        tester.update_market_price("AAVE", Decimal::from(200)).await;
        tester.update_market_price("USDC", Decimal::from(1)).await;
        
        let result = tester.run_stress_test("DeFi Contagion").await.unwrap();
        
        assert_eq!(result.scenario_name, "DeFi Contagion");
        
        // DeFi contagion should hit DeFi tokens hard
        assert!(result.max_drawdown > 0.4); // Expect significant losses
        assert!(!result.liquidated_positions.is_empty());
        
        // Should have cascade liquidations due to contagion
        assert!(result.cascade_liquidations > 0);
        
        // Recommendations should mention contagion risks
        let recommendations_str = result.recommendations.join(" ");
        assert!(recommendations_str.to_lowercase().contains("critical") || 
                recommendations_str.to_lowercase().contains("severe"));
    }
    
    #[tokio::test]
    async fn test_crypto_winter_scenario() {
        let tester = MockStressTester::new();
        
        // Add conservative position that should survive crypto winter
        let position = Position {
            id: 1,
            user_id: 100,
            token_address: "0x1234".to_string(),
            collateral_amount: Decimal::from(100),
            debt_amount: Decimal::from(30000), // Very conservative leverage
            collateral_token: "ETH".to_string(),
            debt_token: "USDC".to_string(),
            protocol: "Aave".to_string(),
            created_at: Utc::now(),
            last_updated: Utc::now(),
        };
        
        tester.add_position(position).await;
        tester.update_market_price("ETH", Decimal::from(2000)).await;
        tester.update_market_price("USDC", Decimal::from(1)).await;
        
        let result = tester.run_stress_test("Crypto Winter").await.unwrap();
        
        assert_eq!(result.scenario_name, "Crypto Winter");
        
        // Even though there's a major decline, conservative position might survive
        if result.liquidated_positions.is_empty() {
            assert!(result.surviving_positions.contains(&1));
        }
        
        // Should still see significant portfolio decline
        assert!(result.max_drawdown > 0.5);
        
        // Recommendations should focus on long-term survival
        let recommendations_str = result.recommendations.join(" ").to_lowercase();
        assert!(recommendations_str.contains("drawdown") || 
                recommendations_str.contains("bearish") ||
                recommendations_str.contains("defensive"));
    }
    
    #[tokio::test]
    async fn test_liquidity_crisis_scenario() {
        let tester = MockStressTester::new();
        
        // Add position in a token that would be affected by liquidity crisis
        let position = Position {
            id: 1,
            user_id: 100,
            token_address: "0x1234".to_string(),
            collateral_amount: Decimal::from(1000),
            debt_amount: Decimal::from(60000),
            collateral_token: "COMP".to_string(), // DeFi token more affected by liquidity crisis
            debt_token: "USDC".to_string(),
            protocol: "Compound".to_string(),
            created_at: Utc::now(),
            last_updated: Utc::now(),
        };
        
        tester.add_position(position).await;
        tester.update_market_price("COMP", Decimal::from(100)).await;
        tester.update_market_price("USDC", Decimal::from(1)).await;
        
        let result = tester.run_stress_test("Liquidity Crisis").await.unwrap();
        
        assert_eq!(result.scenario_name, "Liquidity Crisis");
        
        // Recommendations should mention liquidity concerns
        let recommendations_str = result.recommendations.join(" ").to_lowercase();
        assert!(recommendations_str.contains("liquidity") || 
                recommendations_str.contains("funding") ||
                recommendations_str.contains("emergency"));
    }
    
    #[tokio::test]
    async fn test_correlation_breakdown_scenario() {
        let tester = MockStressTester::new();
        
        // Add diversified positions
        let position1 = Position {
            id: 1,
            user_id: 100,
            token_address: "0x1234".to_string(),
            collateral_amount: Decimal::from(50),
            debt_amount: Decimal::from(40000),
            collateral_token: "ETH".to_string(),
            debt_token: "USDC".to_string(),
            protocol: "Aave".to_string(),
            created_at: Utc::now(),
            last_updated: Utc::now(),
        };
        
        let position2 = Position {
            id: 2,
            user_id: 101,
            token_address: "0x5678".to_string(),
            collateral_amount: Decimal::from(1),
            debt_amount: Decimal::from(30000),
            collateral_token: "BTC".to_string(),
            debt_token: "USDC".to_string(),
            protocol: "Compound".to_string(),
            created_at: Utc::now(),
            last_updated: Utc::now(),
        };
        
        tester.add_position(position1).await;
        tester.add_position(position2).await;
        tester.update_market_price("ETH", Decimal::from(2000)).await;
        tester.update_market_price("BTC", Decimal::from(50000)).await;
        tester.update_market_price("USDC", Decimal::from(1)).await;
        
        let result = tester.run_stress_test("Correlation Breakdown").await.unwrap();
        
        assert_eq!(result.scenario_name, "Correlation Breakdown");
        
        // Recommendations should mention correlation and diversification
        let recommendations_str = result.recommendations.join(" ").to_lowercase();
        if recommendations_str.contains("correlation") {
            assert!(recommendations_str.contains("diversification") || 
                    recommendations_str.contains("breakdown"));
        }
    }
    
    #[tokio::test]
    async fn test_custom_scenario() {
        let tester = MockStressTester::new();
        
        // Create custom scenario
        let mut custom_price_shocks = HashMap::new();
        custom_price_shocks.insert("ETH".to_string(), -0.50); // 50% drop
        
        let custom_scenario = StressScenario {
            name: "Custom Test Scenario".to_string(),
            description: "Custom scenario for testing".to_string(),
            duration_days: 5,
            price_shocks: custom_price_shocks,
            volume_shocks: HashMap::new(),
            market_conditions: MarketConditions {
                volatility_multiplier: 4.0,
                correlation_breakdown: false,
                liquidity_crisis: false,
                flash_crash_probability: 0.5,
                contagion_factor: 0.6,
                market_sentiment: MarketSentiment::Panic,
            },
            correlation_changes: HashMap::new(),
            liquidity_impacts: HashMap::new(),
        };
        
        tester.add_custom_scenario(custom_scenario).await;
        
        // Add test position
        let position = Position {
            id: 1,
            user_id: 100,
            token_address: "0x1234".to_string(),
            collateral_amount: Decimal::from(100),
            debt_amount: Decimal::from(100000), // High leverage
            collateral_token: "ETH".to_string(),
            debt_token: "USDC".to_string(),
            protocol: "Aave".to_string(),
            created_at: Utc::now(),
            last_updated: Utc::now(),
        };
        
        tester.add_position(position).await;
        tester.update_market_price("ETH", Decimal::from(2000)).await;
        tester.update_market_price("USDC", Decimal::from(1)).await;
        
        let result = tester.run_stress_test("Custom Test Scenario").await.unwrap();
        
        assert_eq!(result.scenario_name, "Custom Test Scenario");
        assert!(result.liquidated_positions.contains(&1)); // High leverage should liquidate
    }
    
    #[tokio::test]
    async fn test_result_caching() {
        let tester = MockStressTester::new();
        
        // Add test position
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
        
        tester.add_position(position).await;
        tester.update_market_price("ETH", Decimal::from(2000)).await;
        tester.update_market_price("USDC", Decimal::from(1)).await;
        
        // Run test once
        let result1 = tester.run_stress_test("Flash Crash").await.unwrap();
        
        // Check cache
        let cached_result = tester.get_cached_result("Flash Crash").await;
        assert!(cached_result.is_some());
        
        let cached = cached_result.unwrap();
        assert_eq!(cached.scenario_name, result1.scenario_name);
        assert_eq!(cached.initial_portfolio_value, result1.initial_portfolio_value);
        
        // Clear cache
        tester.clear_cache().await;
        let cleared_cache = tester.get_cached_result("Flash Crash").await;
        assert!(cleared_cache.is_none());
    }
    
    #[tokio::test]
    async fn test_no_positions_error() {
        let tester = MockStressTester::new();
        
        // Don't add any positions
        let result = tester.run_stress_test("Market Crash").await;
        
        assert!(result.is_err());
        assert!(matches!(result.unwrap_err(), StressTestError::InvalidPositionData(_)));
    }
    
    #[tokio::test]
    async fn test_invalid_scenario_error() {
        let tester = MockStressTester::new();
        
        let result = tester.run_stress_test("Nonexistent Scenario").await;
        
        assert!(result.is_err());
        assert!(matches!(result.unwrap_err(), StressTestError::InvalidScenario(_)));
    }
    
    #[tokio::test]
    async fn test_risk_metrics_calculation() {
        let tester = MockStressTester::new();
        
        // Add position that will definitely be liquidated
        let position = Position {
            id: 1,
            user_id: 100,
            token_address: "0x1234".to_string(),
            collateral_amount: Decimal::from(50),
            debt_amount: Decimal::from(120000), // Very high leverage
            collateral_token: "ETH".to_string(),
            debt_token: "USDC".to_string(),
            protocol: "Aave".to_string(),
            created_at: Utc::now(),
            last_updated: Utc::now(),
        };
        
        tester.add_position(position).await;
        tester.update_market_price("ETH", Decimal::from(2000)).await;
        tester.update_market_price("USDC", Decimal::from(1)).await;
        
        let result = tester.run_stress_test("Market Crash").await.unwrap();
        
        // Risk metrics should show high risk
        assert!(result.risk_metrics.var_95 > Decimal::ZERO);
        assert!(result.risk_metrics.cvar_95 >= result.risk_metrics.var_95);
        assert!(result.risk_metrics.maximum_loss > Decimal::ZERO);
        assert!(result.risk_metrics.survival_probability < 1.0);
        assert!(result.risk_metrics.concentration_risk > 0.0);
        assert!(result.risk_metrics.correlation_risk >= 0.0);
    }
    
    #[tokio::test]
    async fn test_performance_multiple_scenarios() {
        let tester = MockStressTester::new();
        
        // Add multiple positions
        for i in 1..=10 {
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
            tester.add_position(position).await;
        }
        
        tester.update_market_price("ETH", Decimal::from(2000)).await;
        tester.update_market_price("USDC", Decimal::from(1)).await;
        
        let scenario_names = tester.get_scenario_names().await;
        let start_time = std::time::Instant::now();
        
        // Run all scenarios
        for scenario_name in &scenario_names {
            let _ = tester.run_stress_test(scenario_name).await.unwrap();
        }
        
        let duration = start_time.elapsed();
        
        // Should complete all scenarios in reasonable time
        assert!(duration.as_secs() < 10, "Stress testing took {}s, should be <10s", duration.as_secs());
    }
}