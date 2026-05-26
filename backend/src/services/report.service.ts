import { AppDataSource } from '../config/database';
import { Connection } from '../entities/connection.entity';
import { AlertHistory } from '../entities/alert-history.entity';
import { TableSnapshot } from '../entities/table-snapshot.entity';
import { getConnCredentials } from '../utils/credentials';
import { createAdapter } from '../adapters/adapter.factory';
import { runDiagnostics } from './diagnostics.engine';
import { Between, MoreThan } from 'typeorm';

export interface ReportData {
  generatedAt: string;
  period: { from: string; to: string };
  connections: ConnectionReport[];
  alertsSummary: { total: number; critical: number; warning: number; resolved: number };
  overallScore: number;
}

export interface ConnectionReport {
  name: string;
  dbType: string;
  healthScore: number;
  databaseSize: string;
  activeConnections: number;
  topSlowQueries: { query: string; meanTimeMs: number; calls: number }[];
  growthAnomaly: boolean;
  diagnosticsSummary: string;
}

export async function collectReportData(periodDays = 7): Promise<ReportData> {
  const connRepo = AppDataSource.getRepository(Connection);
  const alertHistRepo = AppDataSource.getRepository(AlertHistory);

  const now = new Date();
  const from = new Date(now.getTime() - periodDays * 24 * 60 * 60 * 1000);

  const allConns = await connRepo.find({ where: { isActive: true } });
  const activeConns = allConns.filter(c => c.databaseName);

  const connections: ConnectionReport[] = [];
  let totalScore = 0;

  for (const conn of activeConns.slice(0, 10)) { // limit to 10 for performance
    try {
      const adapter = createAdapter(conn.dbType);
      await adapter.connect(getConnCredentials(conn));

      let healthScore = 75;
      let databaseSize = 'N/A';
      let activeConnections = 0;
      let topSlowQueries: any[] = [];
      let diagnosticsSummary = '';

      try {
        const diag = await runDiagnostics(adapter as any, conn.dbType);
        healthScore = diag.score;
        diagnosticsSummary = diag.diagnostics.slice(0, 3).map(d => d.symptom).join('; ') || 'Sem problemas detectados';
      } catch {}

      try {
        if ((adapter as any).getHealthOverview) {
          const overview = await (adapter as any).getHealthOverview();
          databaseSize = formatBytes(overview.totalSizeBytes);
          activeConnections = overview.activeConnections;
        }
      } catch {}

      try {
        if ((adapter as any).getSlowQueries) {
          const sq = await (adapter as any).getSlowQueries(3);
          topSlowQueries = sq.map((q: any) => ({ query: q.query.slice(0, 120), meanTimeMs: Math.round(q.meanTimeMs), calls: q.calls }));
        }
      } catch {}

      await adapter.disconnect();

      connections.push({
        name: conn.name,
        dbType: conn.dbType,
        healthScore,
        databaseSize,
        activeConnections,
        topSlowQueries,
        growthAnomaly: false,
        diagnosticsSummary,
      });
      totalScore += healthScore;
    } catch {
      connections.push({
        name: conn.name, dbType: conn.dbType, healthScore: 0,
        databaseSize: 'Erro', activeConnections: 0, topSlowQueries: [],
        growthAnomaly: false, diagnosticsSummary: 'Falha ao conectar',
      });
    }
  }

  // Alerts summary
  let alertsSummary = { total: 0, critical: 0, warning: 0, resolved: 0 };
  try {
    const alerts = await alertHistRepo.find({
      where: { triggeredAt: MoreThan(from) },
    });
    alertsSummary.total = alerts.length;
    alertsSummary.critical = alerts.filter((a: any) => a.severity === 'critical').length;
    alertsSummary.warning = alerts.filter((a: any) => a.severity === 'warning').length;
    alertsSummary.resolved = alerts.filter((a: any) => a.resolvedAt).length;
  } catch {}

  const overallScore = connections.length > 0 ? Math.round(totalScore / connections.length) : 0;

  return {
    generatedAt: now.toISOString(),
    period: { from: from.toISOString(), to: now.toISOString() },
    connections,
    alertsSummary,
    overallScore,
  };
}

function formatBytes(bytes: number): string {
  if (bytes > 1e9) return `${(bytes / 1e9).toFixed(1)} GB`;
  if (bytes > 1e6) return `${(bytes / 1e6).toFixed(1)} MB`;
  return `${(bytes / 1e3).toFixed(0)} KB`;
}
