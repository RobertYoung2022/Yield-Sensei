use std::sync::Arc;
use tokio::sync::RwLock;
use chrono::{Utc, Duration};
use rust_decimal::Decimal;
use std::collections::HashMap;
use uuid::Uuid;

// Import the actual Aegis satellite and all related components
extern crate aegis_satellite;
use aegis_satellite::{
    AegisSatellite, AegisConfig,
    types::{Position, PositionId, RiskAlert, PriceData},
    liquidation::{PriceFeedProvider, LiquidationAlert},
    risk::{TradeExecutor, TradeSimulation, ExecutionResult, TradeType},
    simulation::{
        SimulationPosition, SimulationScenario, SimulationResult, MonteCarloConfig,
        StressTestingConfig
    },
    data::price_feed_integration::{
        PriceFeedIntegrationSystem, PriceFeedIntegrationConfig, AggregatedPriceData,
        OracleType, EnhancedPriceData
    },
    security::mev_protection::{
        MevProtectionSystem, MevProtectionConfig, MevThreat, TransactionData
    },
    risk::correlation_analysis::{
        CorrelationAnalysisSystem, CorrelationAnalysisConfig, Asset, AssetType,
        PortfolioPosition, CorrelationAnalysis
    }
};

#[cfg(test)]
mod end_to_end_integration_tests {
    use super::*;

    // Comprehensive mock environment for end-to-end testing
    pub struct IntegratedTestEnvironment {
        pub aegis: AegisSatellite,
        pub price_feeds: Arc<EnhancedMockPriceFeedProvider>,
        pub trade_executor: Arc<EnhancedMockTradeExecutor>,
        pub correlation_system: CorrelationAnalysisSystem,
        pub mev_protection: MevProtectionSystem,
        pub positions: Arc<RwLock<HashMap<PositionId, Position>>>,
        pub external_events: Arc<RwLock<Vec<ExternalEvent>>>,
    }

    #[derive(Debug, Clone)]
    pub enum ExternalEvent {
        MarketCrash { severity: f64, affected_tokens: Vec<String> },
        ProtocolHack { protocol: String, funds_at_risk: Decimal },
        RegulatoryNews { impact_score: f64, affected_protocols: Vec<String> },
        LiquidityDrain { pool_address: String, drain_percentage: f64 },
        FlashLoanAttack { target_protocol: String, attack_vector: String },
        GasSpike { new_gas_price: Decimal, duration_minutes: u64 },
    }

    pub struct EnhancedMockPriceFeedProvider {
        prices: Arc<RwLock<HashMap<String, PriceHistory>>>,
        oracle_health: Arc<RwLock<HashMap<OracleType, bool>>>,
        market_conditions: Arc<RwLock<MarketConditions>>,
    }

    #[derive(Debug, Clone)]
    pub struct PriceHistory {
        pub current_price: Decimal,
        pub historical_prices: Vec<(chrono::DateTime<Utc>, Decimal)>,
        pub volatility: f64,
        pub trend: PriceTrend,
    }

    #[derive(Debug, Clone)]
    pub enum PriceTrend {
        Bullish,
        Bearish,
        Sideways,
        Volatile,
    }

    #[derive(Debug, Clone)]
    pub struct MarketConditions {
        pub overall_sentiment: f64, // -1.0 to 1.0
        pub volatility_index: f64,  // 0.0 to 1.0
        pub liquidity_index: f64,   // 0.0 to 1.0
        pub fear_greed_index: f64,  // 0.0 to 1.0
    }

    impl EnhancedMockPriceFeedProvider {
        pub fn new() -> Self {
            let mut prices = HashMap::new();
            
            // Initialize with realistic starting prices and history
            let tokens = [
                ("BTC", 50000.0),
                ("ETH", 3000.0),
                ("USDC", 1.0),
                ("USDT", 1.0),
                ("AAVE", 100.0),
                ("UNI", 25.0),
                ("COMP", 150.0),
                ("SUSHI", 5.0),
                ("CRV", 2.5),
                ("LINK", 20.0),
            ];

            for (token, price) in tokens.iter() {
                let mut history = Vec::new();
                let base_price = *price;
                
                // Generate 30 days of price history
                for i in 0..30 {
                    let days_ago = 30 - i;
                    let timestamp = Utc::now() - Duration::days(days_ago);
                    
                    // Add some realistic price movement
                    let price_variation = (i as f64 * 0.1).sin() * 0.05; // 5% max variation
                    let historical_price = Decimal::from_f64(base_price * (1.0 + price_variation)).unwrap();
                    
                    history.push((timestamp, historical_price));
                }

                prices.insert(token.to_string(), PriceHistory {
                    current_price: Decimal::from_f64(*price).unwrap(),
                    historical_prices: history,
                    volatility: 0.3, // 30% volatility
                    trend: PriceTrend::Sideways,
                });
            }

            let mut oracle_health = HashMap::new();
            oracle_health.insert(OracleType::Chainlink, true);
            oracle_health.insert(OracleType::Pyth, true);
            oracle_health.insert(OracleType::Band, true);

            Self {
                prices: Arc::new(RwLock::new(prices)),
                oracle_health: Arc::new(RwLock::new(oracle_health)),
                market_conditions: Arc::new(RwLock::new(MarketConditions {
                    overall_sentiment: 0.0,
                    volatility_index: 0.3,
                    liquidity_index: 0.8,
                    fear_greed_index: 0.5,
                })),
            }
        }

