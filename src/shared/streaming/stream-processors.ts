import { KafkaManager } from './kafka-manager';

/**
 * DeFi Stream Processors
 * 
 * Real-time stream processing components for YieldSensei that handle:
 * - Data transformation and enrichment
 * - Aggregation and windowing
 * - Risk calculation and alerting
 * - Cross-chain arbitrage detection
 */

interface StreamProcessor {
  start(): Promise<void>;
  stop(): Promise<void>;
  isRunning(): boolean;
}

// Logger interface
interface Logger {
  info(message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  error(message: string, ...args: any[]): void;
  debug(message: string, ...args: any[]): void;
}

class SimpleLogger implements Logger {
  constructor(private context: string) {}

  info(message: string, ...args: any[]): void {
    console.log(`[${this.context}] INFO:`, message, ...args);
  }

  warn(message: string, ...args: any[]): void {
    console.warn(`[${this.context}] WARN:`, message, ...args);
  }

  error(message: string, ...args: any[]): void {
    console.error(`[${this.context}] ERROR:`, message, ...args);
  }

  debug(message: string, ...args: any[]): void {
    console.debug(`[${this.context}] DEBUG:`, message, ...args);
  }
}

/**
 * Price Aggregation Processor
 * Aggregates price updates from multiple sources and calculates TWAP
 */
export class PriceAggregationProcessor implements StreamProcessor {
  private kafkaManager: KafkaManager;
  private logger: Logger;
  private running = false;
  private priceCache: Map<string, { price: number; timestamp: number; source: string }[]> = new Map();
  private readonly WINDOW_SIZE_MS = 60000; // 1 minute window
  private readonly MAX_CACHE_SIZE = 100; // per token

  constructor(kafkaManager: KafkaManager) {
    this.kafkaManager = kafkaManager;
    this.logger = new SimpleLogger('PriceAggregationProcessor');
  }

  async start(): Promise<void> {
    if (this.running) return;

    this.logger.info('Starting price aggregation processor...');

    await this.kafkaManager.subscribe({
      topics: ['market.prices'],
      groupId: 'price-aggregation-processor',
      handler: this.processPriceUpdate.bind(this),
      fromBeginning: false
    });

    this.running = true;
    this.logger.info('Price aggregation processor started');

    // Start periodic TWAP calculation
    this.startPeriodicCalculation();
  }

  async stop(): Promise<void> {
    if (!this.running) return;

    this.running = false;
    await this.kafkaManager.unsubscribe('price-aggregation-processor');
    this.logger.info('Price aggregation processor stopped');
  }

  isRunning(): boolean {
    return this.running;
  }

  private async processPriceUpdate(message: any): Promise<void> {
    try {
      const data = JSON.parse(message.value);
      const { tokenAddress, symbol, price, source } = data;

      if (!tokenAddress || !price || !source) {
        this.logger.warn('Invalid price update message:', data);
        return;
      }

             // Update price cache
       if (!this.priceCache.has(tokenAddress)) {
         this.priceCache.set(tokenAddress, []);
       }

       const prices = this.priceCache.get(tokenAddress);
       if (prices) {
         prices.push({
           price: parseFloat(price),
           timestamp: Date.now(),
           source
         });

         // Limit cache size
         if (prices.length > this.MAX_CACHE_SIZE) {
           prices.shift();
         }
       }

      this.logger.debug(`Updated price cache for ${symbol}: ${price} from ${source}`);
    } catch (error) {
      this.logger.error('Error processing price update:', error);
    }
  }

  private startPeriodicCalculation(): void {
    const interval = setInterval(async () => {
      if (!this.running) {
        clearInterval(interval);
        return;
      }

      await this.calculateAndPublishTWAP();
    }, this.WINDOW_SIZE_MS);
  }

  private async calculateAndPublishTWAP(): Promise<void> {
    const now = Date.now();
    const windowStart = now - this.WINDOW_SIZE_MS;

    for (const [tokenAddress, prices] of this.priceCache) {
      const recentPrices = prices.filter(p => p.timestamp >= windowStart);
      
      if (recentPrices.length === 0) continue;

      // Calculate TWAP (Time-Weighted Average Price)
      const twap = this.calculateTWAP(recentPrices);
      
      // Calculate price volatility
      const volatility = this.calculateVolatility(recentPrices);

      // Publish aggregated data
      await this.kafkaManager.produce({
        topic: 'market.analytics',
        key: tokenAddress,
        value: JSON.stringify({
          tokenAddress,
          twap,
          volatility,
          sampleCount: recentPrices.length,
          windowSizeMs: this.WINDOW_SIZE_MS,
          timestamp: now,
          type: 'price_analytics'
        })
      });
    }
  }

