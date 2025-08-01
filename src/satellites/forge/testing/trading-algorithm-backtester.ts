/**
 * Trading Algorithm Backtesting Framework
 * Comprehensive testing suite for validating trading strategies, performance metrics,
 * and algorithm optimization in the Forge Satellite
 */

import { EventEmitter } from 'events';
import { Logger } from 'winston';
import { createLogger, format, transports } from 'winston';

export interface BacktestConfig {
  enablePerformanceAnalysis: boolean;
  enableRiskAssessment: boolean;
  enableStrategyOptimization: boolean;
  enableMarketConditionTesting: boolean;
  enablePortfolioSimulation: boolean;
  startDate: Date;
  endDate: Date;
  initialCapital: number;
  maxDrawdown: number;
  riskFreeRate: number;
  benchmarkSymbol?: string;
  timeframe: '1m' | '5m' | '15m' | '1h' | '4h' | '1d';
  maxConcurrentBacktests: number;
  historicalDataPath?: string;
}

export interface MarketData {
  timestamp: Date;
  symbol: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  vwap?: number;
  spread?: number;
  liquidity?: number;
}

export interface TradingSignal {
  timestamp: Date;
  symbol: string;
  action: 'buy' | 'sell' | 'hold';
  confidence: number;
  price: number;
  quantity: number;
  reasoning: string;
  metadata?: any;
}

export interface Trade {
  id: string;
  entryTimestamp: Date;
  exitTimestamp?: Date;
  symbol: string;
  side: 'long' | 'short';
  entryPrice: number;
  exitPrice?: number;
  quantity: number;
  pnl?: number;
  fees: number;
  slippage: number;
  maxDrawdown: number;
  holdingPeriod?: number;
  exitReason?: 'stop_loss' | 'take_profit' | 'signal' | 'timeout';
}

export interface StrategyPerformance {
  totalReturn: number;
  annualizedReturn: number;
  volatility: number;
  sharpeRatio: number;
  sortinoRatio: number;
  maxDrawdown: number;
  winRate: number;
  profitFactor: number;
  totalTrades: number;
  averageTradeReturn: number;
  averageWinningTrade: number;
  averageLosingTrade: number;
  largestWin: number;
  largestLoss: number;
  consecutiveWins: number;
  consecutiveLosses: number;
  calmarRatio: number;
  beta?: number;
  alpha?: number;
  informationRatio?: number;
}

export interface RiskMetrics {
  var95: number;
  var99: number;
  cvar95: number;
  cvar99: number;
  skewness: number;
  kurtosis: number;
  downside_deviation: number;
  maximum_drawdown_duration: number;
  recovery_factor: number;
  sterling_ratio: number;
  burke_ratio: number;
  tail_ratio: number;
}

export interface BacktestResult {
  strategyId: string;
  testId: string;
  timeframe: string;
  startDate: Date;
  endDate: Date;
  initialCapital: number;
  finalCapital: number;
  performance: StrategyPerformance;
  riskMetrics: RiskMetrics;
  trades: Trade[];
  signals: TradingSignal[];
  portfolioValues: Array<{
    timestamp: Date;
    value: number;
    returns: number;
    drawdown: number;
  }>;
  marketConditions: Array<{
    period: string;
    condition: 'bull' | 'bear' | 'sideways' | 'volatile';
    performance: Partial<StrategyPerformance>;
  }>;
  optimizationResults?: {
    parameters: Record<string, any>;
    fitness: number;
    iterations: number;
  };
  benchmark?: {
    symbol: string;
    performance: StrategyPerformance;
    correlation: number;
  };
  confidence: number;
  timestamp: Date;
}

export interface BacktestReport {
  summary: {
    totalBacktests: number;
    successfulBacktests: number;
    failedBacktests: number;
    averagePerformance: StrategyPerformance;
    bestStrategy: string;
    worstStrategy: string;
    testDuration: number;
  };
  strategyResults: BacktestResult[];
  performanceComparisons: Array<{
    strategyA: string;
    strategyB: string;
    statisticalSignificance: number;
    tTestPValue: number;
    preferredStrategy: string;
  }>;
  riskAnalysis: {
    portfolioRisk: RiskMetrics;
    correlationMatrix: Record<string, Record<string, number>>;
    concentrationRisk: number;
  };
  marketRegimeAnalysis: Array<{
    regime: string;
    duration: number;
    bestPerformingStrategy: string;
    averageReturn: number;
  }>;
  optimizationRecommendations: string[];
  timestamp: Date;
}

