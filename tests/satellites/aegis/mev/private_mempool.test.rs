use tokio;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use chrono::{DateTime, Utc, Duration};
use rust_decimal::Decimal;
use rust_decimal::prelude::FromPrimitive;

// Mock structures for private mempool functionality
#[derive(Debug, Clone)]
pub struct PrivateMempoolConfig {
    pub enable_private_routing: bool,
    pub max_retry_attempts: u32,
    pub timeout_seconds: u64,
    pub min_reliability_threshold: f64,
    pub cost_multiplier_limit: f64,
    pub fallback_to_public: bool,
    pub priority_gas_boost: f64,
}

impl Default for PrivateMempoolConfig {
    fn default() -> Self {
        Self {
            enable_private_routing: true,
            max_retry_attempts: 3,
            timeout_seconds: 30,
            min_reliability_threshold: 0.8,
            cost_multiplier_limit: 1.5,
            fallback_to_public: true,
            priority_gas_boost: 1.2,
        }
    }
}

#[derive(Debug, Clone, PartialEq)]
pub enum MempoolType {
    Public,
    Private,
    Flashbots,
    Custom(String),
}

#[derive(Debug, Clone, PartialEq)]
pub enum RoutingStatus {
    Pending,
    Submitted,
    Confirmed,
    Failed,
    Fallback,
}

#[derive(Debug, Clone)]
pub struct PrivateMempool {
    pub name: String,
    pub mempool_type: MempoolType,
    pub endpoint: String,
    pub reliability: f64,
    pub cost_multiplier: f64,
    pub average_inclusion_time: Duration,
    pub supported_chains: Vec<u64>,
    pub max_gas_price: Option<Decimal>,
    pub is_active: bool,
}

#[derive(Debug, Clone)]
pub struct TransactionData {
    pub hash: String,
    pub from_address: String,
    pub to_address: String,
    pub value: Decimal,
    pub gas_used: u64,
    pub gas_price: Decimal,
    pub timestamp: DateTime<Utc>,
    pub function_selector: Option<String>,
    pub input_data: String,
    pub success: bool,
    pub block_number: u64,
    pub transaction_index: u32,
    pub chain_id: u64,
}

#[derive(Debug, Clone)]
pub struct RoutingRequest {
    pub request_id: String,
    pub transaction: TransactionData,
    pub priority: RoutingPriority,
    pub max_cost: Option<Decimal>,
    pub target_inclusion_time: Option<Duration>,
    pub preferred_mempools: Vec<String>,
    pub avoid_mempools: Vec<String>,
}

#[derive(Debug, Clone, PartialEq)]
pub enum RoutingPriority {
    Low,
    Normal,
    High,
    Critical,
}

#[derive(Debug, Clone)]
pub struct RoutingResult {
    pub request_id: String,
    pub selected_mempool: String,
    pub status: RoutingStatus,
    pub estimated_cost: Decimal,
    pub estimated_inclusion_time: Duration,
    pub actual_cost: Option<Decimal>,
    pub actual_inclusion_time: Option<Duration>,
    pub confirmation_hash: Option<String>,
    pub error_message: Option<String>,
}

#[derive(Debug)]
pub struct RoutingMetrics {
    pub total_requests: u64,
    pub successful_routes: u64,
    pub failed_routes: u64,
    pub fallback_routes: u64,
    pub average_inclusion_time_ms: f64,
    pub cost_savings_percentage: f64,
    pub mempool_success_rates: HashMap<String, f64>,
    pub chain_distribution: HashMap<u64, u64>,
}

impl Default for RoutingMetrics {
    fn default() -> Self {
        Self {
            total_requests: 0,
            successful_routes: 0,
            failed_routes: 0,
            fallback_routes: 0,
            average_inclusion_time_ms: 0.0,
            cost_savings_percentage: 0.0,
            mempool_success_rates: HashMap::new(),
            chain_distribution: HashMap::new(),
        }
    }
}

pub struct MockPrivateMempoolRouter {
    config: PrivateMempoolConfig,
    available_mempools: Arc<RwLock<HashMap<String, PrivateMempool>>>,
    routing_history: Arc<RwLock<HashMap<String, RoutingResult>>>,
    routing_metrics: Arc<RwLock<RoutingMetrics>>,
    pending_transactions: Arc<RwLock<HashMap<String, RoutingRequest>>>,
    network_conditions: Arc<RwLock<NetworkConditions>>,
}

#[derive(Debug, Clone)]
pub struct NetworkConditions {
    pub base_gas_price: Decimal,
    pub network_congestion: f64,
    pub block_time: Duration,
    pub mempool_sizes: HashMap<String, u64>,
}

impl Default for NetworkConditions {
    fn default() -> Self {
        Self {
            base_gas_price: Decimal::from(25),
            network_congestion: 0.5,
            block_time: Duration::seconds(12),
            mempool_sizes: HashMap::new(),
        }
    }
}

