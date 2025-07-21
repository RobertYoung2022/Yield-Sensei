use super::stress_testing::{SimulationResult, RiskMetrics, SimulationRecommendation, SimulationScenario};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use chrono::{DateTime, Utc};
use log::{info, warn};

/// Chart data point for visualization
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChartDataPoint {
    pub timestamp: DateTime<Utc>,
    pub value: f64,
    pub label: Option<String>,
}

/// Portfolio performance chart data
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PortfolioChartData {
    pub portfolio_values: Vec<ChartDataPoint>,
    pub drawdown_curve: Vec<ChartDataPoint>,
    pub risk_metrics: Vec<ChartDataPoint>,
    pub position_performance: HashMap<String, Vec<ChartDataPoint>>,
}

/// Risk heatmap data
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RiskHeatmapData {
    pub correlation_matrix: Vec<Vec<f64>>,
    pub asset_names: Vec<String>,
    pub risk_scores: HashMap<String, f64>,
    pub concentration_metrics: HashMap<String, f64>,
}

/// Simulation report structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SimulationReport {
    pub report_id: String,
    pub timestamp: DateTime<Utc>,
    pub scenario: SimulationScenario,
    pub summary: ReportSummary,
    pub risk_analysis: RiskAnalysis,
    pub recommendations: Vec<SimulationRecommendation>,
    pub charts: PortfolioChartData,
    pub heatmaps: RiskHeatmapData,
    pub metadata: ReportMetadata,
}

/// Report summary
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReportSummary {
    pub initial_portfolio_value: f64,
    pub final_portfolio_value: f64,
    pub total_return: f64,
    pub max_drawdown: f64,
    pub var_95: f64,
    pub cvar_95: f64,
    pub liquidated_positions_count: usize,
    pub surviving_positions_count: usize,
    pub simulation_duration_ms: u64,
}

/// Risk analysis section
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RiskAnalysis {
    pub sharpe_ratio: f64,
    pub sortino_ratio: f64,
    pub calmar_ratio: f64,
    pub volatility: f64,
    pub beta: f64,
    pub max_drawdown_duration: u32,
    pub recovery_time_days: Option<u32>,
    pub risk_decomposition: HashMap<String, f64>,
    pub stress_test_results: HashMap<String, f64>,
}

/// Report metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReportMetadata {
    pub simulation_parameters: HashMap<String, String>,
    pub data_sources: Vec<String>,
    pub model_version: String,
    pub generated_by: String,
    pub confidence_level: f64,
}

/// Visualization and reporting framework
pub struct VisualizationFramework {
    chart_templates: HashMap<String, ChartTemplate>,
    report_templates: HashMap<String, ReportTemplate>,
}

/// Chart template
#[derive(Debug, Clone)]
pub struct ChartTemplate {
    pub name: String,
    pub chart_type: ChartType,
    pub default_config: ChartConfig,
}

/// Chart types
#[derive(Debug, Clone)]
pub enum ChartType {
    LineChart,
    BarChart,
    ScatterPlot,
    Heatmap,
    PieChart,
    Candlestick,
}

/// Chart configuration
#[derive(Debug, Clone)]
pub struct ChartConfig {
    pub title: String,
    pub x_axis_label: String,
    pub y_axis_label: String,
    pub colors: Vec<String>,
    pub show_legend: bool,
    pub show_grid: bool,
}

/// Report template
#[derive(Debug, Clone)]
pub struct ReportTemplate {
    pub name: String,
    pub sections: Vec<ReportSection>,
    pub styling: ReportStyling,
}

/// Report section
#[derive(Debug, Clone)]
pub struct ReportSection {
    pub title: String,
    pub content_type: SectionContentType,
    pub required: bool,
}

/// Section content types
#[derive(Debug, Clone)]
pub enum SectionContentType {
    Summary,
    RiskAnalysis,
    Recommendations,
    Charts,
    Heatmaps,
    Metadata,
}

/// Report styling
#[derive(Debug, Clone)]
pub struct ReportStyling {
    pub theme: String,
    pub primary_color: String,
    pub secondary_color: String,
    pub font_family: String,
    pub font_size: u32,
}

