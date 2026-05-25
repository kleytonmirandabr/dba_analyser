import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authMiddleware, requireRole } from '../middleware/auth.middleware';
import { AppDataSource } from '../config/database';
import { Connection } from '../entities/connection.entity';
import { encrypt, decrypt } from '../config/encryption';
import { PostgresAdapter } from '../adapters/postgres.adapter';

const router = Router();
const connRepo = () => AppDataSource.getRepository(Connection);

// GET /api/connections
router.get('/', authMiddleware, async (req: Request, res: Response) => {
  const connections = await connRepo().find({ order: { name: 'ASC' } });
  // NEVER return password
  const safe = connections.map(c => ({ ...c, passwordEncrypted: undefined, passwordSalt: undefined }));
  return res.json({ data: safe });
});

// POST /api/connections
const createSchema = z.object({
  name: z.string().min(1).max(100),
  host: z.string().min(1),
  port: z.number().int().min(1).max(65535),
  databaseName: z.string().min(1),
  username: z.string().min(1),
  password: z.string().min(1),
  dbType: z.enum(['postgresql', 'mssql', 'mysql']),
  environment: z.enum(['dev', 'hml', 'prod']),
  mode: z.enum(['readonly', 'execute']).default('readonly'),
  autoApprove: z.boolean().default(false),
  groupName: z.string().optional(),
});

router.post('/', authMiddleware, requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const data = createSchema.parse(req.body);
    const { encrypted, salt } = encrypt(data.password);

    const conn = connRepo().create({
      ...data,
      passwordEncrypted: encrypted,
      passwordSalt: salt,
      createdById: req.user!.userId,
    });
    delete (conn as any).password; // Remove plain password
    const saved = await connRepo().save(conn);

    return res.status(201).json({ data: { ...saved, passwordEncrypted: undefined, passwordSalt: undefined } });
  } catch (err: any) {
    if (err.name === 'ZodError') return res.status(400).json({ error: 'Dados inválidos', details: err.errors });
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/connections/:id/test
router.post('/:id/test', authMiddleware, async (req: Request, res: Response) => {
  try {
    const conn = await connRepo().findOne({ where: { id: req.params.id } });
    if (!conn) return res.status(404).json({ error: 'Conexão não encontrada' });

    const password = decrypt(conn.passwordEncrypted);
    const adapter = new PostgresAdapter(); // TODO: select by dbType

    await adapter.connect({
      host: conn.host,
      port: conn.port,
      database: conn.databaseName,
      username: conn.username,
      password,
      timeoutMs: conn.queryTimeoutMs,
    });

    const result = await adapter.testConnection();
    await adapter.disconnect();

    return res.json({ data: result });
  } catch (err: any) {
    return res.json({ data: { ok: false, version: '', error: err.message } });
  }
});

// DELETE /api/connections/:id
router.delete('/:id', authMiddleware, requireRole('admin'), async (req: Request, res: Response) => {
  const result = await connRepo().delete(req.params.id);
  if (result.affected === 0) return res.status(404).json({ error: 'Não encontrada' });
  return res.json({ data: { deleted: true } });
});

export default router;
