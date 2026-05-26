import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authMiddleware, requireRole } from '../middleware/auth.middleware';
import { AppDataSource } from '../config/database';
import { Alert } from '../entities/alert.entity';
import { AlertHistory } from '../entities/alert-history.entity';
import { validateAlertQuery, scheduleAlert, unscheduleAlert, loadAndScheduleAll } from '../services/alert.scheduler';
import { Connection } from '../entities/connection.entity';
import { getConnCredentials } from '../utils/credentials';
import { createAdapter } from '../adapters/adapter.factory';

const router = Router();
const alertRepo = () => AppDataSource.getRepository(Alert);
const historyRepo = () => AppDataSource.getRepository(AlertHistory);

// GET /api/alerts — list all alerts
router.get('/', authMiddleware, async (req: Request, res: Response) => {
  const alerts = await alertRepo().find({
    relations: ['connection'],
    order: { currentStatus: 'ASC', name: 'ASC' }
  });
  const safe = alerts.map(a => ({
    ...a,
    connection: a.connection ? { id: a.connection.id, name: a.connection.name, dbType: a.connection.dbType, databaseName: a.connection.databaseName, environment: a.connection.environment } : null,
  }));
  return res.json({ data: safe });
});

// GET /api/alerts/summary — quick badge count
// GET /api/alerts/dashboard — alert history aggregated for charts
router.get('/dashboard', authMiddleware, async (req: Request, res: Response) => {
  try {
    const days = parseInt(req.query.days as string) || 7;
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - days);

    const alerts = await alertRepo().find({ relations: ['connection'] });

    const dashboard = await Promise.all(alerts.map(async (alert) => {
      const history = await historyRepo()
        .createQueryBuilder('h')
        .where('h.alertId = :id', { id: alert.id })
        .andWhere('h.checkedAt >= :from', { from: fromDate.toISOString() })
        .orderBy('h.checkedAt', 'ASC')
        .getMany();

      // Aggregate by hour for chart
      const hourly: Record<string, { ok: number; triggered: number; error: number }> = {};
      for (const h of history) {
        const hourKey = new Date(h.checkedAt).toISOString().slice(0, 13) + ':00';
        if (!hourly[hourKey]) hourly[hourKey] = { ok: 0, triggered: 0, error: 0 };
        if (h.status === 'ok') hourly[hourKey].ok++;
        else if (h.status === 'triggered') hourly[hourKey].triggered++;
        else hourly[hourKey].error++;
      }

      const timeline = Object.entries(hourly).map(([time, counts]) => ({ time, ...counts }));

      // Stats
      const totalChecks = history.length;
      const triggeredCount = history.filter(h => h.status === 'triggered').length;
      const errorCount = history.filter(h => h.status === 'error').length;
      const okCount = history.filter(h => h.status === 'ok').length;
      const avgExecutionMs = totalChecks > 0 ? Math.round(history.reduce((s, h) => s + (h.executionMs || 0), 0) / totalChecks) : 0;

      // Last values for scalar alerts
      const lastValues = history.slice(-50).map(h => ({
        time: h.checkedAt,
        value: h.value ? parseFloat(h.value) : null,
        status: h.status,
      })).filter(v => v.value !== null);

      return {
        id: alert.id,
        name: alert.name,
        severity: alert.severity,
        currentStatus: alert.currentStatus,
        connectionName: (alert as any).connection?.name || 'N/A',
        databaseName: (alert as any).connection?.databaseName || 'N/A',
        evaluationType: alert.evaluationType,
        lastCheckedAt: alert.lastCheckedAt,
        lastMessage: alert.lastMessage,
        stats: { totalChecks, triggeredCount, errorCount, okCount, avgExecutionMs },
        timeline,
        lastValues,
      };
    }));

    return res.json({ data: dashboard });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

router.get('/summary', authMiddleware, async (req: Request, res: Response) => {
  const triggered = await alertRepo().count({ where: { currentStatus: 'triggered', enabled: true } });
  const error = await alertRepo().count({ where: { currentStatus: 'error', enabled: true } });
  const total = await alertRepo().count({ where: { enabled: true } });
  return res.json({ data: { triggered, error, total, ok: total - triggered - error } });
});

// GET /api/alerts/:id — single alert with recent history
router.get('/:id', authMiddleware, async (req: Request, res: Response) => {
  const alert = await alertRepo().findOne({ where: { id: req.params.id }, relations: ['connection'] });
  if (!alert) return res.status(404).json({ error: 'Alerta não encontrado' });

  const history = await historyRepo().find({
    where: { alertId: alert.id },
    order: { checkedAt: 'DESC' },
    take: 50,
  });

  return res.json({ data: { alert, history } });
});

// POST /api/alerts — create alert
const createSchema = z.object({
  name: z.string().min(1).max(150),
  connectionId: z.string().uuid(),
  connectionIds: z.array(z.string().uuid()).nullable().optional(),
  query: z.string().min(5),
  evaluationType: z.enum(['row_count', 'scalar_value', 'no_rows', 'has_rows', 'threshold']),
  operator: z.enum(['>', '<', '=', '!=', '>=', '<=']).optional().nullable(),
  threshold: z.string().optional().nullable(),
  intervalSeconds: z.number().int().min(30).max(86400).default(300),
  severity: z.enum(['info', 'warning', 'critical']).default('warning'),
  notifyChannels: z.array(z.string()).default(['ui']),
});

router.post('/', authMiddleware, requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const data = createSchema.parse(req.body);

    // Validate SQL - static
    const validation = validateAlertQuery(data.query);
    if (!validation.valid) return res.status(400).json({ error: validation.error });

    // Validate SQL - real syntax check against the database
    const connRepo = AppDataSource.getRepository(Connection);
    const conn = await connRepo.findOne({ where: { id: data.connectionId } });
    if (!conn) return res.status(400).json({ error: 'Conexão não encontrada' });

    let adapter: any = null;
    try {
      adapter = createAdapter(conn.dbType);
      await adapter.connect({
        host: conn.host,
        port: conn.port,
        database: conn.databaseName || (conn.dbType === 'postgresql' ? 'postgres' : 'master'),
        ...getConnCredentials(conn),
        timeoutMs: 10000,
      });

      const validateSql = conn.dbType === 'mssql'
        ? `SET NOEXEC ON; ${data.query}; SET NOEXEC OFF;`
        : `EXPLAIN ${data.query}`;

      const testResult = await adapter.executeSQL(validateSql);
      await adapter.disconnect();

      if (!testResult.success) {
        return res.status(400).json({ error: `Query com erro de sintaxe: ${testResult.error}`, syntaxError: true });
      }
    } catch (err: any) {
      if (adapter) try { await adapter.disconnect(); } catch {}
      return res.status(400).json({ error: `Erro ao validar query no banco: ${err.message}`, syntaxError: true });
    }

    const alert = alertRepo().create({
      ...data,
      enabled: true,
      currentStatus: 'unknown',
      createdById: req.user!.userId,
    });
    const saved = await alertRepo().save(alert);
    scheduleAlert(saved);

    return res.status(201).json({ data: saved });
  } catch (err: any) {
    if (err.name === 'ZodError') return res.status(400).json({ error: 'Dados inválidos', details: err.errors });
    return res.status(500).json({ error: err.message });
  }
});

