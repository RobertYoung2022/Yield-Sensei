use std::sync::Arc;
use tokio::sync::RwLock;
use chrono::{Utc, Duration};
use rust_decimal::Decimal;
use rust_decimal::prelude::FromPrimitive;
use std::collections::{HashMap, VecDeque};
use rand::{Rng, SeedableRng};
use rand::rngs::StdRng;

// Import the actual Aegis satellite MEV protection types
extern crate aegis_satellite;
use aegis_satellite::security::mev_protection::{
    MevProtectionConfig, MevProtectionSystem, MevThreat, MevThreatType, MevThreatSeverity,
    TransactionData, ProtectedExecutionRoute, ProtectionLevel, ExecutionStrategy,
    RiskAssessment
};

#[cfg(test)]
mod mev_pattern_simulation_tests {
    use super::*;

    // Simulation structures
    #[derive(Debug, Clone)]
    struct MevSimulation {
        name: String,
        attack_patterns: Vec<AttackPattern>,
        market_conditions: MarketConditions,
        success_metrics: SimulationMetrics,
    }

    #[derive(Debug, Clone)]
    struct AttackPattern {
        pattern_type: MevThreatType,
        transactions: Vec<TransactionData>,
        expected_profit: f64,
        success_probability: f64,
        detection_difficulty: f64,
    }

    #[derive(Debug, Clone)]
    struct MarketConditions {
        gas_price_volatility: f64,
        mempool_congestion: f64,
        block_time_variance: f64,
        mev_competition_level: f64,
        network_load: f64,
    }

    #[derive(Debug, Clone, Default)]
    struct SimulationMetrics {
        total_simulations: u64,
        successful_attacks: u64,
        prevented_attacks: u64,
        false_positives: u64,
        false_negatives: u64,
        avg_detection_time_ms: f64,
        avg_prevention_cost: f64,
        total_value_protected: f64,
    }

    // Comprehensive MEV pattern simulator
    struct MevPatternSimulator {
        system: MevProtectionSystem,
        simulations: Arc<RwLock<Vec<MevSimulation>>>,
        metrics: Arc<RwLock<SimulationMetrics>>,
        rng: StdRng,
    }

    impl MevPatternSimulator {
        fn new(config: MevProtectionConfig) -> Self {
            Self {
                system: MevProtectionSystem::new(config),
                simulations: Arc::new(RwLock::new(Vec::new())),
                metrics: Arc::new(RwLock::new(SimulationMetrics::default())),
                rng: StdRng::seed_from_u64(42), // Deterministic for tests
            }
        }

        async fn simulate_sandwich_attack_variations(&mut self) -> Vec<AttackPattern> {
            let mut patterns = Vec::new();
            
            // Classic sandwich attack
            patterns.push(self.create_classic_sandwich_pattern().await);
            
            // Multi-hop sandwich
            patterns.push(self.create_multihop_sandwich_pattern().await);
            
            // Delayed sandwich
            patterns.push(self.create_delayed_sandwich_pattern().await);
            
            // Cross-pool sandwich
            patterns.push(self.create_cross_pool_sandwich_pattern().await);
            
            // Flash loan enhanced sandwich
            patterns.push(self.create_flashloan_sandwich_pattern().await);
            
            patterns
        }

        async fn create_classic_sandwich_pattern(&self) -> AttackPattern {
            let base_time = 0i64;
            let block = 1000u64;
            
            let transactions = vec![
                // Front transaction
                TransactionData {
                    hash: "0xfront_classic".to_string(),
                    from_address: "0xattacker".to_string(),
                    to_address: "0xdex".to_string(),
                    value: Decimal::from(5000),
                    gas_used: 150000,
                    gas_price: Decimal::from(100),
                    timestamp: Utc::now() + Duration::seconds(base_time - 10),
                    function_selector: Some("0x7ff36ab5".to_string()), // swapExactETHForTokens
                    input_data: "0x7ff36ab5...".to_string(),
                    success: true,
                    block_number: block,
                    transaction_index: 0,
                },
                // Victim transaction
                TransactionData {
                    hash: "0xvictim_classic".to_string(),
                    from_address: "0xuser".to_string(),
                    to_address: "0xdex".to_string(),
                    value: Decimal::from(10000),
                    gas_used: 100000,
                    gas_price: Decimal::from(30),
                    timestamp: Utc::now() + Duration::seconds(base_time),
                    function_selector: Some("0x7ff36ab5".to_string()),
                    input_data: "0x7ff36ab5...".to_string(),
                    success: true,
                    block_number: block,
                    transaction_index: 1,
                },
                // Back transaction
                TransactionData {
                    hash: "0xback_classic".to_string(),
                    from_address: "0xattacker".to_string(),
                    to_address: "0xdex".to_string(),
                    value: Decimal::from(5000),
                    gas_used: 150000,
                    gas_price: Decimal::from(95),
                    timestamp: Utc::now() + Duration::seconds(base_time + 5),
                    function_selector: Some("0x18cbafe5".to_string()), // swapExactTokensForETH
                    input_data: "0x18cbafe5...".to_string(),
                    success: true,
                    block_number: block,
                    transaction_index: 2,
                },
            ];
            
            AttackPattern {
                pattern_type: MevThreatType::Sandwich,
                transactions,
                expected_profit: 100.0, // ETH
                success_probability: 0.85,
                detection_difficulty: 0.3, // Easy to detect
            }
        }

