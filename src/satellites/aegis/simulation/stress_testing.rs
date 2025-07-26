use crate::security::{Vulnerability, VulnerabilitySeverity, VulnerabilityCategory};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use chrono::{DateTime, Utc, Duration};
use rust_decimal::Decimal;
use log::{info, warn, error, debug};
use rand::Rng;
use rand_distr::{Normal, Distribution};

/// Simulation scenario types
#[derive(Debug, Clone, Serialize, Deserialize, Eq, Hash, PartialEq)]
pub enum SimulationScenario {
    HistoricalMarketCrash,
    CryptoWinter,
    DeFiContagion,
    RegulatoryShock,
    BlackSwan,
}

/// Custom simulation scenario
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CustomScenario {
    pub name: String,
    pub description: String,
    pub price_shocks: HashMap<String, f64>, // Token -> price change percentage
    pub volume_shocks: HashMap<String, f64>, // Token -> volume change percentage
    pub volatility_multiplier: f64,
    pub correlation_breakdown: bool,
    pub liquidity_crisis: bool,
    pub duration_days: u32,
}

/// Portfolio position for simulation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SimulationPosition {
    pub token_address: String,
    pub quantity: f64,
    pub entry_price: f64,
    pub current_price: f64,
    pub collateral_value: f64,
    pub debt_value: f64,
    pub liquidation_threshold: f64,
    pub health_factor: f64,
}

/// Simulation result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SimulationResult {
    pub scenario: SimulationScenario,
    pub initial_portfolio_value: f64,
    pub final_portfolio_value: f64,
    pub max_drawdown: f64,
    pub var_95: f64, // Value at Risk at 95% confidence
    pub cvar_95: f64, // Conditional Value at Risk at 95% confidence
    pub liquidated_positions: Vec<String>,
    pub surviving_positions: Vec<String>,
    pub risk_metrics: RiskMetrics,
    pub recommendations: Vec<SimulationRecommendation>,
    pub simulation_duration_ms: u64,
    pub timestamp: DateTime<Utc>,
}

/// Risk metrics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RiskMetrics {
    pub sharpe_ratio: f64,
    pub sortino_ratio: f64,
    pub calmar_ratio: f64,
    pub max_drawdown_duration: u32,
    pub recovery_time_days: Option<u32>,
    pub volatility: f64,
    pub beta: f64,
    pub correlation_matrix: Vec<Vec<f64>>,
}

/// Simulation recommendation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SimulationRecommendation {
    pub recommendation_type: RecommendationType,
    pub priority: RecommendationPriority,
    pub description: String,
    pub expected_impact: f64,
    pub implementation_cost: f64,
    pub time_to_implement: u32, // days
    pub confidence: f64,
}

/// Recommendation types
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum RecommendationType {
    ReduceExposure,
    IncreaseCollateral,
    HedgeRisk,
    DiversifyPortfolio,
    AddStopLoss,
    RebalanceAllocation,
    Custom(String),
}

/// Recommendation priority
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum RecommendationPriority {
    Low,
    Medium,
    High,
    Critical,
}

/// Monte Carlo simulation configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MonteCarloConfig {
    pub iterations: u32,
    pub time_horizon_days: u32,
    pub confidence_level: f64,
    pub price_volatility: f64,
    pub correlation_matrix: Vec<Vec<f64>>,
    pub drift_rates: HashMap<String, f64>,
}

/// Stress testing configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StressTestingConfig {
    pub scenarios: Vec<SimulationScenario>,
    pub monte_carlo_config: MonteCarloConfig,
    pub backtesting_enabled: bool,
    pub historical_data_years: u32,
    pub enable_visualization: bool,
    pub auto_recommendations: bool,
}

