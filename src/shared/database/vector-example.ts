/**
 * Vector Database Usage Examples for YieldSensei
 * 
 * This file demonstrates how to use the VectorManager for various
 * DeFi-related semantic search and embedding operations.
 */

import { DatabaseManager } from './manager';
import { VectorManager } from './vector-manager';

/**
 * Example: Protocol Semantic Search
 */
export async function searchSimilarProtocols() {
  try {
    const dbManager = DatabaseManager.getInstance();
    const vectorManager = dbManager.getVector();

    // Example: Search for lending protocols similar to Aave
    const aaveEmbedding = [
      // This would be a real 384-dimensional embedding vector
      // generated from Aave's description and metadata
      0.1, 0.2, -0.15, 0.8, /* ... 380 more values */
    ];

    const similarProtocols = await vectorManager.searchProtocols(
      aaveEmbedding,
      5, // limit to top 5 results
      { 
        category: 'lending',
        risk_score: { lte: 0.5 } // low to medium risk only
      }
    );

    console.log('Protocols similar to Aave:', similarProtocols);
    return similarProtocols;
  } catch (error) {
    console.error('Error searching protocols:', error);
    throw error;
  }
}

/**
 * Example: Yield Strategy Recommendations
 */
export async function recommendStrategies(userRiskProfile: string, targetApy: number) {
  try {
    const dbManager = DatabaseManager.getInstance();
    const vectorManager = dbManager.getVector();

    // User preference embedding based on historical behavior
    const userPreferenceVector = [
      // 512-dimensional embedding representing user's preferences
      0.3, -0.1, 0.7, /* ... 509 more values */
    ];

    const strategies = await vectorManager.searchStrategies(
      userPreferenceVector,
      userRiskProfile, // 'low', 'medium', 'high'
      targetApy // minimum APY threshold
    );

    console.log(`Recommended strategies for ${userRiskProfile} risk, ${targetApy}% APY:`, strategies);
    return strategies;
  } catch (error) {
    console.error('Error recommending strategies:', error);
    throw error;
  }
}

/**
 * Example: User Behavior Analysis
 */
export async function findSimilarUsers(userId: string) {
  try {
    const dbManager = DatabaseManager.getInstance();
    const vectorManager = dbManager.getVector();

    // Get user's behavior embedding from analytics
    const userBehaviorVector = await getUserBehaviorEmbedding(userId);

    const similarUsers = await vectorManager.findSimilarUsers(
      userBehaviorVector,
      20 // find top 20 similar users
    );

    console.log(`Users similar to ${userId}:`, similarUsers);
    return similarUsers;
  } catch (error) {
    console.error('Error finding similar users:', error);
    throw error;
  }
}

/**
 * Example: Knowledge Base Search
 */
export async function searchDocuments(query: string) {
  try {
    const dbManager = DatabaseManager.getInstance();
    const vectorManager = dbManager.getVector();

    // Convert text query to embedding (would use actual embedding service)
    const queryEmbedding = await generateTextEmbedding(query);

    const relevantDocs = await vectorManager.searchDocuments(
      queryEmbedding,
      undefined, // no category filter
      5 // top 5 relevant documents
    );

    console.log(`Documents relevant to "${query}":`, relevantDocs);
    return relevantDocs;
  } catch (error) {
    console.error('Error searching documents:', error);
    throw error;
  }
}

/**
 * Example: Batch Protocol Ingestion
 */
export async function ingestProtocolData(protocols: any[]) {
  try {
    const dbManager = DatabaseManager.getInstance();
    const vectorManager = dbManager.getVector();

    // Transform protocol data for vector storage
    const protocolEmbeddings = await Promise.all(
      protocols.map(async (protocol) => ({
        id: protocol.id,
        name: protocol.name,
        description: protocol.description,
        category: protocol.category,
        tvl: protocol.tvl,
        apy: protocol.apy,
        riskScore: protocol.riskScore,
        embedding: await generateTextEmbedding(
          `${protocol.name} ${protocol.description} ${protocol.category}`
        )
      }))
    );

    const success = await vectorManager.upsertProtocols(protocolEmbeddings);
    
    if (success) {
      console.log(`Successfully ingested ${protocols.length} protocols`);
    } else {
      console.error('Failed to ingest protocol data');
    }

    return success;
  } catch (error) {
    console.error('Error ingesting protocols:', error);
    throw error;
  }
}

