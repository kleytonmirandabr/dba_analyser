import { Router, Request, Response } from 'express';
import { spawn } from 'child_process';
import { existsSync, mkdirSync, statSync, createReadStream, unlinkSync } from 'fs';
import { join } from 'path';
import { AppDataSource } from '../config/database';
import { BackupJob } from '../entities/backup-job.entity';
import { Connection } from '../entities/connection.entity';
import { getConnCredentials } from '../utils/credentials';

const router = Router();
const BACKUP_DIR = '/tmp/dba-backups';

function getBackupDir(connId: string) {
  const dir = join(BACKUP_DIR, connId);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

// POST /api/backup/:connId/create
router.post('/:connId/create', async (req: Request, res: Response) => {
  try {
    const { connId } = req.params;
    const { database, format = 'custom', schema, tablesOnly, dataOnly } = req.body;

    const connRepo = AppDataSource.getRepository(Connection);
    const conn = await connRepo.findOne({ where: { id: connId, isActive: true } });
    if (!conn) return res.status(404).json({ error: 'Connection not found' });

    const creds = getConnCredentials(conn);
    const jobRepo = AppDataSource.getRepository(BackupJob);
    const timestamp = Date.now();
    const ext = format === 'plain' ? 'sql' : 'dump';
    const filename = `backup_${timestamp}.${ext}`;
    const dir = getBackupDir(connId);
    const filepath = join(dir, filename);

    const job = jobRepo.create({
      connectionId: connId,
      type: 'backup',
      status: 'running',
      format,
      filename,
      database: database || creds.database,
      schema: schema || null,
    });
    await jobRepo.save(job);

    if (conn.dbType === 'postgresql') {
      const args: string[] = [];
      args.push('-h', creds.host);
      args.push('-p', String(creds.port || 5432));
      args.push('-U', creds.username);
      if (format === 'custom') args.push('-Fc');
      else if (format === 'directory') args.push('-Fd');
      else args.push('-Fp');
      if (schema) args.push('-n', schema);
      if (tablesOnly) args.push('-s');
      if (dataOnly) args.push('-a');
      args.push('-f', filepath);
      args.push(database || creds.database);

      const env = { ...process.env, PGPASSWORD: creds.password };
      const proc = spawn('pg_dump', args, { env });

      let logs = '';
      proc.stderr.on('data', (d: Buffer) => { logs += d.toString(); });
      proc.on('close', async (code: number | null) => {
        if (code === 0) {
          const stat = statSync(filepath);
          job.status = 'completed';
          job.sizeBytes = stat.size;
          job.completedAt = new Date();
        } else {
          job.status = 'failed';
          job.error = logs || `pg_dump exited with code ${code}`;
        }
        job.logs = logs;
        await jobRepo.save(job);
      });
    } else if (conn.dbType === 'mssql') {
      job.status = 'failed';
      job.error = 'MSSQL backup requires sqlcmd on server. Use BACKUP DATABASE via Query page.';
      job.completedAt = new Date();
      await jobRepo.save(job);
    } else {
      job.status = 'failed';
      job.error = `Backup not supported for ${conn.dbType}`;
      job.completedAt = new Date();
      await jobRepo.save(job);
    }

    res.json({ data: { id: job.id, status: job.status, filename, startedAt: job.startedAt } });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/backup/:connId/list
router.get('/:connId/list', async (req: Request, res: Response) => {
  try {
    const jobRepo = AppDataSource.getRepository(BackupJob);
    const jobs = await jobRepo.find({
      where: { connectionId: req.params.connId, type: 'backup' },
      order: { startedAt: 'DESC' },
    });
    res.json({ data: jobs });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/backup/:connId/download/:backupId
router.get('/:connId/download/:backupId', async (req: Request, res: Response) => {
  try {
    const jobRepo = AppDataSource.getRepository(BackupJob);
    const job = await jobRepo.findOne({ where: { id: req.params.backupId, connectionId: req.params.connId } });
    if (!job || !job.filename) return res.status(404).json({ error: 'Backup not found' });

    const filepath = join(getBackupDir(req.params.connId), job.filename);
    if (!existsSync(filepath)) return res.status(404).json({ error: 'File not found on disk' });

    res.setHeader('Content-Disposition', `attachment; filename="${job.filename}"`);
    res.setHeader('Content-Type', 'application/octet-stream');
    createReadStream(filepath).pipe(res);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/backup/:connId/restore
router.post('/:connId/restore', async (req: Request, res: Response) => {
  try {
    const { connId } = req.params;
    const { backupId, targetDatabase, clean } = req.body;

    const connRepo = AppDataSource.getRepository(Connection);
    const conn = await connRepo.findOne({ where: { id: connId, isActive: true } });
    if (!conn) return res.status(404).json({ error: 'Connection not found' });

    const creds = getConnCredentials(conn);
    const jobRepo = AppDataSource.getRepository(BackupJob);
    const backupJob = await jobRepo.findOne({ where: { id: backupId, connectionId: connId } });
    if (!backupJob || !backupJob.filename) return res.status(404).json({ error: 'Backup not found' });

    const filepath = join(getBackupDir(connId), backupJob.filename);
    if (!existsSync(filepath)) return res.status(404).json({ error: 'Backup file not found on disk' });

    const restoreJob = jobRepo.create({
      connectionId: connId,
      type: 'restore',
      status: 'running',
      format: backupJob.format,
      filename: backupJob.filename,
      database: targetDatabase || creds.database,
    });
    await jobRepo.save(restoreJob);

    if (conn.dbType === 'postgresql') {
      const args: string[] = [];
      args.push('-h', creds.host);
      args.push('-p', String(creds.port || 5432));
      args.push('-U', creds.username);
      args.push('-d', targetDatabase || creds.database);
      if (clean) args.push('-c');
      args.push(filepath);

      const env = { ...process.env, PGPASSWORD: creds.password };
      const proc = spawn('pg_restore', args, { env });

      let logs = '';
      proc.stderr.on('data', (d: Buffer) => { logs += d.toString(); });
      proc.on('close', async (code: number | null) => {
        restoreJob.status = code === 0 ? 'completed' : 'failed';
        restoreJob.logs = logs;
        restoreJob.completedAt = new Date();
        if (code !== 0) restoreJob.error = logs || `pg_restore exited with code ${code}`;
        await jobRepo.save(restoreJob);
      });
    } else {
      restoreJob.status = 'failed';
      restoreJob.error = `Restore not supported for ${conn.dbType}`;
      restoreJob.completedAt = new Date();
      await jobRepo.save(restoreJob);
    }

    res.json({ data: { id: restoreJob.id, status: restoreJob.status } });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/backup/status/:jobId
router.get('/status/:jobId', async (req: Request, res: Response) => {
  try {
    const jobRepo = AppDataSource.getRepository(BackupJob);
    const job = await jobRepo.findOne({ where: { id: req.params.jobId } });
    if (!job) return res.status(404).json({ error: 'Job not found' });
    res.json({ data: job });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/backup/:connId/:backupId
router.delete('/:connId/:backupId', async (req: Request, res: Response) => {
  try {
    const jobRepo = AppDataSource.getRepository(BackupJob);
    const job = await jobRepo.findOne({ where: { id: req.params.backupId, connectionId: req.params.connId } });
    if (!job) return res.status(404).json({ error: 'Backup not found' });

    if (job.filename) {
      const filepath = join(getBackupDir(req.params.connId), job.filename);
      if (existsSync(filepath)) unlinkSync(filepath);
    }
    await jobRepo.remove(job);
    res.json({ data: { success: true } });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