  private calculateTWAP(prices: { price: number; timestamp: number }[]): number {
    if (prices.length === 0) return 0;
    if (prices.length === 1) return prices[0]!.price;

    let weightedSum = 0;
    let totalWeight = 0;

    for (let i = 1; i < prices.length; i++) {
      const weight = prices[i]!.timestamp - prices[i - 1]!.timestamp;
      weightedSum += prices[i - 1]!.price * weight;
      totalWeight += weight;
    }

    return totalWeight > 0 ? weightedSum / totalWeight : prices[prices.length - 1]!.price;
  }

  private calculateVolatility(prices: { price: number }[]): number {
    if (prices.length < 2) return 0;

    const values = prices.map(p => p.price);
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    
    return Math.sqrt(variance) / mean; // Coefficient of variation
  }
}

/**
 * Risk Assessment Processor
 * Calculates real-time risk metrics for portfolios and positions
 */
export class RiskAssessmentProcessor implements StreamProcessor {
  private kafkaManager: KafkaManager;
  private logger: Logger;
  private running = false;
  private _positionCache: Map<string, any> = new Map();

  constructor(kafkaManager: KafkaManager) {
    this.kafkaManager = kafkaManager;
    this.logger = new SimpleLogger('RiskAssessmentProcessor');
  }

  async start(): Promise<void> {
    if (this.running) return;

    this.logger.info('Starting risk assessment processor...');

    await this.kafkaManager.subscribe({
      topics: ['defi.transactions', 'users.portfolios', 'market.analytics'],
      groupId: 'risk-assessment-processor',
      handler: this.processRiskEvent.bind(this),
      fromBeginning: false
    });

    this.running = true;
    this.logger.info('Risk assessment processor started');
  }

  async stop(): Promise<void> {
    if (!this.running) return;

    this.running = false;
    await this.kafkaManager.unsubscribe('risk-assessment-processor');
    this.logger.info('Risk assessment processor stopped');
  }

  isRunning(): boolean {
    return this.running;
  }

  private async processRiskEvent(message: any): Promise<void> {
    try {
      const data = JSON.parse(message.value);
      
      switch (message.topic) {
        case 'defi.transactions':
          await this.processTransaction(data);
          break;
        case 'users.portfolios':
          await this.processPortfolioUpdate(data);
          break;
        case 'market.analytics':
          await this.processMarketUpdate(data);
          break;
      }
    } catch (error) {
      this.logger.error('Error processing risk event:', error);
    }
  }

  private async processTransaction(transaction: any): Promise<void> {
    const { userId, protocolId, amount, type } = transaction;
    
    // Calculate position-level risk
    const positionRisk = await this.calculatePositionRisk(userId, protocolId, amount, type);
    
    if (positionRisk.severity === 'high' || positionRisk.severity === 'critical') {
      await this.kafkaManager.produceRiskAlert({
        userId,
        alertType: 'position_risk',
        severity: positionRisk.severity,
        message: `High risk detected for ${protocolId}: ${positionRisk.reason}`,
        metadata: {
          protocolId,
          riskScore: positionRisk.score,
          transaction: transaction.id
        }
      });
    }

    // Publish risk assessment
    await this.kafkaManager.produce({
      topic: 'risk.assessments',
      key: `${userId}-${protocolId}`,
      value: JSON.stringify({
        userId,
        protocolId,
        riskScore: positionRisk.score,
        riskLevel: positionRisk.severity,
        factors: positionRisk.factors,
        timestamp: Date.now(),
        type: 'position_risk'
      })
    });
  }

  private async processPortfolioUpdate(portfolio: any): Promise<void> {
    const { userId, positions } = portfolio;
    
    // Calculate portfolio-level risk
    const portfolioRisk = await this.calculatePortfolioRisk(positions);
    
    if (portfolioRisk.severity === 'high' || portfolioRisk.severity === 'critical') {
      await this.kafkaManager.produceRiskAlert({
        userId,
        alertType: 'portfolio_risk',
        severity: portfolioRisk.severity,
        message: `Portfolio risk threshold exceeded: ${portfolioRisk.reason}`,
        metadata: {
          riskScore: portfolioRisk.score,
          diversificationScore: portfolioRisk.diversification
        }
      });
    }

    // Publish portfolio risk assessment
    await this.kafkaManager.produce({
      topic: 'risk.assessments',
      key: `portfolio-${userId}`,
      value: JSON.stringify({
        userId,
        portfolioRiskScore: portfolioRisk.score,
        diversificationScore: portfolioRisk.diversification,
        liquidityScore: portfolioRisk.liquidity,
        timestamp: Date.now(),
        type: 'portfolio_risk'
      })
    });
  }

