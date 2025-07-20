/**
 * YieldSensei Multi-Agent DeFi Investment Advisor
 * Main application entry point
 */


import { OrchestrationEngine } from './core/orchestration/engine';
import { DatabaseManager } from './shared/database/manager';
import Logger from "./shared/logging/logger";

const logger = Logger.getLogger('main');

async function main() {
  try {
    logger.info('🚀 Starting YieldSensei Multi-Agent System');
    
    // Initialize database connections
    logger.info('📊 Initializing database connections...');
    const dbManager = DatabaseManager.getInstance();
    await dbManager.initialize();
    
    // Initialize orchestration engine
    logger.info('🤖 Initializing orchestration engine...');
    const orchestrator = OrchestrationEngine.getInstance();
    await orchestrator.initialize();
    
    // Start all satellite agents
    logger.info('🛰️  Starting satellite agents...');
    await orchestrator.startAllAgents();
    
    // Setup graceful shutdown
    process.on('SIGTERM', async () => {
      logger.info('🛑 Received SIGTERM, shutting down gracefully...');
      await orchestrator.shutdown();
      await dbManager.disconnect();
      process.exit(0);
    });
    
    process.on('SIGINT', async () => {
      logger.info('🛑 Received SIGINT, shutting down gracefully...');
      await orchestrator.shutdown();
      await dbManager.disconnect();
      process.exit(0);
    });
    
    logger.info('✅ YieldSensei is running successfully');
    
  } catch (error) {
    logger.error('❌ Failed to start YieldSensei:', error);
    process.exit(1);
  }
}

// Start the application
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});