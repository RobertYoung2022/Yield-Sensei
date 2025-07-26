/**
 * Historical Analysis Module
 * Analyzes historical arbitrage patterns and provides performance insights
 */

import Logger from '../../../shared/logging/logger';
import { ClickHouseManager } from '../../../shared/database/clickhouse-manager';
import { 
  ArbitrageOpportunity,
  ArbitrageExecution,
  ChainID,
  AssetID
} from '../types';

const logger = Logger.getLogger('historical-analyzer');

export interface OpportunityPattern {
  assetId: AssetID;
  sourceChain: ChainID;
  targetChain: ChainID;
  frequency: number; // opportunities per hour
  avgProfitMargin: number;
  avgExecutionTime: number;
  successRate: number;
  bestTimeOfDay: number; // hour of day (0-23)
  seasonality: SeasonalityData;
}

export interface SeasonalityData {
  hourlyDistribution: number[]; // 24 hours
  dailyDistribution: number[]; // 7 days (0=Sunday)
  monthlyDistribution: number[]; // 12 months
}

export interface PerformanceMetrics {
  totalOpportunities: number;
  executedCount: number;
  totalProfit: number;
  totalLoss: number;
  avgProfitMargin: number;
  successRate: number;
  avgExecutionTime: number;
  bestPerformingAssets: AssetPerformance[];
  bestPerformingChains: ChainPerformance[];
  commonFailureReasons: Record<string, number>;
}

export interface AssetPerformance {
  assetId: AssetID;
  opportunityCount: number;
  executionCount: number;
  totalProfit: number;
  avgProfitMargin: number;
  successRate: number;
}

export interface ChainPerformance {
  chainId: ChainID;
  asSourceCount: number;
  asTargetCount: number;
  totalProfit: number;
  avgGasCost: number;
  avgExecutionTime: number;
  successRate: number;
}

export interface PredictionModel {
  assetId: AssetID;
  sourceChain: ChainID;
  targetChain: ChainID;
  predictedProbability: number; // 0-1
  expectedProfitMargin: number;
  confidence: number; // 0-1
  factors: PredictionFactor[];
}

export interface PredictionFactor {
  name: string;
  weight: number;
  currentValue: number;
  impact: 'positive' | 'negative' | 'neutral';
}

export class HistoricalAnalyzer {
  private clickhouse: ClickHouseManager;
  private patterns: Map<string, OpportunityPattern> = new Map();
  private performanceCache: PerformanceMetrics | null = null;
  private lastAnalysisUpdate: number = 0;

  constructor() {
    this.clickhouse = ClickHouseManager.getInstance({
      host: process.env['CLICKHOUSE_HOST'] || 'localhost',
      port: parseInt(process.env['CLICKHOUSE_PORT'] || '8123'),
      username: process.env['CLICKHOUSE_USER'] || 'default',
      password: process.env['CLICKHOUSE_PASSWORD'] || '',
      database: 'arbitrage_analytics',
    });
  }

  async initialize(): Promise<void> {
    try {
      await this.clickhouse.initialize();
      await this.createTables();
      await this.loadHistoricalPatterns();
      
      logger.info('Historical Analyzer initialized');
    } catch (error) {
      logger.error('Failed to initialize Historical Analyzer:', error);
      throw error;
    }
  }

  private async createTables(): Promise<void> {
    const tables = [
      {
        name: 'arbitrage_opportunities',
        schema: `
          CREATE TABLE IF NOT EXISTS arbitrage_opportunities (
            id String,
            asset_id String,
            source_chain String,
            target_chain String,
            source_price Float64,
            target_price Float64,
            profit_margin Float64,
            execution_time UInt32,
            risk_score Float64,
            confidence Float64,
            timestamp DateTime,
            date Date DEFAULT toDate(timestamp)
          ) ENGINE = MergeTree()
          ORDER BY (asset_id, source_chain, target_chain, timestamp)
          PARTITION BY date
        `,
      },
      {
        name: 'arbitrage_executions',
        schema: `
          CREATE TABLE IF NOT EXISTS arbitrage_executions (
            opportunity_id String,
            execution_path_id String,
            status String,
            actual_profit Float64,
            actual_cost Float64,
            net_return Float64,
            execution_time UInt32,
            start_time DateTime,
            end_time DateTime,
            failure_reason String,
            date Date DEFAULT toDate(start_time)
          ) ENGINE = MergeTree()
          ORDER BY (opportunity_id, start_time)
          PARTITION BY date
        `,
      },
      {
        name: 'price_movements',
        schema: `
          CREATE TABLE IF NOT EXISTS price_movements (
            asset_id String,
            chain_id String,
            price Float64,
            volume Float64,
            timestamp DateTime,
            date Date DEFAULT toDate(timestamp)
          ) ENGINE = MergeTree()
          ORDER BY (asset_id, chain_id, timestamp)
          PARTITION BY date
        `,
      },
    ];

    for (const table of tables) {
      await this.clickhouse.execute(table.schema);
    }
  }

