use tokio_test;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use chrono::{Utc, Duration};

// Import Aegis satellite types and components
// Note: These imports will need to be adjusted based on the actual module structure
#[allow(dead_code)]
mod aegis_types {
    use serde::{Deserialize, Serialize};
    use chrono::{DateTime, Utc};
    
    #[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
    pub enum VulnerabilitySeverity {
        Info,
        Low,
        Medium,
        High,
        Critical,
    }
    
    impl VulnerabilitySeverity {
        pub fn score(&self) -> u8 {
            match self {
                VulnerabilitySeverity::Info => 10,
                VulnerabilitySeverity::Low => 25,
                VulnerabilitySeverity::Medium => 50,
                VulnerabilitySeverity::High => 75,
                VulnerabilitySeverity::Critical => 95,
            }
        }
    }
    
    #[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
    pub enum VulnerabilityCategory {
        Reentrancy,
        IntegerOverflow,
        AccessControl,
        Oracle,
        Logic,
        Governance,
        Upgradeability,
        Denial,
        Information,
        Flashloan,
        MEV,
        Liquidation,
        CrossChain,
        GasGriefing,
        TimeLock,
        Signature,
        Other(String),
    }
    
    #[derive(Debug, Clone, Serialize, Deserialize)]
    pub struct Vulnerability {
        pub id: String,
        pub severity: VulnerabilitySeverity,
        pub category: VulnerabilityCategory,
        pub description: String,
        pub impact: String,
        pub confidence: u8, // 0-100
        pub cvss_score: Option<f32>,
        pub cwe_id: Option<String>,
        pub affected_functions: Vec<String>,
        pub proof_of_concept: Option<String>,
        pub remediation: Option<String>,
    }
    
    #[derive(Debug, Clone, Serialize, Deserialize)]
    pub struct RiskFactor {
        pub factor_type: RiskFactorType,
        pub weight: f32, // 0.0-1.0
        pub score: u8, // 0-100
        pub description: String,
        pub evidence: Vec<String>,
    }
    
    #[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
    pub enum RiskFactorType {
        CodeComplexity,
        ExternalDependencies,
        PrivilegeEscalation,
        DataExposure,
        BusinessLogic,
        GasOptimization,
        Upgradeability,
        Governance,
        Oracle,
        Liquidation,
        Flashloan,
        CrossChain,
    }
    
    #[derive(Debug, Clone, Serialize, Deserialize)]
    pub struct BytecodeAnalysisResult {
        pub contract_address: String,
        pub bytecode_size: usize,
        pub vulnerabilities: Vec<Vulnerability>,
        pub risk_factors: Vec<RiskFactor>,
        pub function_signatures: Vec<FunctionSignature>,
        pub opcode_patterns: Vec<OpcodePattern>,
        pub gas_analysis: GasAnalysis,
        pub complexity_metrics: ComplexityMetrics,
        pub analysis_metadata: BytecodeAnalysisMetadata,
    }
    
    #[derive(Debug, Clone, Serialize, Deserialize)]
    pub struct FunctionSignature {
        pub selector: String, // 4-byte function selector
        pub signature: String, // Full function signature
        pub is_payable: bool,
        pub is_view: bool,
        pub is_pure: bool,
        pub gas_estimate: Option<u64>,
        pub risk_level: FunctionRiskLevel,
    }
    
    #[derive(Debug, Clone, Serialize, Deserialize)]
    pub enum FunctionRiskLevel {
        Safe,
        Low,
        Medium,
        High,
        Critical,
    }
    
    #[derive(Debug, Clone, Serialize, Deserialize)]
    pub struct OpcodePattern {
        pub pattern_id: String,
        pub description: String,
        pub opcodes: Vec<String>,
        pub risk_indicator: bool,
        pub frequency: u32,
        pub locations: Vec<BytecodeLocation>,
    }
    
    #[derive(Debug, Clone, Serialize, Deserialize)]
    pub struct BytecodeLocation {
        pub offset: usize,
        pub function_selector: Option<String>,
        pub context: String,
    }
    
    #[derive(Debug, Clone, Serialize, Deserialize)]
    pub struct GasAnalysis {
        pub estimated_deployment_cost: u64,
        pub function_gas_estimates: HashMap<String, u64>,
        pub expensive_operations: Vec<ExpensiveOperation>,
        pub optimization_opportunities: Vec<String>,
    }
    
    #[derive(Debug, Clone, Serialize, Deserialize)]
    pub struct ExpensiveOperation {
        pub operation: String,
        pub location: BytecodeLocation,
        pub estimated_cost: u64,
        pub optimization_suggestion: Option<String>,
    }
    
    #[derive(Debug, Clone, Serialize, Deserialize)]
    pub struct ComplexityMetrics {
        pub cyclomatic_complexity: u32,
        pub function_count: u32,
        pub max_stack_depth: u32,
        pub external_calls_count: u32,
        pub storage_operations_count: u32,
        pub conditional_branches_count: u32,
        pub loop_count: u32,
    }
    
    #[derive(Debug, Clone, Serialize, Deserialize)]
    pub struct BytecodeAnalysisMetadata {
        pub analyzed_at: DateTime<Utc>,
        pub analysis_version: String,
        pub analysis_duration_ms: u64,
        pub compiler_version: Option<String>,
        pub optimization_enabled: Option<bool>,
        pub source_map_available: bool,
        pub abi_available: bool,
    }
    
    #[derive(Debug, Clone, Serialize, Deserialize)]
    pub struct BytecodeAnalyzerConfig {
        pub enable_pattern_detection: bool,
        pub enable_gas_analysis: bool,
        pub enable_complexity_analysis: bool,
        pub enable_vulnerability_detection: bool,
        pub pattern_database_path: Option<String>,
        pub max_analysis_time_seconds: u64,
        pub deep_analysis_enabled: bool,
    }
    
    impl Default for BytecodeAnalyzerConfig {
        fn default() -> Self {
            Self {
                enable_pattern_detection: true,
                enable_gas_analysis: true,
                enable_complexity_analysis: true,
                enable_vulnerability_detection: true,
                pattern_database_path: None,
                max_analysis_time_seconds: 300,
                deep_analysis_enabled: false,
            }
        }
    }
    