impl Default for StressTestingConfig {
    fn default() -> Self {
        Self {
            scenarios: vec![
                SimulationScenario::HistoricalMarketCrash,
                SimulationScenario::CryptoWinter,
                SimulationScenario::DeFiContagion,
                SimulationScenario::RegulatoryShock,
                SimulationScenario::BlackSwan,
            ],
            monte_carlo_config: MonteCarloConfig {
                iterations: 10000,
                time_horizon_days: 30,
                confidence_level: 0.95,
                price_volatility: 0.5,
                correlation_matrix: vec![vec![1.0]],
                drift_rates: HashMap::new(),
            },
            backtesting_enabled: true,
            historical_data_years: 3,
            enable_visualization: true,
            auto_recommendations: true,
        }
    }
}

/// Stress Testing Framework
pub struct StressTestingFramework {
    config: StressTestingConfig,
    historical_data: Arc<RwLock<HashMap<String, Vec<HistoricalPricePoint>>>>,
    simulation_cache: Arc<RwLock<HashMap<String, SimulationResult>>>,
    scenario_templates: HashMap<SimulationScenario, ScenarioTemplate>,
}

/// Historical price point
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HistoricalPricePoint {
    pub timestamp: DateTime<Utc>,
    pub price: f64,
    pub volume: f64,
    pub market_cap: Option<f64>,
}

/// Scenario template
#[derive(Debug, Clone)]
pub struct ScenarioTemplate {
    pub name: String,
    pub price_shocks: HashMap<String, f64>,
    pub volume_shocks: HashMap<String, f64>,
    pub volatility_multiplier: f64,
    pub correlation_breakdown: bool,
    pub liquidity_crisis: bool,
    pub duration_days: u32,
}

impl StressTestingFramework {
    pub fn new(config: StressTestingConfig) -> Self {
        let mut scenario_templates = HashMap::new();
        
        // Historical market crash scenario
        scenario_templates.insert(
            SimulationScenario::HistoricalMarketCrash,
            ScenarioTemplate {
                name: "Historical Market Crash".to_string(),
                price_shocks: HashMap::from([
                    ("BTC".to_string(), -0.50),
                    ("ETH".to_string(), -0.60),
                    ("USDC".to_string(), -0.05),
                    ("USDT".to_string(), -0.10),
                ]),
                volume_shocks: HashMap::from([
                    ("BTC".to_string(), 3.0),
                    ("ETH".to_string(), 4.0),
                    ("USDC".to_string(), 2.0),
                    ("USDT".to_string(), 2.5),
                ]),
                volatility_multiplier: 3.0,
                correlation_breakdown: true,
                liquidity_crisis: true,
                duration_days: 30,
            }
        );

        // Crypto winter scenario
        scenario_templates.insert(
            SimulationScenario::CryptoWinter,
            ScenarioTemplate {
                name: "Crypto Winter".to_string(),
                price_shocks: HashMap::from([
                    ("BTC".to_string(), -0.80),
                    ("ETH".to_string(), -0.85),
                    ("USDC".to_string(), -0.02),
                    ("USDT".to_string(), -0.05),
                ]),
                volume_shocks: HashMap::from([
                    ("BTC".to_string(), 2.0),
                    ("ETH".to_string(), 2.5),
                    ("USDC".to_string(), 1.5),
                    ("USDT".to_string(), 1.8),
                ]),
                volatility_multiplier: 2.5,
                correlation_breakdown: true,
                liquidity_crisis: false,
                duration_days: 365,
            }
        );

        // DeFi contagion scenario
        scenario_templates.insert(
            SimulationScenario::DeFiContagion,
            ScenarioTemplate {
                name: "DeFi Contagion".to_string(),
                price_shocks: HashMap::from([
                    ("UNI".to_string(), -0.70),
                    ("AAVE".to_string(), -0.75),
                    ("COMP".to_string(), -0.80),
                    ("USDC".to_string(), -0.15),
                ]),
                volume_shocks: HashMap::from([
                    ("UNI".to_string(), 5.0),
                    ("AAVE".to_string(), 6.0),
                    ("COMP".to_string(), 7.0),
                    ("USDC".to_string(), 3.0),
                ]),
                volatility_multiplier: 4.0,
                correlation_breakdown: true,
                liquidity_crisis: true,
                duration_days: 14,
            }
        );

        // Regulatory shock scenario
        scenario_templates.insert(
            SimulationScenario::RegulatoryShock,
            ScenarioTemplate {
                name: "Regulatory Shock".to_string(),
                price_shocks: HashMap::from([
                    ("BTC".to_string(), -0.30),
                    ("ETH".to_string(), -0.40),
                    ("USDC".to_string(), -0.20),
                    ("USDT".to_string(), -0.25),
                ]),
                volume_shocks: HashMap::from([
                    ("BTC".to_string(), 2.5),
                    ("ETH".to_string(), 3.0),
                    ("USDC".to_string(), 2.0),
                    ("USDT".to_string(), 2.2),
                ]),
                volatility_multiplier: 2.0,
                correlation_breakdown: false,
                liquidity_crisis: false,
                duration_days: 7,
            }
        );

        // Black swan scenario
        scenario_templates.insert(
            SimulationScenario::BlackSwan,
            ScenarioTemplate {
                name: "Black Swan Event".to_string(),
                price_shocks: HashMap::from([
                    ("BTC".to_string(), -0.90),
                    ("ETH".to_string(), -0.95),
                    ("USDC".to_string(), -0.50),
                    ("USDT".to_string(), -0.60),
                ]),
                volume_shocks: HashMap::from([
                    ("BTC".to_string(), 10.0),
                    ("ETH".to_string(), 12.0),
                    ("USDC".to_string(), 8.0),
                    ("USDT".to_string(), 9.0),
                ]),
                volatility_multiplier: 5.0,
                correlation_breakdown: true,
                liquidity_crisis: true,
                duration_days: 3,
            }
        );

        Self {
            config,
            historical_data: Arc::new(RwLock::new(HashMap::new())),
            simulation_cache: Arc::new(RwLock::new(HashMap::new())),
            scenario_templates,
        }
    }