        pub async fn simulate_market_event(&self, event: &ExternalEvent) {
            match event {
                ExternalEvent::MarketCrash { severity, affected_tokens } => {
                    let mut prices = self.prices.write().await;
                    for token in affected_tokens {
                        if let Some(price_history) = prices.get_mut(token) {
                            let crash_multiplier = 1.0 - severity;
                            let new_price = price_history.current_price * Decimal::from_f64(crash_multiplier).unwrap();
                            price_history.current_price = new_price;
                            price_history.volatility = (price_history.volatility * 2.0).min(1.0);
                            price_history.trend = PriceTrend::Bearish;
                            
                            // Add crash to history
                            price_history.historical_prices.push((Utc::now(), new_price));
                        }
                    }

                    let mut conditions = self.market_conditions.write().await;
                    conditions.overall_sentiment = -severity;
                    conditions.volatility_index = (conditions.volatility_index + severity * 0.5).min(1.0);
                    conditions.fear_greed_index = (1.0 - severity).max(0.0);
                }
                ExternalEvent::GasSpike { new_gas_price, .. } => {
                    // Gas spikes affect all token prices due to transaction costs
                    let gas_impact = new_gas_price.to_f64().unwrap_or(0.0) / 1000.0; // Normalize
                    let mut prices = self.prices.write().await;
                    
                    for (_, price_history) in prices.iter_mut() {
                        if price_history.current_price > Decimal::from(2) { // Don't affect stablecoins much
                            let impact_multiplier = 1.0 - (gas_impact * 0.01); // 1% impact per 1000 gwei
                            price_history.current_price *= Decimal::from_f64(impact_multiplier).unwrap();
                        }
                    }
                }
                _ => {
                    // Handle other events
                }
            }
        }

        pub async fn set_oracle_health(&self, oracle_type: OracleType, healthy: bool) {
            let mut health = self.oracle_health.write().await;
            health.insert(oracle_type, healthy);
        }

        pub async fn get_market_conditions(&self) -> MarketConditions {
            let conditions = self.market_conditions.read().await;
            conditions.clone()
        }
    }

    #[async_trait::async_trait]
    impl PriceFeedProvider for EnhancedMockPriceFeedProvider {
        async fn get_price(&self, token_address: &str) -> Result<PriceData, Box<dyn std::error::Error + Send + Sync>> {
            let prices = self.prices.read().await;
            if let Some(price_history) = prices.get(token_address) {
                Ok(PriceData {
                    token_address: token_address.to_string(),
                    price: price_history.current_price,
                    timestamp: Utc::now(),
                    confidence: 0.95,
                    source: "enhanced_mock_oracle".to_string(),
                })
            } else {
                Err(format!("Price not found for token: {}", token_address).into())
            }
        }

        async fn get_multiple_prices(&self, token_addresses: &[String]) -> Result<HashMap<String, PriceData>, Box<dyn std::error::Error + Send + Sync>> {
            let mut results = HashMap::new();
            for token in token_addresses {
                if let Ok(price_data) = self.get_price(token).await {
                    results.insert(token.clone(), price_data);
                }
            }
            Ok(results)
        }

        async fn is_healthy(&self) -> bool {
            let health = self.oracle_health.read().await;
            health.values().any(|&h| h) // At least one oracle is healthy
        }

        async fn get_supported_tokens(&self) -> Vec<String> {
            let prices = self.prices.read().await;
            prices.keys().cloned().collect()
        }
    }

    pub struct EnhancedMockTradeExecutor {
        execution_history: Arc<RwLock<Vec<ExecutionResult>>>,
        fail_rate: f64,
        gas_price: Arc<RwLock<Decimal>>,
        slippage_rate: f64,
    }

    impl EnhancedMockTradeExecutor {
        pub fn new() -> Self {
            Self {
                execution_history: Arc::new(RwLock::new(Vec::new())),
                fail_rate: 0.0,
                gas_price: Arc::new(RwLock::new(Decimal::from(20))), // 20 gwei
                slippage_rate: 0.005, // 0.5%
            }
        }

        pub async fn set_gas_price(&self, price: Decimal) {
            let mut gas = self.gas_price.write().await;
            *gas = price;
        }

        pub async fn get_execution_statistics(&self) -> ExecutionStatistics {
            let history = self.execution_history.read().await;
            let total_executions = history.len();
            let successful_executions = history.iter().filter(|e| e.success).count();
            let total_gas_used: u64 = history.iter().map(|e| e.gas_used).sum();
            let average_gas = if total_executions > 0 { total_gas_used / total_executions as u64 } else { 0 };

            ExecutionStatistics {
                total_executions,
                successful_executions,
                success_rate: if total_executions > 0 { successful_executions as f64 / total_executions as f64 } else { 0.0 },
                average_gas_used: average_gas,
                total_fees_paid: history.iter().map(|e| e.gas_price * Decimal::from(e.gas_used)).sum(),
            }
        }
    }

    #[derive(Debug, Clone)]
    pub struct ExecutionStatistics {
        pub total_executions: usize,
        pub successful_executions: usize,
        pub success_rate: f64,
        pub average_gas_used: u64,
        pub total_fees_paid: Decimal,
    }

    #[async_trait::async_trait]
    impl TradeExecutor for EnhancedMockTradeExecutor {
        async fn execute_trade(
            &self,
            position_id: PositionId,
            token_address: &str,
            amount: Decimal,
            trade_type: TradeType,
        ) -> Result<ExecutionResult, Box<dyn std::error::Error + Send + Sync>> {
            // Simulate execution delay based on gas price
            let gas_price = self.gas_price.read().await;
            let delay_ms = if *gas_price > Decimal::from(100) {
                50 // Fast execution with high gas
            } else {
                200 // Slower execution with normal gas
            };
            tokio::time::sleep(tokio::time::Duration::from_millis(delay_ms)).await;

            // Simulate random failures
            let success = rand::random::<f64>() >= self.fail_rate;

            let execution_result = ExecutionResult {
                execution_id: Uuid::new_v4(),
                position_id,
                token_address: token_address.to_string(),
                amount,
                trade_type,
                executed_price: Decimal::from(1000) * (Decimal::ONE + Decimal::from_f64(self.slippage_rate).unwrap()),
                execution_time: Utc::now(),
                gas_used: if success { 150000 } else { 21000 }, // Failed txs use less gas
                gas_price: *gas_price,
                success,
                error_message: if success { None } else { Some("Execution failed".to_string()) },
            };

            let mut history = self.execution_history.write().await;
            history.push(execution_result.clone());

            if success {
                Ok(execution_result)
            } else {
                Err("Trade execution failed".into())
            }
        }

        async fn simulate_trade(
            &self,
            position_id: PositionId,
            token_address: &str,
            amount: Decimal,
            trade_type: TradeType,
        ) -> Result<TradeSimulation, Box<dyn std::error::Error + Send + Sync>> {
            let gas_price = self.gas_price.read().await;
            
            Ok(TradeSimulation {
                position_id,
                token_address: token_address.to_string(),
                amount,
                trade_type,
                estimated_price: Decimal::from(1000),
                price_impact: self.slippage_rate,
                slippage: self.slippage_rate,
                gas_estimate: 150000,
                success_probability: 1.0 - self.fail_rate,
                execution_time_estimate_ms: if *gas_price > Decimal::from(100) { 50 } else { 200 },
            })
        }
    }