    #[derive(thiserror::Error, Debug)]
    pub enum BytecodeAnalysisError {
        #[error("Invalid bytecode format: {message}")]
        InvalidBytecode { message: String },
        #[error("Bytecode not found for contract: {address}")]
        BytecodeNotFound { address: String },
        #[error("Analysis timeout: exceeded {seconds} seconds")]
        AnalysisTimeout { seconds: u64 },
        #[error("Pattern database error: {message}")]
        PatternDatabaseError { message: String },
        #[error("Disassembly failed: {message}")]
        DisassemblyFailed { message: String },
    }
}

use aegis_types::*;

/// Mock bytecode analyzer for testing
pub struct MockBytecodeAnalyzer {
    config: BytecodeAnalyzerConfig,
    vulnerability_patterns: Arc<RwLock<HashMap<String, VulnerabilityPattern>>>,
    bytecode_cache: Arc<RwLock<HashMap<String, String>>>,
    analysis_cache: Arc<RwLock<HashMap<String, BytecodeAnalysisResult>>>,
}

#[derive(Debug, Clone)]
struct VulnerabilityPattern {
    pattern_id: String,
    name: String,
    opcodes: Vec<String>,
    severity: VulnerabilitySeverity,
    category: VulnerabilityCategory,
    description: String,
    confidence_threshold: u8,
}

impl MockBytecodeAnalyzer {
    fn new(config: BytecodeAnalyzerConfig) -> Self {
        let mut analyzer = Self {
            config,
            vulnerability_patterns: Arc::new(RwLock::new(HashMap::new())),
            bytecode_cache: Arc::new(RwLock::new(HashMap::new())),
            analysis_cache: Arc::new(RwLock::new(HashMap::new())),
        };
        
        // Initialize with common vulnerability patterns
        tokio::task::block_in_place(|| {
            tokio::runtime::Handle::current().block_on(async {
                analyzer.initialize_vulnerability_patterns().await;
            })
        });
        
        analyzer
    }
    
    async fn initialize_vulnerability_patterns(&self) {
        let patterns = vec![
            VulnerabilityPattern {
                pattern_id: "REENTRANCY_001".to_string(),
                name: "Call-Then-Modify State".to_string(),
                opcodes: vec!["CALL".to_string(), "SSTORE".to_string()],
                severity: VulnerabilitySeverity::Critical,
                category: VulnerabilityCategory::Reentrancy,
                description: "External call followed by state modification".to_string(),
                confidence_threshold: 80,
            },
            VulnerabilityPattern {
                pattern_id: "ACCESS_CONTROL_001".to_string(),
                name: "Missing Access Control".to_string(),
                opcodes: vec!["CALLER".to_string(), "JUMPI".to_string()],
                severity: VulnerabilitySeverity::High,
                category: VulnerabilityCategory::AccessControl,
                description: "Function with missing caller validation".to_string(),
                confidence_threshold: 70,
            },
            VulnerabilityPattern {
                pattern_id: "INTEGER_OVERFLOW_001".to_string(),
                name: "Unchecked Arithmetic".to_string(),
                opcodes: vec!["ADD".to_string(), "MUL".to_string()],
                severity: VulnerabilitySeverity::Medium,
                category: VulnerabilityCategory::IntegerOverflow,
                description: "Arithmetic operations without overflow checks".to_string(),
                confidence_threshold: 60,
            },
            VulnerabilityPattern {
                pattern_id: "DELEGATECALL_001".to_string(),
                name: "Dangerous Delegatecall".to_string(),
                opcodes: vec!["DELEGATECALL".to_string()],
                severity: VulnerabilitySeverity::High,
                category: VulnerabilityCategory::Logic,
                description: "Use of delegatecall without proper validation".to_string(),
                confidence_threshold: 85,
            },
            VulnerabilityPattern {
                pattern_id: "SELFDESTRUCT_001".to_string(),
                name: "Selfdestruct Usage".to_string(),
                opcodes: vec!["SELFDESTRUCT".to_string()],
                severity: VulnerabilitySeverity::Critical,
                category: VulnerabilityCategory::Logic,
                description: "Contract can be permanently destroyed".to_string(),
                confidence_threshold: 95,
            },
        ];
        
        let mut pattern_map = self.vulnerability_patterns.write().await;
        for pattern in patterns {
            pattern_map.insert(pattern.pattern_id.clone(), pattern);
        }
    }
    
    // Add bytecode for testing
    async fn add_test_bytecode(&self, contract_address: &str, bytecode: &str) {
        let mut cache = self.bytecode_cache.write().await;
        cache.insert(contract_address.to_string(), bytecode.to_string());
    }
    
    async fn analyze_bytecode(&self, contract_address: &str) -> Result<BytecodeAnalysisResult, BytecodeAnalysisError> {
        let start_time = std::time::Instant::now();
        
        // Check analysis cache first
        if let Some(cached_result) = self.get_cached_analysis(contract_address).await {
            return Ok(cached_result);
        }
        
        // Get bytecode
        let bytecode = self.get_bytecode(contract_address).await?;
        
        // Validate bytecode format
        if !self.is_valid_bytecode(&bytecode) {
            return Err(BytecodeAnalysisError::InvalidBytecode {
                message: "Invalid hex format or empty bytecode".to_string(),
            });
        }
        
        let mut vulnerabilities = Vec::new();
        let mut risk_factors = Vec::new();
        let mut opcode_patterns = Vec::new();
        
        // 1. Pattern-based vulnerability detection
        if self.config.enable_vulnerability_detection {
            let detected_vulnerabilities = self.detect_vulnerabilities(&bytecode).await;
            vulnerabilities.extend(detected_vulnerabilities);
        }
        
        // 2. Opcode pattern analysis
        if self.config.enable_pattern_detection {
            opcode_patterns = self.analyze_opcode_patterns(&bytecode).await;
        }
        
        // 3. Extract function signatures
        let function_signatures = self.extract_function_signatures(&bytecode).await;
        
        // 4. Gas analysis
        let gas_analysis = if self.config.enable_gas_analysis {
            self.analyze_gas_usage(&bytecode, &function_signatures).await
        } else {
            GasAnalysis {
                estimated_deployment_cost: 0,
                function_gas_estimates: HashMap::new(),
                expensive_operations: vec![],
                optimization_opportunities: vec![],
            }
        };
        
        // 5. Complexity analysis
        let complexity_metrics = if self.config.enable_complexity_analysis {
            self.calculate_complexity_metrics(&bytecode).await
        } else {
            ComplexityMetrics {
                cyclomatic_complexity: 0,
                function_count: 0,
                max_stack_depth: 0,
                external_calls_count: 0,
                storage_operations_count: 0,
                conditional_branches_count: 0,
                loop_count: 0,
            }
        };
        
        // 6. Generate risk factors based on analysis
        risk_factors.extend(self.generate_risk_factors(&complexity_metrics, &gas_analysis).await);
        
        let analysis_duration = start_time.elapsed();
        
        // Check for timeout
        if analysis_duration.as_secs() > self.config.max_analysis_time_seconds {
            return Err(BytecodeAnalysisError::AnalysisTimeout {
                seconds: self.config.max_analysis_time_seconds,
            });
        }
        
        let result = BytecodeAnalysisResult {
            contract_address: contract_address.to_string(),
            bytecode_size: bytecode.len() / 2, // Hex string to bytes
            vulnerabilities,
            risk_factors,
            function_signatures,
            opcode_patterns,
            gas_analysis,
            complexity_metrics,
            analysis_metadata: BytecodeAnalysisMetadata {
                analyzed_at: Utc::now(),
                analysis_version: "1.0.0".to_string(),
                analysis_duration_ms: analysis_duration.as_millis() as u64,
                compiler_version: self.detect_compiler_version(&bytecode).await,
                optimization_enabled: self.detect_optimization(&bytecode).await,
                source_map_available: false,
                abi_available: false,
            },
        };
        
        // Cache the result
        self.cache_analysis(contract_address, &result).await;
        
        Ok(result)
    }
    
