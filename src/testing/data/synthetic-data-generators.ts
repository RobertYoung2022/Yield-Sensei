/**
 * Synthetic Data Generators
 * Comprehensive data generation for various domains and testing scenarios
 */

import crypto from 'crypto';
import { GeneratorConfig } from './test-data-manager';

export interface DataGeneratorBase {
  generate(config: GeneratorConfig): Promise<any[]>;
  getSchema(config: GeneratorConfig): any;
  validateConfig(config: GeneratorConfig): boolean;
}

// Financial Data Generator
export class FinancialDataGenerator implements DataGeneratorBase {
  async generate(config: GeneratorConfig): Promise<any[]> {
    const { count, parameters } = config;
    const data: any[] = [];

    for (let i = 0; i < count; i++) {
      const record = {
        id: this.generateId(),
        symbol: this.generateTradingSymbol(parameters.assetType),
        price: this.generatePrice(parameters.priceRange),
        volume: this.generateVolume(parameters.volumeRange),
        timestamp: this.generateTimestamp(parameters.timeRange),
        marketCap: this.generateMarketCap(),
        change24h: this.generatePriceChange(),
        changePercent24h: this.generatePercentageChange(),
        high24h: 0,
        low24h: 0,
        circulatingSupply: this.generateSupply(),
        totalSupply: this.generateSupply(),
        liquidity: this.generateLiquidity(),
        tvl: this.generateTVL(),
        apr: this.generateAPR(),
        rewards: this.generateRewards(),
        riskScore: this.generateRiskScore(),
        complianceScore: this.generateComplianceScore(),
      };

      // Calculate derived fields
      record.high24h = record.price * (1 + Math.random() * 0.1);
      record.low24h = record.price * (1 - Math.random() * 0.1);

      data.push(record);
    }

    return data;
  }

  getSchema(config: GeneratorConfig): any {
    return {
      type: 'object',
      properties: {
        id: { type: 'string' },
        symbol: { type: 'string' },
        price: { type: 'number', minimum: 0 },
        volume: { type: 'number', minimum: 0 },
        timestamp: { type: 'string', format: 'date-time' },
        marketCap: { type: 'number', minimum: 0 },
        change24h: { type: 'number' },
        changePercent24h: { type: 'number' },
        high24h: { type: 'number', minimum: 0 },
        low24h: { type: 'number', minimum: 0 },
        circulatingSupply: { type: 'number', minimum: 0 },
        totalSupply: { type: 'number', minimum: 0 },
        liquidity: { type: 'number', minimum: 0 },
        tvl: { type: 'number', minimum: 0 },
        apr: { type: 'number' },
        rewards: { type: 'number', minimum: 0 },
        riskScore: { type: 'number', minimum: 0, maximum: 10 },
        complianceScore: { type: 'number', minimum: 0, maximum: 100 },
      },
      required: ['id', 'symbol', 'price', 'volume', 'timestamp'],
    };
  }

  validateConfig(config: GeneratorConfig): boolean {
    return config.count > 0 && config.parameters;
  }

  private generateId(): string {
    return crypto.randomUUID();
  }

  private generateTradingSymbol(assetType: string = 'crypto'): string {
    const cryptoSymbols = ['BTC', 'ETH', 'ADA', 'DOT', 'SOL', 'AVAX', 'MATIC', 'LINK', 'UNI', 'AAVE'];
    const stockSymbols = ['AAPL', 'GOOGL', 'MSFT', 'AMZN', 'TSLA', 'META', 'NVDA', 'AMD', 'NFLX', 'DIS'];
    const commoditySymbols = ['GOLD', 'SILVER', 'OIL', 'GAS', 'WHEAT', 'CORN', 'COPPER', 'PLATINUM'];

    switch (assetType) {
      case 'stock':
        return stockSymbols[Math.floor(Math.random() * stockSymbols.length)] || 'AAPL';
      case 'commodity':
        return commoditySymbols[Math.floor(Math.random() * commoditySymbols.length)] || 'GOLD';
      default:
        return cryptoSymbols[Math.floor(Math.random() * cryptoSymbols.length)] || 'BTC';
    }
  }

