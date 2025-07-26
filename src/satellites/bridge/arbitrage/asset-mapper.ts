/**
 * Asset Mapping Service
 * Maps equivalent assets across different chains and handles wrapped tokens
 */

import Logger from '../../../shared/logging/logger';
import { RedisManager } from '../../../shared/database/redis-manager';
import { ChainID, AssetID } from '../types';

const logger = Logger.getLogger('asset-mapper');

export interface AssetMapping {
  canonicalId: AssetID; // Universal identifier for the asset
  name: string;
  symbol: string;
  decimals: number;
  chainMappings: Map<ChainID, ChainAssetInfo>;
  bridges: BridgeMapping[];
  metadata: AssetMetadata;
}

export interface ChainAssetInfo {
  chainId: ChainID;
  address: string;
  symbol: string; // May differ across chains (e.g., WETH vs ETH)
  decimals: number;
  isNative: boolean;
  isWrapped: boolean;
  wrappedVersion?: string; // Address of wrapped version if native
  nativeVersion?: string; // Address of native version if wrapped
}

export interface BridgeMapping {
  bridgeId: string;
  sourceChain: ChainID;
  targetChain: ChainID;
  sourceAddress: string;
  targetAddress: string;
  bridgeType: 'canonical' | 'wrapped' | 'synthetic';
}

export interface AssetMetadata {
  coingeckoId?: string;
  chainlinkId?: string;
  categories: string[];
  totalSupply?: number;
  marketCap?: number;
  website?: string;
  lastUpdated: number;
}

export class AssetMapperService {
  private mappings: Map<AssetID, AssetMapping> = new Map();
  private addressToCanonical: Map<string, AssetID> = new Map(); // chain:address -> canonicalId
  private redis: RedisManager;
  private _isInitialized = false;

  constructor() {
    this.redis = RedisManager.getInstance({
      host: process.env['REDIS_HOST'] || 'localhost',
      port: parseInt(process.env['REDIS_PORT'] || '6379'),
      keyPrefix: 'asset-mapping:',
    });
  }

  async initialize(): Promise<void> {
    try {
      await this.redis.connect();
      await this.loadDefaultMappings();
      await this.loadCustomMappings();
      
      this._isInitialized = true;
      logger.info(`Asset Mapper initialized with ${this.mappings.size} assets`);
    } catch (error) {
      logger.error('Failed to initialize Asset Mapper:', error);
      throw error;
    }
  }

