/**
 * API v1 Router
 * Main router for version 1 of the YieldSensei API
 */

import { Router } from 'express';
import { portfoliosRouter } from './portfolios';
import { satellitesRouter } from './satellites';
import { riskAssessmentsRouter } from './risk-assessments';
import { marketDataRouter } from './market-data';
import { transactionsRouter } from './transactions';
import { usersRouter } from './users';
import { analyticsRouter } from './analytics';
import { docsRouter } from './docs';

const router = Router();

// API v1 root endpoint
router.get('/', (req, res) => {
  res.json({
    version: '1.0.0',
    name: 'YieldSensei API v1',
    description: 'Multi-Agent DeFi Investment Advisor API',
    endpoints: {
      portfolios: '/portfolios',
      satellites: '/satellites',
      'risk-assessments': '/risk-assessments',
      'market-data': '/market-data',
      transactions: '/transactions',
      users: '/users',
      analytics: '/analytics',
      docs: '/docs',
    },
    documentation: '/docs',
  });
});

// Mount route modules
router.use('/portfolios', portfoliosRouter);
router.use('/satellites', satellitesRouter);
router.use('/risk-assessments', riskAssessmentsRouter);
router.use('/market-data', marketDataRouter);
router.use('/transactions', transactionsRouter);
router.use('/users', usersRouter);
router.use('/analytics', analyticsRouter);
router.use('/docs', docsRouter);

export { router as v1Router }; 