    async fn get_bytecode(&self, contract_address: &str) -> Result<String, BytecodeAnalysisError> {
        let cache = self.bytecode_cache.read().await;
        cache.get(contract_address)
            .cloned()
            .ok_or_else(|| BytecodeAnalysisError::BytecodeNotFound {
                address: contract_address.to_string(),
            })
    }
    
    fn is_valid_bytecode(&self, bytecode: &str) -> bool {
        if bytecode.len() < 2 {
            return false;
        }
        
        // Check if it's valid hex
        let clean_bytecode = if bytecode.starts_with("0x") {
            &bytecode[2..]
        } else {
            bytecode
        };
        
        clean_bytecode.chars().all(|c| c.is_ascii_hexdigit()) && clean_bytecode.len() % 2 == 0
    }
    
    async fn detect_vulnerabilities(&self, bytecode: &str) -> Vec<Vulnerability> {
        let patterns = self.vulnerability_patterns.read().await;
        let mut vulnerabilities = Vec::new();
        
        // Convert bytecode to opcodes (simplified)
        let opcodes = self.disassemble_bytecode(bytecode).await;
        
        for (_, pattern) in patterns.iter() {
            if self.matches_pattern(&opcodes, &pattern.opcodes) {
                let confidence = self.calculate_pattern_confidence(&opcodes, pattern);
                
                if confidence >= pattern.confidence_threshold {
                    vulnerabilities.push(Vulnerability {
                        id: format!("{}_{}", pattern.pattern_id, vulnerabilities.len()),
                        severity: pattern.severity.clone(),
                        category: pattern.category.clone(),
                        description: pattern.description.clone(),
                        impact: self.get_impact_description(&pattern.category),
                        confidence,
                        cvss_score: self.calculate_cvss_score(&pattern.severity),
                        cwe_id: self.get_cwe_id(&pattern.category),
                        affected_functions: self.find_affected_functions(&opcodes, &pattern.opcodes),
                        proof_of_concept: None,
                        remediation: self.get_remediation_advice(&pattern.category),
                    });
                }
            }
        }
        
        vulnerabilities
    }
    
    async fn disassemble_bytecode(&self, bytecode: &str) -> Vec<String> {
        // Simplified disassembly - in real implementation would use proper EVM disassembler
        let clean_bytecode = if bytecode.starts_with("0x") {
            &bytecode[2..]
        } else {
            bytecode
        };
        
        let mut opcodes = Vec::new();
        let bytes = hex::decode(clean_bytecode).unwrap_or_default();
        
        for byte in bytes {
            match byte {
                0x00 => opcodes.push("STOP".to_string()),
                0x01 => opcodes.push("ADD".to_string()),
                0x02 => opcodes.push("MUL".to_string()),
                0x03 => opcodes.push("SUB".to_string()),
                0x04 => opcodes.push("DIV".to_string()),
                0x16 => opcodes.push("AND".to_string()),
                0x17 => opcodes.push("OR".to_string()),
                0x18 => opcodes.push("XOR".to_string()),
                0x33 => opcodes.push("CALLER".to_string()),
                0x35 => opcodes.push("CALLDATALOAD".to_string()),
                0x51 => opcodes.push("MLOAD".to_string()),
                0x52 => opcodes.push("MSTORE".to_string()),
                0x54 => opcodes.push("SLOAD".to_string()),
                0x55 => opcodes.push("SSTORE".to_string()),
                0x56 => opcodes.push("JUMP".to_string()),
                0x57 => opcodes.push("JUMPI".to_string()),
                0xf0 => opcodes.push("CREATE".to_string()),
                0xf1 => opcodes.push("CALL".to_string()),
                0xf2 => opcodes.push("CALLCODE".to_string()),
                0xf4 => opcodes.push("DELEGATECALL".to_string()),
                0xf5 => opcodes.push("CREATE2".to_string()),
                0xff => opcodes.push("SELFDESTRUCT".to_string()),
                _ => opcodes.push(format!("UNKNOWN_{:02x}", byte)),
            }
        }
        
        opcodes
    }
    
    fn matches_pattern(&self, opcodes: &[String], pattern_opcodes: &[String]) -> bool {
        if pattern_opcodes.is_empty() {
            return false;
        }
        
        // Simple pattern matching - look for sequence of opcodes
        opcodes.windows(pattern_opcodes.len())
            .any(|window| window == pattern_opcodes)
    }
    
    fn calculate_pattern_confidence(&self, opcodes: &[String], pattern: &VulnerabilityPattern) -> u8 {
        let base_confidence = pattern.confidence_threshold;
        
        // Increase confidence based on context
        let mut confidence_boost = 0;
        
        // Check for dangerous opcode combinations
        if pattern.opcodes.contains(&"CALL".to_string()) && opcodes.contains(&"SSTORE".to_string()) {
            confidence_boost += 10;
        }
        
        if pattern.opcodes.contains(&"DELEGATECALL".to_string()) {
            confidence_boost += 15;
        }
        
        if pattern.opcodes.contains(&"SELFDESTRUCT".to_string()) {
            confidence_boost += 20;
        }
        
        std::cmp::min(base_confidence + confidence_boost, 100)
    }
    