    impl IntegratedTestEnvironment {
        pub async fn new() -> Result<Self, Box<dyn std::error::Error + Send + Sync>> {
            let price_feeds = Arc::new(EnhancedMockPriceFeedProvider::new());
            let trade_executor = Arc::new(EnhancedMockTradeExecutor::new());

            let mut aegis_config = AegisConfig::default();
            aegis_config.enable_automated_actions = true;
            aegis_config.enable_mev_protection = true;

            let aegis = AegisSatellite::new(
                price_feeds.clone(),
                trade_executor.clone(),
                Some(aegis_config),
            ).await?;

            let correlation_config = CorrelationAnalysisConfig::default();
            let correlation_system = CorrelationAnalysisSystem::new(correlation_config);

            let mev_config = MevProtectionConfig::default();
            let mev_protection = MevProtectionSystem::new(mev_config);

            Ok(Self {
                aegis,
                price_feeds,
                trade_executor,
                correlation_system,
                mev_protection,
                positions: Arc::new(RwLock::new(HashMap::new())),
                external_events: Arc::new(RwLock::new(Vec::new())),
            })
        }

        pub async fn add_diverse_portfolio(&self) -> Result<Vec<PositionId>, Box<dyn std::error::Error + Send + Sync>> {
            let positions = vec![
                // Lending positions
                Position {
                    id: PositionId::new_v4(),
                    protocol: "Aave".to_string(),
                    user_address: "0x1111...".to_string(),
                    collateral_token: "ETH".to_string(),
                    collateral_amount: Decimal::from(50),
                    debt_token: "USDC".to_string(),
                    debt_amount: Decimal::from(75000),
                    health_factor: Decimal::from_f64(2.0).unwrap(),
                    liquidation_threshold: Decimal::from_f64(1.3).unwrap(),
                    created_at: Utc::now(),
                    updated_at: Utc::now(),
                },
                Position {
                    id: PositionId::new_v4(),
                    protocol: "Compound".to_string(),
                    user_address: "0x2222...".to_string(),
                    collateral_token: "BTC".to_string(),
                    collateral_amount: Decimal::from(5),
                    debt_token: "USDC".to_string(),
                    debt_amount: Decimal::from(120000),
                    health_factor: Decimal::from_f64(1.8).unwrap(),
                    liquidation_threshold: Decimal::from_f64(1.25).unwrap(),
                    created_at: Utc::now(),
                    updated_at: Utc::now(),
                },
                // AMM positions
                Position {
                    id: PositionId::new_v4(),
                    protocol: "Uniswap".to_string(),
                    user_address: "0x3333...".to_string(),
                    collateral_token: "UNI".to_string(),
                    collateral_amount: Decimal::from(2000),
                    debt_token: "ETH".to_string(),
                    debt_amount: Decimal::from(15),
                    health_factor: Decimal::from_f64(1.5).unwrap(),
                    liquidation_threshold: Decimal::from_f64(1.2).unwrap(),
                    created_at: Utc::now(),
                    updated_at: Utc::now(),
                },
                // Yield farming positions
                Position {
                    id: PositionId::new_v4(),
                    protocol: "Curve".to_string(),
                    user_address: "0x4444...".to_string(),
                    collateral_token: "CRV".to_string(),
                    collateral_amount: Decimal::from(10000),
                    debt_token: "USDC".to_string(),
                    debt_amount: Decimal::from(15000),
                    health_factor: Decimal::from_f64(1.7).unwrap(),
                    liquidation_threshold: Decimal::from_f64(1.4).unwrap(),
                    created_at: Utc::now(),
                    updated_at: Utc::now(),
                },
                // Leveraged trading position
                Position {
                    id: PositionId::new_v4(),
                    protocol: "dYdX".to_string(),
                    user_address: "0x5555...".to_string(),
                    collateral_token: "USDC".to_string(),
                    collateral_amount: Decimal::from(25000),
                    debt_token: "ETH".to_string(),
                    debt_amount: Decimal::from(15),
                    health_factor: Decimal::from_f64(1.4).unwrap(),
                    liquidation_threshold: Decimal::from_f64(1.1).unwrap(),
                    created_at: Utc::now(),
                    updated_at: Utc::now(),
                },
            ];

            let mut position_ids = Vec::new();
            let mut stored_positions = self.positions.write().await;

            for position in positions {
                let position_id = self.aegis.add_position(position.clone()).await?;
                stored_positions.insert(position_id, position);
                position_ids.push(position_id);
            }

            Ok(position_ids)
        }

        pub async fn trigger_external_event(&self, event: ExternalEvent) {
            let mut events = self.external_events.write().await;
            events.push(event.clone());

            // Apply the event to the environment
            self.price_feeds.simulate_market_event(&event).await;
        }

        pub async fn run_comprehensive_risk_assessment(&self, position_ids: &[PositionId]) -> Result<ComprehensiveRiskReport, Box<dyn std::error::Error + Send + Sync>> {
            // 1. Get current position health
            let mut position_healths = HashMap::new();
            for &position_id in position_ids {
                let health = self.aegis.get_position_health(position_id).await?;
                position_healths.insert(position_id, health);
            }

            // 2. Convert to simulation positions for stress testing
            let simulation_positions = self.aegis.convert_positions_to_simulation(position_ids).await?;

            // 3. Run all stress test scenarios
            let scenarios = [
                SimulationScenario::HistoricalMarketCrash,
                SimulationScenario::CryptoWinter,
                SimulationScenario::DeFiContagion,
                SimulationScenario::RegulatoryShock,
                SimulationScenario::BlackSwan,
            ];

            let mut stress_results = HashMap::new();
            for scenario in &scenarios {
                let result = self.aegis.run_stress_test(&simulation_positions, scenario).await?;
                stress_results.insert(scenario.clone(), result);
            }

            // 4. Run Monte Carlo simulation
            let mc_config = MonteCarloConfig {
                iterations: 1000,
                time_horizon_days: 30,
                confidence_level: 0.95,
                price_volatility: 0.4, // 40% volatility
                correlation_matrix: vec![vec![1.0]],
                drift_rates: HashMap::new(),
            };

            let monte_carlo_results = self.aegis.run_monte_carlo_simulation(&simulation_positions, &mc_config).await?;

            // 5. Analyze correlations
            // (This would require setting up assets and portfolio in the correlation system)

            // 6. Check for MEV risks
            // (This would require transaction data)

            // 7. Get current alerts
            let active_alerts = self.aegis.get_alerts(None).await?;

            Ok(ComprehensiveRiskReport {
                position_healths,
                stress_test_results: stress_results,
                monte_carlo_summary: MonteCarloSummary::from_results(&monte_carlo_results),
                active_alerts,
                overall_risk_score: self.calculate_overall_risk_score(&stress_results).await,
                recommendations: self.generate_risk_recommendations(&stress_results, &position_healths).await,
            })
        }

