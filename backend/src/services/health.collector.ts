import { AppDataSource } from '../config/database';
import { Connection } from '../entities/connection.entity';
import { HealthSnapshot } from '../entities/health-snapshot.entity';
import { getConnCredentials } from '../utils/credentials';
import { createAdapter } from '../adapters/adapter.factory';
import { runDiagnostics } from './diagnostics.engine';

const COLLECT_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
const MAX_PARALLEL = 5;

export function initHealthCollector() {
  console.log('[HealthCollector] Initializing — runs every 1h');

  // First run after 2 minutes (let everything connect first)
  setTimeout(() => {
    collectAll();
    setInterval(collectAll, COLLECT_INTERVAL_MS);
  }, 120000);
}

async function collectAll() {
  const connRepo = AppDataSource.getRepository(Connection);
  const snapRepo = AppDataSource.getRepository(HealthSnapshot);

  const connections = await connRepo.find({ where: { isActive: true } });
  // Only connections with a database (not server-level)
  const withDb = connections.filter(c => c.databaseName && c.databaseName.length > 0);

  console.log(`[HealthCollector] Collecting ${withDb.length} databases...`);

  // Process in batches of MAX_PARALLEL
  for (let i = 0; i < withDb.length; i += MAX_PARALLEL) {
    const batch = withDb.slice(i, i + MAX_PARALLEL);
    await Promise.allSettled(batch.map(async (conn) => {
      try {
        const adapter = createAdapter(conn.dbType);
        await adapter.connect(getConnCredentials(conn));
        const report = await runDiagnostics(adapter, conn.dbType);
        await adapter.disconnect();

        const snapshot = snapRepo.create({
          connectionId: conn.id,
          connectionName: conn.name,
          ple: report.metrics.ple || null,
          cpuSqlPercent: report.metrics.cpuSql || null,
          cpuTotalPercent: report.metrics.cpuTotal || null,
          totalConnections: report.metrics.totalSessions || null,
          activeConnections: report.metrics.activeSessions || null,
          tempdbFreePct: report.metrics.tempdbFreePct || null,
          ioReadLatencyMs: report.metrics.ioReadMs || null,
          ioWriteLatencyMs: report.metrics.ioWriteMs || null,
          topWaitsJson: report.metrics.topWaits ? JSON.stringify(report.metrics.topWaits) : null,
          logUsagePct: report.metrics.logUsagePct || null,
          healthScore: report.score,
          diagnosticsJson: JSON.stringify(report.diagnostics),
        });
        await snapRepo.save(snapshot);
      } catch (err: any) {
        console.error(`[HealthCollector] Error on ${conn.name}: ${err.message}`);
      }
    }));
  }

  console.log(`[HealthCollector] Done. Next run in 1h.`);
}
