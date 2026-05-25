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

    let data: any;
    if (conn.dbType === 'postgresql') {
      const pool = (adapter as any).pool;
      const [sizeResult, connResult, cacheResult] = await Promise.all([
        pool.query("SELECT pg_database_size(current_database()) as size"),
        pool.query("SELECT count(*) as total, count(*) FILTER (WHERE state = 'active') as active FROM pg_stat_activity"),
        pool.query("SELECT sum(blks_hit)::float / NULLIF(sum(blks_hit) + sum(blks_read), 0) * 100 as ratio FROM pg_stat_database WHERE datname = current_database()"),
      ]);
      data = {
        databaseSize: parseInt(sizeResult.rows[0].size),
        totalConnections: parseInt(connResult.rows[0].total),
        activeConnections: parseInt(connResult.rows[0].active),
        cacheHitRatio: parseFloat(cacheResult.rows[0].ratio || '0'),
      };
    } else {
      const query = (adapter as any).query.bind(adapter);
      const [sizeResult, connResult] = await Promise.all([
        query("SELECT SUM(CAST(size AS BIGINT) * 8 * 1024) as size FROM sys.database_files"),
        query("SELECT count(*) as total, SUM(CASE WHEN status = 'running' THEN 1 ELSE 0 END) as active FROM sys.dm_exec_sessions WHERE is_user_process = 1 AND database_id = DB_ID()"),
      ]);
      data = {
        databaseSize: parseInt(sizeResult[0]?.size || '0'),
        totalConnections: parseInt(connResult[0]?.total || '0'),
        activeConnections: parseInt(connResult[0]?.active || '0'),
        cacheHitRatio: 95,
      };
    }

    await adapter.disconnect();
    return res.json({ data });
  } catch (err: any) { return res.status(500).json({ error: err.message }); }
});

export default router;