impl VisualizationFramework {
    pub fn new() -> Self {
        let mut chart_templates = HashMap::new();
        let mut report_templates = HashMap::new();

        // Initialize chart templates
        chart_templates.insert(
            "portfolio_performance".to_string(),
            ChartTemplate {
                name: "Portfolio Performance".to_string(),
                chart_type: ChartType::LineChart,
                default_config: ChartConfig {
                    title: "Portfolio Value Over Time".to_string(),
                    x_axis_label: "Time".to_string(),
                    y_axis_label: "Portfolio Value ($)".to_string(),
                    colors: vec!["#1f77b4".to_string(), "#ff7f0e".to_string()],
                    show_legend: true,
                    show_grid: true,
                },
            },
        );

        chart_templates.insert(
            "drawdown_analysis".to_string(),
            ChartTemplate {
                name: "Drawdown Analysis".to_string(),
                chart_type: ChartType::LineChart,
                default_config: ChartConfig {
                    title: "Portfolio Drawdown".to_string(),
                    x_axis_label: "Time".to_string(),
                    y_axis_label: "Drawdown (%)".to_string(),
                    colors: vec!["#d62728".to_string()],
                    show_legend: true,
                    show_grid: true,
                },
            },
        );

        chart_templates.insert(
            "risk_heatmap".to_string(),
            ChartTemplate {
                name: "Risk Heatmap".to_string(),
                chart_type: ChartType::Heatmap,
                default_config: ChartConfig {
                    title: "Asset Correlation Matrix".to_string(),
                    x_axis_label: "Assets".to_string(),
                    y_axis_label: "Assets".to_string(),
                    colors: vec!["#ffffff".to_string(), "#ff0000".to_string()],
                    show_legend: true,
                    show_grid: false,
                },
            },
        );

        // Initialize report templates
        report_templates.insert(
            "standard_report".to_string(),
            ReportTemplate {
                name: "Standard Simulation Report".to_string(),
                sections: vec![
                    ReportSection {
                        title: "Executive Summary".to_string(),
                        content_type: SectionContentType::Summary,
                        required: true,
                    },
                    ReportSection {
                        title: "Risk Analysis".to_string(),
                        content_type: SectionContentType::RiskAnalysis,
                        required: true,
                    },
                    ReportSection {
                        title: "Recommendations".to_string(),
                        content_type: SectionContentType::Recommendations,
                        required: true,
                    },
                    ReportSection {
                        title: "Performance Charts".to_string(),
                        content_type: SectionContentType::Charts,
                        required: true,
                    },
                    ReportSection {
                        title: "Risk Heatmaps".to_string(),
                        content_type: SectionContentType::Heatmaps,
                        required: false,
                    },
                    ReportSection {
                        title: "Methodology".to_string(),
                        content_type: SectionContentType::Metadata,
                        required: false,
                    },
                ],
                styling: ReportStyling {
                    theme: "professional".to_string(),
                    primary_color: "#1f77b4".to_string(),
                    secondary_color: "#ff7f0e".to_string(),
                    font_family: "Arial, sans-serif".to_string(),
                    font_size: 12,
                },
            },
        );

        Self {
            chart_templates,
            report_templates,
        }
    }

    /// Generate a comprehensive simulation report
    pub async fn generate_report(
        &self,
        simulation_result: &SimulationResult,
        template_name: &str,
    ) -> Result<SimulationReport, Box<dyn std::error::Error + Send + Sync>> {
        info!("Generating simulation report for scenario: {:?}", simulation_result.scenario);

        let template = self.report_templates.get(template_name)
            .ok_or("Report template not found")?;

        let report_id = format!("sim_report_{}", Utc::now().timestamp());

        let summary = ReportSummary {
            initial_portfolio_value: simulation_result.initial_portfolio_value,
            final_portfolio_value: simulation_result.final_portfolio_value,
            total_return: (simulation_result.final_portfolio_value - simulation_result.initial_portfolio_value) / simulation_result.initial_portfolio_value,
            max_drawdown: simulation_result.max_drawdown,
            var_95: simulation_result.var_95,
            cvar_95: simulation_result.cvar_95,
            liquidated_positions_count: simulation_result.liquidated_positions.len(),
            surviving_positions_count: simulation_result.surviving_positions.len(),
            simulation_duration_ms: simulation_result.simulation_duration_ms,
        };

        let risk_analysis = RiskAnalysis {
            sharpe_ratio: simulation_result.risk_metrics.sharpe_ratio,
            sortino_ratio: simulation_result.risk_metrics.sortino_ratio,
            calmar_ratio: simulation_result.risk_metrics.calmar_ratio,
            volatility: simulation_result.risk_metrics.volatility,
            beta: simulation_result.risk_metrics.beta,
            max_drawdown_duration: simulation_result.risk_metrics.max_drawdown_duration,
            recovery_time_days: simulation_result.risk_metrics.recovery_time_days,
            risk_decomposition: self.calculate_risk_decomposition(simulation_result).await?,
            stress_test_results: self.calculate_stress_test_results(simulation_result).await?,
        };

        let charts = self.generate_chart_data(simulation_result).await?;
        let heatmaps = self.generate_heatmap_data(simulation_result).await?;

        let metadata = ReportMetadata {
            simulation_parameters: self.extract_simulation_parameters(simulation_result),
            data_sources: vec!["Historical Price Data".to_string(), "Market Data Feeds".to_string()],
            model_version: "1.0.0".to_string(),
            generated_by: "Aegis Satellite".to_string(),
            confidence_level: 0.95,
        };

        Ok(SimulationReport {
            report_id,
            timestamp: Utc::now(),
            scenario: simulation_result.scenario.clone(),
            summary,
            risk_analysis,
            recommendations: simulation_result.recommendations.clone(),
            charts,
            heatmaps,
            metadata,
        })
    }

