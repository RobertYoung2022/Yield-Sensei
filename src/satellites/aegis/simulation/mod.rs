pub mod stress_testing;
pub mod visualization;

pub use stress_testing::{
    StressTestingFramework,
    StressTestingConfig,
    SimulationPosition,
    SimulationScenario,
    SimulationResult,
    RiskMetrics,
    SimulationRecommendation,
    MonteCarloConfig,
    CustomScenario,
    RecommendationType,
    RecommendationPriority,
};

pub use visualization::{
    VisualizationFramework,
    SimulationReport,
    PortfolioChartData,
    RiskHeatmapData,
    ChartDataPoint,
}; 