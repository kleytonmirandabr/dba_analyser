import { AppDataSource } from '../config/database';
import { Connection } from '../entities/connection.entity';
import { TableSnapshot } from '../entities/table-snapshot.entity';
import { TableGrowthRule } from '../entities/table-growth-rule.entity';
import { Alert } from '../entities/alert.entity';
import { AlertHistory } from '../entities/alert-history.entity';
import { getConnCredentials } from '../utils/credentials';
import { createAdapter } from '../adapters/adapter.factory';
import { Server as SocketIO } from 'socket.io';

let io: SocketIO | null = null;
let cronTimer: NodeJS.Timeout | null = null;

export interface GrowthAnomaly {
  connectionId: string;
  connectionName: string;
  schemaName: string;
  tableName: string;
  type: 'spike' | 'stopped' | 'data_loss' | 'trend';
  severity: 'info' | 'warning' | 'critical';
  todayRows: number;
  yesterdayRows: number;
  delta: number;
  avgDailyGrowth: number;
  ratio: number;
  message: string;
}

export function initGrowthScheduler(socketIo: SocketIO) {
  io = socketIo;
  console.log('[GrowthScheduler] Initializing...');

  // Schedule daily at midnight UTC
  scheduleDaily();

  // Also run on startup if no snapshot exists for today
  setTimeout(() => checkAndRunIfNeeded(), 10000);
}

function scheduleDaily() {
  // Calculate ms until next midnight UTC
  const now = new Date();
  const nextMidnight = new Date(now);
  nextMidnight.setUTCHours(0, 0, 0, 0);
  nextMidnight.setUTCDate(nextMidnight.getUTCDate() + 1);
  const msUntilMidnight = nextMidnight.getTime() - now.getTime();

  console.log(`[GrowthScheduler] Next run in ${(msUntilMidnight / 3600000).toFixed(1)}h (midnight UTC)`);

  // First timeout to midnight, then interval every 24h
  cronTimer = setTimeout(() => {
    runDailySnapshot();
    cronTimer = setInterval(runDailySnapshot, 24 * 60 * 60 * 1000);
  }, msUntilMidnight);
}

async function checkAndRunIfNeeded() {
  const snapshotRepo = AppDataSource.getRepository(TableSnapshot);
  const today = new Date().toISOString().split('T')[0];
  const existing = await snapshotRepo.findOne({ where: { snapshotDate: today } });
  if (!existing) {
    console.log('[GrowthScheduler] No snapshot for today, running now...');
    await runDailySnapshot();
  } else {
    console.log('[GrowthScheduler] Snapshot already exists for today');
  }
}

export async function runDailySnapshot(): Promise<GrowthAnomaly[]> {
  console.log('[GrowthScheduler] Running daily snapshot...');
  const connRepo = AppDataSource.getRepository(Connection);
  const connections = await connRepo.find({ where: { isActive: true } });

  const allAnomalies: GrowthAnomaly[] = [];

  for (const conn of connections) {
    if (!conn.databaseName) continue; // Skip server-level connections
    try {
      const anomalies = await snapshotConnection(conn);
      allAnomalies.push(...anomalies);
    } catch (err: any) {
      console.error(`[GrowthScheduler] Error snapshotting ${conn.name}: ${err.message}`);
    }
  }

  // Emit anomalies via WebSocket
  if (allAnomalies.length > 0 && io) {
    io.emit('growth:anomalies', allAnomalies);
  }

  console.log(`[GrowthScheduler] Done. ${allAnomalies.length} anomalies detected.`);
  return allAnomalies;
}