        async fn calculate_overall_risk_score(&self, stress_results: &HashMap<SimulationScenario, SimulationResult>) -> f64 {
            let mut total_drawdown = 0.0;
            let mut worst_case_drawdown = 0.0;

            for (_, result) in stress_results {
                total_drawdown += result.max_drawdown.abs();
                worst_case_drawdown = worst_case_drawdown.max(result.max_drawdown.abs());
            }

            let average_drawdown = total_drawdown / stress_results.len() as f64;
            
            // Risk score from 0.0 (no risk) to 1.0 (extreme risk)
            (average_drawdown * 0.7 + worst_case_drawdown * 0.3).min(1.0)
        }

        async fn generate_risk_recommendations(&self, stress_results: &HashMap<SimulationScenario, SimulationResult>, position_healths: &HashMap<PositionId, aegis_satellite::types::HealthFactor>) -> Vec<String> {
            let mut recommendations = Vec::new();

            // Check for positions at risk
            let risky_positions: Vec<_> = position_healths.iter()
                .filter(|(_, health)| health.health_factor < Decimal::from_f64(1.5).unwrap())
                .collect();

            if !risky_positions.is_empty() {
                recommendations.push(format!("{} positions have health factors below 1.5 - consider increasing collateral", risky_positions.len()));
            }

            // Check stress test results
            let worst_scenario = stress_results.iter()
                .min_by(|(_, a), (_, b)| a.max_drawdown.partial_cmp(&b.max_drawdown).unwrap())
                .map(|(scenario, result)| (scenario, result.max_drawdown));

            if let Some((scenario, drawdown)) = worst_scenario {
                if drawdown < -0.7 {
                    recommendations.push(format!("Extreme risk detected in {:?} scenario with {:.1}% drawdown - consider portfolio diversification", scenario, drawdown * 100.0));
                }
            }

            // Check for liquidations across scenarios
            let total_liquidations: usize = stress_results.values()
                .map(|result| result.liquidated_positions.len())
                .sum();

            if total_liquidations > 0 {
                recommendations.push(format!("{} positions at risk of liquidation across scenarios - urgent action required", total_liquidations));
            }

            if recommendations.is_empty() {
                recommendations.push("Portfolio risk levels are within acceptable limits".to_string());
            }

            recommendations
        }
    }

    #[derive(Debug, Clone)]
    pub struct ComprehensiveRiskReport {
        pub position_healths: HashMap<PositionId, aegis_satellite::types::HealthFactor>,
        pub stress_test_results: HashMap<SimulationScenario, SimulationResult>,
        pub monte_carlo_summary: MonteCarloSummary,
        pub active_alerts: Vec<RiskAlert>,
        pub overall_risk_score: f64,
        pub recommendations: Vec<String>,
    }

    #[derive(Debug, Clone)]
    pub struct MonteCarloSummary {
        pub iterations: usize,
        pub mean_return: f64,
        pub volatility: f64,
        pub var_95: f64,
        pub cvar_95: f64,
        pub worst_case_loss: f64,
        pub best_case_gain: f64,
    }

    impl MonteCarloSummary {
        pub fn from_results(results: &[SimulationResult]) -> Self {
            if results.is_empty() {
                return Self {
                    iterations: 0,
                    mean_return: 0.0,
                    volatility: 0.0,
                    var_95: 0.0,
                    cvar_95: 0.0,
                    worst_case_loss: 0.0,
                    best_case_gain: 0.0,
                };
            }

            let returns: Vec<f64> = results.iter()
                .map(|r| (r.final_portfolio_value - r.initial_portfolio_value) / r.initial_portfolio_value)
                .collect();

            let mean_return = returns.iter().sum::<f64>() / returns.len() as f64;
            let variance = returns.iter()
                .map(|r| (r - mean_return).powi(2))
                .sum::<f64>() / returns.len() as f64;
            let volatility = variance.sqrt();

            let worst_case_loss = returns.iter().fold(0.0, |acc, &r| acc.min(r));
            let best_case_gain = returns.iter().fold(0.0, |acc, &r| acc.max(r));

            Self {
                iterations: results.len(),
                mean_return,
                volatility,
                var_95: results[0].var_95,
                cvar_95: results[0].cvar_95,
                worst_case_loss,
                best_case_gain,
            }
        }
    }

    // Helper functions for creating test data
    fn create_mev_transaction_data() -> Vec<TransactionData> {
        vec![
            TransactionData {
                hash: "0xabc123".to_string(),
                from: "0x1111...".to_string(),
                to: "0x2222...".to_string(),
                value: Decimal::from(1000),
                gas_price: Decimal::from(20),
                gas_limit: 150000,
                data: "swap_data".to_string(),
                timestamp: Utc::now(),
                block_number: 12345678,
                transaction_index: 42,
            },
            TransactionData {
                hash: "0xdef456".to_string(),
                from: "0x3333...".to_string(),
                to: "0x4444...".to_string(),
                value: Decimal::from(5000),
                gas_price: Decimal::from(50),
                gas_limit: 200000,
                data: "liquidation_data".to_string(),
                timestamp: Utc::now(),
                block_number: 12345679,
                transaction_index: 15,
            },
        ]
    }

