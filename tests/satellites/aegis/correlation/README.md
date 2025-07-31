# Portfolio Correlation Analysis Test Suite

This test suite validates the comprehensive portfolio correlation analysis functionality of the Aegis Satellite's risk management system.

## Test Categories

### 1. Correlation Matrix Tests
- **Purpose**: Validate accurate correlation calculations between portfolio assets
- **Performance Target**: <200ms for correlation matrix computation up to 50 assets
- **Success Criteria**: >99% accuracy in correlation calculations compared to statistical baselines

#### Test Files:
- `correlation_matrix.test.rs` - Core correlation matrix calculations and caching

### 2. Portfolio Diversification Tests  
- **Purpose**: Measure portfolio diversification effectiveness and concentration risk
- **Performance Target**: <100ms for diversification score calculation
- **Success Criteria**: Accurate diversification scoring aligned with modern portfolio theory

#### Test Files:
- `diversification_analysis.test.rs` - Diversification scoring and concentration risk metrics

### 3. Risk Metrics Tests
- **Purpose**: Calculate Value at Risk (VaR), Conditional VaR, and tail risk measures
- **Performance Target**: <150ms for complete risk metrics calculation
- **Success Criteria**: Risk metrics within 5% of Monte Carlo simulation baselines

#### Test Files:
- `risk_metrics.test.rs` - VaR, CVaR, and volatility calculations
- `tail_risk_analysis.test.rs` - Extreme event analysis and tail dependence

### 4. Stress Testing Tests
- **Purpose**: Simulate portfolio performance under adverse market scenarios
- **Performance Target**: <500ms for comprehensive stress test execution
- **Success Criteria**: Realistic scenario modeling with historically-aligned recovery periods

#### Test Files:
- `stress_testing.test.rs` - Market crash, crypto winter, and regulatory shock scenarios

### 5. Rebalancing Recommendation Tests
- **Purpose**: Generate intelligent portfolio rebalancing suggestions
- **Performance Target**: <300ms for recommendation generation
- **Success Criteria**: Actionable recommendations that reduce risk by >10%

#### Test Files:
- `rebalancing_recommendations.test.rs` - Portfolio optimization suggestions

### 6. Historical Analysis Tests
- **Purpose**: Analyze historical correlation patterns and regime changes
- **Performance Target**: <1000ms for 2-year historical analysis
- **Success Criteria**: Detection of major correlation regime shifts

#### Test Files:
- `historical_analysis.test.rs` - Time-series correlation analysis and regime detection

## Key Features Tested

### Statistical Accuracy
- ✅ Pearson correlation coefficients with numerical precision
- ✅ Rolling correlation windows (30, 60, 90, 180 days)
- ✅ Statistical significance testing for correlations
- ✅ Outlier handling and data quality validation

### Performance Metrics
- ✅ Sub-200ms correlation matrix computation for 50+ assets
- ✅ Efficient caching with 1-hour TTL for correlation matrices  
- ✅ Batch processing for multiple portfolio analysis
- ✅ Memory-efficient handling of large price history datasets

### Risk Management
- ✅ Dynamic correlation threshold detection (0.7 high, 0.9 critical)
- ✅ Multi-scenario stress testing with recovery time estimation
- ✅ Tail risk analysis with extreme event modeling
- ✅ Portfolio optimization using mean-variance principles

### Real-world Scenarios
- ✅ Market crash simulation (-50% broad market decline)
- ✅ Crypto winter scenario (-80% cryptocurrency assets)
- ✅ DeFi contagion modeling (-70% DeFi protocol tokens)
- ✅ Regulatory shock impact (-30% across regulated assets)
- ✅ Black swan event modeling (-90% extreme scenarios)

## Asset Type Coverage

### Primary Asset Classes
- **Cryptocurrencies**: BTC, ETH, major altcoins
- **DeFi Protocols**: Uniswap, Aave, Compound, MakerDAO
- **Stablecoins**: USDC, USDT, DAI for stability analysis
- **Real World Assets**: Tokenized commodities, real estate
- **Traditional Finance**: Stocks, bonds, commodities for mixed portfolios

### Correlation Patterns Tested
- **Crypto-Crypto**: High positive correlations (0.7-0.9)
- **Crypto-Stable**: Low correlations (0.1-0.3) 
- **DeFi-DeFi**: Medium-high correlations (0.5-0.8)
- **Cross-Asset**: Traditional vs crypto correlations (0.2-0.6)
- **Crisis Correlations**: Increased correlations during market stress

## Test Data Specifications

### Price History Requirements
- **Minimum Data Points**: 30 daily prices for basic correlation
- **Optimal Data Points**: 90+ daily prices for robust correlation
- **Maximum Lookback**: 2 years of daily price data
- **Update Frequency**: Real-time price updates with microsecond timestamps

### Portfolio Specifications
- **Minimum Positions**: 2 assets for correlation analysis
- **Maximum Positions**: 100 assets for enterprise portfolios
- **Position Sizes**: $1,000 to $10,000,000 per position
- **Rebalancing Thresholds**: 10% allocation drift triggers

## Expected Outcomes

### Correlation Analysis Results
- **Low Correlation Portfolio**: Diversification score >70%
- **Moderate Correlation Portfolio**: Diversification score 40-70%
- **High Correlation Portfolio**: Diversification score <40%
- **Critical Risk Alert**: Any correlation >90% triggers immediate alert

### Risk Metrics Benchmarks
- **Conservative Portfolio**: VaR <5%, CVaR <8%
- **Moderate Risk Portfolio**: VaR 5-15%, CVaR 8-20%
- **Aggressive Portfolio**: VaR 15-30%, CVaR 20-40%
- **High Risk Portfolio**: VaR >30%, CVaR >40%

### Stress Test Recovery Times
- **Market Crash**: 6 months average recovery
- **Crypto Winter**: 12 months average recovery  
- **DeFi Contagion**: 3 months average recovery
- **Regulatory Shock**: 4 months average recovery
- **Black Swan**: 24 months average recovery

## Integration Points

### Data Sources
- **Price Feeds**: Real-time and historical price data integration
- **Market Data**: Volume, market cap, volatility metrics
- **External APIs**: CoinGecko, CoinMarketCap, traditional finance APIs

### Alert System Integration
- **High Correlation Alerts**: Automatic notifications when correlations exceed thresholds
- **Concentration Risk Alerts**: Warnings when single positions exceed 25% allocation
- **Stress Test Alerts**: Notifications when portfolio fails stress test scenarios
- **Rebalancing Alerts**: Recommendations when portfolio drift exceeds thresholds

### Performance Monitoring
- **Computation Time Tracking**: Monitor analysis execution times
- **Memory Usage Monitoring**: Track memory consumption for large portfolios
- **Cache Hit Rates**: Monitor correlation matrix cache effectiveness
- **API Response Times**: Track external data source performance

---

*This test suite ensures the Aegis Satellite's correlation analysis system provides accurate, fast, and actionable portfolio risk management capabilities aligned with modern portfolio theory and quantitative finance best practices.*