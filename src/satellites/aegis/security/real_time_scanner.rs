use crate::security::{
    SmartContractVulnerabilityDetector, AdvancedTransactionPatternMonitor, AuditDatabaseManager,
    ContractAnalysisRequest, AnalysisPriority, VulnerabilityReport, VulnerabilityDetectionError
};
use crate::types::{PositionId, RiskAlert, AlertType, RiskLevel};
use async_trait::async_trait;
use dashmap::DashMap;
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, VecDeque};
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::{RwLock, mpsc, Semaphore};
use tokio::time::{interval, Instant};
use tracing::{info, warn, debug, error};
use uuid::Uuid;
use chrono::{DateTime, Utc};

#[derive(Debug, Clone)]
pub struct RealTimeVulnerabilityScanner {
    vulnerability_detector: Arc<SmartContractVulnerabilityDetector>,
    transaction_monitor: Arc<AdvancedTransactionPatternMonitor>,
    audit_database_manager: Arc<AuditDatabaseManager>,
    monitored_contracts: Arc<DashMap<String, MonitoredContract>>,
    scan_queue: Arc<RwLock<VecDeque<ScanRequest>>>,
    scan_results: Arc<DashMap<String, ScanResult>>,
    alert_sender: mpsc::UnboundedSender<SecurityAlert>,
    config: Arc<RwLock<ScannerConfig>>,
    concurrency_limiter: Arc<Semaphore>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MonitoredContract {
    pub address: String,
    pub added_at: DateTime<Utc>,
    pub last_scanned: Option<DateTime<Utc>>,
    pub scan_frequency_minutes: u32,
    pub priority: MonitoringPriority,
    pub associated_positions: Vec<PositionId>,
    pub risk_threshold: u8,
    pub enable_real_time_monitoring: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum MonitoringPriority {
    Critical,  // Scan every 5 minutes
    High,      // Scan every 15 minutes  
    Medium,    // Scan every 60 minutes
    Low,       // Scan every 6 hours
}

impl MonitoringPriority {
    pub fn scan_interval_minutes(&self) -> u32 {
        match self {
            MonitoringPriority::Critical => 5,
            MonitoringPriority::High => 15,
            MonitoringPriority::Medium => 60,
            MonitoringPriority::Low => 360,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScanRequest {
    pub contract_address: String,
    pub priority: AnalysisPriority,
    pub requested_at: DateTime<Utc>,
    pub requested_by: Option<String>,
    pub position_ids: Vec<PositionId>,
    pub scan_type: ScanType,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ScanType {
    Full,              // Complete vulnerability analysis
    Incremental,       // Check for new vulnerabilities only
    Transaction,       // Transaction pattern analysis only
    AuditDatabase,     // Audit database check only
    Emergency,         // Immediate high-priority scan
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScanResult {
    pub contract_address: String,
    pub scan_id: Uuid,
    pub scanned_at: DateTime<Utc>,
    pub scan_type: ScanType,
    pub vulnerability_report: Option<VulnerabilityReport>,
    pub new_vulnerabilities: Vec<String>, // IDs of newly discovered vulnerabilities
    pub risk_score_change: Option<i8>,    // Change in risk score since last scan
    pub scan_duration_ms: u64,
    pub errors: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SecurityAlert {
    pub id: Uuid,
    pub alert_type: SecurityAlertType,
    pub contract_address: String,
    pub severity: SecurityAlertSeverity,
    pub title: String,
    pub description: String,
    pub vulnerability_ids: Vec<String>,
    pub affected_positions: Vec<PositionId>,
    pub recommended_actions: Vec<String>,
    pub created_at: DateTime<Utc>,
    pub expires_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SecurityAlertType {
    NewVulnerability,
    RiskScoreIncrease,
    SuspiciousTransaction,
    ExploitDetected,
    AuditFinding,
    SystemAnomaly,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SecurityAlertSeverity {
    Info,
    Low,
    Medium,
    High,
    Critical,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScannerConfig {
    pub max_concurrent_scans: usize,
    pub scan_timeout_seconds: u64,
    pub enable_continuous_monitoring: bool,
    pub enable_transaction_monitoring: bool,
    pub enable_audit_database_checks: bool,
    pub alert_on_new_vulnerabilities: bool,
    pub alert_on_risk_score_increase: u8, // Minimum increase to trigger alert
    pub max_scan_queue_size: usize,
    pub cleanup_interval_hours: u64,
}

impl Default for ScannerConfig {
    fn default() -> Self {
        Self {
            max_concurrent_scans: 5,
            scan_timeout_seconds: 300, // 5 minutes
            enable_continuous_monitoring: true,
            enable_transaction_monitoring: true,
            enable_audit_database_checks: true,
            alert_on_new_vulnerabilities: true,
            alert_on_risk_score_increase: 10,
            max_scan_queue_size: 1000,
            cleanup_interval_hours: 24,
        }
    }
}

impl RealTimeVulnerabilityScanner {
    pub fn new(
        vulnerability_detector: Arc<SmartContractVulnerabilityDetector>,
        transaction_monitor: Arc<AdvancedTransactionPatternMonitor>,
        audit_database_manager: Arc<AuditDatabaseManager>,
    ) -> (Self, mpsc::UnboundedReceiver<SecurityAlert>) {
        let (alert_sender, alert_receiver) = mpsc::unbounded_channel();
        let config = ScannerConfig::default();
        
        let scanner = Self {
            vulnerability_detector,
            transaction_monitor,
            audit_database_manager,
            monitored_contracts: Arc::new(DashMap::new()),
            scan_queue: Arc::new(RwLock::new(VecDeque::new())),
            scan_results: Arc::new(DashMap::new()),
            alert_sender,
            config: Arc::new(RwLock::new(config.clone())),
            concurrency_limiter: Arc::new(Semaphore::new(config.max_concurrent_scans)),
        };

        (scanner, alert_receiver)
    }

    pub async fn start(&self) -> Result<(), VulnerabilityDetectionError> {
        info!("Starting real-time vulnerability scanner");

        let config = self.config.read().await;
        
        if config.enable_continuous_monitoring {
            // Start continuous monitoring task
            let scanner = self.clone();
            tokio::spawn(async move {
                scanner.continuous_monitoring_loop().await;
            });
        }

        // Start scan queue processor
        let scanner = self.clone();
        tokio::spawn(async move {
            scanner.process_scan_queue().await;
        });

        // Start cleanup task
        let scanner = self.clone();
        tokio::spawn(async move {
            scanner.cleanup_task().await;
        });

        info!("Real-time vulnerability scanner started successfully");
        Ok(())
    }

    pub async fn add_contract_to_monitoring(
        &self,
        address: String,
        priority: MonitoringPriority,
        position_ids: Vec<PositionId>,
    ) -> Result<(), VulnerabilityDetectionError> {
        let contract = MonitoredContract {
            address: address.clone(),
            added_at: Utc::now(),
            last_scanned: None,
            scan_frequency_minutes: priority.scan_interval_minutes(),
            priority,
            associated_positions: position_ids,
            risk_threshold: 70, // Default threshold
            enable_real_time_monitoring: true,
        };

        self.monitored_contracts.insert(address.clone(), contract);
        
        // Queue immediate scan for new contract
        self.queue_scan(ScanRequest {
            contract_address: address.clone(),
            priority: AnalysisPriority::High,
            requested_at: Utc::now(),
            requested_by: Some("monitoring_system".to_string()),
            position_ids: vec![],
            scan_type: ScanType::Full,
        }).await?;

        info!("Added contract {} to real-time monitoring", address);
        Ok(())
    }

    pub async fn queue_scan(&self, request: ScanRequest) -> Result<(), VulnerabilityDetectionError> {
        let mut queue = self.scan_queue.write().await;
        let config = self.config.read().await;

        if queue.len() >= config.max_scan_queue_size {
            // Remove oldest non-emergency scans
            while queue.len() >= config.max_scan_queue_size {
                if let Some(front) = queue.front() {
                    if !matches!(front.scan_type, ScanType::Emergency) {
                        queue.pop_front();
                    } else {
                        break;
                    }
                } else {
                    break;
                }
            }

            if queue.len() >= config.max_scan_queue_size {
                return Err(VulnerabilityDetectionError::ConfigError {
                    message: "Scan queue is full and cannot accept new requests".to_string(),
                });
            }
        }

        // Insert based on priority (emergency scans go to front)
        match request.scan_type {
            ScanType::Emergency => queue.push_front(request),
            _ => queue.push_back(request),
        }

        debug!("Queued scan for contract: {}", request.contract_address);
        Ok(())
    }

    async fn continuous_monitoring_loop(&self) {
        let mut monitoring_interval = interval(Duration::from_secs(60)); // Check every minute

        loop {
            monitoring_interval.tick().await;
            
            let now = Utc::now();
            let mut contracts_to_scan = Vec::new();

            // Check which contracts need scanning
            for contract_ref in self.monitored_contracts.iter() {
                let contract = contract_ref.value();
                
                if !contract.enable_real_time_monitoring {
                    continue;
                }

                let should_scan = if let Some(last_scanned) = contract.last_scanned {
                    let minutes_since_scan = now.signed_duration_since(last_scanned).num_minutes();
                    minutes_since_scan >= contract.scan_frequency_minutes as i64
                } else {
                    true // Never scanned
                };

                if should_scan {
                    contracts_to_scan.push(contract.address.clone());
                }
            }

            // Queue scans for contracts that need them
            for contract_address in contracts_to_scan {
                if let Some(contract) = self.monitored_contracts.get(&contract_address) {
                    let scan_request = ScanRequest {
                        contract_address: contract_address.clone(),
                        priority: match contract.priority {
                            MonitoringPriority::Critical => AnalysisPriority::Critical,
                            MonitoringPriority::High => AnalysisPriority::High,
                            _ => AnalysisPriority::Normal,
                        },
                        requested_at: now,
                        requested_by: Some("continuous_monitoring".to_string()),
                        position_ids: contract.associated_positions.clone(),
                        scan_type: ScanType::Incremental,
                    };

                    if let Err(e) = self.queue_scan(scan_request).await {
                        warn!("Failed to queue scan for {}: {}", contract_address, e);
                    }
                }
            }

            if !contracts_to_scan.is_empty() {
                debug!("Queued {} contracts for scanning", contracts_to_scan.len());
            }
        }
    }

    async fn process_scan_queue(&self) {
        let mut processing_interval = interval(Duration::from_secs(5)); // Process every 5 seconds

        loop {
            processing_interval.tick().await;

            // Get next scan request
            let request = {
                let mut queue = self.scan_queue.write().await;
                queue.pop_front()
            };

            if let Some(scan_request) = request {
                // Acquire semaphore permit for concurrency control
                let permit = self.concurrency_limiter.acquire().await;
                
                match permit {
                    Ok(_permit) => {
                        let scanner = self.clone();
                        let request = scan_request.clone();
                        
                        tokio::spawn(async move {
                            if let Err(e) = scanner.execute_scan(request).await {
                                error!("Scan execution failed: {}", e);
                            }
                            // Permit is automatically released when _permit goes out of scope
                        });
                    }
                    Err(e) => {
                        error!("Failed to acquire scan permit: {}", e);
                        // Re-queue the request
                        let mut queue = self.scan_queue.write().await;
                        queue.push_front(scan_request);
                    }
                }
            }
        }
    }

    async fn execute_scan(&self, request: ScanRequest) -> Result<(), VulnerabilityDetectionError> {
        let start_time = Instant::now();
        let scan_id = Uuid::new_v4();
        
        info!("Executing {} scan for contract: {} (ID: {})", 
              format!("{:?}", request.scan_type), request.contract_address, scan_id);

        let mut vulnerability_report = None;
        let mut new_vulnerabilities = Vec::new();
        let mut errors = Vec::new();

        // Get previous scan result for comparison
        let previous_result = self.scan_results.get(&request.contract_address);
        let previous_risk_score = previous_result.as_ref()
            .and_then(|r| r.vulnerability_report.as_ref())
            .map(|vr| vr.risk_score);

        match request.scan_type {
            ScanType::Full | ScanType::Incremental => {
                // Full vulnerability analysis
                let analysis_request = ContractAnalysisRequest {
                    contract_address: request.contract_address.clone(),
                    chain_id: 1, // Ethereum mainnet
                    priority: request.priority,
                    requested_by: request.requested_by.clone(),
                    position_ids: request.position_ids.clone(),
                };

                match self.vulnerability_detector.analyze_contract(analysis_request).await {
                    Ok(report) => {
                        // Check for new vulnerabilities
                        if let Some(prev_result) = previous_result.as_ref() {
                            if let Some(prev_report) = &prev_result.vulnerability_report {
                                let prev_vuln_ids: std::collections::HashSet<&String> = 
                                    prev_report.vulnerabilities.iter().map(|v| &v.id).collect();
                                
                                for vuln in &report.vulnerabilities {
                                    if !prev_vuln_ids.contains(&vuln.id) {
                                        new_vulnerabilities.push(vuln.id.clone());
                                    }
                                }
                            }
                        } else {
                            // First scan - all vulnerabilities are "new"
                            new_vulnerabilities = report.vulnerabilities.iter().map(|v| v.id.clone()).collect();
                        }

                        vulnerability_report = Some(report);
                    }
                    Err(e) => {
                        errors.push(format!("Vulnerability analysis failed: {}", e));
                    }
                }
            }
            ScanType::Transaction => {
                // Transaction pattern analysis only
                match self.transaction_monitor.analyze_patterns(&request.contract_address).await {
                    Ok(_analysis_result) => {
                        // Transaction analysis doesn't update vulnerability report directly
                        // but may generate separate alerts
                    }
                    Err(e) => {
                        errors.push(format!("Transaction analysis failed: {}", e));
                    }
                }
            }
            ScanType::AuditDatabase => {
                // Audit database check only
                match self.audit_database_manager.check_all_databases(&request.contract_address).await {
                    Ok(audit_vulnerabilities) => {
                        if !audit_vulnerabilities.is_empty() {
                            // Create a minimal report with audit findings
                            // This is a simplified version - real implementation would merge properly
                            new_vulnerabilities = audit_vulnerabilities.iter().map(|v| v.id.clone()).collect();
                        }
                    }
                    Err(e) => {
                        errors.push(format!("Audit database check failed: {}", e));
                    }
                }
            }
            ScanType::Emergency => {
                // Emergency scan - run all checks with highest priority
                // This would be similar to Full but with different timeout and priority handling
            }
        }

        let scan_duration = start_time.elapsed();
        
        // Calculate risk score change
        let risk_score_change = if let (Some(current), Some(previous)) = 
            (vulnerability_report.as_ref().map(|r| r.risk_score), previous_risk_score) {
            Some(current as i8 - previous as i8)
        } else {
            None
        };

        // Create scan result
        let scan_result = ScanResult {
            contract_address: request.contract_address.clone(),
            scan_id,
            scanned_at: Utc::now(),
            scan_type: request.scan_type,
            vulnerability_report: vulnerability_report.clone(),
            new_vulnerabilities: new_vulnerabilities.clone(),
            risk_score_change,
            scan_duration_ms: scan_duration.as_millis() as u64,
            errors,
        };

        // Store scan result
        self.scan_results.insert(request.contract_address.clone(), scan_result);

        // Update last scanned time for monitored contract
        if let Some(mut contract) = self.monitored_contracts.get_mut(&request.contract_address) {
            contract.last_scanned = Some(Utc::now());
        }

        // Generate alerts if necessary
        self.generate_alerts(&request, &vulnerability_report, &new_vulnerabilities, risk_score_change).await;

        info!("Scan completed for {} in {}ms. Found {} new vulnerabilities", 
              request.contract_address, scan_duration.as_millis(), new_vulnerabilities.len());

        Ok(())
    }

    async fn generate_alerts(
        &self,
        request: &ScanRequest,
        vulnerability_report: &Option<VulnerabilityReport>,
        new_vulnerabilities: &[String],
        risk_score_change: Option<i8>,
    ) {
        let config = self.config.read().await;

        // Alert on new vulnerabilities
        if config.alert_on_new_vulnerabilities && !new_vulnerabilities.is_empty() {
            let severity = if let Some(report) = vulnerability_report {
                if report.risk_score >= 90 {
                    SecurityAlertSeverity::Critical
                } else if report.risk_score >= 70 {
                    SecurityAlertSeverity::High
                } else if report.risk_score >= 50 {
                    SecurityAlertSeverity::Medium
                } else {
                    SecurityAlertSeverity::Low
                }
            } else {
                SecurityAlertSeverity::Medium
            };

            let alert = SecurityAlert {
                id: Uuid::new_v4(),
                alert_type: SecurityAlertType::NewVulnerability,
                contract_address: request.contract_address.clone(),
                severity,
                title: format!("New Vulnerabilities Detected in {}", request.contract_address),
                description: format!("Detected {} new vulnerabilities during security scan", new_vulnerabilities.len()),
                vulnerability_ids: new_vulnerabilities.to_vec(),
                affected_positions: request.position_ids.clone(),
                recommended_actions: vec![
                    "Review vulnerability details immediately".to_string(),
                    "Assess impact on associated positions".to_string(),
                    "Consider reducing exposure if high severity".to_string(),
                ],
                created_at: Utc::now(),
                expires_at: Some(Utc::now() + chrono::Duration::hours(24)),
            };

            if let Err(e) = self.alert_sender.send(alert) {
                error!("Failed to send new vulnerability alert: {}", e);
            }
        }

        // Alert on significant risk score increase
        if let Some(change) = risk_score_change {
            if change >= config.alert_on_risk_score_increase as i8 {
                let alert = SecurityAlert {
                    id: Uuid::new_v4(),
                    alert_type: SecurityAlertType::RiskScoreIncrease,
                    contract_address: request.contract_address.clone(),
                    severity: if change >= 20 {
                        SecurityAlertSeverity::High
                    } else if change >= 10 {
                        SecurityAlertSeverity::Medium
                    } else {
                        SecurityAlertSeverity::Low
                    },
                    title: format!("Risk Score Increase for {}", request.contract_address),
                    description: format!("Risk score increased by {} points", change),
                    vulnerability_ids: new_vulnerabilities.to_vec(),
                    affected_positions: request.position_ids.clone(),
                    recommended_actions: vec![
                        "Review recent vulnerability findings".to_string(),
                        "Reassess position risk levels".to_string(),
                        "Consider implementing additional safeguards".to_string(),
                    ],
                    created_at: Utc::now(),
                    expires_at: Some(Utc::now() + chrono::Duration::hours(12)),
                };

                if let Err(e) = self.alert_sender.send(alert) {
                    error!("Failed to send risk score increase alert: {}", e);
                }
            }
        }
    }

    async fn cleanup_task(&self) {
        let config = self.config.read().await;
        let mut cleanup_interval = interval(Duration::from_secs(config.cleanup_interval_hours * 3600));
        drop(config);

        loop {
            cleanup_interval.tick().await;
            
            let config = self.config.read().await;
            let cutoff_time = Utc::now() - chrono::Duration::hours(config.cleanup_interval_hours as i64 * 2);
            drop(config);

            // Clean up old scan results
            let mut expired_keys = Vec::new();
            for entry in self.scan_results.iter() {
                if entry.value().scanned_at < cutoff_time {
                    expired_keys.push(entry.key().clone());
                }
            }

            for key in expired_keys {
                self.scan_results.remove(&key);
            }

            // Clean up audit database cache
            self.audit_database_manager.cleanup_cache().await;

            debug!("Completed periodic cleanup of scanner data");
        }
    }

    pub async fn get_scan_result(&self, contract_address: &str) -> Option<ScanResult> {
        self.scan_results.get(contract_address).map(|r| r.clone())
    }

    pub async fn get_monitored_contracts(&self) -> Vec<MonitoredContract> {
        self.monitored_contracts.iter().map(|entry| entry.value().clone()).collect()
    }

    pub async fn remove_contract_from_monitoring(&self, contract_address: &str) -> bool {
        self.monitored_contracts.remove(contract_address).is_some()
    }
}

impl Clone for RealTimeVulnerabilityScanner {
    fn clone(&self) -> Self {
        Self {
            vulnerability_detector: self.vulnerability_detector.clone(),
            transaction_monitor: self.transaction_monitor.clone(),
            audit_database_manager: self.audit_database_manager.clone(),
            monitored_contracts: self.monitored_contracts.clone(),
            scan_queue: self.scan_queue.clone(),
            scan_results: self.scan_results.clone(),
            alert_sender: self.alert_sender.clone(),
            config: self.config.clone(),
            concurrency_limiter: self.concurrency_limiter.clone(),
        }
    }
}