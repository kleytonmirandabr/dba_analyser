import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { AppDataSource } from '../config/database';
import { Connection } from '../entities/connection.entity';
import { AuditLog } from '../entities/audit-log.entity';
import { decrypt } from '../config/encryption';
import { PostgresAdapter } from '../adapters/postgres.adapter';

const router = Router();
const connRepo = () => AppDataSource.getRepository(Connection);

// Blocked keywords for readonly mode
const WRITE_KEYWORDS = ['INSERT', 'UPDATE', 'DELETE', 'DROP', 'ALTER', 'TRUNCATE', 'CREATE', 'GRANT', 'REVOKE'];

function isWriteQuery(sql: string): boolean {
  const normalized = sql.trim().toUpperCase().replace(/\/\*.*?\*\//gs, '').replace(/--.*$/gm, '');
  return WRITE_KEYWORDS.some(kw => normalized.startsWith(kw));
}

// POST /api/query/:connId/execute
router.post('/:connId/execute', authMiddleware, async (req: Request, res: Response) => {
  const { sql, limit = 500 } = req.body;
  if (!sql?.trim()) return res.status(400).json({ error: 'SQL é obrigatório' });

  try {
    const conn = await connRepo().findOne({ where: { id: req.params.connId, isActive: true } });
    if (!conn) return res.status(404).json({ error: 'Conexão não encontrada' });

    // Block writes in readonly mode
    if (conn.mode === 'readonly' && isWriteQuery(sql)) {
      return res.status(403).json({ error: 'Conexão em modo somente-leitura. Use o workflow de execução para comandos de escrita.' });
    }

    const adapter = new PostgresAdapter();
    await adapter.connect({ host: conn.host, port: conn.port, database: conn.databaseName, username: conn.username, password: decrypt(conn.passwordEncrypted), timeoutMs: conn.queryTimeoutMs });

    // Add LIMIT if SELECT and no limit present
    let finalSql = sql.trim();
    if (finalSql.toUpperCase().startsWith('SELECT') && !finalSql.toUpperCase().includes('LIMIT')) {
      finalSql = `${finalSql} LIMIT ${limit}`;
    }

    const result = await adapter.executeSQL(finalSql);
    await adapter.disconnect();

    // Audit
    AppDataSource.getRepository(AuditLog).save({
      userId: req.user!.userId,
      action: 'QUERY',
      connectionId: conn.id,
      sqlText: sql.slice(0, 2000),
      result: result.success ? 'SUCCESS' : 'ERROR',
      durationMs: result.durationMs,
      ipAddress: req.ip,
    }).catch(() => {});

    return res.json({ data: result });
  } catch (err: any) { return res.status(500).json({ error: err.message }); }
});

// POST /api/query/:connId/explain
router.post('/:connId/explain', authMiddleware, async (req: Request, res: Response) => {
  const { sql } = req.body;
  if (!sql?.trim()) return res.status(400).json({ error: 'SQL é obrigatório' });

  try {
    const conn = await connRepo().findOne({ where: { id: req.params.connId, isActive: true } });
    if (!conn) return res.status(404).json({ error: 'Conexão não encontrada' });

    const adapter = new PostgresAdapter();
    await adapter.connect({ host: conn.host, port: conn.port, database: conn.databaseName, username: conn.username, password: decrypt(conn.passwordEncrypted) });
    const result = await adapter.executeSQL(`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${sql}`);
    await adapter.disconnect();
    return res.json({ data: result });
  } catch (err: any) { return res.status(500).json({ error: err.message }); }
});

export default router;
