import { Router, Request, Response } from 'express';
import { authMiddleware, requireRole } from '../middleware/auth.middleware';
import { AppDataSource } from '../config/database';
import { Connection } from '../entities/connection.entity';
import { decrypt } from '../config/encryption';
import { createAdapter } from '../adapters/adapter.factory';

const router = Router();
const connRepo = () => AppDataSource.getRepository(Connection);

// GET /api/monitor/:connId/queries
router.get('/:connId/queries', authMiddleware, async (req: Request, res: Response) => {
  try {
    const conn = await connRepo().findOne({ where: { id: req.params.connId, isActive: true } });
    if (!conn) return res.status(404).json({ error: 'Conexão não encontrada' });

    const adapter = createAdapter(conn.dbType);
    await adapter.connect({ host: conn.host, port: conn.port, database: conn.databaseName, username: conn.username, password: decrypt(conn.passwordEncrypted) });
    const data = await adapter.getActiveQueries();
    await adapter.disconnect();
    return res.json({ data });
  } catch (err: any) { return res.status(500).json({ error: err.message }); }
});

// GET /api/monitor/:connId/locks
router.get('/:connId/locks', authMiddleware, async (req: Request, res: Response) => {
  try {
    const conn = await connRepo().findOne({ where: { id: req.params.connId, isActive: true } });
    if (!conn) return res.status(404).json({ error: 'Conexão não encontrada' });

    const adapter = createAdapter(conn.dbType);
    await adapter.connect({ host: conn.host, port: conn.port, database: conn.databaseName, username: conn.username, password: decrypt(conn.passwordEncrypted) });
    const data = await adapter.getLocks();
    await adapter.disconnect();
    return res.json({ data });
  } catch (err: any) { return res.status(500).json({ error: err.message }); }
});

// POST /api/monitor/:connId/kill/:pid
router.post('/:connId/kill/:pid', authMiddleware, requireRole('admin', 'dba'), async (req: Request, res: Response) => {
  try {
    const conn = await connRepo().findOne({ where: { id: req.params.connId, isActive: true } });
    if (!conn) return res.status(404).json({ error: 'Conexão não encontrada' });

    const adapter = createAdapter(conn.dbType);
    await adapter.connect({ host: conn.host, port: conn.port, database: conn.databaseName, username: conn.username, password: decrypt(conn.passwordEncrypted) });
    const result = await adapter.killQuery(parseInt(req.params.pid));
    await adapter.disconnect();
    return res.json({ data: result });
  } catch (err: any) { return res.status(500).json({ error: err.message }); }
});

// GET /api/monitor/:connId/stats (database stats)
router.get('/:connId/stats', authMiddleware, async (req: Request, res: Response) => {
  try {
    const conn = await connRepo().findOne({ where: { id: req.params.connId, isActive: true } });
    if (!conn) return res.status(404).json({ error: 'Conexão não encontrada' });

    const adapter = createAdapter(conn.dbType);
    await adapter.connect({ host: conn.host, port: conn.port, database: conn.databaseName, username: conn.username, password: decrypt(conn.passwordEncrypted) });
    
    const pool = (adapter as any).pool;
    const [sizeResult, connResult, cacheResult] = await Promise.all([
      pool.query("SELECT pg_database_size(current_database()) as size"),
      pool.query("SELECT count(*) as total, count(*) FILTER (WHERE state = 'active') as active FROM pg_stat_activity"),
      pool.query("SELECT sum(blks_hit)::float / NULLIF(sum(blks_hit) + sum(blks_read), 0) * 100 as ratio FROM pg_stat_database WHERE datname = current_database()"),
    ]);
    
    await adapter.disconnect();
    return res.json({
      data: {
        databaseSize: parseInt(sizeResult.rows[0].size),
        totalConnections: parseInt(connResult.rows[0].total),
        activeConnections: parseInt(connResult.rows[0].active),
        cacheHitRatio: parseFloat(cacheResult.rows[0]?.ratio || '0').toFixed(2),
      }
    });
  } catch (err: any) { return res.status(500).json({ error: err.message }); }
});

export default router;