    /// Generate chart data for visualization
    async fn generate_chart_data(
        &self,
        simulation_result: &SimulationResult,
    ) -> Result<PortfolioChartData, Box<dyn std::error::Error + Send + Sync>> {
        // Generate portfolio value chart data
        let portfolio_values = vec![
            ChartDataPoint {
                timestamp: simulation_result.timestamp,
                value: simulation_result.initial_portfolio_value,
                label: Some("Initial".to_string()),
            },
            ChartDataPoint {
                timestamp: simulation_result.timestamp,
                value: simulation_result.final_portfolio_value,
                label: Some("Final".to_string()),
            },
        ];

        // Generate drawdown curve
        let drawdown_curve = vec![
            ChartDataPoint {
                timestamp: simulation_result.timestamp,
                value: 0.0,
                label: Some("Start".to_string()),
            },
            ChartDataPoint {
                timestamp: simulation_result.timestamp,
                value: simulation_result.max_drawdown,
                label: Some("Max Drawdown".to_string()),
            },
        ];

        // Generate risk metrics
        let risk_metrics = vec![
            ChartDataPoint {
                timestamp: simulation_result.timestamp,
                value: simulation_result.risk_metrics.sharpe_ratio,
                label: Some("Sharpe Ratio".to_string()),
            },
            ChartDataPoint {
                timestamp: simulation_result.timestamp,
                value: simulation_result.risk_metrics.volatility,
                label: Some("Volatility".to_string()),
            },
        ];

        // Generate position performance data
        let mut position_performance = HashMap::new();
        for position in &simulation_result.surviving_positions {
            position_performance.insert(
                position.clone(),
                vec![
                    ChartDataPoint {
                        timestamp: simulation_result.timestamp,
                        value: 100.0, // Base value
                        label: Some("Base".to_string()),
                    },
                ],
            );
        }

        Ok(PortfolioChartData {
            portfolio_values,
            drawdown_curve,
            risk_metrics,
            position_performance,
        })
    }

    /// Generate heatmap data for risk visualization
    async fn generate_heatmap_data(
        &self,
        simulation_result: &SimulationResult,
    ) -> Result<RiskHeatmapData, Box<dyn std::error::Error + Send + Sync>> {
        let correlation_matrix = simulation_result.risk_metrics.correlation_matrix.clone();
        let asset_names = simulation_result.surviving_positions.clone();

        let mut risk_scores = HashMap::new();
        for position in &simulation_result.surviving_positions {
            risk_scores.insert(position.clone(), 0.5); // Default risk score
        }

        let mut concentration_metrics = HashMap::new();
        for position in &simulation_result.surviving_positions {
            concentration_metrics.insert(position.clone(), 0.1); // Default concentration
        }

        Ok(RiskHeatmapData {
            correlation_matrix,
            asset_names,
            risk_scores,
            concentration_metrics,
        })
    }

    /// Calculate risk decomposition
    async fn calculate_risk_decomposition(
        &self,
        simulation_result: &SimulationResult,
    ) -> Result<HashMap<String, f64>, Box<dyn std::error::Error + Send + Sync>> {
        let mut decomposition = HashMap::new();
        
        decomposition.insert("Market Risk".to_string(), simulation_result.risk_metrics.beta);
        decomposition.insert("Volatility Risk".to_string(), simulation_result.risk_metrics.volatility);
        decomposition.insert("Liquidation Risk".to_string(), simulation_result.var_95);
        decomposition.insert("Tail Risk".to_string(), simulation_result.cvar_95);

        Ok(decomposition)
    }