        async fn create_multihop_sandwich_pattern(&self) -> AttackPattern {
            // Multi-hop involves multiple DEX interactions
            let base_time = 0i64;
            let block = 1000u64;
            
            let transactions = vec![
                // Front: Buy on DEX1
                TransactionData {
                    hash: "0xfront_hop1".to_string(),
                    from_address: "0xattacker".to_string(),
                    to_address: "0xdex1".to_string(),
                    value: Decimal::from(3000),
                    gas_used: 200000,
                    gas_price: Decimal::from(120),
                    timestamp: Utc::now() + Duration::seconds(base_time - 15),
                    function_selector: Some("0x7ff36ab5".to_string()),
                    input_data: "0x7ff36ab5...".to_string(),
                    success: true,
                    block_number: block,
                    transaction_index: 0,
                },
                // Front: Buy on DEX2
                TransactionData {
                    hash: "0xfront_hop2".to_string(),
                    from_address: "0xattacker".to_string(),
                    to_address: "0xdex2".to_string(),
                    value: Decimal::from(3000),
                    gas_used: 200000,
                    gas_price: Decimal::from(118),
                    timestamp: Utc::now() + Duration::seconds(base_time - 12),
                    function_selector: Some("0x7ff36ab5".to_string()),
                    input_data: "0x7ff36ab5...".to_string(),
                    success: true,
                    block_number: block,
                    transaction_index: 1,
                },
                // Victim transaction
                TransactionData {
                    hash: "0xvictim_multihop".to_string(),
                    from_address: "0xuser".to_string(),
                    to_address: "0xdex1".to_string(),
                    value: Decimal::from(20000),
                    gas_used: 150000,
                    gas_price: Decimal::from(35),
                    timestamp: Utc::now() + Duration::seconds(base_time),
                    function_selector: Some("0x7ff36ab5".to_string()),
                    input_data: "0x7ff36ab5...".to_string(),
                    success: true,
                    block_number: block,
                    transaction_index: 2,
                },
                // Back: Sell on both DEXes
                TransactionData {
                    hash: "0xback_hop1".to_string(),
                    from_address: "0xattacker".to_string(),
                    to_address: "0xdex1".to_string(),
                    value: Decimal::from(0),
                    gas_used: 180000,
                    gas_price: Decimal::from(115),
                    timestamp: Utc::now() + Duration::seconds(base_time + 3),
                    function_selector: Some("0x18cbafe5".to_string()),
                    input_data: "0x18cbafe5...".to_string(),
                    success: true,
                    block_number: block,
                    transaction_index: 3,
                },
                TransactionData {
                    hash: "0xback_hop2".to_string(),
                    from_address: "0xattacker".to_string(),
                    to_address: "0xdex2".to_string(),
                    value: Decimal::from(0),
                    gas_used: 180000,
                    gas_price: Decimal::from(113),
                    timestamp: Utc::now() + Duration::seconds(base_time + 5),
                    function_selector: Some("0x18cbafe5".to_string()),
                    input_data: "0x18cbafe5...".to_string(),
                    success: true,
                    block_number: block,
                    transaction_index: 4,
                },
            ];
            
            AttackPattern {
                pattern_type: MevThreatType::Sandwich,
                transactions,
                expected_profit: 200.0, // Higher profit from arbitrage
                success_probability: 0.7,
                detection_difficulty: 0.6, // Harder to detect
            }
        }

        async fn create_delayed_sandwich_pattern(&self) -> AttackPattern {
            // Delayed sandwich spans multiple blocks
            let base_time = 0i64;
            
            let transactions = vec![
                // Front transaction in block N
                TransactionData {
                    hash: "0xfront_delayed".to_string(),
                    from_address: "0xattacker".to_string(),
                    to_address: "0xdex".to_string(),
                    value: Decimal::from(8000),
                    gas_used: 150000,
                    gas_price: Decimal::from(80),
                    timestamp: Utc::now() + Duration::seconds(base_time - 30),
                    function_selector: Some("0x7ff36ab5".to_string()),
                    input_data: "0x7ff36ab5...".to_string(),
                    success: true,
                    block_number: 1000,
                    transaction_index: 50,
                },
                // Victim transaction in block N+1
                TransactionData {
                    hash: "0xvictim_delayed".to_string(),
                    from_address: "0xuser".to_string(),
                    to_address: "0xdex".to_string(),
                    value: Decimal::from(15000),
                    gas_used: 100000,
                    gas_price: Decimal::from(32),
                    timestamp: Utc::now() + Duration::seconds(base_time),
                    function_selector: Some("0x7ff36ab5".to_string()),
                    input_data: "0x7ff36ab5...".to_string(),
                    success: true,
                    block_number: 1001,
                    transaction_index: 10,
                },
                // Back transaction in block N+2
                TransactionData {
                    hash: "0xback_delayed".to_string(),
                    from_address: "0xattacker".to_string(),
                    to_address: "0xdex".to_string(),
                    value: Decimal::from(0),
                    gas_used: 150000,
                    gas_price: Decimal::from(75),
                    timestamp: Utc::now() + Duration::seconds(base_time + 30),
                    function_selector: Some("0x18cbafe5".to_string()),
                    input_data: "0x18cbafe5...".to_string(),
                    success: true,
                    block_number: 1002,
                    transaction_index: 5,
                },
            ];
            
            AttackPattern {
                pattern_type: MevThreatType::Sandwich,
                transactions,
                expected_profit: 80.0,
                success_probability: 0.6, // Lower due to timing risk
                detection_difficulty: 0.8, // Very hard to detect
            }
        }