  private async processMarketUpdate(marketData: any): Promise<void> {
    const { tokenAddress, volatility } = marketData;
    
    // Check for extreme volatility
    if (volatility > 0.2) { // 20% volatility threshold
      // Find affected users
      const affectedUsers = await this.findUsersWithToken(tokenAddress);
      
      for (const userId of affectedUsers) {
        await this.kafkaManager.produceRiskAlert({
          userId,
          alertType: 'market_volatility',
          severity: volatility > 0.5 ? 'critical' : 'high',
          message: `High volatility detected for token ${tokenAddress}: ${(volatility * 100).toFixed(2)}%`,
          metadata: {
            tokenAddress,
            volatility,
            marketData
          }
        });
      }
    }
  }

  private async calculatePositionRisk(userId: string, _protocolId: string, amount: number, type: string): Promise<{
    score: number;
    severity: 'low' | 'medium' | 'high' | 'critical';
    reason: string;
    factors: string[];
  }> {
    // Simplified risk calculation
    let riskScore = 0;
    const factors: string[] = [];

    // Protocol risk (would be fetched from database)
    const protocolRisk = 0.3; // Mock value
    riskScore += protocolRisk * 0.4;
    factors.push(`Protocol risk: ${(protocolRisk * 100).toFixed(1)}%`);

    // Position size risk
    const positionSizeRisk = Math.min(amount / 1000000, 1); // Normalize to $1M
    riskScore += positionSizeRisk * 0.3;
    factors.push(`Position size risk: ${(positionSizeRisk * 100).toFixed(1)}%`);

    // Transaction type risk
    const typeRisk = type === 'leverage' ? 0.8 : type === 'liquidity' ? 0.4 : 0.2;
    riskScore += typeRisk * 0.3;
    factors.push(`Transaction type risk: ${(typeRisk * 100).toFixed(1)}%`);

    const severity = riskScore > 0.8 ? 'critical' : riskScore > 0.6 ? 'high' : riskScore > 0.4 ? 'medium' : 'low';
    
    return {
      score: riskScore,
      severity,
      reason: `Combined risk factors indicate ${severity} risk level`,
      factors
    };
  }

  private async calculatePortfolioRisk(positions: any[]): Promise<{
    score: number;
    severity: 'low' | 'medium' | 'high' | 'critical';
    reason: string;
    diversification: number;
    liquidity: number;
  }> {
    // Simplified portfolio risk calculation
    const totalValue = positions.reduce((sum, pos) => sum + pos.value, 0);
    
    // Calculate diversification (Herfindahl index)
    const diversification = 1 - positions.reduce((sum, pos) => {
      const weight = pos.value / totalValue;
      return sum + weight * weight;
    }, 0);

    // Calculate liquidity score (mock)
    const liquidity = positions.reduce((sum, pos) => sum + pos.liquidity || 0.5, 0) / positions.length;

    // Overall risk score
    const riskScore = Math.max(0, 1 - diversification) * 0.4 + (1 - liquidity) * 0.6;
    const severity = riskScore > 0.8 ? 'critical' : riskScore > 0.6 ? 'high' : riskScore > 0.4 ? 'medium' : 'low';

    return {
      score: riskScore,
      severity,
      reason: `Portfolio concentration and liquidity analysis`,
      diversification,
      liquidity
    };
  }

  private async findUsersWithToken(_tokenAddress: string): Promise<string[]> {
    // Mock implementation - would query database
    return ['user-1', 'user-2']; // Mock users
  }
}

/**
 * Cross-Chain Arbitrage Processor
 * Detects arbitrage opportunities across different chains
 */
export class CrossChainArbitrageProcessor implements StreamProcessor {
  private kafkaManager: KafkaManager;
  private logger: Logger;
  private running = false;
  private pricesByChain: Map<string, Map<string, { price: number; timestamp: number }>> = new Map();

  constructor(kafkaManager: KafkaManager) {
    this.kafkaManager = kafkaManager;
    this.logger = new SimpleLogger('CrossChainArbitrageProcessor');
  }

  async start(): Promise<void> {
    if (this.running) return;

    this.logger.info('Starting cross-chain arbitrage processor...');

    await this.kafkaManager.subscribe({
      topics: ['market.prices', 'crosschain.events'],
      groupId: 'crosschain-arbitrage-processor',
      handler: this.processArbitrageEvent.bind(this),
      fromBeginning: false
    });

    this.running = true;
    this.logger.info('Cross-chain arbitrage processor started');
  }

  async stop(): Promise<void> {
    if (!this.running) return;

    this.running = false;
    await this.kafkaManager.unsubscribe('crosschain-arbitrage-processor');
    this.logger.info('Cross-chain arbitrage processor stopped');
  }

  isRunning(): boolean {
    return this.running;
  }

  private async processArbitrageEvent(message: any): Promise<void> {
    try {
      const data = JSON.parse(message.value);
      
      if (message.topic === 'market.prices') {
        await this.processPriceUpdate(data);
      } else if (message.topic === 'crosschain.events') {
        await this.processCrossChainEvent(data);
      }
    } catch (error) {
      this.logger.error('Error processing arbitrage event:', error);
    }
  }