impl MockPrivateMempoolRouter {
    pub fn new(config: PrivateMempoolConfig) -> Self {
        let mut available_mempools = HashMap::new();
        
        // Initialize with some example private mempools
        available_mempools.insert("flashbots".to_string(), PrivateMempool {
            name: "Flashbots".to_string(),
            mempool_type: MempoolType::Flashbots,
            endpoint: "https://relay.flashbots.net".to_string(),
            reliability: 0.95,
            cost_multiplier: 1.0,
            average_inclusion_time: Duration::seconds(12),
            supported_chains: vec![1, 5], // Mainnet, Goerli
            max_gas_price: Some(Decimal::from(1000)),
            is_active: true,
        });

        available_mempools.insert("eden".to_string(), PrivateMempool {
            name: "Eden Network".to_string(),
            mempool_type: MempoolType::Private,
            endpoint: "https://api.edennetwork.io".to_string(),
            reliability: 0.88,
            cost_multiplier: 1.1,
            average_inclusion_time: Duration::seconds(10),
            supported_chains: vec![1],
            max_gas_price: Some(Decimal::from(800)),
            is_active: true,
        });

        available_mempools.insert("manifold".to_string(), PrivateMempool {
            name: "Manifold Finance".to_string(),
            mempool_type: MempoolType::Private,
            endpoint: "https://securerpc.com".to_string(),
            reliability: 0.82,
            cost_multiplier: 1.2,
            average_inclusion_time: Duration::seconds(15),
            supported_chains: vec![1, 137], // Mainnet, Polygon
            max_gas_price: Some(Decimal::from(500)),
            is_active: true,
        });

        Self {
            config,
            available_mempools: Arc::new(RwLock::new(available_mempools)),
            routing_history: Arc::new(RwLock::new(HashMap::new())),
            routing_metrics: Arc::new(RwLock::new(RoutingMetrics::default())),
            pending_transactions: Arc::new(RwLock::new(HashMap::new())),
            network_conditions: Arc::new(RwLock::new(NetworkConditions::default())),
        }
    }

    pub async fn route_transaction(&self, request: RoutingRequest) -> RoutingResult {
        if !self.config.enable_private_routing {
            return self.create_fallback_result(&request, "Private routing disabled").await;
        }

        let mut metrics = self.routing_metrics.write().await;
        metrics.total_requests += 1;
        metrics.chain_distribution
            .entry(request.transaction.chain_id)
            .and_modify(|e| *e += 1)
            .or_insert(1);
        drop(metrics);

        // Store pending transaction
        self.pending_transactions.write().await.insert(request.request_id.clone(), request.clone());

        // Select optimal mempool
        let selected_mempool = match self.select_optimal_mempool(&request).await {
            Some(mempool) => mempool,
            None => {
                return self.create_fallback_result(&request, "No suitable mempool found").await;
            }
        };

        // Simulate routing attempt
        let routing_result = self.attempt_routing(&request, &selected_mempool).await;

        // Store result and update metrics
        self.routing_history.write().await.insert(request.request_id.clone(), routing_result.clone());
        self.update_routing_metrics(&routing_result).await;

        routing_result
    }

    async fn select_optimal_mempool(&self, request: &RoutingRequest) -> Option<PrivateMempool> {
        let mempools = self.available_mempools.read().await;
        let network_conditions = self.network_conditions.read().await;
        
        let mut candidates: Vec<&PrivateMempool> = mempools
            .values()
            .filter(|mempool| {
                // Basic eligibility checks
                mempool.is_active
                    && mempool.supported_chains.contains(&request.transaction.chain_id)
                    && mempool.reliability >= self.config.min_reliability_threshold
                    && mempool.cost_multiplier <= self.config.cost_multiplier_limit
                    && !request.avoid_mempools.contains(&mempool.name)
            })
            .collect();

        // Prefer specific mempools if requested
        if !request.preferred_mempools.is_empty() {
            candidates.retain(|mempool| request.preferred_mempools.contains(&mempool.name));
        }

        if candidates.is_empty() {
            return None;
        }

        // Score candidates based on multiple factors
        let mut scored_candidates: Vec<(f64, &PrivateMempool)> = candidates
            .into_iter()
            .map(|mempool| {
                let score = self.calculate_mempool_score(mempool, request, &network_conditions);
                (score, mempool)
            })
            .collect();

        // Sort by score (highest first)
        scored_candidates.sort_by(|a, b| b.0.partial_cmp(&a.0).unwrap_or(std::cmp::Ordering::Equal));

        scored_candidates.first().map(|(_, mempool)| (*mempool).clone())
    }

