import * as mssql from 'mssql';
import { DatabaseAdapter, ConnectionConfig, DatabaseInfo, TableInfo, ColumnInfo, IndexInfo, TriggerInfo, ProcedureInfo, FunctionInfo, ViewInfo, ActiveQuery, LockInfo, ExecutionResult } from './base.adapter';

export class MSSQLAdapter implements DatabaseAdapter {
  private pool: mssql.ConnectionPool | null = null;

  async connect(config: ConnectionConfig): Promise<void> {
    this.pool = new mssql.ConnectionPool({
      server: config.host,
      port: config.port,
      database: config.database,
      user: config.username,
      password: config.password,
      options: { encrypt: false, trustServerCertificate: true },
      connectionTimeout: config.timeoutMs || 10000,
      requestTimeout: config.timeoutMs || 30000,
    });
    await this.pool.connect();
  }

  async disconnect(): Promise<void> { if (this.pool) { await this.pool.close(); this.pool = null; } }

  private async query(sql: string): Promise<any[]> {
    if (!this.pool) throw new Error('Not connected');
    const result = await this.pool.request().query(sql);
    return result.recordset;
  }

  async testConnection(): Promise<{ ok: boolean; version: string; error?: string }> {
    try {
      const rows = await this.query('SELECT @@VERSION as version');
      return { ok: true, version: rows[0].version.split('\n')[0] };
    } catch (err: any) { return { ok: false, version: '', error: err.message }; }
  }

  async listDatabases(): Promise<DatabaseInfo[]> {
    return this.query("SELECT name, NULL as sizeBytes, NULL as encoding FROM sys.databases WHERE database_id > 4 ORDER BY name");
  }

  async listTables(schema = 'dbo'): Promise<TableInfo[]> {
    return this.query(`SELECT s.name as [schema], t.name, SUM(CAST(p.rows AS BIGINT)) as rowEstimate, NULL as sizeBytes
      FROM sys.tables t JOIN sys.schemas s ON t.schema_id = s.schema_id
      LEFT JOIN sys.partitions p ON t.object_id = p.object_id AND p.index_id IN (0,1)
      WHERE s.name = '${schema}' GROUP BY s.name, t.name ORDER BY t.name`);
  }

  async listColumns(schema: string, table: string): Promise<ColumnInfo[]> {
    return this.query(`SELECT c.COLUMN_NAME as name, c.DATA_TYPE as type, 
      CASE c.IS_NULLABLE WHEN 'YES' THEN 1 ELSE 0 END as nullable,
      c.COLUMN_DEFAULT as defaultValue,
      CASE WHEN pk.COLUMN_NAME IS NOT NULL THEN 1 ELSE 0 END as isPrimaryKey,
      CASE WHEN fk.COLUMN_NAME IS NOT NULL THEN 1 ELSE 0 END as isForeignKey
      FROM INFORMATION_SCHEMA.COLUMNS c
      LEFT JOIN (SELECT ku.COLUMN_NAME FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
        JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE ku ON tc.CONSTRAINT_NAME = ku.CONSTRAINT_NAME
        WHERE tc.TABLE_SCHEMA = '${schema}' AND tc.TABLE_NAME = '${table}' AND tc.CONSTRAINT_TYPE = 'PRIMARY KEY') pk ON pk.COLUMN_NAME = c.COLUMN_NAME
      LEFT JOIN (SELECT ku.COLUMN_NAME FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
        JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE ku ON tc.CONSTRAINT_NAME = ku.CONSTRAINT_NAME
        WHERE tc.TABLE_SCHEMA = '${schema}' AND tc.TABLE_NAME = '${table}' AND tc.CONSTRAINT_TYPE = 'FOREIGN KEY') fk ON fk.COLUMN_NAME = c.COLUMN_NAME
      WHERE c.TABLE_SCHEMA = '${schema}' AND c.TABLE_NAME = '${table}' ORDER BY c.ORDINAL_POSITION`);
  }