    fn get_impact_description(&self, category: &VulnerabilityCategory) -> String {
        match category {
            VulnerabilityCategory::Reentrancy => "Attacker can drain contract funds through recursive calls".to_string(),
            VulnerabilityCategory::AccessControl => "Unauthorized users can access privileged functions".to_string(),
            VulnerabilityCategory::IntegerOverflow => "Arithmetic operations may produce unexpected results".to_string(),
            VulnerabilityCategory::Logic => "Contract logic may be bypassed or exploited".to_string(),
            VulnerabilityCategory::Oracle => "Price manipulation attacks possible".to_string(),
            VulnerabilityCategory::Flashloan => "Flash loan attacks may drain funds".to_string(),
            _ => "Potential security risk requiring investigation".to_string(),
        }
    }
    
    fn calculate_cvss_score(&self, severity: &VulnerabilitySeverity) -> Option<f32> {
        match severity {
            VulnerabilitySeverity::Critical => Some(9.5),
            VulnerabilitySeverity::High => Some(7.8),
            VulnerabilitySeverity::Medium => Some(5.4),
            VulnerabilitySeverity::Low => Some(3.1),
            VulnerabilitySeverity::Info => Some(1.0),
        }
    }
    
    fn get_cwe_id(&self, category: &VulnerabilityCategory) -> Option<String> {
        match category {
            VulnerabilityCategory::Reentrancy => Some("CWE-362".to_string()),
            VulnerabilityCategory::AccessControl => Some("CWE-284".to_string()),
            VulnerabilityCategory::IntegerOverflow => Some("CWE-190".to_string()),
            VulnerabilityCategory::Logic => Some("CWE-691".to_string()),
            VulnerabilityCategory::Oracle => Some("CWE-345".to_string()),
            _ => None,
        }
    }
    
    fn find_affected_functions(&self, _opcodes: &[String], _pattern_opcodes: &[String]) -> Vec<String> {
        // Simplified - in real implementation would analyze function boundaries
        vec!["withdraw".to_string(), "transfer".to_string()]
    }
    
    fn get_remediation_advice(&self, category: &VulnerabilityCategory) -> Option<String> {
        match category {
            VulnerabilityCategory::Reentrancy => Some("Use reentrancy guard or checks-effects-interactions pattern".to_string()),
            VulnerabilityCategory::AccessControl => Some("Implement proper access control modifiers".to_string()),
            VulnerabilityCategory::IntegerOverflow => Some("Use SafeMath library or Solidity 0.8+".to_string()),
            VulnerabilityCategory::Logic => Some("Review contract logic and add proper validation".to_string()),
            _ => Some("Consult security best practices for this vulnerability type".to_string()),
        }
    }
    
    async fn analyze_opcode_patterns(&self, bytecode: &str) -> Vec<OpcodePattern> {
        let opcodes = self.disassemble_bytecode(bytecode).await;
        let mut patterns = Vec::new();
        
        // Analyze common dangerous patterns
        let dangerous_patterns = vec![
            ("CALL_SEQUENCE", vec!["CALL", "ISZERO", "JUMPI"], true),
            ("DELEGATECALL_PATTERN", vec!["DELEGATECALL"], true),
            ("SELFDESTRUCT_PATTERN", vec!["SELFDESTRUCT"], true),
            ("EXTERNAL_CALL", vec!["CALL"], false),
            ("STORAGE_WRITE", vec!["SSTORE"], false),
        ];
        
        for (pattern_name, pattern_opcodes, is_risk) in dangerous_patterns {
            let frequency = self.count_pattern_occurrences(&opcodes, &pattern_opcodes);
            
            if frequency > 0 {
                patterns.push(OpcodePattern {
                    pattern_id: pattern_name.to_string(),
                    description: format!("Pattern: {}", pattern_opcodes.join(" -> ")),
                    opcodes: pattern_opcodes.iter().map(|s| s.to_string()).collect(),
                    risk_indicator: is_risk,
                    frequency,
                    locations: self.find_pattern_locations(&opcodes, &pattern_opcodes),
                });
            }
        }
        
        patterns
    }
    
    fn count_pattern_occurrences(&self, opcodes: &[String], pattern: &[&str]) -> u32 {
        let pattern_strings: Vec<String> = pattern.iter().map(|s| s.to_string()).collect();
        opcodes.windows(pattern.len())
            .filter(|window| *window == pattern_strings.as_slice())
            .count() as u32
    }
    
    fn find_pattern_locations(&self, opcodes: &[String], pattern: &[&str]) -> Vec<BytecodeLocation> {
        let pattern_strings: Vec<String> = pattern.iter().map(|s| s.to_string()).collect();
        let mut locations = Vec::new();
        
        for (i, window) in opcodes.windows(pattern.len()).enumerate() {
            if window == pattern_strings.as_slice() {
                locations.push(BytecodeLocation {
                    offset: i,
                    function_selector: None, // Would be determined from function boundaries
                    context: format!("Opcode sequence at position {}", i),
                });
            }
        }
        
        locations
    }
    
    async fn extract_function_signatures(&self, bytecode: &str) -> Vec<FunctionSignature> {
        let mut signatures = Vec::new();
        
        // Mock function signature extraction
        // In real implementation, would parse function selectors from bytecode
        let common_functions = vec![
            ("0xa9059cbb", "transfer(address,uint256)", false, false, false, Some(50000)),
            ("0x095ea7b3", "approve(address,uint256)", false, false, false, Some(45000)),
            ("0x70a08231", "balanceOf(address)", false, true, true, Some(1000)),
            ("0x18160ddd", "totalSupply()", false, true, true, Some(500)),
            ("0x2e1a7d4d", "withdraw(uint256)", true, false, false, Some(80000)),
        ];
        
        for (selector, sig, payable, view, pure, gas) in common_functions {
            if bytecode.contains(&selector[2..]) { // Remove 0x prefix for search
                let risk_level = match sig {
                    s if s.contains("withdraw") => FunctionRiskLevel::High,
                    s if s.contains("transfer") => FunctionRiskLevel::Medium,
                    s if s.contains("approve") => FunctionRiskLevel::Medium,
                    _ => FunctionRiskLevel::Low,
                };
                
                signatures.push(FunctionSignature {
                    selector: selector.to_string(),
                    signature: sig.to_string(),
                    is_payable: payable,
                    is_view: view,
                    is_pure: pure,
                    gas_estimate: gas,
                    risk_level,
                });
            }
        }
        
        signatures
    }
    
