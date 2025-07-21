pub mod types;
pub mod liquidation;
pub mod risk;
pub mod monitoring;
pub mod security;
pub mod intelligence;
pub mod data;
pub mod simulation;

use crate::liquidation::{LiquidationMonitor, PriceFeedProvider};
use crate::risk::{PriceImpactSimulator, AutomatedPositionManager, TradeExecutor};
use crate::monitoring::EscalatingAlertSystem;
use crate::simulation::{
    StressTestingFramework, 
    StressTestingConfig, 
    SimulationPosition, 
    SimulationScenario,
    VisualizationFramework,
    SimulationReport,
};
use crate::types::*;
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{info, error, warn};
use rust_decimal::prelude::ToPrimitive;

pub struct AegisSatellite {
    liquidation_monitor: Arc<LiquidationMonitor>,
    price_impact_simulator: Arc<PriceImpactSimulator>,
    alert_system: Arc<EscalatingAlertSystem>,
    position_manager: Arc<AutomatedPositionManager>,
    stress_testing_framework: Arc<StressTestingFramework>,
    visualization_framework: Arc<VisualizationFramework>,
    config: Arc<RwLock<AegisConfig>>,
}

#[derive(Debug, Clone)]
pub struct AegisConfig {
    pub monitoring_interval_secs: u64,
    pub enable_automated_actions: bool,
    pub enable_price_impact_simulation: bool,
    pub enable_smart_contract_analysis: bool,
    pub enable_mev_protection: bool,
    pub max_concurrent_positions: usize,
}

impl Default for AegisConfig {
    fn default() -> Self {
        Self {
            monitoring_interval_secs: 30,
            enable_automated_actions: true,
            enable_price_impact_simulation: true,
            enable_smart_contract_analysis: true,
            enable_mev_protection: true,
            max_concurrent_positions: 1000,
        }
    }
}

impl AegisSatellite {
    pub async fn new(
        price_feeds: Arc<dyn PriceFeedProvider>,
        trade_executor: Arc<dyn TradeExecutor>,
        config: Option<AegisConfig>,
    ) -> Result<Self, Box<dyn std::error::Error + Send + Sync>> {
        let config = Arc::new(RwLock::new(config.unwrap_or_default()));
        
        // Initialize alert system
        let alert_system = Arc::new(EscalatingAlertSystem::new(
            monitoring::AlertConfiguration::default()
        ));

        // Initialize liquidation monitor
        let liquidation_monitor = Arc::new(LiquidationMonitor::new(
            price_feeds.clone(),
            alert_system.clone(),
        ));

        // Initialize price impact simulator
        let price_impact_simulator = Arc::new(PriceImpactSimulator::new(
            Box::new(MockHistoricalDataProvider)
        ));

        // Initialize automated position manager
        let position_manager = Arc::new(AutomatedPositionManager::new(
            liquidation_monitor.clone(),
            price_impact_simulator.clone(),
            alert_system.clone(),
            trade_executor,
        ));

        // Initialize stress testing framework
        let stress_testing_config = StressTestingConfig::default();
        let stress_testing_framework = Arc::new(StressTestingFramework::new(stress_testing_config));

        // Initialize visualization framework
        let visualization_framework = Arc::new(VisualizationFramework::new());

        info!("Aegis Satellite initialized successfully");

        Ok(Self {
            liquidation_monitor,
            price_impact_simulator,
            alert_system,
            position_manager,
            stress_testing_framework,
            visualization_framework,
            config,
        })
    }

    pub async fn start(&self) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        info!("Starting Aegis Satellite monitoring systems...");

        let config = self.config.read().await;
        
        // Start position monitoring
        let position_manager = self.position_manager.clone();
        tokio::spawn(async move {
            position_manager.start_monitoring().await;
        });

        // Start periodic health checks
        let liquidation_monitor = self.liquidation_monitor.clone();
        let monitoring_interval = config.monitoring_interval_secs;
        tokio::spawn(async move {
            let mut interval = tokio::time::interval(
                std::time::Duration::from_secs(monitoring_interval)
            );
            
            loop {
                interval.tick().await;
                match liquidation_monitor.monitor_positions().await {
                    Ok(alerts) => {
                        if !alerts.is_empty() {
                            info!("Generated {} risk alerts", alerts.len());
                        }
                    }
                    Err(e) => {
                        error!("Error during position monitoring: {}", e);
                    }
                }
            }
        });