  private generatePrice(range: { min: number; max: number } = { min: 0.01, max: 100000 }): number {
    return Number((Math.random() * (range.max - range.min) + range.min).toFixed(8));
  }

  private generateVolume(range: { min: number; max: number } = { min: 1000, max: 10000000 }): number {
    return Math.floor(Math.random() * (range.max - range.min) + range.min);
  }

  private generateTimestamp(range?: { start: Date; end: Date }): string {
    const start = range?.start || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
    const end = range?.end || new Date();
    const timestamp = new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
    return timestamp.toISOString();
  }

  private generateMarketCap(): number {
    return Math.floor(Math.random() * 1000000000000); // Up to 1 trillion
  }

  private generatePriceChange(): number {
    return Number(((Math.random() - 0.5) * 1000).toFixed(2));
  }

  private generatePercentageChange(): number {
    return Number(((Math.random() - 0.5) * 20).toFixed(2)); // ±10%
  }

  private generateSupply(): number {
    return Math.floor(Math.random() * 1000000000);
  }

  private generateLiquidity(): number {
    return Math.floor(Math.random() * 100000000);
  }

  private generateTVL(): number {
    return Math.floor(Math.random() * 10000000000); // Up to 10 billion
  }

  private generateAPR(): number {
    return Number((Math.random() * 50).toFixed(2)); // 0-50% APR
  }

  private generateRewards(): number {
    return Number((Math.random() * 10000).toFixed(2));
  }

  private generateRiskScore(): number {
    return Number((Math.random() * 10).toFixed(1));
  }

  private generateComplianceScore(): number {
    return Number((60 + Math.random() * 40).toFixed(1)); // 60-100
  }
}

// User Data Generator
export class UserDataGenerator implements DataGeneratorBase {
  async generate(config: GeneratorConfig): Promise<any[]> {
    const { count, parameters } = config;
    const data: any[] = [];

    for (let i = 0; i < count; i++) {
      const firstName = this.generateFirstName();
      const lastName = this.generateLastName();
      const username = this.generateUsername(firstName, lastName);
      const email = this.generateEmail(username, parameters.domain);

      const record = {
        id: this.generateId(),
        username,
        email,
        firstName,
        lastName,
        fullName: `${firstName} ${lastName}`,
        dateOfBirth: this.generateDateOfBirth(),
        country: this.generateCountry(),
        timezone: this.generateTimezone(),
        language: this.generateLanguage(),
        phoneNumber: this.generatePhoneNumber(),
        address: this.generateAddress(),
        kycStatus: this.generateKYCStatus(),
        kycLevel: this.generateKYCLevel(),
        accountType: this.generateAccountType(),
        registrationDate: this.generateRegistrationDate(),
        lastLoginDate: this.generateLastLoginDate(),
        isActive: this.generateActiveStatus(),
        preferences: this.generateUserPreferences(),
        riskProfile: this.generateRiskProfile(),
        portfolioValue: this.generatePortfolioValue(),
        tradingExperience: this.generateTradingExperience(),
      };

      data.push(record);
    }

    return data;
  }

  getSchema(config: GeneratorConfig): any {
    return {
      type: 'object',
      properties: {
        id: { type: 'string' },
        username: { type: 'string' },
        email: { type: 'string', format: 'email' },
        firstName: { type: 'string' },
        lastName: { type: 'string' },
        fullName: { type: 'string' },
        dateOfBirth: { type: 'string', format: 'date' },
        country: { type: 'string' },
        timezone: { type: 'string' },
        language: { type: 'string' },
        phoneNumber: { type: 'string' },
        address: { type: 'object' },
        kycStatus: { type: 'string', enum: ['pending', 'approved', 'rejected', 'expired'] },
        kycLevel: { type: 'number', minimum: 0, maximum: 3 },
        accountType: { type: 'string', enum: ['individual', 'institutional', 'corporate'] },
        registrationDate: { type: 'string', format: 'date-time' },
        lastLoginDate: { type: 'string', format: 'date-time' },
        isActive: { type: 'boolean' },
        preferences: { type: 'object' },
        riskProfile: { type: 'string', enum: ['conservative', 'moderate', 'aggressive'] },
        portfolioValue: { type: 'number', minimum: 0 },
        tradingExperience: { type: 'string', enum: ['beginner', 'intermediate', 'advanced', 'expert'] },
      },
      required: ['id', 'username', 'email', 'firstName', 'lastName'],
    };
  }