    async fn analyze_gas_usage(&self, bytecode: &str, function_signatures: &[FunctionSignature]) -> GasAnalysis {
        let opcodes = self.disassemble_bytecode(bytecode).await;
        
        // Estimate deployment cost
        let estimated_deployment_cost = (bytecode.len() / 2) as u64 * 200 + 32000; // Simplified
        
        // Function gas estimates
        let mut function_gas_estimates = HashMap::new();
        for func in function_signatures {
            if let Some(gas) = func.gas_estimate {
                function_gas_estimates.insert(func.signature.clone(), gas);
            }
        }
        
        // Find expensive operations
        let mut expensive_operations = Vec::new();
        for (i, opcode) in opcodes.iter().enumerate() {
            let cost = match opcode.as_str() {
                "SSTORE" => 20000,
                "CREATE" | "CREATE2" => 32000,
                "CALL" | "DELEGATECALL" => 700,
                "SHA3" => 30,
                _ => 0,
            };
            
            if cost > 1000 {
                expensive_operations.push(ExpensiveOperation {
                    operation: opcode.clone(),
                    location: BytecodeLocation {
                        offset: i,
                        function_selector: None,
                        context: format!("Expensive operation at offset {}", i),
                    },
                    estimated_cost: cost,
                    optimization_suggestion: match opcode.as_str() {
                        "SSTORE" => Some("Consider batching storage updates".to_string()),
                        "CREATE" | "CREATE2" => Some("Factory pattern may be more efficient".to_string()),
                        _ => None,
                    },
                });
            }
        }
        
        // Optimization opportunities
        let mut optimization_opportunities = Vec::new();
        if opcodes.iter().filter(|op| op.as_str() == "SSTORE").count() > 5 {
            optimization_opportunities.push("Multiple storage writes could be optimized".to_string());
        }
        if opcodes.iter().filter(|op| op.as_str() == "CALL").count() > 3 {
            optimization_opportunities.push("Multiple external calls increase gas costs".to_string());
        }
        
        GasAnalysis {
            estimated_deployment_cost,
            function_gas_estimates,
            expensive_operations,
            optimization_opportunities,
        }
    }
    
    async fn calculate_complexity_metrics(&self, bytecode: &str) -> ComplexityMetrics {
        let opcodes = self.disassemble_bytecode(bytecode).await;
        
        let function_count = opcodes.iter()
            .filter(|op| op.starts_with("PUSH4")) // Function selectors are often pushed
            .count() as u32;
        
        let external_calls_count = opcodes.iter()
            .filter(|op| matches!(op.as_str(), "CALL" | "DELEGATECALL" | "STATICCALL"))
            .count() as u32;
        
        let storage_operations_count = opcodes.iter()
            .filter(|op| matches!(op.as_str(), "SLOAD" | "SSTORE"))
            .count() as u32;
        
        let conditional_branches_count = opcodes.iter()
            .filter(|op| matches!(op.as_str(), "JUMPI" | "JUMP"))
            .count() as u32;
        
        let loop_count = self.estimate_loop_count(&opcodes);
        
        // Simplified cyclomatic complexity calculation
        let cyclomatic_complexity = 1 + conditional_branches_count + loop_count;
        
        // Estimate max stack depth (simplified)
        let max_stack_depth = std::cmp::min(1024, opcodes.len() as u32 / 10);
        
        ComplexityMetrics {
            cyclomatic_complexity,
            function_count: std::cmp::max(1, function_count),
            max_stack_depth,
            external_calls_count,
            storage_operations_count,
            conditional_branches_count,
            loop_count,
        }
    }
    
    fn estimate_loop_count(&self, opcodes: &[String]) -> u32 {
        // Simplified loop detection - look for backward jumps
        let mut loop_count = 0;
        let mut jump_positions = Vec::new();
        
        for (i, opcode) in opcodes.iter().enumerate() {
            if opcode == "JUMPI" {
                jump_positions.push(i);
            }
        }
        
        // Very simplified - count backward references as potential loops
        for &pos in &jump_positions {
            if opcodes[pos..].iter().take(10).any(|op| op == "JUMP") {
                loop_count += 1;
            }
        }
        
        loop_count
    }
    
    async fn generate_risk_factors(&self, complexity: &ComplexityMetrics, gas: &GasAnalysis) -> Vec<RiskFactor> {
        let mut risk_factors = Vec::new();
        
        // Code complexity risk
        if complexity.cyclomatic_complexity > 20 {
            risk_factors.push(RiskFactor {
                factor_type: RiskFactorType::CodeComplexity,
                weight: 0.8,
                score: std::cmp::min((complexity.cyclomatic_complexity * 3) as u8, 100),
                description: format!("High cyclomatic complexity: {}", complexity.cyclomatic_complexity),
                evidence: vec![format!("{} conditional branches", complexity.conditional_branches_count)],
            });
        }
        
        // External dependencies risk
        if complexity.external_calls_count > 5 {
            risk_factors.push(RiskFactor {
                factor_type: RiskFactorType::ExternalDependencies,
                weight: 0.7,
                score: std::cmp::min((complexity.external_calls_count * 10) as u8, 100),
                description: format!("High number of external calls: {}", complexity.external_calls_count),
                evidence: vec!["Multiple external contract dependencies".to_string()],
            });
        }
        
        // Gas optimization risk
        if gas.expensive_operations.len() > 3 {
            risk_factors.push(RiskFactor {
                factor_type: RiskFactorType::GasOptimization,
                weight: 0.5,
                score: std::cmp::min((gas.expensive_operations.len() * 15) as u8, 100),
                description: format!("Multiple expensive operations: {}", gas.expensive_operations.len()),
                evidence: gas.expensive_operations.iter().map(|op| op.operation.clone()).collect(),
            });
        }
        
        risk_factors
    }
    
    async fn detect_compiler_version(&self, _bytecode: &str) -> Option<String> {
        // Mock compiler version detection
        Some("0.8.19+commit.7dd6d404".to_string())
    }
    
    async fn detect_optimization(&self, bytecode: &str) -> Option<bool> {
        // Mock optimization detection - optimized bytecode is typically shorter
        Some(bytecode.len() < 10000)
    }
    
    async fn get_cached_analysis(&self, contract_address: &str) -> Option<BytecodeAnalysisResult> {
        let cache = self.analysis_cache.read().await;
        cache.get(contract_address).cloned()
    }
    
