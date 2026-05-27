import { Router, Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { Feature } from '../entities/feature.entity';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

// List all features grouped by module
router.get('/', authMiddleware, async (_req: Request, res: Response) => {
  const features = await AppDataSource.getRepository(Feature).find({
    order: { moduleOrder: 'ASC', featureOrder: 'ASC' },
  });
  // Group by module
  const grouped: Record<string, any[]> = {};
  for (const f of features) {
    if (!grouped[f.module]) grouped[f.module] = [];
    grouped[f.module].push(f);
  }
  res.json({ features, grouped });
});

export default router;
