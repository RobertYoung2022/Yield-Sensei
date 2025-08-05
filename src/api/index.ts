/**
 * API Server Entry Point
 * Express server with RESTful API and GraphQL integration
 */

import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
// GraphQL server removed for MVP simplification

// Import middleware
import { errorHandler } from './middleware/error-handler';
import { requestLogger } from './middleware/request-logger';
// rateLimiter not used - removed to fix TS error
// import { rateLimiter } from './middleware/rate-limiter';
import { validateEnv } from './middleware/validate-env';

// Import routes
import healthRoutes from './routes/health';
import v1Routes from './routes/v1';

// Import simple database managers for MVP
import { DatabaseManager, RedisManager } from '../shared/database/manager-simple';

// Import logger
import { getLogger } from "../shared/utils/logger";
const logger = getLogger('api-server');

// Import environment configuration
import { config } from '../config/environment';

// Create Express app
const app = express();

// Trust proxy for rate limiting
app.set('trust proxy', 1);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

// CORS configuration
app.use(cors({
  origin: process.env['CORS_ORIGINS']?.split(',') || ['http://localhost:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));

// Compression middleware
app.use(compression());

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Environment validation middleware
app.use(validateEnv);

// Request logging middleware
app.use(requestLogger);

// Rate limiting middleware (temporarily disabled for testing)
// app.use(rateLimiter);

// Health check routes
app.use('/health', healthRoutes);

// API version 1 routes
app.use('/api/v1', v1Routes);

// GraphQL server removed for MVP simplification

// Error handling middleware (must be last)
app.use(errorHandler);

// Initialize database and start server
async function startServer() {
  try {
    // Initialize database
    const dbManager = DatabaseManager.getInstance();
    try {
      await dbManager.initialize();
      logger.info('✅ Database connections initialized successfully');
    } catch (error) {
      logger.warn('⚠️  Database connections failed - API will run with limited functionality', { error: (error as Error).message });
    }
    
    // Initialize Redis
    const redisConfig = {
      host: process.env['REDIS_HOST'] || 'localhost',
      port: parseInt(process.env['REDIS_PORT'] || '6379'),
      ...(process.env['REDIS_PASSWORD'] && { password: process.env['REDIS_PASSWORD'] }),
    };
    const redisManager = RedisManager.getInstance(redisConfig);
    await redisManager.connect();
    
    // GraphQL server removed for MVP simplification
    
    // Start HTTP server
    const port = config.port || 4000;
    const server = app.listen(port, () => {
      logger.info(`🚀 API server running on port ${port}`);
      logger.info(`📊 Health checks available at http://localhost:${port}/health`);
      logger.info(`🔗 REST API available at http://localhost:${port}/api/v1`);
      // GraphQL server removed for MVP simplification
    });

    // Graceful shutdown
    process.on('SIGTERM', async () => {
      logger.info('SIGTERM received, shutting down gracefully');
      
      // GraphQL server removed for MVP simplification
      
      server.close(async () => {
        await dbManager.close();
        await redisManager.disconnect();
        logger.info('Server closed');
        process.exit(0);
      });
    });

    process.on('SIGINT', async () => {
      logger.info('SIGINT received, shutting down gracefully');
      
      // GraphQL server removed for MVP simplification
      
      server.close(async () => {
        await dbManager.close();
        await redisManager.disconnect();
        logger.info('Server closed');
        process.exit(0);
      });
    });

  } catch (error) {
    logger.error('Failed to start server', undefined, error as Error);
    process.exit(1);
  }
}

// Start the server
startServer();

export default app; 