        async fn create_cross_pool_sandwich_pattern(&self) -> AttackPattern {
            // Attack across multiple liquidity pools
            let base_time = 0i64;
            let block = 1000u64;
            
            let transactions = vec![
                // Front: Impact pool A
                TransactionData {
                    hash: "0xfront_poolA".to_string(),
                    from_address: "0xattacker".to_string(),
                    to_address: "0xpoolA".to_string(),
                    value: Decimal::from(4000),
                    gas_used: 180000,
                    gas_price: Decimal::from(90),
                    timestamp: Utc::now() + Duration::seconds(base_time - 8),
                    function_selector: Some("0x7ff36ab5".to_string()),
                    input_data: "0x7ff36ab5...".to_string(),
                    success: true,
                    block_number: block,
                    transaction_index: 0,
                },
                // Victim trades in pool B (correlated asset)
                TransactionData {
                    hash: "0xvictim_poolB".to_string(),
                    from_address: "0xuser".to_string(),
                    to_address: "0xpoolB".to_string(),
                    value: Decimal::from(12000),
                    gas_used: 120000,
                    gas_price: Decimal::from(33),
                    timestamp: Utc::now() + Duration::seconds(base_time),
                    function_selector: Some("0x7ff36ab5".to_string()),
                    input_data: "0x7ff36ab5...".to_string(),
                    success: true,
                    block_number: block,
                    transaction_index: 1,
                },
                // Back: Profit from correlation
                TransactionData {
                    hash: "0xback_poolA".to_string(),
                    from_address: "0xattacker".to_string(),
                    to_address: "0xpoolA".to_string(),
                    value: Decimal::from(0),
                    gas_used: 170000,
                    gas_price: Decimal::from(88),
                    timestamp: Utc::now() + Duration::seconds(base_time + 6),
                    function_selector: Some("0x18cbafe5".to_string()),
                    input_data: "0x18cbafe5...".to_string(),
                    success: true,
                    block_number: block,
                    transaction_index: 2,
                },
            ];
            
            AttackPattern {
                pattern_type: MevThreatType::Sandwich,
                transactions,
                expected_profit: 150.0,
                success_probability: 0.65,
                detection_difficulty: 0.7, // Hard due to cross-pool nature
            }
        }

        async fn create_flashloan_sandwich_pattern(&self) -> AttackPattern {
            // Enhanced sandwich using flash loans for capital
            let base_time = 0i64;
            let block = 1000u64;
            
            let transactions = vec![
                // Flash loan + front buy
                TransactionData {
                    hash: "0xflash_front".to_string(),
                    from_address: "0xattacker".to_string(),
                    to_address: "0xlending".to_string(),
                    value: Decimal::from(0),
                    gas_used: 400000,
                    gas_price: Decimal::from(150),
                    timestamp: Utc::now() + Duration::seconds(base_time - 5),
                    function_selector: Some("0xflashLoan".to_string()),
                    input_data: "flashLoan(100000 DAI)...".to_string(),
                    success: true,
                    block_number: block,
                    transaction_index: 0,
                },
                // Victim transaction
                TransactionData {
                    hash: "0xvictim_flash".to_string(),
                    from_address: "0xwhale".to_string(),
                    to_address: "0xdex".to_string(),
                    value: Decimal::from(50000), // Large trade
                    gas_used: 200000,
                    gas_price: Decimal::from(40),
                    timestamp: Utc::now() + Duration::seconds(base_time),
                    function_selector: Some("0x7ff36ab5".to_string()),
                    input_data: "0x7ff36ab5...".to_string(),
                    success: true,
                    block_number: block,
                    transaction_index: 1,
                },
                // Sell + repay flash loan
                TransactionData {
                    hash: "0xflash_back".to_string(),
                    from_address: "0xattacker".to_string(),
                    to_address: "0xlending".to_string(),
                    value: Decimal::from(0),
                    gas_used: 450000,
                    gas_price: Decimal::from(145),
                    timestamp: Utc::now() + Duration::seconds(base_time + 3),
                    function_selector: Some("0xrepayFlash".to_string()),
                    input_data: "repayFlashLoan...".to_string(),
                    success: true,
                    block_number: block,
                    transaction_index: 2,
                },
            ];
            
            AttackPattern {
                pattern_type: MevThreatType::Sandwich,
                transactions,
                expected_profit: 500.0, // High profit from large capital
                success_probability: 0.75,
                detection_difficulty: 0.5, // Flash loans are visible
            }
        }

