import { Router, Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { Connection } from '../entities/connection.entity';
import { authMiddleware } from '../middleware/auth.middleware';
import { requireFeature } from '../middleware/feature.middleware';
import { createConnection as createMssql } from '../adapters/mssql.adapter';
import { createConnection as createPg } from '../adapters/postgres.adapter';

const router = Router();

interface HeartbeatConfig {
  connectionId: string;
  query: string; // e.g. SELECT MAX(dt_registro) as last_record FROM tabela
  thresholdMinutes: number; // e.g. 10
  label?: string;
}

// In-memory heartbeat configs (persisted via alert system or separate table later)
// For now, we check all connections using sys.dm_exec_sessions or pg_stat_activity

// GET /api/heartbeat/status - Check all connections heartbeat
router.get('/status', authMiddleware, requireFeature('monitor.view'), async (_req: Request, res: Response) => {
  try {
    const connections = await AppDataSource.getRepository(Connection).find({ where: { isActive: true } });
    const results: any[] = [];

    for (const conn of connections) {
      const startTime = Date.now();
      let status: 'online' | 'offline' | 'warning' | 'error' = 'error';
      let responseMs = 0;
      let details: any = {};

      try {
        if (conn.dbType === 'mssql') {
          const pool = await createMssql(conn);
          const result = await pool.request().query(`
            SELECT 
              COUNT(*) as active_sessions,
              DATEDIFF(SECOND, sqlserver_start_time, GETDATE()) as uptime_seconds,
              (SELECT create_date FROM sys.databases WHERE name = DB_NAME()) as db_create_date
            FROM sys.dm_os_sys_info
          `);
          responseMs = Date.now() - startTime;
          const row = result.recordset[0];
          details = { activeSessions: row?.active_sessions, uptimeSeconds: row?.uptime_seconds };
          status = 'online';
          await pool.close();
        } else if (conn.dbType === 'postgres') {
          const client = await createPg(conn);
          const result = await client.query(`
            SELECT 
              (SELECT count(*) FROM pg_stat_activity WHERE datname = current_database()) as active_sessions,
              EXTRACT(EPOCH FROM (now() - pg_postmaster_start_time()))::int as uptime_seconds
          `);
          responseMs = Date.now() - startTime;
          const row = result.rows[0];
          details = { activeSessions: parseInt(row?.active_sessions || '0'), uptimeSeconds: parseInt(row?.uptime_seconds || '0') };
          status = 'online';
          await client.end();
        }
      } catch (err: any) {
        responseMs = Date.now() - startTime;
        status = 'offline';
        details = { error: err.message };
      }

      // Warning if response > 5s
      if (status === 'online' && responseMs > 5000) status = 'warning';

      results.push({
        connectionId: conn.id,
        connectionName: conn.name,
        databaseName: conn.databaseName,
        dbType: conn.dbType,
        status,
        responseMs,
        details,
        checkedAt: new Date().toISOString(),
      });
    }

    res.json(results);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/heartbeat/check-custom - Run a custom heartbeat query
router.post('/check-custom', authMiddleware, requireFeature('monitor.view'), async (req: Request, res: Response) => {
  const { connectionId, query, thresholdMinutes } = req.body;
  if (!connectionId || !query) return res.status(400).json({ error: 'connectionId e query obrigatórios' });

  try {
    const conn = await AppDataSource.getRepository(Connection).findOne({ where: { id: connectionId } });
    if (!conn) return res.status(404).json({ error: 'Conexão não encontrada' });

    let lastRecord: Date | null = null;
    if (conn.dbType === 'mssql') {
      const pool = await createMssql(conn);
      const result = await pool.request().query(query);
      lastRecord = result.recordset[0]?.last_record || null;
      await pool.close();
    } else if (conn.dbType === 'postgres') {
      const client = await createPg(conn);
      const result = await client.query(query);
      lastRecord = result.rows[0]?.last_record || null;
      await client.end();
    }

    const minutesAgo = lastRecord ? Math.floor((Date.now() - new Date(lastRecord).getTime()) / 60000) : null;
    const threshold = thresholdMinutes || 10;
    const isHealthy = minutesAgo !== null && minutesAgo <= threshold;

    res.json({ lastRecord, minutesAgo, threshold, isHealthy });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