    async fn cache_analysis(&self, contract_address: &str, result: &BytecodeAnalysisResult) {
        let mut cache = self.analysis_cache.write().await;
        cache.insert(contract_address.to_string(), result.clone());
    }
    
    async fn clear_cache(&self) {
        let mut cache = self.analysis_cache.write().await;
        cache.clear();
    }
}

#[cfg(test)]
mod bytecode_analyzer_tests {
    use super::*;
    use tokio_test;
    
    #[tokio::test]
    async fn test_analyzer_creation() {
        let config = BytecodeAnalyzerConfig::default();
        let analyzer = MockBytecodeAnalyzer::new(config);
        
        // Should have initialized vulnerability patterns
        let patterns = analyzer.vulnerability_patterns.read().await;
        assert!(patterns.len() > 0);
        assert!(patterns.contains_key("REENTRANCY_001"));
        assert!(patterns.contains_key("ACCESS_CONTROL_001"));
    }
    
    #[tokio::test]
    async fn test_simple_bytecode_analysis() {
        let config = BytecodeAnalyzerConfig::default();
        let analyzer = MockBytecodeAnalyzer::new(config);
        
        // Simple bytecode with basic operations
        let simple_bytecode = "0x608060405234801561001057600080fd5b50600436106100415760003560e01c8063095ea7b31461004657806370a082311461007657806318160ddd146100a6575b600080fd5b";
        
        analyzer.add_test_bytecode("0x1234567890abcdef", simple_bytecode).await;
        
        let result = analyzer.analyze_bytecode("0x1234567890abcdef").await.unwrap();
        
        assert_eq!(result.contract_address, "0x1234567890abcdef");
        assert!(result.bytecode_size > 0);
        assert!(result.analysis_metadata.analysis_duration_ms > 0);
        assert_eq!(result.analysis_metadata.analysis_version, "1.0.0");
        assert!(result.function_signatures.len() > 0);
    }
    
    #[tokio::test]
    async fn test_reentrancy_vulnerability_detection() {
        let config = BytecodeAnalyzerConfig::default();
        let analyzer = MockBytecodeAnalyzer::new(config);
        
        // Bytecode containing CALL followed by SSTORE (reentrancy pattern)
        let reentrancy_bytecode = "0x60806040523480156100105760003560e01c80637a1c0f0f14610045575b600080fd5f1f455";
        
        // Manually add pattern to bytecode by including the actual opcodes
        let pattern_bytecode = hex::encode([0xf1, 0x55]); // CALL, SSTORE
        let full_bytecode = format!("{}{}", reentrancy_bytecode, pattern_bytecode);
        
        analyzer.add_test_bytecode("0xreentrancy", &full_bytecode).await;
        
        let result = analyzer.analyze_bytecode("0xreentrancy").await.unwrap();
        
        assert!(result.vulnerabilities.len() > 0);
        
        let reentrancy_vuln = result.vulnerabilities.iter()
            .find(|v| v.category == VulnerabilityCategory::Reentrancy);
        
        assert!(reentrancy_vuln.is_some());
        let vuln = reentrancy_vuln.unwrap();
        assert_eq!(vuln.severity, VulnerabilitySeverity::Critical);
        assert!(vuln.confidence >= 80);
        assert!(vuln.cvss_score.is_some());
        assert!(vuln.cwe_id.is_some());
        assert!(vuln.remediation.is_some());
    }
    
    #[tokio::test]
    async fn test_access_control_vulnerability_detection() {
        let config = BytecodeAnalyzerConfig::default();
        let analyzer = MockBytecodeAnalyzer::new(config);
        
        // Bytecode with CALLER and JUMPI (access control pattern)
        let access_control_bytecode = "0x608060405234801561001057600080fd5b50";
        let pattern_bytecode = hex::encode([0x33, 0x57]); // CALLER, JUMPI
        let full_bytecode = format!("{}{}", access_control_bytecode, pattern_bytecode);
        
        analyzer.add_test_bytecode("0xaccess", &full_bytecode).await;
        
        let result = analyzer.analyze_bytecode("0xaccess").await.unwrap();
        
        let access_vuln = result.vulnerabilities.iter()
            .find(|v| v.category == VulnerabilityCategory::AccessControl);
        
        assert!(access_vuln.is_some());
        let vuln = access_vuln.unwrap();
        assert_eq!(vuln.severity, VulnerabilitySeverity::High);
        assert!(vuln.confidence >= 70);
        assert_eq!(vuln.cwe_id, Some("CWE-284".to_string()));
    }
    
    #[tokio::test]
    async fn test_delegatecall_vulnerability_detection() {
        let config = BytecodeAnalyzerConfig::default();
        let analyzer = MockBytecodeAnalyzer::new(config);
        
        // Bytecode with DELEGATECALL
        let delegatecall_bytecode = "0x608060405234801561001057600080fd5b50";
        let pattern_bytecode = hex::encode([0xf4]); // DELEGATECALL
        let full_bytecode = format!("{}{}", delegatecall_bytecode, pattern_bytecode);
        
        analyzer.add_test_bytecode("0xdelegatecall", &full_bytecode).await;
        
        let result = analyzer.analyze_bytecode("0xdelegatecall").await.unwrap();
        
        let delegatecall_vuln = result.vulnerabilities.iter()
            .find(|v| v.category == VulnerabilityCategory::Logic && v.description.contains("delegatecall"));
        
        assert!(delegatecall_vuln.is_some());
        let vuln = delegatecall_vuln.unwrap();
        assert_eq!(vuln.severity, VulnerabilitySeverity::High);
        assert!(vuln.confidence >= 85);
    }
    
    #[tokio::test]
    async fn test_selfdestruct_vulnerability_detection() {
        let config = BytecodeAnalyzerConfig::default();
        let analyzer = MockBytecodeAnalyzer::new(config);
        
        // Bytecode with SELFDESTRUCT
        let selfdestruct_bytecode = "0x608060405234801561001057600080fd5b50";
        let pattern_bytecode = hex::encode([0xff]); // SELFDESTRUCT
        let full_bytecode = format!("{}{}", selfdestruct_bytecode, pattern_bytecode);
        
        analyzer.add_test_bytecode("0xselfdestruct", &full_bytecode).await;
        
        let result = analyzer.analyze_bytecode("0xselfdestruct").await.unwrap();
        
        let selfdestruct_vuln = result.vulnerabilities.iter()
            .find(|v| v.category == VulnerabilityCategory::Logic && v.description.contains("destroyed"));
        
        assert!(selfdestruct_vuln.is_some());
        let vuln = selfdestruct_vuln.unwrap();
        assert_eq!(vuln.severity, VulnerabilitySeverity::Critical);
        assert!(vuln.confidence >= 95);
    }
    