  validateConfig(config: GeneratorConfig): boolean {
    return config.count > 0;
  }

  private generateId(): string {
    return crypto.randomUUID();
  }

  private generateFirstName(): string {
    const names = ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve', 'Frank', 'Grace', 'Henry', 'Ivy', 'Jack',
                  'Kate', 'Liam', 'Mia', 'Noah', 'Olivia', 'Peter', 'Quinn', 'Rose', 'Sam', 'Tara'];
    return names[Math.floor(Math.random() * names.length)] || 'John';
  }

  private generateLastName(): string {
    const names = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis',
                  'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson'];
    return names[Math.floor(Math.random() * names.length)] || 'Doe';
  }

  private generateUsername(firstName: string, lastName: string): string {
    const num = Math.floor(Math.random() * 9999);
    return `${firstName.toLowerCase()}${lastName.toLowerCase()}${num}`;
  }

  private generateEmail(username: string, domain: string = 'example.com'): string {
    return `${username}@${domain}`;
  }

  private generateDateOfBirth(): string {
    const start = new Date('1950-01-01');
    const end = new Date('2005-12-31');
    const date = new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
    return date.toISOString().split('T')[0];
  }

  private generateCountry(): string {
    const countries = ['US', 'CA', 'GB', 'DE', 'FR', 'JP', 'AU', 'SG', 'CH', 'NL', 'SE', 'DK', 'NO'];
    return countries[Math.floor(Math.random() * countries.length)] || 'US';
  }

  private generateTimezone(): string {
    const timezones = ['UTC', 'America/New_York', 'America/Los_Angeles', 'Europe/London', 
                      'Europe/Berlin', 'Asia/Tokyo', 'Australia/Sydney', 'Asia/Singapore'];
    return timezones[Math.floor(Math.random() * timezones.length)] || 'UTC';
  }

  private generateLanguage(): string {
    const languages = ['en', 'es', 'fr', 'de', 'ja', 'zh', 'ko', 'pt', 'it', 'ru'];
    return languages[Math.floor(Math.random() * languages.length)] || 'en';
  }

  private generatePhoneNumber(): string {
    const areaCode = Math.floor(Math.random() * 900) + 100;
    const number = Math.floor(Math.random() * 9000000) + 1000000;
    return `+1-${areaCode}-${number.toString().substring(0, 3)}-${number.toString().substring(3)}`;
  }

  private generateAddress(): any {
    return {
      street: `${Math.floor(Math.random() * 9999) + 1} Main St`,
      city: 'Springfield',
      state: 'CA',
      zipCode: `${Math.floor(Math.random() * 90000) + 10000}`,
      country: 'US',
    };
  }

  private generateKYCStatus(): string {
    const statuses = ['pending', 'approved', 'rejected', 'expired'];
    const weights = [0.1, 0.8, 0.05, 0.05]; // Most users approved
    return this.weightedRandom(statuses, weights);
  }

  private generateKYCLevel(): number {
    return Math.floor(Math.random() * 4); // 0-3
  }

  private generateAccountType(): string {
    const types = ['individual', 'institutional', 'corporate'];
    const weights = [0.85, 0.1, 0.05];
    return this.weightedRandom(types, weights);
  }

  private generateRegistrationDate(): string {
    const start = new Date('2020-01-01');
    const end = new Date();
    const date = new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
    return date.toISOString();
  }

  private generateLastLoginDate(): string {
    const start = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
    const end = new Date();
    const date = new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
    return date.toISOString();
  }

  private generateActiveStatus(): boolean {
    return Math.random() > 0.1; // 90% active
  }

  private generateUserPreferences(): any {
    return {
      notifications: {
        email: Math.random() > 0.3,
        sms: Math.random() > 0.7,
        push: Math.random() > 0.2,
      },
      trading: {
        advancedMode: Math.random() > 0.6,
        autoInvest: Math.random() > 0.8,
        riskWarnings: Math.random() > 0.1,
      },
      privacy: {
        shareData: Math.random() > 0.5,
        marketingEmails: Math.random() > 0.4,
      },
    };
  }

  private generateRiskProfile(): string {
    const profiles = ['conservative', 'moderate', 'aggressive'];
    const weights = [0.3, 0.5, 0.2];
    return this.weightedRandom(profiles, weights);
  }

  private generatePortfolioValue(): number {
    // Log-normal distribution for realistic wealth distribution
    const logValue = Math.random() * 6 + 2; // 2-8 in log scale
    return Math.floor(Math.exp(logValue));
  }

  private generateTradingExperience(): string {
    const levels = ['beginner', 'intermediate', 'advanced', 'expert'];
    const weights = [0.4, 0.35, 0.2, 0.05];
    return this.weightedRandom(levels, weights);
  }

  private weightedRandom(items: string[], weights: number[]): string {
    const random = Math.random();
    let cumulative = 0;
    
    for (let i = 0; i < items.length; i++) {
      cumulative += weights[i] || 0;
      if (random <= cumulative) {
        return items[i] || items[0] || '';
      }
    }
    
    return items[items.length - 1] || '';
  }
}