    fn calculate_mempool_score(
        &self,
        mempool: &PrivateMempool,
        request: &RoutingRequest,
        network_conditions: &NetworkConditions,
    ) -> f64 {
        let mut score = 0.0;

        // Reliability weight (40%)
        score += mempool.reliability * 0.4;

        // Cost efficiency weight (30%)
        let cost_efficiency = 1.0 - (mempool.cost_multiplier - 1.0).min(0.5);
        score += cost_efficiency * 0.3;

        // Speed weight (20%)
        let target_time = request.target_inclusion_time.unwrap_or(Duration::seconds(60));
        let speed_score = if mempool.average_inclusion_time <= target_time {
            1.0
        } else {
            (target_time.num_seconds() as f64) / (mempool.average_inclusion_time.num_seconds() as f64)
        };
        score += speed_score.min(1.0) * 0.2;

        // Priority adjustment weight (10%)
        let priority_boost = match request.priority {
            RoutingPriority::Critical => 0.2,
            RoutingPriority::High => 0.1,
            RoutingPriority::Normal => 0.0,
            RoutingPriority::Low => -0.05,
        };
        score += priority_boost * 0.1;

        // Network congestion adjustment
        if network_conditions.network_congestion > 0.8 {
            // Prefer faster mempools during high congestion
            if mempool.average_inclusion_time < Duration::seconds(15) {
                score += 0.1;
            }
        }

        score.max(0.0).min(1.0)
    }

    async fn attempt_routing(&self, request: &RoutingRequest, mempool: &PrivateMempool) -> RoutingResult {
        let start_time = std::time::Instant::now();
        
        // Simulate routing logic based on mempool reliability
        let success_probability = mempool.reliability;
        let random_factor = (request.transaction.block_number % 100) as f64 / 100.0;
        
        let estimated_cost = self.calculate_estimated_cost(&request.transaction, mempool).await;
        let estimated_inclusion_time = self.calculate_estimated_inclusion_time(mempool, &request.priority).await;

        if random_factor < success_probability {
            // Successful routing
            let actual_inclusion_time = Some(estimated_inclusion_time + Duration::milliseconds(
                ((request.transaction.transaction_index % 10) as i64 - 5) * 100
            ));

            RoutingResult {
                request_id: request.request_id.clone(),
                selected_mempool: mempool.name.clone(),
                status: RoutingStatus::Confirmed,
                estimated_cost,
                estimated_inclusion_time,
                actual_cost: Some(estimated_cost),
                actual_inclusion_time,
                confirmation_hash: Some(format!("0xconfirmed_{}", request.transaction.hash)),
                error_message: None,
            }
        } else {
            // Failed routing - attempt fallback if enabled
            if self.config.fallback_to_public {
                self.create_fallback_result(request, &format!("Routing failed via {}", mempool.name)).await
            } else {
                RoutingResult {
                    request_id: request.request_id.clone(),
                    selected_mempool: mempool.name.clone(),
                    status: RoutingStatus::Failed,
                    estimated_cost,
                    estimated_inclusion_time,
                    actual_cost: None,
                    actual_inclusion_time: None,
                    confirmation_hash: None,
                    error_message: Some(format!("Routing failed via {}", mempool.name)),
                }
            }
        }
    }

    async fn create_fallback_result(&self, request: &RoutingRequest, reason: &str) -> RoutingResult {
        let public_cost = self.calculate_public_mempool_cost(&request.transaction).await;
        let public_inclusion_time = Duration::seconds(15); // Typical public mempool time

        RoutingResult {
            request_id: request.request_id.clone(),
            selected_mempool: "public".to_string(),
            status: RoutingStatus::Fallback,
            estimated_cost: public_cost,
            estimated_inclusion_time: public_inclusion_time,
            actual_cost: Some(public_cost),
            actual_inclusion_time: Some(public_inclusion_time),
            confirmation_hash: Some(format!("0xfallback_{}", request.transaction.hash)),
            error_message: Some(reason.to_string()),
        }
    }

    async fn calculate_estimated_cost(&self, transaction: &TransactionData, mempool: &PrivateMempool) -> Decimal {
        let base_cost = transaction.gas_price * Decimal::from(transaction.gas_used);
        let adjusted_cost = base_cost * Decimal::from_f64(mempool.cost_multiplier).unwrap_or(Decimal::ONE);
        adjusted_cost
    }

    async fn calculate_estimated_inclusion_time(&self, mempool: &PrivateMempool, priority: &RoutingPriority) -> Duration {
        let base_time = mempool.average_inclusion_time;
        
        let priority_multiplier = match priority {
            RoutingPriority::Critical => 0.7,
            RoutingPriority::High => 0.8,
            RoutingPriority::Normal => 1.0,
            RoutingPriority::Low => 1.3,
        };

        Duration::milliseconds((base_time.num_milliseconds() as f64 * priority_multiplier) as i64)
    }

    async fn calculate_public_mempool_cost(&self, transaction: &TransactionData) -> Decimal {
        let network_conditions = self.network_conditions.read().await;
        let congestion_multiplier = 1.0 + network_conditions.network_congestion * 0.5;
        
        let base_cost = transaction.gas_price * Decimal::from(transaction.gas_used);
        base_cost * Decimal::from_f64(congestion_multiplier).unwrap_or(Decimal::ONE)
    }