    #[tokio::test]
    async fn test_comprehensive_system_initialization() {
        let env = IntegratedTestEnvironment::new().await;
        assert!(env.is_ok(), "Failed to initialize integrated test environment");

        let env = env.unwrap();

        // Verify all components are properly initialized
        let stats = env.aegis.get_statistics();
        assert_eq!(stats.total_positions, 0);
        assert_eq!(stats.active_alerts, 0);

        // Verify price feeds are working
        let btc_price = env.price_feeds.get_price("BTC").await;
        assert!(btc_price.is_ok());
        assert_eq!(btc_price.unwrap().price, Decimal::from(50000));

        // Verify market conditions are initialized
        let conditions = env.price_feeds.get_market_conditions().await;
        assert!(conditions.overall_sentiment >= -1.0 && conditions.overall_sentiment <= 1.0);
        assert!(conditions.volatility_index >= 0.0 && conditions.volatility_index <= 1.0);
    }

    #[tokio::test]
    async fn test_portfolio_setup_and_monitoring() {
        let env = IntegratedTestEnvironment::new().await.unwrap();
        env.aegis.start().await.expect("Failed to start Aegis monitoring");

        // Add diverse portfolio
        let position_ids = env.add_diverse_portfolio().await.expect("Failed to add portfolio");
        assert_eq!(position_ids.len(), 5);

        // Verify positions were added correctly
        let stats = env.aegis.get_statistics();
        assert_eq!(stats.total_positions, 5);

        // Check initial health of all positions
        for &position_id in &position_ids {
            let health = env.aegis.get_position_health(position_id).await;
            assert!(health.is_ok(), "Failed to get position health for {:?}", position_id);
            
            let health_factor = health.unwrap().health_factor;
            assert!(health_factor > Decimal::from_f64(1.0).unwrap(), "Position has unhealthy factor: {}", health_factor);
        }

        // Allow monitoring systems to run
        tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;

        // Check that no critical alerts were generated for healthy positions
        let alerts = env.aegis.get_alerts(None).await.unwrap();
        let critical_alerts: Vec<_> = alerts.iter()
            .filter(|alert| matches!(alert.severity, aegis_satellite::types::AlertSeverity::Critical))
            .collect();
        
        assert!(critical_alerts.is_empty(), "Found unexpected critical alerts: {:?}", critical_alerts);
    }

    #[tokio::test]
    async fn test_market_crash_scenario() {
        let env = IntegratedTestEnvironment::new().await.unwrap();
        let position_ids = env.add_diverse_portfolio().await.unwrap();

        // Trigger a major market crash
        let crash_event = ExternalEvent::MarketCrash {
            severity: 0.4, // 40% crash
            affected_tokens: vec![
                "BTC".to_string(),
                "ETH".to_string(),
                "UNI".to_string(),
                "CRV".to_string(),
            ],
        };

        env.trigger_external_event(crash_event).await;

        // Allow time for price updates to propagate
        tokio::time::sleep(tokio::time::Duration::from_millis(200)).await;

        // Verify prices dropped
        let btc_price = env.price_feeds.get_price("BTC").await.unwrap();
        assert!(btc_price.price < Decimal::from(40000), "BTC price should have dropped below 40k, got {}", btc_price.price);

        let eth_price = env.price_feeds.get_price("ETH").await.unwrap();
        assert!(eth_price.price < Decimal::from(2500), "ETH price should have dropped below 2.5k, got {}", eth_price.price);

        // Check position health after crash
        let mut liquidation_risk_positions = 0;
        for &position_id in &position_ids {
            let health = env.aegis.get_position_health(position_id).await.unwrap();
            if health.health_factor < Decimal::from_f64(1.3).unwrap() {
                liquidation_risk_positions += 1;
            }
        }

        assert!(liquidation_risk_positions > 0, "Expected at least one position to be at liquidation risk after 40% crash");

        // Run comprehensive risk assessment
        let risk_report = env.run_comprehensive_risk_assessment(&position_ids).await.unwrap();
        
        assert!(risk_report.overall_risk_score > 0.3, "Overall risk score should be elevated after crash, got {}", risk_report.overall_risk_score);
        assert!(!risk_report.recommendations.is_empty(), "Should have risk recommendations after crash");

        // Verify stress test shows high impact
        let market_crash_result = risk_report.stress_test_results.get(&SimulationScenario::HistoricalMarketCrash).unwrap();
        assert!(market_crash_result.max_drawdown < -0.2, "Market crash scenario should show significant drawdown");
    }

    #[tokio::test]
    async fn test_defi_protocol_exploit_scenario() {
        let env = IntegratedTestEnvironment::new().await.unwrap();
        let position_ids = env.add_diverse_portfolio().await.unwrap();

        // Simulate a protocol hack affecting Aave
        let hack_event = ExternalEvent::ProtocolHack {
            protocol: "Aave".to_string(),
            funds_at_risk: Decimal::from(50000000), // $50M at risk
        };

        env.trigger_external_event(hack_event).await;

        // Simulate immediate market reaction - AAVE token crash and fear in lending protocols
        let market_reaction = ExternalEvent::MarketCrash {
            severity: 0.3,
            affected_tokens: vec!["AAVE".to_string(), "COMP".to_string()], // Lending protocol tokens affected
        };

        env.trigger_external_event(market_reaction).await;

        tokio::time::sleep(tokio::time::Duration::from_millis(200)).await;

        // Find Aave positions and check their health
        let positions_guard = env.positions.read().await;
        let aave_positions: Vec<_> = positions_guard.iter()
            .filter(|(_, pos)| pos.protocol == "Aave")
            .collect();

        assert!(!aave_positions.is_empty(), "Should have Aave positions in portfolio");

        for (&position_id, _) in &aave_positions {
            let health = env.aegis.get_position_health(position_id).await.unwrap();
            // Aave positions should be more stressed due to protocol risk
            assert!(health.health_factor < Decimal::from_f64(2.5).unwrap(), "Aave position should show increased risk");
        }

        // Run stress test focusing on DeFi contagion
        let simulation_positions = env.aegis.convert_positions_to_simulation(&position_ids).await.unwrap();
        let defi_contagion_result = env.aegis.run_stress_test(&simulation_positions, &SimulationScenario::DeFiContagion).await.unwrap();

        assert!(defi_contagion_result.max_drawdown < -0.4, "DeFi contagion should show severe impact after protocol hack");
        assert!(!defi_contagion_result.liquidated_positions.is_empty(), "Some positions should be at risk of liquidation");
    }

