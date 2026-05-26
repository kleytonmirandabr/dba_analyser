import { Router, Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { SchemaSnapshot } from '../entities/schema-snapshot.entity';
import { Connection } from '../entities/connection.entity';
import { createAdapter } from '../adapters/adapter.factory';
import { DatabaseAdapter } from '../adapters/base.adapter';
import { getConnCredentials } from '../utils/credentials';

const router = Router();

function computeDiff(prev: Record<string, any>, curr: Record<string, any>) {
  const diff: { added: string[]; removed: string[]; modified: string[] } = { added: [], removed: [], modified: [] };
  
  const prevTables = new Set(Object.keys(prev.tables || {}));
  const currTables = new Set(Object.keys(curr.tables || {}));
  
  for (const t of currTables) {
    if (!prevTables.has(t)) diff.added.push(`table:${t}`);
    else if (JSON.stringify(prev.tables[t]) !== JSON.stringify(curr.tables[t])) diff.modified.push(`table:${t}`);
  }
  for (const t of prevTables) {
    if (!currTables.has(t)) diff.removed.push(`table:${t}`);
  }

  const prevFuncs = new Set((prev.functions || []).map((f: any) => f.name));
  const currFuncs = new Set((curr.functions || []).map((f: any) => f.name));
  for (const f of currFuncs) { if (!prevFuncs.has(f)) diff.added.push(`function:${f}`); }
  for (const f of prevFuncs) { if (!currFuncs.has(f)) diff.removed.push(`function:${f}`); }

  return diff;
}

// POST /api/schema-versions/:connId/capture
router.post('/:connId/capture', async (req: Request, res: Response) => {
  try {
    const { connId } = req.params;
    const { label, schema: schemaName = 'public' } = req.body;

    const connRepo = AppDataSource.getRepository(Connection);
    const conn = await connRepo.findOne({ where: { id: connId } });
    if (!conn) return res.status(404).json({ error: 'Connection not found' });

    const adapter = createAdapter(conn.dbType);
    await adapter.connect({ ...getConnCredentials(conn), timeoutMs: conn.queryTimeoutMs });

    try {
      const tables = await adapter.listTables(schemaName);
      const tablesData: Record<string, any> = {};

      for (const table of tables) {
        const tableName = typeof table === 'string' ? table : table.name;
        const columns = await adapter.listColumns(tableName, schemaName);
        const indexes = await adapter.listIndexes(tableName, schemaName);
        tablesData[tableName] = { columns, indexes };
      }

      let functions: any[] = [];
      try {
        if ((adapter as any).listFunctions) {
          functions = await (adapter as any).listFunctions(schemaName);
        }
      } catch {}

      let triggers: any[] = [];
      try {
        if ((adapter as any).listTriggers) {
          triggers = await (adapter as any).listTriggers(schemaName);
        }
      } catch {}

      const snapshot = { tables: tablesData, functions, triggers };

      // Get previous snapshot for diff
      const snapRepo = AppDataSource.getRepository(SchemaSnapshot);
      const prevSnapshot = await snapRepo.findOne({
        where: { connectionId: connId, schema: schemaName },
        order: { capturedAt: 'DESC' },
      });

      const diff = prevSnapshot ? computeDiff(prevSnapshot.snapshot, snapshot) : null;

      const newSnap = snapRepo.create({
        connectionId: connId,
        database: conn.database,
        schema: schemaName,
        snapshot,
        diff,
        label: label || null,
      });
      await snapRepo.save(newSnap);

      res.json({ data: newSnap });
    } finally {
      await adapter.disconnect();
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/schema-versions/:connId
router.get('/:connId', async (req: Request, res: Response) => {
  try {
    const snapRepo = AppDataSource.getRepository(SchemaSnapshot);
    const snapshots = await snapRepo.find({
      where: { connectionId: req.params.connId },
      order: { capturedAt: 'DESC' },
      select: ['id', 'capturedAt', 'label', 'diff', 'schema', 'database'],
    });
    res.json({ data: snapshots });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/schema-versions/:connId/:snapshotId
router.get('/:connId/:snapshotId', async (req: Request, res: Response) => {
  try {
    const snapRepo = AppDataSource.getRepository(SchemaSnapshot);
    const snap = await snapRepo.findOne({
      where: { id: req.params.snapshotId, connectionId: req.params.connId },
    });
    if (!snap) return res.status(404).json({ error: 'Snapshot not found' });
    res.json({ data: snap });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/schema-versions/:connId/diff/:fromId/:toId
router.get('/:connId/diff/:fromId/:toId', async (req: Request, res: Response) => {
  try {
    const snapRepo = AppDataSource.getRepository(SchemaSnapshot);
    const [from, to] = await Promise.all([
      snapRepo.findOne({ where: { id: req.params.fromId, connectionId: req.params.connId } }),
      snapRepo.findOne({ where: { id: req.params.toId, connectionId: req.params.connId } }),
    ]);
    if (!from || !to) return res.status(404).json({ error: 'Snapshot not found' });
    const diff = computeDiff(from.snapshot, to.snapshot);
    res.json({ data: { from: { id: from.id, capturedAt: from.capturedAt, label: from.label }, to: { id: to.id, capturedAt: to.capturedAt, label: to.label }, diff } });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/schema-versions/:connId/:snapshotId
router.put('/:connId/:snapshotId', async (req: Request, res: Response) => {
  try {
    const snapRepo = AppDataSource.getRepository(SchemaSnapshot);
    const snap = await snapRepo.findOne({ where: { id: req.params.snapshotId, connectionId: req.params.connId } });
    if (!snap) return res.status(404).json({ error: 'Snapshot not found' });
    if (req.body.label !== undefined) snap.label = req.body.label;
    if (req.body.notes !== undefined) snap.notes = req.body.notes;
    await snapRepo.save(snap);
    res.json({ data: snap });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/schema-versions/:connId/:snapshotId
router.delete('/:connId/:snapshotId', async (req: Request, res: Response) => {
  try {
    const snapRepo = AppDataSource.getRepository(SchemaSnapshot);
    const snap = await snapRepo.findOne({ where: { id: req.params.snapshotId, connectionId: req.params.connId } });
    if (!snap) return res.status(404).json({ error: 'Snapshot not found' });
    await snapRepo.remove(snap);
    res.json({ data: { success: true } });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
