import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authMiddleware, requireRole } from '../middleware/auth.middleware';
import { AppDataSource } from '../config/database';
import { Alert } from '../entities/alert.entity';
import { AlertHistory } from '../entities/alert-history.entity';
import { validateAlertQuery, scheduleAlert, unscheduleAlert, loadAndScheduleAll } from '../services/alert.scheduler';

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

    // Validate SQL
    const validation = validateAlertQuery(data.query);
    if (!validation.valid) return res.status(400).json({ error: validation.error });

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
  const { decrypt } = require('../config/encryption');
  const { createAdapter } = require('../adapters/adapter.factory');

  const conn = alert.connection;
  let adapter: any = null;
  try {
    const password = decrypt(conn.passwordEncrypted);
    adapter = createAdapter(conn.dbType);
    await adapter.connect({
      host: conn.host, port: conn.port,
      database: conn.databaseName || (conn.dbType === 'postgresql' ? 'postgres' : 'master'),
      username: conn.username, password, timeoutMs: 10000,
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
  const { query } = req.body;
  if (!query) return res.status(400).json({ error: 'Query obrigatória' });
  const result = validateAlertQuery(query);
  return res.json({ data: result });
});

export default router;