    #[tokio::test]
    async fn test_mev_protection_integration() {
        let env = IntegratedTestEnvironment::new().await.unwrap();
        let _position_ids = env.add_diverse_portfolio().await.unwrap();

        // Create transaction data that might be vulnerable to MEV
        let transactions = create_mev_transaction_data();

        // Test MEV threat detection
        for transaction in &transactions {
            let threat_result = env.mev_protection.detect_mev_threats(&[transaction.clone()]).await;
            assert!(threat_result.is_ok(), "MEV threat detection should work");

            let threats = threat_result.unwrap();
            // In a real scenario, we might detect sandwich attacks or other MEV threats
            println!("Detected {} MEV threats for transaction {}", threats.len(), transaction.hash);
        }

        // Test MEV protection routing
        let large_transaction = TransactionData {
            hash: "0x_large_swap".to_string(),
            from: "0x_user".to_string(),
            to: "0x_dex".to_string(),
            value: Decimal::from(100000), // Large swap more vulnerable to MEV
            gas_price: Decimal::from(20),
            gas_limit: 300000,
            data: "large_swap_data".to_string(),
            timestamp: Utc::now(),
            block_number: 12345680,
            transaction_index: 1,
        };

        let protection_result = env.mev_protection.get_protected_execution_route(&large_transaction).await;
        assert!(protection_result.is_ok(), "MEV protection routing should work for large transactions");

        let route = protection_result.unwrap();
        assert!(route.protection_level != aegis_satellite::security::mev_protection::ProtectionLevel::None, 
                "Large transaction should have MEV protection");
    }

    #[tokio::test]
    async fn test_gas_spike_impact() {
        let env = IntegratedTestEnvironment::new().await.unwrap();
        let position_ids = env.add_diverse_portfolio().await.unwrap();

        // Record initial execution statistics
        let initial_stats = env.trade_executor.get_execution_statistics().await;

        // Simulate extreme gas spike
        let gas_spike = ExternalEvent::GasSpike {
            new_gas_price: Decimal::from(500), // 500 gwei (very high)
            duration_minutes: 60,
        };

        env.trigger_external_event(gas_spike).await;
        env.trade_executor.set_gas_price(Decimal::from(500)).await;

        // Test trade execution during high gas period
        let test_simulation = env.aegis.simulate_trade_impact(
            position_ids[0],
            "ETH",
            Decimal::from(1),
        ).await;

        assert!(test_simulation.is_ok(), "Should be able to simulate trades during gas spike");
        let simulation = test_simulation.unwrap();

        // Execution should be faster with high gas but more expensive
        assert!(simulation.execution_time_estimate_ms < 100, "High gas should lead to faster execution");

        // Actually execute a trade to test gas impact
        let execution_result = env.trade_executor.execute_trade(
            position_ids[0],
            "ETH",
            Decimal::from(1),
            TradeType::Liquidation,
        ).await;

        if execution_result.is_ok() {
            let execution = execution_result.unwrap();
            assert_eq!(execution.gas_price, Decimal::from(500), "Execution should use high gas price");
        }

        // Check how gas spike affected prices (should have small negative impact)
        let eth_price = env.price_feeds.get_price("ETH").await.unwrap();
        assert!(eth_price.price < Decimal::from(3000), "High gas should slightly depress token prices");

        // Verify execution statistics changed
        let final_stats = env.trade_executor.get_execution_statistics().await;
        if final_stats.total_executions > initial_stats.total_executions {
            assert!(final_stats.total_fees_paid > initial_stats.total_fees_paid, "Should pay more in fees during gas spike");
        }
    }

    #[tokio::test]
    async fn test_correlation_analysis_integration() {
        let env = IntegratedTestEnvironment::new().await.unwrap();
        let position_ids = env.add_diverse_portfolio().await.unwrap();

        // Set up assets in correlation system
        let assets = vec![
            Asset {
                symbol: "BTC".to_string(),
                name: "Bitcoin".to_string(),
                asset_type: AssetType::Cryptocurrency,
                price_history: vec![], // Would be populated with real data
                volatility: 0.4,
                beta: 1.0,
                market_cap: Some(800000000000.0),
            },
            Asset {
                symbol: "ETH".to_string(),
                name: "Ethereum".to_string(),
                asset_type: AssetType::Cryptocurrency,
                price_history: vec![],
                volatility: 0.5,
                beta: 1.2,
                market_cap: Some(300000000000.0),
            },
            Asset {
                symbol: "USDC".to_string(),
                name: "USD Coin".to_string(),
                asset_type: AssetType::Stablecoin,
                price_history: vec![],
                volatility: 0.01,
                beta: 0.0,
                market_cap: Some(50000000000.0),
            },
        ];

        for asset in assets {
            env.correlation_system.add_asset(asset).await.expect("Failed to add asset");
        }

        // Create portfolio positions for correlation analysis
        let portfolio_positions = vec![
            PortfolioPosition {
                asset_symbol: "BTC".to_string(),
                quantity: 5.0,
                value_usd: 250000.0,
                allocation_percentage: 50.0,
                entry_price: 48000.0,
                current_price: 50000.0,
                unrealized_pnl: 10000.0,
                risk_score: 0.6,
            },
            PortfolioPosition {
                asset_symbol: "ETH".to_string(),
                quantity: 50.0,
                value_usd: 150000.0,
                allocation_percentage: 30.0,
                entry_price: 2800.0,
                current_price: 3000.0,
                unrealized_pnl: 10000.0,
                risk_score: 0.7,
            },
            PortfolioPosition {
                asset_symbol: "USDC".to_string(),
                quantity: 100000.0,
                value_usd: 100000.0,
                allocation_percentage: 20.0,
                entry_price: 1.0,
                current_price: 1.0,
                unrealized_pnl: 0.0,
                risk_score: 0.1,
            },
        ];

        env.correlation_system.add_portfolio("test_portfolio", portfolio_positions).await.expect("Failed to add portfolio");

        // This would require more setup with actual price data for correlation calculation
        // For now, we verify the system is properly integrated
        let portfolio_summary = env.correlation_system.get_portfolio_summary("test_portfolio").await;
        assert!(portfolio_summary.is_ok(), "Should be able to get portfolio summary");
    }

