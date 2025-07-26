import { EventEmitter } from 'events';

// Qdrant-compatible interfaces
interface QdrantPoint {
  id: string | number;
  vector: number[] | Record<string, number[]>;
  payload?: Record<string, any>;
}

interface SearchResult {
  id: string | number;
  score: number;
  payload?: Record<string, any>;
  vector?: number[];
}

interface CollectionInfo {
  name: string;
  status: string;
  points_count?: number;
  segments_count?: number;
  config?: {
    params: {
      vectors: {
        size: number;
        distance: string;
      };
    };
  };
}

interface SearchParams {
  vector: number[];
  limit?: number;
  score_threshold?: number;
  filter?: Record<string, any>;
  with_payload?: boolean;
  with_vector?: boolean;
  params?: {
    hnsw_ef?: number;
    exact?: boolean;
  };
}

interface VectorConfig {
  host: string;
  port: number;
  apiKey?: string;
  timeout?: number;
  https?: boolean;
}

interface CollectionSchema {
  name: string;
  vectors: {
    size: number;
    distance: 'Cosine' | 'Euclidean' | 'Dot';
  };
  shard_number?: number;
  replication_factor?: number;
  write_consistency_factor?: number;
  on_disk_payload?: boolean;
  hnsw_config?: {
    m?: number;
    ef_construct?: number;
    full_scan_threshold?: number;
    max_indexing_threads?: number;
  };
  optimizers_config?: {
    deleted_threshold?: number;
    vacuum_min_vector_number?: number;
    default_segment_number?: number;
    max_segment_size?: number;
    memmap_threshold?: number;
    indexing_threshold?: number;
    flush_interval_sec?: number;
    max_optimization_threads?: number;
  };
}

// Simple logger interface
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
 * Vector Database Manager for YieldSensei DeFi Platform
 * 
 * Handles embeddings storage, similarity searches, and ML model management
 * using Qdrant vector database for high-performance semantic search.
 */
export class VectorManager extends EventEmitter {
  private static instance: VectorManager;
  private config: VectorConfig;
  private logger: Logger;
  private isConnected = false;
  private baseUrl: string;

  // Collection schemas for different types of embeddings
  private readonly collectionSchemas: Record<string, CollectionSchema> = {
    // Protocol embeddings for semantic search
    protocols: {
      name: 'protocols',
      vectors: {
        size: 384, // sentence-transformers/all-MiniLM-L6-v2 dimension
        distance: 'Cosine',
      },
      shard_number: 1,
      replication_factor: 1,
      on_disk_payload: true,
      hnsw_config: {
        m: 16,
        ef_construct: 100,
        full_scan_threshold: 10000,
        max_indexing_threads: 0,
      },
      optimizers_config: {
        deleted_threshold: 0.2,
        vacuum_min_vector_number: 1000,
        default_segment_number: 0,
        max_segment_size: 5242880, // 5GB
        memmap_threshold: 1048576, // 1GB
        indexing_threshold: 2097152, // 2GB
        flush_interval_sec: 5,
        max_optimization_threads: 1,
      },
    },

    // Token embeddings for financial analysis
    tokens: {
      name: 'tokens',
      vectors: {
        size: 384,
        distance: 'Cosine',
      },
      shard_number: 1,
      replication_factor: 1,
      on_disk_payload: true,
      hnsw_config: {
        m: 16,
        ef_construct: 100,
        full_scan_threshold: 10000,
      },
    },

    // User behavior embeddings for personalization
    user_behavior: {
      name: 'user_behavior',
      vectors: {
        size: 256, // Smaller dimension for user behavior patterns
        distance: 'Cosine',
      },
      shard_number: 1,
      replication_factor: 1,
      on_disk_payload: true,
      hnsw_config: {
        m: 16,
        ef_construct: 200,
        full_scan_threshold: 5000,
      },
    },

    // Strategy embeddings for yield farming recommendations
    strategies: {
      name: 'strategies',
      vectors: {
        size: 512, // Larger dimension for complex strategy representations
        distance: 'Cosine',
      },
      shard_number: 1,
      replication_factor: 1,
      on_disk_payload: true,
      hnsw_config: {
        m: 16,
        ef_construct: 200,
        full_scan_threshold: 10000,
      },
    },

    // Document embeddings for knowledge base
    documents: {
      name: 'documents',
      vectors: {
        size: 384,
        distance: 'Cosine',
      },
      shard_number: 1,
      replication_factor: 1,
      on_disk_payload: true,
      hnsw_config: {
        m: 16,
        ef_construct: 100,
        full_scan_threshold: 20000,
      },
    },
  };