// Portfolio Data Generator
export class PortfolioDataGenerator implements DataGeneratorBase {
  async generate(config: GeneratorConfig): Promise<any[]> {
    const { count, parameters } = config;
    const data: any[] = [];

    for (let i = 0; i < count; i++) {
      const positionCount = parameters.maxPositions || Math.floor(Math.random() * 10) + 1;
      const positions = [];

      for (let j = 0; j < positionCount; j++) {
        positions.push(this.generatePosition());
      }

      const totalValue = positions.reduce((sum, pos) => sum + pos.currentValue, 0);
      const totalCost = positions.reduce((sum, pos) => sum + pos.totalCost, 0);
      const pnl = totalValue - totalCost;

      const record = {
        id: this.generateId(),
        userId: this.generateUserId(),
        name: this.generatePortfolioName(),
        description: this.generatePortfolioDescription(),
        currency: this.generateCurrency(),
        totalValue,
        totalCost,
        pnl,
        pnlPercentage: totalCost > 0 ? (pnl / totalCost) * 100 : 0,
        positions,
        diversificationScore: this.calculateDiversificationScore(positions),
        riskScore: this.calculateRiskScore(positions),
        lastUpdated: new Date().toISOString(),
        createdAt: this.generateCreationDate(),
        isPublic: Math.random() > 0.8,
        tags: this.generateTags(),
        performance: this.generatePerformanceMetrics(totalValue, totalCost),
      };

      data.push(record);
    }

    return data;
  }

  getSchema(config: GeneratorConfig): any {
    return {
      type: 'object',
      properties: {
        id: { type: 'string' },
        userId: { type: 'string' },
        name: { type: 'string' },
        description: { type: 'string' },
        currency: { type: 'string' },
        totalValue: { type: 'number', minimum: 0 },
        totalCost: { type: 'number', minimum: 0 },
        pnl: { type: 'number' },
        pnlPercentage: { type: 'number' },
        positions: { type: 'array' },
        diversificationScore: { type: 'number', minimum: 0, maximum: 100 },
        riskScore: { type: 'number', minimum: 0, maximum: 10 },
        lastUpdated: { type: 'string', format: 'date-time' },
        createdAt: { type: 'string', format: 'date-time' },
        isPublic: { type: 'boolean' },
        tags: { type: 'array', items: { type: 'string' } },
        performance: { type: 'object' },
      },
      required: ['id', 'userId', 'name', 'totalValue', 'positions'],
    };
  }

  validateConfig(config: GeneratorConfig): boolean {
    return config.count > 0;
  }

  private generateId(): string {
    return crypto.randomUUID();
  }

  private generateUserId(): string {
    return crypto.randomUUID();
  }

  private generatePortfolioName(): string {
    const adjectives = ['Conservative', 'Aggressive', 'Balanced', 'Growth', 'Income', 'Speculative'];
    const nouns = ['Portfolio', 'Fund', 'Strategy', 'Investment', 'Holdings'];
    const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
    const noun = nouns[Math.floor(Math.random() * nouns.length)];
    return `${adj} ${noun}`;
  }