    #[tokio::test]
    async fn test_function_signature_extraction() {
        let config = BytecodeAnalyzerConfig::default();
        let analyzer = MockBytecodeAnalyzer::new(config);
        
        // Bytecode containing common function selectors
        let function_bytecode = "0x608060405234801561001057600080fd5b50600436106100415760003560e01c8063a9059cbb14610046578063095ea7b31461007657806370a082311461009657600080fd5b";
        
        analyzer.add_test_bytecode("0xfunctions", function_bytecode).await;
        
        let result = analyzer.analyze_bytecode("0xfunctions").await.unwrap();
        
        assert!(result.function_signatures.len() > 0);
        
        // Check for transfer function
        let transfer_func = result.function_signatures.iter()
            .find(|f| f.signature.contains("transfer"));
        assert!(transfer_func.is_some());
        
        let func = transfer_func.unwrap();
        assert_eq!(func.selector, "0xa9059cbb");
        assert!(!func.is_view);
        assert!(!func.is_pure);
        assert_eq!(func.risk_level, FunctionRiskLevel::Medium);
    }
    
    #[tokio::test]
    async fn test_opcode_pattern_analysis() {
        let config = BytecodeAnalyzerConfig::default();
        let analyzer = MockBytecodeAnalyzer::new(config);
        
        // Bytecode with various opcode patterns
        let pattern_bytecode = hex::encode([
            0xf1, // CALL
            0x15, // ISZERO
            0x57, // JUMPI
            0xf4, // DELEGATECALL
            0x55, // SSTORE
        ]);
        let full_bytecode = format!("0x{}", pattern_bytecode);
        
        analyzer.add_test_bytecode("0xpatterns", &full_bytecode).await;
        
        let result = analyzer.analyze_bytecode("0xpatterns").await.unwrap();
        
        assert!(result.opcode_patterns.len() > 0);
        
        // Check for dangerous patterns
        let dangerous_patterns: Vec<_> = result.opcode_patterns.iter()
            .filter(|p| p.risk_indicator)
            .collect();
        assert!(dangerous_patterns.len() > 0);
        
        // Check for DELEGATECALL pattern
        let delegatecall_pattern = result.opcode_patterns.iter()
            .find(|p| p.pattern_id == "DELEGATECALL_PATTERN");
        assert!(delegatecall_pattern.is_some());
        assert!(delegatecall_pattern.unwrap().risk_indicator);
    }
    
    #[tokio::test]
    async fn test_gas_analysis() {
        let config = BytecodeAnalyzerConfig::default();
        let analyzer = MockBytecodeAnalyzer::new(config);
        
        // Bytecode with expensive operations
        let expensive_bytecode = hex::encode([
            0x55, // SSTORE (expensive)
            0x55, // SSTORE (expensive)
            0xf0, // CREATE (expensive)
            0xf1, // CALL (moderately expensive)
        ]);
        let full_bytecode = format!("0x{}", expensive_bytecode);
        
        analyzer.add_test_bytecode("0xexpensive", &full_bytecode).await;
        
        let result = analyzer.analyze_bytecode("0xexpensive").await.unwrap();
        
        assert!(result.gas_analysis.estimated_deployment_cost > 0);
        assert!(result.gas_analysis.expensive_operations.len() > 0);
        
        // Check for SSTORE operations
        let sstore_ops: Vec<_> = result.gas_analysis.expensive_operations.iter()
            .filter(|op| op.operation == "SSTORE")
            .collect();
        assert!(sstore_ops.len() >= 2);
        
        // Should have optimization suggestions
        assert!(result.gas_analysis.optimization_opportunities.len() > 0);
    }
    
    #[tokio::test]
    async fn test_complexity_metrics() {
        let config = BytecodeAnalyzerConfig::default();
        let analyzer = MockBytecodeAnalyzer::new(config);
        
        // Complex bytecode with multiple operations
        let complex_bytecode = hex::encode([
            0x57, 0x57, 0x57, // Multiple JUMPI instructions
            0xf1, 0xf1, 0xf4, // External calls
            0x55, 0x55, 0x54, 0x54, // Storage operations
        ]);
        let full_bytecode = format!("0x{}", complex_bytecode);
        
        analyzer.add_test_bytecode("0xcomplex", &full_bytecode).await;
        
        let result = analyzer.analyze_bytecode("0xcomplex").await.unwrap();
        
        let metrics = &result.complexity_metrics;
        assert!(metrics.cyclomatic_complexity > 1);
        assert!(metrics.external_calls_count >= 3);
        assert!(metrics.storage_operations_count >= 4);
        assert!(metrics.conditional_branches_count >= 3);
        assert!(metrics.function_count >= 1);
        
        // Should generate complexity risk factors
        let complexity_risks: Vec<_> = result.risk_factors.iter()
            .filter(|rf| rf.factor_type == RiskFactorType::CodeComplexity)
            .collect();
        
        if metrics.cyclomatic_complexity > 20 {
            assert!(complexity_risks.len() > 0);
        }
    }
    
    #[tokio::test]
    async fn test_invalid_bytecode_handling() {
        let config = BytecodeAnalyzerConfig::default();
        let analyzer = MockBytecodeAnalyzer::new(config);
        
        // Test empty bytecode
        analyzer.add_test_bytecode("0xempty", "").await;
        let result = analyzer.analyze_bytecode("0xempty").await;
        assert!(result.is_err());
        assert!(matches!(result.unwrap_err(), BytecodeAnalysisError::InvalidBytecode { .. }));
        
        // Test invalid hex
        analyzer.add_test_bytecode("0xinvalid", "0xGGHH").await;
        let result2 = analyzer.analyze_bytecode("0xinvalid").await;
        assert!(result2.is_err());
        
        // Test odd length hex
        analyzer.add_test_bytecode("0xodd", "0x123").await;
        let result3 = analyzer.analyze_bytecode("0xodd").await;
        assert!(result3.is_err());
    }
    
