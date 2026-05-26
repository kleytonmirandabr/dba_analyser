import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { AppDataSource } from '../config/database';
import { Connection } from '../entities/connection.entity';
import { QueryAdvice } from '../entities/query-advice.entity';
import { getConnCredentials } from '../utils/credentials';
import { createAdapter } from '../adapters/adapter.factory';
import { analyzeExplainHeuristic, analyzeWithAI } from '../services/ai-advisor.service';

const router = Router();
const connRepo = () => AppDataSource.getRepository(Connection);
const adviceRepo = () => AppDataSource.getRepository(QueryAdvice);

// POST /api/advisor/:connId/analyze — analyze a single query
router.post('/:connId/analyze', authMiddleware, async (req: Request, res: Response) => {
  const { sql, analyze: runAnalyze = false, useAI = false } = req.body;
  if (!sql?.trim()) return res.status(400).json({ error: 'SQL é obrigatório' });

  let adapter: any = null;
  try {
    const conn = await connRepo().findOne({ where: { id: req.params.connId } });
    if (!conn) return res.status(404).json({ error: 'Conexão não encontrada' });

    adapter = createAdapter(conn.dbType);
    await adapter.connect(getConnCredentials(conn));

    if (!adapter.getExplainPlan) {
      return res.status(501).json({ error: 'EXPLAIN não suportado para este tipo de banco' });
    }

    // Get explain plan
    const explain = await adapter.getExplainPlan(sql, runAnalyze);

    // Heuristic analysis (always runs)
    const result = analyzeExplainHeuristic(explain, sql, conn.dbType);

    // AI analysis (opt-in, requires key)
    if (useAI) {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        return res.status(400).json({ error: 'OPENAI_API_KEY não configurada. Configure em Settings ou variável de ambiente.' });
      }

      // Get table context for better AI suggestions
      let tableContext = '';
      try {
        const tables = extractTablesFromQuery(sql);
        for (const t of tables.slice(0, 3)) {
          const cols = await adapter.listColumns(t.schema || 'public', t.name);
          const indexes = await adapter.listIndexes(t.schema || 'public', t.name);
          tableContext += `\nTabela ${t.name}: ${cols.map((c: any) => `${c.name} (${c.type})`).join(', ')}\n`;
          tableContext += `Índices: ${indexes.map((i: any) => `${i.name} ON (${i.columns.join(', ')})`).join('; ')}\n`;
        }
      } catch {}

      const aiResult = await analyzeWithAI(explain, sql, conn.dbType, tableContext, apiKey);
      result.optimizedQuery = aiResult.optimizedQuery;
      result.suggestions.push(...aiResult.aiSuggestions);
      result.summary = aiResult.aiSummary || result.summary;
    }

    // Cache the advice
    const advice = adviceRepo().create({
      connectionId: req.params.connId,
      originalQuery: sql,
      optimizedQuery: result.optimizedQuery || null,
      explainPlan: explain,
      suggestions: result.suggestions,
      summary: result.summary,
      severity: result.severity,
      aiPowered: useAI,
      userId: (req as any).user?.id,
    });
    await adviceRepo().save(advice);

    return res.json({ data: { ...result, id: advice.id } });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  } finally {
    if (adapter) await adapter.disconnect();
  }
});

// GET /api/advisor/:connId/auto — auto-analyze top slow queries
router.get('/:connId/auto', authMiddleware, async (req: Request, res: Response) => {
  let adapter: any = null;
  try {
    const conn = await connRepo().findOne({ where: { id: req.params.connId } });
    if (!conn) return res.status(404).json({ error: 'Conexão não encontrada' });

    adapter = createAdapter(conn.dbType);
    await adapter.connect(getConnCredentials(conn));

    if (!adapter.getSlowQueries || !adapter.getExplainPlan) {
      return res.status(501).json({ error: 'Não suportado para este tipo de banco' });
    }

    const slowQueries = await adapter.getSlowQueries(5);
    const results = [];

    for (const sq of slowQueries) {
      try {
        // Skip non-SELECT queries for EXPLAIN
        const normalized = sq.query.trim().toUpperCase();
        if (!normalized.startsWith('SELECT')) continue;

        const explain = await adapter.getExplainPlan(sq.query, false);
        const analysis = analyzeExplainHeuristic(explain, sq.query, conn.dbType);
        
        if (analysis.suggestions.length > 0) {
          results.push({
            ...analysis,
            stats: { calls: sq.calls, meanTimeMs: sq.meanTimeMs, totalTimeMs: sq.totalTimeMs },
          });
        }
      } catch {
        // Skip queries that fail EXPLAIN (e.g., utility statements)
      }
    }

    // Sort by severity then by total time
    const sevOrder: Record<string, number> = { critical: 0, warning: 1, info: 2, ok: 3 };
    results.sort((a, b) => (sevOrder[a.severity] || 3) - (sevOrder[b.severity] || 3));

    return res.json({ data: results });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  } finally {
    if (adapter) await adapter.disconnect();
  }
});

// GET /api/advisor/:connId/history — past advice
router.get('/:connId/history', authMiddleware, async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const history = await adviceRepo().find({
      where: { connectionId: req.params.connId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
    return res.json({ data: history });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Helper: extract table names from SQL
function extractTablesFromQuery(sql: string): { schema?: string; name: string }[] {
  const tables: { schema?: string; name: string }[] = [];
  const fromMatch = sql.match(/FROM\s+([\w."]+)/gi) || [];
  const joinMatch = sql.match(/JOIN\s+([\w."]+)/gi) || [];
  
  for (const m of [...fromMatch, ...joinMatch]) {
    const tablePart = m.replace(/^(FROM|JOIN)\s+/i, '').replace(/"/g, '');
    const parts = tablePart.split('.');
    if (parts.length === 2) tables.push({ schema: parts[0], name: parts[1] });
    else tables.push({ name: parts[0] });
  }
  return tables;
}

export default router;