async function snapshotConnection(conn: Connection): Promise<GrowthAnomaly[]> {
  const snapshotRepo = AppDataSource.getRepository(TableSnapshot);
  const ruleRepo = AppDataSource.getRepository(TableGrowthRule);

  
  const adapter = createAdapter(conn.dbType);

  await adapter.connect({
    host: conn.host,
    port: conn.port,
    database: conn.databaseName || (conn.dbType === 'postgresql' ? 'postgres' : 'master'),
    ...getConnCredentials(conn),
    timeoutMs: 30000,
  });

  try {
    // Get current table stats (uses metadata, not real count)
    const tables = await adapter.listTables();
    const today = new Date().toISOString().split('T')[0];

    // Save today's snapshot
    for (const table of tables) {
      const existing = await snapshotRepo.findOne({
        where: { connectionId: conn.id, schemaName: table.schema, tableName: table.name, snapshotDate: today }
      });

      if (existing) {
        existing.rowCount = table.rowEstimate || 0;
        existing.sizeBytes = table.sizeBytes || 0;
        await snapshotRepo.save(existing);
      } else {
        await snapshotRepo.save(snapshotRepo.create({
          connectionId: conn.id,
          schemaName: table.schema,
          tableName: table.name,
          rowCount: table.rowEstimate || 0,
          sizeBytes: table.sizeBytes || 0,
          deadTuples: 0,
          snapshotDate: today,
        }));
      }
    }

    // Compare with yesterday and 7-day average
    const anomalies = await detectAnomalies(conn, tables, today);
    return anomalies;

  } finally {
    await adapter.disconnect();
  }
}

async function detectAnomalies(conn: Connection, todayTables: any[], today: string): Promise<GrowthAnomaly[]> {
  const snapshotRepo = AppDataSource.getRepository(TableSnapshot);
  const ruleRepo = AppDataSource.getRepository(TableGrowthRule);
  const anomalies: GrowthAnomaly[] = [];

  // Get yesterday's date
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  // Get 7 days ago
  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0];

  for (const table of todayTables) {
    const todayRows = table.rowEstimate || 0;

    // Get yesterday snapshot
    const yesterdaySnap = await snapshotRepo.findOne({
      where: { connectionId: conn.id, schemaName: table.schema, tableName: table.name, snapshotDate: yesterdayStr }
    });

    if (!yesterdaySnap) continue; // No baseline yet, skip

    const yesterdayRows = Number(yesterdaySnap.rowCount);
    const delta = todayRows - yesterdayRows;

    // Calculate 7-day average daily growth
    const historicalSnaps = await snapshotRepo
      .createQueryBuilder('s')
      .where('s.connectionId = :connId', { connId: conn.id })
      .andWhere('s.schemaName = :schema', { schema: table.schema })
      .andWhere('s.tableName = :table', { table: table.name })
      .andWhere('s.snapshotDate >= :from', { from: sevenDaysAgoStr })
      .andWhere('s.snapshotDate < :to', { to: today })
      .orderBy('s.snapshotDate', 'ASC')
      .getMany();

    let avgDailyGrowth = 0;
    if (historicalSnaps.length >= 2) {
      const first = Number(historicalSnaps[0].rowCount);
      const last = Number(historicalSnaps[historicalSnaps.length - 1].rowCount);
      avgDailyGrowth = (last - first) / historicalSnaps.length;
    }

    // Get custom rule if exists
    const rule = await ruleRepo.findOne({
      where: { connectionId: conn.id, schemaName: table.schema, tableName: table.name, enabled: true }
    });

    const maxGrowthPct = rule?.maxDailyGrowthPct || 300;
    const maxGrowthRows = rule?.maxDailyGrowthRows;
    const minGrowthRows = rule?.minDailyGrowthRows;
    const maxShrinkPct = rule?.maxShrinkPct || 10;

    // Rule 1: Spike - grew way more than average
    if (avgDailyGrowth > 0 && delta > 0) {
      const ratio = delta / avgDailyGrowth;
      if (ratio >= (maxGrowthPct / 100)) {
        anomalies.push({
          connectionId: conn.id, connectionName: conn.name,
          schemaName: table.schema, tableName: table.name,
          type: 'spike', severity: ratio > 10 ? 'critical' : 'warning',
          todayRows, yesterdayRows, delta, avgDailyGrowth, ratio,
          message: `Crescimento ${ratio.toFixed(1)}x acima da média (delta: +${delta.toLocaleString()}, média: +${Math.round(avgDailyGrowth).toLocaleString()}/dia)`
        });
      }
    }

    // Rule 2: Max absolute growth exceeded
    if (maxGrowthRows && delta > maxGrowthRows) {
      anomalies.push({
        connectionId: conn.id, connectionName: conn.name,
        schemaName: table.schema, tableName: table.name,
        type: 'spike', severity: 'warning',
        todayRows, yesterdayRows, delta, avgDailyGrowth, ratio: delta / (avgDailyGrowth || 1),
        message: `Cresceu +${delta.toLocaleString()} rows (limite: ${maxGrowthRows.toLocaleString()})`
      });
    }

    // Rule 3: Growth stopped (table normally grows but didn't today)
    if (avgDailyGrowth > 10 && delta === 0) {
      anomalies.push({
        connectionId: conn.id, connectionName: conn.name,
        schemaName: table.schema, tableName: table.name,
        type: 'stopped', severity: 'warning',
        todayRows, yesterdayRows, delta: 0, avgDailyGrowth, ratio: 0,
        message: `Tabela parou de crescer (média: +${Math.round(avgDailyGrowth).toLocaleString()}/dia)`
      });
    }

    // Rule 4: Min growth not met
    if (minGrowthRows && delta < minGrowthRows && delta >= 0) {
      anomalies.push({
        connectionId: conn.id, connectionName: conn.name,
        schemaName: table.schema, tableName: table.name,
        type: 'stopped', severity: 'warning',
        todayRows, yesterdayRows, delta, avgDailyGrowth, ratio: 0,
        message: `Crescimento abaixo do mínimo esperado (+${delta} vs mínimo ${minGrowthRows})`
      });
    }

    // Rule 5: Data loss (table shrank significantly)
    if (delta < 0 && yesterdayRows > 0) {
      const shrinkPct = (Math.abs(delta) / yesterdayRows) * 100;
      if (shrinkPct > maxShrinkPct) {
        anomalies.push({
          connectionId: conn.id, connectionName: conn.name,
          schemaName: table.schema, tableName: table.name,
          type: 'data_loss', severity: 'critical',
          todayRows, yesterdayRows, delta, avgDailyGrowth, ratio: 0,
          message: `Tabela encolheu ${shrinkPct.toFixed(1)}% (${Math.abs(delta).toLocaleString()} rows removidas)`
        });
      }
    }
  }

  return anomalies;
}

