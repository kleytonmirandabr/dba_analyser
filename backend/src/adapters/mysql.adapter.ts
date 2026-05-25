import * as mysql from 'mysql2/promise';
import { DatabaseAdapter, ConnectionConfig, DatabaseInfo, TableInfo, ColumnInfo, IndexInfo, TriggerInfo, ProcedureInfo, FunctionInfo, ViewInfo, ActiveQuery, LockInfo, ExecutionResult } from './base.adapter';

export class MySQLAdapter implements DatabaseAdapter {
  private conn: mysql.Connection | null = null;

  async connect(config: ConnectionConfig): Promise<void> {
    this.conn = await mysql.createConnection({
      host: config.host, port: config.port, database: config.database,
      user: config.username, password: config.password,
      connectTimeout: config.timeoutMs || 10000,
    });
  }

  async disconnect(): Promise<void> { if (this.conn) { await this.conn.end(); this.conn = null; } }

  private async query(sql: string): Promise<any[]> {
    if (!this.conn) throw new Error('Not connected');
    const [rows] = await this.conn.execute(sql);
    return rows as any[];
  }

  async testConnection(): Promise<{ ok: boolean; version: string; error?: string }> {
    try {
      const rows = await this.query('SELECT VERSION() as version');
      return { ok: true, version: rows[0].version };
    } catch (err: any) { return { ok: false, version: '', error: err.message }; }
  }

  async listDatabases(): Promise<DatabaseInfo[]> {
    const rows = await this.query("SELECT SCHEMA_NAME as name FROM information_schema.SCHEMATA WHERE SCHEMA_NAME NOT IN ('mysql','information_schema','performance_schema','sys') ORDER BY name");
    return rows;
  }

  async listTables(schema?: string): Promise<TableInfo[]> {
    const db = schema || (this.conn as any).config?.database;
    return this.query(`SELECT TABLE_SCHEMA as \`schema\`, TABLE_NAME as name, TABLE_ROWS as rowEstimate, DATA_LENGTH as sizeBytes
      FROM information_schema.TABLES WHERE TABLE_SCHEMA = '${db}' AND TABLE_TYPE = 'BASE TABLE' ORDER BY name`);
  }

  async listColumns(schema: string, table: string): Promise<ColumnInfo[]> {
    const rows = await this.query(`SELECT COLUMN_NAME as name, COLUMN_TYPE as type,
      IS_NULLABLE = 'YES' as nullable, COLUMN_DEFAULT as defaultValue,
      COLUMN_KEY = 'PRI' as isPrimaryKey, COLUMN_KEY = 'MUL' as isForeignKey
      FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = '${schema}' AND TABLE_NAME = '${table}' ORDER BY ORDINAL_POSITION`);
    return rows;
  }

  async listAllColumns(schema?: string): Promise<any[]> { return []; }
  async listAllIndexes(schema?: string): Promise<any[]> { return []; }

  async listIndexes(schema: string, table: string): Promise<IndexInfo[]> {
    return this.query(`SELECT INDEX_NAME as name, TABLE_NAME as \`table\`, NOT NON_UNIQUE as \`unique\`,
      GROUP_CONCAT(COLUMN_NAME) as columns, '' as definition
      FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = '${schema}' AND TABLE_NAME = '${table}'
      GROUP BY INDEX_NAME, TABLE_NAME, NON_UNIQUE`);
  }

  async listTriggers(schema?: string): Promise<TriggerInfo[]> {
    const db = schema || (this.conn as any).config?.database;
    return this.query(`SELECT TRIGGER_NAME as name, EVENT_OBJECT_TABLE as \`table\`,
      ACTION_TIMING as timing, EVENT_MANIPULATION as event, ACTION_STATEMENT as definition
      FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA = '${db}'`);
  }

  async listProcedures(schema?: string): Promise<ProcedureInfo[]> {
    const db = schema || (this.conn as any).config?.database;
    return this.query(`SELECT ROUTINE_SCHEMA as \`schema\`, ROUTINE_NAME as name, 'SQL' as language,
      ROUTINE_DEFINITION as definition, '' as parameters
      FROM information_schema.ROUTINES WHERE ROUTINE_SCHEMA = '${db}' AND ROUTINE_TYPE = 'PROCEDURE'`);
  }

  async listFunctions(schema?: string): Promise<FunctionInfo[]> {
    const db = schema || (this.conn as any).config?.database;
    return this.query(`SELECT ROUTINE_SCHEMA as \`schema\`, ROUTINE_NAME as name, 'SQL' as language,
      DATA_TYPE as returnType, ROUTINE_DEFINITION as definition, '' as parameters
      FROM information_schema.ROUTINES WHERE ROUTINE_SCHEMA = '${db}' AND ROUTINE_TYPE = 'FUNCTION'`);
  }

  async listViews(schema?: string): Promise<ViewInfo[]> {
    const db = schema || (this.conn as any).config?.database;
    return this.query(`SELECT TABLE_SCHEMA as \`schema\`, TABLE_NAME as name, VIEW_DEFINITION as definition
      FROM information_schema.VIEWS WHERE TABLE_SCHEMA = '${db}'`);
  }

  async getActiveQueries(): Promise<ActiveQuery[]> {
    return this.query(`SELECT ID as pid, USER as username, DB as \`database\`, STATE as state,
      INFO as query, TIME * 1000 as durationMs, NULL as waitEvent
      FROM information_schema.PROCESSLIST WHERE COMMAND != 'Sleep' AND ID != CONNECTION_ID() ORDER BY TIME DESC`);
  }

  async getLocks(): Promise<LockInfo[]> {
    try {
      return this.query(`SELECT r.trx_mysql_thread_id as blockedPid, r.trx_query as blockedQuery,
        b.trx_mysql_thread_id as blockingPid, b.trx_query as blockingQuery,
        'ROW' as lockType, r.trx_wait_started as durationMs
        FROM information_schema.INNODB_LOCK_WAITS w
        JOIN information_schema.INNODB_TRX r ON w.requesting_trx_id = r.trx_id
        JOIN information_schema.INNODB_TRX b ON w.blocking_trx_id = b.trx_id`);
    } catch { return []; }
  }

  async killQuery(pid: number): Promise<{ success: boolean; error?: string }> {
    try { await this.query(`KILL ${pid}`); return { success: true }; }
    catch (err: any) { return { success: false, error: err.message }; }
  }

  async executeSQL(sql: string): Promise<ExecutionResult> {
    const start = Date.now();
    try {
      const [result] = await this.conn!.execute(sql);
      const rows = Array.isArray(result) ? result : undefined;
      const affected = (result as any).affectedRows;
      return { success: true, rowsAffected: affected || 0, rows, durationMs: Date.now() - start };
    } catch (err: any) { return { success: false, error: err.message, durationMs: Date.now() - start }; }
  }
}