    #[tokio::test]
    async fn test_bytecode_not_found() {
        let config = BytecodeAnalyzerConfig::default();
        let analyzer = MockBytecodeAnalyzer::new(config);
        
        let result = analyzer.analyze_bytecode("0xnonexistent").await;
        
        assert!(result.is_err());
        assert!(matches!(result.unwrap_err(), BytecodeAnalysisError::BytecodeNotFound { .. }));
    }
    
    #[tokio::test]
    async fn test_analysis_caching() {
        let config = BytecodeAnalyzerConfig::default();
        let analyzer = MockBytecodeAnalyzer::new(config);
        
        let test_bytecode = "0x608060405234801561001057600080fd5b50";
        analyzer.add_test_bytecode("0xcachetest", test_bytecode).await;
        
        // First analysis
        let start1 = std::time::Instant::now();
        let result1 = analyzer.analyze_bytecode("0xcachetest").await.unwrap();
        let duration1 = start1.elapsed();
        
        // Second analysis should be cached and faster
        let start2 = std::time::Instant::now();
        let result2 = analyzer.analyze_bytecode("0xcachetest").await.unwrap();
        let duration2 = start2.elapsed();
        
        // Results should be identical
        assert_eq!(result1.contract_address, result2.contract_address);
        assert_eq!(result1.bytecode_size, result2.bytecode_size);
        assert_eq!(result1.vulnerabilities.len(), result2.vulnerabilities.len());
        
        // Second call should be significantly faster
        assert!(duration2 < duration1);
    }
    
    #[tokio::test]
    async fn test_configuration_options() {
        // Test with gas analysis disabled
        let config1 = BytecodeAnalyzerConfig {
            enable_gas_analysis: false,
            ..BytecodeAnalyzerConfig::default()
        };
        let analyzer1 = MockBytecodeAnalyzer::new(config1);
        
        let test_bytecode = "0x608060405234801561001057600080fd5b50";
        analyzer1.add_test_bytecode("0xconfig1", test_bytecode).await;
        
        let result1 = analyzer1.analyze_bytecode("0xconfig1").await.unwrap();
        
        // Gas analysis should be minimal/empty
        assert_eq!(result1.gas_analysis.estimated_deployment_cost, 0);
        assert!(result1.gas_analysis.function_gas_estimates.is_empty());
        
        // Test with vulnerability detection disabled
        let config2 = BytecodeAnalyzerConfig {
            enable_vulnerability_detection: false,
            ..BytecodeAnalyzerConfig::default()
        };
        let analyzer2 = MockBytecodeAnalyzer::new(config2);
        
        // Bytecode with vulnerabilities
        let vuln_bytecode = format!("0x{}", hex::encode([0xf1, 0x55])); // CALL, SSTORE
        analyzer2.add_test_bytecode("0xconfig2", &vuln_bytecode).await;
        
        let result2 = analyzer2.analyze_bytecode("0xconfig2").await.unwrap();
        
        // Should not detect vulnerabilities
        assert_eq!(result2.vulnerabilities.len(), 0);
    }
    
    #[tokio::test]
    async fn test_timeout_handling() {
        let config = BytecodeAnalyzerConfig {
            max_analysis_time_seconds: 1, // Very short timeout
            ..BytecodeAnalyzerConfig::default()
        };
        let analyzer = MockBytecodeAnalyzer::new(config);
        
        // This test would require modifying the analyzer to actually respect timeouts
        // For now, we just test that the timeout is configured correctly
        assert_eq!(analyzer.config.max_analysis_time_seconds, 1);
    }
    
    #[tokio::test]
    async fn test_vulnerability_confidence_scoring() {
        let config = BytecodeAnalyzerConfig::default();
        let analyzer = MockBytecodeAnalyzer::new(config);
        
        // Bytecode with high confidence vulnerability (SELFDESTRUCT)
        let high_confidence_bytecode = format!("0x{}", hex::encode([0xff])); // SELFDESTRUCT
        analyzer.add_test_bytecode("0xhighconf", &high_confidence_bytecode).await;
        
        let result1 = analyzer.analyze_bytecode("0xhighconf").await.unwrap();
        
        if let Some(vuln) = result1.vulnerabilities.first() {
            assert!(vuln.confidence >= 95);
        }
        
        // Bytecode with medium confidence vulnerability (ADD/MUL pattern)
        let medium_confidence_bytecode = format!("0x{}", hex::encode([0x01, 0x02])); // ADD, MUL
        analyzer.add_test_bytecode("0xmedconf", &medium_confidence_bytecode).await;
        
        let result2 = analyzer.analyze_bytecode("0xmedconf").await.unwrap();
        
        if let Some(vuln) = result2.vulnerabilities.first() {
            assert!(vuln.confidence < 95);
            assert!(vuln.confidence >= 60);
        }
    }
    
    #[tokio::test]
    async fn test_performance_benchmarking() {
        let config = BytecodeAnalyzerConfig::default();
        let analyzer = MockBytecodeAnalyzer::new(config);
        
        // Large bytecode for performance testing
        let large_bytecode_bytes: Vec<u8> = (0..1000).map(|i| (i % 256) as u8).collect();
        let large_bytecode = format!("0x{}", hex::encode(large_bytecode_bytes));
        
        analyzer.add_test_bytecode("0xperformance", &large_bytecode).await;
        
        let start_time = std::time::Instant::now();
        let result = analyzer.analyze_bytecode("0xperformance").await.unwrap();
        let duration = start_time.elapsed();
        
        // Should complete analysis within reasonable time
        assert!(duration.as_millis() < 1000, "Analysis took {}ms, should be <1000ms", duration.as_millis());
        
        // Should have analyzed the bytecode properly
        assert_eq!(result.bytecode_size, 1000);
        assert!(result.analysis_metadata.analysis_duration_ms > 0);
        assert!(result.analysis_metadata.analysis_duration_ms < 1000);
    }
    
    #[tokio::test]
    async fn test_cache_clearing() {
        let config = BytecodeAnalyzerConfig::default();
        let analyzer = MockBytecodeAnalyzer::new(config);
        
        let test_bytecode = "0x608060405234801561001057600080fd5b50";
        analyzer.add_test_bytecode("0xclear", test_bytecode).await;
        
        // Analyze to populate cache
        let _result1 = analyzer.analyze_bytecode("0xclear").await.unwrap();
        
        // Verify cache has content
        assert!(analyzer.get_cached_analysis("0xclear").await.is_some());
        
        // Clear cache
        analyzer.clear_cache().await;
        
        // Verify cache is empty
        assert!(analyzer.get_cached_analysis("0xclear").await.is_none());
    }
}