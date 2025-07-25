import { Router } from 'express';

const router = Router();

router.get('/', (_req, res) => {
  res.json({ message: 'Market data endpoint - TODO' });
});

export default router; 