  private generatePortfolioDescription(): string {
    const descriptions = [
      'A diversified portfolio focused on long-term growth',
      'Conservative investment strategy with stable returns',
      'High-risk, high-reward cryptocurrency investments',
      'Balanced mix of traditional and digital assets',
      'Income-focused portfolio with dividend-paying assets',
    ];
    return descriptions[Math.floor(Math.random() * descriptions.length)] || descriptions[0] || '';
  }

  private generateCurrency(): string {
    const currencies = ['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'CHF'];
    return currencies[Math.floor(Math.random() * currencies.length)] || 'USD';
  }

  private generatePosition(): any {
    const symbol = this.generateAssetSymbol();
    const quantity = Number((Math.random() * 1000).toFixed(8));
    const avgPrice = Number((Math.random() * 1000).toFixed(2));
    const currentPrice = avgPrice * (0.8 + Math.random() * 0.4); // ±20% from avg price
    const totalCost = quantity * avgPrice;
    const currentValue = quantity * currentPrice;

    return {
      id: crypto.randomUUID(),
      symbol,
      assetType: this.getAssetType(symbol),
      quantity,
      avgPrice,
      currentPrice,
      totalCost,
      currentValue,
      pnl: currentValue - totalCost,
      pnlPercentage: totalCost > 0 ? ((currentValue - totalCost) / totalCost) * 100 : 0,
      weight: 0, // Will be calculated later
      lastUpdated: new Date().toISOString(),
      purchaseDate: this.generatePurchaseDate(),
    };
  }

  private generateAssetSymbol(): string {
    const symbols = ['BTC', 'ETH', 'ADA', 'SOL', 'AAPL', 'GOOGL', 'TSLA', 'MSFT', 'GOLD', 'SILVER'];
    return symbols[Math.floor(Math.random() * symbols.length)] || 'BTC';
  }

  private getAssetType(symbol: string): string {
    const cryptoSymbols = ['BTC', 'ETH', 'ADA', 'SOL', 'AVAX', 'DOT'];
    const stockSymbols = ['AAPL', 'GOOGL', 'TSLA', 'MSFT', 'AMZN'];
    const commoditySymbols = ['GOLD', 'SILVER', 'OIL'];

    if (cryptoSymbols.includes(symbol)) return 'cryptocurrency';
    if (stockSymbols.includes(symbol)) return 'stock';
    if (commoditySymbols.includes(symbol)) return 'commodity';
    return 'other';
  }

  private generateCreationDate(): string {
    const start = new Date('2020-01-01');
    const end = new Date();
    const date = new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
    return date.toISOString();
  }

  private generatePurchaseDate(): string {
    const start = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000); // 1 year ago
    const end = new Date();
    const date = new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
    return date.toISOString();
  }

  private generateTags(): string[] {
    const allTags = ['crypto', 'stocks', 'commodities', 'high-risk', 'conservative', 'growth', 'income'];
    const count = Math.floor(Math.random() * 4) + 1;
    const selectedTags = [];
    
    for (let i = 0; i < count; i++) {
      const tag = allTags[Math.floor(Math.random() * allTags.length)];
      if (tag && !selectedTags.includes(tag)) {
        selectedTags.push(tag);
      }
    }
    
    return selectedTags;
  }

  private calculateDiversificationScore(positions: any[]): number {
    // Simple diversification score based on number of different asset types
    const assetTypes = new Set(positions.map(p => p.assetType));
    const maxTypes = 5; // Maximum expected asset types
    return Math.min((assetTypes.size / maxTypes) * 100, 100);
  }

  private calculateRiskScore(positions: any[]): number {
    // Simple risk score based on asset types and concentration
    let riskScore = 0;
    const totalValue = positions.reduce((sum, pos) => sum + pos.currentValue, 0);

    for (const position of positions) {
      const weight = position.currentValue / totalValue;
      let assetRisk = 1; // Default risk

      switch (position.assetType) {
        case 'cryptocurrency':
          assetRisk = 8;
          break;
        case 'stock':
          assetRisk = 5;
          break;
        case 'commodity':
          assetRisk = 3;
          break;
        default:
          assetRisk = 2;
      }

      riskScore += weight * assetRisk;
    }

    return Number(Math.min(riskScore, 10).toFixed(1));
  }