  private async loadDefaultMappings(): Promise<void> {
    // Load common cross-chain assets
    const defaultMappings: AssetMapping[] = [
      {
        canonicalId: 'ETH',
        name: 'Ethereum',
        symbol: 'ETH',
        decimals: 18,
        chainMappings: new Map([
          ['ethereum', {
            chainId: 'ethereum',
            address: '0x0000000000000000000000000000000000000000',
            symbol: 'ETH',
            decimals: 18,
            isNative: true,
            isWrapped: false,
            wrappedVersion: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', // WETH
          }],
          ['polygon', {
            chainId: 'polygon',
            address: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            symbol: 'ETH',
            decimals: 18,
            isNative: false,
            isWrapped: true,
          }],
          ['arbitrum', {
            chainId: 'arbitrum',
            address: '0x0000000000000000000000000000000000000000',
            symbol: 'ETH',
            decimals: 18,
            isNative: true,
            isWrapped: false,
            wrappedVersion: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1', // WETH
          }],
          ['optimism', {
            chainId: 'optimism',
            address: '0x0000000000000000000000000000000000000000',
            symbol: 'ETH',
            decimals: 18,
            isNative: true,
            isWrapped: false,
            wrappedVersion: '0x4200000000000000000000000000000000000006', // WETH
          }],
        ]),
        bridges: [
          {
            bridgeId: 'polygon-bridge',
            sourceChain: 'ethereum',
            targetChain: 'polygon',
            sourceAddress: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
            targetAddress: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            bridgeType: 'canonical',
          },
        ],
        metadata: {
          coingeckoId: 'ethereum',
          categories: ['native', 'layer1'],
          lastUpdated: Date.now(),
        },
      },
      {
        canonicalId: 'USDC',
        name: 'USD Coin',
        symbol: 'USDC',
        decimals: 6,
        chainMappings: new Map([
          ['ethereum', {
            chainId: 'ethereum',
            address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
            symbol: 'USDC',
            decimals: 6,
            isNative: false,
            isWrapped: false,
          }],
          ['polygon', {
            chainId: 'polygon',
            address: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            symbol: 'USDC',
            decimals: 6,
            isNative: false,
            isWrapped: false,
          }],
          ['arbitrum', {
            chainId: 'arbitrum',
            address: '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8',
            symbol: 'USDC',
            decimals: 6,
            isNative: false,
            isWrapped: false,
          }],
          ['optimism', {
            chainId: 'optimism',
            address: '0x7F5c764cBc14f9669B88837ca1490cCa17c31607',
            symbol: 'USDC',
            decimals: 6,
            isNative: false,
            isWrapped: false,
          }],
          ['avalanche', {
            chainId: 'avalanche',
            address: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E',
            symbol: 'USDC',
            decimals: 6,
            isNative: false,
            isWrapped: false,
          }],
        ]),
        bridges: [],
        metadata: {
          coingeckoId: 'usd-coin',
          categories: ['stablecoin'],
          lastUpdated: Date.now(),
        },
      },
      {
        canonicalId: 'WBTC',
        name: 'Wrapped Bitcoin',
        symbol: 'WBTC',
        decimals: 8,
        chainMappings: new Map([
          ['ethereum', {
            chainId: 'ethereum',
            address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
            symbol: 'WBTC',
            decimals: 8,
            isNative: false,
            isWrapped: true,
          }],
          ['polygon', {
            chainId: 'polygon',
            address: '0x1bfd67037b42cf73acF2047067bd4F2C47D9BfD6',
            symbol: 'WBTC',
            decimals: 8,
            isNative: false,
            isWrapped: true,
          }],
          ['arbitrum', {
            chainId: 'arbitrum',
            address: '0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f',
            symbol: 'WBTC',
            decimals: 8,
            isNative: false,
            isWrapped: true,
          }],
        ]),
        bridges: [],
        metadata: {
          coingeckoId: 'wrapped-bitcoin',
          categories: ['wrapped', 'bitcoin'],
          lastUpdated: Date.now(),
        },
      },
      {
        canonicalId: 'MATIC',
        name: 'Polygon',
        symbol: 'MATIC',
        decimals: 18,
        chainMappings: new Map([
          ['polygon', {
            chainId: 'polygon',
            address: '0x0000000000000000000000000000000000000000',
            symbol: 'MATIC',
            decimals: 18,
            isNative: true,
            isWrapped: false,
            wrappedVersion: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270', // WMATIC
          }],
          ['ethereum', {
            chainId: 'ethereum',
            address: '0x7D1AfA7B718fb893dB30A3aBc0Cfc608AaCfeBB0',
            symbol: 'MATIC',
            decimals: 18,
            isNative: false,
            isWrapped: false,
          }],
        ]),
        bridges: [],
        metadata: {
          coingeckoId: 'matic-network',
          categories: ['native', 'layer2'],
          lastUpdated: Date.now(),
        },
      },
    ];

    // Store mappings
    for (const mapping of defaultMappings) {
      this.mappings.set(mapping.canonicalId, mapping);
      
      // Create address lookup
      for (const [chainId, info] of mapping.chainMappings) {
        const key = `${chainId}:${info.address.toLowerCase()}`;
        this.addressToCanonical.set(key, mapping.canonicalId);
        
        // Also map wrapped version if exists
        if (info.wrappedVersion) {
          const wrappedKey = `${chainId}:${info.wrappedVersion.toLowerCase()}`;
          this.addressToCanonical.set(wrappedKey, mapping.canonicalId);
        }
      }
    }
  }

  private async loadCustomMappings(): Promise<void> {
    try {
      // Load any custom mappings from Redis
      // Note: keys method not available in current RedisManager implementation
      // Custom mappings would need to be loaded through a different mechanism
      logger.info('Custom mapping loading mechanism needs implementation');
    } catch (error) {
      logger.error('Failed to load custom mappings:', error);
    }
  }

  // Note: Currently unused but kept for future Redis deserialization needs
  // private deserializeMapping(data: any): AssetMapping {
  //   return {
  //     ...data,
  //     chainMappings: new Map(Object.entries(data.chainMappings)),
  //   };
  // }

  private serializeMapping(mapping: AssetMapping): any {
    return {
      ...mapping,
      chainMappings: Object.fromEntries(mapping.chainMappings),
    };
  }

  async getAssetMapping(canonicalId: AssetID): Promise<AssetMapping | null> {
    return this.mappings.get(canonicalId) || null;
  }

  async getAssetByAddress(chainId: ChainID, address: string): Promise<AssetMapping | null> {
    const key = `${chainId}:${address.toLowerCase()}`;
    const canonicalId = this.addressToCanonical.get(key);
    
    if (!canonicalId) {
      return null;
    }
    
    return this.mappings.get(canonicalId) || null;
  }