    async fn update_routing_metrics(&self, result: &RoutingResult) {
        let mut metrics = self.routing_metrics.write().await;
        
        match result.status {
            RoutingStatus::Confirmed => {
                metrics.successful_routes += 1;
                
                // Update mempool success rates
                let current_rate = metrics.mempool_success_rates
                    .get(&result.selected_mempool)
                    .unwrap_or(&0.0);
                let requests_for_mempool = metrics.mempool_success_rates.len() as f64 + 1.0;
                let new_rate = (current_rate * (requests_for_mempool - 1.0) + 1.0) / requests_for_mempool;
                metrics.mempool_success_rates.insert(result.selected_mempool.clone(), new_rate);
                
                // Update average inclusion time
                if let Some(actual_time) = result.actual_inclusion_time {
                    let current_avg = metrics.average_inclusion_time_ms;
                    let new_avg = (current_avg * (metrics.successful_routes - 1) as f64 + actual_time.num_milliseconds() as f64) / metrics.successful_routes as f64;
                    metrics.average_inclusion_time_ms = new_avg;
                }
            }
            RoutingStatus::Failed => {
                metrics.failed_routes += 1;
                
                // Update mempool success rates (failure)
                let current_rate = metrics.mempool_success_rates
                    .get(&result.selected_mempool)
                    .unwrap_or(&1.0);
                let requests_for_mempool = metrics.mempool_success_rates.len() as f64 + 1.0;
                let new_rate = (current_rate * (requests_for_mempool - 1.0)) / requests_for_mempool;
                metrics.mempool_success_rates.insert(result.selected_mempool.clone(), new_rate);
            }
            RoutingStatus::Fallback => {
                metrics.fallback_routes += 1;
            }
            _ => {}
        }

        // Calculate cost savings percentage
        if metrics.successful_routes > 0 {
            // Simplified calculation - in real implementation would compare to public mempool costs
            metrics.cost_savings_percentage = 15.0; // Example: 15% average savings
        }
    }

    pub async fn get_routing_metrics(&self) -> RoutingMetrics {
        self.routing_metrics.read().await.clone()
    }

    pub async fn get_routing_history(&self) -> HashMap<String, RoutingResult> {
        self.routing_history.read().await.clone()
    }

    pub async fn get_available_mempools(&self) -> HashMap<String, PrivateMempool> {
        self.available_mempools.read().await.clone()
    }

    pub async fn update_mempool_status(&self, mempool_name: &str, is_active: bool) {
        if let Some(mempool) = self.available_mempools.write().await.get_mut(mempool_name) {
            mempool.is_active = is_active;
        }
    }

    pub async fn add_mempool(&self, mempool: PrivateMempool) {
        self.available_mempools.write().await.insert(mempool.name.clone(), mempool);
    }

    pub async fn remove_mempool(&self, mempool_name: &str) {
        self.available_mempools.write().await.remove(mempool_name);
    }

    pub async fn update_network_conditions(&self, conditions: NetworkConditions) {
        *self.network_conditions.write().await = conditions;
    }

    pub async fn get_pending_transactions(&self) -> HashMap<String, RoutingRequest> {
        self.pending_transactions.read().await.clone()
    }

    pub async fn cancel_transaction(&self, request_id: &str) -> bool {
        self.pending_transactions.write().await.remove(request_id).is_some()
    }
}

// Test implementations

#[tokio::test]
async fn test_basic_transaction_routing() {
    let config = PrivateMempoolConfig::default();
    let router = MockPrivateMempoolRouter::new(config);

    let transaction = TransactionData {
        hash: "0xtx123".to_string(),
        from_address: "0xuser".to_string(),
        to_address: "0xcontract".to_string(),
        value: Decimal::from(1000),
        gas_used: 50000,
        gas_price: Decimal::from(25),
        timestamp: Utc::now(),
        function_selector: Some("0xa9059cbb".to_string()),
        input_data: "0xa9059cbb000000000000000000000000".to_string(),
        success: true,
        block_number: 100,
        transaction_index: 1,
        chain_id: 1, // Mainnet
    };

    let request = RoutingRequest {
        request_id: "req_001".to_string(),
        transaction,
        priority: RoutingPriority::Normal,
        max_cost: None,
        target_inclusion_time: None,
        preferred_mempools: vec![],
        avoid_mempools: vec![],
    };

    let result = router.route_transaction(request).await;

    assert!(!result.selected_mempool.is_empty());
    assert!(matches!(result.status, RoutingStatus::Confirmed | RoutingStatus::Fallback));
    assert!(result.estimated_cost > Decimal::ZERO);
    assert!(result.estimated_inclusion_time > Duration::seconds(0));
}

