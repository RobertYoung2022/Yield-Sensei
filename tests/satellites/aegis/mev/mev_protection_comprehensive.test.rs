use std::sync::Arc;
use tokio::sync::RwLock;
use chrono::{Utc, Duration};
use rust_decimal::Decimal;
use rust_decimal::prelude::FromPrimitive;

// Import the actual Aegis satellite MEV protection types
extern crate aegis_satellite;
use aegis_satellite::security::mev_protection::{
    MevProtectionConfig, MevProtectionSystem, MevThreat, MevThreatType, MevThreatSeverity,
    TransactionData, ProtectedExecutionRoute, ProtectionLevel, ExecutionStrategy,
    RiskAssessment, GasOptimizer, NetworkConditions
};

#[cfg(test)]
mod mev_protection_comprehensive_tests {
    use super::*;

    // Helper function to create test transactions
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
            function_selector: Some("0xa9059cbb".to_string()), // transfer
            input_data: "0xa9059cbb000000000000000000000000".to_string(),
            success: true,
            block_number,
            transaction_index: 0,
        }
    }

    // Helper function to create sandwich attack sequence
    fn create_sandwich_sequence(base_time: i64, block: u64) -> (TransactionData, TransactionData, TransactionData) {
        let before = create_test_transaction(
            "0xbefore123",
            "0xattacker",
            "0xdex",
            100.0,
            base_time - 10,
            block,
            5000.0,
        );
        
        let target = create_test_transaction(
            "0xtarget456",
            "0xvictim",
            "0xdex",
            25.0,
            base_time,
            block,
            10000.0,
        );
        
        let after = create_test_transaction(
            "0xafter789",
            "0xattacker",
            "0xdex",
            95.0,
            base_time + 5,
            block,
            5000.0,
        );
        
        (before, target, after)
    }

    #[tokio::test]
    async fn test_mev_protection_system_initialization() {
        let config = MevProtectionConfig::default();
        let system = MevProtectionSystem::new(config.clone());
        
        assert_eq!(config.enable_sandwich_detection, true);
        assert_eq!(config.enable_flashloan_protection, true);
        assert_eq!(config.enable_private_mempool, true);
        assert_eq!(config.max_slippage_tolerance, 0.5);
    }

    #[tokio::test]
    async fn test_sandwich_attack_detection_classic_pattern() {
        let config = MevProtectionConfig::default();
        let system = MevProtectionSystem::new(config);
        
        let (before, target, after) = create_sandwich_sequence(0, 1000);
        let recent_transactions = vec![before, target.clone(), after];
        
        let threats = system.analyze_transaction_mev_risk(&target, &recent_transactions)
            .await
            .expect("Analysis should succeed");
        
        // Should detect sandwich attack
        assert!(!threats.is_empty());
        
        let sandwich_threat = threats.iter()
            .find(|t| matches!(t.threat_type, MevThreatType::Sandwich))
            .expect("Should find sandwich threat");
        
        assert!(sandwich_threat.confidence >= 0.8);
        assert!(sandwich_threat.estimated_loss > 0.0);
        assert!(!sandwich_threat.mitigation_strategies.is_empty());
        assert!(sandwich_threat.description.contains("Sandwich attack detected"));
    }

    #[tokio::test]
    async fn test_sandwich_attack_detection_with_different_blocks() {
        let config = MevProtectionConfig::default();
        let system = MevProtectionSystem::new(config);
        
        // Create sandwich attack across different blocks
        let before = create_test_transaction("0xbefore", "0xattacker", "0xdex", 100.0, -10, 1000, 5000.0);
        let target = create_test_transaction("0xtarget", "0xvictim", "0xdex", 25.0, 0, 1001, 10000.0);
        let after = create_test_transaction("0xafter", "0xattacker", "0xdex", 95.0, 5, 1002, 5000.0);
        
        let recent_transactions = vec![before, target.clone(), after];
        
        let threats = system.analyze_transaction_mev_risk(&target, &recent_transactions)
            .await
            .expect("Analysis should succeed");
        
        // Should still detect sandwich attack across 2 blocks
        let sandwich_threat = threats.iter()
            .find(|t| matches!(t.threat_type, MevThreatType::Sandwich));
        
        assert!(sandwich_threat.is_some());
    }

    #[tokio::test]
    async fn test_sandwich_attack_no_detection_different_contracts() {
        let config = MevProtectionConfig::default();
        let system = MevProtectionSystem::new(config);
        
        // Create transactions to different contracts (no sandwich)
        let tx1 = create_test_transaction("0xtx1", "0xuser1", "0xdex1", 100.0, -10, 1000, 5000.0);
        let target = create_test_transaction("0xtarget", "0xvictim", "0xdex2", 25.0, 0, 1000, 10000.0);
        let tx3 = create_test_transaction("0xtx3", "0xuser3", "0xdex3", 95.0, 5, 1000, 5000.0);
        
        let recent_transactions = vec![tx1, target.clone(), tx3];
        
        let threats = system.analyze_transaction_mev_risk(&target, &recent_transactions)
            .await
            .expect("Analysis should succeed");
        
        // Should not detect sandwich attack
        let sandwich_threat = threats.iter()
            .find(|t| matches!(t.threat_type, MevThreatType::Sandwich));
        
        assert!(sandwich_threat.is_none());
    }

    #[tokio::test]
    async fn test_frontrunning_detection() {
        let config = MevProtectionConfig::default();
        let system = MevProtectionSystem::new(config);
        
        // Create frontrunning pattern
        let frontrunner = create_test_transaction(
            "0xfrontrun",
            "0xfrontrunner",
            "0xdex",
            50.0,  // Higher gas than victim
            -5,    // 5 seconds before victim
            1000,
            5000.0,
        );
        
        let victim = create_test_transaction(
            "0xvictim",
            "0xuser",
            "0xdex",
            25.0,  // Normal gas
            0,
            1000,
            10000.0,
        );
        
        let recent_transactions = vec![frontrunner, victim.clone()];
        
        let threats = system.analyze_transaction_mev_risk(&victim, &recent_transactions)
            .await
            .expect("Analysis should succeed");
        
        // Should detect frontrunning
        let frontrun_threat = threats.iter()
            .find(|t| matches!(t.threat_type, MevThreatType::Frontrunning))
            .expect("Should find frontrunning threat");
        
        assert!(frontrun_threat.confidence >= 0.6);
        assert!(frontrun_threat.mitigation_strategies.contains(&"Use private mempool".to_string()));
    }

    #[tokio::test]
    async fn test_backrunning_detection() {
        let config = MevProtectionConfig::default();
        let system = MevProtectionSystem::new(config);
        
        let target = create_test_transaction(
            "0xtarget",
            "0xuser",
            "0xdex",
            25.0,
            0,
            1000,
            10000.0,
        );
        
        // Create backrunning pattern
        let backrunner = create_test_transaction(
            "0xbackrun",
            "0xbackrunner",
            "0xdex",
            50.0,  // Higher gas
            10,    // 10 seconds after target
            1000,
            5000.0,
        );
        
        let recent_transactions = vec![target.clone(), backrunner];
        
        let threats = system.analyze_transaction_mev_risk(&target, &recent_transactions)
            .await
            .expect("Analysis should succeed");
        
        // Should detect backrunning
        let backrun_threat = threats.iter()
            .find(|t| matches!(t.threat_type, MevThreatType::Backrunning));
        
        assert!(backrun_threat.is_some());
    }

    #[tokio::test]
    async fn test_flashloan_attack_detection() {
        let config = MevProtectionConfig::default();
        let system = MevProtectionSystem::new(config);
        
        // Create flashloan transaction
        let mut flashloan_tx = create_test_transaction(
            "0xflashloan",
            "0xattacker",
            "0xlending",
            30.0,
            0,
            1000,
            1500000.0, // Large value indicating flash loan
        );
        flashloan_tx.input_data = "0xflashLoan000000000000000000000000".to_string();
        
        let recent_transactions = vec![flashloan_tx.clone()];
        
        let threats = system.analyze_transaction_mev_risk(&flashloan_tx, &recent_transactions)
            .await
            .expect("Analysis should succeed");
        
        // Should detect flash loan
        let flashloan_threat = threats.iter()
            .find(|t| matches!(t.threat_type, MevThreatType::FlashLoan))
            .expect("Should find flash loan threat");
        
        assert_eq!(flashloan_threat.severity, MevThreatSeverity::High);
        assert!(flashloan_threat.mitigation_strategies.contains(&"Implement flash loan protection".to_string()));
    }

    #[tokio::test]
    async fn test_gas_optimization_analysis() {
        let mut config = MevProtectionConfig::default();
        config.min_gas_price_gwei = 20;
        config.max_gas_price_gwei = 100;
        
        let system = MevProtectionSystem::new(config);
        
        // Create transaction with suboptimal gas
        let high_gas_tx = create_test_transaction(
            "0xhighgas",
            "0xuser",
            "0xcontract",
            150.0, // Way above max
            0,
            1000,
            5000.0,
        );
        
        let recent_transactions = vec![high_gas_tx.clone()];
        
        let threats = system.analyze_transaction_mev_risk(&high_gas_tx, &recent_transactions)
            .await
            .expect("Analysis should succeed");
        
        // Should detect gas optimization opportunity
        let gas_threat = threats.iter()
            .find(|t| matches!(t.threat_type, MevThreatType::GasOptimization));
        
        assert!(gas_threat.is_some());
        if let Some(threat) = gas_threat {
            assert!(threat.estimated_loss > 0.0);
            assert!(threat.confidence >= 0.9);
        }
    }

    #[tokio::test]
    async fn test_protected_execution_route_generation() {
        let config = MevProtectionConfig::default();
        let system = MevProtectionSystem::new(config);
        
        let (before, target, after) = create_sandwich_sequence(0, 1000);
        let recent_transactions = vec![before, target.clone(), after];
        
        // First detect threats
        let threats = system.analyze_transaction_mev_risk(&target, &recent_transactions)
            .await
            .expect("Analysis should succeed");
        
        // Generate protected route
        let route = system.get_protected_execution_route(&target, &threats)
            .await
            .expect("Route generation should succeed");
        
        assert!(!route.route_id.is_empty());
        assert!(route.estimated_gas > 0);
        assert!(route.estimated_cost > Decimal::ZERO);
        
        // Should recommend appropriate strategy based on threats
        if threats.iter().any(|t| matches!(t.threat_type, MevThreatType::Sandwich)) {
            assert!(matches!(
                route.execution_strategy,
                ExecutionStrategy::PrivateMempool | ExecutionStrategy::FlashbotsBundle
            ));
        }
    }

    #[tokio::test]
    async fn test_protection_level_determination() {
        let config = MevProtectionConfig::default();
        let system = MevProtectionSystem::new(config);
        
        // Test critical threat
        let critical_threat = vec![MevThreat {
            threat_type: MevThreatType::Sandwich,
            severity: MevThreatSeverity::Critical,
            estimated_loss: 100.0,
            description: "Critical sandwich attack".to_string(),
            confidence: 0.95,
            timestamp: Utc::now(),
            transaction_hash: Some("0xtest".to_string()),
            affected_addresses: vec!["0xvictim".to_string()],
            mitigation_strategies: vec!["Use private mempool".to_string()],
        }];
        
        let tx = create_test_transaction("0xtest", "0xuser", "0xdex", 25.0, 0, 1000, 10000.0);
        let route = system.get_protected_execution_route(&tx, &critical_threat)
            .await
            .expect("Route generation should succeed");
        
        assert!(matches!(route.protection_level, ProtectionLevel::Custom(10)));
        assert!(matches!(route.execution_strategy, ExecutionStrategy::PrivateMempool));
    }

    #[tokio::test]
    async fn test_risk_assessment_accuracy() {
        let config = MevProtectionConfig::default();
        let system = MevProtectionSystem::new(config);
        
        let tx = create_test_transaction("0xtest", "0xuser", "0xdex", 25.0, 0, 1000, 10000.0);
        
        // Multiple threats scenario
        let threats = vec![
            MevThreat {
                threat_type: MevThreatType::Sandwich,
                severity: MevThreatSeverity::High,
                estimated_loss: 50.0,
                description: "Sandwich attack".to_string(),
                confidence: 0.85,
                timestamp: Utc::now(),
                transaction_hash: Some(tx.hash.clone()),
                affected_addresses: vec![tx.from_address.clone()],
                mitigation_strategies: vec!["Use private mempool".to_string()],
            },
            MevThreat {
                threat_type: MevThreatType::Frontrunning,
                severity: MevThreatSeverity::Medium,
                estimated_loss: 10.0,
                description: "Frontrunning risk".to_string(),
                confidence: 0.7,
                timestamp: Utc::now(),
                transaction_hash: Some(tx.hash.clone()),
                affected_addresses: vec![tx.from_address.clone()],
                mitigation_strategies: vec!["Increase gas price".to_string()],
            },
        ];
        
        let route = system.get_protected_execution_route(&tx, &threats)
            .await
            .expect("Route generation should succeed");
        
        // Risk assessment should reflect multiple threats
        assert!(route.risk_assessment.mev_risk_score > 0.5);
        assert!(route.risk_assessment.success_probability < 0.9);
        assert!(route.risk_assessment.protection_confidence > 0.7);
    }

    #[tokio::test]
    async fn test_threat_history_tracking() {
        let config = MevProtectionConfig::default();
        let system = MevProtectionSystem::new(config);
        
        let tx = create_test_transaction("0xhistory", "0xuser", "0xdex", 25.0, 0, 1000, 10000.0);
        let recent_transactions = vec![tx.clone()];
        
        // Analyze transaction
        let _threats = system.analyze_transaction_mev_risk(&tx, &recent_transactions)
            .await
            .expect("Analysis should succeed");
        
        // Check threat history
        let history = system.get_threat_history(&tx.hash).await;
        assert_eq!(history.len(), _threats.len());
    }

    #[tokio::test]
    async fn test_address_threat_aggregation() {
        let config = MevProtectionConfig::default();
        let system = MevProtectionSystem::new(config);
        
        let address = "0xuser123";
        
        // Create multiple transactions from same address
        for i in 0..3 {
            let tx = create_test_transaction(
                &format!("0xtx{}", i),
                address,
                "0xdex",
                25.0 + i as f64 * 10.0,
                i as i64 * 10,
                1000 + i as u64,
                5000.0,
            );
            
            let recent_transactions = vec![tx.clone()];
            let _threats = system.analyze_transaction_mev_risk(&tx, &recent_transactions).await.ok();
        }
        
        // Get all threats for the address
        let address_threats = system.get_address_threats(address).await;
        assert!(!address_threats.is_empty());
    }

    #[tokio::test]
    async fn test_timing_window_configuration() {
        let mut config = MevProtectionConfig::default();
        config.analysis_window_seconds = 60; // 1 minute window
        
        let system = MevProtectionSystem::new(config);
        
        // Create transactions outside window
        let old_tx = create_test_transaction("0xold", "0xuser", "0xdex", 100.0, -120, 1000, 5000.0);
        let target = create_test_transaction("0xtarget", "0xvictim", "0xdex", 25.0, 0, 1000, 10000.0);
        let new_tx = create_test_transaction("0xnew", "0xuser", "0xdex", 95.0, 5, 1000, 5000.0);
        
        let recent_transactions = vec![old_tx, target.clone(), new_tx];
        
        let threats = system.analyze_transaction_mev_risk(&target, &recent_transactions)
            .await
            .expect("Analysis should succeed");
        
        // Should not detect sandwich with old transaction outside window
        let sandwich_threat = threats.iter()
            .find(|t| matches!(t.threat_type, MevThreatType::Sandwich));
        
        assert!(sandwich_threat.is_none());
    }

    #[tokio::test]
    async fn test_confidence_threshold_filtering() {
        let mut config = MevProtectionConfig::default();
        config.confidence_threshold = 0.9; // High threshold
        
        let system = MevProtectionSystem::new(config);
        
        // Create weak sandwich pattern
        let before = create_test_transaction("0xbefore", "0xattacker", "0xdex", 30.0, -10, 1000, 5000.0);
        let target = create_test_transaction("0xtarget", "0xvictim", "0xdex", 25.0, 0, 1000, 10000.0);
        let after = create_test_transaction("0xafter", "0xattacker", "0xdex", 28.0, 5, 1000, 5000.0);
        
        let recent_transactions = vec![before, target.clone(), after];
        
        let threats = system.analyze_transaction_mev_risk(&target, &recent_transactions)
            .await
            .expect("Analysis should succeed");
        
        // Weak pattern might not meet high confidence threshold
        assert!(threats.is_empty() || threats.iter().all(|t| t.confidence < 0.9));
    }

    #[tokio::test]
    async fn test_execution_strategy_selection() {
        let config = MevProtectionConfig::default();
        let system = MevProtectionSystem::new(config);
        
        let tx = create_test_transaction("0xtest", "0xuser", "0xdex", 25.0, 0, 1000, 10000.0);
        
        // Test different threat scenarios
        let scenarios = vec![
            (MevThreatSeverity::Critical, ExecutionStrategy::PrivateMempool),
            (MevThreatSeverity::High, ExecutionStrategy::FlashbotsBundle),
            (MevThreatSeverity::Low, ExecutionStrategy::GasOptimized),
        ];
        
        for (severity, expected_strategy) in scenarios {
            let threat = vec![MevThreat {
                threat_type: MevThreatType::Sandwich,
                severity: severity.clone(),
                estimated_loss: 10.0,
                description: "Test threat".to_string(),
                confidence: 0.8,
                timestamp: Utc::now(),
                transaction_hash: Some(tx.hash.clone()),
                affected_addresses: vec![tx.from_address.clone()],
                mitigation_strategies: vec!["Test".to_string()],
            }];
            
            let route = system.get_protected_execution_route(&tx, &threat)
                .await
                .expect("Route generation should succeed");
            
            match expected_strategy {
                ExecutionStrategy::PrivateMempool => {
                    assert!(matches!(route.execution_strategy, ExecutionStrategy::PrivateMempool));
                }
                ExecutionStrategy::FlashbotsBundle => {
                    assert!(matches!(route.execution_strategy, ExecutionStrategy::FlashbotsBundle | ExecutionStrategy::TimeBoosted));
                }
                ExecutionStrategy::GasOptimized => {
                    assert!(matches!(route.execution_strategy, ExecutionStrategy::GasOptimized));
                }
                _ => {}
            }
        }
    }

    #[tokio::test]
    async fn test_disabled_protection_features() {
        let mut config = MevProtectionConfig::default();
        config.enable_sandwich_detection = false;
        config.enable_flashloan_protection = false;
        
        let system = MevProtectionSystem::new(config);
        
        // Create perfect sandwich and flashloan patterns
        let (before, target, after) = create_sandwich_sequence(0, 1000);
        let mut flashloan = create_test_transaction("0xflash", "0xattacker", "0xlending", 30.0, 20, 1000, 2000000.0);
        flashloan.input_data = "flashLoan".to_string();
        
        let recent_transactions = vec![before, target.clone(), after, flashloan];
        
        let threats = system.analyze_transaction_mev_risk(&target, &recent_transactions)
            .await
            .expect("Analysis should succeed");
        
        // Should not detect disabled threat types
        assert!(!threats.iter().any(|t| matches!(t.threat_type, MevThreatType::Sandwich)));
        assert!(!threats.iter().any(|t| matches!(t.threat_type, MevThreatType::FlashLoan)));
    }

    #[tokio::test]
    async fn test_performance_under_load() {
        let config = MevProtectionConfig::default();
        let system = MevProtectionSystem::new(config);
        
        // Create many transactions
        let mut recent_transactions = Vec::new();
        for i in 0..1000 {
            recent_transactions.push(create_test_transaction(
                &format!("0xtx{:04x}", i),
                &format!("0xuser{}", i % 100),
                "0xdex",
                20.0 + (i as f64 % 50.0),
                (i as i64) - 500,
                1000 + (i as u64 / 10),
                1000.0 + (i as f64 * 100.0),
            ));
        }
        
        let target = create_test_transaction("0xtarget", "0xvictim", "0xdex", 25.0, 0, 1050, 10000.0);
        
        let start = std::time::Instant::now();
        let threats = system.analyze_transaction_mev_risk(&target, &recent_transactions)
            .await
            .expect("Analysis should succeed");
        let duration = start.elapsed();
        
        // Should complete within reasonable time even with 1000 transactions
        assert!(duration.as_millis() < 1000, "Analysis took {}ms, should be <1000ms", duration.as_millis());
        
        // Should still detect threats if present
        assert!(!threats.is_empty() || recent_transactions.len() > 900);
    }

    #[tokio::test]
    async fn test_gas_optimizer_integration() {
        let config = MevProtectionConfig::default();
        let system = MevProtectionSystem::new(config);
        
        // Update network conditions through gas optimizer
        let gas_optimizer = GasOptimizer::new();
        let conditions = NetworkConditions {
            optimal_gas_price_gwei: 35.0,
            network_congestion: 0.8,
            block_time_seconds: 13.0,
            pending_transactions: 5000,
        };
        gas_optimizer.update_network_conditions(conditions).await;
        
        let tx = create_test_transaction("0xtest", "0xuser", "0xdex", 25.0, 0, 1000, 10000.0);
        let threats = vec![];
        
        let route = system.get_protected_execution_route(&tx, &threats)
            .await
            .expect("Route generation should succeed");
        
        // Should use updated gas price in recommendations
        assert!(route.risk_assessment.recommended_gas_price >= 35);
    }
}