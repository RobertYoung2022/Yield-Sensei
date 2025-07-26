import { Router } from 'express';

const router = Router();

router.get('/', (_req, res) => {
  res.json({ message: 'Analytics endpoint - TODO' });
});

export default router; 