  private async processPriceUpdate(priceData: any): Promise<void> {
    const { tokenAddress, price, chainId = 'ethereum' } = priceData;
    
    if (!this.pricesByChain.has(chainId)) {
      this.pricesByChain.set(chainId, new Map());
    }
         
     const chainPrices = this.pricesByChain.get(chainId);
     if (chainPrices) {
       chainPrices.set(tokenAddress, {
         price: parseFloat(price),
         timestamp: Date.now()
       });

       // Check for arbitrage opportunities
       await this.checkArbitrageOpportunities(tokenAddress || '');
     }
  }

     private async processCrossChainEvent(eventData: any): Promise<void> {
     const { type, chainId: _chainId, tokenAddress } = eventData;
     
     if (type === 'bridge_update' || type === 'liquidity_update') {
       // Trigger arbitrage check for affected token
       await this.checkArbitrageOpportunities(tokenAddress || '');
     }
   }

  private async checkArbitrageOpportunities(tokenAddress: string): Promise<void> {
    const opportunities: any[] = [];
    const chains = Array.from(this.pricesByChain.keys());
    
    // Compare prices across all chain pairs
    for (let i = 0; i < chains.length; i++) {
      for (let j = i + 1; j < chains.length; j++) {
        const chain1 = chains[i]!;
        const chain2 = chains[j]!;
        
        const price1 = this.pricesByChain.get(chain1)?.get(tokenAddress);
        const price2 = this.pricesByChain.get(chain2)?.get(tokenAddress);
        
        if (!price1 || !price2) continue;
        
        // Check if prices are recent (within 5 minutes)
        const now = Date.now();
        if (now - price1.timestamp > 300000 || now - price2.timestamp > 300000) continue;
        
        // Calculate price difference
        const priceDiff = Math.abs(price1.price - price2.price);
        const avgPrice = (price1.price + price2.price) / 2;
        const spreadPercent = (priceDiff / avgPrice) * 100;
        
        // Arbitrage threshold (2% minimum spread)
        if (spreadPercent >= 2) {
          const buyChain = price1.price < price2.price ? chain1 : chain2;
          const sellChain = price1.price < price2.price ? chain2 : chain1;
          const buyPrice = Math.min(price1.price, price2.price);
          const sellPrice = Math.max(price1.price, price2.price);
          
          opportunities.push({
            tokenAddress,
            buyChain,
            sellChain,
            buyPrice,
            sellPrice,
            spreadPercent,
            profit: sellPrice - buyPrice,
            timestamp: now
          });
        }
      }
    }

    // Publish arbitrage opportunities
    for (const opportunity of opportunities) {
      await this.kafkaManager.produce({
        topic: 'crosschain.arbitrage',
        key: `${opportunity.tokenAddress}-${opportunity.buyChain}-${opportunity.sellChain}`,
        value: JSON.stringify({
          ...opportunity,
          type: 'arbitrage_opportunity'
        })
      });

      this.logger.info(`Arbitrage opportunity detected: ${opportunity.spreadPercent.toFixed(2)}% spread for ${opportunity.tokenAddress} between ${opportunity.buyChain} and ${opportunity.sellChain}`);
    }
  }
}

/**
 * Stream Processor Manager
 * Manages all stream processing components
 */
export class StreamProcessorManager {
  private kafkaManager: KafkaManager;
  private logger: Logger;
  private processors: StreamProcessor[] = [];

  constructor(kafkaManager: KafkaManager) {
    this.kafkaManager = kafkaManager;
    this.logger = new SimpleLogger('StreamProcessorManager');
  }

  /**
   * Initialize and start all stream processors
   */
  async start(): Promise<void> {
    this.logger.info('Starting stream processors...');

    // Initialize processors
    this.processors = [
      new PriceAggregationProcessor(this.kafkaManager),
      new RiskAssessmentProcessor(this.kafkaManager),
      new CrossChainArbitrageProcessor(this.kafkaManager)
    ];

    // Start all processors
    await Promise.all(this.processors.map(processor => processor.start()));
    
    this.logger.info(`Started ${this.processors.length} stream processors`);
  }

  /**
   * Stop all stream processors
   */
  async stop(): Promise<void> {
    this.logger.info('Stopping stream processors...');
    
    await Promise.all(this.processors.map(processor => processor.stop()));
    this.processors = [];
    
    this.logger.info('All stream processors stopped');
  }

  /**
   * Get status of all processors
   */
  getStatus(): { [key: string]: boolean } {
    return {
      priceAggregation: this.processors[0]?.isRunning() || false,
      riskAssessment: this.processors[1]?.isRunning() || false,
      crossChainArbitrage: this.processors[2]?.isRunning() || false
    };
  }
}

export default StreamProcessorManager; 