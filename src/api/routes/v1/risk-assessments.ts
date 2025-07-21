import { Router } from 'express';

const router = Router();

router.get('/', (req, res) => {
  res.json({ message: 'Risk assessments endpoint - TODO' });
});

export { router as riskAssessmentsRouter }; 