#[tokio::test]
async fn test_mempool_selection_by_chain() {
    let config = PrivateMempoolConfig::default();
    let router = MockPrivateMempoolRouter::new(config);

    // Test Ethereum mainnet (supported by all mempools)
    let eth_transaction = TransactionData {
        hash: "0xeth123".to_string(),
        from_address: "0xuser".to_string(),
        to_address: "0xcontract".to_string(),
        value: Decimal::from(1000),
        gas_used: 50000,
        gas_price: Decimal::from(25),
        timestamp: Utc::now(),
        function_selector: Some("0xa9059cbb".to_string()),
        input_data: "0xa9059cbb000000000000000000000000".to_string(),
        success: true,
        block_number: 100,
        transaction_index: 1,
        chain_id: 1, // Mainnet
    };

    // Test Polygon (only supported by Manifold)
    let polygon_transaction = TransactionData {
        chain_id: 137, // Polygon
        ..eth_transaction.clone()
    };

    let eth_request = RoutingRequest {
        request_id: "eth_req".to_string(),
        transaction: eth_transaction,
        priority: RoutingPriority::Normal,
        max_cost: None,
        target_inclusion_time: None,
        preferred_mempools: vec![],
        avoid_mempools: vec![],
    };

    let polygon_request = RoutingRequest {
        request_id: "polygon_req".to_string(),
        transaction: polygon_transaction,
        priority: RoutingPriority::Normal,
        max_cost: None,
        target_inclusion_time: None,
        preferred_mempools: vec![],
        avoid_mempools: vec![],
    };

    let eth_result = router.route_transaction(eth_request).await;
    let polygon_result = router.route_transaction(polygon_request).await;

    // Ethereum should have multiple mempool options
    assert!(matches!(eth_result.status, RoutingStatus::Confirmed | RoutingStatus::Fallback));
    
    // Polygon should route to Manifold or fallback
    assert!(matches!(polygon_result.status, RoutingStatus::Confirmed | RoutingStatus::Fallback));
    if polygon_result.status == RoutingStatus::Confirmed {
        assert_eq!(polygon_result.selected_mempool, "manifold");
    }
}

#[tokio::test]
async fn test_preferred_mempool_routing() {
    let config = PrivateMempoolConfig::default();
    let router = MockPrivateMempoolRouter::new(config);

    let transaction = TransactionData {
        hash: "0xtx123".to_string(),
        from_address: "0xuser".to_string(),
        to_address: "0xcontract".to_string(),
        value: Decimal::from(1000),
        gas_used: 50000,
        gas_price: Decimal::from(25),
        timestamp: Utc::now(),
        function_selector: Some("0xa9059cbb".to_string()),
        input_data: "0xa9059cbb000000000000000000000000".to_string(),
        success: true,
        block_number: 100,
        transaction_index: 1,
        chain_id: 1,
    };

    let request = RoutingRequest {
        request_id: "pref_req".to_string(),
        transaction,
        priority: RoutingPriority::Normal,
        max_cost: None,
        target_inclusion_time: None,
        preferred_mempools: vec!["flashbots".to_string()],
        avoid_mempools: vec![],
    };

    let result = router.route_transaction(request).await;

    if result.status == RoutingStatus::Confirmed {
        assert_eq!(result.selected_mempool, "flashbots");
    }
}

#[tokio::test]
async fn test_avoided_mempool_routing() {
    let config = PrivateMempoolConfig::default();
    let router = MockPrivateMempoolRouter::new(config);

    let transaction = TransactionData {
        hash: "0xtx123".to_string(),
        from_address: "0xuser".to_string(),
        to_address: "0xcontract".to_string(),
        value: Decimal::from(1000),
        gas_used: 50000,
        gas_price: Decimal::from(25),
        timestamp: Utc::now(),
        function_selector: Some("0xa9059cbb".to_string()),
        input_data: "0xa9059cbb000000000000000000000000".to_string(),
        success: true,
        block_number: 100,
        transaction_index: 1,
        chain_id: 1,
    };

    let request = RoutingRequest {
        request_id: "avoid_req".to_string(),
        transaction,
        priority: RoutingPriority::Normal,
        max_cost: None,
        target_inclusion_time: None,
        preferred_mempools: vec![],
        avoid_mempools: vec!["flashbots".to_string(), "eden".to_string()],
    };

    let result = router.route_transaction(request).await;

    if result.status == RoutingStatus::Confirmed {
        assert_ne!(result.selected_mempool, "flashbots");
        assert_ne!(result.selected_mempool, "eden");
    }
}