// PUT /api/alerts/:id — update alert
router.put('/:id', authMiddleware, requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const alert = await alertRepo().findOne({ where: { id: req.params.id } });
    if (!alert) return res.status(404).json({ error: 'Alerta não encontrado' });

    const { name, query, evaluationType, operator, threshold, intervalSeconds, severity, enabled, notifyChannels } = req.body;

    if (query) {
      const validation = validateAlertQuery(query);
      if (!validation.valid) return res.status(400).json({ error: validation.error });

      // Real syntax check
      const connRepo = AppDataSource.getRepository(Connection);
      const conn = await connRepo.findOne({ where: { id: alert.connectionId } });
      if (conn) {
        let adapter: any = null;
        try {
          adapter = createAdapter(conn.dbType);
          await adapter.connect({
            host: conn.host, port: conn.port,
            database: conn.databaseName || (conn.dbType === 'postgresql' ? 'postgres' : 'master'),
            ...getConnCredentials(conn), timeoutMs: 10000,
          });
          const validateSql = conn.dbType === 'mssql'
            ? `SET NOEXEC ON; ${query}; SET NOEXEC OFF;`
            : `EXPLAIN ${query}`;
          const testResult = await adapter.executeSQL(validateSql);
          await adapter.disconnect();
          if (!testResult.success) {
            return res.status(400).json({ error: `Query com erro de sintaxe: ${testResult.error}`, syntaxError: true });
          }
        } catch (err: any) {
          if (adapter) try { await adapter.disconnect(); } catch {}
          return res.status(400).json({ error: `Erro ao validar query: ${err.message}`, syntaxError: true });
        }
      }

      alert.query = query;
    }
    if (name !== undefined) alert.name = name;
    if (evaluationType !== undefined) alert.evaluationType = evaluationType;
    if (operator !== undefined) alert.operator = operator;
    if (threshold !== undefined) alert.threshold = threshold;
    if (intervalSeconds !== undefined) alert.intervalSeconds = Math.max(30, intervalSeconds);
    if (severity !== undefined) alert.severity = severity;
    if (enabled !== undefined) alert.enabled = enabled;
    if (notifyChannels !== undefined) alert.notifyChannels = notifyChannels;
    if (req.body.connectionIds !== undefined) alert.connectionIds = req.body.connectionIds;

    const saved = await alertRepo().save(alert);

    if (saved.enabled) {
      scheduleAlert(saved);
    } else {
      unscheduleAlert(saved.id);
    }

    return res.json({ data: saved });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// DELETE /api/alerts/:id
router.delete('/:id', authMiddleware, requireRole('admin'), async (req: Request, res: Response) => {
  unscheduleAlert(req.params.id);
  const result = await alertRepo().delete(req.params.id);
  if (result.affected === 0) return res.status(404).json({ error: 'Não encontrado' });
  return res.json({ data: { deleted: true } });
});

// POST /api/alerts/:id/test — run the alert check once manually
router.post('/:id/test', authMiddleware, async (req: Request, res: Response) => {
  const alert = await alertRepo().findOne({ where: { id: req.params.id }, relations: ['connection'] });
  if (!alert) return res.status(404).json({ error: 'Alerta não encontrado' });

  // Import and run check inline
  const { Connection } = require('../entities/connection.entity');
  const { getConnCredentials } = require('../utils/credentials');
  const { createAdapter } = require('../adapters/adapter.factory');

  const conn = alert.connection;
  let adapter: any = null;
  try {
    
    adapter = createAdapter(conn.dbType);
    await adapter.connect({
      host: conn.host, port: conn.port,
      database: conn.databaseName || (conn.dbType === 'postgresql' ? 'postgres' : 'master'),
      ...getConnCredentials(conn, 10000),
    });
    const result = await adapter.executeSQL(alert.query);
    return res.json({ data: { result, rows: result.rows?.slice(0, 10), rowCount: result.rows?.length || 0 } });
  } catch (err: any) {
    return res.json({ data: { error: err.message } });
  } finally {
    if (adapter) try { await adapter.disconnect(); } catch {}
  }
});

// POST /api/alerts/validate-query — validate SQL before saving
router.post('/validate-query', authMiddleware, async (req: Request, res: Response) => {
  const { query, connectionId } = req.body;
  if (!query) return res.status(400).json({ error: 'Query obrigatória' });

  // Step 1: Static validation (keywords check)
  const result = validateAlertQuery(query);
  if (!result.valid) return res.json({ data: result });

  // Step 2: If connectionId provided, do real syntax check against the database
  if (connectionId) {
    const connRepo = AppDataSource.getRepository(Connection);
    const conn = await connRepo.findOne({ where: { id: connectionId } });
    if (!conn) return res.json({ data: { valid: false, error: 'Conexão não encontrada para validação.' } });

    let adapter: any = null;
    try {
      adapter = createAdapter(conn.dbType);
      await adapter.connect({
        host: conn.host,
        port: conn.port,
        database: conn.databaseName || (conn.dbType === 'postgresql' ? 'postgres' : 'master'),
        ...getConnCredentials(conn),
        timeoutMs: 10000,
      });

      // Use SET NOEXEC ON for MSSQL (parses but doesn't execute)
      // Use EXPLAIN for PostgreSQL/MySQL (validates syntax + plan)
      let validateSql: string;
      if (conn.dbType === 'mssql') {
        validateSql = `SET NOEXEC ON; ${query}; SET NOEXEC OFF;`;
      } else if (conn.dbType === 'postgresql') {
        validateSql = `EXPLAIN ${query}`;
      } else {
        validateSql = `EXPLAIN ${query}`;
      }

      const testResult = await adapter.executeSQL(validateSql);
      await adapter.disconnect();

      if (!testResult.success) {
        return res.json({ data: { valid: false, error: `Erro de sintaxe SQL: ${testResult.error}` } });
      }

      return res.json({ data: { valid: true, message: '✅ Query válida — sintaxe verificada no banco de dados.' } });
    } catch (err: any) {
      if (adapter) try { await adapter.disconnect(); } catch {}
      return res.json({ data: { valid: false, error: `Erro ao validar: ${err.message}` } });
    }
  }

  return res.json({ data: { ...result, message: result.valid ? '✅ Validação estática OK (conecte a uma database para validar sintaxe completa).' : undefined } });
});

export default router;
