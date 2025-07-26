import { Router } from 'express';

const router = Router();

router.get('/', (_req, res) => {
  res.json({ message: 'Transactions endpoint - TODO' });
});

export default router; 