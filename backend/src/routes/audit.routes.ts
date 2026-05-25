import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { AppDataSource } from '../config/database';
import { AuditLog } from '../entities/audit-log.entity';

const router = Router();

router.get('/', authMiddleware, async (req: Request, res: Response) => {
  const where: any = {};
  if (req.query.action) where.action = req.query.action;
  if (req.query.userId) where.userId = req.query.userId;

  const logs = await AppDataSource.getRepository(AuditLog).find({
    where, order: { createdAt: 'DESC' }, take: 200,
  });
  return res.json({ data: logs });
});

export default router;
