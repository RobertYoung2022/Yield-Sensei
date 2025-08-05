/**
 * YieldSensei Multi-Agent DeFi Investment Advisor
 * Main application entry point - MVP version
 */

import { getLogger } from "./shared/utils/logger";

const logger = getLogger('main');

async function main() {
  try {
    logger.info('🚀 Starting YieldSensei MVP API Server');
    
    // For MVP, we just start the API server
    // The API server is defined in src/api/index.ts and will auto-start
    logger.info('📡 API Server starting automatically from src/api/index.ts');
    
    // Import and run the API server
    await import('./api/index');
    
    // Keep the process alive
    logger.info('✅ YieldSensei MVP is running successfully');
    
    // Setup graceful shutdown
    process.on('SIGTERM', () => {
      logger.info('🛑 Received SIGTERM, shutting down gracefully...');
      process.exit(0);
    });
    
    process.on('SIGINT', () => {
      logger.info('🛑 Received SIGINT, shutting down gracefully...');
      process.exit(0);
    });
    
  } catch (error) {
    logger.error('❌ Failed to start YieldSensei MVP:', undefined, error as Error);
    process.exit(1);
  }
}

// Start the application
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});