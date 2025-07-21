import { Router } from 'express';

const router = Router();

router.get('/', (req, res) => {
  res.json({ message: 'Transactions endpoint - TODO' });
});

export { router as transactionsRouter }; 