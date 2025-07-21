/**
 * YieldSensei API Server
 * Main API entry point with Express server setup
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { json, urlencoded } from 'express';

import { errorHandler } from './middleware/error-handler';
import { requestLogger } from './middleware/request-logger';
import { rateLimiter } from './middleware/rate-limiter';
import { validateEnv } from './middleware/validate-env';

import { v1Router } from './routes/v1';
import { healthRouter } from './routes/health';

import Logger from '../shared/logging/logger';

const logger = Logger.getLogger('api');

export class ApiServer {
  private app: express.Application;
  private port: number;

  constructor(port: number = 3000) {
    this.port = port;
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  private setupMiddleware(): void {
    // Security middleware
    this.app.use(helmet({
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
    this.app.use(cors({
      origin: process.env['ALLOWED_ORIGINS']?.split(',') || ['http://localhost:3000'],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
    }));

    // Body parsing middleware
    this.app.use(json({ limit: '10mb' }));
    this.app.use(urlencoded({ extended: true, limit: '10mb' }));

    // Compression middleware
    this.app.use(compression());

    // Request logging
    this.app.use(requestLogger);

    // Environment validation
    this.app.use(validateEnv);

    // Rate limiting
    this.app.use(rateLimiter);
  }

  private setupRoutes(): void {
    // Health check endpoint
    this.app.use('/health', healthRouter);

    // API versioning - v1
    this.app.use('/api/v1', v1Router);

    // Root endpoint
    this.app.get('/', (req, res) => {
      res.json({
        name: 'YieldSensei API',
        version: '1.0.0',
        description: 'Multi-Agent DeFi Investment Advisor API',
        documentation: '/api/v1/docs',
        health: '/health',
      });
    });

    // 404 handler
    this.app.use('*', (req, res) => {
      res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: `Route ${req.method} ${req.originalUrl} not found`,
          timestamp: new Date().toISOString(),
        },
      });
    });
  }

  private setupErrorHandling(): void {
    // Global error handler
    this.app.use(errorHandler);
  }

  public async start(): Promise<void> {
    try {
      await new Promise<void>((resolve, reject) => {
        const server = this.app.listen(this.port, () => {
          logger.info(`🚀 YieldSensei API server started on port ${this.port}`);
          logger.info(`📚 API Documentation: http://localhost:${this.port}/api/v1/docs`);
          logger.info(`🏥 Health Check: http://localhost:${this.port}/health`);
          resolve();
        });

        server.on('error', (error) => {
          logger.error('Failed to start API server:', error);
          reject(error);
        });
      });
    } catch (error) {
      logger.error('Error starting API server:', error);
      throw error;
    }
  }

  public getApp(): express.Application {
    return this.app;
  }
}

// Export for testing
export default ApiServer; 