  async listAllColumns(schema = 'dbo'): Promise<(ColumnInfo & { tableName: string })[]> {
    return this.query(`SELECT c.TABLE_NAME as tableName, c.COLUMN_NAME as name, c.DATA_TYPE as type,
      CASE c.IS_NULLABLE WHEN 'YES' THEN 1 ELSE 0 END as nullable,
      c.COLUMN_DEFAULT as defaultValue,
      CASE WHEN pk.COLUMN_NAME IS NOT NULL THEN 1 ELSE 0 END as isPrimaryKey,
      CASE WHEN fk.COLUMN_NAME IS NOT NULL THEN 1 ELSE 0 END as isForeignKey
      FROM INFORMATION_SCHEMA.COLUMNS c
      LEFT JOIN (SELECT tc.TABLE_NAME, ku.COLUMN_NAME FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
        JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE ku ON tc.CONSTRAINT_NAME = ku.CONSTRAINT_NAME
        WHERE tc.TABLE_SCHEMA = '${schema}' AND tc.CONSTRAINT_TYPE = 'PRIMARY KEY') pk
        ON pk.TABLE_NAME = c.TABLE_NAME AND pk.COLUMN_NAME = c.COLUMN_NAME
      LEFT JOIN (SELECT tc.TABLE_NAME, ku.COLUMN_NAME FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
        JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE ku ON tc.CONSTRAINT_NAME = ku.CONSTRAINT_NAME
        WHERE tc.TABLE_SCHEMA = '${schema}' AND tc.CONSTRAINT_TYPE = 'FOREIGN KEY') fk
        ON fk.TABLE_NAME = c.TABLE_NAME AND fk.COLUMN_NAME = c.COLUMN_NAME
      WHERE c.TABLE_SCHEMA = '${schema}' ORDER BY c.TABLE_NAME, c.ORDINAL_POSITION`);
  }

  async listAllIndexes(schema = 'dbo'): Promise<(IndexInfo & { tableName: string })[]> {
    return this.query(`SELECT t.name as tableName, i.name, t.name as [table], i.is_unique as [unique],
      STRING_AGG(c.name, ',') as columns, '' as definition
      FROM sys.indexes i JOIN sys.tables t ON i.object_id = t.object_id
      JOIN sys.schemas s ON t.schema_id = s.schema_id
      JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
      JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
      WHERE s.name = '${schema}' AND i.name IS NOT NULL
      GROUP BY t.name, i.name, i.is_unique`);
  }

  async listIndexes(schema: string, table: string): Promise<IndexInfo[]> {
    return this.query(`SELECT i.name, t.name as [table], i.is_unique as [unique],
      STRING_AGG(c.name, ',') as columns, '' as definition
      FROM sys.indexes i JOIN sys.tables t ON i.object_id = t.object_id
      JOIN sys.schemas s ON t.schema_id = s.schema_id
      JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
      JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
      WHERE s.name = '${schema}' AND t.name = '${table}' AND i.name IS NOT NULL
      GROUP BY i.name, t.name, i.is_unique`);
  }

  async listTriggers(schema = 'dbo'): Promise<TriggerInfo[]> {
    return this.query(`SELECT tr.name, t.name as [table], 'AFTER' as timing,
      te.type_desc as event, OBJECT_DEFINITION(tr.object_id) as definition
      FROM sys.triggers tr JOIN sys.tables t ON tr.parent_id = t.object_id
      JOIN sys.schemas s ON t.schema_id = s.schema_id
      LEFT JOIN sys.trigger_events te ON tr.object_id = te.object_id
      WHERE s.name = '${schema}' ORDER BY tr.name`);
  }

  async listProcedures(schema = 'dbo'): Promise<ProcedureInfo[]> {
    return this.query(`SELECT s.name as [schema], p.name, 'T-SQL' as language,
      OBJECT_DEFINITION(p.object_id) as definition, '' as parameters
      FROM sys.procedures p JOIN sys.schemas s ON p.schema_id = s.schema_id
      WHERE s.name = '${schema}' ORDER BY p.name`);
  }

  async listFunctions(schema = 'dbo'): Promise<FunctionInfo[]> {
    return this.query(`SELECT s.name as [schema], o.name, 'T-SQL' as language,
      o.type_desc as returnType, OBJECT_DEFINITION(o.object_id) as definition, '' as parameters
      FROM sys.objects o JOIN sys.schemas s ON o.schema_id = s.schema_id
      WHERE o.type IN ('FN','IF','TF') AND s.name = '${schema}' ORDER BY o.name`);
  }

  async listViews(schema = 'dbo'): Promise<ViewInfo[]> {
    return this.query(`SELECT s.name as [schema], v.name, OBJECT_DEFINITION(v.object_id) as definition
      FROM sys.views v JOIN sys.schemas s ON v.schema_id = s.schema_id
      WHERE s.name = '${schema}' ORDER BY v.name`);
  }

