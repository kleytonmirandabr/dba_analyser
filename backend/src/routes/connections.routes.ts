import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authMiddleware, requireRole } from '../middleware/auth.middleware';
import { AppDataSource } from '../config/database';
import { Connection } from '../entities/connection.entity';
import { encrypt, decrypt } from '../config/encryption';
import { createAdapter } from '../adapters/adapter.factory';

const router = Router();
const connRepo = () => AppDataSource.getRepository(Connection);

// GET /api/connections
router.get('/', authMiddleware, async (req: Request, res: Response) => {
  const connections = await connRepo().find({ order: { name: 'ASC' } });
  // NEVER return password
  const safe = connections.map(c => ({ ...c, passwordEncrypted: undefined, passwordSalt: undefined, usernameEncrypted: undefined, usernameSalt: undefined, username: decrypt(c.usernameEncrypted, c.usernameSalt) }));
  return res.json({ data: safe });
});

// POST /api/connections
const createSchema = z.object({
  name: z.string().min(1).max(100),
  host: z.string().min(1),
  port: z.number().int().min(1).max(65535),
  databaseName: z.string().optional().default(''),
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
    const { encrypted: passEnc, salt: passSalt } = encrypt(data.password);
    const { encrypted: userEnc, salt: userSalt } = encrypt(data.username);

    const conn = connRepo().create({
      name: data.name,
      host: data.host,
      port: data.port,
      databaseName: data.databaseName || '',
      dbType: data.dbType,
      environment: data.environment,
      mode: data.mode,
      autoApprove: data.autoApprove,
      groupName: data.groupName || null,
      usernameEncrypted: userEnc,
      usernameSalt: userSalt,
      passwordEncrypted: passEnc,
      passwordSalt: passSalt,
      keyVersion: 1,
      createdById: req.user!.userId,
    });
    const saved = await connRepo().save(conn);

    return res.status(201).json({ data: { ...saved, passwordEncrypted: undefined, passwordSalt: undefined, usernameEncrypted: undefined, usernameSalt: undefined, username: data.username } });
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

    const password = decrypt(conn.passwordEncrypted, conn.passwordSalt);
    const adapter = createAdapter(conn.dbType);

    await adapter.connect({
      host: conn.host,
      port: conn.port,
      database: conn.databaseName,
      username: decrypt(conn.usernameEncrypted, conn.usernameSalt),
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

// PUT /api/connections/:id
const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  host: z.string().min(1).optional(),
  port: z.number().int().min(1).max(65535).optional(),
  databaseName: z.string().optional(),
  username: z.string().min(1).optional(),
  password: z.string().min(1).optional(),
  dbType: z.enum(['postgresql', 'mssql', 'mysql']).optional(),
  environment: z.enum(['dev', 'hml', 'prod']).optional(),
  mode: z.enum(['readonly', 'execute']).optional(),
  autoApprove: z.boolean().optional(),
  groupName: z.string().optional(),
});

router.put('/:id', authMiddleware, requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const conn = await connRepo().findOne({ where: { id: req.params.id } });
    if (!conn) return res.status(404).json({ error: 'Conexão não encontrada' });

    const data = updateSchema.parse(req.body);

    if (data.password) {
      const { encrypted, salt } = encrypt(data.password);
      conn.passwordEncrypted = encrypted;
      conn.passwordSalt = salt;
    }
    if (data.username) {
      const { encrypted, salt } = encrypt(data.username);
      conn.usernameEncrypted = encrypted;
      conn.usernameSalt = salt;
    }
    delete (data as any).password;
    delete (data as any).username;

    Object.assign(conn, data);
    const saved = await connRepo().save(conn);
    return res.json({ data: { ...saved, passwordEncrypted: undefined, passwordSalt: undefined, usernameEncrypted: undefined, usernameSalt: undefined, username: decrypt(saved.usernameEncrypted, saved.usernameSalt) } });
  } catch (err: any) {
    if (err.name === 'ZodError') return res.status(400).json({ error: 'Dados inválidos', details: err.errors });
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/connections/:id/databases — discover all databases on the server
router.post('/:id/databases', authMiddleware, async (req: Request, res: Response) => {
  try {
    const conn = await connRepo().findOne({ where: { id: req.params.id } });
    if (!conn) return res.status(404).json({ error: 'Conexão não encontrada' });

    const password = decrypt(conn.passwordEncrypted, conn.passwordSalt);
    const adapter = createAdapter(conn.dbType);

    await adapter.connect({
      host: conn.host,
      port: conn.port,
      database: conn.databaseName || (conn.dbType === 'postgresql' ? 'postgres' : 'master'),
      username: decrypt(conn.usernameEncrypted, conn.usernameSalt),
      password,
      timeoutMs: conn.queryTimeoutMs,
    });

    const databases = await adapter.listDatabases();
    await adapter.disconnect();

    return res.json({ data: databases });
  } catch (err: any) {
    return res.json({ data: [], error: err.message });
  }
});

// POST /api/connections/:id/select-databases — mark which databases to monitor
router.post('/:id/select-databases', authMiddleware, requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const conn = await connRepo().findOne({ where: { id: req.params.id } });
    if (!conn) return res.status(404).json({ error: 'Conexão não encontrada' });

    const { databases } = req.body as { databases: string[] };
    if (!databases || !Array.isArray(databases)) return res.status(400).json({ error: 'databases array required' });

    // Create a child connection for each selected database
    const created: any[] = [];
    for (const dbName of databases) {
      // Skip if already exists
      const existing = await connRepo().findOne({ where: { host: conn.host, port: conn.port, databaseName: dbName } });
      if (existing) continue;

      // Re-encrypt for each child (unique salt per connection)
      const password = decrypt(conn.passwordEncrypted, conn.passwordSalt);
      const username = decrypt(conn.usernameEncrypted, conn.usernameSalt);
      const { encrypted: passEnc, salt: passSalt } = encrypt(password);
      const { encrypted: userEnc, salt: userSalt } = encrypt(username);

      const child = connRepo().create({
        name: `${conn.name} / ${dbName}`,
        host: conn.host,
        port: conn.port,
        databaseName: dbName,
        usernameEncrypted: userEnc,
        usernameSalt: userSalt,
        passwordEncrypted: passEnc,
        passwordSalt: passSalt,
        keyVersion: 1,
        dbType: conn.dbType,
        environment: conn.environment,
        mode: conn.mode,
        autoApprove: conn.autoApprove,
        groupName: conn.name,
        createdById: req.user!.userId,
      });
      const saved = await connRepo().save(child);
      created.push({ ...saved, passwordEncrypted: undefined, passwordSalt: undefined, usernameEncrypted: undefined, usernameSalt: undefined, username });
    }

    return res.json({ data: { created: created.length, connections: created } });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// DELETE /api/connections/:id
router.delete('/:id', authMiddleware, requireRole('admin'), async (req: Request, res: Response) => {
  const result = await connRepo().delete(req.params.id);
  if (result.affected === 0) return res.status(404).json({ error: 'Não encontrada' });
  return res.json({ data: { deleted: true } });
});

export default router;
