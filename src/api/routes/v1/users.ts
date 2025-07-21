import { Router } from 'express';

const router = Router();

router.get('/', (req, res) => {
  res.json({ message: 'Users endpoint - TODO' });
});

export { router as usersRouter }; 