/**
 * Example: Strategy Performance Analysis
 */
export async function analyzeStrategyPerformance() {
  try {
    const dbManager = DatabaseManager.getInstance();
    const vectorManager = dbManager.getVector();

    // Get collection statistics
    const stats = await vectorManager.getCollectionStats();
    
    console.log('Vector database statistics:', stats);

    // Check health status
    const health = await vectorManager.healthCheck();
    console.log('Vector database health:', health);

    return { stats, health };
  } catch (error) {
    console.error('Error analyzing performance:', error);
    throw error;
  }
}

/**
 * Example: Backup and Maintenance
 */
export async function performMaintenance() {
  try {
    const dbManager = DatabaseManager.getInstance();
    const vectorManager = dbManager.getVector();

    // Create snapshots for all collections
    const collections = ['protocols', 'strategies', 'tokens', 'user_behavior', 'documents'];
    const snapshots = [];

    for (const collection of collections) {
      const snapshotName = await vectorManager.createSnapshot(collection);
      if (snapshotName) {
        snapshots.push({ collection, snapshot: snapshotName });
        console.log(`Created snapshot for ${collection}: ${snapshotName}`);
      }
    }

    // List all available snapshots
    const allSnapshots = await vectorManager.listSnapshots();
    console.log('Available snapshots:', allSnapshots);

    return { snapshots, allSnapshots };
  } catch (error) {
    console.error('Error during maintenance:', error);
    throw error;
  }
}

// Helper functions (would be implemented with actual embedding services)
async function getUserBehaviorEmbedding(userId: string): Promise<number[]> {
  // This would fetch user behavior data and convert to embedding
  // For example: transaction patterns, protocol preferences, risk tolerance
  return new Array(256).fill(0).map(() => Math.random() - 0.5);
}

async function generateTextEmbedding(text: string): Promise<number[]> {
  // This would use a text embedding service like OpenAI, Sentence Transformers, etc.
  // For example: sentence-transformers/all-MiniLM-L6-v2
  return new Array(384).fill(0).map(() => Math.random() - 0.5);
}

/**
 * Complete workflow example: New protocol onboarding
 */
export async function onboardNewProtocol(protocolData: {
  id: string;
  name: string;
  description: string;
  category: string;
  website: string;
  tvl: number;
  apy: number;
  riskScore: number;
}) {
  try {
    const dbManager = DatabaseManager.getInstance();
    const vectorManager = dbManager.getVector();

    console.log(`Onboarding new protocol: ${protocolData.name}`);

    // 1. Generate embedding for the protocol
    const embedding = await generateTextEmbedding(
      `${protocolData.name} ${protocolData.description} ${protocolData.category} DeFi protocol`
    );

    // 2. Store in vector database
    const success = await vectorManager.upsertProtocols([{
      ...protocolData,
      embedding
    }]);

    if (!success) {
      throw new Error('Failed to store protocol in vector database');
    }

    // 3. Find similar existing protocols
    const similarProtocols = await vectorManager.searchProtocols(
      embedding,
      5,
      { category: protocolData.category }
    );

    // 4. Generate recommendations based on similarity
    const recommendations = similarProtocols.map(result => ({
      id: result.id,
      similarity: result.score,
      payload: result.payload
    }));

    console.log(`Successfully onboarded ${protocolData.name}`);
    console.log('Similar protocols found:', recommendations);

    return {
      success: true,
      protocol: protocolData,
      similarProtocols: recommendations
    };

  } catch (error) {
    console.error(`Error onboarding protocol ${protocolData.name}:`, error);
    throw error;
  }
}

// All functions are already exported individually above 