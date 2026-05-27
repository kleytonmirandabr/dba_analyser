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

  async listAllColumns(schema = 'public'): Promise<(import('./base.adapter').ColumnInfo & { tableName: string })[]> {
    const { rows } = await this.pool!.query(`
      SELECT c.table_name as "tableName", c.column_name as name, c.data_type as type,
        CASE c.is_nullable WHEN 'YES' THEN true ELSE false END as nullable,
        c.column_default as "defaultValue",
        CASE WHEN pk.column_name IS NOT NULL THEN true ELSE false END as "isPrimaryKey",
        CASE WHEN fk.column_name IS NOT NULL THEN true ELSE false END as "isForeignKey"
      FROM information_schema.columns c
      LEFT JOIN (SELECT kcu.table_name, kcu.column_name FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
        WHERE tc.table_schema = $1 AND tc.constraint_type = 'PRIMARY KEY') pk
        ON pk.table_name = c.table_name AND pk.column_name = c.column_name
      LEFT JOIN (SELECT kcu.table_name, kcu.column_name FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
        WHERE tc.table_schema = $1 AND tc.constraint_type = 'FOREIGN KEY') fk
        ON fk.table_name = c.table_name AND fk.column_name = c.column_name
      WHERE c.table_schema = $1 ORDER BY c.table_name, c.ordinal_position`, [schema]);
    return rows;
  }

  async listAllIndexes(schema = 'public'): Promise<(import('./base.adapter').IndexInfo & { tableName: string })[]> {
    const { rows } = await this.pool!.query(`
      SELECT t.relname as "tableName", i.relname as name, t.relname as "table",
        ix.indisunique as "unique", pg_get_indexdef(ix.indexrelid) as definition,
        ARRAY(SELECT a.attname FROM pg_attribute a WHERE a.attrelid = ix.indexrelid ORDER BY a.attnum)::text as columns
      FROM pg_index ix
      JOIN pg_class i ON ix.indexrelid = i.oid
      JOIN pg_class t ON ix.indrelid = t.oid
      JOIN pg_namespace n ON t.relnamespace = n.oid
      WHERE n.nspname = $1 AND t.relkind = 'r'`, [schema]);
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

  async listTriggers(schema = 'public', table?: string): Promise<TriggerInfo[]> {
    const params: any[] = [schema];
    let filter = 'WHERE trigger_schema = $1';
    if (table) { filter += ' AND event_object_table = $2'; params.push(table); }
    const rows = await this.query(`
      SELECT trigger_name as name, event_object_table as table,
             action_timing as timing, event_manipulation as event,
             action_statement as definition
      FROM information_schema.triggers ${filter} ORDER BY trigger_name
    `, params);
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



  // === HEALTH MONITORING ===

  async getHealthOverview(): Promise<import('./base.adapter').HealthOverview> {
    const version = (await this.query("SELECT version()"))[0].version;
    const tables = await this.query("SELECT count(*) as cnt FROM pg_stat_user_tables");
    const size = await this.query("SELECT pg_database_size(current_database()) as size");
    const bloated = await this.query("SELECT count(*) as cnt FROM pg_stat_user_tables WHERE n_dead_tup > n_live_tup * 0.2 AND n_live_tup > 100");
    const unusedIdx = await this.query("SELECT count(*) as cnt FROM pg_stat_user_indexes WHERE idx_scan = 0 AND schemaname NOT IN ('pg_toast')");
    const longTx = await this.query("SELECT count(*) as cnt FROM pg_stat_activity WHERE state != 'idle' AND xact_start < now() - interval '5 minutes' AND pid != pg_backend_pid()");
    const conns = await this.query("SELECT count(*) as active FROM pg_stat_activity");
    const maxConns = await this.query("SELECT setting::int as max FROM pg_settings WHERE name = 'max_connections'");
    const cacheHit = await this.query("SELECT CASE WHEN (blks_hit + blks_read) = 0 THEN 1 ELSE blks_hit::float / (blks_hit + blks_read) END as ratio FROM pg_stat_database WHERE datname = current_database()");
    const uptime = await this.query("SELECT now() - pg_postmaster_start_time() as uptime");

    return {
      version: version.split(',')[0],
      totalTables: parseInt(tables[0].cnt),
      totalSizeBytes: parseInt(size[0].size),
      bloatedTables: parseInt(bloated[0].cnt),
      unusedIndexes: parseInt(unusedIdx[0].cnt),
      longTransactions: parseInt(longTx[0].cnt),
      activeConnections: parseInt(conns[0].active),
      maxConnections: parseInt(maxConns[0].max),
      cacheHitRatio: parseFloat(cacheHit[0]?.ratio || '0'),
      uptime: uptime[0]?.uptime?.toString() || '',
    };
  }

  async getTableHealth(): Promise<import('./base.adapter').TableHealth[]> {
    const rows = await this.query(`
      SELECT schemaname as schema, relname as name,
             pg_total_relation_size(relid) as "sizeBytes",
             n_live_tup as "liveTuples", n_dead_tup as "deadTuples",
             n_live_tup as "rowEstimate",
             CASE WHEN (n_live_tup + n_dead_tup) = 0 THEN 0
               ELSE n_dead_tup::float / (n_live_tup + n_dead_tup) END as "bloatRatio",
             last_vacuum::text as "lastVacuum",
             last_analyze::text as "lastAnalyze",
             last_autovacuum::text as "lastAutoVacuum",
             seq_scan as "seqScans", idx_scan as "idxScans"
      FROM pg_stat_user_tables
      ORDER BY n_dead_tup DESC
    `);
    return rows;
  }

  async getSlowQueries(limit = 20): Promise<import('./base.adapter').SlowQuery[]> {
    try {
      // Try pg_stat_statements first
      const rows = await this.query(`
        SELECT query, calls, total_exec_time as "totalTimeMs",
               mean_exec_time as "meanTimeMs", max_exec_time as "maxTimeMs",
               rows, shared_blks_hit as "sharedBlksHit", shared_blks_read as "sharedBlksRead"
        FROM pg_stat_statements
        WHERE userid != 10 AND query NOT LIKE '%pg_stat%'
        ORDER BY total_exec_time DESC LIMIT ${limit}
      `);
      return rows;
    } catch {
      // Fallback: use pg_stat_activity recent
      const rows = await this.query(`
        SELECT query, 1 as calls,
               EXTRACT(EPOCH FROM (now() - query_start)) * 1000 as "totalTimeMs",
               EXTRACT(EPOCH FROM (now() - query_start)) * 1000 as "meanTimeMs",
               EXTRACT(EPOCH FROM (now() - query_start)) * 1000 as "maxTimeMs",
               0 as rows
        FROM pg_stat_activity
        WHERE state = 'active' AND pid != pg_backend_pid()
        ORDER BY query_start ASC LIMIT ${limit}
      `);
      return rows;
    }
  }

  async getUnusedIndexes(): Promise<import('./base.adapter').UnusedIndex[]> {
    const rows = await this.query(`
      SELECT s.schemaname as schema, s.relname as table, s.indexrelname as "indexName",
             pg_relation_size(s.indexrelid) as "indexSizeBytes",
             s.idx_scan as "indexScans",
             pg_get_indexdef(s.indexrelid) as definition
      FROM pg_stat_user_indexes s
      JOIN pg_index i ON s.indexrelid = i.indexrelid
      WHERE s.idx_scan = 0
        AND NOT i.indisunique
        AND NOT i.indisprimary
        AND s.schemaname NOT IN ('pg_toast')
      ORDER BY pg_relation_size(s.indexrelid) DESC
    `);
    return rows;
  }

  async getMissingIndexes(): Promise<import('./base.adapter').MissingIndex[]> {
    const rows = await this.query(`
      SELECT schemaname as schema, relname as table,
             seq_scan as "seqScans", n_live_tup as "rowEstimate",
             'Alto número de sequential scans em tabela grande' as reason
      FROM pg_stat_user_tables
      WHERE seq_scan > 1000 AND n_live_tup > 10000
        AND (idx_scan = 0 OR seq_scan > idx_scan * 10)
      ORDER BY seq_scan DESC LIMIT 20
    `);
    return rows;
  }

  async getDbConfig(): Promise<import('./base.adapter').DbConfigParam[]> {
    const rows = await this.query(`
      SELECT name, setting as "currentValue", unit, category, short_desc as description
      FROM pg_settings
      WHERE name IN (
        'shared_buffers', 'effective_cache_size', 'work_mem', 'maintenance_work_mem',
        'max_connections', 'max_wal_size', 'min_wal_size', 'checkpoint_completion_target',
        'random_page_cost', 'effective_io_concurrency', 'max_worker_processes',
        'max_parallel_workers_per_gather', 'wal_level', 'archive_mode',
        'log_min_duration_statement', 'autovacuum', 'track_counts', 'track_activities'
      )
      ORDER BY name
    `);
    return rows.map((r: any) => ({ ...r, status: 'ok' as const }));
  }

  async getLongTransactions(minDurationMs = 300000): Promise<import('./base.adapter').LongTransaction[]> {
    const rows = await this.query(`
      SELECT pid, usename as username, datname as database, state,
             EXTRACT(EPOCH FROM (now() - xact_start)) * 1000 as "durationMs",
             query, xact_start::text as "xactStart"
      FROM pg_stat_activity
      WHERE xact_start IS NOT NULL
        AND EXTRACT(EPOCH FROM (now() - xact_start)) * 1000 > ${minDurationMs}
        AND pid != pg_backend_pid()
      ORDER BY xact_start ASC
    `);
    return rows;
  }

  async getExplainPlan(sql: string, analyze = false): Promise<import('./base.adapter').ExplainResult> {
    const explainSql = analyze
      ? `EXPLAIN (ANALYZE, FORMAT JSON, BUFFERS, TIMING) ${sql}`
      : `EXPLAIN (FORMAT JSON, COSTS) ${sql}`;
    
    const rows = await this.query(explainSql);
    const rawPlan = rows[0]['QUERY PLAN'] || rows[0];
    const planJson = Array.isArray(rawPlan) ? rawPlan[0] : rawPlan;
    
    const warnings: string[] = [];
    const plan = this.parseExplainNode(planJson.Plan || planJson, warnings);
    
    return {
      plan,
      executionTimeMs: planJson['Execution Time'],
      planningTimeMs: planJson['Planning Time'],
      rawPlan: planJson,
      warnings,
    };
  }

  private parseExplainNode(node: any, warnings: string[]): import('./base.adapter').ExplainNode {
    // Detect problematic patterns
    if (node['Node Type'] === 'Seq Scan' && (node['Plan Rows'] || 0) > 10000) {
      warnings.push(`Sequential Scan em ${node['Relation Name'] || 'tabela'} com ~${node['Plan Rows']} rows — considere criar índice`);
    }
    if (node['Node Type'] === 'Sort' && node['Sort Method']?.includes('external')) {
      warnings.push('Sort em disco (work_mem insuficiente)');
    }
    if (node['Node Type'] === 'Nested Loop' && (node['Plan Rows'] || 0) > 100000) {
      warnings.push('Nested Loop com alta cardinalidade — pode ser mais eficiente como Hash Join');
    }

    const result: import('./base.adapter').ExplainNode = {
      nodeType: node['Node Type'] || 'Unknown',
      relation: node['Relation Name'],
      alias: node['Alias'],
      startupCost: node['Startup Cost'] || 0,
      totalCost: node['Total Cost'] || 0,
      planRows: node['Plan Rows'] || 0,
      actualRows: node['Actual Rows'],
      actualTime: node['Actual Total Time'],
      loops: node['Actual Loops'],
      filter: node['Filter'],
      indexName: node['Index Name'],
      indexCond: node['Index Cond'],
      sortKey: node['Sort Key'],
      joinType: node['Join Type'],
      children: (node['Plans'] || []).map((child: any) => this.parseExplainNode(child, warnings)),
      extra: {},
    };

    // Capture useful extra fields
    if (node['Shared Hit Blocks']) result.extra!.sharedHitBlocks = node['Shared Hit Blocks'];
    if (node['Shared Read Blocks']) result.extra!.sharedReadBlocks = node['Shared Read Blocks'];
    if (node['Rows Removed by Filter']) result.extra!.rowsRemovedByFilter = node['Rows Removed by Filter'];
    if (node['Hash Cond']) result.extra!.hashCond = node['Hash Cond'];

    return result;
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