#[tokio::test]
async fn test_priority_based_routing() {
    let config = PrivateMempoolConfig::default();
    let router = MockPrivateMempoolRouter::new(config);

    let base_transaction = TransactionData {
        hash: "0xtx123".to_string(),
        from_address: "0xuser".to_string(),
        to_address: "0xcontract".to_string(),
        value: Decimal::from(1000),
        gas_used: 50000,
        gas_price: Decimal::from(25),
        timestamp: Utc::now(),
        function_selector: Some("0xa9059cbb".to_string()),
        input_data: "0xa9059cbb000000000000000000000000".to_string(),
        success: true,
        block_number: 100,
        transaction_index: 1,
        chain_id: 1,
    };

    let critical_request = RoutingRequest {
        request_id: "critical_req".to_string(),
        transaction: base_transaction.clone(),
        priority: RoutingPriority::Critical,
        max_cost: None,
        target_inclusion_time: Some(Duration::seconds(5)),
        preferred_mempools: vec![],
        avoid_mempools: vec![],
    };

    let low_request = RoutingRequest {
        request_id: "low_req".to_string(),
        transaction: base_transaction,
        priority: RoutingPriority::Low,
        max_cost: Some(Decimal::from(100)),
        target_inclusion_time: None,
        preferred_mempools: vec![],
        avoid_mempools: vec![],
    };

    let critical_result = router.route_transaction(critical_request).await;
    let low_result = router.route_transaction(low_request).await;

    // Critical priority should get faster inclusion time
    assert!(critical_result.estimated_inclusion_time <= low_result.estimated_inclusion_time);
}

#[tokio::test]
async fn test_cost_limit_enforcement() {
    let config = PrivateMempoolConfig {
        cost_multiplier_limit: 1.15, // Strict cost limit
        ..PrivateMempoolConfig::default()
    };
    let router = MockPrivateMempoolRouter::new(config);

    let transaction = TransactionData {
        hash: "0xtx123".to_string(),
        from_address: "0xuser".to_string(),
        to_address: "0xcontract".to_string(),
        value: Decimal::from(1000),
        gas_used: 50000,
        gas_price: Decimal::from(25),
        timestamp: Utc::now(),
        function_selector: Some("0xa9059cbb".to_string()),
        input_data: "0xa9059cbb000000000000000000000000".to_string(),
        success: true,
        block_number: 100,
        transaction_index: 1,
        chain_id: 1,
    };

    let request = RoutingRequest {
        request_id: "cost_req".to_string(),
        transaction,
        priority: RoutingPriority::Normal,
        max_cost: None,
        target_inclusion_time: None,
        preferred_mempools: vec![],
        avoid_mempools: vec![],
    };

    let result = router.route_transaction(request).await;

    // Should exclude expensive mempools (manifold has 1.2 multiplier)
    if result.status == RoutingStatus::Confirmed {
        assert_ne!(result.selected_mempool, "manifold");
    }
}

#[tokio::test]
async fn test_reliability_threshold_filtering() {
    let config = PrivateMempoolConfig {
        min_reliability_threshold: 0.9, // High reliability requirement
        ..PrivateMempoolConfig::default()
    };
    let router = MockPrivateMempoolRouter::new(config);

    let transaction = TransactionData {
        hash: "0xtx123".to_string(),
        from_address: "0xuser".to_string(),
        to_address: "0xcontract".to_string(),
        value: Decimal::from(1000),
        gas_used: 50000,
        gas_price: Decimal::from(25),
        timestamp: Utc::now(),
        function_selector: Some("0xa9059cbb".to_string()),
        input_data: "0xa9059cbb000000000000000000000000".to_string(),
        success: true,
        block_number: 100,
        transaction_index: 1,
        chain_id: 1,
    };

    let request = RoutingRequest {
        request_id: "reliability_req".to_string(),
        transaction,
        priority: RoutingPriority::Normal,
        max_cost: None,
        target_inclusion_time: None,
        preferred_mempools: vec![],
        avoid_mempools: vec![],
    };

    let result = router.route_transaction(request).await;

    // Should only use Flashbots (0.95 reliability) or fallback
    if result.status == RoutingStatus::Confirmed {
        assert_eq!(result.selected_mempool, "flashbots");
    }
}

#[tokio::test]
async fn test_fallback_mechanism() {
    let config = PrivateMempoolConfig {
        fallback_to_public: true,
        min_reliability_threshold: 0.99, // Impossible threshold
        ..PrivateMempoolConfig::default()
    };
    let router = MockPrivateMempoolRouter::new(config);

    let transaction = TransactionData {
        hash: "0xtx123".to_string(),
        from_address: "0xuser".to_string(),
        to_address: "0xcontract".to_string(),
        value: Decimal::from(1000),
        gas_used: 50000,
        gas_price: Decimal::from(25),
        timestamp: Utc::now(),
        function_selector: Some("0xa9059cbb".to_string()),
        input_data: "0xa9059cbb000000000000000000000000".to_string(),
        success: true,
        block_number: 100,
        transaction_index: 1,
        chain_id: 1,
    };

    let request = RoutingRequest {
        request_id: "fallback_req".to_string(),
        transaction,
        priority: RoutingPriority::Normal,
        max_cost: None,
        target_inclusion_time: None,
        preferred_mempools: vec![],
        avoid_mempools: vec![],
    };

    let result = router.route_transaction(request).await;

    assert_eq!(result.status, RoutingStatus::Fallback);
    assert_eq!(result.selected_mempool, "public");
    assert!(result.error_message.is_some());
}

