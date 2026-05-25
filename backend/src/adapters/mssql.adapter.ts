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
    return this.query(`SELECT s.name as [schema], t.name, SUM(p.rows) as rowEstimate, NULL as sizeBytes
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
      TYPE_NAME(o.type) as returnType, OBJECT_DEFINITION(o.object_id) as definition, '' as parameters
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

  async executeSQL(sql: string): Promise<ExecutionResult> {
    const start = Date.now();
    try {
      const result = await this.pool!.request().query(sql);
      return { success: true, rowsAffected: result.rowsAffected[0] || 0, rows: result.recordset, durationMs: Date.now() - start };
    } catch (err: any) { return { success: false, error: err.message, durationMs: Date.now() - start }; }
  }
}
