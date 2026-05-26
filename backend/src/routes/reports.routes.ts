import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { AppDataSource } from '../config/database';
import { ReportSchedule } from '../entities/report-schedule.entity';
import { collectReportData } from '../services/report.service';
import { generateReportPDF } from '../services/pdf-generator.service';
import { sendReportEmail } from '../services/email.service';
import * as path from 'path';
import * as fs from 'fs';

const router = Router();
const scheduleRepo = () => AppDataSource.getRepository(ReportSchedule);

// POST /api/reports/generate — generate report now
router.post('/generate', authMiddleware, async (req: Request, res: Response) => {
  const { periodDays = 7 } = req.body;
  try {
    const data = await collectReportData(periodDays);
    const pdf = await generateReportPDF(data);

    // Save to disk
    const reportsDir = path.resolve(__dirname, '../../reports');
    if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true });
    const filename = `relatorio_${new Date().toISOString().slice(0, 10)}.pdf`;
    const filepath = path.join(reportsDir, filename);
    fs.writeFileSync(filepath, pdf);

    return res.json({ data: { filename, filepath, reportData: data, sizeBytes: pdf.length } });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/reports/download/:filename
router.get('/download/:filename', authMiddleware, async (req: Request, res: Response) => {
  const reportsDir = path.resolve(__dirname, '../../reports');
  const filepath = path.join(reportsDir, req.params.filename);
  
  if (!fs.existsSync(filepath)) return res.status(404).json({ error: 'Relatório não encontrado' });
  
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${req.params.filename}"`);
  fs.createReadStream(filepath).pipe(res);
});

// GET /api/reports/list — list generated reports
router.get('/list', authMiddleware, async (_req: Request, res: Response) => {
  const reportsDir = path.resolve(__dirname, '../../reports');
  if (!fs.existsSync(reportsDir)) return res.json({ data: [] });
  
  const files = fs.readdirSync(reportsDir)
    .filter(f => f.endsWith('.pdf'))
    .map(f => {
      const stat = fs.statSync(path.join(reportsDir, f));
      return { filename: f, sizeBytes: stat.size, createdAt: stat.mtime.toISOString() };
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return res.json({ data: files });
});

// --- Schedules CRUD ---

// GET /api/reports/schedules
router.get('/schedules', authMiddleware, async (_req: Request, res: Response) => {
  const schedules = await scheduleRepo().find({ order: { createdAt: 'DESC' } });
  return res.json({ data: schedules });
});

// POST /api/reports/schedules
router.post('/schedules', authMiddleware, async (req: Request, res: Response) => {
  const { name, frequency = 'weekly', dayOfWeek = 1, dayOfMonth = 1, hour = 8, recipients, periodDays = 7 } = req.body;
  if (!name || !recipients?.length) return res.status(400).json({ error: 'Nome e destinatários obrigatórios' });

  const schedule = scheduleRepo().create({ name, frequency, dayOfWeek, dayOfMonth, hour, recipients, periodDays, enabled: true });
  await scheduleRepo().save(schedule);
  return res.json({ data: schedule });
});

// PUT /api/reports/schedules/:id
router.put('/schedules/:id', authMiddleware, async (req: Request, res: Response) => {
  const schedule = await scheduleRepo().findOne({ where: { id: req.params.id } });
  if (!schedule) return res.status(404).json({ error: 'Agendamento não encontrado' });
  
  Object.assign(schedule, req.body);
  await scheduleRepo().save(schedule);
  return res.json({ data: schedule });
});

// DELETE /api/reports/schedules/:id
router.delete('/schedules/:id', authMiddleware, async (req: Request, res: Response) => {
  await scheduleRepo().delete(req.params.id);
  return res.json({ success: true });
});

// POST /api/reports/send — send existing report by email
router.post('/send', authMiddleware, async (req: Request, res: Response) => {
  const { filename, recipients } = req.body;
  if (!filename || !recipients?.length) return res.status(400).json({ error: 'Filename e recipients obrigatórios' });

  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = parseInt(process.env.SMTP_PORT || '587');
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;

  if (!smtpHost || !smtpUser || !smtpPass) {
    return res.status(400).json({ error: 'SMTP não configurado. Defina SMTP_HOST, SMTP_USER, SMTP_PASS no ambiente.' });
  }

  const reportsDir = path.resolve(__dirname, '../../reports');
  const filepath = path.join(reportsDir, filename);
  if (!fs.existsSync(filepath)) return res.status(404).json({ error: 'Relatório não encontrado' });

  const pdf = fs.readFileSync(filepath);
  const result = await sendReportEmail(
    { host: smtpHost, port: smtpPort, user: smtpUser, pass: smtpPass },
    recipients,
    `DBA Analyser — Relatório de Saúde (${new Date().toLocaleDateString('pt-BR')})`,
    '<p>Segue em anexo o relatório executivo de saúde dos bancos de dados.</p><p>— DBA Analyser</p>',
    pdf,
    filename
  );

  return res.json({ data: result });
});

export default router;