    /// Run stress test simulation
    pub async fn run_stress_test(
        &self,
        positions: &[SimulationPosition],
        scenario: &SimulationScenario,
    ) -> Result<SimulationResult, Box<dyn std::error::Error + Send + Sync>> {
        let start_time = std::time::Instant::now();
        
        // Check cache first
        let cache_key = self.generate_cache_key(positions, scenario).await?;
        if let Some(cached_result) = self.get_cached_simulation(&cache_key).await? {
            return Ok(cached_result);
        }

        let initial_portfolio_value = self.calculate_portfolio_value(positions).await?;
        
        // Apply scenario shocks
        let shocked_positions = self.apply_scenario_shocks(positions, scenario).await?;
        
        // Calculate final portfolio value
        let final_portfolio_value = self.calculate_portfolio_value(&shocked_positions).await?;
        
        // Identify liquidated positions
        let (liquidated, surviving) = self.identify_liquidated_positions(&shocked_positions).await?;
        
        // Calculate risk metrics
        let risk_metrics = self.calculate_risk_metrics(positions, &shocked_positions).await?;
        
        // Generate recommendations
        let recommendations = if self.config.auto_recommendations {
            self.generate_recommendations(positions, &risk_metrics, &liquidated).await?
        } else {
            Vec::new()
        };

        let simulation_duration = start_time.elapsed().as_millis() as u64;
        
        let result = SimulationResult {
            scenario: scenario.clone(),
            initial_portfolio_value,
            final_portfolio_value,
            max_drawdown: (final_portfolio_value - initial_portfolio_value) / initial_portfolio_value,
            var_95: self.calculate_var_95(positions, scenario).await?,
            cvar_95: self.calculate_cvar_95(positions, scenario).await?,
            liquidated_positions: liquidated.iter().map(|p| p.token_address.clone()).collect(),
            surviving_positions: surviving.iter().map(|p| p.token_address.clone()).collect(),
            risk_metrics,
            recommendations,
            simulation_duration_ms: simulation_duration,
            timestamp: Utc::now(),
        };

        // Cache the result
        self.cache_simulation(&cache_key, &result).await?;
        
        Ok(result)
    }

