import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { AppDataSource } from '../config/database';
import { Connection } from '../entities/connection.entity';
import { getConnCredentials } from '../utils/credentials';
import { createAdapter } from '../adapters/adapter.factory';
import { DatabaseAdapter } from '../adapters/base.adapter';

const router = Router();
const connRepo = () => AppDataSource.getRepository(Connection);

async function getAdapter(connId: string): Promise<{ adapter: DatabaseAdapter; connection?: Connection; error?: string }> {
  const conn = await connRepo().findOne({ where: { id: connId, isActive: true } });
  if (!conn) return { adapter: null as any, error: 'Conexão não encontrada' };

  
  const adapter = createAdapter(conn.dbType);
  await adapter.connect({
    ...getConnCredentials(conn),
    timeoutMs: conn.queryTimeoutMs,
  });
  return { adapter, connection: conn };
}

// GET /api/explorer/:connId/databases
router.get('/:connId/databases', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { adapter, error } = await getAdapter(req.params.connId);
    if (error) return res.status(404).json({ error });
    const data = await adapter.listDatabases();
    await adapter.disconnect();
    return res.json({ data });
  } catch (err: any) { return res.status(500).json({ error: err.message }); }
});

// GET /api/explorer/:connId/schemas
router.get('/:connId/schemas', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { adapter, error, connection } = await getAdapter(req.params.connId);
    if (error) return res.status(404).json({ error });

    let schemas: string[] = [];
    if (connection!.dbType === 'postgresql') {
      const pool = (adapter as any).pool;
      const result = await pool.query("SELECT schema_name FROM information_schema.schemata WHERE schema_name NOT IN ('pg_catalog','information_schema','pg_toast') ORDER BY schema_name");
      schemas = result.rows.map((r: any) => r.schema_name);
    } else {
      const result = await (adapter as any).query("SELECT s.name as schema_name FROM sys.schemas s WHERE s.schema_id < 16384 AND s.name NOT IN ('guest','INFORMATION_SCHEMA','sys') ORDER BY s.name");
      schemas = result.map((r: any) => r.schema_name);
    }

    await adapter.disconnect();
    return res.json({ data: schemas });
  } catch (err: any) { return res.status(500).json({ error: err.message }); }
});

// GET /api/explorer/:connId/tables?schema=public
router.get('/:connId/tables', authMiddleware, async (req: Request, res: Response) => {
  try {
    const schema = (req.query.schema as string) || 'public';
    const { adapter, error } = await getAdapter(req.params.connId);
    if (error) return res.status(404).json({ error });
    const data = await adapter.listTables(schema);
    await adapter.disconnect();
    return res.json({ data });
  } catch (err: any) { return res.status(500).json({ error: err.message }); }
});

// GET /api/explorer/:connId/columns/:schema/:table
router.get('/:connId/columns/:schema/:table', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { adapter, error } = await getAdapter(req.params.connId);
    if (error) return res.status(404).json({ error });
    const data = await adapter.listColumns(req.params.schema, req.params.table);
    await adapter.disconnect();
    return res.json({ data });
  } catch (err: any) { return res.status(500).json({ error: err.message }); }
});

// GET /api/explorer/:connId/indexes/:schema/:table
router.get('/:connId/indexes/:schema/:table', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { adapter, error } = await getAdapter(req.params.connId);
    if (error) return res.status(404).json({ error });
    const data = await adapter.listIndexes(req.params.schema, req.params.table);
    await adapter.disconnect();
    return res.json({ data });
  } catch (err: any) { return res.status(500).json({ error: err.message }); }
});

// GET /api/explorer/:connId/views?schema=public
router.get('/:connId/views', authMiddleware, async (req: Request, res: Response) => {
  try {
    const schema = (req.query.schema as string) || 'public';
    const { adapter, error } = await getAdapter(req.params.connId);
    if (error) return res.status(404).json({ error });
    const data = await adapter.listViews(schema);
    await adapter.disconnect();
    return res.json({ data });
  } catch (err: any) { return res.status(500).json({ error: err.message }); }
});

