/**
 * GraphQL DataLoaders
 * Performance optimization for batch loading related data
 */

import DataLoader from 'dataloader';

export function createDataLoaders(dataSources: any) {
  return {
    // Portfolio DataLoaders
    portfolioLoader: new DataLoader(async (ids: readonly string[]) => {
      // TODO: Implement batch loading for portfolios
      const portfolios = await dataSources.portfolioService?.getPortfoliosByIds(ids) || [];
      return ids.map(id => portfolios.find((p: any) => p.id === id));
    }),

    // User DataLoaders
    userLoader: new DataLoader(async (ids: readonly string[]) => {
      // TODO: Implement batch loading for users
      const users = await dataSources.userService?.getUsersByIds(ids) || [];
      return ids.map(id => users.find((u: any) => u.id === id));
    }),

    // Satellite DataLoaders
    satelliteLoader: new DataLoader(async (ids: readonly string[]) => {
      // TODO: Implement batch loading for satellites
      const satellites = await dataSources.satelliteService?.getSatellitesByIds(ids) || [];
      return ids.map(id => satellites.find((s: any) => s.id === id));
    }),

    // Position DataLoaders
    positionLoader: new DataLoader(async (ids: readonly string[]) => {
      // TODO: Implement batch loading for positions
      const positions = await dataSources.positionService?.getPositionsByIds(ids) || [];
      return ids.map(id => positions.find((p: any) => p.id === id));
    }),

    // Market Data DataLoaders
    marketDataLoader: new DataLoader(async (symbols: readonly string[]) => {
      // TODO: Implement batch loading for market data
      const marketData = await dataSources.marketDataService?.getMarketDataBySymbols(symbols) || [];
      return symbols.map(symbol => marketData.find((md: any) => md.symbol === symbol));
    }),
  };
} 