pub mod aegis_satellite_integration;
pub mod external_data_integration;
pub mod end_to_end_workflow;

use std::sync::Arc;
use tokio::sync::RwLock;
use chrono::{Utc, Duration};
use rust_decimal::Decimal;
use std::collections::HashMap;

// Re-export common test utilities
pub use aegis_satellite_integration::*;
pub use external_data_integration::*;
pub use end_to_end_workflow::*;

/// Integration test suite configuration
#[derive(Debug, Clone)]
pub struct IntegrationTestConfig {
    pub run_performance_tests: bool,
    pub run_stress_tests: bool,
    pub run_failure_recovery_tests: bool,
    pub max_test_duration_seconds: u64,
    pub enable_detailed_logging: bool,
}

impl Default for IntegrationTestConfig {
    fn default() -> Self {
        Self {
            run_performance_tests: true,
            run_stress_tests: true,
            run_failure_recovery_tests: true,
            max_test_duration_seconds: 300, // 5 minutes
            enable_detailed_logging: false,
        }
    }
}

/// Test result aggregation
#[derive(Debug, Clone)]
pub struct IntegrationTestResults {
    pub total_tests: usize,
    pub passed_tests: usize,
    pub failed_tests: usize,
    pub skipped_tests: usize,
    pub total_duration_ms: u64,
    pub test_details: Vec<TestResult>,
}

#[derive(Debug, Clone)]
pub struct TestResult {
    pub test_name: String,
    pub status: TestStatus,
    pub duration_ms: u64,
    pub error_message: Option<String>,
    pub metrics: HashMap<String, f64>,
}

#[derive(Debug, Clone, PartialEq)]
pub enum TestStatus {
    Passed,
    Failed,
    Skipped,
    Timeout,
}

/// Shared test utilities
pub struct TestUtilities;

impl TestUtilities {
    /// Create a standardized test position
    pub fn create_standard_position(
        token: &str,
        collateral_usd: f64,
        debt_usd: f64,
        liquidation_threshold: f64,
        protocol: &str,
    ) -> aegis_satellite::types::Position {
        use aegis_satellite::types::{Position, PositionId};
        
        Position {
            id: PositionId::new(),
            user_address: format!("0x{:040x}", rand::random::<u128>()),
            token_address: token.to_string(),
            collateral_amount: Decimal::from_f64(collateral_usd).unwrap_or(Decimal::ZERO),
            debt_amount: Decimal::from_f64(debt_usd).unwrap_or(Decimal::ZERO),
            liquidation_threshold: Decimal::from_f64(liquidation_threshold).unwrap_or(Decimal::new(120, 2)),
            created_at: Utc::now(),
            updated_at: Utc::now(),
            protocol: protocol.to_string(),
            is_active: true,
            health_factor: None,
        }
    }

    /// Create test simulation positions
    pub fn create_simulation_positions(count: usize) -> Vec<aegis_satellite::simulation::SimulationPosition> {
        use aegis_satellite::simulation::SimulationPosition;
        
        let tokens = vec!["BTC", "ETH", "USDC", "AAVE", "UNI", "LINK"];
        let mut positions = Vec::new();

        for i in 0..count {
            let token = tokens[i % tokens.len()];
            let base_value = 10000.0 + (i as f64 * 1000.0);
            
            positions.push(SimulationPosition {
                token_address: token.to_string(),
                quantity: if token == "USDC" { base_value } else { base_value / 1000.0 },
                entry_price: if token == "BTC" { 45000.0 } else if token == "ETH" { 2800.0 } else { 1.0 },
                current_price: if token == "BTC" { 50000.0 } else if token == "ETH" { 3000.0 } else { 1.0 },
                collateral_value: base_value,
                debt_value: base_value * 0.5,
                liquidation_threshold: 1.2 + (i as f64 * 0.1),
                health_factor: 1.8 + (i as f64 * 0.2),
            });
        }

        positions
    }

    /// Generate realistic price history
    pub fn generate_price_history(
        base_price: f64,
        days: usize,
        volatility: f64,
    ) -> Vec<(chrono::DateTime<Utc>, f64)> {
        let mut history = Vec::new();
        let mut current_price = base_price;

        for i in 0..days {
            let days_ago = days - i;
            let timestamp = Utc::now() - Duration::days(days_ago as i64);
            
            // Add some realistic price movement
            let random_change = (rand::random::<f64>() - 0.5) * volatility * 2.0;
            let trend = (i as f64 / days as f64 - 0.5) * 0.1; // Slight upward trend
            current_price *= 1.0 + random_change + trend;
            current_price = current_price.max(base_price * 0.1); // Don't go below 10% of base
            
            history.push((timestamp, current_price));
        }

        history
    }

    /// Validate test environment
    pub async fn validate_test_environment() -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        // Check that required dependencies are available
        // This is a placeholder for actual environment validation
        
        // Validate that the Aegis satellite can be instantiated
        // (This would be done with actual mock providers in real tests)
        