// GET /api/explorer/:connId/functions?schema=public
router.get('/:connId/functions', authMiddleware, async (req: Request, res: Response) => {
  try {
    const schema = (req.query.schema as string) || 'public';
    const { adapter, error } = await getAdapter(req.params.connId);
    if (error) return res.status(404).json({ error });
    const data = await adapter.listFunctions(schema);
    await adapter.disconnect();
    return res.json({ data });
  } catch (err: any) { return res.status(500).json({ error: err.message }); }
});

// GET /api/explorer/:connId/triggers?schema=public&table=tableName
router.get('/:connId/triggers', authMiddleware, async (req: Request, res: Response) => {
  try {
    const schema = (req.query.schema as string) || 'public';
    const table = req.query.table as string | undefined;
    const { adapter, error } = await getAdapter(req.params.connId);
    if (error) return res.status(404).json({ error });
    const data = await adapter.listTriggers(schema, table);
    await adapter.disconnect();
    return res.json({ data });
  } catch (err: any) { return res.status(500).json({ error: err.message }); }
});

// GET /api/explorer/:connId/procedures?schema=public
router.get('/:connId/procedures', authMiddleware, async (req: Request, res: Response) => {
  try {
    const schema = (req.query.schema as string) || 'public';
    const { adapter, error } = await getAdapter(req.params.connId);
    if (error) return res.status(404).json({ error });
    const data = await adapter.listProcedures(schema);
    await adapter.disconnect();
    return res.json({ data });
  } catch (err: any) { return res.status(500).json({ error: err.message }); }
});


