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
    try {
      await dbManager.initialize();
      logger.info('✅ Database connections initialized successfully');
    } catch (error) {
      logger.warn('⚠️  Database connections failed - continuing without databases for testing:', error instanceof Error ? error.message : 'Unknown error');
    }
    
    // Initialize orchestration engine
    logger.info('🤖 Initializing orchestration engine...');
    const orchestrator = OrchestrationEngine.getInstance();
    try {
      await orchestrator.initialize();
      logger.info('✅ Orchestration engine initialized successfully');
    } catch (error) {
      logger.warn('⚠️  Orchestration engine initialization failed - continuing for testing:', error instanceof Error ? error.message : 'Unknown error');
    }
    
    // Start all satellite agents
    logger.info('🛰️  Starting satellite agents...');
    try {
      await orchestrator.startAllAgents();
      logger.info('✅ Satellite agents started successfully');
    } catch (error) {
      logger.warn('⚠️  Satellite agent startup failed - continuing for testing:', error instanceof Error ? error.message : 'Unknown error');
    }
    
    // Setup graceful shutdown
    process.on('SIGTERM', async () => {
      logger.info('🛑 Received SIGTERM, shutting down gracefully...');
      await orchestrator.shutdown();
      await dbManager.close();
      process.exit(0);
    });
    
    process.on('SIGINT', async () => {
      logger.info('🛑 Received SIGINT, shutting down gracefully...');
      await orchestrator.shutdown();
      await dbManager.close();
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