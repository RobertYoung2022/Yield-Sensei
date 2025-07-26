use crate::security::vulnerability_detector::{
    AuditDatabase, Vulnerability, VulnerabilitySeverity, VulnerabilityCategory, VulnerabilityDetectionError
};
use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{info, warn, debug, error};
use chrono::{DateTime, Utc};
use reqwest::Client;

#[derive(Debug, Clone)]
pub struct AuditDatabaseManager {
    databases: Vec<Box<dyn AuditDatabase>>,
    cache: Arc<RwLock<HashMap<String, CachedAuditResult>>>,
    config: AuditDatabaseConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuditDatabaseConfig {
    pub cache_duration_hours: u64,
    pub max_concurrent_queries: usize,
    pub timeout_seconds: u64,
    pub enable_caching: bool,
}

impl Default for AuditDatabaseConfig {
    fn default() -> Self {
        Self {
            cache_duration_hours: 24,
            max_concurrent_queries: 10,
            timeout_seconds: 30,
            enable_caching: true,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CachedAuditResult {
    pub vulnerabilities: Vec<Vulnerability>,
    pub cached_at: DateTime<Utc>,
    pub source_database: String,
}

impl AuditDatabaseManager {
    pub fn new(config: AuditDatabaseConfig) -> Self {
        let mut manager = Self {
            databases: Vec::new(),
            cache: Arc::new(RwLock::new(HashMap::new())),
            config,
        };

        // Initialize default audit databases
        manager.add_database(Box::new(CertiKDatabase::new()));
        manager.add_database(Box::new(SlitherDatabase::new()));
        manager.add_database(Box::new(MythXDatabase::new()));
        manager.add_database(Box::new(CodeArenaDatabase::new()));
        manager.add_database(Box::new(ImmuneFiDatabase::new()));
        manager.add_database(Box::new(OpenZeppelinDatabase::new()));

        manager
    }

    pub fn add_database(&mut self, database: Box<dyn AuditDatabase>) {
        info!("Adding audit database: {}", database.name());
        self.databases.push(database);
    }

    pub async fn check_all_databases(&self, contract_address: &str) -> Result<Vec<Vulnerability>, VulnerabilityDetectionError> {
        info!("Checking contract {} against {} audit databases", contract_address, self.databases.len());

        let mut all_vulnerabilities = Vec::new();

        // Check cache first
        if self.config.enable_caching {
            if let Some(cached_result) = self.get_cached_result(contract_address).await {
                debug!("Using cached audit results for {}", contract_address);
                return Ok(cached_result.vulnerabilities);
            }
        }

        // Query all databases concurrently
        let mut handles = Vec::new();
        
        for database in &self.databases {
            let db_name = database.name();
            let contract_addr = contract_address.to_string();
            
            // Create a future for each database query
            let handle = tokio::spawn(async move {
                // Note: Can't move database directly due to trait object limitations
                // In real implementation, would clone database or use Arc
                (db_name, Vec::<Vulnerability>::new()) // Placeholder
            });
            
            handles.push(handle);
        }

        // Process database queries sequentially for now (due to trait object limitations)
        for database in &self.databases {
            match database.check_contract(contract_address).await {
                Ok(mut vulnerabilities) => {
                    debug!("Found {} vulnerabilities from {}", vulnerabilities.len(), database.name());
                    all_vulnerabilities.append(&mut vulnerabilities);
                }
                Err(e) => {
                    warn!("Failed to query {}: {}", database.name(), e);
                }
            }
        }

        // Cache the results
        if self.config.enable_caching && !all_vulnerabilities.is_empty() {
            self.cache_result(contract_address, &all_vulnerabilities, "combined").await;
        }

        info!("Audit database check completed. Found {} total vulnerabilities", all_vulnerabilities.len());
        Ok(all_vulnerabilities)
    }

    async fn get_cached_result(&self, contract_address: &str) -> Option<CachedAuditResult> {
        let cache = self.cache.read().await;
        
        if let Some(cached) = cache.get(contract_address) {
            let age = Utc::now().signed_duration_since(cached.cached_at);
            if age.num_hours() < self.config.cache_duration_hours as i64 {
                return Some(cached.clone());
            }
        }
        
        None
    }

    async fn cache_result(&self, contract_address: &str, vulnerabilities: &[Vulnerability], source: &str) {
        let mut cache = self.cache.write().await;
        
        cache.insert(contract_address.to_string(), CachedAuditResult {
            vulnerabilities: vulnerabilities.to_vec(),
            cached_at: Utc::now(),
            source_database: source.to_string(),
        });
    }

    pub async fn cleanup_cache(&self) {
        let mut cache = self.cache.write().await;
        let cutoff_time = Utc::now() - chrono::Duration::hours(self.config.cache_duration_hours as i64);
        
        cache.retain(|_, result| result.cached_at >= cutoff_time);
        
        debug!("Cleaned up expired audit cache entries");
    }
}

// CertiK Database Implementation
#[derive(Debug)]
pub struct CertiKDatabase {
    client: Client,
    api_key: Option<String>,
}

impl CertiKDatabase {
    pub fn new() -> Self {
        Self {
            client: Client::new(),
            api_key: std::env::var("CERTIK_API_KEY").ok(),
        }
    }
}

#[async_trait]
impl AuditDatabase for CertiKDatabase {
    async fn check_contract(&self, contract_address: &str) -> Result<Vec<Vulnerability>, Box<dyn std::error::Error + Send + Sync>> {
        debug!("Checking CertiK database for contract: {}", contract_address);
        
        // In a real implementation, this would query CertiK's API
        // For now, return mock vulnerabilities for demonstration
        Ok(vec![
            Vulnerability {
                id: "certik_001".to_string(),
                severity: VulnerabilitySeverity::Medium,
                category: VulnerabilityCategory::AccessControl,
                description: "Missing access control on administrative function".to_string(),
                impact: "Unauthorized users may access admin functionality".to_string(),
                confidence: 85,
                cvss_score: Some(6.5),
                cwe_id: Some("CWE-284".to_string()),
                affected_functions: vec!["setOwner".to_string()],
                proof_of_concept: None,
                remediation: Some("Add onlyOwner modifier to administrative functions".to_string()),
            }
        ])
    }

    fn name(&self) -> String {
        "CertiK".to_string()
    }
}

// Slither Database Implementation
#[derive(Debug)]
pub struct SlitherDatabase;

impl SlitherDatabase {
    pub fn new() -> Self {
        Self
    }
}

#[async_trait]
impl AuditDatabase for SlitherDatabase {
    async fn check_contract(&self, contract_address: &str) -> Result<Vec<Vulnerability>, Box<dyn std::error::Error + Send + Sync>> {
        debug!("Checking Slither database for contract: {}", contract_address);
        
        // Mock Slither analysis results
        Ok(vec![
            Vulnerability {
                id: "slither_reentrancy_001".to_string(),
                severity: VulnerabilitySeverity::High,
                category: VulnerabilityCategory::Reentrancy,
                description: "Reentrancy vulnerability in withdraw function".to_string(),
                impact: "Attacker can drain contract funds through reentrancy".to_string(),
                confidence: 95,
                cvss_score: Some(8.5),
                cwe_id: Some("CWE-841".to_string()),
                affected_functions: vec!["withdraw".to_string()],
                proof_of_concept: Some("External call before state update in withdraw function".to_string()),
                remediation: Some("Use reentrancy guard or checks-effects-interactions pattern".to_string()),
            },
            Vulnerability {
                id: "slither_timestamp_001".to_string(),
                severity: VulnerabilitySeverity::Low,
                category: VulnerabilityCategory::Logic,
                description: "Dependency on block.timestamp".to_string(),
                impact: "Miners can manipulate timestamp within ~15 seconds".to_string(),
                confidence: 70,
                cvss_score: Some(3.0),
                cwe_id: Some("CWE-829".to_string()),
                affected_functions: vec!["checkDeadline".to_string()],
                proof_of_concept: None,
                remediation: Some("Use block.number for time-dependent logic or add tolerance".to_string()),
            }
        ])
    }

    fn name(&self) -> String {
        "Slither".to_string()
    }
}

// MythX Database Implementation
#[derive(Debug)]
pub struct MythXDatabase {
    client: Client,
    api_key: Option<String>,
}

impl MythXDatabase {
    pub fn new() -> Self {
        Self {
            client: Client::new(),
            api_key: std::env::var("MYTHX_API_KEY").ok(),
        }
    }
}

#[async_trait]
impl AuditDatabase for MythXDatabase {
    async fn check_contract(&self, contract_address: &str) -> Result<Vec<Vulnerability>, Box<dyn std::error::Error + Send + Sync>> {
        debug!("Checking MythX database for contract: {}", contract_address);
        
        // Mock MythX analysis results
        Ok(vec![
            Vulnerability {
                id: "mythx_integer_overflow_001".to_string(),
                severity: VulnerabilitySeverity::Medium,
                category: VulnerabilityCategory::IntegerOverflow,
                description: "Potential integer overflow in arithmetic operation".to_string(),
                impact: "Arithmetic overflow could lead to unexpected behavior".to_string(),
                confidence: 80,
                cvss_score: Some(5.5),
                cwe_id: Some("CWE-190".to_string()),
                affected_functions: vec!["calculateReward".to_string()],
                proof_of_concept: Some("Addition operation without overflow check".to_string()),
                remediation: Some("Use SafeMath library or Solidity 0.8+ overflow protection".to_string()),
            }
        ])
    }

    fn name(&self) -> String {
        "MythX".to_string()
    }
}

// Code Arena Database Implementation
#[derive(Debug)]
pub struct CodeArenaDatabase {
    client: Client,
}

impl CodeArenaDatabase {
    pub fn new() -> Self {
        Self {
            client: Client::new(),
        }
    }
}

#[async_trait]
impl AuditDatabase for CodeArenaDatabase {
    async fn check_contract(&self, contract_address: &str) -> Result<Vec<Vulnerability>, Box<dyn std::error::Error + Send + Sync>> {
        debug!("Checking Code Arena database for contract: {}", contract_address);
        
        // Mock Code Arena contest results
        Ok(vec![
            Vulnerability {
                id: "code4rena_001".to_string(),
                severity: VulnerabilitySeverity::High,
                category: VulnerabilityCategory::Oracle,
                description: "Oracle price manipulation vulnerability".to_string(),
                impact: "Attacker can manipulate price feeds for economic gain".to_string(),
                confidence: 90,
                cvss_score: Some(7.8),
                cwe_id: Some("CWE-345".to_string()),
                affected_functions: vec!["getPrice".to_string(), "liquidate".to_string()],
                proof_of_concept: Some("Single oracle source without validation".to_string()),
                remediation: Some("Use multiple oracle sources with price deviation checks".to_string()),
            }
        ])
    }

    fn name(&self) -> String {
        "Code4rena".to_string()
    }
}

// ImmuneFi Database Implementation
#[derive(Debug)]
pub struct ImmuneFiDatabase {
    client: Client,
}

impl ImmuneFiDatabase {
    pub fn new() -> Self {
        Self {
            client: Client::new(),
        }
    }
}

#[async_trait]
impl AuditDatabase for ImmuneFiDatabase {
    async fn check_contract(&self, contract_address: &str) -> Result<Vec<Vulnerability>, Box<dyn std::error::Error + Send + Sync>> {
        debug!("Checking ImmuneFi database for contract: {}", contract_address);
        
        // Mock ImmuneFi bug bounty results
        Ok(vec![
            Vulnerability {
                id: "immunefi_flashloan_001".to_string(),
                severity: VulnerabilitySeverity::Critical,
                category: VulnerabilityCategory::Flashloan,
                description: "Flash loan attack vector in liquidity calculation".to_string(),
                impact: "Attacker can manipulate liquidity calculations using flash loans".to_string(),
                confidence: 95,
                cvss_score: Some(9.2),
                cwe_id: None,
                affected_functions: vec!["calculateLiquidity".to_string(), "borrow".to_string()],
                proof_of_concept: Some("Balance-based liquidity calculation vulnerable to flash loan manipulation".to_string()),
                remediation: Some("Use time-weighted average or implement flash loan protection".to_string()),
            }
        ])
    }

    fn name(&self) -> String {
        "ImmuneFi".to_string()
    }
}

// OpenZeppelin Database Implementation
#[derive(Debug)]
pub struct OpenZeppelinDatabase {
    client: Client,
}

impl OpenZeppelinDatabase {
    pub fn new() -> Self {
        Self {
            client: Client::new(),
        }
    }
}

#[async_trait]
impl AuditDatabase for OpenZeppelinDatabase {
    async fn check_contract(&self, contract_address: &str) -> Result<Vec<Vulnerability>, Box<dyn std::error::Error + Send + Sync>> {
        debug!("Checking OpenZeppelin database for contract: {}", contract_address);
        
        // Mock OpenZeppelin audit results
        Ok(vec![
            Vulnerability {
                id: "openzeppelin_governance_001".to_string(),
                severity: VulnerabilitySeverity::Medium,
                category: VulnerabilityCategory::Governance,
                description: "Centralized governance control".to_string(),
                impact: "Single point of failure in governance mechanism".to_string(),
                confidence: 75,
                cvss_score: Some(5.8),
                cwe_id: Some("CWE-284".to_string()),
                affected_functions: vec!["propose".to_string(), "execute".to_string()],
                proof_of_concept: None,
                remediation: Some("Implement multi-sig governance or time delays".to_string()),
            }
        ])
    }

    fn name(&self) -> String {
        "OpenZeppelin".to_string()
    }
}

// Database factory for creating audit database instances
pub struct AuditDatabaseFactory;

impl AuditDatabaseFactory {
    pub fn create_all_databases() -> Vec<Box<dyn AuditDatabase>> {
        vec![
            Box::new(CertiKDatabase::new()),
            Box::new(SlitherDatabase::new()),
            Box::new(MythXDatabase::new()),
            Box::new(CodeArenaDatabase::new()),
            Box::new(ImmuneFiDatabase::new()),
            Box::new(OpenZeppelinDatabase::new()),
        ]
    }

    pub fn create_database(name: &str) -> Option<Box<dyn AuditDatabase>> {
        match name.to_lowercase().as_str() {
            "certik" => Some(Box::new(CertiKDatabase::new())),
            "slither" => Some(Box::new(SlitherDatabase::new())),
            "mythx" => Some(Box::new(MythXDatabase::new())),
            "code4rena" | "codearena" => Some(Box::new(CodeArenaDatabase::new())),
            "immunefi" => Some(Box::new(ImmuneFiDatabase::new())),
            "openzeppelin" => Some(Box::new(OpenZeppelinDatabase::new())),
            _ => None,
        }
    }

    pub fn available_databases() -> Vec<&'static str> {
        vec![
            "CertiK",
            "Slither", 
            "MythX",
            "Code4rena",
            "ImmuneFi",
            "OpenZeppelin"
        ]
    }
}

// Enhanced database with API integration
#[derive(Debug)]
pub struct EnhancedAuditDatabase {
    name: String,
    client: Client,
    api_endpoint: String,
    api_key: Option<String>,
    rate_limit: RateLimiter,
}

impl EnhancedAuditDatabase {
    pub fn new(name: String, api_endpoint: String, api_key: Option<String>) -> Self {
        Self {
            name,
            client: Client::new(),
            api_endpoint,
            api_key,
            rate_limit: RateLimiter::new(10, 60), // 10 requests per minute
        }
    }
}

#[async_trait]
impl AuditDatabase for EnhancedAuditDatabase {
    async fn check_contract(&self, contract_address: &str) -> Result<Vec<Vulnerability>, Box<dyn std::error::Error + Send + Sync>> {
        // Wait for rate limit
        self.rate_limit.wait().await;

        let mut request = self.client.get(&format!("{}/contracts/{}", self.api_endpoint, contract_address));
        
        if let Some(api_key) = &self.api_key {
            request = request.header("Authorization", format!("Bearer {}", api_key));
        }

        let response = request.send().await?;
        
        if response.status().is_success() {
            let audit_response: AuditResponse = response.json().await?;
            Ok(audit_response.into_vulnerabilities())
        } else {
            Err(format!("API request failed with status: {}", response.status()).into())
        }
    }

    fn name(&self) -> String {
        self.name.clone()
    }
}

#[derive(Debug, Deserialize)]
struct AuditResponse {
    vulnerabilities: Vec<ApiVulnerability>,
    contract_address: String,
    audit_date: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
struct ApiVulnerability {
    id: String,
    severity: String,
    category: String,
    description: String,
    impact: String,
    confidence: u8,
    functions: Vec<String>,
    remediation: Option<String>,
}

impl AuditResponse {
    fn into_vulnerabilities(self) -> Vec<Vulnerability> {
        self.vulnerabilities.into_iter().map(|v| v.into_vulnerability()).collect()
    }
}

impl ApiVulnerability {
    fn into_vulnerability(self) -> Vulnerability {
        Vulnerability {
            id: self.id,
            severity: self.parse_severity(&self.severity),
            category: self.parse_category(&self.category),
            description: self.description,
            impact: self.impact,
            confidence: self.confidence,
            cvss_score: None,
            cwe_id: None,
            affected_functions: self.functions,
            proof_of_concept: None,
            remediation: self.remediation,
        }
    }

    fn parse_severity(&self, severity: &str) -> VulnerabilitySeverity {
        match severity.to_lowercase().as_str() {
            "critical" => VulnerabilitySeverity::Critical,
            "high" => VulnerabilitySeverity::High,
            "medium" => VulnerabilitySeverity::Medium,
            "low" => VulnerabilitySeverity::Low,
            _ => VulnerabilitySeverity::Info,
        }
    }

    fn parse_category(&self, category: &str) -> VulnerabilityCategory {
        match category.to_lowercase().as_str() {
            "reentrancy" => VulnerabilityCategory::Reentrancy,
            "integer_overflow" => VulnerabilityCategory::IntegerOverflow,
            "access_control" => VulnerabilityCategory::AccessControl,
            "oracle" => VulnerabilityCategory::Oracle,
            "flashloan" => VulnerabilityCategory::Flashloan,
            "mev" => VulnerabilityCategory::MEV,
            _ => VulnerabilityCategory::Other(category.to_string()),
        }
    }
}

// Simple rate limiter
#[derive(Debug)]
struct RateLimiter {
    requests_per_window: u32,
    window_seconds: u64,
    last_reset: Arc<RwLock<DateTime<Utc>>>,
    current_count: Arc<RwLock<u32>>,
}

impl RateLimiter {
    fn new(requests_per_window: u32, window_seconds: u64) -> Self {
        Self {
            requests_per_window,
            window_seconds,
            last_reset: Arc::new(RwLock::new(Utc::now())),
            current_count: Arc::new(RwLock::new(0)),
        }
    }

    async fn wait(&self) {
        loop {
            let now = Utc::now();
            let mut last_reset = self.last_reset.write().await;
            let mut current_count = self.current_count.write().await;

            // Reset window if enough time has passed
            if now.signed_duration_since(*last_reset).num_seconds() >= self.window_seconds as i64 {
                *last_reset = now;
                *current_count = 0;
            }

            // Check if we can make a request
            if *current_count < self.requests_per_window {
                *current_count += 1;
                break;
            }

            // Wait a bit before checking again
            drop(last_reset);
            drop(current_count);
            tokio::time::sleep(std::time::Duration::from_secs(1)).await;
        }
    }
}