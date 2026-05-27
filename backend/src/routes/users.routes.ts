import { Router, Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { User } from '../entities/user.entity';
import { Profile } from '../entities/profile.entity';
import { Client } from '../entities/client.entity';
import { ProfileFeature } from '../entities/profile-feature.entity';
import { UserActivityLog } from '../entities/user-activity-log.entity';
import { authMiddleware } from '../middleware/auth.middleware';
import { requireFeature } from '../middleware/feature.middleware';
import * as bcrypt from 'bcryptjs';

const router = Router();
const repo = () => AppDataSource.getRepository(User);

// List users (filtered by client if not admin.clients)
router.get('/', authMiddleware, requireFeature('admin.users'), async (req: Request, res: Response) => {
  const qb = repo().createQueryBuilder('u')
    .leftJoinAndSelect('u.client', 'c')
    .leftJoinAndSelect('u.profile', 'p')
    .where('u.isDeleted = false')
    .orderBy('u.name', 'ASC');
  if (req.query.clientId) qb.andWhere('u.clientId = :cid', { cid: req.query.clientId });
  const users = await qb.getMany();
  res.json(users.map(u => ({ ...u, passwordHash: undefined })));
});

// Get one
router.get('/:id', authMiddleware, requireFeature('admin.users'), async (req: Request, res: Response) => {
  const user = await repo().findOne({ where: { id: req.params.id, isDeleted: false }, relations: ['client', 'profile'] });
  if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });
  res.json({ ...user, passwordHash: undefined });
});

// Create
router.post('/', authMiddleware, requireFeature('admin.users'), async (req: Request, res: Response) => {
  const { name, username, email, password, clientId, profileId, phone, preferredLanguage, preferredTimezone } = req.body;
  if (!name || !username || !password || !clientId || !profileId) {
    return res.status(400).json({ error: 'Campos obrigatórios: name, username, password, clientId, profileId' });
  }
  const existing = await repo().findOne({ where: { username } });
  if (existing) return res.status(409).json({ error: 'Username já existe' });

  const passwordHash = await bcrypt.hash(password, 12);
  const user = repo().create({
    name, username, email, passwordHash, clientId, profileId,
    phone, preferredLanguage, preferredTimezone,
    role: 'viewer', // deprecated field
    createdById: (req.user as any)?.userId || null,
  });
  const saved = await repo().save(user);
  res.status(201).json({ ...saved, passwordHash: undefined });
});

// Update
router.put('/:id', authMiddleware, requireFeature('admin.users'), async (req: Request, res: Response) => {
  const user = await repo().findOne({ where: { id: req.params.id, isDeleted: false } });
  if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });
  const { password, ...data } = req.body;
  Object.assign(user, data);
  if (password) user.passwordHash = await bcrypt.hash(password, 12);
  user.updatedById = (req.user as any)?.userId || null;
  const saved = await repo().save(user);
  res.json({ ...saved, passwordHash: undefined });
});

// Soft delete
router.delete('/:id', authMiddleware, requireFeature('admin.users'), async (req: Request, res: Response) => {
  const user = await repo().findOne({ where: { id: req.params.id, isDeleted: false } });
  if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });
  user.isDeleted = true;
  user.deletedAt = new Date();
  user.deletedById = (req.user as any)?.userId || null;
  user.isActive = false;
  await repo().save(user);
  res.json({ success: true });
});

// Activity log
router.get('/:id/activity', authMiddleware, requireFeature('admin.users'), async (req: Request, res: Response) => {
  const logs = await AppDataSource.getRepository(UserActivityLog).find({
    where: { userId: req.params.id },
    order: { timestamp: 'DESC' },
    take: 50,
  });
  res.json(logs);
});

export default router;
