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

  // Monitor
  getActiveQueries(): Promise<ActiveQuery[]>;
  getLocks(): Promise<LockInfo[]>;
  killQuery(pid: number): Promise<{ success: boolean; error?: string }>;

  // Execution
  executeSQL(sql: string): Promise<ExecutionResult>;
}