// GET /api/explorer/:connId/relationships?schema=public
router.get('/:connId/relationships', authMiddleware, async (req: Request, res: Response) => {
  try {
    const schema = (req.query.schema as string) || 'public';
    const { adapter, error, connection } = await getAdapter(req.params.connId);
    if (error) return res.status(404).json({ error });

    let tables: any[] = [];
    let relationships: any[] = [];

    if (connection!.dbType === 'postgresql') {
      const pool = (adapter as any).pool;

      // Get tables with columns
      const tablesResult = await pool.query(`
        SELECT c.table_name, c.column_name, c.data_type,
          CASE WHEN tc.constraint_type = 'PRIMARY KEY' THEN true ELSE false END as is_pk,
          CASE WHEN fk.column_name IS NOT NULL THEN true ELSE false END as is_fk
        FROM information_schema.columns c
        LEFT JOIN information_schema.key_column_usage kcu
          ON c.table_schema = kcu.table_schema AND c.table_name = kcu.table_name AND c.column_name = kcu.column_name
        LEFT JOIN information_schema.table_constraints tc
          ON kcu.constraint_name = tc.constraint_name AND tc.constraint_type = 'PRIMARY KEY' AND tc.table_schema = kcu.table_schema
        LEFT JOIN (
          SELECT kcu2.table_schema, kcu2.table_name, kcu2.column_name
          FROM information_schema.key_column_usage kcu2
          JOIN information_schema.table_constraints tc2
            ON kcu2.constraint_name = tc2.constraint_name AND tc2.constraint_type = 'FOREIGN KEY' AND tc2.table_schema = kcu2.table_schema
          WHERE kcu2.table_schema = $1
        ) fk ON c.table_schema = fk.table_schema AND c.table_name = fk.table_name AND c.column_name = fk.column_name
        WHERE c.table_schema = $1
          AND c.table_name IN (SELECT table_name FROM information_schema.tables WHERE table_schema = $1 AND table_type = 'BASE TABLE')
        ORDER BY c.table_name, c.ordinal_position
      `, [schema]);

      // Group by table
      const tableMap = new Map<string, any>();
      for (const row of tablesResult.rows) {
        if (!tableMap.has(row.table_name)) {
          tableMap.set(row.table_name, { name: row.table_name, schema, columns: [] });
        }
        tableMap.get(row.table_name).columns.push({
          name: row.column_name, type: row.data_type, isPk: row.is_pk, isFk: row.is_fk
        });
      }
      tables = Array.from(tableMap.values());

      // Get relationships
      const relResult = await pool.query(`
        SELECT
          tc.constraint_name as name,
          kcu.table_name as from_table,
          kcu.column_name as from_column,
          ccu.table_name as to_table,
          ccu.column_name as to_column
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage ccu
          ON tc.constraint_name = ccu.constraint_name AND tc.table_schema = ccu.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = $1
      `, [schema]);

      relationships = relResult.rows.map((r: any) => ({
        name: r.name,
        from: { table: r.from_table, column: r.from_column },
        to: { table: r.to_table, column: r.to_column }
      }));
    } else {
      // MSSQL
      const tablesQuery = await (adapter as any).query(`
        SELECT t.name as table_name, c.name as column_name, ty.name as data_type,
          CASE WHEN pk.column_id IS NOT NULL THEN 1 ELSE 0 END as is_pk,
          CASE WHEN fkc.parent_column_id IS NOT NULL THEN 1 ELSE 0 END as is_fk
        FROM sys.tables t
        JOIN sys.columns c ON t.object_id = c.object_id
        JOIN sys.types ty ON c.user_type_id = ty.user_type_id
        JOIN sys.schemas s ON t.schema_id = s.schema_id
        LEFT JOIN (
          SELECT ic.object_id, ic.column_id FROM sys.index_columns ic
          JOIN sys.indexes i ON ic.object_id = i.object_id AND ic.index_id = i.index_id
          WHERE i.is_primary_key = 1
        ) pk ON c.object_id = pk.object_id AND c.column_id = pk.column_id
        LEFT JOIN sys.foreign_key_columns fkc ON c.object_id = fkc.parent_object_id AND c.column_id = fkc.parent_column_id
        WHERE s.name = @schema
        ORDER BY t.name, c.column_id
      `.replace('@schema', `'${schema}'`));

      const tableMap = new Map<string, any>();
      for (const row of tablesQuery) {
        if (!tableMap.has(row.table_name)) {
          tableMap.set(row.table_name, { name: row.table_name, schema, columns: [] });
        }
        tableMap.get(row.table_name).columns.push({
          name: row.column_name, type: row.data_type, isPk: !!row.is_pk, isFk: !!row.is_fk
        });
      }
      tables = Array.from(tableMap.values());

      const relQuery = await (adapter as any).query(`
        SELECT fk.name as name,
          tp.name as from_table, cp.name as from_column,
          tr.name as to_table, cr.name as to_column
        FROM sys.foreign_keys fk
        JOIN sys.foreign_key_columns fkc ON fk.object_id = fkc.constraint_object_id
        JOIN sys.tables tp ON fkc.parent_object_id = tp.object_id
        JOIN sys.columns cp ON fkc.parent_object_id = cp.object_id AND fkc.parent_column_id = cp.column_id
        JOIN sys.tables tr ON fkc.referenced_object_id = tr.object_id
        JOIN sys.columns cr ON fkc.referenced_object_id = cr.object_id AND fkc.referenced_column_id = cr.column_id
        JOIN sys.schemas s ON tp.schema_id = s.schema_id
        WHERE s.name = '${schema}'
      `);

      relationships = relQuery.map((r: any) => ({
        name: r.name,
        from: { table: r.from_table, column: r.from_column },
        to: { table: r.to_table, column: r.to_column }
      }));
    }

    await adapter.disconnect();
    return res.json({ data: { tables, relationships } });
  } catch (err: any) { return res.status(500).json({ error: err.message }); }
});


// GET /api/explorer/:connId/completions?schema=public - lightweight autocomplete payload
router.get('/:connId/completions', authMiddleware, async (req: Request, res: Response) => {
  try {
    const schema = (req.query.schema as string) || 'public';
    const { adapter, error } = await getAdapter(req.params.connId);
    if (error) return res.status(404).json({ error });
    const tables = await adapter.listTables(schema);
    const result: { name: string; columns: string[] }[] = [];
    for (const t of tables) {
      const cols = await adapter.listColumns(t.name, schema);
      result.push({ name: t.name, columns: cols.map((c: any) => c.name) });
    }
    await adapter.disconnect();
    return res.json({ data: { tables: result } });
  } catch (err: any) { return res.status(500).json({ error: err.message }); }
});

export default router;
