import { Router } from 'express';

const router = Router();

router.get('/', (req, res) => {
  res.json({ message: 'Analytics endpoint - TODO' });
});

export { router as analyticsRouter }; 