  async recordOpportunity(opportunity: ArbitrageOpportunity): Promise<void> {
    try {
      await this.clickhouse.insert(
        'arbitrage_opportunities',
        {
          id: opportunity.id,
          asset_id: opportunity.assetId,
          source_chain: opportunity.sourceChain,
          target_chain: opportunity.targetChain,
          source_price: opportunity.sourcePrice,
          target_price: opportunity.targetPrice,
          profit_margin: opportunity.profitMargin,
          execution_time: opportunity.executionTime,
          risk_score: opportunity.riskScore,
          confidence: opportunity.confidence,
          timestamp: new Date(opportunity.timestamp),
        }
      );
    } catch (error) {
      logger.error('Failed to record opportunity:', error);
    }
  }

  async recordExecution(execution: ArbitrageExecution): Promise<void> {
    try {
      await this.clickhouse.insert(
        'arbitrage_executions',
        {
          opportunity_id: execution.opportunityId,
          execution_path_id: execution.executionPathId,
          status: execution.status,
          actual_profit: execution.actualProfit || 0,
          actual_cost: execution.actualCost || 0,
          net_return: execution.netReturn || 0,
          execution_time: execution.executionTime || 0,
          start_time: new Date(execution.startTime),
          end_time: execution.endTime ? new Date(execution.endTime) : null,
          failure_reason: execution.failureReason || '',
        }
      );
    } catch (error) {
      logger.error('Failed to record execution:', error);
    }
  }

  private async loadHistoricalPatterns(): Promise<void> {
    try {
      const query = `
        SELECT 
          asset_id,
          source_chain,
          target_chain,
          count() as frequency,
          avg(profit_margin) as avg_profit_margin,
          avg(execution_time) as avg_execution_time,
          toHour(timestamp) as hour,
          toDayOfWeek(timestamp) as day_of_week,
          toMonth(timestamp) as month
        FROM arbitrage_opportunities
        WHERE timestamp >= now() - INTERVAL 30 DAY
        GROUP BY asset_id, source_chain, target_chain, hour, day_of_week, month
        ORDER BY frequency DESC
      `;

      const results = await this.clickhouse.query(query);
      
      // Process results to build patterns
      const patternMap = new Map<string, any>();
      
      for (const row of results.data) {
        const key = `${row.asset_id}:${row.source_chain}:${row.target_chain}`;
        
        if (!patternMap.has(key)) {
          patternMap.set(key, {
            assetId: row.asset_id,
            sourceChain: row.source_chain,
            targetChain: row.target_chain,
            totalFrequency: 0,
            profitMargins: [],
            executionTimes: [],
            hourlyData: new Array(24).fill(0),
            dailyData: new Array(7).fill(0),
            monthlyData: new Array(12).fill(0),
          });
        }
        
        const pattern = patternMap.get(key);
        pattern.totalFrequency += row.frequency;
        pattern.profitMargins.push(row.avg_profit_margin);
        pattern.executionTimes.push(row.avg_execution_time);
        pattern.hourlyData[row.hour] += row.frequency;
        pattern.dailyData[row.day_of_week] += row.frequency;
        pattern.monthlyData[row.month - 1] += row.frequency;
      }

      // Convert to OpportunityPattern objects
      for (const [key, data] of patternMap) {
        const successRate = await this.getSuccessRate(
          data.assetId,
          data.sourceChain,
          data.targetChain
        );

        const pattern: OpportunityPattern = {
          assetId: data.assetId,
          sourceChain: data.sourceChain,
          targetChain: data.targetChain,
          frequency: data.totalFrequency / 24, // per hour
          avgProfitMargin: data.profitMargins.reduce((a, b) => a + b, 0) / data.profitMargins.length,
          avgExecutionTime: data.executionTimes.reduce((a, b) => a + b, 0) / data.executionTimes.length,
          successRate,
          bestTimeOfDay: data.hourlyData.indexOf(Math.max(...data.hourlyData)),
          seasonality: {
            hourlyDistribution: data.hourlyData,
            dailyDistribution: data.dailyData,
            monthlyDistribution: data.monthlyData,
          },
        };

        this.patterns.set(key, pattern);
      }

      logger.info(`Loaded ${this.patterns.size} historical patterns`);
    } catch (error) {
      logger.error('Failed to load historical patterns:', error);
    }
  }

