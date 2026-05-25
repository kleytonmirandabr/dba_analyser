import { Pool, PoolClient } from 'pg';
import { DatabaseAdapter, ConnectionConfig, DatabaseInfo, TableInfo, ColumnInfo, IndexInfo, TriggerInfo, ProcedureInfo, FunctionInfo, ViewInfo, ActiveQuery, LockInfo, ExecutionResult } from './base.adapter';

export class PostgresAdapter implements DatabaseAdapter {
  private pool: Pool | null = null;
  private config: ConnectionConfig | null = null;

  async connect(config: ConnectionConfig): Promise<void> {
    this.config = config;
    this.pool = new Pool({
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.username,
      password: config.password,
      max: 3,
      connectionTimeoutMillis: config.timeoutMs || 10000,
      statement_timeout: config.timeoutMs || 30000,
    });
  }

  async disconnect(): Promise<void> {
    if (this.pool) { await this.pool.end(); this.pool = null; }
  }

  private async query(sql: string, params?: any[]): Promise<any[]> {
    if (!this.pool) throw new Error('Not connected');
    const result = await this.pool.query(sql, params);
    return result.rows;
  }

  async testConnection(): Promise<{ ok: boolean; version: string; error?: string }> {
    try {
      const rows = await this.query('SELECT version()');
      return { ok: true, version: rows[0].version };
    } catch (err: any) {
      return { ok: false, version: '', error: err.message };
    }
  }

  async listDatabases(): Promise<DatabaseInfo[]> {
    const rows = await this.query(`
      SELECT datname as name, pg_database_size(datname) as "sizeBytes", pg_encoding_to_char(encoding) as encoding
      FROM pg_database WHERE datistemplate = false ORDER BY datname
    `);
    return rows;
  }

  async listTables(schema = 'public'): Promise<TableInfo[]> {
    const rows = await this.query(`
      SELECT schemaname as schema, relname as name,
             n_live_tup as "rowEstimate",
             pg_total_relation_size(relid) as "sizeBytes"
      FROM pg_stat_user_tables WHERE schemaname = $1 ORDER BY relname
    `, [schema]);
    return rows;
  }

  async listColumns(schema: string, table: string): Promise<ColumnInfo[]> {
    const rows = await this.query(`
      SELECT c.column_name as name, c.data_type as type, 
             c.is_nullable = 'YES' as nullable, c.column_default as "defaultValue",
             COALESCE(pk.is_pk, false) as "isPrimaryKey",
             COALESCE(fk.is_fk, false) as "isForeignKey"
      FROM information_schema.columns c
      LEFT JOIN (SELECT kcu.column_name, true as is_pk FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
        WHERE tc.table_schema = $1 AND tc.table_name = $2 AND tc.constraint_type = 'PRIMARY KEY') pk ON pk.column_name = c.column_name
      LEFT JOIN (SELECT kcu.column_name, true as is_fk FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
        WHERE tc.table_schema = $1 AND tc.table_name = $2 AND tc.constraint_type = 'FOREIGN KEY') fk ON fk.column_name = c.column_name
      WHERE c.table_schema = $1 AND c.table_name = $2 ORDER BY c.ordinal_position
    `, [schema, table]);
    return rows;
  }

  async listIndexes(schema: string, table: string): Promise<IndexInfo[]> {
    const rows = await this.query(`
      SELECT indexname as name, tablename as table, indexdef as definition,
             indisunique as unique
      FROM pg_indexes JOIN pg_index ON indexrelid = (schemaname || '.' || indexname)::regclass
      WHERE schemaname = $1 AND tablename = $2
    `.replace(/JOIN pg_index.*/, ''), [schema, table]);
    // Simplified - parse columns from definition
    return rows.map((r: any) => ({ ...r, columns: [], unique: r.definition?.includes('UNIQUE') || false }));
  }

  async listTriggers(schema = 'public'): Promise<TriggerInfo[]> {
    const rows = await this.query(`
      SELECT trigger_name as name, event_object_table as table,
             action_timing as timing, event_manipulation as event,
             action_statement as definition
      FROM information_schema.triggers WHERE trigger_schema = $1 ORDER BY trigger_name
    `, [schema]);
    return rows;
  }

  async listProcedures(schema = 'public'): Promise<ProcedureInfo[]> {
    const rows = await this.query(`
      SELECT n.nspname as schema, p.proname as name, l.lanname as language,
             pg_get_functiondef(p.oid) as definition,
             pg_get_function_arguments(p.oid) as parameters
      FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid
      JOIN pg_language l ON p.prolang = l.oid
      WHERE n.nspname = $1 AND p.prokind = 'p' ORDER BY p.proname
    `, [schema]);
    return rows;
  }

  async listFunctions(schema = 'public'): Promise<FunctionInfo[]> {
    const rows = await this.query(`
      SELECT n.nspname as schema, p.proname as name, l.lanname as language,
             pg_get_function_result(p.oid) as "returnType",
             pg_get_functiondef(p.oid) as definition,
             pg_get_function_arguments(p.oid) as parameters
      FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid
      JOIN pg_language l ON p.prolang = l.oid
      WHERE n.nspname = $1 AND p.prokind = 'f' ORDER BY p.proname
    `, [schema]);
    return rows;
  }

  async listViews(schema = 'public'): Promise<ViewInfo[]> {
    const rows = await this.query(`
      SELECT schemaname as schema, viewname as name, definition
      FROM pg_views WHERE schemaname = $1 ORDER BY viewname
    `, [schema]);
    return rows;
  }

  async getActiveQueries(): Promise<ActiveQuery[]> {
    const rows = await this.query(`
      SELECT pid, usename as username, datname as database, state, query,
             EXTRACT(EPOCH FROM (now() - query_start)) * 1000 as "durationMs",
             wait_event as "waitEvent"
      FROM pg_stat_activity
      WHERE state != 'idle' AND pid != pg_backend_pid()
      ORDER BY query_start ASC
    `);
    return rows;
  }

  async getLocks(): Promise<LockInfo[]> {
    const rows = await this.query(`
      SELECT blocked.pid as "blockedPid", blocked.query as "blockedQuery",
             blocking.pid as "blockingPid", blocking.query as "blockingQuery",
             bl.locktype as "lockType",
             EXTRACT(EPOCH FROM (now() - blocked.query_start)) * 1000 as "durationMs"
      FROM pg_stat_activity blocked
      JOIN pg_locks bl ON bl.pid = blocked.pid
      JOIN pg_locks kl ON kl.locktype = bl.locktype
        AND kl.database IS NOT DISTINCT FROM bl.database
        AND kl.relation IS NOT DISTINCT FROM bl.relation
        AND kl.pid != bl.pid
      JOIN pg_stat_activity blocking ON blocking.pid = kl.pid
      WHERE NOT bl.granted
    `);
    return rows;
  }

  async killQuery(pid: number): Promise<{ success: boolean; error?: string }> {
    try {
      await this.query('SELECT pg_terminate_backend($1)', [pid]);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  async executeSQL(sql: string): Promise<ExecutionResult> {
    const start = Date.now();
    try {
      const result = await this.pool!.query(sql);
      return { success: true, rowsAffected: result.rowCount || 0, rows: result.rows, durationMs: Date.now() - start };
    } catch (err: any) {
      return { success: false, error: err.message, durationMs: Date.now() - start };
    }
  }
}
