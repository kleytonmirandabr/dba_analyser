import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { AppDataSource } from '../config/database';
import { Connection } from '../entities/connection.entity';
import { HealthSnapshot } from '../entities/health-snapshot.entity';
import { getConnCredentials } from '../utils/credentials';
import { createAdapter } from '../adapters/adapter.factory';
import { runDiagnostics } from '../services/diagnostics.engine';

const router = Router();
const connRepo = () => AppDataSource.getRepository(Connection);
const snapRepo = () => AppDataSource.getRepository(HealthSnapshot);

// GET /api/diagnostics/connections — list available connections
router.get('/connections', authMiddleware, async (_req: Request, res: Response) => {
  const connections = await connRepo().find({ where: { isActive: true } });
  const safe = connections.map(c => ({
    id: c.id, name: c.name, host: c.host, port: c.port,
    databaseName: c.databaseName, dbType: c.dbType, environment: c.environment,
  }));
  return res.json({ data: safe });
});

// POST /api/diagnostics/:connId/analyze — run diagnostics on demand
router.post('/:connId/analyze', authMiddleware, async (req: Request, res: Response) => {
  try {
    const conn = await connRepo().findOne({ where: { id: req.params.connId, isActive: true } });
    if (!conn) return res.status(404).json({ error: 'Conexão não encontrada' });

    const adapter = createAdapter(conn.dbType);
    await adapter.connect(getConnCredentials(conn));

    const report = await runDiagnostics(adapter, conn.dbType);
    await adapter.disconnect();

    // Save snapshot
    const snapshot = snapRepo().create({
      connectionId: conn.id,
      connectionName: conn.name,
      ple: report.metrics.ple || null,
      cpuSqlPercent: report.metrics.cpuSql || null,
      cpuTotalPercent: report.metrics.cpuTotal || null,
      totalConnections: report.metrics.totalSessions || null,
      activeConnections: report.metrics.activeSessions || null,
      tempdbFreePct: report.metrics.tempdbFreePct || null,
      tempdbUsedMB: report.metrics.tempdbTotalMB ? report.metrics.tempdbTotalMB * (1 - (report.metrics.tempdbFreePct || 0) / 100) : null,
      ioReadLatencyMs: report.metrics.ioReadMs || null,
      ioWriteLatencyMs: report.metrics.ioWriteMs || null,
      topWaitsJson: report.metrics.topWaits ? JSON.stringify(report.metrics.topWaits) : null,
      logUsagePct: report.metrics.logUsagePct || null,
      healthScore: report.score,
      diagnosticsJson: JSON.stringify(report.diagnostics),
    });
    await snapRepo().save(snapshot);

    return res.json({ data: report });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/diagnostics/:connId/history — last 24h snapshots
router.get('/:connId/history', authMiddleware, async (req: Request, res: Response) => {
  const hours = parseInt(req.query.hours as string) || 24;
  const since = new Date(Date.now() - hours * 3600000);
  const snapshots = await snapRepo()
    .createQueryBuilder('s')
    .where('s.connectionId = :id AND s.collectedAt > :since', { id: req.params.connId, since })
    .orderBy('s.collectedAt', 'ASC')
    .getMany();
  return res.json({ data: snapshots });
});

export default router;