#[tokio::test]
async fn test_mempool_management() {
    let config = PrivateMempoolConfig::default();
    let router = MockPrivateMempoolRouter::new(config);

    // Test adding a new mempool
    let new_mempool = PrivateMempool {
        name: "test_mempool".to_string(),
        mempool_type: MempoolType::Custom("test".to_string()),
        endpoint: "https://test.com".to_string(),
        reliability: 0.85,
        cost_multiplier: 1.05,
        average_inclusion_time: Duration::seconds(8),
        supported_chains: vec![1, 5],
        max_gas_price: Some(Decimal::from(300)),
        is_active: true,
    };

    router.add_mempool(new_mempool).await;
    
    let mempools = router.get_available_mempools().await;
    assert!(mempools.contains_key("test_mempool"));

    // Test updating mempool status
    router.update_mempool_status("test_mempool", false).await;
    
    let updated_mempools = router.get_available_mempools().await;
    assert_eq!(updated_mempools.get("test_mempool").unwrap().is_active, false);

    // Test removing mempool
    router.remove_mempool("test_mempool").await;
    
    let final_mempools = router.get_available_mempools().await;
    assert!(!final_mempools.contains_key("test_mempool"));
}

#[tokio::test]
async fn test_network_conditions_impact() {
    let config = PrivateMempoolConfig::default();
    let router = MockPrivateMempoolRouter::new(config);

    // Set high congestion network conditions
    let high_congestion = NetworkConditions {
        base_gas_price: Decimal::from(100),
        network_congestion: 0.9,
        block_time: Duration::seconds(20),
        mempool_sizes: HashMap::new(),
    };

    router.update_network_conditions(high_congestion).await;

    let transaction = TransactionData {
        hash: "0xtx123".to_string(),
        from_address: "0xuser".to_string(),
        to_address: "0xcontract".to_string(),
        value: Decimal::from(1000),
        gas_used: 50000,
        gas_price: Decimal::from(100),
        timestamp: Utc::now(),
        function_selector: Some("0xa9059cbb".to_string()),
        input_data: "0xa9059cbb000000000000000000000000".to_string(),
        success: true,
        block_number: 100,
        transaction_index: 1,
        chain_id: 1,
    };

    let request = RoutingRequest {
        request_id: "congestion_req".to_string(),
        transaction,
        priority: RoutingPriority::High,
        max_cost: None,
        target_inclusion_time: None,
        preferred_mempools: vec![],
        avoid_mempools: vec![],
    };

    let result = router.route_transaction(request).await;

    // During high congestion, should prefer faster mempools
    if result.status == RoutingStatus::Confirmed {
        assert!(result.estimated_inclusion_time <= Duration::seconds(15));
    }
}

#[tokio::test]
async fn test_metrics_tracking() {
    let config = PrivateMempoolConfig::default();
    let router = MockPrivateMempoolRouter::new(config);

    let transaction = TransactionData {
        hash: "0xtx123".to_string(),
        from_address: "0xuser".to_string(),
        to_address: "0xcontract".to_string(),
        value: Decimal::from(1000),
        gas_used: 50000,
        gas_price: Decimal::from(25),
        timestamp: Utc::now(),
        function_selector: Some("0xa9059cbb".to_string()),
        input_data: "0xa9059cbb000000000000000000000000".to_string(),
        success: true,
        block_number: 100,
        transaction_index: 1,
        chain_id: 1,
    };

    // Route multiple transactions
    for i in 0..5 {
        let request = RoutingRequest {
            request_id: format!("metrics_req_{}", i),
            transaction: TransactionData {
                hash: format!("0xtx{}", i),
                ..transaction.clone()
            },
            priority: RoutingPriority::Normal,
            max_cost: None,
            target_inclusion_time: None,
            preferred_mempools: vec![],
            avoid_mempools: vec![],
        };

        router.route_transaction(request).await;
    }

    let metrics = router.get_routing_metrics().await;
    
    assert_eq!(metrics.total_requests, 5);
    assert!(metrics.successful_routes + metrics.failed_routes + metrics.fallback_routes == 5);
    assert!(!metrics.mempool_success_rates.is_empty());
    assert_eq!(metrics.chain_distribution.get(&1).unwrap_or(&0), &5);
}