        info!("Aegis Satellite started successfully");
        Ok(())
    }

    pub async fn add_position(&self, position: Position) -> Result<PositionId, PositionError> {
        self.liquidation_monitor.add_position(position).await
    }

    pub async fn update_position(&self, position: Position) -> Result<(), PositionError> {
        self.liquidation_monitor.update_position(position).await
    }

    pub async fn remove_position(&self, position_id: PositionId) -> Result<Position, PositionError> {
        self.liquidation_monitor.remove_position(position_id)
    }

    pub async fn get_position_health(&self, position_id: PositionId) -> Result<HealthFactor, CalculationError> {
        self.liquidation_monitor.calculate_health(position_id).await
    }

    pub async fn simulate_trade_impact(
        &self,
        position_id: PositionId,
        token_address: &str,
        amount: rust_decimal::Decimal,
    ) -> Result<risk::TradeSimulation, risk::PriceImpactError> {
        self.price_impact_simulator
            .simulate_liquidation_trade(position_id, token_address, amount)
            .await
    }

    pub async fn get_alerts(&self, position_id: Option<PositionId>) -> Result<Vec<RiskAlert>, Box<dyn std::error::Error + Send + Sync>> {
        self.alert_system.get_alerts(position_id).await
    }

    pub async fn acknowledge_alert(&self, alert_id: uuid::Uuid) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        self.alert_system.acknowledge_alert(alert_id).await
    }

    pub fn get_statistics(&self) -> AegisStatistics {
        AegisStatistics {
            total_positions: self.liquidation_monitor.position_count(),
            active_alerts: self.alert_system.active_alerts.len(),
            supported_protocols: liquidation::HealthCalculatorFactory::supported_protocols().len(),
        }
    }

    // Simulation and Stress Testing API Methods

    /// Run a stress test on the given positions with a specific scenario
    pub async fn run_stress_test(
        &self,
        positions: &[SimulationPosition],
        scenario: &SimulationScenario,
    ) -> Result<simulation::SimulationResult, Box<dyn std::error::Error + Send + Sync>> {
        self.stress_testing_framework.run_stress_test(positions, scenario).await
    }

    /// Run Monte Carlo simulation on the given positions
    pub async fn run_monte_carlo_simulation(
        &self,
        positions: &[SimulationPosition],
        config: &simulation::MonteCarloConfig,
    ) -> Result<Vec<simulation::SimulationResult>, Box<dyn std::error::Error + Send + Sync>> {
        self.stress_testing_framework.run_monte_carlo_simulation(positions, config).await
    }

    /// Run backtesting on historical data
    pub async fn run_backtesting(
        &self,
        positions: &[SimulationPosition],
        start_date: chrono::DateTime<chrono::Utc>,
        end_date: chrono::DateTime<chrono::Utc>,
    ) -> Result<simulation::SimulationResult, Box<dyn std::error::Error + Send + Sync>> {
        self.stress_testing_framework.run_backtesting(positions, start_date, end_date).await
    }

    /// Get cache statistics for the simulation framework
    pub async fn get_simulation_cache_stats(&self) -> Result<std::collections::HashMap<String, usize>, Box<dyn std::error::Error + Send + Sync>> {
        self.stress_testing_framework.get_cache_stats().await
    }

    /// Clear the simulation cache
    pub async fn clear_simulation_cache(&self) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        self.stress_testing_framework.clear_cache().await
    }

    /// Convert real positions to simulation positions for testing
    pub async fn convert_positions_to_simulation(
        &self,
        position_ids: &[PositionId],
    ) -> Result<Vec<SimulationPosition>, Box<dyn std::error::Error + Send + Sync>> {
        let mut simulation_positions = Vec::new();
        
        for position_id in position_ids {
            match self.get_position_health(*position_id).await {
                Ok(health_factor) => {
                    // Get position details from liquidation monitor
                    // This is a simplified conversion - in practice, you'd get full position data
                    let simulation_position = SimulationPosition {
                        token_address: format!("position_{}", position_id),
                        quantity: 1.0, // Placeholder
                        entry_price: 100.0, // Placeholder
                        current_price: 100.0, // Placeholder
                        collateral_value: health_factor.collateral_value.to_f64().unwrap_or(0.0),
                        debt_value: health_factor.debt_value.to_f64().unwrap_or(0.0),
                        liquidation_threshold: health_factor.liquidation_threshold.to_f64().unwrap_or(0.0),
                        health_factor: health_factor.health_factor.to_f64().unwrap_or(0.0),
                    };
                    simulation_positions.push(simulation_position);
                }
                Err(e) => {
                    warn!("Failed to get health for position {}: {}", position_id, e);
                }
            }
        }
        
        Ok(simulation_positions)
    }

    // Visualization and Reporting API Methods

    /// Generate a comprehensive simulation report
    pub async fn generate_simulation_report(
        &self,
        simulation_result: &simulation::SimulationResult,
        template_name: &str,
    ) -> Result<SimulationReport, Box<dyn std::error::Error + Send + Sync>> {
        self.visualization_framework.generate_report(simulation_result, template_name).await
    }

    /// Export simulation report to JSON format
    pub async fn export_report_json(
        &self,
        report: &SimulationReport,
    ) -> Result<String, Box<dyn std::error::Error + Send + Sync>> {
        self.visualization_framework.export_report_json(report).await
    }

    /// Export simulation report to CSV format
    pub async fn export_report_csv(
        &self,
        report: &SimulationReport,
    ) -> Result<String, Box<dyn std::error::Error + Send + Sync>> {
        self.visualization_framework.export_report_csv(report).await
    }

    /// Get available report templates
    pub fn get_report_templates(&self) -> Vec<String> {
        self.visualization_framework.get_report_templates()
    }

    /// Get available chart templates
    pub fn get_chart_templates(&self) -> Vec<String> {
        self.visualization_framework.get_chart_templates()
    }
}

#[derive(Debug, Clone)]
pub struct AegisStatistics {
    pub total_positions: usize,
    pub active_alerts: usize,
    pub supported_protocols: usize,
}

// Mock implementation for testing
struct MockHistoricalDataProvider;

#[async_trait::async_trait]
impl risk::HistoricalDataProvider for MockHistoricalDataProvider {
    async fn get_historical_prices(&self, _token_address: &str, _days: u32) -> Result<Vec<rust_decimal::Decimal>, Box<dyn std::error::Error + Send + Sync>> {
        // Return mock historical data
        Ok(vec![
            rust_decimal::Decimal::from(100),
            rust_decimal::Decimal::from(105),
            rust_decimal::Decimal::from(95),
            rust_decimal::Decimal::from(110),
            rust_decimal::Decimal::from(90),
        ])
    }
}