    /// Calculate stress test results
    async fn calculate_stress_test_results(
        &self,
        simulation_result: &SimulationResult,
    ) -> Result<HashMap<String, f64>, Box<dyn std::error::Error + Send + Sync>> {
        let mut results = HashMap::new();
        
        results.insert("Total Return".to_string(), 
            (simulation_result.final_portfolio_value - simulation_result.initial_portfolio_value) / simulation_result.initial_portfolio_value);
        results.insert("Max Drawdown".to_string(), simulation_result.max_drawdown);
        results.insert("VaR (95%)".to_string(), simulation_result.var_95);
        results.insert("CVaR (95%)".to_string(), simulation_result.cvar_95);
        results.insert("Liquidation Rate".to_string(), 
            simulation_result.liquidated_positions.len() as f64 / 
            (simulation_result.liquidated_positions.len() + simulation_result.surviving_positions.len()) as f64);

        Ok(results)
    }

    /// Extract simulation parameters
    fn extract_simulation_parameters(&self, simulation_result: &SimulationResult) -> HashMap<String, String> {
        let mut parameters = HashMap::new();
        
        parameters.insert("Scenario Type".to_string(), format!("{:?}", simulation_result.scenario));
        parameters.insert("Initial Portfolio Value".to_string(), simulation_result.initial_portfolio_value.to_string());
        parameters.insert("Final Portfolio Value".to_string(), simulation_result.final_portfolio_value.to_string());
        parameters.insert("Simulation Duration (ms)".to_string(), simulation_result.simulation_duration_ms.to_string());

        parameters
    }

    /// Export report to JSON format
    pub async fn export_report_json(
        &self,
        report: &SimulationReport,
    ) -> Result<String, Box<dyn std::error::Error + Send + Sync>> {
        let json = serde_json::to_string_pretty(report)?;
        Ok(json)
    }

    /// Export report to CSV format
    pub async fn export_report_csv(
        &self,
        report: &SimulationReport,
    ) -> Result<String, Box<dyn std::error::Error + Send + Sync>> {
        let mut csv = String::new();
        
        // Add summary section
        csv.push_str("Summary\n");
        csv.push_str("Metric,Value\n");
        csv.push_str(&format!("Initial Portfolio Value,{}\n", report.summary.initial_portfolio_value));
        csv.push_str(&format!("Final Portfolio Value,{}\n", report.summary.final_portfolio_value));
        csv.push_str(&format!("Total Return,{}\n", report.summary.total_return));
        csv.push_str(&format!("Max Drawdown,{}\n", report.summary.max_drawdown));
        csv.push_str(&format!("VaR (95%),{}\n", report.summary.var_95));
        csv.push_str(&format!("CVaR (95%),{}\n", report.summary.cvar_95));
        csv.push_str("\n");

        // Add risk analysis section
        csv.push_str("Risk Analysis\n");
        csv.push_str("Metric,Value\n");
        csv.push_str(&format!("Sharpe Ratio,{}\n", report.risk_analysis.sharpe_ratio));
        csv.push_str(&format!("Sortino Ratio,{}\n", report.risk_analysis.sortino_ratio));
        csv.push_str(&format!("Calmar Ratio,{}\n", report.risk_analysis.calmar_ratio));
        csv.push_str(&format!("Volatility,{}\n", report.risk_analysis.volatility));
        csv.push_str(&format!("Beta,{}\n", report.risk_analysis.beta));
        csv.push_str("\n");

        // Add recommendations section
        csv.push_str("Recommendations\n");
        csv.push_str("Type,Priority,Description,Expected Impact,Implementation Cost,Time to Implement,Confidence\n");
        for rec in &report.recommendations {
            csv.push_str(&format!("{:?},{:?},{},{},{},{},{}\n",
                rec.recommendation_type,
                rec.priority,
                rec.description,
                rec.expected_impact,
                rec.implementation_cost,
                rec.time_to_implement,
                rec.confidence
            ));
        }

        Ok(csv)
    }

    /// Get available chart templates
    pub fn get_chart_templates(&self) -> Vec<String> {
        self.chart_templates.keys().cloned().collect()
    }

    /// Get available report templates
    pub fn get_report_templates(&self) -> Vec<String> {
        self.report_templates.keys().cloned().collect()
    }
}

impl Default for VisualizationFramework {
    fn default() -> Self {
        Self::new()
    }
} 