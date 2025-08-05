/**
 * Health Check Routes
 * Provides system health status for monitoring and load balancers
 */

import { Router, Request, Response } from 'express';
import { DatabaseManager, RedisManager } from '../../shared/database/manager-simple';
import { getLogger } from "../../shared/utils/logger";

const router = Router();
const logger = getLogger('health-routes');

interface HealthStatus {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  uptime: number;
  version: string;
  environment: string;
  services: {
    database: {
      status: 'healthy' | 'unhealthy';
      latency?: number;
      error?: string;
    };
    redis: {
      status: 'healthy' | 'unhealthy';
      latency?: number;
      error?: string;
    };
    memory: {
      used: number;
      total: number;
      percentage: number;
    };
  };
}

/**
 * GET /health
 * Basic health check endpoint
 */
router.get('/', async (_req: Request, res: Response) => {
  try {
    const healthStatus: HealthStatus = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env['npm_package_version'] || '1.0.0',
      environment: process.env['NODE_ENV'] || 'development',
      services: {
        database: { status: 'unhealthy' },
        redis: { status: 'unhealthy' },
        memory: {
          used: process.memoryUsage().heapUsed,
          total: process.memoryUsage().heapTotal,
          percentage: (process.memoryUsage().heapUsed / process.memoryUsage().heapTotal) * 100,
        },
      },
    };

    // Check database health
    try {
      const dbManager = DatabaseManager.getInstance();
      const healthCheck = await dbManager.healthCheck();
      healthStatus.services.database = {
        status: healthCheck.status === 'healthy' ? 'healthy' : 'unhealthy'
      };
    } catch (error) {
      healthStatus.services.database = {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }

    // Check Redis health
    try {
      const redisManager = RedisManager.getInstance();
      const redisHealth = await redisManager.healthCheck();
      healthStatus.services.redis = {
        status: redisHealth.status === 'healthy' ? 'healthy' : 'unhealthy',
        ...(redisHealth.latency !== undefined && { latency: redisHealth.latency }),
      };
    } catch (error) {
      healthStatus.services.redis = {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }

    // Determine overall status
    const unhealthyServices = Object.values(healthStatus.services).filter(
      (service) => 'status' in service && service.status === 'unhealthy'
    ).length;

    if (unhealthyServices === 0) {
      healthStatus.status = 'healthy';
    } else if (unhealthyServices < Object.keys(healthStatus.services).length) {
      healthStatus.status = 'degraded';
    } else {
      healthStatus.status = 'unhealthy';
    }

    const statusCode = healthStatus.status === 'healthy' ? 200 : 503;
    res.status(statusCode).json(healthStatus);

  } catch (error) {
    logger.error('Health check failed:', undefined, error as Error);
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Health check failed',
    });
  }
});

/**
 * GET /health/ready
 * Readiness probe for Kubernetes
 */
router.get('/ready', async (_req: Request, res: Response) => {
  try {
    // Check if all critical services are ready
    const dbManager = DatabaseManager.getInstance();
    const redisManager = RedisManager.getInstance();

    const [dbHealth, redisHealth] = await Promise.all([
      dbManager.healthCheck(),
      redisManager.healthCheck(),
    ]);

    const isReady = dbHealth.status === 'healthy' && redisHealth.status === 'healthy';

    if (isReady) {
      res.status(200).json({
        status: 'ready',
        timestamp: new Date().toISOString(),
      });
    } else {
      res.status(503).json({
        status: 'not ready',
        timestamp: new Date().toISOString(),
        services: {
          database: dbHealth.status,
          redis: redisHealth.status,
        },
      });
    }
  } catch (error) {
    logger.error('Readiness check failed:', undefined, error as Error);
    res.status(503).json({
      status: 'not ready',
      timestamp: new Date().toISOString(),
      error: 'Readiness check failed',
    });
  }
});

/**
 * GET /health/live
 * Liveness probe for Kubernetes
 */
router.get('/live', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'alive',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

export default router; 