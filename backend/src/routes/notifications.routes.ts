import { Router, Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { NotificationChannel } from '../entities/notification-channel.entity';
import { authMiddleware } from '../middleware/auth.middleware';
import { requireFeature } from '../middleware/feature.middleware';
import { sendNotifications } from '../services/notification.service';

const router = Router();
const repo = () => AppDataSource.getRepository(NotificationChannel);

// List channels
router.get('/', authMiddleware, requireFeature('alerts.manage'), async (_req: Request, res: Response) => {
  const channels = await repo().find({ where: { isDeleted: false }, order: { name: 'ASC' } });
  res.json(channels);
});

// Create
router.post('/', authMiddleware, requireFeature('alerts.manage'), async (req: Request, res: Response) => {
  const { name, type, config, isActive, alertIds, severity } = req.body;
  if (!name || !type || !config) return res.status(400).json({ error: 'name, type, config obrigatórios' });
  const channel = repo().create({ name, type, config, isActive: isActive !== false, alertIds, severity: severity || 'all', createdById: (req.user as any)?.userId });
  const saved = await repo().save(channel);
  res.status(201).json(saved);
});

// Update
router.put('/:id', authMiddleware, requireFeature('alerts.manage'), async (req: Request, res: Response) => {
  const channel = await repo().findOne({ where: { id: req.params.id, isDeleted: false } });
  if (!channel) return res.status(404).json({ error: 'Canal não encontrado' });
  Object.assign(channel, req.body);
  channel.updatedById = (req.user as any)?.userId || null;
  res.json(await repo().save(channel));
});

// Delete
router.delete('/:id', authMiddleware, requireFeature('alerts.manage'), async (req: Request, res: Response) => {
  const channel = await repo().findOne({ where: { id: req.params.id, isDeleted: false } });
  if (!channel) return res.status(404).json({ error: 'Canal não encontrado' });
  channel.isDeleted = true; channel.deletedAt = new Date(); channel.deletedById = (req.user as any)?.userId;
  await repo().save(channel);
  res.json({ success: true });
});

// Test notification
router.post('/test', authMiddleware, requireFeature('alerts.manage'), async (req: Request, res: Response) => {
  const { channelId } = req.body;
  const channel = channelId ? await repo().findOne({ where: { id: channelId, isDeleted: false } }) : null;
  await sendNotifications({
    title: '🔔 Teste de Notificação',
    message: 'Esta é uma mensagem de teste do DBA Analyser.',
    severity: 'info',
    timestamp: new Date().toISOString(),
  });
  res.json({ success: true, message: 'Notificação de teste enviada' });
});

export default router;