    /// Run Monte Carlo simulation
    pub async fn run_monte_carlo_simulation(
        &self,
        positions: &[SimulationPosition],
        config: &MonteCarloConfig,
    ) -> Result<Vec<SimulationResult>, Box<dyn std::error::Error + Send + Sync>> {
        let mut results = Vec::new();
        let mut rng = rand::thread_rng();
        
        for i in 0..config.iterations {
            // Generate random price movements
            let simulated_positions = self.simulate_price_movements(positions, config, &mut rng).await?;
            
            // Calculate portfolio performance
            let initial_value = self.calculate_portfolio_value(positions).await?;
            let final_value = self.calculate_portfolio_value(&simulated_positions).await?;
            
            let result = SimulationResult {
                scenario: SimulationScenario::Custom(CustomScenario {
                    name: format!("Monte Carlo Iteration {}", i),
                    description: "Monte Carlo simulation iteration".to_string(),
                    price_shocks: HashMap::new(),
                    volume_shocks: HashMap::new(),
                    volatility_multiplier: 1.0,
                    correlation_breakdown: false,
                    liquidity_crisis: false,
                    duration_days: config.time_horizon_days,
                }),
                initial_portfolio_value: initial_value,
                final_portfolio_value: final_value,
                max_drawdown: (final_value - initial_value) / initial_value,
                var_95: 0.0, // Will be calculated from all results
                cvar_95: 0.0, // Will be calculated from all results
                liquidated_positions: Vec::new(),
                surviving_positions: simulated_positions.iter().map(|p| p.token_address.clone()).collect(),
                risk_metrics: RiskMetrics {
                    sharpe_ratio: 0.0,
                    sortino_ratio: 0.0,
                    calmar_ratio: 0.0,
                    max_drawdown_duration: 0,
                    recovery_time_days: None,
                    volatility: 0.0,
                    beta: 0.0,
                    correlation_matrix: vec![],
                },
                recommendations: Vec::new(),
                simulation_duration_ms: 0,
                timestamp: Utc::now(),
            };
            
            results.push(result);
        }
        
        // Calculate VaR and CVaR from all results
        let returns: Vec<f64> = results.iter()
            .map(|r| (r.final_portfolio_value - r.initial_portfolio_value) / r.initial_portfolio_value)
            .collect();
        
        let var_95 = self.calculate_var_from_returns(&returns, 0.95).await?;
        let cvar_95 = self.calculate_cvar_from_returns(&returns, 0.95).await?;
        
        // Update all results with calculated VaR and CVaR
        for result in &mut results {
            result.var_95 = var_95;
            result.cvar_95 = cvar_95;
        }
        
        Ok(results)
    }