#[tokio::test]
async fn test_transaction_cancellation() {
    let config = PrivateMempoolConfig::default();
    let router = MockPrivateMempoolRouter::new(config);

    let transaction = TransactionData {
        hash: "0xtx123".to_string(),
        from_address: "0xuser".to_string(),
        to_address: "0xcontract".to_string(),
        value: Decimal::from(1000),
        gas_used: 50000,
        gas_price: Decimal::from(25),
        timestamp: Utc::now(),
        function_selector: Some("0xa9059cbb".to_string()),
        input_data: "0xa9059cbb000000000000000000000000".to_string(),
        success: true,
        block_number: 100,
        transaction_index: 1,
        chain_id: 1,
    };

    let request = RoutingRequest {
        request_id: "cancel_req".to_string(),
        transaction,
        priority: RoutingPriority::Normal,
        max_cost: None,
        target_inclusion_time: None,
        preferred_mempools: vec![],
        avoid_mempools: vec![],
    };

    // Route transaction (stores it as pending)
    router.route_transaction(request).await;
    
    // Verify it's in pending transactions
    let pending = router.get_pending_transactions().await;
    assert!(pending.contains_key("cancel_req"));

    // Cancel the transaction
    let cancelled = router.cancel_transaction("cancel_req").await;
    assert!(cancelled);

    // Verify it's removed from pending
    let pending_after = router.get_pending_transactions().await;
    assert!(!pending_after.contains_key("cancel_req"));
}

#[tokio::test]
async fn test_routing_history_storage() {
    let config = PrivateMempoolConfig::default();
    let router = MockPrivateMempoolRouter::new(config);

    let transaction = TransactionData {
        hash: "0xtx123".to_string(),
        from_address: "0xuser".to_string(),
        to_address: "0xcontract".to_string(),
        value: Decimal::from(1000),
        gas_used: 50000,
        gas_price: Decimal::from(25),
        timestamp: Utc::now(),
        function_selector: Some("0xa9059cbb".to_string()),
        input_data: "0xa9059cbb000000000000000000000000".to_string(),
        success: true,
        block_number: 100,
        transaction_index: 1,
        chain_id: 1,
    };

    let request = RoutingRequest {
        request_id: "history_req".to_string(),
        transaction,
        priority: RoutingPriority::Normal,
        max_cost: None,
        target_inclusion_time: None,
        preferred_mempools: vec![],
        avoid_mempools: vec![],
    };

    router.route_transaction(request).await;
    
    let history = router.get_routing_history().await;
    assert!(history.contains_key("history_req"));
    
    let result = history.get("history_req").unwrap();
    assert_eq!(result.request_id, "history_req");
    assert!(!result.selected_mempool.is_empty());
}

#[tokio::test]
async fn test_disabled_private_routing() {
    let config = PrivateMempoolConfig {
        enable_private_routing: false,
        fallback_to_public: true,
        ..PrivateMempoolConfig::default()
    };
    let router = MockPrivateMempoolRouter::new(config);

    let transaction = TransactionData {
        hash: "0xtx123".to_string(),
        from_address: "0xuser".to_string(),
        to_address: "0xcontract".to_string(),
        value: Decimal::from(1000),
        gas_used: 50000,
        gas_price: Decimal::from(25),
        timestamp: Utc::now(),
        function_selector: Some("0xa9059cbb".to_string()),
        input_data: "0xa9059cbb000000000000000000000000".to_string(),
        success: true,
        block_number: 100,
        transaction_index: 1,
        chain_id: 1,
    };

    let request = RoutingRequest {
        request_id: "disabled_req".to_string(),
        transaction,
        priority: RoutingPriority::Normal,
        max_cost: None,
        target_inclusion_time: None,
        preferred_mempools: vec![],
        avoid_mempools: vec![],
    };

    let result = router.route_transaction(request).await;

    assert_eq!(result.status, RoutingStatus::Fallback);
    assert_eq!(result.selected_mempool, "public");
    assert!(result.error_message.as_ref().unwrap().contains("disabled"));
}

#[tokio::test]
async fn test_performance_benchmark() {
    let config = PrivateMempoolConfig::default();
    let router = MockPrivateMempoolRouter::new(config);

    let base_transaction = TransactionData {
        hash: "0xtx123".to_string(),
        from_address: "0xuser".to_string(),
        to_address: "0xcontract".to_string(),
        value: Decimal::from(1000),
        gas_used: 50000,
        gas_price: Decimal::from(25),
        timestamp: Utc::now(),
        function_selector: Some("0xa9059cbb".to_string()),
        input_data: "0xa9059cbb000000000000000000000000".to_string(),
        success: true,
        block_number: 100,
        transaction_index: 1,
        chain_id: 1,
    };

    let start_time = std::time::Instant::now();

    // Route 100 transactions
    for i in 0..100 {
        let request = RoutingRequest {
            request_id: format!("perf_req_{}", i),
            transaction: TransactionData {
                hash: format!("0xtx{}", i),
                ..base_transaction.clone()
            },
            priority: RoutingPriority::Normal,
            max_cost: None,
            target_inclusion_time: None,
            preferred_mempools: vec![],
            avoid_mempools: vec![],
        };

        router.route_transaction(request).await;
    }

    let routing_time = start_time.elapsed();

    // Should complete 100 routing decisions within reasonable time
    assert!(routing_time.as_millis() < 1000); // Less than 1 second
    
    let metrics = router.get_routing_metrics().await;
    assert_eq!(metrics.total_requests, 100);
}