  private generatePerformanceMetrics(totalValue: number, totalCost: number): any {
    const returns = totalCost > 0 ? (totalValue - totalCost) / totalCost : 0;
    
    return {
      totalReturn: returns,
      annualizedReturn: returns * (365 / 30), // Simplified calculation
      sharpeRatio: Number((returns / 0.15).toFixed(2)), // Simplified, assuming 15% volatility
      maxDrawdown: Number((Math.random() * 0.3).toFixed(2)), // 0-30%
      volatility: Number((Math.random() * 0.5).toFixed(2)), // 0-50%
      beta: Number((0.5 + Math.random()).toFixed(2)), // 0.5-1.5
      alpha: Number(((Math.random() - 0.5) * 0.1).toFixed(3)), // ±5%
    };
  }
}

// Market Data Generator
export class MarketDataGenerator implements DataGeneratorBase {
  async generate(config: GeneratorConfig): Promise<any[]> {
    const { count, parameters } = config;
    const data: any[] = [];
    const symbols = parameters.symbols || ['BTC', 'ETH', 'ADA'];
    const timeInterval = parameters.interval || '1h';
    const startDate = new Date(parameters.startDate || Date.now() - 30 * 24 * 60 * 60 * 1000);

    let currentDate = new Date(startDate);
    const intervalMs = this.getIntervalMs(timeInterval);

    for (let i = 0; i < count; i++) {
      const symbol = symbols[i % symbols.length];
      
      const record = {
        id: this.generateId(),
        symbol,
        timestamp: new Date(currentDate).toISOString(),
        open: this.generatePrice(),
        high: 0,
        low: 0,
        close: 0,
        volume: this.generateVolume(),
        volumeQuote: 0,
        trades: this.generateTradeCount(),
        interval: timeInterval,
        isClosed: true,
        marketCap: this.generateMarketCap(),
        circulatingSupply: this.generateSupply(),
        totalSupply: this.generateSupply(),
        dominance: Number((Math.random() * 10).toFixed(2)),
        rank: Math.floor(Math.random() * 100) + 1,
        priceChangePercent: Number(((Math.random() - 0.5) * 20).toFixed(2)),
        volumeChangePercent: Number(((Math.random() - 0.5) * 50).toFixed(2)),
      };

      // Generate OHLC data
      const priceVolatility = 0.05; // 5% volatility
      record.high = record.open * (1 + Math.random() * priceVolatility);
      record.low = record.open * (1 - Math.random() * priceVolatility);
      record.close = record.low + Math.random() * (record.high - record.low);
      record.volumeQuote = record.volume * ((record.open + record.close) / 2);

      data.push(record);
      currentDate = new Date(currentDate.getTime() + intervalMs);
    }

    return data;
  }

  getSchema(config: GeneratorConfig): any {
    return {
      type: 'object',
      properties: {
        id: { type: 'string' },
        symbol: { type: 'string' },
        timestamp: { type: 'string', format: 'date-time' },
        open: { type: 'number', minimum: 0 },
        high: { type: 'number', minimum: 0 },
        low: { type: 'number', minimum: 0 },
        close: { type: 'number', minimum: 0 },
        volume: { type: 'number', minimum: 0 },
        volumeQuote: { type: 'number', minimum: 0 },
        trades: { type: 'number', minimum: 0 },
        interval: { type: 'string' },
        isClosed: { type: 'boolean' },
        marketCap: { type: 'number', minimum: 0 },
        circulatingSupply: { type: 'number', minimum: 0 },
        totalSupply: { type: 'number', minimum: 0 },
        dominance: { type: 'number', minimum: 0, maximum: 100 },
        rank: { type: 'number', minimum: 1 },
        priceChangePercent: { type: 'number' },
        volumeChangePercent: { type: 'number' },
      },
      required: ['id', 'symbol', 'timestamp', 'open', 'high', 'low', 'close', 'volume'],
    };
  }

  validateConfig(config: GeneratorConfig): boolean {
    return config.count > 0;
  }

  private generateId(): string {
    return crypto.randomUUID();
  }

  private generatePrice(): number {
    return Number((Math.random() * 100000).toFixed(8));
  }