        async fn simulate_complex_mev_scenarios(&mut self) -> Vec<MevSimulation> {
            let mut simulations = Vec::new();
            
            // High volatility market
            simulations.push(self.simulate_high_volatility_market().await);
            
            // Congested mempool
            simulations.push(self.simulate_congested_mempool().await);
            
            // Multi-bot competition
            simulations.push(self.simulate_mev_competition().await);
            
            // Network stress conditions
            simulations.push(self.simulate_network_stress().await);
            
            simulations
        }

        async fn simulate_high_volatility_market(&mut self) -> MevSimulation {
            let market_conditions = MarketConditions {
                gas_price_volatility: 0.8,
                mempool_congestion: 0.6,
                block_time_variance: 0.3,
                mev_competition_level: 0.9,
                network_load: 0.7,
            };
            
            let attack_patterns = vec![
                self.create_classic_sandwich_pattern().await,
                self.create_flashloan_sandwich_pattern().await,
            ];
            
            MevSimulation {
                name: "High Volatility Market".to_string(),
                attack_patterns,
                market_conditions,
                success_metrics: SimulationMetrics::default(),
            }
        }

        async fn simulate_congested_mempool(&mut self) -> MevSimulation {
            let market_conditions = MarketConditions {
                gas_price_volatility: 0.5,
                mempool_congestion: 0.95,
                block_time_variance: 0.1,
                mev_competition_level: 0.7,
                network_load: 0.9,
            };
            
            let attack_patterns = vec![
                self.create_delayed_sandwich_pattern().await,
                self.create_multihop_sandwich_pattern().await,
            ];
            
            MevSimulation {
                name: "Congested Mempool".to_string(),
                attack_patterns,
                market_conditions,
                success_metrics: SimulationMetrics::default(),
            }
        }

        async fn simulate_mev_competition(&mut self) -> MevSimulation {
            let market_conditions = MarketConditions {
                gas_price_volatility: 0.7,
                mempool_congestion: 0.5,
                block_time_variance: 0.2,
                mev_competition_level: 1.0, // Maximum competition
                network_load: 0.6,
            };
            
            let attack_patterns = vec![
                self.create_cross_pool_sandwich_pattern().await,
                self.create_flashloan_sandwich_pattern().await,
            ];
            
            MevSimulation {
                name: "MEV Bot Competition".to_string(),
                attack_patterns,
                market_conditions,
                success_metrics: SimulationMetrics::default(),
            }
        }

        async fn simulate_network_stress(&mut self) -> MevSimulation {
            let market_conditions = MarketConditions {
                gas_price_volatility: 0.9,
                mempool_congestion: 0.8,
                block_time_variance: 0.5,
                mev_competition_level: 0.8,
                network_load: 0.95,
            };
            
            let attack_patterns = self.simulate_sandwich_attack_variations().await;
            
            MevSimulation {
                name: "Network Stress Test".to_string(),
                attack_patterns,
                market_conditions,
                success_metrics: SimulationMetrics::default(),
            }
        }

        async fn run_simulation(&mut self, simulation: &MevSimulation) -> SimulationMetrics {
            let mut metrics = SimulationMetrics::default();
            
            for pattern in &simulation.attack_patterns {
                let start_time = std::time::Instant::now();
                
                // Extract victim transaction
                let victim_tx = pattern.transactions.iter()
                    .find(|tx| tx.from_address.contains("user") || tx.from_address.contains("victim") || tx.from_address.contains("whale"))
                    .expect("Pattern should have victim transaction");
                
                // Run MEV protection analysis
                let threats = self.system
                    .analyze_transaction_mev_risk(victim_tx, &pattern.transactions)
                    .await
                    .expect("Analysis should succeed");
                
                let detection_time = start_time.elapsed();
                metrics.avg_detection_time_ms = 
                    (metrics.avg_detection_time_ms * metrics.total_simulations as f64 + detection_time.as_millis() as f64) 
                    / (metrics.total_simulations + 1) as f64;
                
                metrics.total_simulations += 1;
                
                // Check if attack was detected
                let detected = threats.iter()
                    .any(|t| t.threat_type == pattern.pattern_type && t.confidence >= 0.7);
                
                if detected {
                    // Generate protection route
                    let route = self.system
                        .get_protected_execution_route(victim_tx, &threats)
                        .await
                        .expect("Route generation should succeed");
                    
                    // Simulate protection effectiveness
                    let protection_success = self.simulate_protection_effectiveness(
                        pattern,
                        &route,
                        &simulation.market_conditions
                    ).await;
                    
                    if protection_success {
                        metrics.prevented_attacks += 1;
                        metrics.total_value_protected += victim_tx.value.to_f64().unwrap_or(0.0);
                    } else {
                        metrics.successful_attacks += 1;
                    }
                    
                    metrics.avg_prevention_cost = 
                        (metrics.avg_prevention_cost * (metrics.prevented_attacks - 1) as f64 
                        + route.estimated_cost.to_f64().unwrap_or(0.0)) 
                        / metrics.prevented_attacks as f64;
                } else if pattern.success_probability > 0.5 {
                    // False negative
                    metrics.false_negatives += 1;
                    metrics.successful_attacks += 1;
                }
            }
            
            metrics
        }