  private async getSuccessRate(
    assetId: AssetID,
    sourceChain: ChainID,
    targetChain: ChainID
  ): Promise<number> {
    try {
      const query = `
        SELECT 
          countIf(status = 'completed') as completed,
          count() as total
        FROM arbitrage_executions e
        JOIN arbitrage_opportunities o ON e.opportunity_id = o.id
        WHERE o.asset_id = '${assetId}' 
          AND o.source_chain = '${sourceChain}' 
          AND o.target_chain = '${targetChain}'
          AND e.start_time >= now() - INTERVAL 30 DAY
      `;

      const results = await this.clickhouse.query(query);
      if (results.data.length === 0 || results.data[0]?.total === 0) {
        return 0;
      }

      const firstResult = results.data[0];
      return firstResult ? firstResult.completed / firstResult.total : 0;
    } catch (error) {
      logger.error('Failed to get success rate:', error);
      return 0;
    }
  }

  async getPerformanceMetrics(days: number = 30): Promise<PerformanceMetrics> {
    try {
      // Cache performance metrics for 1 hour
      if (this.performanceCache && Date.now() - this.lastAnalysisUpdate < 3600000) {
        return this.performanceCache;
      }

      const [opportunityData, executionData, assetData, chainData, failureData] = await Promise.all([
        this.getOpportunityMetrics(days),
        this.getExecutionMetrics(days),
        this.getAssetPerformance(days),
        this.getChainPerformance(days),
        this.getFailureReasons(days),
      ]);

      const metrics: PerformanceMetrics = {
        totalOpportunities: opportunityData.total,
        executedCount: executionData.total,
        totalProfit: executionData.totalProfit,
        totalLoss: executionData.totalLoss,
        avgProfitMargin: opportunityData.avgProfitMargin,
        successRate: executionData.successRate,
        avgExecutionTime: executionData.avgExecutionTime,
        bestPerformingAssets: assetData,
        bestPerformingChains: chainData,
        commonFailureReasons: failureData,
      };

      this.performanceCache = metrics;
      this.lastAnalysisUpdate = Date.now();

      return metrics;
    } catch (error) {
      logger.error('Failed to get performance metrics:', error);
      throw error;
    }
  }

  private async getOpportunityMetrics(days: number): Promise<any> {
    const query = `
      SELECT 
        count() as total,
        avg(profit_margin) as avg_profit_margin
      FROM arbitrage_opportunities
      WHERE timestamp >= now() - INTERVAL ${days} DAY
    `;

    const results = await this.clickhouse.query(query);
    return results[0] || { total: 0, avg_profit_margin: 0 };
  }

  private async getExecutionMetrics(days: number): Promise<any> {
    const query = `
      SELECT 
        count() as total,
        countIf(status = 'completed') as completed,
        sumIf(net_return, net_return > 0) as total_profit,
        sumIf(abs(net_return), net_return < 0) as total_loss,
        avg(execution_time) as avg_execution_time
      FROM arbitrage_executions
      WHERE start_time >= now() - INTERVAL ${days} DAY
    `;

    const results = await this.clickhouse.query(query);
    const data = results[0] || {};
    
    return {
      total: data.total || 0,
      totalProfit: data.total_profit || 0,
      totalLoss: data.total_loss || 0,
      successRate: data.total > 0 ? (data.completed || 0) / data.total : 0,
      avgExecutionTime: data.avg_execution_time || 0,
    };
  }

  private async getAssetPerformance(days: number): Promise<AssetPerformance[]> {
    const query = `
      SELECT 
        o.asset_id,
        count() as opportunity_count,
        countIf(e.status = 'completed') as execution_count,
        sum(e.net_return) as total_profit,
        avg(o.profit_margin) as avg_profit_margin,
        countIf(e.status = 'completed') / count() as success_rate
      FROM arbitrage_opportunities o
      LEFT JOIN arbitrage_executions e ON o.id = e.opportunity_id
      WHERE o.timestamp >= now() - INTERVAL ${days} DAY
      GROUP BY o.asset_id
      ORDER BY total_profit DESC
      LIMIT 10
    `;

    const results = await this.clickhouse.query(query);
    
    return results.map(row => ({
      assetId: row.asset_id,
      opportunityCount: row.opportunity_count,
      executionCount: row.execution_count || 0,
      totalProfit: row.total_profit || 0,
      avgProfitMargin: row.avg_profit_margin || 0,
      successRate: row.success_rate || 0,
    }));
  }