  async getActiveQueries(): Promise<ActiveQuery[]> {
    return this.query(`SELECT r.session_id as pid, s.login_name as username, DB_NAME(r.database_id) as [database],
      r.status as state, t.text as query,
      DATEDIFF(MILLISECOND, r.start_time, GETDATE()) as durationMs, r.wait_type as waitEvent
      FROM sys.dm_exec_requests r JOIN sys.dm_exec_sessions s ON r.session_id = s.session_id
      CROSS APPLY sys.dm_exec_sql_text(r.sql_handle) t
      WHERE r.session_id > 50 AND r.session_id != @@SPID ORDER BY r.start_time`);
  }

  async getLocks(): Promise<LockInfo[]> {
    return this.query(`SELECT blocked.session_id as blockedPid, bt.text as blockedQuery,
      blocking.session_id as blockingPid, blt.text as blockingQuery,
      blocked.wait_type as lockType, blocked.wait_time as durationMs
      FROM sys.dm_exec_requests blocked
      CROSS APPLY sys.dm_exec_sql_text(blocked.sql_handle) bt
      JOIN sys.dm_exec_sessions blocking ON blocked.blocking_session_id = blocking.session_id
      CROSS APPLY sys.dm_exec_sql_text(blocking.most_recent_sql_handle) blt
      WHERE blocked.blocking_session_id > 0`);
  }

  async killQuery(pid: number): Promise<{ success: boolean; error?: string }> {
    try { await this.query(`KILL ${pid}`); return { success: true }; }
    catch (err: any) { return { success: false, error: err.message }; }
  }



  // === HEALTH MONITORING ===

  async getHealthOverview(): Promise<import('./base.adapter').HealthOverview> {
    const version = (await this.query("SELECT @@VERSION as version"))[0].version.split('\n')[0];
    const tables = await this.query("SELECT count(*) as cnt FROM sys.tables");
    const size = await this.query("SELECT SUM(CAST(size AS BIGINT) * 8 * 1024) as size FROM sys.database_files");
    const conns = await this.query("SELECT count(*) as active FROM sys.dm_exec_sessions WHERE is_user_process = 1");
    const maxConns = await this.query("SELECT CAST(value_in_use AS int) as max FROM sys.configurations WHERE name = 'user connections'");

    return {
      version,
      totalTables: parseInt(tables[0].cnt),
      totalSizeBytes: parseInt(size[0].size || '0'),
      bloatedTables: 0,
      unusedIndexes: 0,
      longTransactions: 0,
      activeConnections: parseInt(conns[0].active),
      maxConnections: parseInt(maxConns[0]?.max || '32767'),
      cacheHitRatio: 0.95,
      uptime: '',
    };
  }

  async getTableHealth(): Promise<import('./base.adapter').TableHealth[]> {
    const rows = await this.query(`
      SELECT s.name as [schema], t.name,
             SUM(CAST(a.total_pages AS BIGINT) * 8 * 1024) as sizeBytes,
             SUM(CAST(p.rows AS BIGINT)) as rowEstimate, 0 as deadTuples, SUM(CAST(p.rows AS BIGINT)) as liveTuples,
             0 as bloatRatio, NULL as lastVacuum, NULL as lastAnalyze, NULL as lastAutoVacuum,
             0 as seqScans, 0 as idxScans
      FROM sys.tables t
      JOIN sys.schemas s ON t.schema_id = s.schema_id
      JOIN sys.partitions p ON t.object_id = p.object_id AND p.index_id IN (0,1)
      JOIN sys.allocation_units a ON p.partition_id = a.container_id
      GROUP BY s.name, t.name ORDER BY SUM(a.total_pages) DESC
    `);
    return rows;
  }

  async getSlowQueries(limit = 20): Promise<import('./base.adapter').SlowQuery[]> {
    const rows = await this.query(`
      SELECT TOP ` + limit + `
        SUBSTRING(qt.text, 1, 200) as query,
        qs.execution_count as calls,
        qs.total_elapsed_time / 1000.0 as totalTimeMs,
        (qs.total_elapsed_time / qs.execution_count) / 1000.0 as meanTimeMs,
        qs.max_elapsed_time / 1000.0 as maxTimeMs,
        qs.total_rows as rows
      FROM sys.dm_exec_query_stats qs
      CROSS APPLY sys.dm_exec_sql_text(qs.sql_handle) qt
      ORDER BY qs.total_elapsed_time DESC
    `);
    return rows;
  }

