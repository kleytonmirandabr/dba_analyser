import * as cron from 'node-cron';
import { AppDataSource } from '../config/database';
import { ReportSchedule } from '../entities/report-schedule.entity';
import { collectReportData } from './report.service';
import { generateReportPDF } from './pdf-generator.service';
import { sendReportEmail } from './email.service';
import * as fs from 'fs';
import * as path from 'path';

export function startReportScheduler() {
  // Check every hour if any report needs to be sent
  cron.schedule('0 * * * *', async () => {
    try {
      const repo = AppDataSource.getRepository(ReportSchedule);
      const schedules = await repo.find({ where: { enabled: true } });

      const now = new Date();
      const currentHour = now.getUTCHours();
      const currentDow = now.getUTCDay();
      const currentDom = now.getUTCDate();

      for (const schedule of schedules) {
        if (schedule.hour !== currentHour) continue;

        // Check frequency
        let shouldSend = false;
        if (schedule.frequency === 'daily') shouldSend = true;
        else if (schedule.frequency === 'weekly' && currentDow === schedule.dayOfWeek) shouldSend = true;
        else if (schedule.frequency === 'monthly' && currentDom === schedule.dayOfMonth) shouldSend = true;

        if (!shouldSend) continue;

        // Check if already sent today
        if (schedule.lastSentAt) {
          const lastSent = new Date(schedule.lastSentAt);
          if (lastSent.toDateString() === now.toDateString()) continue;
        }

        // Generate and send
        try {
          const data = await collectReportData(schedule.periodDays);
          const pdf = await generateReportPDF(data);

          const smtpHost = process.env.SMTP_HOST;
          const smtpUser = process.env.SMTP_USER;
          const smtpPass = process.env.SMTP_PASS;

          if (smtpHost && smtpUser && smtpPass) {
            const filename = `relatorio_${now.toISOString().slice(0, 10)}.pdf`;

            // Save PDF
            const reportsDir = path.resolve(__dirname, '../../reports');
            if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true });
            fs.writeFileSync(path.join(reportsDir, filename), pdf);

            await sendReportEmail(
              { host: smtpHost, port: parseInt(process.env.SMTP_PORT || '587'), user: smtpUser, pass: smtpPass },
              schedule.recipients,
              `DBA Analyser — Relatório ${schedule.frequency === 'daily' ? 'Diário' : schedule.frequency === 'weekly' ? 'Semanal' : 'Mensal'} (${now.toLocaleDateString('pt-BR')})`,
              '<p>Segue em anexo o relatório executivo de saúde dos bancos de dados.</p><p>— DBA Analyser</p>',
              pdf,
              filename
            );

            schedule.lastSentAt = now;
            schedule.lastError = null as any;
          } else {
            schedule.lastError = 'SMTP não configurado';
          }
        } catch (err: any) {
          schedule.lastError = err.message;
        }

        await repo.save(schedule);
      }
    } catch (err) {
      console.error('[ReportScheduler] Error:', err);
    }
  });

  console.log('[ReportScheduler] Started — checking hourly');
}