    /// Run backtesting simulation
    pub async fn run_backtesting(
        &self,
        positions: &[SimulationPosition],
        start_date: DateTime<Utc>,
        end_date: DateTime<Utc>,
    ) -> Result<SimulationResult, Box<dyn std::error::Error + Send + Sync>> {
        let historical_data = self.historical_data.read().await;
        
        // Simulate portfolio performance using historical data
        let mut current_positions = positions.to_vec();
        let mut portfolio_values = Vec::new();
        
        let mut current_date = start_date;
        while current_date <= end_date {
            // Apply historical price changes
            for position in &mut current_positions {
                if let Some(price_data) = historical_data.get(&position.token_address) {
                    if let Some(price_point) = price_data.iter().find(|p| p.timestamp >= current_date) {
                        position.current_price = price_point.price;
                        position.collateral_value = position.quantity * position.current_price;
                        position.health_factor = position.collateral_value / position.debt_value;
                    }
                }
            }
            
            let portfolio_value = self.calculate_portfolio_value(&current_positions).await?;
            portfolio_values.push(portfolio_value);
            
            current_date += Duration::days(1);
        }
        
        let initial_value = portfolio_values.first().unwrap_or(&0.0);
        let final_value = portfolio_values.last().unwrap_or(&0.0);
        let max_drawdown = self.calculate_max_drawdown(&portfolio_values).await?;
        
        Ok(SimulationResult {
            scenario: SimulationScenario::Custom(CustomScenario {
                name: "Historical Backtesting".to_string(),
                description: format!("Backtesting from {} to {}", start_date, end_date),
                price_shocks: HashMap::new(),
                volume_shocks: HashMap::new(),
                volatility_multiplier: 1.0,
                correlation_breakdown: false,
                liquidity_crisis: false,
                duration_days: (end_date - start_date).num_days() as u32,
            }),
            initial_portfolio_value: *initial_value,
            final_portfolio_value: *final_value,
            max_drawdown,
            var_95: 0.0, // Would need more sophisticated calculation
            cvar_95: 0.0, // Would need more sophisticated calculation
            liquidated_positions: Vec::new(),
            surviving_positions: current_positions.iter().map(|p| p.token_address.clone()).collect(),
            risk_metrics: RiskMetrics {
                sharpe_ratio: 0.0,
                sortino_ratio: 0.0,
                calmar_ratio: 0.0,
                max_drawdown_duration: 0,
                recovery_time_days: None,
                volatility: 0.0,
                beta: 0.0,
                correlation_matrix: vec![],
            },
            recommendations: Vec::new(),
            simulation_duration_ms: 0,
            timestamp: Utc::now(),
        })
    }

    /// Generate cache key for simulation
    async fn generate_cache_key(&self, positions: &[SimulationPosition], scenario: &SimulationScenario) -> Result<String, Box<dyn std::error::Error + Send + Sync>> {
        use std::collections::hash_map::DefaultHasher;
        use std::hash::{Hash, Hasher};
        
        let mut hasher = DefaultHasher::new();
        format!("{:?}", scenario).hash(&mut hasher);
        
        for position in positions {
            position.token_address.hash(&mut hasher);
            (position.quantity as u64).hash(&mut hasher);
            (position.current_price as u64).hash(&mut hasher);
        }
        
        Ok(format!("simulation_{:x}", hasher.finish()))
    }

    /// Get cached simulation result
    async fn get_cached_simulation(&self, cache_key: &str) -> Result<Option<SimulationResult>, Box<dyn std::error::Error + Send + Sync>> {
        let cache = self.simulation_cache.read().await;
        if let Some(cached) = cache.get(cache_key) {
            // Check if cache is still valid (within 1 hour)
            if Utc::now() - cached.timestamp < Duration::hours(1) {
                return Ok(Some(cached.clone()));
            }
        }
        Ok(None)
    }

