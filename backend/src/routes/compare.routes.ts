import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { AppDataSource } from '../config/database';
import { Connection } from '../entities/connection.entity';
import { decrypt } from '../config/encryption';
import { createAdapter } from '../adapters/adapter.factory';
import { DatabaseAdapter } from '../adapters/base.adapter';

const router = Router();
const connRepo = () => AppDataSource.getRepository(Connection);

interface ColumnDiff { column: string; field: string; sourceValue: string; targetValue: string; }
interface TableDiff { name: string; status: 'only_source' | 'only_target' | 'different' | 'identical'; columnsOnlyInSource: string[]; columnsOnlyInTarget: string[]; columnDifferences: ColumnDiff[]; indexesOnlyInSource: string[]; indexesOnlyInTarget: string[]; }
interface ObjectDiff { name: string; status: 'only_source' | 'only_target' | 'different' | 'identical'; sourceDefinition?: string; targetDefinition?: string; }
interface FullSchemaDiff {
  summary: { tables: number; columns: number; triggers: number; procedures: number; functions: number; views: number; indexes: number; total: number };
  tables: TableDiff[]; triggers: ObjectDiff[]; procedures: ObjectDiff[]; functions: ObjectDiff[]; views: ObjectDiff[];
}

function normalizeSql(sql: string | null | undefined): string {
  if (!sql) return '';
  let s = sql;
  // Remove block comments /* ... */
  s = s.replace(/\/\*[\s\S]*?\*\//g, '');
  // Remove line comments -- ...
  s = s.replace(/--[^\r\n]*/g, '');
  // Normalize line endings
  s = s.replace(/\r\n/g, '\n');
  // Collapse all whitespace (spaces, tabs, newlines) to single space
  s = s.replace(/\s+/g, ' ');
  // Remove square brackets [dbo].[name] -> dbo.name
  s = s.replace(/\[([^\]]+)\]/g, '$1');
  // Remove trailing semicolons
  s = s.replace(/;\s*$/, '');
  // Trim and lowercase
  return s.trim().toLowerCase();
}

function compareObjects<T>(source: T[], target: T[], getName: (o: T) => string, getDef: (o: T) => string): ObjectDiff[] {
  const srcMap = new Map(source.map(o => [getName(o), o]));
  const tgtMap = new Map(target.map(o => [getName(o), o]));
  const allNames = new Set([...srcMap.keys(), ...tgtMap.keys()]);
  const diffs: ObjectDiff[] = [];
  for (const name of allNames) {
    const src = srcMap.get(name); const tgt = tgtMap.get(name);
    if (!tgt) diffs.push({ name, status: 'only_source', sourceDefinition: getDef(src!) });
    else if (!src) diffs.push({ name, status: 'only_target', targetDefinition: getDef(tgt!) });
    else if (normalizeSql(getDef(src)) !== normalizeSql(getDef(tgt))) diffs.push({ name, status: 'different', sourceDefinition: getDef(src), targetDefinition: getDef(tgt) });
  }
  return diffs;
}

