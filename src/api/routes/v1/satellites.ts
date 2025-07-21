import { Router } from 'express';

const router = Router();

router.get('/', (req, res) => {
  res.json({ message: 'Satellites endpoint - TODO' });
});

export { router as satellitesRouter }; 