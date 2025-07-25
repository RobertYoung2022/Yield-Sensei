import { Router } from 'express';

const router = Router();

router.get('/', (_req, res) => {
  res.json({ 
    message: 'API Documentation - TODO',
    note: 'OpenAPI/Swagger documentation will be generated here'
  });
});

export default router; 