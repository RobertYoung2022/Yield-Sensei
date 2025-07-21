import { Router } from 'express';

const router = Router();

router.get('/', (req, res) => {
  res.json({ 
    message: 'API Documentation - TODO',
    note: 'OpenAPI/Swagger documentation will be generated here'
  });
});

export { router as docsRouter }; 