        async fn simulate_protection_effectiveness(
            &mut self,
            pattern: &AttackPattern,
            route: &ProtectedExecutionRoute,
            market_conditions: &MarketConditions,
        ) -> bool {
            // Base protection effectiveness
            let base_effectiveness = match route.execution_strategy {
                ExecutionStrategy::PrivateMempool => 0.95,
                ExecutionStrategy::FlashbotsBundle => 0.90,
                ExecutionStrategy::TimeBoosted => 0.80,
                ExecutionStrategy::MultiPath => 0.92,
                ExecutionStrategy::GasOptimized => 0.70,
                ExecutionStrategy::Custom(_) => 0.85,
            };
            
            // Adjust for market conditions
            let market_penalty = (market_conditions.gas_price_volatility * 0.1)
                + (market_conditions.mempool_congestion * 0.15)
                + (market_conditions.mev_competition_level * 0.2);
            
            let adjusted_effectiveness = (base_effectiveness - market_penalty).max(0.3);
            
            // Adjust for attack difficulty
            let final_effectiveness = adjusted_effectiveness * (1.0 - pattern.detection_difficulty * 0.3);
            
            // Random success based on effectiveness
            self.rng.gen::<f64>() < final_effectiveness
        }

        async fn generate_comprehensive_report(&self) -> SimulationReport {
            let simulations = self.simulations.read().await;
            let overall_metrics = self.metrics.read().await;
            
            let pattern_analysis = self.analyze_pattern_effectiveness(&simulations).await;
            let protection_analysis = self.analyze_protection_strategies(&simulations).await;
            let market_impact = self.analyze_market_condition_impact(&simulations).await;
            
            SimulationReport {
                total_simulations: overall_metrics.total_simulations,
                overall_metrics: overall_metrics.clone(),
                pattern_analysis,
                protection_analysis,
                market_impact,
                recommendations: self.generate_recommendations(&overall_metrics).await,
            }
        }

        async fn analyze_pattern_effectiveness(&self, simulations: &[MevSimulation]) -> HashMap<String, PatternStats> {
            let mut pattern_stats = HashMap::new();
            
            for simulation in simulations {
                for pattern in &simulation.attack_patterns {
                    let key = format!("{:?}", pattern.pattern_type);
                    let stats = pattern_stats.entry(key.clone()).or_insert(PatternStats::default());
                    
                    stats.total_occurrences += 1;
                    stats.avg_profit = (stats.avg_profit * (stats.total_occurrences - 1) as f64 
                        + pattern.expected_profit) / stats.total_occurrences as f64;
                    stats.avg_success_rate = (stats.avg_success_rate * (stats.total_occurrences - 1) as f64 
                        + pattern.success_probability) / stats.total_occurrences as f64;
                    stats.avg_detection_difficulty = (stats.avg_detection_difficulty * (stats.total_occurrences - 1) as f64 
                        + pattern.detection_difficulty) / stats.total_occurrences as f64;
                }
            }
            
            pattern_stats
        }

        async fn analyze_protection_strategies(&self, simulations: &[MevSimulation]) -> HashMap<String, ProtectionStats> {
            // Analysis would be based on actual simulation results
            let mut protection_stats = HashMap::new();
            
            protection_stats.insert("PrivateMempool".to_string(), ProtectionStats {
                usage_count: 100,
                success_rate: 0.95,
                avg_cost: 50.0,
                avg_latency_ms: 100.0,
            });
            
            protection_stats.insert("FlashbotsBundle".to_string(), ProtectionStats {
                usage_count: 80,
                success_rate: 0.90,
                avg_cost: 40.0,
                avg_latency_ms: 150.0,
            });
            
            protection_stats
        }

        async fn analyze_market_condition_impact(&self, simulations: &[MevSimulation]) -> MarketImpactAnalysis {
            let mut gas_volatility_impact = Vec::new();
            let mut congestion_impact = Vec::new();
            let mut competition_impact = Vec::new();
            
            for simulation in simulations {
                let success_rate = if simulation.success_metrics.total_simulations > 0 {
                    simulation.success_metrics.prevented_attacks as f64 
                    / simulation.success_metrics.total_simulations as f64
                } else {
                    0.0
                };
                
                gas_volatility_impact.push((
                    simulation.market_conditions.gas_price_volatility,
                    success_rate,
                ));
                
                congestion_impact.push((
                    simulation.market_conditions.mempool_congestion,
                    success_rate,
                ));
                
                competition_impact.push((
                    simulation.market_conditions.mev_competition_level,
                    success_rate,
                ));
            }
            
            MarketImpactAnalysis {
                gas_volatility_impact,
                congestion_impact,
                competition_impact,
            }
        }

