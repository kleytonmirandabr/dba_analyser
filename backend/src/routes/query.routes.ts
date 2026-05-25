import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { AppDataSource } from '../config/database';
import { Connection } from '../entities/connection.entity';
import { AuditLog } from '../entities/audit-log.entity';
import { getConnCredentials } from '../utils/credentials';
import { createAdapter } from '../adapters/adapter.factory';

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

    const adapter = createAdapter(conn.dbType);
    await adapter.connect(getConnCredentials(conn));

    // Add row limit if SELECT and no limit present
    let finalSql = sql.trim();
    const upperSql = finalSql.toUpperCase();
    if (upperSql.startsWith('SELECT')) {
      const hasLimit = upperSql.includes('LIMIT') || upperSql.includes('TOP ') || upperSql.includes('OFFSET') || upperSql.includes('FETCH NEXT');
      if (!hasLimit) {
        if (conn.dbType === 'postgresql' || conn.dbType === 'mysql') {
          finalSql = `${finalSql} LIMIT ${limit}`;
        } else if (conn.dbType === 'mssql') {
          finalSql = finalSql.replace(/^SELECT/i, `SELECT TOP ${limit}`);
        }
      }
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

    const adapter = createAdapter(conn.dbType);
    await adapter.connect(getConnCredentials(conn));
    const result = await adapter.executeSQL(`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${sql}`);
    await adapter.disconnect();
    return res.json({ data: result });
  } catch (err: any) { return res.status(500).json({ error: err.message }); }
});

export default router;