    /// Cache simulation result
    async fn cache_simulation(&self, cache_key: &str, result: &SimulationResult) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let mut cache = self.simulation_cache.write().await;
        cache.insert(cache_key.to_string(), result.clone());
        Ok(())
    }

    /// Calculate portfolio value
    async fn calculate_portfolio_value(&self, positions: &[SimulationPosition]) -> Result<f64, Box<dyn std::error::Error + Send + Sync>> {
        let total_value: f64 = positions.iter()
            .map(|p| p.collateral_value - p.debt_value)
            .sum();
        Ok(total_value)
    }

    /// Apply scenario shocks to positions
    async fn apply_scenario_shocks(&self, positions: &[SimulationPosition], scenario: &SimulationScenario) -> Result<Vec<SimulationPosition>, Box<dyn std::error::Error + Send + Sync>> {
        let mut shocked_positions = positions.to_vec();
        
        if let Some(template) = self.scenario_templates.get(scenario) {
            for position in &mut shocked_positions {
                if let Some(price_shock) = template.price_shocks.get(&position.token_address) {
                    let shock_multiplier = 1.0 + price_shock;
                    position.current_price *= shock_multiplier;
                    position.collateral_value = position.quantity * position.current_price;
                    position.health_factor = position.collateral_value / position.debt_value;
                }
            }
        }
        
        Ok(shocked_positions)
    }

    /// Identify liquidated positions
    async fn identify_liquidated_positions(&self, positions: &[SimulationPosition]) -> Result<(Vec<SimulationPosition>, Vec<SimulationPosition>), Box<dyn std::error::Error + Send + Sync>> {
        let mut liquidated = Vec::new();
        let mut surviving = Vec::new();
        
        for position in positions {
            if position.health_factor < position.liquidation_threshold {
                liquidated.push(position.clone());
            } else {
                surviving.push(position.clone());
            }
        }
        
        Ok((liquidated, surviving))
    }

    /// Calculate risk metrics
    async fn calculate_risk_metrics(&self, initial_positions: &[SimulationPosition], final_positions: &[SimulationPosition]) -> Result<RiskMetrics, Box<dyn std::error::Error + Send + Sync>> {
        let initial_value = self.calculate_portfolio_value(initial_positions).await?;
        let final_value = self.calculate_portfolio_value(final_positions).await?;
        
        let return_rate = (final_value - initial_value) / initial_value;
        let volatility = 0.5; // Simplified calculation
        let risk_free_rate = 0.02; // 2% risk-free rate
        
        let sharpe_ratio = if volatility > 0.0 {
            (return_rate - risk_free_rate) / volatility
        } else {
            0.0
        };
        
        Ok(RiskMetrics {
            sharpe_ratio,
            sortino_ratio: sharpe_ratio, // Simplified
            calmar_ratio: 0.0, // Would need more data
            max_drawdown_duration: 0,
            recovery_time_days: None,
            volatility,
            beta: 1.0, // Simplified
            correlation_matrix: vec![vec![1.0]],
        })
    }

    /// Generate recommendations
    async fn generate_recommendations(
        &self,
        positions: &[SimulationPosition],
        risk_metrics: &RiskMetrics,
        liquidated_positions: &[SimulationPosition],
    ) -> Result<Vec<SimulationRecommendation>, Box<dyn std::error::Error + Send + Sync>> {
        let mut recommendations = Vec::new();
        
        // Check for high liquidation risk
        if !liquidated_positions.is_empty() {
            recommendations.push(SimulationRecommendation {
                recommendation_type: RecommendationType::IncreaseCollateral,
                priority: RecommendationPriority::Critical,
                description: format!("{} positions were liquidated in simulation", liquidated_positions.len()),
                expected_impact: 0.8,
                implementation_cost: 1000.0,
                time_to_implement: 1,
                confidence: 0.9,
            });
        }
        
        // Check for poor risk-adjusted returns
        if risk_metrics.sharpe_ratio < 0.5 {
            recommendations.push(SimulationRecommendation {
                recommendation_type: RecommendationType::RebalanceAllocation,
                priority: RecommendationPriority::High,
                description: "Portfolio shows poor risk-adjusted returns".to_string(),
                expected_impact: 0.3,
                implementation_cost: 500.0,
                time_to_implement: 7,
                confidence: 0.7,
            });
        }
        
        // Check for high volatility
        if risk_metrics.volatility > 0.8 {
            recommendations.push(SimulationRecommendation {
                recommendation_type: RecommendationType::HedgeRisk,
                priority: RecommendationPriority::Medium,
                description: "Portfolio volatility is high, consider hedging".to_string(),
                expected_impact: 0.2,
                implementation_cost: 200.0,
                time_to_implement: 3,
                confidence: 0.6,
            });
        }
        
        Ok(recommendations)
    }

    /// Calculate VaR at 95% confidence
    async fn calculate_var_95(&self, positions: &[SimulationPosition], scenario: &SimulationScenario) -> Result<f64, Box<dyn std::error::Error + Send + Sync>> {
        // Simplified VaR calculation
        let portfolio_value = self.calculate_portfolio_value(positions).await?;
        let volatility = 0.5; // Simplified
        let var_95 = -1.645 * volatility * portfolio_value; // 95% confidence level
        Ok(var_95)
    }

    /// Calculate CVaR at 95% confidence
    async fn calculate_cvar_95(&self, positions: &[SimulationPosition], scenario: &SimulationScenario) -> Result<f64, Box<dyn std::error::Error + Send + Sync>> {
        // Simplified CVaR calculation
        let var_95 = self.calculate_var_95(positions, scenario).await?;
        let cvar_95 = var_95 * 1.25; // Simplified relationship
        Ok(cvar_95)
    }

    /// Simulate price movements for Monte Carlo
    async fn simulate_price_movements(
        &self,
        positions: &[SimulationPosition],
        config: &MonteCarloConfig,
        rng: &mut impl Rng,
    ) -> Result<Vec<SimulationPosition>, Box<dyn std::error::Error + Send + Sync>> {
        let mut simulated_positions = positions.to_vec();
        
        for position in &mut simulated_positions {
            // Generate random price movement using normal distribution
            let normal = Normal::new(0.0, config.price_volatility)?;
            let price_change = normal.sample(rng);
            
            position.current_price *= (1.0 + price_change).max(0.01); // Prevent negative prices
            position.collateral_value = position.quantity * position.current_price;
            position.health_factor = position.collateral_value / position.debt_value;
        }
        
        Ok(simulated_positions)
    }

    /// Calculate VaR from returns
    async fn calculate_var_from_returns(&self, returns: &[f64], confidence_level: f64) -> Result<f64, Box<dyn std::error::Error + Send + Sync>> {
        let mut sorted_returns = returns.to_vec();
        sorted_returns.sort_by(|a, b| a.partial_cmp(b).unwrap());
        
        let index = ((1.0 - confidence_level) * returns.len() as f64) as usize;
        let var = sorted_returns.get(index).unwrap_or(&0.0);
        
        Ok(*var)
    }

    /// Calculate CVaR from returns
    async fn calculate_cvar_from_returns(&self, returns: &[f64], confidence_level: f64) -> Result<f64, Box<dyn std::error::Error + Send + Sync>> {
        let var = self.calculate_var_from_returns(returns, confidence_level).await?;
        
        let tail_returns: Vec<f64> = returns.iter()
            .filter(|&&r| r <= var)
            .cloned()
            .collect();
        
        if tail_returns.is_empty() {
            return Ok(var);
        }
        
        let cvar = tail_returns.iter().sum::<f64>() / tail_returns.len() as f64;
        Ok(cvar)
    }

    /// Calculate maximum drawdown
    async fn calculate_max_drawdown(&self, portfolio_values: &[f64]) -> Result<f64, Box<dyn std::error::Error + Send + Sync>> {
        if portfolio_values.is_empty() {
            return Ok(0.0);
        }
        
        let mut max_drawdown = 0.0;
        let mut peak = portfolio_values[0];
        
        for &value in portfolio_values {
            if value > peak {
                peak = value;
            }
            
            let drawdown = (value - peak) / peak;
            if drawdown < max_drawdown {
                max_drawdown = drawdown;
            }
        }
        
        Ok(max_drawdown)
    }

    /// Clear simulation cache
    pub async fn clear_cache(&self) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let mut cache = self.simulation_cache.write().await;
        cache.clear();
        info!("Simulation cache cleared");
        Ok(())
    }

    /// Get cache statistics
    pub async fn get_cache_stats(&self) -> Result<HashMap<String, usize>, Box<dyn std::error::Error + Send + Sync>> {
        let cache = self.simulation_cache.read().await;
        Ok(HashMap::from([
            ("simulation_cache_entries".to_string(), cache.len()),
        ]))
    }
}

impl Default for StressTestingFramework {
    fn default() -> Self {
        Self::new(StressTestingConfig::default())
    }
}

#[cfg(test)]
mod tests; 