  private async getChainPerformance(days: number): Promise<ChainPerformance[]> {
    const query = `
      SELECT 
        chain_id,
        countIf(direction = 'source') as as_source_count,
        countIf(direction = 'target') as as_target_count,
        sum(total_profit) as total_profit,
        avg(avg_gas_cost) as avg_gas_cost,
        avg(avg_execution_time) as avg_execution_time,
        avg(success_rate) as success_rate
      FROM (
        SELECT 
          o.source_chain as chain_id,
          'source' as direction,
          sum(e.net_return) as total_profit,
          avg(e.actual_cost) as avg_gas_cost,
          avg(e.execution_time) as avg_execution_time,
          countIf(e.status = 'completed') / count() as success_rate
        FROM arbitrage_opportunities o
        LEFT JOIN arbitrage_executions e ON o.id = e.opportunity_id
        WHERE o.timestamp >= now() - INTERVAL ${days} DAY
        GROUP BY o.source_chain
        
        UNION ALL
        
        SELECT 
          o.target_chain as chain_id,
          'target' as direction,
          sum(e.net_return) as total_profit,
          avg(e.actual_cost) as avg_gas_cost,
          avg(e.execution_time) as avg_execution_time,
          countIf(e.status = 'completed') / count() as success_rate
        FROM arbitrage_opportunities o
        LEFT JOIN arbitrage_executions e ON o.id = e.opportunity_id
        WHERE o.timestamp >= now() - INTERVAL ${days} DAY
        GROUP BY o.target_chain
      )
      GROUP BY chain_id
      ORDER BY total_profit DESC
    `;

    const results = await this.clickhouse.query(query);
    
    return results.map(row => ({
      chainId: row.chain_id,
      asSourceCount: row.as_source_count || 0,
      asTargetCount: row.as_target_count || 0,
      totalProfit: row.total_profit || 0,
      avgGasCost: row.avg_gas_cost || 0,
      avgExecutionTime: row.avg_execution_time || 0,
      successRate: row.success_rate || 0,
    }));
  }

  private async getFailureReasons(days: number): Promise<Record<string, number>> {
    const query = `
      SELECT 
        failure_reason,
        count() as count
      FROM arbitrage_executions
      WHERE status = 'failed' 
        AND start_time >= now() - INTERVAL ${days} DAY
        AND failure_reason != ''
      GROUP BY failure_reason
      ORDER BY count DESC
    `;

    const results = await this.clickhouse.query(query);
    const reasons: Record<string, number> = {};
    
    for (const row of results) {
      reasons[row.failure_reason] = row.count;
    }
    
    return reasons;
  }

  async predictOpportunities(
    assetId?: AssetID,
    sourceChain?: ChainID,
    targetChain?: ChainID
  ): Promise<PredictionModel[]> {
    const predictions: PredictionModel[] = [];
    
    // Filter patterns based on criteria
    const relevantPatterns = Array.from(this.patterns.values()).filter(pattern => {
      return (!assetId || pattern.assetId === assetId) &&
             (!sourceChain || pattern.sourceChain === sourceChain) &&
             (!targetChain || pattern.targetChain === targetChain);
    });

    for (const pattern of relevantPatterns) {
      const currentHour = new Date().getHours();
      const hourlyFactor = pattern.seasonality.hourlyDistribution[currentHour] / 
        Math.max(...pattern.seasonality.hourlyDistribution);

      const factors: PredictionFactor[] = [
        {
          name: 'Historical Frequency',
          weight: 0.3,
          currentValue: pattern.frequency,
          impact: pattern.frequency > 1 ? 'positive' : 'neutral',
        },
        {
          name: 'Success Rate',
          weight: 0.25,
          currentValue: pattern.successRate,
          impact: pattern.successRate > 0.7 ? 'positive' : 'negative',
        },
        {
          name: 'Time of Day',
          weight: 0.2,
          currentValue: hourlyFactor,
          impact: hourlyFactor > 0.8 ? 'positive' : 'neutral',
        },
        {
          name: 'Profit Margin',
          weight: 0.25,
          currentValue: pattern.avgProfitMargin,
          impact: pattern.avgProfitMargin > 0.01 ? 'positive' : 'negative',
        },
      ];

      const predictedProbability = factors.reduce((sum, factor) => {
        const normalizedValue = Math.min(1, factor.currentValue);
        return sum + (normalizedValue * factor.weight);
      }, 0);

      const confidence = Math.min(1, pattern.frequency * pattern.successRate * 0.1);

      predictions.push({
        assetId: pattern.assetId,
        sourceChain: pattern.sourceChain,
        targetChain: pattern.targetChain,
        predictedProbability,
        expectedProfitMargin: pattern.avgProfitMargin,
        confidence,
        factors,
      });
    }

    return predictions.sort((a, b) => b.predictedProbability - a.predictedProbability);
  }

  getPattern(assetId: AssetID, sourceChain: ChainID, targetChain: ChainID): OpportunityPattern | null {
    const key = `${assetId}:${sourceChain}:${targetChain}`;
    return this.patterns.get(key) || null;
  }

  getAllPatterns(): OpportunityPattern[] {
    return Array.from(this.patterns.values());
  }

  async updatePatterns(): Promise<void> {
    await this.loadHistoricalPatterns();
    this.performanceCache = null; // Invalidate cache
    logger.info('Historical patterns updated');
  }
}