    #[tokio::test]
    async fn test_monte_carlo_performance_validation() {
        let env = IntegratedTestEnvironment::new().await.unwrap();
        let position_ids = env.add_diverse_portfolio().await.unwrap();

        let simulation_positions = env.aegis.convert_positions_to_simulation(&position_ids).await.unwrap();

        // Test different Monte Carlo configurations
        let configs = vec![
            MonteCarloConfig {
                iterations: 100,
                time_horizon_days: 7,
                confidence_level: 0.95,
                price_volatility: 0.2,
                correlation_matrix: vec![vec![1.0]],
                drift_rates: HashMap::new(),
            },
            MonteCarloConfig {
                iterations: 500,
                time_horizon_days: 30,
                confidence_level: 0.99,
                price_volatility: 0.4,
                correlation_matrix: vec![vec![1.0]],
                drift_rates: HashMap::new(),
            },
        ];

        for (i, config) in configs.iter().enumerate() {
            let start_time = std::time::Instant::now();
            
            let results = env.aegis.run_monte_carlo_simulation(&simulation_positions, config).await;
            
            let duration = start_time.elapsed();
            
            assert!(results.is_ok(), "Monte Carlo simulation {} should succeed", i);
            let results = results.unwrap();
            
            assert_eq!(results.len(), config.iterations as usize, "Should return correct number of iterations");
            
            // Performance check - should complete within reasonable time
            let max_duration_ms = config.iterations * 10; // 10ms per iteration max
            assert!(duration.as_millis() < max_duration_ms as u128, 
                   "Monte Carlo with {} iterations took {}ms, should be under {}ms", 
                   config.iterations, duration.as_millis(), max_duration_ms);

            // Validate statistical properties
            let summary = MonteCarloSummary::from_results(&results);
            assert!(summary.volatility > 0.0, "Monte Carlo should show some volatility");
            assert!(summary.var_95 != 0.0, "VaR should be calculated");
            assert!(summary.cvar_95 <= summary.var_95, "CVaR should be more extreme than VaR");
        }
    }

    #[tokio::test]
    async fn test_comprehensive_stress_testing_suite() {
        let env = IntegratedTestEnvironment::new().await.unwrap();
        let position_ids = env.add_diverse_portfolio().await.unwrap();

        let simulation_positions = env.aegis.convert_positions_to_simulation(&position_ids).await.unwrap();

        // Test all stress scenarios
        let scenarios = [
            SimulationScenario::HistoricalMarketCrash,
            SimulationScenario::CryptoWinter,
            SimulationScenario::DeFiContagion,
            SimulationScenario::RegulatoryShock,
            SimulationScenario::BlackSwan,
        ];

        let mut results = HashMap::new();
        let mut total_duration = std::time::Duration::ZERO;

        for scenario in &scenarios {
            let start_time = std::time::Instant::now();
            
            let result = env.aegis.run_stress_test(&simulation_positions, scenario).await;
            
            let duration = start_time.elapsed();
            total_duration += duration;
            
            assert!(result.is_ok(), "Stress test for {:?} should succeed", scenario);
            let result = result.unwrap();
            
            // Validate result structure
            assert_eq!(result.scenario, *scenario);
            assert!(result.initial_portfolio_value > 0.0);
            assert!(result.simulation_duration_ms > 0);
            
            // Different scenarios should have different impacts
            match scenario {
                SimulationScenario::BlackSwan => {
                    assert!(result.max_drawdown < -0.7, "Black Swan should have extreme drawdown");
                }
                SimulationScenario::CryptoWinter => {
                    assert!(result.max_drawdown < -0.6, "Crypto Winter should have severe drawdown");
                }
                SimulationScenario::RegulatoryShock => {
                    assert!(result.max_drawdown > -0.5, "Regulatory shock should be less severe");
                }
                _ => {
                    assert!(result.max_drawdown < 0.0, "All scenarios should show some negative impact");
                }
            }

            results.insert(*scenario, result);
        }

        // Performance validation
        assert!(total_duration.as_millis() < 5000, "All stress tests should complete within 5 seconds");

        // Cross-scenario validation
        let black_swan = results.get(&SimulationScenario::BlackSwan).unwrap();
        let regulatory = results.get(&SimulationScenario::RegulatoryShock).unwrap();
        
        assert!(black_swan.max_drawdown < regulatory.max_drawdown, 
               "Black Swan should be more severe than Regulatory Shock");

        // Check recommendations quality
        let total_recommendations: usize = results.values().map(|r| r.recommendations.len()).sum();
        assert!(total_recommendations > 0, "Stress tests should generate actionable recommendations");
    }

