import { Router, Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { Profile } from '../entities/profile.entity';
import { ProfileFeature } from '../entities/profile-feature.entity';
import { authMiddleware } from '../middleware/auth.middleware';
import { requireFeature } from '../middleware/feature.middleware';

const router = Router();
const repo = () => AppDataSource.getRepository(Profile);
const pfRepo = () => AppDataSource.getRepository(ProfileFeature);

// List profiles (optionally filter by clientId)
router.get('/', authMiddleware, requireFeature('admin.profiles'), async (req: Request, res: Response) => {
  const where: any = { isDeleted: false };
  if (req.query.clientId) where.clientId = req.query.clientId;
  const profiles = await repo().find({ where, order: { name: 'ASC' } });
  res.json(profiles);
});

// Get profile with features
router.get('/:id', authMiddleware, requireFeature('admin.profiles'), async (req: Request, res: Response) => {
  const profile = await repo().findOne({ where: { id: req.params.id, isDeleted: false } });
  if (!profile) return res.status(404).json({ error: 'Perfil não encontrado' });
  const features = await pfRepo().find({ where: { profileId: profile.id } });
  res.json({ ...profile, features: features.map(f => f.featureCode) });
});

// Create profile
router.post('/', authMiddleware, requireFeature('admin.profiles'), async (req: Request, res: Response) => {
  const { name, description, clientId, isDefault, features } = req.body;
  if (!name) return res.status(400).json({ error: 'Nome obrigatório' });

  const profile = await repo().save(repo().create({
    name, description, clientId: clientId || null, isDefault: isDefault || false,
    createdById: (req.user as any)?.userId || null,
  }));

  // Save features
  if (features && Array.isArray(features)) {
    const pfs = features.map((code: string) => pfRepo().create({
      profileId: profile.id, featureCode: code, grantedById: (req.user as any)?.userId || null,
    }));
    await pfRepo().save(pfs);
  }

  res.status(201).json(profile);
});

// Update profile + features
router.put('/:id', authMiddleware, requireFeature('admin.profiles'), async (req: Request, res: Response) => {
  const profile = await repo().findOne({ where: { id: req.params.id, isDeleted: false } });
  if (!profile) return res.status(404).json({ error: 'Perfil não encontrado' });

  const { features, ...data } = req.body;
  Object.assign(profile, data);
  profile.updatedById = (req.user as any)?.userId || null;
  await repo().save(profile);

  // Sync features
  if (features && Array.isArray(features)) {
    await pfRepo().delete({ profileId: profile.id });
    const pfs = features.map((code: string) => pfRepo().create({
      profileId: profile.id, featureCode: code, grantedById: (req.user as any)?.userId || null,
    }));
    await pfRepo().save(pfs);
  }

  res.json(profile);
});

// Soft delete
router.delete('/:id', authMiddleware, requireFeature('admin.profiles'), async (req: Request, res: Response) => {
  const profile = await repo().findOne({ where: { id: req.params.id, isDeleted: false } });
  if (!profile) return res.status(404).json({ error: 'Perfil não encontrado' });
  profile.isDeleted = true;
  profile.deletedAt = new Date();
  profile.deletedById = (req.user as any)?.userId || null;
  await repo().save(profile);
  res.json({ success: true });
});

export default router;