  async getUnusedIndexes(): Promise<import('./base.adapter').UnusedIndex[]> {
    const rows = await this.query(`
      SELECT s.name as [schema], o.name as [table], i.name as indexName,
             (SUM(CAST(a.total_pages AS BIGINT)) * 8 * 1024) as indexSizeBytes,
             ISNULL(us.user_seeks + us.user_scans + us.user_lookups, 0) as indexScans
      FROM sys.indexes i
      JOIN sys.objects o ON i.object_id = o.object_id
      JOIN sys.schemas s ON o.schema_id = s.schema_id
      LEFT JOIN sys.dm_db_index_usage_stats us ON i.object_id = us.object_id AND i.index_id = us.index_id
      JOIN sys.partitions p ON i.object_id = p.object_id AND i.index_id = p.index_id
      JOIN sys.allocation_units a ON p.partition_id = a.container_id
      WHERE o.type = 'U' AND i.type > 0 AND i.is_primary_key = 0 AND i.is_unique = 0
        AND ISNULL(us.user_seeks + us.user_scans + us.user_lookups, 0) = 0
      GROUP BY s.name, o.name, i.name, us.user_seeks, us.user_scans, us.user_lookups
      ORDER BY SUM(a.total_pages) DESC
    `);
    return rows;
  }

  async getMissingIndexes(): Promise<import('./base.adapter').MissingIndex[]> {
    const rows = await this.query(`
      SELECT TOP 20
        s.name as [schema],
        OBJECT_NAME(mid.object_id) as [table],
        'Missing index sugerido pelo SQL Server' as reason,
        migs.user_seeks as seqScans,
        (SELECT SUM(rows) FROM sys.partitions WHERE object_id = mid.object_id AND index_id IN (0,1)) as rowEstimate,
        mid.equality_columns as suggestedColumns,
        CAST(migs.avg_user_impact as varchar) + '% improvement' as estimatedImpact
      FROM sys.dm_db_missing_index_details mid
      JOIN sys.dm_db_missing_index_groups mig ON mid.index_handle = mig.index_handle
      JOIN sys.dm_db_missing_index_group_stats migs ON mig.index_group_handle = migs.group_handle
      JOIN sys.objects o ON mid.object_id = o.object_id
      JOIN sys.schemas s ON o.schema_id = s.schema_id
      WHERE mid.database_id = DB_ID()
      ORDER BY migs.avg_user_impact * migs.user_seeks DESC
    `);
    return rows;
  }

  async getDbConfig(): Promise<import('./base.adapter').DbConfigParam[]> {
    const rows = await this.query(`
      SELECT name, CAST(value_in_use AS varchar) as currentValue, '' as unit,
             'Server' as category, description
      FROM sys.configurations
      WHERE name IN ('max degree of parallelism', 'cost threshold for parallelism',
        'max server memory (MB)', 'min server memory (MB)', 'optimize for ad hoc workloads',
        'max worker threads', 'backup compression default', 'remote admin connections')
      ORDER BY name
    `);
    return rows.map((r: any) => ({ ...r, status: 'ok' as const }));
  }

  async getLongTransactions(minDurationMs = 300000): Promise<import('./base.adapter').LongTransaction[]> {
    const rows = await this.query(`
      SELECT s.session_id as pid, s.login_name as username, DB_NAME(s.database_id) as [database],
             s.status as state,
             DATEDIFF(MILLISECOND, at.transaction_begin_time, GETDATE()) as durationMs,
             ISNULL((SELECT TOP 1 SUBSTRING(qt.text, 1, 200) FROM sys.dm_exec_connections c
               CROSS APPLY sys.dm_exec_sql_text(c.most_recent_sql_handle) qt
               WHERE c.session_id = s.session_id), '') as query,
             CAST(at.transaction_begin_time AS varchar) as xactStart
      FROM sys.dm_tran_active_transactions at
      JOIN sys.dm_tran_session_transactions st ON at.transaction_id = st.transaction_id
      JOIN sys.dm_exec_sessions s ON st.session_id = s.session_id
      WHERE DATEDIFF(MILLISECOND, at.transaction_begin_time, GETDATE()) > ` + minDurationMs + `
        AND s.is_user_process = 1
      ORDER BY at.transaction_begin_time ASC
    `);
    return rows;
  }

  async executeSQL(sql: string): Promise<ExecutionResult> {
    const start = Date.now();
    try {
      const result = await this.pool!.request().query(sql);
      return { success: true, rowsAffected: result.rowsAffected[0] || 0, rows: result.recordset, durationMs: Date.now() - start };
    } catch (err: any) { return { success: false, error: err.message, durationMs: Date.now() - start }; }
  }
}