// Manual trigger for API
export async function runManualSnapshot(): Promise<GrowthAnomaly[]> {
  return runDailySnapshot();
}

// Get growth data for a connection (for the UI)
export async function getGrowthData(connectionId: string, days = 7) {
  const snapshotRepo = AppDataSource.getRepository(TableSnapshot);
  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - days);

  const snapshots = await snapshotRepo
    .createQueryBuilder('s')
    .where('s.connectionId = :connId', { connId: connectionId })
    .andWhere('s.snapshotDate >= :from', { from: fromDate.toISOString().split('T')[0] })
    .orderBy('s.tableName', 'ASC')
    .addOrderBy('s.snapshotDate', 'ASC')
    .getMany();

  // Group by table
  const tables: Record<string, { schema: string; table: string; snapshots: { date: string; rows: number; size: number }[] }> = {};

  for (const snap of snapshots) {
    const key = `${snap.schemaName}.${snap.tableName}`;
    if (!tables[key]) {
      tables[key] = { schema: snap.schemaName, table: snap.tableName, snapshots: [] };
    }
    tables[key].snapshots.push({ date: snap.snapshotDate, rows: Number(snap.rowCount), size: Number(snap.sizeBytes) });
  }

  // Calculate deltas and averages
  return Object.values(tables).map(t => {
    const snaps = t.snapshots;
    const latest = snaps[snaps.length - 1];
    const previous = snaps.length > 1 ? snaps[snaps.length - 2] : null;
    const first = snaps[0];

    const dailyDelta = previous ? latest.rows - previous.rows : 0;
    const avgDailyGrowth = snaps.length > 1 ? (latest.rows - first.rows) / (snaps.length - 1) : 0;

    return {
      schema: t.schema,
      table: t.table,
      currentRows: latest.rows,
      currentSize: latest.size,
      dailyDelta,
      avgDailyGrowth: Math.round(avgDailyGrowth),
      sparkline: snaps.map(s => s.rows),
      history: snaps,
    };
  });
}