export abstract class TradingStrategy {
  abstract name: string;
  abstract parameters: Record<string, any>;
  
  abstract generateSignal(marketData: MarketData[], currentPosition?: Trade): TradingSignal | null;
  abstract shouldExit(trade: Trade, currentData: MarketData): boolean;
  abstract calculatePosition(signal: TradingSignal, capital: number, riskLevel: number): number;
  
  clone(): TradingStrategy {
    return Object.create(Object.getPrototypeOf(this));
  }
}

export class TradingAlgorithmBacktester extends EventEmitter {
  private logger: Logger;
  private config: BacktestConfig;
  private strategies: Map<string, TradingStrategy> = new Map();
  private marketData: Map<string, MarketData[]> = new Map();
  private isRunning: boolean = false;
  
  constructor(config: BacktestConfig) {
    super();
    this.config = config;
    this.logger = createLogger({
      level: 'info',
      format: format.combine(
        format.timestamp(),
        format.printf(({ timestamp, level, message, ...meta }) => {
          return `${timestamp} [TradingBacktester] ${level}: ${message} ${Object.keys(meta).length > 0 ? JSON.stringify(meta) : ''}`;
        })
      ),
      transports: [
        new transports.Console(),
        new transports.File({ filename: 'logs/trading-backtesting.log' })
      ],
    });
  }

  async initialize(): Promise<void> {
    try {
      this.logger.info('Initializing Trading Algorithm Backtester...');
      
      // Load historical market data
      await this.loadMarketData();
      
      // Setup default strategies
      await this.setupDefaultStrategies();
      
      // Validate configuration
      this.validateConfiguration();
      
      this.logger.info('Trading Algorithm Backtester initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize Trading Algorithm Backtester:', error);
      throw error;
    }
  }

  async runComprehensiveBacktests(): Promise<BacktestReport> {
    try {
      this.logger.info('Starting comprehensive trading algorithm backtests...');
      this.isRunning = true;
      const startTime = Date.now();

      const backTestPromises: Promise<BacktestResult>[] = [];

      // Run backtests for each strategy
      for (const [strategyId, strategy] of this.strategies) {
        if (this.config.enablePerformanceAnalysis) {
          backTestPromises.push(this.runSingleBacktest(strategyId, strategy));
        }
        
        if (this.config.enableStrategyOptimization) {
          backTestPromises.push(this.runOptimizationBacktest(strategyId, strategy));
        }
      }

      // Execute backtests with concurrency limit
      const results = await this.executeConcurrentBacktests(backTestPromises);
      
      // Generate comprehensive report
      const report = await this.generateBacktestReport(results, Date.now() - startTime);
      
      this.logger.info('Comprehensive trading algorithm backtests completed', {
        totalBacktests: report.summary.totalBacktests,
        successfulBacktests: report.summary.successfulBacktests,
        bestStrategy: report.summary.bestStrategy,
        duration: report.summary.testDuration
      });

      this.emit('backtests_completed', report);
      return report;

    } catch (error) {
      this.logger.error('Comprehensive backtesting failed:', error);
      throw error;
    } finally {
      this.isRunning = false;
    }
  }

