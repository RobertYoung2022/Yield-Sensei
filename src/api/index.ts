/**
 * API Server Entry Point
 * Express server with RESTful API and GraphQL integration
 */

import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import { createGraphQLServer } from '../graphql/server';

// Import middleware
import { errorHandler } from './middleware/error-handler';
import { requestLogger } from './middleware/request-logger';
import { rateLimiter } from './middleware/rate-limiter';
import { validateEnv } from './middleware/validate-env';

// Import routes
import healthRoutes from './routes/health';
import v1Routes from './routes/v1';

// Import database manager
import { DatabaseManager } from '../shared/database/manager';

// Import Redis manager
import { RedisManager } from '../shared/database/redis-manager';

// Import logger
import { logger } from '../shared/logging/logger';

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
  origin: config.corsOrigins,
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

// Rate limiting middleware
app.use(rateLimiter);

// Health check routes
app.use('/health', healthRoutes);

// API version 1 routes
app.use('/api/v1', v1Routes);

// GraphQL server integration
let graphQLServer: any = null;

// Error handling middleware (must be last)
app.use(errorHandler);

// Initialize database and start server
async function startServer() {
  try {
    // Initialize database
    const dbManager = new DatabaseManager();
    await dbManager.initialize();
    
    // Initialize Redis
    const redisManager = new RedisManager();
    await redisManager.initialize();
    
    // Initialize GraphQL server
    graphQLServer = await createGraphQLServer(app);
    
    // Start HTTP server
    const port = config.port || 4000;
    const server = app.listen(port, () => {
      logger.info(`🚀 API server running on port ${port}`);
      logger.info(`📊 Health checks available at http://localhost:${port}/health`);
      logger.info(`🔗 REST API available at http://localhost:${port}/api/v1`);
      logger.info(`🎯 GraphQL available at http://localhost:${port}/graphql`);
    });

    // Graceful shutdown
    process.on('SIGTERM', async () => {
      logger.info('SIGTERM received, shutting down gracefully');
      
      if (graphQLServer) {
        await graphQLServer.stop();
      }
      
      server.close(async () => {
        await dbManager.close();
        await redisManager.close();
        logger.info('Server closed');
        process.exit(0);
      });
    });

    process.on('SIGINT', async () => {
      logger.info('SIGINT received, shutting down gracefully');
      
      if (graphQLServer) {
        await graphQLServer.stop();
      }
      
      server.close(async () => {
        await dbManager.close();
        await redisManager.close();
        logger.info('Server closed');
        process.exit(0);
      });
    });

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server
startServer();

export default app; 