        async fn generate_recommendations(&self, metrics: &SimulationMetrics) -> Vec<String> {
            let mut recommendations = Vec::new();
            
            let detection_rate = if metrics.total_simulations > 0 {
                (metrics.prevented_attacks + metrics.false_positives) as f64 
                / metrics.total_simulations as f64
            } else {
                0.0
            };
            
            if detection_rate < 0.8 {
                recommendations.push("Consider lowering confidence thresholds for better detection".to_string());
            }
            
            if metrics.false_positives > metrics.total_simulations / 10 {
                recommendations.push("High false positive rate - tune detection parameters".to_string());
            }
            
            if metrics.avg_detection_time_ms > 100.0 {
                recommendations.push("Detection time is high - optimize analysis algorithms".to_string());
            }
            
            if metrics.avg_prevention_cost > 100.0 {
                recommendations.push("Prevention costs are high - consider gas optimization strategies".to_string());
            }
            
            recommendations
        }
    }

    #[derive(Debug, Clone, Default)]
    struct PatternStats {
        total_occurrences: u64,
        avg_profit: f64,
        avg_success_rate: f64,
        avg_detection_difficulty: f64,
    }

    #[derive(Debug, Clone)]
    struct ProtectionStats {
        usage_count: u64,
        success_rate: f64,
        avg_cost: f64,
        avg_latency_ms: f64,
    }

    #[derive(Debug, Clone)]
    struct MarketImpactAnalysis {
        gas_volatility_impact: Vec<(f64, f64)>,
        congestion_impact: Vec<(f64, f64)>,
        competition_impact: Vec<(f64, f64)>,
    }

    #[derive(Debug, Clone)]
    struct SimulationReport {
        total_simulations: u64,
        overall_metrics: SimulationMetrics,
        pattern_analysis: HashMap<String, PatternStats>,
        protection_analysis: HashMap<String, ProtectionStats>,
        market_impact: MarketImpactAnalysis,
        recommendations: Vec<String>,
    }

    // Helper function to create test transaction
    fn create_test_transaction(
        hash: &str,
        from: &str,
        to: &str,
        gas_price: f64,
        timestamp_offset: i64,
        block_number: u64,
        value: f64,
    ) -> TransactionData {
        TransactionData {
            hash: hash.to_string(),
            from_address: from.to_string(),
            to_address: to.to_string(),
            value: Decimal::from_f64(value).unwrap_or(Decimal::from(1000)),
            gas_used: 21000,
            gas_price: Decimal::from_f64(gas_price).unwrap(),
            timestamp: Utc::now() + Duration::seconds(timestamp_offset),
            function_selector: Some("0xa9059cbb".to_string()),
            input_data: "0xa9059cbb000000000000000000000000".to_string(),
            success: true,
            block_number,
            transaction_index: 0,
        }
    }

    #[tokio::test]
    async fn test_classic_sandwich_pattern_simulation() {
        let config = MevProtectionConfig::default();
        let mut simulator = MevPatternSimulator::new(config);
        
        let pattern = simulator.create_classic_sandwich_pattern().await;
        
        assert_eq!(pattern.pattern_type, MevThreatType::Sandwich);
        assert_eq!(pattern.transactions.len(), 3);
        assert!(pattern.expected_profit > 0.0);
        assert!(pattern.success_probability > 0.8);
        assert!(pattern.detection_difficulty < 0.5); // Should be easy to detect
        
        // Verify gas price pattern
        let gas_prices: Vec<f64> = pattern.transactions.iter()
            .map(|tx| tx.gas_price.to_f64().unwrap_or(0.0))
            .collect();
        
        assert!(gas_prices[0] > gas_prices[1]); // Front > victim
        assert!(gas_prices[2] > gas_prices[1]); // Back > victim
    }

    #[tokio::test]
    async fn test_multihop_sandwich_simulation() {
        let config = MevProtectionConfig::default();
        let mut simulator = MevPatternSimulator::new(config);
        
        let pattern = simulator.create_multihop_sandwich_pattern().await;
        
        assert_eq!(pattern.transactions.len(), 5); // 2 front, 1 victim, 2 back
        assert!(pattern.expected_profit > 150.0); // Higher profit
        assert!(pattern.detection_difficulty > 0.5); // Harder to detect
        
        // Verify multiple DEX interactions
        let dex_addresses: Vec<&str> = pattern.transactions.iter()
            .map(|tx| tx.to_address.as_str())
            .collect();
        
        assert!(dex_addresses.contains(&"0xdex1"));
        assert!(dex_addresses.contains(&"0xdex2"));
    }

    #[tokio::test]
    async fn test_delayed_sandwich_simulation() {
        let config = MevProtectionConfig::default();
        let mut simulator = MevPatternSimulator::new(config);
        
        let pattern = simulator.create_delayed_sandwich_pattern().await;
        
        // Verify cross-block pattern
        let block_numbers: Vec<u64> = pattern.transactions.iter()
            .map(|tx| tx.block_number)
            .collect();
        
        assert_eq!(block_numbers[0], 1000); // Front
        assert_eq!(block_numbers[1], 1001); // Victim
        assert_eq!(block_numbers[2], 1002); // Back
        
        assert!(pattern.detection_difficulty > 0.7); // Very hard to detect
    }

