import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { requireFeature } from '../middleware/feature.middleware';
import { AppDataSource } from '../config/database';
import { Connection } from '../entities/connection.entity';
import { getConnCredentials } from '../utils/credentials';
import { createAdapter } from '../adapters/adapter.factory';

const router = Router();
const connRepo = () => AppDataSource.getRepository(Connection);

// GET /api/monitor/:connId/queries
router.get('/:connId/queries', authMiddleware, async (req: Request, res: Response) => {
  try {
    const conn = await connRepo().findOne({ where: { id: req.params.connId, isActive: true } });
    if (!conn) return res.status(404).json({ error: 'Conexão não encontrada' });

    const adapter = createAdapter(conn.dbType);
    await adapter.connect(getConnCredentials(conn));
    const data = await adapter.getActiveQueries();
    await adapter.disconnect();
    return res.json({ data });
  } catch (err: any) { return res.status(500).json({ error: err.message }); }
});

// GET /api/monitor/:connId/locks
router.get('/:connId/locks', authMiddleware, async (req: Request, res: Response) => {
  try {
    const conn = await connRepo().findOne({ where: { id: req.params.connId, isActive: true } });
    if (!conn) return res.status(404).json({ error: 'Conexão não encontrada' });

    const adapter = createAdapter(conn.dbType);
    await adapter.connect(getConnCredentials(conn));
    const data = await adapter.getLocks();
    await adapter.disconnect();
    return res.json({ data });
  } catch (err: any) { return res.status(500).json({ error: err.message }); }
});

// POST /api/monitor/:connId/kill/:pid
router.post('/:connId/kill/:pid', authMiddleware, requireFeature('monitor.kill'), async (req: Request, res: Response) => {
  try {
    const conn = await connRepo().findOne({ where: { id: req.params.connId, isActive: true } });
    if (!conn) return res.status(404).json({ error: 'Conexão não encontrada' });

    const adapter = createAdapter(conn.dbType);
    await adapter.connect(getConnCredentials(conn));
    const result = await adapter.killQuery(parseInt(req.params.pid));
    await adapter.disconnect();
    return res.json({ data: result });
  } catch (err: any) { return res.status(500).json({ error: err.message }); }
});

// GET /api/monitor/:connId/stats (database stats)
router.get('/:connId/stats', authMiddleware, async (req: Request, res: Response) => {
  try {
    const conn = await connRepo().findOne({ where: { id: req.params.connId, isActive: true } });
    if (!conn) return res.status(404).json({ error: 'Conexão não encontrada' });

    const adapter = createAdapter(conn.dbType);
    await adapter.connect(getConnCredentials(conn));

    let data: any;
    if (conn.dbType === 'postgresql') {
      const pool = (adapter as any).pool;
      const [sizeResult, connResult, cacheResult] = await Promise.all([
        pool.query("SELECT pg_database_size(current_database()) as size"),
        pool.query("SELECT count(*) as total, count(*) FILTER (WHERE state = 'active') as active FROM pg_stat_activity"),
        pool.query("SELECT sum(blks_hit)::float / NULLIF(sum(blks_hit) + sum(blks_read), 0) * 100 as ratio FROM pg_stat_database WHERE datname = current_database()"),
      ]);
      data = {
        databaseSize: parseInt(sizeResult.rows[0].size),
        totalConnections: parseInt(connResult.rows[0].total),
        activeConnections: parseInt(connResult.rows[0].active),
        cacheHitRatio: parseFloat(cacheResult.rows[0].ratio || '0'),
      };
    } else {
      const query = (adapter as any).query.bind(adapter);
      const [sizeResult, connResult] = await Promise.all([
        query("SELECT SUM(CAST(size AS BIGINT) * 8 * 1024) as size FROM sys.database_files"),
        query("SELECT count(*) as total, SUM(CASE WHEN status = 'running' THEN 1 ELSE 0 END) as active FROM sys.dm_exec_sessions WHERE is_user_process = 1 AND database_id = DB_ID()"),
      ]);
      data = {
        databaseSize: parseInt(sizeResult[0]?.size || '0'),
        totalConnections: parseInt(connResult[0]?.total || '0'),
        activeConnections: parseInt(connResult[0]?.active || '0'),
        cacheHitRatio: 95,
      };
    }

    await adapter.disconnect();
    return res.json({ data });
  } catch (err: any) { return res.status(500).json({ error: err.message }); }
});