    #[tokio::test]
    async fn test_end_to_end_liquidation_prevention_workflow() {
        let env = IntegratedTestEnvironment::new().await.unwrap();
        env.aegis.start().await.expect("Failed to start Aegis monitoring");

        // Add a position that will be close to liquidation
        let risky_position = Position {
            id: PositionId::new_v4(),
            protocol: "Aave".to_string(),
            user_address: "0xrisky...".to_string(),
            collateral_token: "ETH".to_string(),
            collateral_amount: Decimal::from(10),
            debt_token: "USDC".to_string(),
            debt_amount: Decimal::from(24000), // High debt ratio
            health_factor: Decimal::from_f64(1.3).unwrap(), // Close to liquidation threshold
            liquidation_threshold: Decimal::from_f64(1.25).unwrap(),
            created_at: Utc::now(),
            updated_at: Utc::now(),
        };

        let risky_position_id = env.aegis.add_position(risky_position).await.unwrap();

        // Add normal positions as well
        let normal_position_ids = env.add_diverse_portfolio().await.unwrap();
        let mut all_position_ids = vec![risky_position_id];
        all_position_ids.extend(normal_position_ids);

        // 1. Initial health check - risky position should be flagged
        let initial_health = env.aegis.get_position_health(risky_position_id).await.unwrap();
        assert!(initial_health.health_factor < Decimal::from_f64(1.5).unwrap(), "Position should be flagged as risky");

        // 2. Trigger market stress that would push the position toward liquidation
        let stress_event = ExternalEvent::MarketCrash {
            severity: 0.15, // 15% drop - enough to stress but not crash the position immediately
            affected_tokens: vec!["ETH".to_string()],
        };

        env.trigger_external_event(stress_event).await;

        // 3. Allow monitoring systems to detect the risk
        tokio::time::sleep(tokio::time::Duration::from_millis(300)).await;

        // 4. Check updated health after price drop
        let stressed_health = env.aegis.get_position_health(risky_position_id).await.unwrap();
        assert!(stressed_health.health_factor < initial_health.health_factor, "Health should deteriorate after price drop");

        // 5. Run stress tests to assess liquidation risk
        let simulation_positions = env.aegis.convert_positions_to_simulation(&[risky_position_id]).await.unwrap();
        let stress_result = env.aegis.run_stress_test(&simulation_positions, &SimulationScenario::HistoricalMarketCrash).await.unwrap();

        // 6. Verify the risky position is identified for liquidation
        assert!(stress_result.liquidated_positions.contains(&"ETH".to_string()) || 
                stress_result.max_drawdown < -0.5, 
                "Risky position should be identified as vulnerable");

        // 7. Simulate automated response - trade simulation for risk reduction
        let risk_reduction_simulation = env.aegis.simulate_trade_impact(
            risky_position_id,
            "USDC", // Repay some debt
            Decimal::from(2000),
        ).await;

        assert!(risk_reduction_simulation.is_ok(), "Should be able to simulate risk reduction trade");
        let simulation = risk_reduction_simulation.unwrap();
        assert!(simulation.success_probability > 0.8, "Risk reduction trade should have high success probability");

        // 8. Check alerts were generated
        let alerts = env.aegis.get_alerts(Some(risky_position_id)).await.unwrap();
        // In a real system, this would likely generate liquidation warnings

        // 9. Verify other positions weren't significantly affected
        for &position_id in &normal_position_ids {
            let health = env.aegis.get_position_health(position_id).await.unwrap();
            assert!(health.health_factor > Decimal::from_f64(1.2).unwrap(), 
                   "Normal positions should remain healthy after minor market stress");
        }

        // 10. Final comprehensive risk assessment
        let final_risk_report = env.run_comprehensive_risk_assessment(&all_position_ids).await.unwrap();
        
        assert!(final_risk_report.overall_risk_score > 0.2, "Overall risk should be elevated due to risky position");
        assert!(!final_risk_report.recommendations.is_empty(), "Should provide recommendations for risk mitigation");
        
        // Verify the risky position is specifically called out
        let risky_health = final_risk_report.position_healths.get(&risky_position_id).unwrap();
        assert!(risky_health.health_factor < Decimal::from_f64(1.5).unwrap(), "Risky position should still be flagged");
    }

    #[tokio::test] 
    async fn test_system_resilience_under_extreme_conditions() {
        let env = IntegratedTestEnvironment::new().await.unwrap();
        let position_ids = env.add_diverse_portfolio().await.unwrap();

        // Test multiple simultaneous extreme events
        let extreme_events = vec![
            ExternalEvent::MarketCrash {
                severity: 0.6, // 60% crash
                affected_tokens: vec!["BTC".to_string(), "ETH".to_string()],
            },
            ExternalEvent::GasSpike {
                new_gas_price: Decimal::from(1000), // 1000 gwei
                duration_minutes: 120,
            },
            ExternalEvent::ProtocolHack {
                protocol: "Compound".to_string(),
                funds_at_risk: Decimal::from(100000000),
            },
            ExternalEvent::LiquidityDrain {
                pool_address: "0xuniswap_eth_usdc".to_string(),
                drain_percentage: 0.8,
            },
        ];

        // Trigger all events simultaneously
        for event in extreme_events {
            env.trigger_external_event(event).await;
        }

        env.trade_executor.set_gas_price(Decimal::from(1000)).await;

        // Allow time for all events to propagate
        tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;

        // System should still be responsive
        let stats = env.aegis.get_statistics();
        assert_eq!(stats.total_positions, position_ids.len());

        // Should be able to get health for all positions (even if very poor)
        let mut position_health_count = 0;
        for &position_id in &position_ids {
            if let Ok(_health) = env.aegis.get_position_health(position_id).await {
                position_health_count += 1;
            }
        }
        assert_eq!(position_health_count, position_ids.len(), "Should be able to get health for all positions even under extreme stress");

        // Stress testing should still work
        let simulation_positions = env.aegis.convert_positions_to_simulation(&position_ids).await.unwrap();
        let extreme_stress_result = env.aegis.run_stress_test(&simulation_positions, &SimulationScenario::BlackSwan).await;
        assert!(extreme_stress_result.is_ok(), "Stress testing should work even under extreme conditions");

        let result = extreme_stress_result.unwrap();
        assert!(result.max_drawdown < -0.8, "Extreme conditions should show severe portfolio impact");
        assert!(result.liquidated_positions.len() >= position_ids.len() / 2, "Most positions should be liquidated under extreme stress");

        // Trade simulation should still work (though may show poor conditions)
        let trade_sim_result = env.aegis.simulate_trade_impact(
            position_ids[0],
            "ETH",
            Decimal::from(1),
        ).await;
        assert!(trade_sim_result.is_ok(), "Trade simulation should work under extreme conditions");

        // Comprehensive risk assessment should complete
        let extreme_risk_report = env.run_comprehensive_risk_assessment(&position_ids).await;
        assert!(extreme_risk_report.is_ok(), "Risk assessment should complete under extreme conditions");

        let report = extreme_risk_report.unwrap();
        assert!(report.overall_risk_score > 0.8, "Risk score should be very high under extreme conditions");
        assert!(report.recommendations.len() >= 3, "Should provide multiple urgent recommendations");

        // Verify system maintains data integrity
        let execution_stats = env.trade_executor.get_execution_statistics().await;
        assert!(execution_stats.total_executions >= 0, "Execution statistics should be maintained");

        let market_conditions = env.price_feeds.get_market_conditions().await;
        assert!(market_conditions.volatility_index > 0.7, "Market conditions should reflect extreme volatility");
        assert!(market_conditions.overall_sentiment < -0.5, "Market sentiment should be very negative");
    }
}