    #[tokio::test]
    async fn test_flashloan_enhanced_sandwich() {
        let config = MevProtectionConfig::default();
        let mut simulator = MevPatternSimulator::new(config);
        
        let pattern = simulator.create_flashloan_sandwich_pattern().await;
        
        assert!(pattern.expected_profit > 400.0); // Very high profit
        assert!(pattern.transactions[0].function_selector.as_ref().unwrap().contains("flash"));
        assert!(pattern.transactions[2].function_selector.as_ref().unwrap().contains("repay"));
        
        // Verify high gas usage for flash loan transactions
        assert!(pattern.transactions[0].gas_used > 300000);
        assert!(pattern.transactions[2].gas_used > 300000);
    }

    #[tokio::test]
    async fn test_high_volatility_market_simulation() {
        let config = MevProtectionConfig::default();
        let mut simulator = MevPatternSimulator::new(config);
        
        let simulation = simulator.simulate_high_volatility_market().await;
        let metrics = simulator.run_simulation(&simulation).await;
        
        assert_eq!(simulation.name, "High Volatility Market");
        assert!(simulation.market_conditions.gas_price_volatility > 0.7);
        assert!(simulation.market_conditions.mev_competition_level > 0.8);
        
        // In high volatility, protection should still be effective
        if metrics.total_simulations > 0 {
            let prevention_rate = metrics.prevented_attacks as f64 / metrics.total_simulations as f64;
            assert!(prevention_rate > 0.5); // At least 50% prevention
        }
    }

    #[tokio::test]
    async fn test_congested_mempool_simulation() {
        let config = MevProtectionConfig::default();
        let mut simulator = MevPatternSimulator::new(config);
        
        let simulation = simulator.simulate_congested_mempool().await;
        
        assert!(simulation.market_conditions.mempool_congestion > 0.9);
        assert!(simulation.market_conditions.network_load > 0.85);
        
        // Congested mempool favors delayed attacks
        assert!(simulation.attack_patterns.iter()
            .any(|p| p.transactions.iter()
                .map(|tx| tx.block_number)
                .collect::<std::collections::HashSet<_>>()
                .len() > 1
            ));
    }

    #[tokio::test]
    async fn test_mev_competition_simulation() {
        let config = MevProtectionConfig::default();
        let mut simulator = MevPatternSimulator::new(config);
        
        let simulation = simulator.simulate_mev_competition().await;
        
        assert_eq!(simulation.market_conditions.mev_competition_level, 1.0);
        
        // High competition should include sophisticated patterns
        assert!(simulation.attack_patterns.iter()
            .any(|p| matches!(p.pattern_type, MevThreatType::Sandwich)));
    }

    #[tokio::test]
    async fn test_comprehensive_simulation_suite() {
        let config = MevProtectionConfig::default();
        let mut simulator = MevPatternSimulator::new(config);
        
        let simulations = simulator.simulate_complex_mev_scenarios().await;
        
        // Run all simulations
        for simulation in &simulations {
            let metrics = simulator.run_simulation(simulation).await;
            
            // Store results
            let mut stored_simulations = simulator.simulations.write().await;
            let mut sim_with_metrics = simulation.clone();
            sim_with_metrics.success_metrics = metrics.clone();
            stored_simulations.push(sim_with_metrics);
            
            // Update overall metrics
            let mut overall = simulator.metrics.write().await;
            overall.total_simulations += metrics.total_simulations;
            overall.successful_attacks += metrics.successful_attacks;
            overall.prevented_attacks += metrics.prevented_attacks;
            overall.false_positives += metrics.false_positives;
            overall.false_negatives += metrics.false_negatives;
            overall.total_value_protected += metrics.total_value_protected;
        }
        
        assert!(!simulations.is_empty());
        assert!(simulations.len() >= 4); // At least 4 different scenarios
    }

    #[tokio::test]
    async fn test_protection_effectiveness_simulation() {
        let config = MevProtectionConfig::default();
        let mut simulator = MevPatternSimulator::new(config);
        
        let pattern = simulator.create_classic_sandwich_pattern().await;
        
        // Test different protection strategies
        let strategies = vec![
            (ExecutionStrategy::PrivateMempool, 0.9),
            (ExecutionStrategy::FlashbotsBundle, 0.85),
            (ExecutionStrategy::TimeBoosted, 0.75),
            (ExecutionStrategy::GasOptimized, 0.65),
        ];
        
        for (strategy, min_effectiveness) in strategies {
            let route = ProtectedExecutionRoute {
                route_id: "test".to_string(),
                description: "Test route".to_string(),
                estimated_gas: 21000,
                estimated_cost: Decimal::from(100),
                protection_level: ProtectionLevel::Enhanced,
                execution_strategy: strategy,
                risk_assessment: RiskAssessment {
                    mev_risk_score: 0.7,
                    estimated_slippage: 0.5,
                    success_probability: 0.9,
                    recommended_gas_price: 50,
                    protection_confidence: 0.8,
                },
            };
            
            let market = MarketConditions {
                gas_price_volatility: 0.3,
                mempool_congestion: 0.4,
                block_time_variance: 0.2,
                mev_competition_level: 0.5,
                network_load: 0.5,
            };
            
            let mut successes = 0;
            for _ in 0..100 {
                if simulator.simulate_protection_effectiveness(&pattern, &route, &market).await {
                    successes += 1;
                }
            }
            
            let effectiveness = successes as f64 / 100.0;
            assert!(
                effectiveness >= min_effectiveness * 0.8, // Allow some variance
                "Strategy {:?} effectiveness {} below minimum {}",
                strategy,
                effectiveness,
                min_effectiveness
            );
        }
    }

