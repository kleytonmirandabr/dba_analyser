import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { requireFeature } from '../middleware/feature.middleware';
import { AppDataSource } from '../config/database';
import { Connection } from '../entities/connection.entity';
import { TableGrowthRule } from '../entities/table-growth-rule.entity';
import { TableSnapshot } from '../entities/table-snapshot.entity';
import { runManualSnapshot, getGrowthData, GrowthAnomaly, snapshotConnection } from '../services/growth.scheduler';

const router = Router();
const ruleRepo = () => AppDataSource.getRepository(TableGrowthRule);
const snapshotRepo = () => AppDataSource.getRepository(TableSnapshot);

// GET /api/growth/:connectionId — growth data for a connection
router.get('/:connectionId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const days = parseInt(req.query.days as string) || 7;
    const data = await getGrowthData(req.params.connectionId, days);
    return res.json({ data });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/growth/:connectionId/anomalies — latest anomalies
router.get('/:connectionId/anomalies', authMiddleware, async (req: Request, res: Response) => {
  try {
    const data = await getGrowthData(req.params.connectionId, 7);
    const anomalies: GrowthAnomaly[] = [];

    for (const table of data) {
      if (table.avgDailyGrowth > 0 && table.dailyDelta > 0) {
        const ratio = table.dailyDelta / table.avgDailyGrowth;
        if (ratio >= 3) {
          anomalies.push({
            connectionId: req.params.connectionId, connectionName: '',
            schemaName: table.schema, tableName: table.table,
            type: 'spike', severity: ratio > 10 ? 'critical' : 'warning',
            todayRows: table.currentRows, yesterdayRows: table.currentRows - table.dailyDelta,
            delta: table.dailyDelta, avgDailyGrowth: table.avgDailyGrowth, ratio,
            message: `Crescimento ${ratio.toFixed(1)}x acima da média`
          });
        }
      }
      if (table.avgDailyGrowth > 10 && table.dailyDelta === 0) {
        anomalies.push({
          connectionId: req.params.connectionId, connectionName: '',
          schemaName: table.schema, tableName: table.table,
          type: 'stopped', severity: 'warning',
          todayRows: table.currentRows, yesterdayRows: table.currentRows,
          delta: 0, avgDailyGrowth: table.avgDailyGrowth, ratio: 0,
          message: `Tabela parou de crescer (média: +${table.avgDailyGrowth}/dia)`
        });
      }
      if (table.dailyDelta < 0 && table.currentRows > 0) {
        const shrinkPct = (Math.abs(table.dailyDelta) / (table.currentRows - table.dailyDelta)) * 100;
        if (shrinkPct > 10) {
          anomalies.push({
            connectionId: req.params.connectionId, connectionName: '',
            schemaName: table.schema, tableName: table.table,
            type: 'data_loss', severity: 'critical',
            todayRows: table.currentRows, yesterdayRows: table.currentRows - table.dailyDelta,
            delta: table.dailyDelta, avgDailyGrowth: table.avgDailyGrowth, ratio: 0,
            message: `Tabela encolheu ${shrinkPct.toFixed(1)}%`
          });
        }
      }
    }

    return res.json({ data: anomalies });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/growth/snapshot — trigger manual snapshot
router.post('/snapshot', authMiddleware, requireFeature('growth.snapshot'), async (req: Request, res: Response) => {
  try {
    const anomalies = await runManualSnapshot();
    return res.json({ data: { message: 'Snapshot realizado', anomalies } });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/growth/snapshot/stream — SSE progress stream for snapshot
router.get('/snapshot/stream', authMiddleware, requireFeature('growth.snapshot'), async (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  try {
    const connRepo = AppDataSource.getRepository(Connection);
    const connections = await connRepo.find({ where: { isActive: true } });
    const withDb = connections.filter(c => c.databaseName);
    const total = withDb.length;
    let done = 0;

    res.write(`data: ${JSON.stringify({ type: 'start', total, message: `Iniciando snapshot de ${total} databases...` })}\n\n`);

    for (const conn of withDb) {
      done++;
      res.write(`data: ${JSON.stringify({ type: 'progress', done, total, current: conn.name, pct: Math.round((done / total) * 100) })}\n\n`);
      try {
        await snapshotConnection(conn);
      } catch (err: any) {
        res.write(`data: ${JSON.stringify({ type: 'error', connection: conn.name, error: err.message })}\n\n`);
      }
    }

    res.write(`data: ${JSON.stringify({ type: 'done', total: done, message: 'Snapshot concluído!' })}\n\n`);
    res.end();
  } catch (err: any) {
    res.write(`data: ${JSON.stringify({ type: 'error', error: err.message })}\n\n`);
    res.end();
  }
});

// GET /api/growth/:connectionId/rules — list rules for a connection
router.get('/:connectionId/rules', authMiddleware, async (req: Request, res: Response) => {
  const rules = await ruleRepo().find({ where: { connectionId: req.params.connectionId } });
  return res.json({ data: rules });
});

// POST /api/growth/:connectionId/rules — create/update rule
router.post('/:connectionId/rules', authMiddleware, requireFeature('growth.snapshot'), async (req: Request, res: Response) => {
  try {
    const { schemaName, tableName, maxDailyGrowthPct, maxDailyGrowthRows, minDailyGrowthRows, maxShrinkPct } = req.body;

    let rule = await ruleRepo().findOne({
      where: { connectionId: req.params.connectionId, schemaName, tableName }
    });

    if (rule) {
      if (maxDailyGrowthPct !== undefined) rule.maxDailyGrowthPct = maxDailyGrowthPct;
      if (maxDailyGrowthRows !== undefined) rule.maxDailyGrowthRows = maxDailyGrowthRows;
      if (minDailyGrowthRows !== undefined) rule.minDailyGrowthRows = minDailyGrowthRows;
      if (maxShrinkPct !== undefined) rule.maxShrinkPct = maxShrinkPct;
    } else {
      rule = ruleRepo().create({
        connectionId: req.params.connectionId,
        schemaName, tableName,
        maxDailyGrowthPct: maxDailyGrowthPct || 300,
        maxDailyGrowthRows: maxDailyGrowthRows || null,
        minDailyGrowthRows: minDailyGrowthRows || null,
        maxShrinkPct: maxShrinkPct || 10,
      });
    }

    const saved = await ruleRepo().save(rule);
    return res.json({ data: saved });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// DELETE /api/growth/rules/:id
router.delete('/rules/:id', authMiddleware, requireFeature('growth.snapshot'), async (req: Request, res: Response) => {
  await ruleRepo().delete(req.params.id);
  return res.json({ data: { deleted: true } });
});

export default router;