  async getEquivalentAssets(
    chainId: ChainID,
    address: string
  ): Promise<Map<ChainID, ChainAssetInfo>> {
    const mapping = await this.getAssetByAddress(chainId, address);
    
    if (!mapping) {
      return new Map();
    }
    
    return mapping.chainMappings;
  }

  async findArbitragePaths(
    assetId: AssetID,
    sourceChain: ChainID,
    targetChain: ChainID
  ): Promise<BridgeMapping[]> {
    const mapping = await this.getAssetMapping(assetId);
    if (!mapping) {
      return [];
    }

    // Direct bridge paths
    const directPaths = mapping.bridges.filter(
      b => b.sourceChain === sourceChain && b.targetChain === targetChain
    );

    // TODO: Implement multi-hop bridge path finding
    
    return directPaths;
  }

  isWrappedAsset(chainId: ChainID, address: string): boolean {
    const key = `${chainId}:${address.toLowerCase()}`;
    const canonicalId = this.addressToCanonical.get(key);
    
    if (!canonicalId) {
      return false;
    }
    
    const mapping = this.mappings.get(canonicalId);
    if (!mapping) {
      return false;
    }
    
    const chainInfo = mapping.chainMappings.get(chainId);
    return chainInfo?.isWrapped || false;
  }

  async getWrappedVersion(chainId: ChainID, nativeAddress: string): Promise<string | null> {
    const mapping = await this.getAssetByAddress(chainId, nativeAddress);
    if (!mapping) {
      return null;
    }
    
    const chainInfo = mapping.chainMappings.get(chainId);
    return chainInfo?.wrappedVersion || null;
  }

  async getNativeVersion(chainId: ChainID, wrappedAddress: string): Promise<string | null> {
    const mapping = await this.getAssetByAddress(chainId, wrappedAddress);
    if (!mapping) {
      return null;
    }
    
    const chainInfo = mapping.chainMappings.get(chainId);
    return chainInfo?.nativeVersion || null;
  }

  async addCustomMapping(mapping: AssetMapping): Promise<void> {
    // Validate mapping
    if (!mapping.canonicalId || mapping.chainMappings.size === 0) {
      throw new Error('Invalid asset mapping');
    }

    // Store in memory
    this.mappings.set(mapping.canonicalId, mapping);
    
    // Update address lookup
    for (const [chainId, info] of mapping.chainMappings) {
      const key = `${chainId}:${info.address.toLowerCase()}`;
      this.addressToCanonical.set(key, mapping.canonicalId);
    }

    // Persist to Redis
    await this.redis.set(
      `custom:${mapping.canonicalId}`,
      JSON.stringify(this.serializeMapping(mapping)),
      { ttl: 86400 * 30 } // 30 days
    );

    logger.info(`Added custom mapping for ${mapping.canonicalId}`);
  }

  async updateAssetMetadata(canonicalId: AssetID, metadata: Partial<AssetMetadata>): Promise<void> {
    const mapping = this.mappings.get(canonicalId);
    if (!mapping) {
      throw new Error(`Asset ${canonicalId} not found`);
    }

    mapping.metadata = {
      ...mapping.metadata,
      ...metadata,
      lastUpdated: Date.now(),
    };

    // Update in Redis if custom mapping
    if (await this.redis.exists(`custom:${canonicalId}`)) {
      await this.redis.set(
        `custom:${canonicalId}`,
        JSON.stringify(this.serializeMapping(mapping)),
        { ttl: 86400 * 30 }
      );
    }
  }

  getAssetStats(): {
    totalAssets: number;
    totalChains: number;
    wrappedAssets: number;
    nativeAssets: number;
    bridgeMappings: number;
  } {
    let wrappedAssets = 0;
    let nativeAssets = 0;
    let totalBridges = 0;
    const chains = new Set<ChainID>();

    for (const mapping of this.mappings.values()) {
      totalBridges += mapping.bridges.length;
      
      for (const [chainId, info] of mapping.chainMappings) {
        chains.add(chainId);
        if (info.isWrapped) wrappedAssets++;
        if (info.isNative) nativeAssets++;
      }
    }

    return {
      totalAssets: this.mappings.size,
      totalChains: chains.size,
      wrappedAssets,
      nativeAssets,
      bridgeMappings: totalBridges,
    };
  }

  async searchAssets(query: string): Promise<AssetMapping[]> {
    const results: AssetMapping[] = [];
    const lowerQuery = query.toLowerCase();

    for (const mapping of this.mappings.values()) {
      if (
        mapping.canonicalId.toLowerCase().includes(lowerQuery) ||
        mapping.name.toLowerCase().includes(lowerQuery) ||
        mapping.symbol.toLowerCase().includes(lowerQuery)
      ) {
        results.push(mapping);
      }
    }

    return results;
  }
}