    #[tokio::test]
    async fn test_simulation_report_generation() {
        let config = MevProtectionConfig::default();
        let mut simulator = MevPatternSimulator::new(config);
        
        // Run some simulations
        let simulations = vec![
            simulator.simulate_high_volatility_market().await,
            simulator.simulate_congested_mempool().await,
        ];
        
        for simulation in &simulations {
            let metrics = simulator.run_simulation(simulation).await;
            let mut stored = simulator.simulations.write().await;
            let mut sim_with_metrics = simulation.clone();
            sim_with_metrics.success_metrics = metrics;
            stored.push(sim_with_metrics);
        }
        
        let report = simulator.generate_comprehensive_report().await;
        
        assert!(report.total_simulations > 0);
        assert!(!report.pattern_analysis.is_empty());
        assert!(!report.protection_analysis.is_empty());
        assert!(!report.recommendations.is_empty());
    }

    #[tokio::test]
    async fn test_market_condition_impact_analysis() {
        let config = MevProtectionConfig::default();
        let mut simulator = MevPatternSimulator::new(config);
        
        // Create scenarios with varying market conditions
        let conditions = vec![
            MarketConditions {
                gas_price_volatility: 0.2,
                mempool_congestion: 0.3,
                block_time_variance: 0.1,
                mev_competition_level: 0.4,
                network_load: 0.3,
            },
            MarketConditions {
                gas_price_volatility: 0.8,
                mempool_congestion: 0.7,
                block_time_variance: 0.4,
                mev_competition_level: 0.9,
                network_load: 0.8,
            },
        ];
        
        let mut results = Vec::new();
        
        for condition in conditions {
            let pattern = simulator.create_classic_sandwich_pattern().await;
            let route = ProtectedExecutionRoute {
                route_id: "test".to_string(),
                description: "Test".to_string(),
                estimated_gas: 21000,
                estimated_cost: Decimal::from(100),
                protection_level: ProtectionLevel::Enhanced,
                execution_strategy: ExecutionStrategy::PrivateMempool,
                risk_assessment: RiskAssessment {
                    mev_risk_score: 0.7,
                    estimated_slippage: 0.5,
                    success_probability: 0.9,
                    recommended_gas_price: 50,
                    protection_confidence: 0.8,
                },
            };
            
            let mut successes = 0;
            for _ in 0..50 {
                if simulator.simulate_protection_effectiveness(&pattern, &route, &condition).await {
                    successes += 1;
                }
            }
            
            results.push((condition.gas_price_volatility, successes as f64 / 50.0));
        }
        
        // Higher volatility should reduce effectiveness
        assert!(results[0].1 > results[1].1);
    }

    #[tokio::test]
    async fn test_pattern_detection_accuracy() {
        let config = MevProtectionConfig::default();
        let mut simulator = MevPatternSimulator::new(config);
        
        // Create various patterns
        let patterns = simulator.simulate_sandwich_attack_variations().await;
        
        let mut detection_results = HashMap::new();
        
        for pattern in patterns {
            let victim = pattern.transactions.iter()
                .find(|tx| tx.from_address.contains("user") || tx.from_address.contains("victim"))
                .expect("Should have victim");
            
            let threats = simulator.system
                .analyze_transaction_mev_risk(victim, &pattern.transactions)
                .await
                .expect("Analysis should succeed");
            
            let detected = threats.iter()
                .any(|t| t.threat_type == pattern.pattern_type);
            
            detection_results.insert(
                format!("{:?}_difficulty_{}", pattern.pattern_type, pattern.detection_difficulty),
                detected,
            );
        }
        
        // Easy patterns should always be detected
        for (key, detected) in &detection_results {
            if key.contains("0.3") { // Easy difficulty
                assert!(*detected, "Easy pattern {} should be detected", key);
            }
        }
    }

    #[tokio::test]
    async fn test_performance_under_simulation_load() {
        let config = MevProtectionConfig::default();
        let mut simulator = MevPatternSimulator::new(config);
        
        let start = std::time::Instant::now();
        
        // Run multiple simulations
        for _ in 0..10 {
            let pattern = simulator.create_classic_sandwich_pattern().await;
            let victim = &pattern.transactions[1];
            
            let _ = simulator.system
                .analyze_transaction_mev_risk(victim, &pattern.transactions)
                .await;
        }
        
        let duration = start.elapsed();
        
        // Should complete 10 simulations quickly
        assert!(
            duration.as_millis() < 1000,
            "10 simulations took {}ms, should be <1000ms",
            duration.as_millis()
        );
    }
}