  private generateVolume(): number {
    return Math.floor(Math.random() * 10000000);
  }

  private generateTradeCount(): number {
    return Math.floor(Math.random() * 100000);
  }

  private generateMarketCap(): number {
    return Math.floor(Math.random() * 1000000000000);
  }

  private generateSupply(): number {
    return Math.floor(Math.random() * 1000000000);
  }

  private getIntervalMs(interval: string): number {
    const intervalMap: Record<string, number> = {
      '1m': 60 * 1000,
      '5m': 5 * 60 * 1000,
      '15m': 15 * 60 * 1000,
      '1h': 60 * 60 * 1000,
      '4h': 4 * 60 * 60 * 1000,
      '1d': 24 * 60 * 60 * 1000,
    };
    return intervalMap[interval] || intervalMap['1h'] || 3600000;
  }
}

// Transaction Data Generator
export class TransactionDataGenerator implements DataGeneratorBase {
  async generate(config: GeneratorConfig): Promise<any[]> {
    const { count, parameters } = config;
    const data: any[] = [];

    for (let i = 0; i < count; i++) {
      const transactionType = this.generateTransactionType();
      const record = {
        id: this.generateId(),
        userId: this.generateUserId(),
        portfolioId: this.generatePortfolioId(),
        type: transactionType,
        status: this.generateStatus(),
        symbol: this.generateSymbol(),
        quantity: this.generateQuantity(transactionType),
        price: this.generatePrice(),
        totalAmount: 0, // Will be calculated
        fee: this.generateFee(),
        feeType: this.generateFeeType(),
        timestamp: this.generateTimestamp(),
        settlementDate: this.generateSettlementDate(),
        exchangeId: this.generateExchangeId(),
        orderId: this.generateOrderId(),
        counterparty: this.generateCounterparty(),
        notes: this.generateNotes(),
        metadata: this.generateMetadata(transactionType),
        complianceFlags: this.generateComplianceFlags(),
        riskScore: this.generateRiskScore(),
      };

      record.totalAmount = record.quantity * record.price;

      data.push(record);
    }

    return data;
  }

  getSchema(config: GeneratorConfig): any {
    return {
      type: 'object',
      properties: {
        id: { type: 'string' },
        userId: { type: 'string' },
        portfolioId: { type: 'string' },
        type: { type: 'string', enum: ['buy', 'sell', 'transfer', 'deposit', 'withdrawal'] },
        status: { type: 'string', enum: ['pending', 'completed', 'failed', 'cancelled'] },
        symbol: { type: 'string' },
        quantity: { type: 'number', minimum: 0 },
        price: { type: 'number', minimum: 0 },
        totalAmount: { type: 'number', minimum: 0 },
        fee: { type: 'number', minimum: 0 },
        feeType: { type: 'string' },
        timestamp: { type: 'string', format: 'date-time' },
        settlementDate: { type: 'string', format: 'date-time' },
        exchangeId: { type: 'string' },
        orderId: { type: 'string' },
        counterparty: { type: 'string' },
        notes: { type: 'string' },
        metadata: { type: 'object' },
        complianceFlags: { type: 'array' },
        riskScore: { type: 'number', minimum: 0, maximum: 10 },
      },
      required: ['id', 'userId', 'type', 'status', 'symbol', 'quantity', 'price', 'timestamp'],
    };
  }

  validateConfig(config: GeneratorConfig): boolean {
    return config.count > 0;
  }

  private generateId(): string {
    return crypto.randomUUID();
  }

  private generateUserId(): string {
    return crypto.randomUUID();
  }

  private generatePortfolioId(): string {
    return crypto.randomUUID();
  }

  private generateTransactionType(): string {
    const types = ['buy', 'sell', 'transfer', 'deposit', 'withdrawal'];
    const weights = [0.4, 0.3, 0.1, 0.1, 0.1];
    return this.weightedRandom(types, weights);
  }

  private generateStatus(): string {
    const statuses = ['pending', 'completed', 'failed', 'cancelled'];
    const weights = [0.05, 0.9, 0.03, 0.02];
    return this.weightedRandom(statuses, weights);
  }