        Ok(())
    }

    /// Measure test performance
    pub fn measure_performance<F, T>(operation: F) -> (T, std::time::Duration)
    where
        F: FnOnce() -> T,
    {
        let start_time = std::time::Instant::now();
        let result = operation();
        let duration = start_time.elapsed();
        (result, duration)
    }

    /// Assert within tolerance for floating point comparisons
    pub fn assert_within_tolerance(actual: f64, expected: f64, tolerance: f64, message: &str) {
        let diff = (actual - expected).abs();
        assert!(
            diff <= tolerance,
            "{}: expected {:.6}, got {:.6}, difference {:.6} exceeds tolerance {:.6}",
            message, expected, actual, diff, tolerance
        );
    }

    /// Create deterministic random seed for reproducible tests
    pub fn create_test_seed() -> u64 {
        use std::collections::hash_map::DefaultHasher;
        use std::hash::{Hash, Hasher};
        
        let mut hasher = DefaultHasher::new();
        "aegis_integration_test_seed".hash(&mut hasher);
        hasher.finish()
    }

    /// Wait for async condition with timeout
    pub async fn wait_for_condition<F>(
        mut condition: F,
        timeout_ms: u64,
        check_interval_ms: u64,
    ) -> Result<(), &'static str>
    where
        F: FnMut() -> bool,
    {
        let start_time = std::time::Instant::now();
        let timeout_duration = std::time::Duration::from_millis(timeout_ms);
        let check_interval = std::time::Duration::from_millis(check_interval_ms);

        while start_time.elapsed() < timeout_duration {
            if condition() {
                return Ok(());
            }
            tokio::time::sleep(check_interval).await;
        }

        Err("Condition not met within timeout")
    }
}

/// Trait for integration test suites
#[async_trait::async_trait]
pub trait IntegrationTestSuite {
    /// Get the name of this test suite
    fn suite_name(&self) -> &str;

    /// Set up test environment
    async fn setup(&mut self) -> Result<(), Box<dyn std::error::Error + Send + Sync>>;

    /// Run all tests in the suite
    async fn run_tests(&self, config: &IntegrationTestConfig) -> IntegrationTestResults;

    /// Clean up test environment
    async fn teardown(&mut self) -> Result<(), Box<dyn std::error::Error + Send + Sync>>;
}

/// Mock implementations registry for dependency injection in tests
pub struct MockRegistry {
    price_feeds: HashMap<String, Arc<dyn aegis_satellite::liquidation::PriceFeedProvider>>,
    trade_executors: HashMap<String, Arc<dyn aegis_satellite::risk::TradeExecutor>>,
}

impl MockRegistry {
    pub fn new() -> Self {
        Self {
            price_feeds: HashMap::new(),
            trade_executors: HashMap::new(),
        }
    }

    pub fn register_price_feed(
        &mut self,
        name: String,
        provider: Arc<dyn aegis_satellite::liquidation::PriceFeedProvider>,
    ) {
        self.price_feeds.insert(name, provider);
    }

    pub fn register_trade_executor(
        &mut self,
        name: String,
        executor: Arc<dyn aegis_satellite::risk::TradeExecutor>,
    ) {
        self.trade_executors.insert(name, executor);
    }

    pub fn get_price_feed(
        &self,
        name: &str,
    ) -> Option<Arc<dyn aegis_satellite::liquidation::PriceFeedProvider>> {
        self.price_feeds.get(name).cloned()
    }

    pub fn get_trade_executor(
        &self,
        name: &str,
    ) -> Option<Arc<dyn aegis_satellite::risk::TradeExecutor>> {
        self.trade_executors.get(name).cloned()
    }
}

impl Default for MockRegistry {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_utilities_create_standard_position() {
        let position = TestUtilities::create_standard_position(
            "BTC",
            100000.0,
            50000.0,
            1.2,
            "TestProtocol",
        );

        assert_eq!(position.token_address, "BTC");
        assert_eq!(position.collateral_amount, Decimal::from_f64(100000.0).unwrap());
        assert_eq!(position.debt_amount, Decimal::from_f64(50000.0).unwrap());
        assert_eq!(position.protocol, "TestProtocol");
        assert!(position.is_active);
    }

    #[test]
    fn test_utilities_create_simulation_positions() {
        let positions = TestUtilities::create_simulation_positions(5);
        
        assert_eq!(positions.len(), 5);
        
        for position in &positions {
            assert!(!position.token_address.is_empty());
            assert!(position.collateral_value > 0.0);
            assert!(position.health_factor > 0.0);
        }
    }

    #[test]
    fn test_utilities_generate_price_history() {
        let history = TestUtilities::generate_price_history(50000.0, 30, 0.1);
        
        assert_eq!(history.len(), 30);
        
        // Verify timestamps are in ascending order
        for i in 1..history.len() {
            assert!(history[i].0 > history[i-1].0);
        }

        // Verify prices are reasonable
        for (_, price) in &history {
            assert!(*price > 0.0);
            assert!(*price > 5000.0); // Should be above 10% of base price
        }
    }

    #[test]
    fn test_assert_within_tolerance() {
        // Should not panic for values within tolerance
        TestUtilities::assert_within_tolerance(1.0, 1.001, 0.01, "test");
        TestUtilities::assert_within_tolerance(100.0, 99.5, 1.0, "test");
    }

    #[test]
    #[should_panic]
    fn test_assert_within_tolerance_fails() {
        TestUtilities::assert_within_tolerance(1.0, 2.0, 0.1, "should fail");
    }

    #[test]
    fn test_create_test_seed() {
        let seed1 = TestUtilities::create_test_seed();
        let seed2 = TestUtilities::create_test_seed();
        
        // Seeds should be deterministic
        assert_eq!(seed1, seed2);
    }

    #[tokio::test]
    async fn test_wait_for_condition_success() {
        let mut counter = 0;
        let condition = || {
            counter += 1;
            counter >= 3
        };

        let result = TestUtilities::wait_for_condition(condition, 1000, 10).await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_wait_for_condition_timeout() {
        let condition = || false; // Never true

        let result = TestUtilities::wait_for_condition(condition, 100, 10).await;
        assert!(result.is_err());
    }

    #[test]
    fn test_mock_registry() {
        let mut registry = MockRegistry::new();
        
        // Test that initially empty
        assert!(registry.get_price_feed("test").is_none());
        assert!(registry.get_trade_executor("test").is_none());
        
        // Registry should be functional (actual mock registration would be done in integration tests)
    }
}