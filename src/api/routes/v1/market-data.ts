import { Router } from 'express';

const router = Router();

router.get('/', (req, res) => {
  res.json({ message: 'Market data endpoint - TODO' });
});

export { router as marketDataRouter }; 