  private generateSymbol(): string {
    const symbols = ['BTC', 'ETH', 'ADA', 'SOL', 'AAPL', 'GOOGL', 'TSLA'];
    return symbols[Math.floor(Math.random() * symbols.length)] || 'BTC';
  }

  private generateQuantity(type: string): number {
    const baseQuantity = Math.random() * 1000;
    if (type === 'transfer') {
      return Number(baseQuantity.toFixed(8));
    }
    return Number((baseQuantity * (0.1 + Math.random() * 0.9)).toFixed(8));
  }

  private generatePrice(): number {
    return Number((Math.random() * 100000).toFixed(2));
  }

  private generateFee(): number {
    return Number((Math.random() * 100).toFixed(2));
  }

  private generateFeeType(): string {
    const types = ['fixed', 'percentage', 'gas', 'network'];
    return types[Math.floor(Math.random() * types.length)] || 'percentage';
  }

  private generateTimestamp(): string {
    const start = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000); // 90 days ago
    const end = new Date();
    const date = new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
    return date.toISOString();
  }

  private generateSettlementDate(): string {
    const base = new Date();
    const settlement = new Date(base.getTime() + Math.random() * 3 * 24 * 60 * 60 * 1000); // 0-3 days
    return settlement.toISOString();
  }

  private generateExchangeId(): string {
    const exchanges = ['binance', 'coinbase', 'kraken', 'uniswap', 'sushiswap'];
    return exchanges[Math.floor(Math.random() * exchanges.length)] || 'binance';
  }

  private generateOrderId(): string {
    return `order_${Math.random().toString(36).substring(2, 15)}`;
  }

  private generateCounterparty(): string {
    return `counterparty_${Math.random().toString(36).substring(2, 10)}`;
  }

  private generateNotes(): string {
    const notes = [
      'Regular investment',
      'Profit taking',
      'Portfolio rebalancing',
      'Emergency withdrawal',
      'DCA strategy',
      'Yield farming rewards',
    ];
    return notes[Math.floor(Math.random() * notes.length)] || '';
  }

  private generateMetadata(type: string): any {
    const base = {
      source: 'api',
      clientId: Math.random().toString(36).substring(2, 10),
      ipAddress: this.generateIP(),
      userAgent: 'YieldSensei/1.0',
    };

    if (type === 'buy' || type === 'sell') {
      return {
        ...base,
        orderType: Math.random() > 0.5 ? 'market' : 'limit',
        slippage: Number((Math.random() * 0.05).toFixed(4)),
      };
    }

    return base;
  }

  private generateComplianceFlags(): string[] {
    const flags = ['aml_checked', 'kyc_verified', 'sanctions_clear', 'pep_check'];
    const selectedFlags = [];
    
    for (const flag of flags) {
      if (Math.random() > 0.1) { // 90% chance to have each flag
        selectedFlags.push(flag);
      }
    }
    
    return selectedFlags;
  }

  private generateRiskScore(): number {
    return Number((Math.random() * 10).toFixed(1));
  }

  private generateIP(): string {
    return `${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}`;
  }

  private weightedRandom(items: string[], weights: number[]): string {
    const random = Math.random();
    let cumulative = 0;
    
    for (let i = 0; i < items.length; i++) {
      cumulative += weights[i] || 0;
      if (random <= cumulative) {
        return items[i] || items[0] || '';
      }
    }
    
    return items[items.length - 1] || '';
  }
}

// Generator Registry
export class GeneratorRegistry {
  private generators: Map<string, DataGeneratorBase> = new Map();

  constructor() {
    this.registerDefaultGenerators();
  }

  private registerDefaultGenerators(): void {
    this.register('financial', new FinancialDataGenerator());
    this.register('user', new UserDataGenerator());
    this.register('portfolio', new PortfolioDataGenerator());
    this.register('market', new MarketDataGenerator());
    this.register('transaction', new TransactionDataGenerator());
  }

  register(name: string, generator: DataGeneratorBase): void {
    this.generators.set(name, generator);
  }

  get(name: string): DataGeneratorBase | undefined {
    return this.generators.get(name);
  }

  list(): string[] {
    return Array.from(this.generators.keys());
  }

  unregister(name: string): boolean {
    return this.generators.delete(name);
  }
}

// Export singleton registry
export const generatorRegistry = new GeneratorRegistry();