import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { AppDataSource } from '../config/database';
import { Connection } from '../entities/connection.entity';
import { decrypt } from '../config/encryption';
import { createAdapter } from '../adapters/adapter.factory';
import { DatabaseAdapter } from '../adapters/base.adapter';

const router = Router();
const connRepo = () => AppDataSource.getRepository(Connection);

async function getAdapter(connId: string): Promise<{ adapter: DatabaseAdapter; connection?: Connection; error?: string }> {
  const conn = await connRepo().findOne({ where: { id: connId, isActive: true } });
  if (!conn) return { adapter: null as any, error: 'Conexão não encontrada' };

  const password = decrypt(conn.passwordEncrypted);
  const adapter = createAdapter(conn.dbType);
  await adapter.connect({
    host: conn.host,
    port: conn.port,
    database: conn.databaseName,
    username: conn.username,
    password,
    timeoutMs: conn.queryTimeoutMs,
  });
  return { adapter, connection: conn };
}

// GET /api/explorer/:connId/databases
router.get('/:connId/databases', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { adapter, error } = await getAdapter(req.params.connId);
    if (error) return res.status(404).json({ error });
    const data = await adapter.listDatabases();
    await adapter.disconnect();
    return res.json({ data });
  } catch (err: any) { return res.status(500).json({ error: err.message }); }
});

// GET /api/explorer/:connId/schemas
router.get('/:connId/schemas', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { adapter, error, connection } = await getAdapter(req.params.connId);
    if (error) return res.status(404).json({ error });

    let schemas: string[] = [];
    if (connection!.dbType === 'postgresql') {
      const pool = (adapter as any).pool;
      const result = await pool.query("SELECT schema_name FROM information_schema.schemata WHERE schema_name NOT IN ('pg_catalog','information_schema','pg_toast') ORDER BY schema_name");
      schemas = result.rows.map((r: any) => r.schema_name);
    } else {
      const result = await (adapter as any).query("SELECT s.name as schema_name FROM sys.schemas s WHERE s.schema_id < 16384 AND s.name NOT IN ('guest','INFORMATION_SCHEMA','sys') ORDER BY s.name");
      schemas = result.map((r: any) => r.schema_name);
    }

    await adapter.disconnect();
    return res.json({ data: schemas });
  } catch (err: any) { return res.status(500).json({ error: err.message }); }
});

// GET /api/explorer/:connId/tables?schema=public
router.get('/:connId/tables', authMiddleware, async (req: Request, res: Response) => {
  try {
    const schema = (req.query.schema as string) || 'public';
    const { adapter, error } = await getAdapter(req.params.connId);
    if (error) return res.status(404).json({ error });
    const data = await adapter.listTables(schema);
    await adapter.disconnect();
    return res.json({ data });
  } catch (err: any) { return res.status(500).json({ error: err.message }); }
});

// GET /api/explorer/:connId/columns/:schema/:table
router.get('/:connId/columns/:schema/:table', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { adapter, error } = await getAdapter(req.params.connId);
    if (error) return res.status(404).json({ error });
    const data = await adapter.listColumns(req.params.schema, req.params.table);
    await adapter.disconnect();
    return res.json({ data });
  } catch (err: any) { return res.status(500).json({ error: err.message }); }
});

// GET /api/explorer/:connId/indexes/:schema/:table
router.get('/:connId/indexes/:schema/:table', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { adapter, error } = await getAdapter(req.params.connId);
    if (error) return res.status(404).json({ error });
    const data = await adapter.listIndexes(req.params.schema, req.params.table);
    await adapter.disconnect();
    return res.json({ data });
  } catch (err: any) { return res.status(500).json({ error: err.message }); }
});

// GET /api/explorer/:connId/views?schema=public
router.get('/:connId/views', authMiddleware, async (req: Request, res: Response) => {
  try {
    const schema = (req.query.schema as string) || 'public';
    const { adapter, error } = await getAdapter(req.params.connId);
    if (error) return res.status(404).json({ error });
    const data = await adapter.listViews(schema);
    await adapter.disconnect();
    return res.json({ data });
  } catch (err: any) { return res.status(500).json({ error: err.message }); }
});

// GET /api/explorer/:connId/functions?schema=public
router.get('/:connId/functions', authMiddleware, async (req: Request, res: Response) => {
  try {
    const schema = (req.query.schema as string) || 'public';
    const { adapter, error } = await getAdapter(req.params.connId);
    if (error) return res.status(404).json({ error });
    const data = await adapter.listFunctions(schema);
    await adapter.disconnect();
    return res.json({ data });
  } catch (err: any) { return res.status(500).json({ error: err.message }); }
});

// GET /api/explorer/:connId/triggers?schema=public
router.get('/:connId/triggers', authMiddleware, async (req: Request, res: Response) => {
  try {
    const schema = (req.query.schema as string) || 'public';
    const { adapter, error } = await getAdapter(req.params.connId);
    if (error) return res.status(404).json({ error });
    const data = await adapter.listTriggers(schema);
    await adapter.disconnect();
    return res.json({ data });
  } catch (err: any) { return res.status(500).json({ error: err.message }); }
});

// GET /api/explorer/:connId/procedures?schema=public
router.get('/:connId/procedures', authMiddleware, async (req: Request, res: Response) => {
  try {
    const schema = (req.query.schema as string) || 'public';
    const { adapter, error } = await getAdapter(req.params.connId);
    if (error) return res.status(404).json({ error });
    const data = await adapter.listProcedures(schema);
    await adapter.disconnect();
    return res.json({ data });
  } catch (err: any) { return res.status(500).json({ error: err.message }); }
});

export default router;
