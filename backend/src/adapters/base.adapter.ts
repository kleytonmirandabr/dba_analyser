export interface ConnectionConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  timeoutMs?: number;
}

export interface DatabaseInfo { name: string; sizeBytes?: number; encoding?: string; }
export interface TableInfo { schema: string; name: string; rowEstimate?: number; sizeBytes?: number; }
export interface ColumnInfo { name: string; type: string; nullable: boolean; defaultValue: string | null; isPrimaryKey: boolean; isForeignKey: boolean; }
export interface IndexInfo { name: string; table: string; columns: string[]; unique: boolean; definition: string; }
export interface TriggerInfo { name: string; table: string; timing: string; event: string; definition: string; }
export interface ProcedureInfo { schema: string; name: string; language: string; definition: string; parameters: string; }
export interface FunctionInfo { schema: string; name: string; language: string; returnType: string; definition: string; parameters: string; }
export interface ViewInfo { schema: string; name: string; definition: string; }
export interface ActiveQuery { pid: number; username: string; database: string; state: string; query: string; durationMs: number; waitEvent?: string; }
export interface LockInfo { blockedPid: number; blockedQuery: string; blockingPid: number; blockingQuery: string; lockType: string; durationMs?: number; }
export interface ExecutionResult { success: boolean; rowsAffected?: number; rows?: any[]; error?: string; durationMs: number; }

// === Health Monitoring Types ===
export interface TableHealth {
  schema: string;
  name: string;
  sizeBytes: number;
  rowEstimate: number;
  deadTuples: number;
  liveTuples: number;
  bloatRatio: number; // 0-1 (dead / (live + dead))
  lastVacuum: string | null;
  lastAnalyze: string | null;
  lastAutoVacuum: string | null;
  seqScans: number;
  idxScans: number;
}

export interface SlowQuery {
  query: string;
  calls: number;
  totalTimeMs: number;
  meanTimeMs: number;
  maxTimeMs: number;
  rows: number;
  sharedBlksHit?: number;
  sharedBlksRead?: number;
}

export interface UnusedIndex {
  schema: string;
  table: string;
  indexName: string;
  indexSizeBytes: number;
  indexScans: number;
  definition?: string;
}

export interface MissingIndex {
  schema: string;
  table: string;
  reason: string; // e.g. "high seq_scan count"
  seqScans: number;
  rowEstimate: number;
  suggestedColumns?: string[];
  estimatedImpact?: string;
}

export interface DbConfigParam {
  name: string;
  currentValue: string;
  unit?: string;
  category: string;
  description?: string;
  recommended?: string;
  status: 'ok' | 'warning' | 'critical';
}

export interface LongTransaction {
  pid: number;
  username: string;
  database: string;
  state: string;
  durationMs: number;
  query: string;
  xactStart: string;
}

export interface HealthOverview {
  totalTables: number;
  totalSizeBytes: number;
  bloatedTables: number; // tables with bloat > 20%
  unusedIndexes: number;
  longTransactions: number;
  activeConnections: number;
  maxConnections: number;
  cacheHitRatio: number; // 0-1
  uptime?: string;
  version: string;
}

export interface ExplainNode {
  nodeType: string;
  relation?: string;
  alias?: string;
  startupCost: number;
  totalCost: number;
  planRows: number;
  actualRows?: number;
  actualTime?: number;
  loops?: number;
  filter?: string;
  indexName?: string;
  indexCond?: string;
  sortKey?: string[];
  joinType?: string;
  children?: ExplainNode[];
  extra?: Record<string, any>;
}

export interface ExplainResult {
  plan: ExplainNode;
  executionTimeMs?: number;
  planningTimeMs?: number;
  rawPlan: any; // original JSON/XML
  warnings: string[];
}

export interface DatabaseAdapter {
  connect(config: ConnectionConfig): Promise<void>;
  disconnect(): Promise<void>;
  testConnection(): Promise<{ ok: boolean; version: string; error?: string }>;

  // Explorer
  listDatabases(): Promise<DatabaseInfo[]>;
  listTables(schema?: string): Promise<TableInfo[]>;
  listColumns(schema: string, table: string): Promise<ColumnInfo[]>;
  listIndexes(schema: string, table: string): Promise<IndexInfo[]>;
  listTriggers(schema?: string): Promise<TriggerInfo[]>;
  listProcedures(schema?: string): Promise<ProcedureInfo[]>;
  listFunctions(schema?: string): Promise<FunctionInfo[]>;
  listViews(schema?: string): Promise<ViewInfo[]>;

  // Bulk fetch for compare (all columns/indexes in one query)
  listAllColumns(schema?: string): Promise<(ColumnInfo & { tableName: string })[]>;
  listAllIndexes(schema?: string): Promise<(IndexInfo & { tableName: string })[]>;

  // Monitor
  getActiveQueries(): Promise<ActiveQuery[]>;
  getLocks(): Promise<LockInfo[]>;
  killQuery(pid: number): Promise<{ success: boolean; error?: string }>;

  // Execution
  executeSQL(sql: string): Promise<ExecutionResult>;

  // Health Monitoring (optional — adapters implement what they can)
  getHealthOverview?(): Promise<HealthOverview>;
  getTableHealth?(): Promise<TableHealth[]>;
  getSlowQueries?(limit?: number): Promise<SlowQuery[]>;
  getUnusedIndexes?(): Promise<UnusedIndex[]>;
  getMissingIndexes?(): Promise<MissingIndex[]>;
  getDbConfig?(): Promise<DbConfigParam[]>;
  getLongTransactions?(minDurationMs?: number): Promise<LongTransaction[]>;
  getExplainPlan?(sql: string, analyze?: boolean): Promise<ExplainResult>;
}
