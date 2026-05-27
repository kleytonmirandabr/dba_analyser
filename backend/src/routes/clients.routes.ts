import { Router, Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { Client } from '../entities/client.entity';
import { authMiddleware } from '../middleware/auth.middleware';
import { requireFeature } from '../middleware/feature.middleware';
import { IsNull } from 'typeorm';

const router = Router();
const repo = () => AppDataSource.getRepository(Client);

// List all active clients
router.get('/', authMiddleware, requireFeature('admin.clients'), async (_req: Request, res: Response) => {
  const clients = await repo().find({ where: { isDeleted: false }, order: { name: 'ASC' } });
  res.json(clients);
});

// Get one
router.get('/:id', authMiddleware, requireFeature('admin.clients'), async (req: Request, res: Response) => {
  const client = await repo().findOne({ where: { id: req.params.id, isDeleted: false } });
  if (!client) return res.status(404).json({ error: 'Cliente não encontrado' });
  res.json(client);
});

// Create
router.post('/', authMiddleware, requireFeature('admin.clients'), async (req: Request, res: Response) => {
  const { name, code, timezone, language, country, dateFormat, timeFormat, logo, primaryContact, contactEmail, contractStart, contractEnd, maxUsers, maxConnections, notes } = req.body;
  if (!name || !code || !timezone || !language || !country) {
    return res.status(400).json({ error: 'Campos obrigatórios: name, code, timezone, language, country' });
  }
  const client = repo().create({
    name, code, timezone, language, country,
    dateFormat: dateFormat || 'DD/MM/YYYY',
    timeFormat: timeFormat || '24h',
    logo, primaryContact, contactEmail, contractStart, contractEnd,
    maxUsers: maxUsers || 10,
    maxConnections: maxConnections || 20,
    notes,
    createdById: (req.user as any)?.userId || null,
  });
  const saved = await repo().save(client);
  res.status(201).json(saved);
});

// Update
router.put('/:id', authMiddleware, requireFeature('admin.clients'), async (req: Request, res: Response) => {
  const client = await repo().findOne({ where: { id: req.params.id, isDeleted: false } });
  if (!client) return res.status(404).json({ error: 'Cliente não encontrado' });
  Object.assign(client, req.body);
  client.updatedById = (req.user as any)?.userId || null;
  const saved = await repo().save(client);
  res.json(saved);
});

// Soft delete
router.delete('/:id', authMiddleware, requireFeature('admin.clients'), async (req: Request, res: Response) => {
  const client = await repo().findOne({ where: { id: req.params.id, isDeleted: false } });
  if (!client) return res.status(404).json({ error: 'Cliente não encontrado' });
  client.isDeleted = true;
  client.deletedAt = new Date();
  client.deletedById = (req.user as any)?.userId || null;
  await repo().save(client);
  res.json({ success: true });
});

export default router;