  async runSingleBacktest(strategyId: string, strategy: TradingStrategy): Promise<BacktestResult> {
    const testId = `backtest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.logger.info(`Running backtest for strategy: ${strategyId}`, { testId });

    try {
      const trades: Trade[] = [];
      const signals: TradingSignal[] = [];
      const portfolioValues: Array<{ timestamp: Date; value: number; returns: number; drawdown: number; }> = [];
      
      let currentCapital = this.config.initialCapital;
      let currentPosition: Trade | undefined;
      let highWaterMark = currentCapital;
      
      // Get market data for backtesting period
      const symbols = Array.from(this.marketData.keys());
      const primarySymbol = symbols[0]; // Use first symbol as primary
      const marketHistory = this.marketData.get(primarySymbol) || [];
      
      const relevantData = marketHistory.filter(data => 
        data.timestamp >= this.config.startDate && data.timestamp <= this.config.endDate
      );

      // Simulate trading
      for (let i = 0; i < relevantData.length; i++) {
        const currentData = relevantData[i];
        const historicalWindow = relevantData.slice(Math.max(0, i - 100), i + 1);
        
        // Check for exit signals if in position
        if (currentPosition && strategy.shouldExit(currentPosition, currentData)) {
          const exitedTrade = await this.exitPosition(currentPosition, currentData);
          trades.push(exitedTrade);
          currentCapital += exitedTrade.pnl || 0;
          currentPosition = undefined;
        }
        
        // Generate new signal if not in position
        if (!currentPosition) {
          const signal = strategy.generateSignal(historicalWindow, currentPosition);
          
          if (signal && signal.action !== 'hold') {
            signals.push(signal);
            
            if (signal.action === 'buy' || signal.action === 'sell') {
              currentPosition = await this.enterPosition(signal, currentCapital);
              if (currentPosition) {
                currentCapital -= (currentPosition.entryPrice * currentPosition.quantity + currentPosition.fees);
              }
            }
          }
        }
        
        // Update portfolio value
        let portfolioValue = currentCapital;
        if (currentPosition) {
          const unrealizedPnl = (currentData.close - currentPosition.entryPrice) * currentPosition.quantity;
          portfolioValue += currentPosition.entryPrice * currentPosition.quantity + unrealizedPnl;
        }
        
        highWaterMark = Math.max(highWaterMark, portfolioValue);
        const drawdown = (highWaterMark - portfolioValue) / highWaterMark;
        const returns = portfolioValue / this.config.initialCapital - 1;
        
        portfolioValues.push({
          timestamp: currentData.timestamp,
          value: portfolioValue,
          returns,
          drawdown
        });
      }
      
      // Close any remaining position
      if (currentPosition && relevantData.length > 0) {
        const finalData = relevantData[relevantData.length - 1];
        const finalTrade = await this.exitPosition(currentPosition, finalData);
        trades.push(finalTrade);
        currentCapital += finalTrade.pnl || 0;
      }

      // Calculate performance metrics
      const performance = this.calculatePerformanceMetrics(trades, portfolioValues);
      const riskMetrics = this.calculateRiskMetrics(portfolioValues);
      const marketConditions = await this.analyzeMarketConditions(relevantData, trades);

      return {
        strategyId,
        testId,
        timeframe: this.config.timeframe,
        startDate: this.config.startDate,
        endDate: this.config.endDate,
        initialCapital: this.config.initialCapital,
        finalCapital: currentCapital,
        performance,
        riskMetrics,
        trades,
        signals,
        portfolioValues,
        marketConditions,
        confidence: this.calculateBacktestConfidence(trades, relevantData),
        timestamp: new Date()
      };

    } catch (error) {
      this.logger.error('Single backtest failed:', error, { testId, strategyId });
      throw error;
    }
  }

  async runOptimizationBacktest(strategyId: string, strategy: TradingStrategy): Promise<BacktestResult> {
    this.logger.info(`Running optimization backtest for strategy: ${strategyId}`);
    
    // Implement genetic algorithm or grid search for parameter optimization
    const optimizationResults = await this.optimizeStrategyParameters(strategy);
    
    // Run backtest with optimized parameters
    const optimizedStrategy = strategy.clone();
    optimizedStrategy.parameters = optimizationResults.parameters;
    
    const result = await this.runSingleBacktest(`${strategyId}_optimized`, optimizedStrategy);
    result.optimizationResults = optimizationResults;
    
    return result;
  }

  private async optimizeStrategyParameters(strategy: TradingStrategy): Promise<{
    parameters: Record<string, any>;
    fitness: number;
    iterations: number;
  }> {
    // Simplified optimization - in reality would implement genetic algorithm or Bayesian optimization
    return {
      parameters: { ...strategy.parameters },
      fitness: 0.15, // Mock fitness score
      iterations: 100
    };
  }

  private async loadMarketData(): Promise<void> {
    // Load historical market data
    // In a real implementation, this would load from databases or APIs
    const mockData: MarketData[] = [];
    
    const startTime = this.config.startDate.getTime();
    const endTime = this.config.endDate.getTime();
    const interval = this.getIntervalMs(this.config.timeframe);
    
    for (let time = startTime; time <= endTime; time += interval) {
      const price = 100 + Math.sin(time / 1000000) * 10 + Math.random() * 5;
      mockData.push({
        timestamp: new Date(time),
        symbol: 'BTC/USD',
        open: price,
        high: price * (1 + Math.random() * 0.02),
        low: price * (1 - Math.random() * 0.02),
        close: price + (Math.random() - 0.5) * 2,
        volume: Math.random() * 1000000,
        vwap: price,
        spread: 0.01,
        liquidity: Math.random() * 500000
      });
    }
    
    this.marketData.set('BTC/USD', mockData);
  }

  private async setupDefaultStrategies(): Promise<void> {
    // Setup mock strategies for testing
    class MockMeanReversionStrategy extends TradingStrategy {
      name = 'Mean Reversion';
      parameters = { lookback: 20, threshold: 2.0 };
      
      generateSignal(marketData: MarketData[]): TradingSignal | null {
        if (marketData.length < this.parameters.lookback) return null;
        
        const recent = marketData.slice(-this.parameters.lookback);
        const mean = recent.reduce((sum, d) => sum + d.close, 0) / recent.length;
        const current = marketData[marketData.length - 1];
        const deviation = Math.abs(current.close - mean) / mean;
        
        if (deviation > this.parameters.threshold * 0.01) {
          return {
            timestamp: current.timestamp,
            symbol: current.symbol,
            action: current.close < mean ? 'buy' : 'sell',
            confidence: Math.min(deviation * 10, 1),
            price: current.close,
            quantity: 1,
            reasoning: `Mean reversion signal: price ${current.close < mean ? 'below' : 'above'} mean by ${(deviation * 100).toFixed(2)}%`
          };
        }
        
        return null;
      }
      
      shouldExit(trade: Trade, currentData: MarketData): boolean {
        if (!trade.entryTimestamp) return false;
        const holdingTime = currentData.timestamp.getTime() - trade.entryTimestamp.getTime();
        return holdingTime > 3600000; // Exit after 1 hour
      }
      
      calculatePosition(signal: TradingSignal, capital: number, riskLevel: number): number {
        return Math.floor(capital * 0.1 / signal.price); // Risk 10% of capital
      }
    }

    this.strategies.set('mean_reversion', new MockMeanReversionStrategy());
  }

  private validateConfiguration(): void {
    if (this.config.startDate >= this.config.endDate) {
      throw new Error('Start date must be before end date');
    }
    if (this.config.initialCapital <= 0) {
      throw new Error('Initial capital must be positive');
    }
    if (this.config.maxDrawdown < 0 || this.config.maxDrawdown > 1) {
      throw new Error('Max drawdown must be between 0 and 1');
    }
  }

  private async enterPosition(signal: TradingSignal, availableCapital: number): Promise<Trade | null> {
    const fees = signal.price * signal.quantity * 0.001; // 0.1% fees
    const slippage = signal.price * 0.0005; // 0.05% slippage
    const totalCost = signal.price * signal.quantity + fees;
    
    if (totalCost > availableCapital) {
      return null; // Insufficient capital
    }

    return {
      id: `trade_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      entryTimestamp: signal.timestamp,
      symbol: signal.symbol,
      side: signal.action === 'buy' ? 'long' : 'short',
      entryPrice: signal.price + (signal.action === 'buy' ? slippage : -slippage),
      quantity: signal.quantity,
      fees,
      slippage,
      maxDrawdown: 0
    };
  }

  private async exitPosition(trade: Trade, currentData: MarketData): Promise<Trade> {
    const exitSlippage = currentData.close * 0.0005;
    const exitFees = currentData.close * trade.quantity * 0.001;
    const exitPrice = currentData.close + (trade.side === 'long' ? -exitSlippage : exitSlippage);
    
    const pnl = trade.side === 'long' 
      ? (exitPrice - trade.entryPrice) * trade.quantity - trade.fees - exitFees
      : (trade.entryPrice - exitPrice) * trade.quantity - trade.fees - exitFees;

    return {
      ...trade,
      exitTimestamp: currentData.timestamp,
      exitPrice,
      pnl,
      fees: trade.fees + exitFees,
      holdingPeriod: currentData.timestamp.getTime() - trade.entryTimestamp.getTime(),
      exitReason: 'signal'
    };
  }

  private calculatePerformanceMetrics(trades: Trade[], portfolioValues: Array<{ value: number; returns: number; drawdown: number; }>): StrategyPerformance {
    if (trades.length === 0 || portfolioValues.length === 0) {
      return this.getEmptyPerformanceMetrics();
    }

    const totalReturn = portfolioValues[portfolioValues.length - 1].returns;
    const returns = portfolioValues.map(p => p.returns);
    const drawdowns = portfolioValues.map(p => p.drawdown);
    
    const winningTrades = trades.filter(t => (t.pnl || 0) > 0);
    const losingTrades = trades.filter(t => (t.pnl || 0) < 0);
    
    const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
    const volatility = Math.sqrt(variance);
    
    return {
      totalReturn,
      annualizedReturn: totalReturn * (365 * 24 * 3600 * 1000) / (this.config.endDate.getTime() - this.config.startDate.getTime()),
      volatility,
      sharpeRatio: volatility > 0 ? (avgReturn - this.config.riskFreeRate) / volatility : 0,
      sortinoRatio: this.calculateSortinoRatio(returns, this.config.riskFreeRate),
      maxDrawdown: Math.max(...drawdowns),
      winRate: trades.length > 0 ? winningTrades.length / trades.length : 0,
      profitFactor: this.calculateProfitFactor(winningTrades, losingTrades),
      totalTrades: trades.length,
      averageTradeReturn: trades.length > 0 ? trades.reduce((sum, t) => sum + (t.pnl || 0), 0) / trades.length : 0,
      averageWinningTrade: winningTrades.length > 0 ? winningTrades.reduce((sum, t) => sum + (t.pnl || 0), 0) / winningTrades.length : 0,
      averageLosingTrade: losingTrades.length > 0 ? losingTrades.reduce((sum, t) => sum + (t.pnl || 0), 0) / losingTrades.length : 0,
      largestWin: winningTrades.length > 0 ? Math.max(...winningTrades.map(t => t.pnl || 0)) : 0,
      largestLoss: losingTrades.length > 0 ? Math.min(...losingTrades.map(t => t.pnl || 0)) : 0,
      consecutiveWins: this.calculateConsecutiveWins(trades),
      consecutiveLosses: this.calculateConsecutiveLosses(trades),
      calmarRatio: Math.max(...drawdowns) > 0 ? totalReturn / Math.max(...drawdowns) : 0
    };
  }

  private calculateRiskMetrics(portfolioValues: Array<{ returns: number; drawdown: number; }>): RiskMetrics {
    const returns = portfolioValues.map(p => p.returns).sort((a, b) => a - b);
    const drawdowns = portfolioValues.map(p => p.drawdown);
    
    return {
      var95: this.calculateVaR(returns, 0.05),
      var99: this.calculateVaR(returns, 0.01),
      cvar95: this.calculateCVaR(returns, 0.05),
      cvar99: this.calculateCVaR(returns, 0.01),
      skewness: this.calculateSkewness(returns),
      kurtosis: this.calculateKurtosis(returns),
      downside_deviation: this.calculateDownsideDeviation(returns, 0),
      maximum_drawdown_duration: this.calculateMaxDrawdownDuration(drawdowns),
      recovery_factor: this.calculateRecoveryFactor(returns, drawdowns),
      sterling_ratio: this.calculateSterlingRatio(returns, drawdowns),
      burke_ratio: this.calculateBurkeRatio(returns, drawdowns),
      tail_ratio: this.calculateTailRatio(returns)
    };
  }

  private async analyzeMarketConditions(marketData: MarketData[], trades: Trade[]): Promise<Array<{
    period: string;
    condition: 'bull' | 'bear' | 'sideways' | 'volatile';
    performance: Partial<StrategyPerformance>;
  }>> {
    // Simplified market condition analysis
    return [
      {
        period: 'full_period',
        condition: 'sideways',
        performance: {
          totalReturn: trades.reduce((sum, t) => sum + (t.pnl || 0), 0) / this.config.initialCapital,
          winRate: trades.filter(t => (t.pnl || 0) > 0).length / Math.max(trades.length, 1)
        }
      }
    ];
  }

  private calculateBacktestConfidence(trades: Trade[], marketData: MarketData[]): number {
    // Calculate confidence based on trade count and data quality
    const tradeCount = trades.length;
    const dataPoints = marketData.length;
    
    let confidence = 0.5; // Base confidence
    
    if (tradeCount > 30) confidence += 0.2;
    if (tradeCount > 100) confidence += 0.1;
    if (dataPoints > 1000) confidence += 0.1;
    if (dataPoints > 10000) confidence += 0.1;
    
    return Math.min(confidence, 1.0);
  }

  private async executeConcurrentBacktests(testPromises: Promise<BacktestResult>[]): Promise<BacktestResult[]> {
    const results: BacktestResult[] = [];
    const chunks = [];
    
    for (let i = 0; i < testPromises.length; i += this.config.maxConcurrentBacktests) {
      chunks.push(testPromises.slice(i, i + this.config.maxConcurrentBacktests));
    }

    for (const chunk of chunks) {
      const chunkResults = await Promise.allSettled(chunk);
      for (const result of chunkResults) {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          this.logger.error('Backtest failed:', result.reason);
        }
      }
    }

    return results;
  }

  private async generateBacktestReport(results: BacktestResult[], duration: number): Promise<BacktestReport> {
    const successful = results.filter(r => r.trades.length > 0);
    const failed = results.length - successful.length;
    
    const bestStrategy = successful.reduce((best, current) => 
      current.performance.totalReturn > best.performance.totalReturn ? current : best,
      successful[0]
    );
    
    const worstStrategy = successful.reduce((worst, current) => 
      current.performance.totalReturn < worst.performance.totalReturn ? current : worst,
      successful[0]
    );

    return {
      summary: {
        totalBacktests: results.length,
        successfulBacktests: successful.length,
        failedBacktests: failed,
        averagePerformance: this.calculateAveragePerformance(successful),
        bestStrategy: bestStrategy?.strategyId || 'none',
        worstStrategy: worstStrategy?.strategyId || 'none',
        testDuration: duration
      },
      strategyResults: results,
      performanceComparisons: this.generatePerformanceComparisons(successful),
      riskAnalysis: this.generateRiskAnalysis(successful),
      marketRegimeAnalysis: this.generateMarketRegimeAnalysis(successful),
      optimizationRecommendations: this.generateOptimizationRecommendations(successful),
      timestamp: new Date()
    };
  }

  // Helper calculation methods
  private getEmptyPerformanceMetrics(): StrategyPerformance {
    return {
      totalReturn: 0, annualizedReturn: 0, volatility: 0, sharpeRatio: 0, sortinoRatio: 0,
      maxDrawdown: 0, winRate: 0, profitFactor: 0, totalTrades: 0, averageTradeReturn: 0,
      averageWinningTrade: 0, averageLosingTrade: 0, largestWin: 0, largestLoss: 0,
      consecutiveWins: 0, consecutiveLosses: 0, calmarRatio: 0
    };
  }

  private getIntervalMs(timeframe: string): number {
    const intervals = { '1m': 60000, '5m': 300000, '15m': 900000, '1h': 3600000, '4h': 14400000, '1d': 86400000 };
    return intervals[timeframe] || 3600000;
  }

  private calculateSortinoRatio(returns: number[], riskFreeRate: number): number {
    const excessReturns = returns.map(r => r - riskFreeRate);
    const downside = excessReturns.filter(r => r < 0);
    if (downside.length === 0) return 0;
    const downsideDeviation = Math.sqrt(downside.reduce((sum, r) => sum + r * r, 0) / downside.length);
    return downsideDeviation > 0 ? excessReturns.reduce((sum, r) => sum + r, 0) / excessReturns.length / downsideDeviation : 0;
  }

  private calculateProfitFactor(wins: Trade[], losses: Trade[]): number {
    const totalWins = wins.reduce((sum, t) => sum + (t.pnl || 0), 0);
    const totalLosses = Math.abs(losses.reduce((sum, t) => sum + (t.pnl || 0), 0));
    return totalLosses > 0 ? totalWins / totalLosses : 0;
  }

  private calculateConsecutiveWins(trades: Trade[]): number {
    let maxConsecutive = 0, current = 0;
    for (const trade of trades) {
      if ((trade.pnl || 0) > 0) { current++; maxConsecutive = Math.max(maxConsecutive, current); }
      else current = 0;
    }
    return maxConsecutive;
  }

  private calculateConsecutiveLosses(trades: Trade[]): number {
    let maxConsecutive = 0, current = 0;
    for (const trade of trades) {
      if ((trade.pnl || 0) < 0) { current++; maxConsecutive = Math.max(maxConsecutive, current); }
      else current = 0;
    }
    return maxConsecutive;
  }

  private calculateVaR(returns: number[], alpha: number): number {
    const index = Math.floor(returns.length * alpha);
    return returns[index] || 0;
  }

  private calculateCVaR(returns: number[], alpha: number): number {
    const index = Math.floor(returns.length * alpha);
    const tail = returns.slice(0, index);
    return tail.length > 0 ? tail.reduce((sum, r) => sum + r, 0) / tail.length : 0;
  }

  private calculateSkewness(returns: number[]): number {
    const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
    const skew = returns.reduce((sum, r) => sum + Math.pow(r - mean, 3), 0) / returns.length;
    return variance > 0 ? skew / Math.pow(variance, 1.5) : 0;
  }

  private calculateKurtosis(returns: number[]): number {
    const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
    const kurt = returns.reduce((sum, r) => sum + Math.pow(r - mean, 4), 0) / returns.length;
    return variance > 0 ? kurt / Math.pow(variance, 2) - 3 : 0;
  }

  private calculateDownsideDeviation(returns: number[], target: number): number {
    const downside = returns.filter(r => r < target).map(r => r - target);
    return downside.length > 0 ? Math.sqrt(downside.reduce((sum, r) => sum + r * r, 0) / downside.length) : 0;
  }

  private calculateMaxDrawdownDuration(drawdowns: number[]): number {
    let maxDuration = 0, currentDuration = 0;
    for (const dd of drawdowns) {
      if (dd > 0) currentDuration++;
      else { maxDuration = Math.max(maxDuration, currentDuration); currentDuration = 0; }
    }
    return Math.max(maxDuration, currentDuration);
  }

  private calculateRecoveryFactor(returns: number[], drawdowns: number[]): number {
    const totalReturn = returns[returns.length - 1] || 0;
    const maxDD = Math.max(...drawdowns);
    return maxDD > 0 ? totalReturn / maxDD : 0;
  }

  private calculateSterlingRatio(returns: number[], drawdowns: number[]): number {
    const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const avgDD = drawdowns.reduce((sum, dd) => sum + dd, 0) / drawdowns.length;
    return avgDD > 0 ? avgReturn / avgDD : 0;
  }

  private calculateBurkeRatio(returns: number[], drawdowns: number[]): number {
    const totalReturn = returns[returns.length - 1] || 0;
    const ddSquaredSum = drawdowns.reduce((sum, dd) => sum + dd * dd, 0);
    const ddRms = Math.sqrt(ddSquaredSum / drawdowns.length);
    return ddRms > 0 ? totalReturn / ddRms : 0;
  }

  private calculateTailRatio(returns: number[]): number {
    const sorted = [...returns].sort((a, b) => b - a);
    const top10Pct = sorted.slice(0, Math.floor(sorted.length * 0.1));
    const bottom10Pct = sorted.slice(-Math.floor(sorted.length * 0.1));
    const topAvg = top10Pct.reduce((sum, r) => sum + r, 0) / top10Pct.length;
    const bottomAvg = Math.abs(bottom10Pct.reduce((sum, r) => sum + r, 0) / bottom10Pct.length);
    return bottomAvg > 0 ? topAvg / bottomAvg : 0;
  }

  private calculateAveragePerformance(results: BacktestResult[]): StrategyPerformance {
    if (results.length === 0) return this.getEmptyPerformanceMetrics();
    
    const sum = results.reduce((acc, result) => {
      const perf = result.performance;
      return {
        totalReturn: acc.totalReturn + perf.totalReturn,
        annualizedReturn: acc.annualizedReturn + perf.annualizedReturn,
        volatility: acc.volatility + perf.volatility,
        sharpeRatio: acc.sharpeRatio + perf.sharpeRatio,
        sortinoRatio: acc.sortinoRatio + perf.sortinoRatio,
        maxDrawdown: acc.maxDrawdown + perf.maxDrawdown,
        winRate: acc.winRate + perf.winRate,
        profitFactor: acc.profitFactor + perf.profitFactor,
        totalTrades: acc.totalTrades + perf.totalTrades,
        averageTradeReturn: acc.averageTradeReturn + perf.averageTradeReturn,
        averageWinningTrade: acc.averageWinningTrade + perf.averageWinningTrade,
        averageLosingTrade: acc.averageLosingTrade + perf.averageLosingTrade,
        largestWin: acc.largestWin + perf.largestWin,
        largestLoss: acc.largestLoss + perf.largestLoss,
        consecutiveWins: acc.consecutiveWins + perf.consecutiveWins,
        consecutiveLosses: acc.consecutiveLosses + perf.consecutiveLosses,
        calmarRatio: acc.calmarRatio + perf.calmarRatio
      };
    }, this.getEmptyPerformanceMetrics());

    const count = results.length;
    return {
      totalReturn: sum.totalReturn / count,
      annualizedReturn: sum.annualizedReturn / count,
      volatility: sum.volatility / count,
      sharpeRatio: sum.sharpeRatio / count,
      sortinoRatio: sum.sortinoRatio / count,
      maxDrawdown: sum.maxDrawdown / count,
      winRate: sum.winRate / count,
      profitFactor: sum.profitFactor / count,
      totalTrades: sum.totalTrades / count,
      averageTradeReturn: sum.averageTradeReturn / count,
      averageWinningTrade: sum.averageWinningTrade / count,
      averageLosingTrade: sum.averageLosingTrade / count,
      largestWin: sum.largestWin / count,
      largestLoss: sum.largestLoss / count,
      consecutiveWins: sum.consecutiveWins / count,
      consecutiveLosses: sum.consecutiveLosses / count,
      calmarRatio: sum.calmarRatio / count
    };
  }

  private generatePerformanceComparisons(results: BacktestResult[]): Array<{
    strategyA: string; strategyB: string; statisticalSignificance: number;
    tTestPValue: number; preferredStrategy: string;
  }> {
    const comparisons = [];
    for (let i = 0; i < results.length; i++) {
      for (let j = i + 1; j < results.length; j++) {
        const a = results[i], b = results[j];
        comparisons.push({
          strategyA: a.strategyId,
          strategyB: b.strategyId,
          statisticalSignificance: 0.95, // Mock value
          tTestPValue: 0.05, // Mock value
          preferredStrategy: a.performance.totalReturn > b.performance.totalReturn ? a.strategyId : b.strategyId
        });
      }
    }
    return comparisons;
  }

  private generateRiskAnalysis(results: BacktestResult[]): {
    portfolioRisk: RiskMetrics;
    correlationMatrix: Record<string, Record<string, number>>;
    concentrationRisk: number;
  } {
    return {
      portfolioRisk: results[0]?.riskMetrics || {} as RiskMetrics,
      correlationMatrix: {},
      concentrationRisk: 0.3 // Mock value
    };
  }

  private generateMarketRegimeAnalysis(results: BacktestResult[]): Array<{
    regime: string; duration: number; bestPerformingStrategy: string; averageReturn: number;
  }> {
    return [
      {
        regime: 'bull_market',
        duration: 0.3,
        bestPerformingStrategy: results[0]?.strategyId || 'none',
        averageReturn: 0.15
      }
    ];
  }

  private generateOptimizationRecommendations(results: BacktestResult[]): string[] {
    const recommendations = [];
    
    if (results.some(r => r.performance.maxDrawdown > 0.2)) {
      recommendations.push('Consider implementing stricter risk management to reduce maximum drawdown');
    }
    
    if (results.some(r => r.performance.sharpeRatio < 1.0)) {
      recommendations.push('Focus on improving risk-adjusted returns (Sharpe ratio below 1.0)');
    }
    
    if (results.some(r => r.performance.winRate < 0.4)) {
      recommendations.push('Review entry signals to improve win rate');
    }
    
    return recommendations.length > 0 ? recommendations : ['All strategies show good performance metrics'];
  }

  // Public API methods
  addStrategy(id: string, strategy: TradingStrategy): void {
    this.strategies.set(id, strategy);
    this.logger.info(`Added trading strategy: ${id}`);
  }

  removeStrategy(id: string): boolean {
    const removed = this.strategies.delete(id);
    if (removed) this.logger.info(`Removed trading strategy: ${id}`);
    return removed;
  }

  getStrategies(): Map<string, TradingStrategy> {
    return new Map(this.strategies);
  }

  isRunning(): boolean {
    return this.isRunning;
  }

  async shutdown(): Promise<void> {
    this.logger.info('Shutting down Trading Algorithm Backtester...');
    this.isRunning = false;
    this.removeAllListeners();
  }
}