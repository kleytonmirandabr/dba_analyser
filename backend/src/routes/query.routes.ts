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

// Dangerous operations ALWAYS blocked in production
const ALWAYS_BLOCKED_PROD = ['DROP DATABASE', 'TRUNCATE TABLE', 'DROP TABLE', 'DROP SCHEMA'];

function isWriteQuery(sql: string): boolean {
  const normalized = sql.trim().toUpperCase().replace(/\/\*.*?\*\//gs, '').replace(/--.*$/gm, '');
  return WRITE_KEYWORDS.some(kw => normalized.startsWith(kw));
}

interface SafetyCheck {
  safe: boolean;
  warning?: string;
  severity?: 'block' | 'warn';
  suggestion?: string;
}

function checkSqlSafety(sql: string, environment: string): SafetyCheck {
  const normalized = sql.trim().toUpperCase()
    .replace(/\/\*.*?\*\//gs, '')
    .replace(/--.*$/gm, '')
    .replace(/\s+/g, ' ')
    .trim();

  // Always block dangerous operations in PROD
  if (environment === 'prod') {
    for (const op of ALWAYS_BLOCKED_PROD) {
      if (normalized.includes(op)) {
        return { safe: false, severity: 'block', warning: `Operação "${op}" bloqueada em ambiente de PRODUÇÃO.`, suggestion: 'Use o workflow de execução com aprovação para operações destrutivas em produção.' };
      }
    }
  }

  // UPDATE without WHERE
  if (normalized.startsWith('UPDATE') && !normalized.includes(' WHERE ')) {
    return {
      safe: false, severity: 'block',
      warning: 'UPDATE sem cláusula WHERE detectado. Isso afetaria TODAS as linhas da tabela.',
      suggestion: 'Adicione uma cláusula WHERE para limitar as linhas afetadas. Ex: WHERE id = 123'
    };
  }

  // DELETE without WHERE
  if (normalized.startsWith('DELETE') && !normalized.includes(' WHERE ')) {
    return {
      safe: false, severity: 'block',
      warning: 'DELETE sem cláusula WHERE detectado. Isso apagaria TODAS as linhas da tabela.',
      suggestion: 'Adicione uma cláusula WHERE para limitar as linhas afetadas. Ex: WHERE id = 123'
    };
  }

  // UPDATE/DELETE with WHERE 1=1 or WHERE TRUE (common bypass)
  if ((normalized.startsWith('UPDATE') || normalized.startsWith('DELETE')) &&
      (normalized.includes('WHERE 1=1') || normalized.includes('WHERE 1 = 1') || normalized.includes('WHERE TRUE'))) {
    return {
      safe: false, severity: 'block',
      warning: 'WHERE 1=1 / WHERE TRUE é equivalente a não ter WHERE. Isso afetaria TODAS as linhas.',
      suggestion: 'Use uma condição real no WHERE. Ex: WHERE id IN (1, 2, 3)'
    };
  }

  // SELECT * without WHERE on prod (warn only)
  if (environment === 'prod' && normalized.startsWith('SELECT') && !normalized.includes(' WHERE ') && !normalized.includes(' TOP ') && !normalized.includes(' LIMIT ')) {
    return {
      safe: true, severity: 'warn',
      warning: 'SELECT sem WHERE em produção pode retornar muitas linhas.',
      suggestion: 'O sistema adicionará LIMIT/TOP automaticamente, mas considere adicionar um WHERE.'
    };
  }

  return { safe: true };
}

// POST /api/query/:connId/execute
router.post('/:connId/execute', authMiddleware, async (req: Request, res: Response) => {
  const { sql, limit = 500, bypassSafety = false } = req.body;
  if (!sql?.trim()) return res.status(400).json({ error: 'SQL é obrigatório' });

  try {
    const conn = await connRepo().findOne({ where: { id: req.params.connId, isActive: true } });
    if (!conn) return res.status(404).json({ error: 'Conexão não encontrada' });

    // Block writes in readonly mode
    if (conn.mode === 'readonly' && isWriteQuery(sql)) {
      return res.status(403).json({ error: 'Conexão em modo somente-leitura. Use o workflow de execução para comandos de escrita.' });
    }

    // SQL Safety check
    const safety = checkSqlSafety(sql, conn.environment);
    if (!safety.safe && safety.severity === 'block') {
      return res.status(422).json({
        error: safety.warning,
        data: { success: false, error: safety.warning },
        safety: { severity: safety.severity, suggestion: safety.suggestion }
      });
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

    // Include safety warning in response if applicable
    const response: any = { data: result };
    if (safety.severity === 'warn') {
      response.warning = { message: safety.warning, suggestion: safety.suggestion };
    }

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

    return res.json(response);
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