// POST /api/compare
router.post('/', authMiddleware, async (req: Request, res: Response) => {
  const { sourceId, targetId, schema } = req.body;
  if (!sourceId || !targetId) return res.status(400).json({ error: 'sourceId e targetId são obrigatórios' });

  let srcAdapter: DatabaseAdapter | null = null;
  let tgtAdapter: DatabaseAdapter | null = null;

  try {
    const [source, target] = await Promise.all([
      connRepo().findOne({ where: { id: sourceId } }),
      connRepo().findOne({ where: { id: targetId } }),
    ]);
    if (!source || !target) return res.status(404).json({ error: 'Conexão não encontrada' });

    const srcSchema = schema || (source.dbType === 'postgresql' ? 'public' : 'dbo');
    const tgtSchema = schema || (target.dbType === 'postgresql' ? 'public' : 'dbo');

    srcAdapter = createAdapter(source.dbType);
    tgtAdapter = createAdapter(target.dbType);
    await srcAdapter.connect({ host: source.host, port: source.port, database: source.databaseName, username: source.username, password: decrypt(source.passwordEncrypted), timeoutMs: 30000 });
    await tgtAdapter.connect({ host: target.host, port: target.port, database: target.databaseName, username: target.username, password: decrypt(target.passwordEncrypted), timeoutMs: 30000 });

    // === FETCH EVERYTHING IN PARALLEL (6 queries per side = 12 total, but parallel = 6 round trips) ===
    const [srcTables, tgtTables, srcTriggers, tgtTriggers, srcProcs, tgtProcs, srcFuncs, tgtFuncs, srcViews, tgtViews, srcAllCols, tgtAllCols, srcAllIdx, tgtAllIdx] = await Promise.all([
      srcAdapter.listTables(srcSchema),
      tgtAdapter.listTables(tgtSchema),
      srcAdapter.listTriggers(srcSchema),
      tgtAdapter.listTriggers(tgtSchema),
      srcAdapter.listProcedures(srcSchema),
      tgtAdapter.listProcedures(tgtSchema),
      srcAdapter.listFunctions(srcSchema),
      tgtAdapter.listFunctions(tgtSchema),
      srcAdapter.listViews(srcSchema),
      tgtAdapter.listViews(tgtSchema),
      srcAdapter.listAllColumns(srcSchema),
      tgtAdapter.listAllColumns(tgtSchema),
      srcAdapter.listAllIndexes(srcSchema).catch(() => [] as any[]),
      tgtAdapter.listAllIndexes(tgtSchema).catch(() => [] as any[]),
    ]);

    // === GROUP COLUMNS BY TABLE ===
    const groupBy = (arr: any[], key: string) => {
      const map = new Map<string, any[]>();
      for (const item of arr) { const k = item[key]; if (!map.has(k)) map.set(k, []); map.get(k)!.push(item); }
      return map;
    };
    const srcColsByTable = groupBy(srcAllCols, 'tableName');
    const tgtColsByTable = groupBy(tgtAllCols, 'tableName');
    const srcIdxByTable = groupBy(srcAllIdx, 'tableName');
    const tgtIdxByTable = groupBy(tgtAllIdx, 'tableName');

    // === COMPARE TABLES + COLUMNS + INDEXES (all in memory, zero extra queries) ===
    const srcTableNames = new Set(srcTables.map(t => t.name));
    const tgtTableNames = new Set(tgtTables.map(t => t.name));
    const allTableNames = new Set([...srcTableNames, ...tgtTableNames]);

    const tableDiffs: TableDiff[] = [];
    let totalColDiffs = 0, totalIdxDiffs = 0;

    for (const tableName of allTableNames) {
      if (!tgtTableNames.has(tableName)) { tableDiffs.push({ name: tableName, status: 'only_source', columnsOnlyInSource: [], columnsOnlyInTarget: [], columnDifferences: [], indexesOnlyInSource: [], indexesOnlyInTarget: [] }); continue; }
      if (!srcTableNames.has(tableName)) { tableDiffs.push({ name: tableName, status: 'only_target', columnsOnlyInSource: [], columnsOnlyInTarget: [], columnDifferences: [], indexesOnlyInSource: [], indexesOnlyInTarget: [] }); continue; }

      const srcCols = srcColsByTable.get(tableName) || [];
      const tgtCols = tgtColsByTable.get(tableName) || [];
      const srcColMap = new Map(srcCols.map((c: any) => [c.name, c]));
      const tgtColMap = new Map(tgtCols.map((c: any) => [c.name, c]));

      const columnsOnlyInSource: string[] = [];
      const columnsOnlyInTarget: string[] = [];
      const columnDifferences: ColumnDiff[] = [];

      for (const [name, srcCol] of srcColMap) {
        if (!tgtColMap.has(name)) { columnsOnlyInSource.push(name); continue; }
        const tgtCol = tgtColMap.get(name)!;
        if ((srcCol.type || '').toLowerCase() !== (tgtCol.type || '').toLowerCase()) columnDifferences.push({ column: name, field: 'type', sourceValue: srcCol.type, targetValue: tgtCol.type });
        if (srcCol.nullable !== tgtCol.nullable) columnDifferences.push({ column: name, field: 'nullable', sourceValue: String(srcCol.nullable), targetValue: String(tgtCol.nullable) });
        if ((srcCol.defaultValue || '') !== (tgtCol.defaultValue || '')) columnDifferences.push({ column: name, field: 'default', sourceValue: srcCol.defaultValue || 'NULL', targetValue: tgtCol.defaultValue || 'NULL' });
        if (srcCol.isPrimaryKey !== tgtCol.isPrimaryKey) columnDifferences.push({ column: name, field: 'primaryKey', sourceValue: String(srcCol.isPrimaryKey), targetValue: String(tgtCol.isPrimaryKey) });
        if (srcCol.isForeignKey !== tgtCol.isForeignKey) columnDifferences.push({ column: name, field: 'foreignKey', sourceValue: String(srcCol.isForeignKey), targetValue: String(tgtCol.isForeignKey) });
      }
      for (const [name] of tgtColMap) { if (!srcColMap.has(name)) columnsOnlyInTarget.push(name); }

      // Compare indexes
      const srcIdx = srcIdxByTable.get(tableName) || [];
      const tgtIdx = tgtIdxByTable.get(tableName) || [];
      const srcIdxNames = new Set(srcIdx.map((i: any) => i.name));
      const tgtIdxNames = new Set(tgtIdx.map((i: any) => i.name));
      const indexesOnlyInSource = [...srcIdxNames].filter(n => !tgtIdxNames.has(n));
      const indexesOnlyInTarget = [...tgtIdxNames].filter(n => !srcIdxNames.has(n));

      const hasDiffs = columnsOnlyInSource.length + columnsOnlyInTarget.length + columnDifferences.length + indexesOnlyInSource.length + indexesOnlyInTarget.length > 0;
      totalColDiffs += columnsOnlyInSource.length + columnsOnlyInTarget.length + columnDifferences.length;
      totalIdxDiffs += indexesOnlyInSource.length + indexesOnlyInTarget.length;

      tableDiffs.push({ name: tableName, status: hasDiffs ? 'different' : 'identical', columnsOnlyInSource, columnsOnlyInTarget, columnDifferences, indexesOnlyInSource, indexesOnlyInTarget });
    }

    // === COMPARE OBJECTS ===
    const triggerDiffs = compareObjects(srcTriggers, tgtTriggers, t => t.name, t => t.definition);
    const procDiffs = compareObjects(srcProcs, tgtProcs, p => p.name, p => p.definition);
    const funcDiffs = compareObjects(srcFuncs, tgtFuncs, f => f.name, f => f.definition);
    const viewDiffs = compareObjects(srcViews, tgtViews, v => v.name, v => v.definition);

    const diff: FullSchemaDiff = {
      summary: {
        tables: tableDiffs.filter(t => t.status !== 'identical').length,
        columns: totalColDiffs, indexes: totalIdxDiffs,
        triggers: triggerDiffs.length, procedures: procDiffs.length,
        functions: funcDiffs.length, views: viewDiffs.length, total: 0,
      },
      tables: tableDiffs.filter(t => t.status !== 'identical'),
      triggers: triggerDiffs, procedures: procDiffs, functions: funcDiffs, views: viewDiffs,
    };
    diff.summary.total = diff.summary.tables + diff.summary.triggers + diff.summary.procedures + diff.summary.functions + diff.summary.views;

    return res.json({ data: diff });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  } finally {
    if (srcAdapter) await srcAdapter.disconnect();
    if (tgtAdapter) await tgtAdapter.disconnect();
  }
});

export default router;