// GET /api/monitor/:connId/dba-stats
router.get('/:connId/dba-stats', authMiddleware, async (req: Request, res: Response) => {
  try {
    const conn = await connRepo().findOne({ where: { id: req.params.connId, isActive: true } });
    if (!conn) return res.status(404).json({ error: 'Conexão não encontrada' });

    const adapter = createAdapter(conn.dbType);
    await adapter.connect(getConnCredentials(conn, 30000));

    let data: any = {};

    if (conn.dbType === 'mssql') {
      const query = (adapter as any).query.bind(adapter);
      const panels = req.query.panels?.toString().split(',') || ['all'];
      const all = panels.includes('all');

      // Long running queries (>60s)
      if (all || panels.includes('longQueries')) {
        data.longQueries = await query(`SELECT r.session_id as pid, s.login_name as username,
          DATEDIFF(SECOND, r.start_time, GETDATE()) as durationSec,
          t.text as query, r.status as state, r.wait_type as waitType
          FROM sys.dm_exec_requests r
          JOIN sys.dm_exec_sessions s ON r.session_id = s.session_id
          CROSS APPLY sys.dm_exec_sql_text(r.sql_handle) t
          WHERE r.database_id = DB_ID() AND r.session_id != @@SPID
            AND DATEDIFF(SECOND, r.start_time, GETDATE()) > 60
          ORDER BY r.start_time`).catch(() => []);
      }

      // Wait stats (top 10)
      if (all || panels.includes('waitStats')) {
        data.waitStats = await query(`SELECT TOP 10 wait_type as waitType,
          waiting_tasks_count as waitCount,
          wait_time_ms as totalWaitMs,
          CAST(wait_time_ms AS FLOAT) / NULLIF(waiting_tasks_count, 0) as avgWaitMs
          FROM sys.dm_os_wait_stats
          WHERE wait_type NOT IN ('SLEEP_TASK','BROKER_TO_FLUSH','SQLTRACE_BUFFER_FLUSH',
            'CLR_AUTO_EVENT','CLR_MANUAL_EVENT','LAZYWRITER_SLEEP','CHECKPOINT_QUEUE',
            'WAITFOR','XE_TIMER_EVENT','FT_IFTS_SCHEDULER_IDLE_WAIT','BROKER_TASK_STOP',
            'REQUEST_FOR_DEADLOCK_SEARCH','XE_DISPATCHER_WAIT','HADR_FILESTREAM_IOMGR_IOCOMPLETION',
            'DIRTY_PAGE_POLL','SQLTRACE_INCREMENTAL_FLUSH_SLEEP')
          AND waiting_tasks_count > 0
          ORDER BY wait_time_ms DESC`).catch(() => []);
      }

      // TempDB usage
      if (all || panels.includes('tempdb')) {
        data.tempdb = await query(`SELECT
          SUM(unallocated_extent_page_count) * 8 / 1024 as freeSpaceMB,
          SUM(total_page_count) * 8 / 1024 as totalSizeMB,
          SUM(user_object_reserved_page_count) * 8 / 1024 as userObjectsMB,
          SUM(internal_object_reserved_page_count) * 8 / 1024 as internalObjectsMB,
          SUM(version_store_reserved_page_count) * 8 / 1024 as versionStoreMB
          FROM tempdb.sys.dm_db_file_space_usage`).catch(() => []);
      }

      // Memory / PLE
      if (all || panels.includes('memory')) {
        data.memory = await query(`SELECT
          (SELECT cntr_value FROM sys.dm_os_performance_counters WHERE counter_name = 'Page life expectancy' AND object_name LIKE '%Buffer Manager%') as pageLifeExpectancy,
          (SELECT cntr_value FROM sys.dm_os_performance_counters WHERE counter_name = 'Total Server Memory (KB)' AND object_name LIKE '%Memory Manager%') as totalServerMemoryKB,
          (SELECT cntr_value FROM sys.dm_os_performance_counters WHERE counter_name = 'Target Server Memory (KB)' AND object_name LIKE '%Memory Manager%') as targetServerMemoryKB`).catch(() => []);
      }

      // CPU
      if (all || panels.includes('cpu')) {
        data.cpu = await query(`SELECT TOP 1
          record.value('(./Record/SchedulerMonitorEvent/SystemHealth/ProcessUtilization)[1]', 'int') as sqlCpuPercent,
          100 - record.value('(./Record/SchedulerMonitorEvent/SystemHealth/SystemIdle)[1]', 'int') as totalCpuPercent
          FROM (SELECT TOP 1 CONVERT(xml, record) as record
            FROM sys.dm_os_ring_buffers
            WHERE ring_buffer_type = N'RING_BUFFER_SCHEDULER_MONITOR'
            AND record LIKE '%<SystemHealth>%'
            ORDER BY timestamp DESC) as x`).catch(() => []);
      }

      // IO latency per file
      if (all || panels.includes('io')) {
        data.io = await query(`SELECT DB_NAME(vfs.database_id) as dbName,
          mf.physical_name as fileName, mf.type_desc as fileType,
          vfs.io_stall_read_ms / NULLIF(vfs.num_of_reads, 0) as avgReadLatencyMs,
          vfs.io_stall_write_ms / NULLIF(vfs.num_of_writes, 0) as avgWriteLatencyMs,
          vfs.num_of_reads as reads, vfs.num_of_writes as writes
          FROM sys.dm_io_virtual_file_stats(DB_ID(), NULL) vfs
          JOIN sys.master_files mf ON vfs.database_id = mf.database_id AND vfs.file_id = mf.file_id`).catch(() => []);
      }

      // Log file usage
      if (all || panels.includes('logUsage')) {
        data.logUsage = await query(`DBCC SQLPERF(LOGSPACE) WITH NO_INFOMSGS`).catch(() => []);
      }

      // Idle sessions with open transactions
      if (all || panels.includes('idleSessions')) {
        data.idleSessions = await query(`SELECT s.session_id as pid, s.login_name as username,
          s.program_name as appName, s.status,
          DATEDIFF(SECOND, s.last_request_start_time, GETDATE()) as idleSec,
          (SELECT TOP 1 t.text FROM sys.dm_exec_connections c
            CROSS APPLY sys.dm_exec_sql_text(c.most_recent_sql_handle) t
            WHERE c.session_id = s.session_id) as lastQuery
          FROM sys.dm_exec_sessions s
          JOIN sys.dm_tran_session_transactions st ON s.session_id = st.session_id
          WHERE s.is_user_process = 1 AND s.status = 'sleeping'
            AND s.database_id = DB_ID()
          ORDER BY s.last_request_start_time`).catch(() => []);
      }

      // Sessions by application
      if (all || panels.includes('sessionsByApp')) {
        data.sessionsByApp = await query(`SELECT program_name as appName,
          COUNT(*) as sessionCount,
          SUM(CASE WHEN status = 'running' THEN 1 ELSE 0 END) as activeCount,
          SUM(cpu_time) as totalCpuMs,
          SUM(CAST(memory_usage AS BIGINT) * 8) as memoryKB
          FROM sys.dm_exec_sessions
          WHERE is_user_process = 1 AND database_id = DB_ID()
          GROUP BY program_name ORDER BY COUNT(*) DESC`).catch(() => []);
      }

      // Top consumers (CPU/IO)
      if (all || panels.includes('topConsumers')) {
        data.topConsumers = await query(`SELECT TOP 10 s.session_id as pid,
          s.login_name as username, s.program_name as appName,
          s.cpu_time as cpuMs, s.reads, s.writes, s.logical_reads as logicalReads,
          CAST(s.memory_usage AS BIGINT) * 8 as memoryKB
          FROM sys.dm_exec_sessions s
          WHERE s.is_user_process = 1 AND s.database_id = DB_ID()
          ORDER BY s.cpu_time DESC`).catch(() => []);
      }

      // Deadlocks (from system_health)
      if (all || panels.includes('deadlocks')) {
        data.deadlocks = await query(`SELECT TOP 5
          CAST(xdr.value('@timestamp', 'datetime') as datetime) as occurredAt,
          xdr.query('.') as deadlockXml
          FROM (SELECT CAST(target_data AS XML) as TargetData
            FROM sys.dm_xe_session_targets st
            JOIN sys.dm_xe_sessions s ON s.address = st.event_session_address
            WHERE s.name = 'system_health' AND st.target_name = 'ring_buffer') AS Data
          CROSS APPLY TargetData.nodes('RingBufferTarget/event[@name="xml_deadlock_report"]') AS XEventData(xdr)
          ORDER BY xdr.value('@timestamp', 'datetime') DESC`).catch(() => []);
      }

    }

    await adapter.disconnect();
    return res.json({ data });
  } catch (err: any) { return res.status(500).json({ error: err.message }); }
});

export default router;
