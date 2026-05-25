import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { AppDataSource } from '../config/database';
import { Connection } from '../entities/connection.entity';
import { getConnCredentials } from '../utils/credentials';
import { createAdapter } from '../adapters/adapter.factory';

const router = Router();
const connRepo = () => AppDataSource.getRepository(Connection);

// Helper: connect to a target database
async function getConnectedAdapter(connId: string) {
  const conn = await connRepo().findOne({ where: { id: connId } });
  if (!conn) throw new Error('Conexão não encontrada');

  
  const adapter = createAdapter(conn.dbType);
  const creds = getConnCredentials(conn);
  if (!conn.databaseName) creds.database = conn.dbType === 'postgresql' ? 'postgres' : 'master';

  await adapter.connect(creds);

  return adapter;
}

// GET /api/connections/:id/health/overview
router.get('/:id/health/overview', authMiddleware, async (req: Request, res: Response) => {
  let adapter: any = null;
  try {
    adapter = await getConnectedAdapter(req.params.id);
    if (!adapter.getHealthOverview) return res.status(501).json({ error: 'Não suportado para este tipo de banco' });
    const data = await adapter.getHealthOverview();
    return res.json({ data });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  } finally {
    if (adapter) await adapter.disconnect();
  }
});

// GET /api/connections/:id/health/tables
router.get('/:id/health/tables', authMiddleware, async (req: Request, res: Response) => {
  let adapter: any = null;
  try {
    adapter = await getConnectedAdapter(req.params.id);
    if (!adapter.getTableHealth) return res.status(501).json({ error: 'Não suportado' });
    const data = await adapter.getTableHealth();
    return res.json({ data });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  } finally {
    if (adapter) await adapter.disconnect();
  }
});

// GET /api/connections/:id/health/slow-queries
router.get('/:id/health/slow-queries', authMiddleware, async (req: Request, res: Response) => {
  let adapter: any = null;
  try {
    adapter = await getConnectedAdapter(req.params.id);
    if (!adapter.getSlowQueries) return res.status(501).json({ error: 'Não suportado' });
    const limit = parseInt(req.query.limit as string) || 20;
    const data = await adapter.getSlowQueries(limit);
    return res.json({ data });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  } finally {
    if (adapter) await adapter.disconnect();
  }
});

// GET /api/connections/:id/health/indexes
router.get('/:id/health/indexes', authMiddleware, async (req: Request, res: Response) => {
  let adapter: any = null;
  try {
    adapter = await getConnectedAdapter(req.params.id);
    const unused = adapter.getUnusedIndexes ? await adapter.getUnusedIndexes() : [];
    const missing = adapter.getMissingIndexes ? await adapter.getMissingIndexes() : [];
    return res.json({ data: { unused, missing } });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  } finally {
    if (adapter) await adapter.disconnect();
  }
});

// GET /api/connections/:id/health/config
router.get('/:id/health/config', authMiddleware, async (req: Request, res: Response) => {
  let adapter: any = null;
  try {
    adapter = await getConnectedAdapter(req.params.id);
    if (!adapter.getDbConfig) return res.status(501).json({ error: 'Não suportado' });
    const data = await adapter.getDbConfig();
    return res.json({ data });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  } finally {
    if (adapter) await adapter.disconnect();
  }
});

// GET /api/connections/:id/health/long-transactions
router.get('/:id/health/long-transactions', authMiddleware, async (req: Request, res: Response) => {
  let adapter: any = null;
  try {
    adapter = await getConnectedAdapter(req.params.id);
    if (!adapter.getLongTransactions) return res.status(501).json({ error: 'Não suportado' });
    const minMs = parseInt(req.query.minMs as string) || 300000;
    const data = await adapter.getLongTransactions(minMs);
    return res.json({ data });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  } finally {
    if (adapter) await adapter.disconnect();
  }
});

export default router;