  private constructor(config: VectorConfig) {
    super();
    this.config = config;
    this.logger = new SimpleLogger('VectorManager');
    
    const protocol = config.https ? 'https' : 'http';
    this.baseUrl = `${protocol}://${config.host}:${config.port}`;
  }

  public static getInstance(config?: VectorConfig): VectorManager {
    if (!VectorManager.instance) {
      if (!config) {
        throw new Error('Vector database configuration is required for first initialization');
      }
      VectorManager.instance = new VectorManager(config);
    }
    return VectorManager.instance;
  }

  /**
   * Connect to Qdrant vector database
   */
  public async connect(): Promise<void> {
    try {
      this.logger.info('Connecting to Qdrant vector database...');
      
      // Test connection by getting cluster info
      const response = await this.makeRequest('GET', '/cluster');
      
      if (response.ok) {
        this.isConnected = true;
        this.logger.info('Successfully connected to Qdrant vector database');
        this.emit('connected');
        
        // Initialize collections
        await this.initializeCollections();
      } else {
        throw new Error(`Connection failed with status: ${response.status}`);
      }
    } catch (error) {
      this.logger.error('Failed to connect to Qdrant:', error);
      this.isConnected = false;
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Health check for vector database
   */
  public async healthCheck(): Promise<{ status: string; info?: any }> {
    if (!this.isConnected) {
      return { status: 'disconnected' };
    }

    try {
      const response = await this.makeRequest('GET', '/');
      
      if (response.ok) {
        const info = await response.json();
        return { status: 'healthy', info };
      } else {
        return { status: 'unhealthy' };
      }
    } catch (error) {
      this.logger.error('Health check failed:', error);
      return { status: 'error' };
    }
  }

  /**
   * Initialize all predefined collections
   */
  private async initializeCollections(): Promise<void> {
    this.logger.info('Initializing vector collections...');
    
    try {
      // Get existing collections
      const collections = await this.listCollections();
      const existingNames = collections.map(c => c.name);
      
      // Create missing collections
      for (const [name, schema] of Object.entries(this.collectionSchemas)) {
        if (!existingNames.includes(name)) {
          await this.createCollection(schema);
          this.logger.info(`Created collection: ${name}`);
        } else {
          this.logger.debug(`Collection already exists: ${name}`);
        }
      }
      
      this.logger.info('Vector collections initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize collections:', error);
      throw error;
    }
  }

  /**
   * Create a new collection
   */
  public async createCollection(schema: CollectionSchema): Promise<boolean> {
    try {
      const response = await this.makeRequest('PUT', `/collections/${schema.name}`, {
        vectors: schema.vectors,
        shard_number: schema.shard_number,
        replication_factor: schema.replication_factor,
        write_consistency_factor: schema.write_consistency_factor,
        on_disk_payload: schema.on_disk_payload,
        hnsw_config: schema.hnsw_config,
        optimizers_config: schema.optimizers_config,
      });
      
      return response.ok;
    } catch (error) {
      this.logger.error(`Failed to create collection ${schema.name}:`, error);
      return false;
    }
  }

  /**
   * List all collections
   */
  public async listCollections(): Promise<CollectionInfo[]> {
    try {
      const response = await this.makeRequest('GET', '/collections');
      
      if (response.ok) {
        const data = await response.json() as any;
        return data.result?.collections || [];
      }
      
      return [];
    } catch (error) {
      this.logger.error('Failed to list collections:', error);
      return [];
    }
  }

  /**
   * Get collection information
   */
  public async getCollectionInfo(collectionName: string): Promise<CollectionInfo | null> {
    try {
      const response = await this.makeRequest('GET', `/collections/${collectionName}`);
      
      if (response.ok) {
        const data = await response.json() as any;
        return data.result;
      }
      
      return null;
    } catch (error) {
      this.logger.error(`Failed to get collection info for ${collectionName}:`, error);
      return null;
    }
  }

  /**
   * Upsert points into a collection
   */
  public async upsertPoints(
    collectionName: string,
    points: QdrantPoint[]
  ): Promise<boolean> {
    try {
      const response = await this.makeRequest('PUT', `/collections/${collectionName}/points`, {
        points,
      });
      
      return response.ok;
    } catch (error) {
      this.logger.error(`Failed to upsert points to ${collectionName}:`, error);
      return false;
    }
  }

  /**
   * Search for similar vectors
   */
  public async search(
    collectionName: string,
    params: SearchParams
  ): Promise<SearchResult[]> {
    try {
      const response = await this.makeRequest('POST', `/collections/${collectionName}/points/search`, {
        vector: params.vector,
        limit: params.limit || 10,
        score_threshold: params.score_threshold,
        filter: params.filter,
        with_payload: params.with_payload !== false,
        with_vector: params.with_vector || false,
        params: params.params,
      });
      
      if (response.ok) {
        const data = await response.json();
        return data.result || [];
      }
      
      return [];
    } catch (error) {
      this.logger.error(`Failed to search in ${collectionName}:`, error);
      return [];
    }
  }

  /**
   * Get points by IDs
   */
  public async getPoints(
    collectionName: string,
    ids: (string | number)[],
    withVector = false
  ): Promise<QdrantPoint[]> {
    try {
      const response = await this.makeRequest('POST', `/collections/${collectionName}/points`, {
        ids,
        with_vector: withVector,
        with_payload: true,
      });
      
      if (response.ok) {
        const data = await response.json();
        return data.result || [];
      }
      
      return [];
    } catch (error) {
      this.logger.error(`Failed to get points from ${collectionName}:`, error);
      return [];
    }
  }

  /**
   * Delete points by IDs
   */
  public async deletePoints(
    collectionName: string,
    ids: (string | number)[]
  ): Promise<boolean> {
    try {
      const response = await this.makeRequest('POST', `/collections/${collectionName}/points/delete`, {
        points: ids,
      });
      
      return response.ok;
    } catch (error) {
      this.logger.error(`Failed to delete points from ${collectionName}:`, error);
      return false;
    }
  }

  /**
   * Semantic search for protocols
   */
  public async searchProtocols(
    query: string | number[],
    limit = 10,
    filter?: Record<string, any>
  ): Promise<SearchResult[]> {
    // If query is a string, you would need to generate embeddings first
    // For now, assuming the query is already an embedding vector
    if (typeof query === 'string') {
      throw new Error('String queries require embedding generation - pass vector array instead');
    }

    return this.search('protocols', {
      vector: query,
      limit,
      filter,
      score_threshold: 0.7, // Minimum similarity threshold
    });
  }

  /**
   * Semantic search for strategies
   */
  public async searchStrategies(
    queryVector: number[],
    riskLevel?: string,
    minApy?: number,
    limit = 10
  ): Promise<SearchResult[]> {
    const filter: Record<string, any> = {};
    
    if (riskLevel) {
      filter.risk_level = riskLevel;
    }
    
    if (minApy) {
      filter.apy = { gte: minApy };
    }

    return this.search('strategies', {
      vector: queryVector,
      limit,
      filter: Object.keys(filter).length > 0 ? filter : undefined,
      score_threshold: 0.6,
    });
  }

  /**
   * Find similar user behaviors for personalization
   */
  public async findSimilarUsers(
    userBehaviorVector: number[],
    limit = 20
  ): Promise<SearchResult[]> {
    return this.search('user_behavior', {
      vector: userBehaviorVector,
      limit,
      score_threshold: 0.8, // High threshold for user similarity
      with_payload: true,
    });
  }

  /**
   * Search documents in knowledge base
   */
  public async searchDocuments(
    queryVector: number[],
    category?: string,
    limit = 5
  ): Promise<SearchResult[]> {
    const filter = category ? { category } : undefined;

    return this.search('documents', {
      vector: queryVector,
      limit,
      filter,
      score_threshold: 0.5,
      with_payload: true,
    });
  }

  /**
   * Batch upsert for protocols
   */
  public async upsertProtocols(protocols: Array<{
    id: string;
    name: string;
    description: string;
    category: string;
    tvl: number;
    apy: number;
    riskScore: number;
    embedding: number[];
  }>): Promise<boolean> {
    const points: QdrantPoint[] = protocols.map(protocol => ({
      id: protocol.id,
      vector: protocol.embedding,
      payload: {
        name: protocol.name,
        description: protocol.description,
        category: protocol.category,
        tvl: protocol.tvl,
        apy: protocol.apy,
        risk_score: protocol.riskScore,
        indexed_at: Date.now(),
      },
    }));

    return this.upsertPoints('protocols', points);
  }

  /**
   * Batch upsert for strategies
   */
  public async upsertStrategies(strategies: Array<{
    id: string;
    name: string;
    description: string;
    protocols: string[];
    riskLevel: string;
    expectedApy: number;
    complexity: number;
    embedding: number[];
  }>): Promise<boolean> {
    const points: QdrantPoint[] = strategies.map(strategy => ({
      id: strategy.id,
      vector: strategy.embedding,
      payload: {
        name: strategy.name,
        description: strategy.description,
        protocols: strategy.protocols,
        risk_level: strategy.riskLevel,
        apy: strategy.expectedApy,
        complexity: strategy.complexity,
        indexed_at: Date.now(),
      },
    }));

    return this.upsertPoints('strategies', points);
  }

  /**
   * Get collection statistics
   */
  public async getCollectionStats(): Promise<Record<string, any>> {
    const stats: Record<string, any> = {};
    
    try {
      for (const collectionName of Object.keys(this.collectionSchemas)) {
        const info = await this.getCollectionInfo(collectionName);
        if (info) {
          stats[collectionName] = {
            points_count: info.points_count || 0,
            segments_count: info.segments_count || 0,
            status: info.status,
          };
        }
      }
      
      return stats;
    } catch (error) {
      this.logger.error('Failed to get collection stats:', error);
      return {};
    }
  }

  /**
   * Create a snapshot for backup
   */
  public async createSnapshot(collectionName?: string): Promise<string | null> {
    try {
      const endpoint = collectionName 
        ? `/collections/${collectionName}/snapshots`
        : '/snapshots';
        
      const response = await this.makeRequest('POST', endpoint);
      
      if (response.ok) {
        const data = await response.json();
        return data.result?.name || null;
      }
      
      return null;
    } catch (error) {
      this.logger.error('Failed to create snapshot:', error);
      return null;
    }
  }

  /**
   * List available snapshots
   */
  public async listSnapshots(collectionName?: string): Promise<string[]> {
    try {
      const endpoint = collectionName 
        ? `/collections/${collectionName}/snapshots`
        : '/snapshots';
        
      const response = await this.makeRequest('GET', endpoint);
      
      if (response.ok) {
        const data = await response.json();
        return data.result || [];
      }
      
      return [];
    } catch (error) {
      this.logger.error('Failed to list snapshots:', error);
      return [];
    }
  }

  /**
   * Disconnect from vector database
   */
  public async disconnect(): Promise<void> {
    this.isConnected = false;
    this.logger.info('Disconnected from vector database');
    this.emit('disconnected');
  }

  /**
   * Check if connected to vector database
   */
  public isConnectedToVector(): boolean {
    return this.isConnected;
  }

  /**
   * Make HTTP request to Qdrant API
   */
  private async makeRequest(
    method: string,
    endpoint: string,
    body?: any
  ): Promise<Response> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.config.apiKey) {
      headers['api-key'] = this.config.apiKey;
    }

    const options: RequestInit = {
      method,
      headers,
      signal: AbortSignal.timeout(this.config.timeout || 30000),
    };

    if (body && method !== 'GET') {
      options.body = JSON.stringify(body);
    }

    return fetch(url, options);
  }
}

export type {
  VectorConfig,
  CollectionSchema,
  QdrantPoint,
  SearchResult,
  SearchParams,
  CollectionInfo,
}; 