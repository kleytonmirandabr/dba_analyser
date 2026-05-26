import { Router, Request, Response } from 'express';
import { authMiddleware, requireRole } from '../middleware/auth.middleware';
import { AppDataSource } from '../config/database';
import { ExecutionRequest } from '../entities/execution-request.entity';
import { Connection } from '../entities/connection.entity';
import { AuditLog } from '../entities/audit-log.entity';
import { getConnCredentials } from '../utils/credentials';
import { PostgresAdapter } from '../adapters/postgres.adapter';
import { z } from 'zod';

const router = Router();
const execRepo = () => AppDataSource.getRepository(ExecutionRequest);
const connRepo = () => AppDataSource.getRepository(Connection);

// GET /api/execution - list requests
router.get('/', authMiddleware, async (req: Request, res: Response) => {
  const where: any = {};
  if (req.query.status) where.status = req.query.status;
  if (req.query.connectionId) where.connectionId = req.query.connectionId;

  const requests = await execRepo().find({
    where, order: { requestedAt: 'DESC' }, take: 50,
    relations: ['connection', 'requestedBy', 'approvedBy'],
  });

  return res.json({ data: requests.map(r => ({
    ...r,
    connection: r.connection ? { id: r.connection.id, name: r.connection.name, environment: r.connection.environment } : null,
    requestedBy: r.requestedBy ? { id: r.requestedBy.id, name: r.requestedBy.name } : null,
    approvedBy: r.approvedBy ? { id: r.approvedBy.id, name: r.approvedBy.name } : null,
  }))});
});

// POST /api/execution/submit
const submitSchema = z.object({
  connectionId: z.string().uuid(),
  sqlText: z.string().min(1),
  description: z.string().optional(),
  rollbackSql: z.string().optional(),
});

router.post('/submit', authMiddleware, async (req: Request, res: Response) => {
  try {
    const data = submitSchema.parse(req.body);
    const conn = await connRepo().findOne({ where: { id: data.connectionId } });
    if (!conn) return res.status(404).json({ error: 'Conexão não encontrada' });
    if (conn.mode !== 'execute') return res.status(403).json({ error: 'Conexão não está em modo execução' });

    const request = execRepo().create({
      ...data,
      requestedById: req.user!.userId,
      status: conn.autoApprove ? 'approved' : 'pending',
    });
    const saved = await execRepo().save(request);

    // Emit WebSocket event for pending executions
    if (saved.status === 'pending') {
      const io = req.app.get('io');
      if (io) {
        io.emit('execution:pending', {
          id: saved.id,
          sql: data.sqlText,
          connectionName: conn.name,
          requestedBy: req.user!.userId,
          createdAt: saved.requestedAt || new Date().toISOString(),
        });
      }
    }

    // Audit
    AppDataSource.getRepository(AuditLog).save({
      userId: req.user!.userId, action: 'EXECUTE', connectionId: conn.id,
      sqlText: data.sqlText.slice(0, 2000), result: 'SUBMITTED', ipAddress: req.ip,
    }).catch(() => {});

    return res.status(201).json({ data: saved });
  } catch (err: any) {
    if (err.name === 'ZodError') return res.status(400).json({ error: 'Dados inválidos', details: err.errors });
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/execution/:id/approve
router.post('/:id/approve', authMiddleware, requireRole('admin', 'dba'), async (req: Request, res: Response) => {
  const request = await execRepo().findOne({ where: { id: req.params.id } });
  if (!request) return res.status(404).json({ error: 'Solicitação não encontrada' });
  if (request.status !== 'pending') return res.status(400).json({ error: `Status atual: ${request.status}. Só é possível aprovar solicitações pendentes.` });

  request.status = 'approved';
  request.approvedById = req.user!.userId;
  request.approvedAt = new Date();
  await execRepo().save(request);

  AppDataSource.getRepository(AuditLog).save({
    userId: req.user!.userId, action: 'APPROVE', connectionId: request.connectionId,
    sqlText: request.sqlText.slice(0, 2000), result: 'SUCCESS', ipAddress: req.ip,
  }).catch(() => {});

  return res.json({ data: request });
});

// POST /api/execution/:id/reject
router.post('/:id/reject', authMiddleware, requireRole('admin', 'dba'), async (req: Request, res: Response) => {
  const request = await execRepo().findOne({ where: { id: req.params.id } });
  if (!request) return res.status(404).json({ error: 'Solicitação não encontrada' });
  if (request.status !== 'pending') return res.status(400).json({ error: 'Só é possível rejeitar solicitações pendentes.' });

  request.status = 'rejected';
  request.approvedById = req.user!.userId;
  await execRepo().save(request);

  AppDataSource.getRepository(AuditLog).save({
    userId: req.user!.userId, action: 'REJECT', connectionId: request.connectionId,
    sqlText: request.sqlText.slice(0, 2000), result: 'REJECTED', ipAddress: req.ip,
  }).catch(() => {});

  return res.json({ data: request });
});

// POST /api/execution/:id/execute
router.post('/:id/execute', authMiddleware, requireRole('admin', 'dba'), async (req: Request, res: Response) => {
  const request = await execRepo().findOne({ where: { id: req.params.id } });
  if (!request) return res.status(404).json({ error: 'Solicitação não encontrada' });
  if (request.status !== 'approved') return res.status(400).json({ error: 'Só é possível executar solicitações aprovadas.' });

  const conn = await connRepo().findOne({ where: { id: request.connectionId } });
  if (!conn) return res.status(404).json({ error: 'Conexão não encontrada' });

  try {
    const adapter = new PostgresAdapter();
    await adapter.connect(getConnCredentials(conn));
    const result = await adapter.executeSQL(request.sqlText);
    await adapter.disconnect();

    request.status = result.success ? 'executed' : 'failed';
    request.executionResult = JSON.stringify(result.rows?.slice(0, 100) || { rowsAffected: result.rowsAffected });
    request.executionDurationMs = result.durationMs;
    request.executedAt = new Date();
    if (!result.success) request.errorMessage = result.error || null;
    await execRepo().save(request);

    AppDataSource.getRepository(AuditLog).save({
      userId: req.user!.userId, action: 'EXECUTE', connectionId: conn.id,
      sqlText: request.sqlText.slice(0, 2000), result: result.success ? 'SUCCESS' : 'ERROR',
      durationMs: result.durationMs, errorMessage: result.error, ipAddress: req.ip,
    }).catch(() => {});

    return res.json({ data: { request, result } });
  } catch (err: any) {
    request.status = 'failed';
    request.errorMessage = err.message;
    await execRepo().save(request);
    return res.status(500).json